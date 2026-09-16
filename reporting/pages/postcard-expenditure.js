/* FINANCIAL ▸ Post Card Expenditure (his ask, 2026-09-15: "create Post Card Expenditure table in
 * financial part - with post card purchases part. each purchase should have its quantities too -
 * so we can properly calculate ROI"; round 2 2026-09-16: a payment can split across states, the
 * mailed grid is edited here, the return is its own line with a graph and a reading).
 *
 * Postcards are bought in bulk and mailed over months, so the expense is recognised on USAGE:
 *   unit cost  = paid ÷ cards bought, cumulative to the month (pooled across states)
 *   cost       = cards mailed that month in that state × unit cost
 *   return     = the leads, booked jobs and revenue whose source is Post Card, by state and month
 *
 * Three lines: 1 purchases (bank ledger + the quantities per state typed in a modal, saved through
 * /api/_pcpurchase), 2 cards mailed by month × state (edited in place, saved through /api/_pcmailed;
 * the sheet was a one-time migration and the portal is the record now), 3 the return by state with
 * a chart and a reading. Everything recomputes from the live answers; the marts catch up hourly.
 */
registerPage({
  id: "postcard-expenditure",
  group: "financial",
  title: "Post Card Expenditure",
  subtitle: "What the postcards cost by the month they were mailed, per state, and what they brought back.",
  datasets: [],

  async render(host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    const fmtN = v => v == null ? "—" : Math.round(v).toLocaleString("en-US");
    const money = v => v == null ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const money2 = v => v == null ? "—" : "$" + Number(v).toFixed(2);
    const x1 = v => v == null || !isFinite(v) ? "—" : Number(v).toFixed(1) + "×";
    const pct1 = v => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";
    const STATES = ["NJ", "PA", "NY", "CT", "MA", "DE", "MD", "VA", "RI"];
    const MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const ymLbl = ym => MON[+ym.slice(5, 7)] + " " + ym.slice(0, 4);

    if (!document.getElementById("pce-style")) {
      const st = document.createElement("style");
      st.id = "pce-style";
      st.textContent = [
        ".pce-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:12px 0}",
        ".pce-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 14px}",
        ".pce-kpi .l{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:700}",
        ".pce-kpi .v{font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;font-variant-numeric:tabular-nums}",
        ".pce-kpi .s{font-size:11.5px;color:var(--muted);margin-top:3px}",
        ".pce-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:6px 0 10px}",
        ".pce-chip{font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);cursor:pointer}",
        ".pce-chip.on{border-color:var(--brand);color:var(--brand-d);background:var(--brand-glow)}",
        ".pce-say{font-size:12.5px;color:var(--muted);line-height:1.6;margin:0 0 10px}",
        ".pce-say b{color:var(--ink)}",
        ".pce-line{margin-top:12px}",
        ".pce-lno{display:inline-block;font-size:11px;font-weight:800;color:var(--brand-d);background:var(--brand-glow);border-radius:999px;padding:2px 9px;margin-right:8px;vertical-align:middle}",
        ".pce-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 8px;font-size:12.5px;outline:0;width:84px;text-align:right}",
        ".pce-in:focus{border-color:var(--brand)} .pce-in.set{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 8%,var(--panel))}",
        ".pce-in.ok{border-color:var(--pos)} .pce-in.bad{border-color:var(--neg)} .pce-in.wide{width:100%;text-align:left}",
        ".pce-split{font-size:11.5px;color:var(--muted)} .pce-split b{color:var(--ink)}",
        ".pce-btn{font-family:inherit;font-size:12px;font-weight:700;padding:5px 11px;border-radius:9px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer}",
        ".pce-btn:hover{border-color:var(--brand)} .pce-btn.pri{background:var(--brand);border-color:var(--brand);color:#fff}",
        ".pce-dim{color:var(--faint)}",
        ".pce-row-before td{opacity:.5}",
        ".pce-tag{display:inline-block;font-size:10.5px;font-weight:800;padding:1px 7px;border-radius:999px;background:var(--brand-glow);color:var(--brand-d);margin-left:6px;white-space:nowrap;vertical-align:1px}",
        ".pce-tag.dim{background:color-mix(in srgb,var(--ink) 8%,var(--panel));color:var(--muted)}",
        ".pce-stock{margin-top:12px;border-top:1px solid var(--line);padding-top:12px}",
        ".pce-stock .neg{color:var(--neg);font-weight:700}",
        ".pce-grid{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:14px}",
        "@media (max-width:1100px){.pce-grid{grid-template-columns:1fr}}",
        ".pce-chart{width:100%;height:auto;display:block;margin:4px 0 6px}",
        ".pce-legend{display:flex;gap:16px;font-size:12px;color:var(--muted);margin-bottom:6px}",
        ".pce-legend i{display:inline-block;width:12px;height:12px;border-radius:3px;vertical-align:-2px;margin-right:5px}",
        ".pce-read{font-size:13px;line-height:1.65;color:var(--ink)} .pce-read li{margin:0 0 7px} .pce-read .w{color:var(--neg);font-weight:700} .pce-read .g{color:var(--pos);font-weight:700}",
        ".pce-addm{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}",
        ".pce-mask{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:900;display:flex;align-items:center;justify-content:center;padding:16px}",
        ".pce-modal{background:var(--panel);border:1px solid var(--line);border-radius:18px;box-shadow:var(--shadow);width:min(740px,100%);max-height:92vh;overflow:auto;padding:20px 22px}",
        ".pce-modal .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:14px}",
        ".pce-modal h3{margin:0 0 3px;font-size:18px;color:var(--ink);letter-spacing:-.2px} .pce-modal .sub{font-size:12.5px;color:var(--muted);line-height:1.5}",
        ".pce-modal .amt{font-size:26px;font-weight:850;color:var(--ink);font-variant-numeric:tabular-nums;white-space:nowrap} .pce-modal .amt small{display:block;font-size:11px;font-weight:700;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;text-align:right}",
        ".pce-modal .eyebrow{font-size:11px;font-weight:800;color:var(--faint);text-transform:uppercase;letter-spacing:.05em;margin:12px 0 7px}",
        ".pce-sgrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px} @media (max-width:560px){.pce-sgrid{grid-template-columns:repeat(2,minmax(0,1fr))}}",
        ".pce-tile{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--line);border-radius:12px;padding:9px 10px 9px 12px;background:var(--panel-2);transition:border-color .12s,background .12s}",
        ".pce-tile.on{border-color:var(--brand);background:var(--brand-glow)} .pce-tile:focus-within{border-color:var(--brand)}",
        ".pce-tile .st{font-weight:850;font-size:14px;color:var(--ink)} .pce-tile .st small{display:block;font-size:10.5px;font-weight:700;color:var(--brand-d);letter-spacing:.03em}",
        ".pce-tile .sh{font-size:11px;color:var(--faint);text-align:right;margin-top:3px;min-height:13px}",
        ".pce-tile input{width:88px}",
        ".pce-pool{display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px dashed var(--line-2);border-radius:12px;padding:9px 12px;margin-top:8px}",
        ".pce-pool .st{font-size:13px;font-weight:700;color:var(--muted)} .pce-pool .st small{display:block;font-weight:500;font-size:11px;color:var(--faint)}",
        ".pce-sum{display:flex;justify-content:space-between;align-items:center;gap:12px;background:color-mix(in srgb,var(--ink) 5%,var(--panel));border-radius:12px;padding:11px 14px;margin-top:12px;flex-wrap:wrap}",
        ".pce-sum .n{font-size:17px;font-weight:850;color:var(--ink)} .pce-sum .n small{font-size:12px;font-weight:600;color:var(--muted);margin-left:5px} .pce-sum .p{font-size:13px;color:var(--muted)} .pce-sum .p b{color:var(--ink);font-size:15px}",
        ".pce-modal .acts{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}",
        ".pce-msg{font-size:12px;color:var(--muted)} .pce-msg.bad{color:var(--neg);font-weight:700} .pce-msg.ok{color:var(--pos);font-weight:700}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div>' +
      '<div class="rs-loading" style="padding:22px">Reading the purchases, the cards mailed and the returns…</div>';

    const hdr = { Authorization: "Bearer " + ZTZ.getToken() };
    const rowsOf = j => (j && j.rows) || [];
    const [month, purchRows, ov, mailedRows] = await Promise.all([
      ZTZ.api("/api/mart_postcard_month?limit=20000").then(rowsOf).catch(() => null),
      ZTZ.api("/api/mart_postcard_purchase?limit=5000").then(rowsOf).catch(() => null),
      fetch(ZTZ.API + "/api/_pcpurchase", { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
      ZTZ.api("/api/fct_postcard_mailed?limit=5000").then(rowsOf).catch(() => null),
    ]);
    if (!month || !purchRows || !mailedRows) {
      host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div><div class="panel">' +
        "The postcard tables are not built yet — they appear after the next hourly data refresh.</div>";
      return;
    }
    const canEdit = !(ov && ov.error);

    // ---- purchases: one object per payment, its splits (state → cards) from the live answers ----
    const PUR = {};
    purchRows.forEach(r => {
      const k = r["Purchase Key"];
      const p = PUR[k] || (PUR[k] = { key: k, date: String(r.Date).slice(0, 10), company: r.Company, provider: r.Provider || r["Sub Category"] || "",
        desc: r.Description || "", amount: num(r.Amount), ledger: r["Ledger State"] || null, splits: [], note: r.Note || null, opening: null });
      if (num(r.Quantity) > 0) p.splits.push({ state: r["Split State"] || null, qty: num(r.Quantity) });
    });
    if (canEdit) {                                   // the page reads its own write table: the live answer wins
      const live = {};
      ((ov && ov.purchases) || []).forEach(o => { (live[o["Purchase Key"]] = live[o["Purchase Key"]] || { splits: [], note: null, opening: null });
        if (num(o.Quantity) > 0) live[o["Purchase Key"]].splits.push({ state: o.State || null, qty: num(o.Quantity) });
        if (o.Note) live[o["Purchase Key"]].note = o.Note;
        if (o.Opening != null) live[o["Purchase Key"]].opening = num(o.Opening); });
      Object.keys(PUR).forEach(k => { if (live[k]) { PUR[k].splits = live[k].splits; PUR[k].note = live[k].note; PUR[k].opening = live[k].opening; } else { PUR[k].splits = []; PUR[k].note = null; PUR[k].opening = null; } });
    }
    const purch = Object.values(PUR).sort((a, b) => b.date.localeCompare(a.date));
    const qtyOf = p => p.splits.reduce((t, s) => t + s.qty, 0);

    // his rule: the balance and the unit cost start at the FIRST MAILED MONTH. The last purchase date before that
    // month is the opening stock; every purchase before it was used up in mailings nobody recorded and stays out.
    function assignRoles() {
      const fm = Object.keys(MAIL).map(k => k.slice(0, 7)).sort()[0] || null;
      const before = purch.filter(p => fm && p.date.slice(0, 7) < fm).map(p => p.date).sort();
      const od = before.length ? before[before.length - 1] : null;
      // a choice typed on the page (counts as opening stock: yes / no) beats the date rule
      purch.forEach(p => { p.role = p.opening === 1 ? "opening" : p.opening === 0 ? "before" : !fm || !od ? "in" : p.date < od ? "before" : p.date === od ? "opening" : "in"; });
      return { fm, od };
    }

    // ---- cards mailed: the editable record ----
    const MAIL = {};                                 // "ym|st" -> cards
    mailedRows.forEach(r => { if (num(r.Cards) > 0) MAIL[r.Month + "|" + r.State] = num(r.Cards); });
    const extraMonths = new Set();

    const years = [...new Set(month.map(r => String(r.Month).slice(0, 4)).concat(purch.map(p => p.date.slice(0, 4))).concat(Object.keys(MAIL).map(k => k.slice(0, 4))))].sort().reverse();
    const LS = "ztzPostcard.v2";
    let C = { year: "all", states: [] };
    try { C = Object.assign(C, JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) { /* fresh */ }
    const remember = () => { try { localStorage.setItem(LS, JSON.stringify(C)); } catch (e) { /* private mode */ } };
    const inYear = ym => C.year === "all" || String(ym).slice(0, 4) === C.year;
    const inStates = st => !C.states.length || C.states.includes(st);

    // unit cost per month: cumulative paid ÷ cumulative cards over the payments that have quantities
    function unitCostByMonth() {
      const byM = {};
      purch.forEach(p => { const q = qtyOf(p); if (!(q > 0) || p.amount == null || p.role === "before") return; const ym = p.date.slice(0, 7);
        (byM[ym] = byM[ym] || { a: 0, q: 0 }); byM[ym].a += p.amount; byM[ym].q += q; });
      let ca = 0, cq = 0; const cum = [];
      Object.keys(byM).sort().forEach(ym => { ca += byM[ym].a; cq += byM[ym].q; cum.push([ym, cq > 0 ? ca / cq : null]); });
      return ym => { let uc = null; for (const [m, u] of cum) { if (m <= ym) uc = u; else break; } return uc; };
    }
    function calc() {
      const R = assignRoles();
      const uc = unitCostByMonth();
      const ret = {};                                // "ym|st" -> {leads, booked, jobs, rev} from the mart
      month.forEach(r => { ret[r.Month + "|" + r.State] = { leads: num(r.Leads) || 0, booked: num(r.Booked) || 0, jobs: num(r.Jobs) || 0, rev: num(r.Revenue) || 0 }; });
      const keys = new Set(Object.keys(MAIL).concat(Object.keys(ret)));
      const rows = [...keys].map(k => { const [ym, st] = k.split("|"); const cards = MAIL[k] || 0, u = uc(ym), r = ret[k] || { leads: 0, booked: 0, jobs: 0, rev: 0 };
        return Object.assign({ ym, st, cards, uc: u, cogs: u != null && cards ? cards * u : (cards ? null : 0) }, r); })
        .filter(r => inYear(r.ym) && inStates(r.st));
      const P = purch.filter(p => inYear(p.date.slice(0, 7)));
      const sum = (a, f) => a.reduce((t, r) => t + (f(r) || 0), 0);
      // the stock: all-time, never filtered by the year chips -- opening + bought since - mailed since the record began
      const stock = { fm: R.fm, od: R.od, open: 0, since: 0, mailed: 0, byState: {}, last: Object.keys(MAIL).map(k => k.slice(0, 7)).sort().pop() || null,
        before: purch.filter(p => p.role === "before").length, beforeSpend: sum(purch.filter(p => p.role === "before"), p => p.amount) };
      const stS = st => stock.byState[st] || (stock.byState[st] = { open: 0, since: 0, mailed: 0 });
      purch.forEach(p => { if (p.role === "before") return; p.splits.forEach(s => { const k = p.role === "opening" ? "open" : "since"; stock[k] += s.qty; stS(s.state || "pooled")[k] += s.qty; }); });
      Object.keys(MAIL).forEach(k => { stock.mailed += MAIL[k]; stS(k.split("|")[1]).mailed += MAIL[k]; });
      stock.left = stock.open + stock.since - stock.mailed;
      const unknown = rows.some(r => r.cards && r.cogs == null);
      const qP = P.filter(p => qtyOf(p) > 0 && p.role !== "before");
      // the return is judged only where cards were mailed AND costed; leads/jobs/revenue in months with no mailed
      // record (2024, any month the grid has not been filled for) are counted apart, never in the ratio
      const costed = rows.filter(r => r.cards && r.cogs != null), open = rows.filter(r => !r.cards);
      return { rows, P, uc, unknown, costed, open, stock,
        cards: sum(rows, r => r.cards), cogs: unknown ? null : sum(rows, r => r.cogs),
        leads: sum(rows, r => r.leads), booked: sum(rows, r => r.booked), jobs: sum(rows, r => r.jobs), rev: sum(rows, r => r.rev),
        revCosted: sum(costed, r => r.rev), jobsCosted: sum(costed, r => r.jobs), leadsCosted: sum(costed, r => r.leads),
        revOpen: sum(open, r => r.rev), jobsOpen: sum(open, r => r.jobs), leadsOpen: sum(open, r => r.leads),
        openMonths: [...new Set(open.filter(r => r.leads || r.jobs).map(r => r.ym))].sort(),
        spend: sum(P, p => p.amount), bought: sum(qP, qtyOf),
        price: qP.length ? sum(qP, p => p.amount) / sum(qP, qtyOf) : null,
        untyped: P.filter(p => !(qtyOf(p) > 0) && p.role !== "before").length };
    }

    const kpi = (l, v, s) => '<div class="pce-kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + "</div>" : "") + "</div>";
    const td = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";
    let K = calc();

    function paintTop() {
      K = calc();
      host.querySelector("#pceKpis").innerHTML =
        kpi("Cards mailed", fmtN(K.cards), "by month and state, line 2") +
        kpi("Paid to the vendor", money(K.spend), fmtN(K.P.length) + " payments · " + (K.untyped ? "<b>" + K.untyped + " without quantities</b>" : "all with quantities")) +
        kpi("Price per card", K.price != null ? money2(K.price) : "—", K.bought ? fmtN(K.bought) + " cards bought" + (K.stock.before ? " (in the balance)" : "") : "type the quantities in line 1") +
        kpi("In stock", K.stock.fm ? fmtN(K.stock.left) : "—", K.stock.fm ? fmtN(K.stock.open + K.stock.since) + " in the balance − " + fmtN(K.stock.mailed) + " mailed" + (K.stock.last ? " to " + ymLbl(K.stock.last) : "") : "no mailed record yet") +
        kpi("Cost of cards mailed", K.cogs != null ? money(K.cogs) : "—", K.unknown ? "unknown until every mailed month has a unit cost" : "mailed × unit cost") +
        kpi("Post card leads", fmtN(K.leads), fmtN(K.booked) + " booked") +
        kpi("Post card revenue", money(K.rev), fmtN(K.jobs) + " jobs · " + (K.cogs > 0 ? x1(K.revCosted / K.cogs) + " the cost" + (K.revOpen ? " (months with cards)" : "") : "—")) +
        (K.openMonths.length ? kpi("Not costed", money(K.revOpen), fmtN(K.leadsOpen) + " leads, " + fmtN(K.jobsOpen) + " jobs in " + K.openMonths.length + " month" + (K.openMonths.length > 1 ? "s" : "") + " with no mailed record") : "");
      paintStock();
      paintReturn();
    }

    // the balance by state: opening + bought since the record began − mailed. A negative state was fed from the pool.
    function paintStock() {
      const S = K.stock, el = host.querySelector("#pceStock");
      if (!S.fm) { el.innerHTML = '<div class="pce-say">The balance starts with the first month typed in line 2.</div>'; return; }
      const keys = Object.keys(S.byState).filter(k => k !== "pooled").sort().concat(S.byState.pooled ? ["pooled"] : []);
      const row = (name, s, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + ">" + td(name, "strong") + td(fmtN(s.open)) + td(fmtN(s.since)) + td(fmtN(s.mailed)) +
        td((s.open + s.since - s.mailed < 0 ? '<span class="neg">' + fmtN(s.open + s.since - s.mailed) + "</span>" : "<b>" + fmtN(s.open + s.since - s.mailed) + "</b>")) + "</tr>";
      el.innerHTML = '<div class="pce-say"><b>Cards in stock — the balance since ' + esc(ymLbl(S.fm)) + "</b>, the first month with a mailed record. " +
        (S.od ? "The purchase of <b>" + esc(S.od) + "</b> is the opening stock; " + (S.before ? "<b>" + S.before + " earlier payment" + (S.before > 1 ? "s" : "") + "</b> (" + money(S.beforeSpend) + ") went out in mailings nobody recorded and stay out of the balance and the unit cost." : "nothing was bought before it.") : "No purchase precedes it, so the balance opens at zero.") +
        " A negative state was mailed from the <b>pooled</b> purchases — split them by state to settle it.</div>" +
        '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Opening</th><th class="num">Bought since</th><th class="num">Mailed</th><th class="num">In stock</th></tr></thead><tbody>' +
        keys.map(k => row(k === "pooled" ? "Pooled (no state)" : esc(k), S.byState[k])).join("") +
        row("All", { open: S.open, since: S.since, mailed: S.mailed }, "tot") + "</tbody></table></div>";
    }

    // ================= line 1: purchases =================
    function paintPurchases() {
      const P = purch.filter(p => inYear(p.date.slice(0, 7)));
      host.querySelector("#pcePurch").innerHTML = P.length
        ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Date</th><th>Company</th><th>Ledger line</th><th>Description</th><th class="num">Paid</th><th class="num">Cards bought</th><th class="num">$ / card</th><th>Split by state</th><th>Note</th><th></th></tr></thead><tbody>' +
          P.map(p => { const q = qtyOf(p);
            const split = p.splits.length ? p.splits.map(s => "<b>" + esc(s.state || "pooled") + "</b> " + fmtN(s.qty)).join(" · ")
              : '<span class="pce-dim">' + (p.ledger ? esc(p.ledger) + " on the ledger · no quantity yet" : "no quantity yet") + "</span>";
            const tag = p.role === "opening" ? '<span class="pce-tag">opening stock</span>' : p.role === "before" ? '<span class="pce-tag dim">before the record</span>' : "";
            return '<tr data-row="' + esc(p.key) + '"' + (p.role === "before" ? ' class="pce-row-before"' : "") + ">" + td(esc(p.date) + tag, "") + td(esc(p.company || ""), "") + td(esc(p.provider), "") +
              td('<span class="pce-dim" title="' + esc(p.desc) + '">' + esc(p.desc.slice(0, 40)) + "</span>", "") +
              td(money(p.amount)) + td(q ? "<b>" + fmtN(q) + "</b>" : '<span class="pce-dim">—</span>') + td(q && p.amount != null ? money2(p.amount / q) : "—") +
              td('<span class="pce-split">' + split + "</span>", "") + td('<span class="pce-dim">' + esc(p.note || "") + "</span>", "") +
              td(canEdit ? '<button class="pce-btn" data-edit="' + esc(p.key) + '">' + (q ? "Edit" : "Add quantities") + "</button>" : "", "") + "</tr>"; }).join("") +
          "</tbody></table></div>"
        : '<div class="pce-say">No postcard payments on the ledger in this selection.</div>';
      host.querySelectorAll("#pcePurch [data-edit]").forEach(b => b.onclick = () => openSplit(b.dataset.edit));
    }

    function openSplit(key) {
      const p = PUR[key]; if (!p) return;
      const cur = {}; p.splits.forEach(s => { cur[s.state || ""] = s.qty; });
      const mask = document.createElement("div"); mask.className = "pce-mask";
      const order = p.ledger ? [p.ledger, ...STATES.filter(s => s !== p.ledger)] : STATES;   // the ledger's state first
      const tile = st => '<label class="pce-tile' + (cur[st] ? " on" : "") + '" data-tile="' + st + '"><span class="st">' + esc(st) + (p.ledger === st ? "<small>on the ledger</small>" : "") + "</span>" +
        '<span><input class="pce-in' + (cur[st] ? " set" : "") + '" type="number" min="0" step="1" data-st="' + st + '" value="' + (cur[st] || "") + '" placeholder="cards"><span class="sh" data-share="' + st + '"></span></span></label>';
      mask.innerHTML = '<div class="pce-modal" role="dialog"><div class="hd"><div><h3>' + esc(p.provider) + "</h3>" +
        '<div class="sub">Paid ' + esc(p.date) + " · " + esc(p.company || "") + (p.desc ? " · " + esc(p.desc.slice(0, 60)) : "") + "</div>" +
        '<div class="sub">Type how many cards this payment bought for each state it covered; leave the rest blank. The amount paid is shared out by cards.</div></div>' +
        '<div class="amt"><small>paid</small>' + money(p.amount) + "</div></div>" +
        '<div class="eyebrow">Cards by state</div><div class="pce-sgrid">' + order.map(tile).join("") + "</div>" +
        '<div class="pce-pool"><span class="st">Not tied to a state<small>pooled — still counts in the unit cost</small></span><span><input class="pce-in' + (cur[""] ? " set" : "") + '" type="number" min="0" step="1" data-st="" value="' + (cur[""] || "") + '" placeholder="cards"></span></div>' +
        '<div class="pce-sum"><span class="n" data-tot>—</span><span class="p" data-price>type the cards to see the price per card</span></div>' +
        (K.stock.fm && p.date.slice(0, 7) < K.stock.fm
          ? '<label class="pce-pool" style="cursor:pointer"><span class="st">Counts as opening stock<small>paid before the mailed record began (' + esc(ymLbl(K.stock.fm)) + ') but still on the shelf then — in the balance and the unit cost</small></span><input type="checkbox" data-opening' + (p.role === "opening" ? " checked" : "") + "></label>"
          : "") +
        '<div style="margin-top:12px"><input class="pce-in wide" type="text" maxlength="500" data-note placeholder="note (optional)" value="' + esc(p.note || "") + '"></div>' +
        '<div class="acts"><button class="pce-btn pri" data-save>Save</button><button class="pce-btn" data-cancel>Cancel</button><span class="pce-msg" data-msg></span></div></div>';
      document.body.appendChild(mask);
      const inputs = [...mask.querySelectorAll("[data-st]")];
      const recalc = () => { const tot = inputs.reduce((t, i) => t + (num(i.value) || 0), 0);
        inputs.forEach(i => { const q = num(i.value) || 0; i.classList.toggle("set", q > 0);
          const t = mask.querySelector('[data-tile="' + i.dataset.st + '"]'); if (t) t.classList.toggle("on", q > 0);
          const sh = mask.querySelector('[data-share="' + i.dataset.st + '"]'); if (sh) sh.textContent = q > 0 && tot ? money(p.amount * q / tot) + " of the paid" : ""; });
        mask.querySelector("[data-tot]").innerHTML = tot ? fmtN(tot) + "<small>cards bought</small>" : "—";
        mask.querySelector("[data-price]").innerHTML = tot && p.amount != null ? "<b>" + money2(p.amount / tot) + "</b> per card" : "type the cards to see the price per card"; };
      inputs.forEach(i => i.addEventListener("input", recalc)); recalc();
      const close = () => { mask.remove(); document.removeEventListener("keydown", onKey); };
      const onKey = e => { if (e.key === "Escape") close(); };
      document.addEventListener("keydown", onKey);
      mask.querySelector("[data-cancel]").onclick = close;
      mask.addEventListener("click", e => { if (e.target === mask) close(); });
      mask.querySelector("[data-save]").onclick = async () => {
        const msg = mask.querySelector("[data-msg]"); msg.className = "pce-msg"; msg.textContent = "saving…";
        const splits = inputs.map(i => ({ state: i.dataset.st, quantity: num(i.value) > 0 ? Math.round(num(i.value)) : null })).filter(s => s.quantity);
        try {
          const r = await fetch(ZTZ.API + "/api/_pcpurchase", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
            body: JSON.stringify({ key, splits, note: mask.querySelector("[data-note]").value.trim(),
              opening: mask.querySelector("[data-opening]") ? mask.querySelector("[data-opening]").checked : null }) });
          const j = await r.json();
          if (!r.ok || j.error) throw new Error(j.error || r.status);
          p.splits = (j.splits || []).filter(s => s.quantity > 0).map(s => ({ state: s.state || null, qty: s.quantity }));
          p.note = j.note || null; p.opening = j.opening == null ? null : num(j.opening);
          close(); paintPurchases(); paintTop();
        } catch (e) { msg.className = "pce-msg bad"; msg.textContent = "not saved: " + String(e.message || e).slice(0, 80); }
      };
      (inputs.find(i => i.dataset.st === (p.ledger || "")) || inputs[1]).focus();
    }

    // ================= line 2: cards mailed, edited in place =================
    function paintMailed() {
      const months = new Set([...Object.keys(MAIL).map(k => k.slice(0, 7)), ...month.map(r => String(r.Month)), ...extraMonths]);
      const yms = [...months].filter(inYear).sort().reverse();
      const cols = STATES.filter(inStates);
      const uc = K.uc;
      const cell = (ym, st) => { const v = MAIL[ym + "|" + st]; return '<input class="pce-in' + (v ? " set" : "") + '" type="number" min="0" step="1" data-ym="' + ym + '" data-st="' + st + '" value="' + (v || "") + '" placeholder="—"' + (canEdit ? "" : " disabled") + ">"; };
      host.querySelector("#pceMailed").innerHTML = yms.length
        ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Month</th>' + cols.map(s => '<th class="num">' + s + "</th>").join("") + '<th class="num">Total</th><th class="num">Unit cost</th><th class="num">Cost of mailed</th></tr></thead><tbody>' +
          yms.map(ym => { const t = cols.reduce((a, s) => a + (MAIL[ym + "|" + s] || 0), 0), u = uc(ym);
            return '<tr data-ym="' + ym + '">' + td(ymLbl(ym), "strong") + cols.map(s => td(cell(ym, s))).join("") +
              td('<b data-tot="' + ym + '">' + fmtN(t) + "</b>") + td(u != null ? money2(u) : "—") + td('<span data-cost="' + ym + '">' + (u != null ? money(t * u) : "—") + "</span>") + "</tr>"; }).join("") +
          "</tbody></table></div>"
        : '<div class="pce-say">No months yet — add one below.</div>';
      if (!canEdit) return;
      const timers = {};
      host.querySelectorAll("#pceMailed input[data-ym]").forEach(el => el.addEventListener("input", () => {
        const k = el.dataset.ym + "|" + el.dataset.st; clearTimeout(timers[k]);
        timers[k] = setTimeout(() => saveCell(el), 600);
      }));
    }
    async function saveCell(el) {
      const ym = el.dataset.ym, st = el.dataset.st, v = el.value.trim();
      el.classList.remove("ok", "bad");
      try {
        const r = await fetch(ZTZ.API + "/api/_pcmailed", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ month: ym, state: st, cards: v === "" ? null : v }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.status);
        if (j.cards > 0) MAIL[ym + "|" + st] = j.cards; else delete MAIL[ym + "|" + st];
        el.classList.toggle("set", j.cards > 0); el.classList.add("ok");
        const cols = STATES.filter(inStates), t = cols.reduce((a, s) => a + (MAIL[ym + "|" + s] || 0), 0), u = K.uc(ym);
        host.querySelector('[data-tot="' + ym + '"]').textContent = fmtN(t);
        host.querySelector('[data-cost="' + ym + '"]').textContent = u != null ? money(t * u) : "—";
        paintTop();
      } catch (e) { el.classList.add("bad"); el.title = "not saved: " + String(e.message || e); }
    }

    // ================= line 3: the return, by state =================
    function paintReturn() {
      const byS = {};
      // per state, only the months with a mailed record: a lead from a month nobody costed is not a return on cards
      K.rows.filter(r => r.cards).forEach(r => { const s = byS[r.st] = byS[r.st] || { cards: 0, cogs: 0, unknown: false, leads: 0, booked: 0, jobs: 0, rev: 0 };
        s.cards += r.cards; if (r.cogs == null) s.unknown = true; else s.cogs += r.cogs || 0; s.leads += r.leads; s.booked += r.booked; s.jobs += r.jobs; s.rev += r.rev; });
      const sts = Object.keys(byS).filter(s => byS[s].cards || byS[s].leads || byS[s].rev).sort((a, b) => byS[b].rev - byS[a].rev || byS[b].cards - byS[a].cards);
      const cost = s => byS[s].unknown ? null : byS[s].cogs;
      // chart: revenue and cost per state, hand-drawn SVG so it follows the theme
      const W = 680, H = 250, padL = 8, padB = 34, padT = 26, gw = sts.length ? (W - padL * 2) / sts.length : 0;
      const maxV = Math.max(1, ...sts.map(s => Math.max(byS[s].rev, cost(s) || 0)));
      const yOf = v => padT + (H - padT - padB) * (1 - v / maxV);
      const bars = sts.map((s, i) => { const x0 = padL + i * gw, bw = Math.min(34, gw * 0.32), c = cost(s), rev = byS[s].rev;
        const bx = x0 + gw / 2 - (c != null ? bw + 3 : bw / 2);
        return (c != null ? '<rect x="' + bx.toFixed(1) + '" y="' + yOf(c).toFixed(1) + '" width="' + bw + '" height="' + (H - padB - yOf(c)).toFixed(1) + '" rx="4" fill="var(--muted)" opacity=".55"/>' +
          '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (yOf(c) - 5).toFixed(1) + '" font-size="10" text-anchor="middle" fill="var(--muted)">' + (c ? "$" + Math.round(c / 1000) + "k" : "") + "</text>" : "") +
          '<rect x="' + (bx + (c != null ? bw + 6 : 0)).toFixed(1) + '" y="' + yOf(rev).toFixed(1) + '" width="' + bw + '" height="' + (H - padB - yOf(rev)).toFixed(1) + '" rx="4" fill="var(--brand)"/>' +
          '<text x="' + (bx + (c != null ? bw + 6 : 0) + bw / 2).toFixed(1) + '" y="' + (yOf(rev) - 5).toFixed(1) + '" font-size="10" text-anchor="middle" fill="var(--ink)" font-weight="700">' + (rev ? "$" + Math.round(rev / 1000) + "k" : "") + "</text>" +
          '<text x="' + (x0 + gw / 2).toFixed(1) + '" y="' + (H - padB + 15) + '" font-size="12" font-weight="800" text-anchor="middle" fill="var(--ink)">' + esc(s) + "</text>" +
          '<text x="' + (x0 + gw / 2).toFixed(1) + '" y="' + (H - padB + 29) + '" font-size="10" text-anchor="middle" fill="var(--faint)">' + (c ? x1(rev / c) : fmtN(byS[s].leads) + " leads") + "</text>"; }).join("");
      const anyCost = sts.some(s => cost(s) != null);
      host.querySelector("#pceChart").innerHTML = sts.length
        ? '<div class="pce-legend"><span><i style="background:var(--brand)"></i>Post card revenue</span>' + (anyCost ? '<span><i style="background:var(--muted);opacity:.55"></i>Cost of cards mailed</span><span>label under the state = revenue per $</span>' : "<span>cost bars appear once the quantities are typed</span>") + "</div>" +
          '<svg class="pce-chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="xMidYMid meet"><line x1="' + padL + '" x2="' + (W - padL) + '" y1="' + (H - padB) + '" y2="' + (H - padB) + '" stroke="var(--line)"/>' + bars + "</svg>"
        : '<div class="pce-say">Nothing in this selection.</div>';

      // the reading
      const read = [];
      const tot = { cards: K.cards, cogs: K.cogs, leads: K.leadsCosted, jobs: K.jobsCosted, rev: K.revCosted };
      if (K.openMonths.length) read.push('<span class="w">' + fmtN(K.leadsOpen) + " leads, " + fmtN(K.jobsOpen) + " jobs and " + money(K.revOpen) + " of revenue fall in " + K.openMonths.length + " month" + (K.openMonths.length > 1 ? "s" : "") + " with no mailed record</span> (" + esc(ymLbl(K.openMonths[0])) + (K.openMonths.length > 1 ? " – " + esc(ymLbl(K.openMonths[K.openMonths.length - 1])) : "") + ") — they are left out of every ratio here. Fill line 2 for those months and they count.");
      const per1k = s => byS[s].cards ? byS[s].leads / byS[s].cards * 1000 : null;
      const withCards = sts.filter(s => byS[s].cards >= 1000);
      if (tot.cogs > 0) read.push("Across every state, <b>$1</b> of postcards mailed came back as <b>" + money2(tot.rev / tot.cogs) + "</b> of revenue (" + money(tot.rev) + " on " + money(tot.cogs) + " of cards).");
      else if (tot.cards) read.push('<span class="w">The cost side is not known yet</span> — ' + (K.untyped ? K.untyped + " payment" + (K.untyped > 1 ? "s" : "") + " in line 1 " + (K.untyped > 1 ? "have" : "has") + " no quantity, so no unit cost exists for the months mailed." : "no purchase covers the months mailed.") + " Revenue and leads are complete; cost, cost per lead and revenue per $ follow once the quantities are typed.");
      if (tot.cards && tot.leads) read.push("<b>" + fmtN(tot.cards) + "</b> cards brought <b>" + fmtN(tot.leads) + "</b> leads — " + (tot.leads / tot.cards * 1000).toFixed(2) + " per 1,000 cards — and <b>" + fmtN(tot.jobs) + "</b> jobs.");
      const rp = withCards.filter(s => cost(s) > 0).map(s => [s, byS[s].rev / cost(s)]).sort((a, b) => b[1] - a[1]);
      if (rp.length >= 2) read.push('Best return per $: <span class="g">' + esc(rp[0][0]) + " " + x1(rp[0][1]) + "</span>; weakest: <span class=\"w\">" + esc(rp[rp.length - 1][0]) + " " + x1(rp[rp.length - 1][1]) + "</span>.");
      const lp = withCards.map(s => [s, per1k(s)]).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]);
      if (lp.length >= 2) read.push("Leads per 1,000 cards: <b>" + esc(lp[0][0]) + "</b> " + lp[0][1].toFixed(2) + " down to <b>" + esc(lp[lp.length - 1][0]) + "</b> " + lp[lp.length - 1][1].toFixed(2) + (lp[lp.length - 1][1] < lp[0][1] / 2 ? ' — the same card works less than half as hard there.' : "."));
      const dead = sts.filter(s => byS[s].cards >= 1000 && !byS[s].leads);
      if (dead.length) read.push('<span class="w">' + dead.map(esc).join(", ") + "</span>: cards mailed, no postcard lead recorded — check the source tagging before reading it as a failed state.");
      if (sts.length && tot.rev) { const top = sts[0]; read.push("<b>" + esc(top) + "</b> takes " + pct1(byS[top].cards / Math.max(1, tot.cards)) + " of the cards and " + pct1(byS[top].rev / tot.rev) + " of the postcard revenue."); }
      const cpl = withCards.filter(s => cost(s) > 0 && byS[s].leads).map(s => [s, cost(s) / byS[s].leads]).sort((a, b) => a[1] - b[1]);
      if (cpl.length >= 2) read.push("Cost per lead runs from <b>" + money(cpl[0][1]) + "</b> (" + esc(cpl[0][0]) + ") to <b>" + money(cpl[cpl.length - 1][1]) + "</b> (" + esc(cpl[cpl.length - 1][0]) + ").");
      host.querySelector("#pceRead").innerHTML = read.length ? "<ul class=\"pce-read\">" + read.map(t => "<li>" + t + "</li>").join("") + "</ul>" : '<div class="pce-say">Nothing to read yet.</div>';

      const line = (name, s, c) => "<tr>" + td(name, "strong") + td(fmtN(s.cards)) + td(c != null ? money(c) : "—") + td(fmtN(s.leads)) + td(s.cards ? (s.leads / s.cards * 1000).toFixed(2) : "—") +
        td(c > 0 && s.leads ? money(c / s.leads) : "—") + td(fmtN(s.booked)) + td(fmtN(s.jobs)) + td(c > 0 && s.jobs ? money(c / s.jobs) : "—") + td(money(s.rev)) + td(c > 0 ? x1(s.rev / c) : "—") + "</tr>";
      host.querySelector("#pceByState").innerHTML =
        '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Mailed</th><th class="num">Cost</th><th class="num">Leads</th><th class="num">per 1,000</th><th class="num">$ / lead</th><th class="num">Booked</th><th class="num">Jobs</th><th class="num">$ / job</th><th class="num">Revenue</th><th class="num">Revenue per $</th></tr></thead><tbody>' +
        sts.map(s => line(esc(s), byS[s], cost(s))).join("") + line("<b>All</b>", tot, tot.cogs) + "</tbody></table></div>";
    }

    function paintBar() {
      host.querySelector("#pceBar").innerHTML =
        '<span class="pce-say" style="margin:0">Year</span>' +
        ['<span class="pce-chip' + (C.year === "all" ? " on" : "") + '" data-y="all">All</span>'].concat(years.map(y => '<span class="pce-chip' + (C.year === y ? " on" : "") + '" data-y="' + y + '">' + y + "</span>")).join("") +
        '<span class="pce-say" style="margin:0 0 0 14px">State</span>' +
        STATES.map(s => '<span class="pce-chip' + (C.states.includes(s) ? " on" : "") + '" data-s="' + s + '">' + s + "</span>").join("");
      const all = () => { remember(); paintBar(); paintPurchases(); paintTop(); paintMailed(); };
      host.querySelectorAll("#pceBar [data-y]").forEach(el => el.onclick = () => { C.year = el.dataset.y; all(); });
      host.querySelectorAll("#pceBar [data-s]").forEach(el => el.onclick = () => { const s = el.dataset.s; C.states = C.states.includes(s) ? C.states.filter(x => x !== s) : C.states.concat(s); all(); });
    }

    host.innerHTML =
      '<div class="rs-page-head"><h1>Post Card Expenditure</h1>' +
      '<p style="max-width:none">Postcards are bought in bulk and mailed over months, so the cost sits on the month the cards went out, not the day the vendor was paid. <b>Unit cost</b> = paid ÷ cards bought, cumulative to that month. <b>Cost of mailed</b> = cards mailed × unit cost. The return is every lead, booked job and closing whose source is <i>Post Card</i>, by the state of the lead.</p></div>' +
      '<div class="pce-bar" id="pceBar"></div>' +
      '<div class="pce-kpis" id="pceKpis"></div>' +
      '<div class="panel pce-line"><div class="panel-title"><span class="pce-lno">1</span>Purchases — every postcard payment on the bank ledger</div>' +
      '<div class="pce-say">Open a payment and type how many cards it bought, per state (one payment can cover several). The price per card and every cost below follow from it. A payment the ledger tags to a state is marked; an untagged one can be split or left <b>pooled</b>. Payments from before the mailed record began are shown but stay out of the balance and the unit cost' + (canEdit ? "" : " — <b>your access is read-only here</b>") + ".</div>" +
      '<div id="pcePurch"></div><div class="pce-stock" id="pceStock"></div></div>' +
      '<div class="panel pce-line"><div class="panel-title"><span class="pce-lno">2</span>Cards mailed by month and state</div>' +
      '<div class="pce-say">The record of what went out. Type straight into the grid — a cell saves as you leave it (green = saved). Clear a cell to remove it. The sheet this was migrated from is history; this grid is the truth now.</div>' +
      '<div id="pceMailed"></div>' +
      (canEdit ? '<div class="pce-addm"><span class="pce-say" style="margin:0">Add a month</span><input class="pce-in" type="month" id="pceNewM" style="width:150px;text-align:left"><button class="pce-btn" id="pceAddM">Add row</button></div>' : "") + "</div>" +
      '<div class="panel pce-line"><div class="panel-title"><span class="pce-lno">3</span>The return, by state</div>' +
      '<div class="pce-grid"><div><div id="pceChart"></div></div><div><div class="pce-say" style="margin-bottom:4px"><b>What the numbers say</b></div><div id="pceRead"></div></div></div>' +
      '<div id="pceByState" style="margin-top:10px"></div></div>';
    paintBar();
    paintPurchases();
    paintTop();
    paintMailed();
    const addBtn = host.querySelector("#pceAddM");
    if (addBtn) addBtn.onclick = () => { const v = (host.querySelector("#pceNewM").value || "").slice(0, 7); if (!/^20\d\d-\d\d$/.test(v)) return;
      extraMonths.add(v); if (C.year !== "all" && C.year !== v.slice(0, 4)) { C.year = "all"; remember(); paintBar(); } paintMailed();
      const first = host.querySelector('#pceMailed tr[data-ym="' + v + '"] input'); if (first) first.focus(); };
  },
});
