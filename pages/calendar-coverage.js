/* ADMIN page: Calendar Coverage — which closing jobs are linked to a Google-Calendar event
   (via bridge_calendar_closing) and, importantly, which are NOT. A closing is "connected"
   when it appears as `Closing Unique Key` in the bridge with a confident Match Type
   (unique / dup_by_date). The unconnected list is the point of this page. Read-only,
   respects the global date/company filter (so you can zoom to recent months). */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.bridge_calendar_closing) {
    RS.DATASETS.bridge_calendar_closing = {
      table: "bridge_calendar_closing",
      cols: ["Closing Unique Key", "Closing Request #", "Match Type",
             "event_date", "event_title", "final_forman_email"],
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.calendar_unconnected) {
    RS.DATASETS.calendar_unconnected = {
      table: "calendar_unconnected",
      cols: ["Unique Key", "Reason"],
    };
  }
})();

// Rendered as a TAB inside the Data Quality hub (no longer a standalone page).
(window.DQ_SUB = window.DQ_SUB || {}).coverage = async function (host) {
    const CAP = 400;
    const num = RS.num, fmtN = RS.fmtN;
    const esc = RSC.esc;
    const norm = s => String(s == null ? "" : s).trim().toLowerCase();
    const digits = s => String(s || "").replace(/[^0-9]/g, "");
    const pct = (a, b) => b ? (100 * a / b).toFixed(0) + "%" : "—";

    if (!document.getElementById("cc-style")) {
      const st = document.createElement("style"); st.id = "cc-style";
      st.textContent = `
        #ccSearch{width:100%;max-width:420px;padding:10px 13px;border-radius:11px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:14px;font-family:inherit;outline:none}
        #ccSearch:focus{border-color:var(--brand)}
        .cc-tbl{width:100%;border-collapse:collapse}
        .cc-tbl th,.cc-tbl td{padding:8px 12px;font-size:12.5px;text-align:left;border-bottom:1px solid var(--line)}
        .cc-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .cc-tbl tr:hover td{background:var(--panel-2)}
        .cc-tbl td.r,.cc-tbl th.r{text-align:right}
        .cc-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;cursor:pointer;
          border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);font-size:12.5px;font-weight:600;
          font-family:inherit;transition:border-color .12s,background .12s}
        .cc-chip:hover{border-color:var(--brand)}
        .cc-chip.on{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 14%,transparent)}
        .cc-chip b{font-variant-numeric:tabular-nums}
        .cc-chip .dot{width:8px;height:8px;border-radius:50%;flex:none}
        .cc-reason-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Calendar Coverage</h1>
        <p>Which closing jobs are linked to a <b>Google-Calendar</b> event, and which aren't.
           A job is connected via <b>Request #</b> (Job Code for Peter), duplicates broken by move date; a
           2nd entry of the same job (e.g. a delivery leg) links as a <b>sibling</b>, and a job whose branch tag
           differs between the calendar and the closing sheet is recovered as a <b>branch-fix</b> (same customer,
           same day). Every unconnected job is tagged with <b>why</b> — click a reason below to drill in. Most gaps
           are older jobs the calendar never tracked; recent coverage is near-complete.
           <span class="freshness">· read-only · respects the date/company filter</span></p>
      </div>
      <div class="rs-kpis" id="ccKpis"><div class="rs-loading">Loading…</div></div>
      <div id="ccChart"></div>
      <div class="panel" style="margin-top:12px">
        <div class="panel-head"><span class="panel-title" id="ccTitle">Unconnected closings</span></div>
        <div style="padding:12px 16px 6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <input id="ccSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, customer, or company…">
          <span id="ccCount" style="color:var(--muted);font-size:12.5px"></span>
          <span style="flex:1"></span>
          <button id="ccCsv" class="rs-btn" style="font-size:12.5px">⬇ CSV (all)</button>
        </div>
        <div id="ccReasons" style="padding:2px 16px 10px;display:flex;gap:8px;flex-wrap:wrap"></div>
        <div id="ccTable" style="padding:2px 6px 10px;overflow-x:auto"></div>
      </div>`;

    let closingAll, bridgeAll, unconnAll;
    try {
      [closingAll, bridgeAll, unconnAll] = await Promise.all([
        RS.load("closing"), RS.load("bridge_calendar_closing"), RS.load("calendar_unconnected")]);
    } catch (e) {
      document.getElementById("ccKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`;
      return;
    }
    if (!document.getElementById("ccSearch")) return;

    // confident-connected closings (drop dup_ambiguous). `secondary` = a 2nd closing entry
    // (e.g. a delivery leg) linked via a Request # whose primary move matched — counts as connected.
    const connectedUK = new Set(), secondaryUK = new Set(), crossBranchUK = new Set();
    bridgeAll.forEach(b => {
      const mt = norm(b["Match Type"]);
      if (mt !== "dup_ambiguous") connectedUK.add(b["Closing Unique Key"]);
      if (mt === "secondary") secondaryUK.add(b["Closing Unique Key"]);
      if (mt === "cross_branch") crossBranchUK.add(b["Closing Unique Key"]);
    });
    // reason each unconnected closing has no link (No calendar event / Estimate-Box only / …)
    const reasonByUK = new Map();
    unconnAll.forEach(r => reasonByUK.set(r["Unique Key"], r["Reason"] || "—"));

    const rows = RS.filtered("closing", closingAll).filter(r => r["Record Source"] === "closing");
    const isConn = r => connectedUK.has(r["Unique Key"]);
    const connected = rows.filter(isConn);
    const unconnected = rows.filter(r => !isConn(r));
    const secondaryOnly = rows.filter(r => secondaryUK.has(r["Unique Key"])).length;
    const crossOnly = rows.filter(r => crossBranchUK.has(r["Unique Key"])).length;
    const connSub = [fmtN(connected.length) + " jobs",
      secondaryOnly ? fmtN(secondaryOnly) + " via sibling" : null,
      crossOnly ? fmtN(crossOnly) + " via branch-fix" : null].filter(Boolean).join(" · ");

    RSC.kpis(document.getElementById("ccKpis"), [
      { label: "Closings in scope", value: fmtN(rows.length), sub: "current filter" },
      { label: "Connected to calendar", value: pct(connected.length, rows.length), sub: connSub },
      { label: "Unconnected", value: fmtN(unconnected.length), sub: pct(unconnected.length, rows.length) + " of scope" },
    ]);

    // ---- coverage by month (connected vs unconnected) ----
    const byMonth = {};
    rows.forEach(r => {
      const mk = (r._y || "") + "-" + String(r._m || 0).padStart(2, "0");
      const e = byMonth[mk] = byMonth[mk] || { conn: 0, unconn: 0 };
      if (isConn(r)) e.conn++; else e.unconn++;
    });
    const months = Object.keys(byMonth).filter(m => m !== "-00").sort();
    RSC.chartCard(document.getElementById("ccChart"), {
      title: "Calendar coverage by month",
      key: "cc-by-month",
      buildChart(canvas) {
        return new Chart(canvas, {
          type: "bar",
          data: {
            labels: months,
            datasets: [
              { label: "Connected", data: months.map(m => byMonth[m].conn), backgroundColor: "#84cc16", stack: "s" },
              { label: "Unconnected", data: months.map(m => byMonth[m].unconn), backgroundColor: "#e2687a", stack: "s" },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { x: { stacked: true, ticks: { maxRotation: 60, minRotation: 40, font: { size: 10 } } },
                      y: { stacked: true, beginAtZero: true } },
          },
        });
      },
      buildTable() {
        return RSC.table(
          [{ key: "k", label: "Month" },
           { key: "conn", label: "Connected", align: "r", fmt: fmtN },
           { key: "unconn", label: "Unconnected", align: "r", fmt: fmtN },
           { key: "rate", label: "Coverage", align: "r", fmt: v => v }],
          months.map(m => ({ k: m, conn: byMonth[m].conn, unconn: byMonth[m].unconn,
            rate: pct(byMonth[m].conn, byMonth[m].conn + byMonth[m].unconn) })).reverse(),
          { k: "Total", conn: connected.length, unconn: unconnected.length, rate: pct(connected.length, rows.length) });
      },
    });

    // ---- unconnected list (the answer), sliced BY REASON ----
    // reason → [swatch colour, one-line meaning]
    const REASONS = {
      "No calendar event":       ["#e2687a", "no event carries that Request # — mostly older jobs the calendar never tracked"],
      "No Request #":            ["#9aa0aa", "the closing row has no Request # to join on"],
      "Event exists, unmatched": ["#e0a458", "a same-Request# event exists but couldn't be confidently matched (rare)"],
    };
    const reasonOf = r => reasonByUK.get(r["Unique Key"]) || "—";
    const reasonPill = rn => {
      const c = (REASONS[rn] || ["#9aa0aa"])[0];
      return `<span class="cc-reason-pill" style="background:color-mix(in srgb,${c} 20%,transparent);color:${c}">${esc(rn)}</span>`;
    };

    let q = "", reasonFilter = "";
    const paintChips = () => {
      const counts = {};
      unconnected.forEach(r => { const rn = reasonOf(r); counts[rn] = (counts[rn] || 0) + 1; });
      const order = Object.keys(REASONS).filter(k => counts[k]).concat(
        Object.keys(counts).filter(k => !(k in REASONS)));
      const chip = (key, label, n, dot) => `<button class="cc-chip ${reasonFilter === key ? "on" : ""}" data-r="${esc(key)}">
        ${dot ? `<span class="dot" style="background:${dot}"></span>` : ""}${esc(label)} <b>${fmtN(n)}</b></button>`;
      document.getElementById("ccReasons").innerHTML =
        chip("", "All reasons", unconnected.length, "") +
        order.map(rn => chip(rn, rn, counts[rn], (REASONS[rn] || ["#9aa0aa"])[0])).join("");
      document.querySelectorAll("#ccReasons .cc-chip").forEach(b =>
        b.onclick = () => { reasonFilter = b.getAttribute("data-r"); paintChips(); paint(); });
    };
    const paint = () => {
      const nq = norm(q), dq = digits(q);
      let list = unconnected;
      if (reasonFilter) list = list.filter(r => reasonOf(r) === reasonFilter);
      if (nq) list = list.filter(r =>
        norm(r["Request #"]).includes(nq) || norm(r["Customer"]).includes(nq) || norm(r["Company"]).includes(nq)
        || (dq.length >= 4 && digits(r["Request #"]).includes(dq)));
      list = list.slice().sort((a, b) => String(b["Date"] || "").localeCompare(String(a["Date"] || "")));
      document.getElementById("ccCount").textContent =
        fmtN(list.length) + (reasonFilter ? " · " + reasonFilter : " unconnected") + (list.length > CAP ? " · showing first " + CAP : "");
      const body = list.slice(0, CAP).map(r => `<tr>
          <td><b>${esc(r["Request #"] || "—")}</b></td>
          <td>${esc(r["Customer"] || "—")}</td>
          <td>${esc(r["Company"] || "—")}</td>
          <td>${esc(r["Date"] || "—")}</td>
          <td>${reasonPill(reasonOf(r))}</td>
        </tr>`).join("");
      document.getElementById("ccTable").innerHTML = list.length
        ? `<table class="cc-tbl"><thead><tr><th>Request #</th><th>Customer</th><th>Company</th><th>Move Date</th><th>Why unconnected</th></tr></thead><tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:18px">Every closing in scope is connected to a calendar event. 🎉</div>`;
    };
    paintChips();
    paint();
    let t = null;
    document.getElementById("ccSearch").oninput = e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; paint(); }, 120); };
    document.getElementById("ccCsv").onclick = () => {
      const esc2 = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
      const out = reasonFilter ? unconnected.filter(r => reasonOf(r) === reasonFilter) : unconnected;
      const lines = [["Request #", "Customer", "Company", "Move Date", "Why unconnected", "Unique Key"].join(",")].concat(
        out.map(r => [r["Request #"], r["Customer"], r["Company"], r["Date"], reasonOf(r), r["Unique Key"]].map(esc2).join(",")));
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "unconnected-closings.csv"; a.click(); URL.revokeObjectURL(a.href);
    };
};
