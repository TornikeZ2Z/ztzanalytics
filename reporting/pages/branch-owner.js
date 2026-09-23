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
/* The branch-owner job mart (2026-09-17): the CL deck's job-cost model on his jobs. The cols list
   is a payload CONTRACT (projection is always on), so every column the money walk reads is named. */
if (window.RS && RS.DATASETS && !RS.DATASETS.mart_branch_owner_jobs) {
  RS.DATASETS.mart_branch_owner_jobs = {
    table: "mart_branch_owner_jobs",
    cols: ["Unique Key", "Date", "Request Joinkey", "Customer", "Foreman", "Branch Owner", "Company",
           "Moving Type",
           "Total Bill", "His Cut", "Estimator Cut", "Cash Rate Bill", "Sales Commission $",
           "Crew $", "Helpers 4-8 $", "Material $", "Packing Sold",
           "Rental Cost Est", "Owned Overhead Est", "Fuel Est", "Toll Est", "Car $", "Other Exp $",
           "Other Exp Net $", "Crew Extra $", "DC Stairs Salary", "DC Bulky Salary", "DC Junk Salary",
           "Carrier Paid $", "Delivery Crew $", "Delivery Other $", "Fuel Recorded", "Miles Basis",
           "Company Tip", "Discount Given", "Card Paid", "Card Base", "Refund $", "Has Contract", "Truck Ownership"],
    dateCols: { "Date": "Date" }, defaultDate: "Date",
  };
}

/* ===================== THE BRANCH-OWNER COST MODEL, ONCE =====================
   Two pages read it -- this one and Branch Owner Salary Comparison (bo-salary.js) -- and they must
   never be able to disagree, so it lives here and nowhere else.

   WHAT CREW IS (rebuilt 2026-09-23, his rulings):
     - `Crew $`: the foreman's total, the driver and helpers 1-3. `Forman Total $` IS rate x hours
       PLUS the packing commission (`Material $`) -- exact on 246 of his 313 jobs -- so the packing
       commission is already in it. The 2026-09-22 build added `Material $` on top, counting it
       twice ($32,601 in 2026, about 3.5 points of his bill); that "22.5% crew" and the -$3,282
       it produced were the error, not the 18.9% before it. Counted once now.
     - `Helpers 4-8 $`: the helpers `Crew $` never had ($1,959 in 2026).
     - `Crew Extra $`: stairs, bulky and junk pay from the digital contract. The closing lumps it
       into Other Expenses, so it MOVES from other job costs into crew -- never added twice.
     - long distance only: LD_OTHER_CREW of what is left of other expenses ("we should say that
       30% from this other expenses as crew salary"). Long hauls have no digital contract, so a
       share is the only way to see their crew pay. Salary Comparison lets you type another.
     - `Delivery Crew $`: our own crew DELIVERING his long hauls -- trip-sheet rows and delivery
       closings the job set never saw (audit 2026-09-23: a Regular closing pays one loading day,
       ~$488; the haul is paid elsewhere). His call: under the alternative "he pays our own
       delivery crew, we pay carriers".
   CARRIER FEES (`Carrier Paid $`, paid fees only -- his call) and the delivery legs' fuel, tolls
   and hotel (`Delivery Other $`) are costs WE carry under either deal, as recorded, no uplift.
   FUEL on a long haul is the closing's recorded fuel: no long-distance job has miles, so the
   miles estimate priced every haul at the average local distance ($1,546 vs $7,682 on Straight).
   Tips we paid, discounts and other job costs are three lines now (his ask), not one.

   THE 10% ON FUEL, TOLLS AND OTHER JOB COSTS STAYS IN THE MATHS; only its "+10%" wording left
   the labels (his pick 2026-09-23). Pay that moves into crew leaves the uplift behind: it is
   recorded pay, not an estimate.

   MARKETING is 10% of the bill and OURS (his call 2026-09-21: "add 10% as Marketing Expenditure
   right after Salespeople's commission") -- we buy the lead, he runs the job, so it never touches
   his cut. It is the last line of the cost stack, exactly where he asked for it.

   HIS ESTIMATOR PAY is its own line (2026-09-23). On a job where he holds two SP slots the
   larger is his branch-owner cut and the other is `Estimator Cut` (fct_closing). We pay it under
   either deal, so it is a cost we carry, never part of what the comparison moves. */
