/* Crew Salary Comparison (Different Analysis, his ask 2026-10-06).

   "Re-calculate what the difference over 1 year would be if we paid salaries with a different
   model" -- the drafted Zip to Zip Compensation & Performance Plan. One year of jobs is replayed
   person by person under TODAY's pay (what the closing sheets and contracts actually paid) and
   the NEW plan, whose every number lives on the Settings tab.

   Facts: mart_crew_pay_compare (src/crew_pay_compare.py) -- a row per person per job.
   Settings: app_settings.crew_pay_plan, read by everyone via /api/_crewplan, written by admins
   through /api/_gset. Nothing saved = the plan's own numbers (PLAN below).

   His decisions (2026-10-06): helper tier and senior foreman by TENURE (thresholds editable;
   3 months for an experienced helper); overtime NOT modelled; LD driver/helper day pay = one day
   per closing row; the LD foreman gets 15% of the CF he moved beyond the Moveboard estimate,
   valued at the LD sheet's price per CF; the foreman bonus uses REAL eligibility (shifts, hours,
   jobs) and an ASSUMED band mix -- this year's scores cannot drive the bands (the assessed half
   is filled for 14 of 231 foreman-months, and the score never reaches 80).

   Finalised 2026-10-09 against the co-worker's Excel (27/26/25 flat rates, Jan-Sep 2026), his
   calls: keep OUR tenure ladder (it pays experienced people more), replay a real 12 months, and
   - TRAVEL stays as today: hours = max(labor, minimum) + travel from the miles lookup, and the
     plan pays those hours at the seat's full new rate. The replay uses the hours the wage was
     actually PAID for (wage / rate) -- the closing sheet only shows whole hours (10.5 h shows as
     11), and replaying the shown hours overpaid ~1,650 h a year.
   - PACKING POOL for drivers + helpers: 10% of materials sold, split 50/50 between the driver
     seat and the helpers (the Excel's text). A job with no driver gives the helpers the whole
     pool, and the other way round; the foreman keeps his own 20%.
   - STAIRS & BULKY are NOT part of the comparison (his call 2026-10-09: "we dont touch and change
     that thing at all"). The plan pays them exactly as today, so -- like tips -- they sit outside
     both totals; replaying them from the contract's charges only produced rounding ($38 today vs
     $37.50 "new" per person on a $150 flight split four ways).
   - ZIP TO ZIP ONLY (his call 2026-10-09: "exclude tuji and everything, it should be only about
     ZIP"): Tuji, Boston and Virginia jobs are not replayed.
   - The FOREMAN'S PACKING COMMISSION is out too: it has been 20% since December 2025 -- the plan's
     number -- and the only "difference" was Oct-Nov 2025, still paid at the old 26%.
   - LONG-DISTANCE DAYS: a driver/helper row on an LD job at a rate of $100 or more is a DAY rate,
     and its Hours column holds the number of DAYS (2 x $240 = $480). The plan pays those days x
     $250 / $200. Rows at an hourly rate are hourly legs (loading and the like) and stay hourly at
     the seat's new rate (his pick) -- the first build paid every row as ONE day, which undercounted
     multi-day trips and overpaid 2-hour legs.
   - ...and then LONG-DISTANCE DAY PAY and the LD FOREMAN'S CF SHARE left the comparison (his call
     2026-10-10, "that other is very insignificant, lets get rid of it"): counted right, the plan's
     $250 / $200 a day is what the day-rate rows already earn (-$1.3k a year) and the CF share was
     +$4.5k. Day-rate rows are still recognised (so their days never pass as hours) but sit outside
     both totals, like tips, stairs, bulky and the foreman's packing. Hourly legs stay hourly.

   FOUR SCENARIOS (his ask 2026-10-23: "very easy to navigate tabs, with 4 scenarios. first is
   actual - with what they currently make, 2nd with % Salary, 3rd with Bonus option and 4th with
   daily rate instead of hourly"). The drafted plan above is the BONUS PLAN tab, unchanged, with its
   rules inline. The other three, all on the same Zip to Zip jobs:
   - ACTUAL: everything the crew was paid -- the wage (hourly, or the day pay on a long-distance
     trip), the foreman's packing commission, stairs, bulky, hoisting/storage/junk pay (split evenly
     over the crew, as the contract pays them) and the foreman's review bonus. Tips sit apart.
   - % OF BILL, his Excel (flat-rate job template, ForFormulas!DG10): a salary pool of 30% of the
     "splitable bill" plus a 5% bonus pool ("which later will be reduced if something happens" --
     the paid-out share is a setting). The foreman takes 1 + an extra share that grows with the bill
     ($0 0.35 ... $4,000 1.86), the driver and every helper 1 share (his pick: the driver as a
     helper); each salary rounded UP to the dollar, as the Excel does. Nothing else: no stairs,
     bulky, packing or review pay. No hourly floor (his pick) -- the minimum-wage count is shown.
   - DAILY RATE: a day rate per seat per person per day, plus the foreman's % of packing sold
     ("keep the % from packing materials thing so they have interest in selling them"), nothing
     else ("bulky is fully ours"); rates rounded to $5 and starting at break-even (today's pay per
     day for the seat, less the packing %). */
