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
             "Data Issue", "Carrier Driver", "Total To Carrier", "Balance Due", "CF",
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
        .ldp-card{position:relative;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
        .ldp-wrap{overflow-x:auto}
        .ldp-tbl{width:100%;border-collapse:collapse;font-size:13px}
        .ldp-tbl th{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);text-align:left;padding:10px 11px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:default}
        .ldp-tbl td{padding:9px 11px;border-bottom:1px solid var(--line);vertical-align:top}
        .ldp-tbl tbody tr:last-child td{border-bottom:0}
        .ldp-tbl .r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
        .ldp-tbl tbody tr.ldp-row{cursor:pointer}
        .ldp-tbl tbody tr.ldp-row:hover{background:var(--panel-2)}
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
        .ldp-issue{font-size:11.5px;font-weight:700;color:${WARN}}
      `;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="ldp-head"><div>
        <h1>Long Distance Planning</h1>
      </div></div>
      <div id="ldpBody"><div class="rs-loading">Loading shipments…</div></div>`;

    var S = window.__LDP || (window.__LDP = { view: "board", q: "", co: "", loc: "", open: {} });

    var rows;
    try { rows = await RS.load("fct_ld_planning"); }
    catch (e) { document.getElementById("ldpBody").innerHTML = '<div class="rs-loading">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    // ---- the PORTAL's manual planning fields (trip days / final FAD / final CF) ----
    // The portal is the source of truth for these (his call 2026-07-21). The pipeline
    // bakes current entries into fct_ld_planning every ~6h; this live overlay applies
    // anything entered SINCE, so a save shows its effect immediately.
    var LDP_ENT = {};
    async function loadEntries() {
      try {
        var j = await fetch(ZTZ.API + "/api/_ldp", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
        LDP_ENT = {};
        (j.entries || []).forEach(function (e) {
          (LDP_ENT[e.company + "|" + e.request_no] = LDP_ENT[e.company + "|" + e.request_no] || {})[e.field] = e;
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
        var en = LDP_ENT[co + "|" + rq] || {};
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

    function paint() {
      var all = overlaid();
      var live = all.filter(function (r) { return !r["Data Issue"]; });
      var fix = all.filter(function (r) { return r["Data Issue"]; });
      var actNow = live.filter(function (r) { return r["Urgency"] === "Act now"; }).length;
      var actSoon = live.filter(function (r) { return r["Urgency"] === "Act soon"; }).length;
      var noWin = live.filter(function (r) { return r["Urgency"] === "Missing data"; }).length;

      var kp = '<div class="ldp-kpis">'
        + '<div class="ldp-kpi neg"><b>' + actNow + "</b><span>Act now</span><small>overdue or departure passed</small></div>"
        + '<div class="ldp-kpi warn"><b>' + actSoon + "</b><span>Act soon</span><small>departure or window is close</small></div>"
        + '<div class="ldp-kpi"><b>' + noWin + "</b><span>Missing data</span><small>FAD / timeframe not set</small></div>"
        + '<div class="ldp-kpi"><b>' + fix.length + "</b><span>Data cleanup</span><small>rows to fix in the sheets</small></div></div>";

      var cur = (S.view === "board" ? live : fix).slice();
      if (S.co) cur = cur.filter(function (r) { return String(r["Company"]) === S.co; });
      if (S.loc) cur = cur.filter(function (r) { return String(r["Location"]) === S.loc; });
      var q = S.q.trim().toLowerCase();
      if (q) cur = cur.filter(function (r) {
        return String(r["Customer"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Request #"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Job Code"] || "").toLowerCase().indexOf(q) >= 0
          || String(r["Sticker"] || "").toLowerCase().indexOf(q) >= 0;
      });
      // urgency ladder first (his tool's model), then by how soon the truck must leave;
      // cleanup view groups by issue
      var rank = { "Act now": 0, "Act soon": 1, "On track": 2, "Missing data": 3 };
      cur.sort(function (a, b) {
        if (S.view === "fix") {
          var ia = String(a["Data Issue"]), ib = String(b["Data Issue"]);
          if (ia !== ib) return ia < ib ? -1 : 1;
          return String(b["Pickup Date"]) < String(a["Pickup Date"]) ? -1 : 1;
        }
        var ra = rank[a["Urgency"]] != null ? rank[a["Urgency"]] : 9;
        var rb = rank[b["Urgency"]] != null ? rank[b["Urgency"]] : 9;
        if (ra !== rb) return ra - rb;
        var ea = a["Depart By"] ? String(a["Depart By"]) : (a["Window End"] ? String(a["Window End"]) : "9999");
        var eb = b["Depart By"] ? String(b["Depart By"]) : (b["Window End"] ? String(b["Window End"]) : "9999");
        return ea < eb ? -1 : ea > eb ? 1 : 0;
      });

      var cos = {}; var locs = {};
      all.forEach(function (r) { cos[r["Company"]] = 1; locs[r["Location"]] = 1; });
      var segBtn = function (id, label, n) {
        return '<button class="' + (S.view === id ? "on" : "") + '" data-ldv="' + id + '">' + label + "<i>" + n + "</i></button>";
      };
      var bar = '<div class="ldp-bar">'
        + '<div class="ldp-seg">' + segBtn("board", "Live Board", live.length) + segBtn("fix", "Data Cleanup", fix.length) + "</div>"
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
      var body = cur.map(function (r, i) {
        var key = String(r["Sheet Row"] || i);
        var det = String(r["Location Detail"] || "");
        var main = '<tr class="ldp-row" data-ldk="' + esc(key) + '">'
          + "<td>" + fmtD(r["Pickup Date"]) + "</td>"
          + "<td><b>" + esc(r["Customer"] || "—") + "</b><div class=\"ldp-det\">" + esc(String(r["Request #"] || "")) + (r["Job Code"] ? " · " + esc(String(r["Job Code"]).split(",")[0]) : "") + (r["Company"] && r["Company"] !== "Zip to Zip" ? " · " + esc(r["Company"]) : "") + "</div></td>"
          + "<td>" + esc(r["Type"] || "—") + (r["CF"] != null ? '<div class="ldp-det">' + Number(r["CF"]).toLocaleString() + " CF</div>" : "") + "</td>"
          + "<td>" + esc(String(r["Moving To"] || "—").slice(0, 40)) + "</td>"
          + "<td>" + locPill(r) + (det ? '<div class="ldp-det">' + esc(det.slice(0, 54)) + "</div>" : "") + "</td>"
          + "<td>" + windowTxt(r) + (r["Timeframe"] ? '<div class="ldp-det">timeframe: ' + esc(String(r["Timeframe"]).slice(0, 24)) + "</div>" : "") + "</td>"
          + "<td>" + fmtD(r["Depart By"]) + (r["Trip Days"] != null ? '<div class="ldp-det">' + r["Trip Days"] + "d trip</div>" : "") + "</td>"
          + "<td>" + (S.view === "fix"
              ? '<span class="ldp-issue">' + esc(r["Data Issue"]) + "</span>"
              : urgPill(r) + (r["Do"] ? '<div class="ldp-det" style="max-width:230px">' + esc(r["Do"]) + "</div>" : "")) + "</td></tr>";
        var sub = "";
        if (S.open[key]) {
          sub = '<tr class="ldp-sub"><td colspan="8">'
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
            + '<div style="margin-top:10px;display:flex;gap:12px;flex-wrap:wrap;align-items:flex-end" data-ldpform="1" data-co="' + esc(r._co) + '" data-req="' + esc(r._rq) + '">'
            + '<label style="font-size:11px;font-weight:800;color:var(--faint)">TRIP DAYS<br><input type="number" min="1" max="60" data-ldf="trip_days" value="' + esc(r._ent.trip_days && r._ent.trip_days.value || "") + '" style="width:80px;font:inherit;padding:6px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink)"></label>'
            + '<label style="font-size:11px;font-weight:800;color:var(--faint)">FINAL FAD<br><input type="date" data-ldf="final_fad" value="' + esc(r._ent.final_fad && r._ent.final_fad.value || "") + '" style="font:inherit;padding:6px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink)"></label>'
            + '<label style="font-size:11px;font-weight:800;color:var(--faint)">FINAL CF<br><input type="number" min="1" max="20000" data-ldf="final_cf" value="' + esc(r._ent.final_cf && r._ent.final_cf.value || "") + '" style="width:100px;font:inherit;padding:6px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink)"></label>'
            + '<button class="ldp-savebtn" style="font:inherit;font-weight:800;font-size:12.5px;padding:8px 16px;border:0;border-radius:9px;background:var(--brand);color:var(--brand-ink);cursor:pointer">Save</button>'
            + '<span class="ldp-saveinfo ldp-det">' + (function () {
                var last = ["trip_days", "final_fad", "final_cf"].map(function (f) { return r._ent[f]; }).filter(Boolean)
                  .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); })[0];
                return last ? "last set by " + esc(String(last.by || "").split("@")[0].replace("import:ld-sheet", "old sheet import")) + " · " + esc(String(last.at || "").slice(0, 16)) : "not set yet";
              })() + "</span>"
            + "</div>"
            + (r["Balance Due"] != null ? " &nbsp; <b>Balance due:</b> $" + Number(r["Balance Due"]).toLocaleString() : "")
            + (r["CF"] != null ? " &nbsp; <b>CF:</b> " + Number(r["CF"]).toLocaleString() : "")
            + " &nbsp; <b>Sheet row:</b> " + esc(r["Sheet Row"] || "—")
            + "</td></tr>";
        }
        return main + sub;
      }).join("");

      var tbl = '<div class="ldp-card"><div class="ldp-wrap"><table class="ldp-tbl"><thead><tr>'
        + "<th>Pickup</th><th>Customer</th><th>Type</th><th>Delivering to</th><th>Location</th><th>Delivery window</th><th>Depart by</th><th>"
        + (S.view === "fix" ? "What to fix" : "What to do") + "</th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="8" style="color:var(--faint);padding:18px">Nothing here. 🎉</td></tr>')
        + "</tbody></table></div>"
        + '<div class="ldp-fnote">' + (S.view === "fix"
            ? "These rows need a correction in the Long Distance sheet itself — the board can only be as clean as the sheet."
            : "Click a row for the full details. Sorted by urgency: overdue first, then open windows by days left.")
        + " Data refreshes with the pipeline (~6h).</div></div>";

      // keep the scroll position — a repaint used to snap the page back to the top
      var sx = window.scrollX, sy = window.scrollY;
      document.getElementById("ldpBody").innerHTML = kp + bar + tbl;
      wire();
      window.scrollTo(sx, sy);
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll("[data-ldv]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-ldv"); paint(); };
      });
      var q = host.querySelector("#ldpQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = host.querySelector("#ldpQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      var co = host.querySelector("#ldpCo"); if (co) co.onchange = function () { S.co = co.value; paint(); };
      var lo = host.querySelector("#ldpLoc"); if (lo) lo.onchange = function () { S.loc = lo.value; paint(); };
      Array.prototype.forEach.call(host.querySelectorAll("tr.ldp-row"), function (tr) {
        tr.onclick = function () {
          var k = tr.getAttribute("data-ldk");
          S.open[k] = !S.open[k]; paint();
        };
      });
      // the manual-fields form: Save posts ONLY what changed, each change keeps history
      Array.prototype.forEach.call(host.querySelectorAll("[data-ldpform]"), function (box) {
        box.onclick = function (e) { e.stopPropagation(); };
        var btn = box.querySelector(".ldp-savebtn");
        if (!btn) return;
        btn.onclick = async function () {
          var co = box.getAttribute("data-co"), rq = box.getAttribute("data-req");
          var en = LDP_ENT[co + "|" + rq] || {};
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
                body: JSON.stringify({ company: co, request_no: rq, field: posts[i].field, value: posts[i].value }),
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
