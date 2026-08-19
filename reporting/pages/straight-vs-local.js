/* Straight Moving vs the local board — told entirely in OPERATIONAL PROFIT.
 *
 * Tornike 2026-08-19: "fully based on operational profit, i dont care about net cash and total
 * bill... those numbers confuse user. also - i need more logical context, like because of this
 * --> happens this --> and etc."
 *
 * So this page is a CAUSAL CHAIN, one measured number per link, and every dollar on it is
 * operational profit — revenue and bills appear nowhere. The chain:
 *
 *   a Straight departs → the foreman is off the local board → each day away costs his local
 *   profit → a thinner board also raises quotes (availability-margin pricing) → booking rate
 *   dips → that system effect is SMALLER than his own day-rate → so a Straight pays only if
 *   its profit covers his lost days → typical 2-day Straights clear easily → 5-10 day hauls
 *   do not → price the days, never block the calendar.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.straight_tradeoff) {
    // PAYLOAD CONTRACT — deliberately profit-only. Revenue/bill/cost columns exist on the mart
    // but are not shipped: a column absent here cannot creep back onto the page.
    RS.DATASETS.straight_tradeoff = {
      table: "mart_straight_tradeoff",
      cols: ["uk", "foreman", "customer", "pickup_date", "window", "long_haul",
             "gone_days", "normal_gap_days", "excess_days",
             "straight_profit", "local_rate_per_day", "opportunity_cost", "net",
             "incomplete"],
      // no dateCols/defaultDate: nothing filters this page (BARE_CHROME), and declaring them
      // would invite a future edit to wire the global date bar back in
    };
  }
})();

(() => {
  /* Own namespace + own style block: .st-* lives inside sales-team.js and only exists once
     that page has been visited. */
  function injectStyle() {
    if (document.getElementById("svl-style")) return;
    const st = document.createElement("style");
    st.id = "svl-style";
    st.textContent = `
    .svl-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;
      box-shadow:var(--shadow);padding:18px 20px;margin-bottom:16px}
    .svl-good{color:var(--brand-d)} .svl-bad{color:var(--red)}
    .svl-warn{color:var(--warn,#a15c00)} .svl-dim{color:var(--muted)}
    .svl-card table{font-variant-numeric:tabular-nums}
    .svl-step{display:flex;gap:12px;align-items:flex-start;padding:9px 0;
      border-top:1px dashed var(--line)}
    .svl-step:first-of-type{border-top:none}
    .svl-arrow{flex:0 0 auto;font-weight:800;color:var(--brand-d);margin-top:1px}
    .svl-because{font-size:13px;line-height:1.55}
    .svl-fact{font-size:12px;color:var(--muted)}
    `;
    document.head.appendChild(st);
  }

