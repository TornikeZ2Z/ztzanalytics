/* JOBS BY AREA — how many jobs we did, cut three ways on one screen.
 *
 * Marketing's ask (Tornike, 2026-08-20): job counts for the summer season both as a total
 * and month by month (June, July, August), jobs per state, and the top three counties
 * inside each state. One page, one number, three views of it.
 *
 * A JOB IS A CLOSING ROW — every Record Source, which is what the portal's own `Total Jobs`
 * measure counts, so this page and the Monthly Report can never disagree. A request that
 * came back (storage out, a split load, a re-delivery) is real work done twice and counts
 * twice; the page says so out loud rather than leaving it to be guessed.
 *
 * Geography is the PICKUP zip. A job whose zip never parsed has no county AND no state, so
 * the mart gives that bucket a name instead of an em dash — it is bigger than several real
 * states and Marketing would otherwise have to ask what it is.
 *
 * THE RUNNING MONTH IS NOT A RESULT. An unfinished month sitting beside finished ones is
 * the single easiest thing to misread on a page about which months are strong, so it is
 * marked everywhere it appears and excluded from the year-on-year comparison, which says
 * which months it actually compared.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.jobs_geo) {
    RS.DATASETS.jobs_geo = {
      table: "mart_jobs_geo",
      cols: ["yr", "mo", "Company", "State", "State Name", "County", "Jobs"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("jba-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "jba-style";
    // The bar, fields, segments, selects, tiles, cards, tables and pills all come from THE
    // COMPONENT KIT in rs.css. Only what the kit has no name for lives here.
    st.textContent = ""
      + ".jba{font-variant-numeric:tabular-nums}"
      // a share bar behind the number: the eye ranks states before it reads them
      + ".jba-bar{position:relative;display:block;height:6px;border-radius:4px;"
      + "background:color-mix(in srgb,var(--ink) 7%,transparent);margin-top:5px;overflow:hidden}"
      + ".jba-bar i{display:block;height:100%;border-radius:4px;background:var(--brand)}"
      // the state label shows once per group, so the eye can see where one state's
      // counties end and the next begins
      + ".jba-grp td{border-top:2px solid var(--line-2)}"
      + ".jba-st{font-weight:750;color:var(--ink)}"
      + ".jba-rank{display:inline-block;min-width:18px;color:var(--faint);font-weight:800}"
      // the running month, wherever it appears
      + ".jba-part{color:var(--warn);font-weight:700}";
    document.head.appendChild(st);
  }

  const MON = ["", "January", "February", "March", "April", "May", "June",
               "July", "August", "September", "October", "November", "December"];
  const MON3 = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  /* A season is a list of {month, yearOffset}: winter starts in the PREVIOUS December, so
     it cannot be assembled out of three months that never followed one another. */
  const M = (mo, off) => ({ mo: mo, off: off || 0 });
  const SEASONS = {
    summer: { lab: "Summer", parts: [M(6), M(7), M(8)] },
    spring: { lab: "Spring", parts: [M(3), M(4), M(5)] },
    autumn: { lab: "Autumn", parts: [M(9), M(10), M(11)] },
    winter: { lab: "Winter", parts: [M(12, -1), M(1), M(2)], spans: true },
    year:   { lab: "Whole year", parts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => M(m)) },
  };

