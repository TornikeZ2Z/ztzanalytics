/* SUBSCRIPTIONS -- every recurring charge in the bank, by group (Financial).

   Tornike's ask (2026-10-26): "add subscription analysis ... from bank account transactions we can
   identify them ... separately for marketing ads, for marketing tools, and etc." His picks: a new
   Financial page, every subscription, in four groups -- marketing ads, marketing tools and agencies,
   software / AI / phones, rent / leases / insurance -- plus "Other recurring".

   The warehouse finds the charges (src/subscriptions.py -> mart_subscription_charge: a curated vendor
   list, plus anything off the list that recurs like a subscription); this page works out, per vendor
   and for the company picked:
   - CADENCE from the gaps between charges: monthly, quarterly, yearly, or "as used" when it bills
     more than twice a month (ad platforms charging at a spend threshold);
   - STATUS against the last day the bank data covers: active while the next charge is not overdue
     (45 days for monthly, 120 quarterly, 400 yearly), stopped after that, new in its first 90 days;
   - MONTHLY COST of what is active: the last three full months ÷ 3 (monthly, as used), the last 12
     months ÷ 12 (quarterly, yearly);
   - A PRICE CHANGE when a monthly charge's latest amount is 5% (and $5) off the three before it. */
if (window.RS && RS.DATASETS && !RS.DATASETS.subscription_charge) {
  RS.DATASETS.subscription_charge = {
    table: "mart_subscription_charge",
    cols: ["Date", "Month", "Company", "Group", "Vendor", "What", "Account", "Amount", "Description",
           "Found By", "Ledger Through"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "subscriptions",
  group: "financial",
  title: "Subscriptions",
  async render(host) {
    const esc = RSC.esc;
    const num = v => (v == null || v === "" || isNaN(v) ? 0 : +v);
    const money = v => (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
    const moneyK = v => { const a = Math.abs(v), s = v < 0 ? "−$" : "$";
      return a >= 1e6 ? s + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + Math.round(a / 1e3) + "k" : s + Math.round(a).toLocaleString("en-US"); };
    const d10 = s => String(s || "").slice(0, 10);
    // calendar days in UTC both ways: local midnight read back through toISOString() lands on the
    // day before anywhere east of Greenwich (Tbilisi), which dropped the ledger's last month
    const dayMs = 864e5, utc = s => Date.parse(s + "T00:00:00Z");
    const days = (a, b) => Math.round((utc(b) - utc(a)) / dayMs);
    const addDays = (s, n) => new Date(utc(s) + n * dayMs).toISOString().slice(0, 10);
    const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length;
      return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
    const mlabel = ym => { const [y, m] = ym.split("-"); return RS.monthName(+m).slice(0, 3) + " " + y.slice(2); };
    const fmtDay = s => { const d = new Date(s + "T00:00:00"); return isNaN(d) ? s : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };
    const LS = "subsView";
    const lsGet = () => { try { return JSON.parse(localStorage.getItem(LS) || "{}"); } catch (e) { return {}; } };
    const lsSet = o => { try { localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { /* private mode */ } };

    const GROUPS = ["Marketing ads", "Marketing tools and agencies", "Software, AI and phones",
                    "Rent, leases and insurance", "Other recurring"];
    const COS = ["Zip to Zip", "Tuji", "Both"];

    host.innerHTML = `<div class="rs-loading"><div>Loading <b>recurring bank charges</b>…</div><div class="bar"><i></i></div></div>`;
    const all = (await RS.load("subscription_charge")).map(r => ({ ...r, Date: d10(r.Date), amt: num(r.Amount) }));
    injectCss();
    if (!all.length) {
      host.innerHTML = `<div class="sub"><div class="rs-page-head"><h1>Subscriptions</h1></div>
        <section class="panel"><p class="sub-note">No recurring charges found in the bank data yet.</p></section></div>`;
      return;
    }
    const END = all.map(r => d10(r["Ledger Through"])).sort().pop();
    const endMonth = END.slice(0, 7);
    // the last three FULL months: the ledger's own month counts only when it runs to the month's end
    const monthEnds = addDays(END, 1).slice(0, 7) !== endMonth;
    const ymBack = (ym, n) => { const [y, m] = ym.split("-").map(Number), t = y * 12 + m - 1 - n;
      return Math.floor(t / 12) + "-" + String(t % 12 + 1).padStart(2, "0"); };
    const lastFull = monthEnds ? endMonth : ymBack(endMonth, 1);
    const last3 = [0, 1, 2].map(i => ymBack(lastFull, i));
    const from12 = addDays(END, -365);

    const saved = lsGet();
    const S = { co: COS.includes(saved.co) ? saved.co : "Zip to Zip", grp: GROUPS.includes(saved.grp) ? saved.grp : "All",
                show: ["active", "stopped", "all"].includes(saved.show) ? saved.show : "active", q: "", open: new Set() };

    /* ---------- one vendor, worked out from its charges ---------- */
    function vendorStats(xs) {
      xs = xs.slice().sort((a, b) => (a.Date < b.Date ? -1 : 1));
      const first = xs[0], last = xs[xs.length - 1];
      const months = new Set(xs.map(r => r.Month));
      const perMonth = xs.length / months.size;
      const gaps = []; for (let i = 1; i < xs.length; i++) gaps.push(days(xs[i - 1].Date, xs[i].Date));
      const gap = median(gaps.filter(g => g > 0));
      const cad = xs.length === 1 ? "once" : perMonth > 2 ? "used" : gap >= 300 ? "yearly" : gap >= 75 ? "quarterly" : "monthly";
      const late = { yearly: 400, quarterly: 120 }[cad] || 45;
      const since = days(last.Date, END);
      const active = since <= late;
      const y12 = xs.filter(r => r.Date > from12).reduce((s, r) => s + r.amt, 0);
      const m3 = xs.filter(r => last3.includes(r.Month)).reduce((s, r) => s + r.amt, 0);
      const monthly = !active ? 0 : cad === "yearly" || cad === "quarterly" ? y12 / 12 : cad === "once" ? 0 : m3 / 3;
      let change = null;
      if (cad === "monthly" && xs.length >= 4) {
        const before = median(xs.slice(-4, -1).map(r => r.amt)), d = last.amt - before;
        if (before > 0 && Math.abs(d) >= 5 && Math.abs(d) / before >= 0.05) change = { before, d };
      }
      return { xs, first, last, cad, active, isNew: days(first.Date, END) <= 90 && xs.length > 0,
               monthly, y12, total: xs.reduce((s, r) => s + r.amt, 0), change, since };
    }

    function model() {
      const rows = all.filter(r => S.co === "Both" || r.Company === S.co);
      const by = {};
      rows.forEach(r => { const k = r.Group + "\u0001" + r.Vendor; (by[k] = by[k] || []).push(r); });
      return Object.values(by).map(xs => Object.assign({ group: xs[0].Group, vendor: xs[0].Vendor, what: xs[0].What,
        pattern: xs.some(r => r["Found By"] === "pattern"), accounts: [...new Set(xs.map(r => r.Account))] }, vendorStats(xs)));
    }

    const CAD = { monthly: "Monthly", quarterly: "Quarterly", yearly: "Yearly", used: "As used", once: "One charge" };

    function paint() {
      const V = model(), inGrp = v => S.grp === "All" || v.group === S.grp;
      const vs = V.filter(inGrp);
      const act = vs.filter(v => v.active), stopped6 = vs.filter(v => !v.active && v.since <= 183 && v.cad !== "once");
      const mo = act.reduce((s, v) => s + v.monthly, 0), y12 = vs.reduce((s, v) => s + v.y12, 0);
      const changes = act.filter(v => v.change);
      const ups = changes.filter(v => v.change.d > 0);

      // per group, for the tabs and the overview table
      const G = GROUPS.map(g => { const gv = V.filter(v => v.group === g), ga = gv.filter(v => v.active);
        return { g, n: ga.length, mo: ga.reduce((s, v) => s + v.monthly, 0), y12: gv.reduce((s, v) => s + v.y12, 0) }; });
      const moAll = G.reduce((s, x) => s + x.mo, 0);

      const listed = vs.filter(v => S.show === "all" || (S.show === "active" ? v.active : !v.active))
        .filter(v => !S.q || (v.vendor + " " + v.what + " " + v.group).toLowerCase().includes(S.q))
        .sort((a, b) => b.monthly - a.monthly || b.y12 - a.y12 || (a.last.Date < b.last.Date ? 1 : -1));

      const tab = (k, l, extra) => `<button type="button" class="${S.grp === k ? "on" : ""}" data-grp="${esc(k)}">${esc(l)}${extra ? ` <span>${extra}</span>` : ""}</button>`;
      const chip = (attr, k, cur, l) => `<button type="button" class="${cur === k ? "on" : ""}" data-${attr}="${esc(k)}">${esc(l)}</button>`;
      const status = v => !v.active ? `<span class="sub-pill off">stopped · last ${esc(fmtDay(v.last.Date))}</span>`
        : v.isNew ? `<span class="sub-pill new">new since ${esc(fmtDay(v.first.Date))}</span>` : `<span class="sub-pill on">active</span>`;
      const chg = v => v.change ? ` <span class="sub-chg ${v.change.d > 0 ? "up" : "down"}" title="was ${esc(money(v.change.before))}">${v.change.d > 0 ? "▲" : "▼"} ${money(Math.abs(v.change.d))}</span>` : "";
      const detail = v => { const last12 = v.xs.slice(-12).reverse();
        return `<tr class="sub-det"><td colspan="7"><div class="sub-detbox">
          <div class="sub-detmeta">${esc(v.what)} · paid from ${esc(v.accounts.join(", "))} · ${v.xs.length.toLocaleString()} charge${v.xs.length === 1 ? "" : "s"} since ${esc(fmtDay(v.first.Date))}, ${money(v.total)} in all${v.pattern ? " · <b>found by its pattern</b>: not on the vendor list yet" : ""}</div>
          <table class="rs-table sub-mini"><thead><tr><th>Date</th><th>Bank description</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>
          ${last12.map(r => `<tr><td>${esc(fmtDay(r.Date))}</td><td class="sub-desc">${esc(r.Description || "")}</td><td>${esc(r.Account || "")}</td><td class="num">${money(r.amt)}</td></tr>`).join("")}
          </tbody></table>${v.xs.length > 12 ? `<p class="sub-note">The latest 12 of ${v.xs.length.toLocaleString()} charges.</p>` : ""}</div></td></tr>`; };

      host.innerHTML = `
      <div class="sub">
        <div class="rs-page-head"><h1>Subscriptions</h1>
          <p>Every recurring charge in the bank, by what it pays for · bank data through ${esc(fmtDay(END))}</p></div>
        <div class="sub-bar">
          <div class="sub-chips" role="group" aria-label="Company">${COS.map(c => chip("co", c, S.co, c === "Both" ? "Both companies" : c)).join("")}</div>
        </div>
        <nav class="sub-tabs" aria-label="Subscription groups">${tab("All", "All", money(moAll) + "/mo")}${G.map(x => tab(x.g, x.g, money(x.mo) + "/mo")).join("")}</nav>
        <div class="rs-kpis" style="--kpi-cols:5">
          <div class="kpi"><div class="l">Monthly cost now</div><div class="v">${moneyK(mo)}</div><div class="s">${act.length} active · ${moneyK(mo * 12)} a year at this rate</div></div>
          <div class="kpi"><div class="l">Paid in the last 12 months</div><div class="v">${moneyK(y12)}</div><div class="s">${esc(fmtDay(addDays(from12, 1)))} – ${esc(fmtDay(END))}</div></div>
          <div class="kpi"><div class="l">Active</div><div class="v">${act.length}</div><div class="s">${act.filter(v => v.isNew).length} new in the last 90 days</div></div>
          <div class="kpi"><div class="l">Stopped lately</div><div class="v">${stopped6.length}</div><div class="s">in the last 6 months · were ${moneyK(stopped6.reduce((s, v) => s + v.y12, 0))} over 12 months</div></div>
          <div class="kpi"><div class="l">Price changes</div><div class="v">${changes.length}</div><div class="s">${ups.length} went up · +${money(ups.reduce((s, v) => s + v.change.d, 0))} a month</div></div>
        </div>
        ${S.grp === "All" ? `<section class="panel"><div class="panel-head"><span class="panel-title">By group</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Group</th><th class="num">Active</th><th class="num">Monthly cost now</th><th class="num">Share</th><th class="num">Last 12 months</th></tr></thead>
            <tbody>${G.map(x => `<tr><td><button type="button" class="sub-lnk" data-grp="${esc(x.g)}">${esc(x.g)}</button></td><td class="num">${x.n}</td>
              <td class="num"><b>${money(x.mo)}</b></td><td class="num">${moAll ? (x.mo / moAll * 100).toFixed(0) + "%" : "—"}</td><td class="num">${money(x.y12)}</td></tr>`).join("")}</tbody>
            <tfoot><tr><td>All</td><td class="num">${G.reduce((s, x) => s + x.n, 0)}</td><td class="num">${money(moAll)}</td><td class="num">100%</td><td class="num">${money(G.reduce((s, x) => s + x.y12, 0))}</td></tr></tfoot>
          </table></div></section>` : ""}
        <section class="panel"><div class="panel-head"><span class="panel-title">Paid each month</span>
            <span class="sub-sub">${S.grp === "All" ? "by group" : "the biggest vendors in " + esc(S.grp)} · last 24 months</span></div>
          <div class="chartbox" style="height:280px"><canvas id="subMonth" role="img" aria-label="Recurring charges paid each month"></canvas></div>
          <p class="sub-note">${monthEnds ? "" : esc(mlabel(endMonth)) + " runs only to " + esc(fmtDay(END)) + ". "}Ad platforms bill as you spend, so their months follow the ad budget.</p></section>
        ${changes.length ? `<section class="panel"><div class="panel-head"><span class="panel-title">Price changes</span>
            <span class="sub-sub">the latest monthly charge against the three before it</span></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Vendor</th><th class="num">Was</th><th class="num">Now</th><th class="num">Change</th><th class="num">Since</th></tr></thead>
            <tbody>${changes.sort((a, b) => b.change.d - a.change.d).map(v => `<tr><td><b>${esc(v.vendor)}</b>${S.grp === "All" ? `<div class="sub-sub">${esc(v.group)}</div>` : ""}</td>
              <td class="num">${money(v.change.before)}</td><td class="num">${money(v.last.amt)}</td>
              <td class="num">${chg(v)} <span class="sub-sub">${(v.change.d / v.change.before * 100 > 0 ? "+" : "") + (v.change.d / v.change.before * 100).toFixed(0)}%</span></td>
              <td class="num">${esc(fmtDay(v.last.Date))}</td></tr>`).join("")}</tbody></table></div></section>` : ""}
        <section class="panel"><div class="panel-head"><span class="panel-title">${S.grp === "All" ? "Every vendor" : esc(S.grp)}</span>
            <span class="sub-sub">${listed.length} shown · click a vendor for its charges</span></div>
          <div class="sub-bar">
            <div class="sub-chips" role="group" aria-label="Status">${chip("show", "active", S.show, "Active")}${chip("show", "stopped", S.show, "Stopped")}${chip("show", "all", S.show, "All")}</div>
            <input type="search" class="sub-q" id="subQ" placeholder="Search a vendor" aria-label="Search a vendor" value="${esc(S.q)}">
          </div>
          <div class="rs-tablewrap sub-scroll"><table class="rs-table sub-list">
            <thead><tr><th>Vendor</th><th>Billed</th><th class="num">Monthly cost</th><th class="num">Last charge</th><th class="num">Last 12 months</th><th class="num">Paying since</th><th class="num">Status</th></tr></thead>
            <tbody>${listed.map(v => { const k = v.group + "\u0001" + v.vendor;
              return `<tr class="sub-row${S.open.has(k) ? " open" : ""}" data-k="${esc(k)}" tabindex="0">
                <td><b>${esc(v.vendor)}</b>${v.pattern ? ' <span class="sub-pill pat" title="recurs monthly, not on the vendor list yet">to review</span>' : ""}
                  <div class="sub-sub">${esc(v.what)}${S.grp === "All" ? " · " + esc(v.group) : ""}</div></td>
                <td>${CAD[v.cad]}</td>
                <td class="num">${v.active && v.monthly ? `<b>${money(v.monthly)}</b>` : "—"}</td>
                <td class="num">${money(v.last.amt)}${chg(v)}<div class="sub-sub">${esc(fmtDay(v.last.Date))}</div></td>
                <td class="num">${v.y12 ? money(v.y12) : "—"}</td>
                <td class="num">${esc(fmtDay(v.first.Date))}</td>
                <td class="num">${status(v)}</td></tr>${S.open.has(k) ? detail(v) : ""}`; }).join("")
              || `<tr><td colspan="7" class="sub-note">Nothing here for ${esc(S.co === "Both" ? "both companies" : S.co)}.</td></tr>`}</tbody>
          </table></div></section>
        <section class="panel sub-how"><div class="panel-head"><span class="panel-title">How this is counted</span></div><ul>
          <li><b>The charges</b> are the bank's: the checking account, the credit card and the marketing card, from January 2024 to ${esc(fmtDay(END))} (the bank file is added once a month). Paying our own cards, transfers, Zelle and checks to people, payroll, taxes, card-processing fees, fuel, tolls, truck rental and repairs, packing material and supplies are never counted.</li>
          <li><b>A vendor</b> comes from the vendor list, which reads the bank description (and the bank's own category for PayPal and ACH payments). Anything off the list that is charged about once a month at a steady amount in 4 of the last 12 months is added as <b>Other recurring</b>, marked <i>to review</i>.</li>
          <li><b>Billed</b> follows the gaps between charges: monthly, quarterly, yearly, or <b>as used</b> when it charges more than twice a month (ad platforms billing at a spend threshold).</li>
          <li><b>Active</b> means the next charge is not overdue on ${esc(fmtDay(END))}: 45 days for monthly, 120 for quarterly, 400 for yearly. <b>Monthly cost</b> is what an active vendor cost over ${esc(last3.slice().reverse().map(mlabel).join(", "))} ÷ 3, or its last 12 months ÷ 12 when it bills quarterly or yearly.</li>
          <li><b>A price change</b> is a monthly charge whose latest amount is at least 5% and $5 away from the three before it.</li>
        </ul></section>
      </div>`;

      /* ---------- wiring ---------- */
      const save = () => lsSet({ co: S.co, grp: S.grp, show: S.show });
      host.querySelectorAll("[data-grp]").forEach(b => { b.onclick = () => { S.grp = b.dataset.grp; S.open.clear(); save(); paint(); }; });
      host.querySelectorAll("[data-co]").forEach(b => { b.onclick = () => { S.co = b.dataset.co; S.open.clear(); save(); paint(); }; });
      host.querySelectorAll("[data-show]").forEach(b => { b.onclick = () => { S.show = b.dataset.show; save(); paint(); }; });
      const q = host.querySelector("#subQ");
      if (q) q.oninput = () => { const pos = q.selectionStart; S.q = q.value.trim().toLowerCase(); paint();
        const n = host.querySelector("#subQ"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { /* type=search */ } } };
      host.querySelectorAll(".sub-row").forEach(tr => {
        const toggle = () => { const k = tr.dataset.k; S.open.has(k) ? S.open.delete(k) : S.open.add(k); paint(); };
        tr.onclick = toggle;
        tr.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
      });

      /* ---------- the monthly chart ---------- */
      try {
        const v2 = RS.isV2 && RS.isV2(), CAT = v2 && RS.V2 ? RS.V2.cat
          : ["#b7e23b", "#5b8def", "#f2a541", "#2bb3a3", "#a77bf3", "#8a96a8", "#e46f6f", "#c9d36a"];
        const months = []; for (let i = 23; i >= 0; i--) months.push(ymBack(endMonth, i));
        let series;
        if (S.grp === "All") series = GROUPS.map(g => ({ l: g, f: r => r.Group === g }));
        else {
          const top = vs.slice().sort((a, b) => b.y12 - a.y12 || b.total - a.total).slice(0, 6).map(v => v.vendor);
          series = top.map(n => ({ l: n, f: r => r.Group === S.grp && r.Vendor === n }));
          if (vs.length > top.length) series.push({ l: "Everything else", f: r => r.Group === S.grp && !top.includes(r.Vendor) });
        }
        const rows = all.filter(r => S.co === "Both" || r.Company === S.co);
        const ds = series.map((s, i) => ({ label: s.l, backgroundColor: CAT[i % CAT.length], borderRadius: 2, maxBarThickness: 34,
          data: months.map(m => Math.round(rows.filter(r => r.Month === m && s.f(r)).reduce((t, r) => t + r.amt, 0))) }))
          .filter(d => d.data.some(v => v));
        new Chart(host.querySelector("#subMonth"), { type: "bar", data: { labels: months.map(mlabel), datasets: ds },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: x => `${x.dataset.label}: ${money(x.raw)}`,
              footer: xs => "Total: " + money(xs.reduce((s, x) => s + x.raw, 0)) } } },
            scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, ticks: { callback: v => moneyK(v) } } } } });
      } catch (e) { console.warn("subscriptions chart:", e); }
    }
    paint();

    function injectCss() {
      if (document.getElementById("sub-css")) return;
      const s = document.createElement("style"); s.id = "sub-css";
      s.textContent = `
        .sub-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin:0 0 12px}
        .sub-chips{display:flex;flex-wrap:wrap;gap:6px}
        .sub-chips button,.sub-tabs button{font:inherit;font-size:12.5px;font-weight:600;color:var(--muted);background:none;cursor:pointer;
          border:1px solid var(--line);border-radius:999px;padding:5px 12px}
        .sub-chips button.on,.sub-tabs button.on{color:var(--ink);border-color:var(--brand);background:rgba(132,204,22,.12)}
        .sub-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 14px}
        .sub-tabs button span{font-weight:400;color:var(--faint)}
        .sub-sub{font-size:12px;color:var(--faint);font-weight:400}
        .sub-note{font-size:12.5px;color:var(--muted);margin:8px 0 0;line-height:1.5}
        .sub-q{font:inherit;font-size:12.5px;width:100%;max-width:260px;padding:5px 9px;border:1px solid var(--line);border-radius:8px;background:none;color:var(--ink)}
        .sub-scroll{max-height:640px;overscroll-behavior:contain}
        .sub-scroll thead th{position:sticky;top:0;z-index:2;background:var(--panel)}
        .sub-row{cursor:pointer}.sub-row:hover td{background:rgba(132,204,22,.06)}.sub-row.open td{border-bottom-color:transparent}
        .sub-det td{background:var(--panel2,rgba(0,0,0,.02))}
        .sub-detbox{padding:4px 2px 8px}.sub-detmeta{font-size:12.5px;color:var(--muted);margin:0 0 8px}
        .sub-mini{font-size:12.5px}.sub-desc{color:var(--muted);max-width:420px;overflow-wrap:anywhere}
        .sub-pill{display:inline-block;font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 8px;white-space:nowrap}
        .sub-pill.on{background:rgba(21,128,61,.12);color:#15803D}
        .sub-pill.new{background:rgba(63,125,32,.14);color:#3F7D20}
        .sub-pill.off{background:rgba(100,116,139,.14);color:var(--muted)}
        .sub-pill.pat{background:rgba(180,83,9,.12);color:#B45309}
        .sub-chg{font-size:12px;font-weight:600;white-space:nowrap}.sub-chg.up{color:#B91C1C}.sub-chg.down{color:#15803D}
        .sub-lnk{font:inherit;font-weight:600;color:var(--ink);background:none;border:0;padding:0;cursor:pointer;text-decoration:underline;text-underline-offset:2px}
        .sub-how ul{margin:6px 0 0;padding-left:18px;font-size:13px;color:var(--muted);line-height:1.6}
        .sub-how b{color:var(--ink)}
      `;
      document.head.appendChild(s);
    }
  },
});
