/* GO page: Leads Analysis — moveboard leads funnel.
   PBI source: General Overview "Leads Analysis" (GO-2). Global filter bar supplies all slicers. */
registerPage({
  id: "leads-analysis",
  group: "sales",
  title: "Leads Analysis",
  async render(host) {
    const allRows = await RS.load("moveboard");
    const rows = RS.filtered("moveboard", allRows);
    const M = RS.M;
    // RS.fmtN renders null as "0" — null-safe wrapper for nullable count cells
    const intNS = v => v == null ? "—" : RS.fmtN(v);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Leads Analysis</h1>
        <p>Moveboard lead funnel · <b>${RS.fmtN(rows.length)}</b> leads in scope
           <span class="freshness">· dates by Create Date</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div class="rs-grid2">
        <div id="bySource"></div>
        <div id="overTime"></div>
      </div>
      <div id="funnel"></div>`;

    if (!rows.length) {
      document.getElementById("bySource").innerHTML =
        `<div class="panel" style="padding:20px;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    const avgQ = M["Average Quote (avg)"].fn(rows);
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Total Leads", value: RS.fmtN(M["Total Leads"].fn(rows)), sub: "all moveboard leads" },
      { label: "Qualified Leads", value: RS.fmtN(M["Qualified Leads"].fn(rows)), sub: "excl. bad leads" },
      { label: "Confirmed Leads", value: RS.fmtN(M["Confirmed Leads"].fn(rows)), sub: "booked jobs" },
      { label: "Dead Leads", value: RS.fmtN(M["Dead Leads"].fn(rows)), sub: "bad leads" },
      { label: "Booking Rate", value: RS.fmtPct(M["Booking Rate"].fn(rows)), sub: "confirmed / qualified" },
      { label: "Average Quote", value: RS.moneyC(avgQ),
        sub: (avgQ == null ? "" : RS.money(avgQ) + " · ") + "avg of quoted leads" },
    ]);

    // ---- YoY chips: cur-year window (Jan-1 → max date of filtered rows) vs same
    // window last year, over the slicer-filtered but date-UNfiltered dataset.
    {
      const maxD = rows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (maxD) {
        const save = { f: RS.state.dateFrom, t: RS.state.dateTo, df: RS.state.dayFrom, dt: RS.state.dayTo };
        RS.state.dateFrom = RS.state.dateTo = null; RS.state.dayFrom = RS.state.dayTo = null;
        const noDate = RS.filtered("moveboard", allRows);
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
        const cTot = chip("Total Leads"), cConf = chip("Confirmed Leads");
        if (cTot && kpiSubs[0]) kpiSubs[0].innerHTML += cTot;
        if (cConf && kpiSubs[2]) kpiSubs[2].innerHTML += cConf;
      }
    }

    /* ---- shared: one pass over Source, funnel measures per source ---- */
    const FUNNEL = ["Total Leads", "Qualified Leads", "Confirmed Leads", "Dead Leads", "Booking Rate"];
    function bySource() {
      const g = {};
      // Group by Source Connector (PBI's active moveboard source axis) so Post-Card
      // splits into per-state buckets instead of collapsing into one "Post Card".
      rows.forEach(r => { const s = r["Source Connector"] || r.Source || "—"; (g[s] = g[s] || []).push(r); });
      return Object.entries(g).map(([s, rs]) => ({
        s, total: M["Total Leads"].fn(rs), qual: M["Qualified Leads"].fn(rs),
        conf: M["Confirmed Leads"].fn(rs), dead: M["Dead Leads"].fn(rs),
        rate: M["Booking Rate"].fn(rs),
      })).sort((a, b) => b.total - a.total);
    }

    /* ---- chart 1: Leads by Source (horizontal bar, Calculate-by swap) ---- */
    let calcBy = FUNNEL[0];
    const srcCard = RSC.chartCard(document.getElementById("bySource"), {
      title: "Leads by Source",
      controlsHtml: `<span class="lbl">Calculate by</span><select id="calcBy">` +
        FUNNEL.map(c => `<option ${c === calcBy ? "selected" : ""}>${c}</option>`).join("") + `</select>`,
      buildChart(canvas) {
        const m = RS.M[calcBy];
        const isPct = m.fmt === RS.fmtPct;
        // For Booking Rate rank by lead volume (rate on tiny sources is noise); else by the measure.
        const key = { "Total Leads": "total", "Qualified Leads": "qual", "Confirmed Leads": "conf", "Dead Leads": "dead", "Booking Rate": "rate" }[calcBy];
        let list = bySource();
        if (!isPct) list.sort((a, b) => (b[key] || 0) - (a[key] || 0));
        list = list.slice(0, 15);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.s),
            datasets: [{ label: calcBy, data: list.map(x => isPct ? x[key] : Math.round(x[key] || 0)),
              backgroundColor: "#b7e23b", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `${calcBy}: ${m.fmt(c.raw)}` } } },
            scales: {
              x: { title: { display: true, text: calcBy },
                   ticks: { callback: v => isPct ? RS.fmtPct(v) : RS.fmtN(v) } },
              y: { ticks: { font: { size: 11 } } },
            },
          },
        });
      },
      buildTable() {
        const all = bySource();
        const data = all.slice(0, 50);           // cap raw listing; sources are few in practice
        const tt = M["Total Leads"].fn(rows);
        const tq = M["Qualified Leads"].fn(rows), tc = M["Confirmed Leads"].fn(rows);
        const note = all.length > data.length
          ? `<p style="margin:6px 2px;color:var(--muted)">showing ${data.length} of ${all.length} sources</p>` : "";
        return RSC.table(
          [{ key: "s", label: "Source" }, { key: "total", label: "Total Leads", fmt: intNS },
           { key: "share", label: "% of Total", fmt: RS.fmtPct },
           { key: "qual", label: "Qualified", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
           { key: "dead", label: "Dead", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          data.map(x => Object.assign({}, x, { share: tt ? x.total / tt : null })),
          { s: "Total", total: tt, share: tt ? 1 : null, qual: tq, conf: tc,
            dead: M["Dead Leads"].fn(rows), rate: tq ? Math.min(1, tc / tq) : null }) + note;
      },
    });
    document.getElementById("calcBy").onchange = e => { calcBy = e.target.value; srcCard.rerender(); };

    /* ---- chart 2: Leads over time (monthly, Total + Confirmed lines) ---- */
    function byMonth() {
      const g = {};
      rows.forEach(r => { const k = r._y + "-" + String(r._m).padStart(2, "0"); (g[k] = g[k] || []).push(r); });
      return Object.entries(g).sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => ({
        k, label: RS.monthName(+k.slice(5)) + " " + k.slice(2, 4),
        total: M["Total Leads"].fn(rs), qual: M["Qualified Leads"].fn(rs),
        conf: M["Confirmed Leads"].fn(rs), dead: M["Dead Leads"].fn(rs),
        rate: M["Booking Rate"].fn(rs),
      }));
    }
    RSC.chartCard(document.getElementById("overTime"), {
      title: "Leads over time",
      buildChart(canvas) {
        const list = byMonth();
        return new Chart(canvas, {
          type: "line",
          data: {
            labels: list.map(x => x.label),
            datasets: [
              { label: "Total Leads", data: list.map(x => x.total), borderColor: "#5b8cff",
                backgroundColor: "#5b8cff", borderWidth: 2, pointRadius: 2, tension: .3 },
              { label: "Confirmed Leads", data: list.map(x => x.conf), borderColor: "#b7e23b",
                backgroundColor: "#b7e23b", borderWidth: 2, pointRadius: 2, tension: .3 },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${RS.fmtN(c.raw)}` } } },
            scales: {
              y: { title: { display: true, text: "Leads" }, ticks: { callback: v => RS.fmtN(v) } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        const data = byMonth();
        const tq = M["Qualified Leads"].fn(rows), tc = M["Confirmed Leads"].fn(rows);
        return RSC.table(
          [{ key: "label", label: "Month" }, { key: "total", label: "Total Leads", fmt: intNS },
           { key: "qual", label: "Qualified", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
           { key: "dead", label: "Dead", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          data,
          { label: "Total", total: M["Total Leads"].fn(rows), qual: tq, conf: tc,
            dead: M["Dead Leads"].fn(rows), rate: tq ? Math.min(1, tc / tq) : null });
      },
    });

    /* ---- panel: Funnel by Status Category ---- */
    const fp = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Funnel by Status Category</span></div><div class="tabwrap"></div>`);
    {
      const g = {};
      rows.forEach(r => { const s = r["Status Category"] || "—"; g[s] = (g[s] || 0) + 1; });
      const n = rows.length || 1;
      const data = Object.entries(g).map(([s, c]) => ({ s, c, share: c / n }))
        .sort((a, b) => b.c - a.c);
      fp.querySelector(".tabwrap").innerHTML = RSC.table(
        [{ key: "s", label: "Status Category" }, { key: "c", label: "Leads", fmt: intNS },
         { key: "share", label: "Share", fmt: RS.fmtPct }],
        data,
        { s: "Total", c: rows.length, share: rows.length ? 1 : null });
    }
    document.getElementById("funnel").appendChild(fp);
  },
});
