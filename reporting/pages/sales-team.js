/* Sales Team Command — the sales LEAD's lead-360 report (report id: sales-command).
   v3 (Tornike 2026-07-23 feedback round):
     - Speed/Inflow tabs REMOVED (they live as their own pages)
     - CONTACT truth: contacted = outbound call OR answered incoming ("we spoke")
     - canonical funnel reused verbatim: Qualified = Status Category !== 'Bad Lead',
       Dead = 'Bad Lead', Confirmed = 'Confirmed' (by confirmed date), RS.bookingRate
     - Estimate -> Actual with the change % everywhere
     - Detailed / Compact toggle on the people table (Money-Flow style), bigger type
     - Lead File drawer MUCH bigger: full closing-sheet section + refunds/claims/reviews
   Global filter bar fully applies. Giorgi Kolbaia (branch owner) excluded from people. */

(() => {
  const EXCLUDE_SP = new Set(["giorgi kolbaia"]);
  const TH_KEY = "st_thresholds_v1";
  const thDefaults = { slowMin: 30, neverPct: 10, convFrac: 0.5, minLeads: 5 };
  const thGet = () => { try { return { ...thDefaults, ...(JSON.parse(localStorage.getItem(TH_KEY)) || {}) }; } catch (e) { return { ...thDefaults }; } };
  const thSet = t => { try { localStorage.setItem(TH_KEY, JSON.stringify(t)); } catch (e) {} };

  const esc = s => RSC.esc(s == null ? "" : String(s));
  const num = v => (v == null || v === "" ? null : +v);
  const money0 = v => (v == null || isNaN(v) ? "—" : RS.money(+v));
  const pct1 = v => (v == null || isNaN(v) ? "—" : (Math.round(v * 10) / 10) + "%");
  const mins = v => {
    if (v == null) return "—";
    v = +v;
    if (v < 60) return Math.round(v) + "m";
    const h = v / 60;
    return h < 24 ? (Math.round(h * 10) / 10) + "h" : Math.round(h / 24) + "d";
  };
  const secH = v => {
    if (!v) return "—";
    v = Math.round(+v);
    if (v < 60) return v + "s";
    const m = Math.floor(v / 60);
    return m < 60 ? m + "m " + (v % 60) + "s" : Math.floor(m / 60) + "h " + (m % 60) + "m";
  };
  const median = a => {
    const v = a.filter(x => x != null).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  /* canonical funnel predicates — rs-core's registered measures, verbatim */
  const isConf = r => String(r["Status Category"] || "").trim() === "Confirmed";
  const isDead = r => String(r["Status Category"] || "").trim() === "Bad Lead";
  const isQual = r => !isDead(r);
  const isContacted = r => !!+r["Contacted"] || !!+r["Called"];   // Contacted col post-rebuild; Called fallback
  const estActual = r => {
    const q = num(r["Avg Quote"]), b = num(r["Total Bill"]);
    if (q == null && b == null) return "—";
    if (b == null) return money0(q);
    const d = r["Bill Vs Quote Pct"];
    return `${money0(q)} → <b>${money0(b)}</b>` +
      (d != null ? ` <span class="${+d >= 0 ? "st-good" : "st-bad"}">${+d > 0 ? "+" : ""}${pct1(+d)}</span>` : "");
  };
  const contactCell = r => {
    if (+r["Called"]) return r["TTO Biz Min"] != null ? mins(+r["TTO Biz Min"]) : "yes";
    if (isContacted(r)) return `<span class="st-good">in call</span>`;
    return `<span class="st-bad">no contact</span>`;
  };

  function injectStyle() {
    const old = document.getElementById("st-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "st-style";
    st.textContent = `
    .st-tabbar{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:4px 2px 16px;padding-left:2px}
    .st-tab{appearance:none;border:0;background:none;font-family:inherit;font-size:14.5px;font-weight:650;color:var(--muted);padding:10px 15px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
    .st-tab:hover{color:var(--ink)} .st-tab.on{color:var(--brand);border-bottom-color:var(--brand)}
    .st-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:11px;margin-bottom:15px}
    @media(max-width:1100px){.st-kpis{grid-template-columns:repeat(2,1fr)}}
    .st-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
    .st-kpi .l{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
    .st-kpi .v{font-size:24px;font-weight:820;color:var(--ink);margin-top:6px;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
    .st-kpi .s{font-size:11.5px;color:var(--faint);margin-top:3px}
    .st-card{background:var(--panel);border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:15px 17px;margin-bottom:14px}
    .st-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
    .st-tbl th{text-align:left;color:var(--muted);font-weight:750;font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:9px 11px;border-bottom:1px solid var(--line);white-space:nowrap}
    .st-tbl td{padding:9px 11px;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
    .st-tbl tr:last-child td{border-bottom:0}
    .st-tbl tr.click{cursor:pointer} .st-tbl tr.click:hover td{background:var(--panel-2)}
    .st-bad{color:var(--red);font-weight:750} .st-good{color:var(--brand);font-weight:700}
    .st-flag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.03em;border:1px solid;border-radius:999px;padding:1px 8px;margin-right:4px}
    .st-flag.r{color:var(--red);border-color:var(--red)} .st-flag.a{color:var(--amber);border-color:var(--amber)}
    .st-flag.b{color:var(--blue);border-color:var(--blue)} .st-flag.p{color:var(--purple);border-color:var(--purple)}
    .st-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .st-bar input[type=text]{background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:13.5px;padding:8px 12px;min-width:220px;outline:0}
    .st-bar select{background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:13px;padding:8px 10px;outline:0}
    .st-chip{appearance:none;border:1px solid var(--line);background:var(--panel);border-radius:999px;color:var(--muted);font:inherit;font-size:12.5px;font-weight:650;padding:6px 13px;cursor:pointer}
    .st-chip.on{color:var(--brand);border-color:var(--brand);background:var(--brand-glow)}
    .st-seg{display:inline-flex;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}
    .st-seg button{appearance:none;border:0;background:var(--panel);color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;padding:8px 14px;cursor:pointer}
    .st-seg button.on{background:var(--brand);color:var(--brand-ink)}
    .st-pg{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px;font-size:13px;color:var(--muted)}
    .st-pg button{border:1px solid var(--line);background:var(--panel);border-radius:8px;color:var(--ink);padding:5px 12px;cursor:pointer}
    .st-pg button:disabled{opacity:.4;cursor:default}
    /* drawer — BIG (v3) */
    .st-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:70;opacity:0;pointer-events:none;transition:opacity .15s}
    .st-scrim.on{opacity:1;pointer-events:auto}
    .st-drawer{position:fixed;top:0;right:-1160px;bottom:0;width:min(1120px,97vw);background:var(--bg);border-left:1px solid var(--line);z-index:71;transition:right .18s;display:flex;flex-direction:column;box-shadow:-14px 0 40px rgba(0,0,0,.4)}
    .st-drawer.on{right:0}
    .st-dh{padding:18px 24px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
    .st-dh .t{font-size:19px;font-weight:800;color:var(--ink);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .st-dh .s{font-size:13px;color:var(--muted);margin-top:5px;line-height:1.55}
    .st-dx{position:absolute;top:14px;right:16px;border:0;background:none;color:var(--muted);font-size:22px;cursor:pointer}
    .st-db{overflow:auto;padding:18px 24px;flex:1}
    .st-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
    @media(max-width:900px){.st-cols{grid-template-columns:1fr}}
    .st-sec{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 9px}
    .st-fin{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:9px}
    .st-fin .c{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px}
    .st-fin .l{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .st-fin .v{font-size:16px;font-weight:780;color:var(--ink);margin-top:4px;font-variant-numeric:tabular-nums}
    .st-fin .v.small{font-size:12.5px}
    .st-est{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 15px;margin-bottom:4px;font-size:15px;color:var(--ink)}
    .st-est b{font-size:18px}
    .st-tl{position:relative;margin-left:9px;border-left:2px solid var(--line);padding:2px 0 2px 17px}
    .st-ev{position:relative;margin-bottom:12px}
    .st-ev::before{content:"";position:absolute;left:-23.5px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--faint)}
    .st-ev.call_out::before{background:var(--blue)} .st-ev.call_in::before{background:var(--purple)}
    .st-ev.sms_out::before,.st-ev.sms_in::before{background:var(--amber)}
    .st-ev.confirmed::before{background:var(--brand)} .st-ev.closing::before{background:var(--brand)}
    .st-ev.refund::before{background:var(--red)} .st-ev.lead_created::before{background:var(--ink)}
    .st-ev .h{font-size:13.5px;color:var(--ink)} .st-ev .h b{font-weight:750}
    .st-ev .m{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.5}
    .st-all{margin-top:8px}
    .st-all summary{font-size:12px;font-weight:700;color:var(--blue);cursor:pointer;padding:4px 0}
    .st-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:5px 14px;font-size:12px}
    .st-kv div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--line);padding:3px 0}
    .st-kv span:first-child{color:var(--muted)} .st-kv span:last-child{color:var(--ink);font-weight:650;text-align:right;overflow:hidden;text-overflow:ellipsis}
    .st-set{position:relative}
    .st-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:60;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);padding:12px 14px;min-width:250px}
    .st-pop label{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-bottom:8px}
    .st-pop input{width:64px;background:var(--bg);border:1px solid var(--line);border-radius:7px;color:var(--ink);font:inherit;padding:4px 7px}
    .st-note{font-size:12px;color:var(--faint);margin-top:8px;line-height:1.5}`;
    document.head.appendChild(st);
  }

  const EV_LABEL = { lead_created: "Lead created", call_out: "Outbound call", call_in: "Incoming call",
    sms_out: "Text sent", sms_in: "Text received", confirmed: "Confirmed", closing: "Job closed",
    refund: "Refund" };

  /* ---------------- Lead File drawer (BIG) ---------------- */
  let drawerEl = null;
  function openDrawer(jk) {
    if (!drawerEl) {
      drawerEl = document.createElement("div");
      drawerEl.innerHTML = `<div class="st-scrim"></div>
        <div class="st-drawer"><button class="st-dx">✕</button>
          <div class="st-dh"><div class="t" id="stDT">Lead</div><div class="s" id="stDS"></div></div>
          <div class="st-db" id="stDB"></div></div>`;
      document.body.appendChild(drawerEl);
      const close = () => { drawerEl.querySelector(".st-scrim").classList.remove("on"); drawerEl.querySelector(".st-drawer").classList.remove("on"); };
      drawerEl.querySelector(".st-scrim").onclick = close;
      drawerEl.querySelector(".st-dx").onclick = close;
    }
    drawerEl.querySelector(".st-scrim").classList.add("on");
    drawerEl.querySelector(".st-drawer").classList.add("on");
    drawerEl.querySelector("#stDT").textContent = "Loading…";
    drawerEl.querySelector("#stDS").textContent = "";
    drawerEl.querySelector("#stDB").innerHTML = `<div class="rs-loading" style="padding:24px">Loading the lead file…</div>`;
    fetch(ZTZ.API + "/api/_leadfile?jk=" + encodeURIComponent(jk),
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(r => r.json()).then(d => {
        if (d && d.error) throw new Error(d.error);
        if (!d || !d.journey) throw new Error("lead not found in the journey mart");
        paintDrawer(d);
      })
      .catch(e => { drawerEl.querySelector("#stDB").innerHTML = `<div class="st-card">Couldn't load this lead: ${esc(e.message)}</div>`; });
  }

  const finCard = (l, v, small) =>
    `<div class="c"><div class="l">${l}</div><div class="v${small ? " small" : ""}">${v}</div></div>`;

  function closingSection(cl) {
    if (!cl) return `<div class="st-sec">Closing sheet</div>
      <div class="st-note" style="margin:0 0 6px">No closing sheet filed for this lead yet.</div>`;
    const g = k => cl[k];
    const m = k => money0(num(cl[k]));
    const helpers = [];
    for (let i = 1; i <= 7; i++) {
      if (g("H " + i)) helpers.push(esc(g("H " + i)));
    }
    const main = `<div class="st-fin">
      ${finCard("Move date", esc((g("Date") || "—").slice(0, 10)))}
      ${finCard("Foreman", esc(g("Foreman") || g("Forman") || "—"), true)}
      ${finCard("Job status", esc(g("Job Status") || "—"), true)}
      ${finCard("Total bill", "<b>" + m("Total Bill") + "</b>")}
      ${finCard("Net cash", m("Net Cash"))}
      ${finCard("Deposit", m("Deposit"))}
      ${finCard("Card payment", m("Card Payment"))}
      ${finCard("Balance due", m("Balance Due"))}
      ${finCard("Materials", m("Material Total"))}
      ${finCard("Storage", esc(g("Storage") || "—"), true)}
      ${finCard("Foreman total $", m("Forman Total $"))}
      ${finCard("Total expense", m("Total Expense"))}
      ${finCard("Profit per job", m("Profit per Job"))}
      ${finCard("Sales person", esc(g("Sales Person") || "—"), true)}
      ${finCard("Crew size", esc(g("Crew Size") || "—"))}
      ${finCard("Driver", esc(g("Driver") || "—"), true)}
      ${helpers.length ? finCard("Helpers", helpers.join(", "), true) : ""}
    </div>`;
    const rest = Object.keys(cl).filter(k =>
      cl[k] != null && String(cl[k]).trim() !== "" &&
      !["File Path", "Update Date", "File Name"].includes(k)).sort();
    const all = `<details class="st-all"><summary>All closing-sheet fields (${rest.length})</summary>
      <div class="st-kv" style="margin-top:8px">` +
      rest.map(k => `<div><span>${esc(k)}</span><span>${esc(String(cl[k]).slice(0, 60))}</span></div>`).join("") +
      `</div></details>`;
    return `<div class="st-sec">Closing sheet</div>` + main + all;
  }

  function paintDrawer(d) {
    const j = d.journey || {}, ev = d.events || [];
    const flags = [];
    if (+j["Flag Never Called"]) flags.push(`<span class="st-flag r">NO CONTACT</span>`);
    if (+j["Flag Slow First Call"]) flags.push(`<span class="st-flag a">SLOW FIRST CALL</span>`);
    if (+j["Flag Big Quote Gap"]) flags.push(`<span class="st-flag p">QUOTE GAP</span>`);
    if (+j["Flag Confirmed No Closing"]) flags.push(`<span class="st-flag r">NO CLOSING</span>`);
    if (+j["Is LD"]) flags.push(`<span class="st-flag b">LONG DISTANCE</span>`);
    drawerEl.querySelector("#stDT").innerHTML =
      `${esc(j["Customer"] || "Lead")} <span style="color:var(--faint);font-weight:600;font-size:14px">#${esc(j["Job No"] || "")}</span> ${flags.join("")}`;
    drawerEl.querySelector("#stDS").innerHTML =
      `${esc(j["Company"] || "")} · ${esc(j["Source"] || "no source")} · assigned to <b>${esc(j["Assigned"] || "—")}</b>` +
      ` · created ${esc((j["Create Datetime"] || "").slice(0, 16))} · status <b>${esc(j["Status"] || "—")}</b>` +
      (j["Flag"] ? ` · flag: <b>${esc(j["Flag"])}</b>` : "") + (j["Label"] ? ` · label: <b>${esc(j["Label"])}</b>` : "");

    const est = `<div class="st-sec">Estimate → actual</div>
      <div class="st-est">${estActual(j)}
        <span style="color:var(--faint);font-size:12px;margin-left:8px">quote range ${money0(num(j["Min Quote"]))} – ${money0(num(j["Max Quote"]))} · ${j["Total CF"] != null ? RS.fmtN(Math.round(+j["Total CF"])) + " CF" : "no CF"}</span></div>`;

    const fin = `<div class="st-sec">Money summary</div><div class="st-fin">
      ${finCard("Net cash", money0(num(j["Net Cash"])))}
      ${finCard("Materials (upsell)", money0(num(j["Material Total"])))}
      ${finCard("Refunded", j["Refund Total"] != null ? money0(+j["Refund Total"]) : "—")}
      ${finCard("Sales people", esc(j["Sales People"] || j["Sales Person"] || "—"), true)}
      ${finCard("Review", j["Review Score"] != null ? (+j["Review Score"]).toFixed(1) + "★" : "—")}
      ${finCard("Claims", j["Claims N"] || "—")}
    </div>`;

    const resp = `<div class="st-sec">Response</div><div class="st-fin">
      ${finCard("First contact", (+j["Called"] ? (j["TTO Biz Min"] != null ? mins(+j["TTO Biz Min"]) + " (biz)" : "called")
                   : (isContacted(j) ? "answered incoming" : "<span class='st-bad'>none</span>")))}
      ${finCard("Calls out / in", (+j["Out Calls"] || 0) + " / " + (+j["In Calls"] || 0))}
      ${finCard("Answered incoming", (+j["Answered In"] || 0))}
      ${finCard("Texts out / in", (+j["Sms Out"] || 0) + " / " + (+j["Sms In"] || 0))}
      ${finCard("Talk time (out)", secH(j["Talk Sec Out"]))}
      ${finCard("Dialers", esc(j["Dialers"] || "—"), true)}
      ${finCard("Last touch", esc((j["Last Touch At"] || "—").slice(0, 16)), true)}
    </div>`;

    const aftermath = (d.refunds || []).length || (d.claims || []).length || (d.reviews || []).length
      ? `<div class="st-sec">Aftermath</div>
        ${(d.refunds || []).map(r => `<div class="st-ev refund" style="margin-left:9px"><div class="h"><b>Refund</b> ${money0(num(r["Total refund"]))} · ${esc((r["Refund Date"] || "").slice(0, 10))}</div><div class="m">${esc(r["Reason"] || "")}</div></div>`).join("")}
        ${(d.claims || []).map(c => `<div class="st-ev refund" style="margin-left:9px"><div class="h"><b>Claim</b> · ${esc((c["Date"] || c["Claim Date"] || "").toString().slice(0, 10))}</div><div class="m">${esc(c["Reason"] || c["Responsibility"] || "")}</div></div>`).join("")}
        ${(d.reviews || []).map(r => `<div class="st-ev confirmed" style="margin-left:9px"><div class="h"><b>Review</b> ${r["Review Score"] != null ? esc(String(r["Review Score"])) + "★" : ""} · ${esc(r["Source"] || "")}</div></div>`).join("")}`
      : "";

    const tl = `<div class="st-sec">Timeline · ${ev.length} events</div><div class="st-tl">` +
      ev.map(e => {
        const t = (e["Event At"] || "").slice(0, 16);
        const kind = e["Event Type"];
        const dur = e["Duration Sec"] != null ? ` · ${secH(e["Duration Sec"])}` : "";
        const amt = e["Amount"] != null ? ` · ${money0(+e["Amount"])}` : "";
        return `<div class="st-ev ${esc(kind)}">
          <div class="h"><b>${esc(EV_LABEL[kind] || kind)}</b>${e["Actor"] ? " — " + esc(e["Actor"]) : ""}<span style="color:var(--faint)"> · ${esc(t)}${dur}${amt}</span></div>
          ${e["Detail"] ? `<div class="m">${esc(e["Detail"])}</div>` : ""}</div>`;
      }).join("") + `</div>`;

    drawerEl.querySelector("#stDB").innerHTML =
      `<div class="st-cols"><div>` + est + fin + resp + closingSection(d.closing) + aftermath +
      `</div><div>` + tl + `</div></div>`;
  }

  /* ---------------- per-person aggregation ---------------- */
  function personStats(rows, confRows, th) {
    const by = {};
    const add = (name, fn) => {
      const k = (name || "Unassigned").trim() || "Unassigned";
      if (EXCLUDE_SP.has(k.toLowerCase())) return;
      (by[k] = by[k] || { name: k, leads: 0, qual: 0, dead: 0, conf: 0, confEv: 0,
        contacted: 0, tto: [], out: 0, talk: 0, rev: 0, closed: 0, gaps: [] }).x = 1;
      fn(by[k]);
    };
    rows.forEach(r => add(r["Assigned"], p => {
      p.leads++;
      if (isQual(r)) p.qual++;
      if (isDead(r)) p.dead++;
      if (isConf(r)) p.conf++;
      if (isContacted(r)) p.contacted++;
      if (r["TTO Biz Min"] != null) p.tto.push(+r["TTO Biz Min"]);
      p.out += +r["Out Calls"] || 0;
      p.talk += +r["Talk Sec Out"] || 0;
      if (r["Total Bill"] != null) { p.rev += +r["Total Bill"]; p.closed++; }
      if (r["Bill Vs Quote Pct"] != null) p.gaps.push(+r["Bill Vs Quote Pct"]);
    }));
    confRows.forEach(r => add(r["Assigned"], p => { p.confEv++; }));
    const list = Object.values(by);
    list.forEach(p => {
      p.deadPct = p.leads ? 100 * p.dead / p.leads : null;
      p.convPct = p.qual ? Math.min(100, 100 * p.conf / p.qual) : null;    // canonical: conf/QUALIFIED
      p.noContactPct = p.leads ? 100 * (p.leads - p.contacted) / p.leads : null;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
      p.avgGap = p.gaps.length ? p.gaps.reduce((a, b) => a + b, 0) / p.gaps.length : null;
    });
    const ranked = list.filter(p => p.leads >= th.minLeads && p.name !== "Unassigned");
    const mx = {
      conv: Math.max(1e-9, ...ranked.map(p => p.convPct || 0)),
      rev: Math.max(1e-9, ...ranked.map(p => p.revLead || 0)),
    };
    list.forEach(p => {
      if (p.leads < th.minLeads || p.name === "Unassigned") { p.score = null; return; }
      const sConv = (p.convPct || 0) / mx.conv;
      const sSpeed = p.medTto == null ? 0 : Math.max(0, 1 - Math.min(p.medTto, 120) / 120);
      const sRev = (p.revLead || 0) / mx.rev;
      p.score = Math.round(100 * (0.5 * sConv + 0.3 * sSpeed + 0.2 * sRev));
    });
    list.sort((a, b) => ((b.score != null ? b.score : -1) - (a.score != null ? a.score : -1)) || b.leads - a.leads);
    return list;
  }

  /* ---------------- Team tab ---------------- */
  async function renderTeam(host, ctx) {
    const th = thGet();
    const rows = ctx.rows, confRows = ctx.confRows;
    const nQual = rows.filter(isQual).length;
    const nDead = rows.filter(isDead).length;
    const brate = RS.bookingRate(rows, confRows);
    const teamAvgConv = nQual ? 100 * rows.filter(isConf).length / nQual : 0;
    const kpi = (l, v, s) => `<div class="st-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const medAll = median(rows.map(r => r["TTO Biz Min"]).filter(v => v != null).map(Number));
    const noContact = rows.length ? 100 * rows.filter(r => !isContacted(r)).length / rows.length : 0;
    const rev = rows.reduce((a, r) => a + (+r["Total Bill"] || 0), 0);
    const dense = ctx.dense || "detail";

    const people = personStats(rows, confRows, th);
    const flagCell = p => {
      const f = [];
      if (p.noContactPct != null && p.noContactPct > th.neverPct) f.push(`<span class="st-flag r">${Math.round(p.noContactPct)}% NO CONTACT</span>`);
      if (p.medTto != null && p.medTto > th.slowMin) f.push(`<span class="st-flag a">SLOW ${mins(p.medTto)}</span>`);
      if (p.convPct != null && teamAvgConv && p.convPct < th.convFrac * teamAvgConv) f.push(`<span class="st-flag p">LOW CONV</span>`);
      return f.join("") || `<span class="st-good">✓</span>`;
    };

    const DETAIL_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th><th>Dead %</th>
      <th>Confirmed</th><th>Booking %</th><th>Confirms in period</th><th>Median 1st call</th>
      <th>No contact</th><th>Calls</th><th>Talk</th><th>Revenue</th><th>$ / lead</th><th>Δ est→act</th><th>Flags</th>`;
    const COMPACT_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th>
      <th>Confirmed</th><th>Booking %</th><th>No contact</th><th>Revenue</th><th>Flags</th>`;
    const drow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td>
      <td>${p.deadPct != null ? pct1(p.deadPct) : "—"}</td>
      <td>${RS.fmtN(p.conf)}</td>
      <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
      <td>${RS.fmtN(p.confEv)}</td>
      <td>${p.medTto != null ? mins(p.medTto) : "—"}</td>
      <td class="${p.noContactPct > th.neverPct ? "st-bad" : ""}">${p.noContactPct != null ? pct1(p.noContactPct) : "—"}</td>
      <td>${RS.fmtN(p.out)}</td><td>${secH(p.talk)}</td>
      <td>${money0(p.rev)}</td><td>${money0(p.revLead)}</td>
      <td>${p.avgGap != null ? (p.avgGap > 0 ? "+" : "") + pct1(p.avgGap) : "—"}</td>
      <td>${flagCell(p)}</td></tr>`;
    const crow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td><td>${RS.fmtN(p.conf)}</td>
      <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
      <td class="${p.noContactPct > th.neverPct ? "st-bad" : ""}">${p.noContactPct != null ? pct1(p.noContactPct) : "—"}</td>
      <td>${money0(p.rev)}</td><td>${flagCell(p)}</td></tr>`;

    host.innerHTML = `
      <div class="st-kpis">
        ${kpi("Leads received", RS.fmtN(rows.length), "created in the selected period")}
        ${kpi("Qualified", RS.fmtN(nQual), pct1(rows.length ? 100 * nQual / rows.length : null) + " of received")}
        ${kpi("Dead leads", RS.fmtN(nDead), pct1(rows.length ? 100 * nDead / rows.length : null) + " of received")}
        ${kpi("Confirmed (in period)", RS.fmtN(confRows.length), "by their confirmed date")}
        ${kpi("Booking rate", brate != null ? pct1(100 * brate) : "—", "confirmed ÷ qualified (canonical)")}
        ${kpi("Median first call", medAll != null ? mins(medAll) : "—", "business minutes")}
        ${kpi("No contact", pct1(noContact), "no call made or answered")}
        ${kpi("Revenue (closed)", money0(rev), "billed on these leads")}
      </div>
      <div class="st-card">
        <div class="st-bar" style="margin-bottom:10px">
          <b style="color:var(--ink);font-size:15px">People · ${people.length}</b>
          <div class="st-seg"><button data-d="detail" class="${dense === "detail" ? "on" : ""}">Details</button><button data-d="compact" class="${dense === "compact" ? "on" : ""}">Compact</button></div>
          <span style="flex:1"></span>
          <div class="st-set"><button class="st-chip" id="stTh">⚙ Thresholds</button>
            <div class="st-pop hidden" id="stThPop">
              <label>Slow first call, min <input type="number" id="thSlow" value="${th.slowMin}"></label>
              <label>No-contact alert, % <input type="number" id="thNever" value="${th.neverPct}"></label>
              <label>Low conversion, × team avg <input type="number" step="0.1" id="thConv" value="${th.convFrac}"></label>
              <label>Min leads to rank <input type="number" id="thMin" value="${th.minLeads}"></label>
              <div class="st-note">Saved on this device. Score = 50% booking · 30% speed · 20% revenue per lead.</div>
            </div></div>
        </div>
        <div style="overflow-x:auto"><table class="st-tbl"><thead><tr>${dense === "compact" ? COMPACT_COLS : DETAIL_COLS}</tr></thead>
        <tbody>${people.map(dense === "compact" ? crow : drow).join("")}</tbody></table></div>
        <div class="st-note">Click a person to open their leads in the Explorer. Booking % = confirmed ÷ qualified (the portal's canonical formula); "Confirms in period" counts by confirmed date; other columns follow the lead's created date. Branch owner excluded. Call data currently ends at the newest RingCentral export.</div>
      </div>`;

    host.querySelectorAll(".st-seg button").forEach(b => b.onclick = () => { ctx.dense = b.dataset.d; renderTeam(host, ctx); });
    const pop = host.querySelector("#stThPop");
    host.querySelector("#stTh").onclick = e => { e.stopPropagation(); pop.classList.toggle("hidden"); };
    pop.onclick = e => e.stopPropagation();
    document.addEventListener("click", () => pop.classList.add("hidden"), { once: true });
    ["thSlow", "thNever", "thConv", "thMin"].forEach(id => {
      host.querySelector("#" + id).onchange = () => {
        thSet({ slowMin: +host.querySelector("#thSlow").value || 30,
                neverPct: +host.querySelector("#thNever").value || 10,
                convFrac: +host.querySelector("#thConv").value || 0.5,
                minLeads: +host.querySelector("#thMin").value || 5 });
        renderTeam(host, ctx);
      };
    });
    host.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => {
      ctx.explorerPreset = { sp: tr.dataset.sp };
      ctx.go("explorer");
    });
  }

  /* ---------------- Lead Explorer tab ---------------- */
  function renderExplorer(host, ctx) {
    const state = { q: "", sp: (ctx.explorerPreset && ctx.explorerPreset.sp) || "", chip: "",
      sort: "new", page: 0, src: "", stat: "", called: "", type: "", bucket: "" };
    ctx.explorerPreset = null;
    const PAGE = 100;
    const uniq = col => {
      const cnt = {};
      ctx.rows.forEach(r => { const v = (r[col] || "").toString().trim(); if (v) cnt[v] = (cnt[v] || 0) + 1; });
      return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    };
    const sps = [...new Set(ctx.rows.map(r => (r["Assigned"] || "").trim()).filter(Boolean))].sort();
    const sources = uniq("Source").slice(0, 40);
    const stats = uniq("Status Category");
    const buckets = ["<= 5 min", "5-15 min", "15-30 min", "30-60 min", "> 1 hour", "Not called"];

    const CHIPS = [
      ["important", "★ Important"], ["nocontact", "No contact"], ["slow", "Slow first call"],
      ["gap", "Quote gap"], ["noclose", "Confirmed, no closing"], ["dead", "Dead leads"],
    ];
    const sel = (id, label, opts, cur) =>
      `<select id="${id}"><option value="">${label}</option>` +
      opts.map(o => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("") + `</select>`;
    host.innerHTML = `
      <div class="st-bar">
        <input type="text" id="stQ" placeholder="Search customer / # / source…">
        ${sel("stSp", "All salespeople", sps, state.sp)}
        ${sel("stSrc", "All sources", sources, "")}
        ${sel("stStat", "All statuses", stats, "")}
        <select id="stCalled"><option value="">Contact — any</option>
          <option value="y">Contacted</option><option value="n">No contact</option>
          <option value="c">Connected out</option></select>
        <select id="stType"><option value="">LD + local</option>
          <option value="ld">Long distance</option><option value="loc">Local</option></select>
        ${sel("stBucket", "Any speed", buckets, "")}
        <span style="flex:1"></span>
        <select id="stSort">
          <option value="new">Newest first</option><option value="slow">Slowest first call</option>
          <option value="bill">Biggest bill</option><option value="gap">Biggest quote gap</option>
          <option value="cf">Biggest CF</option><option value="calls">Most calls</option>
          <option value="talk">Most talk time</option>
        </select>
      </div>
      <div class="st-bar" style="margin-top:-4px">
        ${CHIPS.map(([k, l]) => `<button class="st-chip" data-c="${k}">${l}</button>`).join("")}
      </div>
      <div class="st-card" style="padding:0 8px"><div style="overflow-x:auto" id="stTblWrap"></div>
      <div class="st-pg" id="stPg"></div></div>`;

    const apply = () => {
      let rows = ctx.rows;
      if (state.sp) rows = rows.filter(r => (r["Assigned"] || "").trim() === state.sp);
      if (state.src) rows = rows.filter(r => (r["Source"] || "").trim() === state.src);
      if (state.stat) rows = rows.filter(r => (r["Status Category"] || "").trim() === state.stat);
      if (state.called === "y") rows = rows.filter(isContacted);
      if (state.called === "n") rows = rows.filter(r => !isContacted(r));
      if (state.called === "c") rows = rows.filter(r => +r["Connected"]);
      if (state.type === "ld") rows = rows.filter(r => +r["Is LD"]);
      if (state.type === "loc") rows = rows.filter(r => !+r["Is LD"]);
      if (state.bucket) rows = rows.filter(r => (r["Speed Bucket"] || "") === state.bucket);
      if (state.q) {
        const q = state.q.toLowerCase();
        rows = rows.filter(r => String(r["Customer"] || "").toLowerCase().includes(q)
          || String(r["Job No"] || "").toLowerCase().includes(q)
          || String(r["Source"] || "").toLowerCase().includes(q));
      }
      if (state.chip === "important") rows = rows.filter(r => +r["Is LD"] || (num(r["Total CF"]) || 0) >= 700 || (num(r["Avg Quote"]) || 0) >= 4000);
      if (state.chip === "nocontact") rows = rows.filter(r => !isContacted(r));
      if (state.chip === "slow") rows = rows.filter(r => +r["Flag Slow First Call"]);
      if (state.chip === "gap") rows = rows.filter(r => +r["Flag Big Quote Gap"]);
      if (state.chip === "noclose") rows = rows.filter(r => +r["Flag Confirmed No Closing"]);
      if (state.chip === "dead") rows = rows.filter(isDead);
      const key = { new: r => r["Create Date"] || "", slow: r => (r["TTO Biz Min"] != null ? +r["TTO Biz Min"] : -1),
        bill: r => +(r["Total Bill"] || 0), gap: r => Math.abs(+(r["Bill Vs Quote Pct"] || 0)),
        cf: r => +(r["Total CF"] || 0),
        calls: r => (+r["Out Calls"] || 0) + (+r["In Calls"] || 0),
        talk: r => +(r["Talk Sec Out"] || 0) }[state.sort];
      rows = rows.slice().sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
      return rows;
    };

    const paint = () => {
      const rows = apply();
      const start = state.page * PAGE;
      const pg = rows.slice(start, start + PAGE);
      const flagIcons = r => {
        const f = [];
        if (!isContacted(r)) f.push(`<span class="st-flag r">✕ contact</span>`);
        else if (+r["Flag Slow First Call"]) f.push(`<span class="st-flag a">slow</span>`);
        if (+r["Flag Big Quote Gap"]) f.push(`<span class="st-flag p">gap</span>`);
        if (+r["Flag Confirmed No Closing"]) f.push(`<span class="st-flag r">no closing</span>`);
        if (+r["Is LD"]) f.push(`<span class="st-flag b">LD</span>`);
        if (r["Flag"]) f.push(`<span class="st-flag b">${esc(r["Flag"])}</span>`);
        return f.join("");
      };
      host.querySelector("#stTblWrap").innerHTML = `<table class="st-tbl"><thead><tr>
        <th>Created</th><th>#</th><th>Customer</th><th>Source</th><th>Assigned</th><th>CF</th>
        <th>Status</th><th>Contact</th><th>Calls</th><th>Texts</th>
        <th>Estimate → actual</th><th>Flags</th></tr></thead><tbody>` +
        pg.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"])}">
          <td>${esc((r["Create Date"] || "").slice(0, 10))}</td>
          <td>${esc(r["Job No"] || "—")}</td>
          <td><b>${esc(r["Customer"] || "—")}</b></td>
          <td>${esc(r["Source"] || "—")}</td>
          <td>${esc(r["Assigned"] || "—")}</td>
          <td>${r["Total CF"] != null ? RS.fmtN(Math.round(+r["Total CF"])) : "—"}</td>
          <td>${esc(r["Status Category"] || r["Status"] || "—")}</td>
          <td>${contactCell(r)}</td>
          <td>${(+r["Out Calls"] || 0) + (+r["In Calls"] || 0)}</td>
          <td>${(+r["Sms Out"] || 0) + (+r["Sms In"] || 0)}</td>
          <td>${estActual(r)}</td>
          <td>${flagIcons(r)}</td></tr>`).join("") +
        `</tbody></table>`;
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      host.querySelector("#stPg").innerHTML =
        `<span>${RS.fmtN(rows.length)} leads</span>
         <button id="stPrev" ${state.page ? "" : "disabled"}>‹ Prev</button>
         <span>page ${state.page + 1} / ${pages}</span>
         <button id="stNext" ${state.page + 1 < pages ? "" : "disabled"}>Next ›</button>`;
      host.querySelector("#stPrev").onclick = () => { state.page--; paint(); };
      host.querySelector("#stNext").onclick = () => { state.page++; paint(); };
      host.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => openDrawer(tr.dataset.jk));
    };

    host.querySelector("#stQ").oninput = e => { state.q = e.target.value; state.page = 0; paint(); };
    [["stSp", "sp"], ["stSrc", "src"], ["stStat", "stat"], ["stCalled", "called"],
     ["stType", "type"], ["stBucket", "bucket"], ["stSort", "sort"]].forEach(([id, k]) => {
      host.querySelector("#" + id).onchange = e => { state[k] = e.target.value; state.page = 0; paint(); };
    });
    paint();
  }

  /* ---------------- page ---------------- */
  registerPage({
    id: "sales-command",     // NOT "sales-team" — that id is a RETIRED legacy page (old Monthly Review)
    group: "sales",
    title: "Sales Team Command",
    async render(host) {
      injectStyle();
      host.innerHTML = `
        <div class="rs-page-head"><h1>Sales Team Command</h1>
          <p>Every lead's full story — calls, texts, routing, and the money it became.
          <span class="freshness">· leads count by created date · confirmations by confirmed date</span></p></div>
        <div class="st-tabbar" id="stTabs"></div><div id="stHost"></div>`;
      const TABS = [["team", "Team"], ["explorer", "Lead Explorer"]];
      const tabsEl = host.querySelector("#stTabs");
      const hostEl = host.querySelector("#stHost");
      let active = "team";

      const ctx = { rows: [], confRows: [], explorerPreset: null, dense: "detail", go: k => go(k) };

      const paintTabs = () => {
        tabsEl.innerHTML = TABS.map(([k, l]) => `<button class="st-tab ${k === active ? "on" : ""}" data-k="${k}">${l}</button>`).join("");
        tabsEl.querySelectorAll(".st-tab").forEach(b => b.onclick = () => go(b.dataset.k));
      };
      const go = async k => {
        active = k; paintTabs();
        hostEl.innerHTML = `<div class="rs-loading" style="padding:22px">Loading…</div>`;
        const all = await RS.load("lead_journey");
        ctx.rows = RS.filtered("lead_journey", all);
        // only REAL confirmed dates count (mart stores Booked Date only for confirmed leads)
        ctx.confRows = RS.filtered("lead_journey",
          all.filter(r => /^\d{4}-\d{2}-\d{2}/.test(String(r["Booked Date"] || ""))),
          { dateColumn: "Booked Date" });
        if (k === "team") return renderTeam(hostEl, ctx);
        return renderExplorer(hostEl, ctx);
      };
      paintTabs();
      await go("team");
    },
  });
})();
