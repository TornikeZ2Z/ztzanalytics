/* SUPPORT page: Job Overview (Job Performance Dashboard) — one row per completed job,
   combining Calendar (job/date/customer/foreman) + Moveboard estimate + Closing final bill
   + Claims + Negative Reviews + Refunds (support intervention, derived) + the reviews tracker
   (Reviewed / Not Reviewed). Built on fct_job_overview. Read-only.
   Status: 🔴 negative review or open claim · 🟠 large estimate-vs-final gap · 🟡 support case · 🟢 clear. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_job_overview) {
    RS.DATASETS.fct_job_overview = {
      table: "fct_job_overview",
      cols: [
        "Job No", "Move Date", "Customer", "Foreman", "Company", "Delivery State",
        "Estimated Bill", "Final Total Bill", "Final Packing", "Bill Difference", "Bill Difference %",
        "Open Claim", "Claim Reason", "Support Intervention", "Support Reason",
        "Review", "Negative Review", "Negative Review Score", "No Review Reason",
        "Status Color", "Status Reason", "Request Joinkey", "Event ID", "Closing Unique Key",
      ],
    };
  }
})();

const JO_STATE = { status: null, issue: null, foreman: "", month: "", q: "" };

registerPage({
  id: "job-overview",
  group: "support",
  title: "Job Overview",
  async render(host) {
    const CAP = 400;
    const esc = RSC.esc;
    const has = v => !(v == null || String(v).trim() === "");
    const norm = s => String(s == null ? "" : s).trim().toLowerCase();
    const yes = v => norm(v) === "yes";
    const numv = v => { const n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.-]/g, "")); return isFinite(n) ? n : null; };
    const money = v => { const n = numv(v); return n == null ? "—" : "$" + Math.round(n).toLocaleString(); };
    const COLORS = { Green: "#16a34a", Yellow: "#d4a017", Orange: "#ea7a1c", Red: "#dc2626" };
    const ORDER = { Red: 0, Orange: 1, Yellow: 2, Green: 3 };

    if (!document.getElementById("jo-style")) {
      const st = document.createElement("style");
      st.id = "jo-style";
      st.textContent = `
        .jo-controls{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:14px 16px 6px}
        .jo-chip{border:1px solid var(--line-2);background:var(--panel-2);border-radius:999px;
          padding:6px 13px;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap}
        .jo-chip:hover{border-color:var(--brand)}
        .jo-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .jo-chip .n{opacity:.7;font-weight:800;margin-left:5px}
        .jo-chip .dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:5px;vertical-align:middle}
        .jo-sel,#joSearch{padding:8px 11px;border-radius:10px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:13px;font-family:inherit;outline:none}
        #joSearch{min-width:220px}#joSearch:focus,.jo-sel:focus{border-color:var(--brand)}
        .jo-tbl{width:100%;border-collapse:collapse}
        .jo-tbl th,.jo-tbl td{padding:8px 11px;font-size:12.5px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
        .jo-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;cursor:default}
        .jo-tbl th.r,.jo-tbl td.r{text-align:right}
        .jo-tbl tr:hover td{background:var(--panel-2)}
        .jo-tbl td.stat{border-left:4px solid transparent;font-weight:700}
        .jo-pill{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
        .jo-pill.y{background:rgba(220,38,38,.14);color:#b91c1c}
        .jo-pill.g{background:rgba(22,163,74,.14);color:#15803d}
        .jo-pill.n{background:var(--panel-2);color:var(--muted)}
        .jo-neg{color:#dc2626;font-weight:800}
        .jo-pos{color:#15803d;font-weight:800}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Job Overview</h1>
        <p>One row per completed job — calendar, estimate vs final bill, claims, support and reviews in one place, with a
           status flag for jobs that need attention. <span class="freshness">· read-only · Zip to Zip · 2023+</span></p>
      </div>
      <div class="rs-kpis" id="joKpis"><div class="rs-loading">Loading jobs…</div></div>
      <div class="panel" style="margin-top:12px">
        <div class="jo-controls" id="joStatus"></div>
        <div class="jo-controls" id="joIssues" style="padding-top:0"></div>
        <div class="jo-controls" style="padding-top:0">
          <select id="joForeman" class="jo-sel"></select>
          <select id="joMonth" class="jo-sel"></select>
          <input id="joSearch" type="text" autocomplete="off" spellcheck="false" placeholder="Search job #, customer, foreman…">
          <span id="joCount" class="st-note" style="color:var(--muted);font-size:12.5px"></span>
        </div>
        <div id="joTable" style="padding:2px 6px 12px;overflow-x:auto"></div>
      </div>`;

    let rows;
    try { rows = await RS.load("fct_job_overview"); }
    catch (e) { document.getElementById("joKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("joSearch")) return;   // navigated away

    // ---- KPIs ----
    const cnt = c => rows.filter(r => r["Status Color"] === c).length;
    const nGreen = cnt("Green"), nYellow = cnt("Yellow"), nOrange = cnt("Orange"), nRed = cnt("Red");
    const tracked = rows.filter(r => r["Review"] === "Yes" || r["Review"] === "No").length;
    const reviewed = rows.filter(r => r["Review"] === "Yes").length;
    const negRev = rows.filter(r => yes(r["Negative Review"])).length;
    const openClaims = rows.filter(r => yes(r["Open Claim"])).length;
    RSC.kpis(document.getElementById("joKpis"), [
      { label: "Completed jobs", value: RS.fmtN(rows.length), sub: "Zip to Zip · 2023+" },
      { label: "Need attention", value: RS.fmtN(nRed + nOrange + nYellow), sub: `${RS.fmtN(nRed)} red · ${RS.fmtN(nOrange)} orange · ${RS.fmtN(nYellow)} yellow` },
      { label: "Negative reviews / open claims", value: RS.fmtN(negRev) + " / " + RS.fmtN(openClaims), sub: "the red flags" },
      { label: "Reviews left", value: tracked ? Math.round(reviewed / tracked * 100) + "%" : "—", sub: `${RS.fmtN(reviewed)} of ${RS.fmtN(tracked)} tracked jobs` },
    ]);

    // ---- status chips ----
    const statuses = [["Green", nGreen], ["Yellow", nYellow], ["Orange", nOrange], ["Red", nRed]];
    const statusEl = document.getElementById("joStatus");
    const paintStatus = () => {
      statusEl.innerHTML =
        `<span class="jo-chip ${JO_STATE.status == null ? "on" : ""}" data-s="">All jobs<span class="n">${RS.fmtN(rows.length)}</span></span>` +
        statuses.map(([s, n]) => `<span class="jo-chip ${JO_STATE.status === s ? "on" : ""}" data-s="${s}"><span class="dot" style="background:${COLORS[s]}"></span>${s}<span class="n">${RS.fmtN(n)}</span></span>`).join("");
      statusEl.querySelectorAll(".jo-chip").forEach(el => el.onclick = () => { JO_STATE.status = el.dataset.s || null; paintStatus(); paintTable(); });
    };

    // ---- issue quick-filters ----
    const issues = [
      ["claim", "Open claims", r => yes(r["Open Claim"])],
      ["neg", "Negative reviews", r => yes(r["Negative Review"])],
      ["support", "Support cases", r => yes(r["Support Intervention"])],
      ["noreview", "No review", r => r["Review"] === "No"],
    ];
    const issueEl = document.getElementById("joIssues");
    const paintIssues = () => {
      issueEl.innerHTML = issues.map(([k, lab, fn]) =>
        `<span class="jo-chip ${JO_STATE.issue === k ? "on" : ""}" data-i="${k}">${lab}<span class="n">${RS.fmtN(rows.filter(fn).length)}</span></span>`).join("");
      issueEl.querySelectorAll(".jo-chip").forEach(el => el.onclick = () => { JO_STATE.issue = JO_STATE.issue === el.dataset.i ? null : el.dataset.i; paintIssues(); paintTable(); });
    };

    // ---- foreman + month selects ----
    const foremen = [...new Set(rows.map(r => r["Foreman"]).filter(has))].sort();
    document.getElementById("joForeman").innerHTML =
      `<option value="">All foremen</option>` + foremen.map(f => `<option value="${esc(f)}">${esc(f)}</option>`).join("");
    const months = [...new Set(rows.map(r => String(r["Move Date"] || "").slice(0, 7)).filter(m => m.length === 7))].sort().reverse();
    document.getElementById("joMonth").innerHTML =
      `<option value="">All months</option>` + months.map(m => `<option value="${m}">${m}</option>`).join("");

    // ---- table ----
    const digits = s => String(s || "").replace(/[^0-9]/g, "");
    const issueFn = () => (issues.find(i => i[0] === JO_STATE.issue) || [, , null])[2];
    const paintTable = () => {
      const nq = norm(JO_STATE.q), dq = digits(JO_STATE.q), ifn = issueFn();
      let list = rows.filter(r =>
        (!JO_STATE.status || r["Status Color"] === JO_STATE.status) &&
        (!ifn || ifn(r)) &&
        (!JO_STATE.foreman || r["Foreman"] === JO_STATE.foreman) &&
        (!JO_STATE.month || String(r["Move Date"] || "").slice(0, 7) === JO_STATE.month) &&
        (!nq || norm(r["Customer"]).includes(nq) || norm(r["Foreman"]).includes(nq) ||
          norm(r["Job No"]).includes(nq) || (dq.length >= 3 && digits(r["Job No"]).includes(dq)))
      );
      list.sort((a, b) => (ORDER[a["Status Color"]] - ORDER[b["Status Color"]]) || String(b["Move Date"]).localeCompare(String(a["Move Date"])));
      document.getElementById("joCount").textContent =
        RS.fmtN(list.length) + " job" + (list.length === 1 ? "" : "s") + (list.length > CAP ? " · showing first " + CAP : "");
      const diffCell = r => {
        const p = numv(r["Bill Difference %"]);
        if (p == null) return "—";
        return `<span class="${p < 0 ? "jo-neg" : "jo-pos"}">${p > 0 ? "+" : ""}${p}%</span>`;
      };
      const yn = (v, redYes) => yes(v) ? `<span class="jo-pill ${redYes ? "y" : "g"}">Yes</span>`
        : (v === "No (resolved)" ? `<span class="jo-pill n">resolved</span>`
        : v === "Not tracked" ? `<span class="jo-pill n">—</span>`
        : `<span class="jo-pill n">No</span>`);
      const body = list.slice(0, CAP).map(r => {
        const col = COLORS[r["Status Color"]] || "#94a3b8";
        return `<tr>
          <td class="stat" style="border-left-color:${col};color:${col}" title="${esc(r["Status Reason"] || "")}">${esc(r["Status Color"] || "")}</td>
          <td><b>#${esc(r["Job No"] == null ? "" : r["Job No"])}</b></td>
          <td>${esc(String(r["Move Date"] || "").slice(0, 10))}</td>
          <td>${esc(r["Customer"] || "—")}</td>
          <td>${esc(r["Foreman"] || "—")}</td>
          <td class="r">${money(r["Estimated Bill"])}</td>
          <td class="r">${money(r["Final Total Bill"])}</td>
          <td class="r">${money(r["Final Packing"])}</td>
          <td class="r">${diffCell(r)}</td>
          <td>${yn(r["Open Claim"], true)}</td>
          <td>${yn(r["Support Intervention"], false)}</td>
          <td>${yn(r["Review"], false)}</td>
          <td>${yn(r["Negative Review"], true)}</td>
        </tr>`;
      }).join("");
      document.getElementById("joTable").innerHTML = list.length
        ? `<table class="jo-tbl"><thead><tr>
             <th>Status</th><th>Job #</th><th>Move Date</th><th>Customer</th><th>Foreman</th>
             <th class="r">Estimate</th><th class="r">Final Bill</th><th class="r">Packing</th><th class="r">Diff %</th>
             <th>Open Claim</th><th>Support</th><th>Review</th><th>Neg. Review</th></tr></thead>
           <tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:18px">No jobs match these filters.</div>`;
    };

    paintStatus(); paintIssues(); paintTable();

    document.getElementById("joForeman").onchange = e => { JO_STATE.foreman = e.target.value; paintTable(); };
    document.getElementById("joMonth").onchange = e => { JO_STATE.month = e.target.value; paintTable(); };
    let t = null;
    document.getElementById("joSearch").oninput = e => { clearTimeout(t); t = setTimeout(() => { JO_STATE.q = e.target.value; paintTable(); }, 120); };
  },
});
