/* REVIEWS page: Foreman Review Performance — Foreman × period matrix of
   "R reviews / J eligible jobs = %", weekly OR monthly grain, with a right-side drawer
   drill-down (jobs + per-platform review sources). Two views:
     · Performance — the matrix (default)
     · Reasons — why reviews are missing: reason breakdown, foreman accountability, job worklist
   ACTION: eligible no-review jobs can be EXPLAINED right from the portal — the form posts to
   the same Apps Script relay as the foremen's Slack form, landing in the ops sheet's
   "Review Responses" tab (one system of record; warehouse ingests it within ~6h).
   Numerator = SUM(reviews) on ELIGIBLE jobs; denominator = eligible jobs. Built on
   fct_job_overview. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_job_overview) {
    RS.DATASETS.fct_job_overview = {
      table: "fct_job_overview",
      // ONLY the columns this page + its CSV actually use — the full 34-column fetch was
      // ~12 MB and froze the tab (audit + Tornike 2026-07-13). Add columns here only
      // together with a real consumer.
      cols: [
        "Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Job Source", "Job Type",
        "Estimate Bill", "Actual Bill", "Bill Increase Amount", "Bill Increase %",
        "Bill Increase Category", "Review Received", "Number of Reviews", "Review Source",
        "Review Breakdown", "Eligible", "Support Intervention", "Support Intervention Reason",
        "Review Expected", "Exclusion Reason", "Foreman Response Received", "Foreman Reason",
        "Foreman Explanation", "Final Status", "Event ID",
      ],
    };
  }
})();

var RP_BANDS = [
  { max: 50,       bg: "#dc2626", fg: "#fff",     label: "Below 50%" },
  { max: 100,      bg: "#fecaca", fg: "#991b1b",  label: "50–99%" },
  { max: 100.0001, bg: "#e5e7eb", fg: "#374151",  label: "100%" },
  { max: 200,      bg: "#bbf7d0", fg: "#166534",  label: "101–199%" },
  { max: Infinity, bg: "#16a34a", fg: "#fff",     label: "≥200%" },
];
var RP_WIN = { day: [7, 14, 30, 60], week: [8, 12, 26, 52], month: [3, 6, 12, 24] };
var RP_PLAT = { Google: "#4285F4", Yelp: "#d32323", Angi: "#1aa64b", Trustpilot: "#00b67a",
  Facebook: "#1877f2", Consumer: "#6d28d9", Birdeye: "#f59e0b", BBB: "#0a4d8c", Thumbtack: "#009fd9",
  Nextdoor: "#5aa700", Unpakt: "#e11d48", Mymovingreviews: "#0ea5e9" };
// same relay + reasons as the foremen's Slack form (review_response.html) — ONE system of record
var RP_RELAY = "https://script.google.com/macros/s/AKfycbzX3q9VqyZKd3FUbGCPKN9JcQgcp15rz0QXxzNnxTYeXSRCY16Ei8n_9D07c9EQvOxM/exec";
var RP_REASONS = ["Customer refused", "The customer was dissatisfied", "Open claim",
  "Support intervention was required", "Billing issue", "The customer promised to write later",
  "Elderly customer (not comfortable with technology)", "No internet / poor internet connection",
  "Customer was unfriendly / not willing to engage"];
var RP = { sources: new Set(), statuses: new Set(), billcats: new Set(), foremen: new Set(),
  grain: "week", winD: 14, winW: 12, winM: 6, offset: 0, sortCol: null, sortDir: "desc", cell: null, view: "perf",
  wlPage: 0 };

registerPage({
  id: "review-performance",
  group: "reviews",
  title: "Review Performance",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var num = function (v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
    var money = function (v) { var s = String(v == null ? "" : v).trim(); if (s === "") return "—"; return "$" + Math.round(num(v)).toLocaleString(); };
    var yes = function (v) { return String(v).trim().toLowerCase() === "yes"; };
    var band = function (pct) { for (var i = 0; i < RP_BANDS.length; i++) if (pct < RP_BANDS[i].max) return RP_BANDS[i]; return RP_BANDS[RP_BANDS.length - 1]; };
    var MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var shortD = function (iso) { iso = String(iso || ""); if (iso.length < 10) return iso; return MON[+iso.slice(5, 7)] + " " + (+iso.slice(8, 10)); };
    var platColor = function (src) { return RP_PLAT[String(src).split(" ")[0]] || "#6b7280"; };
    var parseBk = function (s) {
      if (!s) return [];
      return String(s).split("¦").map(function (p) {
        var i = p.lastIndexOf("§"); if (i < 0) return null;
        return { src: p.slice(0, i), n: parseInt(p.slice(i + 1), 10) || 0 };
      }).filter(Boolean);
    };
    // period key/label per grain (day / week / month)
    var colKey = function (r) {
      return RP.grain === "day" ? String(r["Job Date"] || "").slice(0, 10)
           : RP.grain === "week" ? String(r["Week Ending"] || "").slice(0, 10)
                                 : String(r["Job Date"] || "").slice(0, 7);
    };
    var colLabel = function (c) {
      return RP.grain === "day" ? MON[+c.slice(5, 7)] + " " + (+c.slice(8, 10))
           : RP.grain === "week" ? c.slice(5) : MON[+c.slice(5, 7)] + " '" + c.slice(2, 4);
    };
    var colLong = function (c) {
      return RP.grain === "day" ? MON[+c.slice(5, 7)] + " " + (+c.slice(8, 10)) + ", " + c.slice(0, 4)
           : RP.grain === "week" ? "week ending " + c : MON[+c.slice(5, 7)] + " " + c.slice(0, 4);
    };
    var win = function () { return RP.grain === "day" ? RP.winD : RP.grain === "week" ? RP.winW : RP.winM; };

    if (!document.getElementById("rp-style")) {
      var st = document.createElement("style"); st.id = "rp-style";
      st.textContent = `
        .rp-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:2px 2px 0}
        .rp-head h1{margin:0;font-size:21px;font-weight:800;letter-spacing:-.01em}
        .rp-head p{margin:0;color:var(--muted);font-size:13px}
        .rp-live{font-size:11px;font-weight:800;vertical-align:3px;padding:3px 9px;border-radius:999px;background:rgba(46,160,90,.16);color:#2ea05a;letter-spacing:.02em;white-space:nowrap}
        .rp-live.pending{background:var(--panel-2);color:var(--faint)}
        .rp-bar{position:sticky;top:0;z-index:6;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
          padding:10px 0;margin-top:6px;background:var(--bg,var(--panel));border-bottom:1px solid var(--line)}
        .rp-kpis{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin}
        .rp-kpi{flex:0 0 auto;min-width:124px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px}
        .rp-kpi b{display:block;font-size:22px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
        .rp-kpi span{display:block;font-size:10.5px;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;font-weight:700;margin-top:4px}
        .rp-kpi small{display:block;font-size:11px;color:var(--muted);margin-top:1px}
        .rp-kpi.accent b{color:var(--brand)}
        .rp-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        .rp-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font-size:12.5px;font-weight:700;
          font-family:inherit;padding:6px 12px;border-radius:8px}
        .rp-seg button.on{background:var(--brand);color:#fff}
        .rp-time{display:inline-flex;align-items:center;gap:1px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        .rp-time button{border:0;background:transparent;color:var(--ink);cursor:pointer;font-size:14px;line-height:1;padding:5px 9px;border-radius:8px}
        .rp-time button:hover:not(:disabled){background:var(--panel)}
        .rp-time button:disabled{opacity:.3;cursor:default}
        .rp-time select{border:0;background:transparent;color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;outline:none;padding:0 2px}
        .rp-range{font-size:11px;color:var(--muted);white-space:nowrap}
        .rp-ms-wrap{position:relative}
        .rp-ms{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:12.5px;font-family:inherit;cursor:pointer;outline:none}
        .rp-ms:hover,.rp-ms.on{border-color:var(--brand)}
        .rp-ms .lb{font-weight:600}
        .rp-ms .ct{background:var(--brand);color:#fff;font-size:10.5px;font-weight:800;border-radius:999px;padding:1px 7px;min-width:18px;text-align:center}
        .rp-ms .all{color:var(--faint);font-size:11.5px}
        .rp-ms .cv{opacity:.5;font-size:10px;margin-left:-2px}
        .rp-pop{position:absolute;z-index:30;top:calc(100% + 5px);left:0;min-width:210px;max-width:280px;background:var(--panel);
          border:1px solid var(--line-2);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:8px}
        .rp-pop.hidden{display:none}
        .rp-pop-s{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:12.5px;font-family:inherit;outline:none;margin-bottom:6px}
        .rp-pop-act{display:flex;gap:6px;margin-bottom:6px}
        .rp-pop-act button{flex:1;border:1px solid var(--line-2);background:var(--panel-2);color:var(--muted);font-size:11px;font-weight:700;
          border-radius:7px;padding:5px;cursor:pointer;font-family:inherit}
        .rp-pop-act button:hover{border-color:var(--brand);color:var(--ink)}
        .rp-pop-list{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
        .rp-pop-i{display:flex;align-items:center;gap:8px;padding:6px 7px;border-radius:7px;cursor:pointer;font-size:12.5px}
        .rp-pop-i:hover{background:var(--panel-2)}
        .rp-pop-i input{accent-color:var(--brand);width:15px;height:15px;flex:0 0 auto}
        .rp-pop-i span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rp-pop-none{color:var(--faint);font-size:12px;padding:8px 7px}
        .rp-spring{flex:1 1 auto}
        .rp-btn{padding:7px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:12.5px;font-family:inherit;cursor:pointer}
        .rp-btn:hover{border-color:var(--brand)}
        .rp-btn[disabled]{opacity:.4;cursor:default;pointer-events:none}
        .rp-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;max-height:calc(100vh - 232px)}
        .rp-mx{border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px}
        .rp-mx th,.rp-mx td{padding:0;text-align:center;white-space:nowrap;box-sizing:border-box}
        .rp-mx thead th{background:var(--panel-2);color:var(--faint);font-size:10.5px;font-weight:800;text-transform:uppercase;
          letter-spacing:.03em;padding:8px 6px;position:sticky;top:0;border-bottom:1px solid var(--line);cursor:pointer;z-index:1}
        .rp-mx thead th:hover{color:var(--ink)}
        .rp-mx thead th.srt{color:var(--brand)}
        .rp-mx th.fm,.rp-mx td.fm{position:sticky;left:0;background:var(--panel);text-align:left;padding:6px 12px;font-weight:600;
          font-size:12.5px;width:172px;min-width:172px;max-width:172px;overflow:hidden;text-overflow:ellipsis;border-right:1px solid var(--line);z-index:1}
        .rp-mx thead th.fm{z-index:3;cursor:pointer}
        .rp-mx th.tot,.rp-mx td.tot{position:sticky;left:172px;background:var(--panel);border-right:2px solid var(--line);z-index:1;width:76px;min-width:76px}
        .rp-mx thead th.tot{z-index:3}
        .rp-mx td.tot .rp-cell{cursor:default}
        .rp-cell{display:block;margin:2px;padding:7px 5px;border-radius:7px;font-weight:700;font-size:12.5px;cursor:pointer;line-height:1.26;min-width:78px}
        .rp-cell small{display:block;font-weight:600;opacity:.82;font-size:10.5px}
        .rp-cell.na{cursor:default}
        .rp-cell.sel{outline:2px solid var(--ink);outline-offset:-2px}
        .rp-legend{display:flex;flex-wrap:wrap;gap:9px;font-size:11px;color:var(--muted);padding:9px 2px 4px}
        .rp-legend span{display:inline-flex;align-items:center;gap:5px}.rp-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
        /* pointer-events MUST toggle with visibility — an opacity-0 fixed overlay still
           hit-tests, which made the whole page unclickable ("frozen") while it sat there */
        .rp-scrim{position:fixed;inset:0;background:rgba(15,23,42,.34);z-index:50;opacity:0;transition:opacity .2s;backdrop-filter:blur(1px);pointer-events:none;visibility:hidden}
        .rp-scrim.show{opacity:1;pointer-events:auto;visibility:visible}
        .rp-drawer{position:fixed;top:0;right:0;height:100vh;width:min(468px,94vw);background:var(--panel);z-index:51;
          box-shadow:-18px 0 48px rgba(0,0,0,.24);transform:translateX(100%);transition:transform .24s cubic-bezier(.4,0,.2,1);
          display:flex;flex-direction:column;visibility:hidden}
        .rp-drawer.show{transform:none;visibility:visible}
        .rp-dhd{padding:16px 18px 12px;border-bottom:1px solid var(--line);position:relative}
        .rp-dhd .x{position:absolute;top:12px;right:12px;border:0;background:var(--panel-2);color:var(--muted);width:30px;height:30px;
          border-radius:9px;cursor:pointer;font-size:16px;line-height:1}
        .rp-dhd .x:hover{color:var(--ink)}
        .rp-dhd .fm{font-size:16px;font-weight:800;letter-spacing:-.01em}
        .rp-dhd .wk{font-size:12px;color:var(--muted);margin-top:1px}
        .rp-dhd .big{display:flex;align-items:baseline;gap:8px;margin-top:9px}
        .rp-dhd .big b{font-size:26px;font-weight:800;letter-spacing:-.02em}
        .rp-dhd .big em{font-style:normal;font-size:12.5px;color:var(--muted)}
        .rp-dbody{overflow-y:auto;padding:12px 16px 40px;flex:1}
        .rp-sec{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);margin:6px 2px 8px}
        .rp-roll{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
        .rp-roll .row{display:flex;align-items:center;gap:8px;font-size:12px}
        .rp-roll .nm{flex:0 0 128px;display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rp-roll .dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto}
        .rp-roll .bar{flex:1;height:8px;border-radius:999px;background:var(--panel-2);overflow:hidden}
        .rp-roll .bar i{display:block;height:100%;border-radius:999px}
        .rp-roll .vn{flex:0 0 auto;font-weight:800;font-size:12px;min-width:18px;text-align:right}
        .rp-jc{border:1px solid var(--line);border-radius:11px;padding:11px 12px;margin-bottom:9px;background:var(--panel)}
        .rp-jc.excl{opacity:.72;background:var(--panel-2)}
        .rp-jc .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
        .rp-jc .jn{font-weight:800;font-size:13px}
        .rp-jc .cust{color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
        .rp-jc .meta{font-size:11.5px;color:var(--muted);margin:5px 0 7px;display:flex;gap:10px;flex-wrap:wrap}
        .rp-jc .meta b{color:var(--ink);font-weight:700}
        .rp-plats{display:flex;flex-wrap:wrap;gap:5px}
        .rp-plat{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;
          color:#fff;line-height:1.3}
        .rp-plat b{font-weight:800}
        .rp-none{font-size:11.5px;font-weight:700;color:#b91c1c;background:rgba(220,38,38,.1);padding:3px 9px;border-radius:999px;display:inline-block}
        .rp-expl{font-size:11.5px;color:var(--muted);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
        .rp-expl b{color:var(--ink)}
        .rp-exbtn{margin-top:8px;border:1px dashed var(--line-2);background:transparent;color:var(--brand);font-size:11.5px;
          font-weight:700;border-radius:8px;padding:5px 10px;cursor:pointer;font-family:inherit}
        .rp-exbtn:hover{border-color:var(--brand)}
        .rp-exform{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:6px}
        .rp-exform select,.rp-exform textarea{font:inherit;font-size:12px;border:1px solid var(--line-2);border-radius:8px;
          background:var(--panel-2);color:var(--ink);padding:7px 9px;outline:none}
        .rp-exform textarea{min-height:44px;resize:vertical}
        .rp-exform .row2{display:flex;gap:6px}
        .rp-exform .go{background:var(--brand);color:#fff;border:0;border-radius:8px;font-weight:700;font-size:12px;padding:7px 13px;cursor:pointer;font-family:inherit}
        .rp-exform .no{background:transparent;border:1px solid var(--line-2);color:var(--muted);border-radius:8px;font-size:12px;padding:7px 11px;cursor:pointer;font-family:inherit}
        .rp-ok{font-size:11.5px;font-weight:700;color:#15803d;background:rgba(22,163,74,.12);padding:4px 9px;border-radius:999px;display:inline-block;margin-top:8px}
        .rp-pill{display:inline-block;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap}
        .p-rev{background:rgba(22,163,74,.16);color:#15803d}.p-miss{background:rgba(220,38,38,.13);color:#b91c1c}
        .p-excl{background:var(--panel-2);color:var(--muted)}.p-pend{background:rgba(217,119,6,.15);color:#b45309}
        .p-high{background:rgba(220,38,38,.13);color:#b91c1c}.p-att{background:rgba(217,119,6,.15);color:#b45309}
        /* reasons view */
        .rp-rgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px}
        @media (max-width:900px){.rp-rgrid{grid-template-columns:1fr}}
        .rp-panel{border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:12px 14px}
        .rp-panel h3{margin:0 0 10px;font-size:13px;font-weight:800}
        .rp-tbl2{width:100%;border-collapse:collapse;font-size:13px}
        .rp-tbl2 th{color:var(--faint);font-size:10px;font-weight:800;text-transform:uppercase;text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);white-space:nowrap}
        .rp-tbl2 td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
        .rp-tbl2 tr:last-child td{border-bottom:none}
        .rp-tbl2 td.r{text-align:right;font-variant-numeric:tabular-nums}
        @media (max-width:640px){.rp-wrap{max-height:calc(100vh - 300px)}}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rp-head">
        <h1>Review Performance <span id="rpLive" class="rp-live pending" title="Live reviews are read straight from the Data for Reviews sheet, ahead of the ~6-hour warehouse refresh">◷ syncing live…</span></h1>
        <p>Reviews generated per foreman · <b>reviews ÷ eligible jobs</b> · target 100% · click a cell for the jobs and where each review came from — missing reviews can be explained right here →</p>
      </div>
      <div class="rp-kpis" id="rpKpis"><div class="rs-loading">Loading jobs…</div></div>
      <div class="rp-bar" id="rpBar"></div>
      <div id="rpLegend" class="rp-legend"></div>
      <div class="rp-wrap" id="rpWrapEl"><div id="rpMatrix"></div></div>
      <div id="rpReasons" style="display:none"></div>`;

    var rows;
    try { rows = await RS.load("fct_job_overview"); }
    catch (e) { document.getElementById("rpKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("rpMatrix")) return;

    // ---- LIVE reviews overlay (no 6h wait) ----
    // The warehouse's Review Received refreshes every ~6h and matches reviews to jobs by request #
    // (fragile). This overlays the LIVE "Data for Reviews" sheet via the relay, matched by Event ID
    // (robust — bypasses request-# typos, fixes both staleness and mismatches). Fetched in the
    // background; the matrix repaints when it lands. Never removes a review — only adds fresher ones.
    var RP_LIVE = { on: false, added: 0, at: null };
    function rpJsonp(url) {
      return new Promise(function (resolve, reject) {
        var cb = "__rplive_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
        var s = document.createElement("script"); var done = false;
        var clean = function () { try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); };
        var t = setTimeout(function () { if (!done) { done = true; clean(); reject(new Error("timeout")); } }, 20000);
        window[cb] = function (d) { if (done) return; done = true; clearTimeout(t); clean(); resolve(d); };
        s.onerror = function () { if (done) return; done = true; clearTimeout(t); clean(); reject(new Error("load error")); };
        s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "callback=" + cb;
        document.head.appendChild(s);
      });
    }
    var normEv = function (s) { return String(s == null ? "" : s).trim().toLowerCase().split("@")[0]; };
    function applyLive(reviews) {
      if (!reviews || !reviews.length) return 0;
      var byEv = {}, byReq = {};
      reviews.forEach(function (v) { if (v.ev) byEv[normEv(v.ev)] = v; if (v.req) byReq[String(v.req).trim()] = v; });
      var n = 0;
      rows.forEach(function (r) {
        var v = byEv[normEv(r["Event ID"])] || byReq[String(r["Job No"] || "").trim()];
        if (!v) return;
        var cur = num(r["Number of Reviews"]);
        if (v.counted > cur) {                                   // fresher than the warehouse → adopt it
          r["Number of Reviews"] = v.counted;
          r["Review Received"] = v.counted > 1 ? "Multiple Reviews Received" : "Review Received";
          if (v.source) r["Review Source"] = v.source;
          if (v.breakdown) r["Review Breakdown"] = v.breakdown;
          if (String(r["Final Status"] || "").indexOf("Missing Review") === 0) r["Final Status"] = "Review Received";
          r._live = true; n++;
        }
      });
      return n;
    }
    function paintLiveBadge() {
      var el = document.getElementById("rpLive"); if (!el) return;
      if (!RP_LIVE.on) return;
      el.classList.remove("pending");
      var tm = RP_LIVE.at ? RP_LIVE.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
      el.textContent = "● Live · " + RP_LIVE.added + " fresh review" + (RP_LIVE.added === 1 ? "" : "s") + " added" + (tm ? " · " + tm : "");
      el.title = "These reviews were read live from the Data for Reviews sheet and matched by Event ID — ahead of the ~6-hour warehouse refresh.";
    }
    rpJsonp(RP_RELAY + "?req=liveReviews").then(function (d) {
      if (d && d.ok && d.reviews) {
        var n = applyLive(d.reviews);
        RP_LIVE.on = true; RP_LIVE.added = n; RP_LIVE.at = new Date();
        if (typeof repaint === "function") repaint();
        paintLiveBadge();
      } else { var el = document.getElementById("rpLive"); if (el) el.style.display = "none"; }
    }).catch(function () { var el = document.getElementById("rpLive"); if (el) el.style.display = "none"; });

    var sources = [...new Set(rows.map(r => r["Job Source"]).filter(Boolean))].sort();
    var statuses = [...new Set(rows.map(r => r["Final Status"]).filter(Boolean))].sort();
    var billcats = ["Normal", "Attention", "High Increase", "Estimate Missing"];
    var foremenAll = [...new Set(rows.map(r => r["Foreman"]).filter(Boolean))].sort();

    // ---- multiselect popover component (unchanged pattern) ----
    var barEl = document.getElementById("rpBar");
    var openPops = [];
    function closePops(except) { openPops.forEach(p => { if (p.el !== except) p.el.classList.add("hidden"); }); }
    document.addEventListener("click", function docClk(e) {
      if (!barEl.isConnected) { document.removeEventListener("click", docClk); return; }
      if (!e.target.closest(".rp-ms-wrap")) closePops(null);
    });
    function mkMulti(mount, cfg) {
      var wrap = document.createElement("div"); wrap.className = "rp-ms-wrap";
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "rp-ms";
      var pop = document.createElement("div"); pop.className = "rp-pop hidden";
      wrap.appendChild(btn); wrap.appendChild(pop); mount.appendChild(wrap);
      openPops.push({ el: pop });
      function paintBtn() {
        var n = cfg.sel.size;
        var right = n === 0 ? `<span class="all">All</span>` : `<span class="ct">${n}</span>`;
        btn.classList.toggle("on", n > 0);
        btn.innerHTML = `<span class="lb">${esc(cfg.label)}</span>${right}<span class="cv">▾</span>`;
      }
      function paintPop(q) {
        q = (q || "").toLowerCase();
        var opts = cfg.options.filter(o => !q || o.label.toLowerCase().indexOf(q) >= 0);
        pop.innerHTML =
          (cfg.search ? `<input class="rp-pop-s" type="text" placeholder="Search ${esc(cfg.label.toLowerCase())}…" autocomplete="off">` : "") +
          `<div class="rp-pop-act"><button type="button" data-a="all">Select all</button><button type="button" data-a="clear">Clear</button></div>` +
          (opts.length ? `<div class="rp-pop-list">` + opts.map(o =>
            `<label class="rp-pop-i"><input type="checkbox" value="${esc(o.v)}"${cfg.sel.has(o.v) ? " checked" : ""}><span>${esc(o.label)}</span></label>`).join("") + `</div>`
            : `<div class="rp-pop-none">No matches.</div>`);
        var s = pop.querySelector(".rp-pop-s");
        if (s) { s.value = q; s.oninput = () => paintPop(s.value); setTimeout(() => s.focus(), 0); }
        pop.querySelectorAll(".rp-pop-act button").forEach(b => b.onclick = () => {
          if (b.dataset.a === "clear") cfg.sel.clear();
          else opts.forEach(o => cfg.sel.add(o.v));
          paintPop(q); paintBtn(); cfg.onChange();
        });
        pop.querySelectorAll(".rp-pop-i input").forEach(c => c.onchange = () => {
          if (c.checked) cfg.sel.add(c.value); else cfg.sel.delete(c.value);
          paintBtn(); cfg.onChange();
        });
      }
      btn.onclick = e => {
        e.stopPropagation();
        var wasOpen = !pop.classList.contains("hidden");
        closePops(pop);
        if (wasOpen) { pop.classList.add("hidden"); return; }
        paintPop(""); pop.classList.remove("hidden");
      };
      pop.onclick = e => e.stopPropagation();
      paintBtn();
      return { paintBtn };
    }

    // ---- toolbar ----
    var bar = barEl;
    function mkSeg(items, cur, onPick) {
      var d = document.createElement("div"); d.className = "rp-seg";
      items.forEach(it => {
        var b = document.createElement("button"); b.type = "button"; b.textContent = it.label;
        b.classList.toggle("on", it.v === cur());
        b.onclick = () => { onPick(it.v); [...d.children].forEach((c, i) => c.classList.toggle("on", items[i].v === cur())); };
        d.appendChild(b);
      });
      return d;
    }
    bar.appendChild(mkSeg(
      [{ v: "perf", label: "Performance" }, { v: "reasons", label: "Reasons" }],
      () => RP.view,
      v => { RP.view = v; closeDrawer(); repaint(); }));
    bar.appendChild(mkSeg(
      [{ v: "day", label: "Daily" }, { v: "week", label: "Weekly" }, { v: "month", label: "Monthly" }],
      () => RP.grain,
      v => { RP.grain = v; RP.offset = 0; RP.sortCol = null; closeDrawer(); paintWinOpts(); repaint(); }));
    var timeWrap = document.createElement("div"); timeWrap.className = "rp-time";
    timeWrap.innerHTML = `<button type="button" id="rpOlder" title="Older">‹</button><select id="rpWin"></select><button type="button" id="rpNewer" title="Newer">›</button>`;
    bar.appendChild(timeWrap);
    var rangeLbl = document.createElement("span"); rangeLbl.className = "rp-range"; rangeLbl.id = "rpRange";
    bar.appendChild(rangeLbl);
    function paintWinOpts() {
      var sel = document.getElementById("rpWin"), unit = RP.grain === "day" ? "days" : RP.grain === "week" ? "weeks" : "months";
      sel.innerHTML = RP_WIN[RP.grain].map(w => `<option value="${w}"${w === win() ? " selected" : ""}>${w} ${unit}</option>`).join("");
    }
    paintWinOpts();
    var msControls = [
      mkMulti(bar, { label: "Source", options: sources.map(s => ({ v: s, label: s })), sel: RP.sources, search: true, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Status", options: statuses.map(s => ({ v: s, label: s })), sel: RP.statuses, search: false, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Bill", options: billcats.map(s => ({ v: s, label: s })), sel: RP.billcats, search: false, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Foreman", options: foremenAll.map(s => ({ v: s, label: s })), sel: RP.foremen, search: true, onChange: () => { closeDrawer(); repaint(); } }),
    ];
    var spring = document.createElement("span"); spring.className = "rp-spring"; bar.appendChild(spring);
    var resetBtn = document.createElement("button"); resetBtn.type = "button"; resetBtn.className = "rp-btn"; resetBtn.textContent = "Reset";
    var csvBtn = document.createElement("button"); csvBtn.type = "button"; csvBtn.className = "rp-btn"; csvBtn.innerHTML = "⬇ CSV";
    bar.appendChild(resetBtn); bar.appendChild(csvBtn);

    function inSet(set, v) { return set.size === 0 || set.has(v); }
    function filtered() {
      return rows.filter(r =>
        inSet(RP.sources, r["Job Source"]) &&
        inSet(RP.statuses, r["Final Status"]) &&
        inSet(RP.billcats, r["Bill Increase Category"]) &&
        inSet(RP.foremen, r["Foreman"]));
    }
    function allCols() {
      return [...new Set(rows.map(colKey).filter(Boolean))].sort().reverse();
    }
    function windowCols() {
      var ac = allCols();
      var start = Math.min(RP.offset, Math.max(0, ac.length - win()));
      return ac.slice(start, start + win());
    }

    // ---- explain-reason action (posts to the SAME relay as the Slack form) ----
    function submitExplain(r, reason, note) {
      var who = "portal";
      try { who = (window.ZTZ && ZTZ.email && ZTZ.email()) || "portal"; } catch (e) {}
      try {
        fetch(RP_RELAY, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ kind: "reviewReason", jobCode: String(r["Job No"] || ""),
            foreman: String(r["Foreman"] || ""), date: String(r["Job Date"] || "").slice(0, 10),
            reason: reason, note: (note ? note + " — " : "") + "via portal (" + who + ")" }) });
      } catch (e) {}
      // optimistic local update — the warehouse ingests the sheet within ~6h
      r["Foreman Response Received"] = "Yes";
      r["Foreman Reason"] = reason;
      r["Foreman Explanation"] = reason + (note ? " — " + note : "");
      if (r["Final Status"] === "Missing Review – Waiting for Response") r["Final Status"] = "Missing Review – Explanation Received";
    }
    function explainFormHTML(idx) {
      return `<div class="rp-exform" data-exform="${idx}">
        <select data-exr>${RP_REASONS.map(x => `<option>${esc(x)}</option>`).join("")}</select>
        <textarea data-exn placeholder="Optional note…"></textarea>
        <div class="row2"><button type="button" class="go" data-exgo>Save reason</button>
        <button type="button" class="no" data-exno>Cancel</button></div></div>`;
    }
    function wireExplain(container, jobs, onSaved) {
      container.querySelectorAll("[data-exbtn]").forEach(b => b.onclick = () => {
        var i = b.dataset.exbtn;
        b.insertAdjacentHTML("afterend", explainFormHTML(i));
        b.style.display = "none";
        var f = container.querySelector(`[data-exform="${i}"]`);
        f.querySelector("[data-exno]").onclick = () => { f.remove(); b.style.display = ""; };
        f.querySelector("[data-exgo]").onclick = () => {
          var r = jobs[+i];
          submitExplain(r, f.querySelector("[data-exr]").value, f.querySelector("[data-exn]").value.trim());
          f.outerHTML = `<span class="rp-ok">✓ Saved — shows here now, syncs to the warehouse within ~6h</span>`;
          if (onSaved) onSaved();
        };
      });
    }

    // ---- drawer ----
    var scrim = document.createElement("div"); scrim.className = "rp-scrim";
    var drawer = document.createElement("div"); drawer.className = "rp-drawer";
    host.appendChild(scrim); host.appendChild(drawer);
    function closeDrawer() {
      scrim.classList.remove("show"); drawer.classList.remove("show");
      RP.cell = null;
      RP.wlPage = 0;   // every view-changing control calls closeDrawer — reset the worklist page too
      var m = document.getElementById("rpMatrix"); if (m) m.querySelectorAll(".rp-cell.sel").forEach(el => el.classList.remove("sel"));
    }
    scrim.onclick = closeDrawer;
    document.addEventListener("keydown", function esckey(e) {
      if (!drawer.isConnected) { document.removeEventListener("keydown", esckey); return; }
      if (e.key === "Escape" && drawer.classList.contains("show")) closeDrawer();
    });

    var stPill = s => {
      var m = { "Review Received": "p-rev", "Multiple Reviews Received": "p-rev", "Excluded – Support Intervention": "p-excl",
        "Review Match Pending": "p-pend", "Missing Review – Explanation Received": "p-att",
        "Missing Review – Waiting for Response": "p-miss", "Data Missing": "p-excl" };
      return `<span class="rp-pill ${m[s] || "p-excl"}">${esc(s)}</span>`;
    };

    function drill(fm, col) {
      var jobs = filtered().filter(r => (r["Foreman"] || "—") === fm && colKey(r) === col)
        .sort((a, b) => num(b["Number of Reviews"]) - num(a["Number of Reviews"]) || num(b["Eligible"]) - num(a["Eligible"]) || String(a["Job Date"]).localeCompare(String(b["Job Date"])));
      var R = jobs.filter(r => num(r["Eligible"]) === 1).reduce((s, r) => s + num(r["Number of Reviews"]), 0);
      var J = jobs.filter(r => num(r["Eligible"]) === 1).length;
      var pct = J ? Math.round(R / J * 100) : 0, b = band(pct);

      var roll = {};
      jobs.forEach(r => parseBk(r["Review Breakdown"]).forEach(p => { roll[p.src] = (roll[p.src] || 0) + p.n; }));
      var rollArr = Object.keys(roll).map(k => ({ src: k, n: roll[k] })).sort((a, b) => b.n - a.n);
      var rollMax = rollArr.reduce((m, x) => Math.max(m, x.n), 0);
      var rollTot = rollArr.reduce((s, x) => s + x.n, 0);
      var rollHtml = rollArr.length ? `<div class="rp-sec">Where the reviews came from · ${rollTot} total</div><div class="rp-roll">` +
        rollArr.map(x => `<div class="row"><span class="nm"><i class="dot" style="background:${platColor(x.src)}"></i>${esc(x.src)}</span>
          <span class="bar"><i style="width:${rollMax ? Math.round(x.n / rollMax * 100) : 0}%;background:${platColor(x.src)}"></i></span>
          <span class="vn">${x.n}</span></div>`).join("") + `</div>`
        : `<div class="rp-sec">Where the reviews came from</div><div class="rp-none" style="margin:0 2px 14px">No reviews written for these jobs yet</div>`;

      var billPill = c => c === "High Increase" ? `<span class="rp-pill p-high">High +bill</span>`
        : c === "Attention" ? `<span class="rp-pill p-att">+bill</span>` : "";

      var cards = jobs.map((r, i) => {
        var elig = num(r["Eligible"]) === 1;
        var bk = parseBk(r["Review Breakdown"]);
        var revHtml = bk.length
          ? `<div class="rp-plats">` + bk.map(p => `<span class="rp-plat" style="background:${platColor(p.src)}">${esc(p.src)}${p.n > 1 ? ` <b>×${p.n}</b>` : ""}</span>`).join("") + `</div>`
          : `<span class="rp-none">No review written</span>`;
        var dpct = r["Bill Increase %"] == null || r["Bill Increase %"] === "" ? null : num(r["Bill Increase %"]);
        var expl = elig ? "" : `<div class="rp-expl"><b>Excluded:</b> ${esc(r["Exclusion Reason"] || "—")}${r["Support Intervention Reason"] ? " · " + esc(r["Support Intervention Reason"]) : ""}</div>`;
        var fexpl = (r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim()) ? `<div class="rp-expl"><b>Explanation:</b> ${esc(r["Foreman Explanation"])}</div>` : "";
        var canExplain = elig && num(r["Number of Reviews"]) === 0 && !(r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim());
        return `<div class="rp-jc${elig ? "" : " excl"}">
          <div class="top"><span class="jn">#${esc(r["Job No"] || "")}</span><span class="cust">${esc(r["Customer"] || "—")}</span>
            <span style="flex:1"></span>${stPill(r["Final Status"])}</div>
          <div class="meta"><span>${esc(shortD(String(r["Job Date"] || "").slice(0, 10)))}</span>
            <span>${esc(r["Job Source"] || "—")}</span>
            <span><b>${money(r["Estimate Bill"])}</b> → <b>${money(r["Actual Bill"])}</b>${dpct != null ? ` <span style="color:${dpct > 0 ? "#b45309" : "var(--muted)"}">(${dpct > 0 ? "+" : ""}${dpct}%)</span>` : ""}</span>
            ${billPill(r["Bill Increase Category"])}</div>
          ${revHtml}${fexpl}${expl}
          ${canExplain ? `<button type="button" class="rp-exbtn" data-exbtn="${i}">✍ Explain why there's no review</button>` : ""}</div>`;
      }).join("");

      drawer.innerHTML = `
        <div class="rp-dhd">
          <button class="x" id="rpDx" title="Close">✕</button>
          <div class="fm">${esc(fm)}</div>
          <div class="wk">${esc(colLong(col))}</div>
          <div class="big"><b style="color:${b.bg === "#e5e7eb" || b.bg === "#fecaca" || b.bg === "#bbf7d0" ? "var(--ink)" : b.bg}">${pct}%</b>
            <em>${R} review${R === 1 ? "" : "s"} · ${J} eligible job${J === 1 ? "" : "s"} · ${jobs.length} completed</em></div>
        </div>
        <div class="rp-dbody">${rollHtml}
          <div class="rp-sec">Jobs (${jobs.length})</div>${cards || `<div class="rp-none">No jobs.</div>`}</div>`;
      drawer.querySelector("#rpDx").onclick = closeDrawer;
      wireExplain(drawer, jobs, () => { paintKpis(filteredWindowed()); });
      scrim.classList.add("show"); drawer.classList.add("show");
    }

    function filteredWindowed() {
      var colSet = new Set(windowCols());
      return filtered().filter(r => colSet.has(colKey(r)));
    }

    function paintKpis(data) {
      var tot = { completed: 0, eligible: 0, reviews: 0, jobsWithReview: 0, support: 0, missing: 0, noResp: 0, highBill: 0 };
      data.forEach(r => {
        var elig = num(r["Eligible"]) === 1, nrev = num(r["Number of Reviews"]);
        tot.completed++; if (elig) { tot.eligible++; tot.reviews += nrev; if (nrev > 0) tot.jobsWithReview++; }
        if (yes(r["Support Intervention"])) tot.support++;
        if (elig && nrev === 0) { tot.missing++; if (!yes(r["Foreman Response Received"])) tot.noResp++; }
        if (r["Bill Increase Category"] === "High Increase") tot.highBill++;
      });
      var K = [
        { l: "Completed", v: N(tot.completed), s: "in view" },
        { l: "Eligible", v: N(tot.eligible), s: N(tot.completed - tot.eligible) + " excluded" },
        { l: "Reviews", v: N(tot.reviews), s: N(tot.jobsWithReview) + " jobs ≥1", a: 1 },
        { l: "Review %", v: tot.eligible ? Math.round(tot.reviews / tot.eligible * 100) + "%" : "—", s: "target 100%", a: 1 },
        { l: "Support excl.", v: N(tot.support), s: "interventions" },
        { l: "Missing", v: N(tot.missing), s: "eligible, no review" },
        { l: "No explanation", v: N(tot.noResp), s: "waiting for reason" },
        { l: "High +bill", v: N(tot.highBill), s: "> 25% over est." },
      ];
      document.getElementById("rpKpis").innerHTML = K.map(k =>
        `<div class="rp-kpi${k.a ? " accent" : ""}"><b>${k.v}</b><span>${k.l}</span><small>${k.s}</small></div>`).join("");
      return tot;
    }

    // ---- Performance view (matrix) ----
    function paintMatrix() {
      var cols = windowCols();
      var data = filteredWindowed();
      var cells = {}, foremen = {};
      data.forEach(r => {
        var fm = r["Foreman"] || "—", c0 = colKey(r), elig = num(r["Eligible"]) === 1;
        var nrev = num(r["Number of Reviews"]);
        var c = cells[fm + "||" + c0] || (cells[fm + "||" + c0] = { R: 0, J: 0 });
        if (elig) { c.J++; c.R += nrev; }
        var f = foremen[fm] || (foremen[fm] = { completed: 0, J: 0, R: 0 });
        f.completed++; if (elig) { f.J++; f.R += nrev; }
      });
      paintKpis(data);

      var ac = allCols(), maxOff = Math.max(0, ac.length - win());
      document.getElementById("rpRange").textContent = cols.length ? colLabel(cols[cols.length - 1]) + " – " + colLabel(cols[0]) : "—";
      document.getElementById("rpOlder").disabled = RP.offset >= maxOff;
      document.getElementById("rpNewer").disabled = RP.offset <= 0;

      function sortVal(fm) {
        if (RP.sortCol === "total") { var f = foremen[fm]; return f.J ? f.R / f.J : -1; }
        if (RP.sortCol) { var c = cells[fm + "||" + RP.sortCol]; return (c && c.J) ? c.R / c.J : -1; }
        return foremen[fm].completed;
      }
      var fmList = Object.keys(foremen);
      if (RP.sortCol === "__name") fmList.sort((a, b) => RP.sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));
      else fmList.sort((a, b) => { var d = sortVal(a) - sortVal(b); if (d === 0) d = foremen[b].completed - foremen[a].completed; return RP.sortDir === "asc" ? d : -d; });

      var caret = key => RP.sortCol === key ? (RP.sortDir === "asc" ? " ▲" : " ▼") : "";
      var head = `<tr><th class="fm${RP.sortCol === "__name" ? " srt" : ""}" data-srt="__name">Foreman${caret("__name")}</th>` +
        `<th class="tot${RP.sortCol === "total" ? " srt" : ""}" data-srt="total">Overall${caret("total")}</th>` +
        cols.map(c => `<th class="${RP.sortCol === c ? "srt" : ""}" data-srt="${c}">${colLabel(c)}${caret(c)}</th>`).join("") + `</tr>`;
      var body = fmList.map(fm => {
        var f = foremen[fm], tpct = f.J ? Math.round(f.R / f.J * 100) : null, tb = tpct == null ? null : band(tpct);
        var totCell = tpct == null
          ? `<td class="tot"><span class="rp-cell na" style="background:#f3f4f6;color:#9ca3af">${f.R} / ${f.J}<small>N/A</small></span></td>`
          : `<td class="tot"><span class="rp-cell" style="background:${tb.bg};color:${tb.fg};cursor:default">${f.R} / ${f.J}<small>${tpct}%</small></span></td>`;
        var tds = cols.map(c0 => {
          var c = cells[fm + "||" + c0];
          if (!c || c.J === 0) return `<td><span class="rp-cell na" style="background:#f3f4f6;color:#9ca3af">0 / 0<small>—</small></span></td>`;
          var pct = Math.round(c.R / c.J * 100), b = band(pct);
          var sel = RP.cell === fm + "||" + c0 ? " sel" : "";
          return `<td><span class="rp-cell${sel}" style="background:${b.bg};color:${b.fg}" data-fm="${esc(fm)}" data-col="${c0}">${c.R} / ${c.J}<small>${pct}%</small></span></td>`;
        }).join("");
        return `<tr><td class="fm">${esc(fm)}</td>${totCell}${tds}</tr>`;
      }).join("");

      document.getElementById("rpMatrix").innerHTML = fmList.length
        ? `<table class="rp-mx"><thead>${head}</thead><tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:22px">No jobs match these filters.</div>`;
      document.getElementById("rpLegend").innerHTML = RP_BANDS.map(b => `<span><i style="background:${b.bg}"></i>${b.label}</span>`).join("") +
        `<span><i style="background:#f3f4f6;border:1px solid var(--line)"></i>no eligible jobs</span>`;

      document.querySelectorAll("#rpMatrix thead th[data-srt]").forEach(th => th.onclick = () => {
        var key = th.dataset.srt;
        if (RP.sortCol === key) RP.sortDir = RP.sortDir === "asc" ? "desc" : "asc";
        else { RP.sortCol = key; RP.sortDir = "desc"; }
        closeDrawer(); paintMatrix();
      });
      document.querySelectorAll("#rpMatrix .rp-cell:not(.na)[data-fm]").forEach(el => el.onclick = () => {
        RP.cell = el.dataset.fm + "||" + el.dataset.col;
        document.querySelectorAll("#rpMatrix .rp-cell.sel").forEach(s => s.classList.remove("sel"));
        el.classList.add("sel");
        drill(el.dataset.fm, el.dataset.col);
      });
    }

    // ---- Reasons view ----
    function paintReasons() {
      var data = filteredWindowed();
      var tot = paintKpis(data);
      var missing = data.filter(r => num(r["Eligible"]) === 1 && num(r["Number of Reviews"]) === 0);
      var explained = missing.filter(r => yes(r["Foreman Response Received"]) || (r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim()));
      var waiting = missing.length - explained.length;

      // reason distribution
      var byReason = {};
      explained.forEach(r => { var k = String(r["Foreman Reason"] || "").trim() || "(reason not parsed)"; byReason[k] = (byReason[k] || 0) + 1; });
      var reasonArr = Object.keys(byReason).map(k => ({ k, n: byReason[k] })).sort((a, b) => b.n - a.n);
      var rMax = Math.max(waiting, reasonArr.reduce((m, x) => Math.max(m, x.n), 0), 1);
      var barsHtml = reasonArr.map(x => `<div class="row"><span class="nm" title="${esc(x.k)}">${esc(x.k.length > 30 ? x.k.slice(0, 29) + "…" : x.k)}</span>
          <span class="bar"><i style="width:${Math.round(x.n / rMax * 100)}%;background:var(--brand)"></i></span><span class="vn">${x.n}</span></div>`).join("") +
        `<div class="row"><span class="nm" style="color:var(--faint)">No explanation yet</span>
          <span class="bar"><i style="width:${Math.round(waiting / rMax * 100)}%;background:#9ca3af"></i></span><span class="vn">${waiting}</span></div>`;

      // per-foreman accountability
      var byFm = {};
      missing.forEach(r => {
        var f = r["Foreman"] || "—";
        var o = byFm[f] || (byFm[f] = { miss: 0, exp: 0, reasons: {} });
        o.miss++;
        var re = String(r["Foreman Reason"] || "").trim();
        if (yes(r["Foreman Response Received"]) || re) { o.exp++; if (re) o.reasons[re] = (o.reasons[re] || 0) + 1; }
      });
      var fmArr = Object.keys(byFm).map(f => {
        var o = byFm[f];
        var top = Object.entries(o.reasons).sort((a, b) => b[1] - a[1])[0];
        return { f, miss: o.miss, exp: o.exp, wait: o.miss - o.exp, top: top ? top[0] + " (" + top[1] + ")" : "—" };
      }).sort((a, b) => b.wait - a.wait || b.miss - a.miss);
      var fmRows = fmArr.map(x => `<tr><td>${esc(x.f)}</td><td class="r">${x.miss}</td><td class="r">${x.exp}</td>
        <td class="r" style="font-weight:800;color:${x.wait ? "#b91c1c" : "#15803d"}">${x.wait}</td><td>${esc(x.top)}</td></tr>`).join("");

      // per-period trend
      var byCol = {};
      data.forEach(r => {
        if (num(r["Eligible"]) !== 1 || num(r["Number of Reviews"]) !== 0) return;
        var c = colKey(r), o = byCol[c] || (byCol[c] = { miss: 0, exp: 0 });
        o.miss++;
        if (yes(r["Foreman Response Received"]) || (r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim())) o.exp++;
      });
      var trendRows = windowCols().map(c => {
        var o = byCol[c] || { miss: 0, exp: 0 };
        var pr = o.miss ? Math.round(o.exp / o.miss * 100) : null;
        return `<tr><td>${esc(colLabel(c))}</td><td class="r">${o.miss}</td><td class="r">${o.exp}</td>
          <td class="r">${pr == null ? "—" : pr + "%"}</td></tr>`;
      }).join("");

      // worklist: waiting jobs first, then explained — with the inline explain action.
      // Paginated 20/page (Tornike 2026-07-14) — data-exbtn carries the ABSOLUTE index
      // into `work` so wireExplain resolves the right job on any page.
      var WL_PAGE = 20;
      var work = missing.slice().sort((a, b) =>
        (yes(a["Foreman Response Received"]) ? 1 : 0) - (yes(b["Foreman Response Received"]) ? 1 : 0) ||
        String(b["Job Date"]).localeCompare(String(a["Job Date"])));
      var wlPages = Math.max(1, Math.ceil(work.length / WL_PAGE));
      if (RP.wlPage >= wlPages) RP.wlPage = wlPages - 1;
      if (RP.wlPage < 0) RP.wlPage = 0;
      var wlStart = RP.wlPage * WL_PAGE;
      var workRows = work.slice(wlStart, wlStart + WL_PAGE).map((r, i) => {
        var expl = String(r["Foreman Explanation"] || "").trim();
        return `<tr><td><b>#${esc(r["Job No"] || "")}</b><br><span style="color:var(--muted)">${esc(r["Customer"] || "—")}</span></td>
          <td>${esc(r["Foreman"] || "—")}</td>
          <td>${esc(shortD(String(r["Job Date"] || "").slice(0, 10)))}</td>
          <td>${expl ? esc(expl) : `<span class="rp-pill p-miss">waiting</span><button type="button" class="rp-exbtn" style="margin:4px 0 0" data-exbtn="${wlStart + i}">✍ Explain</button>`}</td></tr>`;
      }).join("");
      var wlPager = wlPages > 1 ? `<div style="display:flex;align-items:center;gap:10px;justify-content:flex-end;padding:10px 2px 0;font-size:13px;color:var(--muted)">
        <button type="button" class="rp-btn" data-wlprev${RP.wlPage === 0 ? " disabled" : ""}>‹ Prev</button>
        <span>Page <b style="color:var(--ink)">${RP.wlPage + 1}</b> of ${wlPages}</span>
        <button type="button" class="rp-btn" data-wlnext${RP.wlPage >= wlPages - 1 ? " disabled" : ""}>Next ›</button></div>` : "";

      var el = document.getElementById("rpReasons");
      el.innerHTML = `
        <div class="rp-rgrid">
          <div class="rp-panel"><h3>Why reviews are missing · ${N(explained.length)} of ${N(missing.length)} explained</h3>
            <div class="rp-roll">${barsHtml}</div></div>
          <div class="rp-panel"><h3>Response rate by ${RP.grain}</h3>
            <div style="overflow-x:auto"><table class="rp-tbl2"><thead><tr><th>${RP.grain === "day" ? "Day" : RP.grain === "week" ? "Week" : "Month"}</th><th style="text-align:right">Missing</th><th style="text-align:right">Explained</th><th style="text-align:right">Resp. %</th></tr></thead><tbody>${trendRows}</tbody></table></div></div>
        </div>
        <div class="rp-panel" style="margin-top:12px"><h3>Foreman accountability — who owes explanations</h3>
          <div style="overflow-x:auto"><table class="rp-tbl2"><thead><tr><th>Foreman</th><th style="text-align:right">Missing</th><th style="text-align:right">Explained</th><th style="text-align:right">Waiting</th><th>Top reason</th></tr></thead><tbody>${fmRows || `<tr><td colspan="5" style="color:var(--faint)">Nothing missing in this window 🎉</td></tr>`}</tbody></table></div></div>
        <div class="rp-panel" style="margin-top:12px"><h3>Missing-review jobs (${N(missing.length)}) — explain right here</h3>
          <div style="overflow-x:auto"><table class="rp-tbl2"><thead><tr><th>Job</th><th>Foreman</th><th>Date</th><th>Reason / action</th></tr></thead><tbody>${workRows || `<tr><td colspan="4" style="color:var(--faint)">None in this window.</td></tr>`}</tbody></table></div>${wlPager}</div>`;
      wireExplain(el, work, () => paintReasons());
      var wp = el.querySelector("[data-wlprev]"), wn = el.querySelector("[data-wlnext]");
      if (wp) wp.onclick = () => { RP.wlPage--; paintReasons(); };
      if (wn) wn.onclick = () => { RP.wlPage++; paintReasons(); };

      var ac = allCols(), maxOff = Math.max(0, ac.length - win());
      var cols = windowCols();
      document.getElementById("rpRange").textContent = cols.length ? colLabel(cols[cols.length - 1]) + " – " + colLabel(cols[0]) : "—";
      document.getElementById("rpOlder").disabled = RP.offset >= maxOff;
      document.getElementById("rpNewer").disabled = RP.offset <= 0;
    }

    function repaint() {
      var perf = RP.view === "perf";
      document.getElementById("rpWrapEl").style.display = perf ? "" : "none";
      document.getElementById("rpLegend").style.display = perf ? "" : "none";
      document.getElementById("rpReasons").style.display = perf ? "none" : "";
      if (perf) paintMatrix(); else paintReasons();
    }

    // ---- control wiring ----
    document.getElementById("rpWin").onchange = e => {
      if (RP.grain === "day") RP.winD = +e.target.value;
      else if (RP.grain === "week") RP.winW = +e.target.value;
      else RP.winM = +e.target.value;
      RP.offset = 0; closeDrawer(); repaint();
    };
    document.getElementById("rpOlder").onclick = () => { RP.offset = Math.min(Math.max(0, allCols().length - win()), RP.offset + win()); closeDrawer(); repaint(); };
    document.getElementById("rpNewer").onclick = () => { RP.offset = Math.max(0, RP.offset - win()); closeDrawer(); repaint(); };
    resetBtn.onclick = () => {
      RP.sources.clear(); RP.statuses.clear(); RP.billcats.clear(); RP.foremen.clear();
      RP.sortCol = null; RP.sortDir = "desc"; RP.offset = 0;
      closeDrawer();
      msControls.forEach(c => c.paintBtn());
      repaint();
    };
    csvBtn.onclick = () => {
      var cols = ["Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Job Source", "Job Type", "Estimate Bill",
        "Actual Bill", "Bill Increase Amount", "Bill Increase %", "Bill Increase Category", "Review Received", "Number of Reviews",
        "Review Source", "Review Breakdown", "Eligible", "Support Intervention", "Support Intervention Reason", "Review Expected",
        "Exclusion Reason", "Foreman Response Received", "Foreman Reason", "Foreman Explanation", "Final Status"];
      var q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
      var lines = [cols.join(",")].concat(filtered().map(r => cols.map(c => q(r[c])).join(",")));
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = "review-performance.csv"; a.click(); URL.revokeObjectURL(a.href);
    };

    RP.cell = null;
    repaint();
  },
});
