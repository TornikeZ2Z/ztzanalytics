/* MONEY FLOW — who owes whom between the base and the foremen (LOGISTICS group).

   THREE TABS OVER THE PAGE (2026-10-08): Money Flow (everything below) · Day Closing (the Day
   Closing page, drawn by pages/day-closing.js's own render) · How to use (the guide, howHtml()).
   The tab rides in the hash: #page=money-flow&tab=day-closing / &tab=how-to.

   REBUILT TO THE APPROVED CANVAS (Tornike 2026-10-07; contract: the "Money Flow — final build"
   spec). One queue, three tabs, and every action in a panel on the right:
     * Waiting      — the open jobs grouped by foreman: what he holds for the base, what the base
                      owes him, his own balance, his oldest job. Tick several to-the-base jobs of
                      ONE foreman and confirm them as cash, in full, in one go. Every job carries
                      its Calendar and Contract links (2026-10-08).
     * Settled      — every confirmation, grouped by foreman (2026-10-08), newest first, with how
                      the money came in.
     * Foreman balances — his balance (fines, advances, short and extra hand-ins, repayments)
                      next to what his open jobs owe.
   Panels: Settle (a to-the-base job: Cash or a method on for money in; short goes on his balance,
   extra comes off it), Pay out (a to-the-foreman job: balance it against his other jobs first,
   pay the rest by a method or leave it on his balance), the job's story across all its calendar
   days, the foreman's balance, and the payment methods list.
   A job that already has a portal confirmation refuses another one: the only way is "Add a
   correction" (the server enforces it too — 409).

   Data: fct_money_flow (6h base) + /api/_mf live overlay (rows, entries, methods); statuses are
   recomputed client-side with the pipeline's proven rules. Writes: POST /api/_mf with a BATCH
   (all or nothing), /api/_mfmethods, /api/_ffines. The money logic sits in ONE pure block
   ("MF LOGIC") so it can be cut out and run under node. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_money_flow) {
    RS.DATASETS.fct_money_flow = {
      table: "fct_money_flow",
      // A PAYLOAD CONTRACT: the overlay reads every one of these. `Moved to Debt` was read but never
      // asked for, so in snapshot mode (live overlay down) a short hand-in's debt vanished.
      cols: ["Event ID", "Calendar ID", "Job Date", "Event Title", "Job No", "Job Code", "Customer",
             "Forman Email", "Forman", "Job Type", "Company", "Contract Type", "Net Cash (DC)",
             "Net Cash (Closing)", "Expected Net Cash", "Net Cash (Recorded)", "Net Cash Corrected",
             "Job Expenses", "Contract URL", "DC Submission Time",
             "Cash Flow", "Cash Flow Time", "Cash Flow Source", "Cash Flow Method",
             "Cash Flow Records", "Advance", "Deduction", "Moved to Debt", "Moved to Debt (Recorded)",
             "Balance", "Status"],
    };
  }
})();

var MF_TOL = 10;   // settled when |balance| <= this — same constant as src/money_flow.py
var MF_DEBT = "Moved to Foreman Debt";   // a short hand-in moved onto his balance (29 Sep)
var MF_EXTRA = "Extra Applied to Foreman Balance";   // brought MORE: repays his balance (6 Oct)

registerPage({
  id: "money-flow",
  group: "logistics",
  title: "Money Flow",
  async render(host) {
    var esc = RSC.esc;
    var MF_NO_FOREMAN = "Foreman Not Identified";

    var S = window.__MF || (window.__MF = {
      view: "waiting", q: "", formen: [], company: "", need: "",
      live: null, liveOk: false, busy: false,
      fmx: {}, fmAll: {}, allFm: false,
      sfx: {}, sfAll: {}, allSFm: false,
      sel: {}, selFm: null,
      dateFrom: null, dateTo: null, compact: false,
      fines: null, finesErr: "",
    });
    // state remembered from the page before the rebuild (2026-10-07)
    if (S.view === "foreman" || S.view === "todo" || S.view === "nib" || S.view === "advded") S.view = "waiting";
    if (S.view === "history" || S.view === "done") S.view = "settled";
    if (S.view === "fines") S.view = "balances";
    if (["waiting", "settled", "balances"].indexOf(S.view) < 0) S.view = "waiting";
    if (!Array.isArray(S.formen)) S.formen = [];
    if (!S.fmx) S.fmx = {};
    if (!S.fmAll) S.fmAll = {};
    // the Settled tab's foreman groups (2026-10-08) keep their own open / show-all state
    if (!S.sfx) S.sfx = {};
    if (!S.sfAll) S.sfAll = {};
    if (!S.sel || typeof S.sel !== "object") S.sel = {};
    if (S.company == null) S.company = "";
    if (S.need == null) S.need = "";
    if (S.q == null) S.q = "";

    mfCss();
    var ICON = {
      card: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path></svg>',
      dl: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="M7 10l5 5 5-5"></path><path d="M5 21h14"></path></svg>',
      search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>',
      chev: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>',
      x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>',
      back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>',
      toBase: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"></path><path d="M13 6l6 6-6 6"></path></svg>',
      toFm: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"></path><path d="M11 6l-6 6 6 6"></path></svg>',
      plus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="mf-ico"><circle cx="12" cy="12" r="9"></circle><path d="M12 8h.01"></path><path d="M11 12h1v5h1"></path></svg>',
      check: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"></path></svg>',
      yes: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-label="Yes"><path d="M5 12l5 5 9-10"></path></svg>',
      person: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path></svg>',
      // the Waiting rows' two outside links (2026-10-08): the Google Calendar event, the contract
      cal: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2"></rect><path d="M3 9.5h18"></path><path d="M8 2.5v4"></path><path d="M16 2.5v4"></path></svg>',
      doc: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8z"></path><path d="M14 2.5V8h5.5"></path><path d="M8.5 13h7"></path><path d="M8.5 17h5"></path></svg>',
    };

    /* THREE TABS OVER THE PAGE (his ask, 2026-10-08: "combine day closing and money flow as a
       separate tabs ... add 3rd tab called how to use"). Money Flow is the page as it was; Day
       Closing is the Day Closing page itself, drawn by ITS OWN render (pages/day-closing.js --
       the shell hides its sidebar entry and forwards #page=day-closing here); How to use is the
       guide for the people who record money. The tab rides in the hash (&tab=day-closing /
       &tab=how-to) like Salaries and Seasonal Planning do, so a copied link reopens it. */
    // + MONTH CLOSE (2026-10-09): the month's cash, foreman repayments, job expenses and corrections
    var TOPS = [["money-flow", "Money Flow", "mfPaneFlow"], ["day-closing", "Day Closing", "mfPaneDc"],
                ["month-close", "Month close", "mfPaneMonth"], ["how-to", "How to use", "mfPaneHow"]];
    host.innerHTML = '<div class="mf-root' + (S.compact ? " mf-compact" : "") + '" id="mfRoot">'
      + '<div class="mf-titles"><h1>Money Flow</h1>'
      + "<p>Who owes whom between the base and the foremen, job by job and on each foreman’s balance.</p></div>"
      + '<div class="rs-tabs mf-toptabs" role="tablist" aria-label="Money Flow sections">'
      + TOPS.map(function (t) {
          return '<button type="button" class="rs-tab" role="tab" id="mfTopT-' + t[0] + '" aria-controls="' + t[2]
            + '" aria-selected="false" data-mftop="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>"
      + '<div class="mf-pane mf-pane-flow" id="mfPaneFlow" role="tabpanel" aria-labelledby="mfTopT-money-flow">'
      + '<div class="mf-top"><div class="mf-livebar"><span class="mf-live mf-off" id="mfLive">Syncing…</span><span id="mfLast"></span>'
      + '<button type="button" class="mf-linkbtn" id="mfRefresh">Refresh</button></div>'
      + '<div class="mf-topbtns"><button type="button" class="mf-btn" id="mfMethodsBtn">' + ICON.card + "Payment methods</button>"
      + '<button type="button" class="mf-btn" id="mfExportBtn">' + ICON.dl + "Export</button></div></div>"
      + '<div id="mfDayStrip"></div>'
      + '<div class="mf-tools" id="mfTools"></div>'
      + '<div id="mfBody" class="mf-bodywrap"><div class="mf-load"><div class="mf-spin"></div>Loading jobs…</div></div>'
      + '<div class="mf-bulk" id="mfBulk" role="region" aria-label="Selected jobs" hidden></div></div>'
      + '<div class="mf-pane" id="mfPaneDc" role="tabpanel" aria-labelledby="mfTopT-day-closing" hidden></div>'
      + '<div class="mf-pane mf-pane-month" id="mfPaneMonth" role="tabpanel" aria-labelledby="mfTopT-month-close" hidden></div>'
      + '<div class="mf-pane mf-pane-how" id="mfPaneHow" role="tabpanel" aria-labelledby="mfTopT-how-to" hidden></div>'
      + '<div class="mf-scrim" id="mfScrim"></div>'
      + '<aside class="mf-drawer" id="mfDrawer" role="dialog" aria-modal="true" aria-labelledby="mfDTitle" aria-hidden="true"></aside>'
      + "</div>";

    // generation token: each page-open bumps it; a stale render's async callbacks compare
    // against it and skip painting once a newer open has taken over (see paint()).
    var myGen = (window.__MFGEN = (window.__MFGEN || 0) + 1);

    // the tabs work while the jobs are still loading: setTop() and what it calls are function
    // declarations (hoisted) and touch nothing the load below defines
    // dcStale: a Money Flow save moved the drawer since the Day Closing tab was drawn
    var topNow = null, dcMounted = false, dcStale = false, howMounted = false;
    Array.prototype.forEach.call(host.querySelectorAll("[data-mftop]"), function (b) {
      b.onclick = function () { setTop(b.getAttribute("data-mftop")); };
    });
    var tabList = host.querySelector(".mf-toptabs");
    if (tabList) tabList.onkeydown = function (e) {         // arrow keys move along the tabs
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var keys = TOPS.map(function (t) { return t[0]; }), i = keys.indexOf(topNow);
      var next = keys[(i + (e.key === "ArrowRight" ? 1 : keys.length - 1)) % keys.length];
      e.preventDefault(); setTop(next);
      var nb = document.getElementById("mfTopT-" + next); if (nb) nb.focus();
    };
    // #page=day-closing (an old link or bookmark) is forwarded here by the shell's REDIRECTS;
    // navigate() leaves the id it was asked for in window.__navRequested (Sales Trackers reads it
    // the same way for Communication Analysis)
    var bootTop = topFromHash();
    if (window.__navRequested === "day-closing") { bootTop = "day-closing"; window.__navRequested = null; }
    setTop(bootTop);
    // DAY CLOSING strip (2026-09-27): the open day's drawer, shared with the Day Closing page
    // (pages/day-closing.js, window.ZDC). It refreshes itself every 20 s while its tab shows (so
    // it is mounted AFTER the boot tab is picked: opened on another tab, it waits); its
    // "Day Closing ›" link opens the Day Closing tab in place.
    if (window.ZDC) ZDC.mountStrip(document.getElementById("mfDayStrip"), { onGo: function () { setTop("day-closing"); } });
    window.__MF_SYNCTOP = function () {
      if (myGen !== window.__MFGEN || !document.getElementById("mfRoot")) return;
      if (!/[#&]page=money-flow(?:&|$)/.test(location.hash)) return;
      var k = topFromHash();
      if (k !== topNow) setTop(k);
    };
    // a hand-edited hash, or a link to another tab of this page, switches the tab in place: the
    // shell re-renders only when the PAGE id changes, and &tab= isn't part of it
    if (!window.__MF_HASH) {
      window.__MF_HASH = true;
      window.addEventListener("hashchange", function () { if (window.__MF_SYNCTOP) window.__MF_SYNCTOP(); });
    }

    var base;
    try { base = await RS.load("fct_money_flow"); }
    catch (e) { var b0 = document.getElementById("mfBody"); if (b0) b0.innerHTML = '<div class="mf-load">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    // ---------- helpers ----------
    function $(id) { return document.getElementById(id); }
    function num(v) { var x = parseFloat(v); return isNaN(x) ? null : x; }
    function fmtD(v) {
      if (!v) return "—";
      var d = new Date(String(v).slice(0, 10) + "T12:00:00");
      return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    function fmtShort(v) {
      if (!v) return "—";
      var d = new Date(String(v).slice(0, 10) + "T12:00:00");
      if (isNaN(d)) return String(v).slice(0, 10);
      var s = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return String(v).slice(0, 4) === todayIso.slice(0, 4) ? s : s + ", " + String(v).slice(0, 4);
    }
    function fmtTs(v) { return v ? String(v).slice(0, 16).replace("T", " ") : "—"; }
    function fmtWhen(v) { return v ? fmtD(v) + " · " + String(v).slice(11, 16) : "—"; }
    function shortBy(email) { var s = String(email || "").split("@")[0]; return s ? s.charAt(0).toUpperCase() + s.slice(1) : "—"; }
    function firstName(n) { return String(n || "").trim().split(/\s+/)[0] || "him"; }
    function initials(n) {
      var w = String(n || "").trim().split(/\s+/).filter(Boolean);
      return ((w[0] || "?").charAt(0) + (w[1] ? w[1].charAt(0) : "")).toUpperCase();
    }
    function daysWaiting(d) {
      var a = Date.parse(todayIso + "T12:00:00"), b = Date.parse(String(d).slice(0, 10) + "T12:00:00");
      return isNaN(a) || isNaN(b) ? 0 : Math.max(0, Math.round((a - b) / 864e5));
    }
    function ageText(n) { return n === 0 ? "today" : n === 1 ? "1 day" : n + " days"; }
    function fmtAmt(n) { return n == null ? "" : (Math.round(n * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
    function parseAmt(s) {
      var t = String(s == null ? "" : s).replace(/[\s,$]/g, "");
      if (!t || t === "." || !/^\d*\.?\d{0,2}$/.test(t)) return null;
      return Math.round(parseFloat(t) * 100) / 100;
    }
    // Google's event deep link: base64url(event_id + " " + calendar_id)
    function calUrl(r) {
      if (!r || !r.ev || !r.calendarId) return null;
      try {
        return "https://calendar.google.com/calendar/u/0/r/event?eid="
          + window.btoa(r.ev + " " + r.calendarId).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch (e) { return null; }
    }
    // a job's two outside links -- its digital contract and its Google Calendar event -- for the
    // Settle panel's job card and the Waiting rows alike; only a web address is ever linked
    function jobLinksOf(r) {
      var c = r && r.contractUrl ? String(r.contractUrl).trim() : "";
      return { contract: /^https?:\/\//i.test(c) ? c : null, cal: calUrl(r) };
    }
    var todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    /* ======================== MF LOGIC (pure) ========================
       No DOM, no fetch, no page state: every function below takes what it needs as arguments
       (plus the three constants MF_TOL / MF_DEBT / MF_EXTRA). Node tests cut this block out
       between the two banner lines and run it against fixtures — the settle preset, the
       short/extra effect, the pay-out allocation, the bulk rule and the batch bodies. */
    var BROUGHT = "Cash Brought to Base", TAKEN = "Cash Taken Away from Base";
    // 2026-10-09: the job's net cash was wrong (the corrected figure, signed) / an expense on the
    // job that isn't on the contract. Portal-only, never cash, never on his balance.
    var NC_FIX = "Net Cash Corrected", JOB_EXP = "Job Expense";
    var FIX_TOL = 1;                 // a correction the closing now matches to the dollar is done
    var WAY_BAL = "__balance";       // pay-out: "Leave it on his balance"
    // the server's seed (spec): what the page offers when the bridge has no methods list yet
    var SEED_METHODS = [
      { id: null, name: "Zelle", money_in: 1, pay_out: 1, is_on: 1, sort: 10 },
      { id: null, name: "Card", money_in: 0, pay_out: 1, is_on: 1, sort: 20 },
      { id: null, name: "Wire / ACH", money_in: 1, pay_out: 1, is_on: 0, sort: 30 },
      { id: null, name: "Check", money_in: 1, pay_out: 1, is_on: 0, sort: 40 },
    ];
    function r2(x) { return Math.round((+x || 0) * 100) / 100; }
    function bareEv(x) { return String(x || "").split("@")[0]; }
    function codeOf(x) { return String(x || "").trim().toUpperCase(); }
    function normMethod(m) { var s = String(m == null ? "" : m).trim(); return !s || /^cash$/i.test(s) ? "Cash" : s; }
    function isCashMethod(m) { return normMethod(m) === "Cash"; }
    function money(v) {
      if (v == null) return "—";
      var n = Math.round(v);
      return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");
    }
    function money2(v) {
      if (v == null) return "—";
      // toLocaleString drops a trailing zero, so $125.50 printed as "$125.5" -- which reads as a
      // typo on a number somebody is about to dispute. Pad the cents when there ARE cents.
      var a = Math.abs(Math.round(v * 100) / 100);
      var frac = Math.round(a * 100) % 100 !== 0;
      return (v < 0 ? "-$" : "$") + a.toLocaleString("en-US",
        frac ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined);
    }
    // his foreman balance in words: + he owes the base, - the base owes him
    function owesText(n) {
      return n > 0.005 ? "owes " + money2(n) : n < -0.005 ? "the base owes him " + money2(-n) : "$0";
    }
    // the settle preset: Type + Amount such that the balance becomes exactly $0
    // (a new record REPLACES the old one — last-record-wins — so this is the full figure)
    function settle(r) {
      if (r.expected == null) return null;
      var v = Math.round((r.expected - (r.adv || 0) + (r.ded || 0)) * 100) / 100;
      return { type: v < 0 ? TAKEN : BROUGHT, amount: Math.abs(v) };
    }
    function isPayout(r) { var p = settle(r); return !!p && p.type === TAKEN && p.amount > MF_TOL; }
    /* WHAT THE JOB SETTLES AGAINST (2026-10-09) -- src/money_flow.py `Expected Net Cash` and the
       bridge's _mf_effective, the same rule: the corrected net cash where the office recorded one,
       else the contract / closing figure, less the job's expenses. No figure stays null. */
    function effExpected(recorded, fix, exp) {
      if (recorded == null) return null;
      return r2((fix != null ? fix : recorded) - (exp || 0));
    }
    // still flagged: corrected, and the contract / closing doesn't say so yet
    function fixOpen(r) { return r.fix != null && r.recorded != null && Math.abs(r.fix - r.recorded) > FIX_TOL; }
    /* "THE JOB'S NET CASH IS WRONG" (his call, 2026-10-09): he handed over the right amount, so the
       corrected net cash is the one that makes THIS hand-in settle the job exactly --
       Balance = NetCash − Expenses − Advance − Flow + Deduction = 0, nothing moved to his balance. */
    function fixedNetCash(r, type, amt) {
      var flow = type === TAKEN ? -amt : amt;
      return r2(flow + (r.adv || 0) - (r.ded || 0) + (r.exp || 0));
    }
    /* A SHORT OR EXTRA COUNTS ONLY WHAT THE JOB STILL NEEDS (his call, 2026-10-09: "net cash is now
       corrected and i need it to automatically become correct, he does not owe us anything").
       moved = signed (+ short on his balance, - extra off it); need = what the job needs from him
       before anything was moved. A short counts up to the job's current shortfall and nothing once he
       brought what it asks; never upwards. src/money_flow.py _counted_sql() and bridge _mf_counted()
       are the same rule (tests/test_mf_echo_leg.py runs all three). Nothing is written. */
    function countedMove(moved, need) {
      if (moved == null || need == null) return moved;
      if (moved > 0) return need <= MF_TOL ? 0 : (need < moved ? need : moved);
      if (moved < 0) return -need <= MF_TOL ? 0 : (need > moved ? need : moved);
      return moved;
    }
    /* A SHORT HAND-IN BECOMES HIS DEBT (22 Sep walkthrough, built 29 Sep): Cash Brought below what
       the job needs moves the difference onto his foreman balance, so the job settles and the
       dollars are owed in ONE place. AND THE MIRROR (6 Oct): brought MORE is a repayment of his
       balance. `debt` is SIGNED: + a shortfall, - an extra. Taken away: neither. Unchanged from
       the old popup -- the spec keeps these semantics exactly. */
    function debtOfEntry(r, type, amt) {
      var ded = Math.abs(r.ded || 0);          // legacy only -- no longer entered per job
      var flow = amt == null ? (r.flow || 0) : (type === TAKEN ? -amt : amt);
      var before = r.expected - (r.adv || 0) - flow + ded;
      var debt = (amt != null && type === BROUGHT && Math.abs(before) > MF_TOL)
        ? Math.round(before * 100) / 100 : (amt == null ? (r.debt || 0) : 0);
      return { debt: debt, balance: before - debt };
    }
    function jobFields(r) {
      return { event_id: r.ev, job_code: r.jobCode || "", customer: r.customer || "", forman: r.formanEmail || "" };
    }
    function assign(a, b) { for (var k in b) if (Object.prototype.hasOwnProperty.call(b, k)) a[k] = b[k]; return a; }
    // the shortfall onto his foreman balance, or the extra onto it as a repayment -- and the OTHER
    // kind back to $0, so one job never carries both (the job balance reads the latest of each)
    function debtItems(r, dNew, notes) {
      // the RECORDED short / extra (2026-10-09: what counts can be less, once the net cash changed)
      var out = [], dOld = r.debtRec != null ? r.debtRec : (r.debt || 0);
      if (Math.abs(dNew - dOld) > 0.009) {
        if (dNew > 0.009 || dOld > 0.009)
          out.push(assign({ entry_type: MF_DEBT, amount: r2(Math.max(0, dNew)),
                            note: dNew > 0.009 ? notes.short : (notes.noShort || "brought in full") }, jobFields(r)));
        if (dNew < -0.009 || dOld < -0.009)
          out.push(assign({ entry_type: MF_EXTRA, amount: r2(Math.max(0, -dNew)),
                            note: dNew < -0.009 ? notes.extra : (notes.noExtra || "no extra") }, jobFields(r)));
      }
      return out;
    }
    /* ONE Settle (or a correction of one) = ONE batch: the flow entry + the debt/extra entries the
       old popup decided. o = { type, amt, method, note, replaces: the entry corrected, or null }.
       A plain settle records the flow only when something changed (the old "Save records ONLY
       what changed"); a correction always names the entry it replaces and stays on its leg. */
    function settleItems(r, o) {
      var items = [], meth = normMethod(o.method), note = String(o.note || "").trim();
      if (o.amt != null) {
        var changed;
        if (o.replaces) {
          changed = Math.abs(o.amt - Math.abs(+o.replaces.amount || 0)) > 0.009
            || meth !== normMethod(o.replaces.method) || o.type !== (o.replaces.type || o.replaces.entry_type);
        } else {
          var newFlow = o.type === TAKEN ? -o.amt : o.amt;
          changed = r.flow == null || Math.abs(newFlow - r.flow) > 0.009 || meth !== normMethod(r.method);
        }
        if (changed) {
          var it = assign({ entry_type: o.type, amount: r2(o.amt), method: meth,
                            note: note || (o.replaces ? "corrected" : "confirmed") }, jobFields(r));
          if (o.replaces) {
            it.replaces_id = o.replaces.id;
            if (o.replaces.event_id) it.event_id = o.replaces.event_id;
            if (o.replaces.job_code) it.job_code = o.replaces.job_code;
          }
          items.push(it);
        }
      }
      if (r.expected != null && o.fix && o.amt != null) {
        // THE NET CASH WAS WRONG: the job's figure is corrected to what he handed over, and any
        // short / extra already moved for this job comes back off his balance (2026-10-09).
        // `o.fixEntry` = the job's current correction, replaced rather than stacked.
        var fx = assign({ entry_type: NC_FIX, amount: fixedNetCash(r, o.type, o.amt), note: note }, jobFields(r));
        if (o.fixEntry) fx.replaces_id = o.fixEntry.id;
        items.push(fx);
        items = items.concat(debtItems(r, 0, { short: "", extra: "" }));
      } else if (r.expected != null) {
        items = items.concat(debtItems(r, debtOfEntry(r, o.type, o.amt).debt, {
          short: "short hand-in" + (note ? " — " + note : ""),
          extra: "extra hand-in repays his balance" + (note ? " — " + note : ""),
          noShort: "brought in full" + (note ? " — " + note : ""),
          noExtra: "no extra" + (note ? " — " + note : "") }));
      }
      return items;
    }
    /* A JOB EXPENSE (2026-10-09): what was spent on the job that the contract doesn't carry. One
       entry per expense; `old` = the expense being changed. Withdrawing takes one back entirely:
       the server keeps it as history, never current. */
    function expenseItem(r, amt, note, old) {
      var it = assign({ entry_type: JOB_EXP, amount: r2(amt), note: String(note || "").trim() }, jobFields(r));
      if (old) {
        it.replaces_id = old.id;
        if (old.event_id) it.event_id = old.event_id;
        if (old.job_code) it.job_code = old.job_code;
      }
      return it;
    }
    function withdrawItem(r, en, why) {
      var it = assign({ entry_type: en.type, amount: r2(+en.amount || 0), note: String(why || "").trim(),
                        replaces_id: en.id, withdraw: true }, jobFields(r));
      if (en.event_id) it.event_id = en.event_id;          // stays on the leg it was recorded on
      if (en.job_code) it.job_code = en.job_code;
      return it;
    }
    // what the Settle panel says will happen; balNow = his foreman balance right now
    // fix = "the job's net cash is wrong" picked (2026-10-09); `canFix` says the choice applies at
    // all: the amount differs from what the job asks for
    function settleEffect(r, type, amt, balNow, fix) {
      if (r.expected == null) return { kind: "info", title: "No contract yet",
        line: "Nothing to compare with: the job’s balance is worked out when the contract comes in." };
      if (amt == null) return { kind: "info", title: "Enter the amount", line: "" };
      var d = debtOfEntry(r, type, amt), dOld = r.debt || 0, after = r2(balNow - dOld + d.debt);
      var canFix = Math.abs(d.debt) > 0.005 || Math.abs(d.balance) > MF_TOL;
      if (fix && canFix) {
        var t = fixedNetCash(r, type, amt), was = r.recorded != null ? r.recorded : r.expected, a0 = r2(balNow - dOld);
        return { kind: "fix", canFix: true, after: a0, fixTo: t,
          title: "The job’s net cash becomes " + money2(t) + " — the contract says " + money2(was),
          line: "The job is settled on what he handed over; nothing goes on his balance ("
            + (Math.abs(a0 - balNow) > 0.005 ? owesText(balNow) + " → " + owesText(a0) : "stays at " + owesText(balNow))
            + "). The job is flagged until the contract or closing says " + money2(t) + "." };
      }
      var balLine = Math.abs(after - balNow) > 0.005
        ? "His balance: " + owesText(balNow) + " → " + owesText(after) + "."
        : "His balance stays at " + owesText(balNow) + ".";
      if (d.debt > 0.005) return { kind: "short", canFix: canFix, title: money2(d.debt) + " short — goes on his balance",
        line: "The job is settled. " + balLine, after: after };
      if (d.debt < -0.005) return { kind: "extra", canFix: canFix, title: money2(-d.debt) + " extra — comes off his balance",
        line: "The job is settled. " + balLine, after: after };
      if (Math.abs(d.balance) <= MF_TOL) return { kind: "ok", title: "Settles the job in full", line: balLine, after: after };
      // only a pay-out can land here: taken away, and not the amount the job asks for
      return { kind: "short", canFix: canFix, title: "The job stays " + money2(Math.abs(d.balance)) + " off",
        line: "It needs " + money2(Math.abs(d.balance)) + (d.balance < 0 ? " more paid to him." : " less paid to him.") + " " + balLine, after: after };
    }
    /* PAY OUT a to-the-foreman job (his decisions, 2026-10-07): first balance it against his open
       jobs where he holds money for the base (he ticks which, in list order). A ticked job worth
       MORE than what is left still settles; its leftover goes on his balance (Moved to Foreman
       Debt on THAT job). Whatever the ticked jobs don't cover is paid by a method (Cash default)
       or left on his balance (Extra Applied to Foreman Balance on the negative job = credit).
       Returns the linked batch, in order: the negative job first (its id becomes the link). */
    function payoutPlan(neg, cands, ticked, way, note) {
      var owed = r2(settle(neg).amount), left = owed, used = 0, leftover = 0;
      var seen = {}, nc = codeOf(neg.jobCode);
      if (nc) seen[nc] = 1;               // never offset against a leg of the same job
      var rows = cands.map(function (c) {
        var a = r2(settle(c).amount), on = !!ticked[c.ev], take = 0, kind = "off";
        var cc = codeOf(c.jobCode);
        if (on && cc) { if (seen[cc]) on = false; else seen[cc] = 1; }
        if (on) {
          take = r2(Math.min(a, left)); left = r2(left - take); used = r2(used + take);
          kind = take >= a - 0.005 ? "full" : take > 0.005 ? "part" : "unneeded";
          if (kind === "part") leftover = r2(leftover + a - take);
        }
        return { job: c, amount: a, on: on, take: take, kind: kind, rest: kind === "part" ? r2(a - take) : 0 };
      });
      var rest = left > 0.005 ? left : 0, toBal = rest > 0 && way === WAY_BAL;
      var nf = jobFields(neg), base0 = String(note || "").trim(), items = [];
      var taken = function (amt, method, extra) {
        return assign(assign({ entry_type: TAKEN, amount: r2(amt), method: method, note: base0 || "paid out" }, nf), extra || {});
      };
      if (!rest) items.push(taken(owed, "Offset"));
      else if (toBal) items.push(taken(used, "Offset"));
      else if (isCashMethod(way)) items.push(taken(owed, "Cash", used > 0.005 ? { cash_amount: rest } : null));
      else items.push(taken(owed, normMethod(way), { cash_amount: 0 }));
      items = items.concat(debtItems(neg, toBal ? -rest : 0,
        { short: "", extra: "left on his balance" + (base0 ? " — " + base0 : "") }));
      rows.forEach(function (x) {
        if (!(x.take > 0.005)) return;
        items.push(assign({ entry_type: BROUGHT, amount: x.take, method: "Offset",
          note: "balanced against " + (neg.customer || "a pay-out") + (neg.jobCode ? " · " + neg.jobCode : "") }, jobFields(x.job)));
        items = items.concat(debtItems(x.job, x.kind === "part" ? x.rest : 0,
          { short: "leftover of a job used in a pay-out", extra: "" }));
      });
      return { owed: owed, used: used, rest: rest, leftover: leftover, rows: rows, items: items,
               toBal: toBal, balDelta: r2(leftover - (toBal ? rest : 0)) };
    }
    // BULK = cash, in full, one foreman at a time
    function bulkItems(jobs) {
      return jobs.map(function (r) {
        return assign({ entry_type: BROUGHT, amount: r2(settle(r).amount), method: "Cash", note: "bulk confirmed" }, jobFields(r));
      });
    }
    /* ticking a job of ANOTHER foreman replaces the selection with that job; ticking a second
       leg of the SAME job code replaces the first leg (a batch takes one flow entry per job --
       the server answers 400 "this job is in the batch twice"). sel = { ev: job code || true } */
    function pickSel(sel, selFm, r, on) {
      var next = {}, code = codeOf(r.jobCode);
      Object.keys(sel || {}).forEach(function (k) { if (sel[k]) next[k] = sel[k]; });
      if (!on) {
        delete next[r.ev];
        return { sel: next, selFm: Object.keys(next).length ? selFm : null };
      }
      if (selFm != null && selFm !== r.forman) next = {};
      if (code) Object.keys(next).forEach(function (k) { if (next[k] === code && k !== r.ev) delete next[k]; });
      next[r.ev] = code || true;
      return { sel: next, selFm: r.forman };
    }
    // only what is ON SCREEN stays ticked (the old page confirmed hidden ticks too -- a bug)
    function pruneSel(sel, visible) {
      var next = {};
      Object.keys(sel || {}).forEach(function (k) { if (sel[k] && visible[k]) next[k] = sel[k]; });
      return next;
    }
    // the last guard before a batch: one row per job code (the first one wins)
    function onePerJob(jobs) {
      var seen = {};
      return jobs.filter(function (r) {
        var c = codeOf(r.jobCode) || "ev:" + bareEv(r.ev);
        if (seen[c]) return false;
        seen[c] = 1; return true;
      });
    }
    // Cash is built in; the rest come from mf_methods, ON and offered in that direction
    function methodsFor(list, dir) {
      var key = dir === "out" ? "pay_out" : "money_in";
      return [{ id: 0, name: "Cash", builtin: true }].concat((list || []).filter(function (m) {
        return +m.is_on && +m[key] && !isCashMethod(m.name) && m.name !== "Offset";
      }));
    }
    /* ====================== END MF LOGIC (pure) ====================== */

    // ---------- live overlay (same rules as src/money_flow.py) ----------
    // MEMOIZED (2026-07-21): recomputing 3.5k rows' statuses on EVERY repaint cost ~1s. The
    // result only changes when the DATA changes (loadLive / patchLive), so those invalidate it.
    var _ov = null, _ix = null;
    function overlaid() {
      if (_ov) return _ov;
      var liveByEv = {};
      if (S.live) S.live.rows.forEach(function (r) { liveByEv[r.ev] = r; });
      // the live read lists every current correction and expense (a bridge from 2026-10-09 on)
      var liveParts = !!(S.live && S.live.rows.some(function (r) { return r.recorded !== undefined; }));
      _ov = base.map(function (b) {
        var ev = b["Event ID"], lv = liveByEv[ev];
        var r = {
          ev: ev, date: String(b["Job Date"]).slice(0, 10), title: b["Event Title"],
          jobNo: b["Job No"], jobCode: b["Job Code"], customer: b["Customer"],
          forman: b["Forman"] || MF_NO_FOREMAN, formanEmail: b["Forman Email"],
          jobType: b["Job Type"], ct: b["Contract Type"], company: b["Company"] || "",
          expected: num(lv && lv.expected != null ? lv.expected : b["Expected Net Cash"]),
          // THE PARTS OF IT (2026-10-09): the contract / closing figure, the office's correction,
          // the job's expenses. The live read carries every current correction and expense, so
          // with it up a job it doesn't list has none (the 6-hourly fact may still hold one that
          // was withdrawn since); an older bridge sends no `recorded` and its `expected` stands.
          recorded: lv && lv.recorded !== undefined ? lv.recorded
            : num(b["Net Cash (Recorded)"] !== undefined ? b["Net Cash (Recorded)"] : b["Expected Net Cash"]),
          fix: lv && lv.recorded !== undefined ? lv.fix : liveParts ? null : num(b["Net Cash Corrected"]),
          exp: lv && lv.recorded !== undefined ? (lv.exp || 0) : liveParts ? 0 : (num(b["Job Expenses"]) || 0),
          closingNC: num(b["Net Cash (Closing)"]),
          flow: lv ? (lv.flow != null ? lv.flow : null) : num(b["Cash Flow"]),
          flowTs: lv ? lv.flow_ts : b["Cash Flow Time"],
          flowSrc: lv ? lv.flow_src : b["Cash Flow Source"],
          // how the winning flow record came in: 'Cash' (old rows), 'Offset' or a method name
          method: lv && lv.method !== undefined ? (lv.method || null) : (b["Cash Flow Method"] || null),
          adv: lv ? lv.adv : num(b["Advance"]),
          ded: lv ? lv.ded : num(b["Deduction"]),
          // a short hand-in MOVED TO HIS DEBT (29 Sep): the job is settled, he owes it instead
          debt: lv ? (lv.debt != null ? lv.debt : null) : num(b["Moved to Debt"]),
          // what was moved when the job was settled; `debt` becomes what of it still COUNTS below
          debtRec: lv ? (lv.debt_moved !== undefined ? lv.debt_moved : (lv.debt != null ? lv.debt : null))
            : num(b["Moved to Debt (Recorded)"] !== undefined ? b["Moved to Debt (Recorded)"] : b["Moved to Debt"]),
          baseAdv: num(b["Advance"]),
          contractUrl: b["Contract URL"] || null,
          dcTs: b["DC Submission Time"] || null,
          calendarId: b["Calendar ID"] || null,
          baseStatus: b["Status"],
          // the live overlay's word that this is a second leg whose only cash repeats the money
          // leg's (src/money_flow.py _ECHO_LEG): it expects nothing
          echoLeg: !!(lv && lv.sib),
        };
        if (!(lv && lv.recorded === undefined)) r.expected = effExpected(r.recorded, r.fix, r.exp);
        if (r.echoLeg) r.expected = null;
        else if (r.expected == null && r.closingNC != null) {
          r.recorded = r.closingNC; r.expected = effExpected(r.closingNC, r.fix, r.exp);
        }
        // DEPLOY-SKEW GUARD: an older bridge serves "taken away" advances UNSIGNED (+A) while the
        // nightly fact knows the true −A. When the two differ ONLY by sign, trust the negative.
        if (lv && r.adv != null && r.baseAdv != null && r.adv > 0 && r.baseAdv < 0
            && Math.abs(r.adv + r.baseAdv) < 0.01) r.adv = r.baseAdv;
        // Balance = Expected − Advance − Flow + Deduction − Debt — the original system's formula
        // ...minus what of a short / extra still counts (2026-10-09, countedMove)
        r.need = (r.expected == null) ? null : r2(r.expected - (r.adv || 0) - (r.flow || 0) + (r.ded || 0));
        r.debt = r.need == null ? r.debtRec : countedMove(r.debtRec, r.need);
        r.balance = (r.expected == null) ? null : r.need - (r.debt || 0);
        r.status = computeStatus(r);
        return r;
      });
      // lookups the panels need, built once per data change
      _ix = { byEv: {}, legs: {} };
      _ov.forEach(function (r) {
        _ix.byEv[bareEv(r.ev)] = r;
        var c = codeOf(r.jobCode);
        if (c) (_ix.legs[c] = _ix.legs[c] || []).push(r);
      });
      return _ov;
    }
    function idx() { overlaid(); return _ix; }
    function rowByEv(ev) { return idx().byEv[bareEv(ev)] || null; }
    function computeStatus(r) {
      var jt = String(r.jobType || "");
      if (r.baseStatus === "Filter Out" || jt === "Box Delivery" || jt === "In-Home Estimate"
          || jt === "Cancelled" || jt === "On Hold" || !String(r.jobNo || "").trim()
          || /cancel|cancl|canel|o[n]?[ -]?hold/i.test(String(r.title || ""))) return "Filter Out";
      if (r.date > todayIso) return "Job is in the Future";
      // a second leg whose only cash repeats the money leg's: its closing is carried, and its
      // cash counted, on that sibling -- NOT "Missing Closing" (2026-10-07)
      if (r.echoLeg && r.expected == null) return "Tracked on Sibling Event";
      if (r.baseStatus === "Tracked on Sibling Event" && r.expected == null) return "Tracked on Sibling Event";
      // this event has NO closing row of its own — a real gap in the closing sheet
      if (r.baseStatus === "Missing Closing" && r.expected == null) return "Missing Closing";
      if (r.expected == null) return "Contract Not Received";
      if (r.flow == null && Math.abs(r.balance == null ? 0 : r.balance) > MF_TOL) return "Money Not Received";
      if (Math.abs(r.balance == null ? 0 : r.balance) <= MF_TOL) return "Money Received";
      return "Not in Balance";
    }
    // Waiting = the open worklist; Missing Closing is a "needs a look" only (the closing sheet
    // has to be fixed first, so there is nothing to collect yet)
    var MAINSET = { "Money Not Received": 1, "Contract Not Received": 1, "Not in Balance": 1 };
    var NEED = {
      cnr: { status: "Contract Not Received", pill: "No contract", head: "Jobs with no contract yet",
             sub: "Nobody can say what is owed until the contract comes in. Enter cash by hand only if he really handed some over." },
      nib: { status: "Not in Balance", pill: "Doesn’t add up", head: "Jobs that don’t add up",
             sub: "Money was recorded, but not the amount the closing asks for. Open one to see its story and add a correction." },
      mc: { status: "Missing Closing", pill: "No closing", head: "Jobs with no closing",
            sub: "The calendar has the job; the closing sheet doesn’t, so there’s no net cash to settle. File the closing first." },
      // 2026-10-09: settled on a corrected net cash; the contract / closing still says another figure
      fix: { status: "Money Received", pill: "Net cash to fix", head: "Jobs whose net cash was corrected",
             sub: "The foreman handed over the right amount, but the contract or closing still says another figure. Fix it there — the flag clears by itself." },
    };
    function needOf(r) {
      return r.status === "Contract Not Received" ? "cnr" : r.status === "Not in Balance" ? "nib"
        : r.status === "Missing Closing" ? "mc"
        : !MAINSET[r.status] && r.status !== "Filter Out" && fixOpen(r) ? "fix" : "";
    }

    /* REPEAT CONFIRMATIONS (2026-10-07). Five long-distance jobs read "Money Not Received" for
       weeks because the cash had been put on the job's other calendar leg, so the office
       confirmed the same amount again -- 26 times in all. A cash entry that repeats the amount
       the JOB already had confirmed (any leg of the same job code) is marked `_repeatOf` and shown
       as a repeat, not counted. The server now refuses repeats outright (409). */
    function cashSign(en) {
      if (en.type === BROUGHT) return 1;
      if (en.type === TAKEN) return -1;
      return 0;
    }
    var _byCode = {}, _byEvB = {}, _byLink = {}, _byId = {};
    function indexEntries() {
      _byCode = {}; _byEvB = {}; _byLink = {}; _byId = {};
      var last = {};                       // job -> stream -> the last current entry
      var all = ((S.live && S.live.entries) || []).slice().sort(function (a, b) {
        return String(a.at || "") < String(b.at || "") ? -1 : String(a.at || "") > String(b.at || "") ? 1 : 0;
      });
      var replaced = {};
      all.forEach(function (en) { if (en.replaces != null) replaced[en.replaces] = 1; });
      all.forEach(function (en) {
        var k = en.event_id || "", c = codeOf(en.job_code);
        if (c) (_byCode[c] = _byCode[c] || []).push(en);
        (_byEvB[bareEv(k)] = _byEvB[bareEv(k)] || []).push(en);
        if (en.link_id != null) (_byLink[en.link_id] = _byLink[en.link_id] || []).push(en);
        if (en.id != null) _byId[en.id] = en;
        en._repeatOf = null;
        // a WITHDRAWN correction / expense (2026-10-09): never current, names what it retired,
        // and nothing replaced it in turn
        en._withdrawn = !!en.withdrawn || ((en.type === NC_FIX || en.type === JOB_EXP) && !en.current
          && en.replaces != null && !replaced[en.id]);
        // two expenses of the same amount are two expenses, not a repeat
        if (!en.current || en.type === JOB_EXP || en.type === NC_FIX) return;
        var job = c || k;
        var sg = cashSign(en), stream = sg ? "cash" : String(en.type || "");
        var val = sg ? sg * Math.abs(+en.amount || 0) : +en.amount || 0;
        var prev = (last[job] = last[job] || {})[stream];
        if (prev && Math.abs(prev.val - val) < 0.005) en._repeatOf = prev.en;
        last[job][stream] = { val: val, en: en };
      });
    }
    /* the entries of ONE LEG (calendar event), oldest first. THE SERVER'S REPEAT RULE (narrowed
       2026-10-07): a second confirmation is refused on the SAME leg, or on another leg of the
       same job code with the SAME amount (the Ruth echo case). A different amount on another leg
       is allowed -- some jobs genuinely collect on both days (LM6-3791: $550 + $866, two
       closings). So "already confirmed -> correction" is decided per leg; the story still shows
       every leg. Entries with no event id fall back to the job code. */
    function jobEntriesOf(r) {
      var code = codeOf(r.jobCode), evb = bareEv(r.ev);
      var out = (_byEvB[evb] || []).slice();
      if (code) (_byCode[code] || []).forEach(function (e) { if (!bareEv(e.event_id)) out.push(e); });
      return out.sort(function (a, b) { return String(a.at || "") < String(b.at || "") ? -1 : 1; });
    }
    // every leg's entries (the job story)
    function storyEntriesOf(r) {
      var code = codeOf(r.jobCode);
      if (!code) return jobEntriesOf(r);
      var seen = {}, out = [];
      var add = function (e) { var k = e.id != null ? "i" + e.id : "o" + out.length; if (!seen[k]) { seen[k] = 1; out.push(e); } };
      (_byCode[code] || []).forEach(add);
      (idx().legs[code] || [r]).forEach(function (l) {
        (_byEvB[bareEv(l.ev)] || []).forEach(function (e) { if (!codeOf(e.job_code)) add(e); });
      });
      return out.sort(function (a, b) { return String(a.at || "") < String(b.at || "") ? -1 : 1; });
    }
    // the CURRENT portal confirmations of a leg (Brought / Taken), oldest first. One of these =
    // the leg is confirmed; the server refuses another without a replaces_id.
    function portalFlowsOf(r) {
      return jobEntriesOf(r).filter(function (e) { return e.current && cashSign(e) !== 0; });
    }
    function portalFlow(r) { var l = portalFlowsOf(r); return l.length ? l[l.length - 1] : null; }

    // OPTIMISTIC UPDATE: we know exactly what was saved — patch the in-memory overlay, repaint
    // INSTANTLY, and let the real refresh reconcile silently in the background.
    function patchLive(it, newId, linkId) {
      if (!S.live || !S.live.rows) return;
      var evId = it.event_id, type = it.entry_type, amount = it.amount;
      var lv = null;
      for (var i = 0; i < S.live.rows.length; i++) if (bareEv(S.live.rows[i].ev) === bareEv(evId)) { lv = S.live.rows[i]; break; }
      if (!lv) {
        var b = rowByEv(evId);
        lv = { ev: b ? b.ev : evId, expected: b ? b.expected : null, flow: b ? b.flow : null,
               flow_ts: b ? b.flowTs : null, flow_src: b ? b.flowSrc : null, method: b ? b.method : null,
               records: 0, adv: b ? b.adv : null, adv_ts: null, ded: b ? b.ded : null,
               debt: b ? b.debtRec : null, debt_moved: b ? b.debtRec : null, sib: b && b.echoLeg ? 1 : 0,
               recorded: b ? b.recorded : null, fix: b ? b.fix : null, exp: b ? b.exp || 0 : 0 };
        S.live.rows.push(lv);
      }
      var nowTs = new Date().toISOString().slice(0, 16).replace("T", " ");
      if (type === BROUGHT || type === TAKEN) {
        lv.flow = type === TAKEN ? -amount : amount; lv.flow_ts = nowTs; lv.flow_src = "portal";
        lv.method = normMethod(it.method); lv.records = (lv.records || 0) + 1;
      }
      else if (type === "Advance Payment") { lv.adv = amount; lv.adv_ts = nowTs; }
      else if (type === "Forman Deduction") { lv.ded = amount; }
      // `debt` is signed: + shortfall moved to his debt, - extra applied to his balance; a $0 of
      // one kind only clears that kind
      else if (type === MF_DEBT || type === MF_EXTRA) {
        // the RECORDED stream (`debt_moved`); the overlay works out what of it counts
        var rec = lv.debt_moved !== undefined ? lv.debt_moved : lv.debt;
        if (type === MF_DEBT) { if (amount > 0) rec = amount; else if ((rec || 0) > 0) rec = 0; }
        else { if (amount > 0) rec = -amount; else if ((rec || 0) < 0) rec = 0; }
        lv.debt_moved = rec; lv.debt = rec;
      }
      if (S.live.entries) {
        if (it.replaces_id != null) S.live.entries.forEach(function (e) { if (e.id === it.replaces_id) e.current = false; });
        S.live.entries.push({ id: newId != null ? newId : "tmp" + Date.now() + Math.random(), event_id: evId,
          job_code: it.job_code || "", type: type, amount: amount, note: it.note || "",
          method: (type === BROUGHT || type === TAKEN) ? normMethod(it.method) : null,
          cash_amount: it.cash_amount != null ? it.cash_amount : null, link_id: linkId != null ? linkId : null,
          at: nowTs, by: "you", replaces: it.replaces_id != null ? it.replaces_id : null,
          current: it.withdraw ? 0 : 1, withdrawn: !!it.withdraw });
      }
      // a correction / an expense: re-read the leg's current ones from the entries just patched
      if ((type === NC_FIX || type === JOB_EXP) && S.live.entries) {
        var fx = null, ex = 0;
        S.live.entries.forEach(function (e) {
          if (!e.current || bareEv(e.event_id) !== bareEv(lv.ev)) return;
          if (e.type === NC_FIX && (!fx || String(e.at) >= String(fx.at))) fx = e;
          else if (e.type === JOB_EXP) ex += Math.abs(+e.amount || 0);
        });
        lv.fix = fx ? +fx.amount : null; lv.exp = r2(ex);
        if (lv.recorded === undefined) lv.recorded = lv.expected;
        lv.expected = effExpected(lv.recorded, lv.fix, lv.exp);
      }
      indexEntries();
      _ov = null;   // data changed — recompute the overlay on the next paint
    }

    /* WHY A SAVE FAILED, in words. The causes we know get a sentence that says what to do;
       anything else keeps the server's own words. A batch is all or nothing, so a failed batch
       always says nothing was saved. */
    function saveError(res, j, ctx) {
      ctx = ctx || {};
      var code = res ? res.status : 0, msg = (j && j.error) || "";
      if (code === 401) return "Your sign-in has expired. Reload the page and sign in again. Nothing was saved.";
      if (code === 403) return "Your account isn’t allowed to record Money Flow. Ask Tornike for access.";
      if (code === 503)   // "update pending" (the database step hasn't run) or "busy, retry"
        return (msg || "Money Flow update pending — the database step hasn’t run yet").replace(/[.\s]+$/, "") + ". Nothing was saved.";
      if (code === 409 && j && j.already) {
        var a = (j && j.already) || {};
        return "This job is already confirmed" + (a.amount != null ? " (" + money2(+a.amount) + " · " + normMethod(a.method)
          + (a.by ? " by " + shortBy(a.by) : "") + (a.at ? ", " + fmtTs(a.at) : "") + ")" : "")
          + ". The same money can’t be confirmed twice — add a correction instead. Nothing was saved.";
      }
      if (code === 409) return "Someone changed this a moment ago. The page is reloading it — try again in a moment. Nothing was saved.";
      if (code === 404 && ctx.methods) return "Money Flow update pending — payment methods can’t be changed until the server is updated.";
      if (ctx.batch && code === 400 && /entry_type must be one of/i.test(msg))
        return "Money Flow update pending — the server doesn’t take this kind of save yet. Nothing was saved.";
      var who = "";
      if (ctx.items && j && j.index != null && ctx.items[j.index]) {
        var bad = ctx.items[j.index];
        who = (bad.customer || bad.job_code || "One of the jobs") + ": ";
      }
      if (/amount must be positive/i.test(msg)) return who + "Enter the amount without a minus sign. Nothing was saved.";
      if (/amount must be a number/i.test(msg)) return who + "The amount is not a number. Nothing was saved.";
      if (/over \$1M/i.test(msg)) return who + "That amount looks wrong (over $1,000,000). Check the number. Nothing was saved.";
      if (/event_id or job_code required/i.test(msg)) return who + "This row has no job code or calendar event, so it cannot be saved. Tell Tornike which job it is.";
      if (code >= 500 || !code) return "The server did not answer (" + (msg || ("HTTP " + code)) + "). Wait a minute and try again. Nothing was saved.";
      return who + (msg || ("HTTP " + code)) + ". Nothing was saved.";
    }
    function netWords(e) {
      var why = String(e && e.message || e);
      return /Failed to fetch|NetworkError|Load failed/i.test(why) ? "No connection to the server — check the internet and try again. Nothing was saved." : why;
    }

    /* A FAILURE INSIDE A PANEL IS SHOWN IN THE PANEL. Any exception the page itself throws while a
       Money Flow panel is open lands in that panel's error line, with the buttons released. (An
       undefined variable in the save path once broke every save for four days, silently.) */
    if (!window.__MF_ERR_HOOK) {
      window.__MF_ERR_HOOK = true;
      var showPageErr = function (msg) {
        var d = document.getElementById("mfDrawer");
        if (!d || !d.classList.contains("mf-show")) return;
        var el = d.querySelector("#mfDErr");
        if (el) el.innerHTML = '<div class="mf-errbox">Something went wrong on this page (' + RSC.esc(String(msg || "unknown error"))
          + "). Nothing was saved. Tell Tornike — a screenshot of this message is enough.</div>";
        var v = d.querySelector(".mf-dveil"); if (v) v.remove();
        Array.prototype.forEach.call(d.querySelectorAll("button[disabled]"), function (b) { b.disabled = false; });
      };
      window.addEventListener("error", function (e) { showPageErr(e && e.message); });
      window.addEventListener("unhandledrejection", function (e) {
        var r = e && e.reason; showPageErr(r && (r.message || r)); });
    }

    async function loadLive(fresh) {
      try {
        var r = await fetch(ZTZ.API + "/api/_mf" + (fresh ? "?fresh=1" : ""),
          { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        S.live = await r.json(); S.liveOk = true; S.liveAt = Date.now(); indexEntries();
        _ov = null;   // data changed — recompute the overlay on the next paint
      } catch (e) { S.liveOk = false; S.liveErr = String(e && e.message || e); }
    }
    /* THE FOREMAN BALANCES (fines ledger). Kept separate from loadLive(): failing to load it must
       leave the rest of the page working, so the error is remembered and shown where it is used. */
    async function loadFines() {
      try {
        var r = await fetch(ZTZ.API + "/api/_ffines",
          { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
        var j = await r.json();
        if (!r.ok) throw new Error(j && j.error || ("HTTP " + r.status));
        S.fines = j; S.finesErr = "";
      } catch (e) { S.finesErr = String(e && e.message || e); }
    }
    async function postJson(path, body) {
      var res = await fetch(ZTZ.API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
        body: JSON.stringify(body),
      });
      var j = await res.json().catch(function () { return {}; });
      return { res: res, j: j };
    }

    // ---------- methods ----------
    // the bridge sends the list with /api/_mf; an older bridge doesn't, so the seed stands in
    // (read-only: nothing can be added or switched until the server is updated)
    function allMethods() {
      if (S.live && Array.isArray(S.live.methods)) return S.live.methods;
      return SEED_METHODS;
    }
    function methodsLive() { return !!(S.live && Array.isArray(S.live.methods)); }
    function methodsWritable() { return methodsLive() && allMethods().some(function (m) { return m.id != null; }); }
    /* WHY THE PAGE CAN'T TAKE A NON-CASH SAVE (2026-10-08). Two different causes read the same:
       the live sync failing (sign-in expired, network, a server error) and the server really
       missing the database step. Every note said "update pending", so on 8 Oct a failed sync read
       as "Money Flow can't be updated" although the database step had run the day before.
       offlineNote() names the first cause; null means the live sync is fine. */
    function offlineNote() {
      if (S.liveOk) return null;
      var e = String(S.liveErr || "");
      if (/\b40[13]\b/.test(e)) return "Your portal sign-in has expired — sign in again, then open this job again.";
      return "Money Flow can’t reach the server right now" + (e ? " (" + e + ")" : "") + " — press Refresh at the top of the page.";
    }
    function methodLabel(m) { var n = normMethod(m); return n === "Offset" ? "Against a job" : n; }

    // ---------- the foreman balances (bridge-computed; three answers would be three numbers) ----------
    function balRow(name) {
      var b = ((S.fines || {}).balances || []);
      for (var i = 0; i < b.length; i++) if (b[i].foreman === name) return b[i];
      return null;
    }
    function debtOf(name) { var b = balRow(name); return b ? (b.owes || 0) : 0; }
    function balCell(name) {
      if (S.finesErr) return '<span class="mf-dim">—</span>';
      if (!S.fines) return '<span class="mf-dim">…</span>';
      var n = debtOf(name);
      if (n > 0.005) return '<span class="mf-b mf-headc">owes ' + money(n) + "</span>";
      if (n < -0.005) return '<span class="mf-b mf-outc">base owes him ' + money(-n) + "</span>";
      return '<span class="mf-dim">$0</span>';
    }

    // ---------- scope: company + foremen (search is applied per list) ----------
    function inScope(r) {
      if (S.company && r.company !== S.company) return false;
      if (S.formen.length && S.formen.indexOf(r.forman) < 0) return false;
      return true;
    }
    // SEARCH EVERYTHING: customer, request #, job code, foreman — and plain numbers match amounts
    function matches(r, q) {
      if (!q) return true;
      if (String(r.customer || "").toLowerCase().indexOf(q) >= 0
        || String(r.jobNo || "").toLowerCase().indexOf(q) >= 0
        || String(r.jobCode || "").toLowerCase().indexOf(q) >= 0
        || String(r.forman || "").toLowerCase().indexOf(q) >= 0) return true;
      var qNum = q.replace(/[$,\s]/g, "");
      if (qNum && /^\d+$/.test(qNum)) {
        if (r.balance != null && String(Math.round(Math.abs(r.balance))).indexOf(qNum) >= 0) return true;
        if (r.expected != null && String(Math.round(Math.abs(r.expected))).indexOf(qNum) >= 0) return true;
        if (r.flow != null && String(Math.round(Math.abs(r.flow))).indexOf(qNum) >= 0) return true;
      }
      return false;
    }
    function dirOf(r) { return r.balance == null ? 0 : r.balance > MF_TOL ? 1 : r.balance < -MF_TOL ? -1 : 0; }
    // a job the bulk bar may confirm: waiting for cash, to the base, no confirmation yet
    function bulkable(r) {
      var p = settle(r);
      return r.status === "Money Not Received" && !!p && p.type === BROUGHT && p.amount > MF_TOL && !portalFlow(r);
    }
    function jobModeOf(r) {
      if (portalFlow(r) || r.status === "Money Received") return "settled";
      if (r.expected == null) return "manual";
      return isPayout(r) ? "payout" : "settle";
    }

    // ---------- the toolbar (search, company, foremen, Settled dates, row height) ----------
    // painted on its own: typing in the search box repaints the list, never the box itself
    function paintTools() {
      var el = $("mfTools"); if (!el) return;
      el.innerHTML = '<label class="mf-search">' + ICON.search
        + '<input type="search" id="mfQ" placeholder="Find a job, customer or foreman" aria-label="Find a job, customer or foreman" value="' + esc(S.q) + '"></label>'
        + '<div id="mfCo"></div><div id="mfFm"></div>' + (S.view === "settled" ? '<div id="mfDt"></div>' : "")
        + '<div class="mf-dens" role="group" aria-label="Row height">'
        + '<button type="button" data-mfd="0" aria-pressed="' + (!S.compact) + '">Roomy</button>'
        + '<button type="button" data-mfd="1" aria-pressed="' + (!!S.compact) + '">Compact</button></div>';
      var rows = overlaid();
      var cos = {};
      rows.forEach(function (r) { if (r.company && r.status !== "Filter Out") cos[r.company] = (cos[r.company] || 0) + 1; });
      var coKeys = Object.keys(cos).sort();
      if (coKeys.length > 1) {
        RSC.localSelect($("mfCo"), { label: "Company", values: coKeys, value: S.company, allLabel: "All",
          onChange: function (v) { S.company = v || ""; S.sel = {}; S.selFm = null; paintTools(); paint(); } });
      }
      // the foremen of the CURRENT tab, with how many jobs each has there
      var cnt = {};
      var src = S.view === "settled" ? rows.filter(function (r) { return r.status === "Money Received"; })
        : rows.filter(function (r) { return MAINSET[r.status] || r.status === "Missing Closing"; });
      src.forEach(function (r) {
        if (S.company && r.company !== S.company) return;
        if (r.forman && r.forman !== MF_NO_FOREMAN) cnt[r.forman] = (cnt[r.forman] || 0) + 1;
      });
      if (S.view === "balances") ((S.fines || {}).balances || []).forEach(function (b) { if (b.entries > 0 && !(b.foreman in cnt)) cnt[b.foreman] = 0; });
      S.formen.forEach(function (f) { if (!(f in cnt)) cnt[f] = 0; });   // a pick stays untickable
      var fmKeys = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a] || a.localeCompare(b); });
      RSC.localMulti($("mfFm"), { label: "Foremen", emptyLabel: "All", selected: S.formen,
        values: fmKeys.map(function (f) { return { v: f, l: f, n: cnt[f] }; }),
        onChange: function (set) { S.formen = Array.from(set); paint(); } });
      if (S.view === "settled") {
        RSC.dateRange($("mfDt"), {
          get: function () { return { from: S.dateFrom, to: S.dateTo }; },
          set: function (f, t) { S.dateFrom = f || null; S.dateTo = t || null; },
          onChange: function () { paint(); } });
      }
      var q = $("mfQ");
      if (q) q.oninput = function () { S.q = q.value; paint(); };
      Array.prototype.forEach.call(el.querySelectorAll("[data-mfd]"), function (b) {
        b.onclick = function () {
          S.compact = b.getAttribute("data-mfd") === "1";
          var root = $("mfRoot"); if (root) root.classList.toggle("mf-compact", S.compact);
          Array.prototype.forEach.call(el.querySelectorAll("[data-mfd]"), function (x) {
            x.setAttribute("aria-pressed", String((x.getAttribute("data-mfd") === "1") === S.compact)); });
        };
      });
    }

    // ---------- the page body: KPIs, Needs a look, the queue ----------
    var _visible = {};    // jobs on screen that may be ticked (rebuilt by every paint)
    function paint() {
      // RACE GUARD: an in-flight load can resolve AFTER this page was torn down, or after a newer
      // open took over -- bail rather than paint into nothing.
      var body = $("mfBody");
      if (!body || myGen !== window.__MFGEN) return;
      // keep the reader's place -- on THIS tab only: a background repaint while Day Closing or the
      // guide is showing must not touch their scroll (it would stop a smooth scroll mid-way)
      var sc = topNow === "money-flow" ? document.getElementById("content") : null, st = sc ? sc.scrollTop : 0;
      var rows = overlaid();
      var scope = rows.filter(inScope);
      var main = scope.filter(function (r) { return MAINSET[r.status]; });
      var q = S.q.trim().toLowerCase();

      // KPIs: what is open, both directions
      var toBase = 0, nBase = 0, toFm = 0, nFm = 0, byFm = {};
      main.forEach(function (r) {
        var d = dirOf(r);
        if (d > 0) { toBase += r.balance; nBase++; byFm[r.forman] = (byFm[r.forman] || 0) + r.balance; }
        else if (d < 0) { toFm += -r.balance; nFm++; }
      });
      var top = Object.keys(byFm).sort(function (a, b) { return byFm[b] - byFm[a]; })[0];
      var needs = { cnr: [], nib: [], mc: [], fix: [] };
      scope.forEach(function (r) { var n = needOf(r); if (n) needs[n].push(r); });
      var nLook = needs.cnr.length + needs.nib.length + needs.mc.length + needs.fix.length;
      if (S.need && !(needs[S.need] || []).length) S.need = "";
      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi"><span class="mf-kl">Foremen owe the base</span><span class="mf-kv">' + money(toBase) + "</span>"
        + '<span class="mf-ks">' + nBase + " job" + (nBase === 1 ? "" : "s") + (top ? " · most with " + esc(top) + ", " + money(byFm[top]) : "") + "</span></div>"
        + '<div class="mf-kpi mf-kpi-out"><span class="mf-kl">The base owes foremen</span><span class="mf-kv">' + money(toFm) + "</span>"
        + '<span class="mf-ks">' + nFm + " job" + (nFm === 1 ? "" : "s") + " · balanced against other jobs or paid out</span></div>"
        + '<div class="mf-kpi mf-kpi-look"><span class="mf-kl">Needs a look</span><span class="mf-kv">' + nLook + " job" + (nLook === 1 ? "" : "s") + "</span>"
        + '<span class="mf-ks">Someone has to check or fix each one</span></div></div>';

      // NEEDS A LOOK: three cards, each filters the queue to its jobs
      var card = function (key, n, title, line) {
        if (!n) return "";
        return '<div class="mf-needc' + (S.need === key ? " mf-on" : "") + '"><div class="mf-needt"><span class="mf-needn">' + n + "</span>"
          + '<span class="mf-b">' + title + "</span></div><p>" + line + "</p>"
          + '<button type="button" class="mf-needbtn" data-mfa="need" data-v="' + key + '">'
          + (S.need === key ? "Showing them below" : "Open the " + n + " job" + (n === 1 ? "" : "s")) + "</button></div>";
      };
      var oldest = needs.cnr.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; })[0];
      var widest = needs.nib.slice().sort(function (a, b) { return Math.abs(b.balance || 0) - Math.abs(a.balance || 0); })[0];
      var nl = nLook ? '<section class="mf-need" aria-labelledby="mfNeedH"><h2 class="mf-h2" id="mfNeedH">Needs a look</h2><div class="mf-needs">'
        + card("cnr", needs.cnr.length, "job" + (needs.cnr.length === 1 ? " has" : "s have") + " no contract yet",
            "Nobody can say what is owed until the contract comes in." + (oldest ? " Oldest: " + esc(oldest.customer || "—") + ", " + fmtShort(oldest.date) + "." : ""))
        + card("nib", needs.nib.length, "job" + (needs.nib.length === 1 ? " doesn’t" : "s don’t") + " add up",
            "Money was recorded, but not the amount the closing asks for." + (widest ? " Widest gap: " + esc(widest.customer || "—") + ", " + money(Math.abs(widest.balance)) + "." : ""))
        + card("mc", needs.mc.length, "job" + (needs.mc.length === 1 ? " has" : "s have") + " no closing",
            "The calendar has the job; the closing sheet doesn’t, so there’s no net cash to settle.")
        + card("fix", needs.fix.length, "job" + (needs.fix.length === 1 ? "’s" : "s’") + " net cash to fix",
            "Settled on a corrected net cash. The contract or closing still says another figure — fix it there.")
        + "</div></section>" : "";

      // THE QUEUE
      var HEAD = {
        waiting: ["Waiting to settle", "Tick several jobs to confirm the cash a foreman brings in one go. Short or extra hand-ins and pay-outs are settled one job at a time."],
        settled: ["Settled lately", "Every confirmation, by foreman: whoever settled last comes first. Open a job to see its whole story."],
        balances: ["Foreman balances", "What each foreman owes outside his jobs (fines, advances, short and extra hand-ins, repayments), next to what his open jobs owe."],
      };
      var head = HEAD[S.view];
      if (S.view === "waiting" && S.need && NEED[S.need]) head = [NEED[S.need].head, NEED[S.need].sub];
      var nWait = S.need ? (needs[S.need] || []).length : main.length;
      var tabs = [["waiting", "Waiting · " + nWait], ["settled", "Settled"], ["balances", "Foreman balances"]];
      var content;
      _visible = {};
      if (S.view === "settled") content = settledHtml(scope, q);
      else if (S.view === "balances") content = balancesHtml(main, q);
      else {
        var set = S.need ? (needs[S.need] || []) : main;
        content = (S.need ? '<div class="mf-filt"><span>Showing ' + nWait + " " + esc(NEED[S.need].pill.toLowerCase()) + " job" + (nWait === 1 ? "" : "s") + ".</span>"
          + '<button type="button" class="mf-linkbtn" data-mfa="needclear">Show every waiting job</button></div>' : "")
          + waitingHtml(set.filter(function (r) { return matches(r, q); }), q);
      }
      var queue = '<section class="mf-q" aria-labelledby="mfQH">'
        + (S.busy ? '<div class="mf-veil"><div class="mf-spin"></div>Updating…</div>' : "")
        + '<div class="mf-qhead"><div class="mf-qtitle"><h2 id="mfQH">' + esc(head[0]) + "</h2><p>" + esc(head[1]) + "</p></div>"
        + '<div class="mf-tabs" role="tablist" aria-label="Show">'
        + tabs.map(function (t) {
            return '<button type="button" role="tab" aria-selected="' + (S.view === t[0]) + '" data-mfa="tab" data-v="' + t[0] + '">' + esc(t[1]) + "</button>";
          }).join("") + "</div></div>"
        + content + "</section>";
      body.innerHTML = kp + nl + queue;
      paintBulk();
      if (sc) sc.scrollTop = st;
      if (topNow === "month-close") paintMonth(false);   // only if what it shows has changed
    }

    // ---- Waiting: the open jobs, grouped by foreman ----
    var FM_TOP = 12, JOBS_TOP = 8;
    function waitingHtml(jobs, q) {
      var groups = {};
      jobs.forEach(function (r) {
        var f = r.forman || MF_NO_FOREMAN;
        var g = groups[f] || (groups[f] = { name: f, jobs: [], toBase: 0, toFm: 0, oldest: null });
        g.jobs.push(r);
        var d = dirOf(r);
        if (d > 0) g.toBase += r.balance; else if (d < 0) g.toFm += -r.balance;
        if (!g.oldest || r.date < g.oldest) g.oldest = r.date;
      });
      var names = Object.keys(groups).sort(function (a, b) {
        return groups[b].toBase - groups[a].toBase || groups[b].toFm - groups[a].toFm || a.localeCompare(b);
      });
      if (!names.length) return '<div class="mf-empty">' + (q ? "Nothing matches that search." : "Nothing is waiting. Every job is settled.") + "</div>";
      var all = S.allFm || !!q || !!S.need || S.formen.length > 0;
      var shown = all ? names : names.slice(0, FM_TOP);
      var html = '<div class="mf-scroll"><div class="mf-grid"><div class="mf-ghd"><span></span><span>Foreman</span><span>Jobs: to the base</span>'
        + "<span>Jobs: to him</span><span>His balance</span><span>Oldest job</span><span></span></div>";
      shown.forEach(function (f) { html += groupHtml(groups[f], q); });
      html += "</div></div>";
      if (shown.length < names.length) {
        html += '<div class="mf-qfoot"><button type="button" class="mf-btn mf-sm" data-mfa="allfm">Show every foreman ('
          + (names.length - shown.length) + " more)</button></div>";
      }
      return html;
    }
    function groupHtml(g, q) {
      var f = g.name, open = !!S.fmx[f] || !!q || !!S.need;
      var days = daysWaiting(g.oldest);
      var row = '<button type="button" class="mf-grow' + (open ? " mf-open" : "") + '" data-mfa="grp" data-v="' + esc(f) + '" aria-expanded="' + open + '">'
        + '<span class="mf-av">' + esc(initials(f)) + "</span>"
        + '<span class="mf-nm"><span class="mf-b">' + esc(f) + '</span><span class="mf-mut">' + g.jobs.length + " job" + (g.jobs.length === 1 ? "" : "s") + "</span></span>"
        + '<span class="mf-b">' + (g.toBase > 0.005 ? money(g.toBase) : '<span class="mf-dim">—</span>') + "</span>"
        + "<span>" + (g.toFm > 0.005 ? '<span class="mf-outc">' + money(g.toFm) + "</span>" : '<span class="mf-dim">—</span>') + "</span>"
        + "<span>" + balCell(f) + "</span>"
        + '<span class="' + (days > 30 ? "mf-old" : "") + '">' + fmtShort(g.oldest) + " · " + ageText(days) + "</span>"
        + '<span class="mf-chev">' + ICON.chev + "</span></button>";
      if (!open) return row;
      var bal = debtOf(f), net = g.toBase - g.toFm, all = bal + net;
      var jobs = g.jobs.slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
      var full = !!S.fmAll[f] || !!q || !!S.need;
      var vis = full ? jobs : jobs.slice(0, JOBS_TOP), hid = full ? [] : jobs.slice(JOBS_TOP);
      var elig = vis.filter(bulkable);
      elig.forEach(function (r) { _visible[r.ev] = true; });
      var allOn = elig.length > 0 && elig.every(function (r) { return S.sel[r.ev]; });
      var sub = '<div class="mf-gsub"><div class="mf-gline">'
        + "<span>Balance <b>" + (S.fines ? esc(owesText(bal)) : S.finesErr ? "—" : "…") + "</b> · fines, advances, short and extra hand-ins, repayments</span>"
        + "<span>" + (all >= -0.005 ? "All together he’d hand over <b>" + money(all) + "</b>" : "All together the base owes him <b>" + money(-all) + "</b>") + "</span>"
        + '<button type="button" class="mf-btn mf-sm mf-acc mf-push" data-mfa="fm" data-v="' + esc(f) + '">Open his balance</button></div>'
        + '<div class="mf-jhd"><span class="mf-ck">' + (elig.length
            ? '<input type="checkbox" data-mfselall="' + esc(f) + '"' + (allOn ? " checked" : "") + ' aria-label="Select all of ' + esc(firstName(f)) + '’s jobs to the base">' : "")
        + "</span><span>Job date</span><span>Job</span><span>Customer</span><span>Type</span><span class=\"mf-r\">Amount</span><span>Money goes</span><span>Waiting</span><span>Open</span><span></span></div>"
        + vis.map(jobRowHtml).join("");
      if (hid.length) {
        var hb = 0; hid.forEach(function (r) { if (dirOf(r) > 0) hb += r.balance; });
        sub += '<div class="mf-more"><button type="button" class="mf-morebtn" data-mfa="older" data-v="' + esc(f) + '">Show ' + hid.length + " older job" + (hid.length === 1 ? "" : "s")
          + (hb > 0.005 ? " · " + money(hb) + " to the base" : "") + " · oldest " + fmtShort(hid[hid.length - 1].date) + "</button></div>";
      }
      return row + sub + "</div>";
    }
    function jobRowHtml(r) {
      var d = dirOf(r), need = needOf(r), pf = portalFlow(r), can = bulkable(r);
      var ck = can ? '<label class="mf-ck"><input type="checkbox" data-mfsel="' + esc(r.ev) + '"' + (S.sel[r.ev] ? " checked" : "")
        + ' aria-label="Select ' + esc(r.customer || r.jobCode || "job") + '"></label>' : "<span></span>";
      var pill;
      if (need === "cnr") pill = '<span class="mf-pill mf-p-mute">No contract</span>';
      else if (need === "mc") pill = '<span class="mf-pill mf-p-mute">No closing</span>';
      else if (need === "nib") pill = '<span class="mf-pill mf-p-warn" title="Recorded, but not the amount the closing asks for">Doesn’t add up</span>';
      else if (need === "fix") pill = '<span class="mf-pill mf-p-warn" title="The contract says ' + esc(money2(r.recorded)) + ", corrected to " + esc(money2(r.fix)) + '">Net cash to fix</span>';
      else if (d < 0) pill = '<span class="mf-pill mf-p-out">' + ICON.toFm + "To the foreman</span>";
      else pill = '<span class="mf-pill mf-p-in">' + ICON.toBase + "To the base</span>";
      var act;
      if (need === "mc") act = '<span class="mf-dim mf-r">File the closing</span>';
      else if (need === "fix") act = '<button type="button" class="mf-act mf-act-mute" data-mfa="job" data-v="' + esc(r.ev) + '">Review</button>';
      else if (pf) act = '<button type="button" class="mf-act mf-act-mute" data-mfa="job" data-v="' + esc(r.ev) + '">Review</button>';
      else if (need === "cnr") act = '<button type="button" class="mf-act mf-act-mute" data-mfa="job" data-v="' + esc(r.ev) + '">Enter cash</button>';
      else if (isPayout(r)) act = '<button type="button" class="mf-act mf-act-out" data-mfa="job" data-v="' + esc(r.ev) + '">Pay out</button>';
      else act = '<button type="button" class="mf-act" data-mfa="job" data-v="' + esc(r.ev) + '">Settle</button>';
      return '<div class="mf-jrow">' + ck
        + '<span class="mf-mut mf-nowrap" title="' + esc(fmtD(r.date)) + '">' + fmtRowDate(r.date) + "</span>"
        + '<span class="mf-code" title="' + esc(r.jobCode || "") + '">' + esc(r.jobCode || "—") + "</span>"
        + '<button type="button" class="mf-cust" data-mfa="story" data-v="' + esc(r.ev) + '" title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</button>"
        + '<span class="mf-mut mf-ell">' + esc(r.jobType || "—") + "</span>"
        // a job to fix shows the gap between the contract and the correction, not its $0 balance
        + '<span class="mf-r mf-b">' + (need === "fix" ? money(Math.abs(r.fix - r.recorded))
            : r.balance == null ? '<span class="mf-dim">—</span>' : money(Math.abs(r.balance))) + "</span>"
        + pill
        + '<span class="mf-mut mf-nowrap">' + ageText(daysWaiting(r.date)) + "</span>"
        + rowLinksHtml(r)
        + act + "</div>";
    }
    // the 64px date column: "Oct 8" this year, "Nov 3 ’25" before (the long form wrapped onto two lines)
    function fmtRowDate(v) {
      if (!v) return "—";
      var s = fmtShort(v);
      return String(v).slice(0, 4) === todayIso.slice(0, 4) ? s : s.replace(/, (\d\d)(\d\d)$/, " ’$2");
    }
    /* CALENDAR + CONTRACT ON EVERY WAITING JOB (his ask, 2026-10-08: "so its easier for them to
       see"). The same two links the Settle panel's job card carries (jobLinksOf), as small buttons
       in a fixed two-slot cell so they line up from row to row; a job without one leaves its slot
       empty. They open in a new tab, and they are plain links -- no data-mfa -- so a click neither
       ticks the row nor opens a panel. Where the table is narrow they stack, still labelled (see the
       @container rule). */
    function rowLinksHtml(r) {
      var jl = jobLinksOf(r), who = r.customer || r.jobCode || "this job";
      var a = function (url, icon, label, tip) {
        return '<a class="mf-jlink" href="' + esc(url) + '" target="_blank" rel="noopener" title="' + esc(tip) + '" aria-label="' + esc(label + " · " + who) + '">'
          + icon + '<span class="mf-jlt">' + label + "</span></a>";
      };
      return '<span class="mf-jlinks">'
        + (jl.cal ? a(jl.cal, ICON.cal, "Calendar", "Open the Google Calendar event (new tab)") : "<span></span>")
        + (jl.contract ? a(jl.contract, ICON.doc, "Contract", "Open the digital contract (new tab)") : "<span></span>")
        + "</span>";
    }

    // ---- Settled: every confirmation, grouped by foreman (2026-10-08), newest first ----
    function settledKey(r) { return String(r.flowTs || r.date || ""); }
    function settledBy(r) {
      if (r.flowSrc === "dc") return "Contract";
      if (r.flowSrc === "form") return "Form";
      var pf = portalFlow(r);
      return pf ? shortBy(pf.by) : "—";
    }
    function settledRows(scope, q) {
      var cur = scope.filter(function (r) { return r.status === "Money Received"; });
      if (S.dateFrom) cur = cur.filter(function (r) { return settledKey(r).slice(0, 10) >= S.dateFrom; });
      if (S.dateTo) cur = cur.filter(function (r) { return settledKey(r).slice(0, 10) <= S.dateTo; });
      if (q) cur = cur.filter(function (r) { return matches(r, q); });
      return cur.sort(function (a, b) { var x = settledKey(a), y = settledKey(b); return x < y ? 1 : x > y ? -1 : 0; });
    }
    /* GROUPED BY FOREMAN (his ask, 2026-10-08: "the settled tab in money flow needs to be grouped
       by foreman"). The Waiting tab's pattern: one line per foreman -- his jobs settled in the date
       filter, what went to the base, what went to him, when he last settled -- opening to his
       settled jobs, newest first. The foreman who settled most recently comes first. A search
       narrows the jobs inside each foreman and opens every group it matches; the flat 150-row
       pager gave way to "Show N older jobs" per foreman and "Show every foreman". */
    function settledHtml(scope, q) {
      var cur = settledRows(scope, q);
      if (!cur.length) return '<div class="mf-empty">' + (q || S.dateFrom || S.dateTo ? "Nothing settled matches." : "Nothing confirmed yet.") + "</div>";
      var groups = {};
      cur.forEach(function (r) {          // cur is newest first, so each group's jobs are too
        var f = r.forman || MF_NO_FOREMAN;
        var g = groups[f] || (groups[f] = { name: f, jobs: [], toBase: 0, toFm: 0, last: "" });
        g.jobs.push(r);
        if (r.flow != null && r.flow > 0.005) g.toBase += r.flow;
        else if (r.flow != null && r.flow < -0.005) g.toFm += -r.flow;
        if (settledKey(r) > g.last) g.last = settledKey(r);
      });
      var names = Object.keys(groups).sort(function (a, b) {
        var x = groups[a].last, y = groups[b].last;
        return x < y ? 1 : x > y ? -1 : a.localeCompare(b);
      });
      var all = S.allSFm || !!q || S.formen.length > 0;
      var shown = all ? names : names.slice(0, FM_TOP);
      var html = '<div class="mf-scroll"><div class="mf-grid"><div class="mf-ghd mf-g-set"><span></span><span>Foreman</span><span>Jobs: to the base</span>'
        + "<span>Jobs: to him</span><span>Last settled</span><span></span></div>";
      shown.forEach(function (f) { html += settledGroupHtml(groups[f], q); });
      html += "</div></div>";
      if (shown.length < names.length) {
        html += '<div class="mf-qfoot"><button type="button" class="mf-btn mf-sm" data-mfa="sallfm">Show every foreman ('
          + (names.length - shown.length) + " more)</button></div>";
      }
      return html;
    }
    function settledAgo(v) {
      var n = daysWaiting(v);
      return n === 0 ? "today" : n === 1 ? "yesterday" : n + " days ago";
    }
    function settledGroupHtml(g, q) {
      var f = g.name, open = !!S.sfx[f] || !!q;
      var row = '<button type="button" class="mf-grow mf-g-set' + (open ? " mf-open" : "") + '" data-mfa="sgrp" data-v="' + esc(f) + '" aria-expanded="' + open + '">'
        + '<span class="mf-av">' + esc(initials(f)) + "</span>"
        + '<span class="mf-nm"><span class="mf-b">' + esc(f) + '</span><span class="mf-mut">' + g.jobs.length + " job" + (g.jobs.length === 1 ? "" : "s") + " settled</span></span>"
        + '<span class="mf-b">' + (g.toBase > 0.005 ? money(g.toBase) : '<span class="mf-dim">—</span>') + "</span>"
        + "<span>" + (g.toFm > 0.005 ? '<span class="mf-outc">' + money(g.toFm) + "</span>" : '<span class="mf-dim">—</span>') + "</span>"
        + '<span class="mf-ell">' + fmtShort(g.last) + " · " + settledAgo(g.last) + "</span>"
        + '<span class="mf-chev">' + ICON.chev + "</span></button>";
      if (!open) return row;
      var full = !!S.sfAll[f] || !!q;
      var vis = full ? g.jobs : g.jobs.slice(0, JOBS_TOP), hid = full ? [] : g.jobs.slice(JOBS_TOP);
      var sub = '<div class="mf-gsub">'
        + (f !== MF_NO_FOREMAN ? '<div class="mf-gline"><span>Balance <b>' + (S.fines ? esc(owesText(debtOf(f))) : S.finesErr ? "—" : "…") + "</b> · fines, advances, short and extra hand-ins, repayments</span>"
            + '<button type="button" class="mf-btn mf-sm mf-acc mf-push" data-mfa="fm" data-v="' + esc(f) + '">Open his balance</button></div>' : "")
        + '<div class="mf-shd"><span></span><span>Settled</span><span>Job</span><span>Customer</span>'
        + '<span>Method</span><span class="mf-r">Amount</span><span>Money went</span><span>By</span></div>'
        + vis.map(settledRowHtml).join("");
      if (hid.length) {
        sub += '<div class="mf-more"><button type="button" class="mf-morebtn" data-mfa="solder" data-v="' + esc(f) + '">Show ' + hid.length + " older job" + (hid.length === 1 ? "" : "s")
          + " · oldest settled " + fmtShort(settledKey(hid[hid.length - 1])) + "</button></div>";
      }
      return row + sub + "</div>";
    }
    // a settled job: the columns the flat list had (the foreman is the group now); a click opens it settled
    function settledRowHtml(r) {
      var amt = r.flow == null ? 0 : Math.abs(r.flow);
      return '<div class="mf-srow" role="button" tabindex="0" data-mfa="job" data-v="' + esc(r.ev) + '"><span></span>'
        + '<span class="mf-mut mf-nowrap">' + fmtShort(settledKey(r)) + "</span>"
        + '<span class="mf-code">' + esc(r.jobCode || "—") + "</span>"
        + '<span class="mf-custt mf-ell" title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</span>"
        + '<span class="mf-pill mf-p-mute">' + esc(methodLabel(r.method)) + "</span>"
        + '<span class="mf-r mf-b">' + money(amt) + "</span>"
        + '<span class="mf-mut">' + (r.flow == null || Math.abs(r.flow) < 0.005 ? "Nothing to move" : r.flow < 0 ? "To the foreman" : "To the base") + "</span>"
        + '<span class="mf-mut mf-ell">' + esc(settledBy(r)) + "</span></div>";
    }

    // ---- Foreman balances: his balance next to his open jobs ----
    function balancesList(main, q) {
      var open = {};
      main.forEach(function (r) {
        if (r.balance == null || r.forman === MF_NO_FOREMAN) return;
        open[r.forman] = (open[r.forman] || 0) + r.balance;
      });
      var names = {};
      Object.keys(open).forEach(function (f) { names[f] = 1; });
      ((S.fines || {}).balances || []).forEach(function (b) { if (b.entries > 0 && b.foreman) names[b.foreman] = 1; });
      return Object.keys(names).filter(function (f) {
        if (S.formen.length && S.formen.indexOf(f) < 0) return false;
        return !q || f.toLowerCase().indexOf(q) >= 0;
      }).map(function (f) {
        var bal = debtOf(f), o = open[f] || 0;
        return { name: f, bal: bal, open: o, total: r2(bal + o) };
      }).sort(function (a, b) { return b.total - a.total || a.name.localeCompare(b.name); });
    }
    function balancesHtml(main, q) {
      if (S.finesErr) return '<div class="mf-empty"><b>The foreman balances did not load.</b> ' + esc(S.finesErr)
        + ' <button type="button" class="mf-btn mf-sm" data-mfa="retryfines">Try again</button></div>';
      if (!S.fines) return '<div class="mf-load"><div class="mf-spin"></div>Loading the foreman balances…</div>';
      var list = balancesList(main, q);
      if (!list.length) return '<div class="mf-empty">' + (q ? "Nobody matches that search." : "No foreman has a balance or an open job.") + "</div>";
      var tb = 0, to = 0;
      list.forEach(function (x) { tb += x.bal; to += x.open; });
      return '<div class="mf-scroll"><div class="mf-bgrid"><div class="mf-bhd"><span>Foreman</span><span class="mf-r">His balance</span>'
        + '<span class="mf-r">Open jobs (net)</span><span class="mf-r">All together</span><span></span></div>'
        + list.map(function (x) {
            var has = Math.abs(x.bal) > 0.005;
            return '<div class="mf-brow"><span class="mf-b">' + esc(x.name) + "</span>"
              + '<span class="mf-r">' + (x.bal > 0.005 ? '<span class="mf-b mf-headc">owes ' + money(x.bal) + "</span>"
                  : x.bal < -0.005 ? '<span class="mf-b mf-outc">base owes him ' + money(-x.bal) + "</span>" : '<span class="mf-dim">$0</span>') + "</span>"
              + '<span class="mf-r">' + money(x.open) + "</span>"
              + '<span class="mf-r mf-b">' + money(x.total) + "</span>"
              + '<span class="mf-rbtn"><button type="button" class="mf-btn mf-sm' + (has ? " mf-acc" : "") + '" data-mfa="fm" data-v="' + esc(x.name) + '">Open balance</button></span></div>';
          }).join("")
        + '<div class="mf-brow mf-btot"><span class="mf-b">All ' + list.length + " foremen</span>"
        + '<span class="mf-r mf-b">' + money(tb) + '</span><span class="mf-r mf-b">' + money(to) + '</span><span class="mf-r mf-b">' + money(tb + to) + "</span><span></span></div>"
        + "</div></div>";
    }

    // ---- the bulk bar: several to-the-base jobs of ONE foreman, cash, in full ----
    function paintBulk() {
      var bar = $("mfBulk"); if (!bar) return;
      S.sel = pruneSel(S.sel, S.view === "waiting" ? _visible : {});
      var evs = Object.keys(S.sel);
      if (!evs.length) S.selFm = null;
      if (!evs.length || S.view !== "waiting") { bar.hidden = true; bar.innerHTML = ""; return; }
      var jobs = evs.map(rowByEv).filter(Boolean), total = 0;
      jobs.forEach(function (r) { total += settle(r).amount; });
      var fm = S.selFm || (jobs[0] && jobs[0].forman) || "";
      bar.innerHTML = '<div class="mf-bulkt"><span class="mf-b">' + jobs.length + " job" + (jobs.length === 1 ? "" : "s") + " from " + esc(fm) + " · " + money2(total) + "</span>"
        + "<span>Several jobs at once = cash, in full. Short or extra on one of them? Settle that job on its own.</span></div>"
        + '<div class="mf-bulka"><button type="button" class="mf-bulkclr" data-mfa="bulkclear">Clear</button>'
        + '<button type="button" class="mf-bulkgo" data-mfa="bulkgo"' + (S._saving ? " disabled" : "") + ">" + (S._saving ? "Saving… " : "") + "Confirm " + money2(total) + " cash from " + esc(firstName(fm)) + "</button></div>";
      bar.hidden = false;
    }
    async function bulkGo(btn) {
      if (S._saving) return;
      var jobs = onePerJob(Object.keys(S.sel).map(rowByEv).filter(function (r) { return r && bulkable(r) && _visible[r.ev]; }));
      if (!jobs.length) return;
      var fms = {}; jobs.forEach(function (r) { fms[r.forman] = 1; });
      if (Object.keys(fms).length !== 1) { await RSC.notice({ title: "One foreman at a time", body: "Tick the jobs of one foreman, then confirm." }); return; }
      var items = bulkItems(jobs), total = 0;
      items.forEach(function (it) { total += it.amount; });
      var fm = jobs[0].forman;
      var ok = await RSC.confirm({ title: "Confirm " + money2(total) + " cash from " + fm + "?",
        body: jobs.map(function (r) { return "• " + (r.customer || "—") + " · " + (r.jobCode || "") + " · " + money2(settle(r).amount); }).join("\n")
          + "\n\nEach job is confirmed in full, as cash handed over at the base.",
        yes: "Confirm " + money2(total) });
      if (!ok) return;
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
      S.busy = true; S._saving = true; paint();
      var out;
      try { out = await postJson("/api/_mf", { batch: items, link: false }); }
      catch (e) { S.busy = false; S._saving = false; paint(); await RSC.notice({ title: "Nothing was saved", body: netWords(e) }); return; }
      S.busy = false; S._saving = false;
      if (!out.res.ok || !out.j.ok) {
        var msg = saveError(out.res, out.j, { batch: true, items: items });
        // the job that was already confirmed comes off the list, so the rest can go in one click
        if (out.res.status === 409 && out.j && out.j.already) {
          var badEv = out.j.index != null && items[out.j.index] ? items[out.j.index].event_id : out.j.already && out.j.already.event_id;
          var bad = jobs.filter(function (r) { return bareEv(r.ev) === bareEv(badEv); })[0];
          if (bad) { delete S.sel[bad.ev]; msg = (bad.customer || bad.jobCode) + ": " + msg + " It has been unticked — press Confirm again for the rest."; }
          loadLive(true).then(function () { setLiveBadge(); paint(); });
        }
        paint();
        await RSC.notice({ title: "Nothing was saved", body: msg });
        return;
      }
      items.forEach(function (it, i) { patchLive(it, (out.j.ids || [])[i], out.j.link_id); });
      S.sel = {}; S.selFm = null;
      paint();
      afterWrite(items);
    }

    // after any Money Flow write: reconcile with the server, refresh his balance and the drawer
    function afterWrite(items) {
      loadLive(true).then(function () { setLiveBadge(); paint(); });
      if ((items || []).some(function (it) { return it.entry_type === MF_DEBT || it.entry_type === MF_EXTRA; }))
        loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
      if (window.ZDC && $("mfDayStrip")) ZDC.mountStrip($("mfDayStrip"));
      dcStale = true;
      MC.stale = true;          // the Month close tab refetches its Day Closing days
    }

    // ================= THE PANEL (right-side drawer) =================
    var P = null, PSTACK = [];
    function openPanel(spec, push) {
      if (push && P) PSTACK.push(P.spec); else PSTACK = [];
      P = { spec: spec, st: {} };
      renderPanel();
      // the live sync failed earlier (sign-in, network, server): try once more as the panel opens,
      // so a passing hiccup doesn't leave every save in it cash-only (2026-10-08)
      if (!S.liveOk) {
        var mine = P;
        loadLive(true).then(function () {
          setLiveBadge();
          if (P === mine) renderPanel(true);
        });
      }
      var d = $("mfDrawer"), s = $("mfScrim");
      if (!d) return;
      d.classList.add("mf-show"); d.setAttribute("aria-hidden", "false");
      if (s) s.classList.add("mf-show");
      setTimeout(function () {
        var f = d.querySelector("[data-mffocus]") || d.querySelector(".mf-x");
        if (f) { try { f.focus(); } catch (e) { /* best effort */ } }
      }, 80);
    }
    function closePanel() {
      P = null; PSTACK = [];
      var d = $("mfDrawer"), s = $("mfScrim");
      if (d) { d.classList.remove("mf-show"); d.setAttribute("aria-hidden", "true"); }
      if (s) s.classList.remove("mf-show");
    }
    function backPanel() {
      if (!PSTACK.length) { closePanel(); return; }
      P = { spec: PSTACK.pop(), st: {} };
      renderPanel();
    }
    function renderPanel(keepScroll) {
      var d = $("mfDrawer"); if (!d || !P) return;
      var db = $("mfDBody"), top = keepScroll && db ? db.scrollTop : 0;
      var k = P.spec.kind;
      var out = k === "job" ? jobPanel() : k === "fm" ? fmPanel() : methodsPanel();
      d.className = "mf-drawer mf-show" + (k === "fm" ? " mf-w-fm" : k === "methods" ? " mf-w-meth" : "");
      d.innerHTML = '<div class="mf-dh">' + (PSTACK.length ? '<button type="button" class="mf-x" data-mfp="back" aria-label="Back">' + ICON.back + "</button>" : "")
        + '<div class="mf-dtitle">' + (out.head || '<h2 id="mfDTitle">' + out.title + "</h2>") + "</div>"
        + '<button type="button" class="mf-x" data-mfp="close" aria-label="Close">' + ICON.x + "</button></div>"
        + '<div class="mf-db" id="mfDBody">' + out.body + "</div>"
        + (out.foot ? '<div class="mf-df">' + out.foot + "</div>" : "");
      P.h = out.h || {}; P.onInput = out.onInput || null; P.onChange = out.onChange || null;
      var nb = $("mfDBody"); if (nb && top) nb.scrollTop = top;
      if (out.after) out.after(d);
    }
    function panelBusy(on, label) {
      var d = $("mfDrawer"); if (!d) return;
      var v = d.querySelector(".mf-dveil");
      if (on && !v) {
        var b = d.querySelector(".mf-db");
        if (b) b.insertAdjacentHTML("beforeend", '<div class="mf-dveil"><div class="mf-spin"></div>' + esc(label || "Saving…") + "</div>");
      } else if (!on && v) v.remove();
      Array.prototype.forEach.call(d.querySelectorAll(".mf-df button"), function (b) { b.disabled = !!on; });
    }
    function panelErr(msg, extraHtml) {
      var el = document.querySelector("#mfDrawer #mfDErr");
      if (el) el.innerHTML = msg ? '<div class="mf-errbox"><span>' + esc(msg) + "</span>" + (extraHtml || "") + "</div>" : "";
    }
    // save one batch from a panel; on success the panel closes and the queue repaints at once --
    // or, given `keep` (a job expense, 2026-10-09), the panel stays open: keep() resets its form
    async function panelSave(items, link, keep) {
      panelErr("");
      panelBusy(true);
      var out;
      try { out = await postJson("/api/_mf", { batch: items, link: !!link }); }
      catch (e) { panelBusy(false); panelErr(netWords(e)); return false; }
      if (!out.res.ok || !out.j.ok) {
        panelBusy(false);
        var already = out.res.status === 409 && !!(out.j && out.j.already);
        if (out.res.status === 409 && !already) loadLive(true).then(function () { setLiveBadge(); paint(); });
        if (already && P && P.spec.kind === "job") {
          P.st.already = out.j.already || null;
          panelErr(saveError(out.res, out.j, { batch: true, items: items }),
            '<button type="button" class="mf-btn mf-sm" data-mfp="tocorr">Add a correction</button>');
          loadLive(true).then(function () { setLiveBadge(); paint(); });
        } else panelErr(saveError(out.res, out.j, { batch: true, items: items }));
        return false;
      }
      items.forEach(function (it, i) { patchLive(it, (out.j.ids || [])[i], out.j.link_id); });
      if (keep) { panelBusy(false); keep(); renderPanel(true); }
      else closePanel();
      paint();
      afterWrite(items);
      return true;
    }

    /* ---- THE JOB'S NET CASH AND ITS EXPENSES (his calls, 2026-10-09) ----
       Both sit on the leg that carries the job's net cash (the money leg); a correction or an
       expense entered on another calendar day of the job would never count. */
    function moneyLegOf(r) {
      var c = codeOf(r.jobCode);
      if (!c || r.recorded != null) return r;
      return (idx().legs[c] || []).filter(function (x) { return x.recorded != null && !x.echoLeg; })[0] || r;
    }
    function fixEntryOf(r) {
      var l = storyEntriesOf(r).filter(function (e) { return e.current && e.type === NC_FIX; });
      return l.length ? l[l.length - 1] : null;
    }
    function expensesOf(r) {
      return storyEntriesOf(r).filter(function (e) { return e.current && e.type === JOB_EXP && Math.abs(+e.amount || 0) > 0.005; });
    }
    // a short / extra that counts less than was recorded: the net cash changed after it was settled
    function movedNoteHtml(r) {
      var m = moneyLegOf(r), rec = m.debtRec || 0, now = m.debt || 0;
      if (Math.abs(rec) < 0.005 || Math.abs(rec - now) < 0.005) return "";
      var kind = rec > 0 ? "short" : "extra", fm = esc(firstName(m.forman));
      return '<div class="mf-jcnote mf-jcfix"><span>The ' + money2(Math.abs(rec)) + " " + kind + " moved to " + fm + "’s balance "
        + (Math.abs(now) < 0.005 ? "no longer counts" : "now counts " + money2(Math.abs(now)))
        + ": the job’s net cash is " + money2(m.expected) + " now"
        + (Math.abs(now) < 0.005 ? (kind === "short" ? ", and he brought what it asks." : ".") : ".") + "</span></div>";
    }
    // the job card's lines about them, with "Take the correction back" (st = the panel's state)
    function figuresHtml(r, st) {
      var m = moneyLegOf(r), out = "";
      if (m.fix != null) {
        var fe = fixEntryOf(m);
        out += '<div class="mf-jcnote mf-jcfix"><span>Net cash corrected to <b>' + money2(m.fix) + "</b>"
          + (fixOpen(m) ? " — the contract says " + money2(m.recorded) + ". Flagged until the contract or closing is fixed."
            : " — the closing now agrees.")
          + (fe && fe.note ? ' <span class="mf-mut">Why: ' + esc(fe.note) + (fe.by ? " (" + esc(shortBy(fe.by)) + ")" : "") + "</span>" : "") + "</span>"
          + (fe && st && !st.fixWd ? ' <button type="button" class="mf-linkbtn" data-mfp="fixwd">Take the correction back</button>' : "") + "</div>";
        if (fe && st && st.fixWd) {
          out += '<div class="mf-inl"><label for="mfFixWhy" class="mf-lg2">Why take it back? The job goes back to the contract’s ' + money2(m.recorded) + ".</label>"
            + '<div class="mf-addrow"><input id="mfFixWhy" class="mf-in" maxlength="200" value="' + esc(st.fixWhy || "") + '" placeholder="e.g. Picked by mistake" data-mffocus>'
            + '<button type="button" class="mf-btn mf-pri" data-mfp="fixwdgo">Take it back</button>'
            + '<button type="button" class="mf-btn mf-ghost" data-mfp="fixwdno">Cancel</button></div></div>';
        }
      }
      return out;
    }
    function expHtml(r, st) {
      var m = moneyLegOf(r), list = expensesOf(m), tot = 0;
      list.forEach(function (e) { tot += Math.abs(+e.amount || 0); });
      var form = function (title, btn) {
        return '<div class="mf-inl"><span class="mf-lg2">' + title + "</span>"
          + '<div class="mf-exprow"><div class="mf-amt mf-amt-sm"><span class="mf-mut">$</span><input id="mfExpAmt" inputmode="decimal" autocomplete="off" aria-label="Amount" value="' + esc(st.expAmt || "") + '" data-mffocus></div>'
          + '<input id="mfExpNote" class="mf-in" maxlength="200" aria-label="What was it for?" placeholder="What was it for? e.g. Extra truck rental" value="' + esc(st.expNote || "") + '"></div>'
          + '<div class="mf-addrow"><button type="button" class="mf-btn mf-pri" data-mfp="expsave">' + btn + "</button>"
          + '<button type="button" class="mf-btn mf-ghost" data-mfp="expno">Cancel</button></div></div>';
      };
      var rows = list.map(function (e) {
        if (st.expEdit === e.id) return form("Change this expense", "Save change");
        var row = '<div class="mf-conf"><span class="mf-tlwhat"><span class="mf-b">' + esc(e.note || "Job expense") + "</span>"
          + '<span class="mf-mut">' + esc(shortBy(e.by)) + " · " + fmtWhen(e.at) + "</span></span>"
          + '<span class="mf-tlamt">' + money2(Math.abs(+e.amount || 0)) + "</span>"
          + '<span class="mf-expbtns"><button type="button" class="mf-linkbtn" data-mfp="expedit" data-v="' + esc(e.id) + '">Change</button>'
          + '<button type="button" class="mf-linkbtn" data-mfp="expwd" data-v="' + esc(e.id) + '">Withdraw</button></span></div>';
        if (st.expWd === e.id) {
          row += '<div class="mf-inl"><label for="mfExpWhy" class="mf-lg2">Why withdraw it?</label>'
            + '<div class="mf-addrow"><input id="mfExpWhy" class="mf-in" maxlength="200" value="' + esc(st.expWhy || "") + '" placeholder="e.g. Entered twice" data-mffocus>'
            + '<button type="button" class="mf-btn mf-pri" data-mfp="expwdgo">Withdraw</button>'
            + '<button type="button" class="mf-btn mf-ghost" data-mfp="expno">Cancel</button></div></div>';
        }
        return row;
      }).join("");
      return '<section class="mf-exps" aria-labelledby="mfExpH"><div class="mf-fldh"><h3 class="mf-h3" id="mfExpH">Job expenses</h3>'
        + (list.length ? '<span class="mf-b">' + money2(tot) + "</span>" : "") + "</div>"
        + '<span class="mf-mut mf-sm2">Money spent on this job that isn’t on the contract. It lowers what he owes on the job at once and never touches the cash drawer.</span>'
        + rows
        + (st.expAdding ? form("Add a job expense", "Add expense")
          : '<button type="button" class="mf-addbtn" data-mfp="expadd">' + ICON.plus + "Add a job expense</button>")
        + "</section>";
    }
    function expInput(e, st) {
      var id = e.target.id;
      if (id === "mfExpAmt") st.expAmt = e.target.value;
      else if (id === "mfExpNote") st.expNote = e.target.value;
      else if (id === "mfExpWhy") st.expWhy = e.target.value;
      else if (id === "mfFixWhy") st.fixWhy = e.target.value;
      else return false;
      return true;
    }
    // done = saved: what the job asks for has changed, so the Settle preset follows it
    function expReset(st, done) {
      st.expAdding = false; st.expEdit = null; st.expWd = null; st.expAmt = ""; st.expNote = ""; st.expWhy = "";
      st.fixWd = false; st.fixWhy = "";
      if (done) st.amt = null;
    }
    // the handlers every job panel adds for the two (merged into its own `h`)
    function jobExtrasH(r, st) {
      var m = moneyLegOf(r);
      var focus = function (id) { var i = $(id); if (i) i.focus(); };
      return {
        expadd: function () { expReset(st); st.expAdding = true; renderPanel(true); focus("mfExpAmt"); },
        expedit: function (a) {
          var e = _byId[a.getAttribute("data-v")] || _byId[+a.getAttribute("data-v")]; if (!e) return;
          expReset(st); st.expEdit = e.id; st.expAmt = fmtAmt(Math.abs(+e.amount || 0)); st.expNote = e.note || "";
          renderPanel(true); focus("mfExpAmt");
        },
        expwd: function (a) {
          var e = _byId[a.getAttribute("data-v")] || _byId[+a.getAttribute("data-v")]; if (!e) return;
          expReset(st); st.expWd = e.id; renderPanel(true); focus("mfExpWhy");
        },
        expno: function () { expReset(st); renderPanel(true); },
        expsave: function () {
          var amt = parseAmt(st.expAmt), note = String(st.expNote || "").trim();
          if (/^\s*-/.test(st.expAmt || "")) { panelErr("Enter the expense without a minus sign."); return; }
          if (amt == null || amt <= 0) { panelErr("Enter the amount of the expense."); return; }
          if (amt > 1000000) { panelErr("That amount looks wrong (over $1,000,000). Check the number."); return; }
          if (!note) { panelErr("Say what the expense was for — month close lists it by that."); return; }
          var old = st.expEdit != null ? _byId[st.expEdit] : null;
          if (old && Math.abs(Math.abs(+old.amount || 0) - amt) < 0.005 && String(old.note || "") === note) { expReset(st); renderPanel(true); return; }
          panelSave([expenseItem(m, amt, note, old)], false, function () { expReset(st, true); });
        },
        expwdgo: function () {
          var e = _byId[st.expWd], why = String(st.expWhy || "").trim();
          if (!e) return;
          if (!why) { panelErr("Say why it is withdrawn — it stays in the job’s history."); return; }
          panelSave([withdrawItem(m, e, why)], false, function () { expReset(st, true); });
        },
        fixwd: function () { expReset(st); st.fixWd = true; renderPanel(true); focus("mfFixWhy"); },
        fixwdno: function () { expReset(st); renderPanel(true); },
        fixwdgo: function () {
          var fe = fixEntryOf(m), why = String(st.fixWhy || "").trim();
          if (!fe) return;
          if (!why) { panelErr("Say why the correction is taken back — it stays in the job’s history."); return; }
          panelSave([withdrawItem(m, fe, why)], false, function () { expReset(st, true); });
        },
      };
    }
    /* "Whose is the difference?" -- shown under the amount whenever it isn't what the job asks for
       (2026-10-09). Default: his balance, as before. The other: the job's net cash is wrong.
       eff = what the amount would do WITHOUT the correction (short / extra / still off). */
    function fixChoiceHtml(st, eff) {
      var opt = function (v, on, title, sub) {
        return '<label class="mf-mcard' + (on ? " mf-on" : "") + '"><input type="radio" name="mfFixCh" data-mfp="fixmode" data-v="' + v + '"' + (on ? " checked" : "") + ">"
          + '<span class="mf-mcol"><span class="mf-b">' + title + '</span><span class="mf-mut mf-sm2">' + sub + "</span></span></label>";
      };
      var bal = st.type === TAKEN ? ["Keep the difference open on the job", "The job stays open until the rest is paid."]
        : eff.kind === "extra" ? ["The extra pays back his balance", "He brought more than the job asks for."]
          : ["He owes the difference", "It goes on his foreman balance."];
      return '<fieldset class="mf-fs mf-fixch"><legend class="mf-lg">Whose is the difference?</legend>'
        + opt("bal", !st.fix, bal[0], bal[1])
        + opt("fix", !!st.fix, "The job’s net cash is wrong",
            "He handed over the right amount. The job settles on it, nothing goes on his balance, and the job is flagged until the contract or closing is fixed.")
        + "</fieldset>";
    }

    // ---- the job card on top of the Settle / Pay-out / Settled panels ----
    function jobCardHtml(r, opt) {
      opt = opt || {};
      var out = opt.out, pre = settle(r);
      var who;
      var past = opt.settled && r.status === "Money Received";
      if (r.expected == null) who = "<span><b>" + esc(r.forman) + "</b> · no contract amount yet</span>";
      else if (pre.type === TAKEN) who = "<span>The base " + (past ? "owed" : "owes") + " <b>" + esc(r.forman) + "</b></span>" + '<span class="mf-jcamt mf-outc">' + money2(pre.amount) + "</span>";
      else who = "<span><b>" + esc(r.forman) + "</b> " + (past ? "owed" : "owes") + " the base</span>" + '<span class="mf-jcamt mf-headc">' + money2(pre.amount) + "</span>";
      var links = [], jl = jobLinksOf(r);
      if (jl.contract) links.push('<a class="mf-alink" href="' + esc(jl.contract) + '" target="_blank" rel="noopener">Contract ↗</a>');
      if (jl.cal) links.push('<a class="mf-alink" href="' + esc(jl.cal) + '" target="_blank" rel="noopener">Calendar ↗</a>');
      var legacy = ((r.adv || 0) !== 0 || (r.ded || 0) !== 0)
        ? '<div class="mf-jcnote">Includes an old per-job ' + [((r.adv || 0) !== 0 ? "advance of " + money2(r.adv) : ""),
            ((r.ded || 0) !== 0 ? "deduction of " + money2(Math.abs(r.ded)) : "")].filter(Boolean).join(" and ")
          + " — new ones go on his foreman balance.</div>" : "";
      var recorded = (!opt.settled && r.flow != null)
        ? '<div class="mf-jcnote">Recorded so far: ' + money2(Math.abs(r.flow)) + (r.flow < 0 ? " paid out" : " brought in")
          + " (" + (r.flowSrc === "dc" ? "digital contract" : r.flowSrc === "form" ? "form" : "portal") + ").</div>" : "";
      return '<div class="mf-jc' + (out ? " mf-jc-out" : "") + '">'
        + '<div class="mf-jctop"><div class="mf-jcid"><span class="mf-jccust">' + esc(r.customer || "—")
        + (opt.settled && r.status === "Money Received" ? ' <span class="mf-pill mf-p-in mf-pill-sm">' + ICON.check + "Settled</span>" : "") + "</span>"
        + '<span class="mf-mut"><span class="mf-code">' + esc(r.jobCode || "—") + "</span> · " + esc(r.jobType || "—") + " · " + fmtD(r.date) + "</span></div>"
        + (opt.noStoryLink ? "" : '<button type="button" class="mf-linkbtn" data-mfp="story">History</button>') + "</div>"
        + '<div class="mf-jcwho"><span class="mf-av mf-av-sm mf-av-deep">' + esc(initials(r.forman)) + "</span>" + who + "</div>"
        + '<div class="mf-jcbal"><span class="mf-mut">His balance right now</span>'
        + (r.forman && r.forman !== MF_NO_FOREMAN
            ? '<button type="button" class="mf-linkbtn mf-b" data-mfp="fm">' + (S.fines ? esc(owesText(debtOf(r.forman))) : S.finesErr ? "open" : "…") + "</button>"
            : '<span class="mf-dim">foreman not identified</span>') + "</div>"
        + recorded + legacy + figuresHtml(r, opt.st) + movedNoteHtml(r)
        + (moneyLegOf(r).exp > 0.005 ? '<div class="mf-jcnote">After ' + money2(moneyLegOf(r).exp) + " of job expenses (below).</div>" : "")
        + (links.length ? '<div class="mf-jclinks">' + links.join(" · ") + "</div>" : "")
        + "</div>";
    }

    // ---- the job's story: one timeline across ALL its calendar days ----
    function storyHtml(r) {
      var code = codeOf(r.jobCode);
      var legs = (code ? (idx().legs[code] || [r]) : [r]).filter(function (l) { return l === r || l.status !== "Filter Out"; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var ents = storyEntriesOf(r);
      var fm = firstName(r.forman);
      var owed = 0, got = 0, open = 0, moved = 0;
      legs.forEach(function (l) {
        if (l.echoLeg) return;
        if (l.expected != null) owed += l.expected - (l.adv || 0) + (l.ded || 0);
        if (l.flow != null) got += l.flow;
        if (l.balance != null) open += l.balance;
        moved += (l.debt || 0);
      });
      var cards = '<div class="mf-st3">'
        + '<div class="mf-st3c"><span class="mf-mut">' + (owed < -0.005 ? "The base owed " + esc(fm) : esc(fm) + " owed the base") + "</span><b>" + money2(Math.abs(owed)) + "</b></div>"
        + '<div class="mf-st3c"><span class="mf-mut">' + (got < -0.005 ? "Paid out" : "Received") + '</span><b class="mf-pos">' + money2(Math.abs(got)) + "</b>"
        + (Math.abs(moved) > 0.005 ? '<span class="mf-mut mf-sm2">' + money2(Math.abs(moved)) + (moved > 0 ? " moved to his balance" : " off his balance") + "</span>" : "") + "</div>"
        + '<div class="mf-st3c"><span class="mf-mut">Still open</span><b>' + money2(Math.abs(open)) + "</b></div></div>";
      var legsHtml = legs.length > 1
        ? '<div class="mf-stlegs"><h3 class="mf-h3">' + (legs.length === 2 ? "Two" : legs.length) + " calendar days, one job</h3><div class=\"mf-chips\">"
          + legs.map(function (l) {
              return '<span class="mf-chip"><span class="mf-chipdot' + (l.echoLeg ? " mf-chipdot-2" : "") + '"></span>' + fmtD(l.date)
                + (l.echoLeg ? " · its cash is counted on the other day" : "") + "</span>";
            }).join("") + "</div>"
          + '<p class="mf-mut">The money belongs to the job, not to a calendar day: whichever day it’s confirmed on, the job shows it once.</p></div>'
        : "";
      var items = [];
      var tl = function (t, dot, when, inner) { items.push({ t: String(t || ""), html: '<div class="mf-tl"><div class="mf-tlrail"><span class="mf-tldot mf-tld-' + dot + '"></span><span class="mf-tlline"></span></div>'
        + '<div class="mf-tlbody"><span class="mf-tlwhen">' + when + "</span>" + inner + "</div></div>" }); };
      legs.forEach(function (l) {
        var lt = legs.length > 1 ? " · " + fmtShort(l.date) : "";
        if (l.echoLeg) tl(l.date + " 00", "ring", fmtD(l.date), '<span class="mf-b">No money of its own</span><span class="mf-mut">Its cash is counted on the job’s other calendar day.</span>');
        else if (l.expected != null) {
          var v = l.expected - (l.adv || 0) + (l.ded || 0);
          tl(l.dcTs || l.date + " 00", "ring", l.dcTs ? fmtWhen(l.dcTs) + lt : fmtD(l.date),   // the leg date only beside a submission time, never twice
            '<span class="mf-b">Closing filed: net cash ' + money2(l.recorded != null ? l.recorded : l.expected) + "</span>"
            + '<span class="mf-mut">' + (v > MF_TOL ? "Positive net cash: " + esc(fm) + " is holding money that belongs to the base."
              : v < -MF_TOL ? "Negative net cash: the base owes " + esc(fm) + " on this job." : "Nothing to hand over either way.") + "</span>");
        } else {
          tl(l.date + " 00", "ring", fmtD(l.date) + lt, '<span class="mf-b">' + (l.status === "Missing Closing" ? "No closing for this calendar day" : "No contract yet")
            + '</span><span class="mf-mut">' + (l.status === "Missing Closing" ? "The closing sheet has no row for it, so there is nothing to settle yet." : "The amount is known once the contract comes in.") + "</span>");
        }
        if (l.flow != null && l.flowSrc && l.flowSrc !== "portal") {
          tl(l.flowTs || l.date, "fill", fmtWhen(l.flowTs) + lt,
            boxHtml(l.flow < 0 ? "out" : "", "Recorded in the " + (l.flowSrc === "dc" ? "digital contract" : "form"), "Cash", money2(Math.abs(l.flow))));
        }
      });
      // entries; a run of repeats by the same person on the same day collapses into one line
      var i = 0;
      while (i < ents.length) {
        var en = ents[i];
        if (en._repeatOf && en.current) {
          var j2 = i + 1;
          while (j2 < ents.length && ents[j2]._repeatOf && ents[j2].current && ents[j2].type === en.type
            && Math.abs(+ents[j2].amount - +en.amount) < 0.005 && ents[j2].by === en.by
            && String(ents[j2].at).slice(0, 10) === String(en.at).slice(0, 10)) j2++;
          var n = j2 - i;
          tl(en.at, "dash", fmtWhen(en.at) + " · " + esc(shortBy(en.by)) + (n > 1 ? ", " + n + " times" : ""),
            '<div class="mf-tlbox mf-tlbox-rep"><span class="mf-tlwhat"><span class="mf-b">Confirmed the same ' + money2(Math.abs(+en.amount)) + (n > 1 ? " " + n + " more times" : " again")
            + '</span><span class="mf-mut">Repeat' + (n > 1 ? "s" : "") + " · not counted</span></span>"
            + '<span class="mf-tlamt">' + (n > 1 ? n + " × " : "") + money2(Math.abs(+en.amount)) + "</span></div>");
          i = j2; continue;
        }
        tl(en.at, en.current ? "fill" : "dash", fmtWhen(en.at) + " · " + esc(shortBy(en.by)), entryBoxHtml(en, r));
        i++;
      }
      legs.forEach(function (l) {
        var rec = l.debtRec || 0, now = l.debt || 0;
        if (Math.abs(rec) < 0.005 || Math.abs(rec - now) < 0.005) return;
        tl("9999", "dash", "Now", boxHtml("rep", (rec > 0 ? "Short" : "Extra") + (Math.abs(now) < 0.005 ? " no longer counts" : " now counts " + money2(Math.abs(now))),
          "The job’s net cash is " + money2(l.expected) + " now, so " + esc(fm) + "’s balance carries " + (Math.abs(now) < 0.005 ? "none of it" : "only that") + ". Nothing was changed by hand.",
          money2(Math.abs(rec))));
      });
      items.sort(function (a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
      var end = '<div class="mf-tl"><div class="mf-tlrail"><span class="mf-tldot mf-tld-end"></span></div><div class="mf-tlbody"><span class="mf-tlwhen">Today</span>'
        + '<span class="mf-b">' + (Math.abs(open) <= MF_TOL ? "Nothing open on this job"
          : "Still open: " + money2(Math.abs(open)) + (open > 0 ? " to the base" : " to the foreman")) + "</span></div></div>";
      return cards + legsHtml + '<div class="mf-tlwrap"><h3 class="mf-h3">What happened</h3>'
        + items.map(function (x) { return x.html; }).join("") + end + "</div>";
    }
    function boxHtml(kind, title, sub, amt) {
      return '<div class="mf-tlbox' + (kind ? " mf-tlbox-" + kind : "") + '"><span class="mf-tlwhat"><span class="mf-b">' + title + "</span>"
        + (sub ? '<span class="mf-mut">' + sub + "</span>" : "") + '</span><span class="mf-tlamt">' + amt + "</span></div>";
    }
    function entryBoxHtml(en, r) {
      var amt = Math.abs(+en.amount || 0), meth = normMethod(en.method), gone = !en.current;
      var title, sub = [], kind = "";
      if (en.type === BROUGHT) {
        title = meth === "Offset" ? "Balanced against a pay-out" : meth === "Cash" ? "Cash brought to the base" : "Brought by " + esc(meth);
        sub.push(esc(methodLabel(meth)));
      } else if (en.type === TAKEN) {
        kind = "out";
        title = meth === "Offset" ? "Balanced against his other jobs" : meth === "Cash" ? "Paid out to the foreman in cash" : "Paid out by " + esc(meth);
        sub.push(esc(methodLabel(meth)));
        if (meth === "Cash" && en.cash_amount != null && Math.abs(+en.cash_amount - amt) > 0.005)
          sub.push(money2(+en.cash_amount) + " of it in cash");
      } else if (en.type === MF_DEBT) {
        title = amt > 0.005 ? "Short — moved to his balance" : "Short cleared";
      } else if (en.type === MF_EXTRA) {
        title = amt > 0.005 ? (en.link_id != null ? "Left on his balance" : "Extra — taken off his balance") : "Extra cleared";
      } else if (en.type === NC_FIX) {
        // the corrected net cash is a FIGURE, signed -- not money that moved (2026-10-09)
        title = "Net cash corrected — he handed over the right amount";
        amt = +en.amount || 0;
      } else if (en.type === JOB_EXP) {
        title = "Job expense";
      } else if (en.type === "Advance Payment") title = "Advance on the job (old way)";
      else if (en.type === "Forman Deduction") title = "Deduction on the job (old way)";
      else title = esc(en.type || "Entry");
      if (en._withdrawn) title = (en.type === NC_FIX ? "Net cash correction taken back" : "Job expense withdrawn");
      if (en.replaces != null && !en._withdrawn) sub.push("correction");
      if (gone && !en._withdrawn) sub.push("replaced by a correction");
      if (en.note && !/^(confirmed|bulk confirmed|corrected)$/i.test(en.note)) sub.push(esc(en.note));
      // a linked pay-out: name the jobs on the other side
      var linked = "";
      if (en.link_id != null && _byLink[en.link_id]) {
        var mine = {}; (codeOf(r.jobCode) ? (idx().legs[codeOf(r.jobCode)] || [r]) : [r]).forEach(function (l) { mine[bareEv(l.ev)] = 1; });
        // the pay-out names the jobs it was balanced against; a job used in it names the pay-out
        var want = en.type === TAKEN ? BROUGHT : TAKEN;
        var others = _byLink[en.link_id].filter(function (o) { return o !== en && !mine[bareEv(o.event_id)] && o.type === want && o.current; });
        if (others.length) linked = '<div class="mf-tllink">' + others.map(function (o) {
          var orow = rowByEv(o.event_id);
          var nm = orow ? orow.customer : o.job_code || "another job";
          return (o.type === BROUGHT ? "Balanced against " : "Used to pay out ") + "<b>" + esc(nm || "another job") + "</b>"
            + (o.job_code ? ' <span class="mf-code">' + esc(o.job_code) + "</span>" : "") + " · " + money2(Math.abs(+o.amount || 0));
        }).join("<br>") + "</div>";
      }
      return '<div class="mf-tlbox' + (gone ? " mf-tlbox-rep" : kind ? " mf-tlbox-" + kind : "") + '"><span class="mf-tlwhat"><span class="mf-b">' + title + "</span>"
        + (sub.length ? '<span class="mf-mut">' + sub.join(" · ") + "</span>" : "") + "</span>"
        + '<span class="mf-tlamt">' + money2(amt) + "</span></div>" + linked;
    }
    function storySection(r, open) {
      return '<section class="mf-story" id="mfStory"' + (open ? "" : " hidden") + ' aria-label="History">'
        + '<h3 class="mf-h3">History</h3>' + storyHtml(r) + "</section>";
    }
    function toggleStory() {
      var s = $("mfStory"); if (!s) return;
      s.hidden = !s.hidden;
      if (!s.hidden) { try { s.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { s.scrollIntoView(); } }
    }

    // ---- the method radio cards (+ "Add a method" inline) ----
    function methodCards(list, cur, canAdd, st) {
      var HINT = { Cash: "Handed over at the base", Zelle: "Sent to the company by Zelle" };
      var w = methodsWritable();
      var html = '<fieldset class="mf-fs"><legend class="mf-lg">' + (st.type === TAKEN ? "How was he paid?" : "How did it come in?") + "</legend>"
        + list.map(function (m) {
            var on = normMethod(m.name) === normMethod(cur);
            var hint = st.type === TAKEN ? (m.name === "Cash" ? "Out of today’s cash at the base" : "Not cash — the drawer doesn’t change")
              : HINT[m.name] || "Not cash · " + esc(m.name);
            var off = !w && m.name !== "Cash";
            return '<label class="mf-mcard' + (on ? " mf-on" : "") + (off ? " mf-off" : "") + '"><input type="radio" name="mfMeth" data-mfp="method" data-v="' + esc(m.name) + '"' + (on ? " checked" : "") + (off ? " disabled" : "") + ">"
              + '<span class="mf-mcol"><span class="mf-b">' + esc(m.name) + '</span><span class="mf-mut mf-sm2">' + hint + "</span></span>"
              + (st.newName && st.newName === m.name ? '<span class="mf-tag">New</span>' : "") + "</label>";
          }).join("");
      if (!w) html += '<span class="mf-mut mf-sm2">' + esc(offlineNote() || "Money Flow update pending — only Cash can be saved until the database step has run.") + '</span>';
      else if (canAdd) {
        html += st.adding
          ? '<div class="mf-addm"><label for="mfNewM" class="mf-b">Name of the new method</label><div class="mf-addrow">'
            + '<input id="mfNewM" class="mf-in" maxlength="40" placeholder="e.g. Venmo" value="' + esc(st.draft || "") + '" data-mffocus>'
            + '<button type="button" class="mf-btn mf-pri" data-mfp="addmgo">Add</button>'
            + '<button type="button" class="mf-btn mf-ghost" data-mfp="addmcancel">Cancel</button></div>'
            + '<div id="mfAddErr" class="mf-err"></div></div>'
          : '<button type="button" class="mf-addbtn" data-mfp="addm">' + ICON.plus + "Add a method — it stays on the list</button>";
      }
      return html + "</fieldset>";
    }
    async function addMethodInline(st) {
      var name = String(st.draft || "").trim(), er = document.querySelector("#mfDrawer #mfAddErr");
      var bad = methodNameProblem(name);
      if (bad) { if (er) er.textContent = bad; return; }
      if (er) er.textContent = "Adding…";
      var out;
      try { out = await postJson("/api/_mfmethods", { name: name, money_in: 1, pay_out: 0 }); }
      catch (e) { if (er) er.textContent = netWords(e); return; }
      if (!out.res.ok || !Array.isArray(out.j.methods)) { if (er) er.textContent = saveError(out.res, out.j, { methods: true }); return; }
      setMethods(out.j.methods);
      var hit = out.j.methods.filter(function (m) { return String(m.name).toLowerCase() === name.toLowerCase(); })[0];
      st.method = hit ? hit.name : name; st.newName = st.method; st.adding = false; st.draft = "";
      renderPanel(true);
    }
    function methodNameProblem(name, exceptId) {
      if (name.length < 2 || name.length > 40) return "A name needs 2 to 40 characters.";
      if (/^(cash|offset)$/i.test(name)) return "“" + name + "” is built in — pick another name.";
      if (allMethods().some(function (m) { return m.id !== exceptId && String(m.name).toLowerCase() === name.toLowerCase(); }))
        return "“" + name + "” is already on the list" + (allMethods().some(function (m) { return String(m.name).toLowerCase() === name.toLowerCase() && !+m.is_on; }) ? " (turned off — turn it on in Payment methods)." : ".");
      if (!methodsWritable()) return offlineNote() || "Money Flow update pending — methods can’t be added until the server is updated.";
      return "";
    }
    function setMethods(list) {
      if (!S.live) S.live = { rows: [], entries: [] };
      S.live.methods = list;
    }

    // ---- JOB panel: Settle / Enter cash / Pay out / Settled (+ correction) ----
    function jobPanel() {
      var r = rowByEv(P.spec.ev);
      if (!r) return { title: "Job", body: '<p class="mf-mut">This job is no longer on the list. Press Refresh.</p>' };
      var st = P.st;
      if (!st.mode) st.mode = jobModeOf(r);
      if (st.mode === "payout") return payoutPanel(r);
      if (st.mode === "settled") return settledPanel(r);
      return settlePanel(r);
    }
    function dcLine(type, method, amt) {
      if (amt == null) return "";
      if (!isCashMethod(method)) return "Not cash — no change to today’s cash";
      return type === TAKEN ? "Takes " + money2(amt) + " out of today’s cash" : "Adds " + money2(amt) + " to today’s cash";
    }
    // the "Whose is the difference?" choice under the amount, and the note's label with it:
    // a corrected net cash must say why (the office fixes the contract from it)
    function fixUi(st, effBal) {
      var fx = $("mfFix"), nl = $("mfNoteL");
      if (fx) fx.innerHTML = effBal ? fixChoiceHtml(st, effBal) : "";
      if (nl && !st.correcting) nl.innerHTML = effBal && st.fix
        ? "What is wrong with the net cash? <span class=\"mf-mut\">(required — the office fixes the contract from it)</span>"
        : 'Note <span class="mf-mut">(optional)</span>';
    }
    function settlePanel(r) {
      var st = P.st, pre = settle(r), manual = st.mode === "manual";
      if (st.type == null) st.type = pre ? pre.type : BROUGHT;
      if (st.method == null) st.method = "Cash";
      if (st.amt == null) st.amt = pre && !manual ? fmtAmt(pre.amount) : "";
      if (st.note == null) st.note = "";
      var list = methodsFor(allMethods(), st.type === TAKEN ? "out" : "in");
      if (!list.some(function (m) { return normMethod(m.name) === normMethod(st.method); }) || !methodsWritable()) st.method = "Cash";
      var balNow = debtOf(r.forman);
      var why = manual ? '<div class="mf-why">' + (r.status === "Missing Closing"
          ? "<b>This job has no closing of its own.</b> File the closing for it, or remove the extra calendar event — until then an amount here may belong to a different calendar day."
          : "<b>No contract for this job yet.</b> There is no net cash to confirm against. Enter what he brought (or was paid) only if money really moved; the balance is worked out when the contract comes in.") + "</div>"
        + '<div class="mf-fs"><span class="mf-lg">Which way did the money go?</span><div class="mf-ways" role="radiogroup">'
        + '<button type="button" class="mf-way" role="radio" aria-checked="' + (st.type === BROUGHT) + '" data-mfp="dir" data-v="in">He brought money to the base</button>'
        + '<button type="button" class="mf-way" role="radio" aria-checked="' + (st.type === TAKEN) + '" data-mfp="dir" data-v="out">The base paid him</button></div></div>' : "";
      var body = jobCardHtml(r, { out: st.type === TAKEN && !manual, st: st }) + why
        + methodCards(list, st.method, st.type !== TAKEN, st)
        + '<div class="mf-fld"><div class="mf-fldh"><label for="mfAmt" class="mf-lg">' + (st.type === TAKEN ? "How much was paid to him?" : "How much did he bring?") + "</label>"
        + (pre && !manual ? '<button type="button" class="mf-linkbtn" data-mfp="full">Full ' + money2(pre.amount) + "</button>" : "") + "</div>"
        + '<div class="mf-amt"><span class="mf-mut">$</span><input id="mfAmt" inputmode="decimal" autocomplete="off" value="' + esc(st.amt) + '" data-mffocus></div>'
        + '<div id="mfEff"></div><div id="mfFix"></div></div>'
        + '<div class="mf-dcl"><span class="mf-b">Day Closing</span><span class="mf-mut" id="mfDcl"></span></div>'
        + '<div class="mf-fld"><label for="mfNote" class="mf-lg2" id="mfNoteL">Note <span class="mf-mut">(optional)</span></label>'
        + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400">' + esc(st.note) + "</textarea></div>"
        + expHtml(r, st)
        + storySection(r, false);
      var foot = '<div id="mfDErr"></div><div class="mf-dfrow"><button type="button" class="mf-btn" data-mfp="close">Cancel</button>'
        + '<button type="button" class="mf-btn mf-pri" data-mfp="save" id="mfSave">Confirm</button></div>';
      var live = function () {
        var amt = parseAmt(st.amt), eff = settleEffect(r, st.type, amt, balNow, st.fix);
        var e = $("mfEff"), dc = $("mfDcl"), sv = $("mfSave");
        if (e) e.innerHTML = '<div class="mf-eff mf-eff-' + eff.kind + '"><span class="mf-b">' + esc(eff.title) + "</span>" + (eff.line ? "<span>" + esc(eff.line) + "</span>" : "") + "</div>";
        fixUi(st, eff.canFix ? settleEffect(r, st.type, amt, balNow, false) : null);
        if (dc) dc.textContent = amt == null ? "—" : dcLine(st.type, st.method, amt);
        if (sv) sv.textContent = amt == null ? "Confirm" : "Confirm " + money2(amt) + " · " + normMethod(st.method);
      };
      return {
        title: manual ? "Enter cash by hand" : st.type === TAKEN ? "Pay out to a foreman" : "Settle a job",
        body: body, foot: foot,
        after: live,
        onInput: function (e) {
          if (expInput(e, st)) return;
          if (e.target.id === "mfAmt") { st.amt = e.target.value; live(); }
          else if (e.target.id === "mfNote") st.note = e.target.value;
          else if (e.target.id === "mfNewM") st.draft = e.target.value;
        },
        h: assign({
          fixmode: function (a) { st.fix = a.getAttribute("data-v") === "fix"; live(); },
          method: function (a) { st.method = a.getAttribute("data-v"); renderPanel(true); },
          dir: function (a) { st.type = a.getAttribute("data-v") === "out" ? TAKEN : BROUGHT; st.method = "Cash"; renderPanel(true); },
          full: function () { st.amt = fmtAmt(pre.amount); var i = $("mfAmt"); if (i) i.value = st.amt; live(); },
          addm: function () { st.adding = true; renderPanel(true); var i = $("mfNewM"); if (i) i.focus(); },
          addmcancel: function () { st.adding = false; st.draft = ""; renderPanel(true); },
          addmgo: function () { addMethodInline(st); },
          story: toggleStory,
          fm: function () { openFm(r.forman, true); },
          tocorr: function () { st.mode = "settled"; st.correcting = true; renderPanel(); },
          save: function () {
            var amt = parseAmt(st.amt);
            if (/^\s*-/.test(st.amt)) { panelErr("Enter the amount without a minus sign — the direction is already set."); return; }
            if (amt == null) { panelErr(st.type === TAKEN ? "Enter how much was paid to him." : "Enter how much he brought (0 if nothing)."); return; }
            if (amt > 1000000) { panelErr("That amount looks wrong (over $1,000,000). Check the number."); return; }
            var fixing = !!(st.fix && settleEffect(r, st.type, amt, balNow, true).canFix);
            if (fixing && !String(st.note || "").trim()) { panelErr("Say what is wrong with the net cash — the office fixes the contract from it."); return; }
            var items = settleItems(r, { type: st.type, amt: amt, method: st.method, note: st.note, replaces: null,
                                         fix: fixing, fixEntry: fixing ? fixEntryOf(r) : null });
            if (!items.length) { closePanel(); return; }   // nothing changed: the job already reads this
            panelSave(items, false);
          },
        }, jobExtrasH(r, st)),
      };
    }
    function settledPanel(r) {
      var st = P.st;
      var flows = portalFlowsOf(r);
      var cur = flows.length ? flows[flows.length - 1] : null;
      if (st.already) {
        var a = st.already, hit = a.id != null && _byId[a.id];
        cur = hit || { id: a.id, type: a.entry_type, amount: a.amount, method: a.method, by: a.by, at: a.at, event_id: a.event_id || r.ev, job_code: r.jobCode || "", current: 1 };
      }
      // the leg that carries the confirmation is the one a correction belongs to
      var rr = cur ? (rowByEv(cur.event_id) || r) : r;
      if (st.type == null) st.type = cur ? (cur.type || cur.entry_type) : (rr.flow != null && rr.flow < 0 ? TAKEN : (settle(rr) || { type: BROUGHT }).type);
      if (st.method == null) st.method = cur ? normMethod(cur.method) : normMethod(rr.method);
      if (st.amt == null) st.amt = fmtAmt(cur ? Math.abs(+cur.amount || 0) : Math.abs(rr.flow || 0));
      if (st.note == null) st.note = "";
      var settledNow = rr.status === "Money Received";
      var confs = flows.filter(function (e) { return !e._repeatOf; });
      var confHtml = confs.length
        ? '<div class="mf-confs"><span class="mf-lg">Current confirmation' + (confs.length === 1 ? "" : "s") + "</span>"
          + confs.map(function (e) {
              return '<div class="mf-conf"><span class="mf-tlwhat"><span class="mf-b">' + (e.type === TAKEN ? "Paid out" : "Brought in") + " · " + esc(methodLabel(e.method)) + "</span>"
                + '<span class="mf-mut">' + esc(shortBy(e.by)) + " · " + fmtWhen(e.at) + (e.note && !/^(confirmed|bulk confirmed)$/i.test(e.note) ? " · " + esc(e.note) : "") + "</span></span>"
                + '<span class="mf-tlamt">' + money2(Math.abs(+e.amount || 0)) + "</span></div>";
            }).join("") + "</div>"
        : (rr.flow != null ? '<div class="mf-confs"><span class="mf-lg">Recorded</span><div class="mf-conf"><span class="mf-tlwhat"><span class="mf-b">'
            + (rr.flow < 0 ? "Paid out" : "Brought in") + " · " + (rr.flowSrc === "dc" ? "digital contract" : rr.flowSrc === "form" ? "form" : "portal")
            + '</span><span class="mf-mut">' + fmtWhen(rr.flowTs) + '</span></span><span class="mf-tlamt">' + money2(Math.abs(rr.flow)) + "</span></div></div>" : "");
      var box = '<div class="mf-setbox"><span class="mf-tlwhat"><span class="mf-b">'
        + (settledNow ? "This job is settled" : cur ? "Already confirmed — still " + money2(Math.abs(rr.balance || 0)) + " off" : "Nothing confirmed in the portal yet")
        + '</span><span class="mf-mut">The same money can’t be confirmed twice. If something was wrong, add a correction: it shows here with who and why.</span></span>'
        + (st.correcting ? "" : '<button type="button" class="mf-btn" data-mfp="corr" data-mffocus>Add a correction</button>') + "</div>";
      var form = "";
      if (st.correcting) {
        var list = methodsFor(allMethods(), st.type === TAKEN ? "out" : "in");
        if (!list.some(function (m) { return normMethod(m.name) === normMethod(st.method); })) {
          // the method it was saved with may since have been turned off: still offer it here
          list = list.concat([{ id: -1, name: normMethod(st.method) }]);
        }
        form = '<div class="mf-corr"><h3 class="mf-h3">Add a correction</h3>'
          + (cur ? '<p class="mf-mut">Replaces the ' + money2(Math.abs(+cur.amount || 0)) + " " + esc(methodLabel(cur.method)) + " entry of " + fmtWhen(cur.at) + " by " + esc(shortBy(cur.by))
              + (bareEv(cur.event_id) !== bareEv(r.ev) ? ", recorded on this job’s " + fmtD(rr.date) + " calendar day" : "") + ". Nothing is deleted.</p>"
              : '<p class="mf-mut">Adds a portal entry for this job. Nothing is deleted.</p>')
          + methodCards(list, st.method, false, st)
          + '<div class="mf-fld"><label for="mfAmt" class="mf-lg">' + (st.type === TAKEN ? "How much was paid to him?" : "How much did he bring?") + "</label>"
          + '<div class="mf-amt"><span class="mf-mut">$</span><input id="mfAmt" inputmode="decimal" autocomplete="off" value="' + esc(st.amt) + '" data-mffocus></div>'
          + '<div id="mfEff"></div><div id="mfFix"></div></div>'
          + '<div class="mf-dcl"><span class="mf-b">Day Closing</span><span class="mf-mut" id="mfDcl"></span></div>'
          + '<div class="mf-fld"><label for="mfNote" class="mf-lg2">Why the correction</label>'
          + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400" placeholder="e.g. He brought $1,000, not $1,134">' + esc(st.note) + "</textarea></div></div>";
      }
      var body = jobCardHtml(rr, { out: st.type === TAKEN, settled: true, noStoryLink: true, st: st }) + confHtml + box + form
        + expHtml(rr, st) + storySection(rr, true);
      var foot = '<div id="mfDErr"></div><div class="mf-dfrow">'
        + (st.correcting ? '<button type="button" class="mf-btn" data-mfp="corrcancel">Cancel</button><button type="button" class="mf-btn mf-pri" data-mfp="corrsave" id="mfSave">Save correction</button>'
          : '<button type="button" class="mf-btn" data-mfp="close">Close</button>') + "</div>";
      var balNow = debtOf(rr.forman);
      var cashOf = function (e) {
        if (!e) return 0;
        var sg = (e.type || e.entry_type) === TAKEN ? -1 : 1;
        if (!isCashMethod(e.method)) return 0;
        return sg * (e.cash_amount != null ? +e.cash_amount : Math.abs(+e.amount || 0));
      };
      var live = function () {
        if (!st.correcting) return;
        var amt = parseAmt(st.amt), eff = settleEffect(rr, st.type, amt, balNow, st.fix);
        var e = $("mfEff"), dc = $("mfDcl"), sv = $("mfSave");
        if (e) e.innerHTML = '<div class="mf-eff mf-eff-' + eff.kind + '"><span class="mf-b">' + esc(eff.title) + "</span>" + (eff.line ? "<span>" + esc(eff.line) + "</span>" : "") + "</div>";
        fixUi(st, eff.canFix ? settleEffect(rr, st.type, amt, balNow, false) : null);
        if (dc) {
          if (amt == null) dc.textContent = "—";
          else {
            var delta = r2((isCashMethod(st.method) ? (st.type === TAKEN ? -amt : amt) : 0) - cashOf(cur));
            dc.textContent = Math.abs(delta) < 0.005 ? "No change to today’s cash"
              : delta > 0 ? "Adds " + money2(delta) + " to today’s cash" : "Takes " + money2(-delta) + " out of today’s cash";
          }
        }
        if (sv) sv.textContent = amt == null ? "Save correction" : "Save correction · " + money2(amt) + " · " + normMethod(st.method);
      };
      return {
        title: settledNow ? "Settled" : "Already confirmed",
        body: body, foot: foot, after: live,
        onInput: function (e) {
          if (expInput(e, st)) return;
          if (e.target.id === "mfAmt") { st.amt = e.target.value; live(); }
          else if (e.target.id === "mfNote") st.note = e.target.value;
        },
        h: assign({
          fixmode: function (a) { st.fix = a.getAttribute("data-v") === "fix"; live(); },
          corr: function () { st.correcting = true; renderPanel(true); var i = $("mfAmt"); if (i) i.focus(); },
          tocorr: function () { st.correcting = true; renderPanel(); },
          corrcancel: function () { st.correcting = false; st.already = null; st.amt = null; st.method = null; st.type = null; st.note = ""; renderPanel(true); },
          method: function (a) { st.method = a.getAttribute("data-v"); renderPanel(true); },
          fm: function () { openFm(rr.forman, true); },
          story: toggleStory,
          corrsave: function () {
            var amt = parseAmt(st.amt);
            if (/^\s*-/.test(st.amt)) { panelErr("Enter the amount without a minus sign — the direction is already set."); return; }
            if (amt == null) { panelErr("Enter the amount."); return; }
            if (amt > 1000000) { panelErr("That amount looks wrong (over $1,000,000). Check the number."); return; }
            if (!String(st.note || "").trim()) { panelErr("Say why — a correction shows in the job’s history with who and why."); return; }
            var fixing = !!(st.fix && settleEffect(rr, st.type, amt, balNow, true).canFix);
            var items = settleItems(rr, { type: st.type, amt: amt, method: st.method, note: st.note, replaces: cur,
                                          fix: fixing, fixEntry: fixing ? fixEntryOf(rr) : null });
            if (!items.length) { panelErr("Nothing changed — change the amount or how it came in."); return; }
            panelSave(items, false);
          },
        }, jobExtrasH(rr, st)),
      };
    }
    // his open to-the-base jobs a pay-out can be balanced against (newest first)
    function offsetCands(neg) {
      if (!neg.forman || neg.forman === MF_NO_FOREMAN) return [];
      var nc = codeOf(neg.jobCode);
      return overlaid().filter(function (c) {
        return c.forman === neg.forman && c.ev !== neg.ev && bulkable(c) && !(nc && codeOf(c.jobCode) === nc);
      }).sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    }
    function payoutPanel(r) {
      var st = P.st;
      if (!st.ticked) st.ticked = {};
      if (st.way == null) st.way = "Cash";
      if (st.note == null) st.note = "";
      var w = methodsWritable();
      var cands = offsetCands(r);
      var outs = methodsFor(allMethods(), "out");
      if (st.way !== WAY_BAL && !outs.some(function (m) { return normMethod(m.name) === normMethod(st.way); })) st.way = "Cash";
      if (!w) { st.way = "Cash"; st.ticked = {}; }
      var plan = payoutPlan(r, cands, st.ticked, st.way, st.note);
      var fm = firstName(r.forman), balNow = debtOf(r.forman), after = r2(balNow + plan.balDelta);
      var list = cands.length
        ? cands.map(function (c, i) {
            var x = plan.rows[i], note = "To the base", cls = "mf-mut";
            if (x.kind === "full") { note = "Settled by this"; cls = "mf-incl"; }
            else if (x.kind === "part") { note = money2(x.take) + " used · " + money2(x.rest) + " goes on his balance"; cls = "mf-old"; }
            else if (x.kind === "unneeded") note = "Not needed";
            return '<label class="mf-mcard' + (x.on ? " mf-on" : "") + (w ? "" : " mf-off") + '"><input type="checkbox" data-mfp="tick" data-v="' + esc(c.ev) + '"' + (x.on ? " checked" : "") + (w ? "" : " disabled") + ">"
              + '<span class="mf-mcol mf-grow1"><span class="mf-b">' + esc(c.customer || "—") + '</span><span class="mf-mut mf-sm2">' + fmtShort(c.date) + " · " + esc(c.jobCode || "—") + "</span></span>"
              + '<span class="mf-mcol mf-end"><span class="mf-b">' + money2(x.amount) + '</span><span class="mf-sm2 ' + cls + '">' + note + "</span></span></label>";
          }).join("")
        : '<p class="mf-mut">' + (r.forman === MF_NO_FOREMAN ? "The foreman isn’t identified, so there are no other jobs to balance it against." : esc(fm) + " has no open jobs holding money for the base.") + "</p>";
      var wayName = st.way === WAY_BAL ? "" : normMethod(st.way);
      var info;
      if (st.way === WAY_BAL) info = "No money moves now.";
      else if (isCashMethod(st.way)) info = "Comes out of today’s cash at the base; Day Closing shows it.";
      else info = "Paid by " + esc(wayName) + ". The cash at the base doesn’t change.";
      if (Math.abs(after - balNow) > 0.005) info += " His balance: " + esc(owesText(balNow)) + " → " + esc(owesText(after)) + ".";
      var rest = plan.rest > 0
        ? '<div class="mf-fs"><span class="mf-lg">2 · Pay the rest: ' + money2(plan.rest) + "</span>"
          + '<div class="mf-ways" role="radiogroup" aria-label="Pay the rest by">'
          + outs.map(function (m) {
              return '<button type="button" class="mf-way" role="radio" aria-checked="' + (st.way !== WAY_BAL && normMethod(m.name) === normMethod(st.way)) + '" data-mfp="way" data-v="' + esc(m.name) + '"'
                + (!w && m.name !== "Cash" ? " disabled" : "") + ">" + esc(m.name) + "</button>";
            }).join("")
          + '<button type="button" class="mf-way" role="radio" aria-checked="' + (st.way === WAY_BAL) + '" data-mfp="way" data-v="' + WAY_BAL + '"' + (w ? "" : " disabled") + ">Leave it on his balance</button></div>"
          + (w ? "" : '<span class="mf-mut mf-sm2">' + esc(offlineNote() || "Money Flow update pending — until the database step has run, a pay-out can only be the full amount in cash.") + '</span>')
          + '<div class="mf-info">' + ICON.info + "<span>" + info + "</span></div></div>"
        : '<div class="mf-eff mf-eff-ok"><span class="mf-b">The jobs cover all of it</span><span>Nothing to pay out — no money moves.'
          + (Math.abs(after - balNow) > 0.005 ? " His balance: " + esc(owesText(balNow)) + " → " + esc(owesText(after)) + "." : "") + "</span></div>";
      var summary;
      var wl = st.way === WAY_BAL ? " left on his balance" : isCashMethod(st.way) ? " paid in cash" : " paid by " + wayName;
      if (plan.used > 0.005 && plan.rest > 0) summary = money2(plan.used) + " balanced against his jobs · " + money2(plan.rest) + wl;
      else if (plan.used > 0.005) summary = "All " + money2(plan.owed) + " balanced against his jobs";
      else summary = money2(plan.owed) + wl;
      if (plan.leftover > 0.005) summary += " · " + money2(plan.leftover) + " leftover goes on his balance";
      var body = jobCardHtml(r, { out: true, st: st })
        + '<fieldset class="mf-fs"><legend class="mf-lg">1 · Balance it against his other jobs</legend>'
        + (cands.length ? '<span class="mf-mut">' + (w ? "Jobs where " + esc(fm) + " still holds money for the base. Tick the ones to use."
            : esc(offlineNote() || "Money Flow update pending — balancing against his jobs works once the database step has run.")) + "</span>" : "")
        + list + "</fieldset>"
        + rest
        + '<div class="mf-fld"><label for="mfNote" class="mf-lg2">Note <span class="mf-mut">(optional)</span></label>'
        + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400" placeholder="e.g. Salaries for the ' + esc(fmtShort(r.date)) + ' crew">' + esc(st.note) + "</textarea></div>"
        + expHtml(r, st)
        + storySection(r, false);
      var foot = '<span class="mf-mut">' + esc(summary) + '</span><div id="mfDErr"></div><div class="mf-dfrow"><button type="button" class="mf-btn" data-mfp="close">Cancel</button>'
        + '<button type="button" class="mf-btn mf-pri" data-mfp="save">Confirm</button></div>';
      return {
        title: "Pay out to a foreman", body: body, foot: foot,
        onInput: function (e) { if (expInput(e, st)) return; if (e.target.id === "mfNote") st.note = e.target.value; },
        h: assign({
          tick: function (a) {
            var ev = a.getAttribute("data-v");
            if (st.ticked[ev]) delete st.ticked[ev];
            else {
              // one leg per job: ticking another leg of the same job code replaces it
              var c = codeOf((rowByEv(ev) || {}).jobCode);
              if (c) Object.keys(st.ticked).forEach(function (k) { if (codeOf((rowByEv(k) || {}).jobCode) === c) delete st.ticked[k]; });
              st.ticked[ev] = true;
            }
            renderPanel(true);
          },
          way: function (a) { st.way = a.getAttribute("data-v"); renderPanel(true); },
          story: toggleStory,
          fm: function () { openFm(r.forman, true); },
          tocorr: function () { st.mode = "settled"; st.correcting = true; renderPanel(); },
          save: function () {
            var p2 = payoutPlan(r, offsetCands(r), st.ticked, st.way, st.note);
            // a plain one-entry pay-out needs no link (and works before the database step has run)
            panelSave(p2.items, p2.items.length > 1);
          },
        }, jobExtrasH(r, st)),
      };
    }

    // ---- FOREMAN BALANCE panel ----
    var KIND = {
      fine: { label: "Fine", title: "Fine ", reason: "Reason", hint: "e.g. Damaged dresser, customer complaint", sign: 1 },
      advance: { label: "Advance", title: "Give an advance to ", reason: "What for", hint: "e.g. Fuel before a long trip", sign: 1 },
      repayment: { label: "Repayment", title: " pays back", reason: "Note", hint: "Optional", sign: -1 },
      opening: { label: "Opening balance", title: "What he owed before · ", reason: "Where it comes from", hint: "e.g. Old sheet, Sep 1", sign: 1 },
    };
    var KIND_ORDER = ["fine", "advance", "repayment", "opening"];
    function openFm(name, push) {
      if (!name || name === MF_NO_FOREMAN) return;
      openPanel({ kind: "fm", name: name }, push);
      if (!S.fines && !S.finesErr) loadFines().then(function () { if (P && P.spec.kind === "fm") renderPanel(true); paint(); });
    }
    function fmData(name) {
      var b = balRow(name) || { owes: 0, opening: 0, fined: 0, advanced: 0, short: 0, repaid: 0 };
      var ents = ((S.fines || {}).entries || []).filter(function (e) { return e["Is Current"] && String(e.Foreman || "").trim() === name; });
      var extras = 0;
      ents.forEach(function (e) { if (e.readonly && String(e.id).charAt(0) === "x") extras += +e.Amount || 0; });
      var hold = 0, owe = 0;
      overlaid().forEach(function (r) {
        if (r.forman !== name || !MAINSET[r.status] || r.balance == null) return;
        if (r.balance > 0) hold += r.balance; else owe += -r.balance;
      });
      // running "he owes after", oldest first
      var asc = ents.slice().sort(function (x, y) {
        var a = String(x["Fine Date"] || "").slice(0, 10) + String(x["Entered At"] || ""), c = String(y["Fine Date"] || "").slice(0, 10) + String(y["Entered At"] || "");
        return a < c ? -1 : a > c ? 1 : 0;
      });
      var run = 0;
      asc.forEach(function (e) { run = r2(run + (e["Entry Type"] === "repayment" ? -1 : 1) * (+e.Amount || 0)); e._after = run; });
      return { b: b, owes: b.owes || 0, extras: r2(extras), hold: r2(hold), owe: r2(owe), ledger: asc.slice().reverse() };
    }
    function fmPanel() {
      var name = P.spec.name, st = P.st, f = firstName(name);
      var head = '<div class="mf-fmhead"><span class="mf-av mf-av-lg mf-av-deep">' + esc(initials(name)) + "</span>"
        + '<div class="mf-mcol"><h2 id="mfDTitle">' + esc(name) + '</h2><span class="mf-mut">Foreman balance</span></div></div>';
      if (S.finesErr) return { head: head, body: '<div class="mf-errbox"><span>The foreman balances did not load: ' + esc(S.finesErr) + '</span><button type="button" class="mf-btn mf-sm" data-mfp="retry">Try again</button></div>',
        h: { retry: function () { S.finesErr = ""; S.fines = null; renderPanel(); loadFines().then(function () { renderPanel(); paint(); }); } } };
      if (!S.fines) return { head: head, body: '<div class="mf-load"><div class="mf-spin"></div>Loading his balance…</div>' };
      var d = fmData(name), b = d.b, owes = d.owes, all = r2(owes + d.hold - d.owe);
      var part = function (label, v) {
        return '<div class="mf-part"><span class="mf-mut mf-sm2">' + label + '</span><span class="mf-b ' + (v > 0.005 ? "mf-outc" : v < -0.005 ? "mf-incl" : "mf-dim") + '">'
          + (Math.abs(v) < 0.005 ? "$0" : (v > 0 ? "+" : "−") + money2(Math.abs(v)).replace("-", "")) + "</span></div>";
      };
      var kpis = '<div class="mf-fk"><div class="mf-fkc"><span class="mf-mut mf-b5">His balance</span><span class="mf-fkv mf-headc">' + (Math.abs(owes) < 0.005 ? "$0" : money2(Math.abs(owes))) + "</span>"
        + '<span class="mf-mut">' + (owes > 0.005 ? esc(f) + " owes the base" : owes < -0.005 ? "The base owes " + esc(f) : "Nothing either way") + "</span></div>"
        + '<div class="mf-fkc mf-fkc-2"><span class="mf-mut mf-b5">All together, with his open jobs</span><span class="mf-fkv">' + (all < -0.005 ? "base owes him " : "") + money2(Math.abs(all)) + "</span>"
        + '<span class="mf-mut">Balance + ' + money2(d.hold) + " he holds on jobs − " + money2(d.owe) + " the base owes him on jobs</span></div></div>";
      var parts = '<div class="mf-parts">' + part("Opening balance", b.opening || 0) + part("Fines", b.fined || 0) + part("Advances", b.advanced || 0)
        + part("Short hand-ins", b.short || 0) + part("Repayments", -r2((b.repaid || 0) - d.extras)) + part("Extra hand-ins", -d.extras) + "</div>";
      var kinds = '<div class="mf-ways">' + KIND_ORDER.map(function (k) {
        return '<button type="button" class="mf-kbtn" data-mfp="kind" data-v="' + k + '" aria-pressed="' + (st.adding === k && !st.editId) + '">+ ' + KIND[k].label + "</button>";
      }).join("") + "</div>";
      var form = "";
      if (st.adding) {
        var K = KIND[st.adding];
        var amt = parseAmt(st.amt), next = amt == null ? null : r2(owes + K.sign * amt - (st.editAmt != null ? K.sign * st.editAmt : 0));
        var payList = st.adding === "repayment" ? methodsFor(allMethods(), "in") : st.adding === "advance" ? methodsFor(allMethods(), "out") : null;
        var ftitle = st.editId ? "Correct this " + K.label.toLowerCase()
          : st.adding === "repayment" ? esc(f) + K.title : st.adding === "advance" ? K.title + esc(f) : st.adding === "fine" ? K.title + esc(f) : K.title + esc(f);
        form = '<div class="mf-form"><span class="mf-b">' + ftitle + "</span>"
          + '<div class="mf-frow"><div class="mf-fld"><label for="mfFAmt" class="mf-lg2">Amount</label>'
          + '<div class="mf-amt mf-amt-sm"><span class="mf-mut">$</span><input id="mfFAmt" inputmode="decimal" autocomplete="off" value="' + esc(st.amt || "") + '" data-mffocus></div></div>'
          + '<div class="mf-fld"><label for="mfFWhy" class="mf-lg2">' + K.reason + "</label>"
          + '<input id="mfFWhy" class="mf-in" maxlength="500" placeholder="' + esc(K.hint) + '" value="' + esc(st.reason || "") + '"></div></div>'
          + (payList ? '<div class="mf-payby"><span class="mf-b5">' + (st.adding === "repayment" ? "Paid by" : "Paid with") + "</span>"
              + payList.map(function (m) {
                  return '<button type="button" class="mf-way mf-way-sm" role="radio" aria-checked="' + (normMethod(st.method) === normMethod(m.name)) + '" data-mfp="pay" data-v="' + esc(m.name) + '"'
                    + (!methodsWritable() && m.name !== "Cash" ? " disabled" : "") + ">" + esc(m.name) + "</button>";
                }).join("") + "</div>" : "")
          + (st.editId ? '<p class="mf-mut mf-sm2">To waive it, set the amount to $0 and say why — the original stays readable in the history.</p>' : "")
          + '<div class="mf-frow2"><span class="mf-mut" id="mfFEff">' + (next == null ? "Enter an amount" : "His balance: " + esc(owesText(owes)) + " → " + esc(owesText(next))) + "</span>"
          + '<div class="mf-dfrow"><button type="button" class="mf-btn" data-mfp="fcancel">Cancel</button>'
          + '<button type="button" class="mf-btn mf-pri" data-mfp="fsave">' + (st.editId ? "Save correction" : "Add " + K.label.toLowerCase()) + "</button></div></div>"
          + '<div id="mfDErr"></div></div>';
      }
      var LBL = { opening: "Opening balance", fine: "Fine", advance: "Advance", short: "Short hand-in", repayment: "Repayment" };
      var ledger = d.ledger.length
        ? '<div class="mf-ledger"><div class="mf-lhd"><span>Date</span><span>What</span><span class="mf-r">Change</span><span class="mf-r">He owes after</span><span></span></div>'
          + d.ledger.map(function (e) {
              var t = e["Entry Type"], isX = e.readonly && String(e.id).charAt(0) === "x";
              var sgn = t === "repayment" ? -1 : 1, v = +e.Amount || 0;
              var meth = (t === "repayment" || t === "advance") && !e.readonly ? " · " + esc(normMethod(e.Method)) : "";
              var act = e.readonly ? "" : e["Settled Report Id"] != null
                ? '<span class="mf-dim mf-sm2" title="Already carried on a closing statement — record a repayment or a new fine instead">on a statement</span>'
                : '<button type="button" class="mf-linkbtn" data-mfp="edit" data-v="' + esc(String(e.id)) + '">Correct</button>';
              return '<div class="mf-lrow"><span class="mf-mut">' + fmtShort(e["Fine Date"]) + "</span>"
                + '<span class="mf-mcol"><span class="mf-lwhat"><span class="mf-b">' + (isX ? "Extra hand-in" : esc(LBL[t] || t)) + "</span>"
                + (e.readonly ? '<span class="mf-tag">' + (e.link_id != null ? "from a pay-out" : "from Settle") + "</span>" : "") + (e["Replaces Id"] ? '<span class="mf-tag">correction</span>' : "") + "</span>"
                + '<span class="mf-mut">' + esc(e.Reason || "—") + meth + (e["Job Code"] ? ' · <span class="mf-code">' + esc(e["Job Code"]) + "</span>" : "") + " · " + esc(shortBy(e["Entered By"])) + "</span></span>"
                + '<span class="mf-r mf-b ' + (sgn * v > 0 ? "mf-outc" : sgn * v < 0 ? "mf-incl" : "mf-dim") + '">' + (v === 0 ? "$0" : (sgn > 0 ? "+" : "−") + money2(v)) + "</span>"
                + '<span class="mf-r mf-b5">' + (e._after < 0 ? "−" + money2(-e._after) : money2(e._after)) + "</span>"
                + '<span class="mf-r">' + act + "</span></div>";
            }).join("") + "</div>"
        : '<p class="mf-mut">Nothing on his balance yet.</p>';
      var body = kpis + parts
        + '<div class="mf-sect"><div class="mf-secth"><h3 class="mf-h3">Add to his balance</h3><span class="mf-mut mf-sm2">Short and extra hand-ins arrive here by themselves when a job is settled</span></div>'
        + kinds + form + "</div>"
        + '<div class="mf-sect"><h3 class="mf-h3">Every change, newest first</h3>' + ledger + "</div>";
      var resetForm = function () { st.adding = null; st.editId = null; st.editAmt = null; st.amt = ""; st.reason = ""; st.method = "Cash"; st.date = null; st.job = null; };
      var effUpdate = function () {
        var el = $("mfFEff"); if (!el || !st.adding) return;
        var K = KIND[st.adding], amt = parseAmt(st.amt);
        var nx = amt == null ? null : r2(owes + K.sign * amt - (st.editAmt != null ? K.sign * st.editAmt : 0));
        el.textContent = nx == null ? "Enter an amount" : "His balance: " + owesText(owes) + " → " + owesText(nx);
      };
      return {
        head: head, body: body,
        onInput: function (e) {
          if (e.target.id === "mfFAmt") { st.amt = e.target.value; effUpdate(); }
          else if (e.target.id === "mfFWhy") st.reason = e.target.value;
        },
        h: {
          kind: function (a) {
            var k = a.getAttribute("data-v");
            if (st.adding === k && !st.editId) { resetForm(); renderPanel(true); return; }
            resetForm(); st.adding = k;
            if (k === "repayment" && owes > 0.005) st.amt = fmtAmt(owes);
            renderPanel(true);
            var i = $("mfFAmt"); if (i) i.focus();
          },
          pay: function (a) { st.method = a.getAttribute("data-v"); renderPanel(true); },
          fcancel: function () { resetForm(); renderPanel(true); },
          edit: function (a) {
            var id = a.getAttribute("data-v");
            var e = ((S.fines || {}).entries || []).filter(function (x) { return String(x.id) === id; })[0];
            if (!e) return;
            resetForm();
            st.adding = e["Entry Type"]; st.editId = e.id; st.editAmt = +e.Amount || 0;
            st.amt = fmtAmt(+e.Amount || 0); st.reason = e.Reason || ""; st.method = normMethod(e.Method);
            st.date = String(e["Fine Date"] || "").slice(0, 10) || null; st.job = e["Job Code"] || null;
            renderPanel(true);
            var i = $("mfFAmt"); if (i) i.focus();
          },
          fsave: function () { saveFine(name, st, resetForm); },
        },
      };
    }
    async function saveFine(name, st, resetForm) {
      var amt = parseAmt(st.amt), reason = String(st.reason || "").trim(), kind = st.adding;
      if (/^\s*-/.test(st.amt || "")) { panelErr("Enter the amount without a minus sign — the kind sets the direction."); return; }
      if (amt == null) { panelErr("Enter an amount."); return; }
      if (amt > 1000000) { panelErr("That amount looks wrong (over $1,000,000). Check the number."); return; }
      if (kind === "fine" && !reason) { panelErr("Say what the fine is for — a fine with no reason cannot be defended."); return; }
      if (amt === 0 && !reason) { panelErr("Say why this is being set to $0."); return; }
      var body = { foreman: name, entry_type: kind, amount: amt, reason: reason, date: st.date || todayIso };
      if (st.job) body.job_code = st.job;
      if (st.editId) body.replaces_id = st.editId;
      if (kind === "repayment" || kind === "advance") {
        body.method = normMethod(st.method);
        // an older bridge ignores `method` and would book a Zelle repayment as drawer cash
        if (!isCashMethod(body.method) && !methodsWritable()) {
          panelErr(offlineNote() || "Money Flow update pending — only Cash can be recorded here until the server is updated."); return;
        }
      }
      panelErr(""); panelBusy(true);
      var out;
      try { out = await postJson("/api/_ffines", body); }
      catch (e) { panelBusy(false); panelErr(netWords(e)); return; }
      panelBusy(false);
      if (!out.res.ok) { panelErr(saveError(out.res, out.j, {})); return; }
      S.fines = out.j;                    // the server hands back the whole ledger
      resetForm();
      renderPanel(true);
      paint();
      if (kind === "repayment" || kind === "advance") { if (window.ZDC && $("mfDayStrip")) ZDC.mountStrip($("mfDayStrip")); dcStale = true; }
    }

    // ---- PAYMENT METHODS panel ----
    function methodsPanel() {
      var st = P.st;
      if (st.draftIn == null) { st.draftIn = true; st.draftOut = true; st.draft = ""; }
      var list = allMethods().slice().sort(function (a, b) { return (+a.sort || 100) - (+b.sort || 100) || String(a.name).localeCompare(String(b.name)); });
      var on = list.filter(function (m) { return +m.is_on; }), off = list.filter(function (m) { return !+m.is_on; });
      var w = methodsWritable(), dis = w ? "" : " disabled";
      var sw = function (m, key, label) {
        var v = !!+m[key];
        return '<button type="button" class="mf-sw" role="switch" aria-checked="' + v + '" aria-label="' + esc(m.name) + " " + label + '" data-mfp="msw" data-id="' + esc(String(m.id)) + '" data-k="' + key + '"' + dis + "></button>";
      };
      var body = (w ? "" : '<div class="mf-why">' + (offlineNote() ? esc(offlineNote())
        : "<b>Money Flow update pending.</b> The server hasn’t been updated yet, so this list is the starting set and can’t be changed. Cash always works.") + '</div>')
        + '<div class="mf-mt"><div class="mf-mthd"><span>Method</span><span class="mf-c">Money in</span><span class="mf-c">Paying out</span><span class="mf-r">Offered</span></div>'
        + '<div class="mf-mtrow mf-mtcash"><span class="mf-mcol"><span class="mf-lwhat"><span class="mf-b">Cash</span><span class="mf-tag">Built in</span></span>'
        + '<span class="mf-sm2">The only one that touches the cash at the base and Day Closing</span></span>'
        + '<span class="mf-c mf-incl">' + ICON.yes + '</span><span class="mf-c mf-incl">' + ICON.yes + '</span><span class="mf-r mf-mut mf-sm2">Always</span></div>'
        + on.map(function (m) {
            return '<div class="mf-mtrow"><span class="mf-lwhat"><span class="mf-b">' + esc(m.name) + "</span>" + ((st.added || {})[m.name] ? '<span class="mf-tag mf-tag-new">New</span>' : "") + "</span>"
              + '<span class="mf-c">' + sw(m, "money_in", "for money in") + "</span>"
              + '<span class="mf-c">' + sw(m, "pay_out", "for paying out") + "</span>"
              + '<span class="mf-r"><button type="button" class="mf-btn mf-sm" data-mfp="moff" data-id="' + esc(String(m.id)) + '"' + dis + ">Turn off</button></span></div>";
          }).join("") + "</div>"
        + '<section class="mf-addsec" aria-labelledby="mfAddH"><h3 class="mf-h3" id="mfAddH">Add a method</h3>'
        + '<div class="mf-fld"><label for="mfMName" class="mf-lg2">Name</label><input id="mfMName" class="mf-in" maxlength="40" placeholder="e.g. Venmo, Wire" value="' + esc(st.draft) + '"' + dis + "></div>"
        + '<div class="mf-addopts"><label class="mf-chk"><input type="checkbox" id="mfMIn"' + (st.draftIn ? " checked" : "") + dis + ">For money in</label>"
        + '<label class="mf-chk"><input type="checkbox" id="mfMOut"' + (st.draftOut ? " checked" : "") + dis + ">For paying out</label>"
        + '<button type="button" class="mf-btn mf-pri mf-push" data-mfp="madd"' + dis + ">Add method</button></div>"
        + '<div id="mfDErr"></div>'
        + '<span class="mf-mut mf-sm2">Added once, it stays on the list for everyone until someone turns it off.</span></section>'
        + '<section class="mf-offsec" aria-labelledby="mfOffH"><h3 class="mf-h3 mf-caps" id="mfOffH">Turned off</h3>'
        + (off.length ? off.map(function (m) {
            return '<div class="mf-offrow"><span class="mf-mut mf-b5">' + esc(m.name) + '</span><button type="button" class="mf-btn mf-sm" data-mfp="mon" data-id="' + esc(String(m.id)) + '"' + dis + ">Turn on</button></div>";
          }).join("") : '<p class="mf-mut">None.</p>')
        + '<p class="mf-mut mf-sm2">A method that’s off isn’t offered any more. Jobs settled with it keep its name in their history.</p></section>';
      var foot = '<div class="mf-footnote">' + ICON.person + "<span>Anyone who settles money can add or turn off a method. Each change keeps who and when.</span></div>";
      var find = function (id) { return allMethods().filter(function (m) { return String(m.id) === String(id); })[0]; };
      var push = async function (bodyIn, undo) {
        panelErr("");
        var out;
        try { out = await postJson("/api/_mfmethods", bodyIn); }
        catch (e) { if (undo) undo(); renderPanel(true); panelErr(netWords(e)); return false; }
        if (!out.res.ok || !Array.isArray(out.j.methods)) { if (undo) undo(); renderPanel(true); panelErr(saveError(out.res, out.j, { methods: true })); return false; }
        setMethods(out.j.methods);
        renderPanel(true);
        return true;
      };
      return {
        title: "Payment methods",
        head: '<div class="mf-mcol"><h2 id="mfDTitle">Payment methods</h2><span class="mf-mut">What people can pick when a foreman brings money in, and when the base pays a foreman out.</span></div>',
        body: body, foot: foot,
        onInput: function (e) { if (e.target.id === "mfMName") st.draft = e.target.value; },
        onChange: function (e) {
          if (e.target.id === "mfMIn") st.draftIn = e.target.checked;
          if (e.target.id === "mfMOut") st.draftOut = e.target.checked;
        },
        h: {
          msw: function (a) {
            var m = find(a.getAttribute("data-id")), k = a.getAttribute("data-k"); if (!m || !w) return;
            var was = +m[k] ? 1 : 0, body2 = { id: m.id }; body2[k] = was ? 0 : 1;
            if (!body2[k] && !+m[k === "money_in" ? "pay_out" : "money_in"]) { panelErr("A method has to be offered one way at least — turn it off instead."); return; }
            m[k] = was ? 0 : 1; renderPanel(true);                       // optimistic
            push(body2, function () { m[k] = was; });
          },
          moff: function (a) { var m = find(a.getAttribute("data-id")); if (!m || !w) return; m.is_on = 0; renderPanel(true); push({ id: m.id, is_on: 0 }, function () { m.is_on = 1; }); },
          mon: function (a) { var m = find(a.getAttribute("data-id")); if (!m || !w) return; m.is_on = 1; renderPanel(true); push({ id: m.id, is_on: 1 }, function () { m.is_on = 0; }); },
          madd: async function () {
            var name = String(st.draft || "").trim(), bad = methodNameProblem(name);
            if (bad) { panelErr(bad); return; }
            if (!st.draftIn && !st.draftOut) { panelErr("Tick “For money in”, “For paying out”, or both."); return; }
            var ok = await push({ name: name, money_in: st.draftIn ? 1 : 0, pay_out: st.draftOut ? 1 : 0 });
            if (ok) { st.added = st.added || {}; st.added[name] = 1; st.draft = ""; renderPanel(true); }
          },
        },
      };
    }

    // ---------- EXPORT: the current tab as CSV ----------
    function exportCsv() {
      var rows = overlaid(), scope = rows.filter(inScope), q = S.q.trim().toLowerCase();
      var cell = function (v) {
        var s = v == null ? "" : String(v);
        if (/^[=+\-@]/.test(s)) s = " " + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      var cols, data, name;
      if (S.view === "settled") {
        cols = ["Settled", "Foreman", "Job date", "Job code", "Job #", "Customer", "Method", "Amount", "Money went", "By"];
        data = settledRows(scope, q).map(function (r) {
          return [settledKey(r).slice(0, 10), r.forman, r.date, r.jobCode, r.jobNo, r.customer, methodLabel(r.method),
            r.flow == null ? 0 : r2(Math.abs(r.flow)), r.flow == null || Math.abs(r.flow) < 0.005 ? "" : r.flow < 0 ? "To the foreman" : "To the base", settledBy(r)];
        });
        name = "Money Flow — settled";
      } else if (S.view === "balances") {
        cols = ["Foreman", "His balance", "Open jobs (net)", "All together"];
        data = balancesList(scope.filter(function (r) { return MAINSET[r.status]; }), q).map(function (x) { return [x.name, x.bal, r2(x.open), x.total]; });
        name = "Money Flow — foreman balances";
      } else {
        cols = ["Foreman", "Job date", "Job code", "Job #", "Customer", "Type", "Status", "Money goes", "Amount", "Waiting (days)", "His balance",
                "Net cash (contract)", "Net cash corrected to", "Job expenses"];
        var set = S.need ? scope.filter(function (r) { return needOf(r) === S.need; }) : scope.filter(function (r) { return MAINSET[r.status]; });
        data = set.filter(function (r) { return matches(r, q); }).sort(function (a, b) { return a.forman.localeCompare(b.forman) || (a.date < b.date ? 1 : -1); }).map(function (r) {
          var d = dirOf(r);
          return [r.forman, r.date, r.jobCode, r.jobNo, r.customer, r.jobType, r.status, d > 0 ? "To the base" : d < 0 ? "To the foreman" : "",
            r.balance == null ? "" : r2(Math.abs(r.balance)), daysWaiting(r.date), S.fines ? debtOf(r.forman) : "",
            r.recorded == null ? "" : r.recorded, r.fix == null ? "" : r.fix, r.exp ? r.exp : ""];
        });
        name = "Money Flow — waiting";
      }
      var lines = [cols.map(cell).join(",")].concat(data.map(function (row) { return row.map(cell).join(","); }));
      var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name + " (" + todayIso + ").csv";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }

    /* ---------- MONTH CLOSE (his ask, 2026-10-09: "reporting tool ... total foreman repayment and
       total additional expense per job ... so we can correctly close the month") ----------
       Four parts, all read from what the page already has -- nothing new is stored:
         1. Cash: the Day Closing days whose date falls in the month (+ the open day, if it does);
         2. The foremen's balances: fines, advances, short hand-ins and repayments dated in the month
            (/api/_ffines, the same ledger as the Foreman balances tab);
         3. Job expenses and net cash corrections of the month's JOBS (by job date);
         4. What is still open today from the month's jobs, and what the foremen owe today.
       All companies: the drawer and the ledger are the base's, not a company's. */
    // stale: a save here moved the drawer since the days were fetched (set by afterWrite)
    var MC = { dc: null, dcErr: "", dcAt: 0, loading: false, key: "", stale: false, finesAsked: false };
    function mcDefaultMonth() {
      // in the first ten days of a month the month being closed is the one before
      var d = new Date(todayIso + "T12:00:00");
      if (d.getDate() <= 10) d.setMonth(d.getMonth() - 1);
      return d.toISOString().slice(0, 7);
    }
    function mcMonths() {
      var out = [], d = new Date(todayIso.slice(0, 7) + "-15T12:00:00");
      for (var i = 0; i < 13; i++) { out.push(d.toISOString().slice(0, 7)); d.setMonth(d.getMonth() - 1); }
      return out;
    }
    function mcName(m) {
      var d = new Date(m + "-15T12:00:00");
      return isNaN(d) ? m : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    function mcLoadDc(force) {
      if (!window.ZDC || MC.loading) return;
      if (!force && (MC.dc || MC.dcErr) && Date.now() - MC.dcAt < 60000 && !MC.stale) return;
      MC.loading = true; MC.stale = false; MC.dcAt = Date.now();
      ZDC.api(force ? "?fresh=1" : "").then(function (d) { MC.dc = d; MC.dcErr = ""; MC.dcAt = Date.now(); })
        .catch(function (e) { MC.dcErr = String(e && e.message || e); })
        .then(function () { MC.loading = false; if (myGen === window.__MFGEN && topNow === "month-close") paintMonth(true); });
    }
    // everything the month's four parts show, worked out once (the CSV reads the same numbers)
    function mcData(m) {
      var inM = function (d) { return String(d || "").slice(0, 7) === m; };
      // 1 · cash, from the Day Closing days of the month
      var cash = { cash_in: 0, card_out: 0, fines: 0, advances: 0, net: 0, nc_in: 0, nc_out: 0, days: [], open: null };
      if (MC.dc) {
        (MC.dc.days || []).forEach(function (d) {
          if (!inM(d.date)) return;
          var t = d.totals || {}, nc = d.not_cash || {};
          cash.days.push({ date: d.date, kind: d.kind, t: t, nc: nc, closedBy: d.closed_by || "" });
          cash.cash_in += t.cash_in || 0; cash.card_out += t.card_out || 0; cash.fines += t.fines || 0;
          cash.advances += t.advances || 0; cash.net += t.net || 0; cash.nc_in += nc.in || 0; cash.nc_out += nc.out || 0;
        });
        var o = MC.dc.open;
        if (o && inM(todayIso) && o.totals && (o.totals.n_lines || 0) > 0) {
          var ot = o.totals, onc = o.not_cash || {};
          cash.open = { t: ot, nc: onc };
          cash.cash_in += ot.cash_in || 0; cash.card_out += ot.card_out || 0; cash.fines += ot.fines || 0;
          cash.advances += ot.advances || 0; cash.net += ot.net || 0; cash.nc_in += onc.in || 0; cash.nc_out += onc.out || 0;
        }
        cash.days.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      }
      // 2 · the foremen's balances: every current movement dated in the month
      var fm = {}, ftot = { fined: 0, advanced: 0, short: 0, repaid: 0, repaidJobs: 0, opening: 0 }, byMethod = {};
      ((S.fines || {}).entries || []).forEach(function (e) {
        if (!e["Is Current"] || !inM(e["Fine Date"])) return;
        var f = String(e.Foreman || "").trim() || MF_NO_FOREMAN, a = +e.Amount || 0, t = e["Entry Type"];
        var x = fm[f] || (fm[f] = { name: f, fined: 0, advanced: 0, short: 0, repaid: 0, repaidJobs: 0, opening: 0 });
        if (t === "repayment") {
          // an extra brought on a job is a repayment too (the ledger lists it read-only)
          var k = e.readonly ? "repaidJobs" : "repaid";
          x[k] += a; ftot[k] += a;
          if (!e.readonly) { var mm = normMethod(e.Method); byMethod[mm] = (byMethod[mm] || 0) + a; }
        } else {
          var key = t === "fine" ? "fined" : t === "advance" ? "advanced" : t === "short" ? "short" : t === "opening" ? "opening" : "fined";
          x[key] += a; ftot[key] += a;
        }
      });
      var fmList = Object.keys(fm).map(function (f) {
        var x = fm[f];
        x.change = r2(x.fined + x.advanced + x.short + x.opening - x.repaid - x.repaidJobs);
        x.owes = S.fines ? debtOf(f) : null;
        return x;
      }).sort(function (a, b) { return Math.abs(b.change) - Math.abs(a.change) || a.name.localeCompare(b.name); });
      // 3 · job expenses (one line per job) and net cash corrections, by the JOB's date
      var rows = overlaid(), jobs = {}, expTot = 0, nExp = 0;
      ((S.live && S.live.entries) || []).forEach(function (e) {
        if (!e.current || e.type !== JOB_EXP || !(Math.abs(+e.amount || 0) > 0.005)) return;
        var r = rowByEv(e.event_id) || (codeOf(e.job_code) && (idx().legs[codeOf(e.job_code)] || [])[0]) || null;
        var date = r ? r.date : String(e.at || "").slice(0, 10);
        if (!inM(date)) return;
        var k = codeOf(e.job_code) || (r && codeOf(r.jobCode)) || "ev:" + bareEv(e.event_id);
        var j = jobs[k] || (jobs[k] = { date: date, code: (r && r.jobCode) || e.job_code || "", customer: r ? r.customer : "",
                                        forman: r ? r.forman : "", items: [], total: 0, ev: r ? r.ev : null });
        j.items.push(e); j.total = r2(j.total + Math.abs(+e.amount || 0)); expTot += Math.abs(+e.amount || 0); nExp++;
      });
      var expJobs = Object.keys(jobs).map(function (k) { return jobs[k]; }).sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      var fixes = rows.filter(function (r) { return r.fix != null && inM(r.date) && r.status !== "Filter Out"; }).map(function (r) {
        var fe = fixEntryOf(r);
        return { r: r, open: fixOpen(r), was: r.recorded, to: r.fix, diff: r.recorded == null ? null : r2(r.fix - r.recorded), why: fe ? fe.note : "", by: fe ? fe.by : "" };
      }).sort(function (a, b) { return a.r.date < b.r.date ? -1 : 1; });
      // 4 · still open today, from the month's jobs
      var open = { toBase: 0, nBase: 0, toFm: 0, nFm: 0, cnr: 0, mc: 0, fix: 0, byFm: {} };
      rows.forEach(function (r) {
        if (!inM(r.date)) return;
        var n = needOf(r);
        if (n === "cnr") open.cnr++; else if (n === "mc") open.mc++; else if (n === "fix") open.fix++;
        if (!MAINSET[r.status]) return;
        var d = dirOf(r);
        if (d > 0) { open.toBase += r.balance; open.nBase++; }
        else if (d < 0) { open.toFm += -r.balance; open.nFm++; }
        if (d !== 0) {
          var g = open.byFm[r.forman] || (open.byFm[r.forman] = { name: r.forman, toBase: 0, toFm: 0, n: 0 });
          if (d > 0) g.toBase += r.balance; else g.toFm += -r.balance;
          g.n++;
        }
      });
      open.fmList = Object.keys(open.byFm).map(function (f) { return open.byFm[f]; })
        .sort(function (a, b) { return (b.toBase - b.toFm) - (a.toBase - a.toFm); });
      var owesNow = 0, owedNow = 0;
      ((S.fines || {}).balances || []).forEach(function (b) { if (b.owes > 0.005) owesNow += b.owes; else if (b.owes < -0.005) owedNow += -b.owes; });
      return { m: m, cash: cash, fmList: fmList, ftot: ftot, byMethod: byMethod, expJobs: expJobs, expTot: r2(expTot), nExp: nExp,
               fixes: fixes, open: open, owesNow: r2(owesNow), owedNow: r2(owedNow) };
    }
    // the tab can open before the jobs (and MC, todayIso) exist: it says so, and the page's first
    // paint() draws it -- so nothing here may touch them
    function mountMonth() { paintMonth(true); }
    // what the tab needs besides the jobs: the Day Closing days and the foreman ledger
    function mcEnsure() {
      if (!S.fines && !S.finesErr && !MC.finesAsked) {
        MC.finesAsked = true;
        loadFines().then(function () { if (myGen === window.__MFGEN && topNow === "month-close") paintMonth(true); });
      }
      mcLoadDc(false);
    }
    function paintMonth(force) {
      var pane = document.getElementById("mfPaneMonth");
      if (!pane || topNow !== "month-close") return;
      if (!base || !MC || !todayIso) { pane.innerHTML = '<div class="mf-load"><div class="mf-spin"></div>Loading jobs…</div>'; return; }
      if (!S.mcMonth) S.mcMonth = mcDefaultMonth();
      mcEnsure();
      var key = [S.mcMonth, S.liveAt, MC.dcAt, MC.dcErr, (S.fines && S.fines.entries || []).length, S.finesErr, !!S.fines, (S.live && S.live.entries || []).length].join("|");
      if (!force && key === MC.key) return;          // nothing it shows has changed
      MC.key = key;
      var sc = document.getElementById("content"), top = sc ? sc.scrollTop : 0;
      pane.innerHTML = monthHtml(mcData(S.mcMonth));
      if (sc) sc.scrollTop = top;
      var sel = $("mfMcMonth");
      if (sel) sel.onchange = function () { S.mcMonth = sel.value; paintMonth(true); };
      pane.onclick = function (e) {
        var a = e.target.closest("[data-mfm]"); if (!a) return;
        var k = a.getAttribute("data-mfm");
        if (k === "csv") monthCsv(mcData(S.mcMonth));
        else if (k === "refresh") {
          mcLoadDc(true);
          loadLive(true).then(function () { setLiveBadge(); paintMonth(true); });
          loadFines().then(function () { paintMonth(true); });
        } else if (k === "job") { setTop("money-flow"); openJob(a.getAttribute("data-v"), false); }
        else if (k === "fm") { setTop("money-flow"); openFm(a.getAttribute("data-v"), false); }
      };
    }
    function monthHtml(D) {
      var c = D.cash, o = D.open, ft = D.ftot;
      var repaidAll = r2(ft.repaid + ft.repaidJobs);
      var opts = mcMonths().map(function (m) { return '<option value="' + m + '"' + (m === D.m ? " selected" : "") + ">" + esc(mcName(m)) + "</option>"; }).join("");
      var head = '<div class="mf-mchead"><div class="mf-qtitle"><h2>Month close · ' + esc(mcName(D.m)) + "</h2>"
        + "<p>What moved in the month, what the foremen repaid, the jobs’ extra expenses and net cash corrections, and what is still open. All companies.</p></div>"
        + '<div class="mf-topbtns"><label class="mf-mcsel"><span class="mf-mut">Month</span><select id="mfMcMonth" class="mf-in">' + opts + "</select></label>"
        + '<button type="button" class="mf-btn" data-mfm="refresh">Refresh</button>'
        + '<button type="button" class="mf-btn" data-mfm="csv">' + ICON.dl + "Download CSV</button></div></div>";
      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi"><span class="mf-kl">Cash into the drawer (net)</span><span class="mf-kv">' + (MC.dc ? money(c.net) : "…") + "</span>"
        + '<span class="mf-ks">' + (MC.dc ? money(c.cash_in) + " in · " + money(Math.abs(c.card_out + c.advances)) + " out" : MC.dcErr ? "Day Closing didn’t load" : "Loading Day Closing…") + "</span></div>"
        + '<div class="mf-kpi"><span class="mf-kl">Foremen repaid</span><span class="mf-kv">' + (S.fines ? money(repaidAll) : "…") + "</span>"
        + '<span class="mf-ks">' + (S.fines ? money(ft.repaid) + " directly · " + money(ft.repaidJobs) + " as extra on jobs" : S.finesErr ? "The balances didn’t load" : "Loading the balances…") + "</span></div>"
        + '<div class="mf-kpi mf-kpi-out"><span class="mf-kl">Job expenses</span><span class="mf-kv">' + money(D.expTot) + "</span>"
        + '<span class="mf-ks">' + D.nExp + " expense" + (D.nExp === 1 ? "" : "s") + " on " + D.expJobs.length + " job" + (D.expJobs.length === 1 ? "" : "s") + "</span></div>"
        + '<div class="mf-kpi mf-kpi-look"><span class="mf-kl">Still open from the month</span><span class="mf-kv">' + money(o.toBase) + "</span>"
        + '<span class="mf-ks">' + o.nBase + " job" + (o.nBase === 1 ? "" : "s") + " to the base · " + money(o.toFm) + " owed to foremen</span></div></div>";
      var tbl = function (cols, rows, foot, cls) {
        return '<div class="mf-scroll"><table class="mf-mct' + (cls ? " " + cls : "") + '"><thead><tr>' + cols.map(function (x) {
            return "<th" + (x.r ? ' class="mf-r"' : "") + ">" + x.l + "</th>"; }).join("") + "</tr></thead><tbody>"
          + rows.join("") + "</tbody>" + (foot ? "<tfoot>" + foot + "</tfoot>" : "") + "</table></div>";
      };
      var td = function (v, r) { return "<td" + (r ? ' class="mf-r"' : "") + ">" + v + "</td>"; };
      var sec = function (n, title, sub, inner) {
        return '<section class="mf-q mf-mcsec" aria-labelledby="mfMc' + n + '"><div class="mf-qhead"><div class="mf-qtitle"><h2 id="mfMc' + n + '"><span class="mf-mcn">' + n + "</span>" + title + "</h2><p>" + sub + "</p></div></div>" + inner + "</section>";
      };
      // 1 · cash
      var s1;
      if (MC.dcErr && !MC.dc) s1 = '<div class="mf-empty">Day Closing didn’t load — ' + esc(MC.dcErr) + ' <button type="button" class="mf-btn mf-sm" data-mfm="refresh">Try again</button></div>';
      else if (!MC.dc) s1 = '<div class="mf-load"><div class="mf-spin"></div>Loading Day Closing…</div>';
      else if (!c.days.length && !c.open) s1 = '<div class="mf-empty">No Day Closing days in ' + esc(mcName(D.m)) + ".</div>";
      else {
        var drow = function (label, t, nc) {
          return "<tr>" + td(label) + td(money2(t.cash_in || 0), 1) + td(money2(Math.abs(t.card_out || 0)), 1) + td(money2(Math.abs(t.advances || 0)), 1)
            + td(money2(t.fines || 0), 1) + td("<b>" + money2(t.net || 0) + "</b>", 1) + td(money2(Math.abs(nc.in || 0) + Math.abs(nc.out || 0)), 1) + "</tr>";
        };
        s1 = tbl([{ l: "Day" }, { l: "Cash in", r: 1 }, { l: "Paid out", r: 1 }, { l: "Advances given", r: 1 }, { l: "of it: balance repaid", r: 1 }, { l: "Net to the drawer", r: 1 }, { l: "Not cash", r: 1 }],
          c.days.map(function (d) { return drow(esc(fmtD(d.date)) + (d.kind === "reconstructed" ? ' <span class="mf-tag">reconstructed</span>' : ""), d.t, d.nc); })
            .concat(c.open ? [drow("Open day <span class=\"mf-tag\">not closed yet</span>", c.open.t, c.open.nc)] : []),
          "<tr>" + td("<b>The month</b>") + td("<b>" + money2(c.cash_in) + "</b>", 1) + td("<b>" + money2(Math.abs(c.card_out)) + "</b>", 1) + td("<b>" + money2(Math.abs(c.advances)) + "</b>", 1)
            + td("<b>" + money2(c.fines) + "</b>", 1) + td("<b>" + money2(c.net) + "</b>", 1) + td("<b>" + money2(Math.abs(c.nc_in) + Math.abs(c.nc_out)) + "</b>", 1) + "</tr>")
          + '<p class="mf-mcnote">Cash only: Zelle, card and jobs balanced against other jobs are under <b>Not cash</b> and never touch the drawer. <b>Cash in</b> includes balance repayments made in cash.</p>';
      }
      // 2 · the foremen's balances
      var s2;
      if (S.finesErr && !S.fines) s2 = '<div class="mf-empty">The foreman balances didn’t load — ' + esc(S.finesErr) + ' <button type="button" class="mf-btn mf-sm" data-mfm="refresh">Try again</button></div>';
      else if (!S.fines) s2 = '<div class="mf-load"><div class="mf-spin"></div>Loading the foreman balances…</div>';
      else if (!D.fmList.length) s2 = '<div class="mf-empty">No fines, advances, short hand-ins or repayments in ' + esc(mcName(D.m)) + ".</div>";
      else {
        var meth = Object.keys(D.byMethod).sort().map(function (k) { return esc(k) + " " + money2(D.byMethod[k]); }).join(" · ");
        s2 = tbl([{ l: "Foreman" }, { l: "Fines", r: 1 }, { l: "Advances", r: 1 }, { l: "Short hand-ins", r: 1 }, { l: "Repaid", r: 1 }, { l: "Extra on jobs", r: 1 }, { l: "Change in the month", r: 1 }, { l: "Owes today", r: 1 }],
          D.fmList.map(function (x) {
            return "<tr>" + td('<button type="button" class="mf-linkbtn mf-b" data-mfm="fm" data-v="' + esc(x.name) + '">' + esc(x.name) + "</button>")
              + td(money2(x.fined), 1) + td(money2(x.advanced), 1) + td(money2(x.short), 1) + td(money2(x.repaid), 1) + td(money2(x.repaidJobs), 1)
              + td("<b>" + (x.change > 0.005 ? "+" : "") + money2(x.change) + "</b>", 1)
              + td(x.owes == null ? "—" : x.owes > 0.005 ? money2(x.owes) : x.owes < -0.005 ? "base owes " + money2(-x.owes) : "$0", 1) + "</tr>";
          }),
          "<tr>" + td("<b>All " + D.fmList.length + "</b>") + td("<b>" + money2(ft.fined) + "</b>", 1) + td("<b>" + money2(ft.advanced) + "</b>", 1) + td("<b>" + money2(ft.short) + "</b>", 1)
            + td("<b>" + money2(ft.repaid) + "</b>", 1) + td("<b>" + money2(ft.repaidJobs) + "</b>", 1)
            + td("<b>" + money2(r2(ft.fined + ft.advanced + ft.short + ft.opening - ft.repaid - ft.repaidJobs)) + "</b>", 1) + td("", 1) + "</tr>")
          + '<p class="mf-mcnote">' + (meth ? "Repaid directly, by how it came in: " + meth + ". " : "")
          + (ft.opening > 0.005 ? "Opening balances entered this month: " + money2(ft.opening) + " (in the change). " : "")
          + "A + change means the foremen owe more than at the start of the month.</p>";
      }
      // 3 · job expenses + corrections
      var s3a = D.expJobs.length ? tbl([{ l: "Job date" }, { l: "Job" }, { l: "Customer" }, { l: "Foreman" }, { l: "What for" }, { l: "Expenses", r: 1 }],
          D.expJobs.map(function (j) {
            return "<tr>" + td(esc(fmtShort(j.date))) + td('<span class="mf-code">' + esc(j.code || "—") + "</span>")
              + td(j.ev ? '<button type="button" class="mf-linkbtn" data-mfm="job" data-v="' + esc(j.ev) + '">' + esc(j.customer || "—") + "</button>" : esc(j.customer || "—"))
              + td(esc(j.forman || "—")) + td(j.items.map(function (e) { return esc(e.note || "—") + (j.items.length > 1 ? " (" + money2(Math.abs(+e.amount || 0)) + ")" : ""); }).join("; "))
              + td("<b>" + money2(j.total) + "</b>", 1) + "</tr>";
          }),
          "<tr>" + td("<b>" + D.expJobs.length + " job" + (D.expJobs.length === 1 ? "" : "s") + "</b>") + td("") + td("") + td("") + td(D.nExp + " expense" + (D.nExp === 1 ? "" : "s")) + td("<b>" + money2(D.expTot) + "</b>", 1) + "</tr>")
        : '<div class="mf-empty">No job expenses on ' + esc(mcName(D.m)) + " jobs.</div>";
      var fixOpenN = D.fixes.filter(function (x) { return x.open; }).length;
      var s3b = D.fixes.length ? tbl([{ l: "Job date" }, { l: "Job" }, { l: "Customer" }, { l: "Foreman" }, { l: "Contract says", r: 1 }, { l: "Corrected to", r: 1 }, { l: "Difference", r: 1 }, { l: "Why" }, { l: "Contract" }],
          D.fixes.map(function (x) {
            return "<tr>" + td(esc(fmtShort(x.r.date))) + td('<span class="mf-code">' + esc(x.r.jobCode || "—") + "</span>")
              + td('<button type="button" class="mf-linkbtn" data-mfm="job" data-v="' + esc(x.r.ev) + '">' + esc(x.r.customer || "—") + "</button>")
              + td(esc(x.r.forman || "—")) + td(money2(x.was), 1) + td("<b>" + money2(x.to) + "</b>", 1)
              + td(x.diff == null ? "—" : (x.diff > 0 ? "+" : "") + money2(x.diff), 1)
              + td(esc(x.why || "—") + (x.by ? ' <span class="mf-mut">(' + esc(shortBy(x.by)) + ")</span>" : ""))
              + td(x.open ? '<span class="mf-pill mf-p-warn">To fix</span>' : '<span class="mf-pill mf-p-in">' + ICON.check + "Fixed</span>") + "</tr>";
          }), null)
        : '<div class="mf-empty">No net cash corrections on ' + esc(mcName(D.m)) + " jobs.</div>";
      var s3 = '<h3 class="mf-h3 mf-mcsub">Job expenses — not on the contract</h3>' + s3a
        + '<h3 class="mf-h3 mf-mcsub">Net cash corrections' + (fixOpenN ? ' <span class="mf-pill mf-p-warn">' + fixOpenN + " still to fix in the contract</span>" : "") + "</h3>" + s3b
        + '<p class="mf-mcnote">By the job’s date. An expense lowers what the foreman owed on that job; a correction replaced the contract’s net cash. Neither touches the drawer or his balance.</p>';
      // 4 · still open
      var s4 = tbl([{ l: "Foreman" }, { l: "Open jobs", r: 1 }, { l: "To the base", r: 1 }, { l: "To him", r: 1 }],
          o.fmList.slice(0, 15).map(function (g) {
            return "<tr>" + td(esc(g.name)) + td(String(g.n), 1) + td(g.toBase > 0.005 ? money2(g.toBase) : "—", 1) + td(g.toFm > 0.005 ? money2(g.toFm) : "—", 1) + "</tr>";
          }),
          "<tr>" + td("<b>" + (o.fmList.length > 15 ? "All " + o.fmList.length + " foremen" : "All") + "</b>") + td("<b>" + (o.nBase + o.nFm) + "</b>", 1)
            + td("<b>" + money2(o.toBase) + "</b>", 1) + td("<b>" + money2(o.toFm) + "</b>", 1) + "</tr>")
        + '<p class="mf-mcnote">As of today, for jobs dated in ' + esc(mcName(D.m)) + ". Also waiting: "
        + o.cnr + " with no contract, " + o.mc + " with no closing, " + o.fix + " net cash to fix."
        + (S.fines ? " Foremen’s balances today: they owe " + money2(D.owesNow) + (D.owedNow > 0.005 ? "; the base owes them " + money2(D.owedNow) : "") + "." : "") + "</p>";
      return '<div class="mf-mc">' + head + kp
        + sec(1, "Cash in, paid out, the drawer", "The Day Closing days of the month, added up.", s1)
        + sec(2, "Foreman repayments, fines and advances", "Every change to the foremen’s balances dated in the month.", s2)
        + sec(3, "Job expenses and net cash corrections", "The month’s jobs that had extra costs, or a net cash the office corrected.", '<div class="mf-mcbody">' + s3 + "</div>")
        + sec(4, "Still open", "What the month’s jobs still owe today.", s4)
        + "</div>";
    }
    function monthCsv(D) {
      var cell = function (v) {
        var s = v == null ? "" : String(v);
        if (/^[=+\-@]/.test(s)) s = " " + s;
        return '"' + s.replace(/"/g, '""') + '"';
      };
      var L = [["Month close", mcName(D.m), "", "", "", "", "", ""],
               ["Section", "Date", "Job code", "Customer", "Foreman", "Line", "Amount", "Note"]];
      var c = D.cash;
      if (MC.dc) {
        c.days.forEach(function (d) {
          L.push(["Cash", d.date, "", "", "", "Cash in", r2(d.t.cash_in || 0), d.kind === "reconstructed" ? "reconstructed" : ""]);
          L.push(["Cash", d.date, "", "", "", "Paid out", r2(Math.abs(d.t.card_out || 0)), ""]);
          L.push(["Cash", d.date, "", "", "", "Advances given", r2(Math.abs(d.t.advances || 0)), ""]);
          L.push(["Cash", d.date, "", "", "", "Net to the drawer", r2(d.t.net || 0), ""]);
        });
        if (c.open) L.push(["Cash", todayIso, "", "", "", "Net to the drawer", r2(c.open.t.net || 0), "open day, not closed yet"]);
        L.push(["Cash", "", "", "", "", "Month: cash in", r2(c.cash_in), ""]);
        L.push(["Cash", "", "", "", "", "Month: paid out", r2(Math.abs(c.card_out)), ""]);
        L.push(["Cash", "", "", "", "", "Month: advances given", r2(Math.abs(c.advances)), ""]);
        L.push(["Cash", "", "", "", "", "Month: balance repaid in cash", r2(c.fines), ""]);
        L.push(["Cash", "", "", "", "", "Month: net to the drawer", r2(c.net), ""]);
        L.push(["Cash", "", "", "", "", "Month: not cash", r2(Math.abs(c.nc_in) + Math.abs(c.nc_out)), "Zelle, card, balanced against jobs"]);
      }
      D.fmList.forEach(function (x) {
        [["Fines", x.fined], ["Advances", x.advanced], ["Short hand-ins", x.short], ["Repaid", x.repaid], ["Extra on jobs (repaid)", x.repaidJobs], ["Opening balance", x.opening], ["Change in the month", x.change]]
          .forEach(function (p) { if (Math.abs(p[1]) > 0.005 || p[0] === "Change in the month") L.push(["Foreman balance", "", "", "", x.name, p[0], r2(p[1]), ""]); });
      });
      D.expJobs.forEach(function (j) {
        j.items.forEach(function (e) { L.push(["Job expense", j.date, j.code, j.customer, j.forman, "Expense", r2(Math.abs(+e.amount || 0)), e.note || ""]); });
      });
      L.push(["Job expense", "", "", "", "", "Month total", D.expTot, D.nExp + " expenses on " + D.expJobs.length + " jobs"]);
      D.fixes.forEach(function (x) {
        L.push(["Net cash correction", x.r.date, x.r.jobCode, x.r.customer, x.r.forman, "Contract says", x.was, ""]);
        L.push(["Net cash correction", x.r.date, x.r.jobCode, x.r.customer, x.r.forman, "Corrected to", x.to, (x.open ? "to fix in the contract — " : "fixed — ") + (x.why || "")]);
      });
      D.open.fmList.forEach(function (g) {
        if (g.toBase > 0.005) L.push(["Still open", "", "", "", g.name, "To the base", r2(g.toBase), g.n + " jobs"]);
        if (g.toFm > 0.005) L.push(["Still open", "", "", "", g.name, "To him", r2(g.toFm), ""]);
      });
      var blob = new Blob(["﻿" + L.map(function (row) { return row.map(cell).join(","); }).join("\r\n")], { type: "text/csv;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "Money Flow — month close " + D.m + ".csv";
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
    }

    // ---------- the four tabs: Money Flow · Day Closing · Month close · How to use ----------
    function topFromHash() {
      var m = location.hash.match(/[#&]tab=([\w-]+)/), k = m ? m[1] : "money-flow";
      return TOPS.some(function (t) { return t[0] === k; }) ? k : "money-flow";
    }
    // replaceState, never a navigation: no hashchange, no re-render, no reload. Any other
    // parameter in the hash (&lead= opens a lead over any page) stays where it is.
    function setTopHash(key) {
      var rest = location.hash.replace(/^#/, "").split("&").filter(function (p) { return p && !/^(page|tab)=/.test(p); });
      var want = "#page=money-flow" + (key === "money-flow" ? "" : "&tab=" + key) + (rest.length ? "&" + rest.join("&") : "");
      if (location.hash !== want) { try { history.replaceState(null, "", want); } catch (e) { /* file:// */ } }
    }
    /* Switching tabs only shows and hides: what a tab has loaded stays loaded. Day Closing and the
       guide are built the first time their tab opens; the Money Flow strip skips its 20-second
       refresh while its tab is hidden and catches up when the tab comes back (ZDC.wakeStrip). */
    function setTop(key) {
      if (!TOPS.some(function (t) { return t[0] === key; })) key = "money-flow";
      topNow = key;
      TOPS.forEach(function (t) {
        var b = document.getElementById("mfTopT-" + t[0]), p = document.getElementById(t[2]), on = t[0] === key;
        if (b) { b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; }
        if (p) p.hidden = !on;
      });
      setTopHash(key);
      if (key !== "money-flow" && P) closePanel();
      if (key === "day-closing") mountDc();
      else if (key === "month-close") mountMonth();
      else if (key === "how-to") mountHow();
      else if (window.ZDC && ZDC.wakeStrip) ZDC.wakeStrip(document.getElementById("mfDayStrip"));
    }
    /* the Day Closing PAGE, drawn by its own render into this tab -- one copy of it, never two.
       Drawn once; drawn again (fresh from the server, as its own Refresh does) only when a save
       here has moved the drawer since -- otherwise it would show the day as it was. */
    function mountDc() {
      var pane = document.getElementById("mfPaneDc");
      if (!pane) return;
      if (dcMounted && dcStale) dcMounted = false;
      if (dcMounted) {
        // a table laid out while its tab was hidden measured nothing; measure it now
        var w = pane.querySelector(".dcl-wrap");
        if (w && window.RSC && RSC.fitScroller) RSC.fitScroller(w);
        return;
      }
      var pg = (window.PAGES || []).filter(function (p) { return p.id === "day-closing"; })[0];
      if (!pg || !window.ZDC) { pane.innerHTML = '<div class="mf-empty">Day Closing isn’t available on this page. Tell Tornike.</div>'; return; }
      var fresh = dcStale;
      dcMounted = true; dcStale = false;
      var mine = myGen;
      pane.innerHTML = '<div class="mf-load"><div class="mf-spin"></div>Loading Day Closing…</div>';
      Promise.resolve().then(function () { return pg.render(pane, { embedded: true, fresh: fresh }); }).catch(function (e) {
        if (mine !== window.__MFGEN || !document.getElementById("mfPaneDc")) return;
        dcMounted = false;
        pane.innerHTML = '<div class="mf-empty">Day Closing couldn’t load — ' + esc(String(e && e.message || e))
          + ' <button type="button" class="mf-btn mf-sm" id="mfDcRetry">Try again</button></div>';
        var rb = document.getElementById("mfDcRetry"); if (rb) rb.onclick = mountDc;
      });
    }
    function mountHow() {
      var pane = document.getElementById("mfPaneHow");
      if (!pane || howMounted) return;
      howMounted = true;
      pane.innerHTML = howHtml();
      pane.onclick = function (e) {
        var a = e.target.closest("[data-mfh]"); if (!a) return;
        var k = a.getAttribute("data-mfh");
        if (TOPS.some(function (t) { return t[0] === k; })) { setTop(k); return; }
        var to = document.getElementById(k);
        if (!to) return;
        // focus FIRST (a focus() during a smooth scroll stops it where it is), then scroll
        try { to.focus({ preventScroll: true }); } catch (x) { /* best effort */ }
        try { to.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (x) { to.scrollIntoView(); }
      };
    }

    /* HOW TO USE (his ask, 2026-10-08): the guide for the people who record money at the base.
       Plain words, short sentences, numbered steps. EVERY LINE DESCRIBES WHAT THIS FILE (and
       day-closing.js) ACTUALLY DOES -- the button names, the panel wording and the messages are
       quoted from the code above. Change a feature, change its paragraph here. */
    function howHtml() {
      var I = function (p) {
        return '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + "</svg>";
      };
      var HI = {
        about: I('<circle cx="12" cy="12" r="9"></circle><path d="M12 8h.01"></path><path d="M11 12h1v5h1"></path>'),
        wait: I('<path d="M9 6h12"></path><path d="M9 12h12"></path><path d="M9 18h12"></path><path d="M4 6h.01"></path><path d="M4 12h.01"></path><path d="M4 18h.01"></path>'),
        settle: I('<circle cx="12" cy="12" r="9"></circle><path d="M8 12.5l2.7 2.7L16 9.8"></path>'),
        bulk: I('<path d="M12 3l9 5-9 5-9-5z"></path><path d="M3 13l9 5 9-5"></path>'),
        payout: I('<path d="M19 12H5"></path><path d="M11 6l-6 6 6 6"></path>'),
        bal: I('<circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 4-6 8-6s8 2 8 6"></path>'),
        corr: I('<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v5h5"></path>'),
        card: I('<rect x="2" y="5" width="20" height="14" rx="2"></rect><path d="M2 10h20"></path>'),
        dc: I('<path d="M21 8v13H3V8"></path><path d="M1 3h22v5H1z"></path><path d="M10 12h4"></path>'),
        msg: I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>'),
        fix: I('<path d="M12 20h9"></path><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"></path>'),
        month: I('<rect x="3" y="4.5" width="18" height="16" rx="2"></rect><path d="M3 9.5h18"></path><path d="M8 2.5v4"></path><path d="M16 2.5v4"></path><path d="M8 14h3"></path>'),
      };
      // a button's name as it looks on the page, and a quote of the page's own words
      var k = function (label, kind) { return '<span class="mf-hk' + (kind ? " mf-hk-" + kind : "") + '">' + label + "</span>"; };
      var q = function (s) { return '“<span class="mf-hq">' + s + "</span>”"; };
      var steps = function (a) { return '<ol class="mf-hsteps">' + a.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ol>"; };
      var list = function (a) { return '<ul class="mf-hlist">' + a.map(function (x) { return "<li>" + x + "</li>"; }).join("") + "</ul>"; };
      var defs = function (a) { return '<dl class="mf-hdefs">' + a.map(function (x) { return "<dt>" + x[0] + "</dt><dd>" + x[1] + "</dd>"; }).join("") + "</dl>"; };
      var tip = function (s, warn) { return '<div class="mf-htip' + (warn ? " mf-htip-warn" : "") + '">' + ICON.info + "<span>" + s + "</span></div>"; };
      var h4 = function (s) { return '<h4 class="mf-hh4">' + s + "</h4>"; };
      var p = function (s) { return '<p class="mf-hp">' + s + "</p>"; };
      var inPill = '<span class="mf-pill mf-p-in">' + ICON.toBase + "To the base</span>";
      var outPill = '<span class="mf-pill mf-p-out">' + ICON.toFm + "To the foreman</span>";

      var SECS = [
        { id: "mfHow1", icon: HI.about, title: "What this page is for", body:
          p("Money Flow keeps track of <b>who owes whom</b> between the base and the foremen.")
          + list([
            "After a job, the foreman may hold cash that belongs to the base. Or the base may owe him money for that job.",
            "The page shows this <b>job by job</b>.",
            "It also keeps one <b>balance</b> for each foreman, for money that isn’t one job: fines, advances, short or extra hand-ins, and repayments.",
          ])
          + h4("The four tabs at the top")
          + defs([
            [k("Money Flow"), "The work: jobs waiting to be settled, jobs already settled, and each foreman’s balance."],
            [k("Day Closing"), "The cash drawer at the base. It closes by itself every evening at 8 PM New York time."],
            [k("Month close"), "One month on one page: the cash, the foremen’s repayments, the jobs’ extra expenses and corrected net cash, and what is still open (part 11)."],
            [k("How to use"), "This guide."],
          ])
          + h4("Inside the Money Flow tab")
          + defs([
            [k("Waiting"), "Jobs where money still has to move."],
            [k("Settled"), "Jobs already confirmed, grouped by foreman. Pick dates to see one period."],
            [k("Foreman balances"), "Each foreman’s balance, next to what his open jobs owe."],
          ])
          + tip("The three cards at the top add it all up: what the foremen owe the base, what the base owes the foremen, and how many jobs need a look.") },

        { id: "mfHow2", icon: HI.wait, title: "The Waiting tab", body:
          p("Waiting lists the jobs where money still has to move, one line per foreman. The foremen with the most to bring come first.")
          + steps([
            "Read the foreman’s line: what his jobs owe the base (<b>Jobs: to the base</b>), what the base owes him (<b>Jobs: to him</b>), <b>His balance</b>, and his <b>Oldest job</b>. An oldest job of more than 30 days is highlighted.",
            "Click the line to open it. His jobs appear, newest first.",
            "Each job says where the money goes. " + inPill + " means he must bring money to the base. " + outPill + " means the base must pay him.",
            "Press the button at the end of the job to act on it (see below).",
            k(ICON.cal + "Calendar") + " opens the job’s Google Calendar event. " + k(ICON.doc + "Contract") + " opens its digital contract. Both open in a new browser tab, so Money Flow stays open. A job with no contract has no Contract button.",
          ])
          + h4("The button at the end of a job")
          + defs([
            [k("Settle", "acc"), "He brings money to the base. See part 3."],
            [k("Pay out", "out"), "The base pays him. See part 5."],
            [k("Enter cash"), "The job has no contract yet. Enter money only if it really changed hands."],
            [k("Review"), "The job is already confirmed. Open it to look, or to add a correction (part 7)."],
            ['<span class="mf-hq">File the closing</span>', "The closing sheet has no line for this job yet. It can’t be settled here until the closing is filed."],
          ])
          + list([
            "Click a <b>customer’s name</b> to see everything that happened on that job.",
            "The search box finds a customer, a job code, a request number or a foreman. Type a number, like 1134, to find an amount.",
            "At first only 12 foremen are listed: press " + k("Show every foreman") + " for the rest. Inside a foreman, his 8 newest jobs show first: press " + k("Show … older jobs") + " for the rest.",
            "<b>Needs a look</b> shows jobs with no contract, jobs that don’t add up, jobs with no closing, and jobs whose net cash was corrected (" + q("net cash to fix") + ", part 9). Press " + k("Open the … jobs") + " on a card to list only those.",
          ])
          + tip("On a narrower screen, Calendar and Contract sit one above the other instead of side by side. They work the same.") },

        { id: "mfHow3", icon: HI.settle, title: "Settling one job", body:
          p("Use this when a foreman brings money to the base for one job.")
          + steps([
            "Press " + k("Settle", "acc") + " on the job. A panel opens on the right.",
            "Check the job at the top: the customer, the job code, the date, and how much he owes the base.",
            "Under <b>How did it come in?</b> pick how the money came. That is <b>Cash</b>: another method shows here only if it is switched on for money in under <b>Payment methods</b> (part 8).",
            "Under <b>How much did he bring?</b> type the amount. The full amount is already filled in. " + k("Full $…") + " puts it back.",
            "Read the coloured box under the amount. It says what will happen.",
            "Press " + k("Confirm", "pri") + ".",
          ])
          + h4("What the box under the amount can say")
          + defs([
            [q("Settles the job in full"), "He brought the right amount. A difference of $10 or less also counts as in full."],
            [q("$… short — goes on his balance"), "He brought less. The job is settled, and the missing money is added to what he owes."],
            [q("$… extra — comes off his balance"), "He brought more. The job is settled, and the extra pays back what he owes."],
            [q("The job’s net cash becomes $… — the contract says $…"), "You picked " + q("The job’s net cash is wrong") + " (part 9): the job settles on what he handed over and nothing goes on his balance."],
          ])
          + tip("When the amount isn’t what the job asks for, the panel asks <b>Whose is the difference?</b> Leave it on the first choice if he really brought too little or too much. Pick " + q("The job’s net cash is wrong") + " only when the contract or closing has the wrong figure and he handed over the right amount (part 9).")
          + tip("The <b>Day Closing</b> line shows what happens to the cash drawer. Cash: " + q("Adds $… to today’s cash") + ". Any other method: " + q("Not cash — no change to today’s cash") + ".")
          + tip("No contract yet? The button says " + k("Enter cash") + ". Pick which way the money went, <b>He brought money to the base</b> or <b>The base paid him</b>, and enter only money that really moved.") },

        { id: "mfHow4", icon: HI.bulk, title: "Several jobs at once", body:
          p("When a foreman hands over cash for several jobs, you can confirm them together.")
          + steps([
            "Open the foreman in <b>Waiting</b>.",
            "Tick the box at the start of each job he paid. The box in the header ticks all his jobs on the screen.",
            "A dark bar appears at the bottom with the number of jobs and the total.",
            "Press " + k("Confirm $… cash from …", "pri") + ". Check the list in the window that opens, then press <b>Confirm</b> again.",
          ])
          + list([
            "This is for <b>cash, in full</b> only. Every ticked job is confirmed for its whole amount.",
            "<b>One foreman at a time.</b> Ticking another foreman’s job starts a new selection.",
            "If one job is short or extra, leave it unticked and settle it on its own with " + k("Settle", "acc") + ".",
            "Only jobs where he owes the base and nothing is confirmed yet have a box.",
            k("Clear") + " removes all the ticks.",
          ]) },

        { id: "mfHow5", icon: HI.payout, title: "Paying a foreman out", body:
          p("Use this when the base owes a foreman money for a job: " + outPill + ".")
          + steps([
            "Press " + k("Pay out", "out") + " on the job.",
            "<b>1 · Balance it against his other jobs.</b> The list shows his jobs where he still holds money for the base. Tick the ones to use. They are used from the top down.",
            "Each ticked job tells you " + q("Settled by this") + ", " + q("$… used · $… goes on his balance") + " or " + q("Not needed") + ". A ticked job worth more than what is left still settles: its leftover goes on his balance.",
            "<b>2 · Pay the rest.</b> Pick <b>Cash</b> (already picked), another method that is on for paying out, such as <b>Card</b> or <b>Zelle</b>, or <b>Leave it on his balance</b>.",
            "Check the line at the bottom of the panel, then press " + k("Confirm", "pri") + ".",
          ])
          + h4("How the rest is paid")
          + defs([
            [k("Cash"), "Comes out of today’s cash at the base. Day Closing shows it."],
            [k("Card") + " " + k("Zelle"), "The cash at the base doesn’t change."],
            [k("Leave it on his balance"), "No money moves now. The base owes him this amount on his balance."],
          ])
          + tip("If the ticked jobs cover all of it, the panel says " + q("The jobs cover all of it") + ": nothing is paid out.") },

        { id: "mfHow6", icon: HI.bal, title: "The foreman balance", body:
          p("Each foreman has one balance for money that isn’t one job. " + q("owes $…") + " means he owes the base. " + q("the base owes him $…") + " means the opposite.")
          + p("Open it with " + k("Open his balance") + " in Waiting, " + k("Open balance") + " in Foreman balances, or by clicking his balance in any job panel. The top shows his balance and <b>All together, with his open jobs</b>. Under it are the parts: opening balance, fines, advances, short hand-ins, repayments and extra hand-ins.")
          + h4("Add to his balance")
          + defs([
            [k("+ Fine"), "Type the amount and the reason. A fine always needs a reason. He owes more."],
            [k("+ Advance"), "Money given to him ahead. Type the amount and what it is for, and pick how it was paid. He owes more."],
            [k("+ Repayment"), "He pays money back. If he owes, the full amount is already filled in. Pick how he paid: Cash, or another method switched on for money in. He owes less."],
            [k("+ Opening balance"), "What he owed before this system, and where that figure comes from."],
          ])
          + list([
            "Short and extra hand-ins arrive by themselves when a job is settled. You don’t add them here. A short counts only what its job is still short, so it comes down by itself when the job’s net cash is corrected (part 9).",
            "A <b>cash</b> repayment goes into today’s drawer. A <b>cash</b> advance comes out of it. Zelle or card doesn’t touch the drawer.",
            "<b>Every change, newest first</b> lists each entry and what he owed after it. " + k("Correct") + " fixes an entry. To cancel one, set it to $0 and say why. The original stays in the history.",
            "An entry marked <b>on a statement</b> is already on a closing statement and can’t be corrected: add a repayment or a new fine instead. Entries tagged <b>from Settle</b> or <b>from a pay-out</b> come from a job: correct the job instead (part 7).",
          ]) },

        { id: "mfHow7", icon: HI.corr, title: "Corrections", body:
          p("The same money can’t be confirmed twice. If a confirmation was wrong, add a correction. Nothing is deleted.")
          + steps([
            "Open the job: press " + k("Review") + " in Waiting, or click the job in <b>Settled</b>.",
            "Press " + k("Add a correction") + ".",
            "Pick the right method and type the right amount.",
            "Under <b>Why the correction</b>, say what was wrong, for example " + q("He brought $1,000, not $1,134") + ". A reason is required.",
            "Press " + k("Save correction", "pri") + ".",
          ])
          + list([
            "The old entry stays in the job’s history, marked <b>replaced by a correction</b>, with who and when.",
            "The <b>Day Closing</b> line shows how today’s cash changes. Only the difference moves.",
          ])
          + tip("Pressed Confirm on a job someone already confirmed? You will see " + q("This job is already confirmed … The same money can’t be confirmed twice — add a correction instead. Nothing was saved.") + " Press " + k("Add a correction") + " right there.", true) },

        { id: "mfHow8", icon: HI.card, title: "Payment methods", body:
          p("Methods are the ways money comes in or goes out. <b>Cash</b> is built in and always there. It is the only method that touches the cash at the base and Day Closing.")
          + h4("Add a method")
          + steps([
            "Press " + k(ICON.card + "Payment methods") + " at the top of the Money Flow tab.",
            "Under <b>Add a method</b>, type its name.",
            "Tick <b>For money in</b>, <b>For paying out</b>, or both.",
            "Press " + k("Add method", "pri") + ". It stays on the list for everyone.",
          ])
          + list([
            "Each method has two switches: <b>Money in</b> (a foreman brings money) and <b>Paying out</b> (the base pays a foreman).",
            k("Turn off") + " a method you no longer use. It isn’t offered any more, and jobs settled with it keep its name. Turn it back on under <b>Turned off</b>.",
            "While settling a job you can also press <b>Add a method — it stays on the list</b>. A method added there is for money in.",
            "Every change keeps who made it and when.",
          ]) },

        { id: "mfHowFix", icon: HI.fix, title: "A wrong net cash, and job expenses", body:
          p("Two things that change what a job asks for, without touching the cash drawer or the foreman’s balance.")
          + h4("The job’s net cash is wrong")
          + p("The contract or the closing has the wrong net cash, and the foreman handed over the <b>right</b> amount. Don’t put the difference on his balance: settle the job on what he handed over, and fix the contract afterwards.")
          + steps([
            "Press " + k("Settle", "acc") + " (or " + k("Review") + " → " + k("Add a correction") + " if the job is already confirmed).",
            "Type what he really handed over.",
            "Under <b>Whose is the difference?</b> pick " + q("The job’s net cash is wrong") + ".",
            "Under " + q("What is wrong with the net cash?") + " say what is wrong, for example " + q("Contract still has the old price") + ". It is required: the office fixes the contract from it.",
            "Press " + k("Confirm", "pri") + ".",
          ])
          + list([
            "The job is settled, and nothing goes on his balance. A short or extra already moved for this job comes back off it.",
            "Until the contract or closing says the corrected figure, the job is listed under <b>Needs a look</b> as " + q("net cash to fix") + ". Once it is fixed there, the flag goes away by itself.",
            "Picked it by mistake? Open the job and press " + k("Take the correction back") + ", then say why. The job goes back to the contract’s figure.",
          ])
          + tip("<b>Already settled short, and the contract or closing gets fixed later?</b> Nothing to do. A short on his balance counts only what the job is still short. Once the net cash matches what he brought, it stops counting by itself, the moment the fix reaches Money Flow. The job card and its history say " + q("no longer counts") + ", and his balance shows the short as " + q("counts $… of $…") + " while it is only partly owed. Nothing is written, so if the figure changes back, the short counts again.")
          + h4("Job expenses")
          + p("Money spent on a job that isn’t on the contract, for example $400 for an extra truck. It lowers what the foreman owes on that job at once.")
          + steps([
            "Open the job (" + k("Settle", "acc") + ", " + k("Pay out", "out") + " or " + k("Review") + ").",
            "Under <b>Job expenses</b> press " + k(ICON.plus + "Add a job expense") + ".",
            "Type the amount and what it was for, then press " + k("Add expense", "pri") + ". The panel stays open, and the amount the job asks for goes down.",
          ])
          + list([
            "A job can have several expenses. Each one has " + k("Change") + " and " + k("Withdraw") + ". Withdrawing asks why, and the expense stays in the job’s history.",
            "Expenses never touch the cash drawer or his balance. They are listed in " + k("Month close") + ".",
          ]) },

        { id: "mfHow9", icon: HI.dc, title: "Day Closing", body:
          p("Day Closing is the cash drawer at the base. Every day at <b>8:00 PM New York time</b> the day closes by itself. There is no button.")
          + list([
            "A day closes only if something was recorded. With nothing recorded, the open day runs on to the next 8 PM.",
            "<b>Only cash moves the drawer.</b> Zelle, card and jobs balanced against other jobs are listed as <b>not cash</b>: shown, never counted.",
            "A correction moves only the difference. Confirming the same amount twice moves nothing.",
          ])
          + h4("The words on the strip and in the table")
          + defs([
            [q("in the drawer"), "What should be in the drawer: the cash that came in, less the cash paid out."],
            [q("cash in"), "Cash brought to the base."],
            [q("paid out"), "Cash the base paid to foremen from the drawer."],
            [q("advances given"), "Cash handed to foremen as advances."],
            [q("not cash"), "Zelle, card and job-against-job entries. Listed for information only."],
            [q("Your total"), "What you recorded in the open day. <b>Everyone</b> is the whole base."],
            [q("reconstructed, not signed"), "A day from before the first closing, rebuilt from the records."],
          ])
          + h4("Reading a day")
          + steps([
            "Open the " + k("Day Closing") + " tab. Each line is one day, with the open day on top.",
            "Click a day to see who recorded what. Click a person to see their foremen. Click a foreman to see every movement.",
            "Press " + k("PDF") + " to print a day, a person or a foreman.",
          ])
          + tip("<b>Managers only</b> (the people set up as Day Closing managers in General Settings, and admins) see these on closed days: "
            + k("Lock") + " once the day’s cash is banked (a locked day can’t be changed or reopened, until a manager presses " + k("Unlock") + "); "
            + k("Reopen") + " on the newest closed day only (its movements go back to the open day and close again at the next 8 PM); "
            + k("Take out") + " to send one line back to the open day.")
          + tip("The strip at the top of the Money Flow tab shows the open day and when it closes. Its " + k("Day Closing ›") + " link opens this tab.") },

        { id: "mfHowMonth", icon: HI.month, title: "Month close", body:
          p("The " + k("Month close") + " tab puts one month on one page, to close the month correctly. Pick the month at the top: in the first ten days of a month it opens on the month before.")
          + defs([
            [q("1 · Cash in, paid out, the drawer"), "The Day Closing days of the month added up: cash in, paid out, advances given, balance repaid in cash, and the net to the drawer. Zelle and card are under <b>Not cash</b>."],
            [q("2 · Foreman repayments, fines and advances"), "Each foreman’s fines, advances, short hand-ins, repayments and extras brought on jobs in the month, and what he owes today."],
            [q("3 · Job expenses and net cash corrections"), "Every job of the month with an expense (and what it was for), and every corrected net cash: what the contract says, what it was corrected to, and whether the contract is fixed yet."],
            [q("4 · Still open"), "What the month’s jobs still owe today, by foreman, and what the foremen’s balances add up to."],
          ])
          + list([
            "Jobs count in the month of their job date. Day Closing days and balance changes count in the month they happened.",
            "Click a customer or a foreman to open them in the Money Flow tab.",
            k(ICON.dl + "Download CSV") + " saves everything on the page as one spreadsheet. " + k("Refresh") + " reloads the figures.",
          ]) },

        { id: "mfHow10", icon: HI.msg, title: "What the messages mean", body:
          p("When something goes wrong the page says so in words. A message that ends with " + q("Nothing was saved") + " means nothing changed. When several jobs are saved together, all of them are saved or none is.")
          + '<div class="mf-hmsgs" role="table" aria-label="Messages">'
          + '<div class="mf-hmrow mf-hmhd" role="row"><span role="columnheader">You see</span><span role="columnheader">It means</span><span role="columnheader">What to do</span></div>'
          + [
            ['<span class="mf-live">● Live</span>', "The figures are up to date, to about a minute.", "Nothing."],
            ['<span class="mf-live mf-off">◷ Snapshot</span>', "The page can’t reach the live server, so it shows the last saved copy of the figures. Saving needs the server.", "Press <b>Refresh</b> next to it."],
            [q("Money Flow can’t reach the server right now … — press Refresh at the top of the page."), "The connection or the server had a problem.", "Press <b>Refresh</b>. If it stays, wait a minute and try again."],
            [q("Your portal sign-in has expired — sign in again, then open this job again.") + " or " + q("Your sign-in has expired."), "The portal signed you out.", "Sign in again, then do it again."],
            [q("This job is already confirmed (…)"), "Someone already confirmed this job.", "If it’s wrong, add a correction (part 7)."],
            [q("Someone changed this a moment ago."), "Someone else saved this job at the same time.", "Wait a moment and try again."],
            [q("No connection to the server — check the internet and try again."), "The internet dropped.", "Check the internet, then try again."],
            [q("The server did not answer (…)"), "The server had a problem.", "Wait a minute and try again."],
            [q("Money Flow update pending — …"), "The server isn’t ready for this yet, so only Cash can be saved.", "Use Cash, or tell Tornike."],
            [q("Your account isn’t allowed to record Money Flow."), "You can look, but not save.", "Ask Tornike for access."],
            [q("Say what is wrong with the net cash — the office fixes the contract from it."), "You picked " + q("The job’s net cash is wrong") + " without saying why.", "Type what is wrong in the box under it."],
            [q("Say what the expense was for — month close lists it by that."), "A job expense needs a reason.", "Type what it was for."],
            [q("Something went wrong on this page (…)"), "A fault in the page itself.", "Send Tornike a screenshot of the message."],
            [q("Day Closing unavailable — …"), "The drawer strip couldn’t load. Money Flow still works.", "Nothing: it tries again by itself every 20 seconds."],
          ].map(function (m) {
            return '<div class="mf-hmrow" role="row"><span class="mf-hmsg" role="cell">' + m[0] + '</span><span role="cell">' + m[1] + '</span><span role="cell">' + m[2] + "</span></div>";
          }).join("") + "</div>" },
      ];

      var nav = '<nav class="mf-hnav" aria-label="Contents"><span class="mf-hnavt">Contents</span><ol>'
        + SECS.map(function (s, i) {
            return '<li><button type="button" data-mfh="' + s.id + '"><span class="mf-hnum">' + (i + 1) + "</span>" + s.title + "</button></li>";
          }).join("") + "</ol></nav>";
      var hero = '<header class="mf-hhero" id="mfHowTop" tabindex="-1"><h2>How to use Money Flow</h2>'
        + "<p>This is where the base records the money that moves between the base and the foremen. Each part below explains one task, step by step. Use the contents to jump to what you need.</p>"
        + '<div class="mf-hquick"><h3>The usual job, in four steps</h3>'
        + steps([
            "Open the " + k("Waiting") + " tab and click the foreman’s name.",
            "On the job, press " + k("Settle", "acc") + " if he brings money, or " + k("Pay out", "out") + " if the base pays him.",
            "Check how the money came and the amount.",
            "Press " + k("Confirm", "pri") + ". The job moves to " + k("Settled") + ".",
          ]) + "</div></header>";
      var secs = SECS.map(function (s, i) {
        return '<section class="mf-hsec" id="' + s.id + '" tabindex="-1" aria-labelledby="' + s.id + 'h">'
          + '<div class="mf-hsech"><span class="mf-hico">' + s.icon + '</span><div><span class="mf-hkick">Part ' + (i + 1) + "</span>"
          + '<h3 id="' + s.id + 'h">' + s.title + "</h3></div></div>"
          + s.body
          + '<div><button type="button" class="mf-linkbtn" data-mfh="mfHowTop">Back to the top</button></div></section>';
      }).join("");
      return '<div class="mf-how">' + nav + '<div class="mf-hmain">' + hero + secs + "</div></div>";
    }

    // ---------- wiring: one delegated handler for the page, one for the panel ----------
    function onRootClick(e) {
      if (e.target.closest("#mfDrawer")) return;          // the panel has its own handler
      var a = e.target.closest("[data-mfa]"); if (!a) return;
      var act = a.getAttribute("data-mfa"), v = a.getAttribute("data-v");
      if (act === "tab") {
        S.view = v; paintTools(); paint();
        if (S.view === "balances" && !S.fines && !S.finesErr) loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
      } else if (act === "need") { S.need = S.need === v ? "" : v; S.view = "waiting"; paintTools(); paint(); }
      else if (act === "needclear") { S.need = ""; paint(); }
      else if (act === "grp") { S.fmx[v] = !S.fmx[v]; paint(); }
      else if (act === "older") { S.fmAll[v] = true; paint(); }
      else if (act === "allfm") { S.allFm = true; paint(); }
      else if (act === "sgrp") { S.sfx[v] = !S.sfx[v]; paint(); }
      else if (act === "solder") { S.sfAll[v] = true; paint(); }
      else if (act === "sallfm") { S.allSFm = true; paint(); }
      else if (act === "job") openJob(v, false);
      else if (act === "story") openJob(v, true);
      else if (act === "fm") openFm(v, false);
      else if (act === "retryfines") { S.finesErr = ""; S.fines = null; paint(); loadFines().then(paint); }
      else if (act === "bulkclear") { S.sel = {}; S.selFm = null; paint(); }
      else if (act === "bulkgo") bulkGo(a);
    }
    function onRootChange(e) {
      var t = e.target;
      if (t.closest && t.closest("#mfDrawer")) return;
      if (t.hasAttribute && t.hasAttribute("data-mfsel")) {
        var r = rowByEv(t.getAttribute("data-mfsel")); if (!r) return;
        var nx = pickSel(S.sel, S.selFm, r, t.checked);
        S.sel = nx.sel; S.selFm = nx.selFm; paint();
      } else if (t.hasAttribute && t.hasAttribute("data-mfselall")) {
        var f = t.getAttribute("data-mfselall");
        var mine = Object.keys(_visible).map(rowByEv).filter(function (x) { return x && x.forman === f; });
        if (t.checked) {
          if (S.selFm !== f) { S.sel = {}; S.selFm = null; }
          onePerJob(mine).forEach(function (x) { var nx2 = pickSel(S.sel, S.selFm, x, true); S.sel = nx2.sel; S.selFm = nx2.selFm; });
        } else { mine.forEach(function (x) { delete S.sel[x.ev]; }); }
        paint();
      }
    }
    function openJob(ev, story) {
      var r = rowByEv(ev); if (!r) return;
      openPanel({ kind: "job", ev: r.ev });
      if (story && P && P.st.mode !== "settled") { var s = $("mfStory"); if (s) { s.hidden = false; setTimeout(function () { try { s.scrollIntoView({ block: "start" }); } catch (x) { /* best effort */ } }, 120); } }
    }
    var root = $("mfRoot");
    root.onclick = onRootClick;
    root.onchange = onRootChange;
    root.onkeydown = function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("mf-srow")) { e.preventDefault(); e.target.click(); }
    };
    var drawer = $("mfDrawer");
    drawer.onclick = function (e) {
      var a = e.target.closest("[data-mfp]"); if (!a || !P) return;
      var k = a.getAttribute("data-mfp");
      if (k === "close") { closePanel(); return; }
      if (k === "back") { backPanel(); return; }
      var fn = P.h && P.h[k];
      if (fn) fn(a, e);
    };
    drawer.oninput = function (e) { if (P && P.onInput) P.onInput(e); };
    drawer.onchange = function (e) { if (P && P.onChange) P.onChange(e); };
    drawer.onkeydown = function (e) {
      if (e.key === "Enter" && e.target.id === "mfNewM" && P && P.h && P.h.addmgo) { e.preventDefault(); P.h.addmgo(); }
    };
    $("mfScrim").onclick = closePanel;
    window.__MF_CLOSE = function () { if (P) closePanel(); };
    if (!window.__MF_ESC) {
      window.__MF_ESC = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !document.querySelector(".rs-dlg-mask") && window.__MF_CLOSE) window.__MF_CLOSE();
      });
    }
    $("mfMethodsBtn").onclick = function () { openPanel({ kind: "methods" }); };
    $("mfExportBtn").onclick = exportCsv;
    $("mfRefresh").onclick = async function () {
      S.busy = true; paint();
      await loadLive(true);
      S.busy = false; setLiveBadge(); paint();
      loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
    };

    function setLiveBadge() {
      var last = $("mfLast");
      if (last) last.textContent = S.liveAt
        // the clock reading of when the page last fetched belongs to the reader
        ? ("Updated " + ((window.RS && RS.fmtTz)
            ? RS.fmtTz(S.liveAt) + " " + RS.tzShort()
            : new Date(S.liveAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })))
        : "";
      var el = $("mfLive"); if (!el) return;
      if (S.liveOk) { el.className = "mf-live"; el.textContent = "● Live"; el.title = "Figures are current to about a minute — digital contracts and portal entries included."; }
      else { el.className = "mf-live mf-off"; el.textContent = "◷ Snapshot"; el.title = "Live update unreachable (" + (S.liveErr || "?") + ") — showing the last pipeline build. Saving still needs the server."; }
    }

    // ---------- first paint: LAST, after every declaration above ----------
    // SKIP the live sync if we already synced within the last minute (switching pages fast
    // shouldn't re-hit the server each time); otherwise sync + repaint, guarding a stale open.
    if (S.live && S.live.entries) indexEntries();
    paintTools();
    if (S.live && S.liveAt && (Date.now() - S.liveAt < 60000)) {
      S.busy = false; setLiveBadge(); paint();
    } else {
      S.busy = true; paint();
      loadLive(false).then(function () { if (myGen === window.__MFGEN) { S.busy = false; setLiveBadge(); paintTools(); paint(); } });
    }
    // the ledger is small and every view shows his balance, so fetch it once per visit in the
    // background -- it must never hold up the cash tables, which are the point
    if (!S.fines && !S.finesErr) loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
  },
});

/* THE PAGE'S STYLESHEET. Every class is mf- (a bare .card/.panel would bleed into other pages).
   Colours are page tokens on .mf-root: the base values follow the portal's own tokens, so the dark
   theme still works; the "Calm finance" light theme (body.rs-app.light.v2) sets the canvas's exact
   greens, ambers and slates. */
function mfCss() {
  if (document.getElementById("mfCss2")) return;
  var st = document.createElement("style"); st.id = "mfCss2";
  st.textContent = `
    .mf-root{--mf-ink:var(--ink);--mf-ink2:var(--muted);--mf-muted:var(--muted);--mf-faint:var(--faint);--mf-line:var(--line);--mf-line2:var(--line-2);--mf-soft:var(--line);
      --mf-panel:var(--panel);--mf-panel2:var(--panel-2);--mf-chip:var(--panel-2);--mf-head:var(--ink);--mf-deep:var(--brand);--mf-deep-ink:var(--brand-ink);
      --mf-lime:var(--brand);--mf-acc:var(--brand);--mf-acc-ink:var(--brand);--mf-tint:var(--brand-glow);--mf-tint-line:var(--line-2);--mf-sub:var(--panel-2);
      --mf-in-bg:var(--pos-bg);--mf-in-ink:var(--pos);--mf-out-bg:var(--warn-bg);--mf-out-ink:var(--amber);--mf-out-line:var(--amber);
      --mf-out-tint:var(--warn-bg);--mf-out-tint-line:var(--line-2);--mf-warn-bg:var(--warn-bg);--mf-warn-line:var(--line-2);--mf-warn-ink:var(--warn);
      --mf-warn-btn:var(--warn);--mf-av-ink:var(--brand-ink);--mf-neg:var(--neg);--mf-neg-bg:var(--neg-bg);--mf-calm:var(--panel-2);--mf-scrim:rgba(8,12,20,.5);--mf-slate:#94A3B8;
      display:flex;flex-direction:column;gap:18px;color:var(--mf-ink);font-size:14px;line-height:1.45;font-variant-numeric:tabular-nums}
    body.rs-app.light.v2 .mf-root{--mf-ink:#0F172A;--mf-ink2:#334155;--mf-muted:#475569;--mf-faint:#64748B;--mf-line:#E2E8F0;--mf-line2:#CBD5E1;--mf-soft:#EEF2F6;
      --mf-panel:#FFFFFF;--mf-panel2:#F8FAFC;--mf-chip:#F1F5F9;--mf-head:#14301F;--mf-deep:#14301F;--mf-deep-ink:#FFFFFF;--mf-lime:#B7E23B;--mf-acc:#3F7D20;
      --mf-acc-ink:#2F6316;--mf-tint:#F4FAE6;--mf-tint-line:#DCEFB0;--mf-sub:#FBFDF7;--mf-in-bg:#E8F5C8;--mf-in-ink:#2F6316;--mf-out-bg:#FFEDD5;--mf-out-ink:#9A3412;
      --mf-out-line:#C2410C;--mf-out-tint:#FFF7ED;--mf-out-tint-line:#FED7AA;--mf-warn-bg:#FFFBEB;--mf-warn-line:#FDE68A;--mf-warn-ink:#92400E;--mf-warn-btn:#F59E0B;--mf-av-ink:#B7E23B;
      --mf-neg:#B91C1C;--mf-neg-bg:#FEF2F2;--mf-calm:#EFF6F1;--mf-scrim:rgba(15,23,42,.38)}
    .mf-root button,.mf-root input,.mf-root textarea,.mf-drawer button,.mf-drawer input,.mf-drawer textarea{font:inherit}
    .mf-root :focus-visible{outline:2px solid var(--mf-acc);outline-offset:2px}
    .mf-pane > #mfDayStrip{margin-bottom:0}
    .mf-bodywrap{display:flex;flex-direction:column;gap:22px;min-width:0}
    .mf-root > .mf-toptabs{margin:0}
    .mf-pane{min-width:0}
    .mf-pane.mf-pane-flow{display:flex;flex-direction:column;gap:18px}
    .mf-root > .mf-pane[hidden]{display:none}
    .mf-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 16px}
    .mf-titles{display:flex;flex-direction:column;gap:4px;min-width:0}
    .mf-titles h1{margin:0;font-size:26px;line-height:1.2;font-weight:600;color:var(--mf-head)}
    .mf-titles p{margin:0;color:var(--mf-muted);max-width:640px}
    .mf-livebar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:12.5px;color:var(--mf-faint)}
    .mf-live{display:inline-flex;align-items:center;gap:6px;font-weight:600;padding:2px 8px;border-radius:6px;background:var(--mf-in-bg);color:var(--mf-in-ink)}
    .mf-live.mf-off{background:var(--mf-warn-bg);color:var(--mf-warn-ink)}
    .mf-linkbtn{border:0;background:transparent;color:var(--mf-acc-ink);font-weight:500;cursor:pointer;padding:2px 4px;text-decoration:underline;text-underline-offset:3px;min-height:28px}
    .mf-linkbtn:hover{color:var(--mf-head)}
    .mf-topbtns{display:flex;flex-wrap:wrap;gap:8px}
    .mf-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:40px;padding:0 14px;border:1px solid var(--mf-line2);border-radius:10px;background:var(--mf-panel);color:var(--mf-ink);font-weight:500;cursor:pointer;white-space:nowrap}
    .mf-btn:hover:not([disabled]){background:var(--mf-panel2)}
    .mf-btn[disabled]{opacity:.55;cursor:default}
    .mf-btn.mf-sm{height:36px;padding:0 12px;border-radius:8px}
    .mf-btn.mf-acc{border-color:var(--mf-acc);color:var(--mf-acc-ink);font-weight:600}
    .mf-btn.mf-pri{background:var(--mf-deep);border-color:var(--mf-deep);color:var(--mf-deep-ink);font-weight:600;height:44px;padding:0 18px}
    .mf-btn.mf-pri:hover:not([disabled]){background:var(--mf-deep);filter:brightness(1.15)}
    .mf-btn.mf-ghost{border-color:transparent;background:transparent;color:var(--mf-muted)}
    .mf-push{margin-left:auto}
    .mf-tools{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    .mf-search{flex:1 1 300px;display:flex;align-items:center;gap:8px;background:var(--mf-panel);border:1px solid var(--mf-line);border-radius:10px;padding:0 12px;height:44px;color:var(--mf-faint);box-sizing:border-box}
    .mf-search:focus-within{border-color:var(--mf-acc)}
    .mf-search input{border:0;outline:0;flex:1;min-width:0;background:transparent;color:var(--mf-ink)}
    .mf-dens{display:inline-flex;padding:3px;background:var(--mf-chip);border-radius:10px;gap:2px}
    .mf-dens button{height:36px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--mf-muted);cursor:pointer}
    .mf-dens button[aria-pressed=true]{background:var(--mf-panel);color:var(--mf-head);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
    .mf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px}
    .mf-kpi{background:var(--mf-panel);border:1px solid var(--mf-line);border-top:3px solid var(--mf-lime);border-radius:14px;padding:16px 20px;display:flex;flex-direction:column;gap:4px}
    .mf-kpi.mf-kpi-out{border-top-color:var(--mf-warn-btn)} .mf-kpi.mf-kpi-look{border-top-color:var(--mf-slate)}
    .mf-kl{color:var(--mf-muted);font-weight:500}
    .mf-kv{font-size:30px;font-weight:600;letter-spacing:-.01em;color:var(--mf-head);line-height:1.2}
    .mf-kpi-out .mf-kv{color:var(--mf-out-ink)} .mf-kpi-look .mf-kv{color:var(--mf-ink)}
    .mf-ks{color:var(--mf-muted)}
    .mf-h2{margin:0;font-size:15px;font-weight:600;color:var(--mf-ink)}
    .mf-h3{margin:0;font-size:15px;font-weight:600;color:var(--mf-ink)}
    .mf-need{display:flex;flex-direction:column;gap:10px}
    .mf-needs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px}
    .mf-needc{background:var(--mf-warn-bg);border:1px solid var(--mf-warn-line);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
    .mf-needc.mf-on{box-shadow:0 0 0 2px var(--mf-warn-btn)}
    .mf-needt{display:flex;align-items:baseline;gap:8px}
    .mf-needn{font-size:20px;font-weight:600;color:var(--mf-warn-ink)}
    .mf-needc p{margin:0;color:var(--mf-muted)}
    .mf-needbtn{align-self:flex-start;min-height:36px;padding:0 12px;border:1px solid var(--mf-warn-btn);border-radius:8px;background:var(--mf-panel);color:var(--mf-warn-ink);font-weight:500;cursor:pointer}
    .mf-q{background:var(--mf-panel);border:1px solid var(--mf-line);border-radius:14px;overflow:hidden;position:relative}
    .mf-qhead{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px}
    .mf-qtitle{display:flex;flex-direction:column;gap:2px;min-width:0}
    .mf-qtitle h2{margin:0;font-size:17px;font-weight:600}
    .mf-qtitle p{margin:0;color:var(--mf-muted);max-width:640px}
    .mf-tabs{display:inline-flex;padding:3px;background:var(--mf-chip);border-radius:10px;gap:2px;flex-wrap:wrap}
    .mf-tabs button{height:36px;padding:0 14px;border:0;border-radius:8px;background:transparent;color:var(--mf-muted);font-weight:500;cursor:pointer}
    .mf-tabs button[aria-selected=true]{background:var(--mf-panel);color:var(--mf-head);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
    .mf-filt{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:8px 20px;border-top:1px solid var(--mf-line);background:var(--mf-warn-bg);color:var(--mf-warn-ink)}
    .mf-scroll{overflow-x:auto;container:mfscroll / inline-size}
    .mf-grid{min-width:1042px}
    .mf-ghd,.mf-grow{display:grid;grid-template-columns:44px minmax(180px,1fr) 130px 130px 150px 150px 28px;align-items:center;gap:12px;padding:8px 20px 8px 12px;border-top:1px solid var(--mf-line)}
    .mf-ghd{color:var(--mf-muted);font-size:12px;font-weight:500}
    .mf-grow{width:100%;padding:14px 20px 14px 12px;background:transparent;border-left:0;border-right:0;border-bottom:0;text-align:left;cursor:pointer;color:var(--mf-ink)}
    .mf-grow:hover{background:var(--mf-panel2)}
    .mf-grow.mf-open{background:var(--mf-tint)}
    .mf-av{width:34px;height:34px;margin-left:5px;border-radius:50%;background:var(--mf-in-bg);color:var(--mf-in-ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex:none}
    .mf-grow.mf-open .mf-av,.mf-av.mf-av-deep{background:var(--mf-deep);color:var(--mf-av-ink)}
    .mf-av.mf-av-sm{width:30px;height:30px;margin:0;font-size:11px}
    .mf-av.mf-av-lg{width:40px;height:40px;margin:0;font-size:14px}
    .mf-nm{display:flex;flex-direction:column;min-width:0}
    .mf-b{font-weight:600} .mf-b5{font-weight:500}
    .mf-mut{color:var(--mf-muted)} .mf-dim{color:var(--mf-faint)} .mf-sm2{font-size:13px}
    .mf-headc{color:var(--mf-head)} .mf-outc{color:var(--mf-out-ink)} .mf-incl{color:var(--mf-acc-ink)} .mf-pos{color:var(--mf-acc-ink)}
    .mf-old{color:var(--mf-warn-ink);font-weight:500}
    .mf-ell{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
    .mf-r{text-align:right} .mf-c{display:flex;justify-content:center}
    .mf-chev{display:flex;color:var(--mf-faint);transition:transform .15s}
    .mf-grow.mf-open .mf-chev{transform:rotate(90deg);color:var(--mf-head)}
    .mf-gsub{background:var(--mf-sub)}
    .mf-gline{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 20px 10px 68px;border-top:1px solid var(--mf-line);background:var(--mf-panel);color:var(--mf-ink2)}
    .mf-jhd,.mf-jrow{display:grid;grid-template-columns:44px 64px 104px minmax(150px,1fr) 96px 96px 140px 70px 180px 112px;align-items:center;gap:0 12px;padding:4px 20px 4px 12px;border-top:1px solid var(--mf-soft)}
    .mf-nowrap{white-space:nowrap}
    .mf-jlinks{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}
    .mf-jlink{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:4px;width:100%;height:30px;padding:0 6px;box-sizing:border-box;border:1px solid var(--mf-line2);border-radius:8px;background:var(--mf-panel);color:var(--mf-ink2);font-size:12.5px;font-weight:500;text-decoration:none;white-space:nowrap;overflow:hidden}
    .mf-jlink:hover{border-color:var(--mf-acc);color:var(--mf-acc-ink);background:var(--mf-tint)}
    .mf-jlink svg{flex:none}
    /* AT 1366 PX WITH THE SIDEBAR OPEN the table is ~1070 px wide: the two buttons STACK (Calendar
       over Contract) instead of sitting side by side, and a few columns give up a little, so every
       column still fits without a sideways scroll. They keep their WORDS at every width -- icons
       alone were not "easier for them to see" (his ask), and the people using this aren't
       icon-readers. */
    @container mfscroll (max-width:1199px){
      .mf-jhd,.mf-jrow{grid-template-columns:44px 64px 100px minmax(130px,1fr) 92px 90px 136px 64px 92px 104px}
      .mf-jlinks{grid-template-columns:1fr;gap:3px}
      .mf-jlinks>span:empty{display:none}
      .mf-jlink{height:23px;font-size:11.5px;padding:0 6px}
    }
    .mf-jhd{color:var(--mf-muted);font-size:12px;font-weight:500;border-top-color:var(--mf-line)}
    .mf-jrow{padding:0 20px 0 12px;min-height:54px}
    .mf-compact .mf-jrow{min-height:40px}
    .mf-compact .mf-grow{padding-top:9px;padding-bottom:9px}
    .mf-compact .mf-srow,.mf-compact .mf-brow{min-height:40px}
    .mf-ck{display:flex;align-items:center;justify-content:center;width:44px;height:44px;cursor:pointer}
    .mf-ck input{width:18px;height:18px;accent-color:var(--mf-acc);margin:0;cursor:pointer}
    .mf-code{font-family:"IBM Plex Mono",ui-monospace,Consolas,monospace;font-size:13px;color:var(--mf-ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mf-cust{justify-self:start;max-width:100%;color:var(--mf-ink);font-weight:500;text-decoration:underline;text-decoration-color:var(--mf-line2);text-underline-offset:3px;background:none;border:0;padding:0;cursor:pointer;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mf-cust:hover{text-decoration-color:var(--mf-acc)}
    .mf-custt{font-weight:500;text-decoration:underline;text-decoration-color:var(--mf-line2);text-underline-offset:3px}
    .mf-pill{justify-self:start;display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12.5px;font-weight:500;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
    .mf-pill.mf-p-in{background:var(--mf-in-bg);color:var(--mf-in-ink)}
    .mf-pill.mf-p-out{background:var(--mf-out-bg);color:var(--mf-out-ink)}
    .mf-pill.mf-p-warn{background:var(--mf-warn-bg);color:var(--mf-warn-ink);box-shadow:inset 0 0 0 1px var(--mf-warn-line)}
    .mf-pill.mf-p-mute{background:var(--mf-chip);color:var(--mf-ink2)}
    .mf-pill.mf-pill-sm{font-size:12px;padding:2px 8px;vertical-align:2px}
    .mf-act{justify-self:end;display:inline-flex;align-items:center;justify-content:center;min-width:96px;height:36px;padding:0 12px;border:1px solid var(--mf-acc);border-radius:8px;background:var(--mf-panel);color:var(--mf-acc-ink);font-weight:600;cursor:pointer}
    .mf-act:hover{background:var(--mf-tint)}
    .mf-act.mf-act-out{border-color:var(--mf-out-line);color:var(--mf-out-ink)}
    .mf-act.mf-act-out:hover{background:var(--mf-out-tint)}
    .mf-act.mf-act-mute{border-color:var(--mf-line2);color:var(--mf-ink)}
    .mf-act.mf-act-mute:hover{background:var(--mf-panel2)}
    .mf-more{display:flex;align-items:center;gap:8px;padding:10px 20px 14px 68px;border-top:1px solid var(--mf-soft)}
    .mf-morebtn{min-height:36px;padding:0 12px;border:0;border-radius:8px;background:transparent;color:var(--mf-acc-ink);font-weight:500;cursor:pointer;text-decoration:underline;text-underline-offset:3px}
    .mf-qfoot{padding:12px 20px;border-top:1px solid var(--mf-line)}
    .mf-empty{padding:22px 20px;border-top:1px solid var(--mf-line);color:var(--mf-muted);display:flex;flex-wrap:wrap;gap:10px;align-items:center}
    .mf-load{padding:40px;text-align:center;color:var(--mf-faint);display:flex;flex-direction:column;align-items:center;gap:12px}
    .mf-veil{position:absolute;inset:0;z-index:5;background:color-mix(in srgb,var(--mf-panel) 72%,transparent);display:flex;align-items:center;justify-content:center;gap:12px;font-weight:600;color:var(--mf-muted)}
    .mf-spin{width:22px;height:22px;border:3px solid var(--mf-line2);border-top-color:var(--mf-acc);border-radius:50%;animation:mfspin .8s linear infinite}
    @keyframes mfspin{to{transform:rotate(360deg)}}
    .mf-ghd.mf-g-set,.mf-grow.mf-g-set{grid-template-columns:44px minmax(180px,1fr) 150px 150px 190px 28px}
    .mf-shd,.mf-srow{display:grid;grid-template-columns:44px 92px 104px minmax(150px,1fr) 130px 96px 130px 110px;align-items:center;gap:0 12px;padding:4px 20px 4px 12px;border-top:1px solid var(--mf-soft)}
    .mf-shd{color:var(--mf-muted);font-size:12px;font-weight:500;border-top-color:var(--mf-line)}
    .mf-srow{padding:0 20px 0 12px;min-height:50px;cursor:pointer}
    .mf-srow:hover{background:var(--mf-panel2)}
    .mf-bgrid{min-width:860px}
    .mf-bhd,.mf-brow{display:grid;grid-template-columns:minmax(200px,1fr) 170px 170px 170px 150px;align-items:center;gap:0 12px;padding:10px 20px;border-top:1px solid var(--mf-line)}
    .mf-bhd{color:var(--mf-muted);font-size:12px;font-weight:500}
    .mf-brow{padding:0 20px;min-height:54px;border-top-color:var(--mf-soft)}
    .mf-brow.mf-btot{background:var(--mf-panel2);border-top-color:var(--mf-line)}
    .mf-rbtn{display:flex;justify-content:flex-end}
    .mf-bulk{position:sticky;bottom:16px;z-index:20;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px 20px;padding:14px 16px 14px 20px;background:#14301F;color:#F8FAFC;border-radius:14px;box-shadow:0 12px 32px rgba(20,48,31,.28)}
    .mf-bulk[hidden]{display:none}
    .mf-bulkt{display:flex;flex-direction:column;gap:2px;min-width:0}
    .mf-bulkt span:last-child{color:#C9D6CC}
    .mf-bulka{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .mf-bulkclr{height:44px;padding:0 14px;border:1px solid rgba(255,255,255,.3);border-radius:10px;background:transparent;color:#F8FAFC;cursor:pointer}
    .mf-bulkgo{height:44px;padding:0 18px;border:0;border-radius:10px;background:#B7E23B;color:#14301F;font-weight:600;cursor:pointer}
    .mf-bulkgo[disabled]{opacity:.7;cursor:default}
    .mf-scrim{position:fixed;inset:0;z-index:85;background:var(--mf-scrim);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s}
    .mf-scrim.mf-show{opacity:1;visibility:visible;pointer-events:auto}
    .mf-drawer{position:fixed;top:0;right:0;height:100vh;height:100dvh;width:min(520px,100vw);z-index:86;box-sizing:border-box;background:var(--mf-panel);border-left:1px solid var(--mf-line);box-shadow:-12px 0 40px rgba(15,23,42,.18);display:flex;flex-direction:column;transform:translateX(100%);visibility:hidden;transition:transform .24s cubic-bezier(.32,.72,0,1),visibility .24s;color:var(--mf-ink)}
    .mf-drawer.mf-show{transform:none;visibility:visible}
    .mf-drawer.mf-w-fm{width:min(760px,100vw)} .mf-drawer.mf-w-meth{width:min(640px,100vw)}
    @media (prefers-reduced-motion:reduce){.mf-drawer,.mf-scrim{transition:none}}
    .mf-dh{display:flex;align-items:center;gap:8px;padding:16px 16px 14px 24px;border-bottom:1px solid var(--mf-line)}
    .mf-dtitle{flex:1;min-width:0}
    .mf-dtitle h2{margin:0;font-size:18px;font-weight:600;color:var(--mf-head)}
    .mf-x{display:flex;align-items:center;justify-content:center;width:44px;height:44px;border-radius:10px;border:0;background:transparent;color:var(--mf-muted);cursor:pointer;flex:none}
    .mf-x:hover{background:var(--mf-panel2);color:var(--mf-ink)}
    .mf-db{flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:22px;position:relative}
    .mf-db > *{flex-shrink:0}
    .mf-df{display:flex;flex-direction:column;gap:10px;padding:14px 24px 18px;border-top:1px solid var(--mf-line)}
    .mf-dfrow{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:10px}
    .mf-dveil{position:absolute;inset:0;z-index:5;background:color-mix(in srgb,var(--mf-panel) 70%,transparent);display:flex;align-items:center;justify-content:center;gap:12px;font-weight:600;color:var(--mf-muted)}
    .mf-jc{display:flex;flex-direction:column;gap:12px;padding:16px 18px;border-radius:14px;background:var(--mf-tint);border:1px solid var(--mf-tint-line)}
    .mf-jc.mf-jc-out{background:var(--mf-out-tint);border-color:var(--mf-out-tint-line)}
    .mf-jctop{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .mf-jcid{display:flex;flex-direction:column;min-width:0}
    .mf-jccust{font-weight:600;font-size:16px}
    .mf-jcwho{display:flex;align-items:center;gap:10px}
    .mf-jcamt{margin-left:auto;font-size:24px;font-weight:600}
    .mf-jcbal{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-top:10px;border-top:1px solid var(--mf-tint-line)}
    .mf-jc-out .mf-jcbal{border-top-color:var(--mf-out-tint-line)}
    .mf-jcnote{font-size:13px;color:var(--mf-muted)}
    .mf-jclinks{font-size:13px}
    .mf-alink{color:var(--mf-acc-ink);font-weight:500;text-decoration:none}
    .mf-alink:hover{text-decoration:underline}
    .mf-why{font-size:13.5px;line-height:1.5;color:var(--mf-ink);background:var(--mf-warn-bg);border:1px solid var(--mf-warn-line);border-radius:12px;padding:10px 14px}
    .mf-fs{border:0;margin:0;padding:0;display:flex;flex-direction:column;gap:8px;min-width:0}
    .mf-lg{padding:0;margin-bottom:4px;font-weight:600}
    .mf-lg2{font-weight:500}
    .mf-mcard{display:flex;align-items:center;gap:12px;min-height:56px;padding:9px 15px;border:1px solid var(--mf-line);border-radius:12px;background:var(--mf-panel);cursor:pointer;box-sizing:border-box}
    .mf-mcard.mf-on{border:2px solid var(--mf-acc);padding:8px 14px;background:var(--mf-tint)}
    .mf-mcard input{width:18px;height:18px;margin:0;accent-color:var(--mf-acc);flex:none}
    .mf-mcard.mf-off{opacity:.55;cursor:default}
    .mf-way[disabled]{opacity:.5;cursor:default}
    .mf-mcol{display:flex;flex-direction:column;min-width:0}
    .mf-grow1{flex:1} .mf-end{align-items:flex-end;text-align:right}
    .mf-tag{display:inline-block;padding:1px 8px;border-radius:999px;background:var(--mf-chip);color:var(--mf-muted);font-size:12px;font-weight:500;white-space:nowrap}
    .mf-tag.mf-tag-new{background:var(--mf-in-bg);color:var(--mf-in-ink)}
    .mf-mcard .mf-tag{margin-left:auto}
    .mf-addbtn{display:flex;align-items:center;gap:10px;min-height:48px;padding:0 14px;border:1px dashed var(--mf-line2);border-radius:12px;background:var(--mf-panel);color:var(--mf-acc-ink);font-weight:500;cursor:pointer;text-align:left}
    .mf-addm{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--mf-line2);border-radius:12px;background:var(--mf-panel2)}
    .mf-addrow{display:flex;gap:8px}
    .mf-addrow .mf-in{flex:1;min-width:0}
    .mf-in{height:44px;padding:0 12px;border:1px solid var(--mf-line2);border-radius:10px;color:var(--mf-ink);background:var(--mf-panel);box-sizing:border-box;width:100%}
    .mf-in:focus,.mf-ta:focus{outline:0;border-color:var(--mf-acc);box-shadow:0 0 0 3px var(--mf-tint)}
    .mf-ta{padding:10px 12px;border:1px solid var(--mf-line2);border-radius:10px;color:var(--mf-ink);background:var(--mf-panel);resize:vertical;box-sizing:border-box;width:100%}
    .mf-fld{display:flex;flex-direction:column;gap:6px;min-width:0}
    .mf-fldh{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
    .mf-amt{display:flex;align-items:center;height:52px;border:1px solid var(--mf-line2);border-radius:12px;padding:0 14px;gap:6px;background:var(--mf-panel);box-sizing:border-box}
    .mf-amt:focus-within{border-color:var(--mf-acc);box-shadow:0 0 0 3px var(--mf-tint)}
    .mf-amt .mf-mut{font-size:18px}
    .mf-amt input{border:0;outline:0;flex:1;min-width:0;font-size:20px;font-weight:600;color:var(--mf-ink);background:transparent}
    .mf-amt input:focus-visible,.mf-search input:focus-visible{outline:0}
    .mf-amt.mf-amt-sm{height:44px;border-radius:10px;padding:0 12px}
    .mf-amt.mf-amt-sm input{font-size:15px}
    .mf-amt.mf-amt-sm .mf-mut{font-size:14px}
    .mf-eff{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px}
    .mf-eff.mf-eff-ok{background:var(--mf-tint);color:var(--mf-acc-ink)}
    .mf-eff.mf-eff-short{background:var(--mf-out-tint);color:var(--mf-out-ink)}
    .mf-eff.mf-eff-extra{background:var(--mf-calm);color:var(--mf-head)}
    .mf-eff.mf-eff-info{background:var(--mf-chip);color:var(--mf-ink2)}
    .mf-eff.mf-eff-fix{background:var(--mf-warn-bg);color:var(--mf-warn-ink);border:1px solid var(--mf-warn-line)}
    .mf-fixch{margin-top:10px}
    .mf-jcfix{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 8px;color:var(--mf-warn-ink)}
    .mf-inl{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border:1px solid var(--mf-line2);border-radius:12px;background:var(--mf-panel2)}
    .mf-exps{display:flex;flex-direction:column;gap:8px}
    .mf-exprow{display:grid;grid-template-columns:140px minmax(0,1fr);gap:8px}
    .mf-expbtns{display:flex;gap:2px;flex:none}
    .mf-exps .mf-conf .mf-tlwhat{flex:1}
    .mf-pane.mf-pane-month{min-width:0}
    .mf-mc{display:flex;flex-direction:column;gap:18px}
    .mf-mchead{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px 16px}
    .mf-mchead h2{margin:0;font-size:20px;font-weight:600;color:var(--mf-head)}
    .mf-mcsel{display:flex;align-items:center;gap:8px}
    .mf-mcsel select{height:40px;width:auto;min-width:170px}
    .mf-mcn{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-right:10px;border-radius:50%;background:var(--mf-deep);color:var(--mf-deep-ink);font-size:13px;font-weight:600;vertical-align:1px}
    .mf-mcbody{display:flex;flex-direction:column;gap:10px;padding-bottom:4px}
    .mf-mcsub{padding:10px 20px 0;display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .mf-mcnote{margin:0;padding:10px 20px 16px;color:var(--mf-muted);font-size:13px}
    .mf-mct{width:100%;min-width:720px;border-collapse:collapse;font-size:13.5px}
    .mf-mct th{padding:9px 12px;text-align:left;color:var(--mf-muted);font-size:12px;font-weight:500;border-top:1px solid var(--mf-line);white-space:nowrap}
    .mf-mct td{padding:9px 12px;border-top:1px solid var(--mf-soft);vertical-align:middle}
    .mf-mct th:first-child,.mf-mct td:first-child{padding-left:20px}
    .mf-mct th:last-child,.mf-mct td:last-child{padding-right:20px}
    .mf-mct .mf-r{text-align:right;white-space:nowrap}
    .mf-mct tfoot td{background:var(--mf-panel2);border-top:1px solid var(--mf-line)}
    .mf-mct .mf-linkbtn{padding:0;min-height:0;text-align:left}
    .mf-dcl{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px 16px;padding:10px 14px;border:1px solid var(--mf-line);border-radius:12px}
    .mf-err{color:var(--mf-neg);font-weight:600;font-size:13px;min-height:0}
    .mf-err:empty{display:none}
    .mf-errbox{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px 14px;border-radius:12px;background:var(--mf-neg-bg);color:var(--mf-neg);font-weight:500;border:1px solid color-mix(in srgb,var(--mf-neg) 25%,transparent)}
    .mf-ways{display:flex;flex-wrap:wrap;gap:8px}
    .mf-way{min-height:44px;padding:0 16px;border:1px solid var(--mf-line2);border-radius:999px;background:var(--mf-panel);color:var(--mf-ink);font-weight:500;cursor:pointer}
    .mf-way[aria-checked=true]{background:var(--mf-deep);border-color:var(--mf-deep);color:var(--mf-deep-ink);font-weight:600}
    .mf-way.mf-way-sm{min-height:40px;padding:0 14px}
    .mf-info{display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:var(--mf-chip);color:var(--mf-ink2)}
    .mf-ico{flex:none;margin-top:2px}
    .mf-story{display:flex;flex-direction:column;gap:18px;padding-top:6px;border-top:1px solid var(--mf-line)}
    .mf-story[hidden]{display:none}
    .mf-st3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .mf-st3c{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--mf-line);border-radius:12px;min-width:0}
    .mf-st3c b{font-size:20px;font-weight:600}
    .mf-stlegs{display:flex;flex-direction:column;gap:8px}
    .mf-stlegs p{margin:0}
    .mf-chips{display:flex;flex-wrap:wrap;gap:8px}
    .mf-chip{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border:1px solid var(--mf-line);border-radius:999px;background:var(--mf-panel2)}
    .mf-chipdot{width:8px;height:8px;border-radius:50%;background:var(--mf-acc)}
    .mf-chipdot.mf-chipdot-2{background:var(--mf-slate)}
    .mf-tlwrap{display:flex;flex-direction:column}
    .mf-tlwrap > .mf-h3{margin-bottom:14px}
    .mf-tl{display:grid;grid-template-columns:28px minmax(0,1fr);gap:0 14px}
    .mf-tlrail{display:flex;flex-direction:column;align-items:center}
    .mf-tldot{width:14px;height:14px;border-radius:50%;margin-top:3px;box-sizing:border-box;flex:none}
    .mf-tld-fill{background:var(--mf-acc)}
    .mf-tld-ring{border:3px solid var(--mf-slate);background:var(--mf-panel)}
    .mf-tld-dash{border:2px dashed var(--mf-slate);background:var(--mf-panel)}
    .mf-tld-end{background:var(--mf-deep)}
    .mf-tlline{flex:1;width:2px;background:var(--mf-line)}
    .mf-tlbody{display:flex;flex-direction:column;gap:6px;padding-bottom:20px;min-width:0}
    .mf-tlwhen{color:var(--mf-muted);font-size:13px}
    .mf-tlbox{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--mf-tint-line);border-radius:12px;background:var(--mf-tint)}
    .mf-tlbox.mf-tlbox-out{border-color:var(--mf-out-tint-line);background:var(--mf-out-tint)}
    .mf-tlbox.mf-tlbox-rep{border:1px dashed var(--mf-line2);background:var(--mf-panel2)}
    .mf-tlwhat{display:flex;flex-direction:column;min-width:0}
    .mf-tlamt{font-size:18px;font-weight:600;white-space:nowrap}
    .mf-tlbox-rep .mf-tlamt{font-size:16px;font-weight:500;color:var(--mf-faint);text-decoration:line-through}
    .mf-tlbox-out .mf-tlamt{color:var(--mf-out-ink)}
    .mf-tllink{font-size:13px;color:var(--mf-ink2);padding:2px 2px 0;line-height:1.6}
    .mf-confs{display:flex;flex-direction:column;gap:8px}
    .mf-conf{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border:1px solid var(--mf-line);border-radius:12px}
    .mf-setbox{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px;border-radius:12px;background:var(--mf-chip)}
    .mf-setbox .mf-tlwhat{max-width:430px}
    .mf-corr{display:flex;flex-direction:column;gap:14px;padding:16px;border:1px solid var(--mf-line2);border-radius:12px}
    .mf-corr p{margin:0}
    .mf-fmhead{display:flex;align-items:center;gap:12px}
    .mf-fmhead h2{font-size:20px}
    .mf-fk{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .mf-fkc{display:flex;flex-direction:column;gap:4px;padding:16px 18px;border:1px solid var(--mf-line);border-top:3px solid var(--mf-lime);border-radius:14px;min-width:0}
    .mf-fkc.mf-fkc-2{border-top-color:var(--mf-slate)}
    .mf-fkv{font-size:30px;font-weight:600;line-height:1.2}
    .mf-parts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border:1px solid var(--mf-line);border-radius:12px;overflow:hidden}
    .mf-part{display:flex;flex-direction:column;gap:2px;padding:12px 16px;border-right:1px solid var(--mf-soft);border-bottom:1px solid var(--mf-soft)}
    .mf-part .mf-b{font-size:16px}
    .mf-sect{display:flex;flex-direction:column;gap:10px}
    .mf-secth{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
    .mf-kbtn{min-height:44px;padding:0 16px;border:1px solid var(--mf-line2);border-radius:10px;background:var(--mf-panel);color:var(--mf-ink);font-weight:500;cursor:pointer}
    .mf-kbtn[aria-pressed=true]{background:var(--mf-deep);border-color:var(--mf-deep);color:var(--mf-deep-ink);font-weight:600}
    .mf-form{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px solid var(--mf-line2);border-radius:12px;background:var(--mf-panel2)}
    .mf-frow{display:grid;grid-template-columns:160px minmax(0,1fr);gap:12px}
    .mf-frow2{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px}
    .mf-payby{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .mf-ledger{display:flex;flex-direction:column;border:1px solid var(--mf-line);border-radius:12px;overflow:hidden}
    .mf-lhd,.mf-lrow{display:grid;grid-template-columns:70px minmax(0,1fr) 100px 110px 92px;gap:12px;padding:8px 16px}
    .mf-lhd{background:var(--mf-panel2);color:var(--mf-muted);font-size:12px;font-weight:500}
    .mf-lrow{align-items:start;padding:12px 16px;border-top:1px solid var(--mf-soft)}
    .mf-lwhat{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
    .mf-mt{display:flex;flex-direction:column;border:1px solid var(--mf-line);border-radius:12px;overflow:hidden}
    .mf-mthd,.mf-mtrow{display:grid;grid-template-columns:minmax(0,1fr) 96px 96px 90px;align-items:center;gap:12px;padding:8px 16px}
    .mf-mthd{background:var(--mf-panel2);color:var(--mf-muted);font-size:12px;font-weight:500}
    .mf-mthd .mf-c{display:block;text-align:center}
    .mf-mtrow{padding:10px 16px;min-height:60px;border-top:1px solid var(--mf-soft);box-sizing:border-box}
    .mf-mtrow.mf-mtcash{background:var(--mf-tint)}
    .mf-sw{width:44px;height:26px;border:0;border-radius:999px;background:var(--mf-line2);position:relative;cursor:pointer;padding:0;flex:none}
    .mf-sw::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#FFFFFF;transition:left .15s}
    .mf-sw[aria-checked=true]{background:var(--mf-acc)}
    .mf-sw[aria-checked=true]::after{left:21px}
    .mf-sw[disabled]{opacity:.5;cursor:default}
    .mf-addsec{display:flex;flex-direction:column;gap:12px;padding:16px;border:1px dashed var(--mf-line2);border-radius:12px}
    .mf-addopts{display:flex;flex-wrap:wrap;align-items:center;gap:18px}
    .mf-chk{display:flex;align-items:center;gap:8px;min-height:44px;cursor:pointer}
    .mf-chk input{width:18px;height:18px;margin:0;accent-color:var(--mf-acc)}
    .mf-offsec{display:flex;flex-direction:column;gap:10px}
    .mf-offsec p{margin:0}
    .mf-caps{font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--mf-muted)}
    .mf-offrow{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px;border:1px solid var(--mf-line);border-radius:12px;background:var(--mf-panel2)}
    .mf-footnote{display:flex;align-items:center;gap:10px;color:var(--mf-muted)}
    /* ---- How to use (2026-10-08): contents on the left (sticky on a wide screen), one card per part ---- */
    .mf-how{display:grid;grid-template-columns:minmax(0,1fr);gap:20px;max-width:1160px}
    .mf-hnav{background:var(--mf-panel);border:1px solid var(--mf-line);border-radius:14px;padding:14px 10px 10px}
    .mf-hnavt{display:block;padding:0 10px 8px;font-size:13px;font-weight:600;color:var(--mf-muted)}
    .mf-hnav ol{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:2px}
    .mf-hnav button{display:flex;align-items:center;gap:10px;width:100%;min-height:38px;padding:4px 10px;border:0;border-radius:8px;background:transparent;color:var(--mf-ink);text-align:left;cursor:pointer;font-weight:500}
    .mf-hnav button:hover{background:var(--mf-tint);color:var(--mf-head)}
    .mf-hnum{flex:none;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--mf-chip);color:var(--mf-ink2);font-size:12px;font-weight:600}
    .mf-hmain{display:flex;flex-direction:column;gap:16px;min-width:0;max-width:880px}
    .mf-hhero,.mf-hsec{background:var(--mf-panel);border:1px solid var(--mf-line);border-radius:14px;padding:20px 24px;display:flex;flex-direction:column;gap:12px;scroll-margin-top:12px}
    .mf-hhero{border-top:3px solid var(--mf-lime)}
    .mf-hhero:focus,.mf-hsec:focus{outline:0}
    .mf-hhero h2{margin:0;font-size:22px;line-height:1.25;font-weight:600;color:var(--mf-head)}
    .mf-hhero > p{margin:0;color:var(--mf-ink2);font-size:15px;line-height:1.6;max-width:68ch}
    .mf-hquick{display:flex;flex-direction:column;gap:10px;background:var(--mf-tint);border:1px solid var(--mf-tint-line);border-radius:12px;padding:14px 18px}
    .mf-hquick h3{margin:0;font-size:15px;font-weight:600;color:var(--mf-head)}
    .mf-hsech{display:flex;align-items:center;gap:12px}
    .mf-hico{flex:none;display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:12px;background:var(--mf-in-bg);color:var(--mf-in-ink)}
    .mf-hsech h3{margin:0;font-size:18px;line-height:1.3;font-weight:600;color:var(--mf-head)}
    .mf-hkick{display:block;font-size:12.5px;font-weight:600;color:var(--mf-muted)}
    .mf-hp{margin:0;color:var(--mf-ink2);font-size:14.5px;line-height:1.6;max-width:72ch}
    .mf-hh4{margin:6px 0 0;font-size:14.5px;font-weight:600;color:var(--mf-ink)}
    .mf-hsteps{list-style:none;counter-reset:mfstep;margin:0;padding:0;display:flex;flex-direction:column;gap:9px}
    .mf-hsteps > li{counter-increment:mfstep;position:relative;padding-left:38px;min-height:26px;font-size:14.5px;line-height:1.65;color:var(--mf-ink)}
    .mf-hsteps > li::before{content:counter(mfstep);position:absolute;left:0;top:0;width:26px;height:26px;border-radius:50%;background:var(--mf-deep);color:var(--mf-deep-ink);font-size:13px;font-weight:600;display:flex;align-items:center;justify-content:center}
    .mf-hlist{margin:0;padding-left:22px;display:flex;flex-direction:column;gap:6px;font-size:14.5px;line-height:1.65;color:var(--mf-ink)}
    .mf-hdefs{display:grid;grid-template-columns:minmax(150px,max-content) minmax(0,1fr);gap:10px 18px;align-items:baseline;margin:0;font-size:14.5px;line-height:1.6}
    .mf-hdefs dt{margin:0}
    .mf-hdefs dd{margin:0;color:var(--mf-ink2)}
    .mf-htip{display:flex;gap:10px;padding:12px 14px;border-radius:12px;background:var(--mf-chip);color:var(--mf-ink2);font-size:14px;line-height:1.6}
    .mf-htip.mf-htip-warn{background:var(--mf-warn-bg);color:var(--mf-warn-ink);box-shadow:inset 0 0 0 1px var(--mf-warn-line)}
    .mf-hk{display:inline-flex;align-items:center;gap:5px;padding:1px 8px;border:1px solid var(--mf-line2);border-radius:7px;background:var(--mf-panel);color:var(--mf-ink);font-size:13px;font-weight:600;line-height:1.5;white-space:nowrap;vertical-align:1px}
    .mf-hk.mf-hk-acc{border-color:var(--mf-acc);color:var(--mf-acc-ink)}
    .mf-hk.mf-hk-out{border-color:var(--mf-out-line);color:var(--mf-out-ink)}
    .mf-hk.mf-hk-pri{background:var(--mf-deep);border-color:var(--mf-deep);color:var(--mf-deep-ink)}
    .mf-hq{font-weight:600;color:var(--mf-ink)}
    .mf-htip .mf-hq{color:inherit}
    .mf-hmsgs{display:flex;flex-direction:column;border:1px solid var(--mf-line);border-radius:12px;overflow:hidden;font-size:14px;line-height:1.55}
    .mf-hmrow{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.85fr);gap:14px;padding:12px 16px;border-top:1px solid var(--mf-soft);color:var(--mf-ink2)}
    .mf-hmrow.mf-hmhd{border-top:0;background:var(--mf-panel2);color:var(--mf-muted);font-size:12.5px;font-weight:600;padding-top:9px;padding-bottom:9px}
    .mf-hmsg{color:var(--mf-ink)}
    .mf-hmsg .mf-live{font-size:12.5px}
    .mf-pane.mf-pane-how{container:mfhow / inline-size}
    @container mfhow (min-width:980px){
      .mf-how{grid-template-columns:236px minmax(0,1fr);gap:28px;align-items:start}
      .mf-hnav{position:sticky;top:0}
      .mf-hnav ol{grid-template-columns:minmax(0,1fr)}
    }
    @container mfhow (max-width:700px){
      .mf-hhero,.mf-hsec{padding:16px}
      .mf-hdefs{grid-template-columns:minmax(0,1fr);gap:2px}
      .mf-hdefs dd{margin-bottom:8px}
      .mf-hmrow{grid-template-columns:minmax(0,1fr);gap:4px}
      .mf-hmrow.mf-hmhd{display:none}
    }
    @media (max-width:640px){
      .mf-db{padding:16px}
      .mf-dh{padding:12px 8px 12px 16px}
      .mf-df{padding:12px 16px 14px}
      .mf-st3,.mf-fk{grid-template-columns:1fr}
      .mf-exprow{grid-template-columns:1fr}
      .mf-mcsel select{min-width:0}
      .mf-parts{grid-template-columns:repeat(2,minmax(0,1fr))}
      .mf-frow{grid-template-columns:1fr}
      .mf-lhd,.mf-lrow{grid-template-columns:62px minmax(0,1fr) 86px;}
      .mf-lhd > span:nth-child(4),.mf-lrow > span:nth-child(4){display:none}
      .mf-lhd > span:nth-child(5){display:none}
      .mf-lrow > span:nth-child(5){grid-column:2 / span 2;text-align:left}
      .mf-mthd,.mf-mtrow{grid-template-columns:minmax(0,1fr) 64px 64px;}
      .mf-mthd > span:nth-child(4),.mf-mtrow > span:nth-child(4){grid-column:1 / -1;text-align:left}
      .mf-kv{font-size:26px}
    }`;
  document.head.appendChild(st);
}
