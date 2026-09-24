/* ORGANIC SEARCH — where organic search demand for movers comes from, and whether we win it.
 *
 * Built 2026-09-24 from the sp4 discovery (Search Console, property sc-domain:ziptozipmoving.com,
 * 2025-05-25 onward). What the page shows first is the finding: organic search is mostly people
 * who already know us (brand searches are ~72% of the clicks Google names, ~78% last summer).
 * Outside the brand we win around our own listings and bases (Wilmington, Exton, Downingtown,
 * Elkridge) and are invisible in the big markets (New York, Brooklyn, Jersey City, Philadelphia at
 * positions 41-50): across the 58 Keyword Planner cities we collect well under one click per 1,000
 * searches.
 *
 * THE RULES THE NUMBERS FOLLOW (each one measured, each one said on the page):
 *   - Google hides ~45% of clicks from the query rows. Every query breakdown carries a "hidden by
 *     Google" remainder, so the query table adds up to the site total, and every place figure is
 *     a FLOOR: Search Console never says where the searcher was — a place comes only from the
 *     search wording or the landing page.
 *   - Impressions and position broke on 12-13 Sep 2025 (Google ended the 100-results setting). So
 *     the year-on-year compare is CLICKS ONLY, and impressions / position count from Oct 2025.
 *   - The compare matches whole months only: a month both years hold completely.
 *   - Leads beside the searches are context, never cause: the lead side cannot tell paid Google
 *     from organic, and ChatGPT leads never pass through Search Console at all.
 *   - A Business Profile click here is a click on the listing's WEBSITE link only — not a call or
 *     a direction request (those need the Business Profile Performance API: a follow-up).
 *
 * DATA: three marts from src/search_console_mart.py (bridge REPORT_TABLES['organic-search']):
 *   mart_gsc_query  query x month (+ long tail + hidden rows)
 *   mart_gsc_area   month x Level (State = the whole state; City / County = its parts) x place
 *   mart_gsc_page   landing page x month; one row per Business Profile listing per month
 * View only. Its own window bar (PAGE_DATASETS [] + BARE_CHROME).
 */
