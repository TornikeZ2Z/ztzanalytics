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
        .ldp-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
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
        .ldp-drawer{position:fixed;top:0;right:0;height:100vh;width:min(460px,95vw);background:var(--panel);z-index:61;
          box-shadow:-18px 0 48px rgba(0,0,0,.24);transform:translateX(100%);transition:transform .22s cubic-bezier(.4,0,.2,1);
          display:flex;flex-direction:column;visibility:hidden}
        .ldp-drawer.show{transform:none;visibility:visible}
        .ldp-dhd{padding:16px 18px 13px;border-bottom:1px solid var(--line);position:relative;flex:0 0 auto}
        .ldp-dhd .x{position:absolute;top:13px;right:13px;border:0;background:var(--panel-2);color:var(--muted);width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:15px;line-height:1}
        .ldp-dhd .x:hover{color:var(--ink)}
        .ldp-dnm{font-size:17px;font-weight:800;letter-spacing:-.3px;padding-right:38px}
        .ldp-dmeta{font-size:12px;color:var(--muted);margin-top:2px}
        .ldp-dpills{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
        .ldp-dbody{overflow-y:auto;padding:14px 18px 34px;flex:1}
        .ldp-sec{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--faint);margin:16px 0 8px}
        .ldp-sec:first-child{margin-top:0}
        .ldp-kv{display:grid;grid-template-columns:104px minmax(0,1fr);gap:5px 12px;font-size:12.5px;align-items:baseline}
        .ldp-kv dt{color:var(--faint);font-weight:700}
        .ldp-kv dd{margin:0;color:var(--ink);font-weight:600;word-break:break-word}
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
        .ldp-tlrow{display:flex;min-height:56px;border-bottom:1px solid var(--line);cursor:pointer}
        .ldp-tlrow:last-child{border-bottom:0}
        .ldp-tlrow:hover{background:var(--panel-2)}
        .ldp-tlrow.on{background:var(--brand-glow)}
        .ldp-tlrow.u-red{box-shadow:inset 3px 0 0 ${NEG}}
        .ldp-tlrow.u-amber{box-shadow:inset 3px 0 0 ${WARN}}
        .ldp-tllab{width:236px;flex:0 0 236px;border-right:1px solid var(--line);padding:0 14px;display:flex;align-items:center;gap:10px}
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
        .ldp-tlcust{display:inline-block;font-size:9.5px;font-weight:800;padding:1px 7px;border-radius:999px;white-space:nowrap;letter-spacing:.02em;margin-top:3px}
        .ldp-tlcust.us{background:rgba(28,122,74,.14);color:${POS}}
        .ldp-tlcust.car{background:rgba(47,111,208,.14);color:${BLUE}}
        .ldp-tlcust.tp{background:rgba(160,106,0,.15);color:${WARN}}
        .ldp-tlcust.unk{background:rgba(176,42,55,.11);color:${NEG}}
        .ldp-tltype{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-left:6px}
        /* how long the goods have been in our hands: pickup -> today */
        .ldp-tlhold{position:absolute;top:72%;height:4px;border-radius:2px;z-index:1;opacity:.8}
        .ldp-tlhold.us{background:rgba(28,122,74,.5)}
        .ldp-tlhold.car{background:rgba(47,111,208,.5)}
        .ldp-tlhold.tp{background:rgba(160,106,0,.5)}
        .ldp-tlhold.unk{background:rgba(176,42,55,.42)}
        .ldp-tlheld{position:absolute;top:72%;transform:translate(6px,-45%);font-size:10px;font-weight:800;color:var(--faint);white-space:nowrap;z-index:2}
        /* quick segmentation chips */
        .ldp-tlf{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}
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

    var S = window.__LDP || (window.__LDP = { view: "board", q: "", co: "", loc: "", sel: null, tlStart: null, tlSeg: "" });

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
    function overlaid() {
      var t = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
      return rows.map(function (b) {
        var co = String(b["Company"] || ""), rq = String(b["Request #"] || "");
        var en = entFor(co, rq, b["Sheet Row"]);   // `b` is the source row; `r` isn't built yet
        var r = Object.assign({}, b); r._ent = en; r._co = co; r._rq = rq;
        if (!en.trip_days && !en.final_fad && !en.final_cf) return r;  // pipeline is current
        // recompute with the SAME rules as the pipeline's _plan (src/ld_planning.py)
        if (en.final_fad && en.final_fad.value) {
          r["FAD"] = en.final_fad.value; r["FAD Source"] = "portal";
          var note = String(r["Window Note"] || "");
          var m = note.match(/^(\d+) (business )?days/);
          if (note === "same day") r["Window End"] = r["FAD"];
          else if (m) r["Window End"] = isoAdd(r["FAD"], m[2] ? Math.ceil(+m[1] * 7 / 5) : +m[1]);
        }
        if (en.trip_days && en.trip_days.value) r["Trip Days"] = +en.trip_days.value;
        if (en.final_cf && en.final_cf.value) r["CF"] = +en.final_cf.value;
        var fad = r["FAD"] ? String(r["FAD"]).slice(0, 10) : null;
        var end = r["Window End"] ? String(r["Window End"]).slice(0, 10) : null;
        var deadline = r["Type"] === "Straight" ? fad : end;
        var trip = r["Trip Days"] != null ? +r["Trip Days"] : 1;
        r["Depart By"] = deadline ? isoAdd(deadline, -trip) : null;
        var dd = deadline ? daysBetween2(t, deadline) : null;
        var dp = r["Depart By"] ? daysBetween2(t, r["Depart By"]) : null;
        var urg, why;
        if (!fad && !end) { urg = "Missing data"; why = "no delivery window"; }
        else if (dd != null && dd < 0) { urg = "Act now"; why = r["Type"] === "Straight" ? "delivery date passed" : "delivery window expired"; }
        else if (dp != null && dp <= 0) { urg = "Act now"; why = "departure date passed"; }
        else if (dp != null && dp <= 2) { urg = "Act soon"; why = "depart within " + dp + "d"; }
        else if (fad && daysBetween2(t, fad) <= 0) { urg = "Act soon"; why = "window is open"; }
        else { urg = "On track"; why = null; }
        r["Urgency"] = urg; r["Urgency Reason"] = why;
        var doTxt;
        if (r["Location"] === "At Carrier") doTxt = "Mark Delivered in the sheet — carrier already has it";
        else if (r["CF"] != null && +r["CF"] > 1500) doTxt = "Too big for one truck (" + Number(r["CF"]).toLocaleString() + " CF) — assign a carrier";
        else if (urg === "Act now" && dd != null && dd < 0) doTxt = "OVERDUE — call the customer, deliver ASAP (" + (-dd) + "d late)";
        else if (urg === "Act now") doTxt = deadline ? "Start moving now — deliver by " + fmtShort(deadline) : "Start moving now";
        else if (urg === "Act soon" && r["Depart By"]) doTxt = "Plan departure by " + fmtShort(r["Depart By"]) + (String(r["Location"]).indexOf("Storage") >= 0 ? " — pull from storage first" : "");
        else if (urg === "Missing data") doTxt = "Fill FAD / timeframe in the calendar, or set Final FAD here";
        else if (r["Depart By"]) doTxt = "On track — truck departs by " + fmtShort(r["Depart By"]);
        else doTxt = "On track";
        r["Do"] = doTxt;
        return r;
      });
    }

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
        : /Our Storage|Other Storage|Storage \(sheet\)/.test(l) ? "ldp-loc-store"
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
    function beginCell(r) {
      var st = isStraight(r);
      var begin = st ? r["FAD"] : (r["FAD"] || r["Window End"]);
      if (!begin) return '<span class="ldp-nodate">not set</span>';
      var n = dayDiff(begin), end = r["Window End"], sub, cls;
      if (n > 0) { sub = "in " + n + "d"; cls = n <= 3 ? "soon" : "ok"; }
      else if (n === 0) { sub = "TODAY"; cls = "soon"; }
      else if (st) { sub = Math.abs(n) + "d late"; cls = "late"; }
      else if (end && dayDiff(end) >= 0) { sub = "open · " + dayDiff(end) + "d left"; cls = "soon"; }
      else { sub = "closed " + Math.abs(dayDiff(end || begin)) + "d ago"; cls = "late"; }
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
      var held = all.filter(function (r) { return String(r["Possession"] || "").indexOf("unknown") >= 0; }).length;

      var kp = '<div class="ldp-kpis">'
        + '<div class="ldp-kpi neg"><b>' + actNow + "</b><span>Act now</span><small>overdue or departure passed</small></div>"
        + '<div class="ldp-kpi warn"><b>' + actSoon + "</b><span>Act soon</span><small>departure or window is close</small></div>"
        + '<div class="ldp-kpi"><b>' + noWin + "</b><span>Missing data</span><small>FAD / timeframe not set</small></div>"
        + '<div class="ldp-kpi"><b>' + held + "</b><span>Location unknown</span><small>picked up, whereabouts unrecorded</small></div>"
        + '<div class="ldp-kpi"><b>' + flagged.length + "</b><span>Flagged</span><small>needs a sheet correction</small></div></div>";

      var cur = all.slice();
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
      var anyF = !!(S.q || S.co || S.loc);
      var bar = '<div class="ldp-bar">'
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
        return '<div class="ldp-jobs">'
          + calLink(r["Pickup Event URL"], r["Pickup Event Date"], "Pickup")
          + calLink(r["Delivery Event URL"], r["Delivery Event Date"], "Delivery")
          + '<span class="ldp-dstat ' + dlvClass(r["Delivery Status"]) + '">'
          + esc(r["Delivery Status"] || "-") + "</span></div>";
      }
      function LOC_OPTS(cur) {
        var opts = ["", "Our Storage", "Rented Storage", "Other Storage", "On Our Truck",
                    "At Carrier", "In Transit", "Delivered Area", "Unknown"];
        return opts.map(function (o) {
          return '<option value="' + esc(o) + '"' + (o === cur ? " selected" : "") + ">"
            + (o || "— derived automatically —") + "</option>";
        }).join("");
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
             ["Timeframe", esc(r["Timeframe"] || "—")]]
          : [["FAD", fmtD(r["FAD"]) + (r["FAD Source"] ? ' <span class="ldp-sub">(' + esc(r["FAD Source"]) + ")</span>" : "")],
             ["Window", windowTxt(r) + (r["Window Note"] ? ' <span class="ldp-sub">' + esc(r["Window Note"]) + "</span>" : "")],
             ["Timeframe", esc(r["Timeframe"] || "—")]];

        return ''
          + (r["Do"] ? '<div class="ldp-dnote"><b>Do:</b> ' + esc(r["Do"]) + "</div>" : "")
          + (r["Data Issue"] ? '<div class="ldp-dissue' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
              + '" style="margin-top:9px">⚠ ' + esc(r["Data Issue"]) + "</div>" : "")
          + '<div class="ldp-sec">Calendar jobs</div>' + jobsCell(r)
          + '<div class="ldp-sec">Route</div>'
          + kv([["From", esc(r["Moving From"] || "—")],
                ["To", esc(r["Moving To"] || "—") + (r["Delivery State"] ? " (" + esc(r["Delivery State"]) + ")" : "")]])
          + '<div class="ldp-sec">Delivery</div>'
          + kv(delivery.concat([
                ["Depart by", fmtD(r["Depart By"]) + (r["Trip Days"] != null ? ' <span class="ldp-sub">' + r["Trip Days"] + "d trip</span>" : ' <span class="ldp-sub">trip days not set</span>')]]))
          + '<div class="ldp-sec">Where it is</div>'
          + kv([["Custody", esc(r["Possession"] || "—")],
                ["Location", esc(r["Location"] || "—") + (det ? ' <span class="ldp-sub">' + esc(det) + "</span>" : "")],
                r["Carrier Driver"] ? ["Carrier", esc(r["Carrier Driver"])] : null,
                r["Total To Carrier"] != null ? ["To carrier", money(r["Total To Carrier"])] : null,
                ["Sticker", esc(r["Sticker"] || "—")]])
          + '<div class="ldp-sec">Job</div>'
          + kv([r["Balance Due"] != null ? ["Balance due", money(r["Balance Due"])] : null,
                r["CF"] != null ? ["CF", Number(r["CF"]).toLocaleString()] : null,
                ["Sheet row", esc(r["Sheet Row"] || "—")]])
          + '<div class="ldp-sec">Plan — saved with history</div>'
            + '<div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end" data-ldpform="1" data-co="' + esc(r._co) + '" data-req="' + esc(r._rq) + '" data-row="' + esc(r["Sheet Row"] || "") + '">'
            + '<div class="ldp-fgrp"><span class="ldp-flbl">Plan</span>'
            +   '<label>Trip days<input type="number" min="1" max="60" data-ldf="trip_days" value="' + esc(r._ent.trip_days && r._ent.trip_days.value || "") + '" style="width:78px"></label>'
            +   '<label>Final FAD<input type="date" data-ldf="final_fad" value="' + esc(r._ent.final_fad && r._ent.final_fad.value || "") + '"></label>'
            +   '<label>Timeframe<input type="text" data-ldf="timeframe" placeholder="e.g. 7-10 business days" value="' + esc(r._ent.timeframe && r._ent.timeframe.value || "") + '" style="width:170px"></label>'
            +   '<label>Final CF<input type="number" min="1" max="20000" data-ldf="final_cf" value="' + esc(r._ent.final_cf && r._ent.final_cf.value || "") + '" style="width:96px"></label>'
            + '</div>'
            + '<div class="ldp-fgrp"><span class="ldp-flbl">Where it is</span>'
            +   '<label>Location<select data-ldf="location">' + LOC_OPTS(r._ent.location && r._ent.location.value || "") + '</select></label>'
            +   '<label>Detail<input type="text" data-ldf="location_note" placeholder="unit / address / who has it" value="' + esc(r._ent.location_note && r._ent.location_note.value || "") + '" style="width:220px"></label>'
            +   '<input type="hidden" data-ldf="location_lat" value="' + esc(r._ent.location_lat && r._ent.location_lat.value || "") + '">'
            +   '<input type="hidden" data-ldf="location_lng" value="' + esc(r._ent.location_lng && r._ent.location_lng.value || "") + '">'
            +   '<button class="ldp-mapbtn" type="button">📍 ' + ((r._ent.location_lat && r._ent.location_lat.value) ? "Move pin" : "Pin on map") + '</button>'
            +   '<span class="ldp-pin ldp-det">' + ((r._ent.location_lat && r._ent.location_lat.value) ? esc(Number(r._ent.location_lat.value).toFixed(4)) + ", " + esc(Number(r._ent.location_lng.value).toFixed(4)) : "no pin") + '</span>'
            + '</div>'
            + '<button class="ldp-savebtn">Save</button>'
            + '<span class="ldp-saveinfo ldp-det">' + (function () {
                var last = ["trip_days", "final_fad", "final_cf", "timeframe", "location", "location_note"].map(function (f) { return r._ent[f]; }).filter(Boolean)
                  .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); })[0];
                return last ? "last set by " + esc(String(last.by || "").split("@")[0].replace("import:ld-sheet", "old sheet import")) + " · " + esc(String(last.at || "").slice(0, 16)) : "not set yet";
              })() + "</span>"
            + "</div>"
        ;
      }

      // The drawer is rendered OUTSIDE the table, so a repaint of the list never destroys
      // a half-filled edit form — and closing it does not re-render the board.
      function openDrawer(key) {
        var dr = document.getElementById("ldpDrawer"), sc = document.getElementById("ldpScrim");
        if (!dr || !sc) return;
        S.sel = key;
        host.querySelectorAll("tr.ldp-row").forEach(function (tr) {
          tr.classList.toggle("on", tr.getAttribute("data-ldk") === key);
        });
        if (!key) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        var r = cur.filter(function (x, i2) { return String(x["Sheet Row"] || i2) === key; })[0];
        if (!r) { dr.classList.remove("show"); sc.classList.remove("show"); return; }
        dr.innerHTML =
          '<div class="ldp-dhd"><button class="x" id="ldpDx" title="Close">✕</button>'
          + '<div class="ldp-dnm">' + esc(r["Customer"] || "—") + "</div>"
          + '<div class="ldp-dmeta">' + esc(String(r["Request #"] || "—"))
          + (r["Job Code"] ? " · " + esc(String(r["Job Code"]).split(",")[0]) : "")
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
      // Custody in one token, used for the chip, the holding bar and the filter chips.
      function custKey(r) {
        var p = String(r["Possession"] || "");
        return p === "With us" ? "us" : p === "With carrier" ? "car"
             : p === "Third-party storage" ? "tp" : "unk";
      }
      var CUST_LABEL = { us: "With us", car: "Carrier", tp: "Storage", unk: "Where?" };

      var TL_DAYS = 42;
      function tlMid(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
      function tlParse(v) { var t = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? tlMid(new Date(t + "T12:00:00")) : null; }
      // Default the window to start a week BEFORE today, not on it. Anchoring at today put
      // TODAY flush against the left edge and pushed every overdue deadline off-range as a
      // chevron — and this board is mostly overdue work, so the default view was a column of
      // chevrons. A week of lead-in also means a pickup that just happened is still visible.
      function tlStart() {
        if (S.tlStart) return tlMid(new Date(S.tlStart));
        var d = tlMid(new Date());
        d.setDate(d.getDate() - 7);
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
          + '<span class="ldp-tllabtx"><b>' + esc(r["Customer"] || "\u2014")
          +   '<span class="ldp-tltype">' + (st8 ? "STRAIGHT" : "REGULAR") + "</span></b>"
          + "<span>" + esc(String(r["Request #"] || "\u2014")) + (r["Moving To"] ? " \u00b7 " + esc(String(r["Moving To"])) : "") + "</span>"
          + '<span class="ldp-tlcust ' + ck2 + '">' + CUST_LABEL[ck2] + "</span></span></div>"
          + '<div class="ldp-tlcal">' + bars + "</div></div>";
      }
      function timelineHtml(rows) {
        var st = tlStart(), days = TL_DAYS, dp = 100 / days;
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
        var segs = [["", "All"], ["straight", "Straight"], ["regular", "Regular"],
                    ["us", "With us"], ["tp", "Storage"], ["car", "Carrier"], ["unk", "Location unknown"]];
        var segCount = function (k) {
          return rows.filter(function (r) {
            if (!k) return true;
            if (k === "straight") return isStraight(r);
            if (k === "regular") return !isStraight(r);
            return custKey(r) === k;
          }).length;
        };
        var chips = '<div class="ldp-tlf">' + segs.map(function (o) {
          return '<button class="ldp-tlchip' + (S.tlSeg === o[0] ? " on" : "") + '" data-tlseg="' + o[0] + '">'
            + o[1] + "<i>" + segCount(o[0]) + "</i></button>";
        }).join("") + "</div>";
        return chips + '<div class="ldp-tlbar">'
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
              + '<div class="ldp-sub">' + esc(String(r["Request #"] || "—"))
              + (r["Company"] && r["Company"] !== "Zip to Zip" ? " · " + esc(r["Company"]) : "")
              + "</div></td>"
          + "<td>" + typeChip(r) + "</td>"
          + "<td>" + esc(String(r["Moving To"] || "—")) + "</td>"
          + '<td class="ldp-jobstd">' + jobsCell(r) + "</td>"
          + "<td>" + possPill(r) + "</td>"
          + "<td>" + locPill(r) + "</td>"
          + '<td class="ldp-begin">' + beginCell(r) + "</td>"
          + "<td>" + fmtD(r["Depart By"]) + "</td>"
          + "<td>" + urgPill(r)
              + (r["Data Issue"] ? ' <span class="ldp-flagdot' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
                  + '" title="' + esc(r["Data Issue"]) + '">⚠</span>' : "")
            + "</td></tr>";
        return main;
      }).join("");

      var tbl = '<div class="ldp-card"><div class="ldp-wrap"><table class="ldp-tbl"><thead><tr>'
        + "<th>Customer</th><th>Type</th><th>Delivering to</th>"
        + "<th>Jobs &amp; status</th><th>Custody</th><th>Location</th>"
        + "<th class=\"ldp-hbegin\">Deliver from</th><th>Depart by</th><th>Status</th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="9" style="color:var(--faint);padding:18px">No rows match — clear the filters, or the last build produced nothing.</td></tr>')
        + "</tbody></table></div>"
        + '<div class="ldp-fnote">Click a row for the full details. <b>Sorted by when we must act</b> — '
        + "soonest deadline first, whatever the pickup date. <b>Straight</b> jobs show a committed "
        + "delivery date (the office records it in the FAD field); <b>Regular</b> jobs show the FAD "
        + "and its window. Data refreshes with the pipeline (hourly).</div></div>";

      // keep the scroll position — a repaint used to snap back to the top; the vertical
      // scroller is the table wrap (.ldp-wrap), not the window — restore both
      var sx = window.scrollX, sy = window.scrollY;
      var wrap0 = document.querySelector("#ldpBody .ldp-wrap");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      document.getElementById("ldpBody").innerHTML = kp + bar + (S.view === "timeline" ? timelineHtml(cur) : tbl);
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
      var wrap1 = document.querySelector("#ldpBody .ldp-wrap");
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
      var cl = host.querySelector("#ldpClr"); if (cl) cl.onclick = function () { S.q = ""; S.co = ""; S.loc = ""; paint(); };
      Array.prototype.forEach.call(host.querySelectorAll("[data-ldview]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-ldview"); paint(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-tlseg]"), function (b) {
        b.onclick = function () { S.tlSeg = b.getAttribute("data-tlseg"); paint(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-tl]"), function (b) {
        b.onclick = function () {
          var a = b.getAttribute("data-tl");
          if (a === "today") S.tlStart = null;
          else {
            var d0 = S.tlStart ? new Date(S.tlStart) : new Date();
            d0.setDate(d0.getDate() + (a === "next" ? 14 : -14));
            S.tlStart = d0.toISOString().slice(0, 10);
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
