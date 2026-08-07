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
  .msl-row{cursor:pointer}
  .msl-row:hover td{background:var(--brand-glow)}
  .msl-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:11px 13px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
  .msl-pager b{color:var(--ink);font-variant-numeric:tabular-nums}
  .msl-pgnav{display:flex;gap:8px}
  .msl-pgnav button{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:7px 14px;cursor:pointer}
  .msl-pgnav button:hover:not(:disabled){border-color:var(--brand)}
  .msl-pgnav button:disabled{opacity:.35;cursor:default}
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
            <span id="mslCount" style="color:var(--muted);font-size:12.5px"></span>
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

    // pager + row click must be (re)bound after every paint, since paintTable replaces markup
    const wireTable = () => {
      const pv = document.getElementById("mslPrev");
      if (pv) pv.onclick = () => { MSL_STATE.page--; paintTable(); };
      const nx = document.getElementById("mslNext");
      if (nx) nx.onclick = () => { MSL_STATE.page++; paintTable(); };
      document.querySelectorAll(".msl-row").forEach(tr => {
        tr.onclick = () => {
          const job = tr.getAttribute("data-job") || "";
          if (!job || job === "—") return;
          location.hash = "#page=source-trace&job=" + encodeURIComponent(job);
        };
      });
    };
    const paintTable = () => {
      const nq = norm(MSL_STATE.q), dq = digits(MSL_STATE.q);
      let list = multi;
      if (MSL_STATE.combo) list = list.filter(x => x.combo === MSL_STATE.combo);
      if (nq) list = list.filter(x => {
        const r = x.r;
        return norm(r["Job No"]).includes(nq) || norm(r["Customer"]).includes(nq)
          || (dq.length >= 4 && digits(r["Customer Phone"]).includes(dq));
      });
      // NEWEST first, 10 per page (his ask). The whole matched set is still searchable —
      // only the rendered slice is capped, so the page stays fast as the data grows.
      list = list.slice().sort((a, b) =>
        String(b.r["Move Date"] || "").localeCompare(String(a.r["Move Date"] || "")));
      /* Rows to fit the screen, not a fixed ten. Ten was chosen when the portal was a 1400px
         layout; on a 2560px monitor it left the bottom half of the page empty and turned 162
         leads into SEVENTEEN pages of clicking. Measure the space actually below the table and
         fill it: ~34px a row, floor of 10 so a laptop still behaves, ceiling of 60 so nobody
         renders a thousand rows on a wall display. */
      /* getBoundingClientRect() is VIEWPORT-relative, so once the user had scrolled the
         table head upward `top` shrank, `room` grew, and the page size changed underneath
         them -- click page 2 and the rows per page were no longer the rows per page that
         built the pager. Add back the scroller's scrollTop the way rs-components.js:281
         does, then cache the answer: the layout only changes when the window does. */
      const PER = (() => {
        if (MSL_STATE.per && MSL_STATE.perAt === window.innerHeight) return MSL_STATE.per;
        const head = document.querySelector(".msl-tbl thead, .rs-content table thead");
        const sc = document.querySelector(".rs-content");
        const top = head ? head.getBoundingClientRect().bottom + (sc ? sc.scrollTop : 0) : 300;
        const room = window.innerHeight - top - 90;          // 90 = pager + breathing room
        const per = Math.max(10, Math.min(60, Math.floor(room / 34) || 10));
        if (head) { MSL_STATE.per = per; MSL_STATE.perAt = window.innerHeight; }
        return per;
      })();
      const pages = Math.max(1, Math.ceil(list.length / PER));
      if (MSL_STATE.page == null || MSL_STATE.page >= pages) MSL_STATE.page = 0;
      if (MSL_STATE.page < 0) MSL_STATE.page = 0;
      const start = MSL_STATE.page * PER;
      const pageRows = list.slice(start, start + PER);
      document.getElementById("mslCount").textContent =
        RS.fmtN(list.length) + " lead" + (list.length === 1 ? "" : "s")
        + (list.length ? " · showing " + (start + 1) + "-" + Math.min(start + PER, list.length) : "");
      const rowsHtml = pageRows.map(x => {
        const r = x.r;
        return `<tr class="msl-row" data-jk="${esc(r["Request Joinkey"] || "")}" data-job="${esc(show(r["Job No"]))}" title="Open this lead">
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
           <tbody>${rowsHtml}</tbody></table>
           ${pages > 1 ? `<div class="msl-pager">
             <div>Page <b>${MSL_STATE.page + 1}</b> of <b>${pages}</b></div>
             <div class="msl-pgnav">
               <button id="mslPrev"${MSL_STATE.page ? "" : " disabled"}>‹ Prev</button>
               <button id="mslNext"${MSL_STATE.page + 1 < pages ? "" : " disabled"}>Next ›</button>
             </div></div>` : ""}`
        : `<div class="rs-loading" style="padding:18px">No leads match.</div>`;
      wireTable();
    };

    paintCombos();
    paintTable();

    let t = null;
    document.getElementById("mslSearch").oninput = e => {
      clearTimeout(t); t = setTimeout(() => { MSL_STATE.q = e.target.value; MSL_STATE.page = 0; paintTable(); }, 120);
    };
  },
});
