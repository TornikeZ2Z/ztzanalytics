/* DEMAND ANALYSIS — what the market asked us to move, by MOVE DATE.
 *
 * READ THE BASIS FIRST. Every other lead number in this portal counts a lead on the day it CAME
 * IN. This page counts it on the day the customer wants to MOVE. A lead created in March for a
 * July Saturday is March in the funnel and July here, so the two totals will never agree and
 * are not supposed to. That is why the basis is stamped on the page, on every card and in the
 * tooltip: the one failure mode that matters here is somebody trying to reconcile this with the
 * Lead Funnel and concluding one of them is broken.
 *
 * DEMAND IS WHAT WAS ASKED FOR. Every lead aimed at a date counts, booked or not — a Saturday
 * with forty enquiries and six confirmations had forty units of demand. The booked subset is
 * drawn ON TOP of it (the blue foot of each cell) rather than instead of it, because the
 * difference between the two is the whole question.
 *
 * IT IS NOT A PRICING TOOL (Tornike, 2026-08-06: no seasonality table, no multipliers, none
 * wanted). The last section puts quote against cubic feet across demand levels and stops there.
 * It states no rule and reaches no verdict — the judgement about pricing is his, and this page
 * exists to give him the picture to make it on.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.demand_move_date) {
    // PAYLOAD CONTRACT: a column missing from this list never arrives, however well the page
    // is written. It is also the whole download, one row per date per book — so the mart's
    // `Month` / `Weekday` / `Avg CF` / `Top State` columns are deliberately NOT here. The
    // calendar has to do real date arithmetic anyway, and an average this page can divide out
    // of two numbers it already has is a column it should not be paying to ship.
    RS.DATASETS.demand_move_date = {
      table: "mart_demand_move_date",
      cols: ["Move Date", "Company", "Leads", "Qualified", "Booked",
             "Total CF", "CF Leads", "Booked CF",
             "Avg Quote", "Quote Leads", "Booked Closing Total",
             "Avg Crew", "Crew Leads", "Avg Trucks", "Truck Leads",
             "Priced Leads", "Priced Quote", "Priced CF",
             "Avg Lead Days", "Lead Days Leads",
             "LD Leads", "Local Leads", "Service Unknown",
             "Size Small", "Size Mid", "Size Big", "Size Other",
             "Service Mix", "Size Mix", "CF Mix", "State Mix",
             "Top Source", "Top Source Leads"],
      dateCols: { "Move Date": "Move Date" }, defaultDate: "Move Date",
    };
  }
  // THE PER-LEAD COMPANION (2026-08-20): status/source/size filters, the leads behind a
  // clicked day, and the after-the-day-was-full count all need individual leads. Loaded
  // lazily in the background — the default view stays on the cheap aggregate.
  if (window.RS && RS.DATASETS && !RS.DATASETS.demand_leads) {
    RS.DATASETS.demand_leads = {
      table: "mart_demand_leads",
      cols: ["Move Date", "Company", "Job No", "Customer", "Create Date", "Created NY",
             "Status", "Source", "Size", "Service", "Moving Type", "CF Range", "State",
             "CF", "Quote", "Closing Total", "Crew", "Trucks"],
      dateCols: { "Move Date": "Move Date" }, defaultDate: "Move Date",
    };
  }
})();

registerPage({
  id: "demand-analysis",
  title: "Demand Analysis",
  subtitle: "Every lead aimed at each MOVE DATE — the demand the market asked for, with what we booked laid over it.",
  datasets: [],

  render: function (host) {
    // window.RSC is the real global (assets/rs-components.js:3). This read RS_COMPONENTS,
    // which has never existed, so `|| {}` handed every one of these pages an EMPTY object
    // and each helper quietly fell through to its local fallback. Nothing looked wrong
    // until `collapsible` -- the one member with no fallback -- was called, and Packing
    // Control and Storage Control died with "RSC.collapsible is not a function".
    const RSC = window.RSC || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

    const nn = v => (v == null || v === "" || isNaN(v)) ? null : +v;
    const num = v => nn(v) || 0;
    const fmtN = v => Math.round(num(v)).toLocaleString();
    const fmt1 = v => (Math.round(num(v) * 10) / 10).toLocaleString(undefined,
      { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const money0 = v => "$" + Math.round(num(v)).toLocaleString();
    const money2 = v => "$" + (Math.round(num(v) * 100) / 100).toLocaleString(undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // an unmeasured value renders as a dash, never as a zero
    const dash = (v, f) => (v == null ? "—" : f(v));
    const pct = v => (v == null ? "—" : Math.round(v * 100) + "%");

    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONL = ["January", "February", "March", "April", "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const TODAY = new Date().toISOString().slice(0, 10);

    // The three things the calendar can be shaded by. Booked is deliberately available as a
    // shading too — "where did the demand actually turn into work" is a different picture from
    // "where was the demand", and flipping between them beats guessing from one overlay.
    const METRIC = {
      leads: { lab: "Leads asked", get: d => d.leads, fmt: fmtN, noun: "leads" },
      cf: { lab: "Cubic feet asked", get: d => d.cf, fmt: fmtN, noun: "cu ft" },
      booked: { lab: "Booked", get: d => d.booked, fmt: fmtN, noun: "booked" },
    };

    const S = window.__DEM || (window.__DEM = {
      rows: null, year: null, co: "", metric: "leads", day: null, err: "",
      // the per-lead layer: filters, the lazy rows, and the capacity input (his #5)
      status: "", src: "", size: "", leads: null, leadsLoading: false, leadsErr: "",
      cap: +(localStorage.getItem("ztzDemandCap") || 10) || 10,
      // the breakdown panel's view + last-year compare, remembered per viewer (2026-10-07)
      view: (() => { try { return localStorage.getItem("ztzDemandView") || "wd"; } catch (e) { return "wd"; } })(),
      cmp: (() => { try { return localStorage.getItem("ztzDemandCmp") !== "0"; } catch (e) { return true; } })(),
      wdMode: "wd",
    });

    host.innerHTML = '<style id="dmCss">'
      + ".dm{font-variant-numeric:tabular-nums}"
      // ---- the basis banner: the one thing nobody may miss ------------------------------
      + ".dm-basis{display:flex;gap:12px;align-items:flex-start;background:var(--brand-glow);"
      + "border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:13px;"
      + "padding:12px 16px;margin-bottom:14px}"
      + ".dm-basis .bt{font-size:9.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;"
      + "color:var(--brand-d);background:var(--panel);border-radius:999px;padding:5px 10px;white-space:nowrap}"
      + "body.rs-app:not(.light) .dm-basis .bt{color:var(--brand)}"
      + ".dm-basis p{margin:0;font-size:12.5px;line-height:1.65;color:var(--muted);max-width:112ch}"
      + ".dm-basis b{color:var(--ink)}"
      + "details.dm-basis{display:block}"
      + ".dm-panel .dm-card{border:0;padding:0;margin:0;background:transparent;box-shadow:none}"
      + ".dm-sw{margin:0 0 14px;flex-wrap:wrap}"
      + ".dm-ph{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:4px}"
      + ".dm-ph h3{margin:0}"
      + ".dm-sub{margin-left:6px}"
      + ".dm-cmp{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted);cursor:pointer}"
      + ".dm-note1{font-size:12.5px;color:var(--muted);margin:2px 0 12px}"
      + ".dm-more{font-size:12px;color:var(--muted);margin:-6px 0 12px}"
      + ".dm-more summary{cursor:pointer;color:var(--brand);font-weight:600}"
      + ".dm-more p{margin:6px 0 0;line-height:1.6;max-width:110ch}"
      + ".dm-r{display:grid;grid-template-columns:minmax(110px,180px) minmax(80px,1fr) 120px 96px 58px;gap:12px;align-items:center;padding:5px 0;font-size:13px;border-bottom:1px solid var(--line-2)}"
      + ".dm-r:last-of-type{border-bottom:0}"
      + ".dm-r .k{font-weight:600}"
      + ".dm-r .t{position:relative;height:12px;border-radius:4px;background:var(--panel-2)}"
      + ".dm-r .t i{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:rgba(63,125,32,.35)}"
      + ".dm-r .t em{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--brand)}"
      + ".dm-r .t b{position:absolute;top:-4px;bottom:-4px;width:2px;margin-left:-1px;background:var(--ink);opacity:.6;border-radius:1px}"
      + ".dm-r .n{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}"
      + ".dm-r .n small{font-weight:500;color:var(--faint);margin-left:6px}"
      + ".dm-r .r{text-align:right;color:var(--muted);font-size:12px}"
      + ".dm-r .d{text-align:right;font-size:12px;font-weight:700;color:var(--faint)}"
      + ".dm-r .d.up{color:var(--pos)}.dm-r .d.dn{color:var(--neg)}"
      + ".dm-rsep{height:10px}"
      + ".dm-leg{font-size:11.5px;color:var(--faint);margin:10px 0 0;display:flex;align-items:center;gap:6px}"
      + ".dm-leg .tk{display:inline-block;width:2px;height:12px;background:var(--ink);opacity:.6}"
      + "details.dm-basis summary{cursor:pointer;list-style:none;font-size:12.5px;color:var(--muted);line-height:1.6}"
      + "details.dm-basis summary::-webkit-details-marker{display:none}"
      + "details.dm-basis summary .bt{margin-right:10px}"
      + "details.dm-basis summary u{color:var(--brand);text-decoration:none;font-weight:600;margin-left:6px;white-space:nowrap}"
      + "details.dm-basis[open] summary u{display:none}"
      + "details.dm-basis p{margin-top:8px}"
      + ".dm-sz{border-collapse:separate;border-spacing:4px;width:100%;font-size:12px}"
      + ".dm-sz th{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:2px 6px;text-align:center}"
      + ".dm-sz th.rh{text-align:right;font-size:12px;letter-spacing:0;text-transform:none;color:var(--ink);font-weight:700;white-space:nowrap}"
      + ".dm-sz td.c{text-align:center;padding:9px 6px;border-radius:7px;background:rgba(63,125,32,var(--h,0));min-width:120px}"
      + ".dm-sz td.c b{display:block;font-size:15px;font-variant-numeric:tabular-nums}"
      + ".dm-sz td.c small{color:var(--muted);font-size:11px}"
      + ".dm-sz td.c em{display:block;font-style:normal;font-size:11px;color:var(--ink);opacity:.8;margin-top:2px}"
      + ".dm-sz td.nil{color:var(--faint);background:var(--panel-2)}"
      + ".dm-sz td.tot{background:var(--panel);border:1px solid var(--line-2)}"
      + ".dm-sz tr.ft th.rh{color:var(--muted)}"
      + ".dm-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}"
      + ".dm-chip{display:flex;gap:7px;align-items:baseline;border:1px solid var(--line-2);border-radius:999px;padding:5px 12px;font-size:12px}"
      + ".dm-chip span{color:var(--muted)}.dm-chip small{color:var(--faint)}"
      // ---- toolbar: THE SHARED KIT (rs.css) -----------------------------------------
      // .rs-bar / .rs-fld / .rs-seg / .rs-sel / .rs-num / .rs-hint used to live here as
      // dm-* copies that had quietly drifted from every other page's version of the same
      // control. They are defined once in assets/rs.css now; nothing page-specific left.
      + ".dm-lead-tbl td{white-space:nowrap}"
      // ---- kpis --------------------------------------------------------------------------
      + ".dm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:11px;margin-bottom:16px}"
      + ".dm-k{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".dm-k b{display:block;font-size:23px;font-weight:750;letter-spacing:-.5px;line-height:1.15}"
      + ".dm-k span{display:block;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".dm-k small{display:block;font-size:11px;color:var(--muted);margin-top:2px}"
      + ".dm-k.blue b{color:var(--blue)}"
      // ---- cards -------------------------------------------------------------------------
      + ".dm-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px 17px 17px;margin-bottom:14px}"
      + ".dm-h{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;margin-bottom:4px}"
      + ".dm-h h3{margin:0;font-size:14.5px;font-weight:750;letter-spacing:-.2px;color:var(--ink)}"
      + ".dm-h .tag{font-size:8.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;"
      + "color:var(--brand-d);background:var(--brand-glow);border-radius:999px;padding:3px 8px}"
      + "body.rs-app:not(.light) .dm-h .tag{color:var(--brand)}"
      + ".dm-h .rt{margin-left:auto;font-size:11.5px;color:var(--faint)}"
      + ".dm-note{font-size:11.5px;color:var(--faint);line-height:1.65;max-width:112ch;margin:0 0 12px}"
      + ".dm-note b{color:var(--muted)}"
      + ".dm-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}"
      // ---- calendar heatmap ---------------------------------------------------------------
      /* Twelve months want a factor of twelve, not "as many as fit". auto-fit at 196px gave
         nine across on a 2560px screen, so Oct/Nov/Dec dropped to a third-width orphan row
         under a full one -- a calendar that looks broken rather than annual. Six across (6x2)
         above 1500px, four (4x3) on a laptop, three below that: every row full, always. */
      + ".dm-cal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}"
      + "@media(min-width:1050px){.dm-cal{grid-template-columns:repeat(4,minmax(0,1fr))}}"
      + "@media(min-width:1500px){.dm-cal{grid-template-columns:repeat(6,minmax(0,1fr))}}"
      + ".dm-mon .ml{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--muted);margin-bottom:6px}"
      + ".dm-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}"
      + ".dm-wk .wh{font-size:8.5px;font-weight:700;color:var(--faint);text-align:center;padding-bottom:2px}"
      + ".dm-c{position:relative;aspect-ratio:1;border-radius:4px;background:var(--panel-2);"
      + "border:1px solid var(--line);overflow:hidden;cursor:pointer}"
      + ".dm-c.pad{background:none;border:0;cursor:default}"
      + ".dm-c .lv{position:absolute;inset:0;background:var(--brand)}"
      + ".dm-c .bk{position:absolute;left:0;right:0;bottom:0;background:var(--blue);opacity:.85}"
      + ".dm-c.ahead{border-style:dashed;border-color:var(--line-2)}"
      + ".dm-c.on{outline:2px solid var(--ink);outline-offset:1px;z-index:2}"
      + ".dm-c:hover{outline:2px solid var(--brand-d);outline-offset:1px;z-index:2}"
      + ".dm-leg{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:11px;color:var(--faint);margin-top:13px}"
      + ".dm-leg .sw{display:inline-flex;gap:3px;align-items:center;vertical-align:middle}"
      + ".dm-leg .sw i{width:13px;height:13px;border-radius:3px;background:var(--brand);display:inline-block;"
      + "border:1px solid var(--line)}"
      + ".dm-leg .bl{width:13px;height:6px;border-radius:2px;background:var(--blue);display:inline-block}"
      // ---- tooltip -------------------------------------------------------------------------
      + ".dm-tt{position:fixed;z-index:60;pointer-events:none;display:none;background:var(--panel);"
      + "border:1px solid var(--line-2);border-radius:11px;box-shadow:var(--shadow);padding:10px 13px;"
      + "font-size:12px;min-width:190px;max-width:290px}"
      + ".dm-tt.on{display:block}"
      + ".dm-tt .d{font-weight:800;font-size:12.5px;margin-bottom:5px}"
      + ".dm-tt .r{display:flex;justify-content:space-between;gap:14px;color:var(--muted);line-height:1.75}"
      + ".dm-tt .r b{color:var(--ink);font-weight:700}"
      + ".dm-tt .f{margin-top:6px;font-size:10.5px;color:var(--faint);border-top:1px solid var(--line);padding-top:5px}"
      // ---- tables ---------------------------------------------------------------------------
      // dm-t is now a NARROW ADJUSTMENT ON .rs-table, not a table of its own: these are
      // numeric tables, so cells are right-aligned by default and the first column is the
      // label. Everything else -- size, spacing, header, hover, borders -- comes from the kit.
      // It used to restate the type and the padding too, which meant this page did NOT loosen
      // with the kit on 2026-08-24 and was the only table left at the old density.
      + ".dm-t th{text-align:right;white-space:nowrap}"
      + ".dm-t th:first-child,.dm-t td:first-child{text-align:left}"
      + ".dm-t td{text-align:right;white-space:nowrap}"
      + ".dm-t td.nm{font-weight:700;color:var(--ink)}"
      + ".dm-scroll{overflow-x:auto}"
      // ---- distribution bars -----------------------------------------------------------------
      + ".dm-bars{display:flex;flex-direction:column;gap:7px}"
      + ".dm-b{display:grid;grid-template-columns:minmax(96px,1.2fr) minmax(0,3fr) auto;gap:10px;align-items:center;font-size:12px}"
      + ".dm-b .lb{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".dm-b .tr{position:relative;height:9px;border-radius:5px;background:var(--panel-2);overflow:hidden}"
      + ".dm-b .tr i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--brand)}"
      + ".dm-b .vv{font-weight:700;white-space:nowrap}"
      + ".dm-b .vv small{color:var(--faint);font-weight:500;margin-left:5px}"
      // ---- weekday x month matrix ---------------------------------------------------------
      // no width, so the table sized to its content -- a ~655px matrix floating in a 2054px
      // card with 1400px of the card left blank. Full width, and a bigger cell floor so the
      // extra goes to every column evenly instead of the last one taking it all.
      + ".dm-mx{border-collapse:separate;border-spacing:3px;font-size:11.5px;width:100%}"
      + ".dm-mx th{font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:2px 4px}"
      + ".dm-mx td{position:relative;text-align:center;padding:7px 4px;border-radius:6px;min-width:90px;"
      + "font-weight:700;color:var(--ink);background:var(--panel-2)}"
      + ".dm-mx td .lv{position:absolute;inset:0;border-radius:6px;background:var(--brand)}"
      + ".dm-mx td span{position:relative}"
      + ".dm-mx td.tot{background:var(--panel);border:1px solid var(--line-2);font-weight:800}"
      + ".dm-mx th.rh{text-align:right}"
      // ---- day detail -----------------------------------------------------------------------
      + ".dm-day{background:var(--panel-2);border:1px solid var(--line-2);border-radius:12px;padding:13px 15px;margin-top:14px}"
      + ".dm-day .dh{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin-bottom:9px}"
      + ".dm-day .dh b{font-size:14px;font-weight:800}"
      + ".dm-day .dh span{font-size:11.5px;color:var(--muted)}"
      + ".dm-day .dh button{margin-left:auto;font-family:inherit;font-size:11px;font-weight:700;"
      + "padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer}"
      + ".dm-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(142px,1fr));gap:8px}"
      + ".dm-f{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 11px}"
      + ".dm-f .l{font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".dm-f .v{font-size:13.5px;font-weight:750;margin-top:2px}"
      + ".dm-f .s{font-size:10.5px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis}"
      + ".dm-empty{padding:38px;text-align:center;color:var(--faint);font-size:13.5px;background:var(--panel);"
      + "border:1px dashed var(--line-2);border-radius:14px}"
      + "@media(max-width:700px){.dm-cal{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}"
      /* DESIGN V2 ("Calm finance"). Old rules untouched; these ride on body.rs-app.light.v2. */
      + "body.rs-app.light.v2 .dm-basis{background:var(--blue-bg);border:1px solid #DCEFB0;border-radius:10px;padding:12px 16px}"
      + "body.rs-app.light.v2 .dm-basis .bt{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:#2F6316;background:#FFFFFF;border:1px solid #DCEFB0;border-radius:6px;padding:3px 8px}"
      + "body.rs-app.light.v2 .dm-basis p{font-size:13.5px;line-height:1.6}"
      + "body.rs-app.light.v2 .dm .rs-seg{border-radius:8px;background:#FFFFFF;border-color:var(--line-2)}"
      + "body.rs-app.light.v2 .dm .rs-seg button{font-weight:600}"
      + "body.rs-app.light.v2 .dm .rs-seg button.on{background:#14301F;color:#FFFFFF;font-weight:600}"
      + "body.rs-app.light.v2 .dm .rs-fld>span{font-size:12.5px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--faint)}"
      + "body.rs-app.light.v2 .dm .rs-hint .em{color:var(--brand-d);font-weight:600}"
      + "body.rs-app.light.v2 .dm-kpis{gap:12px}"
      + "body.rs-app.light.v2 .dm-k{border-radius:10px;padding:14px 16px}"
      + "body.rs-app.light.v2 .dm-k b{font-size:clamp(20px,1.25vw,24px);font-weight:600;letter-spacing:-.3px}"
      + "body.rs-app.light.v2 .dm-k span{font-size:13px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted);margin-top:4px}"
      + "body.rs-app.light.v2 .dm-k small{font-size:12.5px;color:var(--faint)}"
      + "body.rs-app.light.v2 .dm-card{border-radius:10px;padding:16px 18px 18px;margin-bottom:16px}"
      + "body.rs-app.light.v2 .dm-h h3{font-size:15px;font-weight:600;letter-spacing:0}"
      + "body.rs-app.light.v2 .dm-h .tag{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:#2F6316;background:var(--blue-bg);border-radius:6px;padding:2px 8px}"
      + "body.rs-app.light.v2 .dm-h .rt{font-size:12.5px}"
      + "body.rs-app.light.v2 .dm-note{font-size:13px;line-height:1.6}"
      + "body.rs-app.light.v2 .dm-mon .ml{font-size:13px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--ink)}"
      + "body.rs-app.light.v2 .dm-wk .wh{font-size:12px;font-weight:500}"
      + "body.rs-app.light.v2 .dm-c .lv{background:#65A30D}"
      + "body.rs-app.light.v2 .dm-c .bk{background:#14301F;opacity:1}"
      + "body.rs-app.light.v2 .dm-c:hover{outline-color:#14301F}"
      + "body.rs-app.light.v2 .dm-leg{font-size:12.5px}"
      + "body.rs-app.light.v2 .dm-leg .sw i{background:#65A30D}"
      + "body.rs-app.light.v2 .dm-leg .bl{background:#14301F}"
      + "body.rs-app.light.v2 .dm-tt{background:#0F172A;border:0;border-radius:8px;box-shadow:0 8px 24px rgba(15,23,42,.18);color:#FFFFFF;font-size:12.5px}"
      + "body.rs-app.light.v2 .dm-tt .d{font-weight:600;font-size:13px}"
      + "body.rs-app.light.v2 .dm-tt .r{color:#CBD5E1}"
      + "body.rs-app.light.v2 .dm-tt .r b{color:#FFFFFF;font-weight:600}"
      + "body.rs-app.light.v2 .dm-tt .f{font-size:12px;color:#94A3B8;border-top-color:#334155}"
      + "body.rs-app.light.v2 .dm-t td.nm{font-weight:600}"
      + "body.rs-app.light.v2 .dm-t td.nm div{font-size:12px!important}"
      + "body.rs-app.light.v2 .dm-b{font-size:13px}"
      + "body.rs-app.light.v2 .dm-b .tr i{background:var(--brand)}"
      + "body.rs-app.light.v2 .dm-b .vv{font-weight:600}"
      + "body.rs-app.light.v2 .dm-mx{font-size:12.5px}"
      + "body.rs-app.light.v2 .dm-mx th{font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--muted)}"
      + "body.rs-app.light.v2 .dm-mx td{font-weight:500}"
      + "body.rs-app.light.v2 .dm-mx td .lv{background:#65A30D}"
      + "body.rs-app.light.v2 .dm-mx td.tot{background:#F8FAFC;border-color:var(--line);font-weight:600}"
      + "body.rs-app.light.v2 .dm-day{border-radius:10px;border-color:var(--line)}"
      + "body.rs-app.light.v2 .dm-day .dh b{font-size:15px;font-weight:600}"
      + "body.rs-app.light.v2 .dm-day .dh span{font-size:12.5px}"
      + "body.rs-app.light.v2 .dm-day .dh button{font-size:13px;font-weight:600;border-radius:8px;border-color:var(--line-2);color:var(--ink)}"
      + "body.rs-app.light.v2 .dm-f{border-radius:8px}"
      + "body.rs-app.light.v2 .dm-f .l{font-size:12px;font-weight:500;letter-spacing:0;text-transform:none;color:var(--muted)}"
      + "body.rs-app.light.v2 .dm-f .v{font-size:14px;font-weight:600}"
      + "body.rs-app.light.v2 .dm-f .s{font-size:12px}"
      + "body.rs-app.light.v2 .dm-empty{border-radius:10px}"
      + '</style><div class="dm"><div id="dmMain"></div></div><div class="dm-tt" id="dmTip"></div>';

    const main = host.querySelector("#dmMain");
    const tip = host.querySelector("#dmTip");
    main.innerHTML = '<div class="dm-empty">Loading the demand calendar…</div>';

    /* ================================================================= data =============== */
    // "Local Moving:12;Flat Rate:3" -> [["Local Moving",12],...]. The mart packs each day's
    // distribution into one column rather than shipping four more tables to grant and cache.
    function parseMix(s) {
      if (!s) return [];
      return String(s).split(";").map(p => {
        const i = p.lastIndexOf(":");
        if (i < 0) return null;
        return [p.slice(0, i).trim(), +p.slice(i + 1) || 0];
      }).filter(x => x && x[0]);
    }
    const addMix = (into, s, canon) => parseMix(s).forEach(([k, n]) => { const kk = canon ? canon(k) : k; into[kk] = (into[kk] || 0) + n; });
    /* SIZE AND TYPE, SPLIT (2026-10-07): this card listed every spelling Moveboard ever used for
       one size ("1 Bedroom condo/aprt." / "Condo" / "aprt."). RS.sizeParts reads them all as one. */
    const sizeParts = RS.sizeParts;
    const canonSize = l => sizeParts(l).label;
    const mixList = obj => Object.keys(obj).map(k => ({ k, n: obj[k] }))
      .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));

    function blank(d) {
      return { d: d, leads: 0, qual: 0, booked: 0, cf: 0, cfN: 0, bookedCf: 0,
               qSum: 0, qN: 0, ct: 0, crewSum: 0, crewN: 0, truckSum: 0, truckN: 0,
               pq: 0, pcf: 0, pn: 0, ldSum: 0, ldN: 0,
               ld: 0, local: 0, svcUnknown: 0,
               small: 0, mid: 0, big: 0, other: 0,
               svc: {}, size: {}, cfr: {}, st: {}, src: {},
               // per size / per state: [qualified, booked] -- only the per-lead layer fills these
               sizeQB: {}, stQB: {} };
    }
    // One accumulator, used for a day, a weekday, a demand level and the whole window alike —
    // so every figure on the page comes from one definition of how these rows add up.
    function fold(a, r) {
      a.leads += num(r.Leads); a.qual += num(r.Qualified); a.booked += num(r.Booked);
      // the count of leads that actually stated a volume travels with the volume: a window
      // where nobody filled the field must read as unmeasured, not as nought cubic feet
      a.cf += num(r["Total CF"]); a.cfN += num(r["CF Leads"]); a.bookedCf += num(r["Booked CF"]);
      // Avg Quote is a mean over the day's quoted leads: re-weight by that count, never
      // average the averages (a day with two quotes would otherwise weigh like a day with 60).
      if (nn(r["Avg Quote"]) != null && num(r["Quote Leads"]) > 0) {
        a.qSum += num(r["Avg Quote"]) * num(r["Quote Leads"]); a.qN += num(r["Quote Leads"]);
      }
      a.ct += num(r["Booked Closing Total"]);
      if (nn(r["Avg Crew"]) != null && num(r["Crew Leads"]) > 0) {
        a.crewSum += num(r["Avg Crew"]) * num(r["Crew Leads"]); a.crewN += num(r["Crew Leads"]);
      }
      if (nn(r["Avg Trucks"]) != null && num(r["Truck Leads"]) > 0) {
        a.truckSum += num(r["Avg Trucks"]) * num(r["Truck Leads"]); a.truckN += num(r["Truck Leads"]);
      }
      a.pq += num(r["Priced Quote"]); a.pcf += num(r["Priced CF"]); a.pn += num(r["Priced Leads"]);
      if (nn(r["Avg Lead Days"]) != null && num(r["Lead Days Leads"]) > 0) {
        a.ldSum += num(r["Avg Lead Days"]) * num(r["Lead Days Leads"]);
        a.ldN += num(r["Lead Days Leads"]);
      }
      a.ld += num(r["LD Leads"]); a.local += num(r["Local Leads"]); a.svcUnknown += num(r["Service Unknown"]);
      a.small += num(r["Size Small"]); a.mid += num(r["Size Mid"]);
      a.big += num(r["Size Big"]); a.other += num(r["Size Other"]);
      addMix(a.svc, r["Service Mix"]); addMix(a.size, r["Size Mix"], canonSize);
      addMix(a.cfr, r["CF Mix"]); addMix(a.st, r["State Mix"]);
      // `src` is the day's WINNING source only — the mart carries no full source breakdown at
      // this grain. Read it at day level (the tooltip and the day card) and nowhere else: a
      // tally of daily winners is not a count of leads by source.
      if (r["Top Source"]) a.src[r["Top Source"]] = (a.src[r["Top Source"]] || 0) + num(r["Top Source Leads"]);
      return a;
    }
    const avgQuote = a => (a.qN ? a.qSum / a.qN : null);
    const avgCrew = a => (a.crewN ? a.crewSum / a.crewN : null);
    const avgTrucks = a => (a.truckN ? a.truckSum / a.truckN : null);
    const perCF = a => (a.pcf > 0 ? a.pq / a.pcf : null);
    const leadDays = a => (a.ldN ? a.ldSum / a.ldN : null);
    // Booking rate is confirmed / qualified — the portal's canonical definition
    // (RS.bookingRate in assets/rs-core.js), read here off pre-summed columns.
    const bookRate = a => (a.qual ? Math.min(1, a.booked / a.qual) : null);

    const years = () => [...new Set((S.rows || []).map(r => String(r["Move Date"]).slice(0, 4)))]
      .filter(Boolean).sort();
    const companies = () => [...new Set((S.rows || []).map(r => r.Company).filter(Boolean))].sort();

    function scope() {
      let rs = S.rows || [];
      if (S.co) rs = rs.filter(r => r.Company === S.co);
      if (S.year) rs = rs.filter(r => String(r["Move Date"]).slice(0, 4) === S.year);
      return rs;
    }

    /* ---------------- the per-lead layer (2026-08-20) --------------------------------- */
    const leadFilterOn = () => !!(S.status || S.src || S.size);
    function loadLeads() {
      if (S.leads || S.leadsLoading) return;
      S.leadsLoading = true;
      RS.load("demand_leads").then(rs => {
        S.leads = (rs || []).map(r => {
          r.d = String(r["Move Date"]).slice(0, 10);
          r.cd = String(r["Created NY"] || r["Create Date"] || "");
          r.Size = r.Size ? canonSize(r.Size) : r.Size;
          return r;
        });
        S.leadsLoading = false;
        paint();                      // filters + day lists + the overflow card wake up
      }).catch(e => { S.leadsErr = e.message; S.leadsLoading = false; paint(); });
    }
    function scopeLeads() {
      let ls = S.leads || [];
      if (S.co) ls = ls.filter(l => l.Company === S.co);
      if (S.year) ls = ls.filter(l => l.d.slice(0, 4) === S.year);
      if (S.status) ls = ls.filter(l => (l.Status || "") === S.status);
      if (S.src) ls = ls.filter(l => (l.Source || "") === S.src);
      if (S.size) ls = ls.filter(l => (l.Size || "") === S.size);
      return ls;
    }
    // the same size buckets the mart computes, read off the label the same way
    function sizeBucketOf(label) {
      const t = String(label || "").toLowerCase();
      if (/single item|studio/.test(t)) return "small";
      const m = t.match(/(\d+)\+?\s*(?:bed|br\b)/);
      if (m) return +m[1] <= 2 ? "mid" : "big";
      return "other";
    }
    /* one lead into the SAME accumulator shape fold() fills from mart rows, so every card
       renders identically whichever layer computed it */
    function foldLead(a, l) {
      a.leads++;
      const sc = l.Status || "";
      if (sc !== "Bad Lead") a.qual++;
      const bk = sc === "Confirmed";
      if (bk) a.booked++;
      const cf = nn(l.CF);
      if (cf != null && cf > 0) { a.cf += cf; a.cfN++; if (bk) a.bookedCf += cf; }
      const q = nn(l.Quote);
      if (q != null && q > 0) {
        a.qSum += q; a.qN++;
        if (cf != null && cf > 0) { a.pq += q; a.pcf += cf; a.pn++; }
      }
      if (bk) a.ct += num(l["Closing Total"]);
      const crew = nn(l.Crew);
      if (crew != null && crew > 0) { a.crewSum += crew; a.crewN++; }
      const tr = nn(l.Trucks);
      if (tr != null && tr > 0) { a.truckSum += tr; a.truckN++; }
      const cd = String(l["Create Date"] || "").slice(0, 10);
      if (cd) {
        a.ldSum += (new Date(l.d + "T00:00:00Z") - new Date(cd + "T00:00:00Z")) / 864e5;
        a.ldN++;
      }
      const mt = l["Moving Type"] || "";
      if (mt === "Long Distance") a.ld++;
      else if (mt === "Local Moving") a.local++;
      else a.svcUnknown++;
      a[({ small: "small", mid: "mid", big: "big", other: "other" })[sizeBucketOf(l.Size)]]++;
      const bump = (o, k) => { const kk = k || "(not stated)"; o[kk] = (o[kk] || 0) + 1; };
      bump(a.svc, l.Service); bump(a.size, l.Size); bump(a.cfr, l["CF Range"]);
      bump(a.st, l.State); bump(a.src, l.Source);
      if (sc !== "Bad Lead") {
        const qb = (o, k) => { const kk = k || "(not stated)"; const x = o[kk] = o[kk] || [0, 0]; x[0]++; if (bk) x[1]++; };
        qb(a.sizeQB, l.Size); qb(a.stQB, l.State);
      }
      return a;
    }
    function byDayLeads(ls) {
      const m = new Map();
      ls.forEach(l => {
        if (!m.has(l.d)) m.set(l.d, blank(l.d));
        foldLead(m.get(l.d), l);
      });
      return m;
    }
    // date -> folded day, companies merged (the calendar is one square per date, not per book)
    function byDay(rs) {
      const m = new Map();
      rs.forEach(r => {
        const d = String(r["Move Date"]).slice(0, 10);
        if (!m.has(d)) m.set(d, blank(d));
        fold(m.get(d), r);
      });
      return m;
    }

    /* ================================================================= paint =============== */
    function load() {
      return RS.load("demand_move_date").then(rows => {
        S.rows = rows || [];
        if (!S.year) {
          const ys = years();
          const now = String(new Date().getFullYear());
          S.year = ys.indexOf(now) >= 0 ? now : (ys[ys.length - 1] || now);
        }
        paint();
        loadLeads();     // the per-lead layer streams in behind the first paint
      }).catch(e => {
        main.innerHTML = '<div class="dm-empty">Could not load the demand mart — ' + esc(e.message)
          + "</div>";
      });
    }

    function paint() {
      if (!S.rows || !S.rows.length) {
        main.innerHTML = '<div class="dm-empty">No demand rows yet — <b>mart_demand_move_date</b> '
          + "is built by the nightly refresh from the Moveboard leads.</div>";
        return;
      }
      // a lead filter switches the WHOLE page onto the per-lead layer, computed into the
      // same accumulators — every card renders from one shape whichever layer filled it
      let days, all;
      if (leadFilterOn() && S.leads) {
        const ls = scopeLeads();
        days = byDayLeads(ls);
        all = blank("");
        ls.forEach(l => foldLead(all, l));
      } else {
        const rs = scope();
        days = byDay(rs);
        all = blank("");
        rs.forEach(r => fold(all, r));
      }

      let h = basisBanner() + toolbar() + kpis(all, days);
      if (leadFilterOn() && !S.leads) {
        h += '<div class="dm-empty">' + (S.leadsErr
          ? "Could not load the per-lead detail — " + esc(S.leadsErr)
          : "Loading the per-lead detail for these filters…")
          + "</div>";
      }
      h += calendarCard(days);
      h += breakdownPanel(days);
      main.innerHTML = h;
      wire(days);
    }

    function basisBanner() {
      return '<details class="dm-basis"><summary><span class="bt">Move-date basis</span>'
        + "Every number here is counted on the <b>date the customer wants to move</b>, not the day "
        + "the lead came in. <u>Why it won't match the Sales pages</u></summary>"
        + "<p>The Lead Funnel, Sales pages and the Monthly Report count leads by <b>create date</b>, "
        + "so the two will not add up and are not meant to: a lead created in March for a July "
        + "Saturday is March there and July here. <b>Demand means everything that was asked for</b>, "
        + "booked or not; the blue foot on each square is the part we confirmed.</p></details>";
    }

    function toolbar() {
      const ys = years(), cos = companies();
      // every control is a LABELLED FIELD, so a segment and a select read as one bar
      // <label> when it wraps a real control (clicking the caption focuses it), <div>
      // for a segment -- a label wrapping buttons would swallow their clicks
      const fld = (label, inner) => {
        const t = /^<(select|input)/.test(inner.trim()) ? "label" : "div";
        return "<" + t + ' class="rs-fld"><span>' + label + "</span>" + inner + "</" + t + ">";
      };
      let h = '<div class="rs-bar">'
        + fld("Year", '<div class="rs-seg">'
            + ys.map(y => '<button data-y="' + esc(y) + '"' + (y === S.year ? ' class="on"' : "") + ">"
                + esc(y) + "</button>").join("") + "</div>");
      if (cos.length > 1) {
        h += fld("Book", '<div class="rs-seg"><button data-co=""' + (S.co ? "" : ' class="on"')
          + ">Both books</button>"
          + cos.map(c => '<button data-co="' + esc(c) + '"' + (c === S.co ? ' class="on"' : "") + ">"
              + esc(c) + "</button>").join("") + "</div>");
      }
      h += fld("Shading", '<div class="rs-seg">'
        + Object.keys(METRIC).map(k => '<button data-m="' + k + '"'
            + (k === S.metric ? ' class="on"' : "") + ">" + esc(METRIC[k].lab) + "</button>").join("")
        + "</div>");
      // the per-lead filters (his ask, 2026-08-19): status / source / size. Options come
      // from the lead layer, so they show real values, not guesses; until it streams in
      // they render disabled rather than empty-but-clickable. The control is the kit's
      // localSelect (mounted in wire()), never a native dropdown — it carries its own
      // label chip, so no .rs-fld caption wraps it. The loading placeholder is the same
      // slicer button in the kit's rs-off state: dimmed, dashed, no popover.
      const ldSel = (id, label, cur, key) => {
        if (!S.leads) {
          return '<div class="rs-slicer rs-off"><button type="button" class="rs-slicer-btn" disabled>'
            + '<span class="lbl">' + esc(label) + '</span><span class="val">'
            + (S.leadsErr ? "unavailable" : "loading…")
            + '</span><span class="chev">▾</span></button></div>';
        }
        return '<div data-lf="' + id + '" data-lf-label="' + esc(label)
          + '" data-lf-key="' + esc(key) + '"></div>';
      };
      h += ldSel("status", "Status", S.status, "Status")
        + ldSel("src", "Source", S.src, "Source")
        + ldSel("size", "Size", S.size, "Size");
      h += "</div>";
      // the hint gets a line of its own instead of 11.5px grey squeezed against the right
      // edge of the bar -- his standing rule: a hint nobody can read is not a hint
      return h + '<p class="rs-hint">Each square is shaded by <b>'
        + esc(METRIC[S.metric].lab.toLowerCase()) + "</b>; the blue foot is always the booked "
        + "share of that day."
        + (leadFilterOn()
            ? ' <span class="em">Filters are on — every card, every square and every list '
              + "below is recomputed from the individual leads.</span>"
            : " Status, source and size filter the individual leads behind every number.")
        + "</p>";
    }

    function kpis(a, days) {
      const dayVals = [...days.values()].map(d => d.leads).sort((x, y) => x - y);
      const med = dayVals.length
        ? (dayVals.length % 2 ? dayVals[(dayVals.length - 1) / 2]
            : (dayVals[dayVals.length / 2 - 1] + dayVals[dayVals.length / 2]) / 2) : null;
      let peak = null;
      days.forEach(d => { if (!peak || d.leads > peak.leads) peak = d; });
      const ahead = [...days.values()].filter(d => d.d > TODAY)
        .reduce((s, d) => s + d.leads, 0);

      const k = (b, lab, sub, cls) => '<div class="dm-k ' + (cls || "") + '"><b>' + esc(b) + "</b><span>"
        + esc(lab) + "</span><small>" + esc(sub) + "</small></div>";
      return '<div class="dm-kpis">'
        + k(fmtN(a.leads), "Leads asking for " + S.year,
            fmtN(days.size) + " date" + (days.size === 1 ? "" : "s") + " asked for")
        + k(fmtN(a.booked), "Booked onto those dates",
            dash(bookRate(a), pct) + " of qualified leads", "blue")
        + k(a.cfN ? fmtN(a.cf) + " cf" : "—", "Cubic feet asked for",
            a.cfN ? fmtN(a.cfN) + " leads stated a volume" : "no lead stated a volume")
        + k(med == null ? "—" : fmt1(med), "Typical day",
            "median leads on a date that was asked for")
        + k(peak ? fmtN(peak.leads) : "—", "Busiest single date",
            peak ? longDate(peak.d) : "—")
        + k(dash(perCF(a), v => money2(v)), "Quote per cubic foot",
            fmtN(a.pn) + " leads with both a quote and a volume")
        + (ahead ? k(fmtN(ahead), "Still ahead of us",
            "leads for dates after today — those dates are still filling") : "")
        + "</div>";
    }

    /* ---- the centrepiece: twelve months of squares ------------------------------------- */
    function levels(vals) {
      // Quartile ramp, not a linear one. Daily demand is heavily skewed — a handful of
      // month-end Saturdays would flatten every ordinary week to the palest shade on a linear
      // scale, which is exactly the detail this page is for.
      const v = vals.filter(x => x > 0).sort((a, b) => a - b);
      if (!v.length) return [];
      const q = p => v[Math.min(v.length - 1, Math.floor(p * v.length))];
      return [q(0.25), q(0.5), q(0.75)];
    }
    const OPACITY = [0, 0.22, 0.44, 0.68, 1];
    // The matrix prints a number inside each cell, so its ramp stops well short of a solid
    // fill — a figure nobody can read is worse than a slightly flatter scale.
    const MX_OPACITY = [0, 0.12, 0.28, 0.46, 0.66];
    function levelOf(v, cuts) {
      if (!(v > 0)) return 0;
      if (!cuts.length) return 4;
      return v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
    }

    function calendarCard(days) {
      const M = METRIC[S.metric];
      const cuts = levels([...days.values()].map(M.get));
      const y = +S.year;
      let cal = "";
      for (let m = 0; m < 12; m++) {
        const first = new Date(Date.UTC(y, m, 1));
        const lead = (first.getUTCDay() + 6) % 7;             // grid starts on Monday
        const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        let cells = WD.map(w => '<div class="wh">' + w[0] + "</div>").join("");
        for (let i = 0; i < lead; i++) cells += '<div class="dm-c pad"></div>';
        for (let dd = 1; dd <= n; dd++) {
          const iso = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
          const d = days.get(iso);
          const v = d ? M.get(d) : 0;
          const lv = levelOf(v, cuts);
          const share = d && d.leads ? Math.min(1, d.booked / d.leads) : 0;
          cells += '<div class="dm-c' + (iso > TODAY ? " ahead" : "")
            + (S.day === iso ? " on" : "") + '" data-day="' + iso + '">'
            + (lv ? '<i class="lv" style="opacity:' + OPACITY[lv] + '"></i>' : "")
            + (share > 0 ? '<i class="bk" style="height:' + (share * 100).toFixed(0) + '%"></i>' : "")
            + "</div>";
        }
        cal += '<div class="dm-mon"><div class="ml">' + MONL[m] + '</div><div class="dm-wk">'
          + cells + "</div></div>";
      }
      const legSw = OPACITY.slice(1).map(o => '<i style="opacity:' + o + '"></i>').join("");
      return '<div class="dm-card"><div class="dm-h"><h3>Demand calendar — ' + esc(S.year)
        + '</h3><span class="tag">by move date</span>'
        + '<span class="rt">' + esc(M.lab) + " · one square a day</span></div>"
        + '<p class="dm-note">Each square is a date somebody wanted to move on. The shading is '
        + "<b>" + esc(M.lab.toLowerCase()) + "</b>; the blue foot is the share of that day's leads "
        + "we confirmed. A dashed square is a date <b>still ahead of us</b> — demand for it is "
        + "still arriving, so a pale future square means nothing yet. Hover for the day, click to "
        + "pin it below.</p>"
        + '<div class="dm-cal">' + cal + "</div>"
        + '<div class="dm-leg"><span>Less <span class="sw">' + legSw + '</span> more</span>'
        + '<span><span class="bl"></span> booked share of the day</span>'
        + "<span>Dashed border = date still ahead of us</span></div>"
        + dayDetail(days) + "</div>";
    }

    function dayDetail(days) {
      if (!S.day) return "";
      const d = days.get(S.day);
      if (!d) {
        return '<div class="dm-day"><div class="dh"><b>' + esc(longDate(S.day)) + "</b>"
          + "<span>" + (leadFilterOn() ? "no leads match the current filters on this date"
              : S.day > TODAY ? "nobody has asked for this date yet"
              : "no lead ever asked for this date") + "</span>"
          + '<button data-close="1">Close</button></div></div>';
      }
      const f = (l, v, s) => '<div class="dm-f"><div class="l">' + esc(l) + '</div><div class="v">'
        + esc(v) + '</div><div class="s">' + esc(s || "") + "</div></div>";
      const topOf = obj => { const l = mixList(obj); return l.length ? l[0].k + " · " + l[0].n : "—"; };
      return '<div class="dm-day"><div class="dh"><b>' + esc(longDate(S.day)) + "</b>"
        + "<span>" + fmtN(d.leads) + " leads · " + fmtN(d.booked) + " booked · "
        + dash(bookRate(d), pct) + " of qualified</span>"
        + '<button data-close="1">Close</button></div>'
        + '<div class="dm-facts">'
        + f("Cubic feet asked", d.cfN ? fmtN(d.cf) : "—",
            d.cfN ? fmtN(d.cfN) + " of " + fmtN(d.leads) + " leads stated one" : "none stated")
        + f("Average quote", dash(avgQuote(d), money0), fmtN(d.qN) + " leads quoted")
        + f("Quote per cu ft", dash(perCF(d), money2), fmtN(d.pn) + " leads priced")
        + f("Crew asked for", dash(avgCrew(d), fmt1), dash(avgTrucks(d), v => fmt1(v) + " trucks"))
        + f("Booked at closing", d.ct ? money0(d.ct) : "—", "Moveboard's own closing total")
        + f("Asked this far ahead", dash(leadDays(d), v => fmt1(v) + " days"), "from lead to move date")
        + f("Move type", d.ld + " long / " + d.local + " local",
            d.svcUnknown ? d.svcUnknown + " unmapped" : "")
        + f("Biggest market", topOf(d.st), "pickup state")
        + f("Top service", topOf(d.svc), "")
        + f("Top size", topOf(d.size), "")
        + "</div>" + dayLeadsTable() + "</div>";
    }

    /* the leads behind the pinned day — his ask: "ლიდების სია დაჭერაზე" */
    function dayLeadsTable() {
      if (!S.leads) {
        return '<p class="dm-note" style="margin-top:10px">'
          + (S.leadsErr ? "Per-lead detail unavailable — " + esc(S.leadsErr)
             : "The lead list for this day is still loading…") + "</p>";
      }
      const CAPN = 300;
      const ls = scopeLeads().filter(l => l.d === S.day)
        .sort((a, b) => String(a.cd).localeCompare(String(b.cd)));
      if (!ls.length) return '<p class="dm-note" style="margin-top:10px">No leads match the '
        + "current filters on this day.</p>";
      return '<div class="dm-scroll" style="margin-top:12px;max-height:46vh;overflow:auto">'
        + '<table class="rs-table dm-t dm-lead-tbl"><thead><tr><th>Came in</th><th>Moveboard #</th>'
        + "<th>Customer</th><th>Status</th><th>Source</th><th>Size</th><th>Cu ft</th>"
        + "<th>Quote</th></tr></thead><tbody>"
        + ls.slice(0, CAPN).map(l =>
            '<tr data-lead="' + esc((l.Company || "") + " " + (l["Job No"] || "")) + '" style="cursor:pointer" title="Open the lead file">'
            + '<td class="nm">' + esc(String(l.cd).slice(0, 16) || "—") + "</td>"
            + "<td>#" + esc(String(l["Job No"] || "—")) + "</td>"
            + '<td style="text-align:left">' + esc(l.Customer || "—") + "</td>"
            + "<td" + (l.Status === "Confirmed" ? ' style="color:var(--blue);font-weight:700"' : "")
            + ">" + esc(l.Status || "—") + "</td>"
            + "<td>" + esc(l.Source || "—") + "</td>"
            + "<td>" + esc(l.Size || "—") + "</td>"
            + "<td>" + (nn(l.CF) != null ? fmtN(l.CF) : "—") + "</td>"
            + "<td>" + (nn(l.Quote) != null ? money0(l.Quote) : "—") + "</td></tr>").join("")
        + "</tbody></table>"
        + (ls.length > CAPN ? '<p class="dm-note">' + fmtN(ls.length - CAPN) + " more on this day.</p>" : "")
        + "</div>";
    }

    /* ---- his #5: once a day passed X jobs, how many leads still came in ------------------
       There is no timestamp for the moment a booking was CONFIRMED (`Booked Date` is
       written date-like on every lead and is not a booking signal — the warehouse's own
       rule), so the moment a day "reached X jobs" is approximated by the CREATION time of
       its Xth eventually-confirmed lead. Bookings usually follow their lead quickly, so
       the approximation is honest — and it is stated on the card, not hidden. */
    function ordinal(n) {
      const t = n % 100;
      if (t >= 11 && t <= 13) return n + "th";
      return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    }
    function overflowCard() {
      if (!S.leads) {
        return '<div class="dm-card"><div class="dm-h"><h3>Demand after a day was already full</h3>'
          + '<span class="tag">capacity</span></div><div class="dm-empty">'
          + (S.leadsErr ? "Per-lead detail unavailable — " + esc(S.leadsErr)
             : "Loading the per-lead detail…") + "</div></div>";
      }
      const X = Math.max(1, Math.round(S.cap || 10));
      const byD = new Map();
      scopeLeads().forEach(l => {
        if (!byD.has(l.d)) byD.set(l.d, []);
        byD.get(l.d).push(l);
      });
      const hit = [];
      let afterAll = 0, afterBooked = 0, afterLost = 0;
      byD.forEach((ls, d) => {
        // THE FUTURE IS NOT EVIDENCE (the page's own rule, and the portal's): a date still
        // ahead of us is still filling — its open leads are pipeline, not lost demand
        if (d > TODAY) return;
        // creation-time order, tie-broken by lead # so bulk imports with one timestamp
        // cannot flip which side of the cut a lead lands on between rebuilds
        const keyOf = l => String(l.cd) + "|" + String(l["Job No"] || "");
        ls.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
        const bookedKeys = ls.filter(l => l.Status === "Confirmed" && l.cd).map(keyOf);
        if (bookedKeys.length < X) return;
        const cut = bookedKeys[X - 1];
        const after = ls.filter(l => l.cd && keyOf(l) > cut);
        const ab = after.filter(l => l.Status === "Confirmed").length;
        const al = after.filter(l => l.Status !== "Confirmed" && l.Status !== "Bad Lead").length;
        afterAll += after.length; afterBooked += ab; afterLost += al;
        hit.push({ d, booked: bookedKeys.length, after: after.length, ab, al });
      });
      hit.sort((a, b) => b.after - a.after);
      const k = (b, lab, sub, cls) => '<div class="dm-k ' + (cls || "") + '"><b>' + esc(b)
        + "</b><span>" + esc(lab) + "</span><small>" + esc(sub) + "</small></div>";
      return '<div class="dm-card"><div class="dm-h"><h3>Demand after a day was already full</h3>'
        + '<span class="tag">capacity</span>'
        + '<span class="rt">a full day = <input type="number" class="rs-num" id="dmCap" min="1" '
        + 'step="1" value="' + X + '"> booked jobs</span></div>'
        + '<p class="dm-note1">Days that reached ' + X + " booked jobs, and the leads that still came in "
        + "after — demand more capacity could have taken. Change the number to your real daily capacity.</p>"
        + '<details class="dm-more"><summary>How this is counted</summary><p>Dates still ahead of us '
        + "are excluded: their leads are pipeline, not lost demand. The moment a day filled is approximated "
        + "by when its " + ordinal(X) + " eventually-booked lead was created (the warehouse has no timestamp "
        + "for the confirmation itself; `Booked Date` is not usable). It respects the filters above.</p></details>"
        + '<div class="dm-kpis">'
        + k(fmtN(hit.length), "Days that reached " + X + " bookings", "in this window")
        + k(fmtN(afterAll), "Leads after the day was full", "arrived once " + X + " jobs already stood", afterAll ? "blue" : "")
        + k(fmtN(afterBooked), "…of which we STILL booked", "the day went past " + X + " — capacity was found")
        + k(fmtN(afterLost), "…qualified but never booked", "the demand a bigger fleet could have taken", afterLost ? "blue" : "")
        + "</div>"
        + (hit.length
          ? '<div class="dm-scroll"><table class="rs-table dm-t"><thead><tr><th>Move date</th>'
            + "<th>Booked that day</th><th>Leads after #" + X + "</th><th>…booked anyway</th>"
            + "<th>…qualified, never booked</th></tr></thead><tbody>"
            + hit.slice(0, 15).map(x => '<tr data-jump="' + esc(x.d) + '"><td class="nm">'
                + esc(shortDate(x.d)) + "</td><td>" + fmtN(x.booked) + "</td><td>"
                + fmtN(x.after) + "</td><td>" + fmtN(x.ab) + "</td><td>" + fmtN(x.al)
                + "</td></tr>").join("")
            + "</tbody></table></div>"
          : '<div class="dm-empty">No day in this window reached ' + X + " bookings.</div>")
        + "</div>";
    }

    /* ---- weekday x month ---------------------------------------------------------------- */
    /* ---- THE BREAKDOWN PANEL (his call 2026-10-07) -----------------------------------------
       Everything under the calendar used to be seven stacked cards -- about five screens. He
       liked every one of them and not the layout: "maybe switch? but yea comparison is also good".
       So: one panel, a view switch, and each list view drawn the same way -- a bar for leads,
       the booked part darker, a tick where LAST YEAR stood, the change on the right.
       THE COMPARISON IS LIKE FOR LIKE: in the current year both windows stop at yesterday's
       month-day (a half-filled October is never set against a complete one); a past year is
       compared whole. Booking rates per size / state / CF need the per-lead layer, so they
       appear once it has streamed in; counts come from the aggregate either way. */
    const VIEWS = [["wd", "Weekdays"], ["sz", "Size and type"], ["st", "Where from"], ["cf", "Move size (CF)"],
                   ["pk", "Busiest dates"], ["full", "Full days"], ["pr", "Pricing"]];
    const WDN = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    const MONN = ["January", "February", "March", "April", "May", "June", "July", "August", "September",
                  "October", "November", "December"];
    function cutMD() {
      return S.year === String(new Date().getFullYear()) ? TODAY.slice(5) : "12-32";
    }
    const inWin = (iso, y) => String(iso).slice(0, 4) === y && String(iso).slice(5, 10) < cutMD();
    const aggIn = y => (S.rows || []).filter(r => (!S.co || r.Company === S.co) && inWin(String(r["Move Date"]).slice(0, 10), y));
    const leadsIn = y => (S.leads || []).filter(l => (!S.co || l.Company === S.co) && inWin(l.d, y)
      && (!S.status || (l.Status || "") === S.status) && (!S.src || (l.Source || "") === S.src)
      && (!S.size || (l.Size || "") === S.size));
    // calendar days of each weekday / month inside a year's window -- the per-day divisor
    function occ(y) {
      const wd = [0, 0, 0, 0, 0, 0, 0], mo = new Array(12).fill(0), cut = cutMD();
      for (let t = Date.UTC(+y, 0, 1); ; t += 864e5) {
        const d = new Date(t), iso = d.toISOString().slice(0, 10);
        if (iso.slice(0, 4) !== y || iso.slice(5) >= cut) break;
        wd[(d.getUTCDay() + 6) % 7]++; mo[d.getUTCMonth()]++;
      }
      return { wd, mo };
    }
    // one year's rows for a list view: Map key -> {n, q, b}  (q/b null = not measurable)
    function groupYear(view, y) {
      const m = new Map(), add = (k, n, q, b) => {
        const x = m.get(k) || { n: 0, q: 0, b: 0, qb: false };
        x.n += n; if (q != null) { x.q += q; x.b += b; x.qb = true; } m.set(k, x);
      };
      const useLeads = !!S.leads && (leadFilterOn() || view !== "wd");
      if (view === "wd") {
        const byMonth = S.wdMode === "mo";
        if (useLeads) leadsIn(y).forEach(l => {
          const d = new Date(l.d + "T00:00:00Z"), k = byMonth ? d.getUTCMonth() : (d.getUTCDay() + 6) % 7;
          add(k, 1, l.Status !== "Bad Lead" ? 1 : 0, l.Status === "Confirmed" ? 1 : 0);
        });
        else aggIn(y).forEach(r => {
          const d = new Date(String(r["Move Date"]).slice(0, 10) + "T00:00:00Z"), k = byMonth ? d.getUTCMonth() : (d.getUTCDay() + 6) % 7;
          add(k, num(r.Leads), num(r.Qualified), num(r.Booked));
        });
        const o = occ(y), div = byMonth ? o.mo : o.wd;
        m.forEach((x, k) => { x.perDay = div[k] ? x.n / div[k] : null; });
        return m;
      }
      if (S.leads) {
        leadsIn(y).forEach(l => {
          const k = view === "sz" ? sizeParts(l.Size).label : view === "st" ? (l.State || "(not stated)") : (l["CF Range"] || "(not stated)");
          add(k, 1, l.Status !== "Bad Lead" ? 1 : 0, l.Status === "Confirmed" ? 1 : 0);
        });
        if (view === "st") leadsIn(y).forEach(l => {
          const mt = l["Moving Type"] || "";
          add(mt === "Long Distance" ? "~Long distance" : mt === "Local Moving" ? "~Local" : "~Service type unmapped",
              1, l.Status !== "Bad Lead" ? 1 : 0, l.Status === "Confirmed" ? 1 : 0);
        });
        return m;
      }
      const col = view === "sz" ? "Size Mix" : view === "st" ? "State Mix" : "CF Mix";
      aggIn(y).forEach(r => {
        parseMix(r[col]).forEach(([k, n]) => add(view === "sz" ? canonSize(k) : k, n, null, null));
        if (view === "st") {
          add("~Long distance", num(r["LD Leads"]), null, null); add("~Local", num(r["Local Leads"]), null, null);
          if (num(r["Service Unknown"])) add("~Service type unmapped", num(r["Service Unknown"]), null, null);
        }
      });
      return m;
    }
    function breakdownPanel(days) {
      const v = S.view || "wd", y = S.year, py = String(+y - 1);
      const sw = '<div class="rs-seg dm-sw">' + VIEWS.map(([k, l]) => '<button data-view="' + k + '"'
        + (k === v ? ' class="on"' : "") + ">" + esc(l) + "</button>").join("") + "</div>";
      let inner;
      if (v === "pk") inner = peakCard(days);
      else if (v === "full") inner = overflowCard();
      else if (v === "pr") inner = quoteCard(days);
      else inner = rowView(v, y, py);
      return '<div class="dm-card dm-panel">' + sw + inner + "</div>";
    }
    function rowView(v, y, py) {
      const cur = groupYear(v, y);
      const hasPrev = (S.rows || []).some(r => String(r["Move Date"]).slice(0, 4) === py);
      const cmp = S.cmp !== false && hasPrev;
      const prev = cmp ? groupYear(v, py) : new Map();
      const perDay = v === "wd";
      const val = x => x ? (perDay ? x.perDay : x.n) : null;
      let keys = [...new Set([...cur.keys()].concat([...prev.keys()]))];
      if (v === "wd") keys = keys.filter(k => cur.has(k) || prev.has(k)).sort((a, b) => a - b);
      else if (v === "sz") keys.sort((a, b) => sizeParts(a).rank - sizeParts(b).rank || String(a).localeCompare(String(b)));
      else if (v === "cf") { const ck = s2 => { const mm = String(s2).match(/\d+/); return mm ? +mm[0] : Infinity; }; keys.sort((a, b) => ck(a) - ck(b)); }
      else keys.sort((a, b) => { const ta = String(a)[0] === "~", tb = String(b)[0] === "~";
        return ta !== tb ? (ta ? 1 : -1) : (val(cur.get(b)) || 0) - (val(cur.get(a)) || 0); });
      const tot = [...cur.entries()].filter(([k]) => String(k)[0] !== "~").reduce((s2, [, x]) => s2 + x.n, 0);
      const mx = Math.max(1e-9, ...keys.map(k => Math.max(val(cur.get(k)) || 0, val(prev.get(k)) || 0)));
      const lab = k => v === "wd" ? (S.wdMode === "mo" ? MONN[k] : WDN[k]) : String(k).replace(/^~/, "");
      let sep = false;
      const rows = keys.map(k => {
        const c = cur.get(k), p = prev.get(k), cv = val(c) || 0, pv = val(p);
        const w = cv / mx * 100, rate = c && c.qb && c.q ? c.b / c.q : null;
        const d = cmp && pv ? (cv - pv) / pv : null;
        const showRate = rate != null && c.q >= 10;
        let pre = "";
        if (String(k)[0] === "~" && !sep) { sep = true; pre = '<div class="dm-rsep"></div>'; }
        return pre + '<div class="dm-r"><span class="k">' + esc(lab(k)) + '</span><span class="t"><i style="width:' + w.toFixed(1)
          + '%"></i>' + (showRate ? '<em style="width:' + (w * rate).toFixed(1) + '%"></em>' : "")
          + (cmp && pv ? '<b style="left:' + Math.min(100, pv / mx * 100).toFixed(1) + '%" title="' + esc(py) + ": "
             + (perDay ? fmt1(pv) + " a day" : fmtN(pv)) + '"></b>' : "") + "</span>"
          + '<span class="n">' + (perDay ? fmt1(cv) + "<small> a day</small>" : fmtN(cv) + (String(k)[0] === "~" ? "" : "<small>" + (tot ? Math.round(cv / tot * 100) : 0) + "%</small>")) + "</span>"
          + '<span class="r">' + (showRate ? Math.round(rate * 100) + "% booked" : "") + "</span>"
          + (cmp ? '<span class="d ' + (d == null ? "" : d > 0.005 ? "up" : d < -0.005 ? "dn" : "") + '">'
             + (d == null ? "new" : (d > 0 ? "+" : d < 0 ? "−" : "") + Math.round(Math.abs(d) * 100) + "%") + "</span>" : "") + "</div>";
      }).join("");
      const TITLE = { wd: S.wdMode === "mo" ? "Which months the market wants" : "Which weekdays the market wants",
                      sz: "What the market is moving", st: "Where the demand is", cf: "How big the asked-for moves are" };
      const NOTE = {
        wd: "Leads per calendar day, so a five-Saturday month cannot out-rank a four-Saturday one.",
        sz: "Size and type of home as the lead recorded it.",
        st: "Pickup state, from the lead's Moving From; local vs long distance underneath.",
        cf: "The lead's CF Range band; leads with no volume are their own band.",
      };
      const sub = v === "wd" ? '<div class="rs-seg dm-sub"><button data-wdm="wd"' + (S.wdMode !== "mo" ? ' class="on"' : "")
        + '>By weekday</button><button data-wdm="mo"' + (S.wdMode === "mo" ? ' class="on"' : "") + ">By month</button></div>" : "";
      const lastIso = cutMD() === "12-32" ? null : new Date(Date.parse(y + "-" + cutMD() + "T00:00:00Z") - 864e5).toISOString().slice(0, 10);
      const winTxt = lastIso ? "1 Jan – " + shortDate(lastIso).replace(/^\w+ /, "") : "the whole year";
      return '<div class="dm-ph"><h3>' + esc(TITLE[v]) + '</h3><span class="tag">by move date</span>' + sub
        + '<label class="dm-cmp"' + (hasPrev ? "" : ' title="No ' + esc(py) + ' data"') + '><input type="checkbox" id="dmCmp"'
        + (cmp ? " checked" : "") + (hasPrev ? "" : " disabled") + "> Compare with " + esc(py) + "</label></div>"
        + '<p class="dm-note1">' + esc(NOTE[v]) + (cmp ? " Compared on the same window both years (" + esc(winTxt) + ")." : "")
        + (S.leads || v === "wd" ? "" : " Booking rates appear once the per-lead detail has loaded.") + "</p>"
        + (rows || '<div class="dm-empty">Nothing in this window.</div>')
        + (cmp ? '<p class="dm-leg"><span class="tk"></span>' + esc(py) + ' level &nbsp;·&nbsp; right column: change vs ' + esc(py) + "</p>" : "");
    }

    /* ---- distributions ------------------------------------------------------------------ */
    /* ---- peaks + markets ---------------------------------------------------------------- */
    function peakCard(days) {
      const list = [...days.values()].sort((a, b) => b.leads - a.leads).slice(0, 15);
      return '<div class="dm-card"><div class="dm-h"><h3>The dates the market wants most</h3>'
        + '<span class="tag">by move date</span><span class="rt">top 15</span></div>'
        + '<p class="dm-note1">Ranked on leads asked, not on what we booked.</p>'
        + (!list.length
            ? '<div class="dm-empty">No move date in this window was asked for at all.</div>'
            : '<div class="dm-scroll"><table class="rs-table dm-t"><thead><tr><th>Move date</th><th>Leads</th>'
        + "<th>Booked</th><th>Rate</th><th>Cu ft</th><th>Avg quote</th><th>Top market</th>"
        + "</tr></thead><tbody>"
        + list.map(d => {
            const st = mixList(d.st);
            return '<tr data-jump="' + esc(d.d) + '"><td class="nm">' + esc(shortDate(d.d))
              + "</td><td>" + fmtN(d.leads) + "</td><td>" + fmtN(d.booked) + "</td><td>"
              + dash(bookRate(d), pct) + "</td><td>" + (d.cfN ? fmtN(d.cf) : "—") + "</td><td>"
              + dash(avgQuote(d), money0) + "</td><td>" + esc(st.length ? st[0].k : "—")
              + "</td></tr>";
          }).join("")
        + "</tbody></table></div>")
        + "</div>";
    }

    /* ---- the secondary cut: raw material, no verdict ------------------------------------ */
    function quoteCard(days) {
      const list = [...days.values()].filter(d => d.leads > 0).sort((a, b) => a.leads - b.leads);
      if (list.length < 8) {
        return '<div class="dm-card"><div class="dm-h"><h3>Quote against volume, by how busy the '
          + 'date is</h3><span class="tag">context, not a verdict</span></div>'
          + '<div class="dm-empty">Not enough dates in this window to split into demand levels.</div>'
          + "</div>";
      }
      // Quartiles of DATES, so each band holds the same number of days and the comparison is
      // between like and like.
      const q = Math.ceil(list.length / 4);
      const bands = [
        { lab: "Quietest quarter of dates", rows: list.slice(0, q) },
        { lab: "Below the middle", rows: list.slice(q, 2 * q) },
        { lab: "Above the middle", rows: list.slice(2 * q, 3 * q) },
        { lab: "Busiest quarter of dates", rows: list.slice(3 * q) },
      ].filter(b => b.rows.length);
      const line = b => {
        const a = blank("");
        // days are already folded; add their sums straight into one accumulator
        b.rows.forEach(d => {
          a.leads += d.leads; a.qual += d.qual; a.booked += d.booked;
          a.cf += d.cf; a.cfN += d.cfN;
          a.qSum += d.qSum; a.qN += d.qN; a.pq += d.pq; a.pcf += d.pcf; a.pn += d.pn;
          a.crewSum += d.crewSum; a.crewN += d.crewN;
        });
        const lo = b.rows[0].leads, hi = b.rows[b.rows.length - 1].leads;
        return "<tr><td class='nm'>" + esc(b.lab) + '<div style="font-size:10.5px;color:var(--faint);'
          + "font-weight:500\">" + fmtN(lo) + "–" + fmtN(hi) + " leads a day</div></td><td>"
          + fmtN(b.rows.length) + "</td><td>" + fmtN(a.leads) + "</td><td>"
          + fmt1(a.leads / b.rows.length) + "</td><td>" + (a.cfN ? fmtN(a.cf) : "—") + "</td><td>"
          + dash(avgQuote(a), money0) + "</td><td>" + dash(perCF(a), money2) + "</td><td>"
          + dash(a.pn ? a.pcf / a.pn : null, fmtN) + "</td><td>" + dash(bookRate(a), pct)
          + "</td><td>" + dash(avgCrew(a), fmt1) + "</td></tr>";
      };
      return '<div class="dm-card"><div class="dm-h"><h3>Quote against volume, by how busy the '
        + 'date is</h3><span class="tag">context, not a verdict</span>'
        + '<span class="rt">dates split into four equal groups</span></div>'
        + '<p class="dm-note1">Dates split into four equal groups by how busy they were, and what we '
        + "quoted per cubic foot in each — context, not a verdict.</p>"
        + '<details class="dm-more"><summary>How this is counted</summary><p>Quote per cu ft is total quoted '
        + "dollars over total cubic feet across the leads that carried both — a dollar-weighted rate, so a big "
        + "move in a quiet week cannot distort it. Whether the pricing is right is a judgement about the "
        + "business, and this page does not make it.</p></details>"
        + '<div class="dm-scroll"><table class="rs-table dm-t"><thead><tr><th>Demand level</th><th>Dates</th>'
        + "<th>Leads</th><th>Leads / date</th><th>Cu ft asked</th><th>Avg quote</th>"
        + "<th>Quote / cu ft</th><th>Avg cu ft priced</th><th>Booking rate</th><th>Avg crew</th>"
        + "</tr></thead><tbody>" + bands.map(line).join("") + "</tbody></table></div></div>";
    }

    /* ================================================================= wiring ============== */
    const longDate = iso => {
      const d = new Date(iso + "T00:00:00Z");
      return WD[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + " " + MONL[d.getUTCMonth()]
        + " " + d.getUTCFullYear();
    };
    const shortDate = iso => {
      const d = new Date(iso + "T00:00:00Z");
      return WD[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()];
    };

    function wire(days) {
      main.querySelectorAll("[data-y]").forEach(b => {
        b.onclick = () => { S.year = b.dataset.y; S.day = null; paint(); };
      });
      main.querySelectorAll("[data-co]").forEach(b => {
        b.onclick = () => { S.co = b.dataset.co; paint(); };
      });
      main.querySelectorAll("[data-m]").forEach(b => {
        b.onclick = () => { S.metric = b.dataset.m; paint(); };
      });
      // mount the kit's localSelect on each lead-filter host (values from the lead layer,
      // same option strings the old <option>s carried; "" stays the All value)
      main.querySelectorAll("[data-lf]").forEach(el => {
        const id = el.dataset.lf;
        const vals = [...new Set((S.leads || []).map(l => l[el.dataset.lfKey] || ""))]
          .filter(Boolean).sort();
        RSC.localSelect(el, {
          label: el.dataset.lfLabel, values: vals, value: S[id], allLabel: "All",
          onChange: v => { S[id] = v; paint(); },
        });
      });
      const cap = main.querySelector("#dmCap");
      if (cap) cap.onchange = () => {
        S.cap = Math.max(1, Math.round(+cap.value) || S.cap);   // a cleared box keeps the prior X
        try { localStorage.setItem("ztzDemandCap", String(S.cap)); } catch (e) {}
        paint();
        // the repaint destroyed the input mid-interaction; hand focus back so the spinner
        // arrows keep working stroke after stroke
        const c2 = main.querySelector("#dmCap");
        if (c2) c2.focus();
      };
      main.querySelectorAll("[data-view]").forEach(b => {
        b.onclick = () => { S.view = b.dataset.view; try { localStorage.setItem("ztzDemandView", S.view); } catch (e) {} paint(); };
      });
      main.querySelectorAll("[data-wdm]").forEach(b => {
        b.onclick = () => { S.wdMode = b.dataset.wdm; paint(); };
      });
      const cmpBox = main.querySelector("#dmCmp");
      if (cmpBox) cmpBox.onchange = () => { S.cmp = cmpBox.checked; try { localStorage.setItem("ztzDemandCmp", S.cmp ? "1" : "0"); } catch (e) {} paint(); };
      const close = main.querySelector("[data-close]");
      if (close) close.onclick = () => { S.day = null; paint(); };
      main.querySelectorAll("[data-jump]").forEach(tr => {
        tr.style.cursor = "pointer";
        tr.onclick = () => {
          S.day = tr.dataset.jump;
          paint();
          const c = main.querySelector('.dm-c[data-day="' + S.day + '"]');
          if (c) c.scrollIntoView({ block: "center", behavior: "smooth" });
        };
      });
      // Delegated, not 365 sets of handlers: the calendar is redrawn on every filter click and
      // a year of squares wired three times over is the kind of thing that makes a page feel
      // slow for no visible reason.
      const cal = main.querySelector(".dm-cal");
      if (!cal) return;
      let hovered = null;
      cal.onclick = e => {
        const c = e.target.closest(".dm-c[data-day]");
        if (!c) return;
        S.day = (S.day === c.dataset.day ? null : c.dataset.day);
        paint();
      };
      cal.onmousemove = e => {
        const c = e.target.closest(".dm-c[data-day]");
        if (!c) { hovered = null; tip.classList.remove("on"); return; }
        if (c.dataset.day !== hovered) {
          hovered = c.dataset.day;
          showTip(days.get(hovered), hovered);
        }
        moveTip(e);
      };
      cal.onmouseleave = () => { hovered = null; tip.classList.remove("on"); };
    }

    // The tooltip is rebuilt from the day's data on hover rather than stamped into an
    // attribute at paint time: 365 pre-rendered tooltips is 365 strings nobody reads.
    function showTip(d, iso) {
      const row = (l, v) => '<div class="r"><span>' + esc(l) + "</span><b>" + esc(v) + "</b></div>";
      let h = '<div class="d">' + esc(longDate(iso)) + "</div>";
      if (!d) {
        h += '<div class="r"><span>' + (iso > TODAY ? "not asked for yet" : "no lead asked for this date")
          + "</span></div>";
      } else {
        const st = mixList(d.st), src = mixList(d.src);
        h += row("Leads asked", fmtN(d.leads))
          + row("Booked", fmtN(d.booked) + " · " + dash(bookRate(d), pct))
          + row("Cubic feet", d.cfN ? fmtN(d.cf) : "—")
          + row("Average quote", dash(avgQuote(d), money0))
          + row("Top market", st.length ? st[0].k : "—")
          + row("Top source", src.length ? src[0].k : "—");
      }
      h += '<div class="f">Move-date basis' + (iso > TODAY ? " · still ahead of us" : "") + "</div>";
      tip.innerHTML = h;
      tip.classList.add("on");
    }
    function moveTip(e) {
      const w = tip.offsetWidth || 220, hh = tip.offsetHeight || 140;
      let x = e.clientX + 16, y = e.clientY + 16;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + hh > window.innerHeight - 8) y = e.clientY - hh - 14;
      tip.style.left = Math.max(8, x) + "px";
      tip.style.top = Math.max(8, y) + "px";
    }

    load();
  },
});
