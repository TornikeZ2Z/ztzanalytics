/* FIXED COSTS -- what we pay every month: paid, left to pay, and what the bank shows (Financial; tracker
   ZTZ-88, 13 Nov 2026).

   Gvantsa kept the fixed costs in a Google Sheet ("Financing Toyota 1: $2,400, on <date>") and could not
   keep them under control there. She asked for the list with its payment dates, a month view, monthly
   totals, and what is still left to pay once a date passes. His picks: its own Financial page; each cost
   repeats monthly and any single month can be moved, changed or skipped; "each payment ... by card or by
   cash and if its by card we should find the stuff via bank" -- a bank cost is paid when the bank feed
   shows its charge, a cash cost when someone ticks it; the list starts from the bank feed's suggestions.

   Data: /api/_fixed (bridge/fixed_costs.py). The bridge does the work -- the payments of every month in
   view, each matched to its bank charge, each with its state -- and this page draws it on the kit (page
   head, How it's counted, tabs, KPI tiles). States: paid · skipped · upcoming · due (cash, not ticked) ·
   waiting_bank (the bank feed does not reach its date yet) · missing (the feed covers it, no charge). */
registerPage({
  id: "fixed-costs",
  group: "financial",
  title: "Fixed Costs",
  async render(host) {
    const esc = RSC.esc;
    const money = v => "$" + (Math.round((+v || 0) * 100) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const money0 = v => "$" + Math.round(+v || 0).toLocaleString("en-US");
    const ym = s => String(s || "").slice(0, 7);
    const mName = (m, short) => { const d = new Date(ym(m) + "-01T12:00:00Z");
      return isNaN(d) ? m : d.toLocaleString("en-US", { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" }); };
    const day = s => { const d = new Date(String(s).slice(0, 10) + "T12:00:00Z");
      return isNaN(d) ? "" : d.toLocaleString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }); };
    const addM = (m, n) => { const [y, mo] = ym(m).split("-").map(Number), t = y * 12 + mo - 1 + n;
      return Math.floor(t / 12) + "-" + String(t % 12 + 1).padStart(2, "0"); };
    const STATE = { paid: ["Paid", "ok"], skipped: ["Skipped", "mute"], upcoming: ["Coming up", "info"],
                    due: ["Due, not ticked", "warn"], waiting_bank: ["Not in the bank feed yet", "mute"],
                    missing: ["Not found in the bank", "bad"] };
    const CATS = ["Truck financing", "Rent and lease", "Insurance", "Utilities", "Loans", "Software and phones", "Taxes", "Other"];
    let S = window.__fxcState || (window.__fxcState = { view: "month", month: null, data: null, sug: null });
    injectCss();

    async function api(qs, body) {
      const opt = { headers: { "Authorization": "Bearer " + ZTZ.getToken() } };
      if (body) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
      const r = await fetch(ZTZ.API + "/api/_fixed" + (qs || ""), opt);
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { const e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
      return j;
    }
    // the window the bridge reads: two months back to nine ahead of the month on screen
    async function load(center) {
      const c = center || S.month || null;
      const qs = c ? "?from=" + addM(c, -2) + "&to=" + addM(c, 9) : "";
      S.data = await api(qs);
      if (!S.month) S.month = ym(S.data.today);
    }
    async function loadSug() { S.sug = (await api("?suggest=1")).suggestions || []; }
    const token = (window.__fxcTok = (window.__fxcTok || 0) + 1);
    const alive = () => token === window.__fxcTok && location.hash.indexOf("page=fixed-costs") >= 0;

    host.innerHTML = RSC.loadingHtml("Fixed Costs", "Reading the fixed costs and the bank feed");
    try {
      await load();
    } catch (e) {
      if (alive()) RSC.failed(host, { title: "Fixed Costs couldn't load", error: e.message, onRetry: () => window.dispatchEvent(new HashChangeEvent("hashchange")) });
      return;
    }
    if (!alive()) return;
    paint();

    // ------------------------------------------------------------------ the page
    function through() { return S.data && S.data.through ? String(S.data.through).slice(0, 10) : ""; }
    function howHtml() {
      return "<p><b>A fixed cost</b> is something we pay every month: an amount, a day of the month, and the month it starts"
        + " (and ends, for a loan). Its payments fill every month by themselves; any one month can be moved, changed or skipped.</p>"
        + "<p><b>Bank or card</b> costs are paid when the bank feed shows their charge: a line that contains the cost's words"
        + " (e.g. <i>TOYOTA</i>), within " + "10 days of the date and 10% of the amount (any amount when the cost says it varies)."
        + " Three loans with the same words each find their own charge, closest first. <b>Cash</b> costs are paid when someone ticks them.</p>"
        + "<p><b>The states.</b> <i>Paid</i>: the bank shows it, or it was ticked. <i>Coming up</i>: its date is ahead."
        + " <i>Due, not ticked</i>: a cash payment whose date has passed. <i>Not in the bank feed yet</i>: a bank payment whose date has"
        + " passed but the bank feed does not reach it yet (it is filled by hand and runs about two weeks behind; today it reaches "
        + esc(day(through()) || "—") + "). <i>Not found in the bank</i>: the feed covers its date (three days' grace) and no charge matches.</p>"
        + "<p><b>Left to pay</b> = coming up + due, not ticked + not found in the bank. <i>Not in the bank feed yet</i> is shown"
        + " on its own: most of it is paid already, we just can't see it yet.</p>"
        + "<p>Every change is kept with who made it and when (a cost's <i>History</i>).</p>";
    }
    function paint() {
      if (!alive()) return;
      const d = S.data;
      const chip = through() ? "Bank feed to " + day(through()) : "No bank feed";
      const stale = !through() || (Date.parse(String(d.today).slice(0, 10)) - Date.parse(through())) / 864e5 > 7;
      const nCosts = (d.costs || []).filter(c => c.status === "active").length;
      let h = '<div class="fxc">' + RSC.pageHeadHtml({
        key: "fixed-costs", title: "Fixed Costs", sub: "What we pay every month: what is paid, what is left, and what the bank shows",
        chip, chipTone: stale ? "warn" : "live", how: howHtml,
        actions: [{ id: "fxcAdd", label: "Add a fixed cost", primary: true }] });
      if (!d.ready) {
        host.innerHTML = h + RSC.emptyHtml({ title: "Fixed Costs is being set up", body: "The tables aren't there yet. Try again in a few minutes." }) + "</div>";
        return;
      }
      h += RSC.tabsHtml([{ id: "month", label: "Month" }, { id: "year", label: "12 months" },
                         { id: "costs", label: "Fixed costs", count: nCosts },
                         { id: "suggest", label: "Suggestions from the bank", count: S.sug ? S.sug.filter(s => !s.added).length : null }], S.view);
      h += '<div id="fxcBody">' + (S.view === "year" ? yearHtml() : S.view === "costs" ? costsHtml() : S.view === "suggest" ? sugHtml() : monthHtml()) + "</div></div>";
      host.innerHTML = h;
      wire();
    }

    // ---- MONTH: each payment on its date, the month's totals and what is left
    function monthHtml() {
      const d = S.data, m = S.month;
      const pays = d.payments.filter(p => ym(p.month) === m).sort((a, b) => String(a.due).localeCompare(String(b.due)) || String(a.name).localeCompare(String(b.name)));
      const sm = d.months.find(x => ym(x.month) === m) || { total: 0, paid: 0, left: 0, waiting_bank: 0, missing: 0, due: 0, n: 0 };
      const past = (sm.due || 0) + (sm.missing || 0);
      let h = '<div class="fxc-nav"><button type="button" class="rs-btn" data-mon="' + addM(m, -1) + '" aria-label="Previous month">‹</button>'
        + "<b>" + esc(mName(m)) + "</b>"
        + '<button type="button" class="rs-btn" data-mon="' + addM(m, 1) + '" aria-label="Next month">›</button>'
        + (m !== ym(d.today) ? '<button type="button" class="rs-btn" data-mon="' + ym(d.today) + '">This month</button>' : "") + "</div>";
      if (!pays.length) return h + RSC.emptyHtml({ title: "No fixed costs in " + mName(m), body: "Add one, or add the bank's suggestions.", actionId: "fxcGoSug", actionLabel: "See the suggestions" });
      h += RSC.headlineHtml("In " + esc(mName(m)) + ", <b>" + money0(sm.total) + "</b> in fixed costs: <b>" + money0(sm.paid) + "</b> paid, <b>"
        + money0(sm.left) + "</b> left to pay" + (sm.waiting_bank ? ", and <b>" + money0(sm.waiting_bank) + "</b> the bank feed doesn't show yet" : "") + ".");
      h += RSC.kpisHtml([
        { label: "This month", value: money0(sm.total), sub: sm.n + " payment" + (sm.n === 1 ? "" : "s") },
        { label: "Paid", value: money0(sm.paid), sub: sm.total ? Math.round(100 * sm.paid / sm.total) + "% of the month" : "" },
        { label: "Left to pay", value: money0(sm.left), sub: past ? money0(past) + " of it past its date" : "nothing past its date", tone: past ? "bad" : "" },
        { label: "Not in the bank feed yet", value: money0(sm.waiting_bank), sub: "the feed reaches " + (day(through()) || "—") },
      ]);
      h += '<div class="rs-tablewrap"><table class="rs-table fxc-t"><thead><tr><th>Date</th><th>Fixed cost</th><th>Paid by</th>'
        + '<th class="num">Amount</th><th>State</th><th></th></tr></thead><tbody>';
      pays.forEach(p => {
        const [lab, tone] = STATE[p.state] || [p.state, "mute"];
        const b = p.bank;
        const how = b ? "bank " + day(b.date) + (Math.abs(b.amount - p.amount) >= 0.01 ? " · " + money(b.amount) : "")
          : p.paid_hand === true ? "ticked" + (p.paid_by ? " by " + String(p.paid_by).split("@")[0] : "")
          : p.paid_hand === false ? "marked not paid" : "";
        const quick = p.state === "skipped" ? ""
          : p.method === "cash" && p.state !== "paid" ? '<button type="button" class="rs-btn" data-paid="1" data-c="' + p.cost_id + '" data-m="' + ym(p.month) + '">Mark paid</button>'
          : p.paid_hand === true ? '<button type="button" class="rs-btn" data-paid="auto" data-c="' + p.cost_id + '" data-m="' + ym(p.month) + '">Untick</button>' : "";
        h += '<tr class="' + (p.state === "skipped" ? "fxc-skip" : "") + '"><td>' + esc(day(p.due)) + (p.changed ? ' <span class="fxc-mark" title="Changed for this month">changed</span>' : "") + "</td>"
          + "<td><b>" + esc(p.name) + '</b><div class="fxc-sub">' + esc([p.category, p.company !== "Zip to Zip" ? p.company : ""].filter(Boolean).join(" · ")) + (p.note ? " · " + esc(p.note) : "") + "</div></td>"
          + "<td>" + (p.method === "cash" ? "Cash" : "Bank or card") + '</td><td class="num">' + money(p.amount) + "</td>"
          + '<td><span class="rs-pill ' + tone + '">' + esc(lab) + "</span>" + (how ? '<div class="fxc-sub">' + esc(how) + "</div>" : "") + "</td>"
          + '<td class="fxc-act">' + quick + '<button type="button" class="rs-btn" data-mon-edit="' + p.cost_id + '" data-m="' + ym(p.month) + '">Change this month</button></td></tr>';
      });
      h += '</tbody><tfoot><tr><td colspan="3"><b>Total</b></td><td class="num"><b>' + money(sm.total) + "</b></td><td colspan=\"2\">" + money0(sm.left) + " left to pay</td></tr></tfoot></table></div>";
      return h;
    }

    // ---- 12 MONTHS: every cost across the months in view, with the monthly totals
    function yearHtml() {
      const d = S.data, months = d.months.map(x => ym(x.month));
      const ids = [...new Set(d.payments.map(p => p.cost_id))];
      const byKey = {};
      d.payments.forEach(p => { byKey[p.cost_id + "|" + ym(p.month)] = p; });
      const nameOf = id => (d.payments.find(p => p.cost_id === id) || {}).name || "";
      ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      if (!ids.length) return RSC.emptyHtml({ title: "No fixed costs yet", body: "Add one, or add the bank's suggestions.", actionId: "fxcGoSug", actionLabel: "See the suggestions" });
      let h = RSC.headlineHtml("Fixed costs from <b>" + esc(mName(months[0], true)) + "</b> to <b>" + esc(mName(months[months.length - 1], true))
        + "</b>: about <b>" + money0((d.months.find(x => ym(x.month) === ym(d.today)) || {}).total) + "</b> a month now.");
      h += '<div class="rs-tablewrap" data-rsfit><table class="rs-table fxc-t fxc-y"><thead><tr><th>Fixed cost</th>'
        + months.map(m => '<th class="num' + (m === ym(d.today) ? " fxc-now" : "") + '">' + esc(mName(m, true)) + "</th>").join("") + "</tr></thead><tbody>";
      ids.forEach(id => {
        h += "<tr><td><b>" + esc(nameOf(id)) + "</b></td>" + months.map(m => {
          const p = byKey[id + "|" + m];
          if (!p) return '<td class="num fxc-none">—</td>';
          const tone = (STATE[p.state] || [])[1] || "";
          return '<td class="num fxc-c fxc-' + tone + (m === ym(d.today) ? " fxc-now" : "") + '" title="' + esc(day(p.due) + " · " + (STATE[p.state] || [p.state])[0]) + '">'
            + (p.state === "skipped" ? "<s>" + money0(p.amount) + "</s>" : money0(p.amount)) + "</td>";
        }).join("") + "</tr>";
      });
      const row = (lab, k) => "<tr><td><b>" + lab + "</b></td>" + d.months.map(x => '<td class="num' + (ym(x.month) === ym(d.today) ? " fxc-now" : "") + '"><b>' + money0(x[k]) + "</b></td>").join("") + "</tr>";
      h += "</tbody><tfoot>" + row("Total", "total") + row("Paid", "paid") + row("Left to pay", "left") + "</tfoot></table></div>"
        + '<p class="fxc-legend"><span class="rs-pill ok">Paid</span> <span class="rs-pill info">Coming up</span> <span class="rs-pill warn">Due, not ticked</span> '
        + '<span class="rs-pill bad">Not found in the bank</span> <span class="rs-pill mute">Not in the bank feed yet · skipped</span></p>';
      return h;
    }

    // ---- FIXED COSTS: the list itself
    function costsHtml() {
      const cs = (S.data.costs || []).slice().sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) || String(a.name).localeCompare(String(b.name)));
      if (!cs.length) return RSC.emptyHtml({ title: "No fixed costs yet", body: "Add one, or start from what repeats in the bank.", actionId: "fxcGoSug", actionLabel: "See the suggestions" });
      const total = cs.filter(c => c.status === "active").reduce((a, c) => a + (+c.amount || 0), 0);
      let h = RSC.headlineHtml("<b>" + cs.filter(c => c.status === "active").length + "</b> fixed costs, <b>" + money0(total) + "</b> a month at their usual amounts.");
      h += '<div class="rs-tablewrap"><table class="rs-table fxc-t"><thead><tr><th>Fixed cost</th><th>Paid by</th><th class="num">A month</th><th>Day</th>'
        + "<th>From – to</th><th>Bank line contains</th><th></th></tr></thead><tbody>";
      cs.forEach(c => {
        h += '<tr class="' + (c.status === "stopped" ? "fxc-skip" : "") + '"><td><b>' + esc(c.name) + '</b><div class="fxc-sub">' + esc([c.category, c.company !== "Zip to Zip" ? c.company : "", c.status === "stopped" ? "stopped from " + mName(c.stopped_at, true) : ""].filter(Boolean).join(" · ")) + "</div></td>"
          + "<td>" + (c.method === "cash" ? "Cash" : "Bank or card") + '</td><td class="num">' + money(c.amount) + (c.vary ? '<div class="fxc-sub">varies</div>' : "") + "</td>"
          + "<td>" + esc(c.day) + "</td><td>" + esc(mName(c.start_month, true)) + " – " + (c.end_month ? esc(mName(c.end_month, true)) : "no end") + "</td>"
          + "<td>" + (c.match_text ? "<code>" + esc(c.match_text) + "</code>" : "—") + "</td>"
          + '<td class="fxc-act"><button type="button" class="rs-btn" data-edit="' + c.id + '">Edit</button>'
          + '<button type="button" class="rs-btn" data-hist="' + c.id + '">History</button></td></tr>';
      });
      return h + "</tbody></table></div>";
    }

    // ---- SUGGESTIONS: what repeats in the bank feed, for her to confirm
    function sugHtml() {
      if (!S.sug) { setTimeout(async () => { try { await loadSug(); } catch (e) { S.sug = []; S.sugErr = e.message; } paint(); }, 0); return RSC.loadingHtml("suggestions", "Reading the last four months of the bank feed"); }
      if (!S.sug.length) return RSC.emptyHtml({ title: "Nothing repeats in the bank feed", body: S.sugErr || "No payee was charged about the same amount in three of the last four months." });
      let h = RSC.headlineHtml("<b>" + S.sug.filter(s => !s.added).length + "</b> charges repeat every month in the bank feed (the last four months, to " + esc(day(through())) + "). "
        + "Add the ones that are fixed costs; you can change anything before saving.");
      h += '<div class="rs-tablewrap"><table class="rs-table fxc-t"><thead><tr><th>Payee in the bank</th><th class="num">Amount</th><th>Usual day</th><th>Months seen</th><th>Category</th><th></th></tr></thead><tbody>';
      S.sug.forEach((s, i) => {
        h += "<tr" + (s.added ? ' class="fxc-skip"' : "") + "><td><b>" + esc(s.name) + '</b><div class="fxc-sub">bank line: <code>' + esc(s.match_text) + "</code></div></td>"
          + '<td class="num">' + money(s.amount) + (s.spread ? '<div class="fxc-sub">varies by ' + money(s.spread) + "</div>" : "") + "</td><td>" + esc(s.day) + "</td><td>" + esc(s.months) + " of 4</td>"
          + "<td>" + esc(s.category) + '</td><td class="fxc-act">' + (s.added ? '<span class="rs-pill ok">Added</span>' : '<button type="button" class="rs-btn pri" data-sug="' + i + '">Add</button>') + "</td></tr>";
      });
      return h + "</tbody></table></div>";
    }

    // ------------------------------------------------------------------ actions
    function wire() {
      const q = (sel, f) => host.querySelectorAll(sel).forEach(f);
      const add = host.querySelector("#fxcAdd");
      if (add) add.onclick = () => costPanel(null);
      q(".rs-utab", b => b.onclick = () => { S.view = b.dataset.tab; paint(); });
      q("[data-mon]", b => b.onclick = async () => {
        S.month = b.dataset.mon;
        if (!S.data.months.some(x => ym(x.month) === S.month)) {
          host.querySelector("#fxcBody").innerHTML = RSC.loadingHtml("Fixed Costs", "Reading " + mName(S.month));
          try { await load(S.month); } catch (e) { return RSC.failed(host.querySelector("#fxcBody"), { error: e.message, onRetry: paint }); }
        }
        paint();
      });
      const goSug = host.querySelector("#fxcGoSug");
      if (goSug) goSug.onclick = () => { S.view = "suggest"; paint(); };
      q("[data-paid]", b => b.onclick = () => save({ action: "month", id: +b.dataset.c, month: b.dataset.m, paid: b.dataset.paid }, b));
      q("[data-mon-edit]", b => b.onclick = () => monthPanel(+b.dataset.monEdit, b.dataset.m));
      q("[data-edit]", b => b.onclick = () => costPanel(S.data.costs.find(c => c.id === +b.dataset.edit)));
      q("[data-hist]", b => b.onclick = () => histPanel(+b.dataset.hist));
      q("[data-sug]", b => b.onclick = () => { const s = S.sug[+b.dataset.sug];
        costPanel(null, { name: s.name, category: s.category, method: "bank", amount: s.amount, day: s.day, match_text: s.match_text,
                          vary: s.spread > 0.1 * s.amount ? 1 : 0, start_month: ym(S.data.today) }); });
    }
    async function save(body, btn) {
      if (btn) btn.disabled = true;
      try {
        await api("", body);
        S.sug = null;                                  // an added cost is no longer a suggestion
        await load(S.month);
        closePanel();
        paint();
        return true;
      } catch (e) {
        if (btn) btn.disabled = false;
        const err = document.querySelector("#fxcErr");
        if (err) err.textContent = e.message; else RSC.notice({ title: "Not saved", body: e.message });
        return false;
      }
    }

    // ---- the side panel (the kit's panel frame)
    function openPanel(title, body, foot) {
      closePanel();
      const scrim = document.createElement("div"); scrim.className = "rs-fscrim"; scrim.id = "fxcScrim";
      const p = document.createElement("aside"); p.className = "rs-fpanel fxc-panel"; p.id = "fxcPanel";
      p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", title);
      p.innerHTML = '<div class="rs-fp-head"><h2>' + esc(title) + '</h2><button type="button" class="rs-fp-x" aria-label="Close">&times;</button></div>'
        + '<div class="rs-fp-body fxc-form">' + body + '<p class="fxc-err" id="fxcErr" role="alert"></p></div>'
        + '<div class="rs-fp-foot">' + foot + "</div>";
      document.body.appendChild(scrim); document.body.appendChild(p);
      scrim.onclick = closePanel;
      p.querySelector(".rs-fp-x").onclick = closePanel;
      p.addEventListener("keydown", e => { if (e.key === "Escape") closePanel(); });
      p.querySelectorAll(".rs-seg button").forEach(b => b.onclick = () => {
        b.parentNode.querySelectorAll("button").forEach(x => { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", String(x === b)); });
        if (b.parentNode.dataset.seg === "method") p.querySelectorAll(".fxc-bank").forEach(x => { x.hidden = b.dataset.v !== "bank"; });
      });
      const first = p.querySelector("input"); if (first) first.focus();
      return p;
    }
    function closePanel() { ["fxcPanel", "fxcScrim"].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
    const seg = (key, v, opts) => '<div class="rs-seg" role="group" data-seg="' + key + '">' + opts.map(([k, l]) =>
      '<button type="button" data-v="' + esc(k) + '" class="' + (k === v ? "on" : "") + '" aria-pressed="' + (k === v) + '">' + esc(l) + "</button>").join("") + "</div>";
    const segVal = (p, key) => { const b = p.querySelector('[data-seg="' + key + '"] button.on'); return b ? b.dataset.v : ""; };
    const val = (p, id) => { const x = p.querySelector("#" + id); return x ? (x.type === "checkbox" ? x.checked : x.value) : ""; };

    function costPanel(c, pre) {
      const v = Object.assign({ method: "bank", company: "Zip to Zip", day: 1, start_month: ym(S.data.today) }, c || {}, pre || {});
      const bank = v.method !== "cash";
      const body = '<label for="fxcName">Name</label><input id="fxcName" class="rs-inp" value="' + esc(v.name || "") + '" placeholder="e.g. Toyota financing, truck 1">'
        + '<label for="fxcCat">Category</label><input id="fxcCat" class="rs-inp" list="fxcCats" value="' + esc(v.category || "") + '" placeholder="Truck financing, Rent and lease…">'
        + '<datalist id="fxcCats">' + CATS.map(x => '<option value="' + esc(x) + '">').join("") + "</datalist>"
        + "<label>Company</label>" + seg("company", v.company, [["Zip to Zip", "Zip to Zip"], ["Tuji", "Tuji"]])
        + "<label>Paid by</label>" + seg("method", bank ? "bank" : "cash", [["bank", "Bank or card"], ["cash", "Cash"]])
        + '<div class="fxc-2"><div><label for="fxcAmt">Amount a month ($)</label><input id="fxcAmt" class="rs-num" inputmode="decimal" value="' + esc(v.amount != null ? (+v.amount).toFixed(2) : "") + '"></div>'
        + '<div><label for="fxcDay">Day of the month</label><input id="fxcDay" class="rs-num" type="number" min="1" max="31" value="' + esc(v.day || "") + '"></div></div>'
        + '<div class="fxc-2"><div><label for="fxcFrom">First month</label><input id="fxcFrom" class="rs-inp" type="month" value="' + esc(ym(v.start_month)) + '"></div>'
        + '<div><label for="fxcTo">Last month <span class="fxc-sub">(optional)</span></label><input id="fxcTo" class="rs-inp" type="month" value="' + esc(ym(v.end_month)) + '"></div></div>'
        + '<div class="fxc-bank"' + (bank ? "" : " hidden") + '><label for="fxcMatch">The bank or card line contains</label><input id="fxcMatch" class="rs-inp" value="' + esc(v.match_text || "") + '" placeholder="e.g. TOYOTA">'
        + '<p class="fxc-help">The words that appear in its line in the bank feed. The page finds the charge within 10 days of the date and 10% of the amount.</p>'
        + '<label class="fxc-check"><input id="fxcVary" type="checkbox"' + (v.vary ? " checked" : "") + "> The amount changes month to month (a utility bill): match any amount</label></div>"
        + '<label for="fxcNote">Note</label><textarea id="fxcNote" class="rs-inp" rows="2">' + esc(v.note || "") + "</textarea>";
      const stopped = c && c.status === "stopped";
      const foot = (c ? '<button type="button" class="rs-btn" id="fxcStop">' + (stopped ? "Start it again" : "Stop it from " + esc(mName(S.month, true))) + "</button>" : "<span></span>")
        + '<button type="button" class="rs-btn pri" id="fxcSave">' + (c ? "Save" : "Add it") + "</button>";
      const p = openPanel(c ? "Edit " + (c.name || "the fixed cost") : "Add a fixed cost", body, foot);
      p.querySelector("#fxcSave").onclick = e => save({
        action: c ? "edit" : "add", id: c ? c.id : undefined, name: val(p, "fxcName"), category: val(p, "fxcCat"),
        company: segVal(p, "company"), method: segVal(p, "method"), amount: val(p, "fxcAmt"), day: val(p, "fxcDay"),
        start_month: val(p, "fxcFrom"), end_month: val(p, "fxcTo"), match_text: val(p, "fxcMatch"), vary: val(p, "fxcVary"),
        note: val(p, "fxcNote") }, e.currentTarget);
      const st = p.querySelector("#fxcStop");
      if (st) st.onclick = e => save({ action: stopped ? "restart" : "stop", id: c.id, month: S.month }, e.currentTarget);
    }
    function monthPanel(id, m) {
      const pay = S.data.payments.find(x => x.cost_id === id && ym(x.month) === m);
      if (!pay) return;
      const bank = pay.method === "bank";
      const paid = pay.paid_hand === true ? "paid" : pay.paid_hand === false ? "no" : "auto";
      const body = '<p class="fxc-help"><b>' + esc(pay.name) + "</b>, " + esc(mName(m)) + ". A change here is for this month only.</p>"
        + '<div class="fxc-2"><div><label for="fxcDue">Date</label><input id="fxcDue" class="rs-inp" type="date" value="' + esc(String(pay.due).slice(0, 10)) + '"></div>'
        + '<div><label for="fxcMAmt">Amount ($)</label><input id="fxcMAmt" class="rs-num" inputmode="decimal" value="' + esc((+pay.amount).toFixed(2)) + '"></div></div>'
        + "<label>Paid</label>" + seg("paid", paid, bank ? [["auto", "From the bank"], ["paid", "Paid (by hand)"], ["no", "Not paid"]] : [["auto", "Not ticked"], ["paid", "Paid"]])
        + (pay.bank ? '<p class="fxc-help">The bank shows it: ' + esc(day(pay.bank.date)) + ", " + money(pay.bank.amount) + " · <code>" + esc(pay.bank.desc) + "</code></p>" : "")
        + '<label class="fxc-check"><input id="fxcSkip" type="checkbox"' + (pay.skipped ? " checked" : "") + "> Skip this month (not paid on purpose)</label>"
        + '<label for="fxcMNote">Note</label><textarea id="fxcMNote" class="rs-inp" rows="2">' + esc(pay.note || "") + "</textarea>";
      const foot = (pay.changed ? '<button type="button" class="rs-btn" id="fxcReset">Back to the usual</button>' : "<span></span>")
        + '<button type="button" class="rs-btn pri" id="fxcMSave">Save</button>';
      const p = openPanel("Change this month", body, foot);
      p.querySelector("#fxcMSave").onclick = e => {
        const due = val(p, "fxcDue"), amt = val(p, "fxcMAmt");
        const cost = S.data.costs.find(c => c.id === id) || {};
        save({ action: "month", id, month: m,
               // only what differs from the usual is kept, so a later change to the cost still reaches this month
               due_date: due && due !== String(pay.due).slice(0, 10) ? due : (pay.changed && due ? due : ""),
               amount: amt && Math.abs(+amt - (+cost.amount || 0)) >= 0.005 ? amt : "",
               paid: segVal(p, "paid"), skipped: val(p, "fxcSkip"), note: val(p, "fxcMNote") }, e.currentTarget);
      };
      const rs = p.querySelector("#fxcReset");
      if (rs) rs.onclick = e => save({ action: "month_clear", id, month: m }, e.currentTarget);
    }
    async function histPanel(id) {
      const c = S.data.costs.find(x => x.id === id) || {};
      const p = openPanel("History: " + (c.name || ""), RSC.loadingHtml("history"), "<span></span>");
      try {
        const rows = (await api("?history=" + id)).history || [];
        const what = { add: "added", edit: "changed", stop: "stopped", restart: "started again", month: "changed a month", month_clear: "put a month back" };
        p.querySelector(".fxc-form").innerHTML = rows.length ? '<ul class="fxc-hist">' + rows.map(r => "<li><b>" + esc(String(r.done_by || "").split("@")[0]) + "</b> "
          + esc(what[r.action] || r.action) + (r.month ? " (" + esc(mName(r.month, true)) + ")" : "") + '<div class="fxc-sub">' + esc(String(r.done_at || "").replace("T", " ").slice(0, 16)) + " UTC</div></li>").join("") + "</ul>"
          : '<p class="fxc-help">No changes yet.</p>';
      } catch (e) { p.querySelector(".fxc-form").innerHTML = '<p class="fxc-err">' + esc(e.message) + "</p>"; }
    }

    function injectCss() {
      if (document.getElementById("fxc-style")) return;
      const st = document.createElement("style"); st.id = "fxc-style";
      st.textContent = ""
        + ".fxc .fxc-nav{display:flex;align-items:center;gap:10px;margin:4px 0 12px}.fxc .fxc-nav b{font-size:16px;min-width:150px;text-align:center}"
        + ".fxc .fxc-t td{vertical-align:top}.fxc .fxc-t .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}"
        + ".fxc .fxc-sub{font-size:12px;color:var(--muted);margin-top:2px}"
        + ".fxc .fxc-act{white-space:nowrap;text-align:right}.fxc .fxc-act .rs-btn{margin-left:6px}"
        + ".fxc .fxc-skip td{opacity:.6}.fxc .fxc-mark{font-size:12px;color:var(--warn)}"
        + ".fxc .fxc-y td.fxc-c.fxc-ok{color:var(--pos)}.fxc .fxc-y td.fxc-c.fxc-bad{color:var(--neg);font-weight:700}"
        + ".fxc .fxc-y td.fxc-c.fxc-warn{color:var(--warn);font-weight:700}.fxc .fxc-y td.fxc-c.fxc-mute{color:var(--muted)}"
        + ".fxc .fxc-y .fxc-now{background:var(--panel-2)}.fxc .fxc-y .fxc-none{color:var(--faint)}"
        + ".fxc .fxc-legend{font-size:12px;color:var(--muted);margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap}"
        + ".fxc-panel .fxc-form label{display:block;font-size:13px;font-weight:700;margin:12px 0 4px}"
        + ".fxc-panel .fxc-form .rs-inp,.fxc-panel .fxc-form .rs-num{width:100%;box-sizing:border-box}"
        + ".fxc-panel .fxc-2{display:grid;grid-template-columns:1fr 1fr;gap:12px}"
        + ".fxc-panel .fxc-check{display:flex;gap:8px;align-items:flex-start;font-weight:500}"
        + ".fxc-panel .fxc-help{font-size:12.5px;color:var(--muted);margin:6px 0 0}.fxc-panel .fxc-err{color:var(--neg);font-size:13px;min-height:1em}"
        + ".fxc-panel .fxc-sub{font-size:12px;color:var(--muted)}.fxc-panel .fxc-hist{list-style:none;margin:0;padding:0}"
        + ".fxc-panel .fxc-hist li{padding:8px 0;border-bottom:1px solid var(--line)}";
      document.head.appendChild(st);
    }
  },
});
