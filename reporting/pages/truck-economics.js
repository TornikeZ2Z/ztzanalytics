/* TRUCK ECONOMICS — rental vs owned, the question behind the Area Plan.
 *
 * His 2026-08-28 framing: "the whole idea of that is actually rental vs owned truck
 * analysis". His old Google Sheet ("Owning vs Renting Analysis", 2024, Ryder+U-Haul) was
 * the demo of the model — daily truck-days from closings, own-vs-rent per day, a cost
 * stack, a jobs/day line where rentals start. This is that model in the warehouse, with
 * the three things the demo could not do: EVERY vendor (Enterprise is the biggest one now
 * and the sheet never had it), the real per-truck register behind owned cost, and the
 * counterfactual the demo left at $0 — the MARGINAL Nth truck.
 *
 * THE ONE ANSWER: how many trucks should we own? A truck we own works the days demand
 * reaches it; every day beyond the fleet is rented. So truck N earns the rental cost of
 * the days demand >= N, and costs its own year. Where those cross is the fleet size.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.truck_day) {
      RS.DATASETS.truck_day = {
        table: "mart_truck_day",
        cols: ["Day", "ym", "Jobs", "Owned Jobs", "Rental Jobs", "Other Jobs",
               "No Truck Jobs", "Owned Used", "Rental Floor", "Revenue",
               "Rental Revenue"],
      };
    }
    if (!RS.DATASETS.truck_cost) {
      RS.DATASETS.truck_cost = {
        table: "mart_truck_cost",
        cols: ["ym", "Fleet Size", "Insurance", "Parking", "Maintenance", "Financing",
               "Fuel Card", "Fuel WEX", "Rental Ryder", "Rental Penske",
               "Rental Enterprise", "Rental U-Haul", "Rental Other"],
      };
    }
    if (!RS.DATASETS.truck_unit) {
      RS.DATASETS.truck_unit = {
        table: "mart_truck_unit",
        cols: ["ym", "Unit", "Ownership", "Days Worked", "Jobs", "Revenue"],
      };
    }
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("tec-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "tec-style";
    st.textContent = `
    /* the shared kit (assets/rs.css) carries cards, KPI tiles, bars, tables, pills and
       segments. Only what the kit has no word for lives here. */
    .tec-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
      color:var(--muted);margin-bottom:3px}
    .tec-eyebrow + .panel-title{margin-bottom:5px}
    .tec-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:92ch}
    .tec-good{color:var(--pos)} .tec-bad{color:var(--neg)} .tec-warn{color:var(--warn)}
    .rs-kpis .kpi .v.tec-good{color:var(--pos)}
    .rs-kpis .kpi .v.tec-bad{color:var(--neg)}
    .rs-kpis .kpi .v.tec-warn{color:var(--warn)}
    /* the verdict banner — the page's whole point in one sentence */
    .tec-verdict{background:color-mix(in srgb,var(--brand-d) 8%,transparent);
      border:1px solid color-mix(in srgb,var(--brand-d) 32%,transparent);
      border-left:5px solid var(--brand);border-radius:13px;padding:16px 19px;margin:2px 0 16px}
    .tec-verdict b{font-size:16px;letter-spacing:-.2px}
    .tec-verdict .sub{font-size:13px;color:var(--muted);line-height:1.65;margin-top:6px}
    /* the demand histogram: one bar per trucks-needed level */
    .tec-hist{display:flex;align-items:flex-end;gap:3px;height:150px;margin:10px 0 4px}
    .tec-hist .b{flex:1 1 0;min-width:6px;background:var(--brand);border-radius:3px 3px 0 0;
      position:relative;transition:background .12s}
    .tec-hist .b.over{background:var(--neg)}
    .tec-hist .b:hover{filter:brightness(1.15)}
    .tec-hlab{display:flex;gap:3px;font-size:10px;color:var(--faint);
      font-variant-numeric:tabular-nums}
    .tec-hlab span{flex:1 1 0;min-width:6px;text-align:center}
    .tec-vendors{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 2px}
    .tec-vend{border:1px solid var(--line);border-radius:11px;padding:9px 13px;background:var(--panel)}
    .tec-vend .n{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
      color:var(--muted)}
    .tec-vend .v{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:2px}
    .tec-vend .s{font-size:11.5px;color:var(--faint);margin-top:1px}
    .tec-fields{display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end;margin:4px 0 14px}
    .tec-fields .l{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
      color:var(--muted);margin-bottom:5px}
    .tec-fields .h{font-size:11.5px;color:var(--faint);margin-top:4px;max-width:230px;line-height:1.45}
    `;
    document.head.appendChild(st);
  }

  const MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
                  "Oct", "Nov", "Dec"];
  const ymLabel = ym => MONTHS[+String(ym).slice(5, 7)] + " " + String(ym).slice(0, 4);
  // HIS PRICED CANDIDATE (docs/research/2026-09-area-research.md): 2019 Freightliner M2,
  // Penske North Bergen, spec'd under 26,000 lbs GVWR so NJ needs $300k liability, not
  // $1.5M. Editable on the page — this is the seed, not a law.
  const BUY = { price: 43750, ins: 15000, park: 2400, maint: 6000 };
  const LS_KEY = "ztzTruckEcon.v1";

  registerPage({
    id: "truck-economics",
    group: "different",
    title: "Truck Economics",
    subtitle: "Owning versus renting: what a truck-day costs each way, how often demand " +
              "pushes us past the fleet, and how many trucks we should own.",
    datasets: [],

    render: function (host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const money = v => (v == null || isNaN(v)) ? "—" : RS.money(Math.round(+v));
      const money1 = v => (v == null || isNaN(v)) ? "—"
        : "$" + (Math.round(+v)).toLocaleString();
      const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
      const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);
      const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";

      injectStyle();
      host.innerHTML = '<div class="panel">Loading…</div>';

      let S = { from: null, to: null, buy: Object.assign({}, BUY) };
      try {
        const saved = JSON.parse(localStorage.getItem(LS_KEY) || "null");
        if (saved && saved.buy) S.buy = Object.assign({}, BUY, saved.buy);
      } catch (e) { /* a blocked store must never break the page */ }
      const save = () => {
        try { localStorage.setItem(LS_KEY, JSON.stringify({ buy: S.buy })); }
        catch (e) { /* ignore */ }
      };

      return Promise.all([
        RS.load("truck_day"), RS.load("truck_cost"), RS.load("truck_unit"),
      ]).then(([days, costs, units]) => {
        if (!days.length || !costs.length) {
          host.innerHTML = '<div class="panel">The truck marts have not been built yet — '
            + "they arrive with the next pipeline run.</div>";
          return;
        }
        const num = v => (v == null || v === "") ? 0 : +v;
        days.forEach(d => { d._ym = String(d.ym); });
        const allYms = Array.from(new Set(days.map(d => d._ym))).sort();
        // default period: the last 12 months that carry jobs
        S.from = S.from || allYms[Math.max(0, allYms.length - 12)];
        S.to = S.to || allYms[allYms.length - 1];

        function inRange(ym) { return ym >= S.from && ym <= S.to; }

        function compute() {
          const D = days.filter(d => inRange(d._ym));
          const C = costs.filter(c => inRange(String(c.ym)));
          const U = units.filter(u => inRange(String(u.ym)));
          const months = Math.max(1, new Set(D.map(d => d._ym)).size);

          // ---- rental spend by vendor, and rental truck-days by vendor share ----
          const rent = {
            Enterprise: 0, Ryder: 0, Penske: 0, "U-Haul": 0, Other: 0,
          };
          let ins = 0, park = 0, maint = 0, fin = 0, fuel = 0, fleetSum = 0;
          C.forEach(c => {
            rent.Enterprise += num(c["Rental Enterprise"]);
            rent.Ryder += num(c["Rental Ryder"]);
            rent.Penske += num(c["Rental Penske"]);
            rent["U-Haul"] += num(c["Rental U-Haul"]);
            rent.Other += num(c["Rental Other"]);
            ins += num(c.Insurance); park += num(c.Parking);
            maint += num(c.Maintenance); fin += num(c.Financing);
            // FUEL: the WEX feed is the truck-level one; the card's Fuel category is the
            // same money seen from the bank side for older months. Take the larger so a
            // month with only one of the two is not undercounted, never both.
            fuel += Math.max(num(c["Fuel WEX"]), num(c["Fuel Card"]));
            fleetSum += num(c["Fleet Size"]);
          });
          const rentTotal = Object.keys(rent).reduce((a, k) => a + rent[k], 0);
          const fleet = fleetSum / Math.max(1, C.length);

          // ---- truck-days ----
          let ownedDays = 0, rentalDays = 0, jobs = 0, ownedJobs = 0, rentalJobs = 0;
          D.forEach(d => {
            ownedDays += num(d["Owned Used"]);
            rentalDays += num(d["Rental Floor"]);
            jobs += num(d.Jobs);
            ownedJobs += num(d["Owned Jobs"]);
            rentalJobs += num(d["Rental Jobs"]);
          });
          // A rental LABEL covers however many trucks that vendor sent that day, so the
          // day count is a floor. The honest unit is the JOB: rental jobs / the jobs an
          // owned truck does in a day says how many truck-days those jobs really took.
          const jobsPerOwnedDay = ownedDays ? ownedJobs / ownedDays : 0;
          const rentalDaysEq = jobsPerOwnedDay ? rentalJobs / jobsPerOwnedDay : rentalDays;
          const rentPerDay = rentalDaysEq ? rentTotal / rentalDaysEq : 0;

          // ---- owned cost per truck-day ----
          const ownedTotal = ins + park + maint + fin + fuel;
          const ownPerTruckYear = fleet ? (ownedTotal / months * 12) / fleet : 0;
          const ownPerDay = ownedDays ? ownedTotal / ownedDays : 0;

          // ---- the demand curve: how many days needed at least N trucks ----
          const need = D.map(d => num(d["Owned Used"]) + num(d["Rental Floor"]));
          const maxNeed = Math.max(0, ...need);
          const hist = [];
          for (let n = 1; n <= maxNeed; n++) {
            hist.push({ n, days: need.filter(x => x >= n).length });
          }
          // ---- the marginal truck table ----
          // Truck N works the days demand reaches N. Its value is the rental it displaces
          // on those days; its cost is what a truck costs to own for the period.
          const ownCostPeriod = ownPerTruckYear * (months / 12);
          const marg = hist.map(h => {
            const displaced = h.days * rentPerDay;
            return { n: h.n, days: h.days, displaced,
                     cost: ownCostPeriod, net: displaced - ownCostPeriod };
          });
          let best = 0;
          marg.forEach(m => { if (m.net > 0) best = m.n; });

          // ---- his priced buy case ----
          const b = S.buy;
          const buyYear = b.ins + b.park + b.maint;          // running cost, no financing
          const nextTruck = marg.find(m => m.n === Math.round(fleet) + 1)
            || marg[marg.length - 1] || { days: 0, displaced: 0 };
          const buyDisplacedYear = (nextTruck.displaced / months) * 12;
          const buyNet = buyDisplacedYear - buyYear;
          const paybackMonths = buyNet > 0 ? (b.price / (buyNet / 12)) : null;

          return { D, C, U, months, rent, rentTotal, ins, park, maint, fin, fuel, fleet,
                   ownedDays, rentalDays, rentalDaysEq, jobs, ownedJobs, rentalJobs,
                   jobsPerOwnedDay, rentPerDay, ownedTotal, ownPerTruckYear, ownPerDay,
                   hist, maxNeed, marg, best, buyYear, buyDisplacedYear, buyNet,
                   paybackMonths, nextTruck };
        }

        function paint() {
          const M = compute();
          const ratio = M.ownPerDay ? M.rentPerDay / M.ownPerDay : 0;
          const rentShare = M.jobs ? M.rentalJobs / M.jobs : 0;
          const vendors = Object.keys(M.rent)
            .filter(k => M.rent[k] > 0)
            .sort((a, b2) => M.rent[b2] - M.rent[a]);

          const histMax = Math.max(1, ...M.hist.map(h => h.days));
          const fleetR = Math.round(M.fleet);

          host.innerHTML = `
            <div class="rs-page-head">
              <h1>Truck Economics</h1>
              <p>Owning versus renting, measured on our own closings and our own card
                 spend. Every job names the truck that did it — a fleet number or a rental
                 company — so a truck-day is a fact here, not an estimate.</p>
            </div>

            <div class="rs-bar">
              <div class="rs-fld"><span>Period</span></div>
              <span id="tecFrom"></span><span id="tecTo"></span>
              <span class="rs-spacer"></span>
              <span class="rs-hint">${M.months} month${M.months === 1 ? "" : "s"} ·
                ${fmtN(M.jobs)} jobs</span>
            </div>

            <div class="tec-verdict">
              <b>${M.best > fleetR
                    ? `Own more: the numbers support about ${M.best} trucks, and the fleet
                       averaged ${n1(M.fleet)}.`
                    : M.best === fleetR
                      ? `The fleet is about right: ${fleetR} trucks, and truck ${M.best}
                         still pays for itself.`
                      : `Own fewer: only ${M.best} trucks earn their keep, and the fleet
                         averaged ${n1(M.fleet)}.`}</b>
              <div class="sub">
                A rented truck-day costs <b>${money1(M.rentPerDay)}</b> against
                <b>${money1(M.ownPerDay)}</b> for one we own — ${n1(ratio)}× —
                and demand pushed past the fleet on
                <b>${fmtN(M.hist.filter(h => h.n > fleetR).reduce((a, h) => a + h.days, 0)
                          ? M.D.filter(d => (+d["Owned Used"] + +d["Rental Floor"]) > fleetR).length
                          : 0)}</b> of ${fmtN(M.D.length)} working days.
                Rentals carried ${pct(rentShare)} of jobs and cost
                <b>${money(M.rentTotal)}</b> over this period.
              </div>
            </div>

            <div class="rs-kpis">
              <div class="kpi"><span class="k">Cost of a rented truck-day</span>
                <span class="v tec-bad">${money1(M.rentPerDay)}</span>
                <span class="s">${fmtN(M.rentalDaysEq)} rental truck-days ·
                  ${money(M.rentTotal)}</span></div>
              <div class="kpi"><span class="k">Cost of an owned truck-day</span>
                <span class="v tec-good">${money1(M.ownPerDay)}</span>
                <span class="s">${fmtN(M.ownedDays)} owned truck-days ·
                  ${money(M.ownedTotal)} all-in</span></div>
              <div class="kpi"><span class="k">One owned truck, per year</span>
                <span class="v">${money(M.ownPerTruckYear)}</span>
                <span class="s">insurance, parking, repairs, financing, fuel ÷
                  ${n1(M.fleet)} trucks</span></div>
              <div class="kpi"><span class="k">Trucks worth owning</span>
                <span class="v ${M.best > fleetR ? "tec-warn" : "tec-good"}">${M.best}</span>
                <span class="s">fleet today ${n1(M.fleet)} · demand peaked at
                  ${M.maxNeed}</span></div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">Where the rental money goes</div>
              <div class="panel-title">Rental spend by company</div>
              <div class="tec-note">Priced from what we actually paid each company — the
                card feed, matched by name — not from a rate card. That is the only way
                Enterprise can be priced at all: it has no published rate we hold, and it
                is the company we now rent from most.</div>
              <div class="tec-vendors">
                ${vendors.map(v => `
                  <div class="tec-vend"><div class="n">${esc(v)}</div>
                    <div class="v">${money(M.rent[v])}</div>
                    <div class="s">${pct(M.rentTotal ? M.rent[v] / M.rentTotal : 0)}
                      of rental spend</div></div>`).join("")
                  || '<div class="tec-note">No rental spend in this period.</div>'}
              </div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">Demand against the fleet</div>
              <div class="panel-title">Days that needed at least N trucks</div>
              <div class="tec-note">Each bar is a truck: how many days in this period
                needed that many trucks at once. Bars past
                <b>${fleetR}</b> are the days we could not cover with what we own — those
                are the rentals. This is the shape that decides the fleet size.</div>
              <div class="tec-hist">
                ${M.hist.map(h => `<div class="b${h.n > fleetR ? " over" : ""}"
                    style="height:${Math.max(2, Math.round(100 * h.days / histMax))}%"
                    title="${h.days} days needed ${h.n}+ trucks"></div>`).join("")}
              </div>
              <div class="tec-hlab">
                ${M.hist.map(h => `<span>${h.n % 5 === 0 || h.n === 1 ? h.n : ""}</span>`)
                  .join("")}
              </div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">The answer</div>
              <div class="panel-title">What each additional truck is worth</div>
              <div class="tec-note">Truck N only works on days demand reaches N. What it
                earns is the renting it saves on those days; what it costs is a year of
                ownership. The last truck with a positive line is the fleet we should
                have.</div>
              <div class="rs-tablewrap" style="margin-top:10px">
                <table class="rs-table">
                  <thead><tr><th>Truck</th><th class="r">Days it would work</th>
                    <th class="r">Renting it replaces</th><th class="r">Cost to own</th>
                    <th class="r">Net</th><th>Verdict</th></tr></thead>
                  <tbody>${M.marg.map(m => `
                    <tr${m.n === fleetR ? ' style="background:var(--panel-2)"' : ""}>
                      <td class="strong">#${m.n}${m.n === fleetR
                        ? ' <span class="rs-pill mute">fleet today</span>' : ""}</td>
                      <td class="r">${fmtN(m.days)}</td>
                      <td class="r">${money(m.displaced)}</td>
                      <td class="r">${money(m.cost)}</td>
                      <td class="r ${m.net >= 0 ? "tec-good" : "tec-bad"}">
                        ${m.net >= 0 ? "+" : "−"}${money(Math.abs(m.net)).replace("$", "$")}</td>
                      <td>${m.net >= 0
                        ? '<span class="rs-pill ok">worth owning</span>'
                        : '<span class="rs-pill mute">rent instead</span>'}</td>
                    </tr>`).join("")}
                  </tbody>
                </table>
              </div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">The buy in front of us</div>
              <div class="panel-title">Buying truck #${fleetR + 1}</div>
              <div class="tec-note">The candidate we priced: a 2019 Freightliner M2 at
                Penske North Bergen, spec'd under 26,000 lbs so New Jersey asks $300k of
                liability cover instead of $1.5M. Change any number — the payback follows.</div>
              <div class="tec-fields">
                <div><div class="l">Purchase price</div>
                  <input class="rs-num" id="tecPrice" type="number" step="500"
                         value="${S.buy.price}" style="width:130px"></div>
                <div><div class="l">Insurance / year</div>
                  <input class="rs-num" id="tecIns" type="number" step="500"
                         value="${S.buy.ins}" style="width:130px"></div>
                <div><div class="l">Parking / year</div>
                  <input class="rs-num" id="tecPark" type="number" step="100"
                         value="${S.buy.park}" style="width:130px"></div>
                <div><div class="l">Repairs / year</div>
                  <input class="rs-num" id="tecMaint" type="number" step="500"
                         value="${S.buy.maint}" style="width:130px"></div>
              </div>
              <div class="rs-kpis">
                <div class="kpi"><span class="k">It would work</span>
                  <span class="v">${fmtN((M.nextTruck.days / M.months) * 12)} days/yr</span>
                  <span class="s">at this period's demand</span></div>
                <div class="kpi"><span class="k">Renting it replaces</span>
                  <span class="v tec-good">${money(M.buyDisplacedYear)}/yr</span>
                  <span class="s">at ${money1(M.rentPerDay)} a rental day</span></div>
                <div class="kpi"><span class="k">Running cost</span>
                  <span class="v">${money(M.buyYear)}/yr</span>
                  <span class="s">insurance + parking + repairs</span></div>
                <div class="kpi"><span class="k">Pays for itself in</span>
                  <span class="v ${M.paybackMonths && M.paybackMonths <= 36
                    ? "tec-good" : "tec-warn"}">${M.paybackMonths
                      ? n1(M.paybackMonths) + " months" : "never"}</span>
                  <span class="s">${M.buyNet > 0
                    ? money(M.buyNet) + " a year better than renting"
                    : "renting is cheaper at this demand"}</span></div>
              </div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">Per truck</div>
              <div class="panel-title">How hard each truck worked</div>
              <div class="rs-tablewrap">
                <table class="rs-table">
                  <thead><tr><th>Truck</th><th>Kind</th><th class="r">Days worked</th>
                    <th class="r">Jobs</th><th class="r">Jobs / day</th>
                    <th class="r">Revenue carried</th></tr></thead>
                  <tbody>${(() => {
                    const agg = {};
                    M.U.forEach(u => {
                      const k = String(u.Unit);
                      if (!agg[k]) agg[k] = { u: k, own: u.Ownership, d: 0, j: 0, r: 0 };
                      agg[k].d += num(u["Days Worked"]);
                      agg[k].j += num(u.Jobs);
                      agg[k].r += num(u.Revenue);
                    });
                    return Object.values(agg).sort((a, b2) => b2.j - a.j).map(a => `
                      <tr><td class="strong">${esc(a.u)}</td>
                        <td><span class="rs-pill ${a.own === "Owned" ? "ok" : "warn"}">
                          ${a.own === "Owned" ? "owned" : "rented"}</span></td>
                        <td class="r">${fmtN(a.d)}</td><td class="r">${fmtN(a.j)}</td>
                        <td class="r">${n1(a.d ? a.j / a.d : 0)}</td>
                        <td class="r">${money(a.r)}</td></tr>`).join("");
                  })()}</tbody>
                </table>
              </div>
              <div class="tec-note" style="margin-top:8px">A rental row is the company,
                not one vehicle: several rented trucks on the same day share one label, so
                a rental line's "days worked" is a floor and its jobs-per-day reads high.
                Owned rows are exact — the fleet number is on the closing.</div>
            </div>

            <div class="panel">
              <div class="tec-eyebrow">What the money is made of</div>
              <div class="panel-title">The owned cost stack, this period</div>
              <div class="rs-tablewrap">
                <table class="rs-table">
                  <thead><tr><th>Cost</th><th class="r">Total</th>
                    <th class="r">Per truck / year</th></tr></thead>
                  <tbody>
                    ${[["Insurance", M.ins], ["Financing", M.fin], ["Repairs & parts", M.maint],
                       ["Fuel", M.fuel], ["Parking", M.park]].map(([k, v]) => `
                      <tr><td>${k}</td><td class="r">${money(v)}</td>
                        <td class="r">${money(M.fleet
                          ? (v / M.months * 12) / M.fleet : 0)}</td></tr>`).join("")}
                    <tr><td class="strong">All in</td>
                      <td class="r strong">${money(M.ownedTotal)}</td>
                      <td class="r strong">${money(M.ownPerTruckYear)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div class="tec-note" style="margin-top:8px">Financing is in — a truck bought
                on payments is not free because the money left as a loan. Fuel takes the
                fuller of the two feeds per month (the WEX card file, or the bank's fuel
                category for months before it), never both.</div>
            </div>`;

          // ---- period pickers (kit dropdowns) ----
          RSC.localSelect(host.querySelector("#tecFrom"), {
            label: "From", values: allYms.map(ymLabel), value: ymLabel(S.from),
            onChange: v => {
              const hit = allYms.find(y => ymLabel(y) === v);
              if (hit) { S.from = hit; if (S.from > S.to) S.to = S.from; paint(); }
            },
          });
          RSC.localSelect(host.querySelector("#tecTo"), {
            label: "To", values: allYms.map(ymLabel), value: ymLabel(S.to),
            onChange: v => {
              const hit = allYms.find(y => ymLabel(y) === v);
              if (hit) { S.to = hit; if (S.to < S.from) S.from = S.to; paint(); }
            },
          });
          // ---- buy-case inputs ----
          [["tecPrice", "price"], ["tecIns", "ins"], ["tecPark", "park"],
           ["tecMaint", "maint"]].forEach(([id, key]) => {
            const el = host.querySelector("#" + id);
            if (!el) return;
            el.onchange = () => {
              const v = +el.value;
              S.buy[key] = isNaN(v) ? BUY[key] : Math.max(0, v);
              save(); paint();
            };
          });
        }

        paint();
      });
    },
  });
})();
