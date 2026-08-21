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
               "Cost", "Discount", "Recommended", "Purpose", "Lands Behind", "Status",
               "Arrive", "Arrives Late", "Anchor Route"],
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
    // window.RSC is the real global (assets/rs-components.js:3). This read RS_COMPONENTS,
    // which has never existed, so `|| {}` handed every one of these pages an EMPTY object
    // and each helper quietly fell through to its local fallback. Nothing looked wrong
    // until `collapsible` -- the one member with no fallback -- was called, and Packing
    // Control and Storage Control died with "RSC.collapsible is not a function".
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__CU || (window.__CU = { days: null, jobs: null, opts: null,
      sel: null, probOnly: false, busy: "", msg: "",
      baseF: null, coF: null, mapOn: false, openRun: null, shut: {} });

    host.innerHTML = '<style id="cuCss">'
      /* THE SHARED KIT (assets/rs.css) carries this page's tiles, cards, control bars,
         segments, buttons, pills and hints. The cu-kpis / cu-kpi / cu-card / cu-hd /
         cu-pill / cu-btn / cu-nav / cu-fil / cu-chip copies that used to live here were
         the same controls, drifted. What is left below is what the kit has no answer for:
         the day horizon, the clock timeline, the chain ledger, the option ladder, the run
         drawer and the map. */
      + ".cu-wrap{--t1:26px;--t2:15px;--t3:13.5px;--t4:12px;--t5:11px;--t6:9.5px;--r-card:14px;--r-ctl:10px;--r-bar:6px;--cu-lab:200px;max-width:none}"
      /* This board REWRITES ITS WHOLE BODY on every click -- a day, a run, a base filter.
         The kit's entrance animation would replay each time, and the page reads as
         flinching. Same reason rs.css gives .panel its own .rs-noanim escape. */
      + ".cu-wrap .rs-kpis,.cu-wrap .panel{animation:none}"
      /* on a KPI tile the kit paints .v in --ink at (0,3,0); the capacity tones have to
         out-specify it or the tile carries no signal */
      + ".rs-kpis .kpi .v.cu-bad{color:var(--neg)} .rs-kpis .kpi .v.cu-warn{color:var(--warn)}"
      + ".rs-kpis .kpi .v.cu-good{color:var(--pos)}"
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
      /* the sentence a dispatcher actually needs -- the kit's hint measure and margins,
         but at reading weight: this is the answer the page exists to give */
      + ".rs-hint.cu-verdict{font-size:14px;color:var(--ink);margin-bottom:12px}"
      + ".rs-hint.cu-verdict b{font-variant-numeric:tabular-nums}"
      + ".rs-hint.cu-off{margin-bottom:12px}"
      /* a note that closes a block, so it takes its space above rather than below */
      + ".rs-hint.cu-note{margin:10px 0 0}"
      + ".cu-empty{color:var(--faint);font-size:13.5px;padding:16px 0}"
      /* Full width is right for the timeline and the map -- they are diagrams, and width is
         what makes them readable. It is WRONG for prose and for a row whose action sits at
         its end: at 2000px the Accept button ended up an inch from the far edge of the
         screen, a long way from the sentence it answers. Text-bearing blocks keep a
         comfortable measure; only the diagrams stretch. */
      + ".cu-opt{display:flex;gap:12px;align-items:flex-start;padding:11px 0;"
      + "border-top:1px solid var(--line-2);max-width:var(--rs-row-max)}"
      + ".cu-ghd,.cu-msg{max-width:var(--rs-row-max)}"
      /* the kit's .rs-hint already measures itself in characters (--rs-prose), so only the
         ledger's own prose still needs saying here */
      + ".cu-ledhd span,.cu-lwarn,.cu-lnote{max-width:104ch}"
      + ".cu-led{max-width:var(--rs-row-max)}"
      + ".cu-opt:first-child{border-top:0}"
      + ".cu-opt.done{opacity:.5}"
      + ".cu-obody{flex:1;min-width:0}"
      + ".cu-otitle{font-size:13.5px;font-weight:700;letter-spacing:-.1px}"
      + ".cu-otitle .rs-pill{margin-right:7px}"
      + ".cu-owhy{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:2px}"
      + ".cu-oact{display:flex;gap:6px;flex:0 0 auto}"
      /* a view toggle must not look like the button that records a permanent decision, and
         declining is the one button on this page that can never be taken back */
      + ".rs-btn.cu-sel,.rs-btn.cu-sel:hover:not(:disabled)"
      + "{background:var(--blue-bg);border-color:var(--blue);color:var(--blue)}"
      + ".rs-btn.cu-danger:hover:not(:disabled){border-color:var(--neg);color:var(--neg)}"
      /* the kit's toggle chip is written for a <div>; on the <button> this page uses (so it
         stays keyboard-reachable) the UA font would win unless it is handed back */
      + ".cu-wrap .rs-tog{font-family:inherit}"
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
      /* DAY NAV and FILTERS are both .rs-bar now -- see assets/rs.css, THE COMPONENT KIT */
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
      /* MAP FURNITURE: arrows on the line, chips at the stops, a readable tooltip */
      + ".cu-arrow i{font-style:normal;font-size:13px;line-height:1;display:block;"
      + "text-shadow:0 0 3px var(--panel),0 0 3px var(--panel)}"
      + ".cu-chipwrap{pointer-events:none}"
      + ".cu-mchip{position:absolute;left:9px;top:-9px;white-space:nowrap;font-size:10px;"
      + "font-weight:750;letter-spacing:-.1px;padding:2px 6px;border-radius:999px;"
      + "background:var(--panel);color:var(--ink);border:1px solid var(--line-2);"
      + "box-shadow:0 1px 3px rgba(0,0,0,.18)}"
      + ".cu-mchip.pick{border-color:var(--blue)} .cu-mchip.drop{border-color:var(--pos)}"
      + ".cu-mchip.below{top:5px}"
      + ".cu-mchip.base{background:var(--ink);color:var(--panel);border-color:var(--ink)}"
      + ".leaflet-tooltip.cu-mtip{background:var(--panel);color:var(--ink);"
      + "border:1px solid var(--line);border-radius:9px;box-shadow:var(--shadow);"
      + "padding:7px 10px;font-size:11.5px;line-height:1.5;max-width:260px;white-space:normal}"
      + ".leaflet-tooltip.cu-mtip b{display:block;font-size:12px;margin-bottom:2px}"
      + ".leaflet-tooltip.cu-mtip span{display:block;color:var(--faint)}"
      + ".leaflet-tooltip.cu-mtip:before{border-top-color:var(--line)}"
      /* THE RUN DRAWER */
      + ".cu-drw{flex:0 0 380px;position:sticky;top:12px;max-height:calc(100vh - 84px);"
      + "overflow:auto;background:var(--panel-2);border:1px solid var(--line);border-radius:13px;"
      + "padding:14px 15px}"
      + ".cu-dhd{display:flex;align-items:flex-start;gap:10px;margin:-14px -15px 12px;"
      + "padding:14px 15px 11px;position:sticky;top:-14px;z-index:2;background:var(--panel-2);"
      + "border-bottom:1px solid var(--line-2);border-radius:var(--r-card) var(--r-card) 0 0}"
      + ".cu-dhdbtn{margin-left:auto;display:flex;gap:6px;align-items:center}"
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
      /* the drawer gives the map room rather than sending it to the foot of the page */
      /* map open = an even split, so the route gets as much screen as the day does */
      + ".cu-drw.wide{flex:1 1 0;max-width:none}"
      + ".cu-dmap{margin-top:12px}"
      + ".cu-dmap .cu-map{height:min(56vh,600px)}"
      /* at half-width the vitals stop wrapping into three cramped columns */
      + ".cu-drw.wide .cu-vit{grid-template-columns:repeat(6,1fr)}"
      + ".cu-drw.wide .cu-step{columns:1}"
      + ".cu-dnote{font-size:var(--t5);color:var(--faint);line-height:1.55;margin-top:9px}"
      + "@media(max-width:1180px){.cu-drw.wide{flex:1 1 auto}}"
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
    // the shared kit's pill tones (assets/rs.css: .rs-pill), keyed by the mart's own
    // status word -- the word itself is still what the pill prints
    var PILL = { ok: "ok", tight: "warn", short: "bad" };
    function fmtDay(iso) {
      var d = new Date(String(iso).slice(0, 10) + "T12:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    // the crew's calendar day, not the browser's UTC one -- after 8pm in New Jersey those are
    // different dates, and the board would open on tomorrow
    var TODAY = (function () {
      try {
        return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York",
          year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      } catch (e) { return new Date().toISOString().slice(0, 10); }
    })();

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
          return "<button" + (cur === v ? " class='on'" : "") + " " + attr + "='"
            + esc(v) + "'>" + esc(v) + "</button>";
        }).join("");
      }
      function seg(label, cur, attr, list) {
        return "<div class='rs-fld'><span>" + label + "</span><div class='rs-seg'>"
          + "<button" + (cur ? "" : " class='on'") + " " + attr + "=''>All</button>"
          + chips(list, cur, attr) + "</div></div>";
      }
      return "<div class='rs-bar'>"
        + (bases.length > 1 ? seg("Base", S.baseF, "data-base", bases) : "")
        + (cos.length > 1 ? seg("Company", S.coF, "data-co", cos) : "")
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
      // a STRAIGHT job is the one the crew does not come home from -- that is the engine's
      // rule (_carrier), and a regular long-distance job hands off and returns the same day
      var isAway = function (j) {
        return String(j["Job Type"] || "").toLowerCase().indexOf("straight") >= 0; };
      var isLD = legs.some(isAway);

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
        cur += hrs;
        if (dl && Math.round(dl.mi) > 0) {
          totMin += dl.min; totMi += dl.mi;
          // the loaded leg is time the crew is working, so it advances the clock -- the engine
          // counts it in _endMs and the drawer used to leave it out, which is why a chained
          // run's arrival here disagreed with the arrival in the ledger above
          rows.push({ cls: "go", t: clock(cur),
                      txt: "Loaded to " + esc(j["Delivery City"] || "") + " · "
                           + fmtMin(dl.min) + " · " + Math.round(dl.mi) + " mi" });
          cur += dl.min / 60;
        }
        var far = isAway(j);
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

      return "<aside class='cu-drw" + (S.mapOn ? " wide" : "") + "' id='cuDrw'>"
        + "<div class='cu-dhd'><div><b>" + esc(r.id)
        + (first.Foreman ? " · " + esc(first.Foreman) : "") + "</b>"
        + "<span>" + esc(first.Base || "") + " base · " + legs.length + " job"
        + (legs.length === 1 ? "" : "s") + " · the whole run for this day</span></div>"
        + "<div class='cu-dhdbtn'>"
        + "<button class='rs-btn" + (S.mapOn ? "" : " cu-sel") + "' id='cuDrwMap'>"
        + (S.mapOn ? "Hide map" : "Analyze this run") + "</button>"
        + "<button class='cu-x' id='cuDrwX' title='Close' aria-label='Close run'>✕</button>"
        + "</div></div>"
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
        + (S.mapOn
           ? "<div class='cu-dmap'><div class='cu-map' id='cuMap'></div>"
             + "<div class='cu-mleg'>"
             + "<span><i style='background:var(--blue)'></i>out to first pickup</span>"
             + "<span><i style='background:var(--job-local)'></i>loaded — job 1</span>"
             + "<span><i style='background:var(--pos)'></i>loaded — job 2</span>"
             + "<span><i style='background:var(--job-straight)'></i>between jobs</span>"
             + "<span><i style='background:var(--empty)'></i>run home</span>"
             + "<span><i style='background:var(--job-long)'></i>long distance</span>"
             + "<span id='cuFar'></span></div></div>"
           : "")
        + "<div class='cu-step'>" + rows.map(function (x) {
            return "<div class='" + x.cls + "'><i>" + x.t + "</i><span>" + x.txt + "</span></div>";
          }).join("") + "</div>"
        + "<div class='cu-dfoot'>Day driving <b>" + fmtMin(totMin) + "</b> · "
        + Math.round(totMi) + " mi, of which <b>" + fmtMin(empMin) + "</b> is empty. "
        + "Times are estimated from straight-line distance at " + MPH + " mph; work never "
        + "starts before the booked time.</div>"
        + (S.mapOn ? ""
           // metered: nothing is fetched until the header button is pressed
           : "<div class='cu-dnote'>This run drawn on real roads, including the empty drives. "
             + "Routing is charged per leg, so it is only fetched when you ask.</div>")
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
      // THE WHOLE JOURNEY, not just the loaded parts. A crew's day is four kinds of driving
      // and they cost differently: out to the first pickup, loaded with someone's home,
      // empty between two chained jobs, and back to the depot. Only the loaded miles earn
      // anything; the other three are what chaining is trading away, so each gets its own
      // colour rather than being lumped together or left off the map entirely.
      var legs = [];
      var r = jobs.slice().sort(function (a, b) {
        return String(a.Start).localeCompare(String(b.Start)); });
      var bz = r[0] && r[0]["Base Zip"];
      var baseName = (r[0] && r[0].Base ? r[0].Base + " base" : "base");
      var hhmm = function (v) { return String(v || "").slice(0, 5); };

      if (bz && r[0]["Pickup Zip"]) {
        legs.push({ a: bz, b: r[0]["Pickup Zip"], kind: "out", n: 0,
                    from: baseName, to: r[0]["Pickup City"] || r[0]["Pickup Zip"],
                    title: "Leaving " + baseName,
                    sub: "empty — heading out to the first pickup" });
      }
      r.forEach(function (j, i) {
        var cust = j.Customer || j["Job Code"];
        if (j["Pickup Zip"] && j["Delivery Zip"]) {
          legs.push({ a: j["Pickup Zip"], b: j["Delivery Zip"],
                      kind: barClass(j) === "long" || barClass(j) === "straight"
                            ? "far" : "loaded",
                      n: i + 1, job: j,
                      from: j["Pickup City"] || j["Pickup Zip"],
                      to: j["Delivery City"] || j["Delivery Zip"],
                      title: "Job " + (i + 1) + " · " + cust,
                      sub: "loaded · " + money(j.CF) + " CF"
                           + (j["Job Code"] ? " · " + j["Job Code"] : "") });
        }
        var nx = r[i + 1];
        if (nx && j["Delivery Zip"] && nx["Pickup Zip"]) {
          legs.push({ a: j["Delivery Zip"], b: nx["Pickup Zip"], kind: "between", n: i + 1,
                      from: j["Delivery City"] || j["Delivery Zip"],
                      to: nx["Pickup City"] || nx["Pickup Zip"],
                      title: "Between job " + (i + 1) + " and job " + (i + 2),
                      sub: "empty — the drive chaining pays for" });
        }
      });
      var last = r[r.length - 1];
      var lastIsAway = last && String(last["Job Type"] || "").toLowerCase()
                                 .indexOf("straight") >= 0;
      if (bz && last && last["Delivery Zip"] && !lastIsAway) {
        legs.push({ a: last["Delivery Zip"], b: bz, kind: "home", n: r.length,
                    from: last["Delivery City"] || last["Delivery Zip"], to: baseName,
                    title: "Back to " + baseName, sub: "empty — the run home" });
      }
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
          // one colour per kind of driving, one per job for the loaded legs
          var KIND = { out: tok("--blue"), between: tok("--job-straight"),
                       home: tok("--empty"), far: tok("--job-long") };
          var JOBCOL = [tok("--job-local"), tok("--pos"), tok("--warn"),
                        tok("--job-straight"), tok("--neg")];
          var add = function (l) { box._lay.push(l.addTo(m)); return l; };
          var bearing = function (a, b) {
            return Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI;
          };
          // an arrow sat on the line, pointing the way the truck is going
          var arrow = function (c, col) {
            if (c.length < 2) return;
            var i = Math.max(1, Math.floor(c.length / 2));
            var deg = 90 - bearing(c[i - 1], c[i]);
            add(L.marker(c[i], { interactive: false, keyboard: false,
              icon: L.divIcon({ className: "cu-arrow", iconSize: [16, 16],
                html: "<i style='transform:rotate(" + deg.toFixed(0) + "deg);color:"
                      + col + "'>\u27A4</i>" }) }));
          };
          var chip = function (at, text, cls) {
            add(L.marker(at, { interactive: false, keyboard: false,
              icon: L.divIcon({ className: "cu-chipwrap", iconSize: [0, 0],
                html: "<span class='cu-mchip " + (cls || "") + "'>" + esc(text) + "</span>" }) }));
          };

          var bounds = [], far = 0, baseChipped = false;
          got.forEach(function (g, i) {
            var c = g.coords || [];
            if (c.length < 2) return;
            var meta = legs[i] || {};
            var loaded = meta.kind === "loaded" || meta.kind === "far";
            var col = loaded
              ? (meta.kind === "far" ? KIND.far : JOBCOL[(meta.n - 1) % JOBCOL.length])
              : KIND[meta.kind] || tok("--empty");

            // a white casing under every line so a route stays readable over any map tile
            add(L.polyline(c, { color: tok("--panel"), weight: loaded ? 8 : 6,
                                opacity: 0.85, lineCap: "round" }));
            var pl = add(L.polyline(c, loaded
              ? { color: col, weight: 4.5, opacity: 0.95, lineCap: "round" }
              : { color: col, weight: 3, opacity: 0.95, dashArray: "5 7", lineCap: "round" }));
            arrow(c, col);

            var mi = g.miles != null ? Math.round(g.miles) : null;
            var mins = mi != null ? Math.round(mi / 35 * 60) + 4 : null;
            pl.bindTooltip(
              "<b>" + esc(meta.title || "") + "</b>"
              + "<span>" + esc(meta.from || "") + " \u2192 " + esc(meta.to || "") + "</span>"
              + "<span>" + esc(meta.sub || "") + "</span>"
              + (mi != null ? "<span>" + mi + " mi · about " + fmtMin(mins)
                              + (g.source === "here" ? "" : " · straight-line estimate")
                              + "</span>" : ""),
              { sticky: true, className: "cu-mtip", direction: "top" });

            if (meta.kind === "far") far++;
            else c.forEach(function (p) { bounds.push(p); });

            // numbered stops: P where the load goes on, D where it comes off
            if (loaded) {
              var j = meta.job || {};
              add(L.circleMarker(c[0], { radius: 7, color: col, weight: 3,
                    fillColor: tok("--panel"), fillOpacity: 1 }))
                .bindTooltip("<b>Job " + meta.n + " pickup</b><span>"
                  + esc(j["Pickup City"] || "") + " " + esc(j["Pickup Zip"] || "")
                  + "</span><span>booked " + esc(hhmm(j.Start)) + " · "
                  + esc(money(j.CF)) + " CF" + (j.Crew ? " · crew of " + esc(j.Crew) : "")
                  + "</span>", { className: "cu-mtip", direction: "top" });
              add(L.circleMarker(c[c.length - 1], { radius: 7, color: col, weight: 3,
                    fillColor: col, fillOpacity: 1 }))
                .bindTooltip("<b>Job " + meta.n + " delivery</b><span>"
                  + esc(j["Delivery City"] || "") + " " + esc(j["Delivery Zip"] || "")
                  + "</span><span>" + esc(meta.title || "") + "</span>",
                  { className: "cu-mtip", direction: "top" });
              // the chip names WHO, the tooltip says where -- a dispatcher thinks in
              // customers, and the city is already one hover away (Tornike, 2026-08-04)
              var who = (j.Customer || j["Job Code"] || meta.from || "");
              chip(c[0], meta.n + "P " + who, "pick");
              chip(c[c.length - 1], meta.n + "D " + who, "drop below");
            }
            if (!baseChipped && (meta.kind === "out" || meta.kind === "home")) {
              baseChipped = true;
              chip(meta.kind === "out" ? c[0] : c[c.length - 1],
                   "\u25c6 " + (meta.kind === "out" ? (meta.from || "base")
                                                     : (meta.to || "base")), "base");
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

      var nProb = days.filter(function (d) { return d.Status === "short"; }).length;
      var nNear = days.filter(function (d) { return d.Status === "tight"; }).length;
      var tightest = days.slice().sort(function (a, b) { return (+a.Spare) - (+b.Spare); })[0];
      var totJobs = days.reduce(function (a, d) { return a + (+d.Jobs || 0); }, 0);
      var totChain = days.reduce(function (a, d) { return a + (+d["Chains Applied"] || 0); }, 0);

      // five tiles, always five, so the kit's balanced-column variable is a constant here
      var kpis = "<div class='rs-kpis' style='--kpi-cols:5'>"
        + "<div class='kpi'><div class='l'>Days short of crews</div>"
        + "<div class='v " + (nProb ? "cu-bad" : "cu-good") + "'>" + nProb + "</div>"
        + "<div class='s'>fewer crews than routes</div></div>"
        + "<div class='kpi'><div class='l'>Days with no buffer</div>"
        + "<div class='v " + (nNear ? "cu-warn" : "") + "'>" + nNear + "</div>"
        + "<div class='s'>staffed, but nothing spare</div></div>"
        + "<div class='kpi'><div class='l'>Tightest day</div>"
        + "<div class='v" + (tightest && +tightest.Spare < 0 ? " cu-bad"
            : (tightest && +tightest.Spare === 0 ? " cu-warn" : "")) + "'>"
        + (tightest ? ((+tightest.Spare > 0 ? "+" : "") + tightest.Spare) : "—") + "</div>"
        + "<div class='s'>" + (tightest ? fmtDay(tightest.Day) : "") + " · spare crews</div></div>"
        + "<div class='kpi'><div class='l'>Jobs in horizon</div>"
        + "<div class='v'>" + money(totJobs) + "</div>"
        + "<div class='s'>" + days.length + " days</div></div>"
        + "<div class='kpi'><div class='l'>Chains already counted</div>"
        + "<div class='v'>" + totChain + "</div>"
        + "<div class='s'>jobs the board put on one crew</div></div>"
        + "</div>";

      // an empty filtered strip took the arrows with it and said nothing -- see below
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
                  + "<span class='rs-pill ok'>"
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
            return "<button class='rs-btn" + (cls ? " " + cls : "") + "' data-dec='" + act
              + "' data-kind='" + esc(o.Kind) + "' data-code='" + esc(o["Job Code"])
              + "' data-cust='" + esc(o.Customer || "") + "' data-after='"
              + esc(o["After Code"] || "") + "' data-to='" + esc(o["Move To"] || "") + "'"
              + (S.busy ? " disabled" : "") + ">" + label + "</button>";
          };
          return "<div class='cu-opt" + (done ? " done" : "") + "'>"
            + "<div class='cu-obody'><div class='cu-otitle'>"
            + "<span class='rs-pill " + (isCall ? "info" : "warn") + "'>"
            + (isCall ? "call" : "move date") + "</span>" + title
            + (+o.Recommended ? " <span class='rs-pill ok'>recommended</span>" : "")
            + "</div><div class='cu-owhy'>" + why + "</div></div>"
            + "<div class='cu-oact'>"
            + (done
               ? "<span class='rs-pill " + (o.Status === "accepted" ? "ok" : "bad") + "'>"
                 + esc(o.Status) + "</span>" + btn("reopened", "Reopen")
               : btn("accepted", "Accept", "pri") + btn("declined", "Decline", "cu-danger"))
            + "</div></div>";
        }

        if (opts.length) {
          var group = function (kind, head, sub) {
            var list = opts.filter(function (o) { return o.Kind === kind; });
            if (!list.length) return "";
            return "<div class='cu-ghd'><b>" + head + "</b><span>" + sub + "</span></div>"
              + list.map(optRow).join("");
          };
          optHtml = "<div class='panel'><div class='panel-head'>"
            + "<span class='panel-title'>What would free another crew</span>"
            + "<span class='rs-pill mute'>" + openOpts.length + " open</span>"
            + (opts.length - openOpts.length
                ? "<span class='rs-pill mute'>" + (opts.length - openOpts.length)
                  + " decided</span>" : "")
            + "</div>"
            // the ladder is an order, not a list: a call is cheaper than moving someone's date
            + group("call", "Calls", "a phone call and a $50 same-day discount")
            + group("move", "Date moves", "only when calls cannot clear the day")
            + "<div class='cu-msg'>" + esc(S.msg || "") + "</div>"
            + "<div class='rs-hint cu-note'>Declining is <b>permanent and per customer</b> — you only "
            + "get to ask someone once, so a customer who says no is never suggested again, on "
            + "any day, until you reopen it. Decisions are recorded for everyone, not just this "
            + "browser. Accepting records the decision; the calendar is not changed yet.</div>"
            + "</div>";
        }

        // ORDER: the verdict, then what to DO about it, then the day itself. The plan is the
        // reason a dispatcher opened this page; the routes are the evidence behind it.
        detail = "<div class='panel'>"
          + "<div class='panel-head'><span class='panel-title'>"
          + new Date(S.sel + "T12:00").toLocaleDateString("en-US",
              { weekday: "long", month: "long", day: "numeric" }) + "</span>"
          + "<span class='rs-pill " + (PILL[d.Status] || "mute") + "'>" + esc(d.Status) + "</span>"
          + "<span class='rs-pill mute'>" + d.Jobs + " jobs</span>"
          + "<span class='rs-pill mute'>" + rt + " crews needed</span>"
          + (+d.Skipped ? "<span class='rs-pill warn' title='" + esc(d["Skipped Why"] || "")
              + "'>" + d.Skipped + " event" + (+d.Skipped === 1 ? "" : "s")
              + " skipped</span>" : "")
          + "</div>"
          + "<div class='rs-hint cu-verdict'>" + verdict + "</div>"
          + (+d.Skipped ? "<div class='rs-hint cu-off'><b>Not counted:</b> "
              + esc(d["Skipped Why"] || "") + "</div>" : "")
          + (d["Crews Off"] ? "<div class='rs-hint cu-off'><b>Off today:</b> " + esc(d["Crews Off"]) + "</div>" : "")
          + ledger
          + "</div>"
          + optHtml
          + "<div class='panel'>"
          + "<div class='panel-head'><span class='panel-title'>The day itself</span>"
          + "<span class='rs-pill mute'>" + rt + " crew" + (rt === 1 ? "" : "s") + "</span>"
          + "<span class='rs-pill mute'>" + shown.length + " of " + jobs.length + " jobs</span></div>"
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
          + "<div class='rs-hint cu-note'>Each row is <b>one crew's day</b>, grouped by the depot it "
          + "leaves from and laid out on the clock. A row with two bars is a chain — one crew "
          + "running both jobs, and the hatched gap between them is the empty drive that costs. "
          + "Click a row to open the run.</div></div>"
          + runDrawer(shown)
          + "</div></div>"
          ;
        // The map used to live in its own card at the bottom of the page, and could draw
        // every route on the day at once. It belongs to ONE RUN, so it now opens inside the
        // run drawer on the right, next to the itinerary it illustrates.
      }

      // day navigation: the strip is for scanning the horizon, these are for walking it
      var order = dayList.map(function (x) { return String(x.Day).slice(0, 10); });
      var at = order.indexOf(S.sel);
      var tomorrow = new Date(TODAY + "T12:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      var TOM = tomorrow.toISOString().slice(0, 10);
      var has = function (iso) {
        return days.some(function (x) { return String(x.Day).slice(0, 10) === iso; }); };

      var toggle = "<div class='rs-bar'>"
        + "<button class='rs-btn' id='cuPrev'" + (at <= 0 ? " disabled" : "") + ">‹</button>"
        + "<button class='rs-btn' id='cuNext'"
        + (at < 0 || at >= order.length - 1 ? " disabled" : "") + ">›</button>"
        + "<button class='rs-btn" + (S.sel === TODAY ? " cu-sel" : "") + "' data-jump='" + TODAY + "'"
        + (has(TODAY) ? "" : " disabled") + ">Today</button>"
        + "<button class='rs-btn" + (S.sel === TOM ? " cu-sel" : "") + "' data-jump='" + TOM + "'"
        + (has(TOM) ? "" : " disabled") + ">Tomorrow</button>"
        + "<div class='rs-spacer'></div>"
        + "<button class='rs-tog" + (S.probOnly ? " on" : "") + "' id='cuProb'><i></i>"
        + (S.probOnly ? "Showing days that need attention" : "Show only days that need attention")
        + "</button></div>";

      // "Show only days that need attention" with nothing to show emptied the strip AND took
      // both arrows with it, leaving a toggle above a void. Say the good news out loud.
      body.innerHTML = kpis + toggle
        + (dayList.length ? strip
           : "<div class='cu-empty'>Every day in the horizon is staffed with a buffer — "
             + "nothing needs attention. Switch the toggle off to see them all.</div>")
        + detail;

      Array.prototype.forEach.call(body.querySelectorAll("[data-day]"), function (b) {
        b.onclick = function () {
          S.sel = b.getAttribute("data-day");
          S.openRun = null; S.mapOn = false; paint(); };
      });
      var pb = document.getElementById("cuProb");
      if (pb) pb.onclick = function () { S.probOnly = !S.probOnly; paint(); };
      var pv = document.getElementById("cuPrev"), nx = document.getElementById("cuNext");
      if (pv) pv.onclick = function () {
        if (at > 0) { S.sel = order[at - 1]; S.openRun = null; S.mapOn = false; paint(); } };
      if (nx) nx.onclick = function () {
        if (at >= 0 && at < order.length - 1) {
          S.sel = order[at + 1]; S.openRun = null; S.mapOn = false; paint();
        } };
      Array.prototype.forEach.call(body.querySelectorAll("[data-jump]"), function (b) {
        b.onclick = function () {
          S.sel = b.getAttribute("data-jump"); S.openRun = null; S.mapOn = false;
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
          S.openRun = null; S.mapOn = false; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-co]"), function (b) {
        b.onclick = function () {
          S.coF = b.getAttribute("data-co") || null;
          S.openRun = null; S.mapOn = false; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-run]"), function (b) {
        var open = function () {
          var r = b.getAttribute("data-run");
          var same = S.openRun === r;
          S.openRun = same ? null : r;
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
        S.openRun = null; S.mapOn = false; paint(); };
      var dm = document.getElementById("cuDrwMap");
      if (dm) dm.onclick = function () {
        S.mapOn = !S.mapOn;
        paint();
        if (S.mapOn) {
          var d = document.getElementById("cuDrw");
          if (d && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            d.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }
      };
      // Esc closes the run the same way the X does
      if (!window.__CUESC) {
        window.__CUESC = true;
        document.addEventListener("keydown", function (e) {
          if (e.key === "Escape" && S.openRun) {
            S.openRun = null; S.mapOn = false; paint();
          }
        });
      }
      // the map is drawn after the DOM exists, and only ever for the ONE run that is open --
      // there is no "every run" mode any more, which also means the day's whole geometry is
      // never bought at once
      if (document.getElementById("cuMap") && S.openRun) {
        drawMap((S.jobs || []).filter(function (j) {
          return String(j.Day).slice(0, 10) === S.sel
            && (j.Route || ("solo:" + j["Job Code"])) === S.openRun; }));
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
          overlayDecisions(S.opts).then(function () { paint(); });
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

    // Replays ops_cleanup_decision over the mart's frozen Status. Mirrors the mart's own
    // rule exactly (cleanup_mart.py): latest event wins per job; a decline blocks the whole
    // customer; a reopen on ANY of that customer's jobs lifts the customer-wide block.
    function overlayDecisions(rows) {
      return fetch(ZTZ.API + "/api/_cleanupdecide", {
        headers: { Authorization: "Bearer " + ZTZ.getToken() } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) {
          var log = (j && (j.rows || j.decisions)) || [];
          if (!log.length) return rows;
          var key = function (v) { return String(v == null ? "" : v).trim().toLowerCase(); };
          // oldest first so the last word on any job or customer is the one that stands
          log = log.slice().sort(function (a, b) {
            return String(a.at || "").localeCompare(String(b.at || "")); });
          var byJob = {}, custBlocked = {};
          log.forEach(function (d) {
            var jk = String(d.day).slice(0, 10) + "|" + d.job_code;
            if (d.action === "reopened") {
              byJob[jk] = "open";
              if (d.customer) custBlocked[key(d.customer)] = false;
            } else {
              byJob[jk] = d.action;
              if (d.action === "declined" && d.customer) custBlocked[key(d.customer)] = true;
            }
          });
          rows.forEach(function (o) {
            var jk = String(o.Day).slice(0, 10) + "|" + o["Job Code"];
            if (byJob[jk]) o.Status = byJob[jk];
            else if (custBlocked[key(o.Customer)]) o.Status = "declined";
          });
          return rows;
        })
        .catch(function () { return rows; });   // never let the audit read break the board
    }

    if (S.days && S.jobs && S.opts) {
      // re-entering the page must not show a stale decision another dispatcher has taken
      overlayDecisions(S.opts).then(function () { paint(); });
      paint();
      return;
    }
    Promise.all([RS.load("fct_cleanup_day"), RS.load("fct_cleanup_job"),
                 RS.load("fct_cleanup_option")])
      .then(function (res) {
        S.days = res[0] || [];
        S.jobs = res[1] || [];
        S.opts = res[2] || [];
        paint();                                   // the board, immediately
        overlayDecisions(S.opts).then(function () { paint(); });   // then the live decisions
      })
      .catch(function (e) {
        if (window.__CUGEN !== gen) return;
        var body = document.getElementById("cuBody");
        if (body) body.innerHTML = "<div class='cu-empty'>Could not load the horizon: "
          + esc(String(e)) + "</div>";
      });
  },
});
