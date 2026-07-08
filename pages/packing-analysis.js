/* GO page: Packing Analysis — who sells packing, attach rate over time, and foreman
   packing-vs-estimate accuracy. PBI source: General Overview "Packing Analysis"
   (05-dashboards.md GO-6), deepened with the GO-10 "Packing" foreman pivot measures
   (Total Packing Written / Total Packing Estimate / Packing Difference %) which are
   materialized on mart_forman_scorecard.
   Audit F9/D1a: packing revenue = closing "Material Total" (registry 'Total Packing
   Written'); "Material $" is the foreman packing COMMISSION ('Forman Salary -
   Packing') and is not revenue — nothing on this page uses it any more. */
registerPage({
  id: "packing-analysis",
  group: "ops",
  title: "Packing Analysis",
  async render(host) {
    const [closingAll, scoreAll] = await Promise.all([RS.load("closing"), RS.load("scorecard")]);
    const rows = RS.filtered("closing", closingAll);
    const scRows = RS.filtered("scorecard", scoreAll);
    const M = RS.M;

    // Closing money columns can arrive as '$ 1,234' varchar — always RS.num().
    const pack = r => RS.num(r["Material Total"]);        // customer-facing packing $ per job (F9/D1a)
    const packingWritten = M["Total Packing Written"].fn(rows); // PBI: Total Packing Written (SUM of Material Total)
    const packJobs = rows.filter(r => pack(r) > 0);
    // Attach rate (packing jobs / jobs) is a web-rebuild addition — PBI GO-6 has no such measure.
    const attach = rows.length ? packJobs.length / rows.length : null;
    // PBI: Total Morning Jobs (Job Part of the Day = 'Morning Job', from Forman Job Order = 1).
    const morningRows = rows.filter(r => r["Job Part of the Day"] === "Morning Job");
    const morningPack = morningRows.reduce((a, r) => a + pack(r), 0);
    // RS.money(null) renders "$0" — null-safe wrapper for nullable money cells.
    const moneyNS = v => v == null ? "—" : RS.money(v);

    if (!rows.length && !scRows.length) {                  // nothing at all in scope
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Packing Analysis</h1>
          <p>Packing revenue — who sells it, how often it attaches, and foreman estimate accuracy</p>
        </div>
        <div class="panel" style="padding:18px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }
    const emptyCard = title => {                           // per-card empty state
      const d = document.createElement("div");
      d.className = "panel";
      d.innerHTML = `<div class="panel-head"><span class="panel-title">${RSC.esc(title)}</span></div>
        <div style="padding:16px 14px;color:var(--muted)">No data for the current filters.</div>`;
      return d;
    };

    // ---- YoY chip: Jan-1 → max date of the FILTERED rows. BOTH windows are cut from
    // the date-UNfiltered dataset (non-date slicers still apply) so cur/prev cover the
    // exact same calendar span — a mid-year dateFrom or day-of-month filter on `rows`
    // must not shrink the current side of the comparison.
    const yoyWin = (() => {
      const maxD = rows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (!maxD) return null;
      const y = +maxD.slice(0, 4);
      const s = RS.state, save = [s.dateFrom, s.dateTo, s.dayFrom, s.dayTo];
      s.dateFrom = s.dateTo = s.dayFrom = s.dayTo = null;
      const all = RS.filtered("closing", closingAll);
      [s.dateFrom, s.dateTo, s.dayFrom, s.dayTo] = save;
      return {
        cur: all.filter(r => r._d >= y + "-01-01" && r._d <= maxD),
        prev: all.filter(r => r._d >= (y - 1) + "-01-01" && r._d <= (y - 1) + maxD.slice(4)),
      };
    })();
    const yoyChip = fn => {
      if (!yoyWin || !yoyWin.prev.length) return "";
      const cur = fn(yoyWin.cur), prev = fn(yoyWin.prev);
      if (cur == null || prev == null || !isFinite(cur) || !isFinite(prev) || !prev) return "";
      const g = (cur - prev) / Math.abs(prev);
      return ` <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(g)).toFixed(1)}%</span>`;
    };

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Packing Analysis</h1>
        <p>Packing revenue — who sells it, how often it attaches, and foreman estimate accuracy ·
           <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· foreman scores from the monthly scorecard
           · KPI change vs same period last year</span></p>
      </div>
      <div class="rs-kpis" id="pkKpis"></div>
      <div id="pkMain"></div>
      <div class="rs-grid2" id="pkGrid"></div>`;

    RSC.kpis(document.getElementById("pkKpis"), [
      { label: "Packing Written",
        value: RS.moneyC(packingWritten) + yoyChip(rs => M["Total Packing Written"].fn(rs)),
        sub: `${RS.money(packingWritten)} · packing charged to customers` },
      { label: "Jobs with Packing", value: RS.fmtN(packJobs.length),
        sub: `of ${RS.fmtN(rows.length)} jobs in scope` },
      { label: "Packing Attach Rate",
        value: RS.fmtPct(attach) +
          yoyChip(rs => rs.length ? rs.filter(r => pack(r) > 0).length / rs.length : null),
        sub: "jobs with any packing charged" },
      { label: "Avg Packing / Packing Job",
        value: packJobs.length ? RS.moneyC(packingWritten / packJobs.length) : "—",
        sub: packJobs.length
          ? `${RS.money(packingWritten / packJobs.length)} per attached job`
          : "packing $ per attached job" },
      { label: "Morning-Job Packing Share",
        value: RS.fmtPct(packingWritten ? morningPack / packingWritten : null),
        sub: `${RS.money(morningPack)} on morning jobs` },
      { label: "Morning Jobs", value: RS.fmtN(morningRows.length),
        sub: `${RS.fmtPct(rows.length ? morningRows.length / rows.length : null)} of jobs` },
    ]);

    /* ---------------- main: Packing by Sales Person ---------------- */
    // Group by the primary Sales Person (SP 2/3 co-sellers not re-attributed — PBI parity).
    const bySp = (() => {
      const g = {};
      rows.forEach(r => {
        const k = (r["Sales Person"] == null || r["Sales Person"] === "") ? "—" : String(r["Sales Person"]);
        (g[k] = g[k] || []).push(r);
      });
      return Object.entries(g).map(([k, rs]) => {
        const v = M["Total Packing Written"].fn(rs);      // PBI: Total Packing Written
        const pj = rs.filter(r => pack(r) > 0).length;
        return { k, v, jobs: rs.length, pj,
                 attach: rs.length ? pj / rs.length : null,
                 avg: pj ? v / pj : null };
      }).sort((a, b) => (b.v || 0) - (a.v || 0));
    })();

    if (!rows.length) {
      document.getElementById("pkMain").appendChild(emptyCard("Packing by Sales Person"));
    } else RSC.chartCard(document.getElementById("pkMain"), {
      title: "Packing by Sales Person",
      // Caption describes the CHART (top 20); the tabular view adds an "All others"
      // bucket + Total row, so this graph-only label doesn't apply there.
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">top 20 by packing $ · attach = packing jobs / jobs</span>`,
      buildChart(canvas) {
        const list = bySp.slice(0, 20);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ label: "Packing Written", data: list.map(x => Math.round(x.v || 0)),
              backgroundColor: "#b7e23b", borderRadius: 5 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: {
                label: c => {
                  const x = list[c.dataIndex];
                  return [`Packing Written: ${RS.money(c.raw)}`,
                          `Attach rate: ${RS.fmtPct(x.attach)} (${RS.fmtN(x.pj)} of ${RS.fmtN(x.jobs)} jobs)`];
                },
              } },
            },
            scales: { x: { ticks: { callback: v => "$" + (v / 1000) + "k" } },
                      y: { ticks: { font: { size: 11 } } } },
          },
        });
      },
      buildTable() {
        const top = bySp.slice(0, 20);
        const rest = bySp.slice(20);
        const data = top.map((x, i) => ({
          rk: i + 1, k: x.k, v: x.v, sh: packingWritten ? (x.v || 0) / packingWritten : null,
          jobs: x.jobs, pj: x.pj, at: x.attach, avg: x.avg,
        }));
        if (rest.length) {                                 // "everything else" bucket
          const v = rest.reduce((a, x) => a + (x.v || 0), 0);
          const jobs = rest.reduce((a, x) => a + x.jobs, 0);
          const pj = rest.reduce((a, x) => a + x.pj, 0);
          data.push({ rk: null, k: `All others (${rest.length})`, v,
            sh: packingWritten ? v / packingWritten : null, jobs, pj,
            at: jobs ? pj / jobs : null, avg: pj ? v / pj : null });
        }
        return RSC.table(
          [{ key: "rk", label: "#" }, { key: "k", label: "Sales Person" },
           { key: "v", label: "Packing Written", fmt: moneyNS },
           { key: "sh", label: "% of Packing", fmt: RS.fmtPct },
           { key: "jobs", label: "Jobs", fmt: RS.fmtN },
           { key: "pj", label: "Packing Jobs", fmt: RS.fmtN },
           { key: "at", label: "Attach Rate", fmt: RS.fmtPct },
           { key: "avg", label: "Avg $ / Packing Job", fmt: moneyNS }],
          data,
          { k: "Total", v: packingWritten, sh: packingWritten ? 1 : null, jobs: rows.length,
            pj: packJobs.length, at: attach,
            avg: packJobs.length ? packingWritten / packJobs.length : null });
      },
    });

    /* ---------------- grid2 (a): Packing vs Estimate Score by Foreman ---------------- */
    const grid = document.getElementById("pkGrid");
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const scoreOf = r => r["Packing Vs Estimate Score"] == null ? null : RS.num(r["Packing Vs Estimate Score"]);
    // Audit F8/D5: don't anchor to the current month while it is under
    // RS.MIN_MONTH_DAYS days old — RS.displayMonth steps back to the last COMPLETE
    // month (keys must be DEDUPED + sorted, one entry per month, for its step-back).
    const scMonthKeys = [...new Set(scRows.filter(r => r._m).map(mk))].sort();
    const dispM = RS.displayMonth(scMonthKeys);
    const latestKey = dispM.key;
    const scLatest = latestKey ? scRows.filter(r => mk(r) === latestKey) : [];
    const latestLabel = (scLatest.length ? (scLatest[0]["Month Year"] || latestKey) : "no month in scope")
      + (dispM.partial ? " (partial)" : "");
    // Name the month that is actually hidden — the latest DATA month (last key), not
    // the calendar month: when the scorecard lags, the two differ (same as forman.js).
    const hiddenKey = scMonthKeys[scMonthKeys.length - 1];
    const hiddenNote = (dispM.steppedBack && hiddenKey)
      ? `${RS.monthName(+hiddenKey.slice(5))} ${hiddenKey.slice(0, 4)} hidden until day ${RS.MIN_MONTH_DAYS} — too few days to be meaningful`
      : "";
    // Previous-month lookup for the score delta — from the UNFILTERED scorecard so a
    // tight date window doesn't blank the comparison (foreman is the map key anyway).
    const prevScore = (() => {
      if (!latestKey) return {};
      const y = +latestKey.slice(0, 4), m = +latestKey.slice(5);
      const pk = (m === 1 ? (y - 1) + "-12" : y + "-" + String(m - 1).padStart(2, "0"));
      const map = {};
      scoreAll.forEach(r => {
        if (mk(r) === pk) map[r.Foreman == null ? "—" : String(r.Foreman)] = scoreOf(r);
      });
      return map;
    })();
    const scList = scLatest.map(r => ({
      k: r.Foreman == null ? "—" : String(r.Foreman),
      score: scoreOf(r),                                   // PBI: Packing Vs Estimate Score
      // PBI 'Packing Difference %' is a written/estimate RATIO (2.05 = 205%); the portal
      // convention (C15) is the signed delta (ratio − 1 → +105%), matching the Packing tab.
      diff: r["Packing Difference %"] == null ? null : RS.num(r["Packing Difference %"]) - 1,
      written: RS.num(r["Total Packing Written"]),         // PBI: Total Packing Written
      est: RS.num(r["Total Packing Estimate"]),            // PBI: Total Packing Estimate
      jobs: RS.num(r["Total Jobs"]),
    })).sort((a, b) => (b.score == null ? -1 : b.score) - (a.score == null ? -1 : a.score));

    if (!scLatest.length) {
      grid.appendChild(emptyCard("Packing vs Estimate Score by Foreman"));
    } else RSC.chartCard(grid, {
      title: "Packing vs Estimate Score by Foreman",
      controlsHtml: `<span class="lbl">latest month in scope · ${RSC.esc(latestLabel)}</span>`
        + (hiddenNote ? `<span class="lbl" style="color:var(--muted)"> · ${RSC.esc(hiddenNote)}</span>` : ""),
      buildChart(canvas) {
        const list = scList.filter(x => x.score != null).slice(0, 20);
        return new Chart(canvas, {
          data: {
            labels: list.map(x => x.k),
            datasets: [
              { type: "bar", label: "Packing Vs Estimate Score", yAxisID: "y",
                data: list.map(x => +x.score.toFixed(1)),
                backgroundColor: "#a78bfa", borderRadius: 4 },
              { type: "line", label: "Written vs Estimate", yAxisID: "y2",
                data: list.map(x => x.diff == null ? null : +(100 * x.diff).toFixed(1)),
                borderColor: "#fbbf24", backgroundColor: "#fbbf24",
                borderWidth: 2, pointRadius: 3, tension: .3 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => {
                const x = list[c.dataIndex];
                return c.datasetIndex === 0
                  ? [`Score: ${c.raw}`,
                     `Written ${RS.money(x.written)} vs Estimate ${RS.money(x.est)}`]
                  : (c.raw == null ? "Written vs Estimate: —"
                    : [`Written vs Estimate: ${c.raw >= 0 ? "+" : ""}${c.raw}%`,
                       `= ${(100 * (x.diff + 1)).toFixed(0)}% of estimate — the number the old report called Packing Difference %`]);
              } } },
            },
            scales: {
              x: { ticks: { font: { size: 11 }, maxRotation: 60, minRotation: 40,
                    callback(v) { const l = this.getLabelForValue(v);
                      return l.length > 12 ? l.slice(0, 11) + "…" : l; } } },
              y: { beginAtZero: true, title: { display: true, text: "Score" } },
              y2: { position: "right", grid: { drawOnChartArea: false },
                    ticks: { callback: v => v + "%" } },
            },
          },
        });
      },
      buildTable() {
        const dFmt = v => v == null ? "—" :
          `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${v.toFixed(0)}</span>`;
        // signed delta convention (C15) — same rendering as the Packing tab
        const diffFmt = v => (v == null || isNaN(v)) ? "—" :
          `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${(100 * v).toFixed(1)}%</span>`;
        const shown = scList.slice(0, 50);
        const totWritten = scList.reduce((a, x) => a + x.written, 0);
        const note = scList.length > shown.length
          ? `<div style="padding:6px 10px;color:var(--muted);font-size:12px">showing ${shown.length} of ${RS.fmtN(scList.length)} foremen</div>` : "";
        return RSC.table(
          [{ key: "k", label: "Foreman" }, { key: "jobs", label: "Jobs", fmt: RS.fmtN },
           { key: "written", label: "Packing Written", fmt: moneyNS },
           { key: "wsh", label: "% of Written", fmt: RS.fmtPct },
           { key: "est", label: "Packing Estimate", fmt: moneyNS },
           { key: "diff", label: "Written vs Estimate", fmt: diffFmt },
           { key: "score", label: "Score", fmt: RS.fmt1 },
           { key: "d", label: "Score change vs prev mo", fmt: dFmt }],
          shown.map(x => ({
            ...x,
            wsh: totWritten ? x.written / totWritten : null,
            d: (x.score == null || prevScore[x.k] == null) ? null : x.score - prevScore[x.k],
          })),
          { k: "Total", jobs: scList.reduce((a, x) => a + x.jobs, 0),
            written: totWritten, wsh: totWritten ? 1 : null,
            est: scList.reduce((a, x) => a + x.est, 0) }) + note;
      },
    });

    /* ---------------- grid2 (b): attach rate by month ---------------- */
    const byMonth = (() => {
      const g = {};
      rows.forEach(r => { if (r._m) (g[mk(r)] = g[mk(r)] || []).push(r); });
      return Object.keys(g).sort().map(k => {
        const rs = g[k], pj = rs.filter(r => pack(r) > 0).length;
        const v = M["Total Packing Written"].fn(rs);       // PBI: Total Packing Written
        return { k, jobs: rs.length, pj, at: rs.length ? pj / rs.length : null,
                 v, avg: pj ? v / pj : null };
      });
    })();
    byMonth.forEach((x, i) => {                            // MoM delta in percentage points
      const p = i ? byMonth[i - 1].at : null;
      x.d = (x.at == null || p == null) ? null : 100 * (x.at - p);
    });
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);

    if (!byMonth.length) {
      grid.appendChild(emptyCard("Packing attach rate by month"));
    } else RSC.chartCard(grid, {
      title: "Packing attach rate by month",
      controlsHtml: `<span class="lbl">last 24 mo · % of jobs with any packing charged</span>`,
      buildChart(canvas) {
        const shown = byMonth.slice(-24);
        return new Chart(canvas, {
          type: "line",
          data: {
            labels: shown.map(x => mLabel(x.k)),
            datasets: [{ label: "Attach Rate",
              data: shown.map(x => x.at == null ? null : +(100 * x.at).toFixed(1)),
              borderColor: "#5b8cff", backgroundColor: "rgba(91,140,255,.18)",
              fill: true, borderWidth: 2, pointRadius: 2, tension: .3 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: c => {
                const x = shown[c.dataIndex];
                return [`Attach rate: ${c.raw == null ? "—" : c.raw + "%"}`,
                        `${RS.fmtN(x.pj)} packing jobs of ${RS.fmtN(x.jobs)} · ${RS.money(x.v)} written`];
              } } },
            },
            scales: {
              y: { beginAtZero: true, ticks: { callback: v => v + "%" } },
              x: { ticks: { autoSkip: true, maxTicksLimit: 14, maxRotation: 45,
                            font: { size: 11 } } },
            },
          },
        });
      },
      buildTable() {
        const dFmt = v => v == null ? "—" :
          `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${v.toFixed(1)} pp</span>`;
        const shown = byMonth.slice(-24);
        const note = byMonth.length > shown.length
          ? `<div style="padding:6px 10px;color:var(--muted);font-size:12px">showing last ${shown.length} of ${RS.fmtN(byMonth.length)} months</div>` : "";
        return RSC.table(
          [{ key: "m", label: "Month" }, { key: "jobs", label: "Jobs", fmt: RS.fmtN },
           { key: "pj", label: "Packing Jobs", fmt: RS.fmtN },
           { key: "at", label: "Attach Rate", fmt: RS.fmtPct },
           { key: "d", label: "MoM change", fmt: dFmt },
           { key: "v", label: "Packing Written", fmt: moneyNS },
           { key: "avg", label: "Avg $ / Packing Job", fmt: moneyNS }],
          shown.map(x => ({ ...x, m: mLabel(x.k) })),
          { m: "Total", jobs: rows.length, pj: packJobs.length, at: attach, v: packingWritten,
            avg: packJobs.length ? packingWritten / packJobs.length : null }) + note;
      },
    });
  },
});
