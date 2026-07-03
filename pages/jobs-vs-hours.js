/* GO page: Jobs Done Vs Hours Worked — reference page implementation.
   Global filter bar supplies all slicers (multi-select + date range + day between). */
registerPage({
  id: "jobs-vs-hours",
  group: "overview",
  title: "Jobs Done vs Hours Worked",
  async render(host) {
    const allRows = await RS.load("closing");
    const rows = RS.filtered("closing", allRows);
    const M = RS.M;
    const nz = fmt => v => (v == null || (typeof v === "number" && isNaN(v))) ? "—" : fmt(v);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Jobs Done vs Hours Worked</h1>
        <p>Foreman output vs hours worked · <b>${RS.fmtN(rows.length)}</b> jobs in scope
           <span class="freshness">· appended trip jobs count as jobs; linked-trip extras shown separately</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div class="rs-grid2" id="subs"></div>`;

    if (!rows.length) {
      document.getElementById("main").innerHTML =
        `<div class="panel" style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    const kBill = M["Revenue"].fn(rows), kNet = M["Net Cash"].fn(rows), kCard = M["Card Payment"].fn(rows);
    const kClosings = M["Total Revenue"].fn(rows), kTrips = M["Additional Revenue from Trips"].fn(rows);
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Total Jobs", value: RS.fmtN(M["Total Jobs"].fn(rows)), sub: "closed jobs (incl. trips)" },
      { label: "Revenue", value: RS.moneyC(kBill), sub: RS.moneyC(kClosings) + " job bills + " + RS.moneyC(kTrips) + " linked-trip extras" },
      { label: "Net Cash", value: RS.moneyC(kNet), sub: RS.money(kNet) + " · net + trips" },
      { label: "Card Payment", value: RS.moneyC(kCard), sub: RS.money(kCard) + " · card volume" },
      { label: "Hours Worked", value: RS.fmtN(M["Hours Worked by Forman"].fn(rows)), sub: "foreman hours" },
      { label: "Jobs / 100 hrs", value: RS.fmt1(M["Jobs per 100 Hours"].fn(rows)), sub: "efficiency" },
    ]);

    // ---- YoY chips: cur-year window (Jan-1 → max date of filtered rows) vs same
    // window last year, over the slicer-filtered but date-UNfiltered dataset.
    {
      const maxD = rows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (maxD) {
        const save = { f: RS.state.dateFrom, t: RS.state.dateTo, df: RS.state.dayFrom, dt: RS.state.dayTo };
        RS.state.dateFrom = RS.state.dateTo = null; RS.state.dayFrom = RS.state.dayTo = null;
        const noDate = RS.filtered("closing", allRows);
        RS.state.dateFrom = save.f; RS.state.dateTo = save.t; RS.state.dayFrom = save.df; RS.state.dayTo = save.dt;
        const y = maxD.slice(0, 4);
        const curRows = noDate.filter(r => r._d >= y + "-01-01" && r._d <= maxD);
        const prevRows = noDate.filter(r => r._d >= (+y - 1) + "-01-01" && r._d <= (+y - 1) + maxD.slice(4));
        const chip = name => {
          const cur = M[name].fn(curRows), prev = M[name].fn(prevRows);
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

    // ---- main combo chart: Calculate-by measure (bars) + Hours (line) by foreman
    const CALC = ["Total Jobs", "Revenue", "Net Cash", "Card Payment", "Operating Profit Before Commission"];
    let calcBy = CALC[1];
    const card = RSC.chartCard(document.getElementById("main"), {
      title: "By Foreman",
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">Calculate by</span><select id="calcBy">` +
        CALC.map(c => `<option ${c === calcBy ? "selected" : ""}>${c}</option>`).join("") + `</select>`,
      buildChart(canvas) {
        const m = RS.M[calcBy];
        const g = {};
        rows.forEach(r => { const f = r.Foreman || "—"; (g[f] = g[f] || []).push(r); });
        const list = Object.entries(g)
          .map(([f, rs]) => ({ f, v: m.fn(rs), h: rs.reduce((a, r) => a + RS.num(r["Foreman Hours"]), 0) }))
          .sort((a, b) => (b.v || 0) - (a.v || 0)).slice(0, 20);
        const isMoney = m.fmt === RS.money;
        return new Chart(canvas, {
          data: {
            labels: list.map(x => x.f),
            datasets: [
              { type: "bar", label: calcBy, data: list.map(x => Math.round(x.v)), backgroundColor: "#b7e23b", borderRadius: 4, yAxisID: "y", order: 2 },
              { type: "line", label: "Hours Worked", data: list.map(x => Math.round(x.h)), borderColor: "#5b8cff", backgroundColor: "#5b8cff", borderWidth: 2, pointRadius: 2, tension: .3, yAxisID: "y1", order: 1 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => c.dataset.yAxisID === "y" ? `${calcBy}: ${m.fmt(c.raw)}` : `Hours: ${RS.fmtN(c.raw)}` } } },
            scales: {
              y: { position: "left", title: { display: true, text: calcBy }, ticks: { callback: v => isMoney ? RS.moneyC(v) : RS.fmtN(v) } },
              y1: { position: "right", title: { display: true, text: "Hours Worked" }, grid: { drawOnChartArea: false } },
              x: { ticks: { font: { size: 11 }, maxRotation: 60, minRotation: 40 } },
            },
          },
        });
      },
      buildTable() {
        const g = {};
        rows.forEach(r => { const f = r.Foreman || "—"; (g[f] = g[f] || []).push(r); });
        const data = Object.entries(g).map(([f, rs]) => ({
          f, jobs: RS.M["Total Jobs"].fn(rs), bill: RS.M["Revenue"].fn(rs),
          closings: RS.M["Total Revenue"].fn(rs), trips: RS.M["Additional Revenue from Trips"].fn(rs),
          net: RS.M["Net Cash"].fn(rs), card: RS.M["Card Payment"].fn(rs),
          nc: RS.M["Operating Profit Before Commission"].fn(rs), hrs: rs.reduce((a, r) => a + RS.num(r["Foreman Hours"]), 0),
        })).sort((a, b) => b.jobs - a.jobs);
        const tot = k => data.reduce((a, x) => a + (x[k] || 0), 0);
        const totBill = tot("bill");
        data.forEach(x => { x.share = totBill ? (x.bill || 0) / totBill : null; });
        const shown = data.slice(0, 50);
        return RSC.table(
          [{ key: "f", label: "Foreman" }, { key: "jobs", label: "Jobs", fmt: nz(RS.fmtN) },
           { key: "bill", label: "Revenue", fmt: nz(RS.money) }, { key: "share", label: "% of Revenue", fmt: RS.fmtPct },
           { key: "closings", label: "Job Bills", fmt: nz(RS.money) }, { key: "trips", label: "Linked-Trip Extras", fmt: nz(RS.money) },
           { key: "net", label: "Net Cash", fmt: nz(RS.money) },
           { key: "card", label: "Card Payment", fmt: nz(RS.money) }, { key: "nc", label: "Op. Profit", fmt: nz(RS.money) },
           { key: "hrs", label: "Hours", fmt: nz(RS.fmtN) }],
          shown,
          { f: "Total", jobs: tot("jobs"), bill: totBill, share: totBill ? 1 : null,
            closings: tot("closings"), trips: tot("trips"), net: tot("net"),
            card: tot("card"), nc: tot("nc"), hrs: tot("hrs") }) +
          (data.length > shown.length
            ? `<div style="color:var(--muted);font-size:12px;padding:6px 2px">Showing ${shown.length} of ${data.length} foremen (totals cover all).</div>`
            : "");
      },
    });
    document.getElementById("calcBy").onchange = e => { calcBy = e.target.value; card.rerender(); };

    // ---- sub-table 1: Sales Person rollup · sub-table 2: monthly matrix
    const subs = document.getElementById("subs");
    const sp = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Sales Person</span></div><div class="tabwrap"></div>`);
    {
      const g = {};
      rows.forEach(r => { const s = r["Sales Person"] || "—"; (g[s] = g[s] || []).push(r); });
      const all = Object.entries(g).map(([s, rs]) => ({
        s, jobs: rs.length, bill: RS.M["Revenue"].fn(rs), avg: RS.M["Average Bill"].fn(rs),
      })).sort((a, b) => b.bill - a.bill);
      const data = all.slice(0, 30);
      sp.querySelector(".tabwrap").innerHTML = all.length ? (RSC.table(
        [{ key: "s", label: "Sales Person" }, { key: "jobs", label: "Jobs", fmt: nz(RS.fmtN) },
         { key: "bill", label: "Revenue", fmt: nz(RS.money) }, { key: "avg", label: "Avg Bill", fmt: nz(RS.money) }],
        data) +
        (all.length > data.length
          ? `<div style="color:var(--muted);font-size:12px;padding:6px 2px">Showing ${data.length} of ${all.length} sales people.</div>`
          : ""))
        : `<div style="padding:16px;color:var(--muted)">No sales-person data for the current filters.</div>`;
    }
    subs.appendChild(sp);

    const mx = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Jobs by Foreman × Month</span></div><div class="tabwrap"></div>`);
    mx.querySelector(".tabwrap").innerHTML = RSC.matrix(rows, "Foreman", "Total Jobs", { rowLabel: "Foreman", lastN: 13 });
    subs.appendChild(mx);
  },
});
