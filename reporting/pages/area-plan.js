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
 * state's leads the city rows carry. Outside data (2026-09-15): Zillow home values and Census income /
 * movers per zip, lead source mix and an ESTIMATED ad cost per city (company cost per lead by source),
 * a Planning / Marketing view of the master, and the white space: zips within 35 miles of a depot
 * that never sent a lead. Measured ad spend by area and search volume are still to connect.
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
             "Nearest Base", "Miles To Base", "Foremen At Base", "Crew At Base",
             "Foremen Can Work", "Crew Can Work", "Untapped",
             "Claims", "Claims Per 100 Jobs", "Claim Refunds", "Claims Gone Public",
             "Top Claim Reason", "Ad Spend", "Ad Sources", "Search Volume", "Wealth Tier",
             "Latitude", "Longitude", "Foremen From", "Leads No Jobs", "Lead Source Mix", "Est Ad Cost",
             "Est Revenue Per Ad Dollar", "Home Value", "Home Value Change Pct", "Home Value As Of",
             "Median Income", "Mover Rate"],
    };
  }
  // the white space: every zip inside the territory, with the outside signals (2026-09-15)
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_forecast) {
    RS.DATASETS.area_forecast = {
      table: "mart_area_forecast",
      cols: ["year", "ym", "state", "method", "chosen", "shoulder", "last_jobs", "jobs", "leads_needed", "headroom",
        "hire_by", "growth", "avg_bill", "avg_expense", "revenue_est", "expense_est", "built_at"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (window.RS && RS.DATASETS && RS.DATASETS.area_master && !RS.DATASETS.area_master_season) {
    // the same master over the latest complete season (May-Aug); his 2026-09-16 call: a two-window toggle
    RS.DATASETS.area_master_season = Object.assign({}, RS.DATASETS.area_master, { table: "mart_area_master_season" });
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_whitespace) {
    /* Giga's map, 2026-09-20: "the main map giga wants to see is the TIER for each location, BY
       COLOR... for that color we need a TOOLTIP so he can see the BUDGET for that specific county
       for marketing. and finally the MAX JOBS PER DAY that county should handle - how many crew we
       have that covers that location. CREW COVERING THAT LOCATION is a tricky thing and it should
       be in the area of several radius." */
    RS.DATASETS.area_county = {
      table: "mart_area_county",
      cols: ["State", "County", "Latitude", "Longitude", "Cities", "Leads", "Booked", "Jobs",
             "Revenue", "Booking Rate", "Booking Rate Shrunk", "Avg Ticket", "Avg CF",
             "Miles To Base", "Score Distance", "Score Booking", "Score Estimate", "Score CF",
             "Score", "Tier", "State Lead Share", "Est Ad Cost", "Ad Spend Measured",
             "Foremen Within 60mi", "Foremen Gravity", "Capacity Share", "Foremen Company",
             "Uncovered"],
    };
    RS.DATASETS.area_whitespace = {
      table: "mart_area_whitespace",
      cols: ["Zip", "City", "County", "State", "Nearest Base", "Miles To Base", "Leads 24m", "Jobs 24m",
             "Last Lead", "Never A Lead", "Home Value", "Home Value Change Pct", "Population",
             "Median Income", "Mover Rate", "Movers Per Year"],
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
    .ap2-golink{background:none;border:0;padding:0;font:inherit;color:var(--brand-d);font-weight:700;cursor:pointer;text-decoration:underline}
    .ap2-sech{font-size:16px;font-weight:800;color:var(--ink);margin:22px 0 6px;scroll-margin-top:72px}
    .ap2-sech:first-child{margin-top:0}
    .ap2-dec{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:12px;margin-top:10px;align-items:start}
    .ap2-d{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;border-top:3px solid var(--brand)}
    .ap2-d .dh{font-size:13.5px;color:var(--muted);line-height:1.5} .ap2-d .dq{font-size:12.5px;color:var(--muted);margin:0 0 4px}
    .ap2-d .dh b{color:var(--ink);font-size:26px;font-weight:800;line-height:1.15}
    .ap2-d .dn{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--brand-d);margin-bottom:2px}
   
    .ap2-d .dx{font-size:12px;color:var(--muted);line-height:1.6;margin-top:9px} .ap2-d .dx b{color:var(--ink)}
    .ap2-dt{width:100%;border-collapse:collapse;margin-top:10px;font-size:12.5px;font-variant-numeric:tabular-nums}
    .ap2-dt th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:700;text-align:left;padding:3px 4px;border-bottom:1px solid var(--line)}
    .ap2-dt th.num,.ap2-dt td.num{text-align:right} .ap2-dt td{padding:4px 4px;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent)}
    .ap2-qa{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:10px;margin-top:10px}
    .ap2-q{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
    .ap2-q .qq{font-size:13px;font-weight:750;color:var(--ink);line-height:1.45}
    .ap2-q .qa{font-size:12.5px;color:var(--muted);line-height:1.6;margin-top:5px}
    .ap2-q .qa b{color:var(--ink)}
    .ap2-q .qh{display:flex;align-items:center;gap:8px;margin-bottom:6px}
    .ap2-q .qn{font-size:11px;font-weight:800;color:var(--brand-d);background:var(--brand-glow);border-radius:999px;padding:1px 8px}
    .ap2-chip{font-size:10.5px;font-weight:800;border-radius:999px;padding:1px 8px;white-space:nowrap}
    .ap2-chip.y{background:color-mix(in srgb,var(--pos) 14%,transparent);color:var(--pos)}
    .ap2-chip.p{background:color-mix(in srgb,var(--warn) 18%,transparent);color:var(--warn)}
    .ap2-chip.n{background:color-mix(in srgb,var(--neg) 12%,transparent);color:var(--neg)}
    .ap2-goto{margin-top:7px;font-size:12px;font-weight:700;color:var(--brand-d);background:0;border:0;padding:0;cursor:pointer}
    .ap2-goto:hover{text-decoration:underline}
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
    .ap2-step{flex:1 1 170px;min-width:150px;padding:2px 18px 2px 0;position:relative}
    .ap2-step + .ap2-step{padding-left:18px;border-left:1px solid var(--line-2)}
    .ap2-step .l{overflow-wrap:anywhere;font-size:11px;color:var(--muted);font-weight:800;text-transform:uppercase;
      letter-spacing:.06em}
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
    @media (max-width:640px){.ap2-dem{grid-template-columns:minmax(90px,1fr) minmax(60px,1fr)}
      .ap2-dem .v{grid-column:1/-1;justify-self:end}}
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
    .ap2-next{font-size:12.5px} .ap2-next th.ap2-sh,.ap2-next td.ap2-sh{color:var(--faint);background:color-mix(in srgb,var(--line) 35%,transparent)}
    .ap2-next td small{display:block;font-size:10.5px;color:var(--faint);font-weight:600} .ap2-next tr.ap2-tot td{font-weight:800;border-top:2px solid var(--line)}
    .ap2-hire{color:var(--neg)} .ap2-ok{color:var(--pos);font-weight:700;font-size:11.5px} .ap2-dim{color:var(--faint)}
    .ap2-mpick{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 10px}
    .ap2-rankw{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 10px;font-size:12px;color:var(--muted)} .ap2-rankw label{display:inline-flex;gap:6px;align-items:center;font-weight:700} .ap2-rankw input{width:64px}
    .ap2-rank2{display:grid;grid-template-columns:1fr 1fr;gap:14px} @media (max-width:1200px){.ap2-rank2{grid-template-columns:1fr}}
    .ap2-mbtn{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);cursor:pointer;text-align:left}
    .ap2-mbtn small{display:block;font-size:10.5px;font-weight:600;color:var(--faint)} .ap2-mbtn.on{border-color:var(--brand);color:var(--brand-d);background:var(--brand-glow)} .ap2-mbtn.on small{color:var(--brand-d)}
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
    /* the tab bar: sticky against .rs-content, whose 16px top padding the inset resolves against
       (monthly-report.js:610 proved top:0 parks it 16px low); z-index under the shell's own filters */
    .ap2-clockline{color:var(--muted);font-size:12.5px;margin:6px 0 0}
    .ap2-tabs{position:sticky;top:-16px;z-index:28;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
      background:var(--bg);padding:14px 0 8px;margin:0 0 12px;border-bottom:1px solid var(--line)}
    .ap2-tabs .sp{flex:1 1 auto}
    .ap2-pane[hidden]{display:none}
    /* a table that scrolls with the page (no .rs-tablewrap, no overflow div of its own) must pin its
       header below the tab bar, or the bar paints straight over it */
    .ap2-pane table.ap2-below-tabs th{top:54px}
    .ap2-assume{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap;background:var(--panel-2);
      border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:0 0 14px}
    .ap2-assume>.h{flex:1 1 210px;min-width:180px;font-size:12px;color:var(--muted);line-height:1.5}
    .ap2-assume .ap2-dial{margin:0}
    .ap2-assume .ap2-dials{margin-top:0;padding-top:0;border-top:0}          /* any display rule of our own would defeat the bare attribute */
    .ap2-pane>.ap2-lede{color:var(--muted);font-size:13px;margin:0 0 14px;max-width:104ch}
    .ap2-tt{position:sticky;left:0;z-index:1;display:flex;align-items:center;gap:8px;justify-content:flex-end;margin:0 0 6px}
    .ap2-tt .n{font-size:11.5px;color:var(--faint);margin-right:auto}
    .ap2-tt .rs-btn{padding:3px 10px;font-size:11.5px}
    .ap2-meas{display:inline-block;margin-left:6px;font-size:9.5px;font-weight:800;letter-spacing:.03em;
      text-transform:uppercase;color:var(--pos);background:color-mix(in srgb,var(--pos) 13%,transparent);
      border-radius:999px;padding:1px 6px;vertical-align:1px}
    .ap2-pool td{background:color-mix(in srgb,var(--brand) 7%,transparent);border-top:1px solid var(--line)}
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


/* ---------- THE FORMULA (2026-09-20) ------------------------------------------ */
.ap2-formula{display:block}
.ap2-formula .f-eq{display:flex;align-items:baseline;gap:9px;flex-wrap:wrap;
  padding:9px 12px;border:1px solid var(--ap-rule);border-radius:var(--ap-r2);
  background:var(--ap-sub);margin:0 0 7px;font-size:14px;color:var(--ink)}
.ap2-formula .f-eq .n{font-family:var(--ap-mono);font-size:11px;font-weight:700;color:var(--ap-live);
  border:1px solid var(--ap-rule-2);border-radius:var(--ap-r3);padding:1px 6px;flex:none}
.ap2-formula .f-eq em{font-style:normal;color:var(--muted);padding:0 1px}
.ap2-formula .f-eq b{font-family:var(--ap-mono);font-weight:800;color:var(--ap-live)}
.ap2-formula .f-eq small{flex:1 1 220px;color:var(--muted);font-size:11.5px;text-align:right}
.ap2-formula .f-unit{margin:11px 0 0;padding:11px 13px;border-radius:var(--ap-r2);
  background:var(--ap-live-soft);border:1px solid var(--ap-rule-2);font-size:13.5px;line-height:1.6}
.ap2-formula .f-unit b{color:var(--ink)}
.ap2-formula .f-lead{font-size:13.5px;color:var(--muted);line-height:1.6;margin:0 0 9px}
.ap2-formula .f-lead b{color:var(--ink);font-size:14.5px}
.ap2-next td small{display:block;color:var(--muted)}
/* ---------- THE MAP (2026-09-20) ----------------------------------------------
   Leaflet is vendored and lazy-loaded; the tile layer is Carto Voyager, the same one
   cleanup.js and ld-planning.js already use. Colours come from the SEMANTIC tokens so
   the key means the same thing here as everywhere else on the page. */
.ap2-mapbox{height:540px;border-radius:var(--ap-r1);border:1px solid var(--ap-rule);
  background:var(--ap-sub);overflow:hidden}
.ap2-mapkey{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 0 10px;
  font-size:11.5px;color:var(--muted)}
.ap2-mapkey .sp{flex:1 1 auto}
.ap2-mk{display:inline-flex;align-items:center;gap:6px}
.ap2-mk b{color:var(--ink);font-variant-numeric:tabular-nums}
.ap2-sw{width:11px;height:11px;border-radius:50%;flex:none;border:1px solid var(--ap-rule-2)}
.ap2-sw.push{background:var(--ap-pos-ink)} .ap2-sw.hold{background:var(--ap-warn-ink)}
.ap2-sw.fix{background:var(--ap-neg-ink)}  .ap2-sw.grey{background:var(--muted)}
.ap2-sw.unc{background:transparent;border:2px dashed var(--ap-neg-ink)}
/* the tooltip is Leaflet's, so it is styled through its own wrapper class */
.leaflet-tooltip.ap2-tipwrap{background:var(--ap-bay);color:var(--ink);border:1px solid var(--ap-rule-2);
  border-radius:var(--ap-r2);box-shadow:0 8px 24px rgba(0,0,0,.28);padding:9px 11px;font-family:inherit}
.leaflet-tooltip.ap2-tipwrap:before{display:none}
.ap2-tip{font-size:12px;line-height:1.55;max-width:290px}
.ap2-tip b{font-size:13px;color:var(--ink)}
.ap2-tip .t{font-family:var(--ap-mono);font-size:11px;letter-spacing:.04em;color:var(--ap-live);margin:1px 0 4px}
.ap2-tip .b{margin-top:5px;padding-top:5px;border-top:1px solid var(--ap-rule);color:var(--ink);font-weight:700}
.ap2-tip .c{color:var(--muted)}
.ap2-tip .w{margin-top:4px;color:var(--ap-neg-ink);font-weight:700}
.ap2-tip small{display:block;color:var(--muted);font-weight:400}

/* ═══════════════════════════════════════════════════════════════════════════════
   SEASONAL PLANNING — COMMAND SURFACE (visual layer, 2026-09-20)
   Appended after the ap2- block above. Nothing above is removed.

   THREE CONTEXTS, ONE SHEET. RSC.printView re-uses this stylesheet verbatim
   (area-plan.js:1177 passes pageCss:"ap-style") into a document whose tokens sit on
   :root and whose <body> has NO rs-app and NO light class (rs-components.js:904,:984).
   So the contract is:
     · a rule that restyles a KIT component (.panel .rs-table .rs-tab .rs-btn .rs-num
       .rs-seg .rs-pill) carries body.rs-app  -> screen only, paper keeps printView's
       own paper design for those components;
     · a rule on an ap2- class stays unprefixed -> it reaches screen AND paper, which
       is what the existing block already does;
     · body.rs-app.light  -> never matches on paper.

   NO GRADIENTS. His standing brief: solid filled, not partially; no gradients, no
   radial glows. Every fill here is a flat token. The only repeating-linear-gradient
   is a RULER of 1px hairlines - texture, not a fade. Kill switch: --ap-ruler:none.

   INVARIANTS RESTATED SO A PASTE CANNOT LOSE THEM:
     · .ap2-tabs stays sticky top:-16px / z-index:28, and its box is EXACTLY
       14 + 32 + 7 + 1 = 54px, because three tables pin their header at top:54px
       (.ap2-below-tabs, area-plan.js:225). #apPdf is pinned to 32px below for the
       same reason - it is a .rs-btn (~36px) and today it drives the bar to ~59px.
     · NO display property on .ap2-pane - any display rule of ours defeats the bare
       [hidden] attribute.
     · .ap2-assume .ap2-dials keeps margin-top:0 / padding-top:0 / border-top:0.
     · .ap2-sech keeps scroll-margin-top:72px - 16 goto buttons land on it.
     · NEVER put white-space in the same rule as overflow-wrap:anywhere - it makes
       the wrap inert and the hero labels overprint.
     · NO overflow:hidden on a panel, a pane or .ap2-d - it re-anchors every sticky
       header and clips RSC.localSelect popovers.
   ═══════════════════════════════════════════════════════════════════════════════ */

/* ---------- 1 · TOKENS ------------------------------------------------------
   On the four roots this page owns. NOT on body.rs-app: a page that writes custom
   properties onto the shared shell node leaks them into the next report the reader
   opens (portal-design-system.md records cl-analysis.js doing exactly that). */
.ap2-tabs,.ap2-pane,.ap2-assume,.ap2-clockline{
  --ap-mono:"Cascadia Mono","Segoe UI Mono","SF Mono",Consolas,ui-monospace,monospace;
  --ap-r1:10px; --ap-r2:7px; --ap-r3:4px;
  --ap-rule:var(--line); --ap-rule-2:var(--line-2);
  --ap-bay:var(--panel); --ap-sub:var(--panel-2);
  --ap-live:var(--brand);                 /* accent: live / typed / the outcome */
  --ap-fill:var(--brand);                 /* a lime FILL, always with --brand-ink */
  --ap-live-soft:color-mix(in srgb,var(--brand) 11%,transparent);
  --ap-wash:12%;
  --ap-tick:color-mix(in srgb,var(--ink) 12%,transparent);
  --ap-lip:color-mix(in srgb,var(--ink) 7%,transparent);
  /* INK-ON-WHITE IS THE DEFAULT, DARK STATES ITSELF (2026-09-20 review). These were gated on
     body.rs-app.light , which NEVER matches in the print document -- rs-components.js builds a
     page with no rs-app and no light class -- so the deck he presents from printed the dark-theme
     semantic inks on white paper. Light and paper want the same thing, so they are the base. */
  --ap-sink:inset 0 1px 2px rgba(16,32,48,.10);
  --ap-live:var(--brand-d);               /* --brand is 2.66:1 on white - invisible as a hairline */
  --ap-fill:var(--brand-d);               /* #fff on --brand is 2.93:1; on --brand-d it is 4.78:1 */
  --ap-live-soft:color-mix(in srgb,var(--brand) 15%,transparent);
  --ap-wash:8%;                           /* a white substrate needs less tint to hold 4.5:1 */
  --ap-lip:transparent;                   /* a dark inner lip on a white card reads as a shadow */
  --ap-pos-ink:color-mix(in srgb,var(--pos) 80%,var(--ink));
  --ap-warn-ink:color-mix(in srgb,var(--warn) 76%,var(--ink));   /* 82% cleared 4.5:1 on --panel only */
  --ap-neg-ink:color-mix(in srgb,var(--neg) 80%,var(--ink));
  /* THE RULER IS GONE (2026-09-20 review): a per-track graduation cannot be seen under a solid
     fill, and its pitch differed on every row, so it read as texture rather than a scale. Every
     bar already has its number spelled out beside it. Kept as a token so nothing downstream breaks. */
  --ap-ruler:none;
  --ap-t:.13s; --ap-ease:cubic-bezier(.2,.7,.3,1);
}
/* DARK is the variant now. :not(.light) so it cannot reach paper either. */
body.rs-app:not(.light) .ap2-tabs,body.rs-app:not(.light) .ap2-pane,
body.rs-app:not(.light) .ap2-assume,body.rs-app:not(.light) .ap2-clockline{
  --ap-live:var(--brand); --ap-fill:var(--brand);
  --ap-live-soft:color-mix(in srgb,var(--brand) 11%,transparent);
  --ap-wash:12%;
  --ap-lip:color-mix(in srgb,var(--ink) 7%,transparent);
  --ap-sink:inset 0 2px 3px rgba(0,0,0,.45);
  --ap-pos-ink:var(--pos); --ap-warn-ink:var(--warn); --ap-neg-ink:var(--neg);
}

/* ---------- 2 · THE READOUT REGISTER ----------------------------------------
   Monospace where a number is a READING and where chrome is machine chrome.
   DELIBERATELY NOT on .rs-table td.num (120 cells, area-plan.js:700-708): mono digits
   run 5-8% wider than Inter's tnum and dark_plan/w1707_00.png shows the 14-column
   crews table already at full width at 1707px. Prose, table headers and .ap2-d .dh b
   ("23 foremen" is a phrase, not a readout) stay Inter. */
.ap2-step .v,.ap2-led-g>.v,.ap2-assume .rs-num,.ap2-pane .rs-num,
.ap2-tt .n,.ap2-pager,.ap2-stamps,.ap2-q .qn,.ap2-meas,
.ap2-band .k,.ap2-eyebrow{   /* .ap2-d .dq and .ap2-dial .l left OUT: a sentence is not a readout */
  font-family:var(--ap-mono);font-variant-numeric:tabular-nums;
  font-feature-settings:"tnum" 1,"zero" 1}
/* the 11px floor. Eight declarations sat under it (one at 9.5px, two at 10px, five at
   10.5px) - the a11y pass never actually applied one. */
.ap2-dt th{font-size:11px;color:var(--muted);letter-spacing:.05em;padding:4px 4px;
  border-bottom:1px solid var(--ap-rule-2)}
.ap2-led-g>.l{font-size:11px;letter-spacing:.09em;color:var(--muted);overflow-wrap:anywhere}
.ap2-step .l{font-size:11px;color:var(--muted);overflow-wrap:anywhere;
  display:block;min-height:2.6em}   /* two lines reserved: a wrapped label used to drop its value 15px */
.ap2-dial .l{font-size:11px;letter-spacing:.09em;color:var(--muted);margin-bottom:6px}
.ap2-eyebrow{font-size:11px;letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.ap2-mbtn small{font-size:11px}
.ap2-next td small{font-size:11px}
/* --faint stops being a text colour on this page: 3.30:1 on --panel in dark,
   2.97:1 on white in light. Seventeen rules, all of them. */
.ap2-step .s,.ap2-dial .m,.ap2-dem .n small,.ap2-leak .n small,.ap2-tie,.ap2-small,
.ap2-dim,.ap2-stamps,.ap2-pager,.ap2-tt .n,.ap2-next td small,.ap2-card .foot,
.ap2-mbtn small,.ap2-dt th,.ap2-led-g>.l,details.ap2-ref>summary small,
.ap2-note,.ap2-say,.ap2-pane>.ap2-lede{color:var(--muted)}
.ap2-note,.ap2-say,.ap2-pane>.ap2-lede{text-wrap:pretty}

/* ---------- 3 · THE TAB RAIL ------------------------------------------------
   GEOMETRY IS FROZEN AT 54px: 14 padding-top + 32 tab + 7 padding-bottom + 1 border.
   That is the number .ap2-below-tabs th{top:54px} (area-plan.js:225) has always assumed
   and never actually had - #apPdf is a .rs-btn (13px / 9px padding ~= 36px tall) sitting
   in an align-items:center bar, which drives it to ~59px today. Both fixes are here and
   they are a pair: change one and the bar paints over three sticky headers, silently. */
.ap2-tabs{padding:14px 0 7px;border-bottom:1px solid var(--ap-rule)}
.ap2-tabs:not(:has(.rs-tab)){display:none}   /* printView removes #apTabs and every button
                                                (rs-components.js:852) but keeps this div -
                                                an empty bordered strip prints today */
#apTabs{counter-reset:apch}                  /* #apTabs carries inline display/gap (:1149) - leave them */
#apTabs .rs-tab{position:relative;height:32px;padding:0 14px;border-radius:var(--ap-r2);
  border:1px solid var(--ap-rule);background:var(--ap-sub);color:var(--muted);
  font-family:inherit;font-size:12.5px;font-weight:700;
  transition:color var(--ap-t) var(--ap-ease),border-color var(--ap-t) var(--ap-ease),
             background var(--ap-t) var(--ap-ease),box-shadow var(--ap-t) var(--ap-ease)}
/* aria-hidden is not available to a pseudo-element, so the ordinal is given an empty
   alt via content's alt-text syntax: assistive tech reads "", sighted readers see "01". */
#apTabs .rs-tab::before{counter-increment:apch;
  content:counter(apch,decimal-leading-zero) / "";
  font-family:var(--ap-mono);font-size:11px;font-weight:700;letter-spacing:.06em;
  color:var(--muted);margin-right:9px}
#apTabs .rs-tab:hover{color:var(--ink);border-color:var(--ap-rule-2);background:var(--ap-sub)}
/* the live channel. box-shadow:inset, never a border or a padding change - the 32px box
   must not move. Label is --ink, not lime: 13:1 in both themes. */
#apTabs .rs-tab.on{background:var(--ap-live-soft);border-color:var(--ap-live);color:var(--ink);
  box-shadow:inset 0 -2px 0 var(--ap-live)}
#apTabs .rs-tab.on::before{color:var(--ap-live)}
.ap2-tabs .rs-btn{height:32px;padding:0 14px;display:inline-flex;align-items:center;
  border-radius:var(--ap-r2);font-size:12.5px}

/* ---------- 4 · THE CONSOLE (assumptions + dials) --------------------------- */
.ap2-assume{position:relative;display:flex;align-items:flex-start;gap:20px;flex-wrap:wrap;
  background:var(--ap-sub);border:1px solid var(--ap-rule);border-radius:var(--ap-r1);
  padding:13px 16px;margin:0 0 14px}
.ap2-assume>.h{flex:1 1 210px;min-width:180px;font-size:12px;color:var(--muted);line-height:1.55}
.ap2-assume .ap2-dials{display:flex;flex-wrap:wrap;gap:0;margin-top:0;padding-top:0;border-top:0}
.ap2-assume .ap2-dial{margin:0;padding:0 22px}
.ap2-assume .ap2-dial:first-child{padding-left:0}
.ap2-assume .ap2-dial+.ap2-dial{border-left:1px solid var(--ap-rule)}
@media (max-width:1180px){                   /* a wrapped dial must not start a line with a divider */
  .ap2-assume .ap2-dial+.ap2-dial{border-left:0}
  .ap2-assume .ap2-dial{padding:0 20px 0 0}}
.ap2-dial .m{font-size:11.5px;margin-top:6px;max-width:260px;line-height:1.5}
/* INPUTS SINK, RESULTS RISE. The z-axis says what a number IS before a word is read:
   a hole you typed into, or a face the data computed. Panels and cards are the raised
   bay; every .rs-num on the page is a recess in it. */
body.rs-app .ap2-assume .rs-num,body.rs-app .ap2-pane .rs-num{
  background:var(--bg);color:var(--ink);border:1px solid var(--ap-rule-2);
  border-radius:var(--ap-r2);box-shadow:var(--ap-sink);
  font-family:var(--ap-mono);font-size:15px;font-weight:700;padding:7px 11px;
  transition:border-color var(--ap-t) var(--ap-ease),box-shadow var(--ap-t) var(--ap-ease)}
body.rs-app .ap2-pane .rs-num{font-size:13px;padding:6px 9px}
body.rs-app .ap2-assume .rs-num:hover,body.rs-app .ap2-pane .rs-num:hover{border-color:var(--ap-live)}
body.rs-app .ap2-assume .rs-num:focus,body.rs-app .ap2-pane .rs-num:focus{
  border-color:var(--ap-live);box-shadow:var(--ap-sink),0 0 0 3px var(--brand-glow)}
/* THE MACHINED BRACKET - on exactly two elements, and they are the two surfaces you
   OPERATE: the dials that size the plan, and the hero the dials produce. On every panel
   it would be wallpaper. Two pseudo-elements, no gradient, nothing that repaints. */
.ap2-assume::before,.ap2-assume::after,.ap2-hero::before,.ap2-hero::after{
  content:"";position:absolute;width:13px;height:13px;pointer-events:none;
  border:2px solid var(--ap-live)}
.ap2-assume::before,.ap2-hero::before{top:-1px;left:-1px;border-right:0;border-bottom:0;
  border-radius:var(--ap-r1) 0 0 0}
.ap2-assume::after,.ap2-hero::after{bottom:-1px;right:-1px;border-left:0;border-top:0;
  border-radius:0 0 var(--ap-r1) 0}

/* ---------- 5 · CHANNEL HEADS ----------------------------------------------
   THREE OF THE FOUR .ap2-band INSTANCES CARRY INLINE border-top:0;padding-top:0
   (area-plan.js:1626, :1841, :2088) and inline beats any stylesheet rule. So the marker
   is a FLEX ITEM, which inline style cannot reach. Never a border, never a :not([style]). */
