/* ADMINISTRATION page: Watchers (report id watchers; tracker ZTZ-146, 21 Nov 2026).
   His ask, after truck #2 sat unused for seven months while we rented trucks: "we need to have a hand on a
   pulse ... this truck, it's no longer working. This lead provider, Thumbtack, we are paying, it's not
   generating." Each card is one rule that found something: what is wrong, the money at stake per month,
   where the evidence is, and a decision (act, keep with a reason, snooze 30 days).
   DATA: mart_watch_alert, built every hour by the loader (src/watchers.py), and the decisions through
   /api/_watch (bridge/watchers.py). A decided card is quiet until its money grows by half, or for 90 days at
   most; the loader's Monday Slack DM uses the same rule (watchers.quiet in src/watchers.py).
   It lives in Financial (his word, 23 Nov 2026: "take it to financial group"): the Financial group sees it and
   decides its cards, admins too. No customer names anywhere: cards name trucks, sources, feeds and staff. */
(() => {
  const DS = {
    watch_alert: { table: "mart_watch_alert", cols: ["Key", "Group", "Rule", "Subject", "Company", "Severity",
      "Headline", "Detail", "At Stake", "Stake Kind", "Evidence", "Data Through", "First Seen", "Sort", "Update Date"] },
  };
  for (const k in DS) if (!RS.DATASETS[k]) RS.DATASETS[k] = Object.assign({ dateCols: {}, defaultDate: null }, DS[k]);

  // the same order as GROUPS in src/watchers.py
  const GROUP_ORDER = ["Cash", "Trucks", "Fuel & expenses", "Jobs & pricing", "Lead sources", "Storage", "Packing",
    "Crew & pay", "Reviews & complaints", "Subscriptions", "Data"];
  const WAKE_RISE = 1.5, WAKE_MIN = 100, QUIET_MAX_DAYS = 90, ACT_CHECK_DAYS = 30;
  const RULES = {
    T1: "A truck we pay for isn't working: parked (Damaged, Potential) and no job for 21 days, or active and no job for 21 days (red at 45 only if we rented trucks meanwhile).",
    T2: "A truck earns under a third of the middle truck, per day in service (trucks only; a two-truck job's bill is split).",
    T3: "We rented trucks on days when one of our working trucks was free (the newest month the bank data covers); the money is that avoidable share.",
    T4: "The fleet list is out of date: Sold but insurance still listed, Damaged but doing jobs, a registration or insurance date passed.",
    L1: "A lead source with $500+ spent in 60 days and no job from it (sources first paid under 75 days ago are left out).",
    L2: "A lead source under $2 back per $1 over 90 days (red), $2-$3 (amber). About half of a bill is left after crew, truck, fuel and commission.",
    L3: "A lead source's cost per job is up 50%+ on the same 90 days a year earlier (10+ jobs in both).",
    D1: "A data feed is late against its own schedule.",
    D2: "No new jobs for 3 days (closings ended 19 Nov; the app's live API replaces them).",
    D3: "The bank data the spend, rentals and returns are judged on is 35+ days old (red at 50).",
    // phase 2 (22 Nov 2026): Fable's loophole watchers, src/watch_more.py. Job rules judge the days up to the last closing.
    C1: "Cash collected and not handed in, per foreman (Money Not Received): red at 30 days old or $5,000 held.",
    C2: "Delivered carrier jobs whose balance is bigger than what the carrier was paid, or with no carrier payment recorded.",
    C3: "Calendar jobs that never got a closing sheet; Money Flow jobs with no contract, no closing, or not in balance.",
    C4: "Jobs that got the cash price but paid mostly by card.",
    P1: "Discounts above 20% of the job, per foreman and per rep, 30 days: red at $1,500 or twice the team's rate.",
    P2: "Jobs that lost money before office cost, per rep, 30 days: red at 3 jobs.",
    P3: "A rep whose jobs are billed 30%+ over the quote far more often than the team's (60 days, 20+ jobs).",
    P4: "Jobs booked under 80% of the usual hourly rate for their crew size, per rep (against the average rate for now).",
    P5: "Local jobs closed with no digital contract, per foreman: red over 10% or 3 jobs.",
    F1: "A fuel card used on days with no job (red at 3 swipes and $300), and flagged swipes nobody answered for 14 days.",
    F2: "Fuel written on the closing sheet above 1.5x the route's estimate, or twice the fleet's per job.",
    F3: "\"Other expenses\" on the sheet that no contract extra explains, at twice the fleet's per job.",
    F4: "A card buying more than a tank (70+ gallons) on a local day.",
    K1: "Packing materials bought, as a share of packing sold, up a third on the 3 months before (red at half).",
    K2: "A foreman selling under 70% of the fleet's packing per 100 CF (90 days, 30+ jobs).",
    S1: "A storage unit still paid after its last customer left (red at 30 days), or charges we can't tie to a unit.",
    S2: "Storage debts 30+ days past due, stays where billing never started, zero fees, overpaid accounts.",
    W1: "Company-paid tips per foreman over $400 in 30 days, or on more than 8% of jobs.",
    W2: "Crew paid 2.5+ hours more than billed, at twice the fleet's share of jobs.",
    R1: "Review pay on jobs with no counted review within 30 days, per foreman (red over 35%).",
    R2: "Open complaints with no one responsible for 21+ days; foremen with twice the fleet's complaint rate.",
    A1: "A paid source's leads that nobody reached at all (no call, no answered call or text), 5%+.",
    B1: "A recurring charge group up 30%+ on its 3-month average, with any new vendors.",
  };
  const S = { view: "open", group: "", rows: null, dec: null, today: null, err: "", busy: "", edit: null };

  const esc = s => RSC.esc(s == null ? "" : String(s));
  const num = v => (v == null || v === "" || isNaN(+v) ? 0 : +v);
  const usd = v => "$" + Math.round(num(v)).toLocaleString("en-US");
  const day = v => (v ? String(v).slice(0, 10) : "");
  const nice = v => { const d = day(v); if (!d) return ""; const t = new Date(d + "T12:00:00");
    return t.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };
  const daysBetween = (a, b) => Math.round((new Date(day(b) + "T12:00:00") - new Date(day(a) + "T12:00:00")) / 864e5);

  async function api(body) {
    const opt = { headers: { "Authorization": "Bearer " + ZTZ.getToken() } };
    if (body) { opt.method = "POST"; opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    const r = await fetch(ZTZ.API + "/api/_watch", opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; throw e; }
    return j;
  }

  // the same rule as src/watchers.py quiet(): snoozed until a day, or decided and the money hasn't grown by half
  function quiet(a, dec) {
    if (!dec) return false;
    if (dec.action === "snooze") return !!dec.until && day(dec.until) >= S.today;
    if (dec.action === "keep" || dec.action === "act") {
      if (dec.decided_at && daysBetween(dec.decided_at, S.today) > QUIET_MAX_DAYS) return false;
      const was = num(dec.stake), now = num(a["At Stake"]);
      return !(now > was * WAKE_RISE && now - was >= WAKE_MIN);
    }
    return false;
  }

  function decLine(a, dec) {
    if (!dec || dec.action === "reopen") return "";
    const who = esc(String(dec.decided_by || "").split("@")[0]) + ", " + esc(nice(dec.decided_at));
    let t = dec.action === "snooze" ? "Snoozed until " + esc(nice(dec.until))
      : (dec.action === "keep" ? "Kept" : "Acting") + (dec.note ? ": " + esc(dec.note) : "");
    let warn = "";
    if (dec.action === "act" && daysBetween(dec.decided_at, S.today) > ACT_CHECK_DAYS)
      warn = `<div class="wt-stale">You decided to act on ${esc(nice(dec.decided_at))}, and it is still here.</div>`;
    if (!quiet(a, dec) && dec.action !== "snooze")
      warn += `<div class="wt-stale">Back: ${daysBetween(dec.decided_at, S.today) > QUIET_MAX_DAYS ? "90 days since the decision" : "the money at stake grew by half"}.</div>`;
    return `<div class="wt-dec">${t} <span class="wt-who">· ${who}</span></div>${warn}`;
  }

  function cardHtml(a) {
    const dec = S.dec[a.Key];
    const sev = a.Severity === "red" ? '<span class="rs-pill bad">● Red</span>' : '<span class="rs-pill warn">● Amber</span>';
    const kindTxt = { gap: " a month we could be earning", once: " to look at" }[a["Stake Kind"]] || " a month";
    const stake = num(a["At Stake"]) ? `<span class="wt-stake">${usd(a["At Stake"])}${kindTxt}</span>` : "";
    const edit = S.edit && S.edit.key === a.Key ? S.edit : null;
    const acts = edit
      ? `<div class="wt-form"><input class="wt-note" maxlength="300" placeholder="${edit.action === "keep" ? "Why it stays (required)" : "What we're doing (optional)"}" value="${esc(edit.note || "")}">`
        + `<button type="button" class="rs-btn pri" data-wt-save="${esc(a.Key)}">${edit.action === "keep" ? "Keep it" : "Save"}</button>`
        + `<button type="button" class="rs-btn" data-wt-cancel="1">Cancel</button></div>`
      : (quiet(a, dec) && dec
        ? `<button type="button" class="rs-btn" data-wt-act="reopen" data-wt-key="${esc(a.Key)}">Reopen</button>`
        : ["act|Act on it", "keep|Keep", "snooze|Snooze 30 days"].map(x => { const [k, l] = x.split("|");
            return `<button type="button" class="rs-btn" data-wt-act="${k}" data-wt-key="${esc(a.Key)}">${l}</button>`; }).join(""));
    const ev = a.Evidence ? `<a class="wt-ev" href="${esc(a.Evidence)}">See the numbers ↗</a>` : "";
    return `<div class="panel wt-card${quiet(a, dec) ? " wt-quiet" : ""}" data-sev="${esc(a.Severity)}">`
      + `<div class="wt-top">${sev}<span class="wt-rule" title="${esc(RULES[a.Rule] || "")}">${esc(a.Rule)}</span>${stake}</div>`
      + `<div class="wt-head">${esc(a.Headline)}</div>`
      + `<div class="wt-detail">${esc(a.Detail)}</div>`
      + `<div class="wt-meta">${ev}<span>first seen ${esc(nice(a["First Seen"]))}</span>${a["Data Through"] ? `<span>data through ${esc(nice(a["Data Through"]))}</span>` : ""}</div>`
      + decLine(a, dec)
      + `<div class="wt-acts">${acts}</div></div>`;
  }

  function howHtml() {
    return "<p>Every hour the data run checks these rules. A card appears when one finds something; it disappears when the problem is gone.</p><ul>"
      + Object.keys(RULES).map(k => `<li><b>${esc(k)}</b> ${esc(RULES[k])}</li>`).join("")
      + "</ul><p><b>Act</b> and <b>Keep</b> quiet a card until its money grows by half, or for 90 days at most. <b>Snooze</b> quiets it for 30 days. "
      + "Every Monday at 09:00 Tbilisi time the new red cards come to you as a Slack message.</p>"
      + "<p>“We pay for” is money leaving the company each month; “could be earning” is what a truck or a foreman working like the middle one would bring each month; "
      + "“to look at” is one-off money: cash not handed in, carrier balances, storage debts. Every card is a reason to look, not proof.</p>";
  }

  function render(host) {
    const all = S.rows.slice().sort((a, b) => num(a.Sort) - num(b.Sort));
    const open = all.filter(a => !quiet(a, S.dec[a.Key]));
    const decided = all.filter(a => quiet(a, S.dec[a.Key]));
    const list = S.view === "open" ? open : S.view === "decided" ? decided : all;
    const shown = S.group ? list.filter(a => a.Group === S.group) : list;
    const groups = GROUP_ORDER.concat([...new Set(all.map(a => a.Group))].filter(g => GROUP_ORDER.indexOf(g) < 0));
    const sum = k => open.filter(a => a["Stake Kind"] === k).reduce((t, a) => t + num(a["At Stake"]), 0);
    const cost = sum("cost"), gap = sum("gap"), once = sum("once");
    const jobsThrough = all.filter(a => a.Group === "Trucks").map(a => day(a["Data Through"])).sort().pop();
    const bankThrough = all.filter(a => a.Group === "Lead sources").map(a => day(a["Data Through"])).sort().pop();
    const sub = "What isn't paying off, checked every hour"
      + (jobsThrough ? " · jobs through " + esc(nice(jobsThrough)) : "")
      + (bankThrough ? " · bank data through " + esc(nice(bankThrough)) : "");
    const kpis = RSC.kpisHtml([
      { label: "Red", value: String(open.filter(a => a.Severity === "red").length), sub: "open, need a decision" },
      { label: "Amber", value: String(open.filter(a => a.Severity === "amber").length), sub: "open, worth a look" },
      { label: "We pay for", value: usd(cost), sub: "a month, on open cards" },
      { label: "Could be earning", value: usd(gap), sub: "a month, trucks and packing" },
      { label: "To look at", value: usd(once), sub: "one-off: cash held, balances, debts" },
      { label: "Decided", value: String(decided.length), sub: "acted on, kept or snoozed" },
    ]);
    const seg = (v, l) => `<button type="button" data-wt-view="${v}" class="${S.view === v ? "on" : ""}">${l}</button>`;
    const chip = (g, l) => `<button type="button" class="rs-chip${S.group === g ? " on" : ""}" data-wt-group="${esc(g)}">${esc(l)}</button>`;
    const bar = `<div class="wt-bar"><span class="rs-seg">${seg("open", "Open (" + open.length + ")")}${seg("decided", "Decided (" + decided.length + ")")}${seg("all", "All")}</span>`
      + `<span class="rs-chips">${chip("", "Every group")}${groups.filter(g => all.some(a => a.Group === g)).map(g => chip(g, g)).join("")}</span></div>`;
    const body = groups.map(g => {
      const cards = shown.filter(a => a.Group === g);
      if (!cards.length) return "";
      return `<section class="wt-group"><h2>${esc(g)} <span class="wt-count">${cards.length}</span></h2><div class="wt-cards">${cards.map(cardHtml).join("")}</div></section>`;
    }).join("") || RSC.emptyHtml({ title: S.view === "decided" ? "Nothing decided yet" : "Nothing needs a look", body: S.view === "open" ? "Every rule came back clean, or every card has a decision." : "" });
    host.innerHTML = RSC.pageHeadHtml({ title: "Watchers", key: "watchers", subHtml: sub, how: howHtml, howTitle: "The rules" })
      + (S.err ? `<div class="rs-hint wt-err">${esc(S.err)}</div>` : "")
      + (S.decReady === false ? '<div class="rs-hint wt-err">Decisions open after the next data run creates their table.</div>' : "")
      + bar + kpis + `<div class="wt-body">${body}</div>`;
    wire(host);
  }

  async function decide(host, key, action, note) {
    const a = S.rows.find(r => r.Key === key);
    S.err = "";
    try {
      const j = await api({ key, action, note: note || "", days: 30, stake: a ? num(a["At Stake"]) : null });
      if (j.saved) S.dec[key] = j.saved;
      S.edit = null;
    } catch (e) { S.err = String(e.message || e); }
    render(host);
  }

  function wire(host) {
    host.onclick = ev => {
      const t = ev.target.closest("button");
      if (!t || !host.contains(t)) return;
      if (t.dataset.wtView) { S.view = t.dataset.wtView; render(host); return; }
      if (t.dataset.wtGroup != null) { S.group = t.dataset.wtGroup; render(host); return; }
      if (t.dataset.wtCancel) { S.edit = null; render(host); return; }
      if (t.dataset.wtAct) {
        const key = t.dataset.wtKey, act = t.dataset.wtAct;
        if (act === "snooze" || act === "reopen") { decide(host, key, act, ""); return; }
        S.edit = { key, action: act, note: "" }; render(host);
        const inp = host.querySelector(".wt-note"); if (inp) inp.focus();
        return;
      }
      if (t.dataset.wtSave) {
        const inp = host.querySelector(".wt-note"), note = inp ? inp.value.trim() : "";
        if (S.edit.action === "keep" && !note) { S.err = "Say why it stays: a keep needs a reason."; render(host); return; }
        decide(host, t.dataset.wtSave, S.edit.action, note);
      }
    };
    host.onkeydown = ev => { if (ev.key === "Enter" && ev.target.classList.contains("wt-note")) {
      const b = host.querySelector("[data-wt-save]"); if (b) b.click(); } };
  }

  function injectStyle() {
    if (document.getElementById("wtCss")) return;
    const st = document.createElement("style");
    st.id = "wtCss";
    st.textContent = `
      .wt-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:0 0 12px}
      .wt-body{margin-top:4px}
      .wt-group{margin:18px 0 0}
      .wt-group h2{font-size:15px;font-weight:700;margin:0 0 8px;color:var(--ink)}
      .wt-count{font-weight:600;color:var(--faint);font-size:13px}
      .wt-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:10px}
      .wt-card{padding:12px 14px;display:flex;flex-direction:column;gap:6px;border-left:4px solid var(--line)}
      .wt-card[data-sev="red"]{border-left-color:var(--red)}
      .wt-card[data-sev="amber"]{border-left-color:var(--amber,#d97706)}
      .wt-card.wt-quiet{opacity:.72}
      .wt-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .wt-rule{font-size:12px;font-weight:700;color:var(--faint);cursor:help}
      .wt-stake{margin-left:auto;font-weight:700;font-size:13px;color:var(--ink)}
      .wt-head{font-size:14px;font-weight:650;color:var(--ink);line-height:1.35}
      .wt-detail{font-size:12.5px;color:var(--muted);line-height:1.45}
      .wt-meta{display:flex;flex-wrap:wrap;gap:12px;font-size:12px;color:var(--faint)}
      .wt-ev{color:var(--brand);font-weight:600;text-decoration:none}
      .wt-ev:hover{text-decoration:underline}
      .wt-dec{font-size:12.5px;color:var(--ink)}
      .wt-who{color:var(--faint)}
      .wt-stale{font-size:12px;color:var(--red);font-weight:600}
      .wt-acts{display:flex;flex-wrap:wrap;gap:6px;margin-top:2px}
      .wt-form{display:flex;gap:6px;width:100%}
      .wt-note{flex:1;min-width:0;border:1px solid var(--line);background:transparent;color:var(--ink);border-radius:8px;padding:6px 10px;font-size:13px;outline:0}
      .wt-note:focus{border-color:var(--brand)}
      .rs-hint.wt-err{color:var(--red);margin:0 0 10px}
      @media (max-width:600px){.wt-cards{grid-template-columns:1fr}.wt-form{flex-wrap:wrap}}`;
    document.head.appendChild(st);
  }

  registerPage({
    id: "watchers",
    group: "financial",
    title: "Watchers",
    async render(host) {
      injectStyle();
      host.innerHTML = RSC.loadingHtml("Watchers", "Reading what the rules found…");
      try {
        const [rows, dec] = await Promise.all([RS.load("watch_alert"), api().catch(e => ({ ready: false, latest: {}, err: e }))]);
        S.rows = rows || [];
        S.dec = dec.latest || {};
        S.decReady = dec.ready !== false;
        S.today = day(dec.today) || new Date().toISOString().slice(0, 10);
        S.err = dec.err && dec.err.status !== 503 ? String(dec.err.message || dec.err) : "";
      } catch (e) {
        host.innerHTML = RSC.pageHeadHtml({ title: "Watchers", key: "watchers" })
          + RSC.emptyHtml({ title: "The watchers aren't ready", body: String(e && e.message || e).slice(0, 200) });
        return;
      }
      render(host);
    },
  });
})();
