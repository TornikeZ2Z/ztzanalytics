/* GO page: Reviews — platform review production, score quality, and goal tracking.
   PBI source: General Overview "Reviews" (05-dashboards.md GO-9). The PBI page is a
   Forman×Month pivot (Total Jobs / Total Reviews Written / Reviews to Jobs Ratio);
   rebuilt here around the review datasets themselves (platform breakdown + factual
   counts vs goals), which PBI never surfaced. */
registerPage({
  id: "reviews",
  group: "customers",
  title: "Reviews",
  async render(host) {
    const [bdAll, cntAll, goalAll] = await Promise.all([
      RS.load("reviews_breakdown"), RS.load("review_counts"), RS.load("review_goals")]);
    const bd = RS.filtered("reviews_breakdown", bdAll);
    const counts = RS.filtered("review_counts", cntAll);
    const goals = RS.filtered("review_goals", goalAll);
    const M = RS.M;

    if (!bd.length && !counts.length && !goals.length) {
      host.innerHTML = `
        <div class="rs-page-head">
          <h1>Reviews</h1>
          <p>Platform review production vs goals</p>
        </div>
        <div class="panel" style="padding:18px;color:var(--muted)">No data for the current filters — adjust or clear the filter bar above.</div>`;
      return;
    }

    const truthy = v => { const s = String(v == null ? "" : v).trim().toLowerCase();
      return s === "1" || s === "true" || s === "yes" || RS.num(v) > 0; };
    const isCounted = r => truthy(r["Counts"]);   // warehouse stores 'Yes'/'No'
    const nRev = r => RS.num(r["Number of Reviews"]);
    const mk = r => r._y + "-" + String(r._m).padStart(2, "0");
    const mLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(2, 4);
    const nf = v => v == null ? "—" : RS.fmtN(v);   // null-safe count formatter for tables
    /* Friendly empty states, cohesive with the page-level "No data" panel.
       emptyChart writes a muted note into the card's chartbox and returns null
       (chartCard tolerates a null chart); emptyTable returns a muted note string. */
    const emptyChart = (canvas, msg) => {
      const box = canvas && (canvas.closest(".chartbox") || canvas.parentNode);
      if (box) box.innerHTML =
        `<div style="height:100%;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px;text-align:center;padding:18px">${msg}</div>`
        // keep a canvas in the DOM so a later Graph⇄Tabular toggle can still re-render.
        + `<canvas style="display:none"></canvas>`;
      return null;
    };
    const emptyTable = msg =>
      `<div style="padding:14px 4px;color:var(--muted);font-size:13px">${msg}</div>`;

    const written = M["Counted Reviews Written"].fn(bd);
    const avgScore = M["Review Score (avg)"].fn(bd);
    // No PBI measure exists for image share — portal addition (counted reviews w/ image).
    const withImage = bd.filter(r => isCounted(r) && truthy(r["With Image"]))
      .reduce((a, r) => a + nRev(r), 0);
    const factual = M["Total Factual Reviews"].fn(counts);
    const goalTotal = M["Review Goal"].fn(goals);

    /* Goal attainment (audit F6-A) — portal addition (no PBI measure). Both datasets are
       CUMULATIVE: review_counts rows are monthly platform snapshots and review_goals are
       cumulative targets at semiannual checkpoints — never sum either across months.
       Numerator = LATEST snapshot restricted to goal-covered Company|Platform buckets
       (reuses the measure's latest-per-platform logic); denominator = latest goal total. */
    const pkey = r => (r.Company || "—") + "|" + (r.Platform || "—");   // rs-core grain
    const goalPlats = new Set(goals.filter(r => nRev(r) > 0).map(pkey));
    const factualInGoal =
      M["Total Factual Reviews"].fn(counts.filter(r => goalPlats.has(pkey(r))));
    const attainment = goalTotal ? factualInGoal / goalTotal : null;
    // Next-checkpoint label for KPI subs (e.g. "Sep 2026"), from the latest goal date.
    const goalMaxD = goals.reduce((a, r) => (nRev(r) > 0 && r._d && r._d > a ? r._d : a), "");
    const goalWhen = goalMaxD
      ? RS.monthName(+goalMaxD.slice(5, 7)) + " " + goalMaxD.slice(0, 4) : "";
    // F6-D: coverage sub-label — the flow KPI (parsed breakdown, 2025+) must not read
    // like the lifetime snapshot KPIs sitting next to it.
    const bdCov = RS.coverage(bdAll);
    const countedSub = "counted reviews, " + (bdCov.from
      ? RS.monthName(+bdCov.from.slice(5, 7)) + " " + bdCov.from.slice(0, 4) : "Jan 2025") +
      " → today";

    /* Headline YoY chips: YTD window (Jan-1 → max date of the filtered rows) vs the
       same window last year, evaluated on the date-UNfiltered dataset (year/month
       slicers lifted too, or the prior-year window would filter itself away). */
    const yoyChip = (ds, allRows, scopedRows, valFn) => {
      const maxD = scopedRows.reduce((a, r) => (r._d && r._d > a ? r._d : a), "");
      if (!maxD) return "";
      const winVal = (from, to) => {
        const s = RS.state;
        const save = { f: s.dateFrom, t: s.dateTo, y: s.multi.year, m: s.multi.month };
        s.dateFrom = from; s.dateTo = to; s.multi.year = null; s.multi.month = null;
        const v = valFn(RS.filtered(ds, allRows));
        s.dateFrom = save.f; s.dateTo = save.t; s.multi.year = save.y; s.multi.month = save.m;
        return v;
      };
      const y = +maxD.slice(0, 4);
      const cur = winVal(y + "-01-01", maxD);
      const prev = winVal((y - 1) + "-01-01", (y - 1) + maxD.slice(4));
      if (!prev || cur == null) return "";
      const g = (cur - prev) / Math.abs(prev);
      return `<span class="${g >= 0 ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${(100 * Math.abs(g)).toFixed(1)}%</span>`;
    };
    const writtenChip = yoyChip("reviews_breakdown", bdAll, bd,
      rs => M["Counted Reviews Written"].fn(rs));
    const factualChip = yoyChip("review_counts", cntAll, counts,
      rs => M["Total Factual Reviews"].fn(rs));

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Reviews</h1>
        <p>Platform review production vs goals ·
           <b>${RS.fmtN(written)}</b> counted reviews in scope
           <span class="freshness">· Counted = reviews the platform actually publishes toward our rating (excludes filtered/removed ones)
           · Factual Reviews = what was actually on the platforms at the end of the month (recorded monthly)</span></p>
      </div>
      <div class="rs-kpis" id="rvKpis"></div>
      <div id="rvMain"></div>
      <div class="rs-grid2" id="rvSubs"></div>`;

    RSC.kpis(document.getElementById("rvKpis"), [
      { label: "Counted Reviews", value: RS.fmtN(written), sub: countedSub },
      // fixed 2 decimals: fmt1 renders 4.97 as "5", hiding real movement in the score
      { label: "Review Score", value: (avgScore == null || isNaN(avgScore)) ? "—" : Number(avgScore).toFixed(2), sub: "avg over counted reviews" },
      { label: "With Image", value: RS.fmtN(withImage),
        sub: RS.fmtPct(written ? withImage / written : null) + " of counted" },
      { label: "Total Factual Reviews", value: RS.fmtN(factual), sub: "actually on the platforms at month-end · latest recorded month" },
      { label: "Review Goal", value: RS.fmtN(goalTotal),
        sub: "cumulative target, " + (goalWhen ? goalWhen + " checkpoint" : "latest checkpoint") },
      { label: "Goal Attainment", value: RS.fmtPct(attainment),
        sub: goalWhen ? "progress toward the next target (" + goalWhen + ")"
                      : "latest snapshot vs latest goal, goal-covered platforms" },
    ]);
    /* RSC.kpis escapes subs — inject the YoY chips (HTML) after render. */
    const kpiSubs = document.querySelectorAll("#rvKpis .kpi .s");
    if (writtenChip) kpiSubs[0].innerHTML =
      RSC.esc(countedSub) + " · " + writtenChip + " vs same period LY";
    if (factualChip) kpiSubs[3].innerHTML =
      "month-end actual on the platforms · " + factualChip + " vs a year ago";

    /* ---------------- main: reviews by platform (breakdown Source, counted) ------- */
    const platG = {};
    bd.forEach(r => { const k = (r.Source == null || r.Source === "") ? "—" : String(r.Source);
      (platG[k] = platG[k] || []).push(r); });
    const plats = Object.entries(platG).map(([k, rs]) => ({
      k,
      v: M["Counted Reviews Written"].fn(rs),
      score: M["Review Score (avg)"].fn(rs),
      img: rs.filter(x => isCounted(x) && truthy(x["With Image"])).reduce((a, x) => a + nRev(x), 0),
    })).filter(x => x.v > 0).sort((a, b) => b.v - a.v);

    RSC.chartCard(document.getElementById("rvMain"), {
      title: "Reviews by platform",
      controlsHtml: `<span class="lbl">counted reviews · top 12 + all others</span>`,
      controlsGraphOnly: true,   // the label describes the chart's top-12 grouping; the table lists up to 50
      buildChart(canvas) {
        if (!plats.length) return emptyChart(canvas, "No counted reviews for the current filters.");
        let list = plats.slice(0, 12);
        const rest = plats.slice(12);
        if (rest.length) list = list.concat([{
          k: "All others (" + rest.length + ")",
          v: rest.reduce((a, x) => a + x.v, 0),
        }]);
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: list.map(x => x.k),
            datasets: [{ label: "Reviews Written", data: list.map(x => x.v),
              backgroundColor: list.map((x, i) => (rest.length && i === list.length - 1) ? "#6b7a88" : "#b7e23b"),
              borderRadius: 5 }],
          },
          options: {
            indexAxis: "y",
            responsive: true, maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: { callbacks: { label: c => {
                const p = plats.find(x => x.k === c.label);
                return "Reviews: " + RS.fmtN(c.raw) +
                  (p && p.score != null ? " · avg score " + RS.fmt1(p.score) : "") +
                  (written ? " · " + (100 * c.raw / written).toFixed(1) + "%" : "");
              } } },
            },
            scales: { x: { ticks: { precision: 0 } } },
          },
        });
      },
      buildTable() {
        if (!plats.length) return emptyTable("No counted reviews for the current filters.");
        const shown = plats.slice(0, 50);
        const note = plats.length > shown.length
          ? `<div style="color:var(--muted);font-size:12px;padding:6px 2px">showing ${shown.length} of ${plats.length} platforms — the Total row covers all.</div>` : "";
        return RSC.table(
          [{ key: "r", label: "#" },
           { key: "k", label: "Platform" },
           { key: "v", label: "Reviews Written", fmt: nf },
           { key: "sh", label: "% of total", fmt: RS.fmtPct },
           { key: "score", label: "Avg Score", fmt: RS.fmt1 },
           { key: "img", label: "With Image", fmt: nf },
           { key: "imgsh", label: "% w/ image", fmt: RS.fmtPct }],
          shown.map((x, i) => ({
            r: i + 1, k: x.k, v: x.v,
            sh: written ? x.v / written : null,
            score: x.score, img: x.img,
            imgsh: x.v ? x.img / x.v : null,
          })),
          { r: "", k: "Total", v: written, sh: written ? 1 : null,
            score: avgScore, img: withImage, imgsh: written ? withImage / written : null }) + note;
      },
    });

    /* ---------------- month buckets shared by both sub-cards ---------------- */
    /* Flow recast (audit F6-B/E): review_counts rows are CUMULATIVE snapshots, so summing
       them across months is meaningless (the old footer's 164,349). The per-month business
       number is the month-over-month DELTA per Company|Platform bucket. Carry each
       platform's last known snapshot forward through missing months before differencing
       (a skipped snapshot means "no new entry", not zero — the fake −1,054 Jun-26 dip),
       and start differencing only after a platform's first snapshot (its opening value is
       lifetime history, not that month's production). */
    const snapByPlat = {};                    // Company|Platform -> { monthKey: {v, d} }
    counts.forEach(r => {
      const p = pkey(r), k = mk(r);
      const g = snapByPlat[p] = snapByPlat[p] || {};
      if (!g[k] || (r._d || "") >= g[k].d) g[k] = { v: nRev(r), d: r._d || "" };
    });
    const flowMonths = [...new Set(counts.map(mk))].sort();
    const newByM = {};                        // month -> NEW reviews (flow; may be negative)
    const cumByM = {};                        // month -> carried cumulative level
    Object.values(snapByPlat).forEach(g => {
      let prev = null;
      flowMonths.forEach(k => {
        const cur = g[k] ? g[k].v : prev;     // carry-forward through missing months
        if (cur == null) return;              // platform hasn't reported yet
        cumByM[k] = (cumByM[k] || 0) + cur;
        if (prev != null) newByM[k] = (newByM[k] || 0) + (cur - prev);
        prev = cur;
      });
    });
    const goalByM = {};
    goals.forEach(r => { const k = mk(r); goalByM[k] = (goalByM[k] || 0) + nRev(r); });
    const bdByM = {};
    bd.forEach(r => { const k = mk(r); (bdByM[k] = bdByM[k] || []).push(r); });

    const subs = document.getElementById("rvSubs");

    /* ---------------- sub a: factual vs goal by month (FLOW recast, F6-B) ---------------- */
    const goalMonths = Object.keys(goalByM).filter(k => goalByM[k] > 0).sort();
    const flowShown = flowMonths.slice(-12);
    const hasNegFlow = flowShown.some(k => newByM[k] != null && newByM[k] < 0);
    // Chart.js paints on canvas, which can't resolve var(--red) — read it off :root.
    const RED = (getComputedStyle(document.documentElement)
      .getPropertyValue("--red") || "").trim() || "#f87171";
    RSC.chartCard(subs, {
      title: "Factual Reviews vs Goal by month",
      controlsHtml: `<span class="lbl">new reviews per month · last 12${
        hasNegFlow ? ` · <span style="color:var(--red)">red = platform removed reviews</span>` : ""}</span>`,
      controlsGraphOnly: true,   // label describes the chart encoding; the table shows up to 24 months
      buildChart(canvas) {
        if (!flowMonths.length) return emptyChart(canvas,
          goalMonths.length
            ? "No factual snapshots for the current filters — goals are shown in the tabular view."
            : "No factual reviews or goals for the current filters.");
        const shown = flowShown;
        const flows = shown.map(k => newByM[k] == null ? null : newByM[k]);
        return new Chart(canvas, {
          data: {
            labels: shown.map(mLabel),
            datasets: [
              { type: "bar", label: "New Reviews (monthly change)", data: flows,
                backgroundColor: flows.map(v => (v != null && v < 0) ? RED : "#b7e23b"),
                borderRadius: 4 },
              { type: "line", label: "Cumulative (platform snapshot)", yAxisID: "y1",
                data: shown.map(k => cumByM[k] == null ? null : cumByM[k]),
                borderColor: "#5b8cff", backgroundColor: "#5b8cff",
                borderWidth: 2, pointRadius: 2, tension: .3 },
              { type: "line", label: "Cumulative Goal (checkpoint)", yAxisID: "y1",
                showLine: false, data: shown.map(k => goalByM[k] || null),
                borderColor: "#a78bfa", backgroundColor: "#a78bfa",
                pointRadius: 5, pointStyle: "rectRot" },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
              legend: { position: "top", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => {
                if (c.raw == null) return c.dataset.label + ": —";
                if (c.dataset.type === "bar")
                  return "New reviews: " + (c.raw >= 0 ? "+" : "") + RS.fmtN(c.raw) +
                    (c.raw < 0 ? " · platform removed reviews" : "");
                return c.dataset.label + ": " + RS.fmtN(c.raw);
              } } },
            },
            scales: {
              y: { ticks: { precision: 0 } },
              y1: { position: "right", beginAtZero: true,
                    grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
              x: { ticks: { font: { size: 11 }, autoSkip: true, maxTicksLimit: 14, maxRotation: 45 } },
            },
          },
        });
      },
      buildTable() {
        /* Months carrying snapshots or goal checkpoints (last 24 — future checkpoints
           like the next target show as goal-only rows). New Reviews is the per-month
           flow; Cumulative and Goal are LEVELS — the footer is latest snapshot vs latest
           goal, never a sum of cumulatives. */
        const months = [...new Set([...flowMonths, ...Object.keys(goalByM)])]
          .sort().slice(-24);
        if (!months.length) return emptyTable("No factual reviews or goals for the current filters.");
        const flowFmt = v => v == null ? "—" :
          `<span class="${v >= 0 ? "up" : "down"}">${(v >= 0 ? "+" : "") + RS.fmtN(v)}</span>` +
          (v < 0 ? ` <span style="color:var(--muted);font-size:11px">platform removed reviews</span>` : "");
        const data = months.map(k => ({
          m: mLabel(k),
          nw: newByM[k] == null ? null : newByM[k],
          cum: cumByM[k] == null ? null : cumByM[k],
          g: goalByM[k] || null,
          att: (goalByM[k] && cumByM[k] != null) ? cumByM[k] / goalByM[k] : null,
        }));
        return RSC.table(
          [{ key: "m", label: "Month" },
           { key: "nw", label: "New Reviews", fmt: flowFmt },
           { key: "cum", label: "Cumulative (snapshot)", fmt: nf },
           { key: "g", label: "Goal (cumulative)", fmt: nf },
           { key: "att", label: "Attainment", fmt: RS.fmtPct }],
          data,
          { m: "Latest", nw: null, cum: factual, g: goalTotal || null, att: attainment }) +
          `<div style="color:var(--muted);font-size:12px;padding:6px 2px">Latest row = latest platform snapshot vs the ${
            goalWhen ? goalWhen + " " : ""}goal; attainment counts goal-covered platforms only.</div>`;
      },
    });

    /* ---------------- sub b: score mix (doughnut) + monthly avg score ---------------- */
    const scoreG = {};
    bd.filter(isCounted).forEach(r => {
      const s = r["Review Score"];
      const k = (s == null || s === "") ? "—" : String(RS.num(s));
      scoreG[k] = (scoreG[k] || 0) + nRev(r);
    });
    const scores = Object.entries(scoreG).map(([k, v]) => ({ k, v }))
      .sort((a, b) => (RS.num(b.k) || 0) - (RS.num(a.k) || 0));
    const SCORE_COLOR = { "5": "#b7e23b", "4": "#5b8cff", "3": "#a78bfa", "2": "#fbbf24", "1": "#f87171" };

    RSC.chartCard(subs, {
      title: "Score mix",
      controlsHtml: `<span class="lbl">counted reviews by score</span>`,
      controlsGraphOnly: true,   // label describes the doughnut; the table also carries the monthly trend
      buildChart(canvas) {
        if (!scores.length) return emptyChart(canvas, "No counted reviews for the current filters.");
        return new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: scores.map(x => x.k === "—" ? "No score" : "Score " + x.k),
            datasets: [{ data: scores.map(x => x.v),
              backgroundColor: scores.map(x => SCORE_COLOR[x.k] || "#6b7a88"), borderWidth: 1 }],
          },
          options: {
            responsive: true, maintainAspectRatio: false, cutout: "58%",
            plugins: {
              legend: { position: "right", labels: { boxWidth: 12, font: { size: 12 } } },
              tooltip: { callbacks: { label: c => {
                const tot = c.dataset.data.reduce((a, b) => a + b, 0);
                return c.label + ": " + RS.fmtN(c.raw) +
                  (tot ? " (" + (100 * c.raw / tot).toFixed(1) + "%)" : "");
              } } },
            },
          },
        });
      },
      buildTable() {
        if (!scores.length && !Object.keys(bdByM).length)
          return emptyTable("No counted reviews for the current filters.");
        const tot = scores.reduce((a, x) => a + x.v, 0);
        const mix = RSC.table(
          [{ key: "k", label: "Review Score" },
           { key: "v", label: "Reviews", fmt: nf },
           { key: "sh", label: "% of counted", fmt: RS.fmtPct }],
          scores.map(x => ({ k: x.k === "—" ? "No score" : x.k, v: x.v, sh: tot ? x.v / tot : null })),
          { k: "Total", v: tot, sh: tot ? 1 : null });
        // Monthly avg-score trend (the "line" of this card lives in the tabular view).
        const bdMonths = Object.keys(bdByM).sort();
        const shown = bdMonths.slice(-13);
        const dScore = d => d == null ? "—" :
          `<span class="${d >= 0 ? "up" : "down"}">${(d >= 0 ? "+" : "") + d.toFixed(2)}</span>`;
        const trend = shown.map(k => {
          const i = bdMonths.indexOf(k);
          const avg = M["Review Score (avg)"].fn(bdByM[k]);
          const prev = i > 0 ? M["Review Score (avg)"].fn(bdByM[bdMonths[i - 1]]) : null;
          return { m: mLabel(k), w: M["Counted Reviews Written"].fn(bdByM[k]), avg,
            d: (avg == null || prev == null) ? null : avg - prev };
        });
        return mix + `<div style="height:10px"></div>` + RSC.table(
          [{ key: "m", label: "Month" },
           { key: "w", label: "Reviews Written", fmt: nf },
           { key: "avg", label: "Avg Score", fmt: RS.fmt1 },
           { key: "d", label: "Score change vs prev mo", fmt: v => v == null ? "—" : dScore(v) }],
          trend,
          { m: "Total", w: written, avg: avgScore, d: null });
      },
    });
  },
});
