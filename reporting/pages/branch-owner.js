/* FINANCIAL page: Branch Owner — results for people who take a cut when listed as a
   Sales Person but are NOT real salespeople (currently Giorgi Kolbaia, a foreman-turned-
   branch-owner). Reads fct_closing's `Branch Owner` / `Branch Owner Cut` columns, which
   are populated ONLY where he's in an SP slot (never from his foreman work). Read-only.
   Respects the global date/company filter.

   LOADS PROGRESSIVELY: the skeleton + the closing-only sections (cut KPIs, cut-by-month,
   per-job table) paint immediately from the `closing` dataset; the profit sections
   (profit KPIs + margin-vs-rest + by move type + by foreman) show a loading card and fill
   in once the heavier cross-dataset tables (sales_salaries / helper_salaries / refunds)
   arrive. So the page is usable in ~seconds instead of blocking on all four datasets.

   Gross profit (UI name since 2026-07-13 — it's revenue minus direct job costs; PBI's DAX
   still calls it 'Operational Profit by Formula', keys unchanged) is built the SAME way as
   the Job P&L page so the numbers tie out with the rest of the portal:
     Gross Profit = Revenue - (Forman + Driver + Helper + Sales Commission) - (Car+Fuel+
                 Hotel+Toll+Truck+Other + Refunds).   Margin = Gross Profit / Revenue.
   ("Revenue" is the display name for the measure keyed 'Total Bill' = SUM(Total Bill) +
   Extra Bill From Trips.) Cross-dataset costs (Sales Commission, Helper Salary, Total
   Refunds) are attributed to each job by Unique Key / Request Joinkey (Job P&L pattern). */
