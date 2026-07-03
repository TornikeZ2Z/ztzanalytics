/* OPS page: Labor & Crew — crew productivity & labor cost (backlog E20).
   Revenue per foreman hour, helper labor cost as % of revenue, and crew-size
   economics ("right-size the crew"). Helper cost is membership-joined from
   fct_helper_salaries via the closing row's Unique Key (same technique as
   forman-analysis.js), so it inherits the global date/slicer scope.
   Productivity denominator = FOREMAN hours (closing `Foreman Hours`) — the
   only per-job hours column on closing; helper hours exist only in the
   helper-salaries lookup and are shown nowhere here to avoid mixing grains. */
registerPage({
  id: "labor-analysis",
  group: "ops",
  title: "Labor & Crew",
  async render(host) {
    const [closingAll, helpersAll] = await Promise.all([
      RS.load("closing").catch(() => []),
      RS.load("helper_salaries").catch(() => []),
    ]);
    const rows = RS.filtered("closing", closingAll);
    const M = RS.M;

    // ---- helper_salaries is a lookup (no date column): Unique Key -> helper cost.
    // Time slicing happens through the FILTERED closing rows' key membership.
    const helperByKey = new Map();
    helpersAll.forEach(r => {
      const k = r["Unique Key"];
      if (k) helperByKey.set(k, (helperByKey.get(k) || 0) + RS.num(r["Amount Received"]));
    });
    const helperOk = helperByKey.size > 0;
    const helperCost = rs => helperOk
      ? rs.reduce((a, r) => a + (helperByKey.get(r["Unique Key"]) || 0), 0)
      : null;

    // ---- null-safe cell formatters
    const nzMoney = v => (v == null || isNaN(v)) ? "—" : RS.money(v);
    const nzN = v => (v == null || isNaN(v)) ? "—" : RS.fmtN(v);
    const nzPct = v => (v == null || isNaN(v)) ? "—" : RS.fmtPct(v);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Labor &amp; Crew</h1>
        <p>Crew productivity &amp; labor cost · <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· hours = foreman hours · helper cost joined from helper salaries via Unique Key</span></p>
      </div>
      <div class="rs-kpis" id="laKpis"></div>
      <div id="laMain"></div>
      <div class="rs-grid2" id="laGrid"></div>`;

    // ---- empty state
    if (!rows.length) {
      document.getElementById("laMain").innerHTML =
        `<div class="panel" style="padding:18px 16px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    // ---- KPI strip (filter scope)
    const kRev = M["Revenue"].fn(rows);
    const kHrs = M["Hours Worked by Forman"].fn(rows);
    const kRph = kHrs ? kRev / kHrs : null;
    const kHelp = helperCost(rows);
    const kHelpPct = (kHelp != null && kRev) ? kHelp / kRev : null;
    const kCrew = rows.length
      ? rows.reduce((a, r) => a + RS.num(r["Crew Size"]), 0) / rows.length : null;
    const kTips = M["Total Tips"].fn(rows);
    RSC.kpis(document.getElementById("laKpis"), [
      { label: "Revenue per Foreman Hour", value: nzMoney(kRph),
        sub: RS.moneyC(kRev) + " revenue ÷ " + RS.fmtN(kHrs) + " foreman hours" },
      { label: "Hours Worked", value: RS.fmtN(kHrs), sub: "foreman hours" },
      { label: "Helper Cost", value: kHelp == null ? "—" : RS.moneyC(kHelp),
        sub: kHelp == null ? "helper salaries unavailable" : RS.money(kHelp) + " · helper salaries in scope" },
      { label: "Helper Cost % of Revenue", value: nzPct(kHelpPct),
        sub: kHelpPct == null ? "needs helper salaries" : "helper salaries ÷ revenue" },
      { label: "Avg Crew Size", value: RS.fmt1(kCrew), sub: "crew members / job (incl. foreman)" },
      { label: "Tips", value: RS.moneyC(kTips), sub: RS.money(kTips) + " · customer + company tips" },
    ]);

    // ---- monthly aggregates (last 24 months of the filtered scope)
    const byMonth = {};
    rows.forEach(r => {
      const k = r._y + "-" + String(r._m).padStart(2, "0");
      (byMonth[k] = byMonth[k] || []).push(r);
    });
    const allKeys = Object.keys(byMonth).sort();
    const disp = RS.displayMonth(allKeys);
    const partialKey = (disp.partial || disp.steppedBack) ? allKeys[allKeys.length - 1] : null;
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const monthly = allKeys.slice(-24).map(k => {
      const rs = byMonth[k];
      const rev = M["Revenue"].fn(rs), hrs = M["Hours Worked by Forman"].fn(rs);
      const help = helperCost(rs);
      return { k, rev, hrs, rph: hrs ? rev / hrs : null, help,
        hpct: (help != null && rev) ? help / rev : null };
    });
    const partialNote = partialKey && monthly.some(x => x.k === partialKey)
      ? `<p style="margin:6px 2px 0;font-size:12px;color:var(--muted)">• ${mLabel(partialKey)} is a partial month — ratios reflect only the days loaded so far.</p>`
      : "";

    // ---- main card: revenue/hour bars + hours line, by month
    RSC.chartCard(document.getElementById("laMain"), {
      title: "Revenue per hour by month",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">last ${monthly.length} months${partialKey ? " · • = partial month" : ""}</span>`,
      buildChart(canvas) {
        return new Chart(canvas, {
          data: {
            labels: monthly.map(x => mLabel(x.k) + (x.k === partialKey ? " •" : "")),
            datasets: [
              { type: "bar", label: "Revenue / hour",
                data: monthly.map(x => x.rph == null ? null : +x.rph.toFixed(1)),
                backgroundColor: "#b7e23b", borderRadius: 4, yAxisID: "y", order: 2 },
              { type: "line", label: "Hours worked",
                data: monthly.map(x => Math.round(x.hrs)),
                borderColor: "#5b8cff", backgroundColor: "#5b8cff",
                borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => c.dataset.yAxisID === "y"
                ? `Revenue / hour: ${nzMoney(c.raw)}`
                : `Hours: ${RS.fmtN(c.raw)}` } },
            },
            scales: {
              y: { position: "left", title: { display: true, text: "Revenue / hour" },
                ticks: { callback: v => RS.money(v) } },
              y1: { position: "right", title: { display: true, text: "Hours worked" },
                grid: { drawOnChartArea: false }, ticks: { callback: v => RS.fmtN(v) } },
              x: { ticks: { font: { size: 11 }, maxRotation: 60, minRotation: 40 } },
            },
          },
        });
      },
      buildTable() {
        const tRev = monthly.reduce((a, x) => a + (x.rev || 0), 0);
        const tHrs = monthly.reduce((a, x) => a + (x.hrs || 0), 0);
        const tHelp = helperOk ? monthly.reduce((a, x) => a + (x.help || 0), 0) : null;
        return RSC.table(
          [{ key: "m", label: "Month" },
           { key: "rev", label: "Revenue", fmt: nzMoney },
           { key: "hrs", label: "Hours", fmt: nzN },
           { key: "rph", label: "Rev / Hr", fmt: nzMoney },
           { key: "help", label: "Helper Cost", fmt: nzMoney },
           { key: "hpct", label: "Helper %", fmt: nzPct }],
          monthly.map(x => ({ m: mLabel(x.k) + (x.k === partialKey ? " •" : ""),
            rev: x.rev, hrs: x.hrs, rph: x.rph, help: x.help, hpct: x.hpct })),
          { m: `Total (${monthly.length} mo)`, rev: tRev, hrs: tHrs, rph: tHrs ? tRev / tHrs : null,
            help: tHelp, hpct: (tHelp != null && tRev) ? tHelp / tRev : null }) + partialNote;
      },
    });

    const grid = document.getElementById("laGrid");

    // ---- grid (a): revenue/hour by foreman (min-hours threshold to kill ratio noise)
    const MIN_HOURS = 100;
    const foremanStats = (() => {
      const g = {};
      rows.forEach(r => {
        const f = (r.Foreman == null || r.Foreman === "") ? "—" : String(r.Foreman);
        (g[f] = g[f] || []).push(r);
      });
      return Object.entries(g).map(([f, rs]) => {
        const hrs = M["Hours Worked by Forman"].fn(rs), rev = M["Revenue"].fn(rs);
        return { f, rs, jobs: rs.length, hrs, rev,
          rph: hrs ? rev / hrs : null, help: helperCost(rs) };
      });
    })();
    const qualified = foremanStats.filter(x => x.hrs >= MIN_HOURS)
      .sort((a, b) => (b.rph || 0) - (a.rph || 0));
    const below = foremanStats.filter(x => x.hrs < MIN_HOURS);

    RSC.chartCard(grid, {
      title: "By foreman",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">top 20 · min ${MIN_HOURS} hours</span>`,
      buildChart(canvas) {
        const list = qualified.slice(0, 20);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.f),
            datasets: [{ label: "Revenue / hour",
              data: list.map(x => x.rph == null ? 0 : +x.rph.toFixed(1)),
              backgroundColor: "#b7e23b", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => {
                const x = list[c.dataIndex];
                return [`Revenue / hour: ${nzMoney(c.raw)}`,
                  `Hours: ${RS.fmtN(x.hrs)} · Revenue: ${RS.moneyC(x.rev)}`];
              } } } },
            scales: {
              x: { ticks: { callback: v => RS.money(v) } },
              y: { ticks: { font: { size: 11 },
                callback(v) { const l = this.getLabelForValue(v);
                  return l.length > 16 ? l.slice(0, 15) + "…" : l; } } },
            },
          },
        });
      },
      buildTable() {
        const shown = qualified.slice(0, 40);
        const data = shown.map(x => ({ f: x.f, jobs: x.jobs, hrs: x.hrs,
          rev: x.rev, rph: x.rph, help: x.help }));
        if (below.length) {   // under-threshold bucket so the total still ties out
          const rs = below.flatMap(x => x.rs);
          const hrs = M["Hours Worked by Forman"].fn(rs), rev = M["Revenue"].fn(rs);
          data.push({ f: `Under ${MIN_HOURS} hours (${below.length})`, jobs: rs.length,
            hrs, rev, rph: hrs ? rev / hrs : null, help: helperCost(rs) });
        }
        return RSC.table(
          [{ key: "f", label: "Foreman" },
           { key: "jobs", label: "Jobs", fmt: nzN },
           { key: "hrs", label: "Hours", fmt: nzN },
           { key: "rev", label: "Revenue", fmt: nzMoney },
           { key: "rph", label: "Rev / Hr", fmt: nzMoney },
           { key: "help", label: "Helper Cost", fmt: nzMoney }],
          data,
          { f: "Total", jobs: rows.length, hrs: kHrs, rev: kRev, rph: kRph, help: kHelp }) +
          `<p style="margin:6px 2px 0;font-size:12px;color:var(--muted)">Ranked by Rev / Hr among foremen with ≥ ${MIN_HOURS} hours` +
          (qualified.length > shown.length
            ? ` — showing top ${shown.length} of ${RS.fmtN(qualified.length)} qualifying`
            : "") +
          (below.length ? `; foremen below the threshold are aggregated in "Under ${MIN_HOURS} hours"` : "") +
          `.</p>`;
      },
    });

    // ---- grid (b): crew size economics — the "right-size the crew" view.
    // Crew Size is the PBI calc column on closing (count of non-blank crew roles,
    // foreman included); blanks/zeroes bucket as "—".
    const crewPanel = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Crew size economics</span>
         <span class="rs-ctl"><span class="lbl">crew = foreman + helpers per job</span></span>
         <span class="spacer"></span></div>
       <div class="tabwrap" id="laCrew"></div>`);
    grid.appendChild(crewPanel);
    {
      const g = {};
      rows.forEach(r => {
        const c = Math.round(RS.num(r["Crew Size"]));
        const k = c > 0 ? String(c) : "—";
        (g[k] = g[k] || []).push(r);
      });
      const entries = Object.entries(g)
        .sort((a, b) => (a[0] === "—" ? 1 : b[0] === "—" ? -1 : (+a[0]) - (+b[0])))
        .map(([k, rs]) => {
          const rev = M["Revenue"].fn(rs), hrs = M["Hours Worked by Forman"].fn(rs);
          const help = helperCost(rs), pack = M["Total Packing Written"].fn(rs);
          return { crew: k === "—" ? "—" : k + " crew", jobs: rs.length,
            sh: rows.length ? rs.length / rows.length : null,
            avg: rs.length ? rev / rs.length : null,
            rph: hrs ? rev / hrs : null,
            pack: rs.length ? pack / rs.length : null,
            helpJob: (help != null && rs.length) ? help / rs.length : null };
        });
      const totPack = M["Total Packing Written"].fn(rows);
      document.getElementById("laCrew").innerHTML = RSC.table(
        [{ key: "crew", label: "Crew Size" },
         { key: "jobs", label: "Jobs", fmt: nzN },
         { key: "sh", label: "% of Jobs", fmt: nzPct },
         { key: "avg", label: "Avg Bill", fmt: nzMoney },
         { key: "rph", label: "Rev / Hr", fmt: nzMoney },
         { key: "pack", label: "Packing / Job", fmt: nzMoney },
         { key: "helpJob", label: "Helper Cost / Job", fmt: nzMoney }],
        entries,
        { crew: "Total", jobs: rows.length, sh: rows.length ? 1 : null,
          avg: rows.length ? kRev / rows.length : null, rph: kRph,
          pack: rows.length ? totPack / rows.length : null,
          helpJob: (kHelp != null && rows.length) ? kHelp / rows.length : null }) +
        `<p style="margin:6px 2px 0;font-size:12px;color:var(--muted)">Avg Bill here = revenue ÷ jobs (includes linked-trip extras); helper cost joined via Unique Key.</p>`;
    }
  },
});
