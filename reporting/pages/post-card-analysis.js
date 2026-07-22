/* Sales page: Post Card Analysis — source-level marketing-ROI + P&L.
   Faithful replication of the PBI "Main Reporting System" page 'Post Card Analysis'
   (section 'Post Card Analysis'): THREE tableEx visuals side by side, all grouped by
   Source Translator.Source and sliced by Source / Date / Company. The PBI tables:
     (1) 'Expenses Data'      = Advertisement Expense by Source (Advertising Card Expenses)
     (2) 'CRM / Moveboard Data' = leads funnel by Source — Total Leads by Created Date,
         Qualified Leads by Created Date, Confirmed Leads by Booked Date, Dead Leads,
         Booking Rate (Moveboard)
     (3) 'Financial Data'     = the P&L block by Source — Total Jobs, Total Bill, the
         salary/expense lines, Amount Deducted…, Total Refunds, Operational Profit by
         Formula, Operational Profit Margin, Sales Commission Margin (closing + salary/
         refund sub-datasets).
   All three are joined on the SAME Source key (Source Translator.Source) — the client-side
   equivalent of the PBI Source relationship — using the ads-analysis.js norm() pattern so
   the three tables line up row-for-row on Source.

   DATE-RELATIONSHIP NOTE (USERELATIONSHIP replication):
   - moveboard default date = Create Date. So "…by Created Date" measures == the base
     leads measures evaluated on the Create-Date-filtered moveboard rows (RS.filtered
     default). "Confirmed Leads by Booked Date" instead slices the date range on
     Booked Date → RS.filtered("moveboard", …, {dateColumn:"Booked Date"}), then keeps
     Status Category == "Confirmed" (Moveboard Status Translator Category = "Confirmed").
   - Booking Rate uses the PBI SWITCH: Confirmed>Qualified → 1; both 0 → blank;
     Qualified≠0 & Confirmed=0 → 0; else Confirmed/Qualified.

   FINANCIAL PER-SOURCE NOTE:
   The Operational Profit build-up sums measures living on DIFFERENT datasets. closing
   carries Source directly; helper/sales salaries link to closing by Unique Key (no Source
   column) so they're scoped to a source via Unique-Key membership in that source's closing
   rows; refunds carry Source directly. Known residuals (linked trips, the Amount Deducted…
   RELATED factor) are the same ones flagged in rs-core data_gaps — inherited here, not
   re-introduced. */
