/* ADMIN page: Data Quality — flags warehouse rows that look wrong or unfinished
   for the CURRENT filter scope, so an admin can go correct them at the source sheet.
   Read-only by design: it only LISTS problems, it never edits anything.

   BACKGROUND LOADING: the page paints its shell immediately, then computes each
   check off the main thread (a tick() yield between every heavy step) so the tab
   never freezes and each card fills in as it finishes. Results are cached per
   filter signature, so revisiting the page (same filters) is instant. Trip rows
   (Record Source = "trip") are excluded from the closing-based people/source
   checks — they legitimately carry no foreman / sales person / source. */

const DQ_CACHE = {};   // filter-signature -> computed checks (rows already built)

function _dqSig() {
  const s = RS.state;
  return JSON.stringify([s.dateFrom, s.dateTo, s.dayFrom, s.dayTo,
    Object.entries(s.multi || {}).map(([k, set]) => [k, set && set.size ? [...set].sort() : 0])]);
}
const _tick = () => new Promise(r => setTimeout(r));   // yield to the event loop (paint)

// SCOPE: 2026 onwards. Older rows are history nobody is going back to fix, and carrying
// them made every count read like a mountain (Tornike 2026-07-30).
window.DQ_SINCE = "2026-01-01";
registerPage({
  id: "data-quality",
  group: "settings",
  title: "Data Quality",
  async render(host) {
    // Data Quality is now a HUB: warehouse checks + calendar coverage + request-# consistency as tabs
    // (the latter two register their render on window.DQ_SUB instead of as standalone pages).
    if (!document.getElementById("dq-tabstyle")) {
      const st = document.createElement("style"); st.id = "dq-tabstyle";
      st.textContent = `.dq-tabbar{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:4px 2px 16px;padding-left:2px}
        .dq-tab{appearance:none;border:0;background:none;font-family:inherit;font-size:14px;font-weight:650;color:var(--muted);
          padding:9px 14px;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;transition:color .12s,border-color .12s}
        .dq-tab:hover{color:var(--ink)} .dq-tab.on{color:var(--brand);border-bottom-color:var(--brand)}`;
      document.head.appendChild(st);
    }
    const TABS = [
      { key: "checks", label: "Warehouse checks", render: renderChecks },
      { key: "coverage", label: "Calendar Coverage", render: (window.DQ_SUB || {}).coverage },
      { key: "consistency", label: "Request # Consistency", render: (window.DQ_SUB || {}).consistency },
      { key: "mfissues", label: "Issues in Money Flow", render: (window.DQ_SUB || {}).mfissues },
    ];
    host.innerHTML = `<div class="dq-tabbar" id="dqTabs"></div><div id="dqContent"></div>`;
    const content = host.querySelector("#dqContent");
    let active = "checks";
    const paintTabs = () => {
      document.getElementById("dqTabs").innerHTML = TABS.map(t =>
        `<button class="dq-tab ${t.key === active ? "on" : ""}" data-k="${t.key}">${RSC.esc(t.label)}</button>`).join("");
      document.querySelectorAll("#dqTabs .dq-tab").forEach(b => b.onclick = () => go(b.getAttribute("data-k")));
    };
    const go = async (k) => {
      active = k; paintTabs();
      content.innerHTML = `<div class="rs-loading" style="padding:22px">Loading…</div>`;
      const t = TABS.find(t => t.key === k);
      if (t && typeof t.render === "function") await t.render(content);
      else content.innerHTML = `<div class="rs-loading" style="padding:22px">This view isn't available.</div>`;
    };
    paintTabs();
    await go("checks");
  },
});

