/* DIFFERENT ANALYSIS ▸ Seasonal Planning — Area Plan and Area Master joined (2026-09-03).
 *
 * His words: "we should kinda join them - since they cover the same general idea. make sure
 * to dont loose any data we gathered". And his four answers that shape the page:
 *   · the first decision is hiring, then marketing, then the base question -- in that order;
 *   · the season is DETERMINED BY THE DATA (model.season, from the demand curve);
 *   · BOOKED means a closing exists (one rule for the state plan and the city evidence);
 *   · the foreman table SEEDS FROM WHAT ACTUALLY WORKED last season, split by company where
 *     both operate, and the Planning Variables page overrides any cell.
 *
 * THE SHAPE: one page, one scroll, three bands, hinged on a single STATE FOCUS.
 *   BAND A  DECIDE    — state grain, obeys the period picker. The control spine, the decision
 *                       hero, the dials, demand by state, THE EDITABLE PLAN TABLE, county leak.
 *   BAND B  EVIDENCE  — city grain, year to date (its own clock, declared at the band head).
 *                       Ledger, distance ladder, biggest gaps, claims by city, the master table.
 *   BAND C  REFERENCE — collapsed: the outside research, rent vs buy, the method.
 * Clicking a plan row, a demand bar or a Band B chip sets the focus; every Band B panel
 * filters to it; nothing that selects the focus ever hides itself (NO_BAR_COLLAPSE).
 *
 * WHAT IS DELIBERATELY NOT RECONCILED (his rule: never silently). The two bands run on two
 * clocks -- the period picker vs "this year" -- and count jobs two ways (the plan by closing
 * rows in the closing's state; the master by last-encounter closings in the lead's pickup
 * city). Both are labelled where they appear and the coverage line says how much of a
 * state's leads the city rows carry. The four external columns (ad spend, ad sources, search
 * volume, wealth tier) are parked by his call and shown as one note, not four blank columns.
 *
 * localStorage: ztzAreaPlan.v5 (the inputs shape gained focus + view state; a v4 blob must
 * not be read).
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_plan) {
    RS.DATASETS.area_plan = {
      table: "mart_area_plan",
      cols: ["ym", "company", "state", "county",
             "leads", "qualified", "lost", "booked", "total_cf", "built_at"],
    };
  }
  // the per-city master, whole: every column the mart builds. A column not listed never
  // arrives, and the CSV promises all of them.
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_master) {
    RS.DATASETS.area_master = {
      table: "mart_area_master",
      cols: ["State", "City", "County", "Leads", "Booked", "Booking Rate", "Leads 90d",
             "Jobs", "Revenue", "Avg Ticket", "Revenue Per Lead", "Avg Quote", "Avg CF",
             "Nearest Base", "Miles To Base", "Foremen At Base", "Crew At Base", "Untapped",
             "Claims", "Claims Per 100 Jobs", "Claim Refunds", "Claims Gone Public",
             "Top Claim Reason", "Ad Spend", "Ad Sources", "Search Volume", "Wealth Tier",
             "Latitude", "Longitude"],
    };
  }
})();

(() => {
  function injectStyle() {
    if (document.getElementById("ap-style")) return;
    const st = document.createElement("style");
    st.id = "ap-style";
    st.textContent = `
    /* Seasonal Planning (ap2-): only what the kit cannot say. */
    .ap2-ctl{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}
    .ap2-ctl>.ap2-note{padding-bottom:8px}
    .ap2-warn{font-size:12px;color:var(--warn);font-weight:700}
    .ap2-band{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap;margin:22px 0 10px;
      padding-top:14px;border-top:2px solid var(--line)}
    .ap2-band .k{font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
      color:var(--brand)}
    .ap2-band h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.3px}
    .ap2-band .clock{font-size:12px;color:var(--muted);margin-left:auto}
    .ap2-say{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:none;margin:0 0 12px}
    .ap2-say b{color:var(--ink)}
    .ap2-stamps{display:flex;gap:16px;flex-wrap:wrap;font-size:11px;color:var(--faint);
      margin:6px 0 0}
    /* the hero: decision numbers as one connected strip */
    .ap2-hero{padding:20px 22px 16px}
    .ap2-flow{display:flex;gap:0;align-items:stretch;flex-wrap:wrap}
    .ap2-step{flex:1 1 130px;min-width:128px;padding:2px 18px 2px 0;position:relative}
    .ap2-step + .ap2-step{padding-left:18px;border-left:1px solid var(--line-2)}
    .ap2-step .l{font-size:10px;color:var(--faint);font-weight:800;text-transform:uppercase;
      letter-spacing:.08em;white-space:nowrap}
    .ap2-step .v{font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.15;
      margin-top:4px;font-variant-numeric:tabular-nums}
    .ap2-step .v.warn{color:var(--warn)} .ap2-step .v.good{color:var(--brand)}
    .ap2-step .s{font-size:11px;color:var(--faint);margin-top:3px;line-height:1.45}
    .ap2-dials{display:flex;gap:28px;flex-wrap:wrap;margin-top:16px;padding-top:14px;
      border-top:1px solid var(--line-2)}
    .ap2-dial .l{font-size:10.5px;font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;color:var(--muted);margin-bottom:5px}
    .ap2-dial .m{font-size:11.5px;color:var(--faint);margin-top:4px;max-width:250px;
      line-height:1.45}
    /* demand: booked inside leads, per state; the row is a focus target */
    .ap2-dem{display:grid;grid-template-columns:minmax(120px,170px) minmax(80px,1fr) auto;
      gap:12px;align-items:center;padding:8px 6px;border-bottom:1px solid var(--line-2);
      cursor:pointer;border-radius:6px}
    .ap2-dem:last-child{border-bottom:0}
    .ap2-dem:hover{background:var(--panel-2)}
    .ap2-dem.on{background:color-mix(in srgb,var(--brand) 10%,transparent)}
    .ap2-dem .n{font-weight:700;font-size:13.5px}
    .ap2-dem .n small{display:block;font-weight:600;font-size:11px;color:var(--faint)}
    .ap2-dem .t{height:14px;background:var(--panel-2);border-radius:7px;overflow:hidden;
      position:relative}
    .ap2-dem .t .lead{position:absolute;inset:0 auto 0 0;
      background:color-mix(in srgb,var(--brand) 26%,var(--panel-2));border-radius:7px}
    .ap2-dem .t .book{position:absolute;inset:0 auto 0 0;background:var(--brand);
      border-radius:7px}
    .ap2-dem .v{font-size:12.5px;color:var(--muted);text-align:right;white-space:nowrap;
      font-variant-numeric:tabular-nums}
    .ap2-dem .v b{color:var(--ink)}
    .ap2-yoy{font-weight:800;font-size:11.5px}
    .ap2-yoy.up{color:var(--pos)} .ap2-yoy.dn{color:var(--neg)}
    .ap2-lost{color:var(--warn);font-weight:800}
    /* the plan table: focus row, company sub-rows, the measured counterpart */
    .ap2-row{cursor:pointer} .ap2-row:hover td{background:var(--panel-2)}
    .ap2-row.on td{background:color-mix(in srgb,var(--brand) 10%,transparent)}
    .ap2-row.on td:first-child{box-shadow:inset 3px 0 0 var(--brand)}
    .ap2-sub td{color:var(--muted);font-size:12px;background:var(--panel-2)}
    .ap2-sub td:first-child{padding-left:26px}
    .ap2-tie{font-size:11.5px;color:var(--faint);margin-top:8px}
    .ap2-tie.bad{color:var(--warn);font-weight:700}
    /* the leak rows share the reviews-cases bar language */
    .ap2-leak{display:grid;grid-template-columns:minmax(150px,240px) minmax(60px,1fr) auto;
      gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line-2)}
    .ap2-leak:last-child{border-bottom:0}
    .ap2-leak .n{font-size:13px;font-weight:600}
    .ap2-leak .n small{color:var(--faint);font-weight:700;margin-left:6px}
    .ap2-leak .t{height:10px;background:var(--panel-2);border-radius:5px;overflow:hidden}
    .ap2-leak .t i{display:block;height:100%;background:var(--warn);border-radius:5px}
    .ap2-leak .v{font-size:12.5px;color:var(--muted);text-align:right;white-space:nowrap;
      font-variant-numeric:tabular-nums}
    /* Band B: the evidence (carried from Area Master, prefix renamed) */
    .ap2-led{display:flex;flex-wrap:wrap;gap:0;padding:18px 20px}
    .ap2-led-g{flex:1 1 165px;min-width:0;padding:0 18px 0 0}
    .ap2-led-g + .ap2-led-g{padding-left:18px;border-left:1px solid var(--line-2)}
    .ap2-led-g>.l{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
      color:var(--faint)}
    .ap2-led-g>.v{font-size:clamp(23px,1.9vw,30px);font-weight:800;letter-spacing:-.8px;
      line-height:1.15;margin-top:5px;font-variant-numeric:tabular-nums;color:var(--ink)}
    .ap2-led-g>.v.pos{color:var(--brand)} .ap2-led-g>.v.warn{color:var(--warn)}
    .ap2-led-g>.s{font-size:12px;color:var(--muted);line-height:1.55;margin-top:6px}
    .ap2-led-g>.s b{color:var(--ink)}
    .ap2-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(370px,1fr));gap:12px;
      margin-top:12px}
    .ap2-grid>.panel{min-width:0}
    .ap2-lad{display:grid;grid-template-columns:76px minmax(60px,1fr) auto auto;gap:10px;
      align-items:center;padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.5px}
    .ap2-lad:last-child{border-bottom:0}
    .ap2-lad .t{height:13px;background:var(--panel-2);border-radius:7px;overflow:hidden}
    .ap2-lad .t i{display:block;height:100%;background:var(--brand);border-radius:7px}
    .ap2-lad .v{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);
      white-space:nowrap}
    .ap2-lad .v b{color:var(--ink)}
    .ap2-small{color:var(--faint);font-size:11.5px;white-space:nowrap}
    .ap2-th{cursor:pointer;user-select:none;white-space:nowrap}
    .ap2-th:hover{color:var(--brand)} .ap2-th.on{color:var(--brand)}
    .ap2-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;
      font-size:12.5px;color:var(--faint)}
    .ap2-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}
    .ap2-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:0 0 12px}
    .ap2-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);
      border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;
      margin-bottom:1px}
    .ap2-in:focus{border-color:var(--brand)}
    .ap2-chip{font-family:inherit;font-size:12px;font-weight:700;padding:5px 10px;
      border-radius:999px;border:1px solid var(--line);background:var(--panel);
      color:var(--muted);cursor:pointer}
    .ap2-chip.on{background:var(--brand);color:#fff;border-color:var(--brand)}
    /* Band C: the outside picture as cards */
    .ap2-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
    .ap2-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;
      background:var(--panel)}
    .ap2-card.hot{border-color:var(--warn)}
    .ap2-card h5{margin:0 0 6px;font-size:14px;font-weight:800;display:flex;gap:8px;
      align-items:baseline}
    .ap2-card .case{font-size:12.5px;line-height:1.6;color:var(--ink)}
    .ap2-card .towns{font-size:12px;color:var(--muted);margin-top:7px;line-height:1.5}
    .ap2-card .foot{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--faint);
      margin-top:9px;padding-top:8px;border-top:1px solid var(--line-2);
      font-variant-numeric:tabular-nums}
    .ap2-tension{font-size:11.5px;color:var(--warn);font-weight:700;margin-top:7px}
    .ap2-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.08em;
      text-transform:uppercase;color:var(--muted);margin-bottom:3px}
    .ap2-eyebrow + .panel-title{margin-bottom:5px}
    .ap2-note{font-size:12.5px;color:var(--muted);line-height:1.6}
    .ap2-callout{background:color-mix(in srgb,var(--brand-d) 7%,transparent);
      border:1px solid color-mix(in srgb,var(--brand-d) 30%,transparent);border-radius:12px;
      padding:14px 16px;font-size:13px;line-height:1.65;margin-top:12px}
    details.ap2-ref>summary{cursor:pointer;list-style:none;padding:12px 16px;
      border:1px solid var(--line);border-radius:12px;background:var(--panel);font-weight:800;
      font-size:13.5px;margin-top:12px}
    details.ap2-ref>summary::-webkit-details-marker{display:none}
    details.ap2-ref>summary::before{content:"▸ ";color:var(--brand)}
    details.ap2-ref[open]>summary::before{content:"▾ "}
    details.ap2-ref>summary small{font-weight:600;color:var(--faint);margin-left:8px}
    details.ap2-ref>.panel{margin-top:8px}
    `;
    document.head.appendChild(st);
  }

  const LS_KEY = "ztzAreaPlan.v5";
  // HIS TABLE (2026-08-19), kept as a NAMED alternative seed. Rows are SERVICE AREAS, not
  // garages: NY is worked from the NJ base.
  const HIS_TABLE = [
    { st: "NJ", cur: 11, add: 2, note: "also covers NY" },
    { st: "PA", cur: 8,  add: 2, note: "" },
    { st: "NY", cur: 3,  add: 3, note: "served from NJ" },
    { st: "DE", cur: 3,  add: 3, note: "" },
    { st: "CT", cur: 5,  add: 2, note: "" },
    { st: "MA", cur: 0,  add: 0, note: "" },
    { st: "MD", cur: 0,  add: 0, note: "Tuji + Zip in the aim" },
    { st: "VA", cur: 0,  add: 0, note: "a stated bet — no demand" },
  ];
  const SERVICE_AREAS = HIS_TABLE.map(b => b.st);
  const AIM_FALLBACK = { NJ: 10, PA: 8, MD: 3, CT: 4, MA: 2, VA: 1 };
  const DAYS_PER_MONTH_DEFAULT = 30;

registerPage({
  id: "area-plan",
  group: "different",
  title: "Seasonal Planning",
  subtitle: "Hiring first, then marketing, then the base question — the state plan and the " +
            "per-city evidence on one page, seeded from what actually worked last season.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const money = v => (v == null || isNaN(v)) ? "—" : RS.money(+v);
    const money0 = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";
    const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);
    const r1 = v => (v == null || isNaN(v)) ? "—" : (+v).toFixed(1);
    const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
                         "Oct", "Nov", "Dec"];
    const ymLabel = ym => MONTH_NAMES[+ym.slice(5, 7)] + " " + ym.slice(0, 4);

    injectStyle();
    host.innerHTML = '<div class="rs-page-head"><h1>Seasonal Planning</h1></div>' +
      '<div class="rs-loading" style="padding:22px">Reading the plan, the model and every city…</div>';

    return Promise.all([
      RS.load("area_plan"),
      ZTZ.api("/api/mart_area_plan_model?limit=1").then(
        j => JSON.parse(((j.rows || [])[0] || {}).payload || "null")).catch(() => null),
      RS.load("area_master").catch(e => ({ __err: e })),
    ]).then(([rows, model, cityAll]) => {
      // FOUR DISTINCT FAILURES, each named -- the old page blamed the mart for a model outage
      if (!rows || !rows.length) {
        host.innerHTML = '<div class="panel">The state plan mart (mart_area_plan) is empty — run ' +
          '<b>sources=area-plan</b> and reload.</div>'; return;
      }
      if (!model) {
        host.innerHTML = '<div class="panel">The plan model row (mart_area_plan_model) is missing — ' +
          'run <b>sources=area-plan</b> and reload.</div>'; return;
      }
      if (cityAll && cityAll.__err) {
        const msg = String(cityAll.__err && cityAll.__err.message || cityAll.__err || "");
        host.innerHTML = '<div class="panel">' + (/403|permitted|forbidden/i.test(msg)
          ? 'Your access covers the old Area Master only. This page also carries the crew, ' +
            'truck and marketing plan — ask Tornike to grant <b>Seasonal Planning</b>.'
          : 'The per-city master (mart_area_master) could not be read: ' + esc(msg)) + '</div>';
        return;
      }
      const CITYALL = cityAll || [];

      const MS = model.monthly_states || {};
      const CAPM = model.capacity || {};
      const SALES = model.sales || {};
      const MKT = model.marketing || {};
      const SEASON = model.season || {};
      const SEED = model.base_seed || {};
      const OVR = model.overrides || {};
      const allYms = Object.keys(MS).sort();
      const lastSettled = allYms[allYms.length - 1];
      const DAYS_PER_MONTH = num(OVR.days_per_month) || DAYS_PER_MONTH_DEFAULT;

      /* ------- the seeds: measured (his call), his table, the aim ------------------------ */
      // which states get a row: the eight service areas, plus any state the measured seed
      // puts 3+ foremen in (so a real new market appears without anyone editing code)
      const seedStates = SERVICE_AREAS.slice();
      Object.entries(SEED).forEach(([st, d]) => {
        if (!seedStates.includes(st) && num((d || {})._all) >= 3) seedStates.push(st);
      });
      // companies that share a state -- a company sub-row appears only where both operate
      const companiesOf = st => Object.keys(SEED[st] || {}).filter(c => c !== "_all").sort();
      const measuredSeed = () => Object.fromEntries(seedStates.map(st => {
        const d = SEED[st] || {};
        const byCo = {};
        companiesOf(st).forEach(c => { byCo[c] = { cur: num(d[c]), add: 0 }; });
        return [st, { cur: num(d._all), add: 0, byCo }];
      }));
      const hisSeed = () => Object.fromEntries(seedStates.map(st => {
        const b = HIS_TABLE.find(x => x.st === st) || { cur: 0, add: 0 };
        return [st, { cur: b.cur, add: b.add, byCo: {} }];
      }));
      const aimSeed = () => {
        const aim = model.crew_aim || AIM_FALLBACK;
        return Object.fromEntries(seedStates.map(st => [st, { cur: num(aim[st]) || 0, add: 0, byCo: {} }]));
      };
      // THE PLANNING VARIABLES WIN. Whatever the seed, a cell the Variables page has set is
      // the cell -- that is what "let me change those stuff from a separate page" means.
      const applyOverrides = bases => {
        const ob = OVR.bases || {};
        Object.entries(ob).forEach(([st, d]) => {
          if (!bases[st]) bases[st] = { cur: 0, add: 0, byCo: {} };
          if (d && typeof d === "object") {
            if (d.cur != null) bases[st].cur = num(d.cur);
            if (d.add != null) bases[st].add = num(d.add);
            Object.entries(d.byCo || {}).forEach(([c, v]) => {
              bases[st].byCo[c] = { cur: num((v || {}).cur), add: num((v || {}).add) };
            });
          }
        });
        return bases;
      };

      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
        catch (e) { return {}; }
      })();
      // DEFAULT PERIOD = NEXT SEASON'S MONTHS, seen through LAST season's same months (his
      // answer). The model says which months those are; if it cannot, last September.
      const seasonLast = SEASON.last && SEASON.last[0] ? SEASON.last : null;
      const inputs = Object.assign({
        from: seasonLast ? seasonLast[0] : "2025-09",
        to: seasonLast ? seasonLast[1] : "2025-09",
        seed: "measured",            // "measured" | "his" | "aim" | "custom"
        bases: applyOverrides(measuredSeed()),
        utilization: null, leadsPerRep: null, dollarsPerLead: null,
        focus: "",                   // the state focus; "" = all
        city: { minLeads: 20, view: "all", q: "", sort: "Revenue", desc: true, page: 0, pageSize: 30 },
      }, saved);
      inputs.city = Object.assign({ minLeads: 20, view: "all", q: "", sort: "Revenue", desc: true,
                                    page: 0, pageSize: 30 }, inputs.city || {});
      seedStates.forEach(st => { if (!inputs.bases[st]) inputs.bases[st] = { cur: 0, add: 0, byCo: {} }; });
      // the picker may hold months the mart does not (a fresh season): clamp to what exists
      if (!allYms.includes(inputs.from)) inputs.from = allYms.includes(inputs.to) ? inputs.to : lastSettled;
      if (!allYms.includes(inputs.to)) inputs.to = lastSettled;
      if (inputs.from > inputs.to) [inputs.from, inputs.to] = [inputs.to, inputs.from];

      /* ------- period machinery: the chosen months, and the same months a year before ---- */
      const monthsIn = (from, to) => allYms.filter(m => m >= from && m <= to);
      const yearBack = ym => (String(+ym.slice(0, 4) - 1)) + ym.slice(4);

      function aggStates(yms) {
        const out = {};
        yms.forEach(m => {
          Object.entries(MS[m] || {}).forEach(([st, a]) => {
            const o = out[st] = out[st] || { leads: 0, qualified: 0, booked: 0, lost: 0, byCo: {} };
            o.leads += a.leads || 0; o.qualified += a.qualified || 0;
            o.booked += a.booked || 0; o.lost += a.lost || 0;
            Object.entries(a.by_company || {}).forEach(([c, b]) => {
              const q = o.byCo[c] = o.byCo[c] || { leads: 0, qualified: 0, booked: 0, lost: 0 };
              q.leads += b.leads || 0; q.qualified += b.qualified || 0;
              q.booked += b.booked || 0; q.lost += b.lost || 0;
            });
          });
        });
        Object.values(out).forEach(o => {
          o.conversion = o.qualified ? o.booked / o.qualified : null;
          Object.values(o.byCo).forEach(q => { q.conversion = q.qualified ? q.booked / q.qualified : null; });
        });
        return out;
      }
      function aggMeasured(yms) {
        let jobs = 0, spend = 0, leads = 0;
        const repMed = [], jpf = [], repsActive = [];
        yms.forEach(m => {
          jobs += ((CAPM[m] || {})._national || {}).jobs || 0;
          spend += (MKT[m] || {}).ad_spend || 0;
          leads += (MKT[m] || {}).leads || 0;
          const s = SALES[m] || {};
          if (s.leads_per_rep_median) repMed.push(s.leads_per_rep_median);
          if (s.reps_active) repsActive.push(s.reps_active);
          const j = ((CAPM[m] || {})._national || {}).jobs_per_foreman;
          if (j) jpf.push(j);
        });
        const med = a => { const v = a.slice().sort((x, y) => x - y);
          return v.length ? v[Math.floor(v.length / 2)] : null; };
        return { jobs, spend, leads,
                 dollarsPerLead: leads ? spend / leads : null,
                 leadsPerRep: med(repMed), jobsPerForeman: med(jpf), repsActive: med(repsActive),
                 doneByState: st => yms.reduce((a, m) => a + (((CAPM[m] || {})[st] || {}).jobs || 0), 0),
                 workedByState: st => {
                   // distinct across the months is not in the model; the max month is the
                   // honest floor and is labelled as such
                   return Math.max(0, ...yms.map(m => (((CAPM[m] || {})[st] || {}).foremen_worked || 0)));
                 },
                 doneByStateCo: (st, c) => yms.reduce((a, m) =>
                   a + ((((CAPM[m] || {})[st] || {}).by_company || {})[c] || {}).jobs || 0, 0) };
      }

      let P = {};
      function recalcPeriod() {
        const yms = monthsIn(inputs.from, inputs.to);
        const prevYms = yms.map(yearBack).filter(m => allYms.includes(m));
        const lbl = ms => ms.length === 1 ? ymLabel(ms[0])
          : ymLabel(ms[0]) + " – " + ymLabel(ms[ms.length - 1]);
        P = {
          yms, prevYms,
          label: lbl(yms), prevLabel: prevYms.length ? lbl(prevYms) : "no prior-year data",
          S: aggStates(yms), Sprev: aggStates(prevYms), M: aggMeasured(yms),
          provisional: yms.some(m => {
            const d = new Date();
            const cur = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
            const back2 = new Date(d.getFullYear(), d.getMonth() - 2, 1);
            const b2 = back2.getFullYear() + "-" + String(back2.getMonth() + 1).padStart(2, "0");
            return m >= b2 && m <= cur;
          }),
        };
        const natQ = Object.values(P.S).reduce((a, s) => a + s.qualified, 0);
        const natB = Object.values(P.S).reduce((a, s) => a + s.booked, 0);
        P.natConv = natQ ? natB / natQ : 0.2;
        /* MEASURED means measured: the jobs done in the period were done by the crew that
           actually worked, so the denominator is the MEASURED foremen for those months --
           never the edited cells. */
        const worked = Math.max(0, ...P.yms.map(m => (((CAPM[m] || {})._national || {}).foremen_worked || 0)))
          || HIS_TABLE.reduce((a, b) => a + b.cur, 0);
        P.measuredForemen = worked;
        P.measuredUtil = (worked && P.yms.length)
          ? P.M.jobs / (worked * DAYS_PER_MONTH * P.yms.length) : 0.34;
        if (inputs.utilization == null)
          inputs.utilization = num(OVR.utilization) || Math.round(P.measuredUtil * 1000) / 10;
        if (inputs.leadsPerRep == null)
          inputs.leadsPerRep = num(OVR.leads_per_rep) || P.M.leadsPerRep || 140;
        if (inputs.dollarsPerLead == null)
          inputs.dollarsPerLead = num(OVR.dollars_per_lead) || Math.round((P.M.dollarsPerLead || 42) * 100) / 100;
      }

      function calc() {
        const util = num(inputs.utilization) / 100;
        const months = Math.max(1, P.yms.length);
        const perBase = seedStates.map(st => {
          const s = inputs.bases[st];
          const foremen = num(s.cur) + num(s.add);
          const jobs = foremen * DAYS_PER_MONTH * months * util;
          const conv = (P.S[st] || {}).conversion || P.natConv;
          const leadsNeeded = conv ? jobs / conv : 0;
          const had = (P.S[st] || {}).qualified || 0;
          const note = (HIS_TABLE.find(x => x.st === st) || {}).note || "";
          const cos = companiesOf(st);
          const byCo = cos.map(c => {
            const sc = (s.byCo || {})[c] || { cur: 0, add: 0 };
            const f = num(sc.cur) + num(sc.add);
            const j = f * DAYS_PER_MONTH * months * util;
            const cv = (((P.S[st] || {}).byCo || {})[c] || {}).conversion || conv;
            return { c, cur: num(sc.cur), add: num(sc.add), foremen: f, jobs: j, conv: cv,
                     leadsNeeded: cv ? j / cv : 0,
                     had: (((P.S[st] || {}).byCo || {})[c] || {}).qualified || 0,
                     done: P.M.doneByStateCo(st, c) };
          });
          return { st, note, cur: num(s.cur), add: num(s.add), foremen, jobs, conv, leadsNeeded,
                   had, done: P.M.doneByState(st), worked: P.M.workedByState(st),
                   gap: had ? leadsNeeded / had - 1 : null, byCo };
        });
        const totCur = perBase.reduce((a, r) => a + r.cur, 0);
        const totForemen = perBase.reduce((a, r) => a + r.foremen, 0);
        const totJobs = perBase.reduce((a, r) => a + r.jobs, 0);
        const totLeads = perBase.reduce((a, r) => a + r.leadsNeeded, 0);
        return { perBase, totCur, totForemen, totJobs, totLeads, util, months,
                 salesNeeded: totLeads / months / Math.max(1, num(inputs.leadsPerRep)),
                 marketing: totLeads / months * num(inputs.dollarsPerLead) };
      }

      /* ================= BAND A ================= */

      function controlBar() {
        const chip = (label, from, to, title) =>
          '<button' + (inputs.from === from && inputs.to === to ? ' class="on"' : "") +
          ' data-from="' + from + '" data-to="' + to + '"' + (title ? ' title="' + esc(title) + '"' : "") +
          '>' + label + "</button>";
        const l3from = allYms[Math.max(0, allYms.indexOf(lastSettled) - 2)] || lastSettled;
        const seedChip = (key, label, title) =>
          '<button' + (inputs.seed === key ? ' class="on"' : "") +
          ' data-seed="' + key + '" title="' + esc(title) + '">' + label + "</button>";
        const sm = (SEASON.months || []).map(m => MONTH_NAMES[m]).join("–");
        const clamp = w => w && w[0] ? [allYms.includes(w[0]) ? w[0] : null, allYms.includes(w[1]) ? w[1] : null] : null;
        const last = clamp(SEASON.last), prior = clamp(SEASON.prior);
        return '<div class="ap2-ctl">' +
          '<div class="rs-fld"><span>Period</span><div class="rs-seg" id="apPeriod">' +
          (last && last[0] && last[1] ? chip("Last season", last[0], last[1],
            "the season's months (" + sm + ") a year ago — what next season is planned from") : "") +
          (prior && prior[0] && prior[1] ? chip("Season before", prior[0], prior[1], sm + " two years ago") : "") +
          chip("Last 3 months", l3from, lastSettled) +
          chip("This year", lastSettled.slice(0, 4) + "-01", lastSettled) +
          "</div></div>" +
          '<div id="apFrom"></div><div id="apTo"></div>' +
          '<div class="rs-fld"><span>Plan seeds from</span><div class="rs-seg" id="apSeed">' +
          seedChip("measured", "What worked", "distinct foremen who actually worked last season, per state and company") +
          seedChip("his", "His table", "the 19 August 2026 table") +
          seedChip("aim", "The 28-crew aim", "the brief's maximum") +
          (inputs.seed === "custom" ? seedChip("custom", "Edited", "hand-edited cells; click a seed to reset") : "") +
          "</div></div>" +
          '<div class="rs-spacer"></div>' +
          '<span class="ap2-note">vs <b>' + esc(P.prevLabel) + "</b>" +
          (inputs.focus ? ' · focus <b>' + esc(inputs.focus) + '</b> <a href="#" data-unfocus="1">all states</a>' : "") +
          (P.provisional ? ' · <span class="ap2-warn">recent months still settling — ' +
            "lost counts provisional</span>" : "") + "</span></div>";
      }

      function heroHtml(c) {
        const step = (l, v, s, cls) =>
          '<div class="ap2-step"><div class="l">' + l + '</div>' +
          '<div class="v' + (cls ? " " + cls : "") + '">' + v + "</div>" +
          '<div class="s">' + s + "</div></div>";
        const owned = (model.fleet || {}).owned_trucks || 0;
        const seedWord = { measured: "what worked", his: "his table", aim: "the aim", custom: "your edits" }[inputs.seed] || "";
        return '<div class="ap2-flow">' +
          step("Planned foremen", c.totForemen,
               "+" + (c.totForemen - c.totCur) + " on top of " + c.totCur + " · seeded from " + esc(seedWord)) +
          step("Jobs in " + esc(P.label), fmtN(c.totJobs),
               "at " + n1(c.util * 100) + "% of the " + DAYS_PER_MONTH + "/day ceiling" +
               (P.M.jobsPerForeman ? " · measured " + n1(P.M.jobsPerForeman) + " jobs per foreman-month" : "")) +
          step("Leads needed", fmtN(c.totLeads), "via each area's own conversion (booked = a closing exists)") +
          step("Salespeople", n1(c.salesNeeded),
               "at " + fmtN(num(inputs.leadsPerRep)) + " leads/rep/month" +
               (P.M.repsActive ? " · " + fmtN(P.M.repsActive) + " reps were active" : "")) +
          step("Marketing / month", money(c.marketing), "at " + money(num(inputs.dollarsPerLead)) + " per lead") +
          step("Trucks", c.totForemen + " vs " + fmtN(owned),
               "a foreman needs a truck — the whole register; rent-vs-buy in the reference band",
               c.totForemen > owned ? "warn" : "good") +
          "</div>";
      }

      function dialsHtml() {
        const trail = MKT.trailing_12m_avg_monthly_spend;
        return [["utilization", "Utilization of the ceiling, %",
            "measured " + esc(P.label) + ": " + n1(P.measuredUtil * 100) + "% (" +
            fmtN(P.M.jobs) + " jobs vs " + fmtN(P.measuredForemen) + " distinct foremen in the busiest month × " + DAYS_PER_MONTH + " days × " + P.yms.length + " months)"],
           ["leadsPerRep", "Leads one salesperson handles / month",
            "measured " + esc(P.label) + ": " + (P.M.leadsPerRep || "—") + " median"],
           ["dollarsPerLead", "Marketing $ per lead",
            "measured " + esc(P.label) + ": " + (P.M.dollarsPerLead ? "$" + n1(P.M.dollarsPerLead) : "—") +
            (trail ? " · trailing 12-month spend " + money(trail) + "/month" : "")]]
          .map(([k, label, note]) =>
            '<div class="ap2-dial"><div class="l">' + label + "</div>" +
            '<input class="rs-num" style="width:92px" data-k="' + k + '" type="number" ' +
            'min="0" step="0.1" value="' + inputs[k] + '">' +
            '<div class="m" id="apDialNote-' + k + '">' + note + "</div></div>").join("");
      }

      function demandHtml() {
        const states = Object.keys(P.S)
          .sort((a, b) => (P.S[b].leads || 0) - (P.S[a].leads || 0))
          .filter(st => (P.S[st].leads || 0) + ((P.Sprev[st] || {}).leads || 0) >= 20);
        const max = Math.max(1, ...states.map(st => P.S[st].leads || 0));
        return states.map(st => {
          const a = P.Sprev[st] || {}, b = P.S[st] || {};
          const dl = (a.leads && b.leads) ? (b.leads - a.leads) / a.leads : null;
          return '<div class="ap2-dem' + (inputs.focus === st ? " on" : "") + '" data-focus="' + esc(st) + '">' +
            '<span class="n">' + esc(st) +
              "<small>" + pct(a.conversion) + " → " + pct(b.conversion) + " conv</small></span>" +
            '<span class="t">' +
              '<i class="lead" style="width:' + (b.leads / max * 100) + '%"></i>' +
              '<i class="book" style="width:' + (b.booked / max * 100) + '%"></i></span>' +
            '<span class="v"><b>' + fmtN(b.leads) + "</b> leads " +
              (dl == null ? "" : '<span class="ap2-yoy ' + (dl >= 0 ? "up" : "dn") + '">' +
                (dl >= 0 ? "+" : "") + Math.round(dl * 100) + "%</span> ") +
              "→ <b>" + fmtN(b.booked) + "</b> booked · " +
              '<span class="ap2-lost">' + fmtN(b.lost) + " lost</span></span></div>";
        }).join("");
      }

      const checkPill = (r) => r.gap == null
        ? '<span class="rs-pill bad">no measured demand</span>'
        : r.gap > 0.1
          ? '<span class="rs-pill warn">+' + Math.round(r.gap * 100) + "% vs " + esc(P.label) + "</span>"
          : '<span class="rs-pill ok">covered</span>';

      function planHtml(c) {
        const rowHtml = r => '<tr class="ap2-row' + (inputs.focus === r.st ? " on" : "") + '" data-focus="' + esc(r.st) + '">' +
          '<td class="strong">' + esc(r.st) +
            (r.note ? '<div class="ap2-note">' + esc(r.note) + "</div>" : "") + "</td>" +
          '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="cur" ' +
            'type="number" min="0" step="1" value="' + r.cur + '"></td>' +
          '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="add" ' +
            'type="number" min="0" step="1" value="' + r.add + '"></td>' +
          '<td class="num" data-c="planned"><b>' + r.foremen + "</b></td>" +
          '<td class="num muted">' + (r.worked || '<span class="ap2-small">—</span>') + "</td>" +
          '<td class="num muted">' + fmtN(r.done) + "</td>" +
          '<td class="num" data-c="jobsplan">' + fmtN(r.jobs) + "</td>" +
          '<td class="num">' + pct(r.conv) + ((P.S[r.st] || {}).conversion == null ?
            '<span class="ap2-note"> (national)</span>' : "") + "</td>" +
          '<td class="num" data-c="leadsneeded">' + fmtN(r.leadsNeeded) + "</td>" +
          '<td class="num">' + fmtN(r.had) + "</td>" +
          '<td class="num" data-c="check">' + checkPill(r) + "</td></tr>" +
          // COMPANY SUB-ROWS where both operate (his call). Editable per company; the state
          // row above is the pooled figure and stays the one the hero sums.
          r.byCo.map(q => '<tr class="ap2-sub" data-st="' + esc(r.st) + '" data-co="' + esc(q.c) + '">' +
            "<td>" + esc(q.c) + "</td>" +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-co="' + esc(q.c) + '" data-f="cur" ' +
              'type="number" min="0" step="1" value="' + q.cur + '" style="width:64px"></td>' +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-co="' + esc(q.c) + '" data-f="add" ' +
              'type="number" min="0" step="1" value="' + q.add + '" style="width:64px"></td>' +
            '<td class="num" data-c="planned">' + q.foremen + "</td>" +
            '<td class="num">' + (((SEED[r.st] || {})[q.c]) || '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + fmtN(q.done) + "</td>" +
            '<td class="num" data-c="jobsplan">' + fmtN(q.jobs) + "</td>" +
            '<td class="num">' + pct(q.conv) + "</td>" +
            '<td class="num" data-c="leadsneeded">' + fmtN(q.leadsNeeded) + "</td>" +
            '<td class="num">' + fmtN(q.had) + "</td><td></td></tr>").join("");
        return '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>' +
          '<th>Base / area</th><th class="num">Foreman quantity</th>' +
          '<th class="num">Additional</th><th class="num">Planned</th>' +
          '<th class="num" title="distinct foremen on closings in the period (max month)">Worked (measured)</th>' +
          '<th class="num">Jobs done (' + esc(P.label) + ')</th>' +
          '<th class="num">Jobs @ plan</th><th class="num">Conversion (of qualified)</th>' +
          '<th class="num">Leads needed</th>' +
          '<th class="num">Qualified (' + esc(P.label) + ')</th>' +
          '<th class="num">Demand check</th>' +
          "</tr></thead><tbody>" + c.perBase.map(rowHtml).join("") + "</tbody></table></div>" +
          trucksByBase(c) + tieOut();
      }
      function trucksByBase(c) {
        const parts = c.perBase.filter(r => r.foremen > 0).map(r => esc(r.st) + " " + r.foremen).join(" / ");
        return '<div class="ap2-note" id="apTrucksNote" style="margin-top:10px">Trucks by base @ plan ' +
          "(a foreman needs a truck): <b>" + parts + " = " + c.totForemen + "</b> vs " +
          fmtN((model.fleet || {}).owned_trucks) + " in the whole vehicles register — the " +
          "paid-for operating fleet is smaller; Truck Economics has the working count.</div>";
      }
      // THE TIE-OUT: the state totals summed from the mart rows against the model. Equal by
      // construction today; if they ever diverge the strip says so and reconciles nothing.
      function tieOut() {
        let mq = 0, mb = 0;
        rows.forEach(r => { if (P.yms.includes(r.ym)) { mq += num(r.qualified); mb += num(r.booked); } });
        const sq = Object.values(P.S).reduce((a, s) => a + s.qualified, 0);
        const sb = Object.values(P.S).reduce((a, s) => a + s.booked, 0);
        const ok = mq === sq && mb === sb;
        return '<div class="ap2-tie' + (ok ? "" : " bad") + '">' + (ok
          ? "Tie-out: the state rows above sum to the mart's " + fmtN(mq) + " qualified and " + fmtN(mb) + " booked for " + esc(P.label) + "."
          : "TIE-OUT FAILED: the model says " + fmtN(sq) + " qualified / " + fmtN(sb) + " booked, the mart rows say " +
            fmtN(mq) + " / " + fmtN(mb) + " — the two were built at different times. Run sources=area-plan.") + "</div>";
      }

      function leakHtml() {
        const byCounty = {};
        rows.forEach(r => {
          if (!P.yms.includes(r.ym)) return;
          if (inputs.focus && r.state !== inputs.focus) return;
          const k = r.state + "|" + r.county;
          const v = byCounty[k] = byCounty[k] || { st: r.state, c: r.county, leads: 0, lost: 0, cf: 0 };
          v.leads += num(r.leads); v.lost += num(r.lost); v.cf += num(r.total_cf);
        });
        const top = Object.values(byCounty)
          .filter(v => v.lost >= 5 && String(v.c || "").trim() && v.c !== "—")
          .sort((a, b) => b.lost - a.lost).slice(0, 10);
        const max = Math.max(1, ...top.map(v => v.lost));
        return top.length ? top.map(v =>
          '<div class="ap2-leak"><span class="n">' + esc(v.c) + "<small>" + esc(v.st) + "</small></span>" +
          '<span class="t"><i style="width:' + (v.lost / max * 100) + '%"></i></span>' +
          '<span class="v"><b>' + fmtN(v.lost) + "</b> of " + fmtN(v.leads) + " leads lost" +
            (v.cf ? " · " + fmtN(v.cf) + " cf" : "") + "</span></div>").join("")
          : '<p class="rs-hint">No county-level losses in this window' + (inputs.focus ? " for " + esc(inputs.focus) : "") + ".</p>";
      }

      /* ================= BAND B: the evidence, per city ================= */
      const C = inputs.city;
      let qTimer = null;

      function cityRows() {
        const q = C.q.trim().toLowerCase();
        return CITYALL.filter(r => {
          if (inputs.focus && r.State !== inputs.focus) return false;
          if ((num(r.Leads) || 0) < C.minLeads) return false;
          if (C.view === "untapped" && num(r.Untapped) !== 1) return false;
          if (C.view === "working" && num(r.Untapped) === 1) return false;
          if (C.view === "far" && (num(r["Miles To Base"]) || 0) < 25) return false;
          if (q && !((r.City || "") + " " + (r.County || "") + " " + (r.State || "")).toLowerCase().includes(q)) return false;
          return true;
        });
      }

      function bandBHtml() {
        const rs = cityRows();
        const T = k => rs.reduce((a, r) => a + (num(r[k]) || 0), 0);
        const leads = T("Leads"), booked = T("Booked"), jobs = T("Jobs"), rev = T("Revenue");
        const untapped = rs.filter(r => num(r.Untapped) === 1);
        const untappedLeads = untapped.reduce((a, r) => a + (num(r.Leads) || 0), 0);
        const noCrew = rs.filter(r => (num(r["Foremen At Base"]) || 0) === 0);
        const noCrewLeads = noCrew.reduce((a, r) => a + (num(r.Leads) || 0), 0);
        const yr = new Date().getFullYear();
        // the coverage line: how much of the state's year-to-date leads the city rows carry
        const stateLeadsYtd = (() => {
          let n = 0;
          rows.forEach(r => { if (r.ym.slice(0, 4) === String(yr) && (!inputs.focus || r.state === inputs.focus)) n += num(r.leads); });
          return n;
        })();
        const allInFocus = CITYALL.filter(r => !inputs.focus || r.State === inputs.focus);
        const allLeads = allInFocus.reduce((a, r) => a + (num(r.Leads) || 0), 0);
        const belowFloor = allInFocus.filter(r => (num(r.Leads) || 0) < C.minLeads)
          .reduce((a, r) => a + (num(r.Leads) || 0), 0);
        const stateChips = [""].concat([...new Set(CITYALL.map(r => r.State).filter(Boolean))].sort())
          .map(st => '<button class="ap2-chip' + (inputs.focus === st ? " on" : "") + '" data-focus="' + esc(st) + '">' + (st || "All") + "</button>").join(" ");

        const bands = [["0–10 mi", 0, 10], ["10–20 mi", 10, 20], ["20–35 mi", 20, 35], ["35–60 mi", 35, 60], ["60+ mi", 60, 1e9]];
        const lad = bands.map(([label, lo, hi]) => {
          const g = rs.filter(r => { const m = num(r["Miles To Base"]); return r["Nearest Base"] && m >= lo && m < hi; });
          const l = g.reduce((a, r) => a + (num(r.Leads) || 0), 0);
          const b = g.reduce((a, r) => a + (num(r.Booked) || 0), 0);
          const v = g.reduce((a, r) => a + (num(r.Revenue) || 0), 0);
          return { label, cities: g.length, leads: l, booked: b, pct: l ? b / l * 100 : null, rpl: l ? v / l : null };
        }).filter(x => x.leads > 0);
        const maxPct = Math.max(1, ...lad.map(x => x.pct || 0));

        return '<div class="ap2-band"><span class="k">Band B · The evidence</span>' +
          '<h2>Which cities produce the work' + (inputs.focus ? " in " + esc(inputs.focus) : "") + "</h2>" +
          '<span class="clock">every city · <b>' + yr + ' year to date</b> · all companies · this half does not follow the period picker above</span></div>' +
          '<div class="ap2-say">Booked here means <b>a closing exists</b> — the same rule as the plan. Distance is <b>straight-line</b> to the nearest active base. Jobs are last-encounter closings placed by the lead\'s pickup city, so a state total in Band A will not equal the sum of its cities. ' +
          (stateLeadsYtd ? "These " + fmtN(rs.length) + " cities carry <b>" + fmtN(leads) + "</b> of the <b>" + fmtN(stateLeadsYtd) + "</b> leads " + (inputs.focus ? esc(inputs.focus) : "all states") + " produced this year; the rest are cities under the " + C.minLeads + "-lead floor (" + fmtN(belowFloor) + " leads), under 5 leads, or with no city name. " : "") +
          "The ad-spend, ad-source, search-volume and wealth columns are parked until Google Ads and the other platforms are connected.</div>" +
          '<div class="ap2-bar"><div class="rs-fld"><span>Focus</span><div>' + stateChips + "</div></div></div>" +

          '<div class="panel ap2-led">' +
          '<div class="ap2-led-g"><div class="l">Cities</div><div class="v">' + fmtN(rs.length) + '</div>' +
            '<div class="s"><b>' + fmtN(leads) + "</b> leads · <b>" + fmtN(booked) + "</b> booked (" + (leads ? (booked / leads * 100).toFixed(1) : "—") + "%)</div></div>" +
          '<div class="ap2-led-g"><div class="l">Revenue</div><div class="v">' + money0(rev) + '</div>' +
            '<div class="s"><b>' + fmtN(jobs) + "</b> jobs · <b>" + money0(leads ? rev / leads : 0) + "</b> per lead</div></div>" +
          '<div class="ap2-led-g"><div class="l">Never worked</div><div class="v' + (untapped.length ? " warn" : "") + '">' + fmtN(untapped.length) + '</div>' +
            '<div class="s">cities sent <b>' + fmtN(untappedLeads) + "</b> leads and produced no job</div></div>" +
          '<div class="ap2-led-g"><div class="l">No crew behind them</div><div class="v' + (noCrew.length ? " warn" : "") + '">' + fmtN(noCrew.length) + '</div>' +
            '<div class="s"><b>' + fmtN(noCrewLeads) + "</b> leads whose nearest base has no foreman on the register</div></div>" +
          "</div>" +

          '<div class="ap2-grid">' +
          '<div class="panel"><div class="panel-head"><div class="panel-title">Distance decides</div></div>' +
            '<div class="ap2-say">Booking rate and revenue per lead by how far the city sits from its nearest base — the whole argument for where a base goes.</div>' +
            lad.map(x => '<div class="ap2-lad"><span>' + esc(x.label) + '</span>' +
              '<span class="t"><i style="width:' + Math.max(3, (x.pct || 0) / maxPct * 100) + '%"></i></span>' +
              '<span class="v"><b>' + (x.pct == null ? "—" : x.pct.toFixed(1) + "%") + '</b> book</span>' +
              '<span class="v">' + money0(x.rpl) + " / lead</span></div>").join("") +
            '<div class="ap2-note" style="margin-top:8px">' + (lad.length >= 2 && lad[0].pct && lad[lad.length - 1].pct
              ? "A city next to a base books <b>" + (lad[0].pct / lad[lad.length - 1].pct).toFixed(1) + "×</b> better than one at the far end, and earns <b>" + money0(lad[0].rpl) + "</b> per lead against <b>" + money0(lad[lad.length - 1].rpl) + "</b>."
              : "") + "</div></div>" +

          '<div class="panel"><div class="panel-head"><div class="panel-title">Where we convert badly</div></div>' +
            '<div class="ap2-say">Cities sending 100+ leads, lowest booking first — the places a crew or a campaign pays for itself before a base does.</div>' +
            '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>City</th><th class="num">Leads</th><th class="num">Books</th><th class="num">Miles</th><th class="num">Foremen</th></tr></thead><tbody>' +
            rs.filter(r => (num(r.Leads) || 0) >= 100).sort((a, b) => (num(a["Booking Rate"]) || 0) - (num(b["Booking Rate"]) || 0)).slice(0, 8).map(r =>
              '<tr><td class="strong">' + esc(r.City) + ' <span class="ap2-small">' + esc(r.State) + "</span></td>" +
              '<td class="num">' + fmtN(num(r.Leads)) + "</td>" +
              '<td class="num"><b>' + r1(num(r["Booking Rate"])) + "%</b></td>" +
              '<td class="num">' + (r["Nearest Base"] ? r1(num(r["Miles To Base"])) : "—") + "</td>" +
              '<td class="num' + ((num(r["Foremen At Base"]) || 0) === 0 ? ' ap2-warn' : "") + '">' + ((num(r["Foremen At Base"]) || 0) || "none") + "</td></tr>").join("") +
            "</tbody></table></div></div>" +

          '<div class="panel"><div class="panel-head"><div class="panel-title">Where the claims come from</div></div>' +
            '<div class="ap2-say">Claims per 100 jobs done in that city, cities with 10+ jobs. Filed-this-year claims over done-this-year jobs — <a href="#page=claims-analysis">Claims Analysis</a> is the cross-check.</div>' +
            '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>City</th><th class="num">Jobs</th><th class="num">Claims</th><th class="num">% of jobs</th><th>Top reason</th><th class="num">Refunded</th><th class="num">Public</th></tr></thead><tbody>' +
            rs.filter(r => (num(r.Jobs) || 0) >= 10).sort((a, b) => (num(b["Claims Per 100 Jobs"]) || 0) - (num(a["Claims Per 100 Jobs"]) || 0)).slice(0, 8).map(r =>
              '<tr><td class="strong">' + esc(r.City) + ' <span class="ap2-small">' + esc(r.State) + "</span></td>" +
              '<td class="num">' + fmtN(num(r.Jobs)) + "</td><td class=\"num\">" + fmtN(num(r.Claims)) + "</td>" +
              '<td class="num"><b>' + r1(num(r["Claims Per 100 Jobs"])) + "%</b></td>" +
              "<td>" + esc(r["Top Claim Reason"] || "—") + "</td>" +
              '<td class="num">' + ((num(r["Claim Refunds"]) || 0) ? money0(num(r["Claim Refunds"])) : '<span class="ap2-small">—</span>') + "</td>" +
              '<td class="num">' + ((num(r["Claims Gone Public"]) || 0) || '<span class="ap2-small">—</span>') + "</td></tr>").join("") +
            "</tbody></table></div></div>" +
          "</div>" +

          '<div class="panel" style="margin-top:12px"><div class="panel-head"><div class="panel-title">The master</div>' +
            '<div class="rs-spacer"></div><span class="rs-pill" id="apCityCount"></span>' +
            '<button class="rs-btn" id="apDl">Download CSV</button></div>' +
            '<div class="ap2-bar" id="apCityBar"></div>' +
            '<div id="apCityTable"></div></div>';
      }

      function cityTableHtml() {
        const rs = cityRows();
        const sorted = rs.slice().sort((a, b) => {
          const x = a[C.sort], y = b[C.sort];
          const nx = num(x), ny = num(y);
          const cmp = (x != null && y != null && !isNaN(parseFloat(x)) && !isNaN(parseFloat(y)))
            ? nx - ny : String(x || "").localeCompare(String(y || ""));
          return C.desc ? -cmp : cmp;
        });
        C.page = Math.min(C.page, Math.max(0, Math.ceil(sorted.length / C.pageSize) - 1));
        const pageRows = sorted.slice(C.page * C.pageSize, (C.page + 1) * C.pageSize);
        const pages = Math.max(1, Math.ceil(sorted.length / C.pageSize));
        const th = (label, key, cls) => '<th class="ap2-th ' + (cls || "") + (C.sort === key ? " on" : "") + '" data-sort="' + esc(key) + '">' +
          esc(label) + (C.sort === key ? (C.desc ? " ↓" : " ↑") : "") + "</th>";
        const cnt = host.querySelector("#apCityCount"); if (cnt) cnt.textContent = fmtN(sorted.length) + " cities";
        return '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>' +
          th("City", "City") + th("St", "State") + th("County", "County") +
          th("Leads", "Leads", "num") + th("90d", "Leads 90d", "num") + th("Booked", "Booked", "num") + th("Book %", "Booking Rate", "num") +
          th("Jobs", "Jobs", "num") + th("Revenue", "Revenue", "num") + th("$/lead", "Revenue Per Lead", "num") +
          th("Ticket", "Avg Ticket", "num") + th("Quote", "Avg Quote", "num") + th("CF", "Avg CF", "num") +
          th("Base", "Nearest Base") + th("Miles", "Miles To Base", "num") + th("Foremen / crew", "Foremen At Base", "num") +
          th("Claims", "Claims", "num") + th("% of jobs", "Claims Per 100 Jobs", "num") +
          "</tr></thead><tbody>" + pageRows.map(r => '<tr>' +
            '<td class="strong">' + esc(r.City) + (num(r.Untapped) === 1 ? ' <span class="rs-pill warn">no jobs</span>' : "") + "</td>" +
            "<td>" + esc(r.State) + '</td><td class="muted">' + esc(r.County || "—") + "</td>" +
            '<td class="num">' + fmtN(num(r.Leads)) + '</td><td class="num">' + fmtN(num(r["Leads 90d"])) + "</td>" +
            '<td class="num">' + fmtN(num(r.Booked)) + '</td><td class="num">' + r1(num(r["Booking Rate"])) + "%</td>" +
            '<td class="num">' + fmtN(num(r.Jobs)) + '</td><td class="num">' + money0(num(r.Revenue)) + "</td>" +
            '<td class="num">' + money0(num(r["Revenue Per Lead"])) + '</td><td class="num">' + money0(num(r["Avg Ticket"])) + "</td>" +
            '<td class="num">' + (r["Avg Quote"] ? money0(num(r["Avg Quote"])) : '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + (r["Avg CF"] ? fmtN(num(r["Avg CF"])) : '<span class="ap2-small">—</span>') + "</td>" +
            "<td>" + esc(r["Nearest Base"] || "—") + "</td>" +
            '<td class="num">' + (r["Nearest Base"] ? r1(num(r["Miles To Base"])) : '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + ((num(r["Foremen At Base"]) || 0) || '<span class="ap2-small">0</span>') + ' <span class="ap2-small">/ ' + (num(r["Crew At Base"]) || 0) + "</span></td>" +
            '<td class="num">' + ((num(r.Claims) || 0) || '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + ((num(r.Claims) || 0) ? r1(num(r["Claims Per 100 Jobs"])) + "%" : '<span class="ap2-small">—</span>') + "</td></tr>").join("") +
          "</tbody></table></div>" +
          '<div class="ap2-pager"><span>page ' + (C.page + 1) + " of " + pages + "</span>" +
          '<button class="rs-btn" data-pg="prev"' + (C.page <= 0 ? " disabled" : "") + '>‹ Prev</button>' +
          '<button class="rs-btn" data-pg="next"' + (C.page >= pages - 1 ? " disabled" : "") + '>Next ›</button></div>';
      }

      function mountCityBar() {
        const bar = host.querySelector("#apCityBar"); if (!bar) return;
        bar.innerHTML = "";
        const fld = (label, el) => { const w = document.createElement("div"); w.className = "rs-fld";
          w.innerHTML = "<span>" + label + "</span>"; w.appendChild(el); return w; };
        const seg = (opts, cur, set) => {
          const s = document.createElement("div"); s.className = "rs-seg";
          opts.forEach(([v, label]) => {
            const b = document.createElement("button"); b.textContent = label;
            if (cur === v) b.className = "on";
            b.onclick = () => { set(v); C.page = 0; save(); repaintCity(); };
            s.appendChild(b);
          });
          return s;
        };
        bar.appendChild(fld("Show", seg([["all", "All"], ["working", "We work there"], ["untapped", "Never worked"], ["far", "25+ miles out"]], C.view, v => { C.view = v; })));
        bar.appendChild(fld("Min leads", seg([[5, "5"], [20, "20"], [50, "50"], [100, "100"]], C.minLeads, v => { C.minLeads = v; })));
        const q = document.createElement("input");
        q.className = "ap2-in"; q.placeholder = "find a city or county…"; q.value = C.q; q.style.flex = "0 1 240px";
        q.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => { C.q = q.value; C.page = 0; C._focus = 1; save(); repaintCity(); }, 300); };
        bar.appendChild(q);
        if (C._focus) { C._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }

      function dlCsv() {
        const cols = RS.DATASETS.area_master.cols.slice();
        const rs = cityRows().slice().sort((a, b) => {
          const x = a[C.sort], y = b[C.sort]; const nx = num(x), ny = num(y);
          const cmp = (!isNaN(parseFloat(x)) && !isNaN(parseFloat(y))) ? nx - ny : String(x || "").localeCompare(String(y || ""));
          return C.desc ? -cmp : cmp; });
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s;
          return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [cols.map(cell).join(",")].concat(rs.map(r => cols.map(c => cell(r[c])).join(",")));
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "Seasonal Planning - cities" + (inputs.focus ? " - " + inputs.focus : "") + ".csv"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }

      /* ================= BAND C ================= */
      const R = model.research || {};
      function researchHtml(c) {
        if (!R.states) return "";
        const planned = Object.fromEntries(c.perBase.map(r => [r.st, r.foremen]));
        return '<div class="ap2-cards">' +
          Object.entries(R.states).map(([st, v]) => {
            const comp = (R.competitors || {})[st];
            const hot = /unmined|strongest/i.test(String(v.case || "")) && !(planned[st] > 0);
            return '<div class="ap2-card' + (hot ? " hot" : "") + '"><h5>' + esc(st) +
              ' <span class="rs-pill">' + fmtN((P.S[st] || {}).qualified || 0) + " qualified · " + esc(P.label) + "</span></h5>" +
              '<div class="case">' + esc(v.case) + "</div>" + '<div class="towns">' + esc(v.towns) + "</div>" +
              (hot ? '<div class="ap2-tension">The plan sends this area 0 crews — the strongest outside case on the board is unstaffed.</div>' : "") +
              '<div class="foot"><span>yard ' + (((R.depots || {})[st]) ? money(R.depots[st]) + "/mo" : "—") + "</span>" +
              "<span>3BR move " + (comp ? money(comp[0]) : "—") + "</span>" +
              "<span>crew " + (comp ? money(comp[1]) + "/hr" : "—") + "</span></div></div>";
          }).join("") + "</div>" +
          '<div class="ap2-note" style="margin-top:10px">' + esc(R.vintage || "") + ". Licensing per state (a real gate on MD/VA/CT/MA expansion) is in the memo.</div>";
      }
      function trucksHtml() {
        const tc = model.truck_costs_by_year || {}; const t = R.trucks;
        return '<div class="rs-tablewrap"><table class="rs-table" style="max-width:560px"><thead><tr><th>Year</th><th class="num">Rental</th><th class="num">Financing</th><th class="num">Repair</th></tr></thead><tbody>' +
          Object.entries(tc).map(([y, b]) => '<tr><td class="strong">' + y + (y === String(new Date().getFullYear()) ? " (to date)" : "") + '</td><td class="num">' + money(b.rental) + '</td><td class="num">' + money(b.financing) + '</td><td class="num">' + money(b.repair) + "</td></tr>").join("") +
          "</tbody></table></div>" +
          '<div class="ap2-note" style="margin-top:10px">Owned fleet <b>' + fmtN((model.fleet || {}).owned_trucks) + "</b> · insurance <b>" + money((model.fleet || {}).insurance_yearly_total) + "/yr</b> · parking <b>" + money((model.fleet || {}).parking_monthly_total) + "/mo</b> — the whole vehicles register; the paid-for fleet and per-day economics live on Truck Economics.</div>" +
          (t ? '<div class="ap2-callout"><b>The +2 answer, priced from live market research:</b> a used 26-ft box truck runs <b>' + money(t.used_low) + "–" + money(t.used_high) + "</b> (typical " + money(t.used_typical) + "; fleet sell-offs ~" + money(t.selloff_typical) + "). All-in, one more owned truck ≈ <b>$" + t.owned_truck_year_allin + "/yr</b>. Against a ~$140k/yr rental run-rate, <b>two owned trucks displace renting at better than 2:1</b>.<br><b>Spec:</b> " + esc(t.gvwr_note) + "<br><b>Live candidate:</b> " + esc(t.local_candidate) + ".</div>" : "");
      }
      function seasonHtml() {
        const v = SEASON.votes || {}; const yrs = SEASON.years || {};
        const ynames = Object.keys(yrs).sort();
        return '<div class="ap2-say">The season is the set of months whose jobs reach <b>' + Math.round((SEASON.share || 0.65) * 100) + '%</b> of that year\'s peak month in at least <b>' + (SEASON.min_years || 2) + '</b> of the years that have data for the month. Today that is <b>' + (SEASON.months || []).map(m => MONTH_NAMES[m]).join(", ") + '</b>. The threshold is a Planning Variable.</div>' +
          '<div class="rs-tablewrap"><table class="rs-table" style="max-width:720px"><thead><tr><th>Month</th>' + ynames.map(y => '<th class="num">' + y + " (of peak)</th>").join("") + '<th class="num">Votes</th><th>Season</th></tr></thead><tbody>' +
          Object.keys(v).sort((a, b) => a - b).map(m => '<tr><td class="strong">' + MONTH_NAMES[m] + "</td>" +
            ynames.map(y => { const s = ((yrs[y] || {}).share_of_peak || {})[m]; return '<td class="num">' + (s == null ? '<span class="ap2-small">—</span>' : Math.round(s * 100) + "%") + "</td>"; }).join("") +
            '<td class="num">' + v[m][0] + " of " + v[m][1] + "</td><td>" + ((SEASON.months || []).includes(+m) ? '<span class="rs-pill ok">in</span>' : '<span class="rs-pill mute">out</span>') + "</td></tr>").join("") +
          "</tbody></table></div>";
      }

      const card = (eyebrow, h, sub, body, id) =>
        '<div class="panel"' + (id ? ' id="' + id + '"' : "") + '><div class="ap2-eyebrow">' + eyebrow + "</div>" +
        '<div class="panel-title">' + h + "</div>" + (sub ? '<div class="ap2-say">' + sub + "</div>" : "") + body + "</div>";
      const ref = (title, small, body, open) =>
        '<details class="ap2-ref"' + (open ? " open" : "") + "><summary>" + title + (small ? "<small>" + small + "</small>" : "") + "</summary>" + body + "</details>";

      /* ================= paint + wiring ================= */
      function stamps() {
        const built = model.built_at || "";
        return '<div class="ap2-stamps"><span>plan mart: ' + esc(rows[0] && rows[0].built_at ? String(rows[0].built_at).slice(0, 16) : "—") +
          "</span><span>model: " + esc(built ? String(built).slice(0, 16) : "same run") +
          "</span><span>city master: nightly</span><span>research: " + esc((R.vintage || "").slice(0, 22)) + "</span></div>";
      }

      function paint() {
        recalcPeriod();
        const c = calc();
        host.innerHTML =
          '<div class="rs-page-head"><h1>Seasonal Planning</h1>' +
          '<p style="max-width:none">Hiring first, then marketing, then the base question. <b>Band A</b> decides per state for the period you pick, seeded from the foremen who actually worked last season (or his table, or the aim), and any cell the <a href="#page=season-settings">Planning Variables</a> page has set wins. <b>Band B</b> is the per-city evidence for this year — click a state anywhere to focus it. <b>Band C</b> is the reference: the outside research, rent vs buy, and how the season was decided.</p></div>' +
          '<div class="ap2-band" style="margin-top:6px;border-top:0;padding-top:0"><span class="k">Band A · Decide</span><h2>The plan for ' + esc(P.label) + '</h2>' +
          '<span class="clock">next season ' + esc((SEASON.next || []).join(" – ") || "—") + ' · planned from the same months last year</span></div>' +
          controlBar() +
          '<div class="panel ap2-hero"><div id="apHero">' + heroHtml(c) + "</div>" +
          '<div class="ap2-dials" id="apDials">' + dialsHtml() + "</div></div>" +
          card("The demand", esc(P.label) + " by area",
               "The full bar is leads (counted where the move starts, on create date); the solid green inside it is what got booked — <b>a closing exists</b>. Lost = qualified, never booked. Click a state to focus the page on it.",
               '<div id="apDemand">' + demandHtml() + "</div>") +
          card("The plan", "Base capacity — foreman quantity, plus the additions",
               "Rows are service areas (NY is worked from the NJ base). <b>Worked (measured)</b> is the distinct foremen on closings in the period, so the typed cell has its measured counterpart on the same row. Where two companies run a state, each has its own editable line. Change any cell; the hero follows. Edits stay in this browser — the Planning Variables page makes them permanent.",
               '<div id="apBase" style="overflow-x:auto">' + planHtml(c) + "</div>") +
          card("Where it leaks", "The counties that lose the most",
               "Top county losses in " + esc(P.label) + (inputs.focus ? " for " + esc(inputs.focus) : "") + " — where extra sales attention or pricing would bite first.",
               '<div id="apLeak">' + leakHtml() + "</div>") +
          '<div id="apBandB">' + bandBHtml() + "</div>" +
          '<div class="ap2-band"><span class="k">Band C · Reference</span><h2>Read once a season</h2></div>' +
          ref("How the season was decided", (SEASON.months || []).map(m => MONTH_NAMES[m]).join("–"), card("The season", "Months that reach the threshold of the year's peak", "", seasonHtml())) +
          (R.states ? ref("The outside picture", "big houses and good areas, joined to our own demand",
             card("Research", "Compiled by us — the gap between the outside case and our own numbers is the expansion argument", "", researchHtml(c))) : "") +
          ref("Trucks — rent vs buy", "as the company already lives it",
             card("Trucks", "Both sides are real card history: the company rents AND finances purchases today", "", trucksHtml())) +
          ref("Method", "what is measured and what is assumed",
             card("Method", "Definitions and provenance", "",
               '<div class="ap2-note" style="line-height:1.75">Measured: everything except the foreman cells and any number you type. The plan seeds from the distinct foremen who worked last season per state and company (or his 19-August table, or the 28-crew aim); the Planning Variables page overrides any cell. Utilization bridges foremen to a month of jobs against the ' + DAYS_PER_MONTH + '-day ceiling and re-seeds when the period changes. <b>Booked = a closing exists</b> on both halves of the page (his call). Band A geography is where the move starts, in the closing\'s own state; Band B places a job by the lead\'s pickup city and counts last-encounter closings only — so the two job counts will not tie. Band A obeys the period picker; Band B is always this year to date. Miles are straight-line. Marketing $/lead is company-wide.</div>')) +
          stamps();

        wire();
      }

      function repaintCity() {
        const t = host.querySelector("#apCityTable"); if (t) t.innerHTML = cityTableHtml();
        mountCityBar(); wireCityTable();
      }
      function repaintBandB() {
        const b = host.querySelector("#apBandB"); if (!b) return;
        b.innerHTML = bandBHtml(); repaintCity(); wireFocus(b);
      }
      function wireCityTable() {
        host.querySelectorAll("#apCityTable [data-sort]").forEach(el => el.onclick = () => {
          const k = el.dataset.sort; if (C.sort === k) C.desc = !C.desc; else { C.sort = k; C.desc = true; }
          C.page = 0; save(); repaintCity(); });
        host.querySelectorAll("#apCityTable [data-pg]").forEach(el => el.onclick = () => { C.page += el.dataset.pg === "next" ? 1 : -1; save(); repaintCity(); });
        const dl = host.querySelector("#apDl"); if (dl) dl.onclick = dlCsv;
      }
      function setFocus(st) {
        inputs.focus = inputs.focus === st ? "" : st;
        save();
        host.querySelectorAll("[data-focus]").forEach(el => el.classList.toggle("on", !!inputs.focus && el.dataset.focus === inputs.focus));
        const lk = host.querySelector("#apLeak"); if (lk) lk.innerHTML = leakHtml();
        repaintBandB();
        const cb = host.querySelector(".ap2-ctl"); if (cb) cb.outerHTML = controlBar(); wireControls();
      }
      function wireFocus(root) {
        (root || host).querySelectorAll("[data-focus]").forEach(el => {
          el.addEventListener("click", ev => {
            if (ev.target.closest("input")) return;
            ev.preventDefault(); setFocus(el.dataset.focus);
          });
        });
      }
      function wireControls() {
        const f = document.getElementById("apFrom"), t = document.getElementById("apTo");
        if (f && t) {
          const ymVals = allYms.map(m => ({ v: m, l: ymLabel(m) }));
          let fSel, tSel;
          const onSel = () => {
            const fv = fSel.get(), tv = tSel.get();
            inputs.from = fv <= tv ? fv : tv; inputs.to = fv <= tv ? tv : fv;
            inputs.utilization = null; inputs.leadsPerRep = null; inputs.dollarsPerLead = null;
            save(); paint();
          };
          fSel = RSC.localSelect(f, { label: "From", values: ymVals, value: inputs.from, required: true, onChange: onSel });
          tSel = RSC.localSelect(t, { label: "To", values: ymVals, value: inputs.to, required: true, onChange: onSel });
        }
        host.querySelectorAll("#apPeriod button").forEach(b => b.onclick = () => {
          inputs.from = b.dataset.from; inputs.to = b.dataset.to;
          inputs.utilization = null; inputs.leadsPerRep = null; inputs.dollarsPerLead = null;
          save(); paint();
        });
        host.querySelectorAll("#apSeed button").forEach(b => b.onclick = () => {
          const k = b.dataset.seed; if (k === inputs.seed || k === "custom") return;
          inputs.bases = applyOverrides(k === "aim" ? aimSeed() : k === "his" ? hisSeed() : measuredSeed());
          inputs.seed = k; save(); paint();
        });
        const un = host.querySelector("[data-unfocus]"); if (un) un.onclick = ev => { ev.preventDefault(); inputs.focus = ""; setFocus(""); };
      }
      function wire() {
        wireControls(); wireFocus(); mountCityBar(); repaintCity();
      }
      function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {} }

      paint();

      /* live edits: the hero and the edited row repaint; the input keeps focus; the dials
         node is NEVER re-rendered here (the old page destroyed the input under the cursor) */
      host.addEventListener("input", e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains("rs-num")) return;
        if (t.dataset.st) {
          const b = inputs.bases[t.dataset.st];
          if (t.dataset.co) { (b.byCo[t.dataset.co] = b.byCo[t.dataset.co] || { cur: 0, add: 0 })[t.dataset.f] = parseFloat(t.value) || 0; }
          else b[t.dataset.f] = parseFloat(t.value) || 0;
          if (inputs.seed !== "custom") {
            inputs.seed = "custom";
            const cb = host.querySelector(".ap2-ctl");
            if (cb) { cb.outerHTML = controlBar(); wireControls(); }
          }
        } else if (t.dataset.k) inputs[t.dataset.k] = parseFloat(t.value) || 0;
        save();
        const c = calc();
        document.getElementById("apHero").innerHTML = heroHtml(c);
        const tbl = document.getElementById("apBase");
        c.perBase.forEach(r => {
          const row = tbl.querySelector('tr.ap2-row[data-focus="' + CSS.escape(r.st) + '"]'); if (!row) return;
          const set = (k, html) => { const cell = row.querySelector('[data-c="' + k + '"]'); if (cell) cell.innerHTML = html; };
          set("planned", "<b>" + r.foremen + "</b>"); set("jobsplan", fmtN(r.jobs));
          set("leadsneeded", fmtN(r.leadsNeeded)); set("check", checkPill(r));
          r.byCo.forEach(q => {
            const sr = tbl.querySelector('tr.ap2-sub[data-st="' + CSS.escape(r.st) + '"][data-co="' + CSS.escape(q.c) + '"]'); if (!sr) return;
            const s2 = (k, html) => { const cell = sr.querySelector('[data-c="' + k + '"]'); if (cell) cell.innerHTML = html; };
            s2("planned", String(q.foremen)); s2("jobsplan", fmtN(q.jobs)); s2("leadsneeded", fmtN(q.leadsNeeded));
          });
        });
        const note = document.getElementById("apTrucksNote"); if (note) note.outerHTML = trucksByBase(c);
      });
    });
  },
});
})();
