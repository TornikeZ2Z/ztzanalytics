/* FINANCIAL ▸ Post Card Expenditure (his ask, 2026-09-15: "create Post Card Expenditure table in
 * financial part - with post card purchases part. each purchase should have its quantities too -
 * so we can properly calculate ROI").
 *
 * Postcards are bought in bulk and mailed over months, so the expense is recognised on USAGE:
 *   unit cost  = purchase $ ÷ cards bought, cumulative to the month (pooled across states)
 *   COGS       = cards mailed that month in that state × unit cost
 *   return     = the leads, booked jobs and revenue whose source is Post Card, by state and month
 *
 * Purchases come from the bank ledger (fct_card_expenses); the QUANTITY on each is typed here and
 * saved through /api/_pcpurchase (history kept). Cards mailed per state per month come from the
 * vendor's Google Sheet (fct_postcard_mailed). Everything below the purchases table recomputes
 * from the live answers, so a quantity typed now changes COGS now; the marts catch up hourly.
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
    const x1 = v => v == null ? "—" : Number(v).toFixed(1) + "×";
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
        ".pce-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 8px;font-size:12.5px;outline:0;width:92px;text-align:right}",
        ".pce-in:focus{border-color:var(--brand)} .pce-in.set{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 8%,var(--panel))}",
        ".pce-in.note{width:180px;text-align:left}",
        ".pce-sel{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:8px;color:var(--ink);padding:5px 6px;font-size:12.5px}",
        ".pce-st{font-size:11px;color:var(--faint);min-width:52px;display:inline-block} .pce-st.ok{color:var(--pos);font-weight:700} .pce-st.bad{color:var(--neg);font-weight:700}",
        ".pce-dim{color:var(--faint)}",
        ".pce-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:12px;margin-top:12px}",
        ".pce-grid>.panel{min-width:0}",
        ".pce-sec{margin-top:12px}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div>' +
      '<div class="rs-loading" style="padding:22px">Reading the purchases, the cards mailed and the returns…</div>';

    const hdr = { Authorization: "Bearer " + ZTZ.getToken() };
    const rowsOf = j => (j && j.rows) || [];
    const [month, purch, ov] = await Promise.all([
      ZTZ.api("/api/mart_postcard_month?limit=20000").then(rowsOf).catch(() => null),
      ZTZ.api("/api/mart_postcard_purchase?limit=5000").then(rowsOf).catch(() => null),
      fetch(ZTZ.API + "/api/_pcpurchase", { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
    ]);
    if (!month || !purch) {
      host.innerHTML = '<div class="rs-page-head"><h1>Post Card Expenditure</h1></div><div class="panel">' +
        "The postcard tables are not built yet — they appear after the next hourly data refresh.</div>";
      return;
    }
    const canEdit = !(ov && ov.error);
    const OV = {};
    ((ov && ov.purchases) || []).forEach(o => { OV[o["Purchase Key"]] = o; });
    // the live answer wins over the mart's hourly copy (the page must read its own write table)
    purch.forEach(p => {
      const o = OV[p["Purchase Key"]];
      if (o) { p.Quantity = o.Quantity; p["State Used"] = o.State || p["Ledger State"]; p.Note = o.Note; }
    });
    purch.sort((a, b) => String(b.Date).localeCompare(String(a.Date)));

    const years = [...new Set(month.map(r => String(r.Month).slice(0, 4)).concat(purch.map(p => String(p.Date).slice(0, 4))))].sort().reverse();
    const LS = "ztzPostcard.v1";
    let C = { year: "all", states: [] };
    try { C = Object.assign(C, JSON.parse(localStorage.getItem(LS) || "{}")); } catch (e) { /* fresh */ }
    const remember = () => { try { localStorage.setItem(LS, JSON.stringify(C)); } catch (e) { /* private mode */ } };
    const inYear = ym => C.year === "all" || String(ym).slice(0, 4) === C.year;
    const inStates = st => !C.states.length || C.states.includes(st);

    // unit cost per month, cumulative over the purchases that have a quantity (pooled across states)
    function unitCostByMonth() {
      const byM = {};
      purch.forEach(p => {
        const q = num(p.Quantity), a = num(p.Amount);
        if (!(q > 0) || a == null) return;
        const ym = String(p.Date).slice(0, 7);
        (byM[ym] = byM[ym] || { a: 0, q: 0 }); byM[ym].a += a; byM[ym].q += q;
      });
      const yms = Object.keys(byM).sort();
      let ca = 0, cq = 0; const cum = [];
      yms.forEach(ym => { ca += byM[ym].a; cq += byM[ym].q; cum.push([ym, cq > 0 ? ca / cq : null]); });
      return ym => { let uc = null; for (const [m, u] of cum) { if (m <= ym) uc = u; else break; } return uc; };
    }

    function calc() {
      const uc = unitCostByMonth();
      const rows = month.filter(r => inYear(r.Month) && inStates(r.State)).map(r => {
        const u = uc(String(r.Month)), cards = num(r["Cards Mailed"]);
        const cogs = u != null && cards != null ? cards * u : null;
        return { ym: String(r.Month), st: r.State, cards, uc: u, cogs, leads: num(r.Leads), booked: num(r.Booked),
          jobs: num(r.Jobs), rev: num(r.Revenue) };
      });
      const P = purch.filter(p => inYear(String(p.Date).slice(0, 7)) && (!C.states.length || !p["State Used"] || C.states.includes(p["State Used"])));
      const sum = (a, k) => a.reduce((t, r) => t + (r[k] || 0), 0);
      const hasC = rows.filter(r => r.cogs != null);
      const qP = P.filter(p => num(p.Quantity) > 0);
      return { rows, P, uc,
        cards: sum(rows, "cards"), cogs: hasC.length ? sum(hasC, "cogs") : null,
        leads: sum(rows, "leads"), booked: sum(rows, "booked"), jobs: sum(rows, "jobs"), rev: sum(rows, "rev"),
        spend: P.reduce((t, p) => t + (num(p.Amount) || 0), 0),
        bought: qP.reduce((t, p) => t + num(p.Quantity), 0),
        price: qP.length ? qP.reduce((t, p) => t + num(p.Amount), 0) / qP.reduce((t, p) => t + num(p.Quantity), 0) : null,
        untyped: P.filter(p => !(num(p.Quantity) > 0)).length };
    }

    const kpi = (l, v, s) => '<div class="pce-kpi"><div class="l">' + l + '</div><div class="v">' + v + '</div>' + (s ? '<div class="s">' + s + "</div>" : "") + "</div>";
    const td = (v, cls) => '<td class="' + (cls || "num") + '">' + v + "</td>";

    function paintTop() {
      const K = calc();
      host.querySelector("#pceKpis").innerHTML =
        kpi("Cards mailed", fmtN(K.cards), "from the vendor's sheet, by month") +
        kpi("Paid to the vendor", money(K.spend), fmtN(K.P.length) + " payments · " + (K.untyped ? "<b>" + K.untyped + " without a quantity</b>" : "all with quantities")) +
        kpi("Price per card", K.price != null ? money2(K.price) : "—", K.bought ? fmtN(K.bought) + " cards bought" : "type the quantities below") +
        kpi("Cost of cards mailed", K.cogs != null ? money(K.cogs) : "—", "mailed × unit cost (usage-based)") +
        kpi("Post card leads", fmtN(K.leads), fmtN(K.booked) + " booked") +
        kpi("Post card revenue", money(K.rev), fmtN(K.jobs) + " jobs · " + (K.cogs > 0 ? money2(K.rev / K.cogs).replace("$", "") + "× the cost" : "—"));
      paintReturn(K);
    }

    function paintReturn(K) {
      // by state over the selection
      const byS = {};
      K.rows.forEach(r => { const s = byS[r.st] = byS[r.st] || { cards: 0, cogs: 0, hasC: false, leads: 0, booked: 0, jobs: 0, rev: 0 };
        s.cards += r.cards || 0; if (r.cogs != null) { s.cogs += r.cogs; s.hasC = true; } s.leads += r.leads || 0; s.booked += r.booked || 0; s.jobs += r.jobs || 0; s.rev += r.rev || 0; });
      const sts = Object.keys(byS).sort((a, b) => byS[b].cards - byS[a].cards);
      const line = (name, s) => "<tr>" + td(name, "strong") + td(fmtN(s.cards)) + td(s.hasC ? money(s.cogs) : "—") + td(fmtN(s.leads)) +
        td(s.hasC && s.leads ? money(s.cogs / s.leads) : "—") + td(fmtN(s.booked)) + td(fmtN(s.jobs)) + td(s.hasC && s.jobs ? money(s.cogs / s.jobs) : "—") +
        td(money(s.rev)) + td(s.hasC && s.cogs > 0 ? x1(s.rev / s.cogs) : "—") + "</tr>";
      const tot = { cards: K.cards, cogs: K.cogs || 0, hasC: K.cogs != null, leads: K.leads, booked: K.booked, jobs: K.jobs, rev: K.rev };
      host.querySelector("#pceByState").innerHTML =
        '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Mailed</th><th class="num">Cost of mailed</th><th class="num">Leads</th><th class="num">$ / lead</th><th class="num">Booked</th><th class="num">Jobs</th><th class="num">$ / job</th><th class="num">Revenue</th><th class="num">Revenue per $</th></tr></thead><tbody>' +
        sts.map(s => line(esc(s), byS[s])).join("") + line("<b>All</b>", tot) + "</tbody></table></div>";

      // mailed grid: month × state
      const yms = [...new Set(K.rows.map(r => r.ym))].sort().reverse();
      const cols = STATES.filter(s => K.rows.some(r => r.st === s && r.cards));
      host.querySelector("#pceMailed").innerHTML = yms.length
        ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Month</th>' + cols.map(s => '<th class="num">' + s + "</th>").join("") + '<th class="num">Total</th><th class="num">Unit cost</th><th class="num">Cost of mailed</th></tr></thead><tbody>' +
          yms.map(ym => { const rr = K.rows.filter(r => r.ym === ym); const t = rr.reduce((a, r) => a + (r.cards || 0), 0); const u = K.uc(ym);
            return "<tr>" + td(ymLbl(ym), "strong") + cols.map(s => { const r = rr.find(x => x.st === s); return td(r && r.cards ? fmtN(r.cards) : '<span class="pce-dim">—</span>'); }).join("") +
              td("<b>" + fmtN(t) + "</b>") + td(u != null ? money2(u) : "—") + td(u != null ? money(t * u) : "—") + "</tr>"; }).join("") +
          "</tbody></table></div>"
        : '<div class="pce-say">No cards mailed in this selection.</div>';
    }

    function paintPurchases() {
      const P = purch.filter(p => inYear(String(p.Date).slice(0, 7)));
      const sel = p => '<select class="pce-sel" data-k="' + esc(p["Purchase Key"]) + '" data-f="state"' + (canEdit ? "" : " disabled") + '><option value="">' + (p["Ledger State"] ? esc(p["Ledger State"]) + " (ledger)" : "pooled") + "</option>" +
        STATES.map(s => '<option value="' + s + '"' + (p["State Used"] === s && (!p["Ledger State"] || OV[p["Purchase Key"]] && OV[p["Purchase Key"]].State === s) ? " selected" : "") + ">" + s + "</option>").join("") + "</select>";
      host.querySelector("#pcePurch").innerHTML = P.length
        ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Date</th><th>Company</th><th>Ledger line</th><th>Description</th><th class="num">Paid</th><th class="num">Quantity</th><th class="num">$ / card</th><th>State</th><th>Note</th><th></th></tr></thead><tbody>' +
          P.map(p => { const q = num(p.Quantity), a = num(p.Amount); const k = esc(p["Purchase Key"]);
            return '<tr data-row="' + k + '">' + td(esc(String(p.Date).slice(0, 10)), "") + td(esc(p.Company || ""), "") + td(esc(p.Provider || p["Sub Category"] || ""), "") +
              td('<span class="pce-dim" title="' + esc(p.Description || "") + '">' + esc(String(p.Description || "").slice(0, 40)) + "</span>", "") +
              td(money(a)) + td('<input class="pce-in' + (q > 0 ? " set" : "") + '" type="number" min="0" step="1" data-k="' + k + '" data-f="quantity" value="' + (q > 0 ? q : "") + '" placeholder="cards"' + (canEdit ? "" : " disabled") + ">") +
              td('<span data-price="' + k + '">' + (q > 0 && a != null ? money2(a / q) : "—") + "</span>") + td(sel(p), "") +
              td('<input class="pce-in note" type="text" maxlength="500" data-k="' + k + '" data-f="note" value="' + esc(p.Note || "") + '" placeholder="note"' + (canEdit ? "" : " disabled") + ">", "") +
              td('<span class="pce-st" data-st="' + k + '">' + (OV[p["Purchase Key"]] ? "saved" : "") + "</span>", "") + "</tr>"; }).join("") +
          "</tbody></table></div>"
        : '<div class="pce-say">No postcard payments on the ledger in this selection.</div>';
      if (!canEdit) return;
      const timers = {};
      host.querySelectorAll("#pcePurch [data-k]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
        const k = el.dataset.k;
        clearTimeout(timers[k]);
        timers[k] = setTimeout(() => save(k), el.tagName === "SELECT" ? 0 : 600);
      }));
    }

    async function save(k) {
      const row = host.querySelector('#pcePurch tr[data-row="' + k + '"]');
      const stEl = row.querySelector('[data-st="' + k + '"]');
      const q = row.querySelector('[data-f="quantity"]').value.trim();
      const state = row.querySelector('[data-f="state"]').value;
      const note = row.querySelector('[data-f="note"]').value.trim();
      stEl.className = "pce-st"; stEl.textContent = "saving…";
      try {
        const r = await fetch(ZTZ.API + "/api/_pcpurchase", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ key: k, quantity: q === "" ? null : q, state, note }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.status);
        OV[k] = { "Purchase Key": k, Quantity: j.quantity, State: j.state, Note: j.note };
        const p = purch.find(x => x["Purchase Key"] === k);
        p.Quantity = j.quantity; p["State Used"] = j.state || p["Ledger State"]; p.Note = j.note;
        const a = num(p.Amount);
        row.querySelector('[data-price="' + k + '"]').textContent = j.quantity > 0 && a != null ? money2(a / j.quantity) : "—";
        row.querySelector('[data-f="quantity"]').classList.toggle("set", j.quantity > 0);
        stEl.className = "pce-st ok"; stEl.textContent = "saved";
        paintTop();
      } catch (e) {
        stEl.className = "pce-st bad"; stEl.textContent = "not saved: " + String(e.message || e).slice(0, 60);
      }
    }

    function paintBar() {
      host.querySelector("#pceBar").innerHTML =
        '<span class="pce-say" style="margin:0">Year</span>' +
        ['<span class="pce-chip' + (C.year === "all" ? " on" : "") + '" data-y="all">All</span>'].concat(years.map(y => '<span class="pce-chip' + (C.year === y ? " on" : "") + '" data-y="' + y + '">' + y + "</span>")).join("") +
        '<span class="pce-say" style="margin:0 0 0 14px">State</span>' +
        STATES.map(s => '<span class="pce-chip' + (C.states.includes(s) ? " on" : "") + '" data-s="' + s + '">' + s + "</span>").join("");
      host.querySelectorAll("#pceBar [data-y]").forEach(el => el.onclick = () => { C.year = el.dataset.y; remember(); paintBar(); paintPurchases(); paintTop(); });
      host.querySelectorAll("#pceBar [data-s]").forEach(el => el.onclick = () => {
        const s = el.dataset.s; C.states = C.states.includes(s) ? C.states.filter(x => x !== s) : C.states.concat(s); remember(); paintBar(); paintPurchases(); paintTop(); });
    }

    const lastWeek = month.length ? month.map(r => String(r.Month)).sort().pop() : null;
    host.innerHTML =
      '<div class="rs-page-head"><h1>Post Card Expenditure</h1>' +
      '<p style="max-width:none">Postcards are bought in bulk and mailed over months, so the cost sits on the month the cards went out, not the day the vendor was paid. <b>Unit cost</b> = what was paid ÷ cards bought, cumulative to that month. <b>Cost of mailed</b> = cards mailed × unit cost. The return is every lead, booked job and closing whose source is <i>Post Card</i>, by the state of the lead.</p></div>' +
      '<div class="pce-bar" id="pceBar"></div>' +
      '<div class="pce-kpis" id="pceKpis"></div>' +
      '<div class="panel pce-sec"><div class="panel-title">Purchases — every postcard payment on the bank ledger</div>' +
      '<div class="pce-say">Type the <b>quantity</b> each payment bought; the price per card and every cost below follow from it. A payment the ledger tags to a state keeps that state; for an untagged one, pick the state it was for or leave it <b>pooled</b> (it still feeds the unit cost). Changes save as you type' + (canEdit ? "" : " — <b>your access is read-only here</b>") + ".</div>" +
      '<div id="pcePurch"></div></div>' +
      '<div class="pce-grid">' +
      '<div class="panel"><div class="panel-title">Return by state</div><div class="pce-say">Cards mailed against the leads and jobs they brought, over the selected period.</div><div id="pceByState"></div></div>' +
      '<div class="panel"><div class="panel-title">Cards mailed by month and state</div><div class="pce-say">From the vendor\'s sheet' + (lastWeek ? " · data through <b>" + esc(ymLbl(lastWeek)) + "</b>" : "") + '.</div><div id="pceMailed"></div></div>' +
      "</div>";
    paintBar();
    paintPurchases();
    paintTop();
  },
});
