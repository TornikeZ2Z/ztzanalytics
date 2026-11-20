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
   ZTZ-140 (20 Nov 2026, the review before RACI, with Fable as advisor): the loader backtests the planner on every month
   since July 2025 and corrects it from what it saw: the bookings e x k (bookings followed budgets about a third as
   much as the curves said), a level c only when it would have made past forecasts better, and ranges from the test's
   own misses instead of the e range. The second pass of the review (same night) fixed how the test scored lumpy and
   zero-spend months, Google Local's assumed response, Tuji's season and the wording.
   A budget change's own effect is shown apart, at a low / middle / high response, with the break-even response.
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
  // Tuji is hidden for now (his word, 20 Nov 2026: its forecasts were ~41% off on few paid bookings a month); its
  // tables are still built, so showing it again is taking it out of this list
  const HIDDEN = ["Tuji"];
  const S = { co: "Zip to Zip", month: null, foremen: {}, days: 6, plan: {}, split: {}, open: {}, cols: "key", data: null, err: "" };

  // per-viewer memory of the plan (a convenience only: the page works without it)
  const load = () => { try { const j = JSON.parse(localStorage.getItem(LS) || "{}"); S.plan = j.plan || {}; S.split = j.split || {}; } catch (e) { /* none */ } };
  const save = () => { try { localStorage.setItem(LS, JSON.stringify({ plan: S.plan, split: S.split })); } catch (e) { /* none */ } };

  const DS = {
    bp_channel: { table: "mart_budget_channel", cols: ["Company", "Family", "Kind", "Base Basis", "Base From", "Base To",
      "Base Spend", "Base Leads", "Base Qualified", "Base Bookings", "Base Jobs", "Base Revenue", "Season Base",
      "Season Base Leads", "Season Base Jobs", "Prior Weight", "Base CV", "Base Bookings Old", "E Basis",
      "Jobs Per Booking", "Revenue Per Job", "Profit Per Job", "Revenue Per Job Winter", "Profit Per Job Winter",
      "Revenue Per Job Summer", "Profit Per Job Summer", "Value Jobs", "Value Jobs Winter", "Value Jobs Summer", "Profit Assumed", "Morning Share", "Spend 12m", "Max Spend",
      "Max Spend Month", "Pairs", "E Lead Fit", "E Lead SE", "E Book Fit", "E Book SE", "E Lead", "E Lead Lo",
      "E Lead Hi", "E Book", "E Book Lo", "E Book Hi", "Spend By Month", "Update Date"] },
    bp_season: { table: "mart_budget_season", cols: ["Company", "Month", "Bookings Index", "Leads Index", "Jobs Index", "Days"] },
    bp_state: { table: "mart_budget_state", cols: ["Company", "Family", "State", "Lead Share", "Booking Share", "Revenue Share"] },
    bp_company: { table: "mart_budget_company", cols: ["Company", "Foremen", "Morning Jobs Per Week", "Jobs Per Week", "Weeks",
      "Backtest Months", "Backtest WAPE", "Backtest Bias", "Backtest Coverage", "Backtest Spread", "Backtest WAPE A",
      "Backtest Moves", "Backtest Move MAE", "Backtest Move MAE A", "Backtest Slope", "Backtest Slope SE", "Response K",
      "Response K SE", "Response K Measured", "Level C", "Level Bias", "Level Used", "Band Lo", "Band Hi", "Band Coverage OOS",
      "Tier 1 Lo", "Tier 1 Hi", "Tier 2 Lo", "Tier 2 Hi", "Tier 3 Lo", "Tier 3 Hi", "Backtest WAPE OOS", "Backtest Within",
      "Backtest Origins", "Recent Bias Lo", "Recent Bias Hi", "Recent From", "Recent To", "Unpaid Band Lo", "Unpaid Band Hi",
      "Unpaid WAPE", "Update Date"] },
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
    rows.season.forEach(r => { (d.season[r.Company] = d.season[r.Company] || {})[+r.Month] = {
      b: +r["Bookings Index"], l: +r["Leads Index"], j: num(r["Jobs Index"]) || +r["Bookings Index"], days: +r.Days }; });
    rows.state.forEach(r => {
      const f = ((d.state[r.Company] = d.state[r.Company] || {})[r.Family] = d.state[r.Company][r.Family] || {});
      f[r.State] = { l: num(r["Lead Share"]) || 0, b: num(r["Booking Share"]) || 0, r: num(r["Revenue Share"]) || 0 };
    });
    rows.co.forEach(r => { d.co[r.Company] = { foremen: num(r.Foremen), morning: num(r["Morning Jobs Per Week"]), jobs: num(r["Jobs Per Week"]),
      bt: { months: num(r["Backtest Months"]), wape: num(r["Backtest WAPE"]), bias: num(r["Backtest Bias"]), cover: num(r["Backtest Coverage"]),
            spread: num(r["Backtest Spread"]), wapeA: num(r["Backtest WAPE A"]), moves: num(r["Backtest Moves"]),
            mae: num(r["Backtest Move MAE"]), maeA: num(r["Backtest Move MAE A"]), slope: num(r["Backtest Slope"]), slopeSe: num(r["Backtest Slope SE"]),
            wapeOos: num(r["Backtest WAPE OOS"]), within: num(r["Backtest Within"]), origins: num(r["Backtest Origins"]),
            k: num(r["Response K"]), kMeasured: num(r["Response K Measured"]) === 1, c: num(r["Level C"]),
            bias: num(r["Level Bias"]), cUsed: num(r["Level Used"]) === 1, coverOos: num(r["Band Coverage OOS"]),
            recent: [num(r["Recent Bias Lo"]), num(r["Recent Bias Hi"])], recentFrom: r["Recent From"], recentTo: r["Recent To"],
            unpaidBand: [num(r["Unpaid Band Lo"]), num(r["Unpaid Band Hi"])], unpaidWape: num(r["Unpaid WAPE"]),
            band: [num(r["Band Lo"]), num(r["Band Hi"])], tiers: [1, 2, 3].map(i => [num(r["Tier " + i + " Lo"]), num(r["Tier " + i + " Hi"])]) } }; });
    return d;
  }

  // THE BACKTEST'S CORRECTIONS (ZTZ-140). Every month since July 2025 was forecast from what was known on the 1st, with
  // each channel's real spend. k (the share of the curves' budget effect that actually showed up) is already inside each
  // channel's bookings e. Here: c, the level (1 unless correcting the level would have made past forecasts better), and
  // the ranges, which are the test's own misses (10th-90th percentile of actual / forecast), not the curve's e range.
  const FLOOR = 0.2;
  function cal(co) {
    const b = ((S.data.co[co] || {}).bt) || {};
    const pair = (x, d) => [x && x[0] != null ? x[0] : d[0], x && x[1] != null ? x[1] : d[1]];
    return { c: b.c != null ? b.c : 1, band: pair(b.band, [1 - FLOOR, 1 + FLOOR]), unpaid: pair(b.unpaidBand, [1 - FLOOR, 1 + FLOOR]),
             tiers: [0, 1, 2].map(i => pair((b.tiers || [])[i], [1 - FLOOR, 1 + FLOOR])) };
  }
  // a channel's range by its size (bookings a month: under 10, 10-40, over 40); a channel whose own level is uncertain
  // (Google Local's, re-based on a few weeks since its campaign changed) widens it by that, the two added in logs
  function bandFor(co, book, cv) {
    const t = cal(co).tiers[book < 10 ? 0 : book <= 40 ? 1 : 2];
    let lo = t[0], hi = t[1];
    if (cv > 0) {
      const z = 1.28 * cv;
      lo = lo > 0 ? Math.exp(-Math.sqrt(Math.pow(Math.log(lo), 2) + z * z)) : 0;
      hi = Math.exp(Math.sqrt(Math.pow(Math.log(hi), 2) + z * z));
    }
    return [lo, hi];
  }

  // ---- the arithmetic -----------------------------------------------------------------------------------------
  const ONE = { mid: 1, eLo: 1, eHi: 1 };
  function curve(ch, budget, eKey) {
    // one channel's outcome multiplier against today's spend, at the middle response and at the low and high one
    // (for a cut, a low response loses less: "low" always means the budget matters less)
    const base = ch["Base Spend"];
    if (!(base > 0)) return ONE;
    const r = Math.max(0, budget) / base;
    if (r === 0) return { mid: 0, eLo: 0, eHi: 0 };
    return { mid: Math.pow(r, ch[eKey]), eLo: Math.pow(r, ch[eKey + " Lo"]), eHi: Math.pow(r, ch[eKey + " Hi"]) };
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

  // revenue and job profit per job for month m: the channel's winter (Nov-Mar) or summer (Apr-Oct) average over 24 months,
  // pulled toward the company's when it has few jobs; the 12-month average only where the halves are missing
  const WINTER = [11, 12, 1, 2, 3];
  function valueFor(ch, m) {
    const w = WINTER.indexOf(m) >= 0;
    const rev = num(ch[w ? "Revenue Per Job Winter" : "Revenue Per Job Summer"]);
    const profit = num(ch[w ? "Profit Per Job Winter" : "Profit Per Job Summer"]);
    return { rev: rev != null ? rev : (ch["Revenue Per Job"] || 0), profit: profit != null ? profit : (ch["Profit Per Job"] || 0),
             half: w ? "winter" : "summer", assumed: +ch["Profit Assumed"] === 1 };
  }

  // whose job value it is: the channel's own jobs in that half of the year, or mostly a stand-in when it has few
  function valueBasis(ch, m) {
    const n = num(ch[WINTER.indexOf(m) >= 0 ? "Value Jobs Winter" : "Value Jobs Summer"]);
    if (n == null) return "";
    return n >= 30 ? n + " jobs" : n === 0 ? "company average" : "only " + n + " jobs: leans on a stand-in";
  }

  function calc(co, ch, budget, m, useSplit) {
    const sea = (S.data.season[co] || {})[m] || { b: 1, l: 1, days: 30 };
    const weeks = sea.days / 7;
    const unpaid = ch.Family === UNPAID;
    const sh = stateShares(co, ch.Family), own = !unpaid && useSplit && (S.split[co] || {})[ch.Family];
    const byState = {};
    let L = ONE, B = ONE;
    if (unpaid || !own) {
      if (!unpaid) { L = curve(ch, budget, "E Lead"); B = curve(ch, budget, "E Book"); }
      STATES.forEach(st => { byState[st] = { spend: budget * sh[st].l, l: L.mid * sh[st].l, b: B.mid * sh[st].b, rv: B.mid * sh[st].r }; });
    } else {
      // each state's slice responds against its own share of today's spend; a state with no history adds nothing
      const p = splitFor(co, ch.Family);
      L = { mid: 0, eLo: 0, eHi: 0 }; B = { mid: 0, eLo: 0, eHi: 0 };
      STATES.forEach(st => {
        const base = ch["Base Spend"] * sh[st].l, plan = budget * p[st];
        let ml = { mid: 0, eLo: 0, eHi: 0 }, mb = { mid: 0, eLo: 0, eHi: 0 };
        if (base > 0) {
          const fake = Object.assign({}, ch, { "Base Spend": base });
          ml = curve(fake, plan, "E Lead"); mb = curve(fake, plan, "E Book");
        }
        ["mid", "eLo", "eHi"].forEach(k => { L[k] += ml[k] * sh[st].l; B[k] += mb[k] * sh[st].b; });
        byState[st] = { spend: plan, l: ml.mid * sh[st].l, b: mb.mid * sh[st].b, rv: mb.mid * sh[st].r, noHistory: base <= 0 && plan > 0 };
      });
    }
    // jobs are counted by job date, so they go back in with the JOBS index (ZTZ-140; the base left with it too), and a
    // job is valued for the half of the year it falls in: a December job at winter prices, not a 12-month average.
    // Paid channels' bookings and jobs carry the backtest's level correction c when it earned its place (it is 1
    // otherwise); unpaid sources are scored at their run rate and take their own range.
    const v = valueFor(ch, m), c = unpaid ? 1 : cal(co).c;
    const book0 = c * ch["Base Bookings"] * sea.b, jobs0 = c * ch["Base Jobs"] * (sea.j || sea.b), ms = ch["Morning Share"] || 0.89;
    const o = {
      spend: unpaid ? 0 : budget, weeks, unpaid,
      leads: ch["Base Leads"] * sea.l * L.mid, qual: ch["Base Qualified"] * sea.l * L.mid,
      book: book0 * B.mid, jobs: jobs0 * B.mid,
    };
    o.rev = o.jobs * v.rev; o.profit = o.jobs * v.profit; o.morning = o.jobs * ms / weeks;
    // THE RANGE: how far the backtest's forecasts for a channel this size missed (10-90%)
    o.band = unpaid ? cal(co).unpaid : bandFor(co, o.book, num(ch["Base CV"]) || 0);
    ["book", "jobs", "rev", "profit", "morning"].forEach(k => { o[k + "Lo"] = o[k] * o.band[0]; o[k + "Hi"] = o[k] * o.band[1]; });
    // THE BUDGET'S EFFECT at a low, middle and high response, kept apart from the range (what a change brings)
    o.sc = {};
    [["low", "eLo"], ["mid", "mid"], ["high", "eHi"]].forEach(([n, k]) => {
      const j = jobs0 * B[k];
      o.sc[n] = { book: book0 * B[k], jobs: j, rev: j * v.rev, profit: j * v.profit };
    });
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

  // the channel's spend in the planned calendar month, the last time it came round (the loader keeps 12 months)
  function spendLastYear(ch, m) {
    const hit = String(ch["Spend By Month"] || "").split(";").map(x => x.split("=")).find(p => +String(p[0]).slice(5, 7) === m);
    return hit ? { label: MONTHS[m - 1].slice(0, 3) + " " + hit[0].slice(0, 4), spend: +hit[1] } : null;
  }

  function budgetOf(co, ch) {
    const v = (S.plan[co] || {})[ch.Family];
    return v == null ? ch["Base Spend"] : v;
  }

  function totals(list, key, co) {
    // the paid channels' sum takes the range the backtest measured on the company total: the channels miss together
    // (a slow month is slow everywhere), so their ranges don't cancel. Every call here holds all the paid channels;
    // a smaller set would take the band of its size instead. Unpaid sources add their own range on top.
    const sum = (xs, k) => xs.reduce((a, o) => a + (o[k] || 0), 0);
    const paid = list.filter(o => !o.unpaid), un = list.filter(o => o.unpaid), band = cal(co).band;
    const pm = sum(paid, key);
    return { mid: pm + sum(un, key), lo: pm * band[0] + sum(un, key + "Lo"), hi: pm * band[1] + sum(un, key + "Hi") };
  }

  // WHAT A CHANGE BRINGS (ZTZ-140): the extra bookings, jobs and job profit at a low, middle and high response against
  // the extra spend, and the response a change needs to pay for itself. Job profit is before ad cost, so a raise pays
  // when its extra job profit covers its extra spend, and a cut pays when the profit it loses is less than it saves.
  // Break-even for one channel: profit = P0 x r^e, so the change just pays at e* = ln(1 + extra spend / P0) / ln(r).
  function change(p, t) {
    const ds = p.spend - t.spend, out = { ds };
    ["low", "mid", "high"].forEach(n => {
      const s = p.sc[n];
      out[n] = { book: s.book - t.book, jobs: s.jobs - t.jobs, profit: s.profit - t.profit };
      out[n].net = out[n].profit - ds;
      out[n].pays = out[n].net >= 0;
    });
    return out;
  }
  function breakEven(ds, p0, r) {
    if (!(p0 > 0) || !(r > 0) || Math.abs(r - 1) < 1e-6) return null;
    const x = 1 + ds / p0;
    if (x <= 0) return { any: true };            // a cut that saves more than all the channel's job profit
    return { e: Math.log(x) / Math.log(r) };
  }
  function reallocVerdict(x) {
    // the same money moved between channels: only the job profit changes
    const ok = ["low", "mid", "high"].map(n => x[n].net >= 0), n = ok.filter(Boolean).length;
    return n === 3 ? "Gains job profit at every response" : n === 0 ? "Loses job profit at every response" : "Gains at some responses, loses at others";
  }
  function verdict(ch, raise) {
    // ch.low/mid/high.pays; "low" = the budget matters least
    const ok = ["low", "mid", "high"].map(n => ch[n].pays), n = ok.filter(Boolean).length;
    if (raise) return n === 3 ? "Pays at every response" : n === 0 ? "Doesn't pay at any response"
      : ok[2] && !ok[1] ? "Pays only at a high response" : ok[1] && ok[2] ? "Pays unless the response is low" : "Mixed";
    return n === 3 ? "Saves more than it loses at every response" : n === 0 ? "Loses more than it saves at every response"
      : ok[0] && !ok[1] ? "Saves only at a low response" : ok[0] && ok[1] ? "Saves unless the response is high" : "Mixed";
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
      + ".bp-tbl td:first-child{min-width:230px}.bp-tbl th{white-space:normal;vertical-align:bottom}"
      + ".bp-chg td.bp-vd{white-space:normal;min-width:190px;max-width:260px}.bp-chg td.bp-vd .bp-today{white-space:normal}"
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
    + "bookings, jobs and money (12 months where its spend comes in lumps, like postcards; Google Local only since its campaign changed on 16 Oct, "
    + "with each lead given 14 days to book). The planner takes the season out of that, then puts back the season of the month you pick (the "
    + "company's leads, bookings and jobs by calendar month, every full year; Tuji uses Zip to Zip's, since its own months are its launch). "
    + "Free Google listing leads since July are their own unpaid source, not Google Local's.</p>"
    + "<p>A different budget changes the result along the channel's <b>response curve</b>: result = today × season × (budget ÷ today's spend)"
    + "<sup>e</sup>. An e of 1 means twice the money brings twice the bookings; 0.3 means twice the money brings about 23% more. e is measured "
    + "on each channel's own year-on-year months (the same calendar month a year apart: how much spend changed against how much leads and "
    + "bookings changed, with the company's other bookings as a control), then blended with a typical value for its kind by how much data it "
    + "has: one channel's history rarely pins e down alone. The table at the bottom shows each channel's own estimate and the one used. "
    + "The curve is fair within about 30% of today's spend; further out the page marks it as a rough guess, and below half of today it gives no number.</p>"
    + "<h3>How it was tested</h3><p>Every month since July 2025 the planner was rebuilt from what was known on the 1st and asked for that month "
    + "and the next two, with each channel's real spend (a channel planned at its 12-month average, like postcards, and a month with no spend "
    + "are scored at the average, as the page plans them). The share of the curves' budget effect that actually showed up comes from that test "
    + "and is inside every bookings response used. A level correction is used only if it would have made past forecasts better; "
    + "<b>How right has this been</b> scores each month with corrections fitted only on what came before it.</p>"
    + "<h3>The range</h3><p>The small line under a number is where the test's forecasts for a channel that size landed 4 times in 5 (actual ÷ "
    + "forecast, 10th to 90th percentile; under 10 bookings a month, 10–40, over 40), never narrower than ±20%. Google Local's is wider, since its "
    + "level rests on a few weeks since its campaign changed. Totals use the misses of the company total: a slow month is slow on every channel, so "
    + "their ranges don't cancel. Unpaid sources are tested too, at their run rate, and take their own range.</p>"
    + "<h3>What a change brings</h3><p>The budget's own effect is kept apart from the range, at a <b>low</b>, <b>middle</b> and <b>high</b> "
    + "response. A change pays for itself when its extra job profit covers its extra spend; for one channel that happens at the break-even response "
    + "e* = ln(1 + extra spend ÷ today's job profit) ÷ ln(new budget ÷ today's). The verdict says at which of the three responses it pays.</p>"
    + "<h3>Money</h3><p>Revenue is the bill; job profit is the bill minus crew pay, sales commission and about $163 of other job costs, before "
    + "ad cost. Card fees, claims and refunds aren't in it, so it runs a little high. Both are the channel's average per job in the same half of "
    + "the year (winter November–March, summer April–October) over 24 months. With fewer than 30 jobs in that half it leans on a stand-in: "
    + "its other half of the year scaled by the company's ratio between the halves, or else the company's figure. "
    + "<b>Profit per ad $</b> = job profit ÷ budget. The cost of an <b>extra</b> booking is the change in budget ÷ the change in bookings against "
    + "today's budget in the same month.</p>"
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
    const tBook = totals(P, "book", co), tBook0 = sum(T, "book");
    const tJobs = totals(P, "jobs", co), tRev = totals(P, "rev", co), tProf = totals(P, "profit", co), tMorn = totals(P, "morning", co);
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
      // it is the company's job profit from every source, paid and unpaid, less the ad spend: not the return on the ads
      { label: "Company job profit after ads", value: moneyK(tProf.mid - tSpend), sub: "all sources · today's budgets: " + moneyK(tProf0 - tSpend0) },
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
      ["cpb", 'Ad $ per booking<span class="bp-today">average</span>', 1], ["cpx", "Ad $ per extra booking", 1],
      ["rpd", 'Revenue per ad $<span class="bp-today">average</span>', 0], ["ppd", 'Profit per ad $<span class="bp-today">average</span>', 1]];
    const shown = COLS.filter(c => S.cols === "all" || c[2]);
    const tdRow = (cells, strongKey) => shown.map(c => '<td class="' + (c[0] === "ch" ? "" : "num") + (c[0] === strongKey ? " strong" : "") + '">'
      + (cells[c[0]] == null ? "—" : cells[c[0]]) + "</td>").join("");
    const head = "<thead><tr>" + shown.map(c => '<th class="' + (c[0] === "ch" ? "" : "num") + '">' + c[1] + "</th>").join("") + "</tr></thead>";
    let anyDeep = false;
    const body = rows.map(r => {
      const ch = r.ch, p = r.plan, t = r.today, unpaid = ch.Family === UNPAID;
      const db = p.book - t.book, ds = p.spend - t.spend;
      const warn = [];
      // THE CURVE IS FENCED (ZTZ-140): it is a local approximation, fair within about +/-30% of today's spend. Beyond that
      // the numbers are tagged; below half of today it gives none, since it would make deep cuts look nearly free.
      const ratio = !unpaid && ch["Base Spend"] > 0 ? r.budget / ch["Base Spend"] : 1;
      const deepCut = !unpaid && (ratio < 0.5 || ratio > 2);
      if (deepCut) warn.push(ratio < 0.5 ? "Below half of today's spend: not estimable, the curve does not hold that far down"
        : "More than twice today's spend: not estimable, the curve does not hold that far up");
      else if (!unpaid && (ratio < 0.7 || ratio > 1.3)) warn.push("More than 30% from today's spend: the curve hasn't been seen there, read it as a rough guess");
      if (!unpaid && r.budget > (ch["Max Spend"] || 0) * 1.05 && r.budget > 0)
        warn.push("Above its highest month (" + money(ch["Max Spend"]) + (ch["Max Spend Month"] ? ", " + esc(ch["Max Spend Month"]) : "") + "): extrapolated");
      if (!unpaid && (ch["Base Bookings"] || 0) < 0.5) warn.push("No bookings traced to it lately");
      if (!unpaid && Object.values(p.byState).some(x => x.noHistory)) warn.push("Part of the budget is in a state with no history: it adds nothing");
      const own = !!((S.split[co] || {})[ch.Family]), ly = unpaid ? null : spendLastYear(ch, m);
      const cells = {
        ch: '<span class="bp-ch">' + esc(ch.Family) + "</span>" + '<span class="bp-kind">' + esc(KIND[ch.Kind] || ch.Kind) + "</span>"
          + (unpaid ? "" : '<button type="button" class="bp-st" data-bp-open="' + esc(ch.Family) + '">' + (S.open[ch.Family] ? "Hide states" : own ? "By state (yours)" : "By state") + "</button>")
          + warn.map(w => '<span class="bp-warn">' + w + "</span>").join(""),
        budget: unpaid ? '<span class="muted">no spend</span>'
          : '<input class="rs-inp bp-in" id="bp-b-' + esc(ch.Family).replace(/[^A-Za-z0-9]/g, "_") + '" data-bp-budget="' + esc(ch.Family)
            + '" inputmode="decimal" value="' + Math.round(r.budget) + '" aria-label="' + esc(ch.Family) + ' monthly budget">'
            + '<span class="bp-today">today ' + money(ch["Base Spend"]) + (Math.abs(ds) > 1 ? ' · <span class="' + cls(ds / Math.max(1, t.spend)) + '">' + pct(ds / Math.max(1, t.spend)) + "</span>" : "") + "</span>"
            + (ly ? '<span class="bp-today">' + esc(ly.label) + " " + money(ly.spend) + "</span>" : ""),
        leads: n1(p.leads), qual: n1(p.qual), book: n1(p.book) + rng(p.bookLo, p.bookHi, n1), jobs: n1(p.jobs) + rng(p.jobsLo, p.jobsHi, n1),
        morn: n1(p.morning), rev: moneyK(p.rev) + rng(p.revLo, p.revHi, moneyK), profit: moneyK(p.profit),
        cpb: unpaid || p.book < 0.05 ? null : money(p.spend / p.book),
        cpx: !unpaid && Math.abs(ds) > 1 && db > 0.05 ? money(ds / db) : null,
        rpd: unpaid || !p.spend ? null : "$" + (p.rev / p.spend).toFixed(2), ppd: unpaid || !p.spend ? null : "$" + (p.profit / p.spend).toFixed(2),
      };
      if (deepCut) {
        const na = '<span class="muted">not estimable</span>';
        ["leads", "qual", "book", "jobs", "morn", "rev", "profit", "cpb", "cpx", "rpd", "ppd"].forEach(k => { cells[k] = na; });
        anyDeep = true;
      }
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
    const pBook = totals(PP, "book", co), pJobs = totals(PP, "jobs", co), pRev = totals(PP, "rev", co), pProf = totals(PP, "profit", co), pMorn = totals(PP, "morning", co);
    const pBook0 = sum(PT, "book");

    // WHAT A CHANGE BRINGS: only the channels whose budget differs from today's, then the plan as a whole
    // low to high; a plan that raises one channel and cuts another needn't be ordered, so the span of all three
    const R3 = (o, f) => '<span class="bp-rng">' + f(Math.min(o.low, o.mid, o.high)) + "–" + f(Math.max(o.low, o.mid, o.high)) + "</span>";
    const signed = v => (v >= 0 ? "+" : "−") + money(Math.abs(v)), signedN = v => (v >= 0 ? "+" : "−") + n1(Math.abs(v));
    const moved = paid.filter(r => Math.abs(r.plan.spend - r.today.spend) > 1);
    const chRows = moved.map(r => {
      const ch = r.ch, p = r.plan, t = r.today, x = change(p, t), raise = x.ds > 0;
      const ratio = ch["Base Spend"] > 0 ? r.budget / ch["Base Spend"] : 1, own = !!((S.split[co] || {})[ch.Family]);
      const pick = k => ({ low: x.low[k], mid: x.mid[k], high: x.high[k] });
      const head = '<td><span class="bp-ch">' + esc(ch.Family) + "</span>" + (ch["E Basis"] ? '<span class="bp-kind">assumed</span>' : "")
        + '</td><td class="num">' + signed(x.ds) + '<span class="bp-today">' + money(t.spend) + " → " + money(p.spend) + " (" + pct(ratio - 1) + ")</span></td>";
      if (ratio < 0.5 || ratio > 2) return "<tr>" + head + '<td class="num" colspan="5"><span class="muted">not estimable: '
        + (ratio < 0.5 ? "below half of" : "more than twice") + " today's spend</span></td></tr>";
      const be = own ? null : breakEven(x.ds, t.profit, ratio);
      const eLine = '<span class="bp-today">response ' + n2(ch["E Book Lo"]) + " / " + n2(ch["E Book"]) + " / " + n2(ch["E Book Hi"]) + "</span>";
      const beCell = be == null ? (own ? '<span class="muted">split by state</span>' : "—")
        : be.any ? '<span class="muted">any: it saves more than the channel\'s job profit</span>'
        : raise && be.e > 1 ? "≥ " + n2(be.e) + '<span class="bp-today">more than proportional: not plausible</span>' + eLine
        : (raise ? "≥ " : "≤ ") + n2(be.e) + eLine;
      const jm = x.mid.jobs, cpj = raise && jm > 0.05 ? money(x.ds / jm) : !raise && jm < -0.05 ? money(-x.ds / -jm) : "—";
      const jl = raise ? x.low.jobs : x.high.jobs, jh = raise ? x.high.jobs : x.low.jobs;   // dearest / cheapest case
      const cpjRng = raise && jl > 0.05 && jh > 0.05 ? '<span class="bp-rng">' + money(x.ds / jh) + "–" + money(x.ds / jl) + "</span>" : "";
      const rough = ratio < 0.7 || ratio > 1.3 ? '<span class="bp-warn">More than 30% from today: a rough guess</span>' : "";
      return "<tr>" + head
        + '<td class="num strong">' + signedN(x.mid.book) + R3(pick("book"), signedN) + "</td>"
        + '<td class="num">' + cpj + cpjRng + (cpj === "—" ? "" : '<span class="bp-today">' + (raise ? "per extra job" : "saved per job lost") + "</span>") + "</td>"
        + '<td class="num">' + signed(x.mid.profit) + R3(pick("profit"), signed) + "</td>"
        + '<td class="num">' + beCell + "</td>"
        + '<td class="bp-vd"><b>' + verdict(x, raise) + "</b>" + '<span class="bp-today">' + (raise ? "after the extra spend: " : "after the saving: ")
        + signed(x.mid.net) + " in the middle case</span>" + rough + "</td></tr>";
    }).join("");
    let planRow = "";
    const deepCuts = moved.filter(r => r.ch["Base Spend"] > 0 && (r.budget / r.ch["Base Spend"] < 0.5 || r.budget / r.ch["Base Spend"] > 2));
    if (deepCuts.length) {
      // a plan with a channel the curve can't price can't be judged as a whole
      planRow = '<tfoot><tr><td>The plan</td><td class="num">' + signed(moved.reduce((a, r) => a + r.plan.spend - r.today.spend, 0)) + "</td>"
        + '<td colspan="5"><span class="muted">not estimable as a whole: ' + deepCuts.map(r => esc(r.ch.Family)).join(", ")
        + (deepCuts.length > 1 ? " are" : " is") + " outside half to twice today's spend</span></td></tr></tfoot>";
    } else if (moved.length) {
      const X = moved.reduce((a, r) => { const x = change(r.plan, r.today); a.ds += x.ds;
        ["low", "mid", "high"].forEach(n => { ["book", "jobs", "profit", "net"].forEach(k => { a[n][k] += x[n][k]; }); }); return a; },
        { ds: 0, low: { book: 0, jobs: 0, profit: 0, net: 0 }, mid: { book: 0, jobs: 0, profit: 0, net: 0 }, high: { book: 0, jobs: 0, profit: 0, net: 0 } });
      ["low", "mid", "high"].forEach(n => { X[n].pays = X[n].net >= 0; });
      const pick = k => ({ low: X.low[k], mid: X.mid[k], high: X.high[k] }), raise = X.ds > 0,
        // money moved between channels with the total about unchanged (within $100 or 2% of what moved) is a reallocation
        moveOnly = moved.length > 1 && Math.abs(X.ds) < Math.max(100, 0.02 * moved.reduce((a, r) => a + Math.abs(r.plan.spend - r.today.spend), 0));
      planRow = "<tfoot><tr><td>The plan" + (moved.length > 1 ? " (" + moved.length + " channels)" : "") + '</td><td class="num">' + signed(X.ds) + "</td>"
        + '<td class="num strong">' + signedN(X.mid.book) + R3(pick("book"), signedN) + '</td><td class="num">'
        + (raise && X.mid.jobs > 0.05 ? money(X.ds / X.mid.jobs) + '<span class="bp-today">per extra job</span>' : "—") + "</td>"
        + '<td class="num">' + signed(X.mid.profit) + R3(pick("profit"), signed) + '</td><td class="num">—</td><td class="bp-vd"><b>' + (moveOnly ? reallocVerdict(X) : verdict(X, raise)) + "</b>"
        + '<span class="bp-today">' + (moveOnly ? "same spend, job profit: " : raise ? "after the extra spend: " : "after the saving: ") + signed(X.low.net) + " / " + signed(X.mid.net) + " / " + signed(X.high.net) + " (low / middle / high)</span></td></tr></tfoot>";
    }
    const chgTable = moved.length ? '<div class="rs-tablewrap"><table class="rs-table bp-chg"><thead><tr><th>Channel</th><th class="num">Budget change</th>'
      + '<th class="num">Extra bookings</th><th class="num">Ad $ per extra job</th><th class="num">Extra job profit</th>'
      + '<th class="num">Pays for itself if the response is</th><th>Verdict</th></tr></thead><tbody>' + chRows + "</tbody>" + planRow + "</table></div>"
      : '<p class="rs-hint">Change a budget in the table above, or use <b>Every channel at</b>, to see what the change brings at a low, middle and '
        + "high response, against what it costs.</p>";
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
    // Google is left out: its family holds organic search, so its "cost per booking" credits free bookings to the ads
    const ranked = paid.filter(r => r.today.book >= 1 && r.today.spend > 0 && r.ch.Family !== "Google").map(r => ({ f: r.ch.Family, cpb: r.today.spend / r.today.book }))
      .sort((a, b) => a.cpb - b.cpb);
    if (ranked.length >= 2) {
      // never the same channel on both lists
      const nk = Math.min(3, Math.floor(ranked.length / 2));
      live.push("<b>Cheapest bookings at today's budgets:</b> " + ranked.slice(0, nk).map(x => esc(x.f) + " " + money(x.cpb)).join(", ")
        + ". <b>Dearest:</b> " + ranked.slice(-nk).reverse().map(x => esc(x.f) + " " + money(x.cpb)).join(", ") + " (ad $ per booking, " + esc(mo.label) + ").");
    }
    // Google Local in the advisor's words (ZTZ-140): its response is an assumption, so the page says so and names the
    // response a raise would need. +10% stays inside the range the curve is fair for.
    const glr = paid.find(r => r.ch.Family === "Google Local");
    if (glr && glr.ch["E Basis"] && glr.ch["Base Spend"] > 0) {
      const g = glr.ch, up = e => Math.pow(1.1, e) - 1, be = breakEven(0.1 * g["Base Spend"], glr.today.profit, 1.1);
      live.push((co === "Zip to Zip" ? "<b>Google Local</b> has spent at its cap since April and its campaign changed on 16 Oct, so history cannot show what more "
          + "budget would bring. " : "<b>Google Local's</b> response can't be measured from its history. ")
        + "The figures here are assumptions, not measurements: in the middle case 10% more budget (" + money(0.1 * g["Base Spend"]) + ") brings about "
        + (100 * up(g["E Book"])).toFixed(1) + "% more bookings (" + (100 * up(g["E Book Lo"])).toFixed(1) + "% to " + (100 * up(g["E Book Hi"])).toFixed(1) + "%)."
        + (be && be.e != null ? " It pays for itself only if the real response is above <b>" + n2(be.e) + "</b> (the middle case assumes " + n2(g["E Book"]) + ")." : "")
        + " The only way to find out is to raise it for 4 to 6 weeks and compare.");
    }
    // HOW RIGHT HAS THIS BEEN: the backtest, scored the way the page now forecasts (each month with k and c fitted only
    // on what came before it)
    const bt = crew.bt || {}, right = [];
    if (bt.wapeOos != null && bt.origins) {
      const P = v => Math.round(100 * v) + "%", lab = mm => MONTHS[+String(mm).slice(5, 7) - 1] + " " + String(mm).slice(0, 4);
      right.push("Tested on the last " + bt.origins + " months with the real ad spend: the paid channels' bookings, forecast for the month ahead and "
        + "the two after, were off by about <b>" + P(bt.wapeOos) + "</b> on average" + (bt.within != null ? ", and by less than " + P(bt.within)
        + " in 4 months out of 5" : "") + ".");
      if (bt.wapeA != null) {
        const d = bt.wapeA - bt.wapeOos;
        right.push(d > 0.01 ? "A forecast that ignored ad spend did worse (" + P(bt.wapeA) + " off)."
          : "A forecast that ignored ad spend did " + (d < -0.03 ? "better" : d < -0.01 ? "a little better" : "about as well") + " (" + P(bt.wapeA)
            + " off)" + (bt.wapeOos <= 0.3 ? ": the page knows where bookings are heading about as well as a plain run rate, and" : ", and")
            + " the test can't show what an extra dollar buys.");
      }
      if (bt.bias != null && Math.abs(bt.bias - 1) >= 0.02) {
        const high = bt.bias < 1;
        right.push("Over the last 12 months it ran about " + P(Math.abs(1 / bt.bias - 1)) + " " + (high ? "high" : "low") + ". " + (bt.cUsed
          ? "That is now " + (high ? "taken out" : "added back") + (bt.c <= 0.851 || bt.c >= 1.049 ? " (capped: the page moves the level at most 15% down or 5% up)" : "") + "."
          : "Correcting for that would not have made past forecasts better, so the page leaves the level alone and the range carries it."));
      }
      if (bt.recent && bt.recent[0] != null && bt.recentFrom) {
        const a = bt.recent[0], b = bt.recent[1], span = lab(bt.recentFrom) + " – " + lab(bt.recentTo);
        right.push(a > 0.05 ? "<b>Recent months ran high:</b> " + span + ", each forecast on the month's 1st, came out " + P(a) + " to " + P(b)
            + " above what happened. Bookings have fallen faster than the season explains, so read the coming months here as probably high."
          : b < -0.05 ? "<b>Recent months ran low:</b> " + span + ", each forecast on the month's 1st, came out " + P(-b) + " to " + P(-a)
            + " below what happened, so read the coming months here as probably low."
          : span + ", each forecast on the month's 1st, came out " + (b <= 0.05 && a >= -0.05 ? "within 5% of what happened."
            : "from " + P(Math.max(0, -a)) + " below to " + P(Math.max(0, b)) + " above what happened."));
      }
      if (bt.coverOos != null) right.push("The ranges caught " + P(bt.coverOos) + " of the months they weren't fitted on (they aim at 80%).");
      if (bt.unpaidWape != null) right.push("Unpaid sources, forecast at their run rate, were off by about " + P(bt.unpaidWape) + ".");
      if (bt.wapeOos > 0.4) right.push("<b>With this few paid bookings a month, read every number here as rough.</b>");
      const kLo = Math.max(0.1, bt.k - 0.25), kHi = Math.min(1, bt.k + 0.25);
      right.push(bt.kMeasured
        ? "When budgets moved, bookings moved about <b>" + P(bt.k) + "</b> as much as the channels' fitted curves say, but the test can't pin it "
          + "closer than about " + P(kLo) + " to " + P(kHi) + ": the page uses " + P(bt.k) + ", with those as the low and high cases. That was "
          + "measured on bookings; leads keep their own response."
        : "Too few months with a real budget change to measure how much bookings follow the budget; the page assumes half of what the fitted "
          + "curves say, with " + P(kLo) + " and " + P(kHi) + " as the low and high cases.");
    }
    const notes = co === "Zip to Zip" && glr ? [
      "<b>More budget has not been tested:</b> it has spent at its cap since April, so no month shows what more money would bring. A test is proposed.",
      "<b>The budget is used up every month:</b> about $19.5k since April 2026.",
      "<b>The same money buys fewer calls:</b> a charged call cost about $50 in June–August, $55–75 in September and $74–110 since 16 October, "
        + "when Google moved the account to its Pay-per-lead PMax campaign as the autumn slowdown set in.",
      "<b>The fall from 37% to 22% is partly how it's counted:</b> November 2025 was a small, good month (66 qualified leads). With every lead given "
        + "7 days to book (16 Oct – 11 Nov), it is 25.5% last year and 20.0% now. Google Ads search held at 22.3% → 24.1%.",
      "<b>What changed is price and follow-up:</b> quotes are 30–40% higher for the same move size, leads lost to price rose from 4.2 to 16.8 per 100 "
        + "qualified, and leads never reached again from 13.4 to 25.9. Not call speed (95% reached within an hour both years) and not the mix of states "
        + "or move sizes. More budget won't fix a conversion problem.",
    ] : [];
    const says = (live.length || notes.length || right.length) ? '<div class="bp-says">'
      + (live.length ? '<div><div class="bp-says-h">From the numbers on this page</div><ul>' + live.map(x => "<li>" + x + "</li>").join("") + "</ul></div>" : "")
      + (right.length ? '<div><div class="bp-says-h">How right has this been</div><ul>' + right.map(x => "<li>" + x + "</li>").join("") + "</ul></div>" : "")
      + (notes.length ? '<div><div class="bp-says-h">Google Local, measured on 19 Nov 2026</div><ul>' + notes.map(x => "<li>" + x + "</li>").join("") + "</ul></div>" : "")
      + "</div>" : "";

    // states: every channel together
    const stRows = STATES.map(st => {
      const g = k => P.reduce((a, o) => a + (o.byState[st][k] || 0), 0), g0 = k => T.reduce((a, o) => a + (o.byState[st][k] || 0), 0);
      return { st, spend: g("spend"), leads: g("leads"), book: g("book"), jobs: g("jobs"), rev: g("rev"), profit: g("profit"), morning: g("morning"), book0: g0("book") };
    }).filter(x => x.leads > 0.05 || x.spend > 1);
    const stTable = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Ad spend</th><th class="num">Leads</th>'
      + '<th class="num">Bookings</th><th class="num">vs today</th><th class="num">Jobs</th><th class="num">Morning jobs / wk</th><th class="num">Revenue</th>'
      // no money ratios by state (ZTZ-140): spend is spread by lead share, so "ad $ per booking" by state only restated
      // each state's booking rate and would read as a measurement
      + '<th class="num">Job profit</th></tr></thead><tbody>'
      + stRows.map(x => "<tr><td><b>" + x.st + '</b></td><td class="num">' + money(x.spend) + '</td><td class="num">' + n1(x.leads) + '</td><td class="num strong">'
        + n1(x.book) + '</td><td class="num"><span class="' + cls(chg(x.book, x.book0)) + '">' + (Math.abs(x.book - x.book0) < 0.05 ? "—" : pct(chg(x.book, x.book0))) + "</span></td>"
        + '<td class="num">' + n1(x.jobs) + '</td><td class="num">' + n1(x.morning) + '</td><td class="num">' + moneyK(x.rev) + '</td><td class="num">' + moneyK(x.profit)
        + "</td></tr>").join("")
      + "</tbody></table></div>";

    // what each estimate rests on
    const restTable = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Channel</th><th>Kind</th><th>Today is</th><th class="num">Today\'s spend</th>'
      + '<th class="num">Highest month</th><th class="num">Year-on-year months</th><th class="num">Its own e (bookings)</th><th class="num">Response used: bookings</th>'
      + '<th class="num">Response used: leads</th><th class="num">Bill per job</th><th class="num">Job profit per job</th><th class="num">Morning share</th></tr></thead><tbody>'
      + chans.filter(ch => ch.Family !== UNPAID).map(ch => "<tr><td><b>" + esc(ch.Family) + "</b></td><td>" + esc(KIND[ch.Kind] || ch.Kind) + "</td><td>" + esc(ch["Base Basis"])
        + " (" + esc(ch["Base From"]) + " – " + esc(ch["Base To"]) + ')</td><td class="num">' + money(ch["Base Spend"]) + '</td><td class="num">' + money(ch["Max Spend"])
        + (ch["Max Spend Month"] ? '<span class="bp-today">' + esc(ch["Max Spend Month"]) + "</span>" : "") + '</td><td class="num">' + (ch.Pairs || 0)
        + '</td><td class="num">' + (ch["E Book Fit"] != null ? n2(+ch["E Book Fit"]) + " ± " + n2(+ch["E Book SE"]) : '<span class="muted">too little</span>')
        + '</td><td class="num strong">' + n2(ch["E Book"]) + rng(ch["E Book Lo"], ch["E Book Hi"], n2)
        // how much of it is the kind's typical value rather than the channel's own history: an assumed answer never
        // reads as a measured one (Google Local's is all assumed, and says why)
        + '<span class="bp-today">' + (ch["E Basis"] ? "assumed" : Math.round(100 * (num(ch["Prior Weight"]) || 0)) + "% assumed") + "</span>"
        + '</td><td class="num">' + n2(ch["E Lead"]) + rng(ch["E Lead Lo"], ch["E Lead Hi"], n2)
        + '</td><td class="num">' + money(valueFor(ch, m).rev) + '<span class="bp-today">' + valueFor(ch, m).half + "</span>"
        + '</td><td class="num">' + money(valueFor(ch, m).profit) + '<span class="bp-today">' + valueBasis(ch, m) + "</span>" + '</td><td class="num">'
        + Math.round(100 * (ch["Morning Share"] || 0)) + "%</td></tr>").join("") + "</tbody></table></div>";

    const updated = (chans[0] || {})["Update Date"];
    host.innerHTML = RSC.pageHeadHtml({ title: "Ads Budget Planner", key: "budget-planner",
        sub: "Set each channel's monthly budget and see what it should bring, by channel and by state. Today's budgets are filled in: change what you want to test.", how })
      + '<div class="bp-bar">'
      + '<label>Company<span class="rs-seg">' + ["Zip to Zip", "Tuji"].filter(c => D.ch[c] && HIDDEN.indexOf(c) < 0).map(c => '<button type="button" data-bp-co="' + esc(c) + '" class="' + (c === co ? "on" : "") + '">' + esc(c) + "</button>").join("") + "</span></label>"
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
      + (months.findIndex(x => x.key === S.month) >= 3 ? '<p class="bp-foot"><b>' + esc(mo.label) + " is more than three months out:</b> the test "
        + "only reached three months ahead, so read it as rough.</p>" : "")
      + kpis + cap
      + (says ? '<div class="bp-sec">What the data says</div>' + says : "")
      + '<div class="bp-sec">Channels</div>'
      + '<div class="rs-tablewrap"><table class="rs-table bp-tbl">' + head + "<tbody>" + body + "</tbody>" + foot + "</table></div>"
      + (anyDeep ? '<p class="bp-foot"><b>A channel is set below half or above twice today\'s spend:</b> its row says "not estimable", and the totals still count it on the curve, so read them as rough.</p>' : "")
      + '<p class="bp-foot">Each number is the expected value for ' + esc(mo.label) + "; the small line under it is the range the test's forecasts for a "
      + "channel that size fell in 4 times in 5. It is the range at that budget: the doubt about how strongly bookings follow a changed budget is "
      + "shown apart, as the low and high cases under What the change brings. Revenue, job profit and morning jobs take the bookings' range. "
      + "Unpaid sources stay as they are in every plan. Nothing here is saved for anyone else: your budgets stay in this browser.</p>"
      + '<div class="bp-sec">What the change brings</div>'
      + (moved.length ? '<p class="rs-hint">Against today\'s budgets in ' + esc(mo.label) + ", at a <b>low</b>, <b>middle</b> and <b>high</b> response "
        + "(how strongly bookings follow the budget; the small line is low to high). Job profit is before ad cost, so a change pays for itself when "
        + "its extra job profit covers its extra spend.</p>" : "") + chgTable
      + '<div class="bp-sec">States</div>'
      + '<p class="rs-hint">Spend isn\'t split by state for most channels, so each channel\'s results are spread by its own share of leads, bookings and revenue per state '
      + "(last 12 months). Use <b>By state</b> on a channel to split its budget yourself.</p>" + stTable
      + '<div class="bp-sec">What each estimate rests on</div>'
      + '<p class="rs-hint">e is how strongly a channel answers more money: 1 = twice the money, twice the bookings; 0.3 = twice the money, about 23% more. '
      + "<b>Its own e</b> is measured on its year-on-year months. <b>The response used</b> blends that with a typical value for its kind (pay per lead 0.60, "
      + "clicks 0.40, mail 0.60 for bookings) by how much data it has. For bookings it then keeps only the share the test saw; leads keep theirs ("
      + Math.round(100 * (crew.bt && crew.bt.k != null ? crew.bt.k : 0.5)) + "%)."
      + chans.filter(ch => ch["E Basis"]).map(ch => " " + esc(ch.Family) + "'s is its kind's typical value, not its own: " + esc(ch["E Basis"]).replace(/^assumed: /, "") + ".").join("") + "</p>" + restTable
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