(function () {
  if (!window.RS || !RS.DATASETS) return;
  if (!RS.DATASETS.gsc_query) {
    RS.DATASETS.gsc_query = {
      table: "mart_gsc_query",
      cols: ["Date", "Query", "Type", "State", "City", "County", "Clicks", "Impressions", "Position"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.gsc_area) {
    RS.DATASETS.gsc_area = {
      table: "mart_gsc_area",
      cols: ["Date", "Level", "State", "City", "County", "Query Clicks", "Query Impressions", "Query Position",
             "Impr Top 3", "Impr 4 To 10", "Impr 11 To 20", "Impr 21 Plus",
             "Business Profile Clicks", "Business Profile Impressions", "City Page Clicks", "Location Page Clicks",
             "Search Volume", "Leads", "Jobs", "Days"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.gsc_page) {
    RS.DATASETS.gsc_page = {
      table: "mart_gsc_page",
      cols: ["Date", "Page", "Family", "State", "Place", "Tag", "Clicks", "Impressions", "Position"],
      dateCols: {}, defaultDate: null,
    };
  }
})();

(function () {
  // impressions and position are only comparable from the first whole month after the break
  var CLEAN_FROM = "2025-10";
  var BREAK_NOTE = "12–13 Sep 2025";
  var TYPES = ["Brand", "Movers near me", "Movers + place", "Movers generic", "How-to", "Town name only", "Other",
               "Hidden by Google"];
  var MOVERS = { "Movers near me": 1, "Movers + place": 1, "Movers generic": 1 };
  var FAMILIES = ["Home", "Business Profile listing", "Location page", "State page", "City page", "Service page",
                  "Blog", "Reviews / About", "Other"];
  var TOP_N = 100;

  var S = { win: "12m", from: "", to: "", cmp: "on", qType: "", q: "", open: {}, cityAll: false };

  /* ------------------------------------------------------------------ helpers ---- */
  function esc(s) { return RSC.esc(s == null ? "" : String(s)); }
  function num(v) { var n = +v; return (v == null || v === "" || isNaN(n)) ? 0 : n; }
  function fmtN(v) { return (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString("en-US"); }
  function fmtP(v, d) { return (v == null || isNaN(v) || !isFinite(v)) ? "—" : (100 * v).toFixed(d == null ? 1 : d) + "%"; }
  function fmtPos(v) { return (v == null || isNaN(v)) ? "—" : (+v).toFixed(1); }
  function ymOf(r) { return String(r.Date || "").slice(0, 7); }
  function monthLbl(ym) {
    var d = new Date(ym + "-15T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  function monthLong(ym) {
    var d = new Date(ym + "-15T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  }
  function daysIn(ym) { var y = +ym.slice(0, 4), m = +ym.slice(5, 7); return new Date(y, m, 0).getDate(); }
  function addMonths(ym, n) {
    var y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1 + n;
    y += Math.floor(m / 12); m = ((m % 12) + 12) % 12;
    return y + "-" + (m < 9 ? "0" : "") + (m + 1);
  }
  function kpi(val, lab, sub) {
    return '<div class="kpi"><div class="l">' + esc(lab) + '</div><div class="v">' + val + '</div><div class="s">' + sub + "</div></div>";
  }
  // under 100 impressions an average position is a handful of searches (the Bronx read "page 1"
  // on 18 impressions in the 2026-09-24 dry run), so it gets no verdict
  var MIN_VERDICT_IMPR = 100;
  function verdictOf(pos, imp) {
    if (!imp || pos == null) return "Not shown";
    if (imp < MIN_VERDICT_IMPR) return "Rarely shown";
    return pos <= 3.5 ? "Winning" : pos <= 10.5 ? "Page 1" : pos <= 20.5 ? "Page 2" : "Invisible";
  }
  function posPill(pos, imp) {
    if (!imp || pos == null) return '<span class="rs-pill mute">Not shown</span>';
    if (imp < MIN_VERDICT_IMPR) return '<span class="rs-pill mute" title="fewer than ' + MIN_VERDICT_IMPR
      + ' impressions: too few searches for the average position to mean anything">Rarely shown</span>';
    if (pos <= 3.5) return '<span class="rs-pill ok" title="average position 1-3">Winning</span>';
    if (pos <= 10.5) return '<span class="rs-pill info" title="average position 4-10: page 1">Page 1</span>';
    if (pos <= 20.5) return '<span class="rs-pill warn" title="average position 11-20: page 2">Page 2</span>';
    return '<span class="rs-pill bad" title="average position 21 or worse: nobody scrolls there">Invisible</span>';
  }
  function palette() {
    var cs = getComputedStyle(document.body);
    var v = function (n, fb) { var x = (cs.getPropertyValue(n) || "").trim(); return x || fb; };
    return { blue: v("--blue", "#5b8cff"), brand: v("--brand", "#b7e23b"), violet: v("--purple", "#a78bfa"),
             warn: v("--amber", "#fbbf24"), neg: v("--neg", "#f87171"),
             ink: v("--ink", "#e9eef6"), muted: v("--muted", "#8b98a8"), faint: v("--faint", "#5c6a7c"),
             line: v("--line-2", "#2a3548") };
  }
  // a quieter shade of a theme colour (the kit has four core colours; the third 'movers' type and
  // the second kind of place page need a fifth and sixth that still read as their family)
  function soft(hex, a) {
    var m = /^#([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return hex;
    var n = parseInt(m[1], 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }
  function csvDownload(name, head, rows) {
    var cell = function (x) {
      var s = String(x == null ? "" : x);
      if (/^[=+\-@]/.test(s)) s = " " + s;           // never a live formula in Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var lines = [head.map(cell).join(",")].concat(rows.map(function (r) { return r.map(cell).join(","); }));
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  function injectStyle() {
    if (document.getElementById("os-style")) return;
    var st = document.createElement("style");
    st.id = "os-style";
    // Page-specific visuals only, all under .os. Bars, fields, tables, pills and tiles are the kit's.
    st.textContent = ""
      + ".os{font-variant-numeric:tabular-nums}"
      + ".os .os-lede{padding:13px 16px;margin:0 0 14px;border:1px solid var(--line);border-radius:12px;"
      + "background:var(--panel-2);font-size:13.5px;line-height:1.6;color:var(--ink)}"
      + ".os .os-lede b{font-weight:800}"
      + ".os .os-warnbox{border:1px solid var(--warn);background:var(--warn-bg);color:var(--ink);"
      + "border-radius:12px;padding:10px 14px;margin:0 0 14px;font-size:13px;line-height:1.55}"
      + ".os .os-bands{display:flex;height:8px;border-radius:5px;overflow:hidden;min-width:110px;background:var(--line)}"
      + ".os .os-bands i{display:block;height:100%}"
      + ".os .os-bands .b1{background:var(--pos)}.os .os-bands .b2{background:var(--blue)}"
      + ".os .os-bands .b3{background:var(--warn)}.os .os-bands .b4{background:var(--neg)}"
      + ".os .os-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}"
      + ".os .os-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}"
      + ".os .os-legend .b1{background:var(--pos)}.os .os-legend .b2{background:var(--blue)}"
      + ".os .os-legend .b3{background:var(--warn)}.os .os-legend .b4{background:var(--neg)}"
      + ".os .os-tot td{font-weight:800;border-top:2px solid var(--line-2)}"
      + ".os .os-grey td{color:var(--faint);font-style:italic}"
      + ".os .os-small{color:var(--faint);font-size:11.5px;font-weight:600;margin-left:5px;white-space:nowrap}"
      + ".os .os-q{max-width:420px;white-space:normal;word-break:break-word}"
      + ".os .os-notes{margin:0;padding-left:18px;font-size:12.5px;line-height:1.6;color:var(--muted)}"
      + ".os .os-notes li{margin:0 0 6px}.os .os-notes b{color:var(--ink)}"
      + ".os .os-empty{padding:22px 14px;text-align:center;color:var(--faint);font-size:13px}"
      + ".os .os-heat{font-weight:700}"
      + ".os .os-heat.z{color:var(--faint);font-weight:500}"
      + ".os .os-more{display:flex;gap:12px;align-items:center;justify-content:center;padding:12px 0 2px}"
      + ".os th.os-sub{font-size:10px;letter-spacing:.06em;color:var(--faint)}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ data ---- */
  function index(Q, A, PG) {
    var months = {}, days = {};
    A.forEach(function (r) { var m = ymOf(r); months[m] = 1; days[m] = Math.max(days[m] || 0, num(r.Days)); });
    Q.forEach(function (r) { months[ymOf(r)] = 1; });
    var list = Object.keys(months).filter(Boolean).sort();
    var complete = {};
    list.forEach(function (m) { complete[m] = (days[m] || 0) >= daysIn(m); });
    var last = list[list.length - 1] || "";
    var lastDay = last ? last + "-" + String(days[last] || daysIn(last)).padStart(2, "0") : "";
    return { Q: Q, A: A, PG: PG, months: list, days: days, complete: complete, last: last, lastDay: lastDay };
  }

  // the reading window -> the months it holds
  function windowMonths(D) {
    var full = D.months.filter(function (m) { return D.complete[m]; });
    var lastFull = full[full.length - 1] || D.last;
    var pick;
    if (S.win === "season") {
      var y = +D.last.slice(0, 4);
      if (D.last.slice(5, 7) < "05") y -= 1;
      pick = D.months.filter(function (m) { return m >= y + "-05" && m <= y + "-08"; });
    } else if (S.win === "ytd") {
      var yy = D.last.slice(0, 4);
      pick = D.months.filter(function (m) { return m.slice(0, 4) === yy; });
    } else if (S.win === "custom" && S.from && S.to) {
      var a = S.from <= S.to ? S.from : S.to, b = S.from <= S.to ? S.to : S.from;
      pick = D.months.filter(function (m) { return m >= a && m <= b; });
    } else {
      pick = D.months.filter(function (m) { return m > addMonths(lastFull, -12) && m <= lastFull; });
    }
    return pick;
  }
  function winLabel(ms, D) {
    if (!ms.length) return "no months";
    var a = ms[0], b = ms[ms.length - 1];
    var partial = ms.filter(function (m) { return !D.complete[m]; });
    return monthLong(a) + (a === b ? "" : " – " + monthLong(b))
      + (partial.length ? " (" + partial.map(function (m) {
        return monthLbl(m) + " " + (D.days[m] || 0) + " days"; }).join(", ") + ")" : "");
  }
  function inSet(ms) { var o = {}; ms.forEach(function (m) { o[m] = 1; }); return o; }
  function clean(ms) { return ms.filter(function (m) { return m >= CLEAN_FROM; }); }

  function queryTotals(D, mset) {
    var t = {};
    TYPES.forEach(function (k) { t[k] = 0; });
    D.Q.forEach(function (r) { if (mset[ymOf(r)]) t[r.Type] = (t[r.Type] || 0) + num(r.Clicks); });
    var site = 0;
    TYPES.forEach(function (k) { site += t[k]; });
    return { t: t, site: site, vis: site - t["Hidden by Google"] };
  }

  /* ------------------------------------------------------------------ render ---- */
  registerPage({
    id: "organic-search",
    group: "marketing",
    title: "Organic Search",
    subtitle: "Google Search Console: who finds us without an ad, where that demand comes from, and whether "
      + "we win it — brand vs movers searches, by state and city, and which pages and Business Profile listings earn the clicks.",
    datasets: [],

    render: function (host) {
      injectStyle();
      host.innerHTML = '<div class="os"><div class="panel">Loading Search Console…</div></div>';
      var mine = host.querySelector(".os");
      var alive = function () { return host.querySelector(".os") === mine; };
      return Promise.all([RS.load("gsc_query"), RS.load("gsc_area"), RS.load("gsc_page")]).then(function (res) {
        if (!alive()) return;
        var D = index(res[0] || [], res[1] || [], res[2] || []);
        if (!D.months.length) {
          mine.innerHTML = '<div class="panel">No Search Console rows yet — the marts build after the daily '
            + "Search Console pull (sources=search-console-mart rebuilds them on demand).</div>";
          return;
        }
        paint(mine, D);
      }).catch(function (e) {
        if (!alive()) return;
        var msg = String(e && e.message || e);
        mine.innerHTML = /unknown dataset|mart_gsc/.test(msg)
          ? '<div class="panel">The Organic Search tables are being built by the Search Console stage and are not '
            + "ready yet. They appear after its next run — reopen this page then.</div>"
          : '<div class="panel">Could not load Search Console data — ' + esc(msg) + "</div>";
      });
    },
  });

  function paint(mine, D) {
    var ms = windowMonths(D);
    var mset = inSet(ms);
    var cms = clean(ms), cset = inSet(cms);
    var h = "";

    /* ---- the bar: window + compare ---- */
    h += '<div class="rs-bar" id="osBar"></div>';

    /* ---- the numbers for the tiles ---- */
    var cur = queryTotals(D, mset);
    var matched = ms.filter(function (m) {
      var p = addMonths(m, -12);
      return D.complete[m] && D.complete[p] && D.months.indexOf(p) >= 0;
    });
    var cmpNow = null, cmpPrev = null;
    if (S.cmp === "on" && matched.length) {
      cmpNow = queryTotals(D, inSet(matched));
      cmpPrev = queryTotals(D, inSet(matched.map(function (m) { return addMonths(m, -12); })));
    }
    var chg = function (a, b) { return b ? (a / b - 1) : null; };
    var arrow = function (x) {
      if (x == null) return "";
      return ' <span class="os-small" style="color:var(' + (x >= 0 ? "--pos" : "--neg") + ')">'
        + (x >= 0 ? "▲ +" : "▼ ") + (100 * x).toFixed(0) + "%</span>";
    };
    // compared on the whole months both years hold, so the arrow can say less than the window does
    var cmpSub = cmpNow ? monthLbl(matched[0]) + (matched.length > 1 ? "–" + monthLbl(matched[matched.length - 1]) : "")
      + " vs a year earlier: " + fmtN(cmpPrev.site) + " → " + fmtN(cmpNow.site)
      + (matched.length < ms.length ? " · whole months both years hold" : "")
      : (S.cmp === "on" ? "no month here has a whole month a year earlier" : "compare off");
    var brand = cur.t.Brand, movers = cur.t["Movers near me"] + cur.t["Movers + place"] + cur.t["Movers generic"];
    var listing = 0, nList = {};
    D.PG.forEach(function (r) {
      if (mset[ymOf(r)] && r.Family === "Business Profile listing") { listing += num(r.Clicks); nList[r.Page] = 1; }
    });

    h += '<div class="rs-kpis" id="osKpis" style="--kpi-cols:6">'
      + kpi(fmtN(cur.site) + (cmpNow ? arrow(chg(cmpNow.site, cmpPrev.site)) : ""), "Organic clicks", esc(cmpSub))
      + kpi(fmtP(cur.vis ? brand / cur.vis : null, 0), "Brand share",
            "of the clicks Google names: people who searched for Zip to Zip by name")
      + kpi(fmtN(movers), "Movers searches",
            fmtP(cur.vis ? movers / cur.vis : null) + " of named clicks · " + fmtN(cur.t["Movers + place"]) + " named a place")
      + kpi(fmtP(cur.site ? cur.t["Hidden by Google"] / cur.site : null, 0), "Hidden by Google",
            "clicks Google counts but never names the search for")
      + kpi(fmtN(listing), "Business Profile clicks",
            "website-link clicks on " + Object.keys(nList).length + " listing" + (Object.keys(nList).length === 1 ? "" : "s") + " · not calls or directions")
      + kpi(esc(new Date(D.lastDay + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })),
            "Last data day", "Google finalises a day about 3 days late")
      + "</div>";

    h += '<div class="os-lede"><b>' + esc(winLabel(ms, D)) + ".</b> "
      + (cur.vis ? "Of the clicks Google names, <b>" + fmtP(brand / cur.vis, 0) + " are brand searches</b> — people who "
        + "already know us. Non-brand 'movers' searches bring <b>" + fmtP(movers / cur.vis, 0) + "</b>, and only "
        + fmtN(cur.t["Movers + place"]) + " of those clicks came from a search that named a place. " : "")
      + "Every place figure below is a <b>floor</b>: Google hides " + fmtP(cur.site ? cur.t["Hidden by Google"] / cur.site : null, 0)
      + " of clicks from the query list and never says where the searcher was.</div>";

    if (cms.length < ms.length) {
      h += '<div class="os-warnbox">Impressions and position count from <b>' + monthLong(CLEAN_FROM) + "</b> only"
        + (cms.length ? " (" + cms.length + " of this window's " + ms.length + " months)" : " — none in this window")
        + ". Google changed how it counts impressions on " + BREAK_NOTE + " (daily impressions halved and the average "
        + "position jumped from 30 to 17 overnight), so the months before cannot be compared. Clicks were not affected.</div>";
    }

    /* ---- sections ---- */
    h += '<div id="osWho"></div>';
    h += statePanel(D, mset, cset, ms, cms);
    h += cityPanel(D, mset, cset, ms);
    h += '<div class="panel" id="osTop"></div>';
    h += '<div id="osFam"></div>';
    h += listingPanel(D, ms);
    h += topPagesPanel(D, mset, cset);
    h += checkPanel(D, mset);
    h += notesPanel(D);
    mine.innerHTML = h;

    mountBar(mine, D);
    whoChart(mine.querySelector("#osWho"), D);
    famChart(mine.querySelector("#osFam"), D);
    paintTop(mine, D, mset, cset);
    wireStates(mine, D);
    var ca = mine.querySelector("#osCityAll");
    if (ca) ca.onclick = function () { S.cityAll = !S.cityAll; paint(mine, D); };
  }

  /* ---- the window bar ---- */
  function mountBar(mine, D) {
    var bar = mine.querySelector("#osBar");
    var fld = function (label, el) {
      var w = document.createElement("div"); w.className = "rs-fld";
      w.innerHTML = "<span>" + esc(label) + "</span>"; w.appendChild(el); return w;
    };
    var seg = function (opts, cur, set) {
      var s = document.createElement("div"); s.className = "rs-seg";
      opts.forEach(function (o) {
        var b = document.createElement("button"); b.type = "button"; b.textContent = o[1];
        if (cur === o[0]) b.className = "on";
        b.onclick = function () { set(o[0]); paint(bar.closest(".os"), D); };
        s.appendChild(b);
      });
      return s;
    };
    bar.appendChild(fld("Window", seg([["12m", "Last 12 whole months"], ["season", "Season (May–Aug)"], ["ytd", "Year to date"],
                                       ["custom", "Pick months"]], S.win, function (v) {
      S.win = v;
      if (v === "custom" && !S.from) { S.to = D.last; S.from = addMonths(D.last, -11); }
    })));
    if (S.win === "custom") {
      var opts = D.months.slice().reverse().map(function (m) { return { v: m, l: monthLong(m) }; });
      var f = document.createElement("div"), t = document.createElement("div");
      bar.appendChild(f); bar.appendChild(t);
      RSC.localSelect(f, { label: "From", values: opts, value: S.from, required: true,
                           onChange: function (v) { S.from = v; paint(bar.closest(".os"), D); } });
      RSC.localSelect(t, { label: "To", values: opts, value: S.to, required: true,
                           onChange: function (v) { S.to = v; paint(bar.closest(".os"), D); } });
    }
    bar.appendChild(fld("Compare", seg([["on", "Same months last year"], ["off", "Off"]], S.cmp, function (v) { S.cmp = v; })));
    var sp = document.createElement("div"); sp.className = "rs-spacer"; bar.appendChild(sp);
    var hint = document.createElement("span"); hint.className = "rs-hint"; hint.style.margin = "0";
    hint.textContent = "Clicks compare across years; impressions and position do not (Google's " + BREAK_NOTE + " change).";
    bar.appendChild(hint);
  }

  /* ---- (b) who finds us: clicks by search type, every month on file ---- */
  function whoChart(host, D) {
    var by = {};
    D.months.forEach(function (m) { by[m] = {}; });
    D.Q.forEach(function (r) { var m = ymOf(r); if (by[m]) by[m][r.Type] = (by[m][r.Type] || 0) + num(r.Clicks); });
    RSC.chartCard(host, {
      title: "Who finds us — clicks by what they searched, every month on file", key: "os-who",
      buildChart: function (canvas) {
        var C = palette();
        var col = { "Brand": C.brand, "Movers near me": C.blue, "Movers + place": C.violet, "Movers generic": soft(C.blue, 0.45),
                    "How-to": C.warn, "Town name only": C.muted, "Other": C.faint, "Hidden by Google": C.line };
        return new Chart(canvas, {
          type: "bar",
          data: { labels: D.months.map(function (m) { return monthLbl(m) + (D.complete[m] ? "" : "*"); }),
                  datasets: TYPES.map(function (k) {
                    return { label: k, data: D.months.map(function (m) { return by[m][k] || 0; }), backgroundColor: col[k], stack: "c" };
                  }) },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                     scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } },
                     plugins: { tooltip: { callbacks: { footer: function (items) {
                       var t = 0; items.forEach(function (i) { t += i.raw; }); return "Site total " + fmtN(t);
                     } } } } },
        });
      },
      buildTable: function () {
        return '<table class="rs-table"><thead><tr><th>Month</th>' + TYPES.map(function (k) { return '<th class="num">' + esc(k) + "</th>"; }).join("")
          + '<th class="num">Site total</th><th class="num">Brand share of named</th></tr></thead><tbody>'
          + D.months.map(function (m) {
            var t = 0; TYPES.forEach(function (k) { t += by[m][k] || 0; });
            var vis = t - (by[m]["Hidden by Google"] || 0);
            return "<tr><td>" + esc(monthLong(m)) + (D.complete[m] ? "" : ' <span class="os-small">' + (D.days[m] || 0) + " days</span>") + "</td>"
              + TYPES.map(function (k) { return '<td class="num">' + fmtN(by[m][k] || 0) + "</td>"; }).join("")
              + '<td class="num strong">' + fmtN(t) + '</td><td class="num">' + fmtP(vis ? (by[m].Brand || 0) / vis : null, 0) + "</td></tr>";
          }).join("") + "</tbody></table>";
      },
    });
    var note = document.createElement("p");
    note.className = "rs-hint";
    note.style.margin = "-4px 0 14px";
    note.innerHTML = "Each bar is the whole site: the grey top is the clicks Google counts but never names the search for. "
      + "* = a month not whole on file (the first began 25 May 2025; the latest runs to the last data day). "
      + "The long tail of rare searches is inside its own type. 'Town name only' is a lookup like 'broomall pa' — shown, never counted as demand.";
    host.appendChild(note);
  }

  /* ---- (c) where the demand comes from: the state table ---- */
  function sumArea(rows) {
    var z = { qc: 0, qi: 0, pw: 0, b1: 0, b2: 0, b3: 0, b4: 0, bp: 0, cp: 0, lp: 0, leads: 0, jobs: 0, vol: null };
    rows.forEach(function (r) {
      z.qc += num(r["Query Clicks"]); z.bp += num(r["Business Profile Clicks"]);
      z.cp += num(r["City Page Clicks"]); z.lp += num(r["Location Page Clicks"]);
      z.leads += num(r.Leads); z.jobs += num(r.Jobs);
      if (r["Search Volume"] != null && r["Search Volume"] !== "") z.vol = num(r["Search Volume"]);
      if (r._clean) {
        z.qi += num(r["Query Impressions"]); z.pw += num(r["Query Position"]) * num(r["Query Impressions"]);
        z.b1 += num(r["Impr Top 3"]); z.b2 += num(r["Impr 4 To 10"]); z.b3 += num(r["Impr 11 To 20"]); z.b4 += num(r["Impr 21 Plus"]);
      }
    });
    z.pos = z.qi ? z.pw / z.qi : null;
    return z;
  }
  function bandsCell(z) {
    var n = z.b1 + z.b2 + z.b3 + z.b4;
    if (!n) return '<td class="dim">—</td>';
    var w = function (x) { return (100 * x / n).toFixed(1); };
    return '<td title="positions 1-3: ' + w(z.b1) + "% · 4-10: " + w(z.b2) + "% · 11-20: " + w(z.b3) + "% · 21+: " + w(z.b4) + '%">'
      + '<span class="os-bands"><i class="b1" style="width:' + w(z.b1) + '%"></i><i class="b2" style="width:' + w(z.b2)
      + '%"></i><i class="b3" style="width:' + w(z.b3) + '%"></i><i class="b4" style="width:' + w(z.b4) + '%"></i></span></td>';
  }
  function areaCells(z) {
    var land = z.bp + z.cp + z.lp;
    return '<td class="num strong">' + fmtN(z.qc) + '</td><td class="num">' + (z.qi ? fmtN(z.qi) : "—")
      + '</td><td class="num">' + fmtPos(z.pos) + "</td>" + bandsCell(z)
      + '<td class="num">' + fmtN(z.bp) + '</td><td class="num">' + fmtN(z.cp) + '</td><td class="num">' + fmtN(z.lp)
      + '</td><td class="num">' + fmtN(z.leads) + '</td><td class="num">' + (z.leads ? (100 * land / z.leads).toFixed(1) : "—") + "</td>";
  }
  function areaHead(first) {
    return "<thead><tr><th>" + esc(first) + '</th><th class="num">Clicks</th><th class="num">Impressions</th>'
      + '<th class="num">Position</th><th>Where we rank</th>'
      + '<th class="num" title="website-link clicks on the Business Profile listings in this place">Listing clicks</th>'
      + '<th class="num">City-page clicks</th><th class="num" title="location and state pages">Location / state page clicks</th>'
      + '<th class="num" title="Zip to Zip leads created in the window, by pickup state / city">Leads</th>'
      + '<th class="num" title="listing + city + location page clicks per 100 leads: context, never cause">Landing clicks per 100 leads</th></tr>'
      + '<tr><th class="os-sub"></th><th class="os-sub" colspan="4">Movers searches that name the place</th>'
      + '<th class="os-sub" colspan="3">Pages about the place</th><th class="os-sub" colspan="2">Our leads</th></tr></thead>';
  }
  function areaRows(D, mset, cset, pred) {
    return D.A.filter(function (r) {
      var m = ymOf(r);
      if (!mset[m] || !pred(r)) return false;
      r._clean = !!cset[m];
      return true;
    });
  }
  function statePanel(D, mset, cset) {
    var rows = areaRows(D, mset, cset, function (r) { return r.Level === "State"; });
    var by = {};
    rows.forEach(function (r) { (by[r.State] = by[r.State] || []).push(r); });
    var sts = Object.keys(by).map(function (st) { return { st: st, z: sumArea(by[st]) }; })
      .filter(function (o) { return o.z.qc || o.z.qi || o.z.bp || o.z.cp || o.z.lp || o.z.leads; })
      .sort(function (a, b) { return (b.z.qi - a.z.qi) || (b.z.qc - a.z.qc); });
    var tot = sumArea(rows);
    var h = '<div class="panel"><div class="panel-head"><span class="panel-title">Where the demand comes from — by state</span></div>'
      + '<p class="rs-hint">Only a search that <b>names a place</b> can be put in a state ("movers wilmington de", "moving company nj"), '
      + "plus the pages about a place — so these are floors. Click a state for its cities and counties.</p>"
      + '<div class="rs-tablewrap"><table class="rs-table" id="osStates">' + areaHead("State") + "<tbody>";
    sts.forEach(function (o) {
      var open = !!S.open[o.st];
      h += '<tr class="rs-group' + (open ? " on" : "") + '" data-st="' + esc(o.st) + '"><td><span class="rs-caret">›</span> ' + esc(o.st) + "</td>" + areaCells(o.z) + "</tr>";
      if (open) h += '<tr class="rs-sub"><td colspan="10"><div class="rs-sub-card">' + stateDetail(D, mset, cset, o.st, o.z) + "</div></td></tr>";
    });
    h += '<tr class="os-tot"><td>All states</td>' + areaCells(tot) + "</tr></tbody></table></div>"
      + '<div class="os-legend"><span><i class="b1"></i>positions 1–3</span><span><i class="b2"></i>4–10 (page 1)</span>'
      + '<span><i class="b3"></i>11–20</span><span><i class="b4"></i>21+ (nobody scrolls there)</span>'
      + "<span>— the share of impressions at each rank</span></div>"
      + '<p class="rs-hint" style="margin:10px 0 0"><b>Leads</b> are Zip to Zip leads created in the window by pickup state. '
      + "<b>Landing clicks per 100 leads</b> sets the clicks we can place in the state through the page they landed on beside the "
      + "state's leads — context, never cause: the 'Google' lead source mixes paid and organic, and ChatGPT leads never pass "
      + "through Search Console.</p></div>";
    return h;
  }
  // a state's parts: its cities, its counties, one 'Other' row a month for the places too small to
  // stand alone (under 20 impressions and no click that month) -- and what is left of the State
  // row after them is the state named on its own ("moving company nj"). A city listed here has a
  // row in every month it had a lead (the mart pins them, 2026-09-24), so its Leads are the window's.
  function stateDetail(D, mset, cset, st, whole) {
    var rows = areaRows(D, mset, cset, function (r) { return r.State === st && r.Level !== "State"; });
    var by = {};
    rows.forEach(function (r) {
      if (r.Level === "Other") return;
      var k = r.Level === "County" ? r.County : r.City;
      (by[r.Level + "|" + k] = by[r.Level + "|" + k] || []).push(r);
    });
    var list = Object.keys(by).map(function (k) { return { k: k, z: sumArea(by[k]) }; })
      .filter(function (o) { return o.z.qc || o.z.qi || o.z.bp || o.z.cp || o.z.lp; })
      .sort(function (a, b) { return (b.z.qc - a.z.qc) || (b.z.qi - a.z.qi); });
    var shown = list.slice(0, 40);
    var rest = sumArea(rows.filter(function (r) { return r.Level === "Other"; }));
    list.slice(40).forEach(function (o) {
      ["qc", "qi", "pw", "b1", "b2", "b3", "b4", "bp", "cp", "lp"].forEach(function (k) { rest[k] += o.z[k]; });
    });
    rest.pos = rest.qi ? rest.pw / rest.qi : null;
    rest.leads = 0;
    var parts = sumArea(rows);
    var alone = { qc: whole.qc - parts.qc, bp: whole.bp - parts.bp, cp: whole.cp - parts.cp, lp: whole.lp - parts.lp };
    var grey = function (label, z) {
      return '<tr class="os-grey"><td>' + esc(label) + '</td><td class="num">' + fmtN(z.qc) + '</td><td class="num">'
        + (z.qi ? fmtN(z.qi) : "—") + '</td><td class="num">' + fmtPos(z.pos) + "</td><td></td>"
        + '<td class="num">' + fmtN(z.bp) + '</td><td class="num">' + fmtN(z.cp) + '</td><td class="num">' + fmtN(z.lp)
        + '</td><td colspan="2"></td></tr>';
    };
    return '<table class="rs-table">' + areaHead("Place") + "<tbody>"
      + shown.map(function (o) {
        var p = o.k.split("|");
        var z = o.z;
        if (p[0] === "County") z.leads = 0;
        var tag = p[0] === "County" && !/county$/i.test(p[1]) ? ' <span class="os-small">county</span>' : "";
        return "<tr><td>" + esc(p[1]) + tag + "</td>" + areaCells(z) + "</tr>";
      }).join("")
      + grey(list.length > shown.length ? "Every other place (" + fmtN(list.length - shown.length) + " more, plus the small ones)"
             : "Smaller places (under 20 impressions and no click in a month)", rest)
      + grey("The state named alone (no town)", { qc: alone.qc, qi: 0, pos: null, bp: alone.bp, cp: alone.cp, lp: alone.lp })
      + "</tbody></table>";
  }
  function wireStates(mine, D) {
    mine.querySelectorAll("#osStates tr.rs-group").forEach(function (tr) {
      tr.onclick = function () {
        var st = tr.getAttribute("data-st");
        S.open[st] = !S.open[st];
        paint(mine, D);
      };
    });
  }

  /* ---- (d) are we winning it: the Keyword Planner cities ---- */
  function cityPanel(D, mset, cset, ms) {
    var rows = areaRows(D, mset, cset, function (r) { return r.Level === "City" && r["Search Volume"] != null && r["Search Volume"] !== ""; });
    var by = {};
    rows.forEach(function (r) { var k = r.State + "|" + r.City; (by[k] = by[k] || []).push(r); });
    var dsum = 0;
    ms.forEach(function (m) { dsum += D.days[m] || 0; });
    var months = dsum / 30.4375;
    var list = Object.keys(by).map(function (k) {
      var z = sumArea(by[k]);
      var p = k.split("|");
      return { st: p[0], city: p[1], z: z, per: (z.vol && months) ? 1000 * z.qc / (z.vol * months) : null };
    }).sort(function (a, b) { return (b.z.vol || 0) - (a.z.vol || 0); });
    if (!list.length) return "";
    var T = { vol: 0, qc: 0 }, tags = { Winning: 0, "Page 1": 0, "Page 2": 0, Invisible: 0, "Rarely shown": 0, "Not shown": 0 };
    list.forEach(function (o) {
      T.vol += o.z.vol || 0; T.qc += o.z.qc;
      tags[verdictOf(o.z.pos, o.z.qi)]++;
    });
    var perAll = months && T.vol ? 1000 * T.qc / (T.vol * months) : null;
    var shown = S.cityAll ? list : list.slice(0, 25);
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Are we winning it — the '
      + list.length + ' cities with Keyword Planner search volume</span></div>'
      + '<p class="rs-hint">Searches a month is Google Keyword Planner\'s volume for "movers &lt;city&gt;" searches (the demand). '
      + "Our clicks and position are the 'movers' searches that name the city (our share of it). Across these cities we collect "
      + "<b>" + (perAll == null ? "—" : perAll.toFixed(2)) + " clicks per 1,000 searches</b> — " + tags.Winning + " winning, "
      + tags["Page 1"] + " on page 1, " + tags["Page 2"] + " on page 2, " + tags.Invisible + " invisible, "
      + (tags["Rarely shown"] + tags["Not shown"]) + " shown too rarely to judge.</p>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>City</th><th class="num">Searches a month</th>'
      + '<th class="num">Our clicks</th><th class="num">Impressions</th><th class="num">Position</th><th>Verdict</th>'
      + '<th class="num" title="our clicks per 1,000 Keyword Planner searches over the window">Clicks per 1,000 searches</th>'
      + '<th class="num" title="website-link clicks on a Business Profile listing in this city">Listing clicks</th>'
      + '<th class="num">Leads</th><th class="num">Jobs</th></tr></thead><tbody>'
      + shown.map(function (o) {
        return '<tr><td class="strong">' + esc(o.city) + ' <span class="os-small">' + esc(o.st) + "</span></td>"
          + '<td class="num">' + fmtN(o.z.vol) + '</td><td class="num strong">' + fmtN(o.z.qc) + '</td><td class="num">'
          + (o.z.qi ? fmtN(o.z.qi) : "—") + '</td><td class="num">' + fmtPos(o.z.pos) + "</td><td>" + posPill(o.z.pos, o.z.qi)
          + '</td><td class="num">' + (o.per == null ? "—" : o.per.toFixed(2)) + '</td><td class="num">' + (o.z.bp ? fmtN(o.z.bp) : '<span class="os-small">—</span>')
          + '</td><td class="num">' + fmtN(o.z.leads) + '</td><td class="num">' + fmtN(o.z.jobs) + "</td></tr>";
      }).join("")
      + '<tr class="os-tot"><td>All ' + list.length + '</td><td class="num">' + fmtN(T.vol) + '</td><td class="num">' + fmtN(T.qc)
      + '</td><td colspan="3"></td><td class="num">' + (perAll == null ? "—" : perAll.toFixed(2)) + '</td><td colspan="3"></td></tr>'
      + "</tbody></table></div>"
      + (list.length > 25 ? '<div class="os-more"><button class="rs-btn" type="button" id="osCityAll">'
        + (S.cityAll ? "Show the top 25" : "Show all " + list.length) + "</button></div>" : "")
      + '<p class="rs-hint" style="margin:10px 0 0">Verdict by average position: <b>Winning</b> 1–3, <b>Page 1</b> 4–10, <b>Page 2</b> '
      + "11–20, <b>Invisible</b> 21 or worse; under " + MIN_VERDICT_IMPR + " impressions there is no verdict. "
      + "Leads and jobs are Zip to Zip's, by the lead's city, in the window. Position and "
      + "impressions count from " + monthLong(CLEAN_FROM) + ".</p></div>";
  }

  /* ---- (e) top searches ---- */
  function paintTop(mine, D, mset, cset) {
    var host = mine.querySelector("#osTop");
    var agg = {}, brandN = 0, brand = { c: 0, i: 0, pw: 0 }, tail = {}, hidden = 0;
    D.Q.forEach(function (r) {
      var m = ymOf(r);
      if (!mset[m]) return;
      var c = num(r.Clicks), i = cset[m] ? num(r.Impressions) : 0, pw = cset[m] ? num(r.Position) * num(r.Impressions) : 0;
      if (r.Type === "Hidden by Google") { hidden += c; return; }
      if (r.Query === "(long tail)") {
        var t = tail[r.Type] || (tail[r.Type] = { c: 0, i: 0 }); t.c += c; t.i += i; return;
      }
      var a = agg[r.Query] || (agg[r.Query] = { q: r.Query, type: r.Type, st: r.State, city: r.City || r.County, c: 0, i: 0, pw: 0 });
      a.c += c; a.i += i; a.pw += pw;
    });
    var all = Object.keys(agg).map(function (k) { return agg[k]; });
    all.forEach(function (a) { if (a.type === "Brand") { brandN++; brand.c += a.c; brand.i += a.i; brand.pw += a.pw; } });
    var q = (S.q || "").trim().toLowerCase();
    var list = all.filter(function (a) {
      return (!S.qType || a.type === S.qType) && (!q || a.q.indexOf(q) >= 0) && (S.qType === "Brand" || q || a.type !== "Brand");
    }).sort(function (a, b) { return (b.c - a.c) || (b.i - a.i); });
    var typeCount = {};
    all.forEach(function (a) { typeCount[a.type] = (typeCount[a.type] || 0) + 1; });
    var shown = list.slice(0, TOP_N);
    // the searches past the top 100, as ONE grey row (2026-09-24 review): without it the hint's "the
    // rows add up to the site total" was false -- the mart holds thousands of listed searches a window
    var more = list.slice(TOP_N), moreT = { c: 0, i: 0, pw: 0 };
    more.forEach(function (a) { moreT.c += a.c; moreT.i += a.i; moreT.pw += a.pw; });
    var row = function (a) {
      return '<tr><td class="os-q">' + esc(a.q) + "</td><td>" + esc(a.type) + "</td><td>" + esc([a.city, a.st].filter(Boolean).join(", ") || "—")
        + '</td><td class="num strong">' + fmtN(a.c) + '</td><td class="num">' + (a.i ? fmtN(a.i) : "—") + '</td><td class="num">'
        + fmtPos(a.i ? a.pw / a.i : null) + "</td></tr>";
    };
    var h = '<div class="panel-head"><span class="panel-title">Top searches</span>'
      + '<span class="rs-hint" style="margin:0">' + fmtN(list.length) + " searches match" + (list.length > shown.length ? " · top " + TOP_N + " shown" : "") + "</span></div>"
      + '<div class="rs-bar"><div id="osQType"></div>'
      + '<div class="rs-fld"><span>Search</span><input class="rs-inp" id="osQ" placeholder="a word in the search" value="' + esc(S.q) + '"></div>'
      + '<div class="rs-spacer"></div><button class="rs-btn" id="osQCsv" type="button">Export CSV</button></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Search</th><th>Type</th><th>Place named</th>'
      + '<th class="num">Clicks</th><th class="num">Impressions</th><th class="num">Position</th></tr></thead><tbody>'
      + (!S.qType && !q && brandN ? '<tr class="rs-group" id="osBrandRow"><td>All brand searches <span class="os-small">' + fmtN(brandN)
        + " searches — pick Brand to list them</span></td><td>Brand</td><td>—</td><td class=\"num\">" + fmtN(brand.c)
        + '</td><td class="num">' + fmtN(brand.i) + '</td><td class="num">' + fmtPos(brand.i ? brand.pw / brand.i : null) + "</td></tr>" : "")
      + (shown.length ? shown.map(row).join("") : '<tr><td colspan="6" class="dim">No search matches.</td></tr>')
      + (more.length ? '<tr class="os-grey"><td>(' + fmtN(more.length) + " more listed searches — every one is in the CSV)</td><td>—</td><td>—</td>"
        + '<td class="num">' + fmtN(moreT.c) + '</td><td class="num">' + (moreT.i ? fmtN(moreT.i) : "—") + '</td><td class="num">'
        + fmtPos(moreT.i ? moreT.pw / moreT.i : null) + "</td></tr>" : "")
      + (!S.qType && !q ? Object.keys(tail).map(function (k) {
          return '<tr class="os-grey"><td>(long tail: rare searches)</td><td>' + esc(k) + '</td><td>—</td><td class="num">' + fmtN(tail[k].c)
            + '</td><td class="num">' + fmtN(tail[k].i) + '</td><td class="num">—</td></tr>';
        }).join("") + '<tr class="os-grey"><td>(hidden by Google)</td><td>—</td><td>—</td><td class="num">' + fmtN(hidden)
          + '</td><td class="num">—</td><td class="num">—</td></tr>' : "")
      + "</tbody></table></div>"
      + '<p class="rs-hint" style="margin:10px 0 0">A search is listed on its own when it earned a click or 50 impressions in a month; '
      + "the rest is its type's long tail. With no filter the rows add up to the site total (the searches past the top " + TOP_N
      + " are one grey row) — the last row is what Google counts but never names. "
      + "Impressions and position count from " + monthLong(CLEAN_FROM) + ".</p>";
    host.innerHTML = h;
    RSC.localSelect(host.querySelector("#osQType"), {
      label: "Type", allLabel: "Every type (brand collapsed)",
      values: TYPES.filter(function (k) { return k !== "Hidden by Google"; }).map(function (k) { return { v: k, l: k, n: typeCount[k] || 0 }; }),
      value: S.qType, onChange: function (v) { S.qType = v; paintTop(mine, D, mset, cset); },
    });
    var tq = null;
    host.querySelector("#osQ").oninput = function (e) {
      clearTimeout(tq);
      tq = setTimeout(function () {
        S.q = e.target.value; paintTop(mine, D, mset, cset);
        var inp = host.querySelector("#osQ"); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 220);
    };
    var br = host.querySelector("#osBrandRow");
    if (br) br.onclick = function () { S.qType = "Brand"; paintTop(mine, D, mset, cset); };
    host.querySelector("#osQCsv").onclick = function () {
      csvDownload("Organic searches (" + fmtN(list.length) + ").csv",
        ["Search", "Type", "State", "Place named", "Clicks", "Impressions (from " + CLEAN_FROM + ")", "Position"],
        list.map(function (a) { return [a.q, a.type, a.st || "", a.city || "", a.c, a.i, a.i ? (a.pw / a.i).toFixed(1) : ""]; }));
    };
  }

  /* ---- (f) which pages win ---- */
  function famChart(host, D) {
    var by = {};
    D.months.forEach(function (m) { by[m] = {}; });
    D.PG.forEach(function (r) { var m = ymOf(r); if (by[m]) by[m][r.Family] = (by[m][r.Family] || 0) + num(r.Clicks); });
    RSC.chartCard(host, {
      title: "Which pages win — clicks by the page they landed on, every month on file", key: "os-fam",
      buildChart: function (canvas) {
        var C = palette();
        var col = { "Home": C.brand, "Business Profile listing": C.blue, "Location page": C.violet,
                    "State page": soft(C.violet, 0.45), "City page": soft(C.blue, 0.45), "Service page": C.warn,
                    "Blog": C.faint, "Reviews / About": C.muted, "Other": C.line };
        return new Chart(canvas, {
          type: "bar",
          data: { labels: D.months.map(function (m) { return monthLbl(m) + (D.complete[m] ? "" : "*"); }),
                  datasets: FAMILIES.map(function (f) {
                    return { label: f, data: D.months.map(function (m) { return by[m][f] || 0; }), backgroundColor: col[f], stack: "p" };
                  }) },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                     scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } },
        });
      },
      buildTable: function () {
        return '<table class="rs-table"><thead><tr><th>Month</th>' + FAMILIES.map(function (f) { return '<th class="num">' + esc(f) + "</th>"; }).join("")
          + '<th class="num">All pages</th></tr></thead><tbody>'
          + D.months.map(function (m) {
            var t = 0; FAMILIES.forEach(function (f) { t += by[m][f] || 0; });
            return "<tr><td>" + esc(monthLong(m)) + "</td>" + FAMILIES.map(function (f) { return '<td class="num">' + fmtN(by[m][f] || 0) + "</td>"; }).join("")
              + '<td class="num strong">' + fmtN(t) + "</td></tr>";
          }).join("") + "</tbody></table>";
      },
    });
    var note = document.createElement("p");
    note.className = "rs-hint";
    note.style.margin = "-4px 0 14px";
    note.innerHTML = "Page totals run 1–6% above the site total by design: a search that shows two of our pages counts once for the site "
      + "and once for each page. City pages exist for NJ, PA and CT; Maryland's pages are the town pages from Dec 2025 (/elkridge …) "
      + "and its state page.";
    host.appendChild(note);
  }

  function listingPanel(D, ms) {
    var rows = D.PG.filter(function (r) { return r.Family === "Business Profile listing"; });
    if (!rows.length) return "";
    var by = {}, first = {}, tags = {}, meta = {};
    rows.forEach(function (r) {
      var k = r.Page, m = ymOf(r);
      var o = by[k] || (by[k] = {});
      o[m] = (o[m] || 0) + num(r.Clicks);
      if (num(r.Clicks) || num(r.Impressions)) first[k] = first[k] && first[k] < m ? first[k] : m;
      (r.Tag ? String(r.Tag).split(", ") : []).forEach(function (t) { (tags[k] = tags[k] || {})[t] = 1; });
      meta[k] = { st: r.State || "", place: r.Place || "" };
    });
    var cols = D.months.filter(function (m) {
      return Object.keys(by).some(function (k) { return by[k][m]; });
    });
    var wset = inSet(ms);
    var keys = Object.keys(by).sort(function (a, b) {
      var ta = 0, tb = 0;
      cols.forEach(function (m) { if (wset[m]) { ta += by[a][m] || 0; tb += by[b][m] || 0; } });
      return (tb - ta) || a.localeCompare(b);
    });
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Business Profile listings — website clicks by month</span></div>'
      + '<p class="rs-hint">One row per listing, whichever tag its link carried: <b>gmb</b> + the town (from Mar 2026), '
      + "<b>gbp_&lt;town&gt;_&lt;state&gt;</b> (from 21 Jun 2026), and <b>localfx</b> on Wilmington (Apr–Jun 2026). A month with clicks "
      + "is the sign the listing is live and working.</p>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Listing</th><th>First click</th>'
      + cols.map(function (m) { return '<th class="num">' + esc(monthLbl(m)) + (D.complete[m] ? "" : "*") + "</th>"; }).join("")
      + '<th class="num">In the window</th></tr></thead><tbody>'
      + keys.map(function (k) {
        var t = 0;
        cols.forEach(function (m) { if (wset[m]) t += by[k][m] || 0; });
        var who = meta[k].place ? meta[k].place + ", " + meta[k].st : (meta[k].st ? meta[k].st + " — statewide listing" : k);
        return '<tr><td class="strong">' + esc(who) + ' <span class="os-small">' + esc(Object.keys(tags[k] || {}).join(" · ")) + "</span></td>"
          + "<td>" + (first[k] ? esc(monthLbl(first[k])) : "—") + "</td>"
          + cols.map(function (m) { var v = by[k][m] || 0; return '<td class="num"><span class="os-heat' + (v ? "" : " z") + '">' + (v ? fmtN(v) : "·") + "</span></td>"; }).join("")
          + '<td class="num strong">' + fmtN(t) + "</td></tr>";
      }).join("")
      + "</tbody></table></div>"
      + '<p class="rs-hint" style="margin:10px 0 0">Search Console sees only the click on the listing\'s <b>website</b> link — not calls, '
      + "not direction requests, not views. Those need Google's Business Profile Performance API (a follow-up that needs Google's "
      + "approval on the account). A listing's first click here is when its tagged link first earned one, not when the listing was made.</p></div>";
  }

  function topPagesPanel(D, mset, cset) {
    var agg = {};
    D.PG.forEach(function (r) {
      var m = ymOf(r);
      if (!mset[m]) return;
      var a = agg[r.Page] || (agg[r.Page] = { p: r.Page, f: r.Family, st: r.State, place: r.Place, c: 0, i: 0, pw: 0 });
      a.c += num(r.Clicks);
      if (cset[m]) { a.i += num(r.Impressions); a.pw += num(r.Position) * num(r.Impressions); }
    });
    var list = Object.keys(agg).map(function (k) { return agg[k]; }).sort(function (a, b) { return (b.c - a.c) || (b.i - a.i); }).slice(0, 25);
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Top landing pages in the window</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Page</th><th>Family</th><th>Place</th>'
      + '<th class="num">Clicks</th><th class="num">Impressions</th><th class="num">Position</th></tr></thead><tbody>'
      + list.map(function (a) {
        return '<tr><td class="os-q">' + esc(a.p) + "</td><td>" + esc(a.f) + "</td><td>" + esc([a.place, a.st].filter(Boolean).join(", ") || "—")
          + '</td><td class="num strong">' + fmtN(a.c) + '</td><td class="num">' + (a.i ? fmtN(a.i) : "—") + '</td><td class="num">'
          + fmtPos(a.i ? a.pw / a.i : null) + "</td></tr>";
      }).join("") + "</tbody></table></div>"
      + '<p class="rs-hint" style="margin:10px 0 0">Pages are cleaned: no www, no /en, no tags — the home page and /home are one page.</p></div>';
  }

  /* ---- the check panel: place names we could not put in one state ---- */
  function checkPanel(D, mset) {
    var amb = {};
    D.Q.forEach(function (r) {
      if (!mset[ymOf(r)] || r.Type !== "Movers + place" || r.State || !r.City) return;
      var a = amb[r.City] || (amb[r.City] = { c: 0, i: 0, n: 0 });
      a.c += num(r.Clicks); a.i += num(r.Impressions); a.n++;
    });
    var keys = Object.keys(amb).sort(function (a, b) { return amb[b].i - amb[a].i; }).slice(0, 15);
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Check — place names we could not put in one state</span></div>'
      + '<p class="rs-hint">A \'movers\' search that names a town several of our states share, with no state in the search and no leads '
      + "to break the tie, is shown here and left out of the state table. Place matching reads about 5,800 town names and a stop list "
      + "(words like 'commercial' and 'wall' that are also towns).</p>"
      + (keys.length ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Name in the search</th><th class="num">Searches</th>'
        + '<th class="num">Clicks</th><th class="num">Impressions</th></tr></thead><tbody>'
        + keys.map(function (k) { return "<tr><td>" + esc(k) + '</td><td class="num">' + fmtN(amb[k].n) + '</td><td class="num">' + fmtN(amb[k].c)
          + '</td><td class="num">' + fmtN(amb[k].i) + "</td></tr>"; }).join("") + "</tbody></table></div>"
        : '<div class="os-empty">None in this window.</div>') + "</div>";
  }

  function notesPanel(D) {
    return '<div class="panel"><div class="panel-head"><span class="panel-title">How to read this page</span></div><ul class="os-notes">'
      + "<li><b>Search Console never says where the searcher was.</b> A place comes only from the words of the search or the page "
      + "they landed on, so every state and city figure is a floor, not that place's demand. Keyword Planner's volume is the demand number.</li>"
      + "<li><b>Google hides about 45% of clicks</b> from the list of searches (privacy thresholds). The 'hidden by Google' remainder keeps "
      + "every search total equal to the site total.</li>"
      + "<li><b>Impressions and position changed meaning on " + BREAK_NOTE + "</b>, when Google stopped serving 100 results a page to "
      + "rank-tracking tools. Comparing impressions across that date would show a fake collapse, so the compare is clicks only and "
      + "impressions count from " + monthLong(CLEAN_FROM) + ".</li>"
      + "<li><b>Summer 2025 is capped</b>: each day to 11 Sep 2025 holds exactly 5,000 searches, so rare searches are missing there. "
      + "Clicks look unaffected.</li>"
      + "<li><b>Leads are context, not cause.</b> The lead side cannot separate paid Google from organic, and ChatGPT leads never "
      + "pass through Search Console.</li>"
      + "<li><b>Business Profile</b> clicks are website-link clicks only; calls and directions are not in this data.</li>"
      + "<li>Data from " + esc(monthLong(D.months[0])) + " (the first day Google keeps) to " + esc(D.lastDay)
      + ", refreshed daily around 10:45 UTC with the Search Console pull.</li>"
      + "</ul></div>";
  }
})();
