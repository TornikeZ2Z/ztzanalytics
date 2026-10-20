/* MARKETING page: Return on Investment -- where the advertising money goes, by state, and what it
 * brings back (2026-10-20).
 *
 * His call that day: "this expenditure by states for each marketing stuff should be completely
 * separately, as a new page, and then we should have ROI there as well. Source analysis should be
 * simply everything about source, including its ROI across states. And then we should have separate
 * Return on Investment page, where we should have this expenditure drills." His picks on the
 * proposal: three tabs; the calculation in shared portal code (roi-core.js, the SAME code Source
 * Analysis' strip runs, so the two pages can never disagree and a saved split shows at once);
 * revenue per $1 + cost per job, labelled plainly (this is revenue per ad dollar, not profit);
 * Marketing + admins enter the splits.
 *
 *   OVERVIEW        KPIs, the states, every source x state as a heat grid (a cell opens the drill),
 *                   and Spend and return per source with the months chart (moved from Source
 *                   Analysis' Return on ad spend tab, which became one read-only strip).
 *   SPEND BY STATE  is every month of every source placed in a state? A coverage grid (placed by a
 *                   rule / entered / part / not placed) and the Missing data list; a row opens the
 *                   split panel (month by month, % or $, rest here, copy from the previous month).
 *   DRILL           state > source > month, or source > state > month, the dollars beside every
 *                   ratio so a tiny cell can't pass for a great one.
 *
 * Page id `marketing-roi` -- never a department id (portal-acl-id-collision). Its own bar
 * (Sources, Company, Period, State); PAGE_DATASETS [] + BARE_CHROME like Source Analysis.
 */
