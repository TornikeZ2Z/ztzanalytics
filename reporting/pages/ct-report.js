/* BRANCH REPORTS page: CT Branch Report (report id ct-report; tracker ZTZ-44, 15 Nov 2026; redesign ZP-10, 18 Nov 2026).
   Tornike, 9 Nov: a CT version of the Monthly Report for the CT branch owner -- a general overview including what we
   spend; profit and margin are "a little risky for now". His picks on 15 Nov: spend + activity, no profit.
   ZP-10 (18 Nov): "its design is super ugly. can you make it similar to what we have in monthly report?" -- his pick
   "look + more CT sections" from the mockup: the Monthly Report's frame (numbered chapters, collapsible sections,
   tiles with year-on-year and month-on-month chips and 12-month bars, a plain summary, what changed most) plus the
   lead funnel, what happened to the leads, reps' booking rate in CT, local vs long distance and postcards.
   DATA PATH: everything through /api/_ct (bridge/ct_report.py) -- no RS.load, no dataset. The report id maps to no
   tables, so whoever holds only this page reads CT's numbers and nothing else: no other state, no profit.
   ZP-15 (19 Nov 2026): "i dont like the big white gaps between graphs ... imagine yourself as Giorgi ... split morning
   and afternoon jobs and give some analysis on that too ... claims and stuff like this here too - so he can get an
   understanding on problematic jobs he had". Two new chapters, Crews (morning vs afternoon jobs; an afternoon job is
   chained after another job that day) and Problem jobs (claims, late arrivals, refunds, bad reviews). His picks: the
   problem-job lines name the customer, a per-foreman table, refund dollars. The gaps: short cards stack beside long
   ones, tables are tighter, long lists show 8 rows with "Show all". */
