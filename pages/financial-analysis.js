/* Job P&L (formerly Financial Analysis) — stripped to JUST the per-job Profit & Loss
   table (no charts, KPI tiles or extra panels). The table lists every P&L line item
   as a column, grouped by a dimension picker (Moving Type / CF Range / Month) with a
   grand-total footer. It flows in the page (no inner-scroll wrapper) and is rendered
   compact so more rows fit before the PAGE scrolls.

   CROSS-DATASET GRAIN NOTE: Sales Commission (fct_sales_salaries), Helper Salary
   (fct_helper_salaries) and Total Refunds (fct_refunds) live on tables that join to
   fct_closing only by Unique Key / Request Joinkey — they carry no Moving Type / CF
   Range / Date columns. To slice them PER GROUP we build attribution maps keyed by
   Unique Key (salaries) and Request Joinkey (refunds) and fold each sub-dataset $ into
   the owning closing row's group. The grand-total row uses RS.M composites directly so
   it stays identical to the rest of the portal.
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

    // Compact, in-flow table: no inner-scroll wrapper, tight rows — the PAGE scrolls.
    host.innerHTML = `
      <style>
        #fa-pl .fa-controls { display:flex; align-items:center; gap:8px; margin:0 0 10px; }
        #fa-pl .fa-controls .lbl { color:var(--muted); font-size:12px; }
        #fa-pl table.tab { width:100%; border-collapse:collapse; }
        #fa-pl table.tab th, #fa-pl table.tab td { padding:3px 8px; font-size:11px; line-height:1.25; }
      </style>
      <div id="fa-pl">
        <div class="rs-page-head">
          <h1>Job P&amp;L</h1>
          <p>(formerly Financial Analysis) · per-job costs, commissions and deductions — for investigating which jobs and people drive the numbers ·
             <b>${RS.fmtN(rows.length)}</b> jobs in scope
             <span class="freshness">· commissions, helper salaries &amp; refunds are matched to jobs by job key</span></p>
        </div>
        <div class="fa-controls">
          <span class="lbl">Break down by</span>
          <select id="faDim">${Object.keys(DIMS).map(d => `<option ${d === dimBy ? "selected" : ""}>${d}</option>`).join("")}</select>
        </div>
        <div id="main"></div>
      </div>`;

    if (!rows.length) {
      document.getElementById("main").innerHTML =
        `<div class="panel" style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    // ---- P&L: dimension rows × line-item columns, with a grand-total footer.
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

    const buildTable = () => {
      const list = grouped();
      // grand-total row uses RS.M composites so it matches the rest of the portal.
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

    const renderTable = () => { document.getElementById("main").innerHTML = buildTable(); };
    renderTable();

    document.getElementById("faDim").onchange = e => { dimBy = e.target.value; renderTable(); };
  },
});
