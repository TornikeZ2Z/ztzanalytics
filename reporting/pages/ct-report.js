/* BRANCH REPORTS page: CT Branch Report (report id ct-report; tracker ZTZ-44, 15 Nov 2026).
   Tornike, 9 Nov: Giorgi Kolbaia, the CT branch owner, should get a CT version of the Monthly Report -- a general
   overview including what we spend; profit and margin are "a little risky for now". His picks on 15 Nov: spend +
   activity, no profit (leads, jobs, booking rate, revenue, what we spend); keep the ad-spend-per-job lines; "separate
   page - i will grant access later, first we have to discuss internally whether its good or not".
   DATA PATH: everything through /api/_ct (bridge/ct_report.py) -- no RS.load, no dataset. The report id maps to no
   tables, so whoever holds only this page can read CT's monthly counts and sums and nothing else: no profit, no
   customer, no other state. */
(() => {
  const esc = s => RSC.esc(s == null ? "" : String(s));
  const S = { data: null, err: "", month: "" };       // module-level: a re-render keeps the picked month
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const MONL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const mShort = k => MON[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
  const mLong = k => MONL[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
  const addM = (k, n) => { const i = +k.slice(0, 4) * 12 + +k.slice(5, 7) - 1 + n; return Math.floor(i / 12) + "-" + String(i % 12 + 1).padStart(2, "0"); };
  const nyMonth = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()).slice(0, 7);
  const money = v => "$" + Math.round(+v || 0).toLocaleString("en-US");
  const money2 = v => "$" + (+v || 0).toFixed(2);
  const fmtN = v => RS.fmtN(+v || 0);
  const pct = v => v == null ? "—" : (v * 100).toFixed(1) + "%";
  const day = v => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? MON[+s.slice(5, 7) - 1] + " " + +s.slice(8, 10) : "—"; };
  // RS.bookingRate's rule: booked / qualified, more booked than qualified caps at 100%, nothing at all is blank
  const rate = (b, q) => b > q ? 1 : (!q && !b ? null : (q ? b / q : 0));

  function injectStyle() {
    const old = document.getElementById("ctr-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "ctr-style";
    st.textContent = `
      /* ZTZ-103 (15 Nov, his word on Month Outlook: "i hate when we use 50% of the screen"): no page cap of its
         own; from 1700px the comparison and this month / next sit side by side, and the three source and
         spend tables share a row. A phone gets one column. */
      .ctr-wrap{max-width:none}
      .ctr-three{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
      .ctr-three>div:nth-child(3){grid-column:1/-1}
      .ctr-mid>div,.ctr-three>div{min-width:0}
      .ctr-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:4px 0 14px}
      .ctr-sec{font-size:15px;font-weight:600;color:var(--ink);margin:24px 0 10px}
      .ctr-note{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:8px}
      .rs-table tr.ctr-on td{background:color-mix(in srgb,var(--brand) 12%,transparent);font-weight:600}
      .rs-table tr.ctr-tot td{font-weight:700;border-top:2px solid var(--line)}
      .rs-table td .ctr-sub{display:block;font-size:12px;color:var(--muted);font-weight:400}
      .ctr-up{color:var(--pos,#2e7d32);font-weight:600}.ctr-dn{color:var(--neg,#c62828);font-weight:600}
      .ctr-out{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .ctr-card{border:1px solid var(--line);border-radius:10px;padding:14px 16px;background:var(--panel)}
      .ctr-card .k{font-size:13px;color:var(--muted)}
      .ctr-card .v{font-size:26px;font-weight:700;margin-top:4px;font-variant-numeric:tabular-nums}
      .ctr-card .s{font-size:13px;color:var(--muted);margin-top:3px;line-height:1.5}
      .ctr-card .s b{color:var(--ink)}
      @media(min-width:1700px){
        .ctr-mid{display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:14px;align-items:start}
        .ctr-mid .ctr-out{grid-template-columns:1fr}
        .ctr-three{grid-template-columns:repeat(3,minmax(0,1fr))}
        .ctr-three>div:nth-child(3){grid-column:auto}}
      @media(max-width:900px){.ctr-out,.ctr-three{grid-template-columns:1fr}.ctr-three>div:nth-child(3){grid-column:auto}}`;
    document.head.appendChild(st);
  }

  /* ---------- the month's numbers, from the endpoint's rows ---------- */
  function monthOf(k) {
    const d = S.data;
    const L = d.leads.filter(r => r.mo === k), J = d.jobs.filter(r => r.mo === k), P = d.spend.filter(r => r.mo === k);
    const sum = (rs, c) => rs.reduce((a, r) => a + (+r[c] || 0), 0);
    const o = { k, leads: sum(L, "leads"), q: sum(L, "q"), b: sum(L, "b"), jobs: sum(J, "jobs"), rev: sum(J, "rev"),
                spend: sum(P, "spend"), hasSpend: P.length > 0 };
    o.rate = rate(o.b, o.q);
    o.rateAll = o.leads ? o.b / o.leads : null;
    o.avg = o.jobs ? o.rev / o.jobs : null;
    o.perLead = o.hasSpend && o.leads ? o.spend / o.leads : null;
    o.perJob = o.hasSpend && o.jobs ? o.spend / o.jobs : null;
    o.roas = o.hasSpend && o.spend > 0 ? o.rev / o.spend : null;
    return o;
  }

  function render(host) {
    const d = S.data;
    const cur = nyMonth();
    const months = [];
    for (let k = d.first; k <= cur; k = addM(k, 1)) months.push(k);
    if (!S.month || months.indexOf(S.month) < 0) S.month = months.length > 1 ? months[months.length - 2] : months[0];
    const k = S.month, running = k === cur;
    const M = monthOf(k), LY = monthOf(addM(k, -12)), PM = monthOf(addM(k, -1));
    const hasLY = addM(k, -12) >= d.first;
    const asOf = `Moveboard to ${day(d.as_of.moveboard)} · closings to ${day(d.as_of.closings)}`;

    /* KPI row: the month, against the same month last year (named, so nobody guesses what is compared) */
    const vsLY = (now, then, goodUp, isRate) => {
      if (running || !hasLY || now == null || then == null) return null;
      if (isRate) { const p = (now - then) * 100; return { text: `${Math.abs(p).toFixed(1)} pts vs ${mShort(addM(k, -12))}`, dir: p > 0 ? "up" : p < 0 ? "down" : "flat", good: goodUp == null ? null : (p > 0) === goodUp }; }
      if (!then) return null;
      const p = (now - then) / then * 100;
      return { text: `${Math.abs(p).toFixed(0)}% vs ${mShort(addM(k, -12))}`, dir: p > 0 ? "up" : p < 0 ? "down" : "flat", good: goodUp == null ? null : (p > 0) === goodUp };
    };
    const kpis = RSC.kpisHtml([
      { label: "Leads", value: fmtN(M.leads), delta: vsLY(M.leads, LY.leads, true), sub: running ? "so far this month" : `${fmtN(LY.leads)} in ${mShort(addM(k, -12))}` },
      { label: "Booking rate", value: pct(M.rate), delta: vsLY(M.rate, LY.rate, true, true), sub: `${fmtN(M.b)} booked of ${fmtN(M.q)}` },
      { label: "Jobs done", value: fmtN(M.jobs), delta: vsLY(M.jobs, LY.jobs, true), sub: running ? "so far this month" : `${fmtN(LY.jobs)} in ${mShort(addM(k, -12))}` },
      { label: "Revenue", value: money(M.rev), delta: vsLY(M.rev, LY.rev, true), sub: M.avg != null ? `${money(M.avg)} a job` : "" },
      { label: "Ad spend in CT", value: M.hasSpend ? money(M.spend) : "—", delta: M.hasSpend ? vsLY(M.spend, LY.spend, null) : null,
        sub: M.hasSpend ? (M.perJob != null ? `${money(M.perJob)} per job done` : "") : "no spend in yet for this month" },
    ]);

    /* AT A GLANCE: every line against the same month last year and the month before, each column named */
    const cols = [M, hasLY ? LY : null, PM].filter(Boolean);
    const line = (label, f, sub) => `<tr><td>${label}${sub ? `<span class="ctr-sub">${sub}</span>` : ""}</td>`
      + cols.map(c => `<td class="num">${f(c)}</td>`).join("") + "</tr>";
    const glance = `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th></th>`
      + cols.map((c, i) => `<th class="num">${esc(mShort(c.k))}${i === 0 ? (running ? " (so far)" : "") : i === 1 && hasLY ? " (last year)" : " (month before)"}</th>`).join("")
      + `</tr></thead><tbody>`
      + line("Leads", c => fmtN(c.leads))
      + line("Booked", c => fmtN(c.b))
      + line("Booking rate", c => pct(c.rate), "booked ÷ leads without bad leads")
      + line("Booked ÷ all leads", c => pct(c.rateAll), "the fair year-on-year rate")
      + line("Jobs done", c => fmtN(c.jobs))
      + line("Revenue", c => money(c.rev), "billed on the closing sheets")
      + line("Average job", c => c.avg != null ? money(c.avg) : "—")
      + line("Ad spend placed in CT", c => c.hasSpend ? money(c.spend) : "—")
      + line("Ad spend per lead", c => c.perLead != null ? money(c.perLead) : "—")
      + line("Ad spend per job done", c => c.perJob != null ? money(c.perJob) : "—")
      + line("Revenue per $1 of ads", c => c.roas != null ? money2(c.roas) : "—")
      + `</tbody></table></div>`;

    /* MONTH BY MONTH: the picked month's year */
    const yr = k.slice(0, 4);
    const yms = months.filter(x => x.slice(0, 4) === yr).map(monthOf);
    const tot = yms.reduce((a, o) => ({ leads: a.leads + o.leads, q: a.q + o.q, b: a.b + o.b, jobs: a.jobs + o.jobs, rev: a.rev + o.rev, spend: a.spend + o.spend }),
      { leads: 0, q: 0, b: 0, jobs: 0, rev: 0, spend: 0 });
    const byMonth = `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Month</th><th class="num">Leads</th><th class="num">Booked</th>`
      + `<th class="num">Booking rate</th><th class="num">Jobs done</th><th class="num">Revenue</th><th class="num">Ad spend in CT</th><th class="num">Spend per job</th></tr></thead><tbody>`
      + yms.map(o => `<tr${o.k === k ? ' class="ctr-on"' : ""}><td>${esc(MON[+o.k.slice(5, 7) - 1])}${o.k === cur ? '<span class="ctr-sub">so far</span>' : ""}</td>`
        + `<td class="num">${fmtN(o.leads)}</td><td class="num">${fmtN(o.b)}</td><td class="num">${pct(o.rate)}</td><td class="num">${fmtN(o.jobs)}</td>`
        + `<td class="num">${money(o.rev)}</td><td class="num">${o.hasSpend ? money(o.spend) : "—"}</td><td class="num">${o.perJob != null ? money(o.perJob) : "—"}</td></tr>`).join("")
      + `<tr class="ctr-tot"><td>${esc(yr)}${yr === cur.slice(0, 4) ? " so far" : ""}</td><td class="num">${fmtN(tot.leads)}</td><td class="num">${fmtN(tot.b)}</td>`
      + `<td class="num">${pct(rate(tot.b, tot.q))}</td><td class="num">${fmtN(tot.jobs)}</td><td class="num">${money(tot.rev)}</td>`
      + `<td class="num">${money(tot.spend)}</td><td class="num">${tot.jobs ? money(tot.spend / tot.jobs) : "—"}</td></tr></tbody></table></div>`;

    /* SOURCES: where the month's leads came from, and its jobs by source */
    const groupSrc = (rows, keys) => { const g = {};
      rows.forEach(r => { const o = g[r.src] = g[r.src] || { src: r.src }; keys.forEach(c => { o[c] = (o[c] || 0) + (+r[c] || 0); }); });
      return Object.values(g); };
    const ls = groupSrc(d.leads.filter(r => r.mo === k), ["leads", "q", "b"]).sort((a, b) => b.leads - a.leads);
    const js = groupSrc(d.jobs.filter(r => r.mo === k), ["jobs", "rev"]).sort((a, b) => b.rev - a.rev);
    const srcLeads = !ls.length ? '<div class="ctr-note">No leads.</div>' : `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">Leads</th>`
      + `<th class="num">Booked</th><th class="num">Booking rate</th></tr></thead><tbody>`
      + ls.map(r => `<tr><td>${esc(r.src)}</td><td class="num">${fmtN(r.leads)}</td><td class="num">${fmtN(r.b)}</td><td class="num">${pct(rate(r.b, r.q))}</td></tr>`).join("")
      + `</tbody></table></div>`;
    const srcJobs = !js.length ? '<div class="ctr-note">No jobs.</div>' : `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">Jobs</th>`
      + `<th class="num">Revenue</th></tr></thead><tbody>`
      + js.map(r => `<tr><td>${esc(r.src)}</td><td class="num">${fmtN(r.jobs)}</td><td class="num">${money(r.rev)}</td></tr>`).join("")
      + `</tbody></table></div>`;

    /* AD SPEND IN CT by channel */
    const sp = groupSrc(d.spend.filter(r => r.mo === k).map(r => ({ src: r.fam, spend: r.spend })), ["spend"])
      .filter(r => Math.abs(r.spend) >= 0.5).sort((a, b) => b.spend - a.spend);
    const unpl = (d.unplaced.find(r => r.mo === k) || {}).spend || 0;
    const spendHtml = !sp.length ? `<div class="ctr-note">No ad spend is placed in CT for ${esc(mLong(k))} yet.</div>`
      : `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Channel</th><th class="num">Spend</th><th class="num">Share</th></tr></thead><tbody>`
      + sp.map(r => `<tr><td>${esc(r.src)}</td><td class="num">${money(r.spend)}</td><td class="num">${M.spend ? Math.round(r.spend / M.spend * 100) + "%" : "—"}</td></tr>`).join("")
      + `<tr class="ctr-tot"><td>Placed in CT</td><td class="num">${money(M.spend)}</td><td class="num">100%</td></tr></tbody></table></div>`
      + (unpl > 0 ? `<div class="ctr-note">Left out: ${money(unpl)} of company-wide spend that month that no state can be given (Meta, Reddit and the like).</div>` : "");

    /* THIS MONTH AND NEXT, as booked (Month Outlook's numbers for CT) */
    const outHtml = (() => {
      const rows = d.outlook || [];
      if (!rows.length) return "";
      const omos = [...new Set(rows.map(r => r.mo))].sort();
      const ph = (mo, p) => rows.filter(r => r.mo === mo && r.ph === p).reduce((a, r) => ({ n: a.n + r.n, rev: a.rev + r.rev }), { n: 0, rev: 0 });
      const cards = omos.map(mo => {
        const dn = ph(mo, "done"), de = ph(mo, "done_est"), ah = ph(mo, "ahead");
        const lr = (d.outlook_leads || []).find(o => o.mo === mo);
        const r1 = lr ? rate(lr.b, lr.q) : null, r2 = lr ? rate(lr.all_b, lr.all_q) : null;
        return `<div class="ctr-card"><div class="k">${esc(mLong(mo))} if nothing more is booked</div><div class="v">${money(dn.rev + de.rev + ah.rev)}</div>
          <div class="s"><b>${fmtN(dn.n + de.n + ah.n)}</b> jobs: ${fmtN(dn.n + de.n)} done${de.n ? ` (${fmtN(de.n)} without a closing sheet yet)` : ""}, <b>${fmtN(ah.n)}</b> still on the calendar (${money(ah.rev)})</div>
          ${lr ? `<div class="s">Leads moving in ${esc(MON[+mo.slice(5, 7) - 1])}: <b>${pct(r1)}</b> booked so far (${fmtN(lr.b)} of ${fmtN(lr.q)}); whole company ${pct(r2)}</div>` : ""}</div>`;
      }).join("");
      return `<div class="ctr-sec">This month and next, as booked today</div><div class="ctr-out">${cards}</div>`;
    })();

    const how = `<h3>What this page shows</h3><p>Connecticut's month by month for Zip to Zip: the leads that came in, how many booked,
        the jobs done and what they billed, and the advertising spend placed in CT. Profit, margin and pay are not on this page.
        CT is the move's pickup state.</p>
      <h3>Leads and booking rate</h3><p>Leads are Moveboard requests, counted in the month they came in. Booked = Confirmed. The booking
        rate is booked &divide; leads without bad leads (dead, archive, spam, video estimate), the portal's one rule. Bad leads have been
        marked more strictly in 2026, so that rate rises against 2025 partly by definition: "Booked &divide; all leads" is the fair
        year-on-year line.</p>
      <h3>Jobs and revenue</h3><p>Jobs done in the month, from the closing sheets, each move counted once (a second day is not a
        second job). Revenue is the closing's Total Bill. A month's booked leads and its jobs are not the same people: a lead books
        in one month and moves in another.</p>
      <h3>Ad spend in CT</h3><p>The advertising ledger, placed by state: Google Ads by its own state report, Yelp by its CT account,
        Thumbtack by the leads it charged for, Google Local and Angi by their share of leads from CT, post cards by their label.
        Spend no state can be given (Meta, Reddit and the like) is left out, and its amount is said under the channel table.
        A month's spend is complete once its bills are in, usually a few days into the next month.</p>
      <h3>This month and next</h3><p>The jobs on the calendar today, as in Month Outlook: done jobs at their bill (or the calendar
        estimate when the closing sheet is not filed yet), and jobs still ahead at the calendar's cash total &times; the usual increase
        to the final bill. The booking rate there is for leads whose move date is in that month.</p>
      <p>Data: ${esc(asOf)}.</p>`;

    host.innerHTML = `<div class="ctr-wrap">
      ${RSC.pageHeadHtml({ title: "CT Branch Report", key: "ct-report",
        sub: "Connecticut, month by month: leads, bookings, jobs, revenue and what we spend on ads.",
        chip: asOf, how })}
      <div class="ctr-bar"><div id="ctrMonth"></div></div>
      ${RSC.headlineHtml(`In ${esc(mLong(k))}${running ? " so far" : ""}, CT had <b>${fmtN(M.leads)}</b> leads and booked <b>${fmtN(M.b)}</b> (${pct(M.rate)}), did <b>${fmtN(M.jobs)}</b> jobs for <b>${money(M.rev)}</b>`
        + (M.hasSpend ? `, and we spent <b>${money(M.spend)}</b> on ads placed in CT.` : "."))}
      ${kpis}
      <div class="ctr-mid"><div>
      <div class="ctr-sec">${esc(mLong(k))} against ${hasLY ? esc(mShort(addM(k, -12))) + " and " : ""}${esc(mShort(addM(k, -1)))}</div>
      ${glance}</div>
      <div>${outHtml}</div></div>
      <div class="ctr-sec">Month by month, ${esc(yr)}</div>
      ${byMonth}
      <div class="ctr-three">
        <div><div class="ctr-sec">Where ${esc(mLong(k))}'s leads came from</div>${srcLeads}</div>
        <div><div class="ctr-sec">${esc(mLong(k))}'s jobs by source</div>${srcJobs}</div>
        <div><div class="ctr-sec">Ad spend in CT, ${esc(mLong(k))}</div>${spendHtml}</div>
      </div>
    </div>`;
    RSC.localSelect(host.querySelector("#ctrMonth"), { label: "Month", required: true,
      values: months.slice().reverse().map(x => ({ v: x, l: mLong(x) + (x === cur ? " (so far)" : "") })),
      value: k, onChange: v => { S.month = v; render(host); } });
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
