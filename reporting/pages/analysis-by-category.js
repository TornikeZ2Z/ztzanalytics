/* CUSTOM BREAKDOWN — a pivot builder over the job book and the lead book.
 *
 * It replaces a two-dropdown viewer ("this measure, by that dimension"). Tornike asked for
 * "multiple different selections and cool stuff": rows BY columns, two measures at once,
 * filters that stack, and a view you can keep. The old page is still in here — Columns = none
 * with one measure IS the old page, so nothing anyone relied on has gone.
 *
 * TWO UNIVERSES, his call. JOBS reads fct_closing (what we did and what it earned). LEADS reads
 * fct_moveboard (what came in and what we booked). They are different grains and must never be
 * added together, so the universe is a switch rather than a filter: every dimension and every
 * measure on screen belongs to the universe you are in.
 *
 * WHY THE STATE LIVES OUTSIDE render(). Every global slicer move re-enters render() with an
 * empty host (index.html), so anything held in the render closure is reset the moment someone
 * touches a filter — you would build a pivot, narrow the date range, and watch the builder snap
 * back to Revenue-by-Source. CB below is module-level for exactly that reason.
 *
 * WHY THE PAGE FILTERS ARE PAGE-LOCAL. Putting them in RS.state.multi looks free and is not:
 * the shell's "Clear all" wipes every key in that object including ours, and the no-data
 * banner's anyFilter check has no RS.FIELDS guard, so a page-local pick would convince the
 * shell a global filter was on -- and follow the user to every page afterwards. So this page
 * keeps its own store and never writes to the shared one.
 */

/* ---------------------------------------------------------------------------------------
   MODULE-LEVEL STATE — survives a re-render caused by a global filter change.
   --------------------------------------------------------------------------------------- */
const CB = {
  universe: "jobs",          // jobs | leads
  rowDim: "Source",
  colDim: "",                // "" = no columns: a flat list, i.e. the old page
  mA: "Revenue",
  mB: "",                    // "" = single measure
  topN: 20,
  other: true,               // fold everything past Top N into one honest "Other" row
  chart: "bar",              // bar | hbar | stacked | line | donut
  sort: { key: "a", dir: -1 },
  filters: {},               // { dimName: Set(values) } — PAGE-LOCAL, never RS.state.multi
  view: "",                  // name of the loaded saved view, for the picker
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
  CB.filters = {};
  Object.keys(spec.filters || {}).forEach(k => { CB.filters[k] = new Set(spec.filters[k] || []); });
}

/* A NAMED module-level function, not an inline method on the registerPage literal. Every
   control on the builder has to redraw the whole page (the spec bar itself changes shape when
   the universe or the column dimension moves), and a method defined as `async render(host){}`
   inside an object literal binds no identifier it can call itself by. */