window.BO_ECON = (function () {
  const MAT_COGS = 0.15, COST_UPLIFT = 1.10, CARD_FEE = 0.035, MKT_PCT = 0.10, LD_OTHER_CREW = 0.30;
  const num = v => (window.RS && RS.num ? RS.num(v) : +v) || 0;
  const eS = (rs, f) => rs.reduce((a, r) => a + num(f(r)), 0);
  const isLD = r => r["Moving Type"] === "Regular Moving" || r["Moving Type"] === "Straight Moving";
  /* the 4th field marks a line drawn only when it holds money */
  const LINES = [
    ["crew", "Crew", "foreman (his packing commission included), driver and helpers; stairs, bulky and junk pay from the digital contract; our own crew delivering his long hauls; part of long-distance other expenses"],
    ["materials", "Packing materials", "15% of the packing sold"],
    ["truck", "Truck", "rental at $175 a job, or owned-truck insurance, parking and financing"],
    ["fuel", "Fuel", "miles \u00f7 7 mpg \u00d7 the WEX diesel price; on long distance, the fuel the closing recorded"],
    ["tolls", "Tolls", "our toll accounts spread over the miles that drive them"],
    ["tips", "Tips we paid", "company tips to the crew, as recorded on the closing"],
    ["discounts", "Discounts", "discounts given, as recorded on the closing"],
    ["other", "Other job costs", "car and other expenses on the closing, less the part that is crew pay"],
    ["carrier", "Carrier fees", "paid to carriers for delivering his Regular moves, as the long-distance sheet records them once paid \u2014 ours under either deal", true],
    ["legs", "Our delivery legs", "fuel, tolls, hotel and other costs of our own trucks delivering his long hauls, as recorded \u2014 ours under either deal", true],
    ["card", "Card processing", "3.5% of what customers paid by card"],
    ["claims", "Claims refunded", "refunds paid on these jobs"],
    ["sales", "Salespeople's commission", "the real salespeople on these jobs \u2014 not his cut"],
    ["estimator", "His estimator pay", "his other slot on jobs where he was also the estimator \u2014 paid under either deal, not his branch-owner cut", true],
    ["marketing", "Marketing expenditure", "10% of the bill \u2014 we buy the lead, he runs the job"],
  ];
  const pctOf = o => (o && o.ldPct != null ? o.ldPct : LD_OTHER_CREW);
  /* other expenses that are NOT the contract's crew pay. A mart built before 2026-09-23 has no
     `Other Exp Net $`; the bridge drops an unknown column without a word, and reading it as 0
     would make every other expense vanish from the cost stack -- so fall back to the whole. */
  const otherNet = r => (r["Other Exp Net $"] != null ? num(r["Other Exp Net $"]) : num(r["Other Exp $"]) - num(r["Crew Extra $"]));
  /* one job's crew, in its four sources: the closing, the contract's extras, the LD share and our
     own crew delivering a long haul */
  function crewParts(r, ldPct) {
    return { closing: num(r["Crew $"]) + num(r["Helpers 4-8 $"]), contract: num(r["Crew Extra $"]),
             ld: isLD(r) ? ldPct * otherNet(r) : 0, delivery: num(r["Delivery Crew $"]) };
  }
  const crewSum = p => p.closing + p.contract + p.ld + p.delivery;
  function crewOf(r, opts) { return crewSum(crewParts(r, pctOf(opts))); }
  function crewSplit(rs, opts) {
    const k = pctOf(opts), s = { closing: 0, contract: 0, ld: 0, delivery: 0, ldOther: 0 };
    rs.forEach(r => { const p = crewParts(r, k); s.closing += p.closing; s.contract += p.contract; s.ld += p.ld;
      s.delivery += p.delivery; if (isLD(r)) s.ldOther += otherNet(r); });
    return s;
  }
  /* a long haul has no miles, so its fuel is what the closing recorded (as recorded, no uplift);
     a mart that predates `Fuel Recorded` keeps the estimate rather than dropping fuel */
  const recordedFuel = r => isLD(r) && r["Fuel Recorded"] != null && r["Miles Basis"] !== "gps" && r["Miles Basis"] !== "contract";
  function walk(rs, opts) {
    const k = pctOf(opts);
    const bill = eS(rs, r => r["Total Bill"]), his = eS(rs, r => r["His Cut"]);
    let crew = 0, otherJob = 0, fuelEst = 0, fuelRec = 0;
    rs.forEach(r => { const p = crewParts(r, k); crew += crewSum(p);
      otherJob += num(r["Car $"]) + otherNet(r) - p.ld;
      if (recordedFuel(r)) fuelRec += num(r["Fuel Recorded"]); else fuelEst += num(r["Fuel Est"]); });
    const c = {
      crew,
      materials: MAT_COGS * eS(rs, r => r["Packing Sold"]),
      truck: eS(rs, r => r["Rental Cost Est"]) + eS(rs, r => r["Owned Overhead Est"]),
      fuel: COST_UPLIFT * fuelEst + fuelRec,
      tolls: COST_UPLIFT * eS(rs, r => r["Toll Est"]),
      tips: eS(rs, r => r["Company Tip"]),
      discounts: eS(rs, r => r["Discount Given"]),
      other: COST_UPLIFT * otherJob,
      carrier: eS(rs, r => r["Carrier Paid $"]),
      legs: eS(rs, r => r["Delivery Other $"]),
      card: CARD_FEE * (eS(rs, r => r["Card Base"]) || eS(rs, r => r["Card Paid"])),
      claims: eS(rs, r => r["Refund $"]),
      sales: eS(rs, r => r["Sales Commission $"]),
      estimator: eS(rs, r => r["Estimator Cut"]),
      marketing: MKT_PCT * bill,
    };
    const cost = Object.values(c).reduce((a, v) => a + v, 0);
    return { n: rs.length, bill, his, c, cost, ours: bill - cost - his };
  }
  /* the lines worth drawing for a walk: every line, except an optional one that holds nothing */
  function linesFor(W) { return LINES.filter(x => !x[3] || Math.abs(W.c[x[0]] || 0) >= 0.005); }
  /* THE ALTERNATIVE: he takes `share` of the bill and the crew comes out of it. We stop paying
     the crew and his cut, and still carry everything else. It is exactly zero-sum against today
     -- his gain is our loss to the dollar -- which is the check that nothing is invented. */
  /* a walk scaled by f: the money of a fraction of the same jobs, used when part of a job type
     is priced at another share (his long hauls that are really Straight) */
  function scaleW(W, f) {
    const c = {}; Object.keys(W.c).forEach(k => { c[k] = W.c[k] * f; });
    return { n: W.n * f, bill: W.bill * f, his: W.his * f, c, cost: W.cost * f, ours: W.ours * f };
  }
  function alt(rs, share) { return altW(walk(rs), share); }
  function altW(W, share) {
    const hisShare = share * W.bill, hisNet = hisShare - W.c.crew;
    const oursCost = W.cost - W.c.crew, ours = W.bill - hisShare - oursCost;
    return { W, share, hisShare, hisNet, oursCost, ours,
             even: W.bill ? (W.his + W.c.crew) / W.bill : null,
             hisDelta: hisNet - W.his, oursDelta: ours - W.ours };
  }
  /* THE BRANCH OWNER BEING READ (his ask 2026-09-24: "add branch owner filter too and have it as a
     single select on both"). One owner at a time, never "all": each page is one person's deal. The
     pick is shared by the two pages for the session, so the owner chosen on one is the owner shown
     on the other. The list is built from every row, not the date range, so an owner never drops out
     of the picker because a filter hid his jobs; the default is the owner with the most jobs. */
  let ownerPick = null;
  function ownersOf(rows) {
    const n = {};
    rows.forEach(r => { const o = r["Branch Owner"]; if (o != null && String(o).trim() !== "") n[o] = (n[o] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a] || a.localeCompare(b)).map(o => ({ v: o, l: o, n: n[o] }));
  }
  function owner(rows) {
    const list = ownersOf(rows);
    if (!list.some(o => o.v === ownerPick)) ownerPick = list.length ? list[0].v : null;
    return ownerPick;
  }
  function mountOwnerPick(host, rows) {
    if (!host || !window.RSC || !RSC.localSelect) return;
    RSC.localSelect(host, { label: "Branch owner", values: ownersOf(rows), value: owner(rows), required: true,
      onChange: v => { if (v && v !== ownerPick) { ownerPick = v; if (typeof renderPage === "function") renderPage(); } } });
  }
  return { MAT_COGS, COST_UPLIFT, CARD_FEE, MKT_PCT, LD_OTHER_CREW, LINES, eS, isLD, walk, alt, altW, scaleW,
           ownersOf, owner, mountOwnerPick,
           crewOf, crewSplit, linesFor };
})();

registerPage({
  id: "branch-owner",
  group: "financial",
  title: "Branch Owner",
  async render(host) {
    const num = RS.num, money = RS.money, moneyC = RS.moneyC || RS.money, fmtN = RS.fmtN;
    const pctS = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";
    const M = RS.M;
    // The kit's own loading state (.rs-loading) inside the kit's card. The only page-local
    // bit is the height: these placeholders stand where a 340px chartbox will land, so the
    // grid must not collapse and then jump when phase 2 arrives.
    const loadingCard = t => `<div class="panel" style="min-height:320px;display:grid;place-items:center">
      <div class="rs-loading"><b>${t}</b>Loading…</div></div>`;

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
      <div id="boOwnerPick" style="margin:0 0 12px"></div>
      <div class="rs-kpis" id="boKpis"><div class="rs-loading">Loading…</div></div>
      <div class="rs-kpis" id="boProfitKpis"></div>
      <div id="boMoney"></div>
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
    // one branch owner at a time -- the picker's list is every closing, the page is the date range
    const boAll = closingAll.filter(r => r["Record Source"] === "closing" && isBO(r));
    const owner = BO_ECON.owner(boAll);
    BO_ECON.mountOwnerPick(document.getElementById("boOwnerPick"), boAll);
    const scoped = closingRows.filter(r => isBO(r) && r["Branch Owner"] === owner);
    // "the rest" stays every job with NO branch owner, whoever is picked
    const rest = closingRows.filter(r => !isBO(r));

    if (!scoped.length) {
      host.innerHTML = head + `<div id="boOwnerPick" style="margin:0 0 12px"></div>` +
        `<div class="rs-loading">No jobs for ${RSC.esc(owner || "a branch owner")} in the current filter range.</div>`;
      BO_ECON.mountOwnerPick(document.getElementById("boOwnerPick"), boAll);
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
    // Every table on this page is RSC.table (`table.tab` in `.tabwrap`), NOT the kit's
    // .rs-tablewrap/.rs-table. That is deliberate: all seven carry a totals row, and only
    // table.tab styles a <tfoot> (sticky bottom, ink, top rule) and pins the first column.
    // Moving them to .rs-table would silently unstyle the totals — a regression, not a
    // migration. The shared component is the right place to close that gap, not this page.
    const detail = scoped.slice()
      .sort((a, b) => String(b["Date"] || "").localeCompare(String(a["Date"] || "")))
      .map(r => ({
        dt: r["Date"], cust: r["Customer"], co: r["Company"], req: r["Request #"],
        bill: num(r["Total Bill"]), cut: num(r["Branch Owner Cut"]), est: num(r["Estimator Cut"]),
        pctv: num(r["Total Bill"]) ? num(r["Branch Owner Cut"]) / num(r["Total Bill"]) : 0,
      }));
    /* HIS ESTIMATOR PAY, beside the cut and never inside it (2026-09-23): on a job where he holds
       two SP slots, the larger is his branch-owner cut and the other is paid to him as estimator.
       The column only appears when a job in range has it. */
    const totalEst = detail.reduce((a, r) => a + r.est, 0);
    const detailTable = RSC.table(
      [{ key: "dt", label: "Move Date" }, { key: "req", label: "Request #" },
       { key: "cust", label: "Customer" }, { key: "co", label: "Company" },
       { key: "bill", label: "Revenue", align: "r", fmt: money },
       { key: "pctv", label: "Cut %", align: "r", fmt: pctS },
       { key: "cut", label: "His Cut", align: "r", fmt: money }]
        .concat(totalEst > 0 ? [{ key: "est", label: "As estimator", align: "r", fmt: v => (v ? money(v) : "") }] : []),
      detail,
      { dt: "Total", bill: totalBill, cut: totalCut, pctv: avgPct, est: totalEst });
    document.getElementById("boDetail").innerHTML = `
      <div class="panel" style="margin-top:14px">
        <div class="panel-head"><span class="panel-title">Every branch-owner job (${fmtN(detail.length)})</span></div>
        <div class="tabwrap">${detailTable}</div>
      </div>`;

    // ================= WHERE THE MONEY WENT: his cut vs our profit (2026-09-17) =================
    /* His ask: "a similar profit comparison for Branch Owners -- his salary part on jobs he made vs our
       profit", on the CL deck's cost model so both partners read on one yardstick:
         crew        = crew pay on the closing (foreman incl. his packing commission, driver, helpers 1-8)
                       + stairs/bulky/junk pay from the contract + a share of LD other expenses (BO_ECON)
         materials   = 15% of packing sold (the modelled COGS; `Material $` is crew pay, not materials)
         truck       = rental at the $175 floor / owned-truck overhead, per job
         fuel, tolls = miles / 7 mpg x WEX diesel, tolls by route -- both +10%
         tips, discounts = as recorded; other job costs = car + other expenses not crew pay (+10%)
         card fee    = 3.5% of what was paid by card
         claims      = refunds paid on these jobs (all ours)
         salespeople = the REAL salespeople's commission on the job (every SP slot minus his cut)
       What is left after all of that and his cut is our profit. */
    try {
      if (!document.getElementById("boe-css")) {
        const st = document.createElement("style"); st.id = "boe-css";
        st.textContent = [
          ".boe-wrap{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);gap:14px;margin-top:14px}",
          "@media (max-width:1100px){.boe-wrap{grid-template-columns:1fr}}",
          ".boe-head{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;margin:4px 0 12px}",
          ".boe-big{display:flex;flex-direction:column}.boe-big b{font-size:26px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}.boe-big span{font-size:12px;color:var(--muted)}",
          ".boe-big.his b{color:var(--brand-d)}",
          ".boe-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:4px 0 6px;background:var(--line)}",
          ".boe-stack i{display:block;height:100%}",
          ".boe-key{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}.boe-key i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}",
          ".boe-rows{display:grid;grid-template-columns:minmax(150px,1.1fr) minmax(80px,1.4fr) 92px 58px;gap:6px 12px;align-items:center;font-size:13px}",
          ".boe-rows .l{color:var(--ink)}.boe-rows .l small{display:block;color:var(--faint);font-size:11px;line-height:1.3}",
          ".boe-rows .bar{height:10px;border-radius:5px;background:var(--line);position:relative;overflow:hidden}",
          ".boe-rows .bar i{position:absolute;top:0;bottom:0;border-radius:5px}",
          ".boe-rows .m{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}.boe-rows .p{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px}",
          ".boe-rows .tot{font-weight:800;padding-top:6px;border-top:1px solid var(--line)}",
        ].join("");
        document.head.appendChild(st);
      }
      const martAll = await RS.load("mart_branch_owner_jobs");
      const J = RS.filtered("mart_branch_owner_jobs", martAll.filter(r => r["Branch Owner"] === owner));
      const mount = document.getElementById("boMoney");
      if (!J.length) {
        mount.innerHTML = `<div class="panel" style="margin-top:14px"><div class="rs-loading">The cost breakdown has no branch-owner jobs in this range yet — it appears after the next data refresh.</div></div>`;
      } else {
        const walk = BO_ECON.walk;
        const W = walk(J), pc = v => W.bill ? pctS(v / W.bill) : "—";
        const INK = "#334155", LIME = "rgba(132,204,22,.85)", HIS = "#0f766e", GREY = "#94a3b8";
        const lines = BO_ECON.linesFor(W).map(([k, l, sub]) => [l, sub, W.c[k]]);
        const maxV = W.bill || 1;
        const row = (l, sub, v, col, cls) => `<div class="l${cls ? " " + cls : ""}">${l}${sub ? `<small>${sub}</small>` : ""}</div>
          <div class="bar${cls ? " " + cls : ""}"><i style="left:0;width:${Math.max(0, Math.min(100, v / maxV * 100)).toFixed(2)}%;background:${col}"></i></div>
          <div class="m${cls ? " " + cls : ""}">${money(v)}</div><div class="p${cls ? " " + cls : ""}">${pc(v)}</div>`;
        const perDollar = W.his > 0 ? W.ours / W.his : null;
        const byOwner = [...new Set(J.map(r => r["Branch Owner"]).filter(Boolean))];
        // his cut vs our profit, month by month
        const mm = {}; J.forEach(r => { const k = String(r.Date || "").slice(0, 7); if (k) (mm[k] = mm[k] || []).push(r); });
        const mRows = Object.keys(mm).sort().map(k => { const w = walk(mm[k]); return { k, jobs: w.n, bill: w.bill, cost: w.cost, his: w.his, ours: w.ours,
          hisP: w.bill ? w.his / w.bill : null, oursP: w.bill ? w.ours / w.bill : null, ratio: w.his > 0 ? w.ours / w.his : null }; });
        const x1 = v => v == null || !isFinite(v) ? "—" : "$" + v.toFixed(2);
        mount.innerHTML = `
          <div class="boe-wrap">
            <div class="panel">
              <div class="panel-head"><span class="panel-title">Where the money went — his cut vs our profit</span></div>
              <div class="boe-head">
                <div class="boe-big"><b>${money(W.bill)}</b><span>revenue · ${fmtN(W.n)} jobs${byOwner.length ? " · " + byOwner.join(", ") : ""}</span></div>
                <div class="boe-big his"><b>${money(W.his)}</b><span>his cut · ${pc(W.his)}</span></div>
                <div class="boe-big"><b>${money(W.ours)}</b><span>our profit · ${pc(W.ours)}</span></div>
                <div class="boe-big"><b>${x1(perDollar)}</b><span>we kept per $1 he earned</span></div>
              </div>
              <div class="boe-stack"><i style="width:${(W.cost / maxV * 100).toFixed(2)}%;background:${GREY}"></i><i style="width:${(Math.max(0, W.his) / maxV * 100).toFixed(2)}%;background:${HIS}"></i><i style="width:${(Math.max(0, W.ours) / maxV * 100).toFixed(2)}%;background:${LIME}"></i></div>
              <div class="boe-key"><span><i style="background:${GREY}"></i>cost to run the jobs ${pc(W.cost)}</span><span><i style="background:${HIS}"></i>his cut ${pc(W.his)}</span><span><i style="background:${LIME}"></i>our profit ${pc(W.ours)}</span></div>
              <div class="boe-rows" style="margin-top:16px">
                ${row("Revenue", "the final bill on his jobs", W.bill, INK, "tot")}
                ${lines.map(([l, sub, v]) => row(l, sub, v, GREY)).join("")}
                ${row("Cost to run the jobs", "", W.cost, GREY, "tot")}
                ${row("His cut", "the branch-owner salary on these jobs", W.his, HIS, "tot")}
                ${row("Our profit", "what is left for the company", W.ours, LIME, "tot")}
              </div>
              <p class="rs-hint" style="margin:12px 2px 0">Built on the CL Analysis deck's cost model, with crew counted once (the foreman's total already holds his packing commission), the contract's stairs, bulky and junk pay moved into crew, and ${Math.round(BO_ECON.LD_OTHER_CREW * 100)}% of long-distance other expenses counted as crew, and our own crew's delivery legs (trip sheet and delivery closings) added to it. Tips, discounts and other job costs come from the closing; carrier fees are what the long-distance sheet records as paid, and delivery legs are as recorded; truck, tolls and local fuel are estimated from our own books (${fmtN(J.filter(r => r["Has Contract"] === "Yes").length)} of ${fmtN(J.length)} jobs have a digital contract with the route), long-haul fuel is what the closing recorded. Marketing is charged at 10% of the bill, right after the salespeople's commission. Our profit is before overhead — office and management are not in it. Respects the date/company filter.
              ${typeof canSee !== "function" || canSee("bo-salary") ? `<a href="#page=bo-salary"><b>Branch Owner Salary Comparison →</b></a> puts this beside the share-of-the-bill alternative, and projects both into 2027.` : ""}</p>
            </div>
            <div id="boMoneyMonth"></div>
          </div>`;
        RSC.chartCard(document.getElementById("boMoneyMonth"), {
          title: "His cut vs our profit by month",
          key: "branch-owner-money-month",
          buildChart(canvas) {
            return new Chart(canvas, {
              type: "bar",
              data: { labels: mRows.map(r => r.k), datasets: [
                { label: "His cut", data: mRows.map(r => r.his), backgroundColor: HIS },
                { label: "Our profit", data: mRows.map(r => r.ours), backgroundColor: LIME },
              ] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" },
                tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.raw) } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => moneyC(v) } } } },
            });
          },
          buildTable() {
            return RSC.table(
              [{ key: "k", label: "Month" }, { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
               { key: "bill", label: "Revenue", align: "r", fmt: money }, { key: "cost", label: "Cost to run", align: "r", fmt: money },
               { key: "his", label: "His cut", align: "r", fmt: money }, { key: "hisP", label: "His %", align: "r", fmt: pctS },
               { key: "ours", label: "Our profit", align: "r", fmt: money }, { key: "oursP", label: "Our %", align: "r", fmt: pctS },
               { key: "ratio", label: "We kept per $1 of his", align: "r", fmt: x1 }],
              mRows,
              { k: "Total", jobs: W.n, bill: W.bill, cost: W.cost, his: W.his, hisP: W.bill ? W.his / W.bill : null, ours: W.ours, oursP: W.bill ? W.ours / W.bill : null, ratio: perDollar });
          },
        });
      }
    } catch (e) {
      console.error("branch-owner money walk:", e);
      const mount = document.getElementById("boMoney");
      if (mount) mount.innerHTML = `<div class="panel" style="margin-top:14px"><div class="rs-loading">The cost breakdown could not load — reload the page to try again.</div></div>`;
    }

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
      // his estimator slot (two-slot jobs, 2026-09-23) is his pay too, not a salesperson's
      const estCut = rs.reduce((a, r) => a + num(r["Estimator Cut"]), 0);
      const realSales = sales - boCut - estCut;   // real salesperson commission only
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
          `<p class="rs-hint" style="margin:6px 2px 0">Sales Comm. % is the real salesperson commission — Giorgi's branch-owner cut is excluded (it's the separate "Giorgi's Cut" column). Gross profit still subtracts his cut.</p>`;
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
            ? `<p class="rs-hint" style="margin:6px 2px 0">Showing top ${shownF.length} of ${fmtN(byForeman.length)} foremen — the rest are in "All others".</p>`
            : "");
      },
    });
  },
});
