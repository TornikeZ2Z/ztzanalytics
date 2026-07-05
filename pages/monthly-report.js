/* Monthly Report — "Monthly Business Review" (v8, futuristic-infographic).
   Bold infographic system on a LIGHT canvas: SOLID flat fills only (no gradients, no
   transparency), monospaced tabular numerals, section number-badges + icons + "loaded-bar"
   rules, a solid dark masthead, delta pills, spark BARS, discrete solid heat cells. Brand
   lime reserved as a scarce signal (current period / leader / target). Reuses the RS measure
   library; Zip-to-Zip scope. Data/measure logic unchanged from the verified v7. */
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

    /* ---------- palette (bold infographic, SOLID) ---------- */
    const INK = "#0e1621", INK2 = "#1b2a3f", SUB = "#5a6775", FAINT = "#93a0b2", LINE = "#e4e9f0";
    const LIME = "#b7e23b", LIMED = "#7ba317";
    const BLUE = "#3b82f6", AMBER = "#f5a524", VIOLET = "#8b5cf6", TEAL = "#14b8a6", CORAL = "#ec6a5e", PINK = "#ec4899", SKY = "#38bdf8";
    const POS = "#2fa36b", NEG = "#e5484d";
    const CTX = "#c6d0db"; // context / comparison gray (solid)
    const CAT = [INK, BLUE, AMBER, VIOLET, TEAL, CORAL, PINK, SKY]; // lime reserved, ink-first
    const AXIS = "#7b869a", GRID = "#eef1f6";
    const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace";
    // discrete SOLID heat (no alpha) — magnitude & diverging
    const HEAT = ["#eef2ee", "#dce7c4", "#c3dc8e", "#a6d22a", "#7ba317"];
    const seqBg = (v, min, max) => { if (v == null || max <= min) return "transparent"; const t = Math.max(0, Math.min(1, (v - min) / (max - min))); return HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor(t * HEAT.length - 1e-9)))]; };
    const seqInk = (v, min, max) => { const t = max <= min ? 0 : (v - min) / (max - min); return t > 0.82 ? "#fff" : INK; };
    const divBg = t => { if (t == null) return "transparent"; const c = Math.max(-1, Math.min(1, t)); if (Math.abs(c) < 0.12) return "transparent"; return c >= 0 ? (c > .55 ? "#bfe3ca" : "#e0f0e6") : (c < -.55 ? "#f2b8bc" : "#f9dde0"); };
    const redBg = t => { t = Math.max(0, Math.min(1, t || 0)); return t < 0.02 ? "transparent" : t > .66 ? "#efa3a3" : t > .33 ? "#f5cccc" : "#fbe6e7"; };

    /* ---------- icons (stroke; styled via CSS) ---------- */
    const ICONS = {
      "Executive Summary": '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
      "Revenue & Growth": '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
      "Profitability & P&L": '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="5"/><path d="M14 6.5a5 5 0 010 11"/></svg>',
      "Demand & Lead Funnel": '<svg viewBox="0 0 24 24"><path d="M3 4h18l-7 8v7l-4-2v-5z"/></svg>',
      "Revenue Composition & Segments": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>',
      "Geography — by State": '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
      "Sales Team Performance": '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5 5.5-5s5.5 1.7 5.5 5"/><path d="M16 5a3 3 0 010 6"/><path d="M20.5 20c0-2.4-1.3-3.9-3.5-4.6"/></svg>',
      "Operations & Crew (Foreman)": '<svg viewBox="0 0 24 24"><rect x="1.5" y="6" width="12" height="9" rx="1"/><path d="M13.5 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
      "Packing & Storage": '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/></svg>',
      "Quality & Customer Experience": '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 17l-5.2 2.5 1-5.7L3.5 9.7l5.9-.9z"/></svg>',
      "Marketing & Channels": '<svg viewBox="0 0 24 24"><path d="M3 10v4l12 5V5z"/><path d="M15 8.5a4 4 0 010 7"/></svg>',
      "Lead Segmentation": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>',
      _def: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>'
    };
    const KIC = {
      dollar: '<svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 6c0-2-2.2-3-5-3S7 4 7 6s2.2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3"/></svg>',
      trend: '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
      pct: '<svg viewBox="0 0 24 24"><path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>',
      truck: '<svg viewBox="0 0 24 24"><rect x="1.5" y="6" width="12" height="9" rx="1"/><path d="M13.5 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
      funnel: '<svg viewBox="0 0 24 24"><path d="M3 4h18l-7 8v7l-4-2v-5z"/></svg>',
      check: '<svg viewBox="0 0 24 24"><path d="M4 12l5 5L20 6"/></svg>',
      tag: '<svg viewBox="0 0 24 24"><path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1.6"/></svg>',
      star: '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 17l-5.2 2.5 1-5.7L3.5 9.7l5.9-.9z"/></svg>',
      warn: '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>'
    };

    /* ---------- design system (scoped, light, solid, print-ready) ---------- */
    if (!document.getElementById("mrx-css")) {
      const s = document.createElement("style"); s.id = "mrx-css";
      s.textContent = `
      .mrx{background:#f4f6fa;color:${INK};border-radius:16px;padding:24px 24px 46px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mrx *{box-sizing:border-box}
      .mrx-cover{position:relative;background:${INK};color:#fff;border-radius:16px;padding:24px 26px;margin-bottom:22px;overflow:hidden}
      .mrx-cover .mrx-accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:${LIME}}
      .mrx-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${LIME}}
      .mrx-h1{font-size:33px;font-weight:800;letter-spacing:-.9px;margin:6px 0 4px;color:#fff}
      .mrx-cvsub{color:#a9b6c6;font-size:12.5px;font-weight:600}
      .mrx-print{position:absolute;top:22px;right:24px;background:${LIME};color:${INK};border:0;border-radius:9px;padding:9px 15px;font-size:12.5px;font-weight:800;cursor:pointer;z-index:2}
      .mrx-ctl{font:inherit;font-weight:700;color:#fff;background:${INK2};border:1px solid #2c3e57;border-radius:7px;padding:3px 8px;margin-left:4px}
      .mrx-sec{margin:30px 0 4px}
      .mrx-sec-h{display:flex;align-items:center;gap:12px}
      .mrx-badge{width:34px;height:34px;flex:0 0 34px;border-radius:9px;background:${INK};color:#fff;font-weight:800;font-size:15px;display:grid;place-items:center;font-family:${MONO}}
      .mrx-badge.mrx-hero{background:${LIME};color:${INK}}
      .mrx-sec-ic svg{width:20px;height:20px;fill:none;stroke:${INK};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-sec-ic{display:flex}
      .mrx-sec-tt{display:flex;flex-direction:column;line-height:1.14}
      .mrx-sec-t{font-size:19px;font-weight:800;color:${INK};letter-spacing:-.4px}
      .mrx-sec-s{font-size:11.5px;font-weight:600;color:${SUB}}
      .mrx-code{margin-left:auto;font-family:${MONO};font-size:10.5px;font-weight:700;color:${FAINT};letter-spacing:.08em}
      .mrx-rule{position:relative;height:2px;background:${INK};margin:11px 0 2px}
      .mrx-rule i{position:absolute;left:0;top:0;height:2px;width:46px;background:${LIME}}
      .mrx-grid{display:grid;gap:15px;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));margin-top:14px}
      .mrx-grid.k{grid-template-columns:repeat(auto-fit,minmax(186px,1fr))}
      .mrx-card{position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:15px 16px;box-shadow:0 1px 2px rgba(14,22,33,.05)}
      .mrx-card:before{content:"";position:absolute;left:16px;top:0;width:34px;height:3px;background:${LIME};border-radius:0 0 3px 3px}
      .mrx-card.span2{grid-column:span 2}
      .mrx-ct{font-size:13.5px;font-weight:750;color:${INK}}
      .mrx-cs{font-size:10px;font-weight:700;color:${FAINT};text-transform:uppercase;letter-spacing:.05em;font-family:${MONO}}
      .mrx-chead{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:9px;gap:8px;border-bottom:1px solid #eef1f5;padding-bottom:8px}
      .mrx-box{position:relative;height:280px}
      .mrx-note{margin-top:10px;font-size:12px;color:#48505e;line-height:1.5;background:#f6f8fb;border-left:3px solid ${LIME};padding:8px 11px;border-radius:0 7px 7px 0}
      .mrx-kpi{position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:14px 15px 13px;box-shadow:0 1px 2px rgba(14,22,33,.05);overflow:hidden}
      .mrx-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:${INK}}
      .mrx-kpi.mrx-hero:before{background:${LIME}}
      .mrx-kl{font-size:10.5px;font-weight:750;color:${SUB};text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:6px}
      .mrx-ic{display:flex}.mrx-ic svg{width:14px;height:14px;fill:none;stroke:${FAINT};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-kv{font-size:29px;font-weight:800;color:${INK};letter-spacing:-.6px;margin:4px 0 0;font-family:${MONO};font-variant-numeric:tabular-nums}
      .mrx-uline{display:block;width:24px;height:3px;background:${LIME};border-radius:2px;margin:3px 0 7px}
      .mrx-chips{display:flex;gap:5px;flex-wrap:wrap}
      .mrx-chip{font-size:10.5px;font-weight:750;padding:2px 6px;border-radius:5px;font-family:${MONO};font-variant-numeric:tabular-nums}
      .mrx-spark{height:30px;position:relative;margin-top:9px}
      .mrx-exec{background:${INK};color:#e8edf3;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;margin-top:16px}
      .mrx-exec b{color:${LIME}}
      .mrx-tbl{width:100%;border-collapse:collapse;font-size:12px;font-variant-numeric:tabular-nums;font-family:${MONO}}
      .mrx-tbl th{font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${SUB};text-align:right;padding:6px 8px;border-bottom:2px solid ${INK};white-space:nowrap;font-family:Inter,sans-serif}
      .mrx-tbl th:first-child{text-align:left}
      .mrx-tbl td{padding:6px 8px;text-align:right;border-bottom:1px solid #eef1f5;color:${INK2};white-space:nowrap}
      .mrx-tbl td:first-child{text-align:left;font-weight:600;color:${INK};font-family:Inter,sans-serif}
      .mrx-tbl tr:last-child td{border-bottom:0}
      .mrx-tbl tr.tot td{font-weight:800;border-top:2px solid ${INK};color:${INK}}
      .mrx-tbl .bar{position:relative}
      .mrx-tbl .bar i{position:absolute;left:0;top:3px;bottom:3px;background:#e6ebf8;border-radius:3px;z-index:0}
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

    /* ---------- chart primitives (SOLID) ---------- */
    const baseOpts = extra => Object.assign({ maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } } }, extra || {});
    const axX = (o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 10.5 } }, grid: { display: false }, border: { color: LINE } }, o || {});
    const axY = (fmt, o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 10 }, maxTicksLimit: 6, callback: v => fmt ? fmt(v) : v }, grid: { color: GRID }, border: { display: false } }, o || {});
    // value labels drawn on bars — fmt captured in CLOSURE (never in options)
    const valLabels = (fmt, horiz, color) => ({ id: "vlab", afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = "700 10px " + MONO; ctx.fillStyle = color || INK;
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
    function note(c, txt) { if (!txt) return; const n = document.createElement("div"); n.className = "mrx-note"; n.innerHTML = `<b style="color:${LIMED}">Insight · </b>${esc(txt)}`; c.appendChild(n); }
    function emptyBox(box, msg) { box.innerHTML = `<div class="mrx-empty">${esc(msg || ("No data for " + monLbl))}</div>`; }
    let bodyEl, secN = 0;
    function section(title, sub, klass) {
      secN++; const n = String(secN).padStart(2, "0");
      const wrap = document.createElement("section"); wrap.className = "mrx-sec";
      wrap.innerHTML = `<div class="mrx-sec-h">
        <span class="mrx-badge${secN === 1 ? " mrx-hero" : ""}">${n}</span>
        <span class="mrx-sec-ic">${ICONS[title] || ICONS._def}</span>
        <span class="mrx-sec-tt"><span class="mrx-sec-t">${esc(title)}</span><span class="mrx-sec-s">${esc(sub || "")}</span></span>
        <span class="mrx-code">SEC ${n}</span>
      </div><div class="mrx-rule"><i></i></div>`;
      const grid = document.createElement("div"); grid.className = "mrx-grid" + (klass ? " " + klass : ""); wrap.appendChild(grid);
      bodyEl.appendChild(wrap); return grid;
    }

    /* ---------- delta chip + KPI tile ---------- */
    function chip(cur, prev, label, inv) {
      if (cur == null || prev == null || !prev) return `<span class="mrx-chip" style="background:#eef1f5;color:${SUB}">${label} —</span>`;
      const g = (cur - prev) / Math.abs(prev); const up = g >= 0; const good = inv ? !up : up;
      const col = good ? "#1c7a4a" : "#b02a37"; const bg = good ? "#e4f3ea" : "#fbe6e7";
      return `<span class="mrx-chip" style="background:${bg};color:${col}">${label} ${up ? "▲" : "▼"} ${Math.abs(g * 100).toFixed(0)}%</span>`;
    }
    function kpiTile(g, k) {
      const el = document.createElement("div"); el.className = "mrx-kpi" + (k.hero ? " mrx-hero" : "");
      el.innerHTML = `<div class="mrx-kl">${k.icon ? `<span class="mrx-ic">${k.icon}</span>` : ""}${esc(k.l)}</div>
        <div class="mrx-kv">${k.v}</div><span class="mrx-uline"></span>
        <div class="mrx-chips">${k.ly !== undefined ? chip(k.c, k.ly, "YoY", k.inv) : ""}${k.pm !== undefined ? chip(k.c, k.pm, "MoM", k.inv) : ""}</div>
        ${k.spk ? `<div class="mrx-spark"></div>` : ""}`;
      g.appendChild(el);
      if (k.spk) sparkBars(el.querySelector(".mrx-spark"), k.spk);
      return el;
    }
    // spark BARS (solid, last bar lime) — no transparency
    function sparkBars(el, series) {
      const s = series.filter(r => r.v != null); if (!s.length) return;
      const cv = document.createElement("canvas"); el.appendChild(cv);
      new Chart(cv, { type: "bar", data: { labels: s.map((_, i) => i), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === s.length - 1 ? LIME : CTX), borderRadius: 2, maxBarThickness: 7, categoryPercentage: .92, barPercentage: .82 }] },
        options: baseOpts({ plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }) });
    }

    /* ---------- chart builders (SOLID, value labels, tension 0) ---------- */
    // 5-yr YoY bars, current year lime, avg reference
    function yoyBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.filter(r => r.v != null); const { c, box, cv } = chartCard(mount, title, opts.sub || (MS[mo] + " · " + s.length + "-yr"), opts);
      if (!s.length) { emptyBox(box); return c; }
      const avg = s.reduce((a, b) => a + b.v, 0) / s.length;
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === s.length - 1 ? LIME : INK), borderRadius: 5, maxBarThickness: 52, categoryPercentage: .7, barPercentage: .82 }] },
        options: baseOpts({ layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.y) } } }, scales: { x: axX(), y: axY(fmt, { beginAtZero: true }) } }),
        plugins: [valLabels(fmt, false), { id: "avg", afterDraw(ch) { const y = ch.scales.y.getPixelForValue(avg), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "#b7c0cd"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = SUB; ctx.font = "700 9px " + MONO; ctx.textAlign = "left"; ctx.fillText("avg " + fmt(avg), a.left + 3, y - 3); ctx.restore(); } }] });
      return c;
    }
    // multi-line trend — solid, no area fill, straight segments
    function lines(mount, title, sub, sets, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = sets[0].series.map(r => r.k);
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "line",
        data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.series.map(r => r.v), borderColor: d.color || CAT[i], backgroundColor: d.color || CAT[i], fill: false, tension: 0, borderWidth: 2.6, pointRadius: labels.map((_, j) => j === labels.length - 1 ? 4 : 0), pointBackgroundColor: d.color || CAT[i], pointBorderColor: "#fff", pointBorderWidth: 1.5, spanGaps: true, yAxisID: d.axis || "y" })) },
        options: baseOpts({ plugins: { legend: { display: sets.length > 1, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, boxHeight: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + (x.dataset.yAxisID === "y1" ? (opts.fmt1 || fmt) : fmt)(x.parsed.y) } } },
          scales: opts.dual ? { x: axX(), y: axY(fmt), y1: axY(opts.fmt1 || fmt, { position: "right", grid: { display: false } }) } : { x: axX(), y: axY(fmt) } }) });
      return c;
    }
    // combo bar + line (two units) — solid bars, solid line
    function combo(mount, title, sub, barSeries, barLabel, barFmt, lineSeries, lineLabel, lineFmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = barSeries.map(r => r.k); if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { data: { labels, datasets: [
        { type: "bar", label: barLabel, data: barSeries.map(r => r.v), backgroundColor: labels.map((_, i) => i === labels.length - 1 ? LIME : INK), borderRadius: 4, maxBarThickness: 44, yAxisID: "y", order: 2 },
        { type: "line", label: lineLabel, data: lineSeries.map(r => r.v), borderColor: BLUE, backgroundColor: BLUE, tension: 0, borderWidth: 2.6, pointRadius: 3, pointBorderColor: "#fff", pointBorderWidth: 1.2, yAxisID: "y1", order: 1 }] },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.yAxisID === "y1" ? `${lineLabel}: ${lineFmt(x.parsed.y)}` : `${barLabel}: ${barFmt(x.parsed.y)}` } } },
          scales: { x: axX(), y: axY(barFmt, { beginAtZero: true, title: { display: true, text: barLabel, color: SUB, font: { size: 10, weight: "700" } } }), y1: axY(lineFmt, { position: "right", grid: { display: false }, title: { display: true, text: lineLabel, color: BLUE, font: { size: 10, weight: "700" } } }) } }) });
      return c;
    }
    // horizontal ranked bars, leader lime, value labels
    function rankBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.slice(0, opts.top || 12); const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { span2: opts.span2, h: Math.max(190, 40 + s.length * 27) });
      if (!s.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === 0 ? LIME : INK), borderRadius: 4, maxBarThickness: 20 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 58 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [valLabels(fmt, true)] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    // grouped horizontal bars (2 series: context gray vs ink)
    function groupedBars(mount, title, labels, sa, la, sb, lb, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, opts.sub || "", { span2: opts.span2, h: Math.max(200, 44 + labels.length * 30) });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels, datasets: [ { label: la, data: sa, backgroundColor: CTX, borderRadius: 3, maxBarThickness: 12 }, { label: lb, data: sb, backgroundColor: INK, borderRadius: 3, maxBarThickness: 12 } ] },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }) });
      return c;
    }
    // 100%-stacked single bar (composition of a small set) — solid
    function stackShare(mount, title, sub, parts, fmt) {
      const { c, box, cv } = chartCard(mount, title, sub, { h: 150 });
      const tot = parts.reduce((a, b) => a + b.v, 0); if (!tot) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels: [""], datasets: parts.map((p, i) => ({ label: p.k, data: [p.v], backgroundColor: CAT[i % CAT.length], borderRadius: 3, maxBarThickness: 46, stack: "s" })) },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: true, position: "bottom", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => `${x.dataset.label}: ${fmt(x.parsed.x)} (${(x.parsed.x / tot * 100).toFixed(0)}%)` } } }, scales: { x: { stacked: true, display: false, max: tot }, y: { stacked: true, display: false } } }),
        plugins: [{ id: "pctlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 11px " + MONO; ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ch.data.datasets.forEach((d, di) => { const el = ch.getDatasetMeta(di).data[0]; const share = d.data[0] / tot; if (share > .08) ctx.fillText(Math.round(share * 100) + "%", el.x, el.y); }); ctx.restore(); } }] });
      return c;
    }
    // donut for genuine composition (+ "Other") — solid segments, crisp white gaps
    function donut(mount, title, series, fmt, opts) {
      opts = opts || {}; const pos = series.filter(r => r.v > 0), head = pos.slice(0, 7), tail = pos.slice(7);
      const s = tail.length ? head.concat([{ k: "Other", v: tail.reduce((a, b) => a + b.v, 0) }]) : head;
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { h: 250 });
      if (!s.length) { emptyBox(box); return c; }
      const tot = s.reduce((a, b) => a + b.v, 0);
      new Chart(cv, { type: "doughnut", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((r, i) => r.k === "Other" ? "#aeb9c8" : CAT[i % CAT.length]), borderColor: "#fff", borderWidth: 3, hoverOffset: 5 }] },
        options: baseOpts({ cutout: "66%", plugins: { legend: { position: "right", labels: { color: INK2, font: { size: 11 }, boxWidth: 11, padding: 7, usePointStyle: true } }, tooltip: { callbacks: { label: x => `${x.label}: ${fmt(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)` } } } }),
        plugins: [{ id: "ctr", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = INK; ctx.font = "800 19px " + MONO; ctx.fillText(opts.center || fmt(tot), x, y - 2); ctx.fillStyle = FAINT; ctx.font = "700 10px Inter"; ctx.fillText(opts.centerLbl || "total", x, y + 15); ctx.restore(); } }] });
      return c;
    }
    // P&L waterfall (floating bars) — solid, dashed connectors
    function waterfall(mount, title, sub, steps) {
      const { c, box, cv } = chartCard(mount, title, sub, { span2: true, h: 300 });
      if (!steps.length) { emptyBox(box); return c; }
      let run = 0; const bars = [], colors = [], labels = [];
      steps.forEach(st2 => {
        labels.push(st2.label);
        if (st2.type === "total") { bars.push([0, st2.v]); colors.push(INK); run = st2.v; }
        else { const from = run, to = run + st2.v; bars.push([from, to]); colors.push(st2.v >= 0 ? POS : NEG); run = to; }
      });
      new Chart(cv, { type: "bar", data: { labels, datasets: [{ data: bars, backgroundColor: colors, borderRadius: 3, maxBarThickness: 46 }] },
        options: baseOpts({ layout: { padding: { top: 20 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => { const d = x.raw; return money(Array.isArray(d) ? d[1] - d[0] : d); } } } }, scales: { x: axX({ ticks: { color: AXIS, font: { family: MONO, size: 9.5 }, maxRotation: 40, minRotation: 0 } }), y: axY(moneyC, { beginAtZero: true }) } }),
        plugins: [
          { id: "wconn", beforeDatasetsDraw(ch) { const ctx = ch.ctx, meta = ch.getDatasetMeta(0); ctx.save(); ctx.strokeStyle = "#c8cfda"; ctx.setLineDash([3, 3]); for (let i = 0; i < meta.data.length - 1; i++) { const y = ch.scales.y.getPixelForValue(bars[i][1]); ctx.beginPath(); ctx.moveTo(meta.data[i].x, y); ctx.lineTo(meta.data[i + 1].x, y); ctx.stroke(); } ctx.setLineDash([]); ctx.restore(); } },
          { id: "wlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 9.5px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ch.getDatasetMeta(0).data.forEach((el, i) => { const d = bars[i]; const v = d[1] - d[0]; ctx.fillStyle = steps[i].type === "total" ? INK : (v >= 0 ? POS : NEG); ctx.fillText((v < 0 ? "-" : "") + moneyC(Math.abs(v)), el.x, Math.min(el.y, ch.scales.y.getPixelForValue(Math.max(d[0], d[1]))) - 3); }); ctx.restore(); } }] });
      return c;
    }
    // lead funnel (descending horizontal bars + conversion %) — solid, goal stage lime
    function funnel(mount, title, sub, stages) {
      const { c, box, cv } = chartCard(mount, title, sub, { h: 210 });
      if (!stages.length || !stages[0].v) { emptyBox(box); return c; }
      const top = stages[0].v;
      new Chart(cv, { type: "bar", data: { labels: stages.map(s2 => s2.k), datasets: [{ data: stages.map(s2 => s2.v), backgroundColor: stages.map((_, i) => i === stages.length - 1 ? LIME : INK), borderRadius: 4, maxBarThickness: 36 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 110 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmtN(x.parsed.x) + ` (${(x.parsed.x / top * 100).toFixed(0)}% of top)` } } }, scales: { x: { display: false, beginAtZero: true, max: top * 1.02 }, y: { ticks: { color: INK2, font: { size: 12, weight: "700" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [{ id: "flab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ch.getDatasetMeta(0).data.forEach((el, i) => { ctx.font = "800 12px " + MONO; ctx.fillStyle = INK; const conv = i === 0 ? "" : `  ${(stages[i].v / stages[i - 1].v * 100).toFixed(0)}%`; ctx.fillText(fmtN(stages[i].v), el.x + 6, el.y); if (conv) { ctx.font = "700 10px " + MONO; ctx.fillStyle = LIMED; ctx.fillText(conv, el.x + 6 + ctx.measureText(fmtN(stages[i].v)).width + 4, el.y); } }); ctx.restore(); } }] });
      return c;
    }
    // bullet bars: value vs a target tick, per row
    function bullet(mount, title, sub, rows, fmt, target, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, h: Math.max(190, 40 + rows.length * 27) });
      if (!rows.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels: rows.map(r => r.k), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => r.v >= target ? INK : NEG), borderRadius: 4, maxBarThickness: 18 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 52 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmt(x.parsed.x) + " (target " + fmt(target) + ")" } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [valLabels(fmt, true), { id: "tgt", afterDraw(ch) { const x = ch.scales.x.getPixelForValue(target), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = LIME; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.fillStyle = LIMED; ctx.font = "800 9px " + MONO; ctx.textAlign = "center"; ctx.fillText("target " + fmt(target), x, a.top - 2); ctx.restore(); } }] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    // stacked bars over time — solid
    function stackedTime(mount, title, sub, labels, sets, fmt, opts) {
      opts = opts || {}; const { c, box, cv } = chartCard(mount, title, sub, opts);
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || CAT[i], borderRadius: 2, maxBarThickness: 26, stack: "s" })) },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.y) } } }, scales: { x: Object.assign(axX(), { stacked: true }), y: Object.assign(axY(fmt, { beginAtZero: true }), { stacked: true }) } }) });
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
    const cover = document.createElement("div"); cover.className = "mrx-cover";
    cover.innerHTML = `
      <div class="mrx-accent"></div>
      <button class="mrx-print" id="mrPrint" title="Print / save as PDF">⬇ Download PDF</button>
      <div class="mrx-eyebrow">Monthly Business Review · Zip to Zip</div>
      <div class="mrx-h1">Report for ${MON[mo]} ${curY}</div>
      <div class="mrx-cvsub">${esc(freshness)} · single-company view ·
        <select id="mrMonth" class="mrx-ctl">${MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("")}</select>
        <select id="mrYear" class="mrx-ctl">${[curY + 1, curY, curY - 1, curY - 2].filter(y => y <= curY + 1).map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("")}</select></div>`;
    root.appendChild(cover);
    bodyEl = document.createElement("div"); root.appendChild(bodyEl);

    const PM = mo === 1 ? 12 : mo - 1, PMY = mo === 1 ? curY - 1 : curY; // prior month
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

    /* ---- 01 · Executive Summary ---- */
    {
      const g = section("Executive Summary", monLbl + " · vs last year & last month", "k");
      [
        { l: "Revenue", v: moneyC(rev), c: rev, ly: revLY, pm: revPM, spk: momSeries("closing", "Revenue", 12), icon: KIC.dollar, hero: 1 },
        { l: "Operational Profit", v: moneyC(op), c: op, ly: opLY, pm: opPM, spk: momSeries("closing", "Operational Profit by Formula", 12), icon: KIC.trend },
        { l: "Op. Margin", v: pct(margin), c: margin, ly: marginLY, pm: marginPM, spk: momSeries("closing", "Operational Profit Margin", 12), icon: KIC.pct },
        { l: "Jobs Done", v: fmtN(jobs), c: jobs, ly: jobsLY, pm: jobsPM, spk: momSeries("closing", "Total Jobs", 12), icon: KIC.truck },
        { l: "Leads", v: fmtN(leadsN), c: leadsN, ly: leadsLY, pm: leadsPM, spk: momSeries("moveboard", "Total Leads", 12), icon: KIC.funnel },
        { l: "Booking Rate", v: pct(bk), c: bk, ly: bkLY, pm: bkPM, spk: momSeries("moveboard", "Booking Rate", 12), icon: KIC.check },
        { l: "Avg Job Value", v: moneyC(avgJob), c: avgJob, ly: avgJobLY, pm: avgJobPM, spk: momReduce("closing", 12, rs => { const b = M["Revenue"].fn(rs), j = rs.length; return j ? b / j : null; }), icon: KIC.tag },
        { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, spk: momReduce("reviews_breakdown", 12, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)), icon: KIC.star }
      ].forEach(k => kpiTile(g, k));
      const gpRev = revLY ? (rev - revLY) / Math.abs(revLY) : 0;
      const tone = gpRev > 0.08 ? "A strong" : gpRev < -0.05 ? "A softer" : "A steady";
      const ex = document.createElement("div"); ex.className = "mrx-exec"; ex.style.gridColumn = "1/-1";
      ex.innerHTML = `<b>${tone} ${MON[mo]} ${curY}.</b> Revenue ${moneyC(rev)} (${gpRev >= 0 ? "+" : ""}${(gpRev * 100).toFixed(0)}% YoY), operational profit ${moneyC(op)} at ${pct(margin)} margin, ${fmtN(jobs)} jobs from ${fmtN(leadsN)} leads booked at ${pct(bk)}. Avg job value ${moneyC(avgJob)}.`;
      g.appendChild(ex);
    }

    /* ---- 02 · Revenue & Growth ---- */
    {
      const g = section("Revenue & Growth", "5-year " + MON[mo] + " trend and 12-month momentum");
      const revT = trendSeries("closing", "Revenue"), opT = trendSeries("closing", "Operational Profit by Formula"), jobT = trendSeries("closing", "Total Jobs");
      yoyBars(g, "Total Revenue", revT, moneyC);
      lines(g, "Revenue & Profit — momentum", "last 12 months", [ { label: "Revenue", series: momSeries("closing", "Revenue", 12), color: INK }, { label: "Op. Profit", series: momSeries("closing", "Operational Profit by Formula", 12), color: BLUE } ], moneyC);
      const confT = trendSeries("moveboard", "Confirmed Leads"), bkT = trendSeries("moveboard", "Booking Rate");
      combo(g, "Confirmed Jobs & Booking Rate", MON[mo] + " · " + confT.length + "-yr", confT, "Confirmed", fmtN, bkT, "Booking %", pct);
      const c1 = yoyBars(g, "Operational Profit", opT, moneyC); note(c1, trendInsight("Operational Profit", opT, moneyC, MON[mo]));
      const c2 = yoyBars(g, "Jobs Done", jobT, fmtN); note(c2, trendInsight("Jobs Done", jobT, fmtN, MON[mo]));
    }

    /* ---- 03 · Profitability & P&L ---- */
    {
      const g = section("Profitability & P&L", "where the revenue goes, and margin trend");
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
      lines(g, "Operational Profit Margin", "last 12 months", [ { label: "Margin", series: momSeries("closing", "Operational Profit Margin", 12), color: VIOLET } ], pct);
      rankBars(g, "Operational Profit by State", segSeries("closing", "Operational Profit by Formula", "State Name"), money, { top: 10, note: segInsight(segSeries("closing", "Operational Profit by Formula", "State Name"), money) });
      const rr = ["Returned Customer", "Recommended"].map(src => {
        const rev2 = segSeries("closing", "Revenue", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const op2 = segSeries("closing", "Operational Profit by Formula", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const j2 = segSeries("closing", "Total Jobs", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        return { src, rev: rev2 ? rev2.v : 0, op: op2 ? op2.v : 0, jobs: j2 ? j2.v : 0 };
      });
      const rrHtml = `<table class="mrx-tbl"><thead><tr><th>Customer type</th><th>Revenue</th><th>Op. Profit</th><th>Jobs</th></tr></thead><tbody>${rr.map(r => `<tr><td>${r.src}</td>${td(money(r.rev))}${td(money(r.op))}${td(fmtN(r.jobs))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Returned & Recommended customers", monLbl, rrHtml, { span2: false });
    }

    /* ---- 04 · Demand & Lead Funnel ---- */
    {
      const g = section("Demand & Lead Funnel", "conversion this month and rep performance");
      funnel(g, "Lead Funnel", monLbl + " · Total → Qualified → Confirmed", [ { k: "Total Leads", v: leadsN || 0 }, { k: "Qualified", v: valueFor("moveboard", "Qualified Leads", curY, mo) || 0 }, { k: "Confirmed", v: valueFor("moveboard", "Confirmed Leads", curY, mo) || 0 } ]);
      const badCur = segReduce("moveboard", "Status", rs => rs.length, curY, mo, { pre: r => r["Status Category"] === "Bad Lead" }).slice(0, 6);
      const badLY = segReduce("moveboard", "Status", rs => rs.length, curY - 1, mo, { pre: r => r["Status Category"] === "Bad Lead" });
      const badMap = {}; badLY.forEach(r => badMap[r.k] = r.v);
      groupedBars(g, "Bad Leads by reason — YoY", badCur.map(r => r.k), badCur.map(r => badMap[r.k] || 0), String(curY - 1), badCur.map(r => r.v), String(curY), fmtN, { sub: MON[mo] });
      const spBook = segReduce("moveboard", "Assigned", rs => { const q = rs.filter(r => r["Status Category"] !== "Bad Lead").length, c = rs.filter(r => r["Status Category"] === "Confirmed").length; return q ? c / q : null; }, curY, mo).filter(r => r.v != null && r.rows.length >= 5).slice(0, 12);
      bullet(g, "Booking rate by salesperson", monLbl + " · vs team average", spBook, pct, bk || 0, { span2: true, note: "Bars below the lime target line are converting under the team average — coaching targets." });
    }

    /* ---- 05 · Composition & Segments ---- */
    {
      const g = section("Revenue Composition & Segments", "how revenue splits this month");
      stackShare(g, "Revenue by Moving Type", monLbl, segSeries("closing", "Revenue", "Moving Type"), money);
      rankBars(g, "Revenue by Source", segSeries("closing", "Revenue", "Source"), money, { top: 10, note: segInsight(segSeries("closing", "Revenue", "Source"), money) });
      donut(g, "Lead Status Mix", segReduce("moveboard", "Status Category", rs => rs.length), fmtN, { center: fmtN(leadsN), centerLbl: "leads" });
    }

    /* ---- 06 · Geography ---- */
    {
      const g = section("Geography — by State", "four metrics per state, heat-scaled");
      const revS = segSeries("closing", "Revenue", "State Name"), opS = segSeries("closing", "Operational Profit by Formula", "State Name"), jobS = segSeries("closing", "Total Jobs", "State Name");
      const opMap = {}, jobMap = {}; opS.forEach(r => opMap[r.k] = r.v); jobS.forEach(r => jobMap[r.k] = r.v);
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
      tableCard(g, "State performance matrix", monLbl, `<table class="mrx-tbl"><thead><tr><th>State</th><th>Revenue</th><th>Op. Profit</th><th>Jobs</th><th>Booking%</th></tr></thead><tbody>${rowsH}</tbody></table>`, { note: "Green intensity = $ / jobs magnitude; Booking% shaded green>team-avg, red<team-avg." });
      rankBars(g, "Revenue by State", revS.map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, v: r.v })), money, { top: 10 });
    }

    /* ---- 07 · Sales Team ---- */
    {
      const g = section("Sales Team Performance", "per-rep scorecard and large-move conversion");
      const revSP = segSeries("closing", "Revenue", "Sales Person"), opSP = segSeries("closing", "Operational Profit by Formula", "Sales Person");
      const opMap = {}; opSP.forEach(r => opMap[r.k] = r.v);
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
      const bigPre = { pre: r => { const cf = String(r["CF Range"] || ""); return /1000|1500|2000|Over|1001|>|\+/.test(cf) && !/0-1000|<1000|Under/.test(cf); } };
      const bigMb = segReduce("moveboard", "Assigned", rs => rs, curY, mo, bigPre).map(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = r.rows.filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, q, c, book: q ? c / q : null }; }).filter(r => r.q >= 2).sort((a, b) => b.q - a.q).slice(0, 10);
      if (bigMb.length) groupedBars(g, "Large moves (>1000 CF) — Qualified vs Confirmed", bigMb.map(r => r.k), bigMb.map(r => r.q), "Qualified", bigMb.map(r => r.c), "Confirmed", fmtN, { span2: true, sub: monLbl });
    }

    /* ---- 08 · Operations & Crew ---- */
    {
      const g = section("Operations & Crew (Foreman)", "productivity, quality score and month-over-month");
      const scRows = (DS.scorecard || []).filter(r => { const d = String(r["Month"] || "").slice(0, 7); return d === `${curY}-${String(mo).padStart(2, "0")}`; });
      if (scRows.length) {
        const sc = scRows.map(r => ({ f: r.Foreman, jobs: num(r["Total Jobs"]), cf: num(r["Total CF"]), p100: num(r["Packing per 100 CF"]), rev: num(r["Total Reviews Written"]), claims: num(r["Forman Fault Claims"]), score: num(r["Forman Score"]), rank: num(r["Forman Score Rank"]), prev: num(r["Forman Score Prev Month"]) }))
          .sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 15);
        const smax = Math.max(...sc.map(r => r.score || 0)) || 1, cmax = Math.max(...sc.map(r => r.claims), 1);
        const rowsH = sc.map((r, i) => { const arrow = r.prev ? (r.score > r.prev ? `<span style="color:${POS}">▲</span>` : r.score < r.prev ? `<span style="color:${NEG}">▼</span>` : "–") : ""; return `<tr><td>${i === 0 ? "👑 " : ""}${esc(r.f)}</td>
          ${td(fmtN(r.jobs))}${td(fmtN(r.cf))}${td(fmt1(r.p100))}${td(fmtN(r.rev))}
          ${td(fmtN(r.claims), `background:${redBg(r.claims / cmax)}`)}
          <td class="bar"><i style="width:${(r.score / smax * 100).toFixed(0)}%;background:#d9ecab"></i><span>${fmt1(r.score)} ${arrow}</span></td></tr>`; }).join("");
        tableCard(g, "Foreman scorecard — ranked", monLbl, `<table class="mrx-tbl"><thead><tr><th>Foreman</th><th>Jobs</th><th>CF</th><th>Pack/100CF</th><th>Reviews</th><th>Claims</th><th>Score</th></tr></thead><tbody>${rowsH}</tbody></table>`, { note: "Composite Forman Score with MoM arrow; claims shaded red. Rank 1 crowned." });
      }
      const jobF = segSeries("closing", "Total Jobs", "Foreman").slice(0, 12);
      const hrMap = {}; segSeries("closing", "Hours Worked by Forman", "Foreman").forEach(r => hrMap[r.k] = r.v);
      combo(g, "Jobs vs Hours by Foreman", monLbl, jobF, "Jobs", fmtN, jobF.map(r => ({ k: r.k, v: hrMap[r.k] || 0 })), "Hours", fmtN, { span2: true });
      const packCur = segSeries("closing", "Total Packing Written", "Foreman").slice(0, 12);
      const packPrev = {}; segSeries("closing", "Total Packing Written", "Foreman", PMY, PM).forEach(r => packPrev[r.k] = r.v);
      groupedBars(g, "Packing written by foreman — MoM", packCur.map(r => r.k), packCur.map(r => packPrev[r.k] || 0), MS[PM], packCur.map(r => r.v), MS[mo], money, { span2: true, sub: `${MS[PM]} vs ${MS[mo]}` });
    }

    /* ---- 09 · Packing & Storage ---- */
    {
      const g = section("Packing & Storage", "packing economics and storage income trend");
      const packT = trendSeries("closing", "Total Packing Written");
      const packSalT = trendSeries("closing", "Forman Salary - Packing");
      combo(g, "Packing written vs foreman packing pay", MON[mo] + " · " + packT.length + "-yr", packT, "Written", moneyC, packT.map((r, i) => ({ k: r.k, v: (packSalT[i] && packSalT[i].v) ? r.v / packSalT[i].v : null })), "Rev / $1 pay", v => "$" + fmt1(v));
      const stoT = momSeries("storage", "Storage Additional Revenue", 14);
      lines(g, "Storage additional revenue", "last 14 months", [ { label: "Storage Add'l Rev", series: stoT, color: TEAL } ], money);
      const stoRows = stoT.map(r => ({ k: MS[r.m] + " " + r.y, add: r.v, bill: valueFor("closing", "Revenue", r.y, r.m), jobs: valueFor("closing", "Total Jobs", r.y, r.m) }));
      const html = `<table class="mrx-tbl"><thead><tr><th>Month</th><th>Total Bill</th><th>Jobs</th><th>Storage Add'l Rev</th></tr></thead><tbody>${stoRows.map(r => `<tr><td>${r.k}</td>${td(r.bill == null ? "—" : money(r.bill))}${td(r.jobs == null ? "—" : fmtN(r.jobs))}${td(r.add == null ? "—" : money(r.add))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Storage income — last 14 months", "", html, { span2: false });
    }

    /* ---- 10 · Quality & Customer Experience ---- */
    {
      const g = section("Quality & Customer Experience", "reviews, negative reviews and claims");
      const claimsN = reduceMonth("claims", curY, mo, rs => rs.length) || 0;
      const claimsPM = reduceMonth("claims", PMY, PM, rs => rs.length) || 0;
      const negN = reduceMonth("negative_reviews", curY, mo, rs => rs.length) || 0;
      const negPM = reduceMonth("negative_reviews", PMY, PM, rs => rs.length) || 0;
      const claimRate = jobs ? claimsN / jobs * 100 : null;
      [ { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, pm: revWrittenPM, icon: KIC.star },
        { l: "Negative Reviews", v: fmtN(negN), c: negN, pm: negPM, icon: KIC.warn, inv: 1 },
        { l: "Claims Filed", v: fmtN(claimsN), c: claimsN, pm: claimsPM, icon: KIC.warn, inv: 1 },
        { l: "Claims / 100 jobs", v: claimRate == null ? "—" : fmt1(claimRate), c: claimRate, pm: (jobsPM ? claimsPM / jobsPM * 100 : null), icon: KIC.pct, inv: 1 }
      ].forEach(k => kpiTile(g, k));
      rankBars(g, "Claims by responsibility", segReduce("claims", "Responsibility", rs => rs.length, curY, mo), fmtN, { top: 8 });
      donut(g, "Claims by reason", segReduce("claims", "Reason", rs => rs.length, curY, mo).filter(r => r.k !== "—" && r.k !== "(blank)"), fmtN, { center: fmtN(reduceMonth("claims", curY, mo, rs => rs.filter(r => r.Reason && r.Reason !== "(blank)").length) || 0), centerLbl: "classified" });
      const refByReason = segReduce("refunds", "Reason", rs => Math.abs(rs.reduce((a, r) => a + num(r["Total refund"]), 0)), curY, mo).filter(r => r.v > 0);
      const refTot = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      rankBars(g, "Refunds by reason", refByReason, money, { top: 8, sub: `${money(refTot)} · ${rev ? pct(refTot / rev) : "—"} of revenue`, note: `${money(refTot)} refunded in ${MON[mo]} — ${rev ? pct(refTot / rev) : "—"} of revenue.` });
    }

    /* ---- 11 · Marketing & Channels ---- */
    {
      const g = section("Marketing & Channels", "ad spend momentum, source revenue and call demand");
      const adTrend = momReduce("card_expenses", 12, rs => { const ad = rs.filter(r => Number(r["Is Advertising"]) === 1); return ad.length ? ad.reduce((a, r) => a + num(r.Amount), 0) : null; });
      lines(g, "Advertising spend — momentum", "last 12 months", [ { label: "Ad Spend", series: adTrend, color: AMBER } ], moneyC);
      rankBars(g, "Revenue by Source", segSeries("closing", "Revenue", "Source"), money, { top: 10 });
      const callLabels = momReduce("callrail", 12, rs => rs.length).map(r => r.k);
      const answered = momReduce("callrail", 12, rs => rs.filter(r => String(r["Call Status"]) === "Answered Call").length).map(r => r.v);
      const missed = momReduce("callrail", 12, rs => rs.filter(r => /Missed|Abandoned/.test(String(r["Call Status"]))).length).map(r => r.v);
      stackedTime(g, "Inbound calls — answered vs missed", "last 12 months (CallRail)", callLabels, [ { label: "Answered", data: answered, color: INK }, { label: "Missed/Abandoned", data: missed, color: NEG } ], fmtN);
      const callsBySrc = segReduce("callrail", "Source", rs => rs.length, curY, mo).slice(0, 10);
      const ftc = reduceMonth("callrail", curY, mo, rs => { const t = rs.length, f = rs.filter(r => Number(r["First-Time Caller"]) === 1).length; return t ? f / t : null; });
      rankBars(g, "Calls by source", callsBySrc, fmtN, { top: 10, sub: monLbl, note: ftc == null ? "" : `${pct(ftc)} of calls this month were first-time callers.` });
    }

    /* ---- 12 · Lead Segmentation ---- */
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
