/* MONEY FLOW — who owes whom between the base and the foremen (LOGISTICS group).

   REBUILT TO THE APPROVED CANVAS (Tornike 2026-10-07; contract: the "Money Flow — final build"
   spec). One queue, three tabs, and every action in a panel on the right:
     * Waiting      — the open jobs grouped by foreman: what he holds for the base, what the base
                      owes him, his own balance, his oldest job. Tick several to-the-base jobs of
                      ONE foreman and confirm them as cash, in full, in one go.
     * Settled      — every confirmation, newest first, with how the money came in.
     * Foreman balances — his balance (fines, advances, short and extra hand-ins, repayments)
                      next to what his open jobs owe.
   Panels: Settle (a to-the-base job: Cash, Zelle or another method; short goes on his balance,
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
             "Net Cash (Closing)", "Expected Net Cash", "Contract URL", "DC Submission Time",
             "Cash Flow", "Cash Flow Time", "Cash Flow Source", "Cash Flow Method",
             "Cash Flow Records", "Advance", "Deduction", "Moved to Debt", "Balance", "Status"],
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
      sel: {}, selFm: null,
      dateFrom: null, dateTo: null, hpage: 0, compact: false,
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
    if (!S.sel || typeof S.sel !== "object") S.sel = {};
    if (S.hpage == null) S.hpage = 0;
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
    };

    host.innerHTML = '<div class="mf-root' + (S.compact ? " mf-compact" : "") + '" id="mfRoot">'
      + '<div class="mf-top"><div class="mf-titles"><h1>Money Flow</h1>'
      + "<p>Who owes whom between the base and the foremen, job by job and on each foreman’s balance.</p>"
      + '<div class="mf-livebar"><span class="mf-live mf-off" id="mfLive">Syncing…</span><span id="mfLast"></span>'
      + '<button type="button" class="mf-linkbtn" id="mfRefresh">Refresh</button></div></div>'
      + '<div class="mf-topbtns"><button type="button" class="mf-btn" id="mfMethodsBtn">' + ICON.card + "Payment methods</button>"
      + '<button type="button" class="mf-btn" id="mfExportBtn">' + ICON.dl + "Export</button></div></div>"
      + '<div id="mfDayStrip"></div>'
      + '<div class="mf-tools" id="mfTools"></div>'
      + '<div id="mfBody" class="mf-bodywrap"><div class="mf-load"><div class="mf-spin"></div>Loading jobs…</div></div>'
      + '<div class="mf-bulk" id="mfBulk" role="region" aria-label="Selected jobs" hidden></div>'
      + '<div class="mf-scrim" id="mfScrim"></div>'
      + '<aside class="mf-drawer" id="mfDrawer" role="dialog" aria-modal="true" aria-labelledby="mfDTitle" aria-hidden="true"></aside>'
      + "</div>";
    // DAY CLOSING strip (2026-09-27): the open day's drawer, shared with the Day Closing page
    // (pages/day-closing.js, window.ZDC). It refreshes itself every 20 s.
    if (window.ZDC) ZDC.mountStrip(document.getElementById("mfDayStrip"));

    // generation token: each page-open bumps it; a stale render's async callbacks compare
    // against it and skip painting once a newer open has taken over (see paint()).
    var myGen = (window.__MFGEN = (window.__MFGEN || 0) + 1);

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
    var todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    /* ======================== MF LOGIC (pure) ========================
       No DOM, no fetch, no page state: every function below takes what it needs as arguments
       (plus the three constants MF_TOL / MF_DEBT / MF_EXTRA). Node tests cut this block out
       between the two banner lines and run it against fixtures — the settle preset, the
       short/extra effect, the pay-out allocation, the bulk rule and the batch bodies. */
    var BROUGHT = "Cash Brought to Base", TAKEN = "Cash Taken Away from Base";
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
      var out = [], dOld = r.debt || 0;
      if (Math.abs(dNew - dOld) > 0.009) {
        if (dNew > 0.009 || dOld > 0.009)
          out.push(assign({ entry_type: MF_DEBT, amount: r2(Math.max(0, dNew)),
                            note: dNew > 0.009 ? notes.short : "brought in full" }, jobFields(r)));
        if (dNew < -0.009 || dOld < -0.009)
          out.push(assign({ entry_type: MF_EXTRA, amount: r2(Math.max(0, -dNew)),
                            note: dNew < -0.009 ? notes.extra : "no extra" }, jobFields(r)));
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
      if (r.expected != null) {
        items = items.concat(debtItems(r, debtOfEntry(r, o.type, o.amt).debt, {
          short: "short hand-in" + (note ? " — " + note : ""),
          extra: "extra hand-in repays his balance" + (note ? " — " + note : "") }));
      }
      return items;
    }
    // what the Settle panel says will happen; balNow = his foreman balance right now
    function settleEffect(r, type, amt, balNow) {
      if (r.expected == null) return { kind: "info", title: "No contract yet",
        line: "Nothing to compare with: the job’s balance is worked out when the contract comes in." };
      if (amt == null) return { kind: "info", title: "Enter the amount", line: "" };
      var d = debtOfEntry(r, type, amt), dOld = r.debt || 0, after = r2(balNow - dOld + d.debt);
      var balLine = Math.abs(after - balNow) > 0.005
        ? "His balance: " + owesText(balNow) + " → " + owesText(after) + "."
        : "His balance stays at " + owesText(balNow) + ".";
      if (d.debt > 0.005) return { kind: "short", title: money2(d.debt) + " short — goes on his balance",
        line: "The job is settled. " + balLine, after: after };
      if (d.debt < -0.005) return { kind: "extra", title: money2(-d.debt) + " extra — comes off his balance",
        line: "The job is settled. " + balLine, after: after };
      if (Math.abs(d.balance) <= MF_TOL) return { kind: "ok", title: "Settles the job in full", line: balLine, after: after };
      // only a pay-out can land here: taken away, and not the amount the job asks for
      return { kind: "short", title: "The job stays " + money2(Math.abs(d.balance)) + " off",
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
      _ov = base.map(function (b) {
        var ev = b["Event ID"], lv = liveByEv[ev];
        var r = {
          ev: ev, date: String(b["Job Date"]).slice(0, 10), title: b["Event Title"],
          jobNo: b["Job No"], jobCode: b["Job Code"], customer: b["Customer"],
          forman: b["Forman"] || MF_NO_FOREMAN, formanEmail: b["Forman Email"],
          jobType: b["Job Type"], ct: b["Contract Type"], company: b["Company"] || "",
          expected: num(lv && lv.expected != null ? lv.expected : b["Expected Net Cash"]),
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
          baseAdv: num(b["Advance"]),
          contractUrl: b["Contract URL"] || null,
          dcTs: b["DC Submission Time"] || null,
          calendarId: b["Calendar ID"] || null,
          baseStatus: b["Status"],
          // the live overlay's word that this is a second leg whose only cash repeats the money
          // leg's (src/money_flow.py _ECHO_LEG): it expects nothing
          echoLeg: !!(lv && lv.sib),
        };
        if (r.echoLeg) r.expected = null;
        else if (r.expected == null && r.closingNC != null) r.expected = r.closingNC;
        // DEPLOY-SKEW GUARD: an older bridge serves "taken away" advances UNSIGNED (+A) while the
        // nightly fact knows the true −A. When the two differ ONLY by sign, trust the negative.
        if (lv && r.adv != null && r.baseAdv != null && r.adv > 0 && r.baseAdv < 0
            && Math.abs(r.adv + r.baseAdv) < 0.01) r.adv = r.baseAdv;
        // Balance = Expected − Advance − Flow + Deduction − Debt — the original system's formula
        r.balance = (r.expected == null) ? null
          : r.expected - (r.adv || 0) - (r.flow || 0) + (r.ded || 0) - (r.debt || 0);
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
    };
    function needOf(r) {
      return r.status === "Contract Not Received" ? "cnr" : r.status === "Not in Balance" ? "nib"
        : r.status === "Missing Closing" ? "mc" : "";
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
      all.forEach(function (en) {
        var k = en.event_id || "", c = codeOf(en.job_code);
        if (c) (_byCode[c] = _byCode[c] || []).push(en);
        (_byEvB[bareEv(k)] = _byEvB[bareEv(k)] || []).push(en);
        if (en.link_id != null) (_byLink[en.link_id] = _byLink[en.link_id] || []).push(en);
        if (en.id != null) _byId[en.id] = en;
        en._repeatOf = null;
        if (!en.current) return;
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
               debt: b ? b.debt : null, sib: b && b.echoLeg ? 1 : 0 };
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
      else if (type === MF_DEBT) { if (amount > 0) lv.debt = amount; else if ((lv.debt || 0) > 0) lv.debt = 0; }
      else if (type === MF_EXTRA) { if (amount > 0) lv.debt = -amount; else if ((lv.debt || 0) < 0) lv.debt = 0; }
      if (S.live.entries) {
        if (it.replaces_id != null) S.live.entries.forEach(function (e) { if (e.id === it.replaces_id) e.current = false; });
        S.live.entries.push({ id: newId != null ? newId : "tmp" + Date.now() + Math.random(), event_id: evId,
          job_code: it.job_code || "", type: type, amount: amount, note: it.note || "",
          method: (type === BROUGHT || type === TAKEN) ? normMethod(it.method) : null,
          cash_amount: it.cash_amount != null ? it.cash_amount : null, link_id: linkId != null ? linkId : null,
          at: nowTs, by: "you", replaces: it.replaces_id != null ? it.replaces_id : null, current: 1 });
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
          onChange: function (v) { S.company = v || ""; S.sel = {}; S.selFm = null; S.hpage = 0; paintTools(); paint(); } });
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
        onChange: function (set) { S.formen = Array.from(set); S.hpage = 0; paint(); } });
      if (S.view === "settled") {
        RSC.dateRange($("mfDt"), {
          get: function () { return { from: S.dateFrom, to: S.dateTo }; },
          set: function (f, t) { S.dateFrom = f || null; S.dateTo = t || null; },
          onChange: function () { S.hpage = 0; paint(); } });
      }
      var q = $("mfQ");
      if (q) q.oninput = function () { S.q = q.value; S.hpage = 0; paint(); };
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
      var sc = document.getElementById("content"), st = sc ? sc.scrollTop : 0;
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
      var needs = { cnr: [], nib: [], mc: [] };
      scope.forEach(function (r) { var n = needOf(r); if (n) needs[n].push(r); });
      var nLook = needs.cnr.length + needs.nib.length + needs.mc.length;
      if (S.need && !(needs[S.need] || []).length) S.need = "";
      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi"><span class="mf-kl">Foremen owe the base</span><span class="mf-kv">' + money(toBase) + "</span>"
        + '<span class="mf-ks">' + nBase + " job" + (nBase === 1 ? "" : "s") + (top ? " · most with " + esc(top) + ", " + money(byFm[top]) : "") + "</span></div>"
        + '<div class="mf-kpi mf-kpi-out"><span class="mf-kl">The base owes foremen</span><span class="mf-kv">' + money(toFm) + "</span>"
        + '<span class="mf-ks">' + nFm + " job" + (nFm === 1 ? "" : "s") + " · balanced against other jobs or paid out</span></div>"
        + '<div class="mf-kpi mf-kpi-look"><span class="mf-kl">Needs a look</span><span class="mf-kv">' + nLook + " job" + (nLook === 1 ? "" : "s") + "</span>"
        + '<span class="mf-ks">Can’t be settled until someone checks them</span></div></div>';

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
        + "</div></section>" : "";

      // THE QUEUE
      var HEAD = {
        waiting: ["Waiting to settle", "Tick several jobs to confirm the cash a foreman brings in one go. Zelle, short or extra hand-ins and pay-outs are settled one job at a time."],
        settled: ["Settled lately", "Every confirmation, newest first. Open one to see the whole story of that job."],
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
        + "</span><span>Job date</span><span>Job</span><span>Customer</span><span>Type</span><span class=\"mf-r\">Amount</span><span>Money goes</span><span>Waiting</span><span></span></div>"
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
      else if (d < 0) pill = '<span class="mf-pill mf-p-out">' + ICON.toFm + "To the foreman</span>";
      else pill = '<span class="mf-pill mf-p-in">' + ICON.toBase + "To the base</span>";
      var act;
      if (need === "mc") act = '<span class="mf-dim mf-r">File the closing</span>';
      else if (pf) act = '<button type="button" class="mf-act mf-act-mute" data-mfa="job" data-v="' + esc(r.ev) + '">Review</button>';
      else if (need === "cnr") act = '<button type="button" class="mf-act mf-act-mute" data-mfa="job" data-v="' + esc(r.ev) + '">Enter cash</button>';
      else if (isPayout(r)) act = '<button type="button" class="mf-act mf-act-out" data-mfa="job" data-v="' + esc(r.ev) + '">Pay out</button>';
      else act = '<button type="button" class="mf-act" data-mfa="job" data-v="' + esc(r.ev) + '">Settle</button>';
      return '<div class="mf-jrow">' + ck
        + '<span class="mf-mut">' + fmtShort(r.date) + "</span>"
        + '<span class="mf-code" title="' + esc(r.jobCode || "") + '">' + esc(r.jobCode || "—") + "</span>"
        + '<button type="button" class="mf-cust" data-mfa="story" data-v="' + esc(r.ev) + '" title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</button>"
        + '<span class="mf-mut mf-ell">' + esc(r.jobType || "—") + "</span>"
        + '<span class="mf-r mf-b">' + (r.balance == null ? '<span class="mf-dim">—</span>' : money(Math.abs(r.balance))) + "</span>"
        + pill
        + '<span class="mf-mut">' + ageText(daysWaiting(r.date)) + "</span>"
        + act + "</div>";
    }

    // ---- Settled: every confirmation, newest first ----
    var HPP = 150;
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
    function settledHtml(scope, q) {
      var cur = settledRows(scope, q);
      if (!cur.length) return '<div class="mf-empty">' + (q || S.dateFrom || S.dateTo ? "Nothing settled matches." : "Nothing confirmed yet.") + "</div>";
      var pages = Math.max(1, Math.ceil(cur.length / HPP));
      if (S.hpage >= pages) S.hpage = pages - 1;
      if (S.hpage < 0) S.hpage = 0;
      var s0 = S.hpage * HPP, slice = cur.slice(s0, s0 + HPP);
      var html = '<div class="mf-scroll"><div class="mf-sgrid"><div class="mf-shd"><span>Settled</span><span>Foreman</span><span>Job</span><span>Customer</span>'
        + '<span>Method</span><span class="mf-r">Amount</span><span>Money went</span><span>By</span></div>'
        + slice.map(function (r) {
            var amt = r.flow == null ? 0 : Math.abs(r.flow);
            return '<div class="mf-srow" role="button" tabindex="0" data-mfa="job" data-v="' + esc(r.ev) + '">'
              + '<span class="mf-mut">' + fmtShort(settledKey(r)) + "</span>"
              + '<span class="mf-ell">' + esc(r.forman) + "</span>"
              + '<span class="mf-code">' + esc(r.jobCode || "—") + "</span>"
              + '<span class="mf-custt mf-ell" title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</span>"
              + '<span class="mf-pill mf-p-mute">' + esc(methodLabel(r.method)) + "</span>"
              + '<span class="mf-r mf-b">' + money(amt) + "</span>"
              + '<span class="mf-mut">' + (r.flow == null || Math.abs(r.flow) < 0.005 ? "Nothing to move" : r.flow < 0 ? "To the foreman" : "To the base") + "</span>"
              + '<span class="mf-mut mf-ell">' + esc(settledBy(r)) + "</span></div>";
          }).join("") + "</div></div>";
      html += '<div class="mf-pager"><div>Showing <b>' + (s0 + 1).toLocaleString() + "–" + Math.min(s0 + HPP, cur.length).toLocaleString()
        + "</b> of <b>" + cur.length.toLocaleString() + "</b> settled jobs</div>"
        + '<div class="mf-pgnav"><button type="button" class="mf-btn mf-sm" data-mfa="pg" data-v="-1"' + (S.hpage ? "" : " disabled") + ">‹ Prev</button>"
        + "<span>Page " + (S.hpage + 1) + " of " + pages + "</span>"
        + '<button type="button" class="mf-btn mf-sm" data-mfa="pg" data-v="1"' + (S.hpage + 1 < pages ? "" : " disabled") + ">Next ›</button></div></div>";
      return html;
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
    }

    // ================= THE PANEL (right-side drawer) =================
    var P = null, PSTACK = [];
    function openPanel(spec, push) {
      if (push && P) PSTACK.push(P.spec); else PSTACK = [];
      P = { spec: spec, st: {} };
      renderPanel();
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
    // save one batch from a panel; on success the panel closes and the queue repaints at once
    async function panelSave(items, link) {
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
      closePanel();
      paint();
      afterWrite(items);
      return true;
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
      var links = [];
      if (r.contractUrl) links.push('<a class="mf-alink" href="' + esc(r.contractUrl) + '" target="_blank" rel="noopener">Contract ↗</a>');
      var cu = calUrl(r);
      if (cu) links.push('<a class="mf-alink" href="' + esc(cu) + '" target="_blank" rel="noopener">Calendar ↗</a>');
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
        + recorded + legacy
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
          tl(l.dcTs || l.date + " 00", "ring", (l.dcTs ? fmtWhen(l.dcTs) : fmtD(l.date)) + lt,
            '<span class="mf-b">Closing filed: net cash ' + money2(l.expected) + "</span>"
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
      } else if (en.type === "Advance Payment") title = "Advance on the job (old way)";
      else if (en.type === "Forman Deduction") title = "Deduction on the job (old way)";
      else title = esc(en.type || "Entry");
      if (en.replaces != null) sub.push("correction");
      if (gone) sub.push("replaced by a correction");
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
      if (!w) html += '<span class="mf-mut mf-sm2">Money Flow update pending — only Cash can be saved until the database step has run.</span>';
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
      if (!methodsWritable()) return "Money Flow update pending — methods can’t be added until the server is updated.";
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
      var body = jobCardHtml(r, { out: st.type === TAKEN && !manual }) + why
        + methodCards(list, st.method, st.type !== TAKEN, st)
        + '<div class="mf-fld"><div class="mf-fldh"><label for="mfAmt" class="mf-lg">' + (st.type === TAKEN ? "How much was paid to him?" : "How much did he bring?") + "</label>"
        + (pre && !manual ? '<button type="button" class="mf-linkbtn" data-mfp="full">Full ' + money2(pre.amount) + "</button>" : "") + "</div>"
        + '<div class="mf-amt"><span class="mf-mut">$</span><input id="mfAmt" inputmode="decimal" autocomplete="off" value="' + esc(st.amt) + '" data-mffocus></div>'
        + '<div id="mfEff"></div></div>'
        + '<div class="mf-dcl"><span class="mf-b">Day Closing</span><span class="mf-mut" id="mfDcl"></span></div>'
        + '<div class="mf-fld"><label for="mfNote" class="mf-lg2">Note <span class="mf-mut">(optional)</span></label>'
        + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400">' + esc(st.note) + "</textarea></div>"
        + storySection(r, false);
      var foot = '<div id="mfDErr"></div><div class="mf-dfrow"><button type="button" class="mf-btn" data-mfp="close">Cancel</button>'
        + '<button type="button" class="mf-btn mf-pri" data-mfp="save" id="mfSave">Confirm</button></div>';
      var live = function () {
        var amt = parseAmt(st.amt), eff = settleEffect(r, st.type, amt, balNow);
        var e = $("mfEff"), dc = $("mfDcl"), sv = $("mfSave");
        if (e) e.innerHTML = '<div class="mf-eff mf-eff-' + eff.kind + '"><span class="mf-b">' + esc(eff.title) + "</span>" + (eff.line ? "<span>" + esc(eff.line) + "</span>" : "") + "</div>";
        if (dc) dc.textContent = amt == null ? "—" : dcLine(st.type, st.method, amt);
        if (sv) sv.textContent = amt == null ? "Confirm" : "Confirm " + money2(amt) + " · " + normMethod(st.method);
      };
      return {
        title: manual ? "Enter cash by hand" : st.type === TAKEN ? "Pay out to a foreman" : "Settle a job",
        body: body, foot: foot,
        after: live,
        onInput: function (e) {
          if (e.target.id === "mfAmt") { st.amt = e.target.value; live(); }
          else if (e.target.id === "mfNote") st.note = e.target.value;
          else if (e.target.id === "mfNewM") st.draft = e.target.value;
        },
        h: {
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
            var items = settleItems(r, { type: st.type, amt: amt, method: st.method, note: st.note, replaces: null });
            if (!items.length) { closePanel(); return; }   // nothing changed: the job already reads this
            panelSave(items, false);
          },
        },
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
          + '<div id="mfEff"></div></div>'
          + '<div class="mf-dcl"><span class="mf-b">Day Closing</span><span class="mf-mut" id="mfDcl"></span></div>'
          + '<div class="mf-fld"><label for="mfNote" class="mf-lg2">Why the correction</label>'
          + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400" placeholder="e.g. It came by Zelle, not cash">' + esc(st.note) + "</textarea></div></div>";
      }
      var body = jobCardHtml(rr, { out: st.type === TAKEN, settled: true, noStoryLink: true }) + confHtml + box + form + storySection(rr, true);
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
        var amt = parseAmt(st.amt), eff = settleEffect(rr, st.type, amt, balNow);
        var e = $("mfEff"), dc = $("mfDcl"), sv = $("mfSave");
        if (e) e.innerHTML = '<div class="mf-eff mf-eff-' + eff.kind + '"><span class="mf-b">' + esc(eff.title) + "</span>" + (eff.line ? "<span>" + esc(eff.line) + "</span>" : "") + "</div>";
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
          if (e.target.id === "mfAmt") { st.amt = e.target.value; live(); }
          else if (e.target.id === "mfNote") st.note = e.target.value;
        },
        h: {
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
            var items = settleItems(rr, { type: st.type, amt: amt, method: st.method, note: st.note, replaces: cur });
            if (!items.length) { panelErr("Nothing changed — change the amount or how it came in."); return; }
            panelSave(items, false);
          },
        },
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
          + (w ? "" : '<span class="mf-mut mf-sm2">Money Flow update pending — until the database step has run, a pay-out can only be the full amount in cash.</span>')
          + '<div class="mf-info">' + ICON.info + "<span>" + info + "</span></div></div>"
        : '<div class="mf-eff mf-eff-ok"><span class="mf-b">The jobs cover all of it</span><span>Nothing to pay out — no money moves.'
          + (Math.abs(after - balNow) > 0.005 ? " His balance: " + esc(owesText(balNow)) + " → " + esc(owesText(after)) + "." : "") + "</span></div>";
      var summary;
      var wl = st.way === WAY_BAL ? " left on his balance" : isCashMethod(st.way) ? " paid in cash" : " paid by " + wayName;
      if (plan.used > 0.005 && plan.rest > 0) summary = money2(plan.used) + " balanced against his jobs · " + money2(plan.rest) + wl;
      else if (plan.used > 0.005) summary = "All " + money2(plan.owed) + " balanced against his jobs";
      else summary = money2(plan.owed) + wl;
      if (plan.leftover > 0.005) summary += " · " + money2(plan.leftover) + " leftover goes on his balance";
      var body = jobCardHtml(r, { out: true })
        + '<fieldset class="mf-fs"><legend class="mf-lg">1 · Balance it against his other jobs</legend>'
        + (cands.length ? '<span class="mf-mut">' + (w ? "Jobs where " + esc(fm) + " still holds money for the base. Tick the ones to use."
            : "Money Flow update pending — balancing against his jobs works once the database step has run.") + "</span>" : "")
        + list + "</fieldset>"
        + rest
        + '<div class="mf-fld"><label for="mfNote" class="mf-lg2">Note <span class="mf-mut">(optional)</span></label>'
        + '<textarea id="mfNote" class="mf-ta" rows="2" maxlength="400" placeholder="e.g. Salaries for the ' + esc(fmtShort(r.date)) + ' crew">' + esc(st.note) + "</textarea></div>"
        + storySection(r, false);
      var foot = '<span class="mf-mut">' + esc(summary) + '</span><div id="mfDErr"></div><div class="mf-dfrow"><button type="button" class="mf-btn" data-mfp="close">Cancel</button>'
        + '<button type="button" class="mf-btn mf-pri" data-mfp="save">Confirm</button></div>';
      return {
        title: "Pay out to a foreman", body: body, foot: foot,
        onInput: function (e) { if (e.target.id === "mfNote") st.note = e.target.value; },
        h: {
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
        },
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
          panelErr("Money Flow update pending — only Cash can be recorded here until the server is updated."); return;
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
      if (kind === "repayment" || kind === "advance") { if (window.ZDC && $("mfDayStrip")) ZDC.mountStrip($("mfDayStrip")); }
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
      var body = (w ? "" : '<div class="mf-why"><b>Money Flow update pending.</b> The server hasn’t been updated yet, so this list is the starting set and can’t be changed. Cash always works.</div>')
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
        cols = ["Foreman", "Job date", "Job code", "Job #", "Customer", "Type", "Status", "Money goes", "Amount", "Waiting (days)", "His balance"];
        var set = S.need ? scope.filter(function (r) { return needOf(r) === S.need; }) : scope.filter(function (r) { return MAINSET[r.status]; });
        data = set.filter(function (r) { return matches(r, q); }).sort(function (a, b) { return a.forman.localeCompare(b.forman) || (a.date < b.date ? 1 : -1); }).map(function (r) {
          var d = dirOf(r);
          return [r.forman, r.date, r.jobCode, r.jobNo, r.customer, r.jobType, r.status, d > 0 ? "To the base" : d < 0 ? "To the foreman" : "",
            r.balance == null ? "" : r2(Math.abs(r.balance)), daysWaiting(r.date), S.fines ? debtOf(r.forman) : ""];
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

    // ---------- wiring: one delegated handler for the page, one for the panel ----------
    function onRootClick(e) {
      if (e.target.closest("#mfDrawer")) return;          // the panel has its own handler
      var a = e.target.closest("[data-mfa]"); if (!a) return;
      var act = a.getAttribute("data-mfa"), v = a.getAttribute("data-v");
      if (act === "tab") {
        S.view = v; S.hpage = 0; paintTools(); paint();
        if (S.view === "balances" && !S.fines && !S.finesErr) loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
      } else if (act === "need") { S.need = S.need === v ? "" : v; S.view = "waiting"; paintTools(); paint(); }
      else if (act === "needclear") { S.need = ""; paint(); }
      else if (act === "grp") { S.fmx[v] = !S.fmx[v]; paint(); }
      else if (act === "older") { S.fmAll[v] = true; paint(); }
      else if (act === "allfm") { S.allFm = true; paint(); }
      else if (act === "job") openJob(v, false);
      else if (act === "story") openJob(v, true);
      else if (act === "fm") openFm(v, false);
      else if (act === "pg") { S.hpage += +v; paint(); var c = document.getElementById("content"); if (c && $("mfQH")) $("mfQH").scrollIntoView(); }
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
    .mf-root > #mfDayStrip{margin-bottom:0}
    .mf-bodywrap{display:flex;flex-direction:column;gap:22px;min-width:0}
    .mf-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
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
    .mf-scroll{overflow-x:auto}
    .mf-grid{min-width:1060px}
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
    .mf-jhd,.mf-jrow{display:grid;grid-template-columns:44px 64px 104px minmax(150px,1fr) 96px 96px 140px 70px 112px;align-items:center;gap:0 12px;padding:4px 20px 4px 12px;border-top:1px solid var(--mf-soft)}
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
    .mf-sgrid{min-width:1000px}
    .mf-shd,.mf-srow{display:grid;grid-template-columns:92px 180px 104px minmax(150px,1fr) 130px 96px 130px 90px;align-items:center;gap:0 12px;padding:10px 20px;border-top:1px solid var(--mf-line)}
    .mf-shd{color:var(--mf-muted);font-size:12px;font-weight:500}
    .mf-srow{padding:0 20px;min-height:50px;border-top-color:var(--mf-soft);cursor:pointer}
    .mf-srow:hover{background:var(--mf-panel2)}
    .mf-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 20px;border-top:1px solid var(--mf-line);color:var(--mf-muted)}
    .mf-pager b{color:var(--mf-ink)}
    .mf-pgnav{display:flex;align-items:center;gap:9px}
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
    @media (max-width:640px){
      .mf-db{padding:16px}
      .mf-dh{padding:12px 8px 12px 16px}
      .mf-df{padding:12px 16px 14px}
      .mf-st3,.mf-fk{grid-template-columns:1fr}
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
