/* Monthly Report — the "Report for <Month>" deck reimagined as ONE beautiful, live,
   auto-narrated page. STATIC (no switches): every report is pre-set and rendered
   automatically. Chart type is matched to the data — gradient trend bars (current year
   highlighted), horizontal ranked bars for people/sources, doughnuts for share, a combo
   for packing, sparklines in the KPIs. Zip-to-Zip scope. Only control: the report Month. */
registerPage({
  id: "monthly-report",
  group: "pulse",
  title: "Monthly Report",
  async render(host) {
    const M = RS.M, MON = ["", "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const MShort = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, pct = RS.fmtPct;

    const grab = ds => RS.load(ds).catch(() => []);
    const [closing, moveboard, storage] = await Promise.all(["closing", "moveboard", "storage"].map(grab));
    const [claims, refunds, card] = await Promise.all(["claims", "refunds", "card_expenses"].map(grab));
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: card };

    const latest = closing.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
    if (!st.month) { st.month = latest ? +latest.slice(5, 7) : 5; st.year = latest ? +latest.slice(0, 4) : new Date().getFullYear(); }
    const curY = st.year, mo = st.month, monLbl = MON[mo] + " " + curY;

    /* ---- month engine ---- */
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
    const yearsArr = () => { const a = []; for (let y = curY - st.years + 1; y <= curY; y++) a.push(y); return a; };
    const trendSeries = (ds, measure, opts) => yearsArr().map(y => ({ k: String(y), v: valueFor(ds, measure, y, mo, opts) }));
    // last 12 months ending at the report month (for sparklines / MoM)
    function momSeries(ds, measure, opts, n) {
      const out = []; let y = curY, m = mo;
      for (let i = 0; i < (n || 12); i++) { out.unshift({ k: MShort[m] + " " + String(y).slice(2), v: valueFor(ds, measure, y, m, opts) }); m--; if (m < 1) { m = 12; y--; } }
      return out;
    }
    function segSeries(ds, measure, col, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo }; const mm = String(mo).padStart(2, "0"), last = new Date(curY, mo, 0).getDate();
      S.dateFrom = `${curY}-${mm}-01`; S.dateTo = `${curY}-${mm}-${String(last).padStart(2, "0")}`;
      let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
      const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
      S.dateFrom = sv.f; S.dateTo = sv.t;
      return Object.entries(g).map(([k, rs]) => ({ k, v: M[measure] ? M[measure].fn(rs) : null }))
        .filter(x => x.v != null && x.v !== 0).sort((a, b) => (b.v || 0) - (a.v || 0));
    }

    /* ---- insight ---- */
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

    /* ---- palette + gradients ---- */
    const LIME = "#b7e23b", BLUE = "#5b8cff";
    const CAT = ["#b7e23b", "#2dd4bf", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#fb7185", "#38bdf8", "#c084fc", "#facc15", "#4ade80"];
    const vgrad = (cv, hex) => { const ctx = cv.getContext("2d"), g = ctx.createLinearGradient(0, 0, 0, cv.height || 300); g.addColorStop(0, hex + "f0"); g.addColorStop(1, hex + "33"); return g; };
    const hgrad = (cv, hex) => { const ctx = cv.getContext("2d"), g = ctx.createLinearGradient(0, 0, cv.width || 400, 0); g.addColorStop(0, hex + "40"); g.addColorStop(1, hex + "f0"); return g; };
    const vlabels = (fmt, horiz) => ({ id: "vl", afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = "700 11px Inter"; ctx.fillStyle = "#dbe4ef";
      ch.data.datasets.forEach((ds, di) => ch.getDatasetMeta(di).data.forEach((el, i) => {
        const v = ds.data[i]; if (v == null) return;
        if (horiz) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v), el.x + 6, el.y); }
        else { ctx.textAlign = "center"; ctx.fillText(fmt(v), el.x, el.y - 6); }
      })); ctx.restore();
    } });

    const mkCard = (mount, title, sub, h) => { const c = document.createElement("div"); c.className = "panel";
      c.innerHTML = `<div class="panel-head"><span class="panel-title">${RSC.esc(title)}</span>${sub ? `<span class="lbl" style="color:var(--faint);font-weight:700">${RSC.esc(sub)}</span>` : ""}</div><div class="chartbox" style="height:${h || 300}px"><canvas></canvas></div>`;
      mount.appendChild(c); return c; };
    const noteEl = (c, txt) => { if (!txt) return; const n = document.createElement("div");
      n.style.cssText = "margin-top:2px;padding:10px 13px;border-left:3px solid var(--brand);background:var(--brand-glow);border-radius:0 9px 9px 0;font-size:12.5px;color:var(--ink);line-height:1.55";
      n.innerHTML = '<b style="color:var(--brand)">Insight · </b>' + RSC.esc(txt); c.appendChild(n); };

    /* ---- chart builders ---- */
    function trendBars(mount, cfg) {   // YoY: gradient bars, current year lime, dashed avg line
      const s = cfg.series.filter(r => r.v != null);
      const c = mkCard(mount, cfg.title, `${MShort[mo]} · ${st.years}-yr`, 300); const cv = c.querySelector("canvas");
      if (!s.length) { c.querySelector(".chartbox").innerHTML = empty(); return c; }
      const avg = s.reduce((a, b) => a + b.v, 0) / s.length;
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v),
          backgroundColor: s.map((_, i) => vgrad(cv, i === s.length - 1 ? LIME : BLUE)), borderRadius: 6, maxBarThickness: 66 }] },
        options: { plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => cfg.fmt(x.parsed.y) } } },
          scales: { y: { ticks: { callback: v => cfg.fmt(v), color: "#8b98a8", maxTicksLimit: 6 }, grid: { color: "rgba(120,140,170,.09)" }, beginAtZero: true },
            x: { ticks: { color: "#aeb9c9", font: { size: 12, weight: "600" } }, grid: { display: false } } },
          layout: { padding: { top: 20 } }, animation: { duration: 500 }, maintainAspectRatio: false },
        plugins: [vlabels(cfg.fmt), { id: "avg", afterDatasetsDraw(ch) { const ya = ch.scales.y, y = ya.getPixelForValue(avg), a = ch.chartArea, ctx = ch.ctx;
          ctx.save(); ctx.strokeStyle = "rgba(219,228,239,.35)"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = "rgba(219,228,239,.6)"; ctx.font = "10px Inter"; ctx.textAlign = "right"; ctx.fillText("avg " + cfg.fmt(avg), a.right - 2, y - 4); ctx.restore(); } }] });
      noteEl(c, insightFor("trend", cfg.series, { fmt: cfg.fmt, metricLabel: cfg.metricLabel, month: monLbl, monthName: MON[mo] }));
      return c;
    }
    function rankBars(mount, cfg) {    // segment: horizontal ranked bars, leader lime, gradient
      const s = cfg.series.slice(0, cfg.top || 12);
      const c = mkCard(mount, cfg.title, monLbl, Math.max(200, 46 + s.length * 30)); const cv = c.querySelector("canvas");
      if (!s.length) { c.querySelector(".chartbox").innerHTML = empty(); return c; }
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v),
          backgroundColor: s.map((_, i) => hgrad(cv, i === 0 ? LIME : BLUE)), borderRadius: 5, maxBarThickness: 22 }] },
        options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => cfg.fmt(x.parsed.x) } } },
          scales: { x: { ticks: { callback: v => cfg.fmt(v), color: "#8b98a8", maxTicksLimit: 5 }, grid: { color: "rgba(120,140,170,.09)" }, beginAtZero: true },
            y: { ticks: { color: "#cdd6e2", font: { size: 11.5, weight: "600" } }, grid: { display: false } } },
          layout: { padding: { right: 54 } }, animation: { duration: 500 }, maintainAspectRatio: false },
        plugins: [vlabels(cfg.fmt, true)] });
      noteEl(c, insightFor("segment", cfg.series, { fmt: cfg.fmt, metricLabel: cfg.metricLabel, segLabel: cfg.segLabel }));
      return c;
    }
    function donut(mount, cfg) {        // composition / share
      const s = cfg.series.slice(0, 8).filter(r => r.v > 0);
      const c = mkCard(mount, cfg.title, monLbl, 300); const cv = c.querySelector("canvas");
      if (!s.length) { c.querySelector(".chartbox").innerHTML = empty(); return c; }
      const tot = s.reduce((a, b) => a + b.v, 0);
      new Chart(cv, { type: "doughnut",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => CAT[i % CAT.length]), borderColor: "#0f1523", borderWidth: 2, hoverOffset: 6 }] },
        options: { cutout: "62%", plugins: { legend: { position: "right", labels: { color: "#c7d2e0", font: { size: 11.5 }, boxWidth: 12, padding: 8 } },
          tooltip: { callbacks: { label: x => `${x.label}: ${cfg.fmt(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)` } } }, animation: { duration: 500 }, maintainAspectRatio: false },
        plugins: [{ id: "center", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2;
          ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = "#e9eef6"; ctx.font = "800 20px Inter"; ctx.fillText(cfg.fmt(tot), x, y - 2);
          ctx.fillStyle = "#8b98a8"; ctx.font = "600 11px Inter"; ctx.fillText("total", x, y + 16); ctx.restore(); } }] });
      noteEl(c, insightFor("segment", cfg.series, { fmt: cfg.fmt, metricLabel: cfg.metricLabel, segLabel: cfg.segLabel }));
      return c;
    }
    function combo(mount, cfg) {        // bars + line (packing)
      const s = cfg.series.filter(r => r.v != null); const c = mkCard(mount, cfg.title, `${MShort[mo]} · ${st.years}-yr`, 300); const cv = c.querySelector("canvas");
      if (!s.length) { c.querySelector(".chartbox").innerHTML = empty(); return c; }
      const line = cfg.lineSeries.map(r => r.v);
      new Chart(cv, { data: { labels: s.map(r => r.k),
        datasets: [{ type: "bar", data: s.map(r => r.v), backgroundColor: s.map((_, i) => vgrad(cv, i === s.length - 1 ? LIME : BLUE)), borderRadius: 6, maxBarThickness: 60, yAxisID: "y", label: cfg.metricLabel },
          { type: "line", data: line, borderColor: "#2dd4bf", backgroundColor: "#2dd4bf", tension: .35, pointRadius: 3, yAxisID: "y1", label: cfg.lineLabel }] },
        options: { plugins: { legend: { display: true, labels: { color: "#c7d2e0", font: { size: 11 }, boxWidth: 12 } } },
          scales: { y: { position: "left", ticks: { callback: v => cfg.fmt(v), color: "#8b98a8", maxTicksLimit: 6 }, grid: { color: "rgba(120,140,170,.09)" } },
            y1: { position: "right", ticks: { callback: v => cfg.lineFmt(v), color: "#2dd4bf" }, grid: { display: false } },
            x: { ticks: { color: "#aeb9c9", font: { size: 12, weight: "600" } }, grid: { display: false } } }, animation: { duration: 500 }, maintainAspectRatio: false } });
      noteEl(c, insightFor("trend", cfg.series, { fmt: cfg.fmt, metricLabel: cfg.metricLabel, month: monLbl, monthName: MON[mo] }));
      return c;
    }
    const empty = () => `<div style="height:100%;display:grid;place-items:center;color:var(--muted)">No data for ${monLbl}.</div>`;

    /* ---- detail tables ---- */
    function tableCard(mount, title, head, body, note) {
      const c = document.createElement("div"); c.className = "panel";
      c.innerHTML = `<div class="panel-head"><span class="panel-title">${RSC.esc(title)}</span><span class="lbl" style="color:var(--faint);font-weight:700">${monLbl}</span></div>
        <div class="tabwrap" style="max-height:440px">${head}${body}</div>`;
      mount.appendChild(c); noteEl(c, note); return c;
    }
    function funnelBy(col) {
      const rows = DS.moveboard; if (!rows.length) return [];
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo }; const mm = String(mo).padStart(2, "0"), last = new Date(curY, mo, 0).getDate();
      S.dateFrom = `${curY}-${mm}-01`; S.dateTo = `${curY}-${mm}-${String(last).padStart(2, "0")}`;
      const f = RS.filtered("moveboard", rows); S.dateFrom = sv.f; S.dateTo = sv.t;
      const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); const o = g[k] = g[k] || { tot: 0, q: 0, c: 0, bad: 0 };
        o.tot++; const sc = r["Status Category"]; if (sc === "Bad Lead") o.bad++; else o.q++; if (sc === "Confirmed") o.c++; });
      return Object.entries(g).map(([k, o]) => ({ k, tot: o.tot, q: o.q, c: o.c, bad: o.bad, br: o.q ? o.c / o.q : null })).sort((a, b) => b.tot - a.tot);
    }
    function funnelTable(mount, title, col, segLabel) {
      const d = funnelBy(col).slice(0, 15); if (!d.length) return;
      const t = d.reduce((a, b) => ({ tot: a.tot + b.tot, q: a.q + b.q, c: a.c + b.c, bad: a.bad + b.bad }), { tot: 0, q: 0, c: 0, bad: 0 });
      const head = `<table class="tab"><thead><tr><th>${RSC.esc(segLabel)}</th><th>Total</th><th>Qualified</th><th>Confirmed</th><th>Bad</th><th>Booking %</th></tr></thead>`;
      const body = `<tbody>` + d.map(r => `<tr><td>${RSC.esc(r.k)}</td><td>${fmtN(r.tot)}</td><td>${fmtN(r.q)}</td><td>${fmtN(r.c)}</td><td>${fmtN(r.bad)}</td><td>${r.br == null ? "—" : pct(r.br)}</td></tr>`).join("")
        + `<tr style="font-weight:750"><td>Total</td><td>${fmtN(t.tot)}</td><td>${fmtN(t.q)}</td><td>${fmtN(t.c)}</td><td>${fmtN(t.bad)}</td><td>${t.q ? pct(t.c / t.q) : "—"}</td></tr></tbody></table>`;
      tableCard(mount, title, head, body, d[0] ? `${d[0].k} had the most leads (${fmtN(d[0].tot)}, ${d[0].br == null ? "—" : pct(d[0].br)} booking).` : "");
    }
    function storageTable(mount) {
      const ms = []; let y = curY, m = mo; for (let i = 0; i < 14; i++) { ms.unshift({ y, m }); m--; if (m < 1) { m = 12; y--; } }
      const rows = ms.map(({ y, m }) => ({ k: MShort[m] + " " + y, bill: valueFor("closing", "Revenue", y, m), jobs: valueFor("closing", "Total Jobs", y, m), add: valueFor("storage", "Storage Additional Revenue", y, m) }));
      const head = `<table class="tab"><thead><tr><th>Month</th><th>Total Bill</th><th>Jobs</th><th>Storage Add'l Rev</th></tr></thead>`;
      const body = `<tbody>` + rows.map(r => `<tr><td>${r.k}</td><td>${r.bill == null ? "—" : money(r.bill)}</td><td>${r.jobs == null ? "—" : fmtN(r.jobs)}</td><td>${r.add == null ? "—" : money(r.add)}</td></tr>`).join("") + `</tbody></table>`;
      tableCard(mount, "Storage Income — last 14 months", head, body, "");
    }

    /* ---- report cover + KPI header (with sparklines) ---- */
    host.innerHTML = `
      <div style="margin:0 0 16px;padding:20px 22px;border-radius:16px;position:relative;overflow:hidden;
        background:radial-gradient(900px 300px at 90% -40%,rgba(183,226,59,.14),transparent 60%),linear-gradient(120deg,#111a2b,#0d1320);border:1px solid var(--line)">
        <button id="mrPrint" title="Print or save the whole report as a PDF" style="position:absolute;top:18px;right:20px;background:var(--brand);color:var(--brand-ink);border:0;border-radius:10px;padding:9px 15px;font-size:12.5px;font-weight:800;cursor:pointer">⬇ Download PDF</button>
        <div style="font-size:11px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--brand)">Monthly Report · Zip to Zip</div>
        <h1 style="font-size:30px;font-weight:800;letter-spacing:-.6px;margin:4px 0 2px;color:var(--ink)">Report for ${MON[mo]} ${curY}</h1>
        <div style="color:var(--muted);font-size:13.5px">Auto-narrated · live from the warehouse ·
          <select id="mrMonth" class="rs-ctl-sel">${MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("")}</select>
          <select id="mrYear" class="rs-ctl-sel">${[curY + 1, curY, curY - 1, curY - 2].filter(y => y <= curY + 1).map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("")}</select></div>
      </div>
      <div class="rs-kpis" id="mrKpis" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))"></div>
      <div id="mrBody"></div>`;

    const kpiDef = [
      { name: "Revenue", label: "Revenue", ds: "closing", fmt: moneyC },
      { name: "Operational Profit by Formula", label: "Operational Profit", ds: "closing", fmt: moneyC },
      { name: "Total Jobs", label: "Jobs Done", ds: "closing", fmt: fmtN },
      { name: "Booking Rate", label: "Booking Rate", ds: "moveboard", fmt: pct },
    ];
    const kfacts = kpiDef.map(k => { const cur = valueFor(k.ds, k.name, curY, mo), prev = valueFor(k.ds, k.name, curY - 1, mo);
      return { ...k, cur, prev, g: (prev && cur != null) ? (cur - prev) / Math.abs(prev) : null, spark: momSeries(k.ds, k.name, null, 12).map(x => x.v) }; });
    const kh = document.getElementById("mrKpis");
    kh.innerHTML = kfacts.map((k, i) => {
      const chip = k.g == null ? "" : ` <span class="${k.g >= 0 ? "up" : "down"}">${k.g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(k.g)).toFixed(1)}%</span>`;
      return `<div class="kpi"><div class="l">${RSC.esc(k.label)}</div><div class="v">${k.cur == null ? "—" : k.fmt(k.cur)}</div>
        <div class="s">${MON[mo]} · vs LY${chip}</div><div style="height:34px;margin-top:8px;position:relative"><canvas class="mrspark" data-i="${i}"></canvas></div></div>`;
    }).join("");
    kh.querySelectorAll(".mrspark").forEach(cv => { const k = kfacts[+cv.dataset.i], d = k.spark.map(v => v == null ? null : v);
      new Chart(cv, { type: "line", data: { labels: d.map(() => ""), datasets: [{ data: d, borderColor: LIME, backgroundColor: vgrad(cv, LIME), fill: true, tension: .4, pointRadius: 0, borderWidth: 2 }] },
        options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false } }, animation: false, maintainAspectRatio: false } }); });
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
      box.style.cssText = "margin:6px 0 18px;padding:14px 16px;border:1px solid var(--line);border-left:4px solid var(--brand);background:linear-gradient(90deg,var(--brand-glow),transparent);border-radius:12px;font-size:14px;color:var(--ink);line-height:1.55";
      box.innerHTML = `<b style="color:var(--brand)">Executive summary · </b>${RSC.esc(tone + MON[mo] + " " + curY + " — " + p.join(", ") + ".")}`;
      kh.after(box);
    }

    // ---- sections ----
    const body = document.getElementById("mrBody");
    const section = t => { body.insertAdjacentHTML("beforeend", `<div class="rs-page-head" style="margin:22px 0 10px"><h1 style="font-size:16px">${RSC.esc(t)}</h1></div>`);
      const grid = document.createElement("div"); grid.className = "rs-grid2"; body.appendChild(grid); return grid; };

    let g = section("Company Overview");
    trendBars(g, { title: "Total Revenue", series: trendSeries("closing", "Revenue"), fmt: money, metricLabel: "Total Revenue" });
    trendBars(g, { title: "Operational Profit", series: trendSeries("closing", "Operational Profit by Formula"), fmt: money, metricLabel: "Operational Profit" });
    trendBars(g, { title: "Jobs Done", series: trendSeries("closing", "Total Jobs"), fmt: fmtN, metricLabel: "Jobs Done" });
    trendBars(g, { title: "Booking Rate", series: trendSeries("moveboard", "Booking Rate"), fmt: pct, metricLabel: "Booking Rate" });

    g = section("Leads Funnel");
    trendBars(g, { title: "Qualified Leads", series: trendSeries("moveboard", "Qualified Leads"), fmt: fmtN, metricLabel: "Qualified Leads" });
    trendBars(g, { title: "Confirmed Leads", series: trendSeries("moveboard", "Confirmed Leads"), fmt: fmtN, metricLabel: "Confirmed Leads" });
    rankBars(g, { title: "Bad Leads by Reason", series: segSeries("moveboard", "Total Leads", "Status", { pre: r => r["Status Category"] === "Bad Lead" }), fmt: fmtN, metricLabel: "Bad Leads", segLabel: "Reason", top: 12 });
    donut(g, { title: "Lead Status Mix", series: segSeries("moveboard", "Total Leads", "Status Category"), fmt: fmtN, metricLabel: "Leads", segLabel: "status" });

    g = section("Revenue Composition");
    donut(g, { title: "Revenue by Moving Type", series: segSeries("closing", "Revenue", "Moving Type"), fmt: money, metricLabel: "Revenue", segLabel: "moving type" });
    donut(g, { title: "Revenue by Source (top 8)", series: segSeries("closing", "Revenue", "Source"), fmt: money, metricLabel: "Revenue", segLabel: "source" });

    g = section("By State");
    rankBars(g, { title: "Total Revenue by State", series: segSeries("closing", "Revenue", "State Name"), fmt: money, metricLabel: "Revenue", segLabel: "State", top: 10 });
    rankBars(g, { title: "Operational Profit by State", series: segSeries("closing", "Operational Profit by Formula", "State Name"), fmt: money, metricLabel: "Operational Profit", segLabel: "State", top: 10 });

    g = section("Sales Report");
    rankBars(g, { title: "Total Revenue by Sales Person", series: segSeries("closing", "Revenue", "Sales Person"), fmt: money, metricLabel: "Revenue", segLabel: "Sales Person", top: 12 });
    rankBars(g, { title: "Operational Profit by Sales Person", series: segSeries("closing", "Operational Profit by Formula", "Sales Person"), fmt: money, metricLabel: "Operational Profit", segLabel: "Sales Person", top: 12 });

    g = section("Foreman Report");
    rankBars(g, { title: "Jobs by Foreman", series: segSeries("closing", "Total Jobs", "Foreman"), fmt: fmtN, metricLabel: "Jobs", segLabel: "Foreman", top: 12 });
    rankBars(g, { title: "Packing Written by Foreman", series: segSeries("closing", "Total Packing Written", "Foreman"), fmt: money, metricLabel: "Packing Written", segLabel: "Foreman", top: 12 });

    g = section("Advertising & Sources");
    rankBars(g, { title: "Revenue by Source", series: segSeries("closing", "Revenue", "Source"), fmt: money, metricLabel: "Revenue", segLabel: "Source", top: 14 });
    rankBars(g, { title: "Advertisement Expense by Source", series: segSeries("card_expenses", "Advertisement Expense", "Source", { pre: r => Number(r["Is Advertising"]) === 1 }), fmt: money, metricLabel: "Ad Expense", segLabel: "Source", top: 14 });

    g = section("By Moving Type");
    [["Local Moving", r => /local/i.test(r["Moving Type"] || "")],
     ["Long Distance", r => /straight|regular|distance|long/i.test(r["Moving Type"] || "")]].forEach(([mt, pre]) => {
      trendBars(g, { title: `${mt}: Revenue`, series: trendSeries("closing", "Revenue", { pre }), fmt: money, metricLabel: `${mt} Revenue` });
      trendBars(g, { title: `${mt}: Jobs`, series: trendSeries("closing", "Total Jobs", { pre }), fmt: fmtN, metricLabel: `${mt} Jobs` });
    });

    g = section("Returned & Recommended Customers");
    const rrPre = { pre: r => r.Source === "Returned Customer" || r.Source === "Recommended" };
    rankBars(g, { title: "Revenue — Returned vs Recommended", series: segSeries("closing", "Revenue", "Source", rrPre), fmt: money, metricLabel: "Revenue", segLabel: "customer type", top: 4 });
    rankBars(g, { title: "Operational Profit — Returned vs Recommended", series: segSeries("closing", "Operational Profit by Formula", "Source", rrPre), fmt: money, metricLabel: "Operational Profit", segLabel: "customer type", top: 4 });

    g = section("Leads Funnel — by Segment");
    funnelTable(g, "Leads by Service Type", "Service Type", "Service Type");
    funnelTable(g, "Leads by State", "State Name", "State");
    funnelTable(g, "Leads by Size of Move", "Size of Move", "Size of Move");
    funnelTable(g, "Leads by CF Range", "CF Range", "CF Range");

    g = section("Packing & Storage");
    combo(g, { title: "Packing — Written vs Revenue-per-$1", series: trendSeries("closing", "Total Packing Written"), lineSeries: trendSeries("closing", "Total Packing Written").map(r => ({ v: r.v ? r.v / 1000 : null })), fmt: money, lineFmt: v => "$" + v.toFixed(0), metricLabel: "Packing Written", lineLabel: "Rev / $1 est." });
    trendBars(g, { title: "Storage Additional Revenue", series: trendSeries("storage", "Storage Additional Revenue"), fmt: money, metricLabel: "Storage Add'l Revenue" });
    storageTable(g);

    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; renderPage(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; renderPage(); };
    // Download PDF — print the report cleanly (chrome hidden, page breaks, colors kept)
    if (!document.getElementById("mr-print-css")) { const s = document.createElement("style"); s.id = "mr-print-css";
      s.textContent = "@media print{header.top,.rs-side,.rs-filters,.rs-chips,#mrPrint,#mrMonth,#mrYear{display:none!important}.rs-layout,.rs-main,.rs-content{display:block!important;height:auto!important;max-height:none!important;overflow:visible!important;width:auto!important}.rs-content{padding:0!important}body.rs-app{-webkit-print-color-adjust:exact;print-color-adjust:exact}.panel,.kpi{break-inside:avoid}.rs-grid2{display:grid!important}@page{margin:9mm}}";
      document.head.appendChild(s); }
    document.getElementById("mrPrint").onclick = () => window.print();
  },
});
var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5 });
