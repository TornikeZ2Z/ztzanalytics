/* GO page: YoY Diff — year-over-year comparison of the core closing measures.
   Global filter bar supplies all slicers (multi-select + date range + day between).
   NOTE: the PBI original (GO-15) pivots "Ads Analysis - ROI" by Source × Year; those
   measures need advertisement-expense data not present in any RS dataset, so this
   page delivers the YoY comparison over the core Calculations measures instead. */
registerPage({
  id: "yoy-diff",                    // id stays — bookmarks/ACL grants reference it
  group: "overview",
  title: "Year-over-Year Comparison",
  async render(host) {
    const rows = RS.filtered("closing", await RS.load("closing"));
    const M = RS.M;

    // ---- pre-aggregate once: rows by year and by year×month (fast on 100k+ rows)
    const byYear = {}, byYM = {};
    rows.forEach(r => {
      if (!/^\d{4}$/.test(r._y)) return;
      (byYear[r._y] = byYear[r._y] || []).push(r);
      ((byYM[r._y] = byYM[r._y] || {})[r._m] = byYM[r._y][r._m] || []).push(r);
    });
    const years = Object.keys(byYear).sort();
    const growthTxt = g => g == null ? "—" : (g >= 0 ? "▲ " : "▼ ") + RS.fmtPct(Math.abs(g));
    // HTML chip variant for KPI subs (span.up/.down are themed in rs.css)
    const chip = g => g == null ? "—" :
      `<span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲ " : "▼ "}${RS.fmtPct(Math.abs(g))}</span>`;
    // Revenue split sub-line: Revenue = Total Revenue (job bills, already incl.
    // appended-trip job bills) + Additional Revenue from Trips (linked-trip extras)
    const revSplit = rs => {
      const tr = M["Total Revenue"].fn(rs), tp = M["Additional Revenue from Trips"].fn(rs);
      return `<br>${RS.moneyC(tr)} job bills + ${RS.moneyC(tp)} linked-trip extras`;
    };

    if (!years.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Year-over-Year Comparison</h1>
          <p>How each core measure compares with the year before</p>
        </div>
        <div class="panel" style="padding:18px;color:var(--muted)">No data for the current filters — adjust or clear the filter bar above.</div>`;
      return;
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Year-over-Year Comparison</h1>
        <p>How each core measure compares with the year before · <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· ${years.length ? years[0] + "–" + years[years.length - 1] : "no data"} in filter</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="yearly"></div>
      <div id="monthly"></div>`;

    // ---- KPI strip: current value + YoY growth.
    // Date range set → RS.yoy (DATEADD -1y window). No range → two most recent calendar years.
    const KPI = ["Total Jobs", "Revenue", "Net Cash", "Card Payment"];
    const hasRange = !!(RS.state.dateFrom || RS.state.dateTo);
    // money KPI values are compact ($33.8M); the precise figure moves to the sub line
    const kpiVal = (m, v) => v == null ? "—" : (m.fmt === RS.money ? RS.moneyC(v) : m.fmt(v));
    const precise = (m, v) => (m.fmt === RS.money && v != null) ? RS.money(v) + " · " : "";
    let kpiItems;
    if (hasRange) {
      // RS.yoy shifts BOTH window ends -1y; with a half-open range the shifted LY
      // window would overlap the current one (not a same-window comparison). Close
      // any open end from the data in scope first, restore after. Safe around the
      // awaits: closing is already cached, so RS.yoy resolves in microtasks and no
      // user event (filter change) can interleave before the restore.
      const save = { f: RS.state.dateFrom, t: RS.state.dateTo };
      if (!save.f) RS.state.dateFrom = rows.reduce((a, r) => (r._d && (!a || r._d < a) ? r._d : a), "") || null;
      if (!save.t) RS.state.dateTo = rows.reduce((a, r) => (r._d > a ? r._d : a), "") || null;
      try {
        kpiItems = await Promise.all(KPI.map(async name => {
          const m = M[name];
          const r = await RS.yoy(name);
          return { label: name, value: kpiVal(m, r.cur),
            subHtml: precise(m, r.cur) + (r.growth == null ? "no LY data in range"
               : `${chip(r.growth)} vs same period LY (${m.fmt(r.prev)})`)
               + (name === "Revenue" ? revSplit(rows) : "") };
        }));
      } finally {
        RS.state.dateFrom = save.f; RS.state.dateTo = save.t;
      }
    } else {
      const cy = years[years.length - 1], py = years[years.length - 2];
      // The latest year is usually PARTIAL — comparing it to a full prior year is
      // misleading. Compare Jan 1 → latest data date vs the SAME window last year.
      const maxD = rows.reduce((a, r) => (r._d > a ? r._d : a), "");
      const cut = maxD.slice(4);                          // "-MM-DD"
      const pyRows = py ? (byYear[py] || []).filter(r => r._d.slice(4) <= cut) : [];
      kpiItems = KPI.map(name => {
        const m = M[name];
        const cur = cy ? m.fn(byYear[cy]) : null;
        const prev = py ? m.fn(pyRows) : null;
        // inline: PBI "<measure> Yearly Growth Rate" pattern — not in RS.M registry
        const g = (prev && cur != null) ? (cur - prev) / Math.abs(prev) : null;
        return { label: name, value: kpiVal(m, cur),
          subHtml: precise(m, cur) + (g == null ? `${cy || ""} to date`
             : `${chip(g)} ${cy} YTD vs ${py} same period (${m.fmt(prev)})`)
             + (name === "Revenue" ? revSplit(cy ? byYear[cy] : []) : "") };
      });
    }
    RSC.kpis(document.getElementById("kpis"), kpiItems);
    // RSC.kpis escapes sub text — re-inject the subs that carry HTML growth chips
    host.querySelectorAll("#kpis .kpi .s").forEach((s, i) => {
      if (kpiItems[i] && kpiItems[i].subHtml) s.innerHTML = kpiItems[i].subHtml;
    });

    // ---- shared Calculate-by (drives both charts, like the PBI field parameter)
    // registry KEYS stay untouched; disp() maps them to user-visible labels
    // ("Operating Profit Before Commission" → "Cash Collected (Net + Card)",
    //  "Hours Worked by Forman" → "Foreman Hours" — the raw key spelling never renders).
    const CALC = ["Total Jobs", "Revenue", "Net Cash", "Card Payment",
                  "Operating Profit Before Commission", "Hours Worked by Forman"];
    const disp = k => k === "Hours Worked by Forman" ? "Foreman Hours" : RS.displayName(k);
    let calcBy = CALC[1];
    const perYear = name => years.map(y => M[name].fn(byYear[y]));

    // ---- chart 1: yearly comparison — measure bars by year + YoY growth % line
    const yearCard = RSC.chartCard(document.getElementById("yearly"), {
      title: "Yearly comparison",
      controlsHtml: `<span class="lbl">Show:</span><select id="yoyCalcBy">` +
        CALC.map(c => `<option value="${c}" ${c === calcBy ? "selected" : ""}>${disp(c)}</option>`).join("") + `</select>`,
      buildChart(canvas) {
        const m = M[calcBy], vals = perYear(calcBy);
        // inline: PBI "Yearly Growth Rate" — growth vs prior year, not in RS.M registry
        const growth = vals.map((v, i) => (i > 0 && vals[i - 1]) ? (v - vals[i - 1]) / Math.abs(vals[i - 1]) : null);
        const isMoney = m.fmt === RS.money;
        return new Chart(canvas, {
          data: {
            labels: years,
            datasets: [
              { type: "bar", label: disp(calcBy), data: vals.map(v => Math.round(v)),
                backgroundColor: "#b7e23b", borderRadius: 4, yAxisID: "y", order: 2 },
              { type: "line", label: "YoY growth %", data: growth.map(g => g == null ? null : +(100 * g).toFixed(1)),
                borderColor: "#5b8cff", backgroundColor: "#5b8cff", borderWidth: 2,
                pointRadius: 3, tension: .3, spanGaps: false, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => c.dataset.yAxisID === "y"
                ? `${disp(calcBy)}: ${m.fmt(c.raw)}` : `YoY: ${c.raw == null ? "—" : c.raw + "%"}` } } },
            scales: {
              y: { position: "left", title: { display: true, text: disp(calcBy) },
                   ticks: { callback: v => isMoney ? RS.moneyC(v) : RS.fmtN(v) } },
              y1: { position: "right", title: { display: true, text: "YoY growth %" },
                    grid: { drawOnChartArea: false }, ticks: { callback: v => v + "%" } },
              x: { ticks: { font: { size: 12 } } },
            },
          },
        });
      },
      buildTable() {
        const sel = perYear(calcBy);
        const totSel = sel.reduce((a, v) => a + (v || 0), 0);
        const nz = f => v => v == null ? "—" : f(v);
        const data = years.map((y, i) => ({
          y, jobs: M["Total Jobs"].fn(byYear[y]), bill: M["Revenue"].fn(byYear[y]),
          trev: M["Total Revenue"].fn(byYear[y]), trips: M["Additional Revenue from Trips"].fn(byYear[y]),
          net: M["Net Cash"].fn(byYear[y]), card: M["Card Payment"].fn(byYear[y]),
          nc: M["Operating Profit Before Commission"].fn(byYear[y]), hrs: M["Hours Worked by Forman"].fn(byYear[y]),
          share: totSel ? sel[i] / totSel : null,
          g: (i > 0 && sel[i - 1]) ? (sel[i] - sel[i - 1]) / Math.abs(sel[i - 1]) : null,
        }));
        const tot = k => data.reduce((a, x) => a + (x[k] || 0), 0);
        return RSC.table(
          [{ key: "y", label: "Year" }, { key: "jobs", label: "Total Jobs", fmt: nz(RS.fmtN) },
           { key: "bill", label: "Revenue", fmt: nz(RS.money) },
           { key: "trev", label: "Job Bills", fmt: nz(RS.money) },
           { key: "trips", label: "Linked-Trip Extras", fmt: nz(RS.money) },
           { key: "net", label: "Net Cash", fmt: nz(RS.money) },
           { key: "card", label: "Card Payment", fmt: nz(RS.money) }, { key: "nc", label: "Cash Collected (Net + Card)", fmt: nz(RS.money) },
           { key: "hrs", label: "Hours", fmt: nz(RS.fmtN) },
           { key: "share", label: `% of Total (${disp(calcBy)})`, fmt: nz(RS.fmtPct) },
           { key: "g", label: `YoY % (${disp(calcBy)})`, fmt: growthTxt }],
          data,
          { y: "Total", jobs: tot("jobs"), bill: tot("bill"), trev: tot("trev"), trips: tot("trips"),
            net: tot("net"), card: tot("card"), nc: tot("nc"), hrs: tot("hrs"), share: totSel ? 1 : null });
      },
    });

    // ---- chart 2: monthly trend — one line per year (last 3 in scope), Jan..Dec
    const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const trendYears = () => years.slice(-3);
    const LINE = [  // oldest → latest; latest year emphasised in brand blue
      { color: "#98a2b3", width: 2, dash: [5, 3] },
      { color: "#b7e23b", width: 2, dash: [] },
      { color: "#5b8cff", width: 2.5, dash: [] },
    ];
    const monthCard = RSC.chartCard(document.getElementById("monthly"), {
      title: "Monthly trend (last 3 years)",
      buildChart(canvas) {
        const m = M[calcBy], ys = trendYears();
        const isMoney = m.fmt === RS.money;
        const datasets = ys.map((y, i) => {
          const st = LINE[LINE.length - ys.length + i];
          return { type: "line", label: y,
            data: MONTHS.map(mo => (byYM[y] && byYM[y][mo]) ? Math.round(m.fn(byYM[y][mo])) : null),
            borderColor: st.color, backgroundColor: st.color, borderDash: st.dash,
            borderWidth: st.width, pointRadius: 2.5, tension: .3, spanGaps: false };
        });
        return new Chart(canvas, {
          data: { labels: MONTHS.map(RS.monthName), datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw == null ? "—" : m.fmt(c.raw)}` } } },
            scales: {
              y: { title: { display: true, text: disp(calcBy) },
                   ticks: { callback: v => isMoney ? RS.moneyC(v) : RS.fmtN(v) } },
              x: { ticks: { font: { size: 12 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        const m = M[calcBy], ys = trendYears();
        const safe = v => v == null ? "—" : m.fmt(v);
        const data = MONTHS.map(mo => {
          const r = { m: RS.monthName(mo) };
          ys.forEach(y => r[y] = (byYM[y] && byYM[y][mo]) ? m.fn(byYM[y][mo]) : null);
          return r;
        });
        const totals = { m: "Total" };
        ys.forEach(y => totals[y] = m.fn(byYear[y]));
        return RSC.table(
          [{ key: "m", label: "Month" }, ...ys.map(y => ({ key: y, label: y, fmt: safe }))],
          data, totals);
      },
    });

    document.getElementById("yoyCalcBy").onchange = e => {
      calcBy = e.target.value;
      yearCard.rerender(); monthCard.rerender();
    };
  },
});