registerPage({
  id: "branch-owner",
  group: "financial",
  title: "Branch Owner",
  async render(host) {
    const num = RS.num, money = RS.money, moneyC = RS.moneyC || RS.money, fmtN = RS.fmtN;
    const pctS = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";
    const M = RS.M;
    const loadingCard = t => `<div class="panel" style="min-height:320px;display:grid;place-items:center">
      <div style="text-align:center;color:var(--muted)"><b>${t}</b><br><span style="font-size:12px">Loading…</span></div></div>`;

    const head = `
      <div class="rs-page-head">
        <h1>Branch Owner</h1>
        <p>Results for a branch owner — someone who takes a cut when listed as a
           <b>Sales Person</b>, not a real salesperson (currently <b>Giorgi Kolbaia</b>).
           Counts <b>only his SP-slot cut</b>, never his foreman jobs. Gross profit is
           after his cut and ties out with the Job P&amp;L page.
           <span class="freshness">· read-only · respects the date/company filter</span></p>
      </div>`;

    // ---- skeleton first: page paints instantly, each section fills in as its data lands ----
    host.innerHTML = head + `
      <div class="rs-kpis" id="boKpis"><div class="rs-loading">Loading…</div></div>
      <div class="rs-kpis" id="boProfitKpis"></div>
      <div class="rs-grid2" id="boGrid">
        <div id="boSlotTrend"></div>
        <div id="boSlotCompare"></div>
        <div id="boSlotType"></div>
        <div id="boSlotForeman"></div>
      </div>
      <div id="boDetail"></div>`;
    document.getElementById("boSlotCompare").innerHTML = loadingCard("Gross margin — his jobs vs the rest");
    document.getElementById("boSlotType").innerHTML = loadingCard("By move type — gross profit &amp; margin");
    document.getElementById("boSlotForeman").innerHTML = loadingCard("By foreman — job count &amp; pay");

    // =========================== PHASE 1: closing only (fast) ===========================
    const closingAll = await RS.load("closing");
    const closingRows = RS.filtered("closing", closingAll).filter(r => r["Record Source"] === "closing");
    const isBO = r => r["Branch Owner"] != null && String(r["Branch Owner"]).trim() !== "";
    const scoped = closingRows.filter(isBO);
    const rest = closingRows.filter(r => !isBO(r));

    if (!scoped.length) {
      host.innerHTML = head + `<div class="rs-loading">No branch-owner jobs in the current filter range.</div>`;
      return;
    }

    const totalBill = scoped.reduce((a, r) => a + num(r["Total Bill"]), 0);
    const totalCut  = scoped.reduce((a, r) => a + num(r["Branch Owner Cut"]), 0);
    const owners = [...new Set(scoped.map(r => r["Branch Owner"]))];
    const avgPct = totalBill ? totalCut / totalBill : 0;

    RSC.kpis(document.getElementById("boKpis"), [
      { label: "Jobs (as branch owner)", value: fmtN(scoped.length), sub: owners.join(", ") },
      { label: "Revenue of those jobs", value: moneyC(totalBill), sub: money(totalBill) },
      { label: "His Cut", value: moneyC(totalCut), sub: money(totalCut) },
      { label: "Avg Cut %", value: pctS(avgPct), sub: "of revenue" },
    ]);
    document.getElementById("boProfitKpis").innerHTML =
      `<div class="rs-loading">Calculating gross profit…</div>`;

    // ---- (1) monthly trend: his cut + the revenue it came from (closing only) ----
    const byMonth = {};
    scoped.forEach(r => {
      const mk = (r._y || "") + "-" + String(r._m || 0).padStart(2, "0");
      (byMonth[mk] = byMonth[mk] || { jobs: 0, bill: 0, cut: 0 });
      byMonth[mk].jobs++; byMonth[mk].bill += num(r["Total Bill"]); byMonth[mk].cut += num(r["Branch Owner Cut"]);
    });
    const months = Object.keys(byMonth).sort();
    const mrows = months.map(mk => ({
      k: mk, jobs: byMonth[mk].jobs, bill: byMonth[mk].bill, cut: byMonth[mk].cut,
      pctv: byMonth[mk].bill ? byMonth[mk].cut / byMonth[mk].bill : 0,
    }));
    RSC.chartCard(document.getElementById("boSlotTrend"), {
      title: "Branch owner cut by month",
      key: "branch-owner-trend",
      buildChart(canvas) {
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: months,
            datasets: [
              { label: "His Cut", data: months.map(mk => byMonth[mk].cut),
                backgroundColor: "rgba(132,204,22,.78)", yAxisID: "y", order: 2 },
              { type: "line", label: "Revenue", data: months.map(mk => byMonth[mk].bill),
                borderColor: "#64748b", backgroundColor: "#64748b", tension: .3, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: {
              y:  { position: "left",  beginAtZero: true, title: { display: true, text: "His Cut ($)" } },
              y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false },
                    title: { display: true, text: "Revenue ($)" } },
            },
          },
        });
      },
      buildTable() {
        return RSC.table(
          [{ key: "k", label: "Month" },
           { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
           { key: "bill", label: "Revenue", align: "r", fmt: money },
           { key: "cut", label: "His Cut", align: "r", fmt: money },
           { key: "pctv", label: "Cut %", align: "r", fmt: pctS }],
          mrows,
          { k: "Total", jobs: scoped.length, bill: totalBill, cut: totalCut, pctv: avgPct });
      },
    });

    // ---- per-job detail (closing only), full width ----
    const detail = scoped.slice()
      .sort((a, b) => String(b["Date"] || "").localeCompare(String(a["Date"] || "")))
      .map(r => ({
        dt: r["Date"], cust: r["Customer"], co: r["Company"], req: r["Request #"],
        bill: num(r["Total Bill"]), cut: num(r["Branch Owner Cut"]),
        pctv: num(r["Total Bill"]) ? num(r["Branch Owner Cut"]) / num(r["Total Bill"]) : 0,
      }));
    const detailTable = RSC.table(
      [{ key: "dt", label: "Move Date" }, { key: "req", label: "Request #" },
       { key: "cust", label: "Customer" }, { key: "co", label: "Company" },
       { key: "bill", label: "Revenue", align: "r", fmt: money },
       { key: "pctv", label: "Cut %", align: "r", fmt: pctS },
       { key: "cut", label: "His Cut", align: "r", fmt: money }],
      detail,
      { dt: "Total", bill: totalBill, cut: totalCut, pctv: avgPct });
    document.getElementById("boDetail").innerHTML = `
      <div class="panel" style="margin-top:14px">
        <div class="panel-head"><span class="panel-title">Every branch-owner job (${fmtN(detail.length)})</span></div>
        <div style="padding:0 4px 8px"><div class="tabwrap">${detailTable}</div></div>
      </div>`;

    // ================= PHASE 2: cross-dataset costs (sales / helper / refunds) =================
    const [salesAll, helperAll, refundAll] = await Promise.all([
      RS.load("sales_salaries"), RS.load("helper_salaries"), RS.load("refunds"),
    ]);

    const accum = (src, keyCol, valCol) => {
      const m = new Map();
      src.forEach(r => { const k = r[keyCol]; if (k == null || k === "") return;
        m.set(k, (m.get(k) || 0) + num(r[valCol])); });
      return m;
    };
    const salesByUK  = accum(RS.filtered("sales_salaries", salesAll),  "Unique Key", "Salary");
    const helperByUK = accum(RS.filtered("helper_salaries", helperAll), "Unique Key", "Amount Received");
    const refundByRJ = accum(RS.filtered("refunds", refundAll), "Request Joinkey", "Total refund");
    const sumUK = (rs, map) => rs.reduce((a, r) => a + (map.get(r["Unique Key"]) || 0), 0);
    const sumRJ = (rs, map) => rs.reduce((a, r) => a + (map.get(r["Request Joinkey"]) || 0), 0);

    // Per-group Gross Profit build-up (same shape/keys as financial-analysis.js opOf).
    const pnl = rs => {
      const bill = M["Total Bill"].fn(rs);
      const forman = M["Forman Salary"].fn(rs), driver = M["Driver Salary"].fn(rs);
      const helper = sumUK(rs, helperByUK), sales = sumUK(rs, salesByUK);
      const car = M["Car Expense"].fn(rs), fuel = M["Fuel Expense"].fn(rs), hotel = M["Hotel Expense"].fn(rs);
      const other = M["Other Expenses"].fn(rs), toll = M["Toll Expense"].fn(rs), truck = M["Truck Expense"].fn(rs);
      const refund = sumRJ(rs, refundByRJ);
      const exp = car + fuel + hotel + other + toll + truck;
      const op = bill - (forman + driver + helper + sales) - (exp + refund);
      // `sales` (Sales Commission) sums ALL SP-slot salaries incl. Giorgi's branch-owner cut,
      // which is correct for gross profit (real payout). But for the DISPLAYED "Sales Comm. %"
      // his cut must NOT count as sales commission — it has its own column — so strip it out.
      const boCut = rs.reduce((a, r) => a + num(r["Branch Owner Cut"]), 0);
      const realSales = sales - boCut;   // real salesperson commission only
      return { jobs: rs.length, bill, forman, driver, helper, sales, realSales, boCut, exp, refund,
               op, opm: bill ? op / bill : null, scm: bill ? realSales / bill : null };
    };
    const groupCut = rs => rs.reduce((a, r) => a + num(r["Branch Owner Cut"]), 0);

    const hp = pnl(scoped), rp = pnl(rest);
    const opBefore = hp.op + totalCut;                 // if his cut hadn't been taken
    const opmBefore = hp.bill ? opBefore / hp.bill : null;
    const cutMarginCost = hp.bill ? totalCut / hp.bill : 0;

    RSC.kpis(document.getElementById("boProfitKpis"), [
      { label: "Gross Profit", value: moneyC(hp.op), sub: money(hp.op) + " · after his cut" },
      { label: "Gross Margin", value: pctS(hp.opm), sub: "of revenue" },
      { label: "Margin before his cut", value: pctS(opmBefore),
        sub: "his cut costs " + pctS(cutMarginCost) + " of margin" },
      { label: "Rest-of-business margin", value: pctS(rp.opm),
        sub: (hp.opm != null && rp.opm != null)
          ? "his are " + (hp.opm >= rp.opm ? "+" : "") + pctS(hp.opm - rp.opm) + " vs rest"
          : "all non-Giorgi jobs" },
    ]);

    // ---- (2) his jobs vs the rest of the business — operational margin ----
    const cmpRows = [
      { k: "Giorgi's jobs", jobs: hp.jobs, bill: hp.bill, cut: totalCut, op: hp.op, opm: hp.opm, scm: hp.scm },
      { k: "Rest of business", jobs: rp.jobs, bill: rp.bill, cut: 0, op: rp.op, opm: rp.opm, scm: rp.scm },
    ];
    document.getElementById("boSlotCompare").innerHTML = "";
    RSC.chartCard(document.getElementById("boSlotCompare"), {
      title: "Gross margin — his jobs vs the rest of the business",
      key: "branch-owner-profit",
      buildChart(canvas) {
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: ["Giorgi's jobs", "Rest of business"],
            datasets: [
              { label: "Gross Margin", data: [hp.opm, rp.opm].map(v => v == null ? 0 : +(v * 100).toFixed(2)),
                backgroundColor: ["#84cc16", "#94a3b8"], borderRadius: 4 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: ct => "Gross Margin: " + ct.raw.toFixed(1) + "%" } } },
            scales: { y: { beginAtZero: true, title: { display: true, text: "Gross margin (%)" },
              ticks: { callback: v => v + "%" } } },
          },
        });
      },
      buildTable() {
        return RSC.table(
          [{ key: "k", label: "" },
           { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
           { key: "bill", label: "Revenue", align: "r", fmt: money },
           { key: "cut", label: "Giorgi's Cut", align: "r", fmt: money },
           { key: "op", label: "Gross Profit", align: "r", fmt: money },
           { key: "opm", label: "Gross Margin", align: "r", fmt: pctS },
           { key: "scm", label: "Sales Comm. %", align: "r", fmt: pctS }],
          cmpRows,
          (() => { const ap = pnl(closingRows);
            return { k: "All jobs", jobs: ap.jobs, bill: ap.bill, cut: totalCut,
                     op: ap.op, opm: ap.opm, scm: ap.scm }; })()) +
          `<p style="margin:6px 2px 0;font-size:12px;color:var(--faint)">Sales Comm. % is the real salesperson commission — Giorgi's branch-owner cut is excluded (it's the separate "Giorgi's Cut" column). Gross profit still subtracts his cut.</p>`;
      },
    });

    // ---- (3) by move type (his jobs) ----
    const byType = (() => {
      const g = {};
      scoped.forEach(r => { const t = (r["Moving Type"] == null || r["Moving Type"] === "") ? "—" : String(r["Moving Type"]);
        (g[t] = g[t] || []).push(r); });
      return Object.entries(g).map(([t, rs]) => {
        const p = pnl(rs);
        return { t, jobs: p.jobs, bill: p.bill, cut: groupCut(rs), op: p.op, opm: p.opm };
      }).sort((a, b) => (b.bill || 0) - (a.bill || 0));
    })();
    document.getElementById("boSlotType").innerHTML = "";
    RSC.chartCard(document.getElementById("boSlotType"), {
      title: "By move type — gross profit & margin",
      key: "branch-owner-bytype",
      buildChart(canvas) {
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: byType.map(x => x.t),
            datasets: [
              { label: "Gross Profit", data: byType.map(x => +(+x.op).toFixed(2)),
                backgroundColor: "#84cc16", borderRadius: 4, yAxisID: "y", order: 2 },
              { type: "line", label: "Gross Margin", data: byType.map(x => x.opm == null ? null : +(x.opm * 100).toFixed(2)),
                borderColor: "#5b8cff", backgroundColor: "#5b8cff", tension: .3, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" },
              tooltip: { callbacks: { label: ct => ct.dataset.label === "Gross Margin"
                ? "Gross Margin: " + (ct.raw == null ? "—" : ct.raw.toFixed(1) + "%")
                : "Gross Profit: " + moneyC(ct.raw) } } },
            scales: {
              y:  { position: "left", beginAtZero: true, title: { display: true, text: "Gross Profit ($)" } },
              y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false },
                    title: { display: true, text: "Margin (%)" }, ticks: { callback: v => v + "%" } },
            },
          },
        });
      },
      buildTable() {
        return RSC.table(
          [{ key: "t", label: "Move Type" },
           { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
           { key: "bill", label: "Revenue", align: "r", fmt: money },
           { key: "cut", label: "Giorgi's Cut", align: "r", fmt: money },
           { key: "op", label: "Gross Profit", align: "r", fmt: money },
           { key: "opm", label: "Gross Margin", align: "r", fmt: pctS }],
          byType,
          { t: "Total", jobs: hp.jobs, bill: hp.bill, cut: totalCut, op: hp.op, opm: hp.opm });
      },
    });

    // ---- (4) by foreman (his jobs) — who ran them, how many, at what rate ----
    const byForeman = (() => {
      const g = {};
      scoped.forEach(r => { const f = (r["Foreman"] == null || r["Foreman"] === "") ? "—" : String(r["Foreman"]);
        (g[f] = g[f] || []).push(r); });
      return Object.entries(g).map(([f, rs]) => {
        const p = pnl(rs);
        const hrs = M["Hours Worked by Forman"].fn(rs), pay = p.forman;
        return { f, jobs: p.jobs, hrs, bill: p.bill, pay,
                 rate: hrs ? pay / hrs : null, pctb: p.bill ? pay / p.bill : null,
                 op: p.op, opm: p.opm };
      }).sort((a, b) => (b.jobs || 0) - (a.jobs || 0));
    })();
    const TOPF = 20;
    const shownF = byForeman.slice(0, TOPF);
    document.getElementById("boSlotForeman").innerHTML = "";
    RSC.chartCard(document.getElementById("boSlotForeman"), {
      title: "By foreman — job count & pay",
      key: "branch-owner-byforeman",
      buildChart(canvas) {
        const list = shownF;
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.f),
            datasets: [{ label: "Jobs", data: list.map(x => x.jobs),
              backgroundColor: "#84cc16", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: ct => "Jobs: " + fmtN(ct.raw) } } },
            scales: {
              x: { beginAtZero: true, ticks: { precision: 0 } },
              y: { ticks: { font: { size: 11 },
                callback(v) { const l = this.getLabelForValue(v); return l.length > 16 ? l.slice(0, 15) + "…" : l; } } },
            },
          },
        });
      },
      buildTable() {
        const data = shownF.slice();
        if (byForeman.length > TOPF) {
          const restRows = scoped.filter(r => {
            const f = (r["Foreman"] == null || r["Foreman"] === "") ? "—" : String(r["Foreman"]);
            return !shownF.some(x => x.f === f);
          });
          const p = pnl(restRows), hrs = M["Hours Worked by Forman"].fn(restRows);
          data.push({ f: `All others (${byForeman.length - TOPF})`, jobs: p.jobs, hrs, bill: p.bill,
            pay: p.forman, rate: hrs ? p.forman / hrs : null, pctb: p.bill ? p.forman / p.bill : null,
            op: p.op, opm: p.opm });
        }
        const nz = v => (v == null || isNaN(v)) ? "—" : money(v);
        const nzN = v => (v == null || isNaN(v)) ? "—" : fmtN(v);
        return RSC.table(
          [{ key: "f", label: "Foreman" },
           { key: "jobs", label: "Jobs", align: "r", fmt: nzN },
           { key: "hrs", label: "Hours", align: "r", fmt: nzN },
           { key: "bill", label: "Revenue", align: "r", fmt: nz },
           { key: "pay", label: "Foreman Pay", align: "r", fmt: nz },
           { key: "rate", label: "$/hr", align: "r", fmt: nz },
           { key: "pctb", label: "Pay % of Revenue", align: "r", fmt: pctS },
           { key: "op", label: "Gross Profit", align: "r", fmt: nz },
           { key: "opm", label: "Gross Margin", align: "r", fmt: pctS }],
          data,
          (() => { const hrs = M["Hours Worked by Forman"].fn(scoped);
            return { f: "Total", jobs: hp.jobs, hrs, bill: hp.bill, pay: hp.forman,
              rate: hrs ? hp.forman / hrs : null, pctb: hp.bill ? hp.forman / hp.bill : null,
              op: hp.op, opm: hp.opm }; })()) +
          (byForeman.length > shownF.length
            ? `<p style="margin:6px 2px 0;font-size:12px;color:var(--faint)">Showing top ${shownF.length} of ${fmtN(byForeman.length)} foremen — the rest are in "All others".</p>`
            : "");
      },
    });
  },
});
