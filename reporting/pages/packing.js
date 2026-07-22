/* GO page: Packing — packing revenue & estimate-vs-actual (PBI GO-10).
   Actuals = closing "Material Total" (registry 'Total Packing Written' — the
   customer-facing packing revenue, audit F9/D1a). "Material $" is the foreman's
   packing COMMISSION (registry 'Forman Salary - Packing') and is shown as its own
   KPI/column, never as revenue. Estimates come from the foreman scorecard mart
   (Total Packing Estimate). The PBI pivot (Forman Full Name × End of Month:
   Total Jobs / Total Packing Estimate / Total Packing Written / Packing
   Difference %) is reproduced compactly: monthly actual-vs-estimate combo +
   a By-Foreman written-vs-estimate card with colored diff %. */
registerPage({
  id: "packing",
  group: "ops",
  title: "Packing",
  async render(host) {
    const [closingAll, scorecardAll] = await Promise.all([RS.load("closing"), RS.load("scorecard")]);
    const rows = RS.filtered("closing", closingAll);
    const sc = RS.filtered("scorecard", scorecardAll);   // scorecard has its own Month date
    const M = RS.M;

    // ---- page-level totals (closing money columns can be '$ 1,234' varchar — registry
    //      measures + RS.num handle the parsing everywhere below)
    const writtenTotal = M["Total Packing Written"].fn(rows); // PBI: Total Packing Written (Material Total)
    const payTotal = M["Forman Salary - Packing"].fn(rows);   // foreman packing COMMISSION (Material $)
    const jobsTotal = M["Total Jobs"].fn(rows);
    const billTotal = M["Total Bill"].fn(rows);
    const estTotal = sc.reduce((a, r) => a + RS.num(r["Total Packing Estimate"]), 0); // PBI: Total Packing Estimate
    // Portal convention: signed delta-% ((written − estimate) / estimate). PBI's
    // 'Packing Difference %' renders the same comparison as a written/estimate RATIO
    // (≈2.05× at page level, sentinel 2.5 when no estimate) — footnoted on the KPI.
    const diffTotal = estTotal ? (writtenTotal - estTotal) / estTotal : null;

    // signed colored percent — green when actual beats estimate / grows
    const fmtDiff = v => (v == null || isNaN(v)) ? "—"
      : `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${(100 * v).toFixed(1)}%</span>`;
    // signed colored percentage-POINT delta (for share-of-revenue movement)
    const fmtPP = v => (v == null || isNaN(v)) ? "—"
      : `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "+" : ""}${(100 * v).toFixed(1)} pp</span>`;
    // null-safe money for table cells
    const mny = v => (v == null || isNaN(v)) ? "—" : RS.money(v);
    // friendly empty state for a card's tabular view when there are no data rows
    const emptyMsg = "No rows for the current filters — widen the date range or clear a slicer.";
    const tableOr = (data, build) => data.length
      ? build()
      : `<p style="padding:12px 14px;color:var(--muted)">${emptyMsg}</p>`;

    // ---- headline YoY: Jan-1 → (max filtered _d) this year vs the same window last
    //      year, on the date-UNfiltered dataset (non-date slicers still applied)
    const maxD = rows.reduce((a, r) => (r._d && r._d > a) ? r._d : a, "");
    const yoyChip = (allRows, ds, fn) => {
      if (!maxD) return "";
      const y = +maxD.slice(0, 4), st = RS.state;
      const save = [st.dateFrom, st.dateTo, st.dayFrom, st.dayTo];
      st.dateFrom = st.dateTo = st.dayFrom = st.dayTo = null;
      const all = RS.filtered(ds, allRows);
      [st.dateFrom, st.dateTo, st.dayFrom, st.dayTo] = save;
      const cur = fn(all.filter(r => r._d >= y + "-01-01" && r._d <= maxD));
      const prev = fn(all.filter(r => r._d >= (y - 1) + "-01-01" && r._d <= (y - 1) + maxD.slice(4)));
      if (!prev) return "";
      const g = (cur - prev) / Math.abs(prev);
      return ` · <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}%</span> vs same period LY`;
    };

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Packing</h1>
        <p>Packing revenue vs foreman estimates · <b>${RS.fmtN(jobsTotal)}</b> jobs ·
           <b>${RS.fmtN(sc.length)}</b> foreman-months in scope
           <span class="freshness">· estimates entered by foremen each month</span></p>
      </div>
      <div class="rs-kpis" id="pckKpis"></div>
      <div id="pckMain"></div>
      <div class="rs-grid2" id="pckGrid"></div>`;

    RSC.kpis(document.getElementById("pckKpis"), [
      { label: "Packing Written", value: RS.moneyC(writtenTotal), sub: RS.money(writtenTotal) + " packing charged to customers" },
      // foreman packing COMMISSION (Material $, 20/26% of Material Total) — PBI: Forman Salary - Packing
      { label: "Foreman Packing Pay", value: RS.moneyC(payTotal), sub: RS.money(payTotal) + " commission (Material $)" },
      // portal addition — Total Packing Written / Total Jobs (no direct PBI measure)
      { label: "Packing per Job", value: jobsTotal ? RS.moneyC(writtenTotal / jobsTotal) : "—", sub: "written / job in scope" },
      { label: "Total Packing Estimate", value: RS.moneyC(estTotal), sub: RS.money(estTotal) + " estimates entered by foremen" },
      // PBI 'Packing Difference %' (a written/estimate ratio) is shown everywhere as the
      // signed delta convention: (written − estimate) / estimate — see packing-analysis.js
      { label: "Written vs Estimate", value: fmtDiff(diffTotal),
        sub: "how far actual packing landed over or under the foremen's estimate" },
      // portal addition — share-of-total column family (Material Total / Revenue)
      { label: "Packing Share of Revenue", value: RS.fmtPct(billTotal ? writtenTotal / billTotal : null), sub: "packing $ ÷ revenue" },
    ]);
    // RSC.kpis escapes subs — patch the two headline subs in place to inject YoY chips
    const writtenChip = yoyChip(closingAll, "closing", rs => M["Total Packing Written"].fn(rs));
    const estChip = yoyChip(scorecardAll, "scorecard",
      rs => rs.reduce((a, r) => a + RS.num(r["Total Packing Estimate"]), 0));
    const kpiSubs = document.querySelectorAll("#pckKpis .kpi .s");
    if (writtenChip && kpiSubs[0]) kpiSubs[0].innerHTML = RSC.esc(RS.money(writtenTotal) + " packing charged to customers") + writtenChip;
    if (estChip && kpiSubs[3]) kpiSubs[3].innerHTML = RSC.esc(RS.money(estTotal) + " estimates entered by foremen") + estChip;

    // ---- empty state: no closing rows AND no scorecard rows in scope → skip charts
    if (!rows.length && !sc.length) {
      document.getElementById("pckMain").innerHTML =
        `<div class="panel"><div class="panel-head"><span class="panel-title">Packing written by month</span></div>
           <p style="padding:0 14px 14px;color:var(--muted)">No data for the current filters — widen the date range or clear a slicer.</p></div>`;
      return;
    }

    // ---- month buckets: closing rows (sold/bill/jobs) + scorecard estimate sums
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const closByM = {};
    rows.forEach(r => { const k = mk(r); (closByM[k] = closByM[k] || []).push(r); });
    const estByM = {};
    sc.forEach(r => { const k = mk(r); estByM[k] = (estByM[k] || 0) + RS.num(r["Total Packing Estimate"]); });
    const months = [...new Set([...Object.keys(closByM), ...Object.keys(estByM)])].sort();
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);

    // ---- main card: packing written by month (bars) vs scorecard estimate (line)
    RSC.chartCard(document.getElementById("pckMain"), {
      title: "Packing written by month — actual vs estimate",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">bars: packing charged to customers · line: foreman estimate · last 24 mo</span>`,
      buildChart(canvas) {
        const shown = months.slice(-24);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: shown.map(mLabel),
            datasets: [
              { label: "Packing Written", order: 2,
                data: shown.map(k => Math.round(closByM[k] ? M["Total Packing Written"].fn(closByM[k]) : 0)),
                backgroundColor: "#b7e23b", borderRadius: 4 },
              { type: "line", label: "Total Packing Estimate", order: 1,
                data: shown.map(k => Math.round(estByM[k] || 0)),
                borderColor: "#fbbf24", backgroundColor: "#fbbf24",
                borderWidth: 2, pointRadius: 2.5, tension: .3 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.money(c.raw)}` } },
            },
            scales: {
              y: { ticks: { callback: v => "$" + (v / 1000) + "k" } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        let prev = null;
        // row key `sold` carries Total Packing Written (Material Total) since F9/D1a
        const data = months.map(k => {
          const cl = closByM[k] || [];
          const sold = M["Total Packing Written"].fn(cl);
          const bill = M["Total Bill"].fn(cl);
          const est = estByM[k] || 0;
          const row = {
            m: mLabel(k), jobs: M["Total Jobs"].fn(cl), sold,
            mom: (prev != null && prev !== 0) ? (sold - prev) / Math.abs(prev) : null, // portal addition: MoM delta
            pay: M["Forman Salary - Packing"].fn(cl),    // foreman commission (Material $)
            est,
            diff: est ? (sold - est) / est : null,       // PBI: Packing Difference % (delta-% convention)
            sh: bill ? sold / bill : null,               // portal addition: share of bill
          };
          prev = sold;
          return row;
        });
        return tableOr(data, () => RSC.table(
          [{ key: "m", label: "Month" }, { key: "jobs", label: "Total Jobs", fmt: RS.fmtN },
           { key: "sold", label: "Packing Written", fmt: mny },
           { key: "mom", label: "MoM", fmt: fmtDiff },
           { key: "pay", label: "Foreman Packing Pay (commission)", fmt: mny },
           { key: "est", label: "Packing Estimate", fmt: mny },
           { key: "diff", label: "Written vs Estimate", fmt: fmtDiff },
           { key: "sh", label: "Share of Revenue", fmt: RS.fmtPct }],
          data,
          { m: "Total", jobs: jobsTotal, sold: writtenTotal, mom: null, pay: payTotal,
            est: estTotal, diff: diffTotal, sh: billTotal ? writtenTotal / billTotal : null }));
      },
    });

    // ---- foreman merge: written (closing, by Foreman) × estimate (scorecard, by Foreman)
    const soldByF = {};                                // closing rows per foreman (key name is historical)
    rows.forEach(r => {
      const f = (r.Foreman == null || r.Foreman === "") ? "—" : String(r.Foreman);
      (soldByF[f] = soldByF[f] || []).push(r);
    });
    const estByF = {};
    sc.forEach(r => {
      const f = (r.Foreman == null || r.Foreman === "") ? "—" : String(r.Foreman);
      estByF[f] = (estByF[f] || 0) + RS.num(r["Total Packing Estimate"]);
    });
    const fList = [...new Set([...Object.keys(soldByF), ...Object.keys(estByF)])].map(f => {
      const cl = soldByF[f] || [];
      const sold = M["Total Packing Written"].fn(cl);  // key `sold` = Packing Written (F9/D1a)
      const est = estByF[f] || 0;
      return { f, jobs: cl.length, sold, est,
        diff: est ? (sold - est) / est : null };       // PBI: Packing Difference % per foreman (delta-%)
    }).sort((a, b) => (b.sold || 0) - (a.sold || 0));

    const grid = document.getElementById("pckGrid");

    // ---- grid2 (a): by foreman — written vs estimate grouped bars, top 15
    RSC.chartCard(grid, {
      title: "By foreman — written vs estimate",
      controlsHtml: `<span class="lbl">top 15 of ${RS.fmtN(fList.length)} by packing written</span>`,
      buildChart(canvas) {
        const top = fList.slice(0, 15);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: top.map(x => x.f),
            datasets: [
              { label: "Packing Written", data: top.map(x => Math.round(x.sold || 0)),
                backgroundColor: "#b7e23b", borderRadius: 4 },
              { label: "Packing Estimate", data: top.map(x => Math.round(x.est || 0)),
                backgroundColor: "#5b8cff", borderRadius: 4 },
            ],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.money(c.raw)}` } },
            },
            scales: {
              x: { ticks: { callback: v => "$" + (v / 1000) + "k" } },
              y: { ticks: { font: { size: 11 } } },
            },
          },
        });
      },
      buildTable() {
        const top = fList.slice(0, 15), rest = fList.slice(15);
        const data = top.map((x, i) => ({
          rk: i + 1, f: x.f, jobs: x.jobs, sold: x.sold, est: x.est, diff: x.diff,
          sh: writtenTotal ? (x.sold || 0) / writtenTotal : null,   // portal addition: share of written
        }));
        if (rest.length) {                                    // "everything else" bucket
          const s = rest.reduce((a, x) => a + (x.sold || 0), 0);
          const e = rest.reduce((a, x) => a + (x.est || 0), 0);
          data.push({ rk: null, f: `All others (${rest.length})`,
            jobs: rest.reduce((a, x) => a + x.jobs, 0), sold: s, est: e,
            diff: e ? (s - e) / e : null, sh: writtenTotal ? s / writtenTotal : null });
        }
        return tableOr(data, () => RSC.table(
          [{ key: "rk", label: "#", fmt: v => v == null ? "" : RS.fmtN(v) },
           { key: "f", label: "Foreman" },
           { key: "jobs", label: "Jobs", fmt: RS.fmtN },
           { key: "sold", label: "Packing Written", fmt: mny },
           { key: "est", label: "Estimate", fmt: mny },
           { key: "diff", label: "Written vs Estimate", fmt: fmtDiff },
           { key: "sh", label: "% of Written", fmt: RS.fmtPct }],
          data,
          { f: "Total", jobs: jobsTotal, sold: writtenTotal, est: estTotal,
            diff: diffTotal, sh: writtenTotal ? 1 : null }));
      },
    });

    // ---- grid2 (b): packing share of revenue — monthly Material Total / Revenue %
    RSC.chartCard(grid, {
      title: "Packing share of revenue",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">packing $ ÷ revenue · last 24 mo</span>`,
      buildChart(canvas) {
        const shown = months.filter(k => closByM[k]).slice(-24);
        return new Chart(canvas, {
          type: "line",
          data: {
            labels: shown.map(mLabel),
            datasets: [{
              label: "Packing share of revenue",
              data: shown.map(k => {
                const cl = closByM[k], b = M["Total Bill"].fn(cl);
                return b ? +(100 * M["Total Packing Written"].fn(cl) / b).toFixed(2) : null;
              }),
              borderColor: "#a78bfa", backgroundColor: "rgba(167,139,250,.15)",
              borderWidth: 2, pointRadius: 2.5, tension: .3, fill: true,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: c => `Share of revenue: ${c.raw == null ? "—" : c.raw.toFixed(1) + "%"}` } },
            },
            scales: {
              y: { ticks: { callback: v => v + "%" } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        let prevSh = null;
        const data = months.filter(k => closByM[k]).map(k => {
          const cl = closByM[k];
          const sold = M["Total Packing Written"].fn(cl), bill = M["Total Bill"].fn(cl);
          // Revenue split: closings (Total Revenue) + appended trips (Additional Revenue from Trips)
          const closRev = M["Total Revenue"].fn(cl), tripRev = M["Additional Revenue from Trips"].fn(cl);
          const sh = bill ? sold / bill : null;
          const row = { m: mLabel(k), sold, closRev, tripRev, bill, sh,
            d: (sh != null && prevSh != null) ? sh - prevSh : null };  // portal addition: pp delta
          if (sh != null) prevSh = sh;
          return row;
        });
        return tableOr(data, () => RSC.table(
          [{ key: "m", label: "Month" },
           { key: "sold", label: "Packing Written", fmt: mny },
           { key: "closRev", label: "Total Revenue", fmt: mny },
           { key: "tripRev", label: "Trip Revenue", fmt: mny },
           { key: "bill", label: "Revenue", fmt: mny },
           { key: "sh", label: "Share of Revenue", fmt: RS.fmtPct },
           { key: "d", label: "vs prev mo", fmt: fmtPP }],
          data,
          { m: "Total", sold: writtenTotal,
            closRev: M["Total Revenue"].fn(rows), tripRev: M["Additional Revenue from Trips"].fn(rows),
            bill: billTotal,
            sh: billTotal ? writtenTotal / billTotal : null, d: null }));
      },
    });
  },
});