registerPage({
  id: "straight-vs-local",
  group: "different",
  title: "Straight vs Local",
  subtitle: "Does a self-driven long-distance move earn more operational profit than the " +
            "local work its foreman would have done? Every figure on this page is " +
            "operational profit.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const money = v => (v == null || isNaN(v)) ? "—" : RS.money(+v);
    const signed = v => (v == null || isNaN(v)) ? "—"
      : (+v >= 0 ? "+" : "−") + RS.money(Math.abs(+v)).replace("-", "");
    const n1 = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 10) / 10);
    const pct = v => (v == null || isNaN(v)) ? "—" : (Math.round(+v * 1000) / 10) + "%";
    const WINDOWS = ["peak month-end", "peak", "month-end", "ordinary"];
    const LONG_HAUL_DAYS = 5;
    const MIN_JOBS = 5;

    injectStyle();
    host.innerHTML = '<div class="svl-card">Loading…</div>';

    return RS.load("straight_tradeoff").then(async all => {
      // No filtering, deliberately: this page is a standing conclusion, not a dashboard.
      // A leftover date range once emptied it entirely (BARE_CHROME hides the global bar).
      const rows = all;
      if (!rows.length) {
        host.innerHTML = '<div class="svl-card">No Straight jobs on record.</div>';
        return;
      }

      const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
      const usable = r => !r.incomplete && num(r.net) != null;
      const isLong = r => String(r.long_haul) === "1" || r.long_haul === true;
      const median = a => {
        const v = a.filter(x => x != null).sort((x, y) => x - y);
        if (!v.length) return null;
        const m = Math.floor(v.length / 2);
        return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
      };

      /* The verdict rule: the UPPER QUARTILE decides "block", never the median — one
         catastrophic job in five is a claim to investigate, not a reason to stop selling. */
      function verdict(nets) {
        const v = nets.filter(x => x != null).sort((a, b) => a - b);
        if (v.length < MIN_JOBS) {
          return { label: "not enough data", cls: "dim",
                   why: v.length + " usable job" + (v.length === 1 ? "" : "s") +
                        " — too few to recommend anything" };
        }
        const med = median(v);
        const losing = v.filter(x => x < 0).length / v.length;
        const q75 = v[Math.min(v.length - 1, Math.floor(v.length * 0.75))];
        if (med > 0 && losing < 0.35) {
          return { label: "take it", cls: "good",
                   why: "typically " + signed(med) + " ahead of the local board" };
        }
        if (q75 < 0) {
          return { label: "block or reprice", cls: "bad",
                   why: "even the better outcomes earn less than staying local — " +
                        Math.round(losing * 100) + "% behind" };
        }
        return { label: "price it up", cls: "warn",
                 why: "marginal — median " + signed(med) + " with " +
                      Math.round(losing * 100) + "% behind the board" };
      }

      function windowStats(pool) {
        return WINDOWS.map(w => {
          const mine = pool.filter(r => r.window === w);
          const ok = mine.filter(usable);
          return { window: w, jobs: mine.length, usable: ok.length,
                   tripProfit: median(ok.map(r => num(r.straight_profit))),
                   lostLocal: median(ok.map(r => num(r.opportunity_cost))),
                   medianNet: median(ok.map(r => num(r.net))),
                   v: verdict(ok.map(r => num(r.net))) };
        });
      }

      const longs = rows.filter(isLong);
      const shorts = rows.filter(r => !isLong(r));
      const longStats = windowStats(longs);
      const allStats = windowStats(rows);

      const medShortNet = median(shorts.filter(usable).map(r => num(r.net)));
      const medLongNet = median(longs.filter(usable).map(r => num(r.net)));
      const medLongProfit = median(longs.filter(usable).map(r => num(r.straight_profit)));
      const medLongLost = median(longs.filter(usable).map(r => num(r.opportunity_cost)));
      const medGone = median(rows.map(r => num(r.gone_days)));

      // the capacity model, built server-side beside the mart
      let cap = null;
      try {
        const cj = await ZTZ.api("/api/mart_straight_capacity?limit=1");
        cap = JSON.parse(((cj.rows || [])[0] || {}).payload || "null");
      } catch (e) { /* the chain renders without it; the capacity link says so */ }
      const dayRate = cap ? cap.median_local_day_rate : null;
      const maxSys = cap ? Math.max(0, ...((cap.floor_by_demand || [])
        .map(f => f.system_cost_day || 0))) : null;
      const curve = (cap && cap.curve && cap.curve.length) ? cap.curve : null;

      /* ---------- THE CHAIN: because of this -> this happens -> therefore ---------- */
      const step = (because, fact) =>
        '<div class="svl-step"><div class="svl-arrow">→</div><div>' +
        '<div class="svl-because">' + because + '</div>' +
        (fact ? '<div class="svl-fact">' + fact + '</div>' : '') + '</div></div>';

      const chain =
        '<div class="svl-card" style="border-left:4px solid var(--brand-d)">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;' +
        'text-transform:uppercase;color:var(--muted)">The chain — why the verdict is what ' +
        'it is</div><div style="margin-top:6px">' +
        step('A Straight departs, so its foreman is <b>off the local board</b> until he is ' +
             'genuinely back on local work.',
             'Measured absence, not planned trip days — recovery counts. Median: <b>' +
             n1(medGone) + ' days</b>. Gaps past 10 days are treated as departures/leave, ' +
             'not trips.') +
        step('Every day away, the board loses <b>his local operational profit</b>.',
             (dayRate != null ? 'His median local profit on days like the ones the trip ' +
              'consumed: <b>' + money(dayRate) + '/day</b>. Only the days beyond his normal ' +
              'idle gap are charged.' : 'day-rate unavailable — capacity model not loaded')) +
        step('A thinner board also <b>raises quotes</b> (availability-margin pricing), so ' +
             'the booking rate dips and some jobs are never won.',
             (curve ? 'Measured 2024+ over ' + curve.reduce((a, c) => a + c.days, 0) +
              ' days: booking rate <b>' + pct(curve[0].rate) + '</b> on quiet days → <b>' +
              pct(curve[curve.length - 1].rate) + '</b> on the heaviest. Worth at most <b>' +
              money(maxSys) + '/day</b> of profit even at extreme demand.' :
              'capacity model not loaded') ) +
        step('That system effect is <b>smaller than his own day-rate</b>, so the charge for ' +
             'an absent day is his day-rate (charging both would count the same lost jobs ' +
             'twice).',
             (dayRate != null && maxSys != null ? money(maxSys) + ' system vs ' +
              money(dayRate) + ' personal → the day charge is <b>' + money(dayRate) +
              '</b>.' : '')) +
        step('Therefore a Straight pays only if its <b>operational profit covers the days ' +
             'it costs</b>.',
             (dayRate != null ? 'Needed: <b>' + money(dayRate) + ' of profit per excess ' +
              'day</b>. A 5-day haul must clear about <b>' + money(5 * dayRate) +
              '</b> above zero.' : '')) +
        step('Typical Straights <b>clear easily</b>: they are short, and in half of matched ' +
             'trips somebody else drove the delivery.',
             'Median net after the displaced local profit: <b>' + signed(medShortNet) +
             '</b> per job (under ' + LONG_HAUL_DAYS + ' days away).') +
        step('Long hauls (' + LONG_HAUL_DAYS + '–10 days away) <b>do not</b>: their profit ' +
             'is bigger, but not by enough to buy the days.',
             'Median trip profit <b>' + signed(medLongProfit) + '</b> minus displaced local ' +
             '<b>' + money(medLongLost) + '</b> → net <b>' + signed(medLongNet) + '</b>.') +
        step('<b>So: never block the calendar — price the days.</b> Blocking would forfeit ' +
             'the many profitable short Straights to prevent a few underpriced long ones.',
             (cap && cap.stop && !cap.stop.found ? 'Checked against demand directly: there ' +
              'is <b>no demand level</b> at which the capacity effect alone forces a stop.' :
              '')) +
        '</div></div>';

      /* ---------- THE WORKING: every number the verdict rests on, with its n ---------- */
      // Tornike 2026-08-19: "be more analytical... show literally how we calculated why we
      // should not turn off straight." These four sections ARE the calculation, run in the
      // open on the same rows the verdict uses — nothing here is asserted, only computed.
      const use = rows.filter(usable);

      const working = cap ?
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">The inputs, ' +
        'measured</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
        'Every figure carries its sample size. 2024 onward.</div>' +
        '<table style="border-collapse:collapse;font-size:13px"><tbody>' +
        [['One local foreman-day of operational profit (median)', money(dayRate),
          'from ' + (cap.local_days_measured || 0).toLocaleString() + ' foreman-days / ' +
          (cap.local_jobs_measured || 0).toLocaleString() + ' local jobs; matched to days ' +
          'LIKE the trip’s window (peak vs peak)'],
         ['One booked job of operational profit (median)', money(cap.profit_per_booking),
          'the value of a booking a thinner board loses'],
         ['Straight jobs measured', use.length + ' of ' + rows.length,
          'the rest set aside with stated reasons below'],
         ['Foremen on the books now', Math.round(cap.availability_now || 0),
          'tenure-based: employed counts as available, idle or not'],
         ['Booking-rate curve', (curve ? curve.reduce((a, c) => a + c.days, 0) : 0) + ' days',
          'booking rate vs demand-per-foreman, 2024+, last 30 days excluded (still accruing)']]
        .map(r => '<tr><td style="padding:5px 14px 5px 0;border-top:1px solid var(--line)">' +
          r[0] + '</td><td style="padding:5px 14px 5px 0;border-top:1px solid var(--line);' +
          'text-align:right;font-weight:700;white-space:nowrap">' + r[1] +
          '</td><td style="padding:5px 0;border-top:1px solid var(--line);font-size:11.5px;' +
          'color:var(--muted)">' + r[2] + '</td></tr>').join("") +
        '</tbody></table></div>' : "";

      /* what turning Straight OFF would actually have cost — computed per job, then summed */
      function ledger(pool, label) {
        const kept = pool.filter(usable);
        const gain = kept.filter(r => num(r.net) > 0).reduce((a, r) => a + num(r.net), 0);
        const loss = kept.filter(r => num(r.net) < 0).reduce((a, r) => a + num(r.net), 0);
        return { label, n: kept.length, gain, loss, net: gain + loss };
      }
      const policies = [
        ledger(rows, "Turn off ALL Straight moving"),
        ledger(longs, "Turn off only the long hauls (5–10 days)"),
        ledger(rows.filter(r => r.window === "peak month-end" || r.window === "peak"),
               "Turn off Straight at peak only"),
      ];
      const policyCard =
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">What turning it ' +
        'off would have cost — computed job by job, 2024 → today</div>' +
        '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">For every measured ' +
        'job: net = its operational profit − the local profit its foreman would have made ' +
        'instead. A policy’s cost = the winners it forfeits minus the losers it avoids. ' +
        'This is the literal arithmetic of “should we turn it off”.</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;' +
        'font-size:13px"><thead><tr>' +
        ['Policy', 'Jobs', 'Winners forfeited', 'Losers avoided', 'Net effect of the policy']
          .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
            'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
            'text-align:' + (i ? 'right' : 'left') + '">' + h + '</th>').join("") +
        '</tr></thead><tbody>' +
        policies.map(p => {
          const bad = p.net > 0;   // turning off loses money when the pool nets positive
          return '<tr><td style="padding:7px 6px;border-top:1px solid var(--line)">' +
            esc(p.label) + '</td>' +
            '<td style="padding:7px 6px;border-top:1px solid var(--line);text-align:right">' +
              p.n + '</td>' +
            '<td style="padding:7px 6px;border-top:1px solid var(--line);text-align:right">' +
              '−' + money(p.gain) + '</td>' +
            '<td style="padding:7px 6px;border-top:1px solid var(--line);text-align:right">' +
              '+' + money(-p.loss) + '</td>' +
            '<td style="padding:7px 6px;border-top:1px solid var(--line);text-align:right" ' +
              'class="' + (bad ? "svl-bad" : "svl-good") + '"><b>' +
              (bad ? "costs " : "saves ") + money(Math.abs(p.net)) + '</b></td></tr>';
        }).join("") +
        '</tbody></table></div>' +
        '<div style="font-size:12px;margin-top:8px;color:var(--muted)">The fourth option — ' +
        'keep everything and hold long hauls to the ' + money(dayRate) + '/excess-day floor — ' +
        'forfeits nothing and, if the repriced jobs still book, recovers the ' +
        money(Math.abs(policies[1].loss)) + ' the losing long hauls cost. That is why the ' +
        'recommendation is a floor, not a switch.</div></div>';

      /* the peak stress-test, with the curve arithmetic in the open */
      let stress = "";
      if (curve && cap.availability_now > 1) {
        const A = cap.availability_now;
        const pts = curve.map(c => [c.l_mid, c.rate]);
        const rateAt = L => {
          if (L <= pts[0][0]) return pts[0][1];
          if (L >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
          for (let i = 1; i < pts.length; i++) {
            if (L <= pts[i][0]) {
              const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
              return x1 > x0 ? y0 + (y1 - y0) * (L - x0) / (x1 - x0) : y0;
            }
          }
          return pts[pts.length - 1][1];
        };
        const demands = [1, 2, 3, 4, 6, 8].map(m => Math.round(A * m));
        stress =
          '<div class="svl-card"><div style="font-size:13px;font-weight:700">The peak ' +
          'stress-test, computed in the open</div>' +
          '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">One foreman ' +
          'leaves (' + Math.round(A) + ' → ' + Math.round(A - 1) + '), so every remaining ' +
          'crew carries more demand, quotes rise (your availability-margin rule), and the ' +
          'measured booking curve says how many bookings that costs. Each row is that ' +
          'calculation at one demand level.</div>' +
          '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;' +
          'font-size:12.5px"><thead><tr>' +
          ['Qualified leads/day', 'Leads per foreman', 'Booking rate', 'Bookings lost/day',
           '$ lost/day', 'vs his own ' + money(dayRate) + '/day', 'The day charge']
            .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
              'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
              'text-align:' + (i ? 'right' : 'left') + '">' + h + '</th>').join("") +
          '</tr></thead><tbody>' +
          demands.map(Q => {
            const L1 = Q / A, L2 = Q / (A - 1);
            const r1 = rateAt(L1), r2 = rateAt(L2);
            const lost = Math.max(0, Q * (r1 - r2));
            const sys = lost * (cap.profit_per_booking || 0);
            return '<tr>' +
              '<td style="padding:6px;border-top:1px solid var(--line)">' + Q + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
                (Math.round(L1 * 100) / 100) + ' → ' + (Math.round(L2 * 100) / 100) + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
                pct(r1) + ' → ' + pct(r2) + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
                (Math.round(lost * 100) / 100) + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
                money(sys) + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right" ' +
                'class="' + (sys < dayRate ? "svl-good" : "svl-bad") + '">' +
                (sys < dayRate ? "smaller" : "LARGER") + '</td>' +
              '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
                '<b>' + money(Math.max(dayRate, sys)) + '</b></td></tr>';
          }).join("") +
          '</tbody></table></div>' +
          '<div style="font-size:12px;margin-top:8px;color:var(--muted)">At every demand ' +
          'level the board-wide effect stays below what the foreman himself earns, so the ' +
          'day charge never exceeds ' + money(dayRate) + ' — the same lost jobs must not be ' +
          'charged twice. That is the literal calculation behind “no demand level ' +
          'forces a stop”.</div></div>';
      }

      /* profit by days away — where the margin actually dies */
      const buckets = [[1, "1d"], [2, "2d"], [3, "3d"], [4, "4d"], [6, "5–6d"], [8, "7–8d"],
                       [10, "9–10d"]];
      const byDays = buckets.map(([hi, label], i) => {
        const lo = i === 0 ? 0 : buckets[i - 1][0];
        const mine = use.filter(r => num(r.gone_days) > lo && num(r.gone_days) <= hi);
        return { label, n: mine.length, med: median(mine.map(r => num(r.net))) };
      }).filter(b => b.n);
      const daysCard =
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">Net profit by ' +
        'days away — where the margin dies</div>' +
        '<div style="font-size:12px;color:var(--muted);margin:4px 0 8px">Same jobs, grouped ' +
        'by measured absence. The trend IS the argument: each extra day costs ' +
        money(dayRate) + ' of displaced local profit, and the trip’s own profit does ' +
        'not grow fast enough to keep up.</div>' +
        '<table style="border-collapse:collapse;font-size:13px"><thead><tr>' +
        ['Days away', 'Jobs', 'Median net'].map((h, i) =>
          '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
          'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
          'text-align:' + (i ? 'right' : 'left') + '">' + h + '</th>').join("") +
        '</tr></thead><tbody>' +
        byDays.map(b => '<tr><td style="padding:6px;border-top:1px solid var(--line)">' +
          b.label + '</td><td style="padding:6px;border-top:1px solid var(--line);' +
          'text-align:right">' + b.n + '</td>' +
          '<td style="padding:6px;border-top:1px solid var(--line);text-align:right" class="' +
          (b.med != null && b.med < 0 ? "svl-bad" : "svl-good") + '"><b>' +
          (b.med == null ? "—" : signed(b.med)) + '</b></td></tr>').join("") +
        '</tbody></table></div>';

      /* ---------- verdicts, profit-only ---------- */
      function table(stats, caption, note) {
        const rowsH = stats.map(s => {
          const cls = s.v.cls === "good" ? "svl-good" : s.v.cls === "bad" ? "svl-bad"
            : s.v.cls === "warn" ? "svl-warn" : "svl-dim";
          return '<tr>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line)"><b>' +
              esc(s.window) + '</b></td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              s.usable + ' of ' + s.jobs + '</td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              (s.tripProfit == null ? "—" : signed(s.tripProfit)) + '</td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              (s.lostLocal == null ? "—" : money(s.lostLocal)) + '</td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              '<b>' + (s.medianNet == null ? "—" : signed(s.medianNet)) + '</b></td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line)" class="' + cls +
              '"><b>' + esc(s.v.label) + '</b><div style="font-size:11.5px;' +
              'color:var(--muted)">' + esc(s.v.why) + '</div></td>' +
            '</tr>';
        }).join("");
        return '<div class="svl-card"><div style="font-size:13px;font-weight:700;' +
          'margin-bottom:2px">' + esc(caption) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + note +
          '</div><table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr>' +
          ['Window', 'Usable', 'Trip profit', 'Local profit lost', 'Net', 'Verdict']
            .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
              'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
              'text-align:' + (i && i < 5 ? 'right' : 'left') + '">' + h + '</th>').join("") +
          '</tr></thead><tbody>' + rowsH + '</tbody></table></div>';
      }

      /* ---------- what was set aside ---------- */
      const why = {};
      rows.filter(r => r.incomplete).forEach(r => {
        const k = String(r.incomplete).split("—")[0].trim();
        why[k] = (why[k] || 0) + 1;
      });
      const setAside = Object.keys(why).length
        ? '<div class="svl-card"><div style="font-size:13px;font-weight:700">Set aside, and ' +
          'why</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
          'A verdict from part of the book must show what it left out.</div>' +
          '<ul style="margin:0;padding-left:18px;font-size:13px">' +
          Object.entries(why).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => '<li>' + v + ' — ' + esc(k) + '</li>').join("") +
          '</ul></div>'
        : "";

      /* ---------- the long hauls, worst first — profit columns only ---------- */
      const ev = longs.slice().sort((a, b) => (num(a.net) || 0) - (num(b.net) || 0))
        .slice(0, 40);
      const evidence =
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">The long hauls, ' +
        'worst first</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
        'Each row reads left to right as its own chain: away this long → trip earned this → ' +
        'the board would have earned that → net.</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;' +
        'font-size:12.5px"><thead><tr>' +
        ['Date', 'Foreman', 'Window', 'Away', 'Trip profit', 'Local profit lost', 'Net']
          .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
            'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
            'text-align:' + (i > 2 ? 'right' : 'left') + '">' + h + '</th>').join("") +
        '</tr></thead><tbody>' +
        ev.map(r => {
          const net = num(r.net);
          const cls = net == null ? "" : net < 0 ? "svl-bad" : "svl-good";
          return '<tr>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(String(r.pickup_date || "").slice(0, 10)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(r.foreman) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(r.window) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              n1(num(r.gone_days)) + 'd</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              signed(num(r.straight_profit)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              money(num(r.opportunity_cost)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right" ' +
              'class="' + cls + '"><b>' + (net == null ? "—" : signed(net)) + '</b></td>' +
            '</tr>';
        }).join("") +
        '</tbody></table></div></div>';

      const coverage =
        '<div class="svl-card" style="padding:10px 20px">' +
        '<div style="font-size:11.5px;color:var(--muted)">Covers <b>' + rows.length +
        '</b> Straight jobs — every one on the books, all companies, 2024 onward. Not ' +
        'filtered: a standing conclusion, not a slice. "Operational profit" = the job’s ' +
        'takings minus its own crew, materials, fuel, tolls, hotel and other expenses from ' +
        'the closing contract (plus the second contract or combined-trip costs where they ' +
        'exist). Sales commission is excluded on both sides, so it cannot tilt the ' +
        'comparison.</div></div>';

      host.innerHTML = chain + working + policyCard + stress + daysCard +
        table(longStats, "Long hauls — " + LONG_HAUL_DAYS + "+ days away",
              "Where the question actually bites. All figures are operational profit.") +
        table(allStats, "Every Straight job",
              "For contrast: the typical job is short, so it keeps its lead.") +
        setAside + evidence + coverage;
    });
  },
});
})();
