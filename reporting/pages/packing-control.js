/* PACKING CONTROL — what the load needed, against what the crew booked.
 *
 * Every move has a physical packing need: boxes to fill, furniture to wrap, mattresses to
 * cover. The calendar records that need item by item; the office sheet records what was
 * actually booked. Put them on one row and the difference is measurable — per job, and then
 * per foreman.
 *
 * WHY THE ENGINE LIVES HERE AND NOT IN THE MART. Every number on this page is a comparison
 * against peers, and "peers" depends on what is on screen: March, or the whole year, or one
 * book. A median baked nightly would silently answer a different question than the one the
 * filter bar is asking. So fct_packing_job ships the per-job facts and this file computes the
 * medians, the rank-sum test and the score for whatever window is selected.
 *
 * THE DISCIPLINE. Customers pack their own things all the time. It is legitimate, it depresses
 * a foreman's numbers through no fault of his, and it is the FIRST thing to rule out — which
 * is exactly what the confidence badge tests: self-packing lands at random, so it cannot
 * explain a shortfall that is foreman-specific, consistent, and present on several independent
 * measures. Single jobs are a spot-check queue. They are never evidence.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_packing_job) {
    // PAYLOAD CONTRACT: a column missing from this list never arrives, however well the page
    // is written. Anything the engine reads has to be named here.
    RS.DATASETS.fct_packing_job = {
      table: "fct_packing_job",
      cols: ["Job Code", "Day", "Customer", "Foreman", "Foreman Email", "Company",
             "Job Type", "Moving Type", "Foreman Typed",
             "Sold USD", "Quoted USD", "Real CF", "Sold CF", "Total Charge",
             "Boxes Sold", "Tape Sold", "Wrap Sold", "Covers Sold", "Item Lines",
             "Calendar CF", "Inv Boxes", "Inv Furniture", "Inv Wrappable", "Inv Mattresses",
             "Quoted Units", "Packed By Owner", "No Quote", "Has Inventory",
             "Packing Units", "USD per Unit", "USD per 100 CF", "Tape per Box",
             "Cover Cover Pct", "Wrap Cover Pct", "CF Ratio", "Zero Pack", "Quote Leak",
             "Flags"],
    };
  }
})();

registerPage({
  id: "packing-control",
  title: "Packing Control",
  subtitle: "The packing each load needed, against what the crew booked — and who is out of line with everyone else.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };

    /* ---------------------------------------------------------------- the dials
     * Kept together and named, because these are the numbers that decide whether a person's
     * name appears on a board about honesty. Changing one is a decision, not a tweak.
     */
    var DIAL = {
      flag: 12,        // concern score at or above this puts a foreman on the board
      minJobs: 10,     // fewer comparable jobs than this: a profile, never a judgement
      mwuN: 8,         // each side of the rank-sum test needs this many jobs
      boxesPerTape: 8, // one roll of tape covers about this many boxes
      cfUnder: 0.9,    // real CF below this share of the calendar's = under-reporting
    };

    var S = window.__PK || (window.__PK = {
      rows: null, month: "", co: "", open: null, q: "", sort: "score", flagOnly: false,
      memo: null, memoKey: "",
    });

    /* ================================================================ THE ENGINE
     * Three pure functions. Exposed on window.PKENG so they can be exercised directly with
     * synthetic data — a scoring rule that has never been run against a known answer is a
     * rule nobody should be judged by.
     */
    function median(xs) {
      var v = xs.filter(function (x) { return x != null && isFinite(x); }).sort(function (a, b) { return a - b; });
      if (!v.length) return null;
      var n = v.length;
      return n % 2 ? v[(n - 1) / 2] : (v[n / 2 - 1] + v[n / 2]) / 2;
    }

    function erfc(x) {
      // Numerical Recipes' rational approximation — |error| < 1.2e-7, which is four orders
      // finer than any p-value threshold on this page.
      var z = Math.abs(x), t = 1 / (1 + z / 2);
      var r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 +
        t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 +
        t * (-0.82215223 + t * 0.17087277)))))))));
      return x >= 0 ? r : 2 - r;
    }

    /* One-sided tie-corrected Mann-Whitney U: is sample `a` shifted BELOW sample `b`?
     * This is the brake on false accusations. A low median alone means nothing — one bad week
     * drags an average. This asks whether the whole distribution sits low. Returns null when
     * either side is too small to say anything, and "too small to say" must never render as
     * "clean". */
    function mwu(a, b) {
      a = a.filter(function (x) { return x != null && isFinite(x); });
      b = b.filter(function (x) { return x != null && isFinite(x); });
      if (a.length < DIAL.mwuN || b.length < DIAL.mwuN) return null;
      var pooled = a.map(function (v) { return [v, 0]; }).concat(b.map(function (v) { return [v, 1]; }));
      pooled.sort(function (x, y) { return x[0] - y[0]; });
      var n = pooled.length, i = 0, ra = 0, tie = 0;
      while (i < n) {
        var j = i;
        while (j + 1 < n && pooled[j + 1][0] === pooled[i][0]) j++;
        var rank = (i + j) / 2 + 1, t = j - i + 1;
        for (var k = i; k <= j; k++) if (pooled[k][1] === 0) ra += rank;
        if (t > 1) tie += t * t * t - t;
        i = j + 1;
      }
      var na = a.length, nb = b.length;
      var u = ra - na * (na + 1) / 2;
      var mu = na * nb / 2;
      var sd2 = na * nb / 12 * ((n + 1) - tie / (n * (n - 1)));
      if (!(sd2 > 0)) return null;
      var z = (u - mu + 0.5) / Math.sqrt(sd2);     // continuity-corrected, lower tail
      return 0.5 * erfc(-z / Math.SQRT2);
    }

    // the five measures a foreman is compared on, in the order they carry weight
    var MEASURES = [
      { k: "USD per 100 CF", lab: "$ per 100 CF", w: 30, fmt: "usd",
        help: "Packing booked per 100 cubic feet actually moved — the headline rate." },
      { k: "USD per Unit", lab: "$ per packing unit", w: 30, fmt: "usd",
        help: "Packing booked per box + wrappable piece on the truck. Corrects for load size." },
      { k: "Cover Cover Pct", lab: "Mattress covers", w: 10, fmt: "pct",
        help: "Share of the mattresses on the truck that got a cover." },
      { k: "Wrap Cover Pct", lab: "Shrink wrap", w: 5, fmt: "pct",
        help: "Share of wrappable pieces that got wrap." },
      { k: "Tape per Box", lab: "Tape per box", w: 5, fmt: "num",
        help: "Rolls booked per box on the truck. One roll covers about " + DIAL.boxesPerTape + "." },
    ];

    /* Per foreman: the profile, the score, and how far it can be trusted. */
    function rollup(jobs) {
      var live = jobs.filter(function (r) { return !r["Packed By Owner"]; });
      var by = {};
      live.forEach(function (r) {
        var f = r.Foreman;
        if (!f) return;
        (by[f] || (by[f] = [])).push(r);
      });
      function col(rs, k) { return rs.map(function (r) { return r[k]; }); }

      var fleet = {};
      MEASURES.concat([{ k: "CF Ratio" }]).forEach(function (m) { fleet[m.k] = median(col(live, m.k)); });

      var names = Object.keys(by).sort();
      return names.map(function (name) {
        var rs = by[name], n = rs.length;
        var med = {}, ps = {}, below = 0, tested = 0;
        var others = [];
        names.forEach(function (o) { if (o !== name) others = others.concat(by[o]); });

        MEASURES.concat([{ k: "CF Ratio" }]).forEach(function (m) { med[m.k] = median(col(rs, m.k)); });

        // shortfall on one measure, as a fraction of the fleet median, capped at 1
        function short(k, w) {
          var f = fleet[k], v = med[k];
          if (!f || f <= 0 || v == null) return 0;
          return Math.max(0, Math.min(1, (f - v) / f)) * w;
        }
        var scored = n >= DIAL.minJobs;
        var zeroRate = n ? rs.filter(function (r) { return r["Zero Pack"]; }).length / n : 0;
        var score = 0;
        MEASURES.forEach(function (m) { score += short(m.k, m.w); });
        var cfr = med["CF Ratio"];
        if (cfr != null && cfr < DIAL.cfUnder) score += Math.min(1, (DIAL.cfUnder - cfr) / 0.3) * 15;
        score += Math.min(1, zeroRate / 0.3) * 15;

        MEASURES.forEach(function (m) {
          var p = mwu(col(rs, m.k), col(others, m.k));
          ps[m.k] = p;
          if (p == null) return;
          tested++;
          if (p < 0.05 && med[m.k] != null && fleet[m.k] != null && med[m.k] < fleet[m.k]) below++;
        });
        var bestP = null;
        MEASURES.forEach(function (m) { if (ps[m.k] != null && (bestP == null || ps[m.k] < bestP)) bestP = ps[m.k]; });

        var conf = !tested ? "THIN"
          : (below >= 2 || (bestP != null && bestP < 0.005)) ? "STRONG"
          : below === 1 ? "WEAK" : "NORMAL";

        // rough size of what may be going unrecorded: the per-unit gap, over the units handled
        var opp = 0;
        if (scored && fleet["USD per Unit"] && med["USD per Unit"] != null) {
          var gap = fleet["USD per Unit"] - med["USD per Unit"];
          if (gap > 0) rs.forEach(function (r) { opp += gap * (r["Packing Units"] || 0); });
        }

        var verdict = !scored ? "thin"
          : (score >= DIAL.flag && conf === "STRONG") ? "review"
          : score >= DIAL.flag ? "look"
          : conf === "THIN" ? "untested" : "ok";

        return {
          name: name, jobs: rs, n: n, med: med, ps: ps, below: below, bestP: bestP,
          score: scored ? Math.round(score) : null, conf: conf, verdict: verdict,
          zeroRate: zeroRate, opp: opp, fleet: fleet,
          all: jobs.filter(function (r) { return r.Foreman === name; }),
          sold: rs.reduce(function (a, r) { return a + (+r["Sold USD"] || 0); }, 0),
          quoted: rs.reduce(function (a, r) { return a + (+r["Quoted USD"] || 0); }, 0),
          units: rs.reduce(function (a, r) { return a + (+r["Packing Units"] || 0); }, 0),
          selfPacked: jobs.filter(function (r) { return r.Foreman === name && r["Packed By Owner"]; }).length,
        };
      });
    }
    window.PKENG = { median: median, mwu: mwu, rollup: rollup, MEASURES: MEASURES, DIAL: DIAL };

    /* ================================================================ formatting */
    var usd = function (v, d) {
      return v == null || !isFinite(v) ? "—" :
        "$" + (+v).toLocaleString("en-US", { minimumFractionDigits: d == null ? 0 : d, maximumFractionDigits: d == null ? 0 : d });
    };
    var pct = function (v) { return v == null || !isFinite(v) ? "—" : Math.round(v * 100) + "%"; };
    var num = function (v, d) { return v == null || !isFinite(v) ? "—" : (+v).toFixed(d == null ? 2 : d); };
    function fmtM(m, v) { return m.fmt === "usd" ? usd(v, 2) : m.fmt === "pct" ? pct(v) : num(v); }
    function monthOf(d) { return String(d || "").slice(0, 7); }
    function dayLab(d) {
      if (!d) return "—";
      var p = String(d).slice(0, 10).split("-");
      return p[2] + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+p[1] - 1];
    }
    var VERDICT = {
      review:   { lab: "Needs review",    cls: "v-review" },
      look:     { lab: "Worth a look",    cls: "v-look" },
      ok:       { lab: "In line",         cls: "v-ok" },
      untested: { lab: "Not enough data", cls: "v-thin" },
      thin:     { lab: "Too few jobs",    cls: "v-thin" },
    };

    /* ================================================================ style
     * SEVERITY IS COLOUR, CERTAINTY IS TEXTURE. The two things a reader must not confuse are
     * "how far out of line" and "how sure are we" — so they use different channels entirely:
     * the verdict carries the hue, the confidence badge carries a fill pattern. A weak signal
     * can never borrow the visual weight of a strong one.
     */
    host.innerHTML = '<style id="pkCss">'
      + ".pk{--t1:27px;--t2:15px;--t3:13.5px;--t4:12px;--t5:11px;--t6:9.5px;max-width:none;"
      + "font-variant-numeric:tabular-nums}"
      + ".pk-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(168px,1fr));gap:12px}"
      + ".pk-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".pk-kpi b{display:block;font-size:var(--t1);letter-spacing:-.6px;line-height:1.1}"
      + ".pk-kpi span{display:block;font-size:var(--t6);font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".pk-kpi small{display:block;font-size:var(--t5);color:var(--muted);margin-top:3px}"
      + ".pk-kpi.neg b{color:var(--neg)} .pk-kpi.warn b{color:var(--warn)} .pk-kpi.pos b{color:var(--pos)}"
      // control bar
      + ".pk-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:16px 0 6px}"
      + ".pk-bar select,.pk-bar input{background:var(--panel);color:var(--ink);border:1px solid var(--line);"
      + "border-radius:9px;padding:7px 10px;font-size:var(--t4);font-family:inherit}"
      + ".pk-bar input{min-width:190px}"
      + ".pk-tog{display:inline-flex;align-items:center;gap:7px;background:var(--panel);border:1px solid var(--line);"
      + "border-radius:9px;padding:7px 11px;font-size:var(--t4);color:var(--muted);cursor:pointer;user-select:none}"
      + ".pk-tog.on{border-color:var(--blue);color:var(--ink)}"
      + ".pk-tog i{width:9px;height:9px;border-radius:3px;background:var(--line-2);display:block}"
      + ".pk-tog.on i{background:var(--blue)}"
      + ".pk-seg{display:inline-flex;background:var(--panel);border:1px solid var(--line);border-radius:9px;overflow:hidden}"
      + ".pk-seg button{background:none;border:0;color:var(--muted);font:inherit;font-size:var(--t4);"
      + "padding:7px 13px;cursor:pointer}"
      + ".pk-seg button.on{background:var(--line);color:var(--ink);font-weight:700}"
      + ".pk-note{font-size:var(--t5);color:var(--faint);margin:0 0 14px;line-height:1.55;max-width:96ch}"
      // the board
      + ".pk-grid{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px;align-items:start}"
      + "@media(max-width:1100px){.pk-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".pk-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;"
      + "padding:14px 16px 14px 18px;margin-bottom:10px;cursor:pointer;position:relative;overflow:hidden;"
      + "transition:border-color .12s,transform .12s}"
      + ".pk-card:hover{border-color:var(--line-2);transform:translateX(1px)}"
      + ".pk-card.sel{border-color:var(--blue)}"
      + ".pk-card::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--line-2)}"
      + ".pk-card.v-review::before{background:var(--neg)} .pk-card.v-look::before{background:var(--warn)}"
      + ".pk-card.v-ok::before{background:var(--pos)} .pk-card.v-thin::before{background:var(--line-2)}"
      + ".pk-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}"
      + ".pk-name{font-size:var(--t2);font-weight:750;letter-spacing:-.2px}"
      + ".pk-sub{font-size:var(--t5);color:var(--faint);margin-left:auto;text-align:right;white-space:nowrap}"
      + ".pk-pill{font-size:var(--t6);font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "padding:3px 8px;border-radius:999px;border:1px solid}"
      + ".v-review .pk-pill{color:var(--neg);border-color:var(--neg);background:var(--neg-bg)}"
      + ".v-look .pk-pill{color:var(--warn);border-color:var(--warn);background:var(--warn-bg)}"
      + ".v-ok .pk-pill{color:var(--pos);border-color:var(--pos);background:var(--pos-bg)}"
      + ".v-thin .pk-pill{color:var(--faint);border-color:var(--line-2)}"
      // CERTAINTY = TEXTURE. same neutral ink, different fill; never competes with severity.
      + ".pk-conf{font-size:var(--t6);font-weight:800;letter-spacing:.05em;padding:3px 8px;border-radius:999px;"
      + "border:1px solid var(--line-2);color:var(--muted)}"
      + ".pk-conf.c-strong{color:var(--ink);border-color:var(--ink);"
      + "background:repeating-linear-gradient(135deg,transparent 0 3px,color-mix(in srgb,var(--ink) 22%,transparent) 3px 6px)}"
      + ".pk-conf.c-weak{background:repeating-linear-gradient(135deg,transparent 0 5px,"
      + "color-mix(in srgb,var(--muted) 16%,transparent) 5px 7px)}"
      + ".pk-conf.c-thin{border-style:dashed}"
      // the peer-delta bars: fleet median is the centre line, the foreman is the marker
      + ".pk-bars{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px 16px;margin-top:12px}"
      + ".pk-b label{display:flex;justify-content:space-between;font-size:var(--t6);color:var(--faint);"
      + "text-transform:uppercase;letter-spacing:.05em;font-weight:700;margin-bottom:4px}"
      + ".pk-b label b{color:var(--muted);font-weight:800}"
      + ".pk-track{position:relative;height:7px;background:var(--panel-2);border:1px solid var(--line);border-radius:4px}"
      + ".pk-track i{position:absolute;top:-1px;bottom:-1px;width:2px;background:var(--line-2);left:50%}"
      + ".pk-track u{position:absolute;top:0;bottom:0;border-radius:3px}"
      + ".pk-track u.lo{background:var(--neg)} .pk-track u.hi{background:var(--pos)}"
      + ".pk-track.na{opacity:.35}"
      // side rail
      + ".pk-rail{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px}"
      + ".pk-rail h4{margin:0 0 10px;font-size:var(--t6);font-weight:800;letter-spacing:.08em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".pk-row{display:flex;justify-content:space-between;gap:10px;font-size:var(--t4);padding:5px 0;"
      + "border-bottom:1px solid var(--line)}"
      + ".pk-row:last-child{border-bottom:0}"
      + ".pk-row b{font-weight:700}"
      + ".pk-q{border:0;background:none;text-align:left;width:100%;color:inherit;font:inherit;cursor:pointer;"
      + "padding:8px 0;border-bottom:1px solid var(--line);display:block}"
      + ".pk-q:last-child{border-bottom:0}"
      + ".pk-q:hover{color:var(--blue)}"
      + ".pk-q em{display:block;font-style:normal;font-size:var(--t5);color:var(--neg);margin-top:2px}"
      + ".pk-q span{font-size:var(--t5);color:var(--faint)}"
      // drawer
      + ".pk-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:60;opacity:0;pointer-events:none;transition:opacity .18s}"
      + ".pk-scrim.on{opacity:1;pointer-events:auto}"
      + ".pk-draw{position:fixed;top:0;right:0;bottom:0;width:min(760px,50vw);background:var(--bg);"
      + "border-left:1px solid var(--line-2);z-index:61;transform:translateX(100%);transition:transform .22s ease;"
      + "display:flex;flex-direction:column}"
      + "@media(max-width:900px){.pk-draw{width:100vw}}"
      + ".pk-draw.on{transform:none}"
      + ".pk-dh{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;align-items:flex-start;gap:12px}"
      + ".pk-dh h3{margin:0;font-size:20px;letter-spacing:-.3px}"
      + ".pk-dh p{margin:3px 0 0;font-size:var(--t5);color:var(--faint)}"
      + ".pk-x{margin-left:auto;background:none;border:1px solid var(--line);color:var(--muted);border-radius:9px;"
      + "width:30px;height:30px;font-size:16px;cursor:pointer;line-height:1;flex:none}"
      + ".pk-x:hover{color:var(--ink);border-color:var(--line-2)}"
      + ".pk-db{padding:16px 20px 40px;overflow:auto;flex:1}"
      + ".pk-read{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:14px}"
      + ".pk-read h5{margin:0 0 8px;font-size:var(--t6);letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".pk-read p{margin:0 0 9px;font-size:var(--t3);line-height:1.6;color:var(--ink)}"
      + ".pk-read p:last-child{margin-bottom:0}"
      + ".pk-cause{display:flex;gap:10px;font-size:var(--t4);line-height:1.55;padding:8px 0;border-top:1px solid var(--line)}"
      + ".pk-cause b{flex:none;width:18px;height:18px;border-radius:5px;background:var(--line);color:var(--muted);"
      + "font-size:var(--t6);display:grid;place-items:center;margin-top:1px}"
      + ".pk-cause span{color:var(--muted)}.pk-cause span i{font-style:normal;color:var(--ink);font-weight:650}"
      + ".pk-tbl{width:100%;border-collapse:collapse;font-size:var(--t4)}"
      + ".pk-tbl th{text-align:right;font-size:var(--t6);letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--faint);font-weight:800;padding:6px 8px;border-bottom:1px solid var(--line-2);position:sticky;top:0;background:var(--bg)}"
      + ".pk-tbl th:first-child,.pk-tbl td:first-child{text-align:left}"
      + ".pk-tbl td{padding:6px 8px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}"
      + ".pk-tbl tr.f td{background:var(--neg-bg)}"
      + ".pk-tbl tr.sp td{opacity:.5}"
      + ".pk-tbl em{font-style:normal;color:var(--neg);font-size:var(--t5)}"
      + ".pk-spark{display:flex;align-items:flex-end;gap:3px;height:44px;margin-top:6px}"
      + ".pk-spark div{flex:1;border-radius:2px 2px 0 0;background:var(--line-2);position:relative;min-height:2px}"
      + ".pk-spark div.hot{background:var(--neg)} .pk-spark div.mid{background:var(--warn)}"
      + ".pk-spark div.cool{background:var(--pos)}"
      + ".pk-sparkx{display:flex;gap:3px;font-size:8.5px;color:var(--faint);margin-top:3px}"
      + ".pk-sparkx span{flex:1;text-align:center}"
      + ".pk-empty{padding:34px;text-align:center;color:var(--faint);font-size:var(--t3);"
      + "background:var(--panel);border:1px solid var(--line);border-radius:14px}"
      + "</style>"
      + '<div class="pk"><div id="pkMain"></div></div>'
      + '<div class="pk-scrim" id="pkScrim"></div>'
      + '<div class="pk-draw" id="pkDraw"><div id="pkDrawIn"></div></div>';

    var main = host.querySelector("#pkMain");
    var scrim = host.querySelector("#pkScrim");
    var draw = host.querySelector("#pkDraw");

    /* ================================================================ data */
    main.innerHTML = '<div class="pk-empty">Loading packing records…</div>';
    RS.load("fct_packing_job").then(function (rows) {
      S.rows = (rows || []).map(function (r) {
        // the bridge ships DECIMALs as strings; every comparison below is numeric
        ["Sold USD", "Quoted USD", "Real CF", "Sold CF", "Total Charge", "Calendar CF",
         "USD per Unit", "USD per 100 CF", "Tape per Box", "Cover Cover Pct", "Wrap Cover Pct",
         "CF Ratio"].forEach(function (k) {
          r[k] = r[k] == null || r[k] === "" ? null : +r[k];
          if (r[k] != null && !isFinite(r[k])) r[k] = null;
        });
        ["Boxes Sold", "Tape Sold", "Wrap Sold", "Covers Sold", "Item Lines", "Inv Boxes",
         "Inv Furniture", "Inv Wrappable", "Inv Mattresses", "Quoted Units", "Packing Units",
         "Packed By Owner", "No Quote", "Has Inventory", "Zero Pack", "Quote Leak"].forEach(function (k) {
          r[k] = r[k] == null || r[k] === "" ? null : +r[k];
        });
        r.Day = String(r.Day || "").slice(0, 10);
        return r;
      });
      invalidate();
      paint();
    }).catch(function (e) {
      main.innerHTML = '<div class="pk-empty">Could not load packing records — ' + esc(e && e.message || e) + "</div>";
    });

    function invalidate() { S.memo = null; S.memoKey = ""; }

    function view() {
      return S.rows.filter(function (r) {
        if (S.month && monthOf(r.Day) !== S.month) return false;
        if (S.co && (r.Company || "—") !== S.co) return false;
        return true;
      });
    }

    /* ================================================================ paint */
    function paint() {
      if (!S.rows) return;
      var rows = view();
      // The engine is ~140 rank-sum tests over every job in the window. The name box and the
      // sort buttons change WHICH profiles are shown, never what they contain -- so the result
      // is cached against the only two inputs that can change it.
      var key = S.month + "|" + S.co;
      if (S.memoKey !== key || !S.memo) { S.memo = rollup(rows); S.memoKey = key; }
      var profiles = S.memo;
      var fleet = profiles.length ? profiles[0].fleet : {};

      var live = rows.filter(function (r) { return !r["Packed By Owner"]; });
      var sold = rows.reduce(function (a, r) { return a + (+r["Sold USD"] || 0); }, 0);
      var quoted = rows.reduce(function (a, r) { return a + (+r["Quoted USD"] || 0); }, 0);
      var flagged = profiles.filter(function (p) { return p.score != null && p.score >= DIAL.flag; });
      var strong = flagged.filter(function (p) { return p.conf === "STRONG"; });
      var opp = flagged.reduce(function (a, p) { return a + p.opp; }, 0);
      var invPct = rows.length ? rows.filter(function (r) { return r["Has Inventory"]; }).length / rows.length : 0;

      var months = {}, cos = {};
      S.rows.forEach(function (r) { if (r.Day) months[monthOf(r.Day)] = 1; cos[r.Company || "—"] = 1; });
      var mList = Object.keys(months).sort();

      var html = '<div class="pk-kpis">'
        + kpi(usd(sold), "Packing booked", rows.length.toLocaleString() + " jobs · " + usd(quoted) + " quoted by sales", "")
        + kpi(String(profiles.length), "Foremen measured", live.length.toLocaleString() + " comparable jobs", "")
        + kpi(String(flagged.length), "Above the concern line", strong.length + " of them on several independent measures",
              flagged.length ? (strong.length ? "neg" : "warn") : "pos")
        + kpi(usd(opp), "Gap against peers", "rough size of what may be going unrecorded", flagged.length ? "warn" : "")
        + kpi(pct(invPct), "Loads itemised", "jobs whose calendar lists the goods", invPct > 0.8 ? "pos" : "warn")
        + "</div>";

      html += '<div class="pk-bar">'
        + '<select id="pkMonth"><option value="">All months</option>'
        + mList.map(function (m) {
            return '<option value="' + m + '"' + (S.month === m ? " selected" : "") + ">" + monLab(m) + "</option>";
          }).join("") + "</select>"
        + (Object.keys(cos).length > 1
            ? '<select id="pkCo"><option value="">Both books</option>'
              + Object.keys(cos).sort().map(function (c) {
                  return '<option value="' + esc(c) + '"' + (S.co === c ? " selected" : "") + ">" + esc(c) + "</option>";
                }).join("") + "</select>"
            : "")
        + '<div class="pk-seg">'
        + seg("score", "By concern") + seg("sold", "By packing sold") + seg("jobs", "By jobs") + seg("name", "A–Z")
        + "</div>"
        + '<div class="pk-tog' + (S.flagOnly ? " on" : "") + '" id="pkFlag"><i></i>Only above the line</div>'
        + '<input id="pkQ" placeholder="Find a foreman…" value="' + esc(S.q) + '">'
        + "</div>";

      html += '<p class="pk-note"><b>How to read this.</b> Every figure is a comparison with the other foremen on '
        + "the same measure, over the window selected above. Customers packing their own things is normal and "
        + "legitimate — it lands at random, so it cannot explain a shortfall that is one man's, consistent, and "
        + "present on several measures at once. That is what the certainty badge tests. "
        + "<b>A high score is a reason to review, not proof of anything.</b> With "
        + profiles.length + " foremen across " + MEASURES.length + " measures (~"
        + (profiles.length * MEASURES.length) + " comparisons) expect a few weak hits by chance alone.</p>";

      var shown = profiles.slice();
      if (S.flagOnly) shown = shown.filter(function (p) { return p.score != null && p.score >= DIAL.flag; });
      if (S.q) {
        var q = S.q.toLowerCase();
        shown = shown.filter(function (p) { return p.name.toLowerCase().indexOf(q) >= 0; });
      }
      shown.sort(function (a, b) {
        if (S.sort === "name") return a.name.localeCompare(b.name);
        if (S.sort === "jobs") return b.n - a.n;
        if (S.sort === "sold") return b.sold - a.sold;
        // by concern: scored first, highest first; unscored fall to the bottom by job count
        if ((a.score == null) !== (b.score == null)) return a.score == null ? 1 : -1;
        return (b.score || 0) - (a.score || 0) || b.n - a.n;
      });

      html += '<div class="pk-grid"><div>'
        + (shown.length ? shown.map(card).join("")
            : '<div class="pk-empty">No foreman matches that filter.</div>')
        + "</div>" + rail(rows, profiles, fleet) + "</div>";

      main.innerHTML = html;
      wire(rows, profiles);
      // an open file is a claim about the window on screen; if the window moved, either
      // restate it against the new numbers or take it down
      if (S.open) {
        var still = null;
        profiles.forEach(function (p) { if (p.name === S.open) still = p; });
        if (still) openF(still, null); else close();
      }
    }

    function kpi(v, lab, sub, cls) {
      return '<div class="pk-kpi ' + (cls || "") + '"><b>' + esc(v) + "</b><span>" + esc(lab)
        + "</span><small>" + esc(sub) + "</small></div>";
    }
    function seg(k, lab) {
      return '<button data-sort="' + k + '" class="' + (S.sort === k ? "on" : "") + '">' + lab + "</button>";
    }
    function monLab(m) {
      var p = m.split("-");
      return ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"][+p[1] - 1] + " " + p[0];
    }

    /* one foreman, on the board */
    function card(p) {
      var v = VERDICT[p.verdict];
      var h = '<div class="pk-card ' + v.cls + (S.open === p.name ? " sel" : "") + '" data-f="' + esc(p.name) + '">'
        + '<div class="pk-head"><span class="pk-name">' + esc(p.name) + "</span>"
        + '<span class="pk-pill">' + v.lab + "</span>"
        + (p.score != null ? '<span class="pk-conf c-' + p.conf.toLowerCase() + '">'
            + (p.conf === "STRONG" ? "CONSISTENT" : p.conf === "WEAK" ? "ONE SIGNAL"
               : p.conf === "THIN" ? "UNTESTABLE" : "WITHIN NOISE") + "</span>" : "")
        + '<span class="pk-sub">' + (p.score != null ? "score " + p.score + " · " : "")
        + p.n + " job" + (p.n === 1 ? "" : "s") + " · " + usd(p.sold) + "</span></div>"
        + '<div class="pk-bars">'
        + MEASURES.map(function (m) { return bar(m, p.med[m.k], p.fleet[m.k]); }).join("")
        + "</div></div>";
      return h;
    }

    /* THE COMPARISON, DRAWN. The fleet median is the centre line; the bar grows left (below
     * peers, red) or right (above, green) by the relative gap, capped at ±100%. A number on
     * its own says nothing without the peer value beside it — this puts them in one glance. */
    function bar(m, v, f) {
      if (v == null || f == null || !(f > 0)) {
        return '<div class="pk-b"><label>' + m.lab + "<b>—</b></label>"
          + '<div class="pk-track na"><i></i></div></div>';
      }
      var rel = Math.max(-1, Math.min(1, (v - f) / f));
      var w = Math.abs(rel) * 50;
      var style = rel < 0 ? "right:50%;width:" + w + "%" : "left:50%;width:" + w + "%";
      return '<div class="pk-b" title="' + esc(m.help) + " Fleet median " + esc(fmtM(m, f)) + '.">'
        + "<label>" + m.lab + "<b>" + fmtM(m, v) + "</b></label>"
        + '<div class="pk-track"><i></i><u class="' + (rel < 0 ? "lo" : "hi") + '" style="' + style + '"></u></div></div>';
    }

    /* the side rail: fleet reference, and the queue the office actually works from */
    function rail(rows, profiles, fleet) {
      var h = '<div>';
      h += '<div class="pk-rail"><h4>Fleet reference · this window</h4>'
        + MEASURES.map(function (m) {
            return '<div class="pk-row"><span>' + m.lab + "</span><b>" + fmtM(m, fleet[m.k]) + "</b></div>";
          }).join("")
        + '<div class="pk-row"><span>Jobs with nothing booked</span><b>'
        + rows.filter(function (r) { return r["Zero Pack"] && !r["Packed By Owner"]; }).length + "</b></div>"
        + '<div class="pk-row"><span>Customer packed their own</span><b>'
        + rows.filter(function (r) { return r["Packed By Owner"]; }).length + "</b></div>"
        + '<div class="pk-row"><span>Sales quoted no packing</span><b>'
        + rows.filter(function (r) { return r["No Quote"]; }).length + "</b></div>"
        + "</div>";

      // spot-check queue — worst first, and deliberately capped with the remainder stated
      var q = rows.filter(function (r) { return r.Flags && !r["Packed By Owner"]; })
        .sort(function (a, b) {
          return (b["Quote Leak"] - a["Quote Leak"]) || ((b["Calendar CF"] || 0) - (a["Calendar CF"] || 0));
        });
      h += '<div class="pk-rail"><h4>Spot-check queue · ' + q.length + "</h4>";
      if (!q.length) h += '<div class="pk-row"><span>Nothing flagged in this window.</span></div>';
      else {
        h += q.slice(0, 12).map(function (r) {
          return '<button class="pk-q" data-job="' + esc(r["Job Code"]) + '" data-f="' + esc(r.Foreman || "") + '">'
            + "<b>" + esc(r.Customer || r["Job Code"]) + "</b> "
            + '<span>· ' + dayLab(r.Day) + " · " + esc(r.Foreman || "no foreman") + "</span>"
            + "<em>" + esc(r.Flags) + "</em></button>";
        }).join("");
        if (q.length > 12) h += '<div class="pk-row" style="color:var(--faint)"><span>'
          + (q.length - 12) + " more — open a foreman to see his own.</span></div>";
      }
      h += "</div></div>";
      return h;
    }

    function wire(rows, profiles) {
      var byName = {};
      profiles.forEach(function (p) { byName[p.name] = p; });

      var mm = main.querySelector("#pkMonth");
      if (mm) mm.onchange = function () { S.month = this.value; invalidate(); paint(); };
      var cc = main.querySelector("#pkCo");
      if (cc) cc.onchange = function () { S.co = this.value; invalidate(); paint(); };
      var fo = main.querySelector("#pkFlag");
      if (fo) fo.onclick = function () { S.flagOnly = !S.flagOnly; paint(); };
      var qq = main.querySelector("#pkQ");
      if (qq) qq.oninput = function () {
        S.q = this.value;
        var at = this.selectionStart;
        paint();
        var n = main.querySelector("#pkQ");
        if (n) { n.focus(); n.setSelectionRange(at, at); }
      };
      main.querySelectorAll(".pk-seg button").forEach(function (b) {
        b.onclick = function () { S.sort = b.dataset.sort; paint(); };
      });
      main.querySelectorAll(".pk-card").forEach(function (c) {
        c.onclick = function () { openF(byName[c.dataset.f], null); };
      });
      main.querySelectorAll(".pk-q").forEach(function (b) {
        b.onclick = function () { openF(byName[b.dataset.f], b.dataset.job); };
      });
    }

    /* ================================================================ the file
     * One foreman, in full. The order of what follows is the order a fair reader should take
     * it in: what the numbers are, then how sure we are, then what could explain it — with
     * the legitimate explanation first — and finally what to physically go and check.
     */
    function openF(p, jobCode) {
      if (!p) return;
      S.open = p.name;
      var v = VERDICT[p.verdict];

      var typed = {};
      p.all.forEach(function (r) { if (r["Foreman Typed"]) typed[r["Foreman Typed"]] = 1; });
      typed = Object.keys(typed);

      var h = '<div class="pk-dh"><div><h3>' + esc(p.name) + "</h3>"
        + (typed.length ? '<p style="color:var(--muted)">also typed on the sheet as '
            + typed.map(function (t) { return "“" + esc(t) + "”"; }).join(", ")
            + " — counted as one man</p>" : "")
        + "<p>" + p.n + " comparable job" + (p.n === 1 ? "" : "s")
        + (p.selfPacked ? " · " + p.selfPacked + " excluded (customer packed their own)" : "")
        + " · " + usd(p.sold) + " booked</p></div>"
        + '<button class="pk-x" id="pkX">&times;</button></div><div class="pk-db">';

      h += '<div class="pk-read ' + v.cls + '"><h5>Reading</h5><p>' + verdictText(p) + "</p>";
      if (p.verdict === "review" || p.verdict === "look") {
        h += '<div class="pk-cause"><b>1</b><span><i>The customer packed their own things.</i> '
          + "Legitimate, common, and the first thing to rule out. It happens at random, so it does not "
          + "normally follow one foreman across months — which is what the certainty badge measures.</span></div>"
          + '<div class="pk-cause"><b>2</b><span><i>Materials sold off the books.</i> Own materials brought to '
          + "the job, charged to the customer, never recorded. This is the reading only when several "
          + "independent measures fall together.</span></div>"
          + '<div class="pk-cause"><b>3</b><span><i>Simply not offering it.</i> Lost revenue rather than lost '
          + "cash — the likeliest explanation when the shortfall sits on the rate measures but the coverage "
          + "ones (covers, wrap, tape) look ordinary.</span></div>"
          + '<div class="pk-cause"><b>&#10003;</b><span><i>The physical check.</i> Take his next job: do the beds, '
          + "dressers and boxes on the truck match the covers, wrap and tape booked against it? That answers in "
          + "one morning what months of numbers can only suggest.</span></div>";
      }
      h += "</div>";

      // measure grid against peers
      h += '<div class="pk-rail"><h4>Against his peers</h4>'
        + MEASURES.map(function (m) {
            var val = p.med[m.k], f = p.fleet[m.k], pv = p.ps[m.k];
            var d = (val != null && f) ? Math.round((val - f) / f * 100) : null;
            return '<div class="pk-row"><span>' + m.lab + "</span><b>" + fmtM(m, val)
              + '<span style="color:var(--faint);font-weight:500"> vs ' + fmtM(m, f)
              + (d == null ? "" : " · " + (d > 0 ? "+" : "") + d + "%")
              + (pv == null ? " · untestable" : pv < 0.05 && d < 0 ? " · p=" + pv.toFixed(3) : "")
              + "</span></b></div>";
          }).join("")
        + '<div class="pk-row"><span>Nothing booked at all</span><b>' + pct(p.zeroRate) + " of jobs</b></div>"
        + '<div class="pk-row"><span>Real CF vs the calendar\'s</span><b>'
        + (p.med["CF Ratio"] == null ? "—" : num(p.med["CF Ratio"]) + "×") + "</b></div>"
        + (p.opp > 0 ? '<div class="pk-row"><span>Gap against peers, in money</span><b>' + usd(p.opp)
            + "</b></div>" : "")
        + "</div>";

      // month trend — a shortfall that appears in one month is a different story from one that
      // has been there all year, and only a trend can tell them apart
      var byM = {};
      p.jobs.forEach(function (r) {
        var m = monthOf(r.Day);
        if (!m) return;
        (byM[m] || (byM[m] = [])).push(r);
      });
      var ms = Object.keys(byM).sort();
      if (ms.length > 1) {
        var f100 = p.fleet["USD per 100 CF"];
        h += '<div class="pk-rail"><h4>$ per 100 CF, month by month · fleet ' + usd(f100, 2) + "</h4>"
          + '<div class="pk-spark">'
          + ms.map(function (m) {
              var mv = median(byM[m].map(function (r) { return r["USD per 100 CF"]; }));
              var rel = (mv == null || !f100) ? null : mv / f100;
              var hgt = rel == null ? 4 : Math.max(4, Math.min(100, rel * 55));
              var cls = rel == null ? "" : rel < 0.6 ? "hot" : rel < 0.85 ? "mid" : "cool";
              return '<div class="' + cls + '" style="height:' + hgt + '%" title="' + monLab(m) + ": "
                + (mv == null ? "no comparable jobs" : usd(mv, 2) + " · " + byM[m].length + " jobs") + '"></div>';
            }).join("")
          + '</div><div class="pk-sparkx">'
          + ms.map(function (m) { return "<span>" + m.slice(5) + "</span>"; }).join("")
          + "</div></div>";
      }

      // every job, so any claim above can be checked against the rows it came from
      // EVERY job, including the ones excluded from the statistics -- shown faded and marked,
      // because a reader who cannot see what was left out cannot check the arithmetic.
      var js = p.all.slice().sort(function (a, b) { return (a.Day < b.Day) - (a.Day > b.Day); });
      h += '<div class="pk-rail"><h4>Every job · newest first · ' + p.all.length + "</h4>"
        + '<div style="overflow:auto;max-height:52vh"><table class="pk-tbl"><thead><tr>'
        + "<th>Job</th><th>Day</th><th>CF</th><th>Boxes</th><th>Wrappable</th><th>Booked</th>"
        + "<th>$/100CF</th><th>Tape</th><th>Covers</th></tr></thead><tbody>"
        + js.map(function (r) {
            var cls = r["Packed By Owner"] ? "sp" : r.Flags ? "f" : "";
            return "<tr" + (cls ? ' class="' + cls + '"' : "")
              + (jobCode && r["Job Code"] === jobCode ? ' style="outline:2px solid var(--blue)"' : "") + ">"
              + "<td>" + esc(r.Customer || r["Job Code"])
              + (r["Packed By Owner"] ? '<br><span style="font-size:var(--t5);color:var(--faint)">'
                  + "customer packed their own — excluded</span>"
                  : r.Flags ? "<br><em>" + esc(r.Flags) + "</em>" : "") + "</td>"
              + "<td>" + dayLab(r.Day) + "</td>"
              + "<td>" + (r["Real CF"] == null ? "—" : Math.round(r["Real CF"])) + "</td>"
              + "<td>" + (r["Inv Boxes"] == null ? "—" : r["Inv Boxes"]) + "</td>"
              + "<td>" + (r["Inv Wrappable"] == null ? "—" : r["Inv Wrappable"]) + "</td>"
              + "<td>" + usd(r["Sold USD"]) + "</td>"
              + "<td>" + usd(r["USD per 100 CF"], 2) + "</td>"
              + "<td>" + (r["Tape Sold"] || 0) + "</td>"
              + "<td>" + (r["Covers Sold"] || 0) + (r["Inv Mattresses"] ? "/" + r["Inv Mattresses"] : "") + "</td>"
              + "</tr>";
          }).join("")
        + "</tbody></table></div></div></div>";

      draw.querySelector("#pkDrawIn").innerHTML = h;
      draw.classList.add("on");
      scrim.classList.add("on");
      draw.querySelector("#pkX").onclick = close;
      if (jobCode) {
        var hit = draw.querySelector('tr[style*="outline"]');
        if (hit) hit.scrollIntoView({ block: "center" });
      }
      paintSel();
    }
    function close() {
      draw.classList.remove("on");
      scrim.classList.remove("on");
      S.open = null;
      paintSel();
    }
    function paintSel() {
      main.querySelectorAll(".pk-card").forEach(function (c) {
        c.classList.toggle("sel", c.dataset.f === S.open);
      });
    }
    scrim.onclick = close;
    // bound once for the life of the tab: render() runs again on every navigation back to
    // this page, and a listener added each time would pile up against detached nodes
    if (!window.__PK_ESC) {
      window.__PK_ESC = function (e) {
        var d = document.getElementById("pkDraw");
        if (e.key === "Escape" && d && d.classList.contains("on")) {
          d.classList.remove("on");
          var sc = document.getElementById("pkScrim");
          if (sc) sc.classList.remove("on");
          if (window.__PK) window.__PK.open = null;
        }
      };
      document.addEventListener("keydown", window.__PK_ESC);
    }

    /* The sentence a person's name is attached to. Deliberately written once, here, so the
     * page cannot drift into language it should never use: no "fraud", no "lying", no
     * "stealing". The vocabulary is concern, review, off-book, worth checking. */
    function verdictText(p) {
      if (p.verdict === "thin") {
        return "Only " + p.n + " job" + (p.n === 1 ? "" : "s") + " in this window — below the "
          + DIAL.minJobs + " needed to compare fairly. This is a profile, not a judgement.";
      }
      if (p.verdict === "review") {
        return "Books less packing than his peers on " + p.below + " independent measure"
          + (p.below === 1 ? "" : "s") + ", consistently enough that chance is an unlikely explanation"
          + (p.bestP != null ? " (best p = " + p.bestP.toFixed(4) + ")" : "")
          + ". That is a reason to review, not proof of anything — work through the readings below in order.";
      }
      if (p.verdict === "look") {
        return "Below his peers on the numbers (score " + p.score + "), but not consistently enough to rule "
          + "out ordinary variation. Treat this as a question to answer, not a finding.";
      }
      if (p.verdict === "untested") {
        return "Too few comparable jobs on the measures that matter, so no peer test could run. "
          + "Silence here is not a clean bill — it is an absence of evidence either way.";
      }
      return "Books in line with his peers for the loads he handles"
        + (p.score ? " (score " + p.score + ", below the line of " + DIAL.flag + ")" : "") + ".";
    }
  },
});
