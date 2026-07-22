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
      { key: "bill",   label: "Revenue", fmt: RS.money, grp: rs => M["Total Bill"].fn(rs) },
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
      { key: "op",     label: "Gross Profit", fmt: RS.money },
      { key: "opm",    label: "Gross Margin", fmt: RS.fmtPct },
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

    // ---- redesigned P&L (Tornike 2026-07-13: the bare compact table was "very ugly").
    // KPI header + segmented dimension picker + banded two-tier table with styled results.
    host.innerHTML = `
      <style>
        #fa-pl .fa-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        #fa-pl .fa-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:13px;font-weight:700;
          font-family:inherit;padding:7px 14px;border-radius:8px}
        #fa-pl .fa-seg button.on{background:var(--brand);color:#fff}
        #fa-pl .fa-kpis{display:flex;gap:9px;overflow-x:auto;padding:10px 0 12px;scrollbar-width:thin}
        #fa-pl .fa-kpi{flex:0 0 auto;min-width:135px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
        #fa-pl .fa-kpi b{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.1;font-variant-numeric:tabular-nums}
        #fa-pl .fa-kpi span{display:block;font-size:10.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:700;margin-top:4px}
        #fa-pl .fa-kpi.gp b{color:var(--brand)}
        #fa-pl .fa-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:13px;background:var(--panel)}
        #fa-pl table.fa2{border-collapse:collapse;width:100%;font-size:12.5px}
        #fa-pl .fa2 th,#fa-pl .fa2 td{padding:8px 11px;white-space:nowrap;text-align:right;font-variant-numeric:tabular-nums;border-bottom:1px solid var(--line)}
        #fa-pl .fa2 th:first-child,#fa-pl .fa2 td:first-child{text-align:left;position:sticky;left:0;background:var(--panel);font-weight:700;z-index:1}
        #fa-pl .fa2 thead .band th{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);
          border-bottom:0;padding:9px 11px 2px;text-align:center;border-left:1px solid var(--line)}
        #fa-pl .fa2 thead .band th:first-child{border-left:0}
        #fa-pl .fa2 thead .cols th{font-size:10.5px;font-weight:750;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);
          border-bottom:1px solid var(--line-2);padding-top:2px}
        #fa-pl .fa2 tbody tr:nth-child(even) td{background:color-mix(in srgb, var(--panel-2) 45%, transparent)}
        #fa-pl .fa2 tbody tr:hover td{background:var(--panel-2)}
        #fa-pl .fa2 td.sep,#fa-pl .fa2 th.sep{border-left:1px solid var(--line)}
        #fa-pl .fa2 td.gp{font-weight:800}
        #fa-pl .fa2 td.neg{color:#e5484d}
        #fa-pl .fa2 tfoot td{font-weight:800;color:var(--ink);border-top:2px solid var(--line-2);border-bottom:0;background:var(--panel-2)}
        #fa-pl .fa2 tfoot td:first-child{background:var(--panel-2)}
        #fa-pl .fa-pill{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px}
        #fa-pl .m-good{background:rgba(22,163,74,.15);color:#15803d}
        #fa-pl .m-mid{background:rgba(217,119,6,.15);color:#b45309}
        #fa-pl .m-bad{background:rgba(220,38,38,.14);color:#e5484d}
        body.rs-app.light #fa-pl .m-good{color:#15803d} body.rs-app.light #fa-pl .m-bad{color:#b91c1c}
      </style>
      <div id="fa-pl">
        <div class="rs-page-head">
          <h1>Job P&amp;L</h1>
          <p>Revenue → direct costs → <b>Gross Profit</b>, sliced by move type, size or month ·
             <b>${RS.fmtN(rows.length)}</b> jobs in scope
             <span class="freshness">· commissions, helper salaries &amp; refunds matched to jobs by job key</span></p>
        </div>
        <div class="fa-kpis" id="faKpis"></div>
        <div style="display:flex;align-items:center;gap:10px;margin:0 0 12px">
          <span style="color:var(--muted);font-size:12.5px;font-weight:600">Break down by</span>
          <div class="fa-seg" id="faSeg">${Object.keys(DIMS).map(d =>
            `<button type="button" data-d="${d}" class="${d === dimBy ? "on" : ""}">${d}</button>`).join("")}</div>
        </div>
        <div class="fa-wrap"><div id="main"></div></div>
      </div>`;

    if (!rows.length) {
      document.getElementById("main").innerHTML =
        `<div style="padding:22px;color:var(--muted)">No data for the current filters.</div>`;
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

    const money = RS.money, esc = RSC.esc;
    const marginPill = v => {
      if (v == null || isNaN(v)) return "—";
      const cls = v >= 0.6 ? "m-good" : v >= 0.45 ? "m-mid" : "m-bad";
      return `<span class="fa-pill ${cls}">${RS.fmtPct(v)}</span>`;
    };
    const m$ = (v, extra) => `<td class="${(v < 0 ? "neg " : "") + (extra || "")}">${v == null || isNaN(v) ? "—" : money(v)}</td>`;

    const renderAll = () => {
      const list = grouped();
      // grand-total row uses RS.M composites so it matches the rest of the portal.
      const tot = rowOf(rows);
      tot.op  = M["Operational Profit by Formula"].fn(rows);   // registry keys keep PBI names; label = Gross
      tot.opm = M["Operational Profit Margin"].fn(rows);
      tot.scm = M["Sales Commission Margin"].fn(rows);
      const costsOf = c => (c.forman + c.driver + c.helper + c.sales - c.deduct) +
                           (c.car + c.fuel + c.hotel + c.other + c.toll + c.truck + c.refund);

      document.getElementById("faKpis").innerHTML = [
        { v: RS.fmtN(tot.jobs), l: "Jobs" },
        { v: RS.moneyC ? RS.moneyC(tot.bill) : money(tot.bill), l: "Revenue" },
        { v: RS.moneyC ? RS.moneyC(costsOf(tot)) : money(costsOf(tot)), l: "Direct costs" },
        { v: RS.moneyC ? RS.moneyC(tot.op) : money(tot.op), l: "Gross Profit", gp: 1 },
        { v: RS.fmtPct(tot.opm), l: "Gross Margin", gp: 1 },
      ].map(k => `<div class="fa-kpi${k.gp ? " gp" : ""}"><b>${k.v}</b><span>${k.l}</span></div>`).join("");

      const bandRow = `<tr class="band"><th></th><th colspan="2">Volume</th><th colspan="4" class="sep">Salaries &amp; commission</th>
        <th colspan="6" class="sep">Job expenses</th><th class="sep">Refunds</th><th colspan="3" class="sep">Result</th></tr>`;
      const colRow = `<tr class="cols"><th>${esc(dimBy)}</th><th>Jobs</th><th>Revenue</th>
        <th class="sep">Foreman</th><th>Driver</th><th>Helper</th><th>Sales comm.</th>
        <th class="sep">Car</th><th>Fuel</th><th>Hotel</th><th>Other</th><th>Tolls</th><th>Truck</th>
        <th class="sep">Refunds</th><th class="sep">Gross Profit</th><th>Margin</th><th>Comm. %</th></tr>`;
      const rowHtml = c => `<tr><td>${esc(c.k)}</td><td>${RS.fmtN(c.jobs)}</td><td><b>${money(c.bill)}</b></td>
        ${m$(c.forman, "sep")}${m$(c.driver)}${m$(c.helper)}${m$(c.sales)}
        ${m$(c.car, "sep")}${m$(c.fuel)}${m$(c.hotel)}${m$(c.other)}${m$(c.toll)}${m$(c.truck)}
        ${m$(c.refund, "sep")}
        <td class="gp sep" style="color:${c.op >= 0 ? "var(--brand)" : "#e5484d"}">${money(c.op)}</td>
        <td>${marginPill(c.opm)}</td><td>${c.scm == null ? "—" : RS.fmtPct(c.scm)}</td></tr>`;
      const foot = `<tr><td>Total</td><td>${RS.fmtN(tot.jobs)}</td><td>${money(tot.bill)}</td>
        ${m$(tot.forman, "sep")}${m$(tot.driver)}${m$(tot.helper)}${m$(tot.sales)}
        ${m$(tot.car, "sep")}${m$(tot.fuel)}${m$(tot.hotel)}${m$(tot.other)}${m$(tot.toll)}${m$(tot.truck)}
        ${m$(tot.refund, "sep")}
        <td class="gp sep" style="color:var(--brand)">${money(tot.op)}</td>
        <td>${marginPill(tot.opm)}</td><td>${tot.scm == null ? "—" : RS.fmtPct(tot.scm)}</td></tr>`;
      document.getElementById("main").innerHTML =
        `<table class="fa2"><thead>${bandRow}${colRow}</thead><tbody>${list.map(rowHtml).join("")}</tbody><tfoot>${foot}</tfoot></table>`;
    };
    renderAll();

    document.querySelectorAll("#faSeg button").forEach(b => b.onclick = () => {
      dimBy = b.dataset.d;
      document.querySelectorAll("#faSeg button").forEach(x => x.classList.toggle("on", x.dataset.d === dimBy));
      renderAll();
    });
  },
});
