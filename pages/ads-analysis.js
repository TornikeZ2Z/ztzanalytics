/* GO page: Ads Analysis — advertisement spend, funnel and ROI by source.
   PBI source: General Overview "Ads Analysis" (05-dashboards.md GO-5) + the
   ROI-by-source idea from GO-15 "YoY Diff". Closing revenue and moveboard leads
   are matched to advertising card-expense rows by Source (case/space-insensitive)
   — the client-side equivalent of the PBI Source relationships. */
registerPage({
  id: "ads-analysis",
  group: "sales",
  title: "Ads Analysis",
  async render(host) {
    const [cardAll, closingAll, moveboardAll] = await Promise.all([
      RS.load("card_expenses"), RS.load("closing"), RS.load("moveboard")]);
    const cards = RS.filtered("card_expenses", cardAll);
    const closing = RS.filtered("closing", closingAll);
    // moveboard default date = Create Date → matches PBI "Total Leads by Created Date"
    const moveboard = RS.filtered("moveboard", moveboardAll);
    const M = RS.M;

    // ---- the ad-source universe: Source values on advertising transactions
    const adRows = cards.filter(r => RS.num(r["Is Advertising"]) === 1);
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    const adSources = new Map();               // norm key → display casing
    adRows.forEach(r => {
      const k = norm(r.Source);
      if (k && !adSources.has(k)) adSources.set(k, String(r.Source).trim());
    });

    // ---- empty state: nothing to chart when the filters remove every ad transaction
    if (!adRows.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Marketing — Ad Spend & Returns</h1>
          <p>Advertisement spend, funnel and returns (formerly "Ads Analysis")</p>
        </div>
        <div class="panel" style="padding:16px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    // ---- membership joins (Source): closing / moveboard rows on ad sources
    const closingAds = closing.filter(r => adSources.has(norm(r.Source)));
    const mbAds = moveboard.filter(r => adSources.has(norm(r.Source)));

    const adSpend = M["Advertisement Expense"].fn(cards);
    const revenue = M["Revenue"].fn(closingAds);           // revenue on ad sources (closings + appended trips)
    const revClosings = M["Total Revenue"].fn(closingAds); // closings only
    const revTrips = M["Additional Revenue from Trips"].fn(closingAds); // trips part
    const jobs = M["Total Jobs"].fn(closingAds);
    const leads = M["Total Leads"].fn(mbAds);
    // PBI "Ads Analysis - ROI" numerator is collected cash (Net Cash + Card Payment), not Total Bill.
    const roi = adSpend ? M["Net Cash + Card Payment"].fn(closingAds) / adSpend : null;

    const fmtX = v => (v == null || isNaN(v)) ? "—" : Number(v).toFixed(2) + "x";
    // RS.money/RS.fmtN render null as "$0"/"0" — null-safe wrappers for nullable cells
    const moneyNS = v => v == null ? "—" : RS.money(v);
    const intNS = v => v == null ? "—" : RS.fmtN(v);
    const roiCell = v => v == null ? "—" :
      `<span class="${v >= 1 ? "up" : "down"}">${fmtX(v)}</span>`;
    const deltaCell = g => g == null ? "—" :
      `<span class="${g >= 0 ? "up" : "down"}">${(g >= 0 ? "▲ " : "▼ ") + RS.fmtPct(Math.abs(g))}</span>`;
    // friendly empty state for a card's tabular view when a join produced no rows
    const emptyTbl = msg =>
      `<div style="padding:16px;color:var(--muted)">${msg}</div>`;

    // ---- headline YoY: Jan-1 → max filtered date vs the same window last year.
    // Prior-year rows come from the date-UNfiltered universe (other slicers still apply);
    // save/restore of the date range is synchronous — no awaits in between.
    const maxD = adRows.reduce((a, r) => (r._d && r._d > a) ? r._d : a, "");
    let yoySpend = null, yoyRev = null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(maxD)) {
      const y = +maxD.slice(0, 4);
      const curF = y + "-01-01", curT = maxD;
      const prvF = (y - 1) + "-01-01", prvT = (y - 1) + maxD.slice(4);
      const sf = RS.state.dateFrom, st = RS.state.dateTo;
      RS.state.dateFrom = RS.state.dateTo = null;
      const cardsND = RS.filtered("card_expenses", cardAll);
      const closingND = RS.filtered("closing", closingAll);
      RS.state.dateFrom = sf; RS.state.dateTo = st;
      const adND = cardsND.filter(r => RS.num(r["Is Advertising"]) === 1);
      const spendW = (f, t) => adND.reduce((a, r) =>
        a + ((r._d >= f && r._d <= t) ? RS.num(r.Amount) : 0), 0);
      const revW = (f, t) => M["Revenue"].fn(closingND.filter(r =>
        r._d >= f && r._d <= t && adSources.has(norm(r.Source))));
      const grow = (c, p) => p ? (c - p) / Math.abs(p) : null;
      yoySpend = grow(spendW(curF, curT), spendW(prvF, prvT));
      yoyRev = grow(revW(curF, curT), revW(prvF, prvT));
    }

    host.innerHTML = `
      <div id="adsWrap">
      <style>#adsWrap .up{color:var(--brand)}#adsWrap .down{color:var(--red)}</style>
      <div class="rs-page-head">
        <h1>Marketing — Ad Spend & Returns</h1>
        <p>Advertisement spend, funnel and returns (formerly "Ads Analysis") ·
           <b>${RS.fmtN(adRows.length)}</b> ad transactions across
           <b>${RS.fmtN(adSources.size)}</b> sources in scope
           <span class="freshness">· closing & Moveboard matched to ad sources via Source</span></p>
      </div>
      <div class="rs-kpis" id="adsKpis"></div>
      <div id="adsMain"></div>
      <div class="rs-grid2" id="adsGrid"></div>
      <div id="adsChannel"></div>
      </div>`;

    const spendSub = RS.money(adSpend) + " · " + RS.fmtN(adRows.length) + " advertising transactions";
    const revSub = RS.money(revenue) + " · Revenue on " + RS.fmtN(closingAds.length) + " matched jobs";
    // split so Revenue = Total Revenue (closings) + Additional Revenue from Trips is visible
    const revSplit = "Closings " + RS.money(revClosings) + " + Trips " + RS.money(revTrips);
    RSC.kpis(document.getElementById("adsKpis"), [
      { label: "Advertisement Expense", value: RS.moneyC(adSpend), sub: spendSub },
      { label: "Revenue on Ad Sources", value: RS.moneyC(revenue), sub: revSub },
      // F11/C11: numerator is collected cash, not billed revenue — label + sub say so
      { label: "Cash ROI", value: roiCell(roi),
        sub: "cash actually collected per $1 of ad spend · all-time in filter scope" },
      { label: "Leads on Ad Sources", value: RS.fmtN(leads),
        sub: "Moveboard requests · by the date the lead came in" },
      // inline: no exact PBI measure — portal addition alongside "Expense per 1 Job"
      { label: "Cost per Lead", value: leads ? RS.moneyC(adSpend / leads) : "—",
        sub: "ad spend / lead" },
      // inline: PBI "Expense per 1 Job" — one label portal-wide (N32): "Ad cost per completed job"
      { label: "Ad Cost per Completed Job", value: jobs ? RS.moneyC(adSpend / jobs) : "—",
        sub: "ad spend / completed job" },
    ]);
    // RSC.kpis escapes sub text — re-inject the two headline subs so the YoY chips render
    const chip = g => g == null ? "" : " · " + deltaCell(g) + " vs same period last year";
    const kpiSubs = document.querySelectorAll("#adsKpis .kpi .s");
    if (kpiSubs[0]) kpiSubs[0].innerHTML = spendSub + chip(yoySpend);
    // revenue sub carries the YoY chip + the closings/trips split so the parts are visible
    if (kpiSubs[1]) kpiSubs[1].innerHTML = revSub + chip(yoyRev) +
      `<br><span style="color:var(--muted)">${revSplit}</span>`;

    /* ================= main: Spend by Provider (PBI "Analysis" column chart,
       Calculate by - Advertisement Analysis reduced to Ad Spend / # transactions) */
    const provAgg = (() => {
      const g = {};
      adRows.forEach(r => {
        const k = (r.Provider == null || String(r.Provider).trim() === "") ? "—" : String(r.Provider).trim();
        const o = g[k] = g[k] || { k, v: 0, n: 0 };
        o.v += RS.num(r.Amount); o.n += 1;
      });
      return Object.values(g);
    })();
    const PROV_CALC = ["Ad Spend", "# Transactions"];
    let provCalc = PROV_CALC[0];
    const provSorted = () => provAgg.slice().sort((a, b) =>
      provCalc === "Ad Spend" ? (b.v - a.v) : (b.n - a.n));
    const provVal = x => provCalc === "Ad Spend" ? x.v : x.n;
    const provFmt = v => provCalc === "Ad Spend" ? RS.money(v) : RS.fmtN(v);

    const mainCard = RSC.chartCard(document.getElementById("adsMain"), {
      title: "Spend by Provider",
      // table shows fixed columns (spend + txns + avg) regardless of the "Show:" pick (PBI "Calculate by")
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">Show:</span><select id="adsProvCalc">` +
        PROV_CALC.map(c => `<option ${c === provCalc ? "selected" : ""}>${c}</option>`).join("") + `</select>`,
      buildChart(canvas) {
        const list = provSorted();
        const top = list.slice(0, 15);
        const rest = list.slice(15);
        if (rest.length) top.push({
          k: `All others (${rest.length})`,
          v: rest.reduce((a, x) => a + x.v, 0), n: rest.reduce((a, x) => a + x.n, 0),
        });
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: top.map(x => x.k),
            datasets: [{ label: provCalc,
              data: top.map(x => +provVal(x).toFixed(2)),
              backgroundColor: top.map((x, i) => i === 15 ? "#6b7a88" : "#b7e23b"),
              borderRadius: 4 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `${provCalc}: ${provFmt(c.raw)}` } } },
            scales: {
              x: { ticks: { callback: v => provCalc === "Ad Spend" ? "$" + (v / 1000) + "k" : RS.fmtN(v) } },
              y: { ticks: { font: { size: 11 }, callback(v) {
                const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
                return typeof l === "string" && l.length > 24 ? l.slice(0, 23) + "…" : l; } } },
            },
          },
        });
      },
      buildTable() {
        const list = provSorted();
        if (!list.length) return emptyTbl("No advertising transactions for the current filters.");
        const totV = list.reduce((a, x) => a + x.v, 0);
        const totN = list.reduce((a, x) => a + x.n, 0);
        const top = list.slice(0, 25);
        const rest = list.slice(25);
        const data = top.map((x, i) => ({
          r: i + 1, k: x.k, v: x.v, sh: totV ? x.v / totV : null,
          n: x.n, avg: x.n ? x.v / x.n : null,
        }));
        if (rest.length) data.push({
          r: "", k: `All others (${rest.length})`,
          v: rest.reduce((a, x) => a + x.v, 0),
          sh: totV ? rest.reduce((a, x) => a + x.v, 0) / totV : null,
          n: rest.reduce((a, x) => a + x.n, 0),
          avg: null,
        });
        const note = rest.length ?
          `<div style="color:var(--muted);font-size:11px;padding:6px 2px">showing 25 of ${RS.fmtN(list.length)} providers (rest aggregated)</div>` : "";
        return RSC.table(
          [{ key: "r", label: "#" }, { key: "k", label: "Provider" },
           { key: "v", label: "Ad Spend", fmt: RS.money },
           { key: "sh", label: "% of Spend", fmt: RS.fmtPct },
           { key: "n", label: "# Transactions", fmt: RS.fmtN },
           { key: "avg", label: "Avg / Transaction", fmt: moneyNS }],
          data,
          { r: "", k: "Total", v: totV, sh: totV ? 1 : null, n: totN, avg: totN ? totV / totN : null }) + note;
      },
    });
    document.getElementById("adsProvCalc").onchange = e => { provCalc = e.target.value; mainCard.rerender(); };

    /* ================= grid2 (a): Spend vs Revenue by Source ================= */
    // Aggregate the three datasets per ad source once.
    const spendBySrc = {}, mbCntBySrc = {}, closBySrc = {};
    adRows.forEach(r => { const k = norm(r.Source); if (k) spendBySrc[k] = (spendBySrc[k] || 0) + RS.num(r.Amount); });
    mbAds.forEach(r => { const k = norm(r.Source); mbCntBySrc[k] = (mbCntBySrc[k] || 0) + 1; });
    closingAds.forEach(r => { const k = norm(r.Source); (closBySrc[k] = closBySrc[k] || []).push(r); });
    const srcList = [...adSources].map(([k, disp]) => {
      const spend = spendBySrc[k] || 0;
      const cl = closBySrc[k] || [];
      const rev = M["Revenue"].fn(cl);
      return { k, disp, spend, rev, jobs: cl.length, leads: mbCntBySrc[k] || 0,
               // PBI "Ads Analysis - ROI" = (Net Cash + Card Payment) / Ad Spend
               roi: spend ? M["Net Cash + Card Payment"].fn(cl) / spend : null };
    }).sort((a, b) => b.spend - a.spend);
    // spend on advertising rows with NO Source tag — table-only line, no join possible
    const unattributed = adSpend - srcList.reduce((a, x) => a + x.spend, 0);

    const grid = document.getElementById("adsGrid");
    RSC.chartCard(grid, {
      title: "Spend vs Revenue by Source",
      // "top 12" label only describes the chart; the table lists up to 40 sources
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">top 12 sources by spend</span>`,
      buildChart(canvas) {
        const top = srcList.slice(0, 12);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: top.map(x => x.disp),
            datasets: [
              { label: "Ad Spend", data: top.map(x => Math.round(x.spend)), backgroundColor: "#b7e23b", borderRadius: 4 },
              { label: "Revenue", data: top.map(x => Math.round(x.rev)), backgroundColor: "#5b8cff", borderRadius: 4 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: {
                label: c => `${c.dataset.label}: ${RS.money(c.raw)}`,
                afterBody: items => {
                  const s = top[items[0].dataIndex];
                  return `Cash ROI: ${fmtX(s.roi)} · Leads: ${RS.fmtN(s.leads)} · Jobs: ${RS.fmtN(s.jobs)}`;
                } } },
            },
            scales: {
              y: { ticks: { callback: v => "$" + (v / 1000) + "k" } },
              x: { ticks: { font: { size: 11 }, maxRotation: 60, minRotation: 40, callback(v) {
                const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
                return typeof l === "string" && l.length > 14 ? l.slice(0, 13) + "…" : l; } } },
            },
          },
        });
      },
      buildTable() {
        /* E7a: full-funnel source economics — Leads → Jobs → Leads→Jobs % →
           Ad cost per completed job (CAC) → Revenue per Lead → ROAS (billed
           revenue/spend); Cash ROI stays collected-cash based (PBI "Ads
           Analysis - ROI") and is labeled so. */
        if (!srcList.length) return emptyTbl("No ad sources matched the current filters.");
        const totSpend = srcList.reduce((a, x) => a + x.spend, 0) + Math.max(0, unattributed);
        const funnel = x => ({
          cv: x.leads ? x.jobs / x.leads : null,       // Leads → Jobs % = completed jobs / leads
          cac: x.jobs ? x.spend / x.jobs : null,       // CAC = spend / completed job
          rpl: x.leads ? x.rev / x.leads : null,       // Revenue per Lead
          roas: x.spend ? x.rev / x.spend : null,      // ROAS = billed revenue / spend
        });
        const data = srcList.slice(0, 40).map((x, i) => ({
          r: i + 1, s: x.disp, sp: x.spend, sh: totSpend ? x.spend / totSpend : null,
          l: x.leads, j: x.jobs, rev: x.rev, roi: x.roi, ...funnel(x),
        }));
        if (unattributed > 0.005) data.push({
          r: "", s: "(no source tag)", sp: unattributed,
          sh: totSpend ? unattributed / totSpend : null, rev: null, roi: null, l: null, j: null,
          cv: null, cac: null, rpl: null, roas: null,
        });
        const note = srcList.length > 40 ?
          `<div style="color:var(--muted);font-size:11px;padding:6px 2px">showing 40 of ${RS.fmtN(srcList.length)} sources by spend</div>` : "";
        // C11/D8: the one footnote on this page that defines both return metrics
        const roasNote =
          `<div style="color:var(--muted);font-size:11px;padding:6px 2px">How it's counted · ` +
          `ROAS (return on ad spend) = billed revenue ÷ ad spend. ` +
          `Cash ROI = cash actually collected ÷ ad spend.</div>`;
        return RSC.table(
          [{ key: "r", label: "#" }, { key: "s", label: "Source" },
           { key: "sp", label: "Ad Spend", fmt: RS.money },
           { key: "sh", label: "% of Spend", fmt: RS.fmtPct },
           { key: "l", label: "Leads", fmt: intNS },
           { key: "j", label: "Jobs", fmt: intNS },
           { key: "cv", label: "Leads → Jobs %", fmt: RS.fmtPct },
           { key: "cac", label: "Ad cost per completed job (CAC)", fmt: moneyNS },
           { key: "rev", label: "Revenue", fmt: moneyNS },
           { key: "rpl", label: "Revenue per Lead", fmt: moneyNS },
           { key: "roas", label: "ROAS", fmt: fmtX },
           { key: "roi", label: "Cash ROI", fmt: roiCell }],
          data,
          { r: "", s: "Total", sp: totSpend, sh: totSpend ? 1 : null,
            l: leads, j: jobs, rev: revenue, roi: roi,
            ...funnel({ leads, jobs, spend: totSpend, rev: revenue }) }) + note + roasNote;
      },
    });

    /* ================= grid2 (b): monthly ad spend vs revenue ================= */
    const spendByM = {}, closAdsByM = {};
    adRows.forEach(r => { const k = r._y + "-" + String(r._m).padStart(2, "0");
      spendByM[k] = (spendByM[k] || 0) + RS.num(r.Amount); });
    closingAds.forEach(r => { const k = r._y + "-" + String(r._m).padStart(2, "0");
      (closAdsByM[k] = closAdsByM[k] || []).push(r); });
    const months = [...new Set([...Object.keys(spendByM), ...Object.keys(closAdsByM)])]
      .filter(k => /^\d{4}-\d{2}$/.test(k)).sort().slice(-24);
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const revOfM = k => M["Revenue"].fn(closAdsByM[k] || []);

    RSC.chartCard(grid, {
      title: "Monthly ad spend vs revenue",
      controlsHtml: `<span class="lbl">last 24 mo · revenue on ad sources</span>`,
      buildChart(canvas) {
        return new Chart(canvas, {
          data: {
            labels: months.map(mLabel),
            datasets: [
              { type: "line", label: "Ad Spend", data: months.map(k => Math.round(spendByM[k] || 0)),
                borderColor: "#b7e23b", backgroundColor: "#b7e23b", borderWidth: 2,
                pointRadius: 2, tension: .3, yAxisID: "y" },
              { type: "line", label: "Revenue on Ad Sources", data: months.map(k => Math.round(revOfM(k))),
                borderColor: "#5b8cff", backgroundColor: "#5b8cff", borderWidth: 2,
                pointRadius: 2, tension: .3, yAxisID: "y1" },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.money(c.raw)}` } },
            },
            scales: {
              y: { position: "left", title: { display: true, text: "Ad Spend" },
                   ticks: { callback: v => "$" + (v / 1000) + "k" } },
              y1: { position: "right", title: { display: true, text: "Revenue" },
                    grid: { drawOnChartArea: false }, ticks: { callback: v => "$" + (v / 1000) + "k" } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        if (!months.length) return emptyTbl("No monthly ad spend for the current filters.");
        const data = months.map((k, i) => {
          const sp = spendByM[k] || 0;
          const prev = i > 0 ? (spendByM[months[i - 1]] || 0) : null;
          const rev = revOfM(k);
          const cash = M["Net Cash + Card Payment"].fn(closAdsByM[k] || []); // collected on ad sources
          return { m: mLabel(k), sp,
            // inline: PBI "Calculate by - Yearly Growth Rate" family — here MoM on spend
            d: (prev != null && prev) ? (sp - prev) / Math.abs(prev) : null,
            rev, cash, roi: sp ? cash / sp : null };  // ROI = collected cash / spend
        });
        const totSp = data.reduce((a, x) => a + x.sp, 0);
        const totRev = data.reduce((a, x) => a + x.rev, 0);
        // F11: footer ROI = collected cash over the SHOWN months / spend — same
        // numerator as its rows and the headline (was billed Revenue / spend).
        const totCash = data.reduce((a, x) => a + x.cash, 0);
        return RSC.table(
          [{ key: "m", label: "Month" },
           { key: "sp", label: "Ad Spend", fmt: RS.money },
           { key: "d", label: "MoM Change", fmt: deltaCell },
           { key: "rev", label: "Revenue", fmt: RS.money },
           { key: "roi", label: "Cash ROI", fmt: roiCell }],
          data,
          { m: "Total", sp: totSp, d: null, rev: totRev, roi: totSp ? totCash / totSp : null });
      },
    });

    /* ================= E7b: Channel efficiency over time =================
       Monthly CPL / CAC / ROAS for ONE ad source (picker: top 12 by spend,
       default = biggest spender). Same Source join as the cards above.
       CPL & CAC in $ on the left axis; ROAS (billed revenue / spend) on the
       right. The picker drives BOTH views — controlsGraphOnly deliberately
       not set. */
    const chanHost = document.getElementById("adsChannel");
    const chanTop = srcList.slice(0, 12);
    if (!chanTop.length) {
      chanHost.innerHTML = `<div class="panel">
        <div class="panel-head"><span class="panel-title">Channel efficiency over time</span></div>
        <div style="padding:16px;color:var(--muted)">No ad sources matched the current filters.</div></div>`;
    } else {
      // per-source per-month aggregates: spend $, lead count, closing rows
      const ymOf = r => r._y + "-" + String(r._m).padStart(2, "0");
      const spendSM = {}, leadSM = {}, closSM = {};
      adRows.forEach(r => { const k = norm(r.Source); if (!k) return;
        const o = spendSM[k] = spendSM[k] || {}; const ym = ymOf(r);
        o[ym] = (o[ym] || 0) + RS.num(r.Amount); });
      mbAds.forEach(r => { const k = norm(r.Source);
        const o = leadSM[k] = leadSM[k] || {}; const ym = ymOf(r);
        o[ym] = (o[ym] || 0) + 1; });
      closingAds.forEach(r => { const k = norm(r.Source);
        const o = closSM[k] = closSM[k] || {}; const ym = ymOf(r);
        (o[ym] = o[ym] || []).push(r); });
      let chanKey = chanTop[0].k;                   // default: #1 source by spend
      const chanRows = () => {
        const sp = spendSM[chanKey] || {}, ld = leadSM[chanKey] || {}, cl = closSM[chanKey] || {};
        const ms = [...new Set([...Object.keys(sp), ...Object.keys(ld), ...Object.keys(cl)])]
          .filter(k => /^\d{4}-\d{2}$/.test(k)).sort().slice(-24);
        return ms.map(k => {
          const s = sp[k] || 0, l = ld[k] || 0, clRows = cl[k] || [];
          const j = clRows.length, rev = M["Revenue"].fn(clRows);
          return { k, m: mLabel(k), sp: s, l, j, rev,
            cpl: l ? s / l : null,        // CPL = spend / lead
            cac: j ? s / j : null,        // CAC = spend / completed job
            roas: s ? rev / s : null };   // ROAS = billed revenue / spend
        });
      };
      const chanCard = RSC.chartCard(chanHost, {
        title: "Channel efficiency over time",
        controlsHtml: `<span class="lbl">Source (top 12 by spend)</span><select id="adsChanSrc">` +
          chanTop.map(x => `<option value="${RSC.esc(x.k)}">${RSC.esc(x.disp)}</option>`).join("") +
          `</select><span class="lbl">· last 24 mo · CPL/CAC left · ROAS right</span>`,
        buildChart(canvas) {
          const rows = chanRows();
          return new Chart(canvas, {
            data: {
              labels: rows.map(x => x.m),
              datasets: [
                { type: "line", label: "CPL", yAxisID: "y", spanGaps: true,
                  data: rows.map(x => x.cpl == null ? null : +x.cpl.toFixed(2)),
                  borderColor: "#b7e23b", backgroundColor: "#b7e23b",
                  borderWidth: 2, pointRadius: 2, tension: .3 },
                { type: "line", label: "CAC", yAxisID: "y", spanGaps: true,
                  data: rows.map(x => x.cac == null ? null : +x.cac.toFixed(2)),
                  borderColor: "#5b8cff", backgroundColor: "#5b8cff",
                  borderWidth: 2, pointRadius: 2, tension: .3 },
                { type: "line", label: "ROAS", yAxisID: "y1", spanGaps: true,
                  data: rows.map(x => x.roas == null ? null : +x.roas.toFixed(2)),
                  borderColor: "#fbbf24", backgroundColor: "#fbbf24",
                  borderWidth: 2, pointRadius: 2, tension: .3 },
              ],
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              interaction: { mode: "index", intersect: false },
              plugins: {
                legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
                tooltip: { callbacks: { label: c =>
                  c.dataset.yAxisID === "y1"
                    ? `${c.dataset.label}: ${fmtX(c.raw)}`
                    : `${c.dataset.label}: ${moneyNS(c.raw)}` } },
              },
              scales: {
                y: { position: "left", title: { display: true, text: "CPL / CAC ($)" },
                     ticks: { callback: v => "$" + RS.fmtN(v) } },
                y1: { position: "right", title: { display: true, text: "ROAS (x)" },
                      grid: { drawOnChartArea: false }, ticks: { callback: v => v + "x" } },
                x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
              },
            },
          });
        },
        buildTable() {
          const rows = chanRows();
          if (!rows.length) return emptyTbl("No monthly activity for this source under the current filters.");
          const tS = rows.reduce((a, x) => a + x.sp, 0);
          const tL = rows.reduce((a, x) => a + x.l, 0);
          const tJ = rows.reduce((a, x) => a + x.j, 0);
          const tR = rows.reduce((a, x) => a + x.rev, 0);
          return RSC.table(
            [{ key: "m", label: "Month" },
             { key: "sp", label: "Ad Spend", fmt: RS.money },
             { key: "l", label: "Leads", fmt: RS.fmtN },
             { key: "cpl", label: "CPL", fmt: moneyNS },
             { key: "j", label: "Jobs", fmt: RS.fmtN },
             { key: "cac", label: "CAC", fmt: moneyNS },
             { key: "rev", label: "Revenue", fmt: RS.money },
             { key: "roas", label: "ROAS", fmt: fmtX }],
            rows,
            { m: "Total", sp: tS, l: tL, cpl: tL ? tS / tL : null,
              j: tJ, cac: tJ ? tS / tJ : null, rev: tR, roas: tS ? tR / tS : null });
        },
      });
      document.getElementById("adsChanSrc").onchange = e => {
        chanKey = e.target.value; chanCard.rerender(); };
    }
  },
});