async function renderChecks(host) {
    const CAP = 50;

    /* ---- check definitions: title/desc/cols + a compute(ctx) that returns rows ---- */
    const DEFS = [
      { id: "foreman", title: "Foreman missing or “OTHER”",
        desc: "Closing jobs with no foreman (blank or a catch-all like OTHER). Trip rows are excluded.",
        cols: [{ key: "val", label: "Foreman" }, { key: "key", label: "Job / Request #" },
               { key: "date", label: "Move date" }, { key: "customer", label: "Customer" },
               { key: "sales", label: "Sales person" }],
        compute: x => x.closingJobs.filter(r => x.missing(r["Foreman"])).map(r => ({
          val: x.showVal(r["Foreman"]), key: x.cKey(r), date: r._d || "—",
          customer: r["Customer"] || "—", sales: r["Sales Person"] || "—" })) },

      { id: "sales", title: "Sales person missing",
        desc: "A job that HAPPENED, or a lead that went somewhere, with nobody owning it. "
            + "Dead / spam / expired / archived leads are not counted — nobody was ever "
            + "assigned to those and nobody should be (Tornike 2026-07-30).",
        cols: [{ key: "table", label: "Where" }, { key: "val", label: "Sales person" },
               { key: "key", label: "Job / Lead #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }, { key: "why", label: "Why it counts" }],
        compute: x => [
          // a closing IS the action: the job ran, so somebody sold it
          ...x.closingJobs.filter(r => x.missing(r["Sales Person"])).map(r => ({
            table: "Closing", val: x.showVal(r["Sales Person"]), key: x.cKey(r),
            date: r._d || "—", customer: r["Customer"] || "—", why: "job completed" })),
          ...x.moveboard.filter(r => x.missing(r["Assigned"]) && x.leadWentSomewhere(r)).map(r => ({
            table: "Moveboard", val: x.showVal(r["Assigned"]), key: r["Job No"] || "—",
            date: r._d || "—", customer: r["Customer"] || "—",
            why: "still open · " + (r["Status"] || "?") })) ] },

      { id: "dates", title: "Bad dates",
        desc: "Refunds dated in the future or before their move, and move / refund dates whose year looks wrong (before 2019 or after next year). Blank move dates only show when the Date filter is cleared or wide.",
        cols: [{ key: "problem", label: "Problem" }, { key: "table", label: "Where" },
               { key: "key", label: "Request #" }, { key: "date", label: "Date" },
               { key: "customer", label: "Customer" }],
        compute: x => {
          const out = [];
          x.refunds.forEach(r => {
            const rd = x.d10(r["Refund Date"]), md = x.d10(r["Move Date"]);
            if (x.validISO(rd) && rd > x.today) out.push({ problem: "Refund dated in the future", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
            if (x.validISO(rd) && x.validISO(md) && rd < md) out.push({ problem: "Refund dated before the move (" + md + ")", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
            if (x.validISO(rd) && x.badYear(rd)) out.push({ problem: "Refund date year looks wrong", table: "Refund", key: r["Request No"] || "—", date: rd, customer: r["Customer"] || "—" });
          });
          x.closingJobs.forEach(r => {
            if (x.blank(r["Date"])) out.push({ problem: "Closing has no move date", table: "Closing", key: x.cKey(r), date: "(blank)", customer: r["Customer"] || "—" });
            const d = x.d10(r["Date"]);
            if (x.validISO(d) && x.badYear(d)) out.push({ problem: "Move date year looks wrong", table: "Closing", key: x.cKey(r), date: d, customer: r["Customer"] || "—" });
          });
          return out; } },

      { id: "netcash", title: "Closing with no Net Cash",
        desc: "Closing jobs where Net Cash was left blank (a true $0 is not flagged). Trip rows are excluded.",
        cols: [{ key: "key", label: "Job / Request #" }, { key: "date", label: "Move date" },
               { key: "customer", label: "Customer" }, { key: "bill", label: "Revenue", align: "r" }],
        compute: x => x.closingJobs.filter(r => x.blank(r["Net Cash"])).map(r => ({
          key: x.cKey(r), date: r._d || "—", customer: r["Customer"] || "—",
          bill: RS.money(RS.num(r["Total Bill"])) })) },

    ];

    /* ---------------- 1) paint the shell immediately (no compute yet) ---------------- */
    if (!document.getElementById("dq-look")) {
      const st = document.createElement("style"); st.id = "dq-look";
      st.textContent = [
        // A worklist reads badly at full monitor width: the count ends up a screen away from
        // the check it belongs to. So each CARD stays capped -- but the cards now sit in a
        // grid that uses the whole box, instead of one capped column with 700px of nothing
        // either side. An open card takes the full width, because its table needs it.
        // (The old rule capped .dq-head too and centred it with margin-left/right:auto --
        // then the very next rule's `margin:` shorthand reset both to 2px, so the header sat
        // LEFT while the cards it belongs to sat CENTRED, 350px out of line with each other.)
        ".dq-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(620px,1fr));"
        + "gap:0 26px;align-items:start}",
        ".dq-card{max-width:var(--rs-row-max)}",
        ".dq-card.open{grid-column:1/-1;max-width:none}",
        ".dq-head{display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;margin:2px 2px 18px}",
        ".dq-head h1{margin:0 0 5px;font-size:23px;letter-spacing:-.4px}",
        ".dq-head p{margin:0;max-width:640px;color:var(--muted);font-size:13px;line-height:1.55}",
        ".dq-score{margin-left:auto;text-align:right;flex:none}",
        ".dq-score b{display:block;font-size:30px;letter-spacing:-.8px;line-height:1.05;font-variant-numeric:tabular-nums}",
        ".dq-score span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.07em;color:var(--faint)}",
        ".dq-score.clean b{color:var(--pos,#1c7a4a)}",
        ".dq-card{background:var(--panel);border:1px solid var(--line);border-radius:15px;margin-bottom:13px;overflow:hidden}",
        ".dq-card.clean{background:var(--panel-2);border-style:dashed}",
        ".dq-ch{display:flex;align-items:center;gap:11px;padding:13px 16px;cursor:pointer;user-select:none}",
        ".dq-ch:hover{background:var(--panel-2)}",
        ".dq-card.clean .dq-ch:hover{background:transparent}",
        ".dq-dot{width:9px;height:9px;border-radius:50%;flex:none;background:var(--line-2)}",
        ".dq-dot.bad{background:var(--neg,#b02a37)}",
        ".dq-dot.warn{background:#d99100}",
        ".dq-dot.ok{background:var(--pos,#1c7a4a)}",
        ".dq-ttl{font-size:14.5px;font-weight:750;letter-spacing:-.15px}",
        ".dq-cnt{margin-left:auto;font-size:12.5px;font-weight:800;font-variant-numeric:tabular-nums;padding:3px 11px;border-radius:999px;background:var(--panel-2);color:var(--muted);flex:none}",
        ".dq-cnt.bad{background:rgba(176,42,55,.11);color:var(--neg,#b02a37)}",
        ".dq-cnt.warn{background:rgba(217,145,0,.14);color:#a06a00}",
        ".dq-cnt.ok{background:rgba(28,122,74,.12);color:var(--pos,#1c7a4a)}",
        ".dq-caret{flex:none;color:var(--faint);font-size:11px;transition:transform .15s}",
        ".dq-card.open .dq-caret{transform:rotate(90deg)}",
        ".dq-desc{padding:0 16px 12px 36px;color:var(--muted);font-size:12.5px;line-height:1.55;max-width:760px}",
        ".dq-body{display:none;padding:0 6px 8px}",
        ".dq-card.open .dq-body{display:block}",
        ".dq-more{color:var(--faint);font-size:11.5px;padding:7px 12px 3px}"
      ].join("");
      document.head.appendChild(st);
    }
    host.innerHTML = `
      <div class="dq-head">
        <div>
          <h1>Warehouse checks</h1>
          <p>Rows that look wrong or unfinished — fix them at the source sheet.
             <b>2026 onwards</b>, read-only: this page never edits data.</p>
        </div>
        <div class="dq-score" id="dqScore"><b>…</b><span>rows to fix</span></div>
      </div>
      <div id="dqChecks" class="dq-list"></div>`;

    const cont = document.getElementById("dqChecks");
    const panelById = {};
    DEFS.forEach((d) => {
      const panel = RSC.el("div", "dq-card");
      panel.id = "dq-card-" + d.id;
      panel.innerHTML =
        `<div class="dq-ch"><span class="dq-dot" id="dq-dot-${d.id}"></span>
           <span class="dq-ttl">${RSC.esc(d.title)}</span>
           <span class="dq-cnt" id="dq-n-${d.id}">…</span>
           <span class="dq-caret">▶</span></div>
         <div class="dq-desc">${RSC.esc(d.desc)}</div>
         <div class="dq-body" id="dq-body-${d.id}">
           <div style="padding:12px;color:var(--muted);font-size:13px">Checking…</div>
         </div>`;
      // the whole header row toggles it — a check with nothing to fix simply stays shut
      panel.querySelector(".dq-ch").onclick = () => panel.classList.toggle("open");
      cont.appendChild(panel);
      panelById[d.id] = {};
    });

    const paintPanel = (d, rows) => {
      const n = rows.length;
      const card = document.getElementById("dq-card-" + d.id);
      const nEl = document.getElementById("dq-n-" + d.id);
      const dot = document.getElementById("dq-dot-" + d.id);
      const body = document.getElementById("dq-body-" + d.id);
      // severity is simply size: clear / a handful / a pile. It drives the dot and the
      // pill so the state of every check reads at a glance without opening anything.
      const lvl = !n ? "ok" : n > 100 ? "bad" : "warn";
      if (nEl) { nEl.textContent = n ? RS.fmtN(n) : "clear"; nEl.className = "dq-cnt " + lvl; }
      if (dot) dot.className = "dq-dot " + lvl;
      if (card) card.classList.toggle("clean", !n);
      if (!body) return;
      if (!n) {
        body.innerHTML = `<div style="padding:10px 12px 14px;color:var(--muted);font-size:13px">Nothing to fix here.</div>`;
      } else {
        const shown = rows.slice(0, CAP);
        body.innerHTML = RSC.table(d.cols, shown)
          + (n > CAP ? `<div class="dq-more">showing ${CAP} of ${RS.fmtN(n)} — narrow the filters to see the rest</div>` : "");
      }
    };
    const paintTotal = results => {
      const el = document.getElementById("dqScore");
      if (!el) return;
      const n = results.reduce((a, r) => a + r.rows.length, 0);
      el.innerHTML = `<b>${RS.fmtN(n)}</b><span>${n ? "rows to fix" : "all clear"}</span>`;
      el.classList.toggle("clean", !n);
    };

    /* ---------------- 2) cache hit → paint instantly and stop ---------------- */
    const sig = _dqSig();
    if (DQ_CACHE[sig]) {
      DQ_CACHE[sig].forEach(r => paintPanel(DEFS.find(d => d.id === r.id), r.rows));
      paintTotal(DQ_CACHE[sig]);
      return;
    }

    /* ---------------- 3) compute in the background, painting progressively ---------------- */
    await _tick();   // let the shell paint before we start the heavy work
    const [closingAll, moveboardAll, refundsAll, leadsAll, claimsAll] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("refunds"),
      RS.load("leads"), RS.load("claims")]);
    await _tick();

    // filter each dataset with a yield between them (keeps the longest block short)
    const ctx = {};
    // 2026+ only. A row with NO date is KEPT — "the date is missing" is itself one of the
    // faults this page exists to catch, so a date rule must not hide it.
    const since = rows => rows.filter(r => !r._d || r._d >= window.DQ_SINCE);
    ctx.closing = since(RS.filtered("closing", closingAll)); await _tick();
    ctx.moveboard = since(RS.filtered("moveboard", moveboardAll)); await _tick();
    ctx.refunds = since(RS.filtered("refunds", refundsAll)); await _tick();
    ctx.leads = since(RS.filtered("leads", leadsAll)); await _tick();
    ctx.claims = since(RS.filtered("claims", claimsAll)); await _tick();

    // shared predicates / helpers passed to each check's compute()
    const isTrip = r => String(r["Record Source"] || "").trim().toLowerCase() === "trip";
    ctx.closingJobs = ctx.closing.filter(r => !isTrip(r));
    ctx.blank = v => v == null || String(v).trim() === "";
    const PLACEHOLDER = new Set(["other", "unknown", "unmapped", "n/a", "na", "none",
      "tbd", "test", "-", "--", "?", ".", "null", "undefined", "xxx", "x"]);
    const norm = v => String(v == null ? "" : v).trim().toLowerCase();
    ctx.missing = v => ctx.blank(v) || PLACEHOLDER.has(norm(v));
    // A lead only needs an owner once it went somewhere. Dead / spam / expired / archived
    // leads never had one and never will — counting them buried the handful that matter
    // (263 flagged, 259 of them dead; Tornike 2026-07-30).
    const DEAD_LEAD = new Set(["dead lead", "spam", "archive", "expired",
                               "we are not available", "not interested", "duplicate"]);
    // NOT "Booked Date" -- measured 2026-07-30: all 263 unassigned leads carry one,
    // including every Dead Lead and Archive, so it timestamps the request and not a
    // booking. Status is the only honest signal of a lead that went somewhere.
    ctx.leadWentSomewhere = r =>
      norm(r["Status Category"]) !== "bad lead" && !DEAD_LEAD.has(norm(r["Status"]));
    ctx.showVal = v => ctx.blank(v) ? "(blank)" : String(v);
    ctx.cKey = r => r["Request #"] || r["Unique Key"] || "—";
    ctx.today = new Date().toISOString().slice(0, 10);
    const curYear = new Date().getFullYear();
    ctx.d10 = v => String(v == null ? "" : v).slice(0, 10);
    ctx.validISO = s => /^\d{4}-\d{2}-\d{2}$/.test(s);
    ctx.badYear = s => { const y = +s.slice(0, 4); return y < 2019 || y > curYear + 1; };

    // guard: if the user navigated away while we were loading, don't paint stale DOM.
    // MUST name an element the shell actually renders -- it pointed at #dqTotal after that
    // element was replaced by #dqScore, so every check silently stayed on "..." (2026-07-30).
    const stillHere = () => document.getElementById("dqScore");

    const results = [];
    for (const d of DEFS) {
      const rows = d.compute(ctx);
      results.push({ id: d.id, rows });
      if (stillHere()) paintPanel(d, rows);
      await _tick();
    }
    DQ_CACHE[sig] = results;
    if (stillHere()) paintTotal(results);
}