async function cbRender(host) {
    const [closingAll, moveboardAll] = await Promise.all([RS.load("closing"), RS.load("moveboard")]);
    const M = RS.M;
    const esc = RSC.esc;
    const nz = fmt => v => (v == null || (typeof v === "number" && isNaN(v))) ? "—" : fmt(v);

    /* ---- one-time boot: a link's spec beats the last-used view -------------------- */
    if (!CB._booted) {
      CB._booted = true;
      try {
        const m = /(?:[#&])cb=([^&]+)/.exec(location.hash || "");
        if (m) cbApply(JSON.parse(decodeURIComponent(m[1])));
        else { const last = cbReadViews()._last; if (last) cbApply(last); }
      } catch (e) { /* a malformed link must not stop the page loading */ }
    }

    /* ---- moveboard bridge: Request Joinkey -> the lead behind a job ----------------
       Stamped with the array it was built from. RS.refresh() replaces the cached rows
       without clearing this map, and so does the admin "view as" preview — so an identity
       check is the difference between a stale bridge and a correct one. */
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

    // kind:'lead' marks a dimension that needs the Moveboard join, so the page can be honest
    // about how many jobs actually matched a lead before anyone reads the "—" bucket as real.
    const JOB_DIMS = {
      "Source":        { fn: r => r.Source },
      "Foreman":       { fn: r => r.Foreman },
      "Driver":        { fn: r => r.Driver },
      "Sales Person":  { fn: r => r["Sales Person"] },
      "State":         { fn: r => r["State Name"] || r.State },
      "Moving Type":   { fn: r => r["Moving Type"] },
      "Move Type":     { fn: r => r["Move Type"] },
      "Size of Move":  { fn: r => r["Size of Move"] },
      "Revenue Range": { fn: r => r["Bill Range"], sort: byBand },
      "Crew Size":     { fn: r => r["Crew Size"], sort: (a, b) => (+a || 0) - (+b || 0) },
      "Company":       { fn: r => r.Company },
      "Branch Owner":  { fn: r => r["Branch Owner"] },
      "Year":          { fn: r => r._y, sort: (a, b) => String(a).localeCompare(String(b)) },
      "Quarter":       { fn: r => r._y + " Q" + Math.ceil(r._m / 3), sort: (a, b) => String(a).localeCompare(String(b)) },
      "Month":         { fn: r => RS.monthName(r._m), sort: byMonth },
      "Year-Month":    { fn: r => r._y + "-" + String(r._m).padStart(2, "0"), sort: (a, b) => String(a).localeCompare(String(b)) },
      "Repeat":        { fn: r => (+r["Request Encounter"] > 1 ? "Repeat customer" : "First time") },
      // lead-side, through the bridge
      "Job Type":      { fn: r => { const b = mbOf(r); return b && b["Service Type"]; }, kind: "lead" },
      "CF Range":      { fn: r => { const b = mbOf(r); return b && b["CF Range"]; }, kind: "lead", sort: byBand },
      "Lead Source":   { fn: r => { const b = mbOf(r); return b && b.Source; }, kind: "lead" },
      "Big Job":       { fn: r => { const b = mbOf(r); return b && b["Big Job Status"]; }, kind: "lead" },
      "City":          { fn: r => { const b = mbOf(r); return b && b["City Name"]; }, kind: "lead" },
      "County":        { fn: r => { const b = mbOf(r); return b && b["County Name"]; }, kind: "lead" },
      // Via QR (N2): the postcards carry a QR code that dials its own CallRail number, and
      // until now that fact was erased — the ladder folds those calls into "Post Card" and
      // the scan became indistinguishable from someone typing the number off the card.
      "Via QR":        { fn: r => { const b = mbOf(r); return b ? (+b["Via QR"] ? "Scanned the QR code" : "Not via QR") : null; },
                         kind: "lead", sort: (a, b2) => String(b2).localeCompare(String(a)) },
    };
    const LEAD_DIMS = {
      "Source":         { fn: r => r.Source },
      "Status":         { fn: r => r.Status },
      "Status Category":{ fn: r => r["Status Category"] },
      "Service Type":   { fn: r => r["Service Type"] },
      "Size of Move":   { fn: r => r["Size of Move"] },
      "State":          { fn: r => r["State Name"] || r.State },
      "City":           { fn: r => r["City Name"] },
      "County":         { fn: r => r["County Name"] },
      "Assigned":       { fn: r => r.Assigned },
      "CF Range":       { fn: r => r["CF Range"], sort: byBand },
      "Quote Range":    { fn: r => r["Bill Range"], sort: byBand },
      "Big Job":        { fn: r => r["Big Job Status"] },
      "Via QR":         { fn: r => (+r["Via QR"] ? "Scanned the QR code" : "Not via QR"),
                          sort: (a, b) => String(b).localeCompare(String(a)) },
      "Company":        { fn: r => r.Company },
      "Year":           { fn: r => r._y, sort: (a, b) => String(a).localeCompare(String(b)) },
      "Quarter":        { fn: r => r._y + " Q" + Math.ceil(r._m / 3), sort: (a, b) => String(a).localeCompare(String(b)) },
      "Month":          { fn: r => RS.monthName(r._m), sort: byMonth },
      "Year-Month":     { fn: r => r._y + "-" + String(r._m).padStart(2, "0"), sort: (a, b) => String(a).localeCompare(String(b)) },
    };

    /* ---- measures ---------------------------------------------------------------- */
    const JOB_MEASURES = ["Total Jobs", "Revenue", "Total Revenue", "Net Cash", "Card Payment",
      "Operating Profit Before Commission", "Average Bill", "Hours Worked by Forman",
      "Additional Revenue from Trips"];
    const LEAD_MEASURES = ["Total Leads", "Qualified Leads", "Confirmed Leads", "Dead Leads",
      "Booking Rate", "Average Quote (avg)"];
    const disp = k => k === "Hours Worked by Forman" ? "Foreman Hours" : RS.displayName(k);

    const isLeads = CB.universe === "leads";
    const DIMS = isLeads ? LEAD_DIMS : JOB_DIMS;
    const MEAS = isLeads ? LEAD_MEASURES : JOB_MEASURES;
    // a spec restored from a link or a saved view may name something this universe lacks
    if (!DIMS[CB.rowDim]) CB.rowDim = Object.keys(DIMS)[0];
    if (CB.colDim && !DIMS[CB.colDim]) CB.colDim = "";
    if (MEAS.indexOf(CB.mA) < 0) CB.mA = MEAS[isLeads ? 0 : 1];
    if (CB.mB && MEAS.indexOf(CB.mB) < 0) CB.mB = "";

    const DS = isLeads ? "moveboard" : "closing";
    const ALL = isLeads ? moveboardAll : closingAll;
    const scoped = RS.filtered(DS, ALL);

    /* Booking Rate is the one measure that cannot be computed from a row subset alone: it
       scores qualified on CREATE date and confirmed on BOOKED date (the portal's one official
       formula). So a segment needs BOTH row sets, and the booked side has to be grouped the
       same way. Everything else is a plain fn(rows). */
    const bookedAll = isLeads ? RS.filtered("moveboard", ALL, { dateColumn: "Booked Date" }) : null;
    const measure = (name) => {
      if (name === "Booking Rate") {
        return { fmt: RS.fmtPct, seg: (rowsIn, bookedIn) => RS.bookingRate(rowsIn, bookedIn || []) };
      }
      const m = M[name];
      return { fmt: m ? m.fmt : RS.fmtN, seg: rowsIn => (m ? m.fn(rowsIn) : null) };
    };
    const mA = measure(CB.mA), mB = CB.mB ? measure(CB.mB) : null;

    /* ---- page-local stacking filters --------------------------------------------- */
    const keyOf = (dimName, r) => {
      const d = DIMS[dimName]; if (!d) return "—";
      const v = d.fn(r);
      return (v == null || v === "") ? "—" : String(v);
    };
    const activeFilters = Object.keys(CB.filters).filter(k => DIMS[k] && CB.filters[k] && CB.filters[k].size);
    const passes = r => activeFilters.every(k => CB.filters[k].has(keyOf(k, r)));
    const rows = activeFilters.length ? scoped.filter(passes) : scoped;
    const bookedRows = isLeads
      ? (activeFilters.length ? bookedAll.filter(passes) : bookedAll) : null;

    /* ---- the group engine: rows x columns ----------------------------------------
       Returns plain data. It never writes to the row objects: the cached arrays are shared
       with every other page, and stamping a __dim on them made this page's own table read a
       key from the PREVIOUS render. */
    function group() {
      const rk = new Map(), ck = new Map();      // key -> rows
      const cell = new Map();                    // "row col" -> rows
      rows.forEach(r => {
        const a = keyOf(CB.rowDim, r);
        const b = CB.colDim ? keyOf(CB.colDim, r) : "";
        if (!rk.has(a)) rk.set(a, []); rk.get(a).push(r);
        if (CB.colDim) { if (!ck.has(b)) ck.set(b, []); ck.get(b).push(r); }
        const ckey = a + " " + b;
        if (!cell.has(ckey)) cell.set(ckey, []); cell.get(ckey).push(r);
      });
      // the booked-date twin, for Booking Rate only
      const rkB = new Map(), cellB = new Map();
      if (isLeads && (CB.mA === "Booking Rate" || CB.mB === "Booking Rate")) {
        bookedRows.forEach(r => {
          const a = keyOf(CB.rowDim, r);
          const b = CB.colDim ? keyOf(CB.colDim, r) : "";
          if (!rkB.has(a)) rkB.set(a, []); rkB.get(a).push(r);
          const ckey = a + " " + b;
          if (!cellB.has(ckey)) cellB.set(ckey, []); cellB.get(ckey).push(r);
        });
      }

      const dimSort = DIMS[CB.rowDim] && DIMS[CB.rowDim].sort;
      let rowKeys = [...rk.keys()];
      // value order by default; a dimension with a natural order (Month, bands) keeps it
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
    const num = v => (v == null || isNaN(v)) ? 0 : +v;

    /* ---- honesty: how many jobs actually matched a lead --------------------------- */
    const usesLeadDim = !isLeads && [CB.rowDim, CB.colDim].concat(activeFilters)
      .some(d => d && JOB_DIMS[d] && JOB_DIMS[d].kind === "lead");
    let coverage = "";
    if (usesLeadDim && rows.length) {
      const matched = rows.reduce((n, r) => n + (mbOf(r) ? 1 : 0), 0);
      if (matched < rows.length) {
        coverage = `${RS.fmtN(matched)} of ${RS.fmtN(rows.length)} jobs matched a Moveboard lead — `
                 + `the other ${RS.fmtN(rows.length - matched)} sit in “—” because there is no lead to read, not because the value is empty.`;
      }
    }

    /* ---- page shell -------------------------------------------------------------- */
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Custom Breakdown</h1>
        <p>Pick what to break down, by what, and how — <b>${RS.fmtN(rows.length)}</b>
           ${isLeads ? "leads" : "jobs"} in scope${activeFilters.length ? ` after ${activeFilters.length} page filter${activeFilters.length === 1 ? "" : "s"}` : ""}</p>
      </div>
      <div class="panel rs-bar" id="cbSpec"></div>
      ${coverage ? `<div class="rs-hint cb-note" id="cbCov">${esc(coverage)}</div>` : ""}
      <div class="rs-kpis" id="kpis"></div>
      <div id="main"></div>
      <div id="trend"></div>`;

    if (!document.getElementById("cbCss")) {
      const st = document.createElement("style");
      st.id = "cbCss";
      st.textContent = `
        /* The bar, the fields, the segment, the selects, the buttons, the hint and the table
           all come from the shared kit in rs.css (.rs-bar / .rs-fld / .rs-seg / .rs-sel /
           .rs-btn / .rs-hint / .rs-table). What is left in this sheet is what the kit cannot
           say about a PIVOT, plus the one-line adjustments layered on kit components. */

        /* the spec bar is also a card, and the four actions still need a group the row can
           push to its far end */
        .cb-act{display:flex;gap:6px;margin-left:auto}
        /* "Top" is a two-digit answer. The kit's 132px select floor is sized for dimension
           names and reads as an empty box around "20". */
        #cbTop{min-width:82px}
        /* .rs-hint carries a bottom margin because it usually sits under a bar. As the only
           line inside a card -- or inside chartCard's own .tabwrap, which supplies no
           padding of its own -- it wants neither. */
        .cb-flat{margin:0}
        .cb-void{margin:0;padding:18px}
        /* two hints that have to be SEEN rather than read past: both explain why a "—"
           bucket is large, which is the one thing that can make this page lie to you. The
           amber tint is the page's own voice; the type comes from the kit. */
        .rs-hint.cb-note{background:var(--warn-bg);border:1px solid var(--line-2);
          border-radius:10px;padding:9px 12px;color:var(--ink)}
        /* PAGE filters, not the shell's: this page keeps its own store and never writes to
           RS.state.multi, so its chips are deliberately not the shell's brand-green
           .rs-chip -- and the whole chip is the remove control, not an inner button. */
        .cb-chips{display:flex;flex-wrap:wrap;gap:6px;width:100%}
        .cb-chip{background:var(--blue-bg);border:1px solid var(--line-2);border-radius:999px;padding:3px 9px;
          font-size:11px;color:var(--ink);cursor:pointer}
        .cb-chip:hover{border-color:var(--red);color:var(--red)}
        /* ---- the pivot: what .rs-table cannot say ----
           It scrolls sideways -- Columns = Year-Month is forty of them -- so the row label
           has to stay put or a number stops belonging to anything. A sticky cell has to be
           OPAQUE, which is why hover and the total row are restated on top of it instead of
           being inherited from the kit's zebra. */
        /* the pivot pins column one and the Total row -- see .rs-sticky in the kit */
        .rs-table.cb-piv td{white-space:nowrap}
        .rs-table.cb-piv td:first-child,.rs-table.cb-piv th:first-child{position:sticky;left:0}
        .rs-table.cb-piv tbody td:first-child{background:var(--panel)}
        .rs-table.cb-piv tbody tr:hover td:first-child{background:color-mix(in srgb,var(--ink) 5%,var(--panel))}
        .rs-table.cb-piv th[data-s]{cursor:pointer;user-select:none}
        .rs-table.cb-piv th[data-s]:hover{color:var(--brand)}
        /* descendant, not a qualifier: the 2nd measure is a <div class="b"> INSIDE the cell,
           and the cell itself carries class "num" -- td.b matched nothing, so both numbers
           in a stacked cell rendered at the same size and colour. */
        .rs-table.cb-piv td .b{font-size:10.5px;color:var(--muted)}
        /* The total row shipped as class="tot" and this sheet never defined it. .tot IS defined
           -- by monthly-report.js, refresh-log.js and review-performance.js -- so the row was
           styled only once you had visited one of those in the same session, and differently
           depending on WHICH. Its own name, defined here -- and qualified deeply enough to
           out-rank the kit's zebra and hover, which both reach three elements down. */
        .rs-table.cb-piv tbody tr.cb-tot td,
        .rs-table.cb-piv tbody tr.cb-tot:hover td{border-top:2px solid var(--line-2);font-weight:800;
          background:var(--panel-2);position:sticky;bottom:0}
        .cb-emptychart{display:flex;align-items:center;justify-content:center;height:100%;
          text-align:center;color:var(--muted);font-size:13px;padding:0 24px}`;
      document.head.appendChild(st);
    }

    // Writing the empty state and carrying on appended two chartCards BELOW it -- 750px of
    // blank Chart.js grid under headings promising data. Skip the CARDS when there is nothing
    // to draw, but never skip the wiring at the bottom of this function: the spec bar is the
    // only way back from a filter that matched nothing.
    const noRows = !rows.length;
    if (noRows) {
      document.getElementById("main").innerHTML =
        `<div class="panel"><div class="rs-hint cb-flat">No ${isLeads ? "leads" : "jobs"} for the current filters.</div></div>`;
    }

    /* ---- KPI strip --------------------------------------------------------------- */
    const kpiItems = isLeads ? [
      { label: "Total Leads", value: RS.fmtN(M["Total Leads"].fn(rows)), sub: "in scope" },
      { label: "Qualified", value: RS.fmtN(M["Qualified Leads"].fn(rows)), sub: "not marked a bad lead" },
      { label: "Confirmed", value: RS.fmtN(M["Confirmed Leads"].fn(rows)), sub: "booked" },
      { label: "Booking Rate", value: nz(RS.fmtPct)(RS.bookingRate(rows, bookedRows)), sub: "confirmed ÷ qualified" },
      { label: disp(CB.mA), value: nz(mA.fmt)(mA.seg(rows, bookedRows)), sub: "the measure on screen" },
    ] : [
      { label: "Total Jobs", value: RS.fmtN(M["Total Jobs"].fn(rows)), sub: "closed jobs (incl. trips)" },
      { label: "Revenue", value: RS.moneyC(M["Revenue"].fn(rows)), sub: nz(RS.money)(M["Revenue"].fn(rows)) },
      { label: "Net Cash", value: RS.moneyC(M["Net Cash"].fn(rows)), sub: "cash turned in per job" },
      { label: "Avg Bill / Job", value: RS.moneyC(M["Average Bill"].fn(rows)), sub: "per job" },
      { label: disp(CB.mA), value: nz(mA.fmt)(mA.seg(rows)), sub: "the measure on screen" },
    ];
    RSC.kpis(document.getElementById("kpis"), kpiItems);

    /* ---- the builder bar --------------------------------------------------------- */
    const opt = (list, cur) => list.map(d =>
      `<option value="${esc(d)}"${d === cur ? " selected" : ""}>${esc(typeof d === "string" ? d : String(d))}</option>`).join("");
    const optM = (list, cur) => list.map(d =>
      `<option value="${esc(d)}"${d === cur ? " selected" : ""}>${esc(disp(d))}</option>`).join("");
    const views = cbReadViews();
    const viewNames = Object.keys(views).filter(k => k !== "_last").sort();

    document.getElementById("cbSpec").innerHTML = `
      <div class="rs-fld"><span>Universe</span>
        <div class="rs-seg" id="cbUni">
          <button data-u="jobs" class="${isLeads ? "" : "on"}">Jobs</button>
          <button data-u="leads" class="${isLeads ? "on" : ""}">Leads</button>
        </div></div>
      <div class="rs-fld"><span>Rows</span><select class="rs-sel" id="cbRow">${opt(Object.keys(DIMS), CB.rowDim)}</select></div>
      <div class="rs-fld"><span>Columns</span><select class="rs-sel" id="cbCol">
        <option value="">— none —</option>${opt(Object.keys(DIMS), CB.colDim)}</select></div>
      <div class="rs-fld"><span>Measure</span><select class="rs-sel" id="cbMA">${optM(MEAS, CB.mA)}</select></div>
      <div class="rs-fld"><span>2nd measure</span><select class="rs-sel" id="cbMB">
        <option value="">— none —</option>${optM(MEAS, CB.mB)}</select></div>
      <div class="rs-fld"><span>Top</span><select class="rs-sel" id="cbTop">
        ${[10, 20, 50, 0].map(n => `<option value="${n}"${n === CB.topN ? " selected" : ""}>${n || "all"}</option>`).join("")}
        </select></div>
      <div class="rs-fld"><span>Chart</span><select class="rs-sel" id="cbChart">
        ${[["bar", "Bars"], ["hbar", "Bars (horizontal)"], ["stacked", "Stacked"], ["line", "Lines"], ["donut", "Donut"]]
          .map(([v, l]) => `<option value="${v}"${v === CB.chart ? " selected" : ""}>${l}</option>`).join("")}
        </select></div>
      <div class="rs-fld"><span>Filter by</span><select class="rs-sel" id="cbAddF">
        <option value="">+ add a filter…</option>${opt(Object.keys(DIMS), "")}</select></div>
      <div class="rs-fld"><span>Saved view</span><select class="rs-sel" id="cbView">
        <option value="">— none —</option>${opt(viewNames, CB.view)}</select></div>
      <div class="cb-act">
        <button class="rs-btn" id="cbSave">Save view</button>
        <button class="rs-btn" id="cbLink">Copy link</button>
        <button class="rs-btn" id="cbCsv">CSV</button>
        <button class="rs-btn" id="cbReset">Reset</button>
      </div>
      ${activeFilters.length ? `<div class="cb-chips">${activeFilters.map(k =>
        [...CB.filters[k]].map(v =>
          `<span class="cb-chip" data-fk="${esc(k)}" data-fv="${esc(v)}">${esc(k)}: ${esc(v)} ✕</span>`).join("")
        ).join("")}<span class="cb-chip" data-clear="1">clear page filters ✕</span></div>` : ""}`;

    /* ---- the pivot --------------------------------------------------------------- */
    function pivotHtml() {
      const G = group();
      if (!G.rowKeys.length) return `<div class="rs-hint cb-void">Nothing to break down.</div>`;
      const grand = mA.seg(rows, bookedRows);
      const cellVal = (rKey, cKey, m) => {
        const rs = G.cell.get(rKey + " " + cKey) || [];
        const bs = G.cellB.get(rKey + " " + cKey) || [];
        return m.seg(rs, bs);
      };
      const rowTotal = (rKey, m) => m.seg(G.rk.get(rKey) || [], G.rkB.get(rKey) || []);

      const cols = CB.colDim ? G.colKeys : [];
      const head = `<tr><th data-s="k">${esc(CB.rowDim)}</th>`
        + cols.map(c => `<th class="num" data-s="c:${esc(c)}">${esc(c === "" ? "—" : c)}</th>`).join("")
        + `<th class="num" data-s="a">${esc(disp(CB.mA))}</th>`
        + (mB ? `<th class="num" data-s="b">${esc(disp(CB.mB))}</th>` : "")
        + `<th class="num" data-s="p">% of total</th>`
        + `<th class="num">Jobs</th></tr>`;

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
             + `<td class="num">${share == null ? "—" : esc(RS.fmtPct(share))}</td>`
             + `<td class="num">${RS.fmtN(rs.length)}</td></tr>`;
      };

      /* Apply the clicked header. group() has already ordered rows the natural way (by the
         measure, or by a dimension's own order for months and bands); this re-orders what is
         on screen without changing which rows made the Top N cut -- so clicking a header can
         never quietly swap one category for another. "Other" is pinned last either way,
         because it is a bucket, not a competitor. */
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
      // dir -1 = biggest first (the useful default), dir 1 = smallest first
      if (S.key === "k") ordered.sort((a, b) => -S.dir * String(a).localeCompare(String(b)));
      else ordered.sort((a, b) => (sortVal(a) - sortVal(b)) * S.dir);

      let body = ordered.map(k => mk(k, G.rk.get(k) || [], G.rkB.get(k) || [], k)).join("");
      if (G.other) body += mk(G.other.key, G.other.rows, G.other.booked, null);
      // the total is over EVERY row in scope, not the visible ones -- so it always ties to
      // the KPI strip above, and Top N never quietly changes what "total" means
      const tot = `<tr class="cb-tot"><td>Total</td>`
        + cols.map(c => {
            const rs = rows.filter(r => keyOf(CB.colDim, r) === c);
            const bs = isLeads ? bookedRows.filter(r => keyOf(CB.colDim, r) === c) : [];
            const v = mA.seg(rs, bs);
            return `<td class="num">${v == null ? "—" : esc(mA.fmt(v))}</td>`;
          }).join("")
        + `<td class="num">${grand == null ? "—" : esc(mA.fmt(grand))}</td>`
        + (mB ? `<td class="num">${(() => { const v = mB.seg(rows, bookedRows); return v == null ? "—" : esc(mB.fmt(v)); })()}</td>` : "")
        + `<td class="num">${grand ? esc(RS.fmtPct(1)) : "—"}</td>`
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
      if (CB.colDim && (stacked || CB.chart === "bar" || CB.chart === "line")) {
        // Columns = Month gives 12 keys, Year-Month gives 40+. The old slice(0, 8) DISCARDED
        // the rest, so a stacked bar stopped short of the row total printed in the Tabular
        // view of the same card, with nothing on the page admitting it. Keep 7 and roll the
        // tail into a named 8th so the stack still sums to the row.
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
          // A donut at the default Top 20 is 21 slices. `i % PAL.length` made slices 1, 9 and
          // 17 the same lime, and the donut is the one chart type that SHOWS a legend -- three
          // different sources beside three identical swatches. Past 8 slices, walk the hue
          // circle instead so every arc is its own colour.
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
        return typeof l === "string" && l.length > 16 ? l.slice(0, 15) + "…" : l; } };
      return new Chart(canvas, {
        type: donut ? "doughnut" : (CB.chart === "line" ? "line" : "bar"),
        data: { labels, datasets },
        options: {
          indexAxis: horiz ? "y" : "x",
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: donut || (!!CB.colDim && CB.chart !== "hbar"), position: "top", labels: { boxWidth: 12 } },
            tooltip: { callbacks: { label: c => `${c.dataset.label}: ${mA.fmt(c.raw)}` } },
          },
          scales: donut ? {} : {
            x: { stacked, ticks: Object.assign({}, horiz ? {} : trunc, { autoSkip: true, maxTicksLimit: 18, maxRotation: 45 }) },
            y: { stacked, ticks: horiz ? trunc : {} },
          },
        },
      });
    }

    const mainCard = noRows ? { rerender() {} } : RSC.chartCard(document.getElementById("main"), {
      // explicit key: chartCard remembers graph-vs-table under cfg.key || cfg.title, and that
      // memory is GLOBAL across every page — a generic "Breakdown" would collide
      key: "cb:breakdown",
      title: CB.colDim ? `${disp(CB.mA)} — ${CB.rowDim} × ${CB.colDim}` : `${disp(CB.mA)} by ${CB.rowDim}`,
      buildChart,
      buildTable: pivotHtml,
    });

    /* ---- trend ------------------------------------------------------------------- */
    // Chart and table are two views of ONE card, so they have to be two views of one dataset.
    // The trend card used to hand chartCard `buildTable: pivotHtml` -- the identical function
    // the main card gets -- so clicking Tabular under a heading promising months produced a
    // byte-identical copy of the breakdown table directly above it. Both views read this.
    const monthKey = r => r._y + "-" + String(r._m).padStart(2, "0");
    function trendSpec() {
      const G = group();
      const top = G.rowKeys.filter(k => k !== "—").slice(0, 5);
      const months = [...new Set(rows.map(monthKey))].sort().slice(-18);
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
        // chartCard guards `if (chart) chart.destroy()`, so returning null is safe -- an
        // empty Chart.js grid under "Monthly trend" says nothing; a sentence says why.
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
            scales: { x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 14 } } } },
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
    const redraw = () => cbRender(host);        // full re-render: the spec bar itself changes
    const $ = id => document.getElementById(id);

    $("cbUni").querySelectorAll("button").forEach(b => {
      b.onclick = () => { if (CB.universe === b.dataset.u) return;
        CB.universe = b.dataset.u; CB.filters = {}; CB.colDim = ""; redraw(); };
    });
    $("cbRow").onchange = e => { CB.rowDim = e.target.value; redraw(); };
    $("cbCol").onchange = e => { CB.colDim = e.target.value; redraw(); };
    $("cbMA").onchange = e => { CB.mA = e.target.value; redraw(); };
    $("cbMB").onchange = e => { CB.mB = e.target.value; redraw(); };
    $("cbTop").onchange = e => { CB.topN = +e.target.value; redraw(); };
    $("cbChart").onchange = e => { CB.chart = e.target.value; mainCard.rerender(); };

    // add a page filter: offer the values that exist, with counts, most common first
    $("cbAddF").onchange = e => {
      const dim = e.target.value; e.target.value = "";
      if (!dim || !DIMS[dim]) return;
      const counts = new Map();
      scoped.forEach(r => { const k = keyOf(dim, r); counts.set(k, (counts.get(k) || 0) + 1); });
      const vals = [...counts.entries()].sort((a, b) => b[1] - a[1]);
      const picked = window.prompt(
        `Filter ${dim} to which value?\n\n` +
        vals.slice(0, 40).map(([v, n]) => `${v}  (${n})`).join("\n") +
        `\n\nType the value exactly, or several separated by | :`, vals.length ? vals[0][0] : "");
      if (picked == null) return;
      const want = picked.split("|").map(s => s.trim()).filter(Boolean);
      if (!want.length) return;
      CB.filters[dim] = new Set([...(CB.filters[dim] || []), ...want]);
      redraw();
    };
    host.querySelectorAll(".cb-chip").forEach(c => {
      c.onclick = () => {
        if (c.dataset.clear) { CB.filters = {}; redraw(); return; }
        const s = CB.filters[c.dataset.fk];
        if (s) { s.delete(c.dataset.fv); if (!s.size) delete CB.filters[c.dataset.fk]; }
        redraw();
      };
    });

    $("cbView").onchange = e => {
      const v = cbReadViews()[e.target.value];
      if (v) { cbApply(v); CB.view = e.target.value; redraw(); }
    };
    $("cbSave").onclick = () => {
      const name = window.prompt("Name this view:", CB.view || `${CB.rowDim} × ${CB.colDim || "—"}`);
      if (!name) return;
      const v = cbReadViews(); v[name] = cbSpec(); cbWriteViews(v); CB.view = name; redraw();
    };
    $("cbLink").onclick = () => {
      const url = location.origin + location.pathname
        + "#page=analysis-by-category&cb=" + encodeURIComponent(JSON.stringify(cbSpec()));
      const done = ok => window.alert(ok
        ? "Link copied. It restores this builder on a fresh load.\n\nNote: it carries the BUILDER only — not the date range or the global slicers, so it can never change someone else's filters behind their back."
        : "Could not copy automatically. The link is in the address bar.");
      location.hash = "page=analysis-by-category&cb=" + encodeURIComponent(JSON.stringify(cbSpec()));
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(() => done(true), () => done(false));
      else done(false);
    };
    $("cbReset").onclick = () => {
      CB.rowDim = Object.keys(DIMS)[0]; CB.colDim = ""; CB.mB = ""; CB.topN = 20;
      CB.chart = "bar"; CB.filters = {}; CB.view = ""; redraw();
    };
    $("cbCsv").onclick = () => {
      const G = group();
      const cols = CB.colDim ? G.colKeys : [];
      // CSV quoting written with indexOf/split rather than regex literals containing a quote
      // character -- those are easy to misread, and they defeat simple tooling that scans this
      // file (mine included: a `/"/g` swallowed the rest of the file as a string).
      const escC = v => {
        const s = v == null ? "" : String(v);
        const needs = s.indexOf(",") >= 0 || s.indexOf("\"") >= 0 || s.indexOf("\n") >= 0;
        return needs ? "\"" + s.split("\"").join("\"\"") + "\"" : s;
      };
      const head = [CB.rowDim].concat(cols.map(c => c === "" ? "—" : c), [disp(CB.mA)], mB ? [disp(CB.mB)] : [], ["Rows"]);
      const line = (label, rKey, rs, bs) => [label].concat(
        cols.map(c => { const v = rKey != null ? mA.seg(G.cell.get(rKey + " " + c) || [], G.cellB.get(rKey + " " + c) || []) : ""; return v == null ? "" : v; }),
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
