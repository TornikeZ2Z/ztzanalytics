/* REVIEWS ▸ Reminders — the review-request Slack automation, made visible.
   Three things on one page:
     1) Send log  — every morning/mid/final Slack nudge the bot sent to foremen, grouped by day,
        with status (sent / skipped-no-Slack-ID / error).
     2) Missed-review reasons — what foremen reported back on the "why no review?" form.
     3) Review links — the reviews team picks WHICH review URL is sent per delivery state
        (e.g. NJ has two Google listings, Shafto & Kearny — steer requests to the one that still
        needs reviews). Saved to the ops sheet; the bot reads it live on the next reminder.
   Data comes from the SAME Apps Script relay the bot runs on (JSONP read, no-cors write) — the
   log lives in a Google Sheet, not the warehouse, so this page talks to the relay directly.
   Goal context (how far each listing is from its target) is read from the warehouse. */

var RRP_RELAY = "https://script.google.com/macros/s/AKfycbzX3q9VqyZKd3FUbGCPKN9JcQgcp15rz0QXxzNnxTYeXSRCY16Ei8n_9D07c9EQvOxM/exec";
var RRP_TZ = "America/New_York";
// Fallback catalog shown if the relay isn't reachable yet (mirrors the bot's seed) so the
// link editor is still usable/previewable before the relay is (re)deployed.
var RRP_SEED = {
  google: [
    { state: "NJ", name: "NJ – Kearny", url: "https://qrco.de/bguZsO", active: true },
    { state: "NJ", name: "NJ – Shafto", url: "https://qrco.de/bguV3f", active: false },
    { state: "PA", name: "PA", url: "https://qrco.de/bguXD6", active: true },
    { state: "NY", name: "NY", url: "https://qrco.de/bguXWa", active: true },
    { state: "CT", name: "CT", url: "https://qrco.de/bguXJI", active: true },
    { state: "VA", name: "VA", url: "https://qrco.de/bguZIn", active: true },
    { state: "MD", name: "MD", url: "https://qrco.de/bguZJl", active: true },
    { state: "DE", name: "DE", url: "https://qrco.de/bguZLD", active: true }
  ],
  platforms: [
    { name: "Trustpilot", url: "https://www.trustpilot.com/evaluate/www.ziptozipmoving.com", active: true },
    { name: "Facebook", url: "https://www.facebook.com/ZiptozipMoving/reviews", active: true }
  ],
  reasons: ["Customer refused", "The customer was dissatisfied", "Open claim",
    "Support intervention was required", "Billing issue", "The customer promised to write later",
    "Elderly customer (not comfortable with technology)", "No internet / poor internet connection",
    "Customer was unfriendly / not willing to engage", "Other"]
};
var RRP = { data: null, err: null, view: "log", draft: null, saving: false, saved: 0, fq: "", goals: null, openJobs: {}, openDays: {} };
// SPEED: cache the last good reviewData in localStorage so a repeat visit paints the schedule
// INSTANTLY from cache, then refreshes in the background (the relay read is ~30-50s cold).
var RRP_CACHE_KEY = "ztz_rrp_reviewData_v2";
function rrpCacheRead() { try { var s = localStorage.getItem(RRP_CACHE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function rrpCacheWrite(data) { try { localStorage.setItem(RRP_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch (e) {} }

// SPLIT into 3 flat sidebar pages (Tornike 2026-07-16): Send Reminders / Response Analysis / Settings.
// One shared render, each page presets RRP.view and hides the in-page toolbar. The old single
// "reviews-reminders" page (with Daily/Missed/Settings tabs) is gone; "reviews-reminders" now IS
// "Send Reminders". "response" is the NEW reminder-feed Response Analysis (replaces "Missed-review
// reasons"). "review-settings" is the Settings view as its own page.
registerPage({ id: "reviews-reminders", group: "reviews", title: "Send Reminders",
  render: function (host) { RRP.view = "log"; RRP.solo = 1; return render(host); } });
registerPage({ id: "response-analysis", group: "reviews", title: "Response Analysis",
  render: function (host) { RRP.view = "response"; RRP.solo = 1; return render(host); } });
registerPage({ id: "review-settings", group: "reviews", title: "Review URLs and Reasons",
  render: function (host) { RRP.view = "links"; RRP.solo = 1; return render(host); } });
{
  // NAMED function expression (not a shorthand method) so `render` is callable inside itself —
  // the Refresh/Retry handlers call render(host) to fully re-run (Tornike 2026-07-15 fix; was a
  // ReferenceError → Refresh button did nothing).
  var render = async function render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var TYPE = { morning: { l: "Morning", c: "t-blue" }, pre: { l: "Pre-start · Yelp", c: "t-red" }, mid: { l: "Mid-job", c: "t-amber" }, final: { l: "Final", c: "t-green" } };

    if (!document.getElementById("rrp-style")) {
      var st = document.createElement("style"); st.id = "rrp-style";
      st.textContent = [
        /* full-width like the rest of the portal (Tornike 2026-07-16: the 1120px cap left huge dead
           gutters at zoom — the page looked pushed right). Settings keeps its tuned editor width. */
        ".rrp{max-width:none;margin:0;padding:2px 4px 40px}",
        ".rrp.rrp-vlinks{max-width:1120px;margin:0 auto}",
        ".rrp-head{display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;justify-content:space-between;margin-bottom:14px}",
        ".rrp-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em;display:flex;align-items:center;gap:9px}",
        ".rrp-star{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#f6c944,#e0a015);color:#3a2a05;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto}",
        ".rrp-head p{margin:3px 0 0;color:var(--muted);font-size:13px;max-width:640px;line-height:1.5}",
        ".rrp-refresh{border:1px solid var(--line-2);background:var(--panel);color:var(--ink);border-radius:10px;padding:8px 13px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}",
        ".rrp-refresh:hover{border-color:var(--brand)}",
        ".rrp-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}",
        ".rrp-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 15px}",
        ".rrp-kpi b{display:block;font-size:26px;font-weight:800;letter-spacing:-.02em;line-height:1.05;font-variant-numeric:tabular-nums}",
        ".rrp-kpi span{display:block;font-size:10.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:800;margin-top:5px}",
        ".rrp-kpi small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}",
        ".rrp-kpi.warn b{color:#e0912a}.rrp-kpi.bad b{color:#e5484d}.rrp-kpi.good b{color:var(--brand)}",
        ".rrp-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px;margin-bottom:16px;flex-wrap:wrap}",
        ".rrp-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13px;font-weight:700;padding:7px 14px;border-radius:8px}",
        ".rrp-seg button.on{background:var(--brand);color:var(--brand-ink)}",
        ".rrp-filters{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:14px}",
        ".rrp-filters select,.rrp-filters input{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:7px 10px}",
        ".rrp-filters input{min-width:170px}",
        ".rrp-day{margin:18px 0 8px;display:flex;align-items:baseline;gap:9px}",
        ".rrp-day h3{margin:0;font-size:14px;font-weight:800}",
        ".rrp-day span{font-size:11.5px;color:var(--faint);font-weight:700}",
        ".rrp-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}",
        ".rrp-row{display:grid;grid-template-columns:66px 78px 1.3fr 1.5fr 1fr 92px;gap:10px;align-items:center;padding:11px 15px;border-top:1px solid var(--line);font-size:13px}",
        ".rrp-row:first-child{border-top:0}",
        ".rrp-row .tm{font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px;font-weight:600}",
        ".rrp-row .who{font-weight:700}",
        ".rrp-row .cust{color:var(--ink)}.rrp-row .cust small{display:block;color:var(--faint);font-size:11px;margin-top:1px}",
        ".rrp-row .lnk{color:var(--muted);font-size:11.5px}",
        ".pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.02em;padding:3px 8px;border-radius:999px;white-space:nowrap}",
        ".t-blue{background:rgba(56,132,255,.16);color:#5b9bff}.t-amber{background:rgba(224,145,42,.16);color:#e0912a}.t-green{background:rgba(46,160,90,.18);color:#3fbb6d}.t-red{background:rgba(220,53,69,.16);color:#e4606d}",
        ".s-sent{background:rgba(46,160,90,.16);color:#3fbb6d}.s-skip{background:rgba(224,145,42,.18);color:#e0912a}.s-err{background:rgba(229,72,77,.18);color:#e5484d}",
        ".rrp-empty{background:var(--panel);border:1px dashed var(--line-2);border-radius:14px;padding:34px;text-align:center;color:var(--muted);font-size:14px}",
        ".rrp-dayhead{display:flex;align-items:center;gap:9px;cursor:pointer;user-select:none;margin:16px 0 9px;padding:2px 0}",
        ".rrp-dayhead .rrp-daychev{color:var(--faint);font-size:12px;width:14px}",
        ".rrp-dayhead h3{margin:0;font-size:15px;font-weight:800}",
        ".rrp-dayhead span{font-size:11.5px;color:var(--faint);font-weight:700}",
        ".rrp-dayhead:hover h3{color:var(--brand)}",
        ".rrp-jobcard{background:var(--panel);border:1px solid var(--line);border-radius:12px;margin-bottom:8px;overflow:hidden}",
        ".rrp-jobcard.open{border-color:var(--line-2)}",
        ".rrp-jobhead{display:grid;grid-template-columns:48px 1fr 1.2fr auto 20px;gap:12px;align-items:center;padding:12px 15px;cursor:pointer}",
        ".rrp-jobhead:hover{background:var(--panel-2)}",
        ".rrp-prog{font-variant-numeric:tabular-nums;font-weight:800;font-size:13px;text-align:center;padding:4px 0;border-radius:8px}",
        ".rrp-prog.p3{background:rgba(46,160,90,.18);color:#3fbb6d}.rrp-prog.p2{background:rgba(224,145,42,.16);color:#e0912a}.rrp-prog.pskip{background:rgba(229,72,77,.14);color:#e5484d}.rrp-prog.pfut{background:var(--panel-2);color:var(--muted);border:1px solid var(--line-2)}",
        ".rrp-jw{font-weight:700;font-size:13.5px}",
        ".rrp-noid{font-size:9.5px;font-weight:800;color:#e0912a;background:rgba(224,145,42,.14);padding:2px 6px;border-radius:6px;white-space:nowrap}",
        ".rrp-jc{font-size:13px}.rrp-jc small{display:block;color:var(--faint);font-size:11px;margin-top:1px}",
        ".rrp-jstages{display:flex;gap:5px;justify-self:end;flex-wrap:wrap;justify-content:flex-end}",
        ".rrp-stage{font-size:10px;font-weight:700;letter-spacing:.01em;padding:3px 8px;border-radius:999px;border:1px solid var(--line-2);color:var(--muted);white-space:nowrap}",
        ".rrp-stage b{font-weight:800;font-variant-numeric:tabular-nums}",
        ".rrp-stage.st-sent{background:rgba(46,160,90,.16);color:#3fbb6d;border-color:transparent}",
        ".rrp-stage.st-sched{background:rgba(91,155,255,.14);color:#5b9bff;border-color:transparent}",
        ".rrp-stage.st-due{background:rgba(224,145,42,.14);color:#e0912a;border-color:transparent}",
        ".rrp-stage.st-skip{background:rgba(224,145,42,.18);color:#e0912a;border-color:transparent}",
        ".rrp-stage.st-err{background:rgba(229,72,77,.16);color:#e5484d;border-color:transparent}",
        ".rrp-stage.st-na{opacity:.5}",
        ".pill.s-sched{background:rgba(91,155,255,.16);color:#5b9bff}",
        ".rrp-jchev{color:var(--faint);font-size:12px;text-align:center}",
        ".rrp-jobevents{border-top:1px solid var(--line);background:var(--panel-2)}",
        ".rrp-fgroup{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:10px;overflow:hidden}",
        ".rrp-fhead{display:grid;grid-template-columns:34px 1fr auto;gap:11px;align-items:center;padding:12px 15px}",
        ".rrp-favatar{width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--brand),#e0a015);color:var(--brand-ink);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12.5px;flex:0 0 auto}",
        ".rrp-fname{font-weight:800;font-size:14.5px}",
        ".rrp-fmeta{font-size:11.5px;color:var(--faint);font-weight:700;white-space:nowrap;justify-self:end;text-align:right}",
        ".rrp-morning{border-top:1px solid var(--line)}",
        ".rrp-jrhead{display:grid;grid-template-columns:16px 1fr auto;gap:11px;align-items:center;padding:10px 15px;cursor:pointer;border-top:1px solid var(--line)}",
        ".rrp-jrhead:hover{background:var(--panel-2)}",
        ".rrp-jrchev{color:var(--faint);font-size:12px;text-align:center}",
        ".rrp-jrc{font-size:13px}.rrp-jrc small{display:block;color:var(--faint);font-size:11px;margin-top:1px}",
        ".rrp-jrstages{display:flex;gap:5px;justify-self:end;flex-wrap:wrap;justify-content:flex-end}",
        ".rrp-evrow{display:flex;align-items:center;gap:12px;padding:9px 15px 9px 20px;border-top:1px solid var(--line);font-size:12.5px}",
        ".rrp-evrow:first-child{border-top:0}",
        ".rrp-evrow .tm{font-variant-numeric:tabular-nums;color:var(--muted);min-width:60px}",
        ".rrp-evlnk{flex:1;color:var(--faint);font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".rrp-msg{margin:0 15px 10px 20px}",
        ".rrp-msg summary{cursor:pointer;font-size:11.5px;font-weight:700;color:var(--brand);list-style:none;padding:5px 0;width:fit-content}",
        ".rrp-msg summary::-webkit-details-marker{display:none}",
        ".rrp-msg summary:hover{text-decoration:underline}",
        ".rrp-msgbody{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-size:12.5px;line-height:1.55;color:var(--ink);white-space:normal;word-break:break-word}",
        ".rrp-msgbody a{color:#5b9bff}",
        ".rrp-msgnote{color:var(--muted);font-size:11.5px;margin-bottom:8px}",
        ".rrp-linkchips{display:flex;flex-wrap:wrap;gap:7px}",
        ".rrp-linkchip{font-size:11.5px;font-weight:700;background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;padding:5px 10px;color:#5b9bff;text-decoration:none}",
        ".rrp-linkchip:hover{border-color:#5b9bff}.rrp-linkchip.off{color:var(--faint)}",
        ".rrp-reasontbl{width:100%;border-collapse:collapse;font-size:13px}",
        ".rrp-reasontbl th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:10px 14px;border-bottom:1px solid var(--line)}",
        ".rrp-reasontbl td{padding:11px 14px;border-top:1px solid var(--line);vertical-align:top}",
        ".rrp-bars{display:flex;flex-direction:column;gap:7px;margin-bottom:18px}",
        ".rrp-bar{display:grid;grid-template-columns:210px 1fr 40px;gap:10px;align-items:center;font-size:12.5px}",
        ".rrp-bar .track{background:var(--panel-2);border-radius:6px;height:16px;overflow:hidden;border:1px solid var(--line)}",
        ".rrp-bar .track i{display:block;height:100%;background:linear-gradient(90deg,#e0a015,#f6c944)}",
        ".rrp-bar b{font-variant-numeric:tabular-nums;text-align:right;font-weight:800}",
        ".rrp-note{background:var(--brand-glow);border:1px solid var(--line-2);border-left:3px solid var(--brand);border-radius:10px;padding:11px 14px;font-size:12.5px;color:var(--ink);line-height:1.55;margin-bottom:16px}",
        /* ---------- Settings (redesign 2026-07-16) ----------
           Two columns: editor + a STICKY live preview of the real Slack message. Everything is
           built from the shell's theme tokens, so it works in dark AND light with no overrides. */
        ".rrp-set{display:grid;grid-template-columns:minmax(0,1fr) 372px;gap:18px;align-items:start}",
        "@media(max-width:1120px){.rrp-set{grid-template-columns:minmax(0,1fr)}}",
        ".rrp-sec{background:var(--panel);border:1px solid var(--line);border-radius:16px;margin-bottom:14px;overflow:hidden;box-shadow:var(--shadow)}",
        ".rrp-sech{display:flex;align-items:flex-start;gap:12px;padding:15px 17px 13px;border-bottom:1px solid var(--line)}",
        ".rrp-secn{flex:0 0 auto;width:24px;height:24px;border-radius:8px;background:var(--brand-glow);color:var(--brand);display:flex;align-items:center;justify-content:center;font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums}",
        "body.rs-app.light .rrp-secn{color:var(--brand-d)}",
        ".rrp-sect{min-width:0}",
        ".rrp-sect h4{margin:0;font-size:15.5px;font-weight:800;letter-spacing:-.01em}",
        ".rrp-sect p{margin:3px 0 0;font-size:12.5px;color:var(--muted);line-height:1.55}",
        ".rrp-secb{padding:6px 17px 15px}",
        /* state block: header (chip + goal meter) then its location rows */
        ".rrp-st{border-top:1px solid var(--line);padding:13px 0 11px}",
        ".rrp-st:first-child{border-top:0}",
        ".rrp-sth{display:flex;align-items:center;gap:11px;margin-bottom:9px}",
        ".rrp-stchip{flex:0 0 auto;min-width:34px;text-align:center;font-size:11.5px;font-weight:800;letter-spacing:.03em;padding:4px 9px;border-radius:8px;background:var(--panel-2);border:1px solid var(--line-2);color:var(--ink)}",
        ".rrp-goal{flex:1;min-width:0;display:flex;align-items:center;gap:9px}",
        ".rrp-goalbar{flex:1;height:5px;border-radius:999px;background:var(--panel-2);border:1px solid var(--line);overflow:hidden;min-width:60px}",
        ".rrp-goalbar i{display:block;height:100%;background:var(--brand);border-radius:999px}",
        ".rrp-goaltx{font-size:11px;font-weight:700;color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}",
        /* location row — the ACTIVE one carries a lime rail + tint, so 'which link is live' reads at a glance */
        ".rrp-loc{display:grid;grid-template-columns:18px 148px minmax(0,1fr) 28px;gap:10px;align-items:center;padding:7px 10px 7px 8px;border-radius:10px;border:1px solid transparent;margin-top:5px;position:relative}",
        ".rrp-loc:hover{background:var(--panel-2)}",
        ".rrp-loc.on{background:var(--brand-glow);border-color:var(--line-2)}",
        ".rrp-loc.on:before{content:'';position:absolute;left:0;top:7px;bottom:7px;width:3px;border-radius:999px;background:var(--brand)}",
        ".rrp-loc input[type=radio]{width:15px;height:15px;accent-color:var(--brand);cursor:pointer;margin:0}",
        ".rrp-loc input[type=text]{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;width:100%;transition:border-color .12s}",
        ".rrp-loc input[type=text]:focus{outline:none;border-color:var(--brand)}",
        ".rrp-loc input.url{font-size:12px;color:var(--muted)}",
        ".rrp-loc .del{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;border-radius:7px;padding:4px;opacity:0;transition:opacity .12s}",
        ".rrp-loc:hover .del,.rrp-loc:focus-within .del{opacity:1}",
        ".rrp-loc .del:hover{color:var(--red);background:var(--panel)}",
        ".rrp-addloc{margin-top:8px;border:1px dashed var(--line-2);background:transparent;color:var(--muted);border-radius:9px;padding:7px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:.12s}",
        ".rrp-addloc:hover{border-color:var(--brand);color:var(--brand);border-style:solid}",
        /* platform + reason rows */
        ".rrp-plats{display:flex;flex-direction:column;gap:7px;margin-top:8px}",
        ".rrp-plat{display:grid;grid-template-columns:36px 138px minmax(0,1fr) 28px;gap:10px;align-items:center;padding:7px 10px;border-radius:10px;border:1px solid transparent}",
        ".rrp-plat:hover{background:var(--panel-2)}",
        ".rrp-plat input[type=text]{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;width:100%}",
        ".rrp-plat input[type=text]:focus{outline:none;border-color:var(--brand)}",
        ".rrp-plat .url{font-size:12px;color:var(--muted)}",
        ".rrp-plat .del{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;border-radius:7px;padding:4px;opacity:0;transition:opacity .12s}",
        ".rrp-plat:hover .del,.rrp-plat:focus-within .del{opacity:1}",
        ".rrp-plat .del:hover{color:var(--red);background:var(--panel)}",
        /* real toggle switch (the checkbox itself keeps its data-pon hook) */
        ".rrp-sw{position:relative;display:inline-block;width:34px;height:19px;flex:0 0 auto}",
        ".rrp-sw input{position:absolute;opacity:0;width:0;height:0}",
        ".rrp-sw i{position:absolute;inset:0;background:var(--line-2);border-radius:999px;cursor:pointer;transition:background .15s}",
        ".rrp-sw i:before{content:'';position:absolute;width:13px;height:13px;left:3px;top:3px;background:var(--panel);border-radius:50%;transition:transform .15s;box-shadow:0 1px 2px rgba(0,0,0,.3)}",
        ".rrp-sw input:checked+i{background:var(--brand)}",
        ".rrp-sw input:checked+i:before{transform:translateX(15px)}",
        ".rrp-sw input:focus-visible+i{outline:2px solid var(--brand);outline-offset:2px}",
        ".rrp-reason{display:grid;grid-template-columns:minmax(0,1fr) 76px;gap:10px;align-items:center}",
        ".rrp-reason input{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;width:100%}",
        ".rrp-reason input:focus{outline:none;border-color:var(--brand)}",
        ".rrp-reason input[readonly]{opacity:.7;cursor:default;background:var(--panel-2)}",
        ".rrp-reason .del{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:15px;border-radius:7px;padding:4px}",
        ".rrp-reason .del:hover{color:var(--red)}",
        ".rrp-lockpill{font-size:9.5px;font-weight:800;color:var(--faint);text-align:center;text-transform:uppercase;letter-spacing:.04em}",
        ".rrp-clock{font-size:12px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 12px;white-space:nowrap;font-variant-numeric:tabular-nums}",
        ".rrp-headright{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}",
        /* ---------- live preview ---------- */
        ".rrp-pv{position:sticky;top:8px;background:var(--panel);border:1px solid var(--line);border-radius:16px;overflow:hidden;box-shadow:var(--shadow)}",
        "@media(max-width:1120px){.rrp-pv{position:static}}",
        ".rrp-pvh{padding:14px 16px 12px;border-bottom:1px solid var(--line)}",
        ".rrp-pvh h4{margin:0;font-size:14px;font-weight:800;display:flex;align-items:center;gap:8px}",
        ".rrp-pvh h4 em{font-style:normal;font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--blue);background:color-mix(in srgb,var(--blue) 15%,transparent);padding:2px 7px;border-radius:999px}",
        ".rrp-pvh p{margin:4px 0 0;font-size:11.5px;color:var(--muted);line-height:1.5}",
        ".rrp-pvctl{display:flex;gap:7px;padding:11px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap;align-items:center}",
        ".rrp-pvctl select{font:inherit;font-size:12px;font-weight:700;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:6px 9px}",
        ".rrp-pvseg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:9px;padding:2px}",
        ".rrp-pvseg button{border:0;background:transparent;color:var(--muted);font:inherit;font-size:11.5px;font-weight:800;padding:5px 10px;border-radius:7px;cursor:pointer}",
        ".rrp-pvseg button.on{background:var(--brand);color:var(--brand-ink)}",
        ".rrp-pvbody{padding:15px 16px 17px;background:var(--panel-2)}",
        ".rrp-msg{display:flex;gap:10px;align-items:flex-start}",
        ".rrp-msgav{flex:0 0 auto;width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,var(--brand),var(--brand-d));color:var(--brand-ink);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800}",
        ".rrp-msgb{min-width:0;flex:1}",
        ".rrp-msgn{font-size:12px;font-weight:800;margin-bottom:3px}",
        ".rrp-msgn span{font-size:9.5px;font-weight:700;color:var(--faint);margin-left:5px;text-transform:uppercase;letter-spacing:.04em}",
        ".rrp-bub{background:var(--panel);border:1px solid var(--line);border-radius:4px 12px 12px 12px;padding:11px 13px;font-size:12.5px;line-height:1.6;color:var(--ink);white-space:pre-wrap;word-break:break-word}",
        ".rrp-bub b{font-weight:800}",
        ".rrp-bub a{color:var(--blue);text-decoration:none}",
        ".rrp-bub .warn{color:var(--red);font-weight:800}",
        ".rrp-pvfoot{padding:10px 16px 13px;font-size:11px;color:var(--faint);line-height:1.5;border-top:1px solid var(--line)}",
        /* ---------- sticky save bar ---------- */
        /* Sticky action bar. It floats OVER same-coloured cards, so it needs to read as a separate
           layer: translucent + blur + a real lift shadow, never a flat panel-on-panel rectangle. */
        ".rrp-savebar{position:sticky;bottom:10px;display:flex;align-items:center;gap:12px;justify-content:flex-end;padding:11px 13px;margin-top:14px;background:color-mix(in srgb,var(--panel) 86%,transparent);backdrop-filter:saturate(180%) blur(12px);-webkit-backdrop-filter:saturate(180%) blur(12px);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 8px 28px rgba(0,0,0,.16),0 1px 2px rgba(0,0,0,.08);z-index:5}",
        ".rrp-savebar.dirty{border-color:var(--brand);box-shadow:0 8px 28px color-mix(in srgb,var(--brand) 22%,transparent),0 1px 2px rgba(0,0,0,.08)}",
        ".rrp-save{border:0;background:var(--brand);color:var(--brand-ink);border-radius:10px;padding:10px 20px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer;transition:.12s}",
        ".rrp-save:hover:not(:disabled){background:var(--brand-d)}",
        ".rrp-save:disabled{opacity:.55;cursor:default}",
        ".rrp-savemsg{font-size:12.5px;color:var(--muted);margin-right:auto}",
        ".rrp-savemsg.ok{color:var(--brand)}",
        "body.rs-app.light .rrp-savemsg.ok{color:var(--brand-d)}",
        ".rrp-savemsg.bad{color:var(--amber)}",
        ".rrp-warnbanner{background:color-mix(in srgb,var(--amber) 12%,transparent);border:1px solid color-mix(in srgb,var(--amber) 40%,transparent);border-radius:12px;padding:12px 15px;font-size:12.5px;color:var(--ink);line-height:1.55;margin-bottom:16px}",
        ".rrp-fresh{display:flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:14px;flex-wrap:wrap}",
        ".rrp-fresh b{color:var(--ink);font-weight:700}",
        ".rrp-fresh .dot{width:7px;height:7px;border-radius:50%;background:var(--brand);flex:0 0 auto;box-shadow:0 0 0 3px var(--brand-glow)}",
        ".rrp-fresh .dot.stale{background:var(--amber);box-shadow:0 0 0 3px color-mix(in srgb,var(--amber) 20%,transparent)}",
        ".rrp-fresh span:nth-of-type(2){flex:1;min-width:220px}",
        ".rrp-freshbtn{border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);border-radius:9px;padding:6px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}",
        ".rrp-freshbtn:hover:not(:disabled){border-color:var(--brand)}",
        ".rrp-freshbtn:disabled{opacity:.6;cursor:default}",
        ".rrp-rgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-top:12px}",
        "@media(max-width:900px){.rrp-rgrid{grid-template-columns:minmax(0,1fr)}}",
        // ---- answer statistics (N3/N4/N5) ----
        ".ra-sechd{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin:22px 0 0}",
        ".ra-sechd h3{margin:0;font-size:15px;font-weight:800;letter-spacing:-.2px}",
        ".ra-sechd .rrp-seg{margin-bottom:0}",
        ".ra-cardhd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 10px}",
        ".ra-cardhd.pad{padding:13px 15px 9px;margin:0}",
        ".ra-cardhd h4{margin:0;font-size:13.5px;font-weight:800}",
        ".ra-sub{font-size:11.5px;font-weight:700;color:var(--faint)}",
        ".ra-hint{padding:9px 15px 12px;font-size:11.5px;color:var(--faint);border-top:1px solid var(--line)}",
        ".ra-none{color:var(--faint);padding:14px;font-size:12.5px}",
        ".ra-none-i{color:var(--faint);font-style:italic}",
        // the reason bar gains a % column, so the grid gets a 4th track
        ".rrp-card .rrp-bars{margin-bottom:0}",
        ".rrp-bar{grid-template-columns:200px 1fr 34px 38px}",
        ".ra-pct{font-style:normal;font-size:11px;font-weight:700;color:var(--faint);text-align:right;font-variant-numeric:tabular-nums}",
        ".ra-ftbl tbody tr{cursor:pointer}",
        ".ra-ftbl tbody tr:hover{background:var(--panel-2)}",
        ".ra-ftbl tr.on{background:var(--panel-2)}",
        ".ra-ftbl tr.on td{font-weight:800}",
        ".ra-chev{color:var(--faint);font-weight:800;width:22px}",
        // the reason strings run long ("Elderly customer (not comfortable with technology)");
        // clip them here rather than making a half-width card scroll sideways
        ".ra-ftbl{table-layout:fixed;width:100%}",
        ".ra-ftbl td,.ra-ftbl th{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
        ".ra-top{color:var(--muted)}",
        ".ra-nocrew{color:var(--faint);border-bottom:1px dotted var(--line-2);cursor:help}",
        ".ra-drill{margin-top:12px;padding:0;border-color:var(--brand)}",
        ".ra-drillgrid{display:grid;grid-template-columns:minmax(240px,340px) minmax(0,1fr);gap:0;align-items:start}",
        ".ra-drillbars{padding:14px 16px;border-right:1px solid var(--line)}",
        "@media(max-width:900px){.ra-drillgrid{grid-template-columns:minmax(0,1fr)}.ra-drillbars{border-right:0;border-bottom:1px solid var(--line)}}",
        ".ra-close{font:inherit;font-size:11.5px;font-weight:700;color:var(--muted);background:var(--panel-2);border:1px solid var(--line-2);border-radius:8px;padding:4px 10px;cursor:pointer}",
        ".ra-close:hover{color:var(--ink)}",
        ".ra-note{color:var(--muted);font-size:12px;max-width:340px}",
        ".ra-dot{color:var(--faint);margin:0 6px}",
        ".ra-done td{opacity:.6}",
        ".s-wait{background:rgba(224,145,42,.18);color:#e0912a}",
        ".rrp-exbtn{font:inherit;font-size:11.5px;font-weight:700;color:var(--brand-ink);background:var(--brand);border:0;border-radius:8px;padding:5px 11px;cursor:pointer}",
        ".rrp-exbtn:hover{background:var(--brand-d)}",
        ".rrp-exform{display:inline-flex;gap:6px;align-items:center;flex-wrap:wrap}",
        ".rrp-exform select,.rrp-exform input{font:inherit;font-size:12px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:7px;padding:5px 8px}",
        ".rrp-exform input{min-width:130px}",
        ".rrp-exform .rrp-exgo{background:var(--brand);color:var(--brand-ink);border:0;border-radius:7px;padding:5px 10px;font-weight:700;cursor:pointer}",
        ".rrp-exform .rrp-exgo:disabled{opacity:.6;cursor:default}",
        ".rrp-exform .rrp-exno{background:transparent;border:1px solid var(--line-2);color:var(--muted);border-radius:7px;padding:5px 8px;cursor:pointer}",
        "@media(max-width:820px){.rrp-row{grid-template-columns:56px 70px 1fr 90px}.rrp-row .cust,.rrp-row .lnk{display:none}.rrp-loc{grid-template-columns:18px minmax(0,1fr) 28px}.rrp-loc input[type=text].url{grid-column:2/4}.rrp-plat{grid-template-columns:36px minmax(0,1fr) 28px}.rrp-plat .url{grid-column:2/4}}"
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = "";   // clear the shell's "Loading…" spinner before mounting
    var root = document.createElement("div"); root.className = "rrp rrp-v" + (RRP.view || "log"); host.appendChild(root);

    // ---------- relay reads: bridge proxy FIRST, direct JSONP as FALLBACK ----------
    // The direct <script src="script.google.com/..."> path breaks PER USER — a stale Google
    // session or an extension blocking script.google.com fails the script load ("load error",
    // seen on quality@ 2026-07-15) even while the relay itself is healthy. The bridge works for
    // everyone who can open this page at all (it serves every other number they see), so reads
    // go through /api/_rrp and fall back to direct JSONP only if the bridge call fails (e.g.
    // mid-redeploy). The proxy also caches ~30s server-side, shielding the relay's 40-50s
    // cold start from multi-user bursts.
    async function relayRead(fresh) {
      try { return await ZTZ.api("/api/_rrp?req=reviewData" + (fresh ? "&fresh=1" : "")); }
      catch (e1) {
        try { return await jsonp(RRP_RELAY + "?req=reviewData" + (fresh ? "&fresh=1" : "")); }
        catch (e2) { throw new Error("bridge: " + (e1 && e1.message || e1) + " · direct: " + (e2 && e2.message || e2)); }
      }
    }
    function jsonp(url) {
      return new Promise(function (resolve, reject) {
        var cb = "__rrcb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
        var s = document.createElement("script"); var done = false;
        var clean = function () { try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); };
        var timer = setTimeout(function () { if (!done) { done = true; clean(); reject(new Error("timeout")); } }, 60000);   // relay cold-starts + reads several sheets (log/responses/config) + the 3-day calendar tab + live Calendar — ~40-50s cold
        window[cb] = function (d) { if (done) return; done = true; clearTimeout(timer); clean(); resolve(d); };
        s.onerror = function () { if (done) return; done = true; clearTimeout(timer); clean(); reject(new Error("load error")); };
        s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + cb;
        document.head.appendChild(s);
      });
    }

    // ---------- per-platform goal progress (warehouse) for the link picker ----------
    async function loadGoals() {
      if (RRP.goals) return RRP.goals;
      try {
        var rc = await RS.load("review_counts"), rg = await RS.load("review_goals");
        var num = function (v) { return (v == null || isNaN(v)) ? 0 : +v; };
        var nk = function (s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, ""); };
        var rcDates = [].concat.apply([], rc.map(function (r) { return String(r.Date || "").slice(0, 10); }));
        var lastSnap = rcDates.filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort().pop();
        var now = {}; rc.forEach(function (r) { if (String(r.Date || "").slice(0, 10) === lastSnap) { var k = nk(r.Platform); now[k] = (now[k] || 0) + num(r["Number of Reviews"]); } });
        var gDates = rg.map(function (r) { return String(r.Date || "").slice(0, 10); }).filter(function (d) { return /^\d{4}-\d{2}-\d{2}$/.test(d); }).sort();
        var todayIso = new Date().toISOString().slice(0, 10);
        var goalDate = gDates.find(function (d) { return d > todayIso; }) || gDates.pop();
        var goal = {}; rg.forEach(function (r) { if (String(r.Date || "").slice(0, 10) === goalDate) { var k = nk(r.Platform); goal[k] = (goal[k] || 0) + num(r["Number of Reviews"]); } });
        RRP.goals = { now: now, goal: goal, snap: lastSnap, goalDate: goalDate, nk: nk };
      } catch (e) { RRP.goals = { now: {}, goal: {}, nk: function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, ""); } }; }
      return RRP.goals;
    }

    // ---------- per-job reviews (warehouse) for Response Analysis ----------
    // A job that already GOT a review needs no explanation (Tornike 2026-07-16). The review register
    // is fct_reviews_breakdown — EVERY review event (counting or not), keyed by "Request Joinkey" =
    // "<COMPANY> <request #>" (company-scoped so Tuji never cross-matches). The reminder bot speaks
    // CALENDAR JOB CODES ("LM20-1004"), and calendar_events carries both job_code + request_no —
    // so the chain is: bot job code → calendar link → request # → "ZIP TO ZIP <req>" review key.
    // Validated end-to-end 2026-07-16: 1,725 job codes resolve to reviews this way.
    // Warehouse-refreshed: a review written since the last pipeline run isn't matched yet.
    if (window.RS && RS.DATASETS && !RS.DATASETS.calendar_events_link) {
      RS.DATASETS.calendar_events_link = {
        table: "calendar_events",
        cols: ["job_code", "request_no"],   // payload contract — the 2-column link only
      };
    }
    // Contact details for the "promised to write later" follow-up list. 180-day slice
    // (~2.4k rows) built by src/job_overview.py, so chasing a promised review doesn't
    // mean shipping the whole calendar to the browser.
    if (window.RS && RS.DATASETS && !RS.DATASETS.recent_job_contact) {
      RS.DATASETS.recent_job_contact = {
        table: "fct_recent_job_contact",
        cols: ["Job Code", "Job No", "Job Date", "Customer", "Customer Mobile", "Customer Email"],
      };
    }
    async function loadJobReviews() {
      try {
        var loaded = await Promise.all([RS.load("reviews_breakdown"), RS.load("calendar_events_link")]);
        var rb = loaded[0], cal = loaded[1];
        var set = {}; (rb || []).forEach(function (r) {
          var k = jobKey(r["Request Joinkey"]); if (!k) return;
          var o = set[k] || (set[k] = { n: 0, src: "" });
          o.n += (+(r["Number of Reviews"] || 1) || 1);
          if (!o.src && r.Source) o.src = String(r.Source);
        });
        var c2r = {}; (cal || []).forEach(function (r) {
          var ck = jobKey(r.job_code), rk = jobKey(r.request_no);
          if (ck && rk && !c2r[ck]) c2r[ck] = rk;
        });
        RRP.revIdx = { set: set, c2r: c2r };
        RRP.revErr = null;
      } catch (e) { if (!RRP.revIdx) RRP.revIdx = null; RRP.revErr = String(e && e.message || e); }
      return RRP.revIdx;
    }
    // Contact index for the follow-up list, keyed by BOTH the calendar job code and the
    // request # — the relay logs whichever the calendar carried, and a Request # can
    // itself be a job code. Never blocks the page: no contacts just means no phone column.
    async function loadContacts() {
      if (RRP.contactIdx) return RRP.contactIdx;
      try {
        var rows = await RS.load("recent_job_contact");
        var ix = {};
        (rows || []).forEach(function (r) {
          var rec = { name: r["Customer"] || "", mobile: r["Customer Mobile"] || "", email: r["Customer Email"] || "" };
          if (!rec.mobile && !rec.email && !rec.name) return;
          var a = jobKey(r["Job Code"]), b = jobKey(r["Job No"]);
          if (a && !ix[a]) ix[a] = rec;
          if (b && !ix[b]) ix[b] = rec;
        });
        RRP.contactIdx = ix;
      } catch (e) { RRP.contactIdx = {}; }
      return RRP.contactIdx;
    }
    // review lookup for one bot job key — tries the job code directly (closings sometimes record
    // the code as the Request #), then the calendar-linked request #. ZIP TO ZIP scope only.
    function reviewFor(k) {
      var ix = RRP.revIdx; if (!ix || !k) return null;
      return ix.set["ZIP TO ZIP " + k] || (ix.c2r[k] ? ix.set["ZIP TO ZIP " + ix.c2r[k]] : null) || null;
    }

    async function ensureData(force) {
      if (RRP.dataFresh && !force) return;   // already have a FRESH fetch this page-load
      RRP.err = null;
      try {
        var d = await relayRead(force);   // manual Refresh punches through the proxy cache AND the relay's 60s schedule cache
        RRP.data = d; RRP.dataFresh = true; RRP.fromCache = false; RRP.fetchedAt = Date.now(); rrpCacheWrite(d);
      } catch (e) {
        RRP.err = e.message || String(e);   // keep any cached RRP.data so the page still shows the last schedule
      }
      if (RRP.data && RRP.data.config && RRP.data.config.google && RRP.data.config.google.length) RRP.cfgSource = "live";
      else if (!RRP.cfgSource) RRP.cfgSource = "seed";
    }

    // ---------- ET time helpers ----------
    function etDay(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-US", { timeZone: RRP_TZ, weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
    function etDayKey(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleDateString("en-CA", { timeZone: RRP_TZ }); }
    function etTime(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-US", { timeZone: RRP_TZ, hour: "numeric", minute: "2-digit" }); }

    function statusPill(s) {
      s = String(s || "");
      if (/^sent/i.test(s)) return '<span class="pill s-sent">Sent</span>';
      if (/skip/i.test(s)) return '<span class="pill s-skip">No Slack ID</span>';
      if (/error/i.test(s)) return '<span class="pill s-err" title="' + esc(s) + '">Error</span>';
      return '<span class="pill">' + esc(s) + "</span>";
    }

    // Test-run rows go to the requestor's own DM (the REVIEW_TEST_SLACK_ID values), never a
    // real foreman — hide them so the log shows only genuine sends. Real foreman IDs pass through.
    var RRP_TEST_DMS = { "U044DL697CN": 1, "U06KWS62277": 1 };
    function cleanLog() { return ((RRP.data && RRP.data.log) || []).filter(function (r) { return !RRP_TEST_DMS[r.sentTo]; }); }

    // ---------- toolbar (segmented) ----------
    function toolbar() {
      var views = [["log", "Daily Jobs"], ["reasons", "Missed-review reasons"], ["links", "Settings"]];
      return '<div class="rrp-seg">' + views.map(function (v) {
        return '<button data-v="' + v[0] + '"' + (RRP.view === v[0] ? ' class="on"' : "") + ">" + v[1] + "</button>";
      }).join("") + "</div>";
    }

    // ---------- KPI tiles (today) ----------
    function kpis() {
      var log = cleanLog();
      var todayKey = etDayKey(new Date().toISOString());
      var today = log.filter(function (r) { return etDayKey(r.ts) === todayKey; });
      var sent = today.filter(function (r) { return /^sent/i.test(r.status); });
      var skipped = today.filter(function (r) { return /skip/i.test(r.status); });
      var foremen = {}; sent.forEach(function (r) { foremen[r.email] = 1; });
      var jobs = {}; sent.forEach(function (r) { if (r.job) jobs[r.job] = 1; });
      var reasons = ((RRP.data && RRP.data.responses) || []).filter(function (r) { return etDayKey(r.ts) === todayKey; });
      var tiles = [
        { b: N(sent.length), s: "Reminders sent", sm: "today", cls: "good" },
        { b: N(Object.keys(foremen).length), s: "Foremen reached", sm: "today" },
        { b: N(Object.keys(jobs).length), s: "Jobs covered", sm: "today" },
        { b: N(skipped.length), s: "Skipped", sm: "no Slack ID", cls: skipped.length ? "warn" : "" },
        { b: N(reasons.length), s: "Reasons captured", sm: "today" }
      ];
      return '<div class="rrp-kpis">' + tiles.map(function (t) {
        return '<div class="rrp-kpi ' + (t.cls || "") + '"><b>' + t.b + "</b><span>" + t.s + "</span><small>" + t.sm + "</small></div>";
      }).join("") + "</div>";
    }

    // ---------- SEND LOG — by day (collapsible, today open) → by job, with scheduled times ----------
    function jobMatches(j) {
      if (!RRP.fq) return true;
      var hay = (j.foreman + " " + j.customer + " " + j.job).toLowerCase();
      return hay.indexOf(RRP.fq.toLowerCase()) >= 0;
    }
    function logFilters() {
      return '<div class="rrp-filters"><input id="rrpQ" type="text" placeholder="Search foreman / customer / job…" value="' + esc(RRP.fq) + '"></div>';
    }
    function fmtT(iso) { var d = new Date(iso); return isNaN(d) ? "" : d.toLocaleTimeString("en-US", { timeZone: RRP_TZ, hour: "numeric", minute: "2-digit" }); }
    function nowLabel() { return "🕒 Now " + new Date().toLocaleTimeString("en-US", { timeZone: RRP_TZ, hour: "numeric", minute: "2-digit" }) + " · New Jersey"; }
    // shift a YYYY-MM-DD key by n calendar days (UTC math on the date parts → no tz drift)
    function shiftKey(key, n) { var p = String(key).split("-"); var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
    function dayHeadLabel(iso, isToday, isTomorrow, isYesterday) {
      var d = new Date(iso + "T12:00:00");
      var wd = isNaN(d) ? iso : d.toLocaleDateString("en-US", { timeZone: RRP_TZ, weekday: "short", month: "short", day: "numeric" });
      return (isToday ? "Today · " : isTomorrow ? "Tomorrow · " : isYesterday ? "Yesterday · " : "") + wd;
    }
    function viewLog() {
      var sched = RRP.data && RRP.data.schedule;
      if (!sched) return logFilters() + '<div class="rrp-empty">Waiting for the schedule feed — it appears once the Apps Script is redeployed with the new version. Jobs already sent still show under Refresh.</div>';
      return logFilters() + viewSchedule(sched);
    }

    // index the LOG (what actually fired) by day|foreman-morning and day|job|stage
    function indexLog() {
      var mBy = {}, midBy = {}, finBy = {};
      cleanLog().forEach(function (r) {
        if (r.type === "morning") mBy[etDayKey(r.ts) + "|" + r.email] = r;
        else if (r.job && r.type === "mid") midBy[etDayKey(r.ts) + "|" + r.job] = r;
        else if (r.job && r.type === "final") finBy[etDayKey(r.ts) + "|" + r.job] = r;
      });
      return { mBy: mBy, midBy: midBy, finBy: finBy };
    }
    function initials(name) {
      var p = String(name || "").trim().split(/\s+/); if (!p[0]) return "—";
      return ((p[0][0] || "") + (p.length > 1 ? (p[p.length - 1][0] || "") : "")).toUpperCase();
    }
    function viewSchedule(sched) {
      var idx = indexLog();
      var todayKey = etDayKey(new Date().toISOString());
      var yKey = shiftKey(todayKey, -1), tKey = shiftKey(todayKey, 1);
      return sched.map(function (D) {
        var isToday = D.day === todayKey, isTomorrow = D.day === tKey, isYesterday = D.day === yKey;
        var open = (D.day in RRP.openDays) ? RRP.openDays[D.day] : isToday;   // default: today open, yesterday/tomorrow closed
        var jobs = (D.jobs || []).filter(jobMatches);
        // group a day's jobs UNDER their foreman (parent), preserving first-seen order
        var order = [], byF = {};
        jobs.forEach(function (j) { var k = j.foremanEmail || j.foreman || "?"; if (!byF[k]) { byF[k] = []; order.push(k); } byF[k].push(j); });
        var body = "";
        if (open) body = order.length ? order.map(function (k) { return foremanGroup(D.day, byF[k], idx); }).join("")
          : '<div class="rrp-empty" style="margin:6px 0 14px;padding:20px">No Zip-to-Zip jobs ' + (isToday ? "today" : isYesterday ? "yesterday" : "scheduled") + ".</div>";
        var count = (D.jobs || []).length;
        return '<div class="rrp-dayhead' + (open ? " open" : "") + '" data-day="' + esc(D.day) + '">'
          + '<span class="rrp-daychev">' + (open ? "▾" : "▸") + "</span>"
          + "<h3>" + esc(dayHeadLabel(D.day, isToday, isTomorrow, isYesterday)) + "</h3>"
          + "<span>" + count + " job" + (count === 1 ? "" : "s") + (open && order.length ? " · " + order.length + " foreman" + (order.length === 1 ? "" : "s") : "") + "</span></div>" + body;
      }).join("");
    }
    // "View message sent" — the exact Slack text if the bot logged it, else the actual clickable
    // links reconstructed from what went out + the current Settings. Only for stages that fired.
    function linkify(text) {
      return esc(text).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
    }
    function reconstructLinks(label) {
      var cfg = (RRP.data && RRP.data.config && RRP.data.config.google) ? RRP.data.config : RRP_SEED;
      var out = [];
      var gm = String(label).match(/Google\(([^)]+)\)/);
      if (gm) { var gn = gm[1].trim(); var g = (cfg.google || []).filter(function (x) { return x.name === gn; })[0]; out.push({ name: "Google (" + gn + ")", url: g ? g.url : "" }); }
      (cfg.platforms || []).forEach(function (p) { if (p.name && label.indexOf(p.name) >= 0) out.push({ name: p.name, url: p.url }); });
      return out;
    }
    function msgPanel(s) {
      if (s.state !== "sent") return "";
      var body;
      if (s.row && s.row.message) body = '<div class="rrp-msgbody">' + linkify(s.row.message) + "</div>";
      else if (s.row && s.row.links) {
        var links = reconstructLinks(s.row.links);
        body = '<div class="rrp-msgbody"><div class="rrp-msgnote">The exact text isn’t recorded for this send — here are the review links it included:</div><div class="rrp-linkchips">'
          + links.map(function (l) { return l.url ? '<a class="rrp-linkchip" href="' + esc(l.url) + '" target="_blank" rel="noopener">' + esc(l.name) + " →</a>" : '<span class="rrp-linkchip off">' + esc(l.name) + "</span>"; }).join("") + "</div></div>";
      } else return "";
      return '<details class="rrp-msg"><summary>👁 View message sent</summary>' + body + "</details>";
    }
    // "View event" — the calendar event behind this reminder, so she can check a job at a glance
    // (customer, addresses, phone, ACT). Details ride in the schedule feed once the relay is redeployed;
    // absent on the old relay, in which case the button simply doesn't show.
    function eventPanel(j) {
      var e = j.detail; if (!e) return "";
      var when = j.start ? (etDay(j.start) + " · " + fmtT(j.start)) : "";
      var actTxt = e.act ? (e.act + " h" + (e.estHours ? " · est " + e.estHours + " h" : "")) : "";
      var rows = [
        ["When", when], ["From", e.from], ["To", e.to], ["Phone", e.phone],
        ["Type", e.movingType], ["Trucks / Vans", e.trucks], ["ACT / Est.", actTxt], ["Foreman", j.foreman]
      ].filter(function (kv) { return kv[1]; });
      var dl = rows.map(function (kv) {
        return '<div style="display:grid;grid-template-columns:120px 1fr;gap:10px;padding:2px 0;font-size:12.5px">'
          + '<span style="color:var(--faint);font-weight:700">' + esc(kv[0]) + '</span><span>' + linkify(String(kv[1])) + "</span></div>";
      }).join("");
      var idline = e.eventId ? '<div class="rrp-msgnote" style="margin-top:8px">Event ID · ' + esc(e.eventId) + "</div>" : "";
      return '<details class="rrp-msg" style="margin:10px 15px 6px 20px"><summary>👁 View event</summary><div class="rrp-msgbody">' + dl + idline + "</div></details>";
    }
    // ---- foreman-grouped schedule: foreman (parent) → their jobs → each job's reminders ----
    function mkStage(label, atIso, row) {
      if (!atIso) return { label: label, state: "na" };
      var now = Date.now(), st, at = atIso;
      if (row && /^sent/i.test(row.status)) { st = "sent"; at = row.ts; }
      else if (row && /skip/i.test(row.status)) st = "skip";
      else if (row && /error/i.test(row.status)) st = "err";
      else st = (new Date(atIso).getTime() <= now) ? "due" : "sched";
      return { label: label, state: st, at: at, sched: atIso, row: row };
    }
    function stagePill(s) {
      if (s.state === "na") return '<span class="rrp-stage st-na">' + s.label + " —</span>";
      var t = fmtT(s.state === "sent" ? s.at : s.sched);
      return '<span class="rrp-stage st-' + s.state + '">' + s.label + " <b>" + esc(t) + "</b></span>";
    }
    // one reminder detail line (morning/mid/final): time · label · status/reason · message panel
    function stageDetailRow(s, j) {
      var ty = TYPE[s.label.toLowerCase()] || { c: "" };
      if (s.state === "na") {
        var es = j && j.detail && j.detail.endSource;
        var msg = es === "cal-unreachable" ? "on hold — the job’s scheduled end time can’t be read from the calendar yet (mid/final resume once it’s reachable)"
          : es === "no-match" ? "on hold — no matching calendar event was found for this job"
          : "not sent — this job has no end time (ACT), so only the morning summary applies";
        return '<div class="rrp-evrow"><span class="tm">—</span><span class="pill ' + ty.c + '">' + s.label + '</span><span class="rrp-evlnk">' + msg + "</span></div>";
      }
      var status = s.state === "sent" ? statusPill("sent") : s.state === "skip" ? statusPill("skipped") : s.state === "err" ? statusPill("error")
        : '<span class="pill s-sched">' + (s.state === "due" ? "Pending" : "Scheduled") + "</span>";
      var line = s.state === "sent" ? ("sent at " + fmtT(s.at)) : ("will send at " + fmtT(s.sched));
      return '<div class="rrp-evrow"><span class="tm">' + esc(fmtT(s.sched)) + '</span><span class="pill ' + ty.c + '">' + s.label + '</span><span class="rrp-evlnk">' + esc(line) + "</span>" + status + "</div>" + msgPanel(s);
    }
    // foreman parent: header (name · N jobs) + the shared MORNING reminder + each job (expandable)
    function foremanGroup(dayKey, jobs, idx) {
      var j0 = jobs[0];
      var name = j0.foreman || j0.foremanEmail || "—";
      var mStage = mkStage("Morning", j0.morningAt, idx.mBy[dayKey + "|" + j0.foremanEmail]);
      var warn = j0.hasSlack ? "" : ' <span class="rrp-noid">no Slack ID</span>';
      var head = '<div class="rrp-fhead">'
        + '<span class="rrp-favatar">' + esc(initials(name)) + "</span>"
        + '<span class="rrp-fname">' + esc(name) + warn + "</span>"
        + '<span class="rrp-fmeta">' + jobs.length + " job" + (jobs.length === 1 ? "" : "s") + "</span></div>";
      var morningRow = '<div class="rrp-morning">' + stageDetailRow(mStage, j0) + "</div>";
      var jobRows = jobs.map(function (j) { return jobRow(dayKey, j, idx); }).join("");
      return '<div class="rrp-fgroup">' + head + morningRow + jobRows + "</div>";
    }
    // one job under a foreman: customer + its Mid/Final pills; expand for View event + reminder detail
    function jobRow(dayKey, j, idx) {
      // Regular-moving jobs get NO review reminders (relay flags reviewEligible:false) — a consolidated
      // long-distance haul is delivered days later by a different crew, so the on-site review ask doesn't
      // apply. Straight & Local still get reminders. Show that plainly instead of phantom Mid/Final chips.
      // (Undefined flag = older relay payload → keep the normal reminders.)
      var ld = j.reviewEligible === false;
      var midS = ld ? null : mkStage("Mid", j.midAt, idx.midBy[dayKey + "|" + j.job]);
      var finS = ld ? null : mkStage("Final", j.finalAt, idx.finBy[dayKey + "|" + j.job]);
      var key = dayKey + "|" + j.job, open = !!RRP.openJobs[key];
      // Yelp jobs get a loud badge: the crew must NOT send a Yelp link (verbal ask + our links
      // instead), and the bot fires an extra pre-start warning 1h before the job. The field
      // arrives from the relay; older relay payloads simply have no flag — badge hidden.
      var yelpBadge = j.isYelp
        ? '<span style="display:inline-block;margin-left:7px;padding:1px 8px;border-radius:999px;background:#fbe6e7;color:#7a1f28;font-size:10.5px;font-weight:800;letter-spacing:.03em" title="Yelp customer — never send a Yelp review link. The bot warns the foreman 1h before start: ask verbally, send Google/Trustpilot/Facebook.">⚠ YELP — no Yelp link</span>'
        : "";
      var stages = ld
        ? '<span class="rrp-stage st-na" title="Regular move (consolidated long-distance) — delivered days later by a different crew, so the on-site review ask doesn’t apply. The bot sends no review reminders for these. Straight and local moves still get reminders.">🚚 Regular move · no reminder</span>'
        : stagePill(midS) + stagePill(finS);
      var head = '<div class="rrp-jrhead" data-job="' + esc(key) + '">'
        + '<span class="rrp-jrchev">' + (open ? "▾" : "▸") + "</span>"
        + '<span class="rrp-jrc">' + esc(j.customer || "—") + yelpBadge + "<small>" + esc(j.job) + (j.state ? " · " + esc(j.state) : "") + "</small></span>"
        + '<span class="rrp-jrstages">' + stages + "</span></div>";
      var detail = open ? '<div class="rrp-jobevents">' + eventPanel(j) + (ld ? "" : stageDetailRow(midS, j) + stageDetailRow(finS, j)) + "</div>" : "";
      return "<div>" + head + detail + "</div>";
    }

    // ---------- MISSED-REVIEW REASONS ----------
    // "how fresh is this?" — Tornike 2026-07-16. Three different clocks matter here and the page
    // used to show none of them: when WE last read the relay, whether this paint came from the
    // localStorage cache, and the fact that a foreman's answer needs a relay round-trip (the bot
    // writes the sheet immediately, but the relay caches its read ~30s at the bridge proxy).
    function freshBar() {
      var when = RRP.fetchedAt ? new Date(RRP.fetchedAt) : null;
      var t = when ? when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "—";
      var age = when ? Math.round((Date.now() - RRP.fetchedAt) / 60000) : null;
      var agoTx = age == null ? "" : age < 1 ? " · just now" : " · " + age + " min ago";
      return '<div class="rrp-fresh">'
        + '<span class="dot' + (RRP.fromCache ? " stale" : "") + '"></span>'
        + "<span><b>" + (RRP.fromCache ? "Showing your last saved copy" : "Live from the reminder bot") + "</b> — read at " + esc(t) + esc(agoTx) + ". "
        + "A foreman’s answer lands here within about a minute of them tapping it; hit <b>Refresh</b> to pull again.</span>"
        + '<button class="rrp-freshbtn" id="rrpFresh2">↻ Refresh now</button></div>';
    }
    function viewReasons() {
      var resp = (RRP.data && RRP.data.responses) || [];
      if (!resp.length) return freshBar() + '<div class="rrp-empty">No reasons yet. When a foreman taps “why no review?” on the final Slack nudge, it lands here.</div>';
      var freq = {}; resp.forEach(function (r) { var k = r.reason || "—"; freq[k] = (freq[k] || 0) + 1; });
      var fr = Object.keys(freq).map(function (k) { return { k: k, n: freq[k] }; }).sort(function (a, b) { return b.n - a.n; });
      var max = fr[0] ? fr[0].n : 1;
      var bars = '<div class="rrp-bars">' + fr.map(function (f) {
        return '<div class="rrp-bar"><span>' + esc(f.k) + '</span><span class="track"><i style="width:' + (f.n / max * 100).toFixed(0) + '%"></i></span><b>' + f.n + "</b></div>";
      }).join("") + "</div>";
      var tbl = '<div class="rrp-card"><table class="rrp-reasontbl"><thead><tr><th>When</th><th>Job</th><th>Foreman</th><th>Reason</th><th>Note</th></tr></thead><tbody>'
        + resp.slice(0, 120).map(function (r) {
          return "<tr><td>" + esc(etDay(r.ts) || String(r.date || "")) + "</td><td>" + esc(r.job || "—") + "</td><td>" + esc(r.foreman || "—")
            + '</td><td><span class="pill s-skip">' + esc(r.reason || "—") + "</span></td><td>" + esc(r.note || "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      return freshBar() + bars + tbl;
    }

    // ---------- RESPONSE ANALYSIS (reminder-feed, Tornike 2026-07-16) ----------
    // Built entirely from the LIVE relay feed, not the warehouse — so it shows RECENT jobs the
    // warehouse hasn't ingested yet. "Recent jobs" = distinct jobs the bot sent a mid/final nudge
    // for in the last 7 days, EXCLUDING today (a job today can't fairly be judged yet). Each is
    // joined to the foreman's explanation (responses). The office can log a reason inline for any
    // of them — a job up to a week old can still be explained.
    var jobKey = function (j) { return String(j == null ? "" : j).trim().toUpperCase(); };
    function responseModel() {
      var log = cleanLog(), resp = (RRP.data && RRP.data.responses) || [];
      var todayKey = etDayKey(new Date().toISOString());
      var win = {}; for (var i = 1; i <= 7; i++) { var dt = new Date(); dt.setDate(dt.getDate() - i); win[etDayKey(dt.toISOString())] = i; }
      var byJob = {};
      log.forEach(function (r) {
        if (r.type !== "mid" && r.type !== "final") return;   // per-job review nudges (morning = per-foreman, no job)
        var dk = etDayKey(r.ts); if (dk === todayKey || !(dk in win)) return;
        var k = jobKey(r.job); if (!k) return;
        var o = byJob[k] || (byJob[k] = { job: r.job, foreman: r.foreman || "", customer: r.customer || "", day: dk });
        if (dk > o.day) o.day = dk;
        if (!o.foreman && r.foreman) o.foreman = r.foreman;
        if (!o.customer && r.customer) o.customer = r.customer;
      });
      var expl = {}; resp.forEach(function (r) { var k = jobKey(r.job); if (k && (!expl[k] || String(r.ts) > String(expl[k].ts))) expl[k] = r; });
      var jobs = Object.keys(byJob).map(function (k) { var o = byJob[k]; o.exp = expl[k] || null; o.rev = reviewFor(k); return o; })
        .sort(function (a, b) { return ((a.exp || a.rev) ? 1 : 0) - ((b.exp || b.rev) ? 1 : 0) || String(b.day).localeCompare(a.day); });
      return { jobs: jobs, resp: resp, winDays: Object.keys(win).sort().reverse() };
    }
    // ---------- ANSWER STATISTICS (N3/N4/N5) ----------
    // ONE answer per job — the latest — which is exactly how the worklist above resolves a
    // job's explanation. Without this a job answered twice (Misho's LD18-0130 was) counts
    // its reason twice and quietly inflates whatever it was answered with.
    function answerRows() {
      var resp = (RRP.data && RRP.data.responses) || [];
      var days = RRP.raPeriod == null ? 30 : RRP.raPeriod;
      var cut = "";
      if (days) { var d = new Date(); d.setDate(d.getDate() - days); cut = etDayKey(d.toISOString()); }
      var latest = {};
      resp.forEach(function (r) {
        var dk = etDayKey(r.ts);
        if (cut && dk && dk < cut) return;
        var k = jobKey(r.job) || ("ts:" + r.ts);
        if (!latest[k] || String(r.ts) > String(latest[k].ts)) latest[k] = r;
      });
      return Object.keys(latest).map(function (k) { return latest[k]; });
    }
    // The relay records whoever answered, and that is sometimes the raw email rather than the
    // crew name — which then shows up as its own "foreman" in the stats. The reminder log
    // carries both for every nudge, so it doubles as an email→name directory.
    function foremanName(v) {
      var s = String(v == null ? "" : v).trim();
      if (!s) return "—";
      if (s.indexOf("@") < 0) return s;
      var map = RRP._fmap;
      if (!map) {
        map = RRP._fmap = {};
        cleanLog().forEach(function (r) {
          var e = String(r.email || "").trim().toLowerCase(), n = String(r.foreman || "").trim();
          // only learn from rows that actually carry a NAME — a row whose foreman field is
          // itself an address teaches nothing and would map the email to itself
          if (e && n && n.indexOf("@") < 0 && e.indexOf(",") < 0 && !map[e]) map[e] = n;
        });
      }
      // a calendar foreman cell may hold "owner, foreman" — resolve each address separately,
      // otherwise the pair becomes its own phantom foreman in the stats
      return s.split(",").map(function (p) {
        p = p.trim(); if (!p) return "";
        return p.indexOf("@") < 0 ? p : (map[p.toLowerCase()] || p);
      }).filter(Boolean).join(", ") || s;
    }
    // an address that survived foremanName has nobody behind it in the crew sheet — say so
    // rather than showing a bare gmail with no explanation
    function foremanCell(v) {
      var n = foremanName(v);
      return n.indexOf("@") < 0 ? esc(n)
        : '<span class="ra-nocrew" title="Not in the fleet sheet’s Crew tab — add this email there with a name and it will show here">'
          + esc(n) + "</span>";
    }
    function periodLabel() {
      var d = RRP.raPeriod == null ? 30 : RRP.raPeriod;
      return d ? "last " + d + " days" : "all time";
    }
    function periodBar() {
      var cur = RRP.raPeriod == null ? 30 : RRP.raPeriod;
      return '<div class="rrp-seg ra-seg">' + [[7, "7 days"], [30, "30 days"], [0, "All time"]].map(function (o) {
        return '<button class="' + (cur === o[0] ? "on" : "") + '" data-rap="' + o[0] + '">' + o[1] + "</button>";
      }).join("") + "</div>";
    }
    function reasonBars(fr) {
      var max = fr[0] ? fr[0].n : 1, tot = fr.reduce(function (a, f) { return a + f.n; }, 0);
      return '<div class="rrp-bars">' + fr.map(function (f) {
        return '<div class="rrp-bar" title="' + esc(f.k) + '"><span>' + esc(f.k) + '</span><span class="track"><i style="width:'
          + (f.n / max * 100).toFixed(0) + '%"></i></span><b>' + f.n + '</b><em class="ra-pct">'
          + (tot ? Math.round(f.n / tot * 100) : 0) + "%</em></div>";
      }).join("") + "</div>";
    }
    function statsByForeman(rows) {
      var by = {};
      rows.forEach(function (r) {
        var f = foremanName(r.foreman);
        var o = by[f] || (by[f] = { f: f, n: 0, reasons: {} });
        o.n++;
        var k = r.reason || "—"; o.reasons[k] = (o.reasons[k] || 0) + 1;
      });
      return Object.keys(by).map(function (k) {
        var o = by[k];
        o.top = Object.keys(o.reasons).sort(function (a, b) { return o.reasons[b] - o.reasons[a]; })[0] || "—";
        return o;
      }).sort(function (a, b) { return b.n - a.n || a.f.localeCompare(b.f); });
    }
    // N3: the per-foreman table. Rows are clickable — that's N4.
    function foremanCard(rows, per) {
      var st = statsByForeman(rows), sel = RRP.raForeman || "";
      var body = st.length ? st.map(function (o) {
        return '<tr class="ra-frow' + (o.f === sel ? " on" : "") + '" data-raf="' + esc(o.f) + '">'
          + "<td>" + foremanCell(o.f) + '</td><td class="r"><b>' + o.n + '</b></td><td class="ra-top" title="' + esc(o.top) + '">' + esc(o.top)
          + '</td><td class="r ra-chev">' + (o.f === sel ? "▾" : "›") + "</td></tr>";
      }).join("") : '<tr><td colspan="4" class="ra-none">No answers in this period.</td></tr>';
      return '<div class="rrp-card" style="padding:0"><div class="ra-cardhd pad"><h4>By foreman</h4>'
        + '<span class="ra-sub">' + N(st.length) + " foreman" + (st.length === 1 ? "" : "en") + " · " + esc(per) + "</span></div>"
        + '<div style="overflow-x:auto"><table class="rrp-reasontbl ra-ftbl"><thead><tr><th>Foreman</th>'
        + '<th style="text-align:right">Answers</th><th>Most common reason</th><th></th></tr></thead><tbody>'
        + body + "</tbody></table></div>"
        + '<div class="ra-hint">Click a foreman to see his own breakdown.</div></div>';
    }
    // N4: the drill-down for the selected foreman — his reason mix + the jobs behind it.
    function foremanDrill(rows) {
      var sel = RRP.raForeman; if (!sel) return "";
      var mine = rows.filter(function (r) { return foremanName(r.foreman) === sel; });
      var freq = {}; mine.forEach(function (r) { var k = r.reason || "—"; freq[k] = (freq[k] || 0) + 1; });
      var fr = Object.keys(freq).map(function (k) { return { k: k, n: freq[k] }; }).sort(function (a, b) { return b.n - a.n; });
      var jobs = mine.slice().sort(function (a, b) { return String(b.ts).localeCompare(String(a.ts)); }).map(function (r) {
        return "<tr><td>" + esc(etDay(r.ts) || "—") + "</td><td>" + esc(r.job || "—") + "</td><td>" + esc(r.reason || "—")
          + '</td><td class="ra-note">' + esc(cleanNote(r.note) || "—") + "</td></tr>";
      }).join("");
      return '<div class="rrp-card ra-drill"><div class="ra-cardhd pad"><h4>' + esc(sel) + " — " + N(mine.length)
        + " answer" + (mine.length === 1 ? "" : "s") + " · " + esc(periodLabel()) + "</h4>"
        + '<button class="ra-close" id="raClose">✕ Close</button></div>'
        + '<div class="ra-drillgrid"><div class="ra-drillbars">' + reasonBars(fr) + "</div>"
        + '<div style="overflow-x:auto"><table class="rrp-reasontbl"><thead><tr><th>Answered</th><th>Job</th><th>Reason</th><th>Note</th></tr></thead><tbody>'
        + jobs + "</tbody></table></div></div></div>";
    }
    // the relay appends provenance to the note ("… — via portal (quality@…)"); useful in the
    // raw sheet, noise in a table that already has its own columns.
    function cleanNote(s) { return String(s == null ? "" : s).replace(/\s*—?\s*via portal\s*(\([^)]*\))?\s*$/i, "").trim(); }
    // N5: "the customer promised to write later" is a warm review, not a dead end — it only
    // pays off if somebody calls them back, so this list carries the phone/email.
    function promisedCard() {
      var resp = (RRP.data && RRP.data.responses) || [];
      var latest = {};
      resp.forEach(function (r) {
        var k = jobKey(r.job) || ("ts:" + r.ts);
        if (!latest[k] || String(r.ts) > String(latest[k].ts)) latest[k] = r;
      });
      var ix = RRP.contactIdx || {};
      var rows = Object.keys(latest).map(function (k) { return latest[k]; })
        .filter(function (r) { return /promised to write/i.test(String(r.reason || "")); })
        .map(function (r) {
          var k = jobKey(r.job), c = (k && ix[k]) || null, rv = reviewFor(k);
          var when = new Date(r.ts);
          var age = isNaN(when) ? null : Math.floor((Date.now() - when.getTime()) / 86400000);
          return { r: r, c: c, rev: rv, age: age };
        })
        .sort(function (a, b) { return (b.age || 0) - (a.age || 0); });
      var landed = rows.filter(function (x) { return x.rev; }).length;
      var body = rows.length ? rows.map(function (x) {
        var c = x.c || {}, tel = String(c.mobile || "").trim(), mail = String(c.email || "").trim();
        var contact = [
          tel ? '<a href="tel:' + esc(tel.replace(/[^0-9+]/g, "")) + '">' + esc(tel) + "</a>" : "",
          mail ? '<a href="mailto:' + esc(mail) + '">' + esc(mail) + "</a>" : "",
        ].filter(Boolean).join('<span class="ra-dot">·</span>') || '<span class="ra-none-i">no contact on file</span>';
        return '<tr' + (x.rev ? ' class="ra-done"' : "") + "><td>" + esc(etDay(x.r.ts) || "—")
          + '</td><td class="r">' + (x.age == null ? "—" : x.age + "d") + "</td><td>" + esc(x.r.job || "—")
          + "</td><td>" + esc(c.name || "—") + "</td><td>" + contact + "</td><td>" + foremanCell(x.r.foreman)
          + "</td><td>" + (x.rev ? '<span class="pill s-sent">★ Review landed</span>' : '<span class="pill s-wait">Still waiting</span>') + "</td></tr>";
      }).join("") : '<tr><td colspan="7" class="ra-none">Nobody has promised a review yet.</td></tr>';
      return '<div class="rrp-card" style="padding:0;margin-top:12px"><div class="ra-cardhd pad">'
        + "<h4>Promised a review — follow up</h4>"
        + '<span class="ra-sub">' + N(rows.length) + " customer" + (rows.length === 1 ? "" : "s")
        + (landed ? " · " + N(landed) + " already landed" : "") + " · all time</span></div>"
        + '<div style="overflow-x:auto"><table class="rrp-reasontbl"><thead><tr><th>Promised</th>'
        + '<th style="text-align:right">Age</th><th>Job</th><th>Customer</th><th>Contact</th><th>Foreman</th><th>Status</th>'
        + "</tr></thead><tbody>" + body + "</tbody></table></div>"
        + '<div class="ra-hint">Oldest first — these customers said yes, they just need reminding.</div></div>';
    }

    function viewResponse() {
      var m = responseModel(), jobs = m.jobs;
      var total = jobs.length, expd = jobs.filter(function (j) { return j.exp; }).length;
      var revJobs = jobs.filter(function (j) { return j.rev; });
      var revd = revJobs.length, revTot = revJobs.reduce(function (a, j) { return a + (j.rev.n || 1); }, 0);
      // a job is WAITING only if it has neither a review nor an explanation — a written review
      // answers the question by itself (Tornike 2026-07-16)
      var waiting = jobs.filter(function (j) { return !j.exp && !j.rev; }).length;
      var cov = total ? Math.round((total - waiting) / total * 100) : 0;
      // KPI row — reviewed jobs vs total review events are SEPARATE numbers (10 reviews on 1 job → 1 and 10)
      var kp = '<div class="rrp-kpis">'
        + '<div class="rrp-kpi"><b>' + N(total) + '</b><span>Recent jobs</span><small>yesterday → 7 days ago</small></div>'
        + '<div class="rrp-kpi good"><b>' + N(revd) + '</b><span>Reviewed jobs</span><small>review written — no reason needed</small></div>'
        + '<div class="rrp-kpi good"><b>' + N(revTot) + '</b><span>Reviews written</span><small>total, on those ' + N(revd) + ' job' + (revd === 1 ? "" : "s") + '</small></div>'
        + '<div class="rrp-kpi good"><b>' + N(expd) + '</b><span>Explained</span><small>foreman told us why</small></div>'
        + '<div class="rrp-kpi warn"><b>' + N(waiting) + '</b><span>Waiting</span><small>no review, no reason</small></div>'
        + '<div class="rrp-kpi"><b>' + cov + '%</b><span>Response rate</span><small>reviewed + explained ÷ recent</small></div></div>';
      // ---- answer statistics (N3/N4, quality team via Tornike 2026-07-20) ----
      // Two bugs fixed here at the same time: these bars used to count ALL-TIME answers
      // while the KPIs above them covered 7 days (unlabelled), and they double-counted a
      // job answered twice. Now the period is explicit and picked by the user, and
      // answerRows() keeps one answer per job.
      var arows = answerRows(), aPer = periodLabel();
      var freq = {}; arows.forEach(function (r) { var k = r.reason || "—"; freq[k] = (freq[k] || 0) + 1; });
      var fr = Object.keys(freq).map(function (k) { return { k: k, n: freq[k] }; }).sort(function (a, b) { return b.n - a.n; });
      var bars = '<div class="rrp-card" style="padding:14px 16px"><div class="ra-cardhd"><h4>Why reviews are missing</h4>'
        + '<span class="ra-sub">' + N(arows.length) + " answer" + (arows.length === 1 ? "" : "s") + " · " + esc(aPer) + "</span></div>"
        + (fr.length ? reasonBars(fr) : '<div class="ra-none">No answers in this period.</div>') + "</div>";
      var fmTbl = foremanCard(arows, aPer);
      // by-day response rate (reviewed OR explained both count as answered)
      var dayRows = m.winDays.map(function (dk) {
        var day = jobs.filter(function (j) { return j.day === dk; });
        var rv = day.filter(function (j) { return j.rev; }).length;
        var e = day.filter(function (j) { return j.exp; }).length;
        var ok = day.filter(function (j) { return j.exp || j.rev; }).length;
        return "<tr><td>" + esc(etDay(dk + "T12:00:00") || dk) + '</td><td class="r">' + day.length + '</td><td class="r">' + rv + '</td><td class="r">' + e + '</td><td class="r">' + (day.length ? Math.round(ok / day.length * 100) + "%" : "—") + "</td></tr>";
      }).join("");
      var dayTbl = '<div class="rrp-card" style="padding:0"><table class="rrp-reasontbl"><thead><tr><th>Day</th><th style="text-align:right">Jobs</th><th style="text-align:right">Reviewed</th><th style="text-align:right">Explained</th><th style="text-align:right">Rate</th></tr></thead><tbody>' + (dayRows || '<tr><td colspan="5" style="color:var(--faint);padding:14px">No recent jobs.</td></tr>') + "</tbody></table></div>";
      // worklist with inline explain (waiting first)
      var reasons = (RRP.data && RRP.data.config && RRP.data.config.reasons) || RRP_SEED.reasons;
      var work = jobs.map(function (j, i) {
        var right;
        if (j.rev) {
          // review written → nothing to explain; no Add-reason button (Tornike 2026-07-16)
          right = '<span class="pill s-sent" title="' + esc(j.rev.src ? "via " + j.rev.src : "review on file") + '">★ Review written' + (j.rev.n > 1 ? " ×" + j.rev.n : "") + "</span>"
            + (j.exp ? ' <span class="pill s-skip" title="' + esc(j.exp.note || "") + '">' + esc(j.exp.reason || "explained") + "</span>" : "");
        } else if (j.exp) {
          right = '<span class="pill s-sent" title="' + esc(j.exp.note || "") + '">✓ ' + esc(j.exp.reason || "explained") + "</span>";
        } else {
          right = '<button class="rrp-exbtn" data-exi="' + i + '">Add reason</button>';
        }
        return "<tr><td>" + esc(etDay(j.day + "T12:00:00") || j.day) + '</td><td>' + esc(j.job || "—")
          + '</td><td>' + esc(j.customer || "—") + '</td><td>' + esc(j.foreman || "—") + '</td><td>' + right + "</td></tr>";
      }).join("");
      var revNote = '<div class="rrp-msgnote" style="margin:8px 2px 0">Reviews are matched from the warehouse review register (every review event, counting or not), joined to the job by its Request # via the calendar link. The register refreshes with the data pipeline — a review written since the last refresh isn’t matched yet, so a freshly-reviewed job can briefly show as waiting.'
        + (RRP.revErr ? ' <b style="color:#e0912a">Review matching is OFF right now (' + esc(RRP.revErr) + ') — every unexplained job shows as waiting.</b>' : "") + "</div>";
      var workTbl = '<div class="rrp-card" style="padding:0;margin-top:12px"><div style="padding:12px 15px 4px;font-size:14px;font-weight:800">Recent jobs — ' + N(waiting) + ' waiting for a reason</div>'
        + '<div style="overflow-x:auto"><table class="rrp-reasontbl" id="rrpWork"><thead><tr><th>Date</th><th>Job</th><th>Customer</th><th>Foreman</th><th>Status / Reason</th></tr></thead><tbody>'
        + (work || '<tr><td colspan="5" style="color:var(--faint);padding:14px">No jobs in the last 7 days. As the bot sends nudges, they land here.</td></tr>') + "</tbody></table></div></div>" + revNote;
      // stash the model + reason list for wireResponse
      RRP._rm = { jobs: jobs, reasons: reasons };
      return freshBar() + kp
        + '<div class="ra-sechd"><h3>Answer statistics</h3>' + periodBar() + "</div>"
        + '<div class="rrp-rgrid">' + bars + fmTbl + "</div>"
        + foremanDrill(arows)
        + promisedCard()
        + dayTbl + workTbl;
    }
    // POST a reason for a recent job, honestly (awaited bridge write, real error), then refresh.
    function wireResponse() {
      // answer-statistics controls: period toggle + foreman drill-down (click again to close)
      Array.prototype.forEach.call(root.querySelectorAll("[data-rap]"), function (b) {
        b.onclick = function () { RRP.raPeriod = +b.getAttribute("data-rap"); paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-raf]"), function (t) {
        t.onclick = function () {
          var f = t.getAttribute("data-raf");
          RRP.raForeman = (RRP.raForeman === f) ? null : f;
          paint();
          if (RRP.raForeman) { var d = root.querySelector(".ra-drill"); if (d && d.scrollIntoView) d.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
        };
      });
      var rc = root.querySelector("#raClose"); if (rc) rc.onclick = function () { RRP.raForeman = null; paint(); };
      var rm = RRP._rm; if (!rm) return;
      Array.prototype.forEach.call(root.querySelectorAll("[data-exi]"), function (b) {
        b.onclick = function () {
          var j = rm.jobs[+b.getAttribute("data-exi")]; if (!j) return;
          var opts = rm.reasons.map(function (r) { return '<option>' + esc(r) + "</option>"; }).join("");
          var f = document.createElement("span"); f.className = "rrp-exform";
          f.innerHTML = '<select class="rrp-exr">' + opts + '</select><input class="rrp-exn" placeholder="note (optional)"><button class="rrp-exgo">Save</button><button class="rrp-exno">✕</button>';
          b.replaceWith(f);
          f.querySelector(".rrp-exno").onclick = function () { paint(); };
          f.querySelector(".rrp-exgo").onclick = function () {
            var go = f.querySelector(".rrp-exgo"); go.disabled = true; go.textContent = "Saving…";
            var who = ""; try { who = (window.ZTZ && ZTZ.email && ZTZ.email()) || ""; } catch (e) {}
            var body = JSON.stringify({ kind: "reviewReason", jobCode: String(j.job || ""), foreman: String(j.foreman || ""),
              date: String(j.day || ""), reason: f.querySelector(".rrp-exr").value,
              note: (f.querySelector(".rrp-exn").value.trim() ? f.querySelector(".rrp-exn").value.trim() + " — " : "") + "via portal" + (who ? " (" + who + ")" : "") });
            fetch(ZTZ.API + "/api/_rrp", { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8", "Authorization": "Bearer " + ZTZ.getToken() }, body: body })
              .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status);
                RRP.dataFresh = false; return ensureData(true); })
              .then(function () { paint(); }, function (e) {
                go.disabled = false; go.textContent = "Save";
                var w = f.querySelector(".rrp-exerr") || (function () { var d = document.createElement("div"); d.className = "rrp-exerr"; d.style.cssText = "color:#e5484d;font-size:11px;font-weight:700;margin-top:4px"; f.appendChild(d); return d; })();
                w.textContent = "Couldn't save (" + (e && e.message || e) + ") — nothing recorded.";
              });
          };
        };
      });
    }

    // ---------- REVIEW LINKS (editable control) ----------
    // canonical signature of "what actually gets sent" — active Google URL per state + platform
    // on/off — so a Save can be CONFIRMED by reading the config back (no-cors writes are opaque).
    function normReasons(list) {   // match the relay: trim, drop blanks, ensure Other present
      var out = (list || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
      // "Other" counts if ANY entry STARTS with it — "Other (Comment)" is an Other. The old exact
      // test appended a duplicate literal "Other" the moment the office renamed it, which is how
      // two look-alike options ended up on the foreman form (Tornike 2026-07-20).
      if (!out.some(function (x) { return /^other\b/i.test(x); })) out.push("Other");
      return out;
    }
    function activeSig(cfg) {
      var m = {};
      (cfg.google || []).forEach(function (g) { if (g.active && g.url) m["g:" + g.state] = String(g.url).trim(); });
      (cfg.platforms || []).forEach(function (p) { m["p:" + p.name] = p.active ? String(p.url).trim() : ""; });
      // reasons ride along in the SAME write payload as links — the link round-trip confirms the
      // whole save. (Not signed here so a save still confirms on a relay that predates reason support.)
      return JSON.stringify(m, Object.keys(m).sort());
    }
    function goalTag(name, state) {
      var g = RRP.goals; if (!g) return "";
      var nk = g.nk, key = nk(name), skey = nk("google " + state);
      var now = g.now[key] != null ? g.now[key] : g.now[skey];
      var goal = g.goal[key] != null ? g.goal[key] : g.goal[skey];
      if (now == null || goal == null || !goal) return "";
      var pct = Math.min(100, Math.round(now / goal * 100));
      return '<span class="gp">· ' + N(now) + " / " + N(goal) + " goal (" + pct + "%)</span>";
    }
    // ---- goal meter for a Google listing (same data as goalTag, shown as a real bar) ----
    function goalMeter(name, state) {
      var g = RRP.goals; if (!g) return "";
      var nk = g.nk, now = g.now[nk(name)], goal = g.goal[nk(name)];
      if (now == null) now = g.now[nk("google " + state)];
      if (goal == null) goal = g.goal[nk("google " + state)];
      if (now == null || goal == null || !goal) return "";
      var pct = Math.min(100, Math.round(now / goal * 100));
      return '<span class="rrp-goal" title="' + N(now) + ' of ' + N(goal) + ' review goal for this listing">'
        + '<span class="rrp-goalbar"><i style="width:' + pct + '%"></i></span>'
        + '<span class="rrp-goaltx">' + N(now) + " / " + N(goal) + " · " + pct + "%</span></span>";
    }
    // ---- live preview of the actual Slack message, built from the DRAFT being edited ----
    // The wording mirrors combined_relay.gs (mid-job + the Yelp pre-start template). KEEP IN SYNC:
    // if the relay's message text changes, change it here too — this is a preview, not the source.
    function pvLinks(d, state) {
      var locs = d.google.filter(function (g) { return g.state === state; });
      var g = locs.filter(function (x) { return x.active && x.url; })[0] || locs.filter(function (x) { return x.url; })[0];
      var out = [];
      if (g) out.push({ n: "Google", u: g.url });
      (d.platforms || []).forEach(function (p) { if (p.active && p.url) out.push({ n: p.name || "Platform", u: p.url }); });
      return out;
    }
    function pvBodyHtml(d) {
      var slack = function (s) { return esc(s).replace(/\*([^*]+)\*/g, "<b>$1</b>"); };
      var st = RRP.pvState || (d.google[0] && d.google[0].state) || "NJ";
      var links = pvLinks(d, st);
      var block = links.length
        ? links.map(function (l) { return esc(l.n) + ": " + '<a href="' + esc(l.u) + '" target="_blank" rel="noopener">' + esc(l.u) + "</a>"; }).join("\n")
        : '<span class="warn">No link set for ' + esc(st) + " — the bot would send an empty list.</span>";
      var txt = RRP.pvYelp
        ? slack("Hi Bacho 👋, your next job with *Katie Darcy* starts in 1 hour. This is a *Yelp customer*: ⚠️ please do *NOT* send them a Yelp review link. Instead, ask them verbally on-site for a review once the job is done, and send them these links:") + "\n" + block
        : slack("Hi Bacho 👋, your job with *Katie Darcy* wraps up soon. Once it’s done well, please send them our review links:") + "\n" + block;
      return '<div class="rrp-msg"><div class="rrp-msgav">Z</div><div class="rrp-msgb">'
        + '<div class="rrp-msgn">Review Bot<span>' + (RRP.pvYelp ? "pre-start · 1h before" : "mid-job") + "</span></div>"
        + '<div class="rrp-bub">' + txt + "</div></div></div>";
    }
    function refreshPv() {
      var el = document.getElementById("rrpPvBody");
      if (el) el.innerHTML = pvBodyHtml(RRP.draft);
      var sb = document.getElementById("rrpSaveBar");
      if (sb) {
        var dty = JSON.stringify(RRP.draft) !== RRP.draftBase;
        sb.classList.toggle("dirty", dty);
        var m = sb.querySelector(".rrp-savemsg");
        if (m && !RRP.saving && !RRP.saved) { m.className = "rrp-savemsg"; m.textContent = dty ? "Unsaved changes" : ""; }
      }
    }
    function viewLinks() {
      if (!RRP.draft) {
        var src = (RRP.data && RRP.data.config && RRP.data.config.google && RRP.data.config.google.length) ? RRP.data.config : RRP_SEED;
        RRP.draft = JSON.parse(JSON.stringify(src));
        RRP.draftBase = JSON.stringify(RRP.draft);   // dirty-state baseline
      }
      var d = RRP.draft;
      if (!d.reasons) d.reasons = (RRP.data && RRP.data.config && RRP.data.config.reasons) ? RRP.data.config.reasons.slice() : RRP_SEED.reasons.slice();
      var note = "";
      if (RRP.cfgSource === "seed") note = '<div class="rrp-warnbanner">Showing the default catalog — the live config couldn’t be read from the relay yet. You can edit and preview here; <b>Saving needs the relay published</b> (Apps Script ▸ Deploy ▸ New version).</div>';
      // group google by state (in first-seen order)
      var states = [], byState = {};
      d.google.forEach(function (g) { if (!byState[g.state]) { byState[g.state] = []; states.push(g.state); } byState[g.state].push(g); });
      var stateHtml = states.map(function (s2) {
        var locs = byState[s2];
        var rows = locs.map(function (g) {
          var gi = d.google.indexOf(g);
          return '<div class="rrp-loc' + (g.active ? " on" : "") + '">'
            + '<input type="radio" name="act-' + esc(s2) + '" data-act="' + gi + '"' + (g.active ? " checked" : "") + ' title="Send this listing for ' + esc(s2) + '">'
            + '<input type="text" class="nm" data-nm="' + gi + '" value="' + esc(g.name) + '" placeholder="Listing name">'
            + '<input type="text" class="url" data-url="' + gi + '" value="' + esc(g.url) + '" placeholder="https://…">'
            + '<button class="del" data-del="' + gi + '" title="Remove this listing">✕</button>'
            + "</div>";
        }).join("");
        var activeLoc = locs.filter(function (g) { return g.active; })[0] || locs[0];
        return '<div class="rrp-st"><div class="rrp-sth"><span class="rrp-stchip">' + esc(s2) + "</span>"
          + (activeLoc ? goalMeter(activeLoc.name, s2) : "") + "</div>" + rows
          + '<button class="rrp-addloc" data-addstate="' + esc(s2) + '">+ Add a listing for ' + esc(s2) + "</button></div>";
      }).join("");
      var sec1 = '<div class="rrp-sec"><div class="rrp-sech"><span class="rrp-secn">1</span><div class="rrp-sect">'
        + "<h4>Google link by state</h4><p>Each delivery state sends one Google listing — the highlighted row. The bar shows that listing’s reviews against its goal.</p>"
        + '</div></div><div class="rrp-secb">' + stateHtml + "</div></div>";
      var sec2 = '<div class="rrp-sec"><div class="rrp-sech"><span class="rrp-secn">2</span><div class="rrp-sect">'
        + "<h4>Extra platforms</h4><p>These ride along in every message, under the Google link. Toggle one off to drop it.</p>"
        + '</div></div><div class="rrp-secb"><div class="rrp-plats">'
        + d.platforms.map(function (p, i) {
          return '<div class="rrp-plat"><label class="rrp-sw"><input type="checkbox" data-pon="' + i + '"' + (p.active ? " checked" : "") + ' title="Include this platform"><i></i></label>'
            + '<input type="text" data-pnm="' + i + '" value="' + esc(p.name) + '" placeholder="Platform name">'
            + '<input type="text" class="url" data-purl="' + i + '" value="' + esc(p.url) + '" placeholder="https://…">'
            + '<button class="del" data-pdel="' + i + '" title="Remove platform">✕</button></div>';
        }).join("") + "</div>"
        + '<button class="rrp-addloc" data-addplat="1">+ Add a platform</button></div></div>';
      var sec3 = '<div class="rrp-sec"><div class="rrp-sech"><span class="rrp-secn">3</span><div class="rrp-sect">'
        + "<h4>“Why no review?” reasons</h4><p>The buttons a foreman sees when a review wasn’t left. One free-text option (an <b>“Other…”</b>) always stays — it opens a comment box so the foreman can explain. You can rename it; you just can’t remove the last one.</p>"
        + '</div></div><div class="rrp-secb"><div class="rrp-plats">'
        // Pin the FIRST "Other…" row, whatever it is called — NOT a literal "Other" (2026-07-20).
        // The old exact test pinned only the word "Other", so when the office added
        // "Other (Comment)" the literal one stayed undeletable and the list kept BOTH forever.
        // It was also readonly, which is why a second one got created instead of renaming it —
        // so the pinned row is now editable too, and only deletion is blocked.
        + (function () {
          var pin = -1;
          for (var k = 0; k < d.reasons.length; k++) {
            if (/^other\b/i.test(String(d.reasons[k]).trim())) { pin = k; break; }
          }
          return d.reasons.map(function (rz, i) {
            var locked = (i === pin);
            return '<div class="rrp-reason"><input type="text" data-rzn="' + i + '" value="' + esc(rz) + '"'
              + (locked ? ' title="This is the free-text option — rename it if you like, but it can’t be removed"' : "")
              + ' placeholder="Reason foremen can pick">'
              + (locked ? '<span class="rrp-lockpill">always on</span>'
                        : '<button class="del" data-rzdel="' + i + '" title="Remove reason">✕</button>') + "</div>";
          }).join("");
        })() + "</div>"
        + '<button class="rrp-addloc" data-addrzn="1">+ Add a reason</button></div></div>';
      var dirty = JSON.stringify(d) !== RRP.draftBase;
      var savemsg = RRP.saving ? "Saving…"
        : RRP.saved === 1 ? "Saved ✓ — confirmed on the sheet. The bot uses it on its next reminder."
        : RRP.saved === 2 ? "⚠ Saved, but read-back didn’t match — open the “Review Link Config” sheet to check."
        : RRP.saved === 3 ? "Sent — but the relay isn’t published yet, so I can’t confirm it landed. Redeploy the Apps Script, then Save again."
        : dirty ? "Unsaved changes" : "";
      var msgCls = RRP.saved === 1 ? "rrp-savemsg ok" : (RRP.saved === 2 || RRP.saved === 3) ? "rrp-savemsg bad" : "rrp-savemsg";
      var savebar = '<div class="rrp-savebar' + (dirty ? " dirty" : "") + '" id="rrpSaveBar"><span class="' + msgCls + '">' + esc(savemsg) + '</span>'
        + '<button class="rrp-save" id="rrpSave"' + (RRP.saving ? " disabled" : "") + ">Save settings</button></div>";
      // preview column
      var pvState = RRP.pvState || (d.google[0] && d.google[0].state) || "NJ";
      var pv = '<aside class="rrp-pv"><div class="rrp-pvh"><h4>What the foreman gets <em>preview</em></h4>'
        + "<p>Built from your edits above — it updates as you type.</p></div>"
        + '<div class="rrp-pvctl"><select data-pvstate>' + states.map(function (s2) {
            return '<option value="' + esc(s2) + '"' + (s2 === pvState ? " selected" : "") + ">" + esc(s2) + " delivery</option>"; }).join("") + "</select>"
        + '<span class="rrp-pvseg"><button data-pvmode="reg"' + (RRP.pvYelp ? "" : ' class="on"') + ">Regular</button>"
        + '<button data-pvmode="yelp"' + (RRP.pvYelp ? ' class="on"' : "") + ">Yelp</button></span></div>"
        + '<div class="rrp-pvbody" id="rrpPvBody">' + pvBodyHtml(d) + "</div>"
        + '<div class="rrp-pvfoot">Yelp customers never get a Yelp link — the bot warns the foreman an hour before the job and asks them to request the review verbally.</div></aside>';
      // trailing spacer: lets the last section scroll clear of the sticky save bar instead of
      // permanently hiding its final row behind it
      return note + '<div class="rrp-set"><div>' + sec1 + sec2 + sec3 + savebar + '<div style="height:6px"></div></div>' + pv + "</div>";
    }

    // ---------- paint + wire ----------
    // per-page header (each of the 3 split pages sets RRP.view via its registerPage wrapper)
    var HEAD = {
      log: { t: "Send Reminders", p: "The Slack nudges the bot sends foremen to collect reviews — today’s jobs, what went out, and what got skipped." },
      response: { t: "Response Analysis", p: "Why reviews were missed — every recent job the bot asked about, whether the foreman explained, and the reasons. Statistics run from yesterday back; you can still log a reason for a job up to a week old." },
      links: { t: "Review URLs and Reasons", p: "Which review link the bot sends per delivery state, the extra platforms, and the “why no review?” reasons foremen can pick." }
    };
    function paint() {
      var body;
      // Settings works from the live config OR the seed catalog — never blocked by the relay.
      if (RRP.view === "links") body = viewLinks();
      else if (RRP.loading && !RRP.data) body = '<div class="rrp-empty">Loading…</div>';
      else if (RRP.err && !RRP.data) {
        body = '<div class="rrp-empty">Couldn’t reach the Reviews relay (' + esc(RRP.err) + ').<br><br>'
          + 'Both paths failed — the bridge proxy and the direct Google call. That usually means the relay '
          + 'is cold-starting (up to ~1 min) or the bridge is mid-redeploy; it is not about your account.<br><br>'
          + '<button class="rrp-refresh" id="rrpRetry">Try again</button></div>';
      } else if (RRP.view === "response") body = viewResponse();
      else body = kpis() + viewLog();
      var hd = HEAD[RRP.view] || HEAD.log;

      root.innerHTML =
        '<div class="rrp-head"><div>'
        + '<h1><span class="rrp-star"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z"/></svg></span>' + esc(hd.t) + '</h1>'
        + '<p>' + esc(hd.p) + '</p></div>'
        + '<div class="rrp-headright"><div class="rrp-clock" id="rrpClock" title="Reminders fire on New Jersey time — compare a job’s scheduled time to this">' + nowLabel() + "</div>"
        + '<button class="rrp-refresh" id="rrpRefresh">↻ Refresh</button></div></div>'
        + '<div id="rrpBody">' + body + "</div>";
      var rf = root.querySelector("#rrpRefresh"); if (rf) rf.onclick = function () { RRP.data = null; RRP.dataFresh = false; RRP.draft = null; RRP.goals = null; render(host); };
      // the reasons-tab refresh: force=true so it bypasses the bridge proxy's 30s cache AND the
      // relay's own schedule cache — otherwise "Refresh" could hand back the same stale answer
      var rf2 = root.querySelector("#rrpFresh2");
      if (rf2) rf2.onclick = function () {
        rf2.disabled = true; rf2.textContent = "Refreshing…";
        RRP.dataFresh = false;
        // paint() re-wires everything itself, so no separate wire step
        ensureData(true).then(paint, paint);
      };
      var rt = root.querySelector("#rrpRetry"); if (rt) rt.onclick = function () { RRP.data = null; RRP.dataFresh = false; render(host); };
      // live clock — one interval; it self-clears once the page is gone
      if (window.__rrpClockTimer) clearInterval(window.__rrpClockTimer);
      window.__rrpClockTimer = setInterval(function () { var c = document.getElementById("rrpClock"); if (!c) { clearInterval(window.__rrpClockTimer); window.__rrpClockTimer = null; return; } c.textContent = nowLabel(); }, 15000);

      // wire day collapse/expand + per-job expand
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-dayhead[data-day]"), function (h) {
        h.onclick = function () { var d = h.getAttribute("data-day"); var todayKey = etDayKey(new Date().toISOString());
          var cur = (d in RRP.openDays) ? RRP.openDays[d] : (d === todayKey); RRP.openDays[d] = !cur; paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-jrhead[data-job]"), function (h) {
        h.onclick = function () { var j = h.getAttribute("data-job"); RRP.openJobs[j] = !RRP.openJobs[j]; paint(); };
      });
      // wire search
      var fq = root.querySelector("#rrpQ"); if (fq) { fq.oninput = function () { RRP.fq = fq.value; var pos = fq.selectionStart; paint(); var n = root.querySelector("#rrpQ"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }; }

      // wire link editor + response-analysis inline explain
      wireLinks();
      if (RRP.view === "response") wireResponse();
    }

    function wireLinks() {
      if (RRP.view !== "links" || !RRP.draft) return;
      var d = RRP.draft;
      Array.prototype.forEach.call(root.querySelectorAll("[data-act]"), function (el) {
        el.onchange = function () { var gi = +el.getAttribute("data-act"); var st = d.google[gi].state; d.google.forEach(function (g) { if (g.state === st) g.active = false; }); d.google[gi].active = true; RRP.saved = 0; paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-nm]"), function (el) { el.oninput = function () { d.google[+el.getAttribute("data-nm")].name = el.value; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-url]"), function (el) { el.oninput = function () { d.google[+el.getAttribute("data-url")].url = el.value; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-del]"), function (el) {
        el.onclick = function () { var gi = +el.getAttribute("data-del"); var wasActive = d.google[gi].active, st = d.google[gi].state; d.google.splice(gi, 1);
          if (wasActive) { var first = d.google.filter(function (g) { return g.state === st; })[0]; if (first) first.active = true; } RRP.saved = 0; paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-addstate]"), function (el) {
        el.onclick = function () { d.google.push({ state: el.getAttribute("data-addstate"), name: "", url: "", active: false }); RRP.saved = 0; paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-pon]"), function (el) { el.onchange = function () { d.platforms[+el.getAttribute("data-pon")].active = el.checked; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-pnm]"), function (el) { el.oninput = function () { d.platforms[+el.getAttribute("data-pnm")].name = el.value; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-purl]"), function (el) { el.oninput = function () { d.platforms[+el.getAttribute("data-purl")].url = el.value; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-pdel]"), function (el) { el.onclick = function () { d.platforms.splice(+el.getAttribute("data-pdel"), 1); RRP.saved = 0; paint(); }; });
      var addP = root.querySelector("[data-addplat]"); if (addP) addP.onclick = function () { d.platforms.push({ name: "", url: "", active: true }); RRP.saved = 0; paint(); };
      // reason list editor
      Array.prototype.forEach.call(root.querySelectorAll("[data-rzn]"), function (el) { el.oninput = function () { d.reasons[+el.getAttribute("data-rzn")] = el.value; RRP.saved = 0; }; });
      Array.prototype.forEach.call(root.querySelectorAll("[data-rzdel]"), function (el) { el.onclick = function () { d.reasons.splice(+el.getAttribute("data-rzdel"), 1); RRP.saved = 0; paint(); }; });
      var addR = root.querySelector("[data-addrzn]"); if (addR) addR.onclick = function () {
        var oi = d.reasons.map(function (x) { return String(x).trim().toLowerCase(); }).indexOf("other");
        if (oi >= 0) d.reasons.splice(oi, 0, ""); else d.reasons.push("");   // keep Other last
        RRP.saved = 0; paint();
      };
      // ---- live preview controls ----
      var pvSel = root.querySelector("[data-pvstate]");
      if (pvSel) pvSel.onchange = function () { RRP.pvState = pvSel.value; refreshPv(); };
      Array.prototype.forEach.call(root.querySelectorAll("[data-pvmode]"), function (el) {
        el.onclick = function () {
          RRP.pvYelp = el.getAttribute("data-pvmode") === "yelp";
          Array.prototype.forEach.call(root.querySelectorAll("[data-pvmode]"), function (b) {
            b.classList.toggle("on", (b.getAttribute("data-pvmode") === "yelp") === !!RRP.pvYelp);
          });
          refreshPv();
        };
      });
      // Typing a name/URL must update the preview WITHOUT a repaint (a repaint would steal focus).
      // Delegated, so it fires after the per-input oninput handlers above have written to the draft.
      var setRoot = root.querySelector(".rrp-set");
      if (setRoot) setRoot.addEventListener("input", function () { refreshPv(); });
      var sv = root.querySelector("#rrpSave");
      if (sv) sv.onclick = function () {
        // basic guard: every state needs exactly one active link
        var states = {}; d.google.forEach(function (g) { states[g.state] = states[g.state] || 0; if (g.active && g.url) states[g.state]++; });
        var bad = Object.keys(states).filter(function (s2) { return states[s2] !== 1; });
        if (bad.length) { alert("Each state needs exactly one active link with a URL. Check: " + bad.join(", ")); return; }
        RRP.saving = true; RRP.saved = 0; paint();
        try {
          var _body = JSON.stringify({ kind: "reviewLinkConfig", config: d });
          // bridge-proxied write (also busts the proxy's read cache); direct no-cors write
          // only if the bridge call itself fails (e.g. mid-redeploy)
          fetch(ZTZ.API + "/api/_rrp", { method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8", "Authorization": "Bearer " + ZTZ.getToken() },
            body: _body })
            .catch(function () {
              return fetch(RRP_RELAY, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: _body });
            });
        } catch (e) {}
        // the write may land via the opaque fallback — CONFIRM it by reading the config back and comparing.
        var want = activeSig(d);
        setTimeout(function () {
          relayRead().then(function (live) {
            RRP.saving = false;
            if (live && live.config && activeSig(live.config) === want) {
              RRP.saved = 1; RRP.data = live;
              RRP.draftBase = JSON.stringify(RRP.draft);   // saved → the draft IS the baseline again
            }
            else { RRP.saved = 2; }
            paint();
          }).catch(function () { RRP.saving = false; RRP.saved = 3; paint(); });
        }, 1600);
      };
    }

    // ---------- boot ---------- paint the shell instantly, then load in the background so the
    // Review-links editor is usable immediately and the log doesn't block on the relay.
    // SPEED: if we have no data yet, hydrate from the localStorage cache (only when it still covers
    // TODAY, so we never show a stale day) — the schedule appears instantly, then refreshes below.
    RRP.loading = !RRP.data;
    if (!RRP.data) {
      var todayKey0 = etDayKey(new Date().toISOString());
      var cached = rrpCacheRead();
      if (cached && cached.data && cached.data.schedule && cached.data.schedule.some(function (D) { return D.day === todayKey0; })) {
        RRP.data = cached.data; RRP.fromCache = true; RRP.loading = false;
        RRP.fetchedAt = cached.ts || null;   // cached paint must report the CACHE's age, not "now"
        if (RRP.data.config && RRP.data.config.google && RRP.data.config.google.length) RRP.cfgSource = "live";
      }
    }
    paint();
    (async function () {
      try {
        if (RRP.view === "links") await loadGoals();
        // response view: the warehouse review match loads IN PARALLEL with the relay feed —
        // neither blocks the other, and paint() below shows both together.
        await Promise.all([ensureData(false),
          RRP.view === "response" ? loadJobReviews() : Promise.resolve(),
          RRP.view === "response" ? loadContacts() : Promise.resolve()]);
        if (RRP.view === "links") await loadGoals();
      } catch (e) {}
      RRP.loading = false; RRP.fromCache = false;
      paint();
    })();
  };
}
