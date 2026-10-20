/* Storage planning -- the STORAGE tab of Seasonal Planning (his ask, 2026-10-06).

   "We have a lot of storage rentings this year because of regular moves ... how to properly have
   storage set up -- where to rent if we need to rent and how big it should be -- to cut the costs.
   Maybe it's better to have 1 huge storage in CT?"

   Facts: mart_storage_plan (src/storage_plan.py) -- CF held per zone per day (customers in our
   warehouse, customers in rented units, long-distance goods in rented units), self-storage rent per
   zone per month, and the rented units by zone x purpose. Names nothing.

   OWN A FACILITY OR KEEP RENTING -- BY STATE (his call 2026-10-11, replacing options A-F: "I don't
   need this multiple options - I just need scenarios - we have X sized storage in PA - or we don't.
   Same with CT"). Per state one switch: a facility of size X, or not.
     - not:  what that state's rented units actually cost (the bank), month by month;
     - with: the facility's monthly rent + a worker + other running costs, PLUS units still rented in
             any month the state holds more than the facility fits, priced at that state's own real
             $ per CF-month (rent / CF held over the same months).
   THE NJ BASE (his word 2026-10-12, after finance checked the debits): FLM Associates IS the main
   base -- vaults, trucks, office -- paid by bank debit, ~$5,300 a month. It counts in what storage
   costs (zone "NJBASE" in the mart, kept apart from the rented units' $ per CF); dispatch runs the
   storage there, so no worker. The NJ row is about the units we still rent on top of the base. A
   new PA or CT facility would need a worker (default one person, 40 h x $20).
   EXTRA STOPS (his point 2026-10-12): a load into a rented unit is a detour -- the crew drives to
   the unit, unloads, then takes the truck back to base -- and again when the goods come out for
   delivery; at our own base the truck just comes home. Each load = 2 stops x (hours x crew x $/h +
   miles x $/mile). His answer: "we can't measure"; the default is my best guess -- 45 minutes a
   stop (units sit a median 16-23 road miles from their base; ~15 extra miles plus getting into a
   unit with no dock), crew 3 at $20, truck $1.11 a mile. A facility at the base saves the stops
   for everything it holds; overflow units keep theirs. Everything is this browser's settings.

   WHERE THE STORAGE MONEY GOES (his pick 2026-10-12): spend by calendar year since 2024 and the last 12
   months -- rented units (Public Storage, Extra Space, Gap), the NJ base, Tuji's Delaware unit, and the
   extra stops (loads per year from the mart's `loadsy` rows x 2 x the stop cost in the settings).

   Rented units, why and where (his ask 2026-10-10, "which states use the most rental storages"):
   the `units` rows -- zone x purpose from dispatch's Public Storage export (fct_storage_unit).

   WHAT PUBLIC STORAGE COST US (his ask 2026-10-20): Irakli's report views -- paid per month by state,
   top locations, cost per job, every unit -- at exact bank amounts, from mart_storage_ps (one row per
   Public Storage charge on the bank, with its unit, size and JOB CODE; never a customer). Its own
   period and state pills; see psPaint.

   Mounted by area-plan.js into #apStorage on every paint; it keeps its own state on window and
   re-renders from cache, so a repaint of the page costs nothing. */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.storage_plan) {
    RS.DATASETS.storage_plan = {
      table: "mart_storage_plan",
      cols: ["Kind", "Day", "Month", "Zone", "Customer Our CF", "Customer Rented CF", "LD CF", "Customer Fees",
             "Rent USD", "Facilities", "Jobs", "Miles NJ", "Miles PA", "Miles CT", "Miles CT2", "Lat", "Lng",
             "Purpose", "Units", "Open Units", "Months Held", "First Rent"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.storage_ps) {
    // every Public Storage charge on the bank (src/storage_plan.py run_ps) -- job codes, no names
    RS.DATASETS.storage_ps = {
      table: "mart_storage_ps",
      cols: ["Day", "Month", "State", "Location", "Card", "Amount", "Link", "Unit", "Size", "Job Code",
             "Job Type", "Opened", "Status", "Monthly"],
      dateCols: {}, defaultDate: null,
    };
  }
  var LS = "ztzStoragePlan.v2";   // v2 (2026-10-11): the A-F settings are gone, the per-state ones are new
  /* defaults: a 2,000 sq ft space at ~$18/sq ft/year all-in (central NJ industrial asking ~$16, Colliers
     Q2 2026, plus taxes / insurance / the small-space premium) = $3,000/month; vaults 3 high hold ~11 CF
     per sq ft; a worker = one person, 40 h a week at $20 (this year's crew pay). Other running costs
     (power, insurance, internet) start at 0 -- add yours. */
  var DEF = {
    ownNJ: 0, ownPA: 0, ownCT: 0,
    sqftNJ: 2000, rentNJ: 3000, workerNJ: 0, otherNJ: 0,
    sqftPA: 2000, rentPA: 3000, workerPA: 3460, otherPA: 0,
    sqftCT: 2000, rentCT: 3000, workerCT: 3460, otherCT: 0,
    density: 11,
    stopHours: 0.75, crewSize: 3, crewRate: 20, stopMiles: 15, mileCost: 1.11,
  };
  var LABEL = {
    sqftNJ: "NJ: facility size (sq ft)", rentNJ: "NJ: rent $/month", workerNJ: "NJ: worker $/month", otherNJ: "NJ: power, insurance, other $/month",
    sqftPA: "PA: facility size (sq ft)", rentPA: "PA: rent $/month", workerPA: "PA: worker $/month", otherPA: "PA: power, insurance, other $/month",
    sqftCT: "CT: facility size (sq ft)", rentCT: "CT: rent $/month", workerCT: "CT: worker $/month", otherCT: "CT: power, insurance, other $/month",
    density: "CF stored per sq ft (vaults 3 high)",
    stopHours: "Extra stop at a rented unit: hours", crewSize: "Crew on the truck", crewRate: "Crew $ per hour",
    stopMiles: "Extra stop: truck miles", mileCost: "Truck $ per mile",
  };
  var ZONES = ["NJ", "PA", "CT"];
  var ZONE_NAME = { NJ: "New Jersey (Tinton Falls)", PA: "Philadelphia", CT: "Connecticut (Bridgeport)", DE: "Delaware (Tuji)" };

  function cfg() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(LS) || "{}") || {}; } catch (e) { s = {}; }
    var o = {}; Object.keys(DEF).forEach(function (k) { o[k] = (s[k] != null && s[k] !== "") ? s[k] : DEF[k]; });
    return o;
  }
  function saveCfg(o) { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) {} }
  var esc = function (v) { return RSC.esc(v); };
  var num = function (v) { return v == null || v === "" || isNaN(v) ? 0 : +v; };
  var money = function (v) { return (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US"); };
  var moneyK = function (v) { var a = Math.abs(v); return (v < 0 ? "−$" : "$") + (a >= 1e4 ? Math.round(a / 1e3) + "k" : Math.round(a).toLocaleString("en-US")); };
  var cf = function (v) { return Math.round(v).toLocaleString("en-US") + " CF"; };
  var MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var ml = function (ym) { var p = String(ym).split("-"); return MON[+p[1]] + " " + p[0].slice(2); };

  var ST = window.__spState = window.__spState || { rows: null, err: null, loading: null, ps: null, psErr: null };

  function load() {
    if (ST.rows || ST.loading) return ST.loading;
    ST.loading = Promise.all([
      RS.load("storage_plan"),
      // the Public Storage views read their own table; until it is built the rest of the tab still draws
      RS.load("storage_ps").catch(function (e) { ST.psErr = e.message || String(e); return null; }),
    ]).then(function (got) {
      ST.rows = (got[0] && (got[0].rows || got[0])) || [];
      ST.ps = (got[1] && (got[1].rows || got[1])) || [];
    }).catch(function (e) { ST.err = e.message || String(e); });
    return ST.loading;
  }

  /* ---------------- the arithmetic ---------------- */
  function compute(c) {
    var rows = ST.rows || [];
    var demand = rows.filter(function (r) { return r.Kind === "demand"; });
    var months = {};
    demand.forEach(function (r) { months[r.Month] = 1; });
    var allM = Object.keys(months).sort();
    // THE WINDOW = THE LAST 12 MONTHS WE HAVE RENT FOR, so the options and "as today" price the
    // same months (the bank sheet runs a month or so behind the storage register)
    var rentMonths = {}; rows.forEach(function (r) { if (r.Kind === "rent") rentMonths[r.Month] = 1; });
    var cur = new Date().toISOString().slice(0, 7);
    var win = allM.filter(function (m) { return m < cur && rentMonths[m]; }).slice(-12);
    var inWin = {}; win.forEach(function (m) { inWin[m] = 1; });
    // per month x zone: average and peak of each kind, and fees
    var M = {};
    var dayTot = {};
    demand.forEach(function (r) {
      if (!inWin[r.Month]) return;
      var k = r.Month + "|" + r.Zone;
      var o = M[k] = M[k] || { our: 0, rent: 0, ld: 0, days: {}, peakRented: 0, peakAll: 0, fees: 0 };
      var rented = num(r["Customer Rented CF"]) + num(r["LD CF"]);
      o.our += num(r["Customer Our CF"]); o.rent += num(r["Customer Rented CF"]); o.ld += num(r["LD CF"]);
      o.days[r.Day] = 1; o.fees += num(r["Customer Fees"]);
      o.peakRented = Math.max(o.peakRented, rented);
      o.peakAll = Math.max(o.peakAll, rented + num(r["Customer Our CF"]));
      dayTot[r.Day] = (dayTot[r.Day] || 0) + rented + num(r["Customer Our CF"]);
    });
    var dim = function (m) { var p = m.split("-"); return new Date(+p[0], +p[1], 0).getDate(); };
    var peakDay = null, peakCF = 0;
    Object.keys(dayTot).forEach(function (d) { if (dayTot[d] > peakCF) { peakCF = dayTot[d]; peakDay = d; } });
    var rent = rows.filter(function (r) { return r.Kind === "rent"; });
    var rentM = {}; rent.forEach(function (r) { rentM[r.Month] = 1; });
    var rentWin = Object.keys(rentM).sort().slice(-12);
    var rentByZone = {}, rentTot = 0, rentByMonth = {};
    rent.forEach(function (r) {
      if (rentWin.indexOf(r.Month) < 0) return;
      rentByZone[r.Zone] = (rentByZone[r.Zone] || 0) + num(r["Rent USD"]);
      rentTot += num(r["Rent USD"]);
    });
    rent.forEach(function (r) { rentByMonth[r.Month] = (rentByMonth[r.Month] || 0) + num(r["Rent USD"]); });

    var get = function (m, z) { return M[m + "|" + z] || { our: 0, rent: 0, ld: 0, days: {}, peakRented: 0, peakAll: 0, fees: 0 }; };
    var rentZM = {};
    rent.forEach(function (r) { if (inWin[r.Month]) rentZM[r.Month + "|" + r.Zone] = (rentZM[r.Month + "|" + r.Zone] || 0) + num(r["Rent USD"]); });
    var perYear = win.length ? 12 / win.length : 1;
    // loads into rented units, last 12 months -- each one is two extra stops (in, and out for delivery)
    var loads = {}; rows.filter(function (r) { return r.Kind === "loads"; }).forEach(function (r) { loads[r.Zone] = num(r.Jobs); });
    var STOPS_PER_LOAD = 2;
    var perStop = num(c.stopHours) * num(c.crewSize) * num(c.crewRate) + num(c.stopMiles) * num(c.mileCost);

    // per zone: what it held in rented space, month by month, and what that rent cost
    var zt = {}, fees = 0, heldAll = 0;
    ZONES.forEach(function (z) {
      var o = { avgRented: 0, peakRented: 0, avgOur: 0, avgLD: 0, minMonth: Infinity, maxMonth: 0, held: {}, heldSum: 0, today: 0 };
      win.forEach(function (m) {
        var g = get(m, z), n = dim(m), h = (g.rent + g.ld) / n;
        o.held[m] = h; o.heldSum += h;
        o.avgRented += h / win.length;
        o.avgLD += g.ld / n / win.length;
        o.avgOur += g.our / n / win.length;
        o.peakRented = Math.max(o.peakRented, g.peakRented);
        o.minMonth = Math.min(o.minMonth, h); o.maxMonth = Math.max(o.maxMonth, h);
        o.today += num(rentZM[m + "|" + z]);
        fees += g.fees;
      });
      if (o.minMonth === Infinity) o.minMonth = 0;
      // the state's own real price: rent / CF held over the same months ($ per CF-month)
      o.perCF = o.heldSum ? o.today / o.heldSum : 0;
      heldAll += o.heldSum;
      zt[z] = o;
    });
    // the NJ base, DE (Tuji) and anything unmapped stay as they are in every scenario
    var base = num(rentByZone.NJBASE);
    var asIs = num(rentByZone.DE) + num(rentByZone.Unmapped) + base;
    var A = rentTot;

    // OWN OR RENT, per state: with a facility = its fixed costs + units still rented when it is full
    var sc = {};
    ZONES.forEach(function (z) {
      var o = zt[z], cap = num(c["sqft" + z]) * num(c.density);
      var fixedMo = num(c["rent" + z]) + num(c["worker" + z]) + num(c["other" + z]);
      var overflow = 0, over = 0, fillSum = 0;
      win.forEach(function (m) {
        var h = o.held[m] || 0, extra = Math.max(0, h - cap);
        overflow += extra * o.perCF; if (extra > 0) over++;
        fillSum += cap ? Math.min(h, cap) / cap : 0;
      });
      // the stops: today every load; with a facility at the base only the overflow's share
      var stops = num(loads[z]) * STOPS_PER_LOAD * perStop;
      var overShare = o.heldSum ? (overflow / (o.perCF || 1)) / o.heldSum : 0;
      var today = o.today * perYear + stops;
      var withFac = (fixedMo * win.length + overflow) * perYear + stops * overShare;
      sc[z] = {
        own: !!num(c["own" + z]), cap: cap, fixedMo: fixedMo, units: o.today * perYear, stops: stops, loads: num(loads[z]),
        stopsKept: stops * overShare, today: today, overflow: overflow * perYear, withFac: withFac,
        avgFill: win.length ? fillSum / win.length : 0, peakFill: cap ? o.peakRented / cap : 0, monthsOver: over,
        // the monthly rent at which the facility costs exactly what renting costs today
        breakEven: win.length ? (o.today - overflow + (stops - stops * overShare) / perYear) / win.length - num(c["worker" + z]) - num(c["other" + z]) : 0,
      };
    });
    var scenario = asIs * perYear + ZONES.reduce(function (a, z) { return a + (sc[z].own ? sc[z].withFac : sc[z].today); }, 0);
    var todayAll = asIs * perYear + ZONES.reduce(function (a, z) { return a + sc[z].today; }, 0);

    // WHERE THE MONEY GOES: calendar years since 2024, this year to date, and the last 12 months
    var UNIT_ZONES = { NJ: 1, PA: 1, CT: 1, Unmapped: 1 };
    var bucket = function () { return { units: 0, base: 0, tuji: 0, stops: 0, months: {} }; };
    var years = {}, last12 = bucket();
    rent.forEach(function (r) {
      var y = String(r.Month).slice(0, 4), b = years[y] = years[y] || bucket(), v = num(r["Rent USD"]);
      var k = r.Zone === "NJBASE" ? "base" : r.Zone === "DE" ? "tuji" : UNIT_ZONES[r.Zone] ? "units" : null;
      if (!k) return;
      b[k] += v; b.months[r.Month] = 1;
      if (rentWin.indexOf(r.Month) >= 0) last12[k] += v;
    });
    rows.filter(function (r) { return r.Kind === "loadsy" && UNIT_ZONES[r.Zone]; }).forEach(function (r) {
      if (years[r.Month]) years[r.Month].stops += num(r.Jobs) * STOPS_PER_LOAD * perStop;
    });
    ZONES.forEach(function (z) { last12.stops += sc[z].stops; });
    var spend = Object.keys(years).sort().filter(function (y) { return y >= "2024"; }).map(function (y) {
      var ms = Object.keys(years[y].months).sort();
      return Object.assign(years[y], { label: ms.length >= 12 ? y : ml(ms[0]) + " – " + ml(ms[ms.length - 1]) });
    });
    spend.push(Object.assign(last12, { label: "Last 12 months", last: true }));

    var unitRows = rows.filter(function (r) { return r.Kind === "units"; });
    var shortRows = unitRows.filter(function (r) { return r.Purpose === "Short hold, not billed"; });
    var billedRows = unitRows.filter(function (r) { return r.Purpose === "Short hold, billed"; });
    var shortPaid = shortRows.reduce(function (a, r) { return a + num(r["Rent USD"]); }, 0);
    var shortUnits = shortRows.reduce(function (a, r) { return a + num(r.Units); }, 0);
    var unitsFrom = unitRows.length ? String(unitRows[0].Day || "").slice(0, 10) : "";
    return {
      unitRows: unitRows, shortPaid: shortPaid, shortUnits: shortUnits, unitsFrom: unitsFrom,
      billedUnits: billedRows.reduce(function (a, r) { return a + num(r.Units); }, 0),
      win: win, rentWin: rentWin, M: M, get: get, dim: dim, peakDay: peakDay, peakCF: peakCF, rentByMonth: rentByMonth,
      rentByZone: rentByZone, A: A, asIs: asIs, base: base, zt: zt, fees: fees, sc: sc, scenario: scenario, todayAll: todayAll,
      perYear: perYear, perStop: perStop, spend: spend,
      perCFAll: heldAll ? (A - asIs) / heldAll : 0,
    };
  }

  /* RENTED UNITS -- why and where (his ask 2026-10-10: "which states uses the most rental storages").
     Zone x purpose from dispatch's Public Storage export; no names (this tab is for everyone). */
  var PURPOSES = ["Customer storage", "Short hold, not billed", "Short hold, billed", "Long distance", "No job"];
  var PURPOSE_NOTE = {
    "Customer storage": "a customer's goods, weeks or more",
    "Short hold, not billed": "a night or a few on a local two-day move — our cost",
    "Short hold, billed": "a night or a few, charged to the customer as storage",
    "Long distance": "waiting for delivery",
    "No job": "no job found for the unit",
  };
  function dayLong(d) {
    var t = d ? new Date(d + "T00:00:00") : null;
    return t && !isNaN(t) ? t.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : (d || "");
  }
  function unitsPanel(R) {
    if (!R.unitRows.length) return "";
    var by = {}; R.unitRows.forEach(function (r) { (by[r.Zone] = by[r.Zone] || []).push(r); });
    var zones = ["NJ", "PA", "CT", "DE", "Unmapped"].filter(function (z) { return by[z]; });
    var zt = function (z) {
      return by[z].reduce(function (a, r) { a.u += num(r.Units); a.o += num(r["Open Units"]); a.p += num(r["Rent USD"]); return a; }, { u: 0, o: 0, p: 0 });
    };
    zones.sort(function (a, b) { return zt(b).p - zt(a).p; });
    var name = function (z) { return z === "Unmapped" ? "Elsewhere" : (ZONE_NAME[z] || z); };
    var body = zones.map(function (z) {
      var t = zt(z);
      var rowsZ = by[z].slice().sort(function (a, b) { return PURPOSES.indexOf(a.Purpose) - PURPOSES.indexOf(b.Purpose); });
      return '<tr class="sp-unitz"><td><b>' + esc(name(z)) + '</b></td><td></td><td class="num"><b>' + t.u + '</b></td><td class="num">' + t.o
        + '</td><td></td><td class="num"><b>' + money(t.p) + "</b></td><td></td></tr>"
        + rowsZ.map(function (r) {
            return '<tr><td></td><td>' + esc(r.Purpose) + '<div class="sp-sub">' + esc(PURPOSE_NOTE[r.Purpose] || "") + "</div></td>"
              + '<td class="num">' + num(r.Units) + '</td><td class="num">' + num(r["Open Units"]) + "</td>"
              + '<td class="num">' + (r["Months Held"] == null || r["Months Held"] === "" ? "—" : num(r["Months Held"]).toFixed(1)) + "</td>"
              + '<td class="num">' + money(num(r["Rent USD"])) + '</td><td class="num">' + money(num(r["First Rent"])) + "</td></tr>";
          }).join("");
    }).join("");
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Rented units — why we rent</span>'
      + '<span class="sp-sub">Public Storage units opened since ' + esc(dayLong(R.unitsFrom)) + ", from dispatch's export; cost = what the card feed shows for each unit</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Zone</th><th>Why</th><th class="num">Units</th><th class="num">Open now</th>'
      + '<th class="num">Months held (median)</th><th class="num">Paid</th><th class="num">First rent (avg)</th></tr></thead><tbody>'
      + body + "</tbody></table></div>"
      + (R.shortUnits || R.billedUnits ? '<p class="sp-note"><b>Short holds:</b> ' + (R.shortUnits + R.billedUnits) + " units were rented for a night or a few days on local two-day moves — a month's rent plus a $22 fee each time. "
          + R.billedUnits + " were billed to the customer as storage (they earn more than the unit costs); the other " + R.shortUnits + " cost us " + money(R.shortPaid)
          + " so far. Keeping those goods on the truck or in our warehouse saves that.</p>" : "")
      + '<p class="sp-note">Units opened before ' + esc(dayLong(R.unitsFrom)) + ", Extra Space units and Tuji's are not in the export; the rent rows above still count them.</p></div>";
  }

  function spendPanel(R) {
    if (!R.spend.length) return "";
    var tot = function (b) { return b.units + b.base + b.tuji + b.stops; };
    var line = function (lab, sub, k, strong) {
      return "<tr" + (strong ? ' class="sp-tot"' : "") + "><td>" + (strong ? "<b>" + lab + "</b>" : lab) + (sub ? '<div class="sp-sub">' + sub + "</div>" : "") + "</td>"
        + R.spend.map(function (b) {
            var v = k ? b[k] : tot(b);
            return '<td class="num' + (b.last ? " sp-last" : "") + '">' + (strong ? "<b>" + money(v) + "</b>" : money(v)) + "</td>";
          }).join("") + "</tr>";
    };
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Where the storage money goes</span><span class="sp-sub">from the bank, after refunds · calendar years and the last 12 months</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th></th>'
      + R.spend.map(function (b) { return '<th class="num' + (b.last ? " sp-last" : "") + '">' + esc(b.label) + "</th>"; }).join("") + "</tr></thead><tbody>"
      + line("Rented units", "Public Storage, Extra Space, Gap Self Storage", "units")
      + line("NJ base", "FLM Associates — vaults, trucks, office", "base")
      + line("Tuji's unit", "Delaware, on Tuji's card", "tuji")
      + line("Extra stops at rented units", "crew time + truck miles, " + money(R.perStop) + " a stop (settings) — an estimate", "stops")
      + line("Total", "", null, true)
      + "</tbody></table></div></div>";
  }

  /* WHAT PUBLIC STORAGE COST US (his ask 2026-10-20: "add Irakli's report views ... with exact bank
     amounts"). Irakli's own report priced each unit as payments x today's monthly rent; here every
     number is a Public Storage charge on the bank (mart_storage_ps, refunds signed), so each view adds
     up to the bank to the cent. Four views over one period and one state pick: paid per month by state,
     top locations, cost per job, every unit. Job codes, never customers (this tab is for everyone).
     A charge no unit in dispatch's export claims stays in every total under the reason the ledger gave
     it -- units opened before the export, Tuji's card -- so nothing quietly drops out. */
  var PSV = window.__spPs = window.__spPs || { per: "ytd", st: "", more: {} };
  var ST_ORDER = ["NJ", "PA", "CT", "NY", "DE", "SC"];
  var money2 = function (v) {
    return (v < -0.004 ? "−$" : "$") + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  var stName = function (s) { return !s ? "No state" : s === "DE" ? "DE · Tuji's card" : s; };

  function psPeriods(rows) {
    var last = rows.reduce(function (a, r) { return String(r.Day || "") > a ? String(r.Day).slice(0, 10) : a; }, "");
    if (!last) return [];
    var y = +last.slice(0, 4), lm = last.slice(0, 7);
    var p = new Date(+lm.slice(0, 4), +lm.slice(5, 7) - 12, 1);
    var from12 = p.getFullYear() + "-" + String(p.getMonth() + 1).padStart(2, "0") + "-01";
    var out = [{ k: "ytd", label: y + " to date", a: y + "-01-01", b: last },
               { k: "12m", label: "Last 12 months", a: from12, b: last }];
    var years = {};
    rows.forEach(function (r) { var yy = +String(r.Day || "").slice(0, 4); if (yy && yy < y) years[yy] = 1; });
    Object.keys(years).sort().reverse().forEach(function (yy) { out.push({ k: "y" + yy, label: yy, a: yy + "-01-01", b: yy + "-12-31" }); });
    out.forEach(function (o) { o.last = last; });
    return out;
  }

  function psCalc(rows, per, st) {
    var R = { tot: 0, refunds: 0, n: 0, months: {}, ms: [], byState: {}, locs: {}, jobs: {}, units: {}, loose: {}, why: {}, last: per.last };
    var inP = rows.filter(function (r) { var d = String(r.Day || "").slice(0, 10); return d >= per.a && d <= per.b; });
    // the state chips: every state with money in the period, before the pick narrows it
    inP.forEach(function (r) { var s = r.State || ""; R.byState[s] = (R.byState[s] || 0) + num(r.Amount); });
    // months: every month of the period up to the bank's last day, even an empty one
    var d = new Date(+per.a.slice(0, 4), +per.a.slice(5, 7) - 1, 1), end = (per.b < per.last ? per.b : per.last).slice(0, 7);
    for (var guard = 0; guard < 40; guard++) {
      var ym = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
      if (ym > end) break;
      R.ms.push(ym); R.months[ym] = {}; d.setMonth(d.getMonth() + 1);
    }
    inP.forEach(function (r) {
      var s = r.State || "";
      if (st && s !== st) return;
      var v = num(r.Amount), m = String(r.Month || String(r.Day).slice(0, 7));
      R.tot += v; if (v < 0) R.refunds += v; else R.n++;
      var mm = R.months[m] = R.months[m] || {}; mm[s] = (mm[s] || 0) + v;
      var L = R.locs[r.Location] = R.locs[r.Location] || { loc: r.Location, st: s, v: 0, n: 0, units: {} };
      L.v += v; if (v > 0) L.n++;
      if (r.Unit) {
        var key = r.Unit + "|" + r.Location;
        L.units[key] = 1;
        var U = R.units[key] = R.units[key] || { unit: r.Unit, size: r.Size, loc: r.Location, st: s, job: r["Job Code"], type: r["Job Type"],
                                                 opened: r.Opened, status: r.Status, monthly: r.Monthly, v: 0, n: 0 };
        U.v += v; if (v > 0) U.n++;
        if (!r["Job Code"]) R.why["Unit with no job found"] = (R.why["Unit with no job found"] || 0) + v;
      } else {
        var why = r.Link || "No unit on record", lk = r.Location + "|" + why;
        var X = R.loose[lk] = R.loose[lk] || { loc: r.Location, st: s, why: why, v: 0, n: 0 };
        X.v += v; if (v > 0) X.n++;
        R.why[why] = (R.why[why] || 0) + v;
      }
      if (r["Job Code"]) {
        var J = R.jobs[r["Job Code"]] = R.jobs[r["Job Code"]] || { job: r["Job Code"], type: r["Job Type"], v: 0, n: 0, units: {}, locs: {} };
        J.v += v; if (v > 0) J.n++; J.units[r.Unit] = 1; J.locs[r.Location] = 1;
      }
    });
    R.ms = Object.keys(R.months).sort();
    R.monthTot = R.ms.map(function (m) { return Object.keys(R.months[m]).reduce(function (a, s) { return a + R.months[m][s]; }, 0); });
    R.states = Object.keys(R.byState).sort(function (a, b) {
      var ia = ST_ORDER.indexOf(a), ib = ST_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
    R.shownStates = st ? [st] : R.states;
    R.unitList = Object.keys(R.units).map(function (k) { return R.units[k]; }).sort(function (a, b) { return b.v - a.v; });
    R.locList = Object.keys(R.locs).map(function (k) { var o = R.locs[k]; o.u = Object.keys(o.units).length; return o; }).sort(function (a, b) { return b.v - a.v; });
    R.jobList = Object.keys(R.jobs).map(function (k) { return R.jobs[k]; }).sort(function (a, b) { return b.v - a.v; });
    R.looseList = Object.keys(R.loose).map(function (k) { return R.loose[k]; }).sort(function (a, b) { return b.v - a.v; });
    R.jobsTot = R.jobList.reduce(function (a, j) { return a + j.v; }, 0);
    // "monthly bill now": every unit open today in the picked state, whatever the period (as Irakli's)
    var open = {};
    rows.forEach(function (r) {
      if (!r.Unit || String(r.Status || "").toLowerCase() !== "open" || (st && (r.State || "") !== st)) return;
      open[r.Unit + "|" + r.Location] = num(r.Monthly);
    });
    R.openN = Object.keys(open).length;
    R.openMo = Object.keys(open).reduce(function (a, k) { return a + open[k]; }, 0);
    var hi = -1; R.ms.forEach(function (m, i) { if (R.monthTot[i] > (hi < 0 ? -Infinity : R.monthTot[hi])) hi = i; });
    R.hiM = hi >= 0 ? R.ms[hi] : null; R.hiV = hi >= 0 ? R.monthTot[hi] : 0;
    return R;
  }

  function psMore(id, total, shown) {
    if (total <= shown && !PSV.more[id]) return "";
    return '<button class="btn sp-more" data-more="' + id + '">' + (PSV.more[id] ? "Show fewer" : "Show all " + total) + "</button>";
  }

  function psPaint(host) {
    if (!host) return;
    var rows = ST.ps || [];
    var head = '<div class="sp-ps-h"><h2>What Public Storage cost us</h2>'
      + "<p>Every Public Storage charge on the bank, after refunds — by month and state, by location, by job and unit by unit. Irakli's report, at exact bank amounts.</p></div>";
    if (!rows.length) {
      host.innerHTML = head + '<div class="panel"><p class="sp-note" style="margin:0">' + (ST.psErr
        ? "The Public Storage charges are not built yet (" + esc(ST.psErr) + "). They appear after the next loader run."
        : "No Public Storage charges on the bank yet.") + "</p></div>";
      return;
    }
    var pers = psPeriods(rows);
    var per = pers.filter(function (p) { return p.k === PSV.per; })[0] || pers[0];
    PSV.per = per.k;
    var R = psCalc(rows, per, PSV.st);
    if (PSV.st && !R.byState[PSV.st]) { PSV.st = ""; R = psCalc(rows, per, ""); }
    var through = dayLong(R.last);
    var pills = '<div class="sp-pills" role="group" aria-label="Period">' + pers.map(function (p) {
        return '<button class="sp-pill' + (p.k === per.k ? " on" : "") + '" data-per="' + p.k + '">' + esc(p.label) + "</button>";
      }).join("") + "</div>"
      + '<div class="sp-pills" role="group" aria-label="State"><button class="sp-pill' + (!PSV.st ? " on" : "") + '" data-st="">All states</button>'
      + R.states.map(function (s) {
          return '<button class="sp-pill' + (PSV.st === s ? " on" : "") + '" data-st="' + esc(s) + '">' + esc(s || "No state") + "</button>";
        }).join("") + "</div>";
    var nMonths = R.ms.length || 1;
    var looseTot = R.looseList.reduce(function (a, x) { return a + x.v; }, 0);
    var kpis = '<div class="rs-kpis" style="--kpi-cols:5">'
      + '<div class="kpi"><div class="l">Paid in this period</div><div class="v">' + money2(R.tot) + '</div><div class="s">' + R.n + " charges" + (R.refunds ? " · refunds " + money2(R.refunds) : "") + "</div></div>"
      + '<div class="kpi"><div class="l">Average per month</div><div class="v">' + money2(R.tot / nMonths) + '</div><div class="s">' + nMonths + " month" + (nMonths === 1 ? "" : "s") + ", bank through " + esc(through) + "</div></div>"
      + '<div class="kpi"><div class="l">Highest month</div><div class="v">' + money2(R.hiV) + '</div><div class="s">' + esc(R.hiM ? ml(R.hiM) : "—") + "</div></div>"
      + '<div class="kpi"><div class="l">Units paid for</div><div class="v">' + R.unitList.length + '</div><div class="s">+ ' + money2(looseTot) + " no unit in the export claims</div></div>"
      + '<div class="kpi"><div class="l">Monthly bill now</div><div class="v">' + money2(R.openMo) + '</div><div class="s">' + R.openN + " unit" + (R.openN === 1 ? "" : "s") + " open · each one's last monthly charge</div></div>"
      + "</div>";

    // 1) PAID PER MONTH, BY STATE: the chart, then the exact amounts
    var grid = '<div class="rs-tablewrap"><table class="rs-table sp-psgrid"><thead><tr><th>State</th>'
      + R.ms.map(function (m) { return '<th class="num">' + esc(ml(m)) + "</th>"; }).join("")
      + '<th class="num">Total</th></tr></thead><tbody>'
      + R.shownStates.map(function (s) {
          var t = R.ms.reduce(function (a, m) { return a + num(R.months[m][s]); }, 0);
          return "<tr><td><b>" + esc(stName(s)) + "</b></td>"
            + R.ms.map(function (m) { var v = R.months[m][s]; return '<td class="num">' + (v ? money2(v) : '<span class="sp-dim">—</span>') + "</td>"; }).join("")
            + '<td class="num"><b>' + money2(t) + '</b><div class="sp-sub">' + (R.tot ? Math.round(t / R.tot * 100) + "%" : "") + "</div></td></tr>";
        }).join("")
      + (R.shownStates.length > 1 ? '<tr class="sp-tot"><td><b>All states</b></td>' + R.monthTot.map(function (v) { return '<td class="num"><b>' + money2(v) + "</b></td>"; }).join("")
          + '<td class="num"><b>' + money2(R.tot) + "</b></td></tr>" : "")
      + "</tbody></table></div>";
    var p1 = '<div class="panel"><div class="panel-head"><span class="panel-title">Paid per month, by state</span><span class="sp-sub">' + esc(per.label) + " · bank through " + esc(through) + "</span></div>"
      + '<div class="chartbox" style="height:260px"><canvas id="spPsChart"></canvas></div>' + grid + "</div>";

    // 2) TOP LOCATIONS
    var nl = PSV.more.loc ? R.locList.length : Math.min(10, R.locList.length);
    var p2 = '<div class="panel"><div class="panel-head"><span class="panel-title">Top locations</span><span class="sp-sub">' + R.locList.length + " Public Storage locations paid in the period</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Location</th><th>State</th><th class="num">Units</th><th class="num">Charges</th><th class="num">Paid</th><th class="num">Share</th></tr></thead><tbody>'
      + R.locList.slice(0, nl).map(function (o) {
          return "<tr><td>" + esc(o.loc) + "</td><td>" + esc(stName(o.st)) + '</td><td class="num">' + (o.u || '<span class="sp-dim">—</span>') + '</td><td class="num">' + o.n
            + '</td><td class="num"><b>' + money2(o.v) + '</b></td><td class="num">' + (R.tot ? Math.round(o.v / R.tot * 100) + "%" : "—") + "</td></tr>";
        }).join("")
      + "</tbody></table></div>" + psMore("loc", R.locList.length, 10)
      + '<p class="sp-note">Units = units from dispatch\'s export paid for there; "—" = only charges no unit in the export claims (units opened before it, Tuji\'s card).</p></div>';

    // 3) COST PER JOB -- the job code, never the customer
    var nj = PSV.more.job ? R.jobList.length : Math.min(12, R.jobList.length);
    var whyRows = Object.keys(R.why).sort(function (a, b) { return R.why[b] - R.why[a]; });
    var p3 = '<div class="panel"><div class="panel-head"><span class="panel-title">Cost per job</span><span class="sp-sub">' + R.jobList.length + " jobs · the units dispatch tied to each job</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Job</th><th>Type</th><th>Units</th><th>Location</th><th class="num">Charges</th><th class="num">Paid</th></tr></thead><tbody>'
      + R.jobList.slice(0, nj).map(function (j) {
          return "<tr><td><b>" + esc(j.job) + "</b></td><td>" + esc(j.type || "") + "</td><td>" + esc(Object.keys(j.units).join(", ")) + "</td><td>"
            + Object.keys(j.locs).map(esc).join("<br>") + '</td><td class="num">' + j.n + '</td><td class="num"><b>' + money2(j.v) + "</b></td></tr>";
        }).join("")
      + (whyRows.length ? '<tr class="sp-tot"><td colspan="5"><b>Not tied to a job</b><div class="sp-sub">' + whyRows.map(function (w) { return esc(w) + " " + money2(R.why[w]); }).join(" · ") + '</div></td><td class="num"><b>' + money2(R.tot - R.jobsTot) + "</b></td></tr>" : "")
      + '<tr class="sp-tot"><td colspan="5"><b>Total</b></td><td class="num"><b>' + money2(R.tot) + "</b></td></tr>"
      + "</tbody></table></div>" + psMore("job", R.jobList.length, 12) + "</div>";

    // 4) EVERY UNIT, then the charges no unit claims, so the list adds up to the bank
    var nu = PSV.more.unit ? R.unitList.length : Math.min(15, R.unitList.length);
    var p4 = '<div class="panel"><div class="panel-head"><span class="panel-title">Every unit</span><span class="sp-sub">' + R.unitList.length + " units · " + money2(R.tot - looseTot) + " · sorted by what they cost</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Unit</th><th>Location</th><th>Job</th><th>Opened</th><th class="num">Payments in period</th><th class="num">Paid in period</th><th class="num">Monthly now</th></tr></thead><tbody>'
      + R.unitList.slice(0, nu).map(function (u) {
          var open = String(u.status || "").toLowerCase() === "open";
          return "<tr><td><b>" + esc(u.unit) + '</b><div class="sp-sub">' + esc(u.size || "") + "</div></td><td>" + esc(stName(u.st)) + " · " + esc(u.loc) + "</td>"
            + "<td>" + esc(u.job || "—") + '<div class="sp-sub">' + esc(u.type || "") + "</div></td><td>" + esc(u.opened ? dayLong(String(u.opened).slice(0, 10)) : "—") + "</td>"
            + '<td class="num">' + u.n + '</td><td class="num"><b>' + money2(u.v) + '</b></td><td class="num">' + (open ? money2(num(u.monthly)) : '<span class="sp-dim">closed</span>') + "</td></tr>";
        }).join("")
      + "</tbody></table></div>" + psMore("unit", R.unitList.length, 15)
      + (R.looseList.length ? '<div class="rs-tablewrap" style="margin-top:12px"><table class="rs-table"><thead><tr><th>Charges no unit in the export claims</th><th>Why</th><th class="num">Charges</th><th class="num">Paid</th></tr></thead><tbody>'
          + R.looseList.slice(0, PSV.more.loose ? R.looseList.length : 10).map(function (x) {
              return "<tr><td>" + esc(stName(x.st)) + " · " + esc(x.loc) + "</td><td>" + esc(x.why) + '</td><td class="num">' + x.n + '</td><td class="num"><b>' + money2(x.v) + "</b></td></tr>";
            }).join("")
          + '<tr class="sp-tot"><td colspan="3"><b>Every unit + these = the bank</b>' + (R.looseList.length > 10 && !PSV.more.loose ? '<div class="sp-sub">' + money2(looseTot) + " in " + R.looseList.length + " lines</div>" : "")
          + '</td><td class="num"><b>' + money2(R.tot) + "</b></td></tr></tbody></table></div>" + psMore("loose", R.looseList.length, 10) : "")
      + '<p class="sp-note">Paid = the bank\'s Public Storage charges tied to the unit (first rent, monthly rent, add-ons, refunds). Monthly now = the unit\'s last monthly charge while it is open. Units opened before dispatch\'s export starts have no unit number here — their charges sit in the table above, named.</p></div>';

    // a pill repaints this section alone: the old chart goes first
    if (host._psCh) { try { host._psCh.destroy(); } catch (e) {} host._psCh = null; }
    host.innerHTML = head + '<div class="panel sp-psbar">' + pills + "</div>" + kpis + p1 + p2 + p3 + p4;
    host.querySelectorAll("[data-per]").forEach(function (b) { b.onclick = function () { PSV.per = b.dataset.per; psPaint(host); }; });
    host.querySelectorAll("[data-st]").forEach(function (b) { b.onclick = function () { PSV.st = b.dataset.st; psPaint(host); }; });
    host.querySelectorAll("[data-more]").forEach(function (b) { b.onclick = function () { PSV.more[b.dataset.more] = !PSV.more[b.dataset.more]; psPaint(host); }; });
    try {
      var v2 = RS.isV2 && RS.isV2();
      var pal = v2 ? RS.V2.cat : ["#4a6285", "#84aef0", "#a78bfa", "#2dd4bf", "#fbbf24", "#94a3b8", "#f472b6", "#64748b"];
      var canvas = host.querySelector("#spPsChart");
      host._psCh = new Chart(canvas, {
        type: "bar",
        data: { labels: R.ms.map(ml), datasets: R.shownStates.map(function (s) {
          var i = ST_ORDER.indexOf(s);
          return { label: stName(s), data: R.ms.map(function (m) { return Math.round(num(R.months[m][s]) * 100) / 100; }),
                   backgroundColor: pal[(i < 0 ? 6 : i) % pal.length], stack: "s" };
        }) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" },
            tooltip: { callbacks: { label: function (c) { return c.dataset.label + ": " + money2(c.raw || 0); },
                                    footer: function (it) { return it.length ? "Month: " + money2(R.monthTot[it[0].dataIndex]) : ""; } } } },
          scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: function (v) { return "$" + (v >= 1000 ? Math.round(v / 100) / 10 + "k" : v); } } } } },
      });
    } catch (e) { console.warn("public storage chart:", e); }
  }

  /* ---------------- paint ---------------- */
  function render(el) {
    var c = cfg(), R = compute(c);
    var winLabel = R.win.length ? ml(R.win[0]) + " – " + ml(R.win[R.win.length - 1]) : "";
    var rentLabel = R.rentWin.length ? ml(R.rentWin[0]) + " – " + ml(R.rentWin[R.rentWin.length - 1]) : "";
    var diff = function (a, b) {
      var d = a - b;
      return Math.abs(d) < 1 ? "—" : '<span class="' + (d < 0 ? "sp-good" : "sp-bad") + '">' + (d < 0 ? "▼ " : "▲ ") + moneyK(Math.abs(d)) + "</span>";
    };
    var pct = function (v) { return Math.round(v * 100) + "%"; };
    var html = ''
      + '<div class="rs-kpis" style="--kpi-cols:4">'
      + '<div class="kpi"><div class="l">Most stored at once</div><div class="v">' + cf(R.peakCF) + '</div><div class="s">' + esc(R.peakDay || "") + " · rented units + our vaults</div></div>"
      + '<div class="kpi"><div class="l">Storage spend, last 12 months</div><div class="v">' + moneyK(R.A) + '</div><div class="s">' + esc(rentLabel) + " · units " + moneyK(R.A - R.base) + " + NJ base " + moneyK(R.base) + "</div></div>"
      + '<div class="kpi"><div class="l">What a rented CF costs us</div><div class="v">$' + R.perCFAll.toFixed(2) + '</div><div class="s">per CF per month, NJ + PA + CT, what was actually held</div></div>'
      + '<div class="kpi"><div class="l">Customer storage fees, 12 months</div><div class="v">' + moneyK(R.fees) + '</div><div class="s">contracted · the space earns this</div></div>'
      + "</div>"
      + spendPanel(R)
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Own a facility, or keep renting — by state</span><span class="sp-sub">' + esc(winLabel) + ", per year · switch a state on to price a facility there; sizes and costs are the settings below</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Held in rented units</th><th class="num">Today: units + extra stops</th>'
      + '<th class="num">With a facility</th><th class="num">of it: overflow</th><th class="num">Difference</th><th class="num">Facility fill: avg / peak</th><th class="num">Break-even rent</th></tr></thead><tbody>'
      + ZONES.map(function (z) {
          var o = R.zt[z], f = R.sc[z];
          if (!o) return "";
          return '<tr' + (f.own ? ' class="sp-on"' : "") + '><td><label class="sp-sw"><input type="checkbox" data-own="' + z + '"' + (f.own ? " checked" : "") + "> <b>" + esc(ZONE_NAME[z]) + "</b></label>"
            + '<div class="sp-sub">' + Math.round(num(c["sqft" + z])).toLocaleString() + " sq ft · " + cf(f.cap) + " · " + money(f.fixedMo) + "/month"
            + (num(c["worker" + z]) ? " incl. a worker" : "") + "</div></td>"
            + '<td class="num">' + cf(o.avgRented) + '<div class="sp-sub">' + cf(o.minMonth) + " → " + cf(o.maxMonth) + "</div></td>"
            + '<td class="num">' + money(f.today) + '<div class="sp-sub">units ' + money(f.units) + " ($" + o.perCF.toFixed(2) + "/CF-month) + "
            + money(f.stops) + " for " + f.loads + " loads × 2 stops</div></td>"
            + '<td class="num">' + money(f.withFac) + "</td>"
            + '<td class="num">' + (f.overflow ? money(f.overflow + f.stopsKept) + '<div class="sp-sub">' + f.monthsOver + " month" + (f.monthsOver === 1 ? "" : "s") + " over, stops incl.</div>" : "—") + "</td>"
            + '<td class="num">' + diff(f.withFac, f.today) + "</td>"
            + '<td class="num">' + pct(f.avgFill) + " / " + pct(f.peakFill) + "</td>"
            + '<td class="num">' + (f.breakEven > 0 ? money(f.breakEven) + "/mo" : "never") + "</td></tr>";
        }).join("")
      + '<tr class="sp-tot"><td><b>All states</b><div class="sp-sub">switched-on states with a facility, the rest rented as today; the NJ base, Delaware (Tuji) and unplaced charges as they are</div></td><td></td>'
      + '<td class="num"><b>' + money(R.todayAll) + '</b></td><td class="num"><b>' + money(R.scenario) + "</b></td><td></td>"
      + '<td class="num"><b>' + diff(R.scenario, R.todayAll) + "</b></td><td></td><td></td></tr>"
      + "</tbody></table></div>"
      + '<p class="sp-note"><b>How to read it.</b> "Today" is what that state\'s rented units cost over these months (the bank, after refunds) plus the <b>extra stops</b>: every load into a rented unit is a detour going in and again coming out for delivery, ' + money(R.perStop) + " a stop at the settings below (crew time + truck miles); at our own base the truck just comes home. "
      + '"With a facility" is its rent + worker + other costs every month, plus units still rented in any month the state holds more than the facility fits, at the state\'s own $/CF-month, and those units\' stops. '
      + "<b>Break-even rent</b>: a facility of that size pays off only if its rent is below this (\"never\" = the worker and overflow alone already cost more than renting). "
      + "<b>New Jersey</b>: the main base (FLM Associates, " + money(R.base * R.perYear) + " a year on the bank) holds our vaults, the trucks and the office; dispatch runs storage, so there is no worker. "
      + "It is in the totals and stays as it is — the NJ row is about the units we still rent on top of it.</p></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">How much we hold, zone by zone</span><span class="sp-sub">rented space only — our vaults hold their own</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Zone</th><th class="num">Rented CF, average</th><th class="num">of it long-distance</th><th class="num">Quietest → busiest month</th><th class="num">Peak day</th><th class="num">Rent, 12 months</th><th class="num">$ per CF-month</th></tr></thead><tbody>'
      + ZONES.map(function (z) {
          var o = R.zt[z]; if (!o) return "";
          return "<tr><td><b>" + esc(ZONE_NAME[z]) + "</b></td><td class=\"num\">" + cf(o.avgRented) + "</td><td class=\"num\">" + cf(o.avgLD) + "</td>"
            + '<td class="num">' + cf(o.minMonth) + " → " + cf(o.maxMonth) + "</td>"
            + '<td class="num">' + cf(o.peakRented) + "</td><td class=\"num\">" + money(num(R.rentByZone[z])) + "</td>"
            + '<td class="num">$' + o.perCF.toFixed(2) + "</td></tr>";
        }).join("")
      + "</tbody></table></div></div>"
      + unitsPanel(R)
      + '<div id="spPs"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Month by month — what we held</span></div><div class="chartbox" style="height:300px"><canvas id="spChart"></canvas></div>'
      + '<p class="sp-note">Bars: average CF on hand (our vaults, customers in rented units, long-distance goods in rented units). Line: storage spend that month — rented units, the NJ base and Tuji\'s unit.</p></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Settings</span><span class="sp-sub">kept in this browser</span><span class="spacer"></span><button class="btn" id="spReset">Back to the defaults</button></div>'
      + '<div class="sp-fields">' + Object.keys(DEF).filter(function (k) { return LABEL[k]; }).map(function (k) {
          return '<label class="sp-f"><span>' + esc(LABEL[k]) + '</span><input data-k="' + k + '" type="number" step="any" value="' + esc(String(c[k])) + '"></label>';
        }).join("") + "</div>"
      + '<p class="sp-note"><b>Where the defaults come from.</b> A 2,000 sq ft space at about $18 per sq ft a year all-in (central NJ industrial asking ~$16, Colliers Q2 2026, plus taxes, insurance and the small-space premium) is $3,000 a month; vaults stacked 3 high hold ~11 CF per sq ft. A worker is one person, 40 hours a week at $20 (this year\'s crew pay). Power, insurance and the rest start at 0 — add yours. An extra stop is a best guess — nobody can measure it: rented units sit a median 16–23 road miles from their base, so ~15 extra miles plus getting into a unit with no dock, about 45 minutes for a crew of 3 at ~$20/h; truck $1.11/mile is the portal\'s fuel + tolls figure. Rent data runs to the end of the bank sheet.</p></div>';
    el.innerHTML = '<div class="sp">' + html + "</div>";
    psPaint(el.querySelector("#spPs"));
    el.querySelectorAll("input[data-own]").forEach(function (inp) {
      inp.onchange = function () { var o = cfg(); o["own" + inp.dataset.own] = inp.checked ? 1 : 0; saveCfg(o); render(el); };
    });
    el.querySelectorAll("input[data-k]").forEach(function (inp) {
      inp.onchange = function () {
        var o = cfg(); o[inp.dataset.k] = inp.type === "number" ? (inp.value === "" ? "" : +inp.value) : inp.value;
        saveCfg(o); render(el);
      };
    });
    el.querySelector("#spReset").onclick = function () { try { localStorage.removeItem(LS); } catch (e) {} render(el); };
    // the chart
    try {
      var months = R.win;
      var v2 = RS.isV2 && RS.isV2();
      var sum = function (m, k) { return ZONES.concat(["DE", "Unmapped"]).reduce(function (a, z) { return a + R.get(m, z)[k]; }, 0) / R.dim(m); };
      var canvas = el.querySelector("#spChart");
      if (canvas._ch) canvas._ch.destroy();
      canvas._ch = new Chart(canvas, {
        data: { labels: months.map(ml), datasets: [
          { type: "bar", label: "Our vaults", data: months.map(function (m) { return Math.round(sum(m, "our")); }), backgroundColor: v2 ? RS.V2.navy : "#4a6285", stack: "s", yAxisID: "y" },
          { type: "bar", label: "Customers in rented units", data: months.map(function (m) { return Math.round(sum(m, "rent")); }), backgroundColor: v2 ? RS.V2.accentL : "#84aef0", stack: "s", yAxisID: "y" },
          { type: "bar", label: "Long-distance in rented units", data: months.map(function (m) { return Math.round(sum(m, "ld")); }), backgroundColor: v2 ? RS.V2.cat[4] : "#a78bfa", stack: "s", yAxisID: "y" },
          { type: "line", label: "Storage spend $", data: months.map(function (m) { return R.rentByMonth[m] != null ? Math.round(R.rentByMonth[m]) : null; }), borderColor: v2 ? RS.V2.warn : "#fbbf24", backgroundColor: "transparent", yAxisID: "y2", tension: 0.2, spanGaps: false },
        ] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } },
          scales: { y: { stacked: true, ticks: { callback: function (v) { return Math.round(v / 1000) + "k CF"; } } },
                    y2: { position: "right", grid: { display: false }, ticks: { callback: function (v) { return "$" + Math.round(v / 1000) + "k"; } } } } },
      });
    } catch (e) { console.warn("storage chart:", e); }
  }

  function injectCss() {
    if (document.getElementById("sp-css")) return;
    var s = document.createElement("style"); s.id = "sp-css";
    s.textContent = ".sp-sub{font-size:12.5px;color:var(--faint);font-weight:400}"
      + ".sp-note{font-size:12.5px;color:var(--muted);line-height:1.55;margin:10px 0 0;max-width:120ch}"
      + ".sp tr.sp-on td{background:var(--panel2,#F8FAFC)}"
      + ".sp tr.sp-tot td{border-top:2px solid var(--line-2)}"
      + ".sp td.sp-last,.sp th.sp-last{background:var(--panel2,#F8FAFC)}"
      + ".sp-good{color:var(--pos);font-weight:600}.sp-bad{color:var(--neg);font-weight:600}"
      + ".sp-sw{display:inline-flex;align-items:center;gap:6px;cursor:pointer}"
      + ".sp tr.sp-unitz td{background:var(--panel2,#F8FAFC);border-top:1px solid var(--line-2)}"
      + ".sp-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}"
      + ".sp-f{display:flex;flex-direction:column;gap:5px}.sp-f span{font-size:12.5px;color:var(--muted)}"
      + ".sp-f input{font:inherit;font-size:14px;border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;background:var(--panel);color:var(--ink)}"
      // What Public Storage cost us (2026-10-20)
      + ".sp-ps-h{margin:26px 0 10px}.sp-ps-h h2{font-size:18px;font-weight:700;margin:0 0 4px;color:var(--ink)}"
      + ".sp-ps-h p{margin:0;font-size:13px;color:var(--muted);max-width:110ch}"
      + ".sp .sp-psbar{display:flex;flex-wrap:wrap;gap:10px 22px;align-items:center}"
      + ".sp .sp-pills{display:flex;flex-wrap:wrap;gap:6px}"
      + ".sp .sp-pill{font:inherit;font-size:12.5px;font-weight:600;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);"
      + "border-radius:999px;padding:5px 12px;cursor:pointer;line-height:1.2}"
      + ".sp .sp-pill:hover{border-color:var(--ink);color:var(--ink)}"
      + ".sp .sp-pill.on{background:var(--ink);border-color:var(--ink);color:var(--panel)}"
      + ".sp .sp-dim{color:var(--faint)}.sp .sp-more{margin-top:10px}"
      + ".sp .sp-psgrid td,.sp .sp-psgrid th{white-space:nowrap}";
    document.head.appendChild(s);
  }

  window.AP_STORAGE = {
    mount: function (el) {
      if (!el) return;
      injectCss();
      if (ST.rows) { render(el); return; }
      el.innerHTML = '<div class="rs-loading"><div>Loading <b>storage</b>…</div><div class="bar"><i></i></div></div>';
      load().then(function () {
        if (!el.isConnected) return;
        if (ST.err) { el.innerHTML = '<div class="panel">Could not load the storage data — ' + esc(ST.err) + "</div>"; return; }
        render(el);
      });
    },
  };
})();