registerPage({
  id: "jobs-by-area",
  group: "marketing",
  title: "Jobs by Area",
  subtitle: "How many jobs we did — for the season and month by month, per state, and the " +
            "top counties inside each state.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    // whole percents everywhere except the long tail, where every county would read "0%"
    const pct = (a, b) => {
      if (!b) return "—";
      const x = a / b * 100;
      return (x > 0 && x < 1 ? x.toFixed(1) : String(Math.round(x))) + "%";
    };

    const S = window.__JBA || (window.__JBA = { year: null, season: "summer", co: "" });
    injectStyle();
    host.innerHTML = '<div class="jba"><div class="panel">Loading jobs…</div></div>';
    const mine = host.querySelector(".jba");
    // #content is ONE element reused by every report: if the reader navigates away while
    // the mart is still loading, this render must not paint over whatever they opened next
    const alive = () => host.querySelector(".jba") === mine;

    // NY, because that is the working day these jobs belong to
    const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const NOW_Y = +TODAY.slice(0, 4), NOW_M = +TODAY.slice(5, 7);

    return RS.load("jobs_geo").then(rows => {
      if (!alive()) return;
      rows = (rows || []).map(r => ({
        yr: +r.yr, mo: +r.mo, co: r.Company || "Unknown",
        st: r.State || "No zip", stName: r["State Name"] || r.State || "No zip",
        county: r.County || "County unknown", jobs: +r.Jobs || 0,
      }));
      if (!rows.length) {
        mine.innerHTML = '<div class="panel">No jobs found — the mart may not be built yet '
          + "(run sources=curated) or there is nothing to show.</div>";
        return;
      }

      const years = [...new Set(rows.map(r => r.yr))].filter(Boolean).sort((a, b) => b - a);
      const cos = [...new Set(rows.map(r => r.co))].filter(Boolean).sort();
      if (!S.year || years.indexOf(S.year) < 0) S.year = years[0];

      /* the concrete (year, month) pairs a season resolves to for a given year */
      const monthsOf = (season, year) =>
        SEASONS[season].parts.map(p => ({ mo: p.mo, yr: year + (p.off || 0) }));
      const isPartial = m => m.yr === NOW_Y && m.mo === NOW_M;
      const isFuture = m => m.yr > NOW_Y || (m.yr === NOW_Y && m.mo > NOW_M);

      function sumOf(list, co) {
        const key = {};
        list.forEach(m => { key[m.yr + "-" + m.mo] = 1; });
        return rows.filter(r => key[r.yr + "-" + r.mo] && (!co || r.co === co));
      }

      function paint() {
        if (!alive()) return;
        const months = monthsOf(S.season, S.year).filter(m => !isFuture(m));
        const v = sumOf(months, S.co);
        const total = v.reduce((a, r) => a + r.jobs, 0);
        const label = SEASONS[S.season].lab + " "
          + (SEASONS[S.season].spans ? (S.year - 1) + "/" + String(S.year).slice(2) : S.year);

        /* ---- 1. the season, and each month inside it ---- */
        const byMonth = {};
        v.forEach(r => { byMonth[r.yr + "-" + r.mo] = (byMonth[r.yr + "-" + r.mo] || 0) + r.jobs; });

        // LIKE FOR LIKE: the running month is excluded from both sides, and the tile says so
        const done = months.filter(m => !isPartial(m));
        const partial = months.filter(isPartial);
        const prevMonths = done.map(m => ({ mo: m.mo, yr: m.yr - 1 }));
        const doneNow = sumOf(done, S.co).reduce((a, r) => a + r.jobs, 0);
        const prev = sumOf(prevMonths, S.co).reduce((a, r) => a + r.jobs, 0);
        const delta = prev ? Math.round((doneNow / prev - 1) * 100) : null;

        const kpi = (val, lab, sub, cls) =>
          '<div class="kpi' + (cls ? " " + cls : "") + '"><div class="l">' + esc(lab)
          + '</div><div class="v">' + esc(val) + '</div><div class="s">' + sub + "</div></div>";

        // the kit caps a tile row at six and balances the rest into equal rows
        const nT = months.length + 1;
        const kpiCols = Math.ceil(nT / Math.ceil(nT / 6));

        let h = '<div class="rs-kpis" style="--kpi-cols:' + kpiCols + '">'
          + kpi(fmtN(total), label,
                delta == null
                  ? "jobs done in these months"
                  : (partial.length
                      ? '<span class="' + (delta >= 0 ? "up" : "down") + '">'
                        + (delta >= 0 ? "+" : "") + delta + "%</span> on the same "
                        + (done.length === 1 ? "month" : done.length + " months")
                        + " last year — " + MON[partial[0].mo] + " is still running and is "
                        + "left out of both sides"
                      : '<span class="' + (delta >= 0 ? "up" : "down") + '">'
                        + (delta >= 0 ? "+" : "") + delta + "%</span> vs "
                        + fmtN(prev) + " a year earlier"))
          + months.map(m => kpi(fmtN(byMonth[m.yr + "-" + m.mo] || 0),
              MON[m.mo] + (SEASONS[S.season].spans ? " " + m.yr : ""),
              isPartial(m)
                ? '<span class="jba-part">still running — ' + TODAY.slice(8, 10)
                  + " days so far</span>"
                : esc(total ? pct(byMonth[m.yr + "-" + m.mo] || 0, total) + " of the season"
                            : "—"))).join("")
          + "</div>";

        /* ---- the bar ---- */
        h += '<div class="rs-bar">'
          + '<div class="rs-fld"><span>Season</span><div class="rs-seg" id="jbaSeason">'
          + Object.keys(SEASONS).map(k => '<button data-s="' + k + '"'
              + (k === S.season ? ' class="on"' : "") + ">" + esc(SEASONS[k].lab)
              + "</button>").join("")
          + "</div></div>"
          + '<div id="jbaYear"></div>'
          + (cos.length > 1 ? '<div id="jbaCo"></div>' : "")
          + "</div>"
          + '<p class="rs-hint">A job is a <b>closing</b> — the same thing the Monthly Report '
          + "counts, so the two always agree. A move that came back (storage out, a split "
          + "load, a re-delivery) is work done twice and counts twice. A job belongs to the "
          + "month it was <b>done</b> in and to the state and county it was <b>picked up</b> "
          + "from. All three sections below are sums over the same jobs.</p>";

        if (!v.length) {
          h += '<div class="panel">Nothing in this slice — no jobs for '
            + esc(label) + (S.co ? " under " + esc(S.co) : "") + ".</div>";
          mine.innerHTML = h;
          wire();
          return;
        }

        /* ---- 2. jobs per state ---- */
        const stMap = {};
        v.forEach(r => {
          const o = stMap[r.st] = stMap[r.st] || { st: r.st, name: r.stName, jobs: 0, m: {} };
          o.jobs += r.jobs;
          o.m[r.yr + "-" + r.mo] = (o.m[r.yr + "-" + r.mo] || 0) + r.jobs;
        });
        const states = Object.values(stMap).sort((a, b) => b.jobs - a.jobs);

        h += '<div class="panel"><div class="panel-head">'
          + '<span class="panel-title">Jobs per state</span>'
          + '<span class="rs-hint" style="margin:0">' + states.length + " state"
          + (states.length === 1 ? "" : "s") + " · " + fmtN(total) + " jobs</span></div>"
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
          + "<th>State</th>"
          + months.map(m => '<th class="num">' + MON3[m.mo]
              + (isPartial(m) ? "*" : "") + "</th>").join("")
          + '<th class="num">Jobs</th><th class="num">Share</th>'
          + "<th>Share of the season</th></tr></thead><tbody>"
          + states.map(s => "<tr><td>"
              + '<span class="jba-st">' + esc(s.st) + "</span>"
              + (s.name && s.name !== s.st
                  ? '<span class="rs-why">' + esc(s.name) + "</span>" : "")
              + "</td>"
              + months.map(m => '<td class="num muted">'
                  + fmtN(s.m[m.yr + "-" + m.mo] || 0) + "</td>").join("")
              + '<td class="num strong">' + fmtN(s.jobs) + "</td>"
              + '<td class="num">' + pct(s.jobs, total) + "</td>"
              // the bar and the column next to it measure THE SAME THING
              + '<td style="min-width:170px"><span class="jba-bar"><i style="width:'
              + (total ? Math.round(s.jobs / total * 100) : 0) + '%"></i></span></td></tr>')
              .join("")
          + "</tbody></table></div>"
          + (partial.length
              ? '<p class="rs-hint" style="margin:10px 0 0">* ' + MON[partial[0].mo]
                + " is still running.</p>" : "")
          + "</div>";

        /* ---- 3. the top three counties inside each state ---- */
        const cMap = {};
        v.forEach(r => {
          const k = r.st + "|" + r.county;
          const o = cMap[k] = cMap[k] || { st: r.st, county: r.county, jobs: 0 };
          o.jobs += r.jobs;
        });
        const byState = {};
        Object.values(cMap).forEach(c => (byState[c.st] = byState[c.st] || []).push(c));

        h += '<div class="panel"><div class="panel-head">'
          + '<span class="panel-title">Top counties in each state</span>'
          + '<span class="rs-hint" style="margin:0">three biggest per state, by jobs picked '
          + "up there</span></div>"
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
          + "<th>State</th><th>#</th><th>County</th>"
          + '<th class="num">Jobs</th><th class="num">Of the state</th>'
          + '<th class="num">Of the season</th></tr></thead><tbody>'
          + states.map(s => {
              const all = (byState[s.st] || []).sort((a, b) => b.jobs - a.jobs);
              const list = all.slice(0, 3);
              const restJobs = all.slice(3).reduce((a, c) => a + c.jobs, 0);
              const restN = all.length - list.length;
              return list.map((c, i) =>
                '<tr' + (i === 0 ? ' class="jba-grp"' : "") + ">"
                + "<td>" + (i === 0 ? '<span class="jba-st">' + esc(s.st) + "</span>" : "") + "</td>"
                + '<td><span class="jba-rank">' + (i + 1) + "</span></td>"
                + "<td>" + esc(c.county) + "</td>"
                + '<td class="num strong">' + fmtN(c.jobs) + "</td>"
                + '<td class="num">' + pct(c.jobs, s.jobs) + "</td>"
                + '<td class="num muted">' + pct(c.jobs, total) + "</td></tr>").join("")
                // the rest is a ROW, not a footnote: the three sections promise to tie out,
                // so the jobs the top three leave behind have to be visible
                + (restN > 0
                    ? '<tr><td></td><td></td><td class="dim">' + restN + " other count"
                      + (restN === 1 ? "y" : "ies") + '</td><td class="num dim">'
                      + fmtN(restJobs) + '</td><td class="num dim">' + pct(restJobs, s.jobs)
                      + '</td><td class="num dim">' + pct(restJobs, total) + "</td></tr>"
                    : "");
            }).join("")
          + "</tbody></table></div>"
          + '<p class="rs-hint" style="margin:10px 0 0"><b>County unknown</b> means the zip '
          + "carries no county in the postal reference; <b>No zip</b> means the closing sheet "
          + "had no usable pickup address, so that job has neither a state nor a county. "
          + "Both still count in the season total — nothing is quietly dropped.</p></div>";

        mine.innerHTML = h;
        wire();
      }

      function wire() {
        if (!alive()) return;
        // the kit's localSelect, never a native dropdown; option values stay the exact
        // strings the old <option>s carried (year as String(y), company as the raw name)
        const yr = mine.querySelector("#jbaYear");
        if (yr) RSC.localSelect(yr, { label: "Year",
          values: years.map(y => String(y)), value: String(S.year), required: true,
          onChange: function (v) { S.year = +v; paint(); } });
        const co = mine.querySelector("#jbaCo");
        if (co) RSC.localSelect(co, { label: "Company",
          values: cos, value: S.co, allLabel: "Both books",
          onChange: function (v) { S.co = v; paint(); } });
        mine.querySelectorAll("#jbaSeason button").forEach(b => {
          b.onclick = () => { S.season = b.dataset.s; paint(); };
        });
      }

      paint();
    }).catch(e => {
      if (!alive()) return;
      mine.innerHTML = '<div class="panel">Could not load the jobs — '
        + esc(e && e.message || e) + "</div>";
    });
  },
});
})();
