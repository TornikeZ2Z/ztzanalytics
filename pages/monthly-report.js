/* Monthly Report — the "Report for <Month>" deck (75 slides) rebuilt as ONE live page.
   Pick a Month; every panel recomputes for that month. Each panel folds the deck's
   repeated per-segment slides into a metric picker + optional segment picker + a
   YoY/MoM toggle (some metrics default YoY, some MoM — per Tornike). Zip-to-Zip scope
   via the global filter bar. All numbers come from the existing RS.M measure library. */
registerPage({
  id: "monthly-report",
  group: "pulse",
  title: "Monthly Report",
  async render(host) {
    const M = RS.M, MON = ["", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];

    // Load every dataset the report touches (parallel; tolerate ACL gaps).
    const grab = ds => RS.load(ds).catch(() => []);
    const [closing, moveboard, storage, claims, refunds, card] = await Promise.all(
      ["closing", "moveboard", "storage", "claims", "refunds", "card_expenses"].map(grab));

    // Latest month present in closing = default report month.
    const latest = closing.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
    if (!st.month) { st.month = latest ? +latest.slice(5, 7) : 5; st.year = latest ? +latest.slice(0, 4) : new Date().getFullYear(); }
    const curY = st.year, mo = st.month;

    /* ---- comparison engine ------------------------------------------------
       valueFor: run a measure for one (year, month), honouring the global
       slicers (company/source/…) by briefly setting the date range to that
       month — the same save/restore trick the YoY chips use. */
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: card };
    function valueFor(ds, measure, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo };
      const mm = String(m).padStart(2, "0"), last = new Date(y, m, 0).getDate();
      S.dateFrom = `${y}-${mm}-01`; S.dateTo = `${y}-${mm}-${String(last).padStart(2, "0")}`;
      S.dayFrom = S.dayTo = null;
      let f = RS.filtered(ds, rows, opts);
      if (opts && opts.pre) f = f.filter(opts.pre);
      const v = M[measure] ? M[measure].fn(f) : null;
      S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt;
      return v;
    }
    // YoY series: the month across the last N years. MoM series: last N months up to cur.
    function series(ds, measure, mode, opts) {
      if (mode === "MoM") {
        const out = []; let y = curY, m = mo;
        for (let i = 0; i < st.months; i++) { out.unshift({ k: MON[m].slice(0, 3) + " " + String(y).slice(2), v: valueFor(ds, measure, y, m, opts) }); m--; if (m < 1) { m = 12; y--; } }
        return out;
      }
      const out = [];
      for (let y = curY - st.years + 1; y <= curY; y++) out.push({ k: String(y), v: valueFor(ds, measure, y, mo, opts) });
      return out;
    }
    // segment series: measure per segment value for the selected month/year.
    function segSeries(ds, measure, col, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo }; const mm = String(m).padStart(2, "0"), last = new Date(y, m, 0).getDate();
      S.dateFrom = `${y}-${mm}-01`; S.dateTo = `${y}-${mm}-${String(last).padStart(2, "0")}`;
      let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
      const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
      S.dateFrom = sv.f; S.dateTo = sv.t;
      return Object.entries(g).map(([k, rs]) => ({ k, v: M[measure] ? M[measure].fn(rs) : null }))
        .sort((a, b) => (b.v || 0) - (a.v || 0));
    }

    const PALETTE = ["#b7a53b", "#6b3fa0", "#ef4444", "#10b981", "#1e3a5f", "#5b8cff", "#f59e0b"];
    const barData = (rows, fmt) => ({
      labels: rows.map(r => r.k),
      datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map((_, i) => PALETTE[i % PALETTE.length]),
        borderRadius: 4, maxBarThickness: 90 }],
      _fmt: fmt,
    });
    function drawBars(canvas, rows, fmt) {
      return new Chart(canvas, { type: "bar", data: barData(rows, fmt),
        options: { plugins: { legend: { display: false },
          tooltip: { callbacks: { label: c => fmt(c.parsed.y) } },
          datalabels: false },
          scales: { y: { ticks: { callback: v => fmt(v), color: "#8b98a8" }, grid: { color: "rgba(120,140,170,.12)" } },
            x: { ticks: { color: "#8b98a8" }, grid: { display: false } } },
          animation: false, maintainAspectRatio: false } });
    }

    /* ---- reusable folded panel: metric picker + (segment) + YoY/MoM toggle ---- */
    function panel(mount, cfg) {
      // cfg: { title, ds, metrics:[{name,label,fmt}], mode, segments?:[{col,label,pre?}], modes? }
      const modes = cfg.modes || ["YoY", "MoM"];
      let mIdx = 0, segIdx = 0, mode = cfg.mode || "YoY";
      const fmtOf = () => cfg.metrics[mIdx].fmt || RS.money;
      const ctl =
        (cfg.metrics.length > 1 ? `<span class="lbl">Metric</span><select class="mr-metric">${cfg.metrics.map((m, i) => `<option value="${i}">${RSC.esc(m.label)}</option>`).join("")}</select>` : "") +
        (cfg.segments ? `<span class="lbl">By</span><select class="mr-seg">${cfg.segments.map((s, i) => `<option value="${i}">${RSC.esc(s.label)}</option>`).join("")}</select>` : "") +
        `<span class="lbl">vs</span><select class="mr-mode">${modes.map(x => `<option${x === mode ? " selected" : ""}>${x}</option>`).join("")}</select>`;
      const rowsNow = () => {
        const met = cfg.metrics[mIdx];
        if (cfg.segments) { const s = cfg.segments[segIdx]; return segSeries(cfg.ds, met.name, s.col, curY, mo, s.pre ? { pre: s.pre } : null).slice(0, 20); }
        return series(cfg.ds, met.name, mode, met.pre ? { pre: met.pre } : null);
      };
      const card = RSC.chartCard(mount, {
        title: cfg.title, controlsHtml: ctl, controlsGraphOnly: false,
        buildChart: cv => { const r = rowsNow(); return r.some(x => x.v != null) ? drawBars(cv, r, fmtOf()) : null; },
        buildTable: () => { const r = rowsNow(), f = fmtOf();
          return `<table class="tab"><thead><tr><th>${cfg.segments ? "Segment" : (mode === "MoM" ? "Month" : "Year")}</th><th>${RSC.esc(cfg.metrics[mIdx].label)}</th></tr></thead><tbody>` +
            r.map(x => `<tr><td>${RSC.esc(x.k)}</td><td>${x.v == null ? "—" : f(x.v)}</td></tr>`).join("") + `</tbody></table>`; },
      });
      const wire = () => { const el = card.card;
        const met = el.querySelector(".mr-metric"), sg = el.querySelector(".mr-seg"), md = el.querySelector(".mr-mode");
        if (met) met.onchange = () => { mIdx = +met.value; card.rerender(); };
        if (sg) sg.onchange = () => { segIdx = +sg.value; card.rerender(); };
        if (md) md.onchange = () => { mode = md.value; card.rerender(); };
        // segment panels are point-in-time — hide the YoY/MoM toggle there
        if (cfg.segments && md) md.parentNode && (md.previousElementSibling.style.display = md.style.display = "none");
      };
      wire();
    }

    // ---- money/number formats
    const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, pct = RS.fmtPct;

    // ---- KPI header (headline metrics for the month, with YoY delta) ----
    const kpiDef = [
      { name: "Revenue", label: "Revenue", ds: "closing", fmt: moneyC },
      { name: "Operational Profit by Formula", label: "Operational Profit", ds: "closing", fmt: moneyC },
      { name: "Total Jobs", label: "Jobs Done", ds: "closing", fmt: fmtN },
      { name: "Booking Rate", label: "Booking Rate", ds: "moveboard", fmt: pct },
    ];

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Monthly Report</h1>
        <p>The monthly deck as one live page · <b id="mrMonLbl"></b> · pick a month below · Zip to Zip</p>
      </div>
      <div class="mr-controls" style="display:flex;gap:8px;align-items:center;margin:0 0 14px;flex-wrap:wrap">
        <span class="lbl" style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--faint)">Report month</span>
        <select id="mrMonth" class="rs-ctl-sel">${MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("")}</select>
        <select id="mrYear" class="rs-ctl-sel">${[curY, curY - 1, curY - 2].map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("")}</select>
        <span class="lbl" style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.08em;color:var(--faint);margin-left:8px">YoY span</span>
        <select id="mrYears" class="rs-ctl-sel">${[3, 4, 5].map(n => `<option${n === st.years ? " selected" : ""}>${n}</option>`).join("")}</select>
      </div>
      <div class="rs-kpis" id="mrKpis"></div>
      <div id="mrBody"></div>`;
    document.getElementById("mrMonLbl").textContent = MON[mo] + " " + curY;

    // KPI cards with YoY delta chip
    document.getElementById("mrKpis").innerHTML = kpiDef.map(k => {
      const cur = valueFor(k.ds, k.name, curY, mo), prev = valueFor(k.ds, k.name, curY - 1, mo);
      const g = (prev && cur != null) ? (cur - prev) / Math.abs(prev) : null;
      const chip = g == null ? "" : ` <span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(g)).toFixed(1)}%</span>`;
      return `<div class="kpi"><div class="l">${RSC.esc(k.label)}</div><div class="v">${cur == null ? "—" : k.fmt(cur)}</div><div class="s">${MON[mo]} · vs LY${chip}</div></div>`;
    }).join("");

    // ---- sections ----
    const body = document.getElementById("mrBody");
    const section = (title) => { const h = document.createElement("div"); h.className = "mr-sec";
      h.innerHTML = `<div class="rs-page-head" style="margin:18px 0 10px"><h1 style="font-size:16px">${RSC.esc(title)}</h1></div>`;
      body.appendChild(h); const grid = document.createElement("div"); grid.className = "rs-grid2"; body.appendChild(grid); return grid; };

    // Overview
    let g = section("Company Overview");
    panel(g, { title: `Revenue / Profit / Jobs — ${MON[mo]} YoY`, ds: "closing", mode: "YoY",
      metrics: [{ name: "Revenue", label: "Revenue", fmt: money }, { name: "Operational Profit by Formula", label: "Operational Profit", fmt: money }, { name: "Total Jobs", label: "Jobs", fmt: fmtN }] });
    panel(g, { title: `Booking Rate — ${MON[mo]}`, ds: "moveboard", mode: "YoY",
      metrics: [{ name: "Booking Rate", label: "Booking Rate", fmt: pct }] });

    // Leads
    g = section("Leads");
    panel(g, { title: `Leads Funnel — ${MON[mo]}`, ds: "moveboard", mode: "YoY",
      metrics: [{ name: "Qualified Leads", label: "Qualified Leads", fmt: fmtN }, { name: "Confirmed Leads", label: "Confirmed Leads", fmt: fmtN }, { name: "Total Leads", label: "Total Leads", fmt: fmtN }] });
    panel(g, { title: `Bad Leads by Reason — ${MON[mo]}`, ds: "moveboard",
      metrics: [{ name: "Total Leads", label: "Bad Leads", fmt: fmtN }],
      segments: [{ col: "Status", label: "Reason", pre: r => r["Status Category"] === "Bad Lead" }] });

    // Segments
    g = section("Segments");
    panel(g, { title: `By Moving Type — ${MON[mo]}`, ds: "closing",
      metrics: [{ name: "Revenue", label: "Revenue", fmt: money }, { name: "Operational Profit by Formula", label: "Operational Profit", fmt: money }, { name: "Total Jobs", label: "Jobs", fmt: fmtN }],
      segments: [{ col: "Moving Type", label: "Moving Type" }] });
    panel(g, { title: `By State — ${MON[mo]}`, ds: "closing",
      metrics: [{ name: "Revenue", label: "Revenue", fmt: money }, { name: "Operational Profit by Formula", label: "Operational Profit", fmt: money }, { name: "Total Jobs", label: "Jobs", fmt: fmtN }],
      segments: [{ col: "State Name", label: "State" }] });

    // Sales
    g = section("Sales Report");
    panel(g, { title: `By Sales Person — ${MON[mo]}`, ds: "closing",
      metrics: [{ name: "Revenue", label: "Revenue", fmt: money }, { name: "Operational Profit by Formula", label: "Operational Profit", fmt: money }, { name: "Total Jobs", label: "Jobs", fmt: fmtN }],
      segments: [{ col: "Sales Person", label: "Sales Person" }] });

    // Foreman
    g = section("Foreman Report");
    panel(g, { title: `By Foreman — ${MON[mo]}`, ds: "closing",
      metrics: [{ name: "Total Jobs", label: "Jobs", fmt: fmtN }, { name: "Revenue", label: "Revenue", fmt: money }, { name: "Total Packing Written", label: "Packing Written", fmt: money }],
      segments: [{ col: "Foreman", label: "Foreman" }] });

    // Advertising / Sources
    g = section("Advertising & Sources");
    panel(g, { title: `Revenue by Source — ${MON[mo]}`, ds: "closing",
      metrics: [{ name: "Revenue", label: "Revenue", fmt: money }, { name: "Operational Profit by Formula", label: "Operational Profit", fmt: money }, { name: "Total Jobs", label: "Jobs", fmt: fmtN }],
      segments: [{ col: "Source", label: "Source" }] });
    panel(g, { title: `Advertisement Expense by Source — ${MON[mo]}`, ds: "card_expenses",
      metrics: [{ name: "Advertisement Expense", label: "Ad Expense", fmt: money }],
      segments: [{ col: "Source", label: "Source", pre: r => Number(r["Is Advertising"]) === 1 }] });

    // Packing & Storage
    g = section("Packing & Storage");
    panel(g, { title: `Packing Written — ${MON[mo]} YoY`, ds: "closing", mode: "YoY",
      metrics: [{ name: "Total Packing Written", label: "Packing Written", fmt: money }, { name: "Forman Salary - Packing", label: "Packing Commission", fmt: money }] });
    panel(g, { title: `Storage Additional Revenue — ${MON[mo]}`, ds: "storage", mode: "MoM", modes: ["MoM", "YoY"],
      metrics: [{ name: "Storage Additional Revenue", label: "Storage Add'l Revenue", fmt: money }] });

    // ---- rewire month/year/span controls ----
    const rerenderAll = () => renderPage();
    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; rerenderAll(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; rerenderAll(); };
    document.getElementById("mrYears").onchange = e => { st.years = +e.target.value; rerenderAll(); };
  },
});
// page-local state persists across re-renders (month/year/span)
var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5, months: 12 });
