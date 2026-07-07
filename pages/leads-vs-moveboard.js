/* Leads vs Moveboard — provider-integration audit hub (sidebar item is a MERGED tab group;
   more providers become new tabs). Tab 1: Angi Leads Analysis — a live port of the
   Angi × Moveboard matcher: dedupes the double-ingested angi_leads, repairs day/month-swapped
   Lead Dates, matches on phone/email/name, and only counts a lead as ARRIVED when the moveboard
   row was created within GAP_OK days (identity alone ≠ same lead). Adds the moveboard Flag and
   the full source story: `Source Before Adjustment` → `Source` (via `Source Connector`), plus
   CallRail call evidence for leads that arrived under a different source. */
registerPage({
  id: "angi-leads-analysis",
  group: "sales",
  title: "Angi Leads Analysis",
  async render(host) {
    const esc = RSC.esc, num = RS.num, money = RS.money, fmtN = RS.fmtN, pct = RS.fmtPct;
    const GAP_OK = 3;      // days: identity match counts as "arrived" only inside this window
    const PAGE = 100;      // rows per page in the comparison table

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>Angi Leads Analysis</b>… (first load pulls the full moveboard once)</div><div class="bar"><i></i></div></div>`;

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
      host.innerHTML = `<div class="rs-page-head"><h1>Angi Leads Analysis</h1><p>Angi lead file vs moveboard — integration audit</p></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">Data unavailable</span></div>
        <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">Could not load ${C.tmp && !C.tmp.angi.length ? "angi_leads" : "fct_moveboard"} from the bridge. Navigate away and back to retry, or check the API.</div></div>`;
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
          r.status = best.gap != null && best.gap <= GAP_OK ? "MATCHED" : best.gap == null ? "MATCHED (no lead date)" : "SAME CUSTOMER, DIFFERENT LEAD";
          r.mbCust = m.Customer; r.mbCreate = String(m["Create Date"] || "").slice(0, 10); r.mbSrc = m.Source;
          r.mbFlag = m.Flag && m.Flag !== "None" ? m.Flag : ""; r.mbStatus = m["Status Category"]; r.mbAssigned = m.Assigned;
          r.mbQuote = num(m["Average Quote"]) || null;
          r.attr = String(m.Source) === "Angi" ? "Angi" : "MISATTRIBUTED: " + (m.Source || "(blank)");
          const before = m["Source Before Adjustment"], conn = m["Source Connector"];
          r.story = before && String(before) !== String(m.Source) ? `“${before}” → “${m.Source}” (via ${conn || "?"})` : `unchanged${conn ? " · connector " + conn : ""}`;
          if (String(m.Source) !== "Angi") {
            const cdN = d2n(m["Create Date"]);
            const ev = (callIdx.get(p) || []).filter(cl => cl.d != null && cdN != null && Math.abs(cl.d - cdN) <= 30);
            if (ev.length) { const e0 = ev.sort((x, y) => Math.abs(x.d - cdN) - Math.abs(y.d - cdN))[0]; r.call = `CallRail: “${e0.src || "?"}” call ${Math.abs(Math.round(e0.d - cdN))}d from create`; }
          }
        } else { r.status = "NOT IN MOVEBOARD"; r.mk = ""; r.gap = null; }
        return r;
      });
    }
    const rows = C.rows;
    const st = { q: "", status: "", attr: "", month: "", flag: "", page: 0 };

    /* ---------- helpers ---------- */
    const CHIP = { "MATCHED": ["#e4f3ea", "#1c7a4a"], "SAME CUSTOMER, DIFFERENT LEAD": ["#fdf3d7", "#7a5a12"], "MATCHED (no lead date)": ["#eef1f5", "#5a6775"], "NOT IN MOVEBOARD": ["#fbe6e7", "#b02a37"] };
    const chip = s => { const c = CHIP[s] || CHIP["NOT IN MOVEBOARD"]; return `<span style="background:${c[0]};color:${c[1]};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;white-space:nowrap">${esc(s)}</span>`; };
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
    const matched = rows.filter(r => r.status === "MATCHED");
    const mis = matched.filter(r => r.attr !== "Angi");
    const chase = rows.filter(r => r.status === "NOT IN MOVEBOARD" || r.status === "SAME CUSTOMER, DIFFERENT LEAD");
    host.innerHTML = `
      <div class="rs-page-head"><h1>Angi Leads Analysis</h1>
        <p>Every Angi lead vs moveboard — arrived (created within ${GAP_OK} days), missing, or same-customer-different-lead; with moveboard Flag and the source-change story</p></div>
      <div class="rs-kpis" id="lvmKpis"></div>
      <div id="lvmMain"></div><div id="lvmChase"></div><div id="lvmMis"></div><div id="lvmMonthly"></div>
      <div class="panel"><div class="panel-head"><span class="panel-title">Data quality (fix pending in the Angi loader)</span></div>
        <div style="padding:4px 14px 14px;color:var(--muted);font-size:13px">
          ${fmtN(C.dupes)} duplicate rows removed (the loader ingests the combined “Angi Data.xlsx” AND the per-year files — every lead arrives twice) ·
          ${fmtN(rows.filter(r => r.repaired === "YES").length)} Lead Dates repaired (day/month swap) ·
          ${fmtN(rows.filter(r => !r.rawD).length)} leads have no Lead Date in the Angi file.
          Arrival window is ≤ ${GAP_OK} days (96.6% of true arrivals land within 0–1 days).</div></div>`;
    RSC.kpis(document.getElementById("lvmKpis"), [
      { label: "Unique Angi leads", value: fmtN(rows.length), sub: `${fmtN(C.dupes)} duplicates removed` },
      { label: "Arrived in moveboard", value: pct(matched.length / rows.length), sub: `${fmtN(matched.length)} leads · ≤${GAP_OK}d` },
      { label: "Same customer, different lead", value: fmtN(rows.filter(r => r.status === "SAME CUSTOMER, DIFFERENT LEAD").length), sub: "this lead never flowed in" },
      { label: "Not in moveboard", value: fmtN(rows.filter(r => r.status === "NOT IN MOVEBOARD").length), sub: "no trace of the customer" },
      { label: "Arrived under wrong source", value: fmtN(mis.length), sub: "Angi paid, another source credited" },
    ]);

    /* ---------- panel 1: full comparison with filters + export ---------- */
    const months = [...new Set(rows.map(r => r.month).filter(Boolean))].sort().reverse();
    const flags = [...new Set(rows.map(r => r.mbFlag).filter(Boolean))].sort();
    const selCss = `style="font-size:12px;padding:4px 6px;border:1px solid var(--line,#dfe5ec);border-radius:6px;background:var(--card,#fff);color:inherit;max-width:170px"`;
    const main = document.getElementById("lvmMain");
    const mainPanel = document.createElement("div"); mainPanel.className = "panel";
    mainPanel.innerHTML = `
      <div class="panel-head" style="flex-wrap:wrap;gap:6px">
        <span class="panel-title">Angi × Moveboard — full comparison</span><span class="spacer"></span>
        <input id="fQ" placeholder="search name / phone / email…" ${selCss.replace("max-width:170px", "width:190px")}>
        <select id="fS" ${selCss}><option value="">All statuses</option>${Object.keys(CHIP).map(s => `<option>${esc(s)}</option>`).join("")}</select>
        <select id="fA" ${selCss}><option value="">All attributions</option><option value="Angi">Source = Angi</option><option value="MIS">Misattributed</option></select>
        <select id="fM" ${selCss}><option value="">All months</option>${months.map(m => `<option>${m}</option>`).join("")}</select>
        <select id="fF" ${selCss}><option value="">All MB flags</option>${flags.map(f => `<option>${esc(f)}</option>`).join("")}</select>
        <button class="btn" id="fX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto"><div id="lvmTbl"></div></div>
      <div style="display:flex;align-items:center;gap:10px;padding:8px 14px;font-size:12px;color:var(--muted)">
        <button class="btn" id="pPrev">‹ Prev</button><span id="pInfo"></span><button class="btn" id="pNext">Next ›</button></div>`;
    main.appendChild(mainPanel);

    const HDR = ["Lead #", "Lead Date", "Status (Angi)", "Type", "First", "Last", "Phone", "Email", "City", "St",
      "Match Status", "Matched on", "Gap (d)", "MB Customer", "MB Created", "MB Source", "Source story", "CallRail evidence", "MB Flag", "MB Status", "Assigned", "Avg Quote"];
    const cellsOf = r => [r.lead, r.eff + (r.repaired ? " *" : ""), r.lstatus, r.ltype, r.first, r.last, r.phone, r.email, r.city, r.state,
      r.status, r.mk || "", r.gap == null ? "" : r.gap, r.mbCust || "", r.mbCreate || "", r.mbSrc || "", r.story || "", r.call || "", r.mbFlag || "", r.mbStatus || "", r.mbAssigned || "", r.mbQuote == null ? "" : r.mbQuote];
    const filt = () => rows.filter(r =>
      (!st.status || r.status === st.status) &&
      (!st.attr || (st.attr === "Angi" ? r.attr === "Angi" : String(r.attr || "").startsWith("MISATTRIBUTED"))) &&
      (!st.month || r.month === st.month) &&
      (!st.flag || r.mbFlag === st.flag) &&
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
    mainPanel.querySelector("#fQ").oninput = e => { st.q = e.target.value.trim().toLowerCase(); st.page = 0; renderTable(); };
    [["fS", "status"], ["fA", "attr"], ["fM", "month"], ["fF", "flag"]].forEach(([id, k]) =>
      mainPanel.querySelector("#" + id).onchange = e => { st[k] = e.target.value; st.page = 0; renderTable(); });
    mainPanel.querySelector("#pPrev").onclick = () => { st.page--; renderTable(); };
    mainPanel.querySelector("#pNext").onclick = () => { st.page++; renderTable(); };
    mainPanel.querySelector("#fX").onclick = () => toXlsx(HDR, filt().map(cellsOf), "angi-x-moveboard");
    renderTable();

    /* ---------- panel 2: chase list ---------- */
    const CH = ["Lead #", "Lead Date", "Why", "First", "Last", "Phone", "Email", "City", "St", "Angi Status", "Nearest MB match", "MB Created", "Gap (d)"];
    const chCells = r => [r.lead, r.eff, r.status === "NOT IN MOVEBOARD" ? "not in moveboard" : "same customer, different lead", r.first, r.last, r.phone, r.email, r.city, r.state, r.lstatus, r.mbCust || "", r.mbCreate || "", r.gap == null ? "" : r.gap];
    const p2 = document.createElement("div"); p2.className = "panel";
    p2.innerHTML = `<div class="panel-head"><span class="panel-title">Didn't flow in — chase list (${fmtN(chase.length)})</span><span class="spacer"></span><button class="btn" id="chX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${CH.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${chase.map(r => `<tr>${chCells(r).map(v => `<td>${esc(v == null ? "" : String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>`;
    document.getElementById("lvmChase").appendChild(p2);
    p2.querySelector("#chX").onclick = () => toXlsx(CH, chase.map(chCells), "angi-chase-list");

    /* ---------- panel 3: misattributed with the source story ---------- */
    const MI = ["Lead #", "Lead Date", "First", "Last", "MB Source", "Source story", "CallRail evidence", "MB Flag", "MB Status", "Assigned"];
    const miCells = r => [r.lead, r.eff, r.first, r.last, r.mbSrc, r.story || "", r.call || "", r.mbFlag || "", r.mbStatus || "", r.mbAssigned || ""];
    const p3 = document.createElement("div"); p3.className = "panel";
    p3.innerHTML = `<div class="panel-head"><span class="panel-title">Arrived under the WRONG source (${fmtN(mis.length)}) — why the source changed</span><span class="spacer"></span><button class="btn" id="miX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${MI.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${mis.map(r => `<tr>${miCells(r).map(v => `<td>${esc(v == null ? "" : String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>
      <div style="padding:4px 14px 12px;color:var(--muted);font-size:12.5px">“Source story” shows the recorded rename: raw source → final source (via the connector that normalized it). “CallRail evidence” shows when a tracked call from this customer's number sits near the lead — the usual reason ops re-sourced an Angi lead to another channel.</div>`;
    document.getElementById("lvmMis").appendChild(p3);
    p3.querySelector("#miX").onclick = () => toXlsx(MI, mis.map(miCells), "angi-misattributed");

    /* ---------- panel 4: monthly arrival ---------- */
    const byM = {};
    rows.forEach(r => { if (!r.month) return; const b = byM[r.month] || (byM[r.month] = { m: r.month, n: 0, ok: 0 }); b.n++; if (r.status === "MATCHED") b.ok++; });
    const mrows = Object.values(byM).sort((a, b) => a.m.localeCompare(b.m));
    const MH = ["Month", "Leads", "Arrived", "Not arrived", "Arrival %"];
    const mCells = b => [b.m, b.n, b.ok, b.n - b.ok, (b.ok / b.n * 100).toFixed(1) + "%"];
    const p4 = document.createElement("div"); p4.className = "panel";
    p4.innerHTML = `<div class="panel-head"><span class="panel-title">Monthly arrival rate</span><span class="spacer"></span><button class="btn" id="moX">⬇ Excel</button></div>
      <div class="tabwrap" style="overflow:auto;max-height:420px">${`<table class="tab"><thead><tr>${MH.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${mrows.map(b => `<tr>${mCells(b).map(v => `<td>${esc(String(v))}</td>`).join("")}</tr>`).join("")}</tbody></table>`}</div>`;
    document.getElementById("lvmMonthly").appendChild(p4);
    p4.querySelector("#moX").onclick = () => toXlsx(MH, mrows.map(mCells), "angi-monthly-arrival");
  }
});
