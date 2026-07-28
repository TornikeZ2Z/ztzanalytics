/* LONG DISTANCE PLANNING — the situation board (LOGISTICS group). V1 per Tornike's
   brief 2026-07-21: every UNDELIVERED long-distance shipment, WHERE it physically is
   (storage system / sheet / truck / carrier), and the DELIVERY WINDOW (FAD + timeframe
   from the calendar) with urgency. Two views: the LIVE BOARD (real open jobs, sorted by
   deadline) and DATA CLEANUP (rows the office should fix in the sheets: carrier-evidence,
   stale, cancelled, sibling-delivered, left-storage). Data: fct_ld_planning (pipeline).
   Planning actions (manual transit days, trip grouping) come in v2. */

(function () {
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
             "Type", "Trip Days", "Depart By", "Urgency", "Urgency Reason", "Do"],
    };
  }
})();

registerPage({
  id: "ld-planning",
  group: "logistics",
  title: "Long Distance Planning",
  async render(host) {
    var esc = RSC.esc;
    var POS = "#1c7a4a", NEG = "#b02a37", BLUE = "#2f6fd0", WARN = "#a06a00";

    if (!document.getElementById("ldpCss")) {
      var st = document.createElement("style"); st.id = "ldpCss";
      st.textContent = `
        .ldp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .ldp-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .ldp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
        .ldp-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px;cursor:pointer;transition:border-color .12s,box-shadow .12s;user-select:none}
        .ldp-kpi:hover{border-color:var(--brand)}
        .ldp-kpi.sel{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand);background:var(--brand-glow)}
        .ldp-kpi b{display:block;font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .ldp-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
        .ldp-kpi small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .ldp-kpi.neg b{color:${NEG}} .ldp-kpi.warn b{color:${WARN}} .ldp-kpi.pos b{color:${POS}}
        .ldp-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .ldp-fbox{display:flex;align-items:center;gap:0;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:4px 4px 4px 10px;flex-wrap:wrap}
        .ldp-srch{display:flex;align-items:center;gap:7px;color:var(--faint)}
        .ldp-srch input{font:inherit;font-size:13px;background:transparent;color:var(--ink);border:0;outline:none;padding:7px 4px;min-width:270px}
        .ldp-fdiv{width:1px;align-self:stretch;background:var(--line);margin:4px 10px}
        .ldp-fl{display:flex;align-items:center;gap:6px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);padding-right:8px}
        .ldp-fl select{font:inherit;font-size:12.5px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink);background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;padding:6px 8px;cursor:pointer}
        .ldp-fl select:focus{outline:none;border-color:var(--brand)}
        .ldp-clr{font:inherit;font-size:12px;font-weight:700;color:var(--muted);background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;padding:6px 12px;cursor:pointer;margin-right:4px}
        .ldp-clr:hover{border-color:var(--brand);color:var(--ink)}
        .ldp-count{font-size:12.5px;font-weight:600;color:var(--muted);margin-left:auto}
        .ldp-count b{font-size:15px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
        .ldp-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px}
        .ldp-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13.5px;font-weight:800;padding:8px 18px;border-radius:8px}
        .ldp-seg button.on{background:var(--brand);color:var(--brand-ink)}
        .ldp-seg button i{font-style:normal;font-weight:800;font-size:11px;opacity:.75;margin-left:6px}
        .ldp-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:200px}
        .ldp-sel{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 10px}
        /* TABLE — deliberately the same language as Money Flow (his ask 2026-07-27): one
           card, --line-2 border, sticky 11.5px uppercase headers, uniform row height and
           strictly SINGLE-LINE cells that ellipsise. The old board stacked three lines into
           several cells, which is what made it read as cluttered; everything that used to be
           crammed in now lives in the detail drawer. */
        .ldp-card{position:relative;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
        .ldp-wrap{overflow-y:auto;overflow-x:auto;max-height:calc(100vh - 330px);min-height:320px}
        .ldp-tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:1280px}
        .ldp-tbl th{position:sticky;top:0;z-index:2;background:var(--panel);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;user-select:none}
        .ldp-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}
        .ldp-tbl tbody tr{height:62px}
        .ldp-tbl .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .ldp-tbl tbody tr.ldp-row{cursor:pointer}
        .ldp-tbl tbody tr.ldp-row:hover{background:var(--panel-2)}
        .ldp-tbl tbody tr.ldp-row.on{background:var(--brand-glow)}
        .ldp-tbl tbody tr.u-red>td:first-child{box-shadow:inset 3px 0 0 ${NEG}}
        .ldp-tbl tbody tr.u-amber>td:first-child{box-shadow:inset 3px 0 0 ${WARN}}
        .ldp-tbl tbody tr.u-red>td{background:rgba(176,42,55,.035)}
        .ldp-tbl tbody tr.u-red:hover>td{background:rgba(176,42,55,.07)}
        .ldp-cust-td{padding-left:15px!important}
        .ldp-cust-td .ldp-sub{display:block;margin-top:1px}
        .ldp-hbegin{color:var(--ink)!important}
        .ldp-begin .ldp-dt{font-size:14.5px}
        .ldp-when{font-size:11px;font-weight:800;letter-spacing:.02em;margin-top:1px}
        .ldp-when.ok{color:var(--faint)}
        .ldp-when.soon{color:${WARN}}
        .ldp-when.late{color:${NEG}}
        .ldp-nodate{font-size:12.5px;font-weight:700;color:var(--faint)}
        .ldp-cust{font-weight:700;color:var(--ink)}
        .ldp-ty{display:inline-block;font-size:11px;font-weight:800;padding:2px 9px;border-radius:999px;white-space:nowrap;letter-spacing:.01em}
        .ldp-ty.s{background:rgba(160,106,0,.15);color:${WARN}}
        .ldp-ty.r{background:rgba(47,111,208,.13);color:${BLUE}}
        /* the calendar-jobs cell carries two stacked links + a status pill, so it is the one
           cell allowed to be taller than a single line */
        .ldp-tbl td.ldp-jobstd{white-space:normal;max-width:250px;padding-top:7px;padding-bottom:7px}
        .ldp-sub{font-size:11.5px;color:var(--faint);font-weight:600}
        /* ---- right-side detail drawer ---- */
        /* pointer-events MUST toggle with visibility: an opacity-0 fixed overlay still
           hit-tests and would make the whole page unclickable while it sat there. */
        .ldp-scrim{position:fixed;inset:0;background:rgba(15,23,42,.34);z-index:60;opacity:0;transition:opacity .18s;backdrop-filter:blur(1px);pointer-events:none;visibility:hidden}
        .ldp-scrim.show{opacity:1;pointer-events:auto;visibility:visible}
        /* The drawer is READ-ONLY now, so it is a briefing card, not a form: a floating panel
           with a tinted header, sections as cards, and label/value rows that read as data. */
        .ldp-drawer{position:fixed;top:10px;right:10px;height:calc(100vh - 20px);width:min(620px,96vw);
          background:var(--panel);z-index:61;border:1px solid var(--line);border-radius:18px;
          box-shadow:0 24px 60px rgba(0,0,0,.28),0 2px 8px rgba(0,0,0,.10);
          transform:translateX(calc(100% + 18px));transition:transform .26s cubic-bezier(.32,.72,0,1),opacity .2s;
          display:flex;flex-direction:column;visibility:hidden;opacity:0;overflow:hidden}
        .ldp-drawer.show{transform:none;visibility:visible;opacity:1}
        @media (prefers-reduced-motion:reduce){.ldp-drawer{transition:none}}
        .ldp-dhd{padding:17px 19px 15px;position:relative;flex:0 0 auto;
          background:linear-gradient(180deg,color-mix(in srgb,var(--blue) 9%,var(--panel)),var(--panel));
          border-bottom:1px solid var(--line)}
        .ldp-dhd .x{position:absolute;top:14px;right:14px;border:1px solid var(--line);background:var(--panel);
          color:var(--muted);width:30px;height:30px;border-radius:10px;cursor:pointer;font-size:14px;line-height:1;
          transition:background .12s,color .12s}
        .ldp-dhd .x:hover{color:var(--ink);background:var(--panel-2)}
        .ldp-dnm{font-size:21px;font-weight:850;letter-spacing:-.4px;padding-right:40px;line-height:1.2}
        .ldp-dmeta{font-size:11.5px;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums}
        .ldp-dpills{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
        .ldp-dbody{overflow-y:auto;padding:15px 19px 30px;flex:1;scrollbar-width:thin}
        .ldp-sec{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);
          margin:17px 0 7px;display:flex;align-items:center;gap:9px}
        .ldp-sec::after{content:"";flex:1;height:1px;background:var(--line)}
        .ldp-sec:first-child{margin-top:0}
        .ldp-stage{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.03em;padding:2px 8px;border-radius:999px;white-space:nowrap}
    .ldp-stage.p{background:rgba(37,99,235,.11);color:var(--blue)}
    .ldp-stage.d{background:rgba(28,122,74,.12);color:${POS}}
    .ldp-from{font-size:11.5px;font-weight:650;color:var(--ink);line-height:1.3;display:block;white-space:normal}
    .ldp-fromtd{max-width:200px;white-space:normal}
    .ldp-addr{font-size:12.5px;font-weight:600;color:var(--muted);line-height:1.4;margin-top:3px;white-space:normal}
    .ldp-whsub{white-space:normal !important;overflow:visible !important;text-overflow:clip !important}
    .ldp-big{font-size:16px;font-weight:800;letter-spacing:-.2px;line-height:1.25;display:block}
        .ldp-kv{display:grid;grid-template-columns:124px minmax(0,1fr);gap:0 14px;font-size:13.5px;align-items:baseline;
          background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:4px 12px}
        .ldp-kv dt{color:var(--faint);font-weight:700;padding:9px 0;border-top:1px solid var(--line);font-size:12px}
        .ldp-kv dd{margin:0;color:var(--ink);font-weight:650;word-break:break-word;padding:9px 0;border-top:1px solid var(--line)}
        .ldp-kv dt:first-of-type,.ldp-kv dt:first-of-type + dd{border-top:0}
        .ldp-dnote{font-size:12.5px;line-height:1.5;color:var(--ink);background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px}
        .ldp-dissue{font-size:12.5px;line-height:1.5;font-weight:700;color:${WARN};background:rgba(160,106,0,.10);border:1px solid rgba(160,106,0,.28);border-radius:10px;padding:10px 12px}
        .ldp-dissue.blk{color:${NEG};background:rgba(176,42,55,.09);border-color:rgba(176,42,55,.28)}
        /* ================= TIMELINE VIEW =================
           Modelled on his own longdistance.html planner: a 42-day grid where a STRAIGHT job
           is drawn as depart-marker -> trip bar -> deadline diamond (one committed date) and
           a REGULAR job as a window band (delivered anywhere inside it). Two different
           planning shapes, so they must not look alike. Pickup is a hollow circle, today is
           a tinted column, and a deadline outside the window collapses to an edge chevron
           rather than vanishing. */
        .ldp-tlbar{display:flex;align-items:center;gap:16px;margin:0 0 12px;flex-wrap:wrap}
        .ldp-tlnav{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:11px;overflow:hidden}
        .ldp-tlnav button{border:0;border-right:1px solid var(--line);background:none;font:inherit;font-size:13px;font-weight:700;color:var(--ink);padding:8px 14px;cursor:pointer}
        .ldp-tlnav button:last-child{border-right:0}
        .ldp-tlnav button:hover{background:var(--panel-2)}
        .ldp-tlrange{font-size:19px;font-weight:800;letter-spacing:-.3px;line-height:1.05}
        .ldp-tlrange small{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:2px}
        .ldp-tloff{font-size:11.5px;font-weight:700;color:${WARN};background:rgba(160,106,0,.10);border:1px solid rgba(160,106,0,.26);border-radius:999px;padding:5px 12px}
        .ldp-tllg{display:flex;gap:15px;margin-left:auto;font-size:12px;color:var(--muted);flex-wrap:wrap;align-items:center}
        .ldp-tllg span{display:flex;align-items:center;gap:6px}
        .lg-pk{width:11px;height:11px;border-radius:50%;border:2px solid var(--faint);background:var(--panel);flex:0 0 auto}
        .lg-hold{width:22px;height:4px;border-radius:2px;background:rgba(160,106,0,.5);flex:0 0 auto}
        .lg-s{position:relative;width:22px;height:3px;background:var(--line-2);border-radius:2px;flex:0 0 auto}
        .lg-s::after{content:"";position:absolute;right:-2px;top:50%;width:10px;height:10px;border-radius:2px;background:${WARN};transform:translateY(-50%) rotate(45deg)}
        .lg-r{width:24px;height:14px;border-radius:4px;background:rgba(47,111,208,.13);border:1px solid rgba(47,111,208,.35);border-left:3px solid ${BLUE};flex:0 0 auto}
        .ldp-tlgrid{position:relative;border:1px solid var(--line-2);border-radius:14px;overflow:hidden;background:var(--panel)}
        .ldp-tlhead{display:flex;height:50px;background:var(--panel-2);border-bottom:1px solid var(--line-2)}
        .ldp-tlhlab{width:236px;flex:0 0 236px;border-right:1px solid var(--line)}
        .ldp-tlhcal{position:relative;flex:1;min-width:0}
        .ldp-tlmon{position:absolute;top:7px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);padding-left:6px}
        .ldp-tlday{position:absolute;bottom:6px;font-size:11.5px;color:var(--faint);font-weight:700;transform:translateX(-50%)}
        .ldp-tltodaylab{position:absolute;top:0;transform:translateX(-50%);font-size:9.5px;font-weight:800;letter-spacing:.08em;color:#fff;background:${NEG};padding:3px 7px 2px;border-radius:0 0 7px 7px;z-index:3}
        .ldp-tlbody{max-height:calc(100vh - 360px);overflow-y:auto}
        .ldp-tlrow{display:flex;min-height:46px;border-bottom:1px solid var(--line);cursor:pointer}
        .ldp-tlrow:last-child{border-bottom:0}
        .ldp-tlrow:hover{background:var(--panel-2)}
        .ldp-tlrow.on{background:var(--brand-glow)}
        .ldp-tlrow.u-red{box-shadow:inset 3px 0 0 ${NEG}}
        .ldp-tlrow.u-amber{box-shadow:inset 3px 0 0 ${WARN}}
        .ldp-tllab{width:262px;flex:0 0 262px;border-right:1px solid var(--line);padding:0 12px;display:flex;align-items:center;gap:9px}
        .ldp-tlmk{flex:0 0 auto;display:flex;align-items:center;justify-content:center;width:20px}
        .ldp-tlmk.s::before{content:"";width:12px;height:12px;background:${WARN};border-radius:2px;transform:rotate(45deg)}
        .ldp-tlmk.r::before{content:"";width:18px;height:12px;border-radius:3px;background:rgba(47,111,208,.13);border:1px solid rgba(47,111,208,.35);border-left:3px solid ${BLUE}}
        .ldp-tllabtx{min-width:0;flex:1}
        .ldp-tllabtx b{display:block;font-size:13.5px;font-weight:800;letter-spacing:-.2px;line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .ldp-tllabtx span{display:block;font-size:11.5px;color:var(--faint);font-weight:600;line-height:1.2;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .ldp-tlcal{position:relative;flex:1;min-width:0;overflow:hidden;background-image:repeating-linear-gradient(to right,var(--line) 0 1px,transparent 1px calc(100%/6))}
        .ldp-tlcal.grabbing{cursor:grabbing}
        .ldp-tlband{position:absolute;top:0;bottom:0;background:rgba(176,42,55,.055);z-index:0}
        .ldp-tltoday{position:absolute;top:0;bottom:0;width:2px;background:${NEG};opacity:.5;z-index:1}
        .ldp-tlpk{position:absolute;top:50%;width:11px;height:11px;border-radius:50%;transform:translate(-50%,-50%);background:var(--panel);border:2px solid var(--faint);z-index:5}
        .ldp-tltrip{position:absolute;top:50%;height:3px;transform:translateY(-50%);border-radius:2px;background:var(--line-2);z-index:2}
        .ldp-tltrip.u-amber{background:rgba(160,106,0,.45)} .ldp-tltrip.u-red{background:rgba(176,42,55,.45)}
        .ldp-tldep{position:absolute;top:50%;width:10px;height:10px;border-radius:50%;transform:translate(-50%,-50%);background:var(--faint);border:2px solid var(--panel);z-index:3}
        .ldp-tldep.u-amber{background:${WARN}} .ldp-tldep.u-red{background:${NEG}}
        .ldp-tldead{position:absolute;top:50%;transform:translate(-8px,-50%);display:flex;align-items:center;gap:7px;z-index:4;white-space:nowrap}
        .ldp-tldead.lft{transform:translate(calc(-100% + 8px),-50%)}
        .ldp-tldead.off{transform:translateY(-50%);gap:3px}
        .ldp-tldead .chev{font-size:14px;font-weight:800;color:var(--faint)}
        .ldp-tldead .dot{flex:0 0 auto;width:14px;height:14px;border-radius:3px;background:${WARN};transform:rotate(45deg);box-shadow:0 0 0 3px var(--panel)}
        .ldp-tldead .dt{font-size:12.5px;font-weight:700;color:${WARN}}
        .ldp-tldead.u-red .dot{background:${NEG}} .ldp-tldead.u-red .dt{color:${NEG}}
        .ldp-tlwin{position:absolute;top:50%;height:28px;transform:translateY(-50%);border-radius:8px;background:rgba(47,111,208,.10);border:1px solid rgba(47,111,208,.32);border-left:3px solid ${BLUE};display:flex;align-items:center;padding:0 10px;z-index:2;overflow:hidden}
        .ldp-tlwin .dt{font-size:12px;font-weight:700;color:${BLUE};overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
        .ldp-tlwin.u-amber{background:rgba(160,106,0,.10);border-color:rgba(160,106,0,.32);border-left-color:${WARN}}
        .ldp-tlwin.u-amber .dt{color:${WARN}}
        .ldp-tlwin.u-red{background:rgba(176,42,55,.09);border-color:rgba(176,42,55,.30);border-left-color:${NEG}}
        .ldp-tlwin.u-red .dt{color:${NEG}}
        /* custody + holding, on the timeline */
        .ldp-tlcust{display:inline-block;font-size:9px;font-weight:800;padding:1px 6px;border-radius:999px;white-space:nowrap;letter-spacing:.02em;margin:0;flex:0 0 auto}
        .ldp-tlmeta{display:flex!important;align-items:center;gap:6px;margin-top:2px;font-variant-numeric:tabular-nums}
        .ldp-tlcust.us{background:rgba(28,122,74,.14);color:${POS}}
        .ldp-tlcust.car{background:rgba(47,111,208,.14);color:${BLUE}}
        .ldp-tlcust.tp{background:rgba(160,106,0,.15);color:${WARN}}
        .ldp-tlcust.unk{background:rgba(176,42,55,.11);color:${NEG}}
        .ldp-tlcust.no{background:var(--panel-2);color:var(--muted)}
        .ldp-tlhold.no{background:var(--line-2)}
        .ldp-tltype{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-left:6px}
        /* how long the goods have been in our hands: pickup -> today */
        .ldp-tlhold{position:absolute;top:72%;height:4px;border-radius:2px;z-index:1;opacity:.8}
        .ldp-tlhold.us{background:rgba(28,122,74,.5)}
        .ldp-tlhold.car{background:rgba(47,111,208,.5)}
        .ldp-tlhold.tp{background:rgba(160,106,0,.5)}
        .ldp-tlhold.unk{background:rgba(176,42,55,.42)}
        .ldp-tlheld{position:absolute;top:72%;transform:translate(6px,-45%);font-size:10px;font-weight:800;color:var(--faint);white-space:nowrap;z-index:2}
        /* quick segmentation chips */
        .ldp-tlf{display:flex;gap:9px;flex-wrap:wrap;margin:0;align-items:center}
        /* compact board: it must fit the viewport without sideways scrolling */
        .ldp-tbl{font-size:12px}
        .ldp-tbl thead th{font-size:9.5px;letter-spacing:.05em;padding:7px 8px;white-space:nowrap}
        .ldp-tbl tbody td{padding:7px 8px;vertical-align:top}
        .ldp-tbl tbody td .ldp-sub{font-size:10.5px;line-height:1.3}
        .ldp-wrap{overflow-x:auto}
        @media (min-width:1240px){.ldp-wrap{overflow-x:visible}.ldp-tbl{table-layout:fixed;width:100%}
          .ldp-tbl td,.ldp-tbl th{overflow:hidden;text-overflow:ellipsis}}
        .ldp-ms{position:relative}
        .ldp-msb{font:inherit;font-size:12px;font-weight:650;color:var(--ink);background:var(--panel);
          border:1px solid var(--line-2);border-radius:10px;padding:7px 12px;cursor:pointer;display:inline-flex;
          align-items:center;gap:7px;white-space:nowrap}
        .ldp-msb:hover{border-color:var(--blue)}
        .ldp-msb.on{border-color:var(--blue);box-shadow:0 0 0 2px color-mix(in srgb,var(--blue) 18%, transparent)}
        .ldp-msb .cap{color:var(--faint);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
        .ldp-msb .cnt{background:var(--blue);color:#fff;border-radius:999px;font-size:10.5px;padding:1px 7px;font-weight:800}
        .ldp-mspop{position:absolute;z-index:60;top:calc(100% + 6px);left:0;min-width:225px;background:var(--panel);
          border:1px solid var(--line);border-radius:12px;box-shadow:var(--shadow);padding:7px;max-height:320px;overflow:auto}
        .ldp-mspop.hidden{display:none}
        .ldp-msopt{display:flex;align-items:center;gap:9px;padding:6px 9px;border-radius:8px;cursor:pointer;font-size:12.5px;color:var(--ink)}
        .ldp-msopt:hover{background:var(--panel-2)}
        .ldp-msopt input{margin:0;cursor:pointer}
        .ldp-msopt .n{margin-left:auto;color:var(--faint);font-variant-numeric:tabular-nums;font-size:11.5px}
        .ldp-msact{display:flex;gap:8px;border-top:1px solid var(--line);margin-top:6px;padding-top:7px}
        .ldp-msact button{font:inherit;font-size:11.5px;font-weight:650;color:var(--blue);background:none;border:0;cursor:pointer;padding:2px 5px}
        .ldp-tlchip{font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:999px;padding:5px 12px;cursor:pointer;white-space:nowrap}
        .ldp-tlchip:hover{border-color:var(--brand)}
        .ldp-tlchip.on{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}
        .ldp-tlchip i{font-style:normal;opacity:.7;margin-left:5px;font-weight:800}
        .ldp-vw{display:inline-flex;background:var(--panel);border:1px solid var(--line-2);border-radius:11px;overflow:hidden}
        .ldp-vw button{border:0;border-right:1px solid var(--line);background:none;font:inherit;font-size:13px;font-weight:700;color:var(--muted);padding:8px 16px;cursor:pointer}
        .ldp-vw button:last-child{border-right:0}
        .ldp-vw button.on{background:var(--brand);color:var(--brand-ink)}
        /* pickup / delivery jobs + delivery status */
        .ldp-jobs{display:flex;flex-direction:column;gap:3px;align-items:flex-start}
        .ldp-whsub{max-width:210px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .ldp-callink{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;color:var(--blue);text-decoration:none;border:1px solid var(--line-2);border-radius:8px;padding:2px 8px;background:var(--panel);white-space:nowrap}
        .ldp-callink:hover{border-color:var(--blue)}
        .ldp-nolink{font-size:11.5px;color:var(--faint);font-weight:600}
        .ldp-dstat{font-size:10.5px;font-weight:800;padding:1px 8px;border-radius:999px;white-space:nowrap;margin-top:1px}
        .ldp-dstat.late{background:rgba(176,42,55,.13);color:${NEG}}
        .ldp-dstat.up{background:rgba(28,122,74,.13);color:${POS}}
        .ldp-dstat.open{background:var(--panel-2);color:var(--muted)}
        .ldp-dstat.none{background:var(--panel-2);color:var(--faint)}
        /* edit form */
        .ldp-fgrp{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line);border-radius:11px;background:var(--panel-2);margin:0 0 9px}
        .ldp-drawer .ldp-fgrp{width:100%;box-sizing:border-box}
        .ldp-drawer .ldp-fgrp label{flex:1 1 120px}
        .ldp-drawer .ldp-fgrp input,.ldp-drawer .ldp-fgrp select{width:100%;box-sizing:border-box}
        .ldp-drawer [data-ldpform]{display:block!important;margin-top:0!important}
        .ldp-drawer .ldp-savebtn{width:100%;margin-top:2px}
        .ldp-drawer .ldp-saveinfo{display:block;margin-top:7px}
        .ldp-drawer .ldp-jobs{gap:5px}
        .ldp-flbl{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);align-self:center}
        .ldp-fgrp label{font-size:10.5px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;display:flex;flex-direction:column;gap:4px}
        .ldp-fgrp input,.ldp-fgrp select{font:inherit;font-size:12.5px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--ink);padding:6px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel)}
        .ldp-fgrp input:focus,.ldp-fgrp select:focus{outline:0;border-color:var(--brand)}
        .ldp-mapbtn{font:inherit;font-size:12px;font-weight:700;padding:7px 12px;border:1px solid var(--line-2);border-radius:9px;background:var(--panel);color:var(--ink);cursor:pointer}
        .ldp-mapbtn:hover{border-color:var(--brand)}
        .ldp-savebtn{font:inherit;font-weight:800;font-size:12.5px;padding:9px 18px;border:0;border-radius:9px;background:var(--brand);color:var(--brand-ink);cursor:pointer;align-self:flex-end}
        /* map modal */
        .ldp-mapscrim{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:200;display:grid;place-items:center}
        .ldp-mapbox{width:min(860px,94vw);background:var(--panel);border:1px solid var(--line-2);border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.35)}
        .ldp-maphd{display:flex;align-items:center;gap:10px;padding:13px 16px;border-bottom:1px solid var(--line)}
        .ldp-maphd b{font-size:14.5px;color:var(--ink)}
        .ldp-maphd span{font-size:12px;color:var(--muted);flex:1}
        .ldp-mapx{border:0;background:none;font-size:18px;color:var(--muted);cursor:pointer}
        .ldp-mapel{height:min(60vh,460px);width:100%}
        .ldp-mapft{display:flex;align-items:center;gap:10px;padding:12px 16px;border-top:1px solid var(--line)}
        .ldp-mapco{flex:1;font-size:12.5px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}
        .ldp-mapclear{font:inherit;font-size:12.5px;font-weight:700;padding:8px 14px;border:1px solid var(--line-2);border-radius:9px;background:var(--panel);color:var(--ink);cursor:pointer}
        .ldp-mapok{font:inherit;font-size:12.5px;font-weight:800;padding:8px 16px;border:0;border-radius:9px;background:var(--brand);color:var(--brand-ink);cursor:pointer}
        .ldp-pill{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .ldp-loc-store{background:rgba(28,122,74,.13);color:${POS}}
        .ldp-loc-rent{background:rgba(47,111,208,.12);color:${BLUE}}
        .ldp-loc-truck{background:rgba(245,165,36,.16);color:${WARN}}
        .ldp-loc-unk{background:var(--panel-2);color:var(--faint)}
        .ldp-loc-car{background:rgba(176,42,55,.12);color:${NEG}}
        .ldp-due{font-weight:800;font-size:12px;white-space:nowrap}
        .ldp-due.late{color:${NEG}} .ldp-due.open{color:${WARN}} .ldp-due.up{color:var(--muted)} .ldp-due.none{color:var(--faint);font-weight:600}
        .ldp-det{font-size:11.5px;color:var(--muted)}
        .ldp-sub>td{background:var(--panel-2);font-size:12.5px;padding:12px 16px}
        .ldp-sub b{font-weight:800}
        .ldp-fnote{padding:10px 14px;font-size:11px;color:var(--faint);border-top:1px solid var(--line)}
        .ldp-flagdot{display:inline-block;margin-left:5px;font-size:12px;font-weight:800;color:${WARN};cursor:help}
        .ldp-flagdot.blk{color:${NEG}}
        .ldp-issue{font-size:11.5px;font-weight:700;color:${WARN};margin-top:5px;max-width:230px;line-height:1.35}
        .ldp-issue.blk{color:${NEG}}
        .ldp-dt{font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap}
        /* CUSTODY — do we physically have it, and did we collect it? */
        .ldp-pos{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;white-space:nowrap;letter-spacing:.01em}
        .ldp-pos-us{background:rgba(28,122,74,.14);color:${POS}}
        .ldp-pos-car{background:rgba(47,111,208,.14);color:${BLUE}}
        .ldp-pos-3p{background:rgba(160,106,0,.15);color:${WARN}}
        .ldp-pos-no{background:var(--panel-2);color:var(--muted)}
        .ldp-pos-unk{background:rgba(176,42,55,.11);color:${NEG}}
      `;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="ldp-head"><div>
        <h1>Long Distance Planning</h1>
      </div></div>
      <div id="ldpBody"><div class="rs-loading">Loading shipments…</div></div>
      <div class="ldp-scrim" id="ldpScrim"></div>
      <aside class="ldp-drawer" id="ldpDrawer" aria-label="Shipment detail"></aside>`;

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
    // the zip is the one BESIDE the state, never the first 5-digit run (which is
    // usually the street number: "12345 Biscayne Blvd, Miami, FL 33181")
    var m = a.match(/,?\s*([A-Z]{2})\s+(\d{5})(?:-\d{4})?(?!\d)/);
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
      return { from: d.text || here, fromSub: d.sub || detail, to: dest, toLabel: "Delivering to", firm: true };
    }
    return { from: String(r["Moving From"] || "").trim() || "—", fromSub: "",
             to: dest, toLabel: "Delivery location", firm: false };
  }

  // Our own depot. The sheet just says "Our Storage" / "boxes Space O, 44" -- a driver needs
  // the actual address (Tornike 2026-07-28).
  var OUR_STORAGE_ADDR = "3212 Shafto Rd unit 3, Tinton Falls, NJ 07753, United States";

  // WHERE THE DELIVERY LEG STARTS. Empty while the goods are still with the customer: that leg
  // is a PICKUP and its origin is the customer's own address. Once we hold them, this is the
  // concrete place the truck loads from -- our depot's real address, the rented unit's full
  // address, or the carrier holding it.
  function departFrom(r) {
    var loc = String(r["Location"] || "").trim();
    var det = String(r["Location Detail"] || "").trim();
    var carrier = String(r["Carrier Driver"] || "").trim();
    if (!loc || loc === "Not collected" || loc === "Unknown") return { text: "", sub: "" };
    if (loc === "Our Storage") return { text: OUR_STORAGE_ADDR, sub: det };
    if (loc === "With carrier" || carrier) return { text: carrier || "Carrier", sub: det };
    // don't echo the bucket under the address when the address already says it
    // ("Bacho's Storage" + a "Storage" subtitle read as a stutter)
    // don't echo the bucket under the address when the address already conveys it -- a
    // "Rented Storage" subtitle under "rented public storage, 2629 Brunswick Ave" is noise
    if (det) {
      var dl = det.toLowerCase(), ll = String(loc).toLowerCase();
      var echo = dl.indexOf(ll) >= 0 || (/storage/.test(ll) && /storage/.test(dl));
      return { text: det, sub: echo ? "" : loc };
    }
    return { text: loc, sub: "" };
  }
  function departCellFrom(r) {
    var d = departFrom(r);
    if (!d.text) return '<span class="ldp-nodate">picking up</span>';
    return '<span class="ldp-from">' + esc(d.text) + "</span>"
      + (d.sub ? '<div class="ldp-sub">' + esc(d.sub) + "</div>" : "");
  }
  function stageOf(r) {
    return (String(r["Possession"] || "").toLowerCase().indexOf("not picked up") >= 0
      || String(r["Location"] || "") === "Not collected") ? "Pickup" : "Delivery";
  }
  function stageChip(r) {
    var st = stageOf(r);
    return '<span class="ldp-stage ' + (st === "Pickup" ? "p" : "d") + '">' + st + "</span>";
  }

  function tripDays(r) { var v = +(r["Trip Days"] || 0); return v > 0 ? v : TRIP_DEFAULT; }
  function tripTxt(r) { return tripDays(r) + "d trip" + (+(r["Trip Days"] || 0) > 0 ? "" : " (assumed)"); }
  var S = window.__LDP || (window.__LDP = { view: "board", q: "", co: "", loc: "", sel: null, tlStart: null, tlSeg: "", kpi: "", ms: { type: [], cust: [] } });
  if (!S.ms) S.ms = { type: [], cust: [] };   // older cached state from a previous version
    S.sel = null;

    var rows;
    try { rows = await RS.load("fct_ld_planning"); }
    catch (e) { document.getElementById("ldpBody").innerHTML = '<div class="rs-loading">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

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

    function locPill(r) {
      var l = String(r["Location"] || "Unknown");
      var cls = l === "At Carrier" ? "ldp-loc-car"
        : /Our Storage|Other Storage|^Storage$/.test(l) ? "ldp-loc-store"
        : l === "Rented Storage" ? "ldp-loc-rent"
        : /Truck|Trailer/.test(l) ? "ldp-loc-truck"
        : l === "Left Storage" ? "ldp-loc-truck" : "ldp-loc-unk";
      return '<span class="ldp-pill ' + cls + '">' + esc(l) + "</span>";
    }
    function dueBadge(r) {
      var end = r["Window End"] ? String(r["Window End"]).slice(0, 10) : null;
      var fad = r["FAD"] ? String(r["FAD"]).slice(0, 10) : null;
      if (!end && !fad) return '<span class="ldp-due none">no window</span>';
      if (end) {
        var d = daysBetween(todayIso, end);
        if (d < 0) return '<span class="ldp-due late">' + (-d) + "d late</span>";
        if (fad && todayIso >= fad) return '<span class="ldp-due open">' + d + "d left</span>";
        if (!fad) return '<span class="ldp-due open">' + d + "d left</span>";
      }
      if (fad && todayIso < fad) return '<span class="ldp-due up">opens in ' + daysBetween(todayIso, fad) + "d</span>";
      return '<span class="ldp-due open">window open</span>';
    }
    function windowTxt(r) {
      var fad = r["FAD"], end = r["Window End"];
      if (!fad && !end) return "—";
      if (fad && end && String(fad) === String(end)) return fmtD(fad);
      return (fad ? fmtD(fad) : "…") + " → " + (end ? fmtD(end) : "open");
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
    // DEPART — when the truck must leave. The board's second actionable date; it gets the
    // same countdown treatment as Deliver from instead of a bare date.
    function departCell(r) {
      var d = r["Depart By"];
      if (!d) return '<span class="ldp-nodate">\u2014</span>';
      var n = dayDiff(d), sub, cls;
      if (n > 0) { sub = "in " + n + "d"; cls = n <= 2 ? "soon" : "ok"; }
      else if (n === 0) { sub = "TODAY"; cls = "soon"; }
      else { sub = "passed " + Math.abs(n) + "d ago"; cls = "late"; }
      return '<b class="ldp-dt">' + fmtD(d) + "</b>"
        + '<div class="ldp-when ' + cls + '">' + sub
        + ' · ' + tripTxt(r) + "</div>";
    }
    function whereCell(r) {
      var det = String(r["Location Detail"] || "");
      var loc = String(r["Location"] || "");
      var sub = [];
      if (loc && loc !== "Unknown" && loc !== "Not collected") sub.push(loc);
      // the concrete address now lives in "Departing from" IN FULL -- this cell keeps the
      // custody pill and the bucket name so the same address is not printed twice
      return possPill(r)
        + (sub.length ? '<div class="ldp-sub ldp-whsub">' + esc(sub.join(" \u00b7 ")) + "</div>" : "");
    }
    function beginCell(r) {
      var st = isStraight(r);
      var begin = st ? r["FAD"] : (r["FAD"] || r["Window End"]);
      if (!begin) return '<span class="ldp-nodate">not set</span>';
      var n = dayDiff(begin), end = r["Window End"], sub, cls;
      if (n > 0) { sub = "in " + n + "d"; cls = n <= 3 ? "soon" : "ok"; }
      else if (n === 0) { sub = "TODAY"; cls = "soon"; }
      else if (st) { sub = Math.abs(n) + "d late"; cls = "late"; }
      else if (end && dayDiff(end) >= 0) { sub = "open · " + dayDiff(end) + "d left"; cls = "soon"; }
      else if (!end) { sub = "open · no end set"; cls = "soon"; }   // deliverable, deadline unrecorded — not "closed"
      else { sub = "closed " + Math.abs(dayDiff(end)) + "d ago"; cls = "late"; }
      return '<b class="ldp-dt">' + fmtD(begin) + "</b>"
        + '<div class="ldp-when ' + cls + '">' + sub + "</div>";
    }

    function windowCell(r) {
      var tf = r["Timeframe"] ? String(r["Timeframe"]).slice(0, 26) : "";
      if (isStraight(r)) {
        return '<b class="ldp-dt">' + fmtD(r["FAD"]) + "</b>"
          + '<div class="ldp-det">delivery date' + (tf ? " · " + esc(tf) : "") + "</div>";
      }
      return '<b class="ldp-dt">' + windowTxt(r) + "</b>"
        + '<div class="ldp-det">FAD + window' + (tf ? " · " + esc(tf) : "") + "</div>";
    }
    // "Do we physically have it, and did we collect it?"
    // Custody in one token, used for pills, holding bars and the filter chips.
    function custKey(r) {
      var p = String(r["Possession"] || "");
      return p === "With us" ? "us" : p === "With carrier" ? "car"
           : p === "Third-party storage" ? "tp"
           : p === "Not picked up yet" ? "no" : "unk";
    }
    var CUST_LABEL = { us: "With us", car: "Carrier", tp: "Storage", no: "To collect", unk: "Missing Closing" };
    function possPill(r) {
      var p = String(r["Possession"] || "—");
      var cls = p === "With us" ? "ldp-pos-us"
        : p === "With carrier" ? "ldp-pos-car"
        : p === "Third-party storage" ? "ldp-pos-3p"
        : p === "Not picked up yet" ? "ldp-pos-no" : "ldp-pos-unk";
      return '<span class="ldp-pos ' + cls + '">' + esc(p) + "</span>";
    }
    // The date the row is actually asking us to act on: dispatch deadline first, then the
    // delivery deadline. This is the sort key — his rule is "soonest thing to act on wins",
    // regardless of how old the pickup is.
    function actDate(r) {
      return r["Depart By"] ? String(r["Depart By"]).slice(0, 10)
           : r["Window End"] ? String(r["Window End"]).slice(0, 10)
           : r["FAD"] ? String(r["FAD"]).slice(0, 10) : "";
    }

    function paint() {
      // ONE BOARD (Tornike 2026-07-27: "delete the data cleanup thing - that cleanup should
      // be handled by the main page"). Flagged rows used to be exiled to a second tab, which
      // is how a loaded truck went unnoticed: a data problem is a reason to look HARDER at a
      // shipment, not to hide it. The flag now rides along on the row itself.
      var all = overlaid();
      var flagged = all.filter(function (r) { return !!r["Data Issue"]; });
      var actNow = all.filter(function (r) { return r["Urgency"] === "Act now"; }).length;
      var actSoon = all.filter(function (r) { return r["Urgency"] === "Act soon"; }).length;
      var noWin = all.filter(function (r) { return r["Urgency"] === "Missing data"; }).length;
      var held = all.filter(function (r) { return custKey(r) === "unk"; }).length;

      // KPI cards are FILTERS, not decoration — click one to see exactly those rows;
      // click again to release. The counts always describe the whole board.
      var kpiDefs = [
        ["now",  "neg",  actNow,         "Act now",          "overdue or departure passed"],
        ["soon", "warn", actSoon,        "Act soon",         "departure or window is close"],
        ["miss", "",     noWin,          "Missing data",     "FAD / timeframe not set"],
        ["unk",  "",     held,           "Missing Closing",  "picked up, but no closing sheet records where it is"],
        ["flag", "",     flagged.length, "Flagged",          "needs a sheet correction"],
      ];
      var kp = '<div class="ldp-kpis">' + kpiDefs.map(function (k) {
        return '<div class="ldp-kpi ' + k[1] + (S.kpi === k[0] ? " sel" : "") + '" data-kpi="' + k[0] + '" role="button" tabindex="0">'
          + "<b>" + k[2] + "</b><span>" + k[3] + "</span><small>" + k[4] + "</small></div>";
      }).join("") + "</div>";
      var kpiPass = function (r) {
        if (!S.kpi) return true;
        if (S.kpi === "now") return r["Urgency"] === "Act now";
        if (S.kpi === "soon") return r["Urgency"] === "Act soon";
        if (S.kpi === "miss") return r["Urgency"] === "Missing data";
        if (S.kpi === "unk") return custKey(r) === "unk";
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
        var t = S.ms.type || [], c = S.ms.cust || [];
        if (t.length && t.indexOf(isStraight(r) ? "straight" : "regular") < 0) return false;
        if (c.length && c.indexOf(custKey(r)) < 0) return false;
        return true;
      };
      var segsAll = [["", "All"], ["straight", "Straight"], ["regular", "Regular"],
                     ["no", "To collect"], ["us", "With us"], ["tp", "Storage"],
                     ["car", "Carrier"], ["unk", "Missing Closing"]];
      // MULTI-SELECT filters (Tornike 2026-07-28: "i need to have literal filters with multi
      // select options, similar to what we have for foreman in money flow"). One-at-a-time chips
      // could not express "Straight AND Regular" or "with us OR at a carrier".
      function msCount(dim, key) {
        return all.filter(function (r) { return dim === "type" ? (key === "straight" ? isStraight(r) : !isStraight(r)) : custKey(r) === key; }).length;
      }
      function msBox(dim, cap, opts) {
        var sel = S.ms[dim] || [];
        var body = opts.map(function (o) {
          return '<label class="ldp-msopt"><input type="checkbox" data-msdim="' + dim + '" data-msval="' + o[0] + '"'
            + (sel.indexOf(o[0]) >= 0 ? " checked" : "") + '><span>' + o[1] + '</span><span class="n">'
            + msCount(dim, o[0]) + "</span></label>";
        }).join("");
        return '<div class="ldp-ms" data-msbox="' + dim + '">'
          + '<button class="ldp-msb' + (sel.length ? " on" : "") + '" data-mstoggle="' + dim + '">'
          +   '<span class="cap">' + cap + "</span>"
          +   "<span>" + (sel.length ? sel.length + " selected" : "All") + "</span>"
          +   (sel.length ? '<span class="cnt">' + sel.length + "</span>" : "")
          + "</button>"
          + '<div class="ldp-mspop' + (S.msOpen === dim ? "" : " hidden") + '" data-mspop="' + dim + '">' + body
          +   '<div class="ldp-msact"><button data-msall="' + dim + '">Select all</button>'
          +   '<button data-msnone="' + dim + '">Clear</button></div></div></div>';
      }
      var chips = "";   // Type/Status now live in the one filter bar, not a second row

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
      // FILTER BAR — one bordered strip instead of three loose controls: a search field with
      // an inline icon, labelled selects, and a Clear that only appears when something is
      // actually filtering (so it never adds noise at rest).
      var anyF = !!(S.q || S.co || S.loc || S.kpi || S.tlSeg || (S.ms.type || []).length || (S.ms.cust || []).length);
      var bar = chips + '<div class="ldp-bar">'
        + '<div class="ldp-vw">'
        +   '<button data-ldview="board"' + (S.view !== "timeline" ? ' class="on"' : "") + ">Board</button>"
        +   '<button data-ldview="timeline"' + (S.view === "timeline" ? ' class="on"' : "") + ">Timeline</button>"
        + "</div>"
        + '<div class="ldp-fbox">'
        +   '<span class="ldp-srch"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
        +   '<input id="ldpQ" placeholder="Search customer, request #, job code or sticker" value="' + esc(S.q) + '"></span>'
        +   '<span class="ldp-fdiv"></span>'
        +   '<label class="ldp-fl">Company<select class="ldp-sel" id="ldpCo"><option value="">All</option>' + Object.keys(cos).sort().map(function (c) {
              return '<option' + (S.co === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select></label>"
        +   '<label class="ldp-fl">Location<select class="ldp-sel" id="ldpLoc"><option value="">All</option>' + Object.keys(locs).sort().map(function (l) {
              return '<option' + (S.loc === l ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select></label>"
        +   msBox("type", "Type", [["straight", "Straight"], ["regular", "Regular"]])
        +   msBox("cust", "Status", [["no", "To collect"], ["us", "With us"], ["tp", "Storage"],
                                     ["car", "Carrier"], ["unk", "Missing Closing"]])
        +   (anyF ? '<button class="ldp-clr" id="ldpClr">Clear</button>' : "")
        + "</div>"
        + '<span class="ldp-count"><b>' + cur.length + "</b> of " + all.length + " shipments</span>"
        + "</div>";

      var urgPill = function (r) {
        var u = String(r["Urgency"] || "");
        var cls = u === "Act now" ? "late" : u === "Act soon" ? "open" : u === "Missing data" ? "none" : "up";
        return '<span class="ldp-due ' + cls + '">' + esc(u || "—") + "</span>";
      };
      // PICKUP / DELIVERY calendar jobs + the delivery status. A delivery event can EXIST
      // while the goods are still with us - that is exactly what has to be visible.
      function calLink(url, dt, label) {
        if (!url) return '<span class="ldp-nolink">' + label + " not created</span>";
        return '<a class="ldp-callink" href="' + esc(url) + '" target="_blank" rel="noopener"'
          + ' onclick="event.stopPropagation()">' + label + " " + (dt ? fmtD(dt) : "open") + "</a>";
      }
      function dlvClass(st) {
        st = String(st || "");
        if (st.indexOf("passed") >= 0) return "late";
        if (st.indexOf("booked") >= 0) return "up";
        if (st.indexOf("cancelled") >= 0) return "none";
        return "open";
      }
      function jobsCell(r) {
        // ONE statement per fact. The old cell printed "Delivery not created" AND a
        // "No delivery job yet" pill — the same fact twice on every second row.
        var ds = String(r["Delivery Status"] || "");
        var h = calLink(r["Pickup Event URL"], r["Pickup Event Date"], "Pickup");
        if (r["Delivery Event URL"]) {
          h += calLink(r["Delivery Event URL"], r["Delivery Event Date"], "Delivery")
            + '<span class="ldp-dstat ' + dlvClass(ds) + '">' + esc(ds || "-") + "</span>";
        } else if (ds === "Pickup scheduled") {
          h += '<span class="ldp-dstat open">Pickup scheduled</span>';
        } else {
          h += '<span class="ldp-dstat none">No delivery job yet</span>';
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
        // Type-aware, exactly as in the table: a Straight job has no FAD — the office keeps
        // the committed DELIVERY DATE in that field, so labelling it "FAD" here would lie.
        var delivery = isStraight(r)
          ? [["Delivery date", fmtD(r["FAD"]) + (r["FAD Source"] ? ' <span class="ldp-sub">(' + esc(r["FAD Source"]) + ")</span>" : "")],
             ["Timeframe", (r["Timeframe"] && String(r["Timeframe"]).trim() !== "0")
               ? esc(r["Timeframe"]) : '<span class="ldp-sub">none — deliver on the FAD</span>']]
          : [["FAD", fmtD(r["FAD"]) + (r["FAD Source"] ? ' <span class="ldp-sub">(' + esc(r["FAD Source"]) + ")</span>" : "")],
             ["Window", windowTxt(r) + (r["Window Note"] ? ' <span class="ldp-sub">' + esc(r["Window Note"]) + "</span>" : "")],
             ["Timeframe", (r["Timeframe"] && String(r["Timeframe"]).trim() !== "0")
               ? esc(r["Timeframe"]) : '<span class="ldp-sub">none — deliver on the FAD</span>']];

        return ''
          + (r["Do"] ? '<div class="ldp-dnote"><b>Do:</b> ' + esc(r["Do"]) + "</div>" : "")
          + (r["Data Issue"] ? '<div class="ldp-dissue' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
              + '" style="margin-top:9px">⚠ ' + esc(r["Data Issue"]) + "</div>" : "")
          + '<div class="ldp-sec">Calendar jobs</div>' + jobsCell(r)
          + '<div class="ldp-sec">Route</div>'
          + (function () { var rt = routeOf(r); return kv([
                ["From", '<b class="ldp-big">' + esc(rt.from) + "</b>"
                  + (rt.fromSub ? '<div class="ldp-sub">' + esc(rt.fromSub) + "</div>" : "")],
                [rt.toLabel, '<b class="ldp-big">' + esc(rt.to || "—") + "</b>"
                  + (rt.firm ? "" : '<div class="ldp-sub">customer address — not the final drop yet</div>')
                  + (r["Moving To"] && String(r["Moving To"]).replace(/\s+/g, " ") !== rt.to
                       ? '<div class="ldp-sub">' + esc(r["Moving To"]) + "</div>" : "")]]); })()
          + '<div class="ldp-sec">Delivery</div>'
          + kv(delivery.concat([
                ["Depart by", fmtD(r["Depart By"]) + ' <span class="ldp-sub">' + tripTxt(r) + "</span>"]]))
          + '<div class="ldp-sec">Where it is</div>'
          + (function () { var dfrom = departFrom(r); return kv([
                ["Status", esc(r["Possession"] || "—")],
                ["Location", '<b class="ldp-big">' + esc(r["Location"] || "—") + "</b>"
                  + (dfrom.text ? '<div class="ldp-addr">' + esc(dfrom.text) + "</div>"
                                : (det ? '<div class="ldp-addr">' + esc(det) + "</div>" : ""))],
                // Carrier only exists on REGULAR moving -- a Straight job is driven by our own
                // crew, so showing carrier fields there invites a wrong reading (Tornike 2026-07-28).
                (!isStraight(r) && r["Carrier Driver"]) ? ["Carrier", esc(r["Carrier Driver"])] : null,
                (!isStraight(r) && r["Total To Carrier"] != null) ? ["To carrier", money(r["Total To Carrier"])] : null,
                ["Sticker", esc(r["Sticker"] || "—")]]); })()
          + '<div class="ldp-sec">Job</div>'
          + kv([r["Balance Due"] != null ? ["Balance due", money(r["Balance Due"])] : null,
                r["CF"] != null ? ["CF", Number(r["CF"]).toLocaleString()] : null,
])
          // The drawer is READ-ONLY (Tornike 2026-07-28: "i dont need user to input anything
          // here"). The Plan / Where-it-is form lived here; corrections belong in the long-distance
          // sheet, the system of record. overlaid() still APPLIES entries saved before this change.
        ;
      }

      // The drawer is rendered OUTSIDE the table, so a repaint of the list never destroys
      // a half-filled edit form — and closing it does not re-render the board.
      function openDrawer(key) {
        var dr = document.getElementById("ldpDrawer"), sc = document.getElementById("ldpScrim");
        if (!dr || !sc) return;
        S.sel = key;
        host.querySelectorAll("tr.ldp-row, .ldp-tlrow[data-ldk]").forEach(function (tr) {
          tr.classList.toggle("on", tr.getAttribute("data-ldk") === key);
        });
        if (!key) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        var r = cur.filter(function (x, i2) { return String(x["Sheet Row"] || i2) === key; })[0];
        if (!r) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        dr.innerHTML =
          '<div class="ldp-dhd"><button class="x" id="ldpDx" title="Close">✕</button>'
          + '<div class="ldp-dnm">' + esc(r["Customer"] || "—") + "</div>"
          + '<div class="ldp-dmeta">' + esc(r["Job Code"] ? String(r["Job Code"]).split(",")[0] : "—")
          + " · " + esc(r["Company"] || "") + " · picked up " + fmtD(r["Pickup Date"]) + "</div>"
          + '<div class="ldp-dpills">' + urgPill(r) + possPill(r) + locPill(r) + "</div></div>"
          + '<div class="ldp-dbody">' + drawerBody(r) + "</div>";
        dr.classList.add("show"); sc.classList.add("show");
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
        return '<div class="ldp-tlrow ' + tone + (S.sel === key ? " on" : "") + '" data-ldk="' + esc(key) + '">'
          + '<div class="ldp-tllab"><span class="ldp-tlmk ' + (st8 ? "s" : "r") + '"></span>'
          + '<span class="ldp-tllabtx"><b>' + esc(r["Customer"] || "—") + "</b>"
          + '<span class="ldp-tlmeta">'
          +   esc(r["Job Code"] ? String(r["Job Code"]).split(",")[0] : "—")
          +   (stateZip(r["Moving To"], r["Delivery State"]) ? ' · ' + esc(stateZip(r["Moving To"], r["Delivery State"])) : "")
          +   '<span class="ldp-tlcust ' + ck2 + '">' + CUST_LABEL[ck2] + "</span></span></span></div>"
          + '<div class="ldp-tlcal">' + bars + "</div></div>";
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
          cal += '<span class="ldp-tltodaylab" style="left:' + ((tdi + 0.5) * dp) + '%">TODAY</span>';
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
        var body = ord.map(function (r, i) { return tlRow(r, i, st, days, dp); }).join("")
          || '<div style="padding:26px;color:var(--faint)">No shipments match these filters.</div>';
        // Segment the board without leaving the view: type and custody are the two questions
        // a dispatcher actually asks of it.
        return '<div class="ldp-tlbar">'
          + '<div class="ldp-tlnav"><button data-tl="prev" title="Earlier">\u2039</button>'
          +   '<button data-tl="today">Today</button>'
          +   '<button data-tl="next" title="Later">\u203a</button></div>'
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
                ? '<div class="ldp-tloff">' + (before ? before + " due before this range" : "")
                    + (before && after ? " · " : "") + (after ? after + " beyond it" : "") + "</div>"
                : "";
            })()
          + '<div class="ldp-tllg"><span><i class="lg-pk"></i>picked up</span>'
          +   '<span><i class="lg-hold"></i>days in our hands</span>'
          +   '<span><i class="lg-s"></i>straight \u2014 committed date</span>'
          +   '<span><i class="lg-r"></i>regular \u2014 delivery window</span></div>'
          + "</div>"
          + '<div class="ldp-tlgrid"><div class="ldp-tlhead"><div class="ldp-tlhlab"></div>'
          +   '<div class="ldp-tlhcal">' + cal + "</div></div>"
          +   '<div class="ldp-tlbody">' + body + "</div></div>";
      }

      var body = cur.map(function (r, i) {
        var key = String(r["Sheet Row"] || i);
        var det = String(r["Location Detail"] || "");
        // ONE LINE PER CELL. Anything that needs a second line belongs in the drawer —
        // that is what keeps every row the same height and the whole table scannable.
        var dvDate = isStraight(r) ? fmtD(r["FAD"]) : windowTxt(r);
        var uk = String(r["Urgency"] || "") === "Act now" ? "u-red"
              : String(r["Urgency"] || "") === "Act soon" ? "u-amber" : "";
        var main = '<tr class="ldp-row ' + uk + (S.sel === key ? " on" : "") + '" data-ldk="' + esc(key) + '">'
          + '<td class="ldp-cust-td"><span class="ldp-cust">' + esc(r["Customer"] || "—") + "</span>"
              + '<div class="ldp-sub">' + esc(r["Job Code"] ? String(r["Job Code"]).split(",")[0] : "—")
              + (r["Company"] && r["Company"] !== "Zip to Zip" ? " · " + esc(r["Company"]) : "")
              + "</div></td>"
          + "<td>" + typeChip(r) + "</td>"
          + "<td>" + stageChip(r) + "</td>"
          + '<td class="ldp-fromtd">' + departCellFrom(r) + "</td>"
          + "<td>" + esc(stateZip(r["Moving To"], r["Delivery State"]) || "—") + "</td>"
          + '<td class="ldp-jobstd">' + jobsCell(r) + "</td>"
          + "<td>" + whereCell(r) + "</td>"
          + '<td class="ldp-begin">' + beginCell(r) + "</td>"
          + '<td class="ldp-begin">' + departCell(r) + "</td>"
          + "<td>" + urgPill(r)
              + (r["Data Issue"] ? ' <span class="ldp-flagdot' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
                  + '" title="' + esc(r["Data Issue"]) + '">⚠</span>' : "")
              + (r["Urgency Reason"] ? '<div class="ldp-sub">' + esc(String(r["Urgency Reason"]).slice(0, 34)) + "</div>" : "")
            + "</td></tr>";
        return main;
      }).join("");

      var tbl = '<div class="ldp-card"><div class="ldp-wrap"><table class="ldp-tbl"><thead><tr>'
        + "<th>Customer</th><th>Type</th>"
        + "<th title=\"Which leg is next: collect it from the customer, or deliver what we already hold\">Stage</th>"
        + "<th title=\"Where the delivery truck loads from. Blank while the goods are still with the customer.\">Departing from</th>"
        + "<th>Delivering to</th>"
        + "<th>Jobs &amp; status</th><th>Where it is</th>"
        + "<th class=\"ldp-hbegin\" title=\"FAD - the first available date of delivery from the long-distance sheet - and the last day of the delivery window (FAD + timeframe)\">Delivery window (FAD)</th>"
        + "<th title=\"The latest the truck can leave and still deliver inside the window\">Depart by</th><th>Status</th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="8" style="color:var(--faint);padding:18px">No rows match — clear the filters, or the last build produced nothing.</td></tr>')
        + "</tbody></table></div>"
        + '<div class="ldp-fnote">Click a row for the full details. <b>Sorted by when we must act</b> — '
        + "soonest deadline first, whatever the pickup date. <b>Straight</b> jobs show a committed "
        + "delivery date (the office records it in the FAD field); <b>Regular</b> jobs show the FAD "
        + "and its window. Data refreshes with the pipeline (hourly).</div></div>";

      // keep the scroll position — a repaint used to snap back to the top; the vertical
      // scroller is the table wrap (.ldp-wrap), not the window — restore both
      var sx = window.scrollX, sy = window.scrollY;
      var wrap0 = document.querySelector("#ldpBody .ldp-wrap") || document.querySelector("#ldpBody .ldp-tlbody");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      // the user may have switched pages while loadEntries()/save was awaiting — the mount
      // is gone and painting would throw "innerHTML on null" (money-flow had this same bug)
      var _bd = document.getElementById("ldpBody");
      if (!_bd || !host.isConnected) return;
      _bd.innerHTML = kp + bar + (S.view === "timeline" ? timelineHtml(cur) : tbl);
      var _sc = document.getElementById("ldpScrim");
      if (_sc) _sc.onclick = function () { if (host.__ldpOpen) host.__ldpOpen(null); };
      if (!host.__ldpEsc) {
        host.__ldpEsc = function (e) {
          if (!host.isConnected) { document.removeEventListener("keydown", host.__ldpEsc); return; }
          if (e.key === "Escape" && host.__ldpOpen) host.__ldpOpen(null);
        };
        document.addEventListener("keydown", host.__ldpEsc);
      }

      wire();
      var wrap1 = document.querySelector("#ldpBody .ldp-wrap") || document.querySelector("#ldpBody .ldp-tlbody");
      if (wrap1) { wrap1.scrollTop = wt; wrap1.scrollLeft = wl; }
      window.scrollTo(sx, sy);
    }

    // Map pin picker — Leaflet is fetched from the CDN the first time it is needed so the
    // page carries no extra weight for dispatchers who never open it.
    var _leaflet = null;
    function loadLeaflet() {
      if (_leaflet) return _leaflet;
      _leaflet = new Promise(function (res, rej) {
        if (window.L) return res(window.L);
        var css = document.createElement("link");
        css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);
        var js = document.createElement("script");
        js.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        js.onload = function () { res(window.L); };
        js.onerror = function () { rej(new Error("map library unavailable")); };
        document.head.appendChild(js);
      });
      return _leaflet;
    }
    async function pickOnMap(box) {
      var latI = box.querySelector('[data-ldf="location_lat"]');
      var lngI = box.querySelector('[data-ldf="location_lng"]');
      var pin = box.querySelector(".ldp-pin");
      var L;
      try { L = await loadLeaflet(); }
      catch (e) {
        var typed = prompt("Map couldn't load. Enter coordinates as lat, lng:",
                           (latI.value && lngI.value) ? latI.value + ", " + lngI.value : "");
        if (typed) {
          var m = typed.split(",");
          if (m.length === 2 && !isNaN(+m[0]) && !isNaN(+m[1])) {
            latI.value = (+m[0]).toFixed(6); lngI.value = (+m[1]).toFixed(6);
            pin.textContent = (+m[0]).toFixed(4) + ", " + (+m[1]).toFixed(4);
          }
        }
        return;
      }
      var scrim = document.createElement("div"); scrim.className = "ldp-mapscrim";
      scrim.innerHTML = '<div class="ldp-mapbox"><div class="ldp-maphd">'
        + "<b>Where is this shipment?</b><span>Click the map to drop a pin</span>"
        + '<button class="ldp-mapx" type="button">✕</button></div>'
        + '<div class="ldp-mapel"></div>'
        + '<div class="ldp-mapft"><span class="ldp-mapco">—</span>'
        + '<button class="ldp-mapclear" type="button">Clear pin</button>'
        + '<button class="ldp-mapok" type="button">Use this location</button></div></div>';
      document.body.appendChild(scrim);
      var lat0 = parseFloat(latI.value) || 39.5, lng0 = parseFloat(lngI.value) || -98.35;
      var zoom = latI.value ? 11 : 4;
      var map = L.map(scrim.querySelector(".ldp-mapel")).setView([lat0, lng0], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
                  { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
      var marker = latI.value ? L.marker([lat0, lng0]).addTo(map) : null;
      var chosen = latI.value ? { lat: lat0, lng: lng0 } : null;
      var co = scrim.querySelector(".ldp-mapco");
      if (chosen) co.textContent = chosen.lat.toFixed(5) + ", " + chosen.lng.toFixed(5);
      map.on("click", function (e) {
        chosen = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (marker) marker.setLatLng(e.latlng); else marker = L.marker(e.latlng).addTo(map);
        co.textContent = chosen.lat.toFixed(5) + ", " + chosen.lng.toFixed(5);
      });
      setTimeout(function () { map.invalidateSize(); }, 60);
      var close = function () { try { map.remove(); } catch (e) {} scrim.remove(); };
      scrim.querySelector(".ldp-mapx").onclick = close;
      scrim.onclick = function (e) { if (e.target === scrim) close(); };
      scrim.querySelector(".ldp-mapclear").onclick = function () {
        latI.value = ""; lngI.value = ""; pin.textContent = "no pin"; close();
      };
      scrim.querySelector(".ldp-mapok").onclick = function () {
        if (chosen) {
          latI.value = chosen.lat.toFixed(6); lngI.value = chosen.lng.toFixed(6);
          pin.textContent = chosen.lat.toFixed(4) + ", " + chosen.lng.toFixed(4);
        }
        close();
      };
    }

    function wire() {
      var q = host.querySelector("#ldpQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = host.querySelector("#ldpQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      var co = host.querySelector("#ldpCo"); if (co) co.onchange = function () { S.co = co.value; paint(); };
      var lo = host.querySelector("#ldpLoc"); if (lo) lo.onchange = function () { S.loc = lo.value; paint(); };
      var cl = host.querySelector("#ldpClr"); if (cl) cl.onclick = function () { S.q = ""; S.co = ""; S.loc = ""; S.kpi = ""; S.tlSeg = ""; S.ms = { type: [], cust: [] }; paint(); };
      Array.prototype.forEach.call(host.querySelectorAll("[data-ldview]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-ldview"); paint(); };
      });
      // ---- multi-select filters ----
      Array.prototype.forEach.call(host.querySelectorAll("[data-mstoggle]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var dim = b.getAttribute("data-mstoggle");
          var pop = host.querySelector('[data-mspop="' + dim + '"]');
          var wasOpen = S.msOpen === dim;
          S.msOpen = wasOpen ? "" : dim;
          host.querySelectorAll(".ldp-mspop").forEach(function (p) { p.classList.add("hidden"); });
          if (pop && !wasOpen) pop.classList.remove("hidden");
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-msdim]"), function (cb) {
        cb.onclick = function (e) { e.stopPropagation(); };
        cb.onchange = function () {
          var dim = cb.getAttribute("data-msdim"), val = cb.getAttribute("data-msval");
          var cur2 = (S.ms[dim] || []).slice();
          var i = cur2.indexOf(val);
          if (cb.checked) { if (i < 0) cur2.push(val); } else if (i >= 0) { cur2.splice(i, 1); }
          S.ms[dim] = cur2; paint();
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-msall]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var dim = b.getAttribute("data-msall");
          S.ms[dim] = Array.prototype.map.call(
            host.querySelectorAll('[data-msdim="' + dim + '"]'), function (c) { return c.getAttribute("data-msval"); });
          paint();
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-msnone]"), function (b) {
        b.onclick = function (e) { e.stopPropagation(); S.ms[b.getAttribute("data-msnone")] = []; paint(); };
      });
      // one outside-click closer for the whole page
      if (!host.__msClose) {
        host.__msClose = function () {
          S.msOpen = "";
          document.querySelectorAll(".ldp-mspop").forEach(function (p) { p.classList.add("hidden"); });
        };
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
        box.onclick = function (e) { e.stopPropagation(); };
        var mb = box.querySelector(".ldp-mapbtn");
        if (mb) mb.onclick = function (e) { e.stopPropagation(); pickOnMap(box); };
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
