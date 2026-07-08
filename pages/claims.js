/* GO page: Claims — claims registry: volume by month, responsibility split,
   reason breakdown, refund impact. PBI source: General Overview "Claims"
   (05-dashboards.md GO-12: two side-by-side detail tables split on
   'Number of Claims Written Because of Forman' — reproduced compactly as a
   responsibility doughnut + a foreman-fault filter on the recent-claims panel). */
registerPage({
  id: "claims",
  group: "ops",
  title: "Claims",
  async render(host) {
    const [claimsAll, scorecardAll, rollupAll, closingAll] = await Promise.all([
      RS.load("claims"), RS.load("scorecard"), RS.load("rollup"), RS.load("closing")]);
    const rows = RS.filtered("claims", claimsAll);
    const scRows = RS.filtered("scorecard", scorecardAll);
    const closingRows = RS.filtered("closing", closingAll);
    const M = RS.M;

    /* Empty state — bail out before any joins/charts if the filters left nothing. */
    if (!rows.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Claims</h1>
          <p>Claims registry with responsibility split and refund impact</p>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">No data for the current filters</span></div>
          <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">
            No claims match the current slicer / date selection. Widen the date range or clear a filter to bring data back.</div>
        </div>`;
      return;
    }

    /* F5 belt-and-braces: 'Request Joinkey' casing differs across warehouse tables
       ('Zip To Zip' in fct_claims vs 'Zip to Zip' in rollup/closing) until the
       curated rebuild lands. Normalize keys with jkey() at BOTH build and probe
       sites so every join works before AND after the rebuild. */
    const jkey = v => (v == null ? v : String(v).toLowerCase());

    /* N1 display map: the registry writes 'Forman' in Responsibility values
       ('Forman + Sales Fault', …) — show 'Foreman' everywhere users read it.
       Raw values stay untouched for grouping/joins. */
    const dispResp = v => String(v).replace(/\bForman\b/gi, "Foreman");

    /* rollup_support has NO date column — never RS.filtered. Time-slice it via
       membership joins: request keys from the FILTERED claims / closing rows. */
    const claimKeys = new Set(rows.map(r => r["Request Joinkey"]).filter(Boolean).map(jkey));
    const closingKeys = new Set(closingRows.map(r => r["Request Joinkey"]).filter(Boolean).map(jkey));
    const rollupByKey = new Map();
    rollupAll.forEach(r => {
      const k = jkey(r["Request Joinkey"]);
      if (k && !rollupByKey.has(k)) rollupByKey.set(k, r);
    });
    const refundOf = k => { const ru = rollupByKey.get(jkey(k)); return ru ? RS.num(ru["Amount Refunded"]) : 0; };

    // PBI 'Amount Refunded' — rollup summed over the filtered closing request set.
    let amtRefunded = 0, amtRefundedNR = 0;
    rollupAll.forEach(r => {
      if (!closingKeys.has(jkey(r["Request Joinkey"]))) return;
      amtRefunded += RS.num(r["Amount Refunded"]);
      // PBI 'Amount Refunded Because of Negative Reviews'
      amtRefundedNR += RS.num(r["Amount Refunded Because of Negative Reviews"]);
    });
    // Claim requests that ended in money out — rollup joined via the claim request set.
    let refundedClaimReqs = 0;
    rollupAll.forEach(r => {
      if (claimKeys.has(jkey(r["Request Joinkey"])) && RS.num(r["Amount Refunded"]) > 0) refundedClaimReqs++;
    });

    const nClaims = M["Number of Claims"].fn(rows);
    const totalJobs = M["Total Jobs"].fn(closingRows);
    // Scorecard 'Forman Fault Claims' — feeds the PBI filter measure
    // 'Number of Claims Written Because of Forman' (GO-12 left table).
    const foremanFault = scRows.reduce((a, r) => a + RS.num(r["Forman Fault Claims"]), 0);

    /* Headline YoY chips: YTD window (Jan-1 → max date of the filtered rows) vs the
       same window last year, evaluated on the date-UNfiltered dataset (year/month
       slicers lifted too, or the prior-year window would filter itself away). */
    const yoyChip = (ds, allRows, scopedRows, valFn, invert) => {
      const maxD = scopedRows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (!maxD) return "";
      const winVal = (from, to) => {
        const s = RS.state;
        const save = { f: s.dateFrom, t: s.dateTo, y: s.multi.year, m: s.multi.month };
        s.dateFrom = from; s.dateTo = to; s.multi.year = null; s.multi.month = null;
        const v = valFn(RS.filtered(ds, allRows));
        s.dateFrom = save.f; s.dateTo = save.t; s.multi.year = save.y; s.multi.month = save.m;
        return v;
      };
      const y = +maxD.slice(0, 4);
      const cur = winVal(y + "-01-01", maxD);
      const prev = winVal((y - 1) + "-01-01", (y - 1) + maxD.slice(4));
      if (!prev || cur == null) return "";
      const g = (cur - prev) / Math.abs(prev);
      const good = invert ? g <= 0 : g >= 0;   // fewer claims / smaller refunds = good
      return `<span class="${good ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(g)).toFixed(1)}%</span>`;
    };
    const claimsChip = yoyChip("claims", claimsAll, rows, rs => rs.length, true);
    const refundOverClosing = crows => {   // same join as amtRefunded, over any closing window
      const keys = new Set(crows.map(r => r["Request Joinkey"]).filter(Boolean).map(jkey));
      return rollupAll.reduce((a, r) =>
        a + (keys.has(jkey(r["Request Joinkey"])) ? RS.num(r["Amount Refunded"]) : 0), 0);
    };
    const refundChip = yoyChip("closing", closingAll, closingRows, refundOverClosing, true);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Claims</h1>
        <p>Claims registry with responsibility split and refund impact ·
           <b>${RS.fmtN(nClaims)}</b> claims in scope
           <span class="freshness">· refund amounts come from the Support sheet, matched by request number</span></p>
      </div>
      <div class="rs-kpis" id="clmKpis"></div>
      <div id="clmMain"></div>
      <div class="rs-grid2" id="clmSubs"></div>
      <div id="clmRecent"></div>`;

    RSC.kpis(document.getElementById("clmKpis"), [
      { label: "Number of Claims", value: RS.fmtN(nClaims), sub: "claims in scope" },
      { label: "Foreman Fault Claims", value: RS.fmtN(foremanFault),
        sub: "counts the monthly scorecard; the chart classifies each claim by its Responsibility field — they can differ slightly" },
      { label: "Requests w/ Refunds", value: RS.fmtN(refundedClaimReqs),
        sub: `${RS.fmtPct(claimKeys.size ? refundedClaimReqs / claimKeys.size : null)} of ${RS.fmtN(claimKeys.size)} claim requests` },
      { label: "Refunded on Claimed Requests", value: RS.moneyC(amtRefunded),
        sub: `${RS.money(amtRefunded)} · from the Support sheet, jobs in scope` },
      { label: "Refunded for Neg. Reviews", value: RS.moneyC(amtRefundedNR),
        sub: `${RS.money(amtRefundedNR)} · ${RS.fmtPct(amtRefunded ? amtRefundedNR / amtRefunded : null)} of refunded` },
      // portal-added density metric (no PBI counterpart)
      { label: "Claims per 100 Jobs", value: RS.fmt1(totalJobs ? 100 * nClaims / totalJobs : null),
        sub: `claims by claim date vs ${RS.fmtN(totalJobs)} jobs by move date` },
    ]);
    /* RSC.kpis escapes subs — inject the YoY chips (HTML) after render. */
    const kpiSubs = document.querySelectorAll("#clmKpis .kpi .s");
    if (claimsChip) kpiSubs[0].innerHTML = claimsChip + " vs same period LY";
    if (refundChip) kpiSubs[3].innerHTML =
      RSC.esc(RS.money(amtRefunded)) + " · Support sheet · " + refundChip + " vs LY";

    /* ---------------- month buckets ---------------- */
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const clByMonth = RS.groupBy(rows, "_month", "Number of Claims");   // asc by month key
    const jobsByMonth = {};
    closingRows.forEach(r => { const k = mk(r); jobsByMonth[k] = (jobsByMonth[k] || 0) + 1; });
    const ffByMonth = {};
    scRows.forEach(r => { const k = mk(r); ffByMonth[k] = (ffByMonth[k] || 0) + RS.num(r["Forman Fault Claims"]); });

    /* ---------------- main: claims by month ---------------- */
    RSC.chartCard(document.getElementById("clmMain"), {
      title: "Claims by month",
      // Caption describes the chart only; the tabular view has its own fixed
      // columns, so hide it there (dead in Tabular).
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">bars: claims · line: foreman fault (monthly scorecard) · last 24 mo</span>`,
      buildChart(canvas) {
        const shown = clByMonth.slice(-24);
        return new Chart(canvas, {
          data: {
            labels: shown.map(x => mLabel(x.k)),
            datasets: [
              { type: "bar", label: "Number of Claims", data: shown.map(x => x.v),
                backgroundColor: "#fbbf24", borderRadius: 4, order: 2 },
              { type: "line", label: "Foreman Fault Claims", data: shown.map(x => ffByMonth[x.k] || 0),
                borderColor: "#f87171", backgroundColor: "#f87171",
                borderWidth: 2, pointRadius: 2, tension: .3, order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.fmtN(c.raw)}` } },
            },
            scales: {
              y: { beginAtZero: true, ticks: { precision: 0 } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        // more claims = worse, so an increase paints red (.down) and a drop green (.up).
        // rs.css colors span.up/.down globally; inline colors kept as a belt-and-braces
        // fallback (same pattern as callrail.js) in case the CSS scoping changes.
        const delta = d => d == null ? "—"
          : d === 0 ? "±0"
          : d > 0 ? `<span class="down" style="color:var(--red)">+${RS.fmtN(d)}</span>`
                  : `<span class="up" style="color:var(--brand)">-${RS.fmtN(-d)}</span>`;
        const data = clByMonth.map((x, i) => {
          const jobs = jobsByMonth[x.k] || 0;
          return {
            m: mLabel(x.k), c: x.v,
            d: delta(i ? x.v - clByMonth[i - 1].v : null),
            sh: nClaims ? x.v / nClaims : null,
            ff: ffByMonth[x.k] || 0,
            jobs, per100: jobs ? 100 * x.v / jobs : null,
          };
        });
        return RSC.table(
          [{ key: "m", label: "Month" }, { key: "c", label: "Claims", fmt: RS.fmtN },
           { key: "d", label: "Change vs prev mo", fmt: v => v },
           { key: "sh", label: "% of claims", fmt: RS.fmtPct },
           { key: "ff", label: "Foreman Fault", fmt: RS.fmtN },
           { key: "jobs", label: "Total Jobs", fmt: RS.fmtN },
           { key: "per100", label: "Claims / 100 Jobs", fmt: RS.fmt1 }],
          data,
          { m: "Total", c: nClaims, sh: nClaims ? 1 : null, ff: foremanFault,
            jobs: totalJobs, per100: totalJobs ? 100 * nClaims / totalJobs : null });
      },
    });

    /* ---------------- responsibility groups (normalized for display) ----------------
       The registry carries two spellings of 'Forman + Sales Fault' (Forman/Foreman,
       casing). Grouped on a normalized key for DISPLAY; the table tooltip notes how
       many source spellings were combined (raw text itself is never shown to users —
       it contains the 'Forman' misspelling). */
    const respGroups = (() => {
      const g = new Map();
      rows.forEach(r => {
        const raw = String(r.Responsibility || "").trim() || "—";
        const key = raw.toLowerCase().replace(/\s+/g, " ").replace(/foreman/g, "forman");
        let e = g.get(key);
        if (!e) g.set(key, e = { key, rows: [], raws: new Map() });
        e.rows.push(r);
        e.raws.set(raw, (e.raws.get(raw) || 0) + 1);
      });
      const out = [...g.values()].map(e => {
        let disp = "—", best = -1;
        e.raws.forEach((n, raw) => { if (n > best) { best = n; disp = raw; } });
        const reqs = [...new Set(e.rows.map(r => r["Request Joinkey"]).filter(Boolean).map(jkey))];
        return { key: e.key, k: dispResp(disp), raws: [...e.raws.keys()], n: e.rows.length,
                 refunded: reqs.reduce((a, k) => a + refundOf(k), 0),
                 isForeman: e.key.indexOf("forman") >= 0 };
      });
      out.sort((a, b) => b.n - a.n);
      return out;
    })();
    const PAL = ["#b7e23b", "#5b8cff", "#a78bfa", "#fbbf24", "#f87171",
                 "#38b2ac", "#c05299", "#6b7a88", "#8a9a5b", "#4a5568"];

    const subs = document.getElementById("clmSubs");
    RSC.chartCard(subs, {
      title: "By responsibility",
      buildChart(canvas) {
        let list = respGroups;
        if (list.length > 9) {
          const rest = list.slice(9);
          list = list.slice(0, 9).concat([{ k: `All others (${rest.length})`,
            n: rest.reduce((a, x) => a + x.n, 0) }]);
        }
        return new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ data: list.map(x => x.n),
              backgroundColor: list.map((_, i) => PAL[i % PAL.length]), borderWidth: 1 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "58%",
            plugins: {
              legend: { position: "right", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => {
                const tot = c.dataset.data.reduce((a, b) => a + b, 0);
                return `${c.label}: ${RS.fmtN(c.raw)} claims (${tot ? (100 * c.raw / tot).toFixed(1) : 0}%)`;
              } } },
            },
          },
        });
      },
      buildTable() {
        const refTot = respGroups.reduce((a, x) => a + x.refunded, 0);
        return RSC.table(
          [{ key: "k", label: "Responsibility", fmt: v => v },  // pre-escaped HTML w/ merge-note tooltip
           { key: "n", label: "Claims", fmt: RS.fmtN },
           { key: "sh", label: "% of claims", fmt: RS.fmtPct },
           { key: "ref", label: "Amount Refunded", fmt: RS.money }],
          respGroups.map(x => ({
            k: x.raws.length > 1
              ? `<span title="Combined from ${x.raws.length} source spellings of this value">${RSC.esc(x.k)}</span>`
              : RSC.esc(x.k),
            n: x.n, sh: nClaims ? x.n / nClaims : null, ref: x.refunded,
          })),
          { k: "Total", n: nClaims, sh: nClaims ? 1 : null, ref: refTot });
      },
    });

    /* ---------------- by reason: top-12 bar + everything-else bucket ---------------- */
    const byReason = RS.groupBy(rows, "Reason", "Number of Claims"); // desc by count
    RSC.chartCard(subs, {
      title: "By reason — top 12",
      buildChart(canvas) {
        let list = byReason.slice(0, 12);
        const rest = byReason.slice(12);
        if (rest.length)
          list = list.concat([{ k: `All others (${rest.length})`,
            v: rest.reduce((a, x) => a + (x.v || 0), 0) }]);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ label: "Claims", data: list.map(x => x.v),
              backgroundColor: list.map((x, i) =>
                i < 12 && byReason.length > i ? "#5b8cff" : "#6b7a88"), borderRadius: 4 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: c =>
                `Claims: ${RS.fmtN(c.raw)} (${nClaims ? (100 * c.raw / nClaims).toFixed(1) : 0}%)` } },
            },
            scales: {
              x: { beginAtZero: true, ticks: { precision: 0 } },
              y: { ticks: { font: { size: 11 }, callback(v) {
                const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
                return typeof l === "string" && l.length > 24 ? l.slice(0, 23) + "…" : l;
              } } },
            },
          },
        });
      },
      buildTable() {
        const top = byReason.slice(0, 30), rest = byReason.slice(30);
        const data = top.map((x, i) => ({
          r: i + 1, k: x.k, n: x.v, sh: nClaims ? x.v / nClaims : null }));
        if (rest.length) data.push({
          r: null, k: `All others (${rest.length} reasons)`,
          n: rest.reduce((a, x) => a + (x.v || 0), 0),
          sh: nClaims ? rest.reduce((a, x) => a + (x.v || 0), 0) / nClaims : null });
        return RSC.table(
          [{ key: "r", label: "#", fmt: v => v == null ? "—" : RS.fmtN(v) },
           { key: "k", label: "Reason" },
           { key: "n", label: "Claims", fmt: RS.fmtN },
           { key: "sh", label: "% of claims", fmt: RS.fmtPct }],
          data,
          { k: "Total", n: nClaims, sh: nClaims ? 1 : null });
      },
    });

    /* ---------------- recent claims panel (PBI detail tables, compact) ----------------
       GO-12 splits detail rows on foreman-caused vs not — reproduced as one table
       with a responsibility filter instead of two side-by-side visuals. */
    const recent = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Recent claims</span>
         <span class="rs-ctl"><span class="lbl">Show</span>
           <select id="clmRespF">
             <option value="all">All responsibilities</option>
             <option value="fore">Foreman-fault only</option>
             <option value="other">Non-foreman only</option>
           </select></span>
         <span class="spacer"></span>
         <span class="rs-ctl"><span class="lbl" id="clmRecentN"></span></span></div>
       <div class="tabwrap"></div>`);
    document.getElementById("clmRecent").appendChild(recent);
    const isForemanRow = r => String(r.Responsibility || "")
      .toLowerCase().replace(/foreman/g, "forman").indexOf("forman") >= 0;
    const paintRecent = mode => {
      const pool = mode === "fore" ? rows.filter(isForemanRow)
                 : mode === "other" ? rows.filter(r => !isForemanRow(r))
                 : rows;
      const latest = pool.slice()
        .sort((a, b) => (b._d || "").localeCompare(a._d || "")).slice(0, 40);
      // count label must track the active responsibility filter, not the full page scope
      recent.querySelector("#clmRecentN").textContent =
        `latest ${RS.fmtN(latest.length)} of ${RS.fmtN(pool.length)}`;
      if (!latest.length) {
        recent.querySelector(".tabwrap").innerHTML =
          `<div style="padding:14px;color:var(--muted);font-size:13px">No claims match this responsibility filter.</div>`;
        return;
      }
      recent.querySelector(".tabwrap").innerHTML = RSC.table(
        [{ key: "d", label: "Claim Date" }, { key: "c", label: "Customer" },
         { key: "q", label: "Request No" }, { key: "s", label: "Status" },
         { key: "re", label: "Reason" }, { key: "rp", label: "Responsibility" },
         { key: "amt", label: "Refunded (request)", fmt: v => v == null ? "—" : RS.money(v) }],
        latest.map(r => ({
          d: r._d || "—", c: r.Customer || "—", q: r["Request No"] || "—",
          s: r.Status || "—", re: r.Reason || "—",
          rp: r.Responsibility ? dispResp(r.Responsibility) : "—",
          // request-level rollup amount — repeats if a request carries several claims;
          // "—" = request has no rollup row at all (distinct from a genuine $0 refund)
          amt: rollupByKey.has(jkey(r["Request Joinkey"])) ? refundOf(r["Request Joinkey"]) : null,
        }))) +
        `<div style="color:var(--muted);font-size:12px;padding:6px 2px">How it's counted ·
         Refund shown is for the whole request — it repeats if a request has several claims.
         "—" = no support record; $0 = recorded, nothing refunded.</div>`;
    };
    recent.querySelector("#clmRespF").onchange = e => paintRecent(e.target.value);
    paintRecent("all");
  },
});
