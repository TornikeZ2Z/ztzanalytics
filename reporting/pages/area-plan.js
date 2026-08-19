/* The Area Plan — the September planning tool.
 *
 * Tornike's assignment (2026-08-19, translated): by area — where the leads were, where we lost
 * them, truck + foreman placement, buy-vs-rent for +2 trucks, and the salespeople + marketing
 * budget a 28-crew plan implies. His steer: the 28-crew split is an AIM, not an input — so
 * this page is a CALCULATOR, not a report. Crew counts per state are editable, seeded with the
 * aim; sales headcount, marketing budget and the truck gap recompute live; the meeting's
 * adjustments persist in localStorage and survive a reload.
 *
 * Every ratio is seeded from MEASURED history (mart_area_plan_model) and labeled so; the only
 * assumed numbers are the ones a person typed. Lost = qualified and never booked — settled
 * Septembers only. Geography is pickup-only. All dollars are spend/profit as recorded.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_plan) {
    // PAYLOAD CONTRACT: the September facts, one row per (september, company, state, county).
    RS.DATASETS.area_plan = {
      table: "mart_area_plan",
      cols: ["september", "company", "state", "county",
             "leads", "qualified", "lost", "booked", "total_cf"],
      // no dateCols: nothing filters this page (BARE_CHROME)
    };
  }
})();

(() => {
  function injectStyle() {
    if (document.getElementById("ap-style")) return;
    const st = document.createElement("style");
    st.id = "ap-style";
    st.textContent = `
    .ap-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;
      box-shadow:var(--shadow);padding:18px 20px;margin-bottom:16px}
    .ap-good{color:var(--brand-d)} .ap-bad{color:var(--red)}
    .ap-warn{color:var(--warn,#a15c00)} .ap-dim{color:var(--muted)}
    .ap-card table{font-variant-numeric:tabular-nums}
    .ap-num{width:64px;padding:5px 7px;border:1px solid var(--line);border-radius:8px;
      background:var(--panel);color:var(--ink);font-size:13px;text-align:right}
    .ap-num:focus{outline:2px solid var(--brand-d)}
    .ap-th{padding:6px;font-size:10px;text-transform:uppercase;letter-spacing:.05em;
      color:var(--muted);border-bottom:1px solid var(--line)}
    .ap-td{padding:7px 6px;border-top:1px solid var(--line);font-size:13px}
    .ap-pill{display:inline-block;border:1px solid var(--line);border-radius:10px;
      padding:2px 8px;font-size:11px;color:var(--muted);margin-left:6px}
    `;
    document.head.appendChild(st);
  }

  const LS_KEY = "ztzAreaPlan.v1";

registerPage({
  id: "area-plan",
  group: "different",
  title: "Area Plan",
  subtitle: "September by geography — where the leads were, where we lost them, and what a " +
            "crew plan implies for sales, marketing and trucks. The crew counts are yours to " +
            "adjust; everything downstream recomputes.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const money = v => (v == null || isNaN(v)) ? "—" : RS.money(+v);
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";

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
      const natCap = ((model.capacity || {})["2025-09"] || {})._national || {};
      const natCap24 = ((model.capacity || {})["2024-09"] || {})._national || {};
      const sales25 = (model.sales || {})["2025-09"] || {};
      const mkt25 = (model.marketing || {})["2025-09"] || {};
      const natQual = Object.values(S25).reduce((a, s) => a + s.qualified, 0);
      const natBooked = Object.values(S25).reduce((a, s) => a + s.booked, 0);
      const natConv = natQual ? natBooked / natQual : 0.2;

      /* ---------------- the September picture: YoY by state, county drill ---------------- */
      const states = [...new Set([...Object.keys(S25), ...Object.keys(S24)])]
        .sort((a, b) => (S25[b] || {}).leads - (S25[a] || {}).leads || 0)
        .filter(st => ((S25[st] || {}).leads || 0) + ((S24[st] || {}).leads || 0) >= 5);

      const byCounty = {};
      rows.forEach(r => {
        if (r.september !== "2025-09") return;
        const k = r.state;
        (byCounty[k] = byCounty[k] || {});
        const c = byCounty[k][r.county] = byCounty[k][r.county] ||
          { leads: 0, lost: 0, booked: 0 };
        c.leads += num(r.leads); c.lost += num(r.lost); c.booked += num(r.booked);
      });

      const stateRows = states.map(st => {
        const a = S24[st] || {}, b = S25[st] || {};
        const dl = (a.leads && b.leads) ? (b.leads - a.leads) / a.leads : null;
        const counties = Object.entries(byCounty[st] || {})
          .sort((x, y) => y[1].leads - x[1].leads).slice(0, 5)
          .map(([c, v]) => esc(c) + " " + fmtN(v.leads) +
               ' <span class="ap-dim">(lost ' + fmtN(v.lost) + ")</span>")
          .join(" · ");
        return '<tr>' +
          '<td class="ap-td"><b>' + esc(st) + '</b></td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(a.leads) + '</td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(a.booked) +
            ' <span class="ap-dim">(' + pct(a.conversion) + ')</span></td>' +
          '<td class="ap-td" style="text-align:right"><b>' + fmtN(b.leads) + '</b>' +
            (dl == null ? "" : ' <span class="' + (dl >= 0 ? "ap-good" : "ap-bad") +
             '" style="font-size:11px">' + (dl >= 0 ? "+" : "") +
             Math.round(dl * 100) + '%</span>') + '</td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(b.booked) +
            ' <span class="' + ((b.conversion || 0) < (a.conversion || 0) ? "ap-bad" : "ap-dim")
            + '">(' + pct(b.conversion) + ')</span></td>' +
          '<td class="ap-td" style="text-align:right" class="ap-bad"><b>' + fmtN(b.lost) +
            '</b></td>' +
          '<td class="ap-td" style="font-size:11.5px;color:var(--muted)">' + counties +
          '</td></tr>';
      }).join("");

      const picture =
        '<div class="ap-card"><div style="font-size:13px;font-weight:700">September, year ' +
        'over year</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
        'Leads counted where the MOVE STARTS, on their create date. Lost = qualified and ' +
        'never booked — settled Septembers only, so nothing here is still in flight.</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr><th class="ap-th" style="text-align:left">State</th>' +
        '<th class="ap-th" style="text-align:right">Sep-24 leads</th>' +
        '<th class="ap-th" style="text-align:right">booked (conv)</th>' +
        '<th class="ap-th" style="text-align:right">Sep-25 leads</th>' +
        '<th class="ap-th" style="text-align:right">booked (conv)</th>' +
        '<th class="ap-th" style="text-align:right">lost</th>' +
        '<th class="ap-th" style="text-align:left">Top counties, Sep-25 (leads, lost)</th>' +
        '</tr></thead><tbody>' + stateRows + '</tbody></table></div></div>';

      /* ---------------- the calculator ---------------- */
      const aim = model.crew_aim || {};
      // rows = the aim's states plus any state with real September demand the aim ignores
      const calcStates = [...new Set([...Object.keys(aim),
        ...states.filter(st => (S25[st] || {}).leads >= 30)])]
        .filter(st => st !== "—")
        .sort((a, b) => ((S25[b] || {}).leads || 0) - ((S25[a] || {}).leads || 0));

      const saved = (() => {
        try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); }
        catch (e) { return {}; }
      })();
      const inputs = Object.assign({
        crews: Object.fromEntries(calcStates.map(st => [st, aim[st] || 0])),
        jobsPerForeman: natCap.jobs_per_foreman || 17,
        leadsPerRep: sales25.leads_per_rep_median || 140,
        dollarsPerLead: mkt25.dollars_per_lead || 42,
      }, saved);
      // states may have appeared since the save
      calcStates.forEach(st => { if (!(st in inputs.crews)) inputs.crews[st] = aim[st] || 0; });

      function calc() {
        const perState = calcStates.map(st => {
          const crews = num(inputs.crews[st]);
          const conv = (S25[st] || {}).conversion || natConv;
          const jobs = crews * num(inputs.jobsPerForeman);
          const leadsNeeded = conv ? jobs / conv : 0;
          const had = (S25[st] || {}).qualified || 0;
          return { st, crews, conv, jobs, leadsNeeded, had,
                   demandGap: had ? leadsNeeded / had - 1 : null };
        });
        const totCrews = perState.reduce((a, r) => a + r.crews, 0);
        const totJobs = perState.reduce((a, r) => a + r.jobs, 0);
        const totLeads = perState.reduce((a, r) => a + r.leadsNeeded, 0);
        return { perState, totCrews, totJobs, totLeads,
                 salesNeeded: totLeads / Math.max(1, num(inputs.leadsPerRep)),
                 marketing: totLeads * num(inputs.dollarsPerLead),
                 truckGap: totCrews - ((model.fleet || {}).owned_trucks || 0) };
      }

      function calcHtml() {
        const c = calc();
        const rowsH = c.perState.map(r =>
          '<tr><td class="ap-td"><b>' + esc(r.st) + '</b>' +
          (aim[r.st] == null ? '<span class="ap-pill">not in the aim</span>' : '') + '</td>' +
          '<td class="ap-td" style="text-align:right"><input class="ap-num" data-st="' +
            esc(r.st) + '" type="number" min="0" step="1" value="' + r.crews + '"></td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(r.jobs) + '</td>' +
          '<td class="ap-td" style="text-align:right">' + pct(r.conv) +
            ((S25[r.st] || {}).conversion == null ?
              ' <span class="ap-dim">(national)</span>' : '') + '</td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(r.leadsNeeded) + '</td>' +
          '<td class="ap-td" style="text-align:right">' + fmtN(r.had) + '</td>' +
          '<td class="ap-td" style="text-align:right">' +
            (r.demandGap == null ? '<span class="ap-bad"><b>no measured demand</b></span>'
             : r.demandGap > 0.1 ? '<span class="ap-warn"><b>+' +
               Math.round(r.demandGap * 100) + '% more than Sep-25 had</b></span>'
             : '<span class="ap-good">covered by Sep-25 demand</span>') + '</td></tr>'
        ).join("");
        return '<div style="overflow-x:auto"><table style="width:100%;' +
          'border-collapse:collapse"><thead><tr>' +
          '<th class="ap-th" style="text-align:left">State</th>' +
          '<th class="ap-th" style="text-align:right">Crews</th>' +
          '<th class="ap-th" style="text-align:right">Jobs they can do</th>' +
          '<th class="ap-th" style="text-align:right">Conversion</th>' +
          '<th class="ap-th" style="text-align:right">Leads needed</th>' +
          '<th class="ap-th" style="text-align:right">Sep-25 qualified</th>' +
          '<th class="ap-th" style="text-align:right">Demand check</th>' +
          '</tr></thead><tbody>' + rowsH + '</tbody></table></div>' +
          '<div style="display:flex;gap:26px;flex-wrap:wrap;margin-top:14px;padding-top:10px;' +
          'border-top:1px solid var(--line)">' +
          '<div><div class="ap-th" style="border:none;padding:0">Crews total</div>' +
            '<div style="font-size:22px;font-weight:800">' + fmtN(c.totCrews) + '</div></div>' +
          '<div><div class="ap-th" style="border:none;padding:0">Jobs / September</div>' +
            '<div style="font-size:22px;font-weight:800">' + fmtN(c.totJobs) + '</div></div>' +
          '<div><div class="ap-th" style="border:none;padding:0">Leads needed</div>' +
            '<div style="font-size:22px;font-weight:800">' + fmtN(c.totLeads) + '</div></div>' +
          '<div><div class="ap-th" style="border:none;padding:0">Salespeople</div>' +
            '<div style="font-size:22px;font-weight:800">' +
            (Math.round(c.salesNeeded * 10) / 10) + '</div></div>' +
          '<div><div class="ap-th" style="border:none;padding:0">Marketing / month</div>' +
            '<div style="font-size:22px;font-weight:800">' + money(c.marketing) +
            '</div></div>' +
          '<div><div class="ap-th" style="border:none;padding:0">Trucks vs owned (' +
            fmtN((model.fleet || {}).owned_trucks) + ')</div>' +
            '<div style="font-size:22px;font-weight:800" class="' +
            (c.truckGap > 0 ? "ap-warn" : "ap-good") + '">' +
            (c.truckGap > 0 ? "+" + fmtN(c.truckGap) + " needed" : "covered") +
            '</div></div></div>';
      }

      const assumptions =
        '<div style="display:flex;gap:22px;flex-wrap:wrap;margin-bottom:10px">' +
        [["jobsPerForeman", "Jobs per crew per September",
          "measured: " + (natCap.jobs_per_foreman || "—") + " (Sep-25), " +
          (natCap24.jobs_per_foreman || "—") + " (Sep-24)"],
         ["leadsPerRep", "Leads one salesperson handles / month",
          "measured: " + (sales25.leads_per_rep_median || "—") + " median, Sep-25"],
         ["dollarsPerLead", "Marketing $ per lead",
          "measured: $" + (mkt25.dollars_per_lead || "—") + " Sep-25, $" +
          (((model.marketing || {})["2024-09"] || {}).dollars_per_lead || "—") + " Sep-24"]]
        .map(([k, label, note]) =>
          '<div><div style="font-size:11px;font-weight:700;color:var(--muted)">' + label +
          '</div><input class="ap-num" style="width:84px" data-k="' + k +
          '" type="number" min="0" step="0.1" value="' + inputs[k] + '">' +
          '<div style="font-size:10.5px;color:var(--muted)">' + note + '</div></div>')
        .join("");

      /* ---------------- trucks: both sides, measured ---------------- */
      const tc = model.truck_costs_by_year || {};
      const truckRows = Object.entries(tc).map(([y, b]) =>
        '<tr><td class="ap-td">' + y + (y === "2026" ? " (to Aug)" : "") + '</td>' +
        '<td class="ap-td" style="text-align:right">' + money(b.rental) + '</td>' +
        '<td class="ap-td" style="text-align:right">' + money(b.financing) + '</td>' +
        '<td class="ap-td" style="text-align:right">' + money(b.repair) + '</td></tr>'
      ).join("");
      const trucksCard =
        '<div class="ap-card"><div style="font-size:13px;font-weight:700">Trucks — rent vs ' +
        'buy, as the company already lives it</div>' +
        '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">Both sides are real ' +
        'history from the cards: the company rents AND finances purchases today. Renting is ' +
        'climbing again in 2026 — that pressure is the "+2 trucks" question.</div>' +
        '<table style="border-collapse:collapse;min-width:420px"><thead><tr>' +
        '<th class="ap-th" style="text-align:left">Year</th>' +
        '<th class="ap-th" style="text-align:right">Truck rental</th>' +
        '<th class="ap-th" style="text-align:right">Truck financing</th>' +
        '<th class="ap-th" style="text-align:right">Repair & parts</th></tr></thead><tbody>' +
        truckRows + '</tbody></table>' +
        '<div style="font-size:12px;color:var(--muted);margin-top:8px">Owned fleet: <b>' +
        fmtN((model.fleet || {}).owned_trucks) + '</b> trucks · insurance <b>' +
        money((model.fleet || {}).insurance_yearly_total) + '/yr</b> · parking <b>' +
        money((model.fleet || {}).parking_monthly_total) + '/mo</b>.</div>' +
        (function (t) {
          if (!t) return "";
          return '<div style="margin-top:10px;padding-top:10px;border-top:1px solid ' +
            'var(--line);font-size:12.5px;line-height:1.6">' +
            '<b>The +2 answer, priced from live market research:</b> a used 26-ft box truck ' +
            'runs <b>' + money(t.used_low) + '–' + money(t.used_high) + '</b> (typical ' +
            money(t.used_typical) + '; Penske/Ryder fleet sell-offs ~' +
            money(t.selloff_typical) + '; new ~' + money(t.new_typical) + '). All-in, one ' +
            'more owned truck costs about <b>$' + t.owned_truck_year_allin + '/year</b> ' +
            '(financing ~' + money(t.financing_mo_typical) + '/mo, insurance ~' +
            money(t.insurance_actual_yr) + '/yr at your actual blended rate, parking ~' +
            money(t.parking_nj_mo) + '/mo, repairs from your own history). Against a rental ' +
            'run-rate of ~$140k/yr, <b>two owned trucks (~$62k/yr) displace renting at ' +
            'better than 2:1</b> — if the rental usage is steady capacity, not seasonal ' +
            'spikes.<br><b>Spec warning:</b> ' + esc(t.gvwr_note) +
            '<br><b>Live candidate:</b> ' + esc(t.local_candidate) + '.</div>';
        })((model.research || {}).trucks) + '</div>';

      /* ---------------- honesty ---------------- */
      const argues = [];
      Object.keys(aim).forEach(st => {
        const q = (S25[st] || {}).qualified || 0;
        if (q === 0) argues.push('<b>' + st + '</b>: the aim places ' + aim[st] +
          ' crew(s) on ZERO measured September demand');
        else if (q < 30) argues.push('<b>' + st + '</b>: ' + aim[st] +
          ' crew(s) rest on only ' + q + ' qualified September leads');
      });
      states.forEach(st => {
        if (!(st in aim) && (S25[st] || {}).leads >= 100) {
          argues.push('<b>' + st + '</b> is not in the aim at all, yet had ' +
            fmtN(S25[st].leads) + ' September leads');
        }
      });
      const honesty =
        '<div class="ap-card"><div style="font-size:13px;font-weight:700">Where the data ' +
        'argues with the aim</div><ul style="margin:6px 0 10px;padding-left:18px;' +
        'font-size:13px">' + (argues.length ? argues.map(a => "<li>" + a + "</li>").join("")
          : "<li>nowhere — the aim matches measured demand</li>") + '</ul>' +
        '<div style="font-size:11.5px;color:var(--muted);line-height:1.6;border-top:1px solid ' +
        'var(--line);padding-top:8px">Measured: everything except the crew counts and any ' +
        'number you type. Lost = qualified, never booked — settled Septembers only. ' +
        'Geography is where the move STARTS; unparseable addresses sit in the "—" bucket. ' +
        'Jobs-per-crew is national (a foreman working two states counts once). Marketing $ ' +
        'per lead is company-wide — per-state ad spend is only natively known for Thumbtack ' +
        'and Post Card, so state budgets are allocations, not measurements. Salespeople are ' +
        'sized by lead volume alone. MD counts Tuji and Zip together.</div></div>';

      /* ---------------- the outside picture: the research, joined to our demand ------------ */
      const R = model.research || {};
      const researchCard = R.states ?
        '<div class="ap-card"><div style="font-size:13px;font-weight:700">The outside ' +
        'picture — big houses and good areas, joined to our own demand</div>' +
        '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' + esc(R.vintage) +
        '. "Sep-25 qualified" is OUR measured demand; everything else is what the market ' +
        'looks like from outside — the gap between the two is the expansion argument.</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse">' +
        '<thead><tr>' +
        ['State', 'Sep-25 qualified', 'The outside case', 'Marketing target towns',
         'Yard $/mo', '3BR move · crew/hr']
          .map((h, i) => '<th class="ap-th" style="text-align:' +
            (i === 1 || i > 3 ? 'right' : 'left') + '">' + h + '</th>').join("") +
        '</tr></thead><tbody>' +
        Object.entries(R.states).map(([st, v]) => {
          const q = (S25[st] || {}).qualified || 0;
          const dep = (R.depots || {})[st];
          const comp = (R.competitors || {})[st];
          return '<tr><td class="ap-td"><b>' + esc(st) + '</b></td>' +
            '<td class="ap-td" style="text-align:right">' + fmtN(q) + '</td>' +
            '<td class="ap-td" style="font-size:12px">' + esc(v.case) + '</td>' +
            '<td class="ap-td" style="font-size:11.5px;color:var(--muted)">' + esc(v.towns) +
            '</td>' +
            '<td class="ap-td" style="text-align:right">' + (dep ? money(dep) : "—") + '</td>' +
            '<td class="ap-td" style="text-align:right">' +
            (comp ? money(comp[0]) + ' · ' + money(comp[1]) : "—") + '</td></tr>';
        }).join("") +
        '</tbody></table></div>' +
        '<div style="font-size:11.5px;color:var(--muted);margin-top:8px">Licensing per state ' +
        '(each needs its own intrastate mover authority — a real gate on MD/VA/CT/MA) is in ' +
        'the memo, with the regulator named.</div></div>' : "";

      host.innerHTML = researchCard + picture +
        '<div class="ap-card"><div style="font-size:13px;font-weight:700">The plan — adjust ' +
        'and watch</div><div style="font-size:12px;color:var(--muted);margin:4px 0 10px">' +
        'Crew counts start at the aim (28 across 6 states). Change anything; sales, ' +
        'marketing and trucks follow. Your numbers stay in this browser.</div>' +
        assumptions + '<div id="apCalc">' + calcHtml() + '</div></div>' +
        trucksCard + honesty;

      // live recompute + persistence
      function save() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(inputs)); } catch (e) {}
      }
      host.addEventListener("input", e => {
        const t = e.target;
        if (!t.classList || !t.classList.contains("ap-num")) return;
        if (t.dataset.st) inputs.crews[t.dataset.st] = parseFloat(t.value) || 0;
        else if (t.dataset.k) inputs[t.dataset.k] = parseFloat(t.value) || 0;
        save();
        const focusSt = t.dataset.st, focusK = t.dataset.k;
        document.getElementById("apCalc").innerHTML = calcHtml();
        // re-focus the input being edited so typing is not interrupted mid-keystroke
        const sel = focusSt ? '[data-st="' + focusSt + '"]' : '[data-k="' + focusK + '"]';
        const el = document.querySelector("#apCalc " + sel) ||
                   document.querySelector(sel);
        if (el) { el.focus(); el.selectionStart = el.selectionEnd = String(el.value).length; }
      });
    });
  },
});
})();
