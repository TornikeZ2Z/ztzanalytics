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

// SCOPE: 2026 onwards. Older rows are history nobody is going back to fix, and carrying
// them made every count read like a mountain (Tornike 2026-07-30).
window.DQ_SINCE = "2026-01-01";
registerPage({
  id: "data-quality",
  group: "settings",
  title: "Data Quality",
  async render(host) {
    // Data Quality is now a HUB: warehouse checks + calendar coverage + request-# consistency as tabs
    // (the latter two register their render on window.DQ_SUB instead of as standalone pages).
    // The tab bar is the kit's (.rs-tabs / .rs-tab), so this hub reads like every other
    // merged page; the page no longer carries a tab sheet of its own.
    const TABS = [
      { key: "checks", label: "Warehouse checks", render: renderChecks },
      { key: "coverage", label: "Calendar Coverage", render: (window.DQ_SUB || {}).coverage },
      { key: "consistency", label: "Request # Consistency", render: (window.DQ_SUB || {}).consistency },
      { key: "mfissues", label: "Issues in Money Flow", render: (window.DQ_SUB || {}).mfissues },
    ];
    host.innerHTML = `<div class="rs-tabs" id="dqTabs"></div><div id="dqContent"></div>`;
    const content = host.querySelector("#dqContent");
    let active = "checks";
    const paintTabs = () => {
      document.getElementById("dqTabs").innerHTML = TABS.map(t =>
        `<button class="rs-tab ${t.key === active ? "on" : ""}" data-k="${t.key}">${RSC.esc(t.label)}</button>`).join("");
      document.querySelectorAll("#dqTabs .rs-tab").forEach(b => b.onclick = () => go(b.getAttribute("data-k")));
    };
    const go = async (k) => {
      active = k; paintTabs();
      content.innerHTML = `<div class="rs-loading" style="padding:22px">Loading…</div>`;
      const t = TABS.find(t => t.key === k);
      if (t && typeof t.render === "function") await t.render(content);
      else content.innerHTML = `<div class="rs-loading" style="padding:22px">This view isn't available.</div>`;
    };
    paintTabs();
    await go("checks");
  },
});

