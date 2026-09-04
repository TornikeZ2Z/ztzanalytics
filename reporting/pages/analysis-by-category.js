/* CUSTOM BREAKDOWN v2 — a pivot builder over the job book, the lead book, and packing.
 *
 * The v1 page proved the idea (rows × columns, two measures, stacking filters, saved views)
 * and failed on three fronts he named (2026-08-27): the visuals (a wall of naked <select>s
 * beside kit components), the intuition (filters collected through window.prompt), and the
 * data (nothing about estimates vs reality — "packing estimate vs packing real is something
 * i was asked and i could not provide"). v2 keeps the proven engine and replaces all three:
 *
 *   * EVERY control is the kit's: RSC.localSelect for the spec (with grouped options),
 *     RSC.localMulti for page filters — a real checkbox popover with counts and search,
 *     built for this page — and .rs-seg segments for universe / top / chart.
 *   * PRESETS: one click applies a complete breakdown. Most readers never build, they pick;
 *     the builder is there for the ones who do. Saved views live on the same shelf.
 *   * THREE UNIVERSES. Jobs (fct_closing) and Leads (fct_moveboard) as before, plus
 *     PACKING (fct_packing_job) — the mart that already pairs the calendar's packing
 *     estimate with what the crew actually sold, per job. And the Jobs universe gains
 *     estimate-vs-actual measures through the existing Moveboard bridge (quote vs bill).
 *
 * Universes are a SWITCH, not a filter — different grains that must never be added together.
 *
 * WHY THE STATE LIVES OUTSIDE render(): every global slicer move re-enters render() with an
 * empty host, so anything held in the render closure resets the moment someone touches a
 * filter. CB below is module-level for exactly that reason.
 *
 * WHY THE PAGE FILTERS ARE PAGE-LOCAL: RS.state.multi is the GLOBAL bar — the shell's
 * "Clear all" wipes every key in it, and the no-data banner's anyFilter check would read a
 * page-local pick as a global filter and follow the user to every page. So this page keeps
 * its own store and never writes to the shared one.
 */

/* ---- the packing mart's payload contract — shared with packing-control.js, first page
   to load wins, so the two lists MUST stay identical (both lift the mart's full surface). */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_packing_job) {
    RS.DATASETS.fct_packing_job = {
      table: "fct_packing_job",
      cols: ["Job Code", "Day", "Customer", "Foreman", "Foreman Email", "Company",
             "Job Type", "Moving Type", "Foreman Typed",
             "Sold USD", "Quoted USD", "Real CF", "Sold CF", "Total Charge", "Recorded", "Itemised",
             "Boxes Sold", "Tape Sold", "Wrap Sold", "Covers Sold", "Item Lines",
             "Calendar CF", "Inv Boxes", "Inv Furniture", "Inv Wrappable", "Inv Mattresses",
             "Quoted Units", "Packed By Owner", "No Quote", "Has Inventory",
             "Packing Units", "USD per Unit", "USD per 100 CF", "Tape per Box",
             "Cover Cover Pct", "Wrap Cover Pct", "CF Ratio", "Zero Pack", "Quote Leak",
             "Flags", "Event Id", "Calendar Id", "Contract URL", "Calendar Only"],
    };
  }
})();

/* ---------------------------------------------------------------------------------------
   MODULE-LEVEL STATE — survives a re-render caused by a global filter change.
   --------------------------------------------------------------------------------------- */
const CB = {
  universe: "jobs",          // jobs | leads | packing
  rowDim: "Source",
  colDim: "",                // "" = no columns: a flat list
  mA: "Revenue",
  mB: "",                    // "" = single measure
  topN: 20,
  other: true,               // fold everything past Top N into one honest "Other" row
  chart: "bar",              // bar | hbar | stacked | line | donut
  sort: { key: "a", dir: -1 },
  filters: {},               // { dimName: Set(values) } — PAGE-LOCAL, never RS.state.multi
  q: "",                     // the customer / request # search box (the CFO's lens)
  view: "",                  // name of the loaded saved view, for the shelf highlight
  _booted: false,
};

const CB_STORE = "ztzCbViews";

function cbReadViews() {
  try { return JSON.parse(localStorage.getItem(CB_STORE) || "{}") || {}; } catch (e) { return {}; }
}
function cbWriteViews(v) {
  try { localStorage.setItem(CB_STORE, JSON.stringify(v)); } catch (e) { /* private mode: the
    builder still works, it just cannot remember. Never break the page over a saved view. */ }
}
/* Only the spec travels — never the data, and never the global filter state. A link that
   silently changed someone's date range would be a booby trap. */
function cbSpec() {
  return { universe: CB.universe, rowDim: CB.rowDim, colDim: CB.colDim, mA: CB.mA, mB: CB.mB,
           topN: CB.topN, other: CB.other, chart: CB.chart, sort: CB.sort,
           q: CB.q || "",
           filters: Object.keys(CB.filters).reduce((o, k) => {
             const s = CB.filters[k]; if (s && s.size) o[k] = [...s]; return o; }, {}) };
}
function cbApply(spec) {
  if (!spec || typeof spec !== "object") return;
  ["universe", "rowDim", "colDim", "mA", "mB", "chart"].forEach(k => {
    if (typeof spec[k] === "string") CB[k] = spec[k]; });
  if (typeof spec.topN === "number") CB.topN = spec.topN;
  if (typeof spec.other === "boolean") CB.other = spec.other;
  if (spec.sort && typeof spec.sort === "object") CB.sort = spec.sort;
  CB.q = typeof spec.q === "string" ? spec.q : "";
  CB.filters = {};
  Object.keys(spec.filters || {}).forEach(k => { CB.filters[k] = new Set(spec.filters[k] || []); });
}

/* ---- one-click starting points. Each is a complete spec; the shelf renders them as chips.
   These are the questions people actually walk up with — the packing pair is the one he
   was asked for and could not answer (2026-08-27). */
const CB_PRESETS = [
  { name: "Revenue by Source", spec: { universe: "jobs", rowDim: "Source", colDim: "", mA: "Revenue", mB: "", chart: "bar" } },
  { name: "Jobs by Foreman × Month", spec: { universe: "jobs", rowDim: "Foreman", colDim: "Month", mA: "Total Jobs", mB: "", chart: "stacked" } },
  { name: "Revenue by State", spec: { universe: "jobs", rowDim: "State", colDim: "", mA: "Revenue", mB: "", chart: "hbar" } },
  { name: "Quote vs Revenue by Sales Person", spec: { universe: "jobs", rowDim: "Sales Person", colDim: "", mA: "Quote → Revenue %", mB: "Revenue", chart: "bar" } },
  { name: "Booking Rate by Source", spec: { universe: "leads", rowDim: "Source", colDim: "", mA: "Booking Rate", mB: "Total Leads", chart: "bar" } },
  { name: "Leads by Month", spec: { universe: "leads", rowDim: "Year-Month", colDim: "", mA: "Total Leads", mB: "", chart: "line", topN: 0 } },
  { name: "Packing: quoted vs sold by Foreman", spec: { universe: "packing", rowDim: "Foreman", colDim: "", mA: "Packing Quoted $", mB: "Packing Sold $", chart: "bar" } },
  { name: "Packing gap by Month", spec: { universe: "packing", rowDim: "Year-Month", colDim: "", mA: "Sold vs Quoted %", mB: "Packing Sold $", chart: "line", topN: 0 } },
];

/* A NAMED module-level function: every control redraws the whole page (the spec bar itself
   changes shape when the universe or the column dimension moves). */
