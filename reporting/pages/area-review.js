/* AREA REVIEW (tracker ZTZ-170, 25 Nov 2026).
 *
 * His words: "Built it as a page in company overview ;) it's like seasonal planning but instead of planning
 * it's like review and data comparisons analysis and etc". The model is the "New York City 2026" PDF the
 * Season 2027 plan chat built on 25 Nov; its five sections are this page's sections. His picks: every area,
 * NYC first; NYC = all five boroughs; counties are the sub-areas in the other states; year to date in both
 * years; one map, a click zooms. His rules: compact views (this year's value with its change, no last-year
 * columns), margins in, "Zip To Zip Moving" in anything people read, nothing sent to anyone.
 *
 * THE METHOD IS THE PDF'S (Notes/.private/ny-2026-analysis-build/ny_mkt.py), so the page and the PDF agree:
 *  - window: 1 Jan to the last day with closings, the same days a year earlier;
 *  - jobs: fct_closing, Zip to Zip, Record Source "closing", by PICKUP zip; the sub-area is the zip's county
 *    (mart_area_tier; a zip with no county there is placed by its point inside the county shapes);
 *    the job's source is `Corrected Source`; revenue = Total Bill; gross profit = Profit per Job;
 *  - leads: fct_moveboard, Zip to Zip, by Create Date, State and County Name; good = Status Category
 *    is not "Bad Lead"; booked = the lead's Request Joinkey has a closing;
 *  - ESTIMATED marketing: no ad dollar carries a place, so each lead is charged its source's company-wide cost
 *    per lead that year (the ad ledger, Zip to Zip + Boston rows, over the same window, divided by Zip to Zip's
 *    leads from that source). The lines the ledger keeps per state (Yelp-NY, Post Card - NY ...) are measured,
 *    then split by the area's share of that state's leads from them. Unpaid sources cost $0;
 *  - late arrivals: mart_foreman_late, matched to the job on Request No and Date (recorded from Nov 2025 only,
 *    so this year only);
 *  - next year: the year-to-date figures grown to a full year by last year's ratio for the state; moved or added
 *    money earns 40-65% of what that source's money earned this year (a range); the cut source's money moves
 *    70/30 to Google and Reddit; the MAX plan row is Seasonal Planning's own plan for the area's zips (May-Sep),
 *    scaled to a year by last year's May-Sep share of the area's jobs.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.arv_late) {
    // the late-arrival mart, only what this page needs: no customer column
    RS.DATASETS.arv_late = { table: "mart_foreman_late", cols: ["Request No", "Date", "Company", "Is Late", "Over An Hour"] };
  }
})();

(() => {
  const STATES = ["NY", "NJ", "PA", "CT", "MA", "DE", "MD", "VA"];
  const ST_NAME = { NY: "New York", NJ: "New Jersey", PA: "Pennsylvania", CT: "Connecticut", MA: "Massachusetts",
                    DE: "Delaware", MD: "Maryland", VA: "Virginia" };
  /* NEW YORK IS SPLIT INTO AREAS (his pick: NYC = all five boroughs); upstate is left out ("get rid of upper new york") */
  const NY_AREAS = [
    { key: "nyc", label: "New York City", subs: [["Kings", "Brooklyn"], ["Queens", "Queens"], ["New York", "Manhattan"],
                                                  ["Bronx", "Bronx"], ["Richmond", "Staten Island"]] },
    { key: "li", label: "Long Island", subs: [["Nassau", "Nassau"], ["Suffolk", "Suffolk"]] },
    { key: "wc", label: "Westchester", subs: [["Westchester", "Westchester"]] },
    { key: "ro", label: "Rockland and Orange", subs: [["Rockland", "Rockland"], ["Orange", "Orange"]] },
    { key: "hv", label: "Hudson Valley", subs: [["Putnam", "Putnam"], ["Dutchess", "Dutchess"], ["Ulster", "Ulster"],
                                                ["Sullivan", "Sullivan"], ["Columbia", "Columbia"], ["Greene", "Greene"]] },
  ];
  const MAX_SUBS = 8;                   // a state's busiest counties get a tile; the rest are "Rest of <state>"
  const CLOSE2LEAD = { "Angie's List": "Angi", "Chatgpt": "ChatGPT", "Bbb": "BBB" };
  const UNPAID = new Set(["Recommended", "Returned Customer", "Website", "Other", "Moveboard", "Gemini", "Word of mouth", "CL",
    "Craiglist", "Perplexity", "TrustPilot", "Movers.com", "Philadelphia", "Consumer Advocates", "My Moving Reviews", "?", "",
    "null"]);
  const MOVE_TO = { Google: 0.7, Reddit: 0.3 };          // where a cut source's money goes
  const EARN = [0.40, 0.65];                              // what moved or added money earns, against this year's
  const SEASON = [5, 6, 7, 8, 9];                         // the plan's months (May-Sep)

  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
  const n0 = v => Math.round(v || 0).toLocaleString("en-US");
  const usd = v => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v || 0)).toLocaleString("en-US");
  const kk = v => { const a = Math.abs(v || 0), s = v < 0 ? "−$" : "$";
    return a >= 999500 ? s + (a / 1e6).toFixed(a >= 9.95e6 ? 0 : 1) + "M" : a >= 9500 ? s + Math.round(a / 1000).toLocaleString("en-US") + "k"
      : a >= 1000 ? s + (a / 1000).toFixed(1) + "k" : s + Math.round(a); };
  const pctTxt = v => (Math.round(v * 1000) / 10).toFixed(1) + "%";
  const truthy = v => v === true || v === 1 || v === "1" || String(v).toLowerCase() === "true" || String(v).toLowerCase() === "yes";
  const z5 = z => { const d = String(z == null ? "" : z).replace(/\D/g, ""); return d ? d.slice(0, 5).padStart(5, "0") : ""; };
  const day = v => String(v == null ? "" : v).slice(0, 10);

  /* a change: "(+12%)" green or red by whether the move is good; costs pass good=-1 */
  function chg(a, b, good) {
    const g = good == null ? 1 : good;
    if (!b) return a ? '<span class="arv-c flat">(new)</span>' : "";
    const v = (a / b - 1) * 100, s = Math.abs(v) < 0.5 ? "flat" : (v * g > 0 ? "up" : "dn");
    return '<span class="arv-c ' + s + '">(' + (v > 0 ? "+" : "") + Math.round(v) + "%)</span>";
  }
  /* a value that can be negative (gross profit after marketing): a % of a negative base reads nonsense ("-721%"),
     so a base at or below zero, or a change of sign, shows where it came from instead */
  function chgSigned(a, b) {
    if (b > 0 && a >= 0) return chg(a, b);
    if (!b && !a) return "";
    return '<span class="arv-c ' + (a > b ? "up" : a < b ? "dn" : "flat") + '">(was ' + kk(b) + ")</span>";
  }
  function chgPts(a, b) {
    const v = (a - b) * 100, s = Math.abs(v) < 0.05 ? "flat" : v > 0 ? "up" : "dn";
    return '<span class="arv-c ' + s + '">(' + (v > 0 ? "+" : "") + v.toFixed(1) + " pts)</span>";
  }
  const pctOf = (a, b) => b ? a / b : 0;

  function injectStyle() {
    const old = document.getElementById("arv-style"); if (old) old.remove();
    const st = document.createElement("style"); st.id = "arv-style";
    st.textContent = ""
      + ".arv{font-variant-numeric:tabular-nums}"
      + ".arv-bar{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:10px 0 6px}"
      + ".arv-bar .lab{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}"
      + ".arv-chips{display:flex;flex-wrap:wrap;gap:6px}"
      + ".arv-win{font-size:12.5px;color:var(--muted);margin:2px 2px 12px}"
      + ".arv-h{font-size:16px;font-weight:650;margin:18px 2px 8px}"
      + ".arv-h small{font-size:12.5px;font-weight:500;color:var(--muted);margin-left:8px}"
      + ".arv-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}"
      + ".arv-tile{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel);cursor:pointer}"
      + ".arv-tile:hover,.arv-tile.on{border-color:var(--ink)}"
      + ".arv-tile.all{background:var(--panel2,var(--panel))}"
      + ".arv-tile h4{margin:0 0 6px;font-size:15px;font-weight:650}"
      + ".arv-row{display:flex;justify-content:space-between;gap:8px;font-size:13px;padding:3px 0;border-bottom:1px solid var(--line)}"
      + ".arv-row:last-of-type{border-bottom:0}"
      + ".arv-row span:first-child{color:var(--muted)}"
      + ".arv-verdict{font-size:12.5px;line-height:1.45;margin-top:8px;color:var(--ink)}"
      + ".arv-c{font-weight:650;font-size:12px;margin-left:4px;white-space:nowrap}"
      + ".arv-c.up{color:#2F7D4A}.arv-c.dn{color:#B3261E}.arv-c.flat{color:var(--muted)}"
      + ".arv-est{font-style:italic}"
      + ".arv-note{font-size:12.5px;color:var(--muted);margin:6px 2px 0;line-height:1.5}"
      + ".arv-box{border-left:3px solid #2F7D4A;background:var(--panel);padding:10px 14px;border-radius:0 10px 10px 0;font-size:13px;line-height:1.5;margin-top:10px}"
      + ".arv-map{height:min(62vh,560px);min-height:420px;border-radius:12px;border:1px solid var(--line);overflow:hidden;background:#d0cfd4}"
      + ".arv-zl{background:none;border:0}"
      + ".arv-zl span{display:inline-block;font-size:12px;font-weight:700;color:#10261a;background:rgba(255,255,255,.86);"
      +   "padding:1px 5px;border-radius:4px;white-space:nowrap;transform:translate(-50%,-50%)}"
      + ".arv-legend{display:flex;gap:10px;align-items:center;font-size:12px;color:var(--muted);margin:8px 2px 0;flex-wrap:wrap}"
      + ".arv-legend i{display:inline-block;width:16px;height:12px;border-radius:3px;vertical-align:middle;margin-right:4px}"
      + ".arv table.rs-table td.n,.arv table.rs-table th.n{text-align:right;white-space:nowrap}";
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------------- geometry (pure) */
  function inRing(x, y, ring) {
    let ins = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / ((yj - yi) || 1e-12) + xi)) ins = !ins;
    }
    return ins;
  }
  function inGeom(lo, la, g) {
    if (!g) return false;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    return polys.some(p => p.length && inRing(lo, la, p[0]) && !p.slice(1).some(h => inRing(lo, la, h)));
  }

  /* ---------------------------------------------------------------- the model (pure: rows in, numbers out) */
  function buildModel(D) {
    // the zip -> state, county and point, from the plan's zip list; a zip with no county is placed by its point
    const ZIP = {};
    (D.tier || []).forEach(a => {
      if (a.Level !== "Zip") return;
      const z = z5(a.Zip || a["Area Key"]); if (!z) return;
      ZIP[z] = { st: a.State, county: String(a.County || "").trim(), la: num(a.Latitude), lo: num(a.Longitude) };
    });
    const cfs = (D.counties && D.counties.features) || [];
    Object.keys(ZIP).forEach(z => {
      const o = ZIP[z]; if (o.county || !o.la) return;
      const f = cfs.find(c => c.properties && c.properties.st === o.st && inGeom(o.lo, o.la, c.geometry));
      if (f) o.county = f.properties.name;
    });
    // the window: 1 Jan to the last day with a closing, the same days a year earlier
    const cl = (D.closing || []).filter(r => r.Company === "Zip to Zip" && r["Record Source"] === "closing" && day(r.Date));
    const last = cl.reduce((m, r) => day(r.Date) > m ? day(r.Date) : m, "");
    const Y = +last.slice(0, 4), CUT = last.slice(5);
    const inWin = d => { const y = +d.slice(0, 4); return (y === Y || y === Y - 1) && d.slice(5) <= CUT; };
    const yOf = d => +d.slice(0, 4) === Y ? "cur" : "prev";
    const joinkeys = new Set(cl.map(r => r["Request Joinkey"]).filter(Boolean));
    // jobs
    const jobs = [], prevFull = [];
    cl.forEach(r => {
      const d = day(r.Date), z = z5(r["Pickup Zip"]), g = ZIP[z] || null;
      const rec = { d, z, st: g ? g.st : (r.State || ""), county: g ? g.county : "", rev: num(r["Total Bill"]), gp: num(r["Profit per Job"]),
                    src: CLOSE2LEAD[r["Corrected Source"]] || r["Corrected Source"] || "?", req: String(r["Request #"] || ""), m: +d.slice(5, 7) };
      if (+d.slice(0, 4) === Y - 1) prevFull.push(rec);
      if (inWin(d)) { rec.y = yOf(d); jobs.push(rec); }
    });
    // leads
    const leads = [], coLeads = { cur: {}, prev: {} };
    (D.moveboard || []).forEach(r => {
      if (r.Company !== "Zip to Zip") return;
      const d = day(r["Create Date"]); if (!d || !inWin(d)) return;
      const y = yOf(d), src = String(r.Source || "?");
      coLeads[y][src] = (coLeads[y][src] || 0) + 1;
      leads.push({ y, st: r.State || "", county: String(r["County Name"] || "").trim(), src,
                   bad: r["Status Category"] === "Bad Lead", booked: !!(r["Request Joinkey"] && joinkeys.has(r["Request Joinkey"])) });
    });
    // the ad ledger over the same window: per source, and the lines kept per state
    const spend = { cur: {}, prev: {} }, perState = { cur: {}, prev: {} }, yelpAll = { cur: 0, prev: 0 };
    (D.card || []).forEach(r => {
      if (!truthy(r["Is Advertising"]) || (r.Company !== "Zip to Zip" && r.Company !== "Boston")) return;
      const d = day(r["Transaction Date"]); if (!d || !inWin(d)) return;
      const y = yOf(d), src = String(r.Source || "?"), sub = String(r["Sub Category"] || ""), amt = num(r.Amount);   // spend is positive here, a refund negative
      spend[y][src] = (spend[y][src] || 0) + amt;
      let m = /^Yelp-([A-Z]{2})$/.exec(sub);
      if (src === "Yelp") { yelpAll[y] = (yelpAll[y] || 0) + amt; if (m) { const k = "Yelp|" + m[1]; perState[y][k] = (perState[y][k] || 0) + amt; } }
      m = /^Post Card - ([A-Z]{2})$/.exec(src); if (m) { const k = "Post Card|" + m[1]; perState[y][k] = (perState[y][k] || 0) + amt; }
    });
    // a state's leads per source (the measured state lines are split by these)
    const yelpByState = {};
    ["cur", "prev"].forEach(y => { const st = Object.keys(perState[y]).filter(k => k.startsWith("Yelp|")).reduce((t, k) => t + perState[y][k], 0);
      yelpByState[y] = yelpAll[y] > 0 && st / yelpAll[y] >= 0.9; });
    const stLeads = { cur: {}, prev: {} };
    leads.forEach(l => { const k = l.st + "|" + l.src; stLeads[l.y][k] = (stLeads[l.y][k] || 0) + 1; });
    // late arrivals, this year only (recorded from Nov 2025)
    const late = {};
    (D.late || []).forEach(r => { if (r.Company && r.Company !== "Zip to Zip") return;
      late[String(r["Request No"] || "") + "|" + day(r.Date)] = { late: truthy(r["Is Late"]), hr: truthy(r["Over An Hour"]) }; });
    jobs.forEach(j => { if (j.y === "cur") j.late = late[j.req + "|" + j.d] || null; });
    return { ZIP, Y, CUT, last, jobs, prevFull, leads, coLeads, spend, perState, stLeads, yelpByState };
  }

  /* one lead's estimated cost: its source's company-wide cost per lead, or the state's measured line */
  function leadCost(M, y, st, src) {
    if (UNPAID.has(src)) return 0;
    const pc = /^Post Card( - [A-Z]{2})?$/.test(src);
    if (pc) {
      const k = "Post Card|" + st, sp = M.perState[y][k] || 0;
      const n = (M.stLeads[y][st + "|Post Card"] || 0) + (M.stLeads[y][st + "|Post Card - " + st] || 0);
      return n ? sp / n : 0;
    }
    if (src === "Yelp" && M.yelpByState[y] && M.perState[y]["Yelp|" + st]) {
      const n = M.stLeads[y][st + "|Yelp"] || 0;
      return n ? M.perState[y]["Yelp|" + st] / n : 0;
    }
    const l = M.coLeads[y][src] || 0;
    return l ? (M.spend[y][src] || 0) / l : 0;
  }

  /* the areas of a state: NY's are fixed groups; elsewhere the state is one area with its busiest counties */
  function areasOf(M, st) {
    if (st === "NY") return NY_AREAS;
    const n = {};
    M.jobs.forEach(j => { if (j.st === st && j.county) n[j.county] = (n[j.county] || 0) + 1; });
    M.leads.forEach(l => { if (l.st === st && l.county) n[l.county] = (n[l.county] || 0) + 0.1; });
    const ranked = Object.keys(n).sort((a, b) => n[b] - n[a]);
    const top = ranked.slice(0, MAX_SUBS), rest = ranked.slice(MAX_SUBS);
    const subs = top.map(c => [c, c]);
    if (rest.length) subs.push([rest, "Rest of " + ST_NAME[st]]);
    return [{ key: "all", label: ST_NAME[st], subs }];
  }
  const subMatch = (sub, county) => Array.isArray(sub[0]) ? sub[0].indexOf(county) >= 0 : sub[0] === county;

  function blank() { return { jobs: 0, rev: 0, gp: 0, leads: 0, good: 0, booked: 0, spend: 0, lateN: 0, late: 0, hr: 0 }; }
  function measure(M, st, subs) {
    const out = subs.map(() => ({ cur: blank(), prev: blank() })), src = { cur: {}, prev: {} };
    const ix = c => subs.findIndex(s => subMatch(s, c));
    const S = (y, s) => (src[y][s] = src[y][s] || blank());
    M.jobs.forEach(j => { if (j.st !== st) return; const i = ix(j.county); if (i < 0) return;
      const o = out[i][j.y]; o.jobs++; o.rev += j.rev; o.gp += j.gp;
      const q = S(j.y, j.src); q.jobs++; q.rev += j.rev; q.gp += j.gp;
      if (j.late) { o.lateN++; if (j.late.late) o.late++; if (j.late.hr) o.hr++; } });
    M.leads.forEach(l => { if (l.st !== st) return; const i = ix(l.county); if (i < 0) return;
      const c = leadCost(M, l.y, st, l.src), o = out[i][l.y], q = S(l.y, l.src);
      [o, q].forEach(x => { x.leads++; if (!l.bad) x.good++; if (l.booked) x.booked++; x.spend += c; }); });
    const tot = { cur: blank(), prev: blank() };
    out.forEach(o => ["cur", "prev"].forEach(y => Object.keys(tot[y]).forEach(k => { tot[y][k] += o[y][k]; })));
    return { subs: out, tot, src };
  }

  /* next year: three scenarios and the MAX plan, full-year, as ranges */
  function scenarios(M, st, subs, R, plan) {
    const S = R.src.cur, T = R.tot.cur;
    if (!T.jobs) return null;
    const avgRev = T.rev / T.jobs, avgGp = T.gp / T.jobs, baseSp = T.spend;
    const prevWin = M.jobs.filter(j => j.y === "prev" && j.st === st).length;
    const prevYear = M.prevFull.filter(j => j.st === st).length;
    const FULL = prevWin ? prevYear / prevWin : 1;
    const yld = s => (S[s] && S[s].spend > 0) ? S[s].jobs / S[s].spend : 0;
    // the worst paid source: the most spend per job among those carrying a real share of the money
    const paid = Object.keys(S).filter(s => S[s].spend > Math.max(500, baseSp * 0.05));
    const worst = paid.sort((a, b) => (S[b].spend / Math.max(S[b].jobs, 0.01)) - (S[a].spend / Math.max(S[a].jobs, 0.01)))[0] || null;
    let to = Object.keys(MOVE_TO).filter(s => s !== worst && yld(s) > 0);
    let w = MOVE_TO;
    if (!to.length) {        // no Google or Reddit money here: the best two paid sources take it, evenly
      to = Object.keys(S).filter(s => s !== worst && yld(s) > 0).sort((a, b) => yld(b) - yld(a)).slice(0, 2);
      w = {}; to.forEach(s => { w[s] = 1 / to.length; });
    }
    const wsum = to.reduce((a, s) => a + w[s], 0) || 1;
    const gain = (money, e) => to.reduce((a, s) => a + money * (w[s] / wsum) * yld(s) * e, 0);
    const row = (name, sp, jobsLo, jobsHi, note) => ({ name, note, spend: sp * FULL,
      jobs: [jobsLo * FULL, jobsHi * FULL], rev: [jobsLo * avgRev * FULL, jobsHi * avgRev * FULL],
      gpa: [(jobsLo * avgGp - sp) * FULL, (jobsHi * avgGp - sp) * FULL] });
    const rows = [row("Keep as it is", baseSp, T.jobs, T.jobs, "the same money in the same sources")];
    if (worst && to.length) {
      const wj = S[worst].jobs, ws = S[worst].spend, toTxt = to.join(" and ");
      rows.push(row("Same money, " + worst + " out", baseSp, T.jobs - wj + gain(ws, EARN[0]), T.jobs - wj + gain(ws, EARN[1]),
                    worst + "'s money moves to " + toTxt));
      rows.push(row("Grow +50%, " + worst + " out", baseSp * 1.5, T.jobs - wj + gain(ws, EARN[0]) + gain(baseSp * 0.5, EARN[0]),
                    T.jobs - wj + gain(ws, EARN[1]) + gain(baseSp * 0.5, EARN[1]), "the extra half goes to " + toTxt + " too"));
    }
    // the MAX plan: Seasonal Planning's own May-Sep plan for these zips, scaled to a year
    let maxRow = null;
    if (plan && plan.length) {
      let pj = 0, pm = 0;
      plan.forEach(p => { const g = M.ZIP[p.zip]; if (!g || g.st !== st || !subs.some(s => subMatch(s, g.county))) return;
        pj += num(p.planJobs); pm += num(p.budget); });
      // the state's May-Sep share of last year's jobs (the PDF's NY 64%): steadier than one county's
      const stPrev = M.prevFull.filter(j => j.st === st);
      const share = stPrev.length ? stPrev.filter(j => SEASON.indexOf(j.m) >= 0).length / stPrev.length : 0;
      if (pj && share) {
        const jy = pj / share, my = pm / share;
        maxRow = { name: "MAX plan", note: "Seasonal Planning's MAX plan for these zips, May–Sep, grown to a year (" +
                   Math.round(share * 100) + "% of last year's " + st + " jobs fell in May–Sep)",
                   spend: my, jobs: [jy, jy], rev: [jy * avgRev, jy * avgRev], gpa: [jy * avgGp - my, jy * avgGp - my] };
      }
    }
    return { rows, maxRow, worst, to, FULL, avgRev, avgGp };
  }

  /* one plain sentence per sub-area */
  function verdict(c, p) {
    const ch = (a, b) => b ? Math.round((a / b - 1) * 100) : null;
    const j = ch(c.jobs, p.jobs), g = ch(c.good, p.good);
    if (!p.jobs && !c.jobs) return "No jobs here in either year.";
    if (j == null) return "New this year: " + n0(c.jobs) + " jobs.";
    let s = j < 0 ? "Jobs fell " + Math.abs(j) + "%" : j > 0 ? "Jobs rose " + j + "%" : "Jobs held level";
    if (g != null) {
      const gap = Math.abs(g) - Math.abs(j);
      if (j < 0 && g < 0) s += gap > 5 ? " while good leads fell " + Math.abs(g) + "%: a larger share of them booked"
        : gap < -5 ? ", more than good leads (" + g + "%): fewer of them booked" : ", in line with good leads (" + g + "%)";
      else if (j < 0 && g >= 0) s += " although good leads " + (g ? "rose " + g + "%" : "held level") + ": fewer of them booked";
      else if (j > 0 && g > 0) s += g - j > 5 ? " on " + g + "% more good leads, though fewer of them booked"
        : j - g > 5 ? ", ahead of good leads (+" + g + "%): better booking" : ", in line with good leads (+" + g + "%)";
      else if (j > 0 && g <= 0) s += " on " + (g ? "fewer good leads (" + g + "%)" : "the same good leads") + ": better booking";
      else if (j === 0) s += " with good leads " + (g > 0 ? "up " + g + "%" : g < 0 ? "down " + Math.abs(g) + "%" : "level");
    }
    s += ". ";
    if (c.jobs) s += "Estimated marketing " + kk(c.spend) + ", " + usd(c.spend / c.jobs) + " a job; gross profit after it " + kk(c.gp - c.spend) + ".";
    return s;
  }

  registerPage({
    id: "area-review",
    group: "company",
    title: "Area Review",
    subtitle: "This year against the same days last year, area by area: jobs, leads, marketing, margins and next year's budget.",
    datasets: [],

    render(host) {
      injectStyle();
      const mine = host, alive = () => document.body.contains(mine);
      const S = window.__ARV || (window.__ARV = { st: "NY", area: "nyc", sub: -1 });
      host.innerHTML = RSC.loadingHtml("Area Review", "Reading jobs, leads, the ad ledger and the plan…");
      let M = null, PLAN = null, MAP = null;

      const geo = fetch("assets/vendor/geo/counties8.geojson").then(r => r.json()).catch(() => null);
      Promise.all([
        RS.load("closing"), RS.load("moveboard"), RS.load("card_expenses"),
        RS.load("area_tier").catch(() => []), RS.load("arv_late").catch(() => []), geo,
      ]).then(([closing, moveboard, card, tier, late, counties]) => {
        if (!alive()) return;
        M = buildModel({ closing, moveboard, card, tier, late, counties });
        M.counties = counties;
        paint();
        // the MAX plan comes from Seasonal Planning itself, run without drawing (window.AREA_PLAN_HEADLESS)
        if (typeof window.AREA_PLAN_HEADLESS === "function") {
          window.AREA_PLAN_HEADLESS(rows => { PLAN = rows || []; if (alive()) paintBudget(); });
        }
      }).catch(e => { if (alive()) host.innerHTML = RSC.pageHeadHtml({ title: "Area Review", key: "area-review" })
        + '<div class="panel">Could not load — ' + esc(e && e.message || e) + "</div>"; });

      function areaNow() {
        const list = areasOf(M, S.st);
        const a = list.find(x => x.key === S.area) || list[0];
        S.area = a.key; if (S.sub >= a.subs.length) S.sub = -1;
        return { list, a };
      }
      function winTxt() {
        const f = d => { const [y, m, dd] = d.split("-"); return +dd + " " + ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+m - 1] + " " + y; };
        return "1 Jan – " + f(M.last) + " against the same days of " + (M.Y - 1)
          + ". The portal's job data stops on " + f(M.last) + " (the switch to the new software), so both years stop there.";
      }

      function paint() {
        const { list, a } = areaNow();
        const R = measure(M, S.st, a.subs);
        const how = "<p>Jobs are Zip To Zip Moving's closings counted by <b>pickup zip</b>; a zip's sub-area is its county. "
          + "Revenue is the bill, gross profit is the job's own profit (the bill minus the job's expenses, before trucks, "
          + "marketing and overhead).</p><p>Leads are counted by the county the lead gives; a <b>good lead</b> is any lead not marked "
          + "Bad Lead, and <b>booked</b> means the lead's request has a closing.</p><p><b>Marketing is an estimate.</b> No ad dollar "
          + "carries a place, so each lead is charged its source's cost per lead for the whole company that year (the ad ledger "
          + "over the same days, divided by that source's leads). Yelp and postcards are kept per state in the ledger, so those "
          + "are measured and split by the area's leads. Unpaid sources (recommended, returning customers, the website…) cost $0.</p>"
          + "<p>Late arrivals are recorded from November 2025, so they show this year only.</p><p>Next year's figures grow this "
          + "year's to a full year by last year's ratio for the state. Money moved or added earns 40–65% of what that source's "
          + "money earned this year, shown as a range; a cut source's money moves 70/30 to Google and Reddit.</p>";
        let h = '<div class="arv">' + RSC.pageHeadHtml({ title: "Area Review", key: "area-review",
          sub: "This year against the same days last year, area by area: jobs, leads, marketing, margins and next year's budget.",
          how });
        // the picker: state, then (New York) the area, then the borough or county
        h += '<div class="arv-bar"><span class="lab">State</span><div class="arv-chips">' + STATES.map(s =>
          '<button type="button" class="rs-tog' + (S.st === s ? " on" : "") + '" data-arvst="' + s + '"><i></i>' + esc(s) + "</button>").join("") + "</div></div>";
        if (list.length > 1) h += '<div class="arv-bar"><span class="lab">Area</span><div class="arv-chips">' + list.map(x =>
          '<button type="button" class="rs-tog' + (x.key === a.key ? " on" : "") + '" data-arvarea="' + x.key + '"><i></i>' + esc(x.label) + "</button>").join("") + "</div></div>";
        h += '<div class="arv-bar"><span class="lab">' + (S.st === "NY" && a.key === "nyc" ? "Borough" : "County") + '</span><div class="arv-chips">'
          + '<button type="button" class="rs-tog' + (S.sub < 0 ? " on" : "") + '" data-arvsub="-1"><i></i>All of ' + esc(a.label) + "</button>"
          + a.subs.map((s, i) => '<button type="button" class="rs-tog' + (S.sub === i ? " on" : "") + '" data-arvsub="' + i + '"><i></i>' + esc(s[1]) + "</button>").join("")
          + "</div></div>";
        h += '<p class="arv-win">' + esc(winTxt()) + "</p>";

        // 1. AT A GLANCE
        const tile = (label, c, p, i) => '<div class="arv-tile' + (i < 0 ? " all" : "") + (S.sub === i ? " on" : "") + '" data-arvsub="' + i + '">'
          + "<h4>" + esc(label) + "</h4>"
          + rowH("Jobs", n0(c.jobs) + chg(c.jobs, p.jobs))
          + rowH("Revenue", kk(c.rev) + chg(c.rev, p.rev))
          + rowH("Average job", (c.jobs ? usd(c.rev / c.jobs) : "—") + (c.jobs && p.jobs ? chg(c.rev / c.jobs, p.rev / p.jobs) : ""))
          + rowH("Leads", n0(c.leads) + chg(c.leads, p.leads))
          + rowH("Good leads", n0(c.good) + chg(c.good, p.good))
          + rowH('<span class="arv-est">Marketing (estimate)</span>', kk(c.spend) + chg(c.spend, p.spend, -1))
          + rowH("Gross profit after marketing", kk(c.gp - c.spend) + chgSigned(c.gp - c.spend, p.gp - p.spend))
          + rowH("Late arrivals", c.lateN ? n0(c.late) + " of " + n0(c.lateN) + " (" + Math.round(100 * c.late / c.lateN) + "%)" : "—")
          + '<div class="arv-verdict">' + esc(verdict(c, p)) + "</div></div>";
        function rowH(l, v) { return '<div class="arv-row"><span>' + l + "</span><span>" + v + "</span></div>"; }
        h += '<div class="arv-h">At a glance<small>this year, with its change on the same days last year</small></div>';
        h += '<div class="arv-tiles">' + tile("All of " + a.label, R.tot.cur, R.tot.prev, -1)
          + a.subs.map((s, i) => tile(s[1], R.subs[i].cur, R.subs[i].prev, i)).join("") + "</div>";

        // the focus: one sub-area, or the whole area
        const F = S.sub >= 0 ? measure(M, S.st, [a.subs[S.sub]]) : R;
        const fName = S.sub >= 0 ? a.subs[S.sub][1] : a.label;

        // 2. WHY JOBS MOVED
        h += '<div class="arv-h">Why jobs moved<small>leads → good leads → booked → jobs</small></div>';
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + '<th>' + (S.st === "NY" && a.key === "nyc" ? "Borough" : "County") + '</th><th class="n">Leads</th><th class="n">Good leads</th><th class="n">Booked</th>'
          + '<th class="n">Jobs</th><th class="n">Jobs of good leads</th></tr></thead><tbody>'
          + a.subs.map((s, i) => funnelRow(s[1], R.subs[i].cur, R.subs[i].prev)).join("")
          + funnelRow("All of " + a.label, R.tot.cur, R.tot.prev, true) + "</tbody></table></div></div>";
        function funnelRow(l, c, p, b) {
          const td = (v, x) => '<td class="n">' + v + x + "</td>";
          return "<tr>" + (b ? "<td><b>" + esc(l) + "</b></td>" : "<td>" + esc(l) + "</td>")
            + td(n0(c.leads), chg(c.leads, p.leads)) + td(n0(c.good), chg(c.good, p.good)) + td(n0(c.booked), chg(c.booked, p.booked))
            + td(n0(c.jobs), chg(c.jobs, p.jobs)) + td(c.good ? pctTxt(c.jobs / c.good) : "—", p.good ? chgPts(pctOf(c.jobs, c.good), pctOf(p.jobs, p.good)) : "") + "</tr>";
        }
        const srcs = Object.keys(F.src.cur).concat(Object.keys(F.src.prev)).filter((s, i, x) => x.indexOf(s) === i)
          .filter(s => (F.src.cur[s] || blank()).leads + (F.src.cur[s] || blank()).jobs + (F.src.prev[s] || blank()).jobs >= 3)
          .sort((x, y) => ((F.src.cur[y] || blank()).jobs - (F.src.cur[x] || blank()).jobs) || ((F.src.cur[y] || blank()).leads - (F.src.cur[x] || blank()).leads));
        h += '<p class="arv-note">Sources in ' + esc(fName) + ", by this year's jobs.</p>";
        h += '<div class="panel" style="padding:0;margin-top:6px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + '<th>Source</th><th class="n">Leads</th><th class="n">Bad leads</th><th class="n">Booked</th><th class="n">Booked of good</th>'
          + '<th class="n">Jobs</th><th class="n">Revenue</th></tr></thead><tbody>'
          + srcs.map(s => { const c = F.src.cur[s] || blank(), p = F.src.prev[s] || blank();
              return "<tr><td>" + esc(s) + '</td><td class="n">' + n0(c.leads) + chg(c.leads, p.leads) + '</td><td class="n">'
                + (c.leads ? pctTxt((c.leads - c.good) / c.leads) : "—") + (c.leads && p.leads ? chgPts(1 - c.good / c.leads, 1 - p.good / p.leads) : "")
                + '</td><td class="n">' + n0(c.booked) + chg(c.booked, p.booked) + '</td><td class="n">' + (c.good ? pctTxt(c.booked / c.good) : "—")
                + (c.good && p.good ? chgPts(c.booked / c.good, p.booked / p.good) : "") + '</td><td class="n">' + n0(c.jobs) + chg(c.jobs, p.jobs)
                + '</td><td class="n">' + kk(c.rev) + chg(c.rev, p.rev) + "</td></tr>"; }).join("")
          + "</tbody></table></div></div>";

        // 3. MARKETING AND RETURN (an estimate)
        h += '<div class="arv-h">Marketing and return<small class="arv-est">the spend is an estimate: see How it\'s counted</small></div>';
        const mRow = (l, c, p, b) => {
          const td = v => '<td class="n">' + v + "</td>";
          const L = b ? "<b>" + esc(l) + "</b>" : esc(l);
          return "<tr><td>" + L + "</td>" + td(kk(c.spend) + chg(c.spend, p.spend, -1))
            + td(c.leads ? usd(c.spend / c.leads) + (p.leads ? chg(c.spend / c.leads, p.spend / p.leads, -1) : "") : "—")
            + td(c.jobs ? usd(c.spend / c.jobs) + (p.jobs ? chg(c.spend / c.jobs, p.spend / p.jobs, -1) : "") : "—")
            + td(c.spend ? "$" + (c.rev / c.spend).toFixed(1) + (p.spend ? chg(c.rev / c.spend, p.rev / p.spend) : "") : "—")
            + td(kk(c.gp - c.spend) + chgSigned(c.gp - c.spend, p.gp - p.spend))
            + td(c.jobs ? usd((c.gp - c.spend) / c.jobs) + (p.jobs ? chgSigned((c.gp - c.spend) / c.jobs, (p.gp - p.spend) / p.jobs) : "") : "—") + "</tr>";
        };
        const mHead = '<thead><tr><th></th><th class="n">Marketing</th><th class="n">Per lead</th><th class="n">Per job</th>'
          + '<th class="n">Revenue per $1</th><th class="n">Gross profit after marketing</th><th class="n">… per job</th></tr></thead>';
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even">' + mHead + "<tbody>"
          + a.subs.map((s, i) => mRow(s[1], R.subs[i].cur, R.subs[i].prev)).join("") + mRow("All of " + a.label, R.tot.cur, R.tot.prev, true)
          + "</tbody></table></div></div>";
        const paidSrc = srcs.filter(s => (F.src.cur[s] || blank()).spend > 0 || (F.src.prev[s] || blank()).spend > 0)
          .sort((x, y) => (F.src.cur[y] || blank()).spend - (F.src.cur[x] || blank()).spend);
        h += '<p class="arv-note">Paid sources in ' + esc(fName) + ", by this year's estimated spend.</p>";
        h += '<div class="panel" style="padding:0;margin-top:6px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even">'
          + mHead.replace("<th></th>", "<th>Source</th>") + "<tbody>"
          + paidSrc.map(s => mRow(s, F.src.cur[s] || blank(), F.src.prev[s] || blank())).join("") + "</tbody></table></div></div>";

        // 4. THE MAP
        h += '<div class="arv-h">Map<small>zip codes filled by this year\'s jobs · click a ' + (S.st === "NY" && a.key === "nyc" ? "borough" : "county")
          + " or its tile to zoom</small></div>";
        h += '<div class="arv-map" id="arvMap"></div><div class="arv-legend" id="arvLegend"></div>';

        // 5. NEXT YEAR'S BUDGET
        h += '<div class="arv-h">Next year\'s budget<small>' + esc(fName) + ", a full year</small></div>";
        h += '<div id="arvBudget"></div>';
        h += "</div>";
        if (MAP) { try { MAP.remove(); } catch (e) { /* gone with the old DOM */ } MAP = null; }
        host.innerHTML = h;
        wire(a);
        paintBudget();
        drawMap(a, R);
      }

      function paintBudget() {
        const el = host.querySelector("#arvBudget"); if (!el || !M) return;
        const { a } = areaNow();
        const subs = S.sub >= 0 ? [a.subs[S.sub]] : a.subs;
        const F = measure(M, S.st, subs);
        const sc = scenarios(M, S.st, subs, F, PLAN);
        if (!sc) { el.innerHTML = '<div class="panel">No jobs here this year to build next year on.</div>'; return; }
        const rng = (v, f) => Math.round(v[0]) === Math.round(v[1]) ? f(v[0]) : f(v[0]) + " – " + f(v[1]);
        const rows = sc.rows.concat(sc.maxRow ? [sc.maxRow] : []);
        let h = '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + '<th>Scenario</th><th class="n">Marketing</th><th class="n">Jobs</th><th class="n">Revenue</th><th class="n">Gross profit after marketing</th><th>What changes</th>'
          + "</tr></thead><tbody>" + rows.map(r => "<tr><td><b>" + esc(r.name) + '</b></td><td class="n">' + kk(r.spend) + '</td><td class="n">'
            + rng(r.jobs, n0) + '</td><td class="n">' + rng(r.rev, kk) + '</td><td class="n">' + rng(r.gpa, kk) + '</td><td class="muted">' + esc(r.note) + "</td></tr>").join("")
          + "</tbody></table></div></div>";
        if (!sc.maxRow) h += '<p class="arv-note">' + (PLAN == null ? "The MAX plan row is being read from Seasonal Planning…"
          : "The MAX plan has no jobs for these zip codes.") + "</p>";
        // the recommendation: the scenario with the most gross profit after marketing even at its low end
        const keep = sc.rows[0].gpa[0];
        const best = sc.rows.slice(1).filter(r => r.gpa[0] > keep).sort((x, y) => y.gpa[0] - x.gpa[0])[0];
        h += '<div class="arv-box">' + (best
          ? "<b>Recommended: " + esc(best.name) + ".</b> Even at the low end it adds " + kk(best.gpa[0] - keep) + " of gross profit after marketing "
            + "against keeping things as they are (" + kk(best.gpa[0]) + " – " + kk(best.gpa[1]) + " a year). " + (sc.worst ? esc(sc.worst) + " is the paid source "
            + "with the most spend per job here this year." : "")
          : "<b>Recommended: keep as it is.</b> Moving " + (sc.worst ? esc(sc.worst) + "'s " : "the ") + "money is not expected to earn more than it does now.")
          + " Figures grow this year's to a full year by last year's ratio for " + esc(ST_NAME[S.st]) + " (×" + sc.FULL.toFixed(2) + "); revenue and gross profit use "
          + "this year's average job (" + usd(sc.avgRev) + ") and gross profit per job (" + usd(sc.avgGp) + ")."
          + "</div>";
        el.innerHTML = h;
      }

      function wire(a) {
        host.querySelectorAll("[data-arvst]").forEach(b => { b.onclick = () => { S.st = b.dataset.arvst;
          S.area = S.st === "NY" ? "nyc" : "all"; S.sub = -1; paint(); }; });
        host.querySelectorAll("[data-arvarea]").forEach(b => { b.onclick = () => { S.area = b.dataset.arvarea; S.sub = -1; paint(); }; });
        host.querySelectorAll("[data-arvsub]").forEach(b => { b.onclick = () => { const i = +b.dataset.arvsub;
          S.sub = S.sub === i && i >= 0 ? -1 : i; paint(); }; });
      }

      /* ONE MAP, CLICK TO ZOOM (his pick): the area's zips filled by this year's jobs, the busiest labelled */
      function ensureLeaflet(cb) {
        if (window.L && window.L.map) { cb(); return; }
        if (!document.getElementById("ldLeafCss")) {
          const lc = document.createElement("link"); lc.id = "ldLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
          document.head.appendChild(lc);
        }
        let sc = document.getElementById("ldLeafJs");
        if (sc) { if (window.L && window.L.map) cb(); else sc.addEventListener("load", () => cb()); return; }
        sc = document.createElement("script"); sc.id = "ldLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js"; sc.onload = () => cb();
        document.head.appendChild(sc);
      }
      const ZG = window.__ARV_ZG || (window.__ARV_ZG = {});
      const RAMP = ["#D7E9DC", "#AFD3B9", "#7FB890", "#4F9A69", "#2F7D4A", "#1B5232"];
      const EMPTY = dark => dark ? "#2b3036" : "#FFFFFF";
      function drawMap(a, R) {
        const box = host.querySelector("#arvMap"); if (!box) return;
        const st = S.st;
        ensureLeaflet(() => {
          const one = ZG[st] ? Promise.resolve(ZG[st]) : fetch("assets/vendor/geo/zips-" + st + ".json").then(r => r.json()).then(j => (ZG[st] = j));
          one.then(gj => {
            if (!alive() || !document.body.contains(box)) return;
            const m = L.map(box, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
            MAP = m;
            const dark = !document.body.classList.contains("light");
            const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_" + (dark ? "Dark" : "Light") + "_Gray_";
            L.tileLayer(ESRI + "Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 14 }).addTo(m);
            // this year's jobs per zip, in the area
            const per = {};
            M.jobs.forEach(j => { if (j.y !== "cur" || j.st !== st) return; if (!a.subs.some(s => subMatch(s, j.county))) return;
              const o = per[j.z] = per[j.z] || { n: 0, rev: 0, p: 0 }; o.n++; o.rev += j.rev; });
            M.jobs.forEach(j => { if (j.y === "prev" && per[j.z]) per[j.z].p++; });
            const max = Math.max(1, ...Object.values(per).map(o => o.n));
            const step = n => n <= 0 ? -1 : Math.min(RAMP.length - 1, Math.floor((Math.log(n) / Math.log(max + 1)) * RAMP.length));
            const subOf = z => { const g = M.ZIP[z]; if (!g || g.st !== st) return -1; return a.subs.findIndex(s => subMatch(s, g.county)); };
            const feats = (gj.features || []).filter(f => subOf(f.properties.z) >= 0);
            const layers = {};
            const lyr = L.geoJSON({ type: "FeatureCollection", features: feats }, {
              style: f => { const o = per[f.properties.z], k = o ? step(o.n) : -1;
                return k < 0 ? { color: dark ? "#59606a" : "#AEB8B1", weight: 0.5, fillColor: EMPTY(dark), fillOpacity: 0.6 }
                             : { color: "#ffffff", weight: 0.6, fillColor: RAMP[k], fillOpacity: 0.9 }; },
              onEachFeature: (f, l) => {
                const z = f.properties.z, o = per[z], i = subOf(z);
                (layers[i] = layers[i] || []).push(l);
                l.bindTooltip("<b>" + esc(z) + "</b> · " + esc(a.subs[i][1]) + "<br>" + (o ? n0(o.n) + " jobs this year" + (o.p ? " (last year " + n0(o.p) + ")" : "")
                  + " · " + kk(o.rev) : "no jobs this year"), { sticky: true });
                l.on("click", () => { S.sub = S.sub === i ? -1 : i; paint(); });
              } }).addTo(m);
            // each borough or county drawn round in a firm line, so "click a borough" has something to click
            const cf = ((M.counties && M.counties.features) || []).filter(f => f.properties && f.properties.st === st
              && a.subs.some(s => subMatch(s, f.properties.name)));
            if (cf.length) L.geoJSON({ type: "FeatureCollection", features: cf }, { interactive: false,
              style: f => ({ color: dark ? "#cfd8d2" : "#1B5232", weight: S.sub >= 0 && subMatch(a.subs[S.sub], f.properties.name) ? 2.6 : 1.4,
                             fill: false, opacity: 0.85 }) }).addTo(m);
            const focus = S.sub >= 0 && layers[S.sub] ? L.featureGroup(layers[S.sub]) : lyr;
            try { m.fitBounds(focus.getBounds(), { padding: [16, 16] }); } catch (e) { m.setView([40.7, -74], 9); }
            // the busiest zips get a label, "zip · jobs", skipping one that would sit on a label already placed
            const inFocus = z => S.sub < 0 || subOf(z) === S.sub;
            const ranked = Object.keys(per).filter(inFocus).sort((x, y) => per[y].n - per[x].n);
            const placed = [];
            ranked.some(z => { const g = M.ZIP[z]; if (!g || !g.la) return false;
              const pt = m.latLngToContainerPoint([g.la, g.lo]);
              if (placed.some(q => Math.abs(q.x - pt.x) < 64 && Math.abs(q.y - pt.y) < 20)) return false;
              placed.push(pt);
              L.marker([g.la, g.lo], { interactive: false, icon: L.divIcon({ className: "arv-zl", html: "<span>" + esc(z) + " · " + n0(per[z].n) + "</span>", iconSize: [0, 0] }) }).addTo(m);
              return placed.length >= 12; });
            const lg = host.querySelector("#arvLegend");
            if (lg) lg.innerHTML = "Jobs per zip this year: " + RAMP.map((c, k) => {
              const lo = Math.ceil(Math.pow(max + 1, k / RAMP.length)), hi = Math.floor(Math.pow(max + 1, (k + 1) / RAMP.length) - 0.0001);
              return '<span><i style="background:' + c + '"></i>' + (hi > lo ? lo + "–" + hi : lo) + "</span>"; }).join("")
              + '<span><i style="background:' + EMPTY(dark) + ';border:1px solid #AEB8B1"></i>none</span>';
          }).catch(() => { box.innerHTML = '<div class="panel">The zip shapes could not be read.</div>'; });
        });
      }
    },
  });

  // exposed for the tests: the model and the scenario rules, pure
  window.__ARV_MODEL = { buildModel, measure, scenarios, leadCost, areasOf, NY_AREAS, verdict };
})();
