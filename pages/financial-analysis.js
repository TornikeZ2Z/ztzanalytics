/* Financial Analysis — faithful replica of the PBI "Financial Analysis" section
   (section 40f32b12e5beed600e3c). PBI layout: a Company slicer + a single
   pivotTable over 'Calculations' with
     Rows   = Date Hierarchy (Year / Month) · Service Type[Moving Type] · CF Ranges[CF Range]
     Values = Total Jobs, Total Bill, Forman Salary, Driver Salary, Helper Salary,
              Sales Commission, Car/Fuel/Hotel/Other/Toll/Truck Expense,
              Amount Deducted From Sales Person Normalized For Sales, Total Refunds,
              Total Operational Profit by Formula, Operational Profit Margin,
              Sales Commission Margin.
   Rebuilt as a KPI strip + a P&L table grouped by a dimension picker
   (Moving Type / CF Range / Month) with every line item as a column and a totals row.

   CROSS-DATASET GRAIN NOTE: Sales Commission (fct_sales_salaries), Helper Salary
   (fct_helper_salaries) and Total Refunds (fct_refunds) live on tables that join to
   fct_closing only by Unique Key / Request Joinkey — they carry no Moving Type / CF
   Range / Date columns. To slice them PER GROUP we build attribution maps keyed by
   Unique Key (salaries) and Request Joinkey (refunds) and fold each sub-dataset $ into
   the owning closing row's group. The grand-total row uses RS.M composites directly so
   it stays identical to the KPI strip and the rest of the portal.
   "Amount Deducted From Sales Person Normalized For Sales" is a known 0 gap (its RELATED
   factor isn't served client-side) — kept in the math but hidden from the table until the
   data exists (scan item C21). CF Range comes from the moveboard bridge on Request Joinkey
   (fct_closing has no physical CF Range). */
