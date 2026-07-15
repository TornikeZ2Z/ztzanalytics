/* Monthly Report — "Monthly Business Review" (v17: deck order + hover axis fix). [rebuild-nudge-2]
   SOLID flat fills (no gradients), monospaced numerals, section number-badges + icons +
   "loaded-bar" rules. v10 adds: funnel-flow section order (lead→cash→after-sale); headline
   stat + delta + icon on EVERY chart card ("max infographic"); a data-completeness banner
   (closings awaiting return); a sticky table-of-contents; collapsible sections; symmetric
   2-up / 4-up grids; rich hover (crosshair + tooltip). Data/measure logic unchanged. */
/* One renderer, five pages: the full Monthly Report plus four TEAM VIEWS that render a
   filtered subset of the SAME sections (same data, same visuals — nothing duplicated).
   Each team page has its own page id so access can be granted per team. */
async function renderMonthly(host, MRCFG) {
    const ONLY = MRCFG && MRCFG.sections ? new Set(MRCFG.sections) : null;
    const SEC = t => !ONLY || ONLY.has(t);
    // N2: every team page is titled "Monthly Review" in the sidebar; the team name lives in
    // MRCFG.label and is used on the cover + PDF so the report still says whose view it is.
    const TEAM = MRCFG ? (MRCFG.label || MRCFG.title || "") : "";
    const PDF_NAME = TEAM ? TEAM + " Monthly Review" : "Monthly Report";
    /* C43: the Monthly Report is Zip-to-Zip ONLY. Every computation gets a default
       Company = "Zip to Zip" filter (an explicit Company pick in the global slicer still
       wins — see withMonth); the isolated fetches below apply the same rule. Rows with no
       Company value pass through so a missing lineage column can never blank a card. */
    const MR_CO = "Zip to Zip";
    const coRow = r => r.Company == null || String(r.Company) === MR_CO;
    const M = RS.M;
    const MON = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const MS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, pct = RS.fmtPct, fmt1 = RS.fmt1;
    const esc = RSC.esc;
    const num = v => (v == null || isNaN(v)) ? 0 : +v;
    const blank = v => v == null || String(v).trim() === "";

    /* ---------- data ---------- */
    // PERF (2026-07-14 audit): everything downloads concurrently — the old 3 serial
    // Promise.all waves + 5 sequential isolated fetches were a ~7-hop waterfall. The
    // isolated fetches are additionally GATED by SEC() so a one-section themed dashboard
    // no longer pays for data it never renders (full report: SEC is always true).
    /* REGRESSION FIX (same day, Tornike's blank-sections report): the first cut fired
       ~20 requests at once and swallowed failures with catch(()=>[]) — under that burst
       the bridge dropped some requests, and the page rendered blank sections and, far
       worse, WRONG composites (Gross Profit computed without helper/commission/refunds
       looks plausible but is inflated). Now: at most 6 requests in flight, each retried
       twice with backoff, and a dataset that still fails lands in loadFailures and
       becomes a red banner — never a silent blank, never a silently wrong number. */
    const loadFailures = [];
    let _fly = 0; const _fq = [];
    const _take = () => new Promise(res => { if (_fly < 6) { _fly++; res(); } else _fq.push(res); });
    const _give = () => { const n = _fq.shift(); if (n) n(); else _fly--; };
    async function pooled(label, fn) {
      await _take();
      try {
        for (let a = 0; ; a++) {
          try { return await fn(); }
          catch (e) {
            if (a >= 2) { loadFailures.push(label); console.error("MR feed failed:", label, e); return []; }
            await new Promise(r => setTimeout(r, 500 * (a + 1) + Math.random() * 400));
          }
        }
      } finally { _give(); }
    }
    const grab = ds => pooled(ds, () => RS.load(ds));
    const needPack = SEC("Packing & Storage"), needFleet = SEC("Fleet"), needPhone = SEC("Phone & Response");
    // ISOLATED fetch of the card-expense COST flags. Kept OUT of the shared card_expenses
    // projection on purpose: these columns can vanish on a pipeline re-run, so a failed fetch
    // degrades only the storage/packing-cost panels. Cached on success only.
    const cardCostP = window.__mrCostCache2 ? Promise.resolve(window.__mrCostCache2)
      : !needPack ? Promise.resolve([])
      : pooled("card cost flags", () => ZTZ.api("/api/fct_card_expenses?limit=1000000&cols=" + encodeURIComponent("Transaction Date,Amount,Is Storage Cost,Is Packing Material Cost,Company"))
        .then(j => (j.rows || []).filter(coRow).map(r => { const d = String(r["Transaction Date"] || "").slice(0, 10); return { ym: d.slice(0, 7), amt: -num(r.Amount), sto: Number(r["Is Storage Cost"]) === 1, pk: Number(r["Is Packing Material Cost"]) === 1 }; })));
    const rcP = (window.__mrRcCache || !needPhone) ? null
      : pooled("RingCentral calls", () => ZTZ.api("/api/fct_ringcentral?limit=1000000&cols=" + encodeURIComponent("Date,Type,Direction,Action Result,Duration Seconds,Extension,Company")).then(j => j.rows || []));
    const smsP = (window.__mrRcSmsCache || !needPhone) ? null
      : pooled("RingCentral SMS", () => ZTZ.api("/api/fct_ringcentral_sms?limit=1000000&cols=" + encodeURIComponent("Date,Direction,Message Status,Company")).then(j => j.rows || []));
    const fleetP = (window.__mrFleetCache2 || !needFleet) ? null
      : pooled("fleet (truck) data", () => ZTZ.api("/api/fct_closing?limit=1000000&cols=" + encodeURIComponent("Date,Truck #,Total Bill,Fuel,Truck,Car,Tolls,Company")).then(j => j.rows || []));
    const packP = (window.__mrPackCache2 || !needPack) ? null
      : pooled("per-job packing", () => ZTZ.api("/api/moveboard?limit=1000000&cols=" + encodeURIComponent("Move Date,Service Type,Sales Packing total,Closing Packing total,Company")).then(j => j.rows || []));
    // (long_distance dropped from the fetch 2026-07-14 — its only consumer, the LD
    //  carrier-economics cards, was removed at Tornike's request)
    const [closing, moveboard, storage, claims, refunds, cardEx,
           reviews, negrev, callrail, scorecard, rcounts, rgoals,
           helperSalDs, salesSalDs] = await Promise.all(
      ["closing", "moveboard", "storage", "claims", "refunds", "card_expenses",
       "reviews_breakdown", "negative_reviews", "callrail", "scorecard", "review_counts", "review_goals",
       "helper_salaries", "sales_salaries"].map(grab));
    const cardCost = await cardCostP;
    if (cardCost.length && !window.__mrCostCache2) window.__mrCostCache2 = cardCost;
    delete window.__mrCostCache;   // pre-C43 cache (no company filter) — retire it
    const costByMonth = (ym, flag) => cardCost.reduce((a, r) => (r.ym === ym && r[flag]) ? a + r.amt : a, 0);
    const hasCostData = cardCost.some(r => r.sto || r.pk);
    // RingCentral phone-system stats — isolated narrow fetch from fct_ringcentral, folded into
    // per-month buckets ONCE and cached. GRAIN RULE (audit 2026-07-13): the export is LEG-level —
    // only Type='Voice' rows are real phone calls (Type NULL = ring/forward legs of the SAME call,
    // Type='Fax' = faxes). Counting every row inflated volumes ~2.5-3.4x and mislabeled ~71k
    // inbound ring-legs as outbound. Definitions: answered = Action Result 'Accepted';
    // missed = 'Missed' + 'Voicemail' (kept separately); teammate = the agent's Extension
    // (the Name column is the OTHER party — ranking it credited customers as "teammates").
    if (rcP) {
      const rcRows = await rcP;
      const agg = {};
      rcRows.forEach(r => {
        if (String(r.Type) !== "Voice") return;   // sessions only — legs & faxes never count as calls
        if (String(r.Company) === "Tuji") return; // Tuji lines are a separate business — ZtZ scope only
        const ym = String(r.Date || "").slice(0, 7); if (!/^\d{4}-\d{2}$/.test(ym)) return;
        const b = agg[ym] || (agg[ym] = { in: 0, out: 0, ans: 0, miss: 0, vm: 0, inDur: 0, outDur: 0, names: {} });
        const dur = +r["Duration Seconds"] || 0;
        const res = String(r["Action Result"] || "");
        if (String(r.Direction) === "Incoming") {
          b.in++; b.inDur += dur;
          if (/^Accepted$/i.test(res)) b.ans++;
          else if (/^Missed$/i.test(res)) b.miss++;
          else if (/^Voicemail$/i.test(res)) b.vm++;
        } else if (String(r.Direction) === "Outgoing") {
          b.out++; b.outDur += dur;
          const ext = String(r.Extension || "").trim();
          // per-person ranking: skip the shared "Support Zip To Zip" queue line
          if (ext && !/support zip to zip/i.test(ext)) {
            const nm = ext.replace(/^\d+\s*-\s*/, "");   // "108 - Alex Koval" -> "Alex Koval"
            const n2 = b.names[nm] || (b.names[nm] = { out: 0, dur: 0 }); n2.out++; n2.dur += dur;
          }
        }
      });
      if (rcRows.length) window.__mrRcCache = agg;
    }
    const rcAgg = window.__mrRcCache || {};
    // RingCentral SMS (first consumer 2026-07-13) — same isolated-fold pattern; the export's
    // own Direction column is trusted; ZtZ lines only (Tuji excluded like the calls fold).
    if (smsP) {
      const smsRows = await smsP;
      const agg2 = {};
      smsRows.forEach(r => {
        if (String(r.Company) === "Tuji") return;
        const ym = String(r.Date || "").slice(0, 7); if (!/^\d{4}-\d{2}$/.test(ym)) return;
        const b = agg2[ym] || (agg2[ym] = { in: 0, out: 0, fail: 0 });
        if (String(r.Direction) === "Inbound") b.in++;
        else if (String(r.Direction) === "Outbound") b.out++;
        if (String(r["Message Status"]) === "Failed") b.fail++;
      });
      if (smsRows.length) window.__mrRcSmsCache = agg2;
    }
    const rcSms = window.__mrRcSmsCache || {};
    // fleet (Truck #) + per-job packing (estimate vs written) — narrow isolated fetches, cached on success
    if (fleetP) {
      const fl0 = await fleetP;
      if (fl0.length) window.__mrFleetCache2 = fl0;
    }
    delete window.__mrFleetCache;  // pre-C43 cache (no Company column) — retire it
    const fleetRows = (window.__mrFleetCache2 || []).filter(coRow);
    if (packP) {
      // per-job packing totals live only in the RAW moveboard table (not carried into fct_moveboard).
      // C28: fetch Move Date — this card buckets by MOVE month, like the rest of the packing section.
      const pk0 = await packP;
      if (pk0.length) window.__mrPackCache2 = pk0;
    }
    delete window.__mrPackCache;   // pre-C28 cache (Create Date, no Move Date column) — retire it
    const packJobs = (window.__mrPackCache2 || []).filter(coRow);
    const DS = { closing, moveboard, storage, claims, refunds, card_expenses: cardEx, reviews_breakdown: reviews, negative_reviews: negrev, callrail, scorecard, review_counts: rcounts, review_goals: rgoals, helper_salaries: helperSalDs, sales_salaries: salesSalDs };

    const latest = closing.reduce((a, r) => (coRow(r) && r._d && r._d > a ? r._d : a), "");
    if (!st.month) {
      // remembered month first (UX audit: the picked month survives visits) — else auto-detect
      let saved = null;
      try { saved = String(localStorage.getItem("ztzMrMonth") || ""); } catch (e) {}
      const sm = /^(\d{4})-(\d{2})$/.exec(saved);
      if (sm && +sm[1] >= 2023 && +sm[1] <= new Date().getFullYear() + 1) { st.year = +sm[1]; st.month = +sm[2]; }
      else {
        const now = new Date(); let dy, dm;
        if (latest) { dy = +latest.slice(0, 4); dm = +latest.slice(5, 7); } else { dy = now.getFullYear(); dm = now.getMonth() + 1; }
        if (dy === now.getFullYear() && dm === now.getMonth() + 1) { dm--; if (dm < 1) { dm = 12; dy--; } }
        st.month = dm; st.year = dy;
      }
    }
    const curY = st.year, mo = st.month, monLbl = MON[mo] + " " + curY;
    // C43: plain-English freshness date ("July 6, 2026", not ISO)
    const dateLong = d => MON[+d.slice(5, 7)] + " " + (+d.slice(8, 10)) + ", " + d.slice(0, 4);
    const freshness = latest ? `data through ${dateLong(latest)}` : "";

    /* ---------- month engine ---------- */
    function rangeFor(y, m) { const mm = String(m).padStart(2, "0"), last = new Date(y, m, 0).getDate(); return [`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, "0")}`]; }
    function withMonth(y, m, fn) {
      const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo, co: S.multi.company, hadCo: Object.prototype.hasOwnProperty.call(S.multi, "company"),
        yr: S.multi.year, hadYr: Object.prototype.hasOwnProperty.call(S.multi, "year"),
        mn: S.multi.month, hadMn: Object.prototype.hasOwnProperty.call(S.multi, "month") };
      const [a, b] = rangeFor(y, m); S.dateFrom = a; S.dateTo = b; S.dayFrom = S.dayTo = null;
      // This page OWNS time: the global Year/Month slicers are neutralized during every
      // computation (previously they silently intersected the page's own Month picker —
      // the C31 zero-rows trap). The global date row is also hidden on this page (shell).
      delete S.multi.year; delete S.multi.month;
      // C43: default the Company filter to Zip to Zip for EVERY computation on this page
      // (flows into every RS.filtered call, incl. the salary tables' closing-key scope and
      // the registry Booking Rate's booked-date pass). An explicit slicer choice still wins.
      if (!sv.co || !sv.co.size) S.multi.company = new Set([MR_CO]);
      try { return fn(); } finally {
        S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt;
        if (sv.hadCo) S.multi.company = sv.co; else delete S.multi.company;
        if (sv.hadYr) S.multi.year = sv.yr;
        if (sv.hadMn) S.multi.month = sv.mn;
      }
    }
    // Month-scalar memo (perf): valueFor is called hundreds of times per render and its
    // result depends only on (ds, measure, y, m) + the non-time slicer state. Caching it
    // across renders makes adjacent month flips near-instant. Only parameter-free calls
    // are cached (opts.pre closures aren't serializable).
    const memoSerial = JSON.stringify(Object.entries(RS.state.multi)
      .filter(([k, s]) => k !== "year" && k !== "month" && s && s.size)
      .map(([k, s]) => [k, [...s].sort()]).sort());
    // NEVER persist month-scalars computed from partial data — a failed feed would poison
    // the cache with plausible-but-wrong numbers (the inflated-Gross-Profit bug). A render
    // with failures gets a throwaway map; __mrMemo (pre-fix store) is retired outright.
    delete window.__mrMemo;
    let memo;
    if (loadFailures.length) memo = new Map();
    else {
      if (!window.__mrMemo2 || window.__mrMemo2.serial !== memoSerial)
        window.__mrMemo2 = { serial: memoSerial, map: new Map() };
      memo = window.__mrMemo2.map;
    }
    function valueFor(ds, measure, y, m, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      const cacheable = !opts;
      const key = cacheable ? ds + "|" + measure + "|" + y + "|" + m : null;
      if (cacheable && memo.has(key)) return memo.get(key);
      const v = withMonth(y, m, () => { let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre); return M[measure] ? M[measure].fn(f) : null; });
      if (cacheable) memo.set(key, v);
      return v;
    }
    function reduceMonth(ds, y, m, reducer, opts) {
      const rows = DS[ds]; if (!rows || !rows.length) return null;
      return withMonth(y, m, () => { let f = RS.filtered(ds, rows, opts); if (opts && opts.pre) f = f.filter(opts.pre); return reducer(f); });
    }
    // Floor at 2023: pre-2023 rows are hard-removed from the warehouse (2023 cutoff), so
    // earlier years would render as hollow zero slots on every 5-yr chart (Tornike: "we
    // have hidden 2022 data — why do I still have them in graphs?").
    const yearsArr = n => { const a = []; for (let y = Math.max(2023, curY - (n || st.years) + 1); y <= curY; y++) a.push(y); return a; };
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
    /* ---------- canonical Booking Rate scaffolding (C2/D4) ----------
       RS.bookingRate(createdRows, bookedRows) is dual-basis: Qualified counts by CREATE
       date, Confirmed by BOOKED date. These helpers build the booked-date row scope for a
       month (and per-segment groups of it) so NO booking rate on this page is computed
       inline any more. */
    function bookedRowsFor(y, m, pre) {
      const rows = DS.moveboard; if (!rows || !rows.length) return [];
      return withMonth(y, m, () => {
        let f = RS.filtered("moveboard", rows, { dateColumn: "Booked Date" });
        if (pre) f = f.filter(pre);
        return f;
      });
    }
    function groupByCol(rows, col) {
      const g = {}; rows.forEach(r => { const k = r[col] == null || r[col] === "" ? "—" : String(r[col]); (g[k] = g[k] || []).push(r); }); return g;
    }
    // 12-month booking-rate trend (optionally pre-filtered) — canonical dual basis per month
    function bookRateTrend(pre, n) {
      const out = []; let y = curY, m = mo;
      for (let i = 0; i < (n || 12); i++) {
        const created = reduceMonth("moveboard", y, m, rs => rs, pre ? { pre } : undefined) || [];
        const booked = bookedRowsFor(y, m, pre);
        out.unshift({ k: MS[m] + " " + String(y).slice(2), y, m, v: RS.bookingRate(created, booked) });
        m--; if (m < 1) { m = 12; y--; }
      }
      return out;
    }

    /* ---------- palette ---------- */
    const INK = "#0e1621", INK2 = "#1b2a3f", SUB = "#5a6775", FAINT = "#93a0b2", LINE = "#e4e9f0";
    const LIME = "#b7e23b", LIMED = "#7ba317";
    const BLUE = "#3b82f6", AMBER = "#f5a524", VIOLET = "#8b5cf6", TEAL = "#14b8a6", CORAL = "#ec6a5e", PINK = "#ec4899", SKY = "#38bdf8";
    // ONE semantic green/red pair page-wide (UX audit: two competing pairs existed;
    // these darker values match the ~30 inline chip hexes and read better on white)
    const POS = "#1c7a4a", NEG = "#b02a37";
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
      "Phone & Response": '<svg viewBox="0 0 24 24"><path d="M4 3h4l2 5-2.5 2a14 14 0 006.5 6.5L16 14l5 2v4a1 1 0 01-1 1C10.6 21 3 13.4 3 4a1 1 0 011-1z"/></svg>',
      "Quality & Customer Experience": '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 17l-5.2 2.5 1-5.7L3.5 9.7l5.9-.9z"/></svg>',
      "Reviews Production": '<svg viewBox="0 0 24 24"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.7L12 17l-5.2 2.5 1-5.7L3.5 9.7l5.9-.9z"/></svg>',
      "Claims": '<svg viewBox="0 0 24 24"><path d="M12 3l9 16H3z"/><path d="M12 10v4"/><path d="M12 17h.01"/></svg>',
      "Refunds & Cost of Quality": '<svg viewBox="0 0 24 24"><path d="M12 2v20"/><path d="M17 6c0-2-2.2-3-5-3S7 4 7 6s2.2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3"/></svg>',
      "Geography — by State": '<svg viewBox="0 0 24 24"><path d="M12 21s7-5.6 7-11a7 7 0 10-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
      "Lead Segmentation": '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="4" rx="1"/><rect x="3" y="10" width="18" height="4" rx="1"/><rect x="3" y="16" width="18" height="4" rx="1"/></svg>',
      "Per-Job Profitability": '<svg viewBox="0 0 24 24"><path d="M19 5L5 19"/><rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.2"/><path d="M17 14v6.5"/><path d="M13.8 17.2h6.5"/></svg>',
      "Repeat & Referral Business": '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5"/><path d="M20 3.5v5h-5"/><path d="M20 12a8 8 0 0 1-13.6 5.7L4 15.5"/><path d="M4 20.5v-5h5"/></svg>',
      "Marketing ROI": '<svg viewBox="0 0 24 24"><path d="M3 10v4l12 5V5z"/><path d="M15 8.5a4 4 0 010 7"/></svg>',
      "Lead Sources": '<svg viewBox="0 0 24 24"><path d="M3 4h18l-7 8v7l-4-2v-5z"/></svg>',
      "Fleet": '<svg viewBox="0 0 24 24"><rect x="1.5" y="6" width="12" height="9" rx="1"/><path d="M13.5 9h4l3 3v3h-7z"/><circle cx="6" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/></svg>',
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
      .mrx{background:#f4f6fa;color:${INK};border-radius:16px;padding:24px 24px 46px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased;
        box-shadow:0 10px 44px rgba(0,0,0,.35)}
      .mrx *{box-sizing:border-box}
      .mrx-info{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;margin-left:7px;vertical-align:-2px;
        border:1.4px solid #b6c0cd;border-radius:50%;background:transparent;color:#8a95a4;cursor:pointer;padding:0;
        font:italic 700 11px/1 Georgia,serif}
      .mrx-info:hover{border-color:${INK};color:${INK}}
      .mrx-info.on{background:${INK};border-color:${INK};color:${LIME}}
      .mrx-loaderr{background:#fbe6e7;border:1.5px solid #e5b6ba;border-left:5px solid #b02a37;color:#7a1f28;border-radius:12px;
        padding:13px 16px;margin-bottom:14px;font-size:13.5px;line-height:1.55;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
      .mrx-loaderr button{margin-top:0}
      .mrx-cover{position:relative;background:${INK};color:#fff;border-radius:16px;padding:24px 26px;margin-bottom:16px;overflow:hidden}
      .mrx-cover .mrx-accent{position:absolute;left:0;top:0;bottom:0;width:6px;background:${LIME}}
      .mrx-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${LIME}}
      .mrx-h1{font-size:33px;font-weight:800;letter-spacing:-.9px;margin:6px 0 4px;color:#fff}
      .mrx-cvsub{color:#a9b6c6;font-size:12.5px;font-weight:600}
      .mrx-cvactions{position:absolute;top:22px;right:24px;display:flex;gap:8px;z-index:2}
      .mrx-print{background:${LIME};color:${INK};border:0;border-radius:9px;padding:9px 15px;font-size:13px;font-weight:800;cursor:pointer}
      .mrx-print2{background:transparent;color:#a9b6c6;border:1px solid #2c3e57;border-radius:9px;padding:9px 12px;font-size:12.5px;font-weight:700;cursor:pointer}
      .mrx-print2:hover{color:#fff;border-color:#46607f}
      .mrx-cvpick{display:flex;gap:8px;margin:10px 0 8px}
      .mrx-ctl{font:inherit;font-size:14px;font-weight:700;color:#fff;background:${INK2};border:1px solid #2c3e57;border-radius:9px;padding:8px 12px;cursor:pointer;outline:none}
      .mrx-ctl:focus-visible{outline:2px solid ${LIME};outline-offset:1px}
      .mrx-lite-h{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:#fff;border:1px solid ${LINE};border-left:5px solid ${LIME};border-radius:12px;padding:13px 18px;margin-bottom:14px;box-shadow:0 1px 2px rgba(14,22,33,.05)}
      .mrx-lite-tt{font-size:20px;font-weight:800;letter-spacing:-.4px;color:${INK}}
      .mrx-lite-tt b{display:block;font-size:10.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:${LIMED}}
      .mrx-lite-ctl{font-size:12.5px;font-weight:700;color:${SUB};white-space:nowrap}
      .mrx-lite-ctl select{font:inherit;font-weight:700;color:${INK};background:#f4f6fa;border:1px solid ${LINE};border-radius:7px;padding:3px 8px;margin-left:4px}
      .mrx-bwrap{margin-bottom:16px}
      .mrx-banner{display:flex;align-items:center;gap:11px;background:#fff8ec;border:1px solid #f2d492;border-left:4px solid ${AMBER};border-radius:11px;padding:11px 15px;font-size:13px;color:#7a5a12;font-weight:600}
      .mrx-banner b{font-family:${MONO};color:${INK};font-weight:800}
      .mrx-banner .bic{display:flex;flex:0 0 auto}.mrx-banner .bic svg{width:19px;height:19px;fill:none;stroke:${AMBER};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-bmsg{flex:1}
      .mrx-btoggle{flex:0 0 auto;font-family:${MONO};font-size:11.5px;font-weight:800;color:${INK};cursor:pointer;white-space:nowrap;border-bottom:1.5px solid ${AMBER};user-select:none}
      .mrx-bdetail{margin-top:7px;background:#fff;border:1px solid #f2d492;border-radius:9px;padding:9px 13px;max-height:300px;overflow:auto}
      .mrx-toc{position:sticky;top:0;z-index:60;background:#fff;box-shadow:0 4px 14px rgba(14,22,33,.14);border-bottom:1px solid ${LINE};display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:9px 24px;margin:0 -24px 10px}
      .mrx-tocpart{font-size:9.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${FAINT};margin:0 1px 0 7px;white-space:nowrap}
      .mrx-tocpart:first-child{margin-left:0}
      .mrx-tocchip{font-family:${MONO};font-size:11.5px;font-weight:700;color:${INK2};background:#fff;border:1px solid ${LINE};border-radius:7px;padding:4px 9px;cursor:pointer;white-space:nowrap;user-select:none}
      .mrx-tocchip:hover{border-color:${INK};background:#eef1f6}
      .mrx-tocchip.on{background:${INK};color:${LIME};border-color:${INK}}
      .mrx-tocstep{margin-left:auto;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
      .mrx-tocstep b{font-family:${MONO};font-size:12px;color:${INK};min-width:56px;text-align:center}
      .mrx-tocstep button{border:1px solid ${LINE};background:#fff;color:${INK};border-radius:7px;width:26px;height:26px;font-size:14px;line-height:1;cursor:pointer}
      .mrx-tocstep button:hover{border-color:${INK};background:#eef1f6}
      .mrx-parth{display:flex;align-items:baseline;gap:12px;margin:38px 0 -10px;padding-top:18px;border-top:3px solid ${INK}}
      .mrx-parth .pn{font-family:${MONO};font-size:11px;font-weight:800;letter-spacing:.14em;background:${INK};color:${LIME};padding:3px 9px;border-radius:6px;white-space:nowrap}
      .mrx-parth .pt{font-size:15.5px;font-weight:800;letter-spacing:-.2px;color:${INK};white-space:nowrap}
      .mrx-parth .ps{font-size:12px;color:${SUB};font-weight:600}
      .mrx-sec{margin:26px 0 4px;scroll-margin-top:56px}
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
      .mrx-ct{font-size:16px;font-weight:750;color:${INK};line-height:1.25}
      .mrx-cs{font-size:11.5px;font-weight:700;color:${FAINT};text-transform:uppercase;letter-spacing:.04em;font-family:${MONO}}
      .mrx-chd{text-align:right;flex:0 0 auto;white-space:nowrap}
      .mrx-chval{font-family:${MONO};font-size:20px;font-weight:800;color:${INK};letter-spacing:-.4px;line-height:1.05}
      .mrx-chd .mrx-chips{justify-content:flex-end;margin-top:3px}
      .mrx-box{position:relative;height:340px}
      .mrx-note{margin-top:10px;font-size:13px;color:#48505e;line-height:1.55;background:#f6f8fb;border-left:3px solid ${LIME};padding:8px 11px;border-radius:0 7px 7px 0}
      .mrx-note.how{border-left-color:#c9d1dc;background:#f5f7fa;color:#5a6775;font-size:12.5px}
      .mrx-kpi{position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:14px 15px 13px;box-shadow:0 1px 2px rgba(14,22,33,.05);overflow:hidden}
      .mrx-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:${INK}}
      .mrx-kpi.mrx-hero:before{background:${LIME}}
      .mrx-kl{font-size:11px;font-weight:750;color:${SUB};text-transform:uppercase;letter-spacing:.05em;display:flex;align-items:center;gap:6px}
      .mrx-ic{display:flex}.mrx-ic svg{width:14px;height:14px;fill:none;stroke:${FAINT};stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .mrx-kv{font-size:31px;font-weight:800;color:${INK};letter-spacing:-.6px;margin:4px 0 0;font-family:${MONO};font-variant-numeric:tabular-nums}
      .mrx-uline{display:block;width:24px;height:3px;background:${LIME};border-radius:2px;margin:3px 0 7px}
      .mrx-chips{display:flex;gap:5px;flex-wrap:wrap}
      .mrx-chip{font-size:10.5px;font-weight:750;padding:2px 6px;border-radius:5px;font-family:${MONO};font-variant-numeric:tabular-nums}
      .mrx-spark{height:30px;position:relative;margin-top:9px}
      .mrx-exec{background:${INK};color:#e8edf3;border-radius:12px;padding:14px 16px;font-size:13.5px;line-height:1.55;margin-top:16px}
      .mrx-exec b{color:${LIME}}
      .mrx-tbl{width:100%;border-collapse:collapse;font-size:13.5px;font-variant-numeric:tabular-nums;font-family:${MONO}}
      .mrx-tbl th{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${SUB};text-align:right;padding:7px 9px;border-bottom:2px solid ${INK};white-space:nowrap;font-family:Inter,sans-serif}
      .mrx-tbl th:first-child{text-align:left}
      .mrx-tbl td{padding:7px 9px;text-align:right;border-bottom:1px solid #eef1f5;color:${INK2};white-space:nowrap}
      .mrx-tbl td:first-child{text-align:left;font-weight:600;color:${INK};font-family:Inter,sans-serif}
      .mrx-tbl tr:last-child td{border-bottom:0}
      .mrx-tbl tr.tot td{font-weight:800;border-top:2px solid ${INK};color:${INK}}
      .mrx-tbl .bar{position:relative}
      .mrx-tbl .bar i{position:absolute;left:0;top:3px;bottom:3px;background:#e6ebf8;border-radius:3px;z-index:0}
      .mrx-tbl .bar span{position:relative;z-index:1}
      .mrx-scroll{overflow-x:auto}
      .mrx-empty{height:100%;display:grid;place-items:center;color:${FAINT};font-size:13px;font-weight:600}
      .mrx-xls{font:inherit;font-size:12px;font-weight:700;color:${INK};background:transparent;border:1px solid ${LINE};border-radius:8px;padding:6px 11px;cursor:pointer;margin-top:9px}
      .mrx-xls:hover{border-color:${INK};background:#eef1f6}
      .mrx-xls:focus-visible{outline:2px solid ${LIMED};outline-offset:1px}
      @media(max-width:900px){
        .mrx-toc{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
        .mrx-tocstep{margin-left:8px}
        .mrx-ctl{padding:10px 12px}
        .mrx-lite-ctl select{padding:9px 11px}
      }
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
    const axX = (o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 12 } }, grid: { display: false }, border: { color: LINE } }, o || {});
    const axY = (fmt, o) => Object.assign({ ticks: { color: AXIS, font: { family: MONO, size: 11.5 }, maxTicksLimit: 7, callback: v => fmt ? fmt(v) : v }, grid: { color: GRID }, border: { display: false } }, o || {});
    const valLabels = (fmt, horiz, color) => ({ id: "vlab", afterDatasetsDraw(ch) {
      const ctx = ch.ctx; ctx.save(); ctx.font = "700 11.5px " + MONO; ctx.fillStyle = color || INK;
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
    // C48/Q8: two note kinds — "Insight ·" is reserved for genuine findings; methodology /
    // definition notes carry "How it's counted ·" so readers never learn to skip insights.
    function note(c, txt, kind) {
      if (!txt) return; const n = document.createElement("div");
      const how = kind === "how";
      n.className = "mrx-note" + (how ? " how" : "");   // gray = methodology, lime = finding
      n.innerHTML = `<b style="color:${how ? SUB : LIMED}">${how ? "How it's counted · " : "Insight · "}</b>${esc(txt)}`;
      if (how) {
        // Methodology hides behind an ℹ icon next to the card title (Tornike 2026-07-14:
        // "it makes the dashboard ugly — at least hide them in Information icon").
        // Insight notes (lime, findings) stay visible — only the how-text folds away.
        n.style.display = "none";
        const ic = document.createElement("button"); ic.type = "button"; ic.className = "mrx-info";
        ic.title = "How it's counted"; ic.textContent = "i";
        ic.onclick = e => {
          e.stopPropagation();
          const open = n.style.display === "none";
          n.style.display = open ? "block" : "none"; ic.classList.toggle("on", open);
        };
        const tt = c.querySelector(".mrx-ct"); (tt || c).appendChild(ic);
      }
      c.appendChild(n);
    }
    function emptyBox(box, msg) { box.innerHTML = `<div class="mrx-empty">${esc(msg || ("No data for " + monLbl))}</div>`; }
    const TOCNAME = { "Executive Summary": "Summary", "Demand & Lead Funnel": "Leads", "Sales Team Performance": "Sales", "Operations & Crew (Foreman)": "Crew", "Packing & Storage": "Packing", "Revenue & Growth": "Revenue", "Revenue Composition & Segments": "Rev. Mix", "Profitability & P&L": "P&L", "Marketing & Channels": "Marketing", "Marketing ROI": "Mkt ROI", "Lead Sources": "Sources", "Fleet": "Fleet", "Phone & Response": "Phone", "Quality & Customer Experience": "Quality", "Reviews Production": "Reviews", "Claims": "Claims", "Refunds & Cost of Quality": "Refunds", "Geography — by State": "Geography", "Lead Segmentation": "Segments", "Repeat & Referral Business": "Repeat & Referral", "Per-Job Profitability": "Per Job" };
    let bodyEl, secN = 0; const secList = [], tocParts = [];
    // collapsed-section memory (UX audit 2026-07-14): survives month flips and visits
    const collapsedSet = (() => { try { return new Set(JSON.parse(localStorage.getItem("ztzMrCollapsed") || "[]")); } catch (e) { return new Set(); } })();
    const saveCollapsed = () => { try { localStorage.setItem("ztzMrCollapsed", JSON.stringify([...collapsedSet])); } catch (e) {} };
    // narrative block divider — the report reads as 4 parts: month → money → demand → delivery.
    // Team views are single-topic slices, so the part headers are skipped there.
    function part(n, title, sub) {
      if (ONLY) return;
      tocParts.push({ at: secN, label: title });   // chip-row group label boundary
      const el = document.createElement("div"); el.className = "mrx-parth";
      el.innerHTML = `<span class="pn">PART ${n}</span><span class="pt">${esc(title)}</span><span class="ps">${esc(sub || "")}</span>`;
      bodyEl.appendChild(el);
    }
    function section(title, sub, klass) {
      secN++; const n = String(secN).padStart(2, "0");
      const wrap = document.createElement("section"); wrap.className = "mrx-sec";
      if (collapsedSet.has(title)) wrap.classList.add("collapsed");
      wrap.innerHTML = `<div class="mrx-sec-h">
        <span class="mrx-badge${secN === 1 ? " mrx-hero" : ""}">${n}</span>
        <span class="mrx-sec-ic">${ICONS[title] || ICONS._def}</span>
        <span class="mrx-sec-tt"><span class="mrx-sec-t">${esc(title)}</span><span class="mrx-sec-s">${esc(sub || "")}</span></span>
        <span class="mrx-code">SEC ${n}</span><span class="mrx-caret">▼</span>
      </div><div class="mrx-rule"><i></i></div>`;
      const grid = document.createElement("div"); grid.className = "mrx-grid" + (klass ? " " + klass : ""); wrap.appendChild(grid);
      wrap.querySelector(".mrx-sec-h").addEventListener("click", () => {
        wrap.classList.toggle("collapsed");
        if (wrap.classList.contains("collapsed")) collapsedSet.add(title); else collapsedSet.delete(title);
        saveCollapsed();
      });
      bodyEl.appendChild(wrap); secList.push({ n, title, wrap }); return grid;
    }

    /* ---------- delta chip + KPI tile ---------- */
    function chip(cur, prev, label, inv) {
      // C19/Q1: one title tooltip here explains YoY/MoM on every card at once
      const tt = label === "YoY" ? "YoY = vs the same month last year" : label === "MoM" ? "MoM = vs the previous month" : "";
      const ttA = tt ? ` title="${tt}"` : "";
      if (cur == null || prev == null || !prev) return `<span class="mrx-chip"${ttA} style="background:#eef1f5;color:${SUB}">${label} —</span>`;
      const g = (cur - prev) / Math.abs(prev); const up = g >= 0; const good = inv ? !up : up;
      const col = good ? "#1c7a4a" : "#b02a37"; const bg = good ? "#e4f3ea" : "#fbe6e7";
      return `<span class="mrx-chip"${ttA} style="background:${bg};color:${col}">${label} ${up ? "▲" : "▼"} ${Math.abs(g * 100).toFixed(0)}%</span>`;
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
    const lbf = f => (f === money ? moneyC : f);  // per-POINT data labels use the compact form so 12+ of them fit; hover still shows full
    const lblc = c => c === CTX ? "#7b869a" : c === AMBER ? "#b7791a" : c === SKY ? "#0e8aca" : c === LIME ? LIMED : c;  // label ink: darken light series colors so 9px text stays legible on white
    function yoyBars(mount, title, series, fmt, opts) {
      opts = opts || {}; const s = series.filter(r => r.v != null);
      opts.icon = opts.icon || KIC.trend;
      if (opts.headVal == null && s.length) opts.headVal = fmt(s[s.length - 1].v);
      if (opts.chips == null && s.length >= 2) opts.chips = dchips([[s[s.length - 1].v, s[s.length - 2].v, "YoY"]]);
      const { c, box, cv } = chartCard(mount, title, opts.sub || (MS[mo] + " · " + s.length + "-yr"), opts);
      if (!s.length) { emptyBox(box); return c; }
      const avg = s.reduce((a, b) => a + b.v, 0) / s.length;
      // opts.yoyPct: print the % change vs the PREVIOUS bar inside each bar top (green/red)
      const yoyLab = { id: "yoypct", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 11.5px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ch.getDatasetMeta(0).data.forEach((el, i) => { if (!i) return; const cur = s[i].v, prev = s[i - 1].v; if (cur == null || !prev) return; const d = (cur - prev) / Math.abs(prev);
          ctx.fillStyle = d >= 0 ? POS : NEG; ctx.fillText((d >= 0 ? "+" : "") + (d * 100).toFixed(0) + "%", el.x, el.y + 5); }); ctx.restore(); } };
      new Chart(cv, { type: "bar",
        data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === s.length - 1 ? LIME : INK), borderRadius: 5, maxBarThickness: 52, categoryPercentage: .7, barPercentage: .82 }] },
        options: baseOpts({ layout: { padding: { top: 22 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => tip(fmt)(x.parsed.y) } } }, scales: { x: axX(), y: axY(fmt, { beginAtZero: true }) } }),
        plugins: [valLabels(fmt, false), crosshair, ...(opts.yoyPct ? [yoyLab] : []), { id: "avg", afterDraw(ch) { const y = ch.scales.y.getPixelForValue(avg), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = "#b7c0cd"; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(a.left, y); ctx.lineTo(a.right, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = SUB; ctx.font = "700 9px " + MONO; ctx.textAlign = "left"; ctx.fillText("avg " + fmt(avg), a.left + 3, y - 3); ctx.restore(); } }] });
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
        options: baseOpts({ layout: { padding: { top: 16, right: 30, bottom: 4 } }, plugins: { legend: { display: sets.length > 1, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, boxHeight: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(x.dataset.yAxisID === "y1" ? (opts.fmt1 || fmt) : fmt)(x.parsed.y) } } },
          scales: opts.dual ? { x: axX(), y: axY(fmt), y1: axY(opts.fmt1 || fmt, { position: "right", grid: { display: false } }) } : { x: axX(), y: axY(fmt) } }), plugins: [crosshair, { id: "lelab", afterDatasetsDraw(ch) {
          // point value labels — compact form, staggered per series, and auto-THINNED: step = how many
          // points one label's width needs, anchored on the newest point (which is therefore always labeled)
          const ctx = ch.ctx; ctx.save(); ctx.font = "700 11.5px " + MONO; ctx.textAlign = "center";
          const area = ch.chartArea, nPts = labels.length;
          const xSp = nPts > 1 ? (area.right - area.left) / (nPts - 1) : 1e9;
          sets.forEach((d, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden) return;
            const f = lbf(d.axis === "y1" ? (opts.fmt1 || fmt) : fmt); const above = di % 2 === 0;
            let maxW = 0; d.series.forEach(r => { if (r.v != null) { const w = ctx.measureText(f(r.v)).width; if (w > maxW) maxW = w; } });
            const step = Math.max(1, Math.ceil((maxW + 6) / xSp));
            ctx.fillStyle = lblc(d.color || CAT[di]); ctx.textBaseline = above ? "bottom" : "top";
            meta.data.forEach((el, i) => { const v = d.series[i] && d.series[i].v; if (v == null || (nPts - 1 - i) % step !== 0) return; ctx.fillText(f(v), el.x, above ? el.y - 5 : el.y + 5); });
          }); ctx.restore(); } }] });
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
        options: baseOpts({ layout: { padding: { top: 18, right: 30 } }, plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.yAxisID === "y1" ? `${lineLabel}: ${tip(lineFmt)(x.parsed.y)}` : `${barLabel}: ${tip(barFmt)(x.parsed.y)}` } } },
          scales: { x: axX(), y: axY(barFmt, { beginAtZero: true, title: { display: true, text: barLabel, color: SUB, font: { size: 10, weight: "700" } } }), y1: axY(lineFmt, { position: "right", grid: { display: false }, title: { display: true, text: lineLabel, color: BLUE, font: { size: 10, weight: "700" } } }) } }), plugins: [crosshair, { id: "cblab", afterDatasetsDraw(ch) {
          // labels thinned like lelab, and bar vs line labels PHASE-SHIFTED so the two rows never stack on one column
          const ctx = ch.ctx; ctx.save(); ctx.textAlign = "center";
          const area = ch.chartArea, nPts = labels.length;
          const xSp = nPts > 1 ? (area.right - area.left) / (nPts - 1) : 1e9;
          const bf = lbf(barFmt), lf = lbf(lineFmt);
          ctx.font = "700 11.5px " + MONO;
          let wB = 0; barSeries.forEach(r => { if (r.v != null) { const w = ctx.measureText(bf(r.v)).width; if (w > wB) wB = w; } });
          let wL = 0; lineSeries.forEach(r => { if (r.v != null) { const w = ctx.measureText(lf(r.v)).width; if (w > wL) wL = w; } });
          const step = Math.max(1, Math.ceil((Math.max(wB, wL) + 6) / xSp));
          const off = step > 1 ? Math.floor(step / 2) : 0;
          ctx.fillStyle = INK; ctx.textBaseline = "bottom";
          ch.getDatasetMeta(0).data.forEach((el, i) => { const v = barSeries[i] && barSeries[i].v; if (v == null || isNaN(v) || (nPts - 1 - i) % step !== 0) return; ctx.fillText(bf(v), el.x, el.y - 3); });
          ctx.font = "700 11.5px " + MONO; ctx.fillStyle = BLUE;
          ch.getDatasetMeta(1).data.forEach((el, i) => { const v = lineSeries[i] && lineSeries[i].v; if (v == null || isNaN(v) || (nPts - 1 - i + off) % step !== 0) return; ctx.fillText(lf(v), el.x, el.y - 7); });
          ctx.restore(); } }] });
      return c;
    }
    function rankBars(mount, title, series, fmt, opts) {
      opts = opts || {}; opts.icon = opts.icon || KIC.bars;
      const topN = opts.top || 12;
      if (opts.headVal == null) { const tot = series.reduce((a, b) => a + (b.v || 0), 0); opts.headVal = fmt(tot); if (opts.subCode == null) opts.subCode = 1; }
      const firstLen = Math.min(series.length, topN) + (series.length > topN ? 1 : 0);
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { span2: opts.span2, h: Math.max(190, 40 + firstLen * 27), icon: opts.icon, headVal: opts.headVal, chips: opts.chips });
      if (!series.length) { emptyBox(box); return c; }
      // C33 + Tornike 2026-07-14: the cut segments roll into one "All others (N)" bar so the
      // bars add up to the headline; hovering it LISTS what's inside, clicking it EXPANDS the
      // chart to every segment (clicking anywhere while expanded collapses back).
      let chart = null, expanded = false;
      const draw = () => {
        const s = expanded ? series.slice() : series.slice(0, topN);
        const cut = series.length - s.length;
        let tail = [];
        if (!expanded && cut > 0) {
          tail = series.slice(s.length);
          s.push({ k: `All others (${cut}) — click to expand`, v: tail.reduce((a, b) => a + (b.v || 0), 0), __other: 1 });
        }
        if (chart) chart.destroy();
        box.style.height = Math.max(216, 48 + s.length * 31) + "px";
        chart = new Chart(cv, { type: "bar",
          data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((r, i) => r.__other ? "#aeb9c8" : (!expanded && i === 0) ? LIME : INK), hoverBackgroundColor: s.map(r => r.__other ? "#98a5b6" : "#34465f"), borderRadius: 4, maxBarThickness: 20 }] },
          options: baseOpts({ indexAxis: "y", layout: { padding: { right: 58 } },
            onClick: (e, els) => {
              if (expanded) { expanded = false; draw(); return; }
              if (els && els.length && s[els[0].index] && s[els[0].index].__other) { expanded = true; draw(); }
            },
            onHover: (e, els) => { if (e.native && e.native.target) e.native.target.style.cursor =
              (expanded || (els && els.length && s[els[0].index] && s[els[0].index].__other)) ? "pointer" : "default"; },
            plugins: { legend: { display: false }, tooltip: { callbacks: {
              label: x => tip(fmt)(x.parsed.x),
              afterBody: items => {
                const it = items && items[0];
                if (!it || !s[it.dataIndex] || !s[it.dataIndex].__other) return;
                const lines = tail.slice(0, 14).map(t => `${t.k}: ${fmt(t.v)}`);
                if (tail.length > 14) lines.push(`… +${tail.length - 14} more — click to expand`);
                return lines;
              } } } },
            scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 13, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
          plugins: [valLabels(fmt, true), crosshair] });
      };
      draw();
      if (opts.note) note(c, opts.note, opts.noteKind);
      return c;
    }
    function groupedBars(mount, title, labels, sa, la, sb, lb, fmt, opts) {
      opts = opts || {}; opts.icon = opts.icon || KIC.bars;
      if (opts.headVal == null) { const t = sb.reduce((a, b) => a + (b || 0), 0); opts.headVal = fmt(t); }
      const { c, box, cv } = chartCard(mount, title, opts.sub || "", { span2: opts.span2, h: Math.max(200, 44 + labels.length * 30), icon: opts.icon, headVal: opts.headVal, chips: opts.chips });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar",
        data: { labels, datasets: [ { label: la, data: sa, backgroundColor: CTX, hoverBackgroundColor: "#aab6c4", borderRadius: 3, maxBarThickness: 12 }, { label: lb, data: sb, backgroundColor: INK, hoverBackgroundColor: "#34465f", borderRadius: 3, maxBarThickness: 12 } ] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 84 } }, plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(fmt)(x.parsed.x) } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 12.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }), plugins: [crosshair, valLabels(fmt, true)] });
      return c;
    }
    function donut(mount, title, series, fmt, opts) {
      opts = opts || {}; const pos = series.filter(r => r.v > 0);
      const firstLen = Math.min(pos.length, 7) + (pos.length > 7 ? 1 : 0);
      const { c, box, cv } = chartCard(mount, title, opts.sub || monLbl, { h: Math.max(250, 90 + firstLen * 0), span2: opts.span2, icon: KIC.pie, headVal: opts.center || fmt(pos.reduce((a, b) => a + b.v, 0)) });
      if (!pos.length) { emptyBox(box); return c; }
      // Tornike 2026-07-14: "All others" must be inspectable — hover lists its contents,
      // click expands the donut to every slice (click again collapses).
      let chart = null, expanded = false;
      const draw = () => {
        const head = expanded ? pos.slice() : pos.slice(0, 7), tail = expanded ? [] : pos.slice(7);
        const s = tail.length ? head.concat([{ k: `All others (${tail.length}) — click to expand`, v: tail.reduce((a, b) => a + b.v, 0), __other: 1 }]) : head;
        const tot = s.reduce((a, b) => a + b.v, 0);
        if (chart) chart.destroy();
        box.style.height = Math.max(292, expanded ? 140 + s.length * 17 : 292) + "px";
        chart = new Chart(cv, { type: "doughnut", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((r, i) => r.__other ? "#aeb9c8" : CAT[i % CAT.length]), borderColor: "#fff", borderWidth: 3, hoverOffset: 5 }] },
          options: baseOpts({ cutout: "66%", interaction: { mode: "nearest", intersect: true },
            onClick: (e, els) => {
              if (expanded) { expanded = false; draw(); return; }
              if (els && els.length && s[els[0].index] && s[els[0].index].__other) { expanded = true; draw(); }
            },
            onHover: (e, els) => { if (e.native && e.native.target) e.native.target.style.cursor =
              (expanded || (els && els.length && s[els[0].index] && s[els[0].index].__other)) ? "pointer" : "default"; },
            plugins: { legend: { position: "right", labels: { color: INK2, font: { size: 12.5 }, boxWidth: 12, padding: expanded ? 5 : 8, usePointStyle: true } }, tooltip: { callbacks: {
              label: x => `${x.label}: ${tip(fmt)(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)`,
              afterBody: items => {
                const it = items && items[0];
                if (!it || !s[it.dataIndex] || !s[it.dataIndex].__other) return;
                const lines = tail.slice(0, 14).map(t => `${t.k}: ${fmt(t.v)}`);
                if (tail.length > 14) lines.push(`… +${tail.length - 14} more — click to expand`);
                return lines;
              } } } } }),
          plugins: [{ id: "ctr", afterDraw(ch) { const a = ch.chartArea, ctx = ch.ctx, x = (a.left + a.right) / 2, y = (a.top + a.bottom) / 2; ctx.save(); ctx.textAlign = "center"; ctx.fillStyle = INK; ctx.font = "800 19px " + MONO; ctx.fillText(opts.center || fmt(tot), x, y - 2); ctx.fillStyle = FAINT; ctx.font = "700 10px Inter"; ctx.fillText(opts.centerLbl || "total", x, y + 15); ctx.restore(); } },
          { id: "dlab", afterDatasetsDraw(ch) {
            // % label on every slice big enough to hold one (>=4% of the ring)
            const ctx = ch.ctx; ctx.save(); ctx.font = "800 11.5px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ch.getDatasetMeta(0).data.forEach((el, i) => {
              const p = s[i] ? s[i].v / tot : 0; if (p < 0.04) return;
              const pt = el.tooltipPosition ? el.tooltipPosition() : el.getCenterPoint();
              ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeText((p * 100).toFixed(0) + "%", pt.x, pt.y);
              ctx.fillStyle = "#fff"; ctx.fillText((p * 100).toFixed(0) + "%", pt.x, pt.y);
            }); ctx.restore(); } }] });
      };
      draw();
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
          { id: "wlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 11.5px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ch.getDatasetMeta(0).data.forEach((el, i) => { const d = bars[i]; const v = d[1] - d[0]; ctx.fillStyle = steps[i].type === "total" ? INK : (v >= 0 ? POS : NEG); ctx.fillText((v < 0 ? "-" : "") + money(Math.abs(v)), el.x, Math.min(el.y, ch.scales.y.getPixelForValue(Math.max(d[0], d[1]))) - 3); }); ctx.restore(); } }] });
      return c;
    }
    function funnel(mount, title, sub, stages, opts) {
      opts = opts || {};
      const { c, box, cv } = chartCard(mount, title, sub, { h: 210, span2: opts.span2, icon: KIC.funnel, headVal: opts.headVal, chips: opts.chips });
      if (!stages.length || !stages[0].v) { emptyBox(box); return c; }
      const top = stages[0].v;
      new Chart(cv, { type: "bar", data: { labels: stages.map(s2 => s2.k), datasets: [{ data: stages.map(s2 => s2.v), backgroundColor: stages.map((_, i) => i === stages.length - 1 ? LIME : INK), hoverBackgroundColor: stages.map((_, i) => i === stages.length - 1 ? LIMED : "#34465f"), borderRadius: 4, maxBarThickness: 36 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 110 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => fmtN(x.parsed.x) + ` (${(x.parsed.x / top * 100).toFixed(0)}% of top)` } } }, scales: { x: { display: false, beginAtZero: true, max: top * 1.02 }, y: { ticks: { color: INK2, font: { size: 13.5, weight: "700" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [crosshair, { id: "flab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.textAlign = "left"; ctx.textBaseline = "middle"; ch.getDatasetMeta(0).data.forEach((el, i) => { ctx.font = "800 12px " + MONO; ctx.fillStyle = INK; ctx.fillText(fmtN(stages[i].v), el.x + 6, el.y); if (i > 0) { ctx.font = "700 11.5px " + MONO; ctx.fillStyle = LIMED; ctx.fillText("  " + (stages[i].v / stages[i - 1].v * 100).toFixed(0) + "%", el.x + 6 + ctx.measureText(fmtN(stages[i].v)).width + 4, el.y); } }); ctx.restore(); } }] });
      return c;
    }
    function bullet(mount, title, sub, rows, fmt, target, opts) {
      opts = opts || {};
      // C26/Q5: the benchmark line is the current TEAM AVERAGE, not a management target
      const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, h: Math.max(190, 40 + rows.length * 27), icon: KIC.bars, headVal: "team avg " + fmt(target) });
      if (!rows.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels: rows.map(r => r.k), datasets: [{ data: rows.map(r => r.v), backgroundColor: rows.map(r => r.v >= target ? INK : NEG), hoverBackgroundColor: rows.map(r => r.v >= target ? "#34465f" : "#f0817e"), borderRadius: 4, maxBarThickness: 18 }] },
        options: baseOpts({ indexAxis: "y", layout: { padding: { right: 52 } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => tip(fmt)(x.parsed.x) + " (team avg " + tip(fmt)(target) + ")" } } }, scales: { x: axY(fmt, { beginAtZero: true }), y: { ticks: { color: INK2, font: { size: 12.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
        plugins: [crosshair, valLabels(fmt, true), { id: "tgt", afterDraw(ch) { const x = ch.scales.x.getPixelForValue(target), a = ch.chartArea, ctx = ch.ctx; ctx.save(); ctx.strokeStyle = LIME; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.fillStyle = LIMED; ctx.font = "800 9px " + MONO; ctx.textAlign = "center"; ctx.fillText("team avg " + fmt(target), x, a.top - 2); ctx.restore(); } }] });
      if (opts.note) note(c, opts.note, opts.noteKind);
      return c;
    }
    function stackedTime(mount, title, sub, labels, sets, fmt, opts) {
      opts = opts || {};
      const lastTot = sets.reduce((a, d) => a + (d.data.length ? (d.data[d.data.length - 1] || 0) : 0), 0);
      const { c, box, cv } = chartCard(mount, title, sub, { span2: opts.span2, icon: KIC.trend, headVal: fmt(lastTot) });
      if (!labels.length) { emptyBox(box); return c; }
      new Chart(cv, { type: "bar", data: { labels, datasets: sets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color || CAT[i], borderRadius: 2, maxBarThickness: 26, stack: "s" })) },
        options: baseOpts({ layout: { padding: { top: 18 } }, plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + tip(fmt)(x.parsed.y) } } }, scales: { x: Object.assign(axX(), { stacked: true }), y: Object.assign(axY(fmt, { beginAtZero: true }), { stacked: true }) } }), plugins: [crosshair, { id: "stlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "700 9px " + MONO; ctx.fillStyle = INK; ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ch.getDatasetMeta(0).data.forEach((el, i) => { let tot = 0, topY = Infinity; ch.data.datasets.forEach((d, di) => { const e = ch.getDatasetMeta(di).data[i]; if (e) { tot += (+d.data[i] || 0); topY = Math.min(topY, e.y); } }); if (tot) ctx.fillText(fmt(tot), el.x, topY - 3); }); ctx.restore(); } }] });
      return c;
    }

    /* ---------- tables ---------- */
    function tableCard(mount, title, sub, html, opts) {
      opts = opts || {}; const c = card(mount, title, sub || monLbl, { span2: opts.span2 !== false, icon: opts.icon || KIC.grid, headVal: opts.headVal, chips: opts.chips });
      const w = document.createElement("div"); w.className = "mrx-scroll"; w.innerHTML = html; c.appendChild(w);
      const tbl = w.querySelector("table");
      if (tbl) {
        const foot = document.createElement("div"); foot.style.cssText = "display:flex;justify-content:flex-end;margin-top:9px";
        const xb = document.createElement("button"); xb.type = "button"; xb.className = "mrx-xls"; xb.innerHTML = "⬇ Excel"; xb.title = "Export this table to Excel";
        xb.style.cssText = "background:#0e1621;color:#fff;border:0;border-radius:8px;padding:6px 11px;font:800 10.5px/1 " + MONO + ";letter-spacing:.03em;cursor:pointer";
        xb.onmouseenter = () => xb.style.background = "#1b2a3f"; xb.onmouseleave = () => xb.style.background = "#0e1621";
        xb.onclick = () => exportTableXlsx(tbl, title);
        foot.appendChild(xb); c.appendChild(foot);
      }
      if (opts.note) note(c, opts.note, opts.noteKind); return c;
    }
    const td = (v, style) => `<td${style ? ` style="${style}"` : ""}>${v}</td>`;

    /* ---------- exports: lazy CDN libs · Excel (SheetJS) · real PDF (jsPDF+html2canvas) ---------- */
    function ensureLib(check, url) {
      return new Promise((resolve, reject) => {
        if (check()) return resolve();
        const s = document.createElement("script"); s.src = url; s.async = true;
        s.onload = () => check() ? resolve() : reject(new Error("global missing after " + url));
        s.onerror = () => reject(new Error("failed to load " + url));
        document.head.appendChild(s);
      });
    }
    const XLS_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    const H2C_URL = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
    const JSPDF_URL = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
    function xlsCell(s) {   // coerce "$1,234"/"1,234" → numbers so Excel can sum; keep %, ×, — as text
      const t = String(s == null ? "" : s).trim().replace(/^👑\s*/, "");
      if (t === "" || t === "—" || t === "–") return "";
      // "$1,234 ▲12%" / "97.4 ▲" → strip the trailing MoM-arrow annotation so the value stays NUMERIC;
      // pure-delta cells ("▲ 34%") have no leading digit and pass through as text untouched
      const m2 = t.match(/^(.*\d)\s*[▲▼–]\s*[\d.]*%?$/);
      const core = m2 ? m2[1].trim() : t;
      const n = core.replace(/[$,\s]/g, "");
      if (/^-?\d+(\.\d+)?$/.test(n)) return Number(n);
      return t;
    }
    // Q7: exported headers use FULL words — abbreviations that survive on screen (for space)
    // are mapped to plain English at export time, so the Excel file explains itself.
    const XHEAD = { "CF": "Cubic feet (CF)", "vs Est": "Written vs estimate", "Gross Profit": "Gross profit — revenue minus direct job costs (crew/driver/helper/sales pay, job expenses, refunds)",
      "Qual.": "Qualified (leads created this month, minus bad)", "Conf.": "Confirmed — jobs booked this month (by booked date)", "Ref%": "Refund %", "Dead%": "Bad-lead %",
      "Booking%": "Booking %", "Pay": "Foreman pay" };
    function xlsHead(s) {
      const t = String(s == null ? "" : s).trim();
      if (XHEAD[t]) return XHEAD[t];
      const m = t.match(/^vs '(\d{2})$/); if (m) return "vs 20" + m[1];
      return t;
    }
    async function exportTableXlsx(tbl, title) {
      try {
        await ensureLib(() => window.XLSX, XLS_URL);
        const aoa = [].map.call(tbl.rows, tr => [].map.call(tr.cells, c => c.tagName === "TH" ? xlsHead(c.textContent) : xlsCell(c.textContent)));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        const wch = []; aoa.forEach(r => r.forEach((v, i) => { const l = String(v).length; if (!wch[i] || wch[i] < l) wch[i] = l; }));
        ws["!cols"] = wch.map(w => ({ wch: Math.min(42, Math.max(9, w + 2)) }));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, ((title || "Sheet1").replace(/[^\w ]+/g, "").trim().slice(0, 28)) || "Sheet1");
        XLSX.writeFile(wb, `${(title || "table").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "")}-${MON[mo]}-${curY}.xlsx`);
      } catch (e) { console.error("Excel export failed", e); alert("Excel export failed: " + (e && e.message || e)); }
    }
    async function downloadReportPDF() {
      const btn = document.getElementById("mrPrint"); const rt = document.querySelector(".mrx");
      if (!rt) return; const label = btn ? btn.innerHTML : "";
      const hidden = [].slice.call(rt.querySelectorAll(".mrx-print,.mrx-xls,.mrx-caret,.mrx-code,.mrx-ctl,.mrx-toc,.mrx-btoggle,.mrx-info,.mrx-loaderr"));
      const collapsed = [].slice.call(rt.querySelectorAll(".mrx-sec.collapsed"));
      // full-screen scrim: the build mutates the DOM for ~10s (expands sections, swaps canvases) —
      // without it the page looks broken and a stray click mid-build corrupts the capture.
      const scrim = document.createElement("div");
      scrim.style.cssText = "position:fixed;inset:0;z-index:9999;background:rgba(10,14,20,.55);display:flex;align-items:center;justify-content:center";
      scrim.innerHTML = `<div style="background:#fff;color:#0e1621;font:700 14px/1.5 system-ui;padding:18px 26px;border-radius:12px;box-shadow:0 12px 40px rgba(0,0,0,.35);max-width:340px;text-align:center">⏳ Building the PDF…<div class="mrx-pdfprog" style="margin-top:6px;font-weight:600;color:#5b6572;font-size:12.5px">The page will flicker for a few seconds — don't click.</div></div>`;
      document.body.appendChild(scrim);
      const prog = scrim.querySelector(".mrx-pdfprog");
      try {
        if (btn) { btn.innerHTML = "⏳ Building PDF…"; btn.disabled = true; }
        await ensureLib(() => window.html2canvas, H2C_URL);
        await ensureLib(() => (window.jspdf && window.jspdf.jsPDF) || window.jsPDF, JSPDF_URL);
        const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        collapsed.forEach(s => s.classList.remove("collapsed"));
        hidden.forEach(e => { e.__pd = e.style.display; e.style.display = "none"; });
        await new Promise(r => setTimeout(r, 180));
        const pdf = new JsPDF({ unit: "pt", format: "a4", orientation: "portrait", compress: true });
        const pageW = pdf.internal.pageSize.getWidth(), pageH = pdf.internal.pageSize.getHeight();
        const M = 20, cW = pageW - M * 2;
        const blocks = [];
        const cov = rt.querySelector(".mrx-cover"); if (cov) blocks.push(cov);
        const ban = rt.querySelector(".mrx-bwrap"); if (ban) blocks.push(ban);
        [].slice.call(rt.querySelectorAll(".mrx-parth,.mrx-sec")).forEach(s => blocks.push(s));
        let y = M, bi = 0;
        for (const el of blocks) {
          bi++; if (btn) btn.innerHTML = `⏳ Building… ${bi}/${blocks.length}`;   // C50: live progress
          if (prog) prog.textContent = `Rendering section ${bi} of ${blocks.length}…`;
          // swap live chart canvases → static images so html2canvas captures them reliably
          const swaps = [];
          [].slice.call(el.querySelectorAll("canvas")).forEach(cv => {
            try { const im = document.createElement("img"); im.src = cv.toDataURL("image/png"); const w = cv.clientWidth, h = cv.clientHeight; im.style.width = w + "px"; im.style.height = h + "px"; cv.style.display = "none"; cv.parentNode.insertBefore(im, cv.nextSibling); swaps.push([cv, im]); } catch (e) {}
          });
          let canvas;
          try { canvas = await html2canvas(el, { scale: 2, backgroundColor: "#f4f6fa", useCORS: true, logging: false, windowWidth: rt.scrollWidth }); }
          finally { swaps.forEach(p => { p[1].remove(); p[0].style.display = ""; }); }
          const sc = cW / canvas.width;                                   // canvas-px → pt
          const rTop = el.getBoundingClientRect().top;
          const pxScale = canvas.height / el.getBoundingClientRect().height;  // css-px → canvas-px
          const rowBot = {};                                              // row bottoms (avoid cutting a card)
          [].slice.call(el.querySelectorAll(".mrx-card,.mrx-kpi,.mrx-exec")).forEach(cd => { const r = cd.getBoundingClientRect(); const key = Math.round((r.top - rTop) / 12); const b = (r.bottom - rTop) * pxScale; if (!rowBot[key] || rowBot[key] < b) rowBot[key] = b; });
          const breaks = Object.keys(rowBot).map(k => rowBot[k]).concat([canvas.height]).sort((a, b) => a - b);
          let sy = 0;
          while (sy < canvas.height - 1) {
            let availPt = pageH - M - y;
            if (availPt < 70) { pdf.addPage(); y = M; availPt = pageH - M - y; }
            let cut = sy + availPt / sc;
            if (cut < canvas.height) { const fit = breaks.filter(b => b > sy + 10 && b <= cut); if (fit.length) cut = fit[fit.length - 1]; }
            else cut = canvas.height;
            const sliceH = Math.max(1, Math.round(cut - sy));
            const sl = document.createElement("canvas"); sl.width = canvas.width; sl.height = sliceH;
            sl.getContext("2d").drawImage(canvas, 0, sy, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
            const hPt = sliceH * sc;
            pdf.addImage(sl.toDataURL("image/jpeg", 0.92), "JPEG", M, y, cW, hPt);
            y += hPt + 4; sy = cut;
          }
          y += 8;
        }
        const np = pdf.internal.getNumberOfPages();
        for (let i = 1; i <= np; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(150); pdf.text(`Zip to Zip · ${PDF_NAME} · ${MON[mo]} ${curY} · ${i}/${np}`, pageW / 2, pageH - 8, { align: "center" }); }
        console.log("PDF_OK pages=" + np);
        pdf.save(`Zip-to-Zip-${PDF_NAME.replace(/\s+/g, "-")}-${MON[mo]}-${curY}.pdf`);
      } catch (e) { console.error("PDF generation failed", e); alert("PDF generation failed: " + (e && e.message || e)); }
      finally {
        scrim.remove();   // NEVER leave a full-screen overlay behind (the .rp-scrim lesson)
        collapsed.forEach(s => s.classList.add("collapsed"));
        hidden.forEach(e => { e.style.display = e.__pd != null ? e.__pd : ""; });
        if (btn) { btn.innerHTML = label; btn.disabled = false; }
      }
    }

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
    // destroy this page's previous Chart instances BEFORE wiping the DOM — otherwise ~70 zombie
    // charts leak on every month switch / re-render and the session slowly degrades
    Object.values(Chart.instances || {}).forEach(ch => { try { if (ch.canvas && host.contains(ch.canvas)) ch.destroy(); } catch (e) {} });
    host.innerHTML = "";
    const root = document.createElement("div"); root.className = "mrx"; host.appendChild(root);
    // Q3/C43: the year picker lists the years the closing data actually covers (oldest→newest,
    // no empty future year); the selected year is always offered even if it has no rows yet.
    const dataYears = [...new Set(closing.filter(r => coRow(r) && r._y >= "2000").map(r => +r._y))];
    if (dataYears.indexOf(curY) < 0) dataYears.push(curY);
    const yearOpts = dataYears.filter(y => y <= new Date().getFullYear()).sort((a, b) => a - b);
    const monthOptions = MON.slice(1).map((m, i) => `<option value="${i + 1}"${i + 1 === mo ? " selected" : ""}>${m}</option>`).join("");
    const yearOptions = yearOpts.map(y => `<option${y === curY ? " selected" : ""}>${y}</option>`).join("");
    const LITE = !!(MRCFG && MRCFG.lite);
    // Data-feed failure banner — LOUD and first. A feed that failed all retries means the
    // page below is missing data (and composites like Gross Profit would read wrong), so
    // say it plainly instead of letting anyone trust a half-loaded report.
    if (loadFailures.length) {
      const eb = document.createElement("div"); eb.className = "mrx-loaderr";
      eb.innerHTML = `<span><b>⚠ ${loadFailures.length} data feed${loadFailures.length > 1 ? "s" : ""} failed to load:</b> ${esc(loadFailures.join(", "))}.
        The numbers below are <b>incomplete</b> — retry before reading this report.</span>
        <button type="button" class="mrx-xls" id="mrRetryLoad">↻ Retry now</button>`;
      root.appendChild(eb);
    }
    if (LITE) {
      // themed dashboards: a compact header (topic title + month/year selector) — no hero, no PDF.
      const hdr = document.createElement("div"); hdr.className = "mrx-lite-h";
      hdr.innerHTML = `<div class="mrx-lite-tt"><b>Monthly · Zip to Zip</b>${esc(MRCFG.title || TEAM || "Monthly Review")}</div>
        <div class="mrx-lite-ctl">Month: <select id="mrMonth">${monthOptions}</select> Year: <select id="mrYear">${yearOptions}</select></div>`;
      root.appendChild(hdr);
    } else {
      const cover = document.createElement("div"); cover.className = "mrx-cover";
      // UX audit 2026-07-14: the Month/Year picker is the page's PRIMARY control — promoted
      // out of the fine print into its own block, with a vector-print secondary action.
      cover.innerHTML = `
        <div class="mrx-accent"></div>
        <div class="mrx-cvactions">
          <button class="mrx-print" id="mrPrint" title="Download a polished PDF (no print dialog)">⬇ Download PDF</button>
          <button class="mrx-print2" id="mrPrint2" title="Browser print — selectable text">🖨 Print</button>
        </div>
        <div class="mrx-eyebrow">${esc(TEAM ? TEAM + " — Monthly Review" : "Monthly Business Review")} · Zip to Zip</div>
        <div class="mrx-h1">Report for ${MON[mo]} ${curY}</div>
        <div class="mrx-cvpick">
          <select id="mrMonth" class="mrx-ctl">${monthOptions}</select>
          <select id="mrYear" class="mrx-ctl">${yearOptions}</select>
        </div>
        <div class="mrx-cvsub">${esc(freshness)} · Zip to Zip only</div>`;
      root.appendChild(cover);
    }

    // completeness banner — closings awaiting return (blank Net Cash), with an expandable job list
    const pendRows = (reduceMonth("closing", curY, mo, rs => rs.filter(r => blank(r["Net Cash"]))) || []).slice().sort((a, b) => String(a.Date).localeCompare(String(b.Date)));
    const pend = pendRows.length;
    const totClose = reduceMonth("closing", curY, mo, rs => rs.length) || 0;
    // In lite mode the banner only rides along on dashboards that actually show revenue/profit
    // (so fin-revenue keeps the data-completeness honesty note; Claims/Reviews stay clean).
    const bannerRelevant = !LITE || SEC("Executive Summary") || SEC("Revenue & Growth") || SEC("Profitability & P&L");
    if (bannerRelevant && pend > 0 && totClose > 0) {
      const rptPctVal = ((totClose - pend) / totClose * 100).toFixed(0);
      const wrap = document.createElement("div"); wrap.className = "mrx-bwrap";
      const b = document.createElement("div"); b.className = "mrx-banner";
      b.innerHTML = `<span class="bic">${KIC.warn}</span><span class="mrx-bmsg"><b>${pend}</b> of <b>${totClose}</b> ${MON[mo]} jobs haven't had their closing paperwork turned in yet, so ${MON[mo]}'s revenue and profit are still incomplete (<b>~${rptPctVal}%</b> of jobs counted) and will grow as sheets come in.</span><span class="mrx-btoggle">▸ view the ${pend} jobs</span>`;
      const detail = document.createElement("div"); detail.className = "mrx-bdetail"; detail.style.display = "none";
      const rowsH = pendRows.map(r => `<tr><td>${esc(String(r.Date || "").slice(0, 10))}</td><td>${esc(r.Customer || "—")}</td><td>${esc(String(r["Request #"] || "—"))}</td><td>${esc(r["Sales Person"] || "—")}</td><td>${esc(r.Foreman || "—")}</td></tr>`).join("");
      detail.innerHTML = `<div class="mrx-scroll"><table class="mrx-tbl"><thead><tr><th>Move date</th><th>Customer</th><th>Request #</th><th>Sales person</th><th>Foreman</th></tr></thead><tbody>${rowsH}</tbody></table></div>`;
      // this list IS a to-do (chase the paperwork) — let it leave the page as a worklist
      const bx = document.createElement("button"); bx.type = "button"; bx.className = "mrx-xls"; bx.textContent = "⬇ Excel — chase list";
      bx.onclick = () => exportTableXlsx(detail.querySelector("table"), "Pending closings chase list");
      detail.appendChild(bx);
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
    // Confirmed = jobs BOOKED this month (Booked Date), matching the canonical
    // Booking Rate — NOT create date. Feeds the Confirmed KPI + the funnel bar.
    // (create-date confirmed understated it, e.g. June ZtZ 429 vs booked 499.)
    const conf = bookedRowsFor(curY, mo).filter(r => r["Status Category"] === "Confirmed").length;
    const qual = valueFor("moveboard", "Qualified Leads", curY, mo);
    const margin = rev ? op / rev : null, marginLY = revLY ? opLY / revLY : null, marginPM = revPM ? opPM / revPM : null;
    const avgJob = jobs ? rev / jobs : null, avgJobLY = jobsLY ? revLY / jobsLY : null, avgJobPM = jobsPM ? revPM / jobsPM : null;
    const revWritten = reduceMonth("reviews_breakdown", curY, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenLY = reduceMonth("reviews_breakdown", curY - 1, mo, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    const revWrittenPM = reduceMonth("reviews_breakdown", PMY, PM, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)) || 0;
    /* Review goals are END-OF-PERIOD targets (Tornike 2026-07-14): a fct_review_goals row
       dated 2026-09-01 means "by the END OF AUGUST the public review footprint
       (fct_review_counts, cumulative per platform) must total these numbers". They are
       NOT monthly written-review quotas — so the written-reviews tiles stay plain and the
       goal renders as a progress card (footprint now vs the next period-end target). */
    const goalRows = (DS.review_goals || []).filter(coRow);
    const goalDates = [...new Set(goalRows.map(r => String(r.Date || "").slice(0, 10)).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)))].sort();
    const monthEndKey = `${curY}-${String(mo).padStart(2, "0")}-31`;
    const goalNext = goalDates.find(d => d > monthEndKey) || null;                       // the period this month belongs to
    const goalPast = goalNext ? null : (goalDates.filter(d => d <= monthEndKey).pop() || null);
    const goalDate = goalNext || goalPast;                                               // fall back to the last finished period

    /* shared across sections (R&R + Marketing) — the op-profit composite is the page's priciest
       measure, compute the current-month by-Source split ONCE (pre-refund per segment; disclosed
       wherever shown). Lives up here so section order can change freely. */
    const opBySrcCur = segSeries("closing", "Operational Profit by Formula", "Source");

    /* ---- per-department KPI header ----
       One `mrx-grid k` strip at the very top of a TEAM view's sections area (never on the full
       report; Financial is skipped because it already opens with the full Executive Summary).
       Every tile is null-guarded so a metric that can't be computed shows "—" and never throws. */
    function deptHeader(root, id) {
      const showN = (n, f) => (n == null || isNaN(n)) ? "—" : f(n);
      const tiles = [];
      if (id === "sales-team") {
        tiles.push(
          { l: "Leads", v: showN(leadsN, fmtN), c: leadsN, ly: leadsLY, pm: leadsPM, icon: KIC.funnel, hero: 1 },
          { l: "Booking Rate", v: showN(bk, pct), c: bk, ly: bkLY, pm: bkPM, icon: KIC.check },
          { l: "Confirmed", v: showN(conf, fmtN), c: conf, icon: KIC.check },
          { l: "Revenue", v: showN(rev, money), c: rev, ly: revLY, pm: revPM, icon: KIC.dollar },
          { l: "Avg Job Value", v: showN(avgJob, money), c: avgJob, ly: avgJobLY, pm: avgJobPM, icon: KIC.tag }
        );
      } else if (id === "marketing-team") {
        // ad spend with the same ~1-month posting-lag fallback the Marketing section uses; blended
        // ROAS = paid-source revenue ÷ paid-source ad spend (post-card variants pooled, like the section).
        const adMonth = (y, m) => reduceMonth("card_expenses", y, m, rs => rs.filter(r => Number(r["Is Advertising"]) === 1).reduce((a, r) => a + num(r.Amount), 0)) || 0;
        let adY = curY, adM = mo, adSpend = adMonth(curY, mo);
        if (!adSpend) { adY = PMY; adM = PM; adSpend = adMonth(PMY, PM); }
        const normSrc = s => /post\s*card/i.test(String(s)) ? "Post Card" : (blank(s) ? "—" : String(s));
        const adBySrc = {}; (reduceMonth("card_expenses", adY, adM, rs => rs.filter(r => Number(r["Is Advertising"]) === 1)) || []).forEach(r => { const k = normSrc(r.Source); adBySrc[k] = (adBySrc[k] || 0) + num(r.Amount); });
        const revBySrc = {}; segSeries("closing", "Revenue", "Source", adY, adM).forEach(r => { const k = normSrc(r.k); revBySrc[k] = (revBySrc[k] || 0) + r.v; });
        let paidSpend = 0, paidRev = 0; Object.keys(adBySrc).forEach(k => { if (k !== "—" && adBySrc[k] > 0) { paidSpend += adBySrc[k]; paidRev += revBySrc[k] || 0; } });
        const roas = paidSpend ? paidRev / paidSpend : null;
        tiles.push(
          { l: "Ad Spend", v: adSpend ? money(adSpend) : "—", c: adSpend || null, icon: KIC.dollar, hero: 1 },
          { l: "ROAS", v: roas == null ? "—" : roas.toFixed(1) + "×", c: roas, icon: KIC.trend },
          { l: "Cost per Job", v: (adSpend && jobs) ? money(adSpend / jobs) : "—", c: (adSpend && jobs) ? adSpend / jobs : null, icon: KIC.truck, inv: 1 },
          { l: "Leads", v: showN(leadsN, fmtN), c: leadsN, ly: leadsLY, pm: leadsPM, icon: KIC.funnel },
          { l: "Cost per Lead", v: (adSpend && leadsN) ? money(adSpend / leadsN) : "—", c: (adSpend && leadsN) ? adSpend / leadsN : null, icon: KIC.pct, inv: 1 }
        );
      } else if (id === "logistics-team") {
        const foremanHours = reduceMonth("closing", curY, mo, rs => rs.reduce((a, r) => a + num(r["Foreman Hours"]), 0)) || 0;
        const jobsPer100h = foremanHours ? 100 * (jobs || 0) / foremanHours : null;
        const scMo = (DS.scorecard || []).filter(r => String(r["Month"] || "").slice(0, 7) === `${curY}-${String(mo).padStart(2, "0")}`);
        const totCF = scMo.reduce((a, r) => a + num(r["Total CF"]), 0), totWr = scMo.reduce((a, r) => a + num(r["Total Packing Written"]), 0);
        const pack100 = totCF ? totWr / totCF * 100 : null;
        const ffClaims = reduceMonth("claims", curY, mo, rs => rs.filter(r => /forman/i.test(String(r.Responsibility || ""))).length) || 0;
        tiles.push(
          { l: "Jobs Done", v: showN(jobs, fmtN), c: jobs, icon: KIC.truck, hero: 1 },
          { l: "Foreman Hours", v: foremanHours ? fmtN(foremanHours) : "—", c: foremanHours || null, icon: KIC.trend },
          { l: "Jobs / 100h", v: jobsPer100h == null ? "—" : fmt1(jobsPer100h), c: jobsPer100h, icon: KIC.pct },
          { l: "Packing $ / 100 CF", v: pack100 == null ? "—" : money(pack100), c: pack100, icon: KIC.bars },
          { l: "Foreman-Fault Claims", v: fmtN(ffClaims), c: ffClaims, icon: KIC.warn, inv: 1 }
        );
      } else if (id === "reviews-team") {
        const counted = valueFor("reviews_breakdown", "Counted Reviews Written", curY, mo);
        const factual = valueFor("review_counts", "Total Factual Reviews", curY, mo);
        const score = valueFor("reviews_breakdown", "Review Score (avg)", curY, mo);
        tiles.push(
          { l: "Reviews Written", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, icon: KIC.star, hero: 1 },
          { l: "Counted Reviews", v: showN(counted, fmtN), c: counted, icon: KIC.check },
          { l: "Factual Reviews", v: showN(factual, fmtN), c: factual, icon: KIC.grid },
          { l: "Review Score", v: (score == null || isNaN(score)) ? "—" : Number(score).toFixed(2), c: score, icon: KIC.pct }
        );
      } else if (id === "support-team") {
        const claimsN = reduceMonth("claims", curY, mo, rs => rs.length) || 0;
        const claimRate = jobs ? claimsN / jobs * 100 : null;
        const refTot = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
        const rcB = rcAgg[`${curY}-${String(mo).padStart(2, "0")}`];
        const ansRate = rcB && rcB.in ? rcB.ans / rcB.in : null;
        const missed = rcB ? (rcB.miss + rcB.vm) : null;   // explicit Missed + Voicemail (session grain)
        tiles.push(
          { l: "Claims Filed", v: fmtN(claimsN), c: claimsN, icon: KIC.warn, hero: 1, inv: 1 },
          { l: "Claims / 100 jobs", v: claimRate == null ? "—" : fmt1(claimRate), c: claimRate, icon: KIC.pct, inv: 1 },
          { l: "Refunds Paid", v: money(refTot), c: refTot, icon: KIC.dollar, inv: 1 },
          { l: "Answer Rate", v: ansRate == null ? "—" : pct(ansRate), c: ansRate, icon: KIC.check },
          { l: "Missed Calls", v: missed == null ? "—" : fmtN(missed), c: missed, icon: KIC.warn, inv: 1 }
        );
      }
      if (!tiles.length) return;
      const kg = document.createElement("div"); kg.className = "mrx-grid k"; kg.style.gridColumn = "1/-1";
      bodyEl.appendChild(kg);
      tiles.forEach(k => kpiTile(kg, k));
    }
    // deptHeader (the per-team KPI strip) is retired with the old team views — themed
    // dashboards use lite mode and never call it. Function left defined but unused.

    part(1, "The month at a glance", "headline numbers and the executive read");

    /* ---- 01 · Executive Summary ---- */
    if (SEC("Executive Summary")) {
      const g = section("Executive Summary", monLbl + " · vs last year & last month", "k");
      [
        { l: "Revenue", v: money(rev), c: rev, ly: revLY, pm: revPM, spk: momSeries("closing", "Revenue", 12), icon: KIC.dollar, hero: 1 },
        { l: "Gross Profit", v: money(op), c: op, ly: opLY, pm: opPM, spk: momSeries("closing", "Operational Profit by Formula", 12), icon: KIC.trend },
        { l: "Gross Margin", v: pct(margin), c: margin, ly: marginLY, pm: marginPM, spk: momSeries("closing", "Operational Profit Margin", 12), icon: KIC.pct },
        { l: "Jobs Done", v: fmtN(jobs), c: jobs, ly: jobsLY, pm: jobsPM, spk: momSeries("closing", "Total Jobs", 12), icon: KIC.truck },
        { l: "Leads", v: fmtN(leadsN), c: leadsN, ly: leadsLY, pm: leadsPM, spk: momSeries("moveboard", "Total Leads", 12), icon: KIC.funnel },
        { l: "Booking Rate", v: pct(bk), c: bk, ly: bkLY, pm: bkPM, spk: momSeries("moveboard", "Booking Rate", 12), icon: KIC.check },
        { l: "Avg Job Value", v: money(avgJob), c: avgJob, ly: avgJobLY, pm: avgJobPM, spk: momReduce("closing", 12, rs => { const b = M["Revenue"].fn(rs), j = rs.length; return j ? b / j : null; }), icon: KIC.tag },
        { l: "All Reviews Written (incl. non-counting)", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, spk: momReduce("reviews_breakdown", 12, rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0)), icon: KIC.star }
      ].forEach(k => kpiTile(g, k));
      const gpRev = revLY ? (rev - revLY) / Math.abs(revLY) : 0;
      const tone = gpRev > 0.08 ? "A strong" : gpRev < -0.05 ? "A softer" : "A steady";
      // UX audit 2026-07-14: the verdict is MULTI-SIGNAL (all 8 headline pairs scored, not
      // just revenue), names what to WATCH, and is honest about data completeness.
      const pairs = [["Revenue", rev, revLY, 0], ["Gross profit", op, opLY, 0], ["Gross margin", margin, marginLY, 0],
        ["Jobs", jobs, jobsLY, 0], ["Leads", leadsN, leadsLY, 0], ["Booking rate", bk, bkLY, 0],
        ["Avg job value", avgJob, avgJobLY, 0], ["Reviews", revWritten, revWrittenLY, 0]];
      const scored = pairs.filter(p => p[1] != null && p[2] != null && p[2] !== 0);
      const ups = scored.filter(p => p[1] >= p[2]).length;
      const downs = scored.filter(p => p[1] < p[2])
        .sort((a, b) => ((a[1] - a[2]) / Math.abs(a[2])) - ((b[1] - b[2]) / Math.abs(b[2]))).slice(0, 2);
      const watch = downs.length ? ` <b>Watch:</b> ${downs.map(p => `${p[0]} ${((p[1] - p[2]) / Math.abs(p[2]) * 100).toFixed(0)}%`).join(", ")} vs last ${MON[mo]}.` : "";
      const incomplete = (pend > 0 && totClose > 0 && pend / totClose > 0.05)
        ? ` <b>⚠ ${pct(pend / totClose)} of ${MON[mo]}'s jobs aren't counted yet</b> (paperwork pending) — these numbers will grow.` : "";
      const ex = document.createElement("div"); ex.className = "mrx-exec"; ex.style.gridColumn = "1/-1";
      // C16: no false causality — jobs (by move date) and leads (by create date) are two
      // different cohorts, so they are stated as separate facts with a date-basis footnote.
      ex.innerHTML = `<b>${tone} ${MON[mo]} ${curY} — ${scored.length ? `${ups} of ${scored.length} headline numbers improved vs last year.` : ""}</b> Revenue ${money(rev)} (${gpRev >= 0 ? "+" : ""}${(gpRev * 100).toFixed(0)}% YoY), gross profit ${money(op)} at ${pct(margin)} margin. ${fmtN(jobs)} jobs completed; ${fmtN(leadsN)} new leads came in, booking at ${pct(bk)}.${watch}${incomplete}${revTrip ? ` Standalone trips added ${money(revTrip)} (${(tripShare * 100).toFixed(1)}%).` : ""}
        <div style="margin-top:8px;font-size:11.5px;color:#93a0b2;font-weight:600">YoY = vs the same month last year · MoM = vs the previous month · money &amp; jobs count by move date · leads count by the date the lead came in.</div>`;
      g.appendChild(ex);

      /* ---- "What changed most in {Month}" — automatic movers panel (UX audit's #1 ask).
         Top movers by absolute $ (or point) impact vs the PREVIOUS month, across fixed
         dimensions. Plain sentences, no chart — the report's decision layer. */
      if (revPM != null) {
        const movers = [];
        const mapOf = arr => { const m2 = {}; arr.forEach(r => m2[r.k] = r.v); return m2; };
        const addDim = (dimLabel, curArr, prevArr) => {
          const c2 = mapOf(curArr), p2 = mapOf(prevArr);
          [...new Set([...Object.keys(c2), ...Object.keys(p2)])].forEach(k => {
            if (k === "—") return;
            const d = (c2[k] || 0) - (p2[k] || 0);
            if (Math.abs(d) >= 8000) movers.push({ txt: `${esc(k)} ${dimLabel} ${d >= 0 ? "grew" : "fell"} <b>${d >= 0 ? "+" : "−"}${money(Math.abs(d))}</b> vs ${MS[PM]} (now ${money(c2[k] || 0)})`, w: Math.abs(d), up: d >= 0 });
          });
        };
        addDim("revenue", segSeries("closing", "Revenue", "Source"), segSeries("closing", "Revenue", "Source", PMY, PM));
        addDim("revenue", segSeries("closing", "Revenue", "Moving Type"), segSeries("closing", "Revenue", "Moving Type", PMY, PM));
        const refCurM = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
        const refPrevM = Math.abs(reduceMonth("refunds", PMY, PM, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
        if (Math.abs(refCurM - refPrevM) >= 3000) movers.push({ txt: `Refunds ${refCurM >= refPrevM ? "rose" : "dropped"} <b>${refCurM >= refPrevM ? "+" : "−"}${money(Math.abs(refCurM - refPrevM))}</b> vs ${MS[PM]} (now ${money(refCurM)})`, w: Math.abs(refCurM - refPrevM) * 2, up: refCurM < refPrevM });
        if (bk != null && bkPM != null && Math.abs(bk - bkPM) >= 0.02) movers.push({ txt: `Booking rate moved <b>${bk >= bkPM ? "+" : "−"}${Math.abs((bk - bkPM) * 100).toFixed(1)}pt</b> to ${pct(bk)}`, w: Math.abs(bk - bkPM) * 900000, up: bk >= bkPM });
        movers.sort((a, b) => b.w - a.w);
        if (movers.length) {
          const mc = card(g, "What changed most in " + MON[mo], "vs " + MS[PM] + " · top movers by $ impact", { span2: true, icon: KIC.trend });
          const listEl = document.createElement("div");
          listEl.style.cssText = "display:flex;flex-direction:column;gap:7px;font-size:13.5px;line-height:1.5";
          listEl.innerHTML = movers.slice(0, 5).map(m2 =>
            `<div><span style="font-weight:800;color:${m2.up ? POS : NEG}">${m2.up ? "▲" : "▼"}</span> ${m2.txt}</div>`).join("");
          mc.appendChild(listEl);
        }
      }
    }

    part(2, "The money", "revenue, mix, unit economics and profit");

    /* ---- 02 · Revenue & Growth ---- */
    if (SEC("Revenue & Growth")) {
      const g = section("Revenue & Growth", "5-year " + MON[mo] + " trend and 12-month momentum");
      const revT = trendSeries("closing", "Revenue"), opT = trendSeries("closing", "Operational Profit by Formula"), jobT = trendSeries("closing", "Total Jobs");
      lines(g, "Revenue & Profit — momentum", "last 12 months", [ { label: "Revenue", series: momSeries("closing", "Revenue", 12), color: INK }, { label: "Gross Profit", series: momSeries("closing", "Operational Profit by Formula", 12), color: BLUE } ], moneyC, { span2: true, headVal: money(rev), chips: dchips([[rev, revPM, "MoM"]]) });
      yoyBars(g, "Total Revenue", revT, moneyC, { headVal: money(rev), chips: dchips([[rev, revLY, "YoY"], [rev, revPM, "MoM"]]) });
      const c1 = yoyBars(g, "Gross Profit", opT, moneyC, { yoyPct: true, headVal: money(op), chips: dchips([[op, opLY, "YoY"], [op, opPM, "MoM"]]) }); note(c1, trendInsight("Gross Profit", opT, money, MON[mo]));
      const c2 = yoyBars(g, "Jobs Done", jobT, fmtN, { headVal: fmtN(jobs), chips: dchips([[jobs, jobsLY, "YoY"], [jobs, jobsPM, "MoM"]]) }); note(c2, trendInsight("Jobs Done", jobT, fmtN, MON[mo]));
      // N17: these are confirmed LEADS, not completed jobs — "jobs" is reserved for closings
      // Confirmed counted by BOOKED date (bookedRowsFor) so the line is consistent with the
      // booked-date Booking Rate on the same chart (was create-date via trendSeries).
      const confT = yearsArr().map(y => ({ k: String(y), v: bookedRowsFor(y, mo).filter(r => r["Status Category"] === "Confirmed").length }));
      const bkT = trendSeries("moveboard", "Booking Rate");
      combo(g, "Leads Confirmed & Booking Rate", MON[mo] + " · " + confT.length + "-yr", confT, "Confirmed leads", fmtN, bkT, "Booking %", pct, { headVal: pct(bk) });
      // ---- Local vs Long-distance — ONE head-to-head view (UX audit: was 8 mirrored cards
      // saying the same thing four ways; now a grouped 5-yr revenue chart + a compact matrix) ----
      const isLocal = r => String(r["Moving Type"]) === "Local Moving";
      const notLocal = r => !isLocal(r);
      const localT = trendSeries("closing", "Revenue", { pre: isLocal });
      const ldT = trendSeries("closing", "Revenue", { pre: notLocal });
      {
        // drop years empty on BOTH sides (pre-2023 cutoff yields 0s, not nulls) — no hollow slots
        const yrs = localT.map((r, i) => ({ k: r.k, loc: r.v, ld: (ldT[i] || {}).v })).filter(r => r.loc || r.ld);
        const labs = yrs.map(r => r.k);
        const { c: cLL, cv: cvLL } = chartCard(g, "Local vs Long-distance — revenue", MON[mo] + " · " + labs.length + "-yr head-to-head", { h: 230, icon: KIC.bars, headVal: money(lastV(localT)) });
        new Chart(cvLL, { type: "bar", data: { labels: labs, datasets: [
          { label: "Local Moving", data: yrs.map(r => r.loc), backgroundColor: LIME, borderRadius: 3, maxBarThickness: 30 },
          { label: "Long-distance", data: yrs.map(r => r.ld), backgroundColor: INK, borderRadius: 3, maxBarThickness: 30 } ] },
          options: baseOpts({ plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.parsed.y) } } },
            scales: { y: axY(moneyC, { beginAtZero: true }), x: { ticks: { color: INK2, font: { size: 12.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }), plugins: [crosshair] });
        note(cLL, `Hourly “Local Moving” (the volume base) vs flat-rate long-distance (“Regular” + “Straight”), same month each year.`, "how");
      }
      // the matrix: every Local/LD number that used to be its own card, with YoY inline.
      // op profit by segment must be segKeys-scoped (composite measure) → group by Moving Type per year.
      // NOTE: refunds can't be attributed to a segment (no clean refund→job mapping: ~7% of refund $ don't
      // match a closing job and some join-keys span both moving types) — so segment op-profit is BEFORE refunds.
      const opSplitT = yearsArr(5).map(y => { let loc = 0, ld = 0; segSeries("closing", "Operational Profit by Formula", "Moving Type", y, mo).forEach(s2 => { if (s2.k === "Local Moving") loc += s2.v; else ld += s2.v; }); return { k: String(y), loc, ld }; });
      const refCur = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      {
        const at = (t, off) => (t.length >= off ? t[t.length - off] : {}).v;
        const locRev = lastV(localT), locRevLY = at(localT, 2), ldRev = lastV(ldT), ldRevLY = at(ldT, 2);
        const locJobsT = trendSeries("closing", "Total Jobs", { pre: isLocal }), ldJobsT = trendSeries("closing", "Total Jobs", { pre: notLocal });
        const locJ = lastV(locJobsT), locJLY = at(locJobsT, 2), ldJ = lastV(ldJobsT), ldJLY = at(ldJobsT, 2);
        const opL = (opSplitT[opSplitT.length - 1] || {}).loc, opLLY = (opSplitT[opSplitT.length - 2] || {}).loc;
        const opD = (opSplitT[opSplitT.length - 1] || {}).ld, opDLY = (opSplitT[opSplitT.length - 2] || {}).ld;
        const cell = (cur2, prev2, f) => {
          if (cur2 == null) return td("—");
          if (prev2 == null || !prev2) return td(f(cur2));
          const d = (cur2 - prev2) / Math.abs(prev2);
          return td(`${f(cur2)} <span style="color:${d >= 0 ? POS : NEG};font-weight:800;font-size:11px">${d >= 0 ? "▲" : "▼"}${Math.abs(d * 100).toFixed(0)}%</span>`);
        };
        const rowsH = [
          `<tr><td style="font-weight:800">Revenue</td>${cell(locRev, locRevLY, money)}${cell(ldRev, ldRevLY, money)}${td(locRev + ldRev ? pct(ldRev / (locRev + ldRev)) : "—")}</tr>`,
          `<tr><td style="font-weight:800">Jobs</td>${cell(locJ, locJLY, fmtN)}${cell(ldJ, ldJLY, fmtN)}${td(locJ + ldJ ? pct(ldJ / (locJ + ldJ)) : "—")}</tr>`,
          `<tr><td style="font-weight:800">Avg job value</td>${cell(locJ ? locRev / locJ : null, locJLY ? locRevLY / locJLY : null, money)}${cell(ldJ ? ldRev / ldJ : null, ldJLY ? ldRevLY / ldJLY : null, money)}${td("")}</tr>`,
          `<tr><td style="font-weight:800">Gross profit*</td>${cell(opL, opLLY, money)}${cell(opD, opDLY, money)}${td(opL + opD ? pct(opD / (opL + opD)) : "—")}</tr>`
        ].join("");
        const tc = tableCard(g, "Local vs Long-distance — the numbers", MON[mo] + " " + curY + " · YoY vs " + MON[mo] + " " + (curY - 1),
          `<table class="mrx-tbl"><thead><tr><th></th><th>Local Moving</th><th>Long-distance</th><th>LD share</th></tr></thead><tbody>${rowsH}</tbody></table>`,
          { icon: KIC.grid });
        note(tc, `*Segment gross profit is before refunds — refunds can't be tied to a moving type, so Local + Long-distance together sit ${refCur ? money(refCur) + " " : ""}above the headline Gross Profit.`, "how");
      }
      // (LD carrier-economics cards REMOVED — Tornike 2026-07-14: "I don't need this long
      //  distance to carrier thing at all". `Total To Carrier` was also filled on ~1 job/month,
      //  so the cards claimed ~98% self-haul from a column nobody maintains.)
    }

    /* ---- 03 · Composition & Segments ---- */
    if (SEC("Revenue Composition & Segments")) {
      const g = section("Revenue Composition & Segments", "how revenue splits this month");
      // Revenue by moving type, opened up: each bar IS the revenue, split into the op-profit
      // portion (lime) and the field-cost portion (ink). End label = revenue · margin.
      const mtRev = segSeries("closing", "Revenue", "Moving Type");
      const mtOpM = {}; segSeries("closing", "Operational Profit by Formula", "Moving Type").forEach(r => mtOpM[r.k] = r.v);
      const mtRows = mtRev.slice(0, 6).map(r => { const op2 = Math.max(0, mtOpM[r.k] || 0); return { k: r.k, rev: r.v, op: Math.min(op2, r.v), cost: Math.max(0, r.v - op2) }; });
      {
        const { c: cMt, box: bMt, cv: cvMt } = chartCard(g, "Revenue by moving type — profit vs costs", monLbl + " · before refunds", { h: Math.max(190, 46 + mtRows.length * 36), icon: KIC.bars, headVal: money(mtRows.reduce((a, r) => a + r.rev, 0)) });
        if (!mtRows.length) emptyBox(bMt);
        else new Chart(cvMt, { type: "bar", data: { labels: mtRows.map(r => r.k), datasets: [
          { label: "Gross profit", data: mtRows.map(r => r.op), backgroundColor: LIME, borderRadius: 3, maxBarThickness: 22 },
          { label: "All costs", data: mtRows.map(r => r.cost), backgroundColor: INK, borderRadius: 3, maxBarThickness: 22 } ] },
          options: baseOpts({ indexAxis: "y", layout: { padding: { right: 110 } }, plugins: { legend: { display: true, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, usePointStyle: true } }, tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.parsed.x),
            // N27: the end-label decoding lives here in the tooltip, not in the note
            footer: items => { const r = mtRows[items[0].dataIndex]; return r && r.rev ? money(r.rev) + " revenue · " + Math.round(r.op / r.rev * 100) + "% profit margin" : ""; } } } },
            scales: { x: axY(moneyC, { beginAtZero: true, stacked: true }), y: { stacked: true, ticks: { color: INK2, font: { size: 11.5, weight: "600" } }, grid: { display: false }, border: { display: false } } } }),
          plugins: [crosshair, { id: "mtlab", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "700 11.5px " + MONO; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillStyle = INK;
            ch.getDatasetMeta(1).data.forEach((el, i) => { const r = mtRows[i]; ctx.fillText(money(r.rev) + (r.rev ? " · " + Math.round(r.op / r.rev * 100) + "%" : ""), el.x + 6, el.y); });
            ctx.restore(); } }] });
        note(cMt, `Each bar is that type's revenue; the green part is what we kept as profit (before refunds).`, "how");
      }
      rankBars(g, "Revenue by size of move", segSeries("closing", "Revenue", "Size of Move"), money, { top: 8 });
      // ("Revenue by source" removed — it duplicated the Marketing section's by-source table,
      //  which has the same numbers WITH ad-spend/ROAS context. One home per fact.)
      // (S5: the lead-status donut moved to Section "Demand & Lead Funnel", next to the funnel)
    }

    /* ---- 04 · Per-Job Profitability (formerly "Unit Economics" — N20) ---- */
    if (SEC("Per-Job Profitability")) {
      const g = section("Per-Job Profitability", "profitability per job and per foreman-hour");
      const revJobT = momReduce("closing", 12, rs => { const j = rs.length; return j ? M["Revenue"].fn(rs) / j : null; });
      const opJobT = momReduce("closing", 12, rs => { const j = rs.length; return j ? M["Operational Profit by Formula"].fn(rs) / j : null; });
      const opHrT = momReduce("closing", 12, rs => { const h = rs.reduce((a, r) => a + num(r["Foreman Hours"]), 0); return h ? M["Operational Profit by Formula"].fn(rs) / h : null; });
      const jobsPer100hT = momReduce("closing", 12, rs => { const j = rs.length, h = rs.reduce((a, r) => a + num(r["Foreman Hours"]), 0); return h ? 100 * j / h : null; });
      const c1 = lines(g, "Avg job value (12-month trend)", "last 12 months", [{ label: "Avg job value", series: revJobT, color: INK }], money, { headVal: money(lastV(revJobT)) });
      note(c1, `Average job value — ${money(lastV(revJobT) || 0)} this month. Rising means bigger jobs, not just more of them.`, "how");
      lines(g, "Gross profit per job", "last 12 months", [{ label: "Gross profit / job", series: opJobT, color: BLUE }], money, { headVal: money(lastV(opJobT)) });
      lines(g, "Gross profit per foreman-hour", "last 12 months", [{ label: "Gross profit / hr", series: opHrT, color: BLUE }], money, { headVal: money(lastV(opHrT)) });
      const cJ100 = lines(g, "Jobs per 100 foreman-hours", "last 12 months", [{ label: "Jobs / 100h", series: jobsPer100hT, color: INK }], fmt1, { headVal: fmt1(lastV(jobsPer100hT) || 0) });
      note(cJ100, `Completed jobs per 100 foreman-hours worked — higher = crews finish jobs in fewer hours.`, "how");
    }

    /* ---- 05 · Profitability & P&L ---- */
    if (SEC("Profitability & P&L")) {
      const g = section("Profitability & P&L", "where the revenue goes, and margin trend");
      const rowsW = withMonth(curY, mo, () => RS.filtered("closing", closing));
      const totBill = M["Total Bill"].fn(rowsW);
      const forman = M["Forman Salary"].fn(rowsW), driver = M["Driver Salary"].fn(rowsW);
      const helper = withMonth(curY, mo, () => M["Helper Salary"].fn(RS.filtered("helper_salaries", DS.helper_salaries || [])));
      const comm = withMonth(curY, mo, () => M["Sales Commission"].fn(RS.filtered("sales_salaries", DS.sales_salaries || [])));
      const expense = M["Car Expense"].fn(rowsW) + M["Fuel Expense"].fn(rowsW) + M["Hotel Expense"].fn(rowsW) + M["Toll Expense"].fn(rowsW) + M["Truck Expense"].fn(rowsW) + M["Other Expenses"].fn(rowsW);
      const refundTot = withMonth(curY, mo, () => M["Total Refunds"] ? M["Total Refunds"].fn(RS.filtered("refunds", DS.refunds || [])) : 0);
      // C20/N4: "Total Bill" and "Revenue" are two names for the byte-identical formula
      // (verified to the cent) — shown as "Revenue (Total Bill)" during the name transition.
      const steps = [ { label: "Revenue", v: totBill, type: "total" }, { label: "Foreman Salaries", v: -forman }, { label: "Driver Salaries", v: -driver }, { label: "Helper Salaries", v: -(helper || 0) }, { label: "Sales Commission", v: -(comm || 0) }, { label: "Expenses", v: -expense }, { label: "Refunds", v: -(refundTot || 0) }, { label: "Gross Profit", v: op, type: "total" } ];
      const wc = waterfall(g, "Revenue → Gross Profit", monLbl, steps, { headVal: money(op), chips: dchips([[op, opLY, "YoY"]]) });
      note(wc, `From ${money(totBill)} in revenue, labor + expenses + refunds leave ${money(op)} gross profit — a ${pct(margin)} margin.`);
      note(wc, `Revenue here is the same figure as the Revenue card in Section 01 (closing-sheet + trip billings, before refunds — refunds are deducted as their own step below).`, "how");
      // what's inside the waterfall's single "Expenses" bar — its six components, ranked
      const expParts = [
        { k: "Fuel", v: M["Fuel Expense"].fn(rowsW) }, { k: "Other Expenses", v: M["Other Expenses"].fn(rowsW) },
        { k: "Car", v: M["Car Expense"].fn(rowsW) }, { k: "Hotel", v: M["Hotel Expense"].fn(rowsW) },
        { k: "Tolls", v: M["Toll Expense"].fn(rowsW) }, { k: "Truck", v: M["Truck Expense"].fn(rowsW) }
      ].filter(p => p.v > 0).sort((a, b) => b.v - a.v);
      const top2 = expParts.slice(0, 2).reduce((a, p) => a + p.v, 0);
      rankBars(g, "What's inside “Expenses”", expParts, money, { sub: monLbl + " · the waterfall bar, opened up", headVal: money(expense), noteKind: "how", note: `The ${money(expense)} Expenses step decomposed — ${expParts.slice(0, 2).map(p => p.k).join(" + ")} are ${expense ? pct(top2 / expense) : "—"} of it. “Other Expenses” is the uncategorized per-job field (see its trend card below).` });
      lines(g, "Gross Profit Margin", "last 12 months", [ { label: "Margin", series: momSeries("closing", "Operational Profit Margin", 12), color: BLUE } ], pct, { headVal: pct(margin) });
      // ("Op profit by state" removed — it duplicated the Geography matrix's Op. Profit column)
      // ("Cost structure" donut removed — it re-plotted the waterfall's own steps as shares;
      //  the waterfall IS the cost structure. One home per fact.)
      // Other Expenses — honest trend. It's a single free-text per-job field on the closing sheet with no
      // sub-detail, so it can't be broken down — but we can watch it grow.
      const oeT = momSeries("closing", "Other Expenses", 14);
      const oeCur = valueFor("closing", "Other Expenses", curY, mo) || 0;
      const oec = lines(g, "Other Expenses — momentum", "last 14 months", [{ label: "Other Expenses", series: oeT, color: AMBER }], money, { headVal: money(oeCur) });
      note(oec, `Uncategorized per-job field reimbursements — ${money(oeCur)} in ${MON[mo]}${jobs ? `, about ${money(oeCur / jobs)}/job` : ""}. Captured as one closing-sheet total with no category behind it, so it can't be split further; the trend is what to watch.`, "how");
    }

    part(3, "Leads & sales", "leads, segments, geography, reps and channels");

    /* ---- 06 · Demand & Lead Funnel ---- */
    if (SEC("Demand & Lead Funnel")) {
      const g = section("Demand & Lead Funnel", "conversion this month and rep performance");
      const cFun = funnel(g, "Lead Funnel", monLbl + " · Total → Qualified → Confirmed", [ { k: "Total Leads", v: leadsN || 0 }, { k: "Qualified", v: qual || 0 }, { k: "Confirmed", v: conf || 0 } ], { headVal: pct(bk), chips: dchips([[bk, bkLY, "YoY"], [bk, bkPM, "MoM"]]) });
      // C2: bk is the canonical dual-basis rate (confirmed by booked date ÷ qualified by
      // create date), so it can legitimately differ from Confirmed ÷ Qualified in the bars.
      if (cFun) note(cFun, `Total and Qualified count leads created in ${MON[mo]}; Confirmed counts jobs booked this month (by booked date) — the same basis as the Booking Rate ${pct(bk)} (confirmed by booked date ÷ qualified created), so the funnel matches the official rate. From all incoming leads (bad included) it is ${pct(leadsN ? conf / leadsN : 0)}.`, "how");
      // S5: the lead-status donut lives here, next to the funnel it explains
      donut(g, "Lead status mix", segReduce("moveboard", "Status Category", rs => rs.length), fmtN, { center: fmtN(leadsN), centerLbl: "leads" });
      const badCur = segReduce("moveboard", "Status", rs => rs.length, curY, mo, { pre: r => r["Status Category"] === "Bad Lead" }).slice(0, 6);
      const badLY = segReduce("moveboard", "Status", rs => rs.length, curY - 1, mo, { pre: r => r["Status Category"] === "Bad Lead" });
      const badMap = {}; badLY.forEach(r => badMap[r.k] = r.v);
      groupedBars(g, "Bad Leads by reason — YoY", badCur.map(r => r.k), badCur.map(r => badMap[r.k] || 0), String(curY - 1), badCur.map(r => r.v), String(curY), fmtN, { sub: MON[mo] });
      const badRateT = momReduce("moveboard", 12, rs => { const t = rs.length, b = rs.filter(r => r["Status Category"] === "Bad Lead").length; return t ? b / t : null; });
      const cBad = lines(g, "Bad-lead rate", "last 12 months", [{ label: "Bad %", series: badRateT, color: NEG }], pct, { headVal: pct(lastV(badRateT)) });
      // evaluative, but only when the month actually IS an outlier — silence beats filler
      {
        const bs = badRateT.filter(r => r.v != null), bCur = bs.length ? bs[bs.length - 1].v : null;
        if (bCur != null && bs.length >= 6) {
          const others = bs.slice(0, -1).map(r => r.v);
          if (bCur >= Math.max(...others)) note(cBad, `${pct(bCur)} is the WORST bad-lead rate of the last ${bs.length} months — check "Bad leads by source" to see which channel degraded.`);
          else if (bCur <= Math.min(...others)) note(cBad, `${pct(bCur)} is the cleanest lead month of the last ${bs.length} — whatever changed in channel mix, it's working.`);
        }
      }
      const badBySrc = segReduce("moveboard", "Source", rs => rs.filter(r => r["Status Category"] === "Bad Lead").length, curY, mo).filter(r => r.v > 0 && r.k !== "—").sort((a, b) => b.v - a.v);
      rankBars(g, "Bad leads by source", badBySrc, fmtN, { top: 10, sub: monLbl, note: "Which channels send junk — pair with Marketing's lead-funnel table to see each channel's bad share." });
      // keep the reps with the MOST leads (not the best rates) — slicing by rate hid exactly the
      // under-performers this card exists to expose. C2: booking rate per rep is the canonical
      // dual-basis formula (RS.bookingRate), never an inline ratio.
      const bookedByAssign = groupByCol(bookedRowsFor(curY, mo), "Assigned");
      const spBook = segReduce("moveboard", "Assigned", rs => rs, curY, mo)
        .map(r => ({ k: r.k, rows: r.rows, v: RS.bookingRate(r.rows, bookedByAssign[r.k] || []) }))
        .filter(r => r.v != null && r.rows.length >= 5).sort((a, b) => b.rows.length - a.rows.length).slice(0, 12);
      bullet(g, "Booking rate by salesperson", monLbl + " · vs team average", spBook, pct, bk || 0, { noteKind: "how", note: `The 12 reps handling the most leads, ordered by volume. Bars below the lime line are converting under the team average (${pct(bk)}) — coaching targets. Booking rate = jobs booked this month (by booked date) ÷ qualified leads created. Reps who book jobs WITHOUT Moveboard-assigned leads (e.g. Peter Montanaro) have no lead base, so no rate can be computed — they appear in the revenue tables instead.` });
      // ("Leads lost to capacity" estimate REMOVED from every report — Tornike 2026-07-13)
    }

    /* ---- 07 · Lead Segmentation ---- */
    if (SEC("Lead Segmentation")) {
      const g = section("Lead Segmentation", "booking funnel by service type, size and cubic feet");
      // C2: one created-scope + one booked-scope row set per year, shared by all four tables —
      // every Booking % below is the canonical RS.bookingRate, never an inline ratio.
      const ftCreated = reduceMonth("moveboard", curY, mo, rs => rs) || [];
      const ftBooked = bookedRowsFor(curY, mo);
      const ftCreatedLY = reduceMonth("moveboard", curY - 1, mo, rs => rs) || [];
      const ftBookedLY = bookedRowsFor(curY - 1, mo);
      function funnelTable(title, col, sortFn) {
        const yy = String(curY - 1).slice(2);
        const bkGrp = groupByCol(ftBooked, col), bkGrpLY = groupByCol(ftBookedLY, col);
        // Confirmed is BOOKED-DATE basis everywhere (Tornike 2026-07-13): confirmed jobs whose
        // Booked Date falls in the month (any create date) — the exact Booking-% numerator, so
        // Confirmed ÷ Qualified = Booking % in every row. Total/Qualified/Bad count leads CREATED
        // in the month (the dual basis of the canonical rate).
        const dAll = Object.entries(groupByCol(ftCreated, col)).map(([k, rows2]) => { const tot = rows2.length, bad = rows2.filter(x => x["Status Category"] === "Bad Lead").length, q = tot - bad, c = (bkGrp[k] || []).filter(x => x["Status Category"] === "Confirmed").length; return { k, tot, q, c, bad, book: RS.bookingRate(rows2, bkGrp[k] || []) }; }).sort(sortFn || ((a, b) => b.tot - a.tot));
        const d = dAll.filter(r => r.k !== "—").slice(0, 12);  // blank segment hidden per feedback; Total row still counts it
        if (!d.length) return;
        const plyMap = {};
        Object.entries(groupByCol(ftCreatedLY, col)).forEach(([k, rows2]) => { plyMap[k] = RS.bookingRate(rows2, bkGrpLY[k] || []); });
        // Total row covers ALL segments (both years) — the table body shows the top 12 by volume
        const tot = dAll.reduce((a, b) => ({ tot: a.tot + b.tot, q: a.q + b.q, c: a.c + b.c, bad: a.bad + b.bad }), { tot: 0, q: 0, c: 0, bad: 0 });
        const totBook = RS.bookingRate(ftCreated, ftBooked), totBookLY = RS.bookingRate(ftCreatedLY, ftBookedLY);
        const bkCell = (cur, ply) => { if (cur == null) return td("—"); const better = ply == null ? null : cur >= ply; return td(pct(cur), better == null ? "" : `color:${better ? "#1c7a4a" : "#b02a37"};font-weight:800`); };
        const rowsH = d.map(r => `<tr><td>${esc(r.k)}</td>${td(fmtN(r.tot))}${td(fmtN(r.q))}${td(fmtN(r.c))}${td(fmtN(r.bad))}${bkCell(r.book, plyMap[r.k])}${td(plyMap[r.k] == null ? "—" : pct(plyMap[r.k]), "color:#8a94a3")}</tr>`).join("");
        const trow = `<tr class="tot"><td>Total</td>${td(fmtN(tot.tot))}${td(fmtN(tot.q))}${td(fmtN(tot.c))}${td(fmtN(tot.bad))}${td(totBook == null ? "—" : pct(totBook))}${td(totBookLY == null ? "—" : pct(totBookLY), "color:#8a94a3")}</tr>`;
        const blankN = (dAll.find(r => r.k === "—") || {}).tot || 0;
        const colLbl = col === "Service Type" ? "Service type" : col === "CF Range" ? "Cubic feet (CF range)" : col;
        // Methodology boilerplate REMOVED (Tornike 2026-07-14: same text repeated on every
        // table) — the dual-basis rule is explained ONCE on the Lead Funnel card; here we
        // keep only this table's own caveats (top-12 cut / unlisted blanks), when they apply.
        const extras = (dAll.length > 12 ? `Top 12 of ${dAll.length} segments — the Total row covers all of them. ` : "") +
          (blankN ? `${fmtN(blankN)} leads with no ${colLbl.toLowerCase()} recorded count in Total but aren't listed.` : "");
        tableCard(g, title, monLbl, `<table class="mrx-tbl"><thead><tr><th>${esc(colLbl)}</th><th>Total</th><th>Qualified</th><th>Confirmed</th><th>Bad leads</th><th>Booking %</th><th>vs '${yy}</th></tr></thead><tbody>${rowsH}${trow}</tbody></table>`, { span2: false, icon: KIC.grid, headVal: fmtN(tot.tot), noteKind: "how", note: extras || undefined });
      }
      // Pairing (Tornike 2026-07-13): row 1 = service type + state (demand mix),
      // row 2 = size of move + CF range (they describe the same thing: move size).
      funnelTable("Leads by service type", "Service Type");
      funnelTable("Leads by state", "State Name");
      // sizes sort small→large: Single Item, Studio, 1-4 bedrooms (condo before house), then Storage/Office
      const sizeKey = s => { const t = String(s).toLowerCase();
        if (/single item/.test(t)) return 1;
        if (/studio/.test(t)) return 5;
        const m = t.match(/(\d+)\s*(bed|br\b)/); if (m) return 10 * (+m[1]) + (/house/.test(t) ? 1 : 0);
        if (/storage/.test(t)) return 100;
        if (/office/.test(t)) return 101;
        return 200; };
      funnelTable("Leads by size of move", "Size of Move", (a, b) => sizeKey(a.k) - sizeKey(b.k) || String(a.k).localeCompare(String(b.k)));
      // CF ranges sort by their RANGE (numeric start; "Over …" last), not by lead volume
      const cfKey = s => { const m = String(s).match(/\d+/); if (!m) return Infinity; return (+m[0]) + (/over|\+|>/i.test(String(s)) ? 0.5 : 0); };
      funnelTable("Leads by cubic feet (CF range)", "CF Range", (a, b) => cfKey(a.k) - cfKey(b.k));
    }

    /* ---- 08 · Geography ---- */
    if (SEC("Geography — by State")) {
      const g = section("Geography — by State", "revenue, profit & booking per state with year-over-year");
      const revS = segSeries("closing", "Revenue", "State Name"), opS = segSeries("closing", "Operational Profit by Formula", "State Name"), jobS = segSeries("closing", "Total Jobs", "State Name");
      const opMap = {}, jobMap = {}; opS.forEach(r => opMap[r.k] = r.v); jobS.forEach(r => jobMap[r.k] = r.v);
      const revLyMap = {}; segSeries("closing", "Revenue", "State Name", curY - 1, mo).forEach(r => revLyMap[r.k] = r.v);
      // C2: per-state booking rate uses the canonical dual-basis helper
      const bkStBooked = groupByCol(bookedRowsFor(curY, mo), "State Name");
      const bkMap = {}; segReduce("moveboard", "State Name", rs => rs, curY, mo).forEach(r => bkMap[r.k] = RS.bookingRate(r.rows, bkStBooked[r.k] || []));
      const states = revS.slice(0, 12).map(r => ({ k: r.k === "—" ? "No state on file" : r.k, rev: r.v, revLy: revLyMap[r.k] || 0, op: opMap[r.k] || 0, jobs: jobMap[r.k] || 0, bk: bkMap[r.k] }));
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
      tableCard(g, "State performance matrix", monLbl + " · top " + states.length + " states", `<table class="mrx-tbl"><thead><tr><th>State</th><th>Revenue</th><th>vs '${String(curY - 1).slice(2)}</th><th>Gross Profit</th><th>Jobs</th><th>Booking %</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: money(states.reduce((a, s2) => a + s2.rev, 0)), noteKind: "how", note: "Bars show $ / jobs magnitude; vs '" + String(curY - 1).slice(2) + " is revenue YoY (green up, red down). Booking % = jobs booked in the month (by booked date) ÷ qualified leads created; green above the team average (" + pct(bk) + "). States are pickup-based; standalone trip jobs (grouped multi-job hauls with no closing sheet) use the trip's delivery state instead. “No state on file” = closing sheets where State was left empty, plus a few trips without one — not a mapping error." });
      rankBars(g, "Revenue by state", revS.map(r => ({ k: r.k === "—" ? "No state on file" : r.k, v: r.v })), money, { top: 10 });
      rankBars(g, "Jobs by state", jobS.map(r => ({ k: r.k === "—" ? "No state on file" : r.k, v: r.v })), fmtN, { top: 10 });
    }

    /* ---- 09 · Sales Team ---- */
    if (SEC("Sales Team Performance")) {
      const g = section("Sales Team Performance", "per-rep scorecard and large-move conversion");
      // trips (grouped multi-job hauls, incl. hauls for OTHER movers' customers) carry NO sales person by
      // design — the blank bucket is excluded so per-rep revenue never shows an unattributable "—" row
      const revSP = segSeries("closing", "Revenue", "Sales Person").filter(r => r.k !== "—"), opSP = segSeries("closing", "Operational Profit by Formula", "Sales Person");
      const opMap = {}; opSP.forEach(r => opMap[r.k] = r.v);
      // C30: revenue keys on closing "Sales Person", lead columns on Moveboard "Assigned" —
      // join after TRIM + CASE-ONLY normalization (never fuzzy matching: wrongly merging two
      // reps' money is worse than a visible "—").
      const normName = s => String(s == null ? "" : s).trim().toLowerCase();
      const mb = segReduce("moveboard", "Assigned", rs => rs, curY, mo);
      // C2: per-rep booking rate is the canonical dual-basis helper
      const spBooked = groupByCol(bookedRowsFor(curY, mo), "Assigned");
      // Confirmed = booked-date basis (Tornike 2026-07-13) — the rep's Booking-% numerator
      const mbMap = {}; mb.forEach(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = (spBooked[r.k] || []).filter(x => x["Status Category"] === "Confirmed").length, bad = r.rows.filter(x => x["Status Category"] === "Bad Lead").length; mbMap[normName(r.k)] = { q, c, bad, tot: r.rows.length, book: RS.bookingRate(r.rows, spBooked[r.k] || []), dead: r.rows.length ? bad / r.rows.length : null }; });
      const refSP = {}; segReduce("refunds", "Sales Person", rs => Math.abs(rs.reduce((a, x) => a + num(x["Total refund"]), 0)), curY, mo).forEach(r => refSP[normName(r.k)] = r.v);
      const reps = revSP.slice(0, 14).map(r => ({ k: r.k, rev: r.v, op: opMap[r.k] || 0, ref: refSP[normName(r.k)] || 0, m: mbMap[normName(r.k)] || {} }));
      const rmax = Math.max(...reps.map(r => r.rev));
      const rowsH = reps.map(r => `<tr><td>${esc(r.k)}</td>
        <td class="bar"><i style="width:${(r.rev / rmax * 100).toFixed(1)}%"></i><span>${money(r.rev)}</span></td>
        ${td(money(r.op))}${td(r.ref ? money(r.ref) : "—", r.ref ? "color:#b02a37;font-weight:800" : "")}${td(r.ref && r.rev ? pct(r.ref / r.rev) : "—", r.ref && r.rev && r.ref / r.rev > 0.02 ? "color:#b02a37;font-weight:800" : "")}${td(fmtN(r.m.q || 0))}${td(fmtN(r.m.c || 0))}
        ${td(r.m.book == null ? "—" : pct(r.m.book), r.m.book == null ? "" : `color:${r.m.book >= (bk || 0) ? "#1c7a4a" : "#b02a37"};font-weight:800`)}
        ${td(r.m.dead == null ? "—" : pct(r.m.dead), r.m.dead == null ? "" : `color:${r.m.dead > .3 ? "#b02a37" : "#1c7a4a"};font-weight:800`)}</tr>`).join("");
      tableCard(g, "Salesperson scorecard", monLbl + " · top " + reps.length + " reps by revenue", `<table class="mrx-tbl"><thead><tr><th>Sales Person</th><th>Revenue</th><th>Gross Profit</th><th>Refunds</th><th>Refund %</th><th>Qualified</th><th>Confirmed</th><th>Booking %</th><th>Bad-lead %</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: money(reps.reduce((a, r) => a + r.rev, 0)), noteKind: "how", note: `Bars = revenue share. Refunds / Refund % = money refunded on the rep's jobs as a share of their revenue (red above 2%). Booking % = jobs booked this month (by booked date) ÷ qualified leads created (qualified = all leads minus bad leads); green above the team average (${pct(bk)}). Bad-lead % red when high. Gross Profit is before refunds. Lead columns come from Moveboard assignment, revenue and refunds from closing sheets — names are matched after trimming spaces and ignoring case.` });
      const bigPre = { pre: r => String(r["Big Job Status"]) === "Yes" };  // clean flag, not a CF-range regex
      const bigBooked = groupByCol(bookedRowsFor(curY, mo, bigPre.pre), "Assigned");
      const bigMb = segReduce("moveboard", "Assigned", rs => rs, curY, mo, bigPre).map(r => { const q = r.rows.filter(x => x["Status Category"] !== "Bad Lead").length, c = (bigBooked[r.k] || []).filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k, q, c, book: RS.bookingRate(r.rows, bigBooked[r.k] || []) }; }).filter(r => r.q >= 2).sort((a, b) => b.q - a.q).slice(0, 10);
      const revSPly = {}; segSeries("closing", "Revenue", "Sales Person", curY - 1, mo).forEach(r => revSPly[r.k] = r.v);
      const opSPly = {}; segSeries("closing", "Operational Profit by Formula", "Sales Person", curY - 1, mo).forEach(r => opSPly[r.k] = r.v);
      // top 14 (was 10): with ~13 active reps the old cut silently hid the newest hires
      // (Peter Montanaro ranked #11 with real revenue and never appeared) — show them all.
      const topReps = revSP.slice(0, 14);
      groupedBars(g, "Revenue by salesperson — YoY", topReps.map(r => r.k), topReps.map(r => revSPly[r.k] || 0), String(curY - 1), topReps.map(r => r.v), String(curY), money, { sub: MON[mo] });
      groupedBars(g, "Gross profit by salesperson — YoY", topReps.map(r => r.k), topReps.map(r => opSPly[r.k] || 0), String(curY - 1), topReps.map(r => opMap[r.k] || 0), String(curY), money, { sub: MON[mo] + " · before refunds" });
      // C27: the filter is the Moveboard "Big Job" flag — the title must not claim a CF threshold
      if (bigMb.length) groupedBars(g, "Large moves (Big Job flag) — Qualified vs Confirmed", bigMb.map(r => r.k), bigMb.map(r => r.q), "Qualified", bigMb.map(r => r.c), "Confirmed", fmtN, { sub: monLbl });
      const bigBook = bigMb.filter(r => r.book != null).map(r => ({ k: r.k, v: r.book }));
      if (bigBook.length) bullet(g, "Large-move (Big Job flag) booking rate by rep", monLbl + " · vs team avg", bigBook, pct, bk || 0, {});
    }

    /* ---- 10 · Marketing ROI (theme split A of former "Marketing & Channels") ---- */
    if (SEC("Marketing ROI")) {
      const g = section("Marketing ROI", "ad spend and what it returns");
      // ===== RETURN (headline) =====
      // ad feed splits post cards by state ("Post Card - MA/DE/NJ…") while bookings pool them as "Post Card" — align both sides so ROI isn't falsely 0×
      const normSrc = s => /post\s*card/i.test(String(s)) ? "Post Card" : (blank(s) ? "—" : String(s));
      const adSrcMonth = (y, m) => { const o = {}; (reduceMonth("card_expenses", y, m, rs => rs.filter(r => Number(r["Is Advertising"]) === 1)) || []).forEach(r => { const s2 = normSrc(r.Source); o[s2] = (o[s2] || 0) + num(r.Amount); }); return o; };
      const bySrcMonth = (measure, y, m) => { const o = {}; segSeries("closing", measure, "Source", y, m).forEach(r => { const k = normSrc(r.k); o[k] = (o[k] || 0) + r.v; }); return o; };
      // C25: the ad feed lags ~1 month — but only fall back to the PREVIOUS month when the
      // SELECTED month has no posted ad spend yet. An older report month shows its own ROI.
      const adSel = adSrcMonth(curY, mo);
      const selHasSpend = Object.keys(adSel).some(k => adSel[k] > 0 && k !== "—");
      const roiY = selHasSpend ? curY : PMY, roiM = selHasSpend ? mo : PM, roiFellBack = !selHasSpend;
      const adPM = selHasSpend ? adSel : adSrcMonth(roiY, roiM), revPMs = bySrcMonth("Revenue", roiY, roiM), opPMs = bySrcMonth("Operational Profit by Formula", roiY, roiM), jobPMs = bySrcMonth("Total Jobs", roiY, roiM);
      const adLYr = adSrcMonth(roiY - 1, roiM), revLYr = bySrcMonth("Revenue", roiY - 1, roiM);
      const roiLbl = MON[roiM] + " " + roiY;
      // hide channels we no longer buy: only sources with ad spend in the CURRENT year appear in the ROI suite
      const src2026 = new Set(); (DS.card_expenses || []).forEach(r => { if (coRow(r) && Number(r["Is Advertising"]) === 1 && String(r["Transaction Date"] || "").slice(0, 4) === String(curY) && num(r.Amount)) src2026.add(normSrc(r.Source)); });
      const paidPM = Object.keys(adPM).filter(k => adPM[k] > 0 && k !== "—" && src2026.has(k)).sort((a, b) => adPM[b] - adPM[a]);
      if (paidPM.length) {
        const roiRows = paidPM.map(k => { const roi = adPM[k] ? (revPMs[k] || 0) / adPM[k] : null; const roiLY = adLYr[k] ? (revLYr[k] || 0) / adLYr[k] : null; return { k, ad: adPM[k], rev: revPMs[k] || 0, op: opPMs[k] || 0, jobs: jobPMs[k] || 0, roi, roiLY, ppd: adPM[k] ? (opPMs[k] || 0) / adPM[k] : null }; });
        const rt = roiRows.reduce((a, r) => ({ ad: a.ad + r.ad, rev: a.rev + r.rev, op: a.op + r.op }), { ad: 0, rev: 0, op: 0 });
        const roiCol = v => v >= 5 ? "#1c7a4a" : v >= 2 ? "#7a5a12" : "#b02a37";
        const growCell = r => { if (r.roi == null || r.roiLY == null || !r.roiLY) return td("—", "color:#8a94a3"); const d2 = (r.roi - r.roiLY) / r.roiLY; return td(`${d2 >= 0 ? "▲" : "▼"} ${Math.abs(d2 * 100).toFixed(0)}%`, `color:${d2 >= 0 ? "#1c7a4a" : "#b02a37"};font-weight:800`); };
        const yyR = String(roiY - 1).slice(2);
        const roiHtml = `<table class="mrx-tbl"><thead><tr><th>Source</th><th>Ad Spend</th><th>Revenue</th><th>ROAS</th><th>ROAS vs '${yyR}</th><th>Profit / $1 ad</th></tr></thead><tbody>${roiRows.map(r => `<tr><td>${esc(r.k)}</td>${td(money(r.ad))}${td(money(r.rev))}${td(r.roi == null ? "—" : r.roi.toFixed(1) + "×", r.roi == null ? "" : `color:${roiCol(r.roi)};font-weight:800`)}${growCell(r)}${td(r.ppd == null ? "—" : "$" + fmt1(r.ppd), r.ppd == null ? "" : `color:${r.ppd >= 3 ? "#1c7a4a" : r.ppd >= 1 ? "#7a5a12" : "#b02a37"};font-weight:800`)}</tr>`).join("")}<tr class="tot"><td>All paid</td>${td(money(rt.ad))}${td(money(rt.rev))}${td(rt.ad ? (rt.rev / rt.ad).toFixed(1) + "×" : "—")}${td("")}${td(rt.ad ? "$" + fmt1(rt.op / rt.ad) : "—")}</tr></tbody></table>`;
        tableCard(g, "Return on ad spend by source", roiLbl + (roiFellBack ? " · latest fully-posted ad month" : ""), roiHtml, { icon: KIC.grid, headVal: (rt.ad ? (rt.rev / rt.ad).toFixed(1) + "×" : "—") + " blended", noteKind: "how", note: `${roiFellBack ? `Ad spend posts ~1 month behind and ${MON[mo]}'s hasn't landed yet, so returns are shown for ${roiLbl} (the latest complete ad month) — ${MON[mo]}'s numbers fill in once the feed lands. ` : ""}ROAS = revenue ÷ ad spend; “ROAS vs '${yyR}” is the growth of that return vs the same month last year; Profit/$1 = gross profit per ad dollar (before refunds). Green ROAS ≥5×, amber ≥2×, red below. Post-card variants pooled.` });
        // ===== 2 · EFFICIENCY ===== (headlines are BLENDED totals — summing per-channel ratios is meaningless)
        const totAdJobs = paidPM.reduce((a, k) => a + (jobPMs[k] || 0), 0);
        rankBars(g, "Gross profit per $1 of ad spend", paidPM.map(k => ({ k, v: adPM[k] ? (opPMs[k] || 0) / adPM[k] : 0 })).filter(r => r.v > 0).sort((a, b) => b.v - a.v), v => "$" + fmt1(v), { top: 10, sub: roiLbl, headVal: rt.ad ? "$" + fmt1(rt.op / rt.ad) : "—", noteKind: "how", note: "Each ad dollar's gross-profit return, by channel (before refunds) — the cleanest 'is this channel worth it' number. Headline = blended: total gross profit ÷ total ad spend." });
        // N32: one name portal-wide for spend ÷ jobs — "Ad cost per completed job"
        rankBars(g, "Ad cost per completed job", paidPM.map(k => ({ k, v: (jobPMs[k] || 0) > 0 ? adPM[k] / jobPMs[k] : 0 })).filter(r => r.v > 0).sort((a, b) => b.v - a.v), money, { top: 10, sub: roiLbl, headVal: totAdJobs ? money(rt.ad / totAdJobs) : "—", noteKind: "how", note: "Ad spend ÷ completed jobs, per source. Lower is better; the top of the list is where a job costs the most to win. Headline = blended: total ad spend ÷ total completed jobs." });
        // ===== 3 · TREND & SPEND =====
        const t3 = []; { let y = roiY, m = roiM; for (let i = 0; i < 3; i++) { t3.push([y, m]); m--; if (m < 1) { m = 12; y--; } } }
        const adT3 = {}, revT3 = {}; t3.forEach(p => { const a = adSrcMonth(p[0], p[1]), rv = bySrcMonth("Revenue", p[0], p[1]); Object.keys(a).forEach(k => adT3[k] = (adT3[k] || 0) + a[k]); Object.keys(rv).forEach(k => revT3[k] = (revT3[k] || 0) + rv[k]); });
        const topPaid = paidPM.slice(0, 8);
        groupedBars(g, "ROAS — latest month vs last 3 months combined", topPaid, topPaid.map(k => adT3[k] ? (revT3[k] || 0) / adT3[k] : 0), "last 3 months combined", topPaid.map(k => adPM[k] ? (revPMs[k] || 0) / adPM[k] : 0), roiLbl, v => v.toFixed(1) + "×", { sub: "revenue ÷ ad spend · which channels are trending up", headVal: (rt.ad ? (rt.rev / rt.ad).toFixed(1) + "×" : "—") });
      }
      const adTrend = momReduce("card_expenses", 12, rs => { const ad = rs.filter(r => Number(r["Is Advertising"]) === 1); return ad.length ? ad.reduce((a, r) => a + num(r.Amount), 0) : null; });
      lines(g, "Advertising spend — momentum", "last 12 months", [ { label: "Ad Spend", series: adTrend, color: AMBER } ], moneyC, { headVal: money(lastV(adTrend)) });
    }

    /* ---- 11 · Lead Sources (theme split B of former "Marketing & Channels") ---- */
    if (SEC("Lead Sources")) {
      const g = section("Lead Sources", "where leads come from and how each channel converts");
      // ===== OUTCOMES BY CHANNEL ===== (one rich table; the old profit/jobs rank bars duplicated it)
      const revBySrc = segSeries("closing", "Revenue", "Source"), opBySrc = opBySrcCur, jobBySrc = segSeries("closing", "Total Jobs", "Source");
      const opM = {}, jbM = {}; opBySrc.forEach(r => opM[r.k] = r.v); jobBySrc.forEach(r => jbM[r.k] = r.v);
      const seRows = revBySrc.slice(0, 12).map(r => ({ k: r.k, jobs: jbM[r.k] || 0, rev: r.v, op: opM[r.k] || 0 }));
      const seHtml = `<table class="mrx-tbl"><thead><tr><th>Source</th><th>Jobs</th><th>Revenue</th><th>Gross Profit</th></tr></thead><tbody>${seRows.map(r => `<tr><td>${esc(r.k)}</td>${td(fmtN(r.jobs))}${td(money(r.rev))}${td(money(r.op))}</tr>`).join("")}</tbody></table>`;
      tableCard(g, "Source mix — jobs · revenue · profit", monLbl + " · top " + seRows.length + " sources by revenue", seHtml, { icon: KIC.grid, headVal: money(seRows.reduce((a, r) => a + r.rev, 0)), noteKind: "how", note: "Ranked by revenue (top 12); Gross Profit is before refunds. Use ⬇ Excel to re-rank by jobs or profit." });
      // ad-leads funnel by channel (deck s61-62): does the channel's lead VOLUME convert, not just its revenue.
      // C2: Booking % per channel is the canonical dual-basis helper.
      const lfBooked = groupByCol(bookedRowsFor(curY, mo), "Source");
      const lfCreated = reduceMonth("moveboard", curY, mo, rs => rs) || [];
      const lfAll = segReduce("moveboard", "Source", rs => rs, curY, mo).map(r => { const rows2 = r.rows, tot = rows2.length, bad = rows2.filter(x => x["Status Category"] === "Bad Lead").length, q = tot - bad, c2 = (lfBooked[r.k] || []).filter(x => x["Status Category"] === "Confirmed").length; return { k: r.k === "—" ? "(blank)" : r.k, tot, q, c: c2, bad, book: RS.bookingRate(rows2, lfBooked[r.k] || []) }; }).sort((a, b) => b.tot - a.tot);
      const lfRows = lfAll.filter(r => r.k !== "(blank)").slice(0, 12);  // blank source hidden; Total row still counts it
      if (lfRows.length) {
        // Total row covers ALL sources, so it reconciles with the Leads KPI (the body shows the top 12)
        const lfTot = lfAll.reduce((a, b) => ({ tot: a.tot + b.tot, q: a.q + b.q, c: a.c + b.c, bad: a.bad + b.bad }), { tot: 0, q: 0, c: 0, bad: 0 });
        const lfTotBook = RS.bookingRate(lfCreated, bookedRowsFor(curY, mo));
        const lfBlank = (lfAll.find(r => r.k === "(blank)") || {}).tot || 0;
        const lfHtml = `<table class="mrx-tbl"><thead><tr><th>Source</th><th>Leads</th><th>Qualified</th><th>Confirmed</th><th>Bad leads</th><th>Booking %</th></tr></thead><tbody>${lfRows.map(r => `<tr><td>${esc(r.k)}</td>${td(fmtN(r.tot))}${td(fmtN(r.q))}${td(fmtN(r.c))}${td(fmtN(r.bad))}${td(r.book == null ? "—" : pct(r.book), r.book == null ? "" : `color:${r.book >= (bk || 0) ? "#1c7a4a" : "#b02a37"};font-weight:800`)}</tr>`).join("")}<tr class="tot"><td>Total${lfAll.length > 12 ? ` (all ${lfAll.length} sources)` : ""}</td>${td(fmtN(lfTot.tot))}${td(fmtN(lfTot.q))}${td(fmtN(lfTot.c))}${td(fmtN(lfTot.bad))}${td(lfTotBook == null ? "—" : pct(lfTotBook))}</tr></tbody></table>`;
        tableCard(g, "Lead funnel by source", monLbl + (lfAll.length > 12 ? " · top 12 of " + lfAll.length : ""), lfHtml, { icon: KIC.grid, headVal: fmtN(lfTot.tot) + " leads", noteKind: "how", note: `Each channel's lead volume through the funnel — a channel can look great on revenue but be wasting leads. Red = below the team average (${pct(bk)}). The Total row counts every source, so it matches the Leads KPI.${lfBlank ? ` ${fmtN(lfBlank)} leads with no source recorded count in Total but aren't listed.` : ""}` });
      }
      // ===== INBOUND DEMAND (tracked marketing numbers · CallRail) =====
      const callLabels = momReduce("callrail", 12, rs => rs.length).map(r => r.k);
      const answered = momReduce("callrail", 12, rs => rs.filter(r => String(r["Call Status"]) === "Answered Call").length).map(r => r.v);
      const missed = momReduce("callrail", 12, rs => rs.filter(r => /Missed|Abandoned/.test(String(r["Call Status"]))).length).map(r => r.v);
      stackedTime(g, "Inbound calls — answered vs missed", "last 12 months (CallRail)", callLabels, [ { label: "Answered", data: answered, color: INK }, { label: "Missed/Abandoned", data: missed, color: NEG } ], fmtN);
      const callsBySrc = segReduce("callrail", "Source", rs => rs.length, curY, mo).slice(0, 10);
      const ftc = reduceMonth("callrail", curY, mo, rs => { const t = rs.length, f = rs.filter(r => Number(r["First-Time Caller"]) === 1).length; return t ? f / t : null; });
      rankBars(g, "Calls by source", callsBySrc, fmtN, { top: 10, sub: monLbl, note: ftc == null ? "" : `${pct(ftc)} of calls this month were first-time callers.` });
    }

    /* ---- Phone & Response (S3: RingCentral — the WHOLE phone system, deck s75) ----
       Split out of Marketing & Channels so the Support view sees answer rate and missed
       calls — the metrics that ARE their job. Marketing keeps it in its view list too. */
    if (SEC("Phone & Response")) {
      const g = section("Phone & Response", "call volume, answer rate and outbound effort — the whole phone system");
      const rcMonths = (() => { const o = []; let y = curY, m = mo; for (let i = 0; i < 12; i++) { o.unshift({ ym: `${y}-${String(m).padStart(2, "0")}`, k: MS[m] + " " + String(y).slice(2) }); m--; if (m < 1) { m = 12; y--; } } return o; })();
      if (rcMonths.some(x => rcAgg[x.ym])) {
        const cVol = stackedTime(g, "Phone system — call volume", "last 12 months (RingCentral)", rcMonths.map(x => x.k),
          [ { label: "Incoming", data: rcMonths.map(x => (rcAgg[x.ym] || {}).in || 0), color: INK },
            { label: "Outgoing", data: rcMonths.map(x => (rcAgg[x.ym] || {}).out || 0), color: CTX } ], fmtN);
        if (cVol) note(cVol, "The company phone system end-to-end — inbound AND outbound on every line, counted as real calls (sessions), never per-device ring-legs. The CallRail card in Marketing & Channels covers only tracked marketing numbers.", "how");
        const ansT = rcMonths.map(x => { const b = rcAgg[x.ym]; return { k: x.k, v: b && b.in ? b.ans / b.in : null }; });
        const curB = rcAgg[`${curY}-${String(mo).padStart(2, "0")}`];
        const cAns = lines(g, "Incoming answer rate", "last 12 months (RingCentral)", [{ label: "Answered %", series: ansT, color: LIMED }], pct, { headVal: pct(lastV(ansT)) });
        // C29: state the counting rule — RingCentral's own report may group voicemail differently
        if (curB && curB.in) note(cAns, `${MON[mo]}: ${fmtN(curB.ans)} of ${fmtN(curB.in)} incoming calls answered (${pct(curB.ans / curB.in)}) — ${fmtN(curB.miss)} missed + ${fmtN(curB.vm)} to voicemail. Counted on real calls (sessions), not ring-legs: one call ringing five phones counts once. Answered = accepted by a person. Outbound side: ${fmtN(curB.out)} calls, ${fmt1(curB.outDur / 3600)}h outbound talk time.`, "how");
        if (curB && Object.keys(curB.names).length) {
          // (talk-time card folded in here — same 10 names in near-identical order taught nothing new;
          //  the effort metric survives as team totals on this card)
          const byN = Object.entries(curB.names).map(([k, v]) => ({ k, v: v.out, dur: v.dur })).sort((a, b) => b.v - a.v);
          const teamH = byN.reduce((a, r) => a + r.dur, 0) / 3600, teamCalls = byN.reduce((a, r) => a + r.v, 0);
          rankBars(g, "Outbound calls by teammate", byN.map(r => ({ k: r.k, v: r.v })), fmtN, { top: 10, sub: monLbl + " (RingCentral)", noteKind: "how", note: `By the agent's own extension (the shared Support line is excluded). Real dialed calls only — no ring-legs. Talk time behind these dials: ${fmt1(teamH)}h across the team${teamCalls ? ` (~${fmt1(teamH * 60 / teamCalls)} min per call)` : ""}.` });
        }
      }
      // ---- SMS: texting volume was previously loaded but shown NOWHERE (audit 2026-07-13) ----
      if (rcMonths.some(x => rcSms[x.ym])) {
        const smsB = rcSms[`${curY}-${String(mo).padStart(2, "0")}`];
        const cSms = stackedTime(g, "Text messages — received vs sent", "last 12 months (RingCentral SMS)", rcMonths.map(x => x.k),
          [ { label: "Received", data: rcMonths.map(x => (rcSms[x.ym] || {}).in || 0), color: INK },
            { label: "Sent", data: rcMonths.map(x => (rcSms[x.ym] || {}).out || 0), color: CTX } ], fmtN);
        if (cSms && smsB) note(cSms, `${MON[mo]}: ${fmtN(smsB.in)} received, ${fmtN(smsB.out)} sent${smsB.fail ? `, ${fmtN(smsB.fail)} failed to deliver` : ""}. Zip to Zip lines only (Tuji excluded). Direction comes straight from the RingCentral export.`, "how");
      }
    }

    part(4, "Delivery & after-sale", "crew operations, packing, quality and repeat business");

    /* ---- 11 · Operations & Crew ---- */
    if (SEC("Operations & Crew (Foreman)")) {
      const g = section("Operations & Crew (Foreman)", "productivity, quality score and month-over-month");
      const payM = {}, tipsM = {}, refM = {}, payPM = {}, tipsPM = {}, jobsFmPM = {};
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Forman Total $"]), 0), curY, mo).forEach(r => payM[r.k] = r.v);
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Tip from Company Part"]) + num(x["Tip From the Customers"]), 0), curY, mo).forEach(r => tipsM[r.k] = r.v);
      segReduce("refunds", "Foreman", rs => Math.abs(rs.reduce((a, x) => a + num(x["Total refund"]), 0)), curY, mo).forEach(r => refM[r.k] = r.v);
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Forman Total $"]), 0), PMY, PM).forEach(r => payPM[r.k] = r.v);
      segReduce("closing", "Foreman", rs => rs.reduce((a, x) => a + num(x["Tip from Company Part"]) + num(x["Tip From the Customers"]), 0), PMY, PM).forEach(r => tipsPM[r.k] = r.v);
      segReduce("closing", "Foreman", rs => rs.length, PMY, PM).forEach(r => jobsFmPM[r.k] = r.v);
      // tiny MoM arrow: ▲/▼ + % vs previous month, green/red
      const mArrow = (cur, prev) => { if (prev == null || !prev) return ""; const d2 = (cur - prev) / Math.abs(prev); return ` <span style="color:${d2 >= 0 ? POS : NEG};font-size:10px;font-weight:800">${d2 >= 0 ? "▲" : "▼"}${Math.abs(d2 * 100).toFixed(0)}%</span>`; };
      const scRows = (DS.scorecard || []).filter(r => { const d = String(r["Month"] || "").slice(0, 7); return d === `${curY}-${String(mo).padStart(2, "0")}`; });
      const scPrev = (DS.scorecard || []).filter(r => { const d = String(r["Month"] || "").slice(0, 7); return d === `${PMY}-${String(PM).padStart(2, "0")}`; });
      if (scRows.length) {
        const sc = scRows.map(r => ({ f: r.Foreman, jobs: num(r["Total Jobs"]), cf: num(r["Total CF"]), written: num(r["Total Packing Written"]), est: num(r["Total Packing Estimate"]), rev: num(r["Total Reviews Written"]), claims: num(r["Forman Fault Claims"]), score: num(r["Forman Score"]), rank: num(r["Forman Score Rank"]), prev: num(r["Forman Score Prev Month"]) }))
          .sort((a, b) => (a.rank || 999) - (b.rank || 999)).slice(0, 15);
        const smax = Math.max(...sc.map(r => r.score || 0)) || 1;
        // C24/Q5: 'vs Est' is colored BY VALUE — green only when written ≥ estimate (≥1×);
        // under-delivery is red, never a flattering unconditional green.
        const rowsH = sc.map((r, i) => { const arrow = r.prev ? (r.score > r.prev ? `<span style="color:${POS}">▲</span>` : r.score < r.prev ? `<span style="color:${NEG}">▼</span>` : "–") : ""; const up = r.est > 0 ? r.written / r.est : null; return `<tr><td>${i === 0 ? "👑 " : ""}${esc(r.f)}</td>
          ${td(fmtN(r.jobs) + mArrow(r.jobs, jobsFmPM[r.f]))}${td(fmtN(r.cf))}${td(money(payM[r.f] || 0) + mArrow(payM[r.f] || 0, payPM[r.f]))}${td(money(tipsM[r.f] || 0) + mArrow(tipsM[r.f] || 0, tipsPM[r.f]))}${td(money(r.written))}${td(up == null ? "—" : up.toFixed(1) + "×", up == null ? "" : `color:${up >= 1 ? "#1c7a4a" : "#b02a37"};font-weight:800`)}${td(r.rev ? fmtN(r.rev) : "0", r.rev ? "" : "color:#b02a37;font-weight:800")}${td(fmtN(r.claims), r.claims > 0 ? `color:#b02a37;font-weight:800` : "")}${td(refM[r.f] ? money(refM[r.f]) : "—", refM[r.f] ? `color:#b02a37;font-weight:800` : "")}
          <td class="bar"><i style="width:${(r.score / smax * 100).toFixed(0)}%;background:#dcecab"></i><span>${fmt1(r.score)} ${arrow}</span></td></tr>`; }).join("");
        tableCard(g, "Foreman scorecard — ranked", monLbl, `<table class="mrx-tbl"><thead><tr><th>Foreman</th><th>Jobs</th><th>CF</th><th>Pay</th><th>Tips</th><th>Packing</th><th>vs Est</th><th>Reviews</th><th>Claims</th><th>Refunds</th><th>Score</th></tr></thead><tbody>${rowsH}</tbody></table>`, { icon: KIC.grid, headVal: fmtN(sc.length) + " crews", noteKind: "how", note: `Pay/Tips from closings; ▲▼ arrows on Jobs/Pay/Tips compare vs ${MS[PM]}. 'vs Est' = packing written ÷ quoted estimate (green at 1× or above, red below). Score combines jobs, packing, reviews and fault claims — higher is better; the ▲▼ beside it compares vs ${MS[PM]}. Rank 1 crowned.` });
      }
      const jobF = segSeries("closing", "Total Jobs", "Foreman").slice(0, 12);
      const hrMap = {}; segSeries("closing", "Hours Worked by Forman", "Foreman").forEach(r => hrMap[r.k] = r.v);
      combo(g, "Jobs vs hours by foreman", monLbl, jobF, "Jobs", fmtN, jobF.map(r => ({ k: r.k, v: hrMap[r.k] || 0 })), "Hours", fmtN);
      const packCur = segSeries("closing", "Total Packing Written", "Foreman").slice(0, 12);
      const packPrev = {}; segSeries("closing", "Total Packing Written", "Foreman", PMY, PM).forEach(r => packPrev[r.k] = r.v);
      groupedBars(g, "Packing written by foreman — MoM", packCur.map(r => r.k), packCur.map(r => packPrev[r.k] || 0), MS[PM], packCur.map(r => r.v), MS[mo], money, { sub: `${MS[PM]} vs ${MS[mo]}` });
      // estimate keys come from the SCORECARD's Foreman, bars from CLOSING's Foreman —
      // join on trimmed+case-folded names so a stray space can't zero an estimate bar
      const nrmF = s => String(s == null ? "" : s).trim().toLowerCase();
      const estM = {}; scRows.forEach(r => estM[nrmF(r.Foreman)] = num(r["Total Packing Estimate"]));
      groupedBars(g, "Packing written vs estimate by foreman", packCur.map(r => r.k), packCur.map(r => estM[nrmF(r.k)] || 0), "Estimate", packCur.map(r => r.v), "Written", money, { sub: monLbl });
      const refByFm = segReduce("refunds", "Foreman", rs => Math.abs(rs.reduce((a, x) => a + num(x["Total refund"]), 0)), curY, mo).filter(r => r.v > 0 && r.k !== "—");
      if (refByFm.length) rankBars(g, "Refunds by foreman", refByFm, money, { top: 10 });
      // foreman efficiency — packing density & review rate, WITH month-over-month movement + arrows
      if (scRows.length) {
        const prevEff = {}; scPrev.forEach(r => prevEff[r.Foreman] = { p100: num(r["Packing per 100 CF"]), rtj: num(r["Reviews to Jobs Ratio"]) });
        const eff = scRows.map(r => ({ f: r.Foreman, p100: num(r["Packing per 100 CF"]), rtj: num(r["Reviews to Jobs Ratio"]), jobs: num(r["Total Jobs"]) }))
          .filter(r => r.f && r.jobs > 0).sort((a, b) => b.p100 - a.p100).slice(0, 15);
        if (eff.length) {
          const dCell = (cur, prev) => { if (prev == null || !prev) return td("—", "color:#8a94a3"); const d2 = (cur - prev) / Math.abs(prev); return td(`${d2 >= 0 ? "▲" : "▼"} ${Math.abs(d2 * 100).toFixed(0)}%`, `color:${d2 >= 0 ? "#1c7a4a" : "#b02a37"};font-weight:800`); };
          const effHtml = `<table class="mrx-tbl"><thead><tr><th>Foreman</th><th>Packing $ / 100 CF</th><th>vs ${MS[PM]}</th><th>Reviews / job</th><th>vs ${MS[PM]}</th></tr></thead><tbody>${eff.map((r, i) => { const p = prevEff[r.f] || {}; return `<tr><td>${i === 0 ? "👑 " : ""}${esc(r.f)}</td>${td(money(r.p100))}${dCell(r.p100, p.p100)}${td(fmt1(r.rtj))}${dCell(r.rtj, p.rtj)}</tr>`; }).join("")}</tbody></table>`;
          tableCard(g, "Foreman efficiency — packing density & review rate", monLbl + " vs " + MS[PM], effHtml, { icon: KIC.grid, headVal: fmtN(eff.length) + " crews", noteKind: "how", note: `Packing $ written per 100 CF moved, and reviews collected per job — ranked by packing density, ▲▼ vs ${MS[PM]}. Green = improving crew, red = slipping.` });
        }
      }
    }

    /* ---- 12 · Fleet (theme split from Operations & Crew) ---- */
    if (SEC("Fleet")) {
      const g = section("Fleet", "truck revenue vs running cost");
      // fleet profitability: revenue vs direct running cost per truck
      if (fleetRows.length) {
        const mmF = `${curY}-${String(mo).padStart(2, "0")}`, fm2 = {};
        fleetRows.forEach(r => { if (String(r.Date || "").slice(0, 7) !== mmF) return; const t = String(r["Truck #"] || "").trim(); if (!t) return; const b = fm2[t] || (fm2[t] = { jobs: 0, rev: 0, cost: 0 }); b.jobs++; b.rev += num(r["Total Bill"]); b.cost += num(r.Fuel) + num(r.Truck) + num(r.Car) + num(r.Tolls); });
        const fl = Object.keys(fm2).map(k => { const v = fm2[k]; return { k, jobs: v.jobs, rev: v.rev, cost: v.cost, net: v.rev - v.cost }; }).sort((a, b) => b.rev - a.rev).slice(0, 15);
        if (fl.length) {
          // Tornike confirmed 2026-07-08: closing-sheet truck "Ent" = Enterprise rental
          const truckLbl = k => /^ent$/i.test(k) ? "Rental (Enterprise)" : k;
          const flHtml = `<table class="mrx-tbl"><thead><tr><th>Truck</th><th>Jobs</th><th>Revenue</th><th>Running cost</th><th>Net</th><th>Cost %</th></tr></thead><tbody>${fl.map(r => `<tr><td>${esc(truckLbl(r.k))}</td>${td(fmtN(r.jobs))}${td(money(r.rev))}${td(money(r.cost))}${td(money(r.net))}${td(r.rev ? pct(r.cost / r.rev) : "—")}</tr>`).join("")}</tbody></table>`;
          tableCard(g, "Fleet — revenue & running cost per truck", monLbl, flHtml, { icon: KIC.grid, headVal: fmtN(fl.length) + " trucks", noteKind: "how", note: "Revenue of the jobs each truck ran vs its direct running costs (fuel, truck expense, car, tolls). Labor isn't truck-attributable and is excluded — this ranks the fleet, it isn't a full profit & loss. Truck names come from closing sheets as written; Rental (Enterprise) is a rented truck." });
        }
      }
    }

    /* ---- 13 · Packing & Storage ---- */
    if (SEC("Packing & Storage")) {
      const g = section("Packing & Storage", "packing written vs material cost, storage income vs cost");
      // Packing economics — written revenue vs material cost, MONTH-over-month. FULL WIDTH (Tornike 2026-07-15).
      const packMoM = momSeries("closing", "Total Packing Written", 14);
      let pkCard;
      if (hasCostData) {
        const pkCost = packMoM.map(r => ({ k: r.k, v: costByMonth(`${r.y}-${String(r.m).padStart(2, "0")}`, "pk") }));
        pkCard = combo(g, "Packing written vs material cost", "last 14 months", packMoM.map(r => ({ k: r.k, v: r.v || 0 })), "Written", money, pkCost, "Material cost", money, { headVal: money(lastV(packMoM)) });
        const lastCost = pkCost.length ? pkCost[pkCost.length - 1].v : 0, lastWr = lastV(packMoM) || 0;
        note(pkCard, `Packing written ${money(lastWr)} vs material bought ${money(lastCost)} this month${lastWr ? ` — material is ${pct(lastCost / lastWr)} of packing revenue` : ""}. Material cost = card spend in the "Job Supplies / Packing Material" category.`, "how");
      } else {
        pkCard = lines(g, "Packing written — momentum", "last 14 months", [{ label: "Packing written", series: packMoM, color: LIMED }], money, { headVal: money(lastV(packMoM)) });
      }
      pkCard.classList.add("span2");   // #2: packing spans the full row
      // Storage — income vs rent/lease cost + the active/recurring customer base, SIDE BY SIDE (two halves).
      const stoRev = momSeries("storage", "Storage Additional Revenue", 14);
      if (hasCostData) {
        const stoCost = stoRev.map(r => ({ k: r.k, v: costByMonth(`${r.y}-${String(r.m).padStart(2, "0")}`, "sto") }));
        const sc = combo(g, "Storage income vs cost", "last 14 months", stoRev.map(r => ({ k: r.k, v: r.v || 0 })), "Income", money, stoCost, "Storage cost", money, { headVal: money(lastV(stoRev)) });
        const lc = stoCost.length ? stoCost[stoCost.length - 1].v : 0, li = lastV(stoRev) || 0;
        note(sc, `Storage income ${money(li)} vs cost ${money(lc)} this month — net ${money(li - lc)}. Cost = card spend in the "Rent and Lease / Storage" category.`, "how");
      } else {
        lines(g, "Storage income", "last 14 months", [{ label: "Storage income", series: stoRev, color: TEAL }], money, { headVal: money(lastV(stoRev)) });
      }
      // storage base: active vs recurring customers — the number storage PLANNING grows from
      const stoCust = momReduce("storage", 14, rs => { const set = new Set(); rs.forEach(r => set.add(String(r.Customer || ""))); return set.size; });
      const stoRec = momReduce("storage", 14, rs => { const set = new Set(); rs.forEach(r => { if (!/pickup|delivery/i.test(String(r["Payment Type"] || ""))) set.add(String(r.Customer || "")); }); return set.size; });
      const cStC = lines(g, "Storage customers — active vs recurring", "last 14 months", [ { label: "Active", series: stoCust, color: TEAL }, { label: "Recurring", series: stoRec, color: INK } ], fmtN, { headVal: fmtN(lastV(stoCust) || 0) });
      note(cStC, "Active = any storage payment that month; recurring = monthly-billed customers (excludes one-off pickup/delivery payments). Growth or churn in the recurring line is the storage-planning signal.", "how");
      // (#1) "Packing by type — estimate vs written" removed per Tornike 2026-07-15.
    }

    /* ---- 13 · Reviews Production ---- */
    if (SEC("Reviews Production")) {
      const g = section("Reviews Production", "reviews written, negative reviews and platform footprint");
      const negN = reduceMonth("negative_reviews", curY, mo, rs => rs.length) || 0;
      const negPM = reduceMonth("negative_reviews", PMY, PM, rs => rs.length) || 0;
      const negLY = reduceMonth("negative_reviews", curY - 1, mo, rs => rs.length) || 0;
      const kg = document.createElement("div"); kg.className = "mrx-grid k"; kg.style.gridColumn = "1/-1"; g.appendChild(kg);
      // C8: number unchanged (all breakdown reviews) — the label now says so
      [ { l: "All Reviews Written (incl. non-counting)", v: fmtN(revWritten), c: revWritten, ly: revWrittenLY, pm: revWrittenPM, icon: KIC.star },
        { l: "Negative Reviews", v: fmtN(negN), c: negN, ly: negLY, pm: negPM, icon: KIC.warn, inv: 1 }
      ].forEach(k => kpiTile(kg, k));
      /* ---- goal progress — END-OF-PERIOD footprint target (Tornike 2026-07-14) ----
         "the goals are set for the end of the period — at the end of aug it must be those
         numbers": per-platform cumulative public-review targets vs the current footprint. */
      if (goalDate) {
        const gY = +goalDate.slice(0, 4), gM = +goalDate.slice(5, 7);
        const endM = gM === 1 ? 12 : gM - 1, endY = gM === 1 ? gY - 1 : gY;    // goal dated Sep 1 = target for END of August
        const gp = {}; goalRows.filter(r => String(r.Date || "").slice(0, 10) === goalDate)
          .forEach(r => { const k = String(r.Platform || "—"); gp[k] = (gp[k] || 0) + num(r["Number of Reviews"]); });
        const rcRows2 = (DS.review_counts || []).filter(coRow);
        // the goals sheet and the counts sheet spell platforms slightly differently
        // ("NextdoorShafto" vs "Nextdoor Shafto") — join on case-folded alphanumerics.
        // Display always uses the GOAL sheet's name.
        const nk = s => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
        const snapDates = [...new Set(rcRows2.map(r => String(r.Date || "").slice(0, 10)))].filter(d => d <= monthEndKey).sort();
        const snap = snapDates[snapDates.length - 1], snapPrev = snapDates[snapDates.length - 2];
        const footAt = d => { const m2 = {}; rcRows2.filter(r => String(r.Date || "").slice(0, 10) === d).forEach(r => { const k = nk(r.Platform); m2[k] = (m2[k] || 0) + num(r["Number of Reviews"]); }); return m2; };
        const cur2 = snap ? footAt(snap) : {}, prev2 = snapPrev ? footAt(snapPrev) : null;
        const plats = Object.keys(gp).sort((a, b) => gp[b] - gp[a]);
        if (plats.length) {
          const goalTot = plats.reduce((a, k) => a + gp[k], 0);
          const nowTot = plats.reduce((a, k) => a + (cur2[nk(k)] || 0), 0);
          const toGo = Math.max(0, goalTot - nowTot);
          const monthsLeft = Math.max(0, (gY * 12 + gM - 1) - (curY * 12 + mo));
          const addedPM = prev2 ? plats.reduce((a, k) => a + (cur2[nk(k)] || 0), 0) - plats.reduce((a, k) => a + (prev2[nk(k)] || 0), 0) : null;
          const ended = !!goalPast;
          const untracked = plats.filter(k => !(nk(k) in cur2));
          const pcell = (now, goal2) => { const p = goal2 ? Math.min(100, now / goal2 * 100) : 0; return `<td class="bar"><i style="width:${p.toFixed(0)}%;background:${p >= 100 ? "#dcecab" : "#e7ecfb"}"></i><span>${p.toFixed(0)}%</span></td>`; };
          const rowsH = plats.map(k => { const now = cur2[nk(k)] || 0, gl = gp[k], d = gl - now; return `<tr><td>${esc(k)}${(nk(k) in cur2) ? "" : ` <span style="color:#b7791a;font-weight:800" title="No platform with this name in the review-counts sheet">⚠</span>`}</td>${td(fmtN(now))}${td(fmtN(gl))}${td(d > 0 ? fmtN(d) : "✓ done", d > 0 ? "font-weight:800" : "color:#1c7a4a;font-weight:800")}${pcell(now, gl)}</tr>`; }).join("")
            + `<tr style="font-weight:800;border-top:2px solid #c9d1dc"><td>Total</td>${td(fmtN(nowTot))}${td(fmtN(goalTot))}${td(toGo > 0 ? fmtN(toGo) : "✓ done", toGo > 0 ? "" : "color:#1c7a4a")}${pcell(nowTot, goalTot)}</tr>`;
          const gc = tableCard(g, "Review goal — where we stand", (ended ? `period ended ${MON[endM]} ${endY}` : `target for end of ${MON[endM]} ${endY}`) + ` · footprint as of ${snap || "—"}`,
            `<table class="mrx-tbl"><thead><tr><th>Platform</th><th>Reviews now</th><th>Goal</th><th>To go</th><th>Progress</th></tr></thead><tbody>${rowsH}</tbody></table>`,
            { icon: KIC.trend, headVal: goalTot ? pct(nowTot / goalTot) : "—" });
          if (!ended && toGo > 0 && monthsLeft > 0) note(gc, `${fmtN(toGo)} reviews to go in ${monthsLeft} month${monthsLeft > 1 ? "s" : ""} — that's ~${fmtN(Math.ceil(toGo / monthsLeft))}/month${addedPM != null ? `; the footprint grew ${addedPM >= 0 ? "+" : ""}${fmtN(addedPM)} last month${addedPM < toGo / monthsLeft ? " — BELOW the needed pace" : " — on pace"}` : ""}.`);
          if (untracked.length) note(gc, `⚠ ${untracked.map(esc).join(", ")}: the goal sheet names ${untracked.length > 1 ? "these platforms" : "this platform"} but the review-counts sheet has no matching row — showing 0. If ${untracked.length > 1 ? "they exist" : "it exists"} under another name there, align the naming and this fixes itself.`);
          note(gc, `Goals are end-of-period targets: by ${MON[endM]} ${endY} the total public reviews on each platform must reach the Goal column. "Reviews now" is the latest footprint snapshot (fct_review_counts); progress = now ÷ goal.`, "how");
        }
      }
      rankBars(g, "Reviews by source", segReduce("reviews_breakdown", "Source", rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0), curY, mo), fmtN, { top: 8 });
      // public review footprint by platform (fct_review_counts — served, never rendered before)
      const revByPlat = segReduce("review_counts", "Platform", rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0), curY, mo).filter(r => r.v > 0 && r.k !== "—");
      if (revByPlat.length) rankBars(g, "Public review footprint by platform", revByPlat, fmtN, { top: 12, span2: true, sub: monLbl, noteKind: "how", note: "Total public reviews on file per platform — the reputation that drives lead flow." });
    }

    /* ---- 14 · Claims ---- */
    if (SEC("Claims")) {
      const g = section("Claims", "claims filed this month, by cause and responsibility");
      const claimsN = reduceMonth("claims", curY, mo, rs => rs.length) || 0;
      const claimsPM = reduceMonth("claims", PMY, PM, rs => rs.length) || 0;
      const claimsLY = reduceMonth("claims", curY - 1, mo, rs => rs.length) || 0;
      const claimRate = jobs ? claimsN / jobs * 100 : null;
      const kg = document.createElement("div"); kg.className = "mrx-grid k"; kg.style.gridColumn = "1/-1"; g.appendChild(kg);
      [ { l: "Claims Filed", v: fmtN(claimsN), c: claimsN, ly: claimsLY, pm: claimsPM, icon: KIC.warn, inv: 1 },
        { l: "Claims / 100 jobs", v: claimRate == null ? "—" : fmt1(claimRate), c: claimRate, ly: (jobsLY ? claimsLY / jobsLY * 100 : null), pm: (jobsPM ? claimsPM / jobsPM * 100 : null), icon: KIC.pct, inv: 1 }
      ].forEach(k => kpiTile(kg, k));
      // raw claims-sheet values spell it 'Forman' — display-side fix only, data keys untouched
      const dispResp = v => String(v).replace(/\bForman('s)?\b/g, (m, p) => "Foreman" + (p || ""));
      rankBars(g, "Claims by responsibility", segReduce("claims", "Responsibility", rs => rs.length, curY, mo).map(s => ({ ...s, k: dispResp(s.k) })), fmtN, { top: 8 });
      donut(g, "Claims by reason", segReduce("claims", "Reason", rs => rs.length, curY, mo).filter(r => r.k !== "—" && r.k !== "(blank)"), fmtN, { center: fmtN(reduceMonth("claims", curY, mo, rs => rs.filter(r => r.Reason && r.Reason !== "(blank)").length) || 0), centerLbl: "classified" });
      // line-level register (deck s55): the actual claims of the month
      const clReg = (reduceMonth("claims", curY, mo, rs => rs) || []).slice().sort((a, b) => String(b["Created Date"]).localeCompare(String(a["Created Date"]))).slice(0, 14);
      if (clReg.length) {
        const clHtml = `<table class="mrx-tbl"><thead><tr><th>Date</th><th>Customer</th><th>Reason</th><th>Responsibility</th><th>Status</th></tr></thead><tbody>${clReg.map(r => `<tr><td>${esc(String(r["Created Date"] || "").slice(0, 10))}</td><td>${esc(r.Customer || "—")}</td>${td(esc(r.Reason || "—"))}${td(esc(dispResp(r.Responsibility || "—")))}${td(esc(r.Status || "—"))}</tr>`).join("")}</tbody></table>`;
        tableCard(g, "This month's claims", monLbl + (claimsN > 14 ? ` · latest 14 of ${fmtN(claimsN)}` : ""), clHtml, { span2: false, icon: KIC.grid, headVal: fmtN(claimsN) });
      }
    }

    /* ---- 15 · Refunds & Cost of Quality ---- */
    if (SEC("Refunds & Cost of Quality")) {
      const g = section("Refunds & Cost of Quality", "refund dollars this month, by reason — with the full list");
      const refByReason = segReduce("refunds", "Reason", rs => Math.abs(rs.reduce((a, r) => a + num(r["Total refund"]), 0)), curY, mo).filter(r => r.v > 0);
      const refTot = Math.abs(reduceMonth("refunds", curY, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      const refTotLY = Math.abs(reduceMonth("refunds", curY - 1, mo, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      const refTotPM = Math.abs(reduceMonth("refunds", PMY, PM, rs => rs.reduce((a, r) => a + num(r["Total refund"]), 0)) || 0);
      const kg = document.createElement("div"); kg.className = "mrx-grid k"; kg.style.gridColumn = "1/-1"; g.appendChild(kg);
      [ { l: "Refunds Paid", v: money(refTot), c: refTot, ly: refTotLY, pm: refTotPM, icon: KIC.dollar, inv: 1 },
        { l: "Refund % of revenue", v: rev ? pct(refTot / rev) : "—", c: rev ? refTot / rev : null, ly: revLY ? refTotLY / revLY : null, icon: KIC.pct, inv: 1 }
      ].forEach(k => kpiTile(kg, k));
      rankBars(g, "Refunds by reason", refByReason, money, { top: 8, sub: `${money(refTot)} · ${rev ? pct(refTot / rev) : "—"} of revenue`, headVal: money(refTot), note: `${money(refTot)} refunded in ${MON[mo]} — ${rev ? pct(refTot / rev) : "—"} of revenue.` });
      // line-level register (deck s56): the actual refunds of the month, largest first
      const rfReg = (reduceMonth("refunds", curY, mo, rs => rs) || []).slice().sort((a, b) => Math.abs(num(b["Total refund"])) - Math.abs(num(a["Total refund"]))).slice(0, 14);
      if (rfReg.length) {
        const rfHtml = `<table class="mrx-tbl"><thead><tr><th>Customer</th><th>Foreman</th><th>Sales</th><th>Reason</th><th>Refund</th></tr></thead><tbody>${rfReg.map(r => `<tr><td>${esc(r.Customer || "—")}</td>${td(esc(r.Foreman || "—"))}${td(esc(r["Sales Person"] || "—"))}${td(esc(r.Reason || "—"))}${td(money(Math.abs(num(r["Total refund"]))), "font-weight:800")}</tr>`).join("")}</tbody></table>`;
        tableCard(g, "This month's refunds", monLbl + " · largest first", rfHtml, { span2: false, icon: KIC.grid, headVal: money(refTot) });
      }
    }

    /* ---- 14 · Repeat & Referral Business (formerly "Returned & Recommended" — N3) ---- */
    if (SEC("Repeat & Referral Business")) {
      const g = section("Repeat & Referral Business", "repeat and referral customers — how much our service is liked");
      const RRS = ["Returned Customer", "Recommended"];
      const isRR = r => RRS.indexOf(String(r.Source)) >= 0;
      const rrRev = valueFor("closing", "Revenue", curY, mo, { pre: isRR }) || 0, rrRevLY = valueFor("closing", "Revenue", curY - 1, mo, { pre: isRR }), rrRevPM = valueFor("closing", "Revenue", PMY, PM, { pre: isRR });
      const rrJobs = valueFor("closing", "Total Jobs", curY, mo, { pre: isRR }) || 0, rrJobsLY = valueFor("closing", "Total Jobs", curY - 1, mo, { pre: isRR }), rrJobsPM = valueFor("closing", "Total Jobs", PMY, PM, { pre: isRR });
      // op profit needs segKeys scoping → sum the two Source segments (current month reuses opBySrcCur)
      const sumRR = arr => arr.reduce((t, s2) => RRS.indexOf(s2.k) >= 0 ? t + s2.v : t, 0);
      const rrOp = sumRR(opBySrcCur), rrOpLY = sumRR(segSeries("closing", "Operational Profit by Formula", "Source", curY - 1, mo));
      const rrShare = rev ? rrRev / rev : null, rrShareLY = revLY ? (rrRevLY || 0) / revLY : null, rrSharePM = revPM ? (rrRevPM || 0) / revPM : null;
      const kg2 = document.createElement("div"); kg2.className = "mrx-grid k"; kg2.style.gridColumn = "1/-1"; g.appendChild(kg2);
      [ { l: "Repeat + Referral Revenue", v: money(rrRev), c: rrRev, ly: rrRevLY, pm: rrRevPM, icon: KIC.dollar },
        { l: "Share of Revenue", v: pct(rrShare), c: rrShare, ly: rrShareLY, pm: rrSharePM, icon: KIC.pct },
        { l: "Repeat + Referral Jobs", v: fmtN(rrJobs), c: rrJobs, ly: rrJobsLY, pm: rrJobsPM, icon: KIC.truck },
        { l: "Gross Profit (before refunds)", v: money(rrOp), c: rrOp, ly: rrOpLY, icon: KIC.trend }
      ].forEach(k => kpiTile(kg2, k));
      const rrT = yearsArr(5).map(y => ({ k: String(y), v: valueFor("closing", "Revenue", y, mo, { pre: isRR }) }));
      yoyBars(g, "Repeat & Referral revenue — 5-yr", rrT, moneyC, { headVal: money(rrRev), chips: dchips([[rrRev, rrRevLY, "YoY"]]) });
      const shareT = momReduce("closing", 12, rs => { const t = M["Revenue"].fn(rs); const rr2 = M["Revenue"].fn(rs.filter(isRR)); return t ? rr2 / t : null; });
      const cSh = lines(g, "Share of revenue from repeat & referral", "last 12 months", [{ label: "Repeat & Referral share", series: shareT, color: BLUE }], pct, { headVal: pct(rrShare) });
      note(cSh, `Every point is the % of that month's revenue that came from repeat or referred customers — the cleanest loyalty pulse. ${MON[mo]}: ${pct(rrShare)}.`, "how");
      const retT = yearsArr(5).map(y => valueFor("closing", "Revenue", y, mo, { pre: r => String(r.Source) === "Returned Customer" }) || 0);
      const recT = yearsArr(5).map(y => valueFor("closing", "Revenue", y, mo, { pre: r => String(r.Source) === "Recommended" }) || 0);
      groupedBars(g, "Repeat vs Referral — revenue by year", yearsArr(5).map(String), retT, "Repeat (returned customer)", recT, "Referral (recommended)", money, { sub: MON[mo] + " each year" });
      // C2: both trend lines use the canonical dual-basis Booking Rate (no inline ratios)
      // #8 (Tornike 2026-07-15): show Repeat (returned) and Referral (recommended) as SEPARATE lines vs overall.
      const retBookT = bookRateTrend(r => String(r.Source) === "Returned Customer", 12);
      const recBookT = bookRateTrend(r => String(r.Source) === "Recommended", 12);
      const allBookT = bookRateTrend(null, 12);
      const cBk = lines(g, "Repeat & Referral booking rate vs overall", "last 12 months", [ { label: "Repeat (returned)", series: retBookT, color: LIMED }, { label: "Referral (recommended)", series: recBookT, color: BLUE }, { label: "All leads", series: allBookT, color: CTX } ], pct);
      note(cBk, `Repeat (returned) and Referral (recommended) leads should each convert far above the average — they already trust you. If either coloured line dips toward the gray (all-leads) line, warm-lead follow-up is slipping.`);
    }

    /* ---------- layout parity: no half-empty rows, ever ----------
       Walk each section grid in order; any half-width card left without a partner (because a full-row
       element or the section end follows it) is promoted to full row. Conditional cards can no longer
       leave a dangling half-empty cell. */
    [].forEach.call(root.querySelectorAll(".mrx-sec > .mrx-grid"), gr => {
      if (gr.classList.contains("k")) return;                      // KPI grids lay themselves out
      let pending = null;
      [].forEach.call(gr.children, el => {
        const isCard = el.classList && el.classList.contains("mrx-card");
        if (!isCard || el.classList.contains("span2")) {           // full-row: span2 card, KPI sub-grid, exec text
          if (pending) { pending.classList.add("span2"); pending = null; }
        } else pending = pending ? null : el;
      });
      if (pending) pending.classList.add("span2");
    });

    /* ---------- TOC + controls (UX audit 2026-07-14) ----------
       Always-visible sticky TOC with scroll-spy (the active chip highlights and stays in
       view), part-group labels, and a ‹ month › stepper so month-to-month comparison —
       the page's core gesture — is one click without scrolling back to the cover. */
    if (secList.length >= 3) {
      secList.forEach((s, i) => {
        const p = tocParts.find(x => x.at === i);
        if (p) { const lb = document.createElement("span"); lb.className = "mrx-tocpart"; lb.textContent = p.label; toc.appendChild(lb); }
        const chip = document.createElement("span"); chip.className = "mrx-tocchip"; chip.dataset.sec = s.n;
        chip.textContent = s.n + " " + (TOCNAME[s.title] || s.title);
        chip.onclick = () => { s.wrap.classList.remove("collapsed"); collapsedSet.delete(s.title); saveCollapsed(); s.wrap.scrollIntoView({ behavior: "smooth", block: "start" }); };
        toc.appendChild(chip);
      });
      // month stepper — the dominant gesture, one click, scroll position preserved by reRender
      const step = document.createElement("span"); step.className = "mrx-tocstep";
      step.innerHTML = `<button type="button" data-mprev title="Previous month">‹</button><b>${MS[mo]} '${String(curY).slice(2)}</b><button type="button" data-mnext title="Next month">›</button>`;
      toc.appendChild(step);
      step.querySelector("[data-mprev]").onclick = () => { st.month--; if (st.month < 1) { st.month = 12; st.year--; } saveMonth(); reRender(); };
      step.querySelector("[data-mnext]").onclick = () => { st.month++; if (st.month > 12) { st.month = 1; st.year++; } saveMonth(); reRender(); };
      // scroll-spy: highlight the chip of the topmost visible section
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (!en.isIntersecting) return;
          const n = (secList.find(s => s.wrap === en.target) || {}).n; if (!n) return;
          toc.querySelectorAll(".mrx-tocchip.on").forEach(c => c.classList.remove("on"));
          const c = toc.querySelector(`.mrx-tocchip[data-sec="${n}"]`);
          if (c) { c.classList.add("on"); if (c.scrollIntoView) c.scrollIntoView({ block: "nearest", inline: "nearest" }); }
        });
      }, { rootMargin: "-15% 0px -70% 0px" });
      secList.forEach(s => io.observe(s.wrap));
    } else toc.style.display = "none";
    function saveMonth() { try { localStorage.setItem("ztzMrMonth", st.year + "-" + String(st.month).padStart(2, "0")); } catch (e) {} }
    // month flips keep the reader's place — full re-render, then restore the scroll offset
    const reRender = async () => {
      if (typeof renderPage !== "function") { location.reload(); return; }
      const scroller = root.closest(".rs-content") || document.querySelector(".rs-content");
      const y = scroller ? scroller.scrollTop : 0;
      await renderPage();
      const s2 = document.querySelector(".rs-content"); if (s2) s2.scrollTop = y;
    };
    document.getElementById("mrMonth").onchange = e => { st.month = +e.target.value; saveMonth(); reRender(); };
    document.getElementById("mrYear").onchange = e => { st.year = +e.target.value; saveMonth(); reRender(); };
    const pb = document.getElementById("mrPrint"); if (pb) pb.onclick = downloadReportPDF;
    const pv = document.getElementById("mrPrint2"); if (pv) pv.onclick = () => window.print();
    const rl = document.getElementById("mrRetryLoad"); if (rl) rl.onclick = () => reRender();   // failed feeds aren't cached — a re-render refetches them
}

registerPage({ id: "monthly-report", group: "pulse", title: "Monthly Report", render(host) { return renderMonthly(host, null); } });

/* Themed dashboards — one page per topic, each a lite-mode slice of the SAME report
   (same data, same visuals, section subset). Overlaps (Repeat & Referral, Phone & Response)
   are intentional so each department's dashboard is self-contained. Replaces the six old
   "*-team" Monthly Review pages + MR_TEAMS. */
const MR_DASH = [
  // Sales
  { id: "sales-funnel", group: "sales", title: "Lead Funnel & Conversion", sections: ["Demand & Lead Funnel", "Lead Segmentation"] },
  { id: "sales-perf", group: "sales", title: "Sales Team Performance", sections: ["Sales Team Performance"] },
  { id: "sales-geo", group: "financial", title: "Geography", sections: ["Geography — by State"] },
  // Marketing
  { id: "mkt-roi", group: "marketing", title: "Return on Investment", sections: ["Marketing ROI"] },
  { id: "mkt-sources", group: "marketing", title: "Lead Sources & Channels", sections: ["Lead Sources"] },
  { id: "mkt-phone", group: "marketing", title: "Phone & Response", sections: ["Phone & Response"] },
  // Logistics
  { id: "log-foreman", group: "logistics", title: "Foreman of the Month", sections: ["Operations & Crew (Foreman)"] },
  { id: "log-packing", group: "logistics", title: "Packing & Storage", sections: ["Packing & Storage"] },
  { id: "log-fleet", group: "logistics", title: "Fleet", sections: ["Fleet"] },
  // Financial
  { id: "fin-revenue", group: "financial", title: "Revenue & Profit", sections: ["Executive Summary", "Revenue & Growth", "Revenue Composition & Segments", "Per-Job Profitability", "Profitability & P&L"] },
  { id: "fin-rr", group: "financial", title: "Repeat & Referral", sections: ["Repeat & Referral Business"] },
  // Reviews
  { id: "rev-production", group: "reviews", title: "Reviews Production", sections: ["Reviews Production"] },
  // Support
  { id: "sup-claims", group: "support", title: "Claims", sections: ["Claims"] },
  { id: "sup-refunds", group: "support", title: "Refunds & Cost of Quality", sections: ["Refunds & Cost of Quality"] },
  { id: "sup-phone", group: "support", title: "Phone & Response", sections: ["Phone & Response"] },
];
MR_DASH.forEach(d => registerPage({ id: d.id, group: d.group, title: d.title, render(host) { return renderMonthly(host, { id: d.id, title: d.title, label: d.title, sections: d.sections, lite: true }); } }));

var st = window.__mrState || (window.__mrState = { month: 0, year: 0, years: 5 });
