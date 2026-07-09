/* ADMIN page: Data Quality — flags warehouse rows that look wrong or unfinished
   for the CURRENT filter scope, so an admin can go correct them at the source sheet.
   Read-only by design: it only LISTS problems, it never edits anything.

   BACKGROUND LOADING: the page paints its shell immediately, then computes each
   check off the main thread (a tick() yield between every heavy step) so the tab
   never freezes and each card fills in as it finishes. Results are cached per
   filter signature, so revisiting the page (same filters) is instant. Trip rows
   (Record Source = "trip") are excluded from the closing-based people/source
   checks — they legitimately carry no foreman / sales person / source. */

const DQ_CACHE = {};   // filter-signature -> computed checks (rows already built)

function _dqSig() {
  const s = RS.state;
  return JSON.stringify([s.dateFrom, s.dateTo, s.dayFrom, s.dayTo,
    Object.entries(s.multi || {}).map(([k, set]) => [k, set && set.size ? [...set].sort() : 0])]);
}
const _tick = () => new Promise(r => setTimeout(r));   // yield to the event loop (paint)

registerPage({
  id: "data-quality",
  group: "settings",
  title: "Data Quality",
  async render(host) {
    const CAP = 50;

    /* ---- check definitions: title/desc/cols + a compute(ctx) that returns rows ---- */
    const DEFS = [
      { id: "foreman", title: "Foreman missing or “OTHER”",
        desc: "Closing jobs with no foreman (blank or a catch-all like OTHER). Trip rows are excluded.",
        cols: [{ key: "val", label: "Foreman" }, { key: "key", label: "Job / Request #" },
               { key: "date", label: "Move date" }, { key: "customer", label: "Customer" },
               { key: "sales", label: "Sales person" }],
        compute: x => x.closingJobs.filter(r => x.missing(r["Foreman"])).map(r => ({
          val: x.showVal(r["Foreman"]), key: x.cKey(r), date: r._d || "—",
          customer: r["Customer"] || "—", sales: r["Sales Person"] || "—" })) },

      { id: "sales", title: "Sales person missing",
        desc: "Closing jobs and moveboard leads with no sales person / assigned owner. Trip rows are excluded (they legitimately have none).",
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Sales person" },
               { key: "key", label: "Job / Lead #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }],
        compute: x => [
          ...x.closingJobs.filter(r => x.missing(r["Sales Person"])).map(r => ({
            table: "Closing", val: x.showVal(r["Sales Person"]), key: x.cKey(r),
            date: r._d || "—", customer: r["Customer"] || "—" })),
          ...x.moveboard.filter(r => x.missing(r["Assigned"])).map(r => ({
            table: "Moveboard", val: x.showVal(r["Assigned"]), key: r["Job No"] || "—",
            date: r._d || "—", customer: r["Customer"] || "—" })) ] },

      { id: "source", title: "Lead source missing or unmapped",
        desc: "Leads and closing jobs with a blank source or a catch-all placeholder (OTHER, UNKNOWN, N/A, …). Trip rows are excluded.",
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Source" },
               { key: "key", label: "Request #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }],
        compute: x => [
          ...x.leads.filter(r => x.missing(r["Source"])).map(r => ({
            table: "Lead", val: x.showVal(r["Source"]), key: r["Request # From Moveboard"] || "—",
            date: r._d || "—", customer: r["Customer"] || "—" })),
          ...x.closingJobs.filter(r => x.missing(r["Source"])).map(r => ({
            table: "Closing", val: x.showVal(r["Source"]), key: x.cKey(r),
            date: r._d || "—", customer: r["Customer"] || "—" })) ] },

      { id: "dates", title: "Bad dates",
        desc: "Refunds dated in the future or before their move, and move / refund dates whose year looks wrong (before 2019 or after next year). Blank move dates only show when the Date filter is cleared or wide.",
        cols: [{ key: "problem", label: "Problem" }, { key: "table", label: "Where" },
               { key: "key", label: "Request #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }],
        compute: x => {
          const out = [];
          x.refunds.forEach(r => {
            const rd = x.d10(r["Refund Date"]), md = x.d10(r["Move Date"]);
            if (x.validISO(rd) && rd > x.today) out.push({ problem: "Refund dated in the future", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
            if (x.validISO(rd) && x.validISO(md) && rd < md) out.push({ problem: "Refund dated before the move (" + md + ")", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
            if (x.validISO(rd) && x.badYear(rd)) out.push({ problem: "Refund date year looks wrong", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
          });
          x.closingJobs.forEach(r => {
            if (x.blank(r["Date"])) out.push({ problem: "Closing has no move date", table: "Closing", key: x.cKey(r), date: "(blank)", customer: r["Customer"] || "—" });
            const d = x.d10(r["Date"]);
            if (x.validISO(d) && x.badYear(d)) out.push({ problem: "Move date year looks wrong", table: "Closing", key: x.cKey(r), date: d, customer: r["Customer"] || "—" });
          });
          return out; } },

      { id: "netcash", title: "Closing with no Net Cash",
        desc: "Closing jobs where Net Cash was left blank (a true $0 is not flagged). Trip rows are excluded.",
        cols: [{ key: "key", label: "Job / Request #" }, { key: "date", label: "Move date" },
               { key: "customer", label: "Customer" }, { key: "bill", label: "Total Bill", align: "r" }],
        compute: x => x.closingJobs.filter(r => x.blank(r["Net Cash"])).map(r => ({
          key: x.cKey(r), date: r._d || "—", customer: r["Customer"] || "—",
          bill: RS.money(RS.num(r["Total Bill"])) })) },

      { id: "resp", title: "Claim responsibility unmapped",
        desc: "Claims with a blank or placeholder Responsibility — can't be attributed to foreman / sales without it.",
        cols: [{ key: "val", label: "Responsibility" }, { key: "key", label: "Request #" },
               { key: "date", label: "Claim date" }, { key: "customer", label: "Customer" },
               { key: "reason", label: "Reason" }],
        compute: x => x.claims.filter(r => x.missing(r["Responsibility"])).map(r => ({
          val: x.showVal(r["Responsibility"]), key: r["Request No"] || "—",
          date: r._d || "—", customer: r["Customer"] || "—", reason: r["Reason"] || "—" })) },
    ];

    /* ---------------- 1) paint the shell immediately (no compute yet) ---------------- */
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Data Quality</h1>
        <p>Rows that look wrong or unfinished for the current filters — fix them at the
           source sheet. <b id="dqTotal">checking…</b>
           <span class="freshness">· read-only · this page lists problems, it never edits data</span></p>
      </div>
      <div class="rs-kpis" id="dqKpis"></div>
      <div id="dqChecks"></div>`;

    // KPI tiles (start at "…") and a panel per check (start "Checking…")
    RSC.kpis(document.getElementById("dqKpis"),
      DEFS.map(d => ({ label: d.title, value: "…", sub: "rows to fix" })));
    const kpiEls = [...document.querySelectorAll("#dqKpis .kpi .v, #dqKpis .rs-kpi .v")];
    const cont = document.getElementById("dqChecks");
    const panelById = {};
    DEFS.forEach((d, i) => {
      const panel = RSC.el("div", "panel");
      panel.innerHTML =
        `<div class="panel-head"><span class="panel-title">${RSC.esc(d.title)}</span>
           <span class="spacer"></span>
           <span class="rs-ctl"><span class="lbl" id="dq-n-${d.id}">checking…</span></span></div>
         <div style="padding:0 14px 6px;color:var(--muted);font-size:12.5px">${RSC.esc(d.desc)}</div>
         <div class="tabwrap" id="dq-body-${d.id}">
           <div style="padding:14px;color:var(--muted);font-size:13px">Checking… <span class="dq-spin">◍</span></div>
         </div>`;
      cont.appendChild(panel);
      panelById[d.id] = { kpi: kpiEls[i] };
    });

    const paintPanel = (d, rows) => {
      const n = rows.length;
      const nEl = document.getElementById("dq-n-" + d.id);
      const body = document.getElementById("dq-body-" + d.id);
      if (panelById[d.id].kpi) panelById[d.id].kpi.textContent = RS.fmtN(n);
      if (nEl) nEl.textContent = RS.fmtN(n) + " rows to fix";
      if (!body) return;
      if (!n) {
        body.innerHTML = `<div style="padding:14px;color:var(--brand);font-size:13px">✓ Nothing to fix for this check in the current scope.</div>`;
      } else {
        const shown = rows.slice(0, CAP);
        const note = n > CAP
          ? `showing ${CAP} of ${RS.fmtN(n)} · narrow the filters to see the rest`
          : `${RS.fmtN(n)} total`;
        body.innerHTML = RSC.table(d.cols, shown) +
          `<div style="color:var(--muted);font-size:12px;padding:6px 2px">${note}</div>`;
      }
    };
    const paintTotal = results => {
      const el = document.getElementById("dqTotal");
      if (el) el.textContent = RS.fmtN(results.reduce((a, r) => a + r.rows.length, 0)) + " rows flagged in scope";
    };

    /* ---------------- 2) cache hit → paint instantly and stop ---------------- */
    const sig = _dqSig();
    if (DQ_CACHE[sig]) {
      DQ_CACHE[sig].forEach(r => paintPanel(DEFS.find(d => d.id === r.id), r.rows));
      paintTotal(DQ_CACHE[sig]);
      return;
    }

    /* ---------------- 3) compute in the background, painting progressively ---------------- */
    await _tick();   // let the shell paint before we start the heavy work
    const [closingAll, moveboardAll, refundsAll, leadsAll, claimsAll] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("refunds"),
      RS.load("leads"), RS.load("claims")]);
    await _tick();

    // filter each dataset with a yield between them (keeps the longest block short)
    const ctx = {};
    ctx.closing = RS.filtered("closing", closingAll); await _tick();
    ctx.moveboard = RS.filtered("moveboard", moveboardAll); await _tick();
    ctx.refunds = RS.filtered("refunds", refundsAll); await _tick();
    ctx.leads = RS.filtered("leads", leadsAll); await _tick();
    ctx.claims = RS.filtered("claims", claimsAll); await _tick();

    // shared predicates / helpers passed to each check's compute()
    const isTrip = r => String(r["Record Source"] || "").trim().toLowerCase() === "trip";
    ctx.closingJobs = ctx.closing.filter(r => !isTrip(r));
    ctx.blank = v => v == null || String(v).trim() === "";
    const PLACEHOLDER = new Set(["other", "unknown", "unmapped", "n/a", "na", "none",
      "tbd", "test", "-", "--", "?", ".", "null", "undefined", "xxx", "x"]);
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    ctx.missing = v => ctx.blank(v) || PLACEHOLDER.has(norm(v));
    ctx.showVal = v => ctx.blank(v) ? "(blank)" : String(v);
    ctx.cKey = r => r["Request #"] || r["Unique Key"] || "—";
    ctx.today = new Date().toISOString().slice(0, 10);
    const curYear = new Date().getFullYear();
    ctx.d10 = v => String(v == null ? "" : v).slice(0, 10);
    ctx.validISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
    ctx.badYear = s => { const y = +s.slice(0, 4); return y < 2019 || y > curYear + 1; };

    // guard: if the user navigated away while we were loading, don't paint stale DOM
    const stillHere = () => document.getElementById("dqTotal");

    const results = [];
    for (const d of DEFS) {
      const rows = d.compute(ctx);
      results.push({ id: d.id, rows });
      if (stillHere()) paintPanel(d, rows);
      await _tick();
    }
    DQ_CACHE[sig] = results;
    if (stillHere()) paintTotal(results);
  },
});