registerPage({
  id: "post-card-analysis",
  group: "sales",
  title: "Post Card Analysis",
  async render(host) {
    const [cardAll, mbAll, closingAll, helperAll, salesAll, refundAll] = await Promise.all([
      RS.load("card_expenses"), RS.load("moveboard"), RS.load("closing"),
      RS.load("helper_salaries"), RS.load("sales_salaries"), RS.load("refunds")]);
    const M = RS.M;

    // Global filter scope applied to every dataset (Source / Date / Company slicers).
    const cards   = RS.filtered("card_expenses", cardAll);
    const mb      = RS.filtered("moveboard", mbAll);                                  // Create Date
    const mbBooked = RS.filtered("moveboard", mbAll, { dateColumn: "Booked Date" });  // Booked Date
    const closing = RS.filtered("closing", closingAll);
    const helper  = RS.filtered("helper_salaries", helperAll);
    const sales   = RS.filtered("sales_salaries", salesAll);
    const refunds = RS.filtered("refunds", refundAll);

    const norm = v => String(v == null ? "" : v).trim().toLowerCase();

    // ---- Source universe: every Source seen across the three source-bearing streams
    // (advertising card expenses, moveboard leads, closings). display casing kept.
    const adRows = cards.filter(r => RS.num(r["Is Advertising"]) === 1);
    const srcDisp = new Map();                     // norm key → display casing
    const seeSrc = v => { const k = norm(v); if (k && !srcDisp.has(k)) srcDisp.set(k, String(v).trim()); };
    // this page is about POST CARDS specifically — the general Source Overview tab covers
    // every other channel. Keep only post-card sources (the per-state campaign splits).
    const isPostCard = v => /post\s*card/i.test(String(v == null ? "" : v));
    adRows.forEach(r => { if (isPostCard(r.Source)) seeSrc(r.Source); });
    mb.forEach(r => { if (isPostCard(r.Source)) seeSrc(r.Source); });
    mbBooked.forEach(r => { if (isPostCard(r.Source)) seeSrc(r.Source); });
    closing.forEach(r => { if (isPostCard(r.Source)) seeSrc(r.Source); });

    // ---- empty state
    if (!srcDisp.size) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Post Card Analysis</h1>
          <p>Source-level marketing spend, lead funnel and P&amp;L</p>
        </div>
        <div class="panel" style="padding:16px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    /* ---- pre-bucket every stream by normalized Source (one pass each) ---- */
    const bucket = (rows, keyFn) => {
      const g = {};
      rows.forEach(r => { const k = norm(keyFn(r)); if (!k) return; (g[k] = g[k] || []).push(r); });
      return g;
    };
    const adBySrc      = bucket(adRows,   r => r.Source);
    const mbBySrc      = bucket(mb,       r => r.Source);   // Created-Date scope
    const mbBookBySrc  = bucket(mbBooked, r => r.Source);   // Booked-Date scope
    const closBySrc    = bucket(closing,  r => r.Source);
    const refundBySrc  = bucket(refunds,  r => r.Source);

    // helper/sales salaries have NO Source — scope them to a source via the Unique Keys
    // of that source's closing rows (the PBI closing→salaries relationship).
    const helperByKey = {}, salesByKey = {};
    helper.forEach(r => { const k = r["Unique Key"]; if (k != null) (helperByKey[k] = helperByKey[k] || []).push(r); });
    sales.forEach(r => { const k = r["Unique Key"]; if (k != null) (salesByKey[k] = salesByKey[k] || []).push(r); });
    const salaryRowsForClosing = (clRows, byKey) => {
      const out = [];
      clRows.forEach(r => { const k = r["Unique Key"]; if (k != null && byKey[k]) out.push(...byKey[k]); });
      return out;
    };

    /* ---- Booking Rate: the canonical shared helper (exact PBI SWITCH).
       RS.bookingRate(createdRows, bookedRows) computes Qualified (non-Bad-Lead, by
       Create Date) and Confirmed (by Booked Date) itself — identical row scoping to
       the local helper this page used to carry, so the numbers do not move. ---- */

    /* ---- CRM / Moveboard measures per source (USERELATIONSHIP replication) ---- */
    const crmForSource = (k) => {
      const created = mbBySrc[k] || [];        // Created-Date scope
      const booked  = mbBookBySrc[k] || [];    // Booked-Date scope
      const totalLeads = M["Total Leads"].fn(created);                      // Total Leads by Created Date
      const dead = M["Dead Leads"].fn(created);                             // Dead Leads (Created-Date)
      const qualified = totalLeads - dead;                                  // Qualified Leads by Created Date = Total - Dead
      const confirmed = M["Confirmed Leads"].fn(booked);                    // Confirmed Leads by Booked Date
      return { totalLeads, qualified, dead, confirmed, rate: RS.bookingRate(created, booked) };
    };

    /* ---- Financial (P&L) measures per source ---- */
    // Per-source Operational Profit build-up. closing measures on the source's closing
    // rows; Helper/Sales salaries via Unique-Key membership; Total Refunds by source.
    // Mirrors rs-core "Operational Profit by Formula" but source-scoped instead of global.
    const finForSource = (k) => {
      const cl = closBySrc[k] || [];
      const hp = salaryRowsForClosing(cl, helperByKey);
      const sp = salaryRowsForClosing(cl, salesByKey);
      const rf = refundBySrc[k] || [];

      const totalBill = M["Total Bill"].fn(cl);
      const forman = M["Forman Salary"].fn(cl);
      const driver = M["Driver Salary"].fn(cl);
      const helperSal = M["Helper Salary"].fn(hp);
      const salesComm = M["Sales Commission"].fn(sp);
      // Amount Deducted From Sales Person Normalized For Sales — 0 in rs-core (known gap).
      const deducted = M["Amount Deducted From Sales Person Normalized For Sales"].fn(sp);
      const car = M["Car Expense"].fn(cl), fuel = M["Fuel Expense"].fn(cl);
      const hotel = M["Hotel Expense"].fn(cl), toll = M["Toll Expense"].fn(cl);
      const truck = M["Truck Expense"].fn(cl), other = M["Other Expenses"].fn(cl);
      const refund = M["Total Refunds"].fn(rf);

      const salaries = forman + driver + helperSal + salesComm - deducted;
      const expenses = car + fuel + hotel + toll + truck + other + refund;
      const opProfit = totalBill - salaries - expenses;
      return {
        jobs: cl.length, totalBill, forman, driver, helper: helperSal, salesComm,
        car, fuel, hotel, other, toll, truck, deducted, refund, opProfit,
        opMargin: totalBill ? opProfit / totalBill : null,
        commMargin: totalBill ? salesComm / totalBill : null,
      };
    };

    /* ---- assemble the aligned per-source rows (all three tables share this order) ---- */
    const srcRows = [...srcDisp].map(([k, disp]) => {
      const adSpend = (adBySrc[k] || []).reduce((a, r) => a + RS.num(r.Amount), 0);
      return { k, disp, adSpend, crm: crmForSource(k), fin: finForSource(k) };
    }).sort((a, b) => (b.fin.totalBill || 0) - (a.fin.totalBill || 0));

    // grand totals (each measure summed over the source rows — same scope as the tables)
    const T = {
      adSpend: srcRows.reduce((a, x) => a + x.adSpend, 0),
      totalLeads: srcRows.reduce((a, x) => a + x.crm.totalLeads, 0),
      qualified: srcRows.reduce((a, x) => a + x.crm.qualified, 0),
      dead: srcRows.reduce((a, x) => a + x.crm.dead, 0),
      confirmed: srcRows.reduce((a, x) => a + x.crm.confirmed, 0),
      jobs: srcRows.reduce((a, x) => a + x.fin.jobs, 0),
      totalBill: srcRows.reduce((a, x) => a + x.fin.totalBill, 0),
      forman: srcRows.reduce((a, x) => a + x.fin.forman, 0),
      driver: srcRows.reduce((a, x) => a + x.fin.driver, 0),
      helper: srcRows.reduce((a, x) => a + x.fin.helper, 0),
      salesComm: srcRows.reduce((a, x) => a + x.fin.salesComm, 0),
      car: srcRows.reduce((a, x) => a + x.fin.car, 0),
      fuel: srcRows.reduce((a, x) => a + x.fin.fuel, 0),
      hotel: srcRows.reduce((a, x) => a + x.fin.hotel, 0),
      other: srcRows.reduce((a, x) => a + x.fin.other, 0),
      toll: srcRows.reduce((a, x) => a + x.fin.toll, 0),
      truck: srcRows.reduce((a, x) => a + x.fin.truck, 0),
      deducted: srcRows.reduce((a, x) => a + x.fin.deducted, 0),
      refund: srcRows.reduce((a, x) => a + x.fin.refund, 0),
      opProfit: srcRows.reduce((a, x) => a + x.fin.opProfit, 0),
    };
    // total Booking Rate over the union of the (disjoint) per-source buckets —
    // same counts as summing per-source, routed through the canonical helper.
    T.rate = RS.bookingRate(
      [...srcDisp.keys()].flatMap(k => mbBySrc[k] || []),
      [...srcDisp.keys()].flatMap(k => mbBookBySrc[k] || []));
    T.opMargin = T.totalBill ? T.opProfit / T.totalBill : null;
    T.commMargin = T.totalBill ? T.salesComm / T.totalBill : null;

    // null-safe cell formatters (RS.money/RS.fmtN render null as "$0"/"0")
    const moneyNS = v => v == null ? "—" : RS.money(v);
    const intNS = v => v == null ? "—" : RS.fmtN(v);
    const pctNS = v => v == null ? "—" : RS.fmtPct(v);
    const profitCell = v => v == null ? "—" :
      `<span class="${v >= 0 ? "pos" : "neg"}">${RS.money(v)}</span>`;

    host.innerHTML = `
      <div id="pcaWrap">
      <style>
        #pcaWrap .pos{color:var(--brand)}#pcaWrap .neg{color:var(--red)}
        #pcaWrap .pca-tables{display:grid;grid-template-columns:1fr;gap:16px}
        @media(min-width:1100px){#pcaWrap .pca-tables{grid-template-columns:1fr 1fr}}
        #pcaWrap .pca-fin{grid-column:1/-1}
        #pcaWrap .pca-scroll{overflow-x:auto}
        #pcaWrap .panel-title .cnt{color:var(--muted);font-weight:400;font-size:12px;margin-left:6px}
      </style>
      <div class="rs-page-head">
        <h1>Post Card Analysis</h1>
        <p>Source-level marketing spend, lead funnel and P&amp;L ·
           <b>${RS.fmtN(srcDisp.size)}</b> sources in scope
           <span class="freshness">· expenses / CRM / financials joined on Source</span></p>
      </div>
      <div class="rs-kpis" id="pcaKpis"></div>
      <div class="pca-tables">
        <div class="panel" id="pcaExpenses"></div>
        <div class="panel" id="pcaCrm"></div>
        <div class="panel pca-fin" id="pcaFin"></div>
      </div>
      </div>`;

    /* ---- KPI band: the three headline totals ---- */
    RSC.kpis(document.getElementById("pcaKpis"), [
      { label: "Advertisement Expense", value: RS.moneyC(T.adSpend),
        sub: "advertising card expenses in scope · by Source" },
      { label: "Total Leads", value: RS.fmtN(T.totalLeads),
        sub: "Moveboard requests · by created date" },
      { label: "Booking Rate", value: pctNS(T.rate),
        sub: "confirmed (booked date) / qualified (created date)" },
      { label: "Revenue", value: RS.moneyC(T.totalBill),
        sub: RS.fmtN(T.jobs) + " jobs · closings + appended trips" },
      { label: "Gross Profit", value: RS.moneyC(T.opProfit),
        sub: "margin " + pctNS(T.opMargin) + " · revenue − salaries − expenses − refunds, by Source" },
    ]);

    /* ======================= (1) Expenses Data ======================= */
    const expTbl = RSC.table(
      [{ key: "s", label: "Source" },
       { key: "ad", label: "Advertisement Expense", fmt: RS.money }],
      srcRows.map(x => ({ s: x.disp, ad: x.adSpend })),
      { s: "Total", ad: T.adSpend });
    document.getElementById("pcaExpenses").innerHTML =
      `<div class="panel-head"><span class="panel-title">Postcard Spend by Campaign` +
      `<span class="cnt">${RS.fmtN(srcRows.length)} sources</span></span></div>` +
      `<div class="pca-scroll">${expTbl}</div>`;

    /* ======================= (2) CRM / Moveboard Data ======================= */
    const crmTbl = RSC.table(
      [{ key: "s", label: "Source" },
       { key: "tl", label: "Total Leads", fmt: RS.fmtN },
       { key: "ql", label: "Qualified Leads", fmt: RS.fmtN },
       { key: "cf", label: "Confirmed Leads", fmt: RS.fmtN },
       { key: "dl", label: "Bad Leads", fmt: RS.fmtN },
       { key: "br", label: "Booking Rate", fmt: pctNS }],
      srcRows.map(x => ({ s: x.disp, tl: x.crm.totalLeads, ql: x.crm.qualified,
        cf: x.crm.confirmed, dl: x.crm.dead, br: x.crm.rate })),
      { s: "Total", tl: T.totalLeads, ql: T.qualified, cf: T.confirmed, dl: T.dead, br: T.rate });
    document.getElementById("pcaCrm").innerHTML =
      `<div class="panel-head"><span class="panel-title">Leads by Campaign` +
      `<span class="cnt">leads by created / booked date</span></span></div>` +
      `<div class="pca-scroll">${crmTbl}</div>`;

    /* ======================= (3) Financial Data ======================= */
    // Full P&L block by Source, in the PBI column order.
    const finTbl = RSC.table(
      [{ key: "s", label: "Source" },
       { key: "jobs", label: "Total Jobs", fmt: RS.fmtN },
       { key: "bill", label: "Revenue", fmt: RS.money },
       { key: "forman", label: "Foreman Salary", fmt: RS.money },
       { key: "driver", label: "Driver Salary", fmt: RS.money },
       { key: "helper", label: "Helper Salary", fmt: RS.money },
       { key: "comm", label: "Sales Commission", fmt: RS.money },
       { key: "car", label: "Car Expense", fmt: RS.money },
       { key: "fuel", label: "Fuel Expense", fmt: RS.money },
       { key: "hotel", label: "Hotel Expense", fmt: RS.money },
       { key: "other", label: "Other Expenses", fmt: RS.money },
       { key: "toll", label: "Toll Expense", fmt: RS.money },
       { key: "truck", label: "Truck Expense", fmt: RS.money },
       // this measure is a known 0 gap — render "n/a" so users can tell
       // missing-data apart from a true zero (scan item C22).
       { key: "ded", label: "Amount Deducted (Sales)",
         fmt: () => `<span style="color:var(--muted)" title="not yet in the data">n/a</span>` },
       { key: "refund", label: "Total Refunds", fmt: RS.money },
       { key: "op", label: "Gross Profit", fmt: profitCell },
       { key: "opm", label: "Gross Margin", fmt: pctNS },
       { key: "cm", label: "Sales Commission Margin", fmt: pctNS }],
      srcRows.map(x => ({ s: x.disp, jobs: x.fin.jobs, bill: x.fin.totalBill,
        forman: x.fin.forman, driver: x.fin.driver, helper: x.fin.helper, comm: x.fin.salesComm,
        car: x.fin.car, fuel: x.fin.fuel, hotel: x.fin.hotel, other: x.fin.other,
        toll: x.fin.toll, truck: x.fin.truck, ded: x.fin.deducted, refund: x.fin.refund,
        op: x.fin.opProfit, opm: x.fin.opMargin, cm: x.fin.commMargin })),
      { s: "Total", jobs: T.jobs, bill: T.totalBill, forman: T.forman, driver: T.driver,
        helper: T.helper, comm: T.salesComm, car: T.car, fuel: T.fuel, hotel: T.hotel,
        other: T.other, toll: T.toll, truck: T.truck, ded: T.deducted, refund: T.refund,
        op: T.opProfit, opm: T.opMargin, cm: T.commMargin });
    // (System detail for maintainers: Operational Profit follows the PBI formula
    // Total Bill − salaries − expenses − refunds; the two known residuals are the
    // linked-trip expenses in fct_trips — not served client-side — and the
    // "Amount Deducted From Sales Person Normalized For Sales" RELATED factor, 0.)
    document.getElementById("pcaFin").innerHTML =
      `<div class="panel-head"><span class="panel-title">Profit &amp; Loss by Campaign` +
      `<span class="cnt">revenue and costs by Source</span></span></div>` +
      `<div class="pca-scroll">${finTbl}</div>` +
      `<div style="color:var(--muted);font-size:11px;padding:6px 2px">` +
      `How it's counted · Profit here excludes two small cost items not yet in the data ` +
      `(trip-linked expenses and salesperson deductions), so per-source profit is slightly overstated.</div>`;
  },
});