(function () {
  if (!window.RSROI) return;
  var C0 = RSROI;
  var SERVICE_STATES = C0.SERVICE_STATES, OTHER_ST = C0.OTHER_ST, AMT_STATES = C0.AMT_STATES;
  var SMALL_SPEND = C0.SMALL_SPEND, HOW_SHORT = C0.HOW_SHORT;
  var stateKey = C0.stateKey, inR = C0.inR;

  // the page's picks, at module scope so a re-render keeps them
  var Q = { co: "Zip to Zip", from: null, to: null, fams: new Set(), states: new Set(), tab: "ov",
            path: "state", keys: [], reopen: null, bootDone: false };
  // the view's last numbers and the split panel's hand-offs
  var V = { R: null, note: "", reopen: null, reopenSel: null };
  var TABS = [["ov", "Overview"], ["sp", "Spend by state"], ["dr", "Drill"]];

  /* ---- helpers ---- */
  function esc(s) { return RSC.esc(s == null ? "" : String(s)); }
  var num = function (v) { return RS.num(v) || 0; };
  var fmtN = function (v) { return RS.fmtN(v); };
  var money0 = function (v) { return (v == null || isNaN(v)) ? "—" : RS.money(v, 0); };
  var pct1 = function (v) { return (v == null || isNaN(v)) ? "—" : (100 * v).toFixed(1) + "%"; };
  var iso = function (d) { return d.toLocaleDateString("en-CA"); };
  var today = function () { return iso(new Date()); };
  function niceDay(s) {
    if (!s) return "—";
    return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function monthLbl(ym) {
    return new Date(ym + "-15T12:00:00").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  function monthsOf(a, b) {
    var out = [], d = a.slice(0, 7), end = b.slice(0, 7), guard = 0;
    while (d <= end && guard++ < 200) {
      out.push(d);
      var y = +d.slice(0, 4), m = +d.slice(5, 7) + 1;
      if (m > 12) { m = 1; y++; }
      d = y + "-" + String(m).padStart(2, "0");
    }
    return out;
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function coOk(r) { return !Q.co || r.Company === Q.co; }
  function palette() {
    var cs = getComputedStyle(document.body);
    var v = function (n, fb) { var x = (cs.getPropertyValue(n) || "").trim(); return x || fb; };
    if (RS.isV2 && RS.isV2()) { var W = RS.V2; return { brand: W.navy, violet: W.cat[4], muted: W.muted }; }
    return { brand: v("--brand", "#b7e23b"), violet: v("--purple", "#a78bfa"), muted: v("--muted", "#8b98a8") };
  }
  function win() {
    var D = C0.D;
    var a = Q.from || D.minDay || "2023-01-01";
    var b = Q.to || today();
    var bEff = D.maxDay && b > D.maxDay ? D.maxDay : b;
    if (bEff < a) bEff = b;
    return { a: a, b: b, bEff: bEff };
  }
  function calcNow(w) { return C0.calc({ co: Q.co, fams: Q.fams, a: w.a, bEff: w.bEff }); }
  // revenue per $1, coloured; under SMALL_SPEND placed it is greyed, said, and not rated
  function xTxt(rev, sp, small) {
    if (!(sp > 0)) return '<span class="roi-np">—</span>';
    var x = rev / sp;
    if (small && sp < SMALL_SPEND) return '<span class="roi-np" title="only ' + esc(money0(sp)) + ' placed — too little to rate">' + x.toFixed(1) + "×</span>";
    return '<span class="roi-x ' + (x >= 5 ? "hi" : x < 2 ? "lo" : "") + '">' + x.toFixed(1) + "×</span>";
  }
  function heat(rev, sp) {
    if (!(sp > 0)) return "";
    if (sp < SMALL_SPEND) return "sm";
    var x = rev / sp;
    return x >= 10 ? "h4" : x >= 5 ? "h3" : x >= 2 ? "h2" : "h1";
  }
  function cpj(sp, jobs) { var v = C0.perJob(sp, jobs); return v == null ? '<span class="roi-np">—</span>' : money0(v); }
  function howTxt(how, sp) {
    return Object.keys(how).sort(function (a, b) { return how[b] - how[a]; })
      .map(function (h) { return (HOW_SHORT[h] || h) + " " + Math.round(100 * how[h] / (sp || 1)) + "%"; }).join(" · ");
  }
  function addHow(to, from) { Object.keys(from).forEach(function (h) { to[h] = (to[h] || 0) + from[h]; }); }

  function injectStyle() {
    if (document.getElementById("roi-style")) return;
    var st = document.createElement("style");
    st.id = "roi-style";
    st.textContent = ""
      + ".roi .roi-h{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0 10px}"
      + ".roi .roi-h h2{font-size:15px;font-weight:800;letter-spacing:-.2px;margin:0;color:var(--ink)}"
      + ".roi .roi-h .roi-sub{font-size:12px;color:var(--faint)}"
      + ".roi .rs-kpis .kpi.warn .v{color:var(--warn)}"
      + ".roi .rs-grid2{grid-template-columns:repeat(2,minmax(0,1fr))}.roi .rs-grid2>*{min-width:0}"
      + "@media(max-width:1100px){.roi .rs-grid2{grid-template-columns:minmax(0,1fr)}}"
      + ".roi .rs-table td.num,.roi .rs-table th.num{white-space:nowrap}"
      + ".roi .roi-np{color:var(--faint)}"
      + ".roi .roi-x{font-weight:700;font-variant-numeric:tabular-nums}.roi .roi-x.hi{color:var(--pos)}.roi .roi-x.lo{color:var(--neg)}"
      + ".roi .roi-tot td{font-weight:800;border-top:1px solid var(--line-2)}"
      + ".roi .rs-table td small{display:block;color:var(--faint);font-size:11px;font-weight:600}"
      // the heat grid: a cell is a button into the drill
      + ".roi .roi-hm td.roi-hc{padding:3px 4px}"
      + ".roi .roi-hc button{font:inherit;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums;width:100%;min-width:52px;"
      + "border:0;border-radius:6px;padding:5px 6px;cursor:pointer;text-align:right;background:var(--panel-2);color:var(--ink)}"
      + ".roi .roi-hc button:hover{outline:2px solid var(--brand);outline-offset:-2px}"
      + ".roi .roi-hc .h4{background:var(--pos-bg);color:var(--pos)}.roi .roi-hc .h3{background:color-mix(in srgb,var(--pos-bg) 55%,var(--panel))}"
      + ".roi .roi-hc .h2{background:var(--warn-bg);color:var(--warn)}.roi .roi-hc .h1{background:var(--neg-bg);color:var(--neg)}"
      + ".roi .roi-hc .sm{background:transparent;color:var(--faint);font-weight:600}"
      // the coverage grid
      + ".roi .roi-cv td,.roi .roi-cv th{padding:4px 5px}.roi .roi-cv th.m{text-align:center;font-weight:600}"
      + ".roi .roi-cc{display:block;height:22px;min-width:30px;border-radius:6px;border:1px solid var(--line);background:var(--panel);cursor:pointer}"
      // placed by a rule is NEUTRAL grey (2026-10-20, seen live): the v2 theme makes --blue its green
      // accent, so a blue tint read almost like "entered"
      + ".roi .roi-cc.rule{background:color-mix(in srgb,var(--ink) 16%,var(--panel));border-color:transparent}"
      + ".roi .roi-cc.ent{background:var(--pos-bg);border-color:var(--pos)}"
      + ".roi .roi-cc.part{background:var(--warn-bg);border-color:var(--warn)}"
      + ".roi .roi-cc.miss{background:var(--panel);border:1px dashed var(--neg)}"
      + ".roi .roi-cc.none{background:transparent;border-color:transparent;cursor:default}"
      + ".roi .roi-cc:not(.none):hover{outline:2px solid var(--brand);outline-offset:1px}"
      + ".roi .roi-lg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}"
      + ".roi .roi-lg .roi-cc{display:inline-block;width:14px;height:12px;min-width:0;vertical-align:-2px;margin-right:5px;cursor:default}"
      + ".roi .roi-cv tr[data-f]{cursor:pointer}.roi .roi-cv tr[data-f]:hover td:first-child{text-decoration:underline}"
      + ".roi .roi-st{font-size:12px;font-weight:700;white-space:nowrap}.roi .roi-st.ok{color:var(--pos)}.roi .roi-st.no{color:var(--warn)}"
      + ".roi tr.roi-ed td{background:var(--panel-2)}"
      // the drill
      + ".roi .roi-path{display:flex;gap:6px;flex-wrap:wrap;align-items:center;font-size:13px}"
      + ".roi .roi-bc{display:flex;gap:6px;align-items:center;flex-wrap:wrap;font-size:13.5px;margin:10px 0}"
      + ".roi .roi-bc button{font:inherit;border:0;background:none;color:var(--brand);cursor:pointer;padding:0;font-weight:700}"
      + ".roi .roi-bc b{color:var(--ink)}.roi .roi-bc span{color:var(--faint)}"
      + ".roi .roi-drl tr[data-k]{cursor:pointer}.roi .roi-drl tr[data-k]:hover td:first-child{text-decoration:underline}"
      + ".roi .roi-drl .roi-dbar{height:8px;border-radius:999px;background:var(--panel-2);min-width:80px;overflow:hidden}"
      + ".roi .roi-drl .roi-dbar i{display:block;height:100%;background:var(--blue);border-radius:999px}"
      + "body.rs-app.light.v2 .roi .roi-h h2{font-weight:600}"
      + "body.rs-app.light.v2 .roi .roi-tot td{font-weight:600;background:#F8FAFC}"
      + ".roi .roi-amt-msg.bad{color:var(--neg)}"
      // the split panel (2026-10-20) lives on <body>, outside .roi, so its rules carry their own prefix
      + ".roi-ov{position:fixed;inset:0;background:var(--scrim,rgba(10,16,24,.45));z-index:60;display:flex;justify-content:flex-end}"
      + ".roi-dr{width:min(660px,100vw);height:100%;overflow:auto;background:var(--bg);color:var(--ink);padding:18px 20px 22px;"
      + "box-shadow:-12px 0 32px rgba(15,23,42,.18);display:flex;flex-direction:column;gap:12px}"
      + ".roi-dr .rs-hint{margin:0}"
      + ".roi-dr-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}"
      + ".roi-dr-t{font-size:16px;font-weight:700}.roi-dr-s{font-size:12.5px;color:var(--muted);margin-top:2px}"
      + ".roi-xb{width:32px;height:32px;flex:none;border-radius:50%;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;font:inherit}"
      + ".roi-xb:hover,.roi-qc:hover,.roi-fc:hover,.roi-sc:hover,.roi-mc:hover,.roi-nx:hover{border-color:var(--brand)}"
      + ".roi-q{display:flex;gap:6px;flex-wrap:wrap}"
      + ".roi-qc,.roi-fc,.roi-sc,.roi-nx{font:inherit;font-size:12.5px;border-radius:999px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;"
      + "padding:5px 12px;display:inline-flex;align-items:center;gap:6px;line-height:1.3;transition:border-color .12s,background .12s}"
      + ".roi-qc{font-size:12px;padding:4px 10px}.roi-qc small,.roi-fc small{color:var(--muted);font-size:11px}.roi-qc.done{color:var(--pos)}"
      + ".roi-qc.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}.roi-qc.on small{color:inherit;opacity:.75}"
      + ".roi-msh{display:flex;align-items:baseline;gap:8px;font-size:13px}.roi-msh small{color:var(--muted);font-size:12px}"
      + ".roi-mcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}"
      + ".roi-mc{font:inherit;text-align:left;border-radius:12px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;"
      + "padding:7px 10px;display:flex;flex-direction:column;gap:1px;transition:border-color .12s,background .12s}"
      + ".roi-mc-l{font-size:11.5px;color:var(--muted);font-weight:600}.roi-mc-v{font-weight:700;font-variant-numeric:tabular-nums}"
      + ".roi-mc-p{font-size:11px;color:var(--muted)}"
      + ".roi-mc.full{background:var(--pos-bg);border-color:var(--pos)}.roi-mc.full .roi-mc-v,.roi-mc.full .roi-mc-p{color:var(--pos)}"
      + ".roi-mc.part{background:var(--warn-bg);border-color:var(--warn)}.roi-mc.part .roi-mc-p{color:var(--warn)}"
      + ".roi-mc.over{background:var(--neg-bg);border-color:var(--neg)}.roi-mc.over .roi-mc-p{color:var(--neg)}"
      + ".roi-mc.on{outline:2px solid var(--ink);outline-offset:1px}"
      + ".roi-pick,.roi-empty2{border:1px dashed var(--line-2);border-radius:12px;padding:16px;text-align:center;font-size:13px;color:var(--muted)}"
      + ".roi-pick b{color:var(--ink)}.roi-pick .g{color:var(--pos);font-weight:700}.roi-pick .a{color:var(--warn);font-weight:700}"
      + ".roi-mh2{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13.5px}.roi-mh2 b{font-size:15px}"
      + ".roi-fills{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.roi-fills>span{font-size:12px;color:var(--muted);margin-right:2px}"
      + ".roi-note{font-size:12.5px;color:var(--warn);background:var(--warn-bg);border-radius:8px;padding:6px 10px}"
      + ".roi-scs{display:flex;gap:6px;flex-wrap:wrap}"
      + ".roi-sc{font-weight:600;padding:5px 11px 5px 9px}.roi-sc i{width:8px;height:8px;border-radius:50%;background:var(--c);display:inline-block}"
      + ".roi-sc small{font-size:10.5px;font-weight:600;color:var(--muted);background:var(--panel-2);border-radius:999px;padding:0 6px}"
      + ".roi-sc.on{background:color-mix(in srgb,var(--c) 14%,var(--panel));border-color:var(--c)}"
      + ".roi-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--panel-2)}.roi-bar i{display:block;height:100%}"
      + ".roi-sr{display:grid;grid-template-columns:48px minmax(0,1fr) 56px 10px 104px 76px 24px;gap:8px;align-items:center;padding:3px 0}"
      + ".roi-dl{display:flex;align-items:center;gap:3px;color:var(--muted);font-size:12.5px}"
      + ".roi-dl .rs-inp{width:100%;min-width:0;text-align:right;padding:4px 6px;font-variant-numeric:tabular-nums;border-radius:8px;font-weight:600}"
      + ".roi-rest{font:inherit;font-size:11.5px;font-weight:600;border-radius:999px;border:1px dashed var(--brand);background:transparent;color:var(--ink);"
      + "cursor:pointer;padding:3px 8px;white-space:nowrap;font-variant-numeric:tabular-nums}"
      + ".roi-rest:hover{background:var(--panel-2)}.roi-rest.off{visibility:hidden}"
      + ".roi-sr b{font-weight:700;display:flex;align-items:center;gap:6px}.roi-sr b i{width:9px;height:9px;border-radius:50%;background:var(--c);display:inline-block}"
      + ".roi-sr input[type=range]{width:100%;accent-color:var(--c)}"
      + ".roi-sr>.rs-inp{width:56px;min-width:0;text-align:right;padding:4px 6px;font-variant-numeric:tabular-nums;border-radius:8px}"
      + ".roi-sr .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}"
      + ".roi-rm{width:24px;height:24px;border-radius:50%;border:0;background:transparent;color:var(--faint);cursor:pointer;font:inherit;font-size:12px}"
      + ".roi-rm:hover{color:var(--neg);background:var(--neg-bg)}"
      + ".roi-sum{font-size:13px}.roi-sum .ok{color:var(--pos);font-weight:600}.roi-sum .bad{color:var(--neg);font-weight:600}"
      + ".roi-dr-f{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:auto;padding-top:10px;border-top:1px solid var(--line)}"
      + ".roi-dr-f .roi-amt-msg{margin-right:auto;font-size:12.5px;color:var(--muted)}.roi-dr-f .roi-amt-msg.bad{color:var(--neg)}"
      + "@media(max-width:600px){.roi-sr{grid-template-columns:40px minmax(0,1fr) 50px 10px 92px 24px}.roi-rest{display:none}}";
    document.head.appendChild(st);
  }

  /* ---- render ---- */
  async function render(host) {
    injectStyle();
    if (!C0.D.ready) {
      host.innerHTML = '<div class="rs-loading">Reading every ad dollar, lead and job by source…<div class="bar"><i></i></div></div>';
      try { await C0.ensure(); }
      catch (e) {
        host.innerHTML = '<div class="panel"><div class="panel-head"><span class="panel-title">Return on Investment could not load</span></div>'
          + '<div class="rs-hint">' + esc(e.message) + "</div></div>";
        return;
      }
      if (!host.isConnected) return;
    }
    boot();
    // a link wins on every arrival: #page=marketing-roi&tab=dr&src=Yelp (Source Analysis' strip)
    var h = location.hash || "";
    var tk = /[#&]tab=(ov|sp|dr)\b/.exec(h), lk = /[#&]src=([^&]+)/.exec(h);
    if (tk) Q.tab = tk[1];
    if (lk) {
      var lf = null;
      try { lf = decodeURIComponent(lk[1]); } catch (e) { lf = null; }
      if (lf && C0.D.byFam.has(lf)) { Q.path = "source"; Q.keys = [lf]; if (!tk) Q.tab = "dr"; }
    }
    if ((C0.D.amts == null || C0.D.amtErr) && !C0.D.loadingAmts) {
      C0.loadAmounts().then(function () { if (host.isConnected && host.querySelector(".roi")) paint(host); });
    }
    paint(host);
  }

  function boot() {
    if (Q.bootDone) return;
    Q.bootDone = true;
    var t = lsGet("roiTab");
    if (t === "sp" || t === "dr") Q.tab = t;
    var y = new Date().getFullYear();
    Q.from = y + "-01-01"; Q.to = today();
  }

  function setHash() {
    try { history.replaceState(null, "", "#page=marketing-roi&tab=" + Q.tab); } catch (e) {}
  }

  function reloadAmounts(host) {
    return C0.loadAmounts().then(function () { if (host.isConnected && host.querySelector(".roi")) paint(host); });
  }

  function paint(host) {
    host.querySelectorAll("canvas").forEach(function (c) { var ch = window.Chart && Chart.getChart ? Chart.getChart(c) : null; if (ch) ch.destroy(); });
    setHash();
    var w = win(), R = calcNow(w);
    V.R = R;
    host.innerHTML = '<div class="roi"><div class="rs-page-head"><h1>Return on Investment</h1>'
      + "<p>Where the advertising money goes, state by state, and the revenue it brings back. Revenue per $1 is "
      + "revenue (Total Bill) of a source's jobs in a state ÷ that source's ad spend placed there — revenue, not profit.</p></div>"
      + '<div class="rs-tabs" id="roiTabs">' + TABS.map(function (t) {
          return '<button type="button" class="rs-tab' + (Q.tab === t[0] ? " on" : "") + '" data-tab="' + t[0] + '">' + t[1] + "</button>";
        }).join("") + "</div>"
      + '<div class="rs-bar"><div id="roiFam"></div><div id="roiCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="roiDate"></div></div><div id="roiSt"></div></div>'
      + '<div id="roiBody"></div></div>';
    host.querySelectorAll("#roiTabs [data-tab]").forEach(function (b) {
      b.onclick = function () {
        if (Q.tab === b.dataset.tab) return;
        Q.tab = b.dataset.tab; lsSet("roiTab", Q.tab); paint(host);
        var sc = host.closest && host.closest(".rs-content"); if (sc) sc.scrollTop = 0;
      };
    });
    mountBar(host, w);
    var body = host.querySelector("#roiBody");
    try {
      if (Q.tab === "sp") paintSpend(host, body, w, R);
      else if (Q.tab === "dr") paintDrill(host, body, w, R);
      else paintOverview(host, body, w, R);
    } catch (e) {
      body.innerHTML = '<div class="panel"><div class="rs-hint">This tab could not draw: ' + esc(e.message) + "</div></div>";
    }
    // after a save the split panel opens the next source (or stays on the month it saved)
    if (V.reopen && !C0.D.loadingAmts) {
      var nf = V.reopen, ns = V.reopenSel; V.reopen = null; V.reopenSel = null;
      openSplit(host, nf);
      if (SP && ns && SP.months.indexOf(ns) >= 0) { SP.sel = ns; drawSplit(host); }
    } else if (SP) drawSplit(host);
  }

  /* the bar: Sources (several; none = every paying source), Company, Period, State -- every number
     on every tab follows all four */
  function mountBar(host, w) {
    var D = C0.D, led = D.ledgerEnd, e = led && w.bEff > led ? led : w.bEff, m0 = w.a.slice(0, 8) + "01";
    var spent = {};
    (D.rows || []).forEach(function (r) {
      if ((Q.co && r.co !== Q.co) || r._m < m0 || r._m > e) return;
      spent[r.fam] = (spent[r.fam] || 0) + r.sp;
    });
    Q.fams.forEach(function (f) { if (!(f in spent)) spent[f] = 0; });
    var fams = Object.keys(spent).filter(function (f) { return spent[f] > 0.5 || Q.fams.has(f); })
      .sort(function (a, b) { return spent[b] - spent[a] || a.localeCompare(b); });
    RSC.localMulti(host.querySelector("#roiFam"), {
      label: "Sources", emptyLabel: "All sources",
      values: fams.map(function (f) { return { v: f, l: f }; }),
      selected: Q.fams, startOpen: Q.reopen === "fam",
      onChange: function (set) { Q.fams = new Set(set); Q.reopen = "fam"; Q.keys = []; paint(host); },
    });
    RSC.localSelect(host.querySelector("#roiCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: Q.co,
      onChange: function (v) { Q.co = v; Q.keys = []; paint(host); },
    });
    RSC.dateRange(host.querySelector("#roiDate"), {
      get: function () { return { from: Q.from, to: Q.to }; },
      set: function (f, t) { Q.from = f; Q.to = t; },
      onChange: function () { paint(host); },
    });
    RSC.localMulti(host.querySelector("#roiSt"), {
      label: "State", emptyLabel: "All states",
      values: SERVICE_STATES.concat([OTHER_ST]).map(function (x) { return { v: x, l: x }; }),
      selected: Q.states, startOpen: Q.reopen === "st",
      onChange: function (set) { Q.states = new Set(set); Q.reopen = "st"; Q.keys = []; paint(host); },
    });
    Q.reopen = null;
  }

  /* per state: only cells where spend IS placed count, so a source whose spend is unplaced never
     inflates a state's return with revenue it did not pay for. A state filter keeps those states,
     spend and revenue on the same footing; spend no rule can place has no state and stays named. */
  function byState(R) {
    var PS = Q.states.size ? Q.states : null, stIn = function (s0) { return !PS || PS.has(s0); };
    var st = SERVICE_STATES.concat([OTHER_ST]), byS = {}, T = { sp: 0, rev: 0, jobs: 0, revAll: 0, spPS: 0, revPS: 0, jobsPS: 0 };
    st.forEach(function (s0) { byS[s0] = { sp: 0, rev: 0, jobs: 0, how: {} }; });
    Object.keys(R.fams).forEach(function (f) {
      Object.keys(R.fams[f].st).forEach(function (s0) {
        var c = R.fams[f].st[s0];
        T.revAll += c.rev;
        if (!(c.sp > 0)) return;
        var B = byS[s0]; B.sp += c.sp; B.rev += c.rev; B.jobs += c.jobs; addHow(B.how, c.how);
        T.sp += c.sp; T.rev += c.rev; T.jobs += c.jobs;
        if (stIn(s0)) { T.spPS += c.sp; T.revPS += c.rev; T.jobsPS += c.jobs; }
      });
    });
    return { PS: PS, stIn: stIn, byS: byS, T: T, st: st };
  }

  function clipHint(R) {
    return R.clipped ? "Spend up to <b>" + esc(niceDay(R.e)) + "</b>, the last day the advertising ledger is posted (revenue stops there too). " : "";
  }

  /* ================================================================ OVERVIEW ==== */
  function paintOverview(host, body, w, R) {
    var B = byState(R), PS = B.PS, T = B.T;
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0; })
      .sort(function (a, b) { return R.fams[b].sp - R.fams[a].sp; });
    var unplTot = R.total - T.sp, unplFams = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; });
    var sp = PS ? T.spPS : T.sp, rev = PS ? T.revPS : T.rev, jobs = PS ? T.jobsPS : T.jobs;
    var k = [
      { label: "Ad spend", value: money0(PS ? T.spPS : R.total), sub: PS ? "placed in " + Array.from(PS).join(", ") + " · " + money0(R.total) + " in all" : famList.length + " paying sources" },
      { label: "Placed in a state", value: R.total ? pct1(sp / R.total) : "—", sub: money0(sp) + " of it" },
      { label: "Revenue per $1", value: sp > 0 ? (rev / sp).toFixed(1) + "×" : "—", sub: money0(rev) + " revenue ÷ " + money0(sp) + " placed" },
      { label: "Cost per job", value: C0.perJob(sp, jobs) == null ? "—" : money0(sp / jobs), sub: money0(sp) + " placed ÷ " + fmtN(jobs) + " jobs moved" },
      { label: "Not placed yet", value: money0(unplTot), sub: unplFams.length ? unplFams.length + " source" + (unplFams.length === 1 ? "" : "s") + " — Spend by state" : "nothing missing",
        tone: unplTot > 0.5 ? "warn" : "" },
    ];
    var stRows = B.st.filter(function (s0) { return B.stIn(s0) && (B.byS[s0].sp > 0 || B.byS[s0].rev > 0); })
      .sort(function (a, b) { return B.byS[b].sp - B.byS[a].sp; });
    var stTable = '<div class="panel"><div class="panel-head"><span class="panel-title">By state</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Spend placed</th>'
      + '<th class="num">Revenue</th><th class="num">Jobs</th><th class="num">Revenue per $1</th><th class="num">Cost per job</th><th>How the spend was placed</th></tr></thead><tbody>'
      + stRows.map(function (s0) {
          var X = B.byS[s0];
          return '<tr data-st="' + esc(s0) + '" style="cursor:pointer"><td>' + esc(s0) + '</td><td class="num">' + money0(X.sp) + '</td><td class="num">' + money0(X.rev)
            + '</td><td class="num">' + fmtN(X.jobs) + '</td><td class="num">' + xTxt(X.rev, X.sp) + '</td><td class="num">' + cpj(X.sp, X.jobs)
            + '</td><td class="roi-np">' + esc(howTxt(X.how, X.sp)) + "</td></tr>";
        }).join("")
      + (unplTot > 0.5 ? '<tr><td>Not placed' + (PS ? ", any state" : "") + '</td><td class="num">' + money0(unplTot)
          + '</td><td class="num roi-np">—</td><td></td><td class="num roi-np">—</td><td></td><td class="roi-np">see Spend by state</td></tr>' : "")
      + '</tbody><tfoot><tr class="roi-tot"><td>' + (PS ? "These states" : "All") + '</td><td class="num">' + money0(PS ? T.spPS : R.total)
      + '</td><td class="num">' + money0(rev) + '</td><td class="num">' + fmtN(jobs) + '</td><td class="num">' + xTxt(rev, sp)
      + '</td><td class="num">' + cpj(sp, jobs) + "</td><td></td></tr></tfoot></table></div></div>";
    // every source x state, coloured by revenue per $1; a cell opens the drill
    var cols = B.st.filter(function (s0) { return B.stIn(s0) && famList.some(function (f) { var c = R.fams[f].st[s0]; return c && (c.sp > 0 || c.rev > 0); }); });
    var famRows = !PS ? famList : famList.filter(function (f) {
      return R.fams[f].unpl > 0.5 || cols.some(function (s0) { var c = R.fams[f].st[s0]; return c && (c.sp > 0 || c.rev > 0); });
    });
    var hm = '<div class="panel"><div class="panel-head"><span class="panel-title">Every source by state · revenue per $1</span>'
      + '<span class="roi-sub" style="margin-left:auto;font-size:12px;color:var(--faint)">click a cell to drill · "—" no spend placed there · grey = under $500 placed</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table roi-hm"><thead><tr><th>Source</th><th class="num">' + (PS ? "Spend placed here" : "Spend") + "</th>"
      + cols.map(function (s0) { return '<th class="num">' + esc(s0 === OTHER_ST ? "Other" : s0) + "</th>"; }).join("")
      + '<th class="num">Not placed</th><th class="num">' + (PS ? "These states" : "All states") + "</th></tr></thead><tbody>"
      + famRows.map(function (f) {
          var F = R.fams[f], revF = 0, spF = F.sp;
          if (PS) { spF = 0; cols.forEach(function (s0) { var c = F.st[s0]; if (c && c.sp > 0) { spF += c.sp; revF += c.rev; } }); }
          else Object.keys(F.st).forEach(function (s0) { revF += F.st[s0].rev; });
          return "<tr><td>" + esc(f) + '</td><td class="num">' + money0(spF) + "</td>"
            + cols.map(function (s0) {
                var c = F.st[s0];
                if (!c || !(c.sp > 0)) return '<td class="num roi-hc"' + (c && c.rev ? ' title="' + esc(money0(c.rev) + " revenue, no spend placed") + '"' : "") + '><span class="roi-np">—</span></td>';
                return '<td class="num roi-hc"><button type="button" class="' + heat(c.rev, c.sp) + '" data-f="' + esc(f) + '" data-s="' + esc(s0) + '" title="'
                  + esc(money0(c.sp) + " spend · " + money0(c.rev) + " revenue · " + c.jobs + " jobs") + '">' + (c.rev / c.sp).toFixed(1) + "×</button></td>";
              }).join("")
            + '<td class="num">' + (F.unpl > 0.5 ? money0(F.unpl) : '<span class="roi-np">—</span>') + "</td>"
            + '<td class="num" title="' + esc(money0(revF) + " revenue ÷ " + money0(spF) + " spend") + '">' + xTxt(revF, spF) + "</td></tr>";
        }).join("")
      + "</tbody></table></div></div>";
    body.innerHTML = '<div class="panel"><div class="rs-hint">' + clipHint(R)
      + "Spend is placed from the source's label (post cards, Yelp-DE), Google's own state report, Thumbtack's cost per lead, "
      + "Angi's and Google Local's leads by state, or the dollars entered per month on <b>Spend by state</b>. Cost per job is spend "
      + "placed ÷ jobs moved (closings) of the same sources in the same states.</div><div class=\"rs-kpis\" id=\"roiK\"></div></div>"
      + stTable + hm
      + '<div class="roi-h"><h2>Spend and return · by source</h2><span id="roiSpendPills"></span></div><div id="roiSpendAll"></div>';
    RSC.kpis(body.querySelector("#roiK"), k);
    body.querySelectorAll("tr[data-st]").forEach(function (tr) {
      tr.onclick = function () { Q.tab = "dr"; Q.path = "state"; Q.keys = [tr.dataset.st]; lsSet("roiTab", "dr"); paint(host); };
    });
    body.querySelectorAll(".roi-hc button").forEach(function (b) {
      b.onclick = function () { Q.tab = "dr"; Q.path = "source"; Q.keys = [b.dataset.f, b.dataset.s]; lsSet("roiTab", "dr"); paint(host); };
    });
    paintSpendAll(host, w, R);
  }

  /* SPEND AND RETURN, ONE ROW PER SOURCE (his pick 2026-10-19, moved here from Source Analysis):
     ad spend, leads, cost per lead, bookings, cost per booking, jobs, cash, cash per $1 and revenue
     per $1, then the months chart. Under a State filter spend is what is PLACED in those states and
     leads, bookings, jobs and cash are the same states'. */
  function paintSpendAll(host, w, R) {
    var el = host.querySelector("#roiSpendAll"), pills = host.querySelector("#roiSpendPills");
    if (!el) return;
    var D = C0.D, e = R.e, PS = Q.states.size ? Q.states : null;
    var stIn = function (st) { return !PS || PS.has(st); };
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0.5; });
    var rows = famList.map(function (f) {
      var F = R.fams[f], sp = 0, rev = 0;
      if (PS) Object.keys(F.st).forEach(function (st) { var c = F.st[st]; if (stIn(st) && c.sp > 0) { sp += c.sp; rev += c.rev; } });
      else { sp = F.sp; Object.keys(F.st).forEach(function (st) { rev += F.st[st].rev; }); }
      var v = D.byFam.get(f) || { leads: [], jobs: [] }, leads = 0, conf = 0, jobs = 0, cash = 0;
      v.leads.forEach(function (r) {
        if (!coOk(r) || !stIn(r._st)) return;
        if (inR(r._cd, w.a, e)) leads++;
        if (inR(r._bd, w.a, e)) conf++;
      });
      v.jobs.forEach(function (r) {
        if (!coOk(r) || !stIn(r._st) || !inR(r._d, w.a, e)) return;
        if (r["Record Source"] === "closing") jobs++;
        cash += num(r.Cash);
      });
      return { f: f, sp: sp, rev: rev, leads: leads, conf: conf, jobs: jobs, cash: cash };
    }).filter(function (x) { return x.sp > 0.5 || x.leads || x.jobs; })
      .sort(function (a, b) { return b.sp - a.sp || a.f.localeCompare(b.f); });
    var T = rows.reduce(function (a, x) { a.sp += x.sp; a.rev += x.rev; a.leads += x.leads; a.conf += x.conf; a.jobs += x.jobs; a.cash += x.cash; return a; },
      { sp: 0, rev: 0, leads: 0, conf: 0, jobs: 0, cash: 0 });
    if (pills) pills.innerHTML = D.ledgerEnd ? '<span class="rs-pill info">spend through ' + esc(niceDay(D.ledgerEnd)) + "</span>" : "";
    var per = function (a, b) { return b > 0 && a ? money0(b / a) : '<span class="roi-np">—</span>'; };
    var cashX = function (cash, sp) {
      if (!(sp > 0)) return '<span class="roi-np">—</span>';
      var x = cash / sp;
      return '<span class="roi-x ' + (x >= 5 ? "hi" : x < 1 ? "lo" : "") + '">$' + x.toFixed(2) + "</span>";
    };
    var cells = function (x) {
      return '<td class="num">' + money0(x.sp) + '</td><td class="num">' + fmtN(x.leads) + '</td><td class="num">' + per(x.leads, x.sp)
        + '</td><td class="num">' + fmtN(x.conf) + '</td><td class="num">' + per(x.conf, x.sp)
        + '</td><td class="num">' + fmtN(x.jobs) + '</td><td class="num">' + money0(x.cash) + '</td><td class="num">' + cashX(x.cash, x.sp)
        + '</td><td class="num">' + xTxt(x.rev, x.sp) + "</td>";
    };
    el.innerHTML = '<div class="panel"><div class="rs-hint">'
      + (R.clipped ? "Up to <b>" + esc(niceDay(e)) + "</b>, the last day the advertising ledger is posted — leads, bookings and jobs after it "
          + "would read as free, so they are left out. " : "For the period. ")
      + (PS ? "Spend is what is <b>placed</b> in " + esc(Array.from(PS).join(", ")) + " (spend no rule can place has no state and is not in it); "
            + "leads, bookings, jobs and cash are the same states'. " : "Spend is each source's whole advertising ledger. ")
      + "Cash is Net Cash + Card of the source's jobs, by move date.</div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">' + (PS ? "Spend placed" : "Ad spend") + "</th>"
      + '<th class="num">Leads</th><th class="num">Cost per lead</th><th class="num">Booked</th><th class="num">Cost per booking</th>'
      + '<th class="num">Jobs moved</th><th class="num">Cash collected</th><th class="num">Cash per $1</th><th class="num">Revenue per $1</th></tr></thead><tbody>'
      + (rows.length ? rows.map(function (x) { return "<tr><td>" + esc(x.f) + "</td>" + cells(x) + "</tr>"; }).join("")
          : '<tr><td colspan="10" class="roi-np">No ad spend on file for these picks.</td></tr>')
      + '</tbody><tfoot><tr class="roi-tot"><td>' + (rows.length === 1 ? "Total" : "All " + rows.length + " sources") + "</td>" + cells(T) + "</tr></tfoot></table></div></div>";
    var ms = monthsOf(w.a, w.bEff);
    if (ms.length > 48) ms = ms.slice(-48);
    var spM = {}, cashM = {}, jobsM = {}, ledM = D.ledgerEnd ? D.ledgerEnd.slice(0, 7) : null;
    var keep = {}; rows.forEach(function (x) { keep[x.f] = 1; });
    if (PS) {
      (D.rows || []).forEach(function (r) {
        if ((Q.co && r.co !== Q.co) || !keep[r.fam] || r.how === "Not placed" || !PS.has(stateKey(r.st))) return;
        var m = r._m.slice(0, 7); spM[m] = (spM[m] || 0) + r.sp;
      });
    } else {
      rows.forEach(function (x) {
        ((D.byFam.get(x.f) || { spend: [] }).spend).forEach(function (r) {
          if (!coOk(r) || !inR(r._d, w.a, w.bEff)) return;
          var m = r._d.slice(0, 7); spM[m] = (spM[m] || 0) + r._sp;
        });
      });
    }
    rows.forEach(function (x) {
      ((D.byFam.get(x.f) || { jobs: [] }).jobs).forEach(function (r) {
        if (!coOk(r) || !stIn(r._st) || !inR(r._d, w.a, w.bEff)) return;
        var m = r._d.slice(0, 7);
        cashM[m] = (cashM[m] || 0) + num(r.Cash);
        if (r["Record Source"] === "closing") jobsM[m] = (jobsM[m] || 0) + 1;
      });
    });
    RSC.chartCard(el, {
      title: "Ad spend and cash collected, by month" + (Q.fams.size ? " · " + Array.from(Q.fams).join(", ") : " · every paying source"),
      key: "roi-spend-all",
      buildChart: function (canvas) {
        var P = palette();
        return new Chart(canvas, {
          type: "bar",
          data: { labels: ms.map(monthLbl), datasets: [
            { label: "Ad spend (right axis)", data: ms.map(function (m) { return ledM && m > ledM ? null : Math.round(spM[m] || 0); }),
              backgroundColor: P.violet, yAxisID: "y1" },
            { label: "Cash collected (left axis)", data: ms.map(function (m) { return Math.round(cashM[m] || 0); }),
              backgroundColor: P.brand, yAxisID: "y" },
          ] },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                     scales: {
                       y: { beginAtZero: true, position: "left", title: { display: true, text: "Cash collected", color: P.muted },
                            ticks: { callback: function (v) { return RS.moneyC(v); } } },
                       y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false },
                             title: { display: true, text: "Ad spend", color: P.muted },
                             ticks: { callback: function (v) { return RS.moneyC(v); } } },
                     },
                     plugins: { tooltip: { callbacks: { label: function (ctx) {
                       var nm = ctx.dataset.label.replace(/ \((left|right) axis\)$/, "");
                       if (ctx.raw == null) return nm + ": ledger not posted yet";
                       return nm + ": " + money0(ctx.raw);
                     } } } } },
        });
      },
      buildTable: function () {
        return '<table class="rs-table"><thead><tr><th>Month</th><th class="num">Ad spend</th>'
          + '<th class="num">Cash collected</th><th class="num">Jobs moved</th></tr></thead><tbody>'
          + ms.map(function (m) {
              var late = ledM && m > ledM;
              return "<tr><td>" + esc(monthLbl(m)) + "</td>"
                + (late ? '<td class="num dim">not posted</td>' : '<td class="num">' + money0(spM[m] || 0) + "</td>")
                + '<td class="num">' + money0(cashM[m] || 0) + '</td><td class="num">' + fmtN(jobsM[m] || 0) + "</td></tr>";
            }).join("") + "</tbody></table>";
      },
    });
  }

  /* ========================================================== SPEND BY STATE ==== */
  /* Is every month of every source placed in a state? One row per source with spend in the period,
     one cell per month: placed by a rule (blue), entered or imported (green), part placed (amber),
     not placed (dashed), no spend (empty). A row or a cell opens the split panel on that source. */
  function paintSpend(host, body, w, R) {
    var co = Q.co;
    var ms = monthsOf(R.m0, R.e);
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0.5; })
      .sort(function (a, b) { return R.fams[b].sp - R.fams[a].sp; });
    var state = function (M) {
      if (!M || !(M.sp > 0.5)) return "none";
      if (M.unpl > 0.5) return (M.typed > 0.5 || M.rule > 0.5) ? "part" : "miss";
      return M.typed > 0.5 ? "ent" : "rule";
    };
    var WORD = { rule: "placed by a rule", ent: "entered", part: "part placed", miss: "not placed", none: "no spend" };
    var grid = '<div class="panel"><div class="panel-head"><span class="panel-title">Every source, month by month</span>'
      + '<span style="margin-left:auto;font-size:12px;color:var(--faint)">click a source or a month to split it</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table roi-cv"><thead><tr><th>Source</th><th class="num">Spend</th>'
      + ms.map(function (m) { return '<th class="m">' + esc(monthLbl(m)) + "</th>"; }).join("")
      + '<th class="num">Placed</th></tr></thead><tbody>'
      + famList.map(function (f) {
          var F = R.fams[f], n = 0, ok = 0;
          var tds = ms.map(function (m) {
            var M = F.mon[m], s = state(M);
            if (s !== "none") { n++; if (s === "rule" || s === "ent") ok++; }
            var tip = s === "none" ? "no spend" : monthLbl(m) + ": " + money0(M.sp) + " spend · " + money0(M.rule) + " by a rule · "
              + money0(M.typed) + " entered · " + money0(M.unpl) + " not placed";
            return '<td><span class="roi-cc ' + s + '" data-ym="' + esc(m) + '" title="' + esc(tip) + '" aria-label="' + esc(f + " " + monthLbl(m) + ": " + WORD[s]) + '"></span></td>';
          }).join("");
          return '<tr data-f="' + esc(f) + '"' + (SP && SP.fam === f ? ' class="roi-ed"' : "") + "><td>" + esc(f) + '</td><td class="num">' + money0(F.sp) + "</td>" + tds
            + '<td class="num"><span class="roi-st ' + (ok === n ? "ok" : "no") + '">' + ok + " / " + n + "</span></td></tr>";
        }).join("")
      + "</tbody></table></div>"
      + '<div class="roi-lg"><span><i class="roi-cc rule"></i>placed by a rule (label, Google report, leads, lead cost)</span>'
      + '<span><i class="roi-cc ent"></i>entered or imported</span><span><i class="roi-cc part"></i>part placed</span>'
      + '<span><i class="roi-cc miss"></i>not placed</span></div></div>';
    body.innerHTML = '<div class="panel"><div class="rs-hint">' + clipHint(R)
      + "A source the data can place (its label, Google's state report, Thumbtack's cost per lead, Angi's and Google Local's leads) "
      + "needs nothing here. For the rest, open the source and say month by month where its money went — in % or $. "
      + "What you leave out stays not placed, and its return counts by state at once on every tab.</div></div>"
      + grid + '<div class="rs-grid2">' + missingHtml(R) + noStateHtml(R) + "</div>";
    if (co) {
      body.querySelectorAll(".roi-cv tr[data-f]").forEach(function (tr) {
        tr.onclick = function (ev) {
          var cc = ev.target.closest && ev.target.closest(".roi-cc");
          if (cc && cc.classList.contains("none")) return;
          V.note = ""; openSplit(host, tr.dataset.f);
          var ym = cc && cc.dataset.ym;
          if (SP && ym && SP.months.indexOf(ym) >= 0) { SP.sel = ym; drawSplit(host); }
        };
      });
    }
    wireAmounts(host, body);
  }

  /* MISSING DATA: spend no rule can place, by source -- each opens the split panel */
  function missingHtml(R) {
    var co = Q.co;
    var fams = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; })
      .sort(function (a, b) { return R.unpl[b].sp - R.unpl[a].sp; });
    var done = !co ? [] : Object.keys(R.mon).filter(function (f) { return fams.indexOf(f) < 0 && C0.typedIn(co, f, R).length; }).sort();
    var row = function (f, all) {
      var U = R.unpl[f] || { sp: 0, months: {} }, ms = Object.keys(U.months).sort(), open = !!SP && SP.fam === f;
      var t = co ? C0.typedIn(co, f, R) : [], tot = 0;
      t.forEach(function (ym) { C0.amtOf(co, f, ym).forEach(function (x) { tot += num(x.Amount); }); });
      return "<tr" + (open ? ' class="roi-ed"' : "") + "><td>" + esc(f)
        + (t.length ? '<small class="roi-np">' + money0(tot) + " entered in " + t.length + " month" + (t.length === 1 ? "" : "s") + "</small>" : "") + "</td>"
        + '<td class="num' + (all ? " roi-np" : "") + '">' + (all ? "all placed" : money0(U.sp))
        + "<small>" + (all ? "by the amounts entered" : ms.length + " month" + (ms.length === 1 ? "" : "s")
          + (ms.length ? ", " + esc(monthLbl(ms[0])) + (ms.length > 1 ? "–" + esc(monthLbl(ms[ms.length - 1])) : "") : "")) + "</small></td>"
        + '<td style="text-align:right">' + (co ? '<button type="button" class="rs-btn" data-amt="' + esc(f) + '">'
          + (t.length ? "Change split" : "Split by state") + "</button>" : "") + "</td></tr>";
    };
    var over = R.over || [];
    var D = C0.D;
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Missing data</span></div>'
      + '<div class="rs-hint">' + (co ? "" : "<b>Pick one company in the bar to split spend.</b> ")
      + (V.note ? "<b>" + esc(V.note) + "</b> " : "")
      + (D.amtErr ? "Saved amounts could not be read (" + esc(D.amtErr.message) + "). " : "")
      + (over.length ? '<b class="roi-amt-msg bad">More entered than the month now has:</b> ' + over.slice(0, 6).map(function (o) {
          return esc(o.fam + " " + monthLbl(o.ym)) + " (" + money0(o.typed) + " entered, " + money0(o.spend) + " not placed)";
        }).join(" · ") + " — scaled down to fit; change the amounts. " : "Spend no rule can place in a state, by source.") + "</div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">Not placed</th><th></th></tr></thead><tbody>'
      + (fams.map(function (f) { return row(f, false); }).join("") || '<tr><td colspan="3" class="roi-np">Every ad dollar in the period is placed in a state.</td></tr>')
      + done.map(function (f) { return row(f, true); }).join("")
      + "</tbody></table></div></div>";
  }
  function noStateHtml(R) {
    var NS = R.noState;
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Jobs with no state</span></div><div class="rs-hint">' + (NS.n
      ? "<b>" + fmtN(NS.n) + " closing" + (NS.n === 1 ? "" : "s") + " with no state</b> (" + money0(NS.rev) + " billed) count toward no state: "
        + NS.rows.slice(0, 12).map(function (r) { return esc((r["Unique Key"] || "") + " · " + niceDay(r._d)); }).join(", ") + (NS.n > 12 ? " …" : "")
        + ". The state comes from the closing's pickup zip; fixing the zip on the closing sheet fixes it here."
      : "Every closing in the period has a state.") + "</div></div>";
  }

  /* =================================================================== DRILL ==== */
  /* state > source > month, or source > state > month. Every row carries its dollars beside its
     ratio; under $500 placed the ratio is greyed and not rated. */
  function paintDrill(host, body, w, R) {
    var B = byState(R), PS = B.PS;
    var path = Q.path === "source" ? "source" : "state", keys = Q.keys.slice(0, 2);
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0; });
    var levelName = path === "state" ? ["State", "Source", "Month"] : ["Source", "State", "Month"];
    var rows = [], lvl = keys.length;
    var push = function (k, label, sp, rev, jobs, how, extra) { rows.push({ k: k, label: label, sp: sp, rev: rev, jobs: jobs, how: how || {}, extra: extra || "" }); };
    var cellsOf = function (f, s0) { var F = R.fams[f]; return F && F.st[s0]; };
    if (lvl === 0 && path === "state") {
      B.st.forEach(function (s0) { var X = B.byS[s0]; if (B.stIn(s0) && (X.sp > 0 || X.rev > 0)) push(s0, s0, X.sp, X.rev, X.jobs, X.how); });
    } else if (lvl === 0) {
      famList.forEach(function (f) {
        var F = R.fams[f], sp = 0, rev = 0, jobs = 0, how = {};
        Object.keys(F.st).forEach(function (s0) { var c = F.st[s0]; if (c.sp > 0 && B.stIn(s0)) { sp += c.sp; rev += c.rev; jobs += c.jobs; addHow(how, c.how); } });
        push(f, f, sp, rev, jobs, how, F.unpl > 0.5 ? money0(F.unpl) + " not placed" : "");
      });
    } else if (lvl === 1 && path === "state") {
      famList.forEach(function (f) { var c = cellsOf(f, keys[0]); if (c && c.sp > 0) push(f, f, c.sp, c.rev, c.jobs, c.how); });
    } else if (lvl === 1) {
      var F1 = R.fams[keys[0]];
      if (F1) Object.keys(F1.st).forEach(function (s0) { var c = F1.st[s0]; if (B.stIn(s0) && c.sp > 0) push(s0, s0, c.sp, c.rev, c.jobs, c.how); });
      if (F1 && F1.unpl > 0.5) push(null, "Not placed", F1.unpl, 0, 0, {}, "no state yet — Spend by state");
    } else {
      var f2 = path === "state" ? keys[1] : keys[0], s2 = path === "state" ? keys[0] : keys[1], c2 = cellsOf(f2, s2);
      monthsOf(R.m0, R.e).forEach(function (m) { var x = c2 && c2.m[m]; if (x && (x.sp > 0 || x.rev > 0)) push(null, monthLbl(m), x.sp, x.rev, x.jobs); });
    }
    if (lvl < 2) rows.sort(function (a, b) { return b.sp - a.sp || b.rev - a.rev; });
    var maxSp = rows.reduce(function (a, r) { return Math.max(a, r.sp); }, 0) || 1;
    var T = rows.reduce(function (a, r) { if (r.k !== null || lvl === 2) { a.sp += r.sp; a.rev += r.rev; a.jobs += r.jobs; } return a; }, { sp: 0, rev: 0, jobs: 0 });
    var crumbs = ['<button type="button" data-lv="0">' + (path === "state" ? "All states" : "All sources") + "</button>"];
    keys.forEach(function (k, i) { crumbs.push("<span>›</span>" + (i === keys.length - 1 && lvl < 2 ? "<b>" + esc(k) + "</b>" : '<button type="button" data-lv="' + (i + 1) + '">' + esc(k) + "</button>")); });
    if (lvl === 2) crumbs[crumbs.length - 1] = "<span>›</span><b>" + esc(keys[1]) + "</b>";
    crumbs.push("<span>› by " + levelName[lvl].toLowerCase() + "</span>");
    var showHow = lvl < 2;
    body.innerHTML = '<div class="panel"><div class="roi-path"><span style="color:var(--muted)">Drill</span>'
      + '<div class="rs-seg" id="roiPath"><button type="button" data-p="state">State › source › month</button>'
      + '<button type="button" data-p="source">Source › state › month</button></div></div>'
      + '<div class="roi-bc">' + crumbs.join("") + "</div>"
      + '<div class="rs-tablewrap roi-drl"><table class="rs-table"><thead><tr><th>' + levelName[lvl] + '</th><th class="num">Spend placed</th><th></th>'
      + '<th class="num">Revenue</th><th class="num">Jobs</th><th class="num">Revenue per $1</th><th class="num">Cost per job</th>'
      + (showHow ? "<th>How the spend was placed</th>" : "") + "</tr></thead><tbody>"
      + (rows.length ? rows.map(function (r) {
          var can = lvl < 2 && r.k !== null;
          return "<tr" + (can ? ' data-k="' + esc(r.k) + '"' : "") + "><td>" + esc(r.label) + (r.extra ? "<small>" + esc(r.extra) + "</small>" : "") + "</td>"
            + '<td class="num">' + money0(r.sp) + '</td><td><div class="roi-dbar"><i style="width:' + Math.round(100 * r.sp / maxSp) + '%"></i></div></td>'
            + '<td class="num">' + (r.k === null && lvl < 2 ? '<span class="roi-np">—</span>' : money0(r.rev)) + '</td><td class="num">' + (r.k === null && lvl < 2 ? "" : fmtN(r.jobs))
            + '</td><td class="num">' + (r.k === null && lvl < 2 ? '<span class="roi-np">—</span>' : xTxt(r.rev, r.sp, true)) + '</td><td class="num">' + (r.k === null && lvl < 2 ? "" : cpj(r.sp, r.jobs)) + "</td>"
            + (showHow ? '<td class="roi-np">' + esc(howTxt(r.how, r.sp)) + "</td>" : "") + "</tr>";
        }).join("") : '<tr><td colspan="8" class="roi-np">Nothing placed here for these picks.</td></tr>')
      + '</tbody><tfoot><tr class="roi-tot"><td>' + (lvl === 2 ? "All months" : "Placed") + '</td><td class="num">' + money0(T.sp) + "</td><td></td>"
      + '<td class="num">' + money0(T.rev) + '</td><td class="num">' + fmtN(T.jobs) + '</td><td class="num">' + xTxt(T.rev, T.sp) + '</td><td class="num">' + cpj(T.sp, T.jobs) + "</td>"
      + (showHow ? "<td></td>" : "") + "</tr></tfoot></table></div>"
      + '<div class="rs-hint" style="margin-top:8px">' + clipHint(R) + (PS ? "State filter: " + esc(Array.from(PS).join(", ")) + ". " : "")
      + "Revenue is the Total Bill of the source's jobs in the state, by move date; a ratio on under $500 placed is greyed and not rated.</div></div>";
    body.querySelectorAll("#roiPath [data-p]").forEach(function (b) {
      b.classList.toggle("on", b.dataset.p === path);
      b.onclick = function () { if (Q.path === b.dataset.p) return; Q.path = b.dataset.p; Q.keys = []; paint(host); };
    });
    body.querySelectorAll(".roi-bc [data-lv]").forEach(function (b) {
      b.onclick = function () { Q.keys = Q.keys.slice(0, +b.dataset.lv); paint(host); };
    });
    body.querySelectorAll(".roi-drl tr[data-k]").forEach(function (tr) {
      tr.onclick = function () { Q.keys = keys.concat([tr.dataset.k]); paint(host); };
    });
  }

  /* THE SPLIT PANEL, MONTH BY MONTH (his notes 2026-10-20 on the first version):
     - "where its leads came from is kinda confusing": a state with fewer than 3 leads in the month
       is left at 0, and nothing is prefilled when the panel opens.
     - "month selection should be a must": a month is picked before anything can be split; every
       month has its own split.
     - "you have to memorize that you did first month": every month is a chip that turns green
       when it is fully split (amber part-way, red over 100%), so where you are is always visible.
     - "more modern selectors, chips": states are chips you switch on, each with a slider.
     - "copy distribution from previous month": one click.
     The endpoint is unchanged: share x each month's unplaced spend = the dollars /api/_mktamount
     stores, rounded to the cent and never more than the month has; only changed months are sent.
     The panel lives on <body>, walks the Missing data list by dollars (moved from Source Analysis 2026-10-20) ("Save and next"), and
     closes when the page is left. */
  var SP = null;   // {fam, base:{ym:sp}, months:[ym], pct:{ym:{st:p}}, sel:ym|null, note}
  var MIN_LEADS = 3;
  var ST_COL = { NJ: "#2F6B4F", PA: "#7A9A3A", NY: "#B8862E", CT: "#3A6EA5", DE: "#8B5A9E", MD: "#B5523B", MA: "#5E7C8A", VA: "#9A8F6E" };
  function r1(v) { return Math.round(v * 10) / 10; }
  function pctRaw(P) { var t = 0; Object.keys(P || {}).forEach(function (k) { t += P[k] || 0; }); return t; }
  function pctSum(P) { return r1(pctRaw(P)); }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function fmtPct(p) { return String(Math.round((p || 0) * 10) / 10); }
  // whole-number weights -> shares that add to exactly 100.0 (the rounding goes to the biggest)
  function pctOf(n) {
    var ks = AMT_STATES.filter(function (s0) { return n[s0] > 0; }), t = 0, o = {};
    ks.forEach(function (k) { t += n[k]; });
    if (!t) return o;
    ks.forEach(function (k) { o[k] = r1(100 * n[k] / t); });
    var big = ks.slice().sort(function (a, b) { return o[b] - o[a]; })[0];
    o[big] = r1(o[big] + 100 - pctSum(o));
    return o;
  }
  // the source's leads in one month by state (the eight states only); under MIN_LEADS counts as none
  function monthLeads(f, ym) {
    var pack = C0.D.byFam.get(f), n = {}, kept = {}, t = 0;
    if (pack) pack.leads.forEach(function (r) {
      if (!coOk(r) || !r._cd || r._cd.slice(0, 7) !== ym) return;
      var s0 = stateKey(r.State);
      if (AMT_STATES.indexOf(s0) >= 0) n[s0] = (n[s0] || 0) + 1;
    });
    AMT_STATES.forEach(function (s0) { if (n[s0] >= MIN_LEADS) { kept[s0] = n[s0]; t += n[s0]; } });
    return { n: n, kept: kept, t: t };
  }
  function splitQueue(R) {
    var co = Q.co;
    var open = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; })
      .sort(function (a, b) { return R.unpl[b].sp - R.unpl[a].sp; });
    var done = !co ? [] : Object.keys(R.mon).filter(function (f) { return open.indexOf(f) < 0 && C0.typedIn(co, f, R).length; }).sort();
    return open.concat(done);
  }
  // the dollars saved for a month, as shares of that month's unplaced spend
  function savedPct(f, ym, sp) {
    var o = {};
    // six decimals: a saved $6,500 must come back as $6,500.00, not as a rounded share
    C0.amtOf(Q.co, f, ym).forEach(function (x) { if (sp > 0 && num(x.Amount) > 0) o[x.State] = r6(100 * num(x.Amount) / sp); });
    return o;
  }
  function monthState(P) {
    var t = pctRaw(P);
    return t > 100.005 ? "over" : t >= 99.995 ? "full" : t > 0 ? "part" : "blank";
  }
  // shares -> cents per state for each month, never more than the month's unplaced spend
  function splitDollars(P, sp) {
    var a = [], s = 0;
    AMT_STATES.forEach(function (s0) {
      var p = P[s0] || 0;
      if (p > 0) { var v = Math.round(sp * p) / 100; if (v > 0) { a.push({ state: s0, amount: v }); s += v; } }
    });
    if (s > sp && a.length) {
      a.sort(function (x, y) { return y.amount - x.amount; });
      a[0].amount = Math.round((a[0].amount - (s - sp)) * 100) / 100;
    }
    return a.sort(function (x, y) { return x.state < y.state ? -1 : 1; });
  }
  function dollarKey(a) {
    return a.map(function (x) { return (x.state || x.State) + ":" + num(x.amount != null ? x.amount : x.Amount).toFixed(2); }).sort().join("|");
  }
  // the months whose split differs from what is saved -- what a save sends
  function changedMonths() {
    return SP.months.filter(function (ym) {
      return dollarKey(splitDollars(SP.pct[ym] || {}, SP.base[ym])) !== dollarKey(C0.amtOf(Q.co, SP.fam, ym));
    });
  }
  function openSplit(host, f) {
    var R = V.R;
    if (!R || !Q.co) return;
    var base = R.mon[f] || {};
    var months = Object.keys(base).filter(function (ym) { return base[ym] > 0.5; }).sort();
    // blank on open: a month shows what was saved for it, nothing else
    SP = { fam: f, base: base, months: months, pct: {}, sel: null, note: "" };
    months.forEach(function (ym) { SP.pct[ym] = savedPct(f, ym, base[ym]); });
    drawSplit(host);
  }
  function closeSplit(host) {
    SP = null;
    var ov = document.getElementById("roiSplitOv");
    if (ov) ov.remove();
    if (host && host.isConnected && host.querySelector(".roi")) paint(host);
  }
  function drawSplit(host) {
    var R = V.R, ov = document.getElementById("roiSplitOv");
    if (!SP || !R) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "roiSplitOv"; ov.className = "roi-ov";
      ov.innerHTML = '<div class="roi-dr" role="dialog" aria-modal="true" aria-label="Split by state"></div>';
      document.body.appendChild(ov);
      var onk = function (e) { if (e.key === "Escape" && document.getElementById("roiSplitOv")) leave(); };
      var leave = function () {
        if (SP && changedMonths().length && !window.confirm("Close without saving the " + SP.fam + " split?")) return;
        document.removeEventListener("keydown", onk);
        window.removeEventListener("hashchange", gone);
        closeSplit(host);
      };
      // leaving the page takes the panel with it: it lives on <body>, outside the page host
      var gone = function () { document.removeEventListener("keydown", onk); SP = null; var o = document.getElementById("roiSplitOv"); if (o) o.remove(); };
      document.addEventListener("keydown", onk);
      window.addEventListener("hashchange", gone, { once: true });
      ov.addEventListener("click", function (e) { if (e.target === ov) leave(); });
      ov._leave = leave;
    }
    var f = SP.fam, Q = splitQueue(R), qi = Q.indexOf(f), next = Q[qi + 1] || null;
    var sel = SP.sel, si = sel ? SP.months.indexOf(sel) : -1;
    var prev = si > 0 ? SP.months[si - 1] : null, nextM = si >= 0 && si < SP.months.length - 1 ? SP.months[si + 1] : null;
    var spOf = function (ym) { return SP.base[ym] || 0; };
    var cur = function () { return sel ? (SP.pct[sel] = SP.pct[sel] || {}) : {}; };
    var all = 0; SP.months.forEach(function (ym) { all += spOf(ym); });
    var nFull = SP.months.filter(function (ym) { return monthState(SP.pct[ym]) === "full"; }).length;
    var span = SP.months.length ? monthLbl(SP.months[0]) + (SP.months.length > 1 ? "–" + monthLbl(SP.months[SP.months.length - 1]) : "") : "";
    var L = sel ? monthLeads(f, sel) : null;
    var chg = changedMonths().length;

    var monthChip = function (ym) {
      // a month part-split never reads "100%" on its chip, however close it rounds
      var st = monthState(SP.pct[ym]), t = st === "full" ? 100 : Math.min(99.9, pctSum(SP.pct[ym]));
      return '<button type="button" class="roi-mc ' + st + (sel === ym ? " on" : "") + '" data-ym="' + esc(ym) + '" aria-pressed="' + (sel === ym) + '">'
        + '<span class="roi-mc-l">' + esc(monthLbl(ym)) + "</span>"
        + '<span class="roi-mc-v">' + (st === "full" ? "✓ " : "") + money0(spOf(ym)) + "</span>"
        + '<span class="roi-mc-p">' + (st === "blank" ? "not split" : st === "over" ? pctSum(SP.pct[ym]) + "%, over" : t + "%") + "</span></button>";
    };
    var stateChip = function (s0) {
      var P = cur(), on = P[s0] != null, ln = L ? (L.n[s0] || 0) : 0;
      return '<button type="button" class="roi-sc' + (on ? " on" : "") + '" data-tog="' + s0 + '" aria-pressed="' + on + '" style="--c:' + ST_COL[s0] + '">'
        + '<i></i>' + s0 + (on ? " · " + fmtPct(P[s0]) + "%" : "") + (ln ? '<small title="' + ln + " lead" + (ln === 1 ? "" : "s") + " this month" + '">' + ln + "</small>" : "") + "</button>";
    };
    // whole dollars in the $ box; what is still not placed this month, for "rest here"
    var dlr = function (p) { var v = Math.round(spOf(sel) * (p || 0) / 100); return v ? v.toLocaleString("en-US") : ""; };
    var restOf = function () { return Math.max(0, 100 - pctRaw(cur())); };
    var restBtn = function (s0) {
      var r = restOf(), d = spOf(sel) * r / 100;
      return '<button type="button" class="roi-rest' + (d >= 0.5 ? "" : " off") + '" data-rest="' + s0 + '" title="Put the '
        + esc(money0(d)) + " still not placed in " + esc(monthLbl(sel)) + " on " + s0 + '">+ ' + money0(d) + "</button>";
    };
    var rowsHtml = function () {
      var P = cur(), on = AMT_STATES.filter(function (s0) { return P[s0] != null; });
      if (!on.length) return '<div class="roi-empty2">Switch on the states this month\'s ' + esc(f) + " money went to, or fill it from a button above.</div>";
      return on.map(function (s0) {
        var p = P[s0] || 0;
        return '<div class="roi-sr" style="--c:' + ST_COL[s0] + '"><b><i></i>' + s0 + "</b>"
          + '<input type="range" min="0" max="100" step="0.5" value="' + p + '" data-st="' + s0 + '" aria-label="' + s0 + ' share">'
          + '<input class="rs-inp" inputmode="decimal" value="' + (p ? fmtPct(p) : "") + '" placeholder="0" data-pc="' + s0 + '" aria-label="' + s0 + ' percent"><span>%</span>'
          + '<span class="roi-dl"><span>$</span><input class="rs-inp" inputmode="decimal" value="' + dlr(p) + '" placeholder="0" data-dl="' + s0 + '" aria-label="' + s0 + ' dollars"></span>'
          + restBtn(s0)
          + '<button type="button" class="roi-rm" data-tog="' + s0 + '" aria-label="Remove ' + s0 + '">✕</button></div>';
      }).join("");
    };
    var barHtml = function () {
      var P = cur();
      return AMT_STATES.map(function (s0) {
        var p = P[s0] || 0;
        return p > 0 ? '<i style="width:' + Math.min(100, p) + "%;background:" + ST_COL[s0] + '" title="' + s0 + " " + fmtPct(p) + '%"></i>' : "";
      }).join("");
    };
    var sumHtml = function () {
      // the same exact sum the month chip reads, so the line and the chip never disagree
      var P = cur(), st = monthState(P), raw = pctRaw(P), sp = spOf(sel);
      return st === "over" ? '<span class="bad">' + fmtPct(raw) + "% — " + money0(sp * (raw - 100) / 100) + " too much; bring it down to 100%.</span>"
        : st === "full" ? '<span class="ok">✓ 100% — all ' + money0(sp) + " of " + esc(monthLbl(sel)) + " placed.</span>"
        : st === "part" ? "<span>" + fmtPct(raw) + "% — " + money0(sp * (100 - raw) / 100) + " left to place.</span>"
        : "<span>Nothing placed yet.</span>";
    };

    var body;
    if (!SP.months.length) body = '<div class="rs-hint">No month of the period has ' + esc(f) + " spend left to place.</div>";
    else if (!sel) body = '<div class="roi-pick"><b>Pick a month</b> to split it. A month turns <span class="g">green</span> when it\'s fully split'
      + ' and <span class="a">amber</span> while part of it is still not placed.</div>';
    else {
      var fills = '<button type="button" class="roi-fc" data-fill="leads"' + (L.t ? "" : ' title="No state had ' + MIN_LEADS + ' or more ' + esc(f) + ' leads this month"') + ">"
          + "Its leads" + (L.t ? " <small>" + fmtN(L.t) + "</small>" : " <small>too few</small>") + "</button>"
        + (prev ? '<button type="button" class="roi-fc" data-fill="prev">Copy from ' + esc(monthLbl(prev)) + (monthState(SP.pct[prev]) === "blank" ? " <small>empty</small>" : "") + "</button>" : "")
        + '<button type="button" class="roi-fc" data-fill="even">Even</button>'
        + '<button type="button" class="roi-fc" data-fill="clear">Clear</button>';
      body = '<div class="roi-mh2"><div><b>' + esc(monthLbl(sel)) + "</b> · " + money0(spOf(sel)) + " not placed by the data</div>"
          + (nextM ? '<button type="button" class="roi-nx" data-ym="' + esc(nextM) + '">' + esc(monthLbl(nextM)) + " →</button>" : "") + "</div>"
        + '<div class="roi-fills"><span>Fill from</span>' + fills + "</div>"
        + (SP.note ? '<div class="roi-note">' + esc(SP.note) + "</div>" : "")
        + '<div class="roi-scs">' + AMT_STATES.map(stateChip).join("") + "</div>"
        + '<div class="roi-bar">' + barHtml() + "</div>"
        + '<div class="roi-srs">' + rowsHtml() + "</div>"
        + '<div class="roi-sum">' + sumHtml() + "</div>";
    }

    var dr = ov.querySelector(".roi-dr");
    dr.innerHTML = '<div class="roi-dr-h"><div><div class="roi-dr-t">' + esc(f) + " · split by state</div>"
        + '<div class="roi-dr-s">' + money0(all) + " not placed by the data · " + esc(span)
        + (Q.length > 1 ? " · source " + (qi + 1) + " of " + Q.length : "") + "</div></div>"
        + '<button type="button" class="roi-xb" data-x="1" aria-label="Close">✕</button></div>'
      + (Q.length > 1 ? '<div class="roi-q">' + Q.map(function (q) {
          var u = R.unpl[q];
          return '<button type="button" class="roi-qc' + (q === f ? " on" : "") + (u && u.sp > 0.5 ? "" : " done") + '" data-q="' + esc(q) + '">'
            + (u && u.sp > 0.5 ? "" : "✓ ") + esc(q) + " <small>" + (u && u.sp > 0.5 ? money0(u.sp) : "placed") + "</small></button>";
        }).join("") + "</div>" : "")
      + (SP.months.length ? '<div class="roi-msh"><b>Months</b><small>' + nFull + " of " + SP.months.length + " fully split</small></div>"
        + '<div class="roi-mcs">' + SP.months.map(monthChip).join("") + "</div>" : "")
      + body
      + '<div class="roi-dr-f"><span class="roi-amt-msg">' + (chg ? chg + " month" + (chg === 1 ? "" : "s") + " not saved yet" : "") + "</span>"
        + (next ? '<button type="button" class="rs-btn" data-skip="1">Skip</button>' : "")
        + (SP.months.length ? '<button type="button" class="rs-btn' + (next ? "" : " pri") + '" data-save="0">Save</button>'
          + (next ? '<button type="button" class="rs-btn pri" data-save="1">Save and next: ' + esc(next) + "</button>" : "") : "")
      + "</div>";

    var redraw = function () { SP.note = ""; drawSplit(host); };
    // dragging must not rebuild the panel (a rebuilt slider drops the drag): only the numbers move
    var live = function () {
      var P = cur();
      dr.querySelectorAll(".roi-sr").forEach(function (row) {
        var rg = row.querySelector("input[data-st]"), pc = row.querySelector("input[data-pc]"), s0 = rg.dataset.st, p = P[s0] || 0;
        if (document.activeElement !== rg) rg.value = p;
        if (document.activeElement !== pc) pc.value = p ? fmtPct(p) : "";
        var dl = row.querySelector("input[data-dl]");
        if (document.activeElement !== dl) dl.value = dlr(p);
        var rb = row.querySelector("[data-rest]"), d = spOf(sel) * restOf() / 100;
        rb.textContent = "+ " + money0(d); rb.classList.toggle("off", d < 0.5);
        rb.title = "Put the " + money0(d) + " still not placed in " + monthLbl(sel) + " on " + s0;
      });
      dr.querySelectorAll(".roi-sc").forEach(function (c) {
        var s0 = c.dataset.tog; if (P[s0] == null) return;
        var sm = c.querySelector("small");
        c.innerHTML = "<i></i>" + s0 + " · " + fmtPct(P[s0]) + "%";
        if (sm) c.appendChild(sm);
      });
      dr.querySelector(".roi-bar").innerHTML = barHtml();
      dr.querySelector(".roi-sum").innerHTML = sumHtml();
      var mc = dr.querySelector('.roi-mc[data-ym="' + sel + '"]');
      if (mc) { var tmp = document.createElement("div"); tmp.innerHTML = monthChip(sel); mc.className = tmp.firstChild.className; mc.innerHTML = tmp.firstChild.innerHTML; }
      var n2 = SP.months.filter(function (ym) { return monthState(SP.pct[ym]) === "full"; }).length;
      dr.querySelector(".roi-msh small").textContent = n2 + " of " + SP.months.length + " fully split";
      var c2 = changedMonths().length;
      dr.querySelector(".roi-dr-f .roi-amt-msg").textContent = c2 ? c2 + " month" + (c2 === 1 ? "" : "s") + " not saved yet" : "";
    };
    var setP = function (s0, v) { var P = cur(); P[s0] = Math.max(0, Math.min(100, Math.round((v || 0) * 100) / 100)); };
    // dollars typed -> the share that gives exactly those dollars (six decimals)
    var setD = function (s0, v) { var P = cur(), sp = spOf(sel); P[s0] = sp > 0 ? Math.max(0, Math.min(100, r6(100 * (v || 0) / sp))) : 0; };
    var numIn = function (i) { return parseFloat(String(i.value).replace(/[$%,\s]/g, "")) || 0; };
    dr.querySelectorAll("input[data-st]").forEach(function (i) {
      i.oninput = function () { setP(i.dataset.st, +i.value); live(); };
    });
    dr.querySelectorAll("input[data-pc]").forEach(function (i) {
      i.oninput = function () { setP(i.dataset.pc, numIn(i)); live(); };
      i.onblur = function () { var P = cur(); i.value = P[i.dataset.pc] ? fmtPct(P[i.dataset.pc]) : ""; };
    });
    dr.querySelectorAll("input[data-dl]").forEach(function (i) {
      i.oninput = function () { setD(i.dataset.dl, numIn(i)); live(); };
      i.onblur = function () { var P = cur(); i.value = dlr(P[i.dataset.dl]); };
    });
    // "rest here" (his ask): whatever the month still has goes to this state
    dr.querySelectorAll("[data-rest]").forEach(function (b) {
      b.onclick = function () {
        var P = cur(), s0 = b.dataset.rest, r = restOf();
        if (r <= 0) return;
        P[s0] = Math.min(100, r6((P[s0] || 0) + r));
        live();
      };
    });
    // a state switched on takes what is left of the month; switched off, it gives its share back
    dr.querySelectorAll("[data-tog]").forEach(function (b) {
      b.onclick = function () {
        var P = cur(), s0 = b.dataset.tog;
        if (P[s0] != null) delete P[s0];
        else P[s0] = Math.max(0, r6(100 - pctRaw(P)));
        redraw();
      };
    });
    dr.querySelectorAll("[data-fill]").forEach(function (b) {
      b.onclick = function () {
        var how = b.dataset.fill, P;
        if (how === "leads") {
          if (!L.t) { SP.note = "No state had " + MIN_LEADS + " or more " + f + " leads in " + monthLbl(sel) + ". Switch the states on yourself."; drawSplit(host); return; }
          SP.pct[sel] = pctOf(L.kept);
        } else if (how === "prev") {
          if (monthState(SP.pct[prev]) === "blank") { SP.note = monthLbl(prev) + " has no split to copy yet."; drawSplit(host); return; }
          SP.pct[sel] = Object.assign({}, SP.pct[prev]);
        } else if (how === "even") {
          P = cur();
          var on = AMT_STATES.filter(function (s0) { return P[s0] != null; });
          if (!on.length) on = AMT_STATES.filter(function (s0) { return L.kept[s0]; });
          if (!on.length) { SP.note = "Switch on the states first, then split them evenly."; drawSplit(host); return; }
          var o = {}; on.forEach(function (s0) { o[s0] = 1; });
          SP.pct[sel] = pctOf(o);
        } else SP.pct[sel] = {};
        redraw();
      };
    });
    dr.querySelectorAll("[data-ym]").forEach(function (b) {
      b.onclick = function () { SP.sel = SP.sel === b.dataset.ym && !b.classList.contains("roi-nx") ? null : b.dataset.ym; redraw(); };
    });
    dr.querySelector("[data-x]").onclick = function () { ov._leave(); };
    dr.querySelectorAll("[data-q]").forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.q === f) return;
        if (changedMonths().length && !window.confirm("Leave the " + f + " split without saving?")) return;
        openSplit(host, b.dataset.q);
      };
    });
    var sk = dr.querySelector("[data-skip]");
    if (sk) sk.onclick = function () {
      if (changedMonths().length && !window.confirm("Skip " + f + " without saving?")) return;
      openSplit(host, next);
    };
    dr.querySelectorAll("[data-save]").forEach(function (b) {
      b.onclick = function () { saveSplit(host, dr, b.dataset.save === "1" ? next : null); };
    });
  }
  function saveSplit(host, dr, next) {
    var f = SP.fam, msg = dr.querySelector(".roi-dr-f .roi-amt-msg"), months = [], bad = [];
    SP.months.forEach(function (ym) { if (monthState(SP.pct[ym]) === "over") bad.push(monthLbl(ym)); });
    msg.classList.remove("bad");
    if (bad.length) { msg.textContent = "Over 100% in " + bad.join(", ") + " — bring it down to save."; msg.classList.add("bad"); return; }
    changedMonths().forEach(function (ym) { months.push({ month: ym, amounts: splitDollars(SP.pct[ym] || {}, SP.base[ym]) }); });
    if (!months.length) {
      if (next) { openSplit(host, next); return; }
      msg.textContent = "Nothing changed."; return;
    }
    msg.textContent = "Saving…";
    fetch(ZTZ.API + "/api/_mktamount", {
      method: "POST",
      headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
      body: JSON.stringify({ company: Q.co, family: f, months: months }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) {
          if (j && j.code === "view_as_readonly") throw new Error("preview mode — amounts are not saved while viewing as someone else");
          throw new Error(j.error || ("HTTP " + r.status));
        }
        V.note = f + ": " + months.length + " month" + (months.length === 1 ? "" : "s") + " saved.";
        // the same source stays open on the same month after a plain Save; "and next" moves on
        V.reopen = next || f;
        V.reopenSel = next ? null : SP.sel;
        reloadAmounts(host);
      });
    }).catch(function (e) { msg.textContent = "Not saved: " + e.message; msg.classList.add("bad"); });
  }
  function wireAmounts(host, el) {
    el.querySelectorAll("[data-amt]").forEach(function (b) {
      b.onclick = function () { V.note = ""; openSplit(host, b.dataset.amt); };
    });
  }

  if (window.registerPage) {
    registerPage({
      id: "marketing-roi",
      group: "marketing",
      title: "Return on Investment",
      render: render,
    });
  }
})();