async function cbRender(host) {
    const isLeads = CB.universe === "leads";
    const isPacking = CB.universe === "packing";

    // Gross Profit is a composite over three more datasets; load them only when someone
    // actually picks it, or the page pays for refunds+salaries on every visit.
    const needsPnl = !isLeads && !isPacking &&
      (CB.mA === "Gross Profit" || CB.mB === "Gross Profit" ||
       CB.mA === "Gross Margin" || CB.mB === "Gross Margin");
    const loads = [RS.load("closing"), RS.load("moveboard")];
    if (isPacking) loads.push(RS.load("fct_packing_job"));
    if (needsPnl) loads.push(RS.load("refunds"), RS.load("sales_salaries"), RS.load("helper_salaries"));
    const [closingAll, moveboardAll, packingAll] = await Promise.all(loads);
    const M = RS.M;
    const esc = RSC.esc;
    const nz = fmt => v => (v == null || (typeof v === "number" && isNaN(v))) ? "—" : fmt(v);
    const num = v => (v == null || isNaN(v)) ? 0 : +v;

    /* ---- one-time boot: a link's spec beats the last-used view -------------------- */
    if (!CB._booted) {
      CB._booted = true;
      try {
        const m = /(?:[#&])cb=([^&]+)/.exec(location.hash || "");
        if (m) cbApply(JSON.parse(decodeURIComponent(m[1])));
        else { const last = cbReadViews()._last; if (last) cbApply(last); }
      } catch (e) { /* a malformed link must not stop the page loading */ }
      // the loads above were chosen from the PRE-boot spec; a restored packing view or a
      // profit measure needs datasets this pass never asked for. One re-entry fixes the
      // set; _booted guards it from ever looping.
      return cbRender(host);
    }

    /* ---- moveboard bridge: Request Joinkey -> the lead behind a job ----------------
       Stamped with the array it was built from: RS.refresh() and the admin "view as"
       preview replace cached rows without clearing this map. */
    if (!RS._mbBridge || RS._mbBridge.src !== moveboardAll) {
      const map = new Map();
      moveboardAll.forEach(r => {
        const k = r["Request Joinkey"];
        if (k && !map.has(k)) map.set(k, r);
      });
      RS._mbBridge = { src: moveboardAll, map };
    }
    const bridge = RS._mbBridge.map;
    const mbOf = r => bridge.get(r["Request Joinkey"]);

    /* ---- dimensions -------------------------------------------------------------- */
    const MONTHS = "JanFebMarAprMayJunJulAugSepOctNovDec";
    const byMonth = (a, b) => MONTHS.indexOf(a) - MONTHS.indexOf(b);
    const byBand = (a, b) => (RS.num(String(a).replace(/[^0-9]/g, "").slice(0, 5)) || 9e9) -
                             (RS.num(String(b).replace(/[^0-9]/g, "").slice(0, 5)) || 9e9);
    const byText = (a, b) => String(a).localeCompare(String(b));
    // fct_packing_job carries no rs-core date stamps (no dateCols in its spec), so the time
    // dimensions parse `Day` ("YYYY-MM-DD") directly.
    const pkY = r => String(r.Day || "").slice(0, 4);
    const pkM = r => parseInt(String(r.Day || "").slice(5, 7), 10) || 0;
    const yes = v => +v === 1;

    // kind:'lead' marks a dimension that needs the Moveboard join, so the page can be honest
    // about how many jobs actually matched a lead before anyone reads the "—" bucket as real.
    const JOB_DIMS = {
      "Source":        { fn: r => r.Source, group: "Job" },
      /* the CFO's verification pair (Tornike 2026-08-29): group or search by the
         exact customer / request — search:1 keeps them out of the value pickers
         (78k values would freeze the popover); the search box serves them */
      "Customer":      { fn: r => r.Customer, group: "Job", search: 1 },
      "Request #":     { fn: r => r["Request #"], group: "Job", search: 1 },
      "Foreman":       { fn: r => r.Foreman, group: "Job" },
      "Driver":        { fn: r => r.Driver, group: "Job" },
      "Sales Person":  { fn: r => r["Sales Person"], group: "Job" },
      "State":         { fn: r => r["State Name"] || r.State, group: "Job" },
      "Moving Type":   { fn: r => r["Moving Type"], group: "Job" },
      "Move Type":     { fn: r => r["Move Type"], group: "Job" },
      "Size of Move":  { fn: r => r["Size of Move"], group: "Job" },
      "Revenue Range": { fn: r => r["Bill Range"], sort: byBand, group: "Job" },
      "Crew Size":     { fn: r => r["Crew Size"], sort: (a, b) => (+a || 0) - (+b || 0), group: "Job" },
      "Company":       { fn: r => r.Company, group: "Job" },
      "Branch Owner":  { fn: r => r["Branch Owner"], group: "Job" },
      "Storage":       { fn: r => r.Storage === "Our Storage" ? "Our Storage" : "No storage", group: "Job" },
      "Part of Day":   { fn: r => r["Job Part of the Day"], group: "Job" },
      "Satisfaction":  { fn: r => { const s = RS.num(r["Satisfaction Score"]);
                          return !s ? "No score" : s >= 10 ? "10" : s >= 8 ? "8–9" : "≤7"; },
                         sort: byText, group: "Job" },
      "Repeat":        { fn: r => (+r["Request Encounter"] > 1 ? "Repeat customer" : "First time"), group: "Job" },
      "Year":          { fn: r => r._y, sort: byText, group: "Time" },
      "Quarter":       { fn: r => r._y + " Q" + Math.ceil(r._m / 3), sort: byText, group: "Time" },
      "Month":         { fn: r => RS.monthName(r._m), sort: byMonth, group: "Time" },
      "Year-Month":    { fn: r => r._y + "-" + String(r._m).padStart(2, "0"), sort: byText, group: "Time" },
      // lead-side, through the bridge
      "Job Type":      { fn: r => { const b = mbOf(r); return b && b["Service Type"]; }, kind: "lead", group: "From the lead" },
      "CF Range":      { fn: r => { const b = mbOf(r); return b && b["CF Range"]; }, kind: "lead", sort: byBand, group: "From the lead" },
      "Lead Source":   { fn: r => { const b = mbOf(r); return b && b.Source; }, kind: "lead", group: "From the lead" },
      "Big Job":       { fn: r => { const b = mbOf(r); return b && b["Big Job Status"]; }, kind: "lead", group: "From the lead" },
      "City":          { fn: r => { const b = mbOf(r); return b && b["City Name"]; }, kind: "lead", group: "From the lead" },
      "County":        { fn: r => { const b = mbOf(r); return b && b["County Name"]; }, kind: "lead", group: "From the lead" },
      "Via QR":        { fn: r => { const b = mbOf(r); return b ? (+b["Via QR"] ? "Scanned the QR code" : "Not via QR") : null; },
                         kind: "lead", sort: (a, b2) => String(b2).localeCompare(String(a)), group: "From the lead" },
      // WEBSITE FORM / UTM (2026-09-03), through the same bridge. Only knowable back to
      // the CMS export's window (2025-05), so "No form on file" is two things at once -- a
      // lead that came in by phone, and a lead older than the export.
      "UTM Campaign":  { fn: r => { const b = mbOf(r); return b && b["UTM Campaign"]; },
                         kind: "lead", group: "From the lead" },
      "UTM Source":    { fn: r => { const b = mbOf(r); return b && b["UTM Source"]; },
                         kind: "lead", group: "From the lead" },
      "Web Form":      { fn: r => { const b = mbOf(r); return b ? (+b["Web Form"] ? "From the website form" : "No form on file") : null; },
                         kind: "lead", sort: (a, b2) => String(b2).localeCompare(String(a)), group: "From the lead" },
      "Paid Ad Click": { fn: r => { const b = mbOf(r); return b ? (+b["Paid Click"] ? "Paid ad click" : "Not a paid click") : null; },
                         kind: "lead", sort: (a, b2) => String(b2).localeCompare(String(a)), group: "From the lead" },
    };
    const LEAD_DIMS = {
      "Source":         { fn: r => r.Source, group: "Lead" },
      "Customer":       { fn: r => r.Customer, group: "Lead", search: 1 },
      "Request #":      { fn: r => r["Job No"], group: "Lead", search: 1 },
      "Status":         { fn: r => r.Status, group: "Lead" },
      "Status Category":{ fn: r => r["Status Category"], group: "Lead" },
      "Service Type":   { fn: r => r["Service Type"], group: "Lead" },
      "Size of Move":   { fn: r => r["Size of Move"], group: "Lead" },
      "State":          { fn: r => r["State Name"] || r.State, group: "Lead" },
      "City":           { fn: r => r["City Name"], group: "Lead" },
      "County":         { fn: r => r["County Name"], group: "Lead" },
      "Assigned":       { fn: r => r.Assigned, group: "Lead" },
      "CF Range":       { fn: r => r["CF Range"], sort: byBand, group: "Lead" },
      "Quote Range":    { fn: r => r["Bill Range"], sort: byBand, group: "Lead" },
      "Big Job":        { fn: r => r["Big Job Status"], group: "Lead" },
      "Via QR":         { fn: r => (+r["Via QR"] ? "Scanned the QR code" : "Not via QR"),
                          sort: (a, b) => String(b).localeCompare(String(a)), group: "Lead" },
      // WEBSITE FORM / UTM (2026-09-03) -- the tags on the link the lead arrived through.
      // Coverage starts 2025-05 (the CMS export's window), so "No form on file" mixes phone
      // leads with leads older than the export; read it with a date filter on.
      "UTM Campaign":   { fn: r => r["UTM Campaign"], group: "Lead" },
      "UTM Source":     { fn: r => r["UTM Source"], group: "Lead" },
      "UTM Medium":     { fn: r => r["UTM Medium"], group: "Lead" },
      "Web Form":       { fn: r => (+r["Web Form"] ? "From the website form" : "No form on file"),
                          sort: (a, b) => String(b).localeCompare(String(a)), group: "Lead" },
      "Paid Ad Click":  { fn: r => (+r["Paid Click"] ? "Paid ad click" : "Not a paid click"),
                          sort: (a, b) => String(b).localeCompare(String(a)), group: "Lead" },
      "Company":        { fn: r => r.Company, group: "Lead" },
      "Year":           { fn: r => r._y, sort: byText, group: "Time" },
      "Quarter":        { fn: r => r._y + " Q" + Math.ceil(r._m / 3), sort: byText, group: "Time" },
      "Month":          { fn: r => RS.monthName(r._m), sort: byMonth, group: "Time" },
      "Year-Month":     { fn: r => r._y + "-" + String(r._m).padStart(2, "0"), sort: byText, group: "Time" },
    };
    const PK_DIMS = {
      "Foreman":       { fn: r => r.Foreman, group: "Job" },
      "Customer":      { fn: r => r.Customer, group: "Job", search: 1 },
      "Request #":     { fn: r => r["Job Code"], group: "Job", search: 1 },
      "Company":       { fn: r => r.Company, group: "Job" },
      "Job Type":      { fn: r => r["Job Type"], group: "Job" },
      "Moving Type":   { fn: r => r["Moving Type"], group: "Job" },
      "Packed by owner": { fn: r => yes(r["Packed By Owner"]) ? "Customer packed" : "Crew packed", group: "Honesty" },
      "Closed out":    { fn: r => yes(r.Recorded) ? "Closed out" : "Not closed yet", group: "Honesty" },
      "Had a quote":   { fn: r => yes(r["No Quote"]) ? "No quote" : "Quoted", group: "Honesty" },
      "Quote leak":    { fn: r => yes(r["Quote Leak"]) ? "Leak suspect" : "OK", group: "Honesty" },
      "Year":          { fn: r => pkY(r), sort: byText, group: "Time" },
      "Quarter":       { fn: r => pkM(r) ? pkY(r) + " Q" + Math.ceil(pkM(r) / 3) : null, sort: byText, group: "Time" },
      "Month":         { fn: r => RS.monthName(pkM(r)), sort: byMonth, group: "Time" },
      "Year-Month":    { fn: r => String(r.Day || "").slice(0, 7), sort: byText, group: "Time" },
    };

    /* ---- measures ----------------------------------------------------------------
       One vocabulary: { label?, group, fmt, fn(rows, bookedRows) }. Registry measures are
       wrapped; the estimate-vs-actual ones are page-local because they read the bridge. */
    const pctS = v => (v > 0 ? "+" : "") + RS.fmtPct(v);
    const quotePairs = rows => rows.map(r => {
      const b = mbOf(r); const q = b ? num(b["Average Quote"]) : 0;
      return q > 0 ? { q, bill: num(r["Total Bill"]) + num(r["Extra Bill From Trips"]) } : null;
    }).filter(Boolean);

    const JOB_MEAS = {
      "Total Jobs":       { group: "Volume", reg: true },
      "Foreman Hours":    { group: "Volume", reg: "Hours Worked by Forman" },
      "Jobs per 100 Hours": { group: "Volume", reg: true, nonAdd: true },
      "Storage Jobs":     { group: "Volume", reg: "Total Storage Jobs" },
      "Revenue":          { group: "Money", reg: true },
      "Job Revenue (excl. trips)": { group: "Money", reg: "Total Revenue" },
      "Revenue from Trips": { group: "Money", reg: "Additional Revenue from Trips" },
      "Net Cash":         { group: "Money", reg: true },
      "Card Payment":     { group: "Money", reg: true },
      "Cash Collected (Net + Card)": { group: "Money", reg: "Operating Profit Before Commission" },
      "Avg Revenue / Job": { group: "Money", reg: "Average Bill", nonAdd: true },
      "Total Tips":       { group: "Money", reg: true },
      "Packing Written":  { group: "Money", reg: "Total Packing Written" },
      "Total Expenses":   { group: "Cost & profit", reg: true },
      "Profit (sheet)":   { group: "Cost & profit", reg: "Profit" },
      "Gross Profit":     { group: "Cost & profit", reg: "Operational Profit by Formula", seg: true },
      "Gross Margin":     { group: "Cost & profit", reg: "Operational Profit Margin", seg: true, nonAdd: true },
      "Avg Quote (est.)": { group: "Estimate vs actual", fmt: RS.money, nonAdd: true, fn: rows => {
          const p = quotePairs(rows); return p.length ? p.reduce((a, x) => a + x.q, 0) / p.length : null; } },
      "Quote → Revenue %": { group: "Estimate vs actual", fmt: pctS, nonAdd: true, fn: rows => {
          const p = quotePairs(rows);
          const q = p.reduce((a, x) => a + x.q, 0), b = p.reduce((a, x) => a + x.bill, 0);
          return q > 0 ? (b - q) / q : null; }, kind: "lead" },
      "Avg Satisfaction": { group: "Quality", fmt: v => (+v).toFixed(1), nonAdd: true, fn: rows => {
          const s = rows.map(r => RS.num(r["Satisfaction Score"])).filter(x => x > 0);
          return s.length ? s.reduce((a, b) => a + b, 0) / s.length : null; } },
    };
    const LEAD_MEAS = {
      "Total Leads":      { group: "Funnel", reg: true },
      "Qualified Leads":  { group: "Funnel", reg: true },
      "Confirmed Leads":  { group: "Funnel", reg: true },
      "Dead Leads":       { group: "Funnel", reg: true },
      "Booking Rate":     { group: "Funnel", fmt: RS.fmtPct, nonAdd: true,
                            fn: (rows, booked) => RS.bookingRate(rows, booked || []) },
      "Average Quote (avg)": { group: "Money", reg: true, nonAdd: true },
      "Estimated CF":     { group: "Volume", reg: "Total Estimated CF" },
      "Big Jobs":         { group: "Volume", reg: true },
    };
    // Packing honesty: the quoted-vs-sold comparison only means something on jobs that BOTH
    // carried a quote AND have been closed out — `pkPairs`. Sums over everything would blame
    // open jobs and unquoted jobs for a gap that is just missing paperwork.
    const pkPairs = rows => rows.filter(r => yes(r.Recorded) && !yes(r["No Quote"]) &&
                                             r["Quoted USD"] != null && r["Sold USD"] != null);
    const PK_MEAS = {
      "Jobs":             { group: "Volume", fmt: RS.fmtN, fn: rows => rows.length },
      "Real CF moved":    { group: "Volume", fmt: RS.fmtN, fn: rows => rows.reduce((a, r) => a + num(r["Real CF"]), 0) },
      "Packing Quoted $": { group: "Estimate vs actual", fmt: RS.money,
                            fn: rows => pkPairs(rows).reduce((a, r) => a + num(r["Quoted USD"]), 0) },
      "Packing Sold $":   { group: "Estimate vs actual", fmt: RS.money,
                            fn: rows => pkPairs(rows).reduce((a, r) => a + num(r["Sold USD"]), 0) },
      "Sold − Quoted $":  { group: "Estimate vs actual", fmt: v => (v > 0 ? "+" : "") + RS.money(v), nonAdd: true,
                            fn: rows => { const p = pkPairs(rows);
                              return p.length ? p.reduce((a, r) => a + num(r["Sold USD"]) - num(r["Quoted USD"]), 0) : null; } },
      "Sold vs Quoted %": { group: "Estimate vs actual", fmt: pctS, nonAdd: true, fn: rows => {
                              const p = pkPairs(rows);
                              const q = p.reduce((a, r) => a + num(r["Quoted USD"]), 0);
                              const s = p.reduce((a, r) => a + num(r["Sold USD"]), 0);
                              return q > 0 ? (s - q) / q : null; } },
      "Avg Quoted / Job": { group: "Estimate vs actual", fmt: RS.money, nonAdd: true, fn: rows => {
                              const p = pkPairs(rows);
                              return p.length ? p.reduce((a, r) => a + num(r["Quoted USD"]), 0) / p.length : null; } },
      "Avg Sold / Job":   { group: "Estimate vs actual", fmt: RS.money, nonAdd: true, fn: rows => {
                              const p = pkPairs(rows);
                              return p.length ? p.reduce((a, r) => a + num(r["Sold USD"]), 0) / p.length : null; } },
      "Sold $ per 100 CF": { group: "Estimate vs actual", fmt: RS.money, nonAdd: true, fn: rows => {
                              const p = rows.filter(r => yes(r.Recorded));
                              const cf = p.reduce((a, r) => a + num(r["Real CF"]), 0);
                              return cf > 0 ? 100 * p.reduce((a, r) => a + num(r["Sold USD"]), 0) / cf : null; } },
      "Quote-leak Jobs":  { group: "Honesty", fmt: RS.fmtN, fn: rows => rows.filter(r => yes(r["Quote Leak"])).length },
      "Zero-pack Jobs":   { group: "Honesty", fmt: RS.fmtN, fn: rows => rows.filter(r => yes(r["Zero Pack"])).length },
      "No-quote Jobs":    { group: "Honesty", fmt: RS.fmtN, fn: rows => rows.filter(r => yes(r["No Quote"])).length },
    };

    const DIMS = isLeads ? LEAD_DIMS : isPacking ? PK_DIMS : JOB_DIMS;
    const MEAS = isLeads ? LEAD_MEAS : isPacking ? PK_MEAS : JOB_MEAS;
    const MEAS_KEYS = Object.keys(MEAS);
    // a spec restored from a link or a saved view may name something this universe lacks
    if (!DIMS[CB.rowDim]) CB.rowDim = Object.keys(DIMS)[0];
    if (CB.colDim && !DIMS[CB.colDim]) CB.colDim = "";
    if (!MEAS[CB.mA]) CB.mA = isLeads ? "Total Leads" : isPacking ? "Packing Sold $" : "Revenue";
    if (CB.mB && !MEAS[CB.mB]) CB.mB = "";

    const measure = (name) => {
      const d = MEAS[name];
      if (!d) return { fmt: RS.fmtN, seg: () => null };
      if (d.fn) return { fmt: d.fmt, seg: d.fn };
      const reg = M[d.reg === true ? name : d.reg];
      if (!reg) return { fmt: RS.fmtN, seg: () => null };
      if (d.seg) {
        // segment-aware composite (Gross Profit): scope its cross-dataset terms to the
        // segment's own Unique Keys, the way the registry's _msrK contract expects
        return { fmt: reg.fmt, seg: rowsIn => {
          const keys = new Set(); rowsIn.forEach(r => keys.add(r["Unique Key"]));
          return reg.fn(rowsIn, keys);
        } };
      }
      return { fmt: reg.fmt, seg: rowsIn => reg.fn(rowsIn) };
    };

    /* ---- scope: global bar + page filters ----------------------------------------
       Packing rows respect Date / Company / Foreman from the global bar by hand: the mart
       has no rs-core date stamps and no RS.FIELDS mapping, and quietly ignoring the bar
       would show a page claiming a scope it is not applying. */
    const DSN = isLeads ? "moveboard" : "closing";
    let scoped;
    if (isPacking) {
      RS._cbPk = true;
      const st = RS.state;
      const co = st.multi.company, fo = st.multi.foreman;
      scoped = (packingAll || []).filter(r => {
        const d = String(r.Day || "").slice(0, 10);
        if (st.dateFrom && (!d || d < st.dateFrom)) return false;
        if (st.dateTo && (!d || d > st.dateTo)) return false;
        if (co && co.size && !co.has(String(r.Company == null ? "—" : r.Company))) return false;
        if (fo && fo.size && !fo.has(String(r.Foreman == null ? "—" : r.Foreman))) return false;
        return true;
      });
    } else {
      scoped = RS.filtered(DSN, isLeads ? moveboardAll : closingAll);
    }

    /* Booking Rate scores qualified on CREATE date and confirmed on BOOKED date, so a
       segment needs BOTH row sets grouped the same way. */
    const bookedAll = isLeads ? RS.filtered("moveboard", moveboardAll, { dateColumn: "Booked Date" }) : null;

    const keyOf = (dimName, r) => {
      const d = DIMS[dimName]; if (!d) return "—";
      const v = d.fn(r);
      return (v == null || v === "") ? "—" : String(v);
    };
    const activeFilters = Object.keys(CB.filters).filter(k => DIMS[k] && CB.filters[k] && CB.filters[k].size);
    // the customer / request search: case-insensitive substring over the pair,
    // so the CFO types a name or a number and sees exactly what we calculated
    const qNeedle = String(CB.q || "").trim().toLowerCase();
    const qOf = isLeads ? (r => (r.Customer || "") + " " + (r["Job No"] || ""))
      : isPacking ? (r => (r.Customer || "") + " " + (r["Job Code"] || ""))
      : (r => (r.Customer || "") + " " + (r["Request #"] || ""));
    const passes = r => (!qNeedle || qOf(r).toLowerCase().indexOf(qNeedle) >= 0)
      && activeFilters.every(k => CB.filters[k].has(keyOf(k, r)));
    const anyFilter = activeFilters.length || qNeedle;
    const rows = anyFilter ? scoped.filter(passes) : scoped;
    const bookedRows = isLeads
      ? (anyFilter ? bookedAll.filter(passes) : bookedAll) : null;

    const mA = measure(CB.mA), mB = CB.mB ? measure(CB.mB) : null;

    /* ---- the group engine: rows x columns (unchanged from v1 — it never writes to the
       shared row objects; stamping them once made this page read a previous render's key) */
    function group() {
      const rk = new Map(), ck = new Map();
      const cell = new Map();
      rows.forEach(r => {
        const a = keyOf(CB.rowDim, r);
        const b = CB.colDim ? keyOf(CB.colDim, r) : "";
        if (!rk.has(a)) rk.set(a, []); rk.get(a).push(r);
        if (CB.colDim) { if (!ck.has(b)) ck.set(b, []); ck.get(b).push(r); }
        const ckey = a + " " + b;
        if (!cell.has(ckey)) cell.set(ckey, []); cell.get(ckey).push(r);
      });
      const rkB = new Map(), cellB = new Map();
      if (isLeads && (CB.mA === "Booking Rate" || CB.mB === "Booking Rate")) {
        bookedRows.forEach(r => {
          const a = keyOf(CB.rowDim, r);
          const b = CB.colDim ? keyOf(CB.colDim, r) : "";
          if (!rkB.has(a)) rkB.set(a, []); rkB.get(a).push(r);
          const ckey = a + " " + b;
          if (!cellB.has(ckey)) cellB.set(ckey, []); cellB.get(ckey).push(r);
        });
      }

      const dimSort = DIMS[CB.rowDim] && DIMS[CB.rowDim].sort;
      let rowKeys = [...rk.keys()];
      if (dimSort) rowKeys.sort(dimSort);
      else rowKeys.sort((a, b) => (num(mA.seg(rk.get(b), rkB.get(b))) - num(mA.seg(rk.get(a), rkB.get(a)))));

      let other = null;
      if (CB.topN && rowKeys.length > CB.topN) {
        const keep = rowKeys.slice(0, CB.topN), rest = rowKeys.slice(CB.topN);
        if (CB.other && rest.length) {
          const restRows = rest.reduce((acc, k) => acc.concat(rk.get(k)), []);
          const restB = rest.reduce((acc, k) => acc.concat(rkB.get(k) || []), []);
          other = { key: `Other (${rest.length} ${rest.length === 1 ? "category" : "categories"})`,
                    rows: restRows, booked: restB, keys: rest };
        }
        rowKeys = keep;
      }

      const colSort = CB.colDim && DIMS[CB.colDim] && DIMS[CB.colDim].sort;
      let colKeys = CB.colDim ? [...ck.keys()] : [""];
      if (CB.colDim) {
        if (colSort) colKeys.sort(colSort);
        else colKeys.sort((a, b) => num(mA.seg(ck.get(b))) - num(mA.seg(ck.get(a))));
      }
      return { rk, ck, cell, rkB, cellB, rowKeys, colKeys, other };
    }

    /* ---- honesty lines ------------------------------------------------------------ */
    const usesLeadDim = !isLeads && !isPacking &&
      [CB.rowDim, CB.colDim].concat(activeFilters).some(d => d && JOB_DIMS[d] && JOB_DIMS[d].kind === "lead")
      || (!isLeads && !isPacking && [CB.mA, CB.mB].some(k => k && JOB_MEAS[k] && JOB_MEAS[k].kind === "lead"));
    let coverage = "";
    if (usesLeadDim && rows.length) {
      const matched = rows.reduce((n, r) => n + (mbOf(r) ? 1 : 0), 0);
      if (matched < rows.length) {
        coverage = `${RS.fmtN(matched)} of ${RS.fmtN(rows.length)} jobs matched a Moveboard lead — `
                 + `the other ${RS.fmtN(rows.length - matched)} sit in “—” because there is no lead to read, not because the value is empty.`;
      }
    }
    if (isPacking && rows.length) {
      const pairs = pkPairs(rows).length;
      const open = rows.filter(r => !yes(r.Recorded)).length;
      const noq = rows.filter(r => yes(r["No Quote"])).length;
      coverage = `Quoted-vs-sold compares only the ${RS.fmtN(pairs)} jobs that carry BOTH a calendar quote and a closed-out sale`
               + (open ? ` — ${RS.fmtN(open)} not closed out yet` : "")
               + (noq ? `${open ? "," : " —"} ${RS.fmtN(noq)} never quoted` : "") + ".";
    }

    /* ---- page shell -------------------------------------------------------------- */
    const NOUN = isLeads ? "leads" : "jobs";
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Custom Breakdown</h1>
        <p>Pick a starting point, or build your own — <b>${RS.fmtN(rows.length)}</b>
           ${NOUN} in scope${activeFilters.length ? ` after ${activeFilters.length} page filter${activeFilters.length === 1 ? "" : "s"}` : ""}</p>
      </div>
      <div class="cb-shelf" id="cbShelf"></div>
      <div class="panel cb-deck" id="cbDeck">
        <div class="cb-row" id="cbRow1"></div>
        <div class="cb-row cb-row2" id="cbRow2"></div>
      </div>
      ${coverage ? `<div class="rs-hint cb-note" id="cbCov">${esc(coverage)}</div>` : ""}
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div id="trend"></div>`;

    if (!document.getElementById("cbCss")) {
      const st = document.createElement("style");
      st.id = "cbCss";
      st.textContent = `
        /* Everything visible is the kit's (.rs-slicer / .rs-seg / .rs-btn / .rs-pill /
           .rs-hint / .rs-table / .panel). This sheet says only what the kit cannot: the
           preset shelf, the two-row builder deck, and the pivot's sticky needs. */

        /* the shelf: one-click starting points + the reader's own saved views */
        .cb-shelf{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 12px}
        .cb-preset{border:1px solid var(--line);background:var(--panel);border-radius:999px;
          padding:6px 13px;font-size:12px;font-weight:650;color:var(--muted);cursor:pointer;
          transition:border-color .12s,color .12s}
        .cb-preset:hover{border-color:var(--brand);color:var(--ink)}
        .cb-preset.mine{border-style:dashed}
        .cb-preset.on{border-color:var(--brand);background:var(--brand-glow);color:var(--ink)}
        .cb-preset .x{margin-left:7px;color:var(--faint);font-weight:800}
        .cb-preset .x:hover{color:var(--red)}

        /* the builder deck: row 1 reads as a sentence, row 2 refines it */
        .cb-deck{display:flex;flex-direction:column;gap:10px;padding:12px 14px}
        .cb-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
        .cb-row2{border-top:1px solid var(--line);padding-top:10px}
        .cb-word{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
          color:var(--faint);margin:0 1px}
        .cb-act{display:flex;gap:6px;margin-left:auto}
        .cb-fdel{border:0;background:transparent;color:var(--faint);cursor:pointer;
          font-size:12px;padding:2px 2px 2px 0;margin-left:-4px}
        .cb-fdel:hover{color:var(--red)}
        .cb-q{border:1px solid var(--line);background:transparent;color:var(--ink);
          border-radius:9px;padding:6px 10px;font-size:12.5px;outline:0;width:200px}
        .cb-q:focus{border-color:var(--brand)}
        .cb-savebox{display:flex;gap:6px;align-items:center}
        .cb-savebox input{border:1px solid var(--line);background:transparent;color:var(--ink);
          border-radius:9px;padding:6px 10px;font-size:12.5px;outline:0;width:170px}
        .cb-savebox input:focus{border-color:var(--brand)}

        .rs-hint.cb-note{background:var(--warn-bg);border:1px solid var(--line-2);
          border-radius:10px;padding:9px 12px;color:var(--ink)}
        .cb-flat{margin:0}
        .cb-void{margin:0;padding:18px}

        /* ---- the pivot: what .rs-table cannot say (sticky first column + total row) */
        .rs-table.cb-piv td{white-space:nowrap}
        .rs-table.cb-piv td:first-child,.rs-table.cb-piv th:first-child{position:sticky;left:0}
        .rs-table.cb-piv tbody td:first-child{background:var(--panel)}
        .rs-table.cb-piv tbody tr:hover td:first-child{background:var(--panel-2)}
        .rs-table.cb-piv th[data-s]{cursor:pointer;user-select:none}
        .rs-table.cb-piv th[data-s]:hover{color:var(--brand)}
        .rs-table.cb-piv td .b{font-size:10.5px;color:var(--muted)}
        .rs-table.cb-piv tbody tr.cb-tot td,
        .rs-table.cb-piv tbody tr.cb-tot:hover td{border-top:2px solid var(--line-2);font-weight:800;
          background:var(--panel-2);position:sticky;bottom:0}
        .cb-emptychart{display:flex;align-items:center;justify-content:center;height:100%;
          text-align:center;color:var(--muted);font-size:13px;padding:0 24px}`;
      document.head.appendChild(st);
    }

    const redraw = () => cbRender(host);
    // filter-edit continuity: the whole page re-renders on every change, which would slam
    // the checkbox popover shut after each tick. The dim being edited re-opens on remount;
    // touching ANY other control ends the session.
    const go = fn => v => { CB._editF = ""; fn(v); redraw(); };
    const $ = id => document.getElementById(id);

    /* ---- the preset shelf --------------------------------------------------------- */
    (function shelf() {
      const views = cbReadViews();
      const names = Object.keys(views).filter(k => k !== "_last").sort();
      const sh = $("cbShelf");
      const curSpec = JSON.stringify(cbSpec());
      const mk = (label, spec, mine, name) => {
        const b = document.createElement("button");
        const active = JSON.stringify(Object.assign(cbSpec(), spec)) === curSpec && CB.view === (name || "");
        b.className = "cb-preset" + (mine ? " mine" : "") + (active ? " on" : "");
        b.innerHTML = esc(label) + (mine ? `<span class="x" title="Forget this view">✕</span>` : "");
        b.onclick = e => {
          if (mine && e.target.classList.contains("x")) {
            const v = cbReadViews(); delete v[name]; cbWriteViews(v);
            if (CB.view === name) CB.view = "";
            redraw(); return;
          }
          cbApply(spec); CB.view = name || ""; redraw();
        };
        sh.appendChild(b);
      };
      CB_PRESETS.forEach(p => mk(p.name, Object.assign({ topN: 20, filters: {} }, p.spec), false, ""));
      names.forEach(n => mk("★ " + n, views[n], true, n));
    })();

    /* ---- the builder deck --------------------------------------------------------- */
    const withGroups = defs => {
      const out = []; let last = null;
      Object.keys(defs).forEach(k => {
        const g = defs[k].group || "";
        if (g !== last) { out.push({ div: g }); last = g; }
        out.push({ v: k, l: k });
      });
      return out;
    };
    const row1 = $("cbRow1");
    const word = t => { const s = document.createElement("span"); s.className = "cb-word"; s.textContent = t; row1.appendChild(s); };

    // universe segment
    const uni = document.createElement("div");
    uni.className = "rs-seg";
    uni.innerHTML = [["jobs", "Jobs"], ["leads", "Leads"], ["packing", "Packing"]]
      .map(([v, l]) => `<button data-u="${v}" class="${CB.universe === v ? "on" : ""}">${l}</button>`).join("");
    uni.querySelectorAll("button").forEach(b => b.onclick = () => {
      if (CB.universe === b.dataset.u) return;
      CB._editF = "";
      CB.universe = b.dataset.u; CB.filters = {}; CB.q = ""; CB.colDim = ""; CB.mB = ""; CB.view = "";
      // sensible landing spot per universe, not a stale carry-over
      if (CB.universe === "packing") { CB.rowDim = "Foreman"; CB.mA = "Packing Sold $"; }
      else if (CB.universe === "leads") { CB.rowDim = "Source"; CB.mA = "Total Leads"; }
      else { CB.rowDim = "Source"; CB.mA = "Revenue"; }
      redraw();
    });
    row1.appendChild(uni);

    word("show");
    RSC.localSelect(row1, { label: "Measure", values: withGroups(MEAS), value: CB.mA,
      required: true, onChange: go(v => { CB.mA = v; }) });
    word("vs");
    RSC.localSelect(row1, { label: "2nd measure", values: withGroups(MEAS).filter(i => i.div || i.v !== CB.mA),
      value: CB.mB, allLabel: "— nothing —", onChange: go(v => { CB.mB = v; }) });
    word("by");
    RSC.localSelect(row1, { label: "Rows", values: withGroups(DIMS), value: CB.rowDim,
      required: true, onChange: go(v => { CB.rowDim = v; }) });
    word("split by");
    RSC.localSelect(row1, { label: "Columns", values: withGroups(DIMS).filter(i => i.div || i.v !== CB.rowDim),
      value: CB.colDim, allLabel: "— none —", onChange: go(v => { CB.colDim = v; }) });

    /* row 2: page filters as LIVE kit multi-pickers (click to edit, ✕ to drop), then
       Top / Chart segments and the actions. */
    const row2 = $("cbRow2");
    const qIn = document.createElement("input");
    qIn.className = "cb-q"; qIn.id = "cbQ";
    qIn.placeholder = "customer or request #…";
    qIn.value = CB.q || "";
    let qTimer = null;
    qIn.oninput = () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(() => { CB.q = qIn.value; CB._qFocus = 1; redraw(); }, 350);
    };
    row2.appendChild(qIn);
    if (CB._qFocus) {
      CB._qFocus = 0;
      qIn.focus(); qIn.setSelectionRange(qIn.value.length, qIn.value.length);
    }
    const fWord = document.createElement("span"); fWord.className = "cb-word"; fWord.textContent = "filter"; row2.appendChild(fWord);
    activeFilters.concat(Object.keys(CB.filters).filter(k => DIMS[k] && !activeFilters.includes(k))).forEach(dim => {
      const counts = new Map();
      scoped.forEach(r => { const k = keyOf(dim, r); counts.set(k, (counts.get(k) || 0) + 1); });
      const vals = [...counts.entries()].sort((a, b) => b[1] - a[1])
        .map(([v, n]) => ({ v, l: v, n }));
      RSC.localMulti(row2, { label: dim, values: vals, selected: CB.filters[dim] || [],
        emptyLabel: "pick values…", startOpen: CB._editF === dim,
        onChange: set => { CB._editF = dim;
          if (set.size) CB.filters[dim] = set; else CB.filters[dim] = new Set(); redraw(); } });
      const del = document.createElement("button");
      del.className = "cb-fdel"; del.title = "Remove this filter"; del.textContent = "✕";
      del.onclick = () => { CB._editF = ""; delete CB.filters[dim]; redraw(); };
      row2.appendChild(del);
    });
    RSC.localSelect(row2, { label: "+ Add", values: Object.keys(DIMS)
      .filter(d => !(d in CB.filters) && !DIMS[d].search),
      value: "", allLabel: "a filter…",
      onChange: v => { if (v) { CB.filters[v] = new Set(); CB._editF = v; redraw(); } } });

    const tWord = document.createElement("span"); tWord.className = "cb-word"; tWord.textContent = "top"; row2.appendChild(tWord);
    const topSeg = document.createElement("div"); topSeg.className = "rs-seg";
    topSeg.innerHTML = [10, 20, 50, 0].map(n =>
      `<button data-n="${n}" class="${n === CB.topN ? "on" : ""}">${n || "All"}</button>`).join("");
    topSeg.querySelectorAll("button").forEach(b => b.onclick = () => { CB._editF = ""; CB.topN = +b.dataset.n; redraw(); });
    row2.appendChild(topSeg);

    const cWord = document.createElement("span"); cWord.className = "cb-word"; cWord.textContent = "chart"; row2.appendChild(cWord);
    const chSeg = document.createElement("div"); chSeg.className = "rs-seg";
    chSeg.innerHTML = [["bar", "Bars"], ["hbar", "Rows"], ["stacked", "Stacked"], ["line", "Line"], ["donut", "Donut"]]
      .map(([v, l]) => `<button data-c="${v}" class="${v === CB.chart ? "on" : ""}">${l}</button>`).join("");
    row2.appendChild(chSeg);

    const act = document.createElement("div"); act.className = "cb-act";
    act.innerHTML = `<button class="rs-btn" id="cbSave">Save view</button>
      <button class="rs-btn" id="cbLink">Copy link</button>
      <button class="rs-btn" id="cbCsv">CSV</button>
      <button class="rs-btn" id="cbReset">Reset</button>`;
    row2.appendChild(act);

    /* ---- KPI strip --------------------------------------------------------------- */
    const disp = k => k;
    const kpiItems = isLeads ? [
      { label: "Total Leads", value: RS.fmtN(M["Total Leads"].fn(rows)), sub: "in scope" },
      { label: "Qualified", value: RS.fmtN(M["Qualified Leads"].fn(rows)), sub: "not marked a bad lead" },
      { label: "Confirmed", value: RS.fmtN(M["Confirmed Leads"].fn(rows)), sub: "booked" },
      { label: "Booking Rate", value: nz(RS.fmtPct)(RS.bookingRate(rows, bookedRows)), sub: "confirmed ÷ qualified" },
      { label: disp(CB.mA), value: nz(mA.fmt)(mA.seg(rows, bookedRows)), sub: "the measure on screen" },
    ] : isPacking ? [
      { label: "Jobs", value: RS.fmtN(rows.length), sub: "in scope" },
      { label: "Packing Quoted", value: RS.moneyC(PK_MEAS["Packing Quoted $"].fn(rows)), sub: "calendar estimate, paired jobs" },
      { label: "Packing Sold", value: RS.moneyC(PK_MEAS["Packing Sold $"].fn(rows)), sub: "closing sheet, paired jobs" },
      { label: "Sold vs Quoted", value: nz(pctS)(PK_MEAS["Sold vs Quoted %"].fn(rows)), sub: "the gap he was asked about" },
      { label: disp(CB.mA), value: nz(mA.fmt)(mA.seg(rows)), sub: "the measure on screen" },
    ] : [
      { label: "Total Jobs", value: RS.fmtN(M["Total Jobs"].fn(rows)), sub: "closed jobs (incl. trips)" },
      { label: "Revenue", value: RS.moneyC(M["Revenue"].fn(rows)), sub: nz(RS.money)(M["Revenue"].fn(rows)) },
      { label: "Net Cash", value: RS.moneyC(M["Net Cash"].fn(rows)), sub: "cash turned in per job" },
      { label: "Avg Revenue / Job", value: RS.moneyC(M["Average Bill"].fn(rows)), sub: "per job" },
      { label: disp(CB.mA), value: nz(mA.fmt)(mA.seg(rows)), sub: "the measure on screen" },
    ];
    RSC.kpis(document.getElementById("kpis"), kpiItems);

    const noRows = !rows.length;
    if (noRows) {
      document.getElementById("main").innerHTML =
        `<div class="panel"><div class="rs-hint cb-flat">No ${NOUN} for the current filters.</div></div>`;
    }

    /* ---- the pivot --------------------------------------------------------------- */
    function pivotHtml() {
      const G = group();
      if (!G.rowKeys.length) return `<div class="rs-hint cb-void">Nothing to break down.</div>`;
      const grand = mA.seg(rows, bookedRows);
      // a %-of-total over a rate or an average is arithmetic nonsense — drop the column
      const showShare = !(MEAS[CB.mA] && MEAS[CB.mA].nonAdd);
      const cellVal = (rKey, cKey, m) => {
        const rs = G.cell.get(rKey + " " + cKey) || [];
        const bs = G.cellB.get(rKey + " " + cKey) || [];
        return m.seg(rs, bs);
      };
      const rowTotal = (rKey, m) => m.seg(G.rk.get(rKey) || [], G.rkB.get(rKey) || []);

      const cols = CB.colDim ? G.colKeys : [];
      const head = `<tr><th data-s="k">${esc(CB.rowDim)}</th>`
        + cols.map(c => `<th class="num" data-s="c:${esc(c)}">${esc(c === "" ? "—" : c)}</th>`).join("")
        + `<th class="num" data-s="a">${esc(disp(CB.mA))}</th>`
        + (mB ? `<th class="num" data-s="b">${esc(disp(CB.mB))}</th>` : "")
        + (showShare ? `<th class="num" data-s="p">% of total</th>` : "")
        + `<th class="num">${isLeads ? "Leads" : "Jobs"}</th></tr>`;

      const mk = (label, rs, bs, rKey) => {
        const a = rKey != null ? rowTotal(rKey, mA) : mA.seg(rs, bs);
        const b = mB ? (rKey != null ? rowTotal(rKey, mB) : mB.seg(rs, bs)) : null;
        const cells = cols.map(c => {
          const v = rKey != null ? cellVal(rKey, c, mA) : null;
          const vb = (mB && rKey != null) ? cellVal(rKey, c, mB) : null;
          return `<td class="num">${v == null ? "—" : esc(mA.fmt(v))}`
               + (mB ? `<div class="b">${vb == null ? "—" : esc(mB.fmt(vb))}</div>` : "") + `</td>`;
        }).join("");
        const share = (grand && a != null && typeof a === "number") ? a / grand : null;
        return `<tr data-row="${esc(label)}"><td>${esc(label)}</td>${cells}`
             + `<td class="num">${a == null ? "—" : esc(mA.fmt(a))}</td>`
             + (mB ? `<td class="num">${b == null ? "—" : esc(mB.fmt(b))}</td>` : "")
             + (showShare ? `<td class="num">${share == null ? "—" : esc(RS.fmtPct(share))}</td>` : "")
             + `<td class="num">${RS.fmtN(rs.length)}</td></tr>`;
      };

      /* Header sorting re-orders what is on screen without changing which rows made the
         Top N cut, so a click can never quietly swap one category for another. "Other" is
         pinned last either way — it is a bucket, not a competitor. */
      const S = CB.sort || { key: "a", dir: -1 };
      const sortVal = k => {
        if (S.key === "k") return k;
        if (S.key === "a") return num(rowTotal(k, mA));
        if (S.key === "b") return mB ? num(rowTotal(k, mB)) : 0;
        if (S.key === "p") return num(rowTotal(k, mA));
        if (S.key.indexOf("c:") === 0) return num(cellVal(k, S.key.slice(2), mA));
        return 0;
      };
      const ordered = G.rowKeys.slice();
      if (S.key === "k") ordered.sort((a, b) => -S.dir * String(a).localeCompare(String(b)));
      else ordered.sort((a, b) => (sortVal(a) - sortVal(b)) * S.dir);

      let body = ordered.map(k => mk(k, G.rk.get(k) || [], G.rkB.get(k) || [], k)).join("");
      if (G.other) body += mk(G.other.key, G.other.rows, G.other.booked, null);
      // the total is over EVERY row in scope, not the visible ones — it always ties to the
      // KPI strip, and Top N never quietly changes what "total" means
      const tot = `<tr class="cb-tot"><td>Total</td>`
        + cols.map(c => {
            const rs = rows.filter(r => keyOf(CB.colDim, r) === c);
            const bs = isLeads ? bookedRows.filter(r => keyOf(CB.colDim, r) === c) : [];
            const v = mA.seg(rs, bs);
            return `<td class="num">${v == null ? "—" : esc(mA.fmt(v))}</td>`;
          }).join("")
        + `<td class="num">${grand == null ? "—" : esc(mA.fmt(grand))}</td>`
        + (mB ? `<td class="num">${(() => { const v = mB.seg(rows, bookedRows); return v == null ? "—" : esc(mB.fmt(v)); })()}</td>` : "")
        + (showShare ? `<td class="num">${grand ? esc(RS.fmtPct(1)) : "—"}</td>` : "")
        + `<td class="num">${RS.fmtN(rows.length)}</td></tr>`;

      return `<table class="rs-table rs-sticky cb-piv"><thead>${head}</thead><tbody>${body}${tot}</tbody></table>`;
    }

    /* ---- the chart --------------------------------------------------------------- */
    const PAL = ["#b7e23b", "#5b8cff", "#a78bfa", "#fbbf24", "#f87171", "#34d399", "#f472b6", "#38bdf8"];
    function buildChart(canvas) {
      const G = group();
      const labels = G.rowKeys.concat(G.other ? [G.other.key] : []);
      const rowsFor = k => (k === (G.other && G.other.key)) ? G.other.rows : (G.rk.get(k) || []);
      const bookFor = k => (k === (G.other && G.other.key)) ? G.other.booked : (G.rkB.get(k) || []);
      const stacked = CB.chart === "stacked";
      const horiz = CB.chart === "hbar";
      const donut = CB.chart === "donut";
      let datasets;
      // TWO MEASURES, NO COLUMNS -> the comparison chart: measure A and measure B side by
      // side per category. This is the "quoted vs sold" picture he asked for, drawn rather
      // than implied. (With columns, the columns win the series slot as before.)
      if (!CB.colDim && mB && !donut) {
        datasets = [[CB.mA, mA, PAL[0]], [CB.mB, mB, PAL[1]]].map(([label, m, color]) => ({
          label: disp(label),
          type: CB.chart === "line" ? "line" : "bar",
          data: labels.map(k => { const v = m.seg(rowsFor(k), bookFor(k)); return v == null ? null : +(+v).toFixed(2); }),
          backgroundColor: color, borderColor: color,
          borderWidth: CB.chart === "line" ? 2 : 0, borderRadius: 5, pointRadius: 2, tension: .3,
        }));
      } else if (CB.colDim && (stacked || CB.chart === "bar" || CB.chart === "line")) {
        // Keep 7 series and roll the tail into a named 8th so the stack still sums to the row.
        const MAXC = 8;
        const shown = G.colKeys.length > MAXC ? G.colKeys.slice(0, MAXC - 1) : G.colKeys;
        const rest = new Set(G.colKeys.slice(shown.length));
        const series = shown.map(c => ({ label: c === "" ? "—" : c, hit: r => keyOf(CB.colDim, r) === c }));
        if (rest.size) series.push({ label: `Other (${rest.size})`, hit: r => rest.has(keyOf(CB.colDim, r)) });
        datasets = series.map((s, i) => ({
          label: s.label,
          type: CB.chart === "line" ? "line" : "bar",
          data: labels.map(k => {
            const rs = (rowsFor(k) || []).filter(s.hit);
            const bs = (bookFor(k) || []).filter(s.hit);
            const v = mA.seg(rs, bs); return v == null ? null : +(+v).toFixed(2);
          }),
          backgroundColor: PAL[i % PAL.length], borderColor: PAL[i % PAL.length],
          borderWidth: CB.chart === "line" ? 2 : 0, borderRadius: stacked ? 0 : 5,
          pointRadius: 2, tension: .3,
        }));
      } else {
        datasets = [{
          label: disp(CB.mA),
          type: CB.chart === "line" ? "line" : (donut ? "doughnut" : "bar"),
          data: labels.map(k => { const v = mA.seg(rowsFor(k), bookFor(k)); return v == null ? null : +(+v).toFixed(2); }),
          // Past 8 slices, walk the hue circle so every donut arc is its own colour.
          backgroundColor: donut
            ? labels.map((_, i) => labels.length <= PAL.length
                ? PAL[i]
                : `hsl(${Math.round((i * 360) / labels.length)} 68% 56%)`)
            : "#b7e23b",
          borderColor: "#b7e23b", borderWidth: CB.chart === "line" ? 2 : 0,
          borderRadius: 5, pointRadius: 2, tension: .3,
        }];
      }
      const trunc = { callback(v) { const l = this.getLabelForValue ? this.getLabelForValue(v) : v;
        return typeof l === "string" && l.length > 20 ? l.slice(0, 19) + "…" : l; } };
      // EVERY CATEGORY KEEPS ITS NAME (his ask, 2026-08-27): a bar without a label is a bar
      // nobody can quote. autoSkip dropped names once the list grew, so it is OFF on the
      // CATEGORY axis; labels rotate harder and the font steps down as the list grows
      // instead of thinning out. The VALUE axis keeps Chart.js defaults. Full names always
      // sit in the tooltip; truncation only guards the axis against one 40-char customer.
      const catTicks = Object.assign({}, trunc, {
        autoSkip: false,
        maxRotation: horiz ? 0 : (labels.length > 12 ? 60 : 45),
        minRotation: horiz ? 0 : (labels.length > 12 ? 45 : 0),
        font: { size: labels.length > 30 ? 9 : labels.length > 18 ? 10 : 11 },
      });
      const fmtFor = lbl => (mB && lbl === disp(CB.mB)) ? mB.fmt : mA.fmt;
      return new Chart(canvas, {
        type: donut ? "doughnut" : (CB.chart === "line" ? "line" : "bar"),
        data: { labels, datasets },
        options: {
          indexAxis: horiz ? "y" : "x",
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: donut || datasets.length > 1, position: "top", labels: { boxWidth: 12 } },
            tooltip: { callbacks: {
              title: items => items.length ? String(labels[items[0].dataIndex]) : "",
              label: c => `${c.dataset.label}: ${fmtFor(c.dataset.label)(c.raw)}`,
            } },
          },
          scales: donut ? {} : {
            x: { stacked, ticks: horiz ? {} : catTicks },
            y: { stacked, ticks: horiz ? catTicks : {} },
          },
        },
      });
    }

    const mainCard = noRows ? { rerender() {} } : RSC.chartCard(document.getElementById("main"), {
      key: "cb:breakdown",
      title: CB.colDim ? `${disp(CB.mA)} — ${CB.rowDim} × ${CB.colDim}`
           : mB ? `${disp(CB.mA)} vs ${disp(CB.mB)} by ${CB.rowDim}`
           : `${disp(CB.mA)} by ${CB.rowDim}`,
      buildChart,
      buildTable: pivotHtml,
    });

    /* ---- trend: the same breakdown walked month by month -------------------------- */
    const monthKey = r => isPacking ? String(r.Day || "").slice(0, 7)
      : r._y + "-" + String(r._m).padStart(2, "0");
    function trendSpec() {
      const G = group();
      const top = G.rowKeys.filter(k => k !== "—").slice(0, 5);
      const months = [...new Set(rows.map(monthKey))].filter(m => m && m !== "-0").sort().slice(-18);
      const series = top.map(k => {
        const byM = {}, byMB = {};
        (G.rk.get(k) || []).forEach(r => { const mk2 = monthKey(r); (byM[mk2] = byM[mk2] || []).push(r); });
        (G.rkB.get(k) || []).forEach(r => { const mk2 = monthKey(r); (byMB[mk2] = byMB[mk2] || []).push(r); });
        return { key: k, at: mm => (byM[mm] ? mA.seg(byM[mm], byMB[mm] || []) : null) };
      });
      return { top, months, series };
    }
    const monthLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);

    if (!noRows) RSC.chartCard(document.getElementById("trend"), {
      key: "cb:trend",
      title: `Monthly trend — top 5 ${CB.rowDim}`,
      buildChart(canvas) {
        const { months, series } = trendSpec();
        const box = canvas.parentNode;
        const prev = box.querySelector(".cb-emptychart");
        if (prev) prev.remove();
        if (!series.length) {
          canvas.style.display = "none";
          const note = document.createElement("div");
          note.className = "cb-emptychart";
          note.textContent = `Nothing to trend — every row falls in the “—” bucket for ${CB.rowDim}, `
            + "so there is no named category to follow month by month.";
          box.appendChild(note);
          return null;
        }
        canvas.style.display = "";
        const datasets = series.map((s, i) => ({
          type: "line", label: s.key,
          data: months.map(mm => { const v = s.at(mm); return v == null ? null : +(+v).toFixed(2); }),
          borderColor: PAL[i], backgroundColor: PAL[i], borderWidth: 2, pointRadius: 2, tension: .3,
        }));
        return new Chart(canvas, {
          data: { labels: months.map(monthLabel), datasets },
          options: { responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } },
              tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw == null ? "—" : mA.fmt(c.raw)}` } } },
            scales: { x: { ticks: { maxRotation: 45, minRotation: 45, autoSkip: false, font: { size: 10 } } } } },
        });
      },
      buildTable() {
        const { months, series } = trendSpec();
        if (!series.length) {
          return `<div class="rs-hint cb-note">Nothing to trend: every row lands in the “—” bucket for `
            + `<b>${esc(CB.rowDim)}</b>, so there is no named category to follow month by month.</div>`;
        }
        const head = `<tr><th>${esc(CB.rowDim)}</th>`
          + months.map(mm => `<th class="num">${esc(monthLabel(mm))}</th>`).join("") + "</tr>";
        const body = series.map(s => `<tr><td>${esc(s.key === "" ? "—" : s.key)}</td>`
          + months.map(mm => { const v = s.at(mm);
              return `<td class="num">${v == null ? "—" : esc(mA.fmt(v))}</td>`; }).join("")
          + "</tr>").join("");
        return `<table class="rs-table rs-sticky cb-piv"><thead>${head}</thead><tbody>${body}</tbody></table>`;
      },
    });

    /* ---- wiring ------------------------------------------------------------------ */
    chSeg.querySelectorAll("button").forEach(b => b.onclick = () => {
      CB.chart = b.dataset.c;
      chSeg.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
      mainCard.rerender();
    });

    $("cbSave").onclick = () => {
      // an inline name box, not window.prompt — the one control v1 had outside the kit
      const box = document.createElement("span");
      box.className = "cb-savebox";
      box.innerHTML = `<input placeholder="Name this view…" value="${esc(CB.view || "")}">
        <button class="rs-btn pri" data-a="ok">Save</button><button class="rs-btn" data-a="no">Cancel</button>`;
      const btn = $("cbSave");
      btn.replaceWith(box);
      const inp = box.querySelector("input"); inp.focus(); inp.select();
      const done = save => {
        const name = inp.value.trim();
        if (save && name) {
          const v = cbReadViews(); v[name] = cbSpec(); cbWriteViews(v); CB.view = name;
        }
        redraw();
      };
      box.querySelector('[data-a="ok"]').onclick = () => done(true);
      box.querySelector('[data-a="no"]').onclick = () => done(false);
      inp.onkeydown = e => { if (e.key === "Enter") done(true); if (e.key === "Escape") done(false); };
    };
    $("cbLink").onclick = () => {
      const url = location.origin + location.pathname
        + "#page=analysis-by-category&cb=" + encodeURIComponent(JSON.stringify(cbSpec()));
      location.hash = "page=analysis-by-category&cb=" + encodeURIComponent(JSON.stringify(cbSpec()));
      const b = $("cbLink"); const t = b.textContent;
      const done = ok => { b.textContent = ok ? "Copied ✓" : "In the address bar"; setTimeout(() => { b.textContent = t; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
      else done(false);
    };
    $("cbReset").onclick = () => {
      CB.rowDim = Object.keys(DIMS)[0]; CB.colDim = ""; CB.mB = ""; CB.topN = 20;
      CB.chart = "bar"; CB.filters = {}; CB.q = ""; CB.view = ""; redraw();
    };
    $("cbCsv").onclick = () => {
      const G = group();
      const cols = CB.colDim ? G.colKeys : [];
      const escC = v => {
        const s = v == null ? "" : String(v);
        const needs = s.indexOf(",") >= 0 || s.indexOf("\"") >= 0 || s.indexOf("\n") >= 0;
        return needs ? "\"" + s.split("\"").join("\"\"") + "\"" : s;
      };
      const head = [CB.rowDim].concat(cols.map(c => c === "" ? "—" : c), [disp(CB.mA)], mB ? [disp(CB.mB)] : [], ["Rows"]);
      const line = (label, rKey, rs, bs) => [label].concat(
        cols.map(c => { const v = rKey != null ? mA.seg(G.cell.get(rKey + " " + c) || [], G.cellB.get(rKey + " " + c) || []) : ""; return v == null ? "" : v; }),
        [(() => { const v = mA.seg(rs, bs); return v == null ? "" : v; })()],
        mB ? [(() => { const v = mB.seg(rs, bs); return v == null ? "" : v; })()] : [],
        [rs.length]);
      const body = G.rowKeys.map(k => line(k, k, G.rk.get(k) || [], G.rkB.get(k) || []));
      if (G.other) body.push(line(G.other.key, null, G.other.rows, G.other.booked));
      const csv = [head].concat(body).map(r => r.map(escC).join(",")).join("\r\n");
      const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `custom-breakdown-${CB.universe}-${CB.rowDim}${CB.colDim ? "-by-" + CB.colDim : ""}.csv`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(a.href), 0);
    };

    // remember the last spec so the page opens where it was left
    const v = cbReadViews(); v._last = cbSpec(); cbWriteViews(v);

    // sortable pivot headers — delegated, because the table is re-rendered on every change
    document.getElementById("main").addEventListener("click", ev => {
      const th = ev.target.closest && ev.target.closest("th[data-s]");
      if (!th) return;
      const k = th.dataset.s;
      CB.sort = (CB.sort.key === k) ? { key: k, dir: -CB.sort.dir } : { key: k, dir: -1 };
      mainCard.rerender();
    });
}

registerPage({
  id: "analysis-by-category",        // id stays — bookmarks and ACL grants reference it
  group: "overview",
  title: "Custom Breakdown",
  render: cbRender,
});
