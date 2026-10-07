/* ADMIN page: Request # Consistency — cross-checks every closing's customer name against the
   moveboard record (same Request Joinkey) and the linked calendar event. A disagreement is the
   fingerprint of a MIS-KEYED Request # (moveboard→calendar transfer is manual, so a wrong number
   ties a closing to a stranger's job). Reads the pre-computed dq_calendar_consistency table.
   Read-only: it lists problems to fix at the source sheet. Ignores the global date/company filter. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.dq_calendar_consistency) {
    RS.DATASETS.dq_calendar_consistency = {
      table: "dq_calendar_consistency",
      cols: ["Request #", "Company", "Date", "Closing Customer", "Moveboard Customer",
             "Calendar Customer", "Status", "Revenue"],
    };
  }
})();

// Rendered as a TAB inside the Data Quality hub (no longer a standalone page).
(window.DQ_SUB = window.DQ_SUB || {}).consistency = async function (host) {
    const CAP = 500;
    const esc = RSC.esc, fmtN = RS.fmtN;
    const norm = s => String(s == null ? "" : s).trim().toLowerCase();
    const money = v => (v == null || v === "" || isNaN(+v)) ? "—" : "$" + Math.round(+v).toLocaleString();

    // status -> [colour, label, meaning]; v2 tones read at render time (the theme button re-renders)
    const v2 = RS.isV2();
    const STATUS = {
      miskey:        [v2 ? RS.V2.neg : "#e2687a", "Mis-key", "the Request # links this closing to a DIFFERENT person's job (different pickup zip) — almost certainly a mistyped number"],
      name_variant:  [v2 ? RS.V2.warn : "#e0a458", "Name variant", "same job — a spelling typo or a 2nd person on the move (couple / coordinator). Benign."],
      test_record:   [v2 ? RS.V2.faint : "#9aa0aa", "Test record", "linked to a draft / test moveboard record, not a real customer"],
    };

    if (!document.getElementById("rc-style")) {
      const st = document.createElement("style"); st.id = "rc-style";
      st.textContent = `
        #rcSearch{width:100%;max-width:420px;padding:10px 13px;border-radius:11px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:14px;font-family:inherit;outline:none}
        #rcSearch:focus{border-color:var(--brand)}
        .rc-tbl{width:100%;border-collapse:collapse}
        .rc-tbl th,.rc-tbl td{padding:8px 12px;font-size:12.5px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}
        .rc-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .rc-tbl tr:hover td{background:var(--panel-2)}
        .rc-neq{color:#e2687a;font-weight:700}
        .rc-chip{display:inline-flex;align-items:center;gap:7px;padding:6px 12px;border-radius:999px;cursor:pointer;
          border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);font-size:12.5px;font-weight:600;
          font-family:inherit;transition:border-color .12s,background .12s}
        .rc-chip:hover{border-color:var(--brand)}
        .rc-chip.on{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 14%,transparent)}
        .rc-chip .dot{width:8px;height:8px;border-radius:50%;flex:none}
        .rc-chip b{font-variant-numeric:tabular-nums}
        .rc-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
        /* DESIGN V2: sentence-case table header, neutral hover, accent-tint chips, flat pills */
        body.rs-app.light.v2 #rcSearch{border-radius:8px;background:#FFFFFF;border-color:#CBD5E1;font-size:13.5px}
        body.rs-app.light.v2 #rcSearch:focus{border-color:var(--brand);box-shadow:0 0 0 3px rgba(63,125,32,.14)}
        body.rs-app.light.v2 .rc-tbl th,body.rs-app.light.v2 .rc-tbl td{font-size:13.5px;color:var(--ink);border-bottom-color:#F1F5F9}
        body.rs-app.light.v2 .rc-tbl th{background:#F8FAFC;color:var(--muted);font-size:12.5px;font-weight:600;text-transform:none;letter-spacing:0;border-bottom-color:var(--line)}
        body.rs-app.light.v2 .rc-tbl tr:hover td{background:#F8FAFC}
        body.rs-app.light.v2 .rc-tbl td.rc-neq{color:#B91C1C;font-weight:600}
        body.rs-app.light.v2 .rc-chip{background:#FFFFFF;border-color:#E2E8F0;font-size:13px}
        body.rs-app.light.v2 .rc-chip:hover{border-color:#C9E68A;background:var(--blue-bg)}
        body.rs-app.light.v2 .rc-chip.on{border-color:#C9E68A;background:var(--blue-bg);color:var(--brand-d)}
        body.rs-app.light.v2 .rc-pill{border-radius:6px;font-size:12px;font-weight:600}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Request # Consistency</h1>
        <p>Every closing's customer, cross-checked against its <b>moveboard</b> record and its <b>calendar</b> event.
           When the names disagree, the <b>Request #</b> was likely mis-typed — tying the closing to a stranger's job.
           A different <b>pickup zip</b> confirms a real mis-key; the same zip means one job with two names (benign).
           <span class="freshness">· read-only · rebuilt nightly · fix at the closing sheet</span></p>
      </div>
      <div class="rs-kpis" id="rcKpis"><div class="rs-loading">Loading…</div></div>
      <div class="panel" style="margin-top:12px">
        <div class="panel-head"><span class="panel-title">Flagged closings</span></div>
        <div style="padding:12px 16px 6px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <input id="rcSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, customer, or company…">
          <span id="rcCount" style="color:var(--muted);font-size:12.5px"></span>
        </div>
        <div id="rcChips" style="padding:2px 16px 10px;display:flex;gap:8px;flex-wrap:wrap"></div>
        <div id="rcTable" style="padding:2px 6px 10px;overflow-x:auto"></div>
      </div>`;

    let all;
    try {
      all = await RS.load("dq_calendar_consistency");
    } catch (e) {
      document.getElementById("rcKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`;
      return;
    }
    if (!document.getElementById("rcSearch")) return;
    // 2026+ only (Tornike 2026-07-30) — dateless rows stay, a missing date is itself a fault
    const _since = window.DQ_SINCE || "2026-01-01";
    all = all.filter(r => {
      const d = String(r["Date"] || "").slice(0, 10);
      return !d || d >= _since;
    });

    const miskeys = all.filter(r => r["Status"] === "miskey");
    const riskRev = miskeys.reduce((a, r) => a + (+r["Revenue"] || 0), 0);
    RSC.kpis(document.getElementById("rcKpis"), [
      { label: "Flagged closings", value: fmtN(all.length), sub: "2026 onwards" },
      { label: "Likely mis-keys", value: fmtN(miskeys.length), sub: "different-person, high confidence" },
      { label: "Revenue on mis-keyed", value: money(riskRev), sub: "attributed to the wrong job" },
    ]);

    const pill = s => {
      const c = (STATUS[s] || [v2 ? RS.V2.faint : "#9aa0aa", s])[0], lbl = (STATUS[s] || ["", s])[1];
      return `<span class="rc-pill" style="background:color-mix(in srgb,${c} ${v2 ? 12 : 20}%,transparent);color:${c}">${esc(lbl)}</span>`;
    };
    // a name cell that highlights when it disagrees with the closing customer
    const nameCell = (val, closing) => {
      if (val == null || String(val).trim() === "") return `<td style="color:var(--faint)">—</td>`;
      const diff = norm(val) && norm(closing) && !norm(val).split(/\s+/).some(t => t.length >= 3 && norm(closing).includes(t));
      return `<td class="${diff ? "rc-neq" : ""}">${esc(val)}</td>`;
    };

    let q = "", statusFilter = "";
    const chips = () => {
      const counts = {};
      all.forEach(r => { counts[r["Status"]] = (counts[r["Status"]] || 0) + 1; });
      const order = ["miskey", "name_variant", "test_record"].filter(k => counts[k]);
      const chip = (key, label, nn, dot) => `<button class="rc-chip ${statusFilter === key ? "on" : ""}" data-s="${esc(key)}">
        ${dot ? `<span class="dot" style="background:${dot}"></span>` : ""}${esc(label)} <b>${fmtN(nn)}</b></button>`;
      document.getElementById("rcChips").innerHTML =
        chip("", "All", all.length, "") +
        order.map(s => chip(s, (STATUS[s] || ["", s])[1], counts[s], (STATUS[s] || [v2 ? RS.V2.faint : "#9aa0aa"])[0])).join("");
      document.querySelectorAll("#rcChips .rc-chip").forEach(b =>
        b.onclick = () => { statusFilter = b.getAttribute("data-s"); chips(); paint(); });
    };
    const paint = () => {
      const nq = norm(q);
      let list = all;
      if (statusFilter) list = list.filter(r => r["Status"] === statusFilter);
      if (nq) list = list.filter(r => ["Request #", "Closing Customer", "Moveboard Customer", "Calendar Customer", "Company"]
        .some(k => norm(r[k]).includes(nq)));
      // mis-keys first, then by date desc
      const rank = s => (s === "miskey" ? 0 : s === "name_variant" ? 1 : 2);
      list = list.slice().sort((a, b) => rank(a["Status"]) - rank(b["Status"]) ||
        String(b["Date"] || "").localeCompare(String(a["Date"] || "")));
      document.getElementById("rcCount").textContent =
        fmtN(list.length) + (statusFilter ? " · " + (STATUS[statusFilter] || ["", statusFilter])[1] : " flagged")
        + (list.length > CAP ? " · showing first " + CAP : "");
      const body = list.slice(0, CAP).map(r => `<tr>
          <td><b>${esc(r["Request #"] || "—")}</b></td>
          <td>${esc(r["Company"] || "—")}</td>
          <td>${esc(r["Date"] || "—")}</td>
          <td><b>${esc(r["Closing Customer"] || "—")}</b></td>
          ${nameCell(r["Moveboard Customer"], r["Closing Customer"])}
          ${nameCell(r["Calendar Customer"], r["Closing Customer"])}
          <td>${pill(r["Status"])}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${money(r["Revenue"])}</td>
        </tr>`).join("");
      document.getElementById("rcTable").innerHTML = list.length
        ? `<table class="rc-tbl"><thead><tr><th>Request #</th><th>Company</th><th>Move date</th>
             <th>Closing says</th><th>Moveboard says</th><th>Calendar says</th><th>Status</th><th class="r" style="text-align:right">Revenue</th></tr></thead>
             <tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:18px">No flagged closings. 🎉</div>`;
    };
    chips();
    paint();
    let t = null;
    document.getElementById("rcSearch").oninput = e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value; paint(); }, 120); };
};
