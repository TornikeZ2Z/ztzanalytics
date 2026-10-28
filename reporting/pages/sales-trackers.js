/* SALES TRACKERS — what the reps said on their calls, rep by rep, with trackers you can trust.
 *
 * THE REDESIGN (his "i like it, rebuild please", 2026-10-28, from the canvas he showed Ruso).
 * The old page stacked one ~4,100 px card per tracker (a 19-row rep table and 50 calls each),
 * about 24,000 px of scrolling, every number counting everything since the tracker was made.
 * A read of real hits the same day found two of six trackers measuring something else: Not
 * Moving Forward fired on "we're not moving any TVs" (20 of 21 hits), Customer Concern
 * Discovery on the rep checking date or parking "availability" (90% of hits). Now:
 *
 *   * ONE FILTER BAR over every view (his "make sure that the filters are properly set up, like
 *     date filters are there wherever its needed"): the period (Last 30 days by default) with
 *     the same-length period before it as the comparison, who handled the call, and a Filters
 *     panel -- direction, lead source, first call or follow-up, rep. Day buckets are NEW YORK
 *     days: the mart stores UTC, and which calls are in a period must not move with the
 *     reader's clock (the timezone-picker rule).
 *   * SCORECARD: reps x trackers on one screen, each cell coloured against the team, ▲▼ for a
 *     5-point move. A click opens the weeks and the calls -- Mary's columns kept (handled by,
 *     assigned to, direction, the customer's calls) and her "Not mentioned" picker as
 *     Without it / With it / All.
 *   * ONE REP: every tracker and the 14 script checks for one rep against the team, the
 *     biggest gaps first -- built for a 1:1.
 *   * SCRIPT CHECKS: the Communication Analysis rubric as the same matrix, with the period;
 *     the old full table stays one click away.
 *   * TRACKERS: each tracker's health -- a person reads 10 hits and marks them right or wrong,
 *     8 of 10 right is Reliable, fewer is Not measuring it and it leaves the scorecard; and who
 *     says the phrases (`Said By`, the engine's new column).
 *   * BUILDER: whose lines count, "when the customer says ... then the rep says ... within N
 *     lines", phrases to ignore -- and a Test on the newest 300 in-scope calls before saving.
 *
 * THE HOUSE RULES CARRY OVER:
 *   * RATES, NEVER A RANK, and a floor: under MIN_CALLS a cell says "few".
 *   * THE SUPPORT LINE IS THE TEAM, NEVER A PERSON (his point, 2026-10-18): Mariam, Avto and
 *     Nikoloz share "Support Zip To Zip", so a support call is the Support team's.
 *   * NO VERBATIM SPEECH IN THE PAYLOAD: verdicts carry utterance `Seq` pointers and the words
 *     come one call at a time through the gated /api/_salescall.
 *   * Reps Ruso switched off sit under one collapsed "Former reps" line (2026-10-16), through
 *     RSC.repRows, still counted in every team figure.
 *
 * WRITES go through /api/_trackers (admin or the sales-trackers-admin grant): save, toggle,
 * delete, run, test, and mark. A changed phrase, scope or rule re-checks every matching call on
 * the next pass and starts the reading over; a rename or a reworded note does neither.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_tracker_eval) {
    RS.DATASETS.sales_tracker_eval = {
      table: "sales_tracker_eval",
      // A PAYLOAD CONTRACT. The engine's bookkeeping (hash, attempts, batch id) stays home.
      cols: ["Record Id", "Tracker Key", "Result", "Confidence", "Explanation",
             "Evidence Seqs", "Model", "Said By", "Evaluated At"],
    };
  }
  // registered by sales-comms.js too — whichever script runs first wins, same contract
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_call_score) {
    RS.DATASETS.sales_call_score = {
      table: "mart_sales_call_score",
      cols: ["Record Id", "Rep", "Shared Line", "Transferred", "Started", "Duration Sec",
             "Job No", "Customer", "Source", "Direction", "Assigned", "Linked", "Stage", "Priced",
             "First Contact", "Rep Turns", "Customer Turns", "Rep Words", "Customer Words",
             "Talk Share", "Objection", "Longest Monologue Sec", "Questions",
             "Questions Per Min", "Ended With Next Step", "Customer Ending Share",
             "open_identified", "open_goodtime", "disc_date", "disc_inventory", "disc_access",
             "disc_heavy", "disc_packing", "price_after_discovery", "px_explained",
             "dep_named", "dep_purpose", "close_ask", "obj_response", "gave_direct_line",
             "shape_broadcast", "shape_monologue"],
    };
  }
})();

(function () {
  var MIN_CALLS = 25;          // below this a rate is words, not a number
  var PAGE_CALLS = 50;         // the call list grows by this much per "Show more"
  var READ_TARGET = 10;        // hits a person reads before a tracker is called either way
  var PASS_SHARE = 0.8;        // 8 of 10 right = Reliable; the same bar for "who says it"
  var MOVE = 5;                // points against the previous period that earn an arrow
  var NY = "America/New_York";

  /* THE SUPPORT TEAM IS ONE LINE (2026-10-18). 8,452 of 33,577 transcribed calls (25%) were
     support's; trackers check them only where "include the shared line" is ticked. */
  var SUPPORT = "__support";
  function isSupport(c) { return !!(c && +c["Shared Line"]); }
  function handledBy(c) { return isSupport(c) ? "Support team" : ((c && c.Rep) || "—"); }
  function pickedRep(c, rep) {
    return !rep || (rep === SUPPORT ? isSupport(c) : (!isSupport(c) && !!c && c.Rep === rep));
  }
  function repLabel(rep) { return rep === SUPPORT ? "Support team" : (rep || "Team"); }

  /* THE 14 SCRIPT CHECKS of Communication Analysis (sales-comms.js): id, the short head, the
     sentence, and the group. Each counts only the calls it applies to -- a null verdict is "did
     not apply" -- and the support line is never scored. */
  var CHECKS = [
    ["open_identified", "Name + company", "Said who they are and the company in the first 30 seconds", "Opening"],
    ["open_goodtime", "Good time?", "Asked whether it was a good time to talk", "Opening"],
    ["disc_date", "Move date", "Established when the move is", "Discovery"],
    ["disc_inventory", "Inventory", "Established what is being moved", "Discovery"],
    ["disc_access", "Floors / lift", "Established floors, stairs and elevator", "Discovery"],
    ["disc_heavy", "Heavy items", "Established heavy or specialty items", "Discovery"],
    ["disc_packing", "Boxes", "Established boxes and who is packing", "Discovery"],
    ["price_after_discovery", "Asked first", "Learned about the job before naming a price", "Price"],
    ["px_explained", "How it is built", "Explained how the price is built", "Price"],
    ["dep_named", "Deposit", "Raised the deposit", "Price"],
    ["dep_purpose", "What it is for", "Said what the deposit is for", "Price"],
    ["close_ask", "Asked to book", "Asked for the booking", "Close"],
    ["obj_response", "Answered pushback", "Responded when the customer pushed back", "Close"],
    ["gave_direct_line", "Direct line", "Gave a direct line back", "Close"],
  ];
  var GROUPS = ["Opening", "Discovery", "Price", "Close"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }
  function int(n) { return Number(n || 0).toLocaleString("en-US"); }

  /* ------------------------------------------------------------------ days (New York) */

  var NY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: NY, year: "numeric", month: "2-digit", day: "2-digit" });
  function instant(started) {
    var iso = String(started || "").replace(" ", "T");
    if (!iso) return null;
    if (!/(Z|[+-]\d\d:?\d\d)$/.test(iso)) iso += "Z";          // the mart stores UTC
    var d = new Date(iso);
    return isNaN(d) ? null : d;
  }
  function nyDay(started) { var d = instant(started); return d ? NY_FMT.format(d) : ""; }
  function todayNY() { return NY_FMT.format(new Date()); }
  function addDays(day, n) {
    var d = new Date(day + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayDiff(a, b) { return Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 864e5); }
  function weekOf(day) { return addDays(day, -((new Date(day + "T12:00:00Z").getUTCDay() + 6) % 7)); }
  function fmtDay(day) {
    return day ? new Date(day + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : "";
  }
  function fmtWhen(started) {
    var d = instant(started);
    if (!d) return "—";
    return (RS.fmtTzDay ? RS.fmtTzDay(d) : NY_FMT.format(d)) + ", " + (RS.fmtTz ? RS.fmtTz(d) : "");
  }
  function monthsBack(day, n) {
    var y = +day.slice(0, 4), m = +day.slice(5, 7) - 1 - n;
    while (m < 0) { m += 12; y -= 1; }
    var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(Math.min(+day.slice(8, 10), last)).padStart(2, "0");
  }
  /* The kit's ladder wording ("Last 7 days", "Past month", "Last 3 months"), computed on New
     York days, plus the "Last 30 days" this page opens on. Built at call time, never cached. */
  function presets() {
    var t = todayNY(), m1 = t.slice(0, 8) + "01";
    var pm1 = monthsBack(m1, 1);
    return [
      ["Last 7 days", addDays(t, -6), t],
      ["Last 30 days", addDays(t, -29), t],
      ["This month", m1, t],
      ["Past month", pm1, addDays(m1, -1)],
      ["Last 3 months", monthsBack(t, 3), t],
      ["This year", t.slice(0, 4) + "-01-01", t],
      ["All time", "", ""],
    ];
  }
  function curRange() { return { from: ST.from || "", to: ST.to || "" }; }
  // the same number of days just before -- nothing to compare when the period has no start
  function prevRange() {
    if (!ST.from) return null;
    var to = ST.to || todayNY(), n = dayDiff(ST.from, to) + 1;
    return { from: addDays(ST.from, -n), to: addDays(ST.from, -1) };
  }
  function inRange(day, r) { return !!r && !!day && (!r.from || day >= r.from) && (!r.to || day <= r.to); }
  function rangeLabel(r) {
    if (!r || (!r.from && !r.to)) return "all time";
    var hit = presets().filter(function (p) { return p[1] === r.from && p[2] === r.to; })[0];
    return hit ? hit[0].toLowerCase() : fmtDay(r.from) + " – " + fmtDay(r.to || todayNY());
  }
  // the eight Monday weeks ending with the period's last day
  function weekList() {
    var end = weekOf(ST.to || todayNY()), out = [];
    for (var i = 7; i >= 0; i--) out.push(addDays(end, -7 * i));
    return out;
  }

  // the mart writes Incoming / Outgoing; the page says what the editor says
  function dirWord(d) {
    d = String(d || "");
    return /^in/i.test(d) ? "Inbound" : /^out/i.test(d) ? "Outbound" : (d || "—");
  }

  /* ------------------------------------------------------------------ state */

  var ST = {
    view: "scorecard",
    from: null, to: null, inited: false,
    handled: "reps",                       // reps | support | all
    pf: { direction: new Set(), source: new Set(), first: new Set(), rep: new Set() },
    sel: { rep: "", trk: "" },             // the scorecard's open cell ("" rep = the team)
    verdict: "miss", shown: PAGE_CALLS,    // the open cell's call list
    one: "",                               // One rep
    chk: { rep: "", id: "" },              // Script checks' open cell
    edit: null, test: null,                // the builder
  };
  var D = null;                            // what the page loaded

  function api(path, opts) {
    return fetch(ZTZ.API + path, Object.assign({
      headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                             (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
    }, opts || {})).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }
  function post(body) { return api("/api/_trackers", { method: "POST", body: JSON.stringify(body) }); }

  function load() {
    return Promise.all([
      api("/api/_trackers"),
      RS.load("sales_tracker_eval").catch(function () { return []; }),
      RS.load("sales_call_score").catch(function () { return []; }),
      RS.salesTeam(),   // the roster, for the Former reps line (cached, never throws)
    ]).then(function (r) {
      var rows = function (x) { return (x && (x.rows || x)) || []; };
      D = { meta: r[0], calls: {}, lead: {}, ev: {}, marks: r[0].marks || {} };
      var calls = rows(r[2]);
      calls.forEach(function (c) { c._day = nyDay(c.Started); D.calls[c["Record Id"]] = c; });
      // every lead's conversations, sales vs support. A call the mart stages "not a
      // conversation" (voicemail, a ring with no talk) is not one.
      calls.forEach(function (c) {
        var job = c["Job No"];
        if (!job || c.Stage === "not a conversation") return;
        var l = D.lead[job] = D.lead[job] || { sales: 0, support: 0 };
        if (isSupport(c)) l.support++; else l.sales++;
      });
      rows(r[1]).forEach(function (e) {
        (D.ev[e["Tracker Key"]] = D.ev[e["Tracker Key"]] || []).push(e);
      });
      D.trackers = (r[0].trackers || []).filter(function (t) { return t.mode !== "ai"; });
      D.byKey = {};
      D.trackers.forEach(function (t) { D.byKey[t.key] = t; });
      D.canEdit = !!r[0].can_edit;
    });
  }

  /* ------------------------------------------------------------------ filters */

  var PF = [
    ["direction", "Direction", function (c) { return dirWord(c.Direction); }],
    ["source", "Lead source", function (c) { return c.Source || "No source"; }],
    ["first", "Call", function (c) {
      return c.Stage !== "quote call" ? "Not a quote call"
        : (+c["First Contact"] && +c.Linked ? "First call with the lead" : "Follow-up");
    }],
    ["rep", "Rep", function (c) { return handledBy(c); }],
  ];
  /* Is this call kept by the bar? `noRep` leaves the Rep pick out: the TEAM a rep is measured
     against is everyone the other filters keep, so picking two reps never makes the two of
     them "the team". */
  function keep(c, noRep) {
    if (!c) return false;
    if (ST.handled === "reps" && isSupport(c)) return false;
    if (ST.handled === "support" && !isSupport(c)) return false;
    for (var i = 0; i < PF.length; i++) {
      var k = PF[i][0], set = ST.pf[k];
      if (noRep && k === "rep") continue;
      if (set.size && !set.has(PF[i][2](c))) return false;
    }
    return true;
  }
  function filterSig() {
    return JSON.stringify([ST.from, ST.to, ST.handled, PF.map(function (p) { return [...ST.pf[p[0]]].sort(); })]);
  }

  function mountBar(host) {
    var bar = document.createElement("div");
    bar.className = "stx-bar";
    host.appendChild(bar);
    var fld = function (label) {
      var w = document.createElement("div");
      w.className = "rs-fld";
      w.innerHTML = "<span>" + esc(label) + "</span>";
      bar.appendChild(w);
      return w;
    };
    RSC.dateRange(fld("Period"), {
      presets: presets(),
      get: function () { return { from: ST.from, to: ST.to }; },
      set: function (f, t) { ST.from = f || null; ST.to = t || null; },
      onChange: function () { ST.shown = PAGE_CALLS; paint(); },
    });
    var pr = prevRange();
    var cmp = document.createElement("span");
    cmp.className = "stx-cmp";
    cmp.textContent = pr ? "compared with " + fmtDay(pr.from) + " – " + fmtDay(pr.to) : "no comparison for all time";
    bar.appendChild(cmp);
    RSC.localSelect(bar, {
      label: "Handled by", required: true, value: ST.handled,
      values: [{ v: "reps", l: "Sales reps" }, { v: "support", l: "Support team" }, { v: "all", l: "Everyone" }],
      onChange: function (v) { ST.handled = v || "reps"; ST.sel.rep = ""; ST.shown = PAGE_CALLS; paint(); },
    });
    var sp = document.createElement("span");
    sp.className = "rs-spacer";
    bar.appendChild(sp);
    // the panel's values: what the calls in the period actually carry, the commonest first
    var r = curRange();
    var fields = PF.map(function (p) {
      var g = {};
      Object.keys(D.calls).forEach(function (rid) {
        var c = D.calls[rid];
        if (c.Stage !== "quote call" && c.Stage !== "not a quote call") return;
        if (!inRange(c._day, r)) return;
        var v = p[2](c);
        if (v && v !== "—") g[v] = (g[v] || 0) + 1;
      });
      var vals = Object.keys(g).sort(function (a, b) { return g[b] - g[a]; })
        .map(function (v) { return { v: v, l: v, n: g[v] }; });
      if (p[0] === "rep") vals = RSC.repOptions(vals);
      return { key: p[0], label: p[1], values: vals };
    });
    var selected = {};
    PF.forEach(function (p) { selected[p[0]] = ST.pf[p[0]]; });
    var apply = function (next) {
      PF.forEach(function (p) { ST.pf[p[0]] = new Set(next[p[0]] || []); });
      ST.shown = PAGE_CALLS;
      paint();
    };
    RSC.filterPanel(bar, {
      fields: fields, selected: selected, onApply: apply,
      note: "Every number follows these filters. <b>Team</b> means every rep's calls the other "
        + "filters keep: picking reps narrows the rows, never the team they are compared with. "
        + "A tracker's own scope still applies on top (How they found us checks inbound calls "
        + "only). Days are New York days.",
    });
    host.appendChild(RSC.filterChips(null, { fields: fields, selected: selected, onChange: apply }));
  }

  /* ------------------------------------------------------------------ health */

  // is a tracker measuring what its name says? (the redesign's three rules) -- asked many
  // times a paint, so kept until its marks or verdicts change
  var HCACHE = {};
  function health(t) {
    var ck = t.key + ":" + (D.markVer || 0) + ":" + (D.ev[t.key] || []).length;
    if (HCACHE[ck]) return HCACHE[ck];
    return (HCACHE[ck] = healthOf(t));
  }
  function healthOf(t) {
    var m = D.marks[t.key] || {};
    var right = 0, wrong = 0;
    Object.keys(m).forEach(function (rid) { if (m[rid] === "right") right++; else if (m[rid] === "wrong") wrong++; });
    var read = right + wrong;
    var said = { rep: 0, customer: 0, both: 0 };
    (D.ev[t.key] || []).forEach(function (e) {
      if (e.Result === "Mentioned" && said[e["Said By"]] != null) said[e["Said By"]]++;
    });
    var known = said.rep + said.customer + said.both;
    var repShare = known ? (said.rep + said.both) / known : null;
    var who = (t.rules || {}).who;
    var whoFails = !who && known >= 20 && repShare < PASS_SHARE;
    var out = { read: read, right: right, said: said, known: known, repShare: repShare };
    if (read >= READ_TARGET && right / read < PASS_SHARE) {
      return Object.assign(out, { k: "off", badge: "Not measuring it",
        why: right + " of " + read + " hits read were what the name says. Off the scorecard until it is fixed." });
    }
    if (read >= READ_TARGET && !whoFails) {
      return Object.assign(out, { k: "ok", badge: "Reliable",
        why: right + " of " + read + " hits read were right"
          + (who ? ", and only the " + who + "'s lines count." : (known ? "; the rep says it in " + Math.round(100 * repShare) + "% of hits." : ".")) });
    }
    if (whoFails) {
      return Object.assign(out, { k: "check", badge: "Check who says it",
        why: "The customer says the phrases in " + Math.round(100 * (1 - repShare)) + "% of hits. Count the rep's lines only, in the builder." });
    }
    return Object.assign(out, { k: "check", badge: "Not checked yet",
      why: read + " of " + READ_TARGET + " hits read. Read " + (READ_TARGET - read) + " more to call it."
        + (known ? " The rep says it in " + Math.round(100 * repShare) + "% of hits." : "") });
  }
  function onBoard(t) { return t.active && health(t).k !== "off"; }

  function scopeWords(t) {
    var sc = t.scope || {}, ru = t.rules || {}, bits = [];
    bits.push(sc.direction === "inbound" ? "Inbound calls" : sc.direction === "outbound" ? "Outbound calls" : "Inbound and outbound calls");
    if (sc.quote_only) bits.push("quote calls only");
    if (sc.first_contact_only) bits.push("first call with each lead");
    if (sc.min_seconds) bits.push("≥ " + sc.min_seconds + "s");
    if (sc.date_from) bits.push("from " + sc.date_from);
    if (sc.include_shared) bits.push("support line included");
    if (ru.who) bits.push("the " + ru.who + "'s lines only");
    if (ru.trigger) bits.push("after the customer says “" + ru.trigger.split(", ")[0] + "”" + (ru.trigger.indexOf(",") > 0 ? " or similar" : ""));
    if (ru.ignore) bits.push("ignores " + ru.ignore.split(", ").length + " phrase" + (ru.ignore.indexOf(",") > 0 ? "s" : ""));
    return bits.join(" · ");
  }
  function question(t) { return t.question || t.name; }

  /* ------------------------------------------------------------------ the numbers */

  function z() { return { h: 0, n: 0 }; }
  function add(o, hit) { o.n++; o.h += hit; }
  function rate(o) { return o && o.n ? Math.round(100 * o.h / o.n) : null; }

  var AGG = { sig: "", byKey: {} };
  /* One pass over a tracker's verdicts: the team and every rep (or the support team), this
     period and the one before, and the eight weeks. Cached per filter state. */
  function agg(t) {
    var sig = filterSig();
    if (AGG.sig !== sig) AGG = { sig: sig, byKey: {} };
    if (AGG.byKey[t.key]) return AGG.byKey[t.key];
    var cur = curRange(), prev = prevRange(), weeks = weekList(), wset = {};
    weeks.forEach(function (w) { wset[w] = true; });
    var A = { team: z(), teamPrev: z(), rep: {}, repPrev: {}, wk: {}, teamWk: {}, calls: {}, na: 0 };
    (D.ev[t.key] || []).forEach(function (e) {
      var res = e.Result;
      var c = D.calls[e["Record Id"]];
      if (!c || !keep(c, true)) return;
      var who = isSupport(c) ? SUPPORT : (c.Rep || "—");
      var kRep = keep(c, false), d = c._day;
      if (res === "Not Applicable") { if (inRange(d, cur)) A.na++; return; }
      if (res !== "Mentioned" && res !== "Not Mentioned") return;
      var hit = res === "Mentioned" ? 1 : 0;
      if (inRange(d, cur)) {
        add(A.team, hit);
        if (kRep) add(A.rep[who] = A.rep[who] || z(), hit);
      } else if (prev && inRange(d, prev)) {
        add(A.teamPrev, hit);
        if (kRep) add(A.repPrev[who] = A.repPrev[who] || z(), hit);
      }
      var w = weekOf(d);
      if (wset[w]) {
        add(A.teamWk[w] = A.teamWk[w] || z(), hit);
        var rw = A.wk[who] = A.wk[who] || {};
        add(rw[w] = rw[w] || z(), hit);
      }
    });
    AGG.byKey[t.key] = A;
    return A;
  }
  function tone(r, team, n) {
    if (r == null || n < MIN_CALLS) return "few";
    if (team == null || r >= team) return "good";
    return r >= team - 5 ? "near" : "low";
  }
  function arrow(now, prev) {
    if (!prev || prev.n < MIN_CALLS || now == null) return "";
    var d = now - rate(prev);
    return Math.abs(d) < MOVE ? "" : (d > 0 ? "▲ " : "▼ ") + Math.abs(d);
  }

  /* ------------------------------------------------------------------ shell */

  function render(host) {
    injectStyle();
    HOST = host;
    if (window.__navRequested === "sales-comms") { ST.view = "checks"; window.__navRequested = null; }
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Reading the trackers…</div>';
    load().then(function () {
      if (!ST.inited) {
        var p = presets()[1];                        // Last 30 days
        ST.from = p[1]; ST.to = p[2]; ST.inited = true;
      }
      paint();
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the trackers — ' + esc(e.message) + "</div>";
    });
  }
  var HOST = null;

  var VIEWS = [["scorecard", "Scorecard"], ["one", "One rep"], ["checks", "Script checks"],
               ["trackers", "Trackers"], ["builder", "New tracker"]];

  function paint() {
    var host = HOST;
    if (!host || !D) return;
    if (ST.view === "builder" && !D.canEdit) ST.view = "trackers";
    var nav = VIEWS.filter(function (v) { return v[0] !== "builder" || D.canEdit; }).map(function (v) {
      var on = ST.view === v[0] || (v[0] === "checks" && ST.view === "comms");
      var label = v[0] === "builder" && ST.edit && !ST.edit.isNew ? "Edit tracker" : v[1];
      return '<button type="button" class="' + (on ? "on" : "") + '" data-view="' + v[0] + '">' + esc(label) + "</button>";
    }).join("");
    var SUB = {
      scorecard: "What each rep said on their calls, against the team. Click any cell for the weeks and the calls to coach on.",
      one: "Every tracker and every script check for one rep, next to the team. Built for a 1:1: the biggest gaps come first.",
      checks: "The house script, checked on every quote call: what was said, never how well. Each check counts only the calls it applies to.",
      comms: "The full Communication Analysis table, as it was. Back to Script checks for the period filter.",
      trackers: "Every tracker, and whether it measures what its name says.",
      builder: "Say what should happen on the call, in steps. Test it on real calls before it goes on the scorecard. Keyword matching: free, no AI.",
    };
    host.innerHTML = '<div class="stx">'
      + '<div class="stx-head"><div><div class="stx-eyebrow">Sales · call quality</div>'
      + "<h1>Sales Trackers</h1><p>" + esc(SUB[ST.view] || "") + "</p></div>"
      + '<nav class="stx-nav" aria-label="Views">' + nav + "</nav></div>"
      + '<div id="stxBar"></div><div id="stxBody"></div></div>';
    host.querySelectorAll("[data-view]").forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute("data-view");
        if (v === "builder" && ST.view !== "builder") { ST.edit = blankTracker(); ST.test = null; }
        ST.view = v;
        paint();
      };
    });
    if (ST.view !== "builder" && ST.view !== "comms") mountBar(host.querySelector("#stxBar"));
    var body = host.querySelector("#stxBody");
    if (ST.view === "one") paintOne(body);
    else if (ST.view === "checks") paintChecks(body);
    else if (ST.view === "comms") paintComms(body);
    else if (ST.view === "trackers") paintTrackers(body);
    else if (ST.view === "builder") paintBuilder(body);
    else paintScorecard(body);
  }

  /* ------------------------------------------------------------------ scorecard */

  function liveTrackers() { return D.trackers.filter(function (t) { return t.active; }); }

  function paintScorecard(body) {
    var live = liveTrackers();
    if (!live.length) {
      body.innerHTML = '<div class="panel"><p class="stx-note">No trackers yet. '
        + (D.canEdit ? "Create the first one under <b>New tracker</b>." : "The Sales Head has not created any yet.") + "</p></div>";
      return;
    }
    var board = live.filter(onBoard), off = live.filter(function (t) { return !onBoard(t); });
    if (!ST.sel.trk || !D.byKey[ST.sel.trk] || !D.byKey[ST.sel.trk].active) ST.sel = { rep: "", trk: (board[0] || live[0]).key };

    var tiles = board.concat(off).map(function (t) {
      var A = agg(t), hl = health(t), r = rate(A.team);
      var mv = arrow(r, A.teamPrev);
      var isOff = hl.k === "off";
      return '<button type="button" class="stx-tile' + (isOff ? " off" : "") + (ST.sel.trk === t.key && !ST.sel.rep ? " on" : "")
        + '" data-tile="' + esc(t.key) + '">'
        + (t.question ? '<span class="stx-tile-n">' + esc(t.name) + "</span>" : "")
        + '<span class="stx-tile-q">' + esc(question(t)) + "</span>"
        + '<span class="stx-tile-v"><b>' + (r == null ? "—" : r + "%") + "</b>"
        + '<i class="' + (mv.charAt(0) === "▲" ? "up" : mv ? "down" : "") + '">'
        + esc(mv ? mv + " pts" : (A.teamPrev.n >= MIN_CALLS ? "no change" : (prevRange() ? "nothing to compare" : ""))) + "</i></span>"
        + '<span class="stx-tile-s">' + int(A.team.n) + " calls · " + esc(scopeWords(t)) + "</span>"
        + '<span class="stx-badge ' + hl.k + '">' + esc(hl.badge) + "</span>"
        + '<span class="stx-tile-why">' + esc(hl.why) + "</span></button>";
    }).join("");

    // the rows: everyone with a checked call this period on a tracker on the board
    var repCalls = {}, support = 0;
    board.forEach(function (t) {
      (D.ev[t.key] || []).forEach(function (e) {
        var c = D.calls[e["Record Id"]];
        if (!c || !keep(c, false) || !inRange(c._day, curRange())) return;
        if (e.Result !== "Mentioned" && e.Result !== "Not Mentioned") return;
        if (isSupport(c)) { support = 1; return; }
        var s = repCalls[c.Rep] = repCalls[c.Rep] || {};
        s[e["Record Id"]] = 1;
      });
    });
    var reps = Object.keys(repCalls).sort(function (a, b) {
      return Object.keys(repCalls[b]).length - Object.keys(repCalls[a]).length;
    });
    var cell = function (who, t) {
      var A = agg(t), o = A.rep[who] || z(), r = rate(o), teamR = rate(A.team);
      var tn = tone(r, teamR, o.n);
      var picked = ST.sel.rep === who && ST.sel.trk === t.key;
      return '<td><button type="button" class="stx-cell ' + tn + (picked ? " on" : "") + '" data-cell="' + esc(t.key)
        + '" data-who="' + esc(who) + '" aria-label="' + esc(repLabel(who) + ", " + t.name + ": " + (r == null ? "no calls" : r + "% of " + o.n + " calls")) + '">'
        + (o.n ? (tn === "few" ? "few" : r + "%") : "—")
        + "<i>" + esc(o.n ? (tn === "few" ? o.n + " calls" : arrow(r, A.repPrev[who])) : "") + "</i></button></td>";
    };
    var rowOf = function (who, a) {
      var n = who === SUPPORT ? null : Object.keys(repCalls[who] || {}).length;
      return "<tr" + a + '><th scope="row">' + esc(repLabel(who))
        + '<span>' + (who === SUPPORT ? "shared support line" : int(n) + " calls") + "</span></th>"
        + board.map(function (t) { return cell(who, t); }).join("") + "</tr>";
    };
    var rows = RSC.repRows(reps, function (r) { return r; }, rowOf, {
      id: "stx-matrix", cols: board.length + 1,
      mid: support ? rowOf(SUPPORT, "") : "",
      open: !!ST.sel.rep && ST.sel.rep !== SUPPORT && !!RS.repKind && RS.repKind(ST.sel.rep) !== "active",
    });
    var teamRow = "<tr class=\"stx-teamrow\"><th scope=\"row\">Team<span>" + esc(ST.handled === "support" ? "support line" : ST.handled === "all" ? "everyone" : "all sales reps") + "</span></th>"
      + board.map(function (t) {
        var A = agg(t), r = rate(A.team);
        return '<td><button type="button" class="stx-cell team' + (ST.sel.rep === "" && ST.sel.trk === t.key ? " on" : "")
          + '" data-cell="' + esc(t.key) + '" data-who="">' + (r == null ? "—" : r + "%") + "<i>" + esc(arrow(r, A.teamPrev)) + "</i></button></td>";
      }).join("") + "</tr>";

    var nt = board.length + off.length, per = Math.ceil(nt / Math.ceil(nt / 6));
    body.innerHTML = '<div class="stx-tiles" style="--stx-n:' + per + '">' + tiles + "</div>"
      + '<section class="panel stx-panel"><div class="stx-ph"><h2>Rep by tracker</h2>'
      + "<span>" + esc(rangeLabel(curRange())) + " · sorted by calls · rates only, no ranking</span></div>"
      + (board.length
         ? '<div class="rs-tablewrap"><table class="stx-matrix"><thead><tr><th></th>'
           + board.map(function (t) {
             var hl = health(t);
             return '<th scope="col">' + esc(t.name) + '<span class="' + hl.k + '">' + esc(hl.k === "ok" ? "reliable" : hl.badge.toLowerCase()) + "</span></th>";
           }).join("") + "</tr></thead><tbody>" + rows + "</tbody><tfoot>" + teamRow + "</tfoot></table></div>"
         : '<p class="stx-note">Every tracker is off the scorecard: none measures what its name says yet. See <b>Trackers</b>.</p>')
      + legend()
      + (off.length ? '<p class="stx-note">Off the scorecard: ' + off.map(function (t) { return "<b>" + esc(t.name) + "</b>"; }).join(", ")
        + " — not measuring what the name says. Fix it in the builder; the tiles above still show its numbers.</p>" : "")
      + "</section>"
      + '<div id="stxDetail"></div>';

    body.querySelectorAll("[data-tile]").forEach(function (b) {
      b.onclick = function () { ST.sel = { rep: "", trk: b.getAttribute("data-tile") }; ST.shown = PAGE_CALLS; paint(); scrollDetail(); };
    });
    body.querySelectorAll("[data-cell]").forEach(function (b) {
      b.onclick = function () {
        ST.sel = { rep: b.getAttribute("data-who"), trk: b.getAttribute("data-cell") };
        ST.shown = PAGE_CALLS;
        paint();
        scrollDetail();
      };
    });
    paintDetail(body.querySelector("#stxDetail"));
  }
  function scrollDetail() {
    var d = HOST && HOST.querySelector("#stxDetail");
    if (d && d.scrollIntoView) d.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function legend() {
    return '<div class="stx-legend">'
      + '<span><i class="good"></i>At or above the team</span>'
      + '<span><i class="near"></i>Up to 5 points below</span>'
      + '<span><i class="low"></i>More than 5 points below</span>'
      + '<span><i class="few"></i>Under ' + MIN_CALLS + " calls: no rate</span>"
      + "<span>▲▼ moved " + MOVE + "+ points against the previous period</span></div>";
  }

  /* the open cell: the rate, the weeks, and the calls */
  function paintDetail(el) {
    var t = D.byKey[ST.sel.trk];
    if (!el || !t) return;
    var who = ST.sel.rep, A = agg(t), hl = health(t);
    var o = who ? (A.rep[who] || z()) : A.team, op = who ? A.repPrev[who] : A.teamPrev;
    var r = rate(o), teamR = rate(A.team), tn = who ? tone(r, teamR, o.n) : (o.n < MIN_CALLS ? "few" : "good");
    if (hl.k === "off") tn = "off";
    var verdict = !o.n ? "No checked calls in this period"
      : tn === "few" ? "Under " + MIN_CALLS + " calls: no rate yet"
      : tn === "off" ? "Not measuring what its name says"
      : !who ? "The team, " + rangeLabel(curRange())
      : tn === "good" ? "At or above the team" : tn === "near" ? "Within 5 points of the team"
      : (teamR - r) + " points below the team";
    var weeks = weekList(), wk = who ? (A.wk[who] || {}) : A.teamWk;
    var bars = weeks.map(function (w) {
      var x = wk[w], v = rate(x), tm = rate(A.teamWk[w]);
      return '<div class="stx-wk"><b>' + (v == null ? "—" : v + "%") + '</b><div class="stx-wkbox">'
        + '<i class="' + (x && x.n < 5 ? "thin " : "") + tn + '" style="height:' + (v == null ? 0 : Math.max(3, Math.round(v * 1.2))) + 'px"></i>'
        + (who && tm != null ? '<u style="bottom:' + Math.round(tm * 1.2) + 'px"></u>' : "")
        + "</div><span>" + esc(fmtDay(w)) + "</span></div>";
    }).join("");
    var trig = !!(t.rules || {}).trigger;
    el.innerHTML = '<section class="panel stx-panel stx-detail">'
      + '<div class="stx-dgrid"><div class="stx-dmain">'
      + '<div class="stx-eyebrow">' + esc(repLabel(who)) + "</div>"
      + "<h2>" + esc(question(t)) + "</h2>"
      + '<div class="stx-sub">' + esc(t.name + " · " + scopeWords(t)) + "</div>"
      + '<div class="stx-bigrow"><span class="stx-big ' + tn + '">' + (r == null ? "—" : r + "%") + "</span>"
      + "<div><b>" + esc(verdict) + "</b><span>of " + int(o.n) + " calls" + (trig && A.na ? " where the customer said it · " + int(A.na) + " calls it did not apply to" : "") + "</span></div></div>"
      + '<div class="stx-boxes">'
      + (who ? '<div><span>Team</span><b>' + (teamR == null ? "—" : teamR + "%") + "</b><i>" + int(A.team.n) + " calls</i></div>" : "")
      + "<div><span>Previous period</span><b>" + (op && op.n ? rate(op) + "%" : "—") + "</b><i>"
      + esc(!prevRange() ? "all time has none" : !op || !op.n ? "no calls" : op.n < MIN_CALLS ? "only " + op.n + " calls: too few" : int(op.n) + " calls") + "</i></div></div>"
      + '<div class="stx-health ' + hl.k + '"><span class="stx-badge ' + hl.k + '">' + esc(hl.badge) + "</span>" + esc(hl.why) + "</div>"
      + "</div>"
      + '<div class="stx-dweeks"><div class="stx-ph"><h3>Week by week</h3><span>' + (who ? "bar = " + esc(repLabel(who)) + " · dashed line = team · " : "") + "pale = under 5 calls</span></div>"
      + '<div class="stx-wks">' + bars + "</div></div></div>"
      + '<div id="stxCalls"></div></section>';
    paintCallList(el.querySelector("#stxCalls"), t, who);
  }

  function callList(t, who) {
    var cur = curRange();
    return (D.ev[t.key] || []).filter(function (e) {
      var c = D.calls[e["Record Id"]];
      return c && inRange(c._day, cur) && (who ? keep(c, true) && pickedRep(c, who) : keep(c, false));
    }).sort(function (a, b) {
      return String((D.calls[b["Record Id"]] || {}).Started || "").localeCompare(String((D.calls[a["Record Id"]] || {}).Started || ""));
    });
  }
  function paintCallList(el, t, who) {
    var all = callList(t, who);
    var cnt = { miss: 0, hit: 0, na: 0 };
    all.forEach(function (e) {
      if (e.Result === "Mentioned") cnt.hit++; else if (e.Result === "Not Mentioned") cnt.miss++; else if (e.Result === "Not Applicable") cnt.na++;
    });
    var want = ST.verdict;
    var list = all.filter(function (e) {
      return want === "all" ? e.Result !== "Not Applicable"
        : want === "hit" ? e.Result === "Mentioned"
        : want === "na" ? e.Result === "Not Applicable" : e.Result === "Not Mentioned";
    });
    var segs = [["miss", "Without it", cnt.miss], ["hit", "With it", cnt.hit], ["all", "All", cnt.miss + cnt.hit]];
    if (cnt.na) segs.push(["na", "Did not apply", cnt.na]);
    var shown = list.slice(0, ST.shown);
    var rows = shown.map(function (e) {
      var c = D.calls[e["Record Id"]] || {};
      var job = c["Job No"], l = job && D.lead[job];
      var talks = !l ? "—" : (l.sales + l.support) + '<span class="stx-dim">' + (l.support ? l.sales + " sales · " + l.support + " support" : "all sales") + "</span>";
      return "<tr><td>" + esc(fmtWhen(c.Started)) + "</td>"
        + "<td>" + esc(c.Customer || "—") + "</td>"
        + (who ? "" : "<td>" + esc(handledBy(c)) + "</td>")
        + "<td>" + (c.Assigned ? esc(c.Assigned) : '<span class="stx-dim">' + (job ? "no rep on the lead" : "not linked to a lead") + "</span>") + "</td>"
        + "<td>" + esc(dirWord(c.Direction)) + "</td>"
        + '<td class="num">' + Math.round((+c["Duration Sec"] || 0) / 60) + " min</td>"
        + '<td class="num">' + talks + "</td>"
        + '<td><span class="stx-heard">' + esc(e.Explanation || (e.Result === "Not Mentioned" ? "none of the phrases" : "")) + "</span></td>"
        + '<td><button type="button" class="rs-btn stx-open" data-rec="' + esc(e["Record Id"]) + '" data-seqs="' + esc(e["Evidence Seqs"] || "") + '">Transcript</button></td></tr>';
    }).join("");
    el.innerHTML = '<div class="stx-ph"><h3>Calls</h3><div class="stx-seg" role="group" aria-label="Which calls">'
      + segs.map(function (s) {
        return '<button type="button" class="' + (want === s[0] ? "on" : "") + '" data-v="' + s[0] + '" aria-pressed="' + (want === s[0]) + '">' + esc(s[1]) + " <i>" + int(s[2]) + "</i></button>";
      }).join("") + "</div></div>"
      + (list.length
         ? '<div class="rs-tablewrap"><table class="rs-table stx-calls"><thead><tr><th>When</th><th>Customer</th>'
           + (who ? "" : "<th>Handled by</th>") + "<th>Assigned to</th><th>Direction</th>"
           + '<th class="num">Length</th><th class="num">Customer\'s calls</th><th>Heard</th><th></th></tr></thead><tbody>'
           + rows + "</tbody></table></div>"
           + '<div class="stx-more"><span class="stx-dim">Showing ' + int(shown.length) + " of " + int(list.length) + ", newest first</span>"
           + (list.length > shown.length ? '<button type="button" class="rs-btn" id="stxMore">Show ' + Math.min(PAGE_CALLS, list.length - shown.length) + " more</button>" : "") + "</div>"
         : '<p class="stx-note">No call in this list for the period and filters.</p>')
      + '<p class="rs-hint"><b>Handled by</b> is who took the call: a rep, or the <b>Support team</b>, whose three people share one line. '
      + "<b>Assigned to</b> is whose client it is, from the lead the customer's number links to. <b>Customer's calls</b> counts every "
      + "conversation with that lead, split into sales and support. A call from the last day often shows <i>not linked to a lead</i> "
      + "until the next morning's lead export (daily, 06:20 New York).</p>";
    el.querySelectorAll("[data-v]").forEach(function (b) {
      b.onclick = function () { ST.verdict = b.getAttribute("data-v"); ST.shown = PAGE_CALLS; paintCallList(el, t, who); };
    });
    var more = el.querySelector("#stxMore");
    if (more) more.onclick = function () { ST.shown += PAGE_CALLS; paintCallList(el, t, who); };
    el.querySelectorAll("[data-rec]").forEach(function (b) {
      b.onclick = function () { openCall(b.getAttribute("data-rec"), b.getAttribute("data-seqs"), t.name); };
    });
  }

  /* ------------------------------------------------------------------ script checks */

  var CAGG = { sig: "", v: null };
  function checkCalls(range, noRep) {
    return Object.keys(D.calls).map(function (rid) { return D.calls[rid]; }).filter(function (c) {
      // the rubric scores sales reps' quote calls; the support line is never scored
      return c.Stage === "quote call" && !isSupport(c) && keep(c, noRep) && inRange(c._day, range);
    });
  }
  function checkAgg() {
    var sig = filterSig();
    if (CAGG.sig === sig) return CAGG.v;
    var cur = curRange(), prev = prevRange();
    var V = { team: {}, teamPrev: {}, rep: {}, repPrev: {}, calls: {} };
    var tally = function (rows, team, per) {
      rows.forEach(function (c) {
        var kr = keep(c, false);
        if (per === V.rep && kr) V.calls[c.Rep] = (V.calls[c.Rep] || 0) + 1;
        CHECKS.forEach(function (k) {
          var v = c[k[0]];
          if (v == null || v === "") return;
          add(team[k[0]] = team[k[0]] || z(), +v ? 1 : 0);
          if (kr) { var pr = per[c.Rep] = per[c.Rep] || {}; add(pr[k[0]] = pr[k[0]] || z(), +v ? 1 : 0); }
        });
      });
    };
    tally(checkCalls(cur, true), V.team, V.rep);
    if (prev) tally(checkCalls(prev, true), V.teamPrev, V.repPrev);
    CAGG = { sig: sig, v: V };
    return V;
  }

  function paintChecks(body) {
    if (ST.handled === "support") {
      body.innerHTML = '<div class="panel"><p class="stx-note">The script checks score sales reps only: the support line is a queue three people share, '
        + "and 99% of its calls come after the booking. Switch <b>Handled by</b> back to sales reps.</p></div>";
      return;
    }
    var V = checkAgg();
    var reps = Object.keys(V.calls).sort(function (a, b) { return V.calls[b] - V.calls[a]; });
    var head1 = "<tr><th></th>" + GROUPS.map(function (g) {
      return '<th class="grp" colspan="' + CHECKS.filter(function (k) { return k[3] === g; }).length + '">' + esc(g) + "</th>";
    }).join("") + "</tr>";
    var head2 = "<tr><th></th>" + CHECKS.map(function (k) { return '<th scope="col" title="' + esc(k[2]) + '">' + esc(k[1]) + "</th>"; }).join("") + "</tr>";
    var cell = function (rep, k) {
      var o = ((V.rep[rep] || {})[k[0]]) || z(), r = rate(o), tr = rate(V.team[k[0]]);
      var tn = tone(r, tr, o.n), picked = ST.chk.rep === rep && ST.chk.id === k[0];
      return '<td><button type="button" class="stx-cell sm ' + tn + (picked ? " on" : "") + '" data-chk="' + k[0] + '" data-who="' + esc(rep)
        + '" aria-label="' + esc(rep + ", " + k[2] + ": " + (r == null ? "no calls" : r + "% of " + o.n)) + '">'
        + (o.n ? (tn === "few" ? "few" : r + "%") : "—") + "<i>" + esc(o.n && tn !== "few" ? arrow(r, ((V.repPrev[rep] || {})[k[0]])) : "") + "</i></button></td>";
    };
    var rowOf = function (rep, a) {
      return "<tr" + a + '><th scope="row">' + esc(rep) + "<span>" + int(V.calls[rep]) + " quote calls</span></th>"
        + CHECKS.map(function (k) { return cell(rep, k); }).join("") + "</tr>";
    };
    var teamRow = '<tr class="stx-teamrow"><th scope="row">Team<span>all sales reps</span></th>' + CHECKS.map(function (k) {
      var r = rate(V.team[k[0]]);
      return '<td><button type="button" class="stx-cell sm team' + (ST.chk.rep === "" && ST.chk.id === k[0] ? " on" : "") + '" data-chk="' + k[0] + '" data-who="">'
        + (r == null ? "—" : r + "%") + "<i>" + esc(arrow(r, V.teamPrev[k[0]])) + "</i></button></td>";
    }).join("") + "</tr>";
    body.innerHTML = '<section class="panel stx-panel"><div class="stx-ph"><h2>Rep by script check</h2>'
      + "<span>" + esc(rangeLabel(curRange())) + " · quote calls · rates only, no ranking</span></div>"
      + (reps.length
         ? '<div class="rs-tablewrap"><table class="stx-matrix wide"><thead>' + head1 + head2 + "</thead><tbody>"
           + RSC.repRows(reps, function (r) { return r; }, rowOf, { id: "stx-checks", cols: CHECKS.length + 1,
               open: !!ST.chk.rep && !!RS.repKind && RS.repKind(ST.chk.rep) !== "active" })
           + "</tbody><tfoot>" + teamRow + "</tfoot></table></div>"
         : '<p class="stx-note">No scored quote call in this period and these filters.</p>')
      + legend()
      + '<p class="rs-hint">A check records that a thing was <b>said</b>, never how well. Each column counts only the calls it applies to: '
      + "<b>Good time?</b> outbound first calls, the discovery checks first calls, the deposit checks calls where a price was said. "
      + 'There is deliberately no booked rate here: early calls convert less, so asking good questions would look like it loses deals. '
      + '<button type="button" class="stx-linkbtn" id="stxOldComms">Open the full Communication Analysis table</button></p>'
      + "</section><div id=\"stxDetail\"></div>";
    body.querySelectorAll("[data-chk]").forEach(function (b) {
      b.onclick = function () {
        ST.chk = { rep: b.getAttribute("data-who"), id: b.getAttribute("data-chk") };
        ST.shown = PAGE_CALLS;
        paint();
        scrollDetail();
      };
    });
    body.querySelector("#stxOldComms").onclick = function () { ST.view = "comms"; paint(); };
    if (ST.chk.id) paintCheckDetail(body.querySelector("#stxDetail"), V);
  }

  function paintCheckDetail(el, V) {
    var k = CHECKS.filter(function (x) { return x[0] === ST.chk.id; })[0];
    if (!k) return;
    var who = ST.chk.rep;
    var o = who ? (((V.rep[who] || {})[k[0]]) || z()) : (V.team[k[0]] || z());
    var op = who ? ((V.repPrev[who] || {})[k[0]]) : V.teamPrev[k[0]];
    var r = rate(o), tr = rate(V.team[k[0]]), tn = who ? tone(r, tr, o.n) : (o.n < MIN_CALLS ? "few" : "good");
    var cur = curRange();
    var miss = checkCalls(cur, !!who).filter(function (c) {
      return (!who || c.Rep === who) && c[k[0]] != null && c[k[0]] !== "" && !+c[k[0]];
    }).sort(function (a, b) { return String(b.Started || "").localeCompare(String(a.Started || "")); });
    var shown = miss.slice(0, ST.shown);
    el.innerHTML = '<section class="panel stx-panel stx-detail"><div class="stx-dmain">'
      + '<div class="stx-eyebrow">' + esc(repLabel(who)) + " · " + esc(k[3]) + "</div><h2>" + esc(k[2]) + "</h2>"
      + '<div class="stx-bigrow"><span class="stx-big ' + tn + '">' + (r == null ? "—" : r + "%") + "</span><div><b>"
      + esc(!o.n ? "No calls it applies to" : tn === "few" ? "Under " + MIN_CALLS + " calls: no rate yet" : !who ? "The team, " + rangeLabel(cur)
            : tn === "good" ? "At or above the team" : tn === "near" ? "Within 5 points of the team" : (tr - r) + " points below the team")
      + "</b><span>of " + int(o.n) + " calls it applies to</span></div></div>"
      + '<div class="stx-boxes">' + (who ? "<div><span>Team</span><b>" + (tr == null ? "—" : tr + "%") + "</b></div>" : "")
      + "<div><span>Previous period</span><b>" + (op && op.n ? rate(op) + "%" : "—") + "</b><i>" + esc(op && op.n ? int(op.n) + " calls" : "") + "</i></div></div></div>"
      + '<div class="stx-ph"><h3>Calls where it was not said · ' + int(miss.length) + "</h3></div>"
      + (miss.length
         ? '<div class="rs-tablewrap"><table class="rs-table stx-calls"><thead><tr><th>When</th><th>Customer</th>' + (who ? "" : "<th>Rep</th>")
           + '<th>Assigned to</th><th>Direction</th><th class="num">Length</th><th></th></tr></thead><tbody>'
           + shown.map(function (c) {
             return "<tr><td>" + esc(fmtWhen(c.Started)) + "</td><td>" + esc(c.Customer || "—") + "</td>" + (who ? "" : "<td>" + esc(c.Rep || "—") + "</td>")
               + "<td>" + esc(c.Assigned || "—") + "</td><td>" + esc(dirWord(c.Direction)) + '</td><td class="num">' + Math.round((+c["Duration Sec"] || 0) / 60) + " min</td>"
               + '<td><button type="button" class="rs-btn" data-rec="' + esc(c["Record Id"]) + '">Transcript</button></td></tr>';
           }).join("") + "</tbody></table></div>"
           + '<div class="stx-more"><span class="stx-dim">Showing ' + int(shown.length) + " of " + int(miss.length) + ", newest first</span>"
           + (miss.length > shown.length ? '<button type="button" class="rs-btn" id="stxMore">Show ' + Math.min(PAGE_CALLS, miss.length - shown.length) + " more</button>" : "") + "</div>"
         : '<p class="stx-note">None in this period.</p>')
      + "</section>";
    var more = el.querySelector("#stxMore");
    if (more) more.onclick = function () { ST.shown += PAGE_CALLS; paintCheckDetail(el, V); };
    el.querySelectorAll("[data-rec]").forEach(function (b) {
      b.onclick = function () { openCall(b.getAttribute("data-rec"), "", k[1]); };
    });
  }

  // the old Communication Analysis page, rendered whole (its module still registers itself)
  function paintComms(body) {
    var back = document.createElement("p");
    back.innerHTML = '<button type="button" class="rs-btn" id="stxBackChecks">‹ Back to Script checks</button>';
    body.appendChild(back);
    back.querySelector("button").onclick = function () { ST.view = "checks"; paint(); };
    var box = document.createElement("div");
    body.appendChild(box);
    var comms = (window.PAGES || []).filter(function (p) { return p.id === "sales-comms"; })[0];
    if (comms) comms.render(box);
    else box.innerHTML = '<div class="panel">Communication Analysis is not loaded on this portal.</div>';
  }

  /* ------------------------------------------------------------------ one rep */

  function paintOne(body) {
    var board = liveTrackers().filter(onBoard);
    var V = ST.handled === "support" ? null : checkAgg();
    // the reps with calls this period: tracker calls and scored quote calls alike
    var n = {};
    board.forEach(function (t) {
      var A = agg(t);
      Object.keys(A.rep).forEach(function (r) { n[r] = Math.max(n[r] || 0, A.rep[r].n); });
    });
    if (V) Object.keys(V.calls).forEach(function (r) { n[r] = Math.max(n[r] || 0, V.calls[r]); });
    var reps = Object.keys(n).filter(function (r) { return r !== SUPPORT; }).sort(function (a, b) { return n[b] - n[a]; });
    if (n[SUPPORT]) reps.push(SUPPORT);
    if (!reps.length) { body.innerHTML = '<div class="panel"><p class="stx-note">No calls in this period and these filters.</p></div>'; return; }
    if (reps.indexOf(ST.one) < 0) ST.one = reps[0];
    var me = ST.one;
    var opts = RSC.repOptions(reps.filter(function (r) { return r !== SUPPORT; }).map(function (r) { return { v: r, l: r, n: n[r] }; }));
    if (n[SUPPORT]) opts = opts.concat([{ div: "Support team" }, { v: SUPPORT, l: "Support team", n: n[SUPPORT] }]);

    var rowsT = board.map(function (t) {
      var A = agg(t), o = A.rep[me] || z(), r = rate(o), tr = rate(A.team);
      return { kind: "trk", key: t.key, label: question(t), sub: t.name + " · " + int(o.n) + " calls", v: r, n: o.n, team: tr, prev: A.repPrev[me] };
    });
    var rowsC = !V || me === SUPPORT ? [] : CHECKS.map(function (k) {
      var o = ((V.rep[me] || {})[k[0]]) || z();
      return { kind: "chk", key: k[0], group: k[3], label: k[2], sub: int(o.n) + " calls it applies to", v: rate(o), n: o.n, team: rate(V.team[k[0]]), prev: (V.repPrev[me] || {})[k[0]] };
    });
    var pool = rowsT.concat(rowsC).filter(function (x) { return x.n >= MIN_CALLS && x.v != null && x.team != null; });
    pool.sort(function (a, b) { return (a.v - a.team) - (b.v - b.team); });
    var gaps = pool.slice(0, 3), wins = pool.slice(-3).reverse().filter(function (x) { return x.v >= x.team; });
    var callout = function (x) {
      return '<li><span>' + esc(x.label) + "</span><b>" + x.v + "%</b><i>team " + x.team + "%</i></li>";
    };
    var line = function (x) {
      var tn = tone(x.v, x.team, x.n);
      var mv = arrow(x.v, x.prev);
      return '<button type="button" class="stx-dumb" data-kind="' + x.kind + '" data-key="' + esc(x.key) + '">'
        + '<span class="stx-dl"><b>' + esc(x.label) + "</b><i>" + esc(x.sub) + "</i></span>"
        + '<span class="stx-dv ' + tn + '">' + (x.n ? (tn === "few" ? "few" : x.v + "%") : "—") + "</span>"
        + '<span class="stx-dtrack"><i class="' + tn + '" style="width:' + (tn === "few" || x.v == null ? 0 : x.v) + '%"></i>'
        + (x.team != null ? '<u style="left:' + x.team + '%"></u>' : "") + "</span>"
        + '<span class="stx-dt">team ' + (x.team == null ? "—" : x.team + "%") + '<em class="' + (mv.charAt(0) === "▲" ? "up" : mv ? "down" : "") + '">' + esc(mv) + "</em></span></button>";
    };
    body.innerHTML = '<div class="stx-onepick" id="stxOnePick"></div>'
      + '<section class="stx-band"><div class="stx-band-me"><span>' + esc(me === SUPPORT ? "Team" : "Rep") + "</span><b>" + esc(repLabel(me)) + "</b><i>"
      + int(n[me]) + " calls checked · " + esc(rangeLabel(curRange())) + "</i></div>"
      + '<div><span class="coach">Coach first</span><ul>' + (gaps.length ? gaps.map(callout).join("") : "<li><span>Nothing with " + MIN_CALLS + "+ calls yet</span></li>") + "</ul></div>"
      + '<div><span class="good">Strengths</span><ul>' + (wins.length ? wins.map(callout).join("") : "<li><span>Nothing at or above the team yet</span></li>") + "</ul></div></section>"
      + '<div class="stx-two"><section class="panel stx-panel"><div class="stx-ph"><h2>Trackers</h2><span>bar = ' + esc(repLabel(me)) + " · black tick = team</span></div>"
      + (rowsT.length ? rowsT.map(line).join("") : '<p class="stx-note">No tracker is on the scorecard.</p>')
      + '<p class="rs-hint">Click a line to open its calls on the scorecard.</p></section>'
      + '<section class="panel stx-panel"><div class="stx-ph"><h2>Script checks</h2><span>Communication Analysis · each counts only the calls it applies to</span></div>'
      + (rowsC.length ? GROUPS.map(function (g) {
          return '<div class="stx-grp">' + esc(g) + "</div>" + rowsC.filter(function (x) { return x.group === g; }).map(line).join("");
        }).join("") : '<p class="stx-note">The script checks score sales reps only.</p>')
      + "</section></div>";
    RSC.localSelect(body.querySelector("#stxOnePick"), {
      label: "Rep", required: true, value: me, values: opts,
      onChange: function (v) { ST.one = v; paint(); },
    });
    body.querySelectorAll(".stx-dumb").forEach(function (b) {
      b.onclick = function () {
        if (b.getAttribute("data-kind") === "trk") { ST.view = "scorecard"; ST.sel = { rep: me, trk: b.getAttribute("data-key") }; }
        else { ST.view = "checks"; ST.chk = { rep: me, id: b.getAttribute("data-key") }; }
        ST.shown = PAGE_CALLS;
        paint();
        scrollDetail();
      };
    });
  }

  /* ------------------------------------------------------------------ trackers */

  function phraseShare(t) {
    var cur = curRange(), m = 0, by = {}, said = { rep: 0, customer: 0, both: 0 }, n = 0;
    (D.ev[t.key] || []).forEach(function (e) {
      var c = D.calls[e["Record Id"]];
      if (!c || !keep(c, false) || !inRange(c._day, cur)) return;
      if (e.Result === "Mentioned" || e.Result === "Not Mentioned") n++;
      if (e.Result !== "Mentioned") return;
      m++;
      if (said[e["Said By"]] != null) said[e["Said By"]]++;
      String(e.Explanation || "").replace(/"([^"]+)"/g, function (_, p) { by[p] = (by[p] || 0) + 1; return _; });
    });
    var top = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).slice(0, 2)
      .map(function (p) { return "“" + p + "” in " + pct(by[p], m) + "%"; });
    return { m: m, n: n, top: top.join(", "), said: said };
  }

  function paintTrackers(body) {
    var all = D.trackers;
    var hs = all.map(function (t) { return health(t); });
    var cnt = { ok: 0, check: 0, off: 0 };
    all.forEach(function (t, i) { if (t.active) cnt[hs[i].k]++; });
    var rows = all.map(function (t, i) {
      var hl = hs[i], ps = phraseShare(t), s = ps.said, known = s.rep + s.customer + s.both;
      var w = function (x) { return known ? Math.round(100 * x / known) : 0; };
      return '<div class="stx-trow' + (t.active ? "" : " paused") + '">'
        + '<div><b>' + esc(t.name) + "</b><span>" + esc(question(t)) + "</span><i>" + esc((t.by || "").split("@")[0] + " · " + String(t.at || "").slice(0, 10)) + "</i></div>"
        + "<div>" + esc(scopeWords(t)) + "</div>"
        + "<div><b>" + int((t.keywords || "").split(/[,;\n]+/).filter(function (x) { return x.trim(); }).length) + " phrases</b><span>" + esc(ps.top || "no hits this period") + "</span></div>"
        + '<div><b>' + (ps.n ? pct(ps.m, ps.n) + "%" : "—") + "</b><span>of " + int(ps.n) + " calls this period</span></div>"
        + '<div><span class="stx-who"><i class="rep" style="width:' + w(s.rep) + '%"></i><i class="both" style="width:' + w(s.both) + '%"></i><i class="cust" style="width:' + w(s.customer) + '%"></i></span>'
        + "<span>" + (known ? "rep " + w(s.rep) + "% · both " + w(s.both) + "% · customer " + w(s.customer) + "%" : "not recorded yet") + "</span></div>"
        + '<div><span class="stx-badge ' + (t.active ? hl.k : "paused") + '">' + esc(t.active ? hl.badge : "Paused") + "</span><span>" + esc(hl.why) + "</span></div>"
        + (D.canEdit
           ? '<div class="stx-acts"><button type="button" class="rs-btn" data-read="' + esc(t.key) + '">Read ' + (hl.read < READ_TARGET ? READ_TARGET - hl.read + " hits" : "more hits") + "</button>"
             + '<button type="button" class="rs-btn" data-edit="' + esc(t.key) + '">Edit</button>'
             + '<button type="button" class="rs-btn" data-toggle="' + esc(t.key) + '" data-on="' + (t.active ? 0 : 1) + '">' + (t.active ? "Pause" : "Resume") + "</button>"
             + '<button type="button" class="rs-btn" data-del="' + esc(t.key) + '">Delete</button></div>'
           : "<div></div>")
        + "</div>";
    }).join("");
    body.innerHTML = '<div class="stx-sum">'
      + '<div class="ok"><b>' + cnt.ok + "</b><span>Reliable</span><i>on the scorecard</i></div>"
      + '<div class="check"><b>' + cnt.check + "</b><span>Need a check</span><i>on the scorecard, marked</i></div>"
      + '<div class="off"><b>' + cnt.off + "</b><span>Not measuring it</span><i>off the scorecard until fixed</i></div>"
      + (D.canEdit ? '<button type="button" class="stx-new" data-view-new="1"><b>+ New tracker</b><i>tested on real calls before it saves</i></button>' : "")
      + "</div>"
      + '<section class="panel stx-panel"><div class="stx-ph"><h2>How a tracker earns “Reliable”</h2></div><ol class="stx-rules">'
      + "<li><b>The hits mean what the name says.</b> Someone reads " + READ_TARGET + " hits and marks each one right or wrong. 8 of 10 right passes; fewer takes it off the scorecard.</li>"
      + "<li><b>The right person says it.</b> At least 8 in 10 hits come from the rep, unless the tracker counts only the customer's lines.</li>"
      + "<li><b>Enough calls.</b> A rep needs " + MIN_CALLS + " calls in the period before a rate shows.</li>"
      + "</ol><p class=\"rs-hint\">Changing a tracker's phrases, calls or rules re-checks every matching call on the next hourly pass and starts the reading over. Renaming it or rewording its note does neither.</p></section>"
      + '<section class="panel stx-panel"><div class="stx-ph"><h2>All trackers</h2><span>' + esc(rangeLabel(curRange())) + "</span>"
      + (D.canEdit ? '<button type="button" class="rs-btn" id="stxRun">Check new calls now</button>' : "") + "</div>"
      + '<div class="rs-tablewrap"><div class="stx-tlist"><div class="stx-trow head"><div>Tracker</div><div>Calls it checks</div><div>Phrases</div><div>Hit rate</div><div>Who said it</div><div>Status</div><div></div></div>'
      + rows + "</div></div></section>";
    var nw = body.querySelector("[data-view-new]");
    if (nw) nw.onclick = function () { ST.edit = blankTracker(); ST.test = null; ST.view = "builder"; paint(); };
    var run = body.querySelector("#stxRun");
    if (run) run.onclick = function () {
      post({ action: "run" }).then(function () {
        RSC.notice("Check started. New verdicts show once it finishes — reopen the page to see them. Past 5,000 calls, the rest finish on the next hourly pass.");
      }).catch(function (e) { RSC.notice(e.message); });
    };
    body.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () {
        var t = D.byKey[b.getAttribute("data-edit")];
        ST.edit = JSON.parse(JSON.stringify(t));
        ST.test = null;
        ST.view = "builder";
        paint();
      };
    });
    body.querySelectorAll("[data-read]").forEach(function (b) {
      b.onclick = function () { openReader(D.byKey[b.getAttribute("data-read")]); };
    });
    body.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.onclick = function () {
        post({ action: "toggle", key: b.getAttribute("data-toggle"), active: +b.getAttribute("data-on") })
          .then(function () { render(HOST); }).catch(function (e) { RSC.notice(e.message); });
      };
    });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = async function () {
        var k = b.getAttribute("data-del");
        if (!await RSC.confirm({ title: "Delete tracker '" + k + "'?", body: "Its stored verdicts are kept but hidden; the key can be revived later.", yes: "Delete", danger: true })) return;
        post({ action: "delete", key: k }).then(function () { render(HOST); }).catch(function (e) { RSC.notice(e.message); });
      };
    });
  }

  /* READ HITS: one at a time, the hit lines with a little context, right or wrong. Newest hits
     first, skipping any already read under the tracker's current match hash. */
  function openReader(t) {
    if (!t) return;
    var marks = D.marks[t.key] = D.marks[t.key] || {};
    var queue = (D.ev[t.key] || []).filter(function (e) { return e.Result === "Mentioned" && !marks[e["Record Id"]]; })
      .sort(function (a, b) { return String((D.calls[b["Record Id"]] || {}).Started || "").localeCompare(String((D.calls[a["Record Id"]] || {}).Started || "")); })
      .slice(0, 40);
    var ov = overlay();
    var i = 0, done = 0;
    var step = function () {
      var hl = health(t);
      var drawer = ov.querySelector(".stx-drawer");
      if (i >= queue.length || (hl.read >= READ_TARGET && done > 0 && hl.read % READ_TARGET === 0)) {
        drawer.innerHTML = '<div class="stx-ph"><h2>' + esc(t.name) + '</h2><button type="button" class="rs-btn" data-x="1">Close</button></div>'
          + '<div class="stx-health ' + hl.k + '"><span class="stx-badge ' + hl.k + '">' + esc(hl.badge) + "</span>" + esc(hl.why) + "</div>"
          + (i >= queue.length ? '<p class="stx-note">No more unread hits.</p>' : "");
        drawer.querySelector("[data-x]").onclick = function () { ov.remove(); paint(); };
        return;
      }
      var e = queue[i], rec = e["Record Id"], c = D.calls[rec] || {};
      drawer.innerHTML = '<div class="rs-loading">Opening the call…</div>';
      api("/api/_salescall?rec=" + encodeURIComponent(rec)).then(function (j) {
        var hits = {};
        String(e["Evidence Seqs"] || "").split(",").forEach(function (s) { if (s.trim()) hits[s.trim()] = 1; });
        var u = j.utterances || [], keepIdx = {};
        u.forEach(function (x, ix) { if (hits[String(x.seq)]) for (var d = -2; d <= 2; d++) keepIdx[ix + d] = 1; });
        var lines = u.map(function (x, ix) {
          if (!keepIdx[ix]) return "";
          var isRep = String(x.speaker || "").trim() === String(c.Rep || "").trim();
          return '<div class="stx-utt ' + (isRep ? "rep" : "cust") + (hits[String(x.seq)] ? " hit" : "") + '"><span class="stx-spk">'
            + (isRep ? esc(c.Rep || "rep") : "customer") + "</span>" + esc(x.text || "") + "</div>";
        }).join("");
        drawer.innerHTML = '<div class="stx-ph"><h2>' + esc(question(t)) + '</h2><button type="button" class="rs-btn" data-x="1">Close</button></div>'
          + '<p class="stx-dim">' + esc(t.name) + " · hit " + (hl.read + 1) + " · " + esc(fmtWhen(c.Started)) + " · " + esc(handledBy(c)) + " · " + esc(dirWord(c.Direction)) + "</p>"
          + '<div class="stx-lines">' + (lines || '<p class="stx-note">The hit lines are not in this transcript.</p>') + "</div>"
          + '<p class="stx-askq">Is this what “' + esc(question(t)) + '” means?</p>'
          + '<div class="stx-acts"><button type="button" class="rs-btn stx-right" data-m="right">Right</button>'
          + '<button type="button" class="rs-btn stx-wrong" data-m="wrong">Wrong</button>'
          + '<button type="button" class="rs-btn" data-m="skip">Skip</button>'
          + '<span class="stx-dim">' + hl.read + " of " + READ_TARGET + " read · " + hl.right + " right</span></div>";
        drawer.querySelector("[data-x]").onclick = function () { ov.remove(); paint(); };
        drawer.querySelectorAll("[data-m]").forEach(function (b) {
          b.onclick = function () {
            var m = b.getAttribute("data-m");
            if (m === "skip") { i++; step(); return; }
            b.disabled = true;
            post({ action: "mark", key: t.key, record: rec, mark: m, match_hash: t.match_hash }).then(function () {
              marks[rec] = m; D.markVer = (D.markVer || 0) + 1; i++; done++; step();
            }).catch(function (er) { b.disabled = false; RSC.notice(er.message); });
          };
        });
      }).catch(function (er) { drawer.innerHTML = '<div class="panel">Could not open the call — ' + esc(er.message) + "</div>"; });
    };
    step();
  }

  /* ------------------------------------------------------------------ builder */

  function blankTracker() {
    // keyword mode, quote calls only BY DEFAULT -- his cost calls (2026-08-26/27)
    return { key: "", name: "", question: "", description: "", keywords: "", mode: "keyword",
             scope: { quote_only: true }, rules: {}, isNew: true };
  }
  function keyFromName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40);
  }
  /* THE PREVIEW IS THE ENGINE'S OWN SPLIT (trk_match.terms): commas, semicolons and new lines
     separate phrases, each said word for word (any letter case, any spacing). Source Detector's
     box once held one sentence with a full stop and matched 0 of 356 calls (2026-09-24), so a
     long entry or one ending in punctuation is flagged, never refused. */
  var KW_LONG = 4;
  var KW_END_PUNCT = /[.!?:"'…”’]$/;
  function kwTerms(s) {
    return String(s || "").split(/[,;\n]+/).map(function (x) { return x.trim().replace(/\s+/g, " "); })
      .filter(function (x) { return x; });
  }
  function kwPreview(el, value, empty) {
    var terms = kwTerms(value);
    if (!terms.length) { el.innerHTML = empty ? '<p class="stx-dim">' + esc(empty) + "</p>" : ""; return; }
    var warns = [];
    el.innerHTML = terms.map(function (term) {
      var words = term.split(/\s+/).length, endP = KW_END_PUNCT.test(term);
      if (words > KW_LONG || endP) {
        warns.push('"' + term + '" — ' + [words > KW_LONG ? words + " words" : "", endP ? 'ends in "' + term.slice(-1) + '"' : ""].filter(Boolean).join(" and ")
          + ": it is found only when said exactly like this. If it is a sentence, split it into short phrases with commas.");
      }
      return '<span class="stx-chip' + (words > KW_LONG || endP ? " warn" : "") + '">' + esc(term) + "</span>";
    }).join("") + warns.map(function (w) { return '<p class="stx-kwwarn">' + esc(w) + "</p>"; }).join("");
  }

  function readForm(f) {
    var t = ST.edit;
    var g = function (id) { var x = f.querySelector("#" + id); return x ? x.value : ""; };
    t.name = g("stxName").trim();
    t.question = g("stxQ").trim();
    t.description = g("stxDesc").trim();
    t.keywords = g("stxKw").trim();
    t.rules = { who: t.rules && t.rules.who || "", trigger: g("stxTrig").trim(), window: +g("stxWin") || 5, ignore: g("stxIgn").trim() };
    t.scope = {
      direction: t._dir ? t._dir.get() : "",
      min_seconds: +g("stxMin") || 0,
      date_from: g("stxFrom") || "",
      quote_only: f.querySelector("#stxQuote").checked,
      first_contact_only: f.querySelector("#stxFirst").checked,
      include_shared: f.querySelector("#stxShared").checked,
    };
    if (t.isNew) t.key = keyFromName(t.name);
    return t;
  }
  function payload(t) {
    return { key: t.key, name: t.name, question: t.question, description: t.description, keywords: t.keywords,
             mode: "keyword", scope: t.scope, rules: { who: t.rules.who, trigger: t.rules.trigger, window: t.rules.window, ignore: t.rules.ignore } };
  }

  function paintBuilder(body) {
    var t = ST.edit || (ST.edit = blankTracker());
    var sc = t.scope || {}, ru = t.rules || (t.rules = {});
    var who = ru.who || "";
    var step = function (n, inner) { return '<div class="stx-step"><span class="stx-num">' + n + "</span><div>" + inner + "</div></div>"; };
    body.innerHTML = '<div class="stx-two build"><section class="panel stx-panel stx-form" id="stxForm">'
      + "<h2>" + (t.isNew ? "New tracker" : "Edit — " + esc(t.name)) + "</h2>"
      + step(1, '<div class="stx-f2"><label>Name<input class="stx-in" id="stxName" maxlength="120" value="' + esc(t.name) + '"></label>'
        + "<label>The question it answers<input class=\"stx-in\" id=\"stxQ\" maxlength=\"160\" placeholder=\"Did the rep ask how they found us?\" value=\"" + esc(t.question || "") + '"></label></div>'
        + '<label>Note for people — what this tracker is about. It is never matched<textarea class="stx-in" id="stxDesc" maxlength="4000">' + esc(t.description) + "</textarea></label>"
        + (t.isNew ? "" : '<p class="stx-dim">Key: ' + esc(t.key) + " (fixed)</p>"))
      + step(2, "<b>When the customer says</b> <span class=\"stx-dim\">— optional: what starts the moment. Leave it empty to check every call.</span>"
        + '<textarea class="stx-in stx-short" id="stxTrig" maxlength="1000" placeholder="going with another company, need to think about it, found a better price">' + esc(ru.trigger || "") + "</textarea>"
        + '<div class="stx-prev" id="stxTrigPrev"></div>'
        + '<div class="stx-inline">within <input class="stx-in stx-num-in" id="stxWin" type="number" min="1" max="30" value="' + esc(ru.window || 5) + '"> lines, then</div>')
      + step(3, '<div class="stx-inline"><b>Phrases said by</b><span class="stx-seg" role="group" aria-label="Whose lines count">'
        + [["rep", "the rep"], ["customer", "the customer"], ["", "either side"]].map(function (o) {
          return '<button type="button" class="' + (who === o[0] ? "on" : "") + '" data-who="' + o[0] + '" aria-pressed="' + (who === o[0]) + '">' + esc(o[1]) + "</button>";
        }).join("") + "</span></div>"
        + '<textarea class="stx-in stx-short" id="stxKw" maxlength="1000" placeholder="may I ask why, what made you decide">' + esc(t.keywords || "") + "</textarea>"
        + '<div class="stx-prev" id="stxKwPrev"></div>')
      + step(4, "<b>Ignore lines with</b> <span class=\"stx-dim\">— optional: phrases that make a line not count</span>"
        + '<textarea class="stx-in stx-short" id="stxIgn" maxlength="1000" placeholder="not moving any, not moving a lot">' + esc(ru.ignore || "") + "</textarea>"
        + '<div class="stx-prev" id="stxIgnPrev"></div>')
      + step(5, "<b>Which calls</b>"
        + '<div class="stx-inline wrap"><span id="stxDir"></span>'
        + '<label class="stx-check"><input type="checkbox" id="stxQuote"' + (sc.quote_only ? " checked" : "") + "> Quote calls only</label>"
        + '<label class="stx-check"><input type="checkbox" id="stxFirst"' + (sc.first_contact_only ? " checked" : "") + "> First call with each lead</label>"
        + '<label class="stx-check"><input type="checkbox" id="stxShared"' + (sc.include_shared ? " checked" : "") + "> Include the support line</label>"
        + '<label class="stx-check">From <input class="stx-in stx-date" id="stxFrom" type="date" value="' + esc(sc.date_from || "") + '"></label>'
        + '<label class="stx-check">At least <input class="stx-in stx-num-in" id="stxMin" type="number" min="0" max="7200" value="' + esc(sc.min_seconds || "") + '"> seconds</label></div>'
        + '<p class="rs-hint"><b>First call with each lead</b> keeps a question asked once per lead, such as where they heard about us; only calls linked to a lead count, '
        + "and a new customer's call joins about a day later with the morning lead export. <b>Include the support line</b> adds the Support Zip To Zip queue, which is not a person.</p>")
      + '<div class="stx-acts"><button type="button" class="rs-btn pri" id="stxTest">Test on recent calls</button>'
      + '<button type="button" class="rs-btn" id="stxSave">' + (t.isNew ? "Create tracker" : "Save changes") + "</button>"
      + '<button type="button" class="rs-btn" id="stxCancel">Cancel</button>'
      + '<span class="stx-dim">Changing the phrases, rules or calls re-checks every matching call on the next pass.</span></div>'
      + "</section>"
      + '<section class="panel stx-panel" id="stxTestOut"></section></div>';

    var f = body.querySelector("#stxForm");
    var pv = function (id, out, empty) {
      var x = f.querySelector("#" + id);
      var go = function () { kwPreview(f.querySelector("#" + out), x.value, empty); };
      x.oninput = go;
      go();
    };
    pv("stxTrig", "stxTrigPrev", "No trigger: every call in scope is checked.");
    pv("stxKw", "stxKwPrev", "No phrases yet — a tracker needs at least one.");
    pv("stxIgn", "stxIgnPrev", "");
    // DIRECTION IS A REQUIRED PICK (his ask, 2026-10-06); "both" is stored as nothing
    t._dir = RSC.localSelect(f.querySelector("#stxDir"), {
      label: "Direction", allLabel: "Choose direction…", form: true,
      values: [{ v: "outbound", l: "Outbound calls" }, { v: "inbound", l: "Inbound calls" }, { v: "both", l: "Both directions" }],
      value: t.isNew && !sc.direction ? "" : (sc.direction || "both"),
    });
    f.querySelectorAll("[data-who]").forEach(function (b) {
      b.onclick = function () {
        readForm(f);
        t.rules.who = b.getAttribute("data-who");
        f.querySelectorAll("[data-who]").forEach(function (x) {
          var on = x === b; x.classList.toggle("on", on); x.setAttribute("aria-pressed", String(on));
        });
      };
    });
    f.querySelector("#stxCancel").onclick = function () { ST.edit = null; ST.test = null; ST.view = "trackers"; paint(); };
    f.querySelector("#stxTest").onclick = function () {
      readForm(f);
      if (!t.scope.direction) { RSC.notice("Choose which calls this tracker is for: outbound, inbound or both."); return; }
      var out = body.querySelector("#stxTestOut");
      out.innerHTML = '<div class="rs-loading">Checking the newest calls…</div>';
      post(Object.assign({ action: "test" }, payload(t))).then(function (j) {
        ST.test = j;
        ST.test.key = t.isNew ? keyFromName(t.name) : t.key;
        ST.test.marks = {};
        paintTest(out);
      }).catch(function (e) { out.innerHTML = '<p class="stx-note">' + esc(e.message) + "</p>"; });
    };
    f.querySelector("#stxSave").onclick = function () {
      readForm(f);
      if (!t.scope.direction) { RSC.notice("Choose which calls this tracker is for: outbound, inbound or both."); return; }
      var p = Object.assign({ action: "save" }, payload(t));
      var done = function () { ST.edit = null; ST.test = null; ST.view = "trackers"; render(HOST); };
      post(p).then(done).catch(async function (e) {
        // the revive rule surfaces here: a deleted key needs an explicit yes
        if (/revive:true/.test(e.message) && await RSC.confirm({ body: e.message + "\n\nBring the old tracker back with its verdicts?", yes: "Bring it back" })) {
          p.revive = true;
          post(p).then(done).catch(function (e2) { RSC.notice(e2.message); });
        } else { RSC.notice(e.message); }
      });
    };
    paintTest(body.querySelector("#stxTestOut"));
  }

  function paintTest(out) {
    var j = ST.test;
    if (!j) {
      out.innerHTML = '<div class="stx-ph"><h2>Test on real calls</h2></div>'
        + '<p class="stx-note">Press <b>Test on recent calls</b> to run this tracker, as written, over the newest 300 calls it applies to — nothing is saved. '
        + "Then read the hits and mark each one right or wrong: " + READ_TARGET + " read and 8 right puts it on the scorecard.</p>";
      return;
    }
    var R = j.results || {}, judged = (R.Mentioned || 0) + (R["Not Mentioned"] || 0);
    var s = j.said_by || {}, known = (s.rep || 0) + (s.customer || 0) + (s.both || 0);
    var ph = Object.keys(j.phrases || {}).sort(function (a, b) { return j.phrases[b] - j.phrases[a]; });
    var right = 0, read = 0;
    Object.keys(j.marks).forEach(function (k) { read++; if (j.marks[k] === "right") right++; });
    var verdict = read < READ_TARGET ? read + " of " + READ_TARGET + " read" : (right / read >= PASS_SHARE ? "Reliable: it goes on the scorecard" : "Not measuring it: it stays off the scorecard");
    var vk = read < READ_TARGET ? "check" : right / read >= PASS_SHARE ? "ok" : "off";
    out.innerHTML = '<div class="stx-ph"><h2>Test on real calls</h2><span>' + int(j.calls) + " calls, " + esc(fmtDay(nyDay(j.oldest))) + " – " + esc(fmtDay(nyDay(j.newest))) + "</span></div>"
      + '<div class="stx-boxes wide"><div><span>Hits</span><b>' + int(R.Mentioned) + "</b><i>" + (judged ? pct(R.Mentioned, judged) + "% of " + int(judged) + " calls" : "no calls") + "</i></div>"
      + (R["Not Applicable"] ? "<div><span>Did not apply</span><b>" + int(R["Not Applicable"]) + "</b><i>the customer never said a trigger</i></div>" : "")
      + "<div><span>Who said it</span><b>" + (known ? Math.round(100 * ((s.rep || 0) + (s.both || 0)) / known) + "%" : "—") + "</b><i>hits where the rep said it</i></div></div>"
      + (ph.length ? '<p class="stx-dim">' + ph.slice(0, 6).map(function (p) { return "“" + esc(p) + "” " + pct(j.phrases[p], R.Mentioned) + "%"; }).join(" · ") + "</p>" : "")
      + '<div class="stx-health ' + vk + '"><span class="stx-badge ' + vk + '">' + esc(read < READ_TARGET ? "Reading" : vk === "ok" ? "Reliable" : "Not measuring it") + "</span>"
      + esc(verdict) + (read ? " · " + right + " of " + read + " right" : "") + "</div>"
      + (j.samples || []).map(function (smp, i) {
        var m = j.marks[smp.record] || "";
        return '<div class="stx-sample"><div class="stx-dim">' + esc(fmtWhen(smp.started)) + " · " + esc(smp.rep || "") + "</div>"
          + smp.lines.map(function (l) { return '<div class="stx-utt ' + (l.side === "rep" ? "rep" : "cust") + ' hit"><span class="stx-spk">' + esc(l.side) + "</span>" + esc(l.text) + "</div>"; }).join("")
          + '<div class="stx-acts"><button type="button" class="rs-btn stx-right' + (m === "right" ? " on" : "") + '" data-s="' + i + '" data-m="right" aria-pressed="' + (m === "right") + '">Right</button>'
          + '<button type="button" class="rs-btn stx-wrong' + (m === "wrong" ? " on" : "") + '" data-s="' + i + '" data-m="wrong" aria-pressed="' + (m === "wrong") + '">Wrong</button></div></div>';
      }).join("")
      + (!(j.samples || []).length ? '<p class="stx-note">No hits to read in these calls.</p>' : "")
      + '<p class="rs-hint">Marks are saved as you go and count for this tracker once it is saved with these same phrases, calls and rules.</p>';
    out.querySelectorAll("[data-s]").forEach(function (b) {
      b.onclick = function () {
        var smp = j.samples[+b.getAttribute("data-s")], m = b.getAttribute("data-m");
        if (!j.key) { RSC.notice("Give the tracker a name first: marks are filed under it."); return; }
        b.disabled = true;
        post({ action: "mark", key: j.key, record: smp.record, mark: m, match_hash: j.match_hash }).then(function () {
          j.marks[smp.record] = m;
          D.markVer = (D.markVer || 0) + 1;
          if (D.byKey[j.key] && D.byKey[j.key].match_hash === j.match_hash) (D.marks[j.key] = D.marks[j.key] || {})[smp.record] = m;
          paintTest(out);
        }).catch(function (e) { b.disabled = false; RSC.notice(e.message); });
      };
    });
  }

  /* ------------------------------------------------------------------ transcript */

  function overlay() {
    var ov = document.createElement("div");
    ov.className = "stx-overlay";
    ov.innerHTML = '<div class="stx-drawer" role="dialog" aria-modal="true"><div class="rs-loading">Opening the call…</div></div>';
    ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    return ov;
  }
  function openCall(rec, seqs, what) {
    var hits = {};
    String(seqs || "").split(",").forEach(function (s) { if (s.trim()) hits[s.trim()] = true; });
    var ov = overlay();
    api("/api/_salescall?rec=" + encodeURIComponent(rec)).then(function (j) {
      var c = D.calls[rec] || {}, rep = c.Rep || "";
      var verdicts = D.trackers.map(function (t) {
        var e = (D.ev[t.key] || []).filter(function (x) { return x["Record Id"] === rec; })[0];
        return e ? '<span class="stx-pill ' + (e.Result === "Mentioned" ? "ok" : e.Result === "Not Mentioned" ? "off" : "") + '" title="' + esc(e.Explanation || "") + '">'
          + esc(t.name) + ": " + esc(e.Result === "Mentioned" ? "with it" : e.Result === "Not Mentioned" ? "without it" : "did not apply") + "</span>" : "";
      }).join("");
      var utts = (j.utterances || []).map(function (u) {
        var isRep = String(u.speaker || "").trim() === rep;
        return '<div class="stx-utt ' + (isRep ? "rep" : "cust") + (hits[String(u.seq)] ? " hit" : "") + '">'
          + '<span class="stx-spk">' + (isRep ? esc(rep || "rep") : "customer") + "</span>" + esc(u.text || "") + "</div>";
      }).join("");
      ov.querySelector(".stx-drawer").innerHTML = '<div class="stx-ph"><div><h2>' + esc(c.Customer || "Call") + "</h2>"
        + '<span class="stx-dim">' + esc(fmtWhen(c.Started)) + " · " + esc(dirWord(c.Direction)) + " · " + esc(handledBy(c)) + " · "
        + Math.round((+c["Duration Sec"] || 0) / 60) + ' min</span></div><button type="button" class="rs-btn" id="stxClose">Close</button></div>'
        + '<div class="stx-pills">' + verdicts + "</div>"
        + (Object.keys(hits).length ? '<p class="rs-hint">Highlighted lines are where <b>' + esc(what) + "</b> was heard.</p>" : "")
        + '<div class="stx-lines">' + utts + "</div>";
      ov.querySelector("#stxClose").onclick = function () { ov.remove(); };
      var first = ov.querySelector(".stx-utt.hit");
      if (first && first.scrollIntoView) first.scrollIntoView({ block: "center" });
    }).catch(function (e) {
      ov.querySelector(".stx-drawer").innerHTML = '<div class="panel">Could not open the call — ' + esc(e.message) + "</div>";
    });
  }

  /* ------------------------------------------------------------------ style */

  function injectStyle() {
    var old = document.getElementById("stx-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "stx-style";
    // the canvas's palette (2026-10-28): solid fills, the same four tones everywhere
    var G = "#1E5B36", N = "#DCE7D5", NI = "#1E3D28", L = "#B5400C", INK = "#14201A";
    st.textContent = ""
      + ".stx{font-variant-numeric:tabular-nums;display:flex;flex-direction:column;gap:18px}"
      + ".stx-head{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;justify-content:space-between}"
      + ".stx-head h1{margin:2px 0 4px;font-size:32px;font-weight:800;letter-spacing:-.02em;color:var(--ink)}"
      + ".stx-head p{margin:0;color:var(--muted);max-width:760px;font-size:14px}"
      + ".stx-eyebrow{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:" + G + "}"
      + ".stx-nav,.stx-seg{display:inline-flex;flex-wrap:wrap;gap:3px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:4px}"
      + ".stx-nav button,.stx-seg button{border:0;background:transparent;color:var(--ink);font-family:inherit;font-weight:600;font-size:13.5px;padding:9px 14px;border-radius:8px;cursor:pointer;min-height:38px}"
      + ".stx-nav button.on,.stx-seg button.on{background:" + INK + ";color:#fff}"
      + ".stx-seg button i{font-style:normal;opacity:.7;margin-left:3px}"
      + ".stx-bar{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center}"
      + ".stx-cmp{font-size:12.5px;color:var(--muted)}"
      + ".stx-note{font-size:13.5px;color:var(--muted);line-height:1.6;max-width:90ch}"
      + ".stx-dim{font-size:12.5px;color:var(--muted)}"
      + ".stx-panel{padding:20px}"
      + ".stx-ph{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:baseline;justify-content:space-between;margin:0 0 12px}"
      + ".stx-ph h2{margin:0;font-size:19px;font-weight:800;color:var(--ink)}.stx-ph h3{margin:0;font-size:15px;font-weight:700;color:var(--ink)}"
      + ".stx-ph span{font-size:12.5px;color:var(--muted)}"
      // tiles
      + ".stx-tiles{display:grid;grid-template-columns:repeat(var(--stx-n,4),minmax(0,1fr));gap:12px}"
      + "@media(max-width:1180px){.stx-tiles{grid-template-columns:repeat(auto-fit,minmax(210px,1fr))}}"
      + ".stx-tile{display:flex;flex-direction:column;gap:6px;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px;cursor:pointer;font-family:inherit;color:var(--ink)}"
      + ".stx-tile:hover{border-color:var(--line-2)}.stx-tile.on{outline:3px solid " + INK + ";outline-offset:1px}"
      + ".stx-tile.off{background:var(--panel-2)}.stx-tile.off .stx-tile-v b{text-decoration:line-through;color:var(--muted)}"
      + ".stx-tile-n{font-size:12px;color:var(--muted);font-weight:600}.stx-tile-q{font-weight:700;min-height:38px}"
      + ".stx-tile-v{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.stx-tile-v b{font-size:38px;font-weight:800;letter-spacing:-.02em;line-height:1}"
      + ".stx-tile-v i{font-style:normal;font-size:12.5px;font-weight:700;color:var(--muted)}.stx-tile-v i.up{color:" + G + "}.stx-tile-v i.down{color:" + L + "}"
      + ".stx-tile-s,.stx-tile-why{font-size:12px;color:var(--muted)}"
      + ".stx-badge{align-self:flex-start;display:inline-block;font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap}"
      + ".stx-badge.ok{background:#DCEFD9;color:" + G + "}.stx-badge.check{background:#FFF1D6;color:#7A4B00}.stx-badge.off{background:#FCE3D8;color:#8A2E07}.stx-badge.paused{background:var(--panel-2);color:var(--muted)}"
      // the matrix
      + ".stx-matrix{width:100%;border-collapse:separate;border-spacing:5px;min-width:720px;table-layout:fixed}"
      // fixed layout takes its widths from the first row: the names' column is set there
      + ".stx-matrix thead tr:first-child th:first-child{width:200px}"
      + ".stx-matrix.wide{min-width:1180px}"
      + ".stx-matrix th{font-size:12px;font-weight:700;color:var(--ink);text-align:center;padding:2px 2px 6px;vertical-align:bottom}"
      + ".stx-matrix th span{display:block;font-weight:600;font-size:11.5px;color:var(--muted)}"
      + ".stx-matrix th span.ok{color:" + G + "}.stx-matrix th span.check{color:#7A4B00}"
      + ".stx-matrix th.grp{color:" + G + ";text-transform:uppercase;letter-spacing:.06em;border-bottom:2px solid var(--line)}"
      + ".stx-matrix tbody th,.stx-matrix tfoot th{text-align:left;font-size:13.5px;min-width:160px;vertical-align:middle;padding:0 6px}"
      + ".stx-matrix td{padding:0}"
      + ".stx-cell{width:100%;min-height:54px;border:1px solid transparent;border-radius:8px;cursor:pointer;font-family:inherit;font-size:19px;font-weight:800;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px}"
      + ".stx-cell.sm{font-size:15px;min-height:46px}"
      + ".stx-cell i{font-style:normal;font-size:11px;font-weight:700;min-height:13px}"
      + ".stx-cell.good{background:" + G + ";color:#fff}.stx-cell.near{background:" + N + ";color:" + NI + "}"
      + ".stx-cell.low{background:" + L + ";color:#fff}.stx-cell.few{background:var(--panel-2);color:var(--muted);border-color:var(--line)}"
      + ".stx-cell.team{background:var(--panel);color:var(--ink);border-color:var(--line-2)}"
      + ".stx-cell.on{outline:3px solid " + INK + ";outline-offset:2px}"
      + ".stx-teamrow th,.stx-teamrow td{padding-top:6px}"
      + ".stx-legend{display:flex;flex-wrap:wrap;gap:8px 16px;margin:14px 0 0;font-size:12.5px;color:var(--muted)}"
      + ".stx-legend span{display:inline-flex;align-items:center;gap:6px}.stx-legend i{width:14px;height:14px;border-radius:4px;display:inline-block}"
      + ".stx-legend i.good{background:" + G + "}.stx-legend i.near{background:" + N + "}.stx-legend i.low{background:" + L + "}.stx-legend i.few{background:var(--panel-2);border:1px solid var(--line-2)}"
      // the open cell
      + ".stx-dgrid{display:flex;flex-wrap:wrap;gap:20px;margin-bottom:18px}.stx-dmain{flex:1 1 360px;display:flex;flex-direction:column;gap:12px;min-width:0}"
      + ".stx-dweeks{flex:1 1 420px;min-width:0}"
      + ".stx-detail h2{margin:0;font-size:22px;font-weight:800;color:var(--ink)}.stx-sub{font-size:12.5px;color:var(--muted)}"
      + ".stx-bigrow{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}.stx-bigrow div{display:flex;flex-direction:column;gap:2px;padding-bottom:4px}"
      + ".stx-bigrow span:not(.stx-big){font-size:12.5px;color:var(--muted)}"
      + ".stx-big{font-size:60px;font-weight:800;line-height:.9;letter-spacing:-.03em;color:var(--ink)}"
      + ".stx-big.good{color:" + G + "}.stx-big.near{color:#4E7A5B}.stx-big.low{color:" + L + "}.stx-big.few,.stx-big.off{color:var(--muted)}.stx-big.off{text-decoration:line-through}"
      + ".stx-boxes{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}"
      + ".stx-boxes div{background:var(--panel-2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column}"
      + ".stx-boxes span{font-size:12px;color:var(--muted)}.stx-boxes b{font-size:20px;font-weight:800;color:var(--ink)}.stx-boxes i{font-style:normal;font-size:11.5px;color:var(--muted)}"
      + ".stx-health{display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:10px;font-size:12.5px;line-height:1.5;color:var(--ink)}"
      + ".stx-health.ok{background:#EEF5EB}.stx-health.check{background:#FFF7E8}.stx-health.off{background:#FCE3D8}"
      + ".stx-wks{display:flex;gap:6px;align-items:flex-end}"
      + ".stx-wk{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}"
      + ".stx-wk b{font-size:11.5px;color:var(--ink)}.stx-wk span{font-size:11px;color:var(--muted);white-space:nowrap}"
      + ".stx-wkbox{position:relative;width:100%;height:120px;background:var(--panel-2);border-radius:6px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden}"
      + ".stx-wkbox i{width:62%;border-radius:4px 4px 0 0;background:" + G + "}.stx-wkbox i.near{background:#4E7A5B}.stx-wkbox i.low{background:" + L + "}.stx-wkbox i.few,.stx-wkbox i.off{background:var(--faint)}"
      + ".stx-wkbox i.thin{opacity:.35}"
      + ".stx-wkbox u{position:absolute;left:0;right:0;height:0;border-top:2px dashed " + INK + "}"
      + ".stx-calls td{vertical-align:top}.stx-calls .stx-dim{display:block;font-size:11.5px}"
      + ".stx-heard{font-size:12.5px;color:var(--muted);display:inline-block;max-width:44ch}"
      + ".stx-more{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:10px 0 0}"
      // one rep
      + ".stx-onepick{display:flex}"
      + ".stx-band{background:" + INK + ";color:#fff;border-radius:16px;padding:22px;display:flex;flex-wrap:wrap;gap:22px}"
      + ".stx-band>div{flex:1 1 260px;display:flex;flex-direction:column;gap:6px}"
      + ".stx-band span{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#B7E23B}.stx-band span.coach{color:#FFB48F}"
      + ".stx-band-me b{font-size:30px;font-weight:800;line-height:1.05}.stx-band-me i{font-style:normal;color:#C9D1CB}"
      + ".stx-band ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}"
      + ".stx-band li{display:flex;gap:10px;align-items:baseline;border-top:1px solid #2E3B33;padding-top:7px}"
      + ".stx-band li span{flex:1;font-size:13.5px;font-weight:500;letter-spacing:0;text-transform:none;color:#fff}.stx-band li i{font-style:normal;color:#C9D1CB;font-size:12.5px}"
      + ".stx-two{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start}.stx-two>section{flex:1 1 520px;min-width:0}"
      + ".stx-two.build>section:first-child{flex:1.3 1 600px}"
      + ".stx-dumb{width:100%;display:grid;grid-template-columns:minmax(0,1.6fr) 58px minmax(0,1.4fr) 92px;gap:12px;align-items:center;padding:10px 4px;border:0;border-top:1px solid var(--line);background:transparent;text-align:left;cursor:pointer;font-family:inherit;color:var(--ink)}"
      + ".stx-dumb:hover{background:var(--panel-2)}"
      + ".stx-dl b{display:block;font-weight:600;font-size:13.5px}.stx-dl i{font-style:normal;font-size:12px;color:var(--muted)}"
      + ".stx-dv{font-size:20px;font-weight:800}.stx-dv.good{color:" + G + "}.stx-dv.near{color:#4E7A5B}.stx-dv.low{color:" + L + "}.stx-dv.few{color:var(--muted)}"
      + ".stx-dtrack{position:relative;height:12px;background:var(--panel-2);border-radius:999px}"
      + ".stx-dtrack i{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:" + G + "}.stx-dtrack i.near{background:#4E7A5B}.stx-dtrack i.low{background:" + L + "}"
      + ".stx-dtrack u{position:absolute;top:-5px;width:3px;height:22px;margin-left:-1px;background:" + INK + "}"
      + ".stx-dt{font-size:12px;color:var(--muted);text-align:right}.stx-dt em{display:block;font-style:normal;font-weight:700}.stx-dt em.up{color:" + G + "}.stx-dt em.down{color:" + L + "}"
      + ".stx-grp{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:" + G + ";padding:14px 0 4px}"
      // trackers
      + ".stx-sum{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px}"
      + ".stx-sum>div,.stx-new{border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:2px}"
      + ".stx-sum b{font-size:40px;font-weight:800;line-height:1}.stx-sum span{font-weight:700}.stx-sum i{font-style:normal;font-size:12px}"
      + ".stx-sum .ok{background:" + G + ";color:#fff}.stx-sum .check{background:#FFE8B8;color:#4D3000}.stx-sum .off{background:" + L + ";color:#fff}"
      + ".stx-new{background:var(--panel);border:2px dashed var(--line-2);cursor:pointer;text-align:left;font-family:inherit;color:var(--ink);justify-content:center}"
      + ".stx-new b{font-size:22px}.stx-new i{color:var(--muted)}"
      + ".stx-rules{margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px;font-size:13.5px;color:var(--ink)}"
      + ".stx-tlist{min-width:1160px}"
      + ".stx-trow{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1.1fr) minmax(0,1.2fr) 100px minmax(0,1.1fr) minmax(0,1.5fr) 340px;gap:14px;padding:14px 0;border-top:1px solid var(--line);align-items:center;font-size:13px;color:var(--ink)}"
      + ".stx-trow.head{border-top:0;padding:0 0 8px;font-size:12px;font-weight:700;color:var(--muted)}"
      + ".stx-trow.paused{opacity:.7}"
      + ".stx-trow>div{display:flex;flex-direction:column;gap:3px;min-width:0}.stx-trow span,.stx-trow i{font-size:12px;color:var(--muted);font-style:normal}"
      + ".stx-who{display:flex!important;flex-direction:row!important;height:12px;border-radius:999px;overflow:hidden;background:var(--panel-2)}"
      + ".stx-who i.rep{background:" + G + "}.stx-who i.both{background:#8DB59A}.stx-who i.cust{background:#E08A5C}"
      + ".stx-acts{display:flex!important;flex-direction:row!important;flex-wrap:wrap;gap:6px;align-items:center}"
      + ".stx-right.on{background:" + G + ";color:#fff;border-color:" + G + "}.stx-wrong.on{background:" + L + ";color:#fff;border-color:" + L + "}"
      // builder
      + ".stx-form h2{margin:0 0 6px;font-size:20px;font-weight:800;color:var(--ink)}"
      + ".stx-form{display:flex;flex-direction:column;gap:18px}"
      + ".stx-step{display:flex;gap:14px;align-items:flex-start}.stx-step>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:8px}"
      + ".stx-num{flex:none;width:32px;height:32px;border-radius:10px;background:" + INK + ";color:#B7E23B;display:flex;align-items:center;justify-content:center;font-weight:800}"
      + ".stx-f2{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}"
      + ".stx-form label{display:flex;flex-direction:column;gap:5px;font-size:13px;font-weight:600;color:var(--ink)}"
      + ".stx-in{font-family:inherit;width:100%;background:var(--panel);border:1px solid var(--line-2);border-radius:8px;color:var(--ink);padding:9px 11px;font-size:13.5px;outline:0;box-sizing:border-box}"
      + ".stx-in:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(63,125,32,.14)}"
      + "textarea.stx-in{min-height:90px;resize:vertical}textarea.stx-in.stx-short{min-height:58px}"
      + ".stx-num-in{width:72px;display:inline-block}.stx-date{width:150px;display:inline-block}"
      + ".stx-inline{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;font-size:13.5px;color:var(--ink)}"
      + ".stx-form label.stx-check{flex-direction:row;align-items:center;gap:6px;font-weight:500}"
      + ".stx-check input[type=checkbox]{width:18px;height:18px;accent-color:" + INK + "}"
      + ".stx-prev{display:flex;flex-wrap:wrap;gap:5px}"
      + ".stx-chip{display:inline-block;padding:3px 10px;border-radius:999px;background:var(--panel-2);border:1px solid var(--line);font-size:12.5px;color:var(--ink)}"
      + ".stx-chip.warn{background:#FFF1D6;border-color:#FDE68A;color:#7A4B00}"
      + ".stx-kwwarn{flex-basis:100%;font-size:12.5px;color:#92400E;margin:2px 0 0}"
      + ".stx-sample{border-top:1px solid var(--line);padding:12px 0;display:flex;flex-direction:column;gap:6px}"
      + ".stx-linkbtn{border:0;background:none;padding:0;color:" + G + ";font:inherit;font-weight:700;cursor:pointer;text-decoration:underline}"
      // drawers
      + ".stx-overlay{position:fixed;inset:0;background:var(--scrim,rgba(15,23,42,.38));z-index:60;display:flex;justify-content:flex-end}"
      + ".stx-drawer{width:min(720px,94vw);height:100%;background:var(--panel);overflow:auto;padding:22px 26px;box-shadow:-12px 0 40px rgba(15,23,42,.18);box-sizing:border-box}"
      + ".stx-pills{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0 12px}"
      + ".stx-pill{font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--panel-2);color:var(--ink)}.stx-pill.ok{background:#DCEFD9;color:" + G + "}.stx-pill.off{background:#FCE3D8;color:#8A2E07}"
      + ".stx-lines{display:flex;flex-direction:column}"
      + ".stx-utt{padding:7px 8px;border-bottom:1px solid var(--line);font-size:14px;line-height:1.55;color:var(--ink)}"
      + ".stx-utt.cust{padding-left:28px;color:var(--muted)}.stx-utt.hit{background:#F4FAE6;border-radius:6px}"
      + ".stx-spk{font-size:12.5px;font-weight:700;margin-right:8px;color:" + G + "}.stx-utt.cust .stx-spk{color:#0F766E}"
      + ".stx-askq{font-weight:700;margin:14px 0 6px;color:var(--ink)}"
      + "@media(max-width:820px){.stx-head h1{font-size:26px}.stx-big{font-size:46px}.stx-dumb{grid-template-columns:minmax(0,1fr) 52px 70px}.stx-dumb .stx-dtrack{display:none}}";
    document.head.appendChild(st);
  }

  if (window.registerPage) {
    registerPage({
      id: "sales-trackers",
      group: "sales",
      title: "Sales Trackers",
      render: render,
    });
  }
})();