if (window.RS && RS.DATASETS && !RS.DATASETS.crew_pay_compare) {
  RS.DATASETS.crew_pay_compare = {
    table: "mart_crew_pay_compare",
    cols: ["Unique Key", "Date", "Month", "Company", "Job No", "Request #", "Customer", "Moving Type",
           "Job Foreman", "Role", "Person", "Hours", "Rate", "Salary", "Tip", "First Job",
           "First Foreman Job", "Crew Size", "Job Bill", "Packing Sold", "Packing Commission",
           "Has Contract", "Travel Hours", "Stairs Paid", "Bulky Paid", "Review Paid", "Other Extras Paid",
           "Job Type", "Labor Charge", "Cash Discount Pct", "Packing Charged", "Fees Charged", "Discounts"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "crew-pay-compare",
  group: "different",
  title: "Crew Salary Comparison",
  async render(host) {
    const esc = RSC.esc;
    const num = v => (v == null || v === "" || isNaN(v) ? 0 : +v);
    const money = v => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
    const moneyK = v => { const a = Math.abs(v), s = v < 0 ? "−$" : "$";
      return a >= 1e6 ? s + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + Math.round(a / 1e3) + "k" : s + Math.round(a).toLocaleString("en-US"); };
    const signMoney = v => (v > 0 ? "+" : "") + money(v).replace("−", "−");
    const pct = (a, b) => b ? ((a - b) / b * 100) : 0;
    const delta = (n, t) => {
      const d = n - t, p = pct(n, t);
      if (Math.abs(d) < 0.5) return `<span class="cpc-flat">no change</span>`;
      return `<span class="${d > 0 ? "cpc-up" : "cpc-down"}">${d > 0 ? "▲" : "▼"} ${moneyK(Math.abs(d))} · ${Math.abs(p).toFixed(1)}%</span>`;
    };

    /* ---------- the drafted plan (PDF) = the defaults ---------- */
    const COMPANY = "Zip to Zip";   // his call 2026-10-09: "it should be only about ZIP"
    const LD_DAY_RATE = 100;        // an LD driver/helper "rate" this high is per DAY, and Hours holds days
    const PLAN = {
      from: "2025-10-01", to: "2026-09-30",
      helperEntry: 18, helperExp: 20, expHelperMonths: 3,
      driver: 22, foreman: 25, seniorForeman: 27, seniorForemanYears: 2,
      crewPackPct: 10, crewPackDriverShare: 50,
      ldTypes: "Straight Moving,Regular Moving",
      bonusMinShifts: 10, bonusMinHours: 80, bonusMinJobs: 8,
      band1Amt: 1000, band2Amt: 750, band3Amt: 400,
      band1Share: 30, band2Share: 40, band3Share: 20, band0Share: 10,
      // % of bill -- his Excel's numbers
      pctPool: 30, pctBonus: 5, pctBonusPaid: 100, pctLd: 14,
      pctB1From: 0, pctB1: 35, pctB2From: 800, pctB2: 61, pctB3From: 1600, pctB3: 88,
      pctB4From: 2400, pctB4: 106, pctB5From: 3200, pctB5: 134, pctB6From: 4000, pctB6: 186,
      // daily rate -- empty = break-even; the foreman's packing % stays
      dayForeman: "", dayDriver: "", dayHelper: "", dayPackPct: 20,
    };
    const MIN_WAGE = 15.92;   // New Jersey, 2026 -- shown, never applied (his pick: no floor)
    const LABELS = {
      from: "From", to: "To",
      helperEntry: "Entry helper", helperExp: "Experienced helper", expHelperMonths: "Experienced helper after, with us",
      driver: "Driver / mover", foreman: "Foreman", seniorForeman: "Senior foreman", seniorForemanYears: "Senior foreman after, as foreman",
      crewPackPct: "Driver + helpers' pool, of materials sold", crewPackDriverShare: "The driver seat's share of that pool",
      ldTypes: "Long-distance job types",
      bonusMinShifts: "Shifts in the month, at least", bonusMinHours: "Hours in the month, at least", bonusMinJobs: "Jobs as foreman, at least",
      pctPool: "Salary pool, of the splitable bill", pctLd: "Long-distance pool, of the bill", pctBonus: "Bonus pool, of the splitable bill", pctBonusPaid: "Bonus pool paid out",
      dayForeman: "Foreman", dayDriver: "Driver", dayHelper: "Helper", dayPackPct: "Foreman's packing, of materials sold",
    };
    // the unit drawn beside each box: $ in front; %, /h, months after
    const UNIT = {};
    [["%", "pctPool pctBonus pctBonusPaid pctLd crewPackPct crewPackDriverShare dayPackPct band1Share band2Share band3Share band0Share"],
     ["$/h", "helperEntry helperExp driver foreman seniorForeman"], ["$/day", "dayForeman dayDriver dayHelper"],
     ["$", "band1Amt band2Amt band3Amt"], ["months", "expHelperMonths"], ["years", "seniorForemanYears"],
     ["h", "bonusMinHours"], ["shifts", "bonusMinShifts"], ["jobs", "bonusMinJobs"]]
      .forEach(([u, ks]) => ks.split(" ").forEach(k => { UNIT[k] = u; }));
    for (let i = 1; i <= 6; i++) { UNIT["pctB" + i + "From"] = "$"; UNIT["pctB" + i] = "%"; }
    /* MAIN LEVERS -- his ask 2026-10-23: "some very important stuff should be on each tab ... but the
       settings part should be separately. i dont want too many selectors, yet i want the main ones to be
       there". Each scenario tab carries its few main numbers in one row; everything else is on Settings. */
    const LEVERS = {
      pct: ["pctPool", "pctBonus", "pctLd"],
      bonus: ["helperEntry", "helperExp", "driver", "foreman", "seniorForeman"],
      daily: ["dayForeman", "dayDriver", "dayHelper"],
    };
    const SHORT = { pctPool: "Salary pool", pctBonus: "Bonus pool", pctLd: "Long distance",
      helperEntry: "Entry helper", helperExp: "Exp. helper", driver: "Driver", foreman: "Foreman", seniorForeman: "Senior foreman",
      dayForeman: "Foreman", dayDriver: "Driver", dayHelper: "Helper" };
    // the Bonus plan's own groups on Settings (its bands are a table of their own)
    const GROUPS = [
      ["Hourly rates", "Base pay per hour for each seat. Long-distance drivers and helpers paid by the day are left out of this plan.",
        ["helperEntry", "helperExp", "driver", "foreman", "seniorForeman"]],
      ["Career ladder", "Tenure is counted from a person's first job with us (any seat), and for senior foreman from their first job as foreman — as of each job's date.",
        ["expHelperMonths", "seniorForemanYears"]],
      ["Packing pool", "From the closing sheet's packing materials sold. One pot per job: the driver seat gets its share and the helpers split the rest evenly; a missing seat's half goes to the other. The foreman keeps his 20% as today, so it is not in this plan.",
        ["crewPackPct", "crewPackDriverShare"]],
      ["Foreman bonus — who qualifies", "Checked per foreman per month from the closing sheets. The plan's '90% of records complete' rule is not measurable in our data and is left out.",
        ["bonusMinShifts", "bonusMinHours", "bonusMinJobs"]],
    ];

    /* ---------- state ---------- */
    let saved = { value: {}, by: null, at: null, can_edit: false };
    try {
      const r = await fetch(ZTZ.API + "/api/_crewplan", { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
      if (r.ok) saved = await r.json();
    } catch (e) { /* the plan's defaults stand in */ }
    const S = window.__cpcState = window.__cpcState
      || { tab: /[#&]tab=settings/.test(location.hash) ? "settings" : "actual", sort: "diff", q: "", draft: null };
    // the drafted plan was the whole page before the four tabs: its old walk-through tab opens the Bonus plan
    if (S.tab === "analysis") S.tab = "bonus";
    const savedSet = Object.assign({}, PLAN, saved.value || {});
    const cfg = () => S.draft ? Object.assign({}, savedSet, S.draft) : savedSet;

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>a year of crew pay</b>…</div><div class="bar"><i></i></div></div>`;
    const all = await RS.load("crew_pay_compare");
    injectCss();

    /* ---------- the replay ---------- */
    function compute(c) {
      const ld = new Set(String(c.ldTypes).split(",").map(x => x.trim()).filter(Boolean));
      const rows = all.filter(r => r["Company"] === COMPANY && r["Date"] >= c.from && r["Date"] <= c.to);
      const monthsBetween = (a, b) => (new Date(b) - new Date(a)) / (1000 * 3600 * 24 * 30.4375);
      const comp = () => ({ hourlyT: 0, hourlyN: 0, poolN: 0, bonusN: 0, tips: 0 });
      const tot = comp(), bySeat = {}, byMonth = {}, people = {}, seatHours = {};
      const fm = {};   // foreman x month -> {days:Set, hours, jobs}
      let noHours = 0, ldRows = 0, ldPaid = 0, ldJobs = new Set(), jobs = new Set();
      let revenue = 0, shownHours = 0, paidHours = 0, travelHours = 0, travelBase = 0, travelJobs = new Set(), poolJobs = new Set();
      // who sat in the driver and helper seats of each job -- the packing pool is split over them
      const crewOf = {};
      rows.forEach(r => {
        const k = r["Unique Key"], o = crewOf[k] = crewOf[k] || { d: 0, h: 0 };
        if (r["Role"] === "Driver") o.d++; else if (r["Role"] === "Helper") o.h++;
      });
      const poolPct = num(c.crewPackPct) / 100, poolDriver = Math.min(1, num(c.crewPackDriverShare) / 100);
      // for the walk-through: every person's line on every job, the hourly seats, and job-level sums
      const byJob = {}, byTier = {}, ldDays = { Driver: 0, Helper: 0 };
      let soldTot = 0, ldLegs = 0;
      rows.forEach(r => {
        const role = r["Role"], who = r["Person"] || "(no name)", d = r["Date"], ym = r["Month"];
        const isLD = ld.has(r["Moving Type"]);
        const sal = num(r["Salary"]), tip = num(r["Tip"]), packT = role === "Foreman" ? num(r["Packing Commission"]) : 0;
        // HOURS PAID, not hours shown: the closing sheet shows whole hours, the wage was paid on the
        // exact ones (labor or the minimum, plus travel from the miles lookup) -- 10.5 h shows as 11
        const rate = num(r["Rate"]), wage = Math.max(0, sal - packT);
        // LONG-DISTANCE DAYS: on an LD job, a driver/helper rate of $100+ is a day rate and Hours holds days
        const dayRow = isLD && role !== "Foreman" && rate >= LD_DAY_RATE;
        const days = dayRow ? (num(r["Hours"]) || wage / rate || 1) : 0;
        let hours = dayRow ? 0 : num(r["Hours"]);
        shownHours += hours;
        if (!dayRow && rate > 0 && wage > 0) {
          const x = wage / rate;
          if (!hours || Math.abs(x - hours) < 1) hours = x;   // no hours on the row, or the sheet's rounding
        }
        paidHours += hours;
        if (!dayRow && !hours && sal > 0) noHours++;
        if (isLD && !dayRow && role !== "Foreman") ldLegs++;
        if (r["Travel Hours"] != null && r["Travel Hours"] !== "" && !isLD) {   // contract jobs: how much is drive time
          travelHours += Math.min(num(r["Travel Hours"]), hours); travelBase += hours; travelJobs.add(r["Unique Key"]);
        }
        // today: what was paid, split into its parts
        const t = comp(), n = comp();
        t.tips = tip;
        // new: the plan
        let tier = "", newRate = null, tenure = null;
        if (role === "Foreman") {
          const asForeman = r["First Foreman Job"] ? monthsBetween(r["First Foreman Job"], d) : null;
          const senior = asForeman != null && asForeman >= num(c.seniorForemanYears) * 12;
          tier = senior ? "Senior foreman" : "Foreman"; newRate = num(senior ? c.seniorForeman : c.foreman);
          tenure = { m: asForeman, as: "as foreman" };
          n.hourlyN = hours * newRate;
          t.hourlyT = Math.max(0, sal - packT);
          const k = who + "|" + ym;
          const m = fm[k] = fm[k] || { who, ym, days: new Set(), hours: 0, jobs: 0 };
          m.days.add(d); m.hours += hours; m.jobs++;
        } else if (dayRow) {
          // paid by the day: outside both totals (the plan's day pay is today's)
          ldRows++; ldDays[role] = (ldDays[role] || 0) + days; ldPaid += sal;
          tier = "Long-distance " + role.toLowerCase() + " (by the day)";
          tenure = { m: r["First Job"] ? monthsBetween(r["First Job"], d) : null, as: "with us" };
        } else {
          const withUs = r["First Job"] ? monthsBetween(r["First Job"], d) : null;
          const exp = role === "Helper" && withUs != null && withUs >= num(c.expHelperMonths);
          tier = role === "Driver" ? "Driver" : exp ? "Experienced helper" : "Entry helper";
          newRate = num(role === "Driver" ? c.driver : (exp ? c.helperExp : c.helperEntry));
          tenure = { m: withUs, as: "with us" };
          t.hourlyT = sal;
          n.hourlyN = hours * newRate;
        }
        if (!dayRow && !hours && sal > 0) { n.hourlyN = t.hourlyT; }   // keep what was paid when there is nothing to replay
        // packing pool for the driver and helper seats (today: nothing)
        const sold = num(r["Packing Sold"]);
        if (role !== "Foreman" && sold > 0 && poolPct > 0) {
          const k = crewOf[r["Unique Key"]];
          const dShare = !k.h ? 1 : !k.d ? 0 : poolDriver;   // a missing seat's half goes to the other seat
          n.poolN = sold * poolPct * (role === "Driver" ? dShare / k.d : (1 - dShare) / k.h);
          poolJobs.add(r["Unique Key"]);
        }
        seatHours[role] = (seatHours[role] || 0) + hours;
        if (!jobs.has(r["Unique Key"])) {   // job-level money, once per job
          revenue += num(r["Job Bill"]); soldTot += sold;
        }
        jobs.add(r["Unique Key"]);
        if (isLD) ldJobs.add(r["Unique Key"]);
        const T = t.hourlyT, N = n.hourlyN + n.poolN;
        (byJob[r["Unique Key"]] = byJob[r["Unique Key"]] || []).push({ r, role, who, tier, tenure, shown: dayRow ? 0 : num(r["Hours"]), hours, rate, newRate, isLD, dayRow, days, t, n, T, N });
        if (newRate != null) {   // the hourly seats (a long-distance foreman stays hourly)
          const b = byTier[tier] = byTier[tier] || { tier, hours: 0, t: 0, n: 0, rows: 0, people: new Set(), rate: newRate };
          b.hours += hours; b.t += t.hourlyT; b.n += n.hourlyN; b.rows++; b.people.add(who);
        }
        const add = (o) => { Object.keys(t).forEach(x => { o[x] += t[x]; }); Object.keys(n).forEach(x => { o[x] += n[x]; }); };
        add(tot);
        add(bySeat[role] = bySeat[role] || comp());
        add(byMonth[ym] = byMonth[ym] || comp());
        const p = people[who] = people[who] || Object.assign(comp(), { who, roles: {}, jobs: 0, hours: 0, months: {}, tier: "" });
        add(p); p.jobs++; p.hours += hours; p.roles[role] = (p.roles[role] || 0) + 1;
        const pm = p.months[ym] = p.months[ym] || { t: 0, n: 0, jobs: 0, bonus: 0, elig: null };
        pm.t += T; pm.n += N; pm.jobs++;
        // the tier the person ends the period on, for the table
        if (role === "Helper") p.tier = (r["First Job"] && monthsBetween(r["First Job"], c.to) >= num(c.expHelperMonths)) ? "Experienced" : "Entry";
        if (role === "Foreman") p.tier = (r["First Foreman Job"] && monthsBetween(r["First Foreman Job"], c.to) >= num(c.seniorForemanYears) * 12) ? "Senior foreman" : "Foreman";
        if (role === "Driver" && !p.tier) p.tier = "Driver";
      });
      // foreman bonus: real eligibility, assumed band mix (expected value per eligible month)
      const ev = (num(c.band1Amt) * num(c.band1Share) + num(c.band2Amt) * num(c.band2Share) + num(c.band3Amt) * num(c.band3Share)) / 100;
      let eligMonths = 0, fmMonths = 0;
      Object.values(fm).forEach(m => {
        fmMonths++;
        const ok = m.days.size >= num(c.bonusMinShifts) && m.hours >= num(c.bonusMinHours) && m.jobs >= num(c.bonusMinJobs);
        const p = people[m.who], pm = p.months[m.ym];
        pm.elig = { ok, shifts: m.days.size, hours: m.hours, jobs: m.jobs };
        if (!ok) return;
        eligMonths++;
        pm.bonus = ev; pm.n += ev;
        p.bonusN += ev; tot.bonusN += ev;
        (bySeat.Foreman = bySeat.Foreman || comp()).bonusN += ev;
        (byMonth[m.ym] = byMonth[m.ym] || comp()).bonusN += ev;
      });
      const T = o => o.hourlyT;
      const N = o => o.hourlyN + o.poolN + o.bonusN;
      return { rows, tot, bySeat, byMonth, people, T, N, ev, eligMonths, fmMonths, noHours, ldRows, ldLegs, seatHours,
               byJob, byTier, ldDays, ldPaid, soldTot,
               revenue, shownHours, paidHours, travelHours, travelBase, travelJobs: travelJobs.size, poolJobs: poolJobs.size,
               jobs: jobs.size, ldJobs: ldJobs.size };
    }

    /* ---------- paint ---------- */
    const fmtDay = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
    const mlabel = ym => { const [y, m] = ym.split("-"); return RS.monthName(+m).slice(0, 3) + " " + y.slice(2); };
    const TABS = [["actual", "Actual"], ["pct", "% of bill"], ["bonus", "Bonus plan"], ["daily", "Daily rate"], ["settings", "Settings"]];
    function paint() {
      const c = cfg();
      host.innerHTML = `
        <div class="cpc">
          <div class="rs-page-head"><h1>Crew Salary Comparison</h1>
            <p>A year of crew pay four ways — what we actually paid, and three other ways of paying the same jobs ·
              Zip to Zip jobs · ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}</p></div>
          <div class="rs-tabs cpc-tabs">${TABS.map(([k, l]) =>
            (k === "settings" && S.draft ? `<span class="cpc-sub cpc-unsaved">unsaved changes</span>` : "")
            + `<button class="rs-tab ${S.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
          <div id="cpcStrip"></div>
          <div id="cpcLevers"></div>
          <div id="cpcBody"></div>
        </div>`;
      host.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; paint(); });
      const body = host.querySelector("#cpcBody");
      const SC = scenarios(c);
      paintStrip(host.querySelector("#cpcStrip"), SC);
      paintLevers(host.querySelector("#cpcLevers"), c, SC);
      if (S.tab === "actual") paintActual(body, c, SC);
      else if (S.tab === "pct") paintScenario(body, c, SC, SC.pct);
      else if (S.tab === "daily") paintScenario(body, c, SC, SC.daily);
      else if (S.tab === "settings") paintSettings(body, c, SC);
      else paintAnalysis(body, c);
    }

    function paintAnalysis(body, c) {
      const R = compute(c), tot = R.tot, t = R.T(tot), n = R.N(tot);
      // THE WALK-THROUGH (his ask 2026-10-09: "i see the final results, but i am slightly confused
      // with how we got there"). Every part of pay is one step from today's total to the plan's,
      // and each says how it is worked out with this period's own inputs.
      const $ = v => money(num(v));
      const TIER_ORDER = ["Entry helper", "Experienced helper", "Driver", "Foreman", "Senior foreman"];
      const tiers = TIER_ORDER.map(k => R.byTier[k]).filter(Boolean)
        .concat(Object.values(R.byTier).filter(b => !TIER_ORDER.includes(b.tier)));
      const tierT = tiers.reduce((a, b) => a + b.t, 0), tierN = tiers.reduce((a, b) => a + b.n, 0), tierH = tiers.reduce((a, b) => a + b.hours, 0);
      const steps = [
        { k: "Hourly wages", short: "Hourly rates", t: tot.hourlyT, n: tot.hourlyN,
          how: `${Math.round(tierH).toLocaleString()} hours paid (travel included) × each seat's new rate — seat by seat below. Today: what the sheets paid for the same hours.${R.ldLegs ? ` Includes ${R.ldLegs} hourly legs of long-distance jobs (loading and the like).` : ""}` },
        { k: "Packing pool — drivers & helpers", short: "Packing pool", t: 0, n: tot.poolN,
          how: `${num(c.crewPackPct)}% × ${money(R.soldTot)} of packing materials sold: ${num(c.crewPackDriverShare)}% to the driver, the rest split over the helpers (a missing seat's half goes to the other). New — today they get none.` },
        { k: "Foreman bonus", short: "Foreman bonus", t: 0, n: tot.bonusN,
          how: `${R.eligMonths} of ${R.fmMonths} foreman-months qualify (${num(c.bonusMinShifts)} shifts, ${num(c.bonusMinHours)} h, ${num(c.bonusMinJobs)} jobs) × ${money(R.ev)} each = ${num(c.band1Share)}% × ${$(c.band1Amt)} + ${num(c.band2Share)}% × ${$(c.band2Amt)} + ${num(c.band3Share)}% × ${$(c.band3Amt)}, the band mix assumed in Settings. New.` },
      ].sort((a, b) => (b.n - b.t) - (a.n - a.t));
      const maxAbs = Math.max(1, ...steps.map(p => Math.abs(p.n - p.t)));
      const seats = ["Foreman", "Driver", "Helper"].filter(s => R.bySeat[s]);
      const months = Object.keys(R.byMonth).sort();
      const people = Object.values(R.people).filter(p => !S.q || p.who.toLowerCase().includes(S.q.toLowerCase()));
      const key = { diff: p => R.N(p) - R.T(p), today: p => R.T(p), new: p => R.N(p), name: p => p.who };
      people.sort((a, b) => S.sort === "name" ? a.who.localeCompare(b.who) : key[S.sort](b) - key[S.sort](a));
      const mainRole = p => Object.entries(p.roles).sort((a, b) => b[1] - a[1])[0][0];
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:5">
          <div class="kpi"><div class="l">Paid today</div><div class="v">${moneyK(t)}</div><div class="s">hourly wages · what the plan doesn't change is left out</div></div>
          <div class="kpi"><div class="l">Under the new plan</div><div class="v">${moneyK(n)}</div><div class="s">same jobs, same hours</div></div>
          <div class="kpi cpc-kd"><div class="l">Difference over the year</div><div class="v">${n >= t ? "+" : "−"}${moneyK(Math.abs(n - t)).replace("−", "")}</div>
            <div class="s">${delta(n, t)} vs today</div></div>
          <div class="kpi"><div class="l">Share of revenue</div><div class="v">${R.revenue ? (t / R.revenue * 100).toFixed(1) + "% → " + (n / R.revenue * 100).toFixed(1) + "%" : "—"}</div>
            <div class="s">crew pay ÷ the same jobs' bills (${moneyK(R.revenue)})</div></div>
          <div class="kpi"><div class="l">Tips (unchanged)</div><div class="v">${moneyK(tot.tips)}</div><div class="s">${Object.keys(R.people).length} people · ${R.jobs.toLocaleString()} jobs</div></div>
        </div>
        <section class="panel cpc-walk">
          <div class="panel-head"><span class="panel-title">How we got here</span>
            <span class="cpc-sub">${money(t)} paid today → ${money(n)} under the plan, one step at a time</span></div>
          <div class="chartbox cpc-wfbox"><canvas id="cpcWf" role="img" aria-label="From pay today to the new plan, step by step"></canvas></div>
          <div class="rs-tablewrap"><table class="rs-table cpc-parts">
            <thead><tr><th class="cpc-stepn">#</th><th>Step</th><th>How it is worked out</th><th class="num">Today</th><th class="num">New plan</th><th class="num">Difference</th><th></th></tr></thead>
            <tbody>
              <tr class="cpc-totrow"><td class="cpc-stepn"></td><td><b>Paid today</b></td><td class="cpc-howcell">Hourly wages on ${R.jobs.toLocaleString()} Zip to Zip jobs, ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}. Tips, stairs, bulky-item pay, the foreman's 20% packing commission and long-distance day pay are left out — the plan pays them as today.</td>
                <td class="num">${money(t)}</td><td></td><td></td><td></td></tr>
              ${steps.map((p, i) => {
                const d = p.n - p.t, w = Math.round(Math.abs(d) / maxAbs * 100);
                return `<tr><td class="cpc-stepn">${i + 1}</td><td><b>${esc(p.k)}</b></td><td class="cpc-howcell">${p.how}</td>
                  <td class="num">${money(p.t)}</td><td class="num">${money(p.n)}</td>
                  <td class="num ${d > 0.5 ? "cpc-up" : d < -0.5 ? "cpc-down" : ""}">${Math.abs(d) < 0.5 ? "—" : signMoney(d)}</td>
                  <td class="cpc-barcell"><span class="cpc-bar ${d >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></td></tr>`;
              }).join("")}</tbody>
            <tfoot><tr><td></td><td>Under the new plan</td><td></td><td class="num">${money(t)}</td><td class="num">${money(n)}</td><td class="num">${signMoney(n - t)}</td><td></td></tr></tfoot>
          </table></div>
        </section>
        <div class="cpc-grid">
          <section class="panel">
            <div class="panel-head"><span class="panel-title">Hourly rates, seat by seat</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Seat</th><th class="num">People</th><th class="num">Hours paid</th><th class="num">Today</th><th class="num">Today / hour</th><th class="num">New rate</th><th class="num">New plan</th><th class="num">Difference</th></tr></thead>
              <tbody>${tiers.map(b => `<tr><td><b>${esc(b.tier)}</b></td><td class="num">${b.people.size}</td><td class="num">${Math.round(b.hours).toLocaleString()}</td>
                <td class="num">${money(b.t)}</td><td class="num">${b.hours ? "$" + (b.t / b.hours).toFixed(2) : "—"}</td><td class="num"><b>${$(b.rate)}</b></td>
                <td class="num">${money(b.n)}</td><td class="num ${b.n - b.t > 0.5 ? "cpc-up" : b.n - b.t < -0.5 ? "cpc-down" : ""}">${signMoney(b.n - b.t)}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>Hourly wages</td><td></td><td class="num">${Math.round(tierH).toLocaleString()}</td><td class="num">${money(tierT)}</td><td class="num">${tierH ? "$" + (tierT / tierH).toFixed(2) : ""}</td><td></td><td class="num">${money(tierN)}</td><td class="num">${signMoney(tierN - tierT)}</td></tr></tfoot>
            </table></div>
            <p class="cpc-note">New plan = hours paid × the seat's one new rate. "Today / hour" is the average the sheets paid for the same hours — people in one seat are on different rates today. The seat is decided per job by tenure: experienced helper after ${num(c.expHelperMonths)} months with us, senior foreman after ${num(c.seniorForemanYears)} years as foreman. Long-distance drivers and helpers are paid by the day instead (step above).</p>
          </section>
          <section class="panel">
            <div class="panel-head"><span class="panel-title">By seat</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Seat</th><th class="num">Today</th><th class="num">New plan</th><th class="num">Difference</th><th class="num">$ / hour today → new</th></tr></thead>
              <tbody>${seats.map(s => {
                const o = R.bySeat[s], h = R.seatHours[s] || 0;
                return `<tr><td><b>${s === "Foreman" ? "Foremen" : s + "s"}</b></td><td class="num">${money(R.T(o))}</td><td class="num">${money(R.N(o))}</td>
                  <td class="num">${delta(R.N(o), R.T(o))}</td>
                  <td class="num">${h ? "$" + (R.T(o) / h).toFixed(2) + " → $" + (R.N(o) / h).toFixed(2) : "—"}</td></tr>`;
              }).join("")}</tbody>
            </table></div>
            <p class="cpc-note">$ per hour here is everything in the comparison divided by hours worked, so it includes packing and the bonus — not the base rate.</p>
          </section>
        </div>
        <section class="panel cpc-job" id="cpcJob"></section>
        <section class="panel">
          <div class="panel-head"><span class="panel-title">Month by month</span></div>
          <div class="chartbox" style="height:280px"><canvas id="cpcChart"></canvas></div>
        </section>
        <section class="panel">
          <div class="panel-head"><span class="panel-title">Everyone · ${people.length}</span><span class="spacer"></span>
            <input class="cpc-q" id="cpcQ" placeholder="Find a person" value="${esc(S.q)}" aria-label="Find a person">
            <div class="rs-seg cpc-sort">${[["diff", "Biggest change"], ["new", "New pay"], ["today", "Pay today"], ["name", "Name"]].map(([k, l]) =>
              `<button data-sort="${k}" class="${S.sort === k ? "on" : ""}">${l}</button>`).join("")}</div></div>
          <div class="rs-tablewrap" style="max-height:620px"><table class="rs-table rs-sticky">
            <thead><tr><th>Person</th><th>Seat · tier at period end</th><th class="num">Jobs</th><th class="num">Hours</th><th class="num">Today</th><th class="num">New plan</th><th class="num">Difference</th></tr></thead>
            <tbody>${people.slice(0, 400).map(p => `<tr class="click" data-who="${esc(p.who)}"><td><b>${esc(p.who)}</b></td>
              <td>${esc(p.tier || mainRole(p))}${Object.keys(p.roles).length > 1 ? ` <span class="cpc-sub">also ${esc(Object.keys(p.roles).filter(r => r !== mainRole(p)).join(", ").toLowerCase())}</span>` : ""}</td>
              <td class="num">${p.jobs}</td><td class="num">${Math.round(p.hours).toLocaleString()}</td>
              <td class="num">${money(R.T(p))}</td><td class="num">${money(R.N(p))}</td><td class="num">${delta(R.N(p), R.T(p))}</td></tr>`).join("")}</tbody>
          </table></div>
        </section>
        <section class="panel cpc-how">
          <div class="panel-head"><span class="panel-title">How this is counted</span></div>
          <ul>
            <li><b>Today</b> is the hourly wage paid on Zip to Zip jobs (Tuji, Boston and Virginia are left out) — a foreman's without his packing commission. Tips, stairs, bulky-item pay, the foreman's packing commission (20% since December 2025, the plan's number) and long-distance day pay stay as they are, so they sit outside the comparison.</li>
            <li><b>Hours</b> are the hours the wage was paid for (wage ÷ rate). The closing sheet only shows whole hours — a 10.5-hour job shows as 11 — so the new plan is replayed on ${Math.round(R.paidHours).toLocaleString()} hours, not the ${Math.round(R.shownHours).toLocaleString()} the sheets show.</li>
            ${R.travelBase ? `<li><b>Travel</b> stays as it is today: the foreman enters the miles, a lookup turns them into hours (1 h up to about 110 miles, then roughly ½ h more per 20 miles), and they are added to the job's hours. On the ${R.travelJobs.toLocaleString()} local jobs with a contract, ${Math.round(R.travelHours).toLocaleString()} of ${Math.round(R.travelBase).toLocaleString()} hours (${Math.round(R.travelHours / R.travelBase * 100)}%) are drive time. Both models pay drive time at the seat's full rate — today's contracts already do — so nothing is subtracted or paid at a lower rate.</li>` : ""}
            <li><b>Packing pool:</b> new money for drivers and helpers on ${R.poolJobs.toLocaleString()} jobs with packing sold. Today they get none of it; the foreman's own 20% is unchanged.</li>
            <li><b>Long distance:</b> ${R.ldJobs} jobs. Drivers and helpers paid by the day (${R.ldRows} rows, ${+(R.ldDays.Driver + R.ldDays.Helper).toFixed(1)} days, ${money(R.ldPaid)}) are left out — the plan's $250 / $200 a day is what they earn today. ${R.ldLegs} hourly legs (loading and the like) and the foremen are paid hourly in both. The plan's 15% CF share for the foreman is not counted (about $4k a year).</li>
            <li><b>Foreman bonus:</b> ${R.eligMonths} of ${R.fmMonths} foreman-months meet the shift, hour and job minimums. Each eligible month is paid the band mix's expected ${money(R.ev)} (Settings).</li>
            <li><b>Not modelled:</b> overtime (his call), and the plan's documentation rule.${R.noHours ? ` ${R.noHours} rows had pay but no hours or rate — they keep what was paid in both models.` : ""}</li>
          </ul>
        </section>`;
      // chart
      try {
        new Chart(body.querySelector("#cpcChart"), {
          type: "bar",
          data: { labels: months.map(mlabel), datasets: [
            { label: "Paid today", data: months.map(m => Math.round(R.T(R.byMonth[m]))), backgroundColor: RS.isV2 && RS.isV2() ? RS.V2.ctx : "#5c6a7c", borderRadius: 4 },
            { label: "New plan", data: months.map(m => Math.round(R.N(R.byMonth[m]))), backgroundColor: RS.isV2 && RS.isV2() ? RS.V2.navy : "#b7e23b", borderRadius: 4 },
          ] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" },
            tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.raw) } } },
            scales: { y: { ticks: { callback: v => moneyK(v) } } } },
        });
      } catch (e) { console.warn("crew-pay chart:", e); }
      // the waterfall: today, each step in the table's order, the plan
      try {
        const v2 = RS.isV2 && RS.isV2(), V = RS.V2 || {};
        const cTot = v2 ? V.navy : "#5c6a7c", cUp = v2 ? V.accent : "#b7e23b", cDown = v2 ? V.other : "#64748b", cInk = v2 ? V.ink : "#e6edf6";
        let run = t; const bars = [[0, t]], cols = [cTot], labs = ["Paid today"], vals = [t];
        steps.forEach(p => { const d = p.n - p.t; bars.push([run, run + d]); run += d; cols.push(d >= 0 ? cUp : cDown); labs.push(p.short); vals.push(d); });
        bars.push([0, n]); cols.push(cTot); labs.push("New plan"); vals.push(n);
        const lo = Math.min(t, n, ...bars.map(b => Math.min(b[0], b[1])).filter(x => x > 0));
        const floor = Math.max(0, Math.floor(lo * 0.85 / 100000) * 100000);
        const lab = (v, i) => (i === 0 || i === vals.length - 1) ? moneyK(v) : (v >= 0 ? "+" : "−") + moneyK(Math.abs(v)).replace("−", "");
        new Chart(body.querySelector("#cpcWf"), {
          type: "bar",
          data: { labels: labs, datasets: [{ data: bars, backgroundColor: cols, borderRadius: 4, borderSkipped: false, maxBarThickness: 64 }] },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 22 } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => lab(vals[x.dataIndex], x.dataIndex) } } },
            scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0 } },
                      y: { min: floor, ticks: { callback: v => moneyK(v) } } } },
          plugins: [{ id: "cpcWfLab", afterDatasetsDraw(ch) {
            const x = ch.ctx; x.save(); x.font = "700 12px " + ((RS.V2 && RS.V2.font) || "sans-serif"); x.fillStyle = cInk; x.textAlign = "center"; x.textBaseline = "bottom";
            ch.getDatasetMeta(0).data.forEach((el, i) => x.fillText(lab(vals[i], i), el.x, Math.min(el.y, el.base) - 4));
            x.restore(); } }],
        });
      } catch (e) { console.warn("crew-pay waterfall:", e); }
      paintJob(R, c);
      const q = body.querySelector("#cpcQ");
      q.oninput = () => { S.q = q.value; const pos = q.selectionStart; paintAnalysis(body, c); const q2 = body.querySelector("#cpcQ"); q2.focus(); q2.setSelectionRange(pos, pos); };
      body.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => { S.sort = b.dataset.sort; paintAnalysis(body, c); });
      body.querySelectorAll("tr[data-who]").forEach(tr => tr.onclick = () => openPerson(R, tr.dataset.who));
    }

    /* ONE JOB, LINE BY LINE -- the same arithmetic as the totals, for one job, person by person.
       Opens on a typical recent job (local, contract, driver + two helpers, packing sold); any job
       can be found by request #, customer, foreman or date. */
    const m2 = v => { const r = Math.round(v * 100) / 100; return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const h2 = v => String(+(+v).toFixed(2));
    const tenureTxt = te => {
      if (!te || te.m == null) return "";
      const m = Math.max(0, Math.floor(te.m));
      return (te.m >= 24 ? (te.m / 12).toFixed(1) + " years " : m === 1 ? "1 month " : m + " months ") + te.as;
    };
    const shareTxt = f => f >= 0.999 ? "all" : Math.abs(f - 0.5) < 0.001 ? "half" : Math.round(f * 100) + "%";
    function typicalJob(R) {
      let best = null, bestD = "";
      Object.entries(R.byJob).forEach(([uk, xs]) => {
        const r0 = xs[0].r, d = r0["Date"];
        if (xs[0].isLD || !num(r0["Has Contract"]) || !(num(r0["Packing Sold"]) > 0) || d <= bestD) return;
        if (xs.length !== 4 || xs.filter(x => x.role === "Driver").length !== 1 || xs.filter(x => x.role === "Helper").length !== 2) return;
        const hs = xs.map(x => x.hours);
        if (!(Math.min(...hs) > 0) || Math.max(...hs) - Math.min(...hs) > 0.6) return;
        best = uk; bestD = d;
      });
      return best || Object.keys(R.byJob)[0];
    }
    function paintJob(R, c) {
      const box = host.querySelector("#cpcJob");
      if (!box) return;
      const uk = S.job && R.byJob[S.job] ? S.job : typicalJob(R);
      const xs = (R.byJob[uk] || []).slice().sort((a, b) => ["Foreman", "Driver", "Helper"].indexOf(a.role) - ["Foreman", "Driver", "Helper"].indexOf(b.role));
      if (!xs.length) { box.innerHTML = ""; return; }
      const r0 = xs[0].r, crew = Math.max(1, num(r0["Crew Size"])), sold = num(r0["Packing Sold"]);
      const nD = xs.filter(x => x.role === "Driver").length, nH = xs.filter(x => x.role === "Helper").length;
      const dShare = !nH ? 1 : !nD ? 0 : Math.min(1, num(c.crewPackDriverShare) / 100);
      const paidH = xs[0].hours, shownH = xs[0].shown;   // the foreman's, or the first seat's
      const trav = r0["Travel Hours"] != null && r0["Travel Hours"] !== "" ? num(r0["Travel Hours"]) : null;
      const ln = (txt, cls) => `<div class="${cls || ""}">${txt}</div>`;
      const rowsHtml = xs.map(x => {
        const T = [], N = [];
        // today
        if (x.t.hourlyT) T.push(ln(x.hours && Math.abs(x.hours * x.rate - x.t.hourlyT) < 0.5
          ? `${h2(x.hours)} h × ${m2(x.rate)} = <b>${m2(x.t.hourlyT)}</b>` : `wage <b>${m2(x.t.hourlyT)}</b>`));
        const dl = v => h2(v) + (Math.abs(v - 1) < 0.001 ? " day" : " days");
        const dayTxt = x.dayRow ? (Math.abs(x.days * x.rate - num(x.r["Salary"])) < 1 ? `${dl(x.days)} × ${m2(x.rate)} = ${m2(num(x.r["Salary"]))}` : `day pay ${m2(num(x.r["Salary"]))}`) : "";
        if (x.dayRow) T.push(ln(`${dayTxt} — by the day, left out`, "cpc-sub"));
        if (!x.T && !x.dayRow) T.push(ln("nothing in the comparison", "cpc-sub"));
        T.push(ln(`= ${m2(x.T)}`, "cpc-tot"));
        if (x.shown && Math.abs(x.shown - x.hours) >= 0.01 && x.hours) T.push(ln(`the sheet shows ${h2(x.shown)} h`, "cpc-sub"));
        // the plan
        if (x.newRate != null && x.hours) N.push(ln(`${h2(x.hours)} h × ${m2(x.newRate)} = <b>${m2(x.n.hourlyN)}</b>`));
        else if (x.n.hourlyN) N.push(ln(`wage kept as paid <b>${m2(x.n.hourlyN)}</b>`));
        if (x.dayRow) N.push(ln("same day pay as today — left out", "cpc-sub"));
        if (x.n.poolN) N.push(ln(`+ ${m2(x.n.poolN)} packing pool (${shareTxt(x.role === "Driver" ? dShare : 1 - dShare)} of ${num(c.crewPackPct)}% of ${m2(sold)}${x.role === "Helper" && nH > 1 ? ", ÷ " + nH + " helpers" : ""})`));
        if (!x.N && !x.dayRow) N.push(ln("nothing in the comparison", "cpc-sub"));
        N.push(ln(`= ${m2(x.N)}`, "cpc-tot"));
        const d = x.N - x.T;
        return `<tr><td><b>${esc(x.who)}</b><div class="cpc-sub">${esc(x.tier)}${tenureTxt(x.tenure) ? " · " + esc(tenureTxt(x.tenure)) : ""}</div></td>
          <td class="cpc-ln">${T.join("")}</td><td class="cpc-ln">${N.join("")}</td>
          <td class="num ${d > 0.5 ? "cpc-up" : d < -0.5 ? "cpc-down" : ""}">${Math.abs(d) < 0.005 ? "—" : (d > 0 ? "+" : "−") + m2(Math.abs(d))}</td></tr>`;
      }).join("");
      const jT = xs.reduce((a, x) => a + x.T, 0), jN = xs.reduce((a, x) => a + x.N, 0);
      const fms = xs.filter(x => x.role === "Foreman").map(x => {
        const pm = R.people[x.who] && R.people[x.who].months[r0["Month"]], e = pm && pm.elig;
        if (!e) return "";
        return `${esc(x.who)} in ${mlabel(r0["Month"])}: ${e.ok ? `qualifies — ${money(R.ev)} expected for the month` : `does not qualify (${e.shifts} shifts, ${Math.round(e.hours)} h, ${e.jobs} jobs)`}`;
      }).filter(Boolean);
      box.innerHTML = `
        <div class="panel-head"><span class="panel-title">One job, line by line</span><span class="spacer"></span>
          <div class="cpc-jobpick"><input class="cpc-q" id="cpcJobQ" placeholder="Find a job — request #, customer, foreman or date" aria-label="Find a job" autocomplete="off" value="${esc(S.jobQ || "")}">
            <div class="cpc-hits" id="cpcHits"></div></div></div>
        <div class="cpc-jobfacts">
          <span><b>${esc(fmtDay(r0["Date"]))}</b></span><span>request <b>${esc(r0["Request #"] || "—")}</b></span><span>${esc(r0["Customer"] || "")}</span>
          <span>${esc(r0["Moving Type"] || "")}</span><span>crew of <b>${crew}</b></span><span>bill <b>${money(num(r0["Job Bill"]))}</b></span>
          <span><b>${h2(paidH)} h</b> paid to the ${esc(xs[0].role.toLowerCase())}${shownH && Math.abs(shownH - paidH) >= 0.01 ? ` (the sheet shows ${h2(shownH)})` : ""}${trav != null ? ` · ${h2(trav)} h of it travel from the miles lookup` : ""}</span>
          <span>packing sold <b>${money(sold)}</b></span>
        </div>
        <div class="rs-tablewrap"><table class="rs-table cpc-jobt">
          <thead><tr><th>Person</th><th>Today</th><th>New plan</th><th class="num">Difference</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot><tr><td>The job</td><td>${money(jT)}</td><td>${money(jN)}</td><td class="num">${delta(jN, jT)}</td></tr></tfoot>
        </table></div>
        <p class="cpc-note">Tips, stairs, bulky-item pay, the foreman's 20% packing commission and long-distance day pay are left out of both — the plan pays them as today. The foreman bonus is paid per month, not per job${fms.length ? ": " + fms.join("; ") : ""}.</p>`;
      const q = box.querySelector("#cpcJobQ"), hits = box.querySelector("#cpcHits");
      const index = () => R._jobIndex = R._jobIndex || Object.entries(R.byJob).map(([k, ys]) => {
        const a = ys[0].r, fm = (ys.find(y => y.role === "Foreman") || {}).who || "";
        return { k, d: a["Date"], label: `${fmtDay(a["Date"])} · ${a["Request #"] || "—"} · ${a["Customer"] || ""} · ${fm}`,
                 text: [a["Date"], fmtDay(a["Date"]), a["Request #"], a["Customer"], fm, a["Job No"]].join(" ").toLowerCase() };
      }).sort((a, b) => b.d.localeCompare(a.d));
      const find = () => {
        S.jobQ = q.value;
        const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) { hits.innerHTML = ""; return; }
        const found = index().filter(j => words.every(w => j.text.includes(w))).slice(0, 8);
        hits.innerHTML = found.length ? found.map(j => `<button data-uk="${esc(j.k)}">${esc(j.label)}</button>`).join("")
          : `<div class="cpc-nohit">No job matches</div>`;
        hits.querySelectorAll("button[data-uk]").forEach(b => b.onclick = () => { S.job = b.dataset.uk; S.jobQ = ""; paintJob(R, c); });
      };
      q.oninput = find;
      q.onkeydown = e => { if (e.key === "Escape") { q.value = ""; find(); } };
    }

    /* ---------- FOUR SCENARIOS on the same jobs (his ask 2026-10-23) ---------- */
    const SEATS = ["Foreman", "Driver", "Helper"];
    const seatName = s => s === "Foreman" ? "Foremen" : s + "s";
    const ceil$ = v => v > 0 ? Math.ceil(v - 1e-9) : 0;   // his Excel: ROUNDUP(salary, 0)
    const round5 = v => Math.round(v / 5) * 5;
    const pct1 = (a, b) => b ? (a / b * 100).toFixed(1) + "%" : "—";
    // the hours the wage was paid for -- the same rule the drafted plan replays on
    function paidHours(r) {
      const sal = num(r["Salary"]), pack = r["Role"] === "Foreman" ? num(r["Packing Commission"]) : 0;
      const rate = num(r["Rate"]), wage = Math.max(0, sal - pack);
      let h = num(r["Hours"]);
      if (rate > 0 && wage > 0) { const x = wage / rate; if (!h || Math.abs(x - h) < 1) h = x; }
      return h;
    }
    // HIS "TOTAL SPLITABLE BILL" (flat-rate job template, ForFormulas!DG10): the moving fee at the cash
    // price + materials + the fees that count - discounts; a job with no contract falls back to its bill
    function splitOf(r0) {
      const bill = num(r0["Job Bill"]);
      if (r0["Labor Charge"] == null || r0["Labor Charge"] === "") return { v: bill, src: "bill", bill };
      const lab = num(r0["Labor Charge"]), cp = num(r0["Cash Discount Pct"]), pack = num(r0["Packing Charged"]),
            fees = num(r0["Fees Charged"]), disc = num(r0["Discounts"]);
      return { v: Math.max(0, lab * (1 - cp) + pack + fees - disc), src: "contract", lab, cp, pack, fees, disc, bill };
    }
    // the foreman's extra share: XLOOKUP(bill, "Total Bill From", -1) -- the band at or below the bill
    function bandOf(c, v) {
      let best = { from: num(c.pctB1From), pct: num(c.pctB1) };
      for (let i = 1; i <= 6; i++) {
        const f = num(c["pctB" + i + "From"]);
        if (v >= f && f >= best.from) best = { from: f, pct: num(c["pctB" + i]) };
      }
      return best;
    }
    function scenarios(c) {
      const ld = new Set(String(c.ldTypes).split(",").map(x => x.trim()).filter(Boolean));
      const rows = all.filter(r => r["Company"] === COMPANY && r["Date"] >= c.from && r["Date"] <= c.to);
      const jobs = {};
      rows.forEach(r => { const k = r["Unique Key"]; (jobs[k] = jobs[k] || { uk: k, r0: r, rows: [] }).rows.push(r); });
      Object.values(jobs).forEach(j => { j.n = j.rows.length; j.nf = j.rows.filter(x => x["Role"] === "Foreman").length; });
      // ACTUAL: everything paid, per person per job. Stairs, bulky and hoisting/storage/junk pay are
      // split evenly over the crew, the review bonus goes to the foreman -- as the contract pays them.
      const lines = rows.map(r => {
        const j = jobs[r["Unique Key"]], r0 = j.r0, role = r["Role"];
        const pack = role === "Foreman" ? num(r["Packing Commission"]) : 0;
        const a = { wage: Math.max(0, num(r["Salary"]) - pack), pack,
          stairs: num(r0["Stairs Paid"]) / j.n, bulky: num(r0["Bulky Paid"]) / j.n, other: num(r0["Other Extras Paid"]) / j.n,
          review: j.nf ? (role === "Foreman" ? num(r0["Review Paid"]) / j.nf : 0) : num(r0["Review Paid"]) / j.n };
        a.total = a.wage + a.pack + a.stairs + a.bulky + a.other + a.review;
        const dayRow = ld.has(r["Moving Type"]) && role !== "Foreman" && num(r["Rate"]) >= LD_DAY_RATE;
        return { r, j, role, who: r["Person"] || "(no name)", a, T: a.total, tip: num(r["Tip"]),
                 dayRow, days: dayRow ? (num(r["Hours"]) || 1) : 0, hours: dayRow ? 0 : paidHours(r) };
      });
      let revenue = 0;
      Object.values(jobs).forEach(j => { revenue += num(j.r0["Job Bill"]); });
      const A = lines.reduce((s, x) => s + x.T, 0), tips = lines.reduce((s, x) => s + x.tip, 0);
      // % OF BILL (his Excel): one pool per job, the foreman 1 + an extra share, everyone else 1 share
      Object.values(jobs).forEach(j => {
        const s = splitOf(j.r0), b = j.nf ? bandOf(c, s.v) : { from: 0, pct: 0 };
        const d = b.pct / 100, fShare = j.n ? (j.nf + d) / (j.n + d) : 0, oEach = j.n - j.nf ? (1 - fShare) / (j.n - j.nf) : 0;
        // A LONG-DISTANCE JOB HAS ITS OWN POOL % (his pick 2026-10-23): his 30% is the local-job
        // template's, and an LD bill carries the haul -- LD crews earn 14% of it today (Straight 18.8%,
        // Regular 8.7%), so 14% is the default; no bonus pool on them (his call: "having bonus for locals only is enough")
        const isLd = ld.has(j.r0["Moving Type"]), poolPct = isLd ? num(c.pctLd) : num(c.pctPool);
        j.pct = { s, b, d, fShare, oEach, isLd, poolPct, pool: poolPct / 100 * s.v,
                  bonus: isLd ? 0 : num(c.pctBonus) / 100 * s.v * num(c.pctBonusPaid) / 100 };
      });
      lines.forEach(x => {
        const p = x.j.pct, share = x.role === "Foreman" ? p.fShare / Math.max(1, x.j.nf) : p.oEach;
        x.pct = { share, poolRaw: p.pool * share, bonusRaw: p.bonus * share, pool: ceil$(p.pool * share), bonus: ceil$(p.bonus * share) };
        x.pct.total = x.pct.pool + x.pct.bonus;
      });
      // DAILY RATE: one day rate per person per day (a long-distance trip row brings its own days), plus
      // the foreman's % of packing sold; break-even = today's pay per day for the seat, less that packing
      const seen = {};
      lines.forEach(x => {
        const k = x.who + "|" + x.r["Date"];
        x.dayN = x.dayRow ? x.days : (seen[k] ? 0 : 1);
        if (!x.dayRow) seen[k] = true;
        x.dayPack = x.role === "Foreman" ? num(x.r["Packing Sold"]) * num(c.dayPackPct) / 100 / Math.max(1, x.j.nf) : 0;
      });
      const be = {};
      SEATS.forEach(s => {
        const xs = lines.filter(x => x.role === s), d = xs.reduce((a, x) => a + x.dayN, 0);
        be[s] = d ? round5((xs.reduce((a, x) => a + x.T, 0) - xs.reduce((a, x) => a + x.dayPack, 0)) / d) : 0;
      });
      const RK = { Foreman: "dayForeman", Driver: "dayDriver", Helper: "dayHelper" };
      const rateOf = s => { const v = c[RK[s]]; return v === "" || v == null ? (be[s] || 0) : num(v); };
      lines.forEach(x => {
        const rate = rateOf(x.role);
        x.daily = { rate, dayPay: x.dayN * rate, pack: x.dayPack };
        x.daily.total = x.daily.dayPay + x.daily.pack;
      });
      const mk = (key, label, N) => ({ key, label, N, total: lines.reduce((s, x) => s + N(x), 0) });
      const pct = mk("pct", "% of bill", x => x.pct.total);
      const daily = Object.assign(mk("daily", "Daily rate", x => x.daily.total), { be, rateOf });
      // BONUS PLAN: the drafted plan changes the hourly wage, adds the pool and the bonus; everything
      // else is paid as today, so its all-in total is Actual + the plan's own difference
      const R = compute(c);
      const bonus = { key: "bonus", label: "Bonus plan", total: A + R.N(R.tot) - R.T(R.tot) };
      return { c, rows, jobs, lines, revenue, A, tips, pct, daily, bonus };
    }

    function paintStrip(el, SC) {
      const vs = v => { const d = v - SC.A;
        return Math.abs(d) < 0.5 ? "same as actual" : `${d > 0 ? "+" : "−"}${moneyK(Math.abs(d)).replace("−", "")} · ${d > 0 ? "+" : "−"}${Math.abs(d / SC.A * 100).toFixed(1)}%`; };
      const card = (k, l, v, sub) => `<button class="cpc-sc ${S.tab === k ? "on" : ""}" data-sc="${k}"><span>${l}</span><b>${moneyK(v)}</b><em>${sub}</em></button>`;
      el.innerHTML = `<div class="cpc-strip">
        ${card("actual", "Actual", SC.A, SC.revenue ? pct1(SC.A, SC.revenue) + " of bills" : "")}
        ${card("pct", "% of bill", SC.pct.total, vs(SC.pct.total))}
        ${card("bonus", "Bonus plan", SC.bonus.total, vs(SC.bonus.total))}
        ${card("daily", "Daily rate", SC.daily.total, vs(SC.daily.total))}</div>`;
      el.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => { S.tab = b.dataset.sc; paint(); });
    }

    const byKey = (xs, f) => { const o = {}; xs.forEach(x => { const k = f(x); (o[k] = o[k] || []).push(x); }); return o; };
    const sumOf = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
    const mainRoleOf = xs => Object.entries(byKey(xs, x => x.role)).sort((a, b) => b[1].length - a[1].length)[0][0];
    function monthChart(canvas, SC, series) {
      const byM = byKey(SC.lines, x => x.r["Month"]), ms = Object.keys(byM).sort();
      const v2 = RS.isV2 && RS.isV2(), V = RS.V2 || {};
      // two series: Actual pale behind the scenario; one series (Actual alone) in the strong colour
      const colors = series.length > 1 ? [v2 ? V.ctx : "#5c6a7c", v2 ? V.navy : "#b7e23b"] : [v2 ? V.navy : "#5c6a7c"];
      try {
        new Chart(canvas, { type: "bar",
          data: { labels: ms.map(mlabel), datasets: series.map(([l, f], i) => ({ label: l, data: ms.map(m => Math.round(sumOf(byM[m], f))), backgroundColor: colors[i % 2], borderRadius: 4 })) },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" },
            tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.raw) } } }, scales: { y: { ticks: { callback: v => moneyK(v) } } } } });
      } catch (e) { console.warn("crew-pay month chart:", e); }
    }
    function underMin(SC, f) {
      let n = 0, of = 0;
      SC.lines.forEach(x => { if (x.dayRow || !(x.hours > 0)) return; of++; if (f(x) / x.hours < MIN_WAGE) n++; });
      return { n, of };
    }

    /* ACTUAL -- what the crews were paid, every part of it */
    function paintActual(body, c, SC) {
      const L = SC.lines, nj = Object.keys(SC.jobs).length;
      const cov = Object.values(SC.jobs).filter(j => num(j.r0["Has Contract"])).length;
      const PARTS = [
        ["wage", "Wages", "hourly pay — travel from the miles lookup included — or the day pay on a long-distance trip"],
        ["pack", "Packing commission", "the foreman's share of packing materials sold (20% since December 2025)"],
        ["stairs", "Stairs pay", "all of the stairs fee, split over the crew"],
        ["bulky", "Bulky-item pay", "half of the bulky-item fee, split over the crew"],
        ["review", "Review bonus", "the foreman's, per review"],
        ["other", "Hoisting, storage and junk pay", "from the contract, split over the crew"]];
      const hours = sumOf(L, x => x.hours), days = sumOf(L, x => x.days);
      const seats = SEATS.filter(s => L.some(x => x.role === s));
      const people = Object.entries(byKey(L, x => x.who)).map(([who, xs]) => ({ who, xs, T: sumOf(xs, x => x.T),
        wage: sumOf(xs, x => x.a.wage), extra: sumOf(xs, x => x.T - x.a.wage), tip: sumOf(xs, x => x.tip), hours: sumOf(xs, x => x.hours) }))
        .filter(p => !S.q || p.who.toLowerCase().includes(S.q.toLowerCase()))
        .sort((a, b) => S.sort === "name" ? a.who.localeCompare(b.who) : b.T - a.T);
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:4">
          <div class="kpi"><div class="l">Crew pay, the year</div><div class="v">${moneyK(SC.A)}</div><div class="s">every part below · tips apart</div></div>
          <div class="kpi"><div class="l">Share of the bills</div><div class="v">${pct1(SC.A, SC.revenue)}</div><div class="s">of ${moneyK(SC.revenue)} billed on these jobs</div></div>
          <div class="kpi"><div class="l">Per job</div><div class="v">${money(nj ? SC.A / nj : 0)}</div><div class="s">${nj.toLocaleString()} jobs · ${Object.keys(byKey(L, x => x.who)).length} people</div></div>
          <div class="kpi"><div class="l">Tips</div><div class="v">${moneyK(SC.tips)}</div><div class="s">the crew's own · the same in every scenario</div></div>
        </div>
        <section class="panel"><div class="panel-head"><span class="panel-title">What the pay is made of</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Part</th><th>How it is paid today</th><th class="num">The year</th><th class="num">Of the bills</th><th class="num">Of crew pay</th></tr></thead>
            <tbody>${PARTS.map(([k, l, how]) => { const v = sumOf(L, x => x.a[k]);
              return `<tr><td><b>${l}</b></td><td class="cpc-howcell">${how}</td><td class="num">${money(v)}</td><td class="num">${pct1(v, SC.revenue)}</td><td class="num">${pct1(v, SC.A)}</td></tr>`; }).join("")}</tbody>
            <tfoot><tr><td>Crew pay</td><td></td><td class="num">${money(SC.A)}</td><td class="num">${pct1(SC.A, SC.revenue)}</td><td class="num">100%</td></tr></tfoot>
          </table></div>
          <p class="cpc-note">Stairs, bulky-item, hoisting/storage/junk and review pay are known from the digital contract — ${cov.toLocaleString()} of these ${nj.toLocaleString()} jobs have one; the rest show wages and packing only. ${days ? `Long-distance trip pay counts ${+days.toFixed(1)} days paid by the day.` : ""}</p>
        </section>
        <div class="cpc-grid">
          <section class="panel"><div class="panel-head"><span class="panel-title">By seat</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Seat</th><th class="num">People</th><th class="num">Jobs</th><th class="num">Hours paid</th><th class="num">Pay</th><th class="num">Per job</th><th class="num">Per hour</th></tr></thead>
              <tbody>${seats.map(s => { const xs = L.filter(x => x.role === s), h = sumOf(xs, x => x.hours), t = sumOf(xs, x => x.T);
                return `<tr><td><b>${seatName(s)}</b></td><td class="num">${new Set(xs.map(x => x.who)).size}</td><td class="num">${xs.length.toLocaleString()}</td>
                  <td class="num">${Math.round(h).toLocaleString()}</td><td class="num">${money(t)}</td><td class="num">${money(t / xs.length)}</td>
                  <td class="num">${h ? "$" + (sumOf(xs.filter(x => !x.dayRow), x => x.T) / h).toFixed(2) : "—"}</td></tr>`; }).join("")}</tbody>
            </table></div>
            <p class="cpc-note">Per hour is everything a seat was paid on hourly jobs divided by the hours paid — base rate, packing, stairs, bulky and reviews together.</p>
          </section>
          <section class="panel"><div class="panel-head"><span class="panel-title">Month by month</span></div>
            <div class="chartbox" style="height:260px"><canvas id="cpcChart"></canvas></div></section>
        </div>
        <section class="panel">
          <div class="panel-head"><span class="panel-title">Everyone · ${people.length}</span><span class="spacer"></span>
            <input class="cpc-q" id="cpcQ" placeholder="Find a person" value="${esc(S.q)}" aria-label="Find a person"></div>
          <div class="rs-tablewrap" style="max-height:620px"><table class="rs-table rs-sticky">
            <thead><tr><th>Person</th><th>Seat</th><th class="num">Jobs</th><th class="num">Hours</th><th class="num">Wages</th><th class="num">Everything else</th><th class="num">Pay</th><th class="num">Tips</th></tr></thead>
            <tbody>${people.slice(0, 400).map(p => `<tr><td><b>${esc(p.who)}</b></td><td>${esc(mainRoleOf(p.xs))}</td><td class="num">${p.xs.length}</td>
              <td class="num">${Math.round(p.hours).toLocaleString()}</td><td class="num">${money(p.wage)}</td><td class="num">${money(p.extra)}</td>
              <td class="num"><b>${money(p.T)}</b></td><td class="num">${money(p.tip)}</td></tr>`).join("")}</tbody>
          </table></div>
        </section>`;
      monthChart(body.querySelector("#cpcChart"), SC, [["Actual", x => x.T]]);
      const q = body.querySelector("#cpcQ");
      q.oninput = () => { S.q = q.value; const pos = q.selectionStart; paintActual(body, c, SC); const q2 = body.querySelector("#cpcQ"); q2.focus(); q2.setSelectionRange(pos, pos); };
    }

    /* one number box, its unit drawn beside it -- the same box on the levers row and on Settings */
    function box(k, c, o = {}) {
      const u = UNIT[k] || "", pre = u[0] === "$" ? "$" : "", post = u[0] === "$" ? u.slice(1) : u;
      const isDate = k === "from" || k === "to", isText = k === "ldTypes", v = c[k] == null ? "" : c[k];
      const chg = String(v) !== String(PLAN[k]);
      return `<span class="cpc-in${isText ? " wide" : ""}${chg ? " chg" : ""}" ${chg ? `title="default ${esc(dflt(k))}"` : ""}>${pre ? `<i>${pre}</i>` : ""}<input
        data-k="${k}" type="${isDate ? "date" : isText ? "text" : "number"}" ${isDate || isText ? "" : 'step="any" min="0" inputmode="decimal"'}
        value="${esc(String(v))}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""} aria-label="${esc(o.aria || LABELS[k] || k)}" ${saved.can_edit ? "" : "disabled"}>${post ? `<i>${post}</i>` : ""}</span>`;
    }
    const dflt = k => { const u = UNIT[k] || "", v = PLAN[k];
      return v === "" ? "break-even" : (u[0] === "$" ? "$" + v : v + (u === "%" ? "%" : u ? " " + u : "")); };
    // a labelled box, with the default named once it has been changed
    const field = (k, c, o = {}) => `<label class="cpc-f"><span>${o.label || LABELS[k]}</span>${box(k, c, o)}
      <em>${String(c[k] == null ? "" : c[k]) !== String(PLAN[k]) ? "default " + esc(dflt(k)) : ""}</em></label>`;
    // Discard / Save: one draft for the whole page, whichever tab it was changed on; shown once there is one
    function actions() {
      if (!saved.can_edit || !S.draft) return "";
      return `<button class="btn" data-act="discard">Discard changes</button><button class="btn brand" data-act="save">Save for everyone</button>`;
    }
    function wireInputs(scope) {
      scope.querySelectorAll("input[data-k]").forEach(inp => inp.onchange = () => {
        const k = inp.dataset.k;
        // an emptied day rate goes back to break-even; any other emptied number is 0
        const v = inp.type !== "number" ? inp.value : inp.value === "" ? (PLAN[k] === "" ? "" : 0) : +inp.value;
        S.draft = Object.assign({}, cfg(), { [k]: v });
        paint();
      });
      const act = a => scope.querySelector(`[data-act="${a}"]`);
      if (act("discard")) act("discard").onclick = () => { S.draft = null; paint(); };
      if (act("save")) act("save").onclick = () => saveDraft(act("save"));
      if (act("reset")) act("reset").onclick = () => { S.draft = Object.assign({}, PLAN); paint(); };
      scope.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { S.tab = b.dataset.go; paint(); });
    }
    // the scenario tab's main numbers, in one row above it
    function paintLevers(el, c, SC) {
      const keys = LEVERS[S.tab];
      if (!keys) { el.innerHTML = ""; return; }
      const be = SC.daily.be, seatOf = { dayForeman: "Foreman", dayDriver: "Driver", dayHelper: "Helper" };
      const rule = {
        pct: `${num(c.pctPool)}% of the splitable bill + a ${num(c.pctBonus)}% bonus pool on local jobs, split in shares — the foreman's extra share grows with the bill. Long distance: ${num(c.pctLd)}% of the bill, no bonus.`,
        bonus: `One hourly rate per seat by tenure, a ${num(c.crewPackPct)}% packing pool for drivers and helpers, and a monthly foreman bonus.`,
        daily: `One rate per person per day, plus the foreman's ${num(c.dayPackPct)}% of packing sold. An empty rate is break-even, rounded to $5.`,
      }[S.tab];
      el.innerHTML = `<section class="cpc-levers">
          <div class="cpc-lvrow">${keys.map(k => `<label class="cpc-lv"><span>${SHORT[k]}</span>${box(k, c, { ph: seatOf[k] ? String(be[seatOf[k]] || 0) : "" })}</label>`).join("")}</div>
          <div class="cpc-lvside">${actions()}<button class="btn" data-go="settings">All settings</button></div>
          <p class="cpc-note">${rule}</p></section>`;
      wireInputs(el);
    }
    async function saveDraft(b) {
      b.disabled = true; b.textContent = "Saving…";
      try {
        const r = await fetch(ZTZ.API + "/api/_gset", { method: "POST",
          headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
          body: JSON.stringify({ name: "crew_pay_plan", value: S.draft }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || ("HTTP " + r.status));
        saved = Object.assign(saved, { value: S.draft, at: new Date().toISOString().replace("T", " "), by: ZTZ.email() });
        Object.assign(savedSet, PLAN, S.draft);
        S.draft = null;
        paint();
      } catch (e) {
        b.disabled = false; b.textContent = "Save for everyone";
        alert("Could not save: " + e.message);
      }
    }

    /* % OF BILL and DAILY RATE -- each against Actual, on the same jobs */
    function paintScenario(body, c, SC, P) {
      const L = SC.lines, N = P.N, tot = P.total, d = tot - SC.A;
      const um = underMin(SC, N), umT = underMin(SC, x => x.T);
      const seats = SEATS.filter(s => L.some(x => x.role === s));
      const people = Object.entries(byKey(L, x => x.who)).map(([who, xs]) => ({ who, xs, T: sumOf(xs, x => x.T), N: sumOf(xs, N) }))
        .filter(p => !S.q || p.who.toLowerCase().includes(S.q.toLowerCase()))
        .sort((a, b) => S.sort === "name" ? a.who.localeCompare(b.who) : (b.N - b.T) - (a.N - a.T));
      const extra = P.key === "pct"
        ? `<div class="kpi"><div class="l">Of it, the bonus pool</div><div class="v">${moneyK(sumOf(L, x => x.pct.bonus))}</div><div class="s">${num(c.pctBonus)}% · ${num(c.pctBonusPaid)}% paid out</div></div>`
        : `<div class="kpi"><div class="l">Day rates</div><div class="v cpc-rates">${SEATS.map(s => "$" + P.rateOf(s)).join(" · ")}</div><div class="s">foreman · driver · helper</div></div>`;
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:5">
          <div class="kpi"><div class="l">${esc(P.label)}, the year</div><div class="v">${moneyK(tot)}</div><div class="s">tips apart, as in Actual</div></div>
          <div class="kpi cpc-kd"><div class="l">Against Actual</div><div class="v">${d >= 0 ? "+" : "−"}${moneyK(Math.abs(d)).replace("−", "")}</div><div class="s">${delta(tot, SC.A)}</div></div>
          <div class="kpi"><div class="l">Share of the bills</div><div class="v">${pct1(SC.A, SC.revenue)} → ${pct1(tot, SC.revenue)}</div><div class="s">actual → ${esc(P.label.toLowerCase())}</div></div>
          ${extra}
          <div class="kpi"><div class="l">Under minimum wage</div><div class="v">${um.n.toLocaleString()}</div><div class="s">crew-days under $${MIN_WAGE} per paid hour · today ${umT.n.toLocaleString()} of ${um.of.toLocaleString()}</div></div>
        </div>
        <div class="cpc-grid">
          <section class="panel"><div class="panel-head"><span class="panel-title">By seat</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Seat</th><th class="num">Actual</th><th class="num">${esc(P.label)}</th><th class="num">Difference</th><th class="num">Per job, actual → new</th></tr></thead>
              <tbody>${seats.map(s => { const xs = L.filter(x => x.role === s), t = sumOf(xs, x => x.T), n = sumOf(xs, N);
                return `<tr><td><b>${seatName(s)}</b></td><td class="num">${money(t)}</td><td class="num">${money(n)}</td><td class="num">${delta(n, t)}</td>
                  <td class="num">${money(t / xs.length)} → ${money(n / xs.length)}</td></tr>`; }).join("")}</tbody>
            </table></div></section>
          <section class="panel"><div class="panel-head"><span class="panel-title">Month by month</span></div>
            <div class="chartbox" style="height:260px"><canvas id="cpcChart"></canvas></div></section>
        </div>
        <section class="panel cpc-job" id="cpcJob2"></section>
        <section class="panel">
          <div class="panel-head"><span class="panel-title">Everyone · ${people.length}</span><span class="spacer"></span>
            <input class="cpc-q" id="cpcQ" placeholder="Find a person" value="${esc(S.q)}" aria-label="Find a person"></div>
          <div class="rs-tablewrap" style="max-height:620px"><table class="rs-table rs-sticky">
            <thead><tr><th>Person</th><th>Seat</th><th class="num">Jobs</th><th class="num">Actual</th><th class="num">${esc(P.label)}</th><th class="num">Difference</th></tr></thead>
            <tbody>${people.slice(0, 400).map(p => `<tr><td><b>${esc(p.who)}</b></td><td>${esc(mainRoleOf(p.xs))}</td><td class="num">${p.xs.length}</td>
              <td class="num">${money(p.T)}</td><td class="num">${money(p.N)}</td><td class="num">${delta(p.N, p.T)}</td></tr>`).join("")}</tbody>
          </table></div>
        </section>
        <section class="panel cpc-how"><div class="panel-head"><span class="panel-title">How this is counted</span></div><ul>
          <li><b>Actual</b> is everything paid on these jobs — wages, the foreman's packing commission, stairs, bulky-item, hoisting/storage/junk pay and review bonuses. Tips are the crew's in every scenario and sit apart.</li>
          ${P.key === "pct" ? `<li><b>Splitable bill</b> comes from the digital contract; ${Object.values(SC.jobs).filter(j => j.pct.s.src === "bill").length.toLocaleString()} of ${Object.keys(SC.jobs).length.toLocaleString()} jobs have none and use the closing's bill instead.</li>
          <li><b>No hourly floor</b> (your call): a long job with a small bill can pay under the minimum wage for the hours worked — the count is above. Hours here are the hours paid today, travel included.</li>`
          : `<li><b>A day</b> is one person on one date: a second job the same day adds nothing; a long-distance trip row pays its own days. Break-even rates make the year cost what it costs today.</li>
          <li><b>Long days</b> earn the same as short ones — the minimum-wage count above shows where a day rate falls under $${MIN_WAGE} an hour.</li>`}
        </ul></section>`;
      monthChart(body.querySelector("#cpcChart"), SC, [["Actual", x => x.T], [P.label, N]]);
      paintJob2(body.querySelector("#cpcJob2"), SC, P, c);
      const q = body.querySelector("#cpcQ");
      q.oninput = () => { S.q = q.value; const pos = q.selectionStart; paintScenario(body, c, SC, P); const q2 = body.querySelector("#cpcQ"); q2.focus(); q2.setSelectionRange(pos, pos); };
    }

    /* one job, line by line, in a scenario tab */
    function typicalJob2(SC) {
      let best = null, bestD = "";
      Object.values(SC.jobs).forEach(j => {
        const d = j.r0["Date"];
        if (d <= bestD || j.pct.s.src !== "contract" || j.nf !== 1 || j.n < 3 || j.n > 4 || !(num(j.r0["Packing Sold"]) > 0)) return;
        best = j.uk; bestD = d;
      });
      return best || Object.keys(SC.jobs)[0];
    }
    function paintJob2(box, SC, P, c) {
      if (!box) return;
      const uk = S.job && SC.jobs[S.job] ? S.job : typicalJob2(SC), j = SC.jobs[uk];
      if (!j) { box.innerHTML = ""; return; }
      const xs = SC.lines.filter(x => x.j === j).sort((a, b) => SEATS.indexOf(a.role) - SEATS.indexOf(b.role));
      const r0 = j.r0, p = j.pct, s = p.s, ln = (txt, cls) => `<div class="${cls || ""}">${txt}</div>`;
      const todayLines = x => {
        const T = [];
        [["wage", x.dayRow ? "day pay" : "wage"], ["pack", "packing commission"], ["stairs", "stairs"], ["bulky", "bulky items"], ["review", "review bonus"], ["other", "hoisting, storage, junk"]]
          .forEach(([k, l], i) => { if (x.a[k] > 0.004) T.push(ln(`${i ? "+ " : ""}${m2(x.a[k])} ${l}`)); });
        if (!T.length) T.push(ln("nothing paid", "cpc-sub"));
        T.push(ln(`= ${m2(x.T)}`, "cpc-tot"));
        return T.join("");
      };
      const newLines = x => {
        const L2 = [];
        if (P.key === "pct") {
          L2.push(ln(`${p.poolPct}%${p.isLd ? " (long distance)" : ""} × ${m2(s.v)} × ${(x.pct.share * 100).toFixed(1)}% = ${m2(x.pct.poolRaw)} → <b>${m2(x.pct.pool)}</b>`));
          if (x.pct.bonusRaw > 0) L2.push(ln(`+ bonus ${num(c.pctBonus)}%${num(c.pctBonusPaid) !== 100 ? " × " + num(c.pctBonusPaid) + "% paid" : ""} × ${(x.pct.share * 100).toFixed(1)}% → <b>${m2(x.pct.bonus)}</b>`));
          L2.push(ln(`= ${m2(x.pct.total)}`, "cpc-tot"));
        } else {
          L2.push(ln(x.daily.dayPay > 0 ? `${h2(x.dayN)} ${x.dayN === 1 ? "day" : "days"} × ${m2(x.daily.rate)} = <b>${m2(x.daily.dayPay)}</b>`
            : `another job the same day — the day is paid once`, x.daily.dayPay > 0 ? "" : "cpc-sub"));
          if (x.daily.pack > 0) L2.push(ln(`+ ${num(c.dayPackPct)}% of ${m2(num(r0["Packing Sold"]))} packing = <b>${m2(x.daily.pack)}</b>`));
          L2.push(ln(`= ${m2(x.daily.total)}`, "cpc-tot"));
        }
        return L2.join("");
      };
      const facts = P.key === "pct"
        ? (s.src === "contract"
          ? `splitable bill: moving fee ${m2(s.lab)}${s.cp ? ` at the cash price (−${+(s.cp * 100).toFixed(2)}%) ${m2(s.lab * (1 - s.cp))}` : ""} + packing ${m2(s.pack)} + fees ${m2(s.fees)} − discounts ${m2(s.disc)} = <b>${m2(s.v)}</b>`
          : `no contract — the closing's bill <b>${m2(s.v)}</b> is split`)
          + ` · bill from ${money(p.b.from)} → foreman extra ${p.b.pct}%: the foreman ${(p.fShare * 100).toFixed(1)}%${j.n - j.nf ? `, everyone else ${(p.oEach * 100).toFixed(1)}% each` : ""}`
        : `day rates: foreman $${P.rateOf("Foreman")}, driver $${P.rateOf("Driver")}, helper $${P.rateOf("Helper")}`;
      const jT = sumOf(xs, x => x.T), jN = sumOf(xs, P.N);
      box.innerHTML = `
        <div class="panel-head"><span class="panel-title">One job, line by line</span><span class="spacer"></span>
          <div class="cpc-jobpick"><input class="cpc-q" id="cpcJobQ2" placeholder="Find a job — request #, customer, foreman or date" aria-label="Find a job" autocomplete="off" value="${esc(S.jobQ || "")}">
            <div class="cpc-hits" id="cpcHits2"></div></div></div>
        <div class="cpc-jobfacts"><span><b>${esc(fmtDay(r0["Date"]))}</b></span><span>request <b>${esc(r0["Request #"] || "—")}</b></span>
          <span>${esc(r0["Customer"] || "")}</span><span>${esc(r0["Moving Type"] || "")}${r0["Job Type"] ? " · " + esc(String(r0["Job Type"]).toLowerCase()) : ""}</span>
          <span>crew of <b>${j.n}</b></span><span>bill <b>${money(num(r0["Job Bill"]))}</b></span><span>packing sold <b>${money(num(r0["Packing Sold"]))}</b></span></div>
        <p class="cpc-note cpc-jobrule">${facts}</p>
        <div class="rs-tablewrap"><table class="rs-table cpc-jobt">
          <thead><tr><th>Person</th><th>Actual</th><th>${esc(P.label)}</th><th class="num">Difference</th></tr></thead>
          <tbody>${xs.map(x => { const dd = P.N(x) - x.T;
            return `<tr><td><b>${esc(x.who)}</b><div class="cpc-sub">${esc(x.role)}${x.hours ? " · " + h2(x.hours) + " h paid" : ""}</div></td>
              <td class="cpc-ln">${todayLines(x)}</td><td class="cpc-ln">${newLines(x)}</td>
              <td class="num ${dd > 0.5 ? "cpc-up" : dd < -0.5 ? "cpc-down" : ""}">${Math.abs(dd) < 0.005 ? "—" : (dd > 0 ? "+" : "−") + m2(Math.abs(dd))}</td></tr>`; }).join("")}</tbody>
          <tfoot><tr><td>The job</td><td>${money(jT)}</td><td>${money(jN)}</td><td class="num">${delta(jN, jT)}</td></tr></tfoot>
        </table></div>
        <p class="cpc-note">Tips are the crew's in both and left out.</p>`;
      const q = box.querySelector("#cpcJobQ2"), hits = box.querySelector("#cpcHits2");
      const index = () => SC._jobIndex = SC._jobIndex || Object.values(SC.jobs).map(jj => {
        const a = jj.r0, fm = (jj.rows.find(y => y["Role"] === "Foreman") || {})["Person"] || "";
        return { k: jj.uk, d: a["Date"], label: `${fmtDay(a["Date"])} · ${a["Request #"] || "—"} · ${a["Customer"] || ""} · ${fm}`,
                 text: [a["Date"], fmtDay(a["Date"]), a["Request #"], a["Customer"], fm, a["Job No"]].join(" ").toLowerCase() };
      }).sort((a, b) => b.d.localeCompare(a.d));
      const find = () => {
        S.jobQ = q.value;
        const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) { hits.innerHTML = ""; return; }
        const found = index().filter(jj => words.every(w => jj.text.includes(w))).slice(0, 8);
        hits.innerHTML = found.length ? found.map(jj => `<button data-uk="${esc(jj.k)}">${esc(jj.label)}</button>`).join("") : `<div class="cpc-nohit">No job matches</div>`;
        hits.querySelectorAll("button[data-uk]").forEach(b => b.onclick = () => { S.job = b.dataset.uk; S.jobQ = ""; paintJob2(box, SC, P, c); });
      };
      q.oninput = find;
      q.onkeydown = e => { if (e.key === "Escape") { q.value = ""; find(); } };
    }

    function openPerson(R, who) {
      const p = R.people[who];
      if (!p) return;
      const ms = Object.keys(p.months).sort();
      const dim = document.createElement("div");
      dim.className = "cpc-dim";
      dim.innerHTML = `<aside class="cpc-sheet" role="dialog" aria-label="${esc(who)}">
        <div class="cpc-sh-head"><div><div class="cpc-sub">${esc(p.tier || "")} · ${p.jobs} jobs · ${Math.round(p.hours).toLocaleString()} hours</div>
          <h2>${esc(who)}</h2></div><button class="cpc-x" aria-label="Close">×</button></div>
        <div class="cpc-sh-sum"><div><span>Today</span><b>${money(R.T(p))}</b></div><div><span>New plan</span><b>${money(R.N(p))}</b></div>
          <div><span>Difference</span><b>${delta(R.N(p), R.T(p))}</b></div><div><span>Tips</span><b>${money(p.tips)}</b></div></div>
        <div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Month</th><th class="num">Jobs</th><th class="num">Today</th><th class="num">New plan</th><th>Foreman bonus</th></tr></thead>
          <tbody>${ms.map(m => { const x = p.months[m], e = x.elig;
            return `<tr><td>${mlabel(m)}</td><td class="num">${x.jobs}</td><td class="num">${money(x.t)}</td><td class="num">${money(x.n)}</td>
              <td>${!e ? '<span class="cpc-sub">not a foreman this month</span>'
                : e.ok ? `<span class="rs-pill ok">Eligible · ${money(x.bonus)}</span>`
                : `<span class="rs-pill mute">Not eligible</span> <span class="cpc-sub">${e.shifts} shifts · ${Math.round(e.hours)} h · ${e.jobs} jobs</span>`}</td></tr>`; }).join("")}</tbody>
        </table></div></aside>`;
      document.body.appendChild(dim);
      const close = () => { dim.remove(); document.removeEventListener("keydown", onKey); };
      const onKey = e => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", onKey);
      dim.addEventListener("click", e => { if (e.target === dim) close(); });
      dim.querySelector(".cpc-x").onclick = close;
    }

    /* SETTINGS -- every rule of every scenario on its own tab (his ask 2026-10-23: "This is something we
       should have in settings ... it should be properly formatted"). The bill bands and the bonus bands
       are tables; everything else is a labelled box with its unit. */
    function paintSettings(body, c, SC) {
      const shareSum = num(c.band1Share) + num(c.band2Share) + num(c.band3Share) + num(c.band0Share);
      const froms = [1, 2, 3, 4, 5, 6].map(i => num(c["pctB" + i + "From"]));
      const rising = froms.every((f, i) => !i || f > froms[i - 1]);
      const sec = (title, help, inner) => `<section class="panel cpc-set"><div class="panel-head"><span class="panel-title">${title}</span></div>
          ${help ? `<p class="cpc-note">${help}</p>` : ""}${inner}</section>`;
      const fields = (keys, o = {}) => `<div class="cpc-fields">${keys.map(k => field(k, c, o[k])).join("")}</div>`;
      // the foreman's part of the pool in a crew of n: (1 + extra) / (n + extra), his Excel's "Forman %"
      const fPart = (n, d) => ((1 + d) / (n + d) * 100).toFixed(1) + "%";
      const bandRows = [1, 2, 3, 4, 5, 6].map(i => {
        const d = num(c["pctB" + i]) / 100, next = i < 6 ? froms[i] : null;
        return `<tr><td>${box("pctB" + i + "From", c, { aria: "Band " + i + ": bill from" })}</td>
          <td class="cpc-sub">${next != null && next > froms[i - 1] ? "under " + money(next) : "and up"}</td>
          <td>${box("pctB" + i, c, { aria: "Band " + i + ": foreman's extra share" })}</td>
          ${[3, 4, 5].map(n => `<td class="num">${fPart(n, d)}</td>`).join("")}</tr>`;
      }).join("");
      const BANDS = [["Top", "90–100", "band1Amt", "band1Share"], ["Second", "80–89", "band2Amt", "band2Share"],
                     ["Third", "70–79", "band3Amt", "band3Share"], ["None", "below 70", null, "band0Share"]];
      const ev = (num(c.band1Amt) * num(c.band1Share) + num(c.band2Amt) * num(c.band2Share) + num(c.band3Amt) * num(c.band3Share)) / 100;
      const bonusRows = BANDS.map(([n, sc, a, sh]) => `<tr><td><b>${n}</b> <span class="cpc-sub">score ${sc}</span></td>
          <td>${a ? box(a, c, { aria: n + " band: $ a month" }) : `<span class="cpc-sub">nothing</span>`}</td>
          <td>${box(sh, c, { aria: n + " band: share of eligible months" })}</td></tr>`).join("");
      const ld = esc(String(c.ldTypes).replace(/,/g, ", "));
      body.innerHTML = `
        <div class="cpc-setbar">
          <div class="cpc-sub">${saved.at ? "Saved " + esc(String(saved.at).slice(0, 16)) + (saved.by ? " by " + esc(saved.by) : "") : "Using the default numbers — nothing saved yet."}
            ${saved.can_edit ? "" : " · Only an admin can change these."}</div>
          <span class="spacer"></span>
          ${saved.can_edit ? `<button class="btn" data-act="reset">Reset to defaults</button>${actions()}` : ""}
        </div>
        ${S.draft ? `<div class="cpc-warn">Unsaved — every tab already shows these numbers; Save to make them everyone's.</div>` : ""}
        ${rising ? "" : `<div class="cpc-warn">The bill bands should rise from top to bottom — each "bill from" above the one before.</div>`}
        ${shareSum !== 100 ? `<div class="cpc-warn">The four bonus-band shares add up to ${shareSum}%, not 100%.</div>` : ""}

        <h2 class="cpc-seth">Every scenario</h2>
        <div class="cpc-sets">
          ${sec("Period", "The year being replayed, by job date.", fields(["from", "to"]))}
          ${sec("Long distance", "Jobs of these moving types, comma separated. On % of bill they have their own pool and no bonus; on Daily rate a trip row pays its own days; the Bonus plan leaves out their day-rate drivers and helpers.", fields(["ldTypes"]))}
        </div>

        <h2 class="cpc-seth">% of bill</h2>
        <div class="cpc-sets">
          ${sec("Pools", `One pool per job: the salary pool, plus on local jobs a bonus pool that is cut when something goes wrong (the paid-out % is what this replay pays of it). The splitable bill is the moving fee at the cash price, plus packing materials and the fees, less discounts — the service fee and waiting time stay out. Long-distance jobs (${ld}) use their own pool on the whole bill, as their bill carries the haul. Each salary is rounded up to the dollar; tips stay with the crew.`,
            fields(["pctPool", "pctBonus", "pctBonusPaid", "pctLd"]))}
          ${sec("Foreman's extra share", "The foreman takes 1 share + the extra share for the job's splitable bill; the driver and every helper take 1 share each. The last three columns show what that makes the foreman's part of the pool.",
            `<div class="rs-tablewrap"><table class="rs-table cpc-bandt">
              <thead><tr><th>Bill from</th><th></th><th>Extra share</th><th class="num">Crew of 3</th><th class="num">Crew of 4</th><th class="num">Crew of 5</th></tr></thead>
              <tbody>${bandRows}</tbody></table></div>`)}
        </div>

        <h2 class="cpc-seth">Daily rate</h2>
        <div class="cpc-sets">
          ${sec("Day rates", `One rate per person per day — a second job the same day adds no day. An empty rate is break-even: today's pay per day for the seat, less the packing below, rounded to $5 (now foreman $${SC.daily.be.Foreman || 0}, driver $${SC.daily.be.Driver || 0}, helper $${SC.daily.be.Helper || 0}).`,
            fields(["dayForeman", "dayDriver", "dayHelper"], { dayForeman: { ph: String(SC.daily.be.Foreman || 0) }, dayDriver: { ph: String(SC.daily.be.Driver || 0) }, dayHelper: { ph: String(SC.daily.be.Helper || 0) } }))}
          ${sec("Packing", "The foreman keeps a % of packing sold, so selling it still pays. Nothing else is paid on top: stairs, bulky items, reviews and the rest stay with the company.", fields(["dayPackPct"]))}
        </div>

        <h2 class="cpc-seth">Bonus plan</h2>
        <div class="cpc-sets">
          ${GROUPS.map(([title, help, keys]) => sec(title, help, fields(keys))).join("")}
          ${sec("Foreman bonus — bands", "This year's scores can't decide the band (the manager-assessed half exists for 14 of 231 foreman-months), so set how qualifying months spread across the bands.",
            `<div class="rs-tablewrap"><table class="rs-table cpc-bandt">
              <thead><tr><th>Band</th><th>A month</th><th>Of qualifying months</th></tr></thead>
              <tbody>${bonusRows}</tbody>
              <tfoot><tr><td>Expected a month</td><td>${money(ev)}</td><td>${shareSum}%</td></tr></tfoot></table></div>`)}
        </div>`;
      wireInputs(body);
    }

    function injectCss() {
      if (document.getElementById("cpc-css")) return;
      const s = document.createElement("style"); s.id = "cpc-css";
      s.textContent = `
        .cpc-tabs{margin-bottom:16px}
        .cpc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:16px}
        @media(max-width:1200px){.cpc-grid{grid-template-columns:1fr}}
        .cpc-grid>*{min-width:0}
        .cpc-sub{font-size:12px;color:var(--faint);font-weight:400}
        .cpc-note{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.5}
        .cpc-up,.cpc-down,.cpc-flat{white-space:nowrap}
        .cpc-up{color:var(--ink);font-weight:600}
        .cpc-down{color:var(--ink);font-weight:600}
        .cpc-flat{color:var(--faint)}
        .cpc-kd .v{color:var(--ink)}
        .cpc-barcell{width:110px}
        .cpc-parts td:first-child{min-width:230px}
        .cpc-bar{display:block;height:8px;border-radius:4px;min-width:2px}
        .cpc-bar.pos{background:var(--brand)}
        .cpc-bar.neg{background:var(--faint)}
        .cpc-q{font:inherit;font-size:13px;border:1px solid var(--line-2);border-radius:999px;padding:7px 14px;background:var(--panel);color:var(--ink);min-width:200px}
        .cpc-sort{margin-left:8px}
        .cpc-how ul{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6}
        .cpc-how b{color:var(--ink)}
        .cpc-setbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
        .cpc-warn{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:12px}
        .cpc-sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(420px,100%),1fr));gap:16px}
        .cpc-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:12px}
        .cpc-f{display:flex;flex-direction:column;align-items:flex-start;gap:5px}
        .cpc-f>span{font-size:12.5px;color:var(--muted)}
        .cpc-f em{font-style:normal;font-size:11.5px;color:var(--warn);min-height:14px}
        .cpc-in{display:inline-flex;align-items:center;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);overflow:hidden}
        .cpc-in:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}
        .cpc-in.chg{border-color:var(--warn)}
        .cpc-in i{font-style:normal;font-size:13px;color:var(--faint);padding:0 9px;white-space:nowrap}
        .cpc-in i:first-child{padding-right:0}
        .cpc-in i:last-child{padding-left:0}
        .cpc-in input{font:inherit;font-size:14px;border:0;outline:none;background:transparent;color:var(--ink);padding:7px 8px;width:74px;min-width:0;text-align:right;font-variant-numeric:tabular-nums}
        .cpc-in input[type=date]{width:150px;text-align:left}
        .cpc-in.wide{align-self:stretch}
        .cpc-in.wide input{width:100%;text-align:left}
        .cpc-in input:disabled{color:var(--muted)}
        .cpc-in input[type=number]{-moz-appearance:textfield;appearance:textfield}
        .cpc-in input::-webkit-inner-spin-button,.cpc-in input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}
        .cpc-dim{position:fixed;inset:0;z-index:80;background:var(--scrim,rgba(10,14,20,.5))}
        .cpc-sheet{position:absolute;top:0;right:0;bottom:0;width:min(720px,100%);background:var(--panel);overflow:auto;padding:20px 24px;box-shadow:-12px 0 40px rgba(0,0,0,.2)}
        .cpc-sh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
        .cpc-sh-head h2{margin:4px 0 0;font-size:22px;color:var(--ink)}
        .cpc-x{width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);font-size:18px;cursor:pointer}
        .cpc-sh-sum{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:10px;overflow:hidden;margin:16px 0}
        .cpc-sh-sum>div{background:var(--panel);padding:10px 12px;display:flex;flex-direction:column;gap:2px}
        .cpc-sh-sum span{font-size:12px;color:var(--faint)}
        .cpc-sh-sum b{font-size:15px;color:var(--ink);font-variant-numeric:tabular-nums}
        .cpc-walk .panel-head{flex-wrap:wrap;gap:4px 12px}
        .cpc-wfbox{height:300px;margin:6px 0 14px}
        .cpc-stepn{width:28px;color:var(--faint);font-variant-numeric:tabular-nums;text-align:center}
        .cpc-howcell{font-size:12.5px;color:var(--muted);line-height:1.5;min-width:300px;max-width:560px}
        .cpc-totrow td{background:var(--panel2,transparent)}
        .cpc-job .panel-head{flex-wrap:wrap;gap:8px}
        .cpc-jobpick{position:relative}
        .cpc-jobpick .cpc-q{min-width:min(340px,80vw)}
        .cpc-hits{position:absolute;right:0;top:calc(100% + 4px);z-index:6;width:min(520px,90vw);background:var(--panel);border:1px solid var(--line-2);border-radius:10px;box-shadow:0 10px 28px rgba(15,23,42,.14);overflow:hidden}
        .cpc-hits:empty{display:none}
        .cpc-hits button{display:block;width:100%;text-align:left;padding:9px 14px;border:0;border-bottom:1px solid var(--line);background:var(--panel);font:inherit;font-size:13px;color:var(--ink);cursor:pointer}
        .cpc-hits button:last-child{border-bottom:0}
        .cpc-hits button:hover{background:var(--line)}
        .cpc-nohit{padding:10px 14px;font-size:13px;color:var(--faint)}
        .cpc-jobfacts{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--muted);margin:2px 0 12px}
        .cpc-jobfacts b{color:var(--ink)}
        .cpc-jobt td{vertical-align:top}
        .cpc-jobt td:first-child{min-width:190px}
        .cpc-ln{font-size:13px;line-height:1.65;color:var(--muted);font-variant-numeric:tabular-nums;min-width:240px}
        .cpc-ln b{color:var(--ink)}
        .cpc-ln .cpc-tot{color:var(--ink);font-weight:700;border-top:1px solid var(--line);margin-top:4px;padding-top:3px}
        .cpc-unsaved{align-self:center;margin-left:8px;color:var(--warn)}
        .cpc-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:0 0 16px}
        @media(max-width:900px){.cpc-strip{grid-template-columns:repeat(2,minmax(0,1fr))}}
        .cpc-sc{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;font:inherit;cursor:pointer;
          background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 14px;color:var(--ink)}
        .cpc-sc:hover{border-color:var(--line-2)}
        .cpc-sc.on{border:2px solid var(--brand);padding:9px 13px}
        .cpc-sc span{font-size:12.5px;color:var(--muted);font-weight:600}
        .cpc-sc b{font-size:22px;font-variant-numeric:tabular-nums}
        .cpc-sc em{font-style:normal;font-size:12px;color:var(--faint)}
        .cpc-tabs .rs-tab[data-tab="settings"],.cpc-tabs .cpc-unsaved{margin-left:auto}
        .cpc-tabs .cpc-unsaved+.rs-tab{margin-left:0}
        .cpc-levers{display:flex;flex-wrap:wrap;align-items:flex-end;gap:10px 16px;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 16px}
        .cpc-lvrow{display:flex;flex-wrap:wrap;gap:10px 14px}
        .cpc-lv{display:flex;flex-direction:column;gap:4px}
        .cpc-lv>span{font-size:12px;color:var(--muted);font-weight:600}
        .cpc-lvside{display:flex;flex-wrap:wrap;gap:8px;margin-left:auto}
        .cpc-levers .cpc-note{flex-basis:100%;margin:0}
        .cpc-seth{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:22px 0 10px}
        .cpc-set .cpc-fields{margin-top:12px}
        .cpc-bandt{margin-top:10px}
        .cpc .cpc-bandt th,.cpc .cpc-bandt td{padding:6px 8px;vertical-align:middle}
        .cpc-bandt .cpc-sub{white-space:nowrap}
        .cpc-bandt .cpc-in input{width:62px}
        .cpc-rates{font-size:18px}
        .cpc-jobrule{margin:0 0 10px}
      `;
      document.head.appendChild(s);
    }

    paint();
  },
});
