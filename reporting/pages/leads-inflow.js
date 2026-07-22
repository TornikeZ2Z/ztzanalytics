/* SALES page: Leads Inflow Analysis — WHEN leads arrive, at 15-minute resolution, so staffing
   can follow demand (Tornike 2026-07-16). Time basis = fct_moveboard `Create Datetime NY`
   (raw Moveboard create datetime converted Tbilisi→New York, DST-aware — the column built for
   Speed-to-Lead). Data quality DB-verified 2026-07-16: no NULLs, ~1.5% natural zero-minute rows,
   top hours 10:00–14:00 NY in every year — the whole 2023+ history is usable at 15-min grain.
   Counts ALL leads (drafts are already removed in curated; later-bad leads still count — the
   phone still rang and someone had to answer). Own toolbar (BARE_CHROME), own lean dataset. */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.moveboard_inflow) {
    RS.DATASETS.moveboard_inflow = {
      table: "fct_moveboard",
      // payload contract — the inflow page needs only these four
      cols: ["Create Datetime NY", "Company", "Source", "Status Category"],
    };
  }
})();

var LI = { range: "12w", co: "", src: "", dow: "all", day: "" };

registerPage({
  id: "leads-inflow",
  group: "sales",
  title: "Leads Inflow Analysis",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    var pad = function (n) { return String(n).padStart(2, "0"); };
    var slotT = function (s) { return pad(Math.floor(s / 4)) + ":" + pad((s % 4) * 15); };
    var slotRange = function (s) { return slotT(s) + "–" + (s === 95 ? "24:00" : slotT(s + 1)); };

    if (!document.getElementById("li-style")) {
      var st = document.createElement("style"); st.id = "li-style";
      st.textContent = `
        .li-head{padding:2px 2px 0}
        .li-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}
        .li-head p{margin:2px 0 0;color:var(--muted);font-size:13.5px;max-width:110ch}
        .li-bar{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:12px 0;margin-top:6px;border-bottom:1px solid var(--line)}
        .li-chip{border:1px solid var(--line-2);background:var(--panel-2);color:var(--muted);border-radius:999px;padding:7px 14px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
        .li-chip:hover{border-color:var(--brand)}
        .li-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .li-sel{padding:8px 12px;border-radius:11px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);font-size:13px;font-family:inherit;outline:none}
        .li-sel:focus{border-color:var(--brand)}
        .li-kpis{display:flex;gap:10px;overflow-x:auto;padding:12px 0;scrollbar-width:thin}
        .li-kpi{flex:0 0 auto;min-width:138px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:11px 15px}
        .li-kpi b{display:block;font-size:24px;font-weight:800;letter-spacing:-.02em;line-height:1.1;white-space:nowrap}
        .li-kpi span{display:block;font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;font-weight:700;margin-top:4px}
        .li-kpi small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
        .li-kpi.accent b{color:var(--brand)}
        .li-panel{border:1px solid var(--line);border-radius:13px;background:var(--panel);padding:15px 18px;margin-top:14px}
        .li-panel h3{margin:0 0 3px;font-size:15.5px;font-weight:800}
        .li-panel .sub{font-size:12px;color:var(--faint);margin-bottom:12px}
        .li-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px}
        @media (max-width:1000px){.li-grid{grid-template-columns:minmax(0,1fr)}}
        .li-heatwrap{overflow-x:auto}
        .li-heat{display:grid;grid-template-columns:42px repeat(96,minmax(11px,1fr));gap:2px;min-width:1150px}
        .li-heat .hh{color:var(--faint);font-weight:700;font-size:10.5px;text-align:left;padding:1px 0 3px;white-space:nowrap}
        .li-heat .hl{color:var(--faint);font-weight:700;font-size:12px;text-align:right;padding-right:7px;line-height:20px}
        .li-heat .hc{height:20px;border-radius:4px;background:var(--panel-2)}
        .li-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
        .li-tbl th{color:var(--faint);font-size:12px;font-weight:800;text-transform:uppercase;text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
        .li-tbl th.r,.li-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .li-tbl td{padding:7px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
        .li-tbl tr:last-child td{border-bottom:none}
        .li-note{background:var(--panel-2);border-radius:11px;padding:12px 15px;font-size:13px;color:var(--muted);margin-top:12px;line-height:1.55}
        .li-note b{color:var(--ink)}
        .li-chart{position:relative;height:300px}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="li-head">
        <h1>Leads Inflow Analysis</h1>
        <p>When leads actually arrive — every day in <b>15-minute windows</b>, New York time — so the desk can be
           staffed where the demand is. Time = the moment the lead was created in Moveboard.</p>
      </div>
      <div class="li-bar" id="liBar"></div>
      <div class="li-kpis" id="liKpis"><div class="rs-loading">Loading leads…</div></div>
      <div id="liBody"></div>`;

    var rows;
    try { rows = await RS.load("moveboard_inflow"); }
    catch (e) { document.getElementById("liKpis").innerHTML = '<div class="rs-loading">Couldn’t load — ' + esc(e.message) + "</div>"; return; }
    if (!document.getElementById("liBody")) return;

    // parse once: {d:"YYYY-MM-DD", slot:0..95, dow:0..6 Mon-first, co, src}
    var all = [];
    rows.forEach(function (r) {
      var s = String(r["Create Datetime NY"] || ""); if (s.length < 16) return;
      var h = +s.slice(11, 13), m = +s.slice(14, 16); if (isNaN(h) || isNaN(m)) return;
      var d = s.slice(0, 10);
      var dt = new Date(d + "T12:00:00"); if (isNaN(dt)) return;
      all.push({ d: d, slot: h * 4 + Math.floor(m / 15), dow: (dt.getDay() + 6) % 7,
                 co: String(r.Company || ""), src: String(r.Source || "") });
    });
    all.sort(function (a, b) { return a.d < b.d ? -1 : a.d > b.d ? 1 : 0; });
    var dMin = all.length ? all[0].d : null, dMax = all.length ? all[all.length - 1].d : null;

    var companies = Object.keys(all.reduce(function (o, r) { if (r.co) o[r.co] = 1; return o; }, {})).sort();
    var srcCount = {}; all.forEach(function (r) { if (r.src) srcCount[r.src] = (srcCount[r.src] || 0) + 1; });
    var sources = Object.keys(srcCount).sort(function (a, b) { return srcCount[b] - srcCount[a]; }).slice(0, 14);

    function startFor(range) {
      if (!dMax) return dMin;
      if (range === "all") return dMin;
      var end = new Date(dMax + "T12:00:00");
      if (range === "ytd") return dMax.slice(0, 4) + "-01-01";
      var weeks = { "4w": 4, "12w": 12, "26w": 26 }[range] || 12;
      end.setDate(end.getDate() - weeks * 7 + 1);
      return end.toISOString().slice(0, 10);
    }

    function draw() {
      var d0 = startFor(LI.range), d1 = dMax;
      var f = all.filter(function (r) {
        return r.d >= d0 && r.d <= d1 && (!LI.co || r.co === LI.co) && (!LI.src || r.src === LI.src);
      });
      // calendar-day counts per DOW in range (denominator — includes zero-lead days honestly)
      var dowDays = [0, 0, 0, 0, 0, 0, 0], totDays = 0;
      for (var cur = new Date(d0 + "T12:00:00"), end = new Date(d1 + "T12:00:00"); cur <= end; cur.setDate(cur.getDate() + 1)) {
        dowDays[(cur.getDay() + 6) % 7]++; totDays++;
      }
      // dow × slot totals
      var grid = DOWS.map(function () { var a = new Array(96); for (var i = 0; i < 96; i++) a[i] = 0; return a; });
      var slotTot = new Array(96); for (var i = 0; i < 96; i++) slotTot[i] = 0;
      var dowTot = [0, 0, 0, 0, 0, 0, 0];
      var byDay = {};
      f.forEach(function (r) {
        grid[r.dow][r.slot]++; slotTot[r.slot]++; dowTot[r.dow]++;
        (byDay[r.d] = byDay[r.d] || { n: 0, slots: {} }); byDay[r.d].n++; byDay[r.d].slots[r.slot] = (byDay[r.d].slots[r.slot] || 0) + 1;
      });

      // KPIs
      var totalN = f.length;
      var inHours = f.filter(function (r) { return r.slot >= 32 && r.slot < 80; }).length;        // 08:00–20:00
      var after20 = f.filter(function (r) { return r.slot >= 80; }).length;
      var peak = { v: -1, dow: 0, slot: 0 };
      for (var dw = 0; dw < 7; dw++) for (var sl = 0; sl < 96; sl++) {
        if (!dowDays[dw]) continue;
        var avg = grid[dw][sl] / dowDays[dw];
        if (avg > peak.v) peak = { v: avg, dow: dw, slot: sl };
      }
      var busiestDow = 0; for (var dw2 = 1; dw2 < 7; dw2++) {
        if (dowDays[dw2] && dowTot[dw2] / dowDays[dw2] > (dowDays[busiestDow] ? dowTot[busiestDow] / dowDays[busiestDow] : 0)) busiestDow = dw2;
      }
      document.getElementById("liKpis").innerHTML = [
        { l: "Leads", v: N(totalN), s: d0 + " → " + d1 },
        { l: "Avg per day", v: totDays ? (totalN / totDays).toFixed(1) : "—", s: N(totDays) + " days" },
        { l: "Peak 15-min window", v: peak.v < 0 ? "—" : DOWS[peak.dow] + " " + slotT(peak.slot), a: 1, s: peak.v < 0 ? "" : peak.v.toFixed(1) + " leads avg" },
        { l: "Busiest day", v: DOWS[busiestDow], s: dowDays[busiestDow] ? (dowTot[busiestDow] / dowDays[busiestDow]).toFixed(1) + " leads avg" : "" },
        { l: "In hours 8–20", v: totalN ? Math.round(inHours / totalN * 100) + "%" : "—", s: "of all leads" },
        { l: "After 20:00", v: totalN ? Math.round(after20 / totalN * 100) + "%" : "—", s: "evening inflow" },
      ].map(function (k) {
        return '<div class="li-kpi' + (k.a ? " accent" : "") + '"><b>' + k.v + "</b><span>" + k.l + "</span><small>" + esc(k.s) + "</small></div>";
      }).join("");

      // heatmap: header row (hour labels every 4th slot) + 7 dow rows, avg per occurrence
      var maxAvg = Math.max(peak.v, 0.0001);
      var head = '<div class="hh"></div>';
      for (var s2 = 0; s2 < 96; s2++) head += '<div class="hh">' + (s2 % 4 === 0 ? pad(s2 / 4) : "") + "</div>";
      var cells = "";
      for (var dw3 = 0; dw3 < 7; dw3++) {
        cells += '<div class="hl">' + DOWS[dw3] + "</div>";
        for (var s3 = 0; s3 < 96; s3++) {
          var av = dowDays[dw3] ? grid[dw3][s3] / dowDays[dw3] : 0;
          var alpha = av <= 0 ? 0 : Math.round(12 + 88 * Math.pow(av / maxAvg, 0.6));
          cells += '<div class="hc" title="' + DOWS[dw3] + " " + slotRange(s3) + " · avg " + av.toFixed(2)
            + " (total " + grid[dw3][s3] + " over " + dowDays[dw3] + " " + DOWS[dw3] + "s)\""
            + (alpha ? ' style="background:color-mix(in srgb, var(--brand) ' + alpha + '%, var(--panel-2))"' : "") + "></div>";
        }
      }

      // average-day curve (or one exact day)
      var dowSets = { all: [0, 1, 2, 3, 4, 5, 6], wd: [0, 1, 2, 3, 4], we: [5, 6] };
      var curveVals = new Array(96), curveTitle, curveSub;
      if (LI.day) {
        var one = byDay[LI.day] || { slots: {} };
        for (var s4 = 0; s4 < 96; s4++) curveVals[s4] = one.slots[s4] || 0;
        var oneDt = new Date(LI.day + "T12:00:00");
        curveTitle = "Exact day — " + LI.day + (isNaN(oneDt) ? "" : " (" + DOWS[(oneDt.getDay() + 6) % 7] + ")");
        curveSub = "raw lead count in each 15-minute window on this one day";
      } else {
        var set = dowSets[LI.dow] || [ +LI.dow ];
        var nDays = set.reduce(function (a, d3) { return a + dowDays[d3]; }, 0) || 1;
        for (var s5 = 0; s5 < 96; s5++) curveVals[s5] = set.reduce(function (a, d4) { return a + grid[d4][s5]; }, 0) / nDays;
        curveTitle = "Typical day — " + (LI.dow === "all" ? "all days" : LI.dow === "wd" ? "weekdays" : LI.dow === "we" ? "weekend" : DOWS[+LI.dow]);
        curveSub = "AVERAGE leads per 15-minute window across the selected days — the staffing curve";
      }

      // busiest windows table (top 12 by avg across the whole range)
      var tops = [];
      for (var dw4 = 0; dw4 < 7; dw4++) for (var s6 = 0; s6 < 96; s6++) {
        if (dowDays[dw4] && grid[dw4][s6]) tops.push({ dow: dw4, slot: s6, avg: grid[dw4][s6] / dowDays[dw4], tot: grid[dw4][s6] });
      }
      tops.sort(function (a, b) { return b.avg - a.avg; });
      var quiet = null;
      for (var s7 = 32; s7 < 80; s7++) { var t7 = slotTot[s7]; if (quiet == null || t7 < quiet.t) quiet = { s: s7, t: t7 }; }
      var topRows = tops.slice(0, 12).map(function (t) {
        return "<tr><td>" + DOWS[t.dow] + "</td><td>" + slotRange(t.slot) + '</td><td class="r"><b>' + t.avg.toFixed(1) + '</b></td><td class="r">' + N(t.tot) + "</td></tr>";
      }).join("") || '<tr><td colspan="4" style="color:var(--faint)">No leads in range.</td></tr>';

      var dowChips = [["all", "All days"], ["wd", "Weekdays"], ["we", "Weekend"]].concat(DOWS.map(function (d5, i2) { return [String(i2), d5]; }))
        .map(function (c) { return '<button class="li-chip' + (!LI.day && LI.dow === c[0] ? " on" : "") + '" data-dow="' + c[0] + '">' + c[1] + "</button>"; }).join("");

      document.getElementById("liBody").innerHTML =
        '<div class="li-panel"><h3>Week heatmap — 15-minute windows</h3>'
        + '<div class="sub">average leads per window (hover any cell for exact numbers) · darker = busier · hours are New York time</div>'
        + '<div class="li-heatwrap"><div class="li-heat">' + head + cells + "</div></div></div>"
        + '<div class="li-grid">'
        + '<div class="li-panel"><h3>' + esc(curveTitle) + "</h3>" + '<div class="sub">' + esc(curveSub) + '</div>'
        + '<div style="display:flex;flex-wrap:wrap;gap:7px;margin-bottom:11px">' + dowChips + "</div>"
        + '<div class="li-chart"><canvas id="liCurve"></canvas></div></div>'
        + '<div class="li-panel"><h3>Busiest windows</h3><div class="sub">top 12 fifteen-minute windows by average leads — staff these first</div>'
        + '<table class="li-tbl"><thead><tr><th>Day</th><th>Window</th><th class="r">Avg leads</th><th class="r">Total</th></tr></thead><tbody>' + topRows + "</tbody></table>"
        + (quiet ? '<div class="li-note" style="margin-top:11px">Quietest business-hours window overall: <b>' + slotRange(quiet.s) + "</b> — " + N(quiet.t) + " leads in the whole range.</div>" : "")
        + "</div></div>"
        + '<div class="li-note"><b>How it’s counted.</b> Every Moveboard lead, stamped at its creation moment converted to New York time (the office clock). '
        + "Drafts are already removed in the warehouse; leads later marked Bad still count — they still had to be answered. "
        + "Averages divide by CALENDAR days in the range (a Monday with zero leads still counts as a Monday), so quiet weeks don’t inflate the picture.</div>";

      // curve chart
      var cv = document.getElementById("liCurve");
      var old = window.Chart && Chart.getChart(cv); if (old) old.destroy();
      var brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#84cc16";
      new Chart(cv, { type: "bar",
        data: { labels: Array.from({ length: 96 }, function (_, i3) { return slotT(i3); }),
          datasets: [{ data: curveVals, backgroundColor: curveVals.map(function (v) { return v === Math.max.apply(null, curveVals) && v > 0 ? brand : "color-mix(in srgb, " + brand + " 55%, transparent)"; }), borderRadius: 2, maxBarThickness: 14, categoryPercentage: .92, barPercentage: .95 }] },
        options: { maintainAspectRatio: false, animation: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { callbacks: {
            title: function (it) { return it[0] ? slotRange(it[0].dataIndex) : ""; },
            label: function (x) { return (LI.day ? "Leads: " : "Avg leads: ") + (+x.parsed.y).toFixed(LI.day ? 0 : 2); } } } },
          scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, font: { size: 12 },
              callback: function (v, i4) { return i4 % 8 === 0 ? slotT(i4) : ""; } } },
            y: { beginAtZero: true, ticks: { font: { size: 12 } } } } } });

      // wire dow chips
      Array.prototype.forEach.call(document.querySelectorAll("[data-dow]"), function (b) {
        b.onclick = function () { LI.dow = b.getAttribute("data-dow"); LI.day = ""; var di = document.getElementById("liDay"); if (di) di.value = ""; draw(); };
      });
    }

    // toolbar (built once — range chips, company, source, exact-day picker)
    var bar = document.getElementById("liBar");
    var ranges = [["4w", "Last 4 weeks"], ["12w", "Last 12 weeks"], ["26w", "Last 26 weeks"], ["ytd", "This year"], ["all", "All data"]];
    bar.innerHTML = ranges.map(function (r) { return '<button class="li-chip' + (LI.range === r[0] ? " on" : "") + '" data-rng="' + r[0] + '">' + r[1] + "</button>"; }).join("")
      + '<select class="li-sel" id="liCo"><option value="">All companies</option>' + companies.map(function (c) { return '<option' + (LI.co === c ? " selected" : "") + ">" + esc(c) + "</option>"; }).join("") + "</select>"
      + '<select class="li-sel" id="liSrc"><option value="">All sources</option>' + sources.map(function (s8) { return '<option' + (LI.src === s8 ? " selected" : "") + ">" + esc(s8) + "</option>"; }).join("") + "</select>"
      + '<span style="color:var(--faint);font-size:12.5px;font-weight:700;margin-left:4px">Exact day:</span>'
      + '<input class="li-sel" type="date" id="liDay" value="' + esc(LI.day) + '"' + (dMin ? ' min="' + dMin + '" max="' + dMax + '"' : "") + ">";
    Array.prototype.forEach.call(bar.querySelectorAll("[data-rng]"), function (b) {
      b.onclick = function () {
        LI.range = b.getAttribute("data-rng");
        Array.prototype.forEach.call(bar.querySelectorAll("[data-rng]"), function (x) { x.classList.toggle("on", x === b); });
        draw();
      };
    });
    document.getElementById("liCo").onchange = function (e) { LI.co = e.target.value; draw(); };
    document.getElementById("liSrc").onchange = function (e) { LI.src = e.target.value; draw(); };
    document.getElementById("liDay").onchange = function (e) { LI.day = e.target.value; draw(); };

    draw();
  },
});
