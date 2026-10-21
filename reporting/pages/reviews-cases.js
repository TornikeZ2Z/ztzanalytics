/* REVIEWS ▸ Claims & Negative Reviews — Tako's tickets #510 + #512 (2026-08-31), as a page
 * instead of a one-off export: which platforms the bad reviews land on, what the claims are
 * actually about, and how much the two boards overlap.
 *
 * BOTH BOARDS ALREADY LIVE IN THE WAREHOUSE (the Monday boards load via sheets):
 * fct_negative_reviews (307 all-time) and fct_claims (888 all-time). No new pipeline.
 *
 * THREE DATA TRUTHS THIS PAGE MUST NOT HIDE:
 *  1. 93 of 307 negative reviews have NO Written Date — every one of them Group='Removed'.
 *     A date filter silently drops them, so the page says so out loud instead.
 *  2. `Review Score` is a VARCHAR OF EMOJI STARS ('⭐️'..'⭐️⭐️⭐️⭐️', 'Complaint', NULL,
 *     and one '⭐️⭐️, ⭐️' combo) — mapped to numbers here, with the non-star states kept
 *     as their own buckets rather than faked into the average.
 *  3. Platform labels rot ('Concumer Affairs', 'Truspilot', 'Google Sahfto') — canonicalised
 *     through ONE lookup; an unknown label lands in 'Unlabeled' loudly instead of minting a
 *     new family. The raw label survives in the case tables.
 *
 * THE OVERLAP RULE: joinkey first, customer-name fallback (2 of the 21 matches are
 * name-only; 1 is joinkey-only — both keys earn their place).
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.negative_reviews_cases) {
      RS.DATASETS.negative_reviews_cases = {
        table: "fct_negative_reviews",
        cols: ["Company", "Group", "Customer", "Request No", "Is Identified", "Status",
               "Case Owner", "Review Score", "Source", "Written Date", "Request Joinkey"],
        dateCols: { "Written Date": "Written Date" }, defaultDate: "Written Date",
      };
    }
    // THE WAY OUT TO THE BOARD (2026-09-03). fct_claims has no Url and must not get one --
    // it is granted to monthly-report and data-quality, who have no business on the claims
    // board. mart_claims_analysis carries it and is granted only here and to Claims Analysis.
    if (!RS.DATASETS.claim_links) {
      RS.DATASETS.claim_links = {
        table: "mart_claims_analysis",
        // Company (2026-10-15): a claim's company is its JOB's, read here exactly as its State is
        cols: ["Monday Item Id", "Request Joinkey", "Monday Url", "State", "Company"],
      };
    }
    if (!RS.DATASETS.claims_cases) {
      RS.DATASETS.claims_cases = {
        table: "fct_claims",
        cols: ["Created Date", "Customer", "Request No", "Group", "Status", "Reason",
               "Responsibility", "Request Joinkey", "Foreman", "Monday Item Id"],
        dateCols: { "Created Date": "Created Date" }, defaultDate: "Created Date",
      };
    }
  }
})();

registerPage({
  id: "reviews-cases",
  group: "reviews",
  title: "Claims & Negative Reviews",
  async render(host) {
    const num = RS.num, fmtN = RS.fmtN;
    const esc = s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";

    if (!document.getElementById("rvc-style")) {
      const st = document.createElement("style");
      st.id = "rvc-style";
      st.textContent = [
        // Only what the kit cannot say; everything else is .panel/.rs-kpis/.rs-table/.rs-seg.
        ".rvc-mon{color:var(--brand);font-weight:600;text-decoration:none;white-space:nowrap}",
        // the print button sits with the page title, right-aligned, and never squeezes
        // the description text on a narrow window
        ".rvc-pdf{float:right;margin:-2px 0 8px 16px}",
        ".rvc-mon:hover{text-decoration:underline}",
        ".rvc-small{color:var(--faint);font-size:11.5px;white-space:nowrap}",
        ".rvc-bar{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        ".rvc-bar>.rvc-in{margin-bottom:1px}",
        ".rvc-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;"
          + "transition:border-color .15s}",
        ".rvc-in:focus{border-color:var(--brand)}",
        // a horizontal share bar: one colour per meaning, never per row
        ".rvc-share{display:grid;grid-template-columns:minmax(110px,200px) minmax(60px,1fr) auto;gap:10px;"
          + "align-items:center;padding:6px 0;border-bottom:1px solid var(--line-2)}",
        ".rvc-share:last-child{border-bottom:0}",
        ".rvc-share .n{font-size:13px;font-weight:600;min-width:0;overflow:hidden;"
          + "text-overflow:ellipsis;white-space:nowrap}",
        ".rvc-share .t{height:10px;background:var(--panel-2);border-radius:5px;overflow:hidden}",
        ".rvc-share .t i{display:block;height:100%;background:var(--neg);border-radius:5px}",
        ".rvc-share.warn .t i{background:var(--warn)}",
        ".rvc-share .v{font-size:12.5px;color:var(--muted);text-align:right;"
          + "font-variant-numeric:tabular-nums;white-space:nowrap}",
        ".rvc-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;"
          + "margin-top:12px;font-size:12.5px;color:var(--faint)}",
        ".rvc-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
        ".rvc-note{font-size:12px;color:var(--faint);margin-top:8px;line-height:1.6}",
        // what a section cannot follow among the panel's filters, said under its title (2026-10-15)
        ".rvc-nf{font-size:12px;color:var(--muted);margin:0 0 8px;line-height:1.5}",
        ".rvc-nf b{color:var(--ink);font-weight:600}",
        ".rvc-stars{color:var(--warn);letter-spacing:1px}",
        // 1fr grid columns default to min-width:auto — a table inside forces the column
        // wider than the viewport (the classic grid blowout; measured 2385px vs 2048).
        ".rvc-grid>.panel{min-width:0}",
        // DESIGN V2 ("Calm finance"), light only: 12px floor, pill search, hairline rows,
        // 4px bar ends. Dark keeps every rule above.
        "body.rs-app.light.v2 .rvc-small{font-size:12px}",
        "body.rs-app.light.v2 .rvc-in{border-radius:999px;border-color:var(--line-2);height:36px;padding:0 14px;background:#FFFFFF}",
        "body.rs-app.light.v2 .rvc-in:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(63,125,32,.14)}",
        "body.rs-app.light.v2 .rvc-share{border-bottom-color:#F1F5F9}",
        "body.rs-app.light.v2 .rvc-share .n{font-weight:500;color:var(--ink)}",
        "body.rs-app.light.v2 .rvc-share .t,body.rs-app.light.v2 .rvc-share .t i{border-radius:4px}",
        "body.rs-app.light.v2 .rvc-note{font-size:12.5px}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Claims &amp; Negative Reviews</h1></div>
      <div class="rs-loading" style="padding:22px">Reading both boards…</div>`;

    const [nrAll, clAll, clLinks, rcAll] = await Promise.all([
      RS.load("negative_reviews_cases"), RS.load("claims_cases"),
      RS.load("claim_links").catch(() => []), RS.load("review_counts").catch(() => [])]);
    /* BY STATE (Sopho's half of the Kolbaia meeting, 2026-10-01: "CT statistics, how many we had
       and how many were added, by platform, positive and negative"). A listing's state is in its
       name (Google CT, Yelp Ct, Nextdoor Ct; Shafto is the NJ office, Boston is MA, Tuji is DE);
       a listing with no state in its name (Birdeye, Angi, Google Local...) belongs to none. A
       claim's state is its JOB's state, read off Claims Analysis's mart. */
    const STATES = ["NJ", "PA", "NY", "CT", "MA", "DE", "MD", "VA"];
    const ST_FULL = { "New Jersey": "NJ", "Pennsylvania": "PA", "New York": "NY", "Connecticut": "CT",
                      "Massachusetts": "MA", "Delaware": "DE", "Maryland": "MD", "Virginia": "VA" };
    const listingState = raw => {
      const w = String(raw || "").trim().toLowerCase().split(/\s+/);
      const last = w[w.length - 1] || "";
      if (STATES.includes(last.toUpperCase()) && w.length > 1) return last.toUpperCase();
      if (w.includes("shafto") || w.includes("sahfto")) return "NJ";
      if (w.includes("boston")) return "MA";
      if (w.includes("tuji")) return "DE";
      return "";
    };
    const FLOW = RS.reviewFlow ? RS.reviewFlow(rcAll || []) : null;
    const CLSTATE = {}, CLCO = {};
    (clLinks || []).forEach(r => { const jk = String(r["Request Joinkey"] || "").trim(), st = ST_FULL[r.State];
      if (jk && st) CLSTATE[jk] = st;
      if (jk && r.Company) CLCO[jk] = String(r.Company); });
    // the board link, keyed by the item the claim already carries
    const URLBY = {};
    (clLinks || []).forEach(r => { const k = String(r["Monday Item Id"] || "");
      if (k && r["Monday Url"]) URLBY[k] = r["Monday Url"]; });

    /* ---------- canonicalisation (the audit's map; one copy in rs-core, shared with
       Marketing Overview's Reviews tab) ---------- */
    const PLATFORM = RS.reviewPlatform;
    const stars = RS.reviewStars;
    const claimReason = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return "Unspecified";
      if (/^tip \+ increased price$/i.test(s)) return "TIP + Increased Price";
      return s;
    };

    /* FROM - TO (Tornike, 2026-10-02: "add date filter for From - To"). It replaces the three
       year buttons; "This year" and "Last year" are presets of the same picker, and the page opens
       on This year as it opened on the current year before. */
    const _now = new Date();
    const S = { from: _now.getFullYear() + "-01-01", to: _now.toLocaleDateString("en-CA"),
                q: "", nrPage: 0, clPage: 0, pageSize: 25,
                state: new Set(), company: new Set(), platform: new Set(), resp: new Set() };
    const ranged = () => !!(S.from || S.to);
    function rangeLabel() {
      const f = S.from || "", t = S.to || "";
      if (!f && !t) return "all time";
      const hit = (window.RSC && RSC.datePresets ? RSC.datePresets() : []).find(p => p[1] === f && p[2] === t);
      if (hit) return hit[0].toLowerCase();
      const d = x => x ? new Date(x + "T12:00:00").toLocaleDateString("en-US",
        { month: "short", day: "numeric", year: "numeric" }) : "…";
      return d(f) + " – " + d(t);
    }
    let qTimer = null;

    /* claims indexed once, all-time — the overlap question is "did this reviewer EVER
       claim", not "did they claim in the same filter window" */
    const clByJoin = new Map(), clByName = new Map();
    clAll.forEach(r => {
      const jk = String(r["Request Joinkey"] || "").trim();
      const nm = String(r.Customer || "").trim().toLowerCase();
      if (jk) (clByJoin.get(jk) || clByJoin.set(jk, []).get(jk)).push(r);
      if (nm) (clByName.get(nm) || clByName.set(nm, []).get(nm)).push(r);
    });
    const nrByJoin = new Map(), nrByName = new Map();
    nrAll.forEach(r => {
      const jk = String(r["Request Joinkey"] || "").trim();
      const nm = String(r.Customer || "").trim().toLowerCase();
      if (jk) (nrByJoin.get(jk) || nrByJoin.set(jk, []).get(jk)).push(r);
      if (nm) (nrByName.get(nm) || nrByName.set(nm, []).get(nm)).push(r);
    });
    const nrClaimMatch = r => {
      const jk = String(r["Request Joinkey"] || "").trim();
      if (jk && clByJoin.has(jk)) return "joinkey";
      const nm = String(r.Customer || "").trim().toLowerCase();
      if (nm && clByName.has(nm)) return "name";
      return null;
    };
    // an href scheme is not a place for trust: only https ever reaches the DOM
    const clMonday = r => {
      const u = URLBY[String(r["Monday Item Id"] || "")];
      return /^https:\/\//i.test(String(u || ""))
        ? `<a class="rvc-mon" href="${esc(u)}" target="_blank" rel="noopener">Open &#8599;</a>`
        : '<span class="rvc-small">&mdash;</span>';
    };
    const clReviewMatch = r => {
      const jk = String(r["Request Joinkey"] || "").trim();
      if (jk && nrByJoin.has(jk)) return "joinkey";
      const nm = String(r.Customer || "").trim().toLowerCase();
      if (nm && nrByName.has(nm)) return "name";
      return null;
    };

    /* THE PAGE'S OWN FILTERS (his ask 2026-10-15: the shell's Filters button and right-hand panel
       on every report with its own bar). State moved in from the bar's buttons and is a multi now;
       Company, Platform and Responsibility are new. Held in S for this visit only -- never
       RS.state.multi, never stored. EACH REACHES ONLY THE LISTS THAT CARRY IT (his rule: a part
       that cannot follow a filter shows unfiltered and says so):
         · negative reviews: State (the listing's name), Company, Platform -- no responsibility;
         · claims: State and Company of the claim's JOB (Claims Analysis's mart), Responsibility --
           a claim has no platform;
         · listings: State (name), Company and Platform of the listing -- no responsibility. */
    const PFK = ["state", "company", "platform", "resp"];
    const PF_NAME = { state: "State", company: "Company", platform: "Platform", resp: "Responsibility" };
    const clJk = r => String(r["Request Joinkey"] || "").trim();
    const respOf = r => String(r.Responsibility || "").trim() || "Not attributed";
    const PF_OF = {
      nr: { state: r => listingState(r.Source), company: r => String(r.Company || ""), platform: r => PLATFORM(r.Source) },
      cl: { state: r => CLSTATE[clJk(r)] || "", company: r => CLCO[clJk(r)] || "", resp: respOf },
      ls: { state: g => listingState(g.label), company: g => String(g.company || ""), platform: g => PLATFORM(g.label) },
    };
    // a list that has no such column passes the filter through (and says so where it is drawn)
    const pfKeep = (list, r) => PFK.every(k => !S[k].size || !PF_OF[list][k] || S[k].has(PF_OF[list][k](r)));
    // "Not filtered by Platform: <what>." for the filters that are on and that this list lacks;
    // the count tiles carry the same words in their subtitle
    const pfMiss = list => PFK.filter(k => S[k].size && !PF_OF[list][k]).map(k => PF_NAME[k]).join(" or ");
    const pfGap = (list, what) => pfMiss(list)
      ? `<div class="rvc-nf"><b>Not filtered by ${esc(pfMiss(list))}:</b> ${esc(what)}.</div>` : "";
    const pfTile = list => pfMiss(list) ? " · not filtered by " + pfMiss(list) : "";
    const PF_NOTE = "A claim has no platform, and a negative review or a listing has no responsibility: "
      + "a list that cannot follow a filter shows whole and says so under its title. A claim's state and company "
      + "are its job's. The negative-review board files every review under Zip to Zip, Tuji's listings included, "
      + "so Company there reads the board's own column.";

    paint();

    /* CSV, the portal's one pattern: UTF-8 BOM + CRLF + the formula-injection guard
       (a leading =+-@ becomes text). Always the FILTERED set — what the reader sees,
       not the page they happen to be on. */
    function dlCsv(name, head, rows) {
      const cell = v => {
        let x = String(v == null ? "" : v);
        if (/^[=+\-@]/.test(x)) x = " " + x;
        return /[",\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x;
      };
      const lines = [head.join(",")].concat(rows.map(r => r.map(cell).join(",")));
      const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name + (ranged() ? "-" + (S.from || "start") + "-to-" + (S.to || "today") : "-all-time") + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    /* a record with no date can't be placed in a range: it drops out, and the KPI counts it */
    function inRange(dateStr) {
      if (!ranged()) return true;
      const d = String(dateStr || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
      return (!S.from || d >= S.from) && (!S.to || d <= S.to);
    }
    function rows() {
      const q = S.q.trim().toLowerCase();
      const hit = (r, fields) => !q ||
        fields.some(f => String(r[f] || "").toLowerCase().includes(q));
      return {
        nr: nrAll.filter(r => inRange(r["Written Date"]) && pfKeep("nr", r)
          && hit(r, ["Customer", "Source", "Status", "Case Owner", "Request No"])),
        cl: clAll.filter(r => inRange(r["Created Date"]) && pfKeep("cl", r)
          && hit(r, ["Customer", "Reason", "Status", "Responsibility", "Foreman", "Request No"])),
        // the undated-removed bucket a date filter silently drops — surfaced, not hidden
        nrUndated: ranged() ? nrAll.filter(r => !String(r["Written Date"] || "").trim()
          && pfKeep("nr", r)).length : 0,
      };
    }

    /* PUBLIC REVIEWS BY LISTING. Each listing's running total, as the review-counts sheet records
       it month by month (RS.reviewFlow, the portal-wide rule): a rise is reviews added, a fall is
       reviews the platform removed, and a collapse of 30%+ (20 reviews or more) is the platform
       RECOUNTING the listing -- neither. The climb straight back after a recount is the same
       recount undoing itself (Google CT 243 -> 6 -> 261, summer 2025), so it is not "added" either. */
    // FLOW is built with the other indexes above, before the first paint() (TDZ)
    function listingRows() {
      if (!FLOW) return [];
      // the review counts are monthly: a range takes every month it touches
      const from = S.from ? S.from.slice(0, 7) : "0000-00", to = S.to ? S.to.slice(0, 7) : "9999-99";
      const out = [];
      Object.values(FLOW.byPlat).forEach(g => {
        const st = listingState(g.label);
        if (!pfKeep("ls", g)) return;
        const yms = Object.keys(g.steps).sort();
        let start = null, end = null, added = 0, removed = 0, recount = 0, prevReset = 0, any = false;
        yms.forEach(ym => { const x = g.steps[ym];
          if (ym >= from && ym <= to && x.from != null) {
            any = true;
            if (start == null) start = x.from;
            end = x.level;
            const back = prevReset ? Math.min(x.added, prevReset) : 0;
            added += x.added - back; recount += back + x.reset; removed += x.removed;
          }
          prevReset = x.reset; });
        if (!any) return;
        out.push({ label: g.label + (g.company && g.company !== "Zip to Zip" ? " (" + g.company + ")" : ""),
                   st, start, end, added, removed, recount });
      });
      return out.sort((a, b) => (b.end || 0) - (a.end || 0));
    }

    function shareRows(counts, total, cls) {
      const max = Math.max(1, ...counts.map(c => c[1]));
      return counts.map(([label, n, extra]) => `
        <div class="rvc-share ${cls || ""}" title="${esc(label)}${extra ? " · " + esc(extra) : ""}">
          <span class="n">${esc(label)}</span>
          <span class="t"><i style="width:${n / max * 100}%"></i></span>
          <span class="v">${fmtN(n)} · ${pct(n, total)}${extra && extra.length <= 40
            ? " · " + esc(extra) : ""}</span>
        </div>`).join("");
    }

    function pager(page, total, key) {
      const pages = Math.max(1, Math.ceil(total / S.pageSize));
      return `<div class="rvc-pager">
        <span>${fmtN(Math.min(total, page * S.pageSize + 1))}–${fmtN(Math.min(total,
          (page + 1) * S.pageSize))} of ${fmtN(total)}</span>
        <button class="rs-btn" data-pg="${key}:prev" ${page === 0 ? "disabled" : ""}>‹ Prev</button>
        <button class="rs-btn" data-pg="${key}:next" ${page >= pages - 1 ? "disabled" : ""}>Next ›</button>
      </div>`;
    }

    function paint() {
      const { nr, cl, nrUndated } = rows();
      S.nrPage = Math.min(S.nrPage, Math.max(0, Math.ceil(nr.length / S.pageSize) - 1));
      S.clPage = Math.min(S.clPage, Math.max(0, Math.ceil(cl.length / S.pageSize) - 1));

      // ---- platforms
      const byPlat = {};
      nr.forEach(r => {
        const p = PLATFORM(r.Source);
        const b = byPlat[p] = byPlat[p] || { n: 0, open: 0, starSum: 0, starN: 0 };
        b.n++;
        if (String(r.Group).trim() === "Open") b.open++;
        const st = stars(r["Review Score"]);
        if (st.kind === "stars") { b.starSum += st.n; b.starN++; }
      });
      const platRows = Object.entries(byPlat).sort((a, b) => b[1].n - a[1].n)
        .map(([p, b]) => [p, b.n,
          (b.open ? b.open + " open" : "") +
          (b.starN ? (b.open ? " · " : "") + "★" + (b.starSum / b.starN).toFixed(1) : "")]);

      // ---- claim reasons (singletons folded into Other for the chart, visible in the table)
      const byReason = {};
      cl.forEach(r => { const k = claimReason(r.Reason); byReason[k] = (byReason[k] || 0) + 1; });
      const reasonPairs = Object.entries(byReason).sort((a, b) => b[1] - a[1]);
      const main = reasonPairs.filter(([k, n]) => n >= 3 || k === "Unspecified");
      const tail = reasonPairs.filter(([k, n]) => n < 3 && k !== "Unspecified");
      const tailN = tail.reduce((a, [, n]) => a + n, 0);
      const reasonRows = main.map(([k, n]) => [k, n, ""])
        .concat(tailN ? [["Other (" + tail.length + " rare reasons)", tailN,
                          tail.map(([k]) => k).join(", ").slice(0, 120)]] : []);

      // ---- responsibility
      const byResp = {};
      cl.forEach(r => {
        const k = String(r.Responsibility || "").trim() || "Not attributed";
        byResp[k] = (byResp[k] || 0) + 1;
      });
      const respRows = Object.entries(byResp).sort((a, b) => b[1] - a[1]);

      // ---- overlap
      const nrMatched = nr.map(r => ({ r, m: nrClaimMatch(r) })).filter(x => x.m);
      const clMatched = cl.map(r => ({ r, m: clReviewMatch(r) })).filter(x => x.m);

      const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ""}">
        <div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
      const yearLabel = rangeLabel();
      const LST = listingRows();
      const lsum = k => LST.reduce((a, r) => a + (r[k] || 0), 0);
      const lastSnap = FLOW && FLOW.months.length ? FLOW.months[FLOW.months.length - 1] : "";

      const nrPageRows = nr.slice(S.nrPage * S.pageSize, (S.nrPage + 1) * S.pageSize);
      const clPageRows = cl.slice(S.clPage * S.pageSize, (S.clPage + 1) * S.pageSize);
      const starCell = r => {
        const st = stars(r["Review Score"]);
        return st.kind === "stars"
          ? `<span class="rvc-stars">${"★".repeat(st.n)}</span>`
          : st.kind === "complaint" ? '<span class="rs-pill warn">complaint</span>'
          : '<span class="rs-pill mute">—</span>';
      };

      host.innerHTML = `
        <div class="rs-page-head"><h1>Claims &amp; Negative Reviews</h1>
          <p>Both boards from the warehouse — where the bad reviews land, what the claims are
             about, and how much the two overlap. Matching is by request first, customer name
             as fallback.</p>
          <button class="rs-btn pri rvc-pdf" id="rvcPdf" title="a print sheet of this dashboard, to save as a PDF">Download PDF</button></div>

        <div class="rvc-bar" id="rvcBar"></div>

        <div class="rs-kpis" style="--kpi-cols:6">
          ${kpi("Negative reviews", fmtN(nr.length), yearLabel +
            (nrUndated ? " · +" + fmtN(nrUndated) + " undated (removed, no date to place in the range)" : "") + pfTile("nr"))}
          ${kpi("Still open", fmtN(nr.filter(r => String(r.Group).trim() === "Open").length),
            "the rest are removed / closed", "warn")}
          ${kpi("Claims", fmtN(cl.length), yearLabel + pfTile("cl"))}
          ${kpi("Claims with a reason", pct(cl.filter(r =>
              String(r.Reason || "").trim()).length, cl.length),
            fmtN(cl.filter(r => !String(r.Reason || "").trim()).length) + " unspecified")}
          ${kpi("Reviews from claimants", pct(nrMatched.length, nr.length),
            fmtN(nrMatched.length) + " of " + fmtN(nr.length) + " ever filed a claim", "warn")}
          ${kpi("Claims that turned public", pct(clMatched.length, cl.length),
            fmtN(clMatched.length) + " have a negative review")}
        </div>

        <div class="panel" id="rvcPnlListings">
          <div class="panel-head"><div class="panel-title">Public reviews by listing${S.state.size ? " — " + esc([...S.state].join(", ")) : ""}</div>
            <div class="rs-spacer"></div><span class="rs-pill">+${fmtN(lsum("added"))} added · −${fmtN(lsum("removed"))} removed</span></div>
          ${pfGap("ls", "the listings (a listing has no responsibility)")}
          ${LST.length ? `<div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Listing</th><th class="num">On file at the start</th><th class="num">On file now</th>
              <th class="num">Added</th><th class="num">Removed by the platform</th><th class="num">Recounted</th></tr></thead>
            <tbody>${LST.map(r => `<tr><td class="strong">${esc(r.label)}</td>
              <td class="num">${r.start == null ? "—" : fmtN(r.start)}</td><td class="num">${r.end == null ? "—" : fmtN(r.end)}</td>
              <td class="num">${r.added ? "+" + fmtN(r.added) : "—"}</td><td class="num">${r.removed ? "−" + fmtN(r.removed) : "—"}</td>
              <td class="num muted">${r.recount ? fmtN(r.recount) : "—"}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>${fmtN(LST.length)} listings</td><td class="num">${fmtN(lsum("start"))}</td><td class="num">${fmtN(lsum("end"))}</td>
              <td class="num">+${fmtN(lsum("added"))}</td><td class="num">−${fmtN(lsum("removed"))}</td><td class="num muted">${fmtN(lsum("recount"))}</td></tr></tfoot>
            </table></div>` : '<p class="rs-hint">No listing counts for this window.</p>'}
          <div class="rvc-note">Every listing's total as the review-counts sheet records it each month${lastSnap ? " (latest " + esc(lastSnap) + ")" : ""}.
            Added = the rises, positive and negative alike; the negative ones are the cases below. Removed = falls.
            Recounted = a platform resetting the listing and its rebound, counted as neither.
            ${S.state.size ? "A listing with no state in its name (Birdeye, Angi, Google Local…) is in no state." : ""}</div>
        </div>

        <div class="rs-grid2 rvc-grid">
          <div class="panel" id="rvcPnlWhere">
            <div class="panel-head"><div class="panel-title">Where they complain</div>
              <div class="rs-spacer"></div><span class="rs-pill">${fmtN(nr.length)} reviews</span></div>
            ${pfGap("nr", "the negative reviews (a review has no responsibility)")}
            ${nr.length ? shareRows(platRows, nr.length) :
              '<p class="rs-hint">No negative reviews in this window.</p>'}
            <div class="rvc-note">Platform families fold the per-state pages together
              (Google Nj/Pa/Shafto… → Google). The raw label is on every case below.
              Blank sources read as Unlabeled.</div>
          </div>

          <div class="panel" id="rvcPnlWhy">
            <div class="panel-head"><div class="panel-title">Why they claim</div>
              <div class="rs-spacer"></div><span class="rs-pill">${fmtN(cl.length)} claims</span></div>
            ${pfGap("cl", "the claims (a claim has no platform)")}
            ${cl.length ? shareRows(reasonRows, cl.length, "warn") :
              '<p class="rs-hint">No claims in this window.</p>'}
            <div class="rvc-note">Unspecified is shown as its own slice on purpose — hiding it
              would overstate every named reason.</div>
          </div>
        </div>

        <div class="rs-grid2 rvc-grid">
          <div class="panel" id="rvcPnlOverlap">
            <div class="panel-head"><div class="panel-title">The overlap</div></div>
            ${pfGap("nr", "the negative reviews here")}${pfGap("cl", "the claims here")}
            <p class="rs-hint" style="max-width:64ch">
              <b>${pct(nrMatched.length, nr.length)}</b> of the negative reviews in ${yearLabel}
              (${fmtN(nrMatched.length)} of ${fmtN(nr.length)}) were written by customers who
              filed a claim at any point — an unresolved claim is the best predictor of a
              public one-star. The other direction stays small:
              <b>${pct(clMatched.length, cl.length)}</b> of claims
              (${fmtN(clMatched.length)} of ${fmtN(cl.length)}) have gone public so far.</p>
            ${nrMatched.length ? `<div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Customer</th><th>Platform</th><th>Review</th>
                <th>Claim reason</th><th>Matched by</th></tr></thead>
              <tbody>${nrMatched.slice(0, 12).map(({ r, m }) => {
                const jk = String(r["Request Joinkey"] || "").trim();
                const nm = String(r.Customer || "").trim().toLowerCase();
                const claim = (m === "joinkey" ? clByJoin.get(jk) : clByName.get(nm))[0];
                return `<tr><td class="strong">${esc(r.Customer || "—")}</td>
                  <td>${esc(PLATFORM(r.Source))}</td>
                  <td>${starCell(r)}</td>
                  <td>${esc(claimReason(claim.Reason))}</td>
                  <td class="muted">${m === "joinkey" ? "request" : "name"}</td></tr>`;
              }).join("")}</tbody></table></div>
              ${nrMatched.length > 12 ? `<div class="rvc-note">Showing 12 of ${fmtN(nrMatched.length)} — every one is in the case tables below.</div>` : ""}`
              : ""}
          </div>

          <div class="panel" id="rvcPnlFault">
            <div class="panel-head"><div class="panel-title">Whose fault, per the board</div></div>
            ${pfGap("cl", "the claims (a claim has no platform)")}
            ${cl.length ? shareRows(respRows.map(([k, n]) => [k, n, ""]), cl.length, "warn") : ""}
            <div class="rvc-note">${(() => { /* said from the data: the old fixed sentence
              ("not attributed dominates") was false for Connecticut, where it is filled on most */
              const na = cl.filter(r => !String(r.Responsibility || "").trim()).length;
              return na > cl.length / 2
                ? "Not attributed dominates — the board's Responsibility column is empty on " + fmtN(na) + " of " + fmtN(cl.length) + " claims. Worth an ask to the claims owner if this cut matters."
                : "The board names a responsibility on " + fmtN(cl.length - na) + " of " + fmtN(cl.length) + " claims."; })()}</div>
          </div>
        </div>

        <div class="panel" id="rvcPnlNr">
          <div class="panel-head"><div class="panel-title">Negative reviews — the cases</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(nr.length)}</span>
            <button class="rs-btn" data-dl="nr">Download CSV</button></div>
          ${pfGap("nr", "these reviews (a review has no responsibility)")}
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Written</th><th>Customer</th><th>Platform</th><th>Raw label</th>
              <th>Review</th><th>Group</th><th>Status</th><th>Owner</th></tr></thead>
            <tbody>${nrPageRows.map(r => `<tr>
              <td class="nowrap">${esc(String(r["Written Date"] || "").slice(0, 10) || "—")}</td>
              <td class="strong">${esc(r.Customer || "—")}</td>
              <td>${esc(PLATFORM(r.Source))}</td>
              <td class="muted">${esc(String(r.Source || "").trim() || "—")}</td>
              <td>${starCell(r)}</td>
              <td>${String(r.Group).trim() === "Open"
                ? '<span class="rs-pill warn">Open</span>'
                : '<span class="rs-pill mute">' + esc(r.Group || "—") + "</span>"}</td>
              <td>${esc(r.Status || "—")}</td>
              <td class="muted">${esc(r["Case Owner"] || "—")}</td></tr>`).join("")}
            </tbody></table></div>
          ${pager(S.nrPage, nr.length, "nr")}
        </div>

        <div class="panel" id="rvcPnlCl">
          <div class="panel-head"><div class="panel-title">Claims — the cases</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(cl.length)}</span>
            <button class="rs-btn" data-dl="cl">Download CSV</button></div>
          ${pfGap("cl", "these claims (a claim has no platform)")}
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Created</th><th>Customer</th><th>Reason</th><th>Status</th>
              <th>Responsibility</th><th>Foreman</th><th>Went public</th><th>Monday</th></tr></thead>
            <tbody>${clPageRows.map(r => `<tr>
              <td class="nowrap">${esc(String(r["Created Date"] || "").slice(0, 10) || "—")}</td>
              <td class="strong">${esc(r.Customer || "—")}</td>
              <td>${esc(claimReason(r.Reason))}</td>
              <td>${esc(r.Status || "—")}</td>
              <td class="muted">${esc(String(r.Responsibility || "").trim() || "—")}</td>
              <td class="muted">${esc(r.Foreman || "—")}</td>
              <td>${clReviewMatch(r)
                ? '<span class="rs-pill warn">yes</span>'
                : '<span class="rs-pill mute">no</span>'}</td>
              <td>${clMonday(r)}</td></tr>`).join("")}
            </tbody></table></div>
          ${pager(S.clPage, cl.length, "cl")}
        </div>`;

      mountBar();

      const pdfBtn = host.querySelector("#rvcPdf");
      /* THE PAPER GETS EVERY CASE (review 2026-10-01: the PDF carried the first 25 claims of 36 with
         the Prev / Next buttons under them). Painted once more with every row for the snapshot,
         then the screen goes back to the page the reader was on. */
      if (pdfBtn) pdfBtn.onclick = () => {
        const keep = { nrPage: S.nrPage, clPage: S.clPage, pageSize: S.pageSize };
        Object.assign(S, { nrPage: 0, clPage: 0, pageSize: 1e6 });
        paint();
        try { printNow(); } finally { Object.assign(S, keep); paint(); }
      };
      const printNow = () => RSC.printView({
        host,
        pack: true,
        title: "Claims & Negative Reviews",
        // built from its own classes rather than the kit, so the PDF needs its CSS
        pageCss: "rvc-style",
        // the PDF's reader has no filter bar, so the window is stated in words
        subtitle: rangeLabel() + PFK.filter(k => S[k].size).map(k => " · " + PF_NAME[k] + " " + [...S[k]].join(", ")).join("")
                + (S.q.trim() ? ` · search "${S.q.trim()}"` : " · no search"),
        note: "Both boards read whole; the date filter is applied here, not in the warehouse. "
            + "A review or claim with no date sits outside every date range and is counted separately. "
            + "Matching between the two boards is by request number first, customer name as fallback.",
        // the "Filtered by" chips go too: the subtitle above already names every filter
        drop: [".rvc-bar", ".rs-pchips", ".rvc-pdf", ".rvc-pager", "[data-dl]", ".rvc-note"],
        // ONE THEME PER SHEET: the headline counts, then the two boards' own shapes, then
        // where they meet, then the cases behind them.
        pages: [
          // the six counts and the listings fill one sheet; apart, the headline was a stripe on an empty page
          { title: "The headline, and public reviews by listing", sel: ".rs-kpis, #rvcPnlListings" },
          { title: "Where they complain, and why they claim", sel: "#rvcPnlWhere, #rvcPnlWhy" },
          { title: "The overlap, and whose fault the board says it is", sel: "#rvcPnlOverlap, #rvcPnlFault" },
          { title: "Negative reviews — the cases", sel: "#rvcPnlNr" },
          { title: "Claims — the cases", sel: "#rvcPnlCl" },
        ],
      });

      host.querySelectorAll("[data-dl]").forEach(el => {
        el.onclick = () => {
          if (el.dataset.dl === "nr") {
            dlCsv("negative-reviews",
              ["Written Date", "Customer", "Platform", "Raw Label", "Stars", "Kind",
               "Group", "Status", "Case Owner", "Request No", "Has Claim", "Matched By"],
              nr.map(r => {
                const st = stars(r["Review Score"]), m = nrClaimMatch(r);
                return [String(r["Written Date"] || "").slice(0, 10), r.Customer,
                        PLATFORM(r.Source), String(r.Source || "").trim(),
                        st.kind === "stars" ? st.n : "", st.kind,
                        r.Group, r.Status, r["Case Owner"], r["Request No"],
                        m ? "yes" : "no", m || ""];
              }));
          } else {
            dlCsv("claims",
              ["Created Date", "Customer", "Reason", "Status", "Group", "Responsibility",
               "Foreman", "Request No", "Went Public"],
              cl.map(r => [String(r["Created Date"] || "").slice(0, 10), r.Customer,
                           claimReason(r.Reason), r.Status, r.Group,
                           String(r.Responsibility || "").trim(), r.Foreman,
                           r["Request No"], clReviewMatch(r) ? "yes" : "no"]));
          }
        };
      });
      host.querySelectorAll("[data-pg]").forEach(el => {
        el.onclick = () => {
          const [key, dir] = el.dataset.pg.split(":");
          const f = key === "nr" ? "nrPage" : "clPage";
          S[f] += dir === "next" ? 1 : -1;
          paint();
        };
      });
    }

    function mountBar() {
      const bar = host.querySelector("#rvcBar");
      if (!bar) return;
      const wrap = document.createElement("div");
      wrap.className = "rs-fld";
      wrap.innerHTML = "<span>Dates</span>";
      bar.appendChild(wrap);
      if (window.RSC && RSC.dateRange) {
        RSC.dateRange(wrap, {
          get: () => ({ from: S.from, to: S.to }),
          set: (f, t) => { S.from = f; S.to = t; },
          onChange: () => { S.nrPage = S.clPage = 0; paint(); },
        });
      }

      const q = document.createElement("input");
      q.className = "rvc-in"; q.placeholder = "find a customer, reason, platform…";
      q.value = S.q; q.style.flex = "0 1 260px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S.nrPage = S.clPage = 0;
          S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      // the page's own Filters panel at the bar's right end, the "Filtered by" line under the bar.
      // Values from the loaded rows of whichever lists carry the field, the commonest first.
      const tally = (g, v) => { if (v) g[v] = (g[v] || 0) + 1; };
      const vals = k => {
        const g = {};
        nrAll.forEach(r => PF_OF.nr[k] && tally(g, PF_OF.nr[k](r)));
        clAll.forEach(r => PF_OF.cl[k] && tally(g, PF_OF.cl[k](r)));
        if (FLOW) Object.values(FLOW.byPlat).forEach(x => PF_OF.ls[k] && tally(g, PF_OF.ls[k](x)));
        return Object.entries(g).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, l: v, n }));
      };
      const fields = PFK.map(k => ({ key: k, label: PF_NAME[k], values: vals(k) }));
      const selected = {}; PFK.forEach(k => { selected[k] = S[k]; });
      const apply = next => { PFK.forEach(k => { S[k] = new Set(next[k] || []); }); S.nrPage = S.clPage = 0; paint(); };
      if (window.RSC && RSC.filterPanel) {
        const sp = document.createElement("span"); sp.className = "rs-spacer"; bar.appendChild(sp);
        RSC.filterPanel(bar, { fields, selected, onApply: apply, note: PF_NOTE });
        bar.after(RSC.filterChips(null, { fields, selected, onChange: apply }));
      }
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
  },
});
