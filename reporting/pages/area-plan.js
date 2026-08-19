/* The Area Plan — the September planning tool, v2.
 *
 * Tornike 2026-08-19, second pass: (1) "the visual part sucks" — redesigned: hero tiles, real
 * table styling, pills, breathing room. (2) The planning model is now BASES WITH COVERAGE,
 * not crews-per-state: a crew based in NJ can drive to NY, so the rows are service areas with
 * "max job capacity today" and "additional quantity" — HIS real current numbers as the seed
 * (NJ 11+2, PA 8+2, NY 3+3 served from the NJ base, DE 3+3, CT 5+2, MA 0+0). Both columns are
 * editable; sales, marketing and trucks recompute live; edits persist in this browser.
 *
 * The monthly bridge is an explicit, editable UTILIZATION: his numbers are per-DAY maximums,
 * and September's measured reality ran at ~34% of that ceiling — so planned September jobs =
 * daily capacity × 30 × utilization, with the measured seed shown beside the input. Hiding
 * that assumption inside a formula is how planning tools lie.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_plan) {
    RS.DATASETS.area_plan = {
      table: "mart_area_plan",
      cols: ["september", "company", "state", "county",
             "leads", "qualified", "lost", "booked", "total_cf"],
    };
  }
})();

(() => {
  function injectStyle() {
    if (document.getElementById("ap-style")) return;
    const st = document.createElement("style");
    st.id = "ap-style";
    st.textContent = `
    .ap-wrap{max-width:1280px;margin:0 auto}
    .ap-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;
      box-shadow:var(--shadow);padding:20px 22px;margin-bottom:18px}
    .ap-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;
      color:var(--muted);margin-bottom:2px}
    .ap-h{font-size:15px;font-weight:800;color:var(--ink);margin-bottom:4px}
    .ap-sub{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:12px}
    .ap-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}
    .ap-tile{background:var(--panel);border:1px solid var(--line);border-radius:14px;
      padding:14px 16px;box-shadow:var(--shadow)}
    .ap-tile .l{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
      color:var(--muted)}
    .ap-tile .v{font-size:24px;font-weight:850;color:var(--ink);margin-top:4px;
      letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.05}
    .ap-tile .s{font-size:10.5px;color:var(--muted);margin-top:3px}
    .ap-tbl{width:100%;border-collapse:collapse;font-size:13px;
      font-variant-numeric:tabular-nums}
    .ap-tbl th{padding:8px 10px;font-size:10px;font-weight:800;text-transform:uppercase;
      letter-spacing:.06em;color:var(--muted);border-bottom:2px solid var(--line);
      text-align:right;white-space:nowrap}
    .ap-tbl th:first-child{text-align:left}
    .ap-tbl td{padding:9px 10px;border-top:1px solid var(--line);text-align:right;
      vertical-align:middle}
    .ap-tbl td:first-child{text-align:left;font-weight:700}
    .ap-tbl tbody tr:nth-child(even){background:color-mix(in srgb,var(--line) 16%,transparent)}
    .ap-tbl tbody tr:hover{background:color-mix(in srgb,var(--brand-d) 6%,transparent)}
    .ap-left{text-align:left !important;font-weight:400 !important}
    .ap-good{color:var(--brand-d)} .ap-bad{color:var(--red)}
    .ap-warn{color:var(--warn,#a15c00)} .ap-dim{color:var(--muted)}
    .ap-num{width:66px;padding:6px 8px;border:1.5px solid var(--line);border-radius:9px;
      background:var(--panel);color:var(--ink);font-size:13.5px;font-weight:700;
      text-align:right;transition:border-color .12s}
    .ap-num:hover{border-color:var(--brand-d)}
    .ap-num:focus{outline:none;border-color:var(--brand-d);
      box-shadow:0 0 0 3px color-mix(in srgb,var(--brand-d) 18%,transparent)}
    .ap-pill{display:inline-block;border-radius:20px;padding:3px 10px;font-size:11px;
      font-weight:700;white-space:nowrap}
    .ap-pill.ok{background:color-mix(in srgb,var(--brand-d) 14%,transparent);
      color:var(--brand-d)}
    .ap-pill.warn{background:color-mix(in srgb,#a15c00 13%,transparent);
      color:var(--warn,#a15c00)}
    .ap-pill.bad{background:color-mix(in srgb,var(--red) 12%,transparent);color:var(--red)}
    .ap-pill.dim{background:color-mix(in srgb,var(--line) 45%,transparent);color:var(--muted)}
    .ap-note{font-size:11px;color:var(--muted)}
    .ap-assume{display:flex;gap:26px;flex-wrap:wrap;margin:2px 0 14px}
    .ap-assume .l{font-size:10.5px;font-weight:800;letter-spacing:.05em;
      text-transform:uppercase;color:var(--muted);margin-bottom:4px}
    .ap-assume .m{font-size:10.5px;color:var(--muted);margin-top:3px}
    .ap-callout{background:color-mix(in srgb,var(--brand-d) 7%,transparent);
      border:1px solid color-mix(in srgb,var(--brand-d) 30%,transparent);border-radius:12px;
      padding:12px 14px;font-size:12.5px;line-height:1.6;margin-top:12px}
    .ap-towns{font-size:11px;color:var(--muted);line-height:1.45}
    `;
    document.head.appendChild(st);
  }

  const LS_KEY = "ztzAreaPlan.v2";
  // HIS TABLE, verbatim (2026-08-19): service areas with today's real max jobs/day and the
  // addition being considered. NY is served FROM the NJ base — coverage, not relocation.
  const BASES = [
    { st: "NJ", cur: 11, add: 2, note: "9 foremen today; the base that also covers NY" },
    { st: "PA", cur: 8,  add: 2, note: "" },
    { st: "NY", cur: 3,  add: 3, note: "0 foremen based here — served from NJ" },
    { st: "DE", cur: 3,  add: 3, note: "" },
    { st: "CT", cur: 5,  add: 2, note: "" },
    { st: "MA", cur: 0,  add: 0, note: "" },
  ];
  const SEPT_DAYS = 30;

registerPage({
  id: "area-plan",
  group: "different",
  title: "Area Plan",
  subtitle: "September planning by base: today's real capacity, the additions being " +
            "considered, and what they imply for sales, marketing and trucks. Adjust " +
            "anything; everything follows.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const money = v => (v == null || isNaN(v)) ? "—" : RS.money(+v);
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";
    const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);

    injectStyle();
    host.innerHTML = '<div class="ap-card">Loading…</div>';

    return Promise.all([
      RS.load("area_plan"),
      ZTZ.api("/api/mart_area_plan_model?limit=1").then(
        j => JSON.parse(((j.rows || [])[0] || {}).payload || "null")).catch(() => null),
    ]).then(([rows, model]) => {
      if (!rows.length || !model) {
        host.innerHTML = '<div class="ap-card">The Area Plan mart has not been built yet — ' +
          'run sources=area-plan and reload.</div>';
        return;
      }

      const num = v => { const x = parseFloat(v); return isNaN(x) ? 0 : x; };
      const S24 = model.september_states["2024-09"] || {};
      const S25 = model.september_states["2025-09"] || {};
      const cap25 = (model.capacity || {})["2025-09"] || {};
      const sales25 = (model.sales || {})["2025-09"] || {};
      const mkt25 = (model.marketing || {})["2025-09"] || {};
      const natQual = Object.values(S25).reduce((a, s) => a + s.qualified, 0);
      const natBooked = Object.values(S25).reduce((a, s) => a + s.booked, 0);
      const natConv = natQual ? natBooked / natQual : 0.2;
      const natJobs25 = (cap25._national || {}).jobs || 0;

      // measured utilization: what September actually ran at, against HIS current ceiling
      const curDaily = BASES.reduce((a, b) => a + b.cur, 0);
      const measuredUtil = curDaily ? natJobs25 / (curDaily * SEPT_DAYS) : 0.34;

      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
        catch (e) { return {}; }
      })();
      const inputs = Object.assign({
        bases: Object.fromEntries(BASES.map(b => [b.st, { cur: b.cur, add: b.add }])),
        utilization: Math.round(measuredUtil * 1000) / 10,   // %
        leadsPerRep: sales25.leads_per_rep_median || 140,
        dollarsPerLead: mkt25.dollars_per_lead || 42,
      }, saved);
      BASES.forEach(b => {
        if (!inputs.bases[b.st]) inputs.bases[b.st] = { cur: b.cur, add: b.add };
      });

      function calc() {
        const util = num(inputs.utilization) / 100;
        const perBase = BASES.map(b => {
          const s = inputs.bases[b.st];
          const daily = num(s.cur) + num(s.add);
          const jobs = daily * SEPT_DAYS * util;
          const conv = (S25[b.st] || {}).conversion || natConv;
          const leadsNeeded = conv ? jobs / conv : 0;
          const had = (S25[b.st] || {}).qualified || 0;
          const done25 = (cap25[b.st] || {}).jobs || 0;
          return { ...b, cur: num(s.cur), add: num(s.add), daily, jobs, conv, leadsNeeded,
                   had, done25, gap: had ? leadsNeeded / had - 1 : null };
        });
        const totDaily = perBase.reduce((a, r) => a + r.daily, 0);
        const totCur = perBase.reduce((a, r) => a + r.cur, 0);
        const totJobs = perBase.reduce((a, r) => a + r.jobs, 0);
        const totLeads = perBase.reduce((a, r) => a + r.leadsNeeded, 0);
        return { perBase, totDaily, totCur, totJobs, totLeads, util,
                 salesNeeded: totLeads / Math.max(1, num(inputs.leadsPerRep)),
                 marketing: totLeads * num(inputs.dollarsPerLead),
                 truckGap: totDaily - ((model.fleet || {}).owned_trucks || 0) };
      }

      /* ---------------- hero tiles ---------------- */
      function heroHtml(c) {
        const t = (l, v, s, cls) =>
          '<div class="ap-tile"><div class="l">' + l + '</div><div class="v' +
          (cls ? " " + cls : "") + '">' + v + '</div><div class="s">' + s + '</div></div>';
        return t("Capacity today", c.totCur + "/day", "his real current numbers") +
          t("Planned", c.totDaily + "/day", "+" + (c.totDaily - c.totCur) + " additional") +
          t("September jobs", fmtN(c.totJobs), "at " + n1(c.util * 100) + "% utilization") +
          t("Leads needed", fmtN(c.totLeads), "via each area's conversion") +
          t("Salespeople", (Math.round(c.salesNeeded * 10) / 10),
            "at " + fmtN(num(inputs.leadsPerRep)) + " leads/rep") +
          t("Marketing / mo", money(c.marketing),
            "at " + money(num(inputs.dollarsPerLead)) + "/lead") +
          // NOT "+N trucks needed": the daily ceiling assumes every base peaks at once,
          // which even today's numbers never do -- the current 30/day ceiling runs on 19
          // owned trucks because rentals bridge the peaks. The honest tile is the ceiling
          // vs the fleet, with the priced +2 buy case living in the Trucks card below.
          t("Truck ceiling", c.totDaily + " vs " +
            fmtN((model.fleet || {}).owned_trucks) + " owned",
            "rentals bridge peaks today — the +2 buy case is below",
            c.truckGap > 0 ? "ap-warn" : "ap-good");
      }

      /* ---------------- the base plan (his table, editable) ---------------- */
      function baseHtml(c) {
        return '<table class="ap-tbl"><thead><tr>' +
          '<th>Base / area</th><th>Max jobs/day today</th><th>Additional</th>' +
          '<th>Planned/day</th><th>Sep-25 done/day</th><th>Sept jobs @ util</th>' +
          '<th>Conv.</th><th>Leads needed</th><th>Sep-25 qualified</th><th>Demand check</th>' +
          '</tr></thead><tbody>' +
          c.perBase.map(r =>
            '<tr><td>' + esc(r.st) +
              (r.note ? '<div class="ap-note">' + esc(r.note) + '</div>' : '') + '</td>' +
            '<td><input class="ap-num" data-st="' + r.st + '" data-f="cur" type="number" ' +
              'min="0" step="1" value="' + r.cur + '"></td>' +
            '<td><input class="ap-num" data-st="' + r.st + '" data-f="add" type="number" ' +
              'min="0" step="1" value="' + r.add + '"></td>' +
            '<td><b>' + r.daily + '</b></td>' +
            '<td class="ap-dim">' + n1(r.done25 / SEPT_DAYS) + '</td>' +
            '<td>' + fmtN(r.jobs) + '</td>' +
            '<td>' + pct(r.conv) + ((S25[r.st] || {}).conversion == null ?
              '<span class="ap-note"> (nat.)</span>' : '') + '</td>' +
            '<td>' + fmtN(r.leadsNeeded) + '</td>' +
            '<td>' + fmtN(r.had) + '</td>' +
            '<td>' + (r.gap == null
              ? '<span class="ap-pill bad">no measured demand</span>'
              : r.gap > 0.1
                ? '<span class="ap-pill warn">+' + Math.round(r.gap * 100) +
                  '% vs Sep-25</span>'
                : '<span class="ap-pill ok">covered by Sep-25</span>') + '</td></tr>'
          ).join("") + '</tbody></table>';
      }

      const assumptions =
        '<div class="ap-assume">' +
        [["utilization", "Utilization of max capacity, %",
          "measured Sep-25: " + n1(measuredUtil * 100) + "% (" + natJobs25 +
          " jobs vs a " + curDaily + "/day ceiling)"],
         ["leadsPerRep", "Leads one salesperson handles / month",
          "measured: " + (sales25.leads_per_rep_median || "—") + " median, Sep-25"],
         ["dollarsPerLead", "Marketing $ per lead",
          "measured: $" + (mkt25.dollars_per_lead || "—") + " Sep-25, $" +
          (((model.marketing || {})["2024-09"] || {}).dollars_per_lead || "—") + " Sep-24"]]
        .map(([k, label, note]) =>
          '<div><div class="l">' + label + '</div>' +
          '<input class="ap-num" style="width:88px" data-k="' + k + '" type="number" ' +
          'min="0" step="0.1" value="' + inputs[k] + '">' +
          '<div class="m">' + note + '</div></div>').join("") + '</div>';

      /* ---------------- September YoY ---------------- */
      const states = [...new Set([...Object.keys(S25), ...Object.keys(S24)])]
        .sort((a, b) => ((S25[b] || {}).leads || 0) - ((S25[a] || {}).leads || 0))
        .filter(st => ((S25[st] || {}).leads || 0) + ((S24[st] || {}).leads || 0) >= 20);
      const byCounty = {};
      rows.forEach(r => {
        if (r.september !== "2025-09") return;
        const c = (byCounty[r.state] = byCounty[r.state] || {});
        const v = c[r.county] = c[r.county] || { leads: 0, lost: 0 };
        v.leads += num(r.leads); v.lost += num(r.lost);
      });
      const picture =
        '<table class="ap-tbl"><thead><tr><th>State</th>' +
        '<th>Sep-24 leads → booked</th><th>Sep-25 leads → booked</th><th>Conv. 24→25</th>' +
        '<th>Lost (Sep-25)</th><th class="ap-left" style="text-align:left">Top counties ' +
        '(leads · lost)</th></tr></thead><tbody>' +
        states.map(st => {
          const a = S24[st] || {}, b = S25[st] || {};
          const dl = (a.leads && b.leads) ? (b.leads - a.leads) / a.leads : null;
          const convDown = (b.conversion || 0) < (a.conversion || 0);
          const counties = Object.entries(byCounty[st] || {})
            .sort((x, y) => y[1].leads - x[1].leads).slice(0, 4)
            .map(([c, v]) => esc(c) + " " + v.leads + " · " + v.lost).join("  ·  ");
          return '<tr><td>' + esc(st) + '</td>' +
            '<td>' + fmtN(a.leads) + ' → ' + fmtN(a.booked) + '</td>' +
            '<td><b>' + fmtN(b.leads) + '</b>' +
              (dl == null ? '' : ' <span class="' + (dl >= 0 ? 'ap-good' : 'ap-bad') +
               '" style="font-size:11px">' + (dl >= 0 ? '+' : '') + Math.round(dl * 100) +
               '%</span>') + ' → ' + fmtN(b.booked) + '</td>' +
            '<td class="' + (convDown ? 'ap-bad' : 'ap-good') + '">' + pct(a.conversion) +
              ' → ' + pct(b.conversion) + '</td>' +
            '<td class="ap-bad"><b>' + fmtN(b.lost) + '</b></td>' +
            '<td class="ap-left ap-towns">' + counties + '</td></tr>';
        }).join("") + '</tbody></table>';

      /* ---------------- the outside picture ---------------- */
      const R = model.research || {};
      const research = R.states ?
        '<table class="ap-tbl"><thead><tr><th>Area</th><th>Sep-25 qualified</th>' +
        '<th class="ap-left" style="text-align:left">The outside case</th>' +
        '<th class="ap-left" style="text-align:left">Marketing target towns</th>' +
        '<th>Yard $/mo</th><th>3BR move · crew/hr</th></tr></thead><tbody>' +
        Object.entries(R.states).map(([st, v]) => {
          const comp = (R.competitors || {})[st];
          return '<tr><td>' + esc(st) + '</td>' +
            '<td>' + fmtN((S25[st] || {}).qualified || 0) + '</td>' +
            '<td class="ap-left" style="font-size:12px">' + esc(v.case) + '</td>' +
            '<td class="ap-left ap-towns">' + esc(v.towns) + '</td>' +
            '<td>' + (((R.depots || {})[st]) ? money(R.depots[st]) : '—') + '</td>' +
            '<td>' + (comp ? money(comp[0]) + ' · ' + money(comp[1]) : '—') + '</td></tr>';
        }).join("") + '</tbody></table>' +
        '<div class="ap-note" style="margin-top:8px">' + esc(R.vintage || "") +
        '. Licensing per state (a real gate on DE/CT/MA expansion) is in the memo.</div>' : "";

      /* ---------------- trucks ---------------- */
      const tc = model.truck_costs_by_year || {};
      const trucks =
        '<table class="ap-tbl" style="max-width:520px"><thead><tr><th>Year</th>' +
        '<th>Rental</th><th>Financing</th><th>Repair</th></tr></thead><tbody>' +
        Object.entries(tc).map(([y, b]) =>
          '<tr><td>' + y + (y === "2026" ? " (Aug)" : "") + '</td><td>' + money(b.rental) +
          '</td><td>' + money(b.financing) + '</td><td>' + money(b.repair) + '</td></tr>'
        ).join("") + '</tbody></table>' +
        '<div class="ap-note" style="margin-top:8px">Owned fleet <b>' +
        fmtN((model.fleet || {}).owned_trucks) + '</b> · insurance <b>' +
        money((model.fleet || {}).insurance_yearly_total) + '/yr</b> · parking <b>' +
        money((model.fleet || {}).parking_monthly_total) + '/mo</b></div>' +
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
        })((model.research || {}).trucks);

      /* ---------------- honesty ---------------- */
      const honesty =
        '<div class="ap-note" style="line-height:1.7">Measured: everything except the ' +
        'capacity numbers and what you type. His base table is the seed (2026-08-19): NY is ' +
        'served from the NJ base — rows are SERVICE AREAS, so capacity there is coverage, ' +
        'not relocation. Utilization bridges per-day maximums to a month: Sep-25 ran at ' +
        n1(measuredUtil * 100) + '% of today’s ceiling. Lost = qualified, never booked, ' +
        'settled Septembers only. Geography is where the move starts. Marketing $/lead is ' +
        'company-wide. MD counts Tuji and Zip together; MD/VA are not bases in this plan ' +
        'but their September history stays visible above.</div>';

      const card = (eyebrow, h, sub, body) =>
        '<div class="ap-card"><div class="ap-eyebrow">' + eyebrow + '</div>' +
        '<div class="ap-h">' + h + '</div>' +
        (sub ? '<div class="ap-sub">' + sub + '</div>' : '') + body + '</div>';

      function paint() {
        const c = calc();
        host.innerHTML =
          '<div class="ap-wrap">' +
          '<div class="ap-tiles" id="apHero" style="margin-bottom:18px">' + heroHtml(c) +
          '</div>' +
          card("The plan", "Base capacity — today, plus the additions being considered",
               "Your real numbers. NY is covered from the NJ base. Change any cell; the " +
               "tiles above follow. Edits stay in this browser.",
               assumptions + '<div id="apBase" style="overflow-x:auto">' + baseHtml(c) +
               '</div>') +
          card("The demand", "September, year over year",
               "Leads counted where the move starts, on create date. Lost = qualified and " +
               "never booked — settled Septembers only.",
               '<div style="overflow-x:auto">' + picture + '</div>') +
          (research ? card("The outside picture", "Big houses and good areas, joined to " +
               "our own demand",
               "Research compiled by us — the gap between the outside case and our own " +
               "leads is the expansion argument.",
               '<div style="overflow-x:auto">' + research + '</div>') : "") +
          card("Trucks", "Rent vs buy — as the company already lives it",
               "Both sides are real card history: the company rents AND finances purchases " +
               "today. Renting is climbing again in 2026 — that is the “+2” question.",
               trucks) +
          card("Method", "What is measured and what is assumed", "", honesty) +
          '</div>';
      }
      paint();

      function save() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {}
      }
      host.addEventListener("input", e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains("ap-num")) return;
        if (t.dataset.st) inputs.bases[t.dataset.st][t.dataset.f] = parseFloat(t.value) || 0;
        else if (t.dataset.k) inputs[t.dataset.k] = parseFloat(t.value) || 0;
        save();
        const c = calc();
        // repaint only the derived parts, never the input being typed into
        document.getElementById("apHero").innerHTML = heroHtml(c);
        const tbl = document.getElementById("apBase");
        // update the computed cells in place so focus and caret survive
        c.perBase.forEach((r, i) => {
          const row = tbl.querySelectorAll("tbody tr")[i];
          if (!row) return;
          const cells = row.querySelectorAll("td");
          cells[3].innerHTML = "<b>" + r.daily + "</b>";
          cells[5].textContent = fmtN(r.jobs);
          cells[7].textContent = fmtN(r.leadsNeeded);
          cells[9].innerHTML = r.gap == null
            ? '<span class="ap-pill bad">no measured demand</span>'
            : r.gap > 0.1
              ? '<span class="ap-pill warn">+' + Math.round(r.gap * 100) + '% vs Sep-25</span>'
              : '<span class="ap-pill ok">covered by Sep-25</span>';
        });
      });
    });
  },
});
})();
