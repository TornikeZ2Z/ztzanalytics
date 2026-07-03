/* CX page: Customer Experience — cost-of-quality scorecard. Portal-original
   (audit 2026-07-03 E12/E15 direction): claims + refunds + negative reviews +
   satisfaction pulled into one quality lens over the filtered closing scope.
   Joins: rollup via closing request membership (claims.js pattern, F5-safe
   case-insensitive keys); refunds→foreman via the refunds Foreman column
   (normalized: case/word-order-insensitive — the sheet writes 'Kirvalidze
   Giorgi' for closing's 'Giorgi Kirvalidze') with a Request-Joinkey fallback
   to the closing foreman when the free-text name matches nobody ('Jonny',
   'Goga/Lekso', …); claims + negative reviews→foreman via Request Joinkey only
   (they carry no foreman column). F2 guard: refunds holds future-dated rows
   (known year-2925 sheet typo) — kept in totals, excluded from the monthly
   chart and the coverage footnote, called out explicitly. */
registerPage({
  id: "customer-experience",
  group: "customers",
  title: "Customer Experience",
  async render(host) {
    const [closingAll, claimsAll, refundsAll, negAll, rollupAll] = await Promise.all([
      RS.load("closing").catch(() => []),
      RS.load("claims").catch(() => []),
      RS.load("refunds").catch(() => []),
      RS.load("negative_reviews").catch(() => []),
      RS.load("rollup").catch(() => []),
    ]);
    const closingRows = RS.filtered("closing", closingAll);
    const claimRows = RS.filtered("claims", claimsAll);
    const refundRows = RS.filtered("refunds", refundsAll);
    const negRows = RS.filtered("negative_reviews", negAll);
    const M = RS.M;

    /* Empty state — nothing survived the filters. */
    if (!closingRows.length && !claimRows.length && !refundRows.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Customer Experience</h1>
          <p>Cost-of-quality scorecard: claims, refunds, negative reviews, satisfaction</p>
        </div>
        <div class="panel">
          <div class="panel-head"><span class="panel-title">No data for the current filters</span></div>
          <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">
            No jobs, claims or refunds match the current slicer / date selection. Widen the date range or clear a filter to bring data back.</div>
        </div>`;
      return;
    }

    /* Case-insensitive request keys (audit F5: joinkey casing differs across tables). */
    const jkey = v => (v == null ? v : String(v).toLowerCase());

    /* ---------------- headline scope numbers ---------------- */
    const totalJobs = M["Total Jobs"].fn(closingRows);
    const revenue = M["Revenue"].fn(closingRows);
    const nClaims = M["Number of Claims"].fn(claimRows);
    const nNeg = M["Number of Negative Reviews"].fn(negRows);
    const totalRefund = M["Total Refunds"].fn(refundRows);
    const nRefunds = refundRows.length;

    /* rollup_support has NO date column — never RS.filtered. Time-slice via
       membership: request keys from the FILTERED closing rows (claims.js pattern). */
    const closingKeys = new Set(closingRows.map(r => r["Request Joinkey"]).filter(Boolean).map(jkey));
    let amtRefundedRollup = 0, amtRefundedNR = 0;
    rollupAll.forEach(r => {
      if (!closingKeys.has(jkey(r["Request Joinkey"]))) return;
      amtRefundedRollup += RS.num(r["Amount Refunded"]);
      amtRefundedNR += RS.num(r["Amount Refunded Because of Negative Reviews"]);
    });

    /* Avg Satisfaction Score — closing rows WHERE the field is present (0–10 scale;
       ~2.6k jobs carry no score and must not drag the average toward 0). */
    let satSum = 0, satN = 0;
    closingRows.forEach(r => {
      const v = r["Satisfaction Score"];
      if (v == null || String(v).trim() === "") return;
      satSum += RS.num(v); satN++;
    });
    const satAvg = satN ? satSum / satN : null;

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Customer Experience</h1>
        <p>Cost-of-quality scorecard: claims, refunds, negative reviews, satisfaction ·
           <b>${RS.fmtN(totalJobs)}</b> jobs in scope
           <span class="freshness">· rollup amounts joined via request membership · refunds read the fct_refunds ledger</span></p>
      </div>
      <div class="rs-kpis" id="cxKpis"></div>
      <div id="cxMain"></div>
      <div id="cxForeman"></div>
      <div id="cxFoot"></div>`;

    RSC.kpis(document.getElementById("cxKpis"), [
      { label: "Claims per 100 Jobs", value: RS.fmt1(totalJobs ? 100 * nClaims / totalJobs : null),
        sub: `${RS.fmtN(nClaims)} claims vs ${RS.fmtN(totalJobs)} jobs` },
      { label: "Refund $", value: RS.moneyC(totalRefund),
        sub: `${RS.money(totalRefund)} · ${RS.fmtN(nRefunds)} refunds (fct_refunds)` },
      { label: "Refund % of Revenue", value: RS.fmtPct(revenue ? totalRefund / revenue : null),
        sub: `vs ${RS.moneyC(revenue)} revenue in scope` },
      { label: "Negative Reviews per 100 Jobs", value: RS.fmt1(totalJobs ? 100 * nNeg / totalJobs : null),
        sub: `${RS.fmtN(nNeg)} negative reviews` },
      { label: "Refunded for Neg. Reviews", value: RS.moneyC(amtRefundedNR),
        sub: `${RS.money(amtRefundedNR)} · ${RS.fmtPct(amtRefundedRollup ? amtRefundedNR / amtRefundedRollup : null)} of rollup refunds` },
      { label: "Avg Satisfaction Score", value: RS.fmt1(satAvg),
        sub: `0–10 scale · ${RS.fmtN(satN)} of ${RS.fmtN(totalJobs)} jobs scored` },
    ]);

    /* ---------------- month buckets (skip undated rows) ---------------- */
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const now = new Date();
    const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const jobsByMonth = {}, revByMonth = {}, claimsByMonth = {}, refByMonth = {};
    closingRows.forEach(r => {
      if (!r._d) return;
      const k = mk(r);
      jobsByMonth[k] = (jobsByMonth[k] || 0) + 1;
      revByMonth[k] = (revByMonth[k] || 0) + RS.num(r["Total Bill"]) + RS.num(r["Extra Bill From Trips"]);
    });
    claimRows.forEach(r => { if (r._d) { const k = mk(r); claimsByMonth[k] = (claimsByMonth[k] || 0) + 1; } });
    refundRows.forEach(r => { if (r._d) { const k = mk(r); refByMonth[k] = (refByMonth[k] || 0) + RS.num(r["Total refund"]); } });
    const months = [...new Set([].concat(
      Object.keys(jobsByMonth), Object.keys(claimsByMonth), Object.keys(refByMonth)))].sort();
    // F2 guard: future-dated refund months (year-2925 sheet typo) poison a
    // "last 24 months" slice — chart shows sane months only; the tabular view
    // keeps every month (flagged) so the totals still tie to the KPIs.
    const saneMonths = months.filter(k => k <= curKey);
    const futureMonths = months.filter(k => k > curKey);
    const per100Of = k => jobsByMonth[k] ? 100 * (claimsByMonth[k] || 0) / jobsByMonth[k] : null;

    /* ---------------- main: cost of quality by month ---------------- */
    RSC.chartCard(document.getElementById("cxMain"), {
      title: "Cost of quality by month",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">bars: refund $ · line: claims per 100 jobs · last 24 mo</span>`,
      buildChart(canvas) {
        const shown = saneMonths.slice(-24);
        return new Chart(canvas, {
          data: {
            labels: shown.map(mLabel),
            datasets: [
              { type: "bar", label: "Refund $", yAxisID: "y",
                data: shown.map(k => refByMonth[k] || 0),
                backgroundColor: "#f87171", borderRadius: 4, order: 2 },
              { type: "line", label: "Claims per 100 Jobs", yAxisID: "y1",
                data: shown.map(per100Of),
                borderColor: "#b7e23b", backgroundColor: "#b7e23b",
                borderWidth: 2, pointRadius: 2, tension: .3, spanGaps: true, order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => c.dataset.yAxisID === "y1"
                ? `${c.dataset.label}: ${RS.fmt1(c.raw)}`
                : `${c.dataset.label}: ${RS.money(c.raw)}` } },
            },
            scales: {
              y: { beginAtZero: true, ticks: { callback: v => RS.moneyC(v) } },
              y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        const data = months.map(k => ({
          m: k > curKey
            ? `${RS.monthName(+k.slice(5))} ${k.slice(0, 4)} <span style="color:var(--red)">(future-dated — F2 typo)</span>`
            : mLabel(k),
          jobs: jobsByMonth[k] || 0,
          c: claimsByMonth[k] || 0,
          per100: per100Of(k),
          ref: refByMonth[k] || 0,
          refPct: revByMonth[k] ? (refByMonth[k] || 0) / revByMonth[k] : null,
        }));
        return RSC.table(
          [{ key: "m", label: "Month", fmt: v => v },   // pre-escaped (future-dated flag is HTML)
           { key: "jobs", label: "Total Jobs", fmt: RS.fmtN },
           { key: "c", label: "Claims", fmt: RS.fmtN },
           { key: "per100", label: "Claims / 100 Jobs", fmt: RS.fmt1 },
           { key: "ref", label: "Refund $", fmt: RS.money },
           { key: "refPct", label: "Refund % of Revenue", fmt: RS.fmtPct }],
          data,
          { m: "Total", jobs: totalJobs, c: nClaims,
            per100: totalJobs ? 100 * nClaims / totalJobs : null,
            ref: totalRefund, refPct: revenue ? totalRefund / revenue : null });
      },
    });

    /* ---------------- by foreman: cost of quality ----------------
       Grain = closing foremen (jobs denominator). Attribution:
       claims / negative reviews → closing foreman via Request Joinkey;
       refunds → normalized refunds-Foreman name first, joinkey fallback. */
    const fnorm = v => String(v == null ? "" : v).trim().replace(/\s+/g, " ");
    const fkeyOf = v => {
      const s = fnorm(v).toLowerCase();
      return s ? s.split(" ").sort().join(" ") : "";   // word-order-insensitive
    };
    const groups = new Map();   // fkey -> { jobs, raws, claims, ref, neg }
    closingRows.forEach(r => {
      const k = fkeyOf(r.Foreman) || "—";
      let g = groups.get(k);
      if (!g) groups.set(k, g = { key: k, jobs: 0, raws: new Map(), claims: 0, ref: 0, neg: 0 });
      g.jobs++;
      const raw = fnorm(r.Foreman) || "—";
      g.raws.set(raw, (g.raws.get(raw) || 0) + 1);
    });
    const reqForeman = new Map();   // request jkey -> closing foreman fkey (first wins)
    closingRows.forEach(r => {
      const k = jkey(r["Request Joinkey"]);
      if (k && !reqForeman.has(k)) reqForeman.set(k, fkeyOf(r.Foreman) || "—");
    });
    let claimsMatched = 0, negMatched = 0;
    claimRows.forEach(r => {
      const g = groups.get(reqForeman.get(jkey(r["Request Joinkey"])));
      if (g) { g.claims++; claimsMatched++; }
    });
    negRows.forEach(r => {
      const g = groups.get(reqForeman.get(jkey(r["Request Joinkey"])));
      if (g) { g.neg++; negMatched++; }
    });
    let refByName = 0, refByJoin = 0, refUnattr = 0;
    refundRows.forEach(r => {
      const amt = RS.num(r["Total refund"]);
      const nk = fkeyOf(r.Foreman);
      let g = nk ? groups.get(nk) : null;
      if (g) { g.ref += amt; refByName += amt; return; }
      g = groups.get(reqForeman.get(jkey(r["Request Joinkey"])));
      if (g) { g.ref += amt; refByJoin += amt; return; }
      refUnattr += amt;
    });

    const MIN_JOBS = 50;
    const withDisp = [...groups.values()].map(g => {
      let disp = "—", best = -1;
      g.raws.forEach((n, raw) => { if (n > best) { best = n; disp = raw; } });
      return { disp, jobs: g.jobs, claims: g.claims, ref: g.ref, neg: g.neg };
    });
    const qual = withDisp.filter(g => g.jobs >= MIN_JOBS)
      .sort((a, b) => (100 * b.ref / b.jobs) - (100 * a.ref / a.jobs) ||
                      (100 * b.claims / b.jobs) - (100 * a.claims / a.jobs));
    const small = withDisp.filter(g => g.jobs < MIN_JOBS);
    // Residual row: sub-threshold foremen + everything that could not be
    // attributed to a closing foreman — keeps the Total tied to the KPIs.
    const rest = {
      disp: `All others (${RS.fmtN(small.length)} foremen under ${MIN_JOBS} jobs + unattributed)`,
      jobs: small.reduce((a, g) => a + g.jobs, 0),
      claims: small.reduce((a, g) => a + g.claims, 0) + (nClaims - claimsMatched),
      ref: small.reduce((a, g) => a + g.ref, 0) + refUnattr,
      neg: small.reduce((a, g) => a + g.neg, 0) + (nNeg - negMatched),
    };
    const rowOf = (g, muted) => ({
      f: muted ? `<span style="color:var(--muted)">${RSC.esc(g.disp)}</span>` : RSC.esc(g.disp),
      jobs: g.jobs, c: g.claims,
      per100: g.jobs ? 100 * g.claims / g.jobs : null,
      ref: g.ref, neg: g.neg,
      refPer100: g.jobs ? 100 * g.ref / g.jobs : null,
    });
    const fmPanel = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">By foreman — cost of quality</span>
         <span class="rs-ctl"><span class="lbl">worst first (refund $ per 100 jobs) · min ${MIN_JOBS} jobs to qualify</span></span>
         <span class="spacer"></span>
         <span class="rs-ctl"><span class="lbl">${RS.fmtN(qual.length)} foremen qualify</span></span></div>
       <div class="tabwrap"></div>`);
    document.getElementById("cxForeman").appendChild(fmPanel);
    fmPanel.querySelector(".tabwrap").innerHTML = RSC.table(
      [{ key: "f", label: "Foreman", fmt: v => v },   // pre-escaped in rowOf
       { key: "jobs", label: "Jobs", fmt: RS.fmtN },
       { key: "c", label: "Claims", fmt: RS.fmtN },
       { key: "per100", label: "Claims / 100 Jobs", fmt: RS.fmt1 },
       { key: "ref", label: "Refund $", fmt: RS.money },
       { key: "neg", label: "Neg. Reviews", fmt: RS.fmtN },
       { key: "refPer100", label: "Refund $ / 100 Jobs", fmt: RS.money }],
      qual.map(g => rowOf(g, false)).concat([rowOf(rest, true)]),
      { f: "Total", jobs: totalJobs, c: nClaims,
        per100: totalJobs ? 100 * nClaims / totalJobs : null,
        ref: totalRefund, neg: nNeg,
        refPer100: totalJobs ? 100 * totalRefund / totalJobs : null });

    /* ---------------- coverage + methodology footnote (audit F12 / F2) ---------------- */
    const todayIso = now.toISOString().slice(0, 10);
    const sane = rows => rows.filter(r => r._d && r._d <= todayIso);
    const covSpan = cov => (cov.from || "?") + " → " + (cov.to || "?");
    const covClaims = RS.coverage(sane(claimsAll));
    const covRefunds = RS.coverage(sane(refundsAll));
    const covNeg = RS.coverage(sane(negAll));
    const futureRefunds = refundsAll.filter(r => r._d && r._d > todayIso).length;
    document.getElementById("cxFoot").innerHTML = `
      <div style="padding:10px 4px 2px;color:var(--muted);font-size:12px;line-height:1.7">
        Coverage: claims ${covSpan(covClaims)} · refunds ${covSpan(covRefunds)} · negative reviews ${covSpan(covNeg)}
        — per-100-jobs rates before each ledger starts read as zero cost, not clean months.
        ${futureRefunds ? `${RS.fmtN(futureRefunds)} future-dated refund row(s) (incl. the known year-2925 sheet typo, audit F2)
        stay in the totals but are excluded from the monthly chart and this coverage line.` : ``}
        ${futureMonths.length ? `Future-dated months are flagged in the tabular view.` : ``}<br>
        Refund $ reads the fct_refunds ledger (${RS.money(totalRefund)}); the Claims page's "Amount Refunded"
        reads the support rollup over closing requests (${RS.money(amtRefundedRollup)} in this scope) —
        the rollup misses refunds on requests that never reached a closing sheet, so the two differ by design.
        Refund attribution: ${RS.money(refByName)} matched by the refunds Foreman column (name normalized),
        ${RS.money(refByJoin)} by Request-Joinkey fallback to the closing foreman, ${RS.money(refUnattr)} unattributed.
      </div>`;
  },
});
