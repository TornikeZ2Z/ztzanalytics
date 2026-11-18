/* GO page: Storage — storage revenue tracking (additional vs included-in-bill).
   PBI source: General Overview "Storage" (05-dashboards.md GO-7). */

/* The "Storage Revenue Included in Total Bill" measure (PBI: SUM over the closing
   sheet's raw Storage column) needs "Storage" on the closing dataset. rs-core.js does
   not request it yet, so append it here — this runs at script load, before any
   RS.load("closing") call, so the cached fetch always includes the column. */
if (RS.DATASETS.closing.cols.indexOf("Storage") < 0) RS.DATASETS.closing.cols.push("Storage");

registerPage({
  id: "storage",
  group: "customers",
  title: "Storage",
  async render(host) {
    const [storageAll, closingAll] = await Promise.all([RS.load("storage"), RS.load("closing")]);
    const rows = RS.filtered("storage", storageAll);
    const closingRows = RS.filtered("closing", closingAll);
    const M = RS.M;
    const moneyNS = v => (v == null || isNaN(v)) ? "—" : RS.money(v);   // null-safe table money
    const EMPTY = '<div style="padding:16px 14px;color:var(--muted)">No data for the current filters.</div>';

    // Empty state — nothing matches the current filters: skip KPIs/charts entirely.
    if (!rows.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Storage</h1>
          <p>Storage revenue — additional payments vs included-in-bill ·
             <b>0</b> storage payments in scope</p>
        </div>
        <div class="panel" style="padding:16px 14px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    // Exact DAX: both measures read Storage Payments, split on Payment Type —
    // 'Paid at Pickup' = included in the job's Total Bill, everything else = additional.
    const inclTotal = M["Storage Revenue Included in Total Bill"].fn(rows);
    const addTotal = M["Storage Additional Revenue"].fn(rows);

    // YoY headline: Jan-1 → freshest FILTERED payment date, vs the same window last
    // year. Both windows are cut from the slicer-filtered but DATE-unfiltered rows.
    const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo };
    S.dateFrom = S.dateTo = null; S.dayFrom = S.dayTo = null;
    const dateless = RS.filtered("storage", storageAll);
    S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt;
    const maxD = rows.reduce((a, r) => ((r._d || "") > a ? r._d : a), "");
    const yoyChip = name => {
      if (maxD.length !== 10) return "";
      const cy = maxD.slice(0, 4), cut = maxD.slice(4);          // "-MM-DD"
      const win = y => dateless.filter(r => r._y === y && (r._d || "").slice(4) <= cut);
      const cur = M[name].fn(win(cy)), prev = M[name].fn(win(String(+cy - 1)));
      if (!prev) return "";
      const g = (cur - prev) / Math.abs(prev);
      return `· <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}%</span> vs same period LY`;
    };

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Storage</h1>
        <p>Storage revenue — additional payments vs included-in-bill ·
           <b>${RS.fmtN(rows.length)}</b> storage payments in scope
           <span class="freshness">· monthly chart excludes the current partial month</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div class="rs-grid2" id="subs"></div>`;

    const kpiHost = document.getElementById("kpis");
    RSC.kpis(kpiHost, [
      { label: "Storage — Paid Separately", value: RS.moneyC(addTotal), sub: RS.money(addTotal) + " · separate storage payments (formerly Storage Additional Revenue)" },
      { label: "Storage Payments", value: RS.fmtN(rows.length), sub: "# payments in scope" },
      { label: "Avg Payment", value: rows.length ? RS.moneyC((addTotal + inclTotal) / rows.length) : "—", sub: "all storage revenue / payment" },
      { label: "Storage — Paid with the Move", value: RS.moneyC(inclTotal), sub: RS.money(inclTotal) + " · paid at pickup, inside the job's bill (formerly Storage Rev. in Job Revenue)" },
      { label: "Storage Jobs", value: RS.fmtN(M["Total Storage Jobs"].fn(closingRows)), sub: "closings marked Our Storage" },
    ]);
    {   // RSC.kpis HTML-escapes subs — inject the YoY chips afterwards as HTML.
      const kSubs = kpiHost.querySelectorAll(".kpi .s");
      const cAdd = yoyChip("Storage Additional Revenue");
      const cIncl = yoyChip("Storage Revenue Included in Total Bill");
      if (cAdd) kSubs[0].innerHTML += " " + cAdd;
      if (cIncl) kSubs[3].innerHTML += " " + cIncl;
    }

    // ---- month buckets: additional (storage payments) + included-in-bill (closing)
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const addByMonth = {};
    RS.groupBy(rows, "_month", "Storage Additional Revenue").forEach(x => { addByMonth[x.k] = x; });
    const closByMonth = {};
    closingRows.forEach(r => { const k = mk(r); (closByMonth[k] = closByMonth[k] || []).push(r); });
    const inclByMonth = {};
    RS.groupBy(rows, "_month", "Storage Revenue Included in Total Bill")
      .forEach(x => { inclByMonth[x.k] = x.v; });
    const months = [...new Set([...Object.keys(addByMonth), ...Object.keys(closByMonth)])].sort();
    const now = new Date();
    const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);

    // ---- main chart: storage revenue by month (PBI "Storage Analysis" clustered column)
    RSC.chartCard(document.getElementById("main"), {
      title: "Storage revenue by month",
      // PBI hard-codes a visual filter `End of Month <> <current month>`; replicated
      // DYNAMICALLY — the current partial calendar month is dropped from the chart only.
      controlsHtml: `<span class="lbl">last 24 mo · current partial month excluded</span>`,
      controlsGraphOnly: true,   // note describes the chart only — hide it in tabular view
      buildChart(canvas) {
        const shown = months
          .filter(k => k !== curKey && ((addByMonth[k] && addByMonth[k].v) || inclByMonth[k]))
          .slice(-24);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: shown.map(mLabel),
            datasets: [
              { label: "Storage — Paid Separately", data: shown.map(k => Math.round(addByMonth[k] ? addByMonth[k].v : 0)), backgroundColor: "#b7e23b", borderRadius: 4 },
              { label: "Storage — Paid with the Move", data: shown.map(k => Math.round(inclByMonth[k] || 0)), backgroundColor: "#5b8cff", borderRadius: 4 },
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
              x: { ticks: { autoSkip: true, maxTicksLimit: 14, maxRotation: 45, font: { size: 11 } } },
            },
          },
        });
      },
      buildTable() {
        // Parity with the PBI pivot "Leads Tabular Analysis": Year→Month rows with
        // Total Jobs, Revenue (split into closings + appended trips), and storage revenue.
        // The tabular view keeps the current month (marked partial) — chart-only exclusion.
        const data = months.map(k => {
          const cl = closByMonth[k] || [];
          return {
            m: mLabel(k) + (k === curKey ? " (partial)" : ""),
            jobs: M["Total Jobs"].fn(cl),
            rev: M["Revenue"].fn(cl),
            revC: M["Total Revenue"].fn(cl),
            revT: M["Additional Revenue from Trips"].fn(cl),
            amt: addByMonth[k] ? addByMonth[k].v : 0,
            n: addByMonth[k] ? addByMonth[k].n : 0,
            incl: inclByMonth[k] || 0,
          };
        });
        if (!data.length) return EMPTY;
        return RSC.table(
          [{ key: "m", label: "Month" }, { key: "jobs", label: "Total Jobs", fmt: RS.fmtN },
           { key: "rev", label: "Revenue", fmt: moneyNS },
           { key: "revC", label: "Revenue (Closings)", fmt: moneyNS },
           { key: "revT", label: "Trip Revenue", fmt: moneyNS },
           { key: "amt", label: "Storage — Paid Separately", fmt: moneyNS },
           { key: "n", label: "# Payments", fmt: RS.fmtN },
           { key: "incl", label: "Storage — Paid with the Move", fmt: moneyNS }],
          data,
          { m: "Total", jobs: M["Total Jobs"].fn(closingRows),
            rev: M["Revenue"].fn(closingRows),
            revC: M["Total Revenue"].fn(closingRows),
            revT: M["Additional Revenue from Trips"].fn(closingRows),
            amt: addTotal, n: rows.length, incl: inclTotal });
      },
    });

    // ---- sub 1: doughnut of Amount by Payment Type · sub 2: recent payments table
    const subs = document.getElementById("subs");
    const byType = RS.groupBy(rows, "Payment Type", "Storage Additional Revenue");
    const PAL = ["#b7e23b", "#5b8cff", "#e8a33d", "#d85f3f", "#7a5fd8", "#38b2ac", "#6b7a88", "#c05299", "#8a9a5b", "#4a5568"];
    RSC.chartCard(subs, {
      title: "By payment type",
      buildChart(canvas) {
        let list = byType;
        if (list.length > 9) {          // keep the doughnut readable
          const rest = list.slice(9);
          list = list.slice(0, 9).concat([{
            k: "Other", v: rest.reduce((a, x) => a + (x.v || 0), 0), n: rest.reduce((a, x) => a + x.n, 0),
          }]);
        }
        return new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ data: list.map(x => Math.round(x.v || 0)), backgroundColor: list.map((_, i) => PAL[i % PAL.length]), borderWidth: 1 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "58%",
            plugins: {
              legend: { position: "right", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => {
                const tot = c.dataset.data.reduce((a, b) => a + b, 0);
                return `${c.label}: ${RS.money(c.raw)} (${tot ? (100 * c.raw / tot).toFixed(1) : 0}%)`;
              } } },
            },
          },
        });
      },
      buildTable() {
        if (!byType.length) return EMPTY;
        const tot = byType.reduce((a, x) => a + (x.v || 0), 0);
        return RSC.table(
          [{ key: "k", label: "Payment Type" }, { key: "v", label: "Amount", fmt: moneyNS },
           { key: "n", label: "# Payments", fmt: RS.fmtN }, { key: "p", label: "% of Amount", fmt: RS.fmtPct }],
          byType.map(x => ({ k: x.k, v: x.v, n: x.n, p: tot ? (x.v || 0) / tot : null })),
          { k: "Total", v: tot, n: rows.length, p: tot ? 1 : null });
      },
    });

    const pay = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Payments</span>
         <span class="spacer"></span>
         <span class="rs-ctl"><span class="lbl">showing ${RS.fmtN(Math.min(50, rows.length))} of ${RS.fmtN(rows.length)} · most recent first</span></span></div>
       <div class="tabwrap"></div>`);
    {
      const recent = rows.slice()
        .sort((a, b) => (b._d || "").localeCompare(a._d || "")).slice(0, 50);
      pay.querySelector(".tabwrap").innerHTML = recent.length ? RSC.table(
        [{ key: "d", label: "Payment Date" }, { key: "c", label: "Customer" },
         { key: "j", label: "Job Code" }, { key: "t", label: "Payment Type" },
         { key: "a", label: "Amount", fmt: moneyNS }],
        recent.map(r => ({
          d: r._d || "—", c: r.Customer || "—", j: r["Job Code"] || "—",
          t: r["Payment Type"] || "—", a: r.Amount == null ? null : RS.num(r.Amount),
        }))) : EMPTY;
    }
    subs.appendChild(pay);
  },
});
