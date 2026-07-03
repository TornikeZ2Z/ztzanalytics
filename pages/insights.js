/* Insights & Recommendations — auto-computed monthly pulse.
   Always renders the CURRENT-MONTH perspective from the full warehouse
   (global filter bar is intentionally NOT applied — noted in the header).
   Everything below is rule-based and computed live; no hand-written numbers. */
registerPage({
  id: "insights",
  group: "pulse",
  title: "Insights & Recommendations",
  async render(host) {
    const [closing, moveboard, scorecard, cardExp, claims, refunds] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("scorecard"),
      RS.load("card_expenses"), RS.load("claims"), RS.load("refunds")]);
    const M = RS.M, num = RS.num;

    /* ---------- empty-state guard: no dated closing rows → friendly message ---------- */
    if (!closing.length || !closing.some(r => r._d)) {
      host.innerHTML = `
        <div class="rs-page-head"><h1>Insights &amp; Recommendations</h1></div>
        <div class="insight-note">No data for the current filters — the closing dataset has no dated rows, so the monthly pulse cannot be computed.</div>`;
      return;
    }

    /* ---------- month helpers (anchored to the freshest closing date) ---------- */
    const maxD = closing.reduce((a, r) => (r._d > a ? r._d : a), "");
    const anchor = new Date(maxD + "T00:00:00");
    const mk = d => d.toISOString().slice(0, 7);                     // "YYYY-MM"
    const CUR = maxD.slice(0, 7);                                    // current month
    const dayOf = +maxD.slice(8, 10);                                // days elapsed
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const prevM = mk(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 15));
    const prev2M = mk(new Date(anchor.getFullYear(), anchor.getMonth() - 2, 15));
    const lyM = (anchor.getFullYear() - 1) + "-" + CUR.slice(5);     // same month LY
    const monthLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(0, 4);
    const inMonth = (rows, m) => rows.filter(r => r._d && r._d.slice(0, 7) === m);
    const mtdOf = (rows, m) => inMonth(rows, m).filter(r => +r._d.slice(8, 10) <= dayOf);
    const pct = (a, b) => (b ? (a - b) / Math.abs(b) : null);
    const chip = (g, inv) => g == null ? "" :
      `<span class="${(inv ? g <= 0 : g >= 0) ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}%</span>`;

    /* ---------- current-month pulse ---------- */
    const curRows = inMonth(closing, CUR);
    const prevMtd = mtdOf(closing, prevM), lyMtd = mtdOf(closing, lyM);
    const bill = M["Revenue"].fn(curRows), jobs = curRows.length;
    const closeRev = M["Total Revenue"].fn(curRows);                 // closings only
    const tripRev = M["Additional Revenue from Trips"].fn(curRows);  // appended trips
    const projBill = dayOf ? bill / dayOf * daysInMonth : null;
    const projJobs = dayOf ? Math.round(jobs / dayOf * daysInMonth) : null;
    const lyFull = M["Revenue"].fn(inMonth(closing, lyM));
    /* Projection gate (audit F10, D5): a linear run-rate off 1–9 days multiplies
       unrepresentative days by 10–31× — pure noise. Before day 10 we blank the
       projection KPI (showing last-month/LY anchors instead), drop its vs-LY chip
       and recommendation rule 7, and tag the kept same-days-vs-LY chips as noisy.
       From day 10 onward everything renders exactly as before. */
    const projGated = dayOf < RS.MIN_MONTH_DAYS;
    const noisyTag = projGated ? ` · first ${dayOf} day${dayOf === 1 ? "" : "s"} — noisy` : "";
    const prevFull = M["Revenue"].fn(inMonth(closing, prevM));   // anchor: last full month

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Insights & Recommendations</h1>
        <p>Auto-generated monthly pulse · data through <b>${maxD}</b> (day ${dayOf} of ${daysInMonth})</p>
      </div>
      <div class="insight-note">This page always shows the current-month perspective across the whole business — the global filter bar does not apply here.</div>
      <div class="rs-kpis" id="kpis"></div>
      <div class="rs-grid2">
        <div class="panel"><div class="panel-head"><span class="panel-title">Recommendations — ${monthLabel(CUR)}</span></div><div id="recs"></div></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">What moved last month (${monthLabel(prevM)} vs ${monthLabel(prev2M)})</span></div><div class="tabwrap" id="movers"></div></div>
      </div>
      <div class="rs-grid2">
        <div class="panel"><div class="panel-head"><span class="panel-title">Foreman pulse — ${monthLabel(prevM)}</span></div><div class="tabwrap" id="foreman"></div></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">Ad efficiency — ${monthLabel(prevM)}</span></div><div class="tabwrap" id="ads"></div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">Data health — closing sheets</span>
          <span style="font-size:11px;color:var(--faint)">hygiene counters over the full closing dataset · data through ${maxD}</span></div>
        <div id="health" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px"></div>
      </div>`;

    /* KPI strip rendered inline (not RSC.kpis) because the subs carry HTML
       delta chips and RSC.kpis escapes the sub field. Same markup/classes. */
    const prevMtdBill = M["Revenue"].fn(prevMtd);
    document.getElementById("kpis").innerHTML = [
      { label: "Jobs — " + monthLabel(CUR), value: RS.fmtN(jobs),
        sub: `vs LY same days: ${RS.fmtN(lyMtd.length)} ` + chip(pct(jobs, lyMtd.length)) + noisyTag,
        wrap: projGated },
      { label: "Revenue MTD", value: RS.moneyC(bill),
        sub: `${RS.money(closeRev)} closings + ${RS.money(tripRev)} trips · vs LY same days ` + chip(pct(bill, M["Revenue"].fn(lyMtd))) + noisyTag,
        wrap: projGated },
      { label: "Pace vs last month", value: RS.moneyC(prevMtdBill),
        sub: `${RS.money(prevMtdBill)} in ${monthLabel(prevM)} by day ${dayOf} ` + chip(pct(bill, prevMtdBill)) },
      { label: "Projected month-end", value: (!projGated && projBill != null) ? RS.moneyC(projBill) : "—",
        sub: projGated
          ? `projection from day ${RS.MIN_MONTH_DAYS} — only ${dayOf} day${dayOf === 1 ? "" : "s"} of data · last month ${RS.money(prevFull)} · LY ${RS.money(lyFull)}`
          : (projBill != null ? `${RS.money(projBill)} · ~${RS.fmtN(projJobs || 0)} jobs at current run-rate` : ""),
        wrap: projGated },
      { label: monthLabel(lyM) + " (full)", value: RS.moneyC(lyFull),
        sub: RS.money(lyFull) + (!projGated && projBill && lyFull ? " · projection " + chip(pct(projBill, lyFull)) + " vs LY" : "") },
    ].map(x =>
      `<div class="kpi"><div class="l">${RSC.esc(x.label)}</div><div class="v">${x.value}</div><div class="s"${x.wrap ? ' style="white-space:normal"' : ""}>${x.sub || ""}</div></div>`
    ).join("");

    /* ---------- recommendations (rule-based, live) ---------- */
    const recs = [];
    const push = (sev, t, d) => recs.push({ sev, t, d });

    // 1. booking-rate move (moveboard, last full month vs the one before)
    const br = m => { const rows = inMonth(moveboard, m);
      return { q: M["Qualified Leads"].fn(rows), r: M["Booking Rate"].fn(rows) }; };
    const brNow = br(prevM), brPrev = br(prev2M);
    if (brNow.r != null && brPrev.r != null) {
      const diff = 100 * (brNow.r - brPrev.r);
      if (diff <= -2) push("high", `Booking rate fell ${Math.abs(diff).toFixed(1)}pp in ${monthLabel(prevM)}`,
        `${(100 * brNow.r).toFixed(1)}% vs ${(100 * brPrev.r).toFixed(1)}% the month before (${RS.fmtN(brNow.q)} qualified leads). Review lead follow-up speed and quote levels.`);
      else if (diff >= 2) push("info", `Booking rate up ${diff.toFixed(1)}pp in ${monthLabel(prevM)}`,
        `${(100 * brNow.r).toFixed(1)}% conversion of qualified leads — whatever changed, keep doing it.`);
    }
    // 2. ad providers with poor ROI last month
    const adsLast = inMonth(cardExp, prevM).filter(r => num(r["Is Advertising"]) === 1);
    const spendBySrc = {};
    adsLast.forEach(r => { const s = r.Source || r.Provider || "—";
      spendBySrc[s] = (spendBySrc[s] || 0) + num(r.Amount); });
    const revBySrc = {};
    inMonth(closing, prevM).forEach(r => { const s = r.Source || "—";
      revBySrc[s] = (revBySrc[s] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); });
    Object.entries(spendBySrc).filter(([s, v]) => v >= 500).forEach(([s, v]) => {
      const roi = (revBySrc[s] || 0) / v;
      if (roi < 1) push("high", `${s}: $${Math.round(v).toLocaleString()} ad spend returned ${roi.toFixed(2)}× last month`,
        `Revenue attributed to '${s}' was ${RS.money(revBySrc[s] || 0)}. Consider reallocating budget or checking source attribution.`);
    });
    // 3. foreman score decline 2 months running
    const scByF = {};
    scorecard.forEach(r => { (scByF[r.Foreman] = scByF[r.Foreman] || {})[r._d ? r._d.slice(0, 7) : ""] = num(r["Forman Score"]); });
    Object.entries(scByF).forEach(([f, mm]) => {
      const a = mm[prevM], b = mm[prev2M], c = mm[mk(new Date(anchor.getFullYear(), anchor.getMonth() - 3, 15))];
      if (a != null && b != null && c != null && a < b && b < c)
        push("med", `${f}: score declining two months in a row`,
          `${c.toFixed(1)} → ${b.toFixed(1)} → ${a.toFixed(1)}. Worth a check-in; components are on the Forman page.`);
    });
    // 4. claims spike vs 6-month average
    const claimMonths = [1, 2, 3, 4, 5, 6].map(i => inMonth(claims, mk(new Date(anchor.getFullYear(), anchor.getMonth() - i, 15))).length);
    const claimAvg = claimMonths.reduce((a, b) => a + b, 0) / 6;
    if (claimAvg > 0 && claimMonths[0] > 1.5 * claimAvg)
      push("high", `Claims spiked in ${monthLabel(prevM)}: ${claimMonths[0]} vs ~${claimAvg.toFixed(1)}/mo average`,
        `Check the Claims page for responsibility split — foreman-fault claims feed the scorecard.`);
    // 5. refunds spike
    const refByM = i => M["Total Refunds"].fn(inMonth(refunds, mk(new Date(anchor.getFullYear(), anchor.getMonth() - i, 15))));
    const refAvg = [1, 2, 3, 4, 5, 6].map(refByM).reduce((a, b) => a + b, 0) / 6;
    if (refAvg > 0 && refByM(1) > 1.5 * refAvg)
      push("med", `Refunds ran hot in ${monthLabel(prevM)}: ${RS.money(refByM(1))}`,
        `~${RS.money(refAvg)} is the 6-month average. The Sales Person page shows commission deductions tied to refunds.`);
    // 6. big source declines MoM (jobs)
    const jobsBySrc = m => { const g = {}; inMonth(closing, m).forEach(r => { const s = r.Source || "—"; g[s] = (g[s] || 0) + 1; }); return g; };
    const jNow = jobsBySrc(prevM), jPrev = jobsBySrc(prev2M);
    Object.keys(jPrev).filter(s => jPrev[s] >= 20).forEach(s => {
      const g = pct(jNow[s] || 0, jPrev[s]);
      if (g != null && g <= -0.3) push("med", `${s} jobs down ${Math.abs(100 * g).toFixed(0)}% month-over-month`,
        `${jPrev[s]} → ${jNow[s] || 0} closed jobs. If spend didn't change, the funnel for this source needs a look.`);
    });
    // 7. pace vs LY (suppressed before day 10 — the projection it reads is gated, F10)
    if (!projGated && projBill != null && lyFull > 0 && projBill < lyFull * 0.95)
      push("med", `${monthLabel(CUR)} is pacing ${(100 * (1 - projBill / lyFull)).toFixed(0)}% below ${monthLabel(lyM)}`,
        `Projected ${RS.money(projBill)} vs ${RS.money(lyFull)} last year. Early-month projections are noisy — watch this after day 10.`);
    if (!recs.length) push("info", "No alerts this month", "All monitored signals (booking rate, ad ROI, foreman scores, claims, refunds, source volumes, revenue pace) are within normal ranges.");
    recs.sort((a, b) => ({ high: 0, med: 1, info: 2 }[a.sev] - { high: 0, med: 1, info: 2 }[b.sev]));
    document.getElementById("recs").innerHTML = recs.slice(0, 10).map(r =>
      `<div class="rec"><span class="sev ${r.sev}"></span><div><div class="t">${RSC.esc(r.t)}</div><div class="d">${RSC.esc(r.d)}</div></div></div>`).join("") +
      (recs.length > 10 ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing 10 of ${recs.length} recommendations</div>` : "");

    /* ---------- movers table (sources by revenue, MoM) ---------- */
    {
      const revNow = {}, revPrev = {};
      inMonth(closing, prevM).forEach(r => { const s = r.Source || "—"; revNow[s] = (revNow[s] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); });
      inMonth(closing, prev2M).forEach(r => { const s = r.Source || "—"; revPrev[s] = (revPrev[s] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); });
      const totalNow = Object.values(revNow).reduce((a, b) => a + b, 0);
      const all = [...new Set([...Object.keys(revNow), ...Object.keys(revPrev)])]
        .map(s => ({ s, now: revNow[s] || 0, prev: revPrev[s] || 0,
          sh: totalNow ? (revNow[s] || 0) / totalNow : null, g: pct(revNow[s] || 0, revPrev[s] || 0) }))
        .filter(x => x.now >= 5000 || x.prev >= 5000)
        .sort((a, b) => Math.abs(b.now - b.prev) - Math.abs(a.now - a.prev));
      const rows = all.slice(0, 12);
      document.getElementById("movers").innerHTML = rows.length ? RSC.table(
        [{ key: "s", label: "Source" },
         { key: "now", label: monthLabel(prevM), fmt: v => v == null ? "—" : RS.money(v) },
         { key: "sh", label: "% of total", fmt: v => v == null ? "—" : RS.fmtPct(v) },
         { key: "prev", label: monthLabel(prev2M), fmt: v => v == null ? "—" : RS.money(v) },
         { key: "g", label: "Δ", fmt: g => g == null ? "—" : chip(g) }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} sources</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No sources cleared the $5k threshold in ${monthLabel(prevM)} or ${monthLabel(prev2M)}.</div>`;
    }
    /* ---------- foreman pulse (last full month leaderboard + delta) ---------- */
    {
      const all = scorecard.filter(r => r._d && r._d.slice(0, 7) === prevM)
        .map(r => ({ f: r.Foreman, sc: num(r["Forman Score"]), rk: num(r["Forman Score Rank"]),
          d: r["Forman Score Prev Month"] == null ? null : num(r["Forman Score"]) - num(r["Forman Score Prev Month"]) }))
        .sort((a, b) => a.rk - b.rk);
      const rows = all.slice(0, 12);
      document.getElementById("foreman").innerHTML = rows.length ? RSC.table(
        [{ key: "rk", label: "#", fmt: v => (v == null || isNaN(v)) ? "—" : v },
         { key: "f", label: "Foreman" },
         { key: "sc", label: "Score", fmt: v => (v == null || isNaN(v)) ? "—" : v.toFixed(1) },
         { key: "d", label: "vs prior", fmt: v => (v == null || isNaN(v)) ? "—" :
           `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)} pts</span>` }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} foremen</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No foreman scorecards recorded for ${monthLabel(prevM)}.</div>`;
    }
    /* ---------- ad efficiency table ---------- */
    {
      const all = Object.entries(spendBySrc).map(([s, v]) => ({
        s, v, rev: revBySrc[s] || 0, roi: v ? (revBySrc[s] || 0) / v : null }))
        .sort((a, b) => b.v - a.v);
      const rows = all.slice(0, 12);
      document.getElementById("ads").innerHTML = rows.length ? RSC.table(
        [{ key: "s", label: "Provider / Source" },
         { key: "v", label: "Ad Spend", fmt: v => v == null ? "—" : RS.money(v) },
         { key: "rev", label: "Attributed Revenue", fmt: v => v == null ? "—" : RS.money(v) },
         { key: "roi", label: "ROI", fmt: v => (v == null || isNaN(v)) ? "—" :
           `<span class="${v >= 3 ? "up" : v < 1 ? "down" : ""}">${v.toFixed(2)}×</span>` }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} providers</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No advertising spend recorded for ${monthLabel(prevM)}.</div>`;
    }
    /* ---------- data health (audit F13) — closing-sheet hygiene counters ----------
       All computed live from the closing dataset already loaded above. Deliberately
       muted styling: these are housekeeping notes, not alerts. */
    {
      const isBlank = v => v == null || v === "";
      // 14-day window ending at maxD; UTC math so the ISO slice never shifts a day
      const cutIso = new Date(Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 13))
        .toISOString().slice(0, 10);
      const awaiting = closing.filter(r => r._d && r._d >= cutIso && isBlank(r["Total Bill"])).length;
      const noForeman = closing.filter(r => isBlank(r.Foreman)).length;
      const noSource = closing.filter(r => isBlank(r.Source));
      const noSourceTrips = noSource.filter(r => r["Record Source"] === "trip").length;
      const undated = closing.filter(r => !r._d).length;
      const counters = [
        { n: awaiting, l: "Awaiting closing entry",
          h: `Jobs since ${cutIso} with no Total Bill yet — fill in the closing sheet so MTD revenue stays complete.` },
        { n: noForeman, l: "Missing foreman",
          h: "Closing rows with no Foreman — assign one so scorecard and claims attribution stay complete." },
        { n: noSource.length, l: "Missing source",
          h: `${RS.fmtN(noSourceTrips)} are structural trip rows (no source axis by design); review the other ${RS.fmtN(noSource.length - noSourceTrips)} in the sheet.` },
        { n: undated, l: "Undated rows",
          h: "Rows with no Date fall out of every month view — add the move date in the sheet." },
      ];
      document.getElementById("health").innerHTML = counters.map(c =>
        `<div style="border:1px solid var(--line);border-radius:11px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--faint)">${RSC.esc(c.l)}</div>
          <div style="font-size:18px;font-weight:800;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums">${RS.fmtN(c.n)}</div>
          <div style="font-size:11px;color:var(--faint);margin-top:3px;line-height:1.45">${RSC.esc(c.h)}</div>
        </div>`).join("");
    }
  },
});
