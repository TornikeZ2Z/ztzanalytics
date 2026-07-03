/* Executive Scorecard — one-screen C-suite view (overnight-audit build E1).
   Anchor month = RS.displayMonth over the FILTERED closing months, which bakes in
   the day-10 rule: before day RS.MIN_MONTH_DAYS the current sliver steps back to
   the last complete month; a partial month old enough to show is tagged "(partial)".
   Sections: (a) anchor-month KPI strip with MoM + same-month-LY chips,
   (b) KPI × 13-month grid with subtle RAG shading vs the trailing-12-month median,
   (c) trailing-12-months vs prior-12 summary with Δ%.
   Every dataset load is guarded with .catch(()=>[]) — a missing ACL renders a
   muted "no access" note instead of crashing the page. */
registerPage({
  id: "executive-scorecard",
  group: "pulse",
  title: "Executive Scorecard",
  async render(host) {
    const M = RS.M, num = RS.num, esc = RSC.esc;

    const fails = {};
    const grab = ds => RS.load(ds).catch(() => { fails[ds] = true; return []; });
    const [closingAll, cardAll, claimsAll, storageAll, refundsAll] = await Promise.all([
      grab("closing"), grab("card_expenses"), grab("claims"), grab("storage"), grab("refunds")]);
    const closing = RS.filtered("closing", closingAll);
    const cards = RS.filtered("card_expenses", cardAll);
    // fct_claims has no Company column, so the company slicer skips it — same
    // claims-over-filtered-jobs semantics as the Claims page (PBI parity).
    const claims = RS.filtered("claims", claimsAll);
    const storage = RS.filtered("storage", storageAll);
    const refunds = RS.filtered("refunds", refundsAll);

    /* ---------- month buckets + anchor month (day-10 rule via RS.displayMonth) ---------- */
    const mkey = r => r._y + "-" + String(r._m).padStart(2, "0");
    const bucket = rows => {
      const g = {};
      rows.forEach(r => { if (r._d) { const k = mkey(r); (g[k] = g[k] || []).push(r); } });
      return g;
    };
    const cB = bucket(closing), eB = bucket(cards), clB = bucket(claims),
          sB = bucket(storage), rB = bucket(refunds);
    const months = Object.keys(cB).sort();
    const dm = RS.displayMonth(months);
    const anchor = dm.key;

    /* Empty state — no dated closing rows (filters or a closing ACL failure). */
    if (!anchor) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Executive Scorecard</h1>
          <p>One-screen company pulse — anchor-month KPIs, 13-month RAG grid, trailing-12 summary</p>
        </div>
        <div class="panel" style="padding:16px 14px;color:var(--muted)">
          ${fails.closing
            ? "No access to the closing dataset — the scorecard cannot be computed for this account."
            : "No closing data for the current filters. Widen the date range or clear a slicer to bring data back."}
        </div>`;
      return;
    }

    const addM = (k, n) => {
      const d = new Date(+k.slice(0, 4), +k.slice(5, 7) - 1 + n, 15);
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    };
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const maxD = closing.reduce((a, r) => ((r._d || "") > a ? r._d : a), "");

    /* Partial anchor: MoM / vs-LY chips compare the SAME first-N-days slice of each
       month (a 12-day July vs a full June is pure noise). Full anchor → full months. */
    const dayCut = dm.partial ? (cB[anchor] || []).reduce((a, r) => Math.max(a, r._day || 0), 0) : null;
    const pick = (B, k, cut) => { const a = B[k] || []; return cut ? a.filter(r => (r._day || 0) <= cut) : a; };
    const setsFor = (k, cut) => ({
      c: pick(cB, k, cut), e: pick(eB, k, cut), cl: pick(clB, k, cut),
      s: pick(sB, k, cut), r: pick(rB, k, cut) });
    const setsWin = win => ({
      c: win.flatMap(k => cB[k] || []), e: win.flatMap(k => eB[k] || []),
      cl: win.flatMap(k => clB[k] || []), s: win.flatMap(k => sB[k] || []),
      r: win.flatMap(k => rB[k] || []) });

    /* Coverage windows (audit F12): months OUTSIDE a dataset's loaded range render
       "—", not a misleading 0 — a month with no claims data is not a zero-claims month. */
    const covOf = rows => { const c = RS.coverage(rows); return { from: c.from ? c.from.slice(0, 7) : null, to: c.to ? c.to.slice(0, 7) : null }; };
    const covC = covOf(closing), covE = covOf(cards), covCl = covOf(claims),
          covS = covOf(storage), covR = covOf(refunds);

    /* Reviews written — cheap read of the closing sheet's raw `Review` column
       (rs-core already requests it). Only shown if the column actually carries
       numeric counts in scope; otherwise the KPI is skipped entirely. */
    const sumReview = rows => rows.reduce((a, r) => a + num(r["Review"]), 0);
    const revwFrom = months.find(k => sumReview(cB[k]) > 0) || null;

    /* ---------- KPI registry: strip KPIs + grid-only rows ----------
       calc(rowsets) gets {c,e,cl,s,r} month/window row slices; inv = cost/risk
       metric (lower is better — chips and RAG shading are inverted). */
    const KPI_STRIP = [
      { id: "rev",  label: "Revenue",                 kind: "money", agg: "sum", cov: covC, calc: rs => M["Revenue"].fn(rs.c) },
      { id: "jobs", label: "Jobs",                    kind: "count", agg: "sum", cov: covC, calc: rs => M["Total Jobs"].fn(rs.c) },
      { id: "cash", label: "Operating Profit Before Commission", kind: "money", agg: "sum", cov: covC, calc: rs => M["Operating Profit Before Commission"].fn(rs.c) },
      { id: "avgb", label: "Avg Bill",                kind: "money", agg: "avg", cov: covC, calc: rs => M["Average Bill"].fn(rs.c) },
      { id: "ads",  label: "Ad Spend",                kind: "money", agg: "sum", inv: true, na: !!fails.card_expenses, cov: covE, calc: rs => Math.abs(M["Advertisement Expense"].fn(rs.e)) },
      { id: "clm",  label: "Claims",                  kind: "count", agg: "sum", inv: true, na: !!fails.claims, cov: covCl, calc: rs => M["Number of Claims"].fn(rs.cl) },
    ];
    if (revwFrom) KPI_STRIP.push(
      { id: "revw", label: "Reviews Written", kind: "count", agg: "sum", cov: { from: revwFrom, to: covC.to }, calc: rs => sumReview(rs.c) });
    const GRID_ONLY = [
      { id: "c100", label: "Claims per 100 Jobs",        kind: "ratio", agg: "ratio", inv: true, na: !!fails.claims, cov: covCl, calc: rs => rs.c.length ? 100 * rs.cl.length / rs.c.length : null },
      { id: "stor", label: "Storage Additional Revenue", kind: "money", agg: "sum", na: !!fails.storage, cov: covS, calc: rs => M["Storage Additional Revenue"].fn(rs.s) },
      { id: "refd", label: "Refund $",                   kind: "money", agg: "sum", inv: true, na: !!fails.refunds, cov: covR, calc: rs => M["Total Refunds"].fn(rs.r) },
    ];
    const ALLK = KPI_STRIP.concat(GRID_ONLY);

    /* Null-safe formatters (RS formatters, per the formatting rule). */
    const fMoney = v => (v == null || isNaN(v)) ? "—" : RS.money(v);
    const fCount = v => (v == null || isNaN(v)) ? "—" : RS.fmtN(v);
    const fmtCell  = k => k.kind === "money" ? RS.moneyC : k.kind === "ratio" ? RS.fmt1 : fCount;   // compact for the 13-col grid
    const fmtStrip = k => k.kind === "money" ? RS.moneyC : k.kind === "ratio" ? RS.fmt1 : fCount;
    const fmtSum   = k => k.kind === "money" ? fMoney   : k.kind === "ratio" ? RS.fmt1 : fCount;    // full precision in the summary

    /* Month value, memoized + coverage-guarded (null = outside loaded data / no access). */
    const memo = {};
    const V = (k, m) => {
      if (k.na || !k.cov.from || m < k.cov.from || m > k.cov.to) return null;
      const ck = k.id + "|" + m;
      if (ck in memo) return memo[ck];
      const v = k.calc(setsFor(m, null));
      return (memo[ck] = (v == null || isNaN(v)) ? null : v);
    };
    /* Same, but sliced to the first dayCut days (partial-anchor chip comparisons). */
    const cutVal = (k, m) => {
      if (k.na || !k.cov.from || m < k.cov.from || m > k.cov.to) return null;
      const v = k.calc(setsFor(m, dayCut));
      return (v == null || isNaN(v)) ? null : v;
    };

    const pctc = (cur, prev) => (cur == null || prev == null || !isFinite(prev) || prev === 0)
      ? null : (cur - prev) / Math.abs(prev);
    const chip = (g, inv, tag) => g == null
      ? `<span style="color:var(--faint)">${tag ? esc(tag) + " " : ""}—</span>`
      : `<span class="${(inv ? g <= 0 : g >= 0) ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}%</span>${tag ? ` <span style="color:var(--faint)">${esc(tag)}</span>` : ""}`;

    /* ---------- (a) KPI strip — anchor month value + MoM + same-month-LY chips.
       Rendered inline (not RSC.kpis) because the subs carry HTML delta chips and
       RSC.kpis escapes the sub field — same markup/classes as the other pages. */
    const kpiHtml = KPI_STRIP.map(k => {
      if (k.na) return `<div class="kpi"><div class="l">${esc(k.label)}</div><div class="v">—</div>` +
        `<div class="s" style="color:var(--muted)">no access to this dataset</div></div>`;
      const cur = V(k, anchor);
      const mom = pctc(cur, cutVal(k, addM(anchor, -1)));
      const ly = pctc(cur, cutVal(k, addM(anchor, -12)));
      return `<div class="kpi"><div class="l">${esc(k.label)}</div>` +
        `<div class="v">${fmtStrip(k)(cur)}</div>` +
        `<div class="s">${chip(mom, k.inv, "MoM")} · ${chip(ly, k.inv, "vs LY")}</div></div>`;
    }).join("");

    /* ---------- (b) KPI × 13-month grid with RAG shading vs trailing-12-mo median.
       Soft color-mix backgrounds (never saturated fills); the partial anchor month
       is left unshaded — a half month vs full-month medians is guaranteed red noise. */
    const gridMonths = [];
    for (let i = -12; i <= 0; i++) gridMonths.push(addM(anchor, i));
    const median = a => {
      const s = a.slice().sort((x, y) => x - y), h = s.length >> 1;
      return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2;
    };
    const ragStyle = (k, m) => {
      if (dm.partial && m === anchor) return "";
      const v = V(k, m);
      if (v == null) return "";
      const hist = [];
      for (let i = 1; i <= 12; i++) { const h = V(k, addM(m, -i)); if (h != null) hist.push(h); }
      if (hist.length < 4) return "";              // too little history → neutral
      const med = median(hist);
      if (!med) return "";                          // zero/NaN median → neutral
      const good = k.inv ? v <= med * 0.95 : v >= med * 1.05;
      const bad  = k.inv ? v >= med * 1.05 : v <= med * 0.95;
      if (good) return "background:color-mix(in srgb, var(--brand) 13%, transparent)";
      if (bad)  return "background:color-mix(in srgb, var(--red) 15%, transparent)";
      return "";
    };
    let grid = `<table class="tab"><thead><tr><th>KPI</th>` +
      gridMonths.map(m => `<th>${esc(mLabel(m))}${dm.partial && m === anchor ? " *" : ""}</th>`).join("") +
      `</tr></thead><tbody>`;
    ALLK.forEach(k => {
      const f = fmtCell(k);
      grid += `<tr><td>${esc(k.label)}${k.inv ? ` <span style="color:var(--faint)" title="cost / risk metric — lower is better">↓</span>` : ""}</td>` +
        gridMonths.map(m => {
          const v = V(k, m);
          return `<td style="${ragStyle(k, m)}">${v == null ? "—" : f(v)}</td>`;
        }).join("") + `</tr>`;
    });
    grid += `</tbody></table>`;

    /* ---------- (c) trailing-12 vs prior-12 summary. A window that starts before
       the dataset's first loaded month renders "—" (never a silently undercounted sum). */
    const t12 = [], p12 = [];
    for (let i = -11; i <= 0; i++) t12.push(addM(anchor, i));
    for (let i = -23; i <= -12; i++) p12.push(addM(anchor, i));
    const AGG_LBL = { sum: "sum", avg: "window avg", ratio: "window ratio" };
    let summ = `<table class="tab"><thead><tr><th>KPI</th><th>Trailing 12 mo</th><th>Prior 12 mo</th><th>Δ%</th></tr></thead><tbody>`;
    ALLK.forEach(k => {
      const f = fmtSum(k);
      const winVal = win => {
        if (k.na || !k.cov.from || k.cov.from > win[0]) return null;
        const v = k.calc(setsWin(win));
        return (v == null || isNaN(v)) ? null : v;
      };
      const tv = winVal(t12), pv = winVal(p12);
      summ += `<tr><td>${esc(k.label)} <span style="color:var(--faint)">(${AGG_LBL[k.agg]})</span></td>` +
        `<td>${tv == null ? "—" : f(tv)}</td><td>${pv == null ? "—" : f(pv)}</td>` +
        `<td>${chip(pctc(tv, pv), k.inv, "")}</td></tr>`;
    });
    summ += `</tbody></table>`;

    /* ---------- assemble ---------- */
    const backNote = dm.steppedBack
      ? `<div class="insight-note">Showing ${esc(mLabel(anchor))} — ${esc(mLabel(months[months.length - 1]))} has under ${RS.MIN_MONTH_DAYS} days of data, so month-anchored cards use the last complete month.</div>`
      : "";
    const failNote = Object.keys(fails).length
      ? `<div class="insight-note" style="color:var(--muted)">No access to: ${esc(Object.keys(fails).join(", "))} — the affected rows render "—" instead of values.</div>`
      : "";
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Executive Scorecard</h1>
        <p>One-screen company pulse · anchor month <b>${esc(mLabel(anchor))}${dm.partial ? " (partial)" : ""}</b>${
          dayCut ? ` · MoM / vs-LY chips compare the first ${dayCut} day${dayCut === 1 ? "" : "s"} of each month` : ""}
          <span class="freshness">· data through ${esc(maxD)} · respects the global filter bar</span></p>
      </div>
      ${backNote}${failNote}
      <div class="rs-kpis">${kpiHtml}</div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">KPI × month — last 13 months</span>
          <span class="spacer"></span>
          <span style="font-size:11px;color:var(--faint)">cell shade vs trailing-12-month median: green = better by ≥5%, red = worse by ≥5% · ↓ rows: lower is better${dm.partial ? " · * partial month (not shaded)" : ""}</span></div>
        <div class="tabwrap">${grid}</div>
      </div>
      <div class="panel" style="margin-top:14px">
        <div class="panel-head"><span class="panel-title">Trailing 12 months vs prior 12</span>
          <span class="spacer"></span>
          <span style="font-size:11px;color:var(--faint)">${esc(mLabel(t12[0]))} – ${esc(mLabel(anchor))} vs ${esc(mLabel(p12[0]))} – ${esc(mLabel(p12[11]))}${dm.partial ? " · trailing window includes the partial anchor month" : ""} · — = window starts before the dataset's first loaded month</span></div>
        <div class="tabwrap">${summ}</div>
      </div>`;
  },
});
