/* Monthly Report — the "Report for <Month>" deck rebuilt as ONE live page.
   STATIC by design (Tornike): NO per-panel switches — every report is pre-set (right
   metric + right comparison baked in) and rendered automatically, top-to-bottom like the
   deck, just live + narrated. Only control = the report Month. Zip-to-Zip scope.
   Colors: prior years cool blue, current year brand lime (the latest bar pops);
   segment leaders highlighted; values drawn on the bars. */
registerPage({
  id: "monthly-report",
  group: "pulse",
  title: "Monthly Report",
  async render(host) {
    const M = RS.M, MON = ["", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, pct = RS.fmtPct;

    const grab = ds => RS.load(ds).catch(() => []);
    const [closing, moveboard, storage, claims, refunds, card] = await Promise.all(
      ["closing", "moveboard", "storage", "claims", "refunds", "card_expenses"].map(grab));
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: card };

    const latest = closing.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
    if (!st.month) { st.month = latest ? +latest.slice(5, 7) : 5; st.year = latest ? +latest.slice(0, 4) : new Date().getFullYear(); }
    const curY = st.year, mo = st.month, monLbl = MON[mo] + " " + curY;

    /* ---- month engine: run a measure for one (year, month), honouring global slicers ---- */
    function valueFor(ds, measure, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo };
      const mm = String(m).padStart(2, "0"), last = new Date(y, m, 0).getDate();
      S.dateFrom = `${y}-${mm}-01`; S.dateTo = `${y}-${mm}-${String(last).padStart(2, "0")}`; S.dayFrom = S.dayTo = null;
      let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
      const v = M[measure] ? M[measure].fn(f) : null;
      S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt;
      return v;
    }
    const years = () => { const a = []; for (let y = curY - st.years + 1; y <= curY; y++) a.push(y); return a; };
    function trendSeries(ds, measure, opts) { return years().map(y => ({ k: String(y), v: valueFor(ds, measure, y, mo, opts) })); }
    function two(ds, measure, opts) { return [curY - 1, curY].map(y => ({ k: String(y), v: valueFor(ds, measure, y, mo, opts) })); }
    function segSeries(ds, measure, col, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo }; const mm = String(mo).padStart(2, "0"), last = new Date(curY, mo, 0).getDate();
      S.dateFrom = `${curY}-${mm}-01`; S.dateTo = `${curY}-${mm}-${String(last).padStart(2, "0")}`;
      let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
      const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
      S.dateFrom = sv.f; S.dateTo = sv.t;
      return Object.entries(g).map(([k, rs]) => ({ k, v: M[measure] ? M[measure].fn(rs) : null }))
        .filter(x => x.v != null).sort((a, b) => (b.v || 0) - (a.v || 0));
    }

    /* ---- insight (from the same series each chart shows; never invented) ---- */
    function insightFor(kind, rows, cfg) {
      const vals = rows.filter(r => r.v != null && !isNaN(r.v)); if (vals.length < 2) return "";
      const fmt = cfg.fmt, L = cfg.metricLabel;
      if (kind === "trend") {
        const cur = vals[vals.length - 1], prev = vals[vals.length - 2], first = vals[0];
        const gp = prev.v ? (cur.v - prev.v) / Math.abs(prev.v) : null, max = vals.reduce((a, b) => (b.v > a.v ? b : a));
        let s = `${L} was ${fmt(cur.v)} in ${cfg.month}`;
        if (gp != null) s += `, ${gp >= 0 ? "up" : "down"} ${Math.abs(gp * 100).toFixed(0)}% vs ${prev.k} (${fmt(prev.v)})`;
        if (max.k === cur.k && vals.length >= 3) s += ` — the strongest ${cfg.monthName} in ${vals.length} years`;
        else if (first.v) { const gf = (cur.v - first.v) / Math.abs(first.v); s += `, ${gf >= 0 ? "+" : ""}${(gf * 100).toFixed(0)}% over the span`; }
        return s + ".";
      }
      const tot = vals.reduce((a, b) => a + (b.v || 0), 0), top = vals[0], seg = (cfg.segLabel || "segment").toLowerCase();
      let s = `${top.k} leads with ${fmt(top.v)}`;
      if (tot) s += ` (${(top.v / tot * 100).toFixed(0)}% of the ${fmt(tot)} total)`;
      if (vals.length >= 4) { const t3 = vals.slice(0, 3).reduce((a, b) => a + b.v, 0); s += `; top 3 ${seg}s = ${(tot ? t3 / tot * 100 : 0).toFixed(0)}%`; }
      if (vals.length >= 3) s += `; lowest ${vals[vals.length - 1].k} (${fmt(vals[vals.length - 1].v)})`;
      return s + ".";
    }

    /* ---- palette: prior years cool-blue (older = fainter), current year lime ---- */
    const LIME = "#b7e23b";
    const trendColors = n => Array.from({ length: n }, (_, i) => i === n - 1 ? LIME : `rgba(91,140,255,${(0.4 + 0.45 * i / Math.max(1, n - 1)).toFixed(2)})`);
    const segColors = n => Array.from({ length: n }, (_, i) => i === 0 ? LIME : `rgba(91,140,255,${Math.max(0.32, 1 - i / Math.max(1, n)).toFixed(2)})`);

    /* value labels drawn atop bars (deck style) — fmt captured per chart in closure,
       NOT via chart options (Chart.js auto-invokes function-valued plugin options). */
    const vlabelsPlugin = fmt => ({ id: "vlabels", afterDatasetsDraw(chart) {
      const ctx = chart.ctx; ctx.save(); ctx.font = "600 11px Inter"; ctx.fillStyle = "#c7d2e0"; ctx.textAlign = "center";
      chart.data.datasets.forEach((ds, di) => chart.getDatasetMeta(di).data.forEach((el, i) => {
        const v = ds.data[i]; if (v == null) return; ctx.fillText(fmt(v), el.x, el.y - 6);
      })); ctx.restore();
    } });

    /* ---- static panel: title + colored bars(+values) + one insight line, NO controls ---- */
    function bars(mount, cfg) {
      const series = cfg.series.filter(r => r.v != null);
      const card = document.createElement("div"); card.className = "panel";
      card.innerHTML = `<div class="panel-head"><span class="panel-title">${RSC.esc(cfg.title)}</span></div>
        <div class="chartbox" style="height:300px"><canvas></canvas></div>`;
      mount.appendChild(card);
      if (series.length) {
        new Chart(card.querySelector("canvas"), {
          type: "bar",
          data: { labels: series.map(r => r.k), datasets: [{ data: series.map(r => r.v),
            backgroundColor: (cfg.colors || trendColors)(series.length), borderRadius: 5, maxBarThickness: 74 }] },
          options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => cfg.fmt(c.parsed.y) } } },
            scales: { y: { ticks: { callback: v => cfg.fmt(v), color: "#8b98a8" }, grid: { color: "rgba(120,140,170,.10)" } },
              x: { ticks: { color: "#9fb0c4", font: { size: 11 }, maxRotation: 60, minRotation: 0 }, grid: { display: false } } },
            layout: { padding: { top: 18 } }, animation: false, maintainAspectRatio: false },
          plugins: [vlabelsPlugin(cfg.fmt)],
        });
      } else card.querySelector(".chartbox").innerHTML = `<div style="height:100%;display:grid;place-items:center;color:var(--muted)">No data for ${monLbl}.</div>`;
      const txt = insightFor(cfg.kind, cfg.series, { fmt: cfg.fmt, metricLabel: cfg.metricLabel || cfg.title, month: monLbl, monthName: MON[mo], segLabel: cfg.segLabel || "" });
      if (txt) { const n = document.createElement("div");
        n.style.cssText = "margin-top:2px;padding:9px 12px;border-left:3px solid var(--brand);background:var(--brand-glow);border-radius:0 8px 8px 0;font-size:12.5px;color:var(--ink);line-height:1.5";
        n.innerHTML = '<b style="color:var(--brand)">Insight · </b>' + RSC.esc(txt); card.appendChild(n); }
      return card;
    }

    // ---- KPI header + executive summary ----
    const kpiDef = [
      { name: "Revenue", label: "Revenue", ds: "closing", fmt: moneyC },
      { name: "Operational Profit by Formula", label: "Operational Profit", ds: "closing", fmt: moneyC },
      { name: "Total Jobs", label: "Jobs Done", ds: "closing", fmt: fmtN },
      { name: "Booking Rate", label: "Booking Rate", ds: "moveboard", fmt: pct },
    ];
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Report for ${MON[mo]} ${curY}</h1>
        <p>Your monthly deck, live and auto-narrated · Zip to Zip
          <span style="margin-left:10px"><select id="mrMonth" class="rs-ctl-sel">${MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("")}</select>
          <select id="mrYear" class="rs-ctl-sel">${[curY + 1, curY, curY - 1, curY - 2].filter(y => y <= curY + 1).map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("")}</select></span></p>
      </div>
      <div class="rs-kpis" id="mrKpis"></div>
      <div id="mrBody"></div>`;
    const kfacts = kpiDef.map(k => { const cur = valueFor(k.ds, k.name, curY, mo), prev = valueFor(k.ds, k.name, curY - 1, mo);
      return { label: k.label, fmt: k.fmt, cur, prev, g: (prev && cur != null) ? (cur - prev) / Math.abs(prev) : null }; });
    document.getElementById("mrKpis").innerHTML = kfacts.map(k => {
      const chip = k.g == null ? "" : ` <span class="${k.g >= 0 ? "up" : "down"}">${k.g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(k.g)).toFixed(1)}%</span>`;
      return `<div class="kpi"><div class="l">${RSC.esc(k.label)}</div><div class="v">${k.cur == null ? "—" : k.fmt(k.cur)}</div><div class="s">${MON[mo]} · vs LY${chip}</div></div>`;
    }).join("");
    {
      const f = {}; kfacts.forEach(x => f[x.label] = x);
      const gg = x => (x && x.g != null) ? `${x.g >= 0 ? "up" : "down"} ${Math.abs(x.g * 100).toFixed(0)}% YoY` : "flat";
      const p = [];
      if (f["Revenue"].cur != null) p.push(`revenue ${moneyC(f["Revenue"].cur)} (${gg(f["Revenue"])})`);
      if (f["Operational Profit"].cur != null) p.push(`operational profit ${moneyC(f["Operational Profit"].cur)} (${gg(f["Operational Profit"])})`);
      if (f["Jobs Done"].cur != null) p.push(`${fmtN(f["Jobs Done"].cur)} jobs (${gg(f["Jobs Done"])})`);
      if (f["Booking Rate"].cur != null) p.push(`booking rate ${pct(f["Booking Rate"].cur)}`);
      const rg = f["Revenue"].g, tone = rg > 0.1 ? "A strong " : rg < -0.05 ? "A softer " : "A steady ";
      const box = document.createElement("div");
      box.style.cssText = "margin:2px 0 18px;padding:14px 16px;border:1px solid var(--line);border-left:4px solid var(--brand);background:linear-gradient(90deg,var(--brand-glow),transparent);border-radius:12px;font-size:14px;color:var(--ink);line-height:1.55";
      box.innerHTML = `<b style="color:var(--brand)">Executive summary · </b>${RSC.esc(tone + MON[mo] + " " + curY + " — " + p.join(", ") + ".")}`;
      document.getElementById("mrKpis").after(box);
    }

    // ---- sections: every report explicit, no switches ----
    const body = document.getElementById("mrBody");
    const section = t => { body.insertAdjacentHTML("beforeend", `<div class="rs-page-head" style="margin:20px 0 10px"><h1 style="font-size:16px">${RSC.esc(t)}</h1></div>`);
      const grid = document.createElement("div"); grid.className = "rs-grid2"; body.appendChild(grid); return grid; };
    const yoy = (g, measure, label, ds, fmt, pre) => bars(g, { title: `${label} — ${MON[mo]} YoY`, series: trendSeries(ds, measure, pre ? { pre } : null), fmt, kind: "trend", metricLabel: label });
    const seg = (g, measure, label, ds, col, segLabel, fmt, pre) => bars(g, { title: `${label} by ${segLabel} — ${MON[mo]}`, series: segSeries(ds, measure, col, pre ? { pre } : null).slice(0, 14), fmt, kind: "segment", colors: segColors, metricLabel: label, segLabel });

    let g = section("Company Overview");
    yoy(g, "Revenue", "Total Revenue", "closing", money);
    yoy(g, "Operational Profit by Formula", "Operational Profit", "closing", money);
    yoy(g, "Total Jobs", "Jobs Done", "closing", fmtN);
    bars(g, { title: `Booking Rate — ${MON[mo]} YoY`, series: trendSeries("moveboard", "Booking Rate"), fmt: pct, kind: "trend", metricLabel: "Booking Rate" });

    g = section("Leads");
    yoy(g, "Qualified Leads", "Qualified Leads", "moveboard", fmtN);
    yoy(g, "Confirmed Leads", "Confirmed Leads", "moveboard", fmtN);
    bars(g, { title: `Bad Leads by Reason — ${MON[mo]}`, series: segSeries("moveboard", "Total Leads", "Status", { pre: r => r["Status Category"] === "Bad Lead" }).slice(0, 12), fmt: fmtN, kind: "segment", colors: segColors, metricLabel: "Bad Leads", segLabel: "Reason" });
    seg(g, "Total Leads", "Total Leads", "moveboard", "Status Category", "Status", fmtN);

    g = section("Returned & Recommended Customers");
    const rrPre = { pre: r => r.Source === "Returned Customer" || r.Source === "Recommended" };
    bars(g, { title: `Total Revenue — Returned vs Recommended — ${MON[mo]}`, series: segSeries("closing", "Revenue", "Source", rrPre), fmt: money, kind: "segment", colors: segColors, metricLabel: "Revenue", segLabel: "customer type" });
    bars(g, { title: `Operational Profit — Returned vs Recommended — ${MON[mo]}`, series: segSeries("closing", "Operational Profit by Formula", "Source", rrPre), fmt: money, kind: "segment", colors: segColors, metricLabel: "Operational Profit", segLabel: "customer type" });

    g = section("By Moving Type");
    ["Local Moving", "Long Distance"].forEach(mt => {
      const pre = r => (r["Moving Type"] || "").indexOf(mt === "Long Distance" ? "Distance" : "Local") >= 0 || r["Moving Type"] === mt;
      yoy(g, "Revenue", `${mt}: Revenue`, "closing", money, pre);
      yoy(g, "Operational Profit by Formula", `${mt}: Operational Profit`, "closing", money, pre);
    });

    g = section("By State");
    seg(g, "Revenue", "Total Revenue", "closing", "State Name", "State", money);
    seg(g, "Operational Profit by Formula", "Operational Profit", "closing", "State Name", "State", money);
    seg(g, "Total Jobs", "Total Jobs", "closing", "State Name", "State", fmtN);

    g = section("Sales Report");
    seg(g, "Revenue", "Total Revenue", "closing", "Sales Person", "Sales Person", money);
    seg(g, "Operational Profit by Formula", "Operational Profit", "closing", "Sales Person", "Sales Person", money);
    seg(g, "Total Jobs", "Total Jobs", "closing", "Sales Person", "Sales Person", fmtN);

    g = section("Foreman Report");
    seg(g, "Total Jobs", "Total Jobs", "closing", "Foreman", "Foreman", fmtN);
    seg(g, "Revenue", "Total Revenue", "closing", "Foreman", "Foreman", money);
    seg(g, "Total Packing Written", "Packing Written", "closing", "Foreman", "Foreman", money);

    g = section("Advertising & Sources");
    seg(g, "Revenue", "Total Revenue", "closing", "Source", "Source", money);
    seg(g, "Operational Profit by Formula", "Operational Profit", "closing", "Source", "Source", money);
    seg(g, "Advertisement Expense", "Advertisement Expense", "card_expenses", "Source", "Source", money, r => Number(r["Is Advertising"]) === 1);

    g = section("Packing & Storage");
    yoy(g, "Total Packing Written", "Packing Written", "closing", money);
    yoy(g, "Storage Additional Revenue", "Storage Additional Revenue", "storage", money);

    // ---- month controls ----
    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; renderPage(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; renderPage(); };
  },
});
var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5 });
