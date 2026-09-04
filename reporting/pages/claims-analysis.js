/* REVIEWS ▸ Claims Analysis — every claim with the job it belongs to, read as RATES.
 *
 * Built 2026-09-02 on the direct Monday feed (src/monday_sync.py -> fct_claims ->
 * mart_claims_analysis). Two rules from the design review that this page enforces:
 *   1. NEVER compare people on claim COUNTS. Every per-person number is the SHARE of that
 *      person's own jobs in the window that drew a claim, and a person with fewer than
 *      MIN_JOBS jobs is shown as "small sample" instead of a rate that would mislead.
 *   2. The board's Reason / Responsibility are what an employee CHOSE (59% blank). They are
 *      shown as families so they can be counted, and labelled as the team's own
 *      classification; no model reads a claim -- the words in the thread do the work.
 *
 * The drawer reads ONE claim's whole Monday thread through the gated /api/_claimthread
 * (monday_update never travels through the generic dataset path).
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.claims_analysis) {
    RS.DATASETS.claims_analysis = {
      table: "mart_claims_analysis",
      cols: ["Monday Item Id", "Created Date", "Month", "Customer", "Request No", "Request Joinkey",
             "Group", "Status", "Is Open", "Reason", "Reason Family", "Responsibility",
             "Responsibility Family", "Service Type", "Board Sale", "Board Foreman", "Case Owner",
             "Open Date", "Close Date", "Messages", "Files", "Job Date", "Company", "Sales Person",
             "Foreman", "Moving Type", "State", "Total Bill", "Quote", "Estimated CF", "Real CF",
             "Price Increase Pct", "CF Variance Pct", "Refund $", "Has Refund", "Negative Reviews",
             "Days After Job", "Days To Close", "Monday Url",
             "Job Type", "Had Storage", "Had Overnight", "Was Labor", "Two Sales People"],
      dateCols: { "Created Date": "Created Date" }, defaultDate: "Created Date",
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.claims_keywords) {
    RS.DATASETS.claims_keywords = {
      table: "mart_claim_keywords",
      cols: ["Monday Item Id", "Language", "Keyword Family", "Keyword Family 2", "Keyword Confidence",
             "Matched Keywords", "Board Family", "Family Used", "Agreement", "Severity Signal",
             "Hits Price", "Hits Damage", "Hits Missing", "Hits Timing", "Hits Conduct", "Hits Billing",
             "Hits Storage", "Hits Customer", "Mentions Refund", "Mentions Discount", "Mentions Review",
             "Mentions Dispute", "Mentions Legal", "Mentions Photos", "Mentions Claim Form", "Dict Version"],
    };
  }
  // WHO GETS CREDITED FOR A JOB AND IN WHAT SHARE. One row per (job, salesperson); the
  // share is the closing sheet's own split, normalised to sum to 1 per job, with branch
  // owners already excluded upstream so real salespeople carry the whole sale.
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_credit) {
    RS.DATASETS.sales_credit = {
      table: "mart_sales_credit",
      cols: ["Request Joinkey", "Job Date", "Company", "Sales Person", "SP Slot",
             "Share", "Bill Share", "Shared Sale"],
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.claim_keyword_rules) {
    RS.DATASETS.claim_keyword_rules = { table: "claim_keyword_rule", cols: ["Kind", "Family", "Term", "Weight"] };
  }
})();

registerPage({
  id: "claims-analysis",
  group: "reviews",
  title: "Claims Analysis",
  async render(host) {
    const num = RS.num, fmtN = RS.fmtN;
    const esc = s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    // an href scheme is not a place for trust: only https ever reaches the DOM
    const mondayCell = u => (/^https:\/\//i.test(String(u || ""))
      ? `<a class="cln-mon" href="${esc(u)}" target="_blank" rel="noopener" title="open this claim on the Monday board">Open &#8599;</a>`
      : '<span class="cln-small">&mdash;</span>');
    const money0 = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const pct1 = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";
    // A RATE IS A PERCENT OF THE JOBS (his call 2026-09-03: "per 100-s --> lets make it
    // percentages"). claims / jobs * 100 is identical arithmetic either way; the percent is
    // simply the unit people already read. Everything on the page formats through rPct.
    const per100 = (c, j) => j ? (c / j * 100) : null;
    const rPct = v => (v == null || isNaN(v)) ? "—" : v.toFixed(1) + "%";
    // A CREDITED NUMBER MAY BE FRACTIONAL. Half a claim is a real thing once a job has two
    // salespeople, and printing 38.5 as "39" would be the kind of quiet rounding that makes
    // a column stop adding up. One decimal only where there is one to show.
    const fmtC = v => { const x = num(v) || 0;
      return Math.abs(x - Math.round(x)) < 0.05 ? fmtN(Math.round(x)) : x.toFixed(1); };
    const r1 = v => (v == null || isNaN(v)) ? "—" : v.toFixed(1);
    const MIN_JOBS = 30;

    if (!document.getElementById("cln-style")) {
      const st = document.createElement("style");
      st.id = "cln-style";
      st.textContent = [
        // only what the kit cannot say; page-prefixed so it can never leak
        ".cln-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        // the print button sits with the page title, right-aligned, and never squeezes
        // the description text on a narrow window
        ".cln-pdf{float:right;margin:-2px 0 8px 16px}",
        ".cln-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;"
          + "margin-bottom:1px}",
        ".cln-in:focus{border-color:var(--brand)}",
        // the ledger (the CL page's rule: groups with sentences, never a wall of tiles)
        ".cln-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px;margin-top:12px}",
        ".cln-grid>.panel{min-width:0}",
        // THE HERO: one answer, at the size of an answer. Everything else is evidence.
        ".cln-hero{display:grid;grid-template-columns:minmax(230px,300px) 1fr;gap:26px;padding:20px 22px;align-items:start}",
        "@media (max-width:860px){.cln-hero{grid-template-columns:1fr}}",
        ".cln-hero .lbl{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}",
        ".cln-big{font-size:clamp(38px,4.4vw,58px);font-weight:800;letter-spacing:-2px;line-height:1;"
          + "margin:8px 0 2px;font-variant-numeric:tabular-nums}",
        ".cln-big .u{font-size:15px;font-weight:700;letter-spacing:0;color:var(--muted);margin-left:6px}",
        ".cln-deltas{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}",
        ".cln-d{font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:999px;white-space:nowrap;"
          + "background:var(--panel-2);color:var(--muted);border:1px solid var(--line-2)}",
        ".cln-d.good{color:var(--pos);border-color:color-mix(in srgb,var(--pos) 34%,transparent)}",
        ".cln-d.bad{color:var(--neg);border-color:color-mix(in srgb,var(--neg) 34%,transparent)}",
        ".cln-d small{font-weight:600;color:var(--faint);margin-left:4px}",
        ".cln-note{font-size:12px;color:var(--muted);line-height:1.55;margin-top:12px;max-width:34em}",
        ".cln-note b{color:var(--ink)}",
        // the secondary figures: a quiet strip, not four more hero tiles
        ".cln-mini{display:grid;grid-template-columns:repeat(auto-fit,minmax(122px,1fr));gap:0;"
          + "border-top:1px solid var(--line-2);margin-top:16px;padding-top:14px}",
        ".cln-mini>div{padding:0 16px;border-left:1px solid var(--line-2);min-width:0}",
        ".cln-mini>div:first-child{border-left:0;padding-left:0}",
        ".cln-mini .k{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}",
        ".cln-mini .n{font-size:20px;font-weight:800;margin-top:4px;font-variant-numeric:tabular-nums;letter-spacing:-.5px}",
        ".cln-mini .n.warn{color:var(--warn)} .cln-mini .n.bad{color:var(--neg)}",
        ".cln-mini .h{font-size:11px;color:var(--faint);margin-top:3px;line-height:1.45}",
        // the trend, drawn rather than listed
        ".cln-svg{width:100%;height:auto;display:block;overflow:visible}",
        ".cln-svg .ax{stroke:var(--line-2);stroke-width:1}",
        ".cln-svg .bar{fill:var(--line-2)}",
        ".cln-svg .ln{fill:none;stroke:var(--warn);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}",
        ".cln-svg .ar{fill:var(--warn);opacity:.10}",
        ".cln-svg .dot{fill:var(--panel);stroke:var(--warn);stroke-width:2}",
        ".cln-svg .ln.part{stroke-dasharray:4 3;opacity:.6}",
        ".cln-svg .dot.part{stroke-dasharray:2 2;opacity:.7}",
        ".cln-svg .tk{font-size:9.5px;fill:var(--faint);font-weight:600}",
        ".cln-svg .vl{font-size:10px;fill:var(--muted);font-weight:700}",
        // one pivot table instead of three share cards
        ".cln-dim-seg{display:flex;gap:0;flex-wrap:wrap;border:1px solid var(--line);border-radius:9px;overflow:hidden}",
        ".cln-dim-seg button{font-family:inherit;font-size:12px;font-weight:600;padding:7px 12px;border:0;"
          + "background:var(--panel);color:var(--muted);cursor:pointer;border-left:1px solid var(--line-2)}",
        ".cln-dim-seg button:first-child{border-left:0}",
        ".cln-dim-seg button.on{background:var(--brand);color:#fff}",
        ".cln-chip{font-family:inherit;font-size:12px;font-weight:600;padding:6px 11px;border-radius:999px;"
          + "border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer;margin-bottom:1px}",
        ".cln-chip.on{background:var(--brand);color:#fff;border-color:var(--brand)}",
        ".cln-wbar{height:8px;background:var(--panel-2);border-radius:4px;overflow:hidden;min-width:44px}",
        ".cln-wbar i{display:block;height:100%;background:var(--warn);border-radius:4px}",
        // share rows: one colour per meaning
        ".cln-share{display:grid;grid-template-columns:minmax(110px,190px) minmax(60px,1fr) auto;gap:10px;"
          + "align-items:center;padding:6px 0;border-bottom:1px solid var(--line-2)}",
        ".cln-share:last-child{border-bottom:0}",
        ".cln-share .n{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
        ".cln-share .t{height:10px;background:var(--panel-2);border-radius:5px;overflow:hidden}",
        ".cln-share .t i{display:block;height:100%;background:var(--warn);border-radius:5px}",
        ".cln-share.neg .t i{background:var(--neg)} .cln-share.brand .t i{background:var(--brand)}",
        ".cln-share .v{font-size:12.5px;color:var(--muted);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}",
        // months: bars with the rate beside
        // FULL-WIDTH EXPLANATORY TEXT. The kit's .rs-hint is capped at --rs-prose, which is
        // correct for a caption but leaves these -- which carry the argument, not a label --
        // ending two thirds across with empty panel beside them. Same voice, whole width.
        ".cln-say{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:none;"
          + "margin:0 0 12px}",
        ".cln-say b{color:var(--ink)}",
        ".cln-small{color:var(--faint);font-size:11.5px;white-space:nowrap}",
        ".cln-row{cursor:pointer} .cln-row:hover td{background:var(--panel-2)}",
        ".cln-mon{color:var(--brand);font-weight:600;text-decoration:none;white-space:nowrap}",
        ".cln-mon:hover{text-decoration:underline}",
        // the person row that opens: a caret, and a hover the inert kit rows do not get
        ".cln-open{cursor:pointer} .cln-open:hover td{background:var(--panel-2)}",
        ".cln-cx{display:inline-block;width:12px;color:var(--faint);font-size:10px;" +
          "transition:transform .12s ease}",
        ".cln-open.on .cln-cx{transform:rotate(90deg);color:var(--brand)}",
        ".cln-subrow td{background:var(--panel-2);padding:0 0 10px}",
        ".cln-sub{border-left:2px solid var(--line-2);margin:0 0 0 18px;padding:10px 12px}",
        ".cln-subh{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}",
        ".cln-subh b{font-size:13px}",
        ".cln-sub .rs-table td,.cln-sub .rs-table th{padding:5px 8px;font-size:11.5px}",
        ".cln-stale td{opacity:.55}",
        ".cln-tail td{background:var(--panel-2);color:var(--muted)}",
        ".cln-tot td{border-top:2px solid var(--line);font-weight:700;background:var(--panel-2)}",
        ".cln-tot .cln-small{font-weight:600}",
        ".cln-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;font-size:12.5px;color:var(--faint)}",
        ".cln-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
        // the drawer: one claim, read in full
        ".cln-dim{position:fixed;inset:0;background:rgba(0,0,0,.28);z-index:60}",
        ".cln-drawer{position:fixed;top:0;right:0;bottom:0;width:min(720px,94vw);background:var(--panel);"
          + "border-left:1px solid var(--line);z-index:61;display:flex;flex-direction:column;box-shadow:-12px 0 40px rgba(0,0,0,.18)}",
        ".cln-dh{padding:16px 20px 12px;border-bottom:1px solid var(--line-2);display:flex;gap:12px;align-items:flex-start}",
        ".cln-dh h3{margin:0;font-size:16px;font-weight:800} .cln-dh .sub{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5}",
        ".cln-dh .x{margin-left:auto}",
        ".cln-db{overflow:auto;padding:14px 20px 24px;flex:1}",
        ".cln-cells{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 14px;margin-bottom:14px}",
        ".cln-cell .l{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}",
        ".cln-cell .v{font-size:13px;margin-top:2px;overflow-wrap:anywhere}",
        ".cln-msg{padding:10px 12px;border:1px solid var(--line-2);border-radius:10px;margin-top:8px;background:var(--panel)}",
        ".cln-msg.reply{margin-left:26px;background:var(--panel-2)}",
        ".cln-msg .who{font-size:11.5px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap}",
        ".cln-msg .who b{color:var(--ink)}",
        ".cln-msg .txt{font-size:13px;line-height:1.55;margin-top:4px;white-space:pre-wrap;overflow-wrap:anywhere}",
        ".cln-msg .att{font-size:11.5px;color:var(--faint);margin-top:6px}",
        ".cln-eyebrow{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:14px 0 4px}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Claims Analysis</h1></div>
      <div class="rs-loading" style="padding:22px">Reading the claims and the closings…</div>`;

    const [claimsAll, closingAll, creditAll] = await Promise.all([
      RS.load("claims_analysis"), RS.load("closing"),
      RS.load("sales_credit").catch(() => [])]);
    const closing = (closingAll || []).filter(r => r["Record Source"] === "closing");
    // credit, indexed by the job. A job with one salesperson has a single entry of share 1.
    const CREDIT = {};
    (creditAll || []).forEach(r => {
      const jk = r["Request Joinkey"], p = String(r["Sales Person"] || "").trim();
      if (!jk || !p) return;
      const sh = num(r.Share); if (!(sh > 0)) return;
      (CREDIT[jk] = CREDIT[jk] || []).push({ p, sh, slot: num(r["SP Slot"]) || 1 });
    });
    const creditOf = jk => CREDIT[jk] || null;
    const hasCredit = Object.keys(CREDIT).length > 0;
    // every name that is credited anywhere -- the picker offers these, not just slot 1
    const CREDITED_NAMES = (() => {
      const o = {};
      (creditAll || []).forEach(r => { const p = String(r["Sales Person"] || "").trim();
        if (p && num(r.Share) > 0) o[p] = 1; });
      return Object.keys(o).sort();
    })();
    const soldBy = (jk, who) => {
      const c = creditOf(jk);
      return c ? c.some(x => x.p === who) : false;
    };
    // THE KEYWORD READING (src/claims_keywords.py): the thread scored against word lists.
    // A manager's correction (claim_class_override) sits over it; nothing is destroyed.
    const KW = {}, RULES = [];
    try { (await RS.load("claims_keywords") || []).forEach(r => { KW[String(r["Monday Item Id"])] = r; }); }
    catch (e) { /* stage not run yet */ }
    try { (await RS.load("claim_keyword_rules") || []).forEach(r => RULES.push(r)); } catch (e) { /* none */ }
    const OV = {};
    try {
      const res = await fetch(ZTZ.API + "/api/_claimoverride", { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
      const j = await res.json();
      (j.overrides || []).forEach(o => { OV[String(o["Monday Item Id"])] = o; });
    } catch (e) { /* no access or none yet */ }
    const kwOf = r => KW[String(r["Monday Item Id"])] || null;
    const ovOf = r => OV[String(r["Monday Item Id"])] || null;
    // the family the page COUNTS: a manager's correction > the board's own Reason > keywords
    const famOf = r => { const o = ovOf(r), k = kwOf(r);
      return (o && o.Family) || (k && k["Family Used"]) || r["Reason Family"]; };
    const sevOf = r => { const o = ovOf(r), k = kwOf(r); return (o && o.Severity) || (k && k["Severity Signal"]) || null; };
    const nKW = Object.keys(KW).length;
    const FAM_LIST = ["Price", "Damage", "Missing", "Timing", "Conduct", "Billing", "Storage", "Customer", "Other"];

    /* ---------- state ----------
       TWO KINDS OF FILTER, AND THE WHOLE ANALYTICAL ARGUMENT OF THE PAGE IS THE DIFFERENCE.
       from/to, jobType, sp and fm all exist ON THE CLOSING, so each narrows the jobs
       denominator as well as the claims -- a per-100 under them is a real rate. resp, extra
       and q exist only on the CLAIM, so they narrow the numerator alone and their per-100
       would be a lie. See RATE below. */
    const today = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    const back = months => { const t = new Date(today); t.setMonth(t.getMonth() - months); return iso(t); };
    const S = { from: back(6), to: iso(today), jobType: "", sp: "", fm: "", resp: "",
                extra: "", q: "", dim: "Family", page: 0, pageSize: 25,
                openSp: "", openFm: "", allSp: 0, allFm: 0 };
    let qTimer = null;

    /* WHAT WINDOW IS THIS? On screen the filter bar answers that; on a phone looking at a PDF
       nothing does, so the print header says it in words. Every filter that is actually set
       gets named — an unnamed filter is how a screenshot starts an argument. */
    function printWindowLabel() {
      const bits = [`${S.from} to ${S.to}`];
      if (S.jobType) bits.push(S.jobType);
      if (S.sp) bits.push("salesperson " + S.sp);
      if (S.fm) bits.push("foreman " + S.fm);
      if (S.resp) bits.push("responsibility " + S.resp);
      if (S.extra) bits.push("extra service " + S.extra);
      if (S.q.trim()) bits.push(`search "${S.q.trim()}"`);
      return bits.join(" · ") + (bits.length === 1 ? " · no other filters" : "");
    }

    // JOB TYPE COMES FROM THE CLOSING (his call 2026-09-03). The mart carries `Job Type`
    // derived from the closing's own Moving Type; the board's Service Type is not consulted
    // for a type, only for the extra services below.
    const jobTypeOfClosing = r => {
      const v = String(r["Move Type"] || "").trim().toUpperCase();
      if (v === "LM") return "Local";
      if (v === "LD") return "Long distance";
      return "";
    };
    // ...AND STORAGE IS AN EXTRA SERVICE, NOT A TYPE. "it is not related to job type - it is
    // kinda extra service that customer took". These live on the claim only, so they never
    // leave a rate standing.
    const EXTRAS = [["storage", "Storage", "Had Storage"], ["overnight", "Overnight", "Had Overnight"],
                    ["labor", "Labor only", "Was Labor"], ["tworeps", "Two salespeople", "Two Sales People"]];

    /* ---------- one paint ---------- */
    function paint() {
      const from = S.from, to = S.to;
      const q = S.q.trim().toLowerCase();
      const inWin = d => { const v = String(d || "").slice(0, 10);
        if (!v) return false;
        if (from && v < from) return false;
        if (to && v > to) return false;
        return true; };
      const ex = EXTRAS.find(e => e[0] === S.extra);

      const claims = claimsAll.filter(r => {
        if (!inWin(r["Created Date"])) return false;
        // --- these four also narrow the jobs, so they keep the rate honest
        if (S.jobType && r["Job Type"] !== S.jobType) return false;
        // A REP IS CREDITED FOR EVERY JOB THEY SOLD, not only the ones where the sheet
        // happened to list them first. Matching on the claim's `Sales Person` (which is the
        // closing's slot 1) silently dropped every job a rep sold second.
        if (S.sp && !(hasCredit ? soldBy(r["Request Joinkey"], S.sp) : r["Sales Person"] === S.sp)) return false;
        if (S.fm && r.Foreman !== S.fm) return false;
        // --- these three narrow the claims only
        if (S.resp && (r["Responsibility Family"] || "Not assigned") !== S.resp) return false;
        if (ex && num(r[ex[2]]) !== 1) return false;
        if (q) {
          const hay = [r.Customer, r.Reason, r.Status, r["Sales Person"], r.Foreman, r["Request No"],
                       r["Job Type"], r["Case Owner"], r.State].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      // THE DENOMINATOR. The jobs are narrowed by exactly the filters the CLOSING can honour.
      const jobs = closing.filter(r => {
        if (!inWin(r.Date)) return false;
        if (S.jobType && jobTypeOfClosing(r) !== S.jobType) return false;
        if (S.sp && !(hasCredit ? soldBy(r["Request Joinkey"], S.sp) : r["Sales Person"] === S.sp)) return false;
        if (S.fm && r.Foreman !== S.fm) return false;
        return true;
      });
      // RATE. A per-100 is only a rate when every active filter moved BOTH sides. Date, job
      // type, salesperson and foreman do; responsibility, extra service and the search box
      // cannot -- there is no such column on a closing -- so under those the page withholds
      // the number rather than dividing a narrowed numerator by a whole denominator.
      const narrowed = !!(S.resp || S.extra || q);
      const whyNarrowed = S.resp ? "the responsibility filter"
        : S.extra ? "the extra-service filter" : "the search box";
      const jobKeys = new Set(jobs.map(r => r["Request Joinkey"]).filter(Boolean));
      const nJobs = jobKeys.size;

      // DIRECTION (his chosen feature). The same rate over the previous window of equal
      // length, and over the same window a year earlier. Both use the identical filter
      // predicates, so the comparison is like-for-like or it is not shown at all.
      const shift = (d, days) => { const t = new Date(d + "T00:00:00"); t.setDate(t.getDate() - days); return iso(t); };
      const spanDays = (from && to)
        ? Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1) : 0;
      function rateOver(f, t) {
        if (!f || !t) return null;
        const win = d => { const v = String(d || "").slice(0, 10); return v && v >= f && v <= t; };
        const spOk = r => !S.sp || (hasCredit ? soldBy(r["Request Joinkey"], S.sp) : r["Sales Person"] === S.sp);
        const c = claimsAll.filter(r => win(r["Created Date"])
          && (!S.jobType || r["Job Type"] === S.jobType)
          && spOk(r) && (!S.fm || r.Foreman === S.fm)).length;
        const j = new Set(closing.filter(r => win(r.Date)
          && (!S.jobType || jobTypeOfClosing(r) === S.jobType)
          && spOk(r) && (!S.fm || r.Foreman === S.fm)).map(r => r["Request Joinkey"]).filter(Boolean)).size;
        return j ? { rate: c / j * 100, claims: c, jobs: j } : null;
      }
      const nowRate = nJobs ? (claims.length / nJobs * 100) : null;
      const prevWin = spanDays ? rateOver(shift(from, spanDays), shift(to, spanDays)) : null;
      const yoyWin = spanDays ? rateOver(shift(from, 365), shift(to, 365)) : null;

      const n = claims.length;
      const open = claims.filter(r => num(r["Is Open"]) === 1).length;
      const refunded = claims.filter(r => num(r["Has Refund"]) === 1);
      const refund$ = refunded.reduce((a, r) => a + (num(r["Refund $"]) || 0), 0);
      const pub = claims.filter(r => (num(r["Negative Reviews"]) || 0) > 0).length;
      const unclassified = claims.filter(r => r["Reason Family"] === "Unclassified").length;
      const kwFilled = claims.filter(r => { const k = kwOf(r);
        return r["Reason Family"] === "Unclassified" && k && k["Keyword Family"] !== "No keywords"; }).length;
      const compared = claims.filter(r => { const k = kwOf(r); return k && k.Agreement != null; });
      const agree = compared.filter(r => num(kwOf(r).Agreement) === 1).length;
      const critical = claims.filter(r => sevOf(r) === "Critical").length;
      const high = claims.filter(r => sevOf(r) === "High").length;
      const flagCount = f => claims.filter(r => { const k = kwOf(r); return k && num(k["Mentions " + f]) > 0; }).length;

      /* by month (claims + rate) */
      const byM = {};
      claims.forEach(r => { const m = r.Month || "—"; byM[m] = (byM[m] || 0) + 1; });
      const jobsByM = {};
      jobs.forEach(r => { const k = String(r.Date || "").slice(0, 7); const jk = r["Request Joinkey"];
        if (!k || !jk) return; (jobsByM[k] = jobsByM[k] || new Set()).add(jk); });
      const months = Object.keys(byM).sort();

      // where both the team and the keywords spoke: how often they agree, per family
      const agreeByFam = (() => { const o = {}; compared.forEach(r => { const f = r["Reason Family"];
        const a = o[f] = o[f] || { n: 0, ok: 0 }; a.n++; if (num(kwOf(r).Agreement) === 1) a.ok++; });
        return Object.entries(o).sort((a, b) => b[1].n - a[1].n); })();

      /* per person: jobs in window from the closing, claims from the mart */
      const blank = name => ({ name, claims: 0, price: 0, damage: 0, missing: 0, timing: 0,
                               refund: 0, pub: 0, inc: [], cfv: [], rows: [] });
      // WEIGHTED WHEN A JOB WAS SOLD BY MORE THAN ONE PERSON (his ask). `weigh` turns a row
      // into a list of (person, share) pairs. For a foreman that is always one pair of share
      // 1 -- one person runs a job. For a salesperson it is the closing sheet's own split, so
      // a 50/50 job gives each of them 0.5 of the claim and 0.5 of the job. Weighting BOTH
      // sides identically is what keeps the percentage meaningful, and because the shares sum
      // to 1 the credited claims still add up to the headline exactly.
      const perPerson = (jobField, claimField, weighted) => {
        const parts = r => {
          if (!weighted || !hasCredit) {
            const p = r[claimField] || r[jobField];
            return p ? [{ p, sh: 1 }] : [];
          }
          const c = creditOf(r["Request Joinkey"]);
          return c ? c.map(x => ({ p: x.p, sh: x.sh })) : [];
        };
        const jobsBy = {};                 // name -> summed share of jobs
        const jobSeen = {};                // (person, joinkey) already counted
        const jobsAnyone = new Set();      // distinct jobs that have ANY of these people
        jobs.forEach(r => {
          const jk = r["Request Joinkey"];
          if (!jk) return;
          (weighted && hasCredit ? parts(r) : (r[jobField] ? [{ p: r[jobField], sh: 1 }] : []))
            .forEach(x => {
              const k = x.p + " " + jk;
              if (jobSeen[k]) return;      // one job is one job, however many closing rows
              jobSeen[k] = 1;
              jobsAnyone.add(jk);
              jobsBy[x.p] = (jobsBy[x.p] || 0) + x.sh;
            });
        });
        // the same tally over EVERY closing, not just this window's -- it is the only way to
        // tell "this name has never worked for us" from "their jobs are outside the window"
        const everBy = {};
        if (weighted && hasCredit) { CREDITED_NAMES.forEach(p => { everBy[p] = 1; }); }
        else closing.forEach(r => { const p = r[jobField]; if (p) everBy[p] = 1; });
        const rows = {};
        const orphan = blank("");          // claims nobody is credited for
        claims.forEach(r => {
          const ps = parts(r);
          if (!ps.length) { orphan.claims++; orphan.rows.push(r);
                    orphan.refund += num(r["Refund $"]) || 0;
                    if ((num(r["Negative Reviews"]) || 0) > 0) orphan.pub++;
                    const f0 = famOf(r);
                    if (f0 === "Price") orphan.price++; if (f0 === "Damage") orphan.damage++;
                    if (f0 === "Missing") orphan.missing++; if (f0 === "Timing") orphan.timing++;
                    return; }
          ps.forEach(({ p, sh }) => {
            const o = rows[p] = rows[p] || blank(p);
            // THE LIST IS THE ACCUMULATOR THAT PRODUCED THE NUMBER. Collected here rather
            // than re-filtered later, so "the drill shows exactly the claims behind this
            // number" is true by construction. `shareOf` remembers what fraction of each
            // claim this person carries, so the drill can show it.
            o.rows.push(r);
            (o.shareOf = o.shareOf || {})[String(r["Monday Item Id"])] = sh;
            o.claims += sh;
            if (sh < 0.999) o.shared = (o.shared || 0) + 1;
            const f = famOf(r);
            if (f === "Price") o.price += sh; if (f === "Damage") o.damage += sh;
            if (f === "Missing") o.missing += sh; if (f === "Timing") o.timing += sh;
            o.refund += (num(r["Refund $"]) || 0) * sh;
            if ((num(r["Negative Reviews"]) || 0) > 0) o.pub += sh;
            const pi = num(r["Price Increase Pct"]); if (pi != null && !isNaN(pi)) o.inc.push(pi);
            const cv = num(r["CF Variance Pct"]); if (cv != null && !isNaN(cv)) o.cfv.push(cv);
          });
        });
        Object.keys(jobsBy).forEach(p => { if (!rows[p]) rows[p] = blank(p); });
        const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y);
          return s[Math.floor(s.length / 2)]; };
        const everyone = Object.values(rows).map(o => ({ ...o, jobs: jobsBy[o.name] || 0,
          medInc: median(o.inc), medCf: median(o.cfv) }));
        const grand = everyone.reduce((a, o) => ({
          people: a.people + ((o.claims > 0 || o.jobs > 0) ? 1 : 0),
          claims: a.claims + (o.claims || 0),
          refund: a.refund + (o.refund || 0), pub: a.pub + (o.pub || 0),
        }), { people: 0, claims: 0, refund: 0, pub: 0 });
        grand.jobs = jobsAnyone.size;
        const all = everyone.filter(o => o.claims > 0 || o.jobs >= MIN_JOBS);
        const named = all.filter(o => o.jobs > 0);
        // TWO KINDS OF ZERO, AND THEY ARE NOT THE SAME THING.
        // "Never ran a job for us" is a name the board typed that no closing has ever
        // carried -- the Monday dropdown is free text, so a claim can be filed against
        // "Abaza" where the closing says "Giorgi Abazadze". "Jobs outside this window" is a
        // real person whose work simply predates the period; his claims count in the
        // numerator while his jobs are not in the denominator. Folding the two together
        // would put a false label on a real person.
        const fold = (list, name, kind) => {
          if (!list.length) return null;
          const o = blank(name); o.residual = true; o.kind = kind; o.jobs = 0;
          o.names = list.length; o.medInc = null; o.medCf = null;
          list.forEach(x => { o.claims += x.claims; o.price += x.price; o.damage += x.damage;
            o.missing += x.missing; o.timing += x.timing; o.refund += x.refund; o.pub += x.pub;
            o.rows = o.rows.concat(x.rows || []); });
          return o;
        };
        const tailRows = [
          fold(all.filter(o => o.jobs === 0 && !everBy[o.name]),
               "Not a name on any closing", "never"),
          fold(all.filter(o => o.jobs === 0 && everBy[o.name]),
               "Their jobs are outside this window", "outside"),
        ].filter(Boolean);
        // CLAIMS WITH NOBODY ON THEM. Dropped before this table existed, so the Claims
        // column never summed to the headline above it. They get a row of their own.
        if (orphan.claims) {
          orphan.residual = true; orphan.kind = "none"; orphan.jobs = 0;
          orphan.name = claimField === "Foreman" ? "No foreman on the claim"
                                                 : "No salesperson credited for the job";
          orphan.medInc = null; orphan.medCf = null;
          tailRows.push(orphan);
        }
        const small = o => (o.jobs || 0) < MIN_JOBS;
        const out = named.sort((a, b) =>
          (small(a) ? 1 : 0) - (small(b) ? 1 : 0)
          || (per100(b.claims, b.jobs) || -1) - (per100(a.claims, a.jobs) || -1)
          || b.claims - a.claims).concat(tailRows);
        // `fold` builds its rows FROM `everyone`, so those claims are already in `grand`.
        // The orphan is the only thing that never had a person and so was never counted.
        if (orphan.claims) { grand.claims += orphan.claims; grand.refund += orphan.refund;
          grand.pub += orphan.pub; }
        out.grand = grand;
        return out;
      };
      const sales = perPerson("Sales Person", "Sales Person", true);
      const foremen = perPerson("Foreman", "Foreman", false);
      const rateCell = (c, j, cls) => narrowed
        ? `<td class="num"><span class="cln-small" title="a rate needs the whole population — the service picker and the search box narrow the claims but cannot narrow the jobs">—</span></td>`
        : (j >= MIN_JOBS
          ? `<td class="num ${cls || ""}">${rPct(per100(c, j))}</td>`
          : `<td class="num"><span class="cln-small" title="fewer than ${MIN_JOBS} jobs in this window">${j ? rPct(per100(c, j)) + " · small" : "—"}</span></td>`);

      /* the list */
      const sorted = claims.slice().sort((a, b) =>
        String(b["Created Date"] || "").localeCompare(String(a["Created Date"] || "")));
      S.page = Math.min(S.page, Math.max(0, Math.ceil(sorted.length / S.pageSize) - 1));
      const pageRows = sorted.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);
      const pages = Math.max(1, Math.ceil(sorted.length / S.pageSize));


      /* ---------- the drill: the claims that made a person's number ----------
         Rows were collected during the tally (perPerson), so o.rows IS what produced
         o.claims. The header restates the same arithmetic from the same array; where a
         numerator-only filter is active it refuses to state a rate at all. */
      const CAP = 25;
      const dayIn = d => { const v = String(d || "").slice(0, 10); return !from || (v && v >= from); };

      function subCard(o, who) {
        const rows = (o.rows || []).slice()
          .sort((a, b) => String(b["Created Date"] || "").localeCompare(String(a["Created Date"] || "")));
        const stale = rows.filter(r => r["Job Date"] && !dayIn(r["Job Date"])).length;
        // TWO NUMBERS, BOTH TRUE, AND THE DIFFERENCE IS THE POINT. `rows.length` is how many
        // claims touch this person; `o.claims` is how much of them they are credited for,
        // which is less whenever a job was sold by two people. The rate uses the credited
        // figure over the credited job count -- both weighted the same way, so it stays a
        // percentage of their own work.
        const credited = o.claims;
        const isSplit = Math.abs(credited - rows.length) > 0.05;
        const head = o.residual
          ? `<b>${fmtN(rows.length)} claim${rows.length === 1 ? "" : "s"}</b>`
          : `<b>${fmtN(rows.length)} claim${rows.length === 1 ? "" : "s"}</b>` +
            (isSplit ? `<span class="cln-small"><b>${fmtC(credited)}</b> credited to them &mdash;
               ${o.shared || 0} of these ${(o.shared || 0) === 1 ? "was" : "were"} sold with someone else</span>` : "") +
            `<span class="cln-small">${fmtC(o.jobs)} job${Math.round(o.jobs) === 1 ? "" : "s"} credited in this window</span>` +
            (narrowed
              ? '<span class="cln-small">rate not shown &mdash; the filter narrows the claims but not the jobs</span>'
              : `<span class="cln-small"><b>${rPct(per100(credited, o.jobs))}</b> of their jobs drew a claim${o.jobs < MIN_JOBS ? " &middot; small sample" : ""}</span>`);
        if (!rows.length) {
          return `<div class="cln-sub"><div class="cln-subh">${head}</div>
            <div class="rs-hint">No claim on ${esc(o.name)} in this window.</div></div>`;
        }
        return `<div class="cln-sub">
          <div class="cln-subh">${head}</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Filed</th><th>Job date</th><th class="num">Days after</th>
              <th>Request&nbsp;#</th><th>Customer</th><th>Family</th><th>Status</th>
              <th>Case owner</th>${isSplit ? '<th class="num">Their share</th>' : ""}
              <th class="num">Bill</th><th class="num">Refund</th>
              <th>Monday</th></tr></thead>
            <tbody>${rows.map(r => {
              const out = r["Job Date"] && !dayIn(r["Job Date"]);
              return `<tr class="cln-row${out ? " cln-stale" : ""}" data-item="${esc(r["Monday Item Id"])}"${out ? ' title="the job is older than this window, so it is not among the jobs counted above"' : ""}>
                <td class="nowrap">${esc(String(r["Created Date"] || "").slice(0, 10))}</td>
                <td class="nowrap">${r["Job Date"] ? esc(String(r["Job Date"]).slice(0, 10)) : '<span class="cln-small">&mdash;</span>'}</td>
                <td class="num">${r["Days After Job"] == null ? '<span class="cln-small">&mdash;</span>' : fmtN(num(r["Days After Job"]))}</td>
                <td class="nowrap">${esc(r["Request No"] || "—")}</td>
                <td class="strong">${esc(r.Customer || "—")}</td>
                <td>${esc(famOf(r) || "—")}</td>
                <td>${num(r["Is Open"]) === 1 ? '<span class="rs-pill warn">' + esc(r.Status || "open") + "</span>" : esc(r.Status || "—")}</td>
                <td class="muted">${esc(r["Case Owner"] || "—")}</td>
                ${isSplit ? (() => { const sh = (o.shareOf || {})[String(r["Monday Item Id"])];
                  return `<td class="num">${sh == null ? '<span class="cln-small">&mdash;</span>'
                    : (sh > 0.999 ? '<span class="cln-small">all of it</span>' : Math.round(sh * 100) + "%")}</td>`; })() : ""}
                <td class="num">${num(r["Total Bill"]) ? money0(num(r["Total Bill"])) : '<span class="cln-small">&mdash;</span>'}</td>
                <td class="num">${num(r["Refund $"]) ? money0(num(r["Refund $"])) : '<span class="cln-small">&mdash;</span>'}</td>
                <td>${mondayCell(r["Monday Url"])}</td></tr>`; }).join("")}
            </tbody></table></div>
          ${stale ? `<div class="cln-say" style="margin:8px 0 0">${fmtN(stale)} of these ${stale === 1 ? "was" : "were"}
            filed about a job done <b>before</b> this window. A claim counts when it was FILED; the job
            count beside it counts jobs DONE — so those ${stale === 1 ? "is" : "are"} in the number above
            and their jobs are not.</div>` : ""}
          <div class="cln-say" style="margin:6px 0 0">Click any row to read the whole Monday thread here,
            or <b>Open &#8599;</b> to go to the board.</div>
        </div>`;
      }

      const residLabel = o => o.kind === "never"
        ? `${o.names} name${o.names === 1 ? "" : "s"} the board typed that no closing has ever carried`
        : o.kind === "outside"
          ? `${o.names} ${o.names === 1 ? "person" : "people"} whose jobs fall outside this window`
          : "claims the board left this field empty on";

      function bodyHtml(rows, extra, openName, showAll) {
        const main = rows.filter(o => !o.residual);
        const shown = showAll ? main : main.slice(0, CAP);
        const out = shown.concat(rows.filter(o => o.residual));
        return out.map(o => {
          const on = openName === o.name;
          const cells = `<td class="strong"><span class="cln-cx">&#9656;</span> ${esc(o.name)}` +
            (o.residual ? ` <span class="cln-small">${esc(residLabel(o))}</span>` : "") + "</td>" +
            `<td class="num">${o.jobs ? fmtC(o.jobs) : '<span class="cln-small">&mdash;</span>'}</td>` +
            `<td class="num">${fmtC(o.claims)}</td>` +
            rateCell(o.claims, o.jobs, "strong") + extra.cells(o) +
            `<td class="num">${o.refund ? money0(o.refund) : '<span class="cln-small">&mdash;</span>'}</td>` +
            `<td class="num">${o.pub ? fmtC(o.pub) : '<span class="cln-small">&mdash;</span>'}</td>`;
          return `<tr class="cln-open${on ? " on" : ""}${o.residual ? " cln-tail" : ""}" data-person="${esc(o.name)}">${cells}</tr>` +
            (on ? `<tr class="cln-subrow"><td colspan="${6 + extra.cols}">${subCard(o, extra.who)}</td></tr>` : "");
        }).join("") + (main.length > CAP && !showAll
          ? `<tr class="cln-tail"><td colspan="${6 + extra.cols}"><a href="#" data-showall="1">Show all ${fmtN(main.length)}</a> &mdash; ${fmtN(main.length - CAP)} more below the top ${CAP}</td></tr>`
          : "");
      }

      const spExtra = {
        who: "Salesperson", cols: 4,
        head: `<th class="num">Price claims</th><th class="num">% of jobs</th><th class="num">Median bill vs quote</th><th class="num">Median CF vs estimate</th>`,
        cells: o => `<td class="num">${o.price ? fmtC(o.price) : '<span class="cln-small">&mdash;</span>'}</td>${rateCell(o.price, o.jobs)}
          <td class="num">${o.medInc == null ? '<span class="cln-small">&mdash;</span>' : (o.medInc > 0 ? "+" : "") + pct1(o.medInc)}</td>
          <td class="num">${o.medCf == null ? '<span class="cln-small">&mdash;</span>' : (o.medCf > 0 ? "+" : "") + pct1(o.medCf)}</td>`,
      };
      const fmExtra = {
        who: "Foreman", cols: 4,
        head: `<th class="num">Damage</th><th class="num">% of jobs</th><th class="num">Missing</th><th class="num">Timing</th>`,
        cells: o => `<td class="num">${o.damage ? fmtC(o.damage) : '<span class="cln-small">&mdash;</span>'}</td>${rateCell(o.damage, o.jobs)}
          <td class="num">${o.missing ? fmtC(o.missing) : '<span class="cln-small">&mdash;</span>'}</td><td class="num">${o.timing ? fmtC(o.timing) : '<span class="cln-small">&mdash;</span>'}</td>`,
      };

      // THE TABLE STATES ITS OWN SUM. Summed from the underlying values over EVERY row --
      // residuals and anything behind "Show all" included -- never from the rounded text,
      // which is what made the column read 289.9 against a headline of 290.
      function totalRow(rows, extra) {
        const t = rows.grand || rows.reduce((a, o) => ({
          people: 0, claims: a.claims + (o.claims || 0), jobs: a.jobs + (o.jobs || 0),
          refund: a.refund + (o.refund || 0), pub: a.pub + (o.pub || 0),
        }), { claims: 0, jobs: 0, refund: 0, pub: 0 });
        const people = t.people || rows.filter(o => !o.residual).length;
        const blanks = extra.cols ? '<td class="num"></td>'.repeat(extra.cols) : "";
        // the headline counts every job in the window; this counts every job that HAS one of
        // these people on it, so a job nobody is named on is in the headline and not here
        const missing = Math.max(0, nJobs - t.jobs);
        return `<tr class="cln-tot">
          <td>All ${fmtN(people)} ${esc(people === 1 ? (extra.who || "").toLowerCase()
            : (extra.who === "Foreman" ? "foremen" : "salespeople"))}<span class="cln-small">${
            missing >= 1 ? " &middot; " + fmtC(missing) + " of the " + fmtN(nJobs)
              + (missing < 1.5 ? " jobs has no " : " jobs have no ")
              + esc((extra.who || "").toLowerCase()) + " on it" : ""}</span></td>
          <td class="num">${fmtC(t.jobs)}</td>
          <td class="num">${fmtC(t.claims)}</td>
          ${narrowed
            ? '<td class="num"><span class="cln-small">&mdash;</span></td>'
            : `<td class="num">${t.jobs ? rPct(per100(t.claims, t.jobs)) : '<span class="cln-small">&mdash;</span>'}</td>`}
          ${blanks}
          <td class="num">${t.refund ? money0(t.refund) : '<span class="cln-small">&mdash;</span>'}</td>
          <td class="num">${t.pub ? fmtC(t.pub) : '<span class="cln-small">&mdash;</span>'}</td></tr>`;
      }

      const perTable = (rows, who, extra, bodyId, openName, showAll) => `
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>${who}</th><th class="num">Jobs</th><th class="num">${extra.who === "Salesperson" && hasCredit ? "Claims credited" : "Claims"}</th>
              <th class="num">% of jobs</th>${extra.head}<th class="num">Refunds</th><th class="num">Went public</th></tr></thead>
            <tbody id="${bodyId}">${bodyHtml(rows, extra, openName, showAll)}</tbody>
            <tfoot>${totalRow(rows, extra)}</tfoot></table></div>`;

      /* ---------- the pivot: one table where three cards used to be ----------
         Family / Responsibility / Job type / Extra service / Case owner / State / Company.
         Strictly more than the three fixed cards could say, in a third of the height -- and
         every row carries its own rate, refund rate and public count rather than a bare bar. */
      const DIMS = [
        ["Family", r => famOf(r) || "—"],
        ["Responsibility", r => r["Responsibility Family"] || "Not assigned"],
        ["Job type", r => r["Job Type"] || "No closing"],
        ["Extra service", r => {
          const on = EXTRAS.filter(e => num(r[e[2]]) === 1).map(e => e[1]);
          return on.length ? on.join(" + ") : "Plain move";
        }],
        ["Case owner", r => r["Case Owner"] || "Unassigned"],
        ["State", r => r.State || "—"],
        ["Company", r => r.Company || "—"],
      ];
      const dimFn = (DIMS.find(d => d[0] === S.dim) || DIMS[0])[1];
      const pivot = (() => {
        const o = {};
        claims.forEach(r => {
          const k = dimFn(r);
          const a = o[k] = o[k] || { k, n: 0, refunded: 0, refund: 0, pub: 0, open: 0, days: [] };
          a.n++;
          if (num(r["Has Refund"]) === 1) { a.refunded++; a.refund += num(r["Refund $"]) || 0; }
          if ((num(r["Negative Reviews"]) || 0) > 0) a.pub++;
          if (num(r["Is Open"]) === 1) a.open++;
          const d = num(r["Days After Job"]); if (d != null && !isNaN(d)) a.days.push(d);
        });
        // JOBS PER DIMENSION VALUE, but only where the closing can actually answer. Job type
        // is the one dimension the closing shares, so it is the one that gets a rate.
        const jobsBy = {};
        if (S.dim === "Job type") {
          jobs.forEach(r => { const k = jobTypeOfClosing(r); const jk = r["Request Joinkey"];
            if (jk && k) (jobsBy[k] = jobsBy[k] || new Set()).add(jk); });
        } else if (S.dim === "Company") {
          jobs.forEach(r => { const k = r.Company || "—"; const jk = r["Request Joinkey"];
            if (jk) (jobsBy[k] = jobsBy[k] || new Set()).add(jk); });
        }
        const med = a => { if (!a.length) return null; const x = a.slice().sort((p, q) => p - q); return x[Math.floor(x.length / 2)]; };
        return Object.values(o).map(a => ({ ...a, jobs: (jobsBy[a.k] || new Set()).size, medDays: med(a.days) }))
          .sort((a, b) => b.n - a.n);
      })();
      const pivMax = Math.max(1, ...pivot.map(a => a.n));
      const pivHasRate = (S.dim === "Job type" || S.dim === "Company") && !narrowed;

      /* ---------- the trend, drawn ----------
         Monthly claim count as faint bars, the rate as the line on top. One picture answers
         "is this getting better or worse" -- which the old month list, sorted by month with a
         bar for the count only, could not. */
      function trendSvg() {
        const ms = months;
        if (ms.length < 2) return '<div class="rs-hint">at least two months are needed to draw a trend</div>';
        const W = 1000, H = 190, L = 34, R = 34, T = 14, B = 26;
        const iw = W - L - R, ih = H - T - B;
        const cnt = ms.map(m => byM[m]);
        const rate = ms.map(m => { const j = (jobsByM[m] || new Set()).size; return j ? byM[m] / j * 100 : null; });
        const maxC = Math.max(1, ...cnt);
        const rv = rate.filter(v => v != null);
        const maxR = Math.max(1, ...(rv.length ? rv : [1])) * 1.18;
        const x = i => L + (ms.length === 1 ? iw / 2 : i * iw / (ms.length - 1));
        const bw = Math.max(5, Math.min(30, iw / ms.length * 0.5));
        const yC = v => T + ih - (v / maxC) * ih;
        const yR = v => T + ih - (v / maxR) * ih;
        const pts = ms.map((m, i) => (rate[i] == null ? null : [x(i), yR(rate[i])])).filter(Boolean);
        const line = pts.map((pt, i) => (i ? "L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" ");
        const area = pts.length > 1
          ? line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (T + ih) + " L" + pts[0][0].toFixed(1) + " " + (T + ih) + " Z"
          : "";
        // is the last month only partly covered by this window?
        const lastM = ms[ms.length - 1];
        const monthEnd = (() => { const [y, mm] = lastM.split("-").map(Number);
          return iso(new Date(Date.UTC(y, mm, 0))); })();
        const partial = !!(to && lastM && to < monthEnd);
        const solid = partial ? pts.slice(0, -1) : pts;
        const solidLine = solid.map((pt, i) => (i ? "L" : "M") + pt[0].toFixed(1) + " " + pt[1].toFixed(1)).join(" ");
        const tailLine = partial && pts.length > 1
          ? "M" + pts[pts.length - 2][0].toFixed(1) + " " + pts[pts.length - 2][1].toFixed(1)
            + " L" + pts[pts.length - 1][0].toFixed(1) + " " + pts[pts.length - 1][1].toFixed(1)
          : "";
        const solidArea = solid.length > 1
          ? solidLine + " L" + solid[solid.length - 1][0].toFixed(1) + " " + (T + ih)
            + " L" + solid[0][0].toFixed(1) + " " + (T + ih) + " Z"
          : "";
        const every = ms.length > 14 ? Math.ceil(ms.length / 12) : 1;
        return `<svg class="cln-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img"
            aria-label="claims per month and the share of jobs that drew a claim">
          <line class="ax" x1="${L}" y1="${T + ih}" x2="${W - R}" y2="${T + ih}"></line>
          ${ms.map((m, i) => `<rect class="bar" x="${(x(i) - bw / 2).toFixed(1)}" y="${yC(cnt[i]).toFixed(1)}"
              width="${bw.toFixed(1)}" height="${(T + ih - yC(cnt[i])).toFixed(1)}" rx="2"></rect>`).join("")}
          ${solidArea && !narrowed ? `<path class="ar" d="${solidArea}"></path>` : ""}
          ${!narrowed && solidLine ? `<path class="ln" d="${solidLine}"></path>` : ""}
          ${!narrowed && tailLine ? `<path class="ln part" d="${tailLine}"></path>` : ""}
          ${!narrowed ? ms.map((m, i) => (rate[i] == null ? "" :
              `<circle class="dot${partial && i === ms.length - 1 ? " part" : ""}"
                 cx="${x(i).toFixed(1)}" cy="${yR(rate[i]).toFixed(1)}" r="3"></circle>`)).join("") : ""}
          ${ms.map((m, i) => (i % every ? "" : `<text class="tk" x="${x(i).toFixed(1)}" y="${H - 8}"
              text-anchor="middle">${esc(m.slice(2))}</text>`)).join("")}
          <text class="vl" x="${L - 6}" y="${T + 8}" text-anchor="end">${fmtN(maxC)}</text>
          ${!narrowed ? `<text class="vl" x="${W - R + 6}" y="${T + 8}">${rPct(maxR)}</text>` : ""}
        </svg>`
        + (partial ? `<div class="cln-say" style="margin:2px 0 0">${esc(lastM)} is only counted to
            ${esc(to)}, so its share sits on a few days of jobs and swings — it is drawn dashed and
            should not be read as a trend.</div>` : "");
      }

      const dChip = (w, label) => {
        if (!w || nowRate == null) return "";
        const diff = nowRate - w.rate;
        const pctMove = w.rate ? diff / w.rate * 100 : null;
        // fewer claims per job is GOOD, so a fall paints positive
        const cls = Math.abs(diff) < 0.05 ? "" : (diff < 0 ? "good" : "bad");
        const arrow = Math.abs(diff) < 0.05 ? "=" : (diff < 0 ? "\u25be" : "\u25b4");
        return `<span class="cln-d ${cls}" title="${esc(label)}: ${rPct(w.rate)} of jobs — ${fmtN(w.claims)} claims over ${fmtN(w.jobs)} jobs">
          ${arrow} ${pctMove == null ? r1(Math.abs(diff)) : Math.abs(Math.round(pctMove)) + "%"}
          <small>vs ${esc(label)}</small></span>`;
      };

      host.innerHTML = `
        <div class="rs-page-head"><h1>Claims Analysis</h1>
          <p style="max-width:none">Every claim joined to the job it came from, read as the <b>share of jobs that drew a
          claim</b> rather than a count. The
          date range, job type, salesperson and foreman all come from the closing, so they narrow
          the jobs as well as the claims and the rate stays a real rate; responsibility, extra
          service and the search box exist only on the claim, so under those the rate is withheld
          rather than guessed. Click a salesperson or a foreman to see the claims behind their
          number; <b>Open&nbsp;&#8599;</b> opens the claim on the Monday board.</p>
          <button class="rs-btn pri cln-pdf" id="clnPdf" title="a print sheet of this dashboard, to save as a PDF">Download PDF</button></div>
        <div class="cln-bar" id="clnBar"></div>

        <div class="panel cln-hero">
          <div>
            <div class="lbl">Share of jobs that drew a claim</div>
            <div class="cln-big">${narrowed ? "&mdash;" : (nowRate == null ? "&mdash;" : nowRate.toFixed(1))}
              ${narrowed || nowRate == null ? "" : '<span class="u">% of jobs</span>'}</div>
            <div class="cln-deltas">${narrowed ? "" : dChip(prevWin, "previous period") + dChip(yoyWin, "a year earlier")}</div>
            <div class="cln-note">${narrowed
              ? `<b>${fmtN(n)}</b> claims match, but a rate is not shown: ${esc(whyNarrowed)} narrows the
                 claims and there is no such field on a closing, so the ${fmtN(nJobs)} jobs cannot be
                 narrowed with them. Clear it to see the rate.`
              : `<b>${fmtN(n)}</b> claims on <b>${fmtN(nJobs)}</b> jobs done in this window.
                 ${prevWin || yoyWin ? "Direction is measured over the same length of time with the same filters." : ""}`}</div>
          </div>
          <div>
            ${trendSvg()}
            <div class="cln-mini">
              <div><div class="k">Open now</div><div class="n ${open ? "warn" : ""}">${fmtN(open)}</div>
                <div class="h">not yet Done, Refunded or closed</div></div>
              <div><div class="k">Refunded</div><div class="n">${fmtN(refunded.length)}</div>
                <div class="h">${money0(refund$)} back${narrowed || !nJobs ? "" : ` &middot; <b>${rPct(per100(refunded.length, nJobs))}</b> of jobs`}</div></div>
              <div><div class="k">Went public</div><div class="n ${pub ? "bad" : ""}">${fmtN(pub)}</div>
                <div class="h">also has a negative review on file</div></div>
              <div><div class="k">No reason chosen</div><div class="n">${fmtN(unclassified)}</div>
                <div class="h">${n ? Math.round(unclassified / n * 100) : 0}% of claims${nKW ? ` &middot; ${fmtN(kwFilled)} read from their thread` : ""}</div></div>
              ${nKW ? `<div><div class="k">Disputes</div><div class="n ${critical ? "bad" : ""}">${fmtN(critical)}</div>
                <div class="h">mention a dispute or legal action${high ? ` &middot; ${fmtN(high)} a review or large refund` : ""}</div></div>` : ""}
            </div>
          </div>
        </div>

        <div class="panel" id="clnPnlSources" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">Where they come from</div>
            <div class="rs-spacer"></div>
            <div class="cln-dim-seg" id="clnDim">${DIMS.map(([d]) =>
              `<button data-dim="${esc(d)}" class="${S.dim === d ? "on" : ""}">${esc(d)}</button>`).join("")}</div>
          </div>
          <div class="cln-say">One table, grouped however you need it. ${pivHasRate
            ? "This grouping exists on the closing too, so it carries a real rate."
            : "A rate needs the same grouping on a closing; only job type and company have one, so the other groupings show shares."}</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>${esc(S.dim)}</th><th class="num">Claims</th><th>Share</th>
              ${pivHasRate ? '<th class="num">Jobs</th><th class="num">% of jobs</th>' : ""}
              <th class="num">Open</th><th class="num">Refunded</th><th class="num">Refund $</th>
              <th class="num">Went public</th><th class="num">Median days after</th></tr></thead>
            <tbody>${pivot.map(a => `<tr>
              <td class="strong">${esc(a.k)}</td>
              <td class="num"><b>${fmtN(a.n)}</b></td>
              <td><div class="cln-wbar"><i style="width:${Math.max(3, a.n / pivMax * 100)}%"></i></div>
                <span class="cln-small">${n ? Math.round(a.n / n * 100) : 0}%</span></td>
              ${pivHasRate ? `<td class="num">${a.jobs ? fmtN(a.jobs) : '<span class="cln-small">&mdash;</span>'}</td>
                <td class="num">${(a.jobs && a.k !== "No closing" && a.k !== "—")
                  ? "<b>" + rPct(per100(a.n, a.jobs)) + "</b>"
                  : '<span class="cln-small" title="these claims never matched a closing, so there is no job count to divide by">&mdash;</span>'}</td>` : ""}
              <td class="num">${a.open || '<span class="cln-small">&mdash;</span>'}</td>
              <td class="num">${a.refunded || '<span class="cln-small">&mdash;</span>'}</td>
              <td class="num">${a.refund ? money0(a.refund) : '<span class="cln-small">&mdash;</span>'}</td>
              <td class="num">${a.pub || '<span class="cln-small">&mdash;</span>'}</td>
              <td class="num">${a.medDays == null ? '<span class="cln-small">&mdash;</span>' : fmtN(a.medDays)}</td>
            </tr>`).join("") || '<tr><td colspan="10"><span class="rs-hint">no claims match these filters</span></td></tr>'}
            </tbody></table></div>
          ${nKW ? `<details style="margin-top:10px"><summary class="rs-hint" style="cursor:pointer">
              How the words read against the team&rsquo;s own Reason &mdash; agreement on
              ${fmtN(compared.length)} claims where both exist${compared.length ? ", " + Math.round(agree / compared.length * 100) + "% overall" : ""}</summary>
            <div style="margin-top:10px">${agreeByFam.map(([f, a]) => `<div class="cln-share ${a.ok / a.n >= 0.7 ? "brand" : (a.ok / a.n >= 0.4 ? "" : "neg")}">
              <span class="n">${esc(f)}</span>
              <span class="t"><i style="width:${Math.max(2, a.ok / a.n * 100)}%"></i></span>
              <span class="v"><b>${Math.round(a.ok / a.n * 100)}%</b> &middot; ${fmtN(a.ok)} of ${fmtN(a.n)}</span></div>`).join("") || '<div class="rs-hint">nothing to compare yet</div>'}
              ${RULES.length ? `<div class="cln-say" style="margin:8px 0 0">${RULES.filter(r => r.Kind === "family").length} words define the families (${RULES.filter(r => r.Kind === "flag").length} more for the signals); English, Georgian and Latin-Georgian alike.</div>` : ""}
            </div></details>` : ""}
        </div>

        <div class="panel" id="clnPnlSp" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">Salespeople</div></div>
          <div class="cln-say">${hasCredit ? `A job sold by two people is credited to both in the share the closing sheet paid them, so a 50/50 job gives each half the job <b>and</b> half the claim &mdash; the percentage stays a percentage of their own work, and the credited claims still add up to the ${fmtN(n)} above &mdash; the total row at the foot
            states it, because the column prints one decimal and adding those by hand drifts. ` : ""}jobs sold in the window (the closing's salesperson), the claims on them, and — where the lead's quote and the contract's real CF exist — how far the bill and the volume ran past the estimate on the claimed jobs. Fewer than ${MIN_JOBS} credited jobs reads "small" and sorts below the rest &mdash; a rate on a handful of jobs is noise, so it is shown but never ranked first. <b>Click any row</b> to see the claims behind its number and open each on the board.
            <br><b>This is not the same number as Sales Team Command's own claim rate.</b> That page counts a claim against the rep who booked the lead and divides by closed leads; this one counts it against the salesperson on the closing and divides by jobs done. Two honest definitions — they will not tie out, and neither has been declared the right one.</div>
          ${perTable(sales, "Salesperson", spExtra, "clnSpBody", S.openSp, S.allSp)}
        </div>

        <div class="panel" id="clnPnlFm" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">Foremen</div></div>
          <div class="cln-say">jobs run in the window (the closing's foreman) and the claims on them, split by family. A damage claim is what the customer said, not what an inspection found — read the thread before it counts against anyone. <b>Click any row</b> to see the claims behind its number and open each on the board.</div>
          ${perTable(foremen, "Foreman", fmExtra, "clnFmBody", S.openFm, S.allFm)}
        </div>

        <div class="panel" id="clnPnlCases" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">The claims</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(sorted.length)}</span>
            <button class="rs-btn" id="clnDl">Download CSV</button></div>
          <div class="cln-say">Click a claim to read its whole Monday thread here, or <b>Open&nbsp;&#8599;</b> to go straight to it on the board.</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Created</th><th>Customer</th><th>Family · ${nKW ? "reason or words" : "reason"}</th>${nKW ? "<th>Signals</th>" : ""}<th>Status</th>
              <th>Salesperson</th><th>Foreman</th><th class="num">Bill</th><th class="num">vs quote</th>
              <th class="num">Refund</th><th class="num">Msgs</th><th>Monday</th></tr></thead>
            <tbody class="cln-list-body">${pageRows.map(r => `<tr class="cln-row" data-item="${esc(r["Monday Item Id"])}">
              <td class="nowrap">${esc(String(r["Created Date"] || "").slice(0, 10))}</td>
              <td class="strong">${esc(r.Customer || "—")}</td>
              ${(() => { const k = kwOf(r), o = ovOf(r); const fam = famOf(r);
                const why = o ? "corrected by " + (o["Entered By"] || "") : (r.Reason ? r.Reason : (k && k["Keyword Family"] !== "No keywords" ? "words: " + String(k["Matched Keywords"] || "").split(", ").slice(0, 3).join(", ") : ""));
                const sig = k ? [["Legal", "bad"], ["Dispute", "bad"], ["Review", "warn"], ["Refund", ""], ["Discount", ""], ["Photos", "mute"]]
                  .filter(([f]) => num(k["Mentions " + f]) > 0).map(([f, c]) => `<span class="rs-pill ${c}">${f.toLowerCase()}</span>`).join(" ") : "";
                return `<td>${o ? '<span class="rs-pill ok">✓</span> ' : ""}<b>${esc(fam || "—")}</b>${why ? ` <span class="cln-small">· ${esc(why)}</span>` : ""}</td>${nKW ? `<td>${sig || '<span class="cln-small">—</span>'}</td>` : ""}`; })()}
              <td>${num(r["Is Open"]) === 1 ? '<span class="rs-pill warn">' + esc(r.Status || "open") + "</span>" : esc(r.Status || "—")}</td>
              <td class="muted">${esc(r["Sales Person"] || r["Board Sale"] || "—")}</td>
              <td class="muted">${esc(r.Foreman || "—")}</td>
              <td class="num">${num(r["Total Bill"]) ? money0(num(r["Total Bill"])) : '<span class="cln-small">—</span>'}</td>
              <td class="num">${r["Price Increase Pct"] == null ? '<span class="cln-small">—</span>' : (num(r["Price Increase Pct"]) > 0 ? "+" : "") + pct1(num(r["Price Increase Pct"]))}</td>
              <td class="num">${num(r["Refund $"]) ? money0(num(r["Refund $"])) : '<span class="cln-small">—</span>'}</td>
              <td class="num">${fmtN(num(r.Messages) || 0)}</td>
              <td>${mondayCell(r["Monday Url"])}</td></tr>`).join("")}
            </tbody></table></div>
          <div class="cln-pager">
            <span>page ${S.page + 1} of ${pages}</span>
            <button class="rs-btn" data-pg="prev" ${S.page <= 0 ? "disabled" : ""}>‹ Prev</button>
            <button class="rs-btn" data-pg="next" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button>
          </div>
        </div>`;

      mountBar(claims, jobs);

      const pdfBtn = host.querySelector("#clnPdf");
      if (pdfBtn) pdfBtn.onclick = () => RSC.printView({
        host,
        title: "Claims Analysis",
        subtitle: printWindowLabel(),
        note: "Every per-person number is the share of that person's own jobs in this window "
            + "that drew a claim \u2014 never a count. Where a filter exists only on the claim, "
            + "the rate is withheld rather than guessed.",
        drop: [".cln-bar", ".cln-pdf", ".cln-drawer"],
        // ONE THEME PER SHEET, in the order somebody reads the argument: how often it
        // happens, then what it is about, then who, then the cases themselves.
        pages: [
          { title: "The rate, and where it is going", sel: ".cln-hero" },
          { title: "What the claims are about", sel: "#clnPnlSources" },
          { title: "By salesperson and by foreman", sel: "#clnPnlSp, #clnPnlFm" },
          { title: "The claims themselves", sel: "#clnPnlCases" },
        ],
        restTitle: "Everything else",
      });

      // the pivot's dimension picker
      const dimSeg = host.querySelector("#clnDim");
      if (dimSeg) dimSeg.addEventListener("click", ev => {
        const b = ev.target.closest("button[data-dim]"); if (!b) return;
        S.dim = b.getAttribute("data-dim"); paint();
      });
      host.querySelectorAll("[data-pg]").forEach(el => {
        el.onclick = () => { S.page += el.dataset.pg === "next" ? 1 : -1; paint(); };
      });
      // ONE DELEGATED HANDLER PER TBODY, never per row, so replacing a tbody's innerHTML
      // when a person opens cannot lose it. A link inside a clickable row must not fire the
      // row -- otherwise "Open in Monday" would also open the in-portal drawer behind it.
      const byId = id => claims.find(r => String(r["Monday Item Id"]) === id);
      const wireRows = root => {
        if (!root || root._clnWired) return;
        root._clnWired = 1;
        root.addEventListener("click", ev => {
          if (ev.target.closest("a")) return;
          const tr = ev.target.closest(".cln-row"); if (!tr) return;
          openDrawer(tr.dataset.item, byId(tr.dataset.item));
        });
      };
      wireRows(host.querySelector(".cln-list-body"));

      const wirePeople = (bodyId, rows, extra, key, allKey) => {
        const tb = host.querySelector("#" + bodyId);
        if (!tb) return;
        const redraw = () => { tb.innerHTML = bodyHtml(rows, extra, S[key], S[allKey]); };
        tb.addEventListener("click", ev => {
          const more = ev.target.closest("[data-showall]");
          if (more) { ev.preventDefault(); S[allKey] = 1; redraw(); return; }
          if (ev.target.closest("a")) return;
          const sub = ev.target.closest(".cln-row");
          if (sub) { openDrawer(sub.dataset.item, byId(sub.dataset.item)); return; }
          const tr = ev.target.closest(".cln-open"); if (!tr) return;
          S[key] = S[key] === tr.dataset.person ? "" : tr.dataset.person;
          redraw();
        });
      };
      wirePeople("clnSpBody", sales, spExtra, "openSp", "allSp");
      wirePeople("clnFmBody", foremen, fmExtra, "openFm", "allFm");

      const dl = host.querySelector("#clnDl");
      if (dl) dl.onclick = () => dlCsv(sorted);
    }

    /* ---------- controls ---------- */
    /* ---------- the filter bar ----------
       "add proper for dates as we have in other pages, have SP, Foreman and other filters."
       RSC.dateRange is that component -- the same preset ladder plus two date inputs every
       other page uses -- and RSC.localSelect is the house picker. The value lists are derived
       from the data in the window so a picker never offers a name with nothing behind it.
       The order is deliberate: the four that keep a rate honest first, then the three that
       narrow the claims alone. */
    function mountBar(claims, jobs) {
      const bar = host.querySelector("#clnBar");
      if (!bar) return;
      const fld = (label, el) => { const w = document.createElement("div"); w.className = "rs-fld";
        w.innerHTML = `<span>${label}</span>`; w.appendChild(el); return w; };
      const seg = (opts, cur, set) => {
        const d = document.createElement("div"); d.className = "rs-seg";
        opts.forEach(([v, label]) => {
          const b = document.createElement("button"); b.textContent = label;
          if (cur === v) b.className = "on";
          b.onclick = () => { set(v); S.page = 0; S.openSp = ""; S.openFm = ""; paint(); };
          d.appendChild(b);
        });
        return d;
      };
      const holder = () => document.createElement("div");

      // 1. dates -- the house component
      const dh = holder();
      bar.appendChild(fld("Dates", dh));
      if (window.RSC && RSC.dateRange) {
        RSC.dateRange(dh, {
          get: () => ({ from: S.from, to: S.to }),
          set: (f, t) => { S.from = f; S.to = t; },
          onChange: () => { S.page = 0; S.openSp = ""; S.openFm = ""; paint(); },
        });
      } else {
        dh.appendChild(seg([[back(3), "3m"], [back(6), "6m"], [back(12), "12m"]], S.from,
          v => { S.from = v; S.to = iso(today); }));
      }

      // 2. job type -- FROM THE CLOSING, and storage is not one of the options
      bar.appendChild(fld("Job type", seg([["", "All"], ["Local", "Local"],
        ["Long distance", "Long distance"]], S.jobType, v => { S.jobType = v; })));

      // 3-4. the people. Names come from the CLOSINGS in the window, not from the claims, so
      // the list is every person who could have a rate -- including those with no claim at all.
      const names = (rows, key) => {
        const o = {};
        rows.forEach(r => { const v = String(r[key] || "").trim(); if (v) o[v] = 1; });
        return Object.keys(o).sort();
      };
      const spH = holder(); bar.appendChild(spH);
      if (window.RSC && RSC.localSelect) {
        RSC.localSelect(spH, { label: "Salesperson",
          values: hasCredit ? CREDITED_NAMES : names(jobs, "Sales Person"),
          value: S.sp, allLabel: "All",
          onChange: v => { S.sp = v; S.page = 0; S.openSp = ""; paint(); } });
      }
      const fmH = holder(); bar.appendChild(fmH);
      if (window.RSC && RSC.localSelect) {
        RSC.localSelect(fmH, { label: "Foreman", values: names(jobs, "Foreman"),
          value: S.fm, allLabel: "All",
          onChange: v => { S.fm = v; S.page = 0; S.openFm = ""; paint(); } });
      }

      // 5. responsibility -- his chosen feature. Claims-only, so it withholds the rate.
      const rsH = holder(); bar.appendChild(rsH);
      if (window.RSC && RSC.localSelect) {
        RSC.localSelect(rsH, { label: "Responsibility",
          values: names(claimsAll.filter(r => r["Responsibility Family"]), "Responsibility Family"),
          value: S.resp, allLabel: "All",
          onChange: v => { S.resp = v; S.page = 0; paint(); } });
      }

      // 6. the extra services the customer took -- NOT job types
      const exW = document.createElement("div");
      exW.className = "rs-fld";
      exW.innerHTML = '<span>Extra service</span>';
      const exRow = document.createElement("div");
      exRow.style.cssText = "display:flex;gap:6px;flex-wrap:wrap";
      EXTRAS.forEach(([key, label]) => {
        const b = document.createElement("button");
        b.className = "cln-chip" + (S.extra === key ? " on" : "");
        b.textContent = label;
        b.onclick = () => { S.extra = S.extra === key ? "" : key; S.page = 0; paint(); };
        exRow.appendChild(b);
      });
      exW.appendChild(exRow);
      bar.appendChild(exW);

      // 7. free text
      const q = document.createElement("input");
      q.className = "cln-in"; q.placeholder = "find a customer, reason, request #…";
      q.value = S.q; q.style.flex = "0 1 240px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S.page = 0; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);

      if (S.from !== back(6) || S.to !== iso(today) || S.jobType || S.sp || S.fm || S.resp || S.extra || S.q) {
        const clear = document.createElement("button");
        clear.className = "rs-btn"; clear.textContent = "Clear";
        clear.style.marginBottom = "1px";
        clear.onclick = () => {
          S.from = back(6); S.to = iso(today); S.jobType = ""; S.sp = ""; S.fm = "";
          S.resp = ""; S.extra = ""; S.q = ""; S.page = 0; S.openSp = ""; S.openFm = "";
          paint();
        };
        bar.appendChild(clear);
      }
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    /* ---------- the drawer: one claim's thread ---------- */
    async function openDrawer(itemId, row) {
      closeDrawer();
      const dim = document.createElement("div"); dim.className = "cln-dim"; dim.onclick = closeDrawer;
      const dr = document.createElement("div"); dr.className = "cln-drawer";
      const url = row && row["Monday Url"];
      dr.innerHTML = `<div class="cln-dh"><div><h3>${esc(row && row.Customer ? row.Customer : "Claim")}</h3>
          <div class="sub">${row ? esc([row["Request No"] ? "Request " + row["Request No"] : "",
            row["Reason Family"], row.Reason, row.Status].filter(Boolean).join(" · ")) : ""}</div></div>
          ${/^https:\/\//i.test(String(url || "")) ? `<a class="rs-btn" href="${esc(url)}" target="_blank" rel="noopener">Open in Monday &#8599;</a>` : ""}
          <button class="rs-btn x" id="clnX">Close</button></div>
        <div class="cln-db"><div class="rs-loading">Reading the thread…</div></div>`;
      document.body.appendChild(dim); document.body.appendChild(dr);
      document.addEventListener("keydown", onEsc);
      dr.querySelector("#clnX").onclick = closeDrawer;
      const body = dr.querySelector(".cln-db");
      try {
        const res = await fetch(ZTZ.API + "/api/_claimthread?item=" + encodeURIComponent(itemId),
          { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
        const j = await res.json();
        if (!res.ok || j.error) { body.innerHTML = `<div class="rs-hint">${esc(j.error || "could not load")}</div>`; return; }
        const it = j.item || {};
        const when = s => String(s || "").slice(0, 16).replace("T", " ");
        const msg = (m, reply) => `<div class="cln-msg${reply ? " reply" : ""}">
            <div class="who"><b>${esc(m["Creator Name"] || "—")}</b><span>${esc(when(m["Created At"]))}</span>
              ${m["Edited At"] && m["Edited At"] !== m["Created At"] ? "<span>edited</span>" : ""}</div>
            <div class="txt">${esc(m["Text Body"] || "")}</div>
            ${(m.files || []).length ? `<div class="att">${(m.files || []).map(f => esc((f.Name || "") + " " + (f.Extension || "") + (f["Size Bytes"] ? " · " + Math.round(f["Size Bytes"] / 1024) + " KB" : ""))).join(" · ")}</div>` : ""}
          </div>` + (m.replies || []).map(r => msg(r, true)).join("");
        body.innerHTML = `
          <div class="cln-cells">
            <div class="cln-cell"><div class="l">Group</div><div class="v">${esc(it["Group Title"] || "—")}</div></div>
            <div class="cln-cell"><div class="l">Filed</div><div class="v">${esc(when(it["Created At"]))}</div></div>
            <div class="cln-cell"><div class="l">Last change</div><div class="v">${esc(when(it["Item Updated At"]))}</div></div>
            ${(j.cells || []).map(c => `<div class="cln-cell"><div class="l">${esc(c["Column Title"])}</div>
              <div class="v">${esc(c.Label || c.Date || c.Text || "—")}</div></div>`).join("")}
            ${row && row["Total Bill"] ? `<div class="cln-cell"><div class="l">Bill / quote</div><div class="v">${money0(num(row["Total Bill"]))}${row.Quote ? " / " + money0(num(row.Quote)) : ""}</div></div>` : ""}
            ${row && row["Refund $"] ? `<div class="cln-cell"><div class="l">Refund</div><div class="v">${money0(num(row["Refund $"]))}</div></div>` : ""}
          </div>
          ${(j.files || []).length ? `<div class="cln-eyebrow">Files on the claim</div><div class="rs-hint">${(j.files || []).map(f => esc((f.Name || "") + " " + (f.Extension || ""))).join(" · ")}</div>` : ""}
          ${(() => { const k = row ? kwOf(row) : null, o = row ? ovOf(row) : null; if (!k && !o) return "";
            const hits = k ? FAM_LIST.filter(f => f !== "Other").map(f => [f, num(k["Hits " + f]) || 0]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]) : [];
            const flags = k ? ["Refund", "Discount", "Review", "Dispute", "Legal", "Photos", "Claim Form"].filter(f => num(k["Mentions " + f]) > 0) : [];
            return `<div class="cln-eyebrow">What the words say${k ? " · " + esc(k.Language || "") : ""}</div>
              ${o ? `<div class="rs-hint" style="margin-bottom:8px">Corrected by ${esc(o["Entered By"] || "")} on ${esc(String(o["Entered At"] || "").slice(0, 10))}: ${[o.Family, o.Severity].filter(Boolean).map(esc).join(" · ")}${o.Comment ? " — " + esc(o.Comment) : ""}</div>` : ""}
              ${k ? `<div class="cln-cells">
                <div class="cln-cell"><div class="l">Keyword family</div><div class="v"><b>${esc(k["Keyword Family"])}</b> <span class="cln-small">${esc(k["Keyword Confidence"] || "")}${k["Keyword Family 2"] ? " · then " + esc(k["Keyword Family 2"]) : ""}</span></div></div>
                <div class="cln-cell"><div class="l">Team's reason</div><div class="v">${esc(row.Reason || "—")}${k.Agreement == null ? "" : (num(k.Agreement) === 1 ? ' <span class="rs-pill ok">agrees</span>' : ' <span class="rs-pill warn">differs</span>')}</div></div>
                <div class="cln-cell"><div class="l">Severity signal</div><div class="v">${esc(k["Severity Signal"] || "—")}</div></div>
                <div class="cln-cell"><div class="l">Signals</div><div class="v">${flags.map(esc).join(", ") || "—"}</div></div>
              </div>
              <div class="cln-msg"><div class="txt"><b>Hits by family.</b> ${hits.map(([f, v]) => esc(f) + " " + v).join(" · ") || "none"}</div>
                <div class="txt" style="margin-top:6px"><b>Words that fired.</b> ${esc(k["Matched Keywords"] || "—")}</div></div>` : ""}
              <details style="margin-top:10px"><summary class="rs-hint" style="cursor:pointer">Correct this family</summary>
                <div class="cln-cells" style="margin-top:8px">
                  <div class="cln-cell"><div class="l">Family</div><select class="cln-in" id="ovFam"><option value="">— keep —</option>${FAM_LIST.map(f => `<option>${f}</option>`).join("")}</select></div>
                  <div class="cln-cell"><div class="l">Severity</div><select class="cln-in" id="ovSev"><option value="">— keep —</option>${["Low", "Medium", "High", "Critical"].map(f => `<option>${f}</option>`).join("")}</select></div>
                </div>
                <input class="cln-in" id="ovNote" placeholder="why (optional)" style="width:100%;margin-top:6px">
                <div style="margin-top:8px"><button class="rs-btn pri" id="ovSave">Save correction</button> <span class="cln-small" id="ovMsg"></span></div>
              </details>`; })()}
          <div class="cln-eyebrow">Thread · ${fmtN((j.thread || []).length)} updates</div>
          ${(j.thread || []).map(m => msg(m, false)).join("") || '<div class="rs-hint">no updates on this claim</div>'}
          ${(!url && it.Url) ? `<div class="rs-hint" style="margin-top:14px"><a href="${esc(it.Url)}" target="_blank" rel="noopener">Open in Monday &#8599;</a></div>` : ""}`;
        const save = body.querySelector("#ovSave");
        if (save) save.onclick = async () => {
          const g = id => (body.querySelector("#" + id) || {}).value || "";
          const payload = { item: itemId, family: g("ovFam"), severity: g("ovSev"), comment: g("ovNote") };
          const msg = body.querySelector("#ovMsg"); msg.textContent = "saving…";
          try {
            const res = await fetch(ZTZ.API + "/api/_claimoverride", { method: "POST",
              headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
              body: JSON.stringify(payload) });
            const j = await res.json();
            if (!res.ok || j.error) { msg.textContent = j.error || "could not save"; return; }
            OV[String(itemId)] = { "Monday Item Id": itemId, Family: payload.family || null, Severity: payload.severity || null,
              Comment: payload.comment || null, "Entered By": j.by || "", "Entered At": new Date().toISOString() };
            msg.textContent = "saved"; paint();
          } catch (e) { msg.textContent = "could not save"; }
        };
      } catch (e) {
        body.innerHTML = `<div class="rs-hint">could not load the thread</div>`;
      }
    }
    // The drawer lives on document.body while the router only wipes #content, so without
    // this an open claim thread survives a jump to another report.
    function onEsc(ev) { if (ev.key === "Escape") closeDrawer(); }
    function closeDrawer() {
      document.querySelectorAll(".cln-dim,.cln-drawer").forEach(el => el.remove());
      document.removeEventListener("keydown", onEsc);
    }

    function dlCsv(rows) {
      const cols = ["Created Date", "Customer", "Request No", "Group", "Status", "Reason Family", "Reason",
        "Responsibility Family", "Responsibility", "Service Type", "Sales Person", "Foreman", "Job Date",
        "Total Bill", "Quote", "Price Increase Pct", "Estimated CF", "Real CF", "CF Variance Pct",
        "Days After Job", "Case Owner", "Refund $", "Negative Reviews", "Messages", "Files",
        "Monday Item Id", "Monday Url"];
      const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s;
        return '"' + s.replace(/"/g, '""') + '"'; };
      const lines = [cols.map(cell).join(",")].concat(rows.map(r => cols.map(c => cell(r[c])).join(",")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "Claims Analysis.csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    paint();
  },
});
