/* REVIEWS ▸ Claims Analysis — every claim with the job it belongs to, read as RATES.
 *
 * Built 2026-09-02 on the direct Monday feed (src/monday_sync.py -> fct_claims ->
 * mart_claims_analysis). Two rules from the design review that this page enforces:
 *   1. NEVER compare people on claim COUNTS. Every per-person number is claims per 100 of
 *      that person's jobs in the same window, and a person with fewer than MIN_JOBS jobs
 *      is shown as "small sample" instead of a rate that would mislead.
 *   2. The board's Reason / Responsibility are what an employee CHOSE (59% blank). They are
 *      shown as families so they can be counted, and labelled as the team's own
 *      classification; the AI root cause lands beside them when that stage ships.
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
             "Days After Job", "Days To Close"],
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
    const esc = RS.esc || (s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    const money0 = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const pct1 = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";
    const per100 = (c, j) => j ? (c / j * 100) : null;
    const r1 = v => (v == null || isNaN(v)) ? "—" : v.toFixed(1);
    const MIN_JOBS = 30;

    if (!document.getElementById("cln-style")) {
      const st = document.createElement("style");
      st.id = "cln-style";
      st.textContent = [
        // only what the kit cannot say; page-prefixed so it can never leak
        ".cln-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        ".cln-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;"
          + "margin-bottom:1px}",
        ".cln-in:focus{border-color:var(--brand)}",
        // the ledger (the CL page's rule: groups with sentences, never a wall of tiles)
        ".cln-led{display:flex;flex-wrap:wrap;gap:0;padding:18px 20px}",
        ".cln-led-g{flex:1 1 170px;min-width:0;padding:0 18px 0 0}",
        ".cln-led-g + .cln-led-g{padding-left:18px;border-left:1px solid var(--line-2)}",
        ".cln-led-g>.l{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}",
        ".cln-led-g>.v{font-size:clamp(24px,2vw,31px);font-weight:800;letter-spacing:-.8px;line-height:1.15;"
          + "margin-top:5px;font-variant-numeric:tabular-nums;color:var(--ink)}",
        ".cln-led-g>.v.warn{color:var(--warn)} .cln-led-g>.v.bad{color:var(--neg)} .cln-led-g>.v.pos{color:var(--brand)}",
        ".cln-led-g>.s{font-size:12px;color:var(--muted);line-height:1.55;margin-top:6px}",
        ".cln-led-g>.s b{color:var(--ink)}",
        ".cln-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px;margin-top:12px}",
        ".cln-grid>.panel{min-width:0}",
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
        ".cln-month{display:grid;grid-template-columns:64px minmax(60px,1fr) auto auto;gap:10px;align-items:center;"
          + "padding:5px 0;border-bottom:1px solid var(--line-2);font-size:12.5px}",
        ".cln-month:last-child{border-bottom:0}",
        ".cln-month .t{height:12px;background:var(--panel-2);border-radius:6px;overflow:hidden}",
        ".cln-month .t i{display:block;height:100%;background:var(--warn);border-radius:6px}",
        ".cln-month .v{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);white-space:nowrap}",
        ".cln-small{color:var(--faint);font-size:11.5px;white-space:nowrap}",
        ".cln-row{cursor:pointer} .cln-row:hover td{background:var(--panel-2)}",
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

    const [claimsAll, closingAll] = await Promise.all([
      RS.load("claims_analysis"), RS.load("closing")]);
    const closing = (closingAll || []).filter(r => r["Record Source"] === "closing");
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

    /* ---------- state ---------- */
    const S = { period: "6m", svc: "", q: "", page: 0, pageSize: 25 };
    let qTimer = null;
    const today = new Date();
    const iso = d => d.toISOString().slice(0, 10);
    function window_() {
      const t = new Date(today);
      if (S.period === "3m") { t.setMonth(t.getMonth() - 3); return [iso(t), null]; }
      if (S.period === "6m") { t.setMonth(t.getMonth() - 6); return [iso(t), null]; }
      if (S.period === "12m") { t.setMonth(t.getMonth() - 12); return [iso(t), null]; }
      if (S.period === "ytd") return [today.getFullYear() + "-01-01", null];
      return [null, null];
    }
    const svcFamily = s => {
      const v = String(s || "").toLowerCase();
      if (!v) return "";
      if (v.startsWith("ld") || v.startsWith("long")) return "Long distance";
      if (v.includes("storage")) return "Storage";
      if (v.startsWith("labor")) return "Labor";
      return "Local";
    };

    /* ---------- one paint ---------- */
    function paint() {
      const [from] = window_();
      const q = S.q.trim().toLowerCase();
      const claims = claimsAll.filter(r => {
        const d = String(r["Created Date"] || "").slice(0, 10);
        if (from && d < from) return false;
        if (S.svc && svcFamily(r["Service Type"]) !== S.svc) return false;
        if (q) {
          const hay = [r.Customer, r.Reason, r.Status, r["Sales Person"], r.Foreman, r["Request No"],
                       r["Service Type"]].join(" ").toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      // the denominator: every closing in the same window (service-type slice applies to
      // claims only -- the closing has no service type of its own)
      const jobs = closing.filter(r => !from || String(r.Date || "").slice(0, 10) >= from);
      const jobKeys = new Set(jobs.map(r => r["Request Joinkey"]).filter(Boolean));
      const nJobs = jobKeys.size;

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
      const maxM = Math.max(1, ...months.map(m => byM[m]));

      /* shares */
      const share = (key) => {
        const o = {};
        claims.forEach(r => { const k = r[key] || "—"; o[k] = (o[k] || 0) + 1; });
        return Object.entries(o).sort((a, b) => b[1] - a[1]);
      };
      const famShare = (() => { const o = {}; claims.forEach(r => { const k = famOf(r) || "—"; o[k] = (o[k] || 0) + 1; });
        return Object.entries(o).sort((a, b) => b[1] - a[1]); })();
      const respShare = share("Responsibility Family");
      // where both the team and the keywords spoke: how often they agree, per family
      const agreeByFam = (() => { const o = {}; compared.forEach(r => { const f = r["Reason Family"];
        const a = o[f] = o[f] || { n: 0, ok: 0 }; a.n++; if (num(kwOf(r).Agreement) === 1) a.ok++; });
        return Object.entries(o).sort((a, b) => b[1].n - a[1].n); })();
      const svcShare = share("Service Type").slice(0, 8);

      /* per person: jobs in window from the closing, claims from the mart */
      const perPerson = (jobField, claimField) => {
        const jobsBy = {};
        jobs.forEach(r => { const p = r[jobField]; const jk = r["Request Joinkey"];
          if (!p || !jk) return; (jobsBy[p] = jobsBy[p] || new Set()).add(jk); });
        const rows = {};
        claims.forEach(r => {
          const p = r[claimField]; if (!p) return;
          const o = rows[p] = rows[p] || { name: p, claims: 0, price: 0, damage: 0, missing: 0, timing: 0,
                                           refund: 0, pub: 0, inc: [], cfv: [] };
          o.claims++;
          const f = famOf(r);
          if (f === "Price") o.price++; if (f === "Damage") o.damage++;
          if (f === "Missing") o.missing++; if (f === "Timing") o.timing++;
          o.refund += num(r["Refund $"]) || 0;
          if ((num(r["Negative Reviews"]) || 0) > 0) o.pub++;
          const pi = num(r["Price Increase Pct"]); if (pi != null && !isNaN(pi)) o.inc.push(pi);
          const cv = num(r["CF Variance Pct"]); if (cv != null && !isNaN(cv)) o.cfv.push(cv);
        });
        Object.keys(jobsBy).forEach(p => { if (!rows[p]) rows[p] = { name: p, claims: 0, price: 0, damage: 0,
          missing: 0, timing: 0, refund: 0, pub: 0, inc: [], cfv: [] }; });
        const median = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y);
          return s[Math.floor(s.length / 2)]; };
        return Object.values(rows).map(o => ({ ...o, jobs: (jobsBy[o.name] || new Set()).size,
          medInc: median(o.inc), medCf: median(o.cfv) }))
          .filter(o => o.claims > 0 || o.jobs >= MIN_JOBS)
          .sort((a, b) => (per100(b.claims, b.jobs) || -1) - (per100(a.claims, a.jobs) || -1)
            || b.claims - a.claims);
      };
      const sales = perPerson("Sales Person", "Sales Person");
      const foremen = perPerson("Foreman", "Foreman");
      const rateCell = (c, j, cls) => j >= MIN_JOBS
        ? `<td class="num ${cls || ""}">${r1(per100(c, j))}</td>`
        : `<td class="num"><span class="cln-small" title="fewer than ${MIN_JOBS} jobs in this window">${j ? r1(per100(c, j)) + " · small" : "—"}</span></td>`;

      /* the list */
      const sorted = claims.slice().sort((a, b) =>
        String(b["Created Date"] || "").localeCompare(String(a["Created Date"] || "")));
      S.page = Math.min(S.page, Math.max(0, Math.ceil(sorted.length / S.pageSize) - 1));
      const pageRows = sorted.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);
      const pages = Math.max(1, Math.ceil(sorted.length / S.pageSize));

      const shareRows = (arr, cls) => arr.map(([k, v]) => `<div class="cln-share ${cls || ""}">
          <span class="n" title="${esc(k)}">${esc(k)}</span>
          <span class="t"><i style="width:${Math.max(2, v / Math.max(1, arr[0][1]) * 100)}%"></i></span>
          <span class="v"><b>${fmtN(v)}</b> · ${n ? Math.round(v / n * 100) : 0}%</span></div>`).join("");

      const perTable = (rows, who, extra) => `
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>${who}</th><th class="num">Jobs</th><th class="num">Claims</th>
              <th class="num">per 100 jobs</th>${extra.head}<th class="num">Refunds</th><th class="num">Went public</th></tr></thead>
            <tbody>${rows.slice(0, 25).map(o => `<tr>
              <td class="strong">${esc(o.name)}</td>
              <td class="num">${fmtN(o.jobs)}</td>
              <td class="num">${fmtN(o.claims)}</td>
              ${rateCell(o.claims, o.jobs, "strong")}
              ${extra.cells(o)}
              <td class="num">${o.refund ? money0(o.refund) : '<span class="cln-small">—</span>'}</td>
              <td class="num">${o.pub || '<span class="cln-small">—</span>'}</td></tr>`).join("")}
            </tbody></table></div>`;

      host.innerHTML = `
        <div class="rs-page-head"><h1>Claims Analysis</h1>
          <p>Every claim with the job it belongs to, read as rates — claims per 100 jobs by month, by salesperson and by foreman. The families come from the board's own Reason and Responsibility, which the team fills on about four claims in ten; the AI root cause will sit beside them.</p></div>
        <div class="cln-bar" id="clnBar"></div>

        <div class="panel cln-led">
          <div class="cln-led-g"><div class="l">Claims</div><div class="v">${fmtN(n)}</div>
            <div class="s"><b>${nJobs ? r1(per100(n, nJobs)) : "—"}</b> per 100 jobs · ${fmtN(nJobs)} jobs in the window</div></div>
          <div class="cln-led-g"><div class="l">Open now</div><div class="v ${open ? "warn" : ""}">${fmtN(open)}</div>
            <div class="s">not yet Done, Refunded or closed</div></div>
          <div class="cln-led-g"><div class="l">Refunded</div><div class="v">${fmtN(refunded.length)}</div>
            <div class="s"><b>${money0(refund$)}</b> given back · ${n ? Math.round(refunded.length / n * 100) : 0}% of claims</div></div>
          <div class="cln-led-g"><div class="l">Went public</div><div class="v ${pub ? "bad" : ""}">${fmtN(pub)}</div>
            <div class="s">claims that also have a negative review on file</div></div>
          ${nKW ? `<div class="cln-led-g"><div class="l">Read by keywords</div><div class="v pos">${fmtN(kwFilled)}</div>
            <div class="s">of the <b>${fmtN(unclassified)}</b> claims with no Reason on the board got a family from their thread · where both exist the keywords agree with the team on <b>${compared.length ? Math.round(agree / compared.length * 100) + "%" : "—"}</b></div></div>
          <div class="cln-led-g"><div class="l">Signals in the threads</div><div class="v ${critical ? "bad" : ""}">${fmtN(critical)}</div>
            <div class="s"><b>${fmtN(critical)}</b> mention a dispute or legal action · <b>${fmtN(high)}</b> a review or a large refund · refund mentioned on ${fmtN(flagCount("Refund"))}, discount on ${fmtN(flagCount("Discount"))}, photos on ${fmtN(flagCount("Photos"))}</div></div>`
          : `<div class="cln-led-g"><div class="l">No reason chosen</div><div class="v">${fmtN(unclassified)}</div>
            <div class="s">${n ? Math.round(unclassified / n * 100) : 0}% of claims carry no Reason on the board</div></div>`}
        </div>

        <div class="cln-grid">
          <div class="panel"><div class="panel-head"><div class="panel-title">By month</div>
              <div class="rs-hint">claims filed, and the rate against that month's jobs</div></div>
            ${months.map(m => { const j = (jobsByM[m] || new Set()).size; return `<div class="cln-month">
              <span>${esc(m)}</span>
              <span class="t"><i style="width:${Math.max(2, byM[m] / maxM * 100)}%"></i></span>
              <span class="v"><b>${fmtN(byM[m])}</b></span>
              <span class="v">${j ? r1(per100(byM[m], j)) + " /100" : "—"}</span></div>`; }).join("") || '<div class="rs-hint">no claims in this window</div>'}
          </div>
          <div class="panel"><div class="panel-head"><div class="panel-title">What they are about</div>
              <div class="rs-hint">${nKW ? "the board's Reason where the team chose one, the thread's keywords where it did not, a manager's correction over both" : "the board's Reason, folded into families"}</div></div>
            ${shareRows(famShare)}
          </div>
          ${nKW ? `<div class="panel"><div class="panel-head"><div class="panel-title">Keywords vs the team's Reason</div>
              <div class="rs-hint">on the ${fmtN(compared.length)} claims where both exist — how often the words in the thread point where the team pointed</div></div>
            ${agreeByFam.map(([f, a]) => `<div class="cln-share ${a.ok / a.n >= 0.7 ? "brand" : (a.ok / a.n >= 0.4 ? "" : "neg")}">
              <span class="n">${esc(f)}</span>
              <span class="t"><i style="width:${Math.max(2, a.ok / a.n * 100)}%"></i></span>
              <span class="v"><b>${Math.round(a.ok / a.n * 100)}%</b> · ${fmtN(a.ok)} of ${fmtN(a.n)}</span></div>`).join("") || '<div class="rs-hint">nothing to compare yet</div>'}
            <div class="rs-hint" style="margin-top:8px">${RULES.length ? RULES.filter(r => r.Kind === "family").length + " words define the families (" + RULES.filter(r => r.Kind === "flag").length + " more for the signals); English, Georgian and Latin-Georgian alike." : ""}</div>
          </div>` : ""}
          <div class="panel"><div class="panel-head"><div class="panel-title">Who the team held responsible</div>
              <div class="rs-hint">the board's Responsibility — a choice, not a finding</div></div>
            ${shareRows(respShare, "neg")}
          </div>
          <div class="panel"><div class="panel-head"><div class="panel-title">By service type</div>
              <div class="rs-hint">the board's Service Type, top eight</div></div>
            ${shareRows(svcShare, "brand")}
          </div>
        </div>

        <div class="panel" style="margin-top:12px">
          <div class="panel-head"><div><div class="panel-title">Salespeople</div>
            <div class="rs-hint">jobs sold in the window (the closing's salesperson), the claims on them, and — where the lead's quote and the contract's real CF exist — how far the bill and the volume ran past the estimate on the claimed jobs. Fewer than ${MIN_JOBS} jobs reads "small".</div></div></div>
          ${perTable(sales, "Salesperson", {
            head: `<th class="num">Price claims</th><th class="num">per 100</th><th class="num">Median bill vs quote</th><th class="num">Median CF vs estimate</th>`,
            cells: o => `<td class="num">${o.price || '<span class="cln-small">—</span>'}</td>${rateCell(o.price, o.jobs)}
              <td class="num">${o.medInc == null ? '<span class="cln-small">—</span>' : (o.medInc > 0 ? "+" : "") + pct1(o.medInc)}</td>
              <td class="num">${o.medCf == null ? '<span class="cln-small">—</span>' : (o.medCf > 0 ? "+" : "") + pct1(o.medCf)}</td>`,
          })}
        </div>

        <div class="panel" style="margin-top:12px">
          <div class="panel-head"><div><div class="panel-title">Foremen</div>
            <div class="rs-hint">jobs run in the window (the closing's foreman) and the claims on them, split by family. A damage claim is not a damage finding — the AI evidence pass is what will tell those apart.</div></div></div>
          ${perTable(foremen, "Foreman", {
            head: `<th class="num">Damage</th><th class="num">per 100</th><th class="num">Missing</th><th class="num">Timing</th>`,
            cells: o => `<td class="num">${o.damage || '<span class="cln-small">—</span>'}</td>${rateCell(o.damage, o.jobs)}
              <td class="num">${o.missing || '<span class="cln-small">—</span>'}</td><td class="num">${o.timing || '<span class="cln-small">—</span>'}</td>`,
          })}
        </div>

        <div class="panel" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">The claims</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(sorted.length)}</span>
            <button class="rs-btn" id="clnDl">Download CSV</button></div>
          <div class="rs-hint" style="margin:0 0 8px">Click a claim to read its whole Monday thread here.</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Created</th><th>Customer</th><th>Family · ${nKW ? "reason or words" : "reason"}</th>${nKW ? "<th>Signals</th>" : ""}<th>Status</th>
              <th>Salesperson</th><th>Foreman</th><th class="num">Bill</th><th class="num">vs quote</th>
              <th class="num">Refund</th><th class="num">Msgs</th></tr></thead>
            <tbody>${pageRows.map(r => `<tr class="cln-row" data-item="${esc(r["Monday Item Id"])}">
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
              <td class="num">${fmtN(num(r.Messages) || 0)}</td></tr>`).join("")}
            </tbody></table></div>
          <div class="cln-pager">
            <span>page ${S.page + 1} of ${pages}</span>
            <button class="rs-btn" data-pg="prev" ${S.page <= 0 ? "disabled" : ""}>‹ Prev</button>
            <button class="rs-btn" data-pg="next" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button>
          </div>
        </div>`;

      mountBar();
      host.querySelectorAll("[data-pg]").forEach(el => {
        el.onclick = () => { S.page += el.dataset.pg === "next" ? 1 : -1; paint(); };
      });
      host.querySelectorAll(".cln-row").forEach(tr => {
        tr.onclick = () => openDrawer(tr.dataset.item, sorted.find(r => String(r["Monday Item Id"]) === tr.dataset.item));
      });
      const dl = host.querySelector("#clnDl");
      if (dl) dl.onclick = () => dlCsv(sorted);
    }

    /* ---------- controls ---------- */
    function mountBar() {
      const bar = host.querySelector("#clnBar");
      if (!bar) return;
      const seg = (opts, cur, set) => {
        const s = document.createElement("div"); s.className = "rs-seg";
        opts.forEach(([v, label]) => {
          const b = document.createElement("button"); b.textContent = label;
          if (cur === v) b.className = "on";
          b.onclick = () => { set(v); S.page = 0; paint(); };
          s.appendChild(b);
        });
        return s;
      };
      const fld = (label, el) => { const w = document.createElement("div"); w.className = "rs-fld";
        w.innerHTML = `<span>${label}</span>`; w.appendChild(el); return w; };
      bar.appendChild(fld("Period", seg([["3m", "Last 3 months"], ["6m", "Last 6"], ["12m", "Last 12"],
        ["ytd", "This year"], ["all", "All time"]], S.period, v => { S.period = v; })));
      bar.appendChild(fld("Service", seg([["", "All"], ["Local", "Local"], ["Long distance", "Long distance"],
        ["Storage", "Storage"]], S.svc, v => { S.svc = v; })));
      const q = document.createElement("input");
      q.className = "cln-in"; q.placeholder = "find a customer, reason, salesperson, foreman…";
      q.value = S.q; q.style.flex = "0 1 300px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S.page = 0; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    /* ---------- the drawer: one claim's thread ---------- */
    async function openDrawer(itemId, row) {
      closeDrawer();
      const dim = document.createElement("div"); dim.className = "cln-dim"; dim.onclick = closeDrawer;
      const dr = document.createElement("div"); dr.className = "cln-drawer";
      dr.innerHTML = `<div class="cln-dh"><div><h3>${esc(row ? row.Customer : "Claim")}</h3>
          <div class="sub">${row ? esc([row["Reason Family"], row.Reason, row.Status].filter(Boolean).join(" · ")) : ""}</div></div>
          <button class="rs-btn x" id="clnX">Close</button></div>
        <div class="cln-db"><div class="rs-loading">Reading the thread…</div></div>`;
      document.body.appendChild(dim); document.body.appendChild(dr);
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
          ${it.Url ? `<div class="rs-hint" style="margin-top:14px"><a href="${esc(it.Url)}" target="_blank" rel="noopener">Open in Monday</a></div>` : ""}`;
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
    function closeDrawer() {
      document.querySelectorAll(".cln-dim,.cln-drawer").forEach(el => el.remove());
    }

    function dlCsv(rows) {
      const cols = ["Created Date", "Customer", "Request No", "Group", "Status", "Reason Family", "Reason",
        "Responsibility Family", "Responsibility", "Service Type", "Sales Person", "Foreman", "Job Date",
        "Total Bill", "Quote", "Price Increase Pct", "Estimated CF", "Real CF", "CF Variance Pct",
        "Refund $", "Negative Reviews", "Messages", "Files", "Monday Item Id"];
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
