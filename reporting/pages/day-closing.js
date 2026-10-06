/* DAY CLOSING — the office drawer, closed once a day (LOGISTICS group, plan
   docs/plans/2026-09-27-day-closing.md). Money Flow is the "pre-thing": dispatch confirms each
   job there; the day closes itself at 8 PM New York (2026-09-28: no button). His layout
   (2026-09-27): one row per day with its total, + opens every foreman with his totals, a PDF for
   the day and for each foreman, and a drill down to the jobs. Days before the cutover are
   RECONSTRUCTED from each record's New York date and say so. Data: /api/_dc
   (bridge/day_closing.py). This file also exposes window.ZDC — the strip, the Close dialog and
   the print sheet — so Money Flow reuses exactly the same pieces. */

(function () {
  var POS = "#1c7a4a", NEG = "#b02a37", BLUE = "#2f6fd0", AMB = "#8a5a00";
  function esc(s) { return (window.RSC && RSC.esc) ? RSC.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(v) { if (v == null) return "—"; var n = Math.round(v); return n === 0 ? "$0" : (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US"); }
  function money2(v) { if (v == null) return "—"; var a = Math.abs(Math.round(v * 100) / 100); var s = a.toLocaleString("en-US", { minimumFractionDigits: a % 1 ? 2 : 0, maximumFractionDigits: 2 }); return (v < -0.004 ? "−$" : "$") + s; }
  function fmtDay(d) { if (!d) return "—"; var x = new Date(String(d).slice(0, 10) + "T12:00:00"); return isNaN(x) ? d : x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
  function fmtAt(s) { if (!s) return "—"; var x = new Date(String(s).replace(" ", "T") + ":00"); return isNaN(x) ? s : x.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " " + String(s).slice(11, 16); }
  function short(email) { return String(email || "").split("@")[0].replace(/^./, function (c) { return c.toUpperCase(); }); }

  async function api(qs, body) {
    var opt = { headers: { "Authorization": "Bearer " + ZTZ.getToken() } };
    if (body) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    var r = await fetch(ZTZ.API + "/api/_dc" + (qs || ""), opt);
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; e.body = j; throw e; }
    return j;
  }

  function css() {
    if (document.getElementById("dclCss")) return;
    var st = document.createElement("style"); st.id = "dclCss";
    st.textContent = `
      .dcl-strip{display:flex;flex-direction:column;gap:6px;background:var(--panel);border:1px solid var(--line-2);border-left:4px solid ${POS};border-radius:12px;padding:10px 14px;margin-bottom:12px}
      .dcl-strip .big{font-size:21px;font-weight:800;letter-spacing:-.3px;font-variant-numeric:tabular-nums}
      .dcl-strip .unit{font-size:12.5px;font-weight:600;color:var(--muted)}
      .dcl-strip .lbl{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}
      .dcl-strip .sub{font-size:12.5px;color:var(--muted);line-height:1.5;font-variant-numeric:tabular-nums}
      .dcl-shead{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .dcl-srow{display:grid;grid-template-columns:minmax(150px,190px) minmax(170px,230px) minmax(250px,1fr) minmax(130px,190px);gap:4px 16px;align-items:baseline}
      .dcl-srow .who{font-size:12.5px;font-weight:800;color:var(--muted)}
      .dcl-srow.mine .who{color:${POS}}
      .dcl-srow + .dcl-srow{border-top:1px dashed var(--line);padding-top:6px}
      @media (max-width:900px){.dcl-srow{grid-template-columns:1fr 1fr}}
      .dcl-btn{font:inherit;font-size:13px;font-weight:800;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);border-radius:9px;padding:8px 14px;cursor:pointer;white-space:nowrap}
      .dcl-btn:hover{background:var(--panel-2)} .dcl-btn:disabled{opacity:.55;cursor:default}
      .dcl-btn.pri{background:${POS};border-color:${POS};color:#fff} .dcl-btn.pri:hover{filter:brightness(1.08)}
      .dcl-btn.sm{font-size:11.5px;padding:5px 10px}
      .dcl-link{font-size:12.5px;font-weight:800;color:${BLUE};text-decoration:none;cursor:pointer}
      .dcl-back{position:fixed;inset:0;z-index:95;background:rgba(14,22,33,.5);display:flex;align-items:center;justify-content:center;padding:20px}
      .dcl-modal{background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:14px;width:min(460px,96vw);padding:18px 20px;box-shadow:0 24px 70px rgba(14,22,33,.35)}
      .dcl-modal h3{margin:0 0 4px;font-size:18px;font-weight:800}
      .dcl-modal p{margin:0 0 12px;font-size:13px;color:var(--muted)}
      .dcl-sum{width:100%;border-collapse:collapse;font-size:13.5px;margin-bottom:12px}
      .dcl-sum td{padding:5px 0}.dcl-sum td.r{text-align:right;font-variant-numeric:tabular-nums}
      .dcl-sum tr.tot td{border-top:1px solid var(--line);padding-top:9px;font-weight:800;font-size:15.5px}
      .dcl-f{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      .dcl-f label{font-size:11.5px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}
      .dcl-f input{display:block;width:100%;margin-top:5px;font:inherit;font-size:13.5px;padding:8px 10px;border:1px solid var(--line-2);border-radius:9px;background:var(--panel);color:var(--ink);box-sizing:border-box}
      .dcl-act{display:flex;justify-content:flex-end;gap:8px}
      .dcl-err{background:rgba(176,42,55,.08);color:${NEG};border-radius:9px;padding:8px 10px;font-size:12.5px;margin-bottom:10px}
      .dcl-ok{background:rgba(28,122,74,.10);color:${POS};border-radius:9px;padding:8px 10px;font-size:12.5px;margin-bottom:10px}
      .dcl-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
      .dcl-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
      .dcl-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted);max-width:780px}
      .dcl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px}
      .dcl-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
      .dcl-kpi b{display:block;font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
      .dcl-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
      .dcl-kpi small{display:block;font-size:11px;color:var(--faint);margin-top:2px}
      .dcl-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
      .dcl-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px}
      .dcl-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13px;font-weight:800;padding:7px 15px;border-radius:8px}
      .dcl-seg button.on{background:var(--brand);color:var(--brand-ink)}
      .dcl-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:240px;flex:1;max-width:420px}
      .dcl-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
      .dcl-wrap{overflow:auto;max-height:calc(100vh - var(--pg-chrome, 330px))}
      .dcl-tbl{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed;min-width:1080px}
      .dcl-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;z-index:2}
      .dcl-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dcl-tbl .r{text-align:right;font-variant-numeric:tabular-nums}
      .dcl-tbl td:last-child{overflow:visible;text-overflow:clip}
      .dcl-tbl tr.day{cursor:pointer} .dcl-tbl tr.day:hover td{background:var(--panel-2)}
      .dcl-tbl tr.day td{font-weight:800}
      .dcl-tbl tr.open td{background:rgba(28,122,74,.06)}
      .dcl-tbl tr.ps{cursor:pointer} .dcl-tbl tr.ps td{background:var(--panel-2);font-size:13.5px}
      .dcl-tbl tr.ps td.nm{padding-left:34px;font-weight:800}
      .dcl-tbl tr.fm{cursor:pointer} .dcl-tbl tr.fm td{font-size:13.5px}
      .dcl-tbl tr.fm td.nm{padding-left:58px;font-weight:700}
      .dcl-tbl tr.ln td{font-size:12.5px;color:var(--muted)} .dcl-tbl tr.ln td.first{padding-left:82px}
      .dcl-caret{display:inline-block;width:16px;color:var(--faint);font-size:11px}
      .dcl-pill{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 8px;border-radius:999px;margin-left:8px;vertical-align:1px;white-space:nowrap}
      .dcl-pill.rec{background:rgba(138,90,0,.12);color:${AMB}} .dcl-pill.lock{background:var(--panel-2);color:var(--faint)}
      .dcl-pill.open{background:rgba(28,122,74,.12);color:${POS}} .dcl-pill.card{background:rgba(47,111,208,.12);color:${BLUE}}
      .dcl-meta{font-weight:600;color:var(--faint);font-size:12px;margin-left:8px}
      .dcl-pos{color:${POS}} .dcl-neg{color:${NEG}}
      .dcl-note{padding:10px 14px;font-size:11.5px;color:var(--faint);border-top:1px solid var(--line)}
      .dcl-load{padding:40px;text-align:center;color:var(--faint)}
      .dcl-more{display:block;margin:10px auto}
      /* ---- DESIGN V2 "Calm finance" (2026-10-06). Light theme only; dark keeps every rule
         above. Look only -- the strip, the table, the dialogs and the print sheet behave and
         count exactly as before. The strip is the artboard's "Today's drawer" panel. ---- */
      body.rs-app.light.v2 .dcl-strip{border:1px solid #E2E8F0;border-radius:10px;padding:12px 16px;background:#FFFFFF}
      body.rs-app.light.v2 .dcl-strip .big{font-size:20px;font-weight:700}
      body.rs-app.light.v2 .dcl-strip .unit{font-size:13px;font-weight:500;color:#64748B}
      body.rs-app.light.v2 .dcl-strip .lbl{text-transform:none;letter-spacing:0;font-size:13px;font-weight:600;color:#475569}
      body.rs-app.light.v2 .dcl-strip .sub{font-size:13px;color:#64748B}
      body.rs-app.light.v2 .dcl-srow .who{font-size:13px;font-weight:600;color:#475569}
      body.rs-app.light.v2 .dcl-srow.mine .who{color:#1E3A8A}
      body.rs-app.light.v2 .dcl-srow + .dcl-srow{border-top:1px solid #F1F5F9}
      body.rs-app.light.v2 .dcl-btn{border-radius:8px;border-color:#CBD5E1;font-size:13px;font-weight:600}
      body.rs-app.light.v2 .dcl-btn:hover{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-btn.pri{background:#1E3A8A;border-color:#1E3A8A;color:#FFFFFF}
      body.rs-app.light.v2 .dcl-btn.pri:hover{filter:none;background:#1E40AF}
      body.rs-app.light.v2 .dcl-btn.sm{font-size:12.5px;padding:5px 10px}
      body.rs-app.light.v2 .dcl-link{font-size:13.5px;font-weight:600;color:#1D4ED8}
      body.rs-app.light.v2 .dcl-link:hover{color:#1E3A8A}
      body.rs-app.light.v2 .dcl-back{background:rgba(15,23,42,.38)}
      body.rs-app.light.v2 .dcl-modal{border-radius:12px;border-color:#E2E8F0;box-shadow:0 20px 50px rgba(15,23,42,.22)}
      body.rs-app.light.v2 .dcl-modal h3{font-size:16px;font-weight:600}
      body.rs-app.light.v2 .dcl-modal p{font-size:13.5px;color:#475569}
      body.rs-app.light.v2 .dcl-sum tr.tot td{font-weight:700;border-top-color:#E2E8F0}
      body.rs-app.light.v2 .dcl-f label{text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:500;color:#475569}
      body.rs-app.light.v2 .dcl-f input{border-radius:8px;border-color:#CBD5E1}
      body.rs-app.light.v2 .dcl-err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B;border-radius:8px;font-size:13px}
      body.rs-app.light.v2 .dcl-ok{background:#F0FDF4;border:1px solid #BBF7D0;color:#166534;border-radius:8px;font-size:13px}
      body.rs-app.light.v2 .dcl-head h1{font-size:26px;font-weight:700;letter-spacing:-.35px}
      body.rs-app.light.v2 .dcl-head p{font-size:14.5px;line-height:1.55;color:#475569;margin-top:6px}
      body.rs-app.light.v2 .dcl-kpis{gap:12px}
      body.rs-app.light.v2 .dcl-kpi{display:flex;flex-direction:column;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;background:#FFFFFF}
      body.rs-app.light.v2 .dcl-kpi span{order:-1;margin:0;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;color:#475569}
      body.rs-app.light.v2 .dcl-kpi b{font-size:24px;font-weight:700;letter-spacing:-.3px;margin-top:4px}
      body.rs-app.light.v2 .dcl-kpi small{font-size:12.5px;color:#64748B}
      body.rs-app.light.v2 .dcl-seg{background:transparent;border:0;padding:0;gap:6px}
      body.rs-app.light.v2 .dcl-seg button{border:1px solid #CBD5E1;background:#FFFFFF;color:#0F172A;border-radius:999px;font-size:13.5px;font-weight:600;padding:7px 14px;min-height:36px}
      body.rs-app.light.v2 .dcl-seg button:hover{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-seg button.on{background:#1E3A8A;border-color:#1E3A8A;color:#FFFFFF}
      body.rs-app.light.v2 .dcl-q{border-radius:999px;border-color:#E2E8F0;font-size:13.5px;padding:8px 14px;min-height:38px;box-sizing:border-box}
      body.rs-app.light.v2 .dcl-q:focus{outline:0;border-color:#2563EB;box-shadow:0 0 0 3px rgba(37,99,235,.14)}
      body.rs-app.light.v2 .dcl-card{border-radius:10px;border-color:#E2E8F0}
      body.rs-app.light.v2 .dcl-tbl th{background:#F8FAFC;text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:600;color:#475569;border-bottom-color:#E2E8F0}
      body.rs-app.light.v2 .dcl-tbl td{border-top-color:#F1F5F9}
      body.rs-app.light.v2 .dcl-tbl tr.day td{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.day:hover td{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-tbl tr.open td{background:#EFF6FF}
      body.rs-app.light.v2 .dcl-tbl tr.ps td{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-tbl tr.ps td.nm{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.fm td.nm{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.ln td{font-size:13px;color:#475569}
      body.rs-app.light.v2 .dcl-caret{color:#64748B}
      body.rs-app.light.v2 .dcl-pill{border-radius:6px;font-size:12px;font-weight:600;padding:2px 8px}
      body.rs-app.light.v2 .dcl-pill.rec{background:#FEF3C7;color:#92400E}
      body.rs-app.light.v2 .dcl-pill.lock{background:#F1F5F9;color:#475569}
      body.rs-app.light.v2 .dcl-pill.open,body.rs-app.light.v2 .dcl-pill.card{background:#EFF6FF;color:#1D4ED8}
      body.rs-app.light.v2 .dcl-meta{font-size:12.5px;font-weight:400;color:#64748B}
      body.rs-app.light.v2 .dcl-pos{color:#15803D} body.rs-app.light.v2 .dcl-neg{color:#B91C1C}
      body.rs-app.light.v2 .dcl-note{font-size:12.5px;color:#64748B;border-top-color:#E2E8F0}`;
    document.head.appendChild(st);
  }

  // one sentence per foreman: what happened to the drawer because of him
  function outcome(f) {
    if (f.net > 0.5) return "hands in " + money(f.net);
    if (f.net < -0.5) return "paid " + money(-f.net) + " from the drawer";
    return "evens out";
  }

  // There is no Close button any more (Tornike 2026-09-28): the server seals the day at 8 PM
  // New York by itself, stamped 8:00 PM, and an evening with no record closes nothing.
  function person(l) { return String(l.by || "").trim().toLowerCase() || "unknown"; }
  function left(sec) {
    if (sec == null) return "";
    if (sec <= 60) return "less than a minute";
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return (h ? h + "h " : "") + m + "m";
  }
  // every countdown on screen ticks from the server's own "seconds to 8 PM" (not the viewer's clock)
  function tickCountdowns() {
    document.querySelectorAll(".dcl-cd[data-deadline]").forEach(function (el) {
      var s = Math.round((+el.getAttribute("data-deadline") - Date.now()) / 1000);
      el.textContent = s > 0 ? "closes automatically in " + left(s) : "closing now…";
    });
  }
  if (!window.__dclTick) window.__dclTick = setInterval(tickCountdowns, 15000);
  window.ZDC_tick = tickCountdowns;

  // ---- the printed sheet (a day, one person, or one foreman) -----------------------------
  function printSheet(w, day, lines, foreman, who) {
    if (!w) { alert("Your browser blocked the print window. Allow pop-ups for this site and try again."); return; }
    lines = (lines || []).filter(function (l) { return (!foreman || l.foreman === foreman) && (!who || person(l) === who); });
    var t = { cash_in: 0, card_out: 0, fines: 0, net: 0 }, byFm = {};
    lines.forEach(function (l) {
      if (l.effect > 0) t.cash_in += l.effect; else if (l.kind !== "Advance given") t.card_out += l.effect;
      if (l.kind === "Fine repaid") t.fines += l.effect;
      t.net += l.effect;
      var f = byFm[l.foreman] || (byFm[l.foreman] = { jobs: {}, cash: 0, card: 0, fines: 0, adv: 0, net: 0 });
      if (l.kind !== "Fine repaid" && l.kind !== "Advance given") f.jobs[l.job_code || l.event_id] = 1;
      if (l.kind === "Fine repaid") f.fines += l.effect; else if (l.kind === "Advance given") f.adv += l.effect;
      else if (l.effect > 0) f.cash += l.effect; else f.card += l.effect;
      f.net += l.effect;
    });
    var signed = day && day.kind === "signed", open = !day;
    var title = (who ? short(who) + " · " : "") + (foreman ? foreman + " · " : "");
    title += open ? "Open day (not closed yet)" : "Day closing · " + fmtDay(day.date);
    var sub = open ? "Printed " + new Date().toLocaleString("en-US") + " · still open"
      : signed ? "Closed " + fmtAt(day.closed_at) + (day.automatic ? " automatically" : " by " + short(day.closed_by)) + " · counted since " + fmtAt(day.since)
      : "Reconstructed from the records of that New York day — never signed";
    var fmRows = Object.keys(byFm).sort(function (a, b) { return byFm[b].net - byFm[a].net; }).map(function (n) {
      var f = byFm[n]; return "<tr><td>" + esc(n) + "</td><td class=r>" + Object.keys(f.jobs).length + "</td><td class=r>" + money2(f.cash)
        + "</td><td class=r>" + money2(f.card) + "</td><td class=r>" + (f.adv ? money2(f.adv) : "—") + "</td><td class=r>" + (f.fines ? money2(f.fines) : "—") + "</td><td class=r><b>" + money2(f.net) + "</b></td></tr>";
    }).join("");
    var lnRows = lines.slice().sort(function (a, b) { return (a.foreman + a.at).localeCompare(b.foreman + b.at); }).map(function (l) {
      var what = l.kind === "Fine repaid" ? "Debt repaid" + (l.note ? " — " + l.note : "")
        : l.kind === "Advance given" ? "Advance given to him" + (l.note ? " — " + l.note : "")
        : (l.kind === "Advance" ? "Advance · " : "") + (l.paid_from || (l.correction ? "correction: " + money2(l.prev) + " → " + money2(l.value) : ""));
      return "<tr><td>" + esc(l.foreman) + "</td><td>" + esc(l.job_code || "—") + "</td><td>" + esc(l.customer || "—") + "</td><td>"
        + esc(what) + "</td><td>" + esc(String(l.at || "").slice(5)) + "</td><td class=r>" + money2(l.effect) + "</td></tr>";
    }).join("");
    var sig = signed && !day.automatic ? ["Counted by · " + (day.counted_by || ""), "Closed by · " + short(day.closed_by), "Cash handed to · " + (day.handed_to || "")]
      : ["Counted by", "Checked by", "Cash handed to"];
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + "</title><style>"
      + "body{font-family:Arial,Helvetica,sans-serif;color:#1d232b;margin:28px;font-size:12px}h1{font-size:19px;margin:0 0 3px}"
      + ".sub{color:#6e747c;margin-bottom:14px}.boxes{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px}"
      + ".box{border:1px solid #dde2e6;border-radius:6px;padding:8px 10px}.box span{display:block;color:#6e747c;font-size:11px}.box b{font-size:16px}"
      + ".box.k{border-color:#1d232b}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{text-align:left;color:#6e747c;font-size:10.5px;"
      + "border-bottom:1px solid #1d232b;padding:5px 6px}td{border-bottom:1px solid #eef1f3;padding:5px 6px}.r{text-align:right}"
      + "h2{font-size:12px;letter-spacing:.05em;color:#6e747c;margin:6px 0}.sig{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:34px}"
      + ".sig div{border-top:1px solid #1d232b;padding-top:5px;color:#6e747c}@media print{body{margin:12mm}}</style></head><body>"
      + "<h1>" + esc(title) + '</h1><div class="sub">' + esc(sub) + " · Zip to Zip</div>"
      + '<div class="boxes"><div class="box"><span>Cash in</span><b>' + money2(t.cash_in) + '</b></div><div class="box"><span>Card jobs paid out</span><b>'
      + money2(t.card_out) + '</b></div><div class="box"><span>Debts repaid</span><b>' + money2(t.fines) + '</b></div><div class="box k"><span>'
      + (foreman ? "Net from this foreman" : "Should be in the drawer") + "</span><b>" + money2(t.net) + "</b></div></div>"
      + (foreman ? "" : "<h2>BY FOREMAN</h2><table><tr><th>Foreman</th><th class=r>Jobs</th><th class=r>Cash</th><th class=r>Card</th><th class=r>Advances given</th><th class=r>Debts repaid</th><th class=r>Net</th></tr>" + fmRows + "</table>")
      + "<h2>EVERY MOVEMENT</h2><table><tr><th>Foreman</th><th>Job</th><th>Customer</th><th>What</th><th>Recorded</th><th class=r>Drawer</th></tr>" + lnRows + "</table>"
      + '<div class="sig">' + sig.map(function (s) { return "<div>" + esc(s) + "</div>"; }).join("") + "</div>"
      + "<script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>");
    w.document.close();
  }

  // ---- the strip on top of Money Flow (and of Day Closing) -------------------------------
  // His rule (2026-09-28): someone who recorded anything today sees HIS total first and the
  // total of everyone on the next line; someone who recorded nothing sees just the total.
  function stripRow(label, t, mine) {
    return '<div class="dcl-srow' + (mine ? " mine" : "") + '"><div class="who">' + esc(label) + "</div>"
      + '<div><span class="big">' + money(t.net) + '</span> <span class="unit">in the drawer</span></div>'
      + '<div class="sub">' + money(t.cash_in) + " cash in · " + money(t.card_out) + " card jobs paid out"
      + (t.advances ? " · " + money(t.advances) + " advances given" : "") + "</div>"
      + '<div class="sub">' + t.n_jobs + " job" + (t.n_jobs === 1 ? "" : "s") + " · " + t.n_foremen + " foremen</div></div>";
  }
  function stripHtml(d, withLink) {
    var o = d.open, t = o.totals, me = String((d.me && d.me.email) || "").toLowerCase();
    var mine = (o.people || []).filter(function (p) { return p.person === me; })[0];
    var deadline = o.closes_in_s != null ? Date.now() + o.closes_in_s * 1000 : null;
    var when = t.n_lines && deadline == null ? "closes automatically at 8:00 PM NJ"
      : t.n_lines ? '<span class="dcl-cd" data-deadline="' + deadline + '">closes automatically in ' + left(o.closes_in_s) + "</span> · 8:00 PM NJ"
      : "nothing recorded yet — the day closes at 8:00 PM NJ only once something is recorded";
    return '<div class="dcl-shead"><span class="lbl">Open day · since ' + esc(fmtAt(o.since)) + "</span>"
      + '<span class="dcl-pill open" style="margin-left:0">' + when + "</span>"
      + (withLink ? '<a class="dcl-link" id="dclGoPage" style="margin-left:auto">Day Closing ›</a>' : "") + "</div>"
      + (mine ? stripRow("Your total · " + short(me), mine, true) : "")
      + stripRow(mine ? "Everyone" : "Total", t, false);
  }
  function mountStrip(el) {
    if (!el) return;
    css();
    el.className = "dcl-strip"; el.innerHTML = '<span class="sub">Loading the open day…</span>';
    var d;
    async function load() {
      if (!document.body.contains(el)) { clearInterval(el.__t); return; }
      try { d = await api("?open=1"); }
      catch (e) { el.innerHTML = '<span class="sub">Day Closing unavailable — ' + esc(e.message) + "</span>"; return; }
      if (!d.cutover) { el.style.display = "none"; return; }
      el.style.display = "";
      el.innerHTML = stripHtml(d, true);
      tickCountdowns();
      el.querySelector("#dclGoPage").onclick = function () { location.hash = "#page=day-closing"; };
    }
    clearInterval(el.__t);
    el.__t = setInterval(load, 20000);
    load();
  }

  window.ZDC = { api: api, css: css, printSheet: printSheet, mountStrip: mountStrip, stripHtml: stripHtml,
                 person: person, money: money, money2: money2, fmtDay: fmtDay, fmtAt: fmtAt, outcome: outcome,
                 short: short, esc: esc };
})();

registerPage({
  id: "day-closing",
  group: "logistics",
  title: "Day Closing",
  async render(host) {
    var Z = window.ZDC, esc = Z.esc, money = Z.money, money2 = Z.money2;
    Z.css();
    host.innerHTML = '<div class="dcl-head"><div><h1>Day Closing</h1>'
      + "<p>The office drawer, closed once a day. Dispatch confirms each job in Money Flow; every day at 8:00 PM New York the day closes by itself and seals what came in and went out before 8 PM (a day with no record doesn't close). "
      + "Click a day to see who confirmed what, a person to see their foremen, a foreman to see every movement. Days before the first closing are rebuilt from the records and marked so.</p></div>"
      + '<div><button class="dcl-btn" id="dclRefresh">↻ Refresh</button></div></div><div id="dclBody"><div class="dcl-load">Loading days…</div></div>';
    var S = window.__DCL || (window.__DCL = { view: "all", q: "", open: {}, popen: {}, fopen: {}, lines: {}, shown: 30 });
    if (!S.popen) S.popen = {};
    var data;
    async function load(force) {
      data = await Z.api(force ? "?fresh=1" : "");
    }
    try { await load(false); }
    catch (e) { document.getElementById("dclBody").innerHTML = '<div class="dcl-load">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    async function linesOf(key) {
      if (!S.lines[key]) S.lines[key] = (await Z.api("?lines=" + encodeURIComponent(key))).lines || [];
      return S.lines[key];
    }
    function netCls(v) { return v > 0.5 ? "dcl-pos" : v < -0.5 ? "dcl-neg" : ""; }

    function dayRow(d) {
      var k = d.key, open = !!S.open[k], t = d.totals;
      var label = d.kind === "open" ? "Open day" : Z.fmtDay(d.date);
      var pill = d.kind === "open" ? '<span class="dcl-pill open">open · since ' + esc(Z.fmtAt(d.since)) + "</span>"
        : d.kind === "reconstructed" ? '<span class="dcl-pill rec">reconstructed, not signed</span>'
        : d.status === "locked" ? '<span class="dcl-pill lock">🔒 locked</span>' : "";
      var closed = d.kind === "signed" ? (d.automatic ? "8:00 PM" + ' <span class="dcl-meta">automatic</span>'
          : esc(Z.fmtAt(d.closed_at)) + ' <span class="dcl-meta">by ' + esc(Z.short(d.closed_by)) + (d.handed_to ? " · to " + esc(d.handed_to) : "") + "</span>")
        : d.kind === "open" && t.n_lines && d.closes_in_s != null
          ? '<span class="dcl-meta" style="margin-left:0">8:00 PM · <span class="dcl-cd" data-deadline="' + (Date.now() + d.closes_in_s * 1000) + '">closes automatically in …</span></span>' : "";
      var acts = '<button class="dcl-btn sm" data-pdf="' + esc(k) + '">PDF</button>';
      if (d.kind === "signed" && data.me.manager) {
        acts += d.status === "locked"
          ? ' <button class="dcl-btn sm" data-unlock="' + d.id + '">Unlock</button>'
          : ' <button class="dcl-btn sm" data-lock="' + d.id + '">Lock</button>';
        if (d.id === (data.last_close && data.last_close.id)) acts += ' <button class="dcl-btn sm" data-reopen="' + d.id + '">Reopen</button>';
      }
      var row = '<tr class="day' + (d.kind === "open" ? " open" : "") + '" data-day="' + esc(k) + '"><td><span class="dcl-caret">' + (open ? "−" : "+") + "</span>"
        + label + pill + "</td><td>" + closed + '</td><td class="r">' + t.n_jobs + '</td><td class="r">' + t.n_foremen + '</td><td class="r">' + money(t.cash_in)
        + '</td><td class="r">' + money(t.card_out) + '</td><td class="r ' + netCls(t.net) + '">' + money(t.net) + '</td><td class="r">' + acts + "</td></tr>";
      if (!open) return row;
      // an older bridge sends no people: show the foremen straight under the day, as before
      if (!d.people) return row + (d.foremen || []).map(function (f) { return fmRow(d, null, f); }).join("");
      var people = d.people;
      return row + people.map(function (p) { return psRow(d, p); }).join("")
        + (people.length ? "" : '<tr><td colspan="8" style="color:var(--faint);padding-left:34px">Nothing moved the drawer.</td></tr>');
    }
    // the person who recorded the movements in Money Flow (Irakli, Kakha…) — his layout, 2026-09-28
    function psRow(d, p) {
      var pk = d.key + "|" + p.person, open = !!S.popen[pk];
      var row = '<tr class="ps" data-pk="' + esc(pk) + '"><td class="nm"><span class="dcl-caret">' + (open ? "−" : "+") + "</span>" + esc(Z.short(p.person))
        + '<span class="dcl-meta">confirmed ' + p.n_jobs + " job" + (p.n_jobs === 1 ? "" : "s") + '</span></td><td></td><td class="r">' + p.n_jobs
        + '</td><td class="r">' + p.n_foremen + '</td><td class="r">' + money(p.cash_in) + '</td><td class="r">' + money(p.card_out) + '</td><td class="r ' + netCls(p.net) + '">'
        + money(p.net) + '</td><td class="r"><button class="dcl-btn sm" data-ppdf="' + esc(pk) + '">PDF</button></td></tr>';
      if (!open) return row;
      return row + (p.foremen || []).map(function (f) { return fmRow(d, p, f); }).join("");
    }
    function fmRow(d, p, f) {
      var fk = d.key + "|" + (p ? p.person : "") + "|" + f.foreman, open = !!S.fopen[fk];
      var row = '<tr class="fm" data-fk="' + esc(fk) + '"><td class="nm"><span class="dcl-caret">' + (open ? "−" : "+") + "</span>" + esc(f.foreman)
        + '<span class="dcl-meta">' + esc(Z.outcome(f)) + (f.advances ? " · advance given " + money(-f.advances) : "") + (f.fines ? " · debt repaid " + money(f.fines) : "") + '</span></td><td></td><td class="r">' + f.n_jobs
        + '</td><td></td><td class="r">' + money(f.cash_in) + '</td><td class="r">' + money(f.card_out) + '</td><td class="r ' + netCls(f.net) + '">'
        + money(f.net) + '</td><td class="r"><button class="dcl-btn sm" data-fpdf="' + esc(fk) + '">PDF</button></td></tr>';
      if (!open) return row;
      var ls = S.lines[d.key];
      if (!ls) return row + '<tr class="ln"><td colspan="8" class="first">Loading…</td></tr>';
      return row + ls.filter(function (l) { return l.foreman === f.foreman && (!p || Z.person(l) === p.person); }).map(function (l) { return lineRow(d, l); }).join("");
    }
    function lineRow(d, l) {
      var what = l.kind === "Fine repaid" ? "Debt repaid" + (l.note ? " — " + esc(l.note) : "")
        : l.kind === "Advance given" ? "Advance given to him" + (l.note ? " — " + esc(l.note) : "")
        : (l.kind === "Advance" ? '<span class="dcl-pill card" style="margin:0 6px 0 0">advance</span>' : "")
          + (l.paid_from ? '<span class="dcl-pill card" style="margin:0 6px 0 0">card</span>' + esc(l.paid_from)
             : l.correction ? "correction " + money2(l.prev) + " → " + money2(l.value) : "");
      var take = d.kind === "signed" && data.me.manager && d.status !== "locked" && (l.src === "portal" || l.src === "fine")
        ? '<button class="dcl-btn sm" data-take="' + esc(d.id + "|" + l.src + "|" + l.src_id) + '">Take out</button>' : "";
      return '<tr class="ln"><td class="first" title="' + esc(l.customer || "") + '">' + esc(l.job_code || "—") + " · " + esc(l.customer || "—")
        + "</td><td>" + esc(Z.fmtAt(l.at)) + ' <span class="dcl-meta">' + esc(Z.short(l.by)) + '</span></td><td colspan="3">' + what
        + '</td><td></td><td class="r ' + netCls(l.effect) + '">' + money2(l.effect) + '</td><td class="r">' + take + "</td></tr>";
    }

    function paint() {
      var el = document.getElementById("dclBody"); if (!el) return;
      var o = data.open, now = new Date(), ym = now.toISOString().slice(0, 7);
      var signed = data.days.filter(function (d) { return d.kind === "signed"; });
      var month = data.days.filter(function (d) { return String(d.date).slice(0, 7) === ym; })
        .reduce(function (a, d) { return a + d.totals.net; }, 0) + o.totals.net;
      var lc = data.last_close;
      var kp = '<div class="dcl-strip">' + Z.stripHtml(data, false) + "</div>"
        + '<div class="dcl-kpis">'
        + '<div class="dcl-kpi"><b>' + (lc ? esc(Z.fmtAt(lc.closed_at)) : "—") + "</b><span>Last closed</span><small>"
        + (lc ? (lc.closed_by === "automatic" ? "automatically at 8:00 PM" : "by " + esc(Z.short(lc.closed_by))) : "no day closed yet") + "</small></div>"
        + '<div class="dcl-kpi"><b>' + money(month) + "</b><span>This month</span><small>net cash into the drawer</small></div>"
        + '<div class="dcl-kpi"><b>' + signed.length + "</b><span>Days closed</span><small>" + (data.days.length - signed.length) + " reconstructed before</small></div></div>";
      var seg = function (id, l) { return '<button class="' + (S.view === id ? "on" : "") + '" data-v="' + id + '">' + l + "</button>"; };
      var bar = '<div class="dcl-bar"><div class="dcl-seg">' + seg("all", "All days") + seg("signed", "Closed") + seg("rec", "Reconstructed") + "</div>"
        + '<input class="dcl-q" id="dclQ" placeholder="Search a foreman or a date (2026-09)" value="' + esc(S.q) + '"></div>';
      var q = S.q.trim().toLowerCase();
      var days = data.days.filter(function (d) {
        if (S.view === "signed" && d.kind !== "signed") return false;
        if (S.view === "rec" && d.kind !== "reconstructed") return false;
        return !q || String(d.date).indexOf(q) >= 0 || (d.foremen || []).some(function (f) { return f.foreman.toLowerCase().indexOf(q) >= 0; })
          || (d.people || []).some(function (p) { return p.person.indexOf(q) >= 0; });
      });
      var openRow = S.view === "rec" ? "" : dayRow({ key: "open", kind: "open", since: o.since, totals: o.totals, foremen: o.foremen,
                                                     people: o.people, closes_in_s: o.closes_in_s });
      var rows = days.slice(0, S.shown).map(dayRow).join("");
      el.innerHTML = kp + bar + '<div class="dcl-card"><div class="dcl-wrap"><table class="dcl-tbl">'
        + '<colgroup><col style="width:27%"><col style="width:16%"><col style="width:6%"><col style="width:7%"><col style="width:9%"><col style="width:9%"><col style="width:10%"><col style="width:16%"></colgroup>'
        + '<thead><tr><th>Day</th><th>Closed</th><th class="r">Jobs</th><th class="r">Foremen</th><th class="r">Cash in</th><th class="r">Card out</th><th class="r">In the drawer</th><th class="r"></th></tr></thead><tbody>'
        + openRow + (rows || '<tr><td colspan="8" style="color:var(--faint);padding:18px">No day matches.</td></tr>') + "</tbody></table>"
        + (days.length > S.shown ? '<button class="dcl-btn dcl-more" id="dclMore">Show 30 more days (' + (days.length - S.shown) + " left)</button>" : "")
        + '</div><div class="dcl-note">A day moves the drawer by what each record changed: a double click moves nothing, a correction moves only the difference. '
        + "Card jobs are covered by the same foreman's cash first, then by the drawer.</div></div>";
      wire();
      if (window.ZDC_tick) window.ZDC_tick();
      if (window.RSC && RSC.fitScroller) RSC.fitScroller(el.querySelector(".dcl-wrap"));
    }
    function dayByKey(k) { return k === "open" ? null : data.days.filter(function (d) { return d.key === k; })[0]; }
    async function act(body, confirmMsg) {
      if (confirmMsg && !(await RSC.confirm({ title: confirmMsg.t, body: confirmMsg.b, yes: confirmMsg.y, danger: true }))) return;
      try { await Z.api("", body); S.lines = {}; await load(true); paint(); }
      catch (e) { alert(e.message); }
    }
    function wire() {
      var root = document.getElementById("dclBody");
      root.querySelectorAll("[data-v]").forEach(function (b) { b.onclick = function () { S.view = b.getAttribute("data-v"); paint(); }; });
      var q = root.querySelector("#dclQ");
      if (q) q.oninput = function () { S.q = q.value; var p = q.selectionStart; paint(); var n = document.getElementById("dclQ"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { /* best effort */ } } };
      var more = root.querySelector("#dclMore"); if (more) more.onclick = function () { S.shown += 30; paint(); };
      root.querySelectorAll("tr.day").forEach(function (tr) { tr.onclick = function (e) { if (e.target.closest("button")) return; var k = tr.getAttribute("data-day"); S.open[k] = !S.open[k]; paint(); }; });
      root.querySelectorAll("tr.ps").forEach(function (tr) {
        tr.onclick = function (e) { if (e.target.closest("button")) return; var pk = tr.getAttribute("data-pk"); S.popen[pk] = !S.popen[pk]; paint(); };
      });
      root.querySelectorAll("tr.fm").forEach(function (tr) {
        tr.onclick = async function (e) {
          if (e.target.closest("button")) return;
          var fk = tr.getAttribute("data-fk"); S.fopen[fk] = !S.fopen[fk]; paint();
          if (S.fopen[fk]) { try { await linesOf(fk.split("|")[0]); } catch (x) { S.lines[fk.split("|")[0]] = []; } paint(); }
        };
      });
      root.querySelectorAll("[data-pdf]").forEach(function (b) {
        b.onclick = async function () { var k = b.getAttribute("data-pdf"); var w = window.open("", "_blank"); Z.printSheet(w, dayByKey(k), await linesOf(k), null); };
      });
      root.querySelectorAll("[data-ppdf]").forEach(function (b) {
        b.onclick = async function () { var pk = b.getAttribute("data-ppdf").split("|"); var w = window.open("", "_blank"); Z.printSheet(w, dayByKey(pk[0]), await linesOf(pk[0]), null, pk[1]); };
      });
      root.querySelectorAll("[data-fpdf]").forEach(function (b) {
        b.onclick = async function () { var fk = b.getAttribute("data-fpdf").split("|"); var w = window.open("", "_blank"); Z.printSheet(w, dayByKey(fk[0]), await linesOf(fk[0]), fk[2], fk[1]); };
      });
      var ver = function (id) { var d = data.days.filter(function (x) { return x.id === id; })[0]; return d ? d.version : null; };
      root.querySelectorAll("[data-lock]").forEach(function (b) { b.onclick = function () { var id = +b.getAttribute("data-lock"); act({ action: "lock", day_id: id, version: ver(id) }, { t: "Lock this day?", b: "Lock it once the cash is banked. A locked day can't be changed or reopened.", y: "Lock" }); }; });
      root.querySelectorAll("[data-unlock]").forEach(function (b) { b.onclick = function () { var id = +b.getAttribute("data-unlock"); act({ action: "unlock", day_id: id, version: ver(id) }, { t: "Unlock this day?", b: "It can then be changed or reopened again.", y: "Unlock" }); }; });
      root.querySelectorAll("[data-reopen]").forEach(function (b) { b.onclick = function () { var id = +b.getAttribute("data-reopen"); act({ action: "reopen", day_id: id, version: ver(id) }, { t: "Reopen the newest day?", b: "Its movements go back to the open day and close again at the next 8:00 PM. The closing is removed (the audit log keeps a copy).", y: "Reopen" }); }; });
      root.querySelectorAll("[data-take]").forEach(function (b) {
        b.onclick = function () { var p = b.getAttribute("data-take").split("|"); act({ action: "take_out", day_id: +p[0], src: p[1], src_id: p[2], version: ver(+p[0]) }, { t: "Take this line out?", b: "It goes back to the open day and this day's totals are recalculated.", y: "Take out" }); };
      });
    }
    var rb = document.getElementById("dclRefresh");
    if (rb) rb.onclick = async function () { rb.disabled = true; try { S.lines = {}; await load(true); } catch (e) { /* keep the last view */ } rb.disabled = false; paint(); };
    paint();
  },
});
