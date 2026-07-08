/* Lead Source Analysis — a per-source deep dive. One renderer, two registrations:
   "source-analysis" (free source picker) and "movers-analysis" (locked to Movers.com).
   Lives in the "Lead Source Analysis" merged hub next to Angi Analysis + Post Cards.
   Respects the global filter bar (date/company/...); the source picker narrows further. */
async function renderSourceAnalysis(host, lockedSource) {
  const M = RS.M, num = RS.num, money = RS.money, fmtN = RS.fmtN, pct = RS.fmtPct, esc = RSC.esc;
  const [closingAll, mbAll, cardAll] = await Promise.all([
    RS.load("closing"), RS.load("moveboard"), RS.load("card_expenses")]);
  const closing = RS.filtered("closing", closingAll);
  const mb = RS.filtered("moveboard", mbAll);
  // Booked-Date scope for the canonical Booking Rate (RS.bookingRate): confirmed
  // leads are counted by the month they were BOOKED, qualified by lead-create month.
  const mbB = RS.filtered("moveboard", mbAll, { dateColumn: "Booked Date" });
  const ads = RS.filtered("card_expenses", cardAll).filter(r => num(r["Is Advertising"]) === 1);

  const trim = v => String(v == null ? "" : v).trim();
  // source universe ranked by lead volume (closing-only sources appended)
  const cnt = {};
  mb.forEach(r => { const s = trim(r.Source); if (s) cnt[s] = (cnt[s] || 0) + 1000; });
  closing.forEach(r => { const s = trim(r.Source); if (s) cnt[s] = (cnt[s] || 0) + 1; });
  const sources = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
  if (!sources.length) {
    host.innerHTML = `<div class="rs-page-head"><h1>Lead Sources — Overview</h1><p>(formerly Lead Source Analysis) · per-source overview</p></div>
      <div class="panel" style="padding:16px;color:var(--muted)">No data for the current filters.</div>`;
    return;
  }
  const sel = lockedSource || (sources.includes(window.__srcSel) ? window.__srcSel : sources[0]);

  // ---- subsets for the selected source ----
  const mbS = mb.filter(r => trim(r.Source) === sel);
  const mbSB = mbB.filter(r => trim(r.Source) === sel);   // Booked-Date scope
  const clS = closing.filter(r => trim(r.Source) === sel);
  // post-card ad rows are split by state in the ad feed — pool them onto the pooled source name
  const isPC = /post\s*card/i.test(sel);
  const adS = ads.filter(r => isPC ? /post\s*card/i.test(trim(r.Source)) : trim(r.Source) === sel);

  const qual = mbS.filter(r => r["Status Category"] !== "Bad Lead").length;
  const confB = mbSB.filter(r => r["Status Category"] === "Confirmed").length;  // by Booked Date
  const bad = mbS.length - qual;
  const rev = M["Revenue"].fn(clS);
  const jobs = clS.length;
  const adTot = adS.reduce((a, r) => a + num(r.Amount), 0);

  host.innerHTML = `
    <div class="rs-page-head">
      <h1>${esc(lockedSource ? sel + " — Source Analysis" : "Lead Sources — Overview")}</h1>
      <p>${lockedSource ? "everything we track about this source" : "(formerly Lead Source Analysis) · pick any lead source — funnel, revenue, spend and geography update together"}
        ${lockedSource ? "" : `&nbsp;·&nbsp;<select id="srcPick" style="font:inherit;font-weight:700;color:#fff;background:#1b2a3f;border:1px solid #2c3e57;border-radius:7px;padding:4px 9px">${sources.map(s => `<option${s === sel ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>`}
      </p>
    </div>
    <div class="rs-kpis" id="saKpis"></div>
    <div class="rs-grid2" id="saGrid"></div>`;
  if (!lockedSource) {
    const pick = host.querySelector("#srcPick");
    if (pick) pick.onchange = e => { window.__srcSel = e.target.value; renderSourceAnalysis(host, null); };
  }

  RSC.kpis(document.getElementById("saKpis"), [
    { label: "Leads", value: fmtN(mbS.length), sub: `${fmtN(bad)} bad` },
    { label: "Booking Rate", value: (v => v == null ? "—" : pct(v))(RS.bookingRate(mbS, mbSB)),
      sub: `${fmtN(confB)} confirmed (by booked date) of ${fmtN(qual)} qualified (by created date)` },
    { label: "Jobs closed", value: fmtN(jobs), sub: "revenue-attributed closings" },
    { label: "Revenue", value: money(rev), sub: jobs ? money(rev / jobs) + " / job" : "" },
    { label: "Ad spend", value: adTot ? money(adTot) : "—",
      sub: adTot ? "$" + (rev / adTot).toFixed(2) + " revenue per $1 of ads (ROAS)" : "no paid spend recorded" },
    { label: "Revenue per lead", value: mbS.length ? money(rev / mbS.length) : "—", sub: "incl. unconverted leads" },
  ]);

  const grid = document.getElementById("saGrid");
  const ymKey = r => r._y * 100 + r._m;
  // booked-month key: _y/_m always follow Create Date, so the Booked-Date scope
  // needs its own month key read from the raw Booked Date column.
  const bymKey = r => { const d = String(r["Booked Date"] || "").slice(0, 10);
    return /^\d{4}-\d{2}/.test(d) ? (+d.slice(0, 4)) * 100 + (+d.slice(5, 7)) : 0; };
  // canonical monthly Booking Rate (RS.bookingRate): qualified by create month,
  // confirmed by booked month — the portal-official formula (see rs-core).
  const brMonth = k => RS.bookingRate(mbS.filter(r => ymKey(r) === k), mbSB.filter(r => bymKey(r) === k));
  const ymLbl = k => ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][k % 100] + " " + String(Math.floor(k / 100)).slice(2);
  const monthsOf = rowsets => [...new Set(rowsets.flat().map(ymKey).filter(k => k > 0))].sort((a, b) => a - b).slice(-14);
  const CATINK = "#0e1621", CATBLUE = "#3b82f6", CATLIME = "#7ba317", CATAMBER = "#f5a524";

  // 1 · leads vs confirmed by month
  const mts = monthsOf([mbS]);
  RSC.chartCard(grid, { title: "Leads & confirmed — monthly", buildChart(cv) {
    const L = mts.map(k => mbS.filter(r => ymKey(r) === k).length);
    // Confirmed counts by BOOKED month (mbSB/bymKey) — matches the KPI and Booking % basis
    const C = mts.map(k => mbSB.filter(r => bymKey(r) === k && r["Status Category"] === "Confirmed").length);
    return new Chart(cv, { type: "bar", data: { labels: mts.map(ymLbl), datasets: [
      { label: "Leads", data: L, backgroundColor: "#c6d0db", borderRadius: 3 },
      { label: "Confirmed", data: C, backgroundColor: CATINK, borderRadius: 3 } ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } } });
  }, buildTable() {
    return RSC.table([{ key: "m", label: "Month" }, { key: "l", label: "Leads" }, { key: "c", label: "Confirmed" }, { key: "r", label: "Booking %", fmt: v => v == null ? "—" : pct(v) }],
      mts.map(k => { const rs = mbS.filter(r => ymKey(r) === k); const c2 = mbSB.filter(r => bymKey(r) === k && r["Status Category"] === "Confirmed").length; return { m: ymLbl(k), l: rs.length, c: c2, r: brMonth(k) }; }));
  } });

  // 2 · revenue vs ad spend by month
  const mts2 = monthsOf([clS, adS]);
  RSC.chartCard(grid, { title: "Revenue vs ad spend — monthly", buildChart(cv) {
    const RV = mts2.map(k => M["Revenue"].fn(clS.filter(r => ymKey(r) === k)));
    const AD = mts2.map(k => adS.filter(r => ymKey(r) === k).reduce((a, r) => a + num(r.Amount), 0));
    return new Chart(cv, { type: "bar", data: { labels: mts2.map(ymLbl), datasets: [
      { label: "Revenue", data: RV, backgroundColor: CATINK, borderRadius: 3 },
      { label: "Ad spend", data: AD, backgroundColor: CATAMBER, borderRadius: 3 } ] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } } } });
  }, buildTable() {
    return RSC.table([{ key: "m", label: "Month" }, { key: "r", label: "Revenue", fmt: money }, { key: "a", label: "Ad spend", fmt: money }, { key: "roi", label: "Revenue per $1 of ads (ROAS)", fmt: v => v == null ? "—" : "$" + v.toFixed(2) }],
      mts2.map(k => { const r2 = M["Revenue"].fn(clS.filter(r => ymKey(r) === k)); const a2 = adS.filter(r => ymKey(r) === k).reduce((a, r) => a + num(r.Amount), 0); return { m: ymLbl(k), r: r2, a: a2, roi: a2 ? r2 / a2 : null }; }));
  } });

  // 3 · booking-rate trend
  RSC.chartCard(grid, { title: "Booking Rate — monthly", buildChart(cv) {
    const B = mts.map(k => { const v = brMonth(k); return v == null ? null : v * 100; });
    return new Chart(cv, { type: "line", data: { labels: mts.map(ymLbl), datasets: [{ label: "Booking %", data: B, borderColor: CATLIME, backgroundColor: CATLIME, tension: 0, spanGaps: true }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }, buildTable() {
    return RSC.table([{ key: "m", label: "Month" }, { key: "b", label: "Booking %", fmt: v => v == null ? "—" : v.toFixed(1) + "%" }],
      mts.map(k => { const v = brMonth(k); return { m: ymLbl(k), b: v == null ? null : v * 100 }; }));
  } });

  // 4 · revenue by state
  RSC.chartCard(grid, { title: "Revenue by state", buildChart(cv) {
    const g = {}; clS.forEach(r => { const s = trim(r["State Name"]) || "No state"; g[s] = (g[s] || 0) + num(r["Total Bill"]); });
    const rows = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 10);
    return new Chart(cv, { type: "bar", data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]), backgroundColor: CATINK, borderRadius: 3 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }, buildTable() {
    const g = {}; clS.forEach(r => { const s = trim(r["State Name"]) || "No state"; g[s] = (g[s] || 0) + num(r["Total Bill"]); });
    return RSC.table([{ key: "s", label: "State" }, { key: "v", label: "Revenue", fmt: money }],
      Object.entries(g).sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ s, v })));
  } });

  // 5 · leads by size of move
  RSC.chartCard(grid, { title: "Leads by size of move", buildChart(cv) {
    const g = {}; mbS.forEach(r => { const s = trim(r["Size of Move"]) || "—"; g[s] = (g[s] || 0) + 1; });
    const rows = Object.entries(g).filter(r => r[0] !== "—").sort((a, b) => b[1] - a[1]).slice(0, 8);
    return new Chart(cv, { type: "bar", data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]), backgroundColor: CATBLUE, borderRadius: 3 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }, buildTable() {
    const g = {}; mbS.forEach(r => { const s = trim(r["Size of Move"]) || "—"; g[s] = (g[s] || 0) + 1; });
    return RSC.table([{ key: "s", label: "Size" }, { key: "v", label: "Leads", fmt: fmtN }],
      Object.entries(g).sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ s, v })));
  } });

  // 6 · bad-lead reasons for this source
  RSC.chartCard(grid, { title: "Bad leads by reason", buildChart(cv) {
    const g = {}; mbS.forEach(r => { if (r["Status Category"] !== "Bad Lead") return; const s = trim(r.Status) || "—"; g[s] = (g[s] || 0) + 1; });
    const rows = Object.entries(g).sort((a, b) => b[1] - a[1]).slice(0, 8);
    return new Chart(cv, { type: "bar", data: { labels: rows.map(r => r[0]), datasets: [{ data: rows.map(r => r[1]), backgroundColor: "#e5484d", borderRadius: 3 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
  }, buildTable() {
    const g = {}; mbS.forEach(r => { if (r["Status Category"] !== "Bad Lead") return; const s = trim(r.Status) || "—"; g[s] = (g[s] || 0) + 1; });
    return RSC.table([{ key: "s", label: "Reason" }, { key: "v", label: "Bad leads", fmt: fmtN }],
      Object.entries(g).sort((a, b) => b[1] - a[1]).map(([s, v]) => ({ s, v })));
  } });
}

registerPage({ id: "source-analysis", group: "marketing", title: "Source Overview",
  render(host) { return renderSourceAnalysis(host, null); } });
registerPage({ id: "movers-analysis", group: "marketing", title: "Movers.com",
  render(host) { return renderSourceAnalysis(host, "Movers.com"); } });