registerPage({
  id: "financial-analysis",
  group: "overview",
  title: "Financial Analysis",
  async render(host) {
    const [closingAll, moveboardAll, salesAll, helperAll, refundsAll] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"),
      RS.load("sales_salaries"), RS.load("helper_salaries"), RS.load("refunds"),
    ]);
    const rows = RS.filtered("closing", closingAll);
    const M = RS.M;
    const nz = fmt => v => (v == null || (typeof v === "number" && isNaN(v))) ? "—" : fmt(v);

    // ---- moveboard bridge: Request Joinkey -> CF Range (shared cache w/ other pages)
    if (!RS._mbBridge) {
      RS._mbBridge = new Map();
      moveboardAll.forEach(r => {
        const k = r["Request Joinkey"];
        if (k && !RS._mbBridge.has(k))
          RS._mbBridge.set(k, { cf: r["CF Range"] || null, svc: r["Service Type"] || null });
      });
    }
    const bridge = RS._mbBridge;
    const cfOf = r => { const b = bridge.get(r["Request Joinkey"]); return (b && b.cf) || null; };

    // ---- cross-dataset attribution maps (filtered to the SAME global scope).
    // Sales/Helper salaries key by closing Unique Key; refunds key by Request Joinkey.
    const salesF  = RS.filtered("sales_salaries", salesAll);
    const helperF = RS.filtered("helper_salaries", helperAll);
    const refundF = RS.filtered("refunds", refundsAll);
    const num = RS.num;
    const accum = (src, keyCol, valCol) => {
      const m = new Map();
      src.forEach(r => {
        const k = r[keyCol]; if (k == null || k === "") return;
        m.set(k, (m.get(k) || 0) + num(r[valCol]));
      });
      return m;
    };
    const salesByUK  = accum(salesF,  "Unique Key", "Salary");
    const helperByUK = accum(helperF, "Unique Key", "Amount Received");
    const refundByRJ = accum(refundF, "Request Joinkey", "Total refund");

    // ---- P&L line items (order mirrors the PBI pivot value list).
    // grp(rs) fns compute a line for an arbitrary set of closing rows. Cross-dataset
    // lines pull from the attribution maps via each row's key.
    const sumUK = (rs, map) => rs.reduce((a, r) => a + (map.get(r["Unique Key"]) || 0), 0);
    const sumRJ = (rs, map) => rs.reduce((a, r) => a + (map.get(r["Request Joinkey"]) || 0), 0);
    const LINES = [
      { key: "jobs",   label: "Total Jobs",       fmt: RS.fmtN,  grp: rs => rs.length },
      // display label is the transition form "Revenue (Total Bill)"; the registry
      // key "Total Bill" stays untouched (identical formula to "Revenue").
      { key: "bill",   label: "Revenue (Total Bill)", fmt: RS.money, grp: rs => M["Total Bill"].fn(rs) },
      { key: "forman", label: "Foreman Salary",   fmt: RS.money, grp: rs => M["Forman Salary"].fn(rs) },
      { key: "driver", label: "Driver Salary",    fmt: RS.money, grp: rs => M["Driver Salary"].fn(rs) },
      { key: "helper", label: "Helper Salary",    fmt: RS.money, grp: rs => sumUK(rs, helperByUK) },
      { key: "sales",  label: "Sales Commission", fmt: RS.money, grp: rs => sumUK(rs, salesByUK) },
      { key: "car",    label: "Car Expense",      fmt: RS.money, grp: rs => M["Car Expense"].fn(rs) },
      { key: "fuel",   label: "Fuel Expense",     fmt: RS.money, grp: rs => M["Fuel Expense"].fn(rs) },
      { key: "hotel",  label: "Hotel Expense",    fmt: RS.money, grp: rs => M["Hotel Expense"].fn(rs) },
      { key: "other",  label: "Other Expenses",   fmt: RS.money, grp: rs => M["Other Expenses"].fn(rs) },
      { key: "toll",   label: "Toll Expense",     fmt: RS.money, grp: rs => M["Toll Expense"].fn(rs) },
      { key: "truck",  label: "Truck Expense",    fmt: RS.money, grp: rs => M["Truck Expense"].fn(rs) },
      // "Amount Deducted From Sales Person" is permanently 0 until its data is
      // loaded — hidden from the rendered table (C21) but kept in the math so the
      // Operational Profit build-up keeps its shape.
      { key: "deduct", label: "Amount Deducted From Sales Person",
        fmt: RS.money, grp: rs => 0, gap: true, hidden: true },
      { key: "refund", label: "Total Refunds",    fmt: RS.money, grp: rs => sumRJ(rs, refundByRJ) },
      { key: "op",     label: "Operational Profit", fmt: RS.money },
      { key: "opm",    label: "Op. Profit Margin", fmt: RS.fmtPct },
      { key: "scm",    label: "Sales Comm. Margin", fmt: RS.fmtPct },
    ];
    // A group's Operational Profit, rebuilt from THIS group's line items so it ties out
    // to the columns shown (same shape as the DAX: Bill - salaries(+deduct) - expenses).
    const opOf = c => c.bill
      - (c.forman + c.driver + c.helper + c.sales - c.deduct)
      - (c.car + c.fuel + c.hotel + c.other + c.toll + c.truck + c.refund);
    const rowOf = rs => {
      const c = {};
      LINES.forEach(l => { if (l.grp) c[l.key] = l.grp(rs) || 0; });
      c.op = opOf(c);
      c.opm = c.bill ? c.op / c.bill : null;
      c.scm = c.bill ? c.sales / c.bill : null;
      return c;
    };

    // ---- dimension picker (PBI rows: Moving Type / CF Range / Month + Date).
    const DIMS = {
      "Moving Type": r => r["Moving Type"],
      "CF Range":    r => cfOf(r),
      "Month":       r => (r._y && r._m) ? (r._y + "-" + String(r._m).padStart(2, "0")) : null,
    };
    const MONTH_LABEL = k => RS.monthName(+k.slice(5)) + " " + k.slice(0, 4);
    const DIM_SORT = {
      "Month": (a, b) => a.k.localeCompare(b.k),
      "CF Range": (a, b) => (num(String(a.k).replace(/[^0-9]/g, "").slice(0, 5)) || 9e9) -
                            (num(String(b.k).replace(/[^0-9]/g, "").slice(0, 5)) || 9e9),
    };
    let dimBy = "Moving Type";

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Job P&amp;L</h1>
        <p>(formerly Financial Analysis) · per-job costs, commissions and deductions — for investigating which jobs and people drive the numbers ·
           <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· commissions, helper salaries &amp; refunds are matched to jobs by job key</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div class="panel" id="notes" style="padding:12px 16px;color:var(--muted);font-size:11px"></div>`;

    if (!rows.length) {
      document.getElementById("main").innerHTML =
        `<div class="panel" style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
      document.getElementById("notes").remove();
      return;
    }

    // ---- KPI strip: Total Bill, Operational Profit, Op Margin, Sales Commission, Total Expenses
    const kBill  = M["Total Bill"].fn(rows);
    const kOp    = M["Operational Profit by Formula"].fn(rows);
    const kOpm   = M["Operational Profit Margin"].fn(rows);
    const kSales = sumUK(rows, salesByUK);
    // Total Expenses = every deducted line (salaries + hard expenses + refunds).
    const gTot = rowOf(rows);
    const kExp = gTot.forman + gTot.driver + gTot.helper + gTot.sales
      + gTot.car + gTot.fuel + gTot.hotel + gTot.other + gTot.toll + gTot.truck
      + gTot.refund - gTot.deduct;
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Revenue (Total Bill)", value: RS.moneyC(kBill), sub: nz(RS.money)(kBill) + " · revenue in scope" },
      { label: "Operational Profit", value: RS.moneyC(kOp),   sub: "revenue − salaries − expenses − refunds" },
      { label: "Op. Profit Margin",  value: RS.fmtPct(kOpm),  sub: "profit ÷ revenue" },
      { label: "Sales Commission",   value: RS.moneyC(kSales), sub: nz(RS.money)(kSales) + " · commissions paid" },
      { label: "Total Expenses",     value: RS.moneyC(kExp),  sub: "all salary + expense + refund lines" },
    ]);

    // ---- main P&L: dimension rows × line-item columns, with a grand-total footer.
    const grouped = () => {
      const get = DIMS[dimBy], g = new Map();
      rows.forEach(r => {
        let k = get(r); k = (k == null || k === "") ? "—" : String(k);
        if (!g.has(k)) g.set(k, []);
        g.get(k).push(r);
      });
      let out = [...g.entries()].map(([k, rs]) => {
        const c = rowOf(rs);
        c.k = dimBy === "Month" && k !== "—" ? MONTH_LABEL(k) : k;
        c._sortk = k;
        return c;
      });
      const srt = DIM_SORT[dimBy];
      out.sort(srt ? (a, b) => srt({ k: a._sortk }, { k: b._sortk }) : (a, b) => (b.bill || 0) - (a.bill || 0));
      return out;
    };

    const controls =
      `<span class="lbl">Break down by</span><select id="faDim">` +
      Object.keys(DIMS).map(d => `<option ${d === dimBy ? "selected" : ""}>${d}</option>`).join("") +
      `</select>`;

    const buildTable = () => {
      const list = grouped();
      // grand-total row uses RS.M composites so it matches the KPI strip exactly.
      const tot = rowOf(rows);
      tot.op  = M["Operational Profit by Formula"].fn(rows);
      tot.opm = M["Operational Profit Margin"].fn(rows);
      tot.scm = M["Sales Commission Margin"].fn(rows);
      // rebuild columns fresh each render so the first column label tracks dimBy.
      // hidden lines (permanently-empty data gaps) stay out of the table until real data exists.
      const cols = [{ key: "k", label: dimBy }].concat(
        LINES.filter(l => !l.hidden).map(l => ({ key: l.key, label: l.label,
          fmt: l.gap ? (() => `—`) : nz(l.fmt) })));
      const totals = Object.assign({ k: "Total" }, tot);
      return RSC.table(cols, list, totals);
    };

    const mainCard = RSC.chartCard(document.getElementById("main"), {
      title: "Profit & Loss",
      controlsHtml: controls,
      controlsGraphOnly: false,
      buildChart(canvas) {
        // Waterfall-ish: revenue vs the stacked deductions, per group (top 15).
        const list = grouped().slice(0, 15);
        const deduct = c => c.forman + c.driver + c.helper + c.sales
          + c.car + c.fuel + c.hotel + c.other + c.toll + c.truck + c.refund - c.deduct;
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.k),
            datasets: [
              { label: "Operational Profit", data: list.map(x => +(x.op || 0).toFixed(2)),
                backgroundColor: "#b7e23b", borderRadius: 4, stack: "s" },
              { label: "Total Expenses", data: list.map(x => +(deduct(x) || 0).toFixed(2)),
                backgroundColor: "#f87171", borderRadius: 4, stack: "s" },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12 } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.money(c.raw)}` } },
            },
            scales: {
              x: { stacked: true, ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 16,
                    callback(v) { const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
                      return typeof l === "string" && l.length > 14 ? l.slice(0, 13) + "…" : l; } } },
              y: { stacked: true, ticks: { callback: v => RS.moneyC(v) } },
            },
          },
        });
      },
      buildTable,
    });

    // (System detail for maintainers: this table mirrors the PBI "Financial Analysis"
    // pivot; Sales Commission & Helper Salary attach via Unique Key, refunds via
    // Request Joinkey, CF Range via the moveboard bridge. The "Amount Deducted From
    // Sales Person" line is a known 0 gap — its RELATED closing factor isn't served
    // client-side — so the column is hidden until real data exists. The linked-trip
    // expense residual (fct_trips) is not folded in.)
    document.getElementById("notes").innerHTML =
      `How it's counted · Commissions and helper salaries are matched to jobs by job key; ` +
      `refunds are matched by request number. One deduction line ("Amount Deducted From Sales Person") ` +
      `isn't available in this portal yet, so it is not shown. Expenses tied to linked trips are also not ` +
      `included yet — profit per group is slightly overstated by these two small items.`;

    document.getElementById("faDim").onchange = e => { dimBy = e.target.value; mainCard.rerender(); };
  },
});
