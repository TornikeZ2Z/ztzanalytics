/* GO page: Leads Analysis — moveboard leads funnel.
   PBI source: General Overview "Leads Analysis" (GO-2). Global filter bar supplies all slicers. */
registerPage({
  id: "leads-analysis",
  group: "sales",
  title: "Leads — Funnel (conversion)",
  async render(host) {
    const allRows = await RS.load("moveboard");
    const rows = RS.filtered("moveboard", allRows);            // Create Date basis (Total/Qualified/Dead)
    // Confirmed Leads & Booking Rate slice on BOOKED Date in PBI (USERELATIONSHIP Booked Date ID).
    const rowsB = RS.filtered("moveboard", allRows, { dateColumn: "Booked Date" });
    const M = RS.M;
    // RS.fmtN renders null as "0" — null-safe wrapper for nullable count cells
    const intNS = v => v == null ? "—" : RS.fmtN(v);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Leads — Funnel (conversion)</h1>
        <p>Moveboard lead funnel (formerly Leads Analysis) · <b>${RS.fmtN(rows.length)}</b> leads in scope
           <span class="freshness">· leads by Create Date · confirmed by Booked Date</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div class="rs-grid2">
        <div id="bySource"></div>
        <div id="overTime"></div>
      </div>
      <div id="funnel"></div>`;

    if (!rows.length) {
      const empty = `<div class="panel" style="padding:20px;color:var(--muted)">No leads match the current filters.</div>`;
      document.getElementById("bySource").innerHTML = empty;
      document.getElementById("overTime").innerHTML = "";
      document.getElementById("funnel").innerHTML = "";
      return;
    }

    const avgQ = M["Average Quote (avg)"].fn(rows);
    const kQual = M["Qualified Leads"].fn(rows);
    const kConf = M["Confirmed Leads"].fn(rowsB);   // Confirmed on Booked Date
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Total Leads", value: RS.fmtN(M["Total Leads"].fn(rows)), sub: "all Moveboard leads" },
      { label: "Qualified Leads", value: RS.fmtN(kQual), sub: "excl. bad leads" },
      { label: "Confirmed Leads", value: RS.fmtN(kConf), sub: "booked jobs · by booked date" },
      { label: "Bad Leads", value: RS.fmtN(M["Dead Leads"].fn(rows)), sub: "junk / unreachable requests" },
      { label: "Booking Rate", value: RS.fmtPct(RS.bookingRate(rows, rowsB)),
        sub: "confirmed (booked) / qualified (created)" },
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
        const growthChip = (cur, prev) => {
          if (!prev || cur == null) return "";
          const g = (cur - prev) / Math.abs(prev);
          return ` <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}% vs LY</span>`;
        };
        // Confirmed compares on BOOKED date (matches the KPI basis).
        const confWin = (f, t) => noDate.filter(r => {
          const bd = String(r["Booked Date"] || "").slice(0, 10);
          return bd >= f && bd <= t && r["Status Category"] === "Confirmed"; }).length;
        const kpiSubs = document.getElementById("kpis").querySelectorAll(".kpi .s");
        const cTot = growthChip(M["Total Leads"].fn(curRows), M["Total Leads"].fn(prevRows));
        const cConf = growthChip(confWin(y + "-01-01", maxD), confWin((+y - 1) + "-01-01", (+y - 1) + maxD.slice(4)));
        if (cTot && kpiSubs[0]) kpiSubs[0].innerHTML += cTot;
        if (cConf && kpiSubs[2]) kpiSubs[2].innerHTML += cConf;
      }
    }

    /* ---- shared: one pass over Source, funnel measures per source ---- */
    const FUNNEL = ["Total Leads", "Qualified Leads", "Confirmed Leads", "Dead Leads", "Booking Rate"];
    // Display mapping: registry key "Dead Leads" is shown as "Bad Leads" (the Moveboard
    // status the sales team sees daily). Keys stay untouched; only labels are mapped.
    const disp = k => k === "Dead Leads" ? "Bad Leads" : RS.displayName(k);
    // Group by Source Connector (PBI's active moveboard source axis) so Post-Card splits
    // into per-state buckets. Total/Qualified/Dead on Create-date rows; Confirmed on
    // Booked-date rows (a=create-basis, b=booked-basis for the same source bucket).
    const srcKey = r => r["Source Connector"] || r.Source || "—";
    function bySource() {
      const g = {};
      const get = s => g[s] || (g[s] = { s, a: [], b: [] });
      rows.forEach(r => get(srcKey(r)).a.push(r));
      rowsB.forEach(r => get(srcKey(r)).b.push(r));
      return Object.values(g).map(o => {
        return { s: o.s, total: M["Total Leads"].fn(o.a), qual: M["Qualified Leads"].fn(o.a),
          conf: M["Confirmed Leads"].fn(o.b),
          dead: M["Dead Leads"].fn(o.a), rate: RS.bookingRate(o.a, o.b) };
      }).sort((a, b) => b.total - a.total);
    }

    /* ---- chart 1: Leads by Source (horizontal bar, Show swap) ---- */
    let calcBy = FUNNEL[0];
    const srcCard = RSC.chartCard(document.getElementById("bySource"), {
      title: "Leads by Source",
      controlsGraphOnly: true,   // tabular view shows the full funnel table; "Show:" only drives the chart
      controlsHtml: `<span class="lbl">Show:</span><select id="calcBy">` +
        FUNNEL.map(c => `<option value="${c}" ${c === calcBy ? "selected" : ""}>${disp(c)}</option>`).join("") + `</select>`,
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
            datasets: [{ label: disp(calcBy), data: list.map(x => isPct ? x[key] : Math.round(x[key] || 0)),
              backgroundColor: "#b7e23b", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `${disp(calcBy)}: ${m.fmt(c.raw)}` } } },
            scales: {
              x: { title: { display: true, text: disp(calcBy) },
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
        const tq = M["Qualified Leads"].fn(rows), tc = M["Confirmed Leads"].fn(rowsB);
        const note = all.length > data.length
          ? `<p style="margin:6px 2px;color:var(--muted)">showing ${data.length} of ${all.length} sources</p>` : "";
        return RSC.table(
          [{ key: "s", label: "Source" }, { key: "total", label: "Total Leads", fmt: intNS },
           { key: "share", label: "% of Total", fmt: RS.fmtPct },
           { key: "qual", label: "Qualified", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
           { key: "dead", label: "Bad", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          data.map(x => Object.assign({}, x, { share: tt ? x.total / tt : null })),
          { s: "Total", total: tt, share: tt ? 1 : null, qual: tq, conf: tc,
            dead: M["Dead Leads"].fn(rows), rate: RS.bookingRate(rows, rowsB) }) + note;
      },
    });
    document.getElementById("calcBy").onchange = e => { calcBy = e.target.value; srcCard.rerender(); };

    /* ---- chart 2: Leads over time (monthly, Total + Confirmed lines) ---- */
    function byMonth() {
      const g = {};   // create-month buckets (a) + booked-month buckets (b) merged on month key
      const get = k => g[k] || (g[k] = { k, a: [], b: [] });
      rows.forEach(r => get(r._y + "-" + String(r._m).padStart(2, "0")).a.push(r));
      // Confirmed is bucketed by BOOKED month (PBI USERELATIONSHIP Booked Date).
      rowsB.forEach(r => { const bd = String(r["Booked Date"] || "").slice(0, 7); if (bd.length === 7) get(bd).b.push(r); });
      return Object.values(g).sort((x, y) => x.k.localeCompare(y.k)).map(o => {
        return { k: o.k, label: RS.monthName(+o.k.slice(5)) + " " + o.k.slice(2, 4),
          total: M["Total Leads"].fn(o.a), qual: M["Qualified Leads"].fn(o.a),
          conf: M["Confirmed Leads"].fn(o.b), dead: M["Dead Leads"].fn(o.a),
          rate: RS.bookingRate(o.a, o.b) };
      });
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
        const tq = M["Qualified Leads"].fn(rows), tc = M["Confirmed Leads"].fn(rowsB);
        return RSC.table(
          [{ key: "label", label: "Month" }, { key: "total", label: "Total Leads", fmt: intNS },
           { key: "qual", label: "Qualified", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
           { key: "dead", label: "Bad", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          data,
          { label: "Total", total: M["Total Leads"].fn(rows), qual: tq, conf: tc,
            dead: M["Dead Leads"].fn(rows), rate: RS.bookingRate(rows, rowsB) });
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