(() => {
  const esc = s => RSC.esc(s == null ? "" : String(s));
  // module-level: a re-render keeps the picks. ZP-19: `from` = the period's first month ("" = the same as `month`)
  const S = { data: null, err: "", month: "", from: "", shut: new Set(), all: new Set() };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mShort = k => MON[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
  const mLong = k => MONL[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
  const addM = (k, n) => { const i = +k.slice(0, 4) * 12 + +k.slice(5, 7) - 1 + n; return Math.floor(i / 12) + "-" + String(i % 12 + 1).padStart(2, "0"); };
  const mDiff = (a, b) => (+b.slice(0, 4) - +a.slice(0, 4)) * 12 + (+b.slice(5, 7) - +a.slice(5, 7));
  /* ZP-19: a period's name -- "April 2026", "Jan – Apr 2026", or "Nov 2025 – Feb 2026" across a year */
  const pShort = (a, b) => a === b ? mShort(a) : (a.slice(0, 4) === b.slice(0, 4) ? MON[+a.slice(5, 7) - 1] : mShort(a)) + " – " + mShort(b);
  const pLong = (a, b) => a === b ? mLong(a) : (a.slice(0, 4) === b.slice(0, 4) ? MONL[+a.slice(5, 7) - 1] : mLong(a)) + " – " + mLong(b);
  const nyMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 7);
  const money = v => (v < 0 ? "-$" : "$") + Math.abs(Math.round(+v || 0)).toLocaleString("en-US");
  const money2 = v => "$" + (+v || 0).toFixed(2);
  const fmtN = v => RS.fmtN(+v || 0);
  const pct = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
  const day = v => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? MON[+s.slice(5, 7) - 1] + " " + +s.slice(8, 10) : "—"; };
  // RS.bookingRate's rule: booked / qualified, more booked than qualified caps at 100%, nothing at all is blank
  const rate = (b, q) => b > q ? 1 : (!q && !b ? null : (q ? b / q : 0));
  const sum = (rs, c) => rs.reduce((a, r) => a + (+r[c] || 0), 0);
  /* ZP-8's outcome groups (analytics/pages/source-report.js keeps the same patterns; a test holds them equal) */
  const OUTCOME_INVALID = /out of service area|duplicate|copy lead|invalid phone|invalid email|wrong number|truck rental|low quality|not moving|change of plans|spam|test lead/i;
  const OUTCOME_LOST = /booked with others|already hired a mover|exceeded their budget|over budget|too expensive|not interested|small job|rate was given|no respond|no response|left a voicemail|mailbox is full/i;
  const OUTCOME_OPEN_STATUS = /^(not confirmed|pending|date pending|to call back)$/i;
  const OUTCOME_ORDER = ["Booked", "Lost", "Invalid", "Still open", "No reason recorded"];
  const outcomeOf = r => r.cat === "Confirmed" ? "Booked" : OUTCOME_INVALID.test(r.flag || "") ? "Invalid"
    : OUTCOME_LOST.test(r.flag || "") ? "Lost" : r.cat === "Incoming Lead" && OUTCOME_OPEN_STATUS.test(String(r.st || "").trim()) ? "Still open"
    : "No reason recorded";
  const CHAPTERS = [["01", "Summary", "the month at a glance"], ["02", "Crews", "morning and afternoon jobs"],
                    ["03", "Problem jobs", "claims, late arrivals, refunds and bad reviews"], ["04", "Leads and sales", "how leads came in and booked"],
                    ["05", "Jobs and revenue", "the jobs done and what they billed"], ["06", "Marketing", "what we spend and what it returns"],
                    ["07", "Outlook", "this month and next, as booked"]];
  const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const charts = [];

  function pal() {
    const cs = getComputedStyle(document.body);
    const v = (n, fb) => (cs.getPropertyValue(n) || "").trim() || fb;
    return { brand: v("--brand", "#b7e23b"), ink: v("--ink", "#0e1621"), muted: v("--muted", "#5a6775"),
             line: v("--line", "#e4e9f0"), faint: v("--faint", "#93a0b2"), blue: v("--blue", "#5b8cff") };
  }
  function injectStyle() {
    const old = document.getElementById("ctr-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "ctr-style";
    st.textContent = `
      .ctr-wrap{max-width:none}
      .ctr-cover{display:flex;justify-content:space-between;align-items:flex-end;gap:14px;flex-wrap:wrap;margin:6px 0 12px}
      .ctr-cover h2{font-size:24px;font-weight:700;margin:0;color:var(--ink)}
      .ctr-cover .ctr-sub{font-size:13px;color:var(--muted);margin-top:2px}
      .ctr-step{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
      .ctr-nav{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px;position:sticky;top:0;z-index:2;padding:8px 0;background:var(--bg)}
      .ctr-nav a{display:inline-flex;gap:6px;align-items:center;padding:5px 12px;border:1px solid var(--line);border-radius:999px;
        color:var(--ink);text-decoration:none;font-size:13px;font-weight:600;background:var(--panel)}
      .ctr-nav a b{font-variant-numeric:tabular-nums;color:var(--muted)}
      .ctr-sec{margin:18px 0 8px}
      .ctr-sh{display:flex;align-items:center;gap:10px;cursor:pointer;user-select:none;padding:8px 0;border-bottom:1px solid var(--line)}
      .ctr-num{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:24px;border-radius:7px;
        background:var(--ink);color:var(--brand);font-weight:800;font-size:12px;font-variant-numeric:tabular-nums}
      .ctr-sh h3{font-size:17px;margin:0;color:var(--ink)}
      .ctr-sh .ctr-st{font-size:13px;color:var(--muted)}
      .ctr-sh .ctr-chev{margin-left:auto;color:var(--muted);font-size:13px}
      .ctr-sec.shut .ctr-body{display:none}
      .ctr-body{padding-top:12px}
      .ctr-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
      .ctr-tile{border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--panel);min-width:0}
      .ctr-tile.ctr-hero{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 9%,var(--panel))}
      .ctr-tile .k{font-size:13px;color:var(--muted)}
      .ctr-tile .v{font-size:26px;font-weight:700;margin-top:2px;font-variant-numeric:tabular-nums;color:var(--ink)}
      .ctr-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
      .ctr-chip{font-size:12px;font-weight:700;border-radius:999px;padding:2px 8px;white-space:nowrap}
      .ctr-chip.up{color:var(--pos);background:color-mix(in srgb,var(--pos) 13%,transparent)}
      .ctr-chip.dn{color:var(--neg);background:color-mix(in srgb,var(--neg) 13%,transparent)}
      .ctr-chip.fl{color:var(--muted);background:var(--panel-2)}
      .ctr-spark{height:34px;margin-top:8px}
      .ctr-say{border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:0;padding:12px 14px;margin-top:12px;
        font-size:14px;line-height:1.6;color:var(--ink);background:var(--panel)}
      .ctr-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
      .ctr-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--panel);min-width:0}
      .ctr-card h4{font-size:15px;margin:0 0 2px;color:var(--ink)}
      .ctr-card .ctr-cs{font-size:13px;color:var(--muted);margin-bottom:10px}
      .ctr-move{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}
      .ctr-move:last-child{border-bottom:0}
      .ctr-up{color:var(--pos);font-weight:600}.ctr-dn{color:var(--neg);font-weight:600}
      .ctr-fun{display:grid;gap:8px}
      .ctr-fr{display:grid;grid-template-columns:120px minmax(0,1fr) 110px;gap:10px;align-items:center;font-size:14px}
      .ctr-fb{height:22px;border-radius:6px;background:var(--brand)}
      .ctr-fr .n{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
      .ctr-fr .n .ctr-subt{display:block;font-size:12px;color:var(--muted);font-weight:400}
      .ctr-chart{height:260px}
      .ctr-note{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:8px}
      .rs-table tr.ctr-on td{background:color-mix(in srgb,var(--brand) 12%,transparent);font-weight:600}
      .rs-table tr.ctr-tot td{font-weight:700;border-top:2px solid var(--line)}
      .rs-table tr.ctr-og td{font-weight:700;border-top:1px solid var(--line)}
      .rs-table td.ctr-ofl{padding-left:22px;color:var(--muted)}
      .rs-table td .ctr-subt{display:block;font-size:12px;color:var(--muted);font-weight:400}
      .ctr-out{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
      .ctr-oc{border:1px solid var(--line);border-radius:12px;padding:14px 16px;background:var(--panel)}
      .ctr-oc .k{font-size:13px;color:var(--muted)}
      .ctr-oc .v{font-size:26px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}
      .ctr-oc .s{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.5}
      .ctr-oc .s b{color:var(--ink)}
      .ctr-stack{display:grid;gap:14px;align-content:start;min-width:0}
      .ctr-wide{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px;align-items:start}
      .ctr-tight td{padding:8px 10px}
      .ctr-tight th{padding:9px 10px}
      .ctr-more{margin-top:8px;font-size:12.5px;font-weight:700;color:var(--blue);background:none;border:0;padding:0;cursor:pointer}
      .ctr-tags{display:flex;flex-wrap:wrap;gap:4px}
      .ctr-tag{font-size:12px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap;background:var(--panel-2);color:var(--ink)}
      .ctr-tag.cl{color:var(--neg);background:color-mix(in srgb,var(--neg) 12%,transparent)}
      .ctr-tag.lt{color:#b45309;background:rgba(217,119,6,.13)}
      .ctr-tag.rf{color:#7c3aed;background:rgba(124,58,237,.11)}
      .ctr-tag.nr{color:#be185d;background:rgba(190,24,93,.10)}
      .ctr-list{margin:0;padding-left:18px;font-size:14px;line-height:1.6;color:var(--ink)}
      .ctr-list li{margin:3px 0}
      @media(max-width:1100px){.ctr-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:900px){.ctr-two,.ctr-out,.ctr-wide{grid-template-columns:1fr}.ctr-fr{grid-template-columns:90px minmax(0,1fr) 90px}}
      @media print{.ctr-nav,.ctr-step{display:none}.ctr-sec.shut .ctr-body{display:block}}`;
    document.head.appendChild(st);
  }

  /* ---------- the month's numbers, from the endpoint's rows ---------- */
  function monthOf(k) { return periodOf(k, k); }
  function periodOf(a, b) {
    const d = S.data, inR = r => r.mo >= a && r.mo <= b;
    const L = d.leads.filter(inR), J = d.jobs.filter(inR), P = d.spend.filter(inR);
    const o = { k: b, k0: a, lab: pShort(a, b), leads: sum(L, "leads"), q: sum(L, "q"), b: sum(L, "b"), jobs: sum(J, "jobs"), rev: sum(J, "rev"),
                spend: sum(P, "spend"), hasSpend: P.length > 0 };
    o.rate = rate(o.b, o.q);
    o.avg = o.jobs ? o.rev / o.jobs : null;
    /* ZP-20 (Bacho, 24 Nov 2026): "add statistic for review per 100 job". Reviews that count (4-5 stars on a counted
       platform, the Review Performance rule) on the period's CT jobs, and the whole company's line to compare. */
    const JR = (d.jobrows || []).filter(inR), CO = (d.reviews_co || []).filter(inR);
    o.jn = JR.length; o.rv = sum(JR, "rv_n"); o.rvj = JR.filter(r => r.rv_n > 0).length; o.nr = sum(JR, "nr_n");
    o.coJobs = sum(CO, "jobs"); o.coRv = sum(CO, "rv");
    o.perLead = o.hasSpend && o.leads ? o.spend / o.leads : null;
    o.perJob = o.hasSpend && o.jobs ? o.spend / o.jobs : null;
    o.roas = o.hasSpend && o.spend > 0 ? o.rev / o.spend : null;
    return o;
  }
  /* ZP-15: the jobs, one row each (bridge `jobrows`): morning (ch 0), afternoon = chained after another job that day
     (ch 1), or no arrival record (ch null: long distance has no arrival window) */
  const kindOf = r => r.ch == null ? "none" : (r.ch ? "pm" : "am");
  const jobsOf = (k0, k1) => (S.data.jobrows || []).filter(r => r.mo >= k0 && r.mo <= (k1 || k0));
  const problemsOf = r => {
    const t = [];
    if (r.cl_n) t.push(["cl", "Claim" + (r.cl_n > 1 ? " ×" + r.cl_n : "") + (r.cl_reasons ? ": " + r.cl_reasons : "") + (r.cl_resp ? " (" + r.cl_resp + ")" : "")]);
    if (r.late) t.push(["lt", "Late" + (r.late_min != null ? " " + r.late_min + " min" : "")]);
    if (r.rf_n) t.push(["rf", "Refund " + money(r.rf_amt) + (r.rf_reasons ? ": " + r.rf_reasons : "")]);
    if (r.nr_n) t.push(["nr", "Bad review" + (r.nr_score != null ? " " + r.nr_score + "★" : "") + (r.nr_platform ? " on " + r.nr_platform : "")]);
    return t;
  };
  function crewStats(rows) {
    const g = { am: [], pm: [], none: [] };
    rows.forEach(r => g[kindOf(r)].push(r));
    const st = list => ({ n: list.length, bill: list.length ? sum(list, "bill") / list.length : null,
      late: list.filter(r => r.late).length, late1h: list.filter(r => r.late1h).length,
      cl: list.filter(r => r.cl_n).length, rf: list.filter(r => r.rf_n).length, nr: list.filter(r => r.nr_n).length,
      rv: sum(list, "rv_n") });
    return { am: st(g.am), pm: st(g.pm), none: st(g.none), all: st(rows) };
  }
  const pctOf = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";
  const per100 = (a, n) => n ? (100 * a / n).toFixed(1) : "—";
  const moreBtn = (key, n, cap) => n > cap ? `<button type="button" class="ctr-more" data-all="${key}">${S.all.has(key) ? "Show fewer" : "Show all " + n}</button>` : "";
  const capRows = (key, list, cap) => S.all.has(key) ? list : list.slice(0, cap);
  const tileHtml = ([l, v, sub]) => `<div class="ctr-tile"><div class="k">${esc(l)}</div><div class="v">${v}</div><div class="ctr-note" style="margin-top:4px">${esc(sub)}</div></div>`;
  /* a change chip: % for amounts, points for rates; `good` = which way is good (null = neither) */
  function chip(now, then, label, isRate, good) {
    if (now == null || then == null || (!isRate && !then)) return "";
    const d = isRate ? (now - then) * 100 : (now - then) / Math.abs(then) * 100;
    // green when the move is good, red when it is bad, grey when it is flat or neither (ad spend itself)
    const cls = Math.abs(d) < 0.05 || good == null ? "fl" : ((d > 0) === (good === true) ? "up" : "dn");
    return `<span class="ctr-chip ${cls}">${d > 0 ? "▲" : d < 0 ? "▼" : "–"} ${Math.abs(d).toFixed(isRate ? 1 : 0)}${isRate ? " pts" : "%"} ${esc(label)}</span>`;
  }
  function spark(el, vals) {
    if (!el || typeof Chart === "undefined") return;
    const C = pal(), cv = document.createElement("canvas");
    el.appendChild(cv);
    charts.push(new Chart(cv, { type: "bar", data: { labels: vals.map((_, i) => i), datasets: [{ data: vals.map(v => v == null ? 0 : v),
      backgroundColor: vals.map((_, i) => i === vals.length - 1 ? C.brand : C.line), borderRadius: 2, maxBarThickness: 8 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { enabled: false } },
                 scales: { x: { display: false }, y: { display: false, beginAtZero: true } } } }));
  }
  function secHtml(i, inner) {
    const [n, t, s] = CHAPTERS[i];
    return `<section class="ctr-sec${S.shut.has(n) ? " shut" : ""}" id="ctr-s${n}"><div class="ctr-sh" data-sec="${n}" role="button" tabindex="0" aria-expanded="${!S.shut.has(n)}">
      <span class="ctr-num">${n}</span><h3>${esc(t)}</h3><span class="ctr-st">${esc(s)}</span><span class="ctr-chev">${S.shut.has(n) ? "Show ▸" : "Hide ▾"}</span></div>
      <div class="ctr-body">${inner}</div></section>`;
  }

  function render(host) {
    charts.splice(0).forEach(c => { try { c.destroy(); } catch (e) { /* gone */ } });
    const d = S.data;
    const cur = nyMonth();
    const months = [];
    for (let k = d.first; k <= cur; k = addM(k, 1)) months.push(k);
    if (!S.month || months.indexOf(S.month) < 0) S.month = months.length > 1 ? months[months.length - 2] : months[0];
    if (S.from && (months.indexOf(S.from) < 0 || S.from >= S.month)) S.from = "";
    /* ZP-19 (Bacho, 23 Nov 2026): "we need to have filter to merge few months". The report covers From..To (k0..k):
       every figure sums those months, and the chips compare with the same months a year earlier and with as many
       months just before. One month (From = To, the default) reads exactly as before. The 12-month tables and bars
       stay monthly, with the picked months highlighted. */
    const k = S.month, k0 = S.from || k, n = mDiff(k0, k) + 1, one = n === 1, inP = mo => mo >= k0 && mo <= k;
    const running = k === cur, ly0 = addM(k0, -12), ly = addM(k, -12), pm0 = addM(k0, -n), pm = addM(k, -n);
    const M = periodOf(k0, k), LY = periodOf(ly0, ly), PM = periodOf(pm0, pm);
    const hasLY = ly0 >= d.first, hasPM = pm0 >= d.first;
    const lab = pLong(k0, k), lyLab = pShort(ly0, ly), pmLab = pShort(pm0, pm);
    const vsPM = one ? "vs last month" : "vs the " + n + " months before", thatP = one ? "that month" : "in those months";
    const hl = one ? "the picked month is highlighted" : "the picked months are highlighted";
    const last12 = months.filter(x => x <= k).slice(-12).map(monthOf);
    const asOf = `Moveboard to ${day(d.as_of.moveboard)} · closings to ${day(d.as_of.closings)}`;

    // ZP-15: this month's jobs and the last 12 months', for the summary's brief and chapters 02-03
    const k12 = months.filter(x => x <= k).slice(-12);
    const monthJobs = jobsOf(k0, k), yrJobs = jobsOf(k12[0], k);
    const CM = crewStats(monthJobs), CY = crewStats(yrJobs);
    const rfMonth = sum(monthJobs.filter(r => r.rf_n), "rf_amt");

    /* 01 SUMMARY: eight tiles, each against last year and last month, with its last 12 months */
    const TILES = [
      { id: "rev", l: "Revenue", v: money(M.rev), f: o => o.rev, good: true, hero: true },
      { id: "jobs", l: "Jobs done", v: fmtN(M.jobs), f: o => o.jobs, good: true },
      { id: "leads", l: "Leads", v: fmtN(M.leads), f: o => o.leads, good: true },
      { id: "rate", l: "Booking rate", v: pct(M.rate), f: o => o.rate, good: true, isRate: true },
      { id: "avg", l: "Average job", v: M.avg != null ? money(M.avg) : "—", f: o => o.avg, good: true },
      { id: "spend", l: "Ad spend in CT", v: M.hasSpend ? money(M.spend) : "—", f: o => o.hasSpend ? o.spend : null, good: null },
      { id: "perjob", l: "Ad spend per job", v: M.perJob != null ? money(M.perJob) : "—", f: o => o.perJob, good: false },
      { id: "roas", l: "Revenue per $1 of ads", v: M.roas != null ? money2(M.roas) : "—", f: o => o.roas, good: true },
    ];
    // ZP-20: a second row, reviews. Per 100 jobs is held as a share, so its chip's points are "per 100 jobs"
    const p100 = (t, html) => t.p100 ? html.replace(" pts ", " per 100 ") : html;
    const TILES2 = [
      { id: "rv100", l: "Reviews per 100 jobs", v: M.jn ? per100(M.rv, M.jn) : "—", f: o => o.jn ? o.rv / o.jn : null, good: true, isRate: true, p100: true,
        extra: M.coJobs ? `whole company ${per100(M.coRv, M.coJobs)}` : "" },
      { id: "rvn", l: "Reviews that count", v: fmtN(M.rv), f: o => o.rv, good: true, extra: `on ${fmtN(M.jn)} jobs` },
      { id: "rvj", l: "Jobs with a review", v: M.jn ? pctOf(M.rvj, M.jn) : "—", f: o => o.jn ? o.rvj / o.jn : null, good: true, isRate: true },
      { id: "nr100", l: "Bad reviews per 100 jobs", v: M.jn ? per100(M.nr, M.jn) : "—", f: o => o.jn ? o.nr / o.jn : null, good: false, isRate: true, p100: true },
    ];
    const tiles = `<div class="ctr-tiles">` + TILES.map(t => `<div class="ctr-tile${t.hero ? " ctr-hero" : ""}"><div class="k">${esc(t.l)}</div>
      <div class="v">${t.v}</div><div class="ctr-chips">${hasLY && !running ? chip(t.f(M), t.f(LY), "vs last year", t.isRate, t.good) : ""}${hasPM ? chip(t.f(M), t.f(PM), vsPM, t.isRate, t.good) : ""}</div>
      <div class="ctr-spark" data-spark="${t.id}"></div></div>`).join("") + `</div>`
      + `<div class="ctr-tiles" style="margin-top:12px">` + TILES2.map(t => `<div class="ctr-tile"><div class="k">${esc(t.l)}</div>
      <div class="v">${t.v}</div><div class="ctr-chips">${hasLY && !running ? p100(t, chip(t.f(M), t.f(LY), "vs last year", t.isRate, t.good)) : ""}${hasPM ? p100(t, chip(t.f(M), t.f(PM), vsPM, t.isRate, t.good)) : ""}</div>
      ${t.extra ? `<div class="ctr-note">${esc(t.extra)}</div>` : ""}<div class="ctr-spark" data-spark="${t.id}"></div></div>`).join("") + `</div>`;
    const better = TILES.filter(t => t.good === true && hasLY && t.f(M) != null && t.f(LY) != null && t.f(M) > t.f(LY)).length;
    const counted = TILES.filter(t => t.good === true && hasLY && t.f(M) != null && t.f(LY) != null).length;
    const say = `${running ? "So far in" : "In"} ${esc(lab)}, CT had <b>${fmtN(M.leads)}</b> leads and booked <b>${fmtN(M.b)}</b> (${pct(M.rate)} of qualified),
      did <b>${fmtN(M.jobs)}</b> jobs for <b>${money(M.rev)}</b>${M.hasSpend ? `, and we spent <b>${money(M.spend)}</b> on ads placed in CT` : ""}.`
      + (M.jn ? ` The jobs earned <b>${fmtN(M.rv)}</b> reviews that count: <b>${per100(M.rv, M.jn)}</b> per 100 jobs${M.coJobs ? ` (the whole company ${per100(M.coRv, M.coJobs)})` : ""}.` : "")
      + (counted && !running ? ` ${better} of ${counted} headline numbers are better than ${esc(lyLab)}.` : "");
    // what changed most vs the month before: the biggest moves by source, in revenue and in leads
    const bySrc = (rows, key, a, b) => { const g = {}; rows.filter(r => r.mo >= a && r.mo <= b).forEach(r => { g[r.src] = (g[r.src] || 0) + (+r[key] || 0); }); return g; };
    const moves = [];
    if (hasPM) {
      const rn = bySrc(d.jobs, "rev", k0, k), rp = bySrc(d.jobs, "rev", pm0, pm), ln = bySrc(d.leads, "leads", k0, k), lp = bySrc(d.leads, "leads", pm0, pm);
      new Set([...Object.keys(rn), ...Object.keys(rp)]).forEach(s => { const dv = (rn[s] || 0) - (rp[s] || 0); if (Math.abs(dv) >= 500) moves.push({ w: Math.abs(dv), up: dv > 0, t: `${s} revenue ${dv > 0 ? "rose" : "fell"} ${money(Math.abs(dv))} (now ${money(rn[s] || 0)})` }); });
      new Set([...Object.keys(ln), ...Object.keys(lp)]).forEach(s => { const dv = (ln[s] || 0) - (lp[s] || 0); if (Math.abs(dv) >= 5) moves.push({ w: Math.abs(dv) * 150, up: dv > 0, t: `${s} leads ${dv > 0 ? "up" : "down"} ${Math.abs(dv)} (now ${ln[s] || 0})` }); });
      if (M.rate != null && PM.rate != null && Math.abs(M.rate - PM.rate) >= 0.02) moves.push({ w: 1e9, up: M.rate > PM.rate, t: `Booking rate moved ${(M.rate - PM.rate > 0 ? "+" : "")}${((M.rate - PM.rate) * 100).toFixed(1)} pts to ${pct(M.rate)}` });
    }
    const movers = moves.sort((a, b) => b.w - a.w).slice(0, 5);
    const moversHtml = `<div class="ctr-card"><h4>What changed most</h4><div class="ctr-cs">${hasPM ? "vs " + esc(pmLab) + " · the biggest moves" : one ? "no month before to compare" : "no period before to compare"}</div>`
      + (movers.length ? movers.map(m => `<div class="ctr-move"><span class="${m.up ? "ctr-up" : "ctr-dn"}">${m.up ? "▲" : "▼"} ${esc(m.t)}</span></div>`).join("")
        : '<div class="ctr-note">No big moves.</div>') + `</div>`;
    const glanceCols = [M, hasLY ? LY : null, hasPM ? PM : null].filter(Boolean);
    const gl = (label, f, sub) => `<tr><td>${label}${sub ? `<span class="ctr-subt">${sub}</span>` : ""}</td>` + glanceCols.map(c => `<td class="num">${f(c)}</td>`).join("") + "</tr>";
    const glance = `<div class="ctr-card"><h4>${esc(pShort(k0, k))} against ${hasLY ? esc(lyLab) + " and " : ""}${esc(pmLab)}</h4><div class="ctr-cs">every line, side by side</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th></th>` + glanceCols.map((c, i) => `<th class="num">${esc(c.lab)}${i === 0 ? (running ? " (so far)" : "") : ""}</th>`).join("") + `</tr></thead><tbody>`
      + gl("Leads", c => fmtN(c.leads)) + gl("Booked", c => fmtN(c.b)) + gl("Booking rate", c => pct(c.rate), "booked ÷ leads without bad leads")
      + gl("Jobs done", c => fmtN(c.jobs)) + gl("Revenue", c => money(c.rev)) + gl("Average job", c => c.avg != null ? money(c.avg) : "—")
      + gl("Ad spend placed in CT", c => c.hasSpend ? money(c.spend) : "—") + gl("Ad spend per lead", c => c.perLead != null ? money(c.perLead) : "—")
      + gl("Ad spend per job done", c => c.perJob != null ? money(c.perJob) : "—")
      + gl("Reviews per 100 jobs", c => c.jn ? per100(c.rv, c.jn) : "—", "reviews that count")
      + gl("Bad reviews per 100 jobs", c => c.jn ? per100(c.nr, c.jn) : "—") + `</tbody></table></div></div>`;
    const briefHtml = `<div class="ctr-card"><h4>Crews and problems</h4><div class="ctr-cs">${esc(lab)} · the detail is in 02 and 03</div>
      <div class="ctr-move"><span>Morning jobs / afternoon jobs</span><b>${fmtN(CM.am.n)} / ${fmtN(CM.pm.n)}</b></div>
      <div class="ctr-move"><span>Late arrivals (over an hour)</span><b>${fmtN(CM.all.late)} (${fmtN(CM.all.late1h)})</b></div>
      <div class="ctr-move"><span>Jobs with a claim</span><b>${fmtN(CM.all.cl)}</b></div>
      <div class="ctr-move"><span>Refunds · bad reviews</span><b>${money(rfMonth)} · ${fmtN(CM.all.nr)}</b></div></div>`;
    const s01 = secHtml(0, tiles + `<div class="ctr-say">${say}</div><div class="ctr-two" style="margin-top:14px"><div class="ctr-stack">${moversHtml}${briefHtml}</div>${glance}</div>`);

    /* 02 CREWS (ZP-15): morning and afternoon jobs, and what each looks like */
    const withArr = CM.am.n + CM.pm.n;
    const onTime = st => st.n ? Math.round(100 * (st.n - st.late) / st.n) + "%" : "—";
    const crewTiles = `<div class="ctr-tiles">` + [
      ["Morning jobs", fmtN(CM.am.n), withArr ? pctOf(CM.am.n, withArr) + " of the jobs with an arrival record" : "no arrival records " + (one ? "this month" : "in these months")],
      ["Afternoon jobs", fmtN(CM.pm.n), "chained after another job that day"],
      ["On time, morning", onTime(CM.am), fmtN(CM.am.late) + " late · " + fmtN(CM.am.late1h) + " over an hour"],
      ["On time, afternoon", onTime(CM.pm), fmtN(CM.pm.late) + " late · " + fmtN(CM.pm.late1h) + " over an hour"]].map(tileHtml).join("") + `</div>`;
    const crewByMonth = `<div class="ctr-card"><h4>Morning and afternoon jobs by month</h4><div class="ctr-cs">the last 12 months · ${hl}</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Month</th><th class="num">Morning</th><th class="num">Afternoon</th><th class="num">Afternoon share</th>`
      + `<th class="num">No arrival record</th><th class="num">Late, morning</th><th class="num">Late, afternoon</th></tr></thead><tbody>`
      + k12.map(mo => { const c = crewStats(jobsOf(mo)); return `<tr${inP(mo) ? ' class="ctr-on"' : ""}><td class="nowrap">${esc(mShort(mo))}</td><td class="num">${fmtN(c.am.n)}</td>`
        + `<td class="num">${fmtN(c.pm.n)}</td><td class="num">${pctOf(c.pm.n, c.am.n + c.pm.n)}</td><td class="num">${fmtN(c.none.n)}</td>`
        + `<td class="num">${pctOf(c.am.late, c.am.n)}</td><td class="num">${pctOf(c.pm.late, c.pm.n)}</td></tr>`; }).join("") + `</tbody></table></div></div>`;
    const cmpRow = (l, f) => `<tr><td>${l}</td><td class="num">${f(CY.am)}</td><td class="num">${f(CY.pm)}</td><td class="num">${f(CY.none)}</td></tr>`;
    const says = [];
    if (CY.am.n + CY.pm.n) says.push(`Afternoon jobs are <b>${pctOf(CY.pm.n, CY.am.n + CY.pm.n)}</b> of CT's jobs with an arrival record (${fmtN(CY.pm.n)} of ${fmtN(CY.am.n + CY.pm.n)}).`);
    if (CY.am.bill && CY.pm.bill) says.push(`An afternoon job bills <b>${money(CY.pm.bill)}</b> on average, a morning job ${money(CY.am.bill)}${CY.pm.bill < CY.am.bill ? ": the afternoon slot gets the smaller moves" : ""}.`);
    if (CY.am.n && CY.pm.n) says.push(`Late arrivals: ${pctOf(CY.am.late, CY.am.n)} of morning jobs, ${pctOf(CY.pm.late, CY.pm.n)} of afternoon jobs.`);
    if (CY.am.n) says.push(`Claims: ${per100(CY.am.cl, CY.am.n)} per 100 morning jobs, ${per100(CY.pm.cl, CY.pm.n)} per 100 afternoon jobs and ${per100(CY.none.cl, CY.none.n)} per 100 long-distance and unlogged jobs.`);
    const crewSay = `<div class="ctr-card"><h4>What it says</h4><div class="ctr-cs">${esc(mShort(k12[0]))} – ${esc(mShort(k))}</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th></th><th class="num">Morning</th><th class="num">Afternoon</th><th class="num">No arrival record</th></tr></thead><tbody>`
      + cmpRow("Jobs", x => fmtN(x.n)) + cmpRow("Average bill", x => x.bill != null ? money(x.bill) : "—") + cmpRow("Late", x => pctOf(x.late, x.n))
      + cmpRow("Late over an hour", x => pctOf(x.late1h, x.n)) + cmpRow("Reviews per 100 jobs", x => per100(x.rv, x.n))
      + cmpRow("Claims per 100 jobs", x => per100(x.cl, x.n)) + cmpRow("Refunds per 100 jobs", x => per100(x.rf, x.n))
      + `</tbody></table></div><ul class="ctr-list" style="margin-top:10px">${says.map(x => `<li>${x}</li>`).join("")}</ul>
      <div class="ctr-note">An afternoon job is chained after another job the same day (the calendar's After Job Code). Long-distance jobs have no arrival window, so they sit under "no arrival record", with the few local jobs whose arrival wasn't logged.</div></div>`;
    const wd = WD.map(() => ({ n: 0, pm: 0 }));
    yrJobs.forEach(r => { const w = new Date(String(r.d).slice(0, 10) + "T12:00:00").getDay(); if (!isNaN(w)) { wd[w].n++; if (r.ch === 1) wd[w].pm++; } });
    const wdHtml = `<div class="ctr-card"><h4>Jobs by weekday</h4><div class="ctr-cs">the last 12 months · how many were afternoon jobs</div><div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Day</th><th class="num">Jobs</th><th class="num">Afternoon</th><th class="num">Share of the jobs</th></tr></thead><tbody>`
      + [1, 2, 3, 4, 5, 6, 0].map(w => `<tr><td>${WD[w]}</td><td class="num">${fmtN(wd[w].n)}</td><td class="num">${fmtN(wd[w].pm)}</td><td class="num">${pctOf(wd[w].n, yrJobs.length)}</td></tr>`).join("") + `</tbody></table></div></div>`;
    const s02 = secHtml(1, crewTiles + `<div class="ctr-two" style="margin-top:14px">${crewByMonth}<div class="ctr-stack">${crewSay}${wdHtml}</div></div>`);

    /* 03 PROBLEM JOBS (ZP-15): claims, late arrivals, refunds and bad reviews -- by job, by foreman, by reason */
    const probs = monthJobs.filter(r => problemsOf(r).length);
    const probTiles = `<div class="ctr-tiles">` + [
      ["Problem jobs", fmtN(probs.length), pctOf(probs.length, monthJobs.length) + " of " + fmtN(monthJobs.length) + " jobs"],
      ["Claims", fmtN(sum(monthJobs, "cl_n")), fmtN(CM.all.cl) + " jobs with a claim"],
      ["Late over an hour", fmtN(CM.all.late1h), fmtN(CM.all.late) + " late arrivals in all"],
      ["Refunds", money(rfMonth), fmtN(sum(monthJobs, "rf_n")) + " refunds · " + fmtN(sum(monthJobs, "nr_n")) + " bad reviews"]].map(tileHtml).join("") + `</div>`;
    const probList = `<div class="ctr-card"><h4>${one ? "The month's problem jobs" : "Problem jobs"}</h4><div class="ctr-cs">${esc(lab)} · ${fmtN(probs.length)} of ${fmtN(monthJobs.length)} jobs had a claim, a late arrival, a refund or a bad review</div>`
      + (!probs.length ? '<div class="ctr-note">No problem jobs ' + (one ? "this month" : "in these months") + '.</div>' : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Date</th><th>Request #</th><th>Customer</th><th>Foreman</th><th>Job</th><th>What went wrong</th><th class="num">Bill</th></tr></thead><tbody>`
        + capRows("pj", probs, 12).map(r => `<tr><td class="nowrap">${day(r.d)}</td><td>${esc(r.rq)}</td><td>${esc(r.cust || "—")}</td><td>${esc(r.fm)}</td>`
          + `<td class="nowrap">${/local/i.test(r.mt) ? "Local" : "Long distance"}${r.ch === 1 ? " · afternoon" : r.ch === 0 ? " · morning" : ""}</td>`
          + `<td><div class="ctr-tags">${problemsOf(r).map(([c, t]) => `<span class="ctr-tag ${c}">${esc(t)}</span>`).join("")}</div></td><td class="num">${money(r.bill)}</td></tr>`).join("")
        + `</tbody></table></div>${moreBtn("pj", probs.length, 12)}`) + `</div>`;
    const fmG = {};
    yrJobs.forEach(r => { (fmG[r.fm] = fmG[r.fm] || []).push(r); });
    const fmList = Object.keys(fmG).map(f => ({ f, st: crewStats(fmG[f]).all, pm: fmG[f].filter(r => r.ch === 1).length, rf: sum(fmG[f], "rf_amt") }))
      .sort((a, b) => b.st.n - a.st.n);
    const fmCard = `<div class="ctr-card"><h4>By foreman, last 12 months</h4><div class="ctr-cs">the CT jobs each foreman led · ${esc(mShort(k12[0]))} – ${esc(mShort(k))}</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Foreman</th><th class="num">Jobs</th><th class="num">Afternoon</th><th class="num">Late</th>`
      + `<th class="num">Over an hour</th><th class="num">Reviews per 100</th><th class="num">Claims</th><th class="num">Refunds</th><th class="num">Bad reviews</th><th class="num">Average bill</th></tr></thead><tbody>`
      + capRows("fm", fmList, 10).map(x => `<tr><td>${esc(x.f)}</td><td class="num">${fmtN(x.st.n)}</td><td class="num">${fmtN(x.pm)}</td><td class="num">${pctOf(x.st.late, x.st.n)}</td>`
        + `<td class="num">${fmtN(x.st.late1h)}</td><td class="num">${per100(x.st.rv, x.st.n)}</td><td class="num">${fmtN(x.st.cl)}</td><td class="num">${x.rf ? money(x.rf) : "—"}</td><td class="num">${fmtN(x.st.nr)}</td>`
        + `<td class="num">${x.st.bill != null ? money(x.st.bill) : "—"}</td></tr>`).join("") + `</tbody></table></div>${moreBtn("fm", fmList.length, 10)}</div>`;
    const reasonN = {}, faultN = {};
    yrJobs.filter(r => r.cl_n).forEach(r => {
      String(r.cl_reasons || "(no reason given)").split(", ").forEach(x => { reasonN[x] = (reasonN[x] || 0) + 1; });
      String(r.cl_resp || "(not set yet)").split(", ").forEach(x => { faultN[x] = (faultN[x] || 0) + 1; });
    });
    const byN = o => Object.keys(o).sort((a, b) => o[b] - o[a]);
    const claimsCard = `<div class="ctr-card"><h4>Claims, last 12 months</h4><div class="ctr-cs">${fmtN(CY.all.cl)} jobs with a claim · by reason, then by whose fault</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Reason</th><th class="num">Jobs</th></tr></thead><tbody>`
      + byN(reasonN).slice(0, 6).map(x => `<tr><td>${esc(x)}</td><td class="num">${fmtN(reasonN[x])}</td></tr>`).join("") + `</tbody></table></div>
      <div class="rs-tablewrap" style="margin-top:10px"><table class="rs-table ctr-tight"><thead><tr><th>Whose fault</th><th class="num">Jobs</th></tr></thead><tbody>`
      + byN(faultN).map(x => `<tr><td>${esc(x)}</td><td class="num">${fmtN(faultN[x])}</td></tr>`).join("") + `</tbody></table></div></div>`;
    const s03 = secHtml(2, probTiles + `<div style="margin-top:14px">${probList}</div><div class="ctr-wide" style="margin-top:14px">${fmCard}${claimsCard}</div>`);

    /* 02 LEADS AND SALES: funnel, what happened to the leads, reps, sources */
    const fMax = Math.max(M.leads, 1);
    const funnel = `<div class="ctr-card"><h4>Lead funnel</h4><div class="ctr-cs">${esc(lab)} · leads created ${thatP}</div><div class="ctr-fun">`
      + [["Leads", M.leads, ""], ["Qualified", M.q, "without bad leads"], ["Booked", M.b, pct(M.rate) + " of qualified"]].map(([l, n, s]) =>
        `<div class="ctr-fr"><span>${esc(l)}</span><div class="ctr-fb" style="width:${Math.max(2, Math.round(100 * n / fMax))}%"></div><span class="n">${fmtN(n)}${s ? `<span class="ctr-subt">${esc(s)}</span>` : ""}</span></div>`).join("")
      + `</div></div>`;
    const oc = (d.outcome || []).filter(r => inP(r.mo));
    const byG = {}, byF = {};
    OUTCOME_ORDER.forEach(g => { byG[g] = 0; byF[g] = {}; });
    oc.forEach(r => { const g = outcomeOf(r), f = g === "Booked" ? "Booked" : (r.flag || "(no reason recorded)"); byG[g] += r.n; byF[g][f] = (byF[g][f] || 0) + r.n; });
    const nOc = Math.max(OUTCOME_ORDER.reduce((a, g) => a + byG[g], 0), 1);
    const outcome = `<div class="ctr-card"><h4>What happened to the leads</h4><div class="ctr-cs">${esc(lab)} · ${fmtN(byG.Lost)} lost, ${fmtN(byG.Invalid)} invalid, by the rep's reason</div>`
      + (!oc.length ? '<div class="ctr-note">No leads ' + thatP + '.</div>' : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Outcome, then the rep's top reasons</th><th class="num">Leads</th><th class="num">Share</th></tr></thead><tbody>`
        + OUTCOME_ORDER.filter(g => byG[g]).map(g => `<tr class="ctr-og"><td>${esc(g)}</td><td class="num">${fmtN(byG[g])}</td><td class="num">${pct(byG[g] / nOc)}</td></tr>`
          + (g === "Booked" ? "" : Object.keys(byF[g]).sort((a, b) => byF[g][b] - byF[g][a]).slice(0, 3).map(f =>
            `<tr><td class="ctr-ofl">${esc(f)}</td><td class="num">${fmtN(byF[g][f])}</td><td class="num">${pct(byF[g][f] / Math.max(byG[g], 1))} of ${esc(g.toLowerCase())}</td></tr>`).join(""))).join("")
        + `</tbody></table></div>`) + `</div>`;
    const repG = {};   // ZP-19: a rep's months add up
    (d.reps || []).filter(r => inP(r.mo)).forEach(r => { const o = repG[r.rep] = repG[r.rep] || { rep: r.rep, leads: 0, q: 0, b: 0 };
      o.leads += +r.leads || 0; o.q += +r.q || 0; o.b += +r.b || 0; });
    const reps = Object.values(repG).sort((a, b) => b.q - a.q || b.leads - a.leads);
    const repsT = reps.reduce((a, r) => ({ leads: a.leads + r.leads, q: a.q + r.q, b: a.b + r.b }), { leads: 0, q: 0, b: 0 });
    const repsHtml = `<div class="ctr-card"><h4>Booking rate by rep in CT</h4><div class="ctr-cs">${esc(lab)} · the rep assigned in MoveBoard</div>`
      + (!reps.length ? '<div class="ctr-note">No leads ' + thatP + '.</div>' : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Rep</th><th class="num">Leads</th><th class="num">Qualified</th><th class="num">Booked</th><th class="num">Booking rate</th></tr></thead><tbody>`
        + capRows("reps", reps, 8).map(r => `<tr><td>${esc(r.rep)}</td><td class="num">${fmtN(r.leads)}</td><td class="num">${fmtN(r.q)}</td><td class="num">${fmtN(r.b)}</td><td class="num">${pct(rate(r.b, r.q))}</td></tr>`).join("")
        + `<tr class="ctr-tot"><td>All reps</td><td class="num">${fmtN(repsT.leads)}</td><td class="num">${fmtN(repsT.q)}</td><td class="num">${fmtN(repsT.b)}</td><td class="num">${pct(rate(repsT.b, repsT.q))}</td></tr></tbody></table></div>${moreBtn("reps", reps.length, 8)}`) + `</div>`;
    const groupSrc = (rows, keys) => { const g = {}; rows.forEach(r => { const o = g[r.src] = g[r.src] || { src: r.src }; keys.forEach(c => { o[c] = (o[c] || 0) + (+r[c] || 0); }); }); return Object.values(g); };
    const ls = groupSrc(d.leads.filter(r => inP(r.mo)), ["leads", "q", "b"]).sort((a, b) => b.leads - a.leads);
    const srcHtml = `<div class="ctr-card"><h4>Leads by source</h4><div class="ctr-cs">${esc(lab)}</div>` + (!ls.length ? '<div class="ctr-note">No leads.</div>'
      : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Source</th><th class="num">Leads</th><th class="num">Booked</th><th class="num">Booking rate</th></tr></thead><tbody>`
        + capRows("ls", ls, 8).map(r => `<tr><td>${esc(r.src)}</td><td class="num">${fmtN(r.leads)}</td><td class="num">${fmtN(r.b)}</td><td class="num">${pct(rate(r.b, r.q))}</td></tr>`).join("") + `</tbody></table></div>${moreBtn("ls", ls.length, 8)}`) + `</div>`;
    const s04 = secHtml(3, `<div class="ctr-two"><div class="ctr-stack">${funnel}${srcHtml}</div>${outcome}</div><div style="margin-top:14px">${repsHtml}</div>`);

    /* 03 JOBS AND REVENUE: 12-month momentum, local vs long distance, jobs by source, month by month */
    const mt = (a, b) => { const g = { local: { jobs: 0, rev: 0 }, ld: { jobs: 0, rev: 0 } };
      (d.movetype || []).filter(r => r.mo >= a && r.mo <= b).forEach(r => { const o = /local/i.test(r.mt) ? g.local : g.ld; o.jobs += r.jobs; o.rev += r.rev; }); return g; };
    const MT = mt(k0, k), MTL = mt(ly0, ly);
    const mtRow = (l, a, b) => `<tr><td>${esc(l)}</td><td class="num">${fmtN(a.jobs)}</td><td class="num">${money(a.rev)}</td><td class="num">${a.jobs ? money(a.rev / a.jobs) : "—"}</td>`
      + `<td class="num">${hasLY && !running ? (b.rev ? chip(a.rev, b.rev, "", false, true) : "—") : "—"}</td></tr>`;
    const mtHtml = `<div class="ctr-card"><h4>Local vs long distance</h4><div class="ctr-cs">${esc(lab)} · revenue against ${esc(lyLab)}</div>
      <div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th></th><th class="num">Jobs</th><th class="num">Revenue</th><th class="num">Average job</th><th class="num">vs last year</th></tr></thead><tbody>`
      + mtRow("Local", MT.local, MTL.local) + mtRow("Long distance", MT.ld, MTL.ld) + `</tbody></table></div></div>`;
    const js = groupSrc(d.jobs.filter(r => inP(r.mo)), ["jobs", "rev"]).sort((a, b) => b.rev - a.rev);
    const jobsSrc = `<div class="ctr-card"><h4>Jobs by source</h4><div class="ctr-cs">${esc(lab)}</div>` + (!js.length ? '<div class="ctr-note">No jobs.</div>'
      : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Source</th><th class="num">Jobs</th><th class="num">Revenue</th></tr></thead><tbody>`
        + capRows("js", js, 5).map(r => `<tr><td>${esc(r.src)}</td><td class="num">${fmtN(r.jobs)}</td><td class="num">${money(r.rev)}</td></tr>`).join("") + `</tbody></table></div>${moreBtn("js", js.length, 5)}`) + `</div>`;
    const yr = k.slice(0, 4), yms = months.filter(x => x.slice(0, 4) === yr).map(monthOf);
    const tot = yms.reduce((a, o) => ({ leads: a.leads + o.leads, q: a.q + o.q, b: a.b + o.b, jobs: a.jobs + o.jobs, rev: a.rev + o.rev, spend: a.spend + o.spend }), { leads: 0, q: 0, b: 0, jobs: 0, rev: 0, spend: 0 });
    const byMonth = `<div class="ctr-card"><h4>Month by month, ${esc(yr)}</h4><div class="ctr-cs">${hl}</div><div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Month</th><th class="num">Leads</th><th class="num">Booked</th>`
      + `<th class="num">Booking rate</th><th class="num">Jobs done</th><th class="num">Revenue</th><th class="num">Ad spend in CT</th><th class="num">Spend per job</th></tr></thead><tbody>`
      + yms.map(o => `<tr${inP(o.k) ? ' class="ctr-on"' : ""}><td>${esc(MON[+o.k.slice(5, 7) - 1])}${o.k === cur ? '<span class="ctr-subt">so far</span>' : ""}</td>`
        + `<td class="num">${fmtN(o.leads)}</td><td class="num">${fmtN(o.b)}</td><td class="num">${pct(o.rate)}</td><td class="num">${fmtN(o.jobs)}</td>`
        + `<td class="num">${money(o.rev)}</td><td class="num">${o.hasSpend ? money(o.spend) : "—"}</td><td class="num">${o.perJob != null ? money(o.perJob) : "—"}</td></tr>`).join("")
      + `<tr class="ctr-tot"><td>${esc(yr)}${yr === cur.slice(0, 4) ? " so far" : ""}</td><td class="num">${fmtN(tot.leads)}</td><td class="num">${fmtN(tot.b)}</td>`
      + `<td class="num">${pct(rate(tot.b, tot.q))}</td><td class="num">${fmtN(tot.jobs)}</td><td class="num">${money(tot.rev)}</td>`
      + `<td class="num">${money(tot.spend)}</td><td class="num">${tot.jobs ? money(tot.spend / tot.jobs) : "—"}</td></tr></tbody></table></div></div>`;
    const s05 = secHtml(4, `<div class="ctr-card"><h4>Revenue and jobs, momentum</h4><div class="ctr-cs">the last 12 months · bars = revenue, line = jobs done</div><div class="ctr-chart" id="ctrMom"></div></div>`
      + `<div class="ctr-two" style="margin-top:14px">${mtHtml}${jobsSrc}</div><div style="margin-top:14px">${byMonth}</div>`);

    /* 04 MARKETING: spend by channel, spend per lead and per job over 12 months, postcards in CT */
    const sp = groupSrc(d.spend.filter(r => inP(r.mo)).map(r => ({ src: r.fam, spend: r.spend })), ["spend"]).filter(r => Math.abs(r.spend) >= 0.5).sort((a, b) => b.spend - a.spend);
    const unpl = sum((d.unplaced || []).filter(r => inP(r.mo)), "spend");
    const spendHtml = `<div class="ctr-card"><h4>Ad spend placed in CT, by channel</h4><div class="ctr-cs">${esc(lab)}</div>` + (!sp.length ? `<div class="ctr-note">No ad spend is placed in CT for ${esc(lab)} yet.</div>`
      : `<div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Channel</th><th class="num">Spend</th><th class="num">Share</th></tr></thead><tbody>`
        + sp.map(r => `<tr><td>${esc(r.src)}</td><td class="num">${money(r.spend)}</td><td class="num">${M.spend ? Math.round(r.spend / M.spend * 100) + "%" : "—"}</td></tr>`).join("")
        + `<tr class="ctr-tot"><td>Placed in CT</td><td class="num">${money(M.spend)}</td><td class="num">100%</td></tr></tbody></table></div>`
        + (unpl > 0 ? `<div class="ctr-note">Left out: ${money(unpl)} of company-wide spend ${thatP} that no state can be given (Meta, Reddit and the like).</div>` : "")) + `</div>`;
    const effHtml = `<div class="ctr-card"><h4>What the spend returns</h4><div class="ctr-cs">the last 12 months</div><div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th>Month</th><th class="num">Spend</th><th class="num">Per lead</th><th class="num">Per job</th><th class="num">Revenue per $1</th></tr></thead><tbody>`
      + last12.map(o => `<tr${inP(o.k) ? ' class="ctr-on"' : ""}><td>${esc(mShort(o.k))}</td><td class="num">${o.hasSpend ? money(o.spend) : "—"}</td><td class="num">${o.perLead != null ? money(o.perLead) : "—"}</td>`
        + `<td class="num">${o.perJob != null ? money(o.perJob) : "—"}</td><td class="num">${o.roas != null ? money2(o.roas) : "—"}</td></tr>`).join("") + `</tbody></table></div></div>`;
    const pcs = d.postcards || [];
    const pcSum = (a, b) => { const xs = pcs.filter(r => r.mo >= a && r.mo <= b);   // ZP-19: a period's cards add up
      return xs.length ? ["mailed", "spent", "leads", "jobs", "rev"].reduce((o, c) => { o[c] = sum(xs, c); return o; }, {}) : null; };
    const pcNow = pcSum(k0, k), pcLy = pcSum(ly0, ly);
    const pcRow = (l, r) => !r ? `<tr><td>${esc(l)}</td><td class="num" colspan="6">no post cards on file</td></tr>`
      : `<tr><td>${esc(l)}</td><td class="num">${fmtN(r.mailed)}</td><td class="num">${money(r.spent)}</td><td class="num">${fmtN(r.leads)}</td><td class="num">${fmtN(r.jobs)}</td><td class="num">${money(r.rev)}</td><td class="num">${r.spent ? money2(r.rev / r.spent) : "—"}</td></tr>`;
    const pcHtml = `<div class="ctr-card"><h4>Post cards in CT</h4><div class="ctr-cs">mailed, their cost, and what came back</div><div class="rs-tablewrap"><table class="rs-table ctr-tight"><thead><tr><th></th><th class="num">Mailed</th><th class="num">Cost</th><th class="num">Leads</th><th class="num">Jobs</th><th class="num">Revenue</th><th class="num">Per $1</th></tr></thead><tbody>`
      + pcRow(pShort(k0, k), pcNow) + (hasLY ? pcRow(lyLab, pcLy) : "") + `</tbody></table></div><div class="ctr-note">Cost of mailed = cards × their unit cost (Post Card Expenditure). Leads and jobs by the state on the lead.</div></div>`;
    const s06 = secHtml(5, `<div class="ctr-two"><div class="ctr-stack">${spendHtml}${pcHtml}</div>${effHtml}</div>`);

    /* 05 OUTLOOK: this month and next, as booked (Month Outlook's numbers for CT) */
    const outHtml = (() => {
      const rows = d.outlook || [];
      if (!rows.length) return '<div class="ctr-note">The outlook is being rebuilt; it is back within the hour.</div>';
      const omos = [...new Set(rows.map(r => r.mo))].sort();
      const ph = (mo, p) => rows.filter(r => r.mo === mo && r.ph === p).reduce((a, r) => ({ n: a.n + r.n, rev: a.rev + r.rev }), { n: 0, rev: 0 });
      return `<div class="ctr-out">` + omos.map(mo => {
        const dn = ph(mo, "done"), de = ph(mo, "done_est"), ah = ph(mo, "ahead");
        const lr = (d.outlook_leads || []).find(o => o.mo === mo);
        return `<div class="ctr-oc"><div class="k">${esc(mLong(mo))} if nothing more is booked</div><div class="v">${money(dn.rev + de.rev + ah.rev)}</div>
          <div class="s"><b>${fmtN(dn.n + de.n + ah.n)}</b> jobs: ${fmtN(dn.n + de.n)} done${de.n ? ` (${fmtN(de.n)} without a closing sheet yet)` : ""}, <b>${fmtN(ah.n)}</b> still on the calendar (${money(ah.rev)})</div>
          ${lr ? `<div class="s">Leads moving in ${esc(MON[+mo.slice(5, 7) - 1])}: <b>${pct(rate(lr.b, lr.q))}</b> booked so far (${fmtN(lr.b)} of ${fmtN(lr.q)}); whole company ${pct(rate(lr.all_b, lr.all_q))}</div>` : ""}</div>`;
      }).join("") + `</div>`;
    })();
    const s07 = secHtml(6, outHtml);

    const how = `<h3>What this page shows</h3><p>Connecticut's month for Zip to Zip, laid out like the Monthly Report: the leads that came in,
        how many booked, the jobs done and what they billed, the advertising spend placed in CT, and the month ahead. Profit, margin
        and pay are not on this page. CT is the move's pickup state.</p>
      <h3>The tiles</h3><p>Each number against the same month last year and the month before; the bars under it are its last 12 months,
        the picked month in green. For the running month there is no year-on-year chip: the month isn't finished.</p>
      <h3>Several months</h3><p>Pick From and To to merge months (ZP-19): every number then sums those months and is compared with
        the same months a year earlier and with as many months just before. The 12-month tables and bars stay monthly, with the
        picked months highlighted.</p>
      <h3>Leads and booking rate</h3><p>Leads are Moveboard requests, counted in the month they came in. Booked = Confirmed. The booking
        rate is booked &divide; leads without bad leads (dead, archive, spam, video estimate), the portal's one rule.</p>
      <h3>What happened to the leads</h3><p>Every lead in one group on top of the rep's reason (Flag) in Moveboard, the same rule as
        Source Analysis: Booked; Lost (booked with others, over budget, not interested, a rate given and no answer, no reply after
        follow-ups, voicemail); Invalid (out of area, not moving, low quality, wrong phone or email, duplicate, truck rental); Still
        open; and No reason recorded.</p>
      <h3>Crews</h3><p>A morning job is the first job a crew starts that day; an afternoon job is chained after another job the same
        day (the calendar's After Job Code). Late arrivals come from the arrival check (Late Arrivals): arrived after the window's
        deadline, and over an hour late. Long-distance jobs have no arrival window, so they count under "no arrival record".</p>
      <h3>Problem jobs</h3><p>A job with a claim (the Claims board), a late arrival, a refund (the refunds list, with its dollars) or a bad
        review (the negative-review board), matched by the job's request number. Each line names the customer and the foreman, and the
        foreman table counts the last 12 months of CT jobs each foreman led (his picks, 19 Nov 2026).</p>
      <h3>Reviews</h3><p>Reviews that count: 4-5 stars on a counted platform, matched to the job by its request number, the same rule
        as Review Performance (ZP-20). Per 100 jobs = those reviews on the period's CT jobs (first days) &times; 100 &divide; the jobs.
        Reviews come in days after a move, so the newest weeks read low until they arrive. "Whole company" is every state's jobs
        the same way. Bad reviews per 100 jobs are the negative-review board's, as in Problem jobs.</p>
      <h3>Reps</h3><p>The rep assigned to the lead in Moveboard, with that rep's leads, qualified leads and bookings in CT.</p>
      <h3>Jobs and revenue</h3><p>Jobs done in the month, from the closing sheets, each move counted once. Revenue is the closing's
        Total Bill. Local = Local Moving; long distance = every other moving type.</p>
      <h3>Ad spend in CT</h3><p>The advertising ledger, placed by state: Google Ads by its own state report, Yelp by its CT account,
        Thumbtack by the leads it charged for, Google Local and Angi by their share of leads from CT, post cards by their label.
        Spend no state can be given (Meta, Reddit and the like) is left out, and its amount is said under the channel table.</p>
      <h3>Outlook</h3><p>The jobs on the calendar today, as in Month Outlook: done jobs at their bill (or the calendar estimate when
        the closing sheet is not filed yet), and jobs still ahead at the calendar's cash total &times; the usual increase to the
        final bill.</p><p>Data: ${esc(asOf)}.</p>`;
    host.innerHTML = `<div class="ctr-wrap">
      ${RSC.pageHeadHtml({ title: "CT Branch Report", key: "ct-report", sub: "Connecticut's monthly review: leads, bookings, jobs, revenue and what we spend on ads.", chip: asOf, how })}
      <div class="ctr-cover"><div><h2>Report for ${esc(lab)}${running ? " (so far)" : ""}</h2><div class="ctr-sub">${one ? "Monthly review" : n + "-month review"} · Connecticut · Zip To Zip Moving</div></div>
        <div class="ctr-step"><button type="button" class="rs-btn" data-step="-1" aria-label="${one ? "Month" : "Period"} before">‹</button><div id="ctrFrom"></div><div id="ctrMonth"></div>
        <button type="button" class="rs-btn" data-step="1" aria-label="${one ? "Month" : "Period"} after"${k >= cur ? " disabled" : ""}>›</button><button type="button" class="rs-btn" id="ctrPrint">Print</button></div></div>
      <nav class="ctr-nav" aria-label="Chapters">${CHAPTERS.map(([n, t]) => `<a href="#" data-go="${n}"><b>${n}</b>${esc(t)}</a>`).join("")}</nav>
      ${s01}${s02}${s03}${s04}${s05}${s06}${s07}
    </div>`;
    const opts = months.slice().reverse().map(x => ({ v: x, l: mLong(x) + (x === cur ? " (so far)" : "") }));
    // ZP-19: From and To. A From after To makes it one month; From = To is one month
    RSC.localSelect(host.querySelector("#ctrFrom"), { label: "From", required: true, values: opts, value: k0,
      onChange: v => { if (v >= S.month) { S.month = v; S.from = ""; } else S.from = v; render(host); } });
    RSC.localSelect(host.querySelector("#ctrMonth"), { label: "To", required: true, values: opts, value: k,
      onChange: v => { S.month = v; if (S.from && S.from >= v) S.from = ""; render(host); } });
    host.querySelectorAll("[data-step]").forEach(b => b.onclick = () => {
      const st = +b.dataset.step * n, e = addM(k, st), s0 = addM(k0, st);   // the whole period moves
      if (months.indexOf(e) >= 0 && months.indexOf(s0) >= 0) { S.month = e; S.from = one ? "" : s0; render(host); }
    });
    host.querySelector("#ctrPrint").onclick = () => window.print();
    host.querySelectorAll("[data-all]").forEach(b => b.onclick = () => { const n = b.dataset.all; S.all.has(n) ? S.all.delete(n) : S.all.add(n); render(host); });
    host.querySelectorAll("[data-go]").forEach(a => a.onclick = e => {
      e.preventDefault();
      const el = host.querySelector("#ctr-s" + a.dataset.go);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    host.querySelectorAll("[data-sec]").forEach(h => {
      const flip = () => { const n = h.dataset.sec; S.shut.has(n) ? S.shut.delete(n) : S.shut.add(n); render(host); };
      h.onclick = flip;
      h.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
    });
    TILES.concat(TILES2).forEach(t => spark(host.querySelector(`[data-spark="${t.id}"]`), last12.map(t.f)));
    const mom = host.querySelector("#ctrMom");
    if (mom && typeof Chart !== "undefined" && !S.shut.has("05")) {
      const C = pal(), cv = document.createElement("canvas");
      mom.appendChild(cv);
      charts.push(new Chart(cv, { data: { labels: last12.map(o => mShort(o.k)), datasets: [
        { type: "bar", label: "Revenue", data: last12.map(o => Math.round(o.rev)), backgroundColor: last12.map(o => inP(o.k) ? C.brand : C.line), yAxisID: "y", order: 2 },
        { type: "line", label: "Jobs done", data: last12.map(o => o.jobs), borderColor: C.ink, backgroundColor: C.ink, yAxisID: "y1", order: 1, pointRadius: 3, cubicInterpolationMode: "monotone" }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { tooltip: { callbacks: { label: x => x.dataset.label + ": " + (x.dataset.yAxisID === "y" ? money(x.raw) : fmtN(x.raw)) } } },
          scales: { y: { beginAtZero: true, ticks: { callback: v => "$" + Math.round(v / 1000) + "k" } },
                    y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { precision: 0 } } } } }));
    }
  }
  registerPage({
    id: "ct-report",
    group: "branch-reports",
    title: "CT Branch Report",
    async render(host) {
      injectStyle();
      host.innerHTML = RSC.loadingHtml("CT Branch Report", "Reading CT's months…");
      try {
        S.data = await ZTZ.api("/api/_ct");
        S.err = "";
      } catch (e) {
        S.err = String(e && e.message || e);
      }
      if (!S.data) {
        host.innerHTML = RSC.pageHeadHtml({ title: "CT Branch Report", key: "ct-report" })
          + RSC.emptyHtml({ title: "The CT report could not load", body: S.err.slice(0, 200) });
        return;
      }
      render(host);
    },
  });
})();
