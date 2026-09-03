/* DIFFERENT ANALYSIS ▸ Area Master — the per-city planning table.
 *
 * Giga's ask (2026-09-03): one master, by city, carrying ROI, incoming leads, the ad budget
 * and sources we spend there, research on where the money and the big houses are, SEO demand,
 * distance from the nearest base, foremen at that base, and the areas we have never worked
 * but could. "This is the master by which we see what to do and where to take planning, and
 * it is what marketing needs for targeting."
 *
 * WHAT IS OURS AND WHAT IS NOT. City, leads, booking rate, jobs, revenue, revenue per lead,
 * distance to the nearest base, which base, foremen there, and the untapped flag all come
 * from our own data (src/curated.py::mart_area_master). Ad spend by area, search volume and
 * the wealth/housing research do NOT exist in our systems — our card feed has no geography.
 * They are shown as empty columns rather than guessed, and the page says where each will
 * come from, so nobody mistakes a blank for a zero.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.area_master) {
    RS.DATASETS.area_master = {
      table: "mart_area_master",
      cols: ["State", "City", "County", "Leads", "Booked", "Booking Rate", "Leads 90d",
             "Jobs", "Revenue", "Avg Ticket", "Revenue Per Lead", "Avg Quote", "Avg CF",
             "Nearest Base", "Miles To Base", "Foremen At Base", "Crew At Base", "Untapped",
             "Claims", "Claims Per 100 Jobs", "Claim Refunds", "Claims Gone Public",
             "Ad Spend", "Ad Sources", "Search Volume", "Wealth Tier"],
    };
  }
})();

registerPage({
  id: "area-master",
  group: "different",
  title: "Area Master",
  subtitle: "Every city we get leads from, with what it books, what it earns, how far it is " +
            "from a base and how much crew stands behind it — the table planning and " +
            "marketing target from.",
  datasets: [],

  async render(host) {
    const num = RS.num, fmtN = RS.fmtN;
    const esc = RS.esc || (s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    const money0 = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
    const r1 = v => (v == null || isNaN(v)) ? "—" : v.toFixed(1);

    if (!document.getElementById("amx-style")) {
      const st = document.createElement("style");
      st.id = "amx-style";
      st.textContent = [
        ".amx-bar{display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        ".amx-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;margin-bottom:1px}",
        ".amx-in:focus{border-color:var(--brand)}",
        ".amx-led{display:flex;flex-wrap:wrap;gap:0;padding:18px 20px}",
        ".amx-led-g{flex:1 1 165px;min-width:0;padding:0 18px 0 0}",
        ".amx-led-g + .amx-led-g{padding-left:18px;border-left:1px solid var(--line-2)}",
        ".amx-led-g>.l{font-size:10px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint)}",
        ".amx-led-g>.v{font-size:clamp(23px,1.9vw,30px);font-weight:800;letter-spacing:-.8px;line-height:1.15;"
          + "margin-top:5px;font-variant-numeric:tabular-nums;color:var(--ink)}",
        ".amx-led-g>.v.pos{color:var(--brand)} .amx-led-g>.v.warn{color:var(--warn)}",
        ".amx-led-g>.s{font-size:12px;color:var(--muted);line-height:1.55;margin-top:6px}",
        ".amx-led-g>.s b{color:var(--ink)}",
        ".amx-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(370px,1fr));gap:12px;margin-top:12px}",
        ".amx-grid>.panel{min-width:0}",
        // the distance ladder: the finding this whole page exists to show
        ".amx-lad{display:grid;grid-template-columns:76px minmax(60px,1fr) auto auto;gap:10px;align-items:center;"
          + "padding:7px 0;border-bottom:1px solid var(--line-2);font-size:12.5px}",
        ".amx-lad:last-child{border-bottom:0}",
        ".amx-lad .t{height:13px;background:var(--panel-2);border-radius:7px;overflow:hidden}",
        ".amx-lad .t i{display:block;height:100%;background:var(--brand);border-radius:7px}",
        ".amx-lad .v{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);white-space:nowrap}",
        ".amx-lad .v b{color:var(--ink)}",
        ".amx-small{color:var(--faint);font-size:11.5px;white-space:nowrap}",
        ".amx-th{cursor:pointer;user-select:none;white-space:nowrap}",
        ".amx-th:hover{color:var(--brand)}",
        ".amx-th.on{color:var(--brand)}",
        ".amx-ext{color:var(--faint);font-style:italic}",
        ".amx-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;font-size:12.5px;color:var(--faint)}",
        ".amx-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Area Master</h1></div>
      <div class="rs-loading" style="padding:22px">Reading every city…</div>`;

    const all = await RS.load("area_master");

    const S = { state: "", minLeads: 20, view: "all", q: "", sort: "Revenue", desc: true,
                page: 0, pageSize: 30 };
    let qTimer = null;
    const states = [...new Set(all.map(r => r.State).filter(Boolean))].sort();

    function paint() {
      const q = S.q.trim().toLowerCase();
      const rows = all.filter(r => {
        if (S.state && r.State !== S.state) return false;
        if ((num(r.Leads) || 0) < S.minLeads) return false;
        if (S.view === "untapped" && num(r.Untapped) !== 1) return false;
        if (S.view === "working" && num(r.Untapped) === 1) return false;
        if (S.view === "far" && (num(r["Miles To Base"]) || 0) < 25) return false;
        if (q && !((r.City || "") + " " + (r.County || "") + " " + (r.State || "")).toLowerCase().includes(q)) return false;
        return true;
      });

      const T = k => rows.reduce((a, r) => a + (num(r[k]) || 0), 0);
      const leads = T("Leads"), booked = T("Booked"), jobs = T("Jobs"), rev = T("Revenue");
      const untapped = rows.filter(r => num(r.Untapped) === 1);
      const untappedLeads = untapped.reduce((a, r) => a + (num(r.Leads) || 0), 0);
      const noCrew = rows.filter(r => (num(r["Foremen At Base"]) || 0) === 0);
      const noCrewLeads = noCrew.reduce((a, r) => a + (num(r.Leads) || 0), 0);

      // the ladder: booking and revenue per lead against distance from a base
      const bands = [["0–10 mi", 0, 10], ["10–20 mi", 10, 20], ["20–35 mi", 20, 35],
                     ["35–60 mi", 35, 60], ["60+ mi", 60, 1e9]];
      const lad = bands.map(([label, lo, hi]) => {
        const g = rows.filter(r => { const m = num(r["Miles To Base"]);
          return m != null && m >= lo && m < hi; });
        const l = g.reduce((a, r) => a + (num(r.Leads) || 0), 0);
        const b = g.reduce((a, r) => a + (num(r.Booked) || 0), 0);
        const v = g.reduce((a, r) => a + (num(r.Revenue) || 0), 0);
        return { label, cities: g.length, leads: l, booked: b,
                 pct: l ? b / l * 100 : null, rpl: l ? v / l : null };
      }).filter(x => x.leads > 0);
      const maxPct = Math.max(1, ...lad.map(x => x.pct || 0));

      const sorted = rows.slice().sort((a, b) => {
        const x = a[S.sort], y = b[S.sort];
        const nx = num(x), ny = num(y);
        const cmp = (nx != null && ny != null && !isNaN(nx) && !isNaN(ny))
          ? nx - ny : String(x || "").localeCompare(String(y || ""));
        return S.desc ? -cmp : cmp;
      });
      S.page = Math.min(S.page, Math.max(0, Math.ceil(sorted.length / S.pageSize) - 1));
      const pageRows = sorted.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);
      const pages = Math.max(1, Math.ceil(sorted.length / S.pageSize));

      const th = (label, key, cls) => `<th class="amx-th ${cls || ""} ${S.sort === key ? "on" : ""}"
        data-sort="${esc(key)}">${esc(label)}${S.sort === key ? (S.desc ? " ↓" : " ↑") : ""}</th>`;

      host.innerHTML = `
        <div class="rs-page-head"><h1>Area Master</h1>
          <p>Every city that sent us a lead this year, with what it books, what it earns, how far
          it sits from a base and how much crew stands behind it. The three columns we cannot fill
          from our own systems — ad spend by area, search demand and the wealth research — are left
          empty on purpose rather than guessed. This is the evidence;
          <a href="#page=area-plan">Area Plan</a> is where you turn it into crews, trucks and
          salespeople.</p></div>
        <div class="amx-bar" id="amxBar"></div>

        <div class="panel amx-led">
          <div class="amx-led-g"><div class="l">Cities</div><div class="v">${fmtN(rows.length)}</div>
            <div class="s"><b>${fmtN(leads)}</b> leads · <b>${fmtN(booked)}</b> booked
              (${leads ? (booked / leads * 100).toFixed(1) : "—"}%)</div></div>
          <div class="amx-led-g"><div class="l">Revenue</div><div class="v">${money0(rev)}</div>
            <div class="s"><b>${fmtN(jobs)}</b> jobs · <b>${money0(leads ? rev / leads : 0)}</b> per lead this year</div></div>
          <div class="amx-led-g"><div class="l">Never worked</div><div class="v ${untapped.length ? "warn" : ""}">${fmtN(untapped.length)}</div>
            <div class="s">cities sent <b>${fmtN(untappedLeads)}</b> leads and produced no job at all</div></div>
          <div class="amx-led-g"><div class="l">No crew behind them</div><div class="v ${noCrew.length ? "warn" : ""}">${fmtN(noCrew.length)}</div>
            <div class="s"><b>${fmtN(noCrewLeads)}</b> leads whose nearest base has no foreman on the register</div></div>
        </div>

        <div class="amx-grid">
          <div class="panel"><div class="panel-head"><div><div class="panel-title">Distance decides</div>
            <div class="rs-hint">Booking rate and revenue per lead, by how far the city sits from its nearest base. This is the whole argument for where a base goes.</div></div></div>
            ${lad.map(x => `<div class="amx-lad">
              <span>${esc(x.label)}</span>
              <span class="t"><i style="width:${Math.max(3, (x.pct || 0) / maxPct * 100)}%"></i></span>
              <span class="v"><b>${x.pct == null ? "—" : x.pct.toFixed(1) + "%"}</b> book</span>
              <span class="v">${money0(x.rpl)} / lead</span></div>`).join("")}
            <div class="rs-hint" style="margin-top:8px">${lad.length >= 2 && lad[0].pct && lad[lad.length - 1].pct
              ? "A city next to a base books <b>" + (lad[0].pct / lad[lad.length - 1].pct).toFixed(1)
                + "×</b> better than one at the far end, and earns <b>" + money0(lad[0].rpl)
                + "</b> per lead against <b>" + money0(lad[lad.length - 1].rpl) + "</b>."
              : ""}</div>
          </div>

          <div class="panel"><div class="panel-head"><div><div class="panel-title">Biggest gaps</div>
            <div class="rs-hint">Cities sending real volume that we convert badly — the places a base, a crew or a campaign would pay for itself.</div></div></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>City</th><th class="num">Leads</th><th class="num">Books</th>
                <th class="num">Miles</th><th class="num">Foremen</th></tr></thead>
              <tbody>${rows.filter(r => (num(r.Leads) || 0) >= 100)
                .sort((a, b) => (num(a["Booking Rate"]) || 0) - (num(b["Booking Rate"]) || 0))
                .slice(0, 8).map(r => `<tr>
                  <td class="strong">${esc(r.City)} <span class="amx-small">${esc(r.State)}</span></td>
                  <td class="num">${fmtN(num(r.Leads))}</td>
                  <td class="num"><b>${r1(num(r["Booking Rate"]))}%</b></td>
                  <td class="num">${r1(num(r["Miles To Base"]))}</td>
                  <td class="num ${(num(r["Foremen At Base"]) || 0) === 0 ? "" : ""}">${(num(r["Foremen At Base"]) || 0) || '<span class="amx-small">none</span>'}</td>
                </tr>`).join("")}</tbody></table></div>
          </div>
          <div class="panel"><div class="panel-head"><div><div class="panel-title">Where the claims come from</div>
            <div class="rs-hint">Claims per 100 jobs done in that city — a city that runs 12 jobs and gets 2 claims is a worse place to work than one that runs 150 and gets 5. Only cities with 10+ jobs.</div></div></div>
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>City</th><th class="num">Jobs</th><th class="num">Claims</th>
                <th class="num">Per 100</th><th class="num">Refunded</th><th class="num">Public</th></tr></thead>
              <tbody>${rows.filter(r => (num(r.Jobs) || 0) >= 10)
                .sort((a, b) => (num(b["Claims Per 100 Jobs"]) || 0) - (num(a["Claims Per 100 Jobs"]) || 0))
                .slice(0, 8).map(r => `<tr>
                  <td class="strong">${esc(r.City)} <span class="amx-small">${esc(r.State)}</span></td>
                  <td class="num">${fmtN(num(r.Jobs))}</td>
                  <td class="num">${fmtN(num(r.Claims))}</td>
                  <td class="num"><b>${r1(num(r["Claims Per 100 Jobs"]))}</b></td>
                  <td class="num">${(num(r["Claim Refunds"]) || 0) ? money0(num(r["Claim Refunds"])) : '<span class="amx-small">—</span>'}</td>
                  <td class="num">${(num(r["Claims Gone Public"]) || 0) || '<span class="amx-small">—</span>'}</td>
                </tr>`).join("")}</tbody></table></div>
            <div class="rs-hint" style="margin-top:8px">Company-wide this year: <b>${fmtN(T("Claims"))}</b> claims
              on <b>${fmtN(jobs)}</b> jobs — <b>${jobs ? (T("Claims") / jobs * 100).toFixed(1) : "—"}</b> per 100.
              <a href="#page=claims-analysis">Open Claims Analysis</a> for the reason behind each one.</div>
          </div>
        </div>

        <div class="panel" style="margin-top:12px">
          <div class="panel-head"><div class="panel-title">The master</div>
            <div class="rs-spacer"></div><span class="rs-pill">${fmtN(sorted.length)} cities</span>
            <button class="rs-btn" id="amxDl">Download CSV</button></div>
          <div class="rs-hint" style="margin:0 0 8px">Click a column to sort. <span class="amx-ext">Ad spend,
            search volume and wealth tier</span> are external inputs: ad spend needs the Google Ads
            geo report (our card feed has no geography), search volume an SEO tool, and the wealth
            and housing tier a research pass. The spine is ready for all three.</div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr>
              ${th("City", "City")}${th("St", "State")}${th("County", "County")}
              ${th("Leads", "Leads", "num")}${th("90d", "Leads 90d", "num")}
              ${th("Booked", "Booked", "num")}${th("Book %", "Booking Rate", "num")}
              ${th("Jobs", "Jobs", "num")}${th("Revenue", "Revenue", "num")}
              ${th("$/lead", "Revenue Per Lead", "num")}${th("Ticket", "Avg Ticket", "num")}
              ${th("Base", "Nearest Base")}${th("Miles", "Miles To Base", "num")}
              ${th("Foremen", "Foremen At Base", "num")}
              ${th("Claims", "Claims", "num")}${th("/100", "Claims Per 100 Jobs", "num")}
              <th class="num amx-ext">Ad $</th><th class="amx-ext">Sources</th>
              <th class="num amx-ext">Search</th><th class="amx-ext">Wealth</th>
            </tr></thead>
            <tbody>${pageRows.map(r => `<tr>
              <td class="strong">${esc(r.City)}${num(r.Untapped) === 1 ? ' <span class="rs-pill warn">no jobs</span>' : ""}</td>
              <td>${esc(r.State)}</td><td class="muted">${esc(r.County || "—")}</td>
              <td class="num">${fmtN(num(r.Leads))}</td>
              <td class="num">${fmtN(num(r["Leads 90d"]))}</td>
              <td class="num">${fmtN(num(r.Booked))}</td>
              <td class="num">${r1(num(r["Booking Rate"]))}%</td>
              <td class="num">${fmtN(num(r.Jobs))}</td>
              <td class="num">${money0(num(r.Revenue))}</td>
              <td class="num">${money0(num(r["Revenue Per Lead"]))}</td>
              <td class="num">${money0(num(r["Avg Ticket"]))}</td>
              <td>${esc(r["Nearest Base"] || "—")}</td>
              <td class="num">${r1(num(r["Miles To Base"]))}</td>
              <td class="num">${(num(r["Foremen At Base"]) || 0) || '<span class="amx-small">0</span>'}</td>
              <td class="num">${(num(r.Claims) || 0) || '<span class="amx-small">—</span>'}</td>
              <td class="num">${(num(r.Claims) || 0) ? r1(num(r["Claims Per 100 Jobs"])) : '<span class="amx-small">—</span>'}</td>
              <td class="num amx-ext">—</td><td class="amx-ext">—</td>
              <td class="num amx-ext">—</td><td class="amx-ext">—</td>
            </tr>`).join("")}</tbody></table></div>
          <div class="amx-pager">
            <span>page ${S.page + 1} of ${pages}</span>
            <button class="rs-btn" data-pg="prev" ${S.page <= 0 ? "disabled" : ""}>‹ Prev</button>
            <button class="rs-btn" data-pg="next" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button>
          </div>
        </div>`;

      mountBar();
      host.querySelectorAll("[data-sort]").forEach(el => {
        el.onclick = () => {
          const k = el.dataset.sort;
          if (S.sort === k) S.desc = !S.desc; else { S.sort = k; S.desc = true; }
          S.page = 0; paint();
        };
      });
      host.querySelectorAll("[data-pg]").forEach(el => {
        el.onclick = () => { S.page += el.dataset.pg === "next" ? 1 : -1; paint(); };
      });
      const dl = host.querySelector("#amxDl");
      if (dl) dl.onclick = () => dlCsv(sorted);
    }

    function mountBar() {
      const bar = host.querySelector("#amxBar");
      if (!bar) return;
      const fld = (label, el) => { const w = document.createElement("div"); w.className = "rs-fld";
        w.innerHTML = `<span>${label}</span>`; w.appendChild(el); return w; };
      const seg = (opts, cur, set) => {
        const s = document.createElement("div"); s.className = "rs-seg";
        opts.forEach(([v, label]) => {
          const b = document.createElement("button"); b.textContent = label;
          if (cur === v) b.className = "on";
          b.onclick = () => { set(v); S.page = 0; paint(); };
          s.appendChild(b);
        });
        return s;
      };
      const stSel = document.createElement("select");
      stSel.className = "amx-in";
      stSel.innerHTML = `<option value="">All states</option>`
        + states.map(s => `<option${S.state === s ? " selected" : ""}>${s}</option>`).join("");
      stSel.onchange = () => { S.state = stSel.value; S.page = 0; paint(); };
      bar.appendChild(fld("State", stSel));
      bar.appendChild(fld("Show", seg([["all", "All"], ["working", "We work there"],
        ["untapped", "Never worked"], ["far", "25+ miles out"]], S.view, v => { S.view = v; })));
      bar.appendChild(fld("Min leads", seg([[5, "5"], [20, "20"], [50, "50"], [100, "100"]],
        S.minLeads, v => { S.minLeads = v; })));
      const q = document.createElement("input");
      q.className = "amx-in"; q.placeholder = "find a city or county…";
      q.value = S.q; q.style.flex = "0 1 240px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S.page = 0; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    function dlCsv(rows) {
      const cols = ["State", "City", "County", "Leads", "Leads 90d", "Booked", "Booking Rate",
        "Jobs", "Revenue", "Avg Ticket", "Revenue Per Lead", "Avg Quote", "Avg CF",
        "Nearest Base", "Miles To Base", "Foremen At Base", "Crew At Base", "Untapped",
        "Claims", "Claims Per 100 Jobs", "Claim Refunds", "Claims Gone Public",
        "Ad Spend", "Ad Sources", "Search Volume", "Wealth Tier"];
      const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s;
        return '"' + s.replace(/"/g, '""') + '"'; };
      const lines = [cols.map(cell).join(",")].concat(rows.map(r => cols.map(c => cell(r[c])).join(",")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = "Area Master.csv"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }

    paint();
  },
});
