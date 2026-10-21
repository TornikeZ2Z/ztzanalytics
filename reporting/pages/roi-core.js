/* SHARED RETURN-ON-AD-SPEND CORE (2026-10-20).
 *
 * His call that day: "this expenditure by states for each marketing stuff should be completely
 * separately, as a new page, and then we should have ROI there as well. Source analysis should be
 * simply everything about source, including its ROI across states." His picks: ONE calculation in
 * shared portal code (both pages run the same JS, so a saved split shows at once and the two pages
 * can never disagree), revenue per $1 + cost per booked job (said plainly: this is revenue per
 * dollar, not profit), Marketing + admins enter the splits.
 *
 * Loaded BEFORE source-report.js and marketing-roi.js. It owns:
 *   - the four mart datasets both pages read (src_lead, src_job, src_spend, src_state_spend);
 *     RS.load caches them, so the second page to ask reads them from memory;
 *   - the dollars entered per source, month and state (mkt_state_amount via /api/_mktamount);
 *   - calc(): spend placed per source and state (the ledger's rules, then the entered dollars
 *     applied to what no rule could place, month by month), revenue of each paying source's jobs
 *     in the same state and days, what is still not placed -- with a per-month breakdown on every
 *     cell for the drill and the coverage grid.
 * No markup and no styles: each page draws its own.
 */
