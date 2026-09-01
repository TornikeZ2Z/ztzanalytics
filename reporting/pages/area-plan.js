/* The Area Plan, v4 — rebuilt from zero (his ask, 2026-09-01: "finalize the area part…
 * start from 0") for the September conversation with Giga.
 *
 * WHAT CARRIED OVER UNTOUCHED: the data contracts (mart_area_plan + the model payload),
 * his base table as the seed, the 28-crew aim chip, and the CALCULATION ENGINE —
 * aggStates / aggMeasured / recalcPeriod / calc are the audited math (measured
 * utilization pinned to the REAL table, seeds re-seeding per period, YoY = same months
 * minus one year). Only the presentation started over.
 *
 * THE NEW STORY, in the order the meeting runs:
 *   1. one control row — period + which plan is on the table (his real numbers / the aim);
 *   2. THE HERO — the decision numbers as one connected strip: foremen → jobs → leads →
 *      salespeople, with marketing and trucks beside them, and the three dials
 *      (utilization, leads/rep, $/lead) directly underneath where they belong;
 *   3. demand as per-state BARS (booked inside leads, lost as the amber count) instead of
 *      a number wall;
 *   4. the editable plan table with its demand-check pills and the trucks-by-base line;
 *   5. WHERE IT LEAKS — the top county leaks in the portal's share-bar language;
 *   6. the outside picture as cards, with NY's aim-tension said out loud;
 *   7. rent-vs-buy, then the method footnote.
 *
 * localStorage moves to ztzAreaPlan.v4 — the audit flagged that a stale v3 blob could
 * silently override corrected seeds; a fresh key means everyone opens on the intended
 * defaults once.
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
    /* v4 (ap2-): only what the kit cannot say. */
    .ap2-ctl{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:0 0 14px}
    .ap2-warn{font-size:12px;color:var(--warn);font-weight:700}
    /* the hero: decision numbers as one connected strip */
    .ap2-hero{padding:20px 22px 16px}
    .ap2-flow{display:flex;gap:0;align-items:stretch;flex-wrap:wrap}
    .ap2-step{flex:1 1 130px;min-width:128px;padding:2px 18px 2px 0;position:relative}
    .ap2-step + .ap2-step{padding-left:18px;border-left:1px solid var(--line-2)}
    .ap2-step .l{font-size:10px;color:var(--faint);font-weight:800;text-transform:uppercase;
      letter-spacing:.08em;white-space:nowrap}
    .ap2-step .v{font-size:30px;font-weight:800;letter-spacing:-.8px;line-height:1.15;
      margin-top:4px;font-variant-numeric:tabular-nums}
    .ap2-step .v.warn{color:var(--warn)} .ap2-step .v.good{color:var(--brand)}
    .ap2-step .s{font-size:11px;color:var(--faint);margin-top:3px;line-height:1.45}
    .ap2-dials{display:flex;gap:28px;flex-wrap:wrap;margin-top:16px;padding-top:14px;
      border-top:1px solid var(--line-2)}
    .ap2-dial .l{font-size:10.5px;font-weight:800;letter-spacing:.06em;
      text-transform:uppercase;color:var(--muted);margin-bottom:5px}
    .ap2-dial .m{font-size:11.5px;color:var(--faint);margin-top:4px;max-width:250px;
      line-height:1.45}
    /* demand: booked inside leads, per state */
    .ap2-dem{display:grid;grid-template-columns:minmax(120px,170px) minmax(80px,1fr) auto;
      gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)}
    .ap2-dem:last-child{border-bottom:0}
    .ap2-dem .n{font-weight:700;font-size:13.5px}
    .ap2-dem .n small{display:block;font-weight:600;font-size:11px;color:var(--faint)}
    .ap2-dem .t{height:14px;background:var(--panel-2);border-radius:7px;overflow:hidden;
      position:relative}
    .ap2-dem .t .lead{position:absolute;inset:0 auto 0 0;
      background:color-mix(in srgb,var(--brand) 26%,var(--panel-2));border-radius:7px}
    .ap2-dem .t .book{position:absolute;inset:0 auto 0 0;background:var(--brand);
      border-radius:7px}
    .ap2-dem .v{font-size:12.5px;color:var(--muted);text-align:right;white-space:nowrap;
      font-variant-numeric:tabular-nums}
    .ap2-dem .v b{color:var(--ink)}
    .ap2-yoy{font-weight:800;font-size:11.5px}
    .ap2-yoy.up{color:var(--pos)} .ap2-yoy.dn{color:var(--neg)}
    .ap2-lost{color:var(--warn);font-weight:800}
    /* the leak rows share the reviews-cases bar language */
    .ap2-leak{display:grid;grid-template-columns:minmax(150px,240px) minmax(60px,1fr) auto;
      gap:10px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line-2)}
    .ap2-leak:last-child{border-bottom:0}
    .ap2-leak .n{font-size:13px;font-weight:600}
    .ap2-leak .n small{color:var(--faint);font-weight:700;margin-left:6px}
    .ap2-leak .t{height:10px;background:var(--panel-2);border-radius:5px;overflow:hidden}
    .ap2-leak .t i{display:block;height:100%;background:var(--warn);border-radius:5px}
    .ap2-leak .v{font-size:12.5px;color:var(--muted);text-align:right;white-space:nowrap;
      font-variant-numeric:tabular-nums}
    /* the outside picture as cards */
    .ap2-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
    .ap2-card{border:1px solid var(--line);border-radius:12px;padding:14px 16px;
      background:var(--panel)}
    .ap2-card.hot{border-color:var(--warn)}
    .ap2-card h5{margin:0 0 6px;font-size:14px;font-weight:800;display:flex;gap:8px;
      align-items:baseline}
    .ap2-card .case{font-size:12.5px;line-height:1.6;color:var(--ink)}
    .ap2-card .towns{font-size:12px;color:var(--muted);margin-top:7px;line-height:1.5}
    .ap2-card .foot{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--faint);
      margin-top:9px;padding-top:8px;border-top:1px solid var(--line-2);
      font-variant-numeric:tabular-nums}
    .ap2-tension{font-size:11.5px;color:var(--warn);font-weight:700;margin-top:7px}
    .ap2-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.08em;
      text-transform:uppercase;color:var(--muted);margin-bottom:3px}
    .ap2-eyebrow + .panel-title{margin-bottom:5px}
    .ap2-note{font-size:12.5px;color:var(--muted);line-height:1.6}
    .ap2-callout{background:color-mix(in srgb,var(--brand-d) 7%,transparent);
      border:1px solid color-mix(in srgb,var(--brand-d) 30%,transparent);border-radius:12px;
      padding:14px 16px;font-size:13px;line-height:1.65;margin-top:12px}
    `;
    document.head.appendChild(st);
  }

  const LS_KEY = "ztzAreaPlan.v4";
  // HIS TABLE (2026-08-19): FOREMAN QUANTITY per base + the additions being considered.
  // NY is served FROM the NJ base — rows are SERVICE AREAS, not garages.
  const BASES = [
    { st: "NJ", cur: 11, add: 2, note: "also covers NY" },
    { st: "PA", cur: 8,  add: 2, note: "" },
    { st: "NY", cur: 3,  add: 3, note: "served from NJ" },
    { st: "DE", cur: 3,  add: 3, note: "" },
    { st: "CT", cur: 5,  add: 2, note: "" },
    { st: "MA", cur: 0,  add: 0, note: "" },
    { st: "MD", cur: 0,  add: 0, note: "Tuji + Zip in the aim" },
    { st: "VA", cur: 0,  add: 0, note: "a stated bet — no demand" },
  ];
  const AIM_FALLBACK = { NJ: 10, PA: 8, MD: 3, CT: 4, MA: 2, VA: 1 };
  const DAYS_PER_MONTH = 30;

registerPage({
  id: "area-plan",
  group: "different",
  title: "Area Plan",
  subtitle: "The September conversation on one page: what each area did, what the plan " +
            "on the table implies for sales, marketing and trucks, and where the leads leak.",
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
        /* MEASURED means measured: the jobs done in the period were done by his REAL
           foreman table, so the denominator is the BASES constants — never the edited
           cells (loading the aim must not re-measure history against a fleet that did
           not do the work). */
        const realForemen = BASES.reduce((a, b) => a + b.cur, 0);
        P.measuredUtil = (realForemen && P.yms.length)
          ? P.M.jobs / (realForemen * DAYS_PER_MONTH * P.yms.length) : 0.34;
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

      /* ================= the sections, in the meeting's order ================= */

      function controlBar() {
        const chip = (label, from, to) =>
          '<button' + (inputs.from === from && inputs.to === to ? ' class="on"' : "") +
          ' data-from="' + from + '" data-to="' + to + '">' + label + "</button>";
        const l3from = allYms[Math.max(0, allYms.indexOf(lastSettled) - 2)] || lastSettled;
        const seedChip = (key, label) =>
          '<button' + (inputs.seed === key ? ' class="on"' : "") +
          ' data-seed="' + key + '">' + label + "</button>";
        return '<div class="ap2-ctl">' +
          '<div class="rs-fld"><span>Period</span><div class="rs-seg" id="apPeriod">' +
          chip("Sep 2025", "2025-09", "2025-09") +
          chip("Sep 2024", "2024-09", "2024-09") +
          chip("Last 3 months", l3from, lastSettled) +
          chip("This year", lastSettled.slice(0, 4) + "-01", lastSettled) +
          "</div></div>" +
          '<div id="apFrom"></div><div id="apTo"></div>' +
          '<div class="rs-fld"><span>Plan</span><div class="rs-seg" id="apSeed">' +
          seedChip("real", "His table") +
          seedChip("aim", "The 28-crew aim") +
          "</div></div>" +
          '<div class="rs-spacer"></div>' +
          '<span class="ap2-note">vs <b>' + esc(P.prevLabel) + "</b>" +
          (P.provisional ? ' · <span class="ap2-warn">recent months still settling — ' +
            "lost counts provisional</span>" : "") + "</span></div>";
      }

      function heroHtml(c) {
        const step = (l, v, s, cls) =>
          '<div class="ap2-step"><div class="l">' + l + '</div>' +
          '<div class="v' + (cls ? " " + cls : "") + '">' + v + "</div>" +
          '<div class="s">' + s + "</div></div>";
        const owned = (model.fleet || {}).owned_trucks || 0;
        return '<div class="panel ap2-hero"><div class="ap2-flow">' +
          step(inputs.seed === "aim" ? "Aim foremen" : "Planned foremen", c.totForemen,
               inputs.seed === "aim" ? "the 28-crew aim (a maximum)"
                 : "+" + (c.totForemen - c.totCur) + " on top of " + c.totCur + " today") +
          step("Jobs in " + esc(P.label), fmtN(c.totJobs),
               "at " + n1(c.util * 100) + "% of the 30/day ceiling") +
          step("Leads needed", fmtN(c.totLeads), "via each area's own conversion") +
          step("Salespeople", n1(c.salesNeeded),
               "at " + fmtN(num(inputs.leadsPerRep)) + " leads/rep/month") +
          step("Marketing / month", money(c.marketing),
               "at " + money(num(inputs.dollarsPerLead)) + " per lead") +
          step("Trucks", c.totForemen + " vs " + fmtN(owned),
               "a foreman needs a truck — the whole register; rent-vs-buy below",
               c.totForemen > owned ? "warn" : "good") +
          "</div>" +
          '<div class="ap2-dials">' + dialsHtml() + "</div></div>";
      }

      function dialsHtml() {
        return [["utilization", "Utilization of the ceiling, %",
            "measured " + esc(P.label) + ": " + n1(P.measuredUtil * 100) + "% (" +
            fmtN(P.M.jobs) + " jobs vs his real foremen × " + DAYS_PER_MONTH + " days)"],
           ["leadsPerRep", "Leads one salesperson handles / month",
            "measured " + esc(P.label) + ": " + (P.M.leadsPerRep || "—") + " median"],
           ["dollarsPerLead", "Marketing $ per lead",
            "measured " + esc(P.label) + ": " +
            (P.M.dollarsPerLead ? "$" + n1(P.M.dollarsPerLead) : "—")]]
          .map(([k, label, note]) =>
            '<div class="ap2-dial"><div class="l">' + label + "</div>" +
            '<input class="rs-num" style="width:92px" data-k="' + k + '" type="number" ' +
            'min="0" step="0.1" value="' + inputs[k] + '">' +
            '<div class="m">' + note + "</div></div>").join("");
      }

      function demandHtml() {
        const states = Object.keys(P.S)
          .sort((a, b) => (P.S[b].leads || 0) - (P.S[a].leads || 0))
          .filter(st => (P.S[st].leads || 0) + ((P.Sprev[st] || {}).leads || 0) >= 20);
        const max = Math.max(1, ...states.map(st => P.S[st].leads || 0));
        return states.map(st => {
          const a = P.Sprev[st] || {}, b = P.S[st] || {};
          const dl = (a.leads && b.leads) ? (b.leads - a.leads) / a.leads : null;
          return '<div class="ap2-dem">' +
            '<span class="n">' + esc(st) +
              "<small>" + pct(a.conversion) + " → " + pct(b.conversion) + " conv</small></span>" +
            '<span class="t">' +
              '<i class="lead" style="width:' + (b.leads / max * 100) + '%"></i>' +
              '<i class="book" style="width:' + (b.booked / max * 100) + '%"></i></span>' +
            '<span class="v"><b>' + fmtN(b.leads) + "</b> leads " +
              (dl == null ? "" : '<span class="ap2-yoy ' + (dl >= 0 ? "up" : "dn") + '">' +
                (dl >= 0 ? "+" : "") + Math.round(dl * 100) + "%</span> ") +
              "→ <b>" + fmtN(b.booked) + "</b> booked · " +
              '<span class="ap2-lost">' + fmtN(b.lost) + " lost</span></span></div>";
        }).join("");
      }

      function planHtml(c) {
        return '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>' +
          '<th>Base / area</th><th class="num">Foreman quantity</th>' +
          '<th class="num">Additional foremen</th>' +
          '<th class="num">Planned</th><th class="num">Jobs done (' + esc(P.label) + ')</th>' +
          '<th class="num">Jobs @ plan</th><th class="num">Conversion</th>' +
          '<th class="num">Leads needed</th>' +
          '<th class="num">Qualified (' + esc(P.label) + ')</th>' +
          '<th class="num">Demand check</th>' +
          "</tr></thead><tbody>" +
          c.perBase.map(r =>
            '<tr><td class="strong">' + esc(r.st) +
              (r.note ? '<div class="ap2-note">' + esc(r.note) + "</div>" : "") + "</td>" +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="cur" ' +
              'type="number" min="0" step="1" value="' + r.cur + '"></td>' +
            '<td class="num"><input class="rs-num" data-st="' + r.st + '" data-f="add" ' +
              'type="number" min="0" step="1" value="' + r.add + '"></td>' +
            '<td class="num"><b>' + r.foremen + "</b></td>" +
            '<td class="num muted">' + fmtN(r.done) + "</td>" +
            '<td class="num">' + fmtN(r.jobs) + "</td>" +
            '<td class="num">' + pct(r.conv) + ((P.S[r.st] || {}).conversion == null ?
              '<span class="ap2-note"> (national)</span>' : "") + "</td>" +
            '<td class="num">' + fmtN(r.leadsNeeded) + "</td>" +
            '<td class="num">' + fmtN(r.had) + "</td>" +
            '<td class="num">' + (r.gap == null
              ? '<span class="rs-pill bad">no measured demand</span>'
              : r.gap > 0.1
                ? '<span class="rs-pill warn">+' + Math.round(r.gap * 100) +
                  "% vs " + esc(P.label) + "</span>"
                : '<span class="rs-pill ok">covered</span>') + "</td></tr>"
          ).join("") + "</tbody></table></div>" + trucksByBase(c);
      }
      function trucksByBase(c) {
        const parts = c.perBase.filter(r => r.foremen > 0)
          .map(r => esc(r.st) + " " + r.foremen).join(" / ");
        return '<div class="ap2-note" id="apTrucksNote" style="margin-top:10px">Trucks by base @ plan ' +
          "(a foreman needs a truck): <b>" + parts + " = " + c.totForemen + "</b> vs " +
          fmtN((model.fleet || {}).owned_trucks) + " in the whole vehicles register — the " +
          "paid-for operating fleet is smaller; Truck Economics has the working count.</div>";
      }

      function leakHtml() {
        const byCounty = {};
        rows.forEach(r => {
          if (!P.yms.includes(r.ym)) return;
          const k = r.state + "|" + r.county;
          const v = byCounty[k] = byCounty[k] || { st: r.state, c: r.county, leads: 0, lost: 0 };
          v.leads += num(r.leads); v.lost += num(r.lost);
        });
        const top = Object.values(byCounty)
          .filter(v => v.lost >= 5 && String(v.c || "").trim() && v.c !== "—")
          .sort((a, b) => b.lost - a.lost).slice(0, 10);
        const max = Math.max(1, ...top.map(v => v.lost));
        return top.length ? top.map(v =>
          '<div class="ap2-leak"><span class="n">' + esc(v.c) +
            "<small>" + esc(v.st) + "</small></span>" +
          '<span class="t"><i style="width:' + (v.lost / max * 100) + '%"></i></span>' +
          '<span class="v"><b>' + fmtN(v.lost) + "</b> of " + fmtN(v.leads) +
            " leads lost</span></div>").join("")
          : '<p class="rs-hint">No county-level losses in this window.</p>';
      }

      const R = model.research || {};
      function researchHtml(c) {
        if (!R.states) return "";
        const planned = Object.fromEntries(c.perBase.map(r => [r.st, r.foremen]));
        return '<div class="ap2-cards">' +
          Object.entries(R.states).map(([st, v]) => {
            const comp = (R.competitors || {})[st];
            const hot = /unmined|strongest/i.test(String(v.case || "")) &&
                        !(planned[st] > 0);
            return '<div class="ap2-card' + (hot ? " hot" : "") + '"><h5>' + esc(st) +
              ' <span class="rs-pill">' + fmtN((P.S[st] || {}).qualified || 0) +
              " qualified · " + esc(P.label) + "</span></h5>" +
              '<div class="case">' + esc(v.case) + "</div>" +
              '<div class="towns">' + esc(v.towns) + "</div>" +
              (hot ? '<div class="ap2-tension">The aim sends this area 0 crews — the ' +
                "strongest outside case on the board is unstaffed.</div>" : "") +
              '<div class="foot"><span>yard ' +
              (((R.depots || {})[st]) ? money(R.depots[st]) + "/mo" : "—") + "</span>" +
              "<span>3BR move " + (comp ? money(comp[0]) : "—") + "</span>" +
              "<span>crew " + (comp ? money(comp[1]) + "/hr" : "—") + "</span></div></div>";
          }).join("") + "</div>" +
          '<div class="ap2-note" style="margin-top:10px">' + esc(R.vintage || "") +
          ". Licensing per state (a real gate on MD/VA/CT/MA expansion) is in the memo.</div>";
      }

      function trucksHtml() {
        const tc = model.truck_costs_by_year || {};
        const t = R.trucks;
        return '<div class="rs-tablewrap"><table class="rs-table" style="max-width:560px">' +
          "<thead><tr><th>Year</th>" +
          '<th class="num">Rental</th><th class="num">Financing</th>' +
          '<th class="num">Repair</th></tr></thead><tbody>' +
          Object.entries(tc).map(([y, b]) =>
            '<tr><td class="strong">' + y + (y === "2026" ? " (to Aug)" : "") + "</td>" +
            '<td class="num">' + money(b.rental) +
            '</td><td class="num">' + money(b.financing) +
            '</td><td class="num">' + money(b.repair) + "</td></tr>"
          ).join("") + "</tbody></table></div>" +
          '<div class="ap2-note" style="margin-top:10px">Owned fleet <b>' +
          fmtN((model.fleet || {}).owned_trucks) + "</b> · insurance <b>" +
          money((model.fleet || {}).insurance_yearly_total) + "/yr</b> · parking <b>" +
          money((model.fleet || {}).parking_monthly_total) +
          "/mo</b> — the whole vehicles register, sold and damaged included; the " +
          "paid-for month-by-month fleet and per-day economics live on Truck Economics.</div>" +
          (t ? '<div class="ap2-callout"><b>The +2 answer, priced from live market ' +
            "research:</b> a used 26-ft box truck runs <b>" + money(t.used_low) + "–" +
            money(t.used_high) + "</b> (typical " + money(t.used_typical) +
            "; fleet sell-offs ~" + money(t.selloff_typical) + "). All-in, one more owned " +
            "truck ≈ <b>$" + t.owned_truck_year_allin + "/yr</b>. Against a ~$140k/yr rental " +
            "run-rate, <b>two owned trucks displace renting at better than 2:1</b>.<br>" +
            "<b>Spec:</b> " + esc(t.gvwr_note) + "<br><b>Live candidate:</b> " +
            esc(t.local_candidate) + ".</div>" : "");
      }

      const card = (eyebrow, h, sub, body) =>
        '<div class="panel"><div class="ap2-eyebrow">' + eyebrow + "</div>" +
        '<div class="panel-title">' + h + "</div>" +
        (sub ? '<div class="rs-hint">' + sub + "</div>" : "") + body + "</div>";

      /* ================= paint + wiring ================= */
      function paint() {
        recalcPeriod();
        const c = calc();
        host.innerHTML =
          controlBar() +
          '<div id="apHero">' + heroHtml(c) + "</div>" +
          card("The demand", esc(P.label) + " by area",
               "The full bar is leads (counted where the move starts, on create date); the " +
               "solid green inside it is what got booked. Lost = qualified, never booked.",
               '<div id="apDemand">' + demandHtml() + "</div>") +
          card("The plan", "Base capacity — foreman quantity, plus the additions",
               "Rows are service areas (NY is worked from the NJ base). Change any cell; " +
               "the hero follows. Edits stay in this browser.",
               '<div id="apBase" style="overflow-x:auto">' + planHtml(c) + "</div>") +
          card("Where it leaks", "The counties that lose the most",
               "Top county losses in " + esc(P.label) + " — where extra sales attention " +
               "or pricing would bite first.",
               '<div id="apLeak">' + leakHtml() + "</div>") +
          (R.states ? card("The outside picture",
               "Big houses and good areas, joined to our own demand",
               "Research compiled by us — the gap between the outside case and our own " +
               "numbers is the expansion argument.", researchHtml(c)) : "") +
          card("Trucks", "Rent vs buy — as the company already lives it",
               "Both sides are real card history: the company rents AND finances purchases " +
               "today. Renting is climbing again in 2026 — that is the “+2” question.",
               trucksHtml()) +
          card("Method", "What is measured and what is assumed", "",
               '<div class="ap2-note" style="line-height:1.75">Measured: everything except ' +
               "the foreman counts and any number you type. His base table is the seed; " +
               "the 28-crew aim chip loads the brief's maximum; a hand edit makes the plan " +
               "custom. Utilization bridges foremen to a month of jobs and re-seeds when " +
               "the period changes — typing your own value overrides it. Lost = qualified, " +
               "never booked. Geography is where the move starts. Marketing $/lead is " +
               "company-wide. MD counts Tuji and Zip together; MD/VA seed at zero in his " +
               "table — the aim chip fills them.</div>");

        // period selects — the kit's localSelect, never a native dropdown
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
        host.querySelectorAll("#apPeriod button").forEach(b => b.onclick = () => {
          inputs.from = b.dataset.from; inputs.to = b.dataset.to;
          inputs.utilization = null; inputs.leadsPerRep = null;
          inputs.dollarsPerLead = null;
          save(); paint();
        });
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
      }

      function save() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {}
      }

      paint();

      /* live edits: the hero and the edited row repaint; the input keeps focus */
      host.addEventListener("input", e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains("rs-num")) return;
        if (t.dataset.st) {
          inputs.bases[t.dataset.st][t.dataset.f] = parseFloat(t.value) || 0;
          if (inputs.seed !== "custom") {
            inputs.seed = "custom";
            host.querySelectorAll("#apSeed button").forEach(b => b.classList.remove("on"));
          }
        } else if (t.dataset.k) inputs[t.dataset.k] = parseFloat(t.value) || 0;
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
              ? '<span class="rs-pill warn">+' + Math.round(r.gap * 100) + "% vs " +
                esc(P.label) + "</span>"
              : '<span class="rs-pill ok">covered</span>';
        });
        const note = document.getElementById("apTrucksNote");
        if (note) note.outerHTML = trucksByBase(c);
      });
    });
  },
});
})();
