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
        .ldp-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
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
        .ldp-tbl{width:100%;border-collapse:collapse;font-size:14px;min-width:1180px}
        .ldp-tbl th{position:sticky;top:0;z-index:2;background:var(--panel);font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);text-align:left;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;user-select:none}
        .ldp-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:230px}
        .ldp-tbl tbody tr{height:56px}
        .ldp-tbl .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .ldp-tbl tbody tr.ldp-row{cursor:pointer}
        .ldp-tbl tbody tr.ldp-row:hover{background:var(--panel-2)}
        .ldp-tbl tbody tr.ldp-row.on{background:var(--brand-glow)}
        .ldp-cust{font-weight:700;color:var(--ink)}
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
        .ldp-fgrp{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;padding:9px 12px;border:1px solid var(--line);border-radius:11px;background:var(--panel);margin-right:10px}
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
        .ldp-count{font-size:13px;font-weight:700;color:var(--muted);margin-right:2px}
        .ldp-count b{font-size:15px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
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

    var S = window.__LDP || (window.__LDP = { view: "board", q: "", co: "", loc: "", sel: null });

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
    function dateLabel(r) { return isStraight(r) ? "Delivery date" : "FAD"; }
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
      var bar = '<div class="ldp-bar">'
        + '<span class="ldp-count"><b>' + cur.length + "</b> shipment" + (cur.length === 1 ? "" : "s") + "</span>"
        + '<input class="ldp-q" id="ldpQ" placeholder="Search customer / request / sticker" value="' + esc(S.q) + '">'
        + '<select class="ldp-sel" id="ldpCo"><option value="">All companies</option>' + Object.keys(cos).sort().map(function (c) {
            return '<option' + (S.co === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>"
        + '<select class="ldp-sel" id="ldpLoc"><option value="">All locations</option>' + Object.keys(locs).sort().map(function (l) {
            return '<option' + (S.loc === l ? " selected" : "") + ">" + esc(l) + "</option>"; }).join("") + "</select>"
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
        return ''
            + "<b>From:</b> " + esc(r["Moving From"] || "—") + " &nbsp; <b>To:</b> " + esc(r["Moving To"] || "—")
            + (r["Delivery State"] ? " (" + esc(r["Delivery State"]) + ")" : "")
            + "<br><b>Location:</b> " + esc(r["Location"]) + (det ? " — " + esc(det) : "")
            + (r["Carrier Driver"] ? " &nbsp; <b>Carrier driver:</b> " + esc(r["Carrier Driver"]) : "")
            + (r["Total To Carrier"] != null ? " &nbsp; <b>To carrier:</b> $" + Number(r["Total To Carrier"]).toLocaleString() : "")
            + "<br><b>FAD:</b> " + fmtD(r["FAD"]) + (r["FAD Source"] ? " (" + esc(r["FAD Source"]) + ")" : "")
            + " &nbsp; <b>Window:</b> " + windowTxt(r) + (r["Window Note"] ? " — " + esc(r["Window Note"]) : "")
            + " &nbsp; <b>Depart by:</b> " + fmtD(r["Depart By"]) + (r["Trip Days"] != null ? " (" + r["Trip Days"] + "d trip)" : " (trip days not set)")
            + " &nbsp; <b>Sticker:</b> " + esc(r["Sticker"] || "—")
            + (r["Do"] ? "<br><b>Do:</b> " + esc(r["Do"]) : "")
            // the PORTAL's manual planning fields — editable right here, saved with history
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
            + (r["Balance Due"] != null ? " &nbsp; <b>Balance due:</b> $" + Number(r["Balance Due"]).toLocaleString() : "")
            + (r["CF"] != null ? " &nbsp; <b>CF:</b> " + Number(r["CF"]).toLocaleString() : "")
            + " &nbsp; <b>Sheet row:</b> " + esc(r["Sheet Row"] || "—");
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

      var body = cur.map(function (r, i) {
        var key = String(r["Sheet Row"] || i);
        var det = String(r["Location Detail"] || "");
        // ONE LINE PER CELL. Anything that needs a second line belongs in the drawer —
        // that is what keeps every row the same height and the whole table scannable.
        var dvDate = isStraight(r) ? fmtD(r["FAD"]) : windowTxt(r);
        var main = '<tr class="ldp-row' + (S.sel === key ? " on" : "") + '" data-ldk="' + esc(key) + '">'
          + "<td>" + fmtD(r["Pickup Date"]) + "</td>"
          + '<td><span class="ldp-cust">' + esc(r["Customer"] || "—") + "</span>"
              + '<span class="ldp-sub"> · ' + esc(String(r["Request #"] || "—")) + "</span></td>"
          + "<td>" + esc(r["Type"] || "—") + "</td>"
          + "<td>" + esc(String(r["Moving To"] || "—")) + "</td>"
          + "<td>" + possPill(r) + "</td>"
          + "<td>" + locPill(r) + "</td>"
          + "<td>" + dvDate + '<span class="ldp-sub"> · ' + esc(r["Timeframe"] ? String(r["Timeframe"]) : (isStraight(r) ? "fixed date" : "no timeframe")) + "</span></td>"
          + "<td>" + fmtD(r["Depart By"]) + "</td>"
          + "<td>" + urgPill(r)
              + (r["Data Issue"] ? ' <span class="ldp-flagdot' + (String(r["Issue Kind"]) === "blocking" ? " blk" : "")
                  + '" title="' + esc(r["Data Issue"]) + '">⚠</span>' : "")
            + "</td></tr>";
        return main;
      }).join("");

      var tbl = '<div class="ldp-card"><div class="ldp-wrap"><table class="ldp-tbl"><thead><tr>'
        + "<th>Pickup</th><th>Customer</th><th>Type</th><th>Delivering to</th>"
        + "<th>Custody</th><th>Location</th><th>Delivery date / window</th><th>Depart by</th><th>Status</th>"
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
      document.getElementById("ldpBody").innerHTML = kp + bar + tbl;
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
      Array.prototype.forEach.call(host.querySelectorAll("tr.ldp-row"), function (tr) {
        tr.onclick = function () {
          var k = tr.getAttribute("data-ldk");
          openDrawer(k === S.sel ? null : k);
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
