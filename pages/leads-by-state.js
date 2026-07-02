/* GO page: Leads by State — lead funnel by geography (state → county → city drill).
   PBI original: azure map + "Leads Tabular Analysis" pivot, hidden behind a FIXED visual
   filter (State Name IN CT/DE/MA/NJ/NY/PA/MD). We approximate the map with ranked bars
   (a real choropleth is a listed future improvement) and show ALL states — the global
   State slicer reproduces the NE-corridor cut when wanted. */
registerPage({
  id: "leads-by-state",
  group: "sales",
  title: "Leads by State",
  async render(host) {
    const all = await RS.load("moveboard");
    const rows = RS.filtered("moveboard", all);                                 // Create Date context
    const rowsB = RS.filtered("moveboard", all, { dateColumn: "Booked Date" }); // USERELATIONSHIP → Booked Date
    const M = RS.M;
    const nn = v => (v == null || v === "" ? "—" : String(v));
    const intNS = v => (v == null ? "—" : RS.fmtN(v));  // null-safe count cells
    const noteHtml = (shown, total, what) =>
      `<div style="color:var(--muted);font-size:11px;padding:6px 2px">Showing ${RS.fmtN(shown)} of ${RS.fmtN(total)} ${what}.</div>`;
    // Friendly empty state for a table/chart when no rows pass the current filters.
    const emptyHtml = what =>
      `<div style="color:var(--muted);font-size:12px;padding:24px 2px;text-align:center">No ${what} for the current filters.</div>`;

    /* Funnel stats per geography key, with this page's PBI date semantics:
       Total/Qualified/Dead over Create Date (PBI "Qualified Leads by Created Date"),
       Confirmed over Booked Date (PBI "Confirmed Leads by Booked Date"),
       Booking Rate = confirmed / qualified capped at 100% (matches RS.M["Booking Rate"]). */
    function funnelBy(keyFn, nameFn) {
      const g = new Map();
      const get = r => {
        const k = keyFn(r);
        let o = g.get(k);
        if (!o) { o = { key: k, name: nameFn(r), total: 0, qual: 0, conf: 0, dead: 0 }; g.set(k, o); }
        // Backfill a better display name (e.g. full State Name) if the first row
        // for this key lacked one: for states the fallback name equals the key.
        else if (o.name === "—" || o.name === o.key) { const n = nameFn(r); if (n !== "—") o.name = n; }
        return o;
      };
      rows.forEach(r => {
        const o = get(r); o.total++;
        if (r["Status Category"] === "Bad Lead") o.dead++; else o.qual++;
      });
      rowsB.forEach(r => { if (r["Status Category"] === "Confirmed") get(r).conf++; });
      const out = [...g.values()];
      out.forEach(o => { o.rate = o.qual ? Math.min(1, o.conf / o.qual) : null; });
      out.sort((a, b) => b.total - a.total);
      return out;
    }

    const states = funnelBy(r => nn(r.State),
      r => (r["State Name"] ? String(r["State Name"]) : nn(r.State)));
    const counties = funnelBy(r => nn(r["County Name"]) + "|" + nn(r.State),
      r => nn(r["County Name"]));
    counties.forEach(c => { c.st = c.key.split("|")[1]; });
    const cities = funnelBy(r => nn(r["City Name"]) + "|" + nn(r.State),
      r => nn(r["City Name"]));
    cities.forEach(c => { c.st = c.key.split("|")[1]; });

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Leads by State</h1>
        <p>Lead funnel by geography · <b>${RS.fmtN(rows.length)}</b> leads in scope
           <span class="freshness">· PBI fixes this page to 7 NE states — use the global State slicer to reproduce; map shown as ranked bars</span></p>
      </div>
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div class="rs-grid2" id="subs"></div>`;

    /* Empty state: nothing to chart under the current filters. */
    if (!rows.length && !rowsB.length) {
      document.getElementById("main").innerHTML =
        `<div class="panel" style="padding:24px;text-align:center;color:var(--muted)">No data for the current filters.</div>`;
      return;
    }

    /* Headline YoY chips: Jan-1 → max create date of the filtered rows, this year vs the
       same window last year, with date filters lifted (slicers kept) for a fair prior window. */
    const maxD = rows.reduce((a, r) => (r._d > a ? r._d : a), "");
    let chipTotal = "", chipConf = "";
    if (maxD) {
      const y = +maxD.slice(0, 4), mmdd = maxD.slice(4);   // "-MM-DD"
      const save = { f: RS.state.dateFrom, t: RS.state.dateTo, df: RS.state.dayFrom, dt: RS.state.dayTo };
      RS.state.dateFrom = RS.state.dateTo = null; RS.state.dayFrom = RS.state.dayTo = null;
      const ndC = RS.filtered("moveboard", all);                                  // Create Date, no date filter
      const ndB = RS.filtered("moveboard", all, { dateColumn: "Booked Date" });   // Booked Date, no date filter
      RS.state.dateFrom = save.f; RS.state.dateTo = save.t; RS.state.dayFrom = save.df; RS.state.dayTo = save.dt;
      const win = (rs, yr, dcol) => rs.filter(r => {
        const d = dcol ? String(r[dcol] || "").slice(0, 10) : r._d;
        return d >= yr + "-01-01" && d <= yr + mmdd;
      });
      const chip = (cur, prev) => !prev ? "" :
        `<span class="${cur >= prev ? "up" : "down"}">${cur >= prev ? "▲" : "▼"} ` +
        `${(100 * Math.abs((cur - prev) / prev)).toFixed(1)}%</span> vs same period ${y - 1}`;
      chipTotal = chip(M["Total Leads"].fn(win(ndC, y)), M["Total Leads"].fn(win(ndC, y - 1)));
      chipConf = chip(M["Confirmed Leads"].fn(win(ndB, y, "Booked Date")),
                      M["Confirmed Leads"].fn(win(ndB, y - 1, "Booked Date")));
    }

    const qual = M["Qualified Leads"].fn(rows);   // PBI: Qualified Leads by Created Date
    const conf = M["Confirmed Leads"].fn(rowsB);  // PBI: Confirmed Leads by Booked Date
    // inline: DISTINCTCOUNT(Moveboard[State]) — no PBI measure exists for this
    const nStates = new Set(rows.map(r => r.State).filter(v => v != null && v !== "")).size;
    RSC.kpis(document.getElementById("kpis"), [
      { label: "Total Leads", value: RS.fmtN(M["Total Leads"].fn(rows)), sub: "by created date" },
      { label: "Confirmed Leads", value: RS.fmtN(conf), sub: "by booked date" },
      { label: "Booking Rate", value: RS.fmtPct(qual ? Math.min(1, conf / qual) : null), sub: "confirmed / qualified" },
      { label: "States", value: RS.fmtN(nStates), sub: "distinct states in scope" },
    ]);
    // RSC.kpis escapes sub text — inject the YoY chips (trusted, page-built HTML) after render.
    const kpiSubs = document.querySelectorAll("#kpis .kpi .s");
    if (chipTotal) kpiSubs[0].innerHTML += " · " + chipTotal;
    if (chipConf) kpiSubs[1].innerHTML += " · " + chipConf;

    /* ---- main: horizontal ranked bars — the map stand-in ---- */
    const CALC = ["Total Leads", "Confirmed Leads", "Booking Rate"];
    let calcBy = CALC[0];
    const stateCard = RSC.chartCard(document.getElementById("main"), {
      title: "Leads by State",
      // The tabular view shows fixed funnel columns regardless of the "Calculate by"
      // selection (that selector only drives the ranked-bar chart), so hide it in Tabular.
      controlsGraphOnly: true,
      controlsHtml: `<span class="lbl">Calculate by</span><select id="lbsCalc">` +
        CALC.map(c => `<option ${c === calcBy ? "selected" : ""}>${c}</option>`).join("") + `</select>`,
      buildChart(canvas) {
        const isRate = calcBy === "Booking Rate";
        const val = s => isRate ? s.rate : (calcBy === "Confirmed Leads" ? s.conf : s.total);
        const list = states.filter(s => s.key !== "—").slice(0, 15)  // membership: top 15 by Total Leads
          .sort((a, b) => (val(b) || 0) - (val(a) || 0));
        const fmt = isRate ? RS.fmtPct : RS.fmtN;
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(s => s.name),
            datasets: [{ label: calcBy, data: list.map(val), backgroundColor: "#b7e23b", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `${calcBy}: ${fmt(c.raw)}` } } },
            scales: {
              x: { title: { display: true, text: calcBy },
                ticks: { callback: v => isRate ? Math.round(100 * v) + "%" : RS.fmtN(v) } },
              y: { ticks: { font: { size: 11 } } },
            },
          },
        });
      },
      buildTable() {
        const t = k => states.reduce((a, s) => a + s[k], 0);
        const tq = t("qual"), tc = t("conf"), tt = t("total");
        const shown = states.slice(0, 50).map(s => ({ ...s, share: tt ? s.total / tt : null }));
        if (!shown.length) return emptyHtml("states");
        return RSC.table(
          [{ key: "name", label: "State" }, { key: "total", label: "Total Leads", fmt: intNS },
           { key: "share", label: "% of Leads", fmt: RS.fmtPct },
           { key: "qual", label: "Qualified", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
           { key: "dead", label: "Dead", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          shown,
          { name: "Total", total: tt, share: tt ? 1 : null, qual: tq, conf: tc, dead: t("dead"),
            rate: tq ? Math.min(1, tc / tq) : null }) +
          (states.length > shown.length ? noteHtml(shown.length, states.length, "states — totals cover all") : "");
      },
    });
    document.getElementById("lbsCalc").onchange = e => { calcBy = e.target.value; stateCard.rerender(); };

    /* ---- sub 1: county drill level ---- */
    const subs = document.getElementById("subs");
    RSC.chartCard(subs, {
      title: "Top Counties",
      buildChart(canvas) {
        const list = counties.filter(c => c.name !== "—").slice(0, 20);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(c => c.st !== "—" ? `${c.name}, ${c.st}` : c.name),
            datasets: [{ label: "Total Leads", data: list.map(c => c.total), backgroundColor: "#b7e23b", borderRadius: 4 }],
          },
          options: {
            indexAxis: "y", responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false },
              tooltip: { callbacks: { label: c => `Total Leads: ${RS.fmtN(c.raw)}` } } },
            scales: { x: { ticks: { callback: v => RS.fmtN(v) } }, y: { ticks: { font: { size: 11 } } } },
          },
        });
      },
      buildTable() {  // top 50 keeps the tabular view fast on the 107k-row dataset
        const list = counties.filter(c => c.name !== "—");
        const shown = list.slice(0, 50);
        if (!shown.length) return emptyHtml("counties");
        return RSC.table(
          [{ key: "name", label: "County" }, { key: "st", label: "State" },
           { key: "total", label: "Total Leads", fmt: intNS }, { key: "qual", label: "Qualified", fmt: intNS },
           { key: "conf", label: "Confirmed", fmt: intNS }, { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
          shown) +
          (list.length > shown.length ? noteHtml(shown.length, list.length, "counties") : "");
      },
    });

    /* ---- sub 2: city drill level ---- */
    const cp = RSC.el("div", "panel",
      `<div class="panel-head"><span class="panel-title">Top Cities</span></div><div class="tabwrap"></div>`);
    const cityList = cities.filter(c => c.name !== "—");
    const cityShown = cityList.slice(0, 30);
    cp.querySelector(".tabwrap").innerHTML = cityShown.length ? (RSC.table(
      [{ key: "name", label: "City" }, { key: "st", label: "State" },
       { key: "total", label: "Leads", fmt: intNS }, { key: "conf", label: "Confirmed", fmt: intNS },
       { key: "rate", label: "Booking Rate", fmt: RS.fmtPct }],
      cityShown) +
      (cityList.length > cityShown.length ? noteHtml(cityShown.length, cityList.length, "cities") : ""))
      : emptyHtml("cities");
    subs.appendChild(cp);
  },
});