.ap2-band{align-items:baseline;gap:0 14px;margin:26px 0 12px;padding-top:15px;
  border-top:1px solid var(--ap-rule)}
.ap2-band::before{content:"";flex:none;align-self:center;width:26px;height:2px;
  border-radius:1px;background:var(--ap-live)}
.ap2-band .k{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted)}                        /* was var(--brand) at :118 - 2.66:1 in light */
.ap2-band h2{margin:0;font-size:17px;font-weight:800;letter-spacing:-.35px;color:var(--ink)}
.ap2-band .clock{margin-left:auto;font-size:11.5px;color:var(--muted);font-weight:600}
/* the section header as a channel: lime stub - title - rule out to the content edge */
.ap2-sech{display:flex;align-items:center;gap:11px;font-size:15.5px;font-weight:800;
  letter-spacing:-.2px;color:var(--ink);margin:26px 0 8px;scroll-margin-top:72px}
.ap2-sech:first-child{margin-top:0}
.ap2-sech::before{content:"";flex:none;width:3px;height:15px;border-radius:1px;background:var(--ap-live)}
.ap2-sech::after{content:"";flex:1 1 auto;height:1px;background:var(--ap-rule)}

/* ---------- 6 · THE DECISION BAYS ------------------------------------------
   The identical border-top:3px solid var(--brand) came off all three cards (:93) - three
   identical accents say nothing. .dq becomes a full-bleed recessed channel head with one
   lime tick. NOTE: .ap2-d .dn is DEAD - grep -c 'class="dn"' returns 0. .dq is the live
   eyebrow, emitted first at area-plan.js:1631/:1638/:1648.
   The .dq negative margins are TIED to .ap2-d's padding: move one, move both. */
.ap2-dec{gap:14px;margin-top:12px}
.ap2-d{background:var(--ap-bay);border:1px solid var(--ap-rule);
  border-top:1px solid var(--ap-rule);border-radius:var(--ap-r1);padding:14px 16px}
.ap2-d .dq{display:flex;align-items:center;gap:9px;margin:-14px -16px 13px;padding:10px 16px;
  background:var(--ap-sub);border-bottom:1px solid var(--ap-rule);
  border-radius:var(--ap-r1) var(--ap-r1) 0 0;
  font-size:11px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:var(--muted)}
.ap2-d .dq::before{content:"";flex:none;width:3px;height:12px;border-radius:1px;background:var(--ap-live)}
.ap2-d .dh{font-size:13.5px;color:var(--muted);line-height:1.55}
.ap2-d .dh b{font-size:27px;letter-spacing:-.5px;font-variant-numeric:tabular-nums}
.ap2-dt td:first-child{color:var(--ink);font-weight:650}
.ap2-dt td{border-bottom:1px solid color-mix(in srgb,var(--ap-rule) 60%,transparent)}

/* ---------- 7 · HERO, STEPS, LEDGER ----------------------------------------
   body.rs-app IS REQUIRED: .ap2-hero{padding} (:126) is DEAD today at (0,1,0) under
   body.rs-app .panel (0,2,1, rs.css:201). These tie body.rs-app.light .panel (0,3,1,
   rs.css:317) at (0,3,1) and win on source order, because injectStyle appends this
   <style> to <head> AFTER the rs.css link (area-plan.js:280). If that ever moves, every
   panel rule here silently loses in the light theme. */
body.rs-app .ap2-pane .panel,body.rs-app .ap2-hero.panel{
  background:var(--ap-bay);                  /* flattens rs.css:201's hard-coded dark gradient */
  border:1px solid var(--ap-rule);border-radius:var(--ap-r1);box-shadow:none;padding:14px 16px}
body.rs-app .ap2-hero.panel{position:relative;padding:20px 22px 17px}
body.rs-app .ap2-pane .rs-tablewrap{border-radius:var(--ap-r1);border-color:var(--ap-rule)}
/* DEPTH IS AN EDGE, NOT A GRADIENT - dark only; on white it would just grey every card top */
body.rs-app:not(.light) .ap2-pane .panel,body.rs-app:not(.light) .ap2-hero.panel,
body.rs-app:not(.light) .ap2-d,body.rs-app:not(.light) .ap2-q,
body.rs-app:not(.light) .ap2-card{box-shadow:inset 0 1px 0 var(--ap-lip)}
.ap2-step{padding:2px 20px 2px 0}
.ap2-step+.ap2-step{padding-left:20px;border-left:1px solid var(--ap-rule)}
.ap2-step .v{font-size:29px;font-weight:700;letter-spacing:-.4px;line-height:1.15;margin-top:6px;
  color:var(--ink);padding-bottom:5px;border-bottom:2px solid transparent}
/* A CROSSED THRESHOLD UNDERSCORES ITSELF - a second, non-colour cue at the exact place the
   eye already is. The transparent placeholder keeps all six tiles on ONE optical baseline,
   which a padding shift would destroy. */
.ap2-step .v.warn{color:var(--ap-warn-ink);border-bottom-color:var(--warn)}
.ap2-step .v.good{color:var(--ink);border-bottom-color:var(--ap-live)}
.ap2-step .s{font-size:11.5px;margin-top:5px;line-height:1.5}
body.rs-app .ap2-pane .ap2-led.panel{padding:16px 20px}   /* (0,1,0) lost to body.rs-app .panel */
.ap2-led-g+.ap2-led-g{padding-left:18px;border-left:1px solid var(--ap-rule)}
.ap2-led-g>.v{font-size:clamp(23px,1.85vw,29px);font-weight:700;letter-spacing:-.4px;margin-top:6px}
.ap2-led-g>.v.pos{color:var(--ap-pos-ink)}   /* was var(--brand) at :199 - 2.66:1 in light */
.ap2-led-g>.v.warn{color:var(--ap-warn-ink)}
.ap2-led-g>.s{margin-top:6px}

/* ---------- 8 · TELEMETRY --------------------------------------------------
   .ap2-chip carried TWO conflicting definitions - a status tag (:109) and a filter button
   (:247) - and the LATER one won for border/cursor/padding, so the "answered"/"measured"
   spans at :1782 render outlined with a pointer cursor and impersonate buttons (visible in
   dark_decide/w1707_00.png). Split by ELEMENT, which the markup guarantees: buttons at
   :818, spans at :1782. Element-type is safer than [data-focus], which .ap2-dem (:672) and
   tr.ap2-row (:693) also carry. */
span.ap2-chip{display:inline-flex;align-items:center;gap:6px;font-family:var(--ap-mono);
  font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;line-height:1.4;
  border-radius:var(--ap-r3);padding:3px 8px;white-space:nowrap;border:1px solid transparent;
  background:transparent;color:var(--muted);cursor:default}
span.ap2-chip::before{content:"";flex:none;width:6px;height:6px;border-radius:1px;background:currentColor}
span.ap2-chip.y{color:var(--ap-pos-ink);background:color-mix(in srgb,var(--pos) var(--ap-wash),transparent);
  border-color:color-mix(in srgb,var(--pos) 30%,transparent)}
span.ap2-chip.p{color:var(--ap-warn-ink);background:color-mix(in srgb,var(--warn) var(--ap-wash),transparent);
  border-color:color-mix(in srgb,var(--warn) 32%,transparent)}
span.ap2-chip.n{color:var(--ap-neg-ink);background:color-mix(in srgb,var(--neg) var(--ap-wash),transparent);
  border-color:color-mix(in srgb,var(--neg) 30%,transparent)}
/* the CONTROL: the Cities focus row. :250 set color:#fff on a lime fill - 1.48:1 in dark,
   2.93:1 in light. That is the "All" chip washing out in dark_cities/w1707_00.png. */
button.ap2-chip{font-family:inherit;font-size:11.5px;font-weight:700;letter-spacing:.04em;
  padding:6px 12px;border-radius:var(--ap-r2);border:1px solid var(--ap-rule);
  background:var(--ap-sub);color:var(--muted);cursor:pointer;white-space:nowrap;
  transition:color var(--ap-t) var(--ap-ease),border-color var(--ap-t) var(--ap-ease),
             background var(--ap-t) var(--ap-ease)}
button.ap2-chip:hover{color:var(--ink);border-color:var(--ap-rule-2)}
button.ap2-chip.on{background:var(--ap-fill);border-color:var(--ap-fill);
  color:var(--brand-ink);font-weight:800}    /* 12.7:1 dark, 4.78:1 light */
.ap2-meas{display:inline-block;margin-left:6px;font-size:11px;font-weight:700;letter-spacing:.04em;
  text-transform:uppercase;color:var(--ap-pos-ink);border-radius:var(--ap-r3);padding:1px 6px;
  vertical-align:1px;background:color-mix(in srgb,var(--pos) var(--ap-wash),transparent);
  border:1px solid color-mix(in srgb,var(--pos) 30%,transparent)}
/* the question index is STAMPED into the card, not printed on it */
.ap2-q{background:var(--ap-bay);border:1px solid var(--ap-rule);border-radius:var(--ap-r1);padding:13px 15px}
.ap2-q .qh{gap:9px;margin-bottom:8px}
.ap2-q .qn{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;
  padding:0 6px;font-size:11px;font-weight:700;letter-spacing:.04em;color:var(--ink);
  background:var(--bg);border:1px solid var(--ap-rule-2);border-radius:var(--ap-r3);
  box-shadow:var(--ap-sink)}
.ap2-q .qa{margin-top:6px;line-height:1.6}
/* semantic small text, all of it on the darkened inks in light */
.ap2-ok{color:var(--ap-pos-ink);font-weight:700;font-size:11.5px;letter-spacing:.03em}
.ap2-hire{color:var(--ap-neg-ink);font-weight:800;font-variant-numeric:tabular-nums}
.ap2-warn{color:var(--ap-warn-ink);font-size:12px;font-weight:700}
.ap2-lost,.ap2-tension,.ap2-tie.bad{color:var(--ap-warn-ink);font-weight:700}
.ap2-yoy{font-weight:800;font-size:11.5px}
.ap2-yoy.up{color:var(--ap-pos-ink)} .ap2-yoy.dn{color:var(--ap-neg-ink)}
/* kit pills: square the corner, and fix --warn, which is 3.56:1 on white today */
body.rs-app .ap2-pane .rs-pill{border-radius:var(--ap-r3)}
.ap2-pane .rs-pill.ok{color:var(--ap-pos-ink)}
.ap2-pane .rs-pill.warn{color:var(--ap-warn-ink)}
.ap2-pane .rs-pill.bad{color:var(--ap-neg-ink)}

/* ---------- 9 · BARS: SOLID SLUGS IN A GRADUATED CHANNEL --------------------
   His rule: solid filled, not partially. The lead/booked seam is a 1px notch, not a fade.
   THE RULER answers a real defect: in dark_cities/w1707_00.png the distance ladder's
   15.1 / 15.0 / 14.0 / 13.5% render as four bars you cannot tell apart, so the chart adds
   nothing the numbers beside it already say. Bars are relative to the widest (area-plan.js
   :854), so the ticks are tenths OF THE WIDEST BAR - a comparison scale, not an axis.
   One static background-image on ~25 elements. Nothing repaints on scroll.
   box-shadow, not border, for the channel wall: a border would change the track height. */
.ap2-dem .t,.ap2-lad .t,.ap2-leak .t{position:relative;overflow:hidden;
  border-radius:var(--ap-r3);background-color:var(--ap-sub);
  box-shadow:inset 0 0 0 1px var(--ap-rule)}
.ap2-dem .t{height:15px} .ap2-lad .t{height:14px} .ap2-leak .t{height:11px}
.ap2-dem .t .lead{border-radius:2px 0 0 2px;background:color-mix(in srgb,var(--ink) 22%,var(--ap-sub))}
.ap2-dem .t .book{border-radius:2px 0 0 2px;background:var(--ap-fill);
  box-shadow:1px 0 0 var(--ap-sub)}          /* the 1px seam against the lead slug */
.ap2-lad .t i{border-radius:2px 0 0 2px;background:var(--ap-fill)}
.ap2-leak .t i{border-radius:2px 0 0 2px;background:var(--warn)}
.ap2-dem{padding:9px 8px;border-bottom:1px solid var(--ap-rule);border-radius:var(--ap-r3);
  transition:background-color var(--ap-t) var(--ap-ease),box-shadow var(--ap-t) var(--ap-ease)}
.ap2-dem .n{font-weight:700;font-size:13.5px;color:var(--ink)}
.ap2-dem .n small{font-size:11px;font-weight:600}
.ap2-dem:hover{background:var(--ap-sub)}
.ap2-dem.on{background:var(--ap-live-soft);box-shadow:inset 3px 0 0 var(--ap-live)}
.ap2-lad,.ap2-leak{border-bottom:1px solid var(--ap-rule)}
.ap2-leak .n{font-size:13px;color:var(--ink)}

/* ---------- 10 · THE DENSE TABLES ------------------------------------------
   .rs-table td PADDING IS DELIBERATELY NOT TOUCHED. His 2026-08-24 note ("it is very
   dense" -> room to breathe, VERTICALLY only) bought that 13px; rs.css:583-588 records it.
   Density here comes from type, labels and hairlines, never from taking his air back.

   EVERY STATE BELOW IS WRITTEN TO BEAT rs.css:602 .rs-table tbody tr:hover td, which is
   (0,2,3) and uses the 'background' SHORTHAND - so today it erases the shoulder wash, the
   total, the pool tint and the selected-row tint the moment the mouse crosses the row, and
   would wipe any background-image too. That is a pre-existing defect, fixed here. */
.ap2-pane .rs-table td.ap2-sh{color:var(--muted);
  background:color-mix(in srgb,var(--ap-rule) 40%,transparent);
  box-shadow:inset 1px 0 0 var(--ap-rule-2),inset -1px 0 0 var(--ap-rule-2)}
.ap2-pane .rs-table th.ap2-sh{color:var(--muted);
  background:color-mix(in srgb,var(--ap-rule) 40%,transparent);
  box-shadow:inset 1px 0 0 var(--ap-rule-2),inset -1px 0 0 var(--ap-rule-2),0 1px 0 var(--ap-rule-2)}
.ap2-pane .rs-table tbody tr.ap2-tot td{font-weight:800;color:var(--ink);background:var(--ap-sub);
  border-top:0;box-shadow:inset 0 2px 0 var(--ap-live)}   /* the sum is a LIT EDGE, not a slab */
.ap2-pane .rs-table tbody tr.ap2-pool td{background:var(--ap-live-soft);
  border-top:1px solid var(--ap-rule)}
.ap2-pane .rs-table tbody tr.ap2-pool td:first-child{box-shadow:inset 3px 0 0 var(--ap-live)}
/* A SUMMARY ROW MUST STILL SAY WHICH MONTHS ARE SHOULDERS (2026-09-20 review). tr.ap2-tot td and
   tr.ap2-pool td are (0,3,3) and beat td.ap2-sh at (0,3,1), so the totals row -- the one row where
   mistaking a shoulder for a season month changes the answer -- washed flat. These are (0,3,4). */
.ap2-pane .rs-table tbody tr.ap2-tot td.ap2-sh{
  background:color-mix(in srgb,var(--ap-rule) 40%,var(--ap-sub));
  box-shadow:inset 0 2px 0 var(--ap-live),inset 1px 0 0 var(--ap-rule-2),inset -1px 0 0 var(--ap-rule-2)}
.ap2-pane .rs-table tbody tr.ap2-pool td.ap2-sh{
  background:color-mix(in srgb,var(--ap-rule) 30%,var(--ap-live-soft))}
.ap2-pane .rs-table tbody tr.ap2-row.on td{background:var(--ap-live-soft)}
.ap2-pane .rs-table tbody tr.ap2-row.on td:first-child{box-shadow:inset 3px 0 0 var(--ap-live)}
.ap2-pane .rs-table tbody tr.ap2-sub td{background:var(--ap-sub);color:var(--muted);font-size:12px}
.ap2-pane .rs-table tbody tr.ap2-sub td:first-child{padding-left:26px}
/* A STICKY HEADER'S COLLAPSED BORDER DOES NOT TRAVEL WITH IT. rs.css:579 sets
   border-collapse:collapse, so a th pinned at top:0 or top:54px loses its rule as rows
   scroll under it. A box-shadow is painted by the cell and travels. */
body.rs-app .ap2-pane .rs-table th:not(.ap2-sh){border-bottom:0;box-shadow:0 1px 0 var(--ap-rule-2)}
/* the shoulder header keeps its side rails AND the travelling bottom rule */
body.rs-app .ap2-pane .rs-table th.ap2-sh{border-bottom:0;
  box-shadow:inset 1px 0 0 var(--ap-rule-2),inset -1px 0 0 var(--ap-rule-2),0 1px 0 var(--ap-rule-2)}
.ap2-next td small{display:block;font-weight:600}
.ap2-th{cursor:pointer;user-select:none;white-space:nowrap;transition:color var(--ap-t) var(--ap-ease)}
.ap2-th:hover,.ap2-th.on{color:var(--ap-live)}   /* was var(--brand) at :215 - 2.66:1 in light */
/* the CSV strip becomes the table's own header rail. position:sticky;left:0 MUST STAY -
   it is what keeps the bar in view inside a horizontally scrolling wrap. */
.ap2-tt{position:sticky;left:0;z-index:1;display:flex;align-items:center;gap:10px;
  justify-content:flex-end;margin:0 0 9px;padding-bottom:7px;border-bottom:1px solid var(--ap-rule)}
.ap2-tt .n{flex:1 1 auto;margin-right:0;font-size:11px;font-weight:700;letter-spacing:.07em;
  text-transform:uppercase}
.ap2-tt .n::before{content:"";display:inline-block;width:5px;height:5px;border-radius:1px;
  background:var(--ap-live);margin-right:8px;vertical-align:1px}
body.rs-app .ap2-tt .rs-btn{padding:4px 11px;font-size:11px;border-radius:var(--ap-r3);
  font-family:var(--ap-mono);letter-spacing:.04em;text-transform:uppercase}
.ap2-pager{font-size:12px;letter-spacing:.03em}

/* ---------- 11 · CARDS, CALLOUT, CONTROLS, REFERENCE ----------------------- */
.ap2-cards,.ap2-grid{gap:14px}
.ap2-card{background:var(--ap-bay);border:1px solid var(--ap-rule);border-radius:var(--ap-r1);
  padding:14px 16px}
.ap2-card.hot{border-color:color-mix(in srgb,var(--warn) 55%,var(--ap-rule));
  box-shadow:inset 3px 0 0 var(--warn)}
.ap2-card .foot{border-top:1px solid var(--ap-rule)}
.ap2-callout{background:var(--ap-live-soft);border:1px solid var(--ap-rule);
  border-left:3px solid var(--ap-live);
  border-radius:var(--ap-r3) var(--ap-r1) var(--ap-r1) var(--ap-r3);padding:14px 16px}
.ap2-mbtn{border-radius:var(--ap-r2);border:1px solid var(--ap-rule);background:var(--ap-sub);
  color:var(--muted);padding:7px 12px;
  transition:color var(--ap-t) var(--ap-ease),border-color var(--ap-t) var(--ap-ease),
             background var(--ap-t) var(--ap-ease)}
.ap2-mbtn:hover{color:var(--ink);border-color:var(--ap-rule-2)}
.ap2-mbtn.on{border-color:var(--ap-live);color:var(--ink);background:var(--ap-live-soft);
  box-shadow:inset 3px 0 0 var(--ap-live)}
.ap2-mbtn.on small{color:var(--muted)}
.ap2-in{border-radius:var(--ap-r2);border-color:var(--ap-rule-2)}
.ap2-in:focus{border-color:var(--ap-live)}
/* rs.css:548 .rs-seg button.on is --brand-ink on --brand: #fff on #7fa32b = 2.93:1 in light */
body.rs-app .ap2-pane .rs-seg{border-radius:var(--ap-r2)}
body.rs-app .ap2-pane .rs-seg button{border-radius:var(--ap-r3)}
body.rs-app .ap2-pane .rs-seg button.on{background:var(--ap-fill);color:var(--brand-ink)}
.ap2-goto,.ap2-golink{color:var(--brand-d)}  /* the only brand token safe as text in both themes */
details.ap2-ref>summary{border:1px solid var(--ap-rule);border-radius:var(--ap-r1);
  background:var(--ap-sub);font-size:13.5px;
  transition:border-color var(--ap-t) var(--ap-ease),color var(--ap-t) var(--ap-ease)}
details.ap2-ref>summary:hover{border-color:var(--ap-rule-2)}
details.ap2-ref>summary::before{color:var(--ap-live)}   /* was var(--brand) at :275 */

/* ---------- 12 · FOCUS ------------------------------------------------------
   There are ZERO :focus-visible rules in area-plan.js and ZERO in rs.css. Chips, gotos,
   sort headers and method buttons all ride the UA default today. Element-type selectors,
   so a control added later is covered without editing this list. */
.ap2-tabs .rs-tab:focus-visible,.ap2-tabs .rs-btn:focus-visible,
.ap2-pane button:focus-visible,.ap2-pane a:focus-visible,.ap2-pane input:focus-visible,
.ap2-pane summary:focus-visible,.ap2-pane [tabindex]:focus-visible,
.ap2-assume input:focus-visible,.ap2-assume a:focus-visible,
.ap2-clockline a:focus-visible,.rs-page-head a:focus-visible{outline:2px solid var(--ap-live);outline-offset:2px}

/* ---------- 13 · MOTION -----------------------------------------------------
   TRANSITIONS ONLY, and that is structural, not taste. paint() rewrites host.innerHTML
   (area-plan.js:2058) on every period, seed and focus change; an @keyframes entrance would
   replay on all of them and reproduce the 2026-08-24 flash rs.css cured by moving rsfade
   onto .rs-content (rs.css:166-178). A transition cannot fire on a freshly created node -
   only on a change to a live one, which is exactly a tab click, a hover, a focus. */
