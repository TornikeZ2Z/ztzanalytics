/* RELOCATION TRENDS — the numbers behind the marketing team's trend report.
 *
 * Sopho and Giorgi asked (via Tornike, 2026-08-24) for answers to sixteen questions for a
 * public blog post: where people moved from and to, when, how far, how much it cost, and what
 * changed year over year. This page is those answers, and it is built for a reader who is
 * going to QUOTE it — so every figure carries the caveat that makes it safe to quote.
 *
 * FOUR RULES ARE BAKED IN, because a review pass caught all four heading into print:
 *
 *  1. EVERYTHING IS DAY-MATCHED. 2026 is a partial year. Set against a full 2025, New Jersey
 *     reads as down 22% when it is actually up 15%. The default window stops both years on
 *     the same calendar day, and choosing a full year is possible but shouts about it.
 *
 *  2. THE STORAGE FACILITY IS NOT A CITY. Zip 07753 is the company's own warehouse on Shafto
 *     Road; it was ranking as the third most popular destination in the country because goods
 *     go in and later come out. Those legs are excluded by default and counted out loud.
 *
 *  3. THE QUOTE GAP IS SHOWN BOTH WAYS. Raw, the average job finishes ~$500 over quote, which
 *     reads as "78% of our moves run over estimate". The quote never covered packing
 *     materials; take those out and the median gap is zero. Publishing the raw number would
 *     have been self-inflicted and false.
 *
 *  4. NET FLOW IS NOT MIGRATION. This company books moves OUT of its service area and almost
 *     never one back IN, so Florida shows a huge "net inbound" by construction. That number
 *     is deliberately NOT on this page; the caveats panel explains why.
 *
 * Three things the brief asked for are absent from the warehouse entirely — customer age,
 * reason for moving, and search demand. They are named in the caveats panel so nobody spends
 * another week looking for them.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.relocation) {
    RS.DATASETS.relocation = {
      table: "mart_relocation",
      // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives
      // and renders as an em dash with no error anywhere.
      cols: ["Date", "Month", "Year", "Day Key", "Weekday", "Company", "Moving Type",
             "Distance Band", "Size of Move", "Cubic Feet", "Packing Service", "Storage",
             "Origin City", "Origin County", "Origin State", "Dest City", "Dest County",
             "Dest State", "Interstate", "Same County", "Miles", "Facility Leg",
             "Total Bill", "Materials", "Quote", "Quote Gap", "Quote Gap Ex Materials",
             "Booked Days Ahead", "Leg No"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("rlc-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "rlc-style";
    // Bars, fields, tiles, tables and pills are THE COMPONENT KIT in rs.css. Only what the
    // kit has no name for lives here.
    st.textContent = ""
      + ".rlc{font-variant-numeric:tabular-nums}"
      + ".rlc-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px}"
      // the year-over-year bar: two years on one baseline, so the shape of the season reads
      // before a single number does
      + ".rlc-mon{display:flex;align-items:flex-end;gap:3px;height:132px;padding-top:6px}"
      + ".rlc-mon .m{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0}"
      + ".rlc-mon .pair{display:flex;align-items:flex-end;gap:2px;width:100%;height:112px;"
      + "justify-content:center}"
      + ".rlc-mon .pair i{display:block;width:44%;border-radius:3px 3px 0 0;min-height:2px}"
      + ".rlc-mon .pair i.a{background:color-mix(in srgb,var(--ink) 22%,transparent)}"
      + ".rlc-mon .pair i.b{background:var(--brand)}"
      + ".rlc-mon .lbl{font-size:10px;color:var(--faint);font-weight:700}"
      + ".rlc-key{display:flex;gap:14px;align-items:center;font-size:11.5px;color:var(--muted);"
      + "margin-top:8px}"
      + ".rlc-key b{display:inline-block;width:10px;height:10px;border-radius:3px;"
      + "margin-right:5px;vertical-align:-1px}"
      // an inline share bar inside a table cell
      + ".rlc-bar{display:block;height:5px;border-radius:3px;margin-top:5px;min-width:40px;"
      + "background:color-mix(in srgb,var(--ink) 9%,transparent);overflow:hidden}"
      + ".rlc-bar i{display:block;height:100%;border-radius:3px;background:var(--brand)}"
      // the delta chip: the whole point of the page is what CHANGED
      + ".rlc-d{font-size:11.5px;font-weight:800;white-space:nowrap}"
      + ".rlc-d.up{color:var(--pos)}.rlc-d.dn{color:var(--neg)}.rlc-d.flat{color:var(--faint)}"
      // the panel nobody may skip
      + ".rlc-warn{border:1px solid var(--warn);background:var(--warn-bg);border-radius:13px;"
      + "padding:16px 18px}"
      + ".rlc-warn h3{margin:0 0 4px;font-size:14px;font-weight:800;color:var(--ink)}"
      + ".rlc-warn p{margin:0 0 12px;font-size:12.5px;color:var(--muted);line-height:1.6}"
      + ".rlc-warn ul{margin:0;padding-left:18px}"
      + ".rlc-warn li{font-size:12.5px;color:var(--muted);line-height:1.65;margin-bottom:8px}"
      + ".rlc-warn li b{color:var(--ink)}"
      + ".rlc-warn li.no b{color:var(--neg)}"
      + ".rlc-fig{font-size:22px;font-weight:800;letter-spacing:-.4px;color:var(--ink)}"
      + ".rlc-sub{font-size:11.5px;color:var(--faint);margin-top:2px}"
      + ".rlc-two{display:flex;gap:26px;flex-wrap:wrap}"
      + ".rlc-two>div{min-width:150px}";
    document.head.appendChild(st);
  }

  const MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  registerPage({
    id: "relocation-trends",
    group: "marketing",
    title: "Relocation Trends",
    subtitle: "Where people moved, when, how far and for how much — the answers behind the " +
              "trend report, each one with the caveat that makes it safe to publish.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);

      const S = window.__RLC || (window.__RLC = {
        // the two years being compared, newest first
        year: null, base: null,
        window: "match",      // "match" = same calendar days in both years; "full" = whole year
        co: "", type: "",
        showFacility: false,  // the company's own warehouse, off by default
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading the relocation data…</div>';

      RS.load("relocation").then(rows => {
        if (!alive()) return;
        rows = (rows || []).map(r => {
          r.y = +r.Year || 0;
          r.dk = String(r["Day Key"] || "");
          r.mon = +String(r.Month || "").slice(5, 7) || 0;
          r.facility = !!(+r["Facility Leg"]);
          r.bill = r["Total Bill"] == null ? null : +r["Total Bill"];
          r.miles = r.Miles == null ? null : +r.Miles;
          r.ahead = r["Booked Days Ahead"] == null ? null : +r["Booked Days Ahead"];
          r.gap = r["Quote Gap"] == null ? null : +r["Quote Gap"];
          r.gapEx = r["Quote Gap Ex Materials"] == null ? null : +r["Quote Gap Ex Materials"];
          r.inter = r.Interstate == null ? null : !!(+r.Interstate);
          r.isMove = +r["Leg No"] === 1;
          return r;
        }).filter(r => r.y);

        if (!rows.length) {
          host.innerHTML = '<div class="panel">No relocation data yet — the mart may not be '
            + "built (sources=curated).</div>";
          return;
        }

        const years = [...new Set(rows.map(r => r.y))].sort((a, b) => b - a);
        if (!S.year || years.indexOf(S.year) < 0) S.year = years[0];
        if (!S.base || years.indexOf(S.base) < 0) S.base = years[1] || years[0];

        const cos = {}, types = {};
        rows.forEach(r => {
          if (r.Company) cos[r.Company] = 1;
          if (r["Distance Band"]) types[r["Distance Band"]] = 1;
        });

        /* THE LIKE-FOR-LIKE WINDOW. The comparison year runs to whatever calendar day the
           newest year has reached — never to the end of December, or a partial year is set
           against a full one and every state reads as collapsing. */
        function cutoff() {
          const cur = rows.filter(r => r.y === S.year).map(r => r.dk).sort();
          return cur.length ? cur[cur.length - 1] : "12-31";
        }

        function passes(r) {
          if (!S.showFacility && r.facility) return false;
          if (S.co && r.Company !== S.co) return false;
          if (S.type && r["Distance Band"] !== S.type) return false;
          return true;
        }

        function inWindow(r, y) {
          if (r.y !== y) return false;
          if (S.window === "match" && r.dk > cutoff()) return false;
          return true;
        }

        // ---------------------------------------------------------------- small helpers
        const num = n => (n == null ? "—" : Math.round(n).toLocaleString());
        const money = n => (n == null ? "—" : "$" + Math.round(n).toLocaleString());
        const pct = (n, d) => (d ? Math.round(1000 * n / d) / 10 : 0);

        function median(list) {
          const v = list.filter(x => x != null && !isNaN(x)).sort((a, b) => a - b);
          if (!v.length) return null;
          const m = Math.floor(v.length / 2);
          return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
        }
        function mean(list) {
          const v = list.filter(x => x != null && !isNaN(x));
          return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
        }

        /* The delta chip. It refuses to shout about a difference that a coin-flip would
           produce: on two counts the standard error is sqrt(a+b), and a gap inside one of
           those is reported as flat rather than as a trend. That single rule is what would
           have stopped "August is down 5.7%" (a 0.75-sigma wobble) reaching a blog post. */
        function delta(now, was, opts) {
          const o = opts || {};
          if (was == null || now == null) return '<span class="rlc-d flat">—</span>';
          const d = now - was;
          if (o.counts) {
            // TWO standard errors, not one. At one sigma Virginia's 2 -> 6 rendered as
            // "+200%" and Massachusetts' 42 -> 26 as "-38.1%", and both are what two small
            // counts do on their own. Two sigma suppresses those and still passes every
            // real movement on this page.
            const se = Math.sqrt(Math.max(1, now + was));
            if (Math.abs(d) < 2 * se) {
              return '<span class="rlc-d flat" title="within noise: on two counts this size '
                + "a gap this small is what chance produces\">~ flat</span>";
            }
          }
          if (!was) return '<span class="rlc-d flat">new</span>';
          const p = Math.round(1000 * d / Math.abs(was)) / 10;
          const cls = d > 0 ? "up" : (d < 0 ? "dn" : "flat");
          return '<span class="rlc-d ' + cls + '">' + (d > 0 ? "+" : "") + p + "%</span>";
        }

        // ---------------------------------------------------------------- the panels
        function tally(list, key) {
          const out = {};
          list.forEach(r => {
            const k = r[key];
            if (!k) return;
            out[k] = (out[k] || 0) + 1;
          });
          return out;
        }

        /* A ranked comparison table. It is always driven by the NEWEST year's ranking, with
           the prior year alongside, because a table sorted by change puts whatever is
           smallest and noisiest at the top. */
        function rankTable(cur, prev, key, label, limit) {
          const a = tally(prev, key), b = tally(cur, key);
          const rows = Object.keys(b).map(k => ({ k: k, now: b[k], was: a[k] || 0 }))
            .sort((x, y) => y.now - x.now).slice(0, limit || 10);
          const top = rows.length ? rows[0].now : 1;
          const tot = Object.values(b).reduce((s, n) => s + n, 0);
          return '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
            + "<th>" + esc(label) + '</th><th class="num">' + S.year + "</th>"
            + '<th class="num">' + S.base + '</th><th class="num">Change</th>'
            + '<th class="num">Share</th></tr></thead><tbody>'
            + rows.map(r => '<tr><td class="strong">' + esc(r.k) + "</td>"
                + '<td class="num">' + r.now
                + '<span class="rlc-bar"><i style="width:'
                + Math.round(100 * r.now / (top || 1)) + '%"></i></span></td>'
                + '<td class="num muted">' + r.was + "</td>"
                + '<td class="num">' + delta(r.now, r.was, { counts: true }) + "</td>"
                + '<td class="num muted">' + pct(r.now, tot) + "%</td></tr>").join("")
            + "</tbody></table></div>";
        }

        function monthChart(cur, prev) {
          const a = {}, b = {};
          prev.forEach(r => { a[r.mon] = (a[r.mon] || 0) + 1; });
          cur.forEach(r => { b[r.mon] = (b[r.mon] || 0) + 1; });
          const top = Math.max(...Object.values(a), ...Object.values(b), 1);
          // only the months the window actually covers: a like-for-like view stops in
          // August, and drawing Sep-Dec as four hairlines reads as a collapse in the autumn
          // rather than as months nobody asked about
          const last = S.window === "match" ? (+cutoff().slice(0, 2) || 12) : 12;
          let h = '<div class="rlc-mon">';
          for (let m = 1; m <= last; m++) {
            const av = a[m] || 0, bv = b[m] || 0;
            h += '<div class="m"><div class="pair">'
              + '<i class="a" style="height:' + Math.round(100 * av / top) + '%" title="'
              + S.base + " " + MON[m] + ": " + av + '"></i>'
              + '<i class="b" style="height:' + Math.round(100 * bv / top) + '%" title="'
              + S.year + " " + MON[m] + ": " + bv + '"></i>'
              + '</div><div class="lbl">' + MON[m] + "</div></div>";
          }
          h += "</div>";
          h += '<div class="rlc-key"><span><b style="background:'
            + 'color-mix(in srgb,var(--ink) 22%,transparent)"></b>' + S.base + "</span>"
            + '<span><b style="background:var(--brand)"></b>' + S.year + "</span>"
            + '<span class="muted">' + (S.window === "match"
                ? "both years cut at " + cutoff().replace("-", "/")
                : "full years") + "</span></div>";
          return h;
        }

        function statBlock(title, items) {
          return '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">' + esc(title) + "</div></div>"
            + '<div class="rlc-two">' + items.map(it =>
                '<div><div class="rlc-fig">' + it[0] + "</div>"
                + '<div class="rlc-sub">' + it[1] + "</div></div>").join("")
            + "</div></div>";
        }

        // ---------------------------------------------------------------- paint
        function paint() {
          if (!alive()) return;
          const all = rows.filter(passes);
          const cur = all.filter(r => inWindow(r, S.year));
          const prev = all.filter(r => inWindow(r, S.base));
          const hiddenFacility = rows.filter(r => r.facility
            && (inWindow(r, S.year) || inWindow(r, S.base))).length;

          const curMoves = cur.filter(r => r.isMove).length;
          const prevMoves = prev.filter(r => r.isMove).length;
          const interNow = cur.filter(r => r.inter === true).length;
          const interDen = cur.filter(r => r.inter != null).length;
          const interWas = prev.filter(r => r.inter === true).length;
          const interWasDen = prev.filter(r => r.inter != null).length;

          const billNow = median(cur.map(r => r.bill).filter(b => b > 0));
          const billWas = median(prev.map(r => r.bill).filter(b => b > 0));
          const milesNow = median(cur.map(r => r.miles));
          const aheadNow = median(cur.map(r => r.ahead));

          let html = '<div class="rlc">'
            + '<div class="rs-page-head"><h1>Relocation Trends</h1>'
            + "<p>The answers behind the trend report. <b>Every year-over-year on this page "
            + "is day-matched</b> — " + (S.window === "match"
                ? "both years are cut at " + cutoff().replace("-", "/") + ", so a partial "
                  + "year is never set against a whole one"
                : "<b>you have switched to full years, and " + S.year + " is not finished</b>")
            + '.<span class="freshness"> · completed jobs · the company\'s own storage '
            + "facility is excluded</span></p></div>";

          // ---- the tiles
          html += '<div class="rs-kpis" style="--kpi-cols:5">'
            + kpi(num(cur.length), "Jobs completed",
                  delta(cur.length, prev.length, { counts: true }) + " vs " + S.base, "")
            + kpi(num(curMoves), "Moves",
                  "a split job is one move on two days", "")
            + kpi(pct(interNow, interDen) + "%", "Crossed a state line",
                  "was " + pct(interWas, interWasDen) + "% in " + S.base, "")
            + kpi(money(billNow), "Median invoice",
                  delta(billNow, billWas) + " vs " + S.base + " · before tip", "")
            + kpi(aheadNow == null ? "—" : Math.round(aheadNow) + " days", "Booked ahead",
                  "median, from enquiry to move day", "")
            + "</div>";

          // ---- the controls
          html += '<div class="rs-bar">'
            + '<div id="rlcYear"></div>'
            + '<div id="rlcBase"></div>'
            + '<div class="rs-fld"><span>Window</span><div class="rs-seg" id="rlcWin">'
            + '<button data-w="match"' + (S.window === "match" ? ' class="on"' : "")
            + ">Like-for-like</button>"
            + '<button data-w="full"' + (S.window === "full" ? ' class="on"' : "")
            + ">Full year</button></div></div>"
            + '<div id="rlcCo"></div>'
            + '<div id="rlcType"></div>'
            + '<div class="rs-tog' + (S.showFacility ? " on" : "") + '" id="rlcFac"><i></i>'
            + "Include our own storage facility</div>"
            + '<span class="rs-spacer"></span>'
            + '<button class="rs-btn" id="rlcCsv">Download CSV · ' + cur.length + "</button>"
            + "</div>";

          if (S.window === "full" && S.year === years[0]) {
            html += '<div class="rs-hint"><b class="em">' + S.year + " is not over.</b> "
              + "These full-year figures compare " + cutoff().replace("-", "/") + " of "
              + S.year + " against twelve months of " + S.base + ", which will read as a "
              + "collapse in every category. Switch back to like-for-like before quoting "
              + "anything.</div>";
          }

          // ---- when people moved
          html += '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">When people moved</div><span class="n">'
            + num(cur.length) + " jobs</span></div>"
            + '<div class="rs-hint">Move volume by month. Summer is the season — June and '
            + "July carry roughly twice January's volume — and the shape repeats every "
            + "year, which is the part worth writing about.</div>"
            + monthChart(cur, prev) + "</div>";

          // ---- geography
          html += '<div class="rlc-grid">'
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">Where they moved from</div></div>'
            + '<div class="rs-hint">Origin state, ranked by ' + S.year + ".</div>"
            + rankTable(cur, prev, "Origin State", "State", 8) + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">Where they moved to</div></div>'
            + '<div class="rs-hint">Destination state, ranked by ' + S.year + ".</div>"
            + rankTable(cur, prev, "Dest State", "State", 8) + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">Busiest origin cities</div></div>'
            + rankTable(cur, prev, "Origin City", "City", 10) + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">Busiest destination cities</div></div>'
            + rankTable(cur, prev, "Dest City", "City", 10) + "</div>"
            + "</div>";

          // ---- how far
          const sameCounty = cur.filter(r => +r["Same County"] === 1).length;
          const sameDen = cur.filter(r => r["Same County"] != null).length;
          html += statBlock("How far people moved", [
            [pct(interNow, interDen) + "%", "crossed a state line (" + num(interNow) + " jobs)"],
            [pct(sameCounty, sameDen) + "%", "stayed inside the same county"],
            [milesNow == null ? "—" : Math.round(milesNow) + " mi",
             "median distance, straight line"],
            [num(mean(cur.map(r => r.miles))) + " mi",
             "average — dragged up by the cross-country jobs"],
          ]);

          // ---- what it cost
          const gapRaw = median(cur.map(r => r.gap));
          const gapEx = median(cur.map(r => r.gapEx));
          const overRaw = cur.filter(r => r.gap != null && r.gap > 0).length;
          const overDen = cur.filter(r => r.gap != null).length;
          const overEx = cur.filter(r => r.gapEx != null && r.gapEx > 0).length;
          html += '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">What a move cost, and how close the quote was</div>'
            + "</div>"
            + '<div class="rs-hint">The invoice is <b>before tip</b>, and a tip is recorded '
            + "on three quarters of jobs — so what customers actually handed over is around "
            + "11% higher than the figure on the left. <b>The quote gap is shown twice on "
            + 'purpose:</b> the raw gap counts packing materials the quote never covered, '
            + "and it is the reason a draft of this report was about to claim that most "
            + "moves finish over estimate.</div>"
            + '<div class="rlc-two">'
            + '<div><div class="rlc-fig">' + money(billNow) + '</div><div class="rlc-sub">'
            + "median invoice · " + delta(billNow, billWas) + " vs " + S.base + "</div></div>"
            + '<div><div class="rlc-fig">' + money(mean(cur.map(r => r.bill))) + "</div>"
            + '<div class="rlc-sub">average invoice</div></div>'
            + '<div><div class="rlc-fig">' + money(gapEx) + '</div><div class="rlc-sub">'
            + "median gap to quote, <b>excluding materials</b></div></div>"
            + '<div><div class="rlc-fig">' + pct(overEx, overDen) + '%</div><div class="rlc-sub">'
            + "finished above quote once materials are set aside</div></div>"
            + '<div><div class="rlc-fig muted">' + money(gapRaw) + "</div>"
            + '<div class="rlc-sub">raw gap — <b>do not publish this one</b> ('
            + pct(overRaw, overDen) + "% over)</div></div>"
            + "</div></div>";

          // ---- size, packing, storage
          const pkFull = cur.filter(r => r["Packing Service"] === "Full Packing").length;
          const pkPart = cur.filter(r => r["Packing Service"] === "Partial Packing").length;
          // ONLY 'Our Storage' MEANS STORAGE. The column also carries 'Mini Van Job'
          // (209 rows in 2024), 'Truck' and 'Delivered', and counting any non-blank value
          // put the 2024 storage rate at five times the truth.
          const stor = cur.filter(r => r.Storage === "Our Storage").length;
          const storWas = prev.filter(r => r.Storage === "Our Storage").length;
          html += '<div class="rlc-grid">'
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">How big the moves were</div></div>'
            + rankTable(cur, prev, "Size of Move", "Size of move", 8) + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">Packing and storage</div></div>'
            + '<div class="rs-hint">From the sales-side packing field, not the materials '
            + "charge — nearly every job carries some materials, and counting those as a "
            + '"packing service" would put the figure above 80%. Treat these as floors: a '
            + "blank flag does not prove nothing was packed.</div>"
            + '<div class="rlc-two">'
            + '<div><div class="rlc-fig">' + pct(pkFull, cur.length) + "%</div>"
            + '<div class="rlc-sub">booked <b>full</b> packing (' + num(pkFull) + ")</div></div>"
            + '<div><div class="rlc-fig">' + pct(pkPart, cur.length) + "%</div>"
            + '<div class="rlc-sub">booked <b>partial</b> packing (' + num(pkPart) + ")</div></div>"
            + '<div><div class="rlc-fig muted">' + num(stor) + "</div>"
            + '<div class="rlc-sub">jobs flagged storage — <b>not a usable rate</b>, see '
            + "below (" + num(storWas) + " in " + S.base + ")</div></div>"
            + '</div><div class="rs-hint" style="margin:12px 0 0"><b class="em">Storage '
            + "cannot be answered from this page.</b> The closing sheet flagged storage on "
            + num(storWas) + " jobs in " + S.base + " and only " + num(stor) + " so far in "
            + S.year + ", while the storage register recorded a comparable number of "
            + "customers entering storage in both years — so the fall is the flag going "
            + "unfilled, not demand falling. Storage Control is the report that owns this "
            + "question.</div></div></div>";

          // ---- the panel nobody may skip
          html += '<div class="rlc-warn"><h3>Before any of this is published</h3>'
            + "<p>Eight things a review pass caught on the way to print. The first four "
            + "are handled by this page; the last three are judgement calls for whoever "
            + "writes the post.</p><ul>"
            + "<li><b>Never compare a part-year to a whole year.</b> Set against a full "
            + "2025, New Jersey reads as down 22% when it is actually up 15%. This page is "
            + "day-matched unless you switch it off.</li>"
            + "<li><b>Zip 07753 is our own warehouse, not a city.</b> It was ranking as the "
            + "third most popular destination in the country because goods go into storage "
            + "and later come out. Excluded here — <b>" + hiddenFacility + "</b> legs in "
            + "this window.</li>"
            + "<li><b>The quote is accurate; materials are extra.</b> The raw gap says most "
            + "jobs finish over estimate. Take out the packing materials the quote never "
            + "covered and the median gap is about zero.</li>"
            + "<li><b>Rising bills are not all rising prices.</b> The median invoice is up "
            + "sharply, but roughly half of that is bigger loads, not higher rates — and "
            + "2025 was a dip, so compare against 2024 too before calling it a trend.</li>"
            + '<li class="no"><b>Massachusetts is us, not the market.</b> The Boston '
            + "operation wound down — 92 jobs in 2025 against 11 this year — so any fall in "
            + "Massachusetts is our own decision showing up as a trend. The same caution "
            + "applies in reverse to Delaware and Connecticut, where part of the growth is "
            + "the Tuji and Zip to Zip company mix rather than the market.</li>"
            + '<li class="no"><b>Do not publish net inbound or outbound by state.</b> We '
            + "book moves out of our service area and almost never one back into it, so "
            + "Florida looks like a huge net gain by construction. It says nothing about "
            + "where Americans are moving.</li>"
            + '<li class="no"><b>The Storage Trends section cannot be written from '
            + "here.</b> The closing sheet's storage flag has stopped being filled — "
            + "113 jobs across all of 2025 against 10 so far this year, and the same "
            + "collapse shows in the day-matched counts above — while the register shows "
            + "storage entries "
            + "holding up. And duration is worse: leave dates were only recorded from March "
            + "2025 and a quarter of customers are still in storage, so every average is "
            + "biased low. If storage must appear, quote the median stay of about six weeks "
            + "with the count beside it, and never a mean.</li>"
            + '<li class="no"><b>Three questions in the brief have no data at all:</b> '
            + "customer age, reason for moving, and search demand. Nothing in the warehouse "
            + "carries them, and a keyword-scrape of sales notes reaches under 3% coverage. "
            + "They need to come out of the outline, or from a new survey question.</li>"
            + "</ul></div>";

          html += "</div>";
          host.innerHTML = html;
          wire(cur);
        }

        function kpi(val, lab, sub, cls) {
          return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
            + '</div><div class="v">' + val + '</div><div class="s">' + sub + "</div></div>";
        }

        function wire(cur) {
          if (!alive()) return;
          // the four dropdowns are kit slicers (RSC.localSelect) — no native <select> on
          // the portal. Option values stay the exact strings the old options carried.
          const y = host.querySelector("#rlcYear");
          if (y) RSC.localSelect(y, {
            label: "Compare", values: years.map(String), value: String(S.year),
            required: true,
            onChange: function (v) { S.year = +v; paint(); },
          });
          const b = host.querySelector("#rlcBase");
          if (b) RSC.localSelect(b, {
            label: "Against", values: years.map(String), value: String(S.base),
            required: true,
            onChange: function (v) { S.base = +v; paint(); },
          });
          host.querySelectorAll("#rlcWin button").forEach(btn => {
            btn.onclick = () => { S.window = btn.dataset.w; paint(); };
          });
          const co = host.querySelector("#rlcCo");
          if (co) RSC.localSelect(co, {
            label: "Company", values: Object.keys(cos).sort(), value: S.co,
            allLabel: "All",
            onChange: function (v) { S.co = v; paint(); },
          });
          const tp = host.querySelector("#rlcType");
          if (tp) RSC.localSelect(tp, {
            label: "Move type", values: Object.keys(types).sort(), value: S.type,
            allLabel: "All",
            onChange: function (v) { S.type = v; paint(); },
          });
          const fac = host.querySelector("#rlcFac");
          if (fac) fac.onclick = () => { S.showFacility = !S.showFacility; paint(); };

          const csv = host.querySelector("#rlcCsv");
          if (csv) csv.onclick = () => {
            const cols = ["Date", "Month", "Company", "Moving Type", "Distance Band",
                          "Size of Move", "Cubic Feet", "Packing Service", "Storage",
                          "Origin City", "Origin County", "Origin State",
                          "Dest City", "Dest County", "Dest State", "Interstate", "Miles",
                          "Total Bill", "Materials", "Quote", "Quote Gap",
                          "Quote Gap Ex Materials", "Booked Days Ahead"];
            const cell = x => {
              let s = String(x == null ? "" : x);
              // a value opening as a live Excel formula is a real attack surface
              if (/^[=+\-@]/.test(s)) s = " " + s;
              return '"' + s.replace(/"/g, '""') + '"';
            };
            const lines = [cols.map(cell).join(",")].concat((cur || []).map(r =>
              cols.map(c => cell(r[c])).join(",")));
            // the BOM is for Excel: without it a Georgian name opens as mojibake
            const blob = new Blob(["﻿" + lines.join("\r\n")],
                                  { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "relocation-trends-" + S.year + ".csv";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          };
        }

        paint();
      }).catch(e => {
        if (!alive()) return;
        host.innerHTML = '<div class="panel">Could not load the relocation data — '
          + esc(e && e.message || e) + "</div>";
      });
    },
  });
})();
