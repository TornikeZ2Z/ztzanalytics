/* CALENDAR CLEANUP — does every day have enough crews, and where is it tight?
 *
 * The question this answers is not "what is booked" but "can we staff it, and do we still
 * have room for tomorrow's sale". Every day should keep a couple of crews spare; a day that
 * runs to the last foreman has no room for a callback, a sick driver or a same-day booking.
 *
 * Reads fct_cleanup_day (the verdict) and fct_cleanup_job (the drill-down), both precomputed
 * by the pipeline from the same engine the dispatcher board runs.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.fct_cleanup_day) {
      RS.DATASETS.fct_cleanup_day = {
        table: "fct_cleanup_day",
        cols: ["Day", "Weekday", "Jobs", "Routes", "Routes Before Chaining", "Crews Available",
               "Target", "Spare", "Status", "Near Full", "Chains Applied", "Crews Off",
               "Chained Jobs", "Skipped", "Skipped Why",
               "Routes As Booked", "Auto Chains"],
      };
    }
    if (!RS.DATASETS.fct_cleanup_option) {
      RS.DATASETS.fct_cleanup_option = {
        table: "fct_cleanup_option",
        cols: ["Day", "Rank", "Kind", "Job Code", "Customer", "CF", "After Code",
               "After Customer", "Move To", "Target Spare", "Link Miles", "Link Minutes",
               "Cost", "Discount", "Recommended", "Purpose", "Lands Behind", "Status"],
      };
    }
    if (!RS.DATASETS.fct_cleanup_job) {
      RS.DATASETS.fct_cleanup_job = {
        table: "fct_cleanup_job",
        cols: ["Day", "Job Code", "Customer", "Start", "Hours", "CF", "Crew", "Moving Type",
               "Job Type", "Pickup Zip", "Pickup City", "Pickup State", "Delivery Zip",
               "Delivery City", "Delivery State", "Foreman Email", "Foreman", "Route", "Route Legs",
               "Chained After", "Base", "Company",
               "Pickup Lat", "Pickup Lon", "Delivery Lat", "Delivery Lon",
               "Base Zip", "Base Lat", "Base Lon"],
      };
    }
  }
})();

registerPage({
  id: "cleanup",
  title: "Calendar Cleanup",
  subtitle: "Crews needed against crews available, day by day — and where the buffer runs out.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__CU || (window.__CU = { days: null, jobs: null, opts: null,
      sel: null, probOnly: false, busy: "", msg: "",
      baseF: null, coF: null, focus: null, mapOn: false, openRun: null, shut: {} });

    host.innerHTML = '<style id="cuCss">'
      + ".cu-wrap{--t1:26px;--t2:15px;--t3:13.5px;--t4:12px;--t5:11px;--t6:9.5px;--r-card:14px;--r-ctl:10px;--r-bar:6px;--cu-lab:182px;max-width:1280px}"
      + ".cu-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}"
      + ".cu-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".cu-kpi b{font-variant-numeric:tabular-nums;display:block;font-size:26px;letter-spacing:-.5px;line-height:1.1}"
      + ".cu-kpi span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:4px}"
      + ".cu-kpi small{display:block;font-size:11px;color:var(--faint);margin-top:2px}"
      + ".cu-kpi.bad b{color:var(--neg)} .cu-kpi.warn b{color:var(--warn)}"
      + ".cu-kpi.good b{color:var(--pos)}"
      /* the horizon: one tile per day, so a problem is found by scanning not reading */
      + ".cu-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;margin-bottom:16px}"
      + ".cu-day{flex:0 0 auto;width:104px;background:var(--panel);border:1px solid var(--line);"
      + "border-radius:12px;padding:9px 10px;cursor:pointer;text-align:left;font:inherit;color:var(--ink)}"
      + ".cu-day:hover{border-color:var(--blue)}"
      + ".cu-day.on{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}"
      + ".cu-day .dow{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".cu-day .dat{font-size:14px;font-weight:750;letter-spacing:-.2px;margin-top:1px}"
      + ".cu-day .bar{height:5px;border-radius:99px;background:var(--panel-2);margin:8px 0 6px;overflow:hidden}"
      + ".cu-day .bar u{position:absolute;top:0;height:100%;background:var(--neg)}"
      + ".cu-day .bar{position:relative}"
      + ".cu-day .bar i{display:block;height:100%;border-radius:99px;background:var(--pos)}"
      + ".cu-day.tight .bar i{background:var(--warn)} .cu-day.short .bar i{background:var(--neg)}"
      + ".cu-day .fig.neg{color:var(--neg);font-weight:750}"
      + ".cu-day .fig.warn{color:var(--warn);font-weight:750}"
      + ".cu-day .fig{font-variant-numeric:tabular-nums;font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums}"
      + ".cu-day .fig b{color:var(--ink);font-weight:700}"
      + ".cu-day.today{background:linear-gradient(0deg,var(--panel-2),var(--panel))}"
      + ".cu-day.today .dow{color:var(--blue)}"
      + ".cu-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:14px}"
      + ".cu-hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}"
      + ".cu-hd b{font-size:16px;letter-spacing:-.25px}"
      + ".cu-pill{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "padding:2px 8px;border-radius:999px;background:var(--panel-2);color:var(--faint)}"
      + ".cu-pill.ok{background:var(--pos-bg);color:var(--pos)}"
      + ".cu-pill.tight{background:var(--warn-bg);color:var(--warn)}"
      + ".cu-pill.k-chain{background:var(--blue-bg);color:var(--blue)}"
      + ".cu-pill.k-move{background:var(--warn-bg);color:var(--warn)}"
      + ".cu-pill.k-free{background:var(--pos-bg);color:var(--pos)}"
      + ".cu-pill.k-rec{background:var(--pos-bg);color:var(--pos)}"
      + ".cu-otitle .cu-pill{margin-right:7px}"
      + ".cu-pill.short{background:var(--neg-bg);color:var(--neg)}"
      /* the sentence a dispatcher actually needs */
      + ".cu-verdict{font-size:14px;line-height:1.6;color:var(--ink);margin-bottom:12px}"
      + ".cu-verdict b{font-variant-numeric:tabular-nums}"
      + ".cu-off{font-size:12.5px;color:var(--faint);margin-bottom:12px}"
      + ".cu-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:10px}"
      + ".cu-empty{color:var(--faint);font-size:13.5px;padding:16px 0}"
      + ".cu-opt{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line-2)}"
      + ".cu-opt:first-child{border-top:0}"
      + ".cu-opt.done{opacity:.5}"
      + ".cu-obody{flex:1;min-width:0}"
      + ".cu-otitle{font-size:13.5px;font-weight:700;letter-spacing:-.1px}"
      + ".cu-owhy{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:2px}"
      + ".cu-oact{display:flex;gap:6px;flex:0 0 auto}"
      + ".cu-btn{font:inherit;font-size:12px;font-weight:750;color:var(--ink);background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:9px;padding:6px 12px;cursor:pointer;white-space:nowrap}"
      + ".cu-btn:hover{border-color:var(--blue)} .cu-btn:disabled{opacity:.5;cursor:default}"
      + ".cu-btn.pri{background:var(--brand);color:var(--brand-ink);border:1px solid transparent}"
      /* a view toggle must not look like the button that records a permanent decision */
      + ".cu-btn.sel{background:var(--blue-bg);border-color:var(--blue);color:var(--blue)}"
      + ".cu-btn.danger:hover{border-color:var(--neg);color:var(--neg)}"
      + ".cu-wrap :focus-visible{outline:2px solid var(--blue);outline-offset:2px}"
      + ".cu-msg{font-size:12.5px;font-weight:650;min-height:17px;margin-top:8px}"
      /* THE CHAINS ALREADY COUNTED -- history, not an offer, so it is quiet and green */
      + ".cu-led{margin-top:12px;border:1px solid var(--line-2);border-radius:var(--r-ctl);"
      + "background:var(--pos-bg);padding:10px 12px}"
      + ".cu-led.flat{background:transparent}"
      + ".cu-ledhd b{font-size:var(--t4);letter-spacing:-.1px}"
      + ".cu-ledhd span{display:block;font-size:var(--t5);color:var(--faint);line-height:1.5;"
      + "margin-top:2px}"
      + ".cu-lrow{display:flex;align-items:center;gap:9px;padding:6px 0;font-size:var(--t4);"
      + "border-top:1px solid var(--line-2);margin-top:6px;flex-wrap:wrap}"
      + ".cu-lrow b{font-weight:700}"
      + ".cu-lrow i,.cu-lrow em,.cu-lrow u{font-style:normal;text-decoration:none;"
      + "color:var(--faint);font-size:var(--t5)}"
      + ".cu-lrow em{font-variant-numeric:tabular-nums}"
      + ".cu-lrow u{margin-left:auto;font-variant-numeric:tabular-nums}"
      + ".cu-lrow.late u{color:var(--neg);font-weight:750}"
      + ".cu-lwarn{font-size:var(--t5);line-height:1.55;color:var(--ink);margin-top:8px;"
      + "padding-top:8px;border-top:1px solid var(--line-2)}"
      + ".cu-lnote{font-size:var(--t5);color:var(--faint);margin-top:8px;padding-top:8px;"
      + "border-top:1px solid var(--line-2)}"
      /* group headings inside the ladder */
      + ".cu-ghd{display:flex;align-items:baseline;gap:8px;margin:14px 0 2px;"
      + "padding-bottom:5px;border-bottom:1px solid var(--line-2)}"
      + ".cu-ghd:first-of-type{margin-top:6px}"
      + ".cu-ghd b{font-size:var(--t6);font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".cu-ghd span{font-size:var(--t5);color:var(--faint)}"
      /* DAY NAV */
      + ".cu-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px}"
      + ".cu-nav .cu-btn{padding:5px 11px}"
      /* FILTERS */
      + ".cu-fil{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px}"
      + ".cu-fil .lab{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin-right:2px}"
      + ".cu-chip{font:inherit;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;"
      + "background:var(--panel-2);border:1px solid var(--line-2);color:var(--faint);cursor:pointer}"
      + ".cu-chip.on{background:var(--ink);border-color:var(--ink);color:var(--panel)}"
      /* THE DAY'S WORK: a route is one crew's row on a clock, grouped by its depot */
      + ".cu-split{display:flex;gap:16px;align-items:flex-start}"
      + ".cu-tlwrap{flex:1;min-width:0}"
      + ".cu-tl{margin-top:4px}"
      + ".cu-tlax{position:relative;height:15px;margin-left:calc(var(--cu-lab) + 7px);border-bottom:1px solid var(--line)}"
      + ".cu-tlax span{position:absolute;top:0;font-size:9.5px;color:var(--faint);"
      + "transform:translateX(-50%);font-variant-numeric:tabular-nums}"
      + ".cu-tlax i{display:none}"
      + ".cu-base{margin-top:12px;position:relative;overflow:hidden}"
      + ".cu-bhd{display:flex;align-items:center;gap:7px;width:100%;font:inherit;font-size:10px;"
      + "font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);"
      + "background:transparent;border:0;border-bottom:1px solid var(--line-2);padding:0 0 4px;"
      + "margin-bottom:6px;cursor:pointer;text-align:left}"
      + ".cu-bhd:hover{color:var(--ink)}"
      + ".cu-bhd i{font-style:normal;font-size:11px;transition:transform .15s}"
      + ".cu-bhd.shut i{transform:rotate(-90deg)}"
      + ".cu-bhd em{font-style:normal;font-weight:650;letter-spacing:0;text-transform:none;"
      + "font-size:11px;margin-left:auto;font-variant-numeric:tabular-nums}"
      /* the ROW is the hit target, not just the bar */
      + ".cu-row{display:flex;align-items:center;min-height:38px;border-radius:9px;cursor:pointer;"
      + "border-left:3px solid transparent;padding-left:4px}"
      + ".cu-row:hover{background:var(--panel-2)}"
      + ".cu-row:focus-visible{outline:2px solid var(--blue);outline-offset:-2px}"
      + ".cu-row.on{background:var(--panel-2);border-left-color:var(--ink)}"
      + ".cu-rlab{flex:0 0 var(--cu-lab);font-size:11.5px;line-height:1.35;padding-right:12px}"
      + ".cu-rlab b{font-size:12px;font-variant-numeric:tabular-nums;letter-spacing:-.1px}"
      + ".cu-rlab b .ch{font-style:normal;color:var(--blue);font-size:10px}"
      + ".cu-rlab span{display:block;color:var(--faint);font-size:10.5px;overflow:hidden;"
      + "text-overflow:ellipsis;white-space:nowrap}"
      + ".cu-rlab em{display:block;font-style:normal;color:var(--faint);font-size:10px;"
      + "font-variant-numeric:tabular-nums;opacity:.75}"
      + ".cu-track{position:relative;flex:1;height:30px;border-left:1px solid var(--line-2);background-image:repeating-linear-gradient(to right,var(--line) 0 1px,transparent 1px var(--cu-step,100%))}"
      + ".cu-bar{position:absolute;top:5px;height:20px;border-radius:var(--r-bar);background:var(--job-local);"
      + "color:#fff;font-size:10.5px;font-weight:700;line-height:20px;padding:0 7px;overflow:hidden;"
      + "white-space:nowrap;text-overflow:ellipsis}"
      + ".cu-bar.long{background:var(--job-long)} .cu-bar.straight{background:var(--job-straight)}"
      + ".cu-bar.labor{background:var(--job-labor)}"
      /* the empty drive between two chained jobs -- the cost chaining trades away */
      + ".cu-gap{position:absolute;top:11px;height:8px;border-radius:4px;opacity:.9;"
      + "background:repeating-linear-gradient(115deg,var(--empty) 0 3px,transparent 3px 7px)}"
      + ".cu-gap.over{background:var(--neg);opacity:.45}"
      + ".cu-mleg i.hatch{background:repeating-linear-gradient(115deg,var(--empty) 0 3px,"
      + "transparent 3px 7px);height:5px}"
      /* THE RUN DRAWER */
      + ".cu-drw{flex:0 0 356px;position:sticky;top:12px;max-height:calc(100vh - 90px);"
      + "overflow:auto;background:var(--panel-2);border:1px solid var(--line);border-radius:13px;"
      + "padding:14px 15px}"
      + ".cu-dhd{display:flex;align-items:flex-start;gap:10px;margin-bottom:12px}"
      + ".cu-dhd b{display:block;font-size:14px;letter-spacing:-.2px}"
      + ".cu-dhd span{display:block;font-size:11.5px;color:var(--faint);margin-top:2px}"
      + ".cu-x{margin-left:auto;font:inherit;font-size:13px;line-height:1;color:var(--faint);"
      + "background:transparent;border:0;cursor:pointer;padding:2px 4px}"
      + ".cu-x:hover{color:var(--ink)}"
      + ".cu-vit{display:grid;grid-template-columns:repeat(3,1fr);gap:9px 6px;padding:11px 0;"
      + "border-top:1px solid var(--line-2);border-bottom:1px solid var(--line-2)}"
      + ".cu-vit b{display:block;font-size:12.5px;font-variant-numeric:tabular-nums;"
      + "letter-spacing:-.2px}"
      + ".cu-vit span{display:block;font-size:9.5px;font-weight:800;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:1px}"
      + ".cu-who{font-size:12px;font-weight:650;padding:10px 0 2px;line-height:1.45}"
      + ".cu-who em{display:block;font-style:normal;font-size:10.5px;color:var(--faint);"
      + "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin-top:2px}"
      /* the run, step by step */
      + ".cu-step{margin:10px 0 4px;border-left:2px solid var(--line-2);padding-left:13px}"
      + ".cu-step>div{display:flex;gap:9px;font-size:11.5px;line-height:1.5;padding:4px 0;"
      + "position:relative}"
      + ".cu-step>div::before{content:'';position:absolute;left:-17px;top:10px;width:7px;"
      + "height:7px;border-radius:50%;background:var(--line);"
      + "box-shadow:0 0 0 2px var(--panel-2)}"
      + ".cu-step>div.job::before{background:var(--job-local)} .cu-step>div.ld::before{background:var(--job-long)}"
      + ".cu-step>div.home::before{background:var(--ink)}"
      + ".cu-step>div.wait::before{background:var(--warn)}"
      + ".cu-step i{flex:0 0 40px;font-style:normal;font-variant-numeric:tabular-nums;"
      + "font-size:11px;font-weight:700;color:var(--faint)}"
      + ".cu-step .go span,.cu-step .wait span{color:var(--faint)}"
      + ".cu-step .wait span{font-weight:650}"
      + ".cu-vit .bad b{color:var(--neg)}"
      + ".cu-warn{font-size:11.5px;line-height:1.55;color:var(--ink);background:var(--warn-bg);"
      + "border-left:3px solid var(--warn);border-radius:0 8px 8px 0;padding:8px 10px;margin-top:11px}"
      + ".cu-dfoot{font-size:11px;color:var(--faint);line-height:1.55;margin-top:8px;"
      + "padding-top:9px;border-top:1px solid var(--line-2)}"
      + ".cu-dbtn{width:100%;margin-top:11px;padding:9px}"
      + "@media(max-width:1180px){.cu-split{flex-direction:column}"
      + ".cu-drw{flex:1 1 auto;width:100%;position:static;max-height:none}}"
      /* MAP */
      + ".cu-map{height:420px;border-radius:12px;overflow:hidden;border:1px solid var(--line);"
      + "background:var(--panel-2)}"
      + ".cu-mleg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--faint);margin-top:8px}"
      + ".cu-mleg i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:5px;"
      + "vertical-align:2px}"
      + "</style><div class='cu-wrap'><div id='cuBody'><div class='cu-empty'>Loading the horizon…</div></div></div>";

    var gen = (window.__CUGEN = (window.__CUGEN || 0) + 1);

    function money(n) { return Number(n || 0).toLocaleString(); }
    function fmtDay(iso) {
      var d = new Date(String(iso).slice(0, 10) + "T12:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    var TODAY = new Date().toISOString().slice(0, 10);

    // ---- filters -------------------------------------------------------------------
    function filters(jobs) {
      var bases = [], cos = [];
      jobs.forEach(function (j) {
        if (j.Base && bases.indexOf(j.Base) < 0) bases.push(j.Base);
        if (j.Company && cos.indexOf(j.Company) < 0) cos.push(j.Company);
      });
      bases.sort(); cos.sort();
      if (bases.length < 2 && cos.length < 2) return "";
      function chips(list, cur, attr) {
        return list.map(function (v) {
          return "<button class='cu-chip" + (cur === v ? " on" : "") + "' " + attr + "='"
            + esc(v) + "'>" + esc(v) + "</button>";
        }).join("");
      }
      return "<div class='cu-fil'>"
        + (bases.length > 1 ? "<span class='lab'>Base</span>"
            + "<button class='cu-chip" + (S.baseF ? "" : " on") + "' data-base=''>All</button>"
            + chips(bases, S.baseF, "data-base") : "")
        + (cos.length > 1 ? "<span class='lab' style='margin-left:10px'>Company</span>"
            + "<button class='cu-chip" + (S.coF ? "" : " on") + "' data-co=''>All</button>"
            + chips(cos, S.coF, "data-co") : "")
        + "</div>";
    }

    // ---- the day's work: one row per crew, grouped by depot -------------------------
    // The clock is derived from the day, not fixed at 7-21. A 6am load and a 9pm finish are
    // both real, and clamping either one to the edge tells the dispatcher the opposite of
    // what happened.
    var AX = { a: 7, b: 21 };
    function hrOf(hhmm) {
      var p = String(hhmm || "").split(":");
      return (+p[0] || 0) + (+p[1] || 0) / 60;
    }
    function setAxis(jobs) {
      var lo = 24, hi = 0;
      jobs.forEach(function (j) {
        var st = hrOf(j.Start);
        if (!isFinite(st)) return;
        lo = Math.min(lo, st);
        hi = Math.max(hi, st + (+j.Hours || 2));
      });
      if (lo > hi) { AX = { a: 7, b: 21 }; return; }
      AX = { a: Math.max(0, Math.floor(lo) - 1), b: Math.min(24, Math.max(Math.ceil(hi) + 1, 19)) };
    }
    function pos(hhmm) {
      return Math.max(0, Math.min(100, (hrOf(hhmm) - AX.a) / (AX.b - AX.a) * 100));
    }
    function clock(h) {
      var hh = Math.floor(h), mm = Math.round((h - hh) * 60);
      if (mm === 60) { hh += 1; mm = 0; }
      // a run that spills past midnight says so rather than printing 32:24
      var nd = hh >= 24 ? " +1" : "";
      hh = hh % 24;
      return (hh < 10 ? "0" : "") + hh + ":" + (mm < 10 ? "0" : "") + mm + nd;
    }
    function barClass(j) {
      var mt = String(j["Moving Type"] || "").toLowerCase();
      var jt = String(j["Job Type"] || "").toLowerCase();
      if (jt.indexOf("labor") >= 0) return "labor";
      if (jt.indexOf("straight") >= 0) return "straight";
      if (mt.indexOf("long") >= 0) return "long";
      return "";
    }

    // Distances from the coordinates the mart ships with every job, so the whole drawer --
    // drive times, arrival windows, the run home -- costs nothing. Road geometry is metered
    // and is only ever bought when someone clicks for it.
    var MPH = 35, ROAD = 1.15;
    function hav(a, b) {
      if (!a || !b || a.lat == null || b.lat == null) return null;
      var R = 3958.8, t = Math.PI / 180;
      var dLa = (b.lat - a.lat) * t, dLo = (b.lon - a.lon) * t;
      var x = Math.sin(dLa / 2) * Math.sin(dLa / 2)
            + Math.cos(a.lat * t) * Math.cos(b.lat * t) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
      return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
    }
    function drive(a, b) {
      var mi = hav(a, b);
      if (mi == null) return null;
      mi = mi * ROAD;
      return { mi: mi, min: Math.round(mi / MPH * 60) + 4 };
    }
    function pt(j, side) {
      var la = j[side + " Lat"], lo = j[side + " Lon"];
      return (la == null || lo == null) ? null
        : { lat: +la, lon: +lo, city: j[side + " City"], zip: j[side + " Zip"] };
    }
    function basePt(j) {
      return (j["Base Lat"] == null) ? null
        : { lat: +j["Base Lat"], lon: +j["Base Lon"], city: j.Base + " base", zip: j["Base Zip"] };
    }
    function fmtMin(m) {
      if (m == null) return "—";
      var h = Math.floor(m / 60), r = Math.round(m % 60);
      return h ? (h + "h" + (r ? " " + r + "m" : "")) : (r + " min");
    }

    function routesOf(jobs) {
      var byRoute = {};
      jobs.forEach(function (j) {
        var k = j.Route || ("solo:" + j["Job Code"]);
        (byRoute[k] = byRoute[k] || []).push(j);
      });
      return Object.keys(byRoute).map(function (k) {
        return { id: k, legs: byRoute[k].sort(function (a, b) {
          return String(a.Start).localeCompare(String(b.Start)); }) };
      });
    }

    function timeline(jobs) {
      setAxis(jobs);
      var byBase = {};
      routesOf(jobs).forEach(function (r) {
        var b = r.legs[0].Base || "—";
        (byBase[b] = byBase[b] || []).push(r);
      });

      var axis = "<div class='cu-tlax'>";
      var step = (AX.b - AX.a) > 12 ? 2 : 1;
      for (var h = Math.ceil(AX.a); h <= AX.b; h += step) {
        var left = (h - AX.a) / (AX.b - AX.a) * 100;
        axis += "<i style='left:" + left + "%'></i>"
          + "<span style='left:" + left + "%'>" + h + ":00</span>";
      }
      axis += "</div>";

      // the hour pitch drives the track's gridlines, so they can never fall out of register
      // with the axis above them -- both are derived from the same number
      var pitch = step / (AX.b - AX.a) * 100;
      return "<div class='cu-tl' style='--cu-step:" + pitch + "%'>" + axis
        + Object.keys(byBase).sort().map(function (b) {
        var rs = byBase[b].sort(function (x, y) {
          return String(x.legs[0].Start).localeCompare(String(y.legs[0].Start)); });
        var shut = !!S.shut[b];
        var cf = rs.reduce(function (a, r) {
          return a + r.legs.reduce(function (n, j) { return n + (+j.CF || 0); }, 0); }, 0);
        var chains = rs.filter(function (r) { return r.legs.length > 1; }).length;
        return "<div class='cu-base'>"
          + "<button class='cu-bhd" + (shut ? " shut" : "") + "' data-base-grp='" + esc(b) + "'>"
          + "<i>▾</i>" + esc(b) + " base<em>" + rs.length + " crew"
          + (rs.length === 1 ? "" : "s") + (chains ? " · " + chains + " chained" : "")
          + " · " + money(cf) + " CF</em></button>"
          + (shut ? "" : rs.map(function (r) {
              var rcf = r.legs.reduce(function (a, j) { return a + (+j.CF || 0); }, 0);
              var first = r.legs[0], last = r.legs[r.legs.length - 1];
              var who = first.Foreman || "";
              var endH = hrOf(last.Start) + (+last.Hours || 2);
              var sub = r.legs.length > 1
                ? (r.legs.length + " jobs · " + esc(first["Pickup City"] || "") + " → "
                   + esc(last["Delivery City"] || ""))
                : (esc(first["Pickup City"] || "") + " → " + esc(last["Delivery City"] || ""));
              return "<div class='cu-row" + (S.openRun === r.id ? " on" : "") + "' "
                + "data-run='" + esc(r.id) + "' tabindex='0'>"
                + "<div class='cu-rlab'>"
                + "<b>" + esc(r.id) + (r.legs.length > 1 ? " <i class='ch'>⛓</i>" : "")
                + (who ? " " + esc(who) : "") + "</b>"
                + "<span>" + sub + "</span>"
                + "<em>" + clock(hrOf(first.Start)) + "–" + clock(endH) + " · "
                + money(rcf) + " CF</em></div>"
                + "<div class='cu-track'>"
                + r.legs.map(function (j, i) {
                    var l = pos(j.Start);
                    var hrs = +j.Hours || 2;
                    var w = Math.max(2.5, (hrs / (AX.b - AX.a)) * 100);
                    var wide = w > 14, mid = w > 9;
                    // the empty drive to the next job is the thing chaining trades away, so
                    // it is drawn rather than left as a gap
                    var nx = r.legs[i + 1], gap = "";
                    if (nx) {
                      var gl = pos(clock(hrOf(j.Start) + hrs)), gr = pos(nx.Start);
                      var dr = drive(pt(j, "Delivery"), pt(nx, "Pickup"));
                      if (gr > gl + 0.4) {
                        gap = "<span class='cu-gap' style='left:" + gl + "%;width:"
                          + (gr - gl) + "%'" + (dr ? " title='empty drive · " + fmtMin(dr.min)
                          + " · " + Math.round(dr.mi) + " mi'" : "") + "></span>";
                      } else if (gl > gr + 0.4) {
                        // the anchor is still working when the next job is booked to start --
                        // this is the chain that needs re-timing, and it used to draw nothing
                        gap = "<span class='cu-gap over' style='left:" + gr + "%;width:"
                          + (gl - gr) + "%' title='overlaps — the second job cannot start "
                          + "at its booked time'></span>";
                      }
                    }
                    return gap + "<span class='cu-bar " + barClass(j)
                      + "' style='left:" + l + "%;width:" + Math.min(w, 100 - l) + "%' title='"
                      + esc(r.id + " · " + (j["Job Code"] || "") + " · "
                            + (j["Pickup City"] || "") + " → " + (j["Delivery City"] || "")
                            + " · " + clock(hrOf(j.Start)) + "–" + clock(hrOf(j.Start) + hrs)
                            + " · " + money(j.CF) + " CF") + "'>"
                      + (wide && r.legs.length > 1 ? (i + 1) + "/" + r.legs.length + " · " : "")
                      + (wide ? esc((j["Pickup City"] || "") + " → " + (j["Delivery City"] || ""))
                          + " · " : "")
                      + (mid ? money(j.CF) + " CF" : "") + "</span>";
                  }).join("")
                + "</div></div>";
            }).join(""))
          + "</div>";
      }).join("") + "</div>";
    }

    // ---- the run drawer: a crew's whole day, worked out from arithmetic ---------------
    function runDrawer(jobs) {
      if (!S.openRun) return "";
      var r = routesOf(jobs).filter(function (x) { return x.id === S.openRun; })[0];
      if (!r) return "";
      var legs = r.legs, first = legs[0], last = legs[legs.length - 1];
      var bp = basePt(first);
      var cf = legs.reduce(function (a, j) { return a + (+j.CF || 0); }, 0);
      var act = legs.reduce(function (a, j) { return a + (+j.Hours || 0); }, 0);
      var isLD = legs.some(function (j) {
        return String(j["Moving Type"] || "").toLowerCase().indexOf("long") >= 0; });

      // the run, step by step. The clock is max(arrive, booked) -- a crew that gets there
      // early waits, work never starts before the customer's time.
      var rows = [], totMin = 0, totMi = 0, empMin = 0, empMi = 0, cur = null;
      var retime = false;
      function travel(from, to, label, empty) {
        var d = drive(from, to);
        if (!d) return;
        totMin += d.min; totMi += d.mi;
        if (empty) { empMin += d.min; empMi += d.mi; }
        var eta = cur == null ? null : cur + d.min / 60;
        rows.push({ cls: "go", t: eta == null ? "" : clock(eta),
                    txt: label + " · " + fmtMin(d.min) + " · " + Math.round(d.mi) + " mi" });
        if (eta != null) cur = eta;
      }
      legs.forEach(function (j, i) {
        var booked = hrOf(j.Start), hrs = +j.Hours || 2;
        var pu = pt(j, "Pickup"), de = pt(j, "Delivery");
        if (i === 0) {
          if (bp && pu) {
            var d0 = drive(bp, pu);
            if (d0) {
              totMin += d0.min; totMi += d0.mi; empMin += d0.min; empMi += d0.mi;
              rows.push({ cls: "go", t: clock(booked - d0.min / 60),
                          txt: "Leave " + esc(first.Base || "") + " base · " + fmtMin(d0.min)
                               + " · " + Math.round(d0.mi) + " mi" });
            }
          }
        } else {
          travel(pt(legs[i - 1], "Delivery"), pu, "Empty drive to job " + (i + 1), true);
          if (cur != null && cur < booked) {
            rows.push({ cls: "wait", t: clock(cur),
                        txt: "Waits " + fmtMin(Math.round((booked - cur) * 60))
                             + " — booked for " + clock(booked) });
          } else if (cur != null && booked <= cur) {
            retime = true;
            rows.push({ cls: "wait", t: "",
                        txt: "Booked " + clock(booked) + " as well — this job has to be "
                             + "re-timed to run after job " + i });
          }
        }
        cur = Math.max(cur == null ? booked : cur, booked);
        rows.push({ cls: "job", t: clock(cur),
                    txt: "<b>Job " + (i + 1) + "</b> · " + esc(j["Job Code"] || "")
                         + " · " + esc(j.Customer || "") + " — load "
                         + esc(j["Pickup City"] || "") + ", " + fmtMin(Math.round(hrs * 60))
                         + " of work" + (+j.Crew ? " · crew of " + j.Crew : "") });
        var dl = drive(pu, de);
        if (dl && Math.round(dl.mi) > 0) {
          totMin += dl.min; totMi += dl.mi;
          rows.push({ cls: "go", t: "",
                      txt: "Loaded to " + esc(j["Delivery City"] || "") + " · "
                           + fmtMin(dl.min) + " · " + Math.round(dl.mi) + " mi" });
        }
        cur += hrs;
        var far = String(j["Moving Type"] || "").toLowerCase().indexOf("long") >= 0;
        rows.push({ cls: far ? "ld" : "drop", t: clock(cur),
                    txt: far
                      ? "Departs long distance → " + esc((j["Delivery City"] || "") + ", "
                          + (j["Delivery State"] || "")) + " — no same-day return"
                      : "Delivers " + esc(j["Delivery City"] || "") + " · done "
                          + money(j.CF) + " CF" });
        if (far) cur = null;
      });
      if (cur != null && bp) {
        var dh = drive(pt(last, "Delivery"), bp);
        if (dh) {
          totMin += dh.min; totMi += dh.mi; empMin += dh.min; empMi += dh.mi;
          rows.push({ cls: "home", t: clock(cur + dh.min / 60),
                      txt: "Back at " + esc(last.Base || "") + " base · " + fmtMin(dh.min)
                           + " · " + Math.round(dh.mi) + " mi" });
        }
      }

      function cell(v, l) { return "<div><b>" + v + "</b><span>" + l + "</span></div>"; }
      var endH = hrOf(last.Start) + (+last.Hours || 2);
      var home = rows.filter(function (x) { return x.cls === "home"; })[0];
      var HOME_BY = 22;                        // the engine's own limit, CLEAN.maxHomeHr
      // judged on when the crew is actually back, not when the last box is off the truck
      var homeH = null;
      if (cur != null && bp) {
        var dhx = drive(pt(last, "Delivery"), bp);
        homeH = dhx ? cur + dhx.min / 60 : cur;
      }
      var overrun = homeH != null && homeH > HOME_BY;
      var warn = "";
      if (retime || overrun) {
        warn = "<div class='cu-warn'>"
          + (retime
             ? "<b>Both jobs are booked at the same hour.</b> The board has put them on one "
               + "crew, which only works if the second customer accepts a later arrival — that "
               + "is the call in the plan above. "
             : "")
          + (overrun
             ? "Run as sequenced, this crew is not home until <b>" + clock(homeH)
               + "</b>, past the " + HOME_BY + ":00 limit."
             : "")
          + "</div>";
      }

      return "<aside class='cu-drw' id='cuDrw'>"
        + "<div class='cu-dhd'><div><b>" + esc(r.id)
        + (first.Foreman ? " · " + esc(first.Foreman) : "") + "</b>"
        + "<span>" + esc(first.Base || "") + " base · " + legs.length + " job"
        + (legs.length === 1 ? "" : "s") + " · the whole run for this day</span></div>"
        + "<button class='cu-x' id='cuDrwX' title='Close'>✕</button></div>"
        + "<div class='cu-vit'>"
        + cell(clock(hrOf(first.Start)) + "–" + clock(endH), "booked")
        + cell(money(cf) + " CF", "volume")
        + cell(String(legs.length), legs.length === 1 ? "job" : "jobs")
        + (act ? cell(fmtMin(Math.round(act * 60)), "work") : "")
        + (home ? "<div" + (overrun ? " class='bad'" : "") + "><b>~" + home.t
            + "</b><span>back at base</span></div>"
           : (isLD ? cell("—", "stays out") : ""))
        + (empMin ? cell(fmtMin(empMin) + " · " + Math.round(empMi) + " mi", "empty driving") : "")
        + "</div>"
        + "<div class='cu-who'>" + legs.map(function (j) {
            return esc(j.Customer || j["Job Code"]); }).join(" + ")
        + "<em>" + legs.map(function (j) { return esc(j["Job Code"] || ""); }).join(" · ")
        + "</em></div>"
        + warn
        + "<div class='cu-step'>" + rows.map(function (x) {
            return "<div class='" + x.cls + "'><i>" + x.t + "</i><span>" + x.txt + "</span></div>";
          }).join("") + "</div>"
        + "<div class='cu-dfoot'>Day driving <b>" + fmtMin(totMin) + "</b> · "
        + Math.round(totMi) + " mi, of which <b>" + fmtMin(empMin) + "</b> is empty. "
        + "Times are estimated from straight-line distance at " + MPH + " mph; work never "
        + "starts before the booked time.</div>"
        + "<button class='cu-btn sel cu-dbtn' id='cuDrwMap'>"
        + (S.mapOn ? "Map is open below" : "Analyze this run on the map") + "</button>"
        + "</aside>";
    }

    // ---- the map: real road routes, via the same HERE service the LD board uses -----
    function ensureLeaflet(cb) {
      if (window.L && window.L.map) { cb(); return; }
      if (!document.getElementById("ldLeafCss")) {
        var lc = document.createElement("link");
        lc.id = "ldLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
        document.head.appendChild(lc);
      }
      var sc = document.getElementById("ldLeafJs");
      if (sc) { sc.addEventListener("load", function () { cb(); }); return; }
      sc = document.createElement("script");
      sc.id = "ldLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js";
      sc.onload = function () { cb(); };
      document.head.appendChild(sc);
    }

    // read the live token so a polyline, its legend swatch and the bar it belongs to can
    // never drift apart, and so both themes are handled in one place
    function tok(name) {
      return getComputedStyle(document.body).getPropertyValue(name).trim() || "#888";
    }

    function drawMap(jobs) {
      var box = document.getElementById("cuMap");
      if (!box || !jobs.length) return;
      // Every leg we want drawn: the loaded run of each job, plus the EMPTY drive between
      // two jobs a crew runs back to back -- that empty leg is the cost chaining is trading
      // away, so it is the one a dispatcher most needs to see.
      var byRoute = {};
      jobs.forEach(function (j) {
        var k = j.Route || ("solo:" + j["Job Code"]);
        (byRoute[k] = byRoute[k] || []).push(j);
      });
      var legs = [];
      Object.keys(byRoute).forEach(function (k) {
        if (S.focus && S.focus !== k) return;
        var r = byRoute[k].sort(function (a, b) {
          return String(a.Start).localeCompare(String(b.Start)); });
        r.forEach(function (j, i) {
          if (j["Pickup Zip"] && j["Delivery Zip"])
            legs.push({ a: j["Pickup Zip"], b: j["Delivery Zip"], kind: barClass(j) || "loaded",
                        route: k, label: (j.Customer || j["Job Code"]) });
          var nx = r[i + 1];
          if (nx && j["Delivery Zip"] && nx["Pickup Zip"])
            legs.push({ a: j["Delivery Zip"], b: nx["Pickup Zip"], kind: "empty", route: k,
                        label: "empty drive" });
        });
      });
      if (!legs.length) { box.innerHTML = "<div style='padding:18px;color:var(--faint)'>"
        + "No mappable stops on this day.</div>"; return; }

      // the geometry service joins a leg's two zips with ":" and takes at most 16 per call,
      // so a busy day is fetched in batches and stitched back in order
      var pairs = legs.map(function (l) { return l.a + ":" + l.b; });
      var hdr = { headers: { Authorization: "Bearer " + ZTZ.getToken() } };
      var gen = window.__CUGEN;

      // A leg is a zip pair and nothing else, so once the road between two zips is known it
      // is known for the rest of the session — focusing one run, coming back to the day, or
      // switching a base filter must never buy the same road twice.
      var CACHE = (window.__CUGEO = window.__CUGEO || {});

      function fetchAll(est) {
        var out = new Array(pairs.length);
        var want = [];                     // indexes we still have to pay for
        pairs.forEach(function (p, i) {
          if (CACHE[p]) out[i] = CACHE[p]; else want.push(i);
        });
        var i = 0;
        function next() {
          if (i >= want.length) {
            return Promise.resolve({ legs: out.map(function (l) { return l || {}; }) });
          }
          var idx = want.slice(i, i + 16);
          i += 16;
          return fetch(ZTZ.API + "/api/_ldgeo?" + (est ? "est=1&" : "") + "legs="
                       + encodeURIComponent(idx.map(function (k) { return pairs[k]; }).join(",")), hdr)
            .then(function (r) { return r.json(); })
            .then(function (j) {
              ((j && j.legs) || []).forEach(function (lg, n) {
                var k = idx[n];
                if (k === undefined) return;
                out[k] = lg;
                // only the real road is worth keeping; a straight-line estimate is a
                // placeholder that the refine pass is about to replace
                if (lg && lg.source === "here") CACHE[pairs[k]] = lg;
              });
              return next();
            });
        }
        return next();
      }

      function render(j) {
        if (window.__CUGEN !== gen) return false;
        var got = (j && j.legs) || [];
        ensureLeaflet(function () {
          var m = box._m;
          if (!m) {
            m = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.5 });
            var light = document.body.classList.contains("light");
            L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/"
              + (light ? "voyager" : "dark_all") + "/{z}/{x}/{y}{r}.png",
              { maxZoom: 18, subdomains: "abcd",
                attribution: "© OpenStreetMap · © CARTO" }).addTo(m);
            box._m = m; box._lay = [];
          }
          (box._lay || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
          box._lay = [];
          // The frame follows the LOCAL work. One job to Florida would otherwise zoom the
          // whole day out to the eastern seaboard and turn the crews' actual morning into a
          // smudge, so long runs are drawn in full but do not get a vote on the bounds --
          // click their bar to follow one out.
          var bounds = [], far = 0;
          got.forEach(function (g, i) {
            var c = g.coords || [];
            if (c.length < 2) return;
            var meta = legs[i] || {};
            var empty = meta.kind === "empty";
            var col = empty ? tok("--empty") : (meta.kind === "long" ? tok("--job-long")
                      : meta.kind === "straight" ? tok("--job-straight") : tok("--job-local"));
            var pl = L.polyline(c, empty
              ? { color: col, weight: 2.5, dashArray: "6 7", opacity: 0.9 }
              : { color: col, weight: 4, opacity: 0.85 }).addTo(m);
            pl.bindTooltip((meta.label || "") + (g.miles ? " · " + g.miles + " mi" : "")
                           + (empty ? " (empty)" : ""), { sticky: true });
            box._lay.push(pl);
            if (meta.kind === "long" || meta.kind === "straight") far++;
            else c.forEach(function (p) { bounds.push(p); });
            if (!empty) {
              var mk = L.circleMarker(c[0], { radius: 4, color: col, fillColor: tok("--panel"),
                                              fillOpacity: 1, weight: 2 }).addTo(m);
              box._lay.push(mk);
            }
          });
          if (!bounds.length) {   // a day of nothing but long runs still has to show them
            got.forEach(function (g) { (g.coords || []).forEach(function (p) { bounds.push(p); }); });
          }
          if (bounds.length) m.fitBounds(bounds, { padding: [24, 24] });
          var fn = document.getElementById("cuFar");
          if (fn) fn.textContent = far
            ? (far + " long-distance " + (far === 1 ? "run runs" : "runs run")
               + " off the frame — click the bar to follow one.") : "";
          // Leaflet measures the container at creation; it was hidden until now
          setTimeout(function () { try { m.invalidateSize(); } catch (e) {} }, 60);
        });
        return got.length > 0;
      }

      // straight lines first so something is on screen immediately, then the real roads
      fetchAll(true)
        .then(function (j) {
          render(j);
          var need = (j.legs || []).some(function (l) { return l.source !== "here"; });
          if (need && window.__CUGEN === gen) fetchAll(false).then(render).catch(function () {});
        })
        .catch(function () {
          if (window.__CUGEN === gen && box)
            box.innerHTML = "<div style='padding:18px;color:var(--faint)'>Map unavailable.</div>";
        });
    }

    function paint() {
      // the page may have been swapped out while the tables were loading
      if (window.__CUGEN !== gen) return;
      var body = document.getElementById("cuBody");
      if (!body) return;

      var days = (S.days || []).slice().sort(function (a, b) {
        return String(a.Day).localeCompare(String(b.Day)); });
      if (!days.length) {
        body.innerHTML = "<div class='cu-empty'>No days in the horizon yet — the pipeline "
          + "builds this on its next run.</div>";
        return;
      }
      // NOT `shown` -- the day detail below declares its own `shown` for the job slice, and
      // one hoisted `var` for both would have the day nav walking a list of jobs
      var dayList = S.probOnly
        ? days.filter(function (d) { return d.Status !== "ok" || +d["Near Full"]; })
        : days;
      if (!S.sel || !days.some(function (d) { return String(d.Day).slice(0, 10) === S.sel; })) {
        // open on the first day that needs attention, else today, else the first day
        var prob = days.filter(function (d) { return d.Status !== "ok"; })[0];
        var tod = days.filter(function (d) { return String(d.Day).slice(0, 10) >= TODAY; })[0];
        S.sel = String((prob || tod || days[0]).Day).slice(0, 10);
      }

      var nProb = days.filter(function (d) { return d.Status !== "ok"; }).length;
      var nNear = days.filter(function (d) { return d.Status === "ok" && +d["Near Full"]; }).length;
      var tightest = days.slice().sort(function (a, b) { return (+a.Spare) - (+b.Spare); })[0];
      var totJobs = days.reduce(function (a, d) { return a + (+d.Jobs || 0); }, 0);
      var totChain = days.reduce(function (a, d) { return a + (+d["Chains Applied"] || 0); }, 0);

      var kpis = "<div class='cu-kpis'>"
        + "<div class='cu-kpi " + (nProb ? "bad" : "good") + "'><b>" + nProb + "</b>"
        + "<span>Days short of crews</span><small>fewer crews than routes</small></div>"
        + "<div class='cu-kpi " + (nNear ? "warn" : "") + "'><b>" + nNear + "</b>"
        + "<span>Days with no buffer</span><small>staffed, but nothing spare</small></div>"
        + "<div class='cu-kpi" + (tightest && +tightest.Spare < 0 ? " bad"
            : (tightest && +tightest.Spare === 0 ? " warn" : "")) + "'><b>"
        + (tightest ? ((+tightest.Spare > 0 ? "+" : "") + tightest.Spare) : "—") + "</b>"
        + "<span>Tightest day</span><small>" + (tightest ? fmtDay(tightest.Day) : "") + " · spare crews</small></div>"
        + "<div class='cu-kpi'><b>" + money(totJobs) + "</b>"
        + "<span>Jobs in horizon</span><small>" + days.length + " days</small></div>"
        + "<div class='cu-kpi'><b>" + totChain + "</b>"
        + "<span>Chains already counted</span><small>jobs the board put on one crew</small></div>"
        + "</div>";

      var strip = "<div class='cu-strip'>" + dayList.map(function (d) {
        var iso = String(d.Day).slice(0, 10);
        var av = +d["Crews Available"] || 0, rt = +d.Routes || 0;
        // scale to whichever is larger, so a day needing 12 of 9 crews reads as OVER full
        // rather than identical to a day that fits exactly
        var span = Math.max(av, rt) || 1;
        var pct = Math.round(Math.min(av, rt) / span * 100);
        var over = rt > av ? Math.round((rt - av) / span * 100) : 0;
        return "<button class='cu-day " + esc(d.Status)
          + (iso === S.sel ? " on" : "") + (iso === TODAY ? " today" : "")
          + "' data-day='" + esc(iso) + "'>"
          + "<div class='dow'>" + esc(d.Weekday) + (iso === TODAY ? " · today" : "") + "</div>"
          + "<div class='dat'>" + fmtDay(iso) + "</div>"
          + "<div class='bar'><i style='width:" + pct + "%'></i>"
          + (over ? "<u style='left:" + pct + "%;width:" + over + "%'></u>" : "") + "</div>"
          + "<div class='fig'><b>" + rt + "</b>/" + av + " crews</div>"
          + "<div class='fig " + (+d.Spare < 0 ? "neg" : (+d.Spare === 0 ? "warn" : ""))
          + "'>" + (+d.Spare > 0 ? "+" : "") + d.Spare + " spare</div>"
          + "</button>";
      }).join("") + "</div>";

      var d = days.filter(function (x) { return String(x.Day).slice(0, 10) === S.sel; })[0];
      var detail = "";
      if (d) {
        var av = +d["Crews Available"], rt = +d.Routes, sp = +d.Spare, tg = +d.Target;
        var verdict = rt > av
          ? "This day needs <b>" + rt + "</b> crews and only <b>" + av + "</b> are available — "
            + "<b>" + (rt - av) + "</b> short."
          : (sp <= (av - tg)
             ? "Staffed, but with <b>" + sp + "</b> spare there is no room for a callback or a same-day sale."
             : "Comfortable: <b>" + rt + "</b> crews needed of <b>" + av + "</b> available, "
               + "<b>" + sp + "</b> spare.");
        // Routes As Booked is the count before ANY chain was merged; Routes Before Chaining
        // is snapshotted after the automatic layer, so on its own it under-reports.
        var asBooked = +d["Routes As Booked"] || 0;
        var saved = asBooked ? asBooked - rt : (+d["Routes Before Chaining"] || rt) - rt;
        if (saved > 0) {
          verdict += " Chaining has already taken it from <b>" + (asBooked || (rt + saved))
            + "</b> crews to <b>" + rt + "</b>.";
        }
        var jobs = (S.jobs || []).filter(function (j) {
          return String(j.Day).slice(0, 10) === S.sel; })
          .sort(function (a, b) { return String(a.Start).localeCompare(String(b.Start)); });

        // filters narrow WHAT IS SHOWN, never what the day's verdict was computed from --
        // the crew count is a fact about the whole day, not about the slice you are looking at
        var shown = jobs.filter(function (j) {
          return (!S.baseF || j.Base === S.baseF) && (!S.coF || j.Company === S.coF);
        });

        // WHAT COULD BE DONE — the three-tier ladder, cheapest first. Shown even when the
        // day is comfortable, because a free chain is a crew freed for tomorrow's sale.
        var allOpts = (S.opts || []).filter(function (o) {
          return String(o.Day).slice(0, 10) === S.sel; });
        // TIER 1 is history, not an offer: these chains are already inside the crew count
        var freeCh = allOpts.filter(function (o) { return o.Kind === "chain"; })
          .sort(function (a, b) { return (+a.Rank) - (+b.Rank); });
        var opts = allOpts.filter(function (o) { return o.Kind !== "chain"; })
          .sort(function (a, b) {
            return (+b.Recommended - +a.Recommended) || ((+a.Rank) - (+b.Rank)); });
        var openOpts = opts.filter(function (o) { return o.Status === "open"; });
        // THE CHAINS ALREADY MADE. Past tense throughout, deliberately: the day's crew count
        // was computed after these were folded in, so calling them "frees a crew" would tell
        // a dispatcher a crew is available that has already been spent. And nothing has been
        // written to the calendar -- the two jobs still sit on two foremen there.
        var ledger = "";
        // The board found no free chain to add. That is worth saying out loud, because the
        // timeline still shows crews running two jobs -- those chains came from the calendar
        // (someone typed an After Job Code), not from the board, and a dispatcher looking at
        // a ⛓ row deserves to know which of the two it is.
        if (!freeCh.length) {
          var already = {};
          jobs.forEach(function (j) {
            if (+j["Route Legs"] > 1) already[j.Route] = 1; });
          var nAlready = Object.keys(already).length;
          if (nAlready) {
            ledger = "<div class='cu-led flat'><div class='cu-ledhd'><b>"
              + nAlready + " crew" + (nAlready === 1 ? "" : "s") + " already running two jobs"
              + "</b><span>booked that way in the calendar, not chained by the board. "
              + "The board found no further chain it could make for free — every job here is "
              + "booked for the morning, so a second job means asking someone to move to the "
              + "afternoon.</span></div></div>";
          }
        }
        if (freeCh.length) {
          var late = freeCh.filter(function (o) { return +o["Arrives Late"]; }).length;
          ledger = "<div class='cu-led'>"
            + "<div class='cu-ledhd'><b>" + freeCh.length + " chain"
            + (freeCh.length === 1 ? "" : "s") + " already counted</b>"
            + "<span>no call needed — an afternoon job riding along on a crew that is "
            + "already out. This is why the day needs " + rt + " crews and not "
            + ((+d["Routes As Booked"] || rt + freeCh.length)) + ".</span></div>"
            + freeCh.map(function (o) {
                var ar = o.Arrive ? String(o.Arrive) : null;
                return "<div class='cu-lrow" + (+o["Arrives Late"] ? " late" : "") + "'>"
                  + "<span class='cu-pill k-free'>"
                  + (o.Purpose === "auto" ? "same route" : "afternoon") + "</span>"
                  + "<b>" + esc(o.Customer || o["Job Code"]) + "</b>"
                  + "<i>after " + esc(o["After Customer"] || o["After Code"] || "—") + "</i>"
                  + "<em>" + (o["Link Minutes"] != null
                      ? o["Link Minutes"] + " min · " + (o["Link Miles"] != null
                          ? o["Link Miles"] + " mi" : "—")
                      : "—") + "</em>"
                  + (ar ? "<u>arrives " + esc(ar) + "</u>" : "")
                  + "</div>";
              }).join("")
            + (late ? "<div class='cu-lwarn'><b>" + late + " of these arrive more than half "
                + "an hour after the hour the customer booked</b>, and nobody has rung them. "
                + "The merge is an assumption in the plan — the calendar still shows two "
                + "separate crews.</div>"
               : "<div class='cu-lnote'>Counted, not yet arranged: the calendar still shows "
                 + "these as separate crews.</div>")
            + "</div>";
        }

        var optHtml = "";   // built here, rendered ABOVE the day's routes

        function optRow(o) {
          var done = o.Status !== "open";
          var isCall = o.Kind === "call";
          var title = isCall
            ? esc(o.Customer || o["Job Code"]) + " runs after "
              + esc(o["After Customer"] || o["After Code"])
            : esc(o.Customer || o["Job Code"]) + " moves to " + fmtDay(o["Move To"]);
          var why = isCall
            ? ("Ring them and ask to run in the afternoon behind "
               + esc(o["After Customer"] || o["After Code"] || "") + ". "
               + (o.Arrive ? "They would arrive about " + esc(o.Arrive) + ". " : "")
               + (o["Link Minutes"] != null ? "About " + o["Link Minutes"] + " min ("
                  + o["Link Miles"] + " mi) between the two. " : "")
               + (o.Discount ? "Costs a $" + o.Discount + " same-day discount." : ""))
            : ("Moving the date would free a crew here; "
               + fmtDay(o["Move To"]) + " has "
               + (o["Target Spare"] != null ? o["Target Spare"] : "?") + " spare. "
               + (o["Lands Behind"] ? "It would chain behind " + esc(o["Lands Behind"])
                  + " there, so it costs no crew on the day it moves to."
                  : "It would need its own crew on that day."));
          var btn = function (act, label, cls) {
            return "<button class='cu-btn" + (cls ? " " + cls : "") + "' data-dec='" + act
              + "' data-kind='" + esc(o.Kind) + "' data-code='" + esc(o["Job Code"])
              + "' data-cust='" + esc(o.Customer || "") + "' data-after='"
              + esc(o["After Code"] || "") + "' data-to='" + esc(o["Move To"] || "") + "'"
              + (S.busy ? " disabled" : "") + ">" + label + "</button>";
          };
          return "<div class='cu-opt" + (done ? " done" : "") + "'>"
            + "<div class='cu-obody'><div class='cu-otitle'>"
            + "<span class='cu-pill " + (isCall ? "k-chain" : "k-move") + "'>"
            + (isCall ? "call" : "move date") + "</span>" + title
            + (+o.Recommended ? " <span class='cu-pill k-rec'>recommended</span>" : "")
            + "</div><div class='cu-owhy'>" + why + "</div></div>"
            + "<div class='cu-oact'>"
            + (done
               ? "<span class='cu-pill " + (o.Status === "accepted" ? "ok" : "short") + "'>"
                 + esc(o.Status) + "</span>" + btn("reopened", "Reopen")
               : btn("accepted", "Accept", "pri") + btn("declined", "Decline", "danger"))
            + "</div></div>";
        }

        if (opts.length) {
          var group = function (kind, head, sub) {
            var list = opts.filter(function (o) { return o.Kind === kind; });
            if (!list.length) return "";
            return "<div class='cu-ghd'><b>" + head + "</b><span>" + sub + "</span></div>"
              + list.map(optRow).join("");
          };
          optHtml = "<div class='cu-card'><div class='cu-hd'>"
            + "<b>What would free another crew</b>"
            + "<span class='cu-pill'>" + openOpts.length + " open</span>"
            + (opts.length - openOpts.length
                ? "<span class='cu-pill'>" + (opts.length - openOpts.length)
                  + " decided</span>" : "")
            + "</div>"
            // the ladder is an order, not a list: a call is cheaper than moving someone's date
            + group("call", "Calls", "a phone call and a $50 same-day discount")
            + group("move", "Date moves", "only when calls cannot clear the day")
            + "<div class='cu-msg'>" + esc(S.msg || "") + "</div>"
            + "<div class='cu-note'>Declining is <b>permanent and per customer</b> — you only "
            + "get to ask someone once, so a customer who says no is never suggested again, on "
            + "any day, until you reopen it. Decisions are recorded for everyone, not just this "
            + "browser. Accepting records the decision; the calendar is not changed yet.</div>"
            + "</div>";
        }

        // ORDER: the verdict, then what to DO about it, then the day itself. The plan is the
        // reason a dispatcher opened this page; the routes are the evidence behind it.
        detail = "<div class='cu-card'>"
          + "<div class='cu-hd'><b>" + new Date(S.sel + "T12:00").toLocaleDateString("en-US",
              { weekday: "long", month: "long", day: "numeric" }) + "</b>"
          + "<span class='cu-pill " + esc(d.Status) + "'>" + esc(d.Status) + "</span>"
          + "<span class='cu-pill'>" + d.Jobs + " jobs</span>"
          + "<span class='cu-pill'>" + rt + " crews needed</span>"
          + (+d.Skipped ? "<span class='cu-pill tight' title='" + esc(d["Skipped Why"] || "")
              + "'>" + d.Skipped + " event" + (+d.Skipped === 1 ? "" : "s")
              + " skipped</span>" : "")
          + "</div>"
          + "<div class='cu-verdict'>" + verdict + "</div>"
          + (+d.Skipped ? "<div class='cu-off'><b>Not counted:</b> "
              + esc(d["Skipped Why"] || "") + "</div>" : "")
          + (d["Crews Off"] ? "<div class='cu-off'><b>Off today:</b> " + esc(d["Crews Off"]) + "</div>" : "")
          + ledger
          + "</div>"
          + optHtml
          + "<div class='cu-card'>"
          + "<div class='cu-hd'><b>The day itself</b>"
          + "<span class='cu-pill'>" + rt + " crew" + (rt === 1 ? "" : "s") + "</span>"
          + "<span class='cu-pill'>" + shown.length + " of " + jobs.length + " jobs</span></div>"
          + filters(jobs)
          + "<div class='cu-mleg' style='margin:0 0 6px'>"
          + "<span><i style='background:var(--job-local)'></i>local</span>"
          + "<span><i style='background:var(--job-long)'></i>long distance</span>"
          + "<span><i style='background:var(--job-straight)'></i>straight</span>"
          + "<span><i style='background:var(--job-labor)'></i>labor only</span>"
          + "<span><i class='hatch'></i>empty drive between two chained jobs</span></div>"
          + "<div class='cu-split'>"
          + "<div class='cu-tlwrap'>"
          + (shown.length ? timeline(shown)
            : "<div class='cu-empty'>No jobs match this filter.</div>")
          + "<div class='cu-note'>Each row is <b>one crew's day</b>, grouped by the depot it "
          + "leaves from and laid out on the clock. A row with two bars is a chain — one crew "
          + "running both jobs, and the hatched gap between them is the empty drive that costs. "
          + "Click a row to open the run.</div></div>"
          + runDrawer(shown)
          + "</div></div>"
          + (shown.length ? "<div class='cu-card'><div class='cu-hd'><b>Where the day goes</b>"
              + (S.mapOn ? "<span class='cu-pill'>" + (S.focus ? "one run" : "every run")
                  + "</span>" : "")
              + (S.focus && S.mapOn ? "<button class='cu-btn' id='cuAll' style='margin-left:auto'>"
                  + "Show every run</button>" : "")
              + "<button class='cu-btn" + (S.mapOn ? "" : " sel") + "' id='cuMapT' style='margin-left:"
              + (S.focus && S.mapOn ? "6px" : "auto") + "'>"
              + (S.mapOn ? "Hide map" : "Analyze routes") + "</button></div>"
              + (S.mapOn
                 ? "<div class='cu-map' id='cuMap'></div><div class='cu-mleg'>"
                   + "<span><i style='background:var(--job-local)'></i>loaded — pickup to delivery</span>"
                   + "<span><i class='hatch'></i>empty — the drive between two chained jobs</span>"
                   + "<span><i style='background:var(--job-long)'></i>long distance</span>"
                   + "<span id='cuFar'></span></div>"
                 // Road geometry is metered, so nothing is fetched until it is asked for.
                 : "<div class='cu-note' style='margin:0'>Every leg of this day drawn on real "
                   + "roads, including the empty drives between chained jobs. Routing is "
                   + "charged per leg, so it is only fetched when you ask for it.</div>")
              + "</div>" : "");
      }

      // day navigation: the strip is for scanning the horizon, these are for walking it
      var order = dayList.map(function (x) { return String(x.Day).slice(0, 10); });
      var at = order.indexOf(S.sel);
      var tomorrow = new Date(TODAY + "T12:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      var TOM = tomorrow.toISOString().slice(0, 10);
      var has = function (iso) {
        return days.some(function (x) { return String(x.Day).slice(0, 10) === iso; }); };

      var toggle = "<div class='cu-nav'>"
        + "<button class='cu-btn' id='cuPrev'" + (at <= 0 ? " disabled" : "") + ">‹</button>"
        + "<button class='cu-btn' id='cuNext'"
        + (at < 0 || at >= order.length - 1 ? " disabled" : "") + ">›</button>"
        + "<button class='cu-btn" + (S.sel === TODAY ? " sel" : "") + "' data-jump='" + TODAY + "'"
        + (has(TODAY) ? "" : " disabled") + ">Today</button>"
        + "<button class='cu-btn" + (S.sel === TOM ? " sel" : "") + "' data-jump='" + TOM + "'"
        + (has(TOM) ? "" : " disabled") + ">Tomorrow</button>"
        + "<button class='cu-pill" + (S.probOnly ? " tight" : "") + "' id='cuProb' "
        + "style='cursor:pointer;border:0;font:inherit;font-size:10px;font-weight:800;margin-left:auto'>"
        + (S.probOnly ? "Showing days that need attention" : "Show only days that need attention")
        + "</button></div>";

      body.innerHTML = kpis + toggle + strip + detail;

      Array.prototype.forEach.call(body.querySelectorAll("[data-day]"), function (b) {
        b.onclick = function () {
          S.sel = b.getAttribute("data-day");
          S.focus = S.openRun = null; S.mapOn = false; paint(); };
      });
      var pb = document.getElementById("cuProb");
      if (pb) pb.onclick = function () { S.probOnly = !S.probOnly; paint(); };
      var pv = document.getElementById("cuPrev"), nx = document.getElementById("cuNext");
      if (pv) pv.onclick = function () {
        if (at > 0) { S.sel = order[at - 1]; S.focus = S.openRun = null; S.mapOn = false; paint(); } };
      if (nx) nx.onclick = function () {
        if (at >= 0 && at < order.length - 1) {
          S.sel = order[at + 1]; S.focus = S.openRun = null; S.mapOn = false; paint();
        } };
      Array.prototype.forEach.call(body.querySelectorAll("[data-jump]"), function (b) {
        b.onclick = function () {
          S.sel = b.getAttribute("data-jump"); S.focus = S.openRun = null; S.mapOn = false;
          // jumping to a day the "needs attention" view has hidden would land on nothing
          if (order.indexOf(S.sel) < 0) S.probOnly = false;
          paint();
        };
      });

      Array.prototype.forEach.call(body.querySelectorAll("[data-dec]"), function (b) {
        b.onclick = function () { decide(b); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-base]"), function (b) {
        b.onclick = function () {
          S.baseF = b.getAttribute("data-base") || null;
          S.focus = S.openRun = null; S.mapOn = false; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-co]"), function (b) {
        b.onclick = function () {
          S.coF = b.getAttribute("data-co") || null;
          S.focus = S.openRun = null; S.mapOn = false; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-run]"), function (b) {
        var open = function () {
          var r = b.getAttribute("data-run");
          var same = S.openRun === r;
          S.openRun = same ? null : r;
          S.focus = S.openRun;
          // the map does not follow you around: geometry is metered, so a new run means a
          // new deliberate "analyze", never a silent fetch for wherever you clicked
          S.mapOn = false;
          paint();
        };
        b.onclick = open;
        b.onkeydown = function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-base-grp]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var k = b.getAttribute("data-base-grp");
          S.shut[k] = !S.shut[k];
          paint();
        };
      });
      var dx = document.getElementById("cuDrwX");
      if (dx) dx.onclick = function () {
        S.openRun = null; S.focus = null; S.mapOn = false; paint(); };
      var dm = document.getElementById("cuDrwMap");
      if (dm) dm.onclick = function () {
        S.mapOn = true; paint();
        var mp = document.getElementById("cuMap");
        if (mp) mp.scrollIntoView({ behavior: "smooth", block: "center" });
      };
      var ab = document.getElementById("cuAll");
      if (ab) ab.onclick = function () { S.focus = null; paint(); };
      // Esc closes the run the same way the X does
      if (!window.__CUESC) {
        window.__CUESC = true;
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && S.openRun) {
            S.openRun = null; S.focus = null; S.mapOn = false; paint();
          }
        });
      }
      var mt = document.getElementById("cuMapT");
      if (mt) mt.onclick = function () { S.mapOn = !S.mapOn; paint(); };

      // the map is drawn after the DOM exists, and only for what is actually shown
      if (document.getElementById("cuMap")) {
        var vis = (S.jobs || []).filter(function (j) {
          return String(j.Day).slice(0, 10) === S.sel
            && (!S.baseF || j.Base === S.baseF) && (!S.coF || j.Company === S.coF); });
        drawMap(vis);
      }
    }

    function decide(btn) {
      if (S.busy) return;
      var action = btn.getAttribute("data-dec");
      var code = btn.getAttribute("data-code");
      var cust = btn.getAttribute("data-cust");
      // Declining is permanent and reaches every other day, so it gets a confirm; accepting
      // only records an intention and is easily reopened.
      if (action === "declined" && !window.confirm(
            "Decline for " + (cust || code) + "?\n\nThis is permanent: " + (cust || "this customer")
            + " will not be suggested again on any day, for any option.")) return;
      S.busy = code; S.msg = ""; paint();
      fetch(ZTZ.API + "/api/_cleanupdecide", {
        method: "POST",
        headers: { "Content-Type": "application/json",
                   Authorization: "Bearer " + ZTZ.getToken() },
        body: JSON.stringify({
          day: S.sel, job_code: code, customer: cust, kind: btn.getAttribute("data-kind"),
          action: action, after_code: btn.getAttribute("data-after") || null,
          move_to: btn.getAttribute("data-to") || null }),
      }).then(function (r) { return r.json().then(function (j) {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          // reflect it now; the mart re-reads decisions on its next build
          var shows = action === "reopened" ? "open" : action;
          (S.opts || []).forEach(function (o) {
            if (o["Job Code"] === code && String(o.Day).slice(0, 10) === S.sel) o.Status = shows;
            if (action === "declined" && cust && o.Customer === cust) o.Status = "declined";
            // reopening lifts the customer-wide block the decline had cast
            if (action === "reopened" && cust && o.Customer === cust && o.Status === "declined")
              o.Status = "open";
          });
          S.busy = "";
          S.msg = action === "reopened"
            ? "Reopened — " + (cust || code) + " is back on the list."
            : "Recorded — " + action + " for " + (cust || code) + ".";
          paint();
        }); })
        .catch(function (e) {
          S.busy = ""; S.msg = "Could not record that: " + String(e.message || e);
          paint();
        });
    }

    if (S.days && S.jobs && S.opts) { paint(); return; }
    Promise.all([RS.load("fct_cleanup_day"), RS.load("fct_cleanup_job"),
                 RS.load("fct_cleanup_option")])
      .then(function (res) {
        S.days = res[0] || [];
        S.jobs = res[1] || [];
        S.opts = res[2] || [];
        paint();
      })
      .catch(function (e) {
        if (window.__CUGEN !== gen) return;
        var body = document.getElementById("cuBody");
        if (body) body.innerHTML = "<div class='cu-empty'>Could not load the horizon: "
          + esc(String(e)) + "</div>";
      });
  },
});
