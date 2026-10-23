/* FLAT RATE ANALYSIS -- flat vs hourly Local Moving jobs (Financial).

   Giga's ask, through Tornike (2026-10-23): "give the analysis of Flat Rates - like this year, how
   did the flat rates for Local Moving went and compare it with non-flat rates ... add it in a single
   analysis page". His picks: Financial, right after Job P&L, opened by Financial holders only -- it
   shows margins and a per-rep breakdown.

   The warehouse marks the jobs (src/flat_rate.py -> mart_flat_rate_jobs, mart_flat_rate_requests);
   this page does the comparing:
   - FLAT vs HOURLY: Zip to Zip Local Moving closings since January 2026 (the closing sheet's Is Flat
     Rate starts there), labor-only jobs left out of the hourly side;
   - DID FLAT BEAT HOURLY: the going hourly price per crew size -- hourly contracts' labor charge
     divided by the hours they paid, the median, from at least 10 jobs -- times the flat job's hours,
     plus the packing it sold (a flat price includes the materials; an hourly bill adds them);
   - BOOKING: Moveboard requests, good leads (not Bad Lead) that became Confirmed. */
if (window.RS && RS.DATASETS && !RS.DATASETS.flat_rate_jobs) {
  RS.DATASETS.flat_rate_jobs = {
    table: "mart_flat_rate_jobs",
    cols: ["Unique Key", "Date", "Month", "Job Code", "Closing #", "Customer", "Sales Person", "Source",
           "Crew Size", "Is Flat", "Is Labor Only", "Contract Job Type", "Service Type", "Size of Move",
           "Hours", "CF", "Total Bill", "Packing Sold", "Crew Pay", "Sales Commission", "Ad Cost", "Card Fee",
           "Full Profit", "Profit Before Fixed", "Customer Tip", "Claims Filed", "Refunds",
           "Hourly Labor Charge", "Quote Min", "Quote Max"],
    dateCols: {}, defaultDate: null,
  };
  RS.DATASETS.flat_rate_requests = {
    table: "mart_flat_rate_requests",
    cols: ["Month", "Service Type", "Size of Move", "Status Category", "Requests"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "flat-rate",
  group: "financial",
  title: "Flat Rate Analysis",
  async render(host) {
    const esc = RSC.esc;
    const num = v => (v == null || v === "" || isNaN(v) ? 0 : +v);
    const money = v => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
    const moneyK = v => { const a = Math.abs(v), s = v < 0 ? "−$" : "$";
      return a >= 1e6 ? s + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + Math.round(a / 1e3) + "k" : s + Math.round(a).toLocaleString("en-US"); };
    const signK = v => (v < 0 ? "−" : "+") + moneyK(Math.abs(v)).replace("−", "");
    const pct = (a, b, d = 1) => b ? (a / b * 100).toFixed(d) + "%" : "—";
    const signPct = (a, b) => b ? (a >= b ? "+" : "−") + Math.abs((a / b - 1) * 100).toFixed(1) + "%" : "—";
    const sum = (xs, f) => xs.reduce((s, r) => s + num(typeof f === "function" ? f(r) : r[f]), 0);
    const median = a => { const s = a.filter(v => v != null && !isNaN(v)).sort((x, y) => x - y), n = s.length;
      return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
    const mlabel = ym => { const [y, m] = ym.split("-"); return RS.monthName(+m).slice(0, 3) + " " + y.slice(2); };
    const fmtDay = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>flat-rate and hourly jobs</b>…</div><div class="bar"><i></i></div></div>`;
    const [all, reqs] = await Promise.all([RS.load("flat_rate_jobs"), RS.load("flat_rate_requests")]);
    injectCss();

    /* ---------- the two sides ---------- */
    const jobs = all.filter(r => !num(r["Is Labor Only"]));
    const F = jobs.filter(r => num(r["Is Flat"])), H = jobs.filter(r => !num(r["Is Flat"]));
    const crewH = r => num(r["Hours"]) * num(r["Crew Size"]);
    function side(xs) {
      const bill = sum(xs, "Total Bill"), ch = sum(xs, crewH);
      return { n: xs.length, bill, ch, crew: sum(xs, "Crew Pay"), sales: sum(xs, "Sales Commission"), ads: sum(xs, "Ad Cost"),
        pre: sum(xs, "Profit Before Fixed"), pack: sum(xs, "Packing Sold"), tip: sum(xs, "Customer Tip"),
        claims: sum(xs, "Claims Filed"), refunds: sum(xs, "Refunds"),
        withPack: xs.filter(r => num(r["Packing Sold"]) > 0).length,
        medBill: median(xs.map(r => num(r["Total Bill"]))), medCf: median(xs.filter(r => num(r["CF"]) > 0).map(r => num(r["CF"]))),
        medHours: median(xs.filter(r => num(r["Hours"]) > 0).map(r => num(r["Hours"]))),
        avgCrew: xs.length ? sum(xs, "Crew Size") / xs.length : 0 };
    }
    const sF = side(F), sH = side(H);

    /* ---------- did flat beat hourly ---------- */
    // the going hourly price per crew size: an hourly contract's labor charge / the hours it paid
    const MIN_N = 10, perCrew = {};
    H.forEach(r => { const h = num(r["Hours"]), fee = num(r["Hourly Labor Charge"]), c = num(r["Crew Size"]);
      if (h > 0 && fee > 0 && c) (perCrew[c] = perCrew[c] || []).push(fee / h); });
    const rate = {};
    Object.entries(perCrew).forEach(([c, xs]) => { if (xs.length >= MIN_N) rate[c] = { v: median(xs), n: xs.length }; });
    const cmp = F.map(r => {
      const c = num(r["Crew Size"]), h = num(r["Hours"]), rt = rate[c];
      if (!rt || !(h > 0)) return null;
      const eq = rt.v * h + num(r["Packing Sold"]), bill = num(r["Total Bill"]);
      return { r, c, h, eq, bill, diff: bill - eq };
    }).filter(Boolean);
    const cB = sum(cmp, x => x.bill), cE = sum(cmp, x => x.eq), won = cmp.filter(x => x.diff > 0), lost = cmp.filter(x => x.diff < 0);
    const LONG = 9, longJobs = cmp.filter(x => x.h > LONG), shortJobs = cmp.filter(x => x.h <= LONG);

    /* ---------- booking ---------- */
    const SVC = { flat: "Flat Rate", hourly: "Local Moving" };
    const good = r => r["Status Category"] !== "Bad Lead", booked = r => r["Status Category"] === "Confirmed";
    function funnel(xs) { const g = sum(xs.filter(good), "Requests"), b = sum(xs.filter(booked), "Requests");
      return { all: sum(xs, "Requests"), good: g, booked: b, rate: g ? b / g : null }; }
    const bF = funnel(reqs.filter(r => r["Service Type"] === SVC.flat)), bH = funnel(reqs.filter(r => r["Service Type"] === SVC.hourly));

    const months = [...new Set(jobs.map(r => r["Month"]))].sort();
    const firstFlat = F.map(r => r["Date"]).sort()[0];

    /* ---------- paint ---------- */
    if (!F.length) {
      host.innerHTML = `<div class="flr"><div class="rs-page-head"><h1>Flat Rate Analysis</h1></div>
        <section class="panel"><p class="flr-note">No flat-rate Local Moving jobs since January 2026 yet.</p></section></div>`;
      return;
    }
    const mF = sF.pre / sF.bill, mH = sH.pre / sH.bill;
    const crewF = sF.crew / sF.bill, crewHs = sH.crew / sH.bill;
    const lostSum = sum(lost, x => x.diff), longSum = sum(longJobs, x => x.diff), shortSum = sum(shortJobs, x => x.diff);
    const rates = Object.entries(rate).sort((a, b) => +a[0] - +b[0]);

    const ROWS = [
      ["Jobs", s => s.n.toLocaleString()],
      ["Revenue", s => money(s.bill)],
      ["Average bill", s => money(s.n ? s.bill / s.n : 0)],
      ["Median bill", s => money(s.medBill || 0)],
      ["Median size", s => s.medCf ? Math.round(s.medCf).toLocaleString() + " CF" : "—"],
      ["Average crew", s => s.avgCrew.toFixed(1) + " men"],
      ["Median hours paid", s => s.medHours != null ? s.medHours.toFixed(1) + " h" : "—"],
      ["Bill per crew-hour", s => s.ch ? "$" + (s.bill / s.ch).toFixed(0) : "—"],
      ["Crew pay", s => pct(s.crew, s.bill) + " of the bill"],
      ["Sales commission", s => pct(s.sales, s.bill)],
      ["Ads", s => pct(s.ads, s.bill) + ` <span class="flr-sub">${money(s.n ? s.ads / s.n : 0)} a job</span>`],
      ["Margin before fixed costs", s => `<b>${pct(s.pre, s.bill)}</b> <span class="flr-sub">${money(s.n ? s.pre / s.n : 0)} a job</span>`],
      ["Margin per crew-hour", s => s.ch ? "$" + (s.pre / s.ch).toFixed(0) : "—"],
      ["Packing sold", s => money(s.n ? s.pack / s.n : 0) + ` a job <span class="flr-sub">on ${pct(s.withPack, s.n, 0)} of jobs</span>`],
      ["Customer tip", s => money(s.n ? s.tip / s.n : 0) + " a job"],
      ["Claims", s => (s.n ? s.claims / s.n * 100 : 0).toFixed(1) + " per 100 jobs"],
      ["Refunds", s => money(s.n ? s.refunds / s.n : 0) + " a job"],
    ];

    // like for like: the same size of move
    const BANDS = [[0, 250, "Under 250 CF"], [250, 400, "250–400 CF"], [400, 600, "400–600 CF"], [600, 900, "600–900 CF"], [900, 1e9, "900 CF and over"]];
    const inBand = ([lo, hi]) => r => num(r["CF"]) >= lo && num(r["CF"]) < hi;
    const pair = (f, h) => `<b>${f}</b> <span class="flr-sub">vs ${h}</span>`;

    // did flat beat hourly, by how long the job ran
    const HB = [[0, 5, "5 h or less"], [5, 7, "5–7 h"], [7, 9, "7–9 h"], [9, 12, "9–12 h"], [12, 99, "over 12 h"]];
    const hbRows = HB.map(([lo, hi, l]) => { const xs = cmp.filter(x => x.h > lo && x.h <= hi);
      return { l, n: xs.length, b: sum(xs, x => x.bill), e: sum(xs, x => x.eq), lost: xs.filter(x => x.diff < 0).length }; }).filter(x => x.n);
    const worst = cmp.slice().sort((a, b) => a.diff - b.diff).slice(0, 8).filter(x => x.diff < 0);
    const jobLink = r => { const k = r["Job Code"] || r["Closing #"]; return k ? `#page=job-pnl&job=${encodeURIComponent(k)}` : ""; };

    // by sales rep
    const reps = {};
    F.forEach(r => { const k = r["Sales Person"] || "(none)"; (reps[k] = reps[k] || { flat: 0, bill: 0, cmp: [] }).flat++; reps[k].bill += num(r["Total Bill"]); });
    cmp.forEach(x => { const k = x.r["Sales Person"] || "(none)"; reps[k].cmp.push(x); });
    const localOf = {};
    jobs.forEach(r => { const k = r["Sales Person"] || "(none)"; localOf[k] = (localOf[k] || 0) + 1; });
    const repRows = Object.entries(reps).map(([k, o]) => ({ k, ...o, net: sum(o.cmp, x => x.diff), lost: o.cmp.filter(x => x.diff < 0).length, local: localOf[k] || 0 }))
      .sort((a, b) => b.flat - a.flat || b.net - a.net);

    // booking by month and by size of move
    const reqMonths = [...new Set(reqs.map(r => r["Month"]))].sort();
    const fm = m => funnel(reqs.filter(r => r["Month"] === m && r["Service Type"] === SVC.flat));
    const hm = m => funnel(reqs.filter(r => r["Month"] === m && r["Service Type"] === SVC.hourly));
    const sizes = [...new Set(reqs.filter(good).map(r => r["Size of Move"]))];
    const sizeRows = sizes.map(sz => { const f = funnel(reqs.filter(r => r["Size of Move"] === sz && r["Service Type"] === SVC.flat)),
      h = funnel(reqs.filter(r => r["Size of Move"] === sz && r["Service Type"] === SVC.hourly)); return { sz, f, h }; })
      .filter(x => x.f.good || x.h.good).sort((a, b) => b.f.good - a.f.good || b.h.good - a.h.good);

    // the final bill against the quote
    function quote(xs) {
      const q = xs.filter(r => num(r["Quote Max"]) > 0), rs = q.map(r => num(r["Total Bill"]) / num(r["Quote Max"]));
      return { n: q.length, of: xs.length, within: rs.filter(v => v > 0.9 && v < 1.1).length, over: rs.filter(v => v >= 1.1).length,
               under: rs.filter(v => v <= 0.9).length, med: median(rs) };
    }
    const qF = quote(F), qH = quote(H);

    host.innerHTML = `
      <div class="flr">
        <div class="rs-page-head"><h1>Flat Rate Analysis</h1>
          <p>Flat-rate against hourly Local Moving jobs · Zip to Zip · ${esc(fmtDay(months[0] + "-01"))} – ${esc(fmtDay(jobs.map(r => r["Date"]).sort().pop()))} ·
            the first flat job closed ${esc(fmtDay(firstFlat))}</p></div>
        <div class="rs-kpis" style="--kpi-cols:5">
          <div class="kpi"><div class="l">Flat-rate jobs</div><div class="v">${sF.n.toLocaleString()}</div><div class="s">${pct(sF.n, sF.n + sH.n)} of local jobs · ${sH.n.toLocaleString()} hourly</div></div>
          <div class="kpi"><div class="l">Flat-rate revenue</div><div class="v">${moneyK(sF.bill)}</div><div class="s">${money(sF.bill / sF.n)} a job · hourly ${money(sH.bill / sH.n)}</div></div>
          <div class="kpi"><div class="l">Price against hourly</div><div class="v">${signPct(cB, cE)}</div><div class="s">${signK(cB - cE)} over the same hours billed hourly</div></div>
          <div class="kpi"><div class="l">Margin before fixed costs</div><div class="v">${pct(sF.pre, sF.bill)}</div><div class="s">hourly ${pct(sH.pre, sH.bill)}</div></div>
          <div class="kpi"><div class="l">Booking rate</div><div class="v">${bF.rate != null ? (bF.rate * 100).toFixed(1) + "%" : "—"}</div><div class="s">of good flat-rate leads · hourly ${bH.rate != null ? (bH.rate * 100).toFixed(1) + "%" : "—"}</div></div>
        </div>
        <section class="panel"><div class="panel-head"><span class="panel-title">What it says</span></div>
          <ul class="flr-say">
            <li><b>The price works on short jobs.</b> Flat jobs billed ${money(cB)} where the same hours would have billed ${money(cE)} hourly — <b>${signK(cB - cE)} (${signPct(cB, cE)})</b>. ${won.length} of ${cmp.length} came out ahead; jobs of ${LONG} hours or less made ${signK(shortSum)}, while the ${longJobs.length} that ran longer lost ${moneyK(-longSum).replace("−", "")}${longSum > 0 ? " (they made money too)" : ""}.</li>
            <li><b>They keep less.</b> ${pct(sF.pre, sF.bill)} of a flat bill is left before fixed costs, against ${pct(sH.pre, sH.bill)} hourly: the crew takes ${pct(sF.crew, sF.bill)} of a flat bill against ${pct(sH.crew, sH.bill)}, and the ads cost about the same per job (${money(sF.ads / sF.n)} against ${money(sH.ads / sH.n)}) on smaller bills.</li>
            <li><b>They book like hourly.</b> ${bF.rate != null ? (bF.rate * 100).toFixed(1) + "%" : "—"} of good flat-rate requests booked, against ${bH.rate != null ? (bH.rate * 100).toFixed(1) + "%" : "—"} for hourly local moves.</li>
            <li><b>The bill lands on the quote.</b> ${pct(qF.within, qF.n, 0)} of flat bills came within 10% of the quote, against ${pct(qH.within, qH.n, 0)} of hourly bills.</li>
          </ul></section>
        <div class="flr-grid">
          <section class="panel"><div class="panel-head"><span class="panel-title">Flat-rate jobs a month</span></div>
            <div class="chartbox" style="height:260px"><canvas id="flrTrend" role="img" aria-label="Flat-rate jobs a month"></canvas></div>
            <p class="flr-note">Hover a month for its share of local jobs.</p></section>
          <section class="panel"><div class="panel-head"><span class="panel-title">Flat against hourly</span></div>
            <div class="rs-tablewrap"><table class="rs-table flr-vs">
              <thead><tr><th></th><th class="num">Flat rate</th><th class="num">Hourly</th></tr></thead>
              <tbody>${ROWS.map(([l, f]) => `<tr><td>${l}</td><td class="num">${f(sF)}</td><td class="num">${f(sH)}</td></tr>`).join("")}</tbody>
            </table></div></section>
        </div>
        <section class="panel"><div class="panel-head"><span class="panel-title">The same size of move</span>
            <span class="flr-sub">flat <b>in bold</b> vs hourly</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Size</th><th class="num">Jobs</th><th class="num">Median bill</th><th class="num">Median hours</th><th class="num">Bill per crew-hour</th><th class="num">Crew pay</th><th class="num">Margin before fixed</th></tr></thead>
            <tbody>${BANDS.map(b => { const f = side(F.filter(inBand(b))), h = side(H.filter(inBand(b)));
              if (!f.n && !h.n) return "";
              return `<tr class="${f.n < 10 ? "flr-thin" : ""}"><td><b>${b[2]}</b></td><td class="num">${pair(f.n, h.n)}</td>
                <td class="num">${pair(money(f.medBill || 0), money(h.medBill || 0))}</td>
                <td class="num">${pair(f.medHours != null ? f.medHours.toFixed(1) : "—", h.medHours != null ? h.medHours.toFixed(1) : "—")}</td>
                <td class="num">${pair(f.ch ? "$" + (f.bill / f.ch).toFixed(0) : "—", h.ch ? "$" + (h.bill / h.ch).toFixed(0) : "—")}</td>
                <td class="num">${pair(pct(f.crew, f.bill), pct(h.crew, h.bill))}</td>
                <td class="num">${pair(pct(f.pre, f.bill), pct(h.pre, h.bill))}</td></tr>`; }).join("")}</tbody>
          </table></div>
          <p class="flr-note">Size is the contract's cubic feet (Moveboard's without a contract). Faded rows have fewer than 10 flat jobs.</p></section>
        <section class="panel"><div class="panel-head"><span class="panel-title">Did flat beat hourly?</span>
            <span class="flr-sub">each flat job against the same hours at the going hourly price</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Job ran</th><th class="num">Flat jobs</th><th class="num">Flat billed</th><th class="num">Hourly would have billed</th><th class="num">Difference</th><th class="num">Jobs that lost</th></tr></thead>
            <tbody>${hbRows.map(x => `<tr><td><b>${x.l}</b></td><td class="num">${x.n}</td><td class="num">${money(x.b)}</td><td class="num">${money(x.e)}</td>
              <td class="num ${x.b - x.e < 0 ? "flr-neg" : ""}"><b>${signK(x.b - x.e)}</b> · ${signPct(x.b, x.e)}</td><td class="num">${x.lost} of ${x.n}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>All flat jobs</td><td class="num">${cmp.length}</td><td class="num">${money(cB)}</td><td class="num">${money(cE)}</td>
              <td class="num">${signK(cB - cE)} · ${signPct(cB, cE)}</td><td class="num">${lost.length} of ${cmp.length}</td></tr></tfoot>
          </table></div>
          <p class="flr-note">The going hourly price is what hourly contracts charged per hour of a crew's time this year (labor charge ÷ hours paid, the median): ${rates.map(([c, o]) => `${c} men $${Math.round(o.v)}/h`).join(" · ")}. A flat job is priced at its crew's rate × the hours it paid, plus the packing it sold — a flat price includes the materials. ${F.length - cmp.length ? `${F.length - cmp.length === 1 ? "1 flat job has" : F.length - cmp.length + " flat jobs have"} no hours or an unusual crew size and ${F.length - cmp.length === 1 ? "is" : "are"} left out.` : ""} A flat crew may work faster than an hourly one would, so this leans slightly in flat's favour.</p>
          ${worst.length ? `<div class="flr-subhead">The flat jobs that lost the most</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Date</th><th>Customer</th><th>Sales person</th><th class="num">Crew</th><th class="num">Hours</th><th class="num">Size</th><th class="num">Flat bill</th><th class="num">Hourly would have billed</th><th class="num">Difference</th></tr></thead>
            <tbody>${worst.map(x => { const r = x.r, href = jobLink(r);
              return `<tr><td>${href ? `<a href="${href}">${esc(fmtDay(r["Date"]))}</a>` : esc(fmtDay(r["Date"]))}</td><td>${esc(r["Customer"] || "")}</td><td>${esc(r["Sales Person"] || "")}</td>
                <td class="num">${x.c}</td><td class="num">${x.h.toFixed(1)}</td><td class="num">${num(r["CF"]) ? Math.round(num(r["CF"])).toLocaleString() + " CF" : "—"}</td>
                <td class="num">${money(x.bill)}</td><td class="num">${money(x.eq)}</td><td class="num flr-neg"><b>${signK(x.diff)}</b></td></tr>`; }).join("")}</tbody>
          </table></div>
          <p class="flr-note">The date opens the job in Job P&L.</p>` : ""}
        </section>
        <section class="panel"><div class="panel-head"><span class="panel-title">By sales person</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Sales person</th><th class="num">Flat jobs</th><th class="num">Of their local jobs</th><th class="num">Flat revenue</th><th class="num">Against hourly</th><th class="num">A job</th><th class="num">Jobs that lost</th></tr></thead>
            <tbody>${repRows.map(o => `<tr><td><b>${esc(o.k)}</b></td><td class="num">${o.flat}</td><td class="num">${pct(o.flat, o.local)}</td><td class="num">${money(o.bill)}</td>
              <td class="num ${o.net < 0 ? "flr-neg" : ""}">${o.cmp.length ? signK(o.net) : "—"}</td><td class="num">${o.cmp.length ? signK(o.net / o.cmp.length) : "—"}</td>
              <td class="num">${o.cmp.length ? o.lost + " of " + o.cmp.length : "—"}</td></tr>`).join("")}</tbody>
          </table></div>
          <p class="flr-note">Against hourly: what their flat jobs billed over the same hours at the going hourly price.</p></section>
        <div class="flr-grid">
          <section class="panel"><div class="panel-head"><span class="panel-title">Booking rate a month</span></div>
            <div class="chartbox" style="height:260px"><canvas id="flrBook" role="img" aria-label="Booking rate a month, flat rate against hourly"></canvas></div>
            <p class="flr-note">Requests created that month: good leads (not marked Bad Lead) that became Confirmed. The latest month is still filling in.</p></section>
          <section class="panel"><div class="panel-head"><span class="panel-title">Requests by size of move</span></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Size of move</th><th class="num">Flat-rate leads</th><th class="num">Booked</th><th class="num">Hourly leads</th><th class="num">Booked</th></tr></thead>
              <tbody>${sizeRows.map(x => `<tr><td>${esc(x.sz)}</td><td class="num">${x.f.good.toLocaleString()} <span class="flr-sub">${pct(x.f.good, bF.good, 0)}</span></td>
                <td class="num">${x.f.rate != null ? (x.f.rate * 100).toFixed(0) + "%" : "—"}</td>
                <td class="num">${x.h.good.toLocaleString()} <span class="flr-sub">${pct(x.h.good, bH.good, 0)}</span></td><td class="num">${x.h.rate != null ? (x.h.rate * 100).toFixed(0) + "%" : "—"}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>All</td><td class="num">${bF.good.toLocaleString()}</td><td class="num">${bF.rate != null ? (bF.rate * 100).toFixed(1) + "%" : "—"}</td>
                <td class="num">${bH.good.toLocaleString()}</td><td class="num">${bH.rate != null ? (bH.rate * 100).toFixed(1) + "%" : "—"}</td></tr></tfoot>
            </table></div></section>
        </div>
        <section class="panel"><div class="panel-head"><span class="panel-title">The final bill against the quote</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th></th><th class="num">Jobs with a quote</th><th class="num">Within 10%</th><th class="num">10% or more over</th><th class="num">10% or more under</th><th class="num">Median bill ÷ top of the quote</th></tr></thead>
            <tbody>${[["Flat rate", qF], ["Hourly", qH]].map(([l, q]) => `<tr><td><b>${l}</b></td><td class="num">${q.n.toLocaleString()} of ${q.of.toLocaleString()}</td>
              <td class="num">${pct(q.within, q.n, 0)}</td><td class="num">${pct(q.over, q.n, 0)}</td><td class="num">${pct(q.under, q.n, 0)}</td><td class="num">${q.med != null ? q.med.toFixed(2) + "×" : "—"}</td></tr>`).join("")}</tbody>
          </table></div>
          <p class="flr-note">The quote is the Moveboard request's (its top end when it is a range). A flat bill can still move with add-ons agreed on the day.</p></section>
        <section class="panel flr-how"><div class="panel-head"><span class="panel-title">How this is counted</span></div><ul>
          <li><b>Flat rate</b> is a job the closing sheet marks Is Flat Rate, or whose contract is a FLAT RATE job (they agree on almost every job). Only Zip to Zip sells them, and the sheet has marked them since January 2026.</li>
          <li><b>Hourly</b> is every other Zip to Zip Local Moving closing since January, labor-only jobs (labor work, loading or unloading help, packing days) left out.</li>
          <li><b>Money</b> is the Job P&L's: the bill, crew pay, sales commission, ads (the source's month spend ÷ its jobs), and the margin before fixed costs — after the crew, truck, fuel, ads and fees, with an owned truck counted as fixed.</li>
          <li><b>Hours</b> are the hours the contract paid the crew (labor or the minimum, plus travel); a crew-hour is one man for one hour.</li>
        </ul></section>
      </div>`;

    /* ---------- charts ---------- */
    const v2 = RS.isV2 && RS.isV2(), V = RS.V2 || {};
    const strong = v2 ? V.navy : "#b7e23b", pale = v2 ? V.ctx : "#5c6a7c";
    try {
      const fJ = months.map(m => F.filter(r => r["Month"] === m).length), aJ = months.map(m => jobs.filter(r => r["Month"] === m).length);
      new Chart(host.querySelector("#flrTrend"), { type: "bar",
        data: { labels: months.map(mlabel), datasets: [{ label: "Flat-rate jobs", data: fJ, backgroundColor: strong, borderRadius: 4, maxBarThickness: 48 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
          tooltip: { callbacks: { label: x => `${x.raw} flat-rate jobs · ${pct(x.raw, aJ[x.dataIndex])} of ${aJ[x.dataIndex]} local jobs` } } },
          scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    } catch (e) { console.warn("flat-rate trend:", e); }
    try {
      const r1 = reqMonths.map(m => { const f = fm(m); return f.rate != null ? +(f.rate * 100).toFixed(1) : null; });
      const r2 = reqMonths.map(m => { const h = hm(m); return h.rate != null ? +(h.rate * 100).toFixed(1) : null; });
      new Chart(host.querySelector("#flrBook"), { type: "line",
        data: { labels: reqMonths.map(mlabel), datasets: [
          { label: "Hourly", data: r2, borderColor: pale, backgroundColor: pale, borderWidth: 2, pointRadius: 4, tension: 0 },
          { label: "Flat rate", data: r1, borderColor: strong, backgroundColor: strong, borderWidth: 2, pointRadius: 4, tension: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: x => {
            const m = reqMonths[x.dataIndex], o = x.datasetIndex ? fm(m) : hm(m);
            return `${x.dataset.label}: ${x.raw != null ? x.raw + "%" : "—"} · ${o.booked} of ${o.good} good leads`; } } } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => v + "%" } } } } });
    } catch (e) { console.warn("flat-rate booking:", e); }

    function injectCss() {
      if (document.getElementById("flr-css")) return;
      const s = document.createElement("style"); s.id = "flr-css";
      s.textContent = `
        .flr-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(460px,100%),1fr));gap:16px}
        .flr-grid>*{min-width:0}
        .flr-sub{font-size:12px;color:var(--faint);font-weight:400}
        .flr-note{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.5}
        .flr-say{margin:6px 0 0;padding-left:18px;font-size:14px;color:var(--muted);line-height:1.65}
        .flr-say b{color:var(--ink)}
        .flr-vs td:first-child{color:var(--muted)}
        .flr-thin td{opacity:.55}
        .flr-neg{color:var(--ink)}
        .flr-subhead{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin:18px 0 6px}
        .flr-how ul{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6}
        .flr-how b{color:var(--ink)}
      `;
      document.head.appendChild(s);
    }
  },
});
