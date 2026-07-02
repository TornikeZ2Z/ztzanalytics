/* GO page: Analysis by Category — the generic explorer: any core measure sliced
   by any dimension (the PBI "Analyze by" field parameter × "Calculate by").
   CF Range / Job Type come from moveboard via the Request Joinkey bridge
   (client-side lookup — fct_closing doesn't carry them physically yet). */
registerPage({
  id: "analysis-by-category",
  group: "overview",
  title: "Analysis by Category",
  async render(host) {
    const [closingAll, moveboardAll] = await Promise.all([RS.load("closing"), RS.load("moveboard")]);
    const rows = RS.filtered("closing", closingAll);
    const M = RS.M;
    const nz = fmt => v => (v == null || (typeof v === "number" && isNaN(v))) ? "—" : fmt(v);

    // ---- moveboard bridge: Request Joinkey -> CF Range / Service Type (built once, cached)
    if (!RS._mbBridge) {
      RS._mbBridge = new Map();
      moveboardAll.forEach(r => {
        const k = r["Request Joinkey"];
        if (k && !RS._mbBridge.has(k))
          RS._mbBridge.set(k, { cf: r["CF Range"] || null, svc: r["Service Type"] || null });
      });
    }
    const bridge = RS._mbBridge;
    const mbOf = r => bridge.get(r["Request Joinkey"]);

    // ---- the "Analyze by" dimension registry (PBI field parameter, 11 options)
    const DIMS = {
      "Source":        r => r.Source,
      "Foreman":       r => r.Foreman,
      "Sales Person":  r => r["Sales Person"],
      "State":         r => r.State,
      "Moving Type":   r => r["Moving Type"],
      "Job Type":      r => { const b = mbOf(r); return b && b.svc; },
      "Size of Move":  r => r["Size of Move"],
      "Bill Range":    r => r["Bill Range"],
      "CF Range":      r => { const b = mbOf(r); return b && b.cf; },
      "Year":          r => r._y,
      "Month":         r => RS.monthName(r._m),
    };
    const DIM_SORT = { // dimensions with a natural (non-value) order
      "Year": (a, b) => a.k.localeCompare(b.k),
      "Month": (a, b) => "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(a.k) -
                         "JanFebMarAprMayJunJulAugSepOctNovDec".indexOf(b.k),
      "Bill Range": (a, b) => (RS.num(a.k.replace(/[^0-9]/g, "").slice(0, 5)) || 9e9) -
                              (RS.num(b.k.replace(/[^0-9]/g, "").slice(0, 5)) || 9e9),
    };
    const CALC = ["Total Jobs", "Revenue", "Net Cash", "Card Payment",
                  "Net Cash + Card Payment", "Hours Worked by Forman", "Average Bill"];
    let dimBy = "Source", calcBy = "Revenue";

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Analysis by Category</h1>
        <p>Any measure, sliced by any dimension · <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· CF Range & Job Type via the moveboard request link</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div id="trend"></div>`;

    if (!rows.length) {
      document.getElementById("main").innerHTML =
        `<div class="panel" style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    const kBill = M["Revenue"].fn(rows), kNet = M["Net Cash"].fn(rows),
          kCard = M["Card Payment"].fn(rows), kAvg = M["Average Bill"].fn(rows);
    const kClosings = M["Total Revenue"].fn(rows), kTrips = M["Additional Revenue from Trips"].fn(rows);
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Total Jobs", value: RS.fmtN(M["Total Jobs"].fn(rows)), sub: "closed jobs (incl. trips)" },
      { label: "Revenue", value: RS.moneyC(kBill),
        sub: nz(RS.moneyC)(kClosings) + " closings + " + nz(RS.moneyC)(kTrips) + " trips" },
      { label: "Net Cash", value: RS.moneyC(kNet), sub: nz(RS.money)(kNet) + " · net + trips" },
      { label: "Card Payment", value: RS.moneyC(kCard), sub: nz(RS.money)(kCard) + " · card volume" },
      { label: "Avg Bill / Job", value: RS.moneyC(kAvg), sub: nz(RS.money)(kAvg) + " per job" },
    ]);

    // ---- YoY chips: cur-year window (Jan-1 → max date of filtered rows) vs same
    // window last year, over the slicer-filtered but date-UNfiltered dataset.
    {
      const maxD = rows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (maxD) {
        const save = { f: RS.state.dateFrom, t: RS.state.dateTo, df: RS.state.dayFrom, dt: RS.state.dayTo };
        RS.state.dateFrom = RS.state.dateTo = null; RS.state.dayFrom = RS.state.dayTo = null;
        const noDate = RS.filtered("closing", closingAll);
        RS.state.dateFrom = save.f; RS.state.dateTo = save.t; RS.state.dayFrom = save.df; RS.state.dayTo = save.dt;
        const y = maxD.slice(0, 4);
        const curW = noDate.filter(r => r._d >= y + "-01-01" && r._d <= maxD);
        const prevW = noDate.filter(r => r._d >= (+y - 1) + "-01-01" && r._d <= (+y - 1) + maxD.slice(4));
        const chip = name => {
          const cur = M[name].fn(curW), prev = M[name].fn(prevW);
          if (!prev || cur == null) return "";
          const g = (cur - prev) / Math.abs(prev);
          return ` <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}% vs LY</span>`;
        };
        const kpiSubs = document.getElementById("kpis").querySelectorAll(".kpi .s");
        const cJobs = chip("Total Jobs"), cBill = chip("Revenue");
        if (cJobs && kpiSubs[0]) kpiSubs[0].innerHTML += cJobs;
        if (cBill && kpiSubs[1]) kpiSubs[1].innerHTML += cBill;
      }
    }

    const grouped = () => {
      const get = DIMS[dimBy], g = {};
      rows.forEach(r => {
        let k = get(r); k = (k == null || k === "") ? "—" : String(k);
        (g[k] = g[k] || []).push(r);
      });
      const m = M[calcBy];
      let out = Object.entries(g).map(([k, rs]) => ({ k, v: m.fn(rs), n: rs.length, rs }));
      out.sort(DIM_SORT[dimBy] || ((a, b) => (b.v || 0) - (a.v || 0)));
      return out;
    };

    // ---- main: measure by dimension (bar + share) with the two switchers
    const controls = `
      <span class="lbl">Analyze by</span><select id="abcDim">` +
      Object.keys(DIMS).map(d => `<option ${d === dimBy ? "selected" : ""}>${d}</option>`).join("") +
      `</select><span class="lbl">Calculate by</span><select id="abcCalc">` +
      CALC.map(c => `<option ${c === calcBy ? "selected" : ""}>${c}</option>`).join("") + `</select>`;
    const mainCard = RSC.chartCard(document.getElementById("main"), {
      title: "Breakdown",
      controlsHtml: controls,
      buildChart(canvas) {
        const m = M[calcBy];
        const list = grouped().slice(0, 20);
        const horiz = Object.keys(DIMS).indexOf(dimBy) < 5;
        // truncate long category labels — applied to whichever axis holds the categories
        const trunc = { callback(v) { const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
          return typeof l === "string" && l.length > 14 ? l.slice(0, 13) + "…" : l; } };
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ label: calcBy, data: list.map(x => x.v == null ? 0 : +x.v.toFixed(2)),
              backgroundColor: "#b7e23b", borderRadius: 5 }],
          },
          options: {
            indexAxis: horiz ? "y" : "x",
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `${calcBy}: ${m.fmt(c.raw)}` } } },
            scales: {
              x: { ticks: Object.assign({}, horiz ? {} : trunc,
                    (dimBy === "Month" || dimBy === "Year")
                      ? { autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } : {}) },
              y: horiz ? { ticks: trunc } : {},
            },
          },
        });
      },
      buildTable() {
        const m = M[calcBy];
        const list = grouped();
        if (!list.length)
          return `<div style="padding:20px;color:var(--muted)">No categories to break down for the current filters.</div>`;
        const total = m.fn(rows);
        const shown = list.slice(0, 50);
        return RSC.table(
          [{ key: "k", label: dimBy },
           { key: "jobs", label: "Total Jobs", fmt: nz(RS.fmtN) },
           { key: "v", label: calcBy, fmt: nz(m.fmt) },
           { key: "sh", label: "% of total", fmt: RS.fmtPct },
           { key: "avg", label: "Avg Bill", fmt: nz(RS.money) }],
          shown.map(x => ({
            k: x.k, jobs: x.n, v: x.v,
            sh: total ? (x.v || 0) / total : null,
            avg: M["Average Bill"].fn(x.rs),
          })),
          { k: "Total", jobs: rows.length, v: total, sh: total ? 1 : null, avg: M["Average Bill"].fn(rows) }) +
          (list.length > shown.length
            ? `<div style="padding:6px 2px;color:var(--muted);font-size:11px">Showing ${shown.length} of ${list.length} categories.</div>`
            : "");
      },
    });

    // ---- trend: monthly lines for the top 5 categories of the chosen dimension
    const PAL = ["#b7e23b", "#5b8cff", "#a78bfa", "#fbbf24", "#f87171"];
    const trendCard = RSC.chartCard(document.getElementById("trend"), {
      title: "Monthly trend — top 5 categories",
      buildChart(canvas) {
        const m = M[calcBy];
        const top = grouped().filter(x => x.k !== "—").slice(0, 5);
        const months = [...new Set(rows.map(r => r._y + "-" + String(r._m).padStart(2, "0")))]
          .sort().slice(-18);
        const datasets = top.map((t, i) => {
          const byM = {};
          t.rs.forEach(r => { const k = r._y + "-" + String(r._m).padStart(2, "0");
            (byM[k] = byM[k] || []).push(r); });
          return { type: "line", label: t.k,
            data: months.map(k => byM[k] ? +(m.fn(byM[k]) || 0).toFixed(1) : null),
            borderColor: PAL[i], backgroundColor: PAL[i],
            borderWidth: 2, pointRadius: 2, tension: .3 };
        });
        return new Chart(canvas, {
          data: { labels: months.map(k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4)), datasets },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw == null ? "—" : M[calcBy].fmt(c.raw)}` } } },
            scales: { x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14 } } },
          },
        });
      },
      buildTable() {
        // matrix() groups by a physical column — __dim is materialized below and
        // refreshed on every switcher change (rerenderAll).
        if (!rows.length)
          return `<div style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
        return RSC.matrix(rows, "__dim", calcBy, { rowLabel: dimBy, lastN: 13 });
      },
    });
    rows.forEach(r => { const k = DIMS[dimBy](r); r.__dim = (k == null || k === "") ? "—" : String(k); });

    const rerenderAll = () => {
      rows.forEach(r => { const k = DIMS[dimBy](r); r.__dim = (k == null || k === "") ? "—" : String(k); });
      mainCard.rerender(); trendCard.rerender();
    };
    document.getElementById("abcDim").onchange = e => { dimBy = e.target.value; rerenderAll(); };
    document.getElementById("abcCalc").onchange = e => { calcBy = e.target.value; rerenderAll(); };
  },
});
