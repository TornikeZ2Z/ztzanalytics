/* GO page: Sales Person Analysis — salesperson performance: jobs, revenue,
   commission, refund deductions + normalized (Bill Distribution-weighted) revenue.
   PBI source: General Overview "Sales Person Analysis" (05-dashboards.md GO-3). */
registerPage({
  id: "sales-person-analysis",
  group: "sales",
  title: "Sales Person Analysis",
  async render(host) {
    const [closingAll, salariesAll, refundsAll] = await Promise.all([
      RS.load("closing"), RS.load("sales_salaries"), RS.load("refunds")]);
    const rows = RS.filtered("closing", closingAll);
    const refRows = RS.filtered("refunds", refundsAll);
    const M = RS.M;

    if (!rows.length) {   // empty state: no charts/tables on an empty scope
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Sales Person Analysis</h1>
          <p>Jobs, revenue &amp; commission per sales person</p>
        </div>
        <div class="panel" style="padding:18px;color:var(--muted)">No data for the current filters — adjust or clear the filter bar above.</div>`;
      return;
    }

    // ---- membership join: sales_salaries has no date column — time-slice it via
    // the Unique Key set of the FILTERED closing rows (client-side relationship).
    const keys = new Set();
    const keyBill = new Map();   // Unique Key -> raw closing Total Bill (normalization basis)
    const keyMonth = new Map();  // Unique Key -> "YYYY-MM" (buckets commission by job month)
    rows.forEach(r => {
      const k = r["Unique Key"]; if (!k) return;
      keys.add(k);
      keyBill.set(k, RS.num(r["Total Bill"]));
      keyMonth.set(k, r._y + "-" + String(r._m).padStart(2, "0"));
    });
    const salRows = salariesAll.filter(s => keys.has(s["Unique Key"]));

    // Bill Distribution is expected as a 0–1 share; if the source stores percents
    // (avg >> 1) scale down so normalized totals stay comparable to Total Bill.
    let distScale = 1;
    if (salRows.length) {
      const avg = salRows.reduce((a, s) => a + RS.num(s["Bill Distribution"]), 0) / salRows.length;
      if (avg > 1.5) distScale = 0.01;
    }

    // ---- page-level totals
    const totBill = M["Total Bill"].fn(rows);       // Revenue (job bills + linked-trip extras)
    const totRevClose = M["Total Revenue"].fn(rows); // job bills (SUM Total Bill — incl. appended-trip jobs' own bills)
    const totRevTrips = M["Additional Revenue from Trips"].fn(rows); // linked-trip residual only
    const totJobs = M["Total Jobs"].fn(rows);
    const totComm = M["Sales Commission"].fn(salRows);
    // PBI 'Amount Deducted From Sales Person' — refund amounts charged against commission
    const totReduced = refRows.reduce((a, r) => a + RS.num(r["Sales Commission Reduced Amount"]), 0);
    const totFinal = totComm - totReduced;   // PBI 'Sales Commission Final'-style

    // ---- per-SP aggregation (closing by primary SP; salaries/refunds by their own SP)
    const mkOf = r => r._y + "-" + String(r._m).padStart(2, "0");
    const spMap = new Map();
    const sp = name => {
      const k = (name == null || name === "") ? "—" : String(name);
      if (!spMap.has(k)) spMap.set(k, { name: k, rows: [], sal: [], reduced: 0, mm: {} });
      return spMap.get(k);
    };
    const bucket = (o, mk) => (o.mm[mk] = o.mm[mk] || { rows: [], sal: [], reduced: 0 });
    rows.forEach(r => { const o = sp(r["Sales Person"]); o.rows.push(r); bucket(o, mkOf(r)).rows.push(r); });
    salRows.forEach(s => {
      const o = sp(s["Sales Person"]); o.sal.push(s);
      const mk = keyMonth.get(s["Unique Key"]); if (mk) bucket(o, mk).sal.push(s);
    });
    refRows.forEach(f => {
      const o = sp(f["Sales Person"]);
      const amt = RS.num(f["Sales Commission Reduced Amount"]);
      o.reduced += amt; bucket(o, mkOf(f)).reduced += amt;
    });
    const spList = [...spMap.values()];
    spList.forEach(o => {
      o.jobs = M["Total Jobs"].fn(o.rows);
      o.bill = M["Total Bill"].fn(o.rows);
      o.net = M["Net Cash"].fn(o.rows);
      o.comm = M["Sales Commission"].fn(o.sal);
      o.commFinal = o.comm - o.reduced;   // PBI 'Sales Commission Final'-style: commission − reduced
      // PBI 'Total Bill Normalized For Sales' — SUMX over SP slots of
      // Bill Distribution × the job's raw Total Bill (splits multi-SP jobs fairly).
      o.normBill = o.sal.reduce((a, s) =>
        a + distScale * RS.num(s["Bill Distribution"]) * (keyBill.get(s["Unique Key"]) || 0), 0);
    });

    // RS.money/RS.fmtN render null as "$0"/"0" — null-safe wrappers for table cells
    const moneyNS = v => v == null ? "—" : RS.money(v);
    const intNS = v => v == null ? "—" : RS.fmtN(v);

    // ---- Calculate-by registry (PBI field param 'Calculate by - Sales Person Analysis' subset)
    const CALCS = {
      "Total Jobs":          { key: "jobs", fmt: intNS, of: b => M["Total Jobs"].fn(b.rows) },
      "Revenue":             { key: "bill", fmt: moneyNS, of: b => M["Total Bill"].fn(b.rows) },
      "Net Cash":            { key: "net", fmt: moneyNS, of: b => M["Net Cash"].fn(b.rows) },
      "Sales Commission":    { key: "comm", fmt: moneyNS, of: b => M["Sales Commission"].fn(b.sal) },
      "Commission Final":    { key: "commFinal", fmt: moneyNS,   // PBI 'Sales Commission Final'-style
        of: b => M["Sales Commission"].fn(b.sal) - b.reduced },
    };
    let calcBy = "Revenue";

    // ---- MoM delta window: last two COMPLETE months in scope (partial month excluded)
    const now = new Date();
    const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const deltaMonths = [...new Set(rows.map(mkOf))].sort().filter(k => k !== curKey).slice(-2);
    const dPrev = deltaMonths.length === 2 ? deltaMonths[0] : null;
    const dLast = deltaMonths.length === 2 ? deltaMonths[1] : null;
    const fmtDelta = v => v == null ? "—" :
      `<span class="${v >= 0 ? "spa-up" : "spa-down"}">${v >= 0 ? "+" : ""}${(100 * v).toFixed(1)}%</span>`;
    const momOf = o => {   // per-SP MoM growth for the chosen calc
      if (!dLast) return null;
      const c = CALCS[calcBy];
      const cur = o.mm[dLast] ? c.of(o.mm[dLast]) : 0;
      const prev = o.mm[dPrev] ? c.of(o.mm[dPrev]) : 0;
      return prev ? (cur - prev) / Math.abs(prev) : null;
    };
    const kpiMom = of => {   // page-level MoM badge appended to a KPI value (always labeled "MoM")
      if (!dLast) return "";
      const agg = mk => spList.reduce((a, o) => a + (o.mm[mk] ? of(o.mm[mk]) : 0), 0);
      const prev = agg(dPrev), cur = agg(dLast);
      const g = prev ? (cur - prev) / Math.abs(prev) : null;
      return g == null ? "" : ` <span class="spa-kd ${g >= 0 ? "spa-up" : "spa-down"}">` +
        `${g >= 0 ? "+" : ""}${(100 * g).toFixed(1)}% MoM</span>`;
    };

    // ---- YoY chip: Jan-1 → latest filtered closing date this year vs the same
    // window last year, on the closing dataset with date filters lifted (slicers kept).
    const yoyChip = (() => {
      const maxD = rows.reduce((a, r) => (r._d && r._d > a) ? r._d : a, "");
      if (!maxD) return () => "";
      const y = +maxD.slice(0, 4);
      const s = RS.state, save = { f: s.dateFrom, t: s.dateTo };
      s.dateFrom = s.dateTo = null;
      const scoped = RS.filtered("closing", closingAll);   // slicers only, no date range
      s.dateFrom = save.f; s.dateTo = save.t;
      const win = yr => scoped.filter(r =>
        r._d && r._d >= yr + "-01-01" && r._d <= yr + maxD.slice(4));
      const cur = win(y), prev = win(y - 1);
      if (!prev.length) return () => "";
      return of => {
        const p = of(prev);
        if (!p) return "";
        const g = (of(cur) - p) / Math.abs(p);
        return ` <span class="spa-kd ${g >= 0 ? "spa-up" : "spa-down"}">` +
          `${g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(g)).toFixed(1)}% YoY</span>`;
      };
    })();

    host.innerHTML = `
      <style>
        .spa-up{color:var(--brand);font-weight:700}.spa-down{color:var(--red);font-weight:700}
        .spa-kd{font-size:12px;font-weight:600;margin-left:2px;vertical-align:2px}
      </style>
      <div class="rs-page-head">
        <h1>Sales Person Analysis</h1>
        <p>Jobs, revenue &amp; commission per sales person · <b>${RS.fmtN(rows.length)}</b> jobs ·
           <b>${RS.fmtN(salRows.length)}</b> commission rows in scope
           <span class="freshness">· commissions matched to jobs by job key
           · Month-over-month change compares ${dLast ? RSC.esc(mLabel(dPrev)) + " → " + RSC.esc(mLabel(dLast)) : "n/a (needs 2 complete months)"}</span></p>
      </div>
      <div class="rs-kpis" id="spaKpis"></div>
      <div id="spaMain"></div>
      <div class="rs-grid2" id="spaGrid"></div>`;

    RSC.kpis(document.getElementById("spaKpis"), [
      { label: "Revenue",
        value: RS.moneyC(totBill) + yoyChip(rs => M["Total Bill"].fn(rs)) + kpiMom(b => M["Total Bill"].fn(b.rows)),
        sub: RS.money(totRevClose) + " job bills + " + RS.money(totRevTrips) + " linked-trip extras · YoY vs the same Jan-1 window last year" },
      { label: "Total Jobs",
        value: RS.fmtN(totJobs) + yoyChip(rs => M["Total Jobs"].fn(rs)) + kpiMom(b => M["Total Jobs"].fn(b.rows)),
        sub: "closings in scope" },
      { label: "Sales Commission", value: RS.moneyC(totComm) + kpiMom(b => M["Sales Commission"].fn(b.sal)),
        sub: RS.money(totComm) + " · matched to jobs by job key" },
      { label: "Commission Deductions", value: RS.moneyC(totReduced),
        sub: RS.money(totReduced) + " · refunds charged back to salespeople" },
      { label: "Commission Final", value: RS.moneyC(totFinal),
        sub: RS.money(totFinal) + " · commission − deductions" },
      { label: "Avg Commission / Job", value: totJobs ? RS.moneyC(totComm / totJobs) : "—", sub: "commission ÷ total jobs" },
      { label: "Commission % of Revenue", value: totBill ? RS.fmtPct(totComm / totBill) : "—", sub: "cost-of-sales share" },
    ]);

    // ---- main card: measure by sales person (Calculate-by switcher, top 20 + rest)
    const listFor = () => {
      const c = CALCS[calcBy];
      return spList.slice().sort((a, b) => (b[c.key] || 0) - (a[c.key] || 0));
    };
    const mainCard = RSC.chartCard(document.getElementById("spaMain"), {
      title: "By Sales Person",
      controlsHtml: `<span class="lbl">Show:</span><select id="spaCalc">` +
        Object.keys(CALCS).map(c => `<option ${c === calcBy ? "selected" : ""}>${c}</option>`).join("") +
        `</select>`,
      buildChart(canvas) {
        const c = CALCS[calcBy];
        // PBI hides blank Full Name on the chart — same here (blanks stay in the table).
        const ranked = listFor().filter(x => x.name !== "—");
        const top = ranked.slice(0, 20), rest = ranked.slice(20);
        const labels = top.map(x => x.name);
        const data = top.map(x => +((x[c.key] || 0).toFixed(2)));
        const colors = top.map(() => "#b7e23b");
        if (rest.length) {   // "everything else" bucket
          labels.push(`All others (${rest.length})`);
          data.push(+rest.reduce((a, x) => a + (x[c.key] || 0), 0).toFixed(2));
          colors.push("#5b8cff");
        }
        return new Chart(canvas, {
          type: "bar",
          data: { labels, datasets: [{ label: calcBy, data, backgroundColor: colors, borderRadius: 4 }] },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: t => `${calcBy}: ${c.fmt(t.raw)}` } },
            },
            scales: {
              y: { ticks: { font: { size: 11 }, autoSkip: false,
                callback(v) { const l = this.getLabelForValue(v); return l.length > 18 ? l.slice(0, 17) + "…" : l; } } },
            },
          },
        });
      },
      buildTable() {
        const c = CALCS[calcBy];
        const ranked = listFor();
        const total = ranked.reduce((a, x) => a + (x[c.key] || 0), 0);
        const top = ranked.slice(0, 40), rest = ranked.slice(40);
        const out = top.map((x, i) => ({
          rk: i + 1, name: x.name, v: x[c.key],
          sh: total ? (x[c.key] || 0) / total : null,
          jobs: x.jobs, comm: x.comm, red: x.reduced, fin: x.commFinal, mom: momOf(x),
        }));
        if (rest.length) out.push({
          rk: null, name: `All others (${rest.length})`,
          v: rest.reduce((a, x) => a + (x[c.key] || 0), 0),
          sh: total ? rest.reduce((a, x) => a + (x[c.key] || 0), 0) / total : null,
          jobs: rest.reduce((a, x) => a + x.jobs, 0),
          comm: rest.reduce((a, x) => a + x.comm, 0),
          red: rest.reduce((a, x) => a + x.reduced, 0),
          fin: rest.reduce((a, x) => a + x.commFinal, 0), mom: null,
        });
        return RSC.table(
          [{ key: "rk", label: "#" },
           { key: "name", label: "Sales Person" },
           { key: "v", label: calcBy, fmt: c.fmt },
           { key: "sh", label: "% of total", fmt: RS.fmtPct },
           { key: "jobs", label: "Total Jobs", fmt: intNS },
           { key: "comm", label: "Sales Commission", fmt: moneyNS },
           { key: "red", label: "Deductions", fmt: moneyNS },
           { key: "fin", label: "Commission Final", fmt: moneyNS },
           { key: "mom", label: dLast ? `Change · ${mLabel(dLast)} vs ${mLabel(dPrev)}` : "Change vs prior month", fmt: fmtDelta }],
          out,
          { rk: null, name: "Total", v: total, sh: total ? 1 : null, jobs: totJobs,
            comm: totComm, red: totReduced, fin: totFinal, mom: null });
      },
    });
    document.getElementById("spaCalc").onchange = e => { calcBy = e.target.value; mainCard.rerender(); };

    const grid = document.getElementById("spaGrid");

    // ---- grid (a): normalized revenue — PBI 'Total Bill Normalized For Sales'
    // (job bill split across SP slots by Bill Distribution) vs primary-SP attribution.
    {
      const ranked = spList.filter(x => x.sal.length || x.normBill)
        .sort((a, b) => (b.normBill || 0) - (a.normBill || 0));
      const totNorm = ranked.reduce((a, x) => a + (x.normBill || 0), 0);
      const totPrim = ranked.reduce((a, x) => a + (x.bill || 0), 0);
      const top = ranked.slice(0, 20), rest = ranked.slice(20);
      const fmtDiff = v => v == null ? "—" :
        `<span class="${v >= 0 ? "spa-up" : "spa-down"}">${v >= 0 ? "+" : "−"}${RS.money(Math.abs(v))}</span>`;
      const trows = top.map((x, i) => ({
        rk: i + 1, name: x.name, nb: x.normBill,
        sh: totNorm ? x.normBill / totNorm : null, pb: x.bill, d: x.normBill - x.bill,
      }));
      if (rest.length) trows.push({
        rk: null, name: `All others (${rest.length})`,
        nb: rest.reduce((a, x) => a + x.normBill, 0),
        sh: totNorm ? rest.reduce((a, x) => a + x.normBill, 0) / totNorm : null,
        pb: rest.reduce((a, x) => a + x.bill, 0),
        d: rest.reduce((a, x) => a + (x.normBill - x.bill), 0),
      });
      const panel = RSC.el("div", "panel", `
        <div class="panel-head"><span class="panel-title">Revenue split for shared jobs</span>
          <span class="spacer"></span>
          <span class="rs-ctl"><span class="lbl">jobs sold by two people are split by each person's share</span></span></div>
        <div class="tabwrap" id="spaNorm"></div>`);
      panel.querySelector("#spaNorm").innerHTML = trows.length ? RSC.table(
        [{ key: "rk", label: "#" }, { key: "name", label: "Sales Person" },
         { key: "nb", label: "Split Revenue", fmt: moneyNS },
         { key: "sh", label: "% of total", fmt: RS.fmtPct },
         { key: "pb", label: "Full-credit Revenue", fmt: moneyNS },
         { key: "d", label: "Difference vs full-credit revenue", fmt: fmtDiff }],
        trows,
        { rk: null, name: "Total", nb: totNorm, sh: totNorm ? 1 : null,
          pb: totPrim, d: totNorm - totPrim })
        : `<div style="padding:14px;color:var(--muted)">No commission-linked revenue for the current filters.</div>`;
      grid.appendChild(panel);
    }

    // ---- grid (b): SP × month matrix on Total Bill (top 12 keeps rows scannable)
    {
      const topSet = new Set(spList.filter(x => x.name !== "—")
        .sort((a, b) => (b.bill || 0) - (a.bill || 0)).slice(0, 12).map(x => x.name));
      const mrows = rows.filter(r => topSet.has(String(r["Sales Person"] || "")));
      const panel = RSC.el("div", "panel", `
        <div class="panel-head"><span class="panel-title">Sales Person × Month — Revenue</span>
          <span class="spacer"></span>
          <span class="rs-ctl"><span class="lbl">top 12 by Revenue · last 8 months</span></span></div>
        <div class="tabwrap" id="spaMx"></div>`);
      panel.querySelector("#spaMx").innerHTML = mrows.length
        ? RSC.matrix(mrows, "Sales Person", "Revenue", { rowLabel: "Sales Person", lastN: 8 })
        : `<div style="padding:14px;color:var(--muted)">No named sales persons in the current scope.</div>`;
      grid.appendChild(panel);
    }
  },
});
