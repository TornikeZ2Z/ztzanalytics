/* DIFFERENT ANALYSIS ▸ Seasonal Planning — Area Plan and Area Master joined (2026-09-03).
 *
 * His words: "we should kinda join them - since they cover the same general idea. make sure
 * to dont loose any data we gathered". And his four answers that shape the page:
 *   · the first decision is hiring, then marketing, then the base question -- in that order;
 *   · the season is DETERMINED BY THE DATA (model.season, from the demand curve);
 *   · BOOKED means a closing exists (one rule for the state plan and the city evidence);
 *   · the foreman table SEEDS FROM WHAT ACTUALLY WORKED last season, split by company where
 *     both operate. (The Planning Variables page that could override a cell was removed on his
 *     call 2026-09-22 -- nothing had ever been saved on it. `model.overrides` still wins if set.)
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
             "Median Income", "Mover Rate",
             // 2026-09-24: organic search per city (mart_gsc_area) -- floors, shown in the Marketing view
             "Organic Clicks", "Organic Position", "Organic Clicks Per 1000 Searches"],
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
             "Uncovered", "Population", "Movers Per Year", "Median Income", "Owner Share Pct",
             "Leads Per 10k Movers", "Survey Vintage",
             // the trailing-year lead count capture is read on (2026-09-23)
             "Leads 12m",
             // the state's leads with no address, in no county (2026-09-24): a STATE figure on
             // every county row -- read once per state (NOADDR_ST), never summed
             "State No Address Leads 12m"],
    };
    RS.DATASETS.area_whitespace = {
      table: "mart_area_whitespace",
      cols: ["Zip", "City", "County", "State", "Nearest Base", "Miles To Base", "Leads 24m", "Jobs 24m",
             "Last Lead", "Never A Lead", "Home Value", "Home Value Change Pct", "Population",
             "Median Income", "Mover Rate", "Movers Per Year"],
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_tier) {
    /* THE FOUR TIERS AT THREE LEVELS (his planning-day ask 2026-09-29): "do the planning on county
       level ... i may even want to go as down as zip. i need a selector for that", and "i dont see 4
       tiers". One row per zip, city and county, all counted off the zip -- see curated.py. */
    RS.DATASETS.area_tier = {
      table: "mart_area_tier",
      cols: ["Level", "Area Key", "State", "County", "City", "Zip", "Name", "Zips", "Latitude", "Longitude",
             "Leads 12m", "Booked 12m", "Jobs 12m", "Booking Rate", "Avg Ticket", "Miles To Base", "Nearest Base",
             "Foremen Within 60mi", "Score Distance", "Data Score", "Data Tier", "Market Score", "Market Tier", "Tier",
             "Tier Source", "Tier Reason", "Leads To Measure", "Never A Lead", "Population", "Movers Per Year",
             "Median Income", "Home Value", "Owner Share Pct", "Leads Per 10k Movers",
             "State Lead Share", "State Job Share"],
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
    .ap2-xp{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin:4px 0 2px}
    .ap2-xps{border:1px solid var(--line);border-left:3px solid var(--pos);border-radius:8px;padding:8px 11px}
    .ap2-xps b{display:block;font-size:13px;color:var(--ink)}
    .ap2-xps span{display:block;font-size:11.5px;color:var(--warn);font-weight:700;margin:1px 0 3px}
    .ap2-xps small{display:block;font-size:11px;color:var(--faint);line-height:1.4}
    .ap2-xps small strong{color:var(--ink);font-weight:700}
    /* THE MARYLAND BLOCK (2026-09-24): the clock + the Montgomery test. Series colours are tokens on
       the block's own root -- light/paper is the base, dark states itself (the page's convention) --
       so the SVG never carries a literal colour. Each hue was checked against --panel in both themes. */
    .ap2-gt{--gt-t:#1d4ed8;--gt-c:#6b7280;--gt-pos:#047857;--gt-md:#1d4ed8;--gt-ref:#b45309;--gt-lvl:#7c3aed;
      --gt-grid:color-mix(in srgb,var(--ink) 10%,transparent);--gt-axis:var(--muted);--gt-mark:var(--faint);
      --gt-band:color-mix(in srgb,#7c3aed 9%,transparent)}
    body.rs-app:not(.light) .ap2-gt{--gt-t:#60a5fa;--gt-c:#a3a3a3;--gt-pos:#34d399;--gt-md:#60a5fa;--gt-ref:#fbbf24;--gt-lvl:#c4b5fd;
      --gt-band:color-mix(in srgb,#c4b5fd 12%,transparent)}
    .ap2-gt-h{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:6px 0 6px}
    .ap2-gt-chart{overflow-x:auto;-webkit-overflow-scrolling:touch;margin:0 0 4px}
    .ap2-gt-svg{display:block;width:100%;max-width:860px;min-width:520px;height:auto}
    .ap2-gt-svg text{font-size:11px;font-family:inherit}
    .ap2-gt-grid{stroke:var(--gt-grid);stroke-width:1}
    .ap2-gt-ax{fill:var(--gt-axis)}
    .ap2-gt-mark{stroke:var(--gt-mark);stroke-width:1;stroke-dasharray:3 3}
    .ap2-gt-mtx{fill:var(--gt-axis);font-weight:700}
    .ap2-gt-band{fill:var(--gt-band)}
    .ap2-gt-ref{stroke-width:1.5;stroke-dasharray:6 4;fill:none}
    .ap2-gt-rtx{font-weight:800}
    .ap2-gt-ln{fill:none;stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}
    .ap2-gt-pt{stroke:none}
    .ap2-gt-ln.ap2-gt-t{stroke:var(--gt-t)} .ap2-gt-pt.ap2-gt-t{fill:var(--gt-t)}
    .ap2-gt-ln.ap2-gt-c1{stroke:var(--gt-c)} .ap2-gt-pt.ap2-gt-c1{fill:var(--gt-c)}
    .ap2-gt-ln.ap2-gt-pos{stroke:var(--gt-pos)} .ap2-gt-pt.ap2-gt-pos{fill:var(--gt-pos)}
    .ap2-gt-ln.ap2-gt-md{stroke:var(--gt-md)} .ap2-gt-pt.ap2-gt-md{fill:var(--gt-md)}
    .ap2-gt-ref.ap2-gt-tgt{stroke:var(--gt-ref)} .ap2-gt-rtx.ap2-gt-tgt{fill:var(--gt-ref)}
    .ap2-gt-ref.ap2-gt-lvl{stroke:var(--gt-lvl)} .ap2-gt-rtx.ap2-gt-lvl{fill:var(--gt-lvl)}
    .ap2-gt-leg{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:11.5px;color:var(--muted);margin:2px 0 8px}
    .ap2-gt-leg span{display:inline-flex;align-items:center;gap:6px}
    .ap2-gt-sw{display:inline-block;width:16px;height:3px;border-radius:2px}
    .ap2-gt-sw.ap2-gt-t{background:var(--gt-t)} .ap2-gt-sw.ap2-gt-c1{background:var(--gt-c)}
    .ap2-gt-sw.ap2-gt-pos{background:var(--gt-pos)} .ap2-gt-sw.ap2-gt-md{background:var(--gt-md)}
    .ap2-gt-sw.ap2-gt-dash{height:0;border-top:2px dashed currentColor;background:none}
    .ap2-gt-sw.ap2-gt-dash.ap2-gt-tgt{color:var(--gt-ref)} .ap2-gt-sw.ap2-gt-dash.ap2-gt-lvl{color:var(--gt-lvl)}
    .ap2-gt-guard{font-size:12.5px;color:var(--muted);line-height:1.9;margin:0 0 4px}
    /* a tripped guard's chip carries a whole sentence ("May 2027: $120 of Google Ads in a test zone;
       2,500 MD/DC/VA cards mailed ...", ~700px): span.ap2-chip is nowrap, so at 375px it pushed the
       whole content area sideways the day a guard tripped (2026-09-24 review). Here it wraps. */
    .ap2-gt-guard span.ap2-chip{white-space:normal;max-width:100%;align-items:flex-start;margin:0 0 4px}
    .ap2-gt-guard span.ap2-chip::before{margin-top:5px}
    /* the What-if's small segmented controls: ceilings vs counted, and each typed state's path */
    .ap2-capmode{margin:0 0 10px}
    .rs-seg.ap2-seg-s{flex-wrap:wrap;max-width:100%}
    .rs-seg.ap2-seg-s button{font-size:11.5px;padding:4px 9px}
    .ap2-capcell{min-width:0;margin:0 0 9px}
    .ap2-capcell>.ap2-fld{margin:0}
    .ap2-capcell>.rs-seg.ap2-seg-s{margin-top:5px}
    .ap2-gt-facts{margin:4px 0 0;padding-left:20px;font-size:12.5px;color:var(--muted);line-height:1.6}
    .ap2-gt-facts b{color:var(--ink)}
    .ap2-gt .ap2-next td small{display:block}
    .ap2-scn{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:10px 0}
    @media (max-width:1100px){.ap2-scn{grid-template-columns:1fr}}
    .ap2-scnbox{border:1px solid var(--line);border-radius:10px;padding:10px 12px;min-width:0}
    .ap2-capgrid{display:grid;grid-template-columns:1fr 1fr;gap:0 10px}
    .ap2-scnbox h4{margin:0 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .ap2-fld{display:block;margin:0 0 9px}
    .ap2-fld>span{display:block;font-size:12px;color:var(--ink);font-weight:600;margin-bottom:3px}
    .ap2-fld small{display:block;font-size:10.5px;color:var(--faint);line-height:1.35;margin-top:2px}
    .ap2-fld .ap2-in{width:100%}
    .ap2-picks{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 10px}
    .ap2-picks .ap2-mbtn{font-size:11.5px;padding:4px 8px}
    .ap2-scnbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 2px}
    .ap2-cname{position:absolute;transform:translate(-50%,-172%);text-align:center;white-space:nowrap;
      font-size:11.5px;font-weight:800;color:var(--ink);letter-spacing:.01em;pointer-events:none;
      text-shadow:0 0 4px var(--bg),0 0 4px var(--bg),0 0 8px var(--bg)}
    .ap2-cname b{display:block;font-size:10px;font-weight:700;color:var(--muted);letter-spacing:.04em}
    .ap2-stlbl { position:absolute; transform:translate(-50%,-50%); font:800 11px/1 var(--mono, ui-monospace, monospace); letter-spacing:.22em; color:var(--ink); opacity:.5; white-space:nowrap; pointer-events:none; text-shadow:0 0 3px var(--bg), 0 0 3px var(--bg); }
    .ap2-svbar { display:inline-block; width:64px; height:6px; margin-left:8px; border-radius:3px; background:var(--line); vertical-align:middle; overflow:hidden; }
    .ap2-svbar i { display:block; height:100%; background:var(--pos); border-radius:3px; }
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
.ap2-mapbox{height:min(82vh,900px);min-height:600px;border-radius:var(--ap-r1);border:1px solid var(--ap-rule);
  background:#d0cfd4;overflow:hidden}          /* the Esri canvas water, so no seam shows at an edge */
body:not(.light) .ap2-mapbox{background:#1d232b}
.ap2-modes{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.ap2-modes .l{font-size:12px;color:var(--muted);font-weight:700;letter-spacing:.02em;margin-right:2px}
.ap2-rampsw{display:inline-block;width:20px;height:13px;vertical-align:-2px;border:1px solid var(--ap-rule-2);
  border-right:0}
.ap2-bub{display:inline-block;border-radius:50%;background:var(--blue);opacity:.30;
  border:1.4px solid var(--blue);vertical-align:middle;margin-right:4px}
.ap2-bub.faint{width:15px;height:15px;opacity:.55;background:transparent;border-style:dashed}
.ap2-bub.spend{background:var(--muted);border-color:var(--muted);opacity:.42}
.ap2-rampsw:last-of-type{border-right:1px solid var(--ap-rule-2)}
.ap2-headline{margin:2px 0 10px;padding:11px 14px;border:1px solid var(--ap-rule);border-left:4px solid var(--ap-pos-ink);
  border-radius:var(--ap-r2);background:var(--ap-sub);font-size:15px;line-height:1.5;color:var(--ink)}
.ap2-headline .n{font-size:22px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ink)}
.ap2-headline .q{color:var(--muted)}
.ap2-mapkey{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 10px;font-size:13.5px;
  font-size:11.5px;color:var(--muted)}
.ap2-mapkey .sp{flex:1 1 auto}
.ap2-mk{display:inline-flex;align-items:center;gap:6px}
.ap2-mk b{color:var(--ink);font-variant-numeric:tabular-nums}
.ap2-sw{width:14px;height:14px;border-radius:50%;flex:none;border:1px solid var(--ap-rule-2)}
.ap2-sw.push{background:var(--ap-pos-ink)} .ap2-sw.hold{background:var(--ap-warn-ink)}
.ap2-sw.fix{background:var(--ap-neg-ink)}  .ap2-sw.grey{background:var(--muted)}
.ap2-sw.unc{background:transparent;border:2px dashed var(--ap-neg-ink)}
/* NEVER SENT A LEAD IS A TEXTURE, NOT A SHADE (his call 2026-09-22: the two greys "look
   similar"). A hatch cannot be mistaken for a colour at any size or on any projector, and it reads
   as "nothing is known here" rather than as a bad score -- which is what it actually means. */
.ap2-sw.none{background:transparent;border:1px solid var(--ap-rule-2);
  background-image:repeating-linear-gradient(45deg,var(--ap-rule-2) 0 1.5px,transparent 1.5px 4px)}
.ap2-sw.have{background:var(--ink);border-radius:2px}
.ap2-sw.cover{background:transparent;border:2px dashed var(--ap-pos-ink);border-radius:50%}
/* A BASE FLAG IS A LABEL, NOT A PIN. Six bases and four proposals on one screen: an unlabelled
   marker makes the reader hover ten times to learn what they are looking at. The label rides with
   the mark, anchored at its own left edge so the point stays where the base is. */
.ap2-flag{position:absolute;transform:translate(-7px,-50%);display:flex;align-items:center;gap:5px;white-space:nowrap;pointer-events:auto;cursor:pointer}
.ap2-flag.flip{flex-direction:row-reverse;transform:translate(calc(-100% + 18px),-50%)}
.ap2-flag.up{margin-top:-13px} .ap2-flag.down{margin-top:13px}
/* THE LABELS WERE WHITE ON WHITE IN THE DARK THEME (found in a render 2026-09-22): --ink flips to near
   white there and the chip behind it was hard-coded white, so every base we have was a blank box. */
.ap2-flag i{width:11px;height:11px;flex:none;border-radius:2px;background:var(--ink);box-shadow:0 0 0 2px var(--bg)}
.ap2-flag.cover i{background:var(--bg);border:2px dashed var(--ap-pos-ink);border-radius:50%;box-shadow:0 0 0 2px var(--bg)}
.ap2-flag.cover b{color:var(--ap-pos-ink)}
.ap2-flag b{font-size:11px;font-weight:800;letter-spacing:.02em;color:var(--ink);background:var(--bg);border:1px solid var(--line);padding:1px 5px;border-radius:3px;box-shadow:0 1px 2px rgba(0,0,0,.18)}
.ap2-flag:hover b{border-color:var(--ink)}
.leaflet-control a.ap2-mapbtn{width:30px;height:30px;line-height:30px;text-align:center;font-size:15px;
  background:#fff;color:var(--ink);border-radius:4px;box-shadow:0 1px 4px rgba(0,0,0,.25);display:block;margin-top:6px;text-decoration:none}
.leaflet-control a.ap2-mapbtn.on{background:var(--ink);color:#fff}
.ap2-mapbox{cursor:grab} .ap2-mapbox:active{cursor:grabbing}
/* ---------- THE MAP TAB, FOR THE ROOM (2026-09-29) ------------------------------
   The plan in four numbers, what to do per crew pool, the map beside its ranked list, and the
   working in one closed section. ap3- so nothing collides with the ap2- blocks above. */
.ap3-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:12px;margin:0 0 14px}
.ap3-kpi{padding:14px 16px;border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);min-width:0}
.ap3-kpi b{display:block;font-size:30px;font-weight:800;letter-spacing:-.02em;line-height:1.05;color:var(--ink);font-variant-numeric:tabular-nums}
.ap3-kpi span{display:block;margin-top:5px;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.ap3-kpi small{display:block;margin-top:2px;font-size:12.5px;color:var(--muted)}
.ap3-kpi em{font-style:normal;font-weight:800;color:var(--ap-warn-ink)}
.ap3-todos{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin:0 0 18px}
.ap3-todo{border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);padding:12px 14px;min-width:0}
.ap3-todo .h{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin:0 0 8px;padding-bottom:7px;border-bottom:1px solid var(--ap-rule)}
.ap3-todo .h b{font-size:16px;color:var(--ink)}
.ap3-todo .h span{font-size:13px;color:var(--muted);font-weight:700;font-variant-numeric:tabular-nums}
.ap3-todo ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}
.ap3-todo li{display:grid;grid-template-columns:76px minmax(0,1fr);gap:8px;font-size:13.5px;line-height:1.4;color:var(--ink)}
.ap3-todo li i{font-style:normal;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:3px}
.ap3-todo li.hire b{color:var(--ap-warn-ink)}
.ap3-todo li.push i{color:var(--ap-pos-ink)} .ap3-todo li.weak i{color:var(--ap-neg-ink)}
.ap3-todo li small{display:block;color:var(--faint);font-size:11.5px}
.ap3-todo .more{color:var(--muted);font-size:12px;font-weight:700}
.ap3-bar{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;margin:0 0 10px}
.ap3-bar label{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-left:8px}
.ap3-bar label:first-child{margin-left:0}
.ap3-find{position:relative;margin-left:auto;min-width:230px;flex:0 1 280px}
.ap3-find input{width:100%}
.ap3-findres{position:absolute;z-index:1200;top:calc(100% + 4px);left:0;right:0;background:var(--ap-bay);border:1px solid var(--ap-rule);border-radius:var(--ap-r1);box-shadow:0 10px 28px rgba(0,0,0,.16);padding:4px;max-height:340px;overflow:auto}
.ap3-findres button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;font:inherit;font-size:13px;color:var(--ink);background:none;border:0;border-radius:7px;padding:7px 8px;cursor:pointer}
.ap3-findres button:hover,.ap3-findres button:focus-visible{background:var(--ap-sub);outline:0}
.ap3-findres button small{margin-left:auto;color:var(--faint);font-size:11.5px;white-space:nowrap}
.ap3-findres .tchip{display:inline-block;font-style:normal;font-size:11px;font-weight:800;padding:0 7px;border-radius:6px;color:#fff;flex:none}
.ap3-findres .none{padding:8px;font-size:12.5px;color:var(--muted)}
.ap3-hl{animation:ap3hl 1.4s ease-in-out infinite}
@keyframes ap3hl{0%,100%{stroke-opacity:1;stroke-width:3}50%{stroke-opacity:.35;stroke-width:7}}
@media (prefers-reduced-motion:reduce){.ap3-hl{animation:none}}
.ap3-seg{display:inline-flex;flex-wrap:wrap;border:1px solid var(--line-2);border-radius:10px;overflow:hidden;background:var(--panel)}
.ap3-seg button{font:inherit;font-size:12.5px;font-weight:700;padding:6px 11px;border:0;border-right:1px solid var(--line);
  background:transparent;color:var(--muted);cursor:pointer;min-height:32px}
.ap3-seg button:last-child{border-right:0}
.ap3-seg button:hover{color:var(--ink)}
.ap3-seg button.on{background:var(--brand-glow);color:var(--brand-d);box-shadow:inset 0 -2px 0 var(--brand-d)}
.ap3-seg button:focus-visible,.ap3-list .r:focus-visible,.ap3-list .tt button:focus-visible{outline:2px solid var(--brand-d);outline-offset:-2px}
.ap2-mk small.far{display:inline;margin-left:5px;color:var(--faint);font-size:11.5px}
.ap3-mapgrid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:12px;align-items:stretch}
.ap3-mapgrid .ap2-mapbox{height:min(78vh,860px);min-height:560px}
.ap3-busy{opacity:.72;transition:opacity .2s}
.ap3-list{display:flex;flex-direction:column;height:min(78vh,860px);min-height:560px;border:1px solid var(--ap-rule);
  border-radius:var(--ap-r1);background:var(--ap-bay);overflow:hidden;min-width:0}
.ap3-list .lh{display:flex;align-items:center;gap:8px;padding:10px 12px 6px}
.ap3-list .lh b{font-size:14px;color:var(--ink)}
.ap3-list .lh span{flex:1;color:var(--muted);font-size:12.5px}
.ap3-list .lh .rs-btn{padding:3px 9px;font-size:11.5px}
.ap3-list .tt{display:flex;gap:4px;padding:0 10px 8px;flex-wrap:wrap}
.ap3-list .tt button{font:inherit;font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:5px;padding:4px 8px;
  border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--muted);cursor:pointer}
.ap3-list .tt button i{width:10px;height:10px;border-radius:50%}
.ap3-list .tt button small{font-size:11px;color:var(--faint);font-weight:600}
.ap3-list .tt button.on{border-color:var(--brand-d);color:var(--ink);background:var(--brand-glow)}
.ap3-list .cols,.ap3-list .r{display:grid;grid-template-columns:24px minmax(0,1fr) 56px 50px 76px;gap:6px;align-items:center}
.ap3-list .cols{padding:6px 12px;border-top:1px solid var(--ap-rule);border-bottom:1px solid var(--ap-rule);font-size:10.5px;
  font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.ap3-list .cols span{text-align:right}
.ap3-list .cols span:first-child{grid-column:1 / span 2;text-align:left}
.ap3-list .cols small{display:block;font-size:9.5px;color:var(--faint);font-weight:700}
.ap3-list .rows{overflow-y:auto;flex:1 1 auto}
.ap3-list .r{width:100%;font:inherit;text-align:left;padding:7px 12px;border:0;border-bottom:1px solid var(--ap-rule);
  background:transparent;color:var(--ink);cursor:pointer}
.ap3-list .r:hover{background:var(--ap-sub)} .ap3-list .r.on{background:var(--brand-glow)}
.ap3-list .r .tb{font-style:normal;width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:12px;font-weight:800;color:#fff}
.ap3-list .r .tb.t2,.ap3-list .r .tb.t3,.ap3-list .r .tb.grey{color:#1b2430}
body.rs-app:not(.light) .ap3-list .r .tb{color:#0a0e14}
body.rs-app:not(.light) .ap3-list .r .tb.t2{color:#f2f6ea}
.ap3-list .r .n{min-width:0}
.ap3-list .r .n b{display:block;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ap3-list .r .n small{display:block;font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ap3-list .r .v{text-align:right;font-size:12.5px;font-variant-numeric:tabular-nums}
details.ap3-how{margin-top:16px;border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);padding:0 16px}
details.ap3-how>summary{cursor:pointer;list-style:none;padding:13px 0;font-weight:800;font-size:14px;color:var(--ink)}
details.ap3-how>summary::-webkit-details-marker{display:none}
details.ap3-how>summary::before{content:"▸ ";color:var(--brand-d)}
details.ap3-how[open]>summary::before{content:"▾ "}
details.ap3-how>summary small{font-weight:600;color:var(--faint);margin-left:8px;font-size:12px}
details.ap3-how[open]{padding-bottom:16px}
.ap3-howcard{margin-top:14px;padding-top:12px;border-top:1px solid var(--ap-rule)}
.ap3-howcard .ap2-h3{font-weight:800;font-size:15px;color:var(--ink);margin:0 0 4px}
.ap3-sc{margin:0 0 18px}
.ap3-nbh .ap3-reset{margin-left:auto;padding:4px 12px;font-size:12.5px}
.ap3-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin:0 0 10px}
.ap3-step{border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);padding:10px 12px;min-width:0}
.ap3-step.tot{background:var(--ap-sub)}
.ap3-step.nb{border-style:dashed;border-color:var(--brand-d)}
.ap3-nbh .ap3-planseg{margin-left:auto}
.ap3-nbh .ap3-planseg + .ap3-reset{margin-left:0}
.ap3-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:0 0 10px}
.ap3-step.plan span em{font-weight:800}
.ap3-step.plan .site{display:flex;align-items:center;gap:6px;margin-top:8px}
.ap3-step.plan .site i{font-style:normal;font-size:13px;color:var(--ink);margin-right:auto;min-width:0}
.ap3-step.plan .site i u{text-decoration:none;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--brand-d);margin-left:6px}
.ap3-step.plan .site i small{display:block;font-size:11px;color:var(--ap-warn-ink)}
.ap3-step.plan .site b{font-size:17px;font-weight:800;color:var(--ink);min-width:22px;text-align:center;font-variant-numeric:tabular-nums}
.ap3-step.plan .site button{font:inherit;font-weight:800;line-height:1;width:26px;height:26px;border-radius:7px;border:1px solid var(--ap-rule);background:var(--ap-bay);color:var(--ink);cursor:pointer;padding:0}
.ap3-step.plan .site button:hover{border-color:var(--brand-d);color:var(--brand-d)}
.ap3-step.plan>small{display:block;margin-top:8px}
.ap3-steps.bases{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.ap3-step.drv{border-color:var(--brand-d);box-shadow:inset 0 3px 0 var(--brand-d)}
.ap3-step span{display:flex;justify-content:space-between;gap:8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.ap3-step span em{font-style:normal;color:var(--brand-d);text-transform:none;letter-spacing:0}
.ap3-step .ctl{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:6px 0 2px}
.ap3-step .ctl b{font-size:22px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.ap3-step .ctl button{font:inherit;font-size:18px;font-weight:800;line-height:1;width:34px;height:34px;border-radius:9px;
  border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer}
.ap3-step .ctl button:hover{border-color:var(--brand-d);color:var(--brand-d)}
.ap3-step .ctl button:focus-visible{outline:2px solid var(--brand-d);outline-offset:1px}
.ap3-step small{font-size:11.5px;color:var(--faint)}
.ap3-step .trk{display:flex;flex-wrap:wrap;align-items:center;gap:4px 12px;margin-top:8px;padding-top:8px;border-top:1px solid var(--ap-rule);font-size:12px;color:var(--muted)}
.ap3-step .trk i{font-style:normal;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}
.ap3-step .trk b{color:var(--ink);font-weight:800;font-variant-numeric:tabular-nums}
.ap3-step .trk i.rent b{color:var(--warn,#b45309)}
.ap3-step .trk button{font:inherit;font-weight:800;line-height:1;width:22px;height:22px;border-radius:6px;border:1px solid var(--ap-rule);background:var(--ap-bay);color:var(--ink);cursor:pointer;padding:0}
.ap3-step .trk button:hover{border-color:var(--brand-d);color:var(--brand-d)}
.ap2-growth{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:8px 0 12px;padding:10px 12px;border:1px solid var(--ap-rule);border-radius:var(--ap-r2);background:var(--ap-sub)}
.ap2-growth label{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);white-space:nowrap}
.ap2-growth input{font:inherit;font-size:16px;font-weight:800;width:84px;padding:5px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink)}
.ap2-growth .ap2-note{flex:1 1 320px}
.ap3-kpi .was{margin-top:8px;padding-top:7px;border-top:1px solid var(--ap-rule);font-size:12.5px;color:var(--muted)}
.ap3-kpi .was b{display:inline;font-size:13.5px;font-weight:800;color:var(--ink);letter-spacing:0}
.ap3-kpi .was i{font-style:normal;font-weight:800;margin-left:6px;color:var(--ap-pos-ink)}
.ap3-kpi .was i.dn{color:var(--ap-neg-ink)}
.ap3-kpi .d.dn{color:var(--ap-neg-ink)}
.ap3-nbwarn .q{color:var(--muted)}
.ap3-kpinb{grid-column:1 / -1;font-size:12.5px;color:var(--muted);margin-top:-4px}
.ap3-kpinb b{color:var(--ink)}
/* the new-base cards (2026-09-29) */
.ap3-nbwrap{margin:0 0 18px}
.ap3-nbh{display:flex;align-items:baseline;gap:10px;margin:0 0 8px}
.ap3-nbh b{font-size:15px;color:var(--ink)} .ap3-nbh span{font-size:12.5px;color:var(--muted)}
.ap3-nbwarn{margin:0 0 10px;padding:8px 12px;border-radius:var(--ap-r2);border:1px solid var(--ap-warn-ink);
  background:color-mix(in srgb,var(--warn) 10%,transparent);font-size:13px;color:var(--ink)}
.ap3-nbs{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:12px}
.ap3-nb{border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);padding:12px 14px;min-width:0;opacity:.86}
.ap3-nb.on{opacity:1;border-color:var(--brand-d);box-shadow:inset 0 3px 0 var(--brand-d)}
.ap3-nb .h{display:flex;align-items:center;gap:8px;margin:0 0 8px}
.ap3-nb .h b{font-size:15.5px;color:var(--ink)}
.ap3-nb .stp{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);
  border:1px solid var(--line);border-radius:6px;padding:1px 6px}
.ap3-nb .pill{margin-left:auto;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}
.ap3-nb .pill.conf{background:var(--brand-glow);border-color:var(--brand-d);color:var(--brand-d)}
.ap3-nb .pill.exp{border-color:var(--ap-warn-ink);color:var(--ap-warn-ink)}
.ap3-nb .ctl{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 10px}
.ap3-nb .ap3-conf{font-size:12px;padding:5px 10px}
.ap3-nb .dials{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:0 0 10px}
.ap3-nb .dials label{display:flex;flex-direction:column;gap:3px;font-size:11px;font-weight:800;text-transform:uppercase;
  letter-spacing:.04em;color:var(--muted)}
.ap3-nb .dials input{font:inherit;font-size:15px;font-weight:800;text-transform:none;letter-spacing:0;width:100%;
  padding:5px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink);font-variant-numeric:tabular-nums}
.ap3-nb .dials input:focus-visible{outline:2px solid var(--brand-d);outline-offset:0}
.ap3-nb .dials small{font-size:11px;font-weight:600;text-transform:none;letter-spacing:0;color:var(--faint)}
.ap3-nb ul{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.ap3-nb li{display:grid;grid-template-columns:70px minmax(0,1fr);gap:8px;font-size:13.5px;line-height:1.4;color:var(--ink)}
.ap3-nb li i{font-style:normal;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding-top:3px}
.ap3-nb li small{display:block;color:var(--faint);font-size:11.5px}
.ap3-nb .by{margin-top:8px;font-size:11.5px;color:var(--muted)}
/* second pass (2026-09-29): the market switch, YES / NO bases, the side panel, the glance */
.ap3-market{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}
.ap3-market label{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
.ap3-seg.big button{font-size:14px;padding:8px 14px;min-height:38px}
.ap3-kpi .d{display:block;margin-top:4px;font-style:normal;font-size:12.5px;font-weight:800;color:var(--ap-pos-ink)}
.ap3-nb{opacity:1}
.ap3-nb .h{justify-content:space-between}
.ap3-yn{display:inline-flex;border:1px solid var(--line-2);border-radius:999px;overflow:hidden;background:var(--panel)}
.ap3-yn button{font:inherit;font-size:13px;font-weight:800;padding:6px 16px;border:0;background:transparent;color:var(--muted);cursor:pointer;min-height:34px}
.ap3-yn button.on{background:var(--ap-sub);color:var(--ink)}
.ap3-yn button.on.yes{background:var(--brand-d);color:#fff}
.ap3-yn button:focus-visible{outline:2px solid var(--brand-d);outline-offset:-2px}
.ap3-nb .if{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--faint);margin:0 0 2px}
.ap3-nb:not(.on) .big,.ap3-nb:not(.on) .nums{opacity:.62}
.ap3-nb .big{font-size:15px;color:var(--ink);margin:0 0 10px}
.ap3-nb .big b{font-size:28px;font-weight:800;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.ap3-nb .big small{display:block;font-size:12px;color:var(--muted);margin-top:1px}
.ap3-nb .nums{display:grid;grid-template-columns:1fr 1fr;gap:8px 12px;margin:0 0 10px}
.ap3-nb .nums span{font-size:12.5px;color:var(--muted);line-height:1.3}
.ap3-nb .nums b{font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
.ap3-nb .nums small{display:block;font-size:11px;color:var(--faint)}
.ap3-nbh .ap3-pick{margin-left:auto;padding:4px 12px;font-size:12.5px;white-space:nowrap}
.ap3-nbh .ap3-pick.on{border-color:var(--brand-d);color:var(--brand-d)}
.ap3-nbh span em{font-style:normal;font-weight:700;color:var(--brand-d)}
.ap3-picking .leaflet-container,.ap3-picking .leaflet-interactive,.ap3-picking .leaflet-grab{cursor:crosshair !important}
.ap3-nb .opened{margin-top:10px;display:grid;gap:5px}
.ap3-nb .opened div{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--ink)}
.ap3-nb .opened div small{margin-left:auto;color:var(--faint);white-space:nowrap}
.ap3-nb .opened>small{font-size:11.5px;color:var(--faint)}
.ap3-det .ap3-nb{border:0;padding:0;background:none}
.ap3-nb .assume{font-size:12px;color:var(--ap-warn-ink);margin:0 0 8px;line-height:1.4}
.ap3-nb .ground{font-size:12.5px;color:var(--ink);padding-top:8px;border-top:1px solid var(--ap-rule);line-height:1.8}
.ap3-nb .ground small{display:block;color:var(--muted);font-size:11.5px;line-height:1.4}
.ap3-nb .tchip{display:inline-block;font-style:normal;font-size:11px;font-weight:800;padding:0 7px;margin-left:4px;border-radius:6px;color:#fff}
.ap3-side{min-width:0}
.ap3-det{height:min(78vh,860px);min-height:560px;overflow-y:auto;border:1px solid var(--ap-rule);border-radius:var(--ap-r1);background:var(--ap-bay);padding:12px 16px 16px}
.ap3-back{font:inherit;font-size:12.5px;font-weight:700;border:0;background:transparent;color:var(--brand-d);cursor:pointer;padding:2px 0 10px}
.ap3-det .dh b{display:block;font-size:19px;font-weight:800;color:var(--ink);line-height:1.2}
.ap3-det .dh span{font-size:12.5px;color:var(--muted)}
.ap3-det .tierline{display:flex;align-items:center;gap:8px;margin:10px 0 2px;font-size:14px;font-weight:800;color:var(--ink)}
.ap3-det .tierline i{width:14px;height:14px;border-radius:4px}
.ap3-det .why{font-size:12.5px;color:var(--muted)}
.ap3-det .was{margin-top:6px;font-size:12.5px;font-weight:800;color:var(--ap-pos-ink)}
.ap3-det .sec{margin:14px 0 4px;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--muted)}
.ap3-det .kv{display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--ap-rule);font-size:13.5px;color:var(--ink)}
.ap3-det .kv span small{display:block;font-size:11px;color:var(--faint)}
.ap3-det .kv b{font-variant-numeric:tabular-nums;white-space:nowrap}
.ap3-det .ap2-tip{padding:0;min-width:0;max-width:none}
.ap3-glance{min-width:210px}
.ap3-glance .g3{display:grid;grid-template-columns:repeat(3,auto);gap:4px 14px;margin-top:6px}
.ap3-glance .g3 span{font-size:11px;color:var(--muted)}
.ap3-glance .g3 b{display:block;font-size:16px;color:var(--ink);font-variant-numeric:tabular-nums}
.ap3-glance .g3 small{display:block;font-size:10px;color:var(--faint)}
.ap3-glance .hint{margin-top:7px;font-size:11px;color:var(--faint)}
@media (max-width:1100px){.ap3-mapgrid{grid-template-columns:1fr}.ap3-list{height:520px;min-height:0}.ap3-det{height:auto;min-height:0}
  .ap3-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width:560px){.ap3-kpi b{font-size:24px}.ap3-mapgrid .ap2-mapbox{min-height:420px;height:60vh}
  .ap3-list .cols,.ap3-list .r{grid-template-columns:22px minmax(0,1fr) 46px 40px 64px}}
/* the fleet, as chips: a number, what it is, and the one line that qualifies it */
.ap2-chips3{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.ap2-chips3 .ap2-chip3{display:flex;flex-direction:column;gap:1px;padding:7px 12px;border:1px solid var(--ap-rule);
  border-radius:var(--ap-r2);background:var(--ap-surface-2);min-width:112px;cursor:help}
.ap2-chips3 .ap2-chip3 b{font-size:19px;font-weight:800;line-height:1.05;letter-spacing:-.01em}
.ap2-chips3 .ap2-chip3 span{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.ap2-chips3 .ap2-chip3 small{font-size:11px;color:var(--muted)}
.ap2-chips3 .ap2-chip3:hover{border-color:var(--ink)}
/* the tooltip is Leaflet's, so it is styled through its own wrapper class */
/* WHITE-SPACE: NOWRAP IS LEAFLET'S OWN DEFAULT and it was never overridden -- which is why the
   long Census line ran straight out of the white box instead of wrapping inside it (his screenshot,
   2026-09-22: "the tooltip is a little damaged"). max-width could not bite while nowrap held. The
   wrapper is the element Leaflet sizes, so the width belongs here and not on .ap2-tip. */
.leaflet-tooltip.ap2-tipwrap{background:var(--ap-bay);color:var(--ink);border:1px solid var(--ap-rule-2);
  border-radius:var(--ap-r2);box-shadow:0 10px 30px rgba(0,0,0,.34);padding:13px 15px;font-family:inherit;
  white-space:normal;width:340px;max-width:min(340px,86vw);opacity:1}
.leaflet-tooltip.ap2-tipwrap:before{display:none}
/* sized for a projector, not a laptop: this is the one page that gets presented */
.ap2-tip{font-size:14px;line-height:1.5}
.ap2-tip b{font-size:16px;color:var(--ink)}
.ap2-tip .t{font-family:var(--ap-mono);font-size:12px;letter-spacing:.04em;color:var(--ap-live);margin:2px 0 7px}
.ap2-tip .b{margin-top:7px;padding-top:7px;border-top:1px solid var(--ap-rule);color:var(--ink);font-weight:700}
.ap2-tip .c{color:var(--muted)}
.ap2-tip .w{margin-top:6px;color:var(--ap-neg-ink);font-weight:700}
.ap2-tip small{display:block;color:var(--muted);font-weight:400;font-size:12px;line-height:1.4}
.ap2-tip .big{font-size:19px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}
/* a fact grid, so a dozen numbers read as a table and not as a paragraph */
.ap2-tip .grid{display:grid;grid-template-columns:1fr auto;gap:3px 12px;margin-top:8px;
  padding-top:8px;border-top:1px solid var(--ap-rule);font-size:13px}
.ap2-tip .grid i{font-style:normal;color:var(--muted)}
.ap2-tip .grid u{text-decoration:none;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.ap2-tip .hd{font-family:var(--ap-mono);font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--faint);margin:10px 0 1px}

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

  /* THE CAPTURE ARITHMETIC, PURE AND TESTED (2026-09-24 review). The units fix -- a capture point is
     a YEAR of leads per 10,000 movers, and the plan beside it is a May-Aug SEASON -- lived inline in
     scenarioCalc, xpFor and the expansion card, and the only test pinned the Python mirror
     (area_plan.season_leads) that the page never reads: a regression back to year-leads passed all
     45 tests. Every capture figure on the page now goes through these functions, and
     tests/test_area_plan.py runs them under Node.
       seasonLeads  points x movers / 10,000 = a year of leads; x the season's share = the season's
       row          one state's lever: from `now` to `want`, at its own leads per job, with no ad
                    cost when the capture arrives through a listing
       lpj          a state's OWN last-season leads per job once it ran 10+ jobs (Maryland 192 / 23
                    = 8.3, against the company's 5.61), else the plan's, else the company's
       counts       whether a scenario's capture enters the Season total: not when its targets are
                    CEILINGS (the expansion card, and the what-if opened from it) */
  const AP_CAPTURE = (function () {
    const SHARE_FALLBACK = 0.448;   // the critic's all-company Apr-Jul share, used only without the clock
    const seasonLeads = (pts, movers, share) => {
      const year = (+pts || 0) * (+movers || 0) / 10000;
      return { year, season: year * (+share || 0) };
    };
    const share = clk => (clk && +clk.season_share > 0) ? +clk.season_share : SHARE_FALLBACK;
    const lpj = (r, lpjAll) => {
      if (r && r.lpjOwn && r.leadsPerJob) return { lpj: r.leadsPerJobBuilt || r.leadsPerJob, own: true };
      if (r && r.jobsLast >= 10 && r.leadsLast > 0) return { lpj: r.leadsLast / r.jobsLast, own: true };
      return { lpj: (r && r.leadsPerJob) || lpjAll || null, own: false };
    };
    const row = o => {
      const r = { now: o.now, want: o.want, movers: o.movers, lpj: o.lpj, viaListing: !!o.viaListing,
                  cpl: o.viaListing ? 0 : o.cpl };
      if (o.want != null && o.now != null && o.lpj && o.movers && o.want > o.now) {
        const L = seasonLeads(o.want - o.now, o.movers, o.share);
        r.pts = o.want - o.now;
        r.addLeadsYear = L.year;
        r.addLeads = L.season;
        r.addJobs = L.season / o.lpj;
        r.addMkt = r.cpl != null ? L.season * r.cpl : 0;
      }
      return r;
    };
    const counts = (scn, opts) => (opts && opts.capture != null) ? !!opts.capture : !(scn && scn.ceiling);
    return { SHARE_FALLBACK, seasonLeads, share, lpj, row, counts };
  })();

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
      RS.load("area_tier").catch(() => null),
    ]).then(([rows, model, cityAll, wsAll, countyRows, cityAllSeason, pcm, tierRows]) => {
      const PCM = pcm || [];
      /* the four-tier areas, indexed per level by `Area Key` (zip / "ST|City" / "ST|County") */
      /* `let`: the new-base toggles swap in re-tiered copies (nbApplyAreas, below) */
      let AREA = Array.isArray(tierRows) ? tierRows : [];
      let AREA_IX = { County: {}, City: {}, Zip: {} };
      AREA.forEach(a => { if (AREA_IX[a.Level]) AREA_IX[a.Level][a["Area Key"]] = a; });
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
      /* CAPTURE IS A TRAILING YEAR (his call 2026-09-23). Leads per 10,000 movers used this
         year's leads over a whole year of movers, so it read low -- Pennsylvania 36.9 in September
         against ~46-48 on a full year. Every capture on the page (the survey card, the map, the
         flags, the what-if dial, the decided expansion) now reads `Leads 12m` through these
         helpers, so they cannot disagree. Until the county mart is rebuilt with that column they
         fall back to the year-to-date count and SAY so ("this year to date"), never mislabelled.
         `Leads` itself stays year-to-date: the tier, the budget share and "leads this year" use it. */
      const HAS_L12 = COUNTY.some(c => c["Leads 12m"] != null);
      const lead12 = c => num(HAS_L12 ? c["Leads 12m"] : c.Leads);
      const CAP_WIN = HAS_L12 ? "the last 12 months" : "this year to date";
      const CAP_WIN_SHORT = HAS_L12 ? "last 12 months" : "this year";
      /* capture per state off the county rows: {st: {leads, movers, cap}} -- the live numbers the
         page copy quotes instead of the "66 at home, 6 in Maryland, 0.6 in Virginia" it once hardcoded */
      const CAP_ST = (() => { const o = {};
        COUNTY.forEach(c => { if (!SERVICE_AREAS.includes(c.State)) return;
          const mv = num(c["Movers Per Year"]); if (!mv) return;
          const g = o[c.State] = o[c.State] || { st: c.State, leads: 0, movers: 0 };
          g.leads += lead12(c); g.movers += mv; });
        Object.values(o).forEach(g => { g.cap = g.movers ? 10000 * g.leads / g.movers : null; });
        return o; })();
      const capOfSt = st => (CAP_ST[st] && CAP_ST[st].cap != null) ? CAP_ST[st].cap : null;
      /* ONE DEFINITION, EVERY SENTENCE (2026-09-23 review): the dial, xpFor, the headline, the map
         and the flags each summed `Leads 12m` their own way -- some over every county in the state,
         some only where the survey has movers -- so a county with leads but no ACS match made the
         expansion card say "at or under today's X" beside "demand is proven at Y". All of them now
         read CAP_ST, which counts a county's leads only where it also counts its movers. */
      const capAll = sts => { let l = 0, m = 0;
        (sts || Object.keys(CAP_ST)).forEach(st => { const g = CAP_ST[st]; if (g) { l += g.leads; m += g.movers; } });
        return { leads: l, movers: m, cap: m ? 10000 * l / m : null }; };
      const CAP_HOME = Object.keys(CAP_ST).sort((a, b) => CAP_ST[b].leads - CAP_ST[a].leads)[0] || null;
      const ST_NAME = { NJ: "New Jersey", PA: "Pennsylvania", NY: "New York", DE: "Delaware", CT: "Connecticut",
                        MA: "Massachusetts", MD: "Maryland", VA: "Virginia", RI: "Rhode Island", NH: "New Hampshire" };
      /* "66.1 leads per 10,000 movers at home in New Jersey, 6.1 in Maryland and 0.6 in Virginia" -- live */
      const capSay = (others) => {
        if (!CAP_HOME || capOfSt(CAP_HOME) == null) return "";
        const rest = (others || ["MD", "VA"]).filter(st => st !== CAP_HOME && capOfSt(st) != null)
          .map(st => r1(capOfSt(st)) + " in " + (ST_NAME[st] || st));
        return r1(capOfSt(CAP_HOME)) + " leads per 10,000 movers at home in " + (ST_NAME[CAP_HOME] || CAP_HOME) +
          (rest.length ? ", " + (rest.length > 1 ? rest.slice(0, -1).join(", ") + " and " + rest[rest.length - 1] : rest[0]) : "") +
          " (" + CAP_WIN + ")";
      };
      /* LEADS WITH NO ADDRESS (2026-09-24). When a lead is created without an address Moveboard fills
         in our own office ('Tinton fall, NJ, 07753'), and fct_moveboard now leaves those leads out of
         every county: 568 in the last 12 months, all New Jersey. So Monmouth's leads, booking rate,
         capture and budget share drop them (Leads 12m 1,509 -> 910, capture 272.9 -> 164.6, share of
         the NJ budget 20.4% -> 13.1%), and so does home capture (86.1 -> 79.4); the state plan still
         counts them in New Jersey. The page says so where those figures are read. `State No Address
         Leads 12m` is a STATE figure repeated on each of the state's county rows: read it once per
         state, never sum it down the column. Before the county mart is rebuilt it is absent and the
         note stays silent. */
      const NOADDR_ST = (() => { const o = {};
        COUNTY.forEach(c => { if (!(c.State in o) && c["State No Address Leads 12m"] != null) o[c.State] = num(c["State No Address Leads 12m"]); });
        return o; })();
      const noAddrSay = () => {
        const sts = Object.keys(NOADDR_ST).filter(st => NOADDR_ST[st] > 0).sort((a, b) => NOADDR_ST[b] - NOADDR_ST[a]);
        if (!sts.length) return "";
        const n = sts.reduce((a, st) => a + NOADDR_ST[st], 0);
        const where = sts.length > 1 ? " (" + sts.map(st => fmtN(NOADDR_ST[st]) + " in " + (ST_NAME[st] || st)).join(", ") + ")" : "";
        const whose = sts.length > 1 ? "each state’s" : (ST_NAME[sts[0]] || sts[0]) + "’s";
        return "<b>" + fmtN(n) + " leads</b>" + where + " in the last 12 months came with no address — Moveboard fills in our own office — " +
          "so they are in no county: no county’s leads, capture or budget share count them, and " + whose +
          " capture leaves them out. The state plan still counts them.";
      };
      /* the same fact in a clause, for the places that already carry the sentence above nearby */
      const noAddrShort = () => {
        const n = Object.values(NOADDR_ST).reduce((a, v) => a + (v > 0 ? v : 0), 0);
        return n ? fmtN(n) + " leads with no address (Moveboard fills in our office) are in no county, so no capture here counts them" : "";
      };
      /* LONG ISLAND SOUND IS A BARRIER (2026-09-24): the rule of the county, city and white-space
         marts and of area_plan.py (_across_sound). No bridge or tunnel crosses the Sound, so a
         Connecticut base never reaches Nassau or Suffolk and a yard on either shore never reaches
         the other. The model tags its jobs, white-space zips and bases with their shore ('CT' / 'LI' /
         ''); a county row is tagged here. Without it the CT base's hover counted Suffolk's leads as
         within 35 miles while Suffolk's own row on the map said 50.9 miles to Brooklyn. */
      const sideOf = (st, county) => st === "CT" ? "CT"
        : (st === "NY" && (county === "Nassau" || county === "Suffolk")) ? "LI" : "";
      const acrossSound = (a, b) => (a === "CT" && b === "LI") || (a === "LI" && b === "CT");
      /* THE CAPTURE CLOCK (2026-09-24), from model.capture_clock (area_plan.build_capture_clock).
         `level` is Zip to Zip's latest three COMPLETE months, seasonally adjusted, per 10,000 movers
         a year -- his 16 Sep "focus only on ZIP". The 12-month figure above (CAP_ST) stays the
         page's dial and stays all-company, so the card says what the gap between them is: Tuji's
         leads (about 1.5 in Maryland) and the months before the Elkridge listing still in the window.
         No line is fitted and nothing is projected: a one-time jump read as a trend would have
         printed "Maryland reaches 15 in Jul 2027", which nothing measured. */
      const CLK = (model.capture_clock && model.capture_clock.states) ? model.capture_clock : null;
      const clkOf = st => (CLK && CLK.states[st]) || null;
      const runOf = st => { const c = clkOf(st); return c && c.level != null ? +c.level : null; };
      /* THE UNITS FIX (2026-09-24). A capture point is a YEAR of leads per 10,000 movers; the plan
         beside it is a May-Aug SEASON. The season's share is the Apr-Jul lead months' share of a
         year (the 1-month lead->move lag), from the same seasonal index as the clock: 45.1% on
         2023-2025, and falling about 3 points a year (47.7 / 45.4 / 42.1). Mirrors
         area_plan.season_leads(); the arithmetic itself is AP_CAPTURE's (tested under Node).
         0.448 (the critic's all-company figure) only if the clock is missing. */
      const SEASON_SHARE = AP_CAPTURE.share(CLK);
      const SHARE_BY_YEAR = (CLK && CLK.season_share_by_year) || {};
      const shareSay = () => {
        const ys = Object.keys(SHARE_BY_YEAR).sort();
        return Math.round(SEASON_SHARE * 1000) / 10 + "% of a year’s leads arrive in the Apr–Jul months that feed a May–Aug season" +
          (ys.length > 1 ? " (" + ys.map(y => y + " " + Math.round(SHARE_BY_YEAR[y] * 1000) / 10 + "%").join(", ") +
            (SHARE_BY_YEAR[ys[ys.length - 1]] < SHARE_BY_YEAR[ys[0]] ? " — falling about " +
              r1(100 * (SHARE_BY_YEAR[ys[0]] - SHARE_BY_YEAR[ys[ys.length - 1]]) / (ys.length - 1)) + " points a year" : "") + ")"
            : CLK ? "" : " (a fallback: the capture clock is missing from the model)");
      };
      /* the decided expansion's copy carries "{cap:PA}" / "{run:PA}" placeholders, filled here from the same rows */
      const fillCap = s => String(s || "").replace(/\{cap:([A-Z]{2})\}/g, (m, st) => capOfSt(st) != null ? r1(capOfSt(st)) : "—")
        .replace(/\{run:([A-Z]{2})\}/g, (m, st) => runOf(st) != null ? r1(runOf(st)) : "—");
      /* a step's `run` sentence (2026-09-24 review): kept out of `why`, which the page on main also
         reads, and printed only when the clock has every figure it names -- never a bare "—" */
      const runSay = s2 => { const t = String((s2 && s2.run) || ""); const sts = t.match(/\{run:([A-Z]{2})\}/g) || [];
        return t && sts.every(m => runOf(m.slice(5, 7)) != null) ? fillCap(t) : ""; };
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
        scn: null, scnSaved: null,   // the What-if pane (additive keys: never bump LS_KEY for them)
        mapColor: "tier",            // tier | market | capture -- what the county fill means
        mapLevel: "County",          // County | City | Zip -- the map's grain (2026-09-29)
        mapSt: "",                   // "" = every state; City and Zip always draw one state
        listTier: 0,                 // the ranked list's tier filter, 0 = all
      }, saved);
      /* THE WHAT-IF'S OWN STATE. Every lever starts at "change nothing", so the pane opens showing
         the plan as it stands and every number he then sees is something he moved himself. */
      // `listing` (2026-09-24, additive): states whose capture arrives through a Business Profile, so no ad cost
      // `ceiling` (2026-09-24 review, additive): the typed targets are ceilings -- priced, but kept out
      // of the Season total, exactly as on the expansion card. Both show as controls on the pane.
      const SCN0 = { zip: "", picks: [], listing: [], ceiling: false, maturity: 0, capture: {}, budgetPct: 0, elast: 0, surgeDays: 0,
                     surgeCrews: 0, crews: 0, park: 800 };
      inputs.scn = Object.assign({}, SCN0, inputs.scn || {});
      inputs.scn.capture = Object.assign({}, (inputs.scn || {}).capture || {});
      inputs.scn.picks = Array.isArray(inputs.scn.picks) ? inputs.scn.picks : [];
      inputs.scn.listing = Array.isArray(inputs.scn.listing) ? inputs.scn.listing : [];
      if (["tier", "market", "capture", "spend"].indexOf(inputs.mapColor) < 0) inputs.mapColor = "tier";
      if (["County", "City", "Zip"].indexOf(inputs.mapLevel) < 0) inputs.mapLevel = "County";
      if (inputs.mapSt && SERVICE_AREAS.indexOf(inputs.mapSt) < 0) inputs.mapSt = "";
      if ([0, 1, 2, 3, 4].indexOf(+inputs.listTier) < 0) inputs.listTier = 0;
      /* ===================== NEW BASES: A YES / NO TEST SCENARIO (2026-09-29) =====================
         His ask: "if we open montgomery - how our marketing budgets and core areals should adjust ...
         sales quantity, foreman quantity on that base - total budget increase". Second pass the same
         day, after using it: "i got it now... its some kind of test scenario thing - if i refresh it,
         it should go back to no", "without this extra confirmations", "remove the bases from charles
         city and chesapeake - they are too far", and "after i enabled MONROE ... it still has all red
         ... what is our expectation, how many jobs will it generate".
         So:
           * YES / NO per base, held in memory only: every load starts at NO, nothing is saved.
           * The Virginia candidates are not offered (his call: too far to go now).
           * THE EXPECTATION IS MEASURED, NOT TYPED. For every county a base brings within 50 miles
             (whatever its tier -- Monroe's biggest ground, Lackawanna and Luzerne, is Tier 4 on its
             market and the first version gave it nothing), the leads a year are its movers x what
             counties OF THE SAME TIER already within reach of a base send us today, and the jobs are
             those leads x that tier's own jobs per lead. Established ground took years; Season 2027
             counts HALF of it (his pick), and the card also says the full rate "once established".
             Delaware is left out of the yardstick: Tuji's leads inflate it.
           * Those jobs go INTO nextCalc() as extra forecast for their states, so the crew pools, the
             sales desk, the trucks and the marketing (leads x cost per lead) all follow.
         The tiers move too: a new base changes every nearby area's distance, so distance is re-scored
         on the mart's own ladders (a measured area keeps its booking, ticket and CF points; a
         market-rated one falls under the 50-mile rule or out of it). */
      const AREA_BASE = AREA.slice();
      const NB_YEAR1 = 0.5;
      const NB_CUT = { t1: num(OVR.tier_cut_1) || 72, t2: num(OVR.tier_cut_2) || 64, t3: num(OVR.tier_cut_3) || 56 };
      const pDistOf = mi => mi <= 20 ? 30 : mi <= 30 ? 25 : mi <= 60 ? 20 : mi <= 90 ? 15 : mi <= 120 ? 10 : mi <= 150 ? 5 : 0;
      const NB_HIDE = st => st === "VA";          // his call 2026-09-29: Charles City and Chesapeake are too far
      const NB_CANDS = ((model.depots || {}).coverage || []).filter(c => c.lat && c.lon && c.label && !NB_HIDE(c.st))
        .map(c => ({ label: c.label, st: c.st, la: +c.lat, lo: +c.lon, county: c.county || "", side: sideOf(c.st, c.county),
                     step: c.step || null, zip: c.zip || "" }));
      /* the yardstick: leads a year per 10,000 movers and jobs per lead, by tier, over the counties
         already within 50 miles of a base (Delaware out) */
      const NB_RATE = (() => { const g = {};
        AREA_BASE.forEach(a => { if (a.Level !== "County" || !SERVICE_AREAS.includes(a.State) || a.State === "DE") return;
          if (num(a["Miles To Base"]) > 50 || !num(a["Movers Per Year"])) return;
          const t = num(a.Tier); if (!(t >= 1 && t <= 4)) return;
          const x = g[t] = g[t] || { leads: 0, movers: 0, jobs: 0 };
          x.leads += num(a["Leads 12m"]); x.movers += num(a["Movers Per Year"]); x.jobs += num(a["Jobs 12m"]); });
        const out = {};
        [1, 2, 3, 4].forEach(t => { const x = g[t];
          out[t] = x && x.movers && x.leads ? { cap: 10000 * x.leads / x.movers, jpl: x.jobs / x.leads } : { cap: 0, jpl: 0 }; });
        return out; })();
      /* the scenario: which bases are YES, in memory only (a refresh is back to NO) */
      const NB_ON = {};
      const TR_OWN = {};         // owned trucks at a base as he set them (blank = the register); memory only
      const trAny = () => Object.keys(TR_OWN).length > 0;
      const NB_FM = {};          // a YES base's crew as he set it (blank = suggested); memory only
      const nbOf = label => ({ on: !!NB_ON[label] });
      /* ANY POINT ON THE MAP AS A BASE (his ask 2026-09-30: "click any point on the map and see what
         it gives us - what coverage, average value and etc"). The point becomes one more candidate,
         named after the county it stands in, switched to Yes at once -- so it is measured by exactly
         the rules the three listed candidates are. One at a time, memory only: a new pick replaces
         the old one, Reset removes it. */
      /* ===================== NAMED PLANS: MAX (MID and MIN to follow) =====================
         His table, 2026-09-30 ("create a new click for MAX PLAN where this bases and numbers will
         appear. then we will create MIN and MID as well"): every base he would run, existing and
         new, with the crews he would put there. His three answers:
           * CREWS DRIVE THE PLAN. A group's jobs are what its crews can carry. A new base that
             opens ground first takes the crews that ground needs (no more than it was given --
             Montgomery has 2 of the 4 its ground would want, so its jobs are cut to match,
             NB_CAP); whatever is left in the group works the ground we already cover, and that
             pool's jobs are scaled to it exactly as the What-if levers scale them.
           * NY IS ITS OWN CARD. NJ and NY are still one crew pool to the engine -- the same crews
             cross the river -- so the two cards add into one target.
           * PATERSON IS THE UPPER PART OF PATERSON NJ; Middlesex is the centre of Middlesex
             County CT. Both stand inside ground we already cover: they open no county, they only
             put crews nearer, so they are pins on the map and crews in their pool.
         A plan is a test scenario like everything else on this tab: memory only, Reset ends it. */
      const PLANS = {
        max: { label: "MAX", groups: [
          { base: "CT", pool: "CT", states: ["CT", "MA"], sites: [
            { name: "Existing base", fm: 3 }, { name: "Tolland", fm: 2, cand: "Tolland CT" },
            { name: "Middlesex", fm: 1, la: 41.476, lo: -72.568 }] },
          { base: "NJ", pool: "NJ", states: ["NJ"], sites: [
            { name: "Existing base", fm: 7 }, { name: "Paterson (upper)", fm: 3, la: 40.94, lo: -74.165 }] },
          { base: "NY", pool: "NJ", states: ["NY"], sites: [{ name: "Existing base", fm: 2 }] },
          { base: "PA", pool: "PA", states: ["PA", "DE"], sites: [
            { name: "Existing base", fm: 7 }, { name: "Monroe", fm: 2, cand: "Monroe PA" }] },
          { base: "MD", pool: "PA", states: ["MD", "VA"], sites: [{ name: "Montgomery", fm: 2, cand: "Montgomery MD" }] },
        ] },
      };
      let PLAN = null;           // the active plan: an editable copy of one of PLANS, with its key
      const NB_CAP = {};         // a new base given fewer crews than its ground needs: the share of its jobs it can carry
      const planSite = label => { let hit = null;
        if (PLAN) PLAN.groups.forEach(g => g.sites.forEach(x => { if (x.cand === label) hit = x; })); return hit; };
      function planEnd() { PLAN = null; Object.keys(NB_CAP).forEach(k => delete NB_CAP[k]); }
      function planApply() {
        if (!PLAN) return;
        [NB_ON, NB_FM, NB_CAP, TR_OWN].forEach(o => Object.keys(o).forEach(k => delete o[k]));
        nbPickClear();
        PLAN.groups.forEach(g => g.sites.forEach(x => { if (x.cand && x.fm > 0 && NB_CANDS.some(c => c.label === x.cand)) NB_ON[x.cand] = true; }));
        nbApplyAreas();
        const N1 = nextCalc({ mult: {} });            // what each new base's own ground needs, uncapped
        const targets = {};
        PLAN.groups.forEach(g => { let crew = 0;
          g.sites.forEach(x => { crew += x.fm;
            if (!x.cand || !NB_ON[x.cand]) return;
            const o = (N1.nb || []).find(q => q.label === x.cand), need = o ? o.fmSuggested : 1;
            const use = Math.max(1, Math.min(x.fm, need));
            NB_FM[x.cand] = use; if (use < need) NB_CAP[x.cand] = use / need;
            crew -= use; });
          targets[g.pool] = (targets[g.pool] || 0) + Math.max(0, crew); });
        SC.kind = "plan"; SC.pool = null; SC.target = null; SC.targets = targets;
      }
      let PICK = false;
      function nbPickClear() {
        const i = NB_CANDS.findIndex(c => c.custom); if (i < 0) return;
        const l = NB_CANDS[i].label; NB_CANDS.splice(i, 1);
        delete NB_ON[l]; delete NB_FM[l]; delete TR_OWN[l];
      }
      function nbPickAt(la, lo) {
        let best = null, bd = Infinity;
        AREA_BASE.forEach(a => { if (a.Level !== "County" || !num(a.Latitude)) return;
          const d = miBetween(num(a.Latitude), num(a.Longitude), la, lo); if (d < bd) { bd = d; best = a; } });
        if (!best) return null;
        nbPickClear();
        const label = "Picked point · " + best.County + " " + best.State;
        NB_CANDS.push({ label, st: best.State, la, lo, county: best.County, side: sideOf(best.State, best.County),
                        step: null, zip: "", custom: true });
        NB_ON[label] = true;
        return label;
      }
      /* re-tier one area against a set of new bases: null when no new base is nearer */
      function tierWith(a, bases) {
        const mi0 = num(a["Miles To Base"]);
        let mi = mi0, base = a["Nearest Base"];
        const side = sideOf(a.State, a.County || "");
        bases.forEach(b => { if (acrossSound(b.side, side)) return;
          const d = miBetween(num(a.Latitude), num(a.Longitude), b.la, b.lo);
          if (d < mi) { mi = d; base = b.label; } });
        if (!(mi < mi0 - 0.05)) return null;
        let t;
        if (a["Tier Source"] === "Our data") {
          const s = num(a["Data Score"]) - num(a["Score Distance"]) + pDistOf(mi);
          t = s >= NB_CUT.t1 ? (mi > 50 ? 2 : 1) : s >= NB_CUT.t2 ? 2 : s >= NB_CUT.t3 ? 3 : 4;
        } else if (a["Market Score"] != null) {
          const m = num(a["Market Score"]);
          t = mi > 50 ? 4 : m >= 80 ? 1 : m >= 55 ? 2 : m >= 30 ? 3 : 4;
        } else return null;
        const reason = a["Tier Source"] === "Our data" ? "Scored on our leads and jobs"
          : mi > 50 ? "Over 50 mi from a base" : "Too few leads to measure - rated on its market";
        return { tier: t, mi, base, reason: reason + " · with " + base };
      }
      const NB_CACHE = {};
      /* the whole effect of a set of new bases: re-tiered areas, and per base the ground it opens,
         the leads and jobs that ground is expected to send, and the counties it now serves nearest */
      function nbEffect(active) {
        const key = active.map(b => b.label + (b.custom ? "@" + b.la.toFixed(3) + "," + b.lo.toFixed(3) : "")).sort().join("|");
        if (NB_CACHE[key]) return NB_CACHE[key];
        const adj = {};
        if (active.length) AREA_BASE.forEach(a => { if (!SERVICE_AREAS.includes(a.State)) return;
          const x = tierWith(a, active); if (x) adj[a.Level + "|" + a["Area Key"]] = x; });
        const per = active.map(b => {
          const opened = [], byState = {};
          let leadsYr = 0, jobsSeason = 0;
          AREA_BASE.forEach(a => {
            if (a.Level !== "County" || !SERVICE_AREAS.includes(a.State)) return;
            const x = adj["County|" + a["Area Key"]];
            if (!x || x.base !== b.label || !(num(a["Miles To Base"]) > 50 && x.mi <= 50)) return;
            const R = NB_RATE[x.tier] || { cap: 0, jpl: 0 };
            const yr = Math.max(0, num(a["Movers Per Year"]) * R.cap / 10000 - num(a["Leads 12m"]));   // what it would add a year, established
            const season = yr * SEASON_SHARE, jobs = season * R.jpl;
            opened.push({ a, tier: x.tier, mi: x.mi, leadsYr: yr, jobsFull: jobs });
            leadsYr += yr; jobsSeason += jobs;
            byState[a.State] = (byState[a.State] || 0) + jobs * NB_YEAR1;
          });
          opened.sort((p, q) => q.jobsFull - p.jobsFull);
          const served = AREA_BASE.filter(a => a.Level === "County" && SERVICE_AREAS.includes(a.State) &&
            ((adj["County|" + a["Area Key"]] || {}).base === b.label) && (adj["County|" + a["Area Key"]] || {}).mi <= 50);
          return { b, opened, leadsYr, jobsFull: jobsSeason, jobsYear1: jobsSeason * NB_YEAR1, byState, served };
        });
        return (NB_CACHE[key] = { adj, per });
      }
      /* which bases a calculation includes: "all" = the scenario, "none" = no new base, {with} adds one,
         {without} leaves one out (a base's own contribution is the plan with it against without it) */
      function nbActive(mode) {
        return NB_CANDS.filter(c => {
          const on = !!NB_ON[c.label];
          if (mode === "none") return false;
          if (mode && mode.without) return on && c.label !== mode.without;
          if (mode && mode.with) return on || c.label === mode.with;
          return on;
        });
      }
      /* THE AREAS EVERY OTHER PART OF THE PAGE READS follow the scenario: a re-tiered row is a copy
         with its tier, reason, distance and nearest base replaced, so the map, the list, the legend,
         the cards and the CSV change without knowing a base was opened */
      function nbApplyAreas() {
        const E = nbEffect(nbActive("all"));
        AREA = AREA_BASE.map(a => { const x = E.adj[a.Level + "|" + a["Area Key"]];
          return x ? Object.assign({}, a, { Tier: x.tier, "Tier Reason": x.reason, "Miles To Base": Math.round(x.mi * 10) / 10,
                                            "Nearest Base": x.base, _nbWas: num(a.Tier) }) : a; });
        AREA_IX = { County: {}, City: {}, Zip: {} };
        AREA.forEach(a => { if (AREA_IX[a.Level]) AREA_IX[a.Level][a["Area Key"]] = a; });
      }
      nbApplyAreas();
      /* ===================== WHAT IF, ON THE MAP (2026-09-30) =====================
         His ask: "we write 18 sales person are required - what if we get 21? similarly, what if we can
         manage more crew in PA? ... once 1 more foreman is needed what will happen with budgets and
         sales persons ... similarly - budget increased - more leads - more sales - more foreman".
         ONE NUMBER IS THE DRIVER, THE REST FOLLOW. Whatever he changes -- the salespeople, one crew
         pool's foremen, the marketing budget -- the plan is scaled to the most work that resource can
         carry (the largest job multiplier at which the plan still needs no more of it than he set),
         and nextCalc() then re-derives everything else with the plan's own measured ratios: jobs a
         foreman, leads a job, dollars a lead, leads a salesperson. It is the plan run backwards --
         what that resource can carry -- not a claim that the jobs arrive; the strip says so.
         A foreman lever scales only its own pool's states; salespeople and budget scale every state.
         Memory only, like the bases: a refresh is back to the plan. */
      /* FOREMEN BY BASE, AND WHAT EACH BASE COVERS (his ask 2026-09-30: "split the bases on the foreman
         quantities, include which covers what - and ... a total"). A state with its own base on the
         register is its own card; a state without one rides the base its crew pool is run from
         (MD and VA from PA, MA from CT). A base's foremen = its states' share of the pool's peak. */
      /* THE CARD IS THE CREW POOL (his correction 2026-09-30: "NJ covers NY, and we had that earlier
         why did you remove it?"). NY and DE are on the register as parking bases with nobody on them;
         their work is run from NJ and PA, so a card each for them split crews that are one crew. */
      const baseOfState = st => POOL_OF[st] || st;
      const baseStates = (N, key) => N.rows.filter(r => baseOfState(r.st) === key).map(r => r.st);
      const baseFm = (N, key) => N.rows.filter(r => baseOfState(r.st) === key).reduce((a, r) => a + (r.fmPeak || 0), 0);
      const baseList = N => { const seen = [];
        N.rows.forEach(r => { const k = baseOfState(r.st); if (seen.indexOf(k) < 0) seen.push(k); });
        return seen.map(k => ({ key: k, states: baseStates(N, k), fm: baseFm(N, k),
          have: N.rows.filter(r => baseOfState(r.st) === k).reduce((a, r) => a + (r.have || 0), 0) })); };
      const SC = { kind: null, pool: null, target: null };
      let SC_MULT = {};
      const scAny = () => !!SC.kind;
      function scSolve() {
        if (!SC.kind) { SC_MULT = {}; return; }
        const P0 = nextCalc({ mult: {} });
        if (SC.kind === "plan") {            // a named plan: every pool scaled to its own crews, independently
          const out = {};
          Object.keys(SC.targets || {}).forEach(pk => {
            const sts = baseStates(P0, pk), b = m => { const o = {}; sts.forEach(st => { o[st] = m; }); return o; };
            let lo = 0.1, hi = 6, t = SC.targets[pk];
            const least = baseFm(nextCalc({ mult: b(lo) }), pk); if (t < least) t = least;
            for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2;
              if (baseFm(nextCalc({ mult: b(mid) }), pk) <= t) lo = mid; else hi = mid; }
            sts.forEach(st => { out[st] = lo; });
          });
          SC_MULT = out; return;
        }
        const states = SC.kind === "fm" ? baseStates(P0, SC.pool) : P0.rows.map(r => r.st);
        const build = m => { const o = {}; states.forEach(st => { o[st] = m; }); return o; };
        const metric = N => SC.kind === "fm" ? baseFm(N, SC.pool)
                          : SC.kind === "fmAll" ? N.tot.peak
                          : SC.kind === "sales" ? N.sales.peak : N.tot.mkt;
        let lo = 0.1, hi = 6;
        /* THE FLOOR (2026-09-30, "deducing foreman quantity resulted from 23 to 20"). A crew pool is
           never sized below the load it carried last season, so the foremen cannot go under the
           crews that ran it (20) however few jobs are forecast. A target under that had no answer,
           and the search fell to its lower bound: one more click took the plan from 1,783 jobs to
           204 with the foremen still at 20. The target now stops at the lowest number the plan can
           reach. (23 -> 20 itself is arithmetic, not a fault: each pool rounds its crews up, and at
           exactly last season's jobs all three pools shed their extra crew together.) */
        const least = metric(nextCalc({ mult: build(lo) }));
        if (SC.target < least) SC.target = least;
        /* AND THE WAY BACK UP: 21 and 22 foremen do not exist (the pools step together), so a "+"
           from 20 asked for 21, got the largest plan that fits in 21 -- which is 20 -- and the
           button did nothing. Going up, the target moves to the first number the plan can reach. */
        if (SC.dir > 0) { let a = lo, b = hi;
          for (let i = 0; i < 20; i++) { const mid = (a + b) / 2;
            if (metric(nextCalc({ mult: build(mid) })) >= SC.target) b = mid; else a = mid; }
          SC.target = Math.max(SC.target, metric(nextCalc({ mult: build(b) }))); }
        SC.dir = 0;
        for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2;
          if (metric(nextCalc({ mult: build(mid) })) <= SC.target) lo = mid; else hi = mid; }
        SC_MULT = build(lo);
      }
      inputs.scnSaved = Array.isArray(inputs.scnSaved) ? inputs.scnSaved : [];
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
      /* AND THE SAME FOR THE FORECAST METHOD, ONCE (2026-09-22). The default moved from "last season
         x growth" to the 3-season average, and a click on the method picker is saved per browser --
         so every browser that had ever touched it, including his and Giga's, would have gone on
         showing 1,998 jobs and a $402k budget while the model said 1,692 and $346k, and the change
         would have looked like it never shipped. The saved value is dropped ONCE, against a marker,
         so this never fights a choice made after today: click a method now and it sticks. */
      if (!inputs.methodReset0922) { inputs.method = null; inputs.methodReset0922 = 1; }
      /* the default moved again on 2026-09-30 (the marketing trend); same one-time drop, its own marker */
      if (!inputs.methodReset0930) { inputs.method = null; inputs.methodReset0930 = 1; }
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

      /* THE DESK RATE IS LAST SEASON'S, WHATEVER THE CAPACITY CHECK IS LOOKING AT (audit 2026-09-22).
         The leads-per-salesperson dial sizes the NEXT season's desk, but it was seeded from the
         Capacity check's PERIOD and re-seeded on every period change -- so picking "March" on a
         what-if about the past moved the 2027 salespeople, under a lede that says the period picker
         does not move these numbers. $ per lead was pinned for exactly this reason; this was not.
         Seeded from the months last season's leads arrived in (season months, a year and a lag back). */
      function seasonDesk() {
        const F0 = model.forecast || {}, lag = F0.lead_lag_months || 1;
        const first = Object.values(F0.states || {})[0] || { months: {} };
        const yms = (F0.months || []).map(m => F0.year + "-" + String(m).padStart(2, "0"))
          .filter(ym => !((first.months || {})[ym] || {}).shoulder)
          .map(ym => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 - 12 - lag, 1);
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); });
        return yms.length ? aggMeasured(yms) : {};
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
          inputs.leadsPerRep = num(OVR.leads_per_rep) || seasonDesk().leadsPerRep || P.M.leadsPerRep || 140;
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
          '<div class="panel"><div class="panel-head"><div class="panel-title">Distance, and how much of it is really distance</div></div>' +
            '<div class="ap2-say">Booking rate and revenue per lead by how far the city sits from its nearest base. The gap is real; <b>most of it is not the drive</b> — read the line under the ladder before using it to place a base.</div>' +
            lad.map(x => '<div class="ap2-lad"><span>' + esc(x.label) + '</span>' +
              '<span class="t"><i style="width:' + Math.max(3, (x.pct || 0) / maxPct * 100) + '%"></i></span>' +
              '<span class="v"><b>' + (x.pct == null ? "—" : x.pct.toFixed(1) + "%") + '</b> book</span>' +
              '<span class="v">' + money0(x.rpl) + " / lead</span></div>").join("") +
            '<div class="ap2-note" style="margin-top:8px">' + (lad.length >= 2 && lad[0].pct && lad[lad.length - 1].pct
              ? "A city next to a base books <b>" + (lad[0].pct / lad[lad.length - 1].pct).toFixed(1) + "×</b> better than one at the far end, and earns <b>" + money0(lad[0].rpl) +
                "</b> per lead against <b>" + money0(lad[lad.length - 1].rpl) + "</b>. <b>But that is mostly not the distance.</b> " +
                "Near and far cities are fed by different lead sources, and the sources book differently wherever they land: hold source and job size fixed and the slope falls from " +
                "<b>1.15</b> booking points per 10 miles to <b>0.15</b> — noise. Within any one source the rate is flat from 0 to 60 miles. " +
                "South Jersey sits <b>38.5</b> miles from a base and books <b>17.37%</b>, against <b>17.29%</b> for the rest of New Jersey at <b>18.0</b> miles. " +
                "<b>A nearer base does not win more work</b> — it buys a second job in the day. " + go("apSister", "What a nearer base actually buys")
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
            (hasAcs ? "People moving per year = the Census population × the share of people (aged 1 and over) who moved in the last year — people, not households. " : "Census income and movers per year appear once a Census API key is connected. ") + "</div>" +
          '<div class="rs-seg" style="margin:0 0 10px">' + btn("Home Value", "Highest home value") + btn("Miles To Base", "Closest") +
            (hasAcs ? btn("Movers Per Year", "Most people moving") : "") + "</div>" +
          '<div class="rs-tablewrap" data-nocsv><table data-name="White space" class="rs-table"><thead><tr><th>Zip</th><th>Town</th><th>County</th><th>St</th><th>Base</th>' +
            '<th class="num">Miles</th><th class="num">Home value</th><th class="num">12 months</th>' +
            (hasAcs ? '<th class="num">Income</th><th class="num">People moving / yr</th>' : "") + "</tr></thead><tbody>" +
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
          th("Organic clicks", "Organic Clicks", "num") + th("Organic pos.", "Organic Position", "num") +
          th("Per 1,000 searches", "Organic Clicks Per 1000 Searches", "num") +
          th("Home value", "Home Value", "num") + th("12 months", "Home Value Change Pct", "num") +
          th("Income", "Median Income", "num") + th("People moved last yr", "Mover Rate", "num") + th("Wealth", "Wealth Tier") +
          "</tr></thead><tbody>" + pageRows.map(r => "<tr>" +
            '<td class="strong">' + esc(r.City) + (lnj(r) === 1 ? ' <span class="rs-pill warn">no jobs</span>' : "") + "</td><td>" + esc(r.State) + "</td>" +
            '<td class="num">' + fmtN(num(r.Leads)) + '</td><td class="num">' + r1(num(r["Booking Rate"])) + "%</td>" +
            '<td class="num">' + money0(num(r.Revenue)) + '</td><td class="num">' + money0(num(r["Revenue Per Lead"])) + "</td>" +
            '<td class="muted" style="white-space:nowrap">' + esc(r["Lead Source Mix"] || "—") + "</td>" +
            '<td class="num">' + (adCost(r) ? money0(adCost(r)) + adBadge(r) : d) + "</td>" +
            '<td class="num">' + (adPerDollar(r) != null ? "$" + adPerDollar(r).toFixed(1) : d) + "</td>" +
            // organic (2026-09-24): FLOORS -- only a search naming the city can be placed in it
            '<td class="num">' + (r["Organic Clicks"] != null ? fmtN(num(r["Organic Clicks"])) : d) + "</td>" +
            '<td class="num">' + (r["Organic Position"] != null ? r1(num(r["Organic Position"])) : d) + "</td>" +
            '<td class="num">' + (r["Organic Clicks Per 1000 Searches"] != null ? num(r["Organic Clicks Per 1000 Searches"]).toFixed(2) : d) + "</td>" +
            '<td class="num">' + (r["Home Value"] != null ? money0(num(r["Home Value"])) : d) + "</td>" +
            '<td class="num">' + (r["Home Value Change Pct"] != null ? sgnPct(num(r["Home Value Change Pct"])) : d) + "</td>" +
            '<td class="num">' + (r["Median Income"] != null ? money0(num(r["Median Income"])) : d) + "</td>" +
            '<td class="num">' + (r["Mover Rate"] != null ? (num(r["Mover Rate"]) * 100).toFixed(1) + "%" : d) + "</td>" +
            "<td>" + esc(r["Wealth Tier"] || "—") + "</td></tr>").join("") +
          "</tbody></table></div>" +
          '<div class="ap2-note" style="margin-top:6px">Estimated ad cost = the city\'s leads by source × that source\'s company-wide cost per lead over the last 12 months (card spend ÷ leads). No spend we hold has geography, so this is an estimate, not measured spend. Revenue per lead is a yield, not a return. Wealth tier = the city\'s home-value fifth among these cities.</div>' +
          '<div class="ap2-note" style="margin-top:6px"><b>Organic</b> = clicks from Google searches for movers that <b>name the city</b> (Search Console), their average position (blank under 100 impressions: too few searches to mean anything), and those clicks per 1,000 Keyword Planner searches in the same months. These are <b>floors</b>, not demand: Google hides about 45% of clicks and never says where the searcher was, so most cities read 0–5. Search volume stays the demand number; Organic Search (Marketing) has the detail.</div>' +
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
      /* HIS ORDER (2026-09-30): "1) Main Variables // the information that controls this analysis
         2) Map 3) the rest of the pages - i dont care about them, group em as you like" */
      const PANES = [
        { k: "vars", label: "Main variables" },
        { k: "map", label: "Map" },
        { k: "decide", label: "Decisions" },
        { k: "plan", label: null },              // named at render time: FC is declared below this block
        { k: "cities", label: "Cities" },
        { k: "capacity", label: "Capacity check" },
        { k: "whatif", label: "What if" },
        { k: "ref", label: "Reference" },
      ];
      const paneOf = key => PANES.some(x => x.k === key) ? key : "map";
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
          esc(String(FC.year || "")) + " sales desk. <b>Utilization</b> and <b>marketing $ per lead</b> size the <b>Capacity check</b> only: next season's crew is calibrated on the foremen who actually ran each depot, and its budget on what a lead really cost last season.</div>" +
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
        /* the dials are for working the plan; the map tab is the one on the screen in the room,
           and a paragraph of assumptions above it is the first thing the eye landed on (2026-09-29) */
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
      /* THE PLAN GROWS WITH THE LEADS MARKETING BRINGS (2026-09-30). His words: "i dont want less jobs
         then previous season - we need to plan for more", and, asked by how much: "you have to figure
         that out based on marketing". The 3-season average (the default since 22 Sep, because it
         replays closest) plans 1,692 jobs against the 1,783 Season 2026 ran. What marketing actually
         delivered is measurable: the leads that arrived in the season's lead months (the move months
         shifted back by the lead lag) against the same months a season earlier -- 10,014 against
         8,752, +14.4%, on +22% more advertising. So a fourth method, "mkt": every state's last-season
         month x (1 + that growth). ONE company rate, not per state: by state the same comparison
         reads NJ +41%, NY -27%, MA -60%, which is leads being attributed to a different neighbour,
         not markets moving. The rate is a dial on Main variables (blank = measured), because last
         season the jobs did NOT follow the leads (+14% leads, -1% jobs): the target assumes the
         conversion holds, and he should be able to say a different number. */
      const MKT_TREND = (() => {
        const lag = FC.lead_lag_months || 1, yr = +FC.year;
        const core = (FC.season_months || FC.months || []).filter(m => !(FC.shoulders || []).includes(m));
        if (!yr || !core.length) return null;
        const ymOf = (y, m) => { const d = new Date(y, m - 1 - lag, 1); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); };
        const sumL = y => core.reduce((a, m) => a + SERVICE_AREAS.reduce((b, st) => b + num(((MS[ymOf(y, m)] || {})[st] || {}).leads), 0), 0);
        const last = sumL(yr - 1), prior = sumL(yr - 2);
        return last > 0 && prior > 0 ? { last, prior, g: last / prior - 1, lastYear: yr - 1 } : null;
      })();
      const METHODS_ALL = (MKT_TREND ? ["mkt"] : []).concat(FC.methods || ["growth"]);
      /* a growth nobody typed is the measured one, never negative: "not less than previous season" */
      const mktGrowth = () => inputs.growthPct != null && isFinite(+inputs.growthPct) && String(inputs.growthPct) !== ""
        ? +inputs.growthPct / 100 : Math.max(0, MKT_TREND ? MKT_TREND.g : 0);
      function nextCalc(opts) {
        const util = (num(inputs.utilization) / 100) || 0.34;
        const perFm = Math.max(1, DAYS_PER_MONTH * util);              // jobs one foreman does in a month
        const crew = FC.crew_per_foreman || { helpers: 1, drivers: 1, trucks: 1 };
        const months = (FC.months || []).map(m => FC.year + "-" + String(m).padStart(2, "0"));
        const core = months.filter(ym => !((FCS[Object.keys(FCS)[0]] || { months: {} }).months[ym] || {}).shoulder);
        // the service areas, plus any other state with a real season (a one-off long-distance job is not a market)
        const sts = seedStates.filter(st => FCS[st]).concat(Object.keys(FCS).filter(st => !seedStates.includes(st) && (FCS[st].season_jobs_last || 0) >= 10).sort());
        const method = METHODS_ALL.includes(inputs.method) ? inputs.method : (MKT_TREND ? "mkt" : (FC.method || "growth"));
        const mktG = method === "mkt" ? mktGrowth() : 0;
        /* "HAVE" IS WHO IS ON THE REGISTER TODAY, NOT WHO RAN LAST SEASON (audit 2026-09-22).
           The hire was peak minus the foremen seen on last season's closings -- 20 -- and four of
           those are Cancelled or Potential on the crew register now. The register has 18 active, so
           the plan was telling dispatch "hire +3" when the gap is +5. He was asked 20 / 23 / 18 and
           answered "i have no idea, what you think?": a hire is measured against the people you can
           put on a truck in May, so it is the register. Last season's count stays where it belongs --
           it CALIBRATES the need (`worked`, below) -- and is printed beside the register figure.
           A typed foreman table, or a model override, still wins. */
        const REG = {}; ((model.depots || {}).bases || []).forEach(b => { REG[b.name] = num(b.foremen); });
        const regAny = Object.values(REG).some(v => v > 0);
        const haveOf = st => { const typed = num((inputs.bases[st] || {}).cur) + num((inputs.bases[st] || {}).add);
          return (regAny && inputs.seed === "measured" && (OVR.bases || {})[st] == null) ? (REG[st] || 0) : typed; };
        const rows = sts.map(st => {
          const s = FCS[st], have = haveOf(st);
          const scM = ((opts && opts.mult) || SC_MULT)[st];      // the What-if scenario's job multiplier (1 = the plan)
          const cells = months.map(ym => { const r0 = s.months[ym] || {}; const jobs = (method === "mkt" ? (r0.last || 0) * (1 + mktG)
              : ((r0.methods && r0.methods[method] != null) ? r0.methods[method] : (r0.jobs || 0))) * (scM != null ? scM : 1);
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
        /* NEW BASES GO IN AS EXTRA FORECAST (2026-09-29, see NEW BASES above). A base's launch leads
           become jobs at its state's own leads-per-job -- the rate the plan uses to turn jobs back into
           leads -- spread over the core months in the state's own shape, so the marketing, the desk,
           the pools and the trucks below all carry it. `opts.nb`: "all" (this browser), "confirmed"
           (the official plan), "none", or {without: label} for one base's own contribution.
           AFTER THE MARKETING FLOOR, ON PURPOSE (2026-09-30). It ran before it, so the base's jobs
           changed the one factor that lifts every state's leads -- and switching Montgomery to Yes
           took $2,600 off New Jersey's budget and $600 off Connecticut's ("it deduces the quantities,
           which is strange"). A base in Maryland must not move another state's numbers: the floor is
           now settled on the plan without it, and the base's leads ride on top at the same rate. */
        const nbOut = [];
        nbEffect(nbActive((opts && opts.nb) || "all")).per.forEach(p => {
          const cap = NB_CAP[p.b.label] != null ? NB_CAP[p.b.label] : 1;      // a plan that gives the base fewer crews than its ground needs
          const o = { label: p.b.label, st: p.b.st, opened: p.opened, served: p.served, leadsYr: p.leadsYr,
                      jobs: p.jobsYear1 * cap, jobsFull: p.jobsFull, unplanned: 0, cap };
          Object.entries(p.byState).forEach(([st, jobs0]) => { const jobs = jobs0 * cap;
            const r = rows.find(x => x.st === st);
            if (!r || !(jobs > 0)) { o.unplanned += jobs; return; }
            const cc = r.cells.filter(c => !c.shoulder), b0 = cc.reduce((a, c) => a + (c.jobs || 0), 0);
            cc.forEach(c => { const add = b0 > 0 ? jobs * (c.jobs || 0) / b0 : jobs / cc.length;
              c.jobs = (c.jobs || 0) + add; c.nbJobs = (c.nbJobs || 0) + add;
              if (r.leadsPerJob != null) c.leads_needed = Math.round(c.jobs * r.leadsPerJob); });
            r.jobs = cc.reduce((a, c) => a + (c.jobs || 0), 0);
            r.leads = cc.reduce((a, c) => a + (c.leads_needed || 0), 0);
            if (r.s.avg_bill != null) r.revenue = r.jobs * r.s.avg_bill;
            if (r.s.avg_expense != null) r.expense = r.jobs * r.s.avg_expense;
            r.nbJobs = (r.nbJobs || 0) + jobs;
          });
          nbOut.push(o);
        });
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
          /* a new base's jobs (c.nbJobs) are left out: that base carries its own crew (below), and
             letting them into the pool re-split the pool's foremen between its states -- which is
             how opening Montgomery took a foreman from Delaware */
          const loadAt = (ym, k) => prs.reduce((a, r) => { const c = r.cells.find(x => x.ym === ym) || {};
            return a + ((num(c[k]) || 0) - (k === "jobs" ? num(c.nbJobs) : 0)) * (c.headroom || 1); }, 0);
          const refLoad = Math.max(0, ...core.map(ym => loadAt(ym, "last")));
          /* THE CREW IS NEVER PLANNED BELOW THE WORK LAST SEASON ACTUALLY RAN (his call 2026-09-22).
             The forecast default moved to the 3-season average the same day, because it is the most
             accurate of the three replayed against 2026 -- but it is accurate in one direction: it
             predicted 1,631 jobs against the 1,779 that happened, and EVERY method came in under.
             Taken literally it plans 4.4% fewer jobs than last season ran, which quietly cut the
             hire from +5 to +2. Fewer crews than last year is the expensive way to be wrong: a
             missing foreman in July is work turned away, while a spare one is a month of wages.
             So the money follows the forecast and the CREW follows the higher of the forecast and
             last season's own month. Both numbers are kept and the page says which is which. */
          const loadFor = ym => Math.max(loadAt(ym, "jobs"), loadAt(ym, "last"));
          const cells = months.map(ym => { const jobs = prs.reduce((a, r) => { const c0 = r.cells.find(x => x.ym === ym) || {}; return a + (c0.jobs || 0) - (c0.nbJobs || 0); }, 0);
            const lastJobs = prs.reduce((a, r) => a + ((r.cells.find(x => x.ym === ym) || {}).last || 0), 0);
            const load = loadFor(ym), fcLoad = loadAt(ym, "jobs");
            const sized = Math.max(jobs, lastJobs);
            const needOf = L => !sized ? 0 : (worked > 0 && refLoad > 0) ? Math.ceil(worked * L / refLoad - 1e-9) : Math.ceil(L / perFm);
            const need = needOf(load), needFc = needOf(fcLoad);
            const any = prs.map(r => r.cells.find(x => x.ym === ym)).find(Boolean) || {};
            return { ym, jobs, lastJobs, need, needFc, floored: need > needFc, shoulder: !core.includes(ym), hire_by: any.hire_by }; });
          const coreCells = cells.filter(c => !c.shoulder);
          const peak = Math.max(0, ...coreCells.map(c => c.need));
          const first = coreCells.find(c => c.need > have);
          return { pk, label: prs.map(r => r.st).join(" + "), states: prs.map(r => r.st), worked, have, cells, peak, calibrated: worked > 0 && refLoad > 0,
                   peakFc: Math.max(0, ...coreCells.map(c => c.needFc)), floored: coreCells.some(c => c.floored),
                   hire: Math.max(0, peak - have), hireBy: first ? first.hire_by : null,
                   helpers: Math.ceil(peak * (crew.helpers || 0)), drivers: Math.ceil(peak * (crew.drivers || 0)), trucks: Math.ceil(peak * (crew.trucks || 0)) };
        }).filter(Boolean);
        // trucks beyond the owned fleet are rented for the core months; the rent is shared by each state's trucks
        const T = FC.trucks || {};
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
          q.cells.forEach(pc => { const loads = prs.map(r => { const c = r.cells.find(x => x.ym === pc.ym) || {};
            return Math.max(num(c.jobs) - num(c.nbJobs), num(c.last)) * (c.headroom || 1); });     // the same basis the pool was sized on
            share(pc.need, loads).forEach((n, i) => { const c = prs[i].cells.find(x => x.ym === pc.ym); if (c) c.fm = n; }); });
          const peakCell = q.cells.filter(c => !c.shoulder).sort((a, b) => b.need - a.need)[0];
          q.peakYm = peakCell ? peakCell.ym : null;
          prs.forEach(r => { const c = r.cells.find(x => x.ym === q.peakYm) || {}; r.fmPeak = c.fm || 0; r.pool = q.label; r.poolKey = q.pk;
            r.fmHelpers = Math.ceil(r.fmPeak * (crew.helpers || 0)); r.fmDrivers = Math.ceil(r.fmPeak * (crew.drivers || 0)); r.fmTrucks = Math.ceil(r.fmPeak * (crew.trucks || 0)); }); });
        /* THE CREW AT EACH NEW BASE (2026-09-30): sized for the jobs the base ADDS, at the rate the
           existing pools run (their foremen at peak per season job), at least one -- and his to
           edit (NB_FM, the - / + on its card). Existing bases keep their plan to the foreman. */
        const poolJobs0 = rows.reduce((a, r) => a + r.jobs - (r.nbJobs || 0), 0), poolPeak0 = pools.reduce((a, q) => a + q.peak, 0);
        const fmPerJob = poolJobs0 > 0 ? poolPeak0 / poolJobs0 : 0;
        nbOut.forEach(o => {
          o.fmSuggested = Math.max(1, Math.ceil(o.jobs * fmPerJob - 1e-9));
          o.fm = NB_FM[o.label] > 0 ? Math.round(NB_FM[o.label]) : o.fmSuggested;
          o.states = o.opened.reduce((a, x) => (a.indexOf(x.a.State) < 0 ? a.concat([x.a.State]) : a), []);
        });
        const nbFm = nbOut.reduce((a, o) => a + o.fm, 0);
        const trucksTot = pools.reduce((a, q) => a + q.trucks, 0) + Math.ceil(nbFm * (crew.trucks || 0));
        /* OWNED AND RENTED, BASE BY BASE (his ask 2026-09-30: "project how many owned vehicles and
           rental vehicles we need per base"). Owned = the ACTIVE trucks on the vehicles register, by
           the state written on each (his pick over the 10 that "worked" last season, which carry no
           base): NJ + NY park at the NJ base, a new base starts with none. His - / + on a card
           (TR_OWN, memory only) moves or buys one. A base rents what its peak needs above what it
           owns -- a spare truck in one base does not cover another. A Planning Variables override
           of the owned count keeps the old company-wide sum. */
        const ownBy = (model.fleet || {}).active_by_state;
        const perBase = !!ownBy && T.owned_source !== "override";
        const regOf = pk => Object.keys(ownBy || {}).reduce((a, st) => a + ((POOL_OF[st] || st) === pk ? num(ownBy[st]) : 0), 0);
        if (perBase) {
          pools.forEach(q => { q.owned = Math.max(0, TR_OWN[q.pk] != null ? TR_OWN[q.pk] : regOf(q.pk)); q.rent = Math.max(0, q.trucks - q.owned); });
          nbOut.forEach(o => { o.trucks = Math.ceil(o.fm * (crew.trucks || 0)); o.owned = Math.max(0, TR_OWN[o.label] || 0); o.rent = Math.max(0, o.trucks - o.owned); });
        }
        const owned = perBase ? pools.reduce((a, q) => a + q.owned, 0) + nbOut.reduce((a, o) => a + o.owned, 0)
          : T.owned_working != null ? T.owned_working : ((model.fleet || {}).owned_trucks || 0);
        const rentTrucks = perBase ? pools.reduce((a, q) => a + q.rent, 0) + nbOut.reduce((a, o) => a + o.rent, 0)
          : Math.max(0, trucksTot - owned);
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
        /* SALES PAY IS ALREADY INSIDE JOB EXPENSE -- SHOWN, NEVER TAKEN OFF TWICE (his call 2026-09-22).
           On 2026-09-20 it was added as its own line ("add it - yet explain that it includes sales
           commissions and bonuses only"), 7.5% of revenue on top of avg_expense. Two independent
           re-derivations then showed avg_expense is the closing sheet's `Total Expense`, which carries
           the Sales 1/2/3 Salary lines: ops + sales + company tip reproduces it to a $1.19 average
           residual over 1,794 season closings, and the sales lines average $211.59 a job = 7.51% of
           bill. The season's net was understated by about $380k. The figure stays on the page as
           "of which", because he asked to see it -- it just does not leave the gross a second time. */
        const SALES_PCT = FC.sales_pay_pct || 0.075;
        rows.forEach(r => { r.rent = jobsAll ? rentTotal * r.jobs / jobsAll : 0;
          r.salesPay = r.revenue != null ? r.revenue * SALES_PCT : null;      // of which -- inside expense
          r.gross = (r.revenue != null && r.expense != null) ? r.revenue - r.expense - r.rent : null; });
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
                        peakWhen: (desk.filter(x => !x.shoulder).sort((a, b) => b.leads - a.leads)[0] || {}).when || "",
                        active: seasonDesk().repsActive || P.M.repsActive || null };   // last season's desk, not the what-if period's
        const ranLast = pools.reduce((a, q) => a + (q.worked || 0), 0);
        const peakFc = pools.reduce((a, q) => a + (q.peakFc || 0), 0);
        const tot = { jobs: sum("jobs"), peak: psum("peak") + nbFm, have: psum("have"), hire: psum("hire") + nbFm, trucks: trucksTot, leads: sum("leads"),
                      ranLast, haveIsRegister: regAny && inputs.seed === "measured",
                      peakFc, crewFloored: pools.reduce((a, q) => a + (q.peakFc || 0), 0) < psum("peak"),
                      mkt: rows.reduce((a, r) => a + r.leads * (mkt.cplOf(r.st) || 0), 0),
                      helpers: psum("helpers") + Math.ceil(nbFm * (crew.helpers || 0)), drivers: psum("drivers") + Math.ceil(nbFm * (crew.drivers || 0)), revenue: rows.some(r => r.revenue != null) ? sum("revenue") : null,
                      expense: rows.some(r => r.expense != null) ? sum("expense") : null, rent: rentTotal,
                      salesPay: rows.some(r => r.salesPay != null) ? sum("salesPay") : null, salesPct: SALES_PCT,
                      gross: rows.some(r => r.gross != null) ? sum("gross") : null };
        tot.parking = nbOut.length * 800 * (core.length || 4);        // a yard per base, the what-if's $800 a month
        return { months, core, rows, pools, sales, mkt, tot, perFm, util, crew, owned, perDay, rentTrucks, coreDays, method, rentWays, rentPick, nb: nbOut, perBase };
      }
      function nextHtml() {
        if (!FC.year) return '<div class="ap2-note">The forecast block is not in the model yet — it appears after the next plan rebuild (07:50 NJ, or run <b>sources=area-plan</b>).</div>';
        const N = nextCalc();
        const sgn = g => (g >= 0 ? "+" : "") + Math.round(g * 100) + "%";
        const mLbl = ym => MONTH_NAMES[+ym.slice(5, 7)];
        const th = (t, cls) => '<th class="' + (cls || "num") + '">' + t + "</th>";
        const tdc = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
        const METH = { mkt: "Marketing trend", growth: "Last season × growth", avg3: "3-season average", flat: "Flat (last season again)" };
        const BT = FC.backtest || {}, BTM = BT.methods || {};
        const errTxt = m => { const v = BTM[m]; return v && v.abs_err_pct != null ? "±" + Math.round(v.abs_err_pct * 100) + "%" : "—"; };
        const pick = '<div class="ap2-mpick"><span class="ap2-note" style="margin:0 8px 0 0"><b>Method</b></span>' + METHODS_ALL.map(m =>
          '<button class="ap2-mbtn' + (N.method === m ? " on" : "") + '" data-method="' + m + '" title="' + (BTM[m] ? "backtest " + BT.year + ": predicted " + fmtN(BTM[m].pred) + " vs " + fmtN(BTM[m].actual) + " actual season jobs" : "") + '">' + METH[m] +
          '<small>' + (m === "mkt" ? "last season " + sgn(mktGrowth()) : BT.year ? (() => { const v = BTM[m]; if (!v || !v.actual) return "backtest " + errTxt(m);
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
          tdc('<span title="' + (r.s.growth_source === "override" ? "set as an override" : "measured: " + fmtN(r.s.season_jobs_prior) + " → " + fmtN(r.s.season_jobs_last) + " season jobs, capped ±" + Math.round((FC.growth_cap || .3) * 100) + "%") + '">' + sgn(r.s.growth || 0) + "</span>") +
          r.cells.map(c => '<td class="num' + (c.shoulder ? " ap2-sh" : "") + '" title="last year ' + fmtN(c.last) + ' jobs · busy-day factor ' + r1(c.headroom) + '">' + (c.jobs ? fmtN(c.jobs) : '<span class="ap2-dim">—</span>') + "</td>").join("") +
          tdc("<b>" + fmtN(r.jobs) + "</b>") + "</tr>";
        const body = N.rows.map(stRow).join("");
        const foot = '<tr class="ap2-tot">' + tdc("<b>All states</b>", "strong") + tdc("") + N.months.map(ym => tdc("<b>" + fmtN(N.rows.reduce((a, r) => a + ((r.cells.find(c => c.ym === ym) || {}).jobs || 0), 0)) + "</b>", "num" + (N.core.includes(ym) ? "" : " ap2-sh"))).join("") +
          tdc("<b>" + fmtN(N.tot.jobs) + "</b>") + "</tr>";
        const lag = FC.lead_lag_months || 1;
        const ramp = N.core.map(ym => { const d = new Date(+ym.slice(0, 4), +ym.slice(5, 7) - 1 - lag, 1); const by = MONTH_NAMES[d.getMonth() + 1] + " " + d.getFullYear();
          const leads = N.rows.reduce((a, r) => a + (((r.cells.find(c => c.ym === ym) || {}).leads_needed) || 0), 0);
          return "<b>" + esc(by) + "</b> " + fmtN(leads) + " leads for " + mLbl(ym) + "'s jobs"; }).join(" · ");
        /* THE GROWTH DIAL, beside the method it belongs to. Blank = the measured lead growth. */
        const growDial = N.method === "mkt" && MKT_TREND ? '<div class="ap2-growth"><label>Growth on Season ' + esc(String(MKT_TREND.lastYear)) +
            ', %<input type="number" step="1" id="apGrowth" value="' + (inputs.growthPct != null && String(inputs.growthPct) !== "" ? esc(String(inputs.growthPct)) : "") +
            '" placeholder="' + Math.round(100 * Math.max(0, MKT_TREND.g)) + '"></label>' +
            '<span class="ap2-note" style="margin:0">Measured: <b>' + fmtN(MKT_TREND.last) + "</b> leads arrived in the season's lead months in " + esc(String(MKT_TREND.lastYear)) +
            " against <b>" + fmtN(MKT_TREND.prior) + "</b> a season earlier — <b>" + sgn(MKT_TREND.g) + "</b>. Blank uses that. " +
            "It assumes the jobs follow the leads; last season they did not (leads " + sgn(MKT_TREND.g) + ", jobs about flat), so this is a target, not a replay.</span></div>" : "";
        return pick + growDial + '<div class="ap2-note" style="margin-bottom:8px">Jobs by state and month, ' +
          (N.method === "mkt" ? "last season's same month × (1 + the growth above)" : N.method === "growth" ? "last season's same month × the state's growth" : N.method === "avg3" ? "the mean of the same month over the last three seasons" : "last season's same month, unchanged") +
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
            ". <b>Sales pay</b> (" + r1((N.tot.salesPct || 0) * 100) + "% of revenue, commission and bonus) is <b>already inside job expense</b> — the closing sheet’s Total Expense carries the salespeople’s salary lines — so it is shown as <i>of which</i> and never taken off twice. " : "") +
          "Revenue, job expense and truck rent come from the jobs forecast (same method, same dials). <b>Marketing</b> = every lead the jobs need × what a lead really cost last season, the whole advertising ledger with post cards inside it. <b>Post cards mailed there</b> is last season's actual mailing, shown beside the budget and not taken out of it. Net = gross − marketing, before overhead. " + go("apMethod", "How this is calculated") + "</div>" +
          '<table data-name="The season in money" class="rs-table ap2-next"><thead><tr>' + th("State", "") + th("Jobs") + th("Revenue") + th("Job expense") + th("Truck rent") + th('Sales pay<small title="commission and bonus, about 7.5% of revenue — already inside job expense (the closing sheet’s Total Expense carries the salespeople’s salary lines), so it is shown here and never taken off again"> of which, inside expense</small>') + th("Gross") + th("Leads needed") + th("$ / lead") + th("Marketing") + th('Post cards mailed there<small> 2026 actual</small>') + th("Net") + "</tr></thead><tbody>" +
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

      /* ------- what a base at a given zip would do, from the model's own zip maps ---------------------
         "CHEAPER TO SERVE" IS GONE (his ruling 2026-09-22): "this is kinda relocation, and i dont see
         that happening in reality -- since in NJ we have storage and so on, like its not just parking
         -- i would remove that part completely." The card, the dashed-square flags, the legend entry
         and the four presets went with it. depotTry() stays because it prices a NEW base at any zip. */
      const DEP = model.depots || {};
      const hav = (a, b, c, d) => { const R = 3958.7613, r = x => x * Math.PI / 180; const dp = r(c - a), dl = r(d - b);
        const h = Math.sin(dp / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dl / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
      /* PRICE A POINT, NOT ONLY A ZIP (2026-09-22). depotTry looked the zip up in the model's own
         compact maps -- jobs by zip, and white space within 35 miles of a base we already have --
         so any zip outside today's territory came back "not in the territory data". That is exactly
         where the expansion picks are: Rockville, 90 miles from the Delaware base, could not be
         priced at all, which made the what-if unable to cost the one base the map recommends. The
         maths never needed the zip, only a latitude and a longitude; the zip lookup is now just one
         way of getting them, and the map's own picks are another. */
      /* TWO YARDS ARE NOT TWICE ONE YARD (2026-09-22, for "i need to properly plan for new 2-3 base
         at max"). Priced one at a time, each is measured against today's base set, so a job that
         both of them would take over is counted as re-homed twice and the miles saved add up to
         more than exist. Every picked yard therefore enters the base set TOGETHER and the saving is
         computed once, against the network as it would actually be. */
      function depotAt(pts, label) {
        const P = Array.isArray(pts) ? pts : [pts];
        const J = DEP.jobs_by_zip || [], WS = DEP.ws_zips || [], B = DEP.bases || [];
        const total = J.reduce((a, j) => a + j[3], 0);
        /* never across Long Island Sound (2026-09-24, acrossSound): a job's shore is j[4], a white-space
           zip's w[5], a base's and a new yard's .side. A job no base on its own shore can serve is
           measured to all of them, as area_plan._nearest does, so it never drops out of the average. */
        const near = (la, lo, bs, sd) => {
          const pick = ok => bs.reduce((best, b) => { if (!ok(b)) return best; const d = hav(la, lo, b.lat, b.lon); return d < best[0] ? [d, b.name] : best; }, [Infinity, null]);
          const r = pick(b => !acrossSound(sd || "", b.side || ""));
          return r[1] != null ? r : pick(() => true); };
        const isNew = {}; P.forEach((q, i) => { isNew["new" + i] = 1; });
        const withC = B.concat(P.map((q, i) => ({ name: "new" + i, lat: q.lat, lon: q.lon, side: q.side || "" })));
        const anyWithin = (la, lo, mi, sd) => P.some(q => !acrossSound(sd || "", q.side || "") && hav(la, lo, q.lat, q.lon) <= mi);
        let mi = 0, base = 0, j15 = 0, j35 = 0, rehomed = 0;
        J.forEach(j => { if (anyWithin(j[1], j[2], DEP.near_mi || 15, j[4])) j15 += j[3];
          if (anyWithin(j[1], j[2], DEP.territory_mi || 35, j[4])) j35 += j[3];
          base += near(j[1], j[2], B, j[4])[0] * j[3]; const n = near(j[1], j[2], withC, j[4]); mi += n[0] * j[3]; if (isNew[n[1]]) rehomed += j[3]; });
        let ws35 = 0, never = 0, movers = 0;
        WS.forEach(w => { if (anyWithin(w[1], w[2], DEP.territory_mi || 35, w[5])) { ws35++; if (w[3]) { never++; movers += w[4]; } } });
        return { label, pts: P, n: P.length, mi_per_job: total ? mi / total : null, saved_mi_per_job: total ? (base - mi) / total : null,
                 jobs_15: j15, jobs_35: j35, rehomed, ws_zips_35: ws35, ws_never_35: never, movers_never_35: movers };
      }
      function depotTry(zip) {
        const J = DEP.jobs_by_zip || [], WS = DEP.ws_zips || [];
        const hj = J.find(x => x[0] === zip), hw = hj ? null : WS.find(x => x[0] === zip), hit = hj || hw;
        // the typed zip's own shore of the Sound (2026-09-24): j[4] on a job row, w[5] on a white-space row
        return hit ? depotAt([{ lat: hit[1], lon: hit[2], side: (hj ? hj[4] : hw[5]) || "" }], zip) : null;
      }
      function wireMethod() {
        const gd = host.querySelector("#apGrowth");
        if (gd) gd.onchange = () => { const v = String(gd.value).trim();
          inputs.growthPct = v === "" || !isFinite(+v) ? null : +v; save(); repaintPlan(); };
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
      /* THE CARD MUST NOT DISAGREE WITH THE PLAN ABOVE IT (audit 2026-09-22). It hard-coded 281
         leads a salesperson and $197 a job while the plan ran on the dial (about 250) and the
         ledger's $201; put 23 foremen through it and it said 10.6 salespeople where the decisions
         say 14. Three rates now come from nextCalc(); days worked and the first-season ramp stay
         measured constants. And it takes an X, which is what he asked for: "X foremen at a location". */
      function liveFormula(N) {
        return Object.assign({}, FORMULA, N ? {
          leadsPerRep: N.sales.lpr || FORMULA.leadsPerRep,
          floorPerJob: N.mkt.perJobLast || FORMULA.floorPerJob,
          leadsPerJob: N.tot.jobs ? N.tot.leads / N.tot.jobs : FORMULA.leadsPerJob } : {});
      }
      function formulaUnit(N) {
        const F = liveFormula(N), months = N ? N.core.length : 4, jpd = chainOf("_all");
        const X = Math.max(1, Math.round(num(inputs.formulaX) || (N ? N.tot.peak : 1)));
        const jobs = X * jpd * F.daysPerMonth * months, leads = jobs * F.leadsPerJob;
        const cpl = N && N.mkt.cplActual != null ? N.mkt.cplActual : F.perLead;
        const mkt = Math.max(leads * cpl, jobs * F.floorPerJob);
        /* the desk is sized on its PEAK month, and leads bunch: the season average understates it */
        const dl = N ? N.sales.desk.filter(x => !x.shoulder).map(x => x.leads) : [];
        const bunch = dl.length && dl.reduce((a, v) => a + v, 0) > 0 ? Math.max.apply(null, dl) / (dl.reduce((a, v) => a + v, 0) / dl.length) : 1;
        const repsAvg = leads / months / F.leadsPerRep;
        return "= <b>" + fmtN(jobs) + "</b> jobs, <b>" + fmtN(leads) + "</b> leads, <b>" + r1(repsAvg) + "</b> salespeople on average and <b>" +
          Math.ceil(repsAvg * bunch - 1e-9) + "</b> in the busiest month, <b>" + money0(mkt) + "</b> of marketing" +
          (N && X === N.tot.peak ? "<small> — the plan's own " + fmtN(N.tot.jobs) + " jobs, " + N.sales.peak + " salespeople and " + money0(N.tot.mkt) +
            " are built month by month and state by state, so they land close to this, not on it</small>" : "");
      }
      function wireFormula() {
        const x = host.querySelector("#apFormulaX"); if (!x) return;
        x.oninput = () => { inputs.formulaX = Math.max(1, parseFloat(x.value) || 1); save();
          const u = host.querySelector("#apFormulaUnit"); if (u) u.innerHTML = formulaUnit(FC.year ? nextCalc() : null); };
      }
      function formulaHtml() {
        const N = FC.year ? nextCalc() : null, F = liveFormula(N);
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
          '<div class="f-unit"><label><b>X</b> = <input class="rs-num" data-own="1" id="apFormulaX" type="number" min="1" step="1" style="width:64px" value="' +
            Math.max(1, Math.round(num(inputs.formulaX) || (N ? N.tot.peak : 1))) + '"> foremen, one season</label> <span id="apFormulaUnit">' + formulaUnit(N) + "</span></div>" +
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
      /* NEVER TRADED IS NOT A BAD TIER (2026-09-21). Tier -1 is a county that has never sent a
         single lead: on a targeting map that is white space, the most interesting thing on the
         screen, and it must not wear the same grey as a county we HAVE worked and found too small
         to rate. Virginia is 106 of 124 counties in this state. */
      /* FOUR TIERS, HIS NAMES (2026-09-29, "i dont see 4 tiers as well - i see only 3"). His Power BI
         graded 1 Core / 2 Good / 3 Normal / 4 Don't target; the three bands above merged 1+2 and 4+5.
         mart_area_tier now rates EVERY area (measured on our leads where there are enough, on its
         market where there are not), so "never sent a lead" is no longer a colour of its own -- it is
         a hatch laid over the tier its market earns. Tier 0 is only an area with no leads and no
         Census row at all. */
      const TIER_BAND = t => (t === -1 ? "none" : t === 0 ? "grey" : t === 1 ? "t1" : t === 2 ? "t2" : t === 3 ? "t3" : "t4");
      const TIER_NAME = { 1: "Core", 2: "Good", 3: "Normal", 4: "Don't target", 0: "Not rated" };
      /* Tier 4 for distance alone: over 50 miles from any base, rated on its market */
      const isFar = a => !!a && +a.Tier === 4 && /^Over 50 mi/.test(String(a["Tier Reason"] || ""));
      /* the county key, character for character what scripts/build_county_geojson.py wrote */
      const ckey = v => String(v == null ? "" : v).toLowerCase().trim()
        .replace(/saint /g, "st ").replace(/st\. /g, "st ")
        .replace(/\b(county|parish|city and borough|borough|census area|municipality)\b/g, "")
        .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
      const TIER_LABEL = { t1: "Tier 1 · Core", t2: "Tier 2 · Good", t3: "Tier 3 · Normal",
                           t4: "Tier 4 · Don't target", grey: "Not rated", none: "Never sent a lead" };
      /* ONE PALETTE for the fills, the legend and the list, read off the portal's own tokens so it
         follows the theme: deep green, light green, amber, red. Mixed here rather than in CSS because
         Leaflet writes the fill as an SVG attribute. */
      const rgbOf = c => { c = String(c || "").trim();
        let m = c.match(/^#([0-9a-f]{6})$/i);
        if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
        m = c.match(/^#([0-9a-f]{3})$/i);
        if (m) return [0, 1, 2].map(i => parseInt(m[1][i] + m[1][i], 16));
        m = c.match(/rgba?\(([^)]+)\)/i);
        return m ? m[1].split(",").slice(0, 3).map(x => parseFloat(x)) : [128, 128, 128]; };
      const mixHex = (a, b, t) => { const A = rgbOf(a), B = rgbOf(b);
        return "#" + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, "0")).join(""); };
      function tierColors() {
        const dark = !document.body.classList.contains("light");
        const pos = tok("--pos") || "#5f7c20", warn = tok("--warn") || "#b97b0a", neg = tok("--neg") || "#d43d55";
        return { t1: dark ? mixHex(pos, "#000000", 0.05) : mixHex(pos, "#0b2a10", 0.30),
                 /* Tier 2 is the SAME green, quieter: paler on white, darker on the dark canvas --
                    in dark a paler green read brighter than Tier 1, i.e. better */
                 t2: dark ? mixHex(pos, "#0a0e14", 0.48) : mixHex(pos, "#ffffff", 0.45),
                 t3: warn, t4: neg, grey: tok("--faint") || "#8a97a6", none: tok("--line") || "#c9d2dc" };
      }
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

      /* COUNTY BOUNDARIES, VENDORED (2026-09-21). His words: "instead of bubbles, i prefer to have
         filled areas - for EVERY location, as i have in original Power BI." A circle at a county's
         centre overlaps its neighbours exactly where the work is densest, which is backwards for a
         map whose job is visibility. assets/vendor/geo/counties8.geojson is the eight states'
         327 shapes (195 KB), decoded from the public us-atlas TopoJSON by
         scripts/build_county_geojson.py -- no key, no vendor, no runtime dependency. */
      let GEO = null, GEO_ERR = null;
      function ensureGeo(cb) {
        if (GEO || GEO_ERR) { cb(); return; }
        fetch("assets/vendor/geo/counties8.geojson")
          .then(r => r.ok ? r.json() : Promise.reject(new Error("HTTP " + r.status)))
          .then(j => { GEO = j;
            /* the state borders are decoration: if they fail the map still draws, without them */
            return fetch("assets/vendor/geo/states8.geojson").then(r => r.ok ? r.json() : null).catch(() => null); })
          .then(sj => { if (sj) host._apStates = sj; cb(); })
          .catch(e => { GEO_ERR = e && e.message || "unreadable"; cb(); });
      }

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
          /* the tier is the four-tier mart's when it has the county; the old five-tier column only
             as a fallback until mart_area_tier is built (mapped onto four: 5 joins 4) */
          const a = AREA_IX.County[c.State + "|" + c.County];
          const t4 = a ? num(a.Tier) : Math.min(4, num(c.Tier));
          return { st: c.State, county: c.County, la: num(c.Latitude), lo: num(c.Longitude),
                   leads: num(c.Leads), leads12: lead12(c), jobs: num(c.Jobs), book: num(c["Booking Rate"]),
                   mi: num(c["Miles To Base"]), score: a ? (a["Data Score"] == null ? null : num(a["Data Score"])) : (c.Score == null ? null : num(c.Score)),
                   tier: t4, band: TIER_BAND(t4), area: a || null,
                   never: a ? num(a["Never A Lead"]) === 1 : num(c.Tier) === -1,
                   budget: b != null ? b * share : null, share,
                   fm60: num(c["Foremen Within 60mi"]), ceil, fair,
                   uncovered: num(c.Uncovered) === 1,
                   pop: num(c.Population), movers: num(c["Movers Per Year"]),
                   income: num(c["Median Income"]), own: num(c["Owner Share Pct"]) };
        }).filter(r => r.la && r.lo);
      }


      /* ===================== THE BASES ON THE MAP =====================
         His ask 2026-09-21: two kinds of base flag -- the ones we have and the ones the analysis
         says to add -- each with a 100-mile reach that appears on hover, and a tooltip carrying
         the crew there now, the crew to add, the states it covers and the jobs a day it can run.

         WHY 100 MILES AND NOT THE 60 THE COUNTY LAYER USES: 60 is the radius inside which a crew
         can be DISPATCHED to a county and still chain a second job, which is what the county
         tooltip answers. 100 is how far a base can SERVE at all -- measured throughput is flat out
         past 100 miles (docs/plans/2026-09-20-bases-expansion-and-the-formula.md). They answer
         different questions and the map says which is which. */
      /* HIS RULING 2026-09-21: 35 miles, not the 100 he first asked for and I built without
         checking. At 100 miles 78% of every covered county was covered by two or more bases, so
         the circles were mostly overlap and the picture carried almost no information. At 35 the
         overlap is 34% and each base visibly owns its own ground -- and it still reaches 82.8% of
         all leads. The loader owns the number (DEPOT_WORK_MI); this is only the fallback. */
      const MI_PER_M = 1609.34;
      function miBetween(la1, lo1, la2, lo2) {
        const R = 3959, rad = Math.PI / 180;
        const dLa = (la2 - la1) * rad, dLo = (lo2 - lo1) * rad;
        const a = Math.sin(dLa / 2) * Math.sin(dLa / 2) +
                  Math.cos(la1 * rad) * Math.cos(la2 * rad) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
        return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
      }

      function basesFor() {
        const D = model.depots || {};
        const R = countyRowsFor();
        const N = FC.year ? nextCalc() : null;
        /* which depot pool a base draws its hire from -- his state->depot map, same as the plan */
        const poolOfBase = { NJ: "NJ", NY: "NJ", PA: "PA", DE: "PA", CT: "CT", MA: "CT" };
        const hireOf = nm => {
          if (!N) return null;
          const q = N.pools.find(x => x.pk === poolOfBase[nm]);
          return q ? { hire: q.hire || 0, peak: q.peak, have: q.have, label: q.label } : null;
        };
        const WORK = +(D.work_mi || 35), SPACING = +(D.min_spacing_mi || 60);
        // `side`: the base's shore of Long Island Sound -- a CT base reaches no Nassau / Suffolk county (2026-09-24)
        const reach = (la, lo, side) => {
          const near = R.filter(r => r.la && r.lo && !acrossSound(side || "", sideOf(r.st, r.county)) &&
                                     miBetween(la, lo, r.la, r.lo) <= WORK);
          const sts = [...new Set(near.map(r => r.st))].sort();
          return { counties: near.length, states: sts,
                   leads: near.reduce((a, r) => a + r.leads, 0),
                   jobs: near.reduce((a, r) => a + r.jobs, 0) };
        };
        const have = (D.bases || []).filter(b => b.lat && b.lon).map(b => {
          const rr = reach(b.lat, b.lon, b.side);
          const h = hireOf(b.name);
          const rate = chainOf(b.name) || chainOf("_all");
          const red = (D.redundancy || []).find(x => x.name === b.name) || null;
          return { kind: "have", name: b.name, label: b.name + " — " + (b.zip || ""), red,
                   la: b.lat, lo: b.lon, zip: b.zip,
                   foremen: b.foremen || 0, helpers: b.helpers || 0, drivers: b.drivers || 0,
                   perDay: rate ? (b.foremen || 0) * rate : null, rate,
                   hire: h, reach: rr };
        });
        /* ONE QUESTION ON THE MAP NOW: where does a base open ground no existing base can reach?
           (The other one -- where would a yard cut the driving on work we already do -- was removed
           on his ruling 2026-09-22: a base is a warehouse with storage in it, not a truck park.) */
        /* MOVERS ARE A MARKET SIZE, NOT DEMAND WE CAPTURE. The ranking below is on movers a year,
           and I disowned it an hour after shipping it without ever saying so on the page: leads per
           10,000 movers run NJ 66.1, MD 6.1, VA 0.6. Every new-ground flag now carries its own
           state's capture beside home's, the crew the plan's aim gives it, and what that crew runs. */
        const capOf = capOfSt, homeSt = CAP_HOME;   // the shared CAP_ST (2026-09-23), not a second sum
        const AIM = model.crew_aim || {};
        /* what the DECIDED expansion implies for a state, so the flag for a base we have chosen
           says how many foremen its own jobs would need rather than only the standing aim */
        const XP = model.expansion || null;
        /* SEASON JOBS AT THE CEILING (2026-09-24). This put a YEAR of capture jobs into four season
           months, so the flag's foremen read ~2.2x. It now takes the season's share of the leads, the
           state's own leads per job (capLpj) and today's level from the clock -- the same basis as the
           expansion card's ceiling row -- and the flag says it is the target, not a forecast. */
        const xpFor = st => {
          if (!XP || !N || !(XP.capture || {})[st]) return null;
          const g = CAP_ST[st];                 // a year of leads over a year of movers (2026-09-23)
          const mv = g ? g.movers : 0;
          if (!mv) return null;
          const now = runOf(st) != null ? runOf(st) : g.cap, want = num(XP.capture[st]);
          if (!(want > now)) return null;
          const rr = N.rows.find(x => x.st === st);
          const jobs = AP_CAPTURE.row({ now, want, movers: mv, lpj: capLpj(rr, N).lpj || 6, share: SEASON_SHARE }).addJobs;
          const rate = chainOf(st) || chainOf("_all") || 1.27;
          return { jobs, fm: jobs / (rate * DAYS_PER_MONTH * (N.core.length || 4)) };
        };
        const coverage = (D.coverage || []).filter(c => !NB_HIDE(c.st)).map(c => { const rate = chainOf(c.st) || chainOf("_all"); const need = num(AIM[c.st]) || null;
          const xp = xpFor(c.st);
          return { kind: "cover", name: c.label, label: c.label, la: c.lat, lo: c.lon, st: c.st,
                   county: c.county, side: sideOf(c.st, c.county),
                   newMovers: c.new_movers, opens: c.counties_opened, fromBase: c.nearest_base_mi,
                   step: c.step || null, hopFrom: c.hop_from || null, hopMi: c.hop_mi,
                   xpFm: xp ? xp.fm : null, xpJobs: xp ? xp.jobs : null,
                   cap: capOf(c.st), capHome: capOf(homeSt), homeSt, need, rate, perDay: need && rate ? need * rate : null,
                   atHomeRate: capOf(homeSt) != null ? c.new_movers * capOf(homeSt) / 10000 : null,
                   atOwnRate: capOf(c.st) != null ? c.new_movers * capOf(c.st) / 10000 : null,
                   reach: reach(c.lat, c.lon, sideOf(c.st, c.county)) }; });
        return { have, coverage, work: WORK, spacing: SPACING,
                 baseline: D.baseline || null };
      }


      /* ===================== THE FLEET, AS CHIPS =====================
         His ask 2026-09-21: "display the total foreman quantity and truck quantity + rental
         quantity on chips as legends - and on hover display more data."

         Every figure here is nextCalc()'s own, so a chip can never disagree with the plan it sits
         above. The hover carries the working, because a bare number on a map is a number nobody
         can check: where the crews are today, what the peak needs, which bases are empty, and how
         the rental count falls out of owned-versus-needed rather than being a figure we chose. */
      function fleetChips() {
        if (!FC.year) return "";
        const N = nextCalc(), B = basesFor();
        const staffed = B.have.filter(b => b.foremen > 0);
        const empty = B.have.filter(b => !b.foremen);
        const T = (FC.trucks || {});
        const chip = (k, v, sub, tip) =>
          '<span class="ap2-chip3" title="' + esc(tip) + '"><b>' + v + "</b><span>" + k + "</span>" +
          (sub ? "<small>" + sub + "</small>" : "") + "</span>";
        const byBase = staffed.map(b => b.name + " " + b.foremen).join(", ");
        return '<div class="ap2-chips3">' +
          chip("jobs forecast", fmtN(N.tot.jobs), "season " + esc(String(FC.year)),
               "The season's jobs across every planned state, by the method chosen on the plan tab. Every other chip is sized from this.") +
          chip("foremen at peak", fmtN(N.tot.peak),
               (N.tot.haveIsRegister ? fmtN(N.tot.have) + " on the register" : "have " + fmtN(N.tot.have)) + (N.tot.hire ? " · hire +" + N.tot.hire : " · covered"),
               "Today: " + byBase + ". " + (N.tot.haveIsRegister && N.tot.ranLast !== N.tot.have ? fmtN(N.tot.ranLast) + " ran last season; the ones no longer active are not counted. " : "") + (empty.length
                 ? empty.map(b => b.name).join(", ") + " are registered bases with nobody stationed at them."
                 : "Every base is staffed.") +
               " The peak is the busiest single month, so it is not the sum of the year.") +
          chip("helpers", fmtN(N.tot.helpers), (N.crew.helpers || 0) + " per foreman",
               "Helpers ride with a foreman; the count follows the plan's crew shape — one helper and one driver per foreman.") +
          chip("drivers", fmtN(N.tot.drivers), (N.crew.drivers || 0) + " per foreman",
               "Drivers are counted on the closing sheet like foremen, not assumed.") +
          chip("trucks", fmtN(N.tot.trucks), "one per foreman at peak",
               "One truck per foreman working the peak month. " + fmtN(N.owned) +
               " are active on the vehicles register today.") +
          chip("vehicles owned", fmtN((model.fleet || {}).owned_trucks || 0),
               fmtN(N.owned) + (N.perBase ? " active" : " working the season"),
               "The vehicle register holds " + fmtN((model.fleet || {}).owned_trucks || 0) + " trucks; " + fmtN(N.owned) +
               " of them are " + (N.perBase ? "active trucks (sold, damaged and potential ones, vans and trailers are left out)" : "counted as working") + ". Insurance runs " + money0((model.fleet || {}).insurance_yearly_total || 0) +
               " a year and parking " + money0((model.fleet || {}).parking_monthly_total || 0) + " a month, company-wide.") +
          chip("rental, last season", fmtN(T.rental_days_last_season || 0) + " days",
               money0(T.rental_usd_last_season || 0) + " at " + money0(T.rental_per_day || 0) + " a day",
               "What the bank was actually charged for rented trucks last season, over " +
               fmtN(T.rental_days_last_season || 0) + " truck-days. It is the measured rate the plan prices the peak from.") +
          chip("rentals at peak", fmtN(N.rentTrucks),
               N.rentTrucks ? money0((N.tot.rent || 0)) + " for the season" : "none needed",
               N.rentTrucks
                 ? "Rentals are what the peak needs minus what we own: " + fmtN(N.tot.trucks) +
                   " needed against " + fmtN(N.owned) + " owned. Priced the dearest of the three " +
                   "quotes we hold, over " + N.coreDays + " season days."
                 : "We own more trucks than the peak needs, so nothing is rented.") +
          chip("salespeople at peak", fmtN(N.sales.peak), esc(String(N.sales.peakWhen || "").split(" ")[0]) + " · " + fmtN(N.sales.lpr) + " leads each",
               "The desk peaks a month ahead of the crews, because leads land about a month before the move." +
               (N.sales.active ? " " + fmtN(N.sales.active) + " carried a full load last season." : "")) +
          chip("marketing", money0(N.tot.mkt), fmtN(N.tot.leads) + " leads",
               "All advertising for the season, post cards included — never planned below what a job cost last season.") +
          "</div>";
      }

      /* ===================== THE CENSUS SURVEY, SHOWN =====================
         His ask 2026-09-21: "somewhere on that page display the SURVEY part which we took from
         that external source we connected." The American Community Survey (ext_acs_zcta) has fed
         the base ranking and the opportunity rank since 2026-09-15 and was never once SHOWN.
         It sits under the map because it is the map's missing half: the map says where our leads
         come from, the survey says how many people move there at all.

         LEADS PER 10,000 MOVERS IS THE LINE THAT MATTERS. Ranking new ground on movers alone --
         which is what the "opens new ground" flags do -- assumes a mover in Virginia is as likely
         to call us as one in New Jersey. Measured, they are two orders of magnitude apart, and a
         base does not close that gap: reviews, referrals and ad density do. The card says so in
         the data's own numbers instead of leaving the flags to imply otherwise. */
      function surveyHtml() {
        const rows = COUNTY.filter(c => SERVICE_AREAS.includes(c.State) && num(c.Population) > 0);
        if (!rows.length) return note("The Census survey columns are not on the county mart yet — they arrive with its next rebuild.");
        const by = {};
        rows.forEach(c => { const g = by[c.State] = by[c.State] || { st: c.State, n: 0, pop: 0, mov: 0, incW: 0, incP: 0, ownW: 0, ownP: 0, leads: 0, jobs: 0, blank: 0 };
          const pop = num(c.Population);
          g.n++; g.pop += pop; g.mov += num(c["Movers Per Year"]); g.leads += lead12(c); g.jobs += num(c.Jobs);
          if (c["Median Income"] != null) { g.incW += pop * num(c["Median Income"]); g.incP += pop; }
          if (c["Owner Share Pct"] != null) { g.ownW += pop * num(c["Owner Share Pct"]); g.ownP += pop; }
          if (!lead12(c)) g.blank++; });
        const S = Object.values(by).sort((a, b) => b.mov - a.mov);
        const T = S.reduce((a, g) => { Object.keys(a).forEach(k => { a[k] += g[k]; }); return a; },
                           { n: 0, pop: 0, mov: 0, incW: 0, incP: 0, ownW: 0, ownP: 0, leads: 0, jobs: 0, blank: 0 });
        const cap = g => g.mov ? 10000 * g.leads / g.mov : null;
        const home = S.slice().sort((a, b) => b.leads - a.leads)[0];
        const maxCap = Math.max.apply(null, S.map(g => cap(g) || 0)) || 1;
        const bar = v => '<span class="ap2-svbar"><i style="width:' + Math.max(1, Math.round(100 * (v || 0) / maxCap)) + '%"></i></span>';
        const line = (g, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + "><td><b>" + esc(g.st) + "</b><small> " + fmtN(g.n) + " counties" +
            (g.blank ? ", " + fmtN(g.blank) + " with no lead " + (HAS_L12 ? "in 12 months" : "this year") : "") + '</small></td><td class="num">' + fmtN(g.pop) +
          '</td><td class="num"><b>' + fmtN(g.mov) + '</b></td><td class="num">' + r1(100 * g.mov / (g.pop || 1)) + '%</td><td class="num">' +
          (g.incP ? money0(g.incW / g.incP) : "—") + '</td><td class="num">' + (g.ownP ? r1(g.ownW / g.ownP) + "%" : "—") +
          '</td><td class="num">' + fmtN(g.leads) + '</td><td class="num">' + fmtN(g.jobs) +
          '</td><td class="num"><b>' + r1(cap(g)) + "</b>" + (cls ? "" : bar(cap(g))) + "</td></tr>";
        /* the sentence, from the data: the biggest moving market we barely touch, against home */
        const colds = S.filter(g => g !== home && cap(g) != null && cap(g) < 0.25 * cap(home));
        /* lead with the market that is BIGGER than home and barely touched; failing that, the least-touched */
        const cold = colds.filter(g => g.mov > home.mov).sort((a, b) => cap(a) - cap(b))[0] || colds.slice().sort((a, b) => cap(a) - cap(b))[0];
        const say = home ? '<div class="ap2-say" style="margin:0 0 10px"><b>What the survey says.</b> ' +
          fmtN(T.mov) + " people move house in these eight states every year; in " + CAP_WIN + " " + fmtN(T.leads) + " of them became a lead — <b>" +
          r1(cap(T)) + " per 10,000 movers</b>. At home in " + esc(home.st) + " it is <b>" + r1(cap(home)) + "</b>." +
          /* the leads that sit in no county (2026-09-24, NOADDR_ST): said beside the capture they are missing from */
          (noAddrSay() ? " " + noAddrSay() : "") +
          (cold ? " In " + colds.map(g => "<b>" + esc(g.st) + "</b> (" + r1(cap(g)) + ")").join(", ") + " we reach less than a quarter of that. <b>" +
                  esc(cold.st) + "</b> moves " + fmtN(cold.mov) + " people a year — " +
                  (cold.mov > home.mov ? "more than " : r1(100 * cold.mov / home.mov) + "% of ") + esc(home.st) + "’s " + fmtN(home.mov) +
                  " — and sends us <b>" + r1(cap(cold)) + "</b>. The market is there; we are not known in it. " +
                  "A base puts a crew nearby, it does not make the phone ring: <b>capture is won by reviews, referrals and ad density</b>, " +
                  "so a new base there needs its own lead plan before it needs a truck." : "") + "</div>" : "";
        const top = rows.slice().sort((a, b) => num(b["Movers Per Year"]) - num(a["Movers Per Year"]));
        const vint = (rows.find(c => c["Survey Vintage"]) || {})["Survey Vintage"] || "ACS 5-year";
        /* A STATE WITH NO FLAG MUST SAY WHY. MA is the biggest market on this table after the
           four we work, and after the Concord base was switched off the coverage search ranked
           Boston the second best place in the country to open. That recommendation is suppressed
           by decision, so the card says it out loud rather than letting the reader conclude the
           numbers ruled it out. The market itself is never hidden -- it is in the table below. */
        const NOEXP = ((model.depots || {}).no_expansion || []).filter(st => by[st]);
        const ruled = NOEXP.length ? '<div class="ap2-note" style="margin:6px 0 10px"><b>' +
          NOEXP.map(st => esc(st)).join(", ") + '</b> ' + (NOEXP.length === 1 ? "carries" : "carry") +
          " no base flag on the map <b>by decision, not by these numbers</b> — " +
          NOEXP.map(st => esc(st) + " moves " + fmtN(by[st].mov) + " people a year and sends us " + r1(cap(by[st])) + " leads per 10,000").join("; ") +
          ". The market stays in this table so the cost of that decision is visible.</div>" : "";
        return say + ruled +
          '<div data-nopage><table data-name="Census survey by state" class="rs-table ap2-next"><thead><tr><th>State</th><th class="num">Population</th>' +
          '<th class="num">People moving a year</th><th class="num">Mover rate</th><th class="num">Median income</th><th class="num">Own their home</th>' +
          '<th class="num">Our leads<small> ' + CAP_WIN_SHORT + '</small></th><th class="num">Our jobs<small> this year</small></th><th class="num">Leads per 10,000 movers<small> ' + CAP_WIN_SHORT + '</small></th></tr></thead><tbody>' +
          S.map(g => line(g)).join("") + line(Object.assign({}, T, { st: "Eight states" }), "ap2-tot") + "</tbody></table></div>" +
          '<div class="ap2-note" style="margin:14px 0 6px"><b>County by county</b> — the biggest moving markets first. A big number on the left with a small one on the right is white space we could take.</div>' +
          '<div class="rs-tablewrap"><table data-name="Census survey by county" class="rs-table"><thead><tr><th>County</th><th>St</th><th class="num">Population</th>' +
          '<th class="num">People moving a year</th><th class="num">Median income</th><th class="num">Own</th><th class="num">Miles to base</th><th>Tier</th>' +
          '<th class="num">Leads<small> ' + CAP_WIN_SHORT + '</small></th><th class="num">Jobs<small> this year</small></th><th class="num">Leads per 10,000 movers<small> ' + CAP_WIN_SHORT + '</small></th></tr></thead><tbody>' +
          top.map(c => { const a4 = AREA_IX.County[c.State + "|" + c.County];
            const b = TIER_BAND(a4 ? num(a4.Tier) : Math.min(4, num(c.Tier)));
            return "<tr><td><b>" + esc(c.County) + "</b></td><td>" + esc(c.State) + '</td><td class="num">' + fmtN(num(c.Population)) +
              '</td><td class="num"><b>' + fmtN(num(c["Movers Per Year"])) + '</b></td><td class="num">' + (c["Median Income"] != null ? money0(num(c["Median Income"])) : "—") +
              '</td><td class="num">' + (c["Owner Share Pct"] != null ? r1(num(c["Owner Share Pct"])) + "%" : "—") + '</td><td class="num">' + r1(num(c["Miles To Base"])) +
              '</td><td><i class="ap2-sw ' + b + '"></i> ' + esc(TIER_LABEL[b]) + '</td><td class="num">' + fmtN(lead12(c)) + '</td><td class="num">' + fmtN(num(c.Jobs)) +
              '</td><td class="num">' + (c["Leads Per 10k Movers"] != null ? r1(num(c["Leads Per 10k Movers"])) : "—") + "</td></tr>"; }).join("") +
          "</tbody></table></div>" +
          note("Source: the U.S. Census Bureau’s American Community Survey (" + esc(vint) + "), by zip, rolled up to the county. <b>People moving a year</b> is population × the share of " +
               "<b>people</b> aged 1 and over who lived somewhere else a year ago — people, not households. " +
               "<b>Leads per 10,000 movers</b> sets " + CAP_WIN + " of leads against a year of movers" + (HAS_L12 ? ", so both halves cover a year" : "") +
               "; jobs are this year to date. <b>All companies</b> — Delaware’s figure includes Tuji’s own leads, " +
               "which is why it reads so high. Income and ownership are population-weighted." +
               /* beside the county table too (2026-09-24): Monmouth's row is the one they left */
               (noAddrShort() ? " " + noAddrShort() + " — Monmouth’s row is the one they used to sit in." : ""));
      }

      /* "IF WE IDENTIFY A BASE AS NEGATIVE, WHY DO WE PUSH MARKETING THERE?" (his question 2026-09-21).
         Because nothing pushes it: a county's budget is its share of its state's LEADS, and the tier
         never enters. That was called "a real hole" in chat and left live. The strip says where the
         money lands by colour, and why the red part cannot simply be switched off: measured
         2026-09-21, 43.7% of the leads in Fix counties come from pay-per-lead marketplaces (Angi,
         Thumbtack), which bill wherever the lead appears, so about a third of what lands in red --
         roughly $17k of $50.7k -- is money anyone can actually steer. Fix counties return $176 a
         lead against $418 in Push, so that third is worth moving. */
      /* ONE LINE THAT MAKES THE POINT BEFORE ANYONE READS THE COLOURS (his ask 2026-09-22: this is
         the only page that gets presented). Everything in it is counted off the same rows the map is
         drawn from, so the sentence can never disagree with the picture above it. */
      function headlineStrip(R) {
        const inArea = R.filter(r => SERVICE_AREAS.includes(r.st));
        const movers = inArea.reduce((a, r) => a + r.movers, 0);
        const covered = inArea.filter(r => r.fm60 > 0);
        const covMovers = covered.reduce((a, r) => a + r.movers, 0);
        // a year of leads over a year of movers, off the shared CAP_ST (2026-09-23); the blank count
        // is on the same trailing year, so the sentence does not mix windows
        const cap = capAll(SERVICE_AREAS).cap;
        const blank = inArea.filter(r => !r.leads12).length;
        if (!movers || cap == null) return "";
        /* THE BIGGEST MARKET NO CREW CAN REACH -- but never one in a state we have ruled out. The
           first version named Middlesex MA, which is the largest by movers and precisely the place he
           had just decided not to expand into; a headline that argues for the thing we rejected is
           worse than no headline. */
        const noGo = (model.depots || {}).no_expansion || [];
        const gap = inArea.filter(r => !r.fm60 && noGo.indexOf(r.st) < 0)
          .slice().sort((a, b) => b.movers - a.movers)[0];
        return '<div class="ap2-headline"><span class="n">' + fmtN(movers) + "</span> people move house a year across these " +
          fmtN(inArea.length) + " counties. <b>" + Math.round(100 * covMovers / movers) + "%</b> of them are within 60 miles of one of our crews, and we reach <b>" +
          r1(cap) + " in every 10,000</b> (leads in " + CAP_WIN + ")." +
          (gap ? " The largest market no crew can reach is <b>" + esc(gap.county) + " " + esc(gap.st) + "</b>, " + fmtN(gap.movers) + " movers a year." : "") +
          " <span class=\"q\">" + fmtN(blank) + " counties have sent us no lead " + (HAS_L12 ? "in the last 12 months" : "this year") + ".</span></div>";
      }

      function budgetByBand(R) {
        const by = {}; let tot = 0;
        R.forEach(r => { if (r.budget > 0) { by[r.band] = (by[r.band] || 0) + r.budget; tot += r.budget; } });
        if (!tot) return "";
        const seg = b => by[b] ? '<span class="ap2-mk"><i class="ap2-sw ' + b + '"></i>' + TIER_LABEL[b] + " <b>" + money0(by[b]) + "</b> · " + Math.round(100 * by[b] / tot) + "%</span>" : "";
        return '<div class="ap2-note" style="margin:2px 0 8px"><b>Where the marketing lands, by tier:</b> ' + ["t1", "t2", "t3", "t4", "grey"].map(seg).join(" ") +
          (by.t4 ? " — the budget follows <b>leads, not the tier</b>, so Tier 4 counties still draw money. Most of it cannot be switched off: about 44% of the leads in the weakest counties are " +
                    "pay-per-lead marketplaces (Angi, Thumbtack) that bill wherever the lead appears. <b>Roughly a third of the red share is steerable</b>, and it is worth steering — " +
                    "a lead in the weakest counties returned $176 against $418 in the strongest <small style=\"display:inline\">(measured 21 Sep 2026)</small>." : "") + "</div>";
      }

      /* ===================== THE WHAT-IF =====================
         His ask 2026-09-21: "i need to be able to do the adjustmnets live, like change the base
         location live, change budget, increase crew and so on -- how the changes will affect it?
         very functional analytical projection kind of thing."

         WHAT THIS TOOL REFUSES TO DO IS THE POINT OF IT. Four things were measured before a line of
         it was written (2026-09-22, each re-derived by a second pass told to refute the first), and
         three of them say a lever he named barely moves the answer:

           CREWS DO NOT BUY JOBS. Foremen reached 90% of the season's maximum on 7 days of 123 in
           2025 and 3 of 123 in 2026, and leads asking for those dates booked at the same rate as any
           other (16.2% against 16.1%). Capacity cost about 50 jobs in 2026 and nearer nothing in
           2025, on a handful of month-end dates. So a crew added here changes COST and not jobs, and
           the only job a crew can win back is bought with the surge lever, capped at what was lost.

           BUDGET DOES NOT BUY JOBS EITHER, at least not measurably: +22% of advertising bought +10
           jobs, the de-seasonalised elasticity is -0.06, and a third of the ledger is pay-per-lead,
           so spend FOLLOWS leads rather than causing them. The dial therefore defaults to ZERO
           response. He can type the elasticity he believes and argue from the difference -- that
           gap is the honest shape of the disagreement, and it is better on the screen than in a row.

           A BASE DOES NOT INSTANTLY RAISE BOOKING. It does raise it eventually: inside 15 miles of a
           STAFFED base New Jersey books 31.6% against 21.1% at 15-35 miles, Pennsylvania 35.6%
           against 18.0%, odds ratios 1.84 and 1.63 with lead source held equal, and nothing beyond
           about 25 miles. Whether that is the mileage or simply being known where you are known
           cannot be separated, so the ring is worth a slider that starts at nought and is labelled
           "how much of it has arrived", never a number that appears the day the lease is signed.

           WHAT A BASE BUYS TODAY IS DRIVING, and it is small: about $1.11 a road mile in fuel and
           tolls, roughly 1.4 road miles per straight-line mile as crews are actually dispatched, and
           crew pay does not move with distance at all until the travel passes ~120 road miles.

         So the lever that moves this plan is CAPTURE -- 66 leads per 10,000 movers at home against 6
         in Maryland and 0.6 in Virginia -- and the tool is built to make that obvious rather than to
         flatter the idea that another yard or another truck is what the season is short of. */
      const SCN = {
        ROAD_PER_STRAIGHT: 1.4,   // measured: 1.41 road mi on the to+from legs per straight-line mi
        ROAD_MI_USD: 1.11,        // fuel $0.79 (7 mpg x WEX) + tolls ~$0.22, +10% -- crew pay is flat
        RING_MI: 15, RING_PTS: 10,// +10.5 pts NJ / +17.6 PA inside 15 mi of a STAFFED base; nil past 25
        SURGE_CAP: 55,            // jobs lost to capacity in the worst measured season (2026)
        TRUCK_SEASON: 13400,      // one more crew, one season: 4.39 Enterprise cycles x $3,050
      };
      /* LEADS PER JOB FOR A CAPTURE STATE (2026-09-24): the state's OWN last-season ratio whenever it
         ran a season of jobs (10+), not only past the plan's 40-job gate. Maryland ran 23 jobs on 192
         Apr-Jul leads -- 8.3 a job, and the Elkridge listing's leads book about 10% -- so pricing its
         capture at the company's 5.61 counted about half as many jobs again as its own history
         supports. Raw ratio, before the budget floor: this converts leads into jobs, it buys nothing. */
      const capLpj = (r, N) => AP_CAPTURE.lpj(r, N.mkt.lpjAll);
      /* opts (2026-09-24), not part of the saved scenario:
           capture  false -- price every lever except capture; true -- count it even when the
                    scenario's targets are ceilings (what reaching them is worth). Left out, the
                    scenario's own `ceiling` decides (AP_CAPTURE.counts).
         ONE BASIS FOR "NOW" (2026-09-24 review). The card measured its ceilings from the clock's
         level (PA 43.6, MD 7.7) and priced Season 2027 without capture; one click on "Open it in the
         What-if" priced the SAME targets from the 12-month dial (PA 47.5, MD 7.3) and counted them:
         the card said -$580, the What-if +$187,718 for the same expansion (rendered on this model).
         The capture lever now measures every state from today's level -- Zip to Zip, latest three
         complete months, seasonally adjusted (model.capture_clock) -- and falls back to the 12-month
         dial only where the clock has no level; the flag's foremen (xpFor) already did. The dial is
         still shown beside it. Zip to Zip is also the plan's own company (his 16 Sep "only ZIP"),
         which the all-company dial is not: Delaware's 222.6 carries Tuji, its Zip to Zip level 85.6. */
      function scenarioCalc(override, opts) {
        opts = opts || {};
        const N = nextCalc(), c = override || inputs.scn;
        const base = { jobs: N.tot.jobs, revenue: N.tot.revenue || 0, expense: N.tot.expense || 0,
                       rent: N.tot.rent || 0, mkt: N.tot.mkt || 0 };
        base.net = base.revenue - base.expense - base.rent - base.mkt;
        const perJob = base.jobs ? base.revenue / base.jobs : 0;
        const moves = [];                       // every line the scenario changes, with its reason
        let dJobs = 0, dMkt = 0, dRent = 0, dCost = 0;

        /* ---- the capture dial, per state: the one lever the data says is large ----
           SEASON LEADS (2026-09-24). (want - now) x movers / 10,000 is a YEAR of extra leads; it used
           to be divided by leads per SEASON job and set beside a May-Aug plan, so every capture figure
           on this page -- the expansion card's "+$455,571 Season 2027" among them -- was about 2.2x the
           season. Now the points convert to the season's share of that year (SEASON_SHARE), and the
           calendar year is kept beside it (addLeadsYear). Everything downstream -- jobs, marketing, the
           truck over four months -- is then season-consistent without further edits.
           A state in c.listing reaches its capture through a Business Profile listing: those leads
           carry no advertising, so its cost per lead is nil (the critic's correction, 2026-09-24).
           The arithmetic is AP_CAPTURE.row's; a ceiling scenario keeps it out of the totals. */
        const capRows = [];
        const listing = Array.isArray(c.listing) ? c.listing : [];
        const counted = AP_CAPTURE.counts(c, opts);
        SERVICE_AREAS.forEach(st => {
          const g = CAP_ST[st];                 // trailing 12 months, the shared CAP_ST (2026-09-23)
          const movers = g ? g.movers : 0;
          if (!movers) return;
          const lv = runOf(st), now = lv != null ? lv : g.cap;
          const r = N.rows.find(x => x.st === st);
          const L = capLpj(r, N);
          const want = (c.capture || {})[st] == null ? null : +c.capture[st];
          const viaListing = listing.indexOf(st) >= 0;
          const row = Object.assign({ st, dial: g.cap, level: lv, lpjOwn: L.own, planLeads: r ? r.leads : 0 },
            AP_CAPTURE.row({ now, want, movers, lpj: L.lpj, cpl: N.mkt.cplOf(st), viaListing, share: SEASON_SHARE }));
          if (row.addJobs && counted) { dJobs += row.addJobs; dMkt += row.addMkt; }
          capRows.push(row);
        });
        const capJobs = counted ? capRows.reduce((a, r) => a + (r.addJobs || 0), 0) : 0;
        if (capJobs > 0) moves.push({ k: "capture", l: "Reaching more of the movers",
          why: capRows.filter(r => r.addJobs).map(r => esc(r.st) + " " + r1(r.now) + " \u2192 " + r1(r.want) + " per 10k: +" +
                 fmtN(r.addLeads) + " season leads (" + Math.round(SEASON_SHARE * 100) + "% of +" + fmtN(r.addLeadsYear) + " a year), " +
                 r1(r.lpj) + " a job" + (r.viaListing ? ", through a listing: no ad cost" : "")).join("; "),
          jobs: capJobs, usd: capJobs * perJob - capRows.reduce((a, r) => a + (r.addMkt || 0), 0) - capJobs * (base.jobs ? base.expense / base.jobs : 0) });

        /* ---- a new base at a zip ---- */
        let dep = null, ring = null;
        const picks = (basesFor().coverage || []);
        const chosen = (c.picks || []).map(l => picks.find(x => x.label === l)).filter(Boolean);
        if (chosen.length || (c.zip && /^\d{5}$/.test(c.zip))) {
          dep = chosen.length
            ? depotAt(chosen.map(x => ({ lat: x.la, lon: x.lo, side: x.side || "" })), chosen.map(x => x.label).join(" + "))
            : depotTry(c.zip);
          if (dep) {
            const savedMi = Math.max(0, num(dep.saved_mi_per_job));
            dep.driving = savedMi * base.jobs * SCN.ROAD_PER_STRAIGHT * SCN.ROAD_MI_USD;
            {
              /* a county in reach of TWO new yards is still one county */
              const near = COUNTY.filter(x => num(x.Latitude) &&
                dep.pts.some(q => !acrossSound(q.side || "", sideOf(x.State, x.County)) &&   // the Sound (2026-09-24)
                                 hav(num(x.Latitude), num(x.Longitude), q.lat, q.lon) <= SCN.RING_MI));
              const nearLeads = near.reduce((a, x) => a + num(x.Leads), 0);
              const allLeads = COUNTY.reduce((a, x) => a + num(x.Leads), 0);
              const share = allLeads ? nearLeads / allLeads : 0;
              const planLeads = share * N.tot.leads;              // this year's shape, next season's volume
              const lpjA = N.mkt.lpjAll || 6;
              ring = { counties: near.length, leads: planLeads,
                       jobs: planLeads * (SCN.RING_PTS / 100) * (num(c.maturity) / 100) / Math.max(1, lpjA / (lpjA)) };
              /* a booking-rate rise turns leads into jobs directly: +pts% of the leads in the ring */
              ring.jobs = planLeads * (SCN.RING_PTS / 100) * (num(c.maturity) / 100);
              dJobs += ring.jobs;
            }
            dCost += num(c.park) * (N.core.length || 4) * dep.n;  // parking, for the season, per yard
            dCost -= dep.driving;                                  // a saving is a negative cost
            moves.push({ k: "base", l: (dep.n > 1 ? dep.n + " bases: " : "A base at ") + esc(dep.label),
              why: (savedMi > 0 ? r2(savedMi) + " mi/job less driving" : "no driving saved") +
                   (ring && ring.jobs > 0 ? ", " + r1(ring.jobs) + " jobs from the home ring at " + Math.round(num(c.maturity)) + "% maturity" : "") +
                   ", " + money0(num(c.park) * dep.n) + " a month of parking",
              jobs: ring ? ring.jobs : 0,
              usd: dep.driving - num(c.park) * (N.core.length || 4) * dep.n +
                   (ring ? ring.jobs * (perJob - (base.jobs ? base.expense / base.jobs : 0)) : 0) });
          }
        }

        /* ---- the marketing budget, at whatever response he believes ---- */
        const bp = num(c.budgetPct) / 100, el = num(c.elast);
        if (bp) {
          const addMkt = base.mkt * bp, addJobs = base.jobs * bp * el;
          dMkt += addMkt; dJobs += addJobs;
          moves.push({ k: "budget", l: (bp > 0 ? "+" : "") + Math.round(bp * 100) + "% marketing",
            why: el ? "at the " + r2(el) + " response you typed" : "at the measured response, which is nil \u2014 +22% once bought +10 jobs",
            jobs: addJobs, usd: addJobs * (perJob - (base.jobs ? base.expense / base.jobs : 0)) - addMkt });
        }

        /* ---- surge crews on the month-end dates, capped at what capacity really cost ---- */
        const sd = Math.max(0, num(c.surgeDays)), sc = Math.max(0, num(c.surgeCrews));
        if (sd && sc) {
          const rate = chainOf("_all") || 1.27;
          const raw = sd * sc * rate;
          const got = Math.min(raw, SCN.SURGE_CAP);
          const cost = sd * sc * (N.perDay || 154);
          dJobs += got; dRent += cost;
          moves.push({ k: "surge", l: fmtN(sc) + " extra crew" + (sc === 1 ? "" : "s") + " on " + fmtN(sd) + " peak days",
            why: raw > got ? "capped at " + SCN.SURGE_CAP + " \u2014 that is all capacity cost the worst measured season"
                           : r2(rate) + " jobs a foreman-day, on days the work was actually turned away",
            jobs: got, usd: got * (perJob - (base.jobs ? base.expense / base.jobs : 0)) - cost });
        }

        /* ---- crews for the season: cost only, because capacity did not bind ---- */
        const cr = Math.round(num(c.crews));
        if (cr) {
          const cost = cr * SCN.TRUCK_SEASON;
          dRent += cost;
          moves.push({ k: "crews", l: (cr > 0 ? "+" : "") + cr + " crew" + (Math.abs(cr) === 1 ? "" : "s") + " for the season",
            why: "no jobs attached: crews did not cap the season. " + money0(SCN.TRUCK_SEASON) + " of truck each",
            jobs: 0, usd: -cost });
        }

        /* JOBS HAVE TO PAY FOR THE CREWS THAT RUN THEM (2026-09-22). Job expense scales with the
           jobs, so crew PAY was always in -- but the truck a new crew needs is a fixed cost that
           was not, and 400 extra Virginia jobs need about four more foremen. Surge crews are left
           out because they carry their own cost already. Crews do not CREATE jobs; jobs create the
           need for crews, which is the direction the measurement supports.
           SEASON JOBS OVER SEASON CAPACITY (2026-09-24): capture jobs used to be a YEAR's, crammed into
           the four core months here, so the truck line overstated by the same ~2.2x as the jobs. They
           are season jobs now (scenarioCalc's capture block), so this line needed no edit of its own. */
        const demandJobs = dJobs - (moves.filter(m => m.k === "surge").reduce((a, m) => a + m.jobs, 0));
        if (demandJobs > 0.05) {
          const rate = chainOf("_all") || 1.27;
          const perSeason = rate * DAYS_PER_MONTH * (N.core.length || 4);
          /* NOT ROUNDED UP. A whole truck for 1.9 extra jobs is a $13,400 cliff: it made a small
             scenario read as a loss and, beside it, a large one look cheap. The truck is RENTED --
             $3,050 a 28-day cycle, and the season's own rent line is already priced by the day --
             so marginal capacity really is close to linear and the fraction is the honest cost. */
          const need = demandJobs / perSeason;
          if (need > 0.004) { const cost = need * SCN.TRUCK_SEASON; dRent += cost;
            moves.push({ k: "needcrew", l: (need < 0.1 ? "Part of a crew" : r1(need) + " more crew" + (need >= 1.05 || need < 0.95 ? "s" : "")) + " to run the extra jobs",
              why: r1(demandJobs) + " jobs at " + r2(rate) + " a foreman-day over " + (N.core.length || 4) +
                   " season months \u2014 their pay is already inside job expense; this is the truck, rented by the day",
              jobs: 0, usd: -cost }); }
        }
        const jobs = base.jobs + dJobs;
        const k = base.jobs ? jobs / base.jobs : 1;
        const scn = { jobs, revenue: base.revenue * k, expense: base.expense * k,
                      rent: base.rent + dRent, mkt: base.mkt + dMkt, extra: dCost };
        scn.net = scn.revenue - scn.expense - scn.rent - scn.mkt - scn.extra;
        return { N, base, scn, moves, capRows, counted, dep, ring, perJob, picks };
      }

      /* ===================== THE EXPANSION HE DECIDED, BESIDE THE PLAN =====================
         2026-09-22: "ok lets go with MD and PA", after the what-if priced all five picks. He also
         chose to keep it OUT of the Season plan -- the plan stays the number the history supports,
         so nobody staffs for work that has not been won -- to plan on the conservative capture
         rather than the modelled one, and to open Pennsylvania first.

         It is priced here by exactly the engine the what-if uses, from the decision that travels in
         the model, so this card and that pane can never drift apart or be separately edited into
         disagreement. Nothing on it is added to a plan total anywhere on this page. */
      function expansionScn() {
        const X = model.expansion; if (!X) return null;
        const path = X.capture_path || {};
        // ceiling (2026-09-24 review): the What-if opened from the card prices it as the card does
        return Object.assign({}, SCN0, { picks: (X.steps || []).map(s2 => s2.base),
                                         capture: Object.assign({}, X.capture || {}),
                                         listing: Object.keys(path).filter(st => path[st] === "listing"),
                                         ceiling: X.ceiling !== false,
                                         maturity: num(X.maturity) });
      }
      /* THE CLOCK ON THE CARD (2026-09-24). The card printed "+$454,991, Season 2027" for the targets:
         a YEAR of leads priced as a season (~2.2x), measured from the 12-month dial, and credited to
         "the expansion" although Maryland's rise so far came from a listing with no yard. Now:
           \u00b7 Season 2027 counts NOTHING beyond today's level -- the targets are CEILINGS until a new
             step is real (3 months above the old level) -- so the plan-beside table moves only by
             the yards' own line;
           \u00b7 the ceilings (a season and a calendar year at target) are priced from today's level
             (the clock's Zip to Zip rate), at each state's own leads per job, with no ad cost where a
             listing is the path;
           \u00b7 what is ALREADY happening without a yard is said on its own line, and belongs to the
             plan, not to the expansion;
           \u00b7 "Open it in the What-if" loads the same scenario AS CEILINGS, from the same "now", so
             the pane's Season total is this card's -$580, not the +$187,718 the first build showed
             one click away (2026-09-24 review). */
      const mSgn =v => v < 0 ? "\u2212" + money0(-v) : money0(v);   // money0 prints "$-551"
      function ceilingOf(sc, st) {
        const X = model.expansion || {};
        const one = Object.assign({}, sc, { picks: [], zip: "", capture: { [st]: num((X.capture || {})[st]) } });
        const C = scenarioCalc(one, { capture: true });   // what reaching it is worth: counted here only
        const row = C.capRows.find(r => r.st === st) || {};
        const season = C.scn.net - C.base.net;
        return { st, row, season, year: SEASON_SHARE ? season / SEASON_SHARE : null,
                 jobs: C.scn.jobs - C.base.jobs };
      }
      function whenHtml(st, want) {
        const c = clkOf(st), nm = ST_NAME[st] || st;
        /* <strong>, never <b>, inside the box: `.ap2-xps b` is the box's block-level heading */
        const S_ = t => "<strong>" + t + "</strong>";
        if (!c || c.level == null) return '<div class="ap2-xps"><b>' + esc(nm) + "</b><span>no clock</span><small>The capture clock is missing from the model \u2014 run " + S_("sources=area-plan") + ".</small></div>";
        const t = c.target || {};
        const lm = (c.level_months || []);
        const win = lm.length ? ymLabel(lm[0]).slice(0, 3) + "\u2013" + ymLabel(lm[lm.length - 1]) : "the latest three months";
        const since = c.sa && c.sa[0] ? c.sa[0][0] : "";
        const steps = (c.steps || []).filter(s => (s.dir > 0 || s.status === "real") && s.ym >= since);
        const stepSay = steps.length ? steps.slice(-3).map(s => S_(esc(ymLabel(s.ym))) +
            (s.name ? " \u2014 " + esc(s.name) : " \u2014 cause not named") + " (" + r1(s.before) + " \u2192 " + r1(s.after) +
            (s.status === "provisional" ? ", " + S_("provisional") + ": " + s.months + " of " + ((CLK.rule || {}).confirm_months || 3) + " months" : "") + ")").join("; ")
          : "no step since " + esc(ymLabel((c.sa && c.sa[0] ? c.sa[0][0] : CLK.last_month)));
        const sister = c.sister_pts != null && c.sister_pts >= 0.3
          ? " The page\u2019s all-company 12-month " + r1(capOfSt(st)) + " includes about " + S_(r1(c.sister_pts)) + " of Tuji leads, which are going away." : "";
        const catchUp = c.dial_catches_up
          ? " The 12-month figure keeps moving on its own until about " + S_(esc(ymLabel(c.dial_catches_up))) + ", as the months before the last step leave its window \u2014 read the level, not the dial." : "";
        const ceil = !(want > c.level) ? "at or under today\u2019s level: nothing to count"
          : t.step_like && t.steps_needed != null
            ? "a " + S_("ceiling") + ": it needs about " + S_(r1(t.steps_needed)) + " more step" + (t.steps_needed >= 1.5 ? "s" : "") + " the size of " + esc(t.step_like.name || "the last one") + "\u2019s (+" + r1(t.step_like.size) + "). $0 counted for Season " + esc(String(FC.year)) + " beyond today\u2019s level."
            : t.was_at_target
              ? "a " + S_("return") + ", not growth: the 12-month figure sat at or above " + r1(want) + " from " + esc(ymLabel(t.was_at_target[0])) + " to " + esc(ymLabel(t.was_at_target[1])) +
                (t.peak_t12_all ? " (peak " + r1(t.peak_t12_all[1]) + ", " + esc(ymLabel(t.peak_t12_all[0])) + ")" : "") + ". Not at today\u2019s rate: $0 counted until it turns up."
              : "a " + S_("ceiling") + ": nothing measured says it arrives by itself. $0 counted for Season " + esc(String(FC.year)) + ".";
        return '<div class="ap2-xps"><b>' + esc(nm) + " \u2014 " + r1(c.level) + " today \u2192 " + r1(want) + "</b><span>" +
            (steps.some(s => s.status === "provisional" && s.dir > 0) ? "a new step is forming"
              : steps.length && steps[steps.length - 1].dir < 0 ? "stepped down"
              : c.t12 != null && c.level < 0.95 * c.t12 ? "running below its 12-month figure" : "holding at its level") + "</span>" +
          "<small>Zip to Zip, " + esc(win) + ", seasonally adjusted, per 10,000 movers a year (12 months: " + r1(c.t12) + "). Steps: " + stepSay + "." + sister + catchUp +
            " The target is " + ceil + "</small></div>";
      }
      function expansionHtml() {
        const X = model.expansion, sc = expansionScn();
        if (!X || !sc || !FC.year) return "";
        const Y = String(FC.year);
        const steps = (X.steps || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
        const sts = steps.map(s2 => s2.state).filter((st, i, a) => st && a.indexOf(st) === i && (X.capture || {})[st] != null);
        // Season Y on the clock: every lever but capture -- the yards' own line
        const S = scenarioCalc(sc, { capture: false });
        const dJobs = S.scn.jobs - S.base.jobs, dNet = S.scn.net - S.base.net;
        const baseMove = S.moves.find(m => m.k === "base");
        // the ceilings, per state, measured from today's level (scenarioCalc's one basis)
        const ceil = sts.map(st => ceilingOf(sc, st)).filter(x => x.row && x.row.addJobs > 0);
        const cS = ceil.reduce((a, x) => a + x.season, 0), cY = ceil.reduce((a, x) => a + (x.year || 0), 0);
        const N = S.N;
        /* ALREADY HAPPENING WITHOUT A YARD: today's level for a season, against last season and
           against what the plan carries. It is the PLAN's (history catching up), never the expansion's. */
        const happening = sts.map(st => { const c = clkOf(st), g = CAP_ST[st], r = N.rows.find(x => x.st === st);
          if (!c || c.level == null || !g || !r) return null;
          const L = capLpj(r, N);
          const lead = AP_CAPTURE.seasonLeads(c.level, g.movers, SEASON_SHARE).season;
          return { st, level: c.level, lead, last: r.leadsLast, jobs: L.lpj ? lead / L.lpj : null, lpj: L.lpj,
                   plan: r.jobs, ran: r.jobsLast }; }).filter(Boolean);
        const hRow = h => { const gap = h.jobs != null ? h.jobs - h.plan : null;
          return "<tr><td><b>" + esc(ST_NAME[h.st] || h.st) + '</b></td><td class="num">' + r1(h.level) + '</td><td class="num">' + fmtN(h.lead) +
          '</td><td class="num">' + fmtN(h.last) + '</td><td class="num">' + fmtN(h.jobs) + "<small>at " + r1(h.lpj) + ' a job</small></td><td class="num">' + fmtN(h.ran) +
          '</td><td class="num">' + fmtN(h.plan) + '</td><td class="num"><b class="' + (gap >= 0.5 ? "ap2-ok" : gap <= -0.5 ? "ap2-hire" : "") + '">' +
            (gap == null ? "—" : (gap >= 0.5 ? "+" : gap <= -0.5 ? "−" : "") + fmtN(Math.abs(gap))) + "</b></td></tr>"; };
        const ahead = happening.filter(h => h.jobs != null && h.jobs - h.plan >= 0.5);
        const behind = happening.filter(h => h.jobs != null && h.jobs - h.plan <= -0.5);
        return '<div class="ap2-say" style="margin:0 0 10px"><b>Decided ' + esc(dayLabel(X.decided_on)) +
            ': Maryland and Pennsylvania.</b> Deliberately <b>not inside the ' + esc(Y) + ' plan above</b> \u2014 that number is what the history supports. ' +
            'Since 24 Sep 2026 the targets are <b>ceilings</b>: each state\u2019s capture is read as today\u2019s level and the steps that got it there, ' +
            'and Season ' + esc(Y) + ' counts <b>nothing beyond today\u2019s level</b> until a new step has run three months. ' +
            'Maryland\u2019s yard waits for the Montgomery listing test (below), which reads out in Sep 2027.</div>' +
          '<div class="ap2-xp">' + steps.map(st => '<div class="ap2-xps"><b>' + st.order + ". " + esc(st.base) + "</b>" +
            "<span>" + esc(st.when) + "</span><small>" + esc(fillCap(st.why)) + (runSay(st) ? ". " + esc(runSay(st)) : "") + "</small></div>").join("") + "</div>" +
          '<div class="ap2-xp" style="margin-top:10px">' + sts.map(st => whenHtml(st, num(X.capture[st]))).join("") + "</div>" +
          '<div class="ap2-gt-h" style="margin-top:14px">Season ' + esc(Y) + " on the clock \u2014 nothing counted beyond today\u2019s level</div>" +
          '<div class="rs-tablewrap"><table data-name="The expansion, beside the plan" class="rs-table ap2-next"><thead><tr>' +
            "<th>Season " + esc(Y) + '</th><th class="num">The plan</th><th class="num">With the expansion</th><th class="num">Difference</th></tr></thead><tbody>' +
            '<tr><td><b>Jobs</b><small>the yards\u2019 home ring only: capture beyond today\u2019s level counts nothing yet</small></td><td class="num">' + fmtN(S.base.jobs) + '</td><td class="num">' + fmtN(S.scn.jobs) +
              '</td><td class="num"><b>' + (dJobs >= 0.5 ? "+" : "") + fmtN(dJobs) + "</b></td></tr>" +
            '<tr><td>Marketing it needs</td><td class="num">' + money0(S.base.mkt) + '</td><td class="num">' + money0(S.scn.mkt) +
              '</td><td class="num">' + mSgn(S.scn.mkt - S.base.mkt) + "</td></tr>" +
            '<tr><td>Crews it needs<small>the truck; their pay is inside job expense</small></td><td class="num">\u2014</td><td class="num">' +
              (() => { const m = S.moves.find(x => x.k === "needcrew"); return m ? esc(m.l.replace(" to run the extra jobs", "")) : "\u2014"; })() +
              '</td><td class="num">' + mSgn(S.base.rent - S.scn.rent) + "</td></tr>" +
            '<tr><td>Parking, net of the driving saved</td><td class="num">\u2014</td><td class="num">' +
              mSgn(S.scn.extra) + '</td><td class="num">' + mSgn(-S.scn.extra) + "</td></tr>" +
            '<tr class="ap2-tot"><td><b>Net before overhead</b></td><td class="num">' + money0(S.base.net) + '</td><td class="num">' +
              money0(S.scn.net) + '</td><td class="num"><b class="' + (dNet >= 0 ? "ap2-ok" : "ap2-hire") + '">' + mSgn(dNet) + "</b></td></tr>" +
          "</tbody></table></div>" +
          (ceil.length ? '<div class="ap2-gt-h" style="margin-top:14px">The targets are ceilings \u2014 what reaching them would be worth, ' +
              (CLK ? "from today\u2019s level" : "from the 12-month figure (the capture clock is missing)") + "</div>" +
            '<div class="rs-tablewrap"><table data-name="The targets, as ceilings" class="rs-table ap2-next"><thead><tr>' +
            '<th>Ceiling</th><th class="num">Today</th><th class="num">Target</th><th class="num">Season leads</th>' +
            '<th class="num">Season jobs</th><th class="num">A season</th><th class="num">A year</th><th class="num">In ' + esc(Y) + "</th></tr></thead><tbody>" +
            ceil.map(x => "<tr><td><b>" + esc(ST_NAME[x.st] || x.st) + "</b><small>" + r1(x.row.lpj) + " leads a job" + (x.row.lpjOwn ? " (its own)" : " (the company\u2019s)") +
                (x.row.viaListing ? " \u00b7 through a listing: no ad cost" : " \u00b7 $" + r1(x.row.cpl) + " a lead") + '</small></td><td class="num">' + r1(x.row.now) +
              '</td><td class="num">' + r1(x.row.want) + '</td><td class="num">+' + fmtN(x.row.addLeads) + "<small>of +" + fmtN(x.row.addLeadsYear) + ' a year</small></td><td class="num">+' + r1(x.row.addJobs) +
              '</td><td class="num">' + mSgn(x.season) + '</td><td class="num">' + mSgn(x.year) + '</td><td class="num"><b>$0</b></td></tr>').join("") +
            '<tr class="ap2-tot"><td><b>Both</b></td><td></td><td></td><td class="num">+' + fmtN(ceil.reduce((a, x) => a + x.row.addLeads, 0)) +
              '</td><td class="num">+' + r1(ceil.reduce((a, x) => a + x.row.addJobs, 0)) + '</td><td class="num"><b>' + mSgn(cS) + '</b></td><td class="num">' + mSgn(cY) +
              '</td><td class="num"><b>$0</b></td></tr></tbody></table></div>' : "") +
          (happening.length ? '<div class="ap2-gt-h" style="margin-top:14px">Already happening without a yard \u2014 today\u2019s level held for a season, against the plan</div>' +
            '<div class="rs-tablewrap"><table data-name="Already happening, without a yard" class="rs-table ap2-next"><thead><tr>' +
            '<th>State</th><th class="num">Level</th><th class="num">Apr\u2013Jul leads</th><th class="num">Last season</th>' +
            '<th class="num">Season jobs</th><th class="num">Ran</th><th class="num">Plan</th><th class="num">Vs plan</th></tr></thead><tbody>' +
            happening.map(hRow).join("") + "</tbody></table></div>" : "") +
          note("<b>How to read it.</b> The first table is Season " + esc(Y) + " as the clock sees it: only the yards\u2019 own line moves (" +
               (baseMove ? mSgn(baseMove.usd) : "\u2014") + ": driving saved, parking, and the home ring at " + Math.round(num(X.maturity)) + "% maturity) \u2014 a base opens no market on its own. " +
               "The second is what the targets would be worth if they were reached, from today\u2019s level: a ceiling, and none of it is in any total. " +
               "The third is today\u2019s level held for a season, against the plan. " +
               (ahead.length ? ahead.map(h => esc(ST_NAME[h.st] || h.st) + "\u2019s <b>+" + fmtN(h.jobs - h.plan) + "</b>").join(" and ") +
                 " season jobs are <b>already happening without a yard</b>: they belong to the <b>plan</b> (its three-season average has not caught up with the step), not to the expansion, and nothing on this card adds them. " : "") +
               (behind.length ? behind.map(h => esc(ST_NAME[h.st] || h.st) + "\u2019s level supports <b>" + fmtN(h.plan - h.jobs) + "</b> fewer").join(" and ") +
                 " season jobs than the plan carries \u2014 the three-season average still remembers a higher year. " : "") +
               "Units: a capture point is a year of leads per 10,000 movers, and " + shareSay() + ". " +
               '<button type="button" class="ap2-goto" data-openxp="1">Open it in the What-if \u2193</button>');
      }

      /* ===================== MARYLAND: THE CLOCK AND THE TEST (2026-09-24) =====================
         One block under the expansion card, read from model.capture_clock.states.MD and
         model.geo_test (area_plan.build_capture_clock / build_geo_test). THE PAGE COMPUTES NOTHING
         HERE: zones, capture, guards, status and verdict all arrive built, so the card and the
         pre-registration (docs/plans/2026-09-24-maryland-geo-test.md) cannot disagree.
         Charts are hand-drawn SVG (the page loads no chart library), coloured from --gt-* tokens
         defined for light AND dark on .ap2-gt, and sized in a box that scrolls on its own at phone
         width so the page itself never scrolls sideways. */
      function gtChart(o) {
        const W = 720, H = 250, L = 46, R = 16, T = 20, B = 34;
        const yms = [...new Set([].concat(...o.lines.map(l => l.pts.map(p => p[0]))))].sort();
        if (yms.length < 2) return "";
        const X = i => L + i * (W - L - R) / (yms.length - 1);
        const ix = ym => yms.indexOf(ym);
        const vals = [].concat(...o.lines.map(l => l.pts.map(p => p[1]).filter(v => v != null)), (o.refs || []).map(r => r.v));
        const floor = o.floor || 0.3;
        let top = Math.max(...vals, o.minTop || 1);
        let Y, ticks;
        if (o.log) {
          const pw = [0.3, 1, 3, 10, 30, 100, 300];
          top = pw.find(p => p >= top * 1.05) || top * 1.2;
          const lf = Math.log10(floor), lt = Math.log10(top);
          Y = v => T + (H - T - B) * (1 - (Math.log10(Math.max(v, floor)) - lf) / (lt - lf));
          ticks = pw.filter(p => p >= floor && p <= top);
        } else {
          const step = top > 40 ? 20 : top > 20 ? 10 : top > 8 ? 5 : 2;
          top = Math.ceil(top * 1.08 / step) * step;
          Y = v => T + (H - T - B) * (1 - Math.max(0, v) / top);
          ticks = []; for (let v = 0; v <= top + 1e-9; v += step) ticks.push(v);
        }
        const fmtT = v => v < 1 ? String(v) : String(Math.round(v));
        let s = '<svg class="ap2-gt-svg" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(o.aria || "") + '">';
        ticks.forEach(v => { const y = Y(v).toFixed(1);
          s += '<line class="ap2-gt-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
               '<text class="ap2-gt-ax" x="' + (L - 6) + '" y="' + (+y + 4) + '" text-anchor="end">' + fmtT(v) + "</text>"; });
        // quarter starts, plus the last month only when it has room of its own (Jul and Aug collided)
        const xl = yms.map((ym, i) => +ym.slice(5, 7) % 3 === 1 ? i : -1).filter(i => i >= 0);
        if (!xl.length || yms.length - 1 - xl[xl.length - 1] >= 2) xl.push(yms.length - 1);
        xl.forEach(i => { const ym = yms[i];
          s += '<text class="ap2-gt-ax" x="' + X(i).toFixed(1) + '" y="' + (H - B + 16) + '" text-anchor="middle">' + esc(MONTH_NAMES[+ym.slice(5, 7)] + " \u2019" + ym.slice(2, 4)) + "</text>"; });
        s += '<text class="ap2-gt-ax" x="' + L + '" y="' + (T - 7) + '">' + esc(o.yLabel || "") + "</text>";
        (o.band ? [o.band] : []).forEach(b => { const i0 = ix(b.from), i1 = ix(b.to); if (i0 < 0 || i1 < 0) return;
          s += '<rect class="ap2-gt-band" x="' + (X(i0) - 6).toFixed(1) + '" y="' + T + '" width="' + (X(i1) - X(i0) + 12).toFixed(1) + '" height="' + (H - T - B) + '"/>'; });
        // a marker label near the right edge reads leftwards, so it is never cut off
        (o.marks || []).forEach((m, k) => { const i = ix(m.ym); if (i < 0) return; const x = X(i); const left = x > W - R - 170;
          s += '<line class="ap2-gt-mark" x1="' + x.toFixed(1) + '" x2="' + x.toFixed(1) + '" y1="' + T + '" y2="' + (H - B) + '"/>' +
               '<text class="ap2-gt-mtx" x="' + (left ? x - 4 : x + 4).toFixed(1) + '" y="' + (T + 11 + 13 * (k % 2)) + '"' + (left ? ' text-anchor="end"' : "") + ">" + esc(m.label) + "</text>"; });
        // reference labels sit at the LEFT end: the recent months on the right are where the data is
        (o.refs || []).forEach(r => { const y = Y(r.v).toFixed(1);
          s += '<line class="ap2-gt-ref ap2-gt-' + r.k + '" x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/>' +
               '<text class="ap2-gt-rtx ap2-gt-' + r.k + '" x="' + (L + 6) + '" y="' + (+y - 5) + '">' + esc(r.label) + "</text>"; });
        o.lines.forEach(l => {
          const pts = l.pts.filter(p => p[1] != null && ix(p[0]) >= 0).map(p => [X(ix(p[0])), Y(p[1]), p[1]]);
          if (!pts.length) return;
          s += '<polyline class="ap2-gt-ln ap2-gt-' + l.k + '" points="' + pts.map(p => p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ") + '"/>';
          pts.forEach(p => { s += '<circle class="ap2-gt-pt ap2-gt-' + l.k + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="2.6"><title>' + esc(l.label + ": " + r2(p[2])) + "</title></circle>"; });
        });
        s += "</svg>";
        return '<div class="ap2-gt-chart">' + s + '</div><div class="ap2-gt-leg">' +
          o.lines.map(l => '<span><i class="ap2-gt-sw ap2-gt-' + l.k + '"></i>' + esc(l.label) + "</span>").join("") +
          (o.refs || []).map(r => '<span><i class="ap2-gt-sw ap2-gt-dash ap2-gt-' + r.k + '"></i>' + esc(r.legend || r.label) + "</span>").join("") + "</div>";
      }
      // "scheduled" (2026-09-24 review): switch-on set, its first full month not complete yet
      const GT_STATUS = {
        baseline: ["p", "Collecting the baseline"], late: ["n", "Not switched on in time"], scheduled: ["p", "Switch-on set"],
        running: ["p", "Switched on"],
        reading: ["p", "Reading"], pass: ["y", "PASS"], fail: ["n", "FAIL"], inconclusive: ["p", "Inconclusive"],
        extended: ["p", "Inconclusive \u2014 extended"] };
      function mdHtml() {
        const G = model.geo_test || null, c = clkOf("MD"), X = model.expansion || {};
        if (!G || !G.config) {
          return note("The Maryland test is not in the model yet \u2014 run <b>sources=area-plan</b>." +
            (c ? " Maryland runs at <b>" + r1(c.level) + "</b> today (Zip to Zip, seasonally adjusted)." : ""));
        }
        const C = G.config, Z = G.zones || {};
        const mdTarget = num((X.capture || {}).MD) || 15;
        // ---- 1. Maryland's clock, statewide
        let clock = "";
        if (c && c.sa && c.sa.length) {
          const marks = (c.steps || []).filter(s => s.dir > 0).map(s => ({ ym: s.ym, label: (s.name || "a step") + (s.status === "provisional" ? " (provisional)" : "") }));
          clock = '<div class="ap2-gt-h">Maryland\u2019s clock \u2014 Zip to Zip leads per 10,000 movers a year, seasonally adjusted, by month</div>' +
            gtChart({ lines: [{ k: "md", label: "Maryland, each month", pts: c.sa.map(p => [p[0], p[1]]) }],
                      refs: [{ v: mdTarget, k: "tgt", label: "target " + r1(mdTarget) + " (a ceiling)", legend: "the target, a ceiling" },
                             { v: c.level, k: "lvl", label: "today " + r1(c.level), legend: "today\u2019s level (latest 3 months)" }],
                      band: c.level_months && c.level_months.length ? { from: c.level_months[0], to: c.level_months[c.level_months.length - 1] } : null,
                      marks, minTop: mdTarget, yLabel: "per 10,000 movers a year",
                      aria: "Maryland capture by month, with the Elkridge and ChatGPT steps and the target of " + mdTarget }) +
            note("<b>A step counts as real</b> when " + ((CLK.rule || {}).confirm_months || 3) + " complete months in a row each sit above the old level by more than " +
                 Math.round(100 * ((CLK.rule || {}).min_rise || 0.25)) + "% and more than two Poisson standard deviations. " +
                 (c.steps || []).filter(s => s.dir > 0).map(s => "<b>" + esc(ymLabel(s.ym)) + "</b>: " + esc(s.what || "cause not named") +
                   " \u2014 " + r1(s.before) + " \u2192 " + r1(s.after) + (s.status === "provisional" ? " (<b>provisional</b>, " + s.months + " of " + ((CLK.rule || {}).confirm_months || 3) + " months)" : "") + ".").join(" ") +
                 " Today\u2019s all-company 12-month " + r1(capOfSt("MD")) + " includes about <b>" + r1(c.sister_pts) + "</b> of Tuji leads that are going away (his 16 Sep \u201cfocus only on ZIP\u201d).");
        }
        // ---- 2. the test
        const st = GT_STATUS[G.status] || ["p", G.status];
        const rdSay = esc(ymLabel(C.readout[0])) + "\u2013" + esc(ymLabel(C.readout[1]));
        const cy = G.verdict && G.verdict.canary;
        const statusSay = (G.status === "baseline" ? "switch-on not set: the Montgomery address is still to be chosen, and it must be live by " + esc(ymLabel(C.switch_on_by))
          : G.status === "late" ? (C.switch_on
              ? "switch-on set to " + esc(ymLabel(C.switch_on)) + ", after the " + esc(ymLabel(C.switch_on_by)) + " deadline: the " + rdSay + " read-out would sit on months before the listing, so no verdict is read"
              : "no switch-on by " + esc(ymLabel(C.switch_on_by)) + ": the " + rdSay + " read-out cannot be kept")
          : G.status === "scheduled" ? "switch-on set to " + esc(ymLabel(C.switch_on)) + ", its first full live month \u2014 not complete in the data yet; the read-out is " + rdSay
          : G.status === "running" ? "live since " + esc(ymLabel(C.switch_on)) + " \u2014 month " + (G.month_n || 0) + "; the read-out is " + rdSay
          : G.status === "reading" ? "month " + G.month_n + " of 4 of the read-out"
          : G.verdict ? "ratio of ratios \u00d7" + r2(G.verdict.ratio) + ", z " + r2(G.verdict.z) + ", treatment " + r2(G.verdict.cap_t) + " per 10k" +
              (cy && cy.flag ? " \u2014 <b>flag</b>: the Elkridge ring ran \u00d7" + r2(cy.ratio) + " its level at switch-on (seasonally adjusted), so a Google ranking change may be in it"
                : cy && cy.ratio == null && cy.why ? " \u2014 no canary: " + esc(cy.why) : "")
          : "") +
          /* the newest lead in the warehouse, so a month read early is visible (2026-09-24 review) */
          (G.data_through ? "; leads in the data through " + esc(dayLabel(G.data_through)) + ", so the latest whole month is " + esc(ymLabel(G.last_month)) : "");
        const zoneName = { T: "Treatment \u2014 within " + C.treat_mi + " mi of the Montgomery address", EDGE: "Edge \u2014 " + C.treat_mi + "\u2013" + C.edge_mi + " mi (reported, not scored)",
                           C1: "Control \u2014 " + C.control_mi[0] + "\u2013" + C.control_mi[1] + " mi out", POS: "Elkridge ring \u2014 within " + C.pos_mi + " mi of the listing (positive control)" };
        const B = G.baseline || {};
        const zoneRows = ["T", "EDGE", "C1", "POS"].map(k => { const ser = (G.series || {})[k] || [];
          const lo = B.from, hi = B.to; const inB = ser.filter(r => lo && r.ym >= lo && r.ym <= hi);
          const leads = inB.reduce((a, r) => a + r.leads, 0), mv = (Z[k] || {}).movers || 0;
          const cap = mv && inB.length ? leads * 12 / inB.length / mv * 10000 : null;
          return "<tr><td>" + esc(zoneName[k]) + '</td><td class="num">' + fmtN((Z[k] || {}).zips) + '</td><td class="num">' + fmtN(mv) +
            '</td><td class="num">' + fmtN(leads) + '</td><td class="num">' + r2(cap) + "</td></tr>"; }).join("");
        const lineOf = (k, label) => ({ k: k.toLowerCase(), label, pts: ((G.series || {})[k] || []).map(r => [r.ym, r.capture]) });
        const listingMarks = (G.listings || []).filter(l => l.live).map(l => ({ ym: l.live, label: l.label + " live" }))
          .concat([{ ym: "2026-06", label: "gbp_ tags begin" }])   // Arlington's own date is unknown: the caption says so
          .concat(C.switch_on ? [{ ym: C.switch_on, label: "Montgomery live" }] : []);
        const guards = G.guards || [];
        const bad = guards.filter(g => g.level !== "ok");
        const guardSay = bad.length
          ? bad.map(g => '<span class="ap2-chip ' + (g.level === "red" ? "n" : "p") + '">' + esc(ymLabel(g.ym)) + ": " +
              [g.ads_in_zone ? money0(g.ads_in_zone) + " of Google Ads in a test zone" : g.ads ? money0(g.ads) + " of Google Ads in MD/DC/VA (outside the zones?)" : "",
               g.cards ? fmtN(g.cards) + " MD/DC/VA cards mailed (state-level record: confirm the zips)" : "",
               (g.new_listings || []).length ? "new listing " + g.new_listings.join(", ") : ""].filter(Boolean).join("; ") + "</span>").join(" ")
          : '<span class="ap2-chip y">held fixed since ' + esc(ymLabel(B.from || G.last_month)) + "</span> no Search or Performance Max money in MD/DC/VA, no MD/DC/VA cards recorded, no new MD/DC/VA listing in Search Console.";
        const sig = (G.signal || []).filter(s => ["MD", "VA", "DC"].includes(s.state) || s.tag === "page:elkridge" || s.tag === "gbp_kearny_nj");
        const lastYms = [...new Set([].concat(...sig.map(s => Object.keys(s.clicks || {}))))].sort().slice(-3);
        const sigRows = sig.map(s => "<tr><td>" + esc(s.tag) + '</td><td>' + esc(s.first_day ? dayLabel(s.first_day) : "\u2014") + "</td>" +
          lastYms.map(ym => '<td class="num">' + fmtN((s.clicks || {})[ym] || 0) + "</td>").join("") + '<td class="num">' + fmtN(s.total_clicks) + "</td></tr>").join("");
        const byMonth = ((G.series || {}).T || []).map((r, i) => { const c1 = ((G.series || {}).C1 || [])[i] || {}, p = ((G.series || {}).POS || [])[i] || {};
          const br = x => (x.booked || 0) + (x.leads ? " (" + Math.round(100 * x.booked / x.leads) + "%)" : "");
          return "<tr><td>" + esc(ymLabel(r.ym)) + '</td><td class="num">' + r.leads + '</td><td class="num">' + r2(r.capture) + '</td><td class="num">' + br(r) +
            '</td><td class="num">' + c1.leads + '</td><td class="num">' + r2(c1.capture) + '</td><td class="num">' + br(c1) +
            '</td><td class="num">' + p.leads + '</td><td class="num">' + r2(p.capture) + '</td><td class="num">' + br(p) + "</td></tr>"; }).reverse().join("");
        const kc = (G.counter_cases || [])[0];
        const ac = G.anchor_check || {};
        /* THE FORM EXPORT'S AGE, FROM DATA (2026-09-24 review). "Stale since 3 Sep" was typed into two
           sentences; his 24 Sep call puts the export into the Monday drop, after which both would have
           been false with nothing to refresh them. model.geo_test.form_export = the last drop's date
           (MAX `Update Date` of cms_leads) and "stale" past GEO_TEST.form_export_stale_days. */
        const FX = G.form_export || { stale: true };
        const fxSay = FX.last_drop ? "Last dropped " + esc(dayLabel(FX.last_drop)) + " (" + fmtN(FX.age_days) + " day" + (FX.age_days === 1 ? "" : "s") + " ago)"
                                   : "Its last drop is not known to the model";
        const facts = [
          "<b>Who created the Elkridge listing, and at what address.</b> The address is unknown (his answer, 24 Sep 2026), so nothing here calls it a bare listing: if it is a staffed unit or a storage site, a listing alone may not copy.",
          "<b>When the Arlington and Kearny listings went live.</b> Every gbp_ link first appears in Search Console on 21\u201322 Jun 2026, when the tagging began, so neither can be dated from our data.",
          "<b>Does Local Services Ads serve MD, DC or VA, and since when?</b> Its spend has no readable geography. If it switched on around Dec 2025, part of the Elkridge step is paid.",
          "<b>A Montgomery address that qualifies</b> for a Business Profile (no virtual office, mailbox or bare truck lot) and sits <b>at least " + C.anchor_min_listing_mi + " miles</b> from Elkridge and Arlington. The placeholder pick is " +
            Object.keys(ac.miles || {}).map(k => r1(ac.miles[k]) + " mi from " + esc(k[0].toUpperCase() + k.slice(1))).join(" and ") + (ac.ok ? " \u2014 it clears." : " \u2014 <b>it does not clear</b>; north Montgomery (Gaithersburg, Germantown) does."),
          "<b>The website-form export in the Monday drop</b> (his 24 Sep call): CMS Export/data.xls carries the UTM tags. " + fxSay +
            (FX.stale ? ", so lead-level listing attribution is blind until it lands weekly." : " — arriving, so the gbp_ lead tags can be read beside Search Console."),
        ];
        const pool = G.cards_pool || {};
        return '<div class="ap2-gt">' + clock +
          '<div class="ap2-gt-h" style="margin-top:18px">The Montgomery listing test \u2014 pre-registered ' + esc(dayLabel(C.registered_on)) + "</div>" +
          '<div class="ap2-say" style="margin:0 0 8px"><span class="ap2-chip ' + st[0] + '">' + esc(st[1]) + "</span> " + statusSay + ". " + esc(C.question) +
            " A Business Profile at a Montgomery address, and nothing else: Monroe PA stays the first yard, and the Montgomery yard waits for this read-out (his call, 24 Sep 2026).</div>" +
          '<div class="ap2-gt-h">The zones \u2014 Zip to Zip leads over the baseline so far, ' + esc(B.from ? ymLabel(B.from) + "\u2013" + ymLabel(B.to) : "") + "</div>" +
          '<div class="rs-tablewrap"><table data-name="Montgomery test zones" class="rs-table ap2-next"><thead><tr><th>Zone</th><th class="num">Zips</th><th class="num">Movers a year</th>' +
            '<th class="num">Leads</th><th class="num">Per 10k a year</th></tr></thead><tbody>' + zoneRows + "</tbody></table></div>" +
          '<div class="ap2-gt-h" style="margin-top:14px">Capture by zone, each month (log scale)</div>' +
          gtChart({ log: true, floor: 0.3, lines: [lineOf("T", "Treatment (Montgomery ring)"), lineOf("C1", "Control (15\u201335 mi)"), lineOf("POS", "Elkridge ring (positive control)")],
                    refs: [{ v: C.pass_capture, k: "tgt", label: "PASS needs \u2265 " + C.pass_capture, legend: "the PASS floor for the treatment zone" }],
                    marks: listingMarks, yLabel: "per 10,000 movers a year (0 plotted at 0.3)",
                    aria: "Monthly capture in the treatment, control and Elkridge zones on a log scale" }) +
          note("<b>The rule, fixed in advance.</b> Baseline: the " + C.baseline_months + " months before switch-on (live by " + esc(ymLabel(C.switch_on_by)) + "). Read-out: " + esc(ymLabel(C.readout[0])) + "\u2013" + esc(ymLabel(C.readout[1])) +
               ", an interim look at the end of " + esc(ymLabel(C.interim)) + ". <b>PASS</b> = the treatment zone\u2019s rise over its baseline beats the control\u2019s at one-sided 5% <b>and</b> it reads at least " + C.pass_capture +
               " per 10,000: keep Maryland\u2019s 15 and put the Montgomery yard on the 2028 plan. <b>FAIL</b> = the ratio of ratios is under \u00d7" + C.fail_ratio + " <b>and</b> the zone reads under " + C.fail_capture +
               ": re-set Maryland\u2019s target to its measured level and keep the yard parked. Anything between is <b>inconclusive</b> and the read runs through " + esc(ymLabel(C.extend_to)) +
               " \u2014 no reading by eye. Today\u2019s baseline: treatment " + r2((B.T || {}).capture) + ", control " + r2((B.C1 || {}).capture) + " per 10,000.") +
          '<div class="ap2-gt-h">Held fixed in the treatment, control and Elkridge zones</div><div class="ap2-gt-guard">' + guardSay + "</div>" +
          note("No Search or Performance Max money goes into these zones; <b>Local Services Ads is unknown</b> (no readable geography). The 2,500 MD and 4,500 VA cards bought in May 2026 can go to zips <b>outside all three zones</b> \u2014 beyond " +
               C.control_mi[1] + " miles of the address and " + C.listing_clear_control_mi + " of any listing: " + Object.keys(pool).filter(s => (pool[s] || {}).movers).map(s => fmtN(pool[s].zips) + " " + s + " zips (" + fmtN(pool[s].movers) + " movers a year)").join(", ") +
               ", e.g. Richmond or Hampton Roads.") +
          (sigRows ? '<div class="ap2-gt-h" style="margin-top:14px">Is the listing live? Search Console clicks on each Business Profile link' +
              (FX.stale ? " (not lead tags: the form export is " + (FX.last_drop ? "stale, last dropped " + esc(dayLabel(FX.last_drop)) : "of unknown age") + ")"
                        : " (the weekly form export’s lead tags are the second check)") + "</div>" +
            '<div class="rs-tablewrap"><table data-name="Listing signal (Search Console)" class="rs-table ap2-next"><thead><tr><th>Listing</th><th>First seen</th>' +
            lastYms.map(ym => '<th class="num">' + esc(ymLabel(ym)) + "</th>").join("") + '<th class="num">Since Nov 2025</th></tr></thead><tbody>' + sigRows + "</tbody></table></div>" : "") +
          ref("The evidence behind the test", "Elkridge, Arlington, Kearny, the county placebo, the error rates",
            '<div class="panel">' +
            note("<b>Elkridge</b> (live Dec 2025, address unknown): its ring went from about 0 to " + r1((((G.series || {}).POS || []).slice(-3).reduce((a, r) => a + (r.capture || 0), 0)) / 3) +
                 " per 10,000 in the latest three months, and capture falls off with distance (" + (C.elkridge_decay || []).map(d => esc(d[0]) + " " + r1(d[1])).join(", ") + ", Dec 2025\u2013Aug 2026). " +
                 "<b>Arlington</b>: " + esc((C.arlington_read || {}).note || "") + " (zone " + r2((C.arlington_read || {}).zone_before) + " \u2192 " + r2((C.arlington_read || {}).zone_after) +
                 ", control " + r2((C.arlington_read || {}).control_before) + " \u2192 " + r2((C.arlington_read || {}).control_after) + "). " +
                 (kc ? "<b>" + esc(kc.label) + "</b>, the counter-case \u2014 " + esc(kc.note) + ": Zip to Zip leads from " + esc(kc.zips.join(", ")) + " by half-year " +
                   kc.halves.map(h => esc(h[0]) + " " + h[1] + (h[2] ? " (partial)" : "")).join(", ") + ". " : "") +
                 "So far at most one of three listings away from a base (Elkridge, Arlington, Kearny) shows the effect. <b>The county test the 22 Sep memo sketched fails its own placebo</b>: " + esc((C.placebo || {}).note || "") + ".") +
            '<div class="rs-tablewrap"><table data-name="Error rates of the rule" class="rs-table ap2-next"><thead><tr><th>True lift</th><th class="num">Reads PASS</th><th>Note</th></tr></thead><tbody>' +
              (C.mde || []).map(m => "<tr><td>" + esc(m.lift) + '</td><td class="num">' + esc(m.pass) + "</td><td>" + esc(m.note || "") + "</td></tr>").join("") + "</tbody></table></div>" +
            note("40,000 simulated runs per cell: negative-binomial months, zone drift SD 0.3\u20130.5, " + C.baseline_months + " baseline and 4 read months, from the measured zone rates. The test tells a big effect from none; it cannot size a small one.") +
            '<div class="rs-tablewrap" style="margin-top:10px"><table data-name="Montgomery test by month" class="rs-table ap2-next"><thead><tr><th>Month</th><th class="num">Treatment</th><th class="num">per 10k</th><th class="num">booked</th>' +
              '<th class="num">Control</th><th class="num">per 10k</th><th class="num">booked</th><th class="num">Elkridge</th><th class="num">per 10k</th><th class="num">booked</th></tr></thead><tbody>' + byMonth + "</tbody></table></div></div>") +
          '<div class="ap2-gt-h" style="margin-top:14px">Facts to collect before switch-on</div><ol class="ap2-gt-facts">' + facts.map(f => "<li>" + f + "</li>").join("") + "</ol>" +
          "</div>";
      }

      function whatIfHtml() {
        if (!FC.year) return '<div class="ap2-note">The what-if needs the season forecast \u2014 run <b>sources=area-plan</b>.</div>';
        const S = scenarioCalc(), c = inputs.scn;
        const d = (a, b) => b - a;
        const money = v => v < 0 ? "−" + money0(-v) : money0(v);   // money0 would print "$-3,484"
        /* money0() renders a negative as "$-180,238"; a delta column has to read "-$180,238" */
        const sgn = v => Math.abs(v) < 1 ? '<span class="ap2-dim">—</span>'
          : (v > 0 ? '<span class="ap2-ok">+' + money0(v) : '<span class="ap2-hire">−' + money0(-v)) + "</span>";
        const num2 = (l, a, b, inv) => { const dd = d(a, b);
          return "<tr><td>" + l + '</td><td class="num">' + money(a) + '</td><td class="num">' + money(b) + '</td><td class="num">' +
            (Math.abs(dd) < 1 ? '<span class="ap2-dim">\u2014</span>' : (inv ? sgn(-dd) : sgn(dd))) + "</td></tr>"; };
        const fld = (k, l, sub, attrs) =>
          '<label class="ap2-fld"><span>' + l + "</span>" +
          '<input class="rs-num ap2-in" data-scn="' + k + '" type="number" ' + (attrs || "") + ' value="' + esc(String(c[k])) + '">' +
          (sub ? "<small>" + sub + "</small>" : "") + "</label>";
        /* THE CLOCK UNDER EACH TYPED STATE (2026-09-24): today's Zip to Zip level -- the lever's "now"
           since the 2026-09-24 review -- beside the 12-month dial, and the jobs as SEASON jobs with the
           year they come from.
           NO HIDDEN FLAGS (2026-09-24 review). "Open it in the What-if" loaded listing:["MD"] and kept it
           through every later edit, invisibly: a user who dropped the picks and typed MD 10 "via ads"
           was priced at $0 a lead. Every typed state now shows its path as a control (ads at the state's
           cost per lead / a listing at none), and clearing a state's target clears its path. */
        const capIn = S.capRows.filter(r => r.movers > 0).sort((a, b) => b.movers - a.movers).map(r => { const lv = r.level;
          const typed = c.capture[r.st] != null, cplAds = S.N.mkt.cplOf(r.st);
          // the label keeps its input alone (a button inside a <label> is a second labelable control)
          return '<div class="ap2-capcell"><label class="ap2-fld"><span>' + esc(r.st) + " \u2014 leads per 10k movers</span>" +
          '<input class="rs-num ap2-in" data-cap="' + esc(r.st) + '" type="number" step="1" min="0" placeholder="' + r1(r.now) + '" value="' +
            (typed ? esc(String(c.capture[r.st])) : "") + '">' +
          "<small>" + (lv != null ? "now <b>" + r1(lv) + "</b> (Zip to Zip, latest 3 months) \u00b7 " + r1(r.dial) + " over " + CAP_WIN_SHORT
                                   : "now <b>" + r1(r.now) + "</b> (" + CAP_WIN_SHORT + ")") +
            " \u00b7 " + fmtN(r.movers) + " move a year" +
            (r.addJobs ? " \u00b7 <b>+" + r1(r.addJobs) + " season jobs</b> (+" + fmtN(r.addLeads) + " of +" + fmtN(r.addLeadsYear) + " leads a year, " + r1(r.lpj) + " a job)" +
              (S.counted ? " \u00b7 above today\u2019s level: what reaching it is worth, not a date" : " \u00b7 a ceiling: not in the Season total") : "") + "</small></label>" +
          (typed ? '<div class="rs-seg ap2-seg-s" role="group" aria-label="How ' + esc(r.st) + ' reaches it">' +
              '<button type="button" data-listing="' + esc(r.st) + '" data-on="0" aria-pressed="' + (!r.viaListing) + '"' + (!r.viaListing ? ' class="on"' : "") + ">Ads" +
                (cplAds != null ? " $" + r1(cplAds) + " a lead" : "") + "</button>" +
              '<button type="button" data-listing="' + esc(r.st) + '" data-on="1" aria-pressed="' + (!!r.viaListing) + '"' + (r.viaListing ? ' class="on"' : "") + ">A listing: no ad cost</button></div>" : "") +
          "</div>"; }).join("");
        /* CEILINGS OR COUNTED (2026-09-24 review): a visible choice whenever a target is typed. The
           expansion card opens here as ceilings, so its Season total matches the card; "Count it"
           is the user saying so himself. */
        const anyTyped = Object.keys(c.capture || {}).some(st => c.capture[st] != null);
        const capMode = anyTyped ? '<div class="ap2-capmode"><div class="rs-seg ap2-seg-s" role="group" aria-label="Season ' + esc(String(FC.year)) + ' and the typed targets">' +
            '<button type="button" data-capmode="count" aria-pressed="' + (!c.ceiling) + '"' + (!c.ceiling ? ' class="on"' : "") + ">Count them in Season " + esc(String(FC.year)) + "</button>" +
            '<button type="button" data-capmode="ceiling" aria-pressed="' + (!!c.ceiling) + '"' + (c.ceiling ? ' class="on"' : "") + ">Ceilings: not counted</button></div></div>" : "";
        // what the typed targets are worth IF reached, when they are ceilings (outside every total below)
        const SC = !S.counted && S.capRows.some(r => r.addJobs) ? scenarioCalc(null, { capture: true }) : null;
        const ceilSay = SC ? '<div class="ap2-say" style="margin:10px 0 0"><b>The typed targets are ceilings</b> \u2014 kept out of Season ' + esc(String(FC.year)) +
            " below, as on the expansion card. If they were reached: <b>" + (SC.scn.jobs - S.scn.jobs >= 0 ? "+" : "") + r1(SC.scn.jobs - S.scn.jobs) + "</b> season jobs and <b>" +
            ((SC.scn.net - S.scn.net) < 0 ? "\u2212" + money0(S.scn.net - SC.scn.net) : "+" + money0(SC.scn.net - S.scn.net)) + "</b> net, from today\u2019s level (" +
            S.capRows.filter(r => r.addJobs).map(r => esc(r.st) + " " + r1(r.now) + " \u2192 " + r1(r.want)).join(", ") + "). Nothing measured says when.</div>" : "";
        /* SAVED SCENARIOS ARE PRICED WHEN SHOWN (2026-09-24): a net frozen at save time carried the old
           year-as-season units forever. The saved levers are re-run through today's engine. */
        const savedNet = x => { try { const s0 = x.scn || {};
            const S2 = scenarioCalc(Object.assign({}, SCN0, s0, { capture: Object.assign({}, s0.capture || {}),
              picks: Array.isArray(s0.picks) ? s0.picks : [], listing: Array.isArray(s0.listing) ? s0.listing : [] }));
            return S2.scn.net - S2.base.net; } catch (e) { return x.net; } };
        const saved = (inputs.scnSaved || []).map((x, i) => { const nt = savedNet(x);
          return '<button type="button" class="ap2-mbtn" data-load="' + i + '">' + esc(x.name) +
          '<small>' + (nt != null ? sgn(nt) + " net today" : "") + "</small></button>"; }).join("");

        return '<div class="ap2-say" style="margin:0 0 12px"><b>What this tool will and will not tell you.</b> ' +
            'Three of the four levers you asked for were measured first, and the measurements are built into them. ' +
            '<b>Crews do not buy jobs</b> \u2014 foremen hit 90% of the season\u2019s maximum on 3 days of 123 last year, and leads wanting those dates ' +
            'booked no worse than any other. <b>Marketing does not buy jobs measurably</b> \u2014 +22% of spend once bought +10 jobs, so that dial ' +
            'starts at nil response and you can type what you believe instead. <b>A new base does not raise booking on the day it opens</b>, ' +
            'though inside 15 miles of a staffed one we book 31.6% against 17.0% further out, so the ring has a slider for how much of it has arrived. ' +
            'The lever that does move this plan is <b>capture</b>' + (capSay() ? ": " + capSay() : "") + '.' +
            /* the dials below start from that capture, which leaves out the no-address leads (2026-09-24) */
            (noAddrShort() ? " " + noAddrShort() + "." : "") + '</div>' +
          '<div class="ap2-scn">' +
            '<div class="ap2-scnbox"><h4>Reach more of the movers</h4>' + capMode + '<div class="ap2-capgrid">' + capIn + "</div>" +
              note("Type the leads per 10,000 movers you think a state could reach. <b>This is the lever the data says is large</b> — and the one a base cannot move on its own. " +
                   "It is measured from <b>today’s level</b> (Zip to Zip, the latest three complete months, seasonally adjusted), the same basis as the expansion card. " +
                   "A point is a year of leads per 10,000 movers; the Season " + esc(String(FC.year)) + " column takes the season’s share of it: " + shareSay() + ".") + "</div>" +
            '<div class="ap2-scnbox"><h4>Bases somewhere new</h4>' +
              /* THE MAP'S OWN PICKS, one click each. A zip outside today's territory is not in the
                 model's compact maps, so typing Rockville got "not in the territory data" -- and the
                 picks are all outside it, by construction. They carry their own coordinates. */
              '<div class="ap2-picks">' + (S.picks || []).map(x =>
                '<button type="button" class="ap2-mbtn' + ((c.picks || []).indexOf(x.label) >= 0 ? " on" : "") + '" data-pick="' + esc(x.label) + '">' +
                esc(x.label) + "<small>" + fmtN(x.newMovers) + " movers in range</small></button>").join("") +
              ((c.picks || []).length || c.zip ? '<button type="button" class="ap2-mbtn" data-pick="">clear</button>' : "") + "</div>" +
              ((c.picks || []).length > 1 ? note("The " + (c.picks || []).length + " yards are priced <b>together</b>, so a job both of them would take over is not counted twice.") : "") +
              '<label class="ap2-fld"><span>\u2026 or any zip we already work</span><input class="ap2-in" data-scn="zip" maxlength="5" placeholder="e.g. 08102" value="' + esc(c.zip) + '"' + ((c.picks || []).length ? " disabled" : "") + ">" +
              "<small>" + (S.dep ? r2(S.dep.saved_mi_per_job) + " mi/job saved \u00b7 " + fmtN(S.dep.jobs_35) + " jobs within 35 mi \u00b7 " + fmtN(S.dep.ws_never_35) + " zips in reach have never sent a lead"
                                 : c.zip ? "not in the territory data \u2014 the zip maps only cover ground within 35 miles of a base we have, so use a pick above for new ground"
                                         : "any zip with jobs or white space near it") + "</small></label>" +
              fld("maturity", "How much of the home ring has arrived, %", "0 on day one. At 100% it is the full +" + SCN.RING_PTS + " booking points inside " + SCN.RING_MI + " miles", 'min="0" max="100" step="5"') +
              fld("park", "Parking, $ a month", "we pay $440\u2013$1,200 today", 'min="0" step="50"') + "</div>" +
            '<div class="ap2-scnbox"><h4>Money and crews</h4>' +
              fld("budgetPct", "Marketing, % more or less", "on " + money0(S.base.mkt), 'step="5"') +
              fld("elast", "Jobs response to it", "measured \u22120.06, i.e. nil. 1.0 would mean 10% more money = 10% more jobs", 'step="0.1"') +
              fld("surgeDays", "Peak days to surge", "about 15 month-end dates are where work was turned away", 'min="0" step="1"') +
              fld("surgeCrews", "Extra crews on those days", "capped at " + SCN.SURGE_CAP + " jobs a season", 'min="0" step="1"') +
              fld("crews", "Crews for the whole season", money0(SCN.TRUCK_SEASON) + " of truck each, no jobs attached", 'step="1"') + "</div>" +
          "</div>" +
          '<div class="ap2-scnbar"><button type="button" class="rs-btn" id="apScnReset">Reset every lever</button>' +
            '<input class="ap2-in" id="apScnName" placeholder="name this scenario" style="width:170px">' +
            '<button type="button" class="rs-btn pri" id="apScnSave">Save</button>' +
            (saved ? '<span class="ap2-note" style="margin:0 0 0 6px">saved:</span>' + saved : "") + "</div>" +
          '<table data-name="What if" class="rs-table ap2-next" style="margin-top:14px"><thead><tr><th>Season ' + esc(String(FC.year)) +
            '</th><th class="num">The plan</th><th class="num">This scenario</th><th class="num">Difference</th></tr></thead><tbody>' +
            "<tr><td><b>Jobs</b></td><td class=\"num\">" + fmtN(S.base.jobs) + '</td><td class="num">' + fmtN(S.scn.jobs) + '</td><td class="num">' +
              (Math.abs(S.scn.jobs - S.base.jobs) < 0.5 ? '<span class="ap2-dim">\u2014</span>' : '<b>' + (S.scn.jobs > S.base.jobs ? "+" : "") + fmtN(S.scn.jobs - S.base.jobs) + "</b>") + "</td></tr>" +
            num2("Revenue", S.base.revenue, S.scn.revenue) +
            num2("Job expense", S.base.expense, S.scn.expense, 1) +
            num2("Truck", S.base.rent, S.scn.rent, 1) +
            num2("Marketing", S.base.mkt, S.scn.mkt, 1) +
            (Math.abs(S.scn.extra) > 1 ? num2("Parking for the new base, net of the driving it saves", 0, S.scn.extra, 1) : "") +
            '<tr class="ap2-tot"><td><b>Net before overhead</b></td><td class="num">' + money0(S.base.net) + '</td><td class="num">' + money0(S.scn.net) +
              '</td><td class="num">' + sgn(S.scn.net - S.base.net) + "</td></tr>" +
          "</tbody></table>" + ceilSay +
          (S.moves.length
            ? '<table data-name="What moved it" class="rs-table ap2-next" style="margin-top:12px"><thead><tr><th>What you changed</th><th>What the data says about it</th><th class="num">Jobs</th><th class="num">Net</th></tr></thead><tbody>' +
              S.moves.map(m => "<tr><td><b>" + m.l + "</b></td><td>" + m.why + '</td><td class="num">' +
                (Math.abs(m.jobs) < 0.05 ? '<span class="ap2-dim">none</span>' : (m.jobs > 0 ? "+" : "") + r1(m.jobs)) +
                '</td><td class="num">' + sgn(m.usd) + "</td></tr>").join("") + "</tbody></table>"
            : note("Nothing is changed yet \u2014 every lever is at the plan as it stands. Move one and this table says what the measurement behind it was.")) +
          note("Revenue and job expense follow the jobs at the plan\u2019s own average, so a scenario cannot quietly change what a job is worth. " +
               "Driving is priced at <b>" + SCN.ROAD_MI_USD + " a road mile</b> (fuel at 7 mpg on the WEX price, tolls, +10%) over <b>" + SCN.ROAD_PER_STRAIGHT +
               "</b> road miles per straight-line mile, which is how crews are actually dispatched today; crew pay does not move with distance until the travel passes about 120 road miles. " +
               "A crew costs " + money0(SCN.TRUCK_SEASON) + " of truck for the season. Nothing here is saved to the warehouse.");
      }

      function repaintScn() {
        const el = host.querySelector("#apWhatIf"); if (!el) return;
        const a = document.activeElement, k = a && (a.dataset.scn || a.dataset.cap), pos = a && a.selectionStart;
        el.innerHTML = whatIfHtml(); wireWhatIf(); enhanceTables();
        if (k) { const n = el.querySelector('[data-scn="' + k + '"],[data-cap="' + k + '"]');
          if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }
      }
      function wireXp() {
        const b = host.querySelector("[data-openxp]"); if (!b) return;
        b.onclick = () => { const sc = expansionScn(); if (!sc) return;
          inputs.scn = sc; save(); repaintScn(); showPane("whatif"); };
      }
      function wireWhatIf() {
        const el = host.querySelector("#apWhatIf"); if (!el) return;
        el.querySelectorAll("[data-pick]").forEach(b => { b.onclick = () => {
          const l = b.dataset.pick;
          if (!l) { inputs.scn.picks = []; }
          else { const cur = inputs.scn.picks || [];
            inputs.scn.picks = cur.indexOf(l) >= 0 ? cur.filter(x => x !== l) : cur.concat([l]);
            inputs.scn.zip = ""; }
          save(); repaintScn(); }; });
        el.querySelectorAll("[data-scn]").forEach(i => { i.onchange = () => {
          const k = i.dataset.scn;
          inputs.scn[k] = k === "zip" ? (i.value || "").replace(/\D/g, "").slice(0, 5) : (i.value === "" ? 0 : +i.value);
          save(); repaintScn(); }; });
        el.querySelectorAll("[data-cap]").forEach(i => { i.onchange = () => {
          const st = i.dataset.cap;
          if (i.value === "") {
            delete inputs.scn.capture[st];
            // a path cannot outlive its target (2026-09-24 review)
            inputs.scn.listing = (inputs.scn.listing || []).filter(x => x !== st);
          } else inputs.scn.capture[st] = +i.value;
          save(); repaintScn(); }; });
        el.querySelectorAll("[data-listing]").forEach(b => { b.onclick = () => {
          const st = b.dataset.listing, on = b.dataset.on === "1";
          const cur = (inputs.scn.listing || []).filter(x => x !== st);
          inputs.scn.listing = on ? cur.concat([st]) : cur;
          save(); repaintScn(); }; });
        el.querySelectorAll("[data-capmode]").forEach(b => { b.onclick = () => {
          inputs.scn.ceiling = b.dataset.capmode === "ceiling";
          save(); repaintScn(); }; });
        const rst = el.querySelector("#apScnReset");
        if (rst) rst.onclick = () => { inputs.scn = Object.assign({}, SCN0, { capture: {}, picks: [], listing: [], ceiling: false }); save(); repaintScn(); };
        const sv = el.querySelector("#apScnSave");
        if (sv) sv.onclick = () => { const nm = (el.querySelector("#apScnName") || {}).value;
          if (!nm || !nm.trim()) return;
          const S = scenarioCalc();
          inputs.scnSaved = (inputs.scnSaved || []).filter(x => x.name !== nm.trim()).concat(
            [{ name: nm.trim(), scn: JSON.parse(JSON.stringify(inputs.scn)), net: S.scn.net - S.base.net }]).slice(-6);
          save(); repaintScn(); };
        el.querySelectorAll("[data-load]").forEach(b => { b.onclick = () => {
          const x = (inputs.scnSaved || [])[+b.dataset.load]; if (!x) return;
          inputs.scn = Object.assign({}, SCN0, x.scn); inputs.scn.capture = Object.assign({}, x.scn.capture || {});
          inputs.scn.picks = Array.isArray(x.scn.picks) ? x.scn.picks.slice() : [];
          inputs.scn.listing = Array.isArray(x.scn.listing) ? x.scn.listing.slice() : [];
          save(); repaintScn(); }; });
      }

      /* ===================== THE MAP TAB, FOR THE ROOM (2026-09-29, second pass) =====================
         The only tab he presents. His second-pass brief: "i need this thing to be easier ... i need to
         view the whole market and 1 by 1 states too", "once i select that montgomery ... YES or NO
         - without this extra confirmations, i should see the results", "the tooltips ... contains a
         lot of information and some of them is not visible when i hover over it. i would love if on
         user click - on the right panel i can see all the information. and reduce the data on the
         hover and leave only important ones". So, top to bottom:
           1. MARKET -- Whole market or one state; it drives every number, card, list and the frame
           2. the plan in four numbers for that market, with what the YES bases add
           3. NEW BASES -- NO / YES, the expectation always printed (a NO card says what YES would do)
           4. what to do, per crew pool (only the market's own pool when a state is picked)
           5. the map (level + colour) beside ONE panel: the ranked list, or the full sheet of
              whatever was clicked -- county, city, zip or base
           6. everything that explains, in one closed section.
         Every number is nextCalc()'s, the engine the other tabs print. */
      const LEVELS = [["County", "County"], ["City", "City"], ["Zip", "Zip code"]];
      /* THE MARKET APPLIES AT EVERY LEVEL (his call 2026-09-30: "Zip code still does not have whole
         market"). City and Zip used to force one state because the eight states' zip shapes are 9 MB;
         the whole market now loads all eight and draws them on a canvas instead. */
      const mapStOf = () => inputs.mapSt || "";
      const sgN = v => (v > 0.5 ? "+" : v < -0.5 ? "−" : "±") + fmtN(Math.abs(v));
      const sgM = v => (v > 0.5 ? "+" : v < -0.5 ? "−" : "±") + money0(Math.abs(v));
      const nbAny = () => NB_CANDS.some(c => NB_ON[c.label]);

      /* the four numbers for the market; the delta line appears only while a base is YES */
      function planStripHtml(N, N0) {
        if (!N) return "";
        const st = inputs.mapSt || "";
        const pick = M => {
          if (!st) return { jobs: M.tot.jobs, fm: M.tot.peak, have: M.tot.have, hire: M.tot.hire,
                            sales: M.sales.peak, mkt: M.tot.mkt, leads: M.tot.leads,
                            rev: M.tot.revenue, avg: M.tot.revenue != null && M.tot.jobs ? M.tot.revenue / M.tot.jobs : null };
          const r = M.rows.find(x => x.st === st);
          if (!r) return null;
          const q = M.pools.find(p => p.states.includes(st)) || {};
          const nbHere = (M.nb || []).filter(o => o.st === st).reduce((a, o) => a + o.fm, 0);
          return { jobs: r.jobs, fm: (r.fmPeak || 0) + nbHere, have: r.have || 0, hire: (q.hire || 0) + nbHere, pool: q.label,
                   sales: M.tot.leads ? M.sales.peak * r.leads / M.tot.leads : 0,
                   mkt: r.leads * (M.mkt.cplOf(st) || 0), leads: r.leads,
                   rev: r.revenue, avg: r.revenue != null && r.jobs ? r.revenue / r.jobs : null };
        };
        /* WHERE WE STAND (his ask 2026-09-30: "add current situation as well - like what was 2026
           season like"). The season just run, from the same model the plan is built on: the jobs
           closed, the foremen who ran them, the desk that carried a full load, and the advertising
           that left the bank in the months its leads arrived. One state's spend is its share by the
           plan's own cost per lead (no ad dollar carries a state); its desk is its share of leads. */
        const lastOf = M => {
          const act = M.sales.active;
          /* last season's income = its jobs at the average bill the model measured on them */
          const revL = rs => rs.reduce((a, r) => a + (r.s && r.s.avg_bill != null ? (r.jobsLast || 0) * r.s.avg_bill : 0), 0);
          if (!st) { const rv = revL(M.rows);
            return { jobs: M.mkt.jobsLast, fm: M.tot.ranLast, sales: act, mkt: M.mkt.spendLast, leads: M.mkt.leadsLast,
                     rev: rv || null, avg: rv && M.mkt.jobsLast ? rv / M.mkt.jobsLast : null }; }
          const r = M.rows.find(x => x.st === st);
          if (!r) return null;
          return { jobs: r.jobsLast, fm: num((SEED[st] || {})._all),
                   sales: act != null && M.mkt.leadsLast ? act * r.leadsLast / M.mkt.leadsLast : null,
                   mkt: r.leadsLast * (M.mkt.cplOf(st) || 0), leads: r.leadsLast,
                   rev: revL([r]) || null, avg: r.s && r.s.avg_bill != null ? r.s.avg_bill : null };
        };
        const L = lastOf(N0 || N) || {}, LY = FC.year ? String(FC.year - 1) : "last season";
        const was = (k, f) => { const v = L[k];
          if (v == null || !(v > 0)) return "";
          const now = pick(N)[k], pc = 100 * (now - v) / v;
          return '<div class="was">Season ' + esc(LY) + " <b>" + f(v) + "</b>" +
            (isFinite(pc) && Math.abs(pc) >= 0.5 ? '<i class="' + (pc < 0 ? "dn" : "up") + '">' + (pc > 0 ? "+" : "−") + Math.abs(pc).toFixed(0) + "%</i>" : "") + "</div>"; };
        const A = pick(N), B = N0 ? pick(N0) : null;
        if (!A) return '<div class="ap3-kpis"><div class="ap2-note">No ' + esc(st) + " row in the " + esc(String(FC.year)) + " plan.</div></div>";
        const dl = (k, f) => B && (nbAny() || scAny()) && Math.abs(A[k] - B[k]) >= (k === "sales" && st ? 0.05 : 0.5)
          ? '<em class="d' + (A[k] < B[k] ? " dn" : "") + '">' + f(A[k] - B[k]) + " vs the plan</em>" : "";
        const tile = (v, k, sub, d, w) => '<div class="ap3-kpi"><b>' + v + "</b><span>" + k + "</span><small>" + sub + "</small>" + (d || "") + (w || "") + "</div>";
        return '<div class="ap3-kpis">' +
          tile(fmtN(A.jobs), "Jobs " + esc(String(FC.year)), st ? esc(st) + " forecast" : "whole market forecast", dl("jobs", sgN), was("jobs", fmtN)) +
          tile(fmtN(A.fm), "Foremen at peak", fmtN(A.have) + " today" + (A.hire ? " · <em>hire +" + fmtN(A.hire) + "</em>" + (st ? " in " + esc(A.pool || "") : "") : " · covered"), dl("fm", sgN), was("fm", v => fmtN(v) + " ran jobs")) +
          tile(st ? r1(A.sales) : fmtN(A.sales), "Salespeople at peak", st ? "its share of the one sales desk" : esc(String(N.sales.peakWhen || "").split(" ")[0]) + " · " + fmtN(N.sales.lpr) + " leads each", dl("sales", v => (v > 0 ? "+" : "−") + (st ? r1(Math.abs(v)) : fmtN(Math.abs(v)))), was("sales", v => (st ? r1(v) : fmtN(v)) + " on the desk")) +
          tile(money0(A.mkt), "Marketing", fmtN(A.leads) + " leads · post cards inside", dl("mkt", sgM), was("mkt", v => money0(v) + (L.leads ? " · " + fmtN(L.leads) + " leads" : ""))) +
          (A.rev != null ? tile(money0(A.avg), "Average job", "what one job bills", "", was("avg", money0)) +
            tile(money0(A.rev), "Total income", "jobs × the average job", dl("rev", sgM), was("rev", money0)) : "") +
          "</div>";
      }

      /* ---- what if: one driver, the rest follows ---- */
      function scHtml(N, N0) {
        if (!N) return "";
        const P = N0 || N;                       // the plan the steppers are read against
        /* the trucks line of a base card: needed at peak, owned (his to change), and the rest rented */
        const trk = (key, o) => !N.perBase || !o ? "" :
          '<div class="trk"><i>Trucks <b>' + fmtN(o.trucks) + "</b></i><i>owned" +
          (key == null ? " <b>" + fmtN(o.owned) + "</b>" :
            '<button type="button" aria-label="one owned truck less" data-tro="' + esc(key) + '" data-d="-1">−</button><b>' + fmtN(o.owned) +
            '</b><button type="button" aria-label="one owned truck more" data-tro="' + esc(key) + '" data-d="1">+</button>') +
          '</i><i class="' + (o.rent ? "rent" : "") + '">rent <b>' + fmtN(o.rent) + "</b></i></div>";
        const step = (kind, pool, label, shown, plan, cls, extra) => {
          const drv = SC.kind === kind && (kind !== "fm" || SC.pool === pool);
          return '<div class="ap3-step' + (drv ? " drv" : "") + (cls ? " " + cls : "") + '"><span>' + label + (drv ? "<em>you set this</em>" : "") + "</span>" +
            '<div class="ctl"><button type="button" aria-label="less" data-sc="' + kind + '" data-pool="' + esc(pool || "") + '" data-d="-1">−</button>' +
            "<b>" + shown + '</b><button type="button" aria-label="more" data-sc="' + kind + '" data-pool="' + esc(pool || "") + '" data-d="1">+</button></div>' +
            "<small>" + plan + "</small>" + (extra || "") + "</div>"; };
        /* ONE RESET, NO BANNERS (his call 2026-09-30: both "Scenario on ..." strips were "extra" --
           the four numbers already say "vs the plan", and a base flips back on its own card). It shows
           only while something is changed, and puts the levers AND the bases back. */
        return '<div class="ap3-sc"><div class="ap3-nbh"><b>What if</b><span>change one number and the rest follows — a test scenario, a refresh puts it back</span>' +
            '<div class="ap3-seg ap3-planseg" role="group" aria-label="Plan">' +
              '<button type="button" data-plan="" class="' + (PLAN ? "" : "on") + '">Forecast</button>' +
              Object.keys(PLANS).map(k => '<button type="button" data-plan="' + k + '" class="' + (PLAN && PLAN.key === k ? "on" : "") + '">' + esc(PLANS[k].label) + " plan</button>").join("") + "</div>" +
            (scAny() || nbAny() || trAny() ? '<button type="button" class="rs-btn ap3-reset" data-screset>Reset</button>' : "") + "</div>" +
          '<div class="ap3-steps">' +
            step("sales", null, "Salespeople", fmtN(N.sales.peak), "plan " + fmtN(P.sales.peak)) +
            step("mkt", null, "Marketing budget", money0(N.tot.mkt), "plan " + money0(P.tot.mkt)) +
            step("fmAll", null, "Foremen · all bases", fmtN(N.tot.peak), "plan " + fmtN(P.tot.peak) + " · " + fmtN(N.tot.have) + " today", "tot",
              trk(null, { trucks: N.tot.trucks, owned: N.owned, rent: N.rentTrucks })) +
          "</div>" +
          /* one card per base: its foremen at peak, the states it covers, and who is there today */
          (PLAN ? namedPlanHtml(N) : "") +
          '<div class="ap3-steps bases"' + (PLAN ? ' style="display:none"' : "") + '>' +
            baseList(N).map(b => { const b0 = baseList(P).find(x => x.key === b.key) || b;
              return step("fm", b.key, esc(b.key) + " base", fmtN(b.fm),
                "covers " + esc(b.states.join(" + ")) + " · plan " + fmtN(b0.fm) + " · " + fmtN(b.have) + " today", "",
                trk(b.key, N.pools.find(q => q.pk === b.key))); }).join("") +
            /* a base switched to Yes is a base: its own card, its own crew, his to change */
            (N.nb || []).map(o => step("nbfm", o.label, esc(o.label) + " · new base", fmtN(o.fm),
              (o.states.length ? "covers " + esc(o.states.join(" + ")) + " · " : "") + "suggested " + fmtN(o.fmSuggested) + " for " + sgN(o.jobs) + " jobs · 0 today", "nb", trk(o.label, o))).join("") +
          "</div></div>";
      }

      /* the named plan, base by base: his table, with each crew his to change */
      function namedPlanHtml(N) {
        const ownBy = N.perBase ? ((model.fleet || {}).active_by_state || {}) : null;
        const all = PLAN.groups.reduce((a, g) => a + g.sites.reduce((b, x) => b + x.fm, 0), 0);
        const short = N.tot.peak < all;
        return '<div class="ap3-plan">' + PLAN.groups.map((g, gi) => {
          const crew = g.sites.reduce((a, x) => a + x.fm, 0);
          const own = ownBy ? g.states.reduce((a, st) => a + num(ownBy[st]), 0) : null;
          return '<div class="ap3-step plan"><span>' + esc(g.base) + " base<em>" + fmtN(crew) + (crew === 1 ? " foreman" : " foremen") + "</em></span>" +
            g.sites.map((x, si) => { const o = x.cand ? (N.nb || []).find(q => q.label === x.cand) : null;
              return '<div class="site"><i>' + esc(x.name) + (x.cand || x.la ? "<u>new</u>" : "") +
                (o && o.cap < 1 ? "<small>its ground wants " + fmtN(Math.round(o.fm / o.cap)) + "</small>" : "") + "</i>" +
                '<button type="button" aria-label="one less" data-plansite="' + gi + ":" + si + '" data-d="-1">−</button><b>' + fmtN(x.fm) +
                '</b><button type="button" aria-label="one more" data-plansite="' + gi + ":" + si + '" data-d="1">+</button></div>'; }).join("") +
            "<small>covers " + esc(g.states.join(" + ")) + "</small>" +
            (own != null ? '<div class="trk"><i>Trucks <b>' + fmtN(crew) + "</b></i><i>owned <b>" + fmtN(own) + '</b></i><i class="' + (crew > own ? "rent" : "") + '">rent <b>' + fmtN(Math.max(0, crew - own)) + "</b></i></div>" : "") +
            "</div>"; }).join("") + "</div>" +
          (short ? '<div class="ap2-note" style="margin:0 0 10px">The table holds ' + fmtN(all) + " foremen; the plan above works " + fmtN(N.tot.peak) +
            " of them — a pool's crews move in steps, and the rest have no work in this forecast.</div>" : "");
      }

      /* ---- new bases ---- */
      function nbDelta(withN, withoutN) {
        const g = M => (M.tot.gross != null ? M.tot.gross : 0) - (M.tot.mkt || 0) - (M.tot.parking || 0);
        return { jobs: withN.tot.jobs - withoutN.tot.jobs, mkt: withN.tot.mkt - withoutN.tot.mkt,
                 hire: withN.tot.hire - withoutN.tot.hire, sales: withN.sales.peak - withoutN.sales.peak,
                 net: g(withN) - g(withoutN), leads: withN.tot.leads - withoutN.tot.leads,
                 rev: (withN.tot.revenue || 0) - (withoutN.tot.revenue || 0) };
      }
      function nbHtml(N) {
        if (!NB_CANDS.length || !N) return "";
        const cards = NB_CANDS.map(c => nbCard(c, N, false)).join("");
        return '<div class="ap3-nbwrap"><div class="ap3-nbh"><b>New bases</b><span>' +
          (PICK ? "<em>now click the map where the base would stand</em>" : "a test scenario — flip one to Yes and every number on this tab follows; a refresh puts them back to No") + "</span>" +
          '<button type="button" class="rs-btn ap3-pick' + (PICK ? " on" : "") + '" data-nbpick>' + (PICK ? "Cancel" : "Try any point on the map") + "</button></div>" +
          '<div class="ap3-nbs">' + cards + "</div></div>";
      }
      function nbCard(c, N, full) {
          const TC = tierColors();
          const on = !!NB_ON[c.label];
          const withN = on ? N : nextCalc({ nb: { with: c.label } });
          const withoutN = on ? nextCalc({ nb: { without: c.label } }) : N;
          const d = nbDelta(withN, withoutN);
          const o = (withN.nb || []).find(x => x.label === c.label) || {};
          const tiers = [1, 2, 3, 4].map(t => [t, (o.opened || []).filter(x => x.tier === t).length]).filter(x => x[1]);
          const top = (o.opened || []).slice(0, 3);
          return '<div class="ap3-nb' + (on ? " on" : "") + '" data-nb="' + esc(c.label) + '">' +
            '<div class="h"><b>' + esc(c.label) + '</b><div class="ap3-yn" role="group" aria-label="Open ' + esc(c.label) + '">' +
              '<button type="button" data-nbon="0" class="' + (on ? "" : "on") + '">No</button>' +
              '<button type="button" data-nbon="1" class="' + (on ? "on yes" : "") + '">Yes</button></div></div>' +
            (on ? "" : '<div class="if">If yes</div>') +
            '<div class="big"><b>' + sgN(d.jobs) + '</b> jobs in ' + esc(String(FC.year)) +
              '<small>' + sgN(o.jobsFull || 0) + " a season once established</small></div>" +
            '<div class="nums">' +
              (() => { const ps = on ? planSite(c.label) : null, f = ps ? ps.fm : (o.fm || 1);
                return "<span><b>" + fmtN(f) + "</b>" + (f === 1 ? " foreman" : " foremen") + " at the base<small>" +
                  (ps ? esc(PLAN.label) + " plan" : "company hire " + sgN(d.hire)) + "</small></span>"; })() +
              "<span><b>" + sgM(d.mkt) + "</b> marketing<small>" + sgN(d.leads) + " leads</small></span>" +
              "<span><b>" + sgN(d.sales) + "</b> sales<small>at peak</small></span>" +
              "<span><b>" + sgM(d.net) + "</b> net<small>season, after all costs</small></span>" +
              "<span><b>" + sgM(d.rev) + "</b> income<small>" + (d.jobs > 0.5 ? money0(d.rev / d.jobs) + " average job" : "no jobs added") + "</small></span>" +
              "<span><b>" + fmtN((o.served || []).length) + "</b> counties nearest to it<small>within 50 miles</small></span>" +
            "</div>" +
            (() => { /* SAY WHAT IT ASSUMES: the capture the new ground would have to reach in year one,
                         beside what its state runs today -- Montgomery reads ~35 against Maryland's 7.5 */
              const op = o.opened || [], mv = op.reduce((a, x) => a + num(x.a["Movers Per Year"]), 0);
              if (!mv) return "";
              const now = op.reduce((a, x) => a + num(x.a["Leads 12m"]), 0);
              const need = 10000 * (now + op.reduce((a, x) => a + x.leadsYr, 0) * NB_YEAR1) / mv;
              const stNow = capOfSt(c.st);
              return '<div class="assume">Assumes its new ground reaches <b>' + r1(need) + "</b> leads per 10k movers in " + esc(String(FC.year)) +
                (stNow != null ? " — " + esc(c.st) + " runs " + r1(stNow) + " today" : "") + "</div>"; })() +
            '<div class="ground">Opens <b>' + fmtN((o.opened || []).length) + "</b> counties " +
              tiers.map(([t, n]) => '<i class="tchip" style="background:' + TC["t" + t] + '">T' + t + " · " + n + "</i>").join("") +
              (top.length && !full ? "<small>biggest: " + top.map(x => esc(x.a.County) + " " + esc(x.a.State)).join(", ") + "</small>" : "") + "</div>" +
            /* the side panel's version lists the ground it opens, county by county */
            (full && (o.opened || []).length ? '<div class="opened">' + o.opened.slice(0, 12).map(x =>
              '<div><i class="tchip" style="background:' + TC["t" + x.tier] + '">T' + x.tier + "</i><span>" + esc(x.a.County) + " " + esc(x.a.State) +
              "</span><small>" + r1(x.mi) + " mi · " + sgN(x.jobsFull * NB_YEAR1) + " jobs</small></div>").join("") +
              (o.opened.length > 12 ? "<small>and " + fmtN(o.opened.length - 12) + " more</small>" : "") + "</div>" : "") +
            (full && !(o.opened || []).length ? '<div class="assume">No county comes into reach from here: everything within 50 miles is already within 50 miles of a base we have.</div>' : "") +
            "</div>";
      }

      /* the county names a pool should push, and the weak ones that still carry real leads */
      function poolAreas(states) {
        const cty = AREA.filter(a => a.Level === "County" && states.includes(a.State) && num(a["Leads 12m"]) > 0);
        const by = t => cty.filter(a => num(a.Tier) === t).sort((x, y) => num(y["Leads 12m"]) - num(x["Leads 12m"]));
        return { t1: by(1), t2: by(2),
                 weak: by(4).filter(a => num(a["Leads 12m"]) >= 30 && num(a["Miles To Base"]) <= 50) };
      }
      function todoHtml(N) {
        if (!N) return "";
        const st = inputs.mapSt || "";
        const names = (xs, n, multi) => xs.slice(0, n).map(a => esc(a.County) + (multi ? " " + esc(a.State) : "")).join(", ") +
          (xs.length > n ? ' <span class="more">+' + (xs.length - n) + "</span>" : "");
        const cards = N.pools.filter(q => (q.states || []).length && (!st || q.states.includes(st))).map(q => {
          const rs = N.rows.filter(r => q.states.includes(r.st));
          const jobs = rs.reduce((a, r) => a + (r.jobs || 0), 0);
          if (!jobs) return "";
          const leads = rs.reduce((a, r) => a + (r.leads || 0), 0);
          const mkt = rs.reduce((a, r) => a + (r.leads || 0) * (N.mkt.cplOf(r.st) || 0), 0);
          const P = poolAreas(q.states), multi = q.states.length > 1;
          const act = (cls, k, v) => '<li class="' + cls + '"><i>' + k + "</i><span>" + v + "</span></li>";
          return '<div class="ap3-todo">' +
            '<div class="h"><b>' + esc(q.label) + '</b><span>' + fmtN(jobs) + " jobs</span></div><ul>" +
            act(q.hire ? "hire" : "ok", "Crew", q.hire
              ? "<b>Hire " + fmtN(q.hire) + "</b> foremen · " + fmtN(q.peak) + " at peak, " + fmtN(q.have) + " today"
              : "Covered · " + fmtN(q.peak) + " at peak, " + fmtN(q.have) + " today") +
            act("mkt", "Marketing", "<b>" + money0(mkt) + "</b> for " + fmtN(leads) + " leads") +
            (P.t1.length ? act("push", "Push", names(P.t1, 3, multi))
                         : P.t2.length ? act("push", "Grow", names(P.t2, 3, multi)) : "") +
            (P.weak.length ? act("weak", "Weak", names(P.weak, 2, multi) + " <small>Tier 4 with real leads</small>") : "") +
            "</ul></div>";
        }).join("");
        return '<div class="ap3-todos">' + cards + "</div>";
      }

      /* one row per area at the chosen level: the mart row plus this plan's money and jobs. A
         state's budget and jobs are split by the area's share of the state's leads and jobs in the
         last 12 months -- the same rule the county sheet always used. */
      function areaRows(N, level, st) {
        const stB = {}, stJ = {};
        if (N) N.rows.forEach(r => { const c = N.mkt.cplOf(r.st); stB[r.st] = c != null ? r.leads * c : null; stJ[r.st] = r.jobs; });
        return AREA.filter(a => a.Level === level && SERVICE_AREAS.includes(a.State) && (!st || a.State === st)).map(a => ({
          a, key: a["Area Key"], st: a.State, name: a.Name || a["Area Key"], tier: num(a.Tier), band: TIER_BAND(num(a.Tier)),
          never: num(a["Never A Lead"]) === 1, leads: num(a["Leads 12m"]), jobs: num(a["Jobs 12m"]),
          share: num(a["State Lead Share"]),
          budget: stB[a.State] != null ? stB[a.State] * num(a["State Lead Share"]) : null,
          planJobs: stJ[a.State] != null ? stJ[a.State] * num(a["State Job Share"]) : null }));
      }
      const planOfArea = (N, a) => {
        if (!N || !a) return { budget: null, jobs: null };
        const r = N.rows.find(x => x.st === a.State); if (!r) return { budget: null, jobs: null };
        const cpl = N.mkt.cplOf(r.st);
        return { budget: cpl != null ? r.leads * cpl * num(a["State Lead Share"]) : null, jobs: r.jobs * num(a["State Job Share"]) };
      };

      function mapBarHtml() {
        const lvl = inputs.mapLevel;
        const seg = (attr, items, on) => '<div class="ap3-seg">' + items.map(([k, l]) =>
          '<button type="button" data-' + attr + '="' + esc(k) + '" class="' + (k === on ? "on" : "") + '">' + esc(l) + "</button>").join("") + "</div>";
        const MODES = [["tier", "Tier"], ["market", "Market size"], ["capture", "Our capture"], ["spend", "Marketing"]];
        /* ONE TOOLBAR, RIGHT ABOVE THE MAP (his call 2026-09-30: the market switch alone at the top
           of the tab was "crap" positioning -- it is a map control and belongs with the other two) */
        return '<div class="ap3-bar">' +
          "<label>Market</label>" + seg("mapst", [["", "Whole market"]].concat(SERVICE_AREAS.map(x => [x, x])), inputs.mapSt || "") +
          "<label>Show</label>" + seg("maplevel", LEVELS, lvl) +
          (lvl === "County" ? "<label>Colour</label>" + seg("mapcolor", MODES, inputs.mapColor) : "") +
          /* FIND A PLACE AND LIGHT IT UP (his ask 2026-09-30: "add search so it can highlight") */
          '<div class="ap3-find"><input id="apFind" class="rs-inp" type="search" autocomplete="off" spellcheck="false" ' +
            'placeholder="Find a county, city or zip…" aria-label="Find a county, city or zip on the map" value="' + esc(FINDQ) + '">' +
            '<div id="apFindRes" class="ap3-findres" style="display:none"></div></div>' +
          "</div>";
      }
      /* the search: a zip by its digits, anything else by name -- names that START with the text
         first, counties before cities before zips, the areas with leads ahead of the empty ones */
      let FINDQ = "";
      function findAreas(q) {
        q = String(q || "").trim().toLowerCase();
        if (q.length < 2) return [];
        const digits = /^\d+$/.test(q), LV = { County: 0, City: 1, Zip: 2 };
        const out = [];
        AREA.forEach(a => {
          if (!num(a.Latitude)) return;
          let rank;
          if (digits) { if (a.Level !== "Zip" || String(a.Zip || "").indexOf(q) !== 0) return; rank = 0; }
          else { const nm = String(a.Level === "Zip" ? a.City || "" : a.Name || "").toLowerCase(), full = nm + " " + String(a.State || "").toLowerCase();
            const i = full.indexOf(q); if (i < 0) return; rank = i === 0 ? 0 : 1; }
          out.push({ a, rank });
        });
        out.sort((x, y) => x.rank - y.rank || LV[x.a.Level] - LV[y.a.Level] || num(y.a["Leads 12m"]) - num(x.a["Leads 12m"]));
        return out.slice(0, 10).map(x => x.a);
      }

      function tierKeyHtml(rows) {
        const TC = tierColors();
        const cnt = {}; rows.forEach(r => { cnt[r.band] = (cnt[r.band] || 0) + 1; });
        const far = rows.filter(r => isFar(r.a)).length;
        const never = rows.filter(r => r.never && !isFar(r.a)).length;
        return ["t1", "t2", "t3", "t4"].map(b => '<span class="ap2-mk"><i class="ap2-sw" style="background:' + TC[b] + '"></i>' +
            TIER_LABEL[b] + " <b>" + fmtN((cnt[b] || 0) - (b === "t4" ? far : 0)) + "</b></span>").join("") +
          (far ? '<span class="ap2-mk"><i class="ap2-sw" style="background:' + TC.t4 + ';opacity:.28"></i>Over 50 mi from a base <b>' + fmtN(far) + "</b></span>" : "") +
          (cnt.grey ? '<span class="ap2-mk"><i class="ap2-sw grey"></i>Not rated <b>' + fmtN(cnt.grey) + "</b></span>" : "") +
          (never ? '<span class="ap2-mk"><i class="ap2-sw none"></i>' + (inputs.mapLevel !== "County" && !mapStOf() ? "Paler" : "Hatched") +
                   ": no lead yet <b>" + fmtN(never) + "</b></span>" : "");
      }

      function mapKeyHtml(N) {
        const lvl = inputs.mapLevel;
        let key;
        if (lvl !== "County" || inputs.mapColor === "tier") {
          key = tierKeyHtml(areaRows(N, lvl, mapStOf()));
        } else {
          const R = countyRowsFor();
          const withMovers = R.filter(r => r.movers > 0 && r.leads12 > 0);
          const bubbles = (label, vals, fmt, cls) => { const v = vals.filter(x => x > 0).sort((a, b) => b - a);
            if (!v.length) return ""; const mx = v[0], picks = [mx, v[Math.floor(v.length * 0.25)], v[Math.floor(v.length * 0.75)]];
            const rad = q => 4 + 26 * Math.sqrt(q / mx);
            return '<span class="ap2-mk">' + label + "&nbsp;" + picks.map(q => '<i class="ap2-bub' + (cls || "") + '" style="width:' +
              (2 * rad(q)).toFixed(0) + "px;height:" + (2 * rad(q)).toFixed(0) + 'px"></i><b>' + fmt(q) + "</b>").join("&nbsp;&nbsp;") + "</span>"; };
          if (inputs.mapColor === "market") key = bubbles("People who move a year", R.map(r => r.movers), fmtN);
          else if (inputs.mapColor === "spend") key = bubbles("Marketing for the season", R.map(r => r.budget || 0), money0, " spend") +
            '<span class="ap2-mk">coloured by tier</span>';
          else { const v = withMovers.map(r => 10000 * r.leads12 / r.movers).sort((a, b) => a - b);
            key = v.length ? '<span class="ap2-mk">Leads per 10,000 movers (' + CAP_WIN_SHORT + ")&nbsp;" +
              [.14, .28, .44, .62, .82].map(o => '<i class="ap2-rampsw" style="background:' + (tok("--pos") || "#5f7c20") + ";opacity:" + o + '"></i>').join("") +
              "&nbsp;<b>" + r1(v[0]) + "</b> to <b>" + r1(v[v.length - 1]) + "</b></span>" : ""; }
        }
        return '<div class="ap2-mapkey" id="apMapKey">' + key +
          '<span class="ap2-mk"><i class="ap2-sw have"></i>our bases</span>' +
          (NB_CANDS.length ? '<span class="ap2-mk"><i class="ap2-sw cover"></i>possible new base</span>' : "") +
          "</div>";
      }

      /* ---- the right panel: the ranked list, or the full sheet of whatever was clicked ---- */
      let SIDE = null;               // null = the list; { kind: "area", level, key } | { kind: "base", label } | { kind: "pick" }
      function areaListHtml(N) {
        const lvl = inputs.mapLevel, st = mapStOf();
        const R = areaRows(N, lvl, st);
        if (!R.length) return '<div class="ap2-note" style="padding:12px">No ' + esc(lvl.toLowerCase()) + " rows yet — the tier mart (mart_area_tier) builds with the next refresh.</div>";
        const TC = tierColors();
        const cnt = { 0: R.length }; R.forEach(r => { if (r.tier > 0) cnt[r.tier] = (cnt[r.tier] || 0) + 1; });
        const tf = +inputs.listTier || 0;
        const shown = R.filter(r => !tf || r.tier === tf)
          .sort((x, y) => ((x.tier || 9) - (y.tier || 9)) || (y.leads - x.leads) || String(x.name).localeCompare(String(y.name)));
        const CAP = 250;
        const tabs = [0, 1, 2, 3, 4].map(t => '<button type="button" data-listtier="' + t + '" class="' + (t === tf ? "on" : "") + '">' +
          (t ? '<i style="background:' + TC["t" + t] + '"></i>' + t : "All") + "<small>" + fmtN(cnt[t] || 0) + "</small></button>").join("");
        const place = r => lvl === "County" ? r.st : esc(r.a.County || "") + " County";
        return '<div class="ap3-list">' +
          '<div class="lh"><b>' + fmtN(R.length) + " " + (lvl === "Zip" ? "zip codes" : lvl === "City" ? "cities" : "counties") +
            "</b><span>" + (st ? esc(st) : "whole market") + ' · click one for its full sheet</span><button type="button" class="rs-btn" id="apAreaCsv">CSV</button></div>' +
          '<div class="tt">' + tabs + "</div>" +
          '<div class="cols"><span>Area</span><span>Leads<small>12 mo</small></span><span>Jobs<small>plan</small></span><span>Marketing<small>plan</small></span></div>' +
          '<div class="rows">' + shown.slice(0, CAP).map(r =>
            '<button type="button" class="r" data-area="' + esc(r.key) + '">' +
              '<i class="tb ' + r.band + '" style="background:' + (TC[r.band] || TC.grey) + '">' + (r.tier || "–") + "</i>" +
              '<span class="n"><b>' + esc(r.name) + "</b><small>" + place(r) + (r.never ? " · no lead yet" : "") + "</small></span>" +
              '<span class="v">' + (r.leads ? fmtN(r.leads) : "—") + "</span>" +
              '<span class="v">' + (r.planJobs >= 0.5 ? fmtN(r.planJobs) : "—") + "</span>" +
              '<span class="v">' + (r.budget >= 1 ? money0(r.budget) : "—") + "</span></button>").join("") +
            (shown.length > CAP ? '<div class="ap2-note" style="padding:8px 10px">The first ' + CAP + " of " + fmtN(shown.length) + " — the CSV has them all.</div>" : "") +
          "</div></div>";
      }
      /* THE FULL SHEET (his ask: "on user click - on the right panel i can see all the information").
         Everything the old hover tooltip carried, in a panel that cannot run off the screen. */
      function areaDetailHtml(N, level, key) {
        const a = (AREA_IX[level] || {})[key];
        if (!a) return '<div class="ap2-note" style="padding:12px">No data for this area.</div>';
        const TC = tierColors(), band = TIER_BAND(num(a.Tier)), P = planOfArea(N, a);
        const row = (k, v, sub) => "<div class=\"kv\"><span>" + k + (sub ? "<small>" + sub + "</small>" : "") + "</span><b>" + v + "</b></div>";
        const EMD = "—";
        const cty = level === "County" ? countyRowsFor().find(r => r.st === a.State && ckey(r.county) === ckey(a.County)) : null;
        const title = level === "Zip" ? a.Zip + " " + (a.City || "") : a.Name;
        const where = level === "County" ? esc(a.State) : level === "City" ? esc(a.County || "") + " County, " + esc(a.State) + " · " + fmtN(num(a.Zips)) + (num(a.Zips) === 1 ? " zip code" : " zip codes")
                    : esc(a.County || "") + " County, " + esc(a.State);
        const was = a._nbWas != null && a._nbWas !== num(a.Tier) ? '<div class="was">Tier ' + a._nbWas + " → " + num(a.Tier) + " with the new base</div>" : "";
        return '<div class="ap3-det">' +
          '<button type="button" class="ap3-back" data-sideback>← All ' + (level === "Zip" ? "zip codes" : level === "City" ? "cities" : "counties") + "</button>" +
          '<div class="dh"><b>' + esc(title) + '</b><span>' + where + "</span></div>" +
          '<div class="tierline"><i style="background:' + (TC[band] || TC.grey) + '"></i>' + TIER_LABEL[band] + "</div>" +
          '<div class="why">' + esc(a["Tier Reason"] || "") + "</div>" + was +
          '<div class="sec">The ' + esc(String(FC.year || "")) + " plan here</div>" +
            row("Marketing", P.budget != null && P.budget >= 1 ? money0(P.budget) : EMD, r1(100 * num(a["State Lead Share"])) + "% of " + esc(a.State) + "'s leads") +
            row("Jobs", P.jobs != null && P.jobs >= 0.05 ? r1(P.jobs) : EMD, "its share of " + esc(a.State) + "'s forecast") +
          '<div class="sec">Our work, last 12 months</div>' +
            row("Leads", fmtN(num(a["Leads 12m"]))) +
            row("Booked", num(a["Leads 12m"]) ? r1(num(a["Booking Rate"])) + "%" : EMD) +
            row("Jobs", fmtN(num(a["Jobs 12m"]))) +
            row("Average ticket", a["Avg Ticket"] != null ? money0(num(a["Avg Ticket"])) : EMD) +
            (a["Data Score"] != null && a["Tier Source"] === "Our data" ? row("Score", r1(num(a["Data Score"])), "distance, booking, ticket, cubic feet") : "") +
          '<div class="sec">Who can serve it</div>' +
            row("Nearest base", esc(a["Nearest Base"] || EMD), r1(num(a["Miles To Base"])) + " mi") +
            row("Foremen within 60 mi", fmtN(num(a["Foremen Within 60mi"]))) +
            (cty ? row("Max jobs a day", r1(cty.ceil), "if every crew in range came here") + row("Fair share", r1(cty.fair), "jobs a day at today's dispatch pattern") : "") +
          (num(a.Population) ? '<div class="sec">The market</div>' +
            row("People", fmtN(num(a.Population))) +
            row("Move a year", fmtN(num(a["Movers Per Year"]))) +
            row("Leads per 10k movers", a["Leads Per 10k Movers"] != null ? r1(num(a["Leads Per 10k Movers"])) : EMD, "last 12 months") +
            row("Median income", a["Median Income"] != null ? money0(num(a["Median Income"])) : EMD) +
            row("Home value", a["Home Value"] != null ? money0(num(a["Home Value"])) : EMD) +
            row("Own their home", a["Owner Share Pct"] != null ? r1(num(a["Owner Share Pct"])) + "%" : EMD) : "") +
          "</div>";
      }
      function sideHtml(N) {
        const box = host.querySelector("#apMapBox");
        if (SIDE && SIDE.kind === "area") return areaDetailHtml(N, SIDE.level, SIDE.key);
        if (SIDE && SIDE.kind === "pick") { const c = NB_CANDS.find(x => x.custom);
          if (c && N) return '<div class="ap3-det"><button type="button" class="ap3-back" data-sideback>← Back to the list</button>' + nbCard(c, N, true) + "</div>"; }
        if (SIDE && SIDE.kind === "base" && box && box._baseSheet) return '<div class="ap3-det"><button type="button" class="ap3-back" data-sideback>← Back to the list</button>' + box._baseSheet(SIDE.label) + "</div>";
        return areaListHtml(N);
      }
      function showSide(s) {
        SIDE = s;
        const el = host.querySelector("#apAreaList");
        if (el) { el.innerHTML = sideHtml(FC.year ? nextCalc() : null); el.scrollTop = 0; }
        wireMapColor();
      }

      function areaCsv(N) {
        const lvl = inputs.mapLevel, st = mapStOf();
        const R = areaRows(N, lvl, st).filter(r => !+inputs.listTier || r.tier === +inputs.listTier);
        const cols = ["Level", "State", "County", "City", "Zip", "Name", "Tier", "Tier Source", "Tier Reason", "Leads 12m", "Booked 12m",
                      "Jobs 12m", "Booking Rate", "Avg Ticket", "Miles To Base", "Nearest Base", "Foremen Within 60mi", "Data Score",
                      "Market Score", "Population", "Movers Per Year", "Median Income", "Home Value", "Owner Share Pct"];
        const q = v => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
        const lines = [cols.concat(["Tier Name", "Plan Jobs", "Plan Marketing"]).join(",")].concat(R.map(r =>
          cols.map(c => q(r.a[c])).concat([q(TIER_NAME[r.tier]), q(r.planJobs != null ? Math.round(r.planJobs * 10) / 10 : ""),
                                          q(r.budget != null ? Math.round(r.budget) : "")]).join(",")));
        const blob = new Blob([lines.join("\n")], { type: "text/csv" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "seasonal-plan-" + lvl.toLowerCase() + "s" + (st ? "-" + st : "") + ".csv";
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }

      /* EVERYTHING THAT EXPLAINS, IN ONE PLACE, SHUT */
      function howHtml() {
        const R = countyRowsFor();
        const unc = R.filter(r => r.uncovered);
        const B = basesFor();
        const rt = t => NB_RATE[t] ? r1(NB_RATE[t].cap) + " leads per 10k movers, " + r1(100 * NB_RATE[t].jpl) + "% become jobs" : "—";
        return '<details class="ap3-how" id="apHow"><summary>How this is calculated<small>tiers, new bases, the budget split, the fleet and the Census survey</small></summary>' +
          '<div class="ap2-say" style="margin:10px 0">' +
            "<b>The tier.</b> His Power BI's four grades: <b>1 Core, 2 Good, 3 Normal, 4 Don't target</b>. " +
            "An area with enough leads to measure (a county 30, a city 20, a zip 15, over the last 12 months) is scored on " +
            "distance to a base, booking rate, average ticket and cubic feet. Tier 1 more than 50 miles from a base drops to Tier 2. " +
            "An area with too few leads is rated on its <b>market</b> instead, standing in for last year's hand survey: " +
            "median income, home value and home ownership against the other areas; anything over 50 miles from a base is Tier 4.</div>" +
          '<div class="ap2-say" style="margin:0 0 10px"><b>A new base</b> brings the counties within 50 miles of it into reach and re-scores their distance. ' +
            "What they are expected to send is what counties of the same tier ALREADY within reach of a base send us today " +
            "(Tier 1 " + rt(1) + "; Tier 2 " + rt(2) + "; Tier 3 " + rt(3) + "; Tier 4 " + rt(4) + "; Delaware left out, Tuji inflates it). " +
            "That took years; Season " + esc(String(FC.year || "")) + " counts <b>half</b>. Those jobs are added to the plan, so crew, sales and marketing follow. " +
            "Its crew = the jobs it adds at the rate the existing bases run, at least one, and can be changed on its card; existing bases keep their plan. Parking $800 a month.</div>" +
          '<div class="ap2-say" style="margin:0 0 10px"><b>The money and the jobs per area.</b> Each state\'s planned marketing and jobs, ' +
            "split by the area's share of the state's leads and jobs over the last 12 months. No ad dollar carries geography, so this is a " +
            "planned share, never measured spend. <b>The flags</b> are the bases: solid for the " + fmtN(B.have.length) + " we have, dashed for a possible new one. " +
            (unc.length ? fmtN(unc.length) + " counties with jobs have no foreman within 60 miles. " : "") + "</div>" +
          '<div id="apChips">' + fleetChips() + "</div>" +
          headlineStrip(R) +
          budgetByBand(R) +
          '<div class="ap3-howcard"><div class="ap2-h3">The Census survey</div>' +
            '<div class="ap2-note" style="margin:0 0 8px">How many people move there at all — and how many of them we reach.</div>' +
            '<div id="apSurvey">' + surveyHtml() + "</div></div>" +
          "</details>";
      }

      function mapHtml() {
        if (!COUNTY.length && !AREA.length) return '<div class="panel">The county marts (mart_area_county, mart_area_tier) are not ' +
          'built yet — run <b>sources=mart_area_county</b> and reload.</div>';
        const N = FC.year ? nextCalc() : null;
        const N0 = FC.year && (nbAny() || scAny()) ? nextCalc({ nb: "none", mult: {} }) : null;
        return '<div id="apKpis">' + planStripHtml(N, N0) + "</div>" +
          '<div id="apScn">' + scHtml(N, N0) + "</div>" +
          '<div id="apNewBases">' + nbHtml(N) + "</div>" +
          '<div id="apTodos">' + todoHtml(N) + "</div>" +
          '<div id="apMapBar">' + mapBarHtml() + "</div>" +
          '<div id="apMapKeyWrap">' + mapKeyHtml(N) + "</div>" +
          '<div class="ap3-mapgrid"><div id="apMapBox" class="ap2-mapbox"></div>' +
            '<div id="apAreaList" class="ap3-side">' + sideHtml(N) + "</div></div>" +
          howHtml();
      }

      /* ONE REPAINT FOR THE TAB. Market, level, colour and the base toggles only restyle or swap map
         LAYERS -- the Leaflet map is built once, so pan, zoom and a pinned ring survive every click. */
      function repaintMapTab(opts) {
        const N = FC.year ? nextCalc() : null;
        const N0 = FC.year && (nbAny() || scAny()) ? nextCalc({ nb: "none", mult: {} }) : null;
        const put = (id, html) => { const el = host.querySelector(id); if (el) el.innerHTML = html; };
        put("#apKpis", planStripHtml(N, N0));
        put("#apScn", scHtml(N, N0));
        if (!opts || opts.bases !== false) put("#apNewBases", nbHtml(N));
        put("#apTodos", todoHtml(N));
        put("#apMapBar", mapBarHtml());
        put("#apMapKeyWrap", mapKeyHtml(N));
        put("#apAreaList", sideHtml(N));
        wireMapColor();
      }
      /* kept for callers from the earlier pass */
      function repaintMapChrome() { repaintMapTab(); }
      function nbRepaint() {
        nbApplyAreas();
        repaintPlan();                 // re-solves the What-if, repaints every tab and the Map tab
        const box = host.querySelector("#apMapBox"); if (box && box._restyle) box._restyle();
      }
      function wireNewBases() { wireMapColor(); }
      function wireMapColor() {
        const box = host.querySelector("#apMapBox");
        host.querySelectorAll("[data-mapst]").forEach(b => { b.onclick = () => {
          if ((inputs.mapSt || "") === b.dataset.mapst) return;
          inputs.mapSt = b.dataset.mapst; inputs.listTier = 0; SIDE = null;
          save(); repaintMapTab({ bases: false });
          if (box && box._applyLevel) box._applyLevel(true);
        }; });
        host.querySelectorAll("#apMapBar [data-mapcolor]").forEach(b => { b.onclick = () => {
          if (inputs.mapColor === b.dataset.mapcolor) return;
          inputs.mapColor = b.dataset.mapcolor; save();
          if (box && box._applyLevel) box._applyLevel(false);
          repaintMapTab({ bases: false });
        }; });
        host.querySelectorAll("#apMapBar [data-maplevel]").forEach(b => { b.onclick = () => {
          if (inputs.mapLevel === b.dataset.maplevel) return;
          inputs.mapLevel = b.dataset.maplevel; inputs.listTier = 0; SIDE = null;
          save(); repaintMapTab({ bases: false });
          if (box && box._applyLevel) box._applyLevel(true);
        }; });
        host.querySelectorAll("#apAreaList [data-listtier]").forEach(b => { b.onclick = () => {
          inputs.listTier = +b.dataset.listtier; save(); showSide(null); }; });
        host.querySelectorAll("#apAreaList [data-area]").forEach(b => { b.onclick = () => {
          const key = b.dataset.area;
          showSide({ kind: "area", level: inputs.mapLevel, key });
          if (box && box._focusArea) box._focusArea(key);
        }; });
        host.querySelectorAll("#apAreaList [data-sideback]").forEach(b => { b.onclick = () => showSide(null); });
        const csv = host.querySelector("#apAreaCsv"); if (csv) csv.onclick = () => areaCsv(FC.year ? nextCalc() : null);
        const fi = host.querySelector("#apFind"), fr = host.querySelector("#apFindRes");
        if (fi && fr) {
          const TC = tierColors();
          const go = a => { fr.style.display = "none"; FINDQ = fi.value = a.Level === "Zip" ? a.Name : a.Name + ", " + a.State;
            showSide({ kind: "area", level: a.Level, key: a["Area Key"] });
            if (box && box._highlight) box._highlight(a); };
          const list = () => { FINDQ = fi.value;
            const hits = findAreas(fi.value); fr._hits = hits;
            if (!fi.value.trim()) { if (box && box._highlight) box._highlight(null); }
            fr.innerHTML = hits.length ? hits.map((a, i) => '<button type="button" data-find="' + i + '"><i class="tchip" style="background:' +
                (TC["t" + num(a.Tier)] || "var(--faint)") + '">' + (num(a.Tier) >= 1 ? "T" + num(a.Tier) : "–") + "</i><span>" + esc(a.Name) +
                (a.Level === "Zip" ? "" : ", " + esc(a.State)) + "</span><small>" + esc(a.Level === "Zip" ? "zip · " + a.State : a.Level === "City" ? "city · " + (a.County || "") : "county") + "</small></button>").join("")
              : fi.value.trim().length >= 2 ? '<div class="none">Nothing by that name in our states.</div>' : "";
            fr.style.display = fr.innerHTML ? "" : "none";
            fr.querySelectorAll("[data-find]").forEach(b => { b.onmousedown = e => { e.preventDefault(); go(hits[+b.dataset.find]); }; }); };
          fi.oninput = list;
          fi.onfocus = () => { if (fi.value.trim().length >= 2) list(); };
          fi.onblur = () => setTimeout(() => { fr.style.display = "none"; }, 150);
          fi.onkeydown = e => { if (e.key === "Enter" && fr._hits && fr._hits.length) { e.preventDefault(); go(fr._hits[0]); fi.blur(); }
            else if (e.key === "Escape") { fr.style.display = "none"; } };
        }
        const pk = host.querySelector("#apNewBases [data-nbpick]");
        if (pk) pk.onclick = () => { PICK = !PICK;
          if (box) { box.classList.toggle("ap3-picking", PICK); if (PICK) box.scrollIntoView({ block: "center", behavior: "smooth" }); }
          const el = host.querySelector("#apNewBases"); if (el) { el.innerHTML = nbHtml(FC.year ? nextCalc() : null); wireMapColor(); } };
        host.querySelectorAll("#apNewBases [data-nb], #apAreaList [data-nb]").forEach(card => {
          const label = card.dataset.nb;
          card.querySelectorAll("[data-nbon]").forEach(b => { b.onclick = () => {
            const want = b.dataset.nbon === "1"; if (!!NB_ON[label] === want) return;
            if (PLAN) { planEnd(); SC.kind = null; SC.targets = null; }      // a base flipped by hand: no longer his table
            if (want) NB_ON[label] = true; else { delete NB_ON[label]; delete NB_FM[label]; delete TR_OWN[label]; }
            nbRepaint(); }; });
        });
        host.querySelectorAll("#apScn [data-plan]").forEach(b => { b.onclick = () => {
          const k = b.dataset.plan;
          if (!k) { if (!PLAN) return; planEnd(); SC.kind = null; SC.targets = null;
            [NB_ON, NB_FM, TR_OWN].forEach(o => Object.keys(o).forEach(x => delete o[x])); nbRepaint(); return; }
          if (PLAN && PLAN.key === k) return;
          PLAN = JSON.parse(JSON.stringify(PLANS[k])); PLAN.key = k;
          planApply(); nbRepaint();
        }; });
        host.querySelectorAll("#apScn [data-plansite]").forEach(b => { b.onclick = () => {
          if (!PLAN) return;
          const [gi, si] = b.dataset.plansite.split(":").map(Number), x = PLAN.groups[gi].sites[si];
          x.fm = Math.max(0, x.fm + (+b.dataset.d));
          planApply(); nbRepaint();
        }; });
        host.querySelectorAll("#apScn [data-sc]").forEach(b => { b.onclick = () => {
          const kind = b.dataset.sc, pool = b.dataset.pool || null, dd = +b.dataset.d;
          if (PLAN) planEnd();               // another driver takes over: the bases stay, the plan's crews no longer hold
          const N = nextCalc(), P = nextCalc({ nb: "none", mult: {} });
          if (kind === "nbfm") {           // a new base's crew: set directly, it is not a driver
            const o = (N.nb || []).find(x => x.label === pool);
            if (o) { NB_FM[pool] = Math.max(1, o.fm + dd); repaintPlan(); }
            return;
          }
          let target;
          if (kind === "sales") target = Math.max(1, N.sales.peak + dd);
          else if (kind === "fm") target = Math.max(0, baseFm(N, pool) + dd);
          else if (kind === "fmAll") target = Math.max(1, N.tot.peak + dd);
          else target = Math.max(0, N.tot.mkt + dd * 0.05 * P.tot.mkt);      // 5% of the plan's budget a click
          SC.kind = kind; SC.pool = pool; SC.target = target; SC.dir = dd;
          repaintPlan();
        }; });
        host.querySelectorAll("#apScn [data-tro]").forEach(b => { b.onclick = () => {
          const key = b.dataset.tro, N = nextCalc();
          const o = N.pools.find(q => q.pk === key) || (N.nb || []).find(x => x.label === key);
          if (o) { TR_OWN[key] = Math.max(0, (o.owned || 0) + (+b.dataset.d)); repaintPlan(); }
        }; });
        const scr = host.querySelector("[data-screset]");
        if (scr) scr.onclick = () => { SC.kind = null; SC.pool = null; SC.target = null;
          Object.keys(NB_ON).forEach(k => delete NB_ON[k]); Object.keys(NB_FM).forEach(k => delete NB_FM[k]); Object.keys(TR_OWN).forEach(k => delete TR_OWN[k]);
          planEnd(); SC.targets = null;
          nbPickClear(); if (SIDE && SIDE.kind === "pick") SIDE = null; nbRepaint(); };
      }

      /* Size and frame the map against the container it actually has. Safe to call at any time:
         it does nothing until the box has been laid out, so the first real call is the pane show. */
      function fitMap() {
        const box = host.querySelector("#apMapBox");
        if (!box || !box._map || !box.clientWidth || !box.clientHeight) return;
        const m = box._map;
        m.invalidateSize();
        if (!(box._fit && box._fit.length)) return;
        /* WHOLE ZOOM LEVELS COST HALF THE PICTURE. fitBounds at zoomSnap 1 rounds DOWN to the
           level that certainly fits, which put Cleveland and West Virginia on a map about New
           Jersey. The frame is therefore fitted to the ground that matters -- the counties big
           enough to be rated and every flag -- with a small pad, and then the map is allowed one
           step in if that step still holds the bases and the decided picks. */
        m.fitBounds(box._fit, { padding: [10, 10], animate: false });
        if (box._core && box._core.length) {
          const cb = L.latLngBounds(box._core);
          const z = Math.min(m.getBoundsZoom(cb, false), m.getZoom() + 1);
          if (z > m.getZoom()) { m.fitBounds(cb, { padding: [34, 34], maxZoom: z, animate: false }); }
        }
        /* NO CAGE (his call 2026-09-22: "i dont like this MAP restriction kind of thing - it
           confuses user"). A map that refuses to move is a map the reader thinks is broken. The
           OPENING frame is still chosen -- it lands on the ground the page argues about -- but
           after that it pans and zooms anywhere, and the reset control brings it home. */
      }

      function wireMap() {
        const box = host.querySelector("#apMapBox"); if (!box || box._ap) return;
        box._ap = 1;
        ensureLeaflet(() => ensureGeo(() => {
          // CLAIM THE BOX BEFORE ANY AWAITABLE WORK. `box._map` is only assigned at the end
          // of this callback, so testing it lets a racing second callback straight through and
          // the map ends up with two identical 327-shape layers, every fill at double opacity.
          if (box._built) return;
          box._built = 1;
          const R = countyRowsFor(); if (!R.length) return;
          const B = basesFor();                 // declared here: the opening frame uses it too
          /* ZOOM SNAPS TO WHOLE LEVELS (2026-09-22). At zoomSnap 0.25 the map settles between two
             tile levels, so Leaflet scales one level's tiles and keeps the level below showing
             through wherever the top one has not covered -- which drew a crisp rectangle of slightly
             different grey across the Atlantic on every render. Both geojson files were checked and
             are clean; it was never vector geometry. Whole levels cost nothing here and the seam goes. */
          const m = L.map(box, { scrollWheelZoom: true, zoomSnap: 1, zoomDelta: 1,
                                 wheelPxPerZoomLevel: 110, zoomControl: true,
                                 attributionControl: false });
          m.setView([40.3, -75.6], 7);          // must precede any layer: polygons project on add
          /* CARTO NOW KEYS EVERY BASEMAP (2026-09-20) — voyager, light_all and dark_all all come
             back stamped "API KEY REQUIRED" across the tile. OpenStreetMap's own tiles need no key.
             They are busier than a data map wants, so the layer is dimmed and, in the dark theme,
             inverted: the ground goes quiet and the circles carry the meaning.
             cleanup.js and ld-planning.js were moved off voyager the same day. */
          /* A BASEMAP MADE FOR DATA (his call 2026-09-22: "i want a better map visual itself").
             OpenStreetMap's own tiles are a NAVIGATION map -- every road, every label, full colour --
             and dimming them with a CSS filter only makes a busy map grey and busy. Esri's Light Gray
             Canvas is built for this job: pale land, quiet water, no road clutter, and the place
             names on a SEPARATE layer so they can ride ON TOP of the county fills instead of being
             buried under them. No key, no quota. Dark Gray Canvas is its twin for the dark theme, so
             the map is designed in both rather than inverted into one. */
          const darkMap = !document.body.classList.contains("light");
          const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_"
                     + (darkMap ? "Dark" : "Light") + "_Gray_";
          L.tileLayer(ESRI + "Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 14 }).addTo(m);
          const labelPane = m.createPane("apLabels");
          labelPane.style.zIndex = 460; labelPane.style.pointerEvents = "none";   // above the fills, under markers and tooltips
          L.tileLayer(ESRI + "Reference/MapServer/tile/{z}/{y}/{x}",
                      { maxZoom: 14, pane: "apLabels", opacity: darkMap ? .75 : .9 }).addTo(m);
          /* the four tiers' palette (tierColors), plus the two old names the rings and the
             no-crew outline still use: push = Tier 1's green, fix = Tier 4's red */
          const TC4 = tierColors();
          const col = Object.assign({}, TC4, { push: TC4.t1, hold: TC4.t3, fix: TC4.t4 });
          const MID = "·", EM = "—";   // the tooltips read as sentences; these are their punctuation
          /* the legend's hatch, as an SVG pattern inside Leaflet's own overlay <svg> */
          const HATCH = "ap2Hatch" + (darkMap ? "D" : "L");
          function ensureHatch() {
            const svg = m.getPane("overlayPane") && m.getPane("overlayPane").querySelector("svg");
            if (!svg || svg.querySelector("#" + HATCH)) return;
            const NS = "http://www.w3.org/2000/svg";
            const defs = document.createElementNS(NS, "defs");
            const pat = document.createElementNS(NS, "pattern");
            pat.setAttribute("id", HATCH); pat.setAttribute("width", "7"); pat.setAttribute("height", "7");
            pat.setAttribute("patternUnits", "userSpaceOnUse"); pat.setAttribute("patternTransform", "rotate(45)");
            const bg = document.createElementNS(NS, "rect");
            bg.setAttribute("width", "7"); bg.setAttribute("height", "7");
            bg.setAttribute("fill", darkMap ? "#1b2430" : "#ffffff"); bg.setAttribute("fill-opacity", ".5");
            const ln = document.createElementNS(NS, "line");
            ln.setAttribute("x1", "0"); ln.setAttribute("y1", "0"); ln.setAttribute("x2", "0"); ln.setAttribute("y2", "7");
            ln.setAttribute("stroke", col.none); ln.setAttribute("stroke-width", "2"); ln.setAttribute("stroke-opacity", ".85");
            pat.appendChild(bg); pat.appendChild(ln); defs.appendChild(pat);
            /* NEVER SENT A LEAD, BUT RATED (2026-09-29): the market grade still colours it, so the
               hatch is drawn IN the tier's colour -- "Tier 1 market, no lead yet" is the white space
               worth chasing, and it must not look like "Tier 4 market, no lead yet" */
            ["t1", "t2", "t3", "t4"].forEach(b => {
              const p2 = pat.cloneNode(true); p2.setAttribute("id", HATCH + b);
              p2.querySelector("line").setAttribute("stroke", col[b]);
              p2.querySelector("line").setAttribute("stroke-width", "2.6");
              p2.querySelector("line").setAttribute("stroke-opacity", ".95");
              defs.appendChild(p2); });
            svg.insertBefore(defs, svg.firstChild);
          }
          /* FAR IS QUIET (2026-09-29, first render): 258 of 322 counties are Tier 4 only because they
             sit over 50 miles from any base, and at full strength they turned the map into a sheet of
             red that buried the forty areas the plan is actually about. They keep Tier 4's hue, pale,
             with no hatch; full red is kept for weak ground we DO serve. */
          const fillOf = (band, never, far) => far
            ? { fillColor: col.t4, fillOpacity: .13 }
            : never && col[band] && band !== "grey" && band !== "none"
            ? { fillColor: "url(#" + HATCH + band + ")", fillOpacity: 1 }
            : band === "none" ? { fillColor: "url(#" + HATCH + ")", fillOpacity: 1 }
            : { fillColor: col[band] || col.grey, fillOpacity: band === "grey" ? .28 : band === "t2" ? .72 : .66 };
          const coCap = capAll(SERVICE_AREAS).cap;   // the eight states together, off CAP_ST (2026-09-23)
          const njCap = capOfSt("NJ");
          /* THE COUNTY SHEET (his ask 2026-09-22: "i need on tooltip to see MORE DATA - and BIGGER
             font sizes"). It was a paragraph of sentences; twelve numbers read as a paragraph are
             not read at all. Three labelled blocks now: what we DO here, who can SERVE it, and what
             the MARKET is. The headline is the market and our share of it, because that is the one
             pair the map exists to argue about. */
          const gRow = (l, v, sub) => "<i>" + l + (sub ? "<small>" + sub + "</small>" : "") + "</i><u>" + v + "</u>";
          /* THE HOVER IS A GLANCE (2026-09-29, his ask: "reduce the data on the hover and leave only
             important ones"). Name, tier and the three planning numbers; the click opens the full
             sheet in the right panel, which cannot run off the screen the way a tall tooltip did. */
          const glance = (title, band, a) => {
            const P = planOfArea(FC.year ? nextCalc() : null, a);
            return '<div class="ap2-tip ap3-glance"><b>' + esc(title) + '</b><div class="t">' + TIER_LABEL[band] + "</div>" +
              '<div class="g3"><span>Leads<b>' + fmtN(num(a && a["Leads 12m"])) + "</b><small>12 mo</small></span>" +
              "<span>Jobs<b>" + (P.jobs != null && P.jobs >= 0.5 ? fmtN(P.jobs) : "—") + "</b><small>" + esc(String(FC.year || "")) + " plan</small></span>" +
              "<span>Marketing<b>" + (P.budget != null && P.budget >= 1 ? money0(P.budget) : "—") + "</b><small>plan</small></span></div>" +
              '<div class="hint">Click for the full sheet</div></div>'; };
          const tipOf = r =>
            '<div class="ap2-tip"><b>' + esc(r.county) + " " + esc(r.st) + "</b>" +
            '<div class="t">' + TIER_LABEL[r.band] +
              (r.score != null && r.area && r.area["Tier Source"] === "Our data" ? " " + MID + " score " + r1(r.score) : "") +
              " " + MID + " " + r1(r.mi) + " mi to the nearest base</div>" +
            (r.area && r.area["Tier Reason"] ? '<div class="c">' + esc(r.area["Tier Reason"]) + "</div>" : "") +
            (r.movers
              ? '<div class="big">' + fmtN(r.movers) + " move a year</div>" +
                '<div class="c"><b>' + r1(10000 * r.leads12 / (r.movers || 1)) + "</b> of every 10,000 become a lead in " + CAP_WIN +
                  "<small>the eight states run " + r1(coCap) + ", New Jersey " + r1(njCap) + "</small></div>"
              : '<div class="big">' + fmtN(r.leads) + " leads this year</div>") +
            '<div class="hd">Our work here</div><div class="grid">' +
              gRow("Leads this year", fmtN(r.leads)) +
              gRow("Booked", r.leads ? r1(r.book) + "%" : EM) +
              gRow("Jobs", fmtN(r.jobs)) +
              (r.budget != null && r.budget > 0
                ? gRow("Marketing", money0(r.budget), r1(r.share * 100) + "% of the state" +
                    (r.band === "t4" ? ", and it follows leads, not the tier" : ""))
                : "") +
            "</div>" +
            '<div class="hd">Who can serve it</div><div class="grid">' +
              gRow("Foremen within 60 mi", fmtN(r.fm60), "shared with its neighbours") +
              gRow("Max jobs a day", r1(r.ceil), "if every crew in range came here") +
              gRow("Fair share", r1(r.fair), "at today's dispatch pattern") +
            "</div>" +
            (r.pop
              ? '<div class="hd">The market</div><div class="grid">' +
                  gRow("People", fmtN(r.pop)) +
                  gRow("Median income", money0(r.income)) +
                  gRow("Own their home", r1(r.own) + "%") +
                "</div>" : "") +
            (r.uncovered ? '<div class="w">No foreman is based within 60 miles of here</div>' : "") +
            "</div>";

          const byKey = {};
          R.forEach(r => { byKey[r.st + "|" + ckey(r.county)] = r; });
          const pts = [];
          if (GEO && GEO.features) {
            /* THE CENSUS CAN COLOUR THE MAP, NOT JUST SIT IN A CARD (his call 2026-09-22: "i loved
               this CENSUS ... that data, it proved the point"). Three ways to paint the same
               counties, and they answer three different questions:
                 TIER      where is it worth chasing -- his Power BI model, the default
                 MARKET    how many people move there at all -- the size of the prize
                 CAPTURE   how many of them become a lead -- the argument itself, because New
                           Jersey comes out dark and Maryland and Virginia come out nearly white,
                           and that is the whole case for spending on demand before yards.
               MARKET and CAPTURE are quantile ramps over one hue, so a county is shaded against
               the others rather than against a number nobody has a feel for. A county that has
               never sent a lead keeps the hatch in every mode: it is an absence, not a low value. */
            const RAMP = { market: tok("--ink") || "#22303f", capture: tok("--pos") || "#5f7c20" };
            const qcuts = key => { const v = R.map(key).filter(x => x > 0).sort((a, b) => a - b);
              if (!v.length) return [];
              return [.2, .4, .6, .8].map(q => v[Math.floor(q * (v.length - 1))]); };
            const CUTS = { market: qcuts(r => r.movers),
                           capture: qcuts(r => (r.movers ? 10000 * r.leads12 / r.movers : 0)) };
            const rank = (v, cuts) => { let i = 0; while (i < cuts.length && v > cuts[i]) i++; return i; };
            const OPA = [.14, .28, .44, .62, .82];
            const shadeOf = r => {
              const mode = inputs.mapColor;
              if (mode === "market") { const v = r.movers || 0;
                return v > 0 ? { fill: RAMP.market, op: OPA[rank(v, CUTS.market)] } : null; }
              const v = r.movers ? 10000 * r.leads12 / r.movers : 0;
              return v > 0 ? { fill: RAMP.capture, op: OPA[rank(v, CUTS.capture)] } : null;
            };
            const layer = L.geoJSON(GEO, {
              style: f => {
                const r = byKey[f.properties.st + "|" + f.properties.key];
                const band = r ? r.band : "none";
                const base = { color: r && r.uncovered ? col.fix : tok("--ap-rule-2") || "#98a4b3",
                               weight: r && r.uncovered ? 1 : 0.6,
                               opacity: r && r.uncovered ? .5 : .7,
                               lineJoin: "round",
                               dashArray: r && r.uncovered ? "3 3" : null };
                /* MARKET SIZE IS A COUNT, AND A COUNT MUST NOT BE A CHOROPLETH. Shading a county by
                   how many people move there makes a big empty county shout and a small dense one
                   whisper -- the reader is really being shown acreage. Worse, the first build only
                   shaded counties with leads, so the 168 we have never sold in came out hatched and
                   the map HID the white space it was supposed to reveal. Market size is drawn as
                   proportional circles instead (below), and the counties go quiet underneath. */
                if (inputs.mapColor === "market" || inputs.mapColor === "spend") {
                  return Object.assign(base, { fillColor: tok("--ap-rule-2") || "#98a4b3",
                                               fillOpacity: .10, weight: 0.5, opacity: .45 });
                }
                if (inputs.mapColor === "capture") {
                  const sh = r && r.leads12 > 0 ? shadeOf(r) : null;   // same window as the ramp (2026-09-23)
                  return Object.assign(base, sh ? { fillColor: sh.fill, fillOpacity: sh.op }
                                                : { fillColor: "url(#" + HATCH + ")", fillOpacity: 1 });
                }
                return Object.assign(base, fillOf(band, r && r.never, isFar(r && r.area)));
              },
              onEachFeature: (f, lyr) => {
                const r = byKey[f.properties.st + "|" + f.properties.key];
                /* read at hover time: a new-base toggle refreshes byKey (box._restyle) */
                lyr.bindTooltip(() => { const rr = byKey[f.properties.st + "|" + f.properties.key];
                  return rr ? glance(rr.county + " " + rr.st, rr.band, rr.area)
                  : '<div class="ap2-tip"><b>' + esc(f.properties.name) + " " + esc(f.properties.st) +
                    '</b><div class="t">Not in the lead directory</div></div>'; },
                  { sticky: true, className: "ap2-tipwrap", opacity: 1 });
                /* the fill is flat, so the hover needs its own signal */
                lyr.on("mouseover", () => lyr.setStyle({ weight: 2.2, color: tok("--ink") || "#22303f" }));
                lyr.on("mouseout", () => layer.resetStyle(lyr));
                lyr.on("click", () => { const rr = byKey[f.properties.st + "|" + f.properties.key];
                  if (rr && rr.area) showSide({ kind: "area", level: "County", key: rr.area["Area Key"] }); });
              },
            }).addTo(m);
            box._geo = layer;                  // so the colour switch can restyle without a rebuild

            /* PROPORTIONAL CIRCLES FOR THE MARKET. Area is proportional to movers, which is why the
               radius goes as the SQUARE ROOT -- a circle twice as wide is four times the market, and
               drawing it any other way lies about the ratio. Every county with a Census figure gets
               one whether or not it has ever sent us a lead: the whole value of this view is seeing
               a large market where we have no business at all. */
            const mktPane = m.createPane("apMkt");
            mktPane.style.zIndex = 480; mktPane.style.pointerEvents = "none";
            const MKT_HUE = tok("--blue") || "#2f62d8";
            const withMk = R.filter(x => x.movers > 0 && x.la && x.lo);
            const mkMax = withMk.length ? Math.max.apply(null, withMk.map(x => x.movers)) : 1;
            const mkR = v => 4 + 26 * Math.sqrt(v / mkMax);
            box._mkt = L.layerGroup();
            withMk.slice().sort((a, b) => b.movers - a.movers).forEach(x =>
              L.circleMarker([x.la, x.lo], { pane: "apMkt", interactive: false, radius: mkR(x.movers),
                color: MKT_HUE, weight: 1.4, opacity: .85, fillColor: MKT_HUE,
                fillOpacity: x.leads > 0 ? .30 : .10,
                dashArray: x.leads > 0 ? null : "3 3" }).addTo(box._mkt));
            if (inputs.mapColor === "market") box._mkt.addTo(m);

            /* WHERE THE MONEY LANDS, AND ON WHAT KIND OF COUNTY (his question, asked three times:
               "if we identify a base as negative, why do we push marketing there?"). Dollars are a
               COUNT, so they are circles like the market; what makes this view answer his question
               is that the circle is COLOURED BY TIER. A fat red circle is marketing going into a
               county the model rates badly, and the eye finds it instantly instead of having to
               read a table. The honest caveat is in the strip above the map and in the tooltip:
               the budget is a county's share of its STATE's leads, so it follows demand and never
               the tier, and about 44% of what lands on red is pay-per-lead that bills wherever the
               lead appears -- roughly a third of the red is actually steerable. */
            const spendPane = m.createPane("apSpend");
            spendPane.style.zIndex = 481; spendPane.style.pointerEvents = "none";
            const withSp = R.filter(x => x.budget > 0 && x.la && x.lo);
            const spMax = withSp.length ? Math.max.apply(null, withSp.map(x => x.budget)) : 1;
            const spR = v => 4 + 26 * Math.sqrt(v / spMax);
            box._spend = L.layerGroup();
            withSp.slice().sort((a, b) => b.budget - a.budget).forEach(x =>
              L.circleMarker([x.la, x.lo], { pane: "apSpend", interactive: false, radius: spR(x.budget),
                color: col[x.band] || col.grey, weight: 1.4, opacity: .9,
                fillColor: col[x.band] || col.grey, fillOpacity: .42 }).addTo(box._spend));
            if (inputs.mapColor === "spend") box._spend.addTo(m);
            /* STATE BORDERS OVER THE FILLS (his note 2026-09-21: "the forms, layout, roads, countries").
               327 county fills with no state line run Pennsylvania into New Jersey. Their own pane,
               above the fills and under the flags, and deaf to the mouse so the county tooltips
               underneath keep working. */
            if (host._apStates) {
              const sp = m.createPane("apStates"); sp.style.zIndex = 450; sp.style.pointerEvents = "none";
              L.geoJSON(host._apStates, { pane: "apStates", interactive: false,
                style: { color: tok("--ink") || "#22303f", weight: 1.7, opacity: .62, lineJoin: "round", fill: false } }).addTo(m);
              [["NJ", 40.02, -74.62], ["PA", 41.05, -77.65], ["NY", 42.85, -75.4], ["CT", 41.62, -72.72], ["MA", 42.36, -71.95],
               ["MD", 39.42, -77.05], ["VA", 37.55, -78.7], ["DE", 38.95, -75.47]].forEach(([st, la, lo]) =>
                L.marker([la, lo], { pane: "apStates", interactive: false, keyboard: false,
                  icon: L.divIcon({ className: "", iconSize: [0, 0], html: '<span class="ap2-stlbl">' + st + "</span>" }) }).addTo(m));
            }
            ensureHatch();
            /* NAME THE BIG MARKETS (his ask 2026-09-22). The basemap labels cities; these label the
               COUNTIES the argument is about, so nobody has to hover to find Philadelphia or the
               Maryland suburbs. Eight is the most that can sit on this frame without becoming
               clutter, and they are the eight biggest moving markets we can actually reach. */
            /* THE MARKETS WE ACTUALLY WORK, one label per place. Two passes were wrong before this
               one. Ranked on movers alone the top eight are New York, Kings, Queens, Bronx and
               Nassau -- five names stacked over one city. Excluding anything near a base flag then
               threw out New York and Philadelphia, which are the two the reader most wants named,
               and filled the map with Centre PA and Onondaga NY, where we do no business at all.
               So: only counties that have actually sent us leads, biggest first, each at least 0.6
               degrees from one already picked -- and the flags are left to look after themselves,
               because the label sits above the centroid and the flag beside it. */
            const FAR = 0.6;
            const taken = [];
            const named = [];
            R.filter(x => x.movers > 0 && x.leads > 0 && x.la && x.lo)
              .slice().sort((a, b) => b.movers - a.movers)
              .forEach(x => { if (named.length >= 7) return;
                if (taken.some(t => Math.abs(t[0] - x.la) < FAR && Math.abs(t[1] - x.lo) < FAR)) return;
                named.push(x); taken.push([x.la, x.lo]); });
            const namePane = m.createPane("apNames");
            namePane.style.zIndex = 470; namePane.style.pointerEvents = "none";     // same: never above a tooltip
            named.forEach(x => L.marker([x.la, x.lo], { pane: "apNames", interactive: false, keyboard: false,
              icon: L.divIcon({ className: "", iconSize: [0, 0],
                html: '<span class="ap2-cname">' + esc(x.county) + "<b>" + fmtN(x.movers) + " movers</b></span>" }) })
              .addTo(box._names = box._names || L.layerGroup().addTo(m)));
            /* THE OPENING FRAME is the ground the page argues about: every county big enough to be
               rated, and every flag. It used to take any county with one lead, so a single long-haul
               pickup in the far corner of Virginia set the zoom for the whole company. */
            const framed = R.filter(r => r.leads >= 30 && r.la && r.lo).map(r => [r.la, r.lo]);
            (B.have || []).concat(B.coverage || []).forEach(x => framed.push([x.la, x.lo]));
            /* the ground that must never leave the frame: the bases we run and the picks we chose */
            const core = (B.have || []).map(x => [x.la, x.lo]);
            ((model.expansion || {}).steps || []).forEach(st => {
              const q = (B.coverage || []).find(c => c.label === st.base);
              if (q) core.push([q.la, q.lo]); });
            R.filter(r => r.leads >= 100 && r.la && r.lo).forEach(r => core.push([r.la, r.lo]));
            box._core = core;
            if (framed.length) {
              const fb = L.latLngBounds(framed);
              if (fb.isValid()) pts.push(fb.getSouthWest(), fb.getNorthEast());
            }
            if (!pts.length) {
              const b = layer.getBounds();
              if (b && b.isValid()) pts.push(b.getSouthWest(), b.getNorthEast());
            }
          } else {
            /* the shapes could not be read: fall back to the old circles rather than a blank map */
            const maxLeads = Math.max(1, ...R.map(r => r.leads));
            R.forEach(r => {
              if (!r.la || !r.lo) return;
              L.circleMarker([r.la, r.lo], {
                radius: 6 + 18 * Math.sqrt(r.leads / maxLeads),
                color: col[r.band], weight: 1.4, fillColor: col[r.band], fillOpacity: .45,
              }).bindTooltip(tipOf(r), { sticky: true, className: "ap2-tipwrap", opacity: 1 }).addTo(m);
              pts.push([r.la, r.lo]);
            });
          }

          /* ---- the bases, over the counties ---------------------------------------------- */
          const flag = (kind, txt) => L.divIcon({
            className: "", iconSize: [0, 0],
            html: '<span class="ap2-flag ' + kind + '"><i></i><b>' + esc(txt) + "</b></span>" });
          let hoverRing = null;
          const ring = (la, lo, kind) => L.circle([la, lo], {
            radius: B.work * MI_PER_M, interactive: false,
            color: kind === "have" ? tok("--ink") || "#22303f" : col.push,
            weight: 1.6, dashArray: kind === "have" ? null : "6 4",
            fillColor: kind === "have" ? tok("--ink") || "#22303f" : col.push, fillOpacity: .09 });

          const baseTip = b => {
            const cov = b.reach.states.length
              ? b.reach.states.join(" · ") + '<small>' + fmtN(b.reach.counties) + " counties · " +
                fmtN(b.reach.leads) + " leads and " + fmtN(b.reach.jobs) + " jobs this year within " +
                B.work + " miles</small>"
              : "nothing within " + B.work + " miles";
            const gRow2 = (l, v, sub) => "<i>" + l + (sub ? "<small>" + sub + "</small>" : "") + "</i><u>" + v + "</u>";
            if (b.kind === "cover") {
              return '<div class="ap2-tip"><b>' + esc(b.label) + '</b><div class="t">' +
                '<b>opens new ground</b> — nothing we have can reach it</div>' +
                '<div class="c"><b>' + fmtN(b.newMovers) + " movers a year</b> come into range" +
                  "<small>people who move house here annually, from the Census — the only demand " +
                  "measure that exists for a county we have never sold in</small></div>" +
                (b.cap != null ? '<div class="w"><b>' + r1(b.cap) + " leads per 10,000 movers</b> in " + esc(b.st) + " (" + CAP_WIN_SHORT + "), against " + r1(b.capHome) + " at home in " + esc(b.homeSt) +
                  "<small>at " + esc(b.st) + "’s own rate those movers are about " + fmtN(b.atOwnRate) + " leads a year; at " + esc(b.homeSt) + "’s, " + fmtN(b.atHomeRate) +
                  ". A base does not move that rate — reviews, referrals and ad density do</small></div>" : "") +
                /* HIS ASK 2026-09-22: "i also want to see how many foreman should be available on
                   this new bases." Two answers, because they are two questions: the standing crew AIM
                   for the state, and what the expansion we actually decided implies at its target. */
                '<div class="hd">Foremen it should have</div><div class="grid">' +
                  gRow2("The crew aim for " + esc(b.st), b.need != null ? fmtN(b.need) : EM, "the standing target for the state") +
                  (b.xpFm != null ? gRow2("The expansion implies, at its target", r1(b.xpFm), fmtN(b.xpJobs) + " season jobs at " + r2(b.rate || 1.27) + " a foreman-day — a ceiling, $0 of it counted for next season") : "") +
                  gRow2("Trucks", b.need != null ? fmtN(b.need) : EM, "one per foreman") +
                  gRow2("Jobs a day", b.perDay != null ? r1(b.perDay) : EM, "once it is staffed") +
                "</div>" +
                '<div class="c">Opens <b>' + fmtN(b.opens) + "</b> counties no base covers today</div>" +
                "<div>" + (b.step ? "Step " + b.step + " of the chain — " : "") + (b.hopFrom ? r1(b.hopMi) + " mi from " + esc(b.hopFrom) + "; " : "") +
                  r1(b.fromBase) + " mi from the nearest base we have today</div>" +
                "<div>Would cover " + cov + "</div></div>";
            }
            if (b.kind === "have") {
              const h = b.hire;
              return '<div class="ap2-tip"><b>' + esc(b.name) + " base</b><div class=\"t\">" +
                esc(b.zip || "") + " · we have this one</div>" +
                '<div class="big">' + fmtN(b.foremen) + (b.foremen === 1 ? " foreman" : " foremen") +
                  (b.foremen ? "" : " \u2014 a parking base with nobody on it") + "</div>" +
                '<div class="hd">The crew here</div><div class="grid">' +
                  gRow2("Foremen", fmtN(b.foremen)) + gRow2("Helpers", fmtN(b.helpers)) +
                  gRow2("Drivers", fmtN(b.drivers)) +
                  gRow2("Trucks stationed", fmtN(b.foremen), "one per foreman") +
                "</div>" +
                (h ? '<div class="' + (h.hire ? "w" : "c") + '">' + (h.hire
                      ? "<b>Hire " + h.hire + "</b> more into the " + esc(h.label) + " pool"
                      : "Its pool is covered — " + h.have + " for a peak of " + h.peak) + "</div>" : "") +
                '<div class="c">' + (b.perDay != null ? "<b>" + r1(b.perDay) + " jobs a day</b> at " +
                  r2(b.rate) + " a foreman-day" : "No capacity until somebody is based here") + "</div>" +
                (b.red ? (b.red.redundant
                  ? '<div class="w"><b>Reaches nothing on its own.</b> Every county inside ' + B.work +
                    " miles is already inside another base's " + B.work + " — the nearest is " +
                    r1(b.red.nearest_other_mi) + " mi away.<small>Coverage is not the whole story: " +
                    "parking, the lease and the labour pool are not in this data</small></div>"
                  : '<div class="c">Uniquely reaches <b>' + fmtN(b.red.unique_movers) +
                    " movers a year</b> across " + fmtN(b.red.unique_counties) +
                    " counties<small>nothing else covers them</small></div>") : "") +
                "<div>Covers " + cov + "</div></div>";
            }
            return "";
          };

          /* THE REACH IS THE POINT, so it is drawn rather than hidden behind a hover (his call
             2026-09-22). A faint ring per base we have, always on: coverage and the holes in it are
             then visible on a projected slide without anyone touching the mouse. The hover ring
             still fires on top, brighter, for the one being read. */
          const ringPane = m.createPane("apRings");
          ringPane.style.zIndex = 390; ringPane.style.pointerEvents = "none";
          B.have.forEach(b => L.circle([b.la, b.lo], { pane: "apRings", radius: B.work * MI_PER_M,
            interactive: false, color: tok("--ink") || "#22303f", weight: 1, opacity: .28,
            dashArray: "3 5", fillColor: tok("--ink") || "#22303f", fillOpacity: .04 }).addTo(m));
          const baseLayer = L.layerGroup().addTo(m);
          /* Bases inside ~40 miles of one already placed get their label flipped to the other
             side, and every third one nudged up or down. Purely cosmetic, entirely deterministic:
             the same base lands in the same place on every repaint. */
          const placed = [];
          const offsetFor = b => {
            const near = placed.filter(q => miBetween(q.la, q.lo, b.la, b.lo) <= 40).length;
            placed.push(b);
            return near === 0 ? "" : near === 1 ? " flip" : near === 2 ? " up" : " flip down";
          };
          B.have.concat(B.coverage).forEach(b => {
            const mk = L.marker([b.la, b.lo], {
              icon: flag(b.kind + offsetFor(b), b.kind === "have" ? b.name + " · " + fmtN(b.foremen) : b.label.replace(/ [A-Z]{2}$/, "")),
              riseOnHover: true,
              zIndexOffset: b.kind === "have" ? 600 : b.kind === "cover" ? 500 : 400 });
            mk.bindTooltip(() => '<div class="ap2-tip ap3-glance"><b>' + esc(b.kind === "have" ? b.name + " base" : b.label) + '</b><div class="t">' +
              (b.kind === "have" ? fmtN(b.foremen) + (b.foremen === 1 ? " foreman" : " foremen") + " · we have this one"
                                 : "possible new base · " + (NB_ON[b.label] ? "YES in this scenario" : "No in this scenario")) +
              '</div><div class="hint">Click for the full sheet</div></div>',
              { sticky: true, className: "ap2-tipwrap", direction: "top", opacity: 1 });
            /* HIS ASK: the reach appears on hover. It is removed on mouseout unless the flag was
               clicked, so he can pin one open and compare it against the counties underneath. */
            mk.on("mouseover", () => {
              if (baseLayer._pinned && baseLayer._pinned.b === b) return;
              if (hoverRing) { m.removeLayer(hoverRing); hoverRing = null; }
              hoverRing = ring(b.la, b.lo, b.kind).addTo(m);
            });
            mk.on("mouseout", () => {
              if (baseLayer._pinned && baseLayer._pinned.b === b) return;
              if (hoverRing) { m.removeLayer(hoverRing); hoverRing = null; }
            });
            mk.on("click", () => {
              showSide({ kind: "base", label: b.kind === "have" ? b.name : b.label });
              const pin = baseLayer._pinned;
              if (pin) { m.removeLayer(pin.ring); baseLayer._pinned = null; }
              if (!pin || pin.b !== b) {
                if (hoverRing) { m.removeLayer(hoverRing); hoverRing = null; }
                baseLayer._pinned = { b, ring: ring(b.la, b.lo, b.kind).addTo(m) };
              }
            });
            mk.addTo(baseLayer);
          });

          /* reset the frame -- a map you can zoom is a map you can get lost in */
          const Reset = L.Control.extend({
            options: { position: "topleft" },
            onAdd: function () {
              const a = L.DomUtil.create("a", "ap2-mapbtn");
              a.href = "#"; a.title = "Back to the whole territory"; a.innerHTML = "&#10227;";
              L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", () => fitMap());
              return a;
            },
          });
          m.addControl(new Reset());
          const Toggle = L.Control.extend({
            options: { position: "topleft" },
            onAdd: function () {
              const a = L.DomUtil.create("a", "ap2-mapbtn on");
              a.href = "#"; a.title = "Show or hide the base flags"; a.innerHTML = "&#9873;";
              L.DomEvent.on(a, "click", L.DomEvent.stop).on(a, "click", () => {
                if (m.hasLayer(baseLayer)) { m.removeLayer(baseLayer); a.classList.remove("on");
                  if (hoverRing) { m.removeLayer(hoverRing); hoverRing = null; }
                  if (baseLayer._pinned) { m.removeLayer(baseLayer._pinned.ring); baseLayer._pinned = null; }
                } else { baseLayer.addTo(m); a.classList.add("on"); }
              });
              return a;
            },
          });
          m.addControl(new Toggle());

          /* ---- CITY AND ZIP (2026-09-29) ---------------------------------------------------
             His ask: "planning on county level ... i may even want to go as down as zip. i need a
             selector for that", with ZIP POLYGONS ("zip polygons - and it must be ready"). The
             shapes are the Census 2020 ZCTAs, one file per state (scripts/build_zip_geojson.py,
             run in Cloud Build because the Census blocks Georgia), fetched only when a state is
             drawn at City or Zip grain. A CITY is drawn as its zips, each filled with the city's
             tier -- mart_area_tier counts a city off exactly those zips, so the picture and the
             numbers are the same thing -- and hovering one lights the whole city. */
          const countyLayer = box._geo;
          const ZIPGEO = host._apZipGeo = host._apZipGeo || {};
          let zipLayer = null, zipSt = null, zipLvl = null, cntyLines = null;
          const zipArea = (z, lvl) => { const za = AREA_IX.Zip[z];
            if (lvl === "Zip" || !za) return za || null;
            return AREA_IX.City[za.State + "|" + za.City] || null; };
          const planOf = a => {
            const N0 = FC.year ? nextCalc() : null; if (!N0 || !a) return { budget: null, jobs: null };
            const r = N0.rows.find(x => x.st === a.State); if (!r) return { budget: null, jobs: null };
            const cpl = N0.mkt.cplOf(r.st);
            return { budget: cpl != null ? r.leads * cpl * num(a["State Lead Share"]) : null,
                     jobs: r.jobs * num(a["State Job Share"]) }; };
          const areaTip = (a, lvl, z) => {
            if (!a) return '<div class="ap2-tip"><b>' + esc(z || "") + '</b><div class="t">No leads and no Census data</div></div>';
            const band = TIER_BAND(num(a.Tier)), P = planOf(a);
            const where = lvl === "Zip" ? esc(a.City || "") + ", " + esc(a.County || "") + " County"
                                        : esc(a.County || "") + " County · " + fmtN(num(a.Zips)) + (num(a.Zips) === 1 ? " zip code" : " zip codes");
            return '<div class="ap2-tip"><b>' + esc(lvl === "Zip" ? a.Zip : a.Name) + " " + esc(a.State) + "</b>" +
              '<div class="t">' + TIER_LABEL[band] + " " + MID + " " + r1(num(a["Miles To Base"])) + " mi to " + esc(a["Nearest Base"] || "a base") + "</div>" +
              '<div class="c">' + where + "</div>" +
              (a["Tier Reason"] ? '<div class="c">' + esc(a["Tier Reason"]) + "</div>" : "") +
              '<div class="hd">The ' + esc(String(FC.year || "")) + ' plan here</div><div class="grid">' +
                gRow("Marketing", P.budget != null && P.budget >= 1 ? money0(P.budget) : EM, r1(100 * num(a["State Lead Share"])) + "% of the state's leads") +
                gRow("Jobs", P.jobs != null && P.jobs >= 0.05 ? r1(P.jobs) : EM, "its share of the state's forecast") +
              "</div>" +
              '<div class="hd">Our work, last 12 months</div><div class="grid">' +
                gRow("Leads", fmtN(num(a["Leads 12m"]))) +
                gRow("Booked", num(a["Leads 12m"]) ? r1(num(a["Booking Rate"])) + "%" : EM) +
                gRow("Jobs", fmtN(num(a["Jobs 12m"]))) +
                gRow("Average ticket", a["Avg Ticket"] != null ? money0(num(a["Avg Ticket"])) : EM) +
                gRow("Foremen within 60 mi", fmtN(num(a["Foremen Within 60mi"]))) +
              "</div>" +
              (num(a.Population) ? '<div class="hd">The market</div><div class="grid">' +
                gRow("People", fmtN(num(a.Population))) +
                gRow("Move a year", fmtN(num(a["Movers Per Year"]))) +
                gRow("Median income", a["Median Income"] != null ? money0(num(a["Median Income"])) : EM) +
                gRow("Home value", a["Home Value"] != null ? money0(num(a["Home Value"])) : EM) +
                gRow("Own their home", a["Owner Share Pct"] != null ? r1(num(a["Owner Share Pct"])) + "%" : EM) +
              "</div>" : "") + "</div>";
          };
          const zipStyle = f => {
            const lvl = zipLvl, a = zipArea(f.properties.z, lvl);
            const band = a ? TIER_BAND(num(a.Tier)) : "grey";
            const fill = fillOf(band, a && num(a["Never A Lead"]) === 1, isFar(a));
            /* a canvas cannot paint an SVG pattern: "no lead yet" reads as a paler tier colour there */
            if (zipCanvas && /^url\(/.test(String(fill.fillColor))) { fill.fillColor = col[band] || col.grey; fill.fillOpacity = .34; }
            return Object.assign({ color: lvl === "City" ? (col[band] || col.grey) : "#8d99a8",
                                   weight: zipCanvas ? 0.3 : lvl === "City" ? 0.6 : 0.45, opacity: lvl === "City" ? .5 : .8, lineJoin: "round" }, fill);
          };
          const ctyPane = m.createPane("apCtyLines");
          ctyPane.style.zIndex = 445; ctyPane.style.pointerEvents = "none";
          /* one state is drawn as SVG (so the hatch for "no lead yet" works); the whole market is
             ~6,000 shapes, so it is drawn on a canvas -- which cannot hatch, so those read pale instead */
          let zipCanvas = false;
          function showZips(st, refit) {
            const lvl = inputs.mapLevel;
            box.classList.add("ap3-busy");
            const one = code => ZIPGEO[code] ? Promise.resolve(ZIPGEO[code])
              : fetch("assets/vendor/geo/zips-" + code + ".json")
                  .then(r => r.ok ? r.json() : Promise.reject(new Error(code + " HTTP " + r.status)))
                  .then(j => (ZIPGEO[code] = j));
            const got = st ? one(st) : Promise.all(SERVICE_AREAS.map(one)).then(all =>
              ({ type: "FeatureCollection", features: [].concat.apply([], all.map(j => j.features || [])) }));
            got.then(gj => {
              if (inputs.mapLevel !== lvl || mapStOf() !== st) return;      // the reader has moved on
              if (zipLayer) { m.removeLayer(zipLayer); zipLayer = null; }
              zipLvl = lvl; zipCanvas = !st;
              const byKey = {};
              zipLayer = L.geoJSON(gj, { style: zipStyle, renderer: zipCanvas ? L.canvas({ padding: 0.4 }) : undefined, onEachFeature: (f, lyr) => {
                const a = zipArea(f.properties.z, lvl);
                const k = lvl === "Zip" ? f.properties.z : (a ? a["Area Key"] : "z" + f.properties.z);
                (byKey[k] = byKey[k] || []).push(lyr);
                lyr.bindTooltip(() => { const az = zipArea(f.properties.z, lvl);
                  return az ? glance(lvl === "Zip" ? az.Zip + " " + (az.City || "") : az.Name + " " + az.State, TIER_BAND(num(az.Tier)), az)
                            : areaTip(null, lvl, f.properties.z); }, { sticky: true, className: "ap2-tipwrap", opacity: 1 });
                lyr.on("click", () => { const az = zipArea(f.properties.z, lvl);
                  if (az) showSide({ kind: "area", level: lvl, key: az["Area Key"] }); });
                lyr.on("mouseover", () => byKey[k].forEach(x => x.setStyle({ weight: 2.2, color: tok("--ink") || "#22303f", opacity: 1 })));
                lyr.on("mouseout", () => byKey[k].forEach(x => zipLayer && zipLayer.resetStyle(x)));
              } }).addTo(m);
              zipLayer._byKey = byKey; zipSt = st;
              ensureHatch();
              if (refit) { if (!st) fitMap(); else { const b = zipLayer.getBounds(); if (b.isValid()) m.fitBounds(b, { padding: [12, 12], animate: false }); } }
              if (box._pendingFocus) { const k = box._pendingFocus; box._pendingFocus = null; box._focusArea(k); }
            }).catch(e => {
              const ls = host.querySelector("#apAreaList");
              if (ls) ls.insertAdjacentHTML("afterbegin", '<div class="ap2-note" style="color:var(--neg)">The ' + esc(st || "whole-market") +
                " zip shapes could not be read (" + esc(e && e.message || "error") + ").</div>");
            }).then(() => box.classList.remove("ap3-busy"));
          }
          box._applyLevel = refit => {
            const lvl = inputs.mapLevel;
            if (lvl === "County") {
              if (zipLayer) { m.removeLayer(zipLayer); zipLayer = null; zipSt = null; }
              if (cntyLines) m.removeLayer(cntyLines);
              if (countyLayer && !m.hasLayer(countyLayer)) countyLayer.addTo(m);
              if (countyLayer) countyLayer.setStyle(countyLayer.options.style);
              [["market", box._mkt], ["spend", box._spend]].forEach(([mode, lyr]) => { if (!lyr) return;
                if (inputs.mapColor === mode) lyr.addTo(m); else m.removeLayer(lyr); });
              if (box._names && !m.hasLayer(box._names)) box._names.addTo(m);
              if (refit) {
                const st = inputs.mapSt;
                if (st && countyLayer) { let b = null;
                  countyLayer.eachLayer(l => { if (l.feature && l.feature.properties.st === st) { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); } });
                  if (b && b.isValid()) m.fitBounds(b, { padding: [12, 12], animate: false });
                } else fitMap();
              }
            } else {
              if (countyLayer && m.hasLayer(countyLayer)) m.removeLayer(countyLayer);
              [box._mkt, box._spend, box._names].forEach(l => { if (l && m.hasLayer(l)) m.removeLayer(l); });
              if (!cntyLines && GEO) cntyLines = L.geoJSON(GEO, { pane: "apCtyLines", interactive: false,
                style: { color: tok("--ink") || "#22303f", weight: 1, opacity: .38, fill: false } });
              if (cntyLines && !m.hasLayer(cntyLines)) cntyLines.addTo(m);
              showZips(mapStOf(), refit || zipSt !== mapStOf() || zipLvl !== lvl);
            }
          };
          /* a new base toggled: refresh the county rows the fills and sheets read, then restyle */
          box._restyle = () => {
            const R2 = countyRowsFor();
            Object.keys(byKey).forEach(k => delete byKey[k]);
            R2.forEach(r => { byKey[r.st + "|" + ckey(r.county)] = r; });
            if (countyLayer && m.hasLayer(countyLayer)) countyLayer.setStyle(countyLayer.options.style);
            if (zipLayer) zipLayer.setStyle(zipStyle);
            if (box._nbRings) box._nbRings();
          };
          /* the ranked list's click: frame the area and open its sheet */
          box._focusArea = key => {
            const lvl = inputs.mapLevel;
            let lyrs = [];
            if (lvl === "County" && countyLayer) {
              const i = key.indexOf("|"), st = key.slice(0, i), ck = ckey(key.slice(i + 1));
              countyLayer.eachLayer(l => { if (l.feature && l.feature.properties.st === st && l.feature.properties.key === ck) lyrs.push(l); });
            } else if (zipLayer && zipLayer._byKey) {
              lyrs = zipLayer._byKey[key] || [];
            } else { box._pendingFocus = key; return; }
            if (!lyrs.length) return;
            let b = null;
            lyrs.forEach(l => { const lb = l.getBounds(); b = b ? b.extend(lb) : L.latLngBounds(lb.getSouthWest(), lb.getNorthEast()); });
            m.fitBounds(b, { padding: [40, 40], maxZoom: lvl === "Zip" ? 12 : 10, animate: false });
            lyrs.forEach(l => l.fire("mouseover"));
            setTimeout(() => lyrs.forEach(l => l.fire("mouseout")), 2600);
            lyrs[0].openTooltip(b.getCenter());
          };
          if (inputs.mapLevel !== "County") box._applyLevel(true);
          else if (inputs.mapColor !== "tier") box._applyLevel(false);

          /* the base's full sheet for the right panel (the hover is only a glance) */
          box._baseSheet = lbl => { const b = B.have.concat(B.coverage).find(x => (x.kind === "have" ? x.name : x.label) === lbl);
            return b ? baseTip(b) : ""; };
          /* A YES BASE SHOWS ITS REACH: the 50-mile ring inside which it brings counties into reach */
          const nbRings = L.layerGroup().addTo(m);
          box._nbRings = () => { nbRings.clearLayers();
            NB_CANDS.filter(c => NB_ON[c.label]).forEach(c => L.circle([c.la, c.lo], { pane: "apRings", radius: 50 * MI_PER_M,
              interactive: false, color: col.t1, weight: 2, dashArray: "6 5", fillColor: col.t1, fillOpacity: .06 }).addTo(nbRings));
            if (PLAN) PLAN.groups.forEach(g => g.sites.forEach(x => { if (x.la && x.fm > 0)
              L.marker([x.la, x.lo], { icon: flag("cover", x.name.replace(/ \(.*$/, "") + " · " + fmtN(x.fm)), interactive: false, zIndexOffset: 450 }).addTo(nbRings); }));
            /* the picked point keeps its pin whether it is Yes or No */
            NB_CANDS.filter(c => c.custom).forEach(c => L.circleMarker([c.la, c.lo], { radius: 8, interactive: false,
              color: "#fff", weight: 3, fillColor: tok("--ink") || "#22303f", fillOpacity: 1 }).addTo(nbRings)); };
          /* THE FOUND PLACE, LIT UP: framed, ringed until the next search, and -- when the map is
             showing that level -- its own outline flashed by the list's focus */
          const hlLayer = L.layerGroup().addTo(m);
          box._highlight = a => { hlLayer.clearLayers(); if (!a) return;
            const ll = [num(a.Latitude), num(a.Longitude)];
            if (a.Level === inputs.mapLevel && box._focusArea) box._focusArea(a["Area Key"]);
            if (a.Level !== inputs.mapLevel || !m.getBounds().contains(ll))
              m.setView(ll, a.Level === "County" ? 9 : a.Level === "City" ? 11 : 12, { animate: false });
            L.circleMarker(ll, { radius: 16, interactive: false, className: "ap3-hl", color: tok("--ink") || "#22303f", weight: 3, fill: false }).addTo(hlLayer);
            L.circleMarker(ll, { radius: 4, interactive: false, color: "#fff", weight: 2, fillColor: tok("--ink") || "#22303f", fillOpacity: 1 }).addTo(hlLayer); };
          /* the click that places it: an area under the cursor has just opened its own sheet, so the
             picked base's sheet replaces it */
          m.on("click", e => { if (!PICK) return;
            PICK = false; box.classList.remove("ap3-picking");
            if (PLAN) { planEnd(); SC.kind = null; SC.targets = null; }
          if (nbPickAt(e.latlng.lat, e.latlng.lng)) { SIDE = { kind: "pick" }; nbRepaint(); } });
          box._nbRings();
          box._fit = pts;
          box._map = m;
          fitMap();                       // a no-op while the pane is hidden; showPane calls it again
        }));
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
      const METH_SHORT = m => ({ mkt: "marketing trend", growth: "last season × growth", avg3: "3-season average", flat: "flat" })[m] || String(m || "");
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
            '<div class="ap2-d"><div class="dq">How many crews, and where?</div><div class="dh"><b>' + N.tot.peak + " foremen</b> at the peak · " +
              (N.tot.haveIsRegister ? '<span title="Active foremen on the crew register today. ' + fmtN(N.tot.ranLast) + ' ran last season; the ones since cancelled are not counted as people you have.">' + fmtN(N.tot.have) + " on the register today</span>"
                                    : "have " + fmtN(N.tot.have)) +
              (N.tot.hire ? ' · <span class="ap2-hire">hire +' + N.tot.hire + "</span>" : ' · <span class="ap2-ok">covered</span>') +
              (() => { const spare = N.pools.filter(q => q.have > q.peak); return N.tot.hire && spare.length
                ? ' <span style="font-size:12px">· ' + spare.map(q => (q.have - q.peak) + " spare in " + esc(q.label)).join(", ") + " — a pool's spare crews do not cover another depot</span>" : ""; })() + "</div>" +
              '<table class="ap2-dt"><thead><tr><th>Depot pool</th><th class="num">Need</th><th class="num">Have</th><th class="num">Hire</th><th>By</th></tr></thead><tbody>' + crewLines + "</tbody></table>" +
              (N.tot.crewFloored ? '<div class="dx"><b>The crew is not planned below last season.</b> On the ' + esc(METH_SHORT(N.method)) +
                " forecast alone the peak would need <b>" + fmtN(N.tot.peakFc) + "</b> foremen, fewer than the month itself ran last year. Every forecast method came in under what last season actually did, so the money follows the forecast and the crew follows the busier of the two.</div>" : "") +
              (N.tot.haveIsRegister && N.tot.ranLast !== N.tot.have ? '<div class="dx"><b>Have</b> is the crew register today (' + fmtN(N.tot.have) + " active foremen). " +
                fmtN(N.tot.ranLast) + " ran last season — that figure sizes the need, but the ones no longer active are not people you can put on a truck in May.</div>" : "") +
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
            a: "Census and Zillow, per city: income on <b>" + fmtN(has("Median Income")) + "</b>, home value on <b>" + fmtN(has("Home Value")) + "</b>, and the share of people who moved in the last year on <b>" + fmtN(has("Mover Rate")) + "</b>. Wealth tier ranks every city into fifths. Not an opinion from a chatbot — published statistics.",
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
               ". The bases are warehouses with storage in them, so the question is where to ADD one, not where to move one — the map carries that.",
            go: "apMap" },
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
            '</div></div>' +
          tabsHtml() +
          /* MAIN VARIABLES: what the analysis runs on -- the three dials and the forecast that every
             crew, desk and budget number is sized from. They used to sit above every tab and at the
             bottom of the plan tab; he asked for them first, in one place. */
          pane("vars", "What this analysis runs on. Change a number here and every tab follows, the Map included.",
            assumeHtml() +
            card("The jobs forecast — " + (FC.year || "the coming one"), "Jobs by state and month, and the method behind them",
               "Where the season's work is forecast to fall. The crew, the desk and the budget are all sized from these jobs — change the method here and they follow.",
               '<div id="apNext" style="overflow-x:auto">' + nextHtml() + "</div>")) +
          pane("decide", "The three answers for Season " + esc(String(FC.year || "")) + ", and Giga's nine questions with what the data says today.",
            '<div id="apDecide">' + decisionsHtml() + "</div>" +
            (model.expansion ? card("Beside the plan \u2014 the expansion we decided",
               "Maryland and Pennsylvania: what it adds, what it needs, and what it is worth",
               "Kept out of every total above on purpose. The plan is what the history supports; this is what we have chosen to go and win.",
               '<div id="apXp">' + expansionHtml() + "</div>", "apXpCard") : "") +
            /* one Maryland block, right under the expansion card (2026-09-24): its clock and its test */
            (model.geo_test || CLK ? card("Maryland — the clock and the test",
               "Is Maryland’s 15 real? The Montgomery listing test",
               "Maryland’s capture already rose without a yard, in steps. This is where it stands, and the pre-registered test that decides the Montgomery yard.",
               '<div id="apMd">' + mdHtml() + "</div>", "apMdCard") : "") +
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
          card("Season budget — " + (FC.year || "the coming one"), "Revenue, the job and truck cost, and marketing (post cards inside it), per state",
               "The whole season in one table: what the jobs bring, what they cost to run, what the leads cost to buy. Net is before overhead.",
               '<div id="apBudget" style="overflow-x:auto">' + budgetHtml() + "</div>")) +
          /* THE MAP TAB IS THE ONE THAT GETS PRESENTED (2026-09-29): no lede, no cards of prose -- the
             plan, what to do, the map and its list; the working sits in one closed section inside. */
          pane("map", "", '<div id="apMap" class="ap3-map">' + mapHtml() + "</div>") +
          pane("cities", "Which cities produce the work, this year to date, all companies — this pane does not follow the period picker. Click a state anywhere to focus the page on it.",
            '<div id="apBandB">' + bandBHtml() + "</div>" +
            card("Push or cut — the opportunity rank", "Cities scored on return per ad dollar, movers, wealth and untapped leads — weights are yours",
               "Where to add leads, and where the money already spent works least. The rank follows the window, focus and minimum leads above.",
               '<div id="apRank">' + rankHtml() + "</div>")) +
          pane("capacity", "A what-if on a past period: what a foreman table of this size could have run, and where the demand was. <b>Not the " + esc(String(FC.year || "")) + " plan</b> — that one is priced on leads per job with the one-month lag; this one uses the period's own booking rates.",
          '<div class="ap2-band" style="margin-top:0;border-top:0;padding-top:0"><span class="k">Capacity check</span><h2>What ' + fmtN(c.totCur) + ' foremen could have run in ' + esc(P.label) + '</h2>' +
          '<span class="clock">a what-if on a past period — not the ' + esc(String(FC.year || "")) + ' plan</span></div>' +
          controlBar() +
          '<div class="panel ap2-hero"><div id="apHero">' + heroHtml(c) + "</div></div>" +
          card("The demand", esc(P.label) + " by area",
               "The full bar is leads (counted where the move starts, on create date); the solid green inside it is what got booked — <b>a closing exists</b>. Lost = qualified, never booked. Click a state to focus the page on it.",
               '<div id="apDemand">' + demandHtml() + "</div>") +
          card("The plan", "Base capacity — foreman quantity, plus the additions",
               "Rows are service areas (NY is worked from the NJ base). <b>Worked (measured)</b> is the distinct foremen on closings in the period, so the typed cell has its measured counterpart on the same row. Where two companies run a state, each has its own editable line. Change any cell; the hero follows. Edits stay in this browser.",
               '<div id="apBase" style="overflow-x:auto">' + planHtml(c) + "</div>") +
          card("Where it leaks", "The counties that lose the most",
               "Top county losses in " + esc(P.label) + (inputs.focus ? " for " + esc(inputs.focus) : "") + " — where extra sales attention or pricing would bite first.",
               '<div id="apLeak">' + leakHtml() + "</div>")) +
          pane("whatif", "Move a base, buy more of the market, change the budget or the crew \u2014 and see Season " + esc(String(FC.year || "")) + "\u2019s net move. Every lever carries what was measured about it; nothing here is saved to the warehouse.",
            card("What if", "The plan against a scenario you build",
                 "The levers you asked for, with the measurement behind each one printed beside it.",
                 '<div id="apWhatIf">' + whatIfHtml() + "</div>")) +
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
               '<div class="ap2-note" style="line-height:1.75" id="apMethod">Measured: everything except the foreman cells and any number you type. The plan seeds from the distinct foremen who worked last season per state and company (or his 19-August table, or the 28-crew aim). Utilization bridges foremen to a month of jobs against the ' + DAYS_PER_MONTH + '-day ceiling and re-seeds when the period changes. <b>Booked = a closing exists</b> on both halves of the page (his call). Band A geography is where the move starts, in the closing\'s own state; Band B places a job by the lead\'s pickup city and counts last-encounter closings only — so the two job counts will not tie. Band A obeys the period picker; Band B is always this year to date. Miles are straight-line. Marketing $/lead is company-wide.</div>')) +
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
        wireControls(); wireFocus(); mountCityBar(); repaintCity(); wireWs(); wireMethod(); wireRank(); wireAsks(); wireKw(); wireFormula(); wireWhatIf(); wireXp(); wireMapColor(); wireNewBases(); enhanceTables(); wireMap();
        // last, because paint() re-runs on every period, seed and focus change and must not drop the reader
        wireTabs(); wirePdf(); showPane(bootTab || inputs.tab, true); bootTab = null;
      }
      function repaintBudget() { const el = host.querySelector("#apBudget"); if (el) { el.innerHTML = budgetHtml(); enhanceTables(); } }
      /* every card the next-season numbers feed, together — a method click, a dial and a foreman cell
         all go through here, so the decisions band can never disagree with the card it quotes. None of
         the typed inputs live inside these nodes, so the cursor keeps its place. */
      function repaintPlan() {
        /* the What-if multiplier is solved against the CURRENT dials, method and bases, so it is
           re-solved before anything below reads nextCalc() */
        scSolve();
        const dc = host.querySelector("#apDecide"); if (dc) dc.innerHTML = decisionsHtml();
        const fp = host.querySelector("#apFull"); if (fp) fp.outerHTML = fullPlanHtml();
        const nx = host.querySelector("#apNext"); if (nx) nx.innerHTML = nextHtml();
        /* the formula and the map's chips quote the same plan, so they move with it (they did not) */
        const fm = host.querySelector("#apFormula"); if (fm && !fm.contains(document.activeElement)) { fm.innerHTML = formulaHtml(); wireFormula(); }
        const ch = host.querySelector("#apChips"); if (ch) ch.innerHTML = fleetChips();
        const xp = host.querySelector("#apXp"); if (xp) { xp.innerHTML = expansionHtml(); wireXp(); }
        /* the Maryland block reads only the model, so a plan edit cannot change it; repainted anyway so
           its chip and tables can never lag the expansion card above it */
        const md = host.querySelector("#apMd"); if (md) md.innerHTML = mdHtml();
        repaintBudget(); wireMethod(); wireAsks(); enhanceTables();
        /* the Map tab quotes the same plan: a dial or a forecast method changed on Main variables
           has to reach its numbers too */
        if (host.querySelector("#apKpis")) repaintMapTab();
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
        if (t.dataset.rank || t.dataset.own) return;     // the opportunity-rank weights and the formula's X have their own handlers
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
