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

      host.innerHTML = chain +
        table(longStats, "Long hauls — " + LONG_HAUL_DAYS + "+ days away",
              "Where the question actually bites. All figures are operational profit.") +
        table(allStats, "Every Straight job",
              "For contrast: the typical job is short, so it keeps its lead.") +
        setAside + evidence + coverage;
    });
  },
});
})();
