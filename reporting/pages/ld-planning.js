/* LONG DISTANCE PLANNING — the situation board (LOGISTICS group). V1 per Tornike's
   brief 2026-07-21: every UNDELIVERED long-distance shipment, WHERE it physically is
   (storage system / sheet / truck / carrier), and the DELIVERY WINDOW (FAD + timeframe
   from the calendar) with urgency. Two views: the LIVE BOARD (real open jobs, sorted by
   deadline) and DATA CLEANUP (rows the office should fix in the sheets: carrier-evidence,
   stale, cancelled, sibling-delivered, left-storage). Data: fct_ld_planning (pipeline).
   Planning actions (manual transit days, trip grouping) come in v2. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.ldp_custody) {
    // the ops channel's custody log (Phase 2) — joined to jobs here by code / request / name
    RS.DATASETS.ldp_custody = {
      table: "fct_ld_custody",
      cols: ["TS", "Posted", "Customer", "Custody", "Carrier", "Rate", "CF",
             "Facility", "Units", "Flags", "Photo Count", "Photos", "Permalink",
             "Delivered", "Delivered On", "Job Code", "Request No"],
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_ld_planning) {
    RS.DATASETS.fct_ld_planning = {
      table: "fct_ld_planning",
      cols: ["Company", "Request #", "Job Code", "Customer", "Pickup Date", "Moving From",
             "Moving To", "Delivery State", "Location", "Location Detail", "Sticker",
             "FAD", "FAD Source", "Window End", "Timeframe", "Window Note", "Window Status",
             "Data Issue", "Issue Kind", "Carrier Driver", "Total To Carrier", "Balance Due", "CF",
             "Pickup Event URL", "Pickup Event Date", "Delivery Event URL", "Delivery Event Date",
             "Delivery Status", "Location Source", "Possession",
             "Sibling Delivered", "Sheet Row", "Update Date",
             "Type", "Trip Days", "Depart By", "Urgency", "Urgency Reason", "Do",
             "Storage Sold", "Route Status", "Foreman",
             "Base", "Base Zip", "Carrier Location"],
    };
  }
})();

registerPage({
  id: "ld-planning",
  group: "logistics",
  title: "Long Distance Planning",
  async render(host) {
    var esc = RSC.esc;
    // Design v2: map strokes are painted from JS, so the palette is picked at render time
    // (the theme button re-renders the page). null = the old/dark colours, untouched.
    var V2C = RS.isV2() ? RS.V2 : null;

    /* THE PAGE STANDARD (ZTZ-80, a "Redo" in his approved plan, 13 Nov 2026). The kit draws the
       head, the view tabs, the filter controls, the tiles, the buttons and the status pills
       (.rs-pill); this sheet keeps only what is the page's own -- the board table, the drawer,
       the timeline, the route cards and the maps. Colours are tokens, so light, v2 and dark all
       follow the theme; sizes are the standard's 12 / 13 / 14 / 16 / 20, weights 400 / 600.
       A problem row carries ONE signal: its status pill, plus a single urgency dot in "What to do"
       (the red row edge and the red action text are gone). */
    if (!document.getElementById("ldpCss")) {
      var st = document.createElement("style"); st.id = "ldpCss";
      st.textContent = `
        /* ---- the filter row: kit controls on one line, the count + Delivered on the right ---- */
        .ldp-bar{display:flex;align-items:center;gap:8px 12px;flex-wrap:wrap;margin:12px 0 14px}
        .ldp-fbox{display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-width:0}
        .ldp-fbox #ldpQ{min-width:280px}
        /* one line, one height: the search box and Clear match the kit slicer buttons (34px) */
        .ldp-fbox #ldpQ,.ldp-fbox .rs-btn{height:34px;padding-top:0;padding-bottom:0}
        .ldp-count{margin-left:auto;display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:13px;color:var(--muted)}
        .ldp-count b{font-size:14px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
        .ldp-lnk{border:0;background:none;padding:0;font:inherit;font-size:13px;font-weight:600;color:var(--brand-d);
          text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .ldp-lnk:hover{color:var(--ink)}
        .ldp-lnk:focus-visible{outline:2px solid var(--brand);outline-offset:2px;border-radius:4px}
        /* the skeleton loads UNDER the real head, so its own head bars would draw the title twice */
        #ldpBody .rs-sk-head{display:none}
        /* the six tiles are filters: click one for exactly those rows, click again to release */
        #ldpBody .ldp-kpis .kpi{cursor:pointer;user-select:none}
        #ldpBody .ldp-kpis .kpi.sel{background:var(--brand-glow);box-shadow:inset 0 0 0 2px var(--brand-d)}
        #ldpBody .ldp-kpis .kpi:focus-visible{outline:2px solid var(--brand);outline-offset:2px}

        /* ---- the board: one card, sticky headers, uniform rows (Money Flow's language) ---- */
        .ldp-card{position:relative;background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}
        /* the px numbers here and on .ldp-tlbody / .ldp-ovmap are pre-measurement fallbacks only --
           RSC.fitScroller sets --pg-chrome from the chrome actually on screen */
        .ldp-wrap{overflow:auto;max-height:calc(100vh - var(--pg-chrome, 330px));min-height:320px}
        .ldp-tbl{width:100%;border-collapse:collapse;table-layout:fixed;min-width:1180px;font-size:14px}
        .ldp-tbl th{position:sticky;top:0;z-index:2;background:var(--panel-2);font-size:13px;font-weight:600;color:var(--muted);
          text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;user-select:none}
        .ldp-tbl th.ldp-hbegin{color:var(--ink)}
        .ldp-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;
          overflow:hidden;text-overflow:ellipsis}
        .ldp-tbl tbody tr{height:56px}
        .ldp-tbl tbody tr.ldp-row{cursor:pointer}
        .ldp-tbl tbody tr.ldp-row:hover{background:var(--panel-2)}
        .ldp-tbl tbody tr.ldp-row.on{background:var(--brand-glow)}
        .ldp-tbl col.c-ev{width:118px}
        .ldp-tbl col.c-cust{width:172px}
        .ldp-tbl col.c-type{width:142px}
        .ldp-tbl col.c-from{width:132px}
        .ldp-tbl col.c-to{width:98px}
        .ldp-tbl col.c-where{width:156px}
        .ldp-tbl col.c-when{width:166px}
        .ldp-tbl col.c-todo{width:248px}
        /* cells holding chips or two lines wrap rather than clip (a narrow window or a zoom) */
        .ldp-tbl td.ldp-evtd,.ldp-tbl td.ldp-typetd,.ldp-tbl td.ldp-todotd,.ldp-tbl td.ldp-begin,.ldp-tbl td.ldp-fromtd{white-space:normal}
        .ldp-cust{font-weight:600;color:var(--ink)}
        .ldp-cust-td .ldp-sub{display:block;margin-top:1px}
        .ldp-sub{font-size:12px;color:var(--faint)}
        .ldp-sub b{font-weight:600}
        .ldp-tbl td .ldp-sub{line-height:1.3;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;
          -webkit-box-orient:vertical;overflow:hidden}
        .ldp-tbl td .ldp-whsub{display:block;overflow:visible}
        .ldp-from{display:block;font-size:13px;color:var(--ink);line-height:1.3;white-space:normal}
        .ldp-nodate,.ldp-evnone{font-size:13px;color:var(--faint)}
        /* the calendar jobs are plain links: the label already says which event */
        .ldp-evlink{display:block;width:max-content;margin:2px 0;font-size:13px;font-weight:600;color:var(--blue);text-decoration:none}
        .ldp-evlink:hover{text-decoration:underline}
        /* CATEGORY chips -- what kind of job, never how it is doing (status is the kit's .rs-pill):
           Straight / Storage / Backhaul violet, Regular green, Pickup grey, Delivery navy */
        .ldp-ty,.ldp-stage,.ldp-stor,.ldp-rt{display:inline-block;padding:2px 9px;border-radius:6px;font-size:12px;
          font-weight:600;line-height:1.5;white-space:nowrap}
        .ldp-ty.s,.ldp-stor,.ldp-rt.bh{background:color-mix(in srgb,var(--purple) 10%,transparent);color:var(--purple)}
        .ldp-ty.r{background:var(--blue-bg);color:var(--blue)}
        .ldp-stage.p{background:var(--panel-2);color:var(--muted);box-shadow:inset 0 0 0 1px var(--line)}
        .ldp-stage.d{background:color-mix(in srgb,var(--brand-d) 10%,transparent);color:var(--brand-d)}
        .ldp-stor{margin-left:5px}
        .ldp-typetd .ldp-ty,.ldp-typetd .ldp-stage,.ldp-typetd .ldp-rt,.ldp-typetd .rs-pill{margin:2px 6px 2px 0}
        /* the custody pill keeps the old pill's outer width (8px + the kit's 1px border = its 9px
           sides): any wider and "Picked up — missing closing" wraps in its 156px column */
        .rs-pill.ldp-pos{padding:2px 8px;white-space:normal;line-height:1.25}
        /* WHEN: the date, then how far away. The words carry the urgency ("3d late"); the colour
           lives once, in the dot under "What to do". */
        .ldp-wlab{font-size:12px;color:var(--faint)}
        .ldp-dt{font-size:13px;font-weight:600;color:var(--ink);white-space:normal;line-height:1.25}
        .ldp-begin .ldp-dt{font-size:14px}
        .ldp-arrow{color:var(--faint)}
        .ldp-when{margin-top:1px;font-size:12px;color:var(--faint)}
        .ldp-when.soon,.ldp-when.late{font-weight:600;color:var(--ink)}
        /* WHAT TO DO: the mart's own imperative in ink; one dot = Act now (red) / Act soon (amber) */
        .ldp-todo{font-size:13px;line-height:1.35;color:var(--ink);white-space:normal}
        .ldp-todo.miss{color:var(--muted)}
        .ldp-udot{display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:50%;vertical-align:1px}
        .ldp-udot.now{background:var(--neg)}
        .ldp-udot.soon{background:var(--warn)}
        .ldp-flagdot{display:inline-block;margin-right:3px;font-weight:600;color:var(--warn);cursor:help}
        .ldp-flagdot.blk{color:var(--neg)}
        .ldp-fnote{padding:10px 14px;font-size:12px;color:var(--faint);border-top:1px solid var(--line)}

        /* ---- the detail drawer + the route panel: floating briefing cards ---- */
        /* pointer-events MUST toggle with visibility: an opacity-0 fixed overlay still hit-tests
           and would make the whole page unclickable while it sat there */
        .ldp-scrim{position:fixed;inset:0;z-index:60;background:var(--scrim);opacity:0;transition:opacity .18s;
          pointer-events:none;visibility:hidden}
        .ldp-scrim.show{opacity:1;pointer-events:auto;visibility:visible}
        .ldp-drawer,.ldp-rpanel{position:fixed;top:10px;right:10px;height:calc(100vh - 20px);display:flex;flex-direction:column;
          overflow:hidden;visibility:hidden;background:var(--panel);border:1px solid var(--line);border-radius:12px;
          box-shadow:0 12px 32px rgba(15,23,42,.16)}
        .ldp-drawer{z-index:61;width:min(620px,96vw);opacity:0;transform:translateX(calc(100% + 18px));
          transition:transform .26s cubic-bezier(.32,.72,0,1),opacity .2s}
        .ldp-drawer.show{transform:none;visibility:visible;opacity:1}
        .ldp-rpanel{z-index:62;width:min(780px,96vw);transform:translateX(calc(100% + 24px));transition:transform .22s ease}
        .ldp-rpanel.show{transform:none;visibility:visible}
        @media (prefers-reduced-motion:reduce){.ldp-drawer,.ldp-rpanel{transition:none}}
        .ldp-dhd{position:relative;flex:0 0 auto;padding:17px 19px 15px;background:var(--panel);border-bottom:1px solid var(--line)}
        .ldp-dhd .x{position:absolute;top:14px;right:14px}
        .ldp-dnm{padding-right:44px;font-size:20px;font-weight:600;line-height:1.2}
        .ldp-dmeta{margin-top:4px;font-size:13px;color:var(--faint);font-variant-numeric:tabular-nums}
        .ldp-dpills{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
        .ldp-dbody{flex:1;overflow-y:auto;padding:15px 19px 30px;scrollbar-width:thin}
        .ldp-sec{display:flex;align-items:center;gap:9px;margin:17px 0 7px;font-size:13px;font-weight:600;color:var(--muted)}
        .ldp-sec::after{content:"";flex:1;height:1px;background:var(--line)}
        .ldp-sec:first-child{margin-top:0}
        .ldp-kv{display:grid;grid-template-columns:124px minmax(0,1fr);gap:0 14px;align-items:baseline;padding:4px 12px;
          font-size:14px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px}
        .ldp-kv dt{padding:9px 0;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
        .ldp-kv dd{margin:0;padding:9px 0;border-top:1px solid var(--line);font-weight:600;color:var(--ink);word-break:break-word}
        .ldp-kv dt:first-of-type,.ldp-kv dt:first-of-type + dd{border-top:0}
        .ldp-big{display:block;font-size:16px;font-weight:600;line-height:1.25}
        .ldp-addr{margin-top:3px;font-size:13px;line-height:1.4;color:var(--muted);white-space:normal}
        .ldp-dnote{padding:10px 12px;font-size:13px;line-height:1.5;color:var(--ink);background:var(--panel-2);
          border:1px solid var(--line);border-radius:8px}
        .ldp-dissue{padding:10px 12px;font-size:13px;line-height:1.5;font-weight:600;color:var(--warn);background:var(--warn-bg);
          border:1px solid color-mix(in srgb,var(--warn) 25%,transparent);border-radius:8px}
        .ldp-dissue.blk{color:var(--neg);background:var(--neg-bg);border-color:color-mix(in srgb,var(--neg) 25%,transparent)}
        .ldp-jobs{display:flex;flex-direction:column;gap:5px;align-items:flex-start}
        .ldp-nolink{font-size:13px;color:var(--faint)}
        .ldp-cinp,.ldp-bhtx{width:100%;min-width:0}
        .ldp-bhtx{line-height:1.5;resize:vertical}
        .ldp-rst{margin-left:7px;font-size:12px;font-weight:600;color:var(--brand-d);cursor:pointer;white-space:nowrap}
        .ldp-rst:hover{text-decoration:underline}
        .ldp-udlv{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;padding-top:11px;border-top:1px dashed var(--line)}
        .ldp-bhrow{display:flex;gap:9px;align-items:center;margin-top:8px}
        .ldp-bhwa{display:inline-block;text-decoration:none}
        /* the Slack custody trail (drawer) and the declined-routes list share this row */
        .ldp-cst{display:flex;gap:9px;align-items:baseline;padding:6px 0;border-bottom:1px solid var(--line);font-size:12px;line-height:1.5}
        .ldp-cst:last-child{border-bottom:0}
        .ldp-cst-d{flex:none;min-width:64px;color:var(--faint);white-space:nowrap}
        .ldp-cst-l{margin-left:auto;white-space:nowrap}
        .ldp-cst-l a{margin-left:7px;color:var(--blue);text-decoration:none}
        .ldp-cst-l a:hover{text-decoration:underline}
        .ldp-dec-l{margin-left:14px;white-space:nowrap}
        .ldp-rphd{display:flex;align-items:flex-start;gap:12px;padding:16px 19px 12px;border-bottom:1px solid var(--line)}
        .ldp-rphd b{font-size:16px;font-weight:600}
        .ldp-rphd .x{flex:0 0 auto;margin-left:auto}
        .ldp-rpmap{flex:1;min-height:200px;border:0;border-radius:0}
        .ldp-rpstops{flex:0 0 auto;max-height:32vh;overflow-y:auto;padding:8px 19px 14px;scrollbar-width:thin}
        .ldp-rphop{padding:2px 0 2px 31px;font-size:12px;color:var(--faint)}
        /* the portal's own confirm (a native confirm() can be suppressed silently) */
        .ldp-ask{position:fixed;inset:0;z-index:70;display:none;align-items:center;justify-content:center;background:var(--scrim)}
        .ldp-ask.show{display:flex}
        .ldp-askbox{width:min(440px,92vw);padding:20px 22px;background:var(--panel);border:1px solid var(--line);border-radius:12px;
          box-shadow:0 12px 32px rgba(15,23,42,.16)}
        .ldp-asktxt{font-size:14px;line-height:1.55}
        .ldp-askbtns{display:flex;gap:10px;justify-content:flex-end;margin-top:16px}

        /* ---- Routes. A route is a decision, and two things decide it: how full the truck ends up
           (the fill bar) and when each stop has to land (the path + "first due") ---- */
        .ldp-rgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(390px,1fr));gap:14px}
        .ldp-rcard{display:flex;flex-direction:column;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:10px}
        .ldp-rtop{padding:13px 15px 12px}
        .ldp-rttl{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .ldp-rttl b{font-size:16px;font-weight:600}
        .ldp-cap{margin-top:10px}
        .ldp-capbar{height:7px;overflow:hidden;border-radius:999px;background:var(--panel-2);box-shadow:inset 0 0 0 1px var(--line)}
        .ldp-capfill{height:100%;border-radius:999px;background:var(--pos);transition:width .3s ease}
        .ldp-capfill.low{background:var(--warn)}
        .ldp-capmeta{display:flex;justify-content:space-between;gap:8px;margin-top:5px;font-size:12px;color:var(--faint);
          font-variant-numeric:tabular-nums}
        .ldp-capmeta b{font-weight:600;color:var(--ink)}
        .ldp-rmet{display:grid;grid-template-columns:repeat(4,1fr);background:var(--panel-2);border-top:1px solid var(--line);
          border-bottom:1px solid var(--line)}
        .ldp-rmet>div{padding:7px 4px;text-align:center;border-right:1px solid var(--line)}
        .ldp-rmet>div:last-child{border-right:0}
        .ldp-rmet i{display:block;font-style:normal;font-size:12px;color:var(--faint)}
        .ldp-rmet b{display:block;margin-top:2px;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}
        .ldp-rmet b.bad{color:var(--neg)}
        /* the route's shape in one line: base, the states it touches, base again */
        .ldp-rpath{display:flex;gap:5px;align-items:center;flex-wrap:wrap;padding:10px 15px 12px}
        .ldp-rpath .hop{position:relative;padding:3px 9px;border-radius:999px;background:var(--panel-2);font-size:12px;color:var(--muted)}
        .ldp-rpath .hop+.hop::before{content:"";position:absolute;left:-5px;top:50%;width:5px;height:1px;background:var(--line)}
        .ldp-rpath .hop.base{font-weight:600;color:var(--ink)}
        .ldp-rpath .due{margin-left:auto;font-size:12px;font-weight:600;color:var(--faint)}
        .ldp-rpath .due.soon{color:var(--warn)}
        .ldp-rnote{padding:0 15px 10px;font-size:13px;color:var(--muted)}
        .ldp-ract{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:auto;padding:0 15px 13px}
        /* a stop list: base -> stops -> base. The rail only belongs in the route panel's list. */
        .ldp-rstop{position:relative;display:flex;gap:11px;padding:0 0 11px;font-size:13px}
        .ldp-rstop:last-child{padding-bottom:2px}
        .ldp-rpstops .ldp-rstop::before{content:"";position:absolute;left:9px;top:19px;bottom:-1px;width:2px;background:var(--line-2)}
        .ldp-rpstops .ldp-rstop:last-child::before{display:none}
        .ldp-rstop .rn{position:relative;z-index:1;flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center;
          width:20px;height:20px;border-radius:50%;background:var(--panel);border:1.5px solid var(--line-2);font-size:12px;font-weight:600}

        /* ---- maps (Leaflet, vendored) ---- */
        .ldp-jmap{position:relative;z-index:0;isolation:isolate;height:290px;overflow:hidden;background:var(--panel-2);
          border:1px solid var(--line);border-radius:10px}
        .ldp-jmap.leaflet-container{font-family:inherit}
        .ldp-dmap{height:240px;margin-top:2px}
        .ldp-dmapnote{margin-top:6px;font-size:12px;font-weight:600;color:var(--warn)}
        .ldp-ovmap{height:max(460px,calc(100vh - var(--pg-chrome, 350px)))}
        .ldp-ovmap.full{position:fixed;inset:10px;z-index:65;height:auto;box-shadow:0 12px 32px rgba(15,23,42,.2)}
        .ldp-ovleg{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;margin:2px 2px 10px;font-size:13px;color:var(--muted)}
        .ldp-ovk{display:inline-flex;align-items:center;gap:6px}
        .ldp-ovdot{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--panel);box-shadow:0 0 0 1px var(--line-2)}
        .ldp-ovln{display:inline-block;width:22px;height:0;border-top:3px solid var(--faint);border-radius:2px}
        .ldp-ovln.dash{border-top-style:dashed}
        .ldp-ovln.thin{border-top:2px dashed var(--line-2)}
        .ldp-ovnote{margin-left:auto}
        .ldp-mstop{display:block;width:20px;height:20px;border-radius:50%;background:var(--brand);color:var(--brand-ink);
          font-size:12px;font-weight:600;line-height:20px;text-align:center;box-shadow:0 1px 3px rgba(15,23,42,.3)}
        .ldp-mstop.base{background:var(--brand-d)}
        .ldp-mifl{padding:2px 8px;border:0;border-radius:6px;background:var(--purple);color:var(--panel);font-size:12px;font-weight:600;
          box-shadow:0 1px 3px rgba(15,23,42,.25)}
        .ldp-mifl::before{display:none}

        /* ---- Timeline, modelled on his own longdistance.html planner. A STRAIGHT job is
           depart -> trip -> a committed-date diamond; a REGULAR job is a window band -- two
           planning shapes, so they must not look alike. Pickup is a hollow circle, today a tinted
           column, and a deadline outside the range collapses to an edge chevron rather than
           vanishing. ---- */
        .ldp-tlbar{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 12px}
        .ldp-tlnav{display:inline-flex;gap:6px}
        .ldp-tlrange{font-size:16px;font-weight:600;line-height:1.15}
        .ldp-tlrange small{display:block;margin-top:2px;font-size:12px;font-weight:400;color:var(--faint)}
        .ldp-tllg{display:flex;flex-wrap:wrap;align-items:center;gap:15px;margin-left:auto;font-size:12px;color:var(--muted)}
        .ldp-tllg span{display:flex;align-items:center;gap:6px}
        .lg-pk{flex:0 0 auto;width:11px;height:11px;border-radius:50%;border:2px solid var(--faint);background:var(--panel)}
        .lg-hold{flex:0 0 auto;width:22px;height:4px;border-radius:2px;background:color-mix(in srgb,var(--faint) 60%,transparent)}
        .lg-s{position:relative;flex:0 0 auto;width:22px;height:3px;border-radius:2px;background:var(--line-2)}
        .lg-s::after{content:"";position:absolute;right:-2px;top:50%;width:10px;height:10px;border-radius:2px;background:var(--purple);
          transform:translateY(-50%) rotate(45deg)}
        .lg-r{flex:0 0 auto;width:24px;height:14px;border-radius:4px;background:var(--blue-bg);
          border:1px solid color-mix(in srgb,var(--blue) 30%,transparent);border-left:3px solid var(--blue)}
        .ldp-tlgrid{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--line);border-radius:10px}
        .ldp-tlhead{display:flex;height:50px;background:var(--panel-2);border-bottom:1px solid var(--line)}
        /* 262px, matching .ldp-tllab below. At 236 the header's calendar track started 26px left of
           the rows', and every marker in BOTH is positioned as a percentage of its own track -- so
           the ruler labelled the bars out of register and "today" landed on the wrong day. */
        .ldp-tlhlab{width:262px;flex:0 0 262px;border-right:1px solid var(--line)}
        .ldp-tlhcal{position:relative;flex:1;min-width:0}
        .ldp-tlmon{position:absolute;top:7px;padding-left:6px;font-size:13px;font-weight:600;color:var(--muted)}
        .ldp-tlday{position:absolute;bottom:6px;transform:translateX(-50%);font-size:12px;color:var(--faint)}
        .ldp-tltodaylab{position:absolute;top:0;z-index:3;transform:translateX(-50%);padding:2px 7px;border-radius:0 0 6px 6px;
          background:var(--brand-d);color:var(--brand-ink);font-size:12px;font-weight:600}
        /* stable gutter so the rows keep the header's width whether or not they scroll --
           otherwise the scrollbar re-introduces the same misregistration */
        .ldp-tlbody{max-height:calc(100vh - var(--pg-chrome, 360px));overflow-y:auto;scrollbar-gutter:stable}
        .ldp-tlrows{position:relative}
        /* one rule per week, drawn ONCE behind every row on the calendar track (it starts after the
           262px label column); the bars sit above it */
        .ldp-tlweeks{position:absolute;top:0;bottom:0;left:262px;right:0;pointer-events:none}
        .ldp-tlweeks i{position:absolute;top:0;bottom:0;width:1px;background:var(--line)}
        .ldp-tlrow{display:flex;min-height:46px;border-bottom:1px solid var(--line);cursor:pointer}
        .ldp-tlrow:last-child{border-bottom:0}
        .ldp-tlrow:hover{background:var(--panel-2)}
        .ldp-tlrow.on{background:var(--brand-glow)}
        .ldp-tllab{display:flex;align-items:center;gap:9px;width:262px;flex:0 0 262px;padding:0 12px;border-right:1px solid var(--line)}
        .ldp-tlmk{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:20px}
        .ldp-tlmk.s::before{content:"";width:12px;height:12px;border-radius:2px;background:var(--purple);transform:rotate(45deg)}
        .ldp-tlmk.r::before{content:"";width:18px;height:12px;border-radius:3px;background:var(--blue-bg);
          border:1px solid color-mix(in srgb,var(--blue) 30%,transparent);border-left:3px solid var(--blue)}
        .ldp-tllabtx{flex:1;min-width:0}
        .ldp-tllabtx b{display:block;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:14px;font-weight:600;line-height:1.25}
        .ldp-tlmeta{display:flex;align-items:center;gap:6px;margin-top:2px;overflow:hidden;white-space:nowrap;font-size:12px;
          color:var(--faint);font-variant-numeric:tabular-nums}
        .ldp-tlmeta .rs-pill{flex:0 0 auto;padding:0 7px;line-height:18px}
        .ldp-tlcal{position:relative;flex:1;min-width:0;overflow:hidden}
        .ldp-tlcal.grabbing{cursor:grabbing}
        .ldp-tlband{position:absolute;top:0;bottom:0;z-index:0;background:color-mix(in srgb,var(--brand-d) 5%,transparent)}
        .ldp-tltoday{position:absolute;top:0;bottom:0;z-index:1;width:2px;background:var(--brand-d);opacity:.45}
        .ldp-tlpk{position:absolute;top:50%;z-index:5;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);
          background:var(--panel);border:2px solid var(--faint)}
        .ldp-tltrip{position:absolute;top:50%;z-index:2;height:3px;border-radius:2px;transform:translateY(-50%);background:var(--line-2)}
        .ldp-tltrip.u-amber{background:color-mix(in srgb,var(--warn) 45%,transparent)}
        .ldp-tltrip.u-red{background:color-mix(in srgb,var(--neg) 45%,transparent)}
        .ldp-tldep{position:absolute;top:50%;z-index:3;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%);
          background:var(--faint);border:2px solid var(--panel)}
        .ldp-tldep.u-amber{background:var(--warn)}
        .ldp-tldep.u-red{background:var(--neg)}
        .ldp-tldead{position:absolute;top:50%;z-index:4;display:flex;align-items:center;gap:7px;white-space:nowrap;transform:translate(-8px,-50%)}
        .ldp-tldead.lft{transform:translate(calc(-100% + 8px),-50%)}
        .ldp-tldead.off{transform:translateY(-50%);gap:3px}
        .ldp-tldead .chev{font-size:14px;font-weight:600;color:var(--faint)}
        .ldp-tldead .dot{flex:0 0 auto;width:14px;height:14px;border-radius:3px;background:var(--purple);transform:rotate(45deg);
          box-shadow:0 0 0 3px var(--panel)}
        .ldp-tldead .dt{font-size:13px;font-weight:600;color:var(--purple)}
        .ldp-tldead.u-red .dot{background:var(--neg)}
        .ldp-tldead.u-red .dt{color:var(--neg)}
        .ldp-tlwin{position:absolute;top:50%;z-index:2;display:flex;align-items:center;height:28px;padding:0 10px;overflow:hidden;
          transform:translateY(-50%);border-radius:6px;background:var(--blue-bg);border:1px solid color-mix(in srgb,var(--blue) 28%,transparent);
          border-left:3px solid var(--blue)}
        .ldp-tlwin .dt{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px;font-weight:600;color:var(--blue)}
        .ldp-tlwin.u-amber{background:var(--warn-bg);border-color:color-mix(in srgb,var(--warn) 35%,transparent);border-left-color:var(--warn)}
        .ldp-tlwin.u-amber .dt{color:var(--warn)}
        .ldp-tlwin.u-red{background:var(--neg-bg);border-color:color-mix(in srgb,var(--neg) 30%,transparent);border-left-color:var(--neg)}
        .ldp-tlwin.u-red .dt{color:var(--neg)}
        /* how long the goods have been in our hands: pickup -> today, in the custody colour */
        .ldp-tlhold{position:absolute;top:72%;z-index:1;height:4px;border-radius:2px;opacity:.8}
        .ldp-tlhold.us{background:color-mix(in srgb,var(--pos) 45%,transparent)}
        .ldp-tlhold.car,.ldp-tlhold.cnr{background:color-mix(in srgb,var(--blue) 45%,transparent)}
        .ldp-tlhold.tp{background:color-mix(in srgb,var(--brand-d) 40%,transparent)}
        .ldp-tlhold.unk{background:color-mix(in srgb,var(--neg) 40%,transparent)}
        .ldp-tlhold.no{background:var(--line-2)}
        .ldp-tlheld{position:absolute;top:72%;z-index:2;transform:translate(6px,-45%);font-size:12px;font-weight:600;color:var(--faint);
          white-space:nowrap}
        /* a status pill that is a PLACE, not a verdict (rented / third-party storage, a truck):
           the kit has no such tone, so it is the one the page adds */
        .rs-pill.ldp-place{background:color-mix(in srgb,var(--brand-d) 10%,transparent);color:var(--brand-d)}
      `;
      document.head.appendChild(st);
    }

    // HOW IT'S COUNTED -- the explanations that used to sit on the page itself (the board's
    // footnote, the When header's tooltip, the tile captions, the Routes engine note), kept
    // word for word. Static text, so it is safe to open before the data has loaded.
    function ldpHowHtml() {
      return "<h3>How the board is sorted</h3>"
        + "<p>Click a row for the full details. <b>Sorted by when we must act</b> — soonest deadline first, "
        + "whatever the pickup date. <b>Straight</b> jobs show a committed delivery date (the office records it "
        + "in the FAD field); <b>Regular</b> jobs show the FAD and its window. Data refreshes with the pipeline (hourly).</p>"
        + "<h3>When</h3>"
        + "<p>Deliveries show the FAD and the end of its window; pickups show the committed collection date. "
        + "A depart-by line appears only when the trip runs longer than a day.</p>"
        + "<h3>What to do</h3>"
        + "<p>The single next action for this shipment. A red dot marks <b>Act now</b>, an amber dot <b>Act soon</b>. "
        + "A ⚠ line under the action is a sheet correction the row is flagged for (red when it blocks planning).</p>"
        + "<h3>The tiles</h3>"
        + "<p>The tiles are filters, not decoration: click one to see exactly those rows, click it again to release. "
        + "The counts always describe the whole board.</p>"
        + "<ul><li><b>Act now</b>: overdue or departure passed</li>"
        + "<li><b>Act soon</b>: departure or window is close</li>"
        + "<li><b>Missing data</b>: FAD / timeframe not set</li>"
        + "<li><b>Missing Closing</b>: picked up, but no closing sheet records where it is</li>"
        + "<li><b>Flagged</b>: needs a sheet correction</li>"
        + "<li><b>Carrier Watch</b>: with carriers — confirm deliveries</li></ul>"
        + "<p><b>Delivered</b>, beside the shipment count: confirmed done — tap to review or undo. A job ticked "
        + "delivered in its details leaves the working board and waits there, where the tick can be undone.</p>"
        + "<h3>Routes</h3>"
        + "<p>Engine rules (management’s numbers): ≤1,500 CF combined · every stop pair ≤100 mi · ≤180 min detour · "
        + "windows within 5 days · ≤2.5 extra mi per CF · Straights first · ~11 driving h/day. Accepting converts "
        + "Regulars to Straight and locks the jobs out of future suggestions.</p>"
        + "<h3>Map</h3>"
        + "<p>Shipments at a carrier are hidden from the map (Carrier Watch, not planning). Lines run from the NJ "
        + "base: solid for Straight, dashed for Regular, thin dashed where the collection is still ahead.</p>";
    }

    host.innerHTML = RSC.pageHeadHtml({
        title: "Long Distance Planning", key: "ld-planning",
        sub: "Every undelivered long-distance shipment: where it is, when it has to move, and what to do next.",
        actions: [{ html: '<button type="button" class="rs-btn" id="ldpCsv" title="Export the current board to CSV">Export CSV</button>' }],
        how: ldpHowHtml })
      + '<div id="ldpBody">' + RSC.loadingHtml("Long Distance Planning", "Loading shipments…") + "</div>"
      + `<div class="ldp-scrim" id="ldpScrim"></div>
      <aside class="ldp-drawer" id="ldpDrawer" aria-label="Shipment detail"></aside>
      <aside class="ldp-rpanel" id="ldpRPanel" aria-label="Route map"></aside>
      <div class="ldp-ask" id="ldpAsk" role="alertdialog">
        <div class="ldp-askbox">
          <div class="ldp-asktxt" id="ldpAskTxt"></div>
          <div class="ldp-askbtns">
            <button type="button" class="rs-btn" id="ldpAskNo">Cancel</button>
            <button type="button" class="rs-btn pri" id="ldpAskYes">Confirm</button>
          </div>
        </div>
      </div>`;

    // S survives on window.__LDP across page visits, but the drawer DOM does not — a
    // persisted S.sel would paint a highlighted row whose first click closes a drawer
    // that is not open. Selection resets per visit.
    // No trip-day figure on the sheet means assume ONE day (Tornike 2026-07-28: "i was wrong
  // about havign 2 as a default - make it 1. 2 is too high"). The depart-by date has to exist
  // either way, and over-estimating the drive pulls it forward and cries wolf.
  var TRIP_DEFAULT = 1;
  // 0 in the sheet means "not filled in", not "a zero-day drive" -- it printed "0d trip" and
  // collapsed depart-by onto the delivery date itself.
  // "PA 15317" style, matching how every other destination on the board is written.
  function stateZip(addr, st) {
    var a = String(addr || "");
    // The zip is the one BESIDE the state, never the first 5-digit run (that is usually the
    // street number: "12345 Biscayne Blvd, Miami, FL 33181"). The separator between state and
    // zip may be a space OR a comma -- "Georgetown, DE, 19947" and "Bridgeport, CT 06606" both
    // occur in the calendar descriptions.
    var m = a.match(/(?:^|[\s,])([A-Z]{2})[\s,]+(\d{5})(?:-\d{4})?(?!\d)/);
    var zip = m ? m[2] : ((a.match(/(\d{5})(?:-\d{4})?\s*(?:,?\s*USA?\.?)?\s*$/) || [])[1] || "");
    var stm = (m && m[1]) || String(st || "").trim();
    return ((stm || "") + " " + zip).trim() || String(st || "").trim() || "";
  }


  // ROUTE, as Tornike defines it: once we HAVE the goods, "from" is where they physically
  // are (our storage / the carrier), not the customer's old address -- that address stops
  // being actionable the moment the truck leaves. Until pickup, "from" is the pickup address
  // and the customer's delivery address is shown separately as a not-yet-final destination.
  function routeOf(r) {
    var picked = String(r["Possession"] || "").toLowerCase().indexOf("not picked up") < 0
              && String(r["Possession"] || "").trim() !== "";
    var here = String(r["Location"] || "").trim();
    var detail = String(r["Location Detail"] || "").trim();
    var dest = stateZip(r["Moving To"], r["Delivery State"]);
    if (picked && here && here !== "Unknown" && here !== "Not collected") {
      // same resolved place the board's "Departing from" shows -- our depot's real address,
      // the rented unit's full address, or the carrier -- not just the bucket name
      var d = departFrom(r);
      // `|| detail` would resurrect the very line departFrom() just suppressed as an echo
      return { from: d.text || here, fromSub: d.text ? (d.sub || d.addr || "") : detail,
               to: dest, toLabel: "Delivering to", firm: true };
    }
    var raw = String(r["Moving From"] || "").trim();
    return { from: stateZip(raw) || raw || "—", fromSub: stateZip(raw) ? raw : "",
             to: dest, toLabel: "Delivery location", firm: false };
  }

  // Our own depot. The sheet just says "Our Storage" / "boxes Space O, 44" -- a driver needs
  // the actual address (Tornike 2026-07-28).
  var OUR_STORAGE_ADDR = "3212 Shafto Rd unit 3, Tinton Falls, NJ 07753, United States";

  // WHERE THE DELIVERY LEG STARTS. Empty while the goods are still with the customer: that leg
  // is a PICKUP and its origin is the customer's own address. Once we hold them, this is the
  // concrete place the truck loads from -- our depot's real address, the rented unit's full
  // address, or the carrier holding it.
  // A job we have not collected yet has no "departing from" yet — what the dispatcher
    // needs is WHICH DEPOT to send the truck from, which the base picker already worked
    // out (shortest round trip). Show it there (Tornike 2026-07-29).
    function departFrom(r) {
      if (custKey(r) === "no" && r["Base"])
        return { label: "Base " + r["Base"],
                 addr: "send the truck from here \u00b7 " + (r["Base Zip"] || ""), base: true };
      return departFrom0(r);
    }
    function departFrom0(r) {
    var loc = String(r["Location"] || "").trim();
    var det = String(r["Location Detail"] || "").trim();
    var carrier = String(r["Carrier Driver"] || "").trim();
    if (!loc || loc === "Not collected") return { text: "", sub: "" };
    if (loc === "Unknown") return { text: "", sub: "", unknown: true };
    // the bucket name IS the useful label here -- the full depot address made the column
    // enormous for no gain, and it is one click away in the drawer (Tornike 2026-07-29)
    if (loc === "Our Storage") return { text: "Our Storage", sub: "", addr: OUR_STORAGE_ADDR };
    if (loc === "With carrier" || carrier) {
      var nm = carrier || "Carrier";
      return { text: nm, sub: (det && det.toLowerCase().indexOf(nm.toLowerCase()) < 0) ? det : "" };
    }
    // don't echo the bucket under the address when the address already says it
    // ("Bacho's Storage" + a "Storage" subtitle read as a stutter)
    // don't echo the bucket under the address when the address already conveys it -- a
    // "Rented Storage" subtitle under "rented public storage, 2629 Brunswick Ave" is noise
    if (det) {
      var dl = det.toLowerCase(), ll = String(loc).toLowerCase();
      var echo = dl.indexOf(ll) >= 0 || (/storage/.test(ll) && /storage/.test(dl));
      // a storage bucket shows its NAME; the concrete address is drawer material
      if (/storage/i.test(loc)) return { text: loc, sub: "", addr: det };
      var sz = stateZip(det) || ((det.match(/(?:^|[\s,])([A-Z]{2})(?:[\s,]|$)/) || [])[1] || "");
      return sz ? { text: sz, sub: "", addr: det } : { text: det, sub: "", addr: "" };
    }
    return { text: loc, sub: "" };
  }
  function departCellFrom(r) {
    var d = departFrom(r);
    // we HAVE the goods but nothing records where -- that is a missing closing, not a pickup
    if (d.unknown) return '<span class="ldp-nodate" title="We hold this shipment but no closing sheet records where it is">no closing — unknown</span>';
    if (!d.text) return '<span class="ldp-nodate">picking up</span>';
    return '<span class="ldp-from">' + esc(d.text) + "</span>"
      + (d.sub ? '<div class="ldp-sub">' + esc(d.sub) + "</div>" : "");
  }
  function stageOf(r) {
    return (String(r["Possession"] || "").toLowerCase().indexOf("not picked up") >= 0
      || String(r["Location"] || "") === "Not collected") ? "Pickup" : "Delivery";
  }
  // ROUTE STATUS chip -- legacy's second dimension. "Not Routed" and the at-carrier
  // dash stay silent on the board (noise); the drawer always states it in full.
  // the states we actually keep a depot in — filled from the live bases table, with the
  // legacy OUR_STATES as the fallback until it loads
  var HOME_STATES = ["NJ", "PA", "NY", "DE", "CT", "MA"];
  function stOf(addr, fallback) {
    return String(fallback || "").trim().toUpperCase()
        || (String(addr || "").match(/(?:^|[\s,])([A-Z]{2})[\s,]+\d{5}/) || [])[1] || "";
  }
  // A truck that runs OUT OF our base states comes home empty whichever end is far: a
  // pickup in Ohio is as much a backhaul opportunity as a delivery in Florida
  // (Tornike 2026-07-29 — was delivery-only).
  function isBackhaul(r) {
    if (!isStraight(r)) return false;
    var to = stOf(r["Moving To"], r["Delivery State"]);
    var from = stOf(r["Moving From"], "");
    var out = function (st) { return st && HOME_STATES.indexOf(st) < 0; };
    return out(to) || out(from);
  }
  function bhFarEnd(r) {
    var to = stOf(r["Moving To"], r["Delivery State"]);
    return (to && HOME_STATES.indexOf(to) < 0) ? (r["Moving To"] || to)
         : (r["Moving From"] || stOf(r["Moving From"], ""));
  }
  // the legacy bhMsg wording, near-verbatim
  function bhMsg(r) {
    var dest = String(bhFarEnd(r) || r["Moving To"] || r["Delivery State"] || "the destination");
    var when = r["FAD"] ? fmtD(r["FAD"]) : "soon";
    var cf = Math.round(+r["CF"] || 0);
    return "Hi - we have a truck delivering to " + dest + " around " + when
      + ", returning empty afterward (~" + cf + " cf of space). Looking for backhaul cargo "
      + "heading back toward NJ/PA/NY/DE. Any leads? - Zip To Zip";
  }
  function routeChip(r) {
    var v = String(r["Route Status"] || "");
    if (v === "Over truck (carrier)")
      return "";   // OVER TRUCK chip removed (Tornike 2026-07-29); Route Status keeps the value
    if (v === "Accepted Route")
      return ' <span class="rs-pill ok" title="Locked into an accepted route">Routed</span>';
    if (v === "Route Candidate")
      return "";   // CANDIDATE chip removed (Tornike 2026-07-29) — Route Status still filters
    return "";
  }
  function backhaulChip(r) {
    return isBackhaul(r)
      ? ' <span class="ldp-rt bh" title="Straight delivery outside NJ/PA/NY/DE/CT/MA \u2014 the truck returns empty. Open the job for the outreach draft.">Backhaul</span>'
      : "";
  }
  function stageChip(r) {
    var st = stageOf(r);
    return '<span class="ldp-stage ' + (st === "Pickup" ? "p" : "d") + '">' + st + "</span>";
  }

  function tripDays(r) { var v = +(r["Trip Days"] || 0); return v > 0 ? v : TRIP_DEFAULT; }
  // only worth printing when someone actually set it; the assumed 1-day default was
  // repeating on nearly every row and told the reader nothing
  function tripTxt(r) { return +(r["Trip Days"] || 0) > 0 ? r["Trip Days"] + "d trip" : ""; }
  var S = window.__LDP || (window.__LDP = { view: "board", q: "", co: "", loc: "", sel: null, tlStart: null, tlSeg: "", kpi: "", ms: { type: [], cust: [] } });
  if (!S.ms) S.ms = { type: [], cust: [] };   // older cached state from a previous version
  if (!S.ms.route) S.ms.route = [];
    S.sel = null;

    var rows;
    try { rows = await RS.load("fct_ld_planning"); }
    catch (e) { document.getElementById("ldpBody").innerHTML = '<div class="rs-loading">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    // The Slack custody log — optional: the board must never die with the channel read.
    var CUSTODY = [];
    try { CUSTODY = await RS.load("ldp_custody"); } catch (e) { CUSTODY = []; }
    var custSlug = function (x) { return String(x || "").toLowerCase().replace(/[^a-z0-9]/g, ""); };
    // index by job code, request number, and customer slug — a drawer looks up in that order
    var CUST_BY = { code: {}, req: {}, name: {} };
    CUSTODY.forEach(function (c) {
      if (c["Job Code"]) (CUST_BY.code[String(c["Job Code"]).toUpperCase()] =
        CUST_BY.code[String(c["Job Code"]).toUpperCase()] || []).push(c);
      if (c["Request No"]) (CUST_BY.req[String(c["Request No"])] =
        CUST_BY.req[String(c["Request No"])] || []).push(c);
      var k = custSlug(c.Customer);
      if (k) (CUST_BY.name[k] = CUST_BY.name[k] || []).push(c);
    });
    function custodyOf(r) {
      var hit = CUST_BY.code[String(r["Job Code"] || "").toUpperCase()]
        || CUST_BY.req[String(r["Request #"] || "")]
        || CUST_BY.name[custSlug(r["Customer"])] || [];
      return hit.slice().sort(function (a, b) {
        return String(b.TS || "").localeCompare(String(a.TS || ""));
      });
    }

    // ---- the PORTAL's manual planning fields (trip days / final FAD / final CF) ----
    // The portal is the source of truth for these (his call 2026-07-21). The pipeline
    // bakes current entries into fct_ld_planning hourly; this live overlay applies
    // anything entered SINCE, so a save shows its effect immediately.
    var LDP_ENT = {};
    // Manual values live at LD-ROW grain (a multi-trip job has one row per trip and they
    // share a Request #). A legacy entry saved before that fix has an empty sheet_row and
    // still applies to the whole job.
    function entFor(co, rq, sr) {
      var job = LDP_ENT[co + "|" + rq + "|"] || {};
      var row = LDP_ENT[co + "|" + rq + "|" + (sr || "")] || {};
      var out = {};
      Object.keys(job).forEach(function (k) { out[k] = job[k]; });
      Object.keys(row).forEach(function (k) { out[k] = row[k]; });
      return out;
    }
    async function loadEntries() {
      try {
        var j = await fetch(ZTZ.API + "/api/_ldp", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
        LDP_ENT = {};
        (j.entries || []).forEach(function (e) {
          var k = e.company + "|" + e.request_no + "|" + (e.sheet_row || "");
          (LDP_ENT[k] = LDP_ENT[k] || {})[e.field] = e;
        });
      } catch (e) {}
    }
    function daysBetween2(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5); }
    function isoAdd(iso, n) { var d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); }
    function fmtShort(iso) { var d = new Date(String(iso).slice(0, 10) + "T12:00:00"); return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }
    // The LD SHEET is the system of record for planning values (Tornike 2026-07-28: "whatever
    // is written there - thats the final FAD"), and the portal inputs that used to write these
    // are gone. Overlaying old saved entries on top of the mart made a STALE portal value beat
    // the sheet -- Mary Head's sheet FAD of 30 Aug was being overridden back to the 30 Apr
    // pickup date by an entry saved months ago. The mart's row is now shown as-is.
    function overlaid() { return rows; }

    function fmtD(v) {
      if (!v) return "—";
      var d = new Date(String(v).slice(0, 10) + "T12:00:00");
      return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    var todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    function daysBetween(aIso, bIso) { return Math.round((new Date(bIso + "T12:00:00") - new Date(aIso + "T12:00:00")) / 864e5); }

    // the location bucket as a kit status pill (drawer header); same buckets, same tones as before
    function locPill(r) {
      var l = String(r["Location"] || "Unknown");
      var tone = l === "At Carrier" ? "bad"
        : /Our Storage|Other Storage|^Storage$/.test(l) ? "ok"
        : l === "Rented Storage" ? "info"
        : /Truck|Trailer/.test(l) ? "ldp-place"
        : l === "Left Storage" ? "ldp-place" : "mute";
      return '<span class="rs-pill ' + tone + '">' + esc(l) + "</span>";
    }
    function windowTxt(r) {
      var fad = r["FAD"], end = r["Window End"];
      if (!fad && !end) return "—";
      if (fad && end && String(fad) === String(end)) return fmtD(fad);
      return (fad ? fmtD(fad) : "…") + " – " + (end ? fmtD(end) : "open");
    }
    // STRAIGHT HAS NO FAD (Tornike 2026-07-27) — the office stores the committed DELIVERY
    // DATE in the FAD field, and the calendar does the same. Same value, different meaning,
    // so it must not be labelled "FAD" on a straight job.
    function isStraight(r) { return String(r["Type"] || "") === "Straight"; }
    // Straight = one committed date; Regular = a window. Different planning shapes, so they
    // get different chips rather than the same grey word.
    function typeChip(r) {
      var st = isStraight(r);
      return '<span class="ldp-ty ' + (st ? "s" : "r") + '" title="'
        + (st ? "Straight — one committed delivery date" : "Regular — delivered inside a window")
        + '">' + (st ? "Straight" : "Regular") + "</span>";
    }
    function dateLabel(r) { return isStraight(r) ? "Delivery date" : "FAD"; }
    // WHEN DELIVERY SHOULD BEGIN — the number this board exists to protect (his words:
    // "we should not miss when the delivery should begin"). A Regular job becomes
    // deliverable ON its FAD and its window closes later; a Straight job is one committed
    // date. Either way the answer is a date plus how far away it is, so it is drawn as one
    // strong date with a countdown beneath rather than buried in prose.
    function dayDiff(iso) {
      if (!iso) return null;
      var a = new Date(String(iso).slice(0, 10) + "T00:00:00");
      var b = new Date(); b.setHours(0, 0, 0, 0);
      return Math.round((a - b) / 86400000);
    }
    // WHERE IT IS — custody pill with the concrete place under it. Custody and Location
    // were two columns saying overlapping things ("With carrier" | "At Carrier");
    // one column, two levels of detail.
    // (ZTZ-80: the unused departCell / beginCell / windowCell / dueBadge renderers went with
    // the classes only they drew; no board column called them.)
    function whereCell(r) {
      var det = String(r["Location Detail"] || "");
      var loc = String(r["Location"] || "");
      var sub = [];
      // the pill already carries the custody word; repeating it underneath read as
      // "Rented Storage / Rented Storage" once the two vocabularies were aligned
      var poss = String(r["Possession"] || "").trim();
      if (loc && loc !== "Unknown" && loc !== "Not collected"
          && loc.toLowerCase() !== poss.toLowerCase()) sub.push(loc);
      // the concrete address now lives in "Departing from" IN FULL -- this cell keeps the
      // custody pill and the bucket name so the same address is not printed twice
      return possPill(r)
        + (sub.length ? '<div class="ldp-sub ldp-whsub">' + esc(sub.join(" \u00b7 ")) + "</div>" : "");
    }
    // WHEN — one answer to "when does this have to happen", stage-aware. Key date, Depart by
    // and Status told overlapping halves of this ("closed 24d ago" and "Act now / delivery
    // window expired" were the same sentence twice), so they collapse into two columns:
    // WHEN (this) and WHAT TO DO (the Do line the mart already computes).
    // "Jun 25 -> Jul 5" reads in one glance; the year twice does not
    function fmtDShort(d) { return d ? String(fmtD(d)).replace(/,\s*\d{4}$/, "") : "\u2014"; }
    function whenCell(r) {
      var dep = r["Depart By"], trip = tripDays(r);
      // depart-by only earns a line when it is NOT simply "the day before"
      var depSub = (dep && trip > 1)
        ? '<div class="ldp-sub">leave by ' + fmtD(dep) + " \u00b7 " + trip + "d trip</div>" : "";
      if (stageOf(r) === "Pickup") {
        var pd = r["Pickup Event Date"] || r["Pickup Date"];
        if (!pd) return '<span class="ldp-nodate">no pickup date</span>';
        var pn = dayDiff(pd);
        return '<div class="ldp-wlab">Collect</div><b class="ldp-dt">' + fmtD(pd) + "</b>"
          + '<div class="ldp-when ' + (pn < 0 ? "late" : pn <= 2 ? "soon" : "ok") + '">'
          + (pn > 0 ? "in " + pn + "d" : pn === 0 ? "today" : Math.abs(pn) + "d overdue")
          + "</div>" + depSub;
      }
      var st = isStraight(r), fad = r["FAD"], end = r["Window End"];
      if (!fad && !end) return '<span class="ldp-nodate">no date set</span>';
      var head = (st || !end || String(end) === String(fad))
        ? fmtD(fad || end)
        : fmtDShort(fad) + ' <span class="ldp-arrow">\u2013</span> ' + fmtDShort(end);
      var dl = st ? fad : (end || fad), n2 = dayDiff(dl), sub, cls;
      if (n2 > 0) { sub = "in " + n2 + "d"; cls = n2 <= 3 ? "soon" : "ok"; }
      else if (n2 === 0) { sub = "today"; cls = "soon"; }
      else { sub = Math.abs(n2) + "d late"; cls = "late"; }
      return '<div class="ldp-wlab">Deliver</div><b class="ldp-dt">' + head + "</b>"
        + '<div class="ldp-when ' + cls + '">' + sub + "</div>" + depSub;
    }
    // WHAT TO DO — the mart's own imperative, which was buried in the drawer.
    function carrierChip(r) {
      return needCarrierZip(r)
        ? ' <span class="rs-pill bad" title="A carrier is assigned but its location is unknown — open the job and enter the carrier zip">Carrier zip?</span>'
        : "";
    }
    // ONE urgency signal per row (ZTZ-80): the action text stays ink, and a dot in front of it
    // says Act now (red) / Act soon (amber). The red row edge and red text it replaces said the
    // same thing three times over alongside the status pill.
    function todoCell(r) {
      var u = String(r["Urgency"] || "");
      var cls = u === "Act now" ? "late" : u === "Act soon" ? "soon"
              : u === "Missing data" ? "miss" : "ok";
      var dot = u === "Act now" ? '<span class="ldp-udot now" role="img" aria-label="Act now" title="Act now"></span>'
              : u === "Act soon" ? '<span class="ldp-udot soon" role="img" aria-label="Act soon" title="Act soon"></span>' : "";
      return '<div class="ldp-todo ' + cls + '">' + dot + esc(String(r["Do"] || r["Urgency Reason"] || "—")) + "</div>"
        + (r["Data Issue"]
            ? '<div class="ldp-sub"><span class="ldp-flagdot'
              + (String(r["Issue Kind"]) === "blocking" ? " blk" : "") + '" title="Flagged: needs a sheet correction">⚠</span> '
              + esc(String(r["Data Issue"])) + "</div>" : "");
    }
    // "Do we physically have it, and did we collect it?"
    // Custody in one token, used for pills, holding bars and the filter chips.
    // a Regular with a carrier but no carrier zip: we cannot plan the truck's leg at all
    function needCarrierZip(r) {
      return !isStraight(r) && String(r["Carrier Driver"] || "").trim()
             && !String(r["Carrier Location"] || "").trim();
    }
    // DELIVERED (his ask 2026-08-17): the portal tick parks a job behind the
    // Delivered KPI card — visible, undoable, off the working board
    var DLV_PORTAL = "Delivered — confirmed on the portal";
    function isDelivered(r) { return String(r["Delivery Status"] || "") === DLV_PORTAL; }
    // mirror of the bridge's LDP_LOCATIONS — the buckets the mart understands
    var LDP_LOCATIONS = ["Our Storage", "Rented Storage", "Other Storage", "On Our Truck",
                         "At Carrier", "In Transit", "Delivered Area", "Unknown"];
    function custKey(r) {
      var p = String(r["Possession"] || "");
      return p === "With us" ? "us" : p === "With carrier" ? "car"
           : p === "Contracts Not Received" ? "cnr"
           : (p === "Rented Storage" || p === "Third-party storage") ? "tp"
           : p === "Not picked up yet" ? "no" : "unk";
    }
    var CUST_LABEL = { us: "With us", car: "Carrier", tp: "Storage", no: "To collect",
                       cnr: "Contracts Not Received", unk: "Missing Closing" };
    // custody as a kit status pill; the tone per custody key (also the timeline's chip)
    var CUST_TONE = { us: "ok", car: "info", cnr: "info", tp: "ldp-place", no: "mute", unk: "bad" };
    function possPill(r) {
      var p = String(r["Possession"] || "—");
      return '<span class="rs-pill ' + CUST_TONE[custKey(r)] + ' ldp-pos">' + esc(p) + "</span>";
    }
    // The date the row is actually asking us to act on: dispatch deadline first, then the
    // delivery deadline. This is the sort key — his rule is "soonest thing to act on wins",
    // regardless of how old the pickup is.
    function actDate(r) {
      var d = r["Depart By"] ? String(r["Depart By"]).slice(0, 10)
           : r["Window End"] ? String(r["Window End"]).slice(0, 10)
           : r["FAD"] ? String(r["FAD"]).slice(0, 10) : "";
      // a job we have NOT collected yet acts on its pickup date first -- a today's-pickup
      // row was sorting LAST because only the delivery-side deadline was considered
      if (custKey(r) === "no" && r["Pickup Date"]) {
        var p = String(r["Pickup Date"]).slice(0, 10);
        if (!d || p < d) return p;
      }
      return d;
    }

    function paint() {
      // ONE BOARD (Tornike 2026-07-27: "delete the data cleanup thing - that cleanup should
      // be handled by the main page"). Flagged rows used to be exiled to a second tab, which
      // is how a loaded truck went unnoticed: a data problem is a reason to look HARDER at a
      // shipment, not to hide it. The flag now rides along on the row itself.
      var allBase0 = overlaid();
      // delivered rows leave the working board but stay one card away — the Delivered
      // KPI shows the archive, where the tick can be undone (his ask 2026-08-17)
      var dlvRows = allBase0.filter(isDelivered);
      var allBase = allBase0.filter(function (r) { return !isDelivered(r); });
      var all = S.kpi === "dlv" ? dlvRows : allBase;
      var flagged = allBase.filter(function (r) { return !!r["Data Issue"]; });
      var actNow = allBase.filter(function (r) { return r["Urgency"] === "Act now"; }).length;
      var actSoon = allBase.filter(function (r) { return r["Urgency"] === "Act soon"; }).length;
      var noWin = allBase.filter(function (r) { return r["Urgency"] === "Missing data"; }).length;
      var held = allBase.filter(function (r) { return custKey(r) === "unk"; }).length;

      // KPI cards are FILTERS, not decoration — click one to see exactly those rows;
      // click again to release. The counts always describe the whole board.
      // ZTZ-80: the kit's tiles, at most six. The six ACTION buckets stay tiles; Delivered is an
      // archive, not an action, so it moved beside the shipment count as a link that does the
      // very same thing (S.kpi = "dlv", click again to go back).
      var kpiDefs = [
        ["now",  "neg",  actNow,         "Act now",          "overdue or departure passed"],
        ["soon", "warn", actSoon,        "Act soon",         "departure or window is close"],
        ["miss", "",     noWin,          "Missing data",     "FAD / timeframe not set"],
        ["unk",  "",     held,           "Missing Closing",  "picked up, but no closing sheet records where it is"],
        ["flag", "",     flagged.length, "Flagged",          "needs a sheet correction"],
        ["carw", "",     allBase.filter(function (r) { return custKey(r) === "car"; }).length,
                         "Carrier Watch",    "with carriers — confirm deliveries"],
      ];
      // the tiles carry no attributes of their own; paint() tags them with data-kpi after the
      // mount (S._kpiKeys, in order), so wire()'s [data-kpi] handler binds them as before
      var kp = RSC.kpisHtml(kpiDefs.map(function (k) {
        return { label: k[3], value: String(k[2]), sub: k[4], tone: k[1],
                 title: S.kpi === k[0] ? "Showing only these — click again for the whole board"
                                       : "Click to show only these rows" };
      }), "ldp-kpis");
      S._kpiKeys = kpiDefs.map(function (k) { return k[0]; });
      var kpiPass = function (r) {
        if (!S.kpi) return true;
        if (S.kpi === "now") return r["Urgency"] === "Act now";
        if (S.kpi === "soon") return r["Urgency"] === "Act soon";
        if (S.kpi === "miss") return r["Urgency"] === "Missing data";
        if (S.kpi === "unk") return custKey(r) === "unk";
        if (S.kpi === "carw") return custKey(r) === "car";
        if (S.kpi === "dlv") return true;   // `all` IS the delivered set in that view
        return !!r["Data Issue"];
      };
      var segPass = function (r) {
        var k = S.tlSeg;
        if (!k) return true;
        if (k === "straight") return isStraight(r);
        if (k === "regular") return !isStraight(r);
        return custKey(r) === k;
      };
      // multi-select: empty dimension = no constraint; otherwise the row must match ONE of the
      // ticked values in EVERY constrained dimension
      var msPass = function (r) {
        var t = S.ms.type || [], c = S.ms.cust || [], rt = S.ms.route || [];
        if (t.length && t.indexOf(isStraight(r) ? "straight" : "regular") < 0) return false;
        if (c.length && c.indexOf(custKey(r)) < 0) return false;
        if (rt.length && rt.indexOf(routeKey(r)) < 0) return false;
        return true;
      };
      var segsAll = [["", "All"], ["straight", "Straight"], ["regular", "Regular"],
                     ["no", "To collect"], ["us", "With us"], ["tp", "Storage"],
                     ["car", "Carrier"], ["unk", "Missing Closing"]];
      // MULTI-SELECT filters (Tornike 2026-07-28: "i need to have literal filters with multi
      // select options, similar to what we have for foreman in money flow"). One-at-a-time chips
      // could not express "Straight AND Regular" or "with us OR at a carrier".
      function routeKey(r) {
        var v = String(r["Route Status"] || "");
        return v === "Route Candidate" ? "cand" : v === "Accepted Route" ? "acc"
             : v === "Over truck (carrier)" ? "over" : v === "Not Routed" ? "not" : "";
      }
      function msCount(dim, key) {
        return allBase.filter(function (r) {
          if (dim === "type") return key === "straight" ? isStraight(r) : !isStraight(r);
          if (dim === "route") return routeKey(r) === key;
          return custKey(r) === key;
        }).length;
      }
      // ZTZ-80: Type / Status / Routing are the kit's RSC.localMulti (same checkboxes, same
      // counts, state still on S.ms) -- wire() mounts them; the option lists ride on S
      var msOpts = function (dim, opts) {
        return opts.map(function (o) { return { v: o[0], l: o[1], n: msCount(dim, o[0]) }; });
      };
      S._ms = {
        type: msOpts("type", [["straight", "Straight"], ["regular", "Regular"]]),
        cust: msOpts("cust", [["no", "To collect"], ["us", "With us"], ["tp", "Storage"],
                              ["car", "Carrier"], ["cnr", "Contracts Not Received"],
                              ["unk", "Missing Closing"]]),
        route: msOpts("route", [["cand", "Route Candidate"], ["acc", "Accepted Route"],
                                ["over", "Over truck"], ["not", "Not Routed"]]),
      };
      var chips = "";   // Type/Status/Routing live in the one filter bar
      var cur = all.filter(kpiPass).filter(segPass).filter(msPass);
      if (S.co) cur = cur.filter(function (r) { return String(r["Company"]) === S.co; });
      if (S.loc) cur = cur.filter(function (r) { return String(r["Location"]) === S.loc; });
      var q = S.q.trim().toLowerCase();
      if (q) cur = cur.filter(function (r) {
        return String(r["Customer"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Request #"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Job Code"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Sticker"] || "").toLowerCase().indexOf(q) >= 0;
      });
      // SORTED BY WHEN WE MUST ACT, soonest first (his rule 2026-07-27): "if a job had
      // pickup last year and we should deliver in 5 days, and 5 days is the smallest there
      // is, it should be first". So the pickup age is irrelevant — only the next deadline
      // counts. Rows with no deadline at all cannot be ordered and go last.
      cur.sort(function (a, b) {
        var da = actDate(a), db = actDate(b);
        if (!da && !db) return String(a["Pickup Date"]) < String(b["Pickup Date"]) ? -1 : 1;
        if (!da) return 1;
        if (!db) return -1;
        if (da !== db) return da < db ? -1 : 1;
        return String(a["Pickup Date"]) < String(b["Pickup Date"]) ? -1 : 1;
      });

      var cos = {}; var locs = {};
      all.forEach(function (r) { cos[r["Company"]] = 1; locs[r["Location"]] = 1; });
      // wire() is a different scope — hand it the option lists for the localSelect mounts
      S._cos = Object.keys(cos).sort(); S._locs = Object.keys(locs).sort();
      // THE PAGE STANDARD ORDER (ZTZ-80): underline tabs for the four views, then ONE filter row
      // of kit controls -- search, Company, Location, Type, Status, Routing (+ the kit's Hide
      // filters toggle) -- with a Clear that only appears when something is filtering, and the
      // shipment count + the Delivered archive on the right. CSV moved up into the page head.
      // Routing counts too (his pick 13 Nov: Clear was missing when only Routing was set, though it reset it)
      var anyF = !!(S.q || S.co || S.loc || S.kpi || S.tlSeg || (S.ms.type || []).length || (S.ms.cust || []).length
        || (S.ms.route || []).length);
      var nRoutes = (function () { var ks = {}; (S._rsug || []).forEach(function (x2) { ks[x2["Route Key"]] = 1; });
        return Object.keys(ks).length; })();
      var tabs = RSC.tabsHtml([{ id: "board", label: "Board" }, { id: "timeline", label: "Timeline" },
                               { id: "routes", label: "Routes", count: nRoutes || null }, { id: "map", label: "Map" }],
                              (S.view === "timeline" || S.view === "routes" || S.view === "map") ? S.view : "board", "ldview");
      var bar = chips + '<div class="ldp-bar">'
        + '<div class="ldp-fbox">'
        +   '<input id="ldpQ" class="rs-inp" aria-label="Search" placeholder="Search customer, request #, job code or sticker" value="' + esc(S.q) + '">'
        // kit mounts (his rule 2026-08-28: no native dropdowns on the portal); wire() mounts
        // RSC.localSelect / RSC.localMulti into these with the values stashed on S above
        +   '<div id="ldpCo"></div>'
        +   '<div id="ldpLoc"></div>'
        +   '<div id="ldpMsType"></div>'
        +   '<div id="ldpMsCust"></div>'
        +   '<div id="ldpMsRoute"></div>'
        +   (anyF ? '<button type="button" class="rs-btn" id="ldpClr">Clear</button>' : "")
        + "</div>"
        + '<span class="ldp-count"><span><b>' + cur.length + "</b> of " + all.length + " shipments</span>"
        +   '<button type="button" class="ldp-lnk" data-kpi="dlv" aria-pressed="' + (S.kpi === "dlv") + '"'
        +     ' title="Delivered: confirmed done — tap to review or undo">'
        +     (S.kpi === "dlv" ? "Back to the working board" : "Delivered: " + dlvRows.length) + "</button></span>"
        + "</div>";

      var urgPill = function (r) {
        var u = String(r["Urgency"] || "");
        var tone = u === "Act now" ? "bad" : u === "Act soon" ? "warn" : "mute";
        return '<span class="rs-pill ' + tone + '">' + esc(u || "—") + "</span>";
      };
      // PICKUP / DELIVERY calendar jobs + the delivery status. A delivery event can EXIST
      // while the goods are still with us - that is exactly what has to be visible.
      // Just a way IN to the event. The dates are already on the board in their own columns,
      // so repeating them here was noise (Tornike 2026-07-29).
      function calChip(url, dt, label, cls) {
        if (!url) return "";
        return '<a class="ldp-evlink ' + cls + '" href="' + esc(url) + '" target="_blank" rel="noopener"'
          + ' title="' + esc("Open the " + label.toLowerCase() + " event" + (dt ? " · " + fmtD(dt) : "")) + '"'
          + ' onclick="event.stopPropagation()">' + label + "</a>";
      }
      // drawer variant: label + date ARE wanted there (the board's chips carry neither)
      function calLink(url, dt, label) {
        if (!url) return '<span class="ldp-nolink">No ' + label.replace(" Calendar Event", " event") + "</span>";
        return '<a class="ldp-evlink" href="' + esc(url) + '" target="_blank" rel="noopener"'
          + ' onclick="event.stopPropagation()">' + label.replace(" Calendar Event", "")
          + (dt ? " · " + fmtD(dt) : "") + "</a>";
      }
      function calCell(r) {
        var h = calChip(r["Pickup Event URL"], r["Pickup Event Date"], "Pickup", "pk")
              + calChip(r["Delivery Event URL"], r["Delivery Event Date"], "Delivery", "dl");
        return h || '<span class="ldp-evnone">—</span>';
      }
      // the delivery status's kit pill tone: passed = bad, booked = ok, anything else quiet
      function dlvClass(st) {
        st = String(st || "");
        if (st.indexOf("passed") >= 0) return "bad";
        if (st.indexOf("booked") >= 0) return "ok";
        return "mute";
      }
      function jobsCell(r) {
        // ONE statement per fact. The old cell printed "Delivery not created" AND a
        // "No delivery job yet" pill — the same fact twice on every second row.
        var ds = String(r["Delivery Status"] || "");
        var h = calLink(r["Pickup Event URL"], r["Pickup Event Date"], "Pickup Calendar Event");
        if (r["Delivery Event URL"] || r["Delivery Event Date"]) {
          // a delivery event dated in the FUTURE has a date but the row is still open --
          // it used to be invisible because only the URL branch rendered it
          h += calLink(r["Delivery Event URL"], r["Delivery Event Date"], "Delivery Calendar Event")
            + (ds ? '<span class="rs-pill ' + dlvClass(ds) + '">' + esc(ds) + "</span>" : "");
        } else if (ds === "Pickup scheduled") {
          h += '<span class="rs-pill mute">Pickup scheduled</span>';
        } else {
          h += '<span class="rs-pill mute">No Delivery Calendar Event</span>';
        }
        return '<div class="ldp-jobs">' + h + "</div>";
      }
      // DETAIL DRAWER body. Everything the table no longer shows lives here, in the
      // same right-side overlay pattern the Reviews drawer uses.
      function drawerBody(r) {
        var det = String(r["Location Detail"] || "");
        var kv = function (pairs) {
          return '<dl class="ldp-kv">' + pairs.filter(Boolean).map(function (p) {
            return "<dt>" + p[0] + "</dt><dd>" + p[1] + "</dd>";
          }).join("") + "</dl>";
        };
        var money = function (v) { return v == null ? null : "$" + Number(v).toLocaleString(); };
        // EDIT IN PLACE (his call 2026-08-17: "whatever was calculated by sheet — user
        // should be able to write over it"): the FAD and Timeframe rows ARE the inputs,
        // prefilled with the computed value; a change saves an override that beats the
        // sheet, ↺ removes it. Calendar-only rows (no sheet row yet) stay read-only —
        // the mart cannot re-key their entries after pickup, so offering the editor
        // there would silently discard saves (adversarial review, 2026-08-17).
        var canEd = String(r["Sheet Row"] || "").indexOf("calendar:") !== 0;
        var entHere = entFor(String(r["Company"]), String(r["Request #"]), String(r["Sheet Row"] || ""));
        var hasOv = function (f) { return !!(entHere[f] && entHere[f].value != null); };
        var srcTag = function (s) { return s ? ' <span class="ldp-sub">(' + esc(s) + ")</span>" : ""; };
        var rstLink = function (id) {
          return '<a class="ldp-rst" id="' + id + '" title="Remove the override — the sheet value returns on the next data refresh">Back to sheet</a>';
        };
        // ⭐ THE SAVED OVERRIDE WINS OVER THE COMPUTED VALUE. `r` comes from the mart, which
        // only recomputes on the next pipeline run — up to an hour later. Until then it
        // still holds the SHEET's number even though an override is stored, and rendering
        // `r` here is what made a reload look like the save had been thrown away: the write
        // patches `r` in memory so it looks right immediately, and only a refresh exposes it.
        var ovV = function (f) { return hasOv(f) ? String(entHere[f].value) : null; };
        var fadOv = ovV("fad_override");
        var fadIso = fadOv ? fadOv.slice(0, 10)
                   : (r["FAD"] ? String(r["FAD"]).slice(0, 10) : "");
        var tfOv = ovV("timeframe_override");
        var tfCur = tfOv != null ? tfOv
                  : ((r["Timeframe"] && String(r["Timeframe"]).trim() !== "0")
                     ? String(r["Timeframe"]) : "");
        // Type-aware, exactly as in the table: a Straight job has no FAD — the office keeps
        // the committed DELIVERY DATE in that field, so labelling it "FAD" here would lie.
        var fadCell = canEd
          ? '<input class="rs-inp ldp-cinp" type="date" id="ldpEdFad" data-init="' + esc(fadIso) + '" value="' + esc(fadIso) + '">'
            // no "(sheet)" tag under a value the office typed — that label would be a lie
            + (fadOv ? "" : srcTag(r["FAD Source"]))
            + (hasOv("fad_override") ? rstLink("ldpRstFad") : "")
          : fmtD(r["FAD"]) + srcTag(r["FAD Source"]);
        var tfCell = canEd
          ? '<input class="rs-inp ldp-cinp" id="ldpEdTf" maxlength="120" data-init="' + esc(tfCur) + '" value="' + esc(tfCur)
            + '" placeholder="none — deliver on the FAD">'
            + (hasOv("timeframe_override") ? rstLink("ldpRstTf") : "")
          : (tfCur ? esc(tfCur) : '<span class="ldp-sub">none — deliver on the FAD</span>');
        var delivery = isStraight(r)
          ? [["Delivery date", fadCell], ["Timeframe", tfCell]]
          : [["FAD", fadCell],
             ["Window", windowTxt(r) + (r["Window Note"] ? ' <span class="ldp-sub">' + esc(r["Window Note"]) + "</span>" : "")],
             ["Timeframe", tfCell]];

        return ''
          + (r["Do"] ? '<div class="ldp-dnote"><b>Do:</b> ' + esc(r["Do"]) + "</div>" : "")
          + (needCarrierZip(r)
              ? '<div class="ldp-dissue" style="margin-top:9px">A carrier is assigned ('
                + esc(r["Carrier Driver"]) + ') but we do not know WHERE it takes the goods. '
                + 'Enter the carrier zip below \u2014 the depot and the route are measured to it.</div>'
              : "")
          + (r["Data Issue"] ? '<div class="ldp-dissue' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
              + '" style="margin-top:9px">' + esc(r["Data Issue"]) + "</div>" : "")
          + '<div class="ldp-sec">Calendar jobs</div>' + jobsCell(r)
          + '<div class="ldp-sec">Route</div>'
          + (function () { var rt = routeOf(r); return kv([
                ["From", '<b class="ldp-big">' + esc(rt.from) + "</b>"
                  + (rt.fromSub ? '<div class="ldp-sub">' + esc(rt.fromSub) + "</div>" : "")],
                [rt.toLabel, '<b class="ldp-big">' + esc(rt.to || "—") + "</b>"
                  + (rt.firm ? "" : '<div class="ldp-sub">customer address — not the final drop yet</div>')
                  + (r["Moving To"] && String(r["Moving To"]).replace(/\s+/g, " ") !== rt.to
                       ? '<div class="ldp-sub">' + esc(r["Moving To"]) + "</div>" : "")]]); })()
          + (zipOnly(r["Moving To"])
              ? '<div class="ldp-sec">Journey</div><div class="ldp-jmap ldp-dmap" id="ldpDMap"></div>'
              : "")
          + '<div class="ldp-sec">Delivery</div>'
          + kv(delivery.concat([
                ["Depart by", fmtD(r["Depart By"]) + (tripTxt(r) ? ' <span class="ldp-sub">' + tripTxt(r) + "</span>" : "")]]))
          + (canEd
              ? '<div class="ldp-udlv">'
                + (isDelivered(r)
                    ? '<span class="rs-pill ok">Delivered — confirmed on the portal</span>'
                      + '<button type="button" class="rs-btn" id="ldpUnDlv">Undo — back on the board</button>'
                    : '<button type="button" class="rs-btn pri" id="ldpDlvBtn">This job is delivered</button>'
                      + '<span id="ldpDlvC" style="display:none;font-size:13px">Take it off the working board? '
                      + '<button type="button" class="rs-btn pri" id="ldpDlvYes">Yes, delivered</button> '
                      + '<button type="button" class="rs-btn" id="ldpDlvNo">Cancel</button></span>')
                + "</div>"
              : "")
          + '<div class="ldp-sec">Where it is</div>'
          + (function () { var dfrom = departFrom(r); return kv([
                ["Status", esc(r["Possession"] || "—")],
                // ROUTE above already carries the full address -- printing it again here was
                // the "extra stuff" (Tornike 2026-07-28); this row names the bucket only
                ["Location", (canEd
                    ? (function () {
                        // the stored override first, for the same reason as FAD above:
                        // the mart still holds the pre-edit value until it rebuilds
                        var locCur = ovV("location") != null ? ovV("location")
                                   : String(r["Location"] || "");
                        var noteCur = ovV("location_note") != null ? ovV("location_note") : det;
                        var inL = LDP_LOCATIONS.indexOf(locCur) >= 0;
                        // kit localSelect mount (form:true) — wired where the other editors are.
                        // data-init carries the same "revert to this" value the old select did.
                        return '<div id="ldpEdLoc" data-init="' + esc(inL ? locCur : "") + '"></div>'
                          + ((String(r["Location Source"]) === "portal" || ovV("location") != null)
                             ? rstLink("ldpRstLoc") : "")
                          + '<input class="rs-inp ldp-cinp" id="ldpEdLocN" maxlength="200" style="margin-top:6px" data-init="' + esc(noteCur)
                          + '" placeholder="address / unit / note (optional)" value="' + esc(noteCur) + '">'
                          + (dfrom.addr ? '<div class="ldp-addr">' + esc(dfrom.addr) + "</div>" : "");
                      })()
                    : '<b class="ldp-big">' + esc(r["Location"] || "—") + "</b>"
                      + ((dfrom.addr || det) ? '<div class="ldp-addr">' + esc(dfrom.addr || det) + "</div>" : ""))],
                // Carrier only exists on REGULAR moving -- a Straight job is driven by our own
                // crew, so showing carrier fields there invites a wrong reading (Tornike 2026-07-28).
                // Regular jobs ride with a carrier -- name them, and call the money what it is
                !isStraight(r) ? ["Carrier name", esc(r["Carrier Driver"] || "not assigned yet")] : null,
                // WHERE the carrier holds the goods has no other source, and the base
                // picker needs it -- so this one field is editable on Regular jobs
                !isStraight(r) ? ["Carrier location",
                  '<input class="rs-inp ldp-cinp" id="ldpCarLoc" inputmode="numeric" maxlength="5"'
                  + ' placeholder="5-digit zip where the carrier takes it" value="'
                  + esc(ovV("carrier_location") != null ? ovV("carrier_location")
                        : (r["Carrier Location"] || "")) + '">'
                  + '<button type="button" class="rs-btn" id="ldpCarSave" style="margin-top:7px">Save</button>'
                  + '<span class="ldp-sub" id="ldpCarMsg" style="margin-left:8px"></span>'] : null,
                (!isStraight(r) && r["Total To Carrier"] != null)
                  ? ["Carrier balance", money(r["Total To Carrier"])] : null,
                ["Foreman", r["Foreman"] ? esc(r["Foreman"])
                  : '<span class="ldp-sub">unassigned</span>'],
                ["Base", r["Base"]
                  ? "<b>" + esc(r["Base"]) + "</b> <span class=\"ldp-sub\">" + esc(r["Base Zip"] || "")
                    + " \u00b7 closest depot for this job\u2019s round trip</span>"
                  : '<span class="ldp-sub">no base \u2014 needs a mappable location</span>'],
                (+r["Storage Sold"]) ? ["Storage", "Sales person sold storage on this job"] : null,
                ["Sticker", esc(r["Sticker"] || "—")],
                ["Route status", esc(r["Route Status"] || "—")]]); })()
          + (isBackhaul(r)
              ? '<div class="ldp-sec">Backhaul</div>'
                + '<div class="ldp-sub" style="margin-bottom:6px">This truck comes back empty. Edit the message and send it to your carrier contacts.</div>'
                + '<textarea class="rs-inp ldp-bhtx" id="ldpBhTx" rows="4">' + esc(bhMsg(r)) + "</textarea>"
                + '<div class="ldp-bhrow"><a class="rs-btn pri ldp-bhwa" id="ldpBhWa" target="_blank" rel="noopener">Send on WhatsApp</a>'
                + '<button type="button" class="rs-btn" data-bh="1">Copy</button></div>'
              : "")
          + custodySec(r)
          + (function () {
              // kv() filters out the nulls, so with neither figure present this printed a
              // heading over an empty bordered card. Say there is nothing yet instead.
              var jobPairs = [r["Balance Due"] != null ? ["Balance due", money(r["Balance Due"])] : null,
                              r["CF"] != null ? ["CF", Number(r["CF"]).toLocaleString()] : null];
              return '<div class="ldp-sec">Job</div>'
                + (jobPairs.filter(Boolean).length ? kv(jobPairs)
                   : '<div class="ldp-sub">no closing figures on this job yet</div>');
            })()
          // 2026-08-17 (his ask, round 2): FAD / Timeframe / Location edit IN PLACE —
          // the rows are the inputs, prefilled with computed values, auto-saving on
          // change. overlaid() still applies nothing — the mart plus the optimistic
          // mutations in the editors' wiring are the whole truth.
        ;
      }

      /* The Slack trail: what #long-distance-storage says about this job — the same
       * statements the ops team writes by hand, with their photos as links into Slack.
       * When the sheet and the channel disagree on custody, BOTH are shown; the board
       * surfaces the conflict and reconciles nothing (the sheet stays the record). */
      var CUST_WORD = { rented_storage: "in rented storage", our_warehouse: "in our warehouse",
        carrier: "with a carrier", delivered: "delivered", truck: "in a truck" };
      function custodySec(r) {
        var trail = custodyOf(r);
        if (!trail.length) return "";
        var latest = trail[0];
        // sheet-vs-Slack: compare the board's possession bucket with the channel's word
        var poss = String(r["Possession"] || "").toLowerCase();
        var slackKind = String(latest.Custody || "");
        // COMPATIBLE means no alarm: the sheet's buckets are coarser than the channel's
        // words ("With us" covers both a truck and the warehouse), and a false conflict
        // teaches dispatchers to ignore the banner. Only clearly-incompatible pairs flag.
        var MAPPOSS = { rented_storage: /rent/,
          our_warehouse: /our|warehouse|base|with us/,
          carrier: /carrier/, delivered: /deliver/,
          truck: /truck|picked|with us/ };
        var conflict = poss && MAPPOSS[slackKind] && !MAPPOSS[slackKind].test(poss)
          && !(slackKind === "truck" && !poss);
        var h = '<div class="ldp-sec">Slack custody · ' + trail.length
          + ' post' + (trail.length === 1 ? "" : "s") + "</div>";
        if (conflict) {
          h += '<div class="ldp-dissue" style="margin-top:2px">The sheet says “'
            + esc(r["Possession"]) + '” but the latest Slack post ('
            + fmtD(latest.Posted) + ') says “' + esc(CUST_WORD[slackKind] || slackKind)
            + '” — worth a look; the sheet stays the record.</div>';
        }
        // the heading counts the whole trail; only four render. Say so rather than
        // let the two numbers quietly disagree.
        if (trail.length > 4) h += '<div class="ldp-sub">showing the newest 4 of '
          + trail.length + " posts</div>";
        h += trail.slice(0, 4).map(function (c) {
          var photos = [];
          try { photos = JSON.parse(c.Photos || "[]"); } catch (e2) {}
          var bits = [
            c.Facility ? esc(c.Facility) : "",
            c.Units ? "unit " + esc(c.Units) : "",
            c.Carrier ? "carrier " + esc(c.Carrier) + (c.Rate ? " @ $" + esc(c.Rate) : "")
              + (c.CF ? " · " + esc(c.CF) + " CF" : "") : "",
            (+c.Delivered && c.Custody !== "delivered")
              ? "delivered" + (c["Delivered On"] ? " " + esc(c["Delivered On"]) : "")
              : (c["Delivered On"] ? "on " + esc(c["Delivered On"]) : ""),
            c.Flags ? esc(c.Flags) : "",
          ].filter(Boolean).join(" · ");
          return '<div class="ldp-cst"><span class="ldp-cst-d">' + fmtD(c.Posted) + "</span>"
            + "<span><b>" + esc(CUST_WORD[c.Custody] || c.Custody || "") + "</b>"
            + (bits ? '<span class="ldp-sub"> — ' + bits + "</span>" : "") + "</span>"
            + '<span class="ldp-cst-l">'
            + photos.slice(0, 4).map(function (ph, i) {
                return '<a href="' + esc(ph.link) + '" target="_blank" rel="noopener">Photo ' + (i + 1) + "</a>";
              }).join("")
            + '<a href="' + esc(c.Permalink) + '" target="_blank" rel="noopener" title="Open in Slack">Slack</a>'
            + "</span></div>";
        }).join("");
        return h;
      }

      // The drawer is rendered OUTSIDE the table, so a repaint of the list never destroys
      // a half-filled edit form — and closing it does not re-render the board.
      function wireBackhaul(dr2, r) {
        var tx = dr2.querySelector("#ldpBhTx"), wa = dr2.querySelector("#ldpBhWa");
        if (tx && wa) {
          var upd = function () { wa.href = "https://wa.me/?text=" + encodeURIComponent(tx.value); };
          upd();
          tx.oninput = upd;
        }
        var b = dr2.querySelector("[data-bh]");
        if (!b) return;
        b.onclick = function () {
          var msg = tx ? tx.value : bhMsg(r);
          var done = function () { b.textContent = "Copied"; b.classList.add("done"); };
          // no clipboard API: a kit dialog with the message prefilled and selectable
          var manual = function () { RSC.ask({ title: "Copy the outreach message", value: msg, yes: "Done" }); };
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(msg).then(done, manual);
          } else { manual(); }
        };
      }
      function openDrawer(key) {
        var dr = document.getElementById("ldpDrawer"), sc = document.getElementById("ldpScrim");
        if (!dr || !sc) return;
        // any open/close invalidates in-flight journey-map work: the closed drawer is only
        // visibility:hidden, so isConnected alone cannot tell a late fetch to stand down
        S._dgen = (S._dgen || 0) + 1;
        if (S._dctl) { try { S._dctl.abort(); } catch (e) {} S._dctl = null; }
        S.sel = key;
        host.querySelectorAll("tr.ldp-row, .ldp-tlrow[data-ldk]").forEach(function (tr) {
          tr.classList.toggle("on", tr.getAttribute("data-ldk") === key);
        });
        // the drawer map holds a Leaflet instance (window resize listener) -- destroy it
        // whenever this content is about to be discarded or hidden
        Array.prototype.forEach.call(dr.querySelectorAll(".ldp-jmap"), function (n) {
          if (n._ldmap) { try { n._ldmap.remove(); } catch (e) {} n._ldmap = null; }
        });
        if (!key) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        var r = cur.filter(function (x, i2) { return String(x["Sheet Row"] || i2) === key; })[0];
        if (!r) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        dr.innerHTML =
          '<div class="ldp-dhd"><button type="button" class="x rs-fp-x" id="ldpDx" title="Close" aria-label="Close">&times;</button>'
          + '<div class="ldp-dnm">' + esc(r["Customer"] || "—") + "</div>"
          + '<div class="ldp-dmeta">' + esc(r["Job Code"] ? String(r["Job Code"]).split(",")[0] : "—")
          + " · " + esc(r["Company"] || "") + " · picked up " + fmtD(r["Pickup Date"]) + "</div>"
          + '<div class="ldp-dpills">' + urgPill(r) + possPill(r) + locPill(r) + "</div></div>"
          + '<div class="ldp-dbody">' + drawerBody(r) + "</div>";
        dr.classList.add("show"); sc.classList.add("show");
        wireBackhaul(dr, r);
        (function () {
          var inp = dr.querySelector("#ldpCarLoc"), btn = dr.querySelector("#ldpCarSave");
          var msg = dr.querySelector("#ldpCarMsg");
          if (!inp || !btn) return;
          btn.onclick = function () {
            var val = inp.value.trim();
            btn.disabled = true; msg.textContent = "Saving\u2026";
            fetch(ZTZ.API + "/api/_ldp", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ company: r["Company"], request_no: r["Request #"],
                                     sheet_row: r["Sheet Row"], field: "carrier_location",
                                     value: val || null }) })
              .then(function (res) { return res.json().then(function (j) { return { ok: res.ok, j: j }; }); })
              .then(function (o) {
                btn.disabled = false;
                if (!o.ok || (o.j && o.j.error)) { msg.textContent = (o.j && o.j.error) || "Save failed"; return; }
                msg.textContent = "Saved";
                // DIRECT: the row updates now, no waiting for the next pipeline run
                r["Carrier Location"] = val;
                var k2 = String(r["Company"]) + "|" + String(r["Request #"]) + "|" + String(r["Sheet Row"] || "");
                (LDP_ENT[k2] = LDP_ENT[k2] || {})["carrier_location"] = { field: "carrier_location", value: val };
                paint();
                if (host.__ldpOpen) host.__ldpOpen(S.sel);
              })
              .catch(function (e) { btn.disabled = false; msg.textContent = String(e); });
          };
          inp.onkeydown = function (e) { if (e.key === "Enter") btn.click(); };
        })();
        (function () {
          // in-place editors (his call 2026-08-17): each field saves the moment it
          // changes — type over the computed value, done. ↺ removes the override.
          if (String(r["Sheet Row"] || "").indexOf("calendar:") === 0) return;
          var post = function (field, value) {
            return fetch(ZTZ.API + "/api/_ldp", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ company: r["Company"], request_no: r["Request #"],
                                     sheet_row: r["Sheet Row"], field: field, value: value }) })
              .then(function (res) { return res.json().then(function (j) {
                if (!res.ok || (j && j.error)) throw new Error((j && j.error) || "save failed");
                var k2 = String(r["Company"]) + "|" + String(r["Request #"]) + "|" + String(r["Sheet Row"] || "");
                (LDP_ENT[k2] = LDP_ENT[k2] || {})[field] = { field: field, value: value };
              }); });
          };
          var entV = function (f) {
            var e3 = entFor(String(r["Company"]), String(r["Request #"]), String(r["Sheet Row"] || ""))[f];
            return e3 && e3.value != null ? String(e3.value) : "";
          };
          var refresh = function () { paint(); if (host.__ldpOpen) host.__ldpOpen(S.sel); };
          var SAVED = "Saved — recomputes fully on the next data refresh";
          var CLEARED = "Override removed — the sheet value returns on the next data refresh";
          var wire = function (el, apply, clear) {
            if (!el) return;
            el.onchange = function () {
              var v = String(el.tagName === "SELECT" ? el.value : el.value).trim();
              var init = el.getAttribute("data-init") || "";
              if (v === init) return;
              if (!v) {
                if (!clear || !clear.hadOv()) { el.value = init; return; }
                post(clear.field, null)
                  .then(function () { clear.local(); ZTZ.toast(CLEARED); refresh(); })
                  .catch(function (eS) { el.value = init; ZTZ.toast(String(eS.message || eS)); });
                return;
              }
              apply.check && !apply.check(v)
                ? (el.value = init)
                : post(apply.field, v)
                    .then(function () { apply.local(v); ZTZ.toast(SAVED); refresh(); })
                    .catch(function (eS) { el.value = init; ZTZ.toast(String(eS.message || eS)); });
            };
            if (el.tagName === "INPUT") el.onkeydown = function (e2) { if (e2.key === "Enter") el.blur(); };
          };
          wire(dr.querySelector("#ldpEdFad"),
            { field: "fad_override", local: function (v) { r["FAD"] = v; r["FAD Source"] = "portal"; } },
            { field: "fad_override", hadOv: function () { return !!entV("fad_override"); },
              local: function () { r["FAD Source"] = null; } });
          wire(dr.querySelector("#ldpEdTf"),
            { field: "timeframe_override", local: function (v) { r["Timeframe"] = v; } },
            { field: "timeframe_override", hadOv: function () { return !!entV("timeframe_override"); },
              local: function () {} });
          // the Location editor is a kit localSelect, not a native input or dropdown, so it gets
          // its own wiring with EXACTLY wire()'s contract: same-as-init is a no-op, an
          // off-list value reverts, a failed save reverts + toasts, success saves locally.
          (function () {
            var lh = dr.querySelector("#ldpEdLoc");
            if (!lh) return;
            var init = lh.getAttribute("data-init") || "";
            var lsc = RSC.localSelect(lh, {
              label: "Location", form: true, required: true,
              values: LDP_LOCATIONS, value: init,
              // a location outside the buckets (old disabled placeholder) still shows its name
              allLabel: String(r["Location"] || "—"),
              onChange: function (v) {
                v = String(v).trim();
                if (v === init) return;
                if (LDP_LOCATIONS.indexOf(v) < 0) { lsc.set(init); return; }
                post("location", v)
                  .then(function () { r["Location"] = v; r["Location Source"] = "portal";
                                      ZTZ.toast(SAVED); refresh(); })
                  .catch(function (eS) { lsc.set(init); ZTZ.toast(String(eS.message || eS)); });
              },
            });
          })();
          wire(dr.querySelector("#ldpEdLocN"),
            { field: "location_note", local: function (v) { r["Location Detail"] = v; } },
            { field: "location_note", hadOv: function () { return !!entV("location_note"); },
              local: function () { r["Location Detail"] = null; } });
          var rst = function (id, field, local) {
            var a = dr.querySelector("#" + id);
            if (a) a.onclick = function () {
              post(field, null)
                .then(function () { local(); ZTZ.toast(CLEARED); refresh(); })
                .catch(function (eS) { ZTZ.toast(String(eS.message || eS)); });
            };
          };
          rst("ldpRstFad", "fad_override", function () { r["FAD Source"] = null; });
          rst("ldpRstTf", "timeframe_override", function () {});
          rst("ldpRstLoc", "location", function () { r["Location Source"] = "system"; });
          var db = dr.querySelector("#ldpDlvBtn"), dc = dr.querySelector("#ldpDlvC");
          if (db) db.onclick = function () { db.style.display = "none"; dc.style.display = "inline"; };
          var dn = dr.querySelector("#ldpDlvNo");
          if (dn) dn.onclick = function () { dc.style.display = "none"; db.style.display = "inline-block"; };
          var dy = dr.querySelector("#ldpDlvYes");
          if (dy) dy.onclick = function () {
            dy.disabled = true;
            post("delivered", "1").then(function () {
              r["Delivery Status"] = DLV_PORTAL;
              r["Urgency"] = null; r["Do"] = "";
              openDrawer(null);
              ZTZ.toast("Delivered — moved to the Delivered card");
              paint();
            }).catch(function (eS) { dy.disabled = false; ZTZ.toast(String(eS.message || eS)); });
          };
          var ud = dr.querySelector("#ldpUnDlv");
          if (ud) ud.onclick = function () {
            ud.disabled = true;
            post("delivered", "0").then(function () {
              r["Delivery Status"] = "";
              openDrawer(null);
              ZTZ.toast("Back on the board — everything recomputes on the next refresh");
              paint();
            }).catch(function (eS) { ud.disabled = false; ZTZ.toast(String(eS.message || eS)); });
          };
        })();
        drawFocused(document.getElementById("ldpDMap"), r);
        var x = document.getElementById("ldpDx");
        if (x) x.onclick = function () { openDrawer(null); };
        wireForms(dr);
      }
      host.__ldpOpen = openDrawer;


      // ===================== TIMELINE =====================
      // Same planning model as his longdistance.html: STRAIGHT = one committed date, drawn
      // as depart -> trip -> deadline diamond; REGULAR = a window band. A deadline outside
      // the visible range collapses to an edge chevron instead of silently disappearing,
      // which is the difference between "nothing due" and "you cannot see what is due".
      var TL_DAYS = 42;
      function tlMid(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
      function tlParse(v) { var t = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? tlMid(new Date(t + "T12:00:00")) : null; }
      // Default the window to start a week BEFORE today, not on it. Anchoring at today put
      // TODAY flush against the left edge and pushed every overdue deadline off-range as a
      // chevron — and this board is mostly overdue work, so the default view was a column of
      // chevrons. A week of lead-in also means a pickup that just happened is still visible.
      // The window used to be "today minus 7" for a fixed 42 days. Nearly every live shipment
      // is OVERDUE, so their windows sat BEFORE the range: every bar clamped into the first
      // ~15% behind a "< Apr 30" chevron while two thirds of the chart stayed empty. Default
      // now FITS THE DATA -- earliest date that matters, a couple of days of lead-in -- and the
      // Today button still snaps back to a today-anchored view.
      function tlStart() {
        if (S.tlStart) return tlMid(new Date(S.tlStart + "T12:00:00"));
        var today = tlMid(new Date());
        var earliest = null;
        (cur || []).forEach(function (r) {
          [tlParse(r["FAD"]), tlParse(r["Depart By"]), tlParse(r["Pickup Date"])].forEach(function (d) {
            if (d && (!earliest || d < earliest)) earliest = d;
          });
        });
        var d = earliest ? tlMid(earliest) : today;
        d.setDate(d.getDate() - 2);                 // a little lead-in before the first marker
        if (d > today) { d = today; d.setDate(d.getDate() - 7); }   // never start after today
        return d;
      }
      function tlIdx(d, st) { return d ? Math.round((tlMid(d).getTime() - st.getTime()) / 86400000) : null; }
      function tlTone(r) {
        var u = String(r["Urgency"] || "");
        return u === "Act now" ? "u-red" : u === "Act soon" ? "u-amber" : "";
      }
      function tlRow(r, i, st, days, dp) {
        var key = String(r["Sheet Row"] || i), tone = tlTone(r), st8 = isStraight(r), ck2 = custKey(r);
        var pk = tlParse(r["Pickup Date"]), tdi = tlIdx(tlMid(new Date()), st);
        var bars = "";
        if (tdi >= 0 && tdi < days) {
          bars += '<i class="ldp-tlband" style="left:' + (tdi * dp) + "%;width:" + dp + '%"></i>'
                + '<i class="ldp-tltoday" style="left:' + ((tdi + 0.5) * dp) + '%"></i>';
        }
        if (st8) {
          var dep = tlParse(r["Depart By"]), dead = tlParse(r["FAD"]);
          var ddi = tlIdx(dep, st), fdi = tlIdx(dead, st);
          if (ddi != null && fdi != null && fdi > ddi)
            bars += '<span class="ldp-tltrip ' + tone + '" style="left:' + ((ddi + 0.5) * dp) + "%;width:" + ((fdi - ddi) * dp) + '%"></span>';
          if (ddi != null && ddi >= 0 && ddi < days)
            bars += '<span class="ldp-tldep ' + tone + '" style="left:' + ((ddi + 0.5) * dp) + '%" title="truck departs ' + esc(fmtD(r["Depart By"])) + '"></span>';
          if (fdi != null) {
            var dot = '<span class="dot"></span>', dt = '<span class="dt">' + fmtD(r["FAD"]) + "</span>";
            if (fdi < 0)
              bars += '<span class="ldp-tldead ' + tone + ' off" style="left:3px" title="deliver ' + esc(fmtD(r["FAD"])) + ' (before this range)"><span class="chev">\u2039</span>' + dt + "</span>";
            else if (fdi >= days)
              bars += '<span class="ldp-tldead ' + tone + ' off" style="right:3px" title="deliver ' + esc(fmtD(r["FAD"])) + ' (beyond this range)">' + dt + '<span class="chev">\u203a</span></span>';
            else {
              var near = (fdi + 0.5) * dp > 84;
              bars += '<span class="ldp-tldead ' + tone + (near ? " lft" : "") + '" style="left:' + ((fdi + 0.5) * dp) + '%" title="deliver by ' + esc(fmtD(r["FAD"])) + '">' + (near ? dt + dot : dot + dt) + "</span>";
            }
          }
        } else {
          var ws = tlParse(r["FAD"]), we = tlParse(r["Window End"]) || ws;
          var a = tlIdx(ws, st), b = tlIdx(we, st);
          if (a != null && b != null && b >= a) {
            var a2 = Math.max(a, 0), b2 = Math.min(b, days - 1);
            if (b2 >= a2)
              bars += '<span class="ldp-tlwin ' + tone + '" style="left:' + (a2 * dp) + "%;width:" + ((b2 - a2 + 1) * dp) + '%" title="delivery window ' + esc(fmtD(r["FAD"])) + " \u2013 " + esc(fmtD(r["Window End"])) + '"><span class="dt">' + fmtD(r["FAD"]) + " \u2013 " + fmtD(r["Window End"]) + "</span></span>";
            else if (b < 0)
              // whole window before the visible range — an edge chevron, like Straight gets
              bars += '<span class="ldp-tldead ' + tone + ' off" style="left:3px" title="window closed ' + esc(fmtD(r["Window End"])) + '"><span class="chev">\u2039</span><span class="dt">' + fmtD(r["Window End"]) + "</span></span>";
            else if (a >= days)
              bars += '<span class="ldp-tldead ' + tone + ' off" style="right:3px" title="window opens ' + esc(fmtD(r["FAD"])) + '"><span class="dt">' + fmtD(r["FAD"]) + '</span><span class="chev">\u203a</span></span>';
          }
        }
        // HOW LONG WE HAVE HELD IT. Every row on this board is already collected (a job only
        // reaches the LD sheet after pickup), so the useful question is not "picked up?" but
        // "how long have we been sitting on it" — median 19 days, worst 360. Drawn from the
        // pickup to today in the custody colour, clamped to the visible range.
        var pdi = tlIdx(pk, st), ck = custKey(r);
        if (pdi != null && tdi != null) {
          var h0 = Math.max(pdi, 0), h1 = Math.min(tdi, days - 1);
          if (h1 >= h0 && pdi <= tdi) {
            bars += '<span class="ldp-tlhold ' + ck + '" style="left:' + ((h0 + 0.5) * dp) + "%;width:" + Math.max((h1 - h0) * dp, 0.6) + '%"'
                 + ' title="' + esc(CUST_LABEL[ck]) + " \u00b7 held " + (tdi - pdi) + ' days"></span>';
            if ((h1 - h0) * dp > 9)
              bars += '<span class="ldp-tlheld" style="left:' + ((h0 + 0.5) * dp) + '%">' + (tdi - pdi) + "d</span>";
          }
        }
        if (pdi != null && pdi >= 0 && pdi < days)
          bars += '<span class="ldp-tlpk" style="left:' + ((pdi + 0.5) * dp) + '%" title="picked up ' + esc(fmtD(r["Pickup Date"])) + '"></span>';
        return '<div class="ldp-tlrow' + (S.sel === key ? " on" : "") + '" data-ldk="' + esc(key) + '">'
          + '<div class="ldp-tllab"><span class="ldp-tlmk ' + (st8 ? "s" : "r") + '"></span>'
          + '<span class="ldp-tllabtx"><b>' + esc(r["Customer"] || "—") + "</b>"
          + '<span class="ldp-tlmeta">'
          +   esc(r["Job Code"] ? String(r["Job Code"]).split(",")[0] : "—")
          +   (stateZip(r["Moving To"], r["Delivery State"]) ? ' · ' + esc(stateZip(r["Moving To"], r["Delivery State"])) : "")
          +   '<span class="rs-pill ' + CUST_TONE[ck2] + '">' + CUST_LABEL[ck2] + "</span></span></span></div>"
          + '<div class="ldp-tlcal">' + bars + "</div></div>";
      }
      // ROUTES VIEW (Phase 3): the engine's suggested consolidations. Data is loaded once
      // per paint-generation into S._rsug by wire(); Accept POSTs to /api/_ldroutes and the
      // jobs flip to Accepted Route on the next mart rebuild (the ladder already reads it).
      function fmtHrs(m2) {
        m2 = Math.round(+m2 || 0);
        var h2 = Math.floor(m2 / 60), r2 = m2 % 60;
        return h2 ? (h2 + "h" + (r2 ? " " + r2 + "m" : "")) : (r2 + "m");
      }
      function routesHtml() {
        var sug = S._rsug;
        if (sug == null) return '<div class="ldp-card" style="padding:26px;color:var(--faint)">Loading route suggestions\u2026</div>';
        var byKey = {};
        sug.forEach(function (x) { (byKey[x["Route Key"]] = byKey[x["Route Key"]] || []).push(x); });
        var keys = Object.keys(byKey);
        if (!keys.length) return '<div class="ldp-card" style="padding:26px;color:var(--faint)">No combinable routes right now \u2014 the engine found no pair of candidates inside the five constraints (\u22641,500 CF \u00b7 stops \u2264100 mi apart \u00b7 \u2264180 min detour \u00b7 windows within 5 days \u00b7 \u22642.5 mi/CF).</div>';
        return '<div class="ldp-rgrid">' + keys.map(function (k) {
          var st = byKey[k].sort(function (a, b) { return a["Seq"] - b["Seq"]; });
          var h = st[0];
          var mpc = (+h["Miles"] && +h["Route CF"])
            ? ((+h["Miles"]) / (+h["Route CF"])).toFixed(1) : null;
          // How soon a stop must land is what makes a route urgent, so the date carries the
          // colour rather than sitting at the end of a sentence.
          var daysTo = function (d) {
            var t = Date.parse(String(d || "").slice(0, 10));
            if (!isFinite(t)) return null;
            return Math.round((t - Date.now()) / 86400000);
          };
          var baseZip = String(h["Base Zip"] || LD_BASE_ZIP || "").trim();
          // The card says WHERE the route goes and WHEN the first stop is due. The stop list
          // -- who, how much, which window -- lives behind "Visualize route", so a screen of
          // candidates reads as a set of routes rather than a wall of jobs.
          var soonest = st.map(function (x) { return daysTo(x["Window End"]); })
            .filter(function (n) { return n !== null; }).sort(function (a, b) { return a - b; })[0];
          var pathHtml = '<div class="ldp-rpath">'
            + '<span class="hop base">Base ' + esc(baseZip || "") + "</span>"
            + st.map(function (x) {
                return '<span class="hop">' + esc(x["Dest State"] || x["Dest Zip"] || "?") + "</span>";
              }).join("")
            + '<span class="hop base">Base</span>'
            + (soonest !== undefined
                ? '<span class="due' + (soonest <= 7 ? " soon" : "") + '">first due '
                  + (soonest < 0 ? "overdue" : "in " + soonest + "d") + "</span>" : "")
            + "</div>";
          // truck fill: the single number that says whether this route is worth running
          var tcf = +h["Truck CF"] || 0, rcf = +h["Route CF"] || 0;
          var pct = tcf ? Math.min(100, Math.round(rcf / tcf * 100)) : 0;
          var capHtml = tcf
            ? '<div class="ldp-cap"><div class="ldp-capbar"><div class="ldp-capfill'
              + (pct < 55 ? " low" : "") + '" style="width:' + pct + '%"></div></div>'
              + '<div class="ldp-capmeta"><span><b>' + pct + "%</b> of truck "
              + esc(h["Truck"] || "?") + "</span><span>"
              + Math.max(0, Math.round(tcf - rcf)).toLocaleString() + " cf spare</span></div></div>"
            : "";
          var metHtml = '<div class="ldp-rmet">'
            + "<div><i>Miles</i><b>" + (+h["Miles"]).toLocaleString() + "</b></div>"
            + "<div><i>Drive</i><b>" + fmtHrs(h["Drive Min"]) + "</b></div>"
            + "<div><i>Detour</i><b" + (+h["Detour Min"] > 120 ? ' class="bad"' : "") + ">"
            + h["Detour Min"] + "m</b></div>"
            + "<div><i>Mi / CF</i><b" + (mpc && +mpc > 2.5 ? ' class="bad"' : "") + ">"
            + (mpc || "\u2014") + "</b></div></div>";
          var codesArr = st.map(function (x) { return String(x["Job Code"]); });
          var isAcc = (S._racc || []).some(function (x2) {
            if (String(x2.status) !== "accepted") return false;
            var have = String(x2.job_codes || "").split(",");
            return codesArr.every(function (c2) { return have.indexOf(c2) >= 0; });
          });
          return '<div class="ldp-rcard' + (+h["Feasible"] ? "" : " tight") + '" data-rk="' + esc(k) + '">'
            + '<div class="ldp-rtop"><div class="ldp-rttl">'
            + "<b>" + st.length + " stop" + (st.length === 1 ? "" : "s") + " \u00b7 "
            + Math.round(h["Route CF"]).toLocaleString() + " cf</b>"
            + '<span class="rs-pill mute">truck ' + esc(h["Truck"] || "?") + "</span>"
            + (+h["Feasible"] ? "" : '<span class="rs-pill bad">Schedule tight</span>')
            + "</div>" + capHtml + "</div>"
            + metHtml
            + pathHtml
            + (+h["Feasible"] ? "" : '<div class="ldp-rnote">'
                + esc(h["Feasible Note"] || "schedule tight \u2014 check the dates") + "</div>")
            + '<div class="ldp-ract">'
            + (isAcc ? '<span class="rs-pill ok">Accepted \u2014 un-accept below</span>'
                     : '<button type="button" class="rs-btn pri ldp-raccept" data-rkey="' + esc(k) + '" data-codes="'
            + esc(codesArr.join(",")) + '" data-zips="'
            + esc(st.map(function (x) { return String(x["Dest Zip"] || "").trim(); }).join(",")) + '" data-truck="' + esc(h["Truck"] || "") + '" data-miles="' + esc(String(h["Miles"] || "")) + '">Accept route</button>')
            + (function () {
                // always offered -- it is now the only way into the stops, so a route with
                // unmappable zips still opens the panel (the map says so, the list is there)
                var zs = st.map(function (x) { return String(x["Dest Zip"] || "").trim(); })
                  .filter(function (z) { return /^\d{5}$/.test(z); });
                var legzips = zs.length
                  ? [baseZip || LD_BASE_ZIP].concat(zs).concat([baseZip || LD_BASE_ZIP]).join(",") : "";
                return '<button type="button" class="rs-btn" data-mapfor="' + esc(k)
                  + '" data-legzips="' + legzips + '">Visualize route</button>';
              })()
            // DECLINE — "this combination is not going to happen". It locks nothing (unlike
            // Accept) and is reversible; it only stops the engine proposing the same set of
            // jobs again, and records who said no and why.
            + (isAcc ? '' : '<button type="button" class="rs-btn ldp-rdecline" data-decline="' + esc(k)
                + '" data-codes="' + esc(codesArr.join(",")) + '" data-truck="'
                + esc(h["Truck"] || "") + '" data-miles="' + esc(String(h["Miles"] || ""))
                + '">Decline</button>')
            + "</div></div>";
        }).join("") + "</div>"
        + acceptedHtml()
        + declinedHtml();
        // (the engine-rules note that sat under the cards moved, word for word, into the
        // head's "How it's counted" panel)
      }
      /* What the dispatchers have refused, with a way back. Kept visible rather than
       * silently swallowed: a suggestion that vanished with no trace is indistinguishable
       * from an engine that stopped working. */
      function declinedHtml() {
        var dec = (S._racc || []).filter(function (x) { return String(x.status) === "declined"; });
        if (!dec.length) return "";
        return '<div class="ldp-card" style="margin-top:14px;padding:14px 16px">'
          + '<div class="ldp-sec" style="margin-top:0">Declined suggestions \u00b7 ' + dec.length + "</div>"
          + '<div class="ldp-sub" style="margin-bottom:8px">The engine will not propose these '
          + "combinations again. Put one back and it returns on the next rebuild.</div>"
          + dec.map(function (x) {
              var codes = String(x.job_codes || "").split(",").filter(Boolean);
              return '<div class="ldp-cst"><span class="ldp-cst-d">'
                + esc(String(x.accepted_at || "").slice(0, 10)) + "</span>"
                + "<span><b>" + codes.map(esc).join(" + ") + "</b>"
                + (x.decline_reason ? '<span class="ldp-sub"> \u2014 ' + esc(x.decline_reason) + "</span>" : "")
                + (x.accepted_by ? '<span class="ldp-sub"> \u00b7 ' + esc(String(x.accepted_by).split("@")[0]) + "</span>" : "")
                + "</span>"
                // ldp-dec-l, not ldp-cst-l: that class carries margin-left:auto, which is right
                // in the narrow drawer it was written for and a canyon in this full-width card.
                + '<span class="ldp-dec-l"><button type="button" class="rs-btn" data-undecline="' + esc(String(x.id))
                + '" style="margin-top:0">Put back</button></span></div>';
            }).join("")
          + "</div>";
      }

      function acceptedHtml() {
        var acc = (S._racc || []).filter(function (x) { return String(x.status) === "accepted"; });
        if (!acc.length) return "";
        return '<div class="ldp-card" style="margin-top:14px;padding:14px 16px">'
          + '<div class="ldp-sec" style="margin-top:0">Accepted routes</div>'
          + acc.map(function (x) {
              var codes = String(x.job_codes || "").split(",").filter(Boolean);
              // zips persisted at accept time are authoritative; recovery from the live board
              // is a legacy fallback and only trusted when EVERY stop resolves (a delivered job
              // leaves the board -- a partial chain would renumber stops and mislabel the
              // empty-return leg)
              var zs = String(x.job_zips || "").split(",").filter(function (z) { return /^\d{5}$/.test(z); });
              if (zs.length !== codes.length)
                zs = codes.map(function (code) {
                  var hit = overlaid().filter(function (r2) {
                    return String(r2["Job Code"] || "").split(",").indexOf(code) >= 0;
                  })[0];
                  return hit ? zipOnly(hit["Moving To"]) : "";
                }).filter(function (z) { return /^\d{5}$/.test(z); });
              var mappable = zs.length === codes.length && zs.length > 0;
              var mk = "acc" + x.id;
              return '<div class="ldp-rstop"><b>' + esc(String(x.job_codes || "").split(",").join(" + "))
                + "</b> <span class=\"ldp-sub\">truck " + esc(x.truck || "?")
                + (x.miles ? " \u00b7 ~" + (+x.miles).toLocaleString() + " mi" : "")
                + " \u00b7 accepted " + esc(String(x.accepted_at || "").slice(0, 16))
                + " by " + esc(String(x.accepted_by || "").split("@")[0]) + "</span>"
                // margin-left:auto pushed these to the far right of a full-page-width card,
                // ~1,400px from the job codes they act on. Packed left with the row instead.
                + (mappable ? '<button type="button" class="rs-btn" data-mapfor="' + mk + '" data-legzips="'
                    + [LD_BASE_ZIP].concat(zs).concat([LD_BASE_ZIP]).join(",") + '" style="margin:0 0 0 6px">Visualize route</button>' : "")
                + '<button type="button" class="rs-btn" data-unacc="' + x.id + '" style="margin:0 0 0 8px">Un-accept</button></div>';
            }).join("")
          + "</div>";
      }
      function mapviewHtml(rows2) {
        // the overview draws AFTER mount (wire) -- stash the exact filtered rowset the
        // board sees so the shared filter bar governs the map too (one filter system)
        var use = rows2.filter(function (r) { return custKey(r) !== "car"; });
        S._mvRows = use;
        var car = rows2.length - use.length;
        return '<div class="ldp-card" style="padding:12px 14px">'
          + '<div class="ldp-ovleg">'
          + '<span class="ldp-ovk"><i class="ldp-ovdot" style="background:' + OV_COLORS["Act now"] + '"></i>Act now</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovdot" style="background:' + OV_COLORS["Act soon"] + '"></i>Act soon</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovdot" style="background:' + OV_COLORS["On track"] + '"></i>On track</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovdot" style="background:' + OV_COLORS[""] + '"></i>Missing data</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovln"></i>Straight</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovln dash"></i>Regular</span>'
          + '<span class="ldp-ovk"><i class="ldp-ovln thin"></i>Collection ahead</span>'
          + '<span class="ldp-ovk"><span class="ldp-mstop base" style="position:static;display:inline-block">B</span> NJ base</span>'
          + '<span class="ldp-ovnote" id="ldpOvNote">'
          + (car ? car + " at a carrier hidden (Carrier Watch, not planning)" : "") + "</span>"
          + '<button type="button" class="rs-btn" id="ldpOvFull">Fullscreen</button>'
          + "</div>"
          + '<div class="ldp-jmap ldp-ovmap"></div></div>';
      }
      function timelineHtml(rows) {
        // span the window so the LAST thing that matters is still on screen -- a fixed 42 days
        // truncated every job whose delivery window ran past it (the right edge was empty while
        // bars piled up on the left)
        var st = tlStart(), days = TL_DAYS;
        (function () {
          var last = null;
          (rows || []).forEach(function (r) {
            [tlParse(r["Window End"]), tlParse(r["FAD"]), tlParse(r["Depart By"])].forEach(function (d) {
              if (d && (!last || d > last)) last = d;
            });
          });
          var need = last ? Math.ceil((tlMid(last).getTime() - st.getTime()) / 86400000) + 3 : 0;
          days = Math.max(21, Math.min(180, Math.max(TL_DAYS, need)));
        })();
        S._tlDays = days;   // drag-to-pan needs the shown day count
        var dp = 100 / days;
        S._tlAnchor = st.toLocaleDateString("en-CA");   // the stepper steps from what is shown
        var end = new Date(st.getTime() + (days - 1) * 86400000);
        var MONS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        var cal = "";
        for (var d = 0; d < days; d++) {
          var dt = new Date(st.getTime() + d * 86400000);
          if (d === 0 || dt.getDate() === 1)
            cal += '<span class="ldp-tlmon" style="left:' + (d * dp) + '%">' + MONS[dt.getMonth()] + "</span>";
          if (d % 7 === 0)
            cal += '<span class="ldp-tlday" style="left:' + ((d + 0.5) * dp) + '%">' + dt.getDate() + "</span>";
        }
        var tdi = tlIdx(tlMid(new Date()), st);
        if (tdi >= 0 && tdi < days)
          cal += '<span class="ldp-tltodaylab" style="left:' + ((tdi + 0.5) * dp) + '%">Today</span>';
        // soonest deadline first, exactly like the board
        var ord = rows.filter(function (r) {
          var k = S.tlSeg;
          if (!k) return true;
          if (k === "straight") return isStraight(r);
          if (k === "regular") return !isStraight(r);
          return custKey(r) === k;
        }).sort(function (a, b) {
          var da = actDate(a), db = actDate(b);
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return da < db ? -1 : da > db ? 1 : 0;
        });
        // one gridline per week, wherever the window happens to land -- the window is sized to
        // the data (21-180 days), so the rules follow the day numbers printed above them. One
        // layer for the whole list (ZTZ-80: no gradients), not a background on every row.
        var weeks = '<div class="ldp-tlweeks" aria-hidden="true">';
        for (var wk = 0; wk < days; wk += 7) weeks += '<i style="left:' + (wk * dp).toFixed(4) + '%"></i>';
        weeks += "</div>";
        var body = ord.map(function (r, i) { return tlRow(r, i, st, days, dp); }).join("")
          || '<div style="padding:26px;color:var(--faint)">No shipments match these filters.</div>';
        // Segment the board without leaving the view: type and custody are the two questions
        // a dispatcher actually asks of it.
        return '<div class="ldp-tlbar">'
          + '<div class="ldp-tlnav"><button type="button" class="rs-btn" data-tl="prev" title="Two weeks earlier">Earlier</button>'
          +   '<button type="button" class="rs-btn" data-tl="today">Today</button>'
          +   '<button type="button" class="rs-btn" data-tl="next" title="Two weeks later">Later</button></div>'
          + '<div class="ldp-tlrange">' + MONS[st.getMonth()] + " " + st.getDate() + " \u2013 " + MONS[end.getMonth()] + " " + end.getDate()
          +   "<small>" + days + "-day plan window</small></div>"
          + (function () {
              var before = 0, after = 0;
              ord.forEach(function (r) {
                var t = tlParse(isStraight(r) ? r["FAD"] : (r["Window End"] || r["FAD"]));
                var i2 = tlIdx(t, st);
                if (i2 == null) return;
                if (i2 < 0) before++; else if (i2 >= days) after++;
              });
              return (before || after)
                ? '<span class="rs-pill warn">' + (before ? before + " due before this range" : "")
                    + (before && after ? " · " : "") + (after ? after + " beyond it" : "") + "</span>"
                : "";
            })()
          + '<div class="ldp-tllg"><span><i class="lg-pk"></i>picked up</span>'
          +   '<span><i class="lg-hold"></i>days in our hands</span>'
          +   '<span><i class="lg-s"></i>straight \u2014 committed date</span>'
          +   '<span><i class="lg-r"></i>regular \u2014 delivery window</span></div>'
          + "</div>"
          + '<div class="ldp-tlgrid">'
          +   '<div class="ldp-tlhead"><div class="ldp-tlhlab"></div>'
          +   '<div class="ldp-tlhcal">' + cal + "</div></div>"
          +   '<div class="ldp-tlbody"><div class="ldp-tlrows">' + weeks + body + "</div></div></div>";
      }

      var body = cur.map(function (r, i) {
        var key = String(r["Sheet Row"] || i);
        var det = String(r["Location Detail"] || "");
        // ONE LINE PER CELL. Anything that needs a second line belongs in the drawer —
        // that is what keeps every row the same height and the whole table scannable.
        var dvDate = isStraight(r) ? fmtD(r["FAD"]) : windowTxt(r);
        // no row edge or tint any more: urgency is the one dot in "What to do" (ZTZ-80)
        var main = '<tr class="ldp-row' + (S.sel === key ? " on" : "") + '" data-ldk="' + esc(key) + '">'
          + '<td class="ldp-evtd">' + calCell(r) + "</td>"
          + '<td class="ldp-cust-td"><span class="ldp-cust">' + esc(r["Customer"] || "—") + "</span>"
              + ((r["Company"] && r["Company"] !== "Zip to Zip") || +r["Storage Sold"]
                  ? '<div class="ldp-sub">'
                    + (r["Company"] && r["Company"] !== "Zip to Zip" ? esc(r["Company"]) : "")
                    + (+r["Storage Sold"] ? ' <span class="ldp-stor" title="The calendar event says Storage Service Requested — the salesperson sold storage on this job">Storage</span>' : "")
                    + "</div>"
                  : "")
              + "</td>"
          + '<td class="ldp-typetd">' + typeChip(r) + stageChip(r) + routeChip(r) + backhaulChip(r) + carrierChip(r) + "</td>"
          + '<td class="ldp-fromtd">' + departCellFrom(r) + "</td>"
          + "<td>" + esc(stateZip(r["Moving To"], r["Delivery State"]) || "—") + "</td>"
          + "<td>" + whereCell(r) + "</td>"
          + '<td class="ldp-begin">' + whenCell(r) + "</td>"
          + '<td class="ldp-todotd">' + todoCell(r) + "</td>"
          + "</tr>";
        return main;
      }).join("");

      var tbl = '<div class="ldp-card"><div class="ldp-wrap"><table class="ldp-tbl">'
        + '<colgroup><col class="c-ev"><col class="c-cust"><col class="c-type">'
        +   '<col class="c-from"><col class="c-to"><col class="c-where"><col class="c-when">'
        +   '<col class="c-todo"></colgroup>'
        + "<thead><tr>"
        + "<th title=\"Open this job's Google Calendar events\">Calendar events</th>"
        + "<th>Customer</th>"
        + "<th title=\"Straight or Regular, and which leg is next\">Type</th>"
        + "<th title=\"Where the delivery truck loads from\">Departing from</th>"
        + "<th>Delivering to</th><th>Where it is</th>"
        + "<th class=\"ldp-hbegin\" title=\"Deliveries show the FAD and the end of its window; pickups show the committed collection date. A depart-by line appears only when the trip runs longer than a day.\">When</th>"
        + "<th title=\"The single next action for this shipment\">What to do</th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="8" style="color:var(--faint);padding:18px">No rows match — clear the filters, or the last build produced nothing.</td></tr>')
        + "</tbody></table></div>"
        // the rest of this note (Straight vs Regular dates, the hourly refresh) is in the head's
        // "How it's counted", word for word
        + '<div class="ldp-fnote">Click a row for the full details. <b>Sorted by when we must act</b> — '
        + "soonest deadline first, whatever the pickup date.</div></div>";

      // keep the scroll position — a repaint used to snap back to the top; the vertical
      // scroller is the table wrap (.ldp-wrap), not the window — restore both
      var sx = window.scrollX, sy = window.scrollY;
      var wrap0 = document.querySelector("#ldpBody .ldp-wrap") || document.querySelector("#ldpBody .ldp-tlbody");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      // the user may have switched pages while loadEntries()/save was awaiting — the mount
      // is gone and painting would throw "innerHTML on null" (money-flow had this same bug)
      S._bdRows = cur;   // the exact filtered rowset, for the CSV export
      var _bd = document.getElementById("ldpBody");
      if (!_bd || !host.isConnected) return;
      // journey maps register a window resize listener (Leaflet trackResize) -- discarding
      // their DOM without remove() leaks the whole map per repaint
      Array.prototype.forEach.call(_bd.querySelectorAll(".ldp-jmap"), function (n) {
        if (n._ldmap) { try { n._ldmap.remove(); } catch (e) {} n._ldmap = null; }
      });
      // the standard's order: views (tabs), ONE filter row, the KPI row, then the view
      _bd.innerHTML = tabs + bar + kp + (S.view === "timeline" ? timelineHtml(cur)
        : S.view === "routes" ? routesHtml()
        : S.view === "map" ? mapviewHtml(cur) : tbl);
      // the kit tiles carry no hooks of their own: tag them, in order, so the [data-kpi] handler
      // in wire() binds them exactly as it bound the old cards (role=button + Enter/Space too)
      Array.prototype.forEach.call(_bd.querySelectorAll(".ldp-kpis .kpi"), function (t, i) {
        var k = (S._kpiKeys || [])[i];
        if (!k) return;
        t.setAttribute("data-kpi", k);
        t.setAttribute("role", "button");
        t.setAttribute("tabindex", "0");
        t.setAttribute("aria-pressed", String(S.kpi === k));
        if (S.kpi === k) t.classList.add("sel");
      });
      var _sc = document.getElementById("ldpScrim");
      if (_sc) _sc.onclick = function () { if (host.__ldpOpen) host.__ldpOpen(null); };
      if (!host.__ldpEsc) {
        host.__ldpEsc = function (e) {
          if (!host.isConnected) { document.removeEventListener("keydown", host.__ldpEsc); return; }
          if (e.key === "Escape") {
            var fsm = host.querySelector(".ldp-ovmap.full");
            if (fsm) {
              fsm.classList.remove("full");
              var fb = host.querySelector("#ldpOvFull");
              if (fb) fb.textContent = "Fullscreen";
              setTimeout(function () { if (fsm._ldmap) fsm._ldmap.invalidateSize(); }, 160);
              return;
            }
            var pn = document.getElementById("ldpRPanel");
            if (pn && pn.classList.contains("show")) { closeRoutePanel(); return; }
            if (host.__ldpOpen) host.__ldpOpen(null);
          }
        };
        document.addEventListener("keydown", host.__ldpEsc);
      }

      wire();
      // the chevron sits in the bar itself, beside the view switcher and the "N of M
      // shipments" count — both stay visible, so a collapsed bar still says what is on screen
      RSC.collapsible(_bd.querySelector(".ldp-fbox"), "rsBarCollapsed:ld-planning", {
        host: _bd.querySelector(".ldp-bar"),
        count: function () {
          var labels = [];
          if (S.q) labels.push("Search");
          if (S.co) labels.push("Company");
          if (S.loc) labels.push("Location");
          if ((S.ms.type || []).length) labels.push("Type");
          if ((S.ms.cust || []).length) labels.push("Status");
          if ((S.ms.route || []).length) labels.push("Routing");
          if (S.kpi) labels.push("KPI card");
          if (S.tlSeg) labels.push("Segment");
          return { n: labels.length, labels: labels };
        },
      });
      var wrap1 = document.querySelector("#ldpBody .ldp-wrap") || document.querySelector("#ldpBody .ldp-tlbody");
      if (wrap1) { wrap1.scrollTop = wt; wrap1.scrollLeft = wl; }
      // every view has its own scroller; whichever is on screen measures its own chrome
      [".ldp-wrap", ".ldp-tlbody", ".ldp-ovmap"].forEach(function (sel) {
        RSC.fitScroller(_bd.querySelector(sel));
      });
      window.scrollTo(sx, sy);
    }

    // Map pin picker — Leaflet is fetched from the CDN the first time it is needed so the
    // page carries no extra weight for dispatchers who never open it.
    // M1 journey maps: Leaflet is vendored (assets/vendor/leaflet), loaded on first use.
    var LD_BASE_ZIP = "07728";   // NJ base, same as the route engine
    // A bare 5-digit run is USUALLY a street number ("20345 Main St") -- trust only a zip
    // beside a state code or terminating the address (stateZip's and the route engine's rule)
    function zipOnly(s2) {
      var a = String(s2 || "");
      var m = a.match(/(?:^|[\s,])[A-Z]{2}[\s,]+(\d{5})(?:-\d{4})?(?!\d)/);
      if (m) return m[1];
      return (a.match(/(\d{5})(?:-\d{4})?\s*(?:,?\s*USA?\.?)?\s*$/) || [])[1] || "";
    }
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
    function drawJourney(box, legs) {
      ensureLeaflet(function () {
        var m = box._ldmap;
        if (!m) {
          m = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.5 });
          /* CARTO NOW KEYS EVERY BASEMAP (2026-09-20) -- voyager, light_all and dark_all all come
           back with "API KEY REQUIRED" stamped across the tile. OpenStreetMap's own tiles need
           no key; they are busier than a data map wants, so the layer is dimmed and, in the dark
           theme, inverted, which puts the ground back behind the data. Same treatment as the
           county map on Seasonal Planning (area-plan.js). */
          var darkMap = !document.body.classList.contains("light");
          var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 18, opacity: darkMap ? 1 : .62, attribution: "\u00a9 OpenStreetMap" });
          tiles.addTo(m);
          if (tiles.getContainer()) tiles.getContainer().style.filter = darkMap
            ? "grayscale(1) invert(1) brightness(.82) contrast(.9)" : "grayscale(.55)";
          box._ldmap = m; box._ldlay = [];
        }
        (box._ldlay || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
        box._ldlay = [];
        var bounds = [];
        legs.forEach(function (lg, i) {
          var c = lg.coords || [];
          if (c.length < 2) return;
          var ret = i === legs.length - 1;   // last leg = the empty return to base
          var pl = L.polyline(c, ret
            ? { color: V2C ? V2C.cat[4] : "#6C5CE0", weight: 3, dashArray: "6 7", opacity: 0.85 }
            : { color: V2C ? V2C.accent : "#B26B0B", weight: 4, opacity: 0.9 });
          pl.addTo(m); box._ldlay.push(pl);
          if (ret && lg.miles) {
            pl.bindTooltip("empty return \u00b7 ~" + Math.round(lg.miles).toLocaleString() + " mi",
              { permanent: true, className: "ldp-mifl", direction: "center" });
            pl.openTooltip(c[Math.floor(c.length / 2)]);
          }
          c.forEach(function (p) { bounds.push(p); });
        });
        legs.forEach(function (lg, i) {
          var c = lg.coords || [];
          if (!c.length) return;
          if (i === 0)
            box._ldlay.push(L.marker(c[0], { icon: L.divIcon({ className: "",
              html: '<span class="ldp-mstop base">B</span>', iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(m));
          if (i < legs.length - 1)
            box._ldlay.push(L.marker(c[c.length - 1], { icon: L.divIcon({ className: "",
              html: '<span class="ldp-mstop">' + (i + 1) + "</span>", iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(m));
        });
        if (bounds.length) m.fitBounds(bounds, { padding: [22, 22] });
        setTimeout(function () { m.invalidateSize(); if (bounds.length) m.fitBounds(bounds, { padding: [22, 22] }); }, 80);
      });
    }
    var OV_COLORS = V2C
      ? { "Act now": V2C.neg, "Act soon": V2C.warn, "On track": V2C.pos, "": V2C.other }
      : { "Act now": "#B02A37", "Act soon": "#B26B0B",
                      "On track": "#1C7A4A", "": "#8A93A6" };
    function drawOverview(box, rows2) {
      if (!box) return;
      var need = {};
      rows2.forEach(function (r) {
        var dz = zipOnly(r["Moving To"]);
        if (dz) need[dz] = 1;
        if (custKey(r) === "no") { var oz = zipOnly(r["Moving From"]); if (oz) need[oz] = 1; }
      });
      need[LD_BASE_ZIP] = 1;
      (S._bases || []).forEach(function (b) { if (+b.active && b.zip) need[b.zip] = 1; });
      S._zipGeo = S._zipGeo || {};
      var missing = Object.keys(need).filter(function (z) { return S._zipGeo[z] === undefined; });
      var go = function () { paintOverview(box, rows2); };
      if (!missing.length) { go(); return; }
      fetch(ZTZ.API + "/api/_ldgeo?zips=" + missing.join(","),
            { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (j) {
          var g = (j && j.zips) || {};
          missing.forEach(function (z) { S._zipGeo[z] = g[z] || null; });   // null = known-unmappable
          go();
        })
        .catch(function () {
          box.innerHTML = '<div style="padding:18px;color:var(--faint)">Map unavailable</div>';
        });
    }
    function refineOverview(box, pairs, gen) {
      // sequential batches keep the shared bridge comfortable; each answered pair swaps
      // its straight line for the real truck route in place. Best-effort by design.
      if (!pairs.length) return;
      var batch = pairs.slice(0, 8), rest = pairs.slice(8);
      fetch(ZTZ.API + "/api/_ldgeo?legs=" + encodeURIComponent(batch.join(",")),
            { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
        .then(function (r2) { if (!r2.ok) throw new Error("HTTP " + r2.status); return r2.json(); })
        .then(function (j) {
          if (S._ovgen !== gen || !box.isConnected) return;
          ((j && j.legs) || []).forEach(function (lg) {
            if (lg.source === "here" && lg.coords && lg.coords.length > 1) {
              var thin = thinLine(lg.coords);
              S._roadGeo[lg.leg] = thin;
              (box._ldlay || []).forEach(function (l) {
                if (l._pair === lg.leg && l.setLatLngs) l.setLatLngs(thin);
              });
            }
          });
          if (rest.length) refineOverview(box, rest, gen);
        })
        .catch(function () {});
    }
    function thinLine(c) {
      // country-zoom trails do not need HERE's full ~15k-point geometry: ~200 points keep
      // the road shape; the full-res overview saturated the renderer and froze the page
      if (!c || c.length <= 240) return c;
      var step = Math.ceil(c.length / 200), out2 = [];
      for (var i = 0; i < c.length; i += step) out2.push(c[i]);
      out2.push(c[c.length - 1]);
      return out2;
    }
    function paintOverview(box, rows2) {
      S._ovgen = (S._ovgen || 0) + 1;
      var _og = S._ovgen;
      ensureLeaflet(function () {
        if (S._ovgen !== _og || !box.isConnected) return;   // view switched while loading
        var m = box._ldmap;
        if (!m) {
          m = L.map(box, { zoomSnap: 0.5, preferCanvas: true });
          /* CARTO NOW KEYS EVERY BASEMAP (2026-09-20) -- voyager, light_all and dark_all all come
           back with "API KEY REQUIRED" stamped across the tile. OpenStreetMap's own tiles need
           no key; they are busier than a data map wants, so the layer is dimmed and, in the dark
           theme, inverted, which puts the ground back behind the data. Same treatment as the
           county map on Seasonal Planning (area-plan.js). */
          var darkMap = !document.body.classList.contains("light");
          var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 18, opacity: darkMap ? 1 : .62, attribution: "\u00a9 OpenStreetMap" });
          tiles.addTo(m);
          if (tiles.getContainer()) tiles.getContainer().style.filter = darkMap
            ? "grayscale(1) invert(1) brightness(.82) contrast(.9)" : "grayscale(.55)";
          m.setView([39.5, -83], 5);   // the legacy overview frame: our east-coast lanes
          box._ldmap = m; box._ldlay = [];
        }
        (box._ldlay || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
        box._ldlay = [];
        var base = S._zipGeo[LD_BASE_ZIP];
        var skipped = 0;
        // every depot we run trucks out of, not just the NJ one (Tornike 2026-07-29)
        (S._bases || []).forEach(function (b) {
          if (!+b.active) return;
          var g = S._zipGeo[b.zip];
          if (!g) return;
          box._ldlay.push(L.marker(g, { icon: L.divIcon({ className: "",
            html: '<span class="ldp-mstop base">' + esc(String(b.name || "?").slice(0, 2)) + "</span>",
            iconSize: [20, 20], iconAnchor: [10, 10] }), zIndexOffset: 400 })
            .addTo(m).bindTooltip("Base " + esc(b.name) + " \u00b7 " + esc(b.zip), { sticky: true }));
        });
        S._roadGeo = S._roadGeo || {};   // pair -> HERE road coords, session cache
        var wantRoad = {};
        if (base)
          box._ldlay.push(L.marker(base, { icon: L.divIcon({ className: "",
            html: '<span class="ldp-mstop base">B</span>', iconSize: [20, 20], iconAnchor: [10, 10] }),
            zIndexOffset: 500 }).addTo(m));
        // a trail leg: road geometry when we have it, straight line until it arrives;
        // a fat invisible twin makes the WHOLE line clickable, not just the end dot
        var addTrail = function (a2, b2, style, tip, key) {
          var pair = a2 + ":" + b2;
          var road = S._roadGeo[pair];
          var ll = road || [S._zipGeo[a2], S._zipGeo[b2]];
          if (!ll[0] || !ll[1]) return;
          if (!road) wantRoad[pair] = 1;
          var pl = L.polyline(ll, style).addTo(m);
          pl._pair = pair;
          var hit = L.polyline(ll, { color: "#000", weight: 16, opacity: 0.001 }).addTo(m);
          hit._pair = pair;
          hit.bindTooltip(tip, { sticky: true });
          hit.on("click", function () { if (host.__ldpOpen) host.__ldpOpen(key); });
          box._ldlay.push(pl); box._ldlay.push(hit);
        };
        rows2.forEach(function (r) {
          var dz = zipOnly(r["Moving To"]);
          var dest = dz && S._zipGeo[dz];
          if (!dest) { skipped++; return; }
          var col = OV_COLORS[String(r["Urgency"] || "")] || OV_COLORS[""];
          var st8 = isStraight(r);
          var notPicked = custKey(r) === "no";
          var style = { color: col, weight: 2.5, opacity: 0.7 };
          if (!st8) style.dashArray = "7 7";   // legacy: Straight solid, Regular dashed
          var key = String(r["Sheet Row"] || "");
          var tip = "<b>" + esc(r["Customer"] || "\u2014") + "</b> \u00b7 "
            + esc(stateZip(r["Moving To"], r["Delivery State"]) || dz)
            + "<br>" + esc(r["Type"] || "") + " \u00b7 "
            + esc(String(r["Urgency"] || "\u2014"))
            + (r["Do"] ? "<br>" + esc(String(r["Do"])) : "");
          if (base) {
            addTrail(LD_BASE_ZIP, dz, style, tip, key);
            if (notPicked) {
              var oz = zipOnly(r["Moving From"]);
              // goods still at the customer: the collection leg is ahead of us too
              if (oz && S._zipGeo[oz]) addTrail(oz, LD_BASE_ZIP,
                { color: V2C ? V2C.ctx : "#A7AEBC", weight: 2, opacity: 0.75, dashArray: "3 6" }, tip, key);
            }
          }
          var mk = L.circleMarker(dest, { radius: 7, color: "#fff", weight: 2,
            fillColor: col, fillOpacity: 0.95 }).addTo(m);
          mk.bindTooltip(tip, { sticky: true });
          mk.on("click", function () { if (host.__ldpOpen) host.__ldpOpen(key); });
          box._ldlay.push(mk);
        });
        refineOverview(box, Object.keys(wantRoad), S._ovgen);
        var note = document.getElementById("ldpOvNote");
        if (note && skipped) {
          var extra = skipped + " without a mappable zip";
          note.textContent = note.textContent ? note.textContent + " \u00b7 " + extra : extra;
        }
        setTimeout(function () { m.invalidateSize(); }, 60);
      });
    }
    function closeRoutePanel() {
      var pn = document.getElementById("ldpRPanel");
      if (!pn) return;
      S._rpgen = (S._rpgen || 0) + 1;   // stand down any in-flight geometry
      Array.prototype.forEach.call(pn.querySelectorAll(".ldp-jmap"), function (n) {
        if (n._ldmap) { try { n._ldmap.remove(); } catch (e) {} n._ldmap = null; }
      });
      pn.classList.remove("show");
    }
    function openRoutePanel(title, sub2, stopsHtml, zips, stopRows) {
      var pn = document.getElementById("ldpRPanel");
      if (!pn) return;
      S._rpgen = (S._rpgen || 0) + 1;
      var gen = S._rpgen;
      Array.prototype.forEach.call(pn.querySelectorAll(".ldp-jmap"), function (n) {
        if (n._ldmap) { try { n._ldmap.remove(); } catch (e) {} n._ldmap = null; }
      });
      pn.innerHTML =
        '<div class="ldp-rphd"><div><b>' + title + '</b><div class="ldp-sub" style="margin-top:3px">' + sub2 + "</div></div>"
        + '<button type="button" class="x rs-fp-x" id="ldpRPx" title="Close" aria-label="Close">&times;</button></div>'
        + '<div class="ldp-jmap ldp-rpmap"></div>'
        + '<div class="ldp-rpstops"><div class="ldp-sec" style="margin-top:10px">Stops: from base, each stop, then the empty return</div>'
        + stopsHtml + "</div>";
      pn.classList.add("show");
      document.getElementById("ldpRPx").onclick = closeRoutePanel;
      var box = pn.querySelector(".ldp-rpmap");
      var legs = [];
      for (var i = 0; i + 1 < zips.length; i++) legs.push(zips[i] + ":" + zips[i + 1]);
      if (!legs.length) { box.innerHTML = '<div style="padding:18px;color:var(--faint)">No mappable stops</div>'; return; }
      var qs = legs.join(",");
      var hdr = { headers: { Authorization: "Bearer " + ZTZ.getToken() } };
      var chk = function (r2) { if (!r2.ok) throw new Error("HTTP " + r2.status); return r2.json(); };
      var live = function () { return S._rpgen === gen && box.isConnected; };
      var draw = function (j) {
        var ok = j && j.legs && j.legs.some(function (l) { return l.coords && l.coords.length > 1; });
        if (!ok || !live()) return false;
        drawJourney(box, j.legs);
        // legacy itinerary: interleave every hop's miles + the explicit empty-return row
        var sl = pn.querySelector(".ldp-rpstops");
        if (sl && stopRows && stopRows.length) {
          var hop = function (lg) {
            return lg && lg.miles
              ? '<div class="ldp-rphop">~' + Math.round(lg.miles).toLocaleString() + " mi</div>" : "";
          };
          var h3 = '<div class="ldp-sec" style="margin-top:10px">Stops: from base, each stop, then the empty return</div>';
          stopRows.forEach(function (row2, i3) { h3 += hop(j.legs[i3]) + row2; });
          h3 += hop(j.legs[stopRows.length])
              + '<div class="ldp-rstop"><b>Return to base</b> <span class="ldp-sub">empty</span></div>';
          sl.innerHTML = h3;
        }
        return true;
      };
      fetch(ZTZ.API + "/api/_ldgeo?est=1&legs=" + encodeURIComponent(qs), hdr)
        .then(chk)
        .then(function (j) {
          var ok = draw(j);
          if (!ok && live()) box.innerHTML = '<div style="padding:18px;color:var(--faint)">Map unavailable \u2014 no geometry for these stops yet</div>';
          var need = j && j.legs && j.legs.some(function (l) { return l.source !== "here"; });
          if (ok && need && live())
            fetch(ZTZ.API + "/api/_ldgeo?legs=" + encodeURIComponent(qs), hdr)
              .then(chk).then(draw).catch(function () {});
        })
        .catch(function () { if (live()) box.innerHTML = '<div style="padding:18px;color:var(--faint)">Map unavailable</div>'; });
    }
    function drawFocused(box, r) {
      // legacy focused view, one job at a time: the leg already driven is grey dashed,
      // in-storage grey with its own wording, ahead-of-us orange, a carrier's leg violet
      if (!box) return;
      var dz = zipOnly(r["Moving To"]);
      if (!dz) return;
      var oz = zipOnly(r["Moving From"]);
      var ck = custKey(r);
      // goods in RENTED / third-party storage sit at the unit's address, not our base --
      // route the midpoint there when its zip is known (drawer facts already show it)
      var mid = LD_BASE_ZIP;
      if (ck === "tp") {
        var df = departFrom(r) || {};
        var sz2 = zipOnly(df.addr || String(r["Location Detail"] || ""));
        if (sz2 && sz2 !== dz) mid = sz2;
      }
      var plan = [];
      if (oz && oz !== dz && oz !== mid)
        plan.push({ a: oz, b: mid, kind: ck === "no" ? "collect" : ck === "tp" ? "stored" : "done" });
      plan.push({ a: mid, b: dz, kind: ck === "car" ? "carrier" : "ahead" });
      var qs = plan.map(function (l) { return l.a + ":" + l.b; }).join(",");
      var gen = S._dgen;
      var ctl = window.AbortController ? new AbortController() : null;
      S._dctl = ctl;
      var hdr = { headers: { Authorization: "Bearer " + ZTZ.getToken() } };
      if (ctl) hdr.signal = ctl.signal;
      var live = function () { return S._dgen === gen && box.isConnected; };
      var chk = function (r2) { if (!r2.ok) throw new Error("HTTP " + r2.status); return r2.json(); };
      var fail = function () {
        if (live()) box.innerHTML = '<div style="padding:14px;color:var(--faint)">Map unavailable</div>';
      };
      var draw = function (j) {
        var ok = j && j.legs && j.legs.some(function (l) { return l.coords && l.coords.length > 1; });
        if (!ok || !live()) return false;
        paintFocused(box, r, plan, j.legs, gen, mid);
        return true;
      };
      fetch(ZTZ.API + "/api/_ldgeo?est=1&legs=" + encodeURIComponent(qs), hdr)
        .then(chk)
        .then(function (j) {
          var ok = draw(j);
          if (!ok) fail();
          var need = j && j.legs && j.legs.some(function (l) { return l.source !== "here"; });
          // the refine is real HERE spend on the shared bridge: only for a drawer that is
          // still open on this same job, and only when the instant pass actually drew
          if (ok && need && live())
            fetch(ZTZ.API + "/api/_ldgeo?legs=" + encodeURIComponent(qs), hdr)
              .then(chk).then(draw).catch(function () {});
        })
        .catch(fail);
    }
    function paintFocused(box, r, plan, legs, gen, mid) {
      ensureLeaflet(function () {
        if (S._dgen !== gen || !box.isConnected) return;
        var m = box._ldmap;
        if (!m) {
          m = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.5 });
          /* CARTO NOW KEYS EVERY BASEMAP (2026-09-20) -- voyager, light_all and dark_all all come
           back with "API KEY REQUIRED" stamped across the tile. OpenStreetMap's own tiles need
           no key; they are busier than a data map wants, so the layer is dimmed and, in the dark
           theme, inverted, which puts the ground back behind the data. Same treatment as the
           county map on Seasonal Planning (area-plan.js). */
          var darkMap = !document.body.classList.contains("light");
          var tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
            { maxZoom: 18, opacity: darkMap ? 1 : .62, attribution: "\u00a9 OpenStreetMap" });
          tiles.addTo(m);
          if (tiles.getContainer()) tiles.getContainer().style.filter = darkMap
            ? "grayscale(1) invert(1) brightness(.82) contrast(.9)" : "grayscale(.55)";
          box._ldmap = m; box._ldlay = [];
        }
        (box._ldlay || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
        box._ldlay = [];
        var STYLES = {
          done: { color: V2C ? V2C.other : "#8A93A6", weight: 3, dashArray: "5 7", opacity: 0.8 },
          stored: { color: V2C ? V2C.other : "#8A93A6", weight: 3, dashArray: "5 7", opacity: 0.8 },
          collect: { color: V2C ? V2C.ctx : "#A7AEBC", weight: 2.5, dashArray: "3 6", opacity: 0.85 },
          ahead: { color: V2C ? V2C.accent : "#B26B0B", weight: 4, opacity: 0.9 },
          carrier: { color: V2C ? V2C.cat[4] : "#6C5CE0", weight: 3, dashArray: "6 7", opacity: 0.85 }
        };
        var LEGEND = { done: "in our hands \u2014 already collected",
                       stored: "in storage \u2014 already collected",
                       collect: "collection ahead \u2014 not picked up yet", ahead: "ahead of us",
                       carrier: "carrier leg \u2014 out of our hands" };
        var bounds = [], basePt = null, destPt = null, origPt = null;
        legs.forEach(function (lg, i) {
          var c = lg.coords || [];
          if (c.length < 2) return;
          var kind = (plan[i] || {}).kind || "ahead";
          var pl = L.polyline(c, STYLES[kind]).addTo(m);
          pl.bindTooltip(LEGEND[kind] + (lg.miles ? " \u00b7 ~" + Math.round(lg.miles).toLocaleString() + " mi" : ""),
            { sticky: true });
          box._ldlay.push(pl);
          c.forEach(function (p) { bounds.push(p); });
          if ((plan[i] || {}).b === mid) { origPt = c[0]; basePt = c[c.length - 1]; }
          if ((plan[i] || {}).a === mid) { basePt = basePt || c[0]; destPt = c[c.length - 1]; }
        });
        if (basePt)
          box._ldlay.push(L.marker(basePt, { icon: L.divIcon({ className: "",
            html: '<span class="ldp-mstop base">' + (mid === LD_BASE_ZIP ? "B" : "S") + "</span>",
            iconSize: [20, 20], iconAnchor: [10, 10] }) }).addTo(m)
            .bindTooltip(mid === LD_BASE_ZIP ? "NJ base" : "storage unit", { sticky: true }));
        if (origPt)
          box._ldlay.push(L.circleMarker(origPt, { radius: 5, color: "#fff", weight: 2,
            fillColor: V2C ? V2C.other : "#8A93A6", fillOpacity: 0.95 }).addTo(m).bindTooltip("pickup", { sticky: true }));
        if (destPt) {
          var col = OV_COLORS[String(r["Urgency"] || "")] || OV_COLORS[""];
          box._ldlay.push(L.circleMarker(destPt, { radius: 7, color: "#fff", weight: 2,
            fillColor: col, fillOpacity: 0.95 }).addTo(m)
            .bindTooltip("delivery \u00b7 " + esc(stateZip(r["Moving To"], r["Delivery State"]) || ""), { sticky: true }));
        }
        // a not-picked-up job whose collection leg could not be drawn (no mappable pickup
        // zip) would otherwise look exactly like goods sitting ready at base -- say so
        var missedPickup = custKey(r) === "no" && !legs.some(function (lg, i) {
          return (plan[i] || {}).b === mid && lg.coords && lg.coords.length > 1;
        });
        var cap = box.nextElementSibling;
        if (cap && !(cap.classList && cap.classList.contains("ldp-dmapnote"))) cap = null;
        if (missedPickup) {
          if (!cap) {
            cap = document.createElement("div");
            cap.className = "ldp-dmapnote";
            box.parentNode.insertBefore(cap, box.nextSibling);
          }
          cap.textContent = "Not collected yet \u2014 the pickup address has no mappable zip, so the collection leg is not drawn.";
        } else if (cap) cap.remove();
        if (bounds.length) m.fitBounds(bounds, { padding: [20, 20] });
        setTimeout(function () { m.invalidateSize(); if (bounds.length) m.fitBounds(bounds, { padding: [20, 20] }); }, 80);
      });
    }
    // portal-styled confirm; resolves the "Accept did nothing" report (native confirm()
    // can be suppressed/blocked silently) and removes the CDP tab-freeze hazard for good
    function ldpAsk(msg, onYes) {
      var w2 = document.getElementById("ldpAsk"), t = document.getElementById("ldpAskTxt");
      var y = document.getElementById("ldpAskYes"), n2 = document.getElementById("ldpAskNo");
      // markup missing (never in practice — it is static host HTML): fall back to the kit
      // confirm instead of silently auto-accepting, which would fire onYes with no question
      if (!w2) { RSC.confirm(msg).then(function (ok) { if (ok) onYes(); }); return; }
      t.textContent = msg;
      w2.classList.add("show");
      var close = function () { w2.classList.remove("show"); y.onclick = n2.onclick = w2.onclick = null; };
      y.onclick = function () { close(); onYes(); };
      n2.onclick = close;
      w2.onclick = function (e) { if (e.target === w2) close(); };
      y.focus();
    }
    function wire() {
      var q = host.querySelector("#ldpQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = host.querySelector("#ldpQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      // paint() rewrites the bar every repaint, so these mount fresh each time — no
      // duplicate-popover risk. Same option strings as the old option lists (S._cos/S._locs).
      // capture-phase: the kit button stops propagation, so the page's document-level
      // closer never fires — forget the open multi-select here, as any click elsewhere does
      var closeMs = function () { if (host.__msClose) host.__msClose(); };
      var co = host.querySelector("#ldpCo");
      if (co) { co.addEventListener("click", closeMs, true);
        RSC.localSelect(co, { label: "Company", values: S._cos || [], value: S.co,
          allLabel: "All", onChange: function (v) { S.co = v; paint(); } }); }
      var lo = host.querySelector("#ldpLoc");
      if (lo) { lo.addEventListener("click", closeMs, true);
        RSC.localSelect(lo, { label: "Location", values: S._locs || [], value: S.loc,
          allLabel: "All", onChange: function (v) { S.loc = v; paint(); } }); }
      var cl = host.querySelector("#ldpClr"); if (cl) cl.onclick = function () { S.q = ""; S.co = ""; S.loc = ""; S.kpi = ""; S.tlSeg = ""; S.ms = { type: [], cust: [], route: [] }; paint(); };
      var xb = host.querySelector("#ldpCsv");
      if (xb) xb.onclick = function () {
        var rows2 = S._bdRows || [];
        var cols2 = ["Customer", "Job Code", "Request #", "Company", "Type", "Possession",
                     "Moving From", "Moving To", "Delivery State", "Location", "FAD",
                     "Window End", "Depart By", "Urgency", "Do", "CF", "Foreman"];
        var escC = function (v) {
          v = v == null ? "" : String(v);
          return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        var csv = "\ufeff" + cols2.join(",") + "\r\n" + rows2.map(function (r2) {
          return cols2.map(function (c2) { return escC(r2[c2]); }).join(",");
        }).join("\r\n");
        var a2 = document.createElement("a");
        a2.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a2.download = "Long Distance Jobs " + new Date().toLocaleDateString("en-CA") + ".csv";
        a2.click();
        setTimeout(function () { URL.revokeObjectURL(a2.href); }, 4000);
      };
      if (S.view === "map" && S._bases == null && !S._basesLoading) {
        S._basesLoading = true;                     // the map draws a marker per depot
        fetch(ZTZ.API + "/api/_ldbases", { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
          .then(function (r) { return r.json(); })
          .then(function (j) { S._bases = (j && j.bases) || []; })
          .catch(function () { S._bases = []; })
          .then(function () { S._basesLoading = false; paint(); });
      }
      if (S.view === "map") drawOverview(host.querySelector(".ldp-ovmap"), S._mvRows || []);
      var ovf = host.querySelector("#ldpOvFull");
      if (ovf) ovf.onclick = function () {
        var bx = host.querySelector(".ldp-ovmap");
        if (!bx) return;
        var on = bx.classList.toggle("full");
        ovf.textContent = on ? "Exit fullscreen" : "Fullscreen";
        setTimeout(function () { if (bx._ldmap) bx._ldmap.invalidateSize(); }, 160);
      };
      if ((S._rsug == null || S._racc == null) && !S._rsugLoading) {
        S._rsugLoading = true;
        fetch(ZTZ.API + "/api/fct_ld_route_suggestions?limit=500",
              { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
          .then(function (r) { return r.json(); })
          .then(function (j) { S._rsug = j.rows || j.data || j || []; })
          .catch(function () { S._rsug = []; })
          .then(function () {
            return fetch(ZTZ.API + "/api/_ldroutes",
                         { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
              .then(function (r) { return r.json(); })
              .then(function (j) { S._racc = (j && j.routes) || []; })
              .catch(function () { S._racc = []; });
          })
          .then(function () { S._rsugLoading = false; paint(); });
      }
      // DECLINE + PUT BACK. Both go through the same /api/_ldroutes the accept uses, and both
      // reload the decision list so the card disappears (or returns) without a page reload.
      Array.prototype.forEach.call(host.querySelectorAll(".ldp-rdecline[data-decline]"), function (b) {
        b.onclick = async function () {
          var why = await RSC.ask({ title: "Decline this route — why?",
            body: "(optional, but it is what the next dispatcher will read)",
            value: "", yes: "Decline" });
          if (why === null) return;      // cancelled the dialog: do nothing
          b.disabled = true; b.textContent = "Declining…";
          try {
            var res = await fetch(ZTZ.API + "/api/_ldroutes", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ decline: true,
                                     codes: String(b.dataset.codes || "").split(",").filter(Boolean),
                                     truck: b.dataset.truck, miles: b.dataset.miles,
                                     reason: why }) });
            var j = await res.json();
            if (!res.ok || j.error) throw new Error(j.error || "decline failed");
            // same refresh contract as un-accept: drop the caches, let paint() refetch
            S._racc = null; S._rsug = null; paint();
          } catch (e) {
            b.disabled = false; b.textContent = "Decline";
            RSC.notice("Could not decline: " + (e && e.message));
          }
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-undecline]"), function (b) {
        b.onclick = async function () {
          b.disabled = true; b.textContent = "…";
          try {
            var res = await fetch(ZTZ.API + "/api/_ldroutes", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ undecline: +b.dataset.undecline }) });
            var j = await res.json();
            if (!res.ok || j.error) throw new Error(j.error || "failed");
            S._racc = null; S._rsug = null; paint();
          } catch (e) {
            b.disabled = false; b.textContent = "Put back";
            RSC.notice("Could not put it back: " + (e && e.message));
          }
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll(".ldp-raccept[data-codes]"), function (b) {
        b.onclick = function () {
          ldpAsk("Accept this route? Its jobs are locked out of future suggestions, and Regulars on it are planned as Straight. You can un-accept it afterwards from the Accepted routes list.", function () {
            b.disabled = true; b.textContent = "Accepting\u2026";
            fetch(ZTZ.API + "/api/_ldroutes", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ codes: b.getAttribute("data-codes").split(","),
                                     zips: (b.getAttribute("data-zips") || "").split(",").filter(Boolean),
                                     truck: b.getAttribute("data-truck"),
                                     miles: +b.getAttribute("data-miles") || null }) })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (j && j.accepted) { S._racc = null; paint(); }   // Accepted list + Un-accept appear at once
                else { b.disabled = false; b.textContent = "Accept route"; ldpAsk((j && j.error) || "Could not accept the route.", function () {}); }
              })
              .catch(function (e) { b.disabled = false; b.textContent = "Accept route"; ldpAsk("Could not accept: " + String(e), function () {}); });
          });
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-mapfor]"), function (b) {
        b.onclick = function () {
          var key = b.getAttribute("data-mapfor");
          var zips = (b.getAttribute("data-legzips") || "").split(",").filter(Boolean);
          // build the panel's header + stop list from the same data the card shows
          var title = "", sub2 = "", stopsHtml = "", pn0 = null;
          if (key.slice(0, 3) === "acc") {
            var acc = (S._racc || []).filter(function (x) { return "acc" + x.id === key; })[0] || {};
            var codes = String(acc.job_codes || "").split(",").filter(Boolean);
            title = codes.length + " stops \u00b7 accepted route";
            sub2 = "truck " + esc(acc.truck || "?") + (acc.miles ? " \u00b7 ~" + (+acc.miles).toLocaleString() + " mi" : "")
                 + " \u00b7 accepted " + esc(String(acc.accepted_at || "").slice(0, 16));
            pn0 = codes.map(function (c2, i2) {
              return '<div class="ldp-rstop"><span class="rn">' + (i2 + 1) + "</span><b>" + esc(c2) + "</b></div>";
            });
            stopsHtml = pn0.join("");
          } else {
            var st = ((S._rsug || []).filter(function (x) { return String(x["Route Key"]) === key; }))
              .sort(function (a2, b2) { return a2["Seq"] - b2["Seq"]; });
            var h2 = st[0] || {};
            title = st.length + " stops \u00b7 " + Math.round(h2["Route CF"] || 0).toLocaleString() + " cf";
            var mpc2 = (+h2["Miles"] && +h2["Route CF"])
              ? ((+h2["Miles"]) / (+h2["Route CF"])).toFixed(1) : null;
            var dm2 = Math.round(+h2["Drive Min"] || 0);
            sub2 = "truck " + esc(h2["Truck"] || "?") + " \u00b7 ~" + (+h2["Miles"] || 0).toLocaleString()
                 + " mi \u00b7 " + (dm2 ? Math.floor(dm2 / 60) + "h " + (dm2 % 60) + "m drive \u00b7 " : "")
                 + (mpc2 ? mpc2 + " mi/cf \u00b7 " : "")
                 + "detour " + (h2["Detour Min"] != null ? h2["Detour Min"] : "?") + " min"
                 + (+h2["Feasible"] ? "" : ' \u00b7 <b style="color:var(--neg)">schedule tight</b>'
                     + (h2["Feasible Note"] ? '<div style="margin-top:2px">'
                        + esc(h2["Feasible Note"]) + "</div>" : ""));
            pn0 = st.map(function (x, i2) {
              return '<div class="ldp-rstop"><span class="rn">' + (i2 + 1) + "</span><b>"
                + esc(x["Customer"] || x["Job Code"]) + "</b> <span class=\"ldp-sub\">"
                + esc((x["Dest State"] || "") + " " + (x["Dest Zip"] || "")) + " \u00b7 "
                + Math.round(x["CF"]) + " cf \u00b7 "
                + (+x["Converts"] ? "by " + fmtD(x["Window End"]) + " (window)"
                                  : "deliver " + fmtD(x["Window End"]) + " (fixed)") + "</span></div>";
            });
            stopsHtml = pn0.join("");
          }
          openRoutePanel(title, sub2, stopsHtml, zips, pn0);
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-unacc]"), function (b) {
        b.onclick = function () {
          ldpAsk("Un-accept this route? Its jobs return to Route Candidate and to the suggestion pool on the next rebuild.", function () {
            b.disabled = true; b.textContent = "Un-accepting\u2026";
            fetch(ZTZ.API + "/api/_ldroutes", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify({ cancel: +b.getAttribute("data-unacc") }) })
              .then(function (r) { return r.json(); })
              .then(function (j) {
                if (j && j.cancelled) { S._racc = null; S._rsug = null; paint(); }
                else { b.disabled = false; b.textContent = "Un-accept"; ldpAsk((j && j.error) || "Could not un-accept.", function () {}); }
              })
              .catch(function (e) { b.disabled = false; b.textContent = "Un-accept"; ldpAsk("Could not un-accept: " + String(e), function () {}); });
          });
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-ldview]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-ldview"); paint(); };
      });
      var tlb = host.querySelector(".ldp-tlbody");
      // The header is OUTSIDE the scrolling body, so the body's scrollbar made its calendar
      // track narrower than the ruler above it -- ~10px over 1827px, half a day's drift at
      // the right edge. Reserve the same gutter on the header; measured, because the width
      // is 10px here, 15 on some machines and 0 with overlay scrollbars.
      if (tlb) {
        var head0 = host.querySelector(".ldp-tlhead");
        var sbw = tlb.offsetWidth - tlb.clientWidth;
        if (head0) head0.style.paddingRight = (sbw > 0 ? sbw : 0) + "px";
      }
      if (tlb) tlb.onmousedown = function (e) {
        if (e.button !== 0) return;
        var calEl = tlb.querySelector(".ldp-tlcal");
        var pxday = Math.max(4, (calEl ? calEl.clientWidth : tlb.clientWidth * 0.7) / (S._tlDays || 42));
        var x0 = e.clientX, anchor = S._tlAnchor, moved = false;
        var mm = function (e2) {
          var d3 = Math.round((x0 - e2.clientX) / pxday);
          if (d3 !== 0) {
            var dt2 = new Date(anchor + "T12:00:00");
            dt2.setDate(dt2.getDate() + d3);
            var iso = dt2.toLocaleDateString("en-CA");
            if (iso !== S.tlStart) { moved = true; S.tlStart = iso; paint(); }
          }
        };
        var mu = function () {
          document.removeEventListener("mousemove", mm);
          document.removeEventListener("mouseup", mu);
          if (moved) {   // swallow the click the drag would otherwise deliver to a row
            var sw = function (ev) { ev.stopPropagation(); ev.preventDefault();
              document.removeEventListener("click", sw, true); };
            document.addEventListener("click", sw, true);
            setTimeout(function () { document.removeEventListener("click", sw, true); }, 120);
          }
        };
        document.addEventListener("mousemove", mm);
        document.addEventListener("mouseup", mu);
        e.preventDefault();
      };
      // ---- multi-select filters: the kit's RSC.localMulti (ZTZ-80; same options, same counts,
      // state still in S.ms). A tick repaints the whole body, so the popover is remounted OPEN on
      // the dimension in S.msOpen and the reader keeps ticking; a click anywhere else forgets it
      // (host.__msClose below) and the kit's own document click closes the popover.
      [["type", "Type", "ldpMsType"], ["cust", "Status", "ldpMsCust"], ["route", "Routing", "ldpMsRoute"]].forEach(function (d) {
        var mh = host.querySelector("#" + d[2]);
        if (!mh) return;
        // capture phase: the kit button stops propagation. Opening remembers the dimension, so
        // a repaint that lands while it is open (the route data arriving) keeps it open.
        mh.addEventListener("click", function (e) {
          closeMs();
          var pop = mh.querySelector(".rs-slicer-pop");
          if (e.target.closest && e.target.closest(".rs-slicer-btn") && pop && pop.classList.contains("hidden")) S.msOpen = d[0];
        }, true);
        RSC.localMulti(mh, { label: d[1], values: (S._ms || {})[d[0]] || [], selected: S.ms[d[0]] || [],
          emptyLabel: "All", startOpen: S.msOpen === d[0],
          onChange: function (set) { S.ms[d[0]] = Array.from(set); S.msOpen = d[0]; paint(); } });
      });
      // one outside-click closer for the whole page
      if (!host.__msClose) {
        host.__msClose = function () { S.msOpen = ""; };
        document.addEventListener("click", host.__msClose);
      }

      Array.prototype.forEach.call(host.querySelectorAll("[data-tlseg]"), function (b) {
        b.onclick = function () { S.tlSeg = b.getAttribute("data-tlseg"); paint(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-kpi]"), function (b) {
        b.onclick = function () {
          var k = b.getAttribute("data-kpi");
          S.kpi = (S.kpi === k) ? "" : k;   // click again to release
          paint();
        };
        // the cards carry role=button + tabindex — Enter/Space must work, not just the mouse
        b.onkeydown = function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); b.onclick(); }
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-tl]"), function (b) {
        b.onclick = function () {
          var a = b.getAttribute("data-tl");
          if (a === "today") S.tlStart = null;
          else {
            // Step from what is on SCREEN (the default anchor is today-7, not today).
            // tlStart() is scoped inside paint() and NOT visible here — calling it,
            // as the review verifier "confirmed", throws on every click — so the
            // anchor is computed inline. Stored as the LOCAL date: toISOString gave
            // the UTC day, one off for a US viewer at night.
            var d0;
            if (S.tlStart) d0 = new Date(S.tlStart + "T12:00:00");
            else if (S._tlAnchor) d0 = new Date(S._tlAnchor + "T12:00:00");   // the auto-fit start on screen
            else { d0 = new Date(); d0.setDate(d0.getDate() - 7); }
            d0.setDate(d0.getDate() + (a === "next" ? 14 : -14));
            S.tlStart = d0.toLocaleDateString("en-CA");
          }
          paint();
        };
      });
      // timeline rows open the SAME drawer as the board rows
      Array.prototype.forEach.call(host.querySelectorAll(".ldp-tlrow[data-ldk]"), function (row) {
        row.onclick = function () {
          var k = row.getAttribute("data-ldk");
          if (host.__ldpOpen) host.__ldpOpen(k === S.sel ? null : k);
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("tr.ldp-row"), function (tr) {
        tr.onclick = function () {
          var k = tr.getAttribute("data-ldk");
          // openDrawer is closed over paint()'s row list, so it is reached via the handle
          // paint() publishes rather than by name — wire() is a different scope.
          if (host.__ldpOpen) host.__ldpOpen(k === S.sel ? null : k);
        };
      });
      // the manual-fields form: Save posts ONLY what changed, each change keeps history
      wireForms(host);
    }

    // Form wiring is scoped to a ROOT so it can bind either the page or the drawer.
    function wireForms(root) {
      Array.prototype.forEach.call(root.querySelectorAll("[data-ldpform]"), function (box) {
        box.onclick = function (e) { e.stopPropagation();
          // this swallow also blocks the kit popovers' document-level closer — the drawer's
          // Location localSelect would stay open across a click into the form; close it here
          document.querySelectorAll(".rs-slicer-pop").forEach(function (p) { p.classList.add("hidden"); });
        };
        var btn = box.querySelector(".ldp-savebtn");
        if (!btn) return;
        btn.onclick = async function () {
          var co = box.getAttribute("data-co"), rq = box.getAttribute("data-req");
          var sr = box.getAttribute("data-row") || "";   // LD row identity (per-trip key)
          var en = entFor(co, rq, sr);
          var posts = [];
          Array.prototype.forEach.call(box.querySelectorAll("[data-ldf]"), function (inp) {
            var f = inp.getAttribute("data-ldf");
            var cur = en[f] && en[f].value != null ? String(en[f].value) : "";
            var val = String(inp.value || "").trim();
            if (val !== cur) posts.push({ field: f, value: val === "" ? null : val });
          });
          if (!posts.length) return;
          btn.disabled = true; btn.textContent = "Saving…";
          var info = box.querySelector(".ldp-saveinfo");
          try {
            for (var i = 0; i < posts.length; i++) {
              var res = await fetch(ZTZ.API + "/api/_ldp", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
                body: JSON.stringify({ company: co, request_no: rq, sheet_row: sr,
                                       field: posts[i].field, value: posts[i].value }),
              });
              var j = await res.json().catch(function () { return {}; });
              if (!res.ok || !j.ok) throw new Error(j.error || ("HTTP " + res.status));
            }
            await loadEntries(); paint();
            // success must restore the control it disabled, and the drawer must show the
            // POST-save state — paint() only rewrites #ldpBody, never the drawer
            btn.disabled = false; btn.textContent = "Save";
            if (S.sel && host.__ldpOpen) host.__ldpOpen(S.sel);
          } catch (err) {
            btn.disabled = false; btn.textContent = "Save";
            if (info) info.textContent = "couldn’t save: " + String(err && err.message || err);
          }
        };
      });
    }

    await loadEntries();
    paint();
  },
});
