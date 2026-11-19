/* ADMINISTRATION page: Ads Budget Planner (report id budget-planner; tracker ZTZ-133, 19 Nov 2026).
   His words: "i need it as a reporting page ... for each channel to set budget and have an estimate of what it will
   return ... projections for states and channels and ROI". Admins only until he grants it (it lives in Administration).
   Every channel's monthly budget starts at today's run rate; change any of them, pick the month and the company, and
   the page works out what it should bring, with a likely range. DATA: four small marts built by the loader
   (src/budget_plan.py): each channel's run rate and response curve, the season, state shares and today's crews.
   THE ARITHMETIC (same as the ZTZ-131 Google Local draft):
     outcome = today's (season-free) run rate x the month's season x (budget / today's spend) ^ e
   e for leads and for bookings is the channel's own, blended with a typical value for its kind (see the loader).
   A budget split by state works the same way per state, each state's slice against its own share of today's spend.
   No rep names, no customers: every number is a channel total. */
(() => {
  const STATES = ["NJ", "PA", "NY", "CT", "DE", "MD", "MA", "VA", "Other"];
  const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October",
                  "November", "December"];
  const UNPAID = "Unpaid sources";
  const KIND = { "pay per lead": "Pay per lead", clicks: "Clicks", mail: "Mail", unpaid: "No spend" };
  const LS = "bp.plan.v1";
  const esc = s => RSC.esc(s == null ? "" : String(s));
  const num = v => (v == null || v === "" ? null : Number(v));
  const S = { co: "Zip to Zip", month: null, foremen: {}, days: 6, plan: {}, split: {}, open: {}, cols: "key", data: null, err: "" };

  // per-viewer memory of the plan (a convenience only: the page works without it)
  const load = () => { try { const j = JSON.parse(localStorage.getItem(LS) || "{}"); S.plan = j.plan || {}; S.split = j.split || {}; } catch (e) { /* none */ } };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ plan: S.plan, split: S.split })); } catch (e) { /* none */ } };

  const DS = {
    bp_channel: { table: "mart_budget_channel", cols: ["Company", "Family", "Kind", "Base Basis", "Base From", "Base To",
      "Base Spend", "Base Leads", "Base Qualified", "Base Bookings", "Base Jobs", "Base Revenue", "Season Base",
      "Jobs Per Booking", "Revenue Per Job", "Profit Per Job", "Morning Share", "Spend 12m", "Max Spend",
      "Max Spend Month", "Pairs", "E Lead Fit", "E Lead SE", "E Book Fit", "E Book SE", "E Lead", "E Lead Lo",
      "E Lead Hi", "E Book", "E Book Lo", "E Book Hi", "Update Date"] },
    bp_season: { table: "mart_budget_season", cols: ["Company", "Month", "Bookings Index", "Leads Index", "Days"] },
    bp_state: { table: "mart_budget_state", cols: ["Company", "Family", "State", "Lead Share", "Booking Share", "Revenue Share"] },
    bp_company: { table: "mart_budget_company", cols: ["Company", "Foremen", "Morning Jobs Per Week", "Jobs Per Week", "Weeks", "Update Date"] },
  };
  for (const k in DS) if (!RS.DATASETS[k]) RS.DATASETS[k] = Object.assign({ dateCols: {}, defaultDate: null }, DS[k]);

  const money = v => v == null || !isFinite(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
  const moneyK = v => v == null || !isFinite(v) ? "—" : Math.abs(v) >= 10000 ? "$" + (v / 1000).toFixed(v >= 100000 ? 0 : 1) + "k" : money(v);
  const n1 = v => v == null || !isFinite(v) ? "—" : v >= 100 ? Math.round(v).toLocaleString("en-US") : v.toFixed(1);
  const n2 = v => v == null || !isFinite(v) ? "—" : v.toFixed(2);
  const pct = v => v == null || !isFinite(v) ? "—" : (v > 0 ? "+" : "") + Math.round(100 * v) + "%";
  const rng = (lo, hi, f) => '<span class="bp-rng">' + f(lo) + "–" + f(hi) + "</span>";
  const monthKey = (y, m) => y + "-" + String(m).padStart(2, "0");

  function monthsAhead() {
    const d = new Date(), out = [];
    for (let i = 0; i < 13; i++) {
      const x = new Date(d.getFullYear(), d.getMonth() + i, 1);
      out.push({ key: monthKey(x.getFullYear(), x.getMonth() + 1), m: x.getMonth() + 1, label: MONTHS[x.getMonth()] + " " + x.getFullYear() });
    }
    return out;
  }

  function prep(rows) {
    const d = { ch: {}, season: {}, state: {}, co: {} };
    rows.ch.forEach(r => {
      const o = {}; for (const k in r) o[k] = (typeof r[k] === "string" && /^-?[\d.]+$/.test(r[k])) ? Number(r[k]) : r[k];
      (d.ch[o.Company] = d.ch[o.Company] || []).push(o);
    });
    for (const co in d.ch) d.ch[co].sort((a, b) => (a.Family === UNPAID) - (b.Family === UNPAID) || (b["Base Spend"] - a["Base Spend"]));
    rows.season.forEach(r => { (d.season[r.Company] = d.season[r.Company] || {})[+r.Month] = { b: +r["Bookings Index"], l: +r["Leads Index"], days: +r.Days }; });
    rows.state.forEach(r => {
      const f = ((d.state[r.Company] = d.state[r.Company] || {})[r.Family] = d.state[r.Company][r.Family] || {});
      f[r.State] = { l: num(r["Lead Share"]) || 0, b: num(r["Booking Share"]) || 0, r: num(r["Revenue Share"]) || 0 };
    });
    rows.co.forEach(r => { d.co[r.Company] = { foremen: num(r.Foremen), morning: num(r["Morning Jobs Per Week"]), jobs: num(r["Jobs Per Week"]) }; });
    return d;
  }

  // ---- the arithmetic -----------------------------------------------------------------------------------------
  function curve(ch, budget, sea, eKey) {
    // one channel's outcome multiplier against today's spend, at the expected e and the two ends of its range
    const base = ch["Base Spend"];
    if (!(base > 0)) return { mid: 1, lo: 1, hi: 1 };
    const r = Math.max(0, budget) / base;
    if (r === 0) return { mid: 0, lo: 0, hi: 0 };
    const e = ch[eKey], lo = ch[eKey + " Lo"], hi = ch[eKey + " Hi"];
    const a = Math.pow(r, e), b = Math.pow(r, lo), c = Math.pow(r, hi);
    return { mid: a, lo: Math.min(b, c), hi: Math.max(b, c) };
  }

  function stateShares(co, fam) {
    const s = (S.data.state[co] || {})[fam] || {};
    const out = {};
    STATES.forEach(st => { out[st] = s[st] || { l: 0, b: 0, r: 0 }; });
    return out;
  }

  function splitFor(co, fam) {
    // the viewer's own state split for this channel, else today's (lead share); always sums to 1
    const sh = stateShares(co, fam), own = ((S.split[co] || {})[fam]) || null;
    const p = {};
    let t = 0;
    STATES.forEach(st => { p[st] = own ? Math.max(0, +own[st] || 0) : sh[st].l; t += p[st]; });
    STATES.forEach(st => { p[st] = t > 0 ? p[st] / t : 0; });
    return p;
  }

  function calc(co, ch, budget, m, useSplit) {
    const sea = (S.data.season[co] || {})[m] || { b: 1, l: 1, days: 30 };
    const weeks = sea.days / 7;
    const unpaid = ch.Family === UNPAID;
    const sh = stateShares(co, ch.Family), own = !unpaid && useSplit && (S.split[co] || {})[ch.Family];
    const byState = {};
    let L = { mid: 0, lo: 0, hi: 0 }, B = { mid: 0, lo: 0, hi: 0 };
    if (unpaid || !own) {
      const cl = unpaid ? { mid: 1, lo: 1, hi: 1 } : curve(ch, budget, sea, "E Lead");
      const cb = unpaid ? { mid: 1, lo: 1, hi: 1 } : curve(ch, budget, sea, "E Book");
      L = { mid: cl.mid, lo: cl.lo, hi: cl.hi }; B = { mid: cb.mid, lo: cb.lo, hi: cb.hi };
      STATES.forEach(st => { byState[st] = { spend: budget * sh[st].l, l: cl.mid * sh[st].l, b: cb.mid * sh[st].b, rv: cb.mid * sh[st].r }; });
    } else {
      // each state's slice responds against its own share of today's spend; a state with no history adds nothing
      const p = splitFor(co, ch.Family);
      STATES.forEach(st => {
        const base = ch["Base Spend"] * sh[st].l, plan = budget * p[st];
        let ml = { mid: 0, lo: 0, hi: 0 }, mb = { mid: 0, lo: 0, hi: 0 };
        if (base > 0) {
          const fake = Object.assign({}, ch, { "Base Spend": base });
          ml = curve(fake, plan, sea, "E Lead"); mb = curve(fake, plan, sea, "E Book");
        }
        ["mid", "lo", "hi"].forEach(k => { L[k] += ml[k] * sh[st].l; B[k] += mb[k] * sh[st].b; });
        byState[st] = { spend: plan, l: ml.mid * sh[st].l, b: mb.mid * sh[st].b, rv: mb.mid * sh[st].r, noHistory: base <= 0 && plan > 0 };
      });
    }
    // month-to-month noise of a count this size, on top of the curve's own range (10-90%)
    const bookMid = ch["Base Bookings"] * sea.b * B.mid;
    const noise = Math.min(0.9, 1.28 / Math.sqrt(Math.max(1, bookMid)));
    const lo = x => x * Math.exp(-noise), hi = x => x * Math.exp(noise);
    const jobs = ch["Base Jobs"] * sea.b, rpj = ch["Revenue Per Job"] || 0, ppj = ch["Profit Per Job"] || 0, ms = ch["Morning Share"] || 0.89;
    const o = {
      spend: unpaid ? 0 : budget, weeks,
      leads: ch["Base Leads"] * sea.l * L.mid, qual: ch["Base Qualified"] * sea.l * L.mid,
      book: bookMid, bookLo: lo(ch["Base Bookings"] * sea.b * B.lo), bookHi: hi(ch["Base Bookings"] * sea.b * B.hi),
      jobs: jobs * B.mid, jobsLo: lo(jobs * B.lo), jobsHi: hi(jobs * B.hi),
    };
    o.rev = o.jobs * rpj; o.revLo = o.jobsLo * rpj; o.revHi = o.jobsHi * rpj;
    o.profit = o.jobs * ppj; o.profitLo = o.jobsLo * ppj; o.profitHi = o.jobsHi * ppj;
    o.morning = o.jobs * ms / weeks; o.morningLo = o.jobsLo * ms / weeks; o.morningHi = o.jobsHi * ms / weeks;
    o.byState = {};
    const tb = STATES.reduce((a, st) => a + byState[st].b, 0) || 1, tr = STATES.reduce((a, st) => a + byState[st].rv, 0) || 1,
          tl = STATES.reduce((a, st) => a + byState[st].l, 0) || 1;
    STATES.forEach(st => {
      const x = byState[st];
      o.byState[st] = { spend: x.spend, leads: o.leads * x.l / tl, book: o.book * x.b / tb, jobs: o.jobs * x.b / tb,
                        rev: o.rev * x.rv / tr, profit: o.profit * x.rv / tr, morning: o.morning * x.b / tb, noHistory: !!x.noHistory };
    });
    return o;
  }

  function budgetOf(co, ch) {
    const v = (S.plan[co] || {})[ch.Family];
    return v == null ? ch["Base Spend"] : v;
  }

  function totals(list, key) {
    // the sum of every channel, with a range that assumes they move independently
    const mid = list.reduce((a, o) => a + (o[key] || 0), 0);
    const lo = mid - Math.sqrt(list.reduce((a, o) => a + Math.pow((o[key] || 0) - (o[key + "Lo"] == null ? o[key] : o[key + "Lo"]), 2), 0));
    const hi = mid + Math.sqrt(list.reduce((a, o) => a + Math.pow((o[key + "Hi"] == null ? o[key] : o[key + "Hi"]) - (o[key] || 0), 2), 0));
    return { mid, lo: Math.max(0, lo), hi };
  }

  // ---- the page -----------------------------------------------------------------------------------------------
  function injectStyle() {
    if (document.getElementById("bp-style")) return;
    const st = document.createElement("style");
    st.id = "bp-style";
    st.textContent = ""
      + ".bp-bar{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-end;margin:0 0 16px}"
      + ".bp-bar label{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:var(--muted)}"
      + ".bp-bar .rs-inp,.bp-bar .rs-sel{min-width:0}"
      + ".bp-num{width:84px}"
      + ".bp-sec{margin:22px 0 8px;font-size:16px;font-weight:800;color:var(--ink)}"
      + ".bp-rng{display:block;font-size:12px;color:var(--muted);font-weight:500;white-space:nowrap}"
      + ".bp-in{width:104px;min-width:0;text-align:right;padding:6px 8px}"
      + ".bp-today{display:block;font-size:12px;color:var(--muted);white-space:nowrap}"
      + ".bp-up{color:#3f7d1c}.bp-down{color:#b42318}"
      + ".bp-kind{display:inline-block;font-size:12px;font-weight:700;padding:1px 8px;border-radius:99px;background:var(--panel-2);color:var(--muted);margin-left:6px}"
      + ".bp-warn{display:block;margin-top:4px;font-size:12px;font-weight:600;color:#b45309;white-space:normal;max-width:240px}"
      + ".bp-st{font-size:12px;font-weight:700;color:var(--blue);background:none;border:0;padding:0;cursor:pointer;margin-left:8px}"
      + ".bp-split td{background:var(--panel-2)}"
      + ".bp-grid{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;font-size:12.5px}"
      + ".bp-grid label{display:flex;align-items:center;gap:5px;color:var(--muted);font-weight:700}"
      + ".bp-grid input{width:58px;min-width:0;text-align:right;padding:4px 6px}"
      + ".bp-cap{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 12px}"
      + ".bp-cap .bp-meter{position:relative;height:14px;border-radius:99px;background:var(--panel-2);margin:10px 0 6px;overflow:hidden}"
      + ".bp-cap .bp-fill{position:absolute;left:0;top:0;bottom:0;border-radius:99px;background:var(--brand)}"
      + ".bp-cap .bp-fill.over{background:#d97706}"
      + ".bp-cap .bp-mark{position:absolute;top:-3px;bottom:-3px;width:2px;background:var(--ink);opacity:.55}"
      + ".bp-cap p{margin:4px 0;font-size:13.5px;line-height:1.5}"
      + ".bp-foot{font-size:12.5px;color:var(--muted);line-height:1.6;margin:8px 2px 0;max-width:var(--rs-prose)}"
      + ".bp-ch{font-weight:750;color:var(--ink)}"
      + ".bp-tbl td:first-child{min-width:230px}"
      + ".bp-bar2{margin-top:-6px;align-items:center}"
      + ".bp-lbl{font-size:12px;font-weight:700;color:var(--muted)}"
      + ".bp-says{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin:0 0 6px}"
      + ".bp-says>div{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px 18px}"
      + ".bp-says-h{font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin:2px 0 6px}"
      + ".bp-says ul{margin:0;padding-left:18px}"
      + ".bp-says li{font-size:13.5px;line-height:1.55;margin:4px 0}";
    document.head.appendChild(st);
  }

  const how = () => "<h3>What a budget brings</h3><p>Each channel starts from <b>today</b>: its last 3 full months of spend, leads, "
    + "bookings, jobs and money (12 months where its spend comes in lumps, like postcards). The planner takes the season out of that, then puts "
    + "back the season of the month you pick (the company's bookings by calendar month, 2024 and 2025).</p>"
    + "<p>A different budget changes the result along the channel's <b>response curve</b>: result = today × season × (budget ÷ today's spend)"
    + "<sup>e</sup>. An e of 1 means twice the money brings twice the bookings; 0.3 means twice the money brings about 23% more. e is measured "
    + "on each channel's own year-on-year months (the same calendar month a year apart: how much spend changed against how much leads and "
    + "bookings changed, with the company's other bookings as a control), then blended with a typical value for its kind by how much data it "
    + "has: one channel's history rarely pins e down alone. The table at the bottom shows each channel's own estimate and the one used.</p>"
    + "<h3>The range</h3><p>Next to each expected value: the result at the two ends of the channel's e range (10–90%), widened by the normal "
    + "month-to-month swing of a count that size. Totals add the channels' ranges as if they move independently.</p>"
    + "<h3>Money</h3><p>Revenue is the bill; job profit is the bill minus the job's own costs (crew, truck, materials) before ad cost, both "
    + "the channel's last-12-month average per job. <b>Profit per ad $</b> = job profit ÷ budget; <b>net</b> = job profit − budget. The cost of "
    + "an <b>extra</b> booking is the change in budget ÷ the change in bookings against today's budget in the same month.</p>"
    + "<h3>States</h3><p>Most channels' spend isn't split by state, so each channel's results are spread by its own share of leads, bookings "
    + "and revenue per state over the last 12 months. Split a channel's budget by state yourself with <b>By state</b>: each state's slice then "
    + "responds against its own share of today's spend, and a state with no history adds nothing.</p>"
    + "<h3>Morning jobs</h3><p>A morning job is a job that isn't chained after another job the same day (the calendar's After Job Code), "
    + "by channel. Per foreman per week = morning jobs ÷ foremen ÷ weeks in the month. <b>Unpaid sources</b> (returning customers, referrals, "
    + "the website, ChatGPT's answers and the rest) stay as they are in every plan, so the capacity line counts every morning job.</p>"
    + "<h3>What it can't know</h3><p>Anything above a channel's highest month is extrapolated and marked. Google's family also holds organic "
    + "search, which is why its bookings follow its budget only weakly. Pay-per-lead channels bill per lead, so part of their history is spend "
    + "following leads rather than leads following spend. Price changes, a new campaign or a competitor aren't in the curve.</p>";

  function render(host) {
    const D = S.data, co = S.co, months = monthsAhead();
    if (!S.month || !months.some(x => x.key === S.month)) S.month = months[1].key;
    const mo = months.find(x => x.key === S.month), m = mo.m;
    const chans = D.ch[co] || [];
    const crew = D.co[co] || {};
    const foremen = S.foremen[co] != null ? S.foremen[co] : (crew.foremen || 17);
    const rows = chans.map(ch => {
      const budget = budgetOf(co, ch);
      return { ch, budget, plan: calc(co, ch, budget, m, true), today: calc(co, ch, ch["Base Spend"], m, false) };
    });
    const P = rows.map(r => r.plan), T = rows.map(r => r.today);
    const sum = (list, k) => list.reduce((a, o) => a + (o[k] || 0), 0);
    const tSpend = sum(P, "spend"), tSpend0 = sum(T, "spend");
    const tBook = totals(P, "book"), tBook0 = sum(T, "book");
    const tJobs = totals(P, "jobs"), tRev = totals(P, "rev"), tProf = totals(P, "profit"), tMorn = totals(P, "morning");
    const tProf0 = sum(T, "profit"), tMorn0 = sum(T, "morning"), tRev0 = sum(T, "rev");
    const weeks = P.length ? P[0].weeks : 4.3;
    const perF = tMorn.mid / Math.max(1, foremen), perF0 = tMorn0 / Math.max(1, foremen);
    const chg = (a, b) => b ? (a - b) / b : null;
    const cls = v => v == null ? "" : v > 0.005 ? "bp-up" : v < -0.005 ? "bp-down" : "";
    // the tiles' sub-lines are plain text (the kit escapes them)
    const delta = (a, b) => { const v = chg(a, b); return v == null || Math.abs(v) < 0.005 ? "same as today" : pct(v) + " vs today"; };

    const kpis = RSC.kpisHtml([
      { label: "Ad spend", value: moneyK(tSpend), sub: delta(tSpend, tSpend0) + " · " + mo.label },
      { label: "Bookings", value: n1(tBook.mid), sub: n1(tBook.lo) + "–" + n1(tBook.hi) + " · " + delta(tBook.mid, tBook0) },
      { label: "Jobs", value: n1(tJobs.mid), sub: n1(tJobs.lo) + "–" + n1(tJobs.hi) + " likely" },
      { label: "Revenue", value: moneyK(tRev.mid), sub: moneyK(tRev.lo) + "–" + moneyK(tRev.hi) + " · " + delta(tRev.mid, tRev0) },
      { label: "Job profit after ads", value: moneyK(tProf.mid - tSpend), sub: "today's budgets: " + moneyK(tProf0 - tSpend0) },
      { label: "Morning jobs per foreman", value: n2(perF) + " / wk", sub: foremen + " foremen · today " + n2(perF0) },
    ]);

    const capFull = foremen * S.days;
    const fill = Math.min(100, 100 * tMorn.mid / Math.max(1, capFull)), mark0 = Math.min(100, 100 * tMorn0 / Math.max(1, capFull));
    const room = capFull - tMorn.mid;
    const cap = '<div class="bp-cap"><b>Crews</b> · ' + esc(mo.label)
      + '<div class="bp-meter"><div class="bp-fill' + (room < 0 ? " over" : "") + '" style="width:' + fill.toFixed(1) + '%"></div>'
      + '<div class="bp-mark" style="left:' + mark0.toFixed(1) + '%" title="today\'s budgets"></div></div>'
      + "<p>This plan: about <b>" + n1(tMorn.mid) + "</b> morning jobs a week (" + n1(tMorn.lo) + "–" + n1(tMorn.hi) + "), <b>" + n2(perF)
      + "</b> per foreman for " + foremen + " foremen, against " + S.days + " working days each (" + n1(capFull) + " a week if every foreman "
      + "starts a job every day). " + (room >= 0 ? "Room for about <b>" + n1(room) + "</b> more a week." : "<b>About " + n1(-room)
      + " a week more than the crews can start.</b>") + " The dark mark is today's budgets (" + n2(perF0) + " per foreman).</p>"
      + (crew.morning != null ? "<p class=\"bp-foot\">Last 4 weeks, actually: " + n1(crew.morning) + " morning jobs a week (" + n1(crew.jobs)
        + " jobs), " + (crew.foremen || "—") + " foremen working. The plan counts every source, paid and unpaid, by the month's season.</p>" : "")
      + "</div>";

    // the channel table: Key columns for a shared screen, All for the detail (his RACI view, 19 Nov)
    const COLS = [
      ["ch", "Channel", 1], ["budget", "Budget / month", 1], ["leads", "Leads", 0], ["qual", "Qualified", 0], ["book", "Bookings", 1],
      ["jobs", "Jobs", 1], ["morn", "Morning jobs / wk", 1], ["rev", "Revenue", 1], ["profit", "Job profit", 0],
      ["cpb", "Ad $ per booking", 1], ["cpx", "Ad $ per extra booking", 1], ["rpd", "Revenue per ad $", 0], ["ppd", "Profit per ad $", 1]];
    const shown = COLS.filter(c => S.cols === "all" || c[2]);
    const tdRow = (cells, strongKey) => shown.map(c => '<td class="' + (c[0] === "ch" ? "" : "num") + (c[0] === strongKey ? " strong" : "") + '">'
      + (cells[c[0]] == null ? "—" : cells[c[0]]) + "</td>").join("");
    const head = "<thead><tr>" + shown.map(c => '<th class="' + (c[0] === "ch" ? "" : "num") + '">' + c[1] + "</th>").join("") + "</tr></thead>";
    const body = rows.map(r => {
      const ch = r.ch, p = r.plan, t = r.today, unpaid = ch.Family === UNPAID;
      const db = p.book - t.book, ds = p.spend - t.spend;
      const warn = [];
      if (!unpaid && r.budget > (ch["Max Spend"] || 0) * 1.05 && r.budget > 0)
        warn.push("Above its highest month (" + money(ch["Max Spend"]) + (ch["Max Spend Month"] ? ", " + esc(ch["Max Spend Month"]) : "") + "): extrapolated");
      if (!unpaid && (ch["Base Bookings"] || 0) < 0.5) warn.push("No bookings traced to it lately");
      if (!unpaid && Object.values(p.byState).some(x => x.noHistory)) warn.push("Part of the budget is in a state with no history: it adds nothing");
      const own = !!((S.split[co] || {})[ch.Family]);
      const cells = {
        ch: '<span class="bp-ch">' + esc(ch.Family) + "</span>" + '<span class="bp-kind">' + esc(KIND[ch.Kind] || ch.Kind) + "</span>"
          + (unpaid ? "" : '<button type="button" class="bp-st" data-bp-open="' + esc(ch.Family) + '">' + (S.open[ch.Family] ? "Hide states" : own ? "By state (yours)" : "By state") + "</button>")
          + warn.map(w => '<span class="bp-warn">' + w + "</span>").join(""),
        budget: unpaid ? '<span class="muted">no spend</span>'
          : '<input class="rs-inp bp-in" id="bp-b-' + esc(ch.Family).replace(/[^A-Za-z0-9]/g, "_") + '" data-bp-budget="' + esc(ch.Family)
            + '" inputmode="decimal" value="' + Math.round(r.budget) + '" aria-label="' + esc(ch.Family) + ' monthly budget">'
            + '<span class="bp-today">today ' + money(ch["Base Spend"]) + (Math.abs(ds) > 1 ? ' · <span class="' + cls(ds / Math.max(1, t.spend)) + '">' + pct(ds / Math.max(1, t.spend)) + "</span>" : "") + "</span>",
        leads: n1(p.leads), qual: n1(p.qual), book: n1(p.book) + rng(p.bookLo, p.bookHi, n1), jobs: n1(p.jobs) + rng(p.jobsLo, p.jobsHi, n1),
        morn: n1(p.morning), rev: moneyK(p.rev) + rng(p.revLo, p.revHi, moneyK), profit: moneyK(p.profit),
        cpb: unpaid || p.book < 0.05 ? null : money(p.spend / p.book),
        cpx: !unpaid && Math.abs(ds) > 1 && db > 0.05 ? money(ds / db) : null,
        rpd: unpaid || !p.spend ? null : "$" + (p.rev / p.spend).toFixed(2), ppd: unpaid || !p.spend ? null : "$" + (p.profit / p.spend).toFixed(2),
      };
      let tr = "<tr>" + tdRow(cells, "book") + "</tr>";
      if (!unpaid && S.open[ch.Family]) {
        const sp = splitFor(co, ch.Family), sh = stateShares(co, ch.Family);
        tr += '<tr class="bp-split"><td colspan="' + shown.length + '"><div class="bp-grid"><span>Budget split, % by state (today\'s split is each state\'s share of its leads):</span>'
          + STATES.map(st => '<label>' + st + ' <input class="rs-inp" data-bp-split="' + esc(ch.Family) + '" data-st="' + st + '" inputmode="decimal" value="'
            + (100 * sp[st]).toFixed(sp[st] < 0.1 ? 1 : 0) + '" title="today ' + (100 * sh[st].l).toFixed(1) + '%"></label>').join("")
          + '<button type="button" class="rs-btn" data-bp-unsplit="' + esc(ch.Family) + '">Back to today\'s split</button></div></td></tr>';
      }
      return tr;
    }).join("");
    const paid = rows.filter(r => r.ch.Family !== UNPAID), PP = paid.map(r => r.plan), PT = paid.map(r => r.today);
    const pBook = totals(PP, "book"), pJobs = totals(PP, "jobs"), pRev = totals(PP, "rev"), pProf = totals(PP, "profit"), pMorn = totals(PP, "morning");
    const pBook0 = sum(PT, "book");
    const foot = "<tfoot><tr>" + tdRow({
        ch: "Paid channels", budget: money(tSpend) + '<span class="bp-today">today ' + money(tSpend0) + "</span>",
        leads: n1(sum(PP, "leads")), qual: n1(sum(PP, "qual")), book: n1(pBook.mid) + rng(pBook.lo, pBook.hi, n1), jobs: n1(pJobs.mid) + rng(pJobs.lo, pJobs.hi, n1),
        morn: n1(pMorn.mid), rev: moneyK(pRev.mid) + rng(pRev.lo, pRev.hi, moneyK), profit: moneyK(pProf.mid),
        cpb: pBook.mid ? money(tSpend / pBook.mid) : null,
        cpx: Math.abs(tSpend - tSpend0) > 1 && pBook.mid - pBook0 > 0.05 ? money((tSpend - tSpend0) / (pBook.mid - pBook0)) : null,
        rpd: tSpend ? "$" + (pRev.mid / tSpend).toFixed(2) : null, ppd: tSpend ? "$" + (pProf.mid / tSpend).toFixed(2) : null }) + "</tr>"
      + "<tr>" + tdRow({
        ch: 'Every source<span class="bp-today">with unpaid sources; the money ratios are on the paid row</span>', budget: money(tSpend),
        leads: n1(sum(P, "leads")), qual: n1(sum(P, "qual")), book: n1(tBook.mid) + rng(tBook.lo, tBook.hi, n1), jobs: n1(tJobs.mid) + rng(tJobs.lo, tJobs.hi, n1),
        morn: n1(tMorn.mid), rev: moneyK(tRev.mid) + rng(tRev.lo, tRev.hi, moneyK), profit: moneyK(tProf.mid), cpb: "", cpx: "", rpd: "", ppd: "" }) + "</tr></tfoot>";

    // WHAT THE DATA SAYS (his RACI view, 19 Nov): live lines from the numbers on this page, then what the ZTZ-131 study
    // measured on Google Local (dated: it was measured once, it is not rebuilt with the page)
    const live = [];
    const ranked = paid.filter(r => r.today.book >= 1 && r.today.spend > 0).map(r => ({ f: r.ch.Family, cpb: r.today.spend / r.today.book }))
      .sort((a, b) => a.cpb - b.cpb);
    if (ranked.length >= 2) {
      live.push("<b>Cheapest bookings at today's budgets:</b> " + ranked.slice(0, 3).map(x => esc(x.f) + " " + money(x.cpb)).join(", ")
        + ". <b>Dearest:</b> " + ranked.slice(-3).reverse().map(x => esc(x.f) + " " + money(x.cpb)).join(", ") + " (ad $ per booking, " + esc(mo.label) + ").");
    }
    const glr = paid.find(r => r.ch.Family === "Google Local");
    if (glr) {
      const x2 = calc(co, glr.ch, 2 * glr.ch["Base Spend"], m, false), t0 = glr.today, xb = x2.book - t0.book;
      live.push("<b>Google Local twice today's budget</b> (" + money(2 * glr.ch["Base Spend"]) + "): about " + n1(xb) + " more bookings in " + esc(mo.label)
        + " (" + pct(xb / Math.max(0.01, t0.book)) + "), so each extra booking costs about " + money(glr.ch["Base Spend"] / Math.max(0.01, xb))
        + " against about " + money(glr.ch["Profit Per Job"]) + " of job profit, and adds " + n2((x2.morning - t0.morning) / Math.max(1, foremen))
        + " morning jobs per foreman a week. It has never spent more than " + money(glr.ch["Max Spend"]) + " a month, so that is extrapolated.");
    }
    const notes = co === "Zip to Zip" && glr ? [
      "<b>The budget is used up every month:</b> about $19.5k since April 2026.",
      "<b>The same money buys fewer calls:</b> a charged call cost about $50 in June–August, $55–75 in September and $74–110 since 16 October, "
        + "when Google moved the account to its Pay-per-lead PMax campaign as the autumn slowdown set in.",
      "<b>The fall from 37% to 22% is partly how it's counted:</b> November 2025 was a small, good month (66 qualified leads). With every lead given "
        + "7 days to book (16 Oct – 11 Nov), it is 25.5% last year and 20.0% now. Google Ads search held at 22.3% → 24.1%.",
      "<b>What changed is price and follow-up:</b> quotes are 30–40% higher for the same move size, leads lost to price rose from 4.2 to 16.8 per 100 "
        + "qualified, and leads never reached again from 13.4 to 25.9. Not call speed (95% reached within an hour both years) and not the mix of states "
        + "or move sizes. More budget won't fix a conversion problem.",
    ] : [];
    const says = (live.length || notes.length) ? '<div class="bp-says">'
      + (live.length ? '<div><div class="bp-says-h">From the numbers on this page</div><ul>' + live.map(x => "<li>" + x + "</li>").join("") + "</ul></div>" : "")
      + (notes.length ? '<div><div class="bp-says-h">Google Local, measured on 19 Nov 2026</div><ul>' + notes.map(x => "<li>" + x + "</li>").join("") + "</ul></div>" : "")
      + "</div>" : "";

    // states: every channel together
    const stRows = STATES.map(st => {
      const g = k => P.reduce((a, o) => a + (o.byState[st][k] || 0), 0), g0 = k => T.reduce((a, o) => a + (o.byState[st][k] || 0), 0);
      return { st, spend: g("spend"), leads: g("leads"), book: g("book"), jobs: g("jobs"), rev: g("rev"), profit: g("profit"), morning: g("morning"), book0: g0("book") };
    }).filter(x => x.leads > 0.05 || x.spend > 1);
    const stTable = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Ad spend</th><th class="num">Leads</th>'
      + '<th class="num">Bookings</th><th class="num">vs today</th><th class="num">Jobs</th><th class="num">Morning jobs / wk</th><th class="num">Revenue</th>'
      + '<th class="num">Job profit</th><th class="num">Ad $ per booking</th><th class="num">Revenue per ad $</th></tr></thead><tbody>'
      + stRows.map(x => "<tr><td><b>" + x.st + '</b></td><td class="num">' + money(x.spend) + '</td><td class="num">' + n1(x.leads) + '</td><td class="num strong">'
        + n1(x.book) + '</td><td class="num"><span class="' + cls(chg(x.book, x.book0)) + '">' + (Math.abs(x.book - x.book0) < 0.05 ? "—" : pct(chg(x.book, x.book0))) + "</span></td>"
        + '<td class="num">' + n1(x.jobs) + '</td><td class="num">' + n1(x.morning) + '</td><td class="num">' + moneyK(x.rev) + '</td><td class="num">' + moneyK(x.profit)
        + '</td><td class="num">' + (x.book > 0.05 && x.spend ? money(x.spend / x.book) : "—") + '</td><td class="num">' + (x.spend > 1 ? "$" + (x.rev / x.spend).toFixed(2) : "—") + "</td></tr>").join("")
      + "</tbody></table></div>";

    // what each estimate rests on
    const restTable = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Channel</th><th>Kind</th><th>Today is</th><th class="num">Today\'s spend</th>'
      + '<th class="num">Highest month</th><th class="num">Year-on-year months</th><th class="num">Its own e (bookings)</th><th class="num">e used: bookings</th>'
      + '<th class="num">e used: leads</th><th class="num">Bill per job</th><th class="num">Job profit per job</th><th class="num">Morning share</th></tr></thead><tbody>'
      + chans.filter(ch => ch.Family !== UNPAID).map(ch => "<tr><td><b>" + esc(ch.Family) + "</b></td><td>" + esc(KIND[ch.Kind] || ch.Kind) + "</td><td>" + esc(ch["Base Basis"])
        + " (" + esc(ch["Base From"]) + " – " + esc(ch["Base To"]) + ')</td><td class="num">' + money(ch["Base Spend"]) + '</td><td class="num">' + money(ch["Max Spend"])
        + (ch["Max Spend Month"] ? '<span class="bp-today">' + esc(ch["Max Spend Month"]) + "</span>" : "") + '</td><td class="num">' + (ch.Pairs || 0)
        + '</td><td class="num">' + (ch["E Book Fit"] != null ? n2(+ch["E Book Fit"]) + " ± " + n2(+ch["E Book SE"]) : '<span class="muted">too little</span>')
        + '</td><td class="num strong">' + n2(ch["E Book"]) + rng(ch["E Book Lo"], ch["E Book Hi"], n2) + '</td><td class="num">' + n2(ch["E Lead"]) + rng(ch["E Lead Lo"], ch["E Lead Hi"], n2)
        + '</td><td class="num">' + money(ch["Revenue Per Job"]) + '</td><td class="num">' + money(ch["Profit Per Job"]) + '</td><td class="num">'
        + Math.round(100 * (ch["Morning Share"] || 0)) + "%</td></tr>").join("") + "</tbody></table></div>";

    const updated = (chans[0] || {})["Update Date"];
    host.innerHTML = RSC.pageHeadHtml({ title: "Ads Budget Planner", key: "budget-planner",
        sub: "Set each channel's monthly budget and see what it should bring, by channel and by state. Today's budgets are filled in: change what you want to test.", how })
      + '<div class="bp-bar">'
      + '<label>Company<span class="rs-seg">' + ["Zip to Zip", "Tuji"].filter(c => D.ch[c]).map(c => '<button type="button" data-bp-co="' + esc(c) + '" class="' + (c === co ? "on" : "") + '">' + esc(c) + "</button>").join("") + "</span></label>"
      + '<label>Month<span id="bp-month"></span></label>'
      + '<label for="bp-foremen">Foremen<input class="rs-inp bp-num" id="bp-foremen" inputmode="numeric" value="' + foremen + '"></label>'
      + '<label for="bp-days">Working days a week<input class="rs-inp bp-num" id="bp-days" inputmode="numeric" value="' + S.days + '"></label>'
      + '<button type="button" class="rs-btn" id="bp-reset">Back to today\'s budgets</button>'
      + "</div>"
      + '<div class="bp-bar bp-bar2"><span class="bp-lbl">Every channel at</span><span class="rs-seg">'
      + [-25, -10, 0, 10, 25, 50].map(v => '<button type="button" data-bp-scale="' + v + '">' + (v ? (v > 0 ? "+" : "−") + Math.abs(v) + "%" : "today") + "</button>").join("")
      + '</span><span class="bp-lbl">Columns</span><span class="rs-seg">'
      + [["key", "Key"], ["all", "All"]].map(([k, l]) => '<button type="button" data-bp-cols="' + k + '" class="' + (S.cols === k ? "on" : "") + '">' + l + "</button>").join("")
      + "</span></div>"
      + kpis + cap
      + (says ? '<div class="bp-sec">What the data says</div>' + says : "")
      + '<div class="bp-sec">Channels</div>'
      + '<div class="rs-tablewrap"><table class="rs-table bp-tbl">' + head + "<tbody>" + body + "</tbody>" + foot + "</table></div>"
      + '<p class="bp-foot">Each number is the expected value for ' + esc(mo.label) + "; the small line under it is the likely range (10–90%). "
      + "Unpaid sources stay as they are in every plan. Nothing here is saved for anyone else: your budgets stay in this browser.</p>"
      + '<div class="bp-sec">States</div>'
      + '<p class="rs-hint">Spend isn\'t split by state for most channels, so each channel\'s results are spread by its own share of leads, bookings and revenue per state '
      + "(last 12 months). Use <b>By state</b> on a channel to split its budget yourself.</p>" + stTable
      + '<div class="bp-sec">What each estimate rests on</div>'
      + '<p class="rs-hint">e is how strongly a channel answers more money: 1 = twice the money, twice the bookings; 0.3 = twice the money, about 23% more. '
      + "<b>Its own e</b> is measured on its year-on-year months; <b>e used</b> blends that with a typical value for its kind (pay per lead 0.60, clicks 0.40, "
      + "mail 0.60 for bookings) by how much data it has.</p>" + restTable
      + (updated ? '<p class="bp-foot">Numbers rebuilt ' + esc(updated) + " UTC.</p>" : "");

    // ---- wiring ----
    host.querySelectorAll("[data-bp-co]").forEach(b => { b.onclick = () => { S.co = b.dataset.bpCo; render(host); }; });
    RSC.localSelect(host.querySelector("#bp-month"), { label: "Month", values: months.map(x => ({ v: x.key, l: x.label })), value: S.month,
      required: true, form: true, onChange: v => { S.month = v; render(host); } });
    host.querySelector("#bp-reset").onclick = () => { delete S.plan[co]; delete S.split[co]; save(); render(host); };
    host.querySelectorAll("[data-bp-scale]").forEach(b => { b.onclick = () => {
      const f = 1 + (+b.dataset.bpScale) / 100, plan = {};
      chans.forEach(ch => { if (ch.Family !== UNPAID) plan[ch.Family] = Math.round(ch["Base Spend"] * f); });
      S.plan[co] = plan; save(); render(host);
    }; });
    host.querySelectorAll("[data-bp-cols]").forEach(b => { b.onclick = () => { S.cols = b.dataset.bpCols; render(host); }; });
    const onNum = (el, fn) => { el.onchange = () => { fn(el.value); render(host); }; el.onkeydown = e => { if (e.key === "Enter") el.blur(); }; };
    onNum(host.querySelector("#bp-foremen"), v => { const x = Math.round(+v); if (x > 0) S.foremen[co] = x; });
    onNum(host.querySelector("#bp-days"), v => { const x = +v; if (x > 0 && x <= 7) S.days = x; });
    host.querySelectorAll("[data-bp-budget]").forEach(el => onNum(el, v => {
      const x = +String(v).replace(/[$,\s]/g, "");
      if (isFinite(x) && x >= 0) { (S.plan[co] = S.plan[co] || {})[el.dataset.bpBudget] = x; save(); }
    }));
    host.querySelectorAll("[data-bp-open]").forEach(b => { b.onclick = () => { S.open[b.dataset.bpOpen] = !S.open[b.dataset.bpOpen]; render(host); }; });
    host.querySelectorAll("[data-bp-split]").forEach(el => onNum(el, v => {
      const fam = el.dataset.bpSplit, cur = splitFor(co, fam), x = Math.max(0, +v || 0) / 100;
      const own = {}; STATES.forEach(st => { own[st] = cur[st]; }); own[el.dataset.st] = x;
      (S.split[co] = S.split[co] || {})[fam] = own; save();
    }));
    host.querySelectorAll("[data-bp-unsplit]").forEach(b => { b.onclick = () => { if (S.split[co]) delete S.split[co][b.dataset.bpUnsplit]; save(); render(host); }; });
  }

  registerPage({
    id: "budget-planner",
    group: "administration",
    title: "Ads Budget Planner",
    async render(host) {
      injectStyle();
      load();
      host.innerHTML = RSC.loadingHtml("Ads Budget Planner", "Reading each channel's numbers…");
      try {
        const [ch, season, state, co] = await Promise.all(["bp_channel", "bp_season", "bp_state", "bp_company"].map(k => RS.load(k)));
        S.data = prep({ ch, season, state, co });
        S.err = "";
      } catch (e) {
        S.err = String(e && e.message || e);
      }
      if (!S.data || !Object.keys(S.data.ch).length) {
        host.innerHTML = RSC.pageHeadHtml({ title: "Ads Budget Planner", key: "budget-planner" })
          + RSC.emptyHtml({ title: "The planner's numbers aren't ready", body: S.err ? S.err.slice(0, 200) : "They are rebuilt with the hourly data run." });
        return;
      }
      render(host);
    },
  });
})();
