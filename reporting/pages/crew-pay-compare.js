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
     multi-day trips and overpaid 2-hour legs. */
if (window.RS && RS.DATASETS && !RS.DATASETS.crew_pay_compare) {
  RS.DATASETS.crew_pay_compare = {
    table: "mart_crew_pay_compare",
    cols: ["Unique Key", "Date", "Month", "Company", "Job No", "Request #", "Customer", "Moving Type",
           "Job Foreman", "Role", "Person", "Hours", "Rate", "Salary", "Tip", "First Job",
           "First Foreman Job", "Crew Size", "Job Bill", "Packing Sold", "Packing Commission",
           "Has Contract", "Travel Hours",
           "Estimated CF", "Final CF", "Price per CF"],
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
      ldDriverDay: 250, ldHelperDay: 200, ldCfPct: 15,
      bonusMinShifts: 10, bonusMinHours: 80, bonusMinJobs: 8,
      band1Amt: 1000, band2Amt: 750, band3Amt: 400,
      band1Share: 30, band2Share: 40, band3Share: 20, band0Share: 10,
    };
    const LABELS = {
      from: "From", to: "To",
      helperEntry: "Entry helper $/h", helperExp: "Experienced helper $/h", expHelperMonths: "Experienced after (months with us)",
      driver: "Driver / mover $/h", foreman: "Foreman $/h", seniorForeman: "Senior foreman $/h", seniorForemanYears: "Senior after (years as foreman)",
      crewPackPct: "Packing: driver + helpers' pool, % of materials sold", crewPackDriverShare: "Driver's share of that pool %",
      ldTypes: "Long-distance job types", ldDriverDay: "LD driver $ per day", ldHelperDay: "LD helper $ per day", ldCfPct: "LD foreman: % of extra CF value",
      bonusMinShifts: "Minimum shifts in the month", bonusMinHours: "Minimum hours in the month", bonusMinJobs: "Minimum jobs as foreman",
      band1Amt: "Top band $ (score 90–100)", band2Amt: "Second band $ (80–89)", band3Amt: "Third band $ (70–79)",
      band1Share: "% of eligible months in the top band", band2Share: "% in the second band", band3Share: "% in the third band", band0Share: "% earning nothing (below 70)",
    };
    const GROUPS = [
      ["Period", "The year being replayed, by job date.", ["from", "to"]],
      ["Hourly rates", "Base pay per hour for each seat. Long-distance drivers and helpers are paid by the day instead (below).",
        ["helperEntry", "helperExp", "driver", "foreman", "seniorForeman"]],
      ["Career ladder", "Tenure is counted from a person's first job with us (any seat), and for senior foreman from their first job as foreman — as of each job's date.",
        ["expHelperMonths", "seniorForemanYears"]],
      ["Packing pool", "From the closing sheet's packing materials sold. The pool is one pot per job: the driver seat gets its share and the helpers split the rest evenly. If a job has no driver the helpers get the whole pot, and the other way round. (The foreman keeps his 20% exactly as today, so it is not in the comparison — nor are stairs and bulky-item pay.)",
        ["crewPackPct", "crewPackDriverShare"]],
      ["Long distance", "One day per closing row for drivers and helpers. The foreman stays hourly and gets a share of the CF he moved beyond the Moveboard estimate, at the LD sheet's price per CF.",
        ["ldTypes", "ldDriverDay", "ldHelperDay", "ldCfPct"]],
      ["Foreman bonus — eligibility", "Checked per foreman per month from the closing sheets. The plan's '90% of records complete' rule is not measurable in our data and is left out.",
        ["bonusMinShifts", "bonusMinHours", "bonusMinJobs"]],
      ["Foreman bonus — bands", "This year's scores can't decide the band (the manager-assessed half exists for 14 of 231 foreman-months), so set how eligible months spread across the bands. The four shares should add up to 100%.",
        ["band1Amt", "band2Amt", "band3Amt", "band1Share", "band2Share", "band3Share", "band0Share"]],
    ];

    /* ---------- state ---------- */
    let saved = { value: {}, by: null, at: null, can_edit: false };
    try {
      const r = await fetch(ZTZ.API + "/api/_crewplan", { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
      if (r.ok) saved = await r.json();
    } catch (e) { /* the plan's defaults stand in */ }
    const S = window.__cpcState = window.__cpcState
      || { tab: /[#&]tab=settings/.test(location.hash) ? "settings" : "analysis", sort: "diff", q: "", draft: null };
    const savedSet = Object.assign({}, PLAN, saved.value || {});
    const cfg = () => S.draft || savedSet;

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>a year of crew pay</b>…</div><div class="bar"><i></i></div></div>`;
    const all = await RS.load("crew_pay_compare");
    injectCss();

    /* ---------- the replay ---------- */
    function compute(c) {
      const ld = new Set(String(c.ldTypes).split(",").map(x => x.trim()).filter(Boolean));
      const rows = all.filter(r => r["Company"] === COMPANY && r["Date"] >= c.from && r["Date"] <= c.to);
      const monthsBetween = (a, b) => (new Date(b) - new Date(a)) / (1000 * 3600 * 24 * 30.4375);
      const comp = () => ({ hourlyT: 0, hourlyN: 0, ldT: 0, ldN: 0, cfN: 0, poolN: 0, bonusN: 0, tips: 0 });
      const tot = comp(), bySeat = {}, byMonth = {}, people = {}, seatHours = {};
      const fm = {};   // foreman x month -> {days:Set, hours, jobs}
      let noHours = 0, ldRows = 0, ldCfJobs = new Set(), ldJobs = new Set(), jobs = new Set();
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
          if (isLD) {
            const est = num(r["Estimated CF"]), fin = num(r["Final CF"]), price = num(r["Price per CF"]);
            if (est > 0 && fin > 0 && price > 0) { ldCfJobs.add(r["Unique Key"]); n.cfN = Math.max(0, fin - est) * price * num(c.ldCfPct) / 100; }
          }
          const k = who + "|" + ym;
          const m = fm[k] = fm[k] || { who, ym, days: new Set(), hours: 0, jobs: 0 };
          m.days.add(d); m.hours += hours; m.jobs++;
        } else if (dayRow) {
          ldRows++; ldDays[role] = (ldDays[role] || 0) + days;
          tier = "Long-distance " + role.toLowerCase() + " (by the day)";
          tenure = { m: r["First Job"] ? monthsBetween(r["First Job"], d) : null, as: "with us" };
          t.ldT = sal;
          n.ldN = days * num(role === "Driver" ? c.ldDriverDay : c.ldHelperDay);
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
        const T = t.hourlyT + t.ldT, N = n.hourlyN + n.ldN + n.cfN + n.poolN;
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
      const T = o => o.hourlyT + o.ldT;
      const N = o => o.hourlyN + o.ldN + o.cfN + o.poolN + o.bonusN;
      return { rows, tot, bySeat, byMonth, people, T, N, ev, eligMonths, fmMonths, noHours, ldRows, ldLegs, seatHours,
               byJob, byTier, ldDays, soldTot,
               revenue, shownHours, paidHours, travelHours, travelBase, travelJobs: travelJobs.size, poolJobs: poolJobs.size,
               jobs: jobs.size, ldJobs: ldJobs.size, ldCfJobs: ldCfJobs.size };
    }

    /* ---------- paint ---------- */
    const fmtDay = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
    const mlabel = ym => { const [y, m] = ym.split("-"); return RS.monthName(+m).slice(0, 3) + " " + y.slice(2); };
    function paint() {
      const c = cfg();
      host.innerHTML = `
        <div class="cpc">
          <div class="rs-page-head"><h1>Crew Salary Comparison</h1>
            <p>What a year of crew pay would have cost under the drafted compensation plan, replayed job by job
              against what we actually paid · Zip to Zip jobs · ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}</p></div>
          <div class="rs-tabs cpc-tabs">
            <button class="rs-tab ${S.tab === "analysis" ? "on" : ""}" data-tab="analysis">Analysis</button>
            <button class="rs-tab ${S.tab === "settings" ? "on" : ""}" data-tab="settings">Settings${S.draft ? " · unsaved" : ""}</button>
          </div>
          <div id="cpcBody"></div>
        </div>`;
      host.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; paint(); });
      const body = host.querySelector("#cpcBody");
      if (S.tab === "settings") paintSettings(body, c); else paintAnalysis(body, c);
    }

    function paintAnalysis(body, c) {
      const R = compute(c), tot = R.tot, t = R.T(tot), n = R.N(tot);
      // THE WALK-THROUGH (his ask 2026-10-09: "i see the final results, but i am slightly confused
      // with how we got there"). Every part of pay is one step from today's total to the plan's,
      // and each says how it is worked out with this period's own inputs.
      const ldDays = R.ldDays.Driver + R.ldDays.Helper, $ = v => money(num(v));
      const TIER_ORDER = ["Entry helper", "Experienced helper", "Driver", "Foreman", "Senior foreman"];
      const tiers = TIER_ORDER.map(k => R.byTier[k]).filter(Boolean)
        .concat(Object.values(R.byTier).filter(b => !TIER_ORDER.includes(b.tier)));
      const tierT = tiers.reduce((a, b) => a + b.t, 0), tierN = tiers.reduce((a, b) => a + b.n, 0), tierH = tiers.reduce((a, b) => a + b.hours, 0);
      const steps = [
        { k: "Hourly wages", short: "Hourly rates", t: tot.hourlyT, n: tot.hourlyN,
          how: `${Math.round(tierH).toLocaleString()} hours paid (travel included) × each seat's new rate — seat by seat below. Today: what the sheets paid for the same hours.${R.ldLegs ? ` Includes ${R.ldLegs} hourly legs of long-distance jobs (loading and the like); long-distance days are their own step.` : ""}` },
        { k: "Long-distance day pay", short: "LD day pay", other: true, t: tot.ldT, n: tot.ldN,
          how: `${+R.ldDays.Driver.toFixed(1)} driver days × ${$(c.ldDriverDay)} + ${+R.ldDays.Helper.toFixed(1)} helper days × ${$(c.ldHelperDay)} — the days each day-rate row on the sheet says (2 days × $240 = $480 today).${ldDays ? ` Today those days were paid ${money(tot.ldT / ldDays)} each on average.` : ""}` },
        { k: "Long-distance CF share", short: "LD CF share", other: true, t: 0, n: tot.cfN,
          how: `${num(c.ldCfPct)}% × the CF moved beyond the Moveboard estimate × the LD sheet's price per CF, on the ${R.ldCfJobs} of ${R.ldJobs} long-distance jobs that have all three. New.` },
        { k: "Packing pool — drivers & helpers", short: "Packing pool", t: 0, n: tot.poolN,
          how: `${num(c.crewPackPct)}% × ${money(R.soldTot)} of packing materials sold: ${num(c.crewPackDriverShare)}% to the driver, the rest split over the helpers (a missing seat's half goes to the other). New — today they get none.` },
        { k: "Foreman bonus", short: "Foreman bonus", t: 0, n: tot.bonusN,
          how: `${R.eligMonths} of ${R.fmMonths} foreman-months qualify (${num(c.bonusMinShifts)} shifts, ${num(c.bonusMinHours)} h, ${num(c.bonusMinJobs)} jobs) × ${money(R.ev)} each = ${num(c.band1Share)}% × ${$(c.band1Amt)} + ${num(c.band2Share)}% × ${$(c.band2Amt)} + ${num(c.band3Share)}% × ${$(c.band3Amt)}, the band mix assumed in Settings. New.` },
      ].sort((a, b) => (b.n - b.t) - (a.n - a.t));
      // the three big steps stand alone; the small ones become ONE "Other" step (his ask 2026-10-09,
      // "combine this things please in Other") -- one bar on the waterfall, one row with its parts
      // listed under it in the table
      const others = steps.filter(p => p.other), main = steps.filter(p => !p.other);
      const other = { k: "Other", short: "Other", parts: others,
        t: others.reduce((a, p) => a + p.t, 0), n: others.reduce((a, p) => a + p.n, 0),
        how: `${others.map(p => p.k.replace(/^Long-distance/, "long-distance").replace(/^Packing commission — foreman/, "the foreman's packing commission")).join(", ").replace(/, ([^,]*)$/, " and $1").replace(/^./, ch => ch.toUpperCase())} together — each one below.` };
      const shownSteps = others.length ? main.concat([other]) : main;
      const maxAbs = Math.max(1, ...steps.concat(shownSteps).map(p => Math.abs(p.n - p.t)));
      const seats = ["Foreman", "Driver", "Helper"].filter(s => R.bySeat[s]);
      const months = Object.keys(R.byMonth).sort();
      const people = Object.values(R.people).filter(p => !S.q || p.who.toLowerCase().includes(S.q.toLowerCase()));
      const key = { diff: p => R.N(p) - R.T(p), today: p => R.T(p), new: p => R.N(p), name: p => p.who };
      people.sort((a, b) => S.sort === "name" ? a.who.localeCompare(b.who) : key[S.sort](b) - key[S.sort](a));
      const mainRole = p => Object.entries(p.roles).sort((a, b) => b[1] - a[1])[0][0];
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:5">
          <div class="kpi"><div class="l">Paid today</div><div class="v">${moneyK(t)}</div><div class="s">wages · tips, stairs, bulky &amp; foreman packing unchanged, left out</div></div>
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
              <tr class="cpc-totrow"><td class="cpc-stepn"></td><td><b>Paid today</b></td><td class="cpc-howcell">Hourly wages and long-distance day pay on ${R.jobs.toLocaleString()} Zip to Zip jobs, ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}. Tips, stairs, bulky-item pay and the foreman's 20% packing commission are left out — the plan pays them exactly as today.</td>
                <td class="num">${money(t)}</td><td></td><td></td><td></td></tr>
              ${shownSteps.map((p, i) => {
                const row = (q, num, cls) => {
                  const d = q.n - q.t, w = Math.round(Math.abs(d) / maxAbs * 100);
                  return `<tr class="${cls || ""}"><td class="cpc-stepn">${num}</td><td>${cls ? esc(q.k) : `<b>${esc(q.k)}</b>`}</td><td class="cpc-howcell">${q.how}</td>
                    <td class="num">${money(q.t)}</td><td class="num">${money(q.n)}</td>
                    <td class="num ${d > 0.5 ? "cpc-up" : d < -0.5 ? "cpc-down" : ""}">${Math.abs(d) < 0.5 ? "—" : signMoney(d)}</td>
                    <td class="cpc-barcell"><span class="cpc-bar ${d >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></td></tr>`;
                };
                return row(p, i + 1) + (p.parts || []).map(q => row(q, "", "cpc-subrow")).join("");
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
            <li><b>Today</b> is what was paid in wages on Zip to Zip jobs (Tuji, Boston and Virginia are left out): the closing sheets' hourly wage — a foreman's without his packing commission — and long-distance day pay. Tips, stairs, bulky-item pay and the foreman's packing commission (20% since December 2025, the plan's number) stay exactly as they are, so they sit outside the comparison.</li>
            <li><b>Hours</b> are the hours the wage was paid for (wage ÷ rate). The closing sheet only shows whole hours — a 10.5-hour job shows as 11 — so the new plan is replayed on ${Math.round(R.paidHours).toLocaleString()} hours, not the ${Math.round(R.shownHours).toLocaleString()} the sheets show.</li>
            ${R.travelBase ? `<li><b>Travel</b> stays as it is today: the foreman enters the miles, a lookup turns them into hours (1 h up to about 110 miles, then roughly ½ h more per 20 miles), and they are added to the job's hours. On the ${R.travelJobs.toLocaleString()} local jobs with a contract, ${Math.round(R.travelHours).toLocaleString()} of ${Math.round(R.travelBase).toLocaleString()} hours (${Math.round(R.travelHours / R.travelBase * 100)}%) are drive time. Both models pay drive time at the seat's full rate — today's contracts already do — so nothing is subtracted or paid at a lower rate.</li>` : ""}
            <li><b>Packing pool:</b> new money for drivers and helpers on ${R.poolJobs.toLocaleString()} jobs with packing sold. Today they get none of it; the foreman's own 20% is unchanged.</li>
            <li><b>Long distance:</b> ${R.ldJobs} jobs. Drivers and helpers paid by the day: ${R.ldRows} rows, ${+(R.ldDays.Driver + R.ldDays.Helper).toFixed(1)} days — the sheet's count of days on each day-rate row — × the plan's day pay. ${R.ldLegs} hourly legs (loading and the like) are paid hourly in both. The CF share needs an estimate, a final CF and a price per CF — ${R.ldCfJobs} of the ${R.ldJobs} jobs have all three.</li>
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
        shownSteps.forEach(p => { const d = p.n - p.t; bars.push([run, run + d]); run += d; cols.push(d >= 0 ? cUp : cDown); labs.push(p.short); vals.push(d); });
        bars.push([0, n]); cols.push(cTot); labs.push("New plan"); vals.push(n);
        const lo = Math.min(t, n, ...bars.map(b => Math.min(b[0], b[1])).filter(x => x > 0));
        const floor = Math.max(0, Math.floor(lo * 0.85 / 100000) * 100000);
        const lab = (v, i) => (i === 0 || i === vals.length - 1) ? moneyK(v) : (v >= 0 ? "+" : "−") + moneyK(Math.abs(v)).replace("−", "");
        new Chart(body.querySelector("#cpcWf"), {
          type: "bar",
          data: { labels: labs, datasets: [{ data: bars, backgroundColor: cols, borderRadius: 4, borderSkipped: false, maxBarThickness: 64 }] },
          options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 22 } },
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: x => lab(vals[x.dataIndex], x.dataIndex),
              afterLabel: x => { const p = shownSteps[x.dataIndex - 1]; return p && p.parts ? p.parts.map(q => q.short + ": " + lab(q.n - q.t, 1)) : ""; } } } },
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
        if (x.t.ldT) T.push(ln(x.dayRow && Math.abs(x.days * x.rate - x.t.ldT) < 1
          ? `${dl(x.days)} × ${m2(x.rate)} = <b>${m2(x.t.ldT)}</b>` : `day pay <b>${m2(x.t.ldT)}</b>`));
        if (!x.T) T.push(ln("nothing in the comparison", "cpc-sub"));
        T.push(ln(`= ${m2(x.T)}`, "cpc-tot"));
        if (x.shown && Math.abs(x.shown - x.hours) >= 0.01 && x.hours) T.push(ln(`the sheet shows ${h2(x.shown)} h`, "cpc-sub"));
        // the plan
        if (x.newRate != null && x.hours) N.push(ln(`${h2(x.hours)} h × ${m2(x.newRate)} = <b>${m2(x.n.hourlyN)}</b>`));
        else if (x.n.hourlyN) N.push(ln(`wage kept as paid <b>${m2(x.n.hourlyN)}</b>`));
        if (x.n.ldN) N.push(ln(`${dl(x.days)} × ${m2(num(x.role === "Driver" ? c.ldDriverDay : c.ldHelperDay))} = <b>${m2(x.n.ldN)}</b>`));
        if (x.n.cfN) N.push(ln(`+ ${m2(x.n.cfN)} CF share (${num(c.ldCfPct)}% of the extra CF)`));
        if (x.n.poolN) N.push(ln(`+ ${m2(x.n.poolN)} packing pool (${shareTxt(x.role === "Driver" ? dShare : 1 - dShare)} of ${num(c.crewPackPct)}% of ${m2(sold)}${x.role === "Helper" && nH > 1 ? ", ÷ " + nH + " helpers" : ""})`));
        if (!x.N) N.push(ln("nothing in the comparison", "cpc-sub"));
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
        <p class="cpc-note">Tips, stairs, bulky-item pay and the foreman's 20% packing commission are left out of both — the plan pays them exactly as today. The foreman bonus is paid per month, not per job${fms.length ? ": " + fms.join("; ") : ""}.</p>`;
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

    function paintSettings(body, c) {
      const ro = !saved.can_edit;
      const shareSum = num(c.band1Share) + num(c.band2Share) + num(c.band3Share) + num(c.band0Share);
      body.innerHTML = `
        <div class="cpc-setbar">
          <div class="cpc-sub">${saved.at ? "Saved " + esc(String(saved.at).slice(0, 16)) + (saved.by ? " by " + esc(saved.by) : "") : "Using the drafted plan's numbers — nothing saved yet."}
            ${ro ? " · Only an admin can change these." : ""}</div>
          <span class="spacer"></span>
          ${ro ? "" : `<button class="btn" id="cpcReset">Reset to the plan</button>
            <button class="btn" id="cpcDiscard" ${S.draft ? "" : "disabled"}>Discard changes</button>
            <button class="btn brand" id="cpcSave" ${S.draft ? "" : "disabled"}>Save for everyone</button>`}
        </div>
        ${S.draft ? `<div class="cpc-warn">Unsaved — the Analysis tab already shows these numbers; Save to make them everyone's.</div>` : ""}
        ${shareSum !== 100 ? `<div class="cpc-warn">The four band shares add up to ${shareSum}%, not 100%.</div>` : ""}
        <div class="cpc-sets">${GROUPS.map(([title, help, keys]) => `
          <section class="panel"><div class="panel-head"><span class="panel-title">${title}</span></div>
            <p class="cpc-note">${help}</p>
            <div class="cpc-fields">${keys.map(k => {
              const isDate = k === "from" || k === "to", isText = k === "ldTypes";
              const changed = String(c[k]) !== String(PLAN[k]);
              return `<label class="cpc-f"><span>${LABELS[k]}</span>
                <input data-k="${k}" type="${isDate ? "date" : isText ? "text" : "number"}" ${isDate || isText ? "" : 'step="any" min="0"'}
                  value="${esc(String(c[k]))}" ${ro ? "disabled" : ""}>
                <em>${changed ? "plan: " + esc(String(PLAN[k])) : ""}</em></label>`;
            }).join("")}</div></section>`).join("")}</div>`;
      body.querySelectorAll("input[data-k]").forEach(inp => inp.onchange = () => {
        const k = inp.dataset.k, v = inp.type === "number" ? (inp.value === "" ? 0 : +inp.value) : inp.value;
        S.draft = Object.assign({}, cfg(), { [k]: v });
        paint();
      });
      const btn = id => body.querySelector(id);
      if (btn("#cpcReset")) btn("#cpcReset").onclick = () => { S.draft = Object.assign({}, PLAN); paint(); };
      if (btn("#cpcDiscard")) btn("#cpcDiscard").onclick = () => { S.draft = null; paint(); };
      if (btn("#cpcSave")) btn("#cpcSave").onclick = async () => {
        const b = btn("#cpcSave"); b.disabled = true; b.textContent = "Saving…";
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
      };
    }

    function injectCss() {
      if (document.getElementById("cpc-css")) return;
      const s = document.createElement("style"); s.id = "cpc-css";
      s.textContent = `
        .cpc-tabs{margin-bottom:16px}
        .cpc-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:16px}
        @media(max-width:1200px){.cpc-grid{grid-template-columns:1fr}}
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
        .cpc-sets{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:16px}
        .cpc-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-top:12px}
        .cpc-f{display:flex;flex-direction:column;gap:5px}
        .cpc-f span{font-size:12.5px;color:var(--muted)}
        .cpc-f input{font:inherit;font-size:14px;border:1px solid var(--line-2);border-radius:8px;padding:8px 10px;background:var(--panel);color:var(--ink)}
        .cpc-f input:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}
        .cpc-f em{font-style:normal;font-size:11.5px;color:var(--warn);min-height:14px}
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
        .cpc-subrow td{font-size:12.5px;color:var(--muted);border-top:1px dotted var(--line-2)}
        .cpc-subrow td:nth-child(2){padding-left:26px}
        .cpc-job .panel-head{flex-wrap:wrap;gap:8px}
        .cpc-jobpick{position:relative}
        .cpc-jobpick .cpc-q{min-width:340px}
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
      `;
      document.head.appendChild(s);
    }

    paint();
  },
});