async function renderChecks(host) {
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
        desc: "A job that HAPPENED, or a lead that went somewhere, with nobody owning it. "
            + "Dead / spam / expired / archived leads are not counted — nobody was ever "
            + "assigned to those and nobody should be (Tornike 2026-07-30).",
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Sales person" },
               { key: "key", label: "Job / Lead #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }, { key: "why", label: "Why it counts" }],
        compute: x => [
          // a closing IS the action: the job ran, so somebody sold it
          ...x.closingJobs.filter(r => x.missing(r["Sales Person"])).map(r => ({
            table: "Closing", val: x.showVal(r["Sales Person"]), key: x.cKey(r),
            date: r._d || "—", customer: r["Customer"] || "—", why: "job completed" })),
          ...x.moveboard.filter(r => x.missing(r["Assigned"]) && x.leadWentSomewhere(r)).map(r => ({
            table: "Moveboard", val: x.showVal(r["Assigned"]), key: r["Job No"] || "—",
            date: r._d || "—", customer: r["Customer"] || "—",
            why: "still open · " + (r["Status"] || "?") })) ] },

      /* N4, his words: "Support may record salary reductions late, so a reduction lands in
         the wrong month's report." Nobody was keeping the fact that answers it -- when we
         FIRST saw a row -- so meta_row_first_seen started recording it on 2026-08-07 and
         mart_recording_lag turns it into days.

         IT SAYS SO WHEN IT KNOWS NOTHING. Every row that already existed on the day the
         snapshot was first taken carries that moment as its first sighting, which measures
         when we started looking and not when Support typed anything; those are excluded at
         source and reported as unmeasurable rather than as very late. Until real arrivals
         accrue this check is honestly empty, and it fills itself. */
      { id: "lateness", title: "Recorded late — the month it lands in is not the month it belongs to",
        desc: "A refund or claim whose amount reached us in a LATER month than the row's own "
            + "date. Both monthly reports are then right and they disagree. Rows that "
            + "predate the measurement are excluded, not guessed at.",
        cols: [{ key: "table", label: "Where" }, { key: "date", label: "Row date" },
               { key: "seen", label: "Amount arrived" }, { key: "days", label: "Days late", align: "r" }],
        compute: x => (x.lag || [])
          .filter(r => +r["Landed In A Later Month"] === 1)
          .sort((a, b) => (+b["Days To Record"] || 0) - (+a["Days To Record"] || 0))
          .map(r => ({
            table: r["Source"] || "—",
            date: String(r["Row Date"] || "—").slice(0, 10),
            seen: String(r["Valued At"] || r["First Seen"] || "—").slice(0, 10),
            days: r["Days To Record"] == null ? "—" : String(r["Days To Record"]) })) },

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
               { key: "customer", label: "Customer" }, { key: "bill", label: "Revenue", align: "r" }],
        compute: x => x.closingJobs.filter(r => x.blank(r["Net Cash"])).map(r => ({
          key: x.cKey(r), date: r._d || "—", customer: r["Customer"] || "—",
          bill: RS.money(RS.num(r["Total Bill"])) })) },

      /* The CFO's Michael Lyons finding (2026-08-27): a move closed twice — the pickup row
         bills the FULL move price and carries a Balance Due, then the delivery row enters
         that same balance as a new bill, so the balance is counted as revenue twice.
         "Excluded" rows the warehouse already handles (their bill is NULLed in the fact,
         the sheet's value shown here as Raw bill). "NEEDS FIX" pairs — the same bill typed
         twice on one request — the warehouse will NOT guess at: delete the twin in the
         closing sheet itself. */
      { id: "splitbill", title: "Split-closing double billing",
        desc: "The same money billed twice across two closing rows of one request. "
            + "“Excluded” = a delivery row re-billing an earlier leg's Balance Due — already "
            + "removed from revenue automatically. “NEEDS FIX” = an identical bill entered "
            + "twice — fix it in the closing sheet. “REVIEW” = an earlier leg left a balance "
            + "over $300 and this row billed a different amount: it may already contain that "
            + "balance, or be genuine new work — the numbers cannot tell, so nothing is "
            + "excluded until someone rules on it.",
        cols: [{ key: "status", label: "Status" }, { key: "job", label: "Job #" },
               { key: "req", label: "Request #" }, { key: "date", label: "Move date" },
               { key: "customer", label: "Customer" },
               { key: "prior", label: "Balance carried in", align: "r" },
               { key: "raw", label: "Raw bill", align: "r" },
               { key: "counted", label: "Counted as revenue", align: "r" }],
        compute: x => {
          // worst first: a duplicate bill is a live error, REVIEW is a question,
          // Excluded is already handled and only here so the fix stays auditable
          const rank = r => r["Dup Bill Suspect"] === "Yes" ? 0
                          : r["Rebill Review"] === "Yes" ? 1 : 2;
          return x.closingJobs
            .filter(r => r["Split Rebill"] === "Yes" || r["Dup Bill Suspect"] === "Yes"
                      || r["Rebill Review"] === "Yes")
            .sort((a, b) => rank(a) - rank(b)
                          || String(a._d || "").localeCompare(String(b._d || "")))
            .map(r => ({
              status: r["Dup Bill Suspect"] === "Yes" ? "NEEDS FIX — duplicate bill"
                    : r["Rebill Review"] === "Yes" ? "REVIEW — balance carried in"
                    : "Excluded — re-billed balance",
              job: r["Job No"] || "—", req: r["Request #"] || "—", date: r._d || "—",
              customer: r["Customer"] || "—",
              prior: x.blank(r["Prior Balance Due"]) ? "—"
                   : RS.money(RS.num(r["Prior Balance Due"])),
              raw: RS.money(RS.num(r["Total Bill Raw"])),
              counted: x.blank(r["Total Bill"]) ? "$0 (excluded)" : RS.money(RS.num(r["Total Bill"])) }));
        } },

    ];

    /* ---------------- 1) paint the shell immediately (no compute yet) ---------------- */
    if (!document.getElementById("dq-look")) {
      const st = document.createElement("style"); st.id = "dq-look";
      st.textContent = [
        // The kit's older tab rule is the one control here it does not fully describe:
        // unlike .rs-btn / .rs-seg it never sets font-family, so a bare <button> falls back
        // to the UA font. Covered here so this hub keeps Inter; it belongs in rs.css.
        "#dqTabs .rs-tab{font-family:inherit}",
        // A worklist reads badly at full monitor width: the count ends up a screen away from
        // the check it belongs to. So each CARD stays capped -- but the cards now sit in a
        // grid that uses the whole box, instead of one capped column with 700px of nothing
        // either side. An open card takes the full width, because its table needs it.
        // (The old rule capped .dq-head too and centred it with margin-left/right:auto --
        // then the very next rule's `margin:` shorthand reset both to 2px, so the header sat
        // LEFT while the cards it belongs to sat CENTRED, 350px out of line with each other.)
        ".dq-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(620px,1fr));"
        + "gap:0 26px;align-items:start}",
        // the heading is the kit's .rs-page-head; only the score-to-the-right row is ours
        ".dq-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin:2px 2px 18px}",
        ".dq-head p{max-width:640px;line-height:1.55}",
        ".dq-score{margin-left:auto;text-align:right;flex:none}",
        ".dq-score b{display:block;font-size:30px;letter-spacing:-.8px;line-height:1.05;font-variant-numeric:tabular-nums}",
        ".dq-score span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--faint)}",
        ".dq-score.clean b{color:var(--pos)}",
        // THE CARD IS A KIT .panel. Only the accordion's own needs are layered on it: the
        // header row is full-bleed so its hover fills the card edge to edge, which the
        // panel's own padding would inset. `body.rs-app` because that is the specificity
        // rs.css states .panel at -- a bare .dq-card would lose to it and silently keep
        // the padding.
        "body.rs-app .dq-card{padding:0;overflow:hidden;max-width:var(--rs-row-max)}",
        "body.rs-app .dq-card.open{grid-column:1/-1;max-width:none}",
        "body.rs-app .dq-card.clean{background:var(--panel-2);border-style:dashed}",
        "body.rs-app .dq-ch{margin:0;flex-wrap:nowrap;padding:13px 16px;cursor:pointer;user-select:none}",
        ".dq-ch:hover{background:var(--panel-2)}",
        ".dq-card.clean .dq-ch:hover{background:transparent}",
        // the count is a kit .rs-pill; it only has to push itself to the far end of the row
        ".dq-ch .rs-pill{margin-left:auto;font-variant-numeric:tabular-nums}",
        // the severity dot is the page's own: the kit names no such mark
        ".dq-dot{width:9px;height:9px;border-radius:50%;flex:none;background:var(--line-2)}",
        ".dq-dot.bad{background:var(--neg)}",
        ".dq-dot.warn{background:var(--warn)}",
        ".dq-dot.ok{background:var(--pos)}",
        ".dq-caret{flex:none;color:var(--faint);font-size:11px;transition:transform .15s}",
        ".dq-card.open .dq-caret{transform:rotate(90deg)}",
        // the description is a kit .rs-hint; the indent lines it up under the title, past the dot
        ".dq-desc{margin:0;padding:0 16px 12px 36px}",
        ".dq-body{display:none;padding:0 12px 14px}",
        ".dq-card.open .dq-body{display:block}",
        ".dq-empty{margin:0;padding:4px 4px 8px}",
        ".dq-more{margin:9px 2px 2px}"
      ].join("");
      document.head.appendChild(st);
    }
    host.innerHTML = `
      <div class="rs-page-head dq-head">
        <div>
          <h1>Warehouse checks</h1>
          <p>Rows that look wrong or unfinished — fix them at the source sheet.
             <b>2026 onwards</b>, read-only: this page never edits data.</p>
        </div>
        <div class="dq-score" id="dqScore"><b>…</b><span>rows to fix</span></div>
      </div>
      <div id="dqChecks" class="dq-list"></div>`;

    const cont = document.getElementById("dqChecks");
    const panelById = {};
    DEFS.forEach((d) => {
      const panel = RSC.el("div", "panel dq-card");
      panel.id = "dq-card-" + d.id;
      panel.innerHTML =
        `<div class="panel-head dq-ch"><span class="dq-dot" id="dq-dot-${d.id}"></span>
           <span class="panel-title">${RSC.esc(d.title)}</span>
           <span class="rs-pill mute" id="dq-n-${d.id}">…</span>
           <span class="dq-caret">▶</span></div>
         <div class="rs-hint dq-desc">${RSC.esc(d.desc)}</div>
         <div class="dq-body" id="dq-body-${d.id}">
           <div class="rs-hint dq-empty">Checking…</div>
         </div>`;
      // the whole header row toggles it — a check with nothing to fix simply stays shut
      panel.querySelector(".dq-ch").onclick = () => panel.classList.toggle("open");
      cont.appendChild(panel);
      panelById[d.id] = {};
    });

    /* The kit's table (.rs-tablewrap + .rs-table) rendered from the SAME column spec
       RSC.table takes, with the same escaping, the same c.fmt hook and the same "—" for a
       null -- only the class vocabulary differs. These are worklists of names, dates and
       customers, so the kit's left-aligned default is right for them; a column that
       declares align:"r" (Revenue) becomes the kit's .num cell. */
    const dqTable = (cols, rows) =>
      `<div class="rs-tablewrap"><table class="rs-table"><thead><tr>`
      + cols.map(c => `<th class="${c.align === "r" ? "num" : ""}">${RSC.esc(c.label)}</th>`).join("")
      + `</tr></thead><tbody>`
      + rows.map(r => `<tr>` + cols.map(c => {
        const v = r[c.key];
        return `<td class="${c.align === "r" ? "num" : ""}">${c.fmt ? c.fmt(v) : (v == null ? "—" : RSC.esc(v))}</td>`;
      }).join("") + `</tr>`).join("")
      + `</tbody></table></div>`;

    const paintPanel = (d, rows) => {
      const n = rows.length;
      const card = document.getElementById("dq-card-" + d.id);
      const nEl = document.getElementById("dq-n-" + d.id);
      const dot = document.getElementById("dq-dot-" + d.id);
      const body = document.getElementById("dq-body-" + d.id);
      // severity is simply size: clear / a handful / a pile. It drives the dot and the
      // pill so the state of every check reads at a glance without opening anything.
      const lvl = !n ? "ok" : n > 100 ? "bad" : "warn";
      if (nEl) { nEl.textContent = n ? RS.fmtN(n) : "clear"; nEl.className = "rs-pill " + lvl; }
      if (dot) dot.className = "dq-dot " + lvl;
      if (card) card.classList.toggle("clean", !n);
      if (!body) return;
      if (!n) {
        body.innerHTML = `<div class="rs-hint dq-empty">Nothing to fix here.</div>`;
      } else {
        const shown = rows.slice(0, CAP);
        body.innerHTML = dqTable(d.cols, shown)
          + (n > CAP ? `<div class="rs-hint dq-more">showing ${CAP} of ${RS.fmtN(n)} — narrow the filters to see the rest</div>` : "");
      }
    };
    const paintTotal = results => {
      const el = document.getElementById("dqScore");
      if (!el) return;
      const n = results.reduce((a, r) => a + r.rows.length, 0);
      el.innerHTML = `<b>${RS.fmtN(n)}</b><span>${n ? "rows to fix" : "all clear"}</span>`;
      el.classList.toggle("clean", !n);
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
    const [closingAll, moveboardAll, refundsAll, leadsAll, claimsAll, lagAll] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("refunds"),
      RS.load("leads"), RS.load("claims"),
      // young table, and it may not exist at all on an instance that has not rebuilt yet --
      // a failure here must not take the whole page down with it
      RS.load("recording_lag").catch(() => [])]);
    await _tick();

    // filter each dataset with a yield between them (keeps the longest block short)
    const ctx = {};
    // 2026+ only. A row with NO date is KEPT — "the date is missing" is itself one of the
    // faults this page exists to catch, so a date rule must not hide it.
    const since = rows => rows.filter(r => !r._d || r._d >= window.DQ_SINCE);
    ctx.closing = since(RS.filtered("closing", closingAll)); await _tick();
    ctx.moveboard = since(RS.filtered("moveboard", moveboardAll)); await _tick();
    ctx.refunds = since(RS.filtered("refunds", refundsAll)); await _tick();
    ctx.leads = since(RS.filtered("leads", leadsAll)); await _tick();
    ctx.claims = since(RS.filtered("claims", claimsAll)); await _tick();
    // NOT date-scoped by `since`: the whole point is a row whose own date is old and whose
    // money arrived late, so cutting on the row date would hide exactly the cases wanted
    ctx.lag = lagAll || []; await _tick();

    // shared predicates / helpers passed to each check's compute()
    const isTrip = r => String(r["Record Source"] || "").trim().toLowerCase() === "trip";
    ctx.closingJobs = ctx.closing.filter(r => !isTrip(r));
    ctx.blank = v => v == null || String(v).trim() === "";
    const PLACEHOLDER = new Set(["other", "unknown", "unmapped", "n/a", "na", "none",
      "tbd", "test", "-", "--", "?", ".", "null", "undefined", "xxx", "x"]);
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    ctx.missing = v => ctx.blank(v) || PLACEHOLDER.has(norm(v));
    // A lead only needs an owner once it went somewhere. Dead / spam / expired / archived
    // leads never had one and never will — counting them buried the handful that matter
    // (263 flagged, 259 of them dead; Tornike 2026-07-30).
    const DEAD_LEAD = new Set(["dead lead", "spam", "archive", "expired",
                               "we are not available", "not interested", "duplicate"]);
    // NOT "Booked Date" -- measured 2026-07-30: all 263 unassigned leads carry one,
    // including every Dead Lead and Archive, so it timestamps the request and not a
    // booking. Status is the only honest signal of a lead that went somewhere.
    ctx.leadWentSomewhere = r =>
      norm(r["Status Category"]) !== "bad lead" && !DEAD_LEAD.has(norm(r["Status"]));
    ctx.showVal = v => ctx.blank(v) ? "(blank)" : String(v);
    ctx.cKey = r => r["Request #"] || r["Unique Key"] || "—";
    ctx.today = new Date().toISOString().slice(0, 10);
    const curYear = new Date().getFullYear();
    ctx.d10 = v => String(v == null ? "" : v).slice(0, 10);
    ctx.validISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
    ctx.badYear = s => { const y = +s.slice(0, 4); return y < 2019 || y > curYear + 1; };

    // guard: if the user navigated away while we were loading, don't paint stale DOM.
    // MUST name an element the shell actually renders -- it pointed at #dqTotal after that
    // element was replaced by #dqScore, so every check silently stayed on "..." (2026-07-30).
    const stillHere = () => document.getElementById("dqScore");

    const results = [];
    for (const d of DEFS) {
      const rows = d.compute(ctx);
      results.push({ id: d.id, rows });
      if (stillHere()) paintPanel(d, rows);
      await _tick();
    }
    DQ_CACHE[sig] = results;
    if (stillHere()) paintTotal(results);
}
