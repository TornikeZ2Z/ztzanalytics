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
   is filled for 14 of 231 foreman-months, and the score never reaches 80). */
if (window.RS && RS.DATASETS && !RS.DATASETS.crew_pay_compare) {
  RS.DATASETS.crew_pay_compare = {
    table: "mart_crew_pay_compare",
    cols: ["Unique Key", "Date", "Month", "Company", "Job No", "Request #", "Customer", "Moving Type",
           "Job Foreman", "Role", "Person", "Hours", "Rate", "Salary", "Tip", "First Job",
           "First Foreman Job", "Crew Size", "Job Bill", "Packing Sold", "Packing Commission",
           "Has Contract", "Stairs Fee", "Bulky Fee", "Stairs Paid", "Bulky Paid",
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
    const PLAN = {
      from: "2025-10-01", to: "2026-09-30",
      helperEntry: 18, helperExp: 20, expHelperMonths: 3,
      driver: 22, foreman: 25, seniorForeman: 27, seniorForemanYears: 2,
      stairsShare: 100, bulkyShare: 50, packingPct: 20,
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
      stairsShare: "Stairs: % of the charge to the crew", bulkyShare: "Bulky items: % of the charge to the crew", packingPct: "Packing: foreman's % of materials sold",
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
      ["Job-based pay", "From the contract's stairs and bulky-item charges (jobs with a Digital Contract), and the closing sheet's packing materials.",
        ["stairsShare", "bulkyShare", "packingPct"]],
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
      const rows = all.filter(r => r["Date"] >= c.from && r["Date"] <= c.to);
      const monthsBetween = (a, b) => (new Date(b) - new Date(a)) / (1000 * 3600 * 24 * 30.4375);
      const comp = () => ({ hourlyT: 0, hourlyN: 0, ldT: 0, ldN: 0, cfN: 0, packT: 0, packN: 0, sbT: 0, sbN: 0, bonusN: 0, tips: 0 });
      const tot = comp(), bySeat = {}, byMonth = {}, people = {};
      const fm = {};   // foreman x month -> {days:Set, hours, jobs}
      let noHours = 0, ldRows = 0, ldCfJobs = new Set(), ldJobs = new Set(), contractJobs = new Set(), jobs = new Set();
      rows.forEach(r => {
        const role = r["Role"], who = r["Person"] || "(no name)", d = r["Date"], ym = r["Month"];
        const isLD = ld.has(r["Moving Type"]);
        const sal = num(r["Salary"]), tip = num(r["Tip"]), packT = role === "Foreman" ? num(r["Packing Commission"]) : 0;
        let hours = num(r["Hours"]);
        if (!hours && sal > 0 && num(r["Rate"]) > 0) hours = sal / num(r["Rate"]);   // a row with pay but no hours
        if (!hours && sal > 0) noHours++;
        // today: what was paid, split into its parts
        const t = comp(), n = comp();
        t.tips = tip;
        t.packT = packT;
        // new: the plan
        if (role === "Foreman") {
          const senior = r["First Foreman Job"] && monthsBetween(r["First Foreman Job"], d) >= num(c.seniorForemanYears) * 12;
          n.hourlyN = hours * num(senior ? c.seniorForeman : c.foreman);
          t.hourlyT = Math.max(0, sal - packT);
          n.packN = num(r["Packing Sold"]) * num(c.packingPct) / 100;
          if (isLD) {
            const est = num(r["Estimated CF"]), fin = num(r["Final CF"]), price = num(r["Price per CF"]);
            if (est > 0 && fin > 0 && price > 0) { ldCfJobs.add(r["Unique Key"]); n.cfN = Math.max(0, fin - est) * price * num(c.ldCfPct) / 100; }
          }
          const k = who + "|" + ym;
          const m = fm[k] = fm[k] || { who, ym, days: new Set(), hours: 0, jobs: 0 };
          m.days.add(d); m.hours += hours; m.jobs++;
        } else if (isLD) {
          ldRows++;
          t.ldT = sal;
          n.ldN = num(role === "Driver" ? c.ldDriverDay : c.ldHelperDay);
        } else {
          const exp = role === "Helper" && r["First Job"] && monthsBetween(r["First Job"], d) >= num(c.expHelperMonths);
          t.hourlyT = sal;
          n.hourlyN = hours * num(role === "Driver" ? c.driver : (exp ? c.helperExp : c.helperEntry));
        }
        if (!hours && sal > 0) { n.hourlyN = t.hourlyT; }   // keep what was paid when there is nothing to replay
        // stairs + bulky are crew money per JOB: split evenly over the crew on it
        const crew = Math.max(1, num(r["Crew Size"]));
        if (num(r["Has Contract"])) {
          t.sbT = (num(r["Stairs Paid"]) + num(r["Bulky Paid"])) / crew;
          n.sbN = (num(r["Stairs Fee"]) * num(c.stairsShare) + num(r["Bulky Fee"]) * num(c.bulkyShare)) / 100 / crew;
          contractJobs.add(r["Unique Key"]);
        }
        jobs.add(r["Unique Key"]);
        if (isLD) ldJobs.add(r["Unique Key"]);
        const T = t.hourlyT + t.ldT + t.packT + t.sbT, N = n.hourlyN + n.ldN + n.cfN + n.packN + n.sbN;
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
      const T = o => o.hourlyT + o.ldT + o.packT + o.sbT;
      const N = o => o.hourlyN + o.ldN + o.cfN + o.packN + o.sbN + o.bonusN;
      return { rows, tot, bySeat, byMonth, people, T, N, ev, eligMonths, fmMonths, noHours, ldRows,
               jobs: jobs.size, contractJobs: contractJobs.size, ldJobs: ldJobs.size, ldCfJobs: ldCfJobs.size };
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
              against what we actually paid · ${esc(fmtDay(c.from))} – ${esc(fmtDay(c.to))}</p></div>
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
      const parts = [
        ["Hourly wages", "Hours × the seat's rate (tenure decides entry/experienced and senior)", tot.hourlyT, tot.hourlyN],
        ["Long-distance day pay", `Drivers and helpers on ${esc(String(c.ldTypes).replace(/,/g, ", "))} jobs, per day`, tot.ldT, tot.ldN],
        ["Long-distance CF share", "Foreman's share of the CF moved beyond the estimate", 0, tot.cfN],
        ["Packing commission", "Foreman's share of packing materials sold", tot.packT, tot.packN],
        ["Stairs & bulky items", "Crew share of the contract's charges (contract jobs only)", tot.sbT, tot.sbN],
        ["Foreman bonus", `${R.eligMonths} eligible foreman-months × ${money(R.ev)} expected`, 0, tot.bonusN],
      ];
      const maxAbs = Math.max(1, ...parts.map(p => Math.abs(p[3] - p[2])));
      const seats = ["Foreman", "Driver", "Helper"].filter(s => R.bySeat[s]);
      const months = Object.keys(R.byMonth).sort();
      const people = Object.values(R.people).filter(p => !S.q || p.who.toLowerCase().includes(S.q.toLowerCase()));
      const key = { diff: p => R.N(p) - R.T(p), today: p => R.T(p), new: p => R.N(p), name: p => p.who };
      people.sort((a, b) => S.sort === "name" ? a.who.localeCompare(b.who) : key[S.sort](b) - key[S.sort](a));
      const mainRole = p => Object.entries(p.roles).sort((a, b) => b[1] - a[1])[0][0];
      body.innerHTML = `
        <div class="rs-kpis" style="--kpi-cols:4">
          <div class="kpi"><div class="l">Paid today</div><div class="v">${moneyK(t)}</div><div class="s">wages, packing, stairs &amp; bulky · tips not included</div></div>
          <div class="kpi"><div class="l">Under the new plan</div><div class="v">${moneyK(n)}</div><div class="s">same jobs, same hours</div></div>
          <div class="kpi cpc-kd"><div class="l">Difference over the year</div><div class="v">${n >= t ? "+" : "−"}${moneyK(Math.abs(n - t)).replace("−", "")}</div>
            <div class="s">${delta(n, t)} vs today</div></div>
          <div class="kpi"><div class="l">Tips (unchanged)</div><div class="v">${moneyK(tot.tips)}</div><div class="s">${Object.keys(R.people).length} people · ${R.jobs.toLocaleString()} jobs</div></div>
        </div>
        <div class="cpc-grid">
          <section class="panel">
            <div class="panel-head"><span class="panel-title">Where the difference comes from</span></div>
            <div class="rs-tablewrap"><table class="rs-table cpc-parts">
              <thead><tr><th>Part of pay</th><th class="num">Today</th><th class="num">New plan</th><th class="num">Difference</th><th></th></tr></thead>
              <tbody>${parts.map(p => {
                const d = p[3] - p[2], w = Math.round(Math.abs(d) / maxAbs * 100);
                return `<tr><td><b>${p[0]}</b><div class="cpc-sub">${p[1]}</div></td>
                  <td class="num">${money(p[2])}</td><td class="num">${money(p[3])}</td>
                  <td class="num ${d > 0.5 ? "cpc-up" : d < -0.5 ? "cpc-down" : ""}">${Math.abs(d) < 0.5 ? "—" : signMoney(d)}</td>
                  <td class="cpc-barcell"><span class="cpc-bar ${d >= 0 ? "pos" : "neg"}" style="width:${w}%"></span></td></tr>`;
              }).join("")}</tbody>
              <tfoot><tr><td>Total</td><td class="num">${money(t)}</td><td class="num">${money(n)}</td><td class="num">${signMoney(n - t)}</td><td></td></tr></tfoot>
            </table></div>
          </section>
          <section class="panel">
            <div class="panel-head"><span class="panel-title">By seat</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Seat</th><th class="num">Today</th><th class="num">New plan</th><th class="num">Difference</th><th class="num">$ / hour today → new</th></tr></thead>
              <tbody>${seats.map(s => {
                const o = R.bySeat[s], h = R.rows.filter(r => r["Role"] === s).reduce((a, r) => a + num(r["Hours"]), 0);
                return `<tr><td><b>${s === "Foreman" ? "Foremen" : s + "s"}</b></td><td class="num">${money(R.T(o))}</td><td class="num">${money(R.N(o))}</td>
                  <td class="num">${delta(R.N(o), R.T(o))}</td>
                  <td class="num">${h ? "$" + (R.T(o) / h).toFixed(2) + " → $" + (R.N(o) / h).toFixed(2) : "—"}</td></tr>`;
              }).join("")}</tbody>
            </table></div>
            <p class="cpc-note">$ per hour here is everything in the comparison divided by hours worked, so it includes packing, stairs and the bonus — not the base rate.</p>
          </section>
        </div>
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
            <li><b>Today</b> is what was paid: the closing sheets' wage (a foreman's already includes his packing commission) plus the stairs and bulky pay on the Digital Contract. Tips are the same in both models and sit outside the comparison.</li>
            <li><b>Stairs &amp; bulky</b> exist only for jobs with a contract: ${R.contractJobs.toLocaleString()} of ${R.jobs.toLocaleString()} jobs (${R.jobs ? Math.round(R.contractJobs / R.jobs * 100) : 0}%). Both models use the same jobs, so the gap is fair; the totals are lower than the whole year's.</li>
            <li><b>Long distance:</b> ${R.ldJobs} jobs, ${R.ldRows} driver/helper days. The CF share needs an estimate, a final CF and a price per CF — ${R.ldCfJobs} of the ${R.ldJobs} jobs have all three.</li>
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
      const q = body.querySelector("#cpcQ");
      q.oninput = () => { S.q = q.value; const pos = q.selectionStart; paintAnalysis(body, c); const q2 = body.querySelector("#cpcQ"); q2.focus(); q2.setSelectionRange(pos, pos); };
      body.querySelectorAll("[data-sort]").forEach(b => b.onclick = () => { S.sort = b.dataset.sort; paintAnalysis(body, c); });
      body.querySelectorAll("tr[data-who]").forEach(tr => tr.onclick = () => openPerson(R, tr.dataset.who));
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
      `;
      document.head.appendChild(s);
    }

    paint();
  },
});
