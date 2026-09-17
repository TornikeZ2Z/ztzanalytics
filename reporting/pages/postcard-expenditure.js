/* LOGISTICS ▸ Post Card Expenditure (his split, 2026-09-16): every Friday the logistics team writes
 * down how many postcards went out to each state that week. The grid is a tree — year ▸ month ▸ week —
 * that opens on the current week and last week; a week row is one input per state, saved as you leave
 * it (/api/_pcweek). A week is keyed by its Monday and counts in the month it starts; the month record
 * the marts and Financial read is this grid rolled up. Months from before the grid (the vendor's
 * monthly totals, Jan 2025 – Jun 2026) show as one read-only line per month until a week is typed.
 *
 * The shelf: the bridge says what each state SHOULD have today (the reorder model until a count,
 * then the count as the base). Logistics can count a state and type the number over it; the
 * difference to the model is booked as LOST cards in that month (/api/_pccount). Quantities only:
 * no purchase money is shown here.
 */
registerPage({
  id: "postcard-expenditure",
  group: "logistics",
  title: "Post Card Expenditure",
  subtitle: "Cards sent per state, week by week — and what should be on the shelf.",
  datasets: [],

  async render(host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    const fmtN = v => v == null ? "—" : Math.round(v).toLocaleString("en-US");
    const STATES = ["NJ", "PA", "NY", "CT", "MA", "DE", "MD", "VA", "RI"];
    const MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONL = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const pad = n => String(n).padStart(2, "0");
    const iso = d => d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
    const parse = s => new Date(s + "T00:00:00Z");
    const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
    const monday = d => addDays(d, -((d.getUTCDay() + 6) % 7));          // the Monday of d's week
    const dayLbl = d => MON[d.getUTCMonth() + 1] + " " + d.getUTCDate();
    const weekLbl = ws => { const d = parse(ws); return "Mon " + dayLbl(d) + " – Sun " + dayLbl(addDays(d, 6)); };
    const fridayOf = ws => addDays(parse(ws), 4);

    if (!document.getElementById("pcx-style")) {
      const st = document.createElement("style");
      st.id = "pcx-style";
      st.textContent = [
        ".pcx-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}",
        ".pcx-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}",
        ".pcx-kpi .l{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:700}",
        ".pcx-kpi .v{font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;font-variant-numeric:tabular-nums}",
        ".pcx-kpi .s{font-size:11.5px;color:var(--muted);margin-top:3px}",
        ".pcx-say{font-size:12.5px;color:var(--muted);line-height:1.6;margin:0 0 10px} .pcx-say b{color:var(--ink)}",
        ".pcx-line{margin-top:12px}",
        ".pcx-lno{display:inline-block;font-size:11px;font-weight:800;color:var(--brand-d);background:var(--brand-glow);border-radius:999px;padding:2px 9px;margin-right:8px;vertical-align:middle}",
        ".pcx-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 8px;font-size:12.5px;outline:0;width:78px;text-align:right}",
        ".pcx-in:focus{border-color:var(--brand)} .pcx-in.set{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 8%,var(--panel))}",
        ".pcx-in.ok{border-color:var(--pos)} .pcx-in.bad{border-color:var(--neg)}",
        // one fixed column plan for every month, so NJ sits under NJ all the way down the tree
        ".pcx-tree{border:1px solid var(--line);border-radius:12px;overflow:hidden;max-width:1180px}",
        ".pcx-node{border-top:1px solid var(--line)} .pcx-node:first-child{border-top:0}",
        ".pcx-hd{display:flex;align-items:center;gap:10px;padding:10px 16px;cursor:pointer;user-select:none;background:var(--panel)}",
        ".pcx-hd:hover{background:var(--panel-2)} .pcx-hd .car{width:14px;color:var(--faint);font-size:11px;transition:transform .12s} .pcx-node.open>.pcx-hd .car{transform:rotate(90deg)}",
        ".pcx-hd .t{font-weight:800;color:var(--ink);font-size:14px} .pcx-hd.m .t{font-size:13px;font-weight:750} .pcx-hd .n{margin-left:auto;font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)} .pcx-hd .n small{font-weight:500;color:var(--muted);margin-left:6px}",
        ".pcx-hd.m{padding-left:36px;border-top:1px solid var(--line)} .pcx-body{display:none} .pcx-node.open>.pcx-body{display:block}",
        ".pcx-node.open>.pcx-hd{background:var(--panel-2)}",
        ".pcx-weeks{padding:2px 16px 10px 36px;overflow-x:auto}",
        ".pcx-weeks table{border-collapse:collapse;table-layout:fixed;width:1088px;font-size:12.5px}",
        ".pcx-weeks col.w{width:232px} .pcx-weeks col.s{width:84px} .pcx-weeks col.t{width:100px}",
        ".pcx-weeks th{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:700;text-align:center;padding:8px 4px 6px;border-bottom:1px solid var(--line)} .pcx-weeks th:first-child{text-align:left;padding-left:8px} .pcx-weeks th:last-child{text-align:right;padding-right:10px}",
        ".pcx-weeks td{padding:5px 4px;text-align:center;white-space:nowrap;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent);font-variant-numeric:tabular-nums} .pcx-weeks tr:last-child td{border-bottom:0}",
        ".pcx-weeks td:first-child{text-align:left;color:var(--ink);font-weight:600;padding-left:8px;overflow:hidden;text-overflow:ellipsis}",
        ".pcx-weeks th:last-child,.pcx-weeks td.tot{text-align:right;padding-right:10px;border-left:1px solid var(--line)}",
        ".pcx-weeks tbody tr:hover td{background:color-mix(in srgb,var(--ink) 3%,transparent)}",
        ".pcx-weeks .pcx-in{width:70px;text-align:center}",
        ".pcx-weeks tr.now td:first-child{color:var(--brand-d)} .pcx-weeks td.tot{font-weight:800;color:var(--ink)}",
        ".pcx-weeks .sub{display:block;font-size:10.5px;color:var(--faint);font-weight:500;margin-top:1px}",
        ".pcx-tag{display:inline-block;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--brand-glow);color:var(--brand-d);margin-left:6px;white-space:nowrap}",
        ".pcx-tag.dim{background:color-mix(in srgb,var(--ink) 8%,var(--panel));color:var(--muted)}",
        ".pcx-legacy td{color:var(--muted)} .pcx-legacy td:first-child{font-weight:600}",
        ".pcx-shelf table td .neg{color:var(--neg);font-weight:700} .pcx-shelf table td .pos{color:var(--pos);font-weight:700}",
        ".pcx-btn{font-family:inherit;font-size:12px;font-weight:700;padding:5px 11px;border-radius:9px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer} .pcx-btn:hover{border-color:var(--brand)}",
        ".pcx-count{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}",
        ".pcx-msg{font-size:12px;color:var(--muted)} .pcx-msg.bad{color:var(--neg);font-weight:700} .pcx-msg.ok{color:var(--pos);font-weight:700}",
        ".pcx-dim{color:var(--faint)}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div>' +
      '<div class="rs-loading" style="padding:22px">Reading the weeks, the months and the shelf…</div>';

    const hdr = { Authorization: "Bearer " + ZTZ.getToken() };
    const rowsOf = j => (j && j.rows) || [];
    const [weekRows, monthRows, stockSrv] = await Promise.all([
      ZTZ.api("/api/fct_postcard_mailed_week?limit=50000").then(rowsOf).catch(() => null),
      ZTZ.api("/api/fct_postcard_mailed?limit=5000").then(rowsOf).catch(() => null),
      fetch(ZTZ.API + "/api/_pcstock", { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
    ]);
    if (!weekRows || !monthRows) {
      host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div><div class="panel">' +
        "The postcard tables are not built yet — they appear after the next hourly data refresh.</div>";
      return;
    }
    const canEdit = !(stockSrv && stockSrv.error && /access/i.test(stockSrv.error));
    let SRV = stockSrv && !stockSrv.error && stockSrv.states ? stockSrv : null;

    // ---- the record ----
    const WEEK = {};                                  // "YYYY-MM-DD|ST" -> cards (week starts on a Monday)
    weekRows.forEach(r => { if (num(r.Cards) > 0) WEEK[String(r["Week Start"]).slice(0, 10) + "|" + r.State] = num(r.Cards); });
    const MONTH = {};                                 // "YYYY-MM|ST" -> {cards, grain}: the month table (weeks rolled up, or the vendor's / a typed month)
    monthRows.forEach(r => { if (num(r.Cards) > 0) MONTH[r.Month + "|" + r.State] = { cards: num(r.Cards), grain: r.Grain || "month" }; });
    const today = new Date(); today.setUTCHours(0, 0, 0, 0);
    const thisMon = iso(monday(today)), lastMon = iso(addDays(monday(today), -7));
    const ymOf = ws => ws.slice(0, 7);
    const weeksOf = ym => { const out = []; const y = +ym.slice(0, 4), m = +ym.slice(5, 7);       // the Mondays that fall in the month, up to this week
      for (let d = new Date(Date.UTC(y, m - 1, 1)); d.getUTCMonth() === m - 1; d = addDays(d, 1)) { if (d.getUTCDay() === 1 && iso(d) <= thisMon) out.push(iso(d)); }
      return out.reverse(); };
    const weekTot = (ws, sts) => (sts || STATES).reduce((a, s) => a + (WEEK[ws + "|" + s] || 0), 0);
    const monthHasWeeks = ym => STATES.some(s => Object.keys(WEEK).some(k => k.startsWith(ym) && k.endsWith("|" + s)));
    const monthTot = ym => STATES.reduce((a, s) => a + ((MONTH[ym + "|" + s] || {}).cards || 0), 0);
    const monthFromWeeks = ym => weeksOf(ym).reduce((a, ws) => a + weekTot(ws), 0);

    // which months exist: every month from the first record (or Jan 2025) to now
    const firstYm = [...Object.keys(MONTH).map(k => k.slice(0, 7)), ...Object.keys(WEEK).map(k => k.slice(0, 7)), "2025-01"].sort()[0];
    const months = []; { let y = +firstYm.slice(0, 4), m = +firstYm.slice(5, 7); const endY = today.getUTCFullYear(), endM = today.getUTCMonth() + 1;
      while (y < endY || (y === endY && m <= endM)) { months.push(y + "-" + pad(m)); m++; if (m > 12) { m = 1; y++; } } }
    const years = [...new Set(months.map(ym => ym.slice(0, 4)))].sort().reverse();
    const open = new Set([thisMon.slice(0, 4), lastMon.slice(0, 4), ymOf(thisMon), ymOf(lastMon)]);   // his default: this week and last week visible

    const kpi = (l, v, s) => '<div class="pcx-kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + "</div>" : "") + "</div>";
    const td = (v, cls) => '<td class="' + (cls || "") + '">' + v + "</td>";

    function paintKpis() {
      const y = String(today.getUTCFullYear());
      const ytd = months.filter(ym => ym.startsWith(y)).reduce((a, ym) => a + (monthHasWeeks(ym) ? monthFromWeeks(ym) : monthTot(ym)), 0);
      const shelf = SRV ? Object.values(SRV.states).reduce((a, r) => a + (r.should || 0), 0) : null;
      const lost = SRV ? (SRV.counts || []).reduce((a, c) => a + Math.max(0, c.lost || 0), 0) : null;
      host.querySelector("#pcxKpis").innerHTML =
        kpi("This week", fmtN(weekTot(thisMon)), weekLbl(thisMon) + " · report on Fri " + dayLbl(fridayOf(thisMon))) +
        kpi("Last week", fmtN(weekTot(lastMon)), weekLbl(lastMon)) +
        kpi("Sent this year", fmtN(ytd), "all states, " + y) +
        kpi("On the shelf", shelf == null ? "—" : fmtN(shelf), SRV ? "what the states should hold today" : "shelf not available") +
        (lost ? kpi("Lost", fmtN(lost), "counts short of the model") : "");
    }

    // ================= line 1: the tree =================
    function weekRow(ws) {
      const isNow = ws === thisMon, isLast = ws === lastMon;
      return '<tr data-ws="' + ws + '"' + (isNow || isLast ? ' class="now"' : "") + ">" +
        td(weekLbl(ws) + (isNow ? '<span class="pcx-tag">this week</span>' : isLast ? '<span class="pcx-tag dim">last week</span>' : "") + '<span class="sub">report Fri ' + dayLbl(fridayOf(ws)) + "</span>") +
        STATES.map(s => { const v = WEEK[ws + "|" + s]; return td('<input class="pcx-in' + (v ? " set" : "") + '" type="number" min="0" step="1" data-ws="' + ws + '" data-st="' + s + '" value="' + (v || "") + '" placeholder="—"' + (canEdit ? "" : " disabled") + ">"); }).join("") +
        td('<span data-wtot="' + ws + '">' + fmtN(weekTot(ws)) + "</span>", "tot") + "</tr>";
    }
    function monthBody(ym) {
      const ws = weeksOf(ym), hasW = monthHasWeeks(ym), legacy = !hasW && monthTot(ym) > 0;
      return '<div class="pcx-weeks"><table><colgroup><col class="w">' + STATES.map(() => '<col class="s">').join("") + '<col class="t"></colgroup><thead><tr><th>Week</th>' + STATES.map(s => "<th>" + s + "</th>").join("") + "<th>Total</th></tr></thead><tbody>" +
        (legacy ? '<tr class="pcx-legacy"><td>Month total<span class="sub">before the weekly grid — the vendor\'s monthly figure' + (canEdit ? "; type a week below and it takes over" : "") + "</span></td>" +
          STATES.map(s => td(fmtN((MONTH[ym + "|" + s] || {}).cards || null))).join("") + td(fmtN(monthTot(ym)), "tot") + "</tr>" : "") +
        ws.map(weekRow).join("") + (ws.length ? "" : '<tr><td colspan="' + (STATES.length + 2) + '" class="pcx-dim">No week of this month has started yet.</td></tr>') +
        "</tbody></table></div>";
    }
    function paintTree() {
      const el = host.querySelector("#pcxTree");
      el.innerHTML = years.map(y => { const yms = months.filter(ym => ym.startsWith(y)).sort().reverse();
        const yTot = yms.reduce((a, ym) => a + (monthHasWeeks(ym) ? monthFromWeeks(ym) : monthTot(ym)), 0);
        return '<div class="pcx-node' + (open.has(y) ? " open" : "") + '" data-y="' + y + '"><div class="pcx-hd"><span class="car">▶</span><span class="t">' + y + '</span><span class="n">' + fmtN(yTot) + "<small>cards</small></span></div><div class=\"pcx-body\">" +
          yms.map(ym => { const hasW = monthHasWeeks(ym), t = hasW ? monthFromWeeks(ym) : monthTot(ym);
            return '<div class="pcx-node' + (open.has(ym) ? " open" : "") + '" data-ym="' + ym + '"><div class="pcx-hd m"><span class="car">▶</span><span class="t">' + MONL[+ym.slice(5, 7)] + "</span>" +
              (hasW ? "" : t ? '<span class="pcx-tag dim">monthly figure</span>' : "") + '<span class="n" data-mtot="' + ym + '">' + fmtN(t) + "<small>cards</small></span></div><div class=\"pcx-body\">" + monthBody(ym) + "</div></div>"; }).join("") +
          "</div></div>"; }).join("");
      el.querySelectorAll(".pcx-hd").forEach(h => h.addEventListener("click", e => { if (e.target.closest("input")) return; h.parentNode.classList.toggle("open"); }));
      if (!canEdit) return;
      const timers = {};
      el.querySelectorAll("input[data-ws]").forEach(inp => inp.addEventListener("input", () => {
        const k = inp.dataset.ws + "|" + inp.dataset.st; clearTimeout(timers[k]); timers[k] = setTimeout(() => saveWeek(inp), 600); }));
    }
    async function saveWeek(inp) {
      const ws = inp.dataset.ws, st = inp.dataset.st, v = inp.value.trim();
      inp.classList.remove("ok", "bad");
      try {
        const r = await fetch(ZTZ.API + "/api/_pcweek", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ week: ws, state: st, cards: v === "" ? null : v }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.status);
        if (j.cards > 0) WEEK[ws + "|" + st] = j.cards; else delete WEEK[ws + "|" + st];
        inp.classList.toggle("set", j.cards > 0); inp.classList.add("ok");
        const ym = ymOf(ws);
        // the month is the weekly grid now: refresh its total and the year's, and drop the legacy line
        STATES.forEach(s => { const w = weeksOf(ym).reduce((a, x) => a + (WEEK[x + "|" + s] || 0), 0); if (w > 0) MONTH[ym + "|" + s] = { cards: w, grain: "weeks" }; else delete MONTH[ym + "|" + s]; });
        host.querySelector('[data-wtot="' + ws + '"]').textContent = fmtN(weekTot(ws));
        host.querySelector('[data-mtot="' + ym + '"]').innerHTML = fmtN(monthFromWeeks(ym)) + "<small>cards</small>";
        const legacy = host.querySelector('.pcx-node[data-ym="' + ym + '"] tr.pcx-legacy'); if (legacy) legacy.remove();
        const tag = host.querySelector('.pcx-node[data-ym="' + ym + '"] > .pcx-hd .pcx-tag'); if (tag) tag.remove();
        const yNode = host.querySelector('.pcx-node[data-y="' + ym.slice(0, 4) + '"] > .pcx-hd .n');
        if (yNode) yNode.innerHTML = fmtN(months.filter(m => m.startsWith(ym.slice(0, 4))).reduce((a, m) => a + (monthHasWeeks(m) ? monthFromWeeks(m) : monthTot(m)), 0)) + "<small>cards</small>";
        paintKpis();
        refreshShelf();
      } catch (e) { inp.classList.add("bad"); inp.title = "not saved: " + String(e.message || e); }
    }

    // ================= line 2: the shelf =================
    async function refreshShelf() {
      try { const j = await fetch(ZTZ.API + "/api/_pcstock", { headers: hdr }).then(r => r.json()); if (j && !j.error && j.states) { SRV = j; paintShelf(); paintKpis(); } } catch (e) { /* keep what we have */ }
    }
    function paintShelf() {
      const el = host.querySelector("#pcxShelf");
      if (!SRV) { el.innerHTML = '<div class="pcx-say">The shelf could not be read' + (stockSrv && stockSrv.error ? " — " + esc(stockSrv.error) : "") + ".</div>"; return; }
      const keys = STATES.filter(s => SRV.states[s]).concat(Object.keys(SRV.states).filter(s => !STATES.includes(s)).sort());
      const lastCount = {}; (SRV.counts || []).forEach(c => { if (!lastCount[c.state] || c.date > lastCount[c.state].date) lastCount[c.state] = c; });
      const row = st => { const r = SRV.states[st], c = lastCount[st];
        return '<tr data-st="' + st + '">' + td("<b>" + esc(st) + "</b>") +
          td(r.should == null ? '<span class="pcx-dim">no buy on file</span>' : r.should < 0 ? '<span class="neg">' + fmtN(r.should) + "</span>" : "<b>" + fmtN(r.should) + "</b>", "num") +
          td(r.basis === "count" ? "from the count of " + esc(r.last_count.date) + " (" + fmtN(r.last_count.counted) + ")" : r.basis === "reorder" ? '<span class="pcx-dim">the reorder model — never counted</span>' : "—") +
          td(fmtN(r.bought_since), "num") + td(fmtN(r.mailed_since), "num") +
          td(c ? fmtN(c.counted) + ' <span class="pcx-dim">on ' + esc(c.date) + "</span>" + (c.lost != null ? (c.lost > 0 ? ' · <span class="neg">' + fmtN(c.lost) + " lost</span>" : c.lost < 0 ? ' · <span class="pos">' + fmtN(-c.lost) + " found</span>" : " · exact") : "") : '<span class="pcx-dim">never</span>') +
          td(canEdit ? '<input class="pcx-in" type="number" min="0" step="1" data-cnt="' + st + '" placeholder="counted">' : "", "num") + "</tr>"; };
      const lostTot = (SRV.counts || []).reduce((a, c) => a + Math.max(0, c.lost || 0), 0);
      el.innerHTML = '<div class="pcx-say"><b>What each state should have on the shelf today.</b> Until a state is counted the number comes from the reorder rule (a state buys when about ' + fmtN(SRV.shelf) + " cards are left, so a buy is the size of what went out until the next buy). " +
        "Count a state and type the number: from then on the balance runs from your count, and whatever the count fell short of the model is booked as <b>lost</b> in that month" + (lostTot ? " — <b>" + fmtN(lostTot) + " lost so far</b>" : "") + ".</div>" +
        '<div class="rs-tablewrap pcx-shelf"><table class="rs-table"><thead><tr><th>State</th><th class="num">Should have</th><th>Basis</th><th class="num">Bought since</th><th class="num">Sent since</th><th>Last count</th><th class="num">Count now</th></tr></thead><tbody>' +
        keys.map(row).join("") + "</tbody></table></div>" +
        (canEdit ? '<div class="pcx-count"><span class="pcx-say" style="margin:0">Count date</span><input class="pcx-in" type="date" id="pcxCntDate" style="width:150px;text-align:left" value="' + esc(SRV.today) + '" max="' + esc(SRV.today) + '">' +
          '<input class="pcx-in" type="text" id="pcxCntNote" maxlength="500" placeholder="note (optional)" style="width:260px;text-align:left"><button class="pcx-btn" id="pcxCntSave">Save the counts</button><span class="pcx-msg" id="pcxCntMsg"></span></div>' : "");
      const btn = host.querySelector("#pcxCntSave");
      if (btn) btn.onclick = saveCounts;
    }
    async function saveCounts() {
      const msg = host.querySelector("#pcxCntMsg"); msg.className = "pcx-msg"; msg.textContent = "saving…";
      const date = host.querySelector("#pcxCntDate").value, note = host.querySelector("#pcxCntNote").value.trim();
      const inputs = [...host.querySelectorAll("input[data-cnt]")].filter(i => i.value.trim() !== "");
      if (!inputs.length) { msg.className = "pcx-msg bad"; msg.textContent = "type a counted number for at least one state"; return; }
      const done = [];
      try {
        for (const i of inputs) {
          const r = await fetch(ZTZ.API + "/api/_pccount", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
            body: JSON.stringify({ date, state: i.dataset.cnt, counted: i.value.trim(), note }) });
          const j = await r.json();
          if (!r.ok || j.error) throw new Error(i.dataset.cnt + ": " + (j.error || r.status));
          done.push(i.dataset.cnt + " " + fmtN(j.counted) + (j.lost > 0 ? " (" + fmtN(j.lost) + " lost)" : j.lost < 0 ? " (" + fmtN(-j.lost) + " found)" : ""));
        }
        msg.className = "pcx-msg ok"; msg.textContent = "saved: " + done.join(" · ");
        await refreshShelf();
        const m2 = host.querySelector("#pcxCntMsg"); if (m2) { m2.className = "pcx-msg ok"; m2.textContent = "saved: " + done.join(" · "); }
      } catch (e) { msg.className = "pcx-msg bad"; msg.textContent = "not saved — " + String(e.message || e).slice(0, 120) + (done.length ? " (saved: " + done.join(", ") + ")" : ""); }
    }

    host.innerHTML =
      '<div class="rs-page-head"><h1>Post Card Expenditure</h1>' +
      '<p style="max-width:none">Every Friday, write down how many postcards went out to each state that week. Open a year, then a month, and type into the week — a cell saves as you leave it (green = saved). This week and last week are open by default.' + (canEdit ? "" : " <b>Your access is read-only here.</b>") + "</p></div>" +
      '<div class="pcx-kpis" id="pcxKpis"></div>' +
      '<div class="panel pcx-line"><div class="panel-title"><span class="pcx-lno">1</span>Cards sent — by year, month and week</div>' +
      '<div class="pcx-say">A week runs Monday to Sunday and counts in the month it starts. Months from before this grid show the vendor\'s monthly figure on one line; the first week you type in such a month takes over as the record for that month.</div>' +
      '<div class="pcx-tree" id="pcxTree"></div></div>' +
      '<div class="panel pcx-line"><div class="panel-title"><span class="pcx-lno">2</span>The shelf — what should be there, and what you counted</div>' +
      '<div id="pcxShelf"></div></div>';
    paintKpis();
    paintTree();
    paintShelf();
  },
});
