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
        .cc-reason-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
        /* DESIGN V2: sentence-case table header, neutral hover, navy-tint chips, flat cards */
        body.rs-app.light.v2 #ccSearch{border-radius:8px;background:#FFFFFF;border-color:#CBD5E1;font-size:13.5px}
        body.rs-app.light.v2 #ccSearch:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(37,99,235,.14)}
        body.rs-app.light.v2 .cc-tbl th,body.rs-app.light.v2 .cc-tbl td{font-size:13.5px;color:var(--ink);border-bottom-color:#F1F5F9}
        body.rs-app.light.v2 .cc-tbl th{background:#F8FAFC;color:var(--muted);font-size:12.5px;font-weight:600;text-transform:none;letter-spacing:0;border-bottom-color:var(--line)}
        body.rs-app.light.v2 .cc-tbl tr:hover td{background:#F8FAFC}
        body.rs-app.light.v2 .cc-chip{background:#FFFFFF;border-color:#E2E8F0;font-size:13px}
        body.rs-app.light.v2 .cc-chip:hover{border-color:#93C5FD;background:var(--blue-bg)}
        body.rs-app.light.v2 .cc-chip.on{border-color:#93C5FD;background:var(--blue-bg);color:var(--brand-d)}
        body.rs-app.light.v2 .cc-reason-pill{border-radius:6px;font-size:12px;font-weight:600}
        body.rs-app.light.v2 .cc-mcard{background:#FFFFFF !important;border-radius:10px !important}
        body.rs-app.light.v2 .cc-mcard>div:first-child{font-weight:600 !important;font-size:24px !important}
        body.rs-app.light.v2 .cc-mcard>div:last-child{font-size:12.5px !important;color:var(--faint) !important}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Calendar Coverage</h1>
        <p>Which closing jobs are linked to a <b>Google-Calendar</b> event, and which aren't. <b>2026 onwards.</b>
           A job is connected via <b>Request #</b> (Job Code for Peter), duplicates broken by move date; a
           2nd entry of the same job (e.g. a delivery leg) links as a <b>sibling</b>, and a job whose branch tag
           differs between the calendar and the closing sheet is recovered as a <b>branch-fix</b> (same customer,
           same day). Every unconnected job is tagged with <b>why</b> — click a reason below to drill in. Most gaps
           are older jobs the calendar never tracked; recent coverage is near-complete.
           <span class="freshness">· read-only · respects the date/company filter</span></p>
      </div>
      <div class="rs-kpis" id="ccKpis"><div class="rs-loading">Loading…</div></div>
      <div id="ccChart"></div>
      <div id="ccMethod"></div>
      <div class="panel" style="margin-top:12px">
        <div class="panel-head"><span class="panel-title" id="ccTitle">Unconnected closings</span></div>
        <div style="padding:12px 16px 6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <input id="ccSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, customer, or company…">
          <span id="ccCount" style="color:var(--muted);font-size:12.5px"></span>
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
    // 2026+ only (Tornike 2026-07-30) — dateless rows stay, a missing date is itself a fault
    const _since = window.DQ_SINCE || "2026-01-01";
    closingAll = closingAll.filter(r => !r._d || r._d >= _since);
    unconnAll = (unconnAll || []).filter(r => {
      const d = String(r["Date"] || r["Move Date"] || r._d || "").slice(0, 10);
      return !d || d >= _since;
    });

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

    // ---- HOW each connected job linked: a DIRECT Request # match, or a manual recovery ----
    const directN = connected.length - secondaryOnly - crossOnly;
    const brByUK = new Map();   // uk -> {mt, event} for the non-direct links
    bridgeAll.forEach(b => {
      const mt = norm(b["Match Type"]);
      if (mt === "secondary" || mt === "cross_branch") brByUK.set(b["Closing Unique Key"], { mt, event: b["event_title"] });
    });
    const nonDirect = rows.filter(r => brByUK.has(r["Unique Key"]) && connectedUK.has(r["Unique Key"]))
      .map(r => ({ req: r["Request #"], cust: r["Customer"], date: r["Date"], m: brByUK.get(r["Unique Key"]) }))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const mCard = (color, label, n, meaning) => `<div class="cc-mcard" style="flex:1;min-width:190px;background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px">
        <div style="font-size:23px;font-weight:800;color:${color};font-variant-numeric:tabular-nums">${fmtN(n)}</div>
        <div style="font-size:13px;font-weight:650">${label}</div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:2px">${meaning}</div></div>`;
    // v2: the two recovery routes are categories, not verdicts -> categorical tones, read at render time
    const v2 = RS.isV2();
    const C_LEG = v2 ? RS.V2.cat[3] : "#e0a458", C_XBR = v2 ? RS.V2.cat[1] : "#6aa6e8", C_NONE = v2 ? RS.V2.faint : "#9aa0aa";
    const M = { secondary: [C_LEG, "Via pickup leg"], cross_branch: [C_XBR, "Cross-branch"] };
    const mPill = mt => { const c = M[mt] || [C_NONE, mt]; return `<span class="cc-reason-pill" style="background:color-mix(in srgb,${c[0]} ${v2 ? 12 : 20}%,transparent);color:${c[0]}">${esc(c[1])}</span>`; };
    document.getElementById("ccMethod").innerHTML = `
      <div class="panel" style="margin-top:12px">
        <div class="panel-head"><span class="panel-title">How each job was connected</span></div>
        <div style="padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap">
          ${mCard(v2 ? RS.V2.navy : "var(--brand)", "Direct — Request # match", directN, "matched straight on the Request # / job code")}
          ${mCard(C_LEG, "Via pickup leg", secondaryOnly, "a delivery / 2nd entry with no event of its own — connected through the pickup leg's job code")}
          ${mCard(C_XBR, "Cross-branch", crossOnly, "branch tag differed between calendar &amp; closing — re-matched on same customer + date")}
        </div>
        <div style="padding:0 16px 6px;color:var(--muted);font-size:12.5px">The <b>${fmtN(nonDirect.length)}</b> non-direct links (anything other than a plain Request&nbsp;# match) are listed below so you can review the manual connections.</div>
        <div id="ccMethodTable" style="padding:2px 6px 12px;overflow-x:auto"></div>
      </div>`;
    document.getElementById("ccMethodTable").innerHTML = nonDirect.length
      ? `<table class="cc-tbl"><thead><tr><th>Request #</th><th>Customer</th><th>Move date</th><th>How</th><th>Connected to (calendar event)</th></tr></thead><tbody>${
          nonDirect.slice(0, 400).map(r => `<tr>
            <td><b>${esc(r.req || "—")}</b></td><td>${esc(r.cust || "—")}</td><td>${esc(r.date || "—")}</td>
            <td>${mPill(r.m.mt)}</td><td style="color:var(--muted)">${esc((r.m.event || "").slice(0, 62) || "—")}</td></tr>`).join("")
        }</tbody></table>`
      : `<div class="rs-loading" style="padding:14px">Every connection in scope is a direct Request&nbsp;# match. 🎯</div>`;

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
              { label: "Connected", data: months.map(m => byMonth[m].conn), backgroundColor: v2 ? RS.V2.navy : "#84cc16", stack: "s",
                ...(v2 ? { borderRadius: 4 } : {}) },
              { label: "Unconnected", data: months.map(m => byMonth[m].unconn), backgroundColor: v2 ? RS.V2.neg : "#e2687a", stack: "s",
                ...(v2 ? { borderRadius: 4 } : {}) },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: "bottom" } },
            scales: { x: { stacked: true, ticks: { maxRotation: 60, minRotation: 40, font: { size: v2 ? 12 : 10 } } },
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
      "No calendar event":       [v2 ? RS.V2.neg : "#e2687a", "no event carries that Request # — mostly older jobs the calendar never tracked"],
      "No Request #":            [C_NONE, "the closing row has no Request # to join on"],
      "Event exists, unmatched": [v2 ? RS.V2.warn : "#e0a458", "a same-Request# event exists but couldn't be confidently matched (rare)"],
    };
    const reasonOf = r => reasonByUK.get(r["Unique Key"]) || "—";
    const reasonPill = rn => {
      const c = (REASONS[rn] || [C_NONE])[0];
      return `<span class="cc-reason-pill" style="background:color-mix(in srgb,${c} ${v2 ? 12 : 20}%,transparent);color:${c}">${esc(rn)}</span>`;
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
        order.map(rn => chip(rn, rn, counts[rn], (REASONS[rn] || [C_NONE])[0])).join("");
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
};
