/* ADMIN page: Multi-Source Leads — leads where 2+ EXTERNAL trackers independently match the
   same customer, IGNORING whatever the moveboard / closing booked source says. A lead counts
   as multi-source when ≥2 of these four match:
       • CallRail   — customer phone matched a CallRail tracking number
       • Google Local — customer phone is in the Google Local leads sheet
       • Angi        — customer matched an Angi lead (email/phone/name+zip/name+date)
       • Thumbtack   — customer matched a Thumbtack lead (phone/name+zip/name+date)
   Built on `source_trace_moveboard` (one row per moveboard lead), computed client-side.
   Read-only. Example Tornike gave: "Google Local has the phone number AND Angi has the lead". */

(function () {
  // dataset spec is also registered by source-trace.js; register defensively so this page
  // works even if that module hasn't run yet.
  if (window.RS && RS.DATASETS && !RS.DATASETS.source_trace_moveboard) {
    RS.DATASETS.source_trace_moveboard = {
      table: "source_trace_moveboard",
      cols: [
        "Job No", "Company", "Customer", "Move Date", "Create Date", "Customer Phone",
        "Moveboard Raw Source", "CallRail Number Name", "CallRail Translated",
        "Google Local Match", "Merged Source", "Translated Source", "Pickup State",
        "Source Connector", "Angi Match", "Angi Match Key", "Thumbtack Match",
        "Thumbtack Match Key", "Source Connector (with leads)", "Match Path",
      ],
    };
  }
})();

const MSL_STATE = { q: "", combo: null };

