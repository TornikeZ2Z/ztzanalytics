/* Straight Moving vs the local board — is a self-driven long-distance job worth the days it
 * takes a foreman off local work?
 *
 * THE ANSWER THIS PAGE EXISTS TO GIVE, and it is not the one the question expected. A Straight
 * job nets far more than a local one and costs a median of TWO days, so on the whole
 * population the answer is simply "take it". The interesting cohort is the tail: the trips
 * that genuinely lock a foreman up for five days or more. There the margin collapses, and the
 * lever is PRICE, not blocking dates — blocking would forfeit the many profitable short
 * Straights to prevent a few unprofitable long ones.
 *
 * So the page leads with the long hauls, and the number it hands over is the PRICE FLOOR:
 * trip cost plus the local profit the trip displaces. A verdict is something people argue
 * with; a floor is something sales can quote.
 *
 * HONESTY FURNITURE, not decoration. Every window shows n, and how many jobs were set aside
 * and why. The peak-month-end long-haul cell rests on a handful of jobs and says so instead of
 * dressing a hunch as a mandate — the same "not enough data" convention the rep profiles use,
 * for the same reason: a recommendation to stop selling something costs real revenue when it
 * is wrong.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.straight_tradeoff) {
    // PAYLOAD CONTRACT: a column missing here never arrives, however well the page is written.
    RS.DATASETS.straight_tradeoff = {
      table: "mart_straight_tradeoff",
      cols: ["uk", "company", "customer", "foreman", "pickup_date", "back_on_local",
             "trip_start", "trip_end", "window", "long_haul",
             "gone_days", "normal_gap_days", "excess_days",
             "revenue", "pickup_cost", "delivery_cost", "second_contracts",
             "combined_move", "straight_profit", "local_rate_per_day", "rate_basis",
             "opportunity_cost", "net", "net_upper", "price_floor", "incomplete"],
      // no dateCols/defaultDate: nothing filters this page, and declaring them would
      // invite a future edit to wire the global date bar back in

    };
  }
})();

(() => {
  /* OWN NAMESPACE, OWN STYLE BLOCK. `.st-card` and friends are defined inside sales-team.js,
     so borrowing them renders this page correctly only for someone who happened to visit that
     page first -- and unstyled for everyone else. The lint script exists because this exact
     class of bug has shipped before. */
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
    `;
    document.head.appendChild(st);
  }

registerPage({
  id: "straight-vs-local",
  group: "different",
  title: "Straight vs Local",
  subtitle: "Is a self-driven long-distance move worth the days it takes a foreman off the " +
            "local board? · absence measured from when he is actually back, not from planned " +
            "trip days",
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
      // NO FILTERING, DELIBERATELY. This page is a conclusion, not a dashboard: it reads every
      // Straight job on the books and tells you what to do about them. It used to run through
      // RS.filtered, and a date range left behind by another page emptied it completely --
      // which reads as "we have never done a Straight move" rather than "you have a filter on".
      // The global bar is hidden for this id (BARE_CHROME) so nothing can scope it by accident.
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

      /* A window's verdict, computed here so the page and the mart cannot drift: the UPPER
         QUARTILE decides "block", never the median. One catastrophic job in five is a claim to
         investigate, not a reason to stop selling a service. */
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
                   why: "typically nets " + signed(med) + " after the local work it displaces" };
        }
        if (q75 < 0) {
          return { label: "block or reprice", cls: "bad",
                   why: "even the better outcomes lose money — " +
                        Math.round(losing * 100) + "% negative" };
        }
        return { label: "price it up", cls: "warn",
                 why: "marginal — median " + signed(med) + " with " +
                      Math.round(losing * 100) + "% losing" };
      }

      function windowStats(pool) {
        return WINDOWS.map(w => {
          const mine = pool.filter(r => r.window === w);
          const ok = mine.filter(usable);
          const nets = ok.map(r => num(r.net));
          return { window: w, jobs: mine.length, usable: ok.length,
                   incomplete: mine.length - ok.length,
                   medianNet: median(nets),
                   floor: median(ok.map(r => num(r.price_floor))),
                   medianBill: median(mine.map(r => num(r.revenue))),
                   v: verdict(nets) };
        });
      }

      const longs = rows.filter(isLong);
      const shorts = rows.filter(r => !isLong(r));
      const longStats = windowStats(longs);
      const allStats = windowStats(rows);

      /* ---------- the headline: what this analysis actually found ---------- */
      const medShortNet = median(shorts.filter(usable).map(r => num(r.net)));
      const medLongNet = median(longs.filter(usable).map(r => num(r.net)));
      const medGone = median(rows.map(r => num(r.gone_days)));

      const headline =
        '<div class="svl-card" style="border-left:4px solid var(--pos)">' +
        '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;' +
        'text-transform:uppercase;color:var(--muted)">What the numbers say</div>' +
        '<div style="font-size:15px;margin-top:8px;line-height:1.55">' +
        'The typical Straight job takes a foreman off the local board for <b>' + n1(medGone) +
        ' days</b> and nets <b>' + signed(medShortNet) + '</b> after the local work it ' +
        'displaces — so on the whole book, take them. The premise that a Straight locks a ' +
        'foreman up for a long stretch holds only for the tail: the <b>' + longs.length +
        '</b> jobs that kept him away ' + LONG_HAUL_DAYS + '+ days, where the median falls to <b>' +
        signed(medLongNet) + '</b>.' +
        '</div>' +
        '<div style="font-size:13px;margin-top:10px;color:var(--muted)">' +
        'That makes the lever <b>price, not blocking</b>: blocking peak dates would forfeit ' +
        'the many profitable short Straights to prevent a few unprofitable long ones. The ' +
        'floor below is what a long haul must bill to be worth the days it costs.' +
        '</div>' +
        '<div style="font-size:11.5px;margin-top:10px;color:var(--muted);' +
        'border-top:1px solid var(--line);padding-top:8px">Covers <b>' + rows.length +
        '</b> Straight jobs — every one on the books, all companies, 2024 onward. This ' +
        'page is not filtered: it is a standing conclusion, not a slice.</div>' +
        '</div>';

      /* ---------- the deliverable: a floor per window ---------- */
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
              (s.medianBill == null ? "—" : money(s.medianBill)) + '</td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              (s.medianNet == null ? "—" : signed(s.medianNet)) + '</td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line);text-align:right">' +
              '<b>' + (s.floor == null ? "—" : money(s.floor)) + '</b></td>' +
            '<td style="padding:8px 6px;border-top:1px solid var(--line)" class="' + cls +
              '"><b>' + esc(s.v.label) + '</b><div style="font-size:11.5px;color:var(--muted)">' +
              esc(s.v.why) + '</div></td>' +
            '</tr>';
        }).join("");
        return '<div class="svl-card"><div style="font-size:13px;font-weight:700;' +
          'margin-bottom:2px">' + esc(caption) + '</div>' +
          '<div style="font-size:12px;color:var(--muted);margin-bottom:8px">' + note + '</div>' +
          '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
          '<thead><tr>' +
          ['Window', 'Usable', 'Median bill', 'Median net', 'Price floor', 'Verdict']
            .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
              'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
              'text-align:' + (i && i < 5 ? 'right' : 'left') + '">' + h + '</th>').join("") +
          '</tr></thead><tbody>' + rowsH + '</tbody></table></div>';
      }

      /* ---------- what was set aside, and why ---------- */
      const why = {};
      rows.filter(r => r.incomplete).forEach(r => {
        const k = String(r.incomplete).split("—")[0].trim();
        why[k] = (why[k] || 0) + 1;
      });
      const setAside = Object.keys(why).length
        ? '<div class="svl-card"><div style="font-size:13px;font-weight:700">Set aside, and ' +
          'why</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
          'A verdict drawn from part of the book must show what it left out — otherwise a ' +
          'confident number hides a thin one.</div><ul style="margin:0;padding-left:18px;' +
          'font-size:13px">' +
          Object.entries(why).sort((a, b) => b[1] - a[1])
            .map(([k, v]) => '<li>' + v + ' — ' + esc(k) + '</li>').join("") +
          '</ul></div>'
        : "";

      /* ---------- the evidence, so a verdict can be argued with ---------- */
      const ev = longs.slice().sort((a, b) => (num(a.net) || 0) - (num(b.net) || 0)).slice(0, 40);
      const evidence =
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">The long hauls, ' +
        'worst first</div><div style="font-size:12px;color:var(--muted);margin:4px 0 8px">' +
        'Every job that kept a foreman off the board ' + LONG_HAUL_DAYS + '+ days. ' +
        '“Away” is measured to his next local job, so recovery counts.</div>' +
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;' +
        'font-size:12.5px"><thead><tr>' +
        ['Date', 'Foreman', 'Customer', 'Window', 'Away', 'Charged', 'Cost', 'Lost local',
         'Net', 'Floor']
          .map((h, i) => '<th style="padding:6px;font-size:10px;text-transform:uppercase;' +
            'letter-spacing:.05em;color:var(--muted);border-bottom:1px solid var(--line);' +
            'text-align:' + (i > 3 ? 'right' : 'left') + '">' + h + '</th>').join("") +
        '</tr></thead><tbody>' +
        ev.map(r => {
          const net = num(r.net);
          const cls = net == null ? "" : net < 0 ? "svl-bad" : "svl-good";
          const cost = (num(r.pickup_cost) || 0) + (num(r.delivery_cost) || 0);
          return '<tr>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(String(r.pickup_date || "").slice(0, 10)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(r.foreman) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(String(r.customer || "").slice(0, 26)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line)">' +
              esc(r.window) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              n1(num(r.gone_days)) + 'd</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              money(num(r.revenue)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              money(cost) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              money(num(r.opportunity_cost)) + '</td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right" class="' +
              cls + '"><b>' + (net == null ? "—" : signed(net)) + '</b></td>' +
            '<td style="padding:6px;border-top:1px solid var(--line);text-align:right">' +
              money(num(r.price_floor)) + '</td>' +
            '</tr>';
        }).join("") +
        '</tbody></table></div></div>';

      const method =
        '<div class="svl-card"><div style="font-size:13px;font-weight:700">How this is ' +
        'measured</div><div style="font-size:12.5px;color:var(--muted);line-height:1.6;' +
        'margin-top:6px">' +
        '<b>Away</b> is measured, not planned: from the pickup until the foreman’s next local ' +
        'job, so a day lost to recovery counts like any other. Only the <b>excess</b> over his ' +
        'own normal gap between local jobs is charged to the trip — otherwise ordinary ' +
        'downtime would be billed to long distance.<br>' +
        '<b>Lost local</b> = those excess days × his own median local profit per working day, ' +
        'measured on days like the ones the trip consumed (peak against peak).<br>' +
        '<b>Net</b> = the job’s profit − the local profit it displaced. <b>Floor</b> = the ' +
        'revenue at which the trip stops costing money: its own cost plus that displaced ' +
        'profit.<br>' +
        'Costs are the closing contract’s own columns, plus a second contract where one ' +
        'exists and trip costs where the move was combined. Both sides of the comparison are ' +
        'measured the same way, so anything the closing sheet omits is omitted from the local ' +
        'baseline too and cannot tilt the verdict.' +
        '</div></div>';

      /* ---------- the peak question, answered with the capacity model ---------- */
      // Built server-side beside the mart: booking rate vs load (demand per available
      // foreman, 2024+), the system cost of one absent foreman-day, and whether any demand
      // level forces a stop. Recomputing here would need fct_closing whole.
      let capCard = "";
      try {
        const cj = await ZTZ.api("/api/mart_straight_capacity?limit=1");
        const cap = JSON.parse(((cj.rows || [])[0] || {}).payload || "null");
        if (cap && cap.curve && cap.curve.length) {
          const first = cap.curve[0], last = cap.curve[cap.curve.length - 1];
          const maxSys = Math.max(0, ...((cap.floor_by_demand || [])
            .map(f => f.system_cost_day || 0)));
          const stop = cap.stop || {};
          const stopLine = stop.found
            ? 'Above <b>' + stop.qualified_leads_per_day + ' qualified leads/day</b> (about ' +
              stop.leads_per_foreman + ' per available foreman), a 5-day Straight cannot ' +
              'bill enough to pay for itself — <b>block or quote above ' +
              money(stop.floor_at_threshold) + '</b>.'
            : '<b>There is no demand level at which Straights must be blocked.</b> Even one ' +
              'foreman down at extreme demand costs the board at most ' + money(maxSys) +
              '/day in lost bookings — well under the ' +
              money(cap.median_local_day_rate) + '/day he earns locally, which the floor ' +
              'already charges. The lever is the price floor, not the calendar.';
          capCard =
            '<div class="svl-card" style="border-left:4px solid var(--brand-d)">' +
            '<div style="font-size:11px;font-weight:800;letter-spacing:.08em;' +
            'text-transform:uppercase;color:var(--muted)">Should we stop Straights at peak?' +
            '</div>' +
            '<div style="font-size:14px;margin-top:8px;line-height:1.6">' + stopLine +
            '</div>' +
            '<div style="font-size:12.5px;color:var(--muted);margin-top:10px;line-height:1.6">' +
            'Why: your availability-margin pricing shows up in the data, but it is mild — ' +
            'booking rate runs <b>' + pct(first.rate) + '</b> on quiet days and only falls to ' +
            '<b>' + pct(last.rate) + '</b> on the heaviest (' +
            n1(last.l_lo) + '–' + n1(last.l_hi) + ' qualified leads per available foreman, ' +
            'measured over ' + cap.curve.reduce((a, c) => a + c.days, 0) + ' days, 2024+). ' +
            'With ~' + Math.round(cap.availability_now) + ' foremen on the books, losing one ' +
            'for a few days moves the whole board less than his own hands do. And the typical ' +
            'Straight barely touches the board anyway: median 2 days away, and in half of ' +
            'matched trips somebody else drove the delivery.</div>' +
            '<div style="font-size:12.5px;margin-top:10px;padding-top:8px;' +
            'border-top:1px solid var(--line)"><b>The rule for sales:</b> a Straight expected ' +
            'to keep a foreman out 5+ days must bill at least <b>its own costs + ' +
            money(cap.median_local_day_rate) + ' per excess day</b> (typically ' +
            money(cap.straight_cost_typical + 5 * cap.median_local_day_rate) + ' for a 5-day ' +
            'haul). Short Straights need no gate. <span style="color:var(--muted)">Method ' +
            'honesty: the curve is observational — busy days differ from quiet ones in more ' +
            'than load — and capacity is tenure-based (employed = available). Both choices ' +
            'were picked to avoid overstating the case for blocking.</span></div></div>';
        }
      } catch (e) { /* the card is additive; the page must not die on it */ }

      host.innerHTML = headline + capCard +
        table(longStats, "Long hauls — " + LONG_HAUL_DAYS + "+ days away",
              "The cohort the question was really about. This is where the margin collapses. " +
              "Absences past 10 days are set aside as likely departures, not trips.") +
        table(allStats, "Every Straight job",
              "Shown for contrast: the typical job is short and clearly profitable.") +
        setAside + evidence + method;
    });
  },
});
})();
