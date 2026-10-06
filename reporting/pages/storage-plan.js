/* Storage planning -- the STORAGE tab of Seasonal Planning (his ask, 2026-10-06).

   "We have a lot of storage rentings this year because of regular moves ... how to properly have
   storage set up -- where to rent if we need to rent and how big it should be -- to cut the costs.
   Maybe it's better to have 1 huge storage in CT?"

   Facts: mart_storage_plan (src/storage_plan.py) -- CF held per zone per day (customers in our
   warehouse, customers in rented units, long-distance goods in rented units), self-storage rent per
   zone per month, loads into storage per zone, and long-distance pickup miles to each candidate hub.
   Names nothing. Everything below the facts is arithmetic on inputs that live in THIS browser
   (localStorage), seeded with the October 2026 market check: large-unit web prices per area,
   warehouse lease rates, our truck cost per mile and crew pay.

   Scenarios (his picks: both customer and long-distance storage, kept apart; market prices
   researched; haul at our real costs; scenario E included):
     A  as today -- what the rent actually cost over the last 12 months
     B  one hub -- every rented CF in one place (CT by default), plus the extra haul from the
        other zones, priced at our truck $/mile and crew $/hour
     C  one zone per base (NJ / Philadelphia / CT): large units sized month by month to the CF
        each zone held, plus a margin
     D  C, but NJ's rented space replaced by a leased warehouse
     E  C with a share of long-distance jobs given a carrier at pickup, so they never sit

   Mounted by area-plan.js into #apStorage on every paint; it keeps its own state on window and
   re-renders from cache, so a repaint of the page costs nothing. */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.storage_plan) {
    RS.DATASETS.storage_plan = {
      table: "mart_storage_plan",
      cols: ["Kind", "Day", "Month", "Zone", "Customer Our CF", "Customer Rented CF", "LD CF", "Customer Fees",
             "Rent USD", "Facilities", "Jobs", "Miles NJ", "Miles PA", "Miles CT", "Miles CT2", "Lat", "Lng"],
      dateCols: {}, defaultDate: null,
    };
  }
  var LS = "ztzStoragePlan.v1";
  /* the October 2026 market check (web prices, Public Storage 10x30 online; Colliers / Matthews /
     LPC industrial reports and listings) and the portal's own truck and crew figures */
  var DEF = {
    unitCF: 1800, slack: 15,
    priceNJ: 290, pricePA: 285, priceCT: 286, priceDE: 294,
    ourCapacity: 16500,
    milePrice: 1.11, crewRate: 25, crewSize: 2, mph: 40,
    hubB: "CT",
    whRate: 18, whDensity: 11, whMinSqft: 2500,
    ldDirect: 50,
  };
  var LABEL = {
    unitCF: "Usable CF in one large unit (10x30)", slack: "Margin over the CF needed (%)",
    priceNJ: "NJ: large unit $/month", pricePA: "PA: large unit $/month", priceCT: "CT: large unit $/month", priceDE: "DE: large unit $/month",
    ourCapacity: "Our warehouse capacity (CF)",
    milePrice: "Truck $ per mile", crewRate: "Crew $ per hour", crewSize: "People per haul", mph: "Average mph on a haul",
    hubB: "B: where the one hub would be (NJ / PA / CT)",
    whRate: "D: NJ warehouse $/sq ft/year, all-in", whDensity: "D: CF stored per sq ft (vaults)", whMinSqft: "D: smallest space you can lease (sq ft)",
    ldDirect: "E: long-distance jobs given a carrier at pickup (%)",
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

  var ST = window.__spState = window.__spState || { rows: null, err: null, loading: null };

  function load() {
    if (ST.rows || ST.loading) return ST.loading;
    ST.loading = RS.load("storage_plan").then(function (r) { ST.rows = (r && (r.rows || r)) || []; })
      .catch(function (e) { ST.err = e.message || String(e); });
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
    var entries = {}; rows.filter(function (r) { return r.Kind === "entries"; }).forEach(function (r) { entries[r.Zone] = num(r.Jobs); });
    var pick = {}; rows.filter(function (r) { return r.Kind === "pickup"; }).forEach(function (r) { pick[r.Zone] = r; });

    var price = { NJ: num(c.priceNJ), PA: num(c.pricePA), CT: num(c.priceCT) };
    var units = function (need) { return need > 0 ? Math.ceil(need * (1 + num(c.slack) / 100) / Math.max(1, num(c.unitCF))) : 0; };
    var get = function (m, z) { return M[m + "|" + z] || { our: 0, rent: 0, ld: 0, days: {}, peakRented: 0, peakAll: 0, fees: 0 }; };

    // zone table + scenario C / E
    var zt = {}, costC = 0, costE = 0, fees = 0;
    ZONES.forEach(function (z) {
      var o = { avgRented: 0, peakRented: 0, avgOur: 0, unitsMin: Infinity, unitsMax: 0, cost: 0, costE: 0, avgLD: 0 };
      win.forEach(function (m) {
        var g = get(m, z), n = dim(m);
        o.avgRented += (g.rent + g.ld) / n / win.length;
        o.avgLD += g.ld / n / win.length;
        o.avgOur += g.our / n / win.length;
        o.peakRented = Math.max(o.peakRented, g.peakRented);
        var u = units(g.peakRented); o.unitsMin = Math.min(o.unitsMin, u); o.unitsMax = Math.max(o.unitsMax, u);
        o.cost += u * price[z];
        // E: the long-distance share that never sits. The month's peak scales with its LD share.
        var share = (g.rent + g.ld) ? g.ld / (g.rent + g.ld) : 0;
        o.costE += units(g.peakRented * (1 - share * num(c.ldDirect) / 100)) * price[z];
        fees += g.fees;
      });
      if (o.unitsMin === Infinity) o.unitsMin = 0;
      zt[z] = o; costC += o.cost; costE += o.costE;
    });
    // DE and anything unmapped stay as they are in every scenario: Tuji's own unit
    var asIs = num(rentByZone.DE) + num(rentByZone.Unmapped);

    // B: one hub
    var H = String(c.hubB || "CT").toUpperCase(); if (ZONES.indexOf(H) < 0) H = "CT";
    var costBUnits = 0;
    win.forEach(function (m) {
      var peak = 0; ZONES.forEach(function (z) { peak += get(m, z).peakRented; });
      costBUnits += units(peak) * price[H];
    });
    var hubCol = { NJ: "Miles NJ", PA: "Miles PA", CT: "Miles CT2" };
    var haul = 0, haulRows = [];
    ZONES.forEach(function (z) {
      if (z === H) return;
      var p = pick[z]; if (!p) return;
      var extra = Math.max(0, num(p[hubCol[H]]) - num(p[hubCol[z]]));
      var trip = 2 * extra;                                    // there and back
      var perLoad = trip * num(c.milePrice) + trip / Math.max(1, num(c.mph)) * num(c.crewRate) * num(c.crewSize);
      var n = num(entries[z]);
      haul += perLoad * n;
      haulRows.push({ z: z, extra: extra, perLoad: perLoad, n: n });
    });
    var costB = costBUnits + haul;

    // D: NJ in a leased warehouse, PA and CT as C
    var njPeak = zt.NJ ? zt.NJ.peakRented : 0;
    var sqft = Math.max(num(c.whMinSqft), Math.ceil(njPeak * (1 + num(c.slack) / 100) / Math.max(1, num(c.whDensity))));
    var costD = sqft * num(c.whRate) + (zt.PA ? zt.PA.cost : 0) + (zt.CT ? zt.CT.cost : 0);

    var A = rentTot;
    return {
      win: win, rentWin: rentWin, M: M, get: get, dim: dim, peakDay: peakDay, peakCF: peakCF, rentByMonth: rentByMonth,
      rentByZone: rentByZone, A: A, asIs: asIs, zt: zt, fees: fees, entries: entries, pick: pick,
      B: costB + asIs, Bunits: costBUnits, haul: haul, haulRows: haulRows, H: H,
      C: costC + asIs, D: costD + asIs, sqft: sqft, E: costE + asIs,
    };
  }

  /* ---------------- paint ---------------- */
  function render(el) {
    var c = cfg(), R = compute(c);
    var avgRentedAll = ZONES.reduce(function (a, z) { return a + (R.zt[z] ? R.zt[z].avgRented : 0); }, 0);
    var eff = avgRentedAll ? (R.A - R.asIs) / 12 / avgRentedAll : 0;
    var row = function (k, name, cost, note, best) {
      var d = cost - R.A;
      return '<tr' + (best ? ' class="sp-best"' : "") + "><td><b>" + k + "</b> " + esc(name) + '<div class="sp-sub">' + note + "</div></td>"
        + '<td class="num">' + money(cost) + "</td>"
        + '<td class="num">' + (k === "A" ? "—" : (d < 0 ? "▼ " : "▲ ") + moneyK(Math.abs(d)) + " · " + Math.abs(R.A ? d / R.A * 100 : 0).toFixed(0) + "%") + "</td></tr>";
    };
    var best = Math.min(R.B, R.C, R.D, R.E);
    var winLabel = R.win.length ? ml(R.win[0]) + " – " + ml(R.win[R.win.length - 1]) : "";
    var rentLabel = R.rentWin.length ? ml(R.rentWin[0]) + " – " + ml(R.rentWin[R.rentWin.length - 1]) : "";
    var html = ''
      + '<div class="rs-kpis" style="--kpi-cols:4">'
      + '<div class="kpi"><div class="l">Most stored at once</div><div class="v">' + cf(R.peakCF) + '</div><div class="s">' + esc(R.peakDay || "") + " · our warehouse holds ~" + cf(num(c.ourCapacity)) + "</div></div>"
      + '<div class="kpi"><div class="l">Self-storage rent, last 12 months</div><div class="v">' + moneyK(R.A) + '</div><div class="s">' + esc(rentLabel) + "</div></div>"
      + '<div class="kpi"><div class="l">What a stored CF costs us</div><div class="v">$' + eff.toFixed(2) + '</div><div class="s">per CF per month · large units cost ~$' + (num(c.priceNJ) / num(c.unitCF)).toFixed(2) + "</div></div>"
      + '<div class="kpi"><div class="l">Customer storage fees, 12 months</div><div class="v">' + moneyK(R.fees) + '</div><div class="s">contracted · the space earns this</div></div>'
      + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">The options, per year</span><span class="sp-sub">' + esc(winLabel) + " sized month by month · prices are this browser's settings below</span></div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Setup</th><th class="num">Per year</th><th class="num">Against today</th></tr></thead><tbody>'
      + row("A", "As today", R.A, "what the self-storage charges actually cost (" + esc(rentLabel) + "), scattered over many sites", false)
      + row("B", "One hub in " + R.H, R.B, money(R.Bunits) + " of units for everything in one place, plus <b>" + money(R.haul) + "</b> of extra hauling from the other zones (" + R.haulRows.map(function (h) { return h.n + " loads from " + h.z + " × " + Math.round(h.extra) + " extra mi"; }).join(", ") + ")", R.B === best)
      + row("C", "One zone per base — NJ / Philadelphia / CT", R.C, "large units near each base, as many as each month's peak needs plus " + num(c.slack) + "%; filled before a new one is rented", R.C === best)
      + row("D", "C, with NJ in a leased warehouse", R.D, Math.round(R.sqft).toLocaleString() + " sq ft × $" + num(c.whRate) + "/sq ft/yr for NJ (3-high vaults need a tall ceiling); PA and CT as C", R.D === best)
      + row("E", "C, and " + num(c.ldDirect) + "% of long-distance jobs get a carrier at pickup", R.E, "those goods never sit; the rest as C", R.E === best)
      + "</tbody></table></div>"
      + '<p class="sp-note">Every option keeps Tuji\'s Delaware unit and any unplaced charge as they are (' + money(R.asIs) + " a year). Hauling is the extra distance from a zone's long-distance pickups to the hub instead of their own base area, there and back, at " + "$" + num(c.milePrice) + "/mile and " + num(c.crewSize) + " people at $" + num(c.crewRate) + "/h.</p></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">How big, zone by zone</span><span class="sp-sub">rented space only — our warehouse holds its own</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Zone</th><th class="num">Rented CF, average</th><th class="num">of it long-distance</th><th class="num">Peak day</th><th class="num">Large units: quiet month → peak</th><th class="num">C: per year</th><th class="num">Today: rent 12 months</th></tr></thead><tbody>'
      + ZONES.map(function (z) {
          var o = R.zt[z]; if (!o) return "";
          return "<tr><td><b>" + esc(ZONE_NAME[z]) + "</b></td><td class=\"num\">" + cf(o.avgRented) + "</td><td class=\"num\">" + cf(o.avgLD) + "</td>"
            + '<td class="num">' + cf(o.peakRented) + "</td><td class=\"num\">" + o.unitsMin + " → " + o.unitsMax + "</td>"
            + '<td class="num">' + money(o.cost) + "</td><td class=\"num\">" + money(num(R.rentByZone[z])) + "</td></tr>";
        }).join("")
      + "</tbody></table></div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Month by month — what we held</span></div><div class="chartbox" style="height:300px"><canvas id="spChart"></canvas></div>'
      + '<p class="sp-note">Bars: average CF on hand (our warehouse, customers in rented units, long-distance goods in rented units). Line: self-storage rent that month.</p></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">How far a hub is</span><span class="sp-sub">average miles from each zone\'s long-distance pickups (last 12 months), straight line × 1.25</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Pickups in</th><th class="num">Pickups</th><th class="num">Loads into storage</th><th class="num">to Tinton Falls NJ</th><th class="num">to NE Philadelphia</th><th class="num">to Bridgeport CT</th><th class="num">to Meriden CT</th></tr></thead><tbody>'
      + ["NJ", "PA", "CT", "DE"].map(function (z) {
          var p = R.pick[z]; if (!p) return "";
          var m = function (v) { return v == null ? "—" : Math.round(v) + " mi"; };
          return "<tr><td><b>" + z + "</b></td><td class=\"num\">" + num(p.Jobs) + "</td><td class=\"num\">" + num(R.entries[z]) + "</td><td class=\"num\">" + m(p["Miles NJ"]) + "</td><td class=\"num\">" + m(p["Miles PA"]) + "</td><td class=\"num\">" + m(p["Miles CT2"]) + "</td><td class=\"num\">" + m(p["Miles CT"]) + "</td></tr>";
        }).join("")
      + "</tbody></table></div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Settings</span><span class="sp-sub">kept in this browser · seeded with the October 2026 market check</span><span class="spacer"></span><button class="btn" id="spReset">Back to the defaults</button></div>'
      + '<div class="sp-fields">' + Object.keys(DEF).map(function (k) {
          return '<label class="sp-f"><span>' + esc(LABEL[k]) + '</span><input data-k="' + k + '" type="' + (k === "hubB" ? "text" : "number") + '" step="any" value="' + esc(String(c[k])) + '"></label>';
        }).join("") + "</div>"
      + '<p class="sp-note"><b>Where the defaults come from.</b> Large units: Public Storage 10x30 web prices in each area, Oct 2026 ($252–308 around Tinton Falls, $268–285 NE Philadelphia, ~$286 Meriden, ~$294 New Castle); ~1,800 of a 10x30\'s 2,400 CF is usable when packed. Warehouse: central NJ industrial asking rent ~$16/sq ft/yr (Colliers Q2 2026) plus taxes, insurance and the small-space premium ≈ $18 all-in; vaults stacked 3 high hold ~11 CF per sq ft. Truck $1.11/mile is the portal\'s fuel + tolls figure; crew $25/h is this year\'s average pay. Long-distance CF is known for few board rows — a missing one counts 450 CF; rent data runs to the end of the bank sheet.</p></div>';
    el.innerHTML = '<div class="sp">' + html + "</div>";
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
          { type: "bar", label: "Our warehouse", data: months.map(function (m) { return Math.round(sum(m, "our")); }), backgroundColor: v2 ? RS.V2.navy : "#4a6285", stack: "s", yAxisID: "y" },
          { type: "bar", label: "Customers in rented units", data: months.map(function (m) { return Math.round(sum(m, "rent")); }), backgroundColor: v2 ? RS.V2.accentL : "#84aef0", stack: "s", yAxisID: "y" },
          { type: "bar", label: "Long-distance in rented units", data: months.map(function (m) { return Math.round(sum(m, "ld")); }), backgroundColor: v2 ? RS.V2.cat[4] : "#a78bfa", stack: "s", yAxisID: "y" },
          { type: "line", label: "Rent $", data: months.map(function (m) { return R.rentByMonth[m] != null ? Math.round(R.rentByMonth[m]) : null; }), borderColor: v2 ? RS.V2.warn : "#fbbf24", backgroundColor: "transparent", yAxisID: "y2", tension: 0.2, spanGaps: false },
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
      + ".sp tr.sp-best td{background:var(--pos-bg)}"
      + ".sp-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}"
      + ".sp-f{display:flex;flex-direction:column;gap:5px}.sp-f span{font-size:12.5px;color:var(--muted)}"
      + ".sp-f input{font:inherit;font-size:14px;border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;background:var(--panel);color:var(--ink)}";
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
