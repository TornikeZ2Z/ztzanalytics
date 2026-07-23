/* Sales Team Command — the sales LEAD's lead-360 report (report id: sales-team).
   Audience: the sales lead only (granted individually / admins); NOT in the sales dept bundle.

   Tabs:
     Team          per-person table on fct_lead_journey (composite score, red flags,
                   adjustable thresholds) + the dual-axis KPI band
     Lead Explorer every lead row; click -> the Lead File drawer (/api/_leadfile):
                   full call/SMS/routing timeline + the financial translation
     Speed/Inflow  the existing standalone pages rendered as tabs (they also remain
                   standalone for the sales department)

   DATE MODEL (Tornike 2026-07-23): leads count in their CREATED month; confirmations
   count in their CONFIRMED (Booked Date) month. Conversion % = of the scoped leads,
   share now confirmed (cohort-to-date). Global filter bar fully applies (company,
   dates, CF range, lead status, source, salesperson...).

   Giorgi Kolbaia (branch owner) is excluded from the per-person table by standing rule. */

(() => {
  const EXCLUDE_SP = new Set(["giorgi kolbaia"]);
  const TH_KEY = "st_thresholds_v1";
  const thDefaults = { slowMin: 30, neverPct: 10, convFrac: 0.5, minLeads: 5 };
  const thGet = () => { try { return { ...thDefaults, ...(JSON.parse(localStorage.getItem(TH_KEY)) || {}) }; } catch (e) { return { ...thDefaults }; } };
  const thSet = t => { try { localStorage.setItem(TH_KEY, JSON.stringify(t)); } catch (e) {} };

  const esc = s => RSC.esc(s == null ? "" : String(s));
  const num = v => (v == null || v === "" ? null : +v);
  const money0 = v => (v == null ? "—" : RS.money(+v));
  const pct1 = v => (v == null ? "—" : (Math.round(v * 10) / 10) + "%");
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
  const isConf = r => String(r["Status Category"] || "").trim().toLowerCase() === "confirmed";

  function injectStyle() {
    if (document.getElementById("st-style")) return;
    const st = document.createElement("style");
    st.id = "st-style";
    st.textContent = `
    .st-tabbar{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:4px 2px 16px;padding-left:2px}
    .st-tab{appearance:none;border:0;background:none;font-family:inherit;font-size:14px;font-weight:650;color:var(--muted);padding:9px 14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px}
    .st-tab:hover{color:var(--ink)} .st-tab.on{color:var(--brand);border-bottom-color:var(--brand)}
    .st-kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:10px;margin-bottom:14px}
    @media(max-width:1100px){.st-kpis{grid-template-columns:repeat(3,1fr)}}
    .st-kpi{background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:12px 14px;box-shadow:var(--shadow)}
    .st-kpi .l{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
    .st-kpi .v{font-size:21px;font-weight:820;color:var(--ink);margin-top:5px;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
    .st-kpi .s{font-size:11px;color:var(--faint);margin-top:2px}
    .st-card{background:var(--panel);border:1px solid var(--line);border-radius:13px;box-shadow:var(--shadow);padding:14px 16px;margin-bottom:14px}
    .st-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
    .st-tbl th{text-align:left;color:var(--muted);font-weight:750;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding:7px 9px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:default}
    .st-tbl td{padding:7px 9px;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
    .st-tbl tr:last-child td{border-bottom:0}
    .st-tbl tr.click{cursor:pointer} .st-tbl tr.click:hover td{background:var(--panel-2)}
    .st-bad{color:var(--red);font-weight:750} .st-good{color:var(--brand);font-weight:700}
    .st-flag{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.03em;border:1px solid;border-radius:999px;padding:0 7px;margin-right:4px}
    .st-flag.r{color:var(--red);border-color:var(--red)} .st-flag.a{color:var(--amber);border-color:var(--amber)}
    .st-flag.b{color:var(--blue);border-color:var(--blue)} .st-flag.p{color:var(--purple);border-color:var(--purple)}
    .st-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .st-bar input[type=text]{background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:13px;padding:7px 11px;min-width:210px;outline:0}
    .st-bar select{background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);font:inherit;font-size:12.5px;padding:7px 9px;outline:0}
    .st-chip{appearance:none;border:1px solid var(--line);background:var(--panel);border-radius:999px;color:var(--muted);font:inherit;font-size:12px;font-weight:650;padding:5px 12px;cursor:pointer}
    .st-chip.on{color:var(--brand);border-color:var(--brand);background:var(--brand-glow)}
    .st-pg{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px;font-size:12.5px;color:var(--muted)}
    .st-pg button{border:1px solid var(--line);background:var(--panel);border-radius:8px;color:var(--ink);padding:4px 11px;cursor:pointer}
    .st-pg button:disabled{opacity:.4;cursor:default}
    /* drawer */
    .st-scrim{position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:70;opacity:0;pointer-events:none;transition:opacity .15s}
    .st-scrim.on{opacity:1;pointer-events:auto}
    .st-drawer{position:fixed;top:0;right:-720px;bottom:0;width:min(700px,94vw);background:var(--bg);border-left:1px solid var(--line);z-index:71;transition:right .18s;display:flex;flex-direction:column;box-shadow:-14px 0 40px rgba(0,0,0,.35)}
    .st-drawer.on{right:0}
    .st-dh{padding:16px 20px 12px;border-bottom:1px solid var(--line);background:var(--panel)}
    .st-dh .t{font-size:16px;font-weight:800;color:var(--ink);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .st-dh .s{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.5}
    .st-dx{position:absolute;top:12px;right:14px;border:0;background:none;color:var(--muted);font-size:20px;cursor:pointer}
    .st-db{overflow:auto;padding:16px 20px;flex:1}
    .st-sec{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
    .st-fin{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px}
    .st-fin .c{background:var(--panel);border:1px solid var(--line);border-radius:9px;padding:8px 11px}
    .st-fin .l{font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .st-fin .v{font-size:15px;font-weight:780;color:var(--ink);margin-top:3px;font-variant-numeric:tabular-nums}
    .st-tl{position:relative;margin-left:9px;border-left:2px solid var(--line);padding:2px 0 2px 16px}
    .st-ev{position:relative;margin-bottom:11px}
    .st-ev::before{content:"";position:absolute;left:-22.5px;top:4px;width:9px;height:9px;border-radius:50%;background:var(--faint)}
    .st-ev.call_out::before{background:var(--blue)} .st-ev.call_in::before{background:var(--purple)}
    .st-ev.sms_out::before,.st-ev.sms_in::before{background:var(--amber)}
    .st-ev.confirmed::before{background:var(--brand)} .st-ev.closing::before{background:var(--brand)}
    .st-ev.refund::before{background:var(--red)} .st-ev.lead_created::before{background:var(--ink)}
    .st-ev .h{font-size:12.5px;color:var(--ink)} .st-ev .h b{font-weight:750}
    .st-ev .m{font-size:11.5px;color:var(--muted);margin-top:1px;line-height:1.45}
    .st-set{position:relative}
    .st-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:60;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);padding:12px 14px;min-width:250px}
    .st-pop label{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-bottom:8px}
    .st-pop input{width:64px;background:var(--bg);border:1px solid var(--line);border-radius:7px;color:var(--ink);font:inherit;padding:4px 7px}
    .st-note{font-size:11.5px;color:var(--faint);margin-top:8px;line-height:1.5}`;
    document.head.appendChild(st);
  }

  const EV_LABEL = { lead_created: "Lead created", call_out: "Outbound call", call_in: "Incoming call",
    sms_out: "Text sent", sms_in: "Text received", confirmed: "Confirmed", closing: "Job closed",
    refund: "Refund" };

  /* ---------------- Lead File drawer ---------------- */
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
    drawerEl.querySelector("#stDB").innerHTML = `<div class="rs-loading" style="padding:22px">Loading the lead file…</div>`;
    fetch(ZTZ.API + "/api/_leadfile?jk=" + encodeURIComponent(jk),
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(r => r.json()).then(d => paintDrawer(d))
      .catch(e => { drawerEl.querySelector("#stDB").innerHTML = `<div class="st-card">Couldn't load: ${esc(e.message)}</div>`; });
  }

  function paintDrawer(d) {
    const j = d.journey || {}, ev = d.events || [];
    const flags = [];
    if (+j["Flag Never Called"]) flags.push(`<span class="st-flag r">NEVER CALLED</span>`);
    if (+j["Flag Slow First Call"]) flags.push(`<span class="st-flag a">SLOW FIRST CALL</span>`);
    if (+j["Flag Big Quote Gap"]) flags.push(`<span class="st-flag p">QUOTE GAP</span>`);
    if (+j["Flag Confirmed No Closing"]) flags.push(`<span class="st-flag r">NO CLOSING</span>`);
    if (+j["Is LD"]) flags.push(`<span class="st-flag b">LONG DISTANCE</span>`);
    drawerEl.querySelector("#stDT").innerHTML =
      `${esc(j["Customer"] || "Lead")} <span style="color:var(--faint);font-weight:600;font-size:13px">#${esc(j["Job No"] || "")}</span> ${flags.join("")}`;
    drawerEl.querySelector("#stDS").innerHTML =
      `${esc(j["Company"] || "")} · ${esc(j["Source"] || "no source")} · assigned to <b>${esc(j["Assigned"] || "—")}</b>` +
      ` · created ${esc((j["Create Datetime"] || "").slice(0, 16))} · status <b>${esc(j["Status"] || "—")}</b>` +
      (j["Flag"] ? ` · flag: <b>${esc(j["Flag"])}</b>` : "") + (j["Label"] ? ` · label: <b>${esc(j["Label"])}</b>` : "");

    const fin = `<div class="st-sec">Financial translation</div><div class="st-fin">
      <div class="c"><div class="l">Avg quote</div><div class="v">${money0(num(j["Avg Quote"]))}</div></div>
      <div class="c"><div class="l">Final bill</div><div class="v">${money0(num(j["Total Bill"]))}</div></div>
      <div class="c"><div class="l">Bill vs quote</div><div class="v">${j["Bill Vs Quote Pct"] != null ? pct1(+j["Bill Vs Quote Pct"]) : "—"}</div></div>
      <div class="c"><div class="l">Net cash</div><div class="v">${money0(num(j["Net Cash"]))}</div></div>
      <div class="c"><div class="l">Materials (upsell)</div><div class="v">${money0(num(j["Material Total"]))}</div></div>
      <div class="c"><div class="l">Refunded</div><div class="v">${j["Refund Total"] != null ? money0(+j["Refund Total"]) : "—"}</div></div>
      <div class="c"><div class="l">Sales people</div><div class="v" style="font-size:12px">${esc(j["Sales People"] || j["Sales Person"] || "—")}</div></div>
      <div class="c"><div class="l">Review</div><div class="v">${j["Review Score"] != null ? (+j["Review Score"]).toFixed(1) + "★" : "—"}${j["Claims N"] ? ` · ${j["Claims N"]} claim(s)` : ""}</div></div>
    </div>`;

    const resp = `<div class="st-sec">Response</div><div class="st-fin">
      <div class="c"><div class="l">First call</div><div class="v">${j["TTO Biz Min"] != null ? mins(+j["TTO Biz Min"]) + " (biz)" : (+j["Called"] ? "yes" : "never")}</div></div>
      <div class="c"><div class="l">Calls out / in</div><div class="v">${+j["Out Calls"] || 0} / ${+j["In Calls"] || 0}</div></div>
      <div class="c"><div class="l">Texts out / in</div><div class="v">${+j["Sms Out"] || 0} / ${+j["Sms In"] || 0}</div></div>
      <div class="c"><div class="l">Talk time (out)</div><div class="v">${secH(j["Talk Sec Out"])}</div></div>
      <div class="c"><div class="l">Dialers</div><div class="v" style="font-size:12px">${esc(j["Dialers"] || "—")}</div></div>
      <div class="c"><div class="l">Last touch</div><div class="v" style="font-size:12px">${esc((j["Last Touch At"] || "—").slice(0, 16))}</div></div>
    </div>`;

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

    drawerEl.querySelector("#stDB").innerHTML = fin + resp + tl;
  }

  /* ---------------- per-person aggregation ---------------- */
  function personStats(rows, confRows, th) {
    const by = {};
    const add = (name, fn) => {
      const k = (name || "Unassigned").trim() || "Unassigned";
      if (EXCLUDE_SP.has(k.toLowerCase())) return;
      (by[k] = by[k] || { name: k, leads: 0, conf: 0, confEv: 0, called: 0, tto: [], out: 0, talk: 0, rev: 0, closed: 0 }).x = 1;
      fn(by[k]);
    };
    rows.forEach(r => add(r["Assigned"], p => {
      p.leads++;
      if (isConf(r)) p.conf++;
      if (+r["Called"]) p.called++;
      if (r["TTO Biz Min"] != null) p.tto.push(+r["TTO Biz Min"]);
      p.out += +r["Out Calls"] || 0;
      p.talk += +r["Talk Sec Out"] || 0;
      if (r["Total Bill"] != null) { p.rev += +r["Total Bill"]; p.closed++; }
    }));
    confRows.forEach(r => add(r["Assigned"], p => { p.confEv++; }));
    const list = Object.values(by);
    list.forEach(p => {
      p.convPct = p.leads ? 100 * p.conf / p.leads : null;
      p.neverPct = p.leads ? 100 * (p.leads - p.called) / p.leads : null;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
    });
    const ranked = list.filter(p => p.leads >= th.minLeads);
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

  /* ---------------- tabs ---------------- */
  async function renderTeam(host, ctx) {
    const th = thGet();
    const rows = ctx.rows, confRows = ctx.confRows;
    const teamAvgConv = rows.length ? 100 * rows.filter(isConf).length / rows.length : 0;
    const kpi = (l, v, s) => `<div class="st-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const medAll = median(rows.map(r => r["TTO Biz Min"]).filter(v => v != null).map(Number));
    const never = rows.length ? 100 * rows.filter(r => !+r["Called"]).length / rows.length : 0;
    const rev = rows.reduce((a, r) => a + (+r["Total Bill"] || 0), 0);

    const people = personStats(rows, confRows, th);
    const flagCell = p => {
      const f = [];
      if (p.neverPct != null && p.neverPct > th.neverPct) f.push(`<span class="st-flag r">${Math.round(p.neverPct)}% NOT CALLED</span>`);
      if (p.medTto != null && p.medTto > th.slowMin) f.push(`<span class="st-flag a">SLOW ${mins(p.medTto)}</span>`);
      if (p.convPct != null && teamAvgConv && p.convPct < th.convFrac * teamAvgConv) f.push(`<span class="st-flag p">LOW CONV</span>`);
      return f.join("") || `<span class="st-good">✓</span>`;
    };
    host.innerHTML = `
      <div class="st-kpis">
        ${kpi("Leads received", RS.fmtN(rows.length), "created in the selected period")}
        ${kpi("Confirmed (in period)", RS.fmtN(confRows.length), "by their confirmed date")}
        ${kpi("Conversion", pct1(teamAvgConv), "of received leads, confirmed by now")}
        ${kpi("Median first call", medAll != null ? mins(medAll) : "—", "business minutes")}
        ${kpi("Never called", pct1(never), "of received leads")}
        ${kpi("Revenue (closed)", money0(rev), "billed on these leads")}
      </div>
      <div class="st-card">
        <div class="st-bar" style="margin-bottom:8px">
          <b style="color:var(--ink);font-size:13.5px">People · ${people.length}</b>
          <span style="flex:1"></span>
          <div class="st-set"><button class="st-chip" id="stTh">⚙ Thresholds</button>
            <div class="st-pop hidden" id="stThPop">
              <label>Slow first call, min <input type="number" id="thSlow" value="${th.slowMin}"></label>
              <label>Never-called alert, % <input type="number" id="thNever" value="${th.neverPct}"></label>
              <label>Low conversion, × team avg <input type="number" step="0.1" id="thConv" value="${th.convFrac}"></label>
              <label>Min leads to rank <input type="number" id="thMin" value="${th.minLeads}"></label>
              <div class="st-note">Saved on this device. The composite score = 50% conversion · 30% speed · 20% revenue per lead.</div>
            </div></div>
        </div>
        <div style="overflow-x:auto"><table class="st-tbl"><thead><tr>
          <th>Salesperson</th><th>Score</th><th>Leads</th><th>Confirmed</th><th>Conv %</th>
          <th>Confirms in period</th><th>Median 1st call</th><th>Never called</th>
          <th>Calls</th><th>Talk</th><th>Revenue</th><th>$ / lead</th><th>Flags</th>
        </tr></thead><tbody>` +
      people.map(p => `<tr class="click" data-sp="${esc(p.name)}">
          <td><b>${esc(p.name)}</b></td>
          <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
          <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.conf)}</td>
          <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
          <td>${RS.fmtN(p.confEv)}</td>
          <td>${p.medTto != null ? mins(p.medTto) : "—"}</td>
          <td class="${p.neverPct > thGet().neverPct ? "st-bad" : ""}">${p.neverPct != null ? pct1(p.neverPct) : "—"}</td>
          <td>${RS.fmtN(p.out)}</td><td>${secH(p.talk)}</td>
          <td>${money0(p.rev)}</td><td>${money0(p.revLead)}</td>
          <td>${flagCell(p)}</td></tr>`).join("") +
      `</tbody></table></div>
        <div class="st-note">Click a person to open their leads in the Explorer. “Confirms in period” counts by confirmed date; every other column follows the lead’s created date. Branch owner excluded.</div>
      </div>`;

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

  function renderExplorer(host, ctx) {
    const state = { q: "", sp: (ctx.explorerPreset && ctx.explorerPreset.sp) || "", chip: "", sort: "new", page: 0 };
    ctx.explorerPreset = null;
    const PAGE = 100;
    const sps = [...new Set(ctx.rows.map(r => (r["Assigned"] || "").trim()).filter(Boolean))].sort();

    const CHIPS = [
      ["important", "★ Important"], ["never", "Never called"], ["slow", "Slow first call"],
      ["gap", "Quote gap"], ["noclose", "Confirmed, no closing"],
    ];
    host.innerHTML = `
      <div class="st-bar">
        <input type="text" id="stQ" placeholder="Search customer / # / source…">
        <select id="stSp"><option value="">All salespeople</option>${sps.map(s => `<option${s === state.sp ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
        ${CHIPS.map(([k, l]) => `<button class="st-chip" data-c="${k}">${l}</button>`).join("")}
        <span style="flex:1"></span>
        <select id="stSort">
          <option value="new">Newest first</option><option value="slow">Slowest first call</option>
          <option value="bill">Biggest bill</option><option value="gap">Biggest quote gap</option>
          <option value="cf">Biggest CF</option>
        </select>
      </div>
      <div class="st-card" style="padding:0 8px"><div style="overflow-x:auto" id="stTblWrap"></div>
      <div class="st-pg" id="stPg"></div></div>`;

    const apply = () => {
      let rows = ctx.rows;
      if (state.sp) rows = rows.filter(r => (r["Assigned"] || "").trim() === state.sp);
      if (state.q) {
        const q = state.q.toLowerCase();
        rows = rows.filter(r => String(r["Customer"] || "").toLowerCase().includes(q)
          || String(r["Job No"] || "").toLowerCase().includes(q)
          || String(r["Source"] || "").toLowerCase().includes(q));
      }
      if (state.chip === "important") rows = rows.filter(r => +r["Is LD"] || (num(r["Total CF"]) || 0) >= 700 || (num(r["Avg Quote"]) || 0) >= 4000);
      if (state.chip === "never") rows = rows.filter(r => +r["Flag Never Called"]);
      if (state.chip === "slow") rows = rows.filter(r => +r["Flag Slow First Call"]);
      if (state.chip === "gap") rows = rows.filter(r => +r["Flag Big Quote Gap"]);
      if (state.chip === "noclose") rows = rows.filter(r => +r["Flag Confirmed No Closing"]);
      const key = { new: r => r["Create Date"] || "", slow: r => (r["TTO Biz Min"] != null ? +r["TTO Biz Min"] : -1),
        bill: r => +(r["Total Bill"] || 0), gap: r => Math.abs(+(r["Bill Vs Quote Pct"] || 0)),
        cf: r => +(r["Total CF"] || 0) }[state.sort];
      rows = rows.slice().sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
      return rows;
    };

    const paint = () => {
      const rows = apply();
      const start = state.page * PAGE;
      const pg = rows.slice(start, start + PAGE);
      const flagIcons = r => {
        const f = [];
        if (+r["Flag Never Called"]) f.push(`<span class="st-flag r">✕ call</span>`);
        else if (+r["Flag Slow First Call"]) f.push(`<span class="st-flag a">slow</span>`);
        if (+r["Flag Big Quote Gap"]) f.push(`<span class="st-flag p">gap</span>`);
        if (+r["Flag Confirmed No Closing"]) f.push(`<span class="st-flag r">no closing</span>`);
        if (+r["Is LD"]) f.push(`<span class="st-flag b">LD</span>`);
        if (r["Flag"]) f.push(`<span class="st-flag b">${esc(r["Flag"])}</span>`);
        return f.join("");
      };
      host.querySelector("#stTblWrap").innerHTML = `<table class="st-tbl"><thead><tr>
        <th>Created</th><th>#</th><th>Customer</th><th>Source</th><th>Assigned</th><th>CF</th>
        <th>Quote</th><th>Status</th><th>1st call</th><th>Calls</th><th>Texts</th>
        <th>Bill</th><th>Δ quote</th><th>Flags</th></tr></thead><tbody>` +
        pg.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"])}">
          <td>${esc((r["Create Date"] || "").slice(0, 10))}</td>
          <td>${esc(r["Job No"] || "—")}</td>
          <td><b>${esc(r["Customer"] || "—")}</b></td>
          <td>${esc(r["Source"] || "—")}</td>
          <td>${esc(r["Assigned"] || "—")}</td>
          <td>${r["Total CF"] != null ? RS.fmtN(Math.round(+r["Total CF"])) : "—"}</td>
          <td>${money0(num(r["Avg Quote"]))}</td>
          <td>${esc(r["Status Category"] || r["Status"] || "—")}</td>
          <td>${+r["Called"] ? (r["TTO Biz Min"] != null ? mins(+r["TTO Biz Min"]) : "yes") : `<span class="st-bad">never</span>`}</td>
          <td>${(+r["Out Calls"] || 0) + (+r["In Calls"] || 0)}</td>
          <td>${(+r["Sms Out"] || 0) + (+r["Sms In"] || 0)}</td>
          <td>${money0(num(r["Total Bill"]))}</td>
          <td>${r["Bill Vs Quote Pct"] != null ? pct1(+r["Bill Vs Quote Pct"]) : "—"}</td>
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
    host.querySelector("#stSp").onchange = e => { state.sp = e.target.value; state.page = 0; paint(); };
    host.querySelector("#stSort").onchange = e => { state.sort = e.target.value; state.page = 0; paint(); };
    host.querySelectorAll(".st-chip[data-c]").forEach(b => b.onclick = () => {
      state.chip = state.chip === b.dataset.c ? "" : b.dataset.c;
      host.querySelectorAll(".st-chip[data-c]").forEach(x => x.classList.toggle("on", x.dataset.c === state.chip));
      state.page = 0; paint();
    });
    paint();
  }

  async function renderSub(host, pageId) {
    const p = PAGES.find(x => x.id === pageId);
    if (!p) { host.innerHTML = `<div class="rs-loading">Page ${esc(pageId)} unavailable.</div>`; return; }
    await p.render(host);
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
      const TABS = [
        ["team", "Team"], ["explorer", "Lead Explorer"], ["speed", "Speed to Lead"], ["inflow", "Leads Inflow"],
      ];
      const tabsEl = host.querySelector("#stTabs");
      const hostEl = host.querySelector("#stHost");
      let active = "team";

      const ctx = { rows: [], confRows: [], explorerPreset: null, go: k => go(k) };

      const paintTabs = () => {
        tabsEl.innerHTML = TABS.map(([k, l]) => `<button class="st-tab ${k === active ? "on" : ""}" data-k="${k}">${l}</button>`).join("");
        tabsEl.querySelectorAll(".st-tab").forEach(b => b.onclick = () => go(b.dataset.k));
      };
      const go = async k => {
        active = k; paintTabs();
        hostEl.innerHTML = `<div class="rs-loading" style="padding:22px">Loading…</div>`;
        if (k === "speed") return renderSub(hostEl, "sales-speed");
        if (k === "inflow") return renderSub(hostEl, "leads-inflow");
        const all = await RS.load("lead_journey");
        ctx.rows = RS.filtered("lead_journey", all);
        ctx.confRows = RS.filtered("lead_journey",
          all.filter(r => r["Booked Date"]), { dateColumn: "Booked Date" });
        if (k === "team") return renderTeam(hostEl, ctx);
        return renderExplorer(hostEl, ctx);
      };
      paintTabs();
      await go("team");
    },
  });
})();