(function () {
  if (!window.RS || !RS.DATASETS) return;
  if (!RS.DATASETS.src_lead) {
    RS.DATASETS.src_lead = {
      table: "mart_source_lead",
      // the ANALYTIC half only; contact detail comes from /api/_srclead when the list needs it
      cols: ["Request Joinkey", "Company", "Create Date", "Booked Date", "Status",
             "Status Category", "Flag", "Source", "Family", "Campaign", "Service Type",
             "Moving Type", "State", "Size of Move", "CF", "CF Range", "Quote", "Quote Band",
             "Rep", "Moved", "Billed"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.src_job) {
    RS.DATASETS.src_job = {
      table: "mart_source_job",
      cols: ["Unique Key", "Company", "Date", "Record Source", "Source", "Family", "Campaign",
             "State", "Moving Type", "Billed", "Cash", "Has Lead"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.src_state_spend) {
    RS.DATASETS.src_state_spend = {
      table: "mart_source_state_spend",
      cols: ["Month", "Company", "Family", "State", "How", "Spend"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.src_spend) {
    RS.DATASETS.src_spend = {
      table: "mart_source_spend",
      // Form Export Date (2026-09-24): the newest website-form export, the only source of UTM tags
      cols: ["Date", "Company", "Source", "Family", "Campaign", "Spend", "Ledger End", "Form Export Date"],
      dateCols: {}, defaultDate: null,
    };
  }
})();

(function () {
  if (!window.RS) return;
  var SERVICE_STATES = ["NJ", "PA", "NY", "DE", "CT", "MD", "MA", "VA"];
  var OTHER_ST = "Other / unknown";
  // the states a dollar can be entered for (the /api/_mktamount whitelist)
  var AMT_STATES = ["NJ", "PA", "NY", "CT", "DE", "MD", "MA", "VA"];
  var SMALL_SPEND = 500;   // a source x state cell with less placed spend is shown greyed, not rated
  var HOW_SHORT = { "From the source label": "label", "Google Ads state report": "Google report",
                    "Thumbtack lead cost": "lead cost", "Split by leads": "by leads", "Yelp ads report": "Yelp report",
                    "Your amounts": "entered" };

  function num(v) { return RS.num(v) || 0; }
  function inR(d, a, b) { return !!d && d >= a && d <= b; }
  function stateKey(st) {
    var s = String(st == null ? "" : st).trim().toUpperCase();
    return SERVICE_STATES.indexOf(s) >= 0 ? s : OTHER_ST;
  }

  var D = { ready: false, byFam: null, rows: null, err: null, ledgerEnd: null, minDay: null, maxDay: null,
            formsDate: null, amts: null, amtErr: null, loadingAmts: false };
  var loadP = null, amtP = null;

  function index(L, J, Sp, SS) {
    var fams = new Map();
    var get = function (f) {
      var k = f || "(no source)";
      if (!fams.has(k)) fams.set(k, { leads: [], jobs: [], spend: [] });
      return fams.get(k);
    };
    var lo = "9999-12-31", hi = "", led = "", frm = "";
    L.forEach(function (r) {
      r._cd = String(r["Create Date"] || "").slice(0, 10);
      r._bd = r["Booked Date"] ? String(r["Booked Date"]).slice(0, 10) : "";
      r._st = stateKey(r.State);
      r._fam = r.Family || "(no source)";
      if (r._cd) { if (r._cd < lo) lo = r._cd; if (r._cd > hi) hi = r._cd; }
      get(r._fam).leads.push(r);
    });
    J.forEach(function (r) {
      r._d = String(r.Date || "").slice(0, 10);
      r._st = stateKey(r.State);
      get(r.Family).jobs.push(r);
    });
    Sp.forEach(function (r) {
      r._d = String(r.Date || "").slice(0, 10);
      r._sp = num(r.Spend);
      var le = String(r["Ledger End"] || "").slice(0, 10);
      if (le > led) led = le;
      var fe = String(r["Form Export Date"] || "").slice(0, 10);
      if (fe > frm) frm = fe;
      get(r.Family).spend.push(r);
    });
    D.byFam = fams;
    D.minDay = hi ? lo : null;
    D.maxDay = hi || null;
    D.ledgerEnd = led || null;
    D.formsDate = frm || null;
    D.rows = SS ? SS.map(function (r) {
      return { _m: String(r.Month || "").slice(0, 10), co: r.Company, fam: r.Family || "(no source)",
               st: r.State ? String(r.State).trim().toUpperCase() : "", how: r.How, sp: num(r.Spend) };
    }) : null;
    D.ready = true;
  }

  // the four marts, once per page-load; a failed read is tried again on the next call
  function ensure() {
    if (D.ready) return Promise.resolve(D);
    if (loadP) return loadP;
    loadP = Promise.all([RS.load("src_lead"), RS.load("src_job"), RS.load("src_spend"),
      RS.load("src_state_spend").catch(function (e) { D.err = e; return null; })])
      .then(function (got) { index(got[0] || [], got[1] || [], got[2] || [], got[3]); return D; })
      .catch(function (e) { loadP = null; throw e; });
    return loadP;
  }

  // the dollars entered per source, month and state; every call after a save reads them afresh
  function loadAmounts() {
    if (amtP) return amtP;
    D.loadingAmts = true;
    amtP = ZTZ.api("/api/_mktamount").then(function (j) {
      var m = {};
      ((j && j.amounts) || []).forEach(function (r) {
        var M = m[r.Company + "|" + r.Family] = m[r.Company + "|" + r.Family] || {};
        (M[r.Month] = M[r.Month] || []).push(r);
      });
      D.amts = m; D.amtErr = null;
    }).catch(function (e) { D.amts = D.amts || {}; D.amtErr = e; })
      .then(function () { D.loadingAmts = false; amtP = null; return D; });
    return amtP;
  }
  function amtOf(co, fam, ym) { var M = D.amts && D.amts[co + "|" + fam]; return (M && M[ym]) || []; }
  // the months of the period that have dollars entered for this source
  function typedIn(co, fam, R) {
    var M = D.amts && D.amts[co + "|" + fam], a = R.m0.slice(0, 7), b = R.e.slice(0, 7);
    return !M ? [] : Object.keys(M).filter(function (ym) { return ym >= a && ym <= b && M[ym].length; }).sort();
  }

  /* THE PERIOD'S NUMBERS. q = {co ("" = both), fams (Set or null = every source), a, bEff}.
     Returns, per source: spend, unplaced, mon[ym] = {sp, rule, typed, unpl} (the coverage grid),
     and per state a cell {sp, rev, jobs, how, m[ym] = {sp, rev, jobs}} (the drill). Revenue is the
     Total Bill of the source's jobs in the state; jobs are closings. Spend stops at the ledger's
     last posted day, and revenue stops there too, so a month with no ledger yet never reads free. */
  function calc(q) {
    var co = q.co || "", fs = q.fams && q.fams.size ? q.fams : null;
    var led = D.ledgerEnd, e = led && q.bEff > led ? led : q.bEff;
    var m0 = q.a.slice(0, 8) + "01";
    var fams = {}, unpl = {}, total = 0, mon = {}, over = [];
    var famOf = function (f) { return fams[f] = fams[f] || { sp: 0, unpl: 0, st: {}, mon: {} }; };
    var cell = function (f, st) {
      var F = famOf(f);
      return F.st[st] = F.st[st] || { sp: 0, rev: 0, jobs: 0, how: {}, m: {} };
    };
    var cm = function (c, ym) { return c.m[ym] = c.m[ym] || { sp: 0, rev: 0, jobs: 0 }; };
    var fm = function (F, ym) { return F.mon[ym] = F.mon[ym] || { sp: 0, rule: 0, typed: 0, unpl: 0 }; };
    var famIn = function (f) { return !fs || fs.has(f); };
    (D.rows || []).forEach(function (r) {
      if ((co && r.co !== co) || r._m < m0 || r._m > e || !famIn(r.fam)) return;
      total += r.sp;
      var F = famOf(r.fam), ym = r._m.slice(0, 7), FM = fm(F, ym);
      F.sp += r.sp; FM.sp += r.sp;
      if (r.how !== "Not placed") {
        var c = cell(r.fam, stateKey(r.st));
        c.sp += r.sp; c.how[r.how] = (c.how[r.how] || 0) + r.sp; cm(c, ym).sp += r.sp;
        FM.rule += r.sp;
        return;
      }
      // the dollars entered for this source and month go to their states, up to the month's
      // unplaced spend; entered more than the month now has (the ledger moved since)? scaled
      // down to fit and named. Whatever is left stays not placed.
      var A = amtOf(r.co, r.fam, ym), T = 0;
      A.forEach(function (x) { T += num(x.Amount); });
      var Mo = mon[r.fam] = mon[r.fam] || {};
      Mo[ym] = (Mo[ym] || 0) + r.sp;
      var fit = T > 0 ? Math.min(1, r.sp / T) : 0;
      // only when something WAS entered: a month whose unplaced spend is a refund (Yelp Sep 26,
      // -$921 with no state tag in the bank) has nothing to place and nothing to warn about
      if (T > 0.5 && T > r.sp + 1) over.push({ fam: r.fam, ym: ym, typed: T, spend: r.sp });
      A.forEach(function (x) {
        var part = num(x.Amount) * fit, c2 = cell(r.fam, stateKey(x.State));
        c2.sp += part; c2.how["Your amounts"] = (c2.how["Your amounts"] || 0) + part; cm(c2, ym).sp += part;
      });
      FM.typed += T * fit;
      var rest = r.sp - T * fit;
      if (rest <= 0.5) return;
      F.unpl += rest; FM.unpl += rest;
      var U = unpl[r.fam] = unpl[r.fam] || { sp: 0, months: {} };
      U.sp += rest; U.months[ym] = (U.months[ym] || 0) + rest;
    });
    // revenue: each paying source's jobs, by the closing's state, same company and days
    var noState = { n: 0, rev: 0, rows: [] };
    if (D.byFam) D.byFam.forEach(function (v, f) {
      if (!famIn(f)) return;
      v.jobs.forEach(function (r) {
        if ((co && r.Company !== co) || !inR(r._d, q.a, e)) return;
        var blank = !String(r.State || "").trim();
        if (blank && r["Record Source"] === "closing") { noState.n++; noState.rev += num(r.Billed); if (noState.rows.length < 25) noState.rows.push(r); }
        if (!fams[f] || fams[f].sp <= 0) return;
        var c = cell(f, stateKey(r.State)), x = cm(c, r._d.slice(0, 7)), b = num(r.Billed);
        c.rev += b; x.rev += b;
        if (r["Record Source"] === "closing") { c.jobs++; x.jobs++; }
      });
    });
    return { e: e, m0: m0, clipped: e < q.bEff, fams: fams, unpl: unpl, total: total, noState: noState,
             mon: mon, over: over };
  }

  // revenue per $1 and cost per closing for a set of cells; spend under SMALL_SPEND is not rated
  function ratio(rev, sp) { return sp > 0 ? rev / sp : null; }
  function perJob(sp, jobs) { return jobs > 0 && sp > 0 ? sp / jobs : null; }

  window.RSROI = {
    D: D, ensure: ensure, loadAmounts: loadAmounts, amtOf: amtOf, typedIn: typedIn, calc: calc,
    ratio: ratio, perJob: perJob, stateKey: stateKey, inR: inR,
    SERVICE_STATES: SERVICE_STATES, OTHER_ST: OTHER_ST, AMT_STATES: AMT_STATES,
    SMALL_SPEND: SMALL_SPEND, HOW_SHORT: HOW_SHORT,
  };
})();
