/* The Area Plan — the planning tool, v3.
 *
 * Tornike's third pass (2026-08-19): (1) the capacity column is FOREMAN QUANTITY — the rows
 * are how many foremen each base has and gains, not abstract jobs/day; (2) full-width layout,
 * no tiny fonts — hints must be readable; (3) a PERIOD PICKER — any month or span, not
 * hard-wired September. The mart now carries every month since 2024-01, so the page
 * aggregates whatever period is chosen and compares it against the same months one year
 * earlier. Everything else holds: his base numbers as the seed (NY served FROM the NJ base),
 * live recompute, edits persisted in this browser.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_plan) {
    RS.DATASETS.area_plan = {
      table: "mart_area_plan",
      cols: ["ym", "company", "state", "county",
             "leads", "qualified", "lost", "booked", "total_cf"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("ap-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "ap-style";
    st.textContent = `
    /* THE SHARED KIT (assets/rs.css) carries this page's card, tiles, bar, segment,
       selects, number fields, tables and pills. The ap-card / ap-h / ap-sub / ap-tiles /
       ap-tile / ap-tbl / ap-left / ap-dim / ap-num / ap-sel / ap-chip / ap-pill copies
       that used to live here were the same controls, drifted. What is left below is what
       the kit has no answer for: the eyebrow above a card title, the inline value colours,
       the assumptions strip, the truck callout and the town lists. */
    .ap-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;
      color:var(--muted);margin-bottom:3px}
    /* the kit's card title sits flush under the eyebrow; give it back its 5px.
       Scoped to an eyebrow-led card so no other page's .panel-title is touched. */
    .ap-eyebrow + .panel-title{margin-bottom:5px}
    .ap-good{color:var(--pos)} .ap-bad{color:var(--neg)}
    .ap-warn{color:var(--warn)}
    /* on a KPI tile the kit paints .v in --ink at (0,3,0); these need to out-specify it
       or the trucks warning renders as plain text and the tile carries no signal */
    .rs-kpis .kpi .v.ap-warn{color:var(--warn)}
    .rs-kpis .kpi .v.ap-good{color:var(--pos)}
    .ap-note{font-size:12.5px;color:var(--muted);line-height:1.55}
    .ap-assume{display:flex;gap:30px;flex-wrap:wrap;margin:2px 0 16px}
    .ap-assume .l{font-size:11.5px;font-weight:800;letter-spacing:.04em;
      text-transform:uppercase;color:var(--muted);margin-bottom:5px}
    .ap-assume .m{font-size:12px;color:var(--muted);margin-top:4px;max-width:260px;
      line-height:1.45}
    .ap-callout{background:color-mix(in srgb,var(--brand-d) 7%,transparent);
      border:1px solid color-mix(in srgb,var(--brand-d) 30%,transparent);border-radius:12px;
      padding:14px 16px;font-size:13px;line-height:1.65;margin-top:12px}
    .ap-towns{font-size:12.5px;color:var(--muted);line-height:1.5}
    `;
    document.head.appendChild(st);
  }

  const LS_KEY = "ztzAreaPlan.v3";
  // HIS TABLE (2026-08-19), first column renamed at his ask: FOREMAN QUANTITY per base, plus
  // the additional foremen being considered. NY is served FROM the NJ base — coverage.
  const BASES = [
    { st: "NJ", cur: 11, add: 2, note: "the base that also covers NY" },
    { st: "PA", cur: 8,  add: 2, note: "" },
    { st: "NY", cur: 3,  add: 3, note: "0 based here — served from NJ" },
    { st: "DE", cur: 3,  add: 3, note: "" },
    { st: "CT", cur: 5,  add: 2, note: "" },
    { st: "MA", cur: 0,  add: 0, note: "" },
    /* MD and VA were not bases in his table, but they ARE in the 28-crew aim (MD 3 -- Tuji
       and Zip together -- and VA 1). They seed at zero so the default totals stay his real
       plan; the aim chip below fills them. */
    { st: "MD", cur: 0,  add: 0, note: "Tuji + Zip together in the aim" },
    { st: "VA", cur: 0,  add: 0, note: "a stated marketing bet -- no measured demand" },
  ];
  /* The 28-crew AIM from the original brief (also shipped as model.crew_aim): the maximum
     from the brief, distinct from the real base table above. One chip loads each; a hand
     edit makes the plan "custom". */
  const AIM_FALLBACK = { NJ: 10, PA: 8, MD: 3, CT: 4, MA: 2, VA: 1 };
  const DAYS_PER_MONTH = 30;

registerPage({
  id: "area-plan",
  group: "different",
  title: "Area Plan",
  subtitle: "Planning by base: today's foremen, the additions being considered, and what " +
            "they imply for sales, marketing and trucks — for any month or period you pick.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const money = v => (v == null || isNaN(v)) ? "—" : RS.money(+v);
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";
    const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep",
                         "Oct", "Nov", "Dec"];
    const ymLabel = ym => MONTH_NAMES[+ym.slice(5, 7)] + " " + ym.slice(0, 4);

    injectStyle();
    host.innerHTML = '<div class="panel">Loading…</div>';

    return Promise.all([
      RS.load("area_plan"),
      ZTZ.api("/api/mart_area_plan_model?limit=1").then(
        j => JSON.parse(((j.rows || [])[0] || {}).payload || "null")).catch(() => null),
    ]).then(([rows, model]) => {
      if (!rows.length || !model) {
        host.innerHTML = '<div class="panel">The Area Plan mart has not been built yet — ' +
          'run sources=area-plan and reload.</div>';
        return;
      }

      const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
      const MS = model.monthly_states || {};
      const CAPM = model.capacity || {};
      const SALES = model.sales || {};
      const MKT = model.marketing || {};
      const allYms = Object.keys(MS).sort();
      const lastSettled = allYms[allYms.length - 1];

      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
        catch (e) { return {}; }
      })();
      const inputs = Object.assign({
        from: "2025-09", to: "2025-09",
        seed: "real",                // "real" = his table; "aim" = the 28-crew aim; "custom"
        bases: Object.fromEntries(BASES.map(b => [b.st, { cur: b.cur, add: b.add }])),
        utilization: null,           // seeded from the selected period below
        leadsPerRep: null,
        dollarsPerLead: null,
      }, saved);
      BASES.forEach(b => {
        if (!inputs.bases[b.st]) inputs.bases[b.st] = { cur: b.cur, add: b.add };
      });

      /* ------- period machinery: the chosen months, and the same months a year before ---- */
      const monthsIn = (from, to) => allYms.filter(m => m >= from && m <= to);
      const yearBack = ym => (String(+ym.slice(0, 4) - 1)) + ym.slice(4);

      function aggStates(yms) {
        const out = {};
        yms.forEach(m => {
          Object.entries(MS[m] || {}).forEach(([st, a]) => {
            const o = out[st] = out[st] || { leads: 0, qualified: 0, booked: 0, lost: 0 };
            o.leads += a.leads; o.qualified += a.qualified;
            o.booked += a.booked; o.lost += a.lost;
          });
        });
        Object.values(out).forEach(o => {
          o.conversion = o.qualified ? o.booked / o.qualified : null;
        });
        return out;
      }
      function aggMeasured(yms) {
        let jobs = 0, spend = 0, leads = 0;
        const repMed = [], jpf = [];
        yms.forEach(m => {
          jobs += ((CAPM[m] || {})._national || {}).jobs || 0;
          spend += (MKT[m] || {}).ad_spend || 0;
          leads += (MKT[m] || {}).leads || 0;
          const s = SALES[m] || {};
          if (s.leads_per_rep_median) repMed.push(s.leads_per_rep_median);
          const j = ((CAPM[m] || {})._national || {}).jobs_per_foreman;
          if (j) jpf.push(j);
        });
        const med = a => { const v = a.slice().sort((x, y) => x - y);
          return v.length ? v[Math.floor(v.length / 2)] : null; };
        return { jobs, spend, leads,
                 dollarsPerLead: leads ? spend / leads : null,
                 leadsPerRep: med(repMed), jobsPerForeman: med(jpf),
                 doneByState: (st) => yms.reduce((a, m) =>
                   a + (((CAPM[m] || {})[st] || {}).jobs || 0), 0) };
      }

      let P = {};   // everything derived from the current period — filled by recalcPeriod()
      function recalcPeriod() {
        const yms = monthsIn(inputs.from, inputs.to);
        const prevYms = yms.map(yearBack).filter(m => allYms.includes(m));
        P = {
          yms, prevYms,
          label: yms.length === 1 ? ymLabel(yms[0])
            : ymLabel(yms[0]) + " – " + ymLabel(yms[yms.length - 1]),
          prevLabel: prevYms.length
            ? (prevYms.length === 1 ? ymLabel(prevYms[0])
               : ymLabel(prevYms[0]) + " – " + ymLabel(prevYms[prevYms.length - 1]))
            : "no prior-year data",
          S: aggStates(yms), Sprev: aggStates(prevYms),
          M: aggMeasured(yms),
          provisional: yms.some(m => {
            const d = new Date();
            const cur = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
            const back2 = new Date(d.getFullYear(), d.getMonth() - 2, 1);
            const b2 = back2.getFullYear() + "-" + String(back2.getMonth() + 1).padStart(2, "0");
            return m >= b2 && m <= cur;
          }),
        };
        const natQ = Object.values(P.S).reduce((a, s) => a + s.qualified, 0);
        const natB = Object.values(P.S).reduce((a, s) => a + s.booked, 0);
        P.natConv = natQ ? natB / natQ : 0.2;
        const curForemen = BASES.reduce((a, b) => a + num(inputs.bases[b.st].cur), 0);
        P.measuredUtil = (curForemen && P.yms.length)
          ? P.M.jobs / (curForemen * DAYS_PER_MONTH * P.yms.length) : 0.34;
        // seeds follow the period unless the user has typed their own
        if (inputs.utilization == null)
          inputs.utilization = Math.round(P.measuredUtil * 1000) / 10;
        if (inputs.leadsPerRep == null) inputs.leadsPerRep = P.M.leadsPerRep || 140;
        if (inputs.dollarsPerLead == null)
          inputs.dollarsPerLead = Math.round((P.M.dollarsPerLead || 42) * 100) / 100;
      }

      function calc() {
        const util = num(inputs.utilization) / 100;
        const months = Math.max(1, P.yms.length);
        const perBase = BASES.map(b => {
          const s = inputs.bases[b.st];
          const foremen = num(s.cur) + num(s.add);
          const jobs = foremen * DAYS_PER_MONTH * months * util;
          const conv = (P.S[b.st] || {}).conversion || P.natConv;
          const leadsNeeded = conv ? jobs / conv : 0;
          const had = (P.S[b.st] || {}).qualified || 0;
          return { ...b, cur: num(s.cur), add: num(s.add), foremen, jobs, conv, leadsNeeded,
                   had, done: P.M.doneByState(b.st),
                   gap: had ? leadsNeeded / had - 1 : null };
        });
        const totCur = perBase.reduce((a, r) => a + r.cur, 0);
        const totForemen = perBase.reduce((a, r) => a + r.foremen, 0);
        const totJobs = perBase.reduce((a, r) => a + r.jobs, 0);
        const totLeads = perBase.reduce((a, r) => a + r.leadsNeeded, 0);
        return { perBase, totCur, totForemen, totJobs, totLeads, util, months,
                 salesNeeded: totLeads / months / Math.max(1, num(inputs.leadsPerRep)),
                 marketing: totLeads / months * num(inputs.dollarsPerLead) };
      }

      /* ---------------- pieces ---------------- */
      function periodBar() {
        const chip = (label, from, to) =>
          '<button' +
          (inputs.from === from && inputs.to === to ? ' class="on"' : "") +
          ' data-from="' + from + '" data-to="' + to + '">' + label + '</button>';
        const last = lastSettled;
        const l3from = allYms[Math.max(0, allYms.indexOf(last) - 2)] || last;
        return '<div class="rs-bar">' +
          '<div class="rs-fld"><span>Period</span><div class="rs-seg" id="apPeriod">' +
          chip("Sep 2025", "2025-09", "2025-09") +
          chip("Sep 2024", "2024-09", "2024-09") +
          chip("Last month", last, last) +
          chip("Last 3 months", l3from, last) +
          chip("2025", "2025-01", "2025-12") +
          '</div></div>' +
          '<div id="apFrom"></div>' +
          '<div id="apTo"></div>' +
          '<div class="rs-spacer"></div>' +
          '<span class="ap-note">comparing against <b>' +
          esc(P.prevLabel) + '</b>' +
          (P.provisional ? ' · <span class="ap-warn"><b>recent months are still ' +
            'settling — lost counts there are provisional</b></span>' : '') + '</span></div>';
      }

      function heroHtml(c) {
        const t = (l, v, s, cls) =>
          '<div class="kpi"><div class="l">' + l + '</div><div class="v' +
          (cls ? " " + cls : "") + '">' + v + '</div><div class="s">' + s + '</div></div>';
        return t(inputs.seed === "aim" ? "Aim foremen" : "Foremen today", c.totCur,
                 inputs.seed === "aim" ? "the 28-crew aim (a maximum)"
                   : inputs.seed === "custom" ? "hand-edited below" : "his real current numbers") +
          t("Planned foremen", c.totForemen, "+" + (c.totForemen - c.totCur) + " additional") +
          t("Jobs in " + esc(P.label), fmtN(c.totJobs),
            "at " + n1(c.util * 100) + "% utilization") +
          t("Leads needed", fmtN(c.totLeads), "via each area's own conversion") +
          t("Salespeople", (Math.round(c.salesNeeded * 10) / 10),
            "at " + fmtN(num(inputs.leadsPerRep)) + " leads/rep/month") +
          t("Marketing / month", money(c.marketing),
            "at " + money(num(inputs.dollarsPerLead)) + " per lead") +
          t("Trucks", c.totForemen + " vs " + fmtN((model.fleet || {}).owned_trucks) +
            " owned", "a foreman needs a truck — rentals bridge peaks today; the +2 buy " +
            "case is below",
            c.totForemen > ((model.fleet || {}).owned_trucks || 0) ? "ap-warn" : "ap-good");
      }

      function baseHtml(c) {
        return '<table class="rs-table"><thead><tr>' +
          '<th>Base / area</th><th class="num">Foreman quantity</th>' +
          '<th class="num">Additional foremen</th>' +
          '<th class="num">Planned</th><th class="num">Jobs done (' + esc(P.label) + ')</th>' +
          '<th class="num">Jobs @ plan</th><th class="num">Conversion</th>' +
          '<th class="num">Leads needed</th>' +
          '<th class="num">Qualified (' + esc(P.label) + ')</th>' +
          '<th class="num">Demand check</th>' +
          '</tr></thead><tbody>' +
          c.perBase.map(r =>
            '<tr><td class="strong">' + esc(r.st) +
              (r.note ? '<div class="ap-note">' + esc(r.note) + '</div>' : '') + '</td>' +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="cur" ' +
              'type="number" min="0" step="1" value="' + r.cur + '"></td>' +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="add" ' +
              'type="number" min="0" step="1" value="' + r.add + '"></td>' +
            '<td class="num"><b>' + r.foremen + '</b></td>' +
            '<td class="num dim">' + fmtN(r.done) + '</td>' +
            '<td class="num">' + fmtN(r.jobs) + '</td>' +
            '<td class="num">' + pct(r.conv) + ((P.S[r.st] || {}).conversion == null ?
              '<span class="ap-note"> (national)</span>' : '') + '</td>' +
            '<td class="num">' + fmtN(r.leadsNeeded) + '</td>' +
            '<td class="num">' + fmtN(r.had) + '</td>' +
            '<td class="num">' + (r.gap == null
              ? '<span class="rs-pill bad">no measured demand</span>'
              : r.gap > 0.1
                ? '<span class="rs-pill warn">+' + Math.round(r.gap * 100) +
                  '% vs ' + esc(P.label) + '</span>'
                : '<span class="rs-pill ok">covered</span>') + '</td></tr>'
          ).join("") + '</tbody></table>';
      }

      function seedChipsHtml() {
        const chip = (key, label) => '<button' + (inputs.seed === key ? ' class="on"' : '') +
          ' data-seed="' + key + '">' + label + '</button>';
        return '<div class="rs-fld" style="margin-bottom:12px"><span>Seed</span>' +
          '<div class="rs-seg" id="apSeed">' +
          chip("real", "His table (real numbers)") +
          chip("aim", "The 28-crew aim: NJ 10 / PA 8 / MD 3 / CT 4 / MA 2 / VA 1") +
          '</div></div>';
      }

      /* One foreman = one truck per day (his own rule from Truck Economics), so the truck
         layout IS the foreman layout -- said out loud instead of leaving "where do the
         trucks go" to be inferred from a column meant for people. */
      function trucksByBaseNote(c) {
        const parts = c.perBase.filter(r => r.foremen > 0)
          .map(r => esc(r.st) + " " + r.foremen).join(" / ");
        return '<div class="ap-note" style="margin-top:10px">Trucks by base @ plan ' +
          '(a foreman needs a truck): <b>' + parts + ' = ' + c.totForemen + '</b> vs ' +
          fmtN((model.fleet || {}).owned_trucks) + ' in the whole vehicles register -- the ' +
          'paid-for operating fleet is smaller (sold/damaged units stay on the register); ' +
          'Truck Economics has the working count and the rent-vs-buy math.</div>';
      }

      function assumptionsHtml() {
        return '<div class="ap-assume">' +
          [["utilization", "Utilization of the ceiling, %",
            "measured " + esc(P.label) + ": " + n1(P.measuredUtil * 100) + "% (" +
            fmtN(P.M.jobs) + " jobs done vs foremen × " + DAYS_PER_MONTH + " days)"],
           ["leadsPerRep", "Leads one salesperson handles / month",
            "measured " + esc(P.label) + ": " + (P.M.leadsPerRep || "—") + " median"],
           ["dollarsPerLead", "Marketing $ per lead",
            "measured " + esc(P.label) + ": " +
            (P.M.dollarsPerLead ? "$" + n1(P.M.dollarsPerLead) : "—")]]
          .map(([k, label, note]) =>
            '<div><div class="l">' + label + '</div>' +
            '<input class="rs-num" style="width:92px" data-k="' + k + '" type="number" ' +
            'min="0" step="0.1" value="' + inputs[k] + '">' +
            '<div class="m">' + note + '</div></div>').join("") + '</div>';
      }

      function demandHtml() {
        const states = Object.keys(P.S)
          .sort((a, b) => (P.S[b].leads || 0) - (P.S[a].leads || 0))
          .filter(st => (P.S[st].leads || 0) + ((P.Sprev[st] || {}).leads || 0) >= 20);
        const byCounty = {};
        rows.forEach(r => {
          if (!P.yms.includes(r.ym)) return;
          const c = (byCounty[r.state] = byCounty[r.state] || {});
          const v = c[r.county] = c[r.county] || { leads: 0, lost: 0 };
          v.leads += num(r.leads); v.lost += num(r.lost);
        });
        return '<table class="rs-table"><thead><tr><th>State</th>' +
          '<th class="num">' + esc(P.prevLabel) + '</th>' +
          '<th class="num">' + esc(P.label) + '</th>' +
          '<th class="num">Conversion, then → now</th><th class="num">Lost</th>' +
          '<th>Top counties (leads · lost)</th>' +
          '<th>Where it leaks (lost of leads)</th>' +
          '</tr></thead><tbody>' +
          states.map(st => {
            const a = P.Sprev[st] || {}, b = P.S[st] || {};
            const dl = (a.leads && b.leads) ? (b.leads - a.leads) / a.leads : null;
            const convDown = (b.conversion || 0) < (a.conversion || 0);
            const cs = Object.entries(byCounty[st] || {});
            const counties = cs.slice()
              .sort((x, y) => y[1].leads - x[1].leads).slice(0, 4)
              .map(([c, v]) => esc(c) + " " + v.leads + " · " + v.lost).join("   ");
            /* ranked by LOST -- where the leak actually is; top-by-leads hides a county
               that loses most of a smaller volume */
            const leaks = cs.slice()
              .sort((x, y) => y[1].lost - x[1].lost).slice(0, 4)
              .map(([c, v]) => esc(c) + " " + v.lost + " of " + v.leads).join("   ");
            return '<tr><td class="strong">' + esc(st) + '</td>' +
              '<td class="num dim">' + fmtN(a.leads) + ' → ' + fmtN(a.booked) + '</td>' +
              '<td class="num"><b>' + fmtN(b.leads) + '</b>' +
                (dl == null ? '' : ' <span class="' + (dl >= 0 ? 'ap-good' : 'ap-bad') +
                 '" style="font-size:12px">' + (dl >= 0 ? '+' : '') + Math.round(dl * 100) +
                 '%</span>') + ' → ' + fmtN(b.booked) + '</td>' +
              '<td class="num ' + (convDown ? 'ap-bad' : 'ap-good') + '">' + pct(a.conversion) +
                ' → ' + pct(b.conversion) + '</td>' +
              '<td class="num ap-bad"><b>' + fmtN(b.lost) + '</b></td>' +
              '<td class="ap-towns">' + counties + '</td>' +
              '<td class="ap-towns">' + leaks + '</td></tr>';
          }).join("") + '</tbody></table>';
      }

      const R = model.research || {};
      const researchHtml = R.states ?
        '<table class="rs-table"><thead><tr><th>Area</th>' +
        '<th class="num">Qualified (period)</th>' +
        '<th>The outside case</th>' +
        '<th>Marketing target towns</th>' +
        '<th class="num">Yard $/mo</th><th class="num">3BR move · crew/hr</th>' +
        '</tr></thead><tbody>' +
        Object.entries(R.states).map(([st, v]) => {
          const comp = (R.competitors || {})[st];
          return '<tr><td class="strong">' + esc(st) + '</td>' +
            '<td class="num" id="apRq-' + st + '">…</td>' +
            '<td style="font-size:13px">' + esc(v.case) + '</td>' +
            '<td class="ap-towns">' + esc(v.towns) + '</td>' +
            '<td class="num">' + (((R.depots || {})[st]) ? money(R.depots[st]) : '—') + '</td>' +
            '<td class="num">' + (comp ? money(comp[0]) + ' · ' + money(comp[1]) : '—') +
            '</td></tr>';
        }).join("") + '</tbody></table>' +
        '<div class="ap-note" style="margin-top:10px">' + esc(R.vintage || "") +
        '. Licensing per state (a real gate on DE/CT/MA expansion) is in the memo.</div>' : "";

      const tc = model.truck_costs_by_year || {};
      const trucksHtml =
        '<table class="rs-table" style="max-width:560px"><thead><tr><th>Year</th>' +
        '<th class="num">Rental</th><th class="num">Financing</th>' +
        '<th class="num">Repair</th></tr></thead><tbody>' +
        Object.entries(tc).map(([y, b]) =>
          '<tr><td class="strong">' + y + (y === "2026" ? " (to Aug)" : "") + '</td>' +
          '<td class="num">' + money(b.rental) +
          '</td><td class="num">' + money(b.financing) +
          '</td><td class="num">' + money(b.repair) + '</td></tr>'
        ).join("") + '</tbody></table>' +
        '<div class="ap-note" style="margin-top:10px">Owned fleet <b>' +
        fmtN((model.fleet || {}).owned_trucks) + '</b> · insurance <b>' +
        money((model.fleet || {}).insurance_yearly_total) + '/yr</b> · parking <b>' +
        money((model.fleet || {}).parking_monthly_total) +
        '/mo</b> — the whole vehicles register, sold and damaged units included; the ' +
        'paid-for month-by-month fleet (smaller) and the per-day economics live on ' +
        'Truck Economics.</div>' +
        (function (t) {
          if (!t) return "";
          return '<div class="ap-callout"><b>The +2 answer, priced from live market ' +
            'research:</b> a used 26-ft box truck runs <b>' + money(t.used_low) + '–' +
            money(t.used_high) + '</b> (typical ' + money(t.used_typical) +
            '; fleet sell-offs ~' + money(t.selloff_typical) + '). All-in, one more owned ' +
            'truck ≈ <b>$' + t.owned_truck_year_allin + '/yr</b>. Against a ~$140k/yr rental ' +
            'run-rate, <b>two owned trucks displace renting at better than 2:1</b>.<br>' +
            '<b>Spec:</b> ' + esc(t.gvwr_note) + '<br><b>Live candidate:</b> ' +
            esc(t.local_candidate) + '.</div>';
        })(R.trucks);

      const card = (eyebrow, h, sub, body) =>
        '<div class="panel"><div class="ap-eyebrow">' + eyebrow + '</div>' +
        '<div class="panel-title">' + h + '</div>' +
        (sub ? '<div class="rs-hint">' + sub + '</div>' : '') + body + '</div>';

      function paint() {
        recalcPeriod();
        const c = calc();
        host.innerHTML =
          periodBar() +
          '<div class="rs-kpis" id="apHero">' + heroHtml(c) + '</div>' +
          card("The plan", "Base capacity — foremen today, plus the additions being " +
               "considered",
               "Your real numbers. NY is covered from the NJ base. Change any cell; the " +
               "tiles above follow. Edits stay in this browser.",
               seedChipsHtml() + assumptionsHtml() +
               '<div id="apBase" style="overflow-x:auto">' + baseHtml(c) + '</div>' +
               trucksByBaseNote(c)) +
          card("The demand", esc(P.label) + " vs " + esc(P.prevLabel),
               "Leads counted where the move starts, on create date. Lost = qualified and " +
               "never booked.",
               '<div style="overflow-x:auto">' + demandHtml() + '</div>') +
          (researchHtml ? card("The outside picture",
               "Big houses and good areas, joined to our own demand",
               "Research compiled by us — the gap between the outside case and our own " +
               "leads is the expansion argument.",
               '<div style="overflow-x:auto">' + researchHtml + '</div>') : "") +
          card("Trucks", "Rent vs buy — as the company already lives it",
               "Both sides are real card history: the company rents AND finances purchases " +
               "today. Renting is climbing again in 2026 — that is the “+2” question.",
               trucksHtml) +
          card("Method", "What is measured and what is assumed", "",
               '<div class="ap-note" style="line-height:1.75">Measured: everything except ' +
               'the foreman counts and any number you type. His base table is the seed; NY ' +
               'is served from the NJ base, so rows are SERVICE AREAS. Utilization bridges ' +
               'foremen to a month of jobs and re-seeds when you change the period — typing ' +
               'your own value overrides it. Lost = qualified, never booked. Geography is ' +
               'where the move starts. Marketing $/lead is company-wide. MD counts Tuji and ' +
               'Zip together; MD/VA seed at zero in his table — the 28-crew aim chip ' +
               'fills them.</div>');
        // the research table's qualified column follows the period
        Object.keys(R.states || {}).forEach(st => {
          const el = document.getElementById("apRq-" + st);
          if (el) el.textContent = fmtN((P.S[st] || {}).qualified || 0);
        });
        // wire the period selects — the kit's localSelect, never a native dropdown
        const f = document.getElementById("apFrom"), t = document.getElementById("apTo");
        if (f && t) {
          const ymVals = allYms.map(m => ({ v: m, l: ymLabel(m) }));
          let fSel, tSel;
          const onSel = () => {
            const fv = fSel.get(), tv = tSel.get();
            inputs.from = fv <= tv ? fv : tv;
            inputs.to = fv <= tv ? tv : fv;
            inputs.utilization = null; inputs.leadsPerRep = null;
            inputs.dollarsPerLead = null;      // re-seed from the new period
            save(); paint();
          };
          fSel = RSC.localSelect(f, { label: "From", values: ymVals,
            value: inputs.from, required: true, onChange: onSel });
          tSel = RSC.localSelect(t, { label: "To", values: ymVals,
            value: inputs.to, required: true, onChange: onSel });
        }
        host.querySelectorAll("#apSeed button").forEach(b => b.onclick = () => {
          const k = b.dataset.seed;
          if (k === inputs.seed) return;
          const aim = model.crew_aim || AIM_FALLBACK;
          BASES.forEach(bb => {
            inputs.bases[bb.st] = k === "aim"
              ? { cur: num(aim[bb.st]) || 0, add: 0 }
              : { cur: bb.cur, add: bb.add };
          });
          inputs.seed = k;
          save(); paint();
        });
        host.querySelectorAll("#apPeriod button").forEach(b => b.onclick = () => {
          inputs.from = b.dataset.from; inputs.to = b.dataset.to;
          inputs.utilization = null; inputs.leadsPerRep = null;
          inputs.dollarsPerLead = null;
          save(); paint();
        });
      }

      function save() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {}
      }

      paint();

      host.addEventListener("input", e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains("rs-num")) return;
        if (t.dataset.st) {
          inputs.bases[t.dataset.st][t.dataset.f] = parseFloat(t.value) || 0;
          if (inputs.seed !== "custom") {
            inputs.seed = "custom";
            host.querySelectorAll("#apSeed button").forEach(b => b.classList.remove("on"));
          }
        }
        else if (t.dataset.k) inputs[t.dataset.k] = parseFloat(t.value) || 0;
        save();
        const c = calc();
        document.getElementById("apHero").innerHTML = heroHtml(c);
        const tbl = document.getElementById("apBase");
        c.perBase.forEach((r, i) => {
          const row = tbl.querySelectorAll("tbody tr")[i];
          if (!row) return;
          const cells = row.querySelectorAll("td");
          cells[3].innerHTML = "<b>" + r.foremen + "</b>";
          cells[5].textContent = fmtN(r.jobs);
          cells[7].textContent = fmtN(r.leadsNeeded);
          cells[9].innerHTML = r.gap == null
            ? '<span class="rs-pill bad">no measured demand</span>'
            : r.gap > 0.1
              ? '<span class="rs-pill warn">+' + Math.round(r.gap * 100) + '% vs ' +
                esc(P.label) + '</span>'
              : '<span class="rs-pill ok">covered</span>';
        });
      });
    });
  },
});
})();
