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
      .dcl-head h2{margin:0;font-size:18px;font-weight:800;letter-spacing:-.3px}
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
      .dcl-pill.dcl-nc{background:var(--panel-2);color:var(--muted);margin:0 8px 0 0}
      .dcl-tbl tr.dcl-ncrow td{white-space:normal}
      .dcl-nclist{margin-top:4px;line-height:1.6}
      /* OFFICE CASH (2026-10-28): the expense / other income buttons, their dialog, the office
         rows under a person and the Expenses & income list */
      .dcl-ocbtns{display:inline-flex;gap:6px;margin-left:auto}
      .dcl-shead .dcl-ocbtns + .dcl-link{margin-left:12px !important}
      .dcl-ocm{width:min(560px,96vw)}
      .dcl-octog{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:3px;margin-bottom:12px}
      .dcl-octog button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:800;padding:6px 14px;border-radius:7px;cursor:pointer}
      .dcl-octog button.on{background:var(--panel);color:var(--ink);box-shadow:0 0 0 1px var(--line-2)}
      .dcl-oclbl{font-size:11.5px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;margin:0 0 6px}
      .dcl-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
      .dcl-chip{font:inherit;font-size:12.5px;font-weight:700;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);border-radius:999px;padding:5px 11px;cursor:pointer}
      .dcl-chip.on{background:${BLUE};border-color:${BLUE};color:#fff}
      .dcl-chip small{font-weight:600;opacity:.75;margin-left:4px}
      .dcl-f select{display:block;width:100%;margin-top:5px;font:inherit;font-size:13.5px;padding:8px 10px;border:1px solid var(--line-2);border-radius:9px;background:var(--panel);color:var(--ink);box-sizing:border-box}
      .dcl-f.one{grid-template-columns:1fr}
      .dcl-ocafter{font-size:13px;color:var(--muted);margin:-4px 0 12px}
      .dcl-ocafter b{color:var(--ink)}
      .dcl-warn{background:rgba(138,90,0,.10);color:${AMB};border-radius:9px;padding:8px 10px;font-size:12.5px;margin-bottom:10px}
      .dcl-tbl tr.oc td{font-size:13.5px} .dcl-tbl tr.oc td.nm{padding-left:58px;font-weight:700}
      .dcl-tbl tr.oc{cursor:pointer}
      .dcl-tbl tr.ocl td{font-size:12.5px;color:var(--muted)} .dcl-tbl tr.ocl td.first{padding-left:82px}
      .dcl-pill.exp{background:rgba(176,42,55,.10);color:${NEG}} .dcl-pill.inc{background:rgba(28,122,74,.12);color:${POS}}
      .dcl-pill.nc{background:var(--panel-2);color:var(--muted)}
      .dcl-ocbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
      .dcl-ocbar select{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:7px 10px}
      .dcl-month{display:inline-flex;align-items:center;gap:4px;font-weight:800;font-size:14px}
      .dcl-month b{min-width:130px;text-align:center}
      .dcl-tbl.oclist{min-width:1100px}
      .dcl-tbl.oclist tr.wd td{text-decoration:line-through;color:var(--faint)}
      .dcl-tbl.oclist td.why{white-space:normal}
      .dcl-cats{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:12px;margin:0 0 14px}
      .dcl-cats .box{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
      .dcl-cats .row{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:13px;border-top:1px solid var(--line)}
      .dcl-cats .row:first-of-type{border-top:0}
      .dcl-cats .row span{flex:1}
      .dcl-cats .row.off span{color:var(--faint);text-decoration:line-through}
      /* ---- DESIGN V2 "Calm finance" (2026-10-06). Light theme only; dark keeps every rule
         above. Look only -- the strip, the table, the dialogs and the print sheet behave and
         count exactly as before. The strip is the artboard's "Today's drawer" panel. ---- */
      body.rs-app.light.v2 .dcl-strip{border:1px solid #E2E8F0;border-radius:10px;padding:12px 16px;background:#FFFFFF}
      body.rs-app.light.v2 .dcl-strip .big{font-size:20px;font-weight:700}
      body.rs-app.light.v2 .dcl-strip .unit{font-size:13px;font-weight:500;color:#64748B}
      body.rs-app.light.v2 .dcl-strip .lbl{text-transform:none;letter-spacing:0;font-size:13px;font-weight:600;color:#475569}
      body.rs-app.light.v2 .dcl-strip .sub{font-size:13px;color:#64748B}
      body.rs-app.light.v2 .dcl-srow .who{font-size:13px;font-weight:600;color:#475569}
      body.rs-app.light.v2 .dcl-srow.mine .who{color:#14301F}
      body.rs-app.light.v2 .dcl-srow + .dcl-srow{border-top:1px solid #F1F5F9}
      body.rs-app.light.v2 .dcl-btn{border-radius:8px;border-color:#CBD5E1;font-size:13px;font-weight:600}
      body.rs-app.light.v2 .dcl-btn:hover{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-btn.pri{background:#14301F;border-color:#14301F;color:#FFFFFF}
      body.rs-app.light.v2 .dcl-btn.pri:hover{filter:none;background:#1E40AF}
      body.rs-app.light.v2 .dcl-btn.sm{font-size:12.5px;padding:5px 10px}
      body.rs-app.light.v2 .dcl-link{font-size:13.5px;font-weight:600;color:#2F6316}
      body.rs-app.light.v2 .dcl-link:hover{color:#14301F}
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
      body.rs-app.light.v2 .dcl-head h2{font-size:20px;font-weight:600;letter-spacing:-.2px;color:#14301F}
      body.rs-app.light.v2 .dcl-head p{font-size:14.5px;line-height:1.55;color:#475569;margin-top:6px}
      body.rs-app.light.v2 .dcl-kpis{gap:12px}
      body.rs-app.light.v2 .dcl-kpi{display:flex;flex-direction:column;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;background:#FFFFFF}
      body.rs-app.light.v2 .dcl-kpi span{order:-1;margin:0;text-transform:none;letter-spacing:0;font-size:13px;font-weight:500;color:#475569}
      body.rs-app.light.v2 .dcl-kpi b{font-size:24px;font-weight:700;letter-spacing:-.3px;margin-top:4px}
      body.rs-app.light.v2 .dcl-kpi small{font-size:12.5px;color:#64748B}
      body.rs-app.light.v2 .dcl-seg{background:transparent;border:0;padding:0;gap:6px}
      body.rs-app.light.v2 .dcl-seg button{border:1px solid #CBD5E1;background:#FFFFFF;color:#0F172A;border-radius:999px;font-size:13.5px;font-weight:600;padding:7px 14px;min-height:36px}
      body.rs-app.light.v2 .dcl-seg button:hover{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-seg button.on{background:#14301F;border-color:#14301F;color:#FFFFFF}
      body.rs-app.light.v2 .dcl-q{border-radius:999px;border-color:#E2E8F0;font-size:13.5px;padding:8px 14px;min-height:38px;box-sizing:border-box}
      body.rs-app.light.v2 .dcl-q:focus{outline:0;border-color:#3F7D20;box-shadow:0 0 0 3px rgba(63,125,32,.14)}
      body.rs-app.light.v2 .dcl-card{border-radius:10px;border-color:#E2E8F0}
      body.rs-app.light.v2 .dcl-tbl th{background:#F8FAFC;text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:600;color:#475569;border-bottom-color:#E2E8F0}
      body.rs-app.light.v2 .dcl-tbl td{border-top-color:#F1F5F9}
      body.rs-app.light.v2 .dcl-tbl tr.day td{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.day:hover td{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-tbl tr.open td{background:#F4FAE6}
      body.rs-app.light.v2 .dcl-tbl tr.ps td{background:#F8FAFC}
      body.rs-app.light.v2 .dcl-tbl tr.ps td.nm{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.fm td.nm{font-weight:600}
      body.rs-app.light.v2 .dcl-tbl tr.ln td{font-size:13px;color:#475569}
      body.rs-app.light.v2 .dcl-caret{color:#64748B}
      body.rs-app.light.v2 .dcl-pill{border-radius:6px;font-size:12px;font-weight:600;padding:2px 8px}
      body.rs-app.light.v2 .dcl-pill.rec{background:#FEF3C7;color:#92400E}
      body.rs-app.light.v2 .dcl-pill.lock{background:#F1F5F9;color:#475569}
      body.rs-app.light.v2 .dcl-pill.open,body.rs-app.light.v2 .dcl-pill.card{background:#F4FAE6;color:#2F6316}
      body.rs-app.light.v2 .dcl-meta{font-size:12.5px;font-weight:400;color:#64748B}
      body.rs-app.light.v2 .dcl-pos{color:#15803D} body.rs-app.light.v2 .dcl-neg{color:#B91C1C}
      body.rs-app.light.v2 .dcl-note{font-size:12.5px;color:#64748B;border-top-color:#E2E8F0}`;
    document.head.appendChild(st);
  }

  /* NOT CASH (2026-10-07, the Money Flow final build). Zelle, card and job-against-job entries
     don't move the drawer -- only cash does -- so their lines arrive with kind "Not cash", effect 0,
     and the `method` + `amount` they recorded. They are listed for information, never counted:
     `not_cash` = {total, in, out, n, lines} sits BESIDE `totals` on the open day and on every day.
     An older bridge sends none of it, and nothing changes. */
  function isNotCash(l) { return !!l && l.kind === "Not cash"; }
  function notCash(x) {
    var v = x && x.not_cash;
    if (!v) return null;
    var lines = Array.isArray(v) ? v : Array.isArray(v.lines) ? v.lines : [];
    var n = !Array.isArray(v) && v.n != null ? +v.n : lines.length;
    var tot = Array.isArray(v) ? lines.reduce(function (a, l) { return a + Math.abs(+l.amount || 0); }, 0) : Math.abs(+v.total || 0);
    if (!n && !lines.length && tot < 0.005) return null;
    return { total: tot, inn: Array.isArray(v) ? null : +v.in || 0, out: Array.isArray(v) ? null : +v.out || 0, n: n || lines.length, lines: lines };
  }
  function ncText(nc) {
    if (!nc) return "";
    if (nc.inn != null && nc.inn > 0.005 && nc.out > 0.005) return money(nc.inn) + " in · " + money(nc.out) + " paid out, not cash";
    return money(nc.total) + " not cash";
  }
  function ncLine(l) {
    if (l && l.src === "office") {           // an expense / income paid by card, Zelle or bank (2026-10-28)
      return esc(l.method || "Not cash") + " " + money2(Math.abs(+l.amount || 0)) + " · " + esc(l.office_kind === "income" ? "other income" : "expense")
        + " · " + esc(l.category || "") + (l.party ? " · " + esc(l.party) : "") + (l.note ? " — " + esc(l.note) : "");
    }
    return esc(l.method || "Not cash") + " " + money2(Math.abs(+l.amount || 0)) + " · " + esc(l.customer || l.job_code || "—")
      + (l.foreman ? " · " + esc(l.foreman) : "");
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
  /* THE PRINTED SHEET (redesigned 2026-10-09, his pick "As proposed"): the Zip to Zip logo band,
     the one number that matters in the dark box (what should be in the drawer), the foremen with
     their subtotals, then every movement grouped by foreman -- time, job, customer, what, drawer --
     and the sign-off. "Page X of Y" and the document's name print on every sheet (@page margin
     boxes), and the column headings repeat on each one. Built from the lines it is given: Not
     cash lines are listed apart, never counted. */
  function printSheet(w, day, lines, foreman, who) {
    if (!w) { alert("Your browser blocked the print window. Allow pop-ups for this site and try again."); return; }
    lines = (lines || []).filter(function (l) { return (!foreman || l.foreman === foreman) && (!who || person(l) === who); });
    var ncl = lines.filter(isNotCash);
    lines = lines.filter(function (l) { return !isNotCash(l); });
    // office cash (2026-10-28): no foreman -- its own tiles and its own section
    var offl = lines.filter(isOffice), ot = { inn: 0, out: 0 };
    lines = lines.filter(function (l) { return !isOffice(l); });
    offl.forEach(function (l) { if (l.office_kind === "income") ot.inn += +l.effect || 0; else ot.out += +l.effect || 0; });
    var t = { cash_in: 0, card_out: 0, fines: 0, adv: 0, net: 0 }, byFm = {}, jobsAll = {};
    lines.forEach(function (l) {
      var e = +l.effect || 0;
      if (l.kind === "Fine repaid") t.fines += e;
      else if (l.kind === "Advance given") t.adv += e;
      else if (e > 0) t.cash_in += e; else t.card_out += e;
      t.net += e;
      var f = byFm[l.foreman] || (byFm[l.foreman] = { lines: [], jobs: {}, cash: 0, card: 0, fines: 0, adv: 0, net: 0, by: {} });
      f.lines.push(l);
      if (l.kind !== "Fine repaid" && l.kind !== "Advance given") { f.jobs[l.job_code || l.event_id] = 1; jobsAll[l.job_code || l.event_id] = 1; }
      if (l.kind === "Fine repaid") f.fines += e; else if (l.kind === "Advance given") f.adv += e;
      else if (e > 0) f.cash += e; else f.card += e;
      f.net += e;
      f.by[short(person(l))] = 1;
    });
    var signed = day && day.kind === "signed", open = !day;
    // a period report (2026-10-28): day = {kind: "period", title, meta} -- several days on one sheet
    var period = !!day && day.kind === "period";
    var head = (who ? short(who) + " · " : "") + (foreman ? foreman : "");
    var title = period ? day.title : open ? "Open day" : fmtDay(day.date).replace(/^(\w+), /, function (m, d) { return { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" }[d] + ", "; });
    var people = {}; lines.concat(offl).forEach(function (l) { people[short(person(l))] = 1; });
    var meta = (period ? day.meta : open ? "Not closed yet · it closes by itself at 8:00 PM New York"
        : signed ? "Closed " + (day.automatic ? "automatically" : "by " + short(day.closed_by)) + " " + fmtAt(day.closed_at) + " · counted since " + fmtAt(day.since)
        : "Reconstructed from the records of that New York day · never signed")
      + (Object.keys(people).length ? " · recorded by " + Object.keys(people).sort().join(", ") : "");
    var kind = head ? "DAY CLOSING · " + head.toUpperCase() : "DAY CLOSING";
    var ref = period ? "Period report" : open ? "Printed while still open" : signed ? "Closing #" + day.id : "Reconstructed";
    var printed = new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    var foot = "Zip to Zip Moving · Day closing · " + (period ? day.title : open ? "open day" : fmtDay(day.date)) + (head ? " · " + head : "");
    var cssStr = function (v) { return '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n]+/g, " ") + '"'; };
    var logo = (function () { try { return new URL("logo-wide.png", document.baseURI).href; } catch (e) { return "logo-wide.png"; } })();
    // a sheet that spans several dates (the open day) says the date beside the time
    var dates = {}; lines.concat(ncl, offl).forEach(function (l) { dates[String(l.at || "").slice(0, 10)] = 1; });
    var multiDay = Object.keys(dates).length > 1;
    var when = function (l) {
      var s = String(l.at || "");
      if (!multiDay) return s.slice(11, 16);
      var d = new Date(s.slice(0, 10) + "T12:00:00");
      return (isNaN(d) ? s.slice(5, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric" })) + " " + s.slice(11, 16);
    };
    var amt = function (v) { return '<td class="r' + ((+v || 0) < -0.004 ? " neg" : "") + '">' + money2(+v || 0) + "</td>"; };
    var tile = function (l, v, s, neg) { return '<div class="t"><div class="l">' + l + '</div><div class="v' + (neg ? " neg" : "") + '">' + v + '</div><div class="s">' + s + "</div></div>"; };
    var tiles = [tile("Cash in", money2(t.cash_in), "brought by foremen"), tile("Paid out", money2(t.card_out), "cash handed to foremen", t.card_out < -0.004)];
    if (Math.abs(t.adv) > 0.004) tiles.push(tile("Advances given", money2(t.adv), "cash out, on their balances", true));
    tiles.push(tile("Debts repaid", money2(t.fines), "to their balances"));
    if (offl.length) {
      tiles.push(tile("Other income", money2(ot.inn), "cash in, not a job"));
      tiles.push(tile("Expenses", money2(ot.out), "cash paid by the office", ot.out < -0.004));
    }
    var order = Object.keys(byFm).sort(function (a, b) { return byFm[b].net - byFm[a].net; });
    var hero = '<section class="hero" style="grid-template-columns:1.25fr repeat(' + tiles.length + ',1fr)"><div class="big"><div class="l">'
      + (foreman ? "NET FROM THIS FOREMAN" : "SHOULD BE IN THE DRAWER") + '</div><div class="v">' + money2(t.net + ot.inn + ot.out) + '</div><div class="s">'
      + Object.keys(jobsAll).length + " job" + (Object.keys(jobsAll).length === 1 ? "" : "s") + (foreman ? "" : " · " + order.length + " foremen") + " · cash only</div></div>"
      + tiles.join("") + "</section>";
    var summary = foreman || order.length < 2 ? "" : '<h2>BY FOREMAN</h2><table><thead><tr><th>Foreman</th><th class="r">Jobs</th><th class="r">Cash in</th><th class="r">Paid out</th>'
      + (Math.abs(t.adv) > 0.004 ? '<th class="r">Advances</th>' : "") + (Math.abs(t.fines) > 0.004 ? '<th class="r">Debts repaid</th>' : "") + '<th class="r">In the drawer</th></tr></thead><tbody>'
      + order.map(function (n) {
          var f = byFm[n];
          return "<tr><td><b>" + esc(n) + '</b></td><td class="r">' + Object.keys(f.jobs).length + "</td>" + amt(f.cash) + amt(f.card)
            + (Math.abs(t.adv) > 0.004 ? amt(f.adv) : "") + (Math.abs(t.fines) > 0.004 ? amt(f.fines) : "") + '<td class="r"><b>' + money2(f.net) + "</b></td></tr>";
        }).join("")
      + '<tr class="tot"><td>All foremen</td><td class="r">' + Object.keys(jobsAll).length + "</td>" + amt(t.cash_in) + amt(t.card_out)
      + (Math.abs(t.adv) > 0.004 ? amt(t.adv) : "") + (Math.abs(t.fines) > 0.004 ? amt(t.fines) : "") + '<td class="r">' + money2(t.net) + "</td></tr></tbody></table>";
    var what = function (l) {
      if (l.kind === "Fine repaid") return "Debt repaid" + (l.note ? " — " + l.note : "");
      if (l.kind === "Advance given") return "Advance given to him" + (l.note ? " — " + l.note : "");
      return (l.kind === "Advance" ? "Advance · " : "") + (l.paid_from || (l.correction ? "correction: " + money2(l.prev) + " → " + money2(l.value) : ""));
    };
    var mv = '<h2>' + (foreman ? "EVERY MOVEMENT" : "EVERY MOVEMENT, BY FOREMAN") + '</h2><table><thead><tr><th style="width:' + (multiDay ? 70 : 44) + 'px">Time</th>'
      + '<th style="width:82px">Job</th><th>Customer</th><th>What</th><th class="r" style="width:72px">Drawer</th></tr></thead><tbody>'
      + (lines.length ? "" : '<tr><td colspan="5" class="mut">Nothing moved the drawer.</td></tr>')
      + order.map(function (n) {
          var f = byFm[n];
          var jobs = Object.keys(f.jobs).length;
          return (foreman ? "" : '<tr class="grp"><td colspan="4">' + esc(n) + ' <span class="mut">· ' + jobs + " job" + (jobs === 1 ? "" : "s")
              + " · recorded by " + esc(Object.keys(f.by).sort().join(", ")) + '</span></td><td class="r">' + money2(f.net) + "</td></tr>")
            + f.lines.slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).map(function (l) {
                return '<tr><td class="mut">' + esc(when(l)) + '</td><td class="code">' + esc(l.job_code || "—") + "</td><td>" + esc(l.customer || "—")
                  + '</td><td class="mut">' + esc(what(l)) + "</td>" + amt(l.effect) + "</tr>";
              }).join("");
        }).join("") + "</tbody></table>";
    var nc = ncl.length ? '<h2>NOT CASH · LISTED, NEVER IN THE DRAWER</h2><table><thead><tr><th style="width:' + (multiDay ? 70 : 44) + 'px">Time</th><th>Foreman</th>'
        + '<th style="width:82px">Job</th><th>Customer</th><th>How</th><th class="r" style="width:72px">Amount</th></tr></thead><tbody>'
        + ncl.map(function (l) {
            var off = isOffice(l);
            return '<tr><td class="mut">' + esc(when(l)) + "</td><td>" + esc(off ? "Office · " + short(person(l)) : l.foreman) + '</td><td class="code">' + esc(l.job_code || "—") + "</td><td>"
              + esc(off ? (l.category || "") + (l.note ? " — " + l.note : "") : (l.customer || "—")) + "</td><td>" + esc(l.method || "Not cash") + '</td><td class="r">' + money2(Math.abs(+l.amount || 0)) + "</td></tr>";
          }).join("") + "</tbody></table>" : "";
    var office = offl.length ? '<h2>OFFICE CASH · EXPENSES AND OTHER INCOME</h2><table><thead><tr><th style="width:' + (multiDay ? 70 : 44) + 'px">Time</th><th>Who</th>'
        + '<th>Category</th><th>Paid to / from</th><th>Reason</th><th class="r" style="width:72px">Drawer</th></tr></thead><tbody>'
        + offl.slice().sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).map(function (l) {
            return '<tr><td class="mut">' + esc(when(l)) + "</td><td>" + esc(short(person(l))) + "</td><td>" + esc(l.category || "") + "</td><td>" + esc(l.party || "—")
              + '</td><td class="mut">' + esc((l.note || "") + (l.withdrawn ? " (withdrawn)" : l.correction ? " (correction " + money2(l.prev) + " → " + money2(l.value) + ")" : "")) + "</td>" + amt(l.effect) + "</tr>";
          }).join("")
        + '<tr class="tot"><td colspan="5">Other income ' + money2(ot.inn) + " · expenses " + money2(ot.out) + '</td><td class="r">' + money2(ot.inn + ot.out) + "</td></tr></tbody></table>" : "";
    var sig = signed && !day.automatic
      ? [["Counted by", day.counted_by || ""], ["Closed by", short(day.closed_by)], ["Cash handed to", day.handed_to || ""]]
      : [["Counted by", ""], ["Checked by", ""], ["Cash handed to", ""]];
    var css = "@page{size:A4 portrait;margin:13mm 12mm 15mm;"
      + "@bottom-left{content:" + cssStr(foot) + ";font:500 8px 'Segoe UI',Arial,sans-serif;color:#64748B}"
      + "@bottom-right{content:\"Page \" counter(page) \" of \" counter(pages);font:600 8px 'Segoe UI',Arial,sans-serif;color:#475569}}"
      + "*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}"
      + "body{margin:0;font:10px/1.42 'Segoe UI','IBM Plex Sans',Arial,sans-serif;color:#0F172A;font-variant-numeric:tabular-nums}"
      + ".dh{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding-bottom:10px;border-bottom:2.5px solid #14301F;margin-bottom:12px}"
      + ".dh .brand{background:#9BBB3B;border-radius:6px;padding:7px 10px}.dh .brand img{height:22px;display:block}"
      + ".dh .kind{font-size:8.5px;font-weight:700;letter-spacing:.14em;color:#3F7D20}.dh h1{margin:1px 0 2px;font-size:19px;line-height:1.15}"
      + ".dh .meta{color:#475569;font-size:9.5px}.dh .ref{text-align:right;color:#64748B;font-size:8.5px;line-height:1.5}"
      + ".hero{display:grid;gap:8px;margin:0 0 14px;break-inside:avoid}"
      + ".hero .big{background:#14301F;color:#fff;border-radius:8px;padding:10px 13px}.hero .big .l{font-size:8.5px;letter-spacing:.1em;font-weight:700;color:#B7E23B}"
      + ".hero .big .v{font-size:25px;font-weight:700;line-height:1.15;margin-top:2px}.hero .big .s{font-size:8.5px;color:#D7E5C8;margin-top:2px}"
      + ".hero .t{border:1px solid #E2E8F0;border-radius:8px;padding:9px 11px}.hero .t .l{font-size:8.5px;color:#475569;font-weight:600}"
      + ".hero .t .v{font-size:16px;font-weight:700;margin-top:3px}.hero .t .s{font-size:8px;color:#64748B;margin-top:1px}"
      + "h2{font-size:9px;letter-spacing:.12em;color:#3F7D20;margin:14px 0 5px;font-weight:800;break-after:avoid}"
      + "table{width:100%;border-collapse:collapse;margin-bottom:4px}thead{display:table-header-group}"
      + "th{text-align:left;font-size:8px;font-weight:700;color:#475569;letter-spacing:.03em;text-transform:uppercase;padding:5px 6px;border-bottom:1.5px solid #0F172A}"
      + "td{padding:4px 6px;border-bottom:1px solid #EEF1F4;vertical-align:top}tr{break-inside:avoid}"
      + ".r{text-align:right;white-space:nowrap}.neg{color:#B91C1C}.mut{color:#64748B}.code{font-family:Consolas,'Courier New',monospace;font-size:9px}"
      + "tr.grp td{background:#F4FAE6;border-bottom:1px solid #DCEFB0;padding-top:6px;font-weight:700}tr.grp td .mut{font-weight:500}"
      + "tr.tot td{border-top:1.5px solid #0F172A;border-bottom:0;font-weight:800;font-size:10.5px;padding-top:6px}"
      + ".sign{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:26px;break-inside:avoid}"
      + ".sign div{border-top:1px solid #0F172A;padding-top:4px;font-size:8.5px;color:#475569}.sign div b{display:block;color:#0F172A;font-size:9px}"
      + ".sign div span{display:block;margin-top:16px;border-top:1px dotted #94A3B8;padding-top:3px}";
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc((head ? head + " · " : "") + (period ? day.title : open ? "Open day" : "Day closing " + day.date))
      + "</title><style>" + css + "</style></head><body>"
      + '<header class="dh"><div class="brand"><img alt="Zip to Zip Moving" src="' + esc(logo) + '"></div>'
      + '<div><div class="kind">' + esc(kind) + "</div><h1>" + esc(title) + '</h1><div class="meta">' + esc(meta) + "</div></div>"
      + '<div class="ref">Printed ' + esc(printed) + "<br>" + esc(ref) + "</div></header>"
      + hero + summary + mv + office + nc
      + '<section class="sign">' + sig.map(function (x) { return "<div><b>" + esc(x[0]) + "</b>" + (esc(x[1]) || "name") + "<span>signature · date</span></div>"; }).join("") + "</section>"
      + "<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>");
    w.document.close();
  }

  // ---- OFFICE CASH (2026-10-28): expenses and other income -------------------------------
  /* The old Day Closing System's Expense Accounting and Other Revenue forms, in the portal (plan
     docs/plans/2026-10-27-day-closing-expense-accounting.md; his answers: both, recorded from
     the strip, kept in the drawer of whoever records it, a category list managers can extend).
     Data: /api/_oc (bridge/office_cash.py). Only cash moves the drawer; a correction or a
     withdrawal moves it by the difference, in the day it is made. */
  async function oc(qs, body) {
    var opt = { headers: { "Authorization": "Bearer " + ZTZ.getToken() } };
    if (body) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    var r = await fetch(ZTZ.API + "/api/_oc" + (qs || ""), opt);
    var j = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; e.body = j; throw e; }
    return j;
  }
  var OCMETA = { at: 0, d: null };
  async function ocMeta(force) {
    if (!force && OCMETA.d && Date.now() - OCMETA.at < 300000) return OCMETA.d;
    OCMETA.d = await oc(""); OCMETA.at = Date.now();
    return OCMETA.d;
  }
  // a save anywhere (strip, list, a day) tells every mounted view to re-read
  function ocChanged() {
    OCMETA.at = 0;
    try { window.dispatchEvent(new Event("zdc-changed")); } catch (e) { /* old browser: the 20 s poll catches up */ }
  }
  function isOffice(l) { return !!l && l.src === "office"; }
  function signedCash(kind, method, amount) { return method && method !== "Cash" ? 0 : (kind === "income" ? 1 : -1) * (+amount || 0); }
  function closeModal(back) { if (back && back.parentNode) back.parentNode.removeChild(back); document.removeEventListener("keydown", back && back.__esc); }
  function modal(html) {
    css();
    var back = document.createElement("div");
    back.className = "dcl-back";
    back.innerHTML = html;
    back.addEventListener("mousedown", function (e) { if (e.target === back) closeModal(back); });
    back.__esc = function (e) { if (e.key === "Escape") closeModal(back); };
    document.addEventListener("keydown", back.__esc);
    document.body.appendChild(back);
    return back;
  }
  /* The dialog. opt: {kind, mine (this person's drawer now, or null), line (a current /api/_oc
     line to correct), onSaved}. */
  async function openOffice(opt) {
    opt = opt || {};
    var fix = opt.line || null;
    var st = { kind: fix ? fix.kind : (opt.kind === "income" ? "income" : "expense"), cat: fix ? fix.category : "", confirm: false };
    var back = modal('<div class="dcl-modal dcl-ocm" role="dialog" aria-modal="true"><div class="dcl-load" style="padding:20px">Loading…</div></div>');
    var meta;
    try { meta = await ocMeta(); }
    catch (e) { back.querySelector(".dcl-modal").innerHTML = '<div class="dcl-err">' + esc(e.message) + '</div><div class="dcl-act"><button class="dcl-btn" data-x>Close</button></div>'; back.querySelector("[data-x]").onclick = function () { closeModal(back); }; return; }
    if (meta.ready === false) {
      back.querySelector(".dcl-modal").innerHTML = '<h3>Not ready yet</h3><p>Expenses can be recorded once the next data refresh has created their table (within the hour).</p><div class="dcl-act"><button class="dcl-btn" data-x>Close</button></div>';
      back.querySelector("[data-x]").onclick = function () { closeModal(back); }; return;
    }
    var m = back.querySelector(".dcl-modal");
    function cats() { return (meta.categories || []).filter(function (c) { return c.kind === st.kind && (c.is_on || (fix && c.name === fix.category)); }); }
    function draw() {
      var inc = st.kind === "income";
      if (!cats().some(function (c) { return c.name === st.cat; })) st.cat = "";
      m.innerHTML = "<h3>" + (fix ? (inc ? "Correct other income" : "Correct an expense") : (inc ? "Record other income" : "Record an expense")) + "</h3>"
        + "<p>" + (inc ? "Cash that came into the drawer and isn’t a job: a payroll check cashed back, money brought in, a carrier payment."
                       : "Money the drawer paid that isn’t a job: salaries, the Tbilisi office, a towing bill, cleaning. Only cash changes the drawer.")
        + (fix ? " The drawer moves by the difference, today." : "") + "</p>"
        + (fix ? "" : '<div class="dcl-octog"><button data-k="expense" class="' + (inc ? "" : "on") + '">Expense</button><button data-k="income" class="' + (inc ? "on" : "") + '">Other income</button></div>')
        + '<div class="dcl-f"><label>Amount<input id="ocAmt" inputmode="decimal" autocomplete="off" placeholder="0.00"></label>'
        + "<label>How<select id=\"ocHow\">" + (meta.methods || ["Cash"]).map(function (x) { return '<option value="' + esc(x) + '">' + esc(x === "Cash" ? (inc ? "Cash (into my drawer)" : "Cash (from my drawer)") : x) + "</option>"; }).join("") + "</select></label></div>"
        + '<div class="dcl-oclbl">Category</div><div class="dcl-chips">' + cats().map(function (c) {
            return '<button type="button" class="dcl-chip' + (c.name === st.cat ? " on" : "") + '" data-cat="' + esc(c.name) + '">' + esc(c.name) + (c.is_cost ? "" : "<small>not a cost</small>") + "</button>";
          }).join("") + "</div>"
        + '<div class="dcl-f"><label>' + (inc ? "Received from" : "Paid to") + '<input id="ocParty" list="ocParties" autocomplete="off" maxlength="160"></label>'
        + '<label>Job (optional)<input id="ocJob" autocomplete="off" placeholder="LM12-2877" maxlength="64"></label></div>'
        + '<datalist id="ocParties">' + (meta.parties || []).map(function (p) { return '<option value="' + esc(p) + '">'; }).join("") + "</datalist>"
        + '<div class="dcl-f one"><label>Reason<input id="ocNote" autocomplete="off" maxlength="500" placeholder="' + (inc ? "Zaza check, September" : "#27 towing charges") + '"></label></div>'
        + '<div class="dcl-ocafter" id="ocAfter"></div><div id="ocMsg"></div>'
        + '<div class="dcl-act"><button class="dcl-btn" id="ocCancel">Cancel</button><button class="dcl-btn pri" id="ocSave">' + (fix ? "Save the correction" : inc ? "Save other income" : "Save expense") + "</button></div>";
      var q = function (s) { return m.querySelector(s); };
      if (fix) {
        q("#ocAmt").value = fix.amount; q("#ocHow").value = fix.method || "Cash";
        q("#ocParty").value = fix.party || ""; q("#ocJob").value = fix.job_code || ""; q("#ocNote").value = fix.note || "";
      } else if (st.vals) {
        q("#ocAmt").value = st.vals.a; q("#ocHow").value = st.vals.h; q("#ocParty").value = st.vals.p; q("#ocJob").value = st.vals.j; q("#ocNote").value = st.vals.n;
      }
      function vals() { return { a: q("#ocAmt").value, h: q("#ocHow").value, p: q("#ocParty").value, j: q("#ocJob").value, n: q("#ocNote").value }; }
      function after() {
        var amt = parseFloat(String(q("#ocAmt").value).replace(/[$,\s]/g, "")), how = q("#ocHow").value, el = q("#ocAfter");
        if (!(amt > 0)) { el.innerHTML = ""; return; }
        if (how !== "Cash") { el.textContent = how + " — listed with the day, the drawer doesn’t change."; return; }
        if (fix) {
          var d = signedCash(st.kind, how, amt) - signedCash(fix.kind, fix.method, fix.amount);
          el.innerHTML = Math.abs(d) < 0.005 ? "The drawer doesn’t change." : "Moves the drawer by <b>" + (d > 0 ? "+" : "") + money2(d) + "</b> today."; return;
        }
        if (opt.mine == null) { el.innerHTML = (st.kind === "income" ? "Adds <b>" : "Takes <b>") + money2(amt) + "</b> " + (st.kind === "income" ? "to" : "from") + " your drawer."; return; }
        el.innerHTML = "Your drawer after this: <b>" + money2(opt.mine + signedCash(st.kind, how, amt)) + "</b>";
      }
      ["#ocAmt", "#ocHow"].forEach(function (s) { q(s).addEventListener("input", after); q(s).addEventListener("change", after); });
      after();
      m.querySelectorAll("[data-k]").forEach(function (b) { b.onclick = function () { st.vals = vals(); st.kind = b.getAttribute("data-k"); st.cat = ""; st.confirm = false; draw(); }; });
      m.querySelectorAll("[data-cat]").forEach(function (b) {
        b.onclick = function () { st.cat = b.getAttribute("data-cat"); m.querySelectorAll("[data-cat]").forEach(function (x) { x.classList.toggle("on", x === b); }); };
      });
      q("#ocCancel").onclick = function () { closeModal(back); };
      q("#ocSave").onclick = async function () {
        var btn = q("#ocSave"), msg = q("#ocMsg");
        var amt = String(q("#ocAmt").value).replace(/[$,\s]/g, "");
        if (!(parseFloat(amt) > 0)) { msg.innerHTML = '<div class="dcl-err">Type the amount.</div>'; q("#ocAmt").focus(); return; }
        if (!st.cat) { msg.innerHTML = '<div class="dcl-err">Pick a category.</div>'; return; }
        if (!q("#ocNote").value.trim()) { msg.innerHTML = '<div class="dcl-err">Write the reason.</div>'; q("#ocNote").focus(); return; }
        var body = { action: fix ? "fix" : "add", id: fix ? fix.id : undefined, kind: st.kind, amount: amt, method: q("#ocHow").value,
                     category: st.cat, party: q("#ocParty").value, job_code: q("#ocJob").value, note: q("#ocNote").value, confirm: st.confirm };
        btn.disabled = true; msg.innerHTML = "";
        try {
          await oc("", body);
          closeModal(back); ocChanged();
          if (opt.onSaved) opt.onSaved();
        } catch (e) {
          btn.disabled = false;
          if (e.status === 409 && e.body && e.body.confirm) {
            st.confirm = true;
            msg.innerHTML = '<div class="dcl-warn">' + esc(e.message) + "</div>";
            btn.textContent = "Record it anyway";
          } else msg.innerHTML = '<div class="dcl-err">' + esc(e.message) + "</div>";
        }
      };
      setTimeout(function () { var a = q("#ocAmt"); if (a && !fix) a.focus(); }, 30);
    }
    draw();
  }
  function withdrawOffice(line, onSaved) {
    var back = modal('<div class="dcl-modal" role="dialog" aria-modal="true"><h3>Withdraw this ' + (line.kind === "income" ? "income" : "expense") + "?</h3>"
      + "<p>" + esc(line.category) + " · " + money2(line.amount) + " · " + esc(line.note || "") + ". "
      + (line.method && line.method !== "Cash" ? "It was not cash, so the drawer doesn’t change."
         : line.kind === "income" ? "The " + money2(line.amount) + " comes out of the drawer today." : "The " + money2(line.amount) + " goes back into the drawer today.") + "</p>"
      + '<div class="dcl-f one"><label>Why<input id="ocWhy" autocomplete="off" maxlength="300" placeholder="recorded twice"></label></div><div id="ocMsg"></div>'
      + '<div class="dcl-act"><button class="dcl-btn" id="ocCancel">Cancel</button><button class="dcl-btn pri" id="ocGo">Withdraw</button></div></div>');
    var q = function (s) { return back.querySelector(s); };
    q("#ocCancel").onclick = function () { closeModal(back); };
    setTimeout(function () { q("#ocWhy").focus(); }, 30);
    q("#ocGo").onclick = async function () {
      if (!q("#ocWhy").value.trim()) { q("#ocMsg").innerHTML = '<div class="dcl-err">Say why.</div>'; return; }
      q("#ocGo").disabled = true;
      try { await oc("", { action: "withdraw", id: line.id, note: q("#ocWhy").value }); closeModal(back); ocChanged(); if (onSaved) onSaved(); }
      catch (e) { q("#ocGo").disabled = false; q("#ocMsg").innerHTML = '<div class="dcl-err">' + esc(e.message) + "</div>"; }
    };
  }

  // ---- the strip on top of Money Flow (and of Day Closing) -------------------------------
  // His rule (2026-09-28): someone who recorded anything today sees HIS total first and the
  // total of everyone on the next line; someone who recorded nothing sees just the total.
  function stripRow(label, t, mine, nc) {
    return '<div class="dcl-srow' + (mine ? " mine" : "") + '"><div class="who">' + esc(label) + "</div>"
      + '<div><span class="big">' + money(t.net) + '</span> <span class="unit">in the drawer</span></div>'
      + '<div class="sub">' + money(t.cash_in) + " cash in · " + money(t.card_out) + " paid out"
      + (t.advances ? " · " + money(t.advances) + " advances given" : "")
      // office cash (2026-10-28): an older bridge sends neither key
      + (t.other_in ? " · " + money(t.other_in) + " other income" : "")
      + (t.expenses ? " · " + money(t.expenses) + " expenses" : "")
      + (nc ? ' · <span title="Zelle, card and job-against-job entries: listed, never in the drawer">' + esc(ncText(nc)) + "</span>" : "") + "</div>"
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
      // office cash (2026-10-28, his pick: recorded from the strip)
      + '<span class="dcl-ocbtns"><button class="dcl-btn sm" data-ocnew="expense">− Expense</button><button class="dcl-btn sm" data-ocnew="income">+ Other income</button></span>'
      // Day Closing is a TAB of Money Flow since 2026-10-08: the link names that tab
      + (withLink ? '<a class="dcl-link" id="dclGoPage" href="#page=money-flow&amp;tab=day-closing">Day Closing ›</a>' : "") + "</div>"
      + (mine ? stripRow("Your total · " + short(me), mine, true) : "")
      + stripRow(mine ? "Everyone" : "Total", t, false, notCash(o));
  }
  /* The strip polls the open day every 20 s. ONE timer per element: a re-mount clears the old
     one, and a detached element stops its own. Since Day Closing became a tab of Money Flow
     (2026-10-08) the strip can sit on a HIDDEN tab: it then skips the fetch and remembers it
     missed one, and wakeStrip() catches up the moment its tab shows again. Each mount bumps
     el.__gen, so a slow answer to an older mount never paints over a newer one.
     opt.onGo: what the "Day Closing ›" link does (Money Flow opens its tab in place). */
  function mountStrip(el, opt) {
    if (!el) return;
    if (opt) el.__opt = opt;
    css();
    el.className = "dcl-strip"; el.innerHTML = '<span class="sub">Loading the open day…</span>';
    var d, gen = (el.__gen = (el.__gen || 0) + 1);
    async function load() {
      if (!document.body.contains(el)) { clearInterval(el.__t); return; }
      if (el.closest("[hidden]")) { el.__missed = true; return; }
      el.__missed = false;
      try { d = await api("?open=1"); }
      catch (e) {
        if (gen !== el.__gen) return;
        el.innerHTML = '<span class="sub">Day Closing unavailable — ' + esc(e.message) + "</span>"; return;
      }
      if (gen !== el.__gen) return;
      if (!d.cutover) { el.style.display = "none"; return; }
      el.style.display = "";
      el.innerHTML = stripHtml(d, true);
      wireOcButtons(el, d, load);
      tickCountdowns();
      var go = el.querySelector("#dclGoPage");
      if (go) go.onclick = function (e) {
        var o = el.__opt || {};
        if (o.onGo) { e.preventDefault(); o.onGo(); }
      };
    }
    clearInterval(el.__t);
    el.__load = load;
    el.__t = setInterval(load, 20000);
    // an expense saved anywhere shows at once (one listener per element, gone with it)
    if (!el.__ocL) {
      el.__ocL = function () { if (!document.body.contains(el)) { window.removeEventListener("zdc-changed", el.__ocL); return; } if (el.__load) el.__load(); };
      window.addEventListener("zdc-changed", el.__ocL);
    }
    load();
  }
  // the strip's "− Expense / + Other income": the dialog knows this person's drawer right now
  function wireOcButtons(root, d, reload) {
    var me = String((d && d.me && d.me.email) || "").toLowerCase();
    var mine = ((d && d.open && d.open.people) || []).filter(function (p) { return p.person === me; })[0];
    root.querySelectorAll("[data-ocnew]").forEach(function (b) {
      b.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        openOffice({ kind: b.getAttribute("data-ocnew"), mine: mine ? mine.net : 0, onSaved: reload });
      };
    });
  }
  // the strip's tab is showing again: fetch now if a refresh was skipped while it was hidden
  function wakeStrip(el) {
    if (el && el.__missed && el.__load) el.__load();
  }

  window.ZDC = { api: api, css: css, printSheet: printSheet, mountStrip: mountStrip, wakeStrip: wakeStrip, stripHtml: stripHtml,
                 person: person, money: money, money2: money2, fmtDay: fmtDay, fmtAt: fmtAt, outcome: outcome,
                 short: short, esc: esc, isNotCash: isNotCash, notCash: notCash, ncText: ncText, ncLine: ncLine,
                 // office cash (2026-10-28)
                 oc: oc, ocMeta: ocMeta, openOffice: openOffice, withdrawOffice: withdrawOffice, wireOcButtons: wireOcButtons,
                 isOffice: isOffice };
})();

/* DAY CLOSING IS A TAB OF MONEY FLOW (his ask, 2026-10-08). This registration stays: Money Flow
   finds it in window.PAGES and calls render(pane, { embedded: true }) in its Day Closing tab, and
   the shell forwards an old #page=day-closing link there (REDIRECTS + TAB_HOSTED in index.html,
   which also keep it out of the sidebar). Embedded, the heading steps down to an h2 under Money
   Flow's h1; opt.fresh re-reads the days the way Refresh does (Money Flow passes it after one of
   its saves moved the drawer). Every query is scoped to `host`, and a GENERATION GUARD (window.__DCLGEN) lets only
   the newest mount paint: a slow load from an earlier mount -- the page left and opened again --
   bails instead of drawing stale days. The page keeps no timer of its own; the countdowns tick
   from the one shared interval above (window.__dclTick). */
registerPage({
  id: "day-closing",
  group: "logistics",
  title: "Day Closing",
  async render(host, opt) {
    opt = opt || {};
    var Z = window.ZDC, esc = Z.esc, money = Z.money, money2 = Z.money2;
    Z.css();
    var gen = (window.__DCLGEN = (window.__DCLGEN || 0) + 1);
    var mine = function () { return gen === window.__DCLGEN; };
    var H = opt.embedded ? "h2" : "h1";
    host.innerHTML = '<div class="dcl-head"><div><' + H + ">Day Closing</" + H + ">"
      + "<p>The office drawer, closed once a day. Dispatch confirms each job in Money Flow; every day at 8:00 PM New York the day closes by itself and seals what came in and went out before 8 PM (a day with no record doesn't close). "
      + "Click a day to see who confirmed what, a person to see their foremen, a foreman to see every movement. Days before the first closing are rebuilt from the records and marked so.</p></div>"
      + '<div><button class="dcl-btn" id="dclRefresh">↻ Refresh</button></div></div><div id="dclBody"><div class="dcl-load">Loading days…</div></div>';
    var $b = function () { return host.querySelector("#dclBody"); };
    var S = window.__DCL || (window.__DCL = { view: "all", q: "", open: {}, popen: {}, fopen: {}, lines: {}, shown: 30 });
    if (!S.popen) S.popen = {};
    if (!S.oopen) S.oopen = {};
    // the Expenses & income list (2026-10-28): its month and filters survive a re-mount
    var OC = S.oc || (S.oc = { month: "", kind: "all", cat: "", who: "", q: "", cats: false });
    var ocData = null, ocErr = "";
    async function loadOc() {
      try { var r = await Z.oc(OC.month ? "?month=" + encodeURIComponent(OC.month) : ""); if (mine()) { ocData = r; OC.month = r.month; ocErr = ""; } }
      catch (e) { if (mine()) ocErr = e.message; }
    }
    // THE PERIOD REPORT (2026-10-28): Gvantsa's "Reporting - Day Closing System" sheet -- pick a
    // start and an end date, get the old report for that period. Jobs by the job's date (the old
    // sheet's way) or by the day the cash moved (Day Closing's way).
    var isoDay = function (d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); };
    if (!S.rp) { var n0 = new Date(); S.rp = { from: isoDay(new Date(n0.getFullYear(), n0.getMonth(), 1)), to: isoDay(n0), basis: "job" }; }
    var RP = S.rp, rpData = null, rpErr = "", rpBusy = false;
    async function loadRp() {
      rpBusy = true; rpErr = "";
      try { var r = await Z.api("?report=" + encodeURIComponent(RP.from + ".." + RP.to) + "&basis=" + RP.basis); if (mine()) rpData = r; }
      catch (e) { if (mine()) { rpErr = e.message; rpData = null; } }
      rpBusy = false;
    }
    // a save anywhere (the strip on another tab included) re-reads the days and the list
    if (window.__dclOcL) window.removeEventListener("zdc-changed", window.__dclOcL);
    window.__dclOcL = async function () {
      if (!mine()) { window.removeEventListener("zdc-changed", window.__dclOcL); return; }
      S.lines = {};
      try { await load(true); if (S.view === "office" || ocData) await loadOc(); if (S.view === "report") await loadRp(); } catch (e) { /* keep the last view */ }
      paint();
    };
    window.addEventListener("zdc-changed", window.__dclOcL);
    var data;
    async function load(force) {
      var d = await Z.api(force ? "?fresh=1" : "");
      if (mine()) data = d;
    }
    // opt.fresh (Money Flow saved something since this tab was last drawn): what Refresh does
    if (opt.fresh) S.lines = {};
    try { await load(!!opt.fresh); }
    catch (e) { var b0 = $b(); if (b0 && mine()) b0.innerHTML = '<div class="dcl-load">Couldn’t load — ' + esc(e.message) + "</div>"; return; }
    if (!mine()) return;

    async function linesOf(key) {
      if (!S.lines[key]) S.lines[key] = (await Z.api("?lines=" + encodeURIComponent(key))).lines || [];
      return S.lines[key];
    }
    function netCls(v) { return v > 0.5 ? "dcl-pos" : v < -0.5 ? "dcl-neg" : ""; }

    // the day's Not cash lines, under its people: informational, never in a total
    // office cash (2026-10-28): two columns between Paid out and In the drawer
    function ocCells(t) {
      return '<td class="r">' + (t.other_in ? money(t.other_in) : '<span class="dcl-meta" style="margin:0">—</span>') + '</td><td class="r">'
        + (t.expenses ? money(t.expenses) : '<span class="dcl-meta" style="margin:0">—</span>') + "</td>";
    }
    function ncRows(d) {
      var nc = Z.notCash(d);
      if (!nc) return "";
      return '<tr class="ln dcl-ncrow"><td colspan="10" class="first"><span class="dcl-pill dcl-nc">not cash</span>'
        + "<b>" + esc(nc.inn != null && nc.inn > 0.005 && nc.out > 0.005 ? money(nc.inn) + " in · " + money(nc.out) + " paid out" : money(nc.total)) + "</b> — doesn’t touch the drawer"
        + (nc.lines.length ? '<div class="dcl-nclist">' + nc.lines.map(Z.ncLine).join("<br>") + "</div>" : "") + "</td></tr>";
    }
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
        + '</td><td class="r">' + money(t.card_out) + "</td>" + ocCells(t) + '<td class="r ' + netCls(t.net) + '">' + money(t.net) + '</td><td class="r">' + acts + "</td></tr>";
      if (!open) return row;
      // an older bridge sends no people: show the foremen straight under the day, as before
      if (!d.people) return row + (d.foremen || []).map(function (f) { return fmRow(d, null, f); }).join("") + ncRows(d);
      var people = d.people;
      return row + people.map(function (p) { return psRow(d, p); }).join("")
        + (people.length ? "" : '<tr><td colspan="10" style="color:var(--faint);padding-left:34px">Nothing moved the drawer.</td></tr>')
        + ncRows(d);
    }
    // the person who recorded the movements in Money Flow (Irakli, Kakha…) — his layout, 2026-09-28
    function psRow(d, p) {
      var pk = d.key + "|" + p.person, open = !!S.popen[pk];
      var row = '<tr class="ps" data-pk="' + esc(pk) + '"><td class="nm"><span class="dcl-caret">' + (open ? "−" : "+") + "</span>" + esc(Z.short(p.person))
        + '<span class="dcl-meta">confirmed ' + p.n_jobs + " job" + (p.n_jobs === 1 ? "" : "s") + '</span></td><td></td><td class="r">' + p.n_jobs
        + '</td><td class="r">' + p.n_foremen + '</td><td class="r">' + money(p.cash_in) + '</td><td class="r">' + money(p.card_out) + "</td>" + ocCells(p) + '<td class="r ' + netCls(p.net) + '">'
        + money(p.net) + '</td><td class="r"><button class="dcl-btn sm" data-ppdf="' + esc(pk) + '">PDF</button></td></tr>';
      if (!open) return row;
      return row + (p.foremen || []).map(function (f) { return fmRow(d, p, f); }).join("") + (p.n_office ? ocRow(d, p) : "");
    }
    // the person's office cash: expenses and other income they recorded (2026-10-28)
    function ocRow(d, p) {
      var ok = d.key + "|" + p.person, open = !!S.oopen[ok];
      var v = (p.other_in || 0) + (p.expenses || 0);
      var row = '<tr class="oc" data-ok="' + esc(ok) + '"><td class="nm"><span class="dcl-caret">' + (open ? "−" : "+") + "</span>Office"
        + '<span class="dcl-meta">' + p.n_office + " expense / income line" + (p.n_office === 1 ? "" : "s") + '</span></td><td colspan="5"></td>'
        + ocCells(p) + '<td class="r ' + netCls(v) + '">' + money(v) + "</td><td></td></tr>";
      if (!open) return row;
      var ls = S.lines[d.key];
      if (!ls) return row + '<tr class="ocl"><td colspan="10" class="first">Loading…</td></tr>';
      return row + ls.filter(function (l) { return Z.isOffice(l) && !Z.isNotCash(l) && Z.person(l) === p.person; })
        .sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); }).map(function (l) { return ocLineRow(d, l); }).join("");
    }
    function ocLineRow(d, l) {
      var me = String(data.me.email || "").toLowerCase();
      var mine = Z.person(l) === me || String(l.recorded_by || "").toLowerCase() === me;
      var acts = "";
      if (d.kind === "open" && l.current !== false && !l.withdrawn && (mine || data.me.manager)) {
        acts = '<button class="dcl-btn sm" data-ocfix="' + esc(l.src_id) + '">Edit</button> <button class="dcl-btn sm" data-ocwd="' + esc(l.src_id) + '">Withdraw</button>';
      } else if (d.kind === "signed" && data.me.manager && d.status !== "locked" && l.source !== "form") {
        acts = '<button class="dcl-btn sm" data-take="' + esc(d.id + "|office|" + l.src_id) + '">Take out</button>';
      }
      var what = '<span class="dcl-pill ' + (l.office_kind === "income" ? "inc" : "exp") + '" style="margin:0 6px 0 0">' + (l.office_kind === "income" ? "income" : "expense") + "</span>"
        + esc(l.note || "") + (l.withdrawn ? ' <span class="dcl-meta">withdrawn</span>' : l.correction ? ' <span class="dcl-meta">correction ' + esc(money2(l.prev)) + " → " + esc(money2(l.value)) + "</span>" : "")
        + (l.job_code ? ' <span class="dcl-meta">' + esc(l.job_code) + "</span>" : "") + (l.source === "form" ? ' <span class="dcl-meta">old form</span>' : "");
      return '<tr class="ocl"><td class="first" title="' + esc(l.party || "") + '">' + esc(l.category || "—") + (l.party ? " · " + esc(l.party) : "")
        + "</td><td>" + esc(Z.fmtAt(l.at)) + ' <span class="dcl-meta">' + esc(Z.short(l.recorded_by || l.by)) + '</span></td><td colspan="5">' + what
        + '</td><td></td><td class="r ' + netCls(l.effect) + '">' + money2(l.effect) + '</td><td class="r">' + acts + "</td></tr>";
    }
    // a day line -> the shape the dialog corrects (the line IS the current row in the open day)
    function lineAsEntry(l) {
      return { id: +l.src_id, kind: l.office_kind, amount: Math.abs(+(l.method ? l.amount : l.value) || 0), method: l.method || "Cash",
               category: l.category, party: l.party, job_code: l.job_code, note: l.note };
    }
    function fmRow(d, p, f) {
      var fk = d.key + "|" + (p ? p.person : "") + "|" + f.foreman, open = !!S.fopen[fk];
      var row = '<tr class="fm" data-fk="' + esc(fk) + '"><td class="nm"><span class="dcl-caret">' + (open ? "−" : "+") + "</span>" + esc(f.foreman)
        + '<span class="dcl-meta">' + esc(Z.outcome(f)) + (f.advances ? " · advance given " + money(-f.advances) : "") + (f.fines ? " · debt repaid " + money(f.fines) : "") + '</span></td><td></td><td class="r">' + f.n_jobs
        + '</td><td></td><td class="r">' + money(f.cash_in) + '</td><td class="r">' + money(f.card_out) + '</td><td></td><td></td><td class="r ' + netCls(f.net) + '">'
        + money(f.net) + '</td><td class="r"><button class="dcl-btn sm" data-fpdf="' + esc(fk) + '">PDF</button></td></tr>';
      if (!open) return row;
      var ls = S.lines[d.key];
      if (!ls) return row + '<tr class="ln"><td colspan="10" class="first">Loading…</td></tr>';
      return row + ls.filter(function (l) { return !Z.isNotCash(l) && l.foreman === f.foreman && (!p || Z.person(l) === p.person); }).map(function (l) { return lineRow(d, l); }).join("");
    }
    function lineRow(d, l) {
      var what = l.kind === "Fine repaid" ? "Debt repaid" + (l.note ? " — " + esc(l.note) : "")
        : l.kind === "Advance given" ? "Advance given to him" + (l.note ? " — " + esc(l.note) : "")
        : (l.kind === "Advance" ? '<span class="dcl-pill card" style="margin:0 6px 0 0">advance</span>' : "")
          + (l.paid_from ? '<span class="dcl-pill card" style="margin:0 6px 0 0">pay-out</span>' + esc(l.paid_from)
             : l.correction ? "correction " + money2(l.prev) + " → " + money2(l.value) : "");
      var take = d.kind === "signed" && data.me.manager && d.status !== "locked" && (l.src === "portal" || l.src === "fine")
        ? '<button class="dcl-btn sm" data-take="' + esc(d.id + "|" + l.src + "|" + l.src_id) + '">Take out</button>' : "";
      return '<tr class="ln"><td class="first" title="' + esc(l.customer || "") + '">' + esc(l.job_code || "—") + " · " + esc(l.customer || "—")
        + "</td><td>" + esc(Z.fmtAt(l.at)) + ' <span class="dcl-meta">' + esc(Z.short(l.by)) + '</span></td><td colspan="5">' + what
        + '</td><td></td><td class="r ' + netCls(l.effect) + '">' + money2(l.effect) + '</td><td class="r">' + take + "</td></tr>";
    }

    // ---- EXPENSES & INCOME (2026-10-28): the month's office cash, the old Looker "Expense
    // Accounting" page in the portal -- filters, totals, CSV, Edit / Withdraw, and (managers)
    // the category list -------------------------------------------------------------------
    function shiftMonth(m, k) {
      var y = +m.slice(0, 4), mo = +m.slice(5, 7) - 1 + k;
      y += Math.floor(mo / 12); mo = ((mo % 12) + 12) % 12;
      return y + "-" + String(mo + 1).padStart(2, "0");
    }
    function ocRows() {
      var q = OC.q.trim().toLowerCase();
      return (ocData.lines || []).filter(function (l) {
        if (OC.kind !== "all" && l.kind !== OC.kind) return false;
        if (OC.cat && l.category !== OC.cat) return false;
        if (OC.who && String(l.drawer_of || l.by).toLowerCase() !== OC.who) return false;
        return !q || [l.category, l.party, l.note, l.job_code, l.by, l.method].join(" ").toLowerCase().indexOf(q) >= 0;
      });
    }
    function officeHtml() {
      if (ocErr) return '<div class="dcl-err">Couldn’t load the expenses — ' + esc(ocErr) + "</div>";
      if (!ocData) return '<div class="dcl-load">Loading expenses…</div>';
      if (ocData.ready === false) return '<div class="dcl-load">Expenses can be recorded once the next data refresh has created their table (within the hour).</div>';
      var rows = ocRows(), live = rows.filter(function (l) { return !l.withdrawn; });
      var sum = function (f) { return live.filter(f).reduce(function (a, l) { return a + (+l.amount || 0); }, 0); };
      var cashExp = sum(function (l) { return l.kind === "expense" && l.method === "Cash"; });
      var cashInc = sum(function (l) { return l.kind === "income" && l.method === "Cash"; });
      var nonCash = sum(function (l) { return l.method !== "Cash"; });
      var notCost = sum(function (l) { return l.kind === "expense" && !l.is_cost; });
      var label = new Date(OC.month + "-15T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
      var cats = {}, people = {};
      (ocData.lines || []).forEach(function (l) { cats[l.category] = 1; people[String(l.drawer_of || l.by).toLowerCase()] = 1; });
      var opt = function (v, t, on) { return '<option value="' + esc(v) + '"' + (on ? " selected" : "") + ">" + esc(t) + "</option>"; };
      var bar = '<div class="dcl-ocbar"><span class="dcl-month"><button class="dcl-btn sm" data-ocm="-1" aria-label="Previous month">‹</button><b>' + esc(label)
        + '</b><button class="dcl-btn sm" data-ocm="1" aria-label="Next month">›</button></span>'
        + '<select id="ocKind">' + opt("all", "Expenses and income", OC.kind === "all") + opt("expense", "Expenses", OC.kind === "expense") + opt("income", "Other income", OC.kind === "income") + "</select>"
        + '<select id="ocCat">' + opt("", "Every category", !OC.cat) + Object.keys(cats).sort().map(function (c) { return opt(c, c, OC.cat === c); }).join("") + "</select>"
        + '<select id="ocWho">' + opt("", "Everyone", !OC.who) + Object.keys(people).sort().map(function (p) { return opt(p, Z.short(p), OC.who === p); }).join("") + "</select>"
        + '<input class="dcl-q" id="ocQ" placeholder="Search a reason, a name or a job" value="' + esc(OC.q) + '" style="min-width:200px">'
        + '<span style="margin-left:auto;display:inline-flex;gap:6px"><button class="dcl-btn sm" data-ocnew="expense">− Expense</button><button class="dcl-btn sm" data-ocnew="income">+ Other income</button>'
        + '<button class="dcl-btn sm" id="ocCsv">CSV</button>' + (data.me.manager ? '<button class="dcl-btn sm" id="ocCats">' + (OC.cats ? "Hide categories" : "Categories") + "</button>" : "") + "</span></div>";
      var kpis = '<div class="dcl-kpis">'
        + '<div class="dcl-kpi"><b>' + money(cashExp) + "</b><span>Cash expenses</span><small>out of the drawer</small></div>"
        + '<div class="dcl-kpi"><b>' + money(cashInc) + "</b><span>Other income</span><small>cash into the drawer</small></div>"
        + '<div class="dcl-kpi"><b>' + money(notCost) + "</b><span>Not a cost</span><small>Tbilisi office, bank deposits: in the expenses, not a company cost</small></div>"
        + '<div class="dcl-kpi"><b>' + money(nonCash) + "</b><span>Not cash</span><small>card, Zelle, bank: listed, never in the drawer</small></div></div>";
      var table = '<div class="dcl-card"><div class="dcl-wrap"><table class="dcl-tbl oclist">'
        + '<colgroup><col style="width:10%"><col style="width:9%"><col style="width:12%"><col style="width:11%"><col style="width:19%"><col style="width:7%"><col style="width:6%"><col style="width:8%"><col style="width:7%"><col style="width:11%"></colgroup>'
        + '<thead><tr><th>When</th><th>Who</th><th>Category</th><th>Paid to / from</th><th>Reason</th><th>Job</th><th>How</th><th class="r">Amount</th><th>Day</th><th class="r"></th></tr></thead><tbody>'
        + (rows.length ? rows.map(function (l) {
            var acts = l.can_change ? '<button class="dcl-btn sm" data-lfix="' + l.id + '">Edit</button> <button class="dcl-btn sm" data-lwd="' + l.id + '">Withdraw</button>' : "";
            var who = Z.short(l.drawer_of || l.by) + (String(l.by || "").toLowerCase() !== String(l.drawer_of || "").toLowerCase() ? ' <span class="dcl-meta">by ' + esc(Z.short(l.by)) + "</span>" : "");
            return '<tr class="' + (l.withdrawn ? "wd" : "") + '"><td>' + esc(Z.fmtAt(l.at)) + "</td><td>" + who + "</td><td>"
              + '<span class="dcl-pill ' + (l.kind === "income" ? "inc" : "exp") + '" style="margin:0 6px 0 0">' + (l.kind === "income" ? "in" : "out") + "</span>" + esc(l.category)
              + (l.is_cost ? "" : ' <span class="dcl-meta">not a cost</span>') + "</td><td>" + esc(l.party || "—") + '</td><td class="why">' + esc(l.note || "")
              + (l.corrected ? ' <span class="dcl-meta">corrected</span>' : "") + (l.source === "form" ? ' <span class="dcl-meta">old form</span>' : "") + "</td><td>" + esc(l.job_code || "—")
              + "</td><td>" + (l.method === "Cash" ? "Cash" : '<span class="dcl-pill nc" style="margin:0">' + esc(l.method) + "</span>") + '</td><td class="r ' + (l.withdrawn ? "" : l.kind === "income" ? "dcl-pos" : "dcl-neg") + '">'
              + (l.kind === "income" ? "" : "−") + money2(l.amount) + "</td><td>" + (l.day ? esc(Z.fmtDay(l.day).replace(/, \d{4}$/, "")) : '<span class="dcl-pill open" style="margin:0">open</span>') + '</td><td class="r">' + acts + "</td></tr>";
          }).join("") : '<tr><td colspan="10" style="color:var(--faint);padding:18px">Nothing recorded in ' + esc(label) + (OC.kind !== "all" || OC.cat || OC.who || OC.q ? " that matches" : "") + ".</td></tr>")
        + '</tbody></table></div><div class="dcl-note">Each line sits in the drawer of whoever recorded it. Edit or withdraw a line while its day is open; once the day has closed only a Day Closing manager can, and the change counts in today’s drawer. '
        + "Lines marked “old form” came from the old Day Closing System’s Expense / Other Revenue forms.</div></div>";
      return bar + (OC.cats && data.me.manager ? catsHtml() : "") + kpis + table;
    }
    function catsHtml() {
      var box = function (kind, title) {
        return '<div class="box"><div class="dcl-oclbl">' + title + "</div>" + (ocData.categories || []).filter(function (c) { return c.kind === kind; }).map(function (c) {
            return '<div class="row' + (c.is_on ? "" : " off") + '"><span>' + esc(c.name) + "</span>"
              + (kind === "expense" ? '<button class="dcl-btn sm" data-ccost="' + c.id + '" data-v1="' + (c.is_cost ? 0 : 1) + '">' + (c.is_cost ? "a cost" : "not a cost") + "</button>" : "")
              + '<button class="dcl-btn sm" data-con="' + c.id + '" data-v1="' + (c.is_on ? 0 : 1) + '">' + (c.is_on ? "Turn off" : "Turn on") + "</button></div>";
          }).join("")
          + '<div class="row"><input class="dcl-q" data-cnew="' + kind + '" placeholder="New ' + (kind === "income" ? "income" : "expense") + ' category" style="min-width:0;max-width:none">'
          + (kind === "expense" ? '<label style="font-size:12px;white-space:nowrap"><input type="checkbox" data-cnc="expense"> not a cost</label>' : "")
          + '<button class="dcl-btn sm" data-cadd="' + kind + '">Add</button></div></div>';
      };
      return '<div class="dcl-cats">' + box("expense", "Expense categories") + box("income", "Income categories") + "</div>";
    }
    function wireOffice() {
      var root = $b();
      var again = async function () { await loadOc(); paint(); };
      root.querySelectorAll("[data-ocm]").forEach(function (b) { b.onclick = function () { OC.month = shiftMonth(OC.month, +b.getAttribute("data-ocm")); ocData = null; paint(); again(); }; });
      var sel = function (id, key) { var s = root.querySelector(id); if (s) s.onchange = function () { OC[key] = s.value; paint(); }; };
      sel("#ocKind", "kind"); sel("#ocCat", "cat"); sel("#ocWho", "who");
      var q = root.querySelector("#ocQ");
      if (q) q.oninput = function () { OC.q = q.value; var p = q.selectionStart; paint(); var n = host.querySelector("#ocQ"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { /* best effort */ } } };
      var byId = function (id) { return (ocData.lines || []).filter(function (l) { return String(l.id) === String(id); })[0]; };
      root.querySelectorAll("[data-lfix]").forEach(function (b) { b.onclick = function () { var l = byId(b.getAttribute("data-lfix")); if (l) Z.openOffice({ line: l }); }; });
      root.querySelectorAll("[data-lwd]").forEach(function (b) { b.onclick = function () { var l = byId(b.getAttribute("data-lwd")); if (l) Z.withdrawOffice(l); }; });
      var cb = root.querySelector("#ocCats"); if (cb) cb.onclick = function () { OC.cats = !OC.cats; paint(); };
      var csv = root.querySelector("#ocCsv");
      if (csv) csv.onclick = function () {
        var cell = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        var head = ["Date", "Time", "Kind", "Category", "Not a cost", "Amount", "How", "Paid to / from", "Reason", "Job", "Drawer of", "Recorded by", "Day closed", "Withdrawn", "Corrected", "Source"];
        var body = ocRows().map(function (l) {
          return [String(l.at).slice(0, 10), String(l.at).slice(11, 16), l.kind, l.category, l.is_cost ? "" : "yes", (l.kind === "income" ? 1 : -1) * l.amount, l.method,
                  l.party, l.note, l.job_code, l.drawer_of, l.by, l.day || "open", l.withdrawn ? "yes" : "", l.corrected ? "yes" : "", l.source].map(cell).join(",");
        });
        var blob = new Blob([[head.join(",")].concat(body).join("\n")], { type: "text/csv" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "office-cash-" + OC.month + ".csv";
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      };
      var cat = async function (body) { try { await Z.oc("", body); await Z.ocMeta(true); await again(); } catch (e) { alert(e.message); } };
      root.querySelectorAll("[data-con]").forEach(function (b) { b.onclick = function () { cat({ action: "cat_set", id: +b.getAttribute("data-con"), is_on: +b.getAttribute("data-v1") }); }; });
      root.querySelectorAll("[data-ccost]").forEach(function (b) { b.onclick = function () { cat({ action: "cat_set", id: +b.getAttribute("data-ccost"), is_cost: +b.getAttribute("data-v1") }); }; });
      root.querySelectorAll("[data-cadd]").forEach(function (b) {
        b.onclick = function () {
          var kind = b.getAttribute("data-cadd"), inp = root.querySelector('[data-cnew="' + kind + '"]'), nc = root.querySelector('[data-cnc="' + kind + '"]');
          if (!inp || !inp.value.trim()) return;
          cat({ action: "cat_add", kind: kind, name: inp.value, is_cost: nc && nc.checked ? 0 : 1 });
        };
      });
    }

    // ---- the period report's page --------------------------------------------------------
    function rpRows(t, nc) {
      // the old Monthly Report's summary, top to bottom (bridge day_closing.email_rows, same order)
      var fines = t.fines || 0, adv = t.advances || 0, oi = t.other_in || 0, ex = t.expenses || 0;
      var r = [["Total Cash Inflow", t.cash_in + oi, 1], ["Job cash brought by foremen", t.cash_in - fines]];
      if (Math.abs(fines) > 0.004) r.push(["Debts repaid by foremen", fines]);
      r.push(["Other income", oi], null, ["Total Cash Outflow", -(t.card_out + adv + ex), 1], ["Paid out to foremen", -t.card_out]);
      if (Math.abs(adv) > 0.004) r.push(["Advances given to foremen", -adv]);
      r.push(["Expenses", -ex], null, ["Final Balance (in the drawer)", t.net, 1]);
      if (nc && nc.n) r.push(["Not cash, listed only (Zelle / card / bank)", Math.abs(nc.total || 0)]);
      return r;
    }
    function rpTitle() {
      var f = function (s) { return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
      return RP.from === RP.to ? f(RP.from) : f(RP.from) + " – " + f(RP.to);
    }
    function reportHtml() {
      var bar = '<div class="dcl-ocbar"><label class="dcl-meta" style="margin:0">From <input type="date" id="rpFrom" value="' + esc(RP.from) + '" class="dcl-q" style="min-width:0;max-width:170px;flex:none"></label>'
        + '<label class="dcl-meta" style="margin:0">to <input type="date" id="rpTo" value="' + esc(RP.to) + '" class="dcl-q" style="min-width:0;max-width:170px;flex:none"></label>'
        + '<button class="dcl-btn sm" data-rpq="month">This month</button><button class="dcl-btn sm" data-rpq="last">Last month</button><button class="dcl-btn sm" data-rpq="week">Last 7 days</button>'
        + '<select id="rpBasis" title="How a job’s cash is dated"><option value="job"' + (RP.basis === "job" ? " selected" : "") + ">Jobs by the job’s date</option>"
        + '<option value="cash"' + (RP.basis === "cash" ? " selected" : "") + ">Jobs by the day the cash moved</option></select>"
        + '<span style="margin-left:auto;display:inline-flex;gap:6px"><button class="dcl-btn sm" id="rpPdf">PDF</button><button class="dcl-btn sm" id="rpCsv">CSV</button></span></div>';
      if (rpErr) return bar + '<div class="dcl-err">' + esc(rpErr) + "</div>";
      if (!rpData) return bar + '<div class="dcl-load">' + (rpBusy ? "Building the report…" : "Pick the dates.") + "</div>";
      var d = rpData, t = d.totals, nc = Z.notCash(d) ? d.not_cash : null;
      var th = function (a) { return "<thead><tr>" + a.map(function (x, i) { return "<th" + (i ? ' class="r"' : "") + ">" + x + "</th>"; }).join("") + "</tr></thead>"; };
      var sum = '<div class="dcl-card" style="margin-bottom:14px"><table class="dcl-tbl" style="min-width:0;table-layout:auto">' + th(["Summary · " + esc(rpTitle()), "Amount"]) + "<tbody>"
        + rpRows(t, d.not_cash).map(function (r) {
            if (!r) return '<tr><td colspan="2" style="padding:4px"></td></tr>';
            return "<tr><td" + (r[2] ? ' style="font-weight:800"' : ' style="padding-left:28px"') + ">" + esc(r[0]) + '</td><td class="r' + (r[2] ? '" style="font-weight:800' : "") + '">' + money2(r[1]) + "</td></tr>";
          }).join("") + "</tbody></table>"
        + '<div class="dcl-note">' + (d.basis === "job" ? "A job’s cash counts on the job’s date, like the old Reporting sheet; office cash and the foremen’s balance on the day it happened."
             : "Every line counts on the Day Closing day it sits in (a closed day’s date; the open day as today).")
        + " Only cash moves the drawer. Office cash before Oct 2025 is in the Expenses & income list; job cash here starts Oct 2025.</div></div>";
      var days = '<h2 style="font-size:15px;margin:6px 0 8px">By day</h2><div class="dcl-card" style="margin-bottom:14px"><div class="dcl-wrap" style="max-height:420px"><table class="dcl-tbl" style="min-width:780px">'
        + th(["Day", "Cash in", "Paid out", "Other income", "Expenses", "In the drawer"]) + "<tbody>"
        + (d.by_day.length ? d.by_day.map(function (x) {
            return "<tr><td>" + esc(Z.fmtDay(x.date)) + '</td><td class="r">' + money(x.cash_in) + '</td><td class="r">' + money(x.card_out + (x.advances || 0)) + '</td><td class="r">' + money(x.other_in || 0)
              + '</td><td class="r">' + money(x.expenses || 0) + '</td><td class="r"><b>' + money(x.net) + "</b></td></tr>";
          }).join("") : '<tr><td colspan="6" style="color:var(--faint)">Nothing in this period.</td></tr>') + "</tbody></table></div></div>";
      var cats = d.categories.length ? '<h2 style="font-size:15px;margin:6px 0 8px">Office cash by category</h2><div class="dcl-card" style="margin-bottom:14px"><table class="dcl-tbl" style="min-width:640px">'
        + th(["Category", "Lines", "Cash (drawer)", "Not cash"]) + "<tbody>" + d.categories.map(function (c) {
            return '<tr><td><span class="dcl-pill ' + (c.kind === "income" ? "inc" : "exp") + '" style="margin:0 6px 0 0">' + (c.kind === "income" ? "in" : "out") + "</span>" + esc(c.category)
              + (c.is_cost ? "" : ' <span class="dcl-meta">not a cost</span>') + '</td><td class="r">' + c.n + '</td><td class="r">' + money2(c.cash) + '</td><td class="r">' + (c.not_cash ? money2(c.not_cash) : "—") + "</td></tr>";
          }).join("") + "</tbody></table></div>" : "";
      var ppl = d.people.length ? '<h2 style="font-size:15px;margin:6px 0 8px">By person</h2><div class="dcl-card" style="margin-bottom:14px"><table class="dcl-tbl" style="min-width:640px">'
        + th(["Person", "Cash in", "Paid out", "Other income", "Expenses", "In the drawer"]) + "<tbody>" + d.people.map(function (p) {
            return "<tr><td>" + esc(Z.short(p.person)) + '</td><td class="r">' + money(p.cash_in) + '</td><td class="r">' + money(p.card_out + (p.advances || 0)) + '</td><td class="r">' + money(p.other_in || 0)
              + '</td><td class="r">' + money(p.expenses || 0) + '</td><td class="r"><b>' + money(p.net) + "</b></td></tr>";
          }).join("") + "</tbody></table></div>" : "";
      var cash = d.lines.filter(function (l) { return !Z.isNotCash(l); });
      var jobs = cash.filter(function (l) { return !Z.isOffice(l); }), offl = cash.filter(Z.isOffice);
      var detail = '<h2 style="font-size:15px;margin:6px 0 8px">Every line (' + cash.length + ")</h2>"
        + '<div class="dcl-card"><div class="dcl-wrap" style="max-height:520px"><table class="dcl-tbl" style="min-width:980px">'
        + th(["Date", "Job / category", "Customer / paid to", "Foreman / who", "What", "Drawer"]) + "<tbody>"
        + jobs.concat(offl).sort(function (a, b) { return String(a.report_date + a.at).localeCompare(String(b.report_date + b.at)); }).map(function (l) {
            var off = Z.isOffice(l);
            return "<tr><td>" + esc(Z.fmtDay(l.report_date).replace(/, \d{4}$/, "")) + "</td><td>" + esc(off ? l.category || "" : l.job_code || "—") + "</td><td>" + esc((off ? l.party : l.customer) || "—")
              + "</td><td>" + esc(off ? Z.short(l.by) : l.foreman) + '</td><td style="white-space:normal">' + esc(off ? (l.note || "") : (l.kind === "Fine repaid" ? "Debt repaid" : l.kind === "Advance given" ? "Advance given" : l.paid_from || ""))
              + '</td><td class="r ' + (l.effect > 0 ? "dcl-pos" : l.effect < 0 ? "dcl-neg" : "") + '">' + money2(l.effect) + "</td></tr>";
          }).join("") + "</tbody></table></div></div>";
      return bar + sum + days + cats + ppl + detail;
    }
    function wireReport() {
      var root = $b();
      var run = async function () { rpData = null; paint(); await loadRp(); paint(); };
      var f = root.querySelector("#rpFrom"), t = root.querySelector("#rpTo"), b = root.querySelector("#rpBasis");
      if (f) f.onchange = function () { if (f.value) { RP.from = f.value; run(); } };
      if (t) t.onchange = function () { if (t.value) { RP.to = t.value; run(); } };
      if (b) b.onchange = function () { RP.basis = b.value; run(); };
      root.querySelectorAll("[data-rpq]").forEach(function (x) {
        x.onclick = function () {
          var n = new Date(), q = x.getAttribute("data-rpq");
          if (q === "month") { RP.from = isoDay(new Date(n.getFullYear(), n.getMonth(), 1)); RP.to = isoDay(n); }
          else if (q === "last") { RP.from = isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)); RP.to = isoDay(new Date(n.getFullYear(), n.getMonth(), 0)); }
          else { RP.from = isoDay(new Date(n.getFullYear(), n.getMonth(), n.getDate() - 6)); RP.to = isoDay(n); }
          run();
        };
      });
      var pdf = root.querySelector("#rpPdf");
      if (pdf) pdf.onclick = function () {
        if (!rpData) return;
        var w = window.open("", "_blank");
        Z.printSheet(w, { kind: "period", title: rpTitle(), meta: "Period report · " + (rpData.basis === "job" ? "jobs counted on the job’s date" : "lines counted on the Day Closing day") }, rpData.lines, null);
      };
      var csv = root.querySelector("#rpCsv");
      if (csv) csv.onclick = function () {
        if (!rpData) return;
        var cell = function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
        var head = ["Date", "Kind", "Job", "Customer / paid to", "Foreman", "Category", "Reason / note", "How", "Drawer", "Amount", "Recorded by", "Recorded at"];
        var body = rpData.lines.map(function (l) {
          var off = Z.isOffice(l);
          return [l.report_date, off ? (l.office_kind === "income" ? "Other income" : "Expense") : l.kind, l.job_code, off ? l.party : l.customer, off ? "" : l.foreman,
                  off ? l.category : "", l.note || l.paid_from || "", l.method || "Cash", l.effect, l.amount != null ? l.amount : l.value, l.by, l.at].map(cell).join(",");
        });
        var blob = new Blob([[head.join(",")].concat(body).join("\n")], { type: "text/csv" });
        var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "day-closing-" + RP.from + "-to-" + RP.to + ".csv";
        document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      };
    }

    function paint() {
      var el = $b(); if (!el || !mine()) return;      // only the newest mount paints
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
      var bar = '<div class="dcl-bar"><div class="dcl-seg">' + seg("all", "All days") + seg("signed", "Closed") + seg("rec", "Reconstructed") + seg("office", "Expenses & income") + seg("report", "Period report") + "</div>"
        + (S.view === "office" || S.view === "report" ? "" : '<input class="dcl-q" id="dclQ" placeholder="Search a foreman or a date (2026-09)" value="' + esc(S.q) + '">') + "</div>";
      if (S.view === "office" || S.view === "report") {
        el.innerHTML = kp + bar + (S.view === "office" ? officeHtml() : reportHtml());
        wire(); if (S.view === "office") wireOffice(); else wireReport();
        if (window.ZDC_tick) window.ZDC_tick();
        if (window.RSC && RSC.fitScroller) RSC.fitScroller(el.querySelector(".dcl-wrap"));
        return;
      }
      var q = S.q.trim().toLowerCase();
      var days = data.days.filter(function (d) {
        if (S.view === "signed" && d.kind !== "signed") return false;
        if (S.view === "rec" && d.kind !== "reconstructed") return false;
        return !q || String(d.date).indexOf(q) >= 0 || (d.foremen || []).some(function (f) { return f.foreman.toLowerCase().indexOf(q) >= 0; })
          || (d.people || []).some(function (p) { return p.person.indexOf(q) >= 0; });
      });
      var openRow = S.view === "rec" ? "" : dayRow({ key: "open", kind: "open", since: o.since, totals: o.totals, foremen: o.foremen,
                                                     people: o.people, closes_in_s: o.closes_in_s, not_cash: o.not_cash });
      var rows = days.slice(0, S.shown).map(dayRow).join("");
      el.innerHTML = kp + bar + '<div class="dcl-card"><div class="dcl-wrap"><table class="dcl-tbl" style="min-width:1240px">'
        + '<colgroup><col style="width:23%"><col style="width:13%"><col style="width:5%"><col style="width:6%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:8%"><col style="width:9%"><col style="width:12%"></colgroup>'
        + '<thead><tr><th>Day</th><th>Closed</th><th class="r">Jobs</th><th class="r">Foremen</th><th class="r">Cash in</th><th class="r">Paid out</th><th class="r">Other income</th><th class="r">Expenses</th><th class="r">In the drawer</th><th class="r"></th></tr></thead><tbody>'
        + openRow + (rows || '<tr><td colspan="10" style="color:var(--faint);padding:18px">No day matches.</td></tr>') + "</tbody></table>"
        + (days.length > S.shown ? '<button class="dcl-btn dcl-more" id="dclMore">Show 30 more days (' + (days.length - S.shown) + " left)</button>" : "")
        + '</div><div class="dcl-note">A day moves the drawer by what each record changed: a double click moves nothing, a correction moves only the difference. '
        + "Pay-outs are covered by the same foreman's cash first, then by the drawer. Only cash moves the drawer: Zelle, card and job-against-job entries are listed under each day as not cash. "
        + "Other income and expenses are the office's own cash (record them with the buttons above); each sits in the drawer of whoever recorded it."
        // the statements made before Day Closing existed (2026-10-08): Foreman Net Cash Closings left
        // the sidebar as an archive, and this is the way to it
        + ' <a class="dcl-link" href="#page=foreman-closings">Older foreman statements (16 Apr – 24 Sep) ›</a></div></div>';
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
      var root = $b();
      root.querySelectorAll("[data-v]").forEach(function (b) {
        b.onclick = function () {
          S.view = b.getAttribute("data-v"); paint();
          if (S.view === "office" && !ocData) loadOc().then(paint);
          if (S.view === "report" && !rpData && !rpBusy) loadRp().then(paint);
        };
      });
      // office cash (2026-10-28): the strip's buttons, a person's Office row, its lines' Edit / Withdraw
      Z.wireOcButtons(root, data, null);
      root.querySelectorAll("tr.oc").forEach(function (tr) {
        tr.onclick = async function (e) {
          if (e.target.closest("button")) return;
          var ok = tr.getAttribute("data-ok"); S.oopen[ok] = !S.oopen[ok]; paint();
          if (S.oopen[ok]) { try { await linesOf(ok.split("|")[0]); } catch (x) { S.lines[ok.split("|")[0]] = []; } paint(); }
        };
      });
      var ocLine = function (id) { return (S.lines.open || []).filter(function (l) { return Z.isOffice(l) && String(l.src_id) === String(id); })[0]; };
      root.querySelectorAll("[data-ocfix]").forEach(function (b) {
        b.onclick = function () { var l = ocLine(b.getAttribute("data-ocfix")); if (l) Z.openOffice({ line: lineAsEntry(l) }); };
      });
      root.querySelectorAll("[data-ocwd]").forEach(function (b) {
        b.onclick = function () { var l = ocLine(b.getAttribute("data-ocwd")); if (l) Z.withdrawOffice(lineAsEntry(l)); };
      });
      var q = root.querySelector("#dclQ");
      if (q) q.oninput = function () { S.q = q.value; var p = q.selectionStart; paint(); var n = host.querySelector("#dclQ"); if (n) { n.focus(); try { n.setSelectionRange(p, p); } catch (e) { /* best effort */ } } };
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
    var rb = host.querySelector("#dclRefresh");
    if (rb) rb.onclick = async function () { rb.disabled = true; try { S.lines = {}; await load(true); } catch (e) { /* keep the last view */ } rb.disabled = false; paint(); };
    paint();
  },
});
