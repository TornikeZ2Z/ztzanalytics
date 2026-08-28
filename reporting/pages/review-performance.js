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
      // A trimmed list, not the full 34 columns — that fetch was ~12 MB and froze the tab
      // (audit + Tornike 2026-07-13). Kept as-is after the CSV export was removed: this list
      // is a payload contract. Add columns here only together with a real consumer.
      cols: [
        // "Job Code" ADDED 2026-08-11. `Job No` is the calendar's CONNECTOR -- the Moveboard
        // request # when there is one, else the job code -- so this row could not tell you the
        // code, and the explain button below had nothing else to file a reason under.
        "Week Ending", "Job Date", "Job No", "Job Code", "Customer", "Foreman", "Job Source", "Job Type",
        "Estimate Bill", "Actual Bill", "Bill Increase Amount", "Bill Increase %",
        "Bill Increase Category", "Review Received", "Number of Reviews", "Review Source",
        "Review Breakdown", "Eligible", "Support Intervention", "Support Intervention Reason",
        // Date/Type ADDED 2026-07-16 for the Support Interventions list (their consumer).
        // "Support Notes" DROPPED 2026-07-25: job_overview.py emits it as a literal NULL, so the
        // column was structurally always blank — shipped bytes for an empty table column.
        "Support Intervention Date", "Support Intervention Type",
        "Review Expected", "Exclusion Reason", "Closing Filed",
        "Foreman Response Received", "Foreman Reason",
        "Foreman Explanation", "Final Status", "Event ID",
      ],
    };
  }
  // Jobs the calendar has but no closing sheet does. NOTHING ON THIS PAGE READS THIS ANY
  // MORE: the banner it fed was removed on Tornike's word (2026-08-11), because unfiled
  // recent moves have been IN the report since 2026-07-21 — the foreman comes from the
  // calendar and only the money columns wait on the paperwork. The registration is left
  // standing because the table and its grant are still there and the column contract is the
  // hard part to rebuild; declaring a dataset costs nothing until something calls RS.load.
  if (window.RS && RS.DATASETS && !RS.DATASETS.jobs_pending_closing) {
    RS.DATASETS.jobs_pending_closing = {
      table: "fct_jobs_pending_closing",
      cols: ["Job Date", "Job No", "Customer", "Foreman", "Days Old", "Status"],
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
// same relay as the foremen's Slack form (review_response.html) — ONE system of record
var RP_RELAY = "https://script.google.com/macros/s/AKfycbzX3q9VqyZKd3FUbGCPKN9JcQgcp15rz0QXxzNnxTYeXSRCY16Ei8n_9D07c9EQvOxM/exec";
// FALLBACK ONLY — the real list is the relay's live config (loaded per page view below).
// This used to be the actual list, and it silently drifted: the office added "Other
// (Comment)" and admins here had NO Other option at all (quality team, 2026-07-20).
// A hardcoded reason list is the same staleness trap as a stale Apps Script deployment.
var RP_REASONS_FALLBACK = ["Customer refused", "The customer was dissatisfied", "Open claim",
  "Support intervention was required", "Billing issue", "The customer promised to write later",
  "Elderly customer (not comfortable with technology)", "No internet / poor internet connection",
  "Customer was unfriendly / not willing to engage", "Other (Comment)"];
var RP_LIVE_REASONS = null;   // filled from the relay config; survives repaints
function rpReasons() {
  var list = (RP_LIVE_REASONS && RP_LIVE_REASONS.length) ? RP_LIVE_REASONS.slice() : RP_REASONS_FALLBACK.slice();
  // whatever happens to the config, an Other option must exist — it is the escape hatch
  if (!list.some(function (x) { return /^other\b/i.test(String(x)); })) list.push("Other (Comment)");
  return list;
}
function rpLoadReasons() {
  // the bridge caches this relay read server-side, so it is cheap when warm; fired in the
  // background at render so the list is live by the time anyone opens an explain form
  fetch(ZTZ.API + "/api/_rrp?req=reviewData", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      var rs = d && d.config && d.config.reasons;
      if (rs && rs.length) RP_LIVE_REASONS = rs.map(function (x) { return String(x); });
    })
    .catch(function () {});   // fallback list already covers the form
}
var RP = { sources: new Set(), statuses: new Set(), billcats: new Set(), foremen: new Set(),
  grain: "week", winD: 14, winW: 12, winM: 6, offset: 0, sortCol: null, sortDir: "desc", cell: null, view: "perf",
  wlPage: 0, supPage: 0, supQ: "", supType: "",
  bdWeek: null, bdKey: "rev" };

registerPage({
  id: "review-performance",
  group: "reviews",
  title: "Foreman Performance",   // renamed 2026-07-16; Reasons tab moved to the Response Analysis page
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
        /* ================= WHAT IS LEFT HERE, AND WHY =================
           The bar, buttons, segments, data tables, pills, panels, KPI tiles and reading
           hints all come from the shared kit in rs.css now. Everything below is either a
           ONE-LINE adjustment to a kit component, or something the kit has no word for:
           the foreman x period matrix and its band cells, the drill-down drawer, the two
           prev/next steppers, the multiselect popover, and the standings podium. */

        /* ---- narrow adjustments layered on kit components ---- */
        /* the live-sync badge IS a kit pill; a pill set inside an <h1> needs the lift, and
           "not synced yet" is a state the pill vocabulary does not name */
        .rp-live{vertical-align:3px}
        .rp-live.pending{background:var(--panel-2);color:var(--faint)}
        /* the kit bar, PINNED: the matrix scrolls underneath it and its controls have to stay
           reachable. Nothing on these three rows carries a label above it, so they centre. */
        .rp-bar{position:sticky;top:0;z-index:6;padding:10px 0;margin:6px 0 0;
          background:var(--bg,var(--panel));border-bottom:1px solid var(--line)}
        .rp-bar,.rp-supbar,.rp-bdbar{align-items:center}
        .rp-bdbar{margin-bottom:14px}
        .rp-supbar .rs-inp{flex:1}
        .rp-supchips{flex-wrap:wrap}
        .rp-rgrid{margin-top:12px}
        body.rs-app .rp-rgrid .panel{margin-bottom:0}
        .rp-ok{margin-top:8px}
        /* the panel headings stay <h3> — they ARE headings — so the only thing the kit's
           .panel-title does not cover is the margin the browser gives an h3 by default */
        .rp-h3{margin:0}
        /* the reason IS the content of its cell, not a footnote about it — the mute pill's
           faint ink is right for a tag and wrong for the thing you came to read */
        .rs-pill.rp-tag{color:var(--ink)}
        /* the two numbers this page exists for get the brand, so the eye lands there first */
        .rs-kpis .kpi.accent .v{color:var(--brand)}
        /* the top three carry the header tint, so the table agrees with the podium above it */
        .rs-table tbody tr.rp-bdtop td{background:var(--panel-2)}
        /* the reason picker is a form-mode localSelect — full-width by the kit (rs-form),
           so the old max-width lift for the native select is no longer needed */

        /* ---- the window stepper: a prev/next pair wrapped AROUND a menu. Not a segmented
           control (its middle is a menu, not a pill) and not a button group. The middle is a
           kit localSelect (form mode: value only); these overrides flatten its button into
           the pill the way the old borderless select sat in it. ---- */
        .rp-time{display:inline-flex;align-items:center;gap:1px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        .rp-time>button{border:0;background:transparent;color:var(--ink);cursor:pointer;font-size:14px;line-height:1;padding:5px 9px;border-radius:8px}
        .rp-time>button:hover:not(:disabled){background:var(--panel)}
        .rp-time>button:disabled{opacity:.3;cursor:default}
        .rp-time .rs-slicer.rs-form{display:inline-block;width:auto}
        .rp-time .rs-slicer.rs-form .rs-slicer-btn{width:auto;border:0;background:transparent;height:auto;padding:5px 4px;border-radius:8px;font-size:12.5px}
        .rp-time .rs-slicer.rs-form .rs-slicer-btn:hover{background:var(--panel)}
        .rp-time .rs-slicer.rs-form .rs-slicer-btn .val{flex:none;font-weight:700;color:var(--ink)}
        .rp-time .rs-slicer.rs-form .rs-slicer-pop{left:0;right:auto;width:auto;min-width:150px}
        .rp-range{font-size:11px;color:var(--muted);white-space:nowrap}

        /* ---- multiselect: a checkbox popover with search and select-all. The kit bar has
           single selects and segments; a multi-value filter is the page's own control. ---- */
        .rp-ms-wrap{position:relative}
        .rp-ms{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:12.5px;font-family:inherit;cursor:pointer;outline:none}
        .rp-ms:hover,.rp-ms.on{border-color:var(--brand)}
        .rp-ms .lb{font-weight:600}
        .rp-ms .ct{background:var(--brand);color:var(--brand-ink);font-size:10.5px;font-weight:800;border-radius:999px;padding:1px 7px;min-width:18px;text-align:center}
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

        /* ---- the matrix. A kit table reads left-aligned rows of text; this one is a heat
           grid: every cell is a coloured band, two columns are frozen, the header sorts. ---- */
        /* 232px (and the 300px in the mobile block below) are pre-measurement fallbacks —
           RSC.fitScroller sets --pg-chrome from the chrome actually on screen, so collapsing
           the bar above the matrix leaves no dead gap */
        .rp-wrap{max-height:calc(100vh - var(--pg-chrome, 232px))}
        /* width:100% so the matrix spends the width it is given. It sized to its content and
           stopped at roughly 1600px, leaving a third of a 2560px screen blank beside it while
           the cells themselves stayed cramped. min-width keeps it scrollable on a laptop; the
           sticky foreman column and the cell padding are unchanged. */
        .rp-mx{border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px;width:100%}
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

        /* ---- the drill-down drawer ---- */
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
        /* where the reviews came from: one bar per platform — a chart, not a table */
        .rp-roll{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
        .rp-roll .row{display:flex;align-items:center;gap:8px;font-size:12px}
        .rp-roll .nm{flex:0 0 128px;display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rp-roll .dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto}
        .rp-roll .bar{flex:1;height:8px;border-radius:999px;background:var(--panel-2);overflow:hidden}
        .rp-roll .bar i{display:block;height:100%;border-radius:999px}
        .rp-roll .vn{flex:0 0 auto;font-weight:800;font-size:12px;min-width:18px;text-align:right}
        /* a job card in the drawer: denser than a kit .panel, and it carries an inline form */
        .rp-jc{border:1px solid var(--line);border-radius:11px;padding:11px 12px;margin-bottom:9px;background:var(--panel)}
        .rp-jc.excl{opacity:.72;background:var(--panel-2)}
        .rp-jc .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
        .rp-jc .jn{font-weight:800;font-size:13px}
        .rp-jc .cust{color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
        .rp-jc .meta{font-size:11.5px;color:var(--muted);margin:5px 0 7px;display:flex;gap:10px;flex-wrap:wrap}
        .rp-jc .meta b{color:var(--ink);font-weight:700}
        /* platform chips keep #fff on purpose: the background is Google blue or Yelp red — a
           fixed brand colour, not a token — so the text on it must not follow the theme */
        .rp-plats{display:flex;flex-wrap:wrap;gap:5px}
        .rp-plat{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;
          color:#fff;line-height:1.3}
        .rp-plat b{font-weight:800}
        .rp-expl{font-size:11.5px;color:var(--muted);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
        .rp-expl b{color:var(--ink)}
        /* a dashed "fill in what is missing" affordance, not a kit action button */
        .rp-exbtn{margin-top:8px;border:1px dashed var(--line-2);background:transparent;color:var(--brand);font-size:11.5px;
          font-weight:700;border-radius:8px;padding:5px 10px;cursor:pointer;font-family:inherit}
        .rp-exbtn:hover{border-color:var(--brand)}
        .rp-exform{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:6px}
        .rp-exform textarea{font:inherit;font-size:12px;border:1px solid var(--line-2);border-radius:8px;
          background:var(--panel-2);color:var(--ink);padding:7px 9px;outline:none;min-height:44px;resize:vertical}
        .rp-exform .row2{display:flex;gap:6px}

        /* ---- reasons + support lists ---- */
        .rp-live-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--brand);box-shadow:0 0 0 3px var(--brand-glow);vertical-align:middle;margin:0 2px}
        .rp-suppage{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:11px;font-size:12px;color:var(--muted);font-weight:600}
        .rp-suppage b{margin:0 8px;font-variant-numeric:tabular-nums}
        .rp-pager{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:9px 2px 0;font-size:12px;color:var(--muted);font-weight:600}
        .rp-pager b{color:var(--ink);font-variant-numeric:tabular-nums}

        /* ---- Standings ---- */
        .rp-bdwk{display:inline-flex;align-items:center;gap:1px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        .rp-bdwk button{font:inherit;font-size:13px;font-weight:800;color:var(--muted);background:transparent;border:0;border-radius:8px;padding:6px 10px;cursor:pointer}
        .rp-bdwk button:hover:not(:disabled){background:var(--panel);color:var(--ink)}
        .rp-bdwk button:disabled{opacity:.32;cursor:default}
        .rp-bdwk b{font-size:13px;font-weight:800;color:var(--ink);padding:0 10px;white-space:nowrap;font-variant-numeric:tabular-nums}
        .rp-bdpod{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
        @media (max-width:760px){.rp-bdpod{grid-template-columns:1fr}}
        .rp-bdcard{border:1px solid var(--line);border-radius:14px;background:var(--panel);padding:13px 15px;
          display:flex;flex-direction:column;gap:3px;position:relative;overflow:hidden}
        .rp-bdcard:before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--mdl)}
        .rp-bdcard.p1{--mdl:#d4a017} .rp-bdcard.p2{--mdl:#9aa3ad} .rp-bdcard.p3{--mdl:#b0703a}
        @media (min-width:761px){.rp-bdcard.p1{order:2} .rp-bdcard.p2{order:1} .rp-bdcard.p3{order:3}
          .rp-bdcard.p1{transform:translateY(-6px)}}
        .rp-bdpl{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--mdl)}
        .rp-bdnm{font-size:15px;font-weight:800;color:var(--ink);line-height:1.25}
        .rp-bdrv{font-size:24px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1.1;margin-top:3px}
        .rp-bdrv small{font-size:11.5px;font-weight:700;color:var(--muted);margin-left:5px}
        .rp-bdmt{font-size:11.5px;color:var(--muted);font-weight:600}
        .rp-bdpz{font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;width:44px}
        .rp-bdpz i{font-style:normal;font-size:11px;color:var(--faint);font-weight:700}
        .rp-bdidle{font-size:11.5px;color:var(--faint);margin-top:12px;padding-top:11px;border-top:1px dashed var(--line);line-height:1.6}
        @media (max-width:640px){.rp-wrap{max-height:calc(100vh - var(--pg-chrome, 300px))}}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Foreman Performance <span id="rpLive" class="rs-pill ok rp-live pending" title="Live reviews are read straight from the Data for Reviews sheet, ahead of the ~6-hour warehouse refresh">◷ syncing live…</span></h1>
        <p>Reviews generated per foreman · <b>reviews ÷ eligible jobs</b> · target 100% · click a cell for the jobs and where each review came from. The <b>Support</b> tab lists every job Support stepped in on.</p>
      </div>
      <div class="rs-kpis" id="rpKpis"><div class="rs-loading">Loading jobs…</div></div>
      <div class="rs-bar rp-bar" id="rpBar"></div>
      <div id="rpLegend" class="rp-legend"></div>
      <div class="rs-tablewrap rp-wrap" id="rpWrapEl"><div id="rpMatrix"></div></div>
      <div id="rpBoard" style="display:none"></div>
      <div id="rpReasons" style="display:none"></div>
      <div id="rpSupport" style="display:none"></div>`;

    var rows;
    rpLoadReasons();   // background — live reason list ready before anyone opens an explain form
    try { rows = await RS.load("fct_job_overview"); }
    catch (e) { document.getElementById("rpKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("rpMatrix")) return;

    // The "what ISN'T in this report" banner is GONE (Tornike, 2026-08-11). Unfiled
    // recent moves have been counted in this report since 2026-07-21 — the foreman comes
    // from the calendar and only the money columns wait on the paperwork — so the banner
    // was chasing something the page already handles, in front of the numbers people came
    // for. fct_jobs_pending_closing still exists and is still granted; nothing reads it here.

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
        var t = setTimeout(function () { if (!done) { done = true; clean(); reject(new Error("timeout")); } }, 40000);   // relay cold-start reads a 6.7k-row sheet
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
          n += (v.counted - cur);   // the badge says "N fresh REVIEWS" — count reviews, not jobs
          r["Number of Reviews"] = v.counted;
          r["Review Received"] = v.counted > 1 ? "Multiple Reviews Received" : "Review Received";
          if (v.source) r["Review Source"] = v.source;
          if (v.breakdown) r["Review Breakdown"] = v.breakdown;
          if (String(r["Final Status"] || "").indexOf("Missing Review") === 0) r["Final Status"] = "Review Received";
          r._live = true;
        }
      });
      return n;
    }
    function paintLiveBadge() {
      var el = document.getElementById("rpLive"); if (!el) return;
      if (!RP_LIVE.on) return;
      el.classList.remove("pending");
      var tm = RP_LIVE.at
        ? ((window.RS && RS.fmtTz) ? RS.fmtTz(RP_LIVE.at) + " " + RS.tzShort()
                                   : RP_LIVE.at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
        : "";
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
    // Derived, NOT hardcoded — the literal list omitted 'Closing Pending' (job_overview.py emits
    // it for any job whose closing isn't filed yet), so "Select all" on this filter silently
    // deleted every unfiled job from the report (audit 2026-07-25).
    var billcats = [...new Set(rows.map(r => r["Bill Increase Category"]).filter(Boolean))].sort();
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
        // keep the caret where the user left it — a full re-render used to drop it to the end
        if (s) { s.value = q; s.oninput = () => { var a = s.selectionStart, b = s.selectionEnd; paintPop(s.value);
          var s2 = pop.querySelector(".rp-pop-s"); if (s2) { s2.focus(); try { s2.setSelectionRange(a, b); } catch (e) {} } };
          setTimeout(() => s.focus(), 0); }
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
      var d = document.createElement("div"); d.className = "rs-seg";
      items.forEach(it => {
        var b = document.createElement("button"); b.type = "button"; b.textContent = it.label;
        b.classList.toggle("on", it.v === cur());
        b.onclick = () => { onPick(it.v); [...d.children].forEach((c, i) => c.classList.toggle("on", items[i].v === cur())); };
        d.appendChild(b);
      });
      return d;
    }
    // Reasons tab removed 2026-07-16 — it became the Response Analysis page (reminder-feed driven).
    bar.appendChild(mkSeg(
      [{ v: "perf", label: "Performance" }, { v: "board", label: "Standings" },
       { v: "support", label: "Support" }],
      () => RP.view,
      v => { RP.view = v; closeDrawer(); repaint(); }));
    bar.appendChild(mkSeg(
      [{ v: "day", label: "Daily" }, { v: "week", label: "Weekly" }, { v: "month", label: "Monthly" }],
      () => RP.grain,
      v => { RP.grain = v; RP.offset = 0; RP.sortCol = null; closeDrawer(); paintWinOpts(); repaint(); }));
    var timeWrap = document.createElement("div"); timeWrap.className = "rp-time";
    timeWrap.innerHTML = `<button type="button" id="rpOlder" title="Older">‹</button><div id="rpWin"></div><button type="button" id="rpNewer" title="Newer">›</button>`;
    bar.appendChild(timeWrap);
    var rangeLbl = document.createElement("span"); rangeLbl.className = "rp-range"; rangeLbl.id = "rpRange";
    bar.appendChild(rangeLbl);
    function paintWinOpts() {
      // the stepper's middle is a kit localSelect now (form mode: value only, no label chip,
      // no empty row — the old <select> had neither). Remounted per grain because the option
      // list changes with it; value strings are the same digits the old options carried.
      var mount = document.getElementById("rpWin"), unit = RP.grain === "day" ? "days" : RP.grain === "week" ? "weeks" : "months";
      mount.innerHTML = "";
      RSC.localSelect(mount, {
        label: "Window",
        values: RP_WIN[RP.grain].map(w => ({ v: String(w), l: w + " " + unit })),
        value: String(win()),
        form: true, required: true,
        onChange: v => {
          if (RP.grain === "day") RP.winD = +v;
          else if (RP.grain === "week") RP.winW = +v;
          else RP.winM = +v;
          RP.offset = 0; closeDrawer(); repaint();
        },
      });
    }
    paintWinOpts();
    var msControls = [
      mkMulti(bar, { label: "Source", options: sources.map(s => ({ v: s, label: s })), sel: RP.sources, search: true, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Status", options: statuses.map(s => ({ v: s, label: s })), sel: RP.statuses, search: false, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Bill", options: billcats.map(s => ({ v: s, label: s })), sel: RP.billcats, search: false, onChange: () => { closeDrawer(); repaint(); } }),
      mkMulti(bar, { label: "Foreman", options: foremenAll.map(s => ({ v: s, label: s })), sel: RP.foremen, search: true, onChange: () => { closeDrawer(); repaint(); } }),
    ];
    var spring = document.createElement("span"); spring.className = "rs-spacer"; bar.appendChild(spring);
    var resetBtn = document.createElement("button"); resetBtn.type = "button"; resetBtn.className = "rs-btn"; resetBtn.textContent = "Reset";
    bar.appendChild(resetBtn);
    // the four multiselects never announce themselves once the bar is shut, so the pill has to
    var barC = RSC.collapsible(barEl, "rsBarCollapsed:review-performance", {
      count: function () {
        var labels = [];
        if (RP.sources.size) labels.push("Source");
        if (RP.statuses.size) labels.push("Status");
        if (RP.billcats.size) labels.push("Bill");
        if (RP.foremen.size) labels.push("Foreman");
        return { n: labels.length, labels: labels };
      },
    });

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

    // ---- explain-reason action ----
    // Was a fire-and-forget `mode:"no-cors"` POST straight to script.google.com with no await and
    // no catch, followed by an UNCONDITIONAL "✓ Saved" — so a failed write looked identical to a
    // successful one and the explanation was silently lost. Worse, that direct-to-Google path is
    // exactly the one that is broken for some users' browsers (see reminders.js relayRead).
    // Now: POST through the bridge proxy (same origin as every other portal call, real status
    // codes), await it, and only claim success when the bridge says so.
    // ONE NAME PER JOB, AND IT IS THE CODE (2026-08-11). This used to post `Job No`, which is
    // the calendar connector: the Moveboard request # when there is one, the job code only when
    // there is not. The Slack bot and Response Analysis file under the CODE. So the same
    // sheet, the same column, two key spaces -- and ten jobs the office had already explained
    // sat under an "Add reason" button because the worklist looked for one name and found the
    // other. Readers on both sides now resolve either name, but agreeing on one at the point of
    // WRITING is what stops the split growing, and the code is the name a human recognises.
    //
    // Falls back to `Job No` when the calendar carried no job code, which is exactly the rule
    // the bot uses -- see reminders.js jobIdent(), which must stay identical to this.
    // Historical rows keep whatever name they were written under: review_responses is a mirror
    // of the sheet, so nothing rewrites them, and the double join in job_overview.py stays.
    var jobIdent = function (r) {
      return String(r["Job Code"] || "").trim() || String(r["Job No"] || "").trim();
    };
    async function submitExplain(r, reason, note) {
      var who = "portal";
      try { who = (window.ZTZ && ZTZ.email && ZTZ.email()) || "portal"; } catch (e) {}
      var body = JSON.stringify({ kind: "reviewReason", jobCode: jobIdent(r),
        foreman: String(r["Foreman"] || ""), date: String(r["Job Date"] || "").slice(0, 10),
        reason: reason, note: (note ? note + " — " : "") + "via portal (" + who + ")" });
      var res = await fetch(ZTZ.API + "/api/_rrp", { method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8", "Authorization": "Bearer " + ZTZ.getToken() },
        body: body });
      if (!res.ok) throw new Error("HTTP " + res.status);
      // only NOW is the optimistic local update honest (the warehouse ingests the sheet within ~6h)
      r["Foreman Response Received"] = "Yes";
      r["Foreman Reason"] = reason;
      r["Foreman Explanation"] = reason + (note ? " — " + note : "");
      if (r["Final Status"] === "Missing Review – Waiting for Response") r["Final Status"] = "Missing Review – Explanation Received";
    }
    function explainFormHTML(idx) {
      return `<div class="rp-exform" data-exform="${idx}">
        <div data-exr></div>
        <textarea data-exn placeholder="Optional note…"></textarea>
        <div class="row2"><button type="button" class="rs-btn pri" data-exgo>Save reason</button>
        <button type="button" class="rs-btn" data-exno>Cancel</button></div></div>`;
    }
    function wireExplain(container, jobs, onSaved) {
      container.querySelectorAll("[data-exbtn]").forEach(b => b.onclick = () => {
        var i = b.dataset.exbtn;
        b.insertAdjacentHTML("afterend", explainFormHTML(i));
        b.style.display = "none";
        var f = container.querySelector(`[data-exform="${i}"]`);
        // the reason picker is a kit localSelect in form mode (full-width, value-only
        // button); like the old <select>, it starts on the first reason and has no
        // empty row, so `.get()` always returns a real reason
        var reasons = rpReasons();
        var exSel = RSC.localSelect(f.querySelector("[data-exr]"), {
          label: "Reason", values: reasons, value: reasons[0], form: true, required: true });
        f.querySelector("[data-exno]").onclick = () => { f.remove(); b.style.display = ""; };
        f.querySelector("[data-exgo]").onclick = () => {
          var r = jobs[+i];
          var go = f.querySelector("[data-exgo]");
          go.disabled = true; go.textContent = "Saving…";
          submitExplain(r, exSel.get(), f.querySelector("[data-exn]").value.trim())
            .then(() => {
              f.outerHTML = `<span class="rs-pill ok rp-ok">✓ Saved — shows here now, syncs to the warehouse within ~6h</span>`;
              if (onSaved) onSaved();
            })
            .catch(e => {
              // never claim a save we didn't get — leave the form up so the reason isn't lost
              go.disabled = false; go.textContent = "Save reason";
              var w = f.querySelector(".rp-exerr") || f.insertAdjacentElement("beforeend", Object.assign(document.createElement("div"), { className: "rp-exerr" }));
              w.textContent = "Couldn't save (" + (e && e.message || e) + ") — nothing was recorded. Try again.";
              w.style.cssText = "color:var(--neg);font-size:11.5px;font-weight:700;margin-top:6px";
            });
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
      // every view-changing control calls closeDrawer — reset the paged lists too, or a filter
      // change lands you on page 7 of a list that now has 2 pages
      RP.wlPage = 0; RP.supPage = 0;
      var m = document.getElementById("rpMatrix"); if (m) m.querySelectorAll(".rp-cell.sel").forEach(el => el.classList.remove("sel"));
    }
    scrim.onclick = closeDrawer;
    document.addEventListener("keydown", function esckey(e) {
      if (!drawer.isConnected) { document.removeEventListener("keydown", esckey); return; }
      if (e.key === "Escape" && drawer.classList.contains("show")) closeDrawer();
    });

    var stPill = s => {
      var m = { "Review Received": "ok", "Multiple Reviews Received": "ok", "Excluded – Support Intervention": "mute",
        "Review Match Pending": "warn", "Missing Review – Explanation Received": "warn",
        "Missing Review – Waiting for Response": "bad", "Data Missing": "mute" };
      return `<span class="rs-pill ${m[s] || "mute"}">${esc(s)}</span>`;
    };

    function drill(fm, col) {
      var jobs = filtered().filter(r => (r["Foreman"] || "—") === fm && colKey(r) === col)
        .sort((a, b) => num(b["Number of Reviews"]) - num(a["Number of Reviews"]) || num(b["Eligible"]) - num(a["Eligible"]) || String(a["Job Date"]).localeCompare(String(b["Job Date"])));
      var R = jobs.filter(r => num(r["Eligible"]) === 1).reduce((s, r) => s + num(r["Number of Reviews"]), 0);
      var J = jobs.filter(r => num(r["Eligible"]) === 1).length;
      var pct = J ? Math.round(R / J * 100) : 0, b = band(pct);

      // The roll counts reviews on EVERY job in the cell; the headline counts only eligible ones.
      // They can differ (a review on an excluded job), so say so instead of showing two totals
      // that silently disagree (audit 2026-07-25).
      var roll = {}, exclRev = 0;
      jobs.forEach(r => {
        var e = num(r["Eligible"]) === 1;
        parseBk(r["Review Breakdown"]).forEach(p => { roll[p.src] = (roll[p.src] || 0) + p.n; if (!e) exclRev += p.n; });
      });
      var rollArr = Object.keys(roll).map(k => ({ src: k, n: roll[k] })).sort((a, b) => b.n - a.n);
      var rollMax = rollArr.reduce((m, x) => Math.max(m, x.n), 0);
      var rollTot = rollArr.reduce((s, x) => s + x.n, 0);
      var rollHtml = rollArr.length ? `<div class="rp-sec">Where the reviews came from · ${rollTot} total${exclRev ? ` · incl. ${exclRev} on excluded job${exclRev === 1 ? "" : "s"}` : ""}</div><div class="rp-roll">` +
        rollArr.map(x => `<div class="row"><span class="nm"><i class="dot" style="background:${platColor(x.src)}"></i>${esc(x.src)}</span>
          <span class="bar"><i style="width:${rollMax ? Math.round(x.n / rollMax * 100) : 0}%;background:${platColor(x.src)}"></i></span>
          <span class="vn">${x.n}</span></div>`).join("") + `</div>`
        : `<div class="rp-sec">Where the reviews came from</div><div class="rs-pill bad" style="margin:0 2px 14px">No reviews written for these jobs yet</div>`;

      // BOTH OF THE JOB'S NAMES, because the office searches by whichever one they were given:
      // dispatch quotes the job code, Moveboard quotes the request #, and a card showing one of
      // them sends whoever holds the other away empty-handed. Only shown when they differ.
      var alsoKnownAs = function (r) {
        var a = String(r["Job Code"] || "").trim(), b = String(r["Job No"] || "").trim();
        return (a && b && a.toUpperCase() !== b.toUpperCase())
          ? `<span class="rs-pill mute" title="the same job's other identifier">${esc(b)}</span>` : "";
      };
      var billPill = c => c === "High Increase" ? `<span class="rs-pill bad">High +bill</span>`
        : c === "Attention" ? `<span class="rs-pill warn">+bill</span>` : "";

      var cards = jobs.map((r, i) => {
        var elig = num(r["Eligible"]) === 1;
        var bk = parseBk(r["Review Breakdown"]);
        var revHtml = bk.length
          ? `<div class="rp-plats">` + bk.map(p => `<span class="rp-plat" style="background:${platColor(p.src)}">${esc(p.src)}${p.n > 1 ? ` <b>×${p.n}</b>` : ""}</span>`).join("") + `</div>`
          : `<span class="rs-pill bad">No review written</span>`;
        var dpct = r["Bill Increase %"] == null || r["Bill Increase %"] === "" ? null : num(r["Bill Increase %"]);
        var expl = elig ? "" : `<div class="rp-expl"><b>Excluded:</b> ${esc(r["Exclusion Reason"] || "—")}${r["Support Intervention Reason"] ? " · " + esc(r["Support Intervention Reason"]) : ""}</div>`;
        var fexpl = (r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim()) ? `<div class="rp-expl"><b>Explanation:</b> ${esc(r["Foreman Explanation"])}</div>` : "";
        var canExplain = elig && num(r["Number of Reviews"]) === 0 && !(r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim());
        return `<div class="rp-jc${elig ? "" : " excl"}">
          <div class="top"><span class="jn">#${esc(jobIdent(r))}</span>${alsoKnownAs(r)}<span class="cust">${esc(r["Customer"] || "—")}</span>
            <span style="flex:1"></span>${stPill(r["Final Status"])}</div>
          <div class="meta"><span>${esc(shortD(String(r["Job Date"] || "").slice(0, 10)))}</span>
            <span>${esc(r["Job Source"] || "—")}</span>
            <span><b>${money(r["Estimate Bill"])}</b> → <b>${money(r["Actual Bill"])}</b>${dpct != null ? ` <span style="color:${dpct > 0 ? "var(--warn)" : "var(--muted)"}">(${dpct > 0 ? "+" : ""}${dpct}%)</span>` : ""}</span>
            ${r["Closing Filed"] === "No" ? '<span style="color:var(--faint);font-size:11px">closing sheet pending</span>' : billPill(r["Bill Increase Category"])}</div>
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
          <div class="rp-sec">Jobs (${jobs.length})</div>${cards || `<div class="rs-pill bad">No jobs.</div>`}</div>`;
      drawer.querySelector("#rpDx").onclick = closeDrawer;
      wireExplain(drawer, jobs, () => { paintKpis(filteredWindowed()); });
      scrim.classList.add("show"); drawer.classList.add("show");
    }

    function filteredWindowed() {
      var colSet = new Set(windowCols());
      return filtered().filter(r => colSet.has(colKey(r)));
    }

    // ONE owner for the ‹ / window / › control, called from every view. It used to be inlined in
    // the two paint functions that honour the date window, so the Support tab (which is all-time
    // by design) left the arrows live and the range label stale: clicking ‹ there silently moved
    // the matrix behind your back (audit 2026-07-25). Now Support dims and disables them.
    function paintTimeBar() {
      // Standings owns its own week picker, so the shared window control would move a matrix
      // nobody is looking at -- the same trap the Support tab hit (audit 2026-07-25).
      var timeOn = RP.view === "perf";
      var cols = windowCols(), ac = allCols(), maxOff = Math.max(0, ac.length - win());
      var rl = document.getElementById("rpRange"), ob = document.getElementById("rpOlder"), nb = document.getElementById("rpNewer"), ws = document.getElementById("rpWin");
      if (rl) rl.textContent = !timeOn ? "all time" : (cols.length ? colLabel(cols[cols.length - 1]) + " – " + colLabel(cols[0]) : "—");
      if (ob) ob.disabled = !timeOn || RP.offset >= maxOff;
      if (nb) nb.disabled = !timeOn || RP.offset <= 0;
      // ws is the localSelect mount div — pointer-events stands in for the old select's
      // `disabled`, and the parent .rp-time dims exactly as before
      if (ws) ws.style.pointerEvents = timeOn ? "" : "none";
      if (ws && ws.parentElement) ws.parentElement.style.opacity = timeOn ? "" : ".45";
      if (rl) rl.style.opacity = timeOn ? "" : ".6";
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
        `<div class="kpi${k.a ? " accent" : ""}"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="s">${k.s}</div></div>`).join("");
      return tot;
    }

    // ---- Standings view (weekly, by reviews written) ----
    // QUALITY TEAM, RELAYED BY TORNIKE (2026-08-11): "a ranking of the foremen by reviews
    // written -- who is in which place. So that I can see it at the end of every week. Put it
    // somewhere separate."
    //
    // The matrix does order foremen, but it prints no PLACE and it orders by PERCENTAGE, so
    // the man who wrote the most reviews is nowhere near the top of it and no number on screen
    // says he is first. Neither half of the ask was answerable here, which is why he could not
    // find it. This is its own tab because a league table read once a week has nothing to do
    // with a 12-column matrix read every day.
    function bdWeeks() {
      return [...new Set(rows.map(r => String(r["Week Ending"] || "").slice(0, 10)).filter(Boolean))]
        .sort().reverse();
    }
    function bdKeyOf(o) { return RP.bdKey === "rate" ? o.rate : o.rev; }
    function bdStand(wk) {
      var by = {};
      filtered().forEach(function (r) {
        if (String(r["Week Ending"] || "").slice(0, 10) !== wk) return;
        var fm = r["Foreman"] || "\u2014";
        var o = by[fm] || (by[fm] = { fm: fm, rev: 0, jobs: 0, done: 0, rate: 0 });
        o.done++;
        if (num(r["Eligible"]) === 1) { o.jobs++; o.rev += num(r["Number of Reviews"]); }
      });
      var list = Object.keys(by).map(function (k) { return by[k]; });
      list.forEach(function (o) { o.rate = o.jobs ? o.rev / o.jobs : 0; });
      // A man with no ELIGIBLE job that week never had a shot at a review. Ranking him last
      // would read as a bad week when it was an empty one, so he is named below the table
      // instead -- last place has to mean something or the board is worth nothing.
      var ranked = list.filter(function (o) { return o.jobs > 0; });
      var idle = list.filter(function (o) { return o.jobs === 0; });
      ranked.sort(function (a, b) {
        var d = bdKeyOf(b) - bdKeyOf(a);
        if (!d) d = RP.bdKey === "rate" ? b.rev - a.rev : b.rate - a.rate;   // the other measure breaks it
        return d || a.fm.localeCompare(b.fm);
      });
      // COMPETITION RANKING: equal scores share a place and the next one skips it (1, 2, 2, 4).
      // Two men on four reviews each are both second; neither of them is third.
      var place = 0, seen = 0, last = null;
      ranked.forEach(function (o) {
        seen++;
        var k = bdKeyOf(o);
        if (last === null || k !== last) { place = seen; last = k; }
        o.place = place;
      });
      return { ranked: ranked, idle: idle };
    }
    function bdPrevPlaces(wk) {
      var ws = bdWeeks(), i = ws.indexOf(wk), m = {};
      if (i < 0 || i + 1 >= ws.length) return m;
      bdStand(ws[i + 1]).ranked.forEach(function (o) { m[o.fm] = o.place; });
      return m;
    }
    var bdToday = function () {
      var d = new Date(), p = function (n) { return (n < 10 ? "0" : "") + n; };
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
    };
    var bdWkLabel = function (c) {
      return MON[+c.slice(5, 7)] + " " + (+c.slice(8, 10)) + ", " + c.slice(0, 4);
    };

    function paintBoard() {
      var el = document.getElementById("rpBoard"), ws = bdWeeks();
      paintTimeBar();
      if (!ws.length) {
        el.innerHTML = `<div class="rs-loading" style="padding:22px">No weeks in this report yet.</div>`;
        paintKpis([]); return;
      }
      // OPENS ON THE LAST WEEK THAT FINISHED, not on the one running now -- "so that I can see
      // it at the end of every week" is the ask, and on a Tuesday the live week is one day of
      // jobs with everybody tied on nothing. The running week is still one click away on ›.
      if (!RP.bdWeek || ws.indexOf(RP.bdWeek) < 0) {
        var t = bdToday();
        RP.bdWeek = ws.filter(function (w) { return w < t; })[0] || ws[0];
      }
      var wk = RP.bdWeek, wi = ws.indexOf(wk);
      var st = bdStand(wk), prev = bdPrevPlaces(wk), open = wk >= bdToday();
      paintKpis(filtered().filter(r => String(r["Week Ending"] || "").slice(0, 10) === wk));

      var totR = st.ranked.reduce((a, o) => a + o.rev, 0);
      var totJ = st.ranked.reduce((a, o) => a + o.jobs, 0);
      var unit = RP.bdKey === "rate" ? "review rate" : "reviews written";
      var scoreOf = function (o) {
        return RP.bdKey === "rate" ? Math.round(o.rate * 100) + "%" : N(o.rev);
      };
      var byPlace = {};
      st.ranked.forEach(function (o) { (byPlace[o.place] || (byPlace[o.place] = [])).push(o); });
      // No podium when the leader wrote nothing: three cards celebrating zero is worse than
      // no cards at all. And a place shared by half the yard gets a COUNT, not a paragraph of
      // names -- twelve men tied on nothing is a fact for the table, not a trophy.
      var lead = st.ranked.length ? bdKeyOf(st.ranked[0]) : 0;
      var pod = (lead <= 0 ? [] : [1, 2, 3].filter(function (p) { return byPlace[p]; })).map(function (p) {
        var men = byPlace[p], ORD = { 1: "1st place", 2: "2nd place", 3: "3rd place" };
        var o = men[0], shown = men.slice(0, 3);
        return `<div class="rp-bdcard p${p}">
            <span class="rp-bdpl">${ORD[p]}${men.length > 1 ? " \u2014 " + N(men.length) + " tied" : ""}</span>
            <span class="rp-bdnm">${shown.map(m => esc(m.fm)).join(", ")}${men.length > shown.length
              ? ` <span class="rp-bdmt">+${N(men.length - shown.length)} more</span>` : ""}</span>
            <span class="rp-bdrv">${scoreOf(o)}<small>${RP.bdKey === "rate" ? "review rate" : (o.rev === 1 ? "review" : "reviews")}</small></span>
            <span class="rp-bdmt">${men.length > 1
              ? "each"    // TIED MEN SHARE THE SCORE AND NOTHING ELSE. Printing the first man's
                          // job count under both their names read as a fact about both of them:
                          // Sheklashvili's four came off five jobs, Kolbaia's off ten.
              : (RP.bdKey === "rate"
                ? N(o.rev) + " from " + N(o.jobs) + (o.jobs === 1 ? " job" : " jobs")
                : "from " + N(o.jobs) + (o.jobs === 1 ? " job" : " jobs") + " \u00b7 " + Math.round(o.rate * 100) + "%")}</span>
          </div>`;
      }).join("");

      var mv = function (o) {
        var p = prev[o.fm];
        if (p == null) return `<span class="rs-pill mute" title="not in last week's standings">\u00b7</span>`;
        if (p === o.place) return `<span class="rs-pill mute" title="same place as last week">\u2014</span>`;
        return p > o.place
          ? `<span class="rs-pill ok" title="was ${p} last week">\u25b2 ${p - o.place}</span>`
          : `<span class="rs-pill bad" title="was ${p} last week">\u25bc ${o.place - p}</span>`;
      };
      var body = st.ranked.map(function (o) {
        var b = band(Math.round(o.rate * 100));
        return `<tr${o.place <= 3 ? ' class="rp-bdtop"' : ""}>
          <td class="rp-bdpz">${o.place}${byPlace[o.place].length > 1 ? "<i>=</i>" : ""}</td>
          <td class="strong">${esc(o.fm)}</td>
          <td class="num"><b>${N(o.rev)}</b></td>
          <td class="num">${N(o.jobs)}</td>
          <td class="num"><span class="rs-pill" style="background:${b.bg};color:${b.fg}">${Math.round(o.rate * 100)}%</span></td>
          <td class="num">${mv(o)}</td></tr>`;
      }).join("");

      el.innerHTML = `<div class="rs-bar rp-bdbar">
          <span class="rp-bdwk">
            <button type="button" id="rpBdOlder" title="Earlier week" ${wi >= ws.length - 1 ? "disabled" : ""}>\u2039</button>
            <b>Week ending ${bdWkLabel(wk)}</b>
            <button type="button" id="rpBdNewer" title="Later week" ${wi <= 0 ? "disabled" : ""}>\u203a</button>
          </span>
          ${open ? `<span class="rs-pill warn">still running</span>` : ""}
          <span class="rs-spacer"></span>
          <span class="rs-seg" id="rpBdKey">
            <button type="button" data-bdkey="rev" class="${RP.bdKey === "rev" ? "on" : ""}">By reviews</button>
            <button type="button" data-bdkey="rate" class="${RP.bdKey === "rate" ? "on" : ""}">By rate</button>
          </span>
          <button type="button" class="rs-btn" id="rpBdCopy">Copy standings</button>
        </div>
        <div class="rs-hint">Ranked by ${unit} on jobs that ended this week. ${N(totR)} ${totR === 1 ? "review" : "reviews"} from
          ${N(totJ)} eligible ${totJ === 1 ? "job" : "jobs"} across ${N(st.ranked.length)} ${st.ranked.length === 1 ? "foreman" : "foremen"}.
          ${open ? "This week is not over \u2014 the places can still change." : "Movement is against the week before."}</div>
        ${pod ? `<div class="rp-bdpod">${pod}</div>` : ""}
        ${st.ranked.length
          ? `<div class="panel rs-noanim"><div class="rs-tablewrap"><table class="rs-table"><thead><tr>
               <th>Place</th><th>Foreman</th><th class="num">Reviews</th><th class="num">Jobs</th>
               <th class="num">Rate</th><th class="num">vs last week</th></tr></thead><tbody>${body}</tbody></table></div>
             ${st.idle.length ? `<div class="rp-bdidle"><b>Not ranked this week</b> \u2014 no eligible job, so no chance at a review:
               ${st.idle.map(o => esc(o.fm) + " (" + N(o.done) + ")").join(", ")}</div>` : ""}</div>`
          : `<div class="rs-loading" style="padding:22px">No eligible jobs in this week.</div>`}`;

      document.getElementById("rpBdOlder").onclick = function () {
        RP.bdWeek = ws[Math.min(ws.length - 1, wi + 1)]; paintBoard();
      };
      document.getElementById("rpBdNewer").onclick = function () {
        RP.bdWeek = ws[Math.max(0, wi - 1)]; paintBoard();
      };
      el.querySelectorAll("[data-bdkey]").forEach(function (b) {
        b.onclick = function () { RP.bdKey = b.getAttribute("data-bdkey"); paintBoard(); };
      });
      // Pasted into Slack on a Friday -- which is the whole point of the ask, and a screenshot
      // of a table is not something anyone can read on a phone.
      document.getElementById("rpBdCopy").onclick = function () {
        var btn = this;
        var txt = "Foreman standings \u2014 week ending " + bdWkLabel(wk)
          + (open ? " (still running)" : "") + "\n"
          + st.ranked.map(function (o) {
              return o.place + ". " + o.fm + " \u2014 " + N(o.rev) + (o.rev === 1 ? " review" : " reviews")
                + " from " + N(o.jobs) + (o.jobs === 1 ? " job" : " jobs") + " (" + Math.round(o.rate * 100) + "%)";
            }).join("\n");
        var done = function (ok) {
          btn.textContent = ok ? "Copied" : "Press Ctrl+C";
          setTimeout(function () { btn.textContent = "Copy standings"; }, 1800);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(function () { done(true); }, function () { done(false); });
        } else {
          var ta = document.createElement("textarea");
          ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select();
          var ok = false; try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
          ta.remove(); done(ok);
        }
      };
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
      paintTimeBar();
      // A sort on a period column that has scrolled out of the window silently reordered the
      // matrix with no caret to explain it — drop it once its column is gone (audit 2026-07-25).
      if (RP.sortCol && RP.sortCol !== "total" && RP.sortCol !== "__name" && cols.indexOf(RP.sortCol) < 0) RP.sortCol = null;

      function sortVal(fm) {
        if (RP.sortCol === "total") { var f = foremen[fm]; return f.J ? f.R / f.J : -1; }
        if (RP.sortCol) { var c = cells[fm + "||" + RP.sortCol]; return (c && c.J) ? c.R / c.J : -1; }
        return foremen[fm].completed;
      }
      var fmList = Object.keys(foremen);
      if (RP.sortCol === "__name") fmList.sort((a, b) => RP.sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));
      // The direction applies to the PRIMARY key only — negating the tie-break too put
      // one-job foremen on top of a "best first" sort (audit 2026-07-25).
      else fmList.sort((a, b) => {
        var d = sortVal(a) - sortVal(b);
        if (RP.sortDir !== "asc") d = -d;
        if (d === 0) d = foremen[b].completed - foremen[a].completed;
        return d;
      });

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

    // ---- LIVE foreman explanations (Tornike 2026-07-16) ----
    // The warehouse-backed worklist below can show ZERO explanations for a real reason: a job only
    // enters this report once its CLOSING SHEET is filed (days later), while a foreman's explanation
    // is logged within minutes. So a fresh explanation exists in the relay long before its job
    // appears here. This panel reads those explanations LIVE (bridge proxy /api/_rrp, same source as
    // the Reminders page) so the office sees them the instant they arrive, independent of the lag.
    // Best-effort: a 403 (user lacks the reviews-reminders grant) or a relay hiccup just hides it.
    var liveResp = null, liveRespState = "idle";   // idle | loading | done | fail
    function loadLiveResp() {
      if (liveRespState !== "idle") return;
      liveRespState = "loading";
      ZTZ.api("/api/_rrp?req=reviewData").then(function (d) {
        liveResp = (d && d.responses) || [];
        liveRespState = "done";
        if (RP.view === "reasons") paintReasons();
      }).catch(function () { liveRespState = "fail"; if (RP.view === "reasons") paintReasons(); });
    }
    function liveRespPanel() {
      if (liveRespState === "idle" || liveRespState === "loading")
        return `<div class="panel rs-noanim"><div class="panel-head"><h3 class="panel-title rp-h3">Recent foreman explanations · live from the field</h3></div><div class="rs-loading" style="padding:14px">Loading…</div></div>`;
      if (liveRespState === "fail") return "";   // silent — the warehouse worklist still renders
      var rs = (liveResp || []).slice().sort(function (a, b) { return String(b.ts || b.date || "").localeCompare(String(a.ts || a.date || "")); });
      var fmt = function (r) { var d = new Date(r.ts || r.date); return isNaN(d) ? String(r.date || "") : d.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };
      var body = rs.length
        ? rs.slice(0, 30).map(function (r) {
            return "<tr><td class=\"nowrap muted\">" + esc(fmt(r)) + "</td>"
              + "<td class=\"nowrap strong\">" + esc(r.job || "—") + "</td>"
              + "<td class=\"nowrap\">" + esc(r.foreman || "—") + "</td>"
              + "<td><span class=\"rs-pill mute rp-tag\">" + esc(r.reason || "—") + "</span></td>"
              + "<td class=\"muted\">" + esc(r.note || "") + "</td></tr>";
          }).join("")
        : "<tr><td colspan=\"5\" class=\"dim\">No foreman explanations submitted yet. When a foreman taps “why no review?” on the Slack nudge, it appears here within about a minute.</td></tr>";
      return `<div class="panel rs-noanim">
        <div class="panel-head"><h3 class="panel-title rp-h3">Recent foreman explanations · <span class="rp-live-dot"></span> live from the field${rs.length ? " (" + N(rs.length) + ")" : ""}</h3></div>
        <p class="rs-hint">Straight from the reminder bot, ahead of the ~6-hour warehouse sync. Each one attaches to its job in the worklist below once that job’s closing sheet is filed (usually a few days), so a brand-new explanation may not yet line up with a job in the window above.</p>
        <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>When</th><th>Job</th><th>Foreman</th><th>Reason</th><th>Note</th></tr></thead><tbody>${body}</tbody></table></div>
      </div>`;
    }
    // ---- Reasons view ----
    function paintReasons() {
      loadLiveResp();
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
          <span class="bar"><i style="width:${Math.round(waiting / rMax * 100)}%;background:var(--muted)"></i></span><span class="vn">${waiting}</span></div>`;

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
      var fmRows = fmArr.map(x => `<tr><td>${esc(x.f)}</td><td class="num">${x.miss}</td><td class="num">${x.exp}</td>
        <td class="num strong" style="color:${x.wait ? "var(--neg)" : "var(--pos)"}">${x.wait}</td><td>${esc(x.top)}</td></tr>`).join("");

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
        return `<tr><td>${esc(colLabel(c))}</td><td class="num">${o.miss}</td><td class="num">${o.exp}</td>
          <td class="num">${pr == null ? "—" : pr + "%"}</td></tr>`;
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
          <td>${expl ? esc(expl) : `<span class="rs-pill bad">waiting</span><button type="button" class="rp-exbtn" style="margin:4px 0 0" data-exbtn="${wlStart + i}">✍ Explain</button>`}</td></tr>`;
      }).join("");
      var wlPager = wlPages > 1 ? `<div class="rp-pager">
        <button type="button" class="rs-btn" data-wlprev${RP.wlPage === 0 ? " disabled" : ""}>‹ Prev</button>
        <span>Page <b>${RP.wlPage + 1}</b> of ${wlPages}</span>
        <button type="button" class="rs-btn" data-wlnext${RP.wlPage >= wlPages - 1 ? " disabled" : ""}>Next ›</button></div>` : "";

      var el = document.getElementById("rpReasons");
      el.innerHTML = liveRespPanel() + `
        <div class="rs-grid2 rp-rgrid">
          <div class="panel rs-noanim"><div class="panel-head"><h3 class="panel-title rp-h3">Why reviews are missing · ${N(explained.length)} of ${N(missing.length)} explained</h3></div>
            <div class="rp-roll">${barsHtml}</div></div>
          <div class="panel rs-noanim"><div class="panel-head"><h3 class="panel-title rp-h3">Response rate by ${RP.grain}</h3></div>
            <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>${RP.grain === "day" ? "Day" : RP.grain === "week" ? "Week" : "Month"}</th><th class="num">Missing</th><th class="num">Explained</th><th class="num">Resp. %</th></tr></thead><tbody>${trendRows}</tbody></table></div></div>
        </div>
        <div class="panel rs-noanim"><div class="panel-head"><h3 class="panel-title rp-h3">Foreman accountability — who owes explanations</h3></div>
          <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Foreman</th><th class="num">Missing</th><th class="num">Explained</th><th class="num">Waiting</th><th>Top reason</th></tr></thead><tbody>${fmRows || `<tr><td colspan="5" class="dim">Nothing missing in this window 🎉</td></tr>`}</tbody></table></div></div>
        <div class="panel rs-noanim"><div class="panel-head"><h3 class="panel-title rp-h3">Missing-review jobs (${N(missing.length)}) — explain right here</h3></div>
          <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Job</th><th>Foreman</th><th>Date</th><th>Reason / action</th></tr></thead><tbody>${workRows || `<tr><td colspan="4" class="dim">None in this window.</td></tr>`}</tbody></table></div>${wlPager}</div>`;
      wireExplain(el, work, () => paintReasons());
      var wp = el.querySelector("[data-wlprev]"), wn = el.querySelector("[data-wlnext]");
      if (wp) wp.onclick = () => { RP.wlPage--; paintReasons(); };
      if (wn) wn.onclick = () => { RP.wlPage++; paintReasons(); };
      paintTimeBar();
    }

    // ---- Support interventions list (Tornike 2026-07-16) ----
    // A plain, searchable list of every job Support stepped in on — Claim / Negative Review / Refund
    // etc. These are the interventions that EXCLUDE a job from review eligibility (the "Support excl."
    // KPI). It reads the SAME warehouse rows already loaded — respects the Source/Status/Bill/Foreman
    // filters, but NOT the date window (support work spans all history and you want to see it all).
    var yesSup = r => { var v = String(r["Support Intervention"] == null ? "" : r["Support Intervention"]).trim().toLowerCase(); return v === "yes" || v === "1" || v === "true"; };
    var supDate = r => { var d = String(r["Support Intervention Date"] || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : (String(r["Job Date"] || "").slice(0, 10)); };
    // The Support tab is ALL-TIME, so the windowed performance tiles above it were both stale and
    // contradictory (and stuck on "Loading jobs…" if you landed here first). Its own tiles now
    // describe exactly the list underneath them (audit 2026-07-25).
    function paintSupKpis(all, list) {
      var d30 = new Date(); d30.setDate(d30.getDate() - 30);
      var cut = d30.toISOString().slice(0, 10);
      var recent = all.filter(r => supDate(r) >= cut).length;
      var fms = new Set(all.map(r => r["Foreman"]).filter(Boolean));
      var types = new Set(all.map(r => String(r["Support Intervention Type"] || "").trim()).filter(Boolean));
      // a job can carry more than one intervention row, so rows ≠ jobs
      var jobs = new Set(all.map(r => String(r["Job No"] || "").trim()).filter(Boolean));
      var K = [
        { l: "Interventions", v: N(all.length), s: "all time", a: 1 },
        { l: "Last 30 days", v: N(recent), s: "since " + cut },
        { l: "Jobs affected", v: N(jobs.size), s: "excluded from eligibility" },
        { l: "Foremen", v: N(fms.size), s: "involved" },
        { l: "Types", v: N(types.size), s: "distinct" },
        { l: "In this list", v: N(list.length), s: (RP.supType || RP.supQ.trim()) ? "after search / chip" : "no filter" },
      ];
      var el = document.getElementById("rpKpis"); if (!el) return;
      // this strip is written directly rather than through RSC.kpis, which is the only
      // thing that sets --kpi-cols -- without it six tiles lay out 4+2 above 1400px
      el.style.setProperty("--kpi-cols", String(K.length));
      el.innerHTML = K.map(k => `<div class="kpi${k.a ? " accent" : ""}"><div class="l">${k.l}</div><div class="v">${k.v}</div><div class="s">${esc(k.s)}</div></div>`).join("");
    }
    function paintSupport() {
      var SUP_PAGE = 25;
      var all = filtered().filter(yesSup);
      // distinct types for the little filter chips (a job can carry a comma-joined combo — keep it whole).
      // Blank types collapse to "—" on BOTH sides: the chip used to be labelled with a real count
      // and then match nothing, because the predicate compared "—" against "" (audit 2026-07-25).
      var supType = r => String(r["Support Intervention Type"] || "").trim() || "—";
      var typeCounts = {};
      all.forEach(r => { var t = supType(r); typeCounts[t] = (typeCounts[t] || 0) + 1; });
      // a chip that no longer exists under the current global filters must not keep filtering invisibly
      if (RP.supType && !(RP.supType in typeCounts)) { RP.supType = ""; RP.supPage = 0; }
      var q = RP.supQ.trim().toLowerCase();
      var list = all.filter(r => {
        if (RP.supType && supType(r) !== RP.supType) return false;
        if (!q) return true;
        return [r["Job No"], r["Customer"], r["Foreman"], r["Support Intervention Type"], r["Support Intervention Reason"]]
          .some(v => String(v == null ? "" : v).toLowerCase().indexOf(q) >= 0);
      }).sort((a, b) => supDate(b).localeCompare(supDate(a)));
      paintSupKpis(all, list);
      paintTimeBar();

      var pages = Math.max(1, Math.ceil(list.length / SUP_PAGE));
      if (RP.supPage >= pages) RP.supPage = 0;
      var shown = list.slice(RP.supPage * SUP_PAGE, RP.supPage * SUP_PAGE + SUP_PAGE);
      var typeTag = t => { var k = String(t || "").toLowerCase();
        var c = /neg/.test(k) ? "var(--warn)" : /claim/.test(k) ? "var(--neg)" : /refund/.test(k) ? "var(--purple)" : "var(--muted)";
        return `<span style="font-weight:700;color:${c}">${esc(t || "—")}</span>`; };
      var rowsH = shown.map(r => `<tr>
          <td class="nowrap muted">${esc(supDate(r))}</td>
          <td class="nowrap strong">${esc(r["Job No"] || "—")}<br><span style="color:var(--faint);font-weight:400;font-size:11px">${esc(r["Customer"] || "")}</span></td>
          <td class="nowrap">${esc(r["Foreman"] || "—")}</td>
          <td>${typeTag(r["Support Intervention Type"])}</td>
          <td>${esc(r["Support Intervention Reason"] || "—")}</td>
        </tr>`).join("");
      var chips = [{ t: "", label: "All types (" + N(all.length) + ")" }]
        .concat(Object.keys(typeCounts).sort((a, b) => typeCounts[b] - typeCounts[a]).map(t => ({ t: t, label: t + " (" + N(typeCounts[t]) + ")" })))
        .map(c => `<button type="button" class="${RP.supType === c.t ? "on" : ""}" data-suptype="${esc(c.t)}">${esc(c.label)}</button>`).join("");
      var from = list.length ? RP.supPage * SUP_PAGE + 1 : 0, to = Math.min(list.length, (RP.supPage + 1) * SUP_PAGE);
      var pager = list.length > SUP_PAGE
        ? `<div class="rp-suppage"><span>${N(from)}–${N(to)} of ${N(list.length)}</span>
             <span><button type="button" class="rs-btn" data-supprev ${RP.supPage === 0 ? "disabled" : ""}>‹ Prev</button>
             <b>${RP.supPage + 1} / ${pages}</b>
             <button type="button" class="rs-btn" data-supnext ${RP.supPage >= pages - 1 ? "disabled" : ""}>Next ›</button></span></div>`
        : `<div class="rp-suppage"><span>${N(list.length)} intervention${list.length === 1 ? "" : "s"}</span></div>`;

      var el = document.getElementById("rpSupport");
      el.innerHTML = `
        <div class="panel rs-noanim">
          <div class="panel-head"><h3 class="panel-title rp-h3">Support interventions — every job Support stepped in on</h3></div>
          <p class="rs-hint">All-time (not limited by the date window above). A job with a support intervention is excluded from review eligibility. Respects the Source / Foreman filters.</p>
          <div class="rs-bar rp-supbar">
            <input type="text" class="rs-inp" id="rpSupQ" placeholder="Search job, customer, foreman, type, reason…" value="${esc(RP.supQ)}">
            <div class="rs-seg rp-supchips">${chips}</div>
          </div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Date</th><th>Job</th><th>Foreman</th><th>Type</th><th>Reason</th></tr></thead>
            <tbody>${rowsH || `<tr><td colspan="5" class="dim">No support interventions match.</td></tr>`}</tbody>
          </table></div>
          ${pager}
        </div>`;
      // Debounced (~140ms) so a fast typist doesn't re-scan the whole job table per keystroke, and
      // the REAL caret position is restored — it used to jump to the end, so editing mid-word was
      // impossible (audit 2026-07-25).
      var qi = el.querySelector("#rpSupQ");
      if (qi) qi.oninput = () => {
        RP.supQ = qi.value; RP.supPage = 0;
        var a = qi.selectionStart, b = qi.selectionEnd;
        clearTimeout(RP._supT);
        RP._supT = setTimeout(function () {
          if (!document.getElementById("rpSupport")) return;
          paintSupport();
          var q2 = document.getElementById("rpSupQ");
          if (q2) { q2.focus(); try { q2.setSelectionRange(a, b); } catch (e) {} }
        }, 140);
      };
      el.querySelectorAll("[data-suptype]").forEach(b => b.onclick = () => { RP.supType = b.getAttribute("data-suptype"); RP.supPage = 0; paintSupport(); });
      var sp = el.querySelector("[data-supprev]"), sn = el.querySelector("[data-supnext]");
      if (sp) sp.onclick = () => { RP.supPage--; paintSupport(); };
      if (sn) sn.onclick = () => { RP.supPage++; paintSupport(); };
    }

    function repaint() {
      var v = RP.view;
      document.getElementById("rpWrapEl").style.display = v === "perf" ? "" : "none";
      document.getElementById("rpLegend").style.display = v === "perf" ? "" : "none";
      document.getElementById("rpBoard").style.display = v === "board" ? "" : "none";
      document.getElementById("rpReasons").style.display = v === "reasons" ? "" : "none";
      document.getElementById("rpSupport").style.display = v === "support" ? "" : "none";
      if (v === "perf") paintMatrix();
      else if (v === "board") paintBoard();
      else if (v === "reasons") paintReasons();
      else paintSupport();
      if (barC) barC.refresh();
      RSC.fitScroller(document.getElementById("rpWrapEl"));
    }

    // ---- control wiring ---- (the window picker wires itself inside paintWinOpts)
    document.getElementById("rpOlder").onclick = () => { RP.offset = Math.min(Math.max(0, allCols().length - win()), RP.offset + win()); closeDrawer(); repaint(); };
    document.getElementById("rpNewer").onclick = () => { RP.offset = Math.max(0, RP.offset - win()); closeDrawer(); repaint(); };
    resetBtn.onclick = () => {
      RP.sources.clear(); RP.statuses.clear(); RP.billcats.clear(); RP.foremen.clear();
      RP.sortCol = null; RP.sortDir = "desc"; RP.offset = 0;
      closeDrawer();
      msControls.forEach(c => c.paintBtn());
      repaint();
    };

    RP.cell = null;
    repaint();
  },
});
