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
  ]
};
var RRP = { data: null, err: null, view: "log", draft: null, saving: false, saved: 0, fType: "", fStatus: "", fq: "", goals: null };

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
        ".rrp-plats{display:flex;flex-direction:column;gap:9px;margin-top:6px}",
        ".rrp-plat{display:grid;grid-template-columns:20px 130px 1fr;gap:9px;align-items:center}",
        ".rrp-plat input[type=checkbox]{width:16px;height:16px;accent-color:var(--brand)}",
        ".rrp-plat input[type=text]{font:inherit;font-size:12.5px;background:var(--panel-2);color:var(--ink);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px}",
        ".rrp-savebar{position:sticky;bottom:0;display:flex;align-items:center;gap:12px;justify-content:flex-end;padding:14px 2px 4px;margin-top:14px;background:linear-gradient(0deg,var(--bg,var(--panel)) 60%,transparent)}",
        ".rrp-save{border:0;background:var(--brand);color:var(--brand-ink);border-radius:10px;padding:10px 20px;font:inherit;font-size:13.5px;font-weight:800;cursor:pointer}",
        ".rrp-save:disabled{opacity:.55;cursor:default}",
        ".rrp-savemsg{font-size:12.5px;color:var(--muted)}",
        ".rrp-warnbanner{background:rgba(224,145,42,.12);border:1px solid rgba(224,145,42,.4);border-radius:12px;padding:12px 15px;font-size:12.5px;color:var(--ink);line-height:1.55;margin-bottom:16px}",
        "@media(max-width:820px){.rrp-row{grid-template-columns:56px 70px 1fr 90px}.rrp-row .cust,.rrp-row .lnk{display:none}.rrp-loc{grid-template-columns:22px 1fr 30px}.rrp-loc input[type=text].url{grid-column:2/4}}"
      ].join("\n");
      document.head.appendChild(st);
    }

    var root = document.createElement("div"); root.className = "rrp"; host.appendChild(root);

    // ---------- JSONP read from the relay ----------
    function jsonp(url) {
      return new Promise(function (resolve, reject) {
        var cb = "__rrcb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
        var s = document.createElement("script"); var done = false;
        var clean = function () { try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); };
        var timer = setTimeout(function () { if (!done) { done = true; clean(); reject(new Error("timeout")); } }, 16000);
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

    // ---------- toolbar (segmented) ----------
    function toolbar() {
      var views = [["log", "Send log"], ["reasons", "Missed-review reasons"], ["links", "Review links"]];
      return '<div class="rrp-seg">' + views.map(function (v) {
        return '<button data-v="' + v[0] + '"' + (RRP.view === v[0] ? ' class="on"' : "") + ">" + v[1] + "</button>";
      }).join("") + "</div>";
    }

    // ---------- KPI tiles (today) ----------
    function kpis() {
      var log = (RRP.data && RRP.data.log) || [];
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

    // ---------- SEND LOG ----------
    function viewLog() {
      var log = (RRP.data && RRP.data.log) || [];
      var foremenAll = {}; log.forEach(function (r) { foremenAll[r.foreman] = 1; });
      var filters = '<div class="rrp-filters">'
        + '<select id="rrpType"><option value="">All types</option><option value="morning">Morning</option><option value="mid">Mid-job</option><option value="final">Final</option></select>'
        + '<select id="rrpStatus"><option value="">All statuses</option><option value="sent">Sent</option><option value="skip">Skipped</option><option value="error">Error</option></select>'
        + '<input id="rrpQ" type="text" placeholder="Search foreman / customer / job…" value="' + esc(RRP.fq) + '">'
        + "</div>";
      var rows = log.filter(function (r) {
        if (RRP.fType && r.type !== RRP.fType) return false;
        if (RRP.fStatus === "sent" && !/^sent/i.test(r.status)) return false;
        if (RRP.fStatus === "skip" && !/skip/i.test(r.status)) return false;
        if (RRP.fStatus === "error" && !/error/i.test(r.status)) return false;
        if (RRP.fq) { var hay = (r.foreman + " " + r.customer + " " + r.job).toLowerCase(); if (hay.indexOf(RRP.fq.toLowerCase()) < 0) return false; }
        return true;
      });
      if (!rows.length) return filters + '<div class="rrp-empty">No reminders match. When the bot runs, each morning summary and per-job nudge shows up here.</div>';
      // group by ET day (log is newest-first already)
      var groups = [], byKey = {};
      rows.forEach(function (r) { var k = etDayKey(r.ts); if (!byKey[k]) { byKey[k] = { key: k, day: etDay(r.ts), rows: [] }; groups.push(byKey[k]); } byKey[k].rows.push(r); });
      return filters + groups.map(function (g) {
        var sentN = g.rows.filter(function (r) { return /^sent/i.test(r.status); }).length;
        return '<div class="rrp-day"><h3>' + esc(g.day) + '</h3><span>' + sentN + " sent · " + g.rows.length + " events</span></div>"
          + '<div class="rrp-card">' + g.rows.map(function (r) {
            var ty = TYPE[r.type] || { l: r.type, c: "" };
            return '<div class="rrp-row">'
              + '<span class="tm">' + esc(etTime(r.ts)) + "</span>"
              + '<span><span class="pill ' + ty.c + '">' + esc(ty.l) + "</span></span>"
              + '<span class="who">' + esc(r.foreman || "—") + "</span>"
              + '<span class="cust">' + esc(r.customer || "—") + (r.job ? "<small>" + esc(r.job) + "</small>" : "") + "</span>"
              + '<span class="lnk">' + esc(r.links || "") + "</span>"
              + "<span>" + statusPill(r.status) + "</span>"
              + "</div>";
          }).join("") + "</div>";
      }).join("");
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
      var note = '<div class="rrp-note"><b>Which review link goes out per delivery state.</b> When a job delivers to a state, the foreman’s Slack nudge uses that state’s <b>active</b> Google link plus the platforms below. Pick the location that still needs reviews (progress vs goal shown where known). <b>Save</b> and the bot uses it on the very next reminder — no redeploy.</div>';
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
      var platHtml = '<div class="rrp-state"><h4>Other platforms (added to every message)</h4><div class="rrp-plats">'
        + d.platforms.map(function (p, i) {
          return '<div class="rrp-plat"><input type="checkbox" data-pon="' + i + '"' + (p.active ? " checked" : "") + ">"
            + '<input type="text" data-pnm="' + i + '" value="' + esc(p.name) + '" placeholder="Name">'
            + '<input type="text" data-purl="' + i + '" value="' + esc(p.url) + '" placeholder="https://…"></div>';
        }).join("") + "</div></div>";
      var savemsg = RRP.saving ? "Saving…" : (RRP.saved ? "Saved ✓ — the bot uses this on its next reminder." : "");
      var savebar = '<div class="rrp-savebar"><span class="rrp-savemsg">' + esc(savemsg) + '</span><button class="rrp-save" id="rrpSave"' + (RRP.saving ? " disabled" : "") + ">Save review links</button></div>";
      return note + stateHtml + platHtml + savebar;
    }

    // ---------- paint + wire ----------
    function paint() {
      var body;
      if (RRP.err && !RRP.data) {
        body = '<div class="rrp-empty">Couldn’t reach the Reviews relay (' + esc(RRP.err) + ').<br><br>'
          + 'This lights up once the Apps Script is published with the read API (Deploy ▸ New version). '
          + 'You can still open <b>Review links</b> to preview and edit.<br><br>'
          + '<button class="rrp-refresh" id="rrpRetry">Try again</button></div>';
      } else if (RRP.view === "log") body = kpis() + viewLog();
      else if (RRP.view === "reasons") body = viewReasons();
      else body = viewLinks();

      root.innerHTML =
        '<div class="rrp-head"><div>'
        + '<h1><span class="rrp-star"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.3l-6.2 3.7 1.6-7L2 9.2l7.1-.6L12 2l2.9 6.6 7.1.6-5.4 4.8 1.6 7z"/></svg></span>Review Reminders</h1>'
        + '<p>The automated Slack nudges the bot sends foremen to collect reviews — what went out, what got skipped, why reviews were missed, and which links to send.</p></div>'
        + '<button class="rrp-refresh" id="rrpRefresh">↻ Refresh</button></div>'
        + toolbar() + '<div id="rrpBody">' + body + "</div>";

      // wire toolbar
      Array.prototype.forEach.call(root.querySelectorAll(".rrp-seg button"), function (b) {
        b.onclick = function () { RRP.view = b.getAttribute("data-v"); if (RRP.view === "links") loadGoals().then(paint); else paint(); };
      });
      var rf = root.querySelector("#rrpRefresh"); if (rf) rf.onclick = function () { RRP.data = null; RRP.draft = null; RRP.goals = null; render(host); };
      var rt = root.querySelector("#rrpRetry"); if (rt) rt.onclick = function () { RRP.data = null; render(host); };

      // wire log filters
      var ft = root.querySelector("#rrpType"); if (ft) { ft.value = RRP.fType; ft.onchange = function () { RRP.fType = ft.value; paint(); }; }
      var fs = root.querySelector("#rrpStatus"); if (fs) { fs.value = RRP.fStatus; fs.onchange = function () { RRP.fStatus = fs.value; paint(); }; }
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
      var sv = root.querySelector("#rrpSave");
      if (sv) sv.onclick = function () {
        // basic guard: every state needs exactly one active link
        var states = {}; d.google.forEach(function (g) { states[g.state] = states[g.state] || 0; if (g.active && g.url) states[g.state]++; });
        var bad = Object.keys(states).filter(function (s2) { return states[s2] !== 1; });
        if (bad.length) { alert("Each state needs exactly one active link with a URL. Check: " + bad.join(", ")); return; }
        RRP.saving = true; paint();
        try {
          fetch(RRP_RELAY, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ kind: "reviewLinkConfig", config: d }) });
        } catch (e) {}
        // no-cors: response is opaque, so confirm optimistically after a beat
        setTimeout(function () { RRP.saving = false; RRP.saved = 1; if (RRP.data && RRP.data.config) RRP.data.config = JSON.parse(JSON.stringify(d)); paint(); }, 1200);
      };
    }

    // ---------- boot ----------
    root.innerHTML = '<div class="rrp-empty">Loading reminders…</div>';
    await ensureData(false);
    if (RRP.view === "links") await loadGoals();
    paint();
  }
});
