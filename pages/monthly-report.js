/* Monthly Report — "Monthly Business Review", rebuilt (v7).
   A premium, print-ready report on a LIGHT canvas (distinct from the dark portal chrome),
   restrained palette (brand lime reserved for ONE meaning: current period / leader / good),
   deliberately VARIED charts matched to each question (KPI scoreboard, momentum lines,
   P&L waterfall, lead funnel, bullet-vs-target, heat-matrix tables, grouped/stacked bars,
   combos) across clear thematic sections. Reuses the RS measure library; Zip-to-Zip scope.
   Only control: report Month/Year. Own scoped design system so it never inherits the dark
   portal card styles. */
registerPage({
  id: "monthly-report",
  group: "pulse",
  title: "Monthly Report",
  async render(host) {
    const M = RS.M;
    const MON = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const MS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, pct = RS.fmtPct, fmt1 = RS.fmt1;
    const esc = RSC.esc;
    const num = v => (v == null || isNaN(v)) ? 0 : +v;

    /* ---------- data ---------- */
    const grab = ds => RS.load(ds).catch(() => []);
    const [closing, moveboard, storage, claims, refunds, cardEx] = await Promise.all(
      ["closing", "moveboard", "storage", "claims", "refunds", "card_expenses"].map(grab));
    const [reviews, negrev, callrail, scorecard, rcounts, rgoals] = await Promise.all(
      ["reviews_breakdown", "negative_reviews", "callrail", "scorecard", "review_counts", "review_goals"].map(grab));
    // helper/sales salaries feed Operational Profit's cross-dataset cost build-up — MUST be
    // loaded here or Op Profit reads $0 for them and overstates profit on a fresh page load.
    const [helperSalDs, salesSalDs] = await Promise.all(["helper_salaries", "sales_salaries"].map(grab));
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: cardEx, reviews_breakdown: reviews, negative_reviews: negrev, callrail, scorecard, review_counts: rcounts, review_goals: rgoals, helper_salaries: helperSalDs, sales_salaries: salesSalDs };

    const latest = closing.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
    if (!st.month) {   // default to the last COMPLETE month, never the current partial one
      const now = new Date(); let dy, dm;
      if (latest) { dy = +latest.slice(0, 4); dm = +latest.slice(5, 7); } else { dy = now.getFullYear(); dm = now.getMonth() + 1; }
      if (dy === now.getFullYear() && dm === now.getMonth() + 1) { dm--; if (dm < 1) { dm = 12; dy--; } }
      st.month = dm; st.year = dy;
    }
    const curY = st.year, mo = st.month, monLbl = MON[mo] + " " + curY;
    const freshness = latest ? `data through ${latest}` : "";

    /* ---------- month engine (date/segment scoping via RS.filtered) ---------- */
    function rangeFor(y, m) { const mm = String(m).padStart(2, "0"), last = new Date(y, m, 0).getDate(); return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, "0")}`]; }
    function withMonth(y, m, fn) {
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo };
      const [a, b] = rangeFor(y, m); S.dateFrom = a; S.dateTo = b; S.dayFrom = S.dayTo = null;
      try { return fn(); } finally { S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt; }
    }
    function valueFor(ds, measure, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      return withMonth(y, m, () => { let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre); return M[measure] ? M[measure].fn(f) : null; });
    }
    // arbitrary reducer over a month's filtered rows (for datasets w/o a registered measure)
    function reduceMonth(ds, y, m, reducer, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      return withMonth(y, m, () => { let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre); return reducer(f); });
    }
    const yearsArr = n => { const a = []; for (let y = curY - (n || st.years) + 1; y <= curY; y++) a.push(y); return a; };
    const trendSeries = (ds, measure, opts, n) => yearsArr(n).map(y => ({ k: String(y), v: valueFor(ds, measure, y, mo, opts) }));
    function momSeries(ds, measure, n, opts) {
      const out = []; let y = curY, m = mo;
      for (let i = 0; i < (n || 12); i++) { out.unshift({ k: MS[m] + " " + String(y).slice(2), y, m, v: valueFor(ds, measure, y, m, opts) }); m--; if (m < 1) { m = 12; y--; } }
      return out;
    }
    function momReduce(ds, n, reducer, opts) {
      const out = []; let y = curY, m = mo;
      for (let i = 0; i < (n || 12); i++) { out.unshift({ k: MS[m] + " " + String(y).slice(2), y, m, v: reduceMonth(ds, y, m, reducer, opts) }); m--; if (m < 1) { m = 12; y--; } }
      return out;
    }
    // group a month's rows by column, run a registered measure per group (segKeys-scoped)
    function segSeries(ds, measure, col, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      return withMonth(y || curY, m || mo, () => {
        let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
        const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
        return Object.entries(g).map(([k, rs]) => {
          const segKeys = new Set(); for (const r of rs) { const u = r["Unique Key"]; if (u != null) segKeys.add(u); }
          return { k, v: M[measure] ? M[measure].fn(rs, segKeys) : null, rows: rs };
        }).filter(x => x.v != null && x.v !== 0).sort((a, b) => (b.v || 0) - (a.v || 0));
      });
    }
    // group by col, custom reducer per group (for counts / non-registered datasets)
    function segReduce(ds, col, reducer, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      return withMonth(y || curY, m || mo, () => {
        let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
        const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
        return Object.entries(g).map(([k, rs]) => ({ k, v: reducer(rs), rows: rs })).filter(x => x.v != null).sort((a, b) => (b.v || 0) - (a.v || 0));
      });
    }

    /* ---------- palette (light report canvas) ---------- */
    const INK = "#141a24", SUB = "#5b6675", FAINT = "#93a0b2", LINE = "#e7ebf1";
    const INDIGO = "#4361ee", LIME = "#b7e23b", TEAL = "#14b8a6", VIOLET = "#8b5cf6", AMBER = "#f59e0b", SLATE = "#64748b", CORAL = "#ef6b6b", SKY = "#38bdf8", PINK = "#ec4899";
    const POS = "#16a34a", NEG = "#dc2626";
    const CAT = [INDIGO, TEAL, VIOLET, AMBER, SLATE, CORAL, SKY, PINK, "#a3a635", "#0ea5e9"];
    const YEAR_RAMP = ["#cdd6ef", "#a9b8e6", "#7f93db", INDIGO, LIME]; // older→current(lime)
    const AXIS = "#7b869a", GRID = "rgba(120,140,170,.14)";
    // color scales
    const hex2rgb = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const mix = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return `rgb(${A.map((x, i) => Math.round(x + (B[i] - x) * t)).join(",")})`; };
    const seqBg = (v, min, max) => { if (v == null || max <= min) return "transparent"; const t = Math.max(0, Math.min(1, (v - min) / (max - min))); return mix("#eef2fe", INDIGO, t); };
    const seqInk = (v, min, max) => { const t = max <= min ? 0 : (v - min) / (max - min); return t > 0.62 ? "#fff" : INK; };
    const divBg = t => { // t in [-1,1] → red..neutral..green (subtle)
      if (t == null) return "transparent"; const c = Math.max(-1, Math.min(1, t));
      return c >= 0 ? mix("#ffffff", "#c6f0d4", c) : mix("#ffffff", "#f6cccc", -c);
    };

    /* ---------- design system (scoped, light, print-ready) ---------- */
    if (!document.getElementById("mrx-css")) {
      const s = document.createElement("style"); s.id = "mrx-css";
      s.textContent = `
      .mrx{background:#f4f6f9;color:${INK};border-radius:16px;padding:26px 26px 40px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mrx *{box-sizing:border-box}
      .mrx-cover{position:relative;background:linear-gradient(120deg,#fbfcfe,#eef2f9);border:1px solid ${LINE};border-radius:16px;padding:22px 24px;overflow:hidden;margin-bottom:20px}
      .mrx-cover:before{content:"";position:absolute;inset:0;background:radial-gradient(520px 150px at 92% -30%,rgba(183,226,59,.35),transparent 70%);pointer-events:none}
      .mrx-eyebrow{font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${INDIGO}}
      .mrx-h1{font-size:30px;font-weight:850;letter-spacing:-.6px;margin:5px 0 3px;color:${INK}}
      .mrx-cvsub{color:${SUB};font-size:13px;font-weight:600}
      .mrx-print{position:absolute;top:20px;right:22px;background:${INK};color:#fff;border:0;border-radius:10px;padding:9px 15px;font-size:12.5px;font-weight:800;cursor:pointer;z-index:2}
      .mrx-ctl{font:inherit;font-weight:700;color:${INK};background:#fff;border:1px solid ${LINE};border-radius:8px;padding:3px 8px;margin-left:4px}
      .mrx-sec{margin:26px 0 6px}
      .mrx-sec-h{display:flex;align-items:baseline;gap:12px;border-left:4px solid ${LIME};padding-left:11px;margin-bottom:2px}
      .mrx-sec-t{font-size:18px;font-weight:850;color:${INK};letter-spacing:-.3px}
      .mrx-sec-s{font-size:12px;font-weight:650;color:${SUB}}
      .mrx-grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));margin-top:12px}
      .mrx-grid.k{grid-template-columns:repeat(auto-fit,minmax(190px,1fr))}
      .mrx-card{background:#fff;border:1px solid ${LINE};border-radius:14px;padding:15px 16px;box-shadow:0 1px 2px rgba(20,30,50,.04)}
      .mrx-card.span2{grid-column:span 2}
      .mrx-ct{font-size:13.5px;font-weight:750;color:${INK}}
      .mrx-cs{font-size:11px;font-weight:700;color:${FAINT};text-transform:uppercase;letter-spacing:.04em}
      .mrx-chead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;gap:8px}
      .mrx-box{position:relative;height:280px}
      .mrx-note{margin-top:9px;font-size:12px;color:${SUB};line-height:1.5;border-left:3px solid ${INDIGO};background:#f5f8ff;padding:8px 11px;border-radius:0 8px 8px 0}
      .mrx-kpi{background:#fff;border:1px solid ${LINE};border-radius:14px;padding:14px 15px;box-shadow:0 1px 2px rgba(20,30,50,.04)}
      .mrx-kl{font-size:11px;font-weight:750;color:${SUB};text-transform:uppercase;letter-spacing:.05em}
      .mrx-kv{font-size:27px;font-weight:850;color:${INK};letter-spacing:-.5px;margin:3px 0 2px;font-variant-numeric:tabular-nums}
      .mrx-chips{display:flex;gap:6px;flex-wrap:wrap}
      .mrx-chip{font-size:11px;font-weight:800;padding:2px 7px;border-radius:999px;font-variant-numeric:tabular-nums}
      .mrx-spark{height:34px;position:relative;margin-top:7px}
      .mrx-exec{background:linear-gradient(90deg,#f2f8e6,#f7fbef);border:1px solid #e4eecf;border-left:4px solid ${LIME};border-radius:10px;padding:12px 15px;font-size:13.5px;color:#2c3626;line-height:1.55;margin-top:14px}
      .mrx-tbl{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums}
      .mrx-tbl th{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${SUB};text-align:right;padding:6px 8px;border-bottom:2px solid ${LINE};white-space:nowrap}
      .mrx-tbl th:first-child{text-align:left}
      .mrx-tbl td{padding:6px 8px;text-align:right;border-bottom:1px solid #eef1f5;color:#26303f;white-space:nowrap}
      .mrx-tbl td:first-child{text-align:left;font-weight:650;color:${INK}}
      .mrx-tbl tr:last-child td{border-bottom:0}
      .mrx-tbl tr.tot td{font-weight:850;border-top:2px solid ${LINE};color:${INK}}
      .mrx-tbl .bar{position:relative}
      .mrx-tbl .bar i{position:absolute;left:0;top:3px;bottom:3px;background:rgba(67,97,238,.16);border-radius:3px;z-index:0}
      .mrx-tbl .bar span{position:relative;z-index:1}
      .mrx-scroll{overflow-x:auto}
      .mrx-empty{height:100%;display:grid;place-items:center;color:${FAINT};font-size:12.5px;font-weight:600}
      @media print{
        @page{margin:9mm}
        .top,.rs-side,.rs-filters,.rs-chips,.rs-topbar,header{display:none!important}
        .mrx{background:#fff;padding:0}
        .mrx-print,#mrMonth,#mrYear,.mrx-ctl{display:none!important}
        .mrx-sec{break-before:page;break-after:avoid}
        .mrx-sec:first-of-type{break-before:auto}
        .mrx-card,.mrx-kpi,.mrx-tbl tr{break-inside:avoid}
        .mrx-cover{break-inside:avoid}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }`;
      document.head.appendChild(s);
    }

    /* ---------- chart primitives ---------- */
    const vgrad = (cv, hex, h) => { const ctx = cv.getContext("2d"), g = ctx.createLinearGradient(0, 0, 0, h || cv.height || 260); g.addColorStop(0, hex + "e6"); g.addColorStop(1, hex + "55"); return g; };
    const baseOpts = extra => Object.assign({ maintainAspectRatio: false, animation: { duration: 450 }, plugins: { legend: { display: false } } }, extra || {});
    const axX = (o) => Object.assign({ ticks: { color: AXIS, font: { size: 11, weight: "600" } }, grid: { display: false }, border: { color: LINE } }, o || {});
    const axY = (fmt, o) => Object.assign({ ticks: { color: AXIS, font: { size: 10.5 }, maxTicksLimit: 6, callback: v => fmt ? fmt(v) : v }, grid: { color: GRID }, border: { display: false } }, o || {});
    // value labels drawn on bars — fmt captured in CLOSURE (never in options)
    const valLabels = (fmt, horiz, color) => ({ id: "vlab", afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = "800 10.5px Inter"; ctx.fillStyle = color || "#33405a";
      ch.data.datasets.forEach((d, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden) return; meta.data.forEach((el, i) => {
        const raw = d.data[i]; const v = Array.isArray(raw) ? raw[1] - raw[0] : raw; if (v == null || isNaN(v)) return;
        if (horiz) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v), el.x + 5, el.y); }
        else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(fmt(v), el.x, el.y - 4); }
      }); }); ctx.restore();
    } });

    /* ---------- card + section scaffolding ---------- */
    function card(mount, title, sub, opts) {
      opts = opts || {}; const c = document.createElement("div"); c.className = "mrx-card" + (opts.span2 ? " span2" : "");
      c.innerHTML = `<div class="mrx-chead"><span class="mrx-ct">${esc(title)}</span>${sub ? `<span class="mrx-cs">${esc(sub)}</span>` : ""}</div>`;
      mount.appendChild(c); return c;
    }
    function chartCard(mount, title, sub, opts) {
      opts = opts || {}; const c = card(mount, title, sub, opts);
      const box = document.createElement("div"); box.className = "mrx-box"; if (opts.h) box.style.height = opts.h + "px";
      const cv = document.createElement("canvas"); box.appendChild(cv); c.appendChild(box);
      return { c, box, cv };
    }
    function note(c, txt) { if (!txt) return; const n = document.createElement("div"); n.className = "mrx-note"; n.innerHTML = `<b style="color:${INDIGO}">Insight · </b>${esc(txt)}`; c.appendChild(n); }
    function emptyBox(box, msg) { box.innerHTML = `<div class="mrx-empty">${esc(msg || ("No data for " + monLbl))}</div>`; }
    let bodyEl;
    function section(title, sub, klass) {
      const wrap = document.createElement("section"); wrap.className = "mrx-sec";
      wrap.innerHTML = `<div class="mrx-sec-h"><span class="mrx-sec-t">${esc(title)}</span><span class="mrx-sec-s">${esc(sub || "")}</span></div>`;
      const grid = document.createElement("div"); grid.className = "mrx-grid" + (klass ? " " + klass : ""); wrap.appendChild(grid);
      bodyEl.appendChild(wrap); return grid;
    }

    /* ---------- delta chip ---------- */
    function chip(cur, prev, label, inv) {
      if (cur == null || prev == null || !prev) return `<span class="mrx-chip" style="background:#eef1f5;color:${SUB}">${label} —</span>`;
      const g = (cur - prev) / Math.abs(prev); const up = g >= 0; const good = inv ? !up : up;
      const col = good ? POS : NEG; const bg = good ? "rgba(22,163,74,.12)" : "rgba(220,38,38,.10)";
      return `<span class="mrx-chip" style="background:${bg};color:${col}">${label} ${up ? "▲" : "▼"} ${Math.abs(g * 100).toFixed(0)}%</span>`;
    }

    /* ---------- sparkline ---------- */
    function sparkline(el, series, fmt, col) {
      const s = series.filter(r => r.v != null); if (!s.length) return;
      const cv = document.createElement("canvas"); el.appendChild(cv);
      const vals = s.map(r => r.v), mn = Math.min(...vals), mx = Math.max(...vals);
      new Chart(cv, { type: "line", data: { labels: s.map(r => r.k), datasets: [{ data: vals, borderColor: col || INDIGO, backgroundColor: "rgba(67,97,238,.10)", fill: true, tension: .38, borderWidth: 2, pointRadius: s.map((_, i) => i === s.length - 1 ? 3 : 0), pointBackgroundColor: LIME }] },
        options: baseOpts({ plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, min: mn - (mx - mn) * .15, max: mx + (mx - mn) * .15 } } }) });
    }

    /* ---------- chart builders ---------- */
    // 5-yr YoY bars, current year lime, avg reference (label in gutter)
    function yoyBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.filter(r => r.v != null); const { c, box, cv } = chartCard(mount, title, opts.sub || (MS[mo] + " · " + s.length + "-yr"), opts);
      if (!s.length) { emptyBox(box); return c; }
      const avg = s.reduce((a, b) => a + b.v, 0) / s.length;
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => vgrad(cv, i === s.length - 1 ? LIME : INDIGO)), borderRadius: 6, maxBarThickness: 58 }] },
        options: baseOpts({ layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.y) } }, annNoop: {} }, scales: { x: axX(), y: axY(fmt, { beginAtZero: true }) } }),
        plugins: [valLabels(fmt, false), { id: "avg", afterDraw(ch) { const y = ch.scales.y.getPixelForValue(avg), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "rgba(100,116,139,.55)"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = SUB; ctx.font = "700 9.5px Inter"; ctx.textAlign = "left"; ctx.fillText("avg " + fmt(avg), a.left + 3, y - 3); ctx.restore(); } }] });
      return c;
    }
    // multi-line trend (MoM momentum)
    function lines(mount, title, sub, sets, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = sets[0].series.map(r => r.k);
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "line",
        data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.series.map(r => r.v), borderColor: d.color || CAT[i], backgroundColor: (d.color || CAT[i]) + "22", fill: !!d.fill, tension: .35, borderWidth: 2.4, pointRadius: labels.map((_, j) => j === labels.length - 1 ? 3.5 : 0), pointBackgroundColor: d.color || CAT[i], yAxisID: d.axis || "y" })) },
        options: baseOpts({ plugins: { legend: { display: sets.length > 1, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 10, boxHeight: 10, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + (x.dataset.yAxisID === "y1" ? (opts.fmt1 || fmt)(x.parsed.y) : fmt(x.parsed.y)) } } },
          scales: opts.dual ? { x: axX(), y: axY(fmt), y1: axY(opts.fmt1 || fmt, { position: "right", grid: { display: false } }) } : { x: axX(), y: axY(fmt) } }) });
      return c;
    }
    // combo bar + line (two units)
    function combo(mount, title, sub, barSeries, barLabel, barFmt, lineSeries, lineLabel, lineFmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = barSeries.map(r => r.k); if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { data: { labels, datasets: [
        { type: "bar", label: barLabel, data: barSeries.map(r => r.v), backgroundColor: labels.map((_, i) => vgrad(cv, i === labels.length - 1 ? LIME : INDIGO)), borderRadius: 5, maxBarThickness: 46, yAxisID: "y", order: 2 },
        { type: "line", label: lineLabel, data: lineSeries.map(r => r.v), borderColor: TEAL, backgroundColor: TEAL, tension: .35, borderWidth: 2.6, pointRadius: 3, yAxisID: "y1", order: 1 }] },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.yAxisID === "y1" ? `${lineLabel}: ${lineFmt(x.parsed.y)}` : `${barLabel}: ${barFmt(x.parsed.y)}` } } },
          scales: { x: axX(), y: axY(barFmt, { beginAtZero: true, title: { display: true, text: barLabel, color: SUB, font: { size: 10, weight: "700" } } }), y1: axY(lineFmt, { position: "right", grid: { display: false }, title: { display: true, text: lineLabel, color: TEAL, font: { size: 10, weight: "700" } } }) } }) });
      return c;
    }
    // horizontal ranked bars, leader lime
    function rankBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.slice(0, opts.top || 12); const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { span2: opts.span2, h: Math.max(190, 40 + s.length * 26) });
      if (!s.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === 0 ? LIME : INDIGO), borderRadius: 4, maxBarThickness: 20 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 56 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: "#3a4557", font: { size: 11.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [valLabels(fmt, true)] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    // grouped horizontal bars (2 series: prev vs current, or 2025 vs 2026)
    function groupedBars(mount, title, labels, sa, la, sb, lb, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, opts.sub || "", { span2: opts.span2, h: Math.max(200, 44 + labels.length * 30) });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels, datasets: [ { label: la, data: sa, backgroundColor: SLATE, borderRadius: 3, maxBarThickness: 12 }, { label: lb, data: sb, backgroundColor: INDIGO, borderRadius: 3, maxBarThickness: 12 } ] },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: "#3a4557", font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }) });
      return c;
    }
    // 100%-stacked single bar (composition of a small set)
    function stackShare(mount, title, sub, parts, fmt) {
      const { c, box, cv } = chartCard(mount, title, sub, { h: 150 });
      const tot = parts.reduce((a, b) => a + b.v, 0); if (!tot) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels: [""], datasets: parts.map((p, i) => ({ label: p.k, data: [p.v], backgroundColor: CAT[i % CAT.length], borderRadius: 3, maxBarThickness: 44, stack: "s" })) },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: true, position: "bottom", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: x => `${x.dataset.label}: ${fmt(x.parsed.x)} (${(x.parsed.x / tot * 100).toFixed(0)}%)` } } }, scales: { x: { stacked: true, display: false, max: tot }, y: { stacked: true, display: false } } }),
        plugins: [{ id: "pctlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 11px Inter"; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ch.data.datasets.forEach((d, di) => { const el = ch.getDatasetMeta(di).data[0]; const share = d.data[0] / tot; if (share > .08) ctx.fillText(Math.round(share * 100) + "%", el.x, el.y); }); ctx.restore(); } }] });
      return c;
    }
    // donut for genuine composition of a small set (+ "Other")
    function donut(mount, title, series, fmt, opts) {
      opts = opts || {}; const pos = series.filter(r => r.v > 0), head = pos.slice(0, 7), tail = pos.slice(7);
      const s = tail.length ? head.concat([{ k: "Other", v: tail.reduce((a, b) => a + b.v, 0) }]) : head;
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { h: 250 });
      if (!s.length) { emptyBox(box); return c; }
      const tot = s.reduce((a, b) => a + b.v, 0);
      new Chart(cv, { type: "doughnut", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((r, i) => r.k === "Other" ? "#c3ccd8" : CAT[i % CAT.length]), borderColor: "#fff", borderWidth: 2, hoverOffset: 5 }] },
        options: baseOpts({ cutout: "62%", plugins: { legend: { position: "right", labels: { color: "#3a4557", font: { size: 11 }, boxWidth: 11, padding: 7, usePointStyle: true } }, tooltip: { callbacks: { label: x => `${x.label}: ${fmt(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)` } } } }),
        plugins: [{ id: "ctr", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = INK; ctx.font = "850 18px Inter"; ctx.fillText(opts.center || fmt(tot), x, y - 2); ctx.fillStyle = FAINT; ctx.font = "700 10px Inter"; ctx.fillText(opts.centerLbl || "total", x, y + 15); ctx.restore(); } }] });
      return c;
    }
    // P&L waterfall (floating bars)
    function waterfall(mount, title, sub, steps) {
      const { c, box, cv } = chartCard(mount, title, sub, { span2: true, h: 300 });
      if (!steps.length) { emptyBox(box); return c; }
      let run = 0; const bars = [], colors = [], labels = [];
      steps.forEach(st2 => {
        labels.push(st2.label);
        if (st2.type === "total") { bars.push([0, st2.v]); colors.push(st2.v >= 0 ? INDIGO : NEG); run = st2.v; }
        else { const from = run, to = run + st2.v; bars.push([from, to]); colors.push(st2.v >= 0 ? POS : CORAL); run = to; }
      });
      new Chart(cv, { type: "bar", data: { labels, datasets: [{ data: bars, backgroundColor: colors, borderRadius: 3, maxBarThickness: 46 }] },
        options: baseOpts({ layout: { padding: { top: 20 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => { const d = x.raw; return money(Array.isArray(d) ? d[1] - d[0] : d); } } } }, scales: { x: axX({ ticks: { color: AXIS, font: { size: 10, weight: "600" }, maxRotation: 40, minRotation: 0 } }), y: axY(moneyC, { beginAtZero: true }) } }),
        plugins: [{ id: "wlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 9.5px Inter"; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ch.getDatasetMeta(0).data.forEach((el, i) => { const d = bars[i]; const v = d[1] - d[0]; ctx.fillStyle = steps[i].type === "total" ? INK : (v >= 0 ? POS : CORAL); ctx.fillText((v < 0 ? "-" : "") + moneyC(Math.abs(v)), el.x, Math.min(el.y, ch.scales.y.getPixelForValue(Math.max(d[0], d[1]))) - 3); }); ctx.restore(); } }] });
      return c;
    }
    // lead funnel (descending horizontal bars + conversion %)
    function funnel(mount, title, sub, stages) {
      const { c, box, cv } = chartCard(mount, title, sub, { h: 210 });
      if (!stages.length || !stages[0].v) { emptyBox(box); return c; }
      const top = stages[0].v;
      new Chart(cv, { type: "bar", data: { labels: stages.map(s2 => s2.k), datasets: [{ data: stages.map(s2 => s2.v), backgroundColor: stages.map((_, i) => mix(INDIGO, LIME, i / Math.max(1, stages.length - 1))), borderRadius: 4, maxBarThickness: 34 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 96 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmtN(x.parsed.x) + ` (${(x.parsed.x / top * 100).toFixed(0)}% of top)` } } }, scales: { x: { display: false, beginAtZero: true, max: top * 1.02 }, y: { ticks: { color: "#3a4557", font: { size: 12, weight: "700" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [{ id: "flab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 11px Inter"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ch.getDatasetMeta(0).data.forEach((el, i) => { ctx.fillStyle = INK; const conv = i === 0 ? "" : `  ·  ${(stages[i].v / stages[i - 1].v * 100).toFixed(0)}%`; ctx.fillText(fmtN(stages[i].v) + conv, el.x + 6, el.y); }); ctx.restore(); } }] });
      return c;
    }
    // bullet bars: value vs a target tick, per row
    function bullet(mount, title, sub, rows, fmt, target, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, h: Math.max(190, 40 + rows.length * 26) });
      if (!rows.length) { emptyBox(box); return c; }
      const good = INDIGO, bad = CORAL;
      new Chart(cv, { type: "bar", data: { labels: rows.map(r => r.k), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => r.v >= target ? good : bad), borderRadius: 4, maxBarThickness: 18 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 50 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.x) + " (target " + fmt(target) + ")" } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: "#3a4557", font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [valLabels(fmt, true), { id: "tgt", afterDraw(ch) { const x = ch.scales.x.getPixelForValue(target), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "#334155"; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#334155"; ctx.font = "800 9px Inter"; ctx.textAlign = "center"; ctx.fillText("target " + fmt(target), x, a.top - 2); ctx.restore(); } }] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    // stacked bars over time (e.g. answered vs missed calls)
    function stackedTime(mount, title, sub, labels, sets, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || CAT[i], borderRadius: 3, maxBarThickness: 26, stack: "s" })) },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 10, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.y) } } }, scales: { x: Object.assign(axX(), { stacked: true }), y: Object.assign(axY(fmt, { beginAtZero: true }), { stacked: true }) } }) });
      return c;
    }

    /* ---------- heat / scorecard tables (HTML) ---------- */
    function tableCard(mount, title, sub, html, opts) {
      opts = opts || {}; const c = card(mount, title, sub || monLbl, { span2: opts.span2 !== false });
      const w = document.createElement("div"); w.className = "mrx-scroll"; w.innerHTML = html; c.appendChild(w);
      if (opts.note) note(c, opts.note); return c;
    }
    const td = (v, style) => `<td${style ? ` style="${style}"` : ""}>${v}</td>`;

    /* ---------- insight text ---------- */
    function trendInsight(label, series, fmt, monthName) {
      const v = series.filter(r => r.v != null); if (v.length < 2) return "";
      const cur = v[v.length - 1], prev = v[v.length - 2], max = v.reduce((a, b) => b.v > a.v ? b : a);
      const g = prev.v ? (cur.v - prev.v) / Math.abs(prev.v) : null;
      let s = `${label} was ${fmt(cur.v)} in ${monLbl}`;
      if (g != null) s += `, ${g >= 0 ? "up" : "down"} ${Math.abs(g * 100).toFixed(0)}% vs ${prev.k} (${fmt(prev.v)})`;
      if (max.k === cur.k && v.length >= 3) s += ` — the strongest ${monthName} in ${v.length} years`;
      return s + ".";
    }
    function segInsight(series, fmt, unit) {
      const v = series.filter(r => r.v != null); if (!v.length) return "";
      const tot = v.reduce((a, b) => a + b.v, 0), top = v[0];
      let s = `${top.k} leads with ${fmt(top.v)}`; if (tot) s += ` (${(top.v / tot * 100).toFixed(0)}% of ${fmt(tot)})`;
      if (v.length >= 4) s += `; top 3 = ${(v.slice(0, 3).reduce((a, b) => a + b.v, 0) / tot * 100).toFixed(0)}%`;
      return s + ".";
    }

    /* =====================================================================
       ASSEMBLE
       ===================================================================== */
    host.innerHTML = "";
    const root = document.createElement("div"); root.className = "mrx"; host.appendChild(root);
    // cover
    const cover = document.createElement("div"); cover.className = "mrx-cover";
    cover.innerHTML = `
      <button class="mrx-print" id="mrPrint" title="Print / save as PDF">⬇ Download PDF</button>
      <div class="mrx-eyebrow">Monthly Business Review · Zip to Zip</div>
      <div class="mrx-h1">Report for ${MON[mo]} ${curY}</div>
      <div class="mrx-cvsub">${esc(freshness)} · single-company view ·
        <select id="mrMonth" class="mrx-ctl">${MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("")}</select>
        <select id="mrYear" class="mrx-ctl">${[curY + 1, curY, curY - 1, curY - 2].filter(y => y <= curY + 1).map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("")}</select></div>`;
    root.appendChild(cover);
    bodyEl = document.createElement("div"); root.appendChild(bodyEl);

    const PM = mo === 1 ? 12 : mo - 1, PMY = mo === 1 ? curY - 1 : curY; // prior month
    // core month values
    const rev = valueFor("closing", "Revenue", curY, mo), revLY = valueFor("closing", "Revenue", curY - 1, mo), revPM = valueFor("closing", "Revenue", PMY, PM);
    const op = valueFor("closing", "Operational Profit by Formula", curY, mo), opLY = valueFor("closing", "Operational Profit by Formula", curY - 1, mo), opPM = valueFor("closing", "Operational Profit by Formula", PMY, PM);
    const jobs = valueFor("closing", "Total Jobs", curY, mo), jobsLY = valueFor("closing", "Total Jobs", curY - 1, mo), jobsPM = valueFor("closing", "Total Jobs", PMY, PM);
    const bk = valueFor("moveboard", "Booking Rate", curY, mo), bkLY = valueFor("moveboard", "Booking Rate", curY - 1, mo), bkPM = valueFor("moveboard", "Booking Rate", PMY, PM);
    const leadsN = valueFor("moveboard", "Total Leads", curY, mo), leadsLY = valueFor("moveboard", "Total Leads", curY - 1, mo), leadsPM = valueFor("moveboard", "Total Leads", PMY, PM);
    const margin = rev ? op / rev : null, marginLY = revLY ? opLY / revLY : null, marginPM = revPM ? opPM / revPM : null;
    const avgJob = jobs ? rev / jobs : null, avgJobLY = jobsLY ? revLY / jobsLY : null, avgJobPM = jobsPM ? revPM / jobsPM : null;
    const revWritten = reduceMonth("reviews_breakdown", curY, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenLY = reduceMonth("reviews_breakdown", curY - 1, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenPM = reduceMonth("reviews_breakdown", PMY, PM, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;

    /* ---- SECTION 1 · At a glance ---- */
    {
      const g = section("Executive Summary", monLbl + " · vs last year & last month", "k");
      const kpis = [
        { l: "Revenue", v: moneyC(rev), c: rev, ly: revLY, pm: revPM, spk: momSeries("closing", "Revenue", 12), col: INDIGO },
        { l: "Operational Profit", v: moneyC(op), c: op, ly: opLY, pm: opPM, spk: momSeries("closing", "Operational Profit by Formula", 12), col: POS },
        { l: "Op. Margin", v: pct(margin), c: margin, ly: marginLY, pm: marginPM, spk: momSeries("closing", "Operational Profit Margin", 12), col: VIOLET, rate: 1 },
        { l: "Jobs Done", v: fmtN(jobs), c: jobs, ly: jobsLY, pm: jobsPM, spk: momSeries("closing", "Total Jobs", 12), col: TEAL },
        { l: "Leads", v: fmtN(leadsN), c: leadsN, ly: leadsLY, pm: leadsPM, spk: momSeries("moveboard", "Total Leads", 12), col: SKY },
        { l: "Booking Rate", v: pct(bk), c: bk, ly: bkLY, pm: bkPM, spk: momSeries("moveboard", "Booking Rate", 12), col: AMBER, rate: 1 },
        { l: "Avg Job Value", v: moneyC(avgJob), c: avgJob, ly: avgJobLY, pm: avgJobPM, spk: momReduce("closing", 12, rs => { const b = M["Revenue"].fn(rs), j = rs.length; return j ? b / j : null; }), col: CORAL },
        { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, spk: momReduce("reviews_breakdown", 12, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)), col: PINK }
      ];
      kpis.forEach(k => {
        const el = document.createElement("div"); el.className = "mrx-kpi";
        el.innerHTML = `<div class="mrx-kl">${k.l}</div><div class="mrx-kv">${k.v}</div>
          <div class="mrx-chips">${chip(k.c, k.ly, "YoY")}${chip(k.c, k.pm, "MoM")}</div>
          <div class="mrx-spark"></div>`;
        g.appendChild(el); sparkline(el.querySelector(".mrx-spark"), k.spk, null, k.col);
      });
      // exec summary sentence
      const gpRev = revLY ? (rev - revLY) / Math.abs(revLY) : 0;
      const tone = gpRev > 0.08 ? "A strong" : gpRev < -0.05 ? "A softer" : "A steady";
      const ex = document.createElement("div"); ex.className = "mrx-exec"; ex.style.gridColumn = "1/-1";
      ex.innerHTML = `<b>${tone} ${MON[mo]} ${curY}.</b> Revenue ${moneyC(rev)} (${gpRev >= 0 ? "+" : ""}${(gpRev * 100).toFixed(0)}% YoY), operational profit ${moneyC(op)} at ${pct(margin)} margin, ${fmtN(jobs)} jobs from ${fmtN(leadsN)} leads booked at ${pct(bk)}. Avg job value ${moneyC(avgJob)}.`;
      g.appendChild(ex);
    }

    /* ---- SECTION 2 · Revenue & Growth ---- */
    {
      const g = section("Revenue & Growth", "5-year " + MON[mo] + " trend and 12-month momentum");
      const revT = trendSeries("closing", "Revenue"), opT = trendSeries("closing", "Operational Profit by Formula"), jobT = trendSeries("closing", "Total Jobs");
      yoyBars(g, "Total Revenue", revT, moneyC);
      lines(g, "Revenue & Profit — momentum", "last 12 months", [ { label: "Revenue", series: momSeries("closing", "Revenue", 12), color: INDIGO, fill: true }, { label: "Op. Profit", series: momSeries("closing", "Operational Profit by Formula", 12), color: POS } ], moneyC);
      const confT = trendSeries("moveboard", "Confirmed Leads"), bkT = trendSeries("moveboard", "Booking Rate");
      combo(g, "Confirmed Jobs & Booking Rate", MON[mo] + " · " + confT.length + "-yr", confT, "Confirmed", fmtN, bkT, "Booking %", pct);
      const c1 = yoyBars(g, "Operational Profit", opT, moneyC); note(c1, trendInsight("Operational Profit", opT, moneyC, MON[mo]));
      const c2 = yoyBars(g, "Jobs Done", jobT, fmtN); note(c2, trendInsight("Jobs Done", jobT, fmtN, MON[mo]));
    }

    /* ---- SECTION 3 · Profitability & P&L ---- */
    {
      const g = section("Profitability & P&L", "where the revenue goes, and margin trend");
      // waterfall — reconciles EXACTLY to Op Profit: base = Total Bill (the measure's own
      // base), then subtract each cost bucket. (Revenue KPI adds a small trips figure on top.)
      const rowsW = withMonth(curY, mo, () => RS.filtered("closing", closing));
      const totBill = M["Total Bill"].fn(rowsW);
      const forman = M["Forman Salary"].fn(rowsW), driver = M["Driver Salary"].fn(rowsW);
      const helper = withMonth(curY, mo, () => M["Helper Salary"].fn(RS.filtered("helper_salaries", DS.helper_salaries || [])));
      const comm = withMonth(curY, mo, () => M["Sales Commission"].fn(RS.filtered("sales_salaries", DS.sales_salaries || [])));
      const expense = M["Car Expense"].fn(rowsW) + M["Fuel Expense"].fn(rowsW) + M["Hotel Expense"].fn(rowsW) + M["Toll Expense"].fn(rowsW) + M["Truck Expense"].fn(rowsW) + M["Other Expenses"].fn(rowsW);
      const refundTot = withMonth(curY, mo, () => M["Total Refunds"] ? M["Total Refunds"].fn(RS.filtered("refunds", DS.refunds || [])) : 0);
      const steps = [ { label: "Total Bill", v: totBill, type: "total" }, { label: "Foreman Sal.", v: -forman }, { label: "Driver Sal.", v: -driver }, { label: "Helper Sal.", v: -(helper || 0) }, { label: "Sales Comm.", v: -(comm || 0) }, { label: "Expenses", v: -expense }, { label: "Refunds", v: -(refundTot || 0) }, { label: "Op. Profit", v: op, type: "total" } ];
      const wc = waterfall(g, "Total Bill → Operational Profit", monLbl, steps);
      note(wc, `From ${moneyC(totBill)} in billings, labor + expenses + refunds leave ${moneyC(op)} operational profit — a ${pct(margin)} margin.`);
      lines(g, "Operational Profit Margin", "last 12 months", [ { label: "Margin", series: momSeries("closing", "Operational Profit Margin", 12), color: VIOLET, fill: true } ], pct);
      // op profit by state (fixed segment scoping)
      rankBars(g, "Operational Profit by State", segSeries("closing", "Operational Profit by Formula", "State Name"), money, { top: 10, note: segInsight(segSeries("closing", "Operational Profit by Formula", "State Name"), money) });
      // returned / recommended stat grid
      const rr = ["Returned Customer", "Recommended"].map(src => {
        const rev2 = segSeries("closing", "Revenue", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const op2 = segSeries("closing", "Operational Profit by Formula", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const j2 = segSeries("closing", "Total Jobs", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        return { src, rev: rev2 ? rev2.v : 0, op: op2 ? op2.v : 0, jobs: j2 ? j2.v : 0 };
      });
      const rrHtml = `<table class="mrx-tbl"><thead><tr><th>Customer type</th><th>Revenue</th><th>Op. Profit</th><th>Jobs</th></tr></thead><tbody>${rr.map(r => `<tr><td>${r.src}</td>${td(money(r.rev))}${td(money(r.op))}${td(fmtN(r.jobs))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Returned & Recommended customers", monLbl, rrHtml, { span2: false });
    }

    /* ---- SECTION 4 · Demand & Lead Funnel ---- */
    {
      const g = section("Demand & Lead Funnel", "conversion this month and rep performance");
      funnel(g, "Lead Funnel", monLbl + " · Total → Qualified → Confirmed", [ { k: "Total Leads", v: leadsN || 0 }, { k: "Qualified", v: valueFor("moveboard", "Qualified Leads", curY, mo) || 0 }, { k: "Confirmed", v: valueFor("moveboard", "Confirmed Leads", curY, mo) || 0 } ]);
      // bad leads by reason grouped YoY
      const badCur = segReduce("moveboard", "Status", rs => rs.length, curY, mo, { pre: r => r["Status Category"] === "Bad Lead" }).slice(0, 6);
      const badLY = segReduce("moveboard", "Status", rs => rs.length, curY - 1, mo, { pre: r => r["Status Category"] === "Bad Lead" });
      const badMap = {}; badLY.forEach(r => badMap[r.k] = r.v);
      groupedBars(g, "Bad Leads by reason — YoY", badCur.map(r => r.k), badCur.map(r => badMap[r.k] || 0), String(curY - 1), badCur.map(r => r.v), String(curY), fmtN, { sub: MON[mo] });
      // booking rate by salesperson (bullet vs team avg)
      const spBook = segReduce("moveboard", "Assigned", rs => { const q = rs.filter(r => r["Status Category"] !== "Bad Lead").length, c = rs.filter(r => r["Status Category"] === "Confirmed").length; return q ? c / q : null; }, curY, mo).filter(r => r.v != null && r.rows.length >= 5).slice(0, 12);
      bullet(g, "Booking rate by salesperson", monLbl + " · vs team average", spBook, pct, bk || 0, { span2: true, note: "Bars below the dashed line are converting under the team average — coaching targets." });
    }

    /* ---- SECTION 5 · Composition & Segments ---- */
    {
      const g = section("Revenue Composition & Segments", "how revenue splits this month");
      stackShare(g, "Revenue by Moving Type", monLbl, segSeries("closing", "Revenue", "Moving Type"), money);
      rankBars(g, "Revenue by Source", segSeries("closing", "Revenue", "Source"), money, { top: 10, note: segInsight(segSeries("closing", "Revenue", "Source"), money) });
      donut(g, "Lead Status Mix", segReduce("moveboard", "Status Category", rs => rs.length), fmtN, { center: fmtN(leadsN), centerLbl: "leads" });
    }

    /* ---- SECTION 6 · Geography ---- */
    {
      const g = section("Geography — by State", "four metrics per state, heat-scaled");
      const revS = segSeries("closing", "Revenue", "State Name"), opS = segSeries("closing", "Operational Profit by Formula", "State Name"), jobS = segSeries("closing", "Total Jobs", "State Name");
      const opMap = {}, jobMap = {}; opS.forEach(r => opMap[r.k] = r.v); jobS.forEach(r => jobMap[r.k] = r.v);
      // booking rate per state (moveboard)
      const bkS = segReduce("moveboard", "State Name", rs => { const q = rs.filter(r => r["Status Category"] !== "Bad Lead").length, c = rs.filter(r => r["Status Category"] === "Confirmed").length; return q ? c / q : null; }, curY, mo);
      const bkMap = {}; bkS.forEach(r => bkMap[r.k] = r.v);
      const states = revS.slice(0, 12).map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, rev: r.v, op: opMap[r.k] || 0, jobs: jobMap[r.k] || 0, bk: bkMap[r.k] }));
      const rmin = Math.min(...states.map(s2 => s2.rev)), rmax = Math.max(...states.map(s2 => s2.rev));
      const omin = Math.min(...states.map(s2 => s2.op)), omax = Math.max(...states.map(s2 => s2.op));
      const jmin = Math.min(...states.map(s2 => s2.jobs)), jmax = Math.max(...states.map(s2 => s2.jobs));
      const rowsH = states.map(s2 => `<tr><td>${esc(s2.k)}</td>
        ${td(money(s2.rev), `background:${seqBg(s2.rev, rmin, rmax)};color:${seqInk(s2.rev, rmin, rmax)}`)}
        ${td(money(s2.op), `background:${seqBg(s2.op, omin, omax)};color:${seqInk(s2.op, omin, omax)}`)}
        ${td(fmtN(s2.jobs), `background:${seqBg(s2.jobs, jmin, jmax)};color:${seqInk(s2.jobs, jmin, jmax)}`)}
        ${td(s2.bk == null ? "—" : pct(s2.bk), s2.bk == null ? "" : `background:${divBg((s2.bk - (bk || 0)) / Math.max(.15, bk || .15))}`)}</tr>`).join("");
      tableCard(g, "State performance matrix", monLbl, `<table class="mrx-tbl"><thead><tr><th>State</th><th>Revenue</th><th>Op. Profit</th><th>Jobs</th><th>Booking%</th></tr></thead><tbody>${rowsH}</tbody></table>`, { note: "Blue intensity = $ / jobs magnitude; Booking% shaded green>team-avg, red<team-avg." });
      rankBars(g, "Revenue by State", revS.map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, v: r.v })), money, { top: 10 });
    }

    /* ---- SECTION 7 · Sales Team ---- */
    {
      const g = section("Sales Team Performance", "per-rep scorecard and large-move conversion");
      const revSP = segSeries("closing", "Revenue", "Sales Person"), opSP = segSeries("closing", "Operational Profit by Formula", "Sales Person");
      const opMap = {}; opSP.forEach(r => opMap[r.k] = r.v);
      // moveboard per rep (Assigned)
      const mb = segReduce("moveboard", "Assigned", rs => rs, curY, mo);
      const mbMap = {}; mb.forEach(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = r.rows.filter(x => x["Status Category"] === "Confirmed").length, bad = r.rows.filter(x => x["Status Category"] === "Bad Lead").length; mbMap[r.k] = { q, c, bad, tot: r.rows.length, book: q ? c / q : null, dead: r.rows.length ? bad / r.rows.length : null }; });
      const reps = revSP.slice(0, 14).map(r => ({ k: r.k, rev: r.v, op: opMap[r.k] || 0, m: mbMap[r.k] || {} }));
      const rmax = Math.max(...reps.map(r => r.rev));
      const rowsH = reps.map(r => `<tr><td>${esc(r.k)}</td>
        <td class="bar"><i style="width:${(r.rev / rmax * 100).toFixed(1)}%"></i><span>${money(r.rev)}</span></td>
        ${td(money(r.op))}${td(fmtN(r.m.q || 0))}${td(fmtN(r.m.c || 0))}
        ${td(r.m.book == null ? "—" : pct(r.m.book), r.m.book == null ? "" : `background:${divBg((r.m.book - (bk || 0)) / Math.max(.15, bk || .15))}`)}
        ${td(r.m.dead == null ? "—" : pct(r.m.dead), r.m.dead == null ? "" : `background:${divBg(-(r.m.dead - .3) / .3)}`)}</tr>`).join("");
      tableCard(g, "Salesperson scorecard", monLbl, `<table class="mrx-tbl"><thead><tr><th>Sales Person</th><th>Revenue</th><th>Op. Profit</th><th>Qual.</th><th>Conf.</th><th>Booking%</th><th>Dead%</th></tr></thead><tbody>${rowsH}</tbody></table>`, { note: "Bars = revenue share; Booking% green>team-avg; Dead% red when high — the coaching signals in one place." });
      // >1000 CF conversion by rep
      const bigPre = { pre: r => { const cf = String(r["CF Range"] || ""); return /1000|1500|2000|Over|1001|>|\+/.test(cf) && !/0-1000|<1000|Under/.test(cf); } };
      const bigMb = segReduce("moveboard", "Assigned", rs => rs, curY, mo, bigPre).map(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = r.rows.filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, q, c, book: q ? c / q : null }; }).filter(r => r.q >= 2).sort((a, b) => b.q - a.q).slice(0, 10);
      if (bigMb.length) groupedBars(g, "Large moves (>1000 CF) — Qualified vs Confirmed", bigMb.map(r => r.k), bigMb.map(r => r.q), "Qualified", bigMb.map(r => r.c), "Confirmed", fmtN, { span2: true, sub: monLbl });
    }

    /* ---- SECTION 8 · Operations & Crew ---- */
    {
      const g = section("Operations & Crew (Foreman)", "productivity, quality score and month-over-month");
      // foreman scorecard from mart
      const scRows = (DS.scorecard || []).filter(r => { const d = String(r["Month"] || "").slice(0, 7); return d === `${curY}-${String(mo).padStart(2, "0")}`; });
      if (scRows.length) {
        const sc = scRows.map(r => ({ f: r.Foreman, jobs: num(r["Total Jobs"]), cf: num(r["Total CF"]), p100: num(r["Packing per 100 CF"]), rev: num(r["Total Reviews Written"]), claims: num(r["Forman Fault Claims"]), score: num(r["Forman Score"]), rank: num(r["Forman Score Rank"]), prev: num(r["Forman Score Prev Month"]) }))
          .sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 15);
        const smax = Math.max(...sc.map(r => r.score || 0)) || 1, cmax = Math.max(...sc.map(r => r.claims), 1);
        const rowsH = sc.map((r, i) => { const arrow = r.prev ? (r.score > r.prev ? `<span style="color:${POS}">▲</span>` : r.score < r.prev ? `<span style="color:${NEG}">▼</span>` : "–") : ""; return `<tr><td>${i === 0 ? "👑 " : ""}${esc(r.f)}</td>
          ${td(fmtN(r.jobs))}${td(fmtN(r.cf))}${td(fmt1(r.p100))}${td(fmtN(r.rev))}
          ${td(fmtN(r.claims), `background:${mix("#ffffff", "#f6cccc", Math.min(1, r.claims / cmax))}`)}
          <td class="bar"><i style="width:${(r.score / smax * 100).toFixed(0)}%;background:rgba(183,226,59,.32)"></i><span>${fmt1(r.score)} ${arrow}</span></td></tr>`; }).join("");
        tableCard(g, "Foreman scorecard — ranked", monLbl, `<table class="mrx-tbl"><thead><tr><th>Foreman</th><th>Jobs</th><th>CF</th><th>Pack/100CF</th><th>Reviews</th><th>Claims</th><th>Score</th></tr></thead><tbody>${rowsH}</tbody></table>`, { note: "Composite Forman Score with MoM arrow; claims shaded red. Rank 1 crowned." });
      }
      // jobs vs hours combo
      const jobF = segSeries("closing", "Total Jobs", "Foreman").slice(0, 12);
      const hrMap = {}; segSeries("closing", "Hours Worked by Forman", "Foreman").forEach(r => hrMap[r.k] = r.v);
      combo(g, "Jobs vs Hours by Foreman", monLbl, jobF, "Jobs", fmtN, jobF.map(r => ({ k: r.k, v: hrMap[r.k] || 0 })), "Hours", fmtN, { span2: true });
      // packing written MoM by foreman
      const packCur = segSeries("closing", "Total Packing Written", "Foreman").slice(0, 12);
      const packPrev = {}; segSeries("closing", "Total Packing Written", "Foreman", PMY, PM).forEach(r => packPrev[r.k] = r.v);
      groupedBars(g, "Packing written by foreman — MoM", packCur.map(r => r.k), packCur.map(r => packPrev[r.k] || 0), MS[PM], packCur.map(r => r.v), MS[mo], money, { span2: true, sub: `${MS[PM]} vs ${MS[mo]}` });
    }

    /* ---- SECTION 9 · Packing & Storage ---- */
    {
      const g = section("Packing & Storage", "packing economics and storage income trend");
      const packT = trendSeries("closing", "Total Packing Written");
      const packSalT = trendSeries("closing", "Forman Salary - Packing");
      combo(g, "Packing written vs foreman packing pay", MON[mo] + " · " + packT.length + "-yr", packT, "Written", moneyC, packT.map((r, i) => ({ k: r.k, v: (packSalT[i] && packSalT[i].v) ? r.v / packSalT[i].v : null })), "Rev / $1 pay", v => "$" + fmt1(v));
      // storage income last 14 months (stacked additional vs included is not separable here → show additional trend + table)
      const stoT = momSeries("storage", "Storage Additional Revenue", 14);
      lines(g, "Storage additional revenue", "last 14 months", [ { label: "Storage Add'l Rev", series: stoT, color: TEAL, fill: true } ], money);
      const stoRows = stoT.map(r => ({ k: MS[r.m] + " " + r.y, add: r.v, bill: valueFor("closing", "Revenue", r.y, r.m), jobs: valueFor("closing", "Total Jobs", r.y, r.m) }));
      const html = `<table class="mrx-tbl"><thead><tr><th>Month</th><th>Total Bill</th><th>Jobs</th><th>Storage Add'l Rev</th></tr></thead><tbody>${stoRows.map(r => `<tr><td>${r.k}</td>${td(r.bill == null ? "—" : money(r.bill))}${td(r.jobs == null ? "—" : fmtN(r.jobs))}${td(r.add == null ? "—" : money(r.add))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Storage income — last 14 months", "", html, { span2: false });
    }

    /* ---- SECTION 10 · Quality & Customer Experience ---- */
    {
      const g = section("Quality & Customer Experience", "reviews, negative reviews and claims");
      // CX KPI strip
      const claimsN = reduceMonth("claims", curY, mo, rs => rs.length) || 0;
      const claimsPM = reduceMonth("claims", PMY, PM, rs => rs.length) || 0;
      const negN = reduceMonth("negative_reviews", curY, mo, rs => rs.length) || 0;
      const negPM = reduceMonth("negative_reviews", PMY, PM, rs => rs.length) || 0;
      const claimRate = jobs ? claimsN / jobs * 100 : null;
      [ { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, pm: revWrittenPM, col: PINK },
        { l: "Negative Reviews", v: fmtN(negN), c: negN, pm: negPM, col: CORAL, inv: 1 },
        { l: "Claims Filed", v: fmtN(claimsN), c: claimsN, pm: claimsPM, col: AMBER, inv: 1 },
        { l: "Claims / 100 jobs", v: claimRate == null ? "—" : fmt1(claimRate), c: claimRate, pm: (jobsPM ? claimsPM / jobsPM * 100 : null), col: SLATE, inv: 1 }
      ].forEach(k => { const el = document.createElement("div"); el.className = "mrx-kpi"; el.innerHTML = `<div class="mrx-kl">${k.l}</div><div class="mrx-kv">${k.v}</div><div class="mrx-chips">${chip(k.c, k.pm, "MoM", k.inv)}</div>`; g.appendChild(el); });
      // claims by responsibility + reason
      rankBars(g, "Claims by responsibility", segReduce("claims", "Responsibility", rs => rs.length, curY, mo), fmtN, { top: 8 });
      donut(g, "Claims by reason", segReduce("claims", "Reason", rs => rs.length, curY, mo).filter(r => r.k !== "—" && r.k !== "(blank)"), fmtN, { center: fmtN(reduceMonth("claims", curY, mo, rs => rs.filter(r => r.Reason && r.Reason !== "(blank)").length) || 0), centerLbl: "classified" });
      // refunds by reason
      const refByReason = segReduce("refunds", "Reason", rs => Math.abs(rs.reduce((a, r) => a + num(r["Total refund"]), 0)), curY, mo).filter(r => r.v > 0);
      const refTot = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      rankBars(g, "Refunds by reason", refByReason, money, { top: 8, sub: `${money(refTot)} · ${rev ? pct(refTot / rev) : "—"} of revenue`, note: `${money(refTot)} refunded in ${MON[mo]} — ${rev ? pct(refTot / rev) : "—"} of revenue.` });
    }

    /* ---- SECTION 11 · Marketing & Channels ---- */
    {
      const g = section("Marketing & Channels", "ad spend momentum, source revenue and call demand");
      // ad spend trend (card_expenses, Is Advertising) — trailing 12 (robust to month lag)
      const adTrend = momReduce("card_expenses", 12, rs => { const ad = rs.filter(r => Number(r["Is Advertising"]) === 1); return ad.length ? ad.reduce((a, r) => a + num(r.Amount), 0) : null; });
      lines(g, "Advertising spend — momentum", "last 12 months", [ { label: "Ad Spend", series: adTrend, color: AMBER, fill: true } ], moneyC);
      // revenue by source ranked (leader)
      rankBars(g, "Revenue by Source", segSeries("closing", "Revenue", "Source"), money, { top: 10 });
      // call volume (callrail) stacked answered/missed over 12 mo
      const callLabels = momReduce("callrail", 12, rs => rs.length).map(r => r.k);
      const answered = momReduce("callrail", 12, rs => rs.filter(r => String(r["Call Status"]) === "Answered Call").length).map(r => r.v);
      const missed = momReduce("callrail", 12, rs => rs.filter(r => /Missed|Abandoned/.test(String(r["Call Status"]))).length).map(r => r.v);
      stackedTime(g, "Inbound calls — answered vs missed", "last 12 months (CallRail)", callLabels, [ { label: "Answered", data: answered, color: INDIGO }, { label: "Missed/Abandoned", data: missed, color: CORAL } ], fmtN);
      // calls by source (current month)
      const callsBySrc = segReduce("callrail", "Source", rs => rs.length, curY, mo).slice(0, 10);
      const ftc = reduceMonth("callrail", curY, mo, rs => { const t = rs.length, f = rs.filter(r => Number(r["First-Time Caller"]) === 1).length; return t ? f / t : null; });
      rankBars(g, "Calls by source", callsBySrc, fmtN, { top: 10, sub: monLbl, note: ftc == null ? "" : `${pct(ftc)} of calls this month were first-time callers.` });
    }

    /* ---- SECTION 12 · Lead Segmentation (heat funnel tables) ---- */
    {
      const g = section("Lead Segmentation", "booking funnel by service type, size and cubic feet");
      function funnelTable(title, col) {
        const d = segReduce("moveboard", col, rs => rs, curY, mo).map(r => { const rows2 = r.rows; const tot = rows2.length, bad = rows2.filter(x => x["Status Category"] === "Bad Lead").length, q = tot - bad, c = rows2.filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, tot, q, c, bad, book: q ? c / q : null }; }).sort((a, b) => b.tot - a.tot).slice(0, 12);
        if (!d.length) return; const tot = d.reduce((a, b) => ({ tot: a.tot + b.tot, q: a.q + b.q, c: a.c + b.c, bad: a.bad + b.bad }), { tot: 0, q: 0, c: 0, bad: 0 });
        const rowsH = d.map(r => `<tr><td>${esc(r.k === "—" ? "Unassigned" : r.k)}</td>${td(fmtN(r.tot))}${td(fmtN(r.q))}${td(fmtN(r.c))}${td(fmtN(r.bad))}${td(r.book == null ? "—" : pct(r.book), r.book == null ? "" : `background:${divBg((r.book - (bk || 0)) / Math.max(.2, bk || .2))}`)}</tr>`).join("");
        const trow = `<tr class="tot"><td>Total</td>${td(fmtN(tot.tot))}${td(fmtN(tot.q))}${td(fmtN(tot.c))}${td(fmtN(tot.bad))}${td(tot.q ? pct(tot.c / tot.q) : "—")}</tr>`;
        tableCard(g, title, monLbl, `<table class="mrx-tbl"><thead><tr><th>${esc(col === "Service Type" ? "Service type" : col)}</th><th>Total</th><th>Qual.</th><th>Conf.</th><th>Bad</th><th>Booking%</th></tr></thead><tbody>${rowsH}${trow}</tbody></table>`, { span2: false });
      }
      funnelTable("Leads by service type", "Service Type");
      funnelTable("Leads by size of move", "Size of Move");
      funnelTable("Leads by CF range", "CF Range");
      funnelTable("Leads by state", "State Name");
    }

    /* ---------- controls + print ---------- */
    const reRender = () => { if (typeof renderPage === "function") renderPage(); else location.reload(); };
    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; reRender(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; reRender(); };
    const pb = document.getElementById("mrPrint"); if (pb) pb.onclick = () => window.print();
  }
});

var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5 });
