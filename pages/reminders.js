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

registerPage({
  id: "reviews-reminders",
  group: "reviews",
  title: "Reminders",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var TYPE = { morning: { l: "Morning", c: "t-blue" }, mid: { l: "Mid-job", c: "t-amber" }, final: { l: "Final", c: "t-green" } };

    if (!document.getElementById("rrp-style")) {
      var st = document.createElement("style"); st.id = "rrp-style";
      st.textContent = [
        ".rrp{max-width:1120px;margin:0 auto;padding:2px 2px 40px}",
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
        ".t-blue{background:rgba(56,132,255,.16);color:#5b9bff}.t-amber{background:rgba(224,145,42,.16);color:#e0912a}.t-green{background:rgba(46,160,90,.18);color:#3fbb6d}",
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
        ".rrp-state{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:11px}",
        ".rrp-state h4{margin:0 0 3px;font-size:14.5px;font-weight:800;display:flex;align-items:center;gap:8px}",
        ".rrp-state h4 .gp{font-size:11px;font-weight:700;color:var(--muted)}",
        ".rrp-loc{display:grid;grid-template-columns:22px 150px 1fr 30px;gap:9px;align-items:center;margin-top:9px}",
        ".rrp-loc input[type=text]{font:inherit;font-size:12.5px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;width:100%}",
        ".rrp-loc input[type=radio]{width:16px;height:16px;accent-color:var(--brand)}",
        ".rrp-loc .del{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:16px;line-height:1;border-radius:6px}",
        ".rrp-loc .del:hover{color:#e5484d}",
        ".rrp-addloc{margin-top:9px;border:1px dashed var(--line-2);background:transparent;color:var(--muted);border-radius:9px;padding:7px 11px;font:inherit;font-size:12px;font-weight:700;cursor:pointer}",
        ".rrp-addloc:hover{border-color:var(--brand);color:var(--brand)}",
        ".rrp-platnote{font-size:11.5px;color:var(--muted);margin:2px 0 10px}",
        ".rrp-plats{display:flex;flex-direction:column;gap:9px;margin-top:6px}",
        ".rrp-plat{display:grid;grid-template-columns:20px 150px 1fr 30px;gap:9px;align-items:center}",
        ".rrp-reason{display:grid;grid-template-columns:1fr 66px;gap:9px;align-items:center}",
        ".rrp-reason input{font:inherit;font-size:12.5px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px;width:100%}",
        ".rrp-reason input[readonly]{opacity:.75;cursor:default}",
        ".rrp-lockpill{font-size:9.5px;font-weight:800;color:var(--muted);text-align:center;text-transform:uppercase;letter-spacing:.03em}",
        ".rrp-clock{font-size:12px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 12px;white-space:nowrap;font-variant-numeric:tabular-nums}",
        ".rrp-headright{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}",
        ".rrp-plat input[type=checkbox]{width:16px;height:16px;accent-color:var(--brand)}",
        ".rrp-plat input[type=text]{font:inherit;font-size:12.5px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px}",
        ".rrp-savebar{display:flex;align-items:center;gap:12px;justify-content:flex-end;padding:16px 2px 8px;margin-top:16px;border-top:1px solid var(--line)}",
        ".rrp-save{border:0;background:var(--brand);color:var(--brand-ink);border-radius:10px;padding:10px 20px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}",
        ".rrp-save:disabled{opacity:.55;cursor:default}",
        ".rrp-savemsg{font-size:12.5px;color:var(--muted)}",
        ".rrp-warnbanner{background:rgba(224,145,42,.12);border:1px solid rgba(224,145,42,.4);border-radius:12px;padding:12px 15px;font-size:12.5px;color:var(--ink);line-height:1.55;margin-bottom:16px}",
        "@media(max-width:820px){.rrp-row{grid-template-columns:56px 70px 1fr 90px}.rrp-row .cust,.rrp-row .lnk{display:none}.rrp-loc{grid-template-columns:22px 1fr 30px}.rrp-loc input[type=text].url{grid-column:2/4}}"
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = "";   // clear the shell's "Loading…" spinner before mounting
    var root = document.createElement("div"); root.className = "rrp"; host.appendChild(root);

    // ---------- JSONP read from the relay ----------
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

    async function ensureData(force) {
      if (RRP.data && !force) return;
      RRP.err = null;
      try { RRP.data = await jsonp(RRP_RELAY + "?req=reviewData"); }
      catch (e) { RRP.err = e.message || String(e); RRP.data = null; }
      if (RRP.data && RRP.data.config && RRP.data.config.google && RRP.data.config.google.length) RRP.cfgSource = "live";
      else RRP.cfgSource = "seed";
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
    function viewSchedule(sched) {
      var idx = indexLog();
      var todayKey = etDayKey(new Date().toISOString());
      var yKey = shiftKey(todayKey, -1), tKey = shiftKey(todayKey, 1);
      return sched.map(function (D) {
        var isToday = D.day === todayKey, isTomorrow = D.day === tKey, isYesterday = D.day === yKey;
        var open = (D.day in RRP.openDays) ? RRP.openDays[D.day] : isToday;   // default: today open, yesterday/tomorrow closed
        var jobs = (D.jobs || []).filter(jobMatches);
        var body = "";
        if (open) body = jobs.length ? jobs.map(function (j) { return scheduleCard(D.day, j, idx); }).join("")
          : '<div class="rrp-empty" style="margin:6px 0 14px;padding:20px">No Zip-to-Zip jobs ' + (isToday ? "today" : isYesterday ? "yesterday" : "scheduled") + ".</div>";
        return '<div class="rrp-dayhead' + (open ? " open" : "") + '" data-day="' + esc(D.day) + '">'
          + '<span class="rrp-daychev">' + (open ? "▾" : "▸") + "</span>"
          + "<h3>" + esc(dayHeadLabel(D.day, isToday, isTomorrow, isYesterday)) + "</h3>"
          + "<span>" + (D.jobs || []).length + " job" + ((D.jobs || []).length === 1 ? "" : "s") + "</span></div>" + body;
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
    // one job card: Morning · Mid · Final each with its scheduled/sent TIME; expand for detail
    function scheduleCard(dayKey, j, idx) {
      var now = Date.now();
      var mk = function (label, atIso, row) {
        if (!atIso) return { label: label, state: "na" };
        var st, at = atIso;
        if (row && /^sent/i.test(row.status)) { st = "sent"; at = row.ts; }
        else if (row && /skip/i.test(row.status)) st = "skip";
        else if (row && /error/i.test(row.status)) st = "err";
        else st = (new Date(atIso).getTime() <= now) ? "due" : "sched";
        return { label: label, state: st, at: at, sched: atIso, row: row };
      };
      var stages = [
        mk("Morning", j.morningAt, idx.mBy[dayKey + "|" + j.foremanEmail]),
        mk("Mid", j.midAt, idx.midBy[dayKey + "|" + j.job]),
        mk("Final", j.finalAt, idx.finBy[dayKey + "|" + j.job])
      ];
      var applic = stages.filter(function (s) { return s.state !== "na"; });
      var sentN = applic.filter(function (s) { return s.state === "sent"; }).length;
      var N = applic.length || 3;
      var hasSkip = applic.some(function (s) { return s.state === "skip" || s.state === "err"; });
      var pcls = (applic.length && sentN === applic.length) ? "p3" : (hasSkip || !j.hasSlack) ? "pskip" : sentN > 0 ? "p2" : "pfut";
      var pills = stages.map(function (s) {
        if (s.state === "na") return '<span class="rrp-stage st-na">' + s.label + " —</span>";
        var t = fmtT(s.state === "sent" ? s.at : s.sched);
        return '<span class="rrp-stage st-' + s.state + '">' + s.label + " <b>" + esc(t) + "</b></span>";
      }).join("");
      var key = dayKey + "|" + j.job, open = !!RRP.openJobs[key];
      var warn = j.hasSlack ? "" : ' <span class="rrp-noid">no Slack ID</span>';
      var head = '<div class="rrp-jobhead" data-job="' + esc(key) + '">'
        + '<span class="rrp-prog ' + pcls + '">' + sentN + "/" + N + "</span>"
        + '<span class="rrp-jw">' + esc(j.foreman || "—") + warn + "</span>"
        + '<span class="rrp-jc">' + esc(j.customer || "—") + "<small>" + esc(j.job) + (j.state ? " · " + esc(j.state) : "") + "</small></span>"
        + '<span class="rrp-jstages">' + pills + "</span>"
        + '<span class="rrp-jchev">' + (open ? "▾" : "▸") + "</span></div>";
      var detail = "";
      if (open) {
        detail = '<div class="rrp-jobevents">' + eventPanel(j) + stages.map(function (s) {
          var ty = TYPE[s.label.toLowerCase()] || { c: "" };
          if (s.state === "na") {
            var es = j.detail && j.detail.endSource;
            var msg = es === "cal-unreachable" ? "on hold — the job’s scheduled end time can’t be read from the calendar yet (mid/final resume once it’s reachable)"
              : es === "no-match" ? "on hold — no matching calendar event was found for this job"
              : "not sent — this job has no end time (ACT), so only the morning summary applies";
            return '<div class="rrp-evrow"><span class="tm">—</span><span class="pill ' + ty.c + '">' + s.label + '</span><span class="rrp-evlnk">' + msg + "</span></div>";
          }
          var status = s.state === "sent" ? statusPill("sent") : s.state === "skip" ? statusPill("skipped") : s.state === "err" ? statusPill("error")
            : '<span class="pill s-sched">' + (s.state === "due" ? "Pending" : "Scheduled") + "</span>";
          var line = s.state === "sent" ? ("sent at " + fmtT(s.at)) : ("will send at " + fmtT(s.sched));
          return '<div class="rrp-evrow"><span class="tm">' + esc(fmtT(s.sched)) + '</span><span class="pill ' + ty.c + '">' + s.label + '</span><span class="rrp-evlnk">' + esc(line) + "</span>" + status + "</div>" + msgPanel(s);
        }).join("") + "</div>";
      }
      return '<div class="rrp-jobcard' + (open ? " open" : "") + '">' + head + detail + "</div>";
    }

    // ---------- MISSED-REVIEW REASONS ----------
    function viewReasons() {
      var resp = (RRP.data && RRP.data.responses) || [];
      if (!resp.length) return '<div class="rrp-empty">No reasons yet. When a foreman taps “why no review?” on the final Slack nudge, it lands here.</div>';
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
      return bars + tbl;
    }

    // ---------- REVIEW LINKS (editable control) ----------
    // canonical signature of "what actually gets sent" — active Google URL per state + platform
    // on/off — so a Save can be CONFIRMED by reading the config back (no-cors writes are opaque).
    function normReasons(list) {   // match the relay: trim, drop blanks, ensure Other present
      var out = (list || []).map(function (x) { return String(x || "").trim(); }).filter(Boolean);
      if (out.map(function (x) { return x.toLowerCase(); }).indexOf("other") < 0) out.push("Other");
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
    function viewLinks() {
      if (!RRP.draft) {
        var src = (RRP.data && RRP.data.config && RRP.data.config.google && RRP.data.config.google.length) ? RRP.data.config : RRP_SEED;
        RRP.draft = JSON.parse(JSON.stringify(src));
      }
      var d = RRP.draft;
      if (!d.reasons) d.reasons = (RRP.data && RRP.data.config && RRP.data.config.reasons) ? RRP.data.config.reasons.slice() : RRP_SEED.reasons.slice();
      var note = '<div class="rrp-note"><b>Settings for the review-reminder bot.</b> Set which Google link goes out per delivery state, which extra platforms ride along, and the “why no review?” reasons foremen can pick. <b>Save</b> and the bot uses everything on its very next reminder — no redeploy.</div>';
      if (RRP.cfgSource === "seed") note += '<div class="rrp-warnbanner">Showing the default catalog — the live config couldn’t be read from the relay yet. You can edit and preview here; <b>Saving needs the relay published</b> (Apps Script ▸ Deploy ▸ New version).</div>';
      // group google by state (in first-seen order)
      var states = [], byState = {};
      d.google.forEach(function (g) { if (!byState[g.state]) { byState[g.state] = []; states.push(g.state); } byState[g.state].push(g); });
      var stateHtml = states.map(function (s2) {
        var locs = byState[s2];
        var rows = locs.map(function (g) {
          var gi = d.google.indexOf(g);
          return '<div class="rrp-loc">'
            + '<input type="radio" name="act-' + esc(s2) + '" data-act="' + gi + '"' + (g.active ? " checked" : "") + ' title="Send this one for ' + esc(s2) + '">'
            + '<input type="text" class="nm" data-nm="' + gi + '" value="' + esc(g.name) + '" placeholder="Location name">'
            + '<input type="text" class="url" data-url="' + gi + '" value="' + esc(g.url) + '" placeholder="https://…">'
            + '<button class="del" data-del="' + gi + '" title="Remove">✕</button>'
            + "</div>";
        }).join("");
        var activeLoc = locs.filter(function (g) { return g.active; })[0] || locs[0];
        return '<div class="rrp-state"><h4>' + esc(s2) + " " + (activeLoc ? goalTag(activeLoc.name, s2) : "") + "</h4>" + rows
          + '<button class="rrp-addloc" data-addstate="' + esc(s2) + '">+ Add a location for ' + esc(s2) + "</button></div>";
      }).join("");
      var platHtml = '<div class="rrp-state"><h4>Other platforms (added to every message)</h4>'
        + '<div class="rrp-platnote">Tick a platform to include its link; untick to leave it out. Add a new one (e.g. Thumbtack) with the button below.</div>'
        + '<div class="rrp-plats">'
        + d.platforms.map(function (p, i) {
          return '<div class="rrp-plat"><input type="checkbox" data-pon="' + i + '"' + (p.active ? " checked" : "") + ' title="Include this platform">'
            + '<input type="text" data-pnm="' + i + '" value="' + esc(p.name) + '" placeholder="Platform name">'
            + '<input type="text" data-purl="' + i + '" value="' + esc(p.url) + '" placeholder="https://…">'
            + '<button class="del" data-pdel="' + i + '" title="Remove platform">✕</button></div>';
        }).join("") + "</div>"
        + '<button class="rrp-addloc" data-addplat="1">+ Add a platform</button></div>';
      // ---- reason list foremen pick from on the "why no review?" form ----
      var reasonHtml = '<div class="rrp-state"><h4>“Why no review?” reasons</h4>'
        + '<div class="rrp-platnote">These are the buttons a foreman sees when a review wasn’t left. <b>Other</b> is always included — with it, whatever they type in the note is captured even if nothing fits.</div>'
        + '<div class="rrp-plats">'
        + d.reasons.map(function (rz, i) {
          var isOther = String(rz).trim().toLowerCase() === "other";
          return '<div class="rrp-reason"><input type="text" data-rzn="' + i + '" value="' + esc(rz) + '"' + (isOther ? " readonly title=\"Other is always kept\"" : "") + ' placeholder="Reason foremen can pick">'
            + (isOther ? '<span class="rrp-lockpill">always on</span>' : '<button class="del" data-rzdel="' + i + '" title="Remove reason">✕</button>') + "</div>";
        }).join("") + "</div>"
        + '<button class="rrp-addloc" data-addrzn="1">+ Add a reason</button></div>';
      var savemsg = RRP.saving ? "Saving…"
        : RRP.saved === 1 ? "Saved ✓ — confirmed on the sheet. The bot uses it on its next reminder."
        : RRP.saved === 2 ? "⚠ Saved, but read-back didn’t match — open the “Review Link Config” sheet to check."
        : RRP.saved === 3 ? "Sent — but the relay isn’t published yet, so I can’t confirm it landed. Redeploy the Apps Script, then Save again."
        : "";
      var savebar = '<div class="rrp-savebar"><span class="rrp-savemsg">' + esc(savemsg) + '</span><button class="rrp-save" id="rrpSave"' + (RRP.saving ? " disabled" : "") + ">Save settings</button></div>";
      return note + stateHtml + platHtml + reasonHtml + savebar;
    }

    // ---------- paint + wire ----------
    function paint() {
      var body;
      // Review links works from the live config OR the seed catalog — never blocked by the relay.
      if (RRP.view === "links") body = viewLinks();
      else if (RRP.loading && !RRP.data) body = '<div class="rrp-empty">Loading reminders…</div>';
      else if (RRP.err && !RRP.data) {
        body = '<div class="rrp-empty">Couldn’t reach the Reviews relay (' + esc(RRP.err) + ').<br><br>'
          + 'This lights up once the Apps Script is published with the read API (Deploy ▸ New version). '
          + 'You can still open <b>Review links</b> to preview and edit.<br><br>'
          + '<button class="rrp-refresh" id="rrpRetry">Try again</button></div>';
      } else if (RRP.view === "log") body = kpis() + viewLog();
      else body = viewReasons();

      root.innerHTML =
        '<div class="rrp-head"><div>'
        + '<h1><span class="rrp-star"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z"/></svg></span>Review Reminders</h1>'
        + '<p>The automated Slack nudges the bot sends foremen to collect reviews — what went out, what got skipped, why reviews were missed, and which links to send.</p></div>'
        + '<div class="rrp-headright"><div class="rrp-clock" id="rrpClock" title="Reminders fire on New Jersey time — compare a job’s scheduled time to this">' + nowLabel() + "</div>"
        + '<button class="rrp-refresh" id="rrpRefresh">↻ Refresh</button></div></div>'
        + toolbar() + '<div id="rrpBody">' + body + "</div>";

      // wire toolbar
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-seg button"), function (b) {
        b.onclick = function () { RRP.view = b.getAttribute("data-v"); if (RRP.view === "links") loadGoals().then(paint); else paint(); };
      });
      var rf = root.querySelector("#rrpRefresh"); if (rf) rf.onclick = function () { RRP.data = null; RRP.draft = null; RRP.goals = null; render(host); };
      var rt = root.querySelector("#rrpRetry"); if (rt) rt.onclick = function () { RRP.data = null; render(host); };
      // live clock — one interval; it self-clears once the page is gone
      if (window.__rrpClockTimer) clearInterval(window.__rrpClockTimer);
      window.__rrpClockTimer = setInterval(function () { var c = document.getElementById("rrpClock"); if (!c) { clearInterval(window.__rrpClockTimer); window.__rrpClockTimer = null; return; } c.textContent = nowLabel(); }, 15000);

      // wire day collapse/expand + per-job expand
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-dayhead[data-day]"), function (h) {
        h.onclick = function () { var d = h.getAttribute("data-day"); var todayKey = etDayKey(new Date().toISOString());
          var cur = (d in RRP.openDays) ? RRP.openDays[d] : (d === todayKey); RRP.openDays[d] = !cur; paint(); };
      });
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-jobhead[data-job]"), function (h) {
        h.onclick = function () { var j = h.getAttribute("data-job"); RRP.openJobs[j] = !RRP.openJobs[j]; paint(); };
      });
      // wire search
      var fq = root.querySelector("#rrpQ"); if (fq) { fq.oninput = function () { RRP.fq = fq.value; var pos = fq.selectionStart; paint(); var n = root.querySelector("#rrpQ"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }; }

      // wire link editor
      wireLinks();
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
      var sv = root.querySelector("#rrpSave");
      if (sv) sv.onclick = function () {
        // basic guard: every state needs exactly one active link
        var states = {}; d.google.forEach(function (g) { states[g.state] = states[g.state] || 0; if (g.active && g.url) states[g.state]++; });
        var bad = Object.keys(states).filter(function (s2) { return states[s2] !== 1; });
        if (bad.length) { alert("Each state needs exactly one active link with a URL. Check: " + bad.join(", ")); return; }
        RRP.saving = true; RRP.saved = 0; paint();
        try {
          fetch(RRP_RELAY, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ kind: "reviewLinkConfig", config: d }) });
        } catch (e) {}
        // no-cors write is opaque — CONFIRM it by reading the config back and comparing.
        var want = activeSig(d);
        setTimeout(function () {
          jsonp(RRP_RELAY + "?req=reviewData").then(function (live) {
            RRP.saving = false;
            if (live && live.config && activeSig(live.config) === want) { RRP.saved = 1; RRP.data = live; }
            else { RRP.saved = 2; }
            paint();
          }).catch(function () { RRP.saving = false; RRP.saved = 3; paint(); });
        }, 1600);
      };
    }

    // ---------- boot ---------- paint the shell instantly, then load in the background so the
    // Review-links editor is usable immediately and the log doesn't block on the relay.
    RRP.loading = !RRP.data;
    paint();
    (async function () {
      try {
        if (RRP.view === "links") await loadGoals();
        await ensureData(false);
        if (RRP.view === "links") await loadGoals();
      } catch (e) {}
      RRP.loading = false;
      paint();
    })();
  }
});