@media (prefers-reduced-motion:reduce){
  #apTabs .rs-tab,button.ap2-chip,.ap2-dem,.ap2-mbtn,.ap2-th,details.ap2-ref>summary,
  body.rs-app .ap2-assume .rs-num,body.rs-app .ap2-pane .rs-num{transition:none}
}
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
    const money2 = v => (v == null || isNaN(v)) ? "—" : "$" + Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const money0 = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";
    const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);
    const r1 = v => (v == null || isNaN(v)) ? "—" : (+v).toFixed(1);
    // jobs a foreman-day is the one figure on this page whose meaning is in its SECOND decimal:
    // 1.12 against 1.04 is the Delaware argument; "1.1 against 1.0" is noise.
    const r2 = v => (v == null || isNaN(v)) ? "—" : (+v).toFixed(2);
    const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
    /* THE MART STORES A BOOKING RATE ALREADY IN PERCENT (2026-09-20). pct() multiplies by 100, so the
       opportunity rank printed "2380%" and "3590%" - a number nobody could read past. */
    const bookPct = v => (v == null || v === "" || isNaN(parseFloat(v))) ? "—" : r1(parseFloat(v)) + "%";
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
      RS.load("area_whitespace").catch(() => null),
      RS.load("area_county").catch(() => null),
      RS.load("area_master_season").catch(() => null),
      ZTZ.api("/api/mart_postcard_month?limit=20000").then(j => j.rows || []).catch(() => []),
    ]).then(([rows, model, cityAll, wsAll, countyRows, cityAllSeason, pcm]) => {
      const PCM = pcm || [];
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
      const CITYYTD = cityAll || [];
      const COUNTY = (countyRows && !countyRows.__err) ? countyRows : [];
      const CITYSEASON = (cityAllSeason && !cityAllSeason.__err) ? cityAllSeason : [];
      let CITYALL = CITYYTD;
      const WSALL = wsAll || [];
      // "Leads No Jobs" is the honest name of the old Untapped flag (the city sent leads, nothing booked)
      const lnj = r => num(r["Leads No Jobs"] != null ? r["Leads No Jobs"] : r.Untapped);
      const sgnPct = v => (v >= 0 ? "+" : "") + (+v).toFixed(1) + "%";

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
      // #page=area-plan&tab=cities — read once at boot; the shell's own router stops at the & (index.html:1436)
      let bootTab = (location.hash.match(/tab=([\w-]+)/) || [])[1] || null;
      const inputs = Object.assign({
        from: seasonLast ? seasonLast[0] : "2025-09",
        to: seasonLast ? seasonLast[1] : "2025-09",
        seed: "measured",            // "measured" | "his" | "aim" | "custom"
        bases: applyOverrides(measuredSeed()),
        utilization: null, leadsPerRep: null, dollarsPerLead: null,
        tab: "decide",               // which pane is open (additive key: never bump LS_KEY for it)
        method: null,                // forecast method: growth | avg3 | flat (null = the model's)
        focus: "",                   // the state focus; "" = all
        city: { minLeads: 20, view: "all", q: "", sort: "Revenue", desc: true, page: 0, pageSize: 30 },
      }, saved);
      inputs.city = Object.assign({ minLeads: 20, view: "all", q: "", sort: "Revenue", desc: true,
                                    page: 0, pageSize: 30 }, inputs.city || {});
      /* A NAMED SEED IS RE-READ FROM THE MODEL ON EVERY LOAD (2026-09-19). The browser used to keep the
         foreman table it was first seeded with, so after the plan went Zip-to-Zip-only the live page
         still carried Delaware's five Tuji foremen from an old visit — "have 29" beside a model that
         counts 24. Only a table somebody typed into (seed "custom") is theirs to keep. */
      if (inputs.seed !== "custom")
        inputs.bases = applyOverrides(inputs.seed === "aim" ? aimSeed() : inputs.seed === "his" ? hisSeed() : measuredSeed());
      /* THE SAME FOR THE DIALS (2026-09-19). Every save() stored the seeded utilization, leads per rep and
         $ per lead, so a returning browser kept the OLD measurement forever — and what they measure just
         changed (a rep is now somebody who carried 50+ leads; the ledger is Zip to Zip only). The desk
         was being sized on a median taken over TEST TEST and Yelp Team. Only a dial somebody typed stays. */
      inputs.dialsTyped = inputs.dialsTyped || {};
      ["utilization", "leadsPerRep", "dollarsPerLead"].forEach(k => { if (!inputs.dialsTyped[k]) inputs[k] = null; });
      if ((inputs.city || {}).window === "season" && CITYSEASON.length) CITYALL = CITYSEASON;
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
          /* BOOKED OVER ALL LEADS, NOT OVER "QUALIFIED" (2026-09-19). The leads this rate sizes are then
             priced at a cost per ANY lead and handed to reps measured in ANY leads, so the rate has to be
             on the same footing — and "qualified" stopped being comparable in late 2025, when leads that
             used to be left to expire began to be archived (bad share 11% -> 34%). */
          o.conversion = o.leads ? o.booked / o.leads : null;
          Object.values(o.byCo).forEach(q => { q.conversion = q.leads ? q.booked / q.leads : null; });
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
        const natL = Object.values(P.S).reduce((a, s) => a + s.leads, 0);          // ALL leads, like the state rates
        const natB = Object.values(P.S).reduce((a, s) => a + s.booked, 0);
        P.natConv = natL ? natB / natL : 0.13;
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
          const had = (P.S[st] || {}).leads || 0;
          const note = (HIS_TABLE.find(x => x.st === st) || {}).note || "";
          const cos = companiesOf(st);
          const byCo = cos.map(c => {
            const sc = (s.byCo || {})[c] || { cur: 0, add: 0 };
            const f = num(sc.cur) + num(sc.add);
            const j = f * DAYS_PER_MONTH * months * util;
            const cv = (((P.S[st] || {}).byCo || {})[c] || {}).conversion || conv;
            return { c, cur: num(sc.cur), add: num(sc.add), foremen: f, jobs: j, conv: cv,
                     leadsNeeded: cv ? j / cv : 0,
                     had: (((P.S[st] || {}).byCo || {})[c] || {}).leads || 0,
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
          step("Foremen in this table", c.totForemen,
               "+" + (c.totForemen - c.totCur) + " on top of " + c.totCur + " · seeded from " + esc(seedWord)) +
          /* THE PERIOD LEAVES THE LABELS (2026-09-20): it is stated once, on the band above, and a
             label carrying " · May 2026 – Aug 2026" overprinted its neighbour at every width he uses. */
          step("Jobs that table could run", fmtN(c.totJobs),
               "at " + n1(c.util * 100) + "% of the " + DAYS_PER_MONTH + "/day ceiling" +
               (P.M.jobs ? " · they actually ran " + fmtN(P.M.jobs) : "")) +
          step("Leads it would need", fmtN(c.totLeads), "every lead, good or bad · at each area's own booking rate") +
          step("Salespeople", Math.ceil(c.salesNeeded || 0),
               "at " + fmtN(num(inputs.leadsPerRep)) + " leads a rep a month" +
               (P.M.repsActive ? " · " + fmtN(P.M.repsActive) + " carried a full load" : "")) +
          step("Marketing / month", money(c.marketing), "at " + money2(num(inputs.dollarsPerLead)) + " a lead") +
          step("Trucks", c.totForemen + " vs " + fmtN(owned),
               "one truck per foreman · " + fmtN(owned) + " on the vehicles register",
               c.totForemen > owned ? "warn" : "good") +
          "</div>";
      }

      function dialsHtml() {
        const trail = MKT.trailing_12m_avg_monthly_spend;
        return [["utilization", "Utilization of the ceiling, %",
            "measured " + esc(P.label) + ": " + n1(P.measuredUtil * 100) + "% (" +
            fmtN(P.M.jobs) + " jobs vs " + fmtN(P.measuredForemen) + " distinct foremen in the busiest month × " + DAYS_PER_MONTH + " days × " + P.yms.length + " months)"],
           ["leadsPerRep", "Leads one salesperson handles / month",
            "measured " + esc(P.label) + ": " + (P.M.leadsPerRep || "—") + " median" +
            (() => { const d = deadRate(P.yms); return d
              ? " · <b>on TOTAL leads</b>, as marketing buys them — " + r1(d.pct) + "% of them were dead" : ""; })()],
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
        return '<div class="rs-tablewrap"><table data-name="Foreman table" class="rs-table"><thead><tr>' +
          '<th>Base / area</th><th class="num">Foreman quantity</th>' +
          '<th class="num">Additional</th><th class="num">Planned</th>' +
          '<th class="num" title="distinct foremen on closings in the period (max month)">Worked (measured)</th>' +
          '<th class="num">Jobs done (' + esc(P.label) + ')</th>' +
          '<th class="num">Jobs @ plan</th><th class="num" title="booked ÷ every lead, good or bad">Booking rate (of all leads)</th>' +
          '<th class="num">Leads needed</th>' +
          '<th class="num">Leads (' + esc(P.label) + ')</th>' +
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
          if (C.view === "untapped" && lnj(r) !== 1) return false;
          if (C.view === "working" && lnj(r) === 1) return false;
          if (C.view === "far" && (num(r["Miles To Base"]) || 0) < 25) return false;
          if (q && !((r.City || "") + " " + (r.County || "") + " " + (r.State || "")).toLowerCase().includes(q)) return false;
          return true;
        });
      }

      function bandBHtml() {
        const rs = cityRows();
        const T = k => rs.reduce((a, r) => a + (num(r[k]) || 0), 0);
        const leads = T("Leads"), booked = T("Booked"), jobs = T("Jobs"), rev = T("Revenue");
        const untapped = rs.filter(r => lnj(r) === 1);
        const untappedLeads = untapped.reduce((a, r) => a + (num(r.Leads) || 0), 0);
        /* NOBODY WHO MAY WORK THERE (2026-09-20) — not merely nobody based there. Five of the six
           depots have no foreman living at them; what matters is whether anyone is allowed to be
           sent. Delaware reads as the hole: 0 based AND 0 permitted, against ~100 forecast jobs.
           CORRECTED LATER THE SAME DAY: the register is Zip to Zip's, and Delaware is worked by
           Tuji — 429 of its 548 jobs since 2024. The state is half-covered by a crew this page does
           not count, not uncovered. "No crew behind them" is still the right alarm for the PLAN,
           because Tuji's crews are not ours to dispatch, but it is not the right alarm for the
           business, so the tile says whose register it is. See the card "Beside the plan". */
        const noCrew = rs.filter(r => (num(r["Foremen Can Work"]) || 0) === 0);
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

        return '<div class="ap2-band"><span class="k">The evidence</span>' +
          '<h2>Which cities produce the work' + (inputs.focus ? " in " + esc(inputs.focus) : "") + "</h2>" +
          '<span class="clock">every city · <b>' + yr + ' year to date</b> · all companies · this pane does not follow the period picker on Capacity check</span></div>' +
          '<div class="ap2-say">Booked here means <b>a closing exists</b> — the same rule as the plan. Distance is <b>straight-line</b> to the nearest active base. Jobs are last-encounter closings placed by the lead\'s pickup city, so a state total in the plan will not equal the sum of its cities. ' +
          (stateLeadsYtd ? "These " + fmtN(rs.length) + " cities carry <b>" + fmtN(leads) + "</b> of the <b>" + fmtN(stateLeadsYtd) + "</b> leads " + (inputs.focus ? esc(inputs.focus) : "all states") + " produced this year; the rest are cities under the " + C.minLeads + "-lead floor (" + fmtN(belowFloor) + " leads), under 5 leads, or with no city name. " : "") +
          (CITYALL.some(r => r["Home Value"] != null) ? "Home values are Zillow's typical value per zip (as of <b>" + esc(String((CITYALL.find(r => r["Home Value As Of"]) || {})["Home Value As Of"] || "").slice(0, 7)) + "</b>), weighted by where the city's leads came from. " : "") +
          "Switch the master to <b>Marketing</b> for lead sources and marketing cost per city. Google Ads spend is <b>measured</b> and shown as 'G $…'; the other channels are estimated from what each source costs per lead. Third-party search volume is not connected — the Keyword Planner upload under Reference is the route.</div>" +
          '<div class="ap2-bar"><div class="rs-fld"><span>Focus</span><div>' + stateChips + "</div></div></div>" +

          '<div class="panel ap2-led">' +
          '<div class="ap2-led-g"><div class="l">Cities</div><div class="v">' + fmtN(rs.length) + '</div>' +
            '<div class="s"><b>' + fmtN(leads) + "</b> leads · <b>" + fmtN(booked) + "</b> booked (" + (leads ? (booked / leads * 100).toFixed(1) : "—") + "%)</div></div>" +
          '<div class="ap2-led-g"><div class="l">Revenue</div><div class="v">' + money0(rev) + '</div>' +
            '<div class="s"><b>' + fmtN(jobs) + "</b> jobs · <b>" + money0(leads ? rev / leads : 0) + "</b> per lead</div></div>" +
          '<div class="ap2-led-g"><div class="l">Leads, no jobs</div><div class="v' + (untapped.length ? " warn" : "") + '">' + fmtN(untapped.length) + '</div>' +
            '<div class="s">cities sent <b>' + fmtN(untappedLeads) + "</b> leads and produced no job</div></div>" +
          '<div class="ap2-led-g"><div class="l">No crew behind them</div><div class="v' + (noCrew.length ? " warn" : "") + '">' + fmtN(noCrew.length) + '</div>' +
            '<div class="s"><b>' + fmtN(noCrewLeads) + "</b> leads whose nearest base has nobody on <b>" +
              esc((SIS.plan_company || "Zip to Zip")) + "</b>'s register" +
              (((SIS.companies || []).length) ? " — Delaware's are worked by <b>Tuji</b>, which the plan does not dispatch" : "") +
              "</div></div>" +
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
            '<div class="rs-tablewrap"><table data-name="Where we convert badly" class="rs-table"><thead><tr><th>City</th><th class="num">Leads</th><th class="num">Books</th><th class="num">Miles</th><th class="num">Foremen</th></tr></thead><tbody>' +
            rs.filter(r => (num(r.Leads) || 0) >= 100).sort((a, b) => (num(a["Booking Rate"]) || 0) - (num(b["Booking Rate"]) || 0)).slice(0, 8).map(r =>
              '<tr><td class="strong">' + esc(r.City) + ' <span class="ap2-small">' + esc(r.State) + "</span></td>" +
              '<td class="num">' + fmtN(num(r.Leads)) + "</td>" +
              '<td class="num"><b>' + r1(num(r["Booking Rate"])) + "%</b></td>" +
              '<td class="num">' + (r["Nearest Base"] ? r1(num(r["Miles To Base"])) : "—") + "</td>" +
              '<td class="num' + ((num(r["Foremen At Base"]) || 0) === 0 ? ' ap2-warn' : "") + '">' + ((num(r["Foremen At Base"]) || 0) || "none") + "</td></tr>").join("") +
            "</tbody></table></div></div>" +

          '<div class="panel"><div class="panel-head"><div class="panel-title">Where the claims come from</div></div>' +
            '<div class="ap2-say">Claims per 100 jobs done in that city, cities with 10+ jobs. Filed-this-year claims over done-this-year jobs — <a href="#page=claims-analysis">Claims Analysis</a> is the cross-check.</div>' +
            '<div class="rs-tablewrap"><table data-name="Where the claims come from" class="rs-table"><thead><tr><th>City</th><th class="num">Jobs</th><th class="num">Claims</th><th class="num">% of jobs</th><th>Top reason</th><th class="num">Refunded</th><th class="num">Public</th></tr></thead><tbody>' +
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
            '<div id="apCityTable" data-noenh></div></div>' +
          '<div id="apWs">' + wsHtml() + "</div>";
      }

      /* THE WHITE SPACE (Giga, 2026-09-15): zips inside the territory that never sent a lead */
      function wsNever() {
        return WSALL.filter(r => (!inputs.focus || r.State === inputs.focus) && num(r["Never A Lead"]) === 1);
      }
      function wsSorted() {
        const k = C.wsSort || "Home Value";
        return wsNever().sort((a, b) => k === "Miles To Base" ? num(a[k]) - num(b[k]) : num(b[k]) - num(a[k]));
      }
      function wsHtml() {
        if (!WSALL.length) return '<div class="panel" style="margin-top:12px"><div class="panel-title">White space</div>' +
          '<div class="ap2-say">The territory table (mart_area_whitespace) has not been built yet — it arrives with the next data refresh.</div></div>';
        const inF = WSALL.filter(r => !inputs.focus || r.State === inputs.focus);
        const k = C.wsSort || "Home Value", rs = wsSorted();
        const hasAcs = WSALL.some(r => r["Movers Per Year"] != null), hasHv = WSALL.some(r => r["Home Value"] != null);
        const d = '<span class="ap2-small">—</span>';
        const btn = (key, label) => '<button class="' + (k === key ? "on" : "") + '" data-wssort="' + esc(key) + '">' + label + "</button>";
        return '<div class="panel" style="margin-top:12px"><div class="panel-head"><div class="panel-title">White space — within 35 miles of a depot, no lead in two years</div>' +
          '<div class="rs-spacer"></div><span class="rs-pill">' + fmtN(rs.length) + " of " + fmtN(inF.length) + ' zips</span>' +
          '<button class="rs-btn" id="apWsDl">Download CSV</button></div>' +
          '<div class="ap2-say">Every zip within <b>35 straight-line miles</b> of an active depot' + (inputs.focus ? " in " + esc(inputs.focus) : "") +
            " that has not sent a single lead in two years — where to start next season. " +
            (hasHv ? "Home value is Zillow's typical value for the zip. " : "") +
            (hasAcs ? "Movers per year = the Census population × the share of households that moved last year. " : "Census income and movers per year appear once a Census API key is connected. ") + "</div>" +
          '<div class="rs-seg" style="margin:0 0 10px">' + btn("Home Value", "Highest home value") + btn("Miles To Base", "Closest") +
            (hasAcs ? btn("Movers Per Year", "Most movers") : "") + "</div>" +
          '<div class="rs-tablewrap" data-nocsv><table data-name="White space" class="rs-table"><thead><tr><th>Zip</th><th>Town</th><th>County</th><th>St</th><th>Base</th>' +
            '<th class="num">Miles</th><th class="num">Home value</th><th class="num">12 months</th>' +
            (hasAcs ? '<th class="num">Income</th><th class="num">Movers / yr</th>' : "") + "</tr></thead><tbody>" +
          rs.map(r => "<tr><td>" + esc(r.Zip) + '</td><td class="strong">' + esc(r.City || "—") + '</td><td class="muted">' + esc(r.County || "—") + "</td>" +
            "<td>" + esc(r.State) + "</td><td>" + esc(r["Nearest Base"] || "—") + '</td><td class="num">' + r1(num(r["Miles To Base"])) + "</td>" +
            '<td class="num">' + (r["Home Value"] != null ? money0(num(r["Home Value"])) : d) + "</td>" +
            '<td class="num">' + (r["Home Value Change Pct"] != null ? sgnPct(num(r["Home Value Change Pct"])) : d) + "</td>" +
            (hasAcs ? '<td class="num">' + (r["Median Income"] != null ? money0(num(r["Median Income"])) : d) + '</td><td class="num">' + (r["Movers Per Year"] != null ? fmtN(num(r["Movers Per Year"])) : d) + "</td>" : "") +
            "</tr>").join("") + "</tbody></table></div>" +
          (rs.length > 40 ? '<div class="ap2-note" style="margin-top:6px">The top 40 are shown — the CSV has all ' + fmtN(rs.length) + ".</div>" : "") + "</div>";
      }
      // the panel's own CSV carries every column of the territory table, not the rendered ones
      function wsCsv() {
        const cols = RS.DATASETS.area_whitespace.cols.slice();
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [cols.map(cell).join(",")].concat(wsSorted().map(r => cols.map(c => cell(r[c])).join(",")));
        const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "Seasonal Planning - white space" + (inputs.focus ? " - " + inputs.focus : "") + ".csv"; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      function wireWs() {
        host.querySelectorAll("#apWs [data-wssort]").forEach(el => el.onclick = () => {
          C.wsSort = el.dataset.wssort; save(); const w = host.querySelector("#apWs"); if (w) { w.innerHTML = wsHtml(); wireWs(); } });
        const dl = host.querySelector("#apWsDl"); if (dl) dl.onclick = wsCsv;
        enhanceTables();
      }

      /* THE MARKETING VIEW of the same rows: where the leads come from, what they cost (estimated), the outside signals */
      function mktTableHtml(pageRows, th, pages) {
        const d = '<span class="ap2-small">—</span>';
        return '<div class="rs-tablewrap"><table data-name="Cities we convert badly" class="rs-table"><thead><tr>' +
          th("City", "City") + th("St", "State") + th("Leads", "Leads", "num") + th("Book %", "Booking Rate", "num") +
          th("Revenue", "Revenue", "num") + th("$/lead", "Revenue Per Lead", "num") + th("Lead sources", "Lead Source Mix") +
          th("Ad cost", "Est Ad Cost", "num") + th("Revenue / ad $", "Est Revenue Per Ad Dollar", "num") +
          th("Home value", "Home Value", "num") + th("12 months", "Home Value Change Pct", "num") +
          th("Income", "Median Income", "num") + th("Moved last yr", "Mover Rate", "num") + th("Wealth", "Wealth Tier") +
          "</tr></thead><tbody>" + pageRows.map(r => "<tr>" +
            '<td class="strong">' + esc(r.City) + (lnj(r) === 1 ? ' <span class="rs-pill warn">no jobs</span>' : "") + "</td><td>" + esc(r.State) + "</td>" +
            '<td class="num">' + fmtN(num(r.Leads)) + '</td><td class="num">' + r1(num(r["Booking Rate"])) + "%</td>" +
            '<td class="num">' + money0(num(r.Revenue)) + '</td><td class="num">' + money0(num(r["Revenue Per Lead"])) + "</td>" +
            '<td class="muted" style="white-space:nowrap">' + esc(r["Lead Source Mix"] || "—") + "</td>" +
            '<td class="num">' + (adCost(r) ? money0(adCost(r)) + adBadge(r) : d) + "</td>" +
            '<td class="num">' + (adPerDollar(r) != null ? "$" + adPerDollar(r).toFixed(1) : d) + "</td>" +
            '<td class="num">' + (r["Home Value"] != null ? money0(num(r["Home Value"])) : d) + "</td>" +
            '<td class="num">' + (r["Home Value Change Pct"] != null ? sgnPct(num(r["Home Value Change Pct"])) : d) + "</td>" +
            '<td class="num">' + (r["Median Income"] != null ? money0(num(r["Median Income"])) : d) + "</td>" +
            '<td class="num">' + (r["Mover Rate"] != null ? (num(r["Mover Rate"]) * 100).toFixed(1) + "%" : d) + "</td>" +
            "<td>" + esc(r["Wealth Tier"] || "—") + "</td></tr>").join("") +
          "</tbody></table></div>" +
          '<div class="ap2-note" style="margin-top:6px">Estimated ad cost = the city\'s leads by source × that source\'s company-wide cost per lead over the last 12 months (card spend ÷ leads). No spend we hold has geography, so this is an estimate, not measured spend. Revenue per lead is a yield, not a return. Wealth tier = the city\'s home-value fifth among these cities.</div>' +
          '<div class="ap2-pager"><span>page ' + (C.page + 1) + " of " + pages + "</span>" +
          '<button class="rs-btn" data-pg="prev"' + (C.page <= 0 ? " disabled" : "") + '>‹ Prev</button>' +
          '<button class="rs-btn" data-pg="next"' + (C.page >= pages - 1 ? " disabled" : "") + '>Next ›</button></div>';
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
        if (C.mode === "marketing") return mktTableHtml(pageRows, th, pages);
        return '<div class="rs-tablewrap"><table data-name="City master" class="rs-table"><thead><tr>' +
          th("City", "City") + th("St", "State") + th("County", "County") +
          th("Leads", "Leads", "num") + th("90d", "Leads 90d", "num") + th("Booked", "Booked", "num") + th("Book %", "Booking Rate", "num") +
          th("Jobs", "Jobs", "num") + th("Revenue", "Revenue", "num") + th("$/lead", "Revenue Per Lead", "num") +
          th("Ticket", "Avg Ticket", "num") + th("Quote", "Avg Quote", "num") + th("CF", "Avg CF", "num") +
          th("Base", "Nearest Base") + th("Miles", "Miles To Base", "num") + th('Foremen<small> based / can work</small>', "Foremen At Base", "num") +
          th("Claims", "Claims", "num") + th("% of jobs", "Claims Per 100 Jobs", "num") +
          "</tr></thead><tbody>" + pageRows.map(r => '<tr>' +
            '<td class="strong">' + esc(r.City) + (lnj(r) === 1 ? ' <span class="rs-pill warn">no jobs</span>' : "") + "</td>" +
            "<td>" + esc(r.State) + '</td><td class="muted">' + esc(r.County || "—") + "</td>" +
            '<td class="num">' + fmtN(num(r.Leads)) + '</td><td class="num">' + fmtN(num(r["Leads 90d"])) + "</td>" +
            '<td class="num">' + fmtN(num(r.Booked)) + '</td><td class="num">' + r1(num(r["Booking Rate"])) + "%</td>" +
            '<td class="num">' + fmtN(num(r.Jobs)) + '</td><td class="num">' + money0(num(r.Revenue)) + "</td>" +
            '<td class="num">' + money0(num(r["Revenue Per Lead"])) + '</td><td class="num">' + money0(num(r["Avg Ticket"])) + "</td>" +
            '<td class="num">' + (r["Avg Quote"] ? money0(num(r["Avg Quote"])) : '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + (r["Avg CF"] ? fmtN(num(r["Avg CF"])) : '<span class="ap2-small">—</span>') + "</td>" +
            "<td>" + esc(r["Nearest Base"] || "—") + "</td>" +
            '<td class="num">' + (r["Nearest Base"] ? r1(num(r["Miles To Base"])) : '<span class="ap2-small">—</span>') + "</td>" +
            '<td class="num">' + ((num(r["Foremen At Base"]) || 0) || '<span class="ap2-small">0</span>') + ' <span class="ap2-small">/ ' + (num(r["Foremen Can Work"]) || 0) + "</span>" +
              (r["Foremen From"] && r["Foremen From"] !== r["Nearest Base"] ? ' <span class="ap2-small">· ' + esc(r["Foremen From"]) + "</span>" : "") + "</td>" +
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
        bar.appendChild(fld("View", seg([["planning", "Planning"], ["marketing", "Marketing"]], C.mode || "planning", v => { C.mode = v; })));
        if (CITYSEASON.length) bar.appendChild(fld("Window", seg([["ytd", "Year to date"], ["season", "Season (May–Aug)"]], C.window || "ytd", v => { C.window = v; CITYALL = v === "season" ? CITYSEASON : CITYYTD; })));
        bar.appendChild(fld("Show", seg([["all", "All"], ["working", "We work there"], ["untapped", "Leads, no jobs"], ["far", "25+ miles out"]], C.view, v => { C.view = v; })));
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
        return '<div class="rs-tablewrap"><table data-name="Trucks - rent vs buy" class="rs-table" style="max-width:560px"><thead><tr><th>Year</th><th class="num">Rental</th><th class="num">Financing</th><th class="num">Repair</th></tr></thead><tbody>' +
          Object.entries(tc).map(([y, b]) => '<tr><td class="strong">' + y + (y === String(new Date().getFullYear()) ? " (to date)" : "") + '</td><td class="num">' + money(b.rental) + '</td><td class="num">' + money(b.financing) + '</td><td class="num">' + money(b.repair) + "</td></tr>").join("") +
          "</tbody></table></div>" +
          '<div class="ap2-note" style="margin-top:10px">Owned fleet <b>' + fmtN((model.fleet || {}).owned_trucks) + "</b> · insurance <b>" + money((model.fleet || {}).insurance_yearly_total) + "/yr</b> · parking <b>" + money((model.fleet || {}).parking_monthly_total) + "/mo</b> — the whole vehicles register; the paid-for fleet and per-day economics live on Truck Economics.</div>" +
          (t ? '<div class="ap2-callout"><b>The +2 answer, priced from live market research:</b> a used 26-ft box truck runs <b>' + money(t.used_low) + "–" + money(t.used_high) + "</b> (typical " + money(t.used_typical) + "; fleet sell-offs ~" + money(t.selloff_typical) + "). All-in, one more owned truck ≈ <b>$" + t.owned_truck_year_allin + "/yr</b>. Against a ~$140k/yr rental run-rate, <b>two owned trucks displace renting at better than 2:1</b>.<br><b>Spec:</b> " + esc(t.gvwr_note) + "<br><b>Live candidate:</b> " + esc(t.local_candidate) + ".</div>" : "");
      }
      function seasonHtml() {
        const v = SEASON.votes || {}; const yrs = SEASON.years || {};
        const ynames = Object.keys(yrs).sort();
        return '<div class="ap2-say">The season is the set of months whose jobs reach <b>' + Math.round((SEASON.share || 0.65) * 100) + '%</b> of that year\'s peak month in at least <b>' + (SEASON.min_years || 2) + '</b> of the years that have data for the month. Today that is <b>' + (SEASON.months || []).map(m => MONTH_NAMES[m]).join(", ") + '</b>. The threshold is a Planning Variable.</div>' +
          '<div class="rs-tablewrap"><table data-name="How the season was decided" class="rs-table" style="max-width:720px"><thead><tr><th>Month</th>' + ynames.map(y => '<th class="num">' + y + " (of peak)</th>").join("") + '<th class="num">Votes</th><th>Season</th></tr></thead><tbody>' +
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

      /* ===================== FIVE PANES, ONE CLOCK EACH =====================
         Until 2026-09-20 this page was a single 14,000-px scroll carrying five different jobs — the
         answer for next season, its working, the city evidence, a what-if on a PAST period, and the
         reference. They alternated time bases down the page (2027 → year to date → a past period →
         2027 again), both the plan and the what-if were titled "the plan", and the what-if's numbers
         were the loudest on the first screen: the author of this file misread them himself. Each job
         is now a pane with its period stated in its first line. Panes are rendered ONCE inside the
         same innerHTML string and switched by toggling `hidden`, so every id keeps its place and
         repaintPlan / repaintCity / repaintRank / enhanceTables / the delegated input handler all
         work untouched — a lazily-rendered pane would have meant teaching each of them to cope with
         a missing target. */
      const PANES = [
        { k: "decide", label: "Decisions" },
        { k: "plan", label: null },              // named at render time: FC is declared below this block
        { k: "map", label: "Map" },
        { k: "cities", label: "Cities" },
        { k: "capacity", label: "Capacity check" },
        { k: "ref", label: "Reference" },
      ];
      const paneOf = key => PANES.some(x => x.k === key) ? key : "decide";
      /* THE ASSUMPTIONS SIT ABOVE THE PANES (2026-09-20), because two of the three move the 2027
         answer — utilization sets how many jobs a foreman does in a month, and leads-per-salesperson
         sizes the desk. They used to live inside the hero of the past-period what-if, three thousand
         pixels below the cards they govern, so the decision cards pointed at "the dial in Band A".
         Never inside a pane, and never re-rendered by repaintPlan(): the cursor must survive typing. */
      function assumeHtml() {
        return '<div class="ap2-assume" id="apAssume">' +
          /* SAY WHICH NUMBER EACH ONE MOVES, and no more: the crew for next season is calibrated on
             the foremen who actually ran each pool (nextCalc, `worked * load / refLoad`), so
             utilization does NOT move it — it sizes the Capacity check. Only the middle dial reaches
             the plan above. */
          '<div class="h"><b>The assumptions this plan runs on</b><br><b>Leads per salesperson</b> sizes the ' +
          esc(String(FC.year || "")) + " sales desk. <b>Utilization</b> and <b>marketing $ per lead</b> size the <b>Capacity check</b> only: next season's crew is calibrated on the foremen who actually ran each depot, and its budget on what a lead really cost last season. <a href=\"#page=season-settings\">Planning Variables</a> makes a value permanent.</div>" +
          '<div class="ap2-dials" id="apDials">' + dialsHtml() + "</div></div>";
      }
      /* ONE WAY TO SAY "GO THERE" (2026-09-20). Twelve phrases pointed at places by position —
         "the dial in Band A", "the card below", "see the full plan above" — which stopped being true
         the moment anything moved. Every one is now a named jump to an id. */
      const go = (id, t) => '<button type="button" class="ap2-goto" data-goto="' + id + '">' + t + " ↓</button>";
      const note = t => '<div class="ap2-note" style="margin:6px 0 8px">' + t + "</div>";
      const goLink = (id, t) => '<button type="button" class="ap2-golink" data-goto="' + id + '">' + t + "</button>";
      const MON_SHORT = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      // "2027-05-18" -> "18 May 2027": a date a dispatcher reads, not an ISO stamp
      function dayLabel(iso) {
        const m = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? (+m[3]) + " " + MON_SHORT[+m[2]] + " " + m[1] : String(iso || "");
      }
      function tabsHtml() {
        return '<div class="ap2-tabs"><div id="apTabs" role="tablist" aria-label="Seasonal Planning sections" style="display:flex;gap:6px;flex-wrap:wrap">' +
          PANES.map(x => { const on = paneOf(inputs.tab) === x.k;
            const label = x.label || ("The " + (FC.year || "next season") + " plan");
            return '<button type="button" class="rs-tab' + (on ? " on" : "") + '" id="apTab-' + x.k + '" role="tab" data-k="' + x.k +
              '" aria-selected="' + (on ? "true" : "false") + '" aria-controls="apPane-' + x.k + '" tabindex="' + (on ? "0" : "-1") + '">' +
              esc(label) + "</button>"; }).join("") +
          "</div><span class=\"sp\"></span>" +
          '<button type="button" class="rs-btn" id="apPdf">Download PDF</button></div>';
      }
      /* `quiet` is passed by a data-goto jump, which does its own scrolling */
      function showPane(key, quiet) {
        key = paneOf(key);
        host.querySelectorAll(".ap2-pane").forEach(pn => { pn.hidden = pn.dataset.apPane !== key; });
        host.querySelectorAll("#apTabs .rs-tab").forEach(b => { const on = b.dataset.k === key;
          b.classList.toggle("on", on); b.setAttribute("aria-selected", on ? "true" : "false"); b.tabIndex = on ? 0 : -1; });
        inputs.tab = key; save();
        try { history.replaceState(null, "", "#page=area-plan&tab=" + key); } catch (e) {}
        if (!quiet) { const sc = host.closest(".rs-content"); if (sc) sc.scrollTop = 0; }
        /* LEAFLET SIZES ITSELF FROM THE CONTAINER, and a container in a hidden pane is 0x0 —
           the map draws one grey tile, AND fitBounds clamps to maxZoom, until it is told to
           measure again. Both have to be redone, not just the first. */
        if (key === "map") setTimeout(fitMap, 40);
      }
      /* THE PLAN ON PAPER (2026-09-20). He presents this; a deck needs the decisions and the working,
         not the city evidence or a what-if. printView clones again and never touches the live DOM, so
         the snapshot can be opened up and trimmed freely. */
      function wirePdf() {
        const b = host.querySelector("#apPdf"); if (!b) return;
        b.onclick = () => {
          const snap = host.cloneNode(true);
          snap.querySelectorAll(".ap2-pane").forEach(n => n.removeAttribute("hidden"));
          snap.querySelectorAll('[data-ap-pane="cities"],[data-ap-pane="capacity"],[data-ap-pane="ref"],#apTabs,#apAssume').forEach(n => n.remove());
          RSC.printView({ host: snap, pageCss: "ap-style",
            title: "Seasonal Planning — Season " + (FC.year || ""),
            subtitle: fmtN((nextCalc().tot || {}).jobs || 0) + " jobs forecast · " + (SEASON.next && SEASON.next[0] ? ymLabel(SEASON.next[0]) + " – " + ymLabel(SEASON.next[1]) : ""),
            drop: [".ap2-tt", ".ap2-pager", ".ap2-goto", ".ap2-golink", ".ap2-mpick"] });
        };
      }
      function wireTabs() {
        const bar = host.querySelector("#apTabs"); if (!bar) return;
        const keys = PANES.map(x => x.k);
        bar.querySelectorAll(".rs-tab").forEach(b => { b.onclick = () => showPane(b.dataset.k); });
        bar.onkeydown = ev => {
          if (!ev.target.classList || !ev.target.classList.contains("rs-tab")) return;   // the PDF button keeps its own keys
          const i = keys.indexOf(paneOf(inputs.tab)); let n = -1;
          if (ev.key === "ArrowRight") n = (i + 1) % keys.length;
          else if (ev.key === "ArrowLeft") n = (i - 1 + keys.length) % keys.length;
          else if (ev.key === "Home") n = 0;
          else if (ev.key === "End") n = keys.length - 1;
          if (n < 0) return;
          ev.preventDefault(); showPane(keys[n]);
          const btn = bar.querySelector('.rs-tab[data-k="' + keys[n] + '"]'); if (btn) btn.focus();
        };
      }

      /* ================= paint + wiring ================= */
      function stamps() {
        const built = model.built_at || "";
        return '<div class="ap2-stamps"><span>plan mart: ' + esc(rows[0] && rows[0].built_at ? String(rows[0].built_at).slice(0, 16) : "—") +
          "</span><span>model: " + esc(built ? String(built).slice(0, 16) : "same run") +
          "</span><span>city master: nightly</span><span>research: " + esc((R.vintage || "").slice(0, 22)) + "</span></div>";
      }


      /* ------- NEXT SEASON (his 2026-09-16 decisions): jobs by move month from last season x growth,
         foremen for the 90th-percentile day, hire-by two weeks ahead, a crew of foreman + driver +
         helper, one truck per foreman, leads needed a month earlier. Zip to Zip only. ------------ */
      const FC = model.forecast || {};
      const FCS = FC.states || {};
      // which depot's crews serve a state (his state->depot map 2026-09-15; MD and VA ride PA/DE)
      const POOL_OF = { NJ: "NJ", NY: "NJ", PA: "PA", DE: "PA", MD: "PA", VA: "PA", CT: "CT", MA: "CT" };
      const POOL_ORDER = ["NJ", "PA", "CT"];
      function nextCalc() {
        const util = (num(inputs.utilization) / 100) || 0.34;
        const perFm = Math.max(1, DAYS_PER_MONTH * util);              // jobs one foreman does in a month
        const crew = FC.crew_per_foreman || { helpers: 1, drivers: 1, trucks: 1 };
        const months = (FC.months || []).map(m => FC.year + "-" + String(m).padStart(2, "0"));
        const core = months.filter(ym => !((FCS[Object.keys(FCS)[0]] || { months: {} }).months[ym] || {}).shoulder);
        // the service areas, plus any other state with a real season (a one-off long-distance job is not a market)
        const sts = seedStates.filter(st => FCS[st]).concat(Object.keys(FCS).filter(st => !seedStates.includes(st) && (FCS[st].season_jobs_last || 0) >= 10).sort());
        const method = (FC.methods || []).includes(inputs.method) ? inputs.method : (FC.method || "growth");
        const rows = sts.map(st => {
          const s = FCS[st], have = num((inputs.bases[st] || {}).cur) + num((inputs.bases[st] || {}).add);
          const cells = months.map(ym => { const r0 = s.months[ym] || {}; const jobs = (r0.methods && r0.methods[method] != null) ? r0.methods[method] : (r0.jobs || 0);
            const conv = s.conversion; const need = jobs ? Math.ceil(jobs * (r0.headroom || 1) / perFm) : 0;
            return Object.assign({}, r0, { ym, need, jobs, leads_needed: conv ? Math.round(jobs / conv) : null }); });
          const coreCells = cells.filter(c => !c.shoulder);
          const peak = Math.max(0, ...coreCells.map(c => c.need));
          const first = coreCells.find(c => c.need > have);
          const jobs = coreCells.reduce((a, c) => a + (c.jobs || 0), 0);
          const leads = coreCells.reduce((a, c) => a + (c.leads_needed || 0), 0);
          const revenue = s.avg_bill != null ? jobs * s.avg_bill : null, expense = s.avg_expense != null ? jobs * s.avg_expense : null;
          return { st, s, have, cells, peak, hire: Math.max(0, peak - have), hireBy: first ? first.hire_by : null, jobs, leads, revenue, expense,
                   helpers: Math.ceil(peak * (crew.helpers || 0)), drivers: Math.ceil(peak * (crew.drivers || 0)), trucks: Math.ceil(peak * (crew.trucks || 0)) };
        });
        /* LEADS AND MARKETING DOLLARS ON ONE BASIS, TIED TO THE LEDGER (2026-09-19).
           The first version took "leads needed" = jobs / (booked / QUALIFIED leads) and priced them at
           the Area Master's cost per ANY lead — a third of 2026's leads were marked bad, so it planned
           +12% jobs on 22% less advertising ($279k against $359k actually spent in the same four
           months), and nothing in four seasons of history supports that: advertising per season job
           was $199 / $183 / $186 / $200. His words: "i dont want us to plan on the lower budget".
           Now everything is ALL leads:
             leads needed  = forecast jobs x (all leads that arrived last season / the jobs they fed),
                             per state where the state ran 40+ jobs, the company ratio otherwise;
             $ per lead    = ALL advertising on the ledger in those lead months (Zip to Zip, post cards
                             included) / the leads our states sent in them — so leads x $ adds back to
                             the money that actually left the bank, scaled by the growth in jobs;
             state $/lead  = the Area Master's attributed figure (source mix) RESCALED by one factor so
                             the states add up to that ledger total. No ad spend carries geography, so
                             the split between states stays an attribution; the total is not.
           Post cards are INSIDE the advertising ledger, so they are inside this number: the separate
           post-card line is shown as "of which", never added on top again. */
        const lagM0 = FC.lead_lag_months || 1;
        const shiftYm = (ym, n) => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 + n, 1);
          return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
        const lastLeadYm = ym => shiftYm(ym, -12 - lagM0);              // the month last season's leads for this move month arrived
        const coreLeadYms = core.map(lastLeadYm);
        const stLeadsLast = st => coreLeadYms.reduce((a, m) => a + (((MS[m] || {})[st] || {}).leads || 0), 0);
        const coreJobsLast = r => r.cells.filter(c => !c.shoulder).reduce((a, c) => a + (c.last || 0), 0);
        const leadsLastAll = rows.reduce((a, r) => a + stLeadsLast(r.st), 0), jobsLastAll = rows.reduce((a, r) => a + coreJobsLast(r), 0);
        const lpjAll = jobsLastAll ? leadsLastAll / jobsLastAll : null;
        rows.forEach(r => { const jl = coreJobsLast(r), ll = stLeadsLast(r.st);
          r.lpjOwn = jl >= 40 && ll > 0; r.leadsPerJob = r.lpjOwn ? ll / jl : lpjAll; r.leadsLast = ll; r.jobsLast = jl;
          r.cells.forEach(c => { if (r.leadsPerJob != null) c.leads_needed = c.jobs ? Math.round(c.jobs * r.leadsPerJob) : 0; });
          r.leads = r.cells.filter(c => !c.shoulder).reduce((a, c) => a + (c.leads_needed || 0), 0); });
        const spendLast = coreLeadYms.reduce((a, m) => a + ((MKT[m] || {}).ad_spend || 0), 0);
        const CPLA = stateCpl(CITYYTD);              // pinned: Band B's Window toggle is a display choice, never a plan input
        const attrOf = st => CPLA[st] != null ? CPLA[st] : CPLA._all;
        const blendAttr = leadsLastAll ? rows.reduce((a, r) => a + r.leadsLast * (attrOf(r.st) || 0), 0) / leadsLastAll : null;
        const ledgerFull = coreLeadYms.length > 0 && coreLeadYms.every(m => ((MKT[m] || {}).ad_spend || 0) > 0);
        const cplActual = (ledgerFull && leadsLastAll > 0) ? spendLast / leadsLastAll : null;   // a missing month must not shrink the budget
        const kCal = (cplActual != null && blendAttr) ? cplActual / blendAttr : 1;
        const mkt = { cplActual, spendLast, leadsLast: leadsLastAll, jobsLast: jobsLastAll, lpjAll, k: kCal, blendAttr, coreLeadYms,
                      measured: cplActual != null, cplOf: st => { const a = attrOf(st); return a != null ? a * kCal : cplActual; } };
        /* NEVER BELOW WHAT A JOB HAS COST (2026-09-19). Built state by state, the forecast's state mix
           alone made 2027 cheaper per job than 2026 ($194 against $200): the states forecast to grow
           fastest happen to be the ones whose ATTRIBUTED leads-per-job and cost-per-lead are lowest.
           That saving stands on an attribution — no ad dollar carries a state — while $200 a job is
           the ledger. His words: "we get even more jobs with this, what makes you believe in this".
           So the plan is held at last season's measured advertising per job: when the state build
           comes in under it, every state's leads are lifted by one factor until the season costs
           forecast jobs x last season's $ per job. It only ever lifts; both figures are kept. */
        const planJobsCore = rows.reduce((a, r) => a + r.jobs, 0);
        const builtMkt = rows.reduce((a, r) => a + r.leads * (mkt.cplOf(r.st) || 0), 0);
        /* over the jobs THE PLANNED STATES ran, not every closing: the forecast covers only them, so
           dividing by the national count (a handful of one-off jobs elsewhere) would hold the plan a
           shade UNDER last season's spend scaled by its own growth — the direction he objected to. */
        const perJobLast = (cplActual != null && jobsLastAll > 0) ? spendLast / jobsLastAll : null;
        const floorF = (perJobLast != null && builtMkt > 0) ? Math.max(1, planJobsCore * perJobLast / builtMkt) : 1;
        if (floorF > 1) rows.forEach(r => { r.leadsPerJobBuilt = r.leadsPerJob; if (r.leadsPerJob != null) r.leadsPerJob *= floorF;
          r.cells.forEach(c => { if (c.leads_needed) c.leads_needed = Math.round(c.leads_needed * floorF); });
          r.leads = r.cells.filter(c => !c.shoulder).reduce((a, c) => a + (c.leads_needed || 0), 0); });
        Object.assign(mkt, { perJobLast, builtMkt, floorF, held: floorF > 1.0005 });
        /* THE CREW IS PLANNED PER DEPOT POOL, CALIBRATED ON WHAT WORKED (2026-09-19).
           The first version sized each state alone — jobs x busy-day factor / (30 days x utilization),
           rounded up — and asked for 48 foremen for a season forecast at +12% over the 1,795 jobs that
           about 20 regular foremen had just run. Three errors stacked: state peaks were summed though they fall in different months
           and the same crews cover neighbours; the busy-day cushion swung wildly on small states; and
           the utilization measured over WHOLE months (busy days included) was applied again on top of
           the busy-day factor, counting the same peakiness twice.
           Now: states pool on the depot that serves them (his map: NY with NJ, DE with PA, MA with CT;
           MD and VA ride the PA/DE depots), and a pool's need is what it ran last season scaled by its
           busy-day load:   need(month) = worked x load_next(month) / peak load last season,
           load = jobs x busy-day factor summed over the pool. Same jobs, same crews; +28% in NJ, about
           +28% more NJ foremen. `worked` is the measured once-only home count, not the typed cell. */
        const pools = POOL_ORDER.map(pk => {
          const prs = rows.filter(r => (POOL_OF[r.st] || r.st) === pk);
          if (!prs.length) return null;
          const worked = prs.reduce((a, r) => a + num((SEED[r.st] || {})._all), 0);
          const have = prs.reduce((a, r) => a + r.have, 0);
          const loadAt = (ym, k) => prs.reduce((a, r) => { const c = r.cells.find(x => x.ym === ym) || {}; return a + (num(c[k]) || 0) * (c.headroom || 1); }, 0);
          const refLoad = Math.max(0, ...core.map(ym => loadAt(ym, "last")));
          const cells = months.map(ym => { const jobs = prs.reduce((a, r) => a + ((r.cells.find(x => x.ym === ym) || {}).jobs || 0), 0);
            const load = loadAt(ym, "jobs");
            const need = !jobs ? 0 : (worked > 0 && refLoad > 0) ? Math.ceil(worked * load / refLoad - 1e-9) : Math.ceil(load / perFm);
            const any = prs.map(r => r.cells.find(x => x.ym === ym)).find(Boolean) || {};
            return { ym, jobs, need, shoulder: !core.includes(ym), hire_by: any.hire_by }; });
          const coreCells = cells.filter(c => !c.shoulder);
          const peak = Math.max(0, ...coreCells.map(c => c.need));
          const first = coreCells.find(c => c.need > have);
          return { pk, label: prs.map(r => r.st).join(" + "), states: prs.map(r => r.st), worked, have, cells, peak, calibrated: worked > 0 && refLoad > 0,
                   hire: Math.max(0, peak - have), hireBy: first ? first.hire_by : null,
                   helpers: Math.ceil(peak * (crew.helpers || 0)), drivers: Math.ceil(peak * (crew.drivers || 0)), trucks: Math.ceil(peak * (crew.trucks || 0)) };
        }).filter(Boolean);
        // trucks beyond the owned fleet are rented for the core months; the rent is shared by each state's trucks
        const T = FC.trucks || {};
        const owned = T.owned_working != null ? T.owned_working : ((model.fleet || {}).owned_trucks || 0);
        const perDay = T.rental_per_day || 0;
        /* THE POOL'S FOREMEN, PLACED BY STATE (his ask 2026-09-19: "the full plan by states — where, how
           many crews"). A pool's need for a month is shared between its states in proportion to their
           busy-day load, by largest remainder, so the states always add back up to the pool — never a
           rounded-up foreman per state (that is how MA, MD and VA each got a whole crew for five jobs).
           A state's headline number is its share in the POOL'S peak month, so the column sums to the
           pool's peak. MD and VA have no depot: their share is work done FROM the PA/DE depots. */
        const share = (need, loads) => { const tot = loads.reduce((a, x) => a + x, 0); if (!need || !tot) return loads.map(() => 0);
          const q = loads.map(x => need * x / tot), out = q.map(Math.floor); let left = need - out.reduce((a, x) => a + x, 0);
          q.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (left > 0 && loads[i] > 0) { out[i]++; left--; } });
          return out; };
        pools.forEach(q => { const prs = rows.filter(r => q.states.includes(r.st));
          q.cells.forEach(pc => { const loads = prs.map(r => { const c = r.cells.find(x => x.ym === pc.ym) || {}; return (c.jobs || 0) * (c.headroom || 1); });
            share(pc.need, loads).forEach((n, i) => { const c = prs[i].cells.find(x => x.ym === pc.ym); if (c) c.fm = n; }); });
          const peakCell = q.cells.filter(c => !c.shoulder).sort((a, b) => b.need - a.need)[0];
          q.peakYm = peakCell ? peakCell.ym : null;
          prs.forEach(r => { const c = r.cells.find(x => x.ym === q.peakYm) || {}; r.fmPeak = c.fm || 0; r.pool = q.label; r.poolKey = q.pk;
            r.fmHelpers = Math.ceil(r.fmPeak * (crew.helpers || 0)); r.fmDrivers = Math.ceil(r.fmPeak * (crew.drivers || 0)); r.fmTrucks = Math.ceil(r.fmPeak * (crew.trucks || 0)); }); });
        const trucksTot = pools.reduce((a, q) => a + q.trucks, 0);
        const rentTrucks = Math.max(0, trucksTot - owned);
        const coreDays = core.reduce((a, ym) => a + new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate(), 0);
        /* THREE PRICES FOR THE SAME TRUCKS, AND THE PLAN TAKES THE DEAREST (his call 2026-09-20:
           "whichever is the most expensive from this calculations - use that"). They disagree by a
           factor of two and a half, so the page prices all three and shows the two it did not pick:
             every-day    every rented truck held for every season day (what the plan always did)
             measured     last season's actual rental truck-days, scaled by the growth in jobs. It is
                          what the bank was actually charged: $125,400 over 813 truck-days
             monthly      season-long rentals at the depot's monthly rate, about $3,050 a truck
           Budgeting on the highest means the season can never be short of truck money. */
        const jobsPlanAll = rows.reduce((a, r) => a + r.jobs, 0);
        const grow = (jobsLastAll > 0) ? jobsPlanAll / jobsLastAll : 1;   // jobsLastAll: the marketing basis above
        const rentWays = [
          { k: "everyday", label: "every rented truck, every season day",
            usd: rentTrucks * coreDays * perDay,
            how: fmtN(rentTrucks) + " trucks × " + coreDays + " days × " + money0(perDay) },
          { k: "measured", label: "last season's rental days, scaled by the jobs",
            usd: (T.rental_usd_last_season || 0) * grow,
            how: money0(T.rental_usd_last_season || 0) + " over " + fmtN(T.rental_days_last_season || 0) + " truck-days, × " + r1(grow) },
          { k: "monthly", label: "season-long rentals at the monthly rate",
            usd: rentTrucks * (coreDays / 30.44) * (T.enterprise_per_truck_month || 3050),
            how: fmtN(rentTrucks) + " trucks × " + r1(coreDays / 30.44) + " months × " + money0(T.enterprise_per_truck_month || 3050) },
        ].filter(x => x.usd > 0);
        rentWays.sort((a, b) => b.usd - a.usd);
        const rentPick = rentWays[0] || { k: "everyday", usd: 0, label: "", how: "" };
        const rentTotal = rentPick.usd;
        const jobsAll = rows.reduce((a, r) => a + r.jobs, 0);      // rent follows the work, state by state
        /* SALES PAY IS A COST THE SEASON CARRIES (his call 2026-09-20: "add it - yet explain that it
           includes sales commissions and bonuses only"). Measured all-in against revenue last season;
           it is commission and bonus, NOT base salary, payroll tax or the manager. */
        const SALES_PCT = FC.sales_pay_pct || 0.075;
        rows.forEach(r => { r.rent = jobsAll ? rentTotal * r.jobs / jobsAll : 0;
          r.salesPay = r.revenue != null ? r.revenue * SALES_PCT : null;
          r.gross = (r.revenue != null && r.expense != null) ? r.revenue - r.expense - r.rent - (r.salesPay || 0) : null; });
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const psum = k => pools.reduce((a, q) => a + (q[k] || 0), 0);
        /* SALESPEOPLE, NEXT SEASON (2026-09-19). Leads arrive `lead_lag_months` before the move, so a
           month's desk load is the leads needed for the jobs that many months LATER. Reps = that load /
           the leads-per-rep dial. Sales is one desk, not a state thing, so this is company-wide. */
        const lagM = FC.lead_lag_months || 1, lpr = Math.max(1, num(inputs.leadsPerRep) || 140);
        const leadsFor = ym => rows.reduce((a, r) => a + (((r.cells.find(c => c.ym === ym) || {}).leads_needed) || 0), 0);
        const desk = months.map(ym => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 - lagM, 1);
          const leads = leadsFor(ym); return { forYm: ym, shoulder: !core.includes(ym), when: MONTH_NAMES[d.getMonth() + 1] + " " + d.getFullYear(), leads, reps: Math.ceil(leads / lpr - 1e-9) }; });
        const sales = { desk, lpr, peak: Math.max(0, ...desk.filter(x => !x.shoulder).map(x => x.reps)),
                        peakWhen: (desk.filter(x => !x.shoulder).sort((a, b) => b.leads - a.leads)[0] || {}).when || "", active: P.M.repsActive || null };
        const tot = { jobs: sum("jobs"), peak: psum("peak"), have: psum("have"), hire: psum("hire"), trucks: trucksTot, leads: sum("leads"),
                      helpers: psum("helpers"), drivers: psum("drivers"), revenue: rows.some(r => r.revenue != null) ? sum("revenue") : null,
                      expense: rows.some(r => r.expense != null) ? sum("expense") : null, rent: rentTotal,
                      salesPay: rows.some(r => r.salesPay != null) ? sum("salesPay") : null, salesPct: SALES_PCT,
                      gross: rows.some(r => r.gross != null) ? sum("gross") : null };
        return { months, core, rows, pools, sales, mkt, tot, perFm, util, crew, owned, perDay, rentTrucks, coreDays, method, rentWays, rentPick };
      }
      function nextHtml() {
        if (!FC.year) return '<div class="ap2-note">The forecast block is not in the model yet — it appears after the next plan rebuild (07:50 NJ, or run <b>sources=area-plan</b>).</div>';
        const N = nextCalc();
        const sgn = g => (g >= 0 ? "+" : "") + Math.round(g * 100) + "%";
        const mLbl = ym => MONTH_NAMES[+ym.slice(5, 7)];
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>";
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const METH = { growth: "Last season × growth", avg3: "3-season average", flat: "Flat (last season again)" };
        const BT = FC.backtest || {}, BTM = BT.methods || {};
        const errTxt = m => { const v = BTM[m]; return v && v.abs_err_pct != null ? "±" + Math.round(v.abs_err_pct * 100) + "%" : "—"; };
        const pick = '<div class="ap2-mpick"><span class="ap2-note" style="margin:0 8px 0 0"><b>Method</b></span>' + (FC.methods || ["growth"]).map(m =>
          '<button class="ap2-mbtn' + (N.method === m ? " on" : "") + '" data-method="' + m + '" title="' + (BTM[m] ? "backtest " + BT.year + ": predicted " + fmtN(BTM[m].pred) + " vs " + fmtN(BTM[m].actual) + " actual season jobs" : "") + '">' + METH[m] +
          '<small>' + (BT.year ? (() => { const v = BTM[m]; if (!v || !v.actual) return "backtest " + errTxt(m);
            const d = Math.round((v.pred / v.actual - 1) * 100);
            return "on " + BT.year + ": " + (d >= 0 ? "+" : "") + d + "%"; })() : "") + "</small></button>").join("") +
          /* SAY WHICH WAY IT WAS WRONG (2026-09-20). The picker showed |error| only, so it hid the one
             fact that decides the choice: replayed against last season EVERY method came in UNDER what
             actually happened. A method that under-predicts is the expensive kind of wrong here — too
             few crews in July is work turned away. */
          (() => { const ms = (FC.methods || []).map(m => BTM[m]).filter(v => v && v.actual);
            const allUnder = ms.length && ms.every(v => v.pred < v.actual);
            return ms.length ? '<span class="ap2-note" style="margin:0 0 0 10px">replayed against ' + BT.year +
              (allUnder ? ", <b>every method came in under</b> what the season actually did (" + fmtN(ms[0].actual) + " jobs) — so the closest one is still a floor, not a ceiling" : ", against " + fmtN(ms[0].actual) + " actual jobs") +
              "</span>" : ""; })() + "</div>";
        /* ONE TABLE, ONE SUBJECT (2026-09-20). This carried twenty columns and scrolled sideways past
           its own verdict: crew, hire dates, leads and four money columns that every one of them is
           also printed in the crew table, the marketing table and the budget. It keeps the forecast —
           jobs by state and month, and the method that produced them. */
        const head = "<tr>" + th("State", "") + th("Growth") + N.months.map(ym => { const sh = !N.core.includes(ym);
          return '<th class="num' + (sh ? " ap2-sh" : "") + '" title="' + (sh ? "shoulder month: shown, not planned" : "season month") + '">' + mLbl(ym) + "</th>"; }).join("") +
          th("Season jobs") + "</tr>";
        const stRow = r => "<tr>" + tdc("<b>" + esc(r.st) + "</b>", "strong") +
          tdc('<span title="' + (r.s.growth_source === "override" ? "set on Planning Variables" : "measured: " + fmtN(r.s.season_jobs_prior) + " → " + fmtN(r.s.season_jobs_last) + " season jobs, capped ±" + Math.round((FC.growth_cap || .3) * 100) + "%") + '">' + sgn(r.s.growth || 0) + "</span>") +
          r.cells.map(c => '<td class="num' + (c.shoulder ? " ap2-sh" : "") + '" title="last year ' + fmtN(c.last) + ' jobs · busy-day factor ' + r1(c.headroom) + '">' + (c.jobs ? fmtN(c.jobs) : '<span class="ap2-dim">—</span>') + "</td>").join("") +
          tdc("<b>" + fmtN(r.jobs) + "</b>") + "</tr>";
        const body = N.rows.map(stRow).join("");
        const foot = '<tr class="ap2-tot">' + tdc("<b>All states</b>", "strong") + tdc("") + N.months.map(ym => tdc("<b>" + fmtN(N.rows.reduce((a, r) => a + ((r.cells.find(c => c.ym === ym) || {}).jobs || 0), 0)) + "</b>", "num" + (N.core.includes(ym) ? "" : " ap2-sh"))).join("") +
          tdc("<b>" + fmtN(N.tot.jobs) + "</b>") + "</tr>";
        const lag = FC.lead_lag_months || 1;
        const ramp = N.core.map(ym => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 - lag, 1); const by = MONTH_NAMES[d.getMonth() + 1] + " " + d.getFullYear();
          const leads = N.rows.reduce((a, r) => a + (((r.cells.find(c => c.ym === ym) || {}).leads_needed) || 0), 0);
          return "<b>" + esc(by) + "</b> " + fmtN(leads) + " leads for " + mLbl(ym) + "'s jobs"; }).join(" · ");
        return pick + '<div class="ap2-note" style="margin-bottom:8px">Jobs by state and month, ' +
          (N.method === "growth" ? "last season's same month × the state's growth" : N.method === "avg3" ? "the mean of the same month over the last three seasons" : "last season's same month, unchanged") +
          '. Greyed months are shoulders — shown so the ramp is visible, left out of the season total. ' + go("apMethod", "How this is calculated") + "</div>" +
          '<table data-name="Jobs forecast by state and month" class="rs-table ap2-next"><thead>' + head + "</thead><tbody>" + body + foot + "</tbody></table>" +
          '<div class="ap2-note" style="margin-top:8px"><b>Leads to bring in</b> (jobs × the leads each job took last season, every lead counted' + (N.mkt.held ? ", lifted so a job is not planned cheaper than it was" : "") + '; needed ' + lag + ' month ahead — the lead→move lag): ' + ramp + ".</div>";
      }


      /* ================= PHASE 3 (2026-09-16) ================= */
      /* ------- the season budget: the Next-season money plus marketing and postcards, per state ---- */
      // state cost per lead = the master's estimated ad cost over its leads, in the chosen window
      function stateCpl(cityRows) {
        const acc = {};
        (cityRows || CITYALL).forEach(r => { const st = r.State; if (!st) return; const a = acc[st] = acc[st] || { cost: 0, leads: 0 };
          a.cost += adCost(r); a.leads += num(r.Leads); });
        const out = {}; Object.entries(acc).forEach(([st, a]) => { out[st] = a.leads ? a.cost / a.leads : null; });
        const cost = Object.values(acc).reduce((t, a) => t + a.cost, 0), leads = Object.values(acc).reduce((t, a) => t + a.leads, 0);
        out._all = leads ? cost / leads : null;
        return out;
      }
      // last season's postcard cost per state (Post Card Expenditure), as the planning placeholder
      function postcardBy() {
        const out = {}; const lo = (SEASON.last || [])[0], hi = (SEASON.last || [])[1];
        (PCM || []).forEach(r => { const ym = String(r.Month); if (!lo || ym < lo || ym > hi) return;
          const st = r.State; const o = out[st] = out[st] || { cost: 0, unknown: false, cards: 0 };
          const c = num(r["Cards Mailed"]); o.cards += c; if (c && r.COGS == null) o.unknown = true; else o.cost += num(r.COGS); });
        return out;
      }
      function budgetHtml() {
        if (!FC.year) return "";
        const N = nextCalc(), PC = postcardBy();
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>";
        const rows = N.rows.map(r => { const cpl = N.mkt.cplOf(r.st); const mkt = cpl != null ? r.leads * cpl : null;
          const pc = PC[r.st]; const pcCost = pc && pc.cards ? (pc.unknown ? null : pc.cost) : 0;
          const net = (r.gross != null && mkt != null) ? r.gross - mkt : null;      // post cards are INSIDE marketing: never taken off twice
          return { st: r.st, jobs: r.jobs, revenue: r.revenue, expense: r.expense, rent: r.rent, salesPay: r.salesPay, gross: r.gross, leads: r.leads, cpl, mkt, pcCost, pcUnknown: !!(pc && pc.unknown), net }; });
        const sum = k => rows.reduce((a, r) => a + (r[k] || 0), 0);
        const some = k => rows.some(r => r[k] != null);
        const tot = { jobs: sum("jobs"), revenue: some("revenue") ? sum("revenue") : null, expense: some("expense") ? sum("expense") : null, rent: sum("rent"), salesPay: some("salesPay") ? sum("salesPay") : null, gross: some("gross") ? sum("gross") : null, leads: sum("leads"),
                      mkt: some("mkt") ? sum("mkt") : null, pcCost: sum("pcCost"), pcUnknown: rows.some(r => r.pcUnknown), net: some("net") ? sum("net") : null };
        const line = (name, r) => "<tr>" + tdc(name, "strong") + tdc(fmtN(r.jobs)) + tdc(r.revenue != null ? money0(r.revenue) : "—") + tdc(r.expense != null ? money0(r.expense) : "—") + tdc(r.rent ? money0(r.rent) : "—") + tdc(r.salesPay != null ? money0(r.salesPay) : "—") + tdc(r.gross != null ? money0(r.gross) : "—") +
          tdc(fmtN(r.leads)) + tdc(r.cpl != null ? money0(r.cpl) : "—") + tdc(r.mkt != null ? money0(r.mkt) : "—") + tdc(r.pcUnknown ? '<span class="ap2-dim" title="cards were mailed there but the purchase quantities are not typed yet">?</span>' : r.pcCost ? money0(r.pcCost) : "—") +
          tdc(r.net != null ? "<b>" + money0(r.net) + "</b>" : "—") + "</tr>";
        return '<div class="ap2-note" style="margin-bottom:8px">' +
          (N.rentPick && N.rentWays.length > 1 ? "<b>Truck rent</b> is priced three ways and the plan takes the dearest — " +
            N.rentWays.map((w, i) => (i ? "" : "<b>") + esc(w.label) + " " + money0(w.usd) + (i ? "" : "</b>")).join(" · ") +
            ". <b>Sales pay</b> is " + r1((N.tot.salesPct || 0) * 100) + "% of revenue: <b>commission and bonus only</b>, not base salary, payroll tax or the sales manager. " : "") +
          "Revenue, job expense and truck rent come from the jobs forecast (same method, same dials). <b>Marketing</b> = every lead the jobs need × what a lead really cost last season, the whole advertising ledger with post cards inside it. <b>Post cards mailed there</b> is last season's actual mailing, shown beside the budget and not taken out of it. Net = gross − marketing, before overhead. " + go("apMethod", "How this is calculated") + "</div>" +
          '<table data-name="The season in money" class="rs-table ap2-next"><thead><tr>' + th("State", "") + th("Jobs") + th("Revenue") + th("Job expense") + th("Truck rent") + th('Sales pay<small title="commission and bonus only — not base salary, payroll tax or the sales manager"> comm. + bonus</small>') + th("Gross") + th("Leads needed") + th("$ / lead") + th("Marketing") + th('Post cards mailed there<small> 2026 actual</small>') + th("Net") + "</tr></thead><tbody>" +
          rows.map(r => line(esc(r.st), r)).join("") + '<tr class="ap2-tot">' + line("<b>All states</b>", tot).slice(4) + "</tbody></table>";
      }

      /* ------- push or cut: an opportunity rank over the cities, weights adjustable ------------------ */
      /* TWO DIFFERENT QUANTITIES — DO NOT SWAP ONE FOR THE OTHER (caught 2026-09-18, after the
         first version of this did exactly that). `Est Ad Cost` is EVERY channel: the city's leads
         by source times what that source costs us company-wide. `Ad Spend` is GOOGLE ADS ALONE,
         what Google actually charged for that city. Philadelphia: $38,141 estimated across Angi
         44% / Yelp 18% / Google 16%, against $11,440 measured on Google — substituting the second
         for the first cut the city's ad cost by two thirds and made its return look three times
         better. So the estimate stays the total, the measured Google figure rides beside it, and
         the reader can see how much of the total is now real money rather than attribution. */
      const adCost = r => num(r["Est Ad Cost"]) || 0;                 // every channel, attributed
      const adGoogle = r => num(r["Ad Spend"]) || 0;                  // Google Ads, charged
      const adIsMeasured = r => adGoogle(r) > 0;
      const adPerDollar = r => { const c = adCost(r); return c > 0 ? num(r.Revenue) / c : null; };
      const adBadge = r => adIsMeasured(r)
        ? '<span class="ap2-meas" title="Google Ads charged ' + money0(adGoogle(r)) + ' for this city — part of the total beside it">G ' + money0(adGoogle(r)) + "</span>" : "";

      /* THE MART'S OWN LABELS (curated.py, ELT(NTILE(5)...)): Lowest / Lower / Middle / Upper / Top.
         The page scored against "Fourth fifth" and "Second fifth", which match nothing, so every city
         scored the same on wealth. */
      const WEALTH_RANK = { "Top fifth": 1, "Upper fifth": .75, "Middle fifth": .5, "Lower fifth": .25, "Lowest fifth": 0 };
      const RANK_DIMS = [["rpa", "Revenue per ad $", r => adPerDollar(r)],
                         ["mover", "Mover rate", r => r["Mover Rate"] != null ? num(r["Mover Rate"]) : null],
                         ["wealth", "Wealth tier", r => WEALTH_RANK[r["Wealth Tier"]] ?? null],
                         ["untapped", "Leads, no jobs (share)", r => num(r.Leads) ? lnj(r) / num(r.Leads) : null]];
      inputs.rankW = Object.assign({ rpa: 40, mover: 20, wealth: 20, untapped: 20 }, inputs.rankW || {});
      function rankRows() {
        // service-area states only: a long-distance destination with 20 leads is not a market to buy leads in
        const rows = CITYALL.filter(r => SERVICE_AREAS.includes(r.State) && num(r.Leads) >= (C.minLeads || 20) && (!inputs.focus || r.State === inputs.focus));
        const pr = {};   // percentile rank per dimension
        RANK_DIMS.forEach(([k, , f]) => { const vals = rows.map(f); const sorted = vals.filter(v => v != null).slice().sort((a, b) => a - b);
          pr[k] = vals.map(v => v == null ? null : sorted.length > 1 ? sorted.findIndex(x => x >= v) / (sorted.length - 1) : .5); });
        const W = inputs.rankW, wsum = RANK_DIMS.reduce((a, [k]) => a + (num(W[k]) || 0), 0) || 1;
        return rows.map((r, i) => { let s = 0, w = 0; RANK_DIMS.forEach(([k]) => { const v = pr[k][i]; if (v != null) { s += v * (num(W[k]) || 0); w += (num(W[k]) || 0); } });
          return { r, score: w ? s / w : null, parts: Object.fromEntries(RANK_DIMS.map(([k]) => [k, pr[k][i]])) }; }).filter(x => x.score != null).sort((a, b) => b.score - a.score);
      }
      function rankHtml() {
        const all = rankRows();
        const push = all.slice(0, 12), cut = all.filter(x => adCost(x.r) >= 1000).slice(-8).reverse();   // the estimate is the total, so the floor reads the total
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const line = x => { const r = x.r; return "<tr>" + tdc(esc(r.City) + ' <span class="ap2-dim">' + esc(r.State) + "</span>", "strong") + tdc(Math.round(x.score * 100)) + tdc(fmtN(r.Leads)) + tdc(bookPct(r["Booking Rate"])) +
          tdc(money0(adCost(r)) + adBadge(r)) + tdc(adPerDollar(r) != null ? "$" + r1(adPerDollar(r)) : "—") + tdc(r["Mover Rate"] != null ? pct(num(r["Mover Rate"])) : "—") + tdc(esc(r["Wealth Tier"] || "—"), "") + tdc(fmtN(lnj(r))) + "</tr>"; };
        const head = '<thead><tr><th>City</th><th class="num">Score</th><th class="num">Leads</th><th class="num">Booking %</th><th class="num">Est. ad cost</th><th class="num">Revenue per ad $</th><th class="num">Mover rate</th><th>Wealth</th><th class="num">Leads, no jobs</th></tr></thead>';
        return '<div class="ap2-rankw">' + RANK_DIMS.map(([k, label]) => '<label>' + esc(label) + ' <input class="rs-num ap2-in" type="number" min="0" max="100" step="5" data-rank="' + k + '" value="' + (num(inputs.rankW[k]) || 0) + '"></label>').join("") +
          '<span class="ap2-note" style="margin:0">weights · each dimension is a percentile rank among the cities shown (min leads and focus apply)</span></div>' +
          '<div class="ap2-rank2" data-nopage><div><div class="ap2-note"><b>Push</b> — the best-placed cities to add leads in</div><table data-name="Push - cities to add leads in" class="rs-table ap2-below-tabs ap2-next">' + head + "<tbody>" + push.map(line).join("") + "</tbody></table></div>" +
          '<div><div class="ap2-note"><b>Cut or fix</b> — the weakest of the cities we already pay $1,000+ for</div><table data-name="Cut or fix - the weakest cities" class="rs-table ap2-below-tabs ap2-next">' + head + "<tbody>" + cut.map(line).join("") + "</tbody></table></div></div>";
      }
      function repaintRank() { const el = host.querySelector("#apRank"); if (el) { el.innerHTML = rankHtml(); wireRank(); enhanceTables(); } }
      function wireRank() {
        host.querySelectorAll("#apRank [data-rank]").forEach(el => el.addEventListener("input", () => { inputs.rankW[el.dataset.rank] = parseFloat(el.value) || 0; save();
          const keep = el.dataset.rank; repaintRank(); const again = host.querySelector('#apRank [data-rank="' + keep + '"]'); if (again) { again.focus(); } }));
      }

      /* ------- where a depot pays: the presets from the model, any zip from its maps ---------------- */
      const DEP = model.depots || {};
      const hav = (a, b, c, d) => { const R = 3958.7613, r = x => x * Math.PI / 180; const dp = r(c - a), dl = r(d - b);
        const h = Math.sin(dp / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
      function depotTry(zip) {
        const J = DEP.jobs_by_zip || [], WS = DEP.ws_zips || [], B = DEP.bases || [];
        const hit = J.find(x => x[0] === zip) || WS.find(x => x[0] === zip); if (!hit) return null;
        const lat = hit[1], lon = hit[2]; const total = J.reduce((a, j) => a + j[3], 0);
        const near = (la, lo, bs) => bs.reduce((best, b) => { const d = hav(la, lo, b.lat, b.lon); return d < best[0] ? [d, b.name] : best; }, [Infinity, null]);
        const withC = B.concat([{ name: zip, lat, lon }]);
        let mi = 0, base = 0, j15 = 0, j35 = 0, rehomed = 0;
        J.forEach(j => { const d = hav(j[1], j[2], lat, lon); if (d <= (DEP.near_mi || 15)) j15 += j[3]; if (d <= (DEP.territory_mi || 35)) j35 += j[3];
          base += near(j[1], j[2], B)[0] * j[3]; const n = near(j[1], j[2], withC); mi += n[0] * j[3]; if (n[1] === zip) rehomed += j[3]; });
        let ws35 = 0, never = 0, movers = 0;
        WS.forEach(w => { if (hav(w[1], w[2], lat, lon) <= (DEP.territory_mi || 35)) { ws35++; if (w[3]) { never++; movers += w[4]; } } });
        return { zip, label: zip, mi_per_job: total ? mi / total : null, saved_mi_per_job: total ? (base - mi) / total : null, jobs_15: j15, jobs_35: j35, rehomed, ws_zips_35: ws35, ws_never_35: never, movers_never_35: movers };
      }
      function depotHtml() {
        if (!DEP.baseline) return '<div class="ap2-note">Depot scenarios appear after the next plan rebuild (07:50 NJ, or run <b>sources=area-plan</b>).</div>';
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const cands = (DEP.candidates || []).slice();
        if (inputs.depotZip && !cands.some(c => c.zip === inputs.depotZip)) { const t = depotTry(inputs.depotZip); cands.push(t || { zip: inputs.depotZip, label: inputs.depotZip, error: "not in the territory data (no jobs and not within 35 miles of a base)" }); }
        const line = c => "<tr>" + tdc("<b>" + esc(c.label || c.zip) + "</b> <span class=\"ap2-dim\">" + esc(c.zip) + "</span>", "strong") +
          (c.error ? '<td colspan="8" class="ap2-dim">' + esc(c.error) + "</td>" :
            tdc(fmtN(c.jobs_15)) + tdc(fmtN(c.jobs_35)) + tdc("<b>" + fmtN(c.rehomed) + "</b>") + tdc(r1(c.mi_per_job)) + tdc('<span class="' + (c.saved_mi_per_job > 0 ? "ap2-ok" : "ap2-dim") + '">' + (c.saved_mi_per_job > 0 ? "−" : "") + r1(Math.abs(c.saved_mi_per_job)) + " mi</span>") +
            tdc(fmtN(c.ws_zips_35)) + tdc(fmtN(c.ws_never_35)) + tdc(fmtN(c.movers_never_35))) + "</tr>";
        return '<div class="ap2-note" style="margin-bottom:8px">Last twelve months of jobs by pickup zip, straight-line miles. Today: <b>' + fmtN(DEP.baseline.jobs) + '</b> jobs at <b>' + r1(DEP.baseline.mi_per_job) + ' mi/job</b> from ' + (DEP.baseline.bases || []).length + ' active bases (' + esc((DEP.baseline.bases || []).join(", ")) + '). <b>Re-homed</b> = jobs that would be closer to the new depot than to any base today. White space = territory zips within ' + (DEP.territory_mi || 35) + ' miles that never sent a lead, and the people who move there each year (Census).</div>' +
          '<div class="ap2-mpick"><span class="ap2-note" style="margin:0 8px 0 0"><b>Try a zip</b></span><input class="ap2-in" id="apDepotZip" placeholder="e.g. 08540" maxlength="5" value="' + esc(inputs.depotZip || "") + '" style="width:110px"><button class="ap2-mbtn" id="apDepotGo">Add to the table</button>' +
          '<span class="ap2-note" style="margin:0 0 0 10px">presets come from the plan; add more on Planning Variables (depot candidates)</span></div>' +
          '<table data-name="Where a depot pays" class="rs-table ap2-next"><thead><tr><th>Depot at</th><th class="num">Jobs ≤ ' + (DEP.near_mi || 15) + ' mi</th><th class="num">Jobs ≤ ' + (DEP.territory_mi || 35) + ' mi</th><th class="num">Re-homed</th><th class="num">mi / job with it</th><th class="num">Saving</th><th class="num">Zips ≤ 35 mi</th><th class="num">Never a lead</th><th class="num">Movers / yr there</th></tr></thead><tbody>' +
          cands.map(line).join("") + "</tbody></table>";
      }
      function wireDepot() {
        const go = host.querySelector("#apDepotGo"), inp = host.querySelector("#apDepotZip"); if (!go || !inp) return;
        const run = () => { const z = (inp.value || "").replace(/\D/g, "").slice(0, 5); if (z.length !== 5) return; inputs.depotZip = z; save();
          const el = host.querySelector("#apDepot"); if (el) { el.innerHTML = depotHtml(); wireDepot(); enhanceTables(); } };
        go.onclick = run; inp.onkeydown = e => { if (e.key === "Enter") run(); };
      }

      function wireMethod() {
        host.querySelectorAll("#apNext [data-method]").forEach(b => b.onclick = () => {
          inputs.method = b.dataset.method; save();
          /* the decisions band and the full plan say they "move with its method" — until 2026-09-19
             they did not: only this card and the budget repainted, so the top of the page kept the
             old method's crews, desk and budget until a reload. */
          repaintPlan();
        });
      }



      /* ===================== THE FORMULA =====================
         Giga, 2026-09-20: "in the end i need a formula kind of thing, for location: if i have X
         foreman - how many sales and marketing budget i need." Every coefficient below is measured
         over May-Aug 2024/25/26, Zip to Zip, and the chain reproduces the live plan to within 3%
         on marketing. Research: docs/plans/2026-09-20-bases-expansion-and-the-formula.md.

         THE ONE CAVEAT THAT MATTERS, and it is on the card because it changes what he asks for:
         jobs-per-foreman-month is NOT a productivity constant. It is demand divided by headcount.
         In 2025 headcount rose 22% and jobs FELL 7% -- days worked per foreman collapsed while jobs
         per working DAY barely moved. A foreman does not create jobs; leads do. So the honest
         reading is "this is the sales and marketing it takes to keep X foremen busy". */
      const FORMULA = { daysPerMonth: 17.5, leadsPerJob: 5.85,
                        leadsPerRep: 281, perLead: 33.61, floorPerJob: 197, rampFirstSeason: 0.80 };
      /* A FOREMAN-DAY IS NOT ONE JOB (his correction 2026-09-20): "if there is a chaining - it
         means that foreman runs 2 jobs a day - yet its single foreman - and if we dont have it in
         analysis, we are screwed." Measured: 23.2% of foreman-days carry two jobs, 1.1% carry
         three or more, and 37% of all jobs happen on a chained day. It tracks job size, so the
         rate is LOCAL -- CT 1.296 jobs a foreman-day against Delaware's 1.055. */
      const CHAIN = model.chaining || {};
      const SIS = model.sister || {};
      /* the dead-lead rate, as its OWN number -- never folded into the desk sizing */
      function deadRate(yms) {
        let leads = 0, live = 0;
        (yms || []).forEach(m => Object.values(MS[m] || {}).forEach(a => {
          leads += a.leads || 0; live += a.qualified || 0; }));
        return leads ? { leads, dead: leads - live, pct: (leads - live) / leads * 100 } : null;
      }
      const chainOf = st => ((CHAIN[st] || {}).jobs_per_foreman_day)
                         || ((CHAIN._all || {}).jobs_per_foreman_day) || null;
      const haveChain = () => chainOf("_all") != null;
      function formulaHtml() {
        const F = FORMULA, N = FC.year ? nextCalc() : null;
        const months = N ? N.core.length : 4;
        if (!haveChain()) return '<div class="panel">The plan model carries no <b>chaining</b> block ' +
          'yet, and every number on this card is built on jobs a foreman-day. Run ' +
          '<b>sources=area-plan</b> and reload — the card will not guess a rate.</div>';
        const jpd = chainOf("_all");
        const J = jpd * F.daysPerMonth;                               // jobs a foreman-month
        const st = N ? N.rows.filter(r => r.jobs >= 20) : [];
        const row = r => { const lpj = r.leadsPerJob != null ? r.leadsPerJob : F.leadsPerJob;
          const jobs = Math.round(chainOf(r.st) * F.daysPerMonth * months * F.rampFirstSeason);
          const leads = Math.round(jobs * lpj);
          const cpl = N.mkt.cplOf(r.st);
          const built = cpl != null ? leads * cpl : null;
          const floor = jobs * F.floorPerJob;
          const mkt = built == null ? floor : Math.max(built, floor);
          return "<tr>" + tdc("<b>" + esc(r.st) + "</b>", "strong") +
            tdc(fmtN(jobs) + '<small>at ' + r2(chainOf(r.st)) + " a foreman-day</small>") +
            tdc(fmtN(leads) + '<small> at ' + r1(lpj) + " / job</small>") +
            tdc(r1(leads / months / F.leadsPerRep)) +
            tdc(cpl != null ? money0(cpl) : "—") +
            tdc("<b>" + money0(mkt) + "</b>" + (built != null && floor > built ? '<small>floor</small>' : "")) + "</tr>"; };
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>";
        const one = { jobs: Math.round(J * months), leads: Math.round(J * months * F.leadsPerJob) };
        /* HIS INSTRUCTION, 2026-09-20: "i need you to tell us how many foreman we should have, not
           vise versa." So the demand side leads and the per-foreman unit follows as the check. */
        const inv = N ? N.rows.filter(r => r.jobs >= 20).map(r => {
          const rate = chainOf(r.st) * F.daysPerMonth;
          const peak = Math.max(0, ...r.cells.filter(c => !c.shoulder).map(c => c.jobs || 0));
          return { st: r.st, jobs: r.jobs, peakJobs: peak, rate,
                   fmSeason: r.jobs / (rate * months), fmPeak: peak / rate,
                   have: r.have, chain: chainOf(r.st),
                   share: (CHAIN[r.st] || {}).chained_day_share };
        }) : [];
        const invRow = x => "<tr>" + tdc("<b>" + esc(x.st) + "</b>", "strong") +
          tdc(fmtN(x.jobs)) + tdc(fmtN(x.peakJobs)) +
          tdc(r2(x.chain) + (x.share != null ? '<small>' + Math.round(x.share * 100) + "% of days chained</small>" : "")) +
          tdc("<b>" + Math.ceil(x.fmPeak) + "</b>") + tdc(fmtN(x.have)) +
          tdc(Math.ceil(x.fmPeak) - x.have > 0 ? '<b class="ap2-hire">+' + (Math.ceil(x.fmPeak) - x.have) + "</b>"
              : '<span class="ap2-ok">covered</span>') + "</tr>";
        return '<div class="ap2-formula">' +
          '<div class="f-lead"><b>How many foremen should we have?</b> Start from the work, not the crew. ' +
            'Each state\'s jobs in its busiest month, divided by what one foreman actually does in a day there.</div>' +
          (inv.length ? '<table data-name="How many foremen we should have" class="rs-table ap2-next" style="margin:0 0 16px"><thead><tr>' +
            th("State", "") + th("Season jobs") + th("Busiest month") + th("Jobs a foreman-day") +
            th("Foremen needed") + th("Have") + th("Hire") + "</tr></thead><tbody>" +
            inv.map(invRow).join("") + "</tbody></table>" : "") +
          /* THESE DO NOT ADD UP, AND SAYING SO IS THE POINT. Each row is that state's own busiest
             month, and the states peak in different months; the plan sizes the crew per depot pool,
             which is why its total is smaller than the column suggests. Same trap as the crew
             table's "29 at peak over months that never exceed 28". */
          (inv.length && N ? note("These are <b>per-state peaks in different months</b>, so they do not add up: the column totals <b>" +
            inv.reduce((a, x) => a + Math.ceil(x.fmPeak), 0) + "</b> where the plan sizes <b>" + N.tot.peak +
            "</b>. The plan pools states onto the depot that serves them and calibrates on the crews that actually ran it; " +
            "this table is the same question from first principles. Where a row is higher, that state ran hotter than its day-rate implies. " +
            goLink("apFullCrew", "the crew plan")) : "") +
          note("<b>A foreman-day is not one job.</b> Nearly a quarter of working days carry two jobs and a few carry three — " +
               "37% of all jobs happen on a chained day, and it tracks job size: a one-job day bills " + money0(3394) +
               ", a two-job day " + money0(2037) + " each. So the rate is measured per state, not assumed" +
               (() => { const pair = ["CT", "DE", "PA", "NJ"].filter(x => chainOf(x) != null).slice(0, 2);
                 return pair.length === 2
                   ? ": " + esc(pair[0]) + " runs " + r2(chainOf(pair[0])) + " jobs a foreman-day against " +
                     esc(pair[1]) + "'s " + r2(chainOf(pair[1])) + ". " : ". "; })() +
               go("apMethod", "How this is calculated")) +
          '<div class="f-lead" style="margin-top:18px"><b>And the other way round</b> — what one foreman needs behind them.</div>' +
          note("The company rate below (<b>" + r2(chainOf("_all")) + "</b>) is higher than any single state's, and that is the grain, not an error: " +
               "a state counts the days worked <b>in it</b>, so a crew that loads in New Jersey and unloads in Pennsylvania spends a day in each " +
               "state's column and one day in the company's. Size a state off its own rate; size a foreman off this one.") +
          '<div class="f-eq"><span class="n">1</span>jobs <em>=</em> foremen <em>x</em> <b>' + r1(J) + '</b>' +
            '<small>' + r2(jpd) + ' jobs a foreman-day (measured, chaining included) <em>x</em> ' + r1(F.daysPerMonth) + ' days worked a month</small></div>' +
          '<div class="f-eq"><span class="n">2</span>leads <em>=</em> jobs <em>x</em> <b>' + r1(F.leadsPerJob) + '</b>' +
            '<small>the state\'s own ratio where it has one</small></div>' +
          '<div class="f-eq"><span class="n">3</span>salespeople <em>=</em> leads <em>&divide;</em> <b>' + fmtN(F.leadsPerRep) + '</b>' +
            '<small>staffed one month before the move month</small></div>' +
          '<div class="f-eq"><span class="n">4</span>marketing <em>=</em> leads <em>x</em> <b>$/lead</b>' +
            '<small>but never below jobs <em>x</em> ' + money0(F.floorPerJob) + '</small></div>' +
          '<div class="f-unit"><b>One foreman, one season</b> = ' + fmtN(one.jobs) + ' jobs, ' + fmtN(one.leads) +
            ' leads, ' + r1(one.leads / months / F.leadsPerRep) + ' of a salesperson, ' +
            money0(one.jobs * F.floorPerJob) + ' of marketing. Equivalently <b>one salesperson per ' +
            r1(F.leadsPerRep * months / (J * months * F.leadsPerJob) * 1) + ' foremen</b>.</div>' +
          (st.length ? '<table data-name="One extra crew by state" class="rs-table ap2-next" style="margin-top:12px"><thead><tr>' +
            th("Add one crew in", "") + th("Jobs a season") + th("Leads it needs") + th("Salespeople") +
            th("$ / lead") + th("Marketing") + "</tr></thead><tbody>" + st.map(row).join("") + "</tbody></table>" : "") +
          note("A new crew's first season carries a <b>" + Math.round(F.rampFirstSeason * 100) +
               "%</b> ramp — month one runs 12.3 jobs against 21.7 by month three. " +
               "<b>Jobs per foreman-month is the weak link</b>: it carries 89% of the budget error, because it is " +
               "demand divided by headcount, not a productivity constant. In 2025 headcount rose 22% and jobs fell 7%. " +
               "Read this as <b>the sales and marketing it takes to keep X foremen busy</b>, not as what they will produce. " +
               go("apMethod", "How this is calculated")) + "</div>";
      }


      /* ===================== TUJI, BESIDE THE PLAN =====================
         His instruction 2026-09-20: "i need it to be kinda separately but within plan."

         So: on the page, never in a total. Every crew, salesperson and marketing dollar this page
         sizes is Zip to Zip's, because Tuji hires, sells and advertises for itself. Folding it in
         would inflate the hire and the budget for people we do not pay.

         WHAT IT CHANGES IS DELAWARE. 429 of Tuji's 548 jobs since 2024 are Delaware jobs — the very
         state this page has been calling a coverage gap because nobody on the Zip crew register is
         permitted to work there. Delaware is not unserved; it is served by the sister company, and
         in 2026 the two ran it almost exactly half and half (134 Tuji, 135 Zip).

         That accident makes Delaware the only state in the eight where "based here" can be measured
         against "shipped in" with the state held constant — which is the question he actually asked
         when he said the margin is lower on the jobs we ship out of PA. */
      function sisterHtml() {
        const cos = (SIS.companies || []).filter(c => c.jobs >= 5);
        if (!cos.length) return "";
        const DE = SIS.de || {}, deRows = DE.rows || [];
        const T = cos.find(c => /tuji/i.test(c.company));
        const td = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>";
        const yr = String(new Date().getFullYear());
        const pctOf = (a, b) => b ? Math.round(a / b * 100) : 0;

        /* live or shut: a company whose last closing is months old is not a crew we can plan on */
        const lastOf = c => (c.by_month && c.by_month.length) ? c.by_month[c.by_month.length - 1].ym : c.last;
        const newest = cos.reduce((a, c) => (lastOf(c) > a ? lastOf(c) : a), "");
        const coRow = c => {
          const thisYr = (c.by_year || []).find(y => y.y === yr) || { jobs: 0, peak_foremen: 0 };
          /* the newest month in the warehouse is part-counted -- a roster read off it always shrinks */
          const whole = (c.by_month || []).slice(0, -1);
          const now = whole.length ? whole[whole.length - 1] : null;
          const live = lastOf(c) >= newest.slice(0, 4) + "-" + String(Math.max(1, +newest.slice(5, 7) - 2)).padStart(2, "0");
          return "<tr>" +
            td("<b>" + esc(c.company) + "</b>" + (live ? "" : '<small>last closing ' + esc(ymLabel(lastOf(c))) + "</small>"), "strong") +
            td(fmtN(thisYr.jobs)) +
            td((thisYr.peak_foremen || "—") + (now && now.foremen && now.foremen !== thisYr.peak_foremen
                ? "<small>" + now.foremen + " in " + esc(ymLabel(now.ym)) + "</small>" : "")) +
            td((c.states || []).slice(0, 3).map(x => esc(x.st) + " " + pctOf(x.jobs, c.jobs) + "%").join(" · "), "") +
            td(money0(c.avg_bill)) + td(r1(c.margin_pct) + "%") +
            td(c.jobs_per_foreman_day != null ? r2(c.jobs_per_foreman_day) : "—") + "</tr>";
        };

        /* Tuji's year has no shape. May-August is 33% of its year -- which is exactly four twelfths,
           a dead-flat calendar -- against 44% for Zip to Zip. So its crews are not a summer reserve:
           they are busy in December too, and cannot be leaned on for the peak. */
        const summer = T ? T.summer_share : null, planSummer = SIS.plan_summer_share;

        const deTable = deRows.length < 2 ? "" :
          '<table data-name="Delaware, based against shipped" class="rs-table ap2-next" style="margin:4px 0 10px"><thead><tr>' +
          th("Who runs the job", "") + th("Crew is based", "") + th("Jobs") + th("Foreman-days") +
          th("Jobs a foreman-day") + th("Days that carried two") + th("Avg bill") + th("Margin") +
          "</tr></thead><tbody>" + deRows.map(r => "<tr>" +
            td("<b>" + esc(r.company) + "</b>", "strong") +
            td(esc(r.based) + (/depot/i.test(r.based) ? '<small>shipped in</small>' : '<small>sleeps there</small>'), "") +
            td(fmtN(r.jobs)) + td(fmtN(r.foreman_days)) +
            td("<b>" + r2(r.jobs_per_foreman_day) + "</b>") +
            td(r.chained_day_share != null ? r1(r.chained_day_share * 100) + "%" : "—") +
            td(money0(r.avg_bill)) + td(r1(r.margin_pct) + "%") + "</tr>").join("") +
          (DE.zip_home ? '<tr><td class="strong">' + esc(SIS.plan_company || "Zip to Zip") +
             '</td><td>Pennsylvania<small>at home</small></td><td class="num">' + fmtN(DE.zip_home.jobs) +
             '</td><td class="num">' + fmtN(DE.zip_home.foreman_days) + '</td><td class="num"><b>' +
             r2(DE.zip_home.jobs_per_foreman_day) + '</b></td><td class="num">' +
             r1(DE.zip_home.chained_day_share * 100) + '%</td><td class="num">—</td><td class="num">—</td></tr>' : "") +
          "</tbody></table>";

        const bands = (DE.bands || []);
        const bandCos = bands.length ? Object.keys(bands[0]).filter(k => k !== "band") : [];
        const bandTable = bands.length < 2 || bandCos.length < 2 ? "" :
          '<table data-name="Delaware margin by ticket band" class="rs-table ap2-next" style="margin:4px 0 10px;max-width:820px"><thead><tr>' +
          th("Job size", "") + bandCos.map(c => th(esc(c) + " margin")).join("") + "</tr></thead><tbody>" +
          bands.map(b => "<tr>" + td("<b>" + esc(b.band) + "</b>", "strong") +
            bandCos.map(c => td(b[c] ? r1(b[c].margin_pct) + "%<small>" + fmtN(b[c].jobs) + " jobs</small>" : "—")).join("") +
            "</tr>").join("") + "</tbody></table>";

        const zd = DE.zip_de || {}, td_ = DE.tuji_de || {}, hm = DE.zip_home || {};
        const lift = (zd.jobs_per_foreman_day && td_.jobs_per_foreman_day)
          ? (td_.jobs_per_foreman_day / zd.jobs_per_foreman_day - 1) * 100 : null;

        return '<div class="ap2-say" style="margin-top:0">These numbers are <b>Tuji\'s, not the plan\'s</b>. ' +
            'Every crew, salesperson and marketing dollar on this page is <b>' + esc(SIS.plan_company || "Zip to Zip") +
            '\'s</b>, because the sister companies hire, sell and advertise for themselves — folding them in would ' +
            'have the plan hiring people we do not pay. Nothing below is added to any total on this page.</div>' +
          '<table data-name="The sister companies" class="rs-table ap2-next" style="margin:4px 0 14px"><thead><tr>' +
            th("Company", "") + th(yr + " jobs") + th("Crews at peak") + th("Where it works", "") +
            th("Avg bill") + th("Margin") + th("Jobs a foreman-day") + "</tr></thead><tbody>" +
            cos.map(coRow).join("") + "</tbody></table>" +
          (T ? note("<b>Tuji is Delaware.</b> " + fmtN((T.states.find(x => x.st === "DE") || {}).jobs) +
                 " of its " + fmtN(T.jobs) + " jobs since 2024 — " +
                 pctOf((T.states.find(x => x.st === "DE") || {}).jobs || 0, T.jobs) + "% — are Delaware jobs, and in " + yr +
                 " the two companies split the state almost in half. So the plan does not have a Delaware hole; " +
                 "it has a Delaware <b>half</b>, and the other half is run by a crew this page does not count." +
                 (summer != null ? " Tuji also has <b>no season</b>. Four months out of twelve is " +
                   r1(SIS.flat_year_share || 33.3) + "% of a year, and May–August is <b>" + r1(summer) +
                   "%</b> of Tuji's" + (planSummer != null ? " against <b>" + r1(planSummer) + "%</b> of " +
                   esc(SIS.plan_company || "Zip to Zip") + "'s" : "") + ". Its crews are as busy in December " +
                   "as in July, so they are not a summer reserve — they cannot flex into our peak, and a " +
                   "Delaware crew of our own would have to be hired for it." : "")) : "") +
          '<div class="ap2-band" style="margin-top:14px;border-top:0;padding-top:0"><span class="k">The Delaware question</span>' +
            "<h2>Based there, or shipped in from Pennsylvania</h2>" +
            '<span class="clock">2024 to date · the one state two companies work from different bases</span></div>' +
          '<div class="ap2-say">His reason for wanting a Delaware or Virginia crew, 2026-09-20: <i>"we cover DE\'s jobs from PA ' +
            'currently, like we ship the crew from PA."</i> Because Tuji is based in Delaware and Zip to Zip drives in ' +
            'from the PA depot, the state holds everything else constant — same customers, same season, same job types.</div>' +
          deTable +
          (lift != null ? note("<b>The crew that sleeps in Delaware gets " + r1(lift) + "% more out of a day.</b> " +
            "A crew shipped from Pennsylvania chains a second job on <b>" + r1(zd.chained_day_share * 100) +
            "%</b> of its Delaware days; the crew based there chains on <b>" + r1(td_.chained_day_share * 100) +
            "%</b>" + (hm.chained_day_share ? ", and the same Zip crews chain <b>" + r1(hm.chained_day_share * 100) +
            "%</b> of their days at home in Pennsylvania" : "") + ". The drive does not eat the job — it eats the " +
            "<b>second</b> job, and foreman-days are the scarce unit this whole page is sized on. " +
            go("apFormula", "The formula, and why a foreman-day is not one job")) : "") +
          (bandTable ? '<div class="ap2-say" style="margin-top:10px"><b>What it does not cost is margin, and the page will not claim it does.</b> ' +
            'Tuji earns more per dollar in Delaware than Zip to Zip does — but it earns more in <b>every</b> job size, ' +
            'including the small ones where a drive cannot matter, so that gap is Tuji\'s cost base rather than the distance. ' +
            'And Zip to Zip\'s own Delaware margin <b>beats</b> its Pennsylvania and New Jersey margin in every band. ' +
            'The case for a Delaware crew is the foreman-day, not the P&amp;L line.</div>' + bandTable : "");
      }

      /* ===================== THE MAP — TIER, BUDGET, AND WHO CAN REACH IT =====================
         Giga, 2026-09-20: the colour is the county's TIER; the tooltip carries the marketing
         BUDGET for that county and the MAX JOBS PER DAY it can take. His own Power BI already
         scored cities this way (City Target Score); the score is rebuilt on county aggregates in
         mart_area_county, with his four measurement bugs corrected -- see the mart's comment.

         THREE COLOURS, NOT FIVE. A five-tier assignment survives year to year only 33-40% of the
         time against 52-55% for three: tier bands 2-4 points wide cannot hold against a booking
         rate whose standard error is 7.6 points under 50 leads. T1/T2 = push, T3 = hold,
         T4/T5 = fix, plus grey for not-rated and a ring for no-crew-in-range. */
      let MAP_OUTSIDE = null;          // counties the mart holds that this map deliberately omits
      const TIER_BAND = t => (t === 0 ? "grey" : t <= 2 ? "push" : t === 3 ? "hold" : "fix");
      const TIER_LABEL = { push: "Push", hold: "Hold", fix: "Fix", grey: "Not rated" };
      /* the company's MEASURED jobs-a-foreman-day, chaining included (see CHAIN below);
         1.24 only as a floor if the model has no chaining block yet */
      function ensureLeaflet(cb) {
        if (window.L && window.L.map) { cb(); return; }
        if (!document.getElementById("apLeafCss")) {
          const lc = document.createElement("link");
          lc.id = "apLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
          document.head.appendChild(lc);
        }
        let sc = document.getElementById("apLeafJs");
        if (sc) { sc.addEventListener("load", () => cb()); return; }
        sc = document.createElement("script");
        sc.id = "apLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js";
        sc.onload = () => cb();
        document.head.appendChild(sc);
      }
      const tok = n => (getComputedStyle(document.body).getPropertyValue(n) || "").trim() || "#888";

      /* every county, with the three things the tooltip says. The budget follows LEADS: a county
         takes its share of its own state's planned marketing, which is how the state number was
         derived in the first place. No ad dollar carries geography, so this is a planned share. */
      function countyRowsFor() {
        if (!COUNTY.length) return [];
        const N = FC.year ? nextCalc() : null;
        const stBudget = {}, stLeads = {};
        if (N) N.rows.forEach(r => { const cpl = N.mkt.cplOf(r.st);
          stBudget[r.st] = cpl != null ? r.leads * cpl : null; });
        COUNTY.forEach(c => { stLeads[c.State] = (stLeads[c.State] || 0) + num(c.Leads); });
        const fleet = num((COUNTY[0] || {})["Foremen Company"]) || 0;
        const planFm = N ? N.tot.peak : fleet;
        const outside = COUNTY.filter(c => !SERVICE_AREAS.includes(c.State));
        MAP_OUTSIDE = { counties: outside.length,
                        leads: outside.reduce((a, c) => a + num(c.Leads), 0) };
        return COUNTY.filter(c => SERVICE_AREAS.includes(c.State)).map(c => {
          const share = stLeads[c.State] ? num(c.Leads) / stLeads[c.State] : 0;
          const b = stBudget[c.State];
          const jpd = chainOf(c.State);      // chaining is local: CT 1.30 vs DE 1.06
          const ceil = num(c["Foremen Within 60mi"]) * jpd;
          const fair = num(c["Capacity Share"]) * planFm * jpd;
          return { st: c.State, county: c.County, la: num(c.Latitude), lo: num(c.Longitude),
                   leads: num(c.Leads), jobs: num(c.Jobs), book: num(c["Booking Rate"]),
                   mi: num(c["Miles To Base"]), score: c.Score == null ? null : num(c.Score),
                   tier: num(c.Tier), band: TIER_BAND(num(c.Tier)),
                   budget: b != null ? b * share : null, share,
                   fm60: num(c["Foremen Within 60mi"]), ceil, fair,
                   uncovered: num(c.Uncovered) === 1 };
        }).filter(r => r.la && r.lo);
      }

      function mapHtml() {
        if (!COUNTY.length) return '<div class="panel">The county mart (mart_area_county) is not ' +
          'built yet — run <b>sources=mart_area_county</b> and reload.</div>';
        const R = countyRowsFor();
        const byBand = {}; R.forEach(r => { byBand[r.band] = (byBand[r.band] || 0) + 1; });
        const unc = R.filter(r => r.uncovered);
        const key = ["push", "hold", "fix", "grey"].map(b =>
          '<span class="ap2-mk"><i class="ap2-sw ' + b + '"></i>' + TIER_LABEL[b] +
          ' <b>' + (byBand[b] || 0) + '</b></span>').join("");
        return '<div class="ap2-mapkey">' + key +
          '<span class="ap2-mk"><i class="ap2-sw unc"></i>no crew within 60 mi <b>' + unc.length + "</b></span>" +
          '<span class="sp"></span><span class="ap2-note" style="margin:0">circle size = leads</span></div>' +
          '<div id="apMapBox" class="ap2-mapbox"></div>' +
          note("Colour is the county's tier, scored on distance to a base, booking rate, ticket and cubic feet — " +
               "his Power BI model, rebuilt on county totals. A county under 30 leads is <b>not rated</b> rather than " +
               "called bad. Click a county to focus the page on its state. " +
               "The dashed <b>no crew within 60 mi</b> ring is drawn off <b>" + esc(SIS.plan_company || "Zip to Zip") +
               "</b>'s register: Delaware rings empty although Tuji works it, because Tuji's crews are not ours to send. " +
               (MAP_OUTSIDE && MAP_OUTSIDE.counties
                 ? "<b>" + fmtN(MAP_OUTSIDE.counties) + "</b> further counties outside the eight states (" +
                   fmtN(MAP_OUTSIDE.leads) + " leads, nearly all long-distance pickups) are in the data and left off this map. "
                 : "") +
               go("apMethod", "How this is calculated"));
      }

      /* Size and frame the map against the container it actually has. Safe to call at any time:
         it does nothing until the box has been laid out, so the first real call is the pane show. */
      function fitMap() {
        const box = host.querySelector("#apMapBox");
        if (!box || !box._map || !box.clientWidth || !box.clientHeight) return;
        box._map.invalidateSize();
        if (box._fit && box._fit.length) box._map.fitBounds(box._fit, { padding: [26, 26] });
      }

      function wireMap() {
        const box = host.querySelector("#apMapBox"); if (!box || box._ap) return;
        box._ap = 1;
        ensureLeaflet(() => {
          const R = countyRowsFor(); if (!R.length) return;
          const m = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.5, attributionControl: false });
          /* CARTO NOW KEYS EVERY BASEMAP (2026-09-20) — voyager, light_all and dark_all all come
             back stamped "API KEY REQUIRED" across the tile. OpenStreetMap's own tiles need no key.
             They are busier than a data map wants, so the layer is dimmed and, in the dark theme,
             inverted: the ground goes quiet and the circles carry the meaning.
             cleanup.js and ld-planning.js were moved off voyager the same day. */
          const darkMap = !document.body.classList.contains("light");
          const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
                                    { maxZoom: 12, opacity: darkMap ? 1 : .62 });
          tiles.addTo(m);
          if (tiles.getContainer()) tiles.getContainer().style.filter = darkMap
            ? "grayscale(1) invert(1) brightness(.82) contrast(.9)" : "grayscale(.55)";
          const col = { push: tok("--pos") || "#5f7c20", hold: tok("--warn") || "#b97b0a",
                        fix: tok("--neg") || "#d43d55", grey: tok("--faint") || "#8a97a6" };
          const maxLeads = Math.max(1, ...R.map(r => r.leads));
          const pts = [];
          R.forEach(r => {
            const rad = 7 + 20 * Math.sqrt(r.leads / maxLeads);
            const c = L.circleMarker([r.la, r.lo], {
              radius: rad, color: r.uncovered ? col.fix : col[r.band],
              weight: r.uncovered ? 3 : 1.5, dashArray: r.uncovered ? "4 3" : null,
              fillColor: col[r.band], fillOpacity: r.band === "grey" ? .18 : .45 });
            c.bindTooltip(
              '<div class="ap2-tip"><b>' + esc(r.county) + " " + esc(r.st) + "</b>" +
              '<div class="t">' + (r.tier ? "Tier " + r.tier + " · " + TIER_LABEL[r.band] : "Not rated") +
                (r.score != null ? " · score " + r1(r.score) : "") + "</div>" +
              "<div>" + fmtN(r.leads) + " leads · " + r1(r.book) + "% booked · " + fmtN(r.jobs) + " jobs</div>" +
              "<div>" + r1(r.mi) + " mi to the nearest base</div>" +
              (r.budget != null ? '<div class="b">Marketing ' + money0(r.budget) + "<small> — " +
                 r1(r.share * 100) + "% of the state's leads</small></div>" : "") +
              '<div class="c">Max ' + r1(r.ceil) + " jobs/day if every crew in range came here" +
                "<small> — " + r.fm60 + " foremen within 60 mi, shared with its neighbours</small></div>" +
              '<div class="c">Fair share ' + r1(r.fair) + " jobs/day at today's dispatch pattern</div>" +
              (r.uncovered ? '<div class="w">No foreman is based within 60 miles of here</div>' : "") +
              "</div>", { sticky: true, className: "ap2-tipwrap" });
            c.on("click", () => setFocus(r.st));
            c.addTo(m); pts.push([r.la, r.lo]);
          });
          const ranked = R.slice().sort((a, b) => b.leads - a.leads);
          const wanted = ranked.reduce((a, r) => a + r.leads, 0) * 0.97;
          const fit = [];
          let acc = 0;
          for (const r of ranked) { if (acc >= wanted) break; acc += r.leads; fit.push([r.la, r.lo]); }
          box._fit = fit.length ? fit : pts;
          box._map = m;
          fitMap();                       // a no-op while the pane is hidden; showPane calls it again
        });
      }

      /* ===================== THE QUESTIONS, ANSWERED =====================
         His ask 2026-09-18: "i need the TOP of that seasonal planning to be the questions -
         and answers - and below to have the logic of how we got to this numbers." The nine
         questions are Giga's own (2026-09-09, docs/plans/2026-09-09-area-master-plan.md);
         every answer is computed from the same data the panels below are drawn from, and
         each carries the button that jumps to the panel showing how. A question the data
         cannot answer says so — an honest "not yet" beats a number nobody can stand behind. */
      /* ===================== THE DECISIONS, FIRST =====================
         His words 2026-09-19: "the main question in the end is how many crew we need in each
         state, how many sales, what marketing budget". Giga's nine are the evidence; these three
         are the decisions, so they open the page. Every number here is the Next-season card's
         own (same method picker, same dials) — this band computes nothing of its own, it only
         puts the answer where the eye lands, with the jump to the table that carries the working. */
      function decisionsHtml() {
        if (!FC.year) return "";
        const N = nextCalc(), PC = postcardBy();
        const mkt = N.rows.map(r => { const cpl = N.mkt.cplOf(r.st); const pc = PC[r.st];
          return { st: r.st, leads: r.leads, cpl, mkt: cpl != null ? r.leads * cpl : null, pc: pc && pc.cards && !pc.unknown ? pc.cost : 0 }; });
        const HS = mktHistory(N), lastS = HS.rows[HS.rows.length - 1];
        const mktTot = mkt.reduce((a, x) => a + (x.mkt || 0), 0), pcTot = mkt.reduce((a, x) => a + (x.pc || 0), 0);
        const crewLines = N.pools.map(q => "<tr><td><b>" + esc(q.label) + "</b></td><td class=\"num\"><b>" + q.peak + "</b></td><td class=\"num\">" + fmtN(q.have) +
          "</td><td class=\"num\">" + (q.hire ? '<b class="ap2-hire">+' + q.hire + "</b>" : '<span class="ap2-ok">covered</span>') + "</td><td>" + (q.hire && q.hireBy ? esc(dayLabel(q.hireBy)) : "—") + "</td></tr>").join("");
        const topM = mkt.filter(x => x.mkt).sort((a, b) => b.mkt - a.mkt);
        const mktLines = topM.slice(0, 5).map(x => "<tr><td><b>" + esc(x.st) + "</b></td><td class=\"num\">" + fmtN(x.leads) + "</td><td class=\"num\">" + money0(x.cpl) + "</td><td class=\"num\"><b>" + money0(x.mkt) + "</b></td></tr>").join("") +
          (topM.length > 5 ? "<tr><td>" + (topM.length - 5) + " more</td><td class=\"num\">" + fmtN(topM.slice(5).reduce((a, x) => a + x.leads, 0)) + "</td><td></td><td class=\"num\"><b>" + money0(topM.slice(5).reduce((a, x) => a + x.mkt, 0)) + "</b></td></tr>" : "");
        const S = N.sales;
        return '<div class="ap2-band" style="margin-top:6px;border-top:0;padding-top:0"><span class="k">The decisions</span>' +
          "<h2>Season " + esc(String(FC.year)) + " — crew, sales and marketing</h2>" +
          '<span class="clock">' + fmtN(N.tot.jobs) + " jobs forecast" +
          (N.tot.gross != null ? " · " + money0(N.tot.gross - mktTot) + " net before overhead" : "") + "</span></div>" +
          '<div class="ap2-dec">' +
            '<div class="ap2-d"><div class="dq">How many crews, and where?</div><div class="dh"><b>' + N.tot.peak + " foremen</b> at the peak · have " + fmtN(N.tot.have) +
              (N.tot.hire ? ' · <span class="ap2-hire">hire +' + N.tot.hire + "</span>" : ' · <span class="ap2-ok">covered</span>') +
              (() => { const spare = N.pools.filter(q => q.have > q.peak); return N.tot.hire && spare.length
                ? ' <span style="font-size:12px">· ' + spare.map(q => (q.have - q.peak) + " spare in " + esc(q.label)).join(", ") + " — a pool's spare crews do not cover another depot</span>" : ""; })() + "</div>" +
              '<table class="ap2-dt"><thead><tr><th>Depot pool</th><th class="num">Need</th><th class="num">Have</th><th class="num">Hire</th><th>By</th></tr></thead><tbody>' + crewLines + "</tbody></table>" +
              '<div class="dx">Each foreman runs with ' + (N.crew.helpers || 0) + " helper and " + (N.crew.drivers || 0) + " driver: <b>" + fmtN(N.tot.helpers) + "</b> helpers, <b>" + fmtN(N.tot.drivers) + "</b> drivers, <b>" + fmtN(N.tot.trucks) + "</b> trucks" +
              (N.rentTrucks ? " (" + fmtN(N.owned) + " owned, <b>" + fmtN(N.rentTrucks) + " rented</b>)" : "") + ".</div>" + go("apFullCrew", "Crews state by state") + "</div>" +
            '<div class="ap2-d"><div class="dq">How many salespeople, and when?</div><div class="dh"><b>' + S.peak + " salespeople</b> at the peak in " + esc(String(S.peakWhen || "").split(" ")[0]) +
              (S.active ? " · " + fmtN(S.active) + " carried a full load last season" : "") + "</div>" +
              /* this card used to carry one line and 45% white space (w1264_00.png); the desk it is
                 answering for is four rows, so it shows them */
              '<table class="ap2-dt"><thead><tr><th>Month worked</th><th class="num">Leads to work</th><th class="num">People</th><th class="num">vs last</th></tr></thead><tbody>' +
              S.desk.filter(x => !x.shoulder).map(x => "<tr><td><b>" + esc(x.when) + "</b></td><td class=\"num\">" + fmtN(x.leads) +
                "</td><td class=\"num\"><b>" + x.reps + "</b></td><td class=\"num\">" +
                (S.active && x.reps > S.active ? '<span class="ap2-hire">+' + (x.reps - S.active) + "</span>" : '<span class="ap2-ok">ok</span>') + "</td></tr>").join("") +
              "</tbody></table>" +
              '<div class="dx">Leads land about ' + (FC.lead_lag_months || 1) + " month before the move, so the desk peaks ahead of the crews. Sized at <b>" + fmtN(S.lpr) + "</b> leads per salesperson a month, counted on <b>every lead marketing buys</b>" +
              (() => { const d = deadRate(N.mkt.coreLeadYms); return d
                ? " — " + r1(d.pct) + "% of which were dead on arrival last season (" + fmtN(d.dead) + " of " + fmtN(d.leads) + "). That share tripled in 2026, so it is tracked beside the load, never inside it" : ""; })() +
              ".</div>" + go("apFullSales", "The desk month by month") + "</div>" +
            '<div class="ap2-d"><div class="dq">What is the marketing budget?</div><div class="dh"><b>' + money0(mktTot) + "</b> for " + fmtN(N.tot.leads) + " leads" +
              (lastS ? " · " + (mktTot >= lastS.spend ? "+" : "") + Math.round((mktTot / lastS.spend - 1) * 100) + "% on " + lastS.y + "'s " + money0(lastS.spend) : "") + "</div>" +
              '<table class="ap2-dt"><thead><tr><th>State</th><th class="num">Leads</th><th class="num">$ / lead</th><th class="num">Budget</th></tr></thead><tbody>' + mktLines + "</tbody></table>" +
              '<div class="dx">All advertising, <b>post cards included</b>' + (pcTot ? " — about " + money0(pcTot) + " of it, at last season's usage" : "") + ". " +
              (N.mkt.perJobLast ? "<b>" + money0(mktTot / Math.max(1, N.tot.jobs)) + " a job</b>: what a job cost last season in the states the plan covers."
                                : (N.mkt.measured ? "Priced at the <b>$" + r1(N.mkt.cplActual) + "</b> a lead really cost last season." : "")) +
              "</div>" + go("apFullMkt", "Budget, leads and history") + "</div>" +
          "</div>";
      }

      /* ===================== THE FULL PLAN, STATE BY STATE =====================
         His ask 2026-09-19: "do the full plan by states for foreman - where how many crews we should
         have - then do the plan for sales, and marketing budgets and leads by states". Three tables, all
         read off nextCalc() so they can never disagree with the decisions band or the Next-season card:
         crews by state and month; the sales desk by month with each state's share of its work; leads and
         marketing dollars by state and month (in the month the money is SPENT — leads land a lag-month
         before the move). Every table gets the page's CSV button. */
      function fullPlanHtml() {
        if (!FC.year) return "";
        const N = nextCalc(), PC = postcardBy();
        const mL = ym => MONTH_NAMES[+ym.slice(5, 7)].slice(0, 3);
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>", td = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        /* MA showed "MA depot" beside 0 foremen and 21 jobs: it has no crew of its own, its pool's
           do the work. A state that carries no foreman at peak names the state that runs it. */
        const POOL_HOME = { NJ: "NJ", NY: "NJ", PA: "PA", DE: "DE", CT: "CT", MA: "CT", MD: "DE / PA", VA: "DE / PA" };
        const baseOf = r => (r.fmPeak > 0 && POOL_HOME[r.st] === r.st) ? r.st + " depot"
          : "from " + (POOL_HOME[r.st] || "—");
        const dim = '<span class="ap2-dim">—</span>';
        // ---- crews
        const crewRows = N.pools.map(q => N.rows.filter(r => q.states.includes(r.st)).map(r => { const gap = r.fmPeak - r.have;
            return "<tr>" + td("<b>" + esc(r.st) + "</b>", "strong") + td(esc(baseOf(r)), "") +
              N.months.map(ym => { const c = r.cells.find(x => x.ym === ym) || {}; return '<td class="num' + (c.shoulder ? " ap2-sh" : "") + '" title="' + fmtN(c.jobs || 0) + ' jobs">' +
                  (c.jobs ? "<b>" + (c.fm ? c.fm : "&lt;1") + "</b>" : dim) + "</td>"; }).join("") +
              td(r.fmPeak ? "<b>" + r.fmPeak + "</b>" : '<span class="ap2-dim" title="its pool\'s crews run these jobs">run from ' + esc(POOL_HOME[r.st] || "the pool") + "</span>") +
              td(fmtN(r.have)) + td(!r.fmPeak && r.jobs ? '<span class="ap2-dim">—</span>' : gap > 0 ? '<b class="ap2-hire">+' + gap + "</b>" : gap < 0 ? '<span class="ap2-dim">' + gap + " spare</span>" : '<span class="ap2-ok">ok</span>') +
              td(fmtN(r.fmHelpers)) + td(fmtN(r.fmDrivers)) + td(fmtN(r.fmTrucks)) + td(fmtN(r.jobs)) + "</tr>"; }).join("") +
          '<tr class="ap2-pool">' + td("<b>" + esc(q.label) + "</b>", "strong") + td('<span class="ap2-dim">pool · peaks in ' + (q.peakYm ? MONTH_NAMES[+q.peakYm.slice(5, 7)] : "—") + "</span>", "") +
            q.cells.map(c => '<td class="num' + (c.shoulder ? " ap2-sh" : "") + '">' + (c.jobs ? "<b>" + c.need + "</b>" : dim) + "</td>").join("") +
            td("<b>" + q.peak + "</b>") + td(fmtN(q.have) + (q.worked && q.worked !== q.have ? '<small title="foremen whose home was this pool last season, counted once"> · ran ' + fmtN(q.worked) + "</small>" : "")) +
            td((q.hire ? '<b class="ap2-hire">+' + q.hire + "</b>" : '<span class="ap2-ok">covered</span>') +
               (q.hire && q.hireBy ? '<small> by ' + esc(dayLabel(q.hireBy)) + "</small>" : "")) +
            td(fmtN(q.helpers)) + td(fmtN(q.drivers)) + td(fmtN(q.trucks)) + td("") + "</tr>").join("");
        const crewT = '<table data-name="Crews by state and month" class="rs-table ap2-next"><thead><tr>' + th("State", "") + th("Crews run from", "") + N.months.map(ym => th(mL(ym), "num" + (N.core.includes(ym) ? "" : " ap2-sh"))).join("") +
          th("Foremen at peak") + th('Have<small title="foremen who ran jobs here last season"> · ran last season</small>') + th("Hire / spare · by") + th("Helpers") + th("Drivers") + th("Trucks") + th("Season jobs") + "</tr></thead><tbody>" + crewRows +
          '<tr class="ap2-tot">' + td("<b>All states</b>", "strong") + td("", "") + N.months.map(ym => td("<b>" + N.pools.reduce((a, q) => a + ((q.cells.find(c => c.ym === ym) || {}).need || 0), 0) + "</b>", "num" + (N.core.includes(ym) ? "" : " ap2-sh"))).join("") +
          td("<b>" + N.tot.peak + "</b>" + (() => { const busiest = Math.max(0, ...N.core.map(ym => N.pools.reduce((a, q) => a + ((q.cells.find(c => c.ym === ym) || {}).need || 0), 0)));
            return busiest && busiest !== N.tot.peak ? '<small title="each pool peaks in a different month, so the hire total is the sum of those peaks"> · busiest single month ' + busiest + "</small>" : ""; })()) +
          td(fmtN(N.tot.have)) + td(N.tot.hire ? '<b class="ap2-hire">+' + N.tot.hire + "</b>" : "—") + td(fmtN(N.tot.helpers)) + td(fmtN(N.tot.drivers)) + td(fmtN(N.tot.trucks)) + td("<b>" + fmtN(N.tot.jobs) + "</b>") + "</tr></tbody></table>";
        // ---- sales: the desk by month, and whose leads it is working
        const S = N.sales, stLeads = (r, ym) => ((r.cells.find(c => c.ym === ym) || {}).leads_needed) || 0;
        const salesT = '<table data-name="The sales desk by month" class="rs-table ap2-next"><thead><tr>' + th("Leads worked for", "") + S.desk.map(x => th(esc(x.when.slice(0, 3)) + "<small> → " + mL(x.forYm) + " jobs</small>", "num" + (x.shoulder ? " ap2-sh" : ""))).join("") + th("Season leads") + th("Share of the desk") + "</tr></thead><tbody>" +
          N.rows.filter(r => r.leads).map(r => "<tr>" + td("<b>" + esc(r.st) + "</b>", "strong") + S.desk.map(x => '<td class="num' + (x.shoulder ? " ap2-sh" : "") + '">' + (stLeads(r, x.forYm) ? fmtN(stLeads(r, x.forYm)) : dim) + "</td>").join("") +
            td(fmtN(r.leads)) + td(N.tot.leads ? pct(r.leads / N.tot.leads) : "—") + "</tr>").join("") +
          '<tr class="ap2-tot">' + td("<b>All leads</b>", "strong") + S.desk.map(x => td("<b>" + fmtN(x.leads) + "</b>", "num" + (x.shoulder ? " ap2-sh" : ""))).join("") + td("<b>" + fmtN(N.tot.leads) + "</b>") + td("100%") + "</tr>" +
          '<tr class="ap2-pool">' + td("<b>Salespeople needed</b>", "strong") + S.desk.map(x => '<td class="num' + (x.shoulder ? " ap2-sh" : "") + '"><b>' + x.reps + "</b></td>").join("") + td("<b>peak " + S.peak + "</b>") + td(fmtN(S.lpr) + " / rep") + "</tr></tbody></table>";
        // ---- marketing: leads to buy and dollars, by state and the month the money is spent
        const cplOf = r => N.mkt.cplOf(r.st);
        const mkT = '<table data-name="Marketing budget by state" class="rs-table ap2-next"><thead><tr>' + th("State", "") + th("$ / lead") + S.desk.map(x => th(esc(x.when.slice(0, 3)), "num" + (x.shoulder ? " ap2-sh" : ""))).join("") + th("Season leads") + th("Leads / job") + th("Marketing") + th('Post cards mailed there<small> 2026 actual</small>') + "</tr></thead><tbody>" +
          N.rows.filter(r => r.leads).map(r => { const cpl = cplOf(r), pc = PC[r.st], pcCost = pc && pc.cards && !pc.unknown ? pc.cost : 0, mk = cpl != null ? r.leads * cpl : null;
            return "<tr>" + td("<b>" + esc(r.st) + "</b>", "strong") + td(cpl != null ? money0(cpl) : "—") +
              S.desk.map(x => { const l = stLeads(r, x.forYm); return '<td class="num' + (x.shoulder ? " ap2-sh" : "") + '" title="' + fmtN(l) + ' leads">' + (l && cpl != null ? money0(l * cpl) : dim) + "</td>"; }).join("") +
              td(fmtN(r.leads)) + td(r.leadsPerJob != null ? '<span title="' + (r.lpjOwn ? "this state's own ratio last season" : "too few jobs here — the company ratio") + '">' + r1(r.leadsPerJob) + (r.lpjOwn ? "" : "*") + "</span>" : "—") +
              td(mk != null ? "<b>" + money0(mk) + "</b>" : "—") + td(pcCost ? '<span class="ap2-dim">' + money0(pcCost) + "</span>" : dim) + "</tr>"; }).join("") +
          (() => { const rowsL = N.rows.filter(r => r.leads), tot = ym => rowsL.reduce((a, r) => a + (cplOf(r) != null ? stLeads(r, ym) * cplOf(r) : 0), 0);
            const mkAll = rowsL.reduce((a, r) => a + (cplOf(r) != null ? r.leads * cplOf(r) : 0), 0), pcAll = rowsL.reduce((a, r) => { const pc = PC[r.st]; return a + (pc && pc.cards && !pc.unknown ? pc.cost : 0); }, 0);
            return '<tr class="ap2-tot">' + td("<b>All states</b>", "strong") + td(N.tot.leads && mkAll ? "$" + r1(mkAll / N.tot.leads) : "") + S.desk.map(x => td("<b>" + money0(tot(x.forYm)) + "</b>", "num" + (x.shoulder ? " ap2-sh" : ""))).join("") + td("<b>" + fmtN(N.tot.leads) + "</b>") + td(N.tot.jobs ? r1(N.tot.leads / N.tot.jobs) : "") + td("<b>" + money0(mkAll) + "</b>") + td('<span class="ap2-dim">' + money0(pcAll) + "</span>") + "</tr>"; })() +
          "</tbody></table>";
        return '<div id="apFull">' +
          '<h3 class="ap2-sech" id="apFullCrew">1 · Crews — where, and how many</h3>' +
          note("Foremen per state and month. The shaded pool rows are what you hire against; the states add up to them. Each foreman carries " + (N.crew.helpers || 0) + " helper, " + (N.crew.drivers || 0) + " driver and " + (N.crew.trucks || 0) + " truck. <b>Have</b> is typed on the " + goLink("apBase", "foreman table") + ". " + go("apMethod", "How this is calculated")) +
          '<div style="overflow-x:auto">' + crewT + "</div>" +
          '<h3 class="ap2-sech" id="apFullSales">2 · Sales — the desk, month by month</h3>' +
          note("Each column is the month the leads are <b>worked</b>, for the jobs a month later. Sales is one desk, so a state is a share of its work, not a team. Shaded columns are the shoulders, outside the season totals. " + go("apMethod", "How this is calculated")) +
          '<div style="overflow-x:auto">' + salesT + "</div>" +
          '<h3 class="ap2-sech" id="apFullMkt">3 · Marketing — leads to buy and the budget, by state</h3>' +
          mktHistoryHtml(N) +
          note("Dollars in the month they are <b>spent</b> (hover a cell for the leads). <b>Leads</b> are every lead, good or bad: forecast jobs × the leads each job took last season (a * marks a state too small for its own ratio)" + (N.mkt.held ? ", lifted " + (Math.round((N.mkt.floorF - 1) * 1000) / 10) + "% so the season is not planned cheaper per job than the last one was" : "") + ". <b>$ / lead</b> is the whole advertising ledger over those leads, so the total is what was really spent, scaled to the jobs; the split between states follows each state's source mix, because no ad spend is recorded by state. <b>Post cards are inside the budget</b> — the last column only shows how much of it they were. <b>Shaded months are the shoulders</b> (April and September jobs): shown so the ramp is visible, left out of the season totals on the right.") +
          '<div style="overflow-x:auto">' + mkT + "</div></div>";
      }

      /* WHAT THE SEASON COST BEFORE — the plan beside the ledger (his question 2026-09-19: "compare the
         budgets with previous years budgets, are we decreasing it?"). Same months every year: the months
         the season's leads are bought in. Advertising is the whole ledger (Zip to Zip, post cards
         included); leads are every lead created in those months; jobs are the season's closings. */
      function mktHistory(N) {
        const lag = FC.lead_lag_months || 1, moveM = N.core.map(ym => +ym.slice(5, 7));
        const yrs = []; for (let y = FC.year - 3; y < FC.year; y++) yrs.push(y);
        const pad2 = n => String(n).padStart(2, "0");
        const out = yrs.map(y => { let spend = 0, leads = 0, jobs = 0, seen = 0;
          moveM.forEach(m => { const d = new Date(y, m - 1 - lag, 1), lm = d.getFullYear() + "-" + pad2(d.getMonth() + 1), mm = y + "-" + pad2(m);
            if ((MKT[lm] || {}).ad_spend) seen++;
            spend += (MKT[lm] || {}).ad_spend || 0; leads += (MKT[lm] || {}).leads || 0; jobs += ((CAPM[mm] || {})._national || {}).jobs || 0; });
          return { y, spend, leads, jobs, full: seen === moveM.length }; }).filter(r => r.spend > 0 && r.jobs > 0);
        const planMkt = N.rows.reduce((a, r) => a + (N.mkt.cplOf(r.st) != null ? r.leads * N.mkt.cplOf(r.st) : 0), 0);
        return { rows: out, plan: { y: FC.year, spend: planMkt, leads: N.tot.leads, jobs: N.tot.jobs } };
      }
      function mktHistoryHtml(N) {
        const H = mktHistory(N); if (!H.rows.length) return "";
        const last = H.rows[H.rows.length - 1], P2 = H.plan;
        const chg = (a, b) => (b ? '<span class="' + (a >= b ? "ap2-ok" : "ap2-hire") + '">' + (a >= b ? "+" : "") + Math.round((a / b - 1) * 100) + "%</span>" : "—");
        const td = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const line = (r, plan) => "<tr" + (plan ? ' class="ap2-pool"' : "") + ">" + td((plan ? "<b>" + r.y + " plan</b>" : String(r.y)) + (r.full === false ? ' <span class="ap2-dim" title="the ledger does not cover every month of this window">partial</span>' : ""), "strong") +
          td(plan ? "<b>" + money0(r.spend) + "</b>" : money0(r.spend)) + td(fmtN(r.leads)) + td(r.leads ? "$" + r1(r.spend / r.leads) : "—") + td(fmtN(r.jobs)) + td(r.jobs ? "<b>" + money0(r.spend / r.jobs) + "</b>" : "—") +
          td(plan ? chg(r.spend, last.spend) : "") + td(plan ? chg(r.jobs, N.mkt.jobsLast || last.jobs) : "") + "</tr>";
        const mo = N.mkt.coreLeadYms.map(m => MONTH_NAMES[+m.slice(5, 7)].slice(0, 3));
        return '<div class="ap2-note" style="margin:0 0 6px"><b>The plan beside what was actually spent.</b> Advertising in the months the season\'s leads are bought (' + esc(mo[0] + "–" + mo[mo.length - 1]) +
          "), the whole ledger, post cards included; leads are every lead created in those months; jobs are that season's closings. " +
          (N.mkt.measured ? "The " + FC.year + " budget is last season's spend carried forward for the forecast jobs — so it moves with the jobs, never below what a job has cost." +
                            (N.mkt.held ? " Built state by state it came to " + money0(N.mkt.builtMkt) + " (" + money0(N.mkt.builtMkt / Math.max(1, N.tot.jobs)) + " a job), only because the states forecast to grow fastest are the ones the attribution calls cheap; that saving is not measured anywhere, so every state's leads are lifted by " + (Math.round((N.mkt.floorF - 1) * 1000) / 10) + "% and the season is held at last season's " + money0(N.mkt.perJobLast) + " of advertising per job." : "")
                          : "The advertising ledger has no spend for last season's lead months, so the budget falls back to the Area Master's attributed cost per lead.") + "</div>" +
          (N.mkt.jobsLast && last.jobs && N.mkt.jobsLast !== last.jobs ? '<div class="ap2-note" style="margin:0 0 6px">The seasons count every closing; the plan covers the states it forecasts, which ran <b>' + fmtN(N.mkt.jobsLast) + "</b> of " + last.y + "'s " + fmtN(last.jobs) + " jobs — <i>Jobs vs last</i> and the per-job floor are measured against those, like for like.</div>" : "") +
          '<table data-name="Advertising, season by season" class="rs-table ap2-next ap2-below-tabs" style="max-width:860px"><thead><tr><th>Season</th><th class="num">Advertising</th><th class="num">Leads</th><th class="num">$ / lead</th><th class="num">Season jobs</th><th class="num">$ per job</th><th class="num">Budget vs last</th><th class="num">Jobs vs last</th></tr></thead><tbody>' +
          H.rows.map(r => line(r, false)).join("") + line(P2, true) + "</tbody></table>";
      }

      function asksHtml() {
        const C2 = inputs.city || {};
        const cityRows = CITYALL || [];
        const nCity = cityRows.length;
        const has = (col) => cityRows.filter(r => r[col] != null && r[col] !== "").length;
        const sum = (col) => cityRows.reduce((a, r) => a + num(r[col]), 0);
        const leadsTot = sum("Leads"), revTot = sum("Revenue");
        const adTot = cityRows.reduce((a, r) => a + adCost(r), 0);
        const adMeas = cityRows.reduce((a, r) => a + adGoogle(r), 0);
        const nMeas = cityRows.filter(adIsMeasured).length;
        const win = C2.window === "season" ? "the last season" : "this year to date";
        const wsAll = (WSALL || []).length;
        const wsNever = (WSALL || []).filter(r => +r["Never A Lead"] === 1).length;
        const baseMiles = (() => { const v = cityRows.map(r => num(r["Miles To Base"])).filter(x => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; })();
        const fmAtBase = has("Foremen At Base");
        // the best preset depot the plan scored, for the one-line answer on distance
        const dep0 = ((DEP.candidates || []).filter(c => c.saved_mi_per_job > 0)
          .sort((a, b) => b.saved_mi_per_job - a.saved_mi_per_job)[0]) || null;
        const chip = (k, t) => '<span class="ap2-chip ' + k + '">' + t + "</span>";
        const Q = [
          { n: 1, q: "City — one row per area, for planning and for marketing",
            st: ["y", "answered"],
            a: "<b>" + fmtN(nCity) + "</b> cities carry leads in " + win + ", each with its county, its nearest base and its own demand. The plan above decides by state; this table is the detail underneath it.",
            go: "apCityTable" },
          { n: 2, q: "ROI per area",
            st: nMeas ? ["y", "measured"] : adTot > 0 ? ["p", "estimated"] : ["n", "not yet"],
            a: revTot ? "<b>$" + r1(leadsTot ? revTot / leadsTot : 0) + "</b> of revenue per lead across " + fmtN(has("Revenue")) + " cities" +
                 (adTot > 0 ? ", and <b>$" + r1(adTot ? revTot / adTot : 0) + "</b> of revenue per ad dollar across every channel. " +
                   (nMeas ? "Of that spend, <b>" + money0(adMeas) + "</b> on <b>" + fmtN(nMeas) + "</b> cities is what Google Ads charged us; the rest — Angi, Yelp, post cards — is attributed from what each source costs per lead." : "The ad dollar is <b>attributed</b>, not measured.") : ".")
               : "No revenue in this window.",
            go: "apRank" },
          { n: 3, q: "Incoming leads, and which source we are on in that area",
            st: ["y", "answered"],
            a: "<b>" + fmtN(leadsTot) + "</b> leads in " + win + "; the top three sources are named per city on <b>" + fmtN(has("Lead Source Mix")) + "</b> of them.",
            go: "apCityTable" },
          { n: 4, q: "Allocated ad budget per area",
            st: nMeas ? ["y", "measured"] : adTot > 0 ? ["p", "estimated"] : ["n", "not yet"],
            a: "<b>" + money0(adTot) + "</b> for " + win + " across every channel, of which <b>" + money0(adMeas) + "</b> is <b>measured</b> — Google Ads' own charge for " + fmtN(nMeas) + " cities, now 13 months deep. The rest is attributed (leads × the source's cost per lead): Meta reports by region only, and Angi and Yelp price per lead.",
            go: "apBudget" },
          { n: 5, q: "Where the richer areas are, the big houses, where the market is heading",
            st: has("Median Income") ? ["y", "answered"] : ["n", "not yet"],
            a: "Census and Zillow, per city: income on <b>" + fmtN(has("Median Income")) + "</b>, home value on <b>" + fmtN(has("Home Value")) + "</b>, and how many households moved last year on <b>" + fmtN(has("Mover Rate")) + "</b>. Wealth tier ranks every city into fifths. Not an opinion from a chatbot — published statistics.",
            go: "apCityTable" },
          { n: 6, q: "SEO — where the demand is on the web, and in what volume",
            st: has("Search Volume") ? ["y", "answered"] : ["n", "not yet"],
            a: has("Search Volume") ? "Search volume on <b>" + fmtN(has("Search Volume")) + "</b> cities, summed over the moving phrases that name the city."
                 : "<b>Not answered yet.</b> Google will not run Keyword Planner through our API connection, so the volumes come in as a file from the Planner itself — the upload is at the bottom of this page. Search Console is connected, but it has no city in it: it says what people type to find <i>us</i>, not where the demand is.",
            go: "apKw" },
          { n: 7, q: "Distance from the nearest base",
            st: ["y", "answered"],
            a: baseMiles == null ? "No distances in this window." :
               "Average <b>" + r1(baseMiles) + " miles</b> from a city to its nearest base, straight-line. Today the jobs run <b>" + (DEP.baseline ? r1(DEP.baseline.mi_per_job) + " miles per job" : "—") + "</b> from " + ((DEP.baseline || {}).bases || []).length + " bases" +
               (dep0 ? ", and a depot in <b>" + esc(dep0.label || dep0.zip) + "</b> would save <b>" + r1(dep0.saved_mi_per_job) + " miles a job</b>." : "."),
            go: "apDepot" },
          /* ANSWERED 2026-09-20. The crew sheet always held two bases — the one state a person is
             based in, and the list of states they may be sent to — and only the first was carried
             into the warehouse. The page then ran a borrowing map on top (NY from NJ, DE from PA,
             MA from CT), which showed the same eighteen foremen as thirty-six. Both columns are now
             read: based there, and allowed to work there. */
          { n: 8, q: "How many foremen sit at the nearest base, and who can be sent there",
            st: fmAtBase ? ["y", "answered"] : ["n", "not yet"],
            a: (() => { const byBase = {};
              cityRows.forEach(r => { const b = r["Nearest Base"]; if (!b || byBase[b]) return;
                byBase[b] = { based: num(r["Foremen At Base"]) || 0, can: num(r["Foremen Can Work"]) || 0 }; });
              const ks = Object.keys(byBase).sort((a, b) => byBase[b].can - byBase[a].can);
              const gap = ks.filter(k => byBase[k].can === 0);
              return "Counted for <b>" + fmtN(fmAtBase) + "</b> cities, on both bases the crew sheet keeps: " +
                ks.map(k => "<b>" + esc(k) + "</b> " + byBase[k].based + " based, " + byBase[k].can + " may work").join(" · ") + ". " +
                (gap.length ? "<b>" + gap.map(esc).join(", ") + "</b> has nobody permitted to work there at all. " +
                     "That is a real gap in <b>" + esc(SIS.plan_company || "Zip to Zip") + "</b>'s register and not a reporting one — " +
                     "but it is not a gap in the business: Tuji works Delaware and ran it half-and-half with us this year. " +
                     "What a crew of our own there would buy is the second job of the day, not the first. " + goLink("apSister", "Beside the plan")
                            : "Every base has somebody permitted to work it."); })(),
            go: "apBase" },
          { n: 9, q: "The areas inside our territory where we have done nothing",
            st: wsAll ? ["y", "answered"] : ["n", "not yet"],
            a: wsAll ? "<b>" + fmtN(wsAll) + "</b> zips sit within 35 miles of a base, and <b>" + fmtN(wsNever) + "</b> of them have never sent us a single lead. They are ranked by home value, movers per year and distance."
                     : "The territory list is not built in this window.",
            go: "apWs" },
        ];
        return '<div class="ap2-band" style="margin-top:6px;border-top:0;padding-top:0"><span class="k">The questions</span>'
          + "<h2>What was asked, and what the data answers</h2>"
          + '<span class="clock">Giga\'s nine, 9 September · everything below this is how each number was reached</span></div>'
          + '<div class="ap2-qa">' + Q.map(x =>
              '<div class="ap2-q"><div class="qh"><span class="qn">' + x.n + "</span>" + chip(x.st[0], x.st[1]) + "</div>"
              + '<div class="qq">' + esc(x.q) + '</div><div class="qa">' + x.a + "</div>"
              + '<button type="button" class="ap2-goto" data-goto="' + x.go + '">Show me how ↓</button></div>').join("")
          + "</div>";
      }

      function wireAsks() {
        host.querySelectorAll("button[data-goto]").forEach(b => {
          b.onclick = () => { const el = host.querySelector("#" + b.dataset.goto);
            if (!el) return;
            const det = el.closest("details"); if (det) det.open = true;      // a reference block is closed until asked for
            /* THE TARGET MAY LIVE IN ANOTHER PANE (2026-09-20). getBoundingClientRect() on a hidden
               element is all zeroes, so the pane is shown BEFORE anything is measured. */
            const pn = el.closest("[data-ap-pane]");
            if (pn && pn.hidden) showPane(pn.dataset.apPane, true);
            /* THE PORTAL SCROLLS AN INNER CONTAINER (.rs-content), and scrollIntoView does not move
               it when the target sits inside a panel that has its own overflow — verified live on
               2026-09-18: the highlight fired, the page stayed put. So the offset is computed and
               that container is scrolled directly; scrollIntoView stays as the fallback. */
            const sc = el.closest(".rs-content") || document.scrollingElement;
            if (sc && sc.scrollHeight > sc.clientHeight + 4) {
              /* AND `scrollTo({behavior:"smooth"})` on that container does nothing either (verified
                 live: the position never moved, while assigning scrollTop jumped straight there).
                 So the glide is animated by hand — one rAF loop, 420ms, ease-out. */
              const from = sc.scrollTop;
              const to = Math.max(0, Math.min(sc.scrollHeight - sc.clientHeight,
                el.getBoundingClientRect().top - sc.getBoundingClientRect().top + from - 90));
              const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
              const t0 = performance.now(), dur = 420;
              let stepped = false;
              const step = now => { stepped = true; const k = still ? 1 : Math.min(1, (now - t0) / dur);
                sc.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3));
                if (k < 1) requestAnimationFrame(step); };
              requestAnimationFrame(step);
              // a hidden or throttled tab never runs a frame — land on the target anyway
              setTimeout(() => { if (!stepped) sc.scrollTop = to; }, 250);
            } else el.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
            try { el.setAttribute("tabindex", "-1"); el.focus({ preventScroll: true }); } catch (e) {}
            if (!matchMedia("(prefers-reduced-motion: reduce)").matches) el.style.transition = "box-shadow .4s";
            el.style.boxShadow = "0 0 0 3px var(--brand-glow)"; setTimeout(() => { el.style.boxShadow = ""; }, 1600); };
        });
      }


      /* ===================== EVERY TABLE: PAGED, AND DOWNLOADABLE =====================
         His rule 2026-09-18: "if we have tables - make sure its damn paginated with download
         options". One treatment for the whole page instead of nine hand-built ones: after each
         paint, every `.rs-table` gets a CSV button built from its own rendered rows, and any
         table longer than the page size gets a pager. Rows are HIDDEN, never dropped, so the
         CSV is always the whole table and a re-sort cannot fall out of step with it.
         Opt out where a panel already owns both: `data-noenh` (the city table's own pager and
         full-dataset CSV), `data-nocsv`, `data-nopage` (a deliberate top-N list). */
      const ENH_PAGE = 25;
      function csvCell(x) { let v = String(x == null ? "" : x).replace(/\s+/g, " ").trim();
        if (/^[=+\-@]/.test(v)) v = " " + v; return '"' + v.replace(/"/g, '""') + '"'; }
      function tableCsv(tbl, name) {
        const head = [...tbl.querySelectorAll("thead tr")].slice(-1)[0];
        const cols = head ? [...head.children].map(th => csvCell(th.innerText)) : [];
        const body = [...tbl.querySelectorAll("tbody tr")].filter(tr => !tr.classList.contains("ap2-nodata"))
          .map(tr => [...tr.children].map(td => csvCell(td.innerText)).join(","));
        const blob = new Blob(["\ufeff" + [cols.join(",")].concat(body).join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = ("Seasonal Planning - " + (name || "table") + (inputs.focus ? " - " + inputs.focus : "")).slice(0, 90) + ".csv";
        a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
      /* A TABLE NAMES ITS OWN DOWNLOAD (2026-09-20). The name used to be scraped from the nearest
         panel title, so the four tables of the full plan all downloaded under one twelve-word filename
         and any heading renamed tonight would silently rename a file somebody files every season. */
      function tableName(tbl) {
        if (tbl.dataset.name) return tbl.dataset.name;
        const card = tbl.closest(".panel") || tbl.parentElement;
        const det = tbl.closest("details"), sum = det && det.querySelector("summary");
        const t = (card && (card.querySelector(".panel-title") || card.querySelector("h3"))) || sum;
        return (t ? t.innerText : "table").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
      }
      /* THE BAR BELONGS TO ITS TABLE, NOT TO THE BLOCK AROUND IT (2026-09-20).
         `tbl.parentElement` is the right anchor only when the table is the single child of a wrapper.
         Inside #apFull it is the whole section, so the history table's "4 rows · Download CSV" was
         emitted at the TOP of the block, above "1 · Crews" — a bar that names a table nine hundred
         pixels below it. Inside #apRank's grid the bar became a grid ITEM, which is the empty half of
         that panel. And a bar placed outside a node that repaints survives the repaint: every dial
         keystroke rebuilds #apNext and left another bar behind. Now: the closest real wrapper, else a
         lone parent, else the table itself — always inside what repaints — and a sweep removes any bar
         whose table is gone. `_tbl` is what distinguishes our bars from the hand-built pagers. */
      function enhanceTables() {
        host.querySelectorAll(".ap2-tt,.ap2-pager").forEach(n => { if (n._tbl && !n._tbl.isConnected) n.remove(); });
        host.querySelectorAll("table.rs-table").forEach(tbl => {
          if (tbl.closest("[data-noenh]") || tbl.dataset.enh) return;
          tbl.dataset.enh = "1";
          const wrap = tbl.closest(".rs-tablewrap")
            || (tbl.parentElement && tbl.parentElement.children.length === 1 ? tbl.parentElement : tbl);
          const rows = [...tbl.querySelectorAll("tbody tr")].filter(tr => !tr.classList.contains("ap2-nodata"));
          const noCsv = !!tbl.closest("[data-nocsv]"), noPage = !!tbl.closest("[data-nopage]");
          const pages = noPage ? 1 : Math.max(1, Math.ceil(rows.length / ENH_PAGE));
          if (noCsv && pages < 2) return;
          const bar = document.createElement("div"); bar.className = "ap2-tt";
          bar.innerHTML = '<span class="n">' + RS.fmtN(rows.length) + (rows.length === 1 ? " row" : " rows") + "</span>";
          if (!noCsv) { const b = document.createElement("button"); b.className = "rs-btn"; b.type = "button";
            b.textContent = "Download CSV"; b.onclick = () => tableCsv(tbl, tableName(tbl)); bar.appendChild(b); }
          bar._tbl = tbl;
          wrap.parentNode.insertBefore(bar, wrap);
          if (pages < 2) return;
          let page = 0;
          const pager = document.createElement("div"); pager.className = "ap2-pager";
          const draw = () => {
            rows.forEach((tr, i) => { tr.style.display = (i >= page * ENH_PAGE && i < (page + 1) * ENH_PAGE) ? "" : "none"; });
            pager.innerHTML = "<span>page " + (page + 1) + " of " + pages + "</span>"
              + '<button type="button" class="rs-btn" data-pg="prev"' + (page <= 0 ? " disabled" : "") + ">‹ Prev</button>"
              + '<button type="button" class="rs-btn" data-pg="next"' + (page >= pages - 1 ? " disabled" : "") + ">Next ›</button>";
            pager.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { page += b.dataset.pg === "next" ? 1 : -1; draw(); });
          };
          draw();
          pager._tbl = tbl;
          wrap.parentNode.insertBefore(pager, wrap.nextSibling);
        });
      }

      /* ===================== SEARCH VOLUME — THE KEYWORD PLANNER UPLOAD =====================
         Giga's sixth question, the route that is open to us (2026-09-19). The Ads API will not run
         Keyword Planner for us — the connection is on Explorer access, which has no planning
         services — but the Planner works in the browser for an account admin. So: this panel writes
         the keyword list (four phrases per city, the cities our leads come from), the admin pastes it
         into Keyword Planner and downloads "Plan historical metrics", and the file comes back here.
         Every phrase maps to exactly one city because WE generated it; a keyword that is not ours is
         ignored and counted, never guessed at. Volumes are summed per city and posted to `_kwupload`. */
      const KW_CITIES = 60;
      const kwNorm = t => String(t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      /* A city name that repeats inside our own list (Newark NJ and Newark DE) carries its state in EVERY
         phrase — otherwise "movers newark" would be credited to whichever came last. The rest stay as
         people type them, and the Planner's location is set to the eight service states, so
         "movers wilmington" is Delaware's and not North Carolina's. */
      const kwPhrases = (city, st, dup) => dup
        ? ["movers " + city + " " + st, "moving company " + city + " " + st, "moving companies " + city + " " + st, city + " " + st + " movers"]
        : ["movers " + city, "moving company " + city, "moving companies " + city + " " + st, city + " movers"];
      function kwTargets() {
        return CITYYTD.filter(r => r.City && r.State && SERVICE_AREAS.includes(r.State))
          .slice().sort((a, b) => num(b.Leads) - num(a.Leads)).slice(0, KW_CITIES).map(r => ({ city: String(r.City), st: String(r.State) }))
          .map((t, i, all) => Object.assign(t, { dup: all.filter(x => x.city.toLowerCase() === t.city.toLowerCase()).length > 1 }));
      }
      function kwMap() { const m = {}; kwTargets().forEach(t => kwPhrases(t.city, t.st, t.dup).forEach(ph => { m[kwNorm(ph)] = t; })); return m; }
      // "1K – 10K", "10 – 100", "2,400", "880" -> a number; a range takes its midpoint and is flagged
      function kwVolume(v) {
        const one = x => { const m = /([\d.,]+)\s*([KkMm]?)/.exec(String(x)); if (!m) return null;
          const n = parseFloat(m[1].replace(/,/g, "")); return isNaN(n) ? null : n * (/k/i.test(m[2]) ? 1e3 : /m/i.test(m[2]) ? 1e6 : 1); };
        const parts = String(v == null ? "" : v).split(/\s*[–—-]\s*/).map(one).filter(x => x != null);
        if (!parts.length) return null;
        return { n: parts.length > 1 ? Math.round((parts[0] + parts[1]) / 2) : Math.round(parts[0]), range: parts.length > 1 };
      }
      function kwParse(textIn) {
        const lines = String(textIn || "").replace(/^﻿/, "").split(/\r?\n/).filter(l => l.trim());
        const split = l => { if (l.includes("\t")) return l.split("\t"); const out = []; let cur = "", q = false;
          for (const ch of l) { if (ch === '"') q = !q; else if (ch === "," && !q) { out.push(cur); cur = ""; } else cur += ch; } out.push(cur); return out; };
        let kCol = 0, vCol = -1, start = 0;
        for (let i = 0; i < Math.min(lines.length, 12); i++) { const cells = split(lines[i]).map(c => c.trim().toLowerCase());
          const k = cells.findIndex(c => c === "keyword" || c === "keywords"), v = cells.findIndex(c => /avg\.? monthly searches/.test(c));
          if (k >= 0 && v >= 0) { kCol = k; vCol = v; start = i + 1; break; } }
        const map = kwMap(), acc = {}; let used = 0, ignored = 0, ranges = 0;
        lines.slice(start).forEach(l => { const cells = split(l); const t = map[kwNorm(cells[kCol])];
          const vol = kwVolume(vCol >= 0 ? cells[vCol] : cells[cells.length - 1]);
          if (!t || !vol) { ignored++; return; }
          used++; if (vol.range) ranges++;
          const a = acc[t.st + "|" + t.city] = acc[t.st + "|" + t.city] || { state: t.st, city: t.city, volume: 0, kws: [] };
          a.volume += vol.n; a.kws.push(kwNorm(cells[kCol]) + "=" + vol.n); });
        const rows = Object.values(acc).map(a => ({ state: a.state, city: a.city, volume: a.volume, keywords: a.kws.join(", ") })).sort((a, b) => b.volume - a.volume);
        return { rows, used, ignored, ranges, headerFound: vCol >= 0 };
      }
      function kwHtml() {
        const n = CITYYTD.filter(r => r["Search Volume"] != null && r["Search Volume"] !== "").length;
        const list = kwTargets().flatMap(t => kwPhrases(t.city, t.st, t.dup)).join("\n");
        return '<div class="ap2-note" style="line-height:1.75"><b>' + (n ? fmtN(n) + " cities carry a search volume today." : "No search volume on file yet.") + "</b> " +
          "Google will not run Keyword Planner through our API connection, but it works in the browser for an account admin, so the volumes come in as a file, once a season:" +
          "<ol style=\"margin:6px 0 8px 18px;padding:0\"><li>Copy the keyword list below — four phrases for each of the " + KW_CITIES + " cities our leads come from.</li>" +
          "<li>In Google Ads: <b>Tools → Keyword Planner → Get search volume and forecasts</b>, paste. Set <b>Locations</b> to the eight states we serve (NJ, PA, NY, DE, CT, MA, MD, VA) — not the whole country, or Wilmington NC answers for Wilmington DE.</li>" +
          "<li>Open <b>Saved keywords</b>, then download <b>Plan historical metrics</b> (.csv).</li><li>Choose that file here.</li></ol></div>" +
          '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">' +
          '<button class="rs-btn" id="apKwCopy" type="button">Copy the ' + fmtN(kwTargets().length * 4) + " keywords</button>" +
          '<label class="rs-btn" style="cursor:pointer">Choose the Keyword Planner file<input type="file" id="apKwFile" accept=".csv,.tsv,.txt" style="display:none"></label>' +
          '<span class="ap2-note" id="apKwMsg" style="margin:0"></span></div>' +
          '<textarea id="apKwList" readonly style="width:100%;height:90px;font:12px/1.5 var(--mono,monospace);border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--panel-2);color:var(--muted)">' + esc(list) + "</textarea>" +
          '<div id="apKwPrev"></div>';
      }
      function wireKw() {
        const msg = host.querySelector("#apKwMsg"), say = (t, bad) => { if (msg) { msg.textContent = t; msg.style.color = bad ? "var(--neg)" : ""; } };
        const cp = host.querySelector("#apKwCopy");
        if (cp) cp.onclick = async () => { const ta = host.querySelector("#apKwList");
          try { await navigator.clipboard.writeText(ta.value); say("copied"); } catch (e) { ta.select(); document.execCommand("copy"); say("copied"); } };
        const fi = host.querySelector("#apKwFile");
        if (fi) fi.onchange = async () => { const f = fi.files && fi.files[0]; if (!f) return;
          const buf = await f.arrayBuffer(), u8 = new Uint8Array(buf);
          // Keyword Planner exports UTF-16 (tab-separated); a re-saved file is usually UTF-8
          const enc = (u8[0] === 0xFF && u8[1] === 0xFE) ? "utf-16le" : (u8[0] === 0xFE && u8[1] === 0xFF) ? "utf-16be" : "utf-8";
          const P2 = kwParse(new TextDecoder(enc).decode(buf)), prev = host.querySelector("#apKwPrev");
          if (!P2.rows.length) { say(P2.headerFound ? "none of our keywords are in that file" : "this does not look like a Keyword Planner export (no “Avg. monthly searches” column)", true); return; }
          prev.innerHTML = '<div class="ap2-note" style="margin:10px 0 6px"><b>' + fmtN(P2.rows.length) + " cities</b> from " + fmtN(P2.used) + " keywords" + (P2.ignored ? " · " + fmtN(P2.ignored) + " lines ignored (not ours, or no volume)" : "") +
            (P2.ranges ? " · <b>" + fmtN(P2.ranges) + " came as a range</b> and took its midpoint — Google shows exact numbers only to accounts that spend" : "") + '.</div>' +
            '<div class="rs-tablewrap"><table data-name="Search volume by city" class="rs-table"><thead><tr><th>City</th><th>St</th><th class="num">Searches / month</th></tr></thead><tbody>' +
            P2.rows.map(r => "<tr><td>" + esc(r.city) + "</td><td>" + esc(r.state) + '</td><td class="num">' + fmtN(r.volume) + "</td></tr>").join("") + "</tbody></table></div>" +
            '<button class="rs-btn" id="apKwSave" type="button" style="margin-top:8px">Save these ' + fmtN(P2.rows.length) + " cities</button>";
          enhanceTables();
          host.querySelector("#apKwSave").onclick = async () => { say("saving…");
            try { const r = await fetch(ZTZ.API + "/api/_kwupload", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ZTZ.getToken() }, body: JSON.stringify({ rows: P2.rows }) });
              const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.status);
              say("saved " + fmtN(j.written) + " cities — the city table picks them up at the next data refresh"); }
            catch (e) { say("not saved — " + String(e.message || e), true); } };
        };
      }

      function paint() {
        recalcPeriod();
        const c = calc();
        const pane = (key, lede, body) =>
          '<div class="ap2-pane" id="apPane-' + key + '" data-ap-pane="' + key + '" role="tabpanel" aria-labelledby="apTab-' + key + '" hidden>' +
          (lede ? '<div class="ap2-lede">' + lede + "</div>" : "") + body + "</div>";
        host.innerHTML =
          '<div class="rs-page-head"><h1>Seasonal Planning</h1>' +
          '<p style="max-width:104ch">How many crews, how many salespeople and what marketing budget Season ' + esc(String(FC.year || "next")) +
            ' needs — state by state, month by month, with the working under every answer.</p>' +
          '<div class="ap2-clockline">Season ' + esc(String(FC.year || "")) + (SEASON.next && SEASON.next[0] ? " · " + esc(ymLabel(SEASON.next[0])) + " – " + esc(ymLabel(SEASON.next[1])) : "") +
            ' · the permanent values live on <a href="#page=season-settings">Planning Variables</a></div></div>' +
          tabsHtml() +
          assumeHtml() +
          pane("decide", "The three answers for Season " + esc(String(FC.year || "")) + ", and Giga's nine questions with what the data says today.",
            '<div id="apDecide">' + decisionsHtml() + "</div>" +
            asksHtml().replace('style="margin-top:6px;border-top:0;padding-top:0"', "")) +
          pane("plan", "Crews, the sales desk and the marketing budget: every state, every month. Season " + esc(String(FC.year || "")) + " — the period picker on <b>Capacity check</b> does not move these numbers.",
            card("The formula", "X foremen at a location — how many salespeople and what marketing budget",
                 "The arithmetic behind every number on this page, with each coefficient measured over the last three seasons.",
                 '<div id="apFormula">' + formulaHtml() + "</div>") +
            card("The full plan — " + (FC.year || "next season"), "Crews by state, the sales desk by month, leads and marketing budget by state",
               "The three decisions, opened out: every state, every month.",
               fullPlanHtml()) +
          card("Beside the plan", "Tuji and the sister companies — their own crews, their own money, and the Delaware question",
               "Kept apart from every total on this page, because they hire and advertise for themselves. Delaware is where they change the reading.",
               sisterHtml(), "apSister") +
          card("The jobs forecast — " + (FC.year || "the coming one"), "Jobs by state and month, and the method behind them",
               "Where the season's work is forecast to fall. The crew, the desk and the budget above are all sized from these jobs — change the method here and they follow.",
               '<div id="apNext" style="overflow-x:auto">' + nextHtml() + "</div>") +
          card("Season budget — " + (FC.year || "the coming one"), "Revenue, the job and truck cost, and marketing (post cards inside it), per state",
               "The whole season in one table: what the jobs bring, what they cost to run, what the leads cost to buy. Net is before overhead.",
               '<div id="apBudget" style="overflow-x:auto">' + budgetHtml() + "</div>")) +
          pane("map", "Every county we have leads in, coloured by its tier. The tooltip carries that county's marketing budget and how many jobs a day the crews within reach could run.",
            card("The map — " + (FC.year || "next season"), "County tier, marketing budget, and the crew that can reach it",
                 "Colour answers <b>where to target</b>; the tooltip answers <b>what it costs</b> and <b>who can serve it</b>.",
                 '<div id="apMap">' + mapHtml() + "</div>")) +
          pane("cities", "Which cities produce the work, this year to date, all companies — this pane does not follow the period picker. Click a state anywhere to focus the page on it.",
            '<div id="apBandB">' + bandBHtml() + "</div>" +
            card("Push or cut — the opportunity rank", "Cities scored on return per ad dollar, movers, wealth and untapped leads — weights are yours",
               "Where to add leads, and where the money already spent works least. The rank follows the window, focus and minimum leads above.",
               '<div id="apRank">' + rankHtml() + "</div>") +
            card("Where a depot pays", "Philadelphia, Millburn, Hartford — and any zip you try",
               "Miles per job today against miles per job with the depot, the jobs it would take over, and the white space it would bring within reach.",
               '<div id="apDepot" style="overflow-x:auto">' + depotHtml() + "</div>")) +
          pane("capacity", "A what-if on a past period: what a foreman table of this size could have run, and where the demand was. <b>Not the " + esc(String(FC.year || "")) + " plan</b> — that one is priced on leads per job with the one-month lag; this one uses the period's own booking rates.",
          '<div class="ap2-band" style="margin-top:0;border-top:0;padding-top:0"><span class="k">Capacity check</span><h2>What ' + fmtN(c.totCur) + ' foremen could have run in ' + esc(P.label) + '</h2>' +
          '<span class="clock">a what-if on a past period — not the ' + esc(String(FC.year || "")) + ' plan</span></div>' +
          controlBar() +
          '<div class="panel ap2-hero"><div id="apHero">' + heroHtml(c) + "</div></div>" +
          card("The demand", esc(P.label) + " by area",
               "The full bar is leads (counted where the move starts, on create date); the solid green inside it is what got booked — <b>a closing exists</b>. Lost = qualified, never booked. Click a state to focus the page on it.",
               '<div id="apDemand">' + demandHtml() + "</div>") +
          card("The plan", "Base capacity — foreman quantity, plus the additions",
               "Rows are service areas (NY is worked from the NJ base). <b>Worked (measured)</b> is the distinct foremen on closings in the period, so the typed cell has its measured counterpart on the same row. Where two companies run a state, each has its own editable line. Change any cell; the hero follows. Edits stay in this browser — the Planning Variables page makes them permanent.",
               '<div id="apBase" style="overflow-x:auto">' + planHtml(c) + "</div>") +
          card("Where it leaks", "The counties that lose the most",
               "Top county losses in " + esc(P.label) + (inputs.focus ? " for " + esc(inputs.focus) : "") + " — where extra sales attention or pricing would bite first.",
               '<div id="apLeak">' + leakHtml() + "</div>")) +
          pane("ref", "Read once a season: how the season was set, the outside research, search volume, rent vs buy, and the method behind every number.",
          ref("How the season was decided", (SEASON.months || []).map(m => MONTH_NAMES[m]).join("–"), card("The season", "Months that reach the threshold of the year's peak", "", seasonHtml())) +
          (R.states ? ref("The outside picture", "big houses and good areas, joined to our own demand",
             card("Research", "Compiled by us — the gap between the outside case and our own numbers is the expansion argument", "", researchHtml(c))) : "") +
          ref("Search volume — from Google's Keyword Planner", "where people search for a mover, city by city",
             card("Search demand", "Uploaded once a season — the API will not run Keyword Planner for us", "", '<div id="apKw">' + kwHtml() + "</div>")) +
          ref("Trucks — rent vs buy", "as the company already lives it",
             card("Trucks", "Both sides are real card history: the company rents AND finances purchases today", "", trucksHtml())) +
          ref("Method", "what is measured and what is assumed",
             card("Method", "Definitions and provenance", "",
               '<div class="ap2-note" style="line-height:1.75" id="apMethod">Measured: everything except the foreman cells and any number you type. The plan seeds from the distinct foremen who worked last season per state and company (or his 19-August table, or the 28-crew aim); the Planning Variables page overrides any cell. Utilization bridges foremen to a month of jobs against the ' + DAYS_PER_MONTH + '-day ceiling and re-seeds when the period changes. <b>Booked = a closing exists</b> on both halves of the page (his call). Band A geography is where the move starts, in the closing\'s own state; Band B places a job by the lead\'s pickup city and counts last-encounter closings only — so the two job counts will not tie. Band A obeys the period picker; Band B is always this year to date. Miles are straight-line. Marketing $/lead is company-wide.</div>')) +
          stamps()) +
          "";

        wire();
      }

      function repaintCity() {
        const t = host.querySelector("#apCityTable"); if (t) t.innerHTML = cityTableHtml();
        mountCityBar(); wireCityTable(); repaintRank(); repaintBudget(); enhanceTables();
      }
      function repaintBandB() {
        const b = host.querySelector("#apBandB"); if (!b) return;
        b.innerHTML = bandBHtml(); repaintCity(); wireFocus(b); wireWs(); enhanceTables();
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
            inputs.utilization = null; inputs.leadsPerRep = null; inputs.dollarsPerLead = null; inputs.dialsTyped = {};
            save(); paint();
          };
          fSel = RSC.localSelect(f, { label: "From", values: ymVals, value: inputs.from, required: true, onChange: onSel });
          tSel = RSC.localSelect(t, { label: "To", values: ymVals, value: inputs.to, required: true, onChange: onSel });
        }
        host.querySelectorAll("#apPeriod button").forEach(b => b.onclick = () => {
          inputs.from = b.dataset.from; inputs.to = b.dataset.to;
          inputs.utilization = null; inputs.leadsPerRep = null; inputs.dollarsPerLead = null; inputs.dialsTyped = {};
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
        wireControls(); wireFocus(); mountCityBar(); repaintCity(); wireWs(); wireMethod(); wireRank(); wireDepot(); wireAsks(); wireKw(); enhanceTables(); wireMap();
        // last, because paint() re-runs on every period, seed and focus change and must not drop the reader
        wireTabs(); wirePdf(); showPane(bootTab || inputs.tab, true); bootTab = null;
      }
      function repaintBudget() { const el = host.querySelector("#apBudget"); if (el) { el.innerHTML = budgetHtml(); enhanceTables(); } }
      /* every card the next-season numbers feed, together — a method click, a dial and a foreman cell
         all go through here, so the decisions band can never disagree with the card it quotes. None of
         the typed inputs live inside these nodes, so the cursor keeps its place. */
      function repaintPlan() {
        const dc = host.querySelector("#apDecide"); if (dc) dc.innerHTML = decisionsHtml();
        const fp = host.querySelector("#apFull"); if (fp) fp.outerHTML = fullPlanHtml();
        const nx = host.querySelector("#apNext"); if (nx) nx.innerHTML = nextHtml();
        repaintBudget(); wireMethod(); wireAsks(); enhanceTables();
      }
      function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {} }

      paint();

      /* live edits: the hero and the edited row repaint; the input keeps focus; the dials
         node is NEVER re-rendered here (the old page destroyed the input under the cursor) */
      /* THE HOST IS THE SHELL'S SHARED #content (index.html:1000), so a listener added here outlived
         the page: after visiting Seasonal Planning, typing into any .rs-num on another report reached
         this handler and threw on a missing #apHero. One handler, replaced on every render, and it
         returns immediately when its own page is no longer mounted. */
      if (host._apInput) host.removeEventListener("input", host._apInput);
      host._apInput = e => {
        if (!host.querySelector("#apHero")) return;
        const t = e.target;
        if (!t.classList || !t.classList.contains("rs-num")) return;
        if (t.dataset.rank) return;                      // the opportunity-rank weights have their own handler
        if (t.dataset.st) {
          const b = inputs.bases[t.dataset.st];
          if (t.dataset.co) { (b.byCo[t.dataset.co] = b.byCo[t.dataset.co] || { cur: 0, add: 0 })[t.dataset.f] = parseFloat(t.value) || 0; }
          else b[t.dataset.f] = parseFloat(t.value) || 0;
          if (inputs.seed !== "custom") {
            inputs.seed = "custom";
            const cb = host.querySelector(".ap2-ctl");
            if (cb) { cb.outerHTML = controlBar(); wireControls(); }
          }
        } else if (t.dataset.k) { inputs[t.dataset.k] = parseFloat(t.value) || 0; (inputs.dialsTyped = inputs.dialsTyped || {})[t.dataset.k] = 1; }
        save();
        const c = calc();
        document.getElementById("apHero").innerHTML = heroHtml(c);
        repaintPlan();
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
      };
      host.addEventListener("input", host._apInput);
    });
  },
});
})();
