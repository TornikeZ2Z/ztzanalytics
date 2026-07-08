/* Leads vs Moveboard — provider-integration audit hub (sidebar item is a MERGED tab group;
   more providers become new tabs). Tab 1: Angi Leads Analysis — a live port of the
   Angi × Moveboard matcher: dedupes the double-ingested angi_leads, repairs day/month-swapped
   Lead Dates, matches on phone/email/name, and only counts a lead as ARRIVED when the moveboard
   row was created within GAP_OK days (identity alone ≠ same lead). Adds the moveboard Flag and
   the full source story: `Source Before Adjustment` → `Source` (via `Source Connector`), plus
   CallRail call evidence for leads that arrived under a different source. */
registerPage({
  id: "angi-vs-moveboard",
  group: "sales",
  title: "Angi Analysis",
  async render(host) {
    const esc = RSC.esc, num = RS.num, money = RS.money, fmtN = RS.fmtN, pct = RS.fmtPct;
    const GAP_OK = 3;      // days: identity match counts as "arrived" only inside this window
    const PAGE = 100;      // rows per page in the comparison table

    // monthly-report-style dark-pill controls, page-scoped (injected once)
    if (!document.getElementById("lvm-css")) {
      const s = document.createElement("style"); s.id = "lvm-css";
      s.textContent = `
      .lvm-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line,#e4e9f0)}
      .lvm-ctl{font:inherit;font-size:12px;font-weight:700;color:#fff;background:#1b2a3f;border:1px solid #2c3e57;border-radius:7px;padding:5px 9px;color-scheme:dark}
      .lvm-ctl:focus{outline:2px solid #b7e23b;outline-offset:1px}
      .lvm-ctl option{color:#fff;background:#1b2a3f}
      input.lvm-ctl::placeholder{color:#8fa0b5}
      .lvm-grp{display:flex;align-items:center;gap:5px;background:#eef1f6;border:1px solid #e4e9f0;border-radius:9px;padding:4px 8px}
      .lvm-lbl{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#5a6775;white-space:nowrap}
      .lvm-x{background:#b7e23b;color:#0e1621;border:0;border-radius:9px;padding:7px 14px;font-size:12px;font-weight:800;cursor:pointer}
      .lvm-x:hover{background:#a8d32c}
      .lvm-ms{position:relative;display:inline-block}
      .lvm-msb{cursor:pointer}
      .lvm-msb .n{background:#b7e23b;color:#0e1621;border-radius:999px;padding:0 7px;margin-left:6px;font-size:10.5px;font-weight:800}
      .lvm-msp{position:absolute;top:calc(100% + 5px);left:0;z-index:80;background:#1b2a3f;border:1px solid #2c3e57;border-radius:10px;padding:8px;min-width:230px;max-width:320px;max-height:320px;overflow:auto;box-shadow:0 14px 34px rgba(14,22,33,.38)}
      .lvm-msp.hidden{display:none}
      .lvm-msrow{display:flex;align-items:center;gap:8px;color:#fff;font-size:12px;font-weight:600;padding:5px 7px;border-radius:6px;cursor:pointer;user-select:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .lvm-msrow:hover{background:#243550}
      .lvm-msrow input{accent-color:#b7e23b;flex:0 0 auto}
      .lvm-msops{display:flex;gap:12px;margin:0 2px 7px}
      .lvm-msops .op{font-size:10.5px;font-weight:800;color:#b7e23b;cursor:pointer;text-transform:uppercase;letter-spacing:.07em}
      .lvm-msops .op:hover{text-decoration:underline}
      .lvm-mss{width:100%;margin-bottom:7px;background:#0e1621;border:1px solid #2c3e57;color:#fff;border-radius:7px;padding:5px 9px;font-size:12px}`;
      document.head.appendChild(s);
    }
    // one global click-away closer for all multiselect panels
    if (!window.__lvmMsClose) { window.__lvmMsClose = true; document.addEventListener("click", () => document.querySelectorAll(".lvm-msp").forEach(p => p.classList.add("hidden"))); }

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>Angi Analysis</b>… (first load pulls the full Moveboard once)</div><div class="bar"><i></i></div></div>`;

    /* ---------- data (cached on window so tab switches don't re-download 100k rows) ---------- */
    const C = window.__lvmCache || (window.__lvmCache = {});
    const grab = p => ZTZ.api(p).then(j => j.rows || []).catch(() => []);
    if (!C.angi || !C.angi.length) {
      const [angi, mb, calls] = await Promise.all([
        grab("/api/angi_leads?limit=1000000&cols=" + encodeURIComponent("Lead Number,Lead Date,Lead Status,Lead Type,Customer First Name,Customer Last Name,Phone,Email,City,State,Zip Code")),
        grab("/api/fct_moveboard?limit=1000000&cols=" + encodeURIComponent("Job No,Customer,Phone,Email,Create Date,Source,Source Before Adjustment,Source Connector,Flag,Status Category,Assigned,Average Quote,State Name")),
        grab("/api/fct_callrail?limit=1000000&cols=" + encodeURIComponent("Phone Number,Source,Start Time")),
      ]);
      // cache ONLY a successful load — a transient bridge failure must not pin an empty page for the session
      if (angi.length && mb.length) { C.angi = angi; C.mb = mb; C.calls = calls; C.rows = null; }
      else { C.angi = null; C.tmp = { angi, mb }; }
    }
    if (!C.angi || !C.angi.length || !C.mb.length) {
      host.innerHTML = `<div class="rs-page-head"><h1>Angi Analysis</h1><p>Did every lead Angi billed us for actually reach our CRM?</p></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">Data unavailable</span></div>
        <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">Could not load ${C.tmp && !C.tmp.angi.length ? "the Angi lead file" : "the Moveboard (CRM) data"}. Navigate away and back to retry, or check the connection.</div></div>`;
      return;
    }

    /* ---------- matching engine (mirror of the audited Python matcher) ---------- */
    const normP = v => String(v == null ? "" : v).replace(/\D/g, "").slice(-10);
    const normE = v => String(v == null ? "" : v).trim().toLowerCase();
    const normN = v => String(v == null ? "" : v).toLowerCase().replace(/[^a-z]/g, "");
    const d2n = s => { const t = String(s || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(t) ? Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10)) / 864e5 : null; };
    const swapD = s => { const t = String(s || "").slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null; const d = +t.slice(8, 10); return d <= 12 ? `${t.slice(0, 4)}-${t.slice(8, 10)}-${t.slice(5, 7)}` : null; };
    const TODAY = Math.floor(Date.now() / 864e5);

    if (!C.rows) {
      // 1) dedupe the double-ingested table (combined file + per-year files): one row per Lead Number, prefer one WITH a date
      const seen = new Map();
      C.angi.forEach(a => { const k = a["Lead Number"]; const prev = seen.get(k); if (!prev || (!String(prev["Lead Date"] || "") && String(a["Lead Date"] || ""))) seen.set(k, a); });
      const leads = [...seen.values()];
      C.dupes = C.angi.length - leads.length;

      // 2) index moveboard by the three identity keys (+ CallRail by phone)
      const idxP = new Map(), idxE = new Map(), idxN = new Map();
      C.mb.forEach((m, i) => {
        const p = normP(m.Phone), em = normE(m.Email), nm = normN(m.Customer);
        if (p.length === 10) (idxP.get(p) || idxP.set(p, []).get(p)).push(i);
        if (em && em.includes("@")) (idxE.get(em) || idxE.set(em, []).get(em)).push(i);
        if (nm.length >= 5) (idxN.get(nm) || idxN.set(nm, []).get(nm)).push(i);
      });
      const callIdx = new Map();
      C.calls.forEach(cl => { const p = normP(cl["Phone Number"]); if (p.length === 10) (callIdx.get(p) || callIdx.set(p, []).get(p)).push({ d: d2n(cl["Start Time"]), src: cl.Source }); });

      // 3) classify every lead
      C.rows = leads.map(a => {
        const rawD = String(a["Lead Date"] || "").slice(0, 10) || "";
        const ldN = d2n(rawD), altS = swapD(rawD), altN = d2n(altS);
        const p = normP(a.Phone), em = normE(a.Email), nm = normN(String(a["Customer First Name"] || "") + String(a["Customer Last Name"] || ""));
        const cand = new Map();
        if (p.length === 10) (idxP.get(p) || []).forEach(i => cand.set(i, (cand.get(i) || 0) | 4));
        if (em && em.includes("@")) (idxE.get(em) || []).forEach(i => cand.set(i, (cand.get(i) || 0) | 2));
        if (nm.length >= 5) (idxN.get(nm) || []).forEach(i => cand.set(i, (cand.get(i) || 0) | 1));
        let best = null;
        cand.forEach((keys, i) => {
          const cdN = d2n(C.mb[i]["Create Date"]);
          const gaps = [ldN, altN].filter(x => x != null && cdN != null).map(x => Math.abs(cdN - x));
          const gap = gaps.length ? Math.min(...gaps) : null;
          const nk = (keys & 4 ? 1 : 0) + (keys & 2 ? 1 : 0) + (keys & 1 ? 1 : 0);
          const rank = [-nk, gap == null ? 99999 : gap];
          if (!best || rank[0] < best.rank[0] || (rank[0] === best.rank[0] && rank[1] < best.rank[1])) best = { rank, i, keys, gap };
        });
        // effective (repaired) lead date: impossible future dates use the swapped form; so do swap-closer matches
        let eff = rawD, repaired = "";
        if (ldN != null && ldN > TODAY && altS) { eff = altS; repaired = "YES"; }
        else if (best && best.gap != null && altN != null && ldN != null && best.gap !== null) {
          const cdN = d2n(C.mb[best.i]["Create Date"]);
          if (cdN != null && Math.abs(cdN - altN) < Math.abs(cdN - ldN)) { eff = altS; repaired = "YES"; }
        }
        const r = { lead: a["Lead Number"], rawD, eff, month: eff ? eff.slice(0, 7) : "", repaired,
          lstatus: a["Lead Status"], ltype: a["Lead Type"], first: a["Customer First Name"], last: a["Customer Last Name"],
          phone: a.Phone, email: a.Email, city: a.City, state: a.State, zip: a["Zip Code"] };
        if (best) {
          const m = C.mb[best.i];
          r.mk = [best.keys & 4 && "phone", best.keys & 2 && "email", best.keys & 1 && "name"].filter(Boolean).join("+");
          r.gap = best.gap;
          // signed gap (MB created MINUS lead date) using whichever date interpretation sits closest
          const cdN2 = d2n(m["Create Date"]); let sg = null;
          [ldN, altN].forEach(x => { if (x != null && cdN2 != null) { const s2 = cdN2 - x; if (sg == null || Math.abs(s2) < Math.abs(sg)) sg = s2; } });
          r.sg = sg;
          // same-day is the integration standard (auto-inflow); within ±GAP_OK = arrived but
          // off-schedule (window is BEFORE or after — never say "late"); beyond it = a different lead
          r.status = sg === 0 ? "Arrived same day"
            : sg != null && Math.abs(sg) <= GAP_OK ? "Arrived 1–3 days off"
            : sg == null ? "Matched (Angi file has no date)" : "Never arrived — customer exists from another lead";
          r.mbCust = m.Customer; r.mbCreate = String(m["Create Date"] || "").slice(0, 10); r.mbSrc = m.Source;
          r.mbFlag = m.Flag && m.Flag !== "None" ? m.Flag : ""; r.mbStatus = m["Status Category"]; r.mbAssigned = m.Assigned;
          r.mbQuote = num(m["Average Quote"]) || null;
          r.attr = String(m.Source) === "Angi" ? "Angi" : "MISATTRIBUTED: " + (m.Source || "(blank)");
          // the full rename story only matters when the lead did NOT stay Angi — Angi-sourced rows read simply
          const before = m["Source Before Adjustment"], conn = m["Source Connector"];
          r.story = String(m.Source) === "Angi" ? "Angi → Angi"
            : `“${before || m.Source}” → “${m.Source}” (via ${conn || "?"})`;
          if (String(m.Source) !== "Angi") {
            const cdN = d2n(m["Create Date"]);
            const ev = (callIdx.get(p) || []).filter(cl => cl.d != null && cdN != null && Math.abs(cl.d - cdN) <= 30);
            if (ev.length) { const e0 = ev.sort((x, y) => Math.abs(x.d - cdN) - Math.abs(y.d - cdN))[0]; r.call = `CallRail: “${e0.src || "?"}” call ${Math.abs(Math.round(e0.d - cdN))}d from create`; }
          }
        } else { r.status = "Never arrived — customer unknown"; r.mk = ""; r.gap = null; }
        return r;
      });
    }
    const rows = C.rows;
    // multiselect filters hold Sets (empty set = no filter); q + date bounds stay scalar
    const st = { q: "", status: new Set(), attr: new Set(), mbst: new Set(), month: new Set(), flag: new Set(), af: "", at: "", cf: "", ct: "", page: 0 };

    /* ---------- helpers ---------- */
    const CHIP = { "Arrived same day": ["#e4f3ea", "#1c7a4a"], "Arrived 1–3 days off": ["#e7f0fb", "#1d4f91"], "Never arrived — customer exists from another lead": ["#fdf3d7", "#7a5a12"], "Matched (Angi file has no date)": ["#eef1f5", "#5a6775"], "Never arrived — customer unknown": ["#fbe6e7", "#b02a37"] };
    const chip = s => { const c = CHIP[s] || CHIP["Never arrived — customer unknown"]; return `<span style="background:${c[0]};color:${c[1]};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap">${esc(s)}</span>`; };
    async function toXlsx(headers, dataRows, name) {
      try {
        if (!window.XLSX) await new Promise((res, rej) => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"; s.onload = res; s.onerror = () => rej(new Error("xlsx lib failed")); document.head.appendChild(s); });
        const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
        ws["!cols"] = headers.map((h, i) => ({ wch: Math.min(38, Math.max(10, ...[h, ...dataRows.slice(0, 200).map(r => String(r[i] == null ? "" : r[i]))].map(v => String(v).length)) + 2) }));
        const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 28));
        XLSX.writeFile(wb, `${name.replace(/[^\w]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
      } catch (e) { alert("Excel export failed: " + (e && e.message || e)); }
    }

    /* ---------- page skeleton ---------- */
    const sameDay = rows.filter(r => r.status === "Arrived same day");
    const late = rows.filter(r => r.status === "Arrived 1–3 days off");
    const arrived = sameDay.concat(late);
    const mis = arrived.filter(r => r.attr !== "Angi");
    const chase = rows.filter(r => r.status === "Never arrived — customer unknown" || r.status === "Never arrived — customer exists from another lead");
    // live share of arrivals stamped exactly one day after the Angi lead date (was a hardcoded 43%)
    const nextDayPct = arrived.length ? pct(arrived.filter(r => r.sg === 1).length / arrived.length) : "—";
    host.innerHTML = `
      <div class="rs-page-head"><h1>Angi Analysis</h1>
        <p>Did every lead Angi billed us for actually reach our CRM? Every Angi lead is checked against Moveboard (our CRM) — the standard is same-day arrival; off-schedule arrivals, missing leads and source changes are all broken out</p></div>
      <div class="rs-kpis" id="lvmKpis"></div>
      <div id="lvmMain"></div><div id="lvmChase"></div><div id="lvmMis"></div><div id="lvmMonthly"></div>
      <div class="panel"><div class="panel-head"><span class="panel-title">Notes on this data</span></div>
        <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">
          ${fmtN(C.dupes)} duplicate rows removed (the same lead appeared more than once in the Angi files) ·
          ${fmtN(rows.filter(r => r.repaired === "YES").length)} lead dates repaired (day and month were swapped) ·
          ${fmtN(rows.filter(r => !r.rawD).length)} leads have no date in the Angi file.
          How it's counted · the standard is a CRM record created the SAME day as the Angi lead; “1–3 days off” means the lead is in our CRM but its record was created up to ${GAP_OK} days before or after (${nextDayPct} of arrivals are stamped the next day); beyond that window the row is treated as a different lead.</div></div>`;
    RSC.kpis(document.getElementById("lvmKpis"), [
      { label: "Unique Angi leads", value: fmtN(rows.length), sub: `${fmtN(C.dupes)} duplicates removed` },
      { label: "Arrived same day", value: pct(sameDay.length / rows.length), sub: `${fmtN(sameDay.length)} leads · the standard` },
      { label: "Arrived 1–3 days off", value: fmtN(late.length), sub: "in our CRM, but not same-day" },
      { label: "Never arrived — customer exists from another lead", value: fmtN(rows.filter(r => r.status === "Never arrived — customer exists from another lead").length), sub: "this lead never flowed in" },
      { label: "Never arrived — customer unknown", value: fmtN(rows.filter(r => r.status === "Never arrived — customer unknown").length), sub: "no trace of the customer" },
      { label: "Arrived under wrong source", value: fmtN(mis.length), sub: "Angi billed us, another source got the credit" },
    ]);

    /* ---------- panel 1: full comparison with filters + export ---------- */
    const months = [...new Set(rows.map(r => r.month).filter(Boolean))].sort().reverse();
    const flags = [...new Set(rows.map(r => r.mbFlag).filter(Boolean))].sort();
    const mbStatuses = [...new Set(rows.map(r => r.mbStatus).filter(Boolean))].sort();
    const main = document.getElementById("lvmMain");
    const mainPanel = document.createElement("div"); mainPanel.className = "panel";
    mainPanel.innerHTML = `
      <div class="panel-head">
        <span class="panel-title">Angi × Moveboard — full comparison</span><span class="spacer"></span>
        <button class="lvm-x" id="fX">⬇ Excel</button></div>
      <div class="lvm-filters">
        <input id="fQ" class="lvm-ctl" placeholder="search name / phone / email…" style="width:200px">
        <span id="msStatus"></span><span id="msAttr"></span><span id="msMB"></span><span id="msFlag"></span><span id="msMonth"></span>
        <span class="lvm-grp"><span class="lvm-lbl">Angi lead date</span>
          <input type="date" id="fAF" class="lvm-ctl"><span class="lvm-lbl">→</span><input type="date" id="fAT" class="lvm-ctl"></span>
        <span class="lvm-grp"><span class="lvm-lbl">Created in Moveboard</span>
          <input type="date" id="fCF" class="lvm-ctl"><span class="lvm-lbl">→</span><input type="date" id="fCT" class="lvm-ctl"></span>
      </div>
      <div style="padding:8px 14px 2px;color:var(--muted);font-size:12.5px">“Arrived” = the lead reached our CRM (same day is the standard; “1–3 days off” can be before or after) · “Never arrived” = Angi billed us but this lead never flowed in — the customer either exists from another lead, or is unknown to us entirely.</div>
      <div class="tabwrap" style="overflow:auto"><div id="lvmTbl"></div></div>
      <div style="padding:6px 14px 0;color:var(--muted);font-size:12.5px">“Source change (original → final)” shows how the lead's source was recorded: the source name as it first arrived → the final source in our CRM.</div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:12px;color:var(--muted)">
        <button class="btn" id="pPrev">‹ Prev</button><span id="pInfo"></span><button class="btn" id="pNext">Next ›</button></div>`;
    main.appendChild(mainPanel);

    const HDR = ["Lead #", "Lead Date", "Status (Angi)", "Type", "First", "Last", "Phone", "Email", "City", "State",
      "Match Status", "Matched on", "Gap (days)", "In our CRM: Customer", "In our CRM: Created", "In our CRM: Source", "Source change (original → final)", "CallRail evidence", "Moveboard Flag", "Moveboard Status", "Assigned", "Avg Quote"];
    const sgTxt = r => r.sg == null ? "" : (r.sg > 0 ? "+" + r.sg : String(r.sg));  // signed: +1 = MB created the day AFTER the lead
    const cellsOf = r => [r.lead, r.eff + (r.repaired ? " *" : ""), r.lstatus, r.ltype, r.first, r.last, r.phone, r.email, r.city, r.state,
      r.status, r.mk || "", sgTxt(r), r.mbCust || "", r.mbCreate || "", r.mbSrc || "", r.story || "", r.call || "", r.mbFlag || "", r.mbStatus || "", r.mbAssigned || "", r.mbQuote == null ? "" : r.mbQuote];
    const attrOf = r => !r.mk ? "(no match)" : r.attr === "Angi" ? "Source = Angi" : "Misattributed";
    const filt = () => rows.filter(r =>
      (!st.status.size || st.status.has(r.status)) &&
      (!st.attr.size || st.attr.has(attrOf(r))) &&
      (!st.mbst.size || st.mbst.has(r.mbStatus || "")) &&
      (!st.month.size || st.month.has(r.month || "")) &&
      (!st.flag.size || st.flag.has(r.mbFlag || "")) &&
      (!st.af || (r.eff && r.eff >= st.af)) && (!st.at || (r.eff && r.eff <= st.at)) &&
      (!st.cf || (r.mbCreate && r.mbCreate >= st.cf)) && (!st.ct || (r.mbCreate && r.mbCreate <= st.ct)) &&
      (!st.q || [r.first, r.last, r.phone, r.email, r.mbCust].some(v => String(v || "").toLowerCase().includes(st.q))));
    function renderTable() {
      const f = filt(); const pages = Math.max(1, Math.ceil(f.length / PAGE)); st.page = Math.min(st.page, pages - 1);
      const slice = f.slice(st.page * PAGE, st.page * PAGE + PAGE);
      document.getElementById("lvmTbl").innerHTML = `<table class="tab"><thead><tr>${HDR.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${
        slice.map(r => { const c = cellsOf(r); return `<tr>${c.map((v, i) => {
          if (i === 10) return `<td>${chip(r.status)}</td>`;
          if (i === 15 && String(r.attr || "").startsWith("MISATTRIBUTED")) return `<td><span style="background:#fdf3d7;color:#7a5a12;padding:1px 6px;border-radius:4px;font-weight:700">${esc(r.mbSrc || "")}</span></td>`;
          return `<td>${esc(v == null ? "" : String(v))}</td>`;
        }).join("")}</tr>`; }).join("")
      }</tbody></table>`;
      document.getElementById("pInfo").textContent = `${fmtN(f.length)} rows · page ${st.page + 1}/${pages}`;
      document.getElementById("pPrev").disabled = st.page === 0; document.getElementById("pNext").disabled = st.page >= pages - 1;
      return f;
    }
    /* checkbox-dropdown multiselect: dark pill button w/ count badge, All/Clear, search on long lists */
    function msel(mountId, key, label, options) {
      const mount = mainPanel.querySelector("#" + mountId);
      const wrap = document.createElement("span"); wrap.className = "lvm-ms"; wrap.dataset.ms = key;
      const btn = document.createElement("button"); btn.className = "lvm-ctl lvm-msb"; wrap.appendChild(btn);
      const pan = document.createElement("div"); pan.className = "lvm-msp hidden"; wrap.appendChild(pan);
      const sel = st[key];
      const paint = () => { btn.innerHTML = `${esc(label)}${sel.size ? `<span class="n">${sel.size}</span>` : ""} ▾`; };
      pan.innerHTML = `${options.length > 8 ? `<input class="lvm-mss" placeholder="type to filter options…">` : ""}
        <div class="lvm-msops"><span class="op all">All</span><span class="op none">Clear</span></div><div class="lvm-msl"></div>`;
      const list = pan.querySelector(".lvm-msl"), ss = pan.querySelector(".lvm-mss");
      const apply = () => { st.page = 0; renderTable(); };
      const build = () => {
        const q = ss ? ss.value.trim().toLowerCase() : "";
        const opts = options.filter(o => !q || o.l.toLowerCase().includes(q));
        list.innerHTML = opts.map(o => `<label class="lvm-msrow"><input type="checkbox" data-val="${esc(o.v)}"${sel.has(o.v) ? " checked" : ""}>${esc(o.l)}</label>`).join("") || `<div class="lvm-msrow" style="opacity:.6">no options match</div>`;
        list.querySelectorAll("input").forEach(cb => cb.onchange = () => { cb.checked ? sel.add(cb.dataset.val) : sel.delete(cb.dataset.val); paint(); apply(); });
      };
      if (ss) ss.oninput = build;
      pan.querySelector(".all").onclick = () => { options.forEach(o => sel.add(o.v)); build(); paint(); apply(); };
      pan.querySelector(".none").onclick = () => { sel.clear(); build(); paint(); apply(); };
      btn.onclick = e => { e.stopPropagation(); document.querySelectorAll(".lvm-msp").forEach(p => { if (p !== pan) p.classList.add("hidden"); }); pan.classList.toggle("hidden"); };
      pan.onclick = e => e.stopPropagation();
      build(); paint(); mount.appendChild(wrap);
    }
    const opt = (arr, blankLabel) => arr.map(v => ({ v, l: v })).concat(blankLabel ? [{ v: "", l: blankLabel }] : []);
    msel("msStatus", "status", "Match status", Object.keys(CHIP).map(v => ({ v, l: v })));
    msel("msAttr", "attr", "Attribution", [{ v: "Source = Angi", l: "Source = Angi" }, { v: "Misattributed", l: "Misattributed" }, { v: "(no match)", l: "(no match)" }]);
    msel("msMB", "mbst", "Moveboard status", opt(mbStatuses, "(no match)"));
    msel("msFlag", "flag", "Moveboard flag", opt(flags, "(no flag)"));
    msel("msMonth", "month", "Month", opt(months, "(no date)"));
    mainPanel.querySelector("#fQ").oninput = e => { st.q = e.target.value.trim().toLowerCase(); st.page = 0; renderTable(); };
    [["fAF", "af"], ["fAT", "at"], ["fCF", "cf"], ["fCT", "ct"]].forEach(([id, k]) =>
      mainPanel.querySelector("#" + id).onchange = e => { st[k] = e.target.value; st.page = 0; renderTable(); });
    mainPanel.querySelector("#pPrev").onclick = () => { st.page--; renderTable(); };
    mainPanel.querySelector("#pNext").onclick = () => { st.page++; renderTable(); };
    mainPanel.querySelector("#fX").onclick = () => toXlsx(HDR, filt().map(cellsOf), "angi-x-moveboard");
    renderTable();

    /* ---------- panel 2: chase list ---------- */
    const CH = ["Lead #", "Lead Date", "Why", "First", "Last", "Phone", "Email", "City", "State", "Angi Status", "Nearest match in our CRM", "In our CRM: Created", "Gap (days)"];
    const chCells = r => [r.lead, r.eff, r.status === "Never arrived — customer unknown" ? "customer unknown" : "customer exists from another lead", r.first, r.last, r.phone, r.email, r.city, r.state, r.lstatus, r.mbCust || "", r.mbCreate || "", sgTxt(r)];
    const p2 = document.createElement("div"); p2.className = "panel";
    p2.innerHTML = `<div class="panel-head"><span class="panel-title">Didn't flow in — chase list (${fmtN(chase.length)})</span><span class="spacer"></span><button class="btn" id="chX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${CH.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${chase.map(r => `<tr>${chCells(r).map(v => `<td>${esc(v == null ? "" : String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>`;
    document.getElementById("lvmChase").appendChild(p2);
    p2.querySelector("#chX").onclick = () => toXlsx(CH, chase.map(chCells), "angi-chase-list");

    /* ---------- panel 3: misattributed with the source story ---------- */
    const MI = ["Lead #", "Lead Date", "First", "Last", "In our CRM: Source", "Source change (original → final)", "CallRail evidence", "Moveboard Flag", "Moveboard Status", "Assigned"];
    const miCells = r => [r.lead, r.eff, r.first, r.last, r.mbSrc, r.story || "", r.call || "", r.mbFlag || "", r.mbStatus || "", r.mbAssigned || ""];
    const p3 = document.createElement("div"); p3.className = "panel";
    p3.innerHTML = `<div class="panel-head"><span class="panel-title">Arrived under the wrong source (${fmtN(mis.length)}) — why the source changed</span><span class="spacer"></span><button class="btn" id="miX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${MI.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${mis.map(r => `<tr>${miCells(r).map(v => `<td>${esc(v == null ? "" : String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>
      <div style="padding:4px 14px 12px;color:var(--muted);font-size:12.5px">“Source change (original → final)” shows how the lead's source was recorded: the source name as it first arrived → the final source in our CRM. “CallRail evidence” shows when a tracked call from this customer's number sits near the lead — the usual reason the team credited an Angi-billed lead to another channel.</div>`;
    document.getElementById("lvmMis").appendChild(p3);
    p3.querySelector("#miX").onclick = () => toXlsx(MI, mis.map(miCells), "angi-misattributed");

    /* ---------- panel 4: monthly arrival ---------- */
    const byM = {};
    rows.forEach(r => { if (!r.month) return; const b = byM[r.month] || (byM[r.month] = { m: r.month, n: 0, ok: 0, off: 0 }); b.n++; if (r.status === "Arrived same day") b.ok++; else if (r.status === "Arrived 1–3 days off") b.off++; });
    const mrows = Object.values(byM).sort((a, b) => a.m.localeCompare(b.m));
    const MH = ["Month", "Leads", "Same day", "1–3 days off", "Never arrived", "Same-day %"];
    const mCells = b => [b.m, b.n, b.ok, b.off, b.n - b.ok - b.off, (b.ok / b.n * 100).toFixed(1) + "%"];
    const p4 = document.createElement("div"); p4.className = "panel";
    p4.innerHTML = `<div class="panel-head"><span class="panel-title">Monthly arrival — same-day standard</span><span class="spacer"></span><button class="btn" id="moX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${MH.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${mrows.map(b => `<tr>${mCells(b).map(v => `<td>${esc(String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>`;
    document.getElementById("lvmMonthly").appendChild(p4);
    p4.querySelector("#moX").onclick = () => toXlsx(MH, mrows.map(mCells), "angi-monthly-arrival");
  }
});
