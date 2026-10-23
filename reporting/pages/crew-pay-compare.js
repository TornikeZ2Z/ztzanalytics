/* Crew Salary Reconciliation (Different Analysis; "Crew Salary Comparison" until 2026-10-23, his ask 2026-10-06).

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
   RECONCILIATION (his ask 2026-10-23, the page renamed): every model's tab has ONE layout -- how pay
   works in it (written from the numbers in force), the year against Actual, what each seat earns on an
   average DAY (his pick; no list of people), what the pay is made of, month by month, one job line by
   line and the revenue that keeps this year's profit. The Bonus plan is replayed job by job like the
   others (its monthly foreman bonus spread over the month's jobs) instead of its old walk-through. % of
   bill has a pool per job type: local, STRAIGHT and REGULAR (19% / 9% by default -- what those crews
   earn of their bills today, 18.8% / 8.7%). A CUSTOM JOB tab applies all four models to one job typed in
   or filled from a real one; today's pay there is this year's average per seat unless Settings says.
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
           "Has Contract", "Travel Hours", "Stairs Fee", "Bulky Fee", "Stairs Paid", "Bulky Paid", "Review Paid", "Other Extras Paid",
           "Job Type", "Labor Charge", "Cash Discount Pct", "Packing Charged", "Fees Charged", "Discounts",
           "Sales Commission", "Card Fee", "Profit Before Fixed"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "crew-pay-compare",
  group: "different",
  title: "Crew Salary Reconciliation",
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
      pctPool: 30, pctBonus: 5, pctBonusPaid: 100, pctStraight: 19, pctRegular: 9,
      pctB1From: 0, pctB1: 35, pctB2From: 800, pctB2: 61, pctB3From: 1600, pctB3: 88,
      pctB4From: 2400, pctB4: 106, pctB5From: 3200, pctB5: 134, pctB6From: 4000, pctB6: 186,
      // daily rate -- empty = break-even; the foreman's packing % stays
      dayForeman: "", dayDriver: "", dayHelper: "", dayPackPct: 20,
      // today's pay for the custom job -- empty = this year's average
      todayForeman: "", todayDriver: "", todayHelper: "", todayLdDriver: "", todayLdHelper: "", todayReview: "",
      todayPackPct: 20, todayStairsShare: 100, todayBulkyShare: 50,
    };
    const MIN_WAGE = 15.92;   // New Jersey, 2026 -- shown, never applied (his pick: no floor)
    const LABELS = {
      from: "From", to: "To",
      helperEntry: "Entry helper", helperExp: "Experienced helper", expHelperMonths: "Experienced helper after, with us",
      driver: "Driver / mover", foreman: "Foreman", seniorForeman: "Senior foreman", seniorForemanYears: "Senior foreman after, as foreman",
      crewPackPct: "Driver + helpers' pool, of materials sold", crewPackDriverShare: "The driver seat's share of that pool",
      ldTypes: "Long-distance job types",
      bonusMinShifts: "Shifts in the month, at least", bonusMinHours: "Hours in the month, at least", bonusMinJobs: "Jobs as foreman, at least",
      pctPool: "Local moving pool, of the splitable bill", pctStraight: "Straight moving pool, of the bill", pctRegular: "Regular moving pool, of the bill", pctBonus: "Bonus pool, of the splitable bill", pctBonusPaid: "Bonus pool paid out",
      dayForeman: "Foreman", dayDriver: "Driver", dayHelper: "Helper", dayPackPct: "Foreman's packing, of materials sold",
      todayForeman: "Foreman", todayDriver: "Driver", todayHelper: "Helper", todayLdDriver: "Long-distance driver",
      todayLdHelper: "Long-distance helper", todayReview: "Review pay, a reviewed job", todayPackPct: "Foreman's packing, of materials sold",
      todayStairsShare: "Of the stairs fee, to the crew", todayBulkyShare: "Of the bulky-item fee, to the crew",
    };
    // the unit drawn beside each box: $ in front; %, /h, months after
    const UNIT = {};
    [["%", "pctPool pctBonus pctBonusPaid pctStraight pctRegular crewPackPct crewPackDriverShare dayPackPct band1Share band2Share band3Share band0Share todayPackPct todayStairsShare todayBulkyShare"],
     ["$/h", "helperEntry helperExp driver foreman seniorForeman todayForeman todayDriver todayHelper"], ["$/day", "dayForeman dayDriver dayHelper todayLdDriver todayLdHelper"],
     ["$", "band1Amt band2Amt band3Amt todayReview"], ["months", "expHelperMonths"], ["years", "seniorForemanYears"],
     ["h", "bonusMinHours"], ["shifts", "bonusMinShifts"], ["jobs", "bonusMinJobs"]]
      .forEach(([u, ks]) => ks.split(" ").forEach(k => { UNIT[k] = u; }));
    for (let i = 1; i <= 6; i++) { UNIT["pctB" + i + "From"] = "$"; UNIT["pctB" + i] = "%"; }
    /* MAIN LEVERS -- his ask 2026-10-23: "some very important stuff should be on each tab ... but the
       settings part should be separately. i dont want too many selectors, yet i want the main ones to be
       there". Each scenario tab carries its few main numbers in one row; everything else is on Settings. */
    const LEVERS = {
      pct: ["pctPool", "pctStraight", "pctRegular", "pctBonus"],
      bonus: ["helperEntry", "helperExp", "driver", "foreman", "seniorForeman"],
      daily: ["dayForeman", "dayDriver", "dayHelper"],
    };
    const SHORT = { pctPool: "Local", pctStraight: "Straight", pctRegular: "Regular", pctBonus: "Bonus pool",
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
      || { tab: /[#&]tab=settings/.test(location.hash) ? "settings" : "actual", draft: null };
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
    const TABS = [["actual", "Actual"], ["pct", "% of bill"], ["bonus", "Bonus plan"], ["daily", "Daily rate"], ["custom", "Custom job"], ["settings", "Settings"]];
    function paint() {
      const c = cfg();
      host.innerHTML = `
        <div class="cpc">
          <div class="rs-page-head"><h1>Crew Salary Reconciliation</h1>
            <p>A year of crew pay four ways — what we actually paid, and three other ways of paying the same jobs — and any one job under all four ·
              Zip to Zip jobs · ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}</p></div>
          <div class="rs-tabs cpc-tabs">${TABS.map(([k, l]) =>
            (k === "settings" && S.draft ? `<span class="cpc-sub cpc-unsaved">unsaved changes</span>` : "")
            + `<button class="rs-tab ${S.tab === k ? "on" : ""}" data-tab="${k}">${l}</button>`).join("")}</div>
          <div id="cpcStrip"></div>
          <div id="cpcExplain"></div>
          <div id="cpcLevers"></div>
          <div id="cpcBody"></div>
        </div>`;
      host.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; paint(); });
      const body = host.querySelector("#cpcBody");
      const SC = scenarios(c);
      paintStrip(host.querySelector("#cpcStrip"), SC);
      host.querySelector("#cpcExplain").innerHTML = S.tab === "settings" ? "" : explain(S.tab, c, SC);
      paintLevers(host.querySelector("#cpcLevers"), c, SC);
      if (S.tab === "pct") paintModel(body, c, SC, SC.pct);
      else if (S.tab === "bonus") paintModel(body, c, SC, SC.bonus);
      else if (S.tab === "daily") paintModel(body, c, SC, SC.daily);
      else if (S.tab === "custom") paintCustom(body, c, SC);
      else if (S.tab === "settings") paintSettings(body, c, SC);
      else paintModel(body, c, SC, null);
    }

    /* the job lines' numbers: cents only where there are cents */
    const m2 = v => { const r = Math.round(v * 100) / 100; return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: r % 1 ? 2 : 0, maximumFractionDigits: 2 }); };
    const h2 = v => String(+(+v).toFixed(2));
    const tenureTxt = te => {
      if (!te || te.m == null) return "";
      const m = Math.max(0, Math.floor(te.m));
      return (te.m >= 24 ? (te.m / 12).toFixed(1) + " years " : m === 1 ? "1 month " : m + " months ") + te.as;
    };
    const shareTxt = f => f >= 0.999 ? "all" : Math.abs(f - 0.5) < 0.001 ? "half" : Math.round(f * 100) + "%";
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
      // WHAT RIDES ON EACH DOLLAR OF THE BILL (the job's P&L): sales commission and card fees grow with
      // any revenue; the profit before fixed costs is what a whole extra job keeps
      const pl = { bill: 0, comm: 0, card: 0, pre: 0, jobs: 0 };
      Object.values(jobs).forEach(j => { const r0 = j.r0;
        if (r0["Profit Before Fixed"] == null || r0["Profit Before Fixed"] === "") return;
        pl.jobs++; pl.bill += num(r0["Job Bill"]); pl.comm += num(r0["Sales Commission"]); pl.card += num(r0["Card Fee"]); pl.pre += num(r0["Profit Before Fixed"]); });
      const rates = { comm: pl.bill ? pl.comm / pl.bill : 0, card: pl.bill ? pl.card / pl.bill : 0, margin: pl.bill ? pl.pre / pl.bill : 0, jobs: pl.jobs };
      const A = lines.reduce((s, x) => s + x.T, 0), tips = lines.reduce((s, x) => s + x.tip, 0);
      // % OF BILL (his Excel): one pool per job, the foreman 1 + an extra share, everyone else 1 share
      Object.values(jobs).forEach(j => {
        const s = splitOf(j.r0), b = j.nf ? bandOf(c, s.v) : { from: 0, pct: 0 };
        const d = b.pct / 100, fShare = j.n ? (j.nf + d) / (j.n + d) : 0, oEach = j.n - j.nf ? (1 - fShare) / (j.n - j.nf) : 0;
        // A POOL PER JOB TYPE (his asks 2026-10-23: "Give LD its own %", then "straight should have
        // different and regular should have different"): his 30% is the local-job template's, and a
        // long-distance bill carries the haul -- Straight crews earn 18.8% of it today, Regular 8.7%, so
        // 19% / 9% are the defaults; no bonus pool on them ("having bonus for locals only is enough")
        const isLd = ld.has(j.r0["Moving Type"]), kind = !isLd ? "local" : j.r0["Moving Type"] === "Straight Moving" ? "straight" : "regular";
        const poolPct = num(c[{ local: "pctPool", straight: "pctStraight", regular: "pctRegular" }[kind]]);
        j.pct = { s, b, d, fShare, oEach, isLd, kind, poolPct, pool: poolPct / 100 * s.v,
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
      // BONUS PLAN, job by job: the plan's hourly wage and packing pool replace today's wage; the
      // foreman's monthly bonus is spread over his jobs that month; everything else is paid as today --
      // so its all-in total is Actual + the plan's own difference (the drafted plan's replay, compute())
      const R = compute(c), plan = new Map(), fmJobs = {};
      Object.values(R.byJob).forEach(ys => ys.forEach(y => {
        plan.set(y.r, y);
        if (y.role === "Foreman") { const k = y.who + "|" + y.r["Month"]; fmJobs[k] = (fmJobs[k] || 0) + 1; }
      }));
      lines.forEach(x => {
        const y = plan.get(x.r);
        if (!y) { x.bonus = { y: null, hourlyN: 0, poolN: 0, bonusN: 0, kept: x.T, total: x.T }; return; }
        const pm = x.role === "Foreman" && R.people[y.who] && R.people[y.who].months[x.r["Month"]];
        const bonusN = pm && pm.bonus ? pm.bonus / fmJobs[y.who + "|" + x.r["Month"]] : 0;
        const kept = x.T - y.t.hourlyT;   // packing commission, stairs, bulky, review, other -- and an LD day row's pay
        x.bonus = { y, hourlyN: y.n.hourlyN, poolN: y.n.poolN, bonusN, kept, total: kept + y.n.hourlyN + y.n.poolN + bonusN };
      });
      const bonus = mk("bonus", "Bonus plan", x => x.bonus.total);
      const fmLines = lines.filter(x => x.role === "Foreman").length;
      bonus.perJob = fmLines ? lines.reduce((a, x) => a + x.bonus.bonusN, 0) / fmLines : 0;
      // TODAY'S PAY, for the custom job: each seat's wage over the hours it paid, a long-distance trip's
      // day rate, and the review pay on a job that had one -- this year's, unless Settings overrides
      const today = {}, rateOver = xs => { const h = xs.reduce((a, x) => a + x.hours, 0); return h ? xs.reduce((a, x) => a + x.a.wage, 0) / h : 0; };
      SEATS.forEach(s => { today[s] = rateOver(lines.filter(x => x.role === s && !x.dayRow && x.hours > 0 && x.a.wage > 0)); });
      ["Driver", "Helper"].forEach(s => { const xs = lines.filter(x => x.role === s && x.dayRow && x.days > 0), d = xs.reduce((a, x) => a + x.days, 0);
        today["ld" + s] = d ? xs.reduce((a, x) => a + x.a.wage, 0) / d : 0; });
      const rv = Object.values(jobs).filter(j => num(j.r0["Review Paid"]) > 0);
      today.review = rv.length ? rv.reduce((a, j) => a + num(j.r0["Review Paid"]), 0) / rv.length : 0;
      const SC = { c, rows, jobs, lines, revenue, A, tips, pct, daily, bonus, rates, R, today };
      // the crew's own cut of an extra dollar: only the % plan pays out of the bill itself
      [[pct, revenue ? pct.total / revenue : 0], [daily, 0], [bonus, 0]].forEach(([P, s]) => { P.hold = holdOf(SC, P.total, s); });
      return SC;
    }

    /* HOLD THE PROFIT -- his ask 2026-10-23: "we increase the cost by X - how much we should increase
       the revenue next year - to get exactly same profit at the end of the period". Two ways to earn it:
       - PRICES, the same jobs: an extra dollar of bill pays the sales commission and the card fee again
         (this year's shares, from the job's P&L), and under the % plan the crew's own share too, so
         revenue must rise by the extra cost / what stays of the dollar;
       - MORE JOBS, today's prices: a job keeps its margin before fixed costs (after its crew, truck, fuel,
         ads and fees), less the raise, so revenue must rise by the extra cost / that margin.
       Fixed costs stay where they are in both. */
    function holdOf(SC, total, crewShare) {
      const H = SC.rates, R = SC.revenue, dC = total - SC.A, nj = Object.keys(SC.jobs).length;
      const keep = 1 - H.comm - H.card - crewShare, mNew = R ? H.margin - dC / R : 0;
      const price = keep > 0 ? dC / keep : null, volume = mNew > 0 ? dC / mNew : null;
      return { dC, crewShare, keep, mNew, price, volume, avgBill: nj ? R / nj : 0,
               pricePct: R && price != null ? price / R : null, volumePct: R && volume != null ? volume / R : null };
    }
    const signK = v => (v < 0 ? "−" : "+") + moneyK(Math.abs(v)).replace("−", "");
    const pctS = v => (v < 0 ? "−" : "+") + Math.abs(v * 100).toFixed(1) + "%";
    function holdPanel(SC, P) {
      const h = P.hold, H = SC.rates, c$ = v => (v * 100).toFixed(1) + "¢";
      if (!H.jobs) return "";
      const head = `<div class="panel-head"><span class="panel-title">To keep this year's profit</span>
        <span class="cpc-sub">how much revenue has to grow next year to pay for ${esc(P.label.toLowerCase())}</span></div>`;
      if (h.dC < 0.5) return `<section class="panel cpc-hold">${head}<p class="cpc-note">${esc(P.label)} costs ${h.dC < -0.5 ? moneyK(-h.dC) + " less than" : "the same as"} Actual — revenue can stay where it is${h.dC < -0.5 ? " and the profit grows by that much" : ""}.</p></section>`;
      return `<section class="panel cpc-hold">${head}
        <div class="cpc-holdg">
          <div class="cpc-hb"><span>Extra crew cost a year</span><b>${signK(h.dC)}</b><em>${esc(P.label)} against Actual</em></div>
          <div class="cpc-hb main"><span>Through prices — the same jobs</span><b>${h.price != null ? signK(h.price) + " · " + pctS(h.pricePct) : "—"}</b><em>revenue next year</em></div>
          <div class="cpc-hb"><span>Or through more jobs — today's prices</span><b>${h.volume != null ? signK(h.volume) + " · " + pctS(h.volumePct) : "not reachable"}</b>
            <em>${h.volume != null ? "about " + Math.round(h.volume / h.avgBill).toLocaleString() + " more jobs" : "a job no longer covers its own costs"}</em></div>
        </div>
        <p class="cpc-note"><b>Prices:</b> of every extra dollar billed, ${c$(H.comm)} goes to sales commission and ${c$(H.card)} to card fees${h.crewShare ? `, and ${c$(h.crewShare)} to the crew under this plan` : ""} — ${c$(h.keep)} stays, so ${money(h.dC)} ÷ ${h.keep.toFixed(3)} = <b>${money(h.price || 0)}</b>.
          <b>More jobs:</b> a job keeps ${(H.margin * 100).toFixed(1)}% of its bill before fixed costs today (after its crew, truck, fuel, ads and fees); with this plan ${(h.mNew * 100).toFixed(1)}%,
          so ${money(h.dC)} ÷ ${(h.mNew * 100).toFixed(1)}% = <b>${h.volume != null ? money(h.volume) : "—"}</b>${h.volume != null ? `, at the ${money(h.avgBill)} average bill` : ""}. Fixed costs stay as they are. From the Job P&L of ${H.jobs.toLocaleString()} of these jobs.</p>
      </section>`;
    }

    function paintStrip(el, SC) {
      const vs = v => { const d = v - SC.A;
        return Math.abs(d) < 0.5 ? "same as actual" : `${d > 0 ? "+" : "−"}${moneyK(Math.abs(d)).replace("−", "")} · ${d > 0 ? "+" : "−"}${Math.abs(d / SC.A * 100).toFixed(1)}%`; };
      // and how much more revenue keeps the profit, through prices
      const keepOf = P => P.hold.dC < 0.5 ? "same profit on today's revenue" : P.hold.pricePct != null ? "same profit: revenue " + pctS(P.hold.pricePct) : "";
      const card = (k, l, v, sub, hold) => `<button class="cpc-sc ${S.tab === k ? "on" : ""}" data-sc="${k}"><span>${l}</span><b>${moneyK(v)}</b><em>${sub}</em>${hold ? `<i>${hold}</i>` : ""}</button>`;
      el.innerHTML = `<div class="cpc-strip">
        ${card("actual", "Actual", SC.A, SC.revenue ? pct1(SC.A, SC.revenue) + " of bills" : "", SC.rates.jobs ? "the profit to keep" : "")}
        ${card("pct", "% of bill", SC.pct.total, vs(SC.pct.total), SC.rates.jobs && keepOf(SC.pct))}
        ${card("bonus", "Bonus plan", SC.bonus.total, vs(SC.bonus.total), SC.rates.jobs && keepOf(SC.bonus))}
        ${card("daily", "Daily rate", SC.daily.total, vs(SC.daily.total), SC.rates.jobs && keepOf(SC.daily))}</div>`;
      el.querySelectorAll("[data-sc]").forEach(b => b.onclick = () => { S.tab = b.dataset.sc; paint(); });
    }

    const byKey = (xs, f) => { const o = {}; xs.forEach(x => { const k = f(x); (o[k] = o[k] || []).push(x); }); return o; };
    const sumOf = (xs, f) => xs.reduce((s, x) => s + f(x), 0);
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

    /* EVERY MODEL'S TAB, ONE LAYOUT (his ask 2026-10-23: "i need bonus plan page to dont be so different
       from others ... i am not interested on person level salary increases - i just need an average of
       how much the salary for foreman will increase, for helper and for driver"): how pay works, the year
       against Actual, what each seat earns on an average DAY (his pick), what the pay is made of, month by
       month, one job line by line, and the revenue that keeps this year's profit. No list of people. */
    const PARTS = [
      ["wage", "Wages", "hourly pay — travel from the miles lookup included — or the day pay on a long-distance trip"],
      ["pack", "Packing commission", "the foreman's share of packing materials sold (20% since December 2025)"],
      ["stairs", "Stairs pay", "all of the stairs fee, split over the crew"],
      ["bulky", "Bulky-item pay", "half of the bulky-item fee, split over the crew"],
      ["review", "Review bonus", "the foreman's, per review"],
      ["other", "Hoisting, storage and junk pay", "from the contract, split over the crew"]];
    const YEAR_DAYS = 250;   // a full-time year: five days a week, fifty weeks
    // a seat's average DAY: a person's jobs on one date are one day, a long-distance trip row pays its own
    // days; per hour divides by the hours paid (trip rows have none); a year is YEAR_DAYS of those days
    function seatStats(SC, N) {
      const out = {};
      SEATS.forEach(s => {
        const xs = SC.lines.filter(x => x.role === s);
        if (!xs.length) return;
        const hx = xs.filter(x => !x.dayRow && x.hours > 0), days = sumOf(xs, x => x.dayN), hrs = sumOf(hx, x => x.hours);
        const g = byKey(xs, x => x.who + "|" + x.r["Date"] + (x.dayRow ? "|" + x.r["Unique Key"] : ""));
        const dl = Object.values(g).map(ys => ({ t: sumOf(ys, y => y.T), n: sumOf(ys, N), h: sumOf(ys, y => y.dayRow ? 0 : y.hours), trip: ys[0].dayRow }));
        const T = sumOf(xs, x => x.T), Nn = sumOf(xs, N);
        out[s] = { days, people: new Set(xs.map(x => x.who)).size, T, N: Nn,
          dayT: days ? T / days : 0, dayN: days ? Nn / days : 0,
          hourT: hrs ? sumOf(hx, x => x.T) / hrs : 0, hourN: hrs ? sumOf(hx, N) / hrs : 0,
          up: dl.filter(v => v.n > v.t + 0.5).length, down: dl.filter(v => v.n < v.t - 0.5).length, of: dl.length,
          underT: dl.filter(v => !v.trip && v.h > 0 && v.t / v.h < MIN_WAGE).length,
          underN: dl.filter(v => !v.trip && v.h > 0 && v.n / v.h < MIN_WAGE).length };
      });
      return out;
    }
    function seatCards(SC, N, isA) {
      const st = seatStats(SC, N), pc = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
      const one = s => { const o = st[s]; if (!o) return "";
        const d = o.dayN - o.dayT;
        return `<div class="cpc-seat"><span>${s} · a day</span>
          <b>${isA ? money(o.dayT) : money(o.dayT) + " → " + money(o.dayN)}</b>
          ${isA ? `<em>${o.people} people · ${Math.round(o.days).toLocaleString()} days</em>`
                : `<em class="${d >= 0 ? "cpc-up" : "cpc-down"}">${d >= 0 ? "+" : "−"}${money(Math.abs(d)).replace("−", "")} · ${d >= 0 ? "+" : "−"}${Math.abs(o.dayT ? d / o.dayT * 100 : 0).toFixed(1)}%</em>`}
          <div class="cpc-sub">${isA ? "$" + o.hourT.toFixed(2) + " an hour · " + moneyK(o.dayT * YEAR_DAYS) + " a full-time year"
            : "$" + o.hourT.toFixed(2) + " → $" + o.hourN.toFixed(2) + " an hour · " + moneyK(o.dayT * YEAR_DAYS) + " → " + moneyK(o.dayN * YEAR_DAYS) + " a full-time year"}</div>
          <div class="cpc-sub">${isA ? (o.underT ? o.underT.toLocaleString() + " days under $" + MIN_WAGE + "/h" : "no day under $" + MIN_WAGE + "/h")
            : "paid more on " + pc(o.up, o.of) + " of days, less on " + pc(o.down, o.of) + (o.underN ? " · " + o.underN.toLocaleString() + " days under $" + MIN_WAGE + "/h" : "")}</div></div>`; };
      return `<section class="panel"><div class="panel-head"><span class="panel-title">What each seat earns on an average day</span>
          <span class="cpc-sub">a person's jobs on one date are one day · a full-time year is ${YEAR_DAYS} days</span></div>
        <div class="cpc-seats">${SEATS.map(one).join("")}</div></section>`;
    }
    // what each model's crew pay is made of, over the year
    function madeOf(SC, key) {
      const L = SC.lines, c = SC.c, s = f => sumOf(L, f);
      if (key === "actual") return PARTS.map(([k, l, how]) => [l, how, s(x => x.a[k])]);
      if (key === "pct") {
        const k = x => x.j.pct.kind;
        return [["Salary pool — local jobs", `${num(c.pctPool)}% of the splitable bill, shared out`, s(x => k(x) === "local" ? x.pct.pool : 0)],
          ["Salary pool — straight moving", `${num(c.pctStraight)}% of the bill`, s(x => k(x) === "straight" ? x.pct.pool : 0)],
          ["Salary pool — regular moving", `${num(c.pctRegular)}% of the bill`, s(x => k(x) === "regular" ? x.pct.pool : 0)],
          ["Bonus pool — local jobs", `${num(c.pctBonus)}% of the splitable bill, ${num(c.pctBonusPaid)}% of it paid out`, s(x => x.pct.bonus)]];
      }
      if (key === "bonus") return [["Hourly wages", "the hours paid × the seat's plan rate, by tenure", s(x => x.bonus.hourlyN)],
          ["Packing pool", `${num(c.crewPackPct)}% of packing sold, for the driver and the helpers`, s(x => x.bonus.poolN)],
          ["Foreman bonus", "qualifying months × the band mix, spread over the foreman's jobs", s(x => x.bonus.bonusN)],
          ["Paid as today", "the foreman's packing commission, stairs, bulky, review and hoisting/storage/junk pay, long-distance day pay", s(x => x.bonus.kept)]];
      return [["Day pay", "a day rate per person per day", s(x => x.daily.dayPay)],
        ["Foreman's packing", `${num(c.dayPackPct)}% of packing sold`, s(x => x.daily.pack)]];
    }
    // HOW PAY WORKS in each model, from the numbers in force (his ask: "each tab to have a small
    // explanation of how the compensation structure will be")
    function explain(key, c, SC) {
      const $ = v => money(num(v)), bands = [1, 2, 3, 4, 5, 6].map(i => num(c["pctB" + i]));
      const T = {
        actual: `Each crew member is paid by the hour at their own rate, for the job's hours — labor or the minimum, plus travel from the miles lookup. On top, the foreman gets ${num(c.todayPackPct)}% of packing sold and the review bonus, and the crew splits all of the stairs fee, half of the bulky-item fee and any hoisting, storage or junk pay. Long-distance drivers and helpers are paid by the day. Tips are the crew's.`,
        pct: `The crew shares a pool from every job: <b>${num(c.pctPool)}%</b> of the bill on local moves, <b>${num(c.pctStraight)}%</b> on straight and <b>${num(c.pctRegular)}%</b> on regular long distance. Local jobs add a <b>${num(c.pctBonus)}%</b> bonus pool, cut when something goes wrong. The foreman takes one share plus an extra that grows with the bill (${Math.min(...bands)}% to ${Math.max(...bands)}%); the driver and every helper take one share each. Each salary is rounded up to the dollar. Nothing else is paid on top, and tips stay with the crew.`,
        bonus: `One hourly rate per seat, raised by tenure: helpers <b>${$(c.helperEntry)}</b>, then <b>${$(c.helperExp)}</b> after ${num(c.expHelperMonths)} months; drivers <b>${$(c.driver)}</b>; foremen <b>${$(c.foreman)}</b>, then <b>${$(c.seniorForeman)}</b> after ${num(c.seniorForemanYears)} years as foreman — for every hour paid, travel included. Drivers and helpers share a packing pool of ${num(c.crewPackPct)}% of materials sold. A foreman with ${num(c.bonusMinShifts)} shifts, ${num(c.bonusMinHours)} hours and ${num(c.bonusMinJobs)} jobs in a month earns a bonus of ${$(c.band1Amt)}, ${$(c.band2Amt)} or ${$(c.band3Amt)} by score. Everything else is paid as today, and tips stay with the crew.`,
        daily: `One rate per person per day: foreman <b>$${SC.daily.rateOf("Foreman")}</b>, driver <b>$${SC.daily.rateOf("Driver")}</b>, helper <b>$${SC.daily.rateOf("Helper")}</b>${["dayForeman", "dayDriver", "dayHelper"].some(k => c[k] === "" || c[k] == null) ? " (a rate left blank is today's pay per day, rounded to $5)" : ""}. A second job the same day adds nothing; a long-distance trip pays its days. The foreman keeps ${num(c.dayPackPct)}% of packing sold, so selling packing still pays. Nothing else: stairs, bulky items and reviews stay with the company. Tips stay with the crew.`,
        custom: `Enter a job — the crew, the hours and the bill — and see what each seat earns under all four models, with the working under every amount. Today's pay uses this year's average rates (Settings can change them); start from a real job to fill everything in.`,
      };
      return `<section class="cpc-explain"><div class="cpc-ex-h">How pay works ${key === "actual" ? "today" : key === "custom" ? "on one job" : "in this model"}</div><p>${T[key]}</p></section>`;
    }
    function paintModel(body, c, SC, P) {
      const isA = !P, key = isA ? "actual" : P.key, N = isA ? (x => x.T) : P.N, tot = isA ? SC.A : P.total;
      const label = isA ? "Actual" : P.label, nj = Object.keys(SC.jobs).length, parts = madeOf(SC, key);
      const h = isA ? null : P.hold;
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:4">
          <div class="kpi"><div class="l">Crew pay, the year</div><div class="v">${moneyK(tot)}</div><div class="s">${isA ? "every part of it · tips apart" : "actual " + moneyK(SC.A)}</div></div>
          ${isA ? `<div class="kpi"><div class="l">Per job</div><div class="v">${money(nj ? SC.A / nj : 0)}</div><div class="s">${nj.toLocaleString()} jobs</div></div>`
                : `<div class="kpi cpc-kd"><div class="l">Against Actual</div><div class="v">${signK(tot - SC.A)}</div><div class="s">${delta(tot, SC.A)}</div></div>`}
          <div class="kpi"><div class="l">Share of the bills</div><div class="v">${pct1(tot, SC.revenue)}</div><div class="s">${isA ? "of " + moneyK(SC.revenue) + " billed" : "actual " + pct1(SC.A, SC.revenue)}</div></div>
          ${isA ? `<div class="kpi"><div class="l">Tips</div><div class="v">${moneyK(SC.tips)}</div><div class="s">the crew's own · the same in every model</div></div>`
                : `<div class="kpi"><div class="l">Same profit needs</div><div class="v">${!SC.rates.jobs ? "—" : h.dC < 0.5 ? "no change" : h.pricePct != null ? pctS(h.pricePct) : "—"}</div><div class="s">revenue next year, through prices</div></div>`}
        </div>
        ${seatCards(SC, N, isA)}
        <section class="panel"><div class="panel-head"><span class="panel-title">What the pay is made of</span></div>
            <div class="rs-tablewrap"><table class="rs-table cpc-parts">
              <thead><tr><th>Part</th><th>How it is paid</th><th class="num">The year</th><th class="num">Of the bills</th><th class="num">Of crew pay</th></tr></thead>
              <tbody>${parts.map(([l, how, v]) => `<tr><td><b>${l}</b></td><td class="cpc-howcell">${how}</td><td class="num">${money(v)}</td><td class="num">${pct1(v, SC.revenue)}</td><td class="num">${pct1(v, tot)}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>${esc(label)}</td><td></td><td class="num">${money(tot)}</td><td class="num">${pct1(tot, SC.revenue)}</td><td class="num">100%</td></tr></tfoot>
            </table></div></section>
        <section class="panel"><div class="panel-head"><span class="panel-title">Month by month</span></div>
          <div class="chartbox" style="height:240px"><canvas id="cpcChart"></canvas></div></section>
        ${isA ? holdTable(SC) : `<section class="panel cpc-job" id="cpcJob2"></section>${holdPanel(SC, P)}`}
        <section class="panel cpc-how"><div class="panel-head"><span class="panel-title">How this is counted</span></div><ul>
          <li><b>The jobs:</b> ${nj.toLocaleString()} Zip to Zip jobs, ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}, every crew member on each — the same jobs in every model. Tuji, Boston and Virginia are left out.</li>
          <li><b>Actual</b> is everything paid on these jobs — wages, the foreman's packing commission, stairs, bulky-item, hoisting/storage/junk pay and review bonuses. Tips are the crew's in every model and sit apart.</li>
          <li><b>Hours</b> are the hours the wage was paid for (wage ÷ rate): labor or the minimum, plus travel from the miles lookup. The closing sheet shows them rounded to whole hours.</li>
          ${key === "pct" ? `<li><b>Splitable bill</b> comes from the digital contract — the moving fee at the cash price, packing and the fees, less discounts; ${Object.values(SC.jobs).filter(j => j.pct.s.src === "bill").length.toLocaleString()} of ${nj.toLocaleString()} jobs have no contract and use the closing's bill. Long-distance jobs split their whole bill. There is no hourly floor (your call).</li>` : ""}
          ${key === "bonus" ? `<li><b>Tenure</b> decides the rate per job: an experienced helper after ${num(c.expHelperMonths)} months with us, a senior foreman after ${num(c.seniorForemanYears)} years as foreman. <b>The foreman bonus</b> is real eligibility (${SC.R.eligMonths} of ${SC.R.fmMonths} foreman-months qualify) × the band mix set in Settings, ${money(SC.R.ev)} a qualifying month, spread over that month's jobs. Long-distance drivers and helpers paid by the day keep today's day pay.</li>` : ""}
          ${key === "daily" ? `<li><b>A day</b> is one person on one date: a second job the same day adds nothing; a long-distance trip row pays its own days. Long days earn the same as short ones — the days under $${MIN_WAGE} an hour are counted per seat.</li>` : ""}
        </ul></section>`;
      monthChart(body.querySelector("#cpcChart"), SC, isA ? [["Actual", x => x.T]] : [["Actual", x => x.T], [label, N]]);
      if (!isA) paintJob2(body.querySelector("#cpcJob2"), SC, P, c);
      body.querySelectorAll("tr[data-go]").forEach(tr => tr.onclick = () => { S.tab = tr.dataset.go; paint(); });
    }
    function holdTable(SC) {
      if (!SC.rates.jobs) return "";
      return `<section class="panel cpc-hold"><div class="panel-head"><span class="panel-title">To keep this year's profit</span>
          <span class="cpc-sub">how much revenue has to grow next year to pay for each way of paying</span></div>
        <div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Model</th><th class="num">Extra crew cost a year</th><th class="num">Through prices — the same jobs</th><th class="num">Or through more jobs</th></tr></thead>
          <tbody>${[SC.pct, SC.bonus, SC.daily].map(P => { const h = P.hold;
            return `<tr class="click" data-go="${P.key}"><td><b>${esc(P.label)}</b></td><td class="num">${signK(h.dC)}</td>
              <td class="num">${h.dC < 0.5 ? "—" : h.price != null ? "<b>" + signK(h.price) + "</b> · " + pctS(h.pricePct) : "—"}</td>
              <td class="num">${h.dC < 0.5 ? "—" : h.volume != null ? signK(h.volume) + " · " + pctS(h.volumePct) + ` <span class="cpc-sub">≈ ${Math.round(h.volume / h.avgBill).toLocaleString()} jobs</span>` : "not reachable"}</td></tr>`; }).join("")}</tbody>
        </table></div>
        <p class="cpc-note">Revenue next year (this year: ${moneyK(SC.revenue)}) that leaves the profit exactly where it is. Through prices, every extra dollar still pays the sales commission (${(SC.rates.comm * 100).toFixed(1)}¢) and card fees (${(SC.rates.card * 100).toFixed(1)}¢) — and under % of bill the crew's share. Through more jobs, each new job keeps only its margin before fixed costs (${(SC.rates.margin * 100).toFixed(1)}% today, less the raise). Each model's tab shows the working.</p>
      </section>`;
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
      // how the model works is said once, in the explanation above
      el.innerHTML = `<section class="cpc-levers">
          <div class="cpc-lvrow">${keys.map(k => `<label class="cpc-lv"><span>${SHORT[k]}</span>${box(k, c, { ph: seatOf[k] ? String(be[seatOf[k]] || 0) : "" })}</label>`).join("")}</div>
          <div class="cpc-lvside">${actions()}<button class="btn" data-go="settings">All settings</button></div></section>`;
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

    /* CUSTOM JOB (his ask 2026-10-23: "1 custom job situation ... when user will tell us crew size, bill,
       bulky, packing, this, that and see the salaries comparison for all 4 models"). Every model's rule
       applied to one job typed in -- or filled from a real one. TODAY's pay uses this year's average rate
       per seat (wage ÷ hours paid), the long-distance day rates and the review pay on a reviewed job, unless
       Settings overrides them. The Bonus plan's monthly foreman bonus shows as this year's average per job. */
    const CJ0 = { type: "Local Moving", drivers: 1, helpers: 1, hours: 6, days: 1, labor: 1600, cash: 4, pack: 200,
                  bulky: 100, stairs: 0, other: 0, disc: 0, review: 0, expHelper: 1, senior: 0 };
    const todayOf = (c, SC, k, s) => c[k] === "" || c[k] == null ? SC.today[s] : num(c[k]);
    function customJob(c, SC, J) {
      const n = 1 + J.drivers + J.helpers, isLd = J.type !== "Local Moving";
      const kind = !isLd ? "local" : J.type === "Straight Moving" ? "straight" : "regular";
      const bill = J.labor + J.pack + J.bulky + J.stairs + J.other - J.disc;
      const tR = { Foreman: todayOf(c, SC, "todayForeman", "Foreman"), Driver: todayOf(c, SC, "todayDriver", "Driver"), Helper: todayOf(c, SC, "todayHelper", "Helper"),
                   ldDriver: todayOf(c, SC, "todayLdDriver", "ldDriver"), ldHelper: todayOf(c, SC, "todayLdHelper", "ldHelper"), review: todayOf(c, SC, "todayReview", "review") };
      const stairsEach = J.stairs * num(c.todayStairsShare) / 100 / n, bulkyEach = J.bulky * num(c.todayBulkyShare) / 100 / n;
      const fmPack = J.pack * num(c.todayPackPct) / 100, rev = J.review ? tR.review : 0;
      const extras = list => list.filter(([v]) => v > 0.004).map(([v, l]) => `${m2(v)} ${l}`).join(" + ");
      const out = {};
      const base = s => isLd && s !== "Foreman" ? { v: J.days * tR["ld" + s], how: `${h2(J.days)} ${J.days === 1 ? "day" : "days"} × ${m2(tR["ld" + s])}` }
                                               : { v: J.hours * tR[s], how: `${h2(J.hours)} h × ${m2(tR[s])}` };
      // ACTUAL: today's rules
      out.actual = {};
      SEATS.forEach(s => { const b = base(s), sh = stairsEach + bulkyEach + (s === "Foreman" ? fmPack + rev : 0);
        out.actual[s] = { v: b.v + sh, how: [b.how, extras([[s === "Foreman" ? fmPack : 0, "packing"], [stairsEach, "stairs"], [bulkyEach, "bulky"], [s === "Foreman" ? rev : 0, "review"]])].filter(Boolean).join(" + ") }; });
      // % OF BILL
      const sv = isLd ? bill : Math.max(0, J.labor * (1 - J.cash / 100) + J.pack + J.bulky + J.stairs + J.other - J.disc);
      const band = bandOf(c, sv), dd = band.pct / 100, fShare = (1 + dd) / (n + dd), oEach = n > 1 ? (1 - fShare) / (n - 1) : 0;
      const poolPct = num(c[{ local: "pctPool", straight: "pctStraight", regular: "pctRegular" }[kind]]);
      const bonusPct = isLd ? 0 : num(c.pctBonus) * num(c.pctBonusPaid) / 100;
      out.pct = {};
      SEATS.forEach(s => { const sh = s === "Foreman" ? fShare : oEach, p = ceil$(poolPct / 100 * sv * sh), b = ceil$(bonusPct / 100 * sv * sh);
        out.pct[s] = { v: p + b, how: `${poolPct}% × ${m2(sv)} × ${(sh * 100).toFixed(1)}% → ${m2(p)}${b ? ` + bonus ${m2(b)}` : ""}` }; });
      // BONUS PLAN
      const pR = { Foreman: num(J.senior ? c.seniorForeman : c.foreman), Driver: num(c.driver), Helper: num(J.expHelper ? c.helperExp : c.helperEntry) };
      const dShare = !J.helpers ? 1 : !J.drivers ? 0 : Math.min(1, num(c.crewPackDriverShare) / 100), pool = J.pack * num(c.crewPackPct) / 100;
      out.bonus = {};
      SEATS.forEach(s => {
        const wage = isLd && s !== "Foreman" ? base(s) : { v: J.hours * pR[s], how: `${h2(J.hours)} h × ${m2(pR[s])}` };
        const pl = s === "Driver" ? (J.drivers ? pool * dShare / J.drivers : 0) : s === "Helper" ? (J.helpers ? pool * (1 - dShare) / J.helpers : 0) : 0;
        const bn = s === "Foreman" ? SC.bonus.perJob : 0, kept = stairsEach + bulkyEach + (s === "Foreman" ? fmPack + rev : 0);
        out.bonus[s] = { v: wage.v + pl + bn + kept, how: [wage.how, extras([[pl, "packing pool"], [bn, "bonus (a job's average)"], [kept, "paid as today"]])].filter(Boolean).join(" + ") };
      });
      // DAILY RATE
      out.daily = {};
      SEATS.forEach(s => { const r = SC.daily.rateOf(s), pk = s === "Foreman" ? J.pack * num(c.dayPackPct) / 100 : 0;
        out.daily[s] = { v: J.days * r + pk, how: `${h2(J.days)} ${J.days === 1 ? "day" : "days"} × $${r}${pk ? ` + ${m2(pk)} packing` : ""}` }; });
      const cnt = { Foreman: 1, Driver: J.drivers, Helper: J.helpers };
      const crewOf = k => SEATS.reduce((a, s) => a + out[k][s].v * cnt[s], 0);
      return { out, cnt, bill, sv, band, kind, isLd, crewOf, tR };
    }
    function paintCustom(body, c, SC) {
      const J = S.custom = Object.assign({}, CJ0, S.custom || {}), R = customJob(c, SC, J);
      const MODELS = [["actual", "Actual"], ["pct", "% of bill"], ["bonus", "Bonus plan"], ["daily", "Daily rate"]];
      const nf = (k, l, o = {}) => `<label class="cpc-lv"><span>${l}</span><span class="cpc-in">${o.pre ? `<i>${o.pre}</i>` : ""}<input data-cj="${k}" type="number" step="any" min="0" value="${esc(String(J[k]))}">${o.post ? `<i>${o.post}</i>` : ""}</span></label>`;
      const ck = (k, l) => `<label class="cpc-ck"><input data-cj="${k}" type="checkbox" ${J[k] ? "checked" : ""}> ${l}</label>`;
      const best = Math.min(...MODELS.map(([k]) => R.crewOf(k)));
      body.innerHTML = `
        <section class="panel"><div class="panel-head"><span class="panel-title">The job</span><span class="spacer"></span>
            <div class="cpc-jobpick"><input class="cpc-q" id="cpcCjQ" placeholder="Start from a real job — request #, customer, foreman or date" aria-label="Start from a real job" autocomplete="off" value="${esc(S.cjQ || "")}">
              <div class="cpc-hits" id="cpcCjHits"></div></div></div>
          ${S.cjFrom ? `<p class="cpc-note cpc-jobrule">Filled from ${esc(S.cjFrom)} — change anything.</p>` : ""}
          <div class="cpc-cj">
            <label class="cpc-lv"><span>Move type</span><select data-cj="type">${["Local Moving", "Straight Moving", "Regular Moving"].map(t => `<option ${J.type === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
            <label class="cpc-lv"><span>Foreman</span><span class="cpc-in"><input type="number" value="1" disabled></span></label>
            ${nf("drivers", "Drivers")}${nf("helpers", "Helpers")}${nf("hours", "Hours paid", { post: "h" })}${nf("days", "Days", { post: "days" })}
          </div>
          <div class="cpc-cj">
            ${nf("labor", "Moving fee", { pre: "$" })}${nf("cash", "Cash discount", { post: "%" })}${nf("pack", "Packing sold", { pre: "$" })}
            ${nf("bulky", "Bulky fee", { pre: "$" })}${nf("stairs", "Stairs fee", { pre: "$" })}${nf("other", "Other fees", { pre: "$" })}${nf("disc", "Discounts", { pre: "$" })}
          </div>
          <div class="cpc-cjck">${ck("review", "The foreman got a review")}${ck("expHelper", `Helpers ${num(c.expHelperMonths)}+ months with us`)}${ck("senior", `Senior foreman (${num(c.seniorForemanYears)}+ years)`)}</div>
          <p class="cpc-note">Bill <b>${money(R.bill)}</b>${R.isLd ? "" : ` · splitable bill ${money(R.sv)} (the moving fee at the cash price, packing and fees, less discounts)`} · the foreman's extra share for it: ${R.band.pct}%. Hours paid include travel; days count for long-distance trips and the daily rate.</p>
        </section>
        <section class="panel"><div class="panel-head"><span class="panel-title">What each seat earns on this job</span></div>
          <div class="rs-tablewrap"><table class="rs-table cpc-cjt">
            <thead><tr><th>Seat</th>${MODELS.map(([, l]) => `<th class="num">${l}</th>`).join("")}</tr></thead>
            <tbody>${SEATS.filter(s => R.cnt[s]).map(s => `<tr><td><b>${s}</b>${R.cnt[s] > 1 ? `<div class="cpc-sub">each of ${R.cnt[s]}</div>` : ""}</td>
              ${MODELS.map(([k]) => `<td class="num"><b>${m2(R.out[k][s].v)}</b><div class="cpc-sub">${R.out[k][s].how}</div></td>`).join("")}</tr>`).join("")}</tbody>
            <tfoot>
              <tr><td>Crew</td>${MODELS.map(([k]) => `<td class="num ${Math.abs(R.crewOf(k) - best) < 0.005 ? "cpc-best" : ""}">${money(R.crewOf(k))}</td>`).join("")}</tr>
              <tr><td>Of the bill</td>${MODELS.map(([k]) => `<td class="num">${pct1(R.crewOf(k), R.bill)}</td>`).join("")}</tr>
              <tr><td>Against Actual</td>${MODELS.map(([k]) => `<td class="num">${k === "actual" ? "—" : delta(R.crewOf(k), R.crewOf("actual"))}</td>`).join("")}</tr>
              <tr><td>The company keeps</td>${MODELS.map(([k]) => `<td class="num">${money(R.bill - R.crewOf(k))}</td>`).join("")}</tr>
            </tfoot>
          </table></div>
          <p class="cpc-note">Today's pay here: foreman ${m2(R.tR.Foreman)}/h, driver ${m2(R.tR.Driver)}/h, helper ${m2(R.tR.Helper)}/h; long distance driver ${m2(R.tR.ldDriver)}, helper ${m2(R.tR.ldHelper)} a day; review ${m2(R.tR.review)} — this year's averages unless Settings sets them. Tips are the crew's in every model and left out.</p>
        </section>`;
      body.querySelectorAll("[data-cj]").forEach(el => el.onchange = () => {
        const k = el.dataset.cj;
        S.custom = Object.assign({}, J, { [k]: el.type === "checkbox" ? (el.checked ? 1 : 0) : el.tagName === "SELECT" ? el.value : Math.max(0, num(el.value)) });
        if (S.cjFrom && !/ — changed$/.test(S.cjFrom)) S.cjFrom += " — changed";
        paintCustom(body, c, SC);
      });
      // START FROM A REAL JOB: its crew, hours and bill lines fill the inputs
      const q = body.querySelector("#cpcCjQ"), hits = body.querySelector("#cpcCjHits");
      const fill = uk => {
        const j = SC.jobs[uk], r0 = j.r0, xs = SC.lines.filter(x => x.j === j), fm = xs.find(x => x.role === "Foreman") || xs[0];
        const hasC = r0["Labor Charge"] != null && r0["Labor Charge"] !== "";
        const bulky = num(r0["Bulky Fee"]), stairs = num(r0["Stairs Fee"]), fees = num(r0["Fees Charged"]);
        S.custom = { type: ["Straight Moving", "Regular Moving"].includes(r0["Moving Type"]) ? r0["Moving Type"] : "Local Moving",
          drivers: xs.filter(x => x.role === "Driver").length, helpers: xs.filter(x => x.role === "Helper").length,
          hours: +(fm.hours || 0).toFixed(2), days: Math.max(1, ...xs.map(x => x.dayRow ? x.days : 1)),
          labor: hasC ? num(r0["Labor Charge"]) : Math.max(0, num(r0["Job Bill"]) - num(r0["Packing Sold"])),
          cash: +(num(r0["Cash Discount Pct"]) * 100).toFixed(2), pack: hasC ? num(r0["Packing Charged"]) : num(r0["Packing Sold"]),
          bulky, stairs, other: hasC ? Math.max(0, fees - bulky - stairs) : 0, disc: hasC ? num(r0["Discounts"]) : 0,
          review: num(r0["Review Paid"]) > 0 ? 1 : 0, expHelper: J.expHelper, senior: J.senior };
        S.cjFrom = `${fmtDay(r0["Date"])} · request ${r0["Request #"] || "—"} · ${r0["Customer"] || ""}`;
        S.cjQ = "";
        paintCustom(body, c, SC);
      };
      const index = () => SC._jobIndex = SC._jobIndex || Object.values(SC.jobs).map(jj => {
        const a = jj.r0, fmn = (jj.rows.find(y => y["Role"] === "Foreman") || {})["Person"] || "";
        return { k: jj.uk, d: a["Date"], label: `${fmtDay(a["Date"])} · ${a["Request #"] || "—"} · ${a["Customer"] || ""} · ${fmn}`,
                 text: [a["Date"], fmtDay(a["Date"]), a["Request #"], a["Customer"], fmn, a["Job No"]].join(" ").toLowerCase() };
      }).sort((a, b) => b.d.localeCompare(a.d));
      const find = () => {
        S.cjQ = q.value;
        const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
        if (!words.length) { hits.innerHTML = ""; return; }
        const found = index().filter(jj => words.every(w => jj.text.includes(w))).slice(0, 8);
        hits.innerHTML = found.length ? found.map(jj => `<button data-uk="${esc(jj.k)}">${esc(jj.label)}</button>`).join("") : `<div class="cpc-nohit">No job matches</div>`;
        hits.querySelectorAll("button[data-uk]").forEach(b => b.onclick = () => fill(b.dataset.uk));
      };
      q.oninput = find;
      q.onkeydown = e => { if (e.key === "Escape") { q.value = ""; find(); } };
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
          L2.push(ln(`${p.poolPct}%${p.isLd ? " (" + p.kind + ")" : ""} × ${m2(s.v)} × ${(x.pct.share * 100).toFixed(1)}% = ${m2(x.pct.poolRaw)} → <b>${m2(x.pct.pool)}</b>`));
          if (x.pct.bonusRaw > 0) L2.push(ln(`+ bonus ${num(c.pctBonus)}%${num(c.pctBonusPaid) !== 100 ? " × " + num(c.pctBonusPaid) + "% paid" : ""} × ${(x.pct.share * 100).toFixed(1)}% → <b>${m2(x.pct.bonus)}</b>`));
          L2.push(ln(`= ${m2(x.pct.total)}`, "cpc-tot"));
        } else if (P.key === "bonus") {
          const b = x.bonus, y = b.y, nD = x.j.rows.filter(r => r["Role"] === "Driver").length, nH = x.j.rows.filter(r => r["Role"] === "Helper").length;
          const dShare = !nH ? 1 : !nD ? 0 : Math.min(1, num(c.crewPackDriverShare) / 100);
          if (y && y.newRate != null && y.hours) L2.push(ln(`${h2(y.hours)} h × ${m2(y.newRate)} = <b>${m2(b.hourlyN)}</b>`));
          else if (b.hourlyN) L2.push(ln(`wage kept as paid <b>${m2(b.hourlyN)}</b>`));
          if (b.poolN) L2.push(ln(`+ ${m2(b.poolN)} packing pool (${shareTxt(x.role === "Driver" ? dShare : 1 - dShare)} of ${num(c.crewPackPct)}% of ${m2(num(r0["Packing Sold"]))}${x.role === "Helper" && nH > 1 ? ", ÷ " + nH + " helpers" : ""})`));
          if (b.bonusN) L2.push(ln(`+ ${m2(b.bonusN)} foreman bonus (the month's ${money(SC.R.ev)} over its ${Math.round(SC.R.ev / b.bonusN)} jobs)`));
          const keptWhat = [["pack", "packing commission"], ["stairs", "stairs"], ["bulky", "bulky"], ["review", "review"], ["other", "hoisting, storage, junk"]]
            .filter(([k]) => x.a[k] > 0.004).map(([, l]) => l).join(", ");
          if (b.kept > 0.004) L2.push(ln(`+ ${m2(b.kept)} paid as today (${[x.dayRow ? "day pay" : "", keptWhat].filter(Boolean).join(", ")})`));
          L2.push(ln(`= ${m2(b.total)}`, "cpc-tot"));
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
        : P.key === "bonus" ? `plan rates: helper ${money(num(c.helperEntry))} → ${money(num(c.helperExp))} after ${num(c.expHelperMonths)} months, driver ${money(num(c.driver))}, foreman ${money(num(c.foreman))} → ${money(num(c.seniorForeman))} after ${num(c.seniorForemanYears)} years`
        : `day rates: foreman $${P.rateOf("Foreman")}, driver $${P.rateOf("Driver")}, helper $${P.rateOf("Helper")}`;
      const jT = sumOf(xs, x => x.T), jN = sumOf(xs, P.N);
      box.innerHTML = `
        <div class="panel-head"><span class="panel-title">One job, line by line</span><span class="spacer"></span>
          <div class="cpc-jobpick"><input class="cpc-q" id="cpcJobQ2" placeholder="Find a job — request #, customer, foreman or date" aria-label="Find a job" autocomplete="off" value="${esc(S.jobQ || "")}">
            <div class="cpc-hits" id="cpcHits2"></div></div></div>
        <div class="cpc-jobfacts"><span><b>${esc(fmtDay(r0["Date"]))}</b></span><span>request <b>${esc(r0["Request #"] || "—")}</b></span>
          <span>${esc(r0["Customer"] || "")}</span><span>${esc(r0["Moving Type"] || "")}${r0["Job Type"] ? " · " + esc(String(r0["Job Type"]).toLowerCase()) : ""}</span>
          <span>crew of <b>${j.n}</b></span><span>bill <b>${money(num(r0["Job Bill"]))}</b></span><span>packing sold <b>${money(num(r0["Packing Sold"]))}</b></span>
          ${r0["Travel Hours"] != null && r0["Travel Hours"] !== "" ? `<span>${h2(num(r0["Travel Hours"]))} h of the hours travel from the miles lookup</span>` : ""}</div>
        <p class="cpc-note cpc-jobrule">${facts}</p>
        <div class="rs-tablewrap"><table class="rs-table cpc-jobt">
          <thead><tr><th>Person</th><th>Actual</th><th>${esc(P.label)}</th><th class="num">Difference</th></tr></thead>
          <tbody>${xs.map(x => { const dd = P.N(x) - x.T;
            const te = P.key === "bonus" && x.bonus.y ? " · " + esc(x.bonus.y.tier) + (tenureTxt(x.bonus.y.tenure) ? ", " + esc(tenureTxt(x.bonus.y.tenure)) : "") : "";
            return `<tr><td><b>${esc(x.who)}</b><div class="cpc-sub">${esc(x.role)}${x.hours ? " · " + h2(x.hours) + " h paid" : ""}${te}</div></td>
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
          ${sec("Pools", `One pool per job, by job type: local moves share a % of the splitable bill — the moving fee at the cash price, plus packing materials and the fees, less discounts (the service fee and waiting time stay out); straight and regular long-distance moves share a % of the whole bill, which carries the haul (their crews earn 18.8% and 8.7% of it today). Local jobs add a bonus pool that is cut when something goes wrong; the paid-out % is what this replay pays of it. Each salary is rounded up to the dollar; tips stay with the crew.`,
            fields(["pctPool", "pctStraight", "pctRegular", "pctBonus", "pctBonusPaid"]))}
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

        <h2 class="cpc-seth">Custom job — today's pay</h2>
        <div class="cpc-sets">
          ${sec("Today's rates", `What Actual pays on a custom job. Left blank, each is this year's average: the seat's wage over the hours it paid, a long-distance trip's day rate, and the review pay on a reviewed job.`,
            fields(["todayForeman", "todayDriver", "todayHelper", "todayLdDriver", "todayLdHelper", "todayReview"],
              { todayForeman: { ph: (SC.today.Foreman || 0).toFixed(2) }, todayDriver: { ph: (SC.today.Driver || 0).toFixed(2) }, todayHelper: { ph: (SC.today.Helper || 0).toFixed(2) },
                todayLdDriver: { ph: Math.round(SC.today.ldDriver || 0) }, todayLdHelper: { ph: Math.round(SC.today.ldHelper || 0) }, todayReview: { ph: Math.round(SC.today.review || 0) } }))}
          ${sec("Today's extras", "How today's contract shares the extras out: the foreman's packing commission, and the part of the stairs and bulky-item fees split over the crew.",
            fields(["todayPackPct", "todayStairsShare", "todayBulkyShare"]))}
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
        .cpc-how ul{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6}
        .cpc-how b{color:var(--ink)}
        .cpc-setbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}
        .cpc-warn{background:var(--warn-bg);color:var(--warn);border-radius:8px;padding:9px 12px;font-size:13px;margin-bottom:12px}
        .cpc-sets{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr));gap:16px}
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
        .cpc-sc i{font-style:normal;font-size:12px;color:var(--muted);font-weight:600;margin-top:2px}
        .cpc-holdg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:10px}
        @media(max-width:900px){.cpc-holdg{grid-template-columns:1fr}}
        .cpc-hb{display:flex;flex-direction:column;gap:2px;border:1px solid var(--line);border-radius:10px;padding:10px 14px}
        .cpc-hb.main{border:2px solid var(--brand);padding:9px 13px}
        .cpc-hb span{font-size:12.5px;color:var(--muted);font-weight:600}
        .cpc-hb b{font-size:20px;color:var(--ink);font-variant-numeric:tabular-nums}
        .cpc-hb em{font-style:normal;font-size:12px;color:var(--faint)}
        .cpc-hold tr.click{cursor:pointer}
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
        .cpc-explain{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:0;padding:12px 16px;margin:0 0 16px}
        .cpc-ex-h{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}
        .cpc-explain p{margin:0;font-size:14px;line-height:1.65;color:var(--muted)}
        .cpc-explain b{color:var(--ink)}
        .cpc-seats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(260px,100%),1fr));gap:12px;margin-top:10px}
        .cpc-seat{display:flex;flex-direction:column;gap:3px;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
        .cpc-seat>span{font-size:12.5px;color:var(--muted);font-weight:600}
        .cpc-seat>b{font-size:21px;color:var(--ink);font-variant-numeric:tabular-nums}
        .cpc-seat>em{font-style:normal;font-size:13px;color:var(--muted)}
        .cpc-cj{display:flex;flex-wrap:wrap;gap:10px 14px;margin-top:12px}
        .cpc-cj select{font:inherit;font-size:14px;border:1px solid var(--line-2);border-radius:8px;padding:7px 8px;background:var(--panel);color:var(--ink)}
        .cpc-cjck{display:flex;flex-wrap:wrap;gap:8px 20px;margin-top:12px;font-size:13px;color:var(--muted)}
        .cpc-ck{display:flex;align-items:center;gap:6px;cursor:pointer}
        .cpc-cjt td{vertical-align:top}
        .cpc-cjt td .cpc-sub{font-size:11.5px;line-height:1.4;margin-top:2px;white-space:normal}
        .cpc-cjt tfoot td.cpc-best{color:var(--brand)}
      `;
      document.head.appendChild(s);
    }

    paint();
  },
});
