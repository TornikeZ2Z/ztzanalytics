/* ADMIN page: Data Quality — flags warehouse rows that look wrong or unfinished
   for the CURRENT filter scope, so an admin can go correct them at the source sheet.
   Read-only by design: it only LISTS problems, it never edits anything.

   Each check is a plain-language "N rows to fix" count plus a drill-down table
   (capped at ~50 rows with an "N of M" note). Trip rows (Record Source = "trip")
   are appended trip financials, not real closing jobs, and legitimately carry no
   foreman / sales person / source — so they are EXCLUDED from the closing-based
   people/source checks to avoid false flags (matches source-identification.js). */
registerPage({
  id: "data-quality",
  group: "settings",
  title: "Data Quality",
  async render(host) {
    const [closingAll, moveboardAll, refundsAll, leadsAll, claimsAll] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("refunds"),
      RS.load("leads"), RS.load("claims")]);
    const closing = RS.filtered("closing", closingAll);
    const moveboard = RS.filtered("moveboard", moveboardAll);
    const refunds = RS.filtered("refunds", refundsAll);
    const leads = RS.filtered("leads", leadsAll);
    const claims = RS.filtered("claims", claimsAll);

    /* ---------------- shared predicates ---------------- */
    const isTrip = r => String(r["Record Source"] || "").trim().toLowerCase() === "trip";
    const closingJobs = closing.filter(r => !isTrip(r));   // real closing jobs only
    const blank = v => v == null || String(v).trim() === "";
    // Catch-all tokens that mean "not really filled in" (an unmapped / placeholder value).
    const PLACEHOLDER = new Set(["other", "unknown", "unmapped", "n/a", "na", "none",
      "tbd", "test", "-", "--", "?", ".", "null", "undefined", "xxx", "x"]);
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    const missing = v => blank(v) || PLACEHOLDER.has(norm(v));
    const showVal = v => blank(v) ? "(blank)" : String(v);
    const cKey = r => r["Request #"] || r["Unique Key"] || "—";   // closing job key

    /* ---------------- date helpers ---------------- */
    const today = new Date().toISOString().slice(0, 10);
    const curYear = new Date().getFullYear();
    const d10 = v => String(v == null ? "" : v).slice(0, 10);
    const validISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
    const badYear = s => { const y = +s.slice(0, 4); return y < 2019 || y > curYear + 1; };

    /* ---------------- 1. Foreman missing / "OTHER" (closing jobs) ---------------- */
    const foremanBad = closingJobs.filter(r => missing(r["Foreman"])).map(r => ({
      val: showVal(r["Foreman"]), key: cKey(r), date: r._d || "—",
      customer: r["Customer"] || "—", sales: r["Sales Person"] || "—",
    }));

    /* ---------------- 2. Sales person missing (closing + moveboard) ----------------
       Trip rows excluded (they legitimately have no sales person). Moveboard carries
       the sales owner in `Assigned`; closing in `Sales Person`. */
    const salesBad = [
      ...closingJobs.filter(r => missing(r["Sales Person"])).map(r => ({
        table: "Closing", val: showVal(r["Sales Person"]), key: cKey(r),
        date: r._d || "—", customer: r["Customer"] || "—",
      })),
      ...moveboard.filter(r => missing(r["Assigned"])).map(r => ({
        table: "Moveboard", val: showVal(r["Assigned"]), key: r["Job No"] || "—",
        date: r._d || "—", customer: r["Customer"] || "—",
      })),
    ];

    /* ---------------- 3. Lead source missing / unmapped (leads + closing) ---------------- */
    const sourceBad = [
      ...leads.filter(r => missing(r["Source"])).map(r => ({
        table: "Lead", val: showVal(r["Source"]), key: r["Request # From Moveboard"] || "—",
        date: r._d || "—", customer: r["Customer"] || "—",
      })),
      ...closingJobs.filter(r => missing(r["Source"])).map(r => ({
        table: "Closing", val: showVal(r["Source"]), key: cKey(r),
        date: r._d || "—", customer: r["Customer"] || "—",
      })),
    ];

    /* ---------------- 4. Bad dates (refunds + closings) ----------------
       NOTE on blank move dates: the global date filter drops rows with no date, so
       blank-move-date closings only appear when the Date range is cleared / wide. */
    const dateBad = [];
    refunds.forEach(r => {
      const rd = d10(r["Refund Date"]), md = d10(r["Move Date"]);
      if (validISO(rd) && rd > today) dateBad.push({
        problem: "Refund dated in the future", table: "Refund",
        key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
      if (validISO(rd) && validISO(md) && rd < md) dateBad.push({
        problem: "Refund dated before the move (" + md + ")", table: "Refund",
        key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
      if (validISO(rd) && badYear(rd)) dateBad.push({
        problem: "Refund date year looks wrong", table: "Refund",
        key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
    });
    closingJobs.forEach(r => {
      if (blank(r["Date"])) dateBad.push({
        problem: "Closing has no move date", table: "Closing",
        key: cKey(r), date: "(blank)", customer: r["Customer"] || "—" });
      const d = d10(r["Date"]);
      if (validISO(d) && badYear(d)) dateBad.push({
        problem: "Move date year looks wrong", table: "Closing",
        key: cKey(r), date: d, customer: r["Customer"] || "—" });
    });

    /* ---------------- 5. Blank Net Cash (closing) ----------------
       Truly missing (null / blank) only — a genuine $0 is NOT flagged (num() coerces
       blanks to 0, so we test the RAW value here to tell them apart). */
    const netCashBad = closingJobs.filter(r => blank(r["Net Cash"])).map(r => ({
      key: cKey(r), date: r._d || "—", customer: r["Customer"] || "—",
      bill: RS.money(RS.num(r["Total Bill"])),
    }));

    /* ---------------- 6. Unmapped claim Responsibility ---------------- */
    const respBad = claims.filter(r => missing(r["Responsibility"])).map(r => ({
      val: showVal(r["Responsibility"]), key: r["Request No"] || "—",
      date: r._d || "—", customer: r["Customer"] || "—", reason: r["Reason"] || "—",
    }));

    /* ---------------- check registry ---------------- */
    const checks = [
      { title: "Foreman missing or “OTHER”",
        desc: "Closing jobs with no foreman (blank or a catch-all like OTHER). Trip rows are excluded.",
        rows: foremanBad,
        cols: [{ key: "val", label: "Foreman" }, { key: "key", label: "Job / Request #" },
               { key: "date", label: "Move date" }, { key: "customer", label: "Customer" },
               { key: "sales", label: "Sales person" }] },
      { title: "Sales person missing",
        desc: "Closing jobs and moveboard leads with no sales person / assigned owner. Trip rows are excluded (they legitimately have none).",
        rows: salesBad,
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Sales person" },
               { key: "key", label: "Job / Lead #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }] },
      { title: "Lead source missing or unmapped",
        desc: "Leads and closing jobs with a blank source or a catch-all placeholder (OTHER, UNKNOWN, N/A, …). Trip rows are excluded.",
        rows: sourceBad,
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Source" },
               { key: "key", label: "Request #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }] },
      { title: "Bad dates",
        desc: "Refunds dated in the future or before their move, and move / refund dates whose year looks wrong (before 2019 or after next year). Blank move dates only show when the Date filter is cleared or wide.",
        rows: dateBad,
        cols: [{ key: "problem", label: "Problem" }, { key: "table", label: "Where" },
               { key: "key", label: "Request #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }] },
      { title: "Closing with no Net Cash",
        desc: "Closing jobs where Net Cash was left blank (a true $0 is not flagged). Trip rows are excluded.",
        rows: netCashBad,
        cols: [{ key: "key", label: "Job / Request #" }, { key: "date", label: "Move date" },
               { key: "customer", label: "Customer" }, { key: "bill", label: "Total Bill", align: "r" }] },
      { title: "Claim responsibility unmapped",
        desc: "Claims with a blank or placeholder Responsibility — can't be attributed to foreman / sales without it.",
        rows: respBad,
        cols: [{ key: "val", label: "Responsibility" }, { key: "key", label: "Request #" },
               { key: "date", label: "Claim date" }, { key: "customer", label: "Customer" },
               { key: "reason", label: "Reason" }] },
    ];

    const CAP = 50;
    const totalIssues = checks.reduce((a, c) => a + c.rows.length, 0);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Data Quality</h1>
        <p>Rows that look wrong or unfinished for the current filters — fix them at the
           source sheet. <b>${RS.fmtN(totalIssues)}</b> rows flagged in scope.
           <span class="freshness">· read-only · this page lists problems, it never edits data</span></p>
      </div>
      <div class="rs-kpis" id="dqKpis"></div>
      <div id="dqChecks"></div>`;

    RSC.kpis(document.getElementById("dqKpis"), checks.map(c => ({
      label: c.title, value: RS.fmtN(c.rows.length), sub: "rows to fix" })));

    const cont = document.getElementById("dqChecks");
    checks.forEach(c => {
      const n = c.rows.length;
      const panel = RSC.el("div", "panel");
      let inner;
      if (!n) {
        inner = `<div style="padding:14px;color:var(--brand);font-size:13px">✓ Nothing to fix for this check in the current scope.</div>`;
      } else {
        const shown = c.rows.slice(0, CAP);
        const note = n > CAP
          ? `showing ${CAP} of ${RS.fmtN(n)} · narrow the filters to see the rest`
          : `${RS.fmtN(n)} total`;
        inner = RSC.table(c.cols, shown) +
          `<div style="color:var(--muted);font-size:12px;padding:6px 2px">${note}</div>`;
      }
      panel.innerHTML =
        `<div class="panel-head"><span class="panel-title">${RSC.esc(c.title)}</span>
           <span class="spacer"></span>
           <span class="rs-ctl"><span class="lbl">${RS.fmtN(n)} rows to fix</span></span></div>
         <div style="padding:0 14px 6px;color:var(--muted);font-size:12.5px">${RSC.esc(c.desc)}</div>
         <div class="tabwrap">${inner}</div>`;
      cont.appendChild(panel);
    });
  },
});
