/* REVIEWS page: Foreman Weekly Review Performance — a Foreman × Week-Ending matrix of
   "R reviews / J eligible jobs = %", color-coded, with click-to-drill-down to the job level.
   Numerator = SUM(reviews) on ELIGIBLE jobs; denominator = eligible jobs (completed minus any
   support intervention). Built on fct_job_overview. Read-only. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_job_overview) {
    RS.DATASETS.fct_job_overview = {
      table: "fct_job_overview",
      cols: [
        "Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Company", "Job Source",
        "Job Type", "Delivery State", "Estimate Bill", "Actual Bill", "Final Packing",
        "Bill Increase Amount", "Bill Increase %", "Bill Increase Category", "Review Received",
        "Number of Reviews", "Review Source", "Eligible", "Support Intervention",
        "Support Intervention Date", "Support Intervention Type", "Support Intervention Reason",
        "Support Notes", "Review Expected", "Exclusion Reason", "Foreman Response Received",
        "Foreman Explanation", "Final Status", "Request Joinkey", "Event ID", "Closing Unique Key",
      ],
    };
  }
})();

// thresholds — configurable (review-% color bands per the spec)
var RP_BANDS = [
  { max: 50,       bg: "#dc2626", fg: "#fff",     label: "Below 50%" },
  { max: 100,      bg: "#fecaca", fg: "#991b1b",  label: "50–99%" },     // < 100 (exclusive)
  { max: 100.0001, bg: "#e5e7eb", fg: "#374151",  label: "100%" },       // exactly 100
  { max: 200,      bg: "#bbf7d0", fg: "#166534",  label: "101–199%" },
  { max: Infinity, bg: "#16a34a", fg: "#fff",     label: "≥200%" },
];
var RP_WEEKS = 12;   // matrix shows the most recent N week-ending columns
var RP_STATE = { foreman: "", source: "", status: "", billcat: "", cell: null };

registerPage({
  id: "review-performance",
  group: "reviews",
  title: "Review Performance",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var num = function (v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
    var money = function (v) { var s = String(v == null ? "" : v).trim(); if (s === "") return "—"; var n = num(v); return "$" + Math.round(n).toLocaleString(); };
    var yes = function (v) { return String(v).trim().toLowerCase() === "yes"; };
    var band = function (pct) { for (var i = 0; i < RP_BANDS.length; i++) if (pct < RP_BANDS[i].max) return RP_BANDS[i]; return RP_BANDS[RP_BANDS.length - 1]; };

    if (!document.getElementById("rp-style")) {
      var st = document.createElement("style"); st.id = "rp-style";
      st.textContent = `
        .rp-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 4px 4px}
        .rp-sel,#rpSearch{padding:8px 11px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);font-size:13px;font-family:inherit;outline:none}
        #rpSearch{min-width:180px}.rp-sel:focus,#rpSearch:focus{border-color:var(--brand)}
        .rp-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;margin-top:6px}
        .rp-mx{border-collapse:separate;border-spacing:0;font-size:12px;min-width:600px}
        .rp-mx th,.rp-mx td{padding:0;text-align:center;white-space:nowrap}
        .rp-mx thead th{background:var(--panel-2);color:var(--faint);font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:8px 6px;position:sticky;top:0;border-bottom:1px solid var(--line)}
        .rp-mx th.fm,.rp-mx td.fm{position:sticky;left:0;background:var(--panel);text-align:left;padding:6px 12px;font-weight:600;font-size:12.5px;min-width:170px;border-right:1px solid var(--line);z-index:1}
        .rp-mx thead th.fm{z-index:2}
        .rp-cell{display:block;margin:2px;padding:6px 4px;border-radius:7px;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1.25;min-width:74px}
        .rp-cell small{display:block;font-weight:600;opacity:.8;font-size:10px}
        .rp-cell.na{cursor:default}
        .rp-cell.sel{outline:2px solid var(--ink);outline-offset:-2px}
        .rp-tbl{width:100%;border-collapse:collapse;font-size:12px}
        .rp-tbl th,.rp-tbl td{padding:7px 10px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap;vertical-align:top}
        .rp-tbl th{color:var(--faint);font-size:10.5px;font-weight:800;text-transform:uppercase}
        .rp-tbl tr.excl td{opacity:.6}
        .rp-tbl td.r{text-align:right}
        .rp-pill{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap}
        .p-rev{background:rgba(22,163,74,.16);color:#15803d}.p-miss{background:rgba(220,38,38,.13);color:#b91c1c}
        .p-excl{background:var(--panel-2);color:var(--muted)}.p-pend{background:rgba(217,119,6,.15);color:#b45309}
        .p-high{background:rgba(220,38,38,.13);color:#b91c1c}.p-att{background:rgba(217,119,6,.15);color:#b45309}
        .rp-legend{display:flex;flex-wrap:wrap;gap:10px;font-size:11.5px;color:var(--muted);padding:8px 4px 0}
        .rp-legend span{display:inline-flex;align-items:center;gap:5px}.rp-legend i{width:13px;height:13px;border-radius:3px;display:inline-block}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Review Performance</h1>
        <p>Weekly reviews generated per foreman — <b>reviews ÷ eligible jobs</b>. Eligible = completed jobs the foreman ran,
           minus any with a support intervention (review no longer expected). Click a cell to see the jobs behind it.
           <span class="freshness">· read-only · target = 100% (one review per eligible job)</span></p>
      </div>
      <div class="rs-kpis" id="rpKpis"><div class="rs-loading">Loading jobs…</div></div>
      <div class="panel" style="margin-top:12px">
        <div class="rp-controls">
          <input id="rpSearch" type="text" autocomplete="off" placeholder="Search foreman…">
          <select id="rpSource" class="rp-sel"></select>
          <select id="rpStatus" class="rp-sel"></select>
          <select id="rpBill" class="rp-sel"></select>
          <span style="flex:1"></span>
          <button id="rpCsv" class="rs-btn" style="font-size:12.5px">⬇ CSV (all jobs)</button>
        </div>
        <div class="rp-legend" id="rpLegend"></div>
        <div class="rp-wrap"><div id="rpMatrix"></div></div>
        <div id="rpDrill" style="margin-top:14px"></div>
      </div>`;

    var rows;
    try { rows = await RS.load("fct_job_overview"); }
    catch (e) { document.getElementById("rpKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("rpMatrix")) return;

    var weeks = [...new Set(rows.map(r => String(r["Week Ending"] || "").slice(0, 10)).filter(Boolean))].sort().reverse().slice(0, RP_WEEKS);
    var weekSet = new Set(weeks);
    var sources = [...new Set(rows.map(r => r["Job Source"]).filter(Boolean))].sort();
    var statuses = [...new Set(rows.map(r => r["Final Status"]).filter(Boolean))].sort();
    var billcats = ["Normal", "Attention", "High Increase", "Estimate Missing"];
    document.getElementById("rpSource").innerHTML = `<option value="">All sources</option>` + sources.map(s => `<option>${esc(s)}</option>`).join("");
    document.getElementById("rpStatus").innerHTML = `<option value="">All statuses</option>` + statuses.map(s => `<option>${esc(s)}</option>`).join("");
    document.getElementById("rpBill").innerHTML = `<option value="">All bill categories</option>` + billcats.map(s => `<option>${esc(s)}</option>`).join("");
    document.getElementById("rpLegend").innerHTML = RP_BANDS.map(b => `<span><i style="background:${b.bg}"></i>${b.label}</span>`).join("") +
      `<span><i style="background:#f3f4f6;border:1px solid var(--line)"></i>no eligible jobs</span>`;

    function filtered() {
      return rows.filter(r =>
        (!RP_STATE.source || r["Job Source"] === RP_STATE.source) &&
        (!RP_STATE.status || r["Final Status"] === RP_STATE.status) &&
        (!RP_STATE.billcat || r["Bill Increase Category"] === RP_STATE.billcat) &&
        (!RP_STATE.foreman || String(r["Foreman"] || "").toLowerCase().includes(RP_STATE.foreman.toLowerCase()))
      );
    }

    function paint() {
      var data = filtered().filter(r => weekSet.has(String(r["Week Ending"] || "").slice(0, 10)));
      // aggregate cells + totals
      var cells = {}, foremen = {};
      var tot = { completed: 0, eligible: 0, reviews: 0, jobsWithReview: 0, support: 0, missing: 0, noResp: 0, highBill: 0 };
      data.forEach(r => {
        var fm = r["Foreman"] || "—", wk = String(r["Week Ending"]).slice(0, 10), elig = num(r["Eligible"]) === 1;
        var nrev = num(r["Number of Reviews"]);
        var k = fm + "||" + wk;
        var c = cells[k] || (cells[k] = { R: 0, J: 0, completed: 0 });
        c.completed++; if (elig) { c.J++; c.R += nrev; }
        var f = foremen[fm] || (foremen[fm] = { completed: 0, J: 0, R: 0 });
        f.completed++; if (elig) { f.J++; f.R += nrev; }
        tot.completed++; if (elig) { tot.eligible++; tot.reviews += nrev; }
        if (nrev > 0) tot.jobsWithReview++;
        if (yes(r["Support Intervention"])) tot.support++;
        if (elig && nrev === 0) { tot.missing++; if (!yes(r["Foreman Response Received"])) tot.noResp++; }
        if (r["Bill Increase Category"] === "High Increase") tot.highBill++;
      });

      RSC.kpis(document.getElementById("rpKpis"), [
        { label: "Completed jobs", value: N(tot.completed), sub: "in view" },
        { label: "Eligible jobs", value: N(tot.eligible), sub: N(tot.completed - tot.eligible) + " excluded (support)" },
        { label: "Total reviews", value: N(tot.reviews), sub: N(tot.jobsWithReview) + " jobs got ≥1" },
        { label: "Review %", value: tot.eligible ? Math.round(tot.reviews / tot.eligible * 100) + "%" : "—", sub: "target 100%" },
        { label: "Support interventions", value: N(tot.support), sub: "excluded from eligible" },
        { label: "Missing reviews", value: N(tot.missing), sub: "eligible, no review" },
        { label: "Missing foreman responses", value: N(tot.noResp), sub: "no explanation yet" },
        { label: "High bill-increase jobs", value: N(tot.highBill), sub: "> 25% over estimate" },
      ]);

      var fmList = Object.keys(foremen).sort((a, b) => foremen[b].completed - foremen[a].completed);
      var head = `<tr><th class="fm">Foreman</th>` + weeks.map(w => `<th>${w.slice(5)}</th>`).join("") + `</tr>`;
      var body = fmList.map(fm => {
        var tds = weeks.map(w => {
          var c = cells[fm + "||" + w];
          if (!c || c.J === 0) return `<td><span class="rp-cell na" style="background:#f3f4f6;color:#9ca3af">0 R / 0 J<small>N/A</small></span></td>`;
          var pct = Math.round(c.R / c.J * 100), b = band(pct);
          var selCls = (RP_STATE.cell === fm + "||" + w) ? " sel" : "";
          return `<td><span class="rp-cell${selCls}" style="background:${b.bg};color:${b.fg}" data-fm="${esc(fm)}" data-wk="${w}">${c.R} R / ${c.J} J<small>${pct}%</small></span></td>`;
        }).join("");
        return `<tr><td class="fm">${esc(fm)}</td>${tds}</tr>`;
      }).join("");
      document.getElementById("rpMatrix").innerHTML = fmList.length
        ? `<table class="rp-mx"><thead>${head}</thead><tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:18px">No jobs match these filters.</div>`;

      document.querySelectorAll("#rpMatrix .rp-cell:not(.na)").forEach(el => el.onclick = () => {
        RP_STATE.cell = el.dataset.fm + "||" + el.dataset.wk; paint(); drill(el.dataset.fm, el.dataset.wk);
      });
      if (RP_STATE.cell) { var p = RP_STATE.cell.split("||"); drill(p[0], p[1]); }
      else document.getElementById("rpDrill").innerHTML = `<div class="st-note" style="color:var(--muted);font-size:12.5px;padding:6px 4px">Click a cell to see the jobs behind it.</div>`;
    }

    function drill(fm, wk) {
      var jobs = filtered().filter(r => (r["Foreman"] || "—") === fm && String(r["Week Ending"]).slice(0, 10) === wk)
        .sort((a, b) => num(b["Eligible"]) - num(a["Eligible"]) || String(a["Job Date"]).localeCompare(String(b["Job Date"])));
      var stPill = s => {
        var m = { "Review Received": "p-rev", "Multiple Reviews Received": "p-rev", "Excluded – Support Intervention": "p-excl",
          "Review Match Pending": "p-pend", "Missing Review – Explanation Received": "p-att",
          "Missing Review – Waiting for Response": "p-miss", "Missing Review – No Explanation": "p-miss", "Data Missing": "p-excl" };
        return `<span class="rp-pill ${m[s] || "p-excl"}">${esc(s)}</span>`;
      };
      var billPill = c => c === "High Increase" ? `<span class="rp-pill p-high">High</span>` : c === "Attention" ? `<span class="rp-pill p-att">Attention</span>` : esc(c || "—");
      var body = jobs.map(r => {
        var elig = num(r["Eligible"]) === 1;
        return `<tr class="${elig ? "" : "excl"}">
          <td>${esc(String(r["Job Date"] || "").slice(0, 10))}</td>
          <td><b>#${esc(r["Job No"] || "")}</b></td>
          <td>${esc(r["Customer"] || "—")}</td>
          <td>${esc(r["Job Source"] || "—")}</td>
          <td class="r">${money(r["Estimate Bill"])}</td>
          <td class="r">${money(r["Actual Bill"])}</td>
          <td class="r">${r["Bill Increase %"] == null || r["Bill Increase %"] === "" ? "—" : (num(r["Bill Increase %"]) > 0 ? "+" : "") + num(r["Bill Increase %"]) + "%"}</td>
          <td>${billPill(r["Bill Increase Category"])}</td>
          <td class="r"><b>${esc(String(r["Number of Reviews"] || 0))}</b></td>
          <td>${esc(r["Review Source"] || "—")}</td>
          <td>${elig ? '<span class="rp-pill p-rev">Eligible</span>' : '<span class="rp-pill p-excl">' + esc(r["Exclusion Reason"] || "Excluded") + '</span>'}</td>
          <td>${esc(r["Support Intervention Reason"] || (yes(r["Support Intervention"]) ? "—" : ""))}</td>
          <td>${esc(r["Foreman Explanation"] || (yes(r["Foreman Response Received"]) ? "—" : ""))}</td>
          <td>${stPill(r["Final Status"])}</td>
        </tr>`;
      }).join("");
      var R = jobs.filter(r => num(r["Eligible"]) === 1).reduce((s, r) => s + num(r["Number of Reviews"]), 0);
      var J = jobs.filter(r => num(r["Eligible"]) === 1).length;
      document.getElementById("rpDrill").innerHTML = `
        <div style="display:flex;align-items:baseline;gap:10px;margin:4px 2px 8px">
          <h3 style="margin:0;font-size:15px">${esc(fm)} · week ending ${wk}</h3>
          <span style="color:var(--muted);font-size:13px">${R} R / ${J} J = ${J ? Math.round(R / J * 100) : 0}% · ${jobs.length} completed job${jobs.length === 1 ? "" : "s"}</span>
        </div>
        <div style="overflow-x:auto"><table class="rp-tbl"><thead><tr>
          <th>Job Date</th><th>Job #</th><th>Customer</th><th>Source</th><th class="r">Estimate</th><th class="r">Actual</th>
          <th class="r">Δ%</th><th>Bill</th><th class="r">#Rev</th><th>Platforms</th><th>Eligible</th><th>Support reason</th>
          <th>Foreman explanation</th><th>Status</th></tr></thead><tbody>${body}</tbody></table></div>`;
    }

    document.getElementById("rpSource").onchange = e => { RP_STATE.source = e.target.value; RP_STATE.cell = null; paint(); };
    document.getElementById("rpStatus").onchange = e => { RP_STATE.status = e.target.value; RP_STATE.cell = null; paint(); };
    document.getElementById("rpBill").onchange = e => { RP_STATE.billcat = e.target.value; RP_STATE.cell = null; paint(); };
    var t = null;
    document.getElementById("rpSearch").oninput = e => { clearTimeout(t); t = setTimeout(() => { RP_STATE.foreman = e.target.value; RP_STATE.cell = null; paint(); }, 150); };
    document.getElementById("rpCsv").onclick = () => {
      var cols = ["Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Job Source", "Job Type", "Estimate Bill",
        "Actual Bill", "Bill Increase Amount", "Bill Increase %", "Bill Increase Category", "Review Received", "Number of Reviews",
        "Review Source", "Eligible", "Support Intervention", "Support Intervention Reason", "Review Expected", "Exclusion Reason",
        "Foreman Response Received", "Foreman Explanation", "Final Status"];
      var q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
      var lines = [cols.join(",")].concat(filtered().map(r => cols.map(c => q(r[c])).join(",")));
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = "review-performance.csv"; a.click(); URL.revokeObjectURL(a.href);
    };

    paint();
  },
});
