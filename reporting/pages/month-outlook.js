/* MONTH OUTLOOK (Financial, id month-outlook) -- Tornike 2026-10-06: "based on the jobs already in
   the calendar today, how will this month end if we book nothing more -- roughly what profit --
   plus which regions, weekdays, sources and salespeople are well booked, and how far ahead the
   jobs were booked (1-7, 8-14, 15-30, 30+ days)."

   The month AS BOOKED, not a forecast of new bookings (he deferred that). Read from
   mart_month_outlook (src/month_outlook.py):
     done      a worked day with its closing sheet -- actual bill and Profit per Job
     done_est  a worked day whose closing is not filed yet -- the calendar estimate
     ahead     today onward from the calendar -- cash grand total x the learned increase
     ly / pm   the same month last year / the month before, as billed (reference only)
   Page-local filters (month, company, state, city): the global bar's date logic would only confuse
   a page about the future. */
if (window.RS && RS.DATASETS && !RS.DATASETS.month_outlook) {
  RS.DATASETS.month_outlook = {
    table: "mart_month_outlook",
    cols: ["Month", "Day", "Weekday", "Phase", "Is Estimate", "Company", "Request #", "Request Joinkey",
           "Customer", "Job Type", "State", "City", "Source", "Sales Person", "Booked Date", "Lead Days",
           "Lead Bucket", "Calendar Total", "Uplift", "Revenue", "Margin", "Profit", "Built At"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "month-outlook",
  group: "financial",
  title: "Month Outlook",
  async render(host) {
    const num = v => (v == null || v === "" ? 0 : +v);
    const money = v => RS.money0 ? RS.money0(v) : "$" + Math.round(v).toLocaleString();
    const moneyK = v => Math.abs(v) >= 1e6 ? "$" + (v / 1e6).toFixed(2) + "M" : (Math.abs(v) >= 1e3 ? "$" + Math.round(v / 1e3) + "k" : "$" + Math.round(v));
    const fmtN = RS.fmtN;
    const esc = s => RSC.esc(s == null ? "" : String(s));
    host.innerHTML = `<div class="rs-loading" style="padding:30px">Reading the calendar…</div>`;
    const all = await RS.load("month_outlook");
    const months = [...new Set(all.map(r => r["Month"]))].sort();
    const S = window.__MO_STATE = window.__MO_STATE || { month: months[0], co: "", st: "", city: "" };
    if (months.indexOf(S.month) < 0) S.month = months[0];

    const style = `<style id="mo-style">
      .mo-wrap{max-width:1280px}
      .mo-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:4px 0 14px}
      .mo-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
      .mo-seg button{appearance:none;border:0;background:none;font:inherit;font-size:13px;font-weight:700;color:var(--muted);padding:7px 14px;cursor:pointer}
      .mo-seg button.on{background:var(--brand);color:var(--brand-ink)}
      .mo-hero{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
      .mo-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;box-shadow:var(--shadow)}
      .mo-card.total{border:2px solid var(--brand)}
      .mo-card .k{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
      .mo-card .v{font-size:26px;font-weight:800;margin-top:4px;letter-spacing:-.5px}
      .mo-card .s{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.5}
      .mo-card .s b{color:var(--ink)}
      .mo-up{color:var(--green, #2e7d32);font-weight:800}.mo-dn{color:var(--red);font-weight:800}
      .mo-sec{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:22px 0 8px}
      .mo-days{display:flex;align-items:flex-end;gap:3px;height:150px;border-bottom:1px solid var(--line);padding-top:16px}
      .mo-day{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:stretch;height:100%;position:relative;min-width:0}
      .mo-day i{display:block;border-radius:3px 3px 0 0}
      .mo-day .n{position:absolute;top:-15px;left:0;right:0;text-align:center;font-size:10px;font-weight:700;color:var(--muted)}
      .mo-day.wk{background:color-mix(in srgb,var(--line) 35%,transparent)}
      .mo-day.today{outline:2px solid var(--brand);outline-offset:1px}
      .mo-dlab{display:flex;gap:3px}.mo-dlab span{flex:1;text-align:center;font-size:9.5px;color:var(--faint);min-width:0}
      .mo-leg{display:flex;gap:14px;font-size:11.5px;color:var(--muted);margin-top:8px;flex-wrap:wrap}
      .mo-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}
      .mo-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
      .mo-hb{display:grid;grid-template-columns:110px minmax(0,1fr) 120px;gap:8px;align-items:center;font-size:12.5px;padding:4px 0}
      .mo-hb .t{height:14px;background:var(--panel-2);border-radius:4px;overflow:hidden;display:flex}
      .mo-hb .t i{display:block;height:100%}
      .mo-hb .r{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
      .mo-hb .r b{color:var(--ink)}
      .mo-tbl{width:100%;border-collapse:collapse;font-size:13px}
      .mo-tbl th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding:7px 8px;border-bottom:2px solid var(--line)}
      .mo-tbl td{padding:7px 8px;border-bottom:1px solid var(--line)}
      .mo-tbl .r{text-align:right;font-variant-numeric:tabular-nums}
      .mo-note{font-size:12px;color:var(--faint);line-height:1.55;margin-top:8px}
      @media(max-width:900px){.mo-hero,.mo-two{grid-template-columns:1fr}.mo-hb{grid-template-columns:90px minmax(0,1fr) 100px}}
    </style>`;
    const C = { done: "var(--brand-d, #6a8f12)", est: "color-mix(in srgb,var(--brand) 55%,transparent)", ahead: "color-mix(in srgb,var(--blue) 55%,transparent)" };

    const paint = () => {
      const inMonth = all.filter(r => r["Month"] === S.month && (!S.co || r["Company"] === S.co));
      const ref = inMonth.filter(r => r["Phase"] === "ly" || r["Phase"] === "pm");
      let jobs = inMonth.filter(r => ["done", "done_est", "ahead"].indexOf(r["Phase"]) >= 0);
      const states = [...new Set(jobs.map(r => r["State"]).filter(Boolean))].sort();
      const cities = [...new Set(jobs.filter(r => !S.st || r["State"] === S.st).map(r => r["City"]).filter(Boolean))].sort();
      if (S.st) jobs = jobs.filter(r => r["State"] === S.st);
      if (S.city) jobs = jobs.filter(r => r["City"] === S.city);
      const sum = (rs, c) => rs.reduce((a, r) => a + num(r[c]), 0);
      const done = jobs.filter(r => r["Phase"] === "done"), dest = jobs.filter(r => r["Phase"] === "done_est"),
            ahead = jobs.filter(r => r["Phase"] === "ahead");
      const refOf = ph => ({ jobs: ref.filter(r => r["Phase"] === ph).reduce((a, r) => a + num(r["Lead Days"]), 0),
                             rev: sum(ref.filter(r => r["Phase"] === ph), "Revenue") });
      const ly = refOf("ly"), pm = refOf("pm");
      const totRev = sum(jobs, "Revenue"), totProf = sum(jobs, "Profit");
      const filtered = !!(S.st || S.city);
      const cmp = (now, then, label) => !then ? "" : (() => { const d = (now - then) / then * 100;
        return `<div class="s">${label}: <b>${moneyK(then)}</b> <span class="${d >= 0 ? "mo-up" : "mo-dn"}">${d >= 0 ? "+" : ""}${d.toFixed(0)}%</span></div>`; })();
      const [y, m] = S.month.split("-").map(Number);
      const days = new Date(y, m, 0).getDate();
      const todayIso = new Date().toISOString().slice(0, 10);
      const byDay = {};
      jobs.forEach(r => { const d = String(r["Day"]).slice(0, 10); const o = byDay[d] = byDay[d] || { done: 0, est: 0, ahead: 0, n: 0 };
        o[r["Phase"] === "done" ? "done" : (r["Phase"] === "done_est" ? "est" : "ahead")] += num(r["Revenue"]); o.n++; });
      const maxDay = Math.max(1, ...Object.values(byDay).map(o => o.done + o.est + o.ahead));
      const dayCols = [], dayLabs = [];
      for (let i = 1; i <= days; i++) {
        const d = S.month + "-" + String(i).padStart(2, "0");
        const o = byDay[d] || { done: 0, est: 0, ahead: 0, n: 0 };
        const wd = new Date(y, m - 1, i).getDay();
        const h = v => (v / maxDay * 100).toFixed(1) + "%";
        dayCols.push(`<div class="mo-day${wd === 0 || wd === 6 ? " wk" : ""}${d === todayIso ? " today" : ""}" title="${esc(d)}: ${o.n} jobs, ${money(o.done + o.est + o.ahead)}">
          ${o.n ? `<span class="n">${o.n}</span>` : ""}<i style="height:${h(o.ahead)};background:${C.ahead}"></i><i style="height:${h(o.est)};background:${C.est}"></i><i style="height:${h(o.done)};background:${C.done};border-radius:0"></i></div>`);
        dayLabs.push(`<span>${i % 5 === 1 || days <= 16 ? i : ""}</span>`);
      }
      // grouped bars
      const groupBy = (key, order) => {
        const o = {};
        jobs.forEach(r => { const k = (typeof key === "function" ? key(r) : r[key]) || "—";
          const g = o[k] = o[k] || { k, n: 0, rev: 0, prof: 0, done: 0, ahead: 0 };
          g.n++; g.rev += num(r["Revenue"]); g.prof += num(r["Profit"]);
          if (r["Phase"] === "ahead") g.ahead += num(r["Revenue"]); else g.done += num(r["Revenue"]); });
        const list = Object.values(o);
        return order ? order.map(k => o[k] || { k, n: 0, rev: 0, prof: 0, done: 0, ahead: 0 }) : list.sort((a, b) => b.rev - a.rev);
      };
      const hbars = list => { const mx = Math.max(1, ...list.map(g => g.rev));
        return list.map(g => `<div class="mo-hb"><span>${esc(g.k)}</span>
          <span class="t"><i style="width:${(g.done / mx * 100).toFixed(1)}%;background:${C.done}"></i><i style="width:${(g.ahead / mx * 100).toFixed(1)}%;background:${C.ahead}"></i></span>
          <span class="r"><b>${moneyK(g.rev)}</b> &middot; ${g.n} job${g.n === 1 ? "" : "s"}</span></div>`).join(""); };
      const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const wdCount = k => { let n = 0; for (let i = 1; i <= days; i++) if (WD[(new Date(y, m - 1, i).getDay() + 6) % 7] === k) n++; return n; };
      const wdList = groupBy("Weekday", WD).map(g => Object.assign(g, { k: g.k + " (" + (g.n / Math.max(1, wdCount(g.k))).toFixed(1) + "/day)" }));
      const lead = groupBy("Lead Bucket", ["1-7 days", "8-14 days", "15-30 days", "30+ days", "Unknown"]);
      const tbl = (title, list) => `<table class="mo-tbl"><thead><tr><th>${title}</th><th class="r">Jobs</th><th class="r">Revenue</th><th class="r">Gross profit</th><th class="r">Share</th></tr></thead><tbody>
        ${list.slice(0, 15).map(g => `<tr><td>${esc(g.k)}</td><td class="r">${g.n}</td><td class="r">${money(g.rev)}</td><td class="r">${money(g.prof)}</td><td class="r">${totRev ? Math.round(g.rev / totRev * 100) : 0}%</td></tr>`).join("")}</tbody></table>`;
      const up = ahead.length ? (sum(ahead, "Uplift") / ahead.length) : null;
      const mg = ahead.length ? (sum(ahead, "Margin") / ahead.length) : null;
      const label = new Date(y, m - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

      host.innerHTML = style + `<div class="mo-wrap">
        <div class="rs-page-head"><h1>Month Outlook</h1>
          <p>How ${esc(label)} ends <b>if nothing more is booked</b>: the days already worked (closing sheets), plus every job
          still on the calendar. New bookings will add to it &mdash; this is the floor, not a forecast.</p></div>
        <div class="mo-bar">
          <div class="mo-seg" id="moMonth">${months.map(mm => `<button data-v="${mm}" class="${mm === S.month ? "on" : ""}">${esc(new Date(+mm.slice(0, 4), +mm.slice(5, 7) - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" }))}</button>`).join("")}</div>
          <div class="mo-seg" id="moCo">${[["", "All"], ["Zip to Zip", "Zip to Zip"], ["Tuji", "Tuji"]].map(([v, l]) => `<button data-v="${v}" class="${v === S.co ? "on" : ""}">${l}</button>`).join("")}</div>
          <div id="moSt"></div><div id="moCity"></div>
        </div>
        <div class="mo-hero">
          <div class="mo-card"><div class="k">Done so far</div><div class="v">${money(sum(done, "Revenue") + sum(dest, "Revenue"))}</div>
            <div class="s"><b>${done.length + dest.length}</b> jobs &middot; gross profit <b>${money(sum(done, "Profit") + sum(dest, "Profit"))}</b></div>
            ${dest.length ? `<div class="s">${dest.length} of them have no closing filed yet &mdash; estimated from the calendar</div>` : ""}</div>
          <div class="mo-card"><div class="k">Still on the calendar</div><div class="v">${money(sum(ahead, "Revenue"))}</div>
            <div class="s"><b>${ahead.length}</b> jobs &middot; est. gross profit <b>${money(sum(ahead, "Profit"))}</b></div>
            <div class="s">estimated: cash total &times; ${up ? up.toFixed(2) : "—"} (the usual increase to the final bill)</div></div>
          <div class="mo-card total"><div class="k">${esc(label)} if nothing more is booked</div><div class="v">${money(totRev)}</div>
            <div class="s"><b>${jobs.length}</b> jobs &middot; gross profit <b>${money(totProf)}</b></div>
            ${filtered ? `<div class="s">comparisons hidden while a location filter is on</div>` : cmp(totRev, ly.rev, "Same month last year (" + fmtN(ly.jobs) + " jobs)") + cmp(totRev, pm.rev, "Last month (" + fmtN(pm.jobs) + " jobs)")}</div>
        </div>
        <div class="mo-sec">Day by day</div>
        <div class="mo-card"><div class="mo-days">${dayCols.join("")}</div><div class="mo-dlab">${dayLabs.join("")}</div>
          <div class="mo-leg"><span><i style="background:${C.done}"></i>Done, closing filed</span><span><i style="background:${C.est}"></i>Done, closing not filed (estimate)</span>
          <span><i style="background:${C.ahead}"></i>Still on the calendar (estimate)</span><span>numbers = jobs that day &middot; shaded = weekend</span></div></div>
        <div class="mo-two">
          <div><div class="mo-sec">By state</div><div class="mo-card">${hbars(groupBy("State")) || '<div class="mo-note">No jobs.</div>'}</div></div>
          <div><div class="mo-sec">By weekday &middot; jobs per day of that weekday</div><div class="mo-card">${hbars(wdList)}</div></div>
        </div>
        <div class="mo-sec">How far ahead the jobs were booked</div>
        <div class="mo-card">${hbars(lead)}<div class="mo-note">Days from the Moveboard booking to the move. "Unknown" = no booking date on the lead.</div></div>
        <div class="mo-two">
          <div><div class="mo-sec">Sources</div><div class="mo-card">${tbl("Source", groupBy("Source"))}</div></div>
          <div><div class="mo-sec">Who booked them</div><div class="mo-card">${tbl("Salesperson", groupBy("Sales Person"))}</div></div>
        </div>
        <details style="margin-top:18px"><summary class="mo-sec" style="cursor:pointer">Every job (${jobs.length})</summary>
          <div class="mo-card" style="overflow:auto"><table class="mo-tbl"><thead><tr><th>Day</th><th>Customer</th><th>State</th><th>Source</th><th>Salesperson</th><th>Booked ahead</th><th class="r">Revenue</th><th></th></tr></thead><tbody>
          ${jobs.slice().sort((a, b) => String(a["Day"]).localeCompare(String(b["Day"]))).map(r => `<tr${r["Request Joinkey"] ? ` data-lead="${esc(r["Request Joinkey"])}" style="cursor:pointer"` : ""}>
            <td>${esc(String(r["Day"]).slice(5, 10))}</td><td>${esc(r["Customer"] || "—")}</td><td>${esc(r["State"] || "—")}</td>
            <td>${esc(r["Source"] || "—")}</td><td>${esc(r["Sales Person"] || "—")}</td><td>${r["Lead Days"] != null ? esc(r["Lead Days"]) + " d" : "—"}</td>
            <td class="r">${money(num(r["Revenue"]))}</td><td>${+r["Is Estimate"] ? '<span class="rs-pill warn">estimate</span>' : '<span class="rs-pill ok">closed</span>'}</td></tr>`).join("")}</tbody></table></div></details>
        <div class="mo-note">Gross profit = the closing sheet's Profit per Job; for estimated jobs, the same share of revenue as past jobs of that type
          (about ${mg ? Math.round(mg * 100) : "—"}%). Increase and profit share are learned from the last 180 days of calendar jobs matched to their closings.
          Built ${esc(String((all[0] || {})["Built At"] || "").slice(0, 16))} UTC.</div>
      </div>`;
      host.querySelectorAll("#moMonth button").forEach(b => b.onclick = () => { S.month = b.dataset.v; S.city = ""; paint(); });
      host.querySelectorAll("#moCo button").forEach(b => b.onclick = () => { S.co = b.dataset.v; paint(); });
      RSC.localSelect(host.querySelector("#moSt"), { label: "State", allLabel: "All states", values: states.map(v => ({ v, l: v })),
        value: S.st, onChange: v => { S.st = v; S.city = ""; paint(); } });
      RSC.localSelect(host.querySelector("#moCity"), { label: "City", allLabel: "All cities", values: cities.map(v => ({ v, l: v })),
        value: S.city, onChange: v => { S.city = v; paint(); } });
    };
    paint();
  },
});
