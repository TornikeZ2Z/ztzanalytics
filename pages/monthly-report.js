/* Monthly Report — "Monthly Business Review" (v10, futuristic-infographic). [rebuild-nudge]
   SOLID flat fills (no gradients), monospaced numerals, section number-badges + icons +
   "loaded-bar" rules. v10 adds: funnel-flow section order (lead→cash→after-sale); headline
   stat + delta + icon on EVERY chart card ("max infographic"); a data-completeness banner
   (closings awaiting return); a sticky table-of-contents; collapsible sections; symmetric
   2-up / 4-up grids; rich hover (crosshair + tooltip). Data/measure logic unchanged. */
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
    const blank = v => v == null || String(v).trim() === "";

    /* ---------- data ---------- */
    const grab = ds => RS.load(ds).catch(() => []);
    const [closing, moveboard, storage, claims, refunds, cardEx] = await Promise.all(
      ["closing", "moveboard", "storage", "claims", "refunds", "card_expenses"].map(grab));
    const [reviews, negrev, callrail, scorecard, rcounts, rgoals] = await Promise.all(
      ["reviews_breakdown", "negative_reviews", "callrail", "scorecard", "review_counts", "review_goals"].map(grab));
    const [helperSalDs, salesSalDs] = await Promise.all(["helper_salaries", "sales_salaries"].map(grab));
    // Raw `trips` table (207 rows) — loaded directly (not in DATASETS); powers the gross-trip memo
    // only. Exclude the Liga file, which curated's fct_closing also drops. Dated by End Date.
    const tripsRaw = await ZTZ.api("/api/trips?limit=1000000")
      .then(j => (j.rows || []).filter(r => !String(r["File Name"] || "").startsWith("Liga")))
      .catch(() => []);
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: cardEx, reviews_breakdown: reviews, negative_reviews: negrev, callrail, scorecard, review_counts: rcounts, review_goals: rgoals, helper_salaries: helperSalDs, sales_salaries: salesSalDs };

    const latest = closing.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
    if (!st.month) {
      const now = new Date(); let dy, dm;
      if (latest) { dy = +latest.slice(0, 4); dm = +latest.slice(5, 7); } else { dy = now.getFullYear(); dm = now.getMonth() + 1; }
      if (dy === now.getFullYear() && dm === now.getMonth() + 1) { dm--; if (dm < 1) { dm = 12; dy--; } }
      st.month = dm; st.year = dy;
    }
    const curY = st.year, mo = st.month, monLbl = MON[mo] + " " + curY;
    const freshness = latest ? `data through ${latest}` : "";

    /* ---------- month engine ---------- */
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
    function segReduce(ds, col, reducer, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return [];
      return withMonth(y || curY, m || mo, () => {
        let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre);
        const g = {}; f.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); });
        return Object.entries(g).map(([k, rs]) => ({ k, v: reducer(rs), rows: rs })).filter(x => x.v != null).sort((a, b) => (b.v || 0) - (a.v || 0));
      });
    }

    /* ---------- palette ---------- */
    const INK = "#0e1621", INK2 = "#1b2a3f", SUB = "#5a6775", FAINT = "#93a0b2", LINE = "#e4e9f0";
    const LIME = "#b7e23b", LIMED = "#7ba317";
    const BLUE = "#3b82f6", AMBER = "#f5a524", VIOLET = "#8b5cf6", TEAL = "#14b8a6", CORAL = "#ec6a5e", PINK = "#ec4899", SKY = "#38bdf8";
    const POS = "#2fa36b", NEG = "#e5484d";
    const CTX = "#c6d0db";
    const CAT = [INK, BLUE, AMBER, VIOLET, TEAL, CORAL, PINK, SKY];
    const AXIS = "#7b869a", GRID = "#eef1f6";
    const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace";
    const HEAT = ["#eef2ee", "#dce7c4", "#c3dc8e", "#a6d22a", "#7ba317"];
    const seqBg = (v, min, max) => { if (v == null || max <= min) return "transparent"; const t = Math.max(0, Math.min(1, (v - min) / (max - min))); return HEAT[Math.max(0, Math.min(HEAT.length - 1, Math.floor(t * HEAT.length - 1e-9)))]; };
    const seqInk = (v, min, max) => { const t = max <= min ? 0 : (v - min) / (max - min); return t > 0.82 ? "#fff" : INK; };
    const divBg = t => { if (t == null) return "transparent"; const c = Math.max(-1, Math.min(1, t)); if (Math.abs(c) < 0.12) return "transparent"; return c >= 0 ? (c > .55 ? "#bfe3ca" : "#e0f0e6") : (c < -.55 ? "#f2b8bc" : "#f9dde0"); };
    const redBg = t => { t = Math.max(0, Math.min(1, t || 0)); return t < 0.02 ? "transparent" : t > .66 ? "#efa3a3" : t > .33 ? "#f5cccc" : "#fbe6e7"; };

    /* ---------- icons ---------- */
    const ICONS = {
      "Executive Summary": '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="8" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>',
      "Demand & Lead Funnel": '<svg viewBox="0 0 24 24"><path d="M3 4h18l-7 8v7l-4-2v-5z"/></svg>',
      "Sales Team Performance": '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20c0-3.3 2.5-5 5.5-5s5.5 1.7 5.5 5"/><path d="M16 5a3 3 0 010 6"/><path d="M20.5 20c0-2.4-1.3-3.9-3.5-4.6"/></svg>',
      "Operations & Crew (Foreman)": '<svg viewBox="0 0 24 24"><rect x="1.5" y="6" width="12" height="9" rx="1"/><path d="M13.5 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
      "Packing & Storage": '<svg viewBox="0 0 24 24"><path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4"/><path d="M12 11v10"/></svg>',
      "Revenue & Growth": '<svg viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/></svg>',
      "Revenue Composition & Segments": '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>',
      "Profitability & P&L": '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="5"/><path d="M14 6.5a5 5 0 010 11"/></svg>',
      "Marketing & Channels": '<svg viewBox="0 0 24 24"><path d="M3 10v4l12 5V5z"/><path d="M15 8.5a4 4 0 010 7"/></svg>',
      "Quality & Customer Experience": '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 17l-5.2 2.5 1-5.7L3.5 9.7l5.9-.9z"/></svg>',
      "Geography — by State": '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
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
      warn: '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
      bars: '<svg viewBox="0 0 24 24"><rect x="3" y="12" width="4" height="8" rx="1"/><rect x="10" y="7" width="4" height="13" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/></svg>',
      pie: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/></svg>',
      grid: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>'
    };

    /* ---------- design system ---------- */
    if (!document.getElementById("mrx-css")) {
      const s = document.createElement("style"); s.id = "mrx-css";
      s.textContent = `
      .mrx{background:#f4f6fa;color:${INK};border-radius:16px;padding:24px 24px 46px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
      .mrx *{box-sizing:border-box}
      .mrx-cover{position:relative;background:${INK};color:#fff;border-radius:16px;padding:24px 26px;margin-bottom:16px;overflow:hidden}
      .mrx-cover .mrx-accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:${LIME}}
      .mrx-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${LIME}}
      .mrx-h1{font-size:33px;font-weight:800;letter-spacing:-.9px;margin:6px 0 4px;color:#fff}
      .mrx-cvsub{color:#a9b6c6;font-size:12.5px;font-weight:600}
      .mrx-print{position:absolute;top:22px;right:24px;background:${LIME};color:${INK};border:0;border-radius:9px;padding:9px 15px;font-size:12.5px;font-weight:800;cursor:pointer;z-index:2}
      .mrx-ctl{font:inherit;font-weight:700;color:#fff;background:${INK2};border:1px solid #2c3e57;border-radius:7px;padding:3px 8px;margin-left:4px}
      .mrx-bwrap{margin-bottom:16px}
      .mrx-banner{display:flex;align-items:center;gap:11px;background:#fff8ec;border:1px solid #f2d492;border-left:4px solid ${AMBER};border-radius:11px;padding:11px 15px;font-size:13px;color:#7a5a12;font-weight:600}
      .mrx-banner b{font-family:${MONO};color:${INK};font-weight:800}
      .mrx-banner .bic{display:flex;flex:0 0 auto}.mrx-banner .bic svg{width:19px;height:19px;fill:none;stroke:${AMBER};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-bmsg{flex:1}
      .mrx-btoggle{flex:0 0 auto;font-family:${MONO};font-size:11.5px;font-weight:800;color:${INK};cursor:pointer;white-space:nowrap;border-bottom:1.5px solid ${AMBER};user-select:none}
      .mrx-bdetail{margin-top:7px;background:#fff;border:1px solid #f2d492;border-radius:9px;padding:9px 13px;max-height:300px;overflow:auto}
      .mrx-toc{position:sticky;top:0;z-index:6;background:#f4f6fa;display:flex;flex-wrap:wrap;gap:7px;padding:11px 2px;margin-bottom:6px;border-bottom:1px solid ${LINE}}
      .mrx-tocchip{font-family:${MONO};font-size:11px;font-weight:700;color:${INK2};background:#fff;border:1px solid ${LINE};border-radius:7px;padding:4px 9px;cursor:pointer;white-space:nowrap;user-select:none}
      .mrx-tocchip:hover{border-color:${INK};background:#eef1f6}
      .mrx-sec{margin:26px 0 4px}
      .mrx-sec-h{display:flex;align-items:center;gap:12px;cursor:pointer;user-select:none}
      .mrx-badge{width:34px;height:34px;flex:0 0 34px;border-radius:9px;background:${INK};color:#fff;font-weight:800;font-size:15px;display:grid;place-items:center;font-family:${MONO}}
      .mrx-badge.mrx-hero{background:${LIME};color:${INK}}
      .mrx-sec-ic svg{width:20px;height:20px;fill:none;stroke:${INK};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-sec-ic{display:flex}
      .mrx-sec-tt{display:flex;flex-direction:column;line-height:1.14}
      .mrx-sec-t{font-size:19px;font-weight:800;color:${INK};letter-spacing:-.4px}
      .mrx-sec-s{font-size:11.5px;font-weight:600;color:${SUB}}
      .mrx-code{margin-left:auto;font-family:${MONO};font-size:10.5px;font-weight:700;color:${FAINT};letter-spacing:.08em}
      .mrx-caret{flex:0 0 auto;color:${FAINT};transition:transform .15s;font-size:11px;margin-left:10px}
      .mrx-sec.collapsed .mrx-caret{transform:rotate(-90deg)}
      .mrx-sec.collapsed .mrx-grid{display:none}
      .mrx-sec.collapsed .mrx-rule{opacity:.45}
      .mrx-rule{position:relative;height:2px;background:${INK};margin:11px 0 2px}
      .mrx-rule i{position:absolute;left:0;top:0;height:2px;width:46px;background:${LIME}}
      .mrx-grid{display:grid;gap:15px;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:14px}
      .mrx-grid.k{grid-template-columns:repeat(4,minmax(0,1fr))}
      @media(max-width:900px){.mrx-grid{grid-template-columns:1fr}.mrx-grid.k{grid-template-columns:repeat(2,minmax(0,1fr))}}
      .mrx-card{position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:15px 16px;box-shadow:0 1px 2px rgba(14,22,33,.05)}
      .mrx-card:before{content:"";position:absolute;left:16px;top:0;width:34px;height:3px;background:${LIME};border-radius:0 0 3px 3px}
      .mrx-card.span2{grid-column:1/-1}
      .mrx-chead{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px;border-bottom:1px solid #eef1f5;padding-bottom:9px}
      .mrx-chleft{display:flex;gap:8px;align-items:flex-start;min-width:0}
      .mrx-chico{display:flex;flex:0 0 auto;margin-top:1px}.mrx-chico svg{width:16px;height:16px;fill:none;stroke:${INK};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-cttl{min-width:0}
      .mrx-ct{font-size:13px;font-weight:750;color:${INK};line-height:1.25}
      .mrx-cs{font-size:9.5px;font-weight:700;color:${FAINT};text-transform:uppercase;letter-spacing:.04em;font-family:${MONO}}
      .mrx-chd{text-align:right;flex:0 0 auto;white-space:nowrap}
      .mrx-chval{font-family:${MONO};font-size:18px;font-weight:800;color:${INK};letter-spacing:-.4px;line-height:1.05}
      .mrx-chd .mrx-chips{justify-content:flex-end;margin-top:3px}
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
        html,body{height:auto!important;overflow:visible!important}
        body.rs-app,.rs-layout,.rs-main,.rs-content,#content,#app{height:auto!important;max-height:none!important;min-height:0!important;overflow:visible!important;display:block!important}
        .rs-content{padding:0!important}
        .top,.rs-side,.rs-filters,.rs-chips,.rs-topbar,header{display:none!important}
        .mrx{background:#fff;padding:0}
        .mrx-print,#mrMonth,#mrYear,.mrx-ctl,.mrx-toc,.mrx-caret{display:none!important}
        .mrx-sec.collapsed .mrx-grid{display:grid!important}
        .mrx-sec-h{break-after:avoid}
        .mrx-sec{break-inside:auto;margin-top:14px}
        .mrx-card,.mrx-kpi,.mrx-tbl tr{break-inside:avoid}
        .mrx-cover,.mrx-banner{break-inside:avoid}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
      }`;
      document.head.appendChild(s);
    }
    // global tooltip + hover (rich, index-mode) — once
    if (window.Chart && !Chart.__mrx) {
      Chart.__mrx = 1; const T = Chart.defaults.plugins.tooltip;
      T.backgroundColor = INK; T.titleColor = "#fff"; T.bodyColor = "#e8edf3"; T.borderColor = "#2c3e57"; T.borderWidth = 1;
      T.cornerRadius = 7; T.padding = 9; T.titleFont = { family: "Inter", weight: "700", size: 12 }; T.bodyFont = { family: MONO, size: 12 };
      T.displayColors = true; T.boxWidth = 9; T.boxHeight = 9; T.usePointStyle = true;
      Chart.defaults.interaction = { mode: "index", intersect: false };
      Chart.defaults.hover = { mode: "index", intersect: false };
    }
    // resize all charts to the print column before printing so nothing is cut/stretched in the PDF
    if (!window.__mrxPrint) { window.__mrxPrint = 1; window.addEventListener("beforeprint", () => { try { if (window.Chart) Object.values(Chart.instances || {}).forEach(ch => { try { ch.resize(); } catch (e) {} }); } catch (e) {} }); }

    /* ---------- chart primitives ---------- */
    const baseOpts = extra => Object.assign({ __solidBars: true, maintainAspectRatio: false, animation: false,
      // hover axis MUST match orientation: horizontal (indexAxis 'y') charts index by Y, vertical by X.
      // Without this the global {mode:'index'} default maps by the wrong axis → tooltip shows another bar.
      interaction: { mode: "index", axis: (extra && extra.indexAxis === "y") ? "y" : "x", intersect: false },
      plugins: { legend: { display: false } } }, extra || {});
    const axX = (o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 10.5 } }, grid: { display: false }, border: { color: LINE } }, o || {});
    const axY = (fmt, o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 10 }, maxTicksLimit: 6, callback: v => fmt ? fmt(v) : v }, grid: { color: GRID }, border: { display: false } }, o || {});
    const valLabels = (fmt, horiz, color) => ({ id: "vlab", afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = "700 10px " + MONO; ctx.fillStyle = color || INK;
      ch.data.datasets.forEach((d, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden) return; meta.data.forEach((el, i) => {
        const raw = d.data[i]; const v = Array.isArray(raw) ? raw[1] - raw[0] : raw; if (v == null || isNaN(v)) return;
        if (horiz) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v), el.x + 5, el.y); }
        else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(fmt(v), el.x, el.y - 4); }
      }); }); ctx.restore();
    } });
    // hover crosshair — adaptive: vertical line for column charts, horizontal line for bar (y-indexed) charts
    const crosshair = { id: "crossh", afterDraw(ch) { const t = ch.tooltip; if (t && t._active && t._active.length) { const el = t._active[0].element, ca = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "#9fabbb"; ctx.lineWidth = 1.3; ctx.setLineDash([3, 3]); ctx.beginPath(); if (ch.options.indexAxis === "y") { ctx.moveTo(ca.left, el.y); ctx.lineTo(ca.right, el.y); } else { ctx.moveTo(el.x, ca.top); ctx.lineTo(el.x, ca.bottom); } ctx.stroke(); ctx.setLineDash([]); ctx.restore(); } } };

    /* ---------- card + section scaffolding ---------- */
    function card(mount, title, sub, opts) {
      opts = opts || {}; const c = document.createElement("div"); c.className = "mrx-card" + (opts.span2 ? " span2" : "");
      const hv = opts.headVal != null ? `<div class="mrx-chd"><div class="mrx-chval">${opts.headVal}</div>${opts.chips ? `<div class="mrx-chips">${opts.chips}</div>` : ""}</div>` : "";
      c.innerHTML = `<div class="mrx-chead"><div class="mrx-chleft">${opts.icon ? `<span class="mrx-chico">${opts.icon}</span>` : ""}<div class="mrx-cttl"><div class="mrx-ct">${esc(title)}</div>${sub ? `<div class="mrx-cs">${esc(sub)}</div>` : ""}</div></div>${hv}</div>`;
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
    const TOCNAME = { "Executive Summary": "Summary", "Demand & Lead Funnel": "Demand", "Sales Team Performance": "Sales", "Operations & Crew (Foreman)": "Crew", "Packing & Storage": "Packing", "Revenue & Growth": "Revenue", "Revenue Composition & Segments": "Mix", "Profitability & P&L": "P&L", "Marketing & Channels": "Marketing", "Quality & Customer Experience": "Quality", "Geography — by State": "Geography", "Lead Segmentation": "Segments" };
    let bodyEl, secN = 0; const secList = [];
    function section(title, sub, klass) {
      secN++; const n = String(secN).padStart(2, "0");
      const wrap = document.createElement("section"); wrap.className = "mrx-sec";
      wrap.innerHTML = `<div class="mrx-sec-h">
        <span class="mrx-badge${secN === 1 ? " mrx-hero" : ""}">${n}</span>
        <span class="mrx-sec-ic">${ICONS[title] || ICONS._def}</span>
        <span class="mrx-sec-tt"><span class="mrx-sec-t">${esc(title)}</span><span class="mrx-sec-s">${esc(sub || "")}</span></span>
        <span class="mrx-code">SEC ${n}</span><span class="mrx-caret">▼</span>
      </div><div class="mrx-rule"><i></i></div>`;
      const grid = document.createElement("div"); grid.className = "mrx-grid" + (klass ? " " + klass : ""); wrap.appendChild(grid);
      wrap.querySelector(".mrx-sec-h").addEventListener("click", () => wrap.classList.toggle("collapsed"));
      bodyEl.appendChild(wrap); secList.push({ n, title, wrap }); return grid;
    }

    /* ---------- delta chip + KPI tile ---------- */
    function chip(cur, prev, label, inv) {
      if (cur == null || prev == null || !prev) return `<span class="mrx-chip" style="background:#eef1f5;color:${SUB}">${label} —</span>`;
      const g = (cur - prev) / Math.abs(prev); const up = g >= 0; const good = inv ? !up : up;
      const col = good ? "#1c7a4a" : "#b02a37"; const bg = good ? "#e4f3ea" : "#fbe6e7";
      return `<span class="mrx-chip" style="background:${bg};color:${col}">${label} ${up ? "▲" : "▼"} ${Math.abs(g * 100).toFixed(0)}%</span>`;
    }
    const dchips = arr => arr.map(d => chip(d[0], d[1], d[2], d[3])).join("");
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
    function sparkBars(el, series) {
      const s = series.filter(r => r.v != null); if (!s.length) return;
      const cv = document.createElement("canvas"); el.appendChild(cv);
      new Chart(cv, { type: "bar", data: { labels: s.map((_, i) => i), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === s.length - 1 ? LIME : CTX), borderRadius: 2, maxBarThickness: 7, categoryPercentage: .92, barPercentage: .82 }] },
        options: baseOpts({ plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false }, y: { display: false, beginAtZero: true } } }) });
    }

    /* ---------- chart builders (headline stat + icon + solid) ---------- */
    function lastV(series) { const s = series.filter(r => r.v != null); return s.length ? s[s.length - 1].v : null; }
    const tip = f => (f === moneyC ? money : f);  // tooltips ALWAYS show full money (never the compact M/k form)
    function yoyBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.filter(r => r.v != null);
      opts.icon = opts.icon || KIC.trend;
      if (opts.headVal == null && s.length) opts.headVal = fmt(s[s.length - 1].v);
      if (opts.chips == null && s.length >= 2) opts.chips = dchips([[s[s.length - 1].v, s[s.length - 2].v, "YoY"]]);
      const { c, box, cv } = chartCard(mount, title, opts.sub || (MS[mo] + " · " + s.length + "-yr"), opts);
      if (!s.length) { emptyBox(box); return c; }
      const avg = s.reduce((a, b) => a + b.v, 0) / s.length;
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === s.length - 1 ? LIME : INK), borderRadius: 5, maxBarThickness: 52, categoryPercentage: .7, barPercentage: .82 }] },
        options: baseOpts({ layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => tip(fmt)(x.parsed.y) } } }, scales: { x: axX(), y: axY(fmt, { beginAtZero: true }) } }),
        plugins: [valLabels(fmt, false), crosshair, { id: "avg", afterDraw(ch) { const y = ch.scales.y.getPixelForValue(avg), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "#b7c0cd"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = SUB; ctx.font = "700 9px " + MONO; ctx.textAlign = "left"; ctx.fillText("avg " + fmt(avg), a.left + 3, y - 3); ctx.restore(); } }] });
      return c;
    }
    function lines(mount, title, sub, sets, fmt, opts) {
      opts = opts || {}; opts.icon = opts.icon || KIC.trend;
      if (opts.headVal == null) { const lv = lastV(sets[0].series); if (lv != null) opts.headVal = fmt(lv); }
      const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = sets[0].series.map(r => r.k);
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "line",
        data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.series.map(r => r.v), borderColor: d.color || CAT[i], backgroundColor: d.color || CAT[i], fill: false, tension: 0, borderWidth: 2.6, pointRadius: labels.map((_, j) => j === labels.length - 1 ? 4 : 0), pointBackgroundColor: d.color || CAT[i], pointBorderColor: "#fff", pointBorderWidth: 1.5, spanGaps: true, yAxisID: d.axis || "y" })) },
        options: baseOpts({ plugins: { legend: { display: sets.length > 1, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, boxHeight: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(x.dataset.yAxisID === "y1" ? (opts.fmt1 || fmt) : fmt)(x.parsed.y) } } },
          scales: opts.dual ? { x: axX(), y: axY(fmt), y1: axY(opts.fmt1 || fmt, { position: "right", grid: { display: false } }) } : { x: axX(), y: axY(fmt) } }), plugins: [crosshair] });
      return c;
    }
    function combo(mount, title, sub, barSeries, barLabel, barFmt, lineSeries, lineLabel, lineFmt, opts) {
      opts = opts || {}; opts.icon = opts.icon || KIC.trend;
      if (opts.headVal == null) { const lv = lastV(barSeries); if (lv != null) opts.headVal = barFmt(lv); }
      const { c, box, cv } = chartCard(mount, title, sub, opts);
      const labels = barSeries.map(r => r.k); if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { data: { labels, datasets: [
        { type: "bar", label: barLabel, data: barSeries.map(r => r.v), backgroundColor: labels.map((_, i) => i === labels.length - 1 ? LIME : INK), borderRadius: 4, maxBarThickness: 44, yAxisID: "y", order: 2 },
        { type: "line", label: lineLabel, data: lineSeries.map(r => r.v), borderColor: BLUE, backgroundColor: BLUE, tension: 0, borderWidth: 2.6, pointRadius: 3, pointBorderColor: "#fff", pointBorderWidth: 1.2, yAxisID: "y1", order: 1 }] },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.yAxisID === "y1" ? `${lineLabel}: ${tip(lineFmt)(x.parsed.y)}` : `${barLabel}: ${tip(barFmt)(x.parsed.y)}` } } },
          scales: { x: axX(), y: axY(barFmt, { beginAtZero: true, title: { display: true, text: barLabel, color: SUB, font: { size: 10, weight: "700" } } }), y1: axY(lineFmt, { position: "right", grid: { display: false }, title: { display: true, text: lineLabel, color: BLUE, font: { size: 10, weight: "700" } } }) } }), plugins: [crosshair] });
      return c;
    }
    function rankBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.slice(0, opts.top || 12);
      opts.icon = opts.icon || KIC.bars;
      if (opts.headVal == null) { const tot = series.reduce((a, b) => a + (b.v || 0), 0); opts.headVal = fmt(tot); if (opts.subCode == null) opts.subCode = 1; }
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { span2: opts.span2, h: Math.max(190, 40 + s.length * 27), icon: opts.icon, headVal: opts.headVal, chips: opts.chips });
      if (!s.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === 0 ? LIME : INK), hoverBackgroundColor: s.map((_, i) => i === 0 ? LIMED : "#34465f"), borderRadius: 4, maxBarThickness: 20 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 58 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => tip(fmt)(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [valLabels(fmt, true), crosshair] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    function groupedBars(mount, title, labels, sa, la, sb, lb, fmt, opts) {
      opts = opts || {}; opts.icon = opts.icon || KIC.bars;
      if (opts.headVal == null) { const t = sb.reduce((a, b) => a + (b || 0), 0); opts.headVal = fmt(t); }
      const { c, box, cv } = chartCard(mount, title, opts.sub || "", { span2: opts.span2, h: Math.max(200, 44 + labels.length * 30), icon: opts.icon, headVal: opts.headVal, chips: opts.chips });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels, datasets: [ { label: la, data: sa, backgroundColor: CTX, hoverBackgroundColor: "#aab6c4", borderRadius: 3, maxBarThickness: 12 }, { label: lb, data: sb, backgroundColor: INK, hoverBackgroundColor: "#34465f", borderRadius: 3, maxBarThickness: 12 } ] },
        options: baseOpts({ indexAxis: "y", plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(fmt)(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }), plugins: [crosshair] });
      return c;
    }
    function donut(mount, title, series, fmt, opts) {
      opts = opts || {}; const pos = series.filter(r => r.v > 0), head = pos.slice(0, 7), tail = pos.slice(7);
      const s = tail.length ? head.concat([{ k: "Other", v: tail.reduce((a, b) => a + b.v, 0) }]) : head;
      const tot = s.reduce((a, b) => a + b.v, 0);
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { h: 250, span2: opts.span2, icon: KIC.pie, headVal: opts.center || fmt(tot) });
      if (!s.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "doughnut", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((r, i) => r.k === "Other" ? "#aeb9c8" : CAT[i % CAT.length]), borderColor: "#fff", borderWidth: 3, hoverOffset: 5 }] },
        options: baseOpts({ cutout: "66%", interaction: { mode: "nearest", intersect: true }, plugins: { legend: { position: "right", labels: { color: INK2, font: { size: 11 }, boxWidth: 11, padding: 7, usePointStyle: true } }, tooltip: { callbacks: { label: x => `${x.label}: ${tip(fmt)(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)` } } } }),
        plugins: [{ id: "ctr", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = INK; ctx.font = "800 19px " + MONO; ctx.fillText(opts.center || fmt(tot), x, y - 2); ctx.fillStyle = FAINT; ctx.font = "700 10px Inter"; ctx.fillText(opts.centerLbl || "total", x, y + 15); ctx.restore(); } }] });
      return c;
    }
    function waterfall(mount, title, sub, steps, opts) {
      opts = opts || {};
      const { c, box, cv } = chartCard(mount, title, sub, { span2: true, h: 300, icon: KIC.trend, headVal: opts.headVal, chips: opts.chips });
      if (!steps.length) { emptyBox(box); return c; }
      let run = 0; const bars = [], colors = [], labels = [];
      steps.forEach(st2 => {
        labels.push(st2.label);
        if (st2.type === "total") { bars.push([0, st2.v]); colors.push(INK); run = st2.v; }
        else { const from = run, to = run + st2.v; bars.push([from, to]); colors.push(st2.v >= 0 ? POS : NEG); run = to; }
      });
      new Chart(cv, { type: "bar", data: { labels, datasets: [{ data: bars, backgroundColor: colors, borderRadius: 3, maxBarThickness: 84, categoryPercentage: 0.9, barPercentage: 0.98 }] },
        options: baseOpts({ layout: { padding: { top: 20 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => { const d = x.raw; return money(Array.isArray(d) ? d[1] - d[0] : d); } } } }, scales: { x: axX({ ticks: { color: AXIS, font: { family: MONO, size: 10 }, maxRotation: 40, minRotation: 0 } }), y: axY(moneyC, { beginAtZero: true }) } }),
        plugins: [crosshair,
          { id: "wconn", beforeDatasetsDraw(ch) { const ctx = ch.ctx, meta = ch.getDatasetMeta(0); if (!meta.data.length) return; ctx.save(); ctx.strokeStyle = "#c8cfda"; ctx.setLineDash([3, 3]); for (let i = 0; i < meta.data.length - 1; i++) { const y = ch.scales.y.getPixelForValue(bars[i][1]); ctx.beginPath(); ctx.moveTo(meta.data[i].x, y); ctx.lineTo(meta.data[i + 1].x, y); ctx.stroke(); } ctx.setLineDash([]); ctx.restore(); } },
          { id: "wlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 8.5px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ch.getDatasetMeta(0).data.forEach((el, i) => { const d = bars[i]; const v = d[1] - d[0]; ctx.fillStyle = steps[i].type === "total" ? INK : (v >= 0 ? POS : NEG); ctx.fillText((v < 0 ? "-" : "") + money(Math.abs(v)), el.x, Math.min(el.y, ch.scales.y.getPixelForValue(Math.max(d[0], d[1]))) - 3); }); ctx.restore(); } }] });
      return c;
    }
    function funnel(mount, title, sub, stages, opts) {
      opts = opts || {};
      const { c, box, cv } = chartCard(mount, title, sub, { h: 210, span2: opts.span2, icon: KIC.funnel, headVal: opts.headVal, chips: opts.chips });
      if (!stages.length || !stages[0].v) { emptyBox(box); return c; }
      const top = stages[0].v;
      new Chart(cv, { type: "bar", data: { labels: stages.map(s2 => s2.k), datasets: [{ data: stages.map(s2 => s2.v), backgroundColor: stages.map((_, i) => i === stages.length - 1 ? LIME : INK), hoverBackgroundColor: stages.map((_, i) => i === stages.length - 1 ? LIMED : "#34465f"), borderRadius: 4, maxBarThickness: 36 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 110 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmtN(x.parsed.x) + ` (${(x.parsed.x / top * 100).toFixed(0)}% of top)` } } }, scales: { x: { display: false, beginAtZero: true, max: top * 1.02 }, y: { ticks: { color: INK2, font: { size: 12, weight: "700" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [crosshair, { id: "flab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ch.getDatasetMeta(0).data.forEach((el, i) => { ctx.font = "800 12px " + MONO; ctx.fillStyle = INK; ctx.fillText(fmtN(stages[i].v), el.x + 6, el.y); if (i > 0) { ctx.font = "700 10px " + MONO; ctx.fillStyle = LIMED; ctx.fillText("  " + (stages[i].v / stages[i - 1].v * 100).toFixed(0) + "%", el.x + 6 + ctx.measureText(fmtN(stages[i].v)).width + 4, el.y); } }); ctx.restore(); } }] });
      return c;
    }
    function bullet(mount, title, sub, rows, fmt, target, opts) {
      opts = opts || {};
      const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, h: Math.max(190, 40 + rows.length * 27), icon: KIC.bars, headVal: "target " + fmt(target) });
      if (!rows.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels: rows.map(r => r.k), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => r.v >= target ? INK : NEG), hoverBackgroundColor: rows.map(r => r.v >= target ? "#34465f" : "#f0817e"), borderRadius: 4, maxBarThickness: 18 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 52 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => tip(fmt)(x.parsed.x) + " (target " + tip(fmt)(target) + ")" } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 11, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [crosshair, valLabels(fmt, true), { id: "tgt", afterDraw(ch) { const x = ch.scales.x.getPixelForValue(target), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = LIME; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.fillStyle = LIMED; ctx.font = "800 9px " + MONO; ctx.textAlign = "center"; ctx.fillText("target " + fmt(target), x, a.top - 2); ctx.restore(); } }] });
      if (opts.note) note(c, opts.note);
      return c;
    }
    function stackedTime(mount, title, sub, labels, sets, fmt, opts) {
      opts = opts || {};
      const lastTot = sets.reduce((a, d) => a + (d.data.length ? (d.data[d.data.length - 1] || 0) : 0), 0);
      const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, icon: KIC.trend, headVal: fmt(lastTot) });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || CAT[i], borderRadius: 2, maxBarThickness: 26, stack: "s" })) },
        options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 11, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(fmt)(x.parsed.y) } } }, scales: { x: Object.assign(axX(), { stacked: true }), y: Object.assign(axY(fmt, { beginAtZero: true }), { stacked: true }) } }), plugins: [crosshair] });
      return c;
    }

    /* ---------- tables ---------- */
    function tableCard(mount, title, sub, html, opts) {
      opts = opts || {}; const c = card(mount, title, sub || monLbl, { span2: opts.span2 !== false, icon: opts.icon || KIC.grid, headVal: opts.headVal, chips: opts.chips });
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
    function segInsight(series, fmt) {
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

    // completeness banner — closings awaiting return (blank Net Cash), with an expandable job list
    const pendRows = (reduceMonth("closing", curY, mo, rs => rs.filter(r => blank(r["Net Cash"]))) || []).slice().sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
    const pend = pendRows.length;
    const totClose = reduceMonth("closing", curY, mo, rs => rs.length) || 0;
    if (pend > 0 && totClose > 0) {
      const rptPctVal = ((totClose - pend) / totClose * 100).toFixed(0);
      const wrap = document.createElement("div"); wrap.className = "mrx-bwrap";
      const b = document.createElement("div"); b.className = "mrx-banner";
      b.innerHTML = `<span class="bic">${KIC.warn}</span><span class="mrx-bmsg"><b>${pend}</b> of <b>${totClose}</b> ${MON[mo]} closings are still awaiting return (blank contract) — this month is <b>~${rptPctVal}%</b> reported; revenue &amp; profit will rise as they come in.</span><span class="mrx-btoggle">▸ view the ${pend} jobs</span>`;
      const detail = document.createElement("div"); detail.className = "mrx-bdetail"; detail.style.display = "none";
      const rowsH = pendRows.map(r => `<tr><td>${esc(String(r.Date || "").slice(0, 10))}</td><td>${esc(r.Customer || "—")}</td><td>${esc(String(r["Request #"] || "—"))}</td><td>${esc(r["Sales Person"] || "—")}</td><td>${esc(r.Foreman || "—")}</td></tr>`).join("");
      detail.innerHTML = `<div class="mrx-scroll"><table class="mrx-tbl"><thead><tr><th>Move date</th><th>Customer</th><th>Request #</th><th>Sales person</th><th>Foreman</th></tr></thead><tbody>${rowsH}</tbody></table></div>`;
      wrap.appendChild(b); wrap.appendChild(detail);
      b.querySelector(".mrx-btoggle").onclick = () => { const open = detail.style.display === "none"; detail.style.display = open ? "block" : "none"; b.querySelector(".mrx-btoggle").textContent = (open ? "▾ hide the " : "▸ view the ") + pend + " jobs"; };
      root.appendChild(wrap);
    }

    const toc = document.createElement("div"); toc.className = "mrx-toc"; root.appendChild(toc);
    bodyEl = document.createElement("div"); root.appendChild(bodyEl);

    const PM = mo === 1 ? 12 : mo - 1, PMY = mo === 1 ? curY - 1 : curY;
    const rev = valueFor("closing", "Revenue", curY, mo), revLY = valueFor("closing", "Revenue", curY - 1, mo), revPM = valueFor("closing", "Revenue", PMY, PM);
    // Revenue split — group the (unchanged) Revenue measure by Record Source so the two parts
    // sum EXACTLY to `rev`. closing = closing-sheet jobs (+ ~$0 linked-trip residual); trip =
    // standalone "trip" jobs appended to fct_closing. No shared measure is repointed.
    const revSrc = segSeries("closing", "Revenue", "Record Source", curY, mo);
    const revClose = (revSrc.find(r => r.k === "closing") || {}).v || 0;
    const revTrip = (revSrc.find(r => r.k === "trip") || {}).v || 0;
    const tripShare = rev ? revTrip / rev : 0;
    const op = valueFor("closing", "Operational Profit by Formula", curY, mo), opLY = valueFor("closing", "Operational Profit by Formula", curY - 1, mo), opPM = valueFor("closing", "Operational Profit by Formula", PMY, PM);
    const jobs = valueFor("closing", "Total Jobs", curY, mo), jobsLY = valueFor("closing", "Total Jobs", curY - 1, mo), jobsPM = valueFor("closing", "Total Jobs", PMY, PM);
    const bk = valueFor("moveboard", "Booking Rate", curY, mo), bkLY = valueFor("moveboard", "Booking Rate", curY - 1, mo), bkPM = valueFor("moveboard", "Booking Rate", PMY, PM);
    const leadsN = valueFor("moveboard", "Total Leads", curY, mo), leadsLY = valueFor("moveboard", "Total Leads", curY - 1, mo), leadsPM = valueFor("moveboard", "Total Leads", PMY, PM);
    const conf = valueFor("moveboard", "Confirmed Leads", curY, mo);
    const qual = valueFor("moveboard", "Qualified Leads", curY, mo);
    const margin = rev ? op / rev : null, marginLY = revLY ? opLY / revLY : null, marginPM = revPM ? opPM / revPM : null;
    const avgJob = jobs ? rev / jobs : null, avgJobLY = jobsLY ? revLY / jobsLY : null, avgJobPM = jobsPM ? revPM / jobsPM : null;
    const revWritten = reduceMonth("reviews_breakdown", curY, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenLY = reduceMonth("reviews_breakdown", curY - 1, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenPM = reduceMonth("reviews_breakdown", PMY, PM, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;

    /* ---- 01 · Executive Summary ---- */
    {
      const g = section("Executive Summary", monLbl + " · vs last year & last month", "k");
      [
        { l: "Revenue", v: money(rev), c: rev, ly: revLY, pm: revPM, spk: momSeries("closing", "Revenue", 12), icon: KIC.dollar, hero: 1 },
        { l: "Operational Profit", v: money(op), c: op, ly: opLY, pm: opPM, spk: momSeries("closing", "Operational Profit by Formula", 12), icon: KIC.trend },
        { l: "Op. Margin", v: pct(margin), c: margin, ly: marginLY, pm: marginPM, spk: momSeries("closing", "Operational Profit Margin", 12), icon: KIC.pct },
        { l: "Jobs Done", v: fmtN(jobs), c: jobs, ly: jobsLY, pm: jobsPM, spk: momSeries("closing", "Total Jobs", 12), icon: KIC.truck },
        { l: "Leads", v: fmtN(leadsN), c: leadsN, ly: leadsLY, pm: leadsPM, spk: momSeries("moveboard", "Total Leads", 12), icon: KIC.funnel },
        { l: "Booking Rate", v: pct(bk), c: bk, ly: bkLY, pm: bkPM, spk: momSeries("moveboard", "Booking Rate", 12), icon: KIC.check },
        { l: "Avg Job Value", v: money(avgJob), c: avgJob, ly: avgJobLY, pm: avgJobPM, spk: momReduce("closing", 12, rs => { const b = M["Revenue"].fn(rs), j = rs.length; return j ? b / j : null; }), icon: KIC.tag },
        { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, spk: momReduce("reviews_breakdown", 12, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)), icon: KIC.star }
      ].forEach(k => kpiTile(g, k));
      const gpRev = revLY ? (rev - revLY) / Math.abs(revLY) : 0;
      const tone = gpRev > 0.08 ? "A strong" : gpRev < -0.05 ? "A softer" : "A steady";
      const ex = document.createElement("div"); ex.className = "mrx-exec"; ex.style.gridColumn = "1/-1";
      ex.innerHTML = `<b>${tone} ${MON[mo]} ${curY}.</b> Revenue ${money(rev)} (${gpRev >= 0 ? "+" : ""}${(gpRev * 100).toFixed(0)}% YoY), operational profit ${money(op)} at ${pct(margin)} margin, ${fmtN(jobs)} jobs from ${fmtN(leadsN)} leads booked at ${pct(bk)}. Avg job value ${money(avgJob)}.${revTrip ? ` Of that revenue, ${money(revTrip)} (${(tripShare * 100).toFixed(1)}%) came from standalone trips — a minor add-on this year.` : ""}`;
      g.appendChild(ex);
    }

    /* ---- 02 · Revenue & Growth ---- */
    {
      const g = section("Revenue & Growth", "5-year " + MON[mo] + " trend and 12-month momentum");
      const revT = trendSeries("closing", "Revenue"), opT = trendSeries("closing", "Operational Profit by Formula"), jobT = trendSeries("closing", "Total Jobs");
      lines(g, "Revenue & Profit — momentum", "last 12 months", [ { label: "Revenue", series: momSeries("closing", "Revenue", 12), color: INK }, { label: "Op. Profit", series: momSeries("closing", "Operational Profit by Formula", 12), color: BLUE } ], moneyC, { span2: true, headVal: money(rev), chips: dchips([[rev, revPM, "MoM"]]) });
      yoyBars(g, "Total Revenue", revT, moneyC, { headVal: money(rev), chips: dchips([[rev, revLY, "YoY"], [rev, revPM, "MoM"]]) });
      {
        // Standalone-trip revenue, 5-yr trend — its OWN rescaled axis so the ~0.4% stream is readable
        // (a part-of-whole bar hides trips at sub-1%). The gross/linked memo keeps it honest.
        const mmS = String(mo).padStart(2, "0");
        const grossTrip = tripsRaw.reduce((a, r) => String(r["End Date"] || "").slice(0, 7) === `${curY}-${mmS}` ? a + num(r["Total Bill"]) : a, 0);
        const linkedIn = Math.max(0, grossTrip - revTrip);
        const tripT = yearsArr(5).map(y => { const rs = segSeries("closing", "Revenue", "Record Source", y, mo); return { k: String(y), v: (rs.find(r => r.k === "trip") || {}).v || 0 }; });
        const cTrip = yoyBars(g, "Standalone Trip Revenue — 5-yr", tripT, money, { sub: MON[mo] + " · trip add-on only", headVal: money(revTrip), chips: dchips([[revTrip, (tripT[tripT.length - 2] || {}).v, "YoY"]]) });
        note(cTrip, `Standalone “trip” jobs added ${money(revTrip)} this month — ${(tripShare * 100).toFixed(1)}% of the ${money(rev)} headline Revenue (trips ran ~2% a couple of years back).`
          + (grossTrip > revTrip + 1 ? ` Gross trip activity was ${money(grossTrip)}; the extra ${money(linkedIn)} is trip money already inside closing sheets (linked jobs), so it is not double-counted.` : "")
          + ` Closing-sheet jobs make up the remaining ${money(revClose)}.`);
      }
      const c1 = yoyBars(g, "Operational Profit", opT, moneyC, { headVal: money(op), chips: dchips([[op, opLY, "YoY"], [op, opPM, "MoM"]]) }); note(c1, trendInsight("Operational Profit", opT, money, MON[mo]));
      const c2 = yoyBars(g, "Jobs Done", jobT, fmtN, { headVal: fmtN(jobs), chips: dchips([[jobs, jobsLY, "YoY"], [jobs, jobsPM, "MoM"]]) }); note(c2, trendInsight("Jobs Done", jobT, fmtN, MON[mo]));
      const confT = trendSeries("moveboard", "Confirmed Leads"), bkT = trendSeries("moveboard", "Booking Rate");
      combo(g, "Confirmed Jobs & Booking Rate", MON[mo] + " · " + confT.length + "-yr", confT, "Confirmed", fmtN, bkT, "Booking %", pct, { headVal: pct(bk) });
      const isLocal = r => String(r["Moving Type"]) === "Local Moving";
      const localT = trendSeries("closing", "Revenue", { pre: isLocal });
      const ldT = trendSeries("closing", "Revenue", { pre: r => !isLocal(r) });
      const c6a = yoyBars(g, "Local Moving — 5-yr revenue", localT, moneyC, { headVal: money(lastV(localT)), sub: MON[mo] + " · hourly local jobs" });
      note(c6a, `Hourly “Local Moving” jobs — the volume base of the business.`);
      const c6b = yoyBars(g, "Long-distance — 5-yr revenue", ldT, moneyC, { headVal: money(lastV(ldT)), sub: MON[mo] + " · Regular + Straight" });
      note(c6b, `Flat-rate long-distance product lines (“Regular” + “Straight”) combined.`);
    }

    /* ---- 03 · Demand & Lead Funnel ---- */
    {
      const g = section("Demand & Lead Funnel", "conversion this month and rep performance");
      funnel(g, "Lead Funnel", monLbl + " · Total → Qualified → Confirmed", [ { k: "Total Leads", v: leadsN || 0 }, { k: "Qualified", v: qual || 0 }, { k: "Confirmed", v: conf || 0 } ], { headVal: pct(bk), chips: dchips([[bk, bkLY, "YoY"], [bk, bkPM, "MoM"]]) });
      const badCur = segReduce("moveboard", "Status", rs => rs.length, curY, mo, { pre: r => r["Status Category"] === "Bad Lead" }).slice(0, 6);
      const badLY = segReduce("moveboard", "Status", rs => rs.length, curY - 1, mo, { pre: r => r["Status Category"] === "Bad Lead" });
      const badMap = {}; badLY.forEach(r => badMap[r.k] = r.v);
      groupedBars(g, "Bad Leads by reason — YoY", badCur.map(r => r.k), badCur.map(r => badMap[r.k] || 0), String(curY - 1), badCur.map(r => r.v), String(curY), fmtN, { sub: MON[mo] });
      const spBook = segReduce("moveboard", "Assigned", rs => { const q = rs.filter(r => r["Status Category"] !== "Bad Lead").length, c = rs.filter(r => r["Status Category"] === "Confirmed").length; return q ? c / q : null; }, curY, mo).filter(r => r.v != null && r.rows.length >= 5).slice(0, 12);
      bullet(g, "Booking rate by salesperson", monLbl + " · vs team average", spBook, pct, bk || 0, { note: "Bars below the lime target line are converting under the team average — coaching targets." });
      rankBars(g, "Leads by source", segReduce("moveboard", "Source", rs => rs.length, curY, mo), fmtN, { top: 10 });
    }

    /* ---- 04 · Profitability & P&L ---- */
    {
      const g = section("Profitability & P&L", "where the revenue goes, and margin trend");
      const rowsW = withMonth(curY, mo, () => RS.filtered("closing", closing));
      const totBill = M["Total Bill"].fn(rowsW);
      const forman = M["Forman Salary"].fn(rowsW), driver = M["Driver Salary"].fn(rowsW);
      const helper = withMonth(curY, mo, () => M["Helper Salary"].fn(RS.filtered("helper_salaries", DS.helper_salaries || [])));
      const comm = withMonth(curY, mo, () => M["Sales Commission"].fn(RS.filtered("sales_salaries", DS.sales_salaries || [])));
      const expense = M["Car Expense"].fn(rowsW) + M["Fuel Expense"].fn(rowsW) + M["Hotel Expense"].fn(rowsW) + M["Toll Expense"].fn(rowsW) + M["Truck Expense"].fn(rowsW) + M["Other Expenses"].fn(rowsW);
      const refundTot = withMonth(curY, mo, () => M["Total Refunds"] ? M["Total Refunds"].fn(RS.filtered("refunds", DS.refunds || [])) : 0);
      const steps = [ { label: "Total Bill", v: totBill, type: "total" }, { label: "Foreman Salaries", v: -forman }, { label: "Driver Salaries", v: -driver }, { label: "Helper Salaries", v: -(helper || 0) }, { label: "Sales Commission", v: -(comm || 0) }, { label: "Expenses", v: -expense }, { label: "Refunds", v: -(refundTot || 0) }, { label: "Op. Profit", v: op, type: "total" } ];
      const wc = waterfall(g, "Total Bill → Operational Profit", monLbl, steps, { headVal: money(op), chips: dchips([[op, opLY, "YoY"]]) });
      note(wc, `From ${money(totBill)} in billings, labor + expenses + refunds leave ${money(op)} operational profit — a ${pct(margin)} margin.`);
      lines(g, "Operational Profit Margin", "last 12 months", [ { label: "Margin", series: momSeries("closing", "Operational Profit Margin", 12), color: VIOLET } ], pct, { headVal: pct(margin) });
      rankBars(g, "Operational Profit by State", segSeries("closing", "Operational Profit by Formula", "State Name"), money, { top: 10, note: segInsight(segSeries("closing", "Operational Profit by Formula", "State Name"), money) });
      const rr = ["Returned Customer", "Recommended"].map(src => {
        const rev2 = segSeries("closing", "Revenue", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const op2 = segSeries("closing", "Operational Profit by Formula", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        const j2 = segSeries("closing", "Total Jobs", "Source", curY, mo, { pre: r => String(r.Source) === src })[0];
        return { src, rev: rev2 ? rev2.v : 0, op: op2 ? op2.v : 0, jobs: j2 ? j2.v : 0 };
      });
      const rrHtml = `<table class="mrx-tbl"><thead><tr><th>Customer type</th><th>Revenue</th><th>Op. Profit</th><th>Jobs</th></tr></thead><tbody>${rr.map(r => `<tr><td>${r.src}</td>${td(money(r.rev))}${td(money(r.op))}${td(fmtN(r.jobs))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Returned & Recommended customers", monLbl, rrHtml, { span2: false, icon: KIC.grid, headVal: money(rr.reduce((a, b) => a + b.op, 0)) });
      const costMix = [{ k: "Foreman", v: forman }, { k: "Driver", v: driver }, { k: "Helper", v: helper || 0 }, { k: "Sales comm.", v: comm || 0 }, { k: "Expenses", v: expense }, { k: "Refunds", v: refundTot || 0 }].sort((a, b) => b.v - a.v);
      donut(g, "Cost structure", costMix, money, { center: money(totBill - op), centerLbl: "total cost" });
    }

    /* ---- 05 · Packing & Storage ---- */
    {
      const g = section("Packing & Storage", "packing economics and storage income trend");
      const packT = trendSeries("closing", "Total Packing Written");
      const packSalT = trendSeries("closing", "Forman Salary - Packing");
      combo(g, "Packing written vs foreman packing pay", MON[mo] + " · " + packT.length + "-yr", packT, "Written", moneyC, packT.map((r, i) => ({ k: r.k, v: (packSalT[i] && packSalT[i].v) ? r.v / packSalT[i].v : null })), "Rev / $1 pay", v => "$" + fmt1(v), { headVal: money(lastV(packT)) });
      const stoT = momSeries("storage", "Storage Additional Revenue", 14);
      lines(g, "Storage additional revenue", "last 14 months", [ { label: "Storage Add'l Rev", series: stoT, color: TEAL } ], money);
      const stoRows = stoT.map(r => ({ k: MS[r.m] + " " + r.y, add: r.v, bill: valueFor("closing", "Revenue", r.y, r.m), jobs: valueFor("closing", "Total Jobs", r.y, r.m) }));
      const html = `<table class="mrx-tbl"><thead><tr><th>Month</th><th>Total Bill</th><th>Jobs</th><th>Storage Add'l Rev</th></tr></thead><tbody>${stoRows.map(r => `<tr><td>${r.k}</td>${td(r.bill == null ? "—" : money(r.bill))}${td(r.jobs == null ? "—" : fmtN(r.jobs))}${td(r.add == null ? "—" : money(r.add))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Storage income — last 14 months", "", html, { icon: KIC.grid, headVal: money(lastV(stoT)) });
    }

    /* ---- 06 · Geography ---- */
    {
      const g = section("Geography — by State", "revenue, profit & booking per state with year-over-year");
      const revS = segSeries("closing", "Revenue", "State Name"), opS = segSeries("closing", "Operational Profit by Formula", "State Name"), jobS = segSeries("closing", "Total Jobs", "State Name");
      const opMap = {}, jobMap = {}; opS.forEach(r => opMap[r.k] = r.v); jobS.forEach(r => jobMap[r.k] = r.v);
      const revLyMap = {}; segSeries("closing", "Revenue", "State Name", curY - 1, mo).forEach(r => revLyMap[r.k] = r.v);
      const bkS = segReduce("moveboard", "State Name", rs => { const q = rs.filter(r => r["Status Category"] !== "Bad Lead").length, c = rs.filter(r => r["Status Category"] === "Confirmed").length; return q ? c / q : null; }, curY, mo);
      const bkMap = {}; bkS.forEach(r => bkMap[r.k] = r.v);
      const states = revS.slice(0, 12).map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, rev: r.v, revLy: revLyMap[r.k] || 0, op: opMap[r.k] || 0, jobs: jobMap[r.k] || 0, bk: bkMap[r.k] }));
      const rmin = Math.min(...states.map(s2 => s2.rev)), rmax = Math.max(...states.map(s2 => s2.rev));
      const omin = Math.min(...states.map(s2 => s2.op)), omax = Math.max(...states.map(s2 => s2.op));
      const jmin = Math.min(...states.map(s2 => s2.jobs)), jmax = Math.max(...states.map(s2 => s2.jobs));
      const barCell = (v, f, max, col) => `<td class="bar"><i style="width:${max > 0 ? Math.max(0, Math.min(100, v / max * 100)).toFixed(1) : 0}%;background:${col}"></i><span>${f(v)}</span></td>`;
      const yoyCell = (cur, ly) => { if (!ly) return td("—"); const d = (cur - ly) / ly; return td((d >= 0 ? "+" : "") + pct(d), `color:${d >= 0 ? "#1c7a4a" : "#b02a37"};font-weight:800`); };
      const rowsH = states.map(s2 => `<tr><td>${esc(s2.k)}</td>
        ${barCell(s2.rev, money, rmax, "#e7ecfb")}
        ${yoyCell(s2.rev, s2.revLy)}
        ${barCell(s2.op, money, omax, "#e4f1d9")}
        ${barCell(s2.jobs, fmtN, jmax, "#eef1f5")}
        ${td(s2.bk == null ? "—" : pct(s2.bk), s2.bk == null ? "" : `color:${s2.bk >= (bk || 0) ? "#1c7a4a" : "#b02a37"};font-weight:800`)}</tr>`).join("");
      tableCard(g, "State performance matrix", monLbl, `<table class="mrx-tbl"><thead><tr><th>State</th><th>Revenue</th><th>vs '${String(curY - 1).slice(2)}</th><th>Op. Profit</th><th>Jobs</th><th>Booking%</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: fmtN(states.length) + " states", note: "Bars show $ / jobs magnitude; vs '" + String(curY - 1).slice(2) + " is revenue YoY (green up, red down); Booking% is green above the team average." });
      rankBars(g, "Revenue by State", revS.map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, v: r.v })), money, { top: 10 });
      rankBars(g, "Jobs by state", jobS.map(r => ({ k: r.k === "—" ? "Unassigned" : r.k, v: r.v })), fmtN, { top: 10 });
    }

    /* ---- 07 · Lead Segmentation ---- */
    {
      const g = section("Lead Segmentation", "booking funnel by service type, size and cubic feet");
      function funnelTable(title, col) {
        const yy = String(curY - 1).slice(2);
        const d = segReduce("moveboard", col, rs => rs, curY, mo).map(r => { const rows2 = r.rows; const tot = rows2.length, bad = rows2.filter(x => x["Status Category"] === "Bad Lead").length, q = tot - bad, c = rows2.filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, tot, q, c, bad, book: q ? c / q : null }; }).sort((a, b) => b.tot - a.tot).slice(0, 12);
        if (!d.length) return;
        const plyMap = {}; let plyQ = 0, plyC = 0;
        segReduce("moveboard", col, rs => rs, curY - 1, mo).forEach(r => { const rows2 = r.rows, bad = rows2.filter(x => x["Status Category"] === "Bad Lead").length, q = rows2.length - bad, c = rows2.filter(x => x["Status Category"] === "Confirmed").length; plyMap[r.k] = q ? c / q : null; plyQ += q; plyC += c; });
        const tot = d.reduce((a, b) => ({ tot: a.tot + b.tot, q: a.q + b.q, c: a.c + b.c, bad: a.bad + b.bad }), { tot: 0, q: 0, c: 0, bad: 0 });
        const bkCell = (cur, ply) => { if (cur == null) return td("—"); const better = ply == null ? null : cur >= ply; return td(pct(cur), better == null ? "" : `color:${better ? "#1c7a4a" : "#b02a37"};font-weight:800`); };
        const rowsH = d.map(r => `<tr><td>${esc(r.k === "—" ? "Unassigned" : r.k)}</td>${td(fmtN(r.tot))}${td(fmtN(r.q))}${td(fmtN(r.c))}${td(fmtN(r.bad))}${bkCell(r.book, plyMap[r.k])}${td(plyMap[r.k] == null ? "—" : pct(plyMap[r.k]), "color:#8a94a3")}</tr>`).join("");
        const trow = `<tr class="tot"><td>Total</td>${td(fmtN(tot.tot))}${td(fmtN(tot.q))}${td(fmtN(tot.c))}${td(fmtN(tot.bad))}${td(tot.q ? pct(tot.c / tot.q) : "—")}${td(plyQ ? pct(plyC / plyQ) : "—", "color:#8a94a3")}</tr>`;
        tableCard(g, title, monLbl, `<table class="mrx-tbl"><thead><tr><th>${esc(col === "Service Type" ? "Service type" : col)}</th><th>Total</th><th>Qual.</th><th>Conf.</th><th>Bad</th><th>Booking%</th><th>vs '${yy}</th></tr></thead><tbody>${rowsH}${trow}</tbody></table>`, { span2: false, icon: KIC.grid, headVal: fmtN(tot.tot), note: "Booking% is green when this month beats " + yy + "'s rate for that segment, red when below; last column is the " + yy + " rate." });
      }
      funnelTable("Leads by service type", "Service Type");
      funnelTable("Leads by size of move", "Size of Move");
      funnelTable("Leads by CF range", "CF Range");
      funnelTable("Leads by state", "State Name");
    }

    /* ---- 08 · Composition & Segments ---- */
    {
      const g = section("Revenue Composition & Segments", "how revenue splits this month");
      rankBars(g, "Revenue by Moving Type", segSeries("closing", "Revenue", "Moving Type"), money, { top: 6, note: segInsight(segSeries("closing", "Revenue", "Moving Type"), money) });
      rankBars(g, "Revenue by Size of Move", segSeries("closing", "Revenue", "Size of Move"), money, { top: 8 });
      rankBars(g, "Revenue by Source", segSeries("closing", "Revenue", "Source"), money, { top: 10, note: segInsight(segSeries("closing", "Revenue", "Source"), money) });
      donut(g, "Lead Status Mix", segReduce("moveboard", "Status Category", rs => rs.length), fmtN, { center: fmtN(leadsN), centerLbl: "leads" });
    }

    /* ---- 09 · Sales Team ---- */
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
        ${td(r.m.book == null ? "—" : pct(r.m.book), r.m.book == null ? "" : `color:${r.m.book >= (bk || 0) ? "#1c7a4a" : "#b02a37"};font-weight:800`)}
        ${td(r.m.dead == null ? "—" : pct(r.m.dead), r.m.dead == null ? "" : `color:${r.m.dead > .3 ? "#b02a37" : "#1c7a4a"};font-weight:800`)}</tr>`).join("");
      tableCard(g, "Salesperson scorecard", monLbl, `<table class="mrx-tbl"><thead><tr><th>Sales Person</th><th>Revenue</th><th>Op. Profit</th><th>Qual.</th><th>Conf.</th><th>Booking%</th><th>Dead%</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: fmtN(reps.length) + " reps", note: "Bars = revenue share; Booking% green>team-avg; Dead% red when high — the coaching signals in one place." });
      const bigPre = { pre: r => { const cf = String(r["CF Range"] || ""); return /1000|1500|2000|Over|1001|>|\+/.test(cf) && !/0-1000|<1000|Under/.test(cf); } };
      const bigMb = segReduce("moveboard", "Assigned", rs => rs, curY, mo, bigPre).map(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = r.rows.filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, q, c, book: q ? c / q : null }; }).filter(r => r.q >= 2).sort((a, b) => b.q - a.q).slice(0, 10);
      const revSPly = {}; segSeries("closing", "Revenue", "Sales Person", curY - 1, mo).forEach(r => revSPly[r.k] = r.v);
      const opSPly = {}; segSeries("closing", "Operational Profit by Formula", "Sales Person", curY - 1, mo).forEach(r => opSPly[r.k] = r.v);
      const topReps = revSP.slice(0, 10);
      groupedBars(g, "Revenue by salesperson — YoY", topReps.map(r => r.k), topReps.map(r => revSPly[r.k] || 0), String(curY - 1), topReps.map(r => r.v), String(curY), money, { sub: MON[mo] });
      groupedBars(g, "Op. Profit by salesperson — YoY", topReps.map(r => r.k), topReps.map(r => opSPly[r.k] || 0), String(curY - 1), topReps.map(r => opMap[r.k] || 0), String(curY), money, { sub: MON[mo] });
      if (bigMb.length) groupedBars(g, "Large moves (>1000 CF) — Qualified vs Confirmed", bigMb.map(r => r.k), bigMb.map(r => r.q), "Qualified", bigMb.map(r => r.c), "Confirmed", fmtN, { sub: monLbl });
      const bigBook = bigMb.filter(r => r.book != null).map(r => ({ k: r.k, v: r.book }));
      if (bigBook.length) bullet(g, "Large-move (>1000 CF) booking rate by rep", monLbl + " · vs team avg", bigBook, pct, bk || 0, {});
    }

    /* ---- 10 · Operations & Crew ---- */
    {
      const g = section("Operations & Crew (Foreman)", "productivity, quality score and month-over-month");
      const payM = {}, tipsM = {}, refM = {};
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Forman Total $"]), 0), curY, mo).forEach(r => payM[r.k] = r.v);
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Tip from Company Part"]) + num(x["Tip From the Customers"]), 0), curY, mo).forEach(r => tipsM[r.k] = r.v);
      segReduce("refunds", "Foreman", rs => Math.abs(rs.reduce((a, x) => a + num(x["Total refund"]), 0)), curY, mo).forEach(r => refM[r.k] = r.v);
      const scRows = (DS.scorecard || []).filter(r => { const d = String(r["Month"] || "").slice(0, 7); return d === `${curY}-${String(mo).padStart(2, "0")}`; });
      if (scRows.length) {
        const sc = scRows.map(r => ({ f: r.Foreman, jobs: num(r["Total Jobs"]), cf: num(r["Total CF"]), written: num(r["Total Packing Written"]), est: num(r["Total Packing Estimate"]), rev: num(r["Total Reviews Written"]), claims: num(r["Forman Fault Claims"]), score: num(r["Forman Score"]), rank: num(r["Forman Score Rank"]), prev: num(r["Forman Score Prev Month"]) }))
          .sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 15);
        const smax = Math.max(...sc.map(r => r.score || 0)) || 1;
        const rowsH = sc.map((r, i) => { const arrow = r.prev ? (r.score > r.prev ? `<span style="color:${POS}">▲</span>` : r.score < r.prev ? `<span style="color:${NEG}">▼</span>` : "–") : ""; const up = r.est > 0 ? r.written / r.est : null; return `<tr><td>${i === 0 ? "👑 " : ""}${esc(r.f)}</td>
          ${td(fmtN(r.jobs))}${td(fmtN(r.cf))}${td(money(payM[r.f] || 0))}${td(money(tipsM[r.f] || 0))}${td(money(r.written))}${td(up == null ? "—" : up.toFixed(1) + "×", up == null ? "" : `color:#1c7a4a;font-weight:800`)}${td(fmtN(r.rev))}${td(fmtN(r.claims), r.claims > 0 ? `color:#b02a37;font-weight:800` : "")}${td(refM[r.f] ? money(refM[r.f]) : "—", refM[r.f] ? `color:#b02a37;font-weight:800` : "")}
          <td class="bar"><i style="width:${(r.score / smax * 100).toFixed(0)}%;background:#dcecab"></i><span>${fmt1(r.score)} ${arrow}</span></td></tr>`; }).join("");
        tableCard(g, "Foreman scorecard — ranked", monLbl, `<table class="mrx-tbl"><thead><tr><th>Foreman</th><th>Jobs</th><th>CF</th><th>Pay</th><th>Tips</th><th>Packing</th><th>vs Est</th><th>Reviews</th><th>Claims</th><th>Refunds</th><th>Score</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: fmtN(sc.length) + " crews", note: "Pay/Tips from closings; 'vs Est' = packing written ÷ quoted estimate; refunds attributed to foreman; Score = composite w/ MoM arrow. Rank 1 crowned." });
      }
      const jobF = segSeries("closing", "Total Jobs", "Foreman").slice(0, 12);
      const hrMap = {}; segSeries("closing", "Hours Worked by Forman", "Foreman").forEach(r => hrMap[r.k] = r.v);
      combo(g, "Jobs vs Hours by Foreman", monLbl, jobF, "Jobs", fmtN, jobF.map(r => ({ k: r.k, v: hrMap[r.k] || 0 })), "Hours", fmtN);
      const packCur = segSeries("closing", "Total Packing Written", "Foreman").slice(0, 12);
      const packPrev = {}; segSeries("closing", "Total Packing Written", "Foreman", PMY, PM).forEach(r => packPrev[r.k] = r.v);
      groupedBars(g, "Packing written by foreman — MoM", packCur.map(r => r.k), packCur.map(r => packPrev[r.k] || 0), MS[PM], packCur.map(r => r.v), MS[mo], money, { sub: `${MS[PM]} vs ${MS[mo]}` });
      const estM = {}; scRows.forEach(r => estM[r.Foreman] = num(r["Total Packing Estimate"]));
      groupedBars(g, "Packing written vs estimate by foreman", packCur.map(r => r.k), packCur.map(r => estM[r.k] || 0), "Estimate", packCur.map(r => r.v), "Written", money, { sub: monLbl });
      const refByFm = segReduce("refunds", "Foreman", rs => Math.abs(rs.reduce((a, x) => a + num(x["Total refund"]), 0)), curY, mo).filter(r => r.v > 0 && r.k !== "—");
      if (refByFm.length) rankBars(g, "Refunds by foreman", refByFm, money, { top: 10 });
    }

    /* ---- 11 · Quality & Customer Experience ---- */
    {
      const g = section("Quality & Customer Experience", "reviews, negative reviews and claims");
      const claimsN = reduceMonth("claims", curY, mo, rs => rs.length) || 0;
      const claimsPM = reduceMonth("claims", PMY, PM, rs => rs.length) || 0;
      const negN = reduceMonth("negative_reviews", curY, mo, rs => rs.length) || 0;
      const negPM = reduceMonth("negative_reviews", PMY, PM, rs => rs.length) || 0;
      const claimRate = jobs ? claimsN / jobs * 100 : null;
      const kg = document.createElement("div"); kg.className = "mrx-grid k"; kg.style.gridColumn = "1/-1"; g.appendChild(kg);
      [ { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, pm: revWrittenPM, icon: KIC.star },
        { l: "Negative Reviews", v: fmtN(negN), c: negN, pm: negPM, icon: KIC.warn, inv: 1 },
        { l: "Claims Filed", v: fmtN(claimsN), c: claimsN, pm: claimsPM, icon: KIC.warn, inv: 1 },
        { l: "Claims / 100 jobs", v: claimRate == null ? "—" : fmt1(claimRate), c: claimRate, pm: (jobsPM ? claimsPM / jobsPM * 100 : null), icon: KIC.pct, inv: 1 }
      ].forEach(k => kpiTile(kg, k));
      rankBars(g, "Claims by responsibility", segReduce("claims", "Responsibility", rs => rs.length, curY, mo), fmtN, { top: 8 });
      donut(g, "Claims by reason", segReduce("claims", "Reason", rs => rs.length, curY, mo).filter(r => r.k !== "—" && r.k !== "(blank)"), fmtN, { center: fmtN(reduceMonth("claims", curY, mo, rs => rs.filter(r => r.Reason && r.Reason !== "(blank)").length) || 0), centerLbl: "classified" });
      const refByReason = segReduce("refunds", "Reason", rs => Math.abs(rs.reduce((a, r) => a + num(r["Total refund"]), 0)), curY, mo).filter(r => r.v > 0);
      const refTot = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      rankBars(g, "Refunds by reason", refByReason, money, { top: 8, sub: `${money(refTot)} · ${rev ? pct(refTot / rev) : "—"} of revenue`, headVal: money(refTot), note: `${money(refTot)} refunded in ${MON[mo]} — ${rev ? pct(refTot / rev) : "—"} of revenue.` });
      rankBars(g, "Reviews by source", segReduce("reviews_breakdown", "Source", rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0), curY, mo), fmtN, { top: 8 });
    }

    /* ---- 12 · Marketing & Channels ---- */
    {
      const g = section("Marketing & Channels", "ad spend momentum, source revenue and call demand");
      const adTrend = momReduce("card_expenses", 12, rs => { const ad = rs.filter(r => Number(r["Is Advertising"]) === 1); return ad.length ? ad.reduce((a, r) => a + num(r.Amount), 0) : null; });
      lines(g, "Advertising spend — momentum", "last 12 months", [ { label: "Ad Spend", series: adTrend, color: AMBER } ], moneyC, { headVal: money(lastV(adTrend)) });
      const callLabels = momReduce("callrail", 12, rs => rs.length).map(r => r.k);
      const answered = momReduce("callrail", 12, rs => rs.filter(r => String(r["Call Status"]) === "Answered Call").length).map(r => r.v);
      const missed = momReduce("callrail", 12, rs => rs.filter(r => /Missed|Abandoned/.test(String(r["Call Status"]))).length).map(r => r.v);
      stackedTime(g, "Inbound calls — answered vs missed", "last 12 months (CallRail)", callLabels, [ { label: "Answered", data: answered, color: INK }, { label: "Missed/Abandoned", data: missed, color: NEG } ], fmtN);
      const callsBySrc = segReduce("callrail", "Source", rs => rs.length, curY, mo).slice(0, 10);
      const ftc = reduceMonth("callrail", curY, mo, rs => { const t = rs.length, f = rs.filter(r => Number(r["First-Time Caller"]) === 1).length; return t ? f / t : null; });
      rankBars(g, "Calls by source", callsBySrc, fmtN, { top: 10, sub: monLbl, note: ftc == null ? "" : `${pct(ftc)} of calls this month were first-time callers.` });
      // source economics — jobs / revenue / op profit / ad spend / ROI per channel (ad spend lags ~1 month)
      const adBySrc = {}; (reduceMonth("card_expenses", curY, mo, rs => rs.filter(r => Number(r["Is Advertising"]) === 1)) || []).forEach(r => { const s2 = r.Source == null || r.Source === "" ? "—" : String(r.Source); adBySrc[s2] = (adBySrc[s2] || 0) + num(r.Amount); });
      const revBySrc = segSeries("closing", "Revenue", "Source"), opBySrc = segSeries("closing", "Operational Profit by Formula", "Source"), jobBySrc = segSeries("closing", "Total Jobs", "Source");
      const opM = {}, jbM = {}; opBySrc.forEach(r => opM[r.k] = r.v); jobBySrc.forEach(r => jbM[r.k] = r.v);
      const anyAd = Object.values(adBySrc).some(v => v > 0);
      const seRows = revBySrc.slice(0, 12).map(r => { const ad = adBySrc[r.k] || 0, roi = ad > 0 ? r.v / ad : null; return { k: r.k, jobs: jbM[r.k] || 0, rev: r.v, op: opM[r.k] || 0, ad, roi }; });
      const seHtml = `<table class="mrx-tbl"><thead><tr><th>Source</th><th>Jobs</th><th>Revenue</th><th>Op. Profit</th><th>Ad Spend</th><th>ROI</th></tr></thead><tbody>${seRows.map(r => `<tr><td>${esc(r.k)}</td>${td(fmtN(r.jobs))}${td(money(r.rev))}${td(money(r.op))}${td(r.ad > 0 ? money(r.ad) : "—")}${td(r.roi == null ? "—" : (r.roi.toFixed(1) + "×"), r.roi == null ? "" : `color:${r.roi >= 3 ? "#1c7a4a" : r.roi >= 1 ? "#7a5a12" : "#b02a37"};font-weight:800`)}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Source economics — jobs · revenue · profit · ad ROI", monLbl, seHtml, { icon: KIC.grid, headVal: fmtN(seRows.length) + " sources", note: anyAd ? "ROI = revenue ÷ ad spend (green ≥3×, amber ≥1×, red <1×). Ad spend from card feed." : `Ad-spend feed for ${MON[mo]} not synced yet — ad/ROI fill once it lands; revenue/profit/jobs are final.` });
      rankBars(g, "Operational Profit by Source", opBySrc, money, { top: 10 });
      rankBars(g, "Jobs by Source", jobBySrc.map(r => ({ k: r.k, v: r.v })), fmtN, { top: 10 });
    }

    /* ---------- TOC + controls ---------- */
    secList.forEach(s => { const chip = document.createElement("span"); chip.className = "mrx-tocchip"; chip.textContent = s.n + " " + (TOCNAME[s.title] || s.title); chip.onclick = () => { s.wrap.classList.remove("collapsed"); s.wrap.scrollIntoView({ behavior: "smooth", block: "start" }); }; toc.appendChild(chip); });
    const reRender = () => { if (typeof renderPage === "function") renderPage(); else location.reload(); };
    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; reRender(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; reRender(); };
    const pb = document.getElementById("mrPrint"); if (pb) pb.onclick = () => window.print();
  }
});

var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5 });
