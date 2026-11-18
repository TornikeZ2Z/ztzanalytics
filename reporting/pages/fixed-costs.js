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
   waiting_bank (the bank feed does not reach its date yet) · missing (the feed covers it, no charge).

   A MANUAL LIST (14 Nov 2026, ZTZ-93, bug ZP-2). Gvantsa: "I don't want it from the bank. I want a list like I had,
   and to add them myself manually." His picks: she adds a cost with a name, a date and an amount, monthly or a
   one-off (a cost with no set day counts in its month); she ticks payments paid and the bank only helps (a cost that
   carries its bank line's words is also marked paid when the bank feed shows it); the bank suggestions are gone.

   EDIT OR REMOVE (17 Nov 2026, bug ZP-6). Gvantsa added a truck deposit as monthly by mistake and could neither fix nor
   remove it: she works in the Month tab, and Edit was only on the "Fixed costs" tab. Each month row now has "Edit or
   remove"; the panel has Remove, asked once more before it goes (it leaves every month, paid ones too).

   BY STATUS, WITH TYPES (17 Nov 2026, bug ZP-3). His words: "i dont like the table setup and design here ... i need
   TYPE of subscription too, like MONTHLY FIXED, MONTHLY USAGE BASED, YEARLY and etc." His picks from three mockups on
   the real data: layout A, by status ("Past its date, not paid" first, then "Coming up", then "Paid"), and five types
   (Monthly fixed, Monthly usage-based, Quarterly, Yearly, One-off). A round tick marks a payment paid -- a usage-based
   one asks what it really was -- and "..." holds Change this month / Edit or remove, so a row carries no buttons. */
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
                    due: ["Due, not ticked", "warn"], waiting_bank: ["Due, not ticked", "warn"],
                    missing: ["Due, not in the bank", "bad"] };
    const nth = d => d + ((d % 100 >= 11 && d % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[d % 10] || "th"));
    // "No set day" for a cost that counts in its month without a date (his pick, ZTZ-93)
    const payDate = p => p.no_day ? "No set day" : day(p.due);
    // the five types (ZP-3): bridge/fixed_costs.py KINDS; a cost saved before them comes with one worked out
    const KIND = { monthly: "Monthly fixed", usage: "Monthly usage-based", quarterly: "Quarterly", yearly: "Yearly", once: "One-off" };
    const KIND_HELP = { monthly: "The same amount every month.", usage: "The amount is an estimate: when you tick it paid, you enter what it really was.",
                        quarterly: "Every 3 months, starting on the date below.", yearly: "Once a year, on the date below.", once: "Once, on the date below." };
    const kindOf = x => KIND[x && x.kind] ? x.kind : (x && x.once ? "once" : "monthly");
    const kindPill = x => '<span class="fxc-kind fxc-k-' + kindOf(x) + '">' + esc(KIND[kindOf(x)]) + "</span>";
    const CATS = ["Truck financing", "Rent and lease", "Insurance", "Utilities", "Loans", "Software and phones", "Taxes", "Other"];
    let S = window.__fxcState || (window.__fxcState = { view: "month", month: null, data: null });
    if (!["month", "year", "costs"].includes(S.view)) S.view = "month";
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
    const token = (window.__fxcTok = (window.__fxcTok || 0) + 1);
    const alive = () => token === window.__fxcTok && location.hash.indexOf("page=fixed-costs") >= 0;

    host.innerHTML = RSC.loadingHtml("Fixed Costs", "Reading the fixed costs");
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
      return "<p><b>A fixed cost</b> is something we pay: a name, an amount, a date and a <b>type</b>. <i>Monthly fixed</i> is the"
        + " same amount every month; <i>Monthly usage-based</i> is an estimate until it is paid (ticking it paid asks what it really"
        + " was, and its row shows &asymp; until then); <i>Quarterly</i> repeats every 3 months and <i>Yearly</i> every 12 from their"
        + " first date; a <i>One-off</i> is paid once. A cost with <i>no set day</i> counts in its month without a date. Any single"
        + " month can be moved, changed or skipped (<i>Change this month</i>), and a cost can be stopped from any month on.</p>"
        + "<p><b>Paid in parts.</b> <i>Paid part of it</i> (in the &hellip; menu) records what is paid so far of a month's payment,"
        + " e.g. $40,000 of $80,000. The payment stays coming up or past its date until it is paid in full; the month's <i>Paid</i>"
        + " counts the part and <i>Left to pay</i> only the rest. Ticking it marks it paid in full.</p>"
        + "<p><b>Paid.</b> You tick a payment <i>Mark paid</i>. The bank helps: a cost that carries the words of its bank line"
        + " (e.g. <i>TOYOTA</i>) is also marked paid when the bank feed shows its charge in that month (several lines a month"
        + " are added up). The bank feed is filled by hand and runs about two weeks behind; today it reaches "
        + esc(day(through()) || "—") + ".</p>"
        + "<p><b>The states.</b> <i>Paid</i>: ticked, or the bank shows it. <i>Coming up</i>: its date is ahead (a cost with no set day"
        + " stays here until its month ends). <i>Due, not ticked</i>: its date has passed and it isn't ticked."
        + " <i>Due, not in the bank</i>: the bank feed covers its date and shows no charge.</p>"
        + "<p><b>The Month view</b> lists what is past its date and not paid first, then what is coming up, then what is paid."
        + " <b>Left to pay</b> = everything not paid and not skipped.</p>"
        + "<p>The list started from Gvantsa's sheet (November 2026); January 2025 to October 2026 come from the bank feed for the"
        + " costs with one clear bank payee. Every change is kept with who made it and when (a cost's <i>History</i>).</p>";
    }
    function paint() {
      if (!alive()) return;
      const d = S.data;
      const chip = through() ? "Bank feed to " + day(through()) : "";
      const nCosts = (d.costs || []).filter(c => c.status === "active").length;
      let h = '<div class="fxc">' + RSC.pageHeadHtml({
        key: "fixed-costs", title: "Fixed Costs", sub: "What we pay every month: what is paid and what is left to pay",
        chip, how: howHtml,
        actions: [{ id: "fxcAdd", label: "Add a fixed cost", primary: true }] });
      if (!d.ready) {
        host.innerHTML = h + RSC.emptyHtml({ title: "Fixed Costs is being set up", body: "The tables aren't there yet. Try again in a few minutes." }) + "</div>";
        return;
      }
      h += RSC.tabsHtml([{ id: "month", label: "Month" }, { id: "year", label: "12 months" },
                         { id: "costs", label: "Fixed costs", count: nCosts }], S.view);
      h += '<div id="fxcBody">' + (S.view === "year" ? yearHtml() : S.view === "costs" ? costsHtml() : monthHtml()) + "</div></div>";
      host.innerHTML = h;
      wire();
    }

    // ---- MONTH (ZP-3, his pick A): by status -- past its date and not paid first, then coming up, then paid
    function monthHtml() {
      const d = S.data, m = S.month;
      // dated payments first by date, then the ones with no set day
      const pays = d.payments.filter(p => ym(p.month) === m).sort((a, b) => (a.no_day - b.no_day) || String(a.due).localeCompare(String(b.due)) || String(a.name).localeCompare(String(b.name)));
      const sm = d.months.find(x => ym(x.month) === m) || { total: 0, paid: 0, left: 0, waiting_bank: 0, missing: 0, due: 0, n: 0 };
      const past = (sm.due || 0) + (sm.missing || 0);
      let h = '<div class="fxc-nav"><button type="button" class="rs-btn" data-mon="' + addM(m, -1) + '" aria-label="Previous month">‹</button>'
        + "<b>" + esc(mName(m)) + "</b>"
        + '<button type="button" class="rs-btn" data-mon="' + addM(m, 1) + '" aria-label="Next month">›</button>'
        + (m !== ym(d.today) ? '<button type="button" class="rs-btn" data-mon="' + ym(d.today) + '">This month</button>' : "") + "</div>";
      if (!pays.length) return h + RSC.emptyHtml({ title: "No fixed costs in " + mName(m), body: "Add a cost with its name, date and amount.", actionId: "fxcAddE", actionLabel: "Add a fixed cost" });
      // she ticks payments; "not in the bank feed yet" is simply not ticked yet, so it is left to pay (ZTZ-93)
      const left = (sm.left || 0) + (sm.waiting_bank || 0), pastAll = past + (sm.waiting_bank || 0);
      h += RSC.headlineHtml("In " + esc(mName(m)) + ", <b>" + money0(sm.total) + "</b> in fixed costs: <b>" + money0(sm.paid) + "</b> paid, <b>"
        + money0(left) + "</b> left to pay.");
      h += RSC.kpisHtml([
        { label: "This month", value: money0(sm.total), sub: sm.n + " payment" + (sm.n === 1 ? "" : "s") },
        { label: "Paid", value: money0(sm.paid), sub: (sm.total ? Math.round(100 * sm.paid / sm.total) + "% of the month" : "")
          + (sm.part ? " · " + money0(sm.part) + " of it paid in part" : "") },
        { label: "Left to pay", value: money0(left), sub: pastAll ? money0(pastAll) + " of it past its date" : "nothing past its date", tone: pastAll ? "bad" : "" },
      ]);
      const groups = [
        ["past", "Past its date, not paid", pays.filter(p => ["due", "waiting_bank", "missing"].includes(p.state))],
        ["next", "Coming up", pays.filter(p => p.state === "upcoming")],
        ["paid", "Paid", pays.filter(p => p.state === "paid")],
        ["skip", "Skipped this month", pays.filter(p => p.state === "skipped")],
      ];
      h += '<div class="fxc-groups">';
      groups.forEach(([key, title, list]) => {
        if (!list.length) return;
        // a payment paid in part counts only what is left (ZP-7)
        const sum = list.reduce((a, p) => a + (+p.amount || 0) - (key === "next" || key === "past" ? (+p.paid_part || 0) : 0), 0);
        h += '<section class="fxc-grp fxc-g-' + key + '"><h3>' + esc(title) + " <span>" + list.length + " · " + money0(sum) + "</span></h3>"
          + '<ul class="fxc-list">' + list.map(rowHtml).join("") + "</ul></section>";
      });
      return h + '<p class="fxc-total"><b>Total ' + money(sm.total) + "</b> · " + money0(left) + " left to pay</p></div>";
    }
    // one payment: the tick, its date, the cost with its type, the amount, and "..." for the rest
    function rowHtml(p) {
      const b = p.bank, paid = p.state === "paid", usage = kindOf(p) === "usage";
      // a month filled from the bank feed when her list was loaded (Jan 2025 - Oct 2026) says so, not "ticked by"
      const fromBank = /^(From the bank feed|No charge in the bank)/.test(p.note || "");
      const how = fromBank ? p.note : b ? "bank " + day(b.date) + (b.n > 1 ? " · " + b.n + " lines" : "") + (Math.abs(b.amount - p.amount) >= 0.01 ? " · " + money(b.amount) : "")
        : p.paid_hand === true ? "ticked" + (p.paid_by ? " by " + String(p.paid_by).split("@")[0] : "")
        : p.paid_hand === false ? "marked not paid" : p.state === "missing" ? "not found in the bank" : "";
      const sub = [p.category && p.category !== "Other" ? p.category : "", p.company !== "Zip to Zip" ? p.company : "", how,
                   p.note && !fromBank ? p.note : ""].filter(Boolean).join(" · ");
      // the tick: a paid one she ticked can be unticked; one the bank shows stays paid (change the month to override)
      const tick = p.state === "skipped" ? '<span class="fxc-tick off" aria-hidden="true"></span>'
        : paid && p.paid_hand !== true ? '<span class="fxc-tick on" title="The bank shows it">✓</span>'
        : '<button type="button" class="fxc-tick' + (paid ? " on" : "") + '" data-tick="' + (paid ? "auto" : "1") + '" data-c="' + p.cost_id + '" data-m="' + ym(p.month) + '" aria-label="'
          + esc((paid ? "Untick " : "Mark paid: ") + p.name) + '">' + (paid ? "✓" : "") + "</button>";
      return '<li class="fxc-row' + (paid ? " paid" : "") + '">' + tick
        + '<span class="fxc-date">' + esc(payDate(p)) + (p.moved && !fromBank ? ' <i class="fxc-mark" title="Another date or amount this month">changed</i>' : "") + "</span>"
        + '<span class="fxc-name"><b>' + esc(p.name) + "</b> " + kindPill(p) + (sub ? '<span class="fxc-sub">' + esc(sub) + "</span>" : "") + "</span>"
        + '<span class="fxc-amt">' + (usage && !paid ? '<i class="fxc-est" title="An estimate until it is paid">≈ </i>' : "") + money(p.amount)
        + (p.paid_part && !paid && p.state !== "skipped" ? '<span class="fxc-part">' + money0(p.paid_part) + " paid · " + money0(Math.max(0, (+p.amount || 0) - p.paid_part)) + " left</span>" : "") + "</span>"
        + '<button type="button" class="fxc-more" data-more="' + p.cost_id + '" data-m="' + ym(p.month) + '" aria-label="' + esc("More for " + p.name) + '">⋯</button></li>';
    }

    // ---- 12 MONTHS: every cost across the months in view, with the monthly totals
    function yearHtml() {
      const d = S.data, months = d.months.map(x => ym(x.month));
      const ids = [...new Set(d.payments.map(p => p.cost_id))];
      const byKey = {};
      d.payments.forEach(p => { byKey[p.cost_id + "|" + ym(p.month)] = p; });
      const nameOf = id => (d.payments.find(p => p.cost_id === id) || {}).name || "";
      ids.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      if (!ids.length) return RSC.emptyHtml({ title: "No fixed costs yet", body: "Add a cost with its name, date and amount.", actionId: "fxcAddE", actionLabel: "Add a fixed cost" });
      let h = RSC.headlineHtml("Fixed costs from <b>" + esc(mName(months[0], true)) + "</b> to <b>" + esc(mName(months[months.length - 1], true))
        + "</b>: about <b>" + money0((d.months.find(x => ym(x.month) === ym(d.today)) || {}).total) + "</b> a month now.");
      h += '<div class="rs-tablewrap" data-rsfit><table class="rs-table fxc-t fxc-y"><thead><tr><th>Fixed cost</th>'
        + months.map(m => '<th class="num' + (m === ym(d.today) ? " fxc-now" : "") + '">' + esc(mName(m, true)) + "</th>").join("") + "</tr></thead><tbody>";
      ids.forEach(id => {
        const c0 = d.payments.find(p => p.cost_id === id) || {};
        h += "<tr><td><b>" + esc(nameOf(id)) + '</b><div class="fxc-sub">' + esc(KIND[kindOf(c0)]) + "</div></td>" + months.map(m => {
          const p = byKey[id + "|" + m];
          if (!p) return '<td class="num fxc-none">—</td>';
          const tone = (STATE[p.state] || [])[1] || "";
          return '<td class="num fxc-c fxc-' + tone + (m === ym(d.today) ? " fxc-now" : "") + '" title="' + esc(payDate(p) + " · " + (STATE[p.state] || [p.state])[0]) + '">'
            + (p.state === "skipped" ? "<s>" + money0(p.amount) + "</s>" : money0(p.amount)) + "</td>";
        }).join("") + "</tr>";
      });
      const leftOf = x => (x.left || 0) + (x.waiting_bank || 0);
      const row = (lab, f) => "<tr><td><b>" + lab + "</b></td>" + d.months.map(x => '<td class="num' + (ym(x.month) === ym(d.today) ? " fxc-now" : "") + '"><b>' + money0(f(x)) + "</b></td>").join("") + "</tr>";
      h += "</tbody><tfoot>" + row("Total", x => x.total) + row("Paid", x => x.paid) + row("Left to pay", leftOf) + "</tfoot></table></div>"
        + '<p class="fxc-legend"><span class="rs-pill ok">Paid</span> <span class="rs-pill info">Coming up</span> <span class="rs-pill warn">Due, not ticked</span> '
        + '<span class="rs-pill bad">Due, not in the bank</span> <span class="rs-pill mute">Skipped</span></p>';
      return h;
    }

    // ---- FIXED COSTS: the list itself
    function whenOf(c) {
      const d = +c.day || 0, k = kindOf(c), first = ym(c.start_month);
      const on = d ? day(first + "-" + String(d).padStart(2, "0")) : "";
      if (k === "once") return (on ? on + " " : mName(first, true).split(" ")[0] + " ") + mName(first, true).split(" ")[1];
      if (k === "yearly") return "Every year" + (on ? ", " + on : ", in " + mName(first, true).split(" ")[0]);
      if (k === "quarterly") return "Every 3 months from " + mName(first, true) + (d ? ", the " + nth(d) : "");
      return "Every month, " + (d ? "the " + nth(d) : "no set day");
    }
    function costsHtml() {
      const cs = (S.data.costs || []).slice().sort((a, b) => (a.status === b.status ? 0 : a.status === "active" ? -1 : 1) || String(a.name).localeCompare(String(b.name)));
      if (!cs.length) return RSC.emptyHtml({ title: "No fixed costs yet", body: "Add a cost with its name, date and amount.", actionId: "fxcAddE", actionLabel: "Add a fixed cost" });
      const act = cs.filter(c => c.status === "active");
      const total = act.filter(c => ["monthly", "usage"].includes(kindOf(c))).reduce((a, c) => a + (+c.amount || 0), 0);
      const yearly = act.filter(c => ["quarterly", "yearly"].includes(kindOf(c))).reduce((a, c) => a + (+c.amount || 0) * (kindOf(c) === "quarterly" ? 4 : 1), 0);
      let h = RSC.headlineHtml("<b>" + act.length + "</b> fixed costs; the monthly ones come to <b>" + money0(total) + "</b> a month at their usual amounts"
        + (yearly ? ", and the quarterly and yearly ones to <b>" + money0(yearly) + "</b> a year." : "."));
      h += '<div class="rs-tablewrap"><table class="rs-table fxc-t"><thead><tr><th>Fixed cost</th><th>Type</th><th class="num">Amount</th><th>When</th>'
        + "<th>From – to</th><th>The bank helps</th><th></th></tr></thead><tbody>";
      cs.forEach(c => {
        const once = kindOf(c) === "once";
        h += '<tr class="' + (c.status === "stopped" ? "fxc-skip" : "") + '"><td><b>' + esc(c.name) + '</b><div class="fxc-sub">' + esc([c.category && c.category !== "Other" ? c.category : "", c.company !== "Zip to Zip" ? c.company : "", c.status === "stopped" ? "stopped from " + mName(c.stopped_at, true) : ""].filter(Boolean).join(" · ")) + "</div></td>"
          + "<td>" + kindPill(c) + "</td>"
          + '<td class="num">' + (kindOf(c) === "usage" ? '<i class="fxc-est">≈ </i>' : "") + money(c.amount) + "</td>"
          + "<td>" + esc(whenOf(c)) + "</td><td>" + (once ? "—" : esc(mName(c.start_month, true)) + " – " + (c.end_month ? esc(mName(c.end_month, true)) : "no end")) + "</td>"
          + "<td>" + (c.match_text ? "<code>" + esc(c.match_text) + "</code>" : '<span class="fxc-sub">no, ticked by hand</span>') + "</td>"
          + '<td class="fxc-act"><button type="button" class="rs-btn" data-edit="' + c.id + '">Edit</button>'
          + '<button type="button" class="rs-btn" data-hist="' + c.id + '">History</button></td></tr>';
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
      const addE = host.querySelector("#fxcAddE");
      if (addE) addE.onclick = () => costPanel(null);
      q("[data-paid]", b => b.onclick = () => save({ action: "month", id: +b.dataset.c, month: b.dataset.m, paid: b.dataset.paid }, b));
      q("[data-tick]", b => b.onclick = () => tick(+b.dataset.c, b.dataset.m, b.dataset.tick, b));
      q("[data-more]", b => b.onclick = () => more(+b.dataset.more, b.dataset.m));
      q("[data-mon-edit]", b => b.onclick = () => monthPanel(+b.dataset.monEdit, b.dataset.m));
      q("[data-edit]", b => b.onclick = () => costPanel(S.data.costs.find(c => c.id === +b.dataset.edit)));
      q("[data-hist]", b => b.onclick = () => histPanel(+b.dataset.hist));
    }
    // the round tick (ZP-3): paid / untick; a usage-based payment asks what it really was
    async function tick(id, m, how, btn) {
      const pay = S.data.payments.find(x => x.cost_id === id && ym(x.month) === m);
      if (!pay) return;
      if (how === "1" && kindOf(pay) === "usage") {
        const got = await RSC.ask({ title: "Paid: " + pay.name, body: "How much was it in " + mName(m) + "? The usual estimate is " + money(pay.amount) + ".",
                                    value: (+pay.amount).toFixed(2), yes: "Mark paid" });
        if (got == null) return;
        const amt = parseFloat(String(got).replace(/[$,\s]/g, ""));
        if (!(amt > 0)) return RSC.notice({ title: "Not saved", body: "Enter the amount it was, e.g. 1250.00." });
        const cost = S.data.costs.find(c => c.id === id) || {};
        return save({ action: "month", id, month: m, paid: "1", amount: Math.abs(amt - (+cost.amount || 0)) >= 0.005 ? amt : "" }, btn);
      }
      return save({ action: "month", id, month: m, paid: how }, btn);
    }
    async function more(id, m) {
      const pay = S.data.payments.find(x => x.cost_id === id && ym(x.month) === m) || {};
      const pick = await RSC.choice({ title: pay.name || "Fixed cost", body: mName(m) + " · " + KIND[kindOf(pay)],
        choices: [{ v: "part", label: pay.paid_part ? "Change the part paid" : "Paid part of it" },
                  { v: "month", label: "Change this month" }, { v: "edit", label: "Edit or remove", pri: true }] });
      if (pick === "part") partAsk(id, m);
      if (pick === "month") monthPanel(id, m);
      if (pick === "edit") costPanel(S.data.costs.find(c => c.id === id));
    }
    // ZP-7 (Gvantsa): pay a month in parts -- what is paid so far; the rest stays left to pay
    async function partAsk(id, m) {
      const pay = S.data.payments.find(x => x.cost_id === id && ym(x.month) === m);
      if (!pay) return;
      const got = await RSC.ask({ title: "Paid part: " + pay.name,
        body: "How much of the " + money(pay.amount) + " for " + mName(m) + " is paid so far? The rest stays left to pay. Empty = nothing paid yet.",
        value: pay.paid_part ? (+pay.paid_part).toFixed(2) : "", yes: "Save" });
      if (got == null) return;
      const txt = String(got).replace(/[$,\s]/g, "");
      if (txt === "") return save({ action: "month", id, month: m, paid_amount: "" });
      const amt = parseFloat(txt);
      if (!(amt > 0)) return RSC.notice({ title: "Not saved", body: "Enter the amount paid so far, e.g. 40000." });
      if (amt > (+pay.amount || 0) + 0.005) return RSC.notice({ title: "Not saved", body: "That is more than the " + money(pay.amount) + " due. Use the tick to mark it paid in full." });
      return save(amt >= (+pay.amount || 0) - 0.005 ? { action: "month", id, month: m, paid: "1" } : { action: "month", id, month: m, paid_amount: amt });
    }
    async function save(body, btn) {
      if (btn) btn.disabled = true;
      try {
        await api("", body);
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
      });
      const first = p.querySelector("input"); if (first) first.focus();
      return p;
    }
    function closePanel() { ["fxcPanel", "fxcScrim"].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
    const seg = (key, v, opts) => '<div class="rs-seg" role="group" data-seg="' + key + '">' + opts.map(([k, l]) =>
      '<button type="button" data-v="' + esc(k) + '" class="' + (k === v ? "on" : "") + '" aria-pressed="' + (k === v) + '">' + esc(l) + "</button>").join("") + "</div>";
    const segVal = (p, key) => { const b = p.querySelector('[data-seg="' + key + '"] button.on'); return b ? b.dataset.v : ""; };
    const val = (p, id) => { const x = p.querySelector("#" + id); return x ? (x.type === "checkbox" ? x.checked : x.value) : ""; };

    // HER FORM (ZTZ-93): a name, an amount, a date (or no set day), every month or a one-off. The rest is optional,
    // under "More": the category, the company, the words of its bank line (then the bank helps mark it paid), a note.
    function costPanel(c, pre) {
      const today = String(S.data.today).slice(0, 10);
      const v = Object.assign({ company: "Zip to Zip", day: +today.slice(8, 10), start_month: S.month || ym(today) }, c || {}, pre || {});
      const noDay = c ? !(+c.day) : false;
      const kind = c ? kindOf(c) : "monthly", once = kind === "once";
      // the cost's day in its first month; the 31st is a shorter month's last day
      const [fy, fm] = ym(v.start_month).split("-").map(Number), dim = new Date(Date.UTC(fy, fm, 0)).getUTCDate();
      const first = ym(v.start_month) + "-" + String(Math.max(1, Math.min(+v.day || 1, dim))).padStart(2, "0");
      const more = !!(c && (c.match_text || c.note || (c.category && c.category !== "Other") || c.company !== "Zip to Zip"));
      const body = '<label for="fxcName">Name</label><input id="fxcName" class="rs-inp" value="' + esc(v.name || "") + '" placeholder="e.g. Warehouse rent">'
        + '<label for="fxcAmt">Amount ($)</label><input id="fxcAmt" class="rs-num" inputmode="decimal" value="' + esc(v.amount != null ? (+v.amount).toFixed(2) : "") + '">'
        + "<label>Type</label>" + seg("kind", kind, Object.keys(KIND).map(k => [k, KIND[k]]))
        + '<p class="fxc-help" id="fxcKindHelp">' + esc(KIND_HELP[kind]) + "</p>"
        + '<div class="fxc-2"><div class="fxc-dt"' + (noDay ? " hidden" : "") + '><label for="fxcDate">Date</label><input id="fxcDate" class="rs-inp" type="date" value="' + esc(first) + '"></div>'
        + '<div class="fxc-mo"' + (noDay ? "" : " hidden") + '><label for="fxcMonth">Month</label><input id="fxcMonth" class="rs-inp" type="month" value="' + esc(ym(v.start_month)) + '"></div>'
        + '<div class="fxc-end"' + (once ? " hidden" : "") + '><label for="fxcTo">Last month <span class="fxc-sub">(optional)</span></label><input id="fxcTo" class="rs-inp" type="month" value="' + esc(ym(v.end_month)) + '"></div></div>'
        + '<label class="fxc-check"><input id="fxcNoDay" type="checkbox"' + (noDay ? " checked" : "") + "> No set day: it counts in the month without a date</label>"
        + '<details class="fxc-more"' + (more ? " open" : "") + "><summary>More (optional)</summary>"
        + '<label for="fxcCat">Category</label><input id="fxcCat" class="rs-inp" list="fxcCats" value="' + esc(v.category && v.category !== "Other" ? v.category : "") + '" placeholder="Rent and lease, Truck financing…">'
        + '<datalist id="fxcCats">' + CATS.map(x => '<option value="' + esc(x) + '">').join("") + "</datalist>"
        + "<label>Company</label>" + seg("company", v.company, [["Zip to Zip", "Zip to Zip"], ["Tuji", "Tuji"]])
        + '<label for="fxcMatch">The bank helps: its bank line contains</label><input id="fxcMatch" class="rs-inp" value="' + esc(v.match_text || "") + '" placeholder="e.g. TOYOTA (leave empty to tick it by hand)">'
        + '<p class="fxc-help">With these words, the bank feed also marks it paid when it shows the charge that month (a usage-based cost takes whatever the charge is). You can always tick it yourself.</p>'
        + '<label for="fxcNote">Note</label><textarea id="fxcNote" class="rs-inp" rows="2">' + esc(v.note || "") + "</textarea></details>";
      const stopped = c && c.status === "stopped";
      const foot = (c ? '<div class="fxc-foot-l"><button type="button" class="rs-btn" id="fxcRemove">Remove</button>'
          + '<button type="button" class="rs-btn" id="fxcStop">' + (stopped ? "Start it again" : "Stop it from " + esc(mName(S.month, true))) + "</button></div>" : "<span></span>")
        + '<button type="button" class="rs-btn pri" id="fxcSave">' + (c ? "Save" : "Add it") + "</button>";
      const p = openPanel(c ? "Edit " + (c.name || "the fixed cost") : "Add a fixed cost", body, foot);
      const nd = p.querySelector("#fxcNoDay");
      nd.onchange = () => { p.querySelector(".fxc-dt").hidden = nd.checked; p.querySelector(".fxc-mo").hidden = !nd.checked;
        if (nd.checked) p.querySelector("#fxcMonth").value = (val(p, "fxcDate") || "").slice(0, 7) || p.querySelector("#fxcMonth").value; };
      p.querySelectorAll('[data-seg="kind"] button').forEach(b => b.addEventListener("click", () => {
        p.querySelector(".fxc-end").hidden = b.dataset.v === "once";
        p.querySelector("#fxcKindHelp").textContent = KIND_HELP[b.dataset.v] || "";
      }));
      p.querySelector("#fxcSave").onclick = e => save({
        action: c ? "edit" : "add", id: c ? c.id : undefined, name: val(p, "fxcName"), amount: val(p, "fxcAmt"),
        kind: segVal(p, "kind"), no_day: nd.checked ? 1 : 0, date: nd.checked ? "" : val(p, "fxcDate"), month: val(p, "fxcMonth"),
        end_month: segVal(p, "kind") === "once" ? "" : val(p, "fxcTo"), category: val(p, "fxcCat"), company: segVal(p, "company"),
        match_text: val(p, "fxcMatch"), note: val(p, "fxcNote") }, e.currentTarget);
      const st = p.querySelector("#fxcStop");
      if (st) st.onclick = e => save({ action: stopped ? "restart" : "stop", id: c.id, month: S.month }, e.currentTarget);
      // ZP-6: asked once more, since it takes the paid months too; Stop is the way to end a cost that was real
      const rm = p.querySelector("#fxcRemove");
      if (rm) rm.onclick = async e => {
        const btn = e.currentTarget;
        const ok = await RSC.confirm({ title: "Remove " + (c.name || "this fixed cost") + "?",
          body: "It goes from the list and from every month, the paid months too. Use this for a cost added by mistake."
            + " To end a cost that was real and keep its past months, use Stop instead.",
          yes: "Remove it", no: "Keep it", danger: true });
        if (ok) save({ action: "remove", id: c.id }, btn);
      };
    }
    function monthPanel(id, m) {
      const pay = S.data.payments.find(x => x.cost_id === id && ym(x.month) === m);
      if (!pay) return;
      const bank = pay.method === "bank";
      const paid = pay.paid_hand === true ? "paid" : pay.paid_hand === false ? "no" : "auto";
      const body = '<p class="fxc-help"><b>' + esc(pay.name) + "</b>, " + esc(mName(m)) + ". A change here is for this month only.</p>"
        + '<div class="fxc-2"><div><label for="fxcDue">Date' + (pay.no_day ? ' <span class="fxc-sub">(no set day)</span>' : "") + '</label><input id="fxcDue" class="rs-inp" type="date" value="' + (pay.no_day ? "" : esc(String(pay.due).slice(0, 10))) + '"></div>'
        + '<div><label for="fxcMAmt">Amount ($)</label><input id="fxcMAmt" class="rs-num" inputmode="decimal" value="' + esc((+pay.amount).toFixed(2)) + '"></div></div>'
        + "<label>Paid</label>" + seg("paid", paid, bank ? [["auto", "As the bank shows"], ["paid", "Paid"], ["no", "Not paid"]] : [["auto", "Not ticked"], ["paid", "Paid"]])
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
               due_date: due && (pay.no_day || due !== String(pay.due).slice(0, 10)) ? due : (pay.changed && due ? due : ""),
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
        const what = { add: "added", edit: "changed", stop: "stopped", restart: "started again", remove: "removed", month: "changed a month", month_clear: "put a month back" };
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
        + ".fxc .fxc-part{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-top:2px;white-space:nowrap}"
        + ".fxc .fxc-y td.fxc-c.fxc-ok{color:var(--pos)}.fxc .fxc-y td.fxc-c.fxc-bad{color:var(--neg);font-weight:700}"
        + ".fxc .fxc-y td.fxc-c.fxc-warn{color:var(--warn);font-weight:700}.fxc .fxc-y td.fxc-c.fxc-mute{color:var(--muted)}"
        + ".fxc .fxc-y .fxc-now{background:var(--panel-2)}.fxc .fxc-y .fxc-none{color:var(--faint)}"
        + ".fxc .fxc-legend{font-size:12px;color:var(--muted);margin:8px 0 0;display:flex;gap:8px;flex-wrap:wrap}"
        + ".fxc-panel .fxc-form label{display:block;font-size:13px;font-weight:700;margin:12px 0 4px}"
        // min-width:0 -- the kit's 210px minimum pushed the second date of a row out of the 400px panel
        + ".fxc-panel .fxc-form .rs-inp,.fxc-panel .fxc-form .rs-num{width:100%;min-width:0;box-sizing:border-box}"
        + ".fxc-panel .fxc-2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px}.fxc-panel .fxc-2>div{min-width:0}"
        + ".fxc-panel .fxc-check{display:flex;gap:8px;align-items:flex-start;font-weight:500}"
        + ".fxc-panel .fxc-help{font-size:12.5px;color:var(--muted);margin:6px 0 0}.fxc-panel .fxc-err{color:var(--neg);font-size:13px;min-height:1em}"
        + ".fxc-panel .fxc-sub{font-size:12px;color:var(--muted)}.fxc-panel .fxc-hist{list-style:none;margin:0;padding:0}"
        + ".fxc-panel .fxc-more{margin-top:14px;border-top:1px solid var(--line);padding-top:8px}"
        + ".fxc-panel .fxc-more>summary{cursor:pointer;font-size:13px;font-weight:600;color:var(--muted);padding:4px 0}"
        + ".fxc .fxc-t td.nowrap{white-space:nowrap}"
        + ".fxc-panel .fxc-foot-l{display:flex;gap:8px}"
        // ZP-3: the Month view by status, and the type labels
        + ".fxc .fxc-groups{max-width:1040px}.fxc .fxc-grp{margin:18px 0 0}"
        + ".fxc .fxc-grp h3{font-size:14px;font-weight:700;margin:0 0 6px;display:flex;gap:8px;align-items:baseline}"
        + ".fxc .fxc-grp h3 span{font-weight:500;font-size:13px;color:var(--muted)}.fxc .fxc-g-past h3{color:var(--neg)}"
        + ".fxc .fxc-list{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}"
        + ".fxc .fxc-row{display:grid;grid-template-columns:28px 96px minmax(0,1fr) auto 32px;gap:12px;align-items:center;padding:10px 14px;border-top:1px solid var(--line)}"
        + ".fxc .fxc-row:first-child{border-top:0}.fxc .fxc-g-past .fxc-row{background:color-mix(in srgb,var(--neg) 5%,transparent)}"
        + ".fxc .fxc-g-skip .fxc-row{opacity:.6}.fxc .fxc-row.paid .fxc-name b,.fxc .fxc-row.paid .fxc-amt{color:var(--muted)}"
        + ".fxc .fxc-date{font-size:13px;color:var(--muted);font-variant-numeric:tabular-nums}.fxc .fxc-date .fxc-mark{font-style:normal}"
        + ".fxc .fxc-name{min-width:0}.fxc .fxc-name .fxc-sub{display:block}"
        + ".fxc .fxc-amt{text-align:right;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap}"
        + ".fxc .fxc-est{font-style:normal;font-weight:500;color:var(--muted)}"
        + ".fxc .fxc-tick{width:24px;height:24px;border-radius:50%;border:2px solid var(--line-2);background:transparent;padding:0;"
        + "display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;color:#fff;box-sizing:border-box}"
        + ".fxc button.fxc-tick{cursor:pointer}.fxc button.fxc-tick:hover:not(.on){border-color:var(--pos)}"
        + ".fxc .fxc-tick.on{background:var(--pos);border-color:var(--pos)}.fxc .fxc-tick.off{border-style:dashed}"
        + ".fxc .fxc-more{border:0;background:transparent;font-size:18px;line-height:1;color:var(--muted);cursor:pointer;padding:4px;border-radius:6px}"
        + ".fxc .fxc-more:hover{background:var(--panel-2);color:var(--ink)}"
        + ".fxc .fxc-total{font-size:13px;color:var(--muted);margin:12px 0 0}"
        + ".fxc .fxc-kind{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;margin-left:4px;"
        + "background:var(--panel-2);color:var(--muted);vertical-align:1px;white-space:nowrap}"
        + ".fxc .fxc-k-usage{background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)}"
        + ".fxc .fxc-k-once{background:color-mix(in srgb,var(--info,#2563eb) 12%,transparent);color:var(--info,#2563eb)}"
        + ".fxc .fxc-k-quarterly,.fxc .fxc-k-yearly{background:color-mix(in srgb,var(--pos) 12%,transparent);color:var(--pos)}"
        + ".fxc-panel [data-seg=kind]{flex-wrap:wrap;border-radius:12px}"
        + "@media (max-width:640px){.fxc .fxc-row{grid-template-columns:28px minmax(0,1fr) auto 28px;gap:8px}.fxc .fxc-date{display:none}}"
        + ".fxc-panel .fxc-hist li{padding:8px 0;border-bottom:1px solid var(--line)}";
      document.head.appendChild(st);
    }
  },
});
