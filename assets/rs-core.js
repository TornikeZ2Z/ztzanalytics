/* Reporting System — core: data layer, filter context, measure library.
   Measures are registered by their EXACT Power BI name (see docs/pbix-coverage-audit.md §4)
   so the audit files double as the implementation checklist. */
window.RS = (function () {
  const num = ZTZ.num, fmtN = ZTZ.fmtN, money = ZTZ.money;
  const fmtPct = v => (v == null || isNaN(v)) ? "—" : (100 * v).toFixed(1) + "%";
  const fmt1 = v => (v == null || isNaN(v)) ? "—" : Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
  /* compact money for KPI values: $33.8M / $412k / $728 (tables keep full precision) */
  const moneyC = v => {
    if (v == null || isNaN(v)) return "—";
    const a = Math.abs(v);
    if (a >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (a >= 1e4) return "$" + Math.round(v / 1e3) + "k";
    return money(v);
  };

  /* ---------------- data layer (fetch once, cache in memory) ---------------- */
  const DATASETS = {
    closing: {
      table: "fct_closing",
      cols: ["Unique Key", "Record Source", "Company", "Date", "Customer", "Request #",
        "Source", "Booked From", "Source1", "Source From Moveboard", "Source2", "Corrected Source",
        "Move Type", "Pickup Zip", "Net Cash", "Total Bill", "Card Payment",
        "Balance Due", "Deposit", "Sales Person", "SP 2", "SP 3", "Foreman", "Foreman Hours",
        "Driver", "Material Total", "Material $", "Tip from Company",
        "Tip From the Customers", "Review", "Satisfaction Score", "Total Expense",
        // Financial measure layer (B-fin): per-row expense / salary components.
        // fct_closing already appends unlinked-trip rows carrying these same fields,
        // so SUM(col) here = Closing + unlinked-Trips; the DAX's Trips[...] term is
        // the LINKED-trip residual only (fct_trips, not served) — flagged in data_gaps.
        "Car", "Fuel", "Hotel", "Tolls", "Truck", "Other Expenses",
        "Driver $", "Forman Total $", "CF %", "Tip from Company Part",
        "Profit per Job", "Storage", "State", "State Name", "Moving Type", "Size of Move",
        "Bill Range", "Commission Bucket Range", "Extra Bill From Trips", "Net Cash From Trips",
        "Crew Size", "Request Encounter", "Is Last Encounter", "Job Part of the Day",
        "Forman Job Order", "Request Joinkey", "Branch Owner", "Branch Owner Cut"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    },
    moveboard: {
      table: "fct_moveboard",
      cols: ["Company", "Job No", "Status", "Status Category", "Create Date", "Booked Date",
        "Move Date", "Service Type", "Size of Move", "Customer", "State", "State Name",
        "County Name", "City Name", "Source", "Source Before Adjustment", "Source Connector", "Min Quote", "Max Quote",
        "Average Quote", "Total CF", "Total Lbs", "Big Job Status", "CF Range", "Bill Range",
        "Assigned", "Request Joinkey", "Closing Sheet Connector"],
      dateCols: { "Create Date": "Create Date", "Booked Date": "Booked Date", "Move Date": "Move Date" },
      defaultDate: "Create Date",
    },
    storage: {
      table: "fct_storage",
      cols: ["Company", "Payment Date", "Job Code", "Customer", "Amount", "Payment Type",
        "Request No", "Closing Sheet Connector"],
      dateCols: { "Payment Date": "Payment Date" }, defaultDate: "Payment Date",
    },
    refunds: {
      table: "fct_refunds",
      cols: ["Company", "Refund Date", "Move Date", "Customer", "Request No", "Source",
        "Sales Person", "Foreman", "Total refund", "Sales Responsibility",
        "Sales Commission Reduced Amount", "Reason", "Request Joinkey"],
      dateCols: { "Refund Date": "Refund Date" }, defaultDate: "Refund Date",
    },
    long_distance: {
      table: "fct_long_distance",
      cols: ["Unique Key", "Company", "Job No", "Date", "Customer", "Status", "Source",
        "Moving From", "Moving To", "Carrier Company", "Straight", "CF", "Rate",
        "Total To Carrier", "Total Bill", "Card Payment", "Balance Due", "Sales Person"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    },
    claims: {
      table: "fct_claims",
      cols: ["Created Date", "Customer", "Request No", "Group", "Status", "Reason",
        "Responsibility", "Request Joinkey"],
      dateCols: { "Created Date": "Created Date" }, defaultDate: "Created Date",
    },
    negative_reviews: {
      table: "fct_negative_reviews",
      cols: ["Negative Review Id", "Company", "Group", "Customer", "Request No",
        "Is Identified", "Status", "Review Score", "Source", "Written Date", "Date ID",
        "Request Joinkey"],
      dateCols: { "Date ID": "Date ID", "Written Date": "Written Date" }, defaultDate: "Date ID",
    },
    rollup: {   // per-Request support rollup — lookup table, do NOT RS.filter it
      table: "rollup_support",
      cols: ["Request Joinkey", "Number of Claims Written", "Number of Negative Reviews Written",
        "Amount Refunded", "Claim Date", "Negative Review Date", "Refund Date",
        "Amount Reduced from Sales Person", "Amount Refunded Because of Negative Reviews",
        "Refunds Reason Category", "Negative Reviews Status", "Negative Reviews Source",
        "Responsibility", "Claims Reason"],
      dateCols: {}, defaultDate: null,
    },
    sales_salaries: {  // keyed by closing Unique Key — time-slice via closing membership
      table: "fct_sales_salaries",
      cols: ["Unique Key", "SP Slot", "Sales Person", "Rate", "Salary", "Bill Distribution",
        "Is Branch Owner"],
      dateCols: {}, defaultDate: null,
    },
    helper_salaries: {
      table: "fct_helper_salaries",
      cols: ["Unique Key", "Helper Slot", "Helper Name", "Hours Worked", "Helper Rate",
        "Amount Received", "Tip for Helper"],
      dateCols: {}, defaultDate: null,
    },
    reviews_breakdown: {
      table: "fct_reviews_breakdown",
      cols: ["Review Id", "Company", "Event Date", "Request Joinkey", "Counts", "Source",
        "With Image", "Number of Reviews", "Review Score", "Sales Person"],
      dateCols: { "Event Date": "Event Date" }, defaultDate: "Event Date",
    },
    card_expenses: {
      table: "fct_card_expenses",
      cols: ["Company", "Transaction Date", "Expense Category", "Provider", "Amount",
        "Is Advertising", "Source", "Record Source"],
      dateCols: { "Transaction Date": "Transaction Date" }, defaultDate: "Transaction Date",
    },
    callrail: {
      table: "fct_callrail",
      cols: ["Call Status", "Number Name", "Start Time", "Duration Seconds", "Name",
        "Phone Number", "First-Time Caller", "Source", "Company"],
      dateCols: { "Start Time": "Start Time" }, defaultDate: "Start Time",
    },
    leads: {
      table: "fct_leads",
      cols: ["Source", "Lead Date", "Customer", "Status", "Category", "State",
        "Lead Cost", "Net Cost", "Company", "Request # From Moveboard", "Matching Status"],
      dateCols: { "Lead Date": "Lead Date" }, defaultDate: "Lead Date",
    },
    scorecard: {
      table: "mart_forman_scorecard",
      cols: ["Foreman", "Month", "Month Year", "Total Jobs", "Total Packing Written",
        "Total CF", "Total Packing Estimate", "Total Bill Estimate", "Total Reviews Written",
        "Forman Fault Claims", "Packing per 100 CF", "Packing per 100 CF Score",
        "Packing Difference %", "Packing Vs Estimate Score", "Reviews to Jobs Ratio",
        "Review Score", "Claim Score", "Forman Score", "Forman Score Rank",
        "Forman Score Prev Month"],
      dateCols: { "Month": "Month" }, defaultDate: "Month",
    },
    review_counts: {
      table: "fct_review_counts",
      cols: ["Company", "Platform", "Date", "Number of Reviews"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    },
    review_goals: {
      table: "fct_review_goals",
      cols: ["Company", "Platform", "Date", "Number of Reviews"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    },
  };
  const _cache = {};
  const _loading = {};
  async function load(ds) {
    if (_cache[ds]) return _cache[ds];
    if (_loading[ds]) return _loading[ds];
    const spec = DATASETS[ds];
    // The deployed bridge %-formats SQL, so column names containing '%' (e.g.
    // mart's `Packing Difference %`) break its cols= projection — fetch such
    // tables whole instead (they're small) until the fixed bridge ships.
    const colsSafe = spec.cols.every(c => c.indexOf("%") === -1);
    _loading[ds] = ZTZ.api("/api/" + encodeURIComponent(spec.table) +
      "?limit=1000000" + (colsSafe ? "&cols=" + encodeURIComponent(spec.cols.join(",")) : ""))
      .then(j => {
        const rows = j.rows || [];
        if (spec.defaultDate) rows.forEach(r => {   // pre-derive default date parts
          const d = String(r[spec.defaultDate] || "").slice(0, 10);
          r._d = d; r._y = d.slice(0, 4); r._m = parseInt(d.slice(5, 7), 10) || 0;
          r._day = parseInt(d.slice(8, 10), 10) || 0;
        });
        if (ds === "card_expenses") rows.forEach(r => {
          // bank convention stores expenses NEGATIVE; PBI's measures negate —
          // normalize once here so spend reads positive everywhere (credits negative).
          r.Amount = -num(r.Amount);
        });
        _cache[ds] = rows; delete _loading[ds];
        return rows;
      })
      .catch(e => {
        delete _loading[ds];   // never cache a failed load (e.g. expired token)
        throw e;
      });
    return _loading[ds];
  }

  /* ---------------- filter context ---------------- */
  // Global state: { dateFrom, dateTo, dayFrom, dayTo, multi: { fieldKey: Set } }
  const state = { dateFrom: null, dateTo: null, dayFrom: null, dayTo: null, multi: {} };

  // Global slicer fields → per-dataset column mapping (null = not applicable).
  const FIELDS = {
    year:        { label: "Year",         closing: "_y",            moveboard: "_y",             storage: "_y", refunds: "_y", long_distance: "_y", claims: "_y", negative_reviews: "_y", reviews_breakdown: "_y", card_expenses: "_y", callrail: "_y", leads: "_y", scorecard: "_y", review_counts: "_y", review_goals: "_y" },
    month:       { label: "Month",        closing: "_m",            moveboard: "_m",             storage: "_m", refunds: "_m", long_distance: "_m", claims: "_m", negative_reviews: "_m", reviews_breakdown: "_m", card_expenses: "_m", callrail: "_m", leads: "_m", scorecard: "_m", review_counts: "_m", review_goals: "_m" },
    company:     { label: "Company",      closing: "Company",       moveboard: "Company",        storage: "Company", refunds: "Company", long_distance: "Company", negative_reviews: "Company", reviews_breakdown: "Company", card_expenses: "Company", callrail: "Company", leads: "Company", review_counts: "Company", review_goals: "Company" },
    source:      { label: "Source",       closing: "Source",        moveboard: "Source",         refunds: "Source", long_distance: "Source", negative_reviews: "Source", reviews_breakdown: "Source", card_expenses: "Source", callrail: "Source", leads: "Source" },
    state:       { label: "State",        closing: "State",         moveboard: "State",          leads: "State" },
    foreman:     { label: "Foreman",      closing: "Foreman",       refunds: "Foreman",          scorecard: "Foreman" },
    // Reviews have NO relationship to Sales Person in PBI — omit reviews_breakdown so the
    // sales slicer skips reviews (it used to zero them). moveboard `Assigned` now carries the
    // Full Name (curated fct_moveboard) so it matches the Full-Name slicer options like closing.
    sales:       { label: "Sales Person", closing: "Sales Person",  moveboard: "Assigned",       refunds: "Sales Person", long_distance: "Sales Person" },
    cfRange:     { label: "Volume (cu ft)", moveboard: "CF Range" },  // display label only — field key + column stay "CF Range"
    billRange:   { label: "Bill Range",   closing: "Bill Range",    moveboard: "Bill Range" },
    movingType:  { label: "Moving Type",  closing: "Moving Type" },
    sizeOfMove:  { label: "Size of Move", closing: "Size of Move",  moveboard: "Size of Move" },
    statusCat:   { label: "Lead Status",  moveboard: "Status Category" },
  };

  function monthName(m) { return ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m] || String(m); }

  /* Filtered-closing Unique-Key set (memoized per filter state) — the scope that
     salary/keyed lookup tables inherit (they carry no date/company columns of their own). */
  let _fckSig = null, _fckSet = null;
  function _stateSig() {
    return JSON.stringify([state.dateFrom, state.dateTo, state.dayFrom, state.dayTo,
      Object.entries(state.multi).map(([k, s]) => [k, s && s.size ? [...s].sort() : 0])]);
  }
  function filteredClosingKeys() {
    const cl = _cache["closing"];
    if (!cl) return null;                       // closing not loaded yet -> caller falls back
    const sig = _stateSig();
    if (sig === _fckSig && _fckSet) return _fckSet;
    const set = new Set();
    for (const r of filtered("closing", cl)) set.add(r["Unique Key"]);
    _fckSig = sig; _fckSet = set;
    return set;
  }

  /* Apply the global filter state to a dataset's rows.
     opts.dateColumn overrides which date column the range filters (USERELATIONSHIP). */
  function filtered(ds, rows, opts) {
    opts = opts || {};
    const spec = DATASETS[ds];
    const dcol = opts.dateColumn || spec.defaultDate;
    // Salary / keyed lookup datasets have no date column of their own and no mapped
    // slicer columns; date-filtering them directly drops every row (no _d). Instead
    // scope by Unique-Key MEMBERSHIP in the filtered closing set, so the global date +
    // company/source slicers flow through the parent closing rows. (fixes the financial
    // measures reading $0 under a date filter, and salaries ignoring the company slicer.)
    if (!dcol && spec.cols.indexOf("Unique Key") !== -1) {
      const keys = filteredClosingKeys();
      return keys ? rows.filter(r => keys.has(r["Unique Key"])) : rows;
    }
    const useDerived = dcol === spec.defaultDate;
    const active = Object.entries(state.multi)
      .map(([k, set]) => ({ col: FIELDS[k] && FIELDS[k][ds], set }))
      .filter(f => f.col && f.set && f.set.size);
    return rows.filter(r => {
      let d = useDerived ? r._d : String(r[dcol] || "").slice(0, 10);
      if (state.dateFrom && (!d || d < state.dateFrom)) return false;
      if (state.dateTo && (!d || d > state.dateTo)) return false;
      if (state.dayFrom != null || state.dayTo != null) {
        const day = useDerived ? r._day : parseInt(d.slice(8, 10), 10) || 0;
        if (state.dayFrom != null && day < state.dayFrom) return false;
        if (state.dayTo != null && day > state.dayTo) return false;
      }
      for (const f of active) {
        const v = r[f.col];
        if (!f.set.has(v == null ? "—" : String(v))) return false;
      }
      return true;
    });
  }

  /* Shift the current date window by N years/months (for time-intelligence). */
  function shiftedState(years, months) {
    const shift = (s) => {
      if (!s) return s;
      const d = new Date(s + "T00:00:00");
      d.setFullYear(d.getFullYear() + (years || 0));
      d.setMonth(d.getMonth() + (months || 0));
      return d.toISOString().slice(0, 10);
    };
    return { from: shift(state.dateFrom), to: shift(state.dateTo) };
  }

  /* ---------------- measure library ---------------- */
  // Each measure: { name (EXACT PBI name), ds, fmt, fn(rows) } — fn gets FILTERED rows.
  const M = {};
  // deps (optional): other datasets a COMPOSITE measure reads via _msr(); RS.value/yoy
  // warm them so a lone composite call is scope-consistent (not silently zeroed).
  function register(name, ds, fmt, fn, deps) { M[name] = { name, ds, fmt, fn, deps: deps || null }; }
  const sum = (rows, col) => rows.reduce((a, r) => a + num(r[col]), 0);
  const cnt = rows => rows.length;

  /* Synchronous cross-dataset sub-measure evaluator for composite measures (e.g.
     Operational Profit) whose DAX sums measures living on DIFFERENT tables. Reads the
     sub-measure's own dataset from the already-loaded cache and applies the SAME global
     filter scope (filtered()), so every term is filter-consistent with the closing rows
     the composite fn received. If that dataset isn't loaded yet it contributes 0 —
     callers that need a single exact number should await RS.value(name), which loads
     each dataset first; composite fn()s used in cards/tables run after RS.load has
     warmed the datasets the page uses. */
  function _msr(name) {
    const m = M[name]; if (!m) return 0;
    const rows = _cache[m.ds]; if (!rows) return 0;
    return m.fn(filtered(m.ds, rows)) || 0;
  }
  /* Segment-aware variant: when a composite measure is evaluated on a SUBSET of closing
     rows (a segment breakdown — by state / sales person / customer type), its cross-dataset
     sub-measures must be scoped to that segment too, not the whole global filter. segKeys is
     the Set of closing Unique Keys in the segment; keyed lookup tables (helper/sales salaries)
     are filtered to it. Datasets without a Unique Key (e.g. refunds) can't be attributed to a
     segment and contribute 0 there. When segKeys is absent this is byte-identical to _msr(),
     so every whole-month / date-scoped call (KPIs, trends, Financial Analysis) is unchanged. */
  function _msrK(name, segKeys) {
    if (!segKeys) return _msr(name);
    const m = M[name]; if (!m) return 0;
    const rows = _cache[m.ds]; if (!rows) return 0;
    return m.fn(rows.filter(r => segKeys.has(r["Unique Key"]))) || 0;
  }

  // --- Core revenue / jobs (Calculations table) — trips-append semantics baked in.
  register("Total Jobs", "closing", fmtN, rows => cnt(rows));
  register("Total Bill", "closing", money, rows => sum(rows, "Total Bill") + sum(rows, "Extra Bill From Trips"));
  // Revenue naming (user): "Revenue" = the combined figure (was Total Bill), split into
  // "Total Revenue" (from closings) + "Additional Revenue from Trips" (the appended trips part).
  register("Revenue", "closing", money, rows => sum(rows, "Total Bill") + sum(rows, "Extra Bill From Trips"));
  // DISPLAY name for "Total Revenue" is "Job Revenue (excl. trips)" — it is SMALLER than
  // "Revenue" and must never be shown under a name that sounds like the total. Registry
  // key stays "Total Revenue"; render via RS.displayName().
  register("Total Revenue", "closing", money, rows => sum(rows, "Total Bill"));
  register("Additional Revenue from Trips", "closing", money, rows => sum(rows, "Extra Bill From Trips"));
  register("Net Cash", "closing", money, rows => sum(rows, "Net Cash") + sum(rows, "Net Cash From Trips"));
  register("Card Payment", "closing", money, rows => sum(rows, "Card Payment"));
  // Operating Profit Before Commission = Net Cash + Card Payment (per Tornike's books,
  // 2026-07-03). "Net Cash + Card Payment" kept as an alias so existing refs keep working.
  register("Operating Profit Before Commission", "closing", money,
    rows => M["Net Cash"].fn(rows) + M["Card Payment"].fn(rows));
  register("Net Cash + Card Payment", "closing", money,
    rows => M["Operating Profit Before Commission"].fn(rows));
  register("Hours Worked by Forman", "closing", fmtN, rows => sum(rows, "Foreman Hours"));
  register("Total Tips", "closing", money,
    rows => sum(rows, "Tip From the Customers") + sum(rows, "Tip from Company"));
  register("Material Total", "closing", money, rows => sum(rows, "Material Total"));
  // Packing semantics (audit F9): `Material $` is the foreman's packing COMMISSION
  // (PBI "Forman Salary - Packing", 20/26% of Material Total) — NOT packing revenue.
  // Customer-facing packing revenue is `Material Total` (PBI "Total Packing Written").
  register("Forman Salary - Packing", "closing", money, rows => sum(rows, "Material $"));
  register("Total Packing Written", "closing", money, rows => sum(rows, "Material Total"));
  // deprecated alias — kept so stale references render the commission, not a crash
  register("Packing Sold", "closing", money, rows => sum(rows, "Material $"));
  register("Total Expenses", "closing", money, rows => sum(rows, "Total Expense"));
  register("Profit", "closing", money, rows => sum(rows, "Profit per Job"));
  register("Jobs per 100 Hours", "closing", fmt1, rows => {
    const h = sum(rows, "Foreman Hours"); return h ? 100 * cnt(rows) / h : null;
  });
  register("Average Bill", "closing", money, rows => {
    const n = cnt(rows); return n ? M["Total Bill"].fn(rows) / n : null;
  });

  // --- Leads funnel (Moveboard).
  register("Total Leads", "moveboard", fmtN, rows => cnt(rows));
  register("Qualified Leads", "moveboard", fmtN,
    rows => rows.filter(r => r["Status Category"] !== "Bad Lead").length);
  register("Confirmed Leads", "moveboard", fmtN,
    rows => rows.filter(r => r["Status Category"] === "Confirmed").length);
  register("Dead Leads", "moveboard", fmtN,
    rows => rows.filter(r => r["Status Category"] === "Bad Lead").length);
  /* Canonical Booking Rate — the ONE official formula for the whole portal.
     Matches the PBI SWITCH verbatim (dax_measures.md lines 33-48):
       Qualified = leads with Status Category !== 'Bad Lead', sliced by CREATE date;
       Confirmed = leads with Status Category === 'Confirmed', sliced by BOOKED date;
       SWITCH: Confirmed > Qualified -> 1 (cap at 100%);
               Qualified=0 && Confirmed=0 -> null (blank);
               Qualified!=0 && Confirmed=0 -> 0;
               else Confirmed / Qualified.
     Dual date basis is the point: bookings lag lead creation, so scoring both sides
     on Create Date understates recent months and lets history drift as old leads
     convert. createdRows / bookedRows are the SAME dataset filtered on the two
     different date columns (see leads-analysis.js rowsB for the pattern). */
  function bookingRate(createdRows, bookedRows) {
    const qualified = createdRows.filter(r => r["Status Category"] !== "Bad Lead").length;
    const confirmed = bookedRows.filter(r => r["Status Category"] === "Confirmed").length;
    if (confirmed > qualified) return 1;
    if (qualified === 0 && confirmed === 0) return null;
    if (confirmed === 0) return 0;
    return confirmed / qualified;
  }
  // Registry wrapper: fn receives the CREATE-date-scoped rows (default date basis);
  // the BOOKED-date-scoped rows are derived here from the same global filter state
  // (USERELATIONSHIP equivalent). Matches the PBI SWITCH — see bookingRate() above.
  // NOTE: this wrapper is global-filter scope only; for segment breakdowns (groupBy
  // subsets) call RS.bookingRate directly with both row sets for the segment.
  register("Booking Rate", "moveboard", fmtPct, rows => {
    const all = _cache["moveboard"];
    const bookedRows = all ? filtered("moveboard", all, { dateColumn: "Booked Date" }) : rows;
    return bookingRate(rows, bookedRows);
  });
  register("Average Quote (avg)", "moveboard", money, rows => {
    const v = rows.map(r => num(r["Average Quote"])).filter(x => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });
  register("Total Estimated CF", "moveboard", fmtN, rows => sum(rows, "Total CF"));
  register("Big Jobs", "moveboard", fmtN,
    rows => rows.filter(r => r["Big Job Status"] === "Yes").length);

  // --- Storage (exact DAX: split on Payment Type = 'Paid at Pickup').
  register("Storage Additional Revenue", "storage", money,
    rows => sum(rows.filter(r => String(r["Payment Type"] || "") !== "Paid at Pickup"), "Amount"));
  register("Storage Revenue Included in Total Bill", "storage", money,
    rows => sum(rows.filter(r => String(r["Payment Type"] || "") === "Paid at Pickup"), "Amount"));
  register("Total Storage Jobs", "closing", fmtN,
    rows => rows.filter(r => r["Storage"] === "Our Storage").length);

  // --- Refunds.
  register("Total Refunds", "refunds", money, rows => sum(rows, "Total refund"));
  register("Number of Refunds", "refunds", fmtN, rows => cnt(rows));

  // --- Claims & negative reviews.
  register("Number of Claims", "claims", fmtN, rows => cnt(rows));
  register("Number of Negative Reviews", "negative_reviews", fmtN, rows => cnt(rows));
  register("Identified Negative Reviews", "negative_reviews", fmtN,
    rows => rows.filter(r => num(r["Is Identified"]) === 1).length);

  // --- Card expenses (PBI: Advertising vs Other split on Expense Category).
  register("Advertisement Expense", "card_expenses", money,
    rows => sum(rows.filter(r => num(r["Is Advertising"]) === 1), "Amount"));
  register("Other Card Expenses", "card_expenses", money,
    rows => sum(rows.filter(r => num(r["Is Advertising"]) !== 1), "Amount"));

  // --- Salaries (join to closing via Unique Key for time slicing).
  register("Sales Commission", "sales_salaries", money, rows => sum(rows, "Salary"));
  register("Helper Salary", "helper_salaries", money, rows => sum(rows, "Amount Received"));
  register("Hours Worked by Helpers", "helper_salaries", fmtN, rows => sum(rows, "Hours Worked"));

  // --- Financial measure layer (Operational Profit build-up) ----------------
  // Faithful replication of the PBIX Operational Profit formula and its inputs.
  // GRAIN NOTE: fct_closing already contains APPENDED unlinked-trip rows (Record
  // Source='trip') carrying their own Car/Fuel/Hotel/Tolls/Truck/Other/Driver $/
  // Forman Total $. So SUM(Closing[col]) here == PBI SUM(Closing[col]) + the
  // UNLINKED part of SUM(Trips[col]). The only residual vs the DAX is the LINKED
  // trips (PBIX Trips table = fct_trips, 114 rows, NOT served client-side). That
  // residual is small and flagged in data_gaps — NOT silently dropped.

  // Expense measures. DAX: SUM(Closing[X]) + SUM(Trips[X]).  our_impl: SUM(Closing[X])
  // (Closing already folds unlinked trips; linked-trip residual = known gap).
  register("Car Expense",    "closing", money, rows => sum(rows, "Car"));
  register("Fuel Expense",   "closing", money, rows => sum(rows, "Fuel"));
  register("Hotel Expense",  "closing", money, rows => sum(rows, "Hotel"));
  register("Toll Expense",   "closing", money, rows => sum(rows, "Tolls"));
  register("Truck Expense",  "closing", money, rows => sum(rows, "Truck"));
  // "Other Expenses" is the EXACT PBI measure name. (Do not confuse with the raw
  // column "Other Expenses" — the measure sums it: DAX SUM(Closing[Other Expenses])
  // + SUM(Trips[Other Expenses]).)
  register("Other Expenses", "closing", money, rows => sum(rows, "Other Expenses"));

  // Driver Salary = SUM(Closing[Driver $]).  Faithful (trip rows carry tr.Driver $).
  register("Driver Salary", "closing", money, rows => sum(rows, "Driver $"));

  // Forman Salary 6 components. Packing already registered above as SUM(Material $).
  //   - CF          = SUM(Closing[CF %])
  //   - Review      = SUM(Closing[Review])
  //   - Tip         = SUMX(Closing, Closing[Tip from Company Part])  == SUM of that col
  //   - Hourly Rate = SUMX(Closing, Closing[Forman Total $] - Closing[Material $])
  //   - Packing     = SUM(Closing[Material $])   (existing "Forman Salary - Packing")
  //   - Trips       = SUM(Trips[Forman $])       (LINKED trips only → fct_trips, NOT
  //                   served → registered as 0 and flagged in data_gaps; the UNLINKED
  //                   trip foreman pay is already inside Forman Total $ so it flows
  //                   through the Hourly Rate component, not this one.)
  register("Forman Salary - CF",          "closing", money, rows => sum(rows, "CF %"));
  register("Forman Salary - Review",      "closing", money, rows => sum(rows, "Review"));
  register("Forman Salary - Tip",         "closing", money, rows => sum(rows, "Tip from Company Part"));
  register("Forman Salary - Hourly Rate", "closing", money,
    rows => sum(rows, "Forman Total $") - sum(rows, "Material $"));
  register("Forman Salary - Trips",       "closing", money, rows => 0); // linked-trip residual (gap)
  register("Forman Salary", "closing", money, rows =>
    M["Forman Salary - CF"].fn(rows)
    + M["Forman Salary - Hourly Rate"].fn(rows)
    + M["Forman Salary - Packing"].fn(rows)
    + M["Forman Salary - Review"].fn(rows)
    + M["Forman Salary - Tip"].fn(rows)
    + M["Forman Salary - Trips"].fn(rows));

  // Total Refunds. DAX: CALCULATE(SUM(Closing[Amount Refunded]), USERELATIONSHIP(
  // Calendar[Date], Closing[Refund Date])) — i.e. refund $ time-sliced by Refund Date.
  // Client-side, Amount Refunded / Refund Date are NOT on fct_closing; they live in
  // rollup_support (per-Request Joinkey). The already-registered "Total Refunds" on the
  // `refunds` dataset (SUM(fct_refunds[Total refund]), sliced by Refund Date) is the
  // faithful equivalent — fct_refunds is the same source rollup_support aggregates and
  // it carries a real Refund Date column for the time slice. Kept as-is (see above,
  // "refunds" dataset). Operational Profit references it via M["Total Refunds"].

  // Amount Deducted From Sales Person Normalized For Sales.
  // DAX: SUMX(SalesPersonSalaries, RELATED(Closing[Amount Reduced from Sales Person])
  //          * SalesPersonSalaries[Bill Distribution]).
  // Registered on sales_salaries (same filter scope as Sales Commission — both slice
  // via closing membership on Unique Key). The RELATED(Closing[Amount Reduced from
  // Sales Person]) factor is NOT available on the served sales_salaries rows (that
  // column lives in rollup_support by Request Joinkey, not on fct_closing nor on
  // fct_sales_salaries), so the per-row product cannot be reconstructed client-side.
  // Implemented as 0 and flagged in data_gaps as a KNOWN residual so the Operational
  // Profit formula still balances against the rest; do NOT treat as faithful.
  register("Amount Deducted From Sales Person Normalized For Sales",
    "sales_salaries", money, rows => 0);

  // Operational Profit by Formula.
  // DAX: [Total Bill] - ([Forman Salary]+[Driver Salary]+[Helper Salary]+[Sales
  //   Commission] - [Amount Deducted...]) - ([Car]+[Fuel]+[Hotel]+[Toll]+[Truck]+
  //   [Other Expenses] + [Total Refunds]).
  // Cross-dataset: Total Bill / expenses / Forman / Driver live on `closing`; Helper
  // Salary on `helper_salaries`; Sales Commission + the normalized deduction on
  // `sales_salaries`; Total Refunds on `refunds`. Each sub-measure is evaluated in the
  // SAME global filter scope (RS.filtered applies the same date/slicer state to every
  // dataset — helper/sales salaries time-slice via closing membership on Unique Key),
  // so summing them here is filter-consistent. The page must pass each sub-measure its
  // own dataset's filtered rows; this fn wires that via _msr() below.
  register("Operational Profit by Formula", "closing", money, (rows, segKeys) => {
    // Forman/Driver/expenses are closing measures (same rows); Helper Salary, Sales
    // Commission and the normalized deduction come from other datasets via _msrK; Total
    // Refunds from the refunds dataset via _msrK. Whole-month (segKeys absent) => same
    // global scope as before. Segment breakdown (segKeys = the segment's closing Unique
    // Keys) => keyed salary tables scope to the segment, so each slice is its own
    // revenue minus its own costs instead of full-company costs (fixes negative segments).
    const salaries = M["Forman Salary"].fn(rows) + M["Driver Salary"].fn(rows)
      + _msrK("Helper Salary", segKeys) + _msrK("Sales Commission", segKeys)
      - _msrK("Amount Deducted From Sales Person Normalized For Sales", segKeys);
    const expenses = M["Car Expense"].fn(rows) + M["Fuel Expense"].fn(rows)
      + M["Hotel Expense"].fn(rows) + M["Toll Expense"].fn(rows)
      + M["Truck Expense"].fn(rows) + M["Other Expenses"].fn(rows)
      + _msrK("Total Refunds", segKeys);
    return M["Total Bill"].fn(rows) - salaries - expenses;
  }, ["helper_salaries", "sales_salaries", "refunds"]);

  register("Operational Profit Margin", "closing", fmtPct, rows => {
    const b = M["Total Bill"].fn(rows);
    return b ? M["Operational Profit by Formula"].fn(rows) / b : 0;
  }, ["helper_salaries", "sales_salaries", "refunds"]);
  register("Sales Commission Margin", "closing", fmtPct, rows => {
    const b = M["Total Bill"].fn(rows);
    return b ? _msr("Sales Commission") / b : 0;
  }, ["sales_salaries"]);

  // --- Reviews (breakdown = per-platform parsed tokens; counts = factual monthly).
  // `Counts` is a 'Yes'/'No' varchar in the warehouse — accept any truthy spelling.
  const isYes = v => { const s = String(v == null ? "" : v).trim().toLowerCase();
    return s === "yes" || s === "1" || s === "true"; };
  // PBI "Total Reviews Written" = That Counts + That Doesn't Count (both unfiltered sums).
  // "Counted Reviews Written" is the counted-only slice the Reviews page displays.
  register("Total Reviews Written", "reviews_breakdown", fmtN,
    rows => sum(rows, "Number of Reviews"));
  register("Counted Reviews Written", "reviews_breakdown", fmtN,
    rows => sum(rows.filter(r => isYes(r["Counts"])), "Number of Reviews"));
  register("Reviews Written (not counted)", "reviews_breakdown", fmtN,
    rows => sum(rows.filter(r => !isYes(r["Counts"])), "Number of Reviews"));
  register("Review Score (avg)", "reviews_breakdown", fmt1, rows => {
    const c = rows.filter(r => isYes(r["Counts"]) && r["Review Score"] != null);
    const n = c.reduce((a, r) => a + num(r["Number of Reviews"]), 0);
    if (!n) return null;
    return c.reduce((a, r) => a + num(r["Review Score"]) * num(r["Number of Reviews"]), 0) / n;
  });
  // review_counts rows are monthly PLATFORM SNAPSHOTS (cumulative totals) —
  // the business number is the LATEST snapshot per platform, never the sum.
  const latestPerPlatform = rows => {
    const best = {};
    rows.forEach(r => {
      // Grain = Company × Platform: Angi/Thumbtack/Trustpilot are shared by both
      // companies with the same snapshot date; keying on Platform alone silently
      // dropped the second company (~11% undercount). PBI sums every (Company,Platform).
      const k = (r.Company || "—") + "|" + (r.Platform || "—");
      if (!best[k] || (r._d || "") > (best[k]._d || "")) best[k] = r;
    });
    return Object.values(best).reduce((a, r) => a + num(r["Number of Reviews"]), 0);
  };
  register("Total Factual Reviews", "review_counts", fmtN, latestPerPlatform);
  register("Review Goal", "review_goals", fmtN, latestPerPlatform);

  // --- CallRail.
  register("Total Calls", "callrail", fmtN, rows => cnt(rows));
  register("First-Time Callers", "callrail", fmtN,
    rows => rows.filter(r => String(r["First-Time Caller"]) === "1" ||
      String(r["First-Time Caller"]).toLowerCase() === "true").length);
  register("Avg Call Duration (s)", "callrail", fmt1, rows => {
    // PBI AVERAGE includes 0-second (missed/abandoned) calls — do NOT filter them out
    // (filtering inflated the mean). num() already coerces blanks to 0.
    const v = rows.map(r => num(r["Duration Seconds"]));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  });

  // --- Provider leads.
  register("Provider Leads", "leads", fmtN, rows => cnt(rows));
  register("Lead Cost", "leads", money, rows => sum(rows, "Lead Cost"));

  /* Generic evaluator: measure over the CURRENT global filters. */
  async function value(name, opts) {
    const m = M[name]; if (!m) return null;
    if (m.deps) await Promise.all(m.deps.map(d => load(d)));  // warm cross-dataset sub-measures
    const rows = await load(m.ds);
    return m.fn(filtered(m.ds, rows, opts));
  }

  /* Time-intelligence: same measure, date window shifted -1 year (DATEADD).
     If no explicit range is set, compares calendar years via the year grouping instead. */
  async function yoy(name, opts) {
    const m = M[name]; if (!m) return null;
    if (m.deps) await Promise.all(m.deps.map(d => load(d)));  // warm cross-dataset sub-measures
    const rows = await load(m.ds);
    const cur = m.fn(filtered(m.ds, rows, opts));
    const save = { f: state.dateFrom, t: state.dateTo };
    const sh = shiftedState(-1, 0);
    if (!save.f && !save.t) return { cur, prev: null, growth: null };
    state.dateFrom = sh.from; state.dateTo = sh.to;
    const prev = m.fn(filtered(m.ds, rows, opts));
    state.dateFrom = save.f; state.dateTo = save.t;
    return { cur, prev, growth: prev ? (cur - prev) / Math.abs(prev) : null };
  }

  /* Group rows by a column, evaluate a measure per group. Returns sorted [{k, v}]. */
  function groupBy(rows, col, measureName, topN) {
    const m = M[measureName];
    const g = {};
    rows.forEach(r => {
      const k = (col === "_month") ? (r._y + "-" + String(r._m).padStart(2, "0"))
        : (r[col] == null || r[col] === "" ? "—" : String(r[col]));
      (g[k] = g[k] || []).push(r);
    });
    let out = Object.entries(g).map(([k, rs]) => ({ k, v: m.fn(rs), n: rs.length }));
    out.sort(col === "_month" ? (a, b) => a.k.localeCompare(b.k) : (a, b) => (b.v || 0) - (a.v || 0));
    if (topN) out = out.slice(0, topN);
    return out;
  }

  /* Partial-month guard (audit F8/F10): month-anchored cards step back to the last
     COMPLETE month while the current month is under MIN_MONTH_DAYS days old, so a
     1-day July doesn't render as a collapsed score with a scary red delta. */
  const MIN_MONTH_DAYS = 10;
  function displayMonth(sortedKeys) {
    if (!sortedKeys || !sortedKeys.length) return { key: null, partial: false, steppedBack: false };
    const last = sortedKeys[sortedKeys.length - 1];
    const now = new Date();
    const curKey = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, "0");
    if (last === curKey && now.getDate() < MIN_MONTH_DAYS && sortedKeys.length > 1)
      return { key: sortedKeys[sortedKeys.length - 2], partial: false, steppedBack: true };
    return { key: last, partial: last === curKey, steppedBack: false };
  }

  /* ---------------- shell contracts (published for pages / filter bar) ----------

     RS.dateBasis(datasetName) -> plain-English label of the date column the global
     Date filter slices that dataset by ("Move date", "Lead created", ...). The shell
     renders it under the filter bar so users know what "March" means on each page.
     null = the dataset has no date column of its own (keyed lookup tables inherit
     the closing scope via Unique-Key membership — see filtered()). */
  const DATE_BASIS = {
    closing: "Move date",              // fct_closing `Date` = the move/closing date
    moveboard: "Lead created",         // defaultDate "Create Date"
    storage: "Payment date",
    refunds: "Refund date",
    long_distance: "Move date",        // fct_long_distance `Date` = job/move date
    claims: "Claim date",              // "Created Date" = when the claim was written
    negative_reviews: "Review date",
    reviews_breakdown: "Review date",  // "Event Date"
    card_expenses: "Transaction date",
    callrail: "Call date",             // "Start Time"
    leads: "Lead created",             // provider leads: "Lead Date"
    scorecard: "Scorecard month",
    review_counts: "Snapshot date",
    review_goals: "Snapshot date",
    rollup: null, sales_salaries: null, helper_salaries: null,  // no own date — follow the job's move date
  };
  function dateBasis(ds) { return DATE_BASIS[ds] || null; }

  /* RS.fieldsFor(datasetName) -> array of slicer field keys (FIELDS keys, e.g.
     "year", "company", "foreman") that actually map to a column of that dataset —
     the same mapping filtered() uses to skip unmapped fields. The shell greys out
     (or badges) slicers NOT in this list for the current page's datasets, so a
     no-op filter can't silently mislead. */
  function fieldsFor(ds) {
    return Object.keys(FIELDS).filter(k => FIELDS[k][ds] != null);
  }

  /* User-visible display names for registry measures whose internal key must not
     change (other code references the keys). Render labels through this map. */
  const DISPLAY_NAMES = {
    "Operating Profit Before Commission": "Cash Collected (Net + Card)",
    "Total Revenue": "Job Revenue (excl. trips)",
  };
  function displayName(key) { return DISPLAY_NAMES[key] || key; }

  /* Coverage window (audit F12): min/max loaded date, for "data since X" footnotes. */
  function coverage(rows) {
    let lo = null, hi = null;
    for (const r of rows) { const d = r._d; if (!d) continue; if (!lo || d < lo) lo = d; if (!hi || d > hi) hi = d; }
    return { from: lo, to: hi };
  }

  return { DATASETS, FIELDS, state, load, filtered, monthName, M, value, yoy, groupBy, moneyC,
           fmtN, money, fmtPct, fmt1, num,
           MIN_MONTH_DAYS, displayMonth, coverage,
           bookingRate, dateBasis, fieldsFor, displayName };
})();