registerPage({
  id: "multi-source-leads",
  group: "settings",
  title: "Multi-Source Leads",
  async render(host) {
    const CAP = 300;
    const yes = v => String(v == null ? "" : v).trim().toLowerCase() === "yes";
    const has = v => !(v == null || String(v).trim() === "");
    const show = v => has(v) ? String(v) : "—";
    const norm = s => String(s == null ? "" : s).trim().toLowerCase();
    const esc = RSC.esc;

    // the four external trackers, in priority order (only these count — booked source ignored)
    const TRACKERS = [
      { key: "CallRail",     on: r => has(r["CallRail Number Name"]),
        detail: r => r["CallRail Translated"] || r["CallRail Number Name"] },
      { key: "Google Local", on: r => yes(r["Google Local Match"]), detail: () => "phone in Google Local" },
      { key: "Angi",         on: r => yes(r["Angi Match"]),     detail: r => "matched by " + show(r["Angi Match Key"]) },
      { key: "Thumbtack",    on: r => yes(r["Thumbtack Match"]), detail: r => "matched by " + show(r["Thumbtack Match Key"]) },
    ];
    const trackersOf = r => TRACKERS.filter(t => t.on(r)).map(t => t.key);

    if (!document.getElementById("msl-style")) {
      const st = document.createElement("style");
      st.id = "msl-style";
      st.textContent = `
        #mslSearch{width:100%;max-width:460px;padding:10px 13px;border-radius:11px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:14px;font-family:inherit;outline:none}
        #mslSearch:focus{border-color:var(--brand)}
        .msl-combos{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 4px}
        .msl-combo{border:1px solid var(--line-2);background:var(--panel-2);border-radius:999px;
          padding:6px 13px;font-size:12.5px;font-weight:700;color:var(--muted);cursor:pointer;white-space:nowrap}
        .msl-combo:hover{border-color:var(--brand)}
        .msl-combo.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .msl-combo .n{opacity:.7;font-weight:800;margin-left:5px}
        .msl-tbl{width:100%;border-collapse:collapse}
        .msl-tbl th,.msl-tbl td{padding:8px 12px;font-size:12.5px;text-align:left;border-bottom:1px solid var(--line)}
        .msl-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}
        .msl-tbl tr:hover td{background:var(--panel-2)}
        .msl-tbl td.r,.msl-tbl th.r{text-align:right}
        .src-chip{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;margin:1px 3px 1px 0;white-space:nowrap}
        .src-chip.CallRail{background:rgba(132,204,22,.16);color:var(--brand-d)}
        .src-chip.GoogleLocal{background:rgba(91,140,255,.16);color:#3b6fe0}
        .src-chip.Angi{background:rgba(245,158,11,.16);color:#b45309}
        .src-chip.Thumbtack{background:rgba(168,85,247,.16);color:#7c3aed}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Multi-Source Leads</h1>
        <p>Leads where <b>two or more external trackers independently claim the same customer</b> —
           <b>CallRail</b>, <b>Google Local</b>, <b>Angi</b>, <b>Thumbtack</b> — regardless of what was booked
           on the moveboard or closing sheet. These are the contested attributions worth a look.
           <span class="freshness">· read-only · one row per moveboard lead</span></p>
      </div>
      <div class="rs-kpis" id="mslKpis"><div class="rs-loading">Loading leads… (108k — one moment)</div></div>
      <div class="panel" style="margin-top:12px">
        <div style="padding:14px 16px 6px">
          <div class="msl-combos" id="mslCombos"></div>
          <div style="display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap">
            <input id="mslSearch" type="text" autocomplete="off" spellcheck="false"
              placeholder="Search by moveboard #, customer, or phone…">
            <span id="mslCount" class="st-note" style="color:var(--muted);font-size:12.5px"></span>
          </div>
        </div>
        <div id="mslTable" style="padding:2px 6px 10px;overflow-x:auto"></div>
      </div>`;

    let all;
    try {
      all = await RS.load("source_trace_moveboard");
    } catch (e) {
      document.getElementById("mslKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`;
      return;
    }
    if (!document.getElementById("mslSearch")) return;   // navigated away mid-load

    // compute the multi-source set (>=2 trackers), ignoring the booked source entirely
    const multi = [];
    for (const r of all) {
      const t = trackersOf(r);
      if (t.length >= 2) multi.push({ r, t, combo: t.join(" + ") });
    }

    // KPIs
    const three = multi.filter(x => x.t.length >= 3).length;
    const comboCounts = {};
    multi.forEach(x => { comboCounts[x.combo] = (comboCounts[x.combo] || 0) + 1; });
    const topCombo = Object.entries(comboCounts).sort((a, b) => b[1] - a[1])[0];
    RSC.kpis(document.getElementById("mslKpis"), [
      { label: "Multi-source leads", value: RS.fmtN(multi.length), sub: "≥2 trackers match, of " + RS.fmtN(all.length) },
      { label: "3+ trackers", value: RS.fmtN(three), sub: "the most contested" },
      { label: "Most common overlap", value: topCombo ? topCombo[0] : "—", sub: topCombo ? RS.fmtN(topCombo[1]) + " leads" : "" },
    ]);

    // combination filter chips (sorted by count)
    const combos = Object.entries(comboCounts).sort((a, b) => b[1] - a[1]);
    const combosEl = document.getElementById("mslCombos");
    const paintCombos = () => {
      combosEl.innerHTML =
        `<span class="msl-combo ${MSL_STATE.combo == null ? "on" : ""}" data-c="">All<span class="n">${RS.fmtN(multi.length)}</span></span>` +
        combos.map(([c, n]) => `<span class="msl-combo ${MSL_STATE.combo === c ? "on" : ""}" data-c="${esc(c)}">${esc(c)}<span class="n">${RS.fmtN(n)}</span></span>`).join("");
      combosEl.querySelectorAll(".msl-combo").forEach(el => el.onclick = () => {
        MSL_STATE.combo = el.dataset.c || null; paintCombos(); paintTable();
      });
    };

    const chip = k => `<span class="src-chip ${k.replace(/\s/g, "")}">${esc(k)}</span>`;
    const digits = s => String(s || "").replace(/[^0-9]/g, "");

    const paintTable = () => {
      const nq = norm(MSL_STATE.q), dq = digits(MSL_STATE.q);
      let list = multi;
      if (MSL_STATE.combo) list = list.filter(x => x.combo === MSL_STATE.combo);
      if (nq) list = list.filter(x => {
        const r = x.r;
        return norm(r["Job No"]).includes(nq) || norm(r["Customer"]).includes(nq)
          || (dq.length >= 4 && digits(r["Customer Phone"]).includes(dq));
      });
      document.getElementById("mslCount").textContent =
        RS.fmtN(list.length) + " lead" + (list.length === 1 ? "" : "s") + (list.length > CAP ? " · showing first " + CAP : "");
      const rowsHtml = list.slice(0, CAP).map(x => {
        const r = x.r;
        return `<tr>
          <td><b>#${esc(show(r["Job No"]))}</b></td>
          <td>${esc(show(r["Customer"]))}</td>
          <td>${esc(show(r["Customer Phone"]))}</td>
          <td>${esc(show(r["Company"]))}</td>
          <td>${esc(show(r["Move Date"]))}</td>
          <td>${x.t.map(chip).join("")}</td>
          <td>${esc(show(r["Source Connector"]))}</td>
        </tr>`;
      }).join("");
      document.getElementById("mslTable").innerHTML = list.length
        ? `<table class="msl-tbl"><thead><tr>
             <th>Move #</th><th>Customer</th><th>Phone</th><th>Company</th><th>Move Date</th>
             <th>Trackers that matched</th><th>Resolved source</th></tr></thead>
           <tbody>${rowsHtml}</tbody></table>`
        : `<div class="rs-loading" style="padding:18px">No leads match.</div>`;
    };

    paintCombos();
    paintTable();

    let t = null;
    document.getElementById("mslSearch").oninput = e => {
      clearTimeout(t); t = setTimeout(() => { MSL_STATE.q = e.target.value; paintTable(); }, 120);
    };
  },
});
