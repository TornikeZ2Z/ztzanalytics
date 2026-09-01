/* REVIEWS ▸ Claims & Negative Reviews — Tako's tickets #510 + #512 (2026-08-31), as a page
 * instead of a one-off export: which platforms the bad reviews land on, what the claims are
 * actually about, and how much the two boards overlap.
 *
 * BOTH BOARDS ALREADY LIVE IN THE WAREHOUSE (the Monday boards load via sheets):
 * fct_negative_reviews (307 all-time) and fct_claims (888 all-time). No new pipeline.
 *
 * THREE DATA TRUTHS THIS PAGE MUST NOT HIDE:
 *  1. 93 of 307 negative reviews have NO Written Date — every one of them Group='Removed'.
 *     A year filter silently drops them, so the page says so out loud instead.
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
    if (!RS.DATASETS.claims_cases) {
      RS.DATASETS.claims_cases = {
        table: "fct_claims",
        cols: ["Created Date", "Customer", "Request No", "Group", "Status", "Reason",
               "Responsibility", "Request Joinkey", "Foreman"],
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
    const esc = RS.esc || (s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";

    if (!document.getElementById("rvc-style")) {
      const st = document.createElement("style");
      st.id = "rvc-style";
      st.textContent = [
        // Only what the kit cannot say; everything else is .panel/.rs-kpis/.rs-table/.rs-seg.
        ".rvc-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}",
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
        ".rvc-stars{color:var(--warn);letter-spacing:1px}",
        // 1fr grid columns default to min-width:auto — a table inside forces the column
        // wider than the viewport (the classic grid blowout; measured 2385px vs 2048).
        ".rvc-grid>.panel{min-width:0}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Claims &amp; Negative Reviews</h1></div>
      <div class="rs-loading" style="padding:22px">Reading both boards…</div>`;

    const [nrAll, clAll] = await Promise.all([
      RS.load("negative_reviews_cases"), RS.load("claims_cases")]);

    /* ---------- canonicalisation (the audit's map, verbatim) ---------- */
    const PLATFORM = (raw) => {
      const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");
      if (!s) return "Unlabeled";
      if (s.startsWith("google")) return "Google";           // Nj/Pa/Shafto/Sahfto/Tuji/Local…
      if (s.includes("yelp")) return "Yelp";
      if (s.startsWith("thumbtack")) return "Thumbtack";
      if (s === "consumer affairs" || s === "concumer affairs") return "Consumer Affairs";
      if (s === "trustpilot" || s === "truspilot") return "Trustpilot";
      if (s === "bbb") return "BBB";
      if (s === "meta") return "Meta";
      if (s === "angi") return "Angi";
      if (s === "birdeye") return "Birdeye";
      if (s === "moveadvisor") return "MoveAdvisor";
      if (s === "reddit") return "Reddit";
      // a government complaint body is not a review platform — kept distinct, never BBB
      if (s.includes("bureau of consumer protection")) return "Regulatory";
      return "Other";
    };
    // emoji-star varchar → number. The one '⭐️⭐️, ⭐️' combo takes its FIRST value.
    const stars = (raw) => {
      const s = String(raw == null ? "" : raw).trim();
      if (!s) return { kind: "unrated", n: null };
      if (/complaint/i.test(s)) return { kind: "complaint", n: null };
      const first = s.split(",")[0];
      const n = (first.match(/⭐/g) || []).length;
      return n ? { kind: "stars", n } : { kind: "unrated", n: null };
    };
    const claimReason = (raw) => {
      const s = String(raw || "").trim();
      if (!s) return "Unspecified";
      if (/^tip \+ increased price$/i.test(s)) return "TIP + Increased Price";
      return s;
    };

    const years = [...new Set(
      nrAll.map(r => String(r["Written Date"] || "").slice(0, 4))
        .concat(clAll.map(r => String(r["Created Date"] || "").slice(0, 4)))
        .filter(y => /^\d{4}$/.test(y)))].sort();

    const S = { year: years.includes("2026") ? "2026" : (years[years.length - 1] || ""),
                q: "", nrPage: 0, clPage: 0, pageSize: 25 };
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
    const clReviewMatch = r => {
      const jk = String(r["Request Joinkey"] || "").trim();
      if (jk && nrByJoin.has(jk)) return "joinkey";
      const nm = String(r.Customer || "").trim().toLowerCase();
      if (nm && nrByName.has(nm)) return "name";
      return null;
    };

    paint();

    function inYear(dateStr) {
      if (!S.year) return true;
      return String(dateStr || "").slice(0, 4) === S.year;
    }
    function rows() {
      const q = S.q.trim().toLowerCase();
      const hit = (r, fields) => !q ||
        fields.some(f => String(r[f] || "").toLowerCase().includes(q));
      return {
        nr: nrAll.filter(r => inYear(r["Written Date"])
          && hit(r, ["Customer", "Source", "Status", "Case Owner", "Request No"])),
        cl: clAll.filter(r => inYear(r["Created Date"])
          && hit(r, ["Customer", "Reason", "Status", "Responsibility", "Foreman", "Request No"])),
        // the undated-removed bucket a year filter silently drops — surfaced, not hidden
        nrUndated: S.year ? nrAll.filter(r => !String(r["Written Date"] || "").trim()).length : 0,
      };
    }

    function shareRows(counts, total, cls) {
      const max = Math.max(1, ...counts.map(c => c[1]));
      return counts.map(([label, n, extra]) => `
        <div class="rvc-share ${cls || ""}" title="${esc(label)}${extra ? " · " + esc(extra) : ""}">
          <span class="n">${esc(label)}</span>
          <span class="t"><i style="width:${n / max * 100}%"></i></span>
          <span class="v">${fmtN(n)} · ${pct(n, total)}${extra ? " · " + esc(extra) : ""}</span>
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
      const yearLabel = S.year || "all years";

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
             as fallback.</p></div>

        <div class="rvc-bar" id="rvcBar"></div>

        <div class="rs-kpis" style="--kpi-cols:6">
          ${kpi("Negative reviews", fmtN(nr.length), yearLabel +
            (nrUndated ? " · +" + fmtN(nrUndated) + " undated (removed, outside any year)" : ""))}
          ${kpi("Still open", fmtN(nr.filter(r => String(r.Group).trim() === "Open").length),
            "the rest are removed / closed", "warn")}
          ${kpi("Claims", fmtN(cl.length), yearLabel)}
          ${kpi("Claims with a reason", pct(cl.filter(r =>
              String(r.Reason || "").trim()).length, cl.length),
            fmtN(cl.filter(r => !String(r.Reason || "").trim()).length) + " unspecified")}
          ${kpi("Reviews from claimants", pct(nrMatched.length, nr.length),
            fmtN(nrMatched.length) + " of " + fmtN(nr.length) + " ever filed a claim", "warn")}
          ${kpi("Claims that turned public", pct(clMatched.length, cl.length),
            fmtN(clMatched.length) + " have a negative review")}
        </div>

        <div class="rs-grid2 rvc-grid">
          <div class="panel">
            <div class="panel-head"><div class="panel-title">Where they complain</div>
              <div class="rs-spacer"></div><span class="rs-pill">${fmtN(nr.length)} reviews</span></div>
            ${nr.length ? shareRows(platRows, nr.length) :
              '<p class="rs-hint">No negative reviews in this window.</p>'}
            <div class="rvc-note">Platform families fold the per-state pages together
              (Google Nj/Pa/Shafto… → Google). The raw label is on every case below.
              Blank sources read as Unlabeled.</div>
          </div>

          <div class="panel">
            <div class="panel-head"><div class="panel-title">Why they claim</div>
              <div class="rs-spacer"></div><span class="rs-pill">${fmtN(cl.length)} claims</span></div>
            ${cl.length ? shareRows(reasonRows, cl.length, "warn") :
              '<p class="rs-hint">No claims in this window.</p>'}
            <div class="rvc-note">Unspecified is shown as its own slice on purpose — hiding it
              would overstate every named reason.</div>
          </div>
        </div>

        <div class="rs-grid2 rvc-grid">
          <div class="panel">
            <div class="panel-head"><div class="panel-title">The overlap</div></div>
            <p class="rs-hint" style="max-width:64ch">
              <b>${pct(nrMatched.length, nr.length)}</b> of ${yearLabel}'s negative reviews
              (${fmtN(nrMatched.length)} of ${fmtN(nr.length)}) were written by customers who
              filed a claim at any point — an unresolved claim is the best predictor of a
              public one-star. The other direction stays small:
              <b>${pct(clMatched.length, cl.length)}</b> of claims
              (${fmtN(clMatched.length)} of ${fmtN(cl.length)}) have gone public so far.</p>
            ${nrMatched.length ? `<div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Customer</th><th>Platform</th><th>Review</th>
                <th>Claim reason</th><th>Matched by</th></tr></thead>
              <tbody>${nrMatched.slice(0, 30).map(({ r, m }) => {
                const jk = String(r["Request Joinkey"] || "").trim();
                const nm = String(r.Customer || "").trim().toLowerCase();
                const claim = (m === "joinkey" ? clByJoin.get(jk) : clByName.get(nm))[0];
                return `<tr><td class="strong">${esc(r.Customer || "—")}</td>
                  <td>${esc(PLATFORM(r.Source))}</td>
                  <td>${starCell(r)}</td>
                  <td>${esc(claimReason(claim.Reason))}</td>
                  <td class="muted">${m === "joinkey" ? "request" : "name"}</td></tr>`;
              }).join("")}</tbody></table></div>
              ${nrMatched.length > 30 ? `<div class="rvc-note">Showing 30 of ${fmtN(nrMatched.length)}.</div>` : ""}`
              : ""}
          </div>

          <div class="panel">
            <div class="panel-head"><div class="panel-title">Whose fault, per the board</div></div>
            ${cl.length ? shareRows(respRows.map(([k, n]) => [k, n, ""]), cl.length, "warn") : ""}
            <div class="rvc-note">Not attributed dominates — the board's Responsibility column
              is filled on roughly a quarter of claims. Worth an ask to the claims owner if
              this cut matters.</div>
          </div>
        </div>

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Negative reviews — the cases</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(nr.length)}</span></div>
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

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Claims — the cases</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(cl.length)}</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Created</th><th>Customer</th><th>Reason</th><th>Status</th>
              <th>Responsibility</th><th>Foreman</th><th>Went public</th></tr></thead>
            <tbody>${clPageRows.map(r => `<tr>
              <td class="nowrap">${esc(String(r["Created Date"] || "").slice(0, 10) || "—")}</td>
              <td class="strong">${esc(r.Customer || "—")}</td>
              <td>${esc(claimReason(r.Reason))}</td>
              <td>${esc(r.Status || "—")}</td>
              <td class="muted">${esc(String(r.Responsibility || "").trim() || "—")}</td>
              <td class="muted">${esc(r.Foreman || "—")}</td>
              <td>${clReviewMatch(r)
                ? '<span class="rs-pill warn">yes</span>'
                : '<span class="rs-pill mute">no</span>'}</td></tr>`).join("")}
            </tbody></table></div>
          ${pager(S.clPage, cl.length, "cl")}
        </div>`;

      mountBar();
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
      const seg = document.createElement("div");
      seg.className = "rs-seg";
      years.slice(-3).concat([""]).forEach(y => {
        const b = document.createElement("button");
        b.textContent = y || "All years";
        if (S.year === y) b.className = "on";
        b.onclick = () => { if (S.year !== y) { S.year = y; S.nrPage = S.clPage = 0; paint(); } };
        seg.appendChild(b);
      });
      const wrap = document.createElement("div");
      wrap.className = "rs-fld";
      wrap.innerHTML = "<span>Year</span>";
      wrap.appendChild(seg);
      bar.appendChild(wrap);

      const q = document.createElement("input");
      q.className = "rvc-in"; q.placeholder = "find a customer, reason, platform…";
      q.value = S.q; q.style.flex = "0 1 260px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S.nrPage = S.clPage = 0;
          S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }
  },
});
