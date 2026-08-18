/* ADMIN page: Source Trace — a per-job diagnostic that shows how one closing job's lead
   SOURCE is decided, framed the way the transformation actually works: the two raw inputs
   (the source on the Moveboard, the source on the Closing sheet), then the priority ladder
   that reconciles them into the final source, and whether the PBIX-faithful answer matches
   what the pipeline stores now. Read-only.

   DATA: one warehouse table `source_trace`, ONE ROW PER CLOSING JOB (Record Source =
   closing), looked up by `Request #`, ~15k rows. Loaded once via RS.load and filtered
   in memory — the global date/company filter bar does NOT apply here (PAGE_DATASETS
   entry is [] in index.html, same as Data Quality), so an admin can look up ANY job.

   The table is registered as an RS dataset from HERE (RS.DATASETS.source_trace) so
   rs-core.js stays untouched — no shared-asset version bump needed. */

(function () {
  // register both datasets the first time this module loads (RS.load needs a spec)
  if (window.RS && RS.DATASETS && !RS.DATASETS.source_trace) {
    RS.DATASETS.source_trace = {
      table: "source_trace",
      cols: [
        "Request #", "Job Code", "Customer", "Move Date", "Company",
        "Closing Booked From", "Moveboard Raw Source", "Customer Phone",
        "CallRail Number Name", "CallRail Translated", "Google Local Match",
        "Phone-Matched Source", "Moveboard Source (merged)", "Translated Source",
        "Pickup State", "Source Connector", "Closing Source From Moveboard",
        "Closing Corrected Source", "Final Source (faithful)", "Final Source (current)",
        "Matches Current", "Match Path",
        "Meta Referral Match", "Meta Match Phone", "Meta Match Email", "Meta Form Date",
        "Angi Match", "Angi Match Key", "Thumbtack Match", "Thumbtack Match Key",
        "Final Source (with leads)",
      ],
    };
  }
  if (window.RS && RS.DATASETS && !RS.DATASETS.source_trace_moveboard) {
    RS.DATASETS.source_trace_moveboard = {
      table: "source_trace_moveboard",
      cols: [
        "Job No", "Company", "Customer", "Move Date", "Create Date", "Customer Phone",
        "Moveboard Raw Source", "CallRail Number Name", "CallRail Translated",
        "Google Local Match", "Merged Source", "Translated Source", "Pickup State",
        "Source Connector", "Angi Match", "Angi Match Key", "Thumbtack Match",
        "Thumbtack Match Key", "Source Connector (with leads)", "Match Path",
        "Meta Referral Match", "Meta Match Phone", "Meta Match Email", "Meta Form Date",
      ],
    };
  }
})();

/* persists the admin's lookup across incidental re-renders (a global filter change still
   re-runs render() even though this page ignores those filters) */
const ST_STATE = { q: "", sel: null, mode: "closing", rung: null, page: 0 };

registerPage({
  id: "source-trace",
  group: "settings",
  title: "Source Trace",
  async render(host) {
    const CAP = 40;                                   // max search results shown at once
    const yes = v => String(v == null ? "" : v).trim().toLowerCase() === "yes";
    const blank = v => v == null || String(v).trim() === "";
    const show = v => blank(v) ? "—" : String(v);     // display a value or an em-dash
    const has = v => !blank(v);
    const norm = s => String(s == null ? "" : s).trim().toLowerCase();

    /* start-to-finish value trail: [{label, value, note?, chg?, raw?, fin?}] — note may hold HTML */
    const chainStrip = steps => `<div class="strc-chain">` + steps.map(s => {
      const cls = s.raw ? "raw" : s.fin ? "fin" : s.chg ? "chg" : "";
      const badge = s.raw ? "0" : s.fin ? "★" : (s.badge || "");
      return `<div class="strc-step ${cls}">
          <div class="strc-dot">${badge}</div>
          <div class="strc-sbody">
            <div class="strc-slab">${RSC.esc(s.label)}</div>
            <div class="strc-sval">${RSC.esc(show(s.value))}</div>
            ${s.note ? `<div class="strc-snote">${s.note}</div>` : ""}
          </div>
        </div>`;
    }).join("") + `</div>`;

    /* the phone-match value + human note, shared by both traces */
    const phoneMatch = (crnn, crtr, gl) => ({
      value: has(crnn) ? (has(crtr) ? crtr : crnn) : (gl ? "Google Local" : "—"),
      qr: viaQR(crnn),
      note: has(crnn)
        ? `Customer phone matched CallRail <b>${RSC.esc(crnn)}</b>${has(crtr) && norm(crtr) !== norm(crnn) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : ""}${gl ? " — <b>CallRail beats Google Local</b>" : ""}${viaQR(crnn) ? " They <b>scanned the QR code</b> on the postcard." : ""}.`
        : gl ? `Customer phone matched a <b>Google Local</b> lead.`
             : `No phone match — the raw booked source carries through.`,
      chg: has(crnn) || gl,
    });

    /* VIA QR. The trace already prints the Number Name, so the fact was technically on the
       page — three characters inside a longer string, in a row nobody reads unless they are
       already suspicious. Tornike asked to SEE that a customer found us via a QR code (N2,
       2026-08-07), and the postcards carry one. Of the 37 Number Names CallRail has ever
       used, exactly three contain QR, so the test needs nothing cleverer than a substring. */
    const viaQR = crnn => /qr/i.test(String(crnn || ""));

    /* Post-Card region note: did the region come from the pickup state, or was it baked into the
       tracking number's label (e.g. CallRail "Postcard NY - QR" → NY, regardless of pickup state)? */
    const pcRegionNote = (resolved, pstate) => {
      const m = /post card\s*-\s*(.+)$/i.exec(String(resolved || ""));
      if (!m) return "";
      const region = m[1].trim();
      return (pstate && norm(region) === norm(pstate))
        ? ` Post Card → region <b>${RSC.esc(region)}</b> from the pickup state.`
        : ` Post Card → region <b>${RSC.esc(region)}</b> from the tracking number's label${has(pstate) ? ` (pickup state is <b>${RSC.esc(pstate)}</b>)` : ""}.`;
    };

    // one-time style block: two input cards, the priority ladder, the final chip, the verdict
    if (!document.getElementById("strc-style")) {
      const st = document.createElement("style");
      st.id = "strc-style";
      st.textContent = `
        #stSearch{width:100%;max-width:520px;padding:11px 14px;border-radius:11px;
          border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:14px;font-family:inherit;outline:none}
        #stSearch:focus{border-color:var(--brand)}
        .strc-modes{display:inline-flex;gap:2px;background:var(--panel);border:1px solid var(--line-2);
          border-radius:11px;padding:3px;margin-bottom:13px}
        .strc-modes button{border:0;background:transparent;color:var(--muted);font-family:inherit;
          font-size:13px;font-weight:700;padding:7px 15px;border-radius:8px;cursor:pointer}
        .strc-modes button.on{background:var(--brand);color:var(--brand-ink)}
        .strc-results{margin-top:12px}
        /* min(320px,100%) so it never overflows a narrow pane, and auto-fit so the six
           rungs spread across whatever width the screen actually gives them: 3x2 on a
           laptop, 6 across on a wide monitor, rather than a fixed column count. */
        /* strc-how* on purpose: .strc-ladder/.strc-rule already belong to the per-job trace
           below, and a second .strc-ladder here simply lost the cascade to it. A plain px floor,
           not min()/clamp() inside repeat() -- keep this one boringly resolvable.
           The whole sheet is strc-* because sales-team.js owns the st-* namespace AND had
           claimed the id "st-style": whichever page loaded first won, and the other rendered
           with no CSS at all. Keep this prefix unique -- scripts/lint_page_css.py checks. */
        .strc-howgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:12px}
        .strc-howrung{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;
          padding:13px 15px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
        .strc-hown{width:26px;height:26px;border-radius:8px;background:var(--brand);color:var(--brand-ink);
          font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
        .strc-howt{font-size:13.5px;font-weight:700;color:var(--ink)}
        .strc-howd{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.5}
        /* the 1fr was the customer NAME, so on a wide screen a search hit read as
           "#110292  Jane Doe .................................. Google  chip" with 1600px
           of nothing in the middle. Flexible track LAST: the five cells sit together and
           the slack goes to the empty end of the row. */
        .strc-chips{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin:12px 0 4px}
  .strc-chip{font:inherit;font-size:12.5px;font-weight:650;color:var(--ink);background:var(--panel);
    border:1px solid var(--line-2);border-radius:999px;padding:5px 12px;cursor:pointer;display:inline-flex;gap:7px;align-items:center}
  .strc-chip:hover{border-color:var(--brand)}
  .strc-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
  .strc-chip .c{font-size:11px;opacity:.75;font-variant-numeric:tabular-nums}
  .strc-chip.clear{color:var(--faint);border-style:dashed}
  .strc-btab{width:100%;border-collapse:collapse;font-size:13px}
  .strc-btab th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
    color:var(--faint);padding:0 12px 7px 0;border-bottom:1px solid var(--line)}
  .strc-btab td{padding:7px 12px 7px 0;border-bottom:1px solid color-mix(in srgb,var(--line) 55%,transparent)}
  .strc-btab tbody tr{cursor:pointer}
  .strc-btab tbody tr:hover td{background:var(--panel-2)}
  .strc-btab td.d{color:var(--muted);font-variant-numeric:tabular-nums;white-space:nowrap}
  .strc-btab td.k{color:var(--muted);font-family:ui-monospace,monospace;font-size:11.5px}
  .strc-pager{display:flex;align-items:center;justify-content:center;gap:14px;padding:12px 0 2px;font-size:12.5px;color:var(--muted)}
  .strc-pg{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);
    border:1px solid var(--line-2);border-radius:9px;padding:6px 13px;cursor:pointer}
  .strc-pg:hover:not(:disabled){border-color:var(--brand)}
  .strc-pg:disabled{opacity:.4;cursor:default}
  .strc-hit{display:grid;grid-template-columns:auto auto auto auto minmax(0,1fr);gap:10px 16px;
          align-items:center;padding:10px 14px;border:1px solid var(--line);border-radius:11px;
          margin-bottom:7px;cursor:pointer;background:var(--panel-2)}
        .strc-hit:hover{border-color:var(--brand);background:var(--panel)}
        .strc-hit b{color:var(--ink);font-size:13.5px}
        .strc-hit .strc-mini{color:var(--muted);font-size:12.5px}
        .strc-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
        .strc-tag.ok{background:var(--brand-glow);color:var(--brand-d)}
        .strc-tag.bad{background:rgba(248,113,113,.14);color:var(--red)}
        .strc-lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--faint)}
        .strc-note{font-size:12.5px;color:var(--muted);line-height:1.55}
        .strc-note .strc-em{color:var(--amber);font-weight:700}
        .strc-note b{color:var(--ink)}
        /* two raw-input cards */
        .strc-io{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:2px 0 20px}
        @media(max-width:640px){.strc-io{grid-template-columns:1fr}}
        .strc-cell{border:1px solid var(--line-2);border-radius:13px;padding:14px 16px;background:var(--panel-2)}
        .strc-cell .num{display:inline-flex;width:20px;height:20px;border-radius:6px;margin-right:7px;
          background:var(--panel);border:1px solid var(--line-2);color:var(--muted);
          font-size:11px;font-weight:800;align-items:center;justify-content:center;vertical-align:middle}
        .strc-cell .big{font-size:18px;font-weight:800;color:var(--ink);margin:6px 0 6px}
        /* the priority ladder */
        .strc-sechead{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
          color:var(--muted);margin:2px 0 11px}
        .strc-sechead span{color:var(--faint);font-weight:700;text-transform:none;letter-spacing:0}
        .strc-cap{font-size:12px;font-weight:600;color:var(--faint);margin-left:8px}
        .strc-ladder{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
        .strc-rule{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;
          padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
        .strc-rule.won{border-color:var(--brand-d);background:var(--brand-glow)}
        .strc-rule.skip{opacity:.52}
        .strc-badge{width:26px;height:26px;border-radius:8px;background:var(--panel);
          border:1px solid var(--line-2);color:var(--muted);font-size:12px;font-weight:800;
          display:flex;align-items:center;justify-content:center}
        .strc-rule.won .strc-badge{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .strc-rule .rt{font-size:14px;font-weight:700;color:var(--ink)}
        .strc-rule.skip .rt{font-weight:600}
        .strc-rule .rd{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.5}
        .strc-rule .rs{font-size:12.5px;font-weight:800;margin-top:6px;display:flex;align-items:center;gap:6px}
        .strc-rule.won .rs{color:var(--brand-d)}
        .strc-rule .rs.na{color:var(--faint);font-weight:700}
        /* final source chip */
        /* space-between on a full-width bar threw "FINAL SOURCE" and its value to opposite
           ends of a solid lime slab ~1740px apart. The chip now shrinks to its content, so
           the label sits next to the answer and the bar stops pretending to be a table. */
        .strc-final{display:inline-flex;align-items:baseline;gap:14px;width:max-content;max-width:100%;
          padding:15px 18px;border-radius:14px;background:var(--brand);color:var(--brand-ink);margin-bottom:16px}
        .strc-final .fl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;opacity:.9}
        .strc-final .fv{font-size:22px;font-weight:800}
        /* faithful vs current + verdict */
        .strc-cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:640px){.strc-cmp{grid-template-columns:1fr}.strc-hit{grid-template-columns:1fr 1fr}}
        .strc-cmp .strc-cell .big{font-size:17px;margin:4px 0 0}
        .strc-verdict{margin-top:14px;border-radius:13px;padding:14px 16px;font-size:14px;line-height:1.55}
        .strc-verdict.ok{background:var(--brand-glow);border:1px solid var(--brand-d)}
        .strc-verdict.bad{background:rgba(248,113,113,.12);border:1px solid var(--red)}
        .strc-verdict.warn{background:rgba(245,158,11,.12);border:1px solid var(--amber)}
        .strc-verdict .vt{font-weight:800;font-size:15px;display:block;margin-bottom:3px}
        .strc-verdict.ok .vt{color:var(--brand-d)}
        .strc-verdict.bad .vt{color:var(--red)}
        .strc-verdict.warn .vt{color:var(--amber)}
        .strc-path{margin-top:8px;font-size:13px;color:var(--muted)}
        .strc-path code{background:var(--panel);border:1px solid var(--line);border-radius:7px;
          padding:2px 8px;color:var(--ink);font-size:12.5px}
        /* start-to-finish transformation chain */
        .strc-chain{display:flex;flex-direction:column;margin:4px 0 20px}
        .strc-step{position:relative;display:grid;grid-template-columns:26px 1fr;gap:13px;padding:0 0 16px}
        .strc-step:last-child{padding-bottom:0}
        .strc-step:not(:last-child)::before{content:"";position:absolute;left:12px;top:26px;bottom:0;
          width:2px;background:var(--line-2)}
        .strc-dot{width:26px;height:26px;border-radius:50%;background:var(--panel);border:2px solid var(--line-2);
          display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;
          color:var(--muted);z-index:1}
        .strc-step.chg .strc-dot{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .strc-step.raw .strc-dot{background:var(--ink);border-color:var(--ink);color:var(--panel)}
        .strc-step.fin .strc-dot{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .strc-sbody{padding-top:0}
        .strc-slab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint)}
        .strc-sval{font-size:15.5px;font-weight:800;color:var(--ink);margin:1px 0 1px}
        .strc-step.chg .strc-sval,.strc-step.fin .strc-sval{color:var(--brand-d)}
        .strc-step.raw .strc-sval{font-size:17px}
        .strc-snote{font-size:12px;color:var(--muted);line-height:1.45}
        .strc-snote b{color:var(--ink)}`;
      document.head.appendChild(st);
    }

    /* ---------------- shell ---------------- */
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Source Trace</h1>
        <p>Look up any job and see how its lead <b>source</b> is decided, step by step — the
           priority ladder (incl. <b>Meta Referral</b> forms, CallRail, Google Local,
           <b>Angi</b> / <b>Thumbtack</b> lead-data matching, Post Card region) that resolves it. Switch between the
           <b>Closing</b> sheet source and the upstream <b>Moveboard</b> source.
           <span class="freshness">· read-only</span></p>
      </div>
      <div class="panel">
        <div style="padding:14px 16px">
          <div class="strc-modes" id="stModes">
            <button data-mode="closing" class="on">Closing jobs</button>
            <button data-mode="moveboard">Moveboard leads</button>
          </div>
          <input id="stSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, Job Code, or customer name…">
          <div class="strc-note" style="margin-top:8px" id="stCount">Loading…</div>
        </div>
        <div id="stResults" class="strc-results" style="padding:0 16px 8px"></div>
      </div>
      <div id="stChips" class="strc-chips"></div>
      <div id="stBrowse"></div>
      <div id="stIdle"></div>
      <div id="stTrace"></div>`;

    /* The page spends most of its life waiting for someone to type, and it used to spend that
       time as a small box in the corner of an empty screen. The ladder below is the whole
       point of the report — the order the rungs are tried in is exactly what a trace walks —
       so showing it while idle answers "how is source decided?" without anyone searching, and
       gives the screen something to hold. It clears the moment a job is opened. */
    const LADDER = [
      { n: 1, t: "Returned customer",
        d: "Booked as a returning customer. Wins outright — ahead of any phone, lead or postcard match." },
      { n: 2, t: "Recommended",
        d: "Somebody sent them. Kept as recorded, ahead of any phone or lead match — a referral is not outranked by the number they happened to dial." },
      { n: 3, t: "Meta Referral — referral form match",
        d: "Phone or email matches a Meta referral form, and the lead came in on or after that form, within 90 days. Beats every phone and lead match below it." },
      { n: 4, t: "Google Local phone match",
        d: "The customer's phone matched a Google Local lead, and no CallRail postcard overrides it." },
      { n: 5, t: "Post Card — region from pickup state",
        d: "Resolves to a Post Card, and the region comes from the pickup state rather than the tracking number's label." },
      { n: 6, t: "Angi — lead-data match",
        d: "Matched an Angi lead on its own data. Only ever intercepts the fallback — it never outranks the rungs above." },
      { n: 7, t: "Thumbtack — lead-data match",
        d: "Same as Angi, one rung lower: it takes the fallback but never beats a higher rung." },
      { n: 8, t: "Whatever the sheet says",
        d: "Nothing above matched, so the source stands as recorded — the Closing sheet's own value, or what it was booked from." },
    ];
    document.getElementById("stIdle").innerHTML = `
      <div class="panel">
        <div class="panel-head"><h3 style="margin:0">How a source is decided</h3>
          <span class="strc-cap">the ladder every trace walks, in order — the first rung that matches wins</span></div>
        <div class="strc-howgrid">${LADDER.map(r => `
          <div class="strc-howrung">
            <div class="strc-hown">${r.n}</div>
            <div><div class="strc-howt">${RSC.esc(r.t)}</div>
                 <div class="strc-howd">${RSC.esc(r.d)}</div></div>
          </div>`).join("")}</div>
      </div>`;

    const inp = document.getElementById("stSearch");
    const countEl = document.getElementById("stCount");
    const resultsEl = document.getElementById("stResults");
    const traceEl = document.getElementById("stTrace");
    const modesEl = document.getElementById("stModes");

    /* WHICH RUNG WON — the single definition, used by the browse list AND by each
       trace's ladder. Kept here rather than inside the renderers so a job cannot be
       listed under one rung and then shown winning a different one. */
    const RUNGS = {
      // Returned and Recommended are SEPARATE rungs (2026-08-18): they were one line
      // reading "Returned / Recommended", which made the two tabs look irreconcilable
      // — 2,145 here against 249 there — when the Moveboard side simply had no
      // Recommended rung and its ~2,400 Recommended leads sat in the raw bucket.
      closing: ["Returned Customer", "Recommended", "Meta Referral", "Google Local",
                "Post Card", "Angi", "Thumbtack", "Whatever the sheet says"],
      moveboard: ["Returned Customer", "Recommended", "Meta Referral", "CallRail",
                  "Post Card", "Google Local", "Angi", "Thumbtack", "Raw booked source"],
    };
    function winClosing(r) {
      const lc = String(r["Match Path"] || "").toLowerCase();
      const isPost = /post card/.test(norm(r["Final Source (faithful)"])) || /post card/.test(norm(r["Source Connector"]));
      if (/returned customer/.test(lc)) return 1;
      if (/recommended/.test(lc)) return 2;
      if (yes(r["Meta Referral Match"])) return 3;
      if (/google local/.test(lc)) return 4;
      if (isPost) return 5;
      if (yes(r["Angi Match"])) return 6;
      if (yes(r["Thumbtack Match"])) return 7;
      return 8;
    }
    function winMoveboard(r) {
      // Follows the Match Path the BUILD wrote, in the build's own order
      // (curated.py: Returned > Meta > CallRail > Post Card > Google Local > raw).
      //
      // Angi/Thumbtack used to be decided by comparing `Source Connector (with leads)`
      // against `Source Connector` — but those two columns are identical in all 77,770
      // rows, so both rungs could never win and the tab showed 0 for each while 10,120
      // leads matched Angi and 2,648 matched Thumbtack (measured 2026-08-18). They are
      // read from the match flags now, exactly like the Closing tab does.
      const lc = String(r["Match Path"] || "").toLowerCase();
      if (lc.includes("returned customer")) return 1;
      if (lc.includes("recommended")) return 2;
      if (yes(r["Meta Referral Match"])) return 3;
      if (lc.indexOf("callrail") === 0) return 4;
      if (lc.includes("post card")) return 5;
      if (lc.includes("google local")) return 6;
      if (yes(r["Angi Match"])) return 7;
      if (yes(r["Thumbtack Match"])) return 8;
      return 9;
    }

    /* ---------------- mode config (closing jobs / moveboard leads) ---------------- */
    let rows = [];             // current mode's dataset
    const loaded = {};         // dataset name -> rows (loaded lazily, once)

    const MODES = {
      closing: {
        dataset: "source_trace", unit: "closing job",
        placeholder: "Search by Request #, Job Code, or customer name…",
        // JOB CODE FIRST, because it is the only value here that is unique per ROW. `Request
        // Joinkey` is not in this payload at all, so the key fell through to `Request #` —
        // which repeats across the legs of one move and across the two Moveboard accounts, so
        // clicking a search hit could open a DIFFERENT job's trace than the one clicked
        // (full scan, 2026-08-12). Job Code is the closing Unique Key.
        key: r => r["Job Code"] || r["Request Joinkey"] || r["Request #"],
        match: (r, nq) => norm(r["Request #"]).includes(nq) || norm(r["Job Code"]).includes(nq) || norm(r["Customer"]).includes(nq),
        exact: (r, nq) => norm(r["Request #"]) === nq,
        hit: r => {
          const ch = norm(r["Final Source (with leads)"]) !== norm(r["Final Source (current)"]);
          return `<b>#${RSC.esc(show(r["Request #"]))}</b>
            <span class="strc-mini">${RSC.esc(show(r["Job Code"]))}</span>
            <span class="strc-mini">${RSC.esc(show(r["Customer"]))}</span>
            <span class="strc-mini">${RSC.esc(show(r["Final Source (with leads)"]))}</span>
            <span class="strc-tag ${ch ? "bad" : "ok"}">${ch ? "Lead-flip" : "Stable"}</span>`;
        },
        render: renderClosing,
        win: winClosing,
        date: r => String(r["Move Date"] || "").slice(0, 10),
        cells: r => [`#${show(r["Request #"])}`, show(r["Customer"]),
                     show(r["Final Source (with leads)"]),
                     show(r["Meta Match Phone"] || r["Meta Match Email"] || r["Angi Match Key"]
                          || r["Thumbtack Match Key"] || r["CallRail Number Name"] || "")],
      },
      moveboard: {
        dataset: "source_trace_moveboard", unit: "moveboard lead",
        placeholder: "Search by Moveboard #, customer name, or phone…",
        key: r => r["Request Joinkey"] || (String(r["Job No"]) + "|" + (r["Company"] || "")),
        match: (r, nq) => {
          const dg = nq.replace(/[^0-9]/g, "");
          return norm(r["Job No"]).includes(nq) || norm(r["Customer"]).includes(nq)
            || (dg.length >= 4 && String(r["Customer Phone"] || "").replace(/[^0-9]/g, "").includes(dg));
        },
        exact: (r, nq) => norm(r["Job No"]) === nq,
        hit: r => {
          const ch = norm(r["Source Connector (with leads)"]) !== norm(r["Source Connector"]);
          return `<b>#${RSC.esc(show(r["Job No"]))}</b>
            <span class="strc-mini">${RSC.esc(show(r["Company"]))}</span>
            <span class="strc-mini">${RSC.esc(show(r["Customer"]))}</span>
            <span class="strc-mini">${RSC.esc(show(r["Source Connector (with leads)"]))}</span>
            <span class="strc-tag ${ch ? "bad" : "ok"}">${ch ? "Lead-flip" : "Stable"}</span>`;
        },
        render: renderMoveboard,
        win: winMoveboard,
        date: r => String(r["Create Date"] || r["Move Date"] || "").slice(0, 10),
        cells: r => [`#${show(r["Job No"])}`, show(r["Customer"]),
                     show(r["Source Connector (with leads)"]),
                     show(r["Meta Match Phone"] || r["Meta Match Email"] || r["Angi Match Key"]
                          || r["Thumbtack Match Key"] || r["CallRail Number Name"] || "")],
      },
    };

    async function loadMode(mode) {
      const m = MODES[mode];
      inp.placeholder = m.placeholder;
      if (loaded[m.dataset]) { rows = loaded[m.dataset]; return true; }
      countEl.textContent = "Loading " + m.unit + "s…" + (mode === "moveboard" ? " (108k — one moment)" : "");
      try {
        rows = loaded[m.dataset] = await RS.load(m.dataset);
      } catch (e) {
        countEl.innerHTML = `<span class="err">Couldn't load — ${RSC.esc(e.message)}</span>`;
        return false;
      }
      return !!document.getElementById("stSearch");   // false if navigated away mid-load
    }

    /* ---------------- search + results list (mode-aware) ---------------- */
    const idleCount = () => {
      const m = MODES[ST_STATE.mode];
      countEl.textContent = RS.fmtN(rows.length) + " " + m.unit + "s loaded · start typing to find one";
    };
    function runSearch(q) {
      ST_STATE.q = q;
      if (q) { ST_STATE.rung = null; const b = document.getElementById("stBrowse");
               if (b) b.innerHTML = ""; paintChips(); }
      const m = MODES[ST_STATE.mode];
      const nq = norm(q);
      resultsEl.innerHTML = "";
      if (!nq) { idleCount(); return; }
      const hits = rows.filter(r => m.match(r, nq));
      const exact = hits.find(r => m.exact(r, nq));
      if (exact) openTrace(m.key(exact));
      countEl.textContent = hits.length
        ? RS.fmtN(hits.length) + " match" + (hits.length === 1 ? "" : "es") + (hits.length > CAP ? " · showing first " + CAP : "")
        : "No " + m.unit + "s match “" + q + "”.";
      resultsEl.innerHTML = hits.slice(0, CAP).map(r =>
        `<div class="strc-hit" data-k="${RSC.esc(m.key(r))}">${m.hit(r)}</div>`).join("");
      resultsEl.querySelectorAll(".strc-hit").forEach(el => el.onclick = () => openTrace(el.dataset.k));
    }

    /* ---------------- BROWSE BY RUNG ----------------------------------------
       "show me every lead matched by Meta Referral" — the report could only answer
       one job at a time before. 100 rows a page, newest first, click through to the
       full trace. All client-side: the dataset is already loaded for the search. */
    const PAGE = 100;
    function paintChips() {
      const el = document.getElementById("stChips");
      if (!el) return;
      const m = MODES[ST_STATE.mode];
      const counts = {};
      rows.forEach(r => { const w = m.win(r); counts[w] = (counts[w] || 0) + 1; });
      el.innerHTML = `<span class="strc-cap" style="margin-right:4px">Matched by</span>`
        + RUNGS[ST_STATE.mode].map((lab, i) => {
            const n = i + 1, on = ST_STATE.rung === n;
            return `<button class="strc-chip${on ? " on" : ""}" data-rung="${n}">${RSC.esc(lab)}
              <span class="c">${RS.fmtN(counts[n] || 0)}</span></button>`;
          }).join("")
        + (ST_STATE.rung ? `<button class="strc-chip clear" data-rung="0">clear</button>` : "");
      el.querySelectorAll("[data-rung]").forEach(b => b.onclick = () => {
        const n = +b.dataset.rung;
        ST_STATE.rung = (n === 0 || ST_STATE.rung === n) ? null : n;
        ST_STATE.page = 0;
        paintChips(); paintBrowse();
      });
    }
    function paintBrowse() {
      const el = document.getElementById("stBrowse");
      const idleEl = document.getElementById("stIdle");
      if (!el) return;
      if (!ST_STATE.rung) { el.innerHTML = ""; if (idleEl) idleEl.style.display = ""; return; }
      const m = MODES[ST_STATE.mode];
      if (idleEl) idleEl.style.display = "none";
      traceEl.innerHTML = "";
      const hits = rows.filter(r => m.win(r) === ST_STATE.rung)
        .sort((a, b) => String(m.date(b)).localeCompare(String(m.date(a))));
      const pages = Math.max(1, Math.ceil(hits.length / PAGE));
      if (ST_STATE.page >= pages) ST_STATE.page = 0;
      const slice = hits.slice(ST_STATE.page * PAGE, ST_STATE.page * PAGE + PAGE);
      const label = RUNGS[ST_STATE.mode][ST_STATE.rung - 1];
      el.innerHTML = `<div class="panel">
        <div class="panel-head"><h3 style="margin:0">Matched by ${RSC.esc(label)}</h3>
          <span class="strc-cap">${RS.fmtN(hits.length)} ${m.unit}${hits.length === 1 ? "" : "s"}
            · newest first · page ${ST_STATE.page + 1} of ${pages}</span></div>
        <table class="strc-btab"><thead><tr><th>Date</th><th>${
          ST_STATE.mode === "closing" ? "Request #" : "Moveboard #"}</th><th>Customer</th>
          <th>Source</th><th>Matched on</th></tr></thead><tbody>
          ${slice.map(r => `<tr data-k="${RSC.esc(m.key(r))}">
            <td class="d">${RSC.esc(m.date(r))}</td>
            ${m.cells(r).map((c, i) => `<td${i === 3 ? ' class="k"' : ""}>${RSC.esc(c)}</td>`).join("")}
          </tr>`).join("")}
        </tbody></table>
        ${pages > 1 ? `<div class="strc-pager">
          <button class="strc-pg" data-pg="prev"${ST_STATE.page === 0 ? " disabled" : ""}>‹ Newer</button>
          <span>${RS.fmtN(ST_STATE.page * PAGE + 1)}–${RS.fmtN(Math.min(hits.length, (ST_STATE.page + 1) * PAGE))} of ${RS.fmtN(hits.length)}</span>
          <button class="strc-pg" data-pg="next"${ST_STATE.page >= pages - 1 ? " disabled" : ""}>Older ›</button>
        </div>` : ""}
      </div>`;
      el.querySelectorAll("tbody tr").forEach(tr => tr.onclick = () => openTrace(tr.dataset.k));
      el.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => {
        ST_STATE.page += b.dataset.pg === "next" ? 1 : -1;
        paintBrowse();
        el.scrollIntoView({ block: "start", behavior: "smooth" });
      });
    }

    /* dispatch a trace to the current mode's renderer */
    function openTrace(key) {
      const m = MODES[ST_STATE.mode];
      ST_STATE.sel = key;
      const r = rows.find(x => String(m.key(x)) === String(key));
      const idleEl = document.getElementById("stIdle");
      if (!r) { traceEl.innerHTML = ""; if (idleEl) idleEl.style.display = ""; return; }
      if (idleEl) idleEl.style.display = "none";
      m.render(r);
    }

    /* ---------------- CLOSING trace (Request # grain) ---------------- */
    function renderClosing(r) {
      const bf     = r["Closing Booked From"];
      const mbraw  = r["Moveboard Raw Source"];
      const crnn   = r["CallRail Number Name"];
      const crtr   = r["CallRail Translated"];
      const gl     = yes(r["Google Local Match"]);
      const merged = r["Moveboard Source (merged)"];
      const tran   = r["Translated Source"];
      const pstate = r["Pickup State"];
      const mbSrc  = r["Source Connector"];              // moveboard's RESOLVED source
      const finalF = r["Final Source (faithful)"];       // faithful, no lead matching
      const finalC = r["Final Source (current)"];        // live pipeline, no lead matching
      const finalL = r["Final Source (with leads)"];     // proposed, WITH Angi/Thumbtack matching
      const angiMatch = yes(r["Angi Match"]),   angiKey = r["Angi Match Key"];
      const ttMatch   = yes(r["Thumbtack Match"]), ttKey = r["Thumbtack Match Key"];
      // Meta Referral: a live-pipeline step PBIX never had. It sits directly under
      // Returned Customer and above the phone match.
      const metaMatch = yes(r["Meta Referral Match"]);
      const metaKey   = r["Meta Match Phone"] || r["Meta Match Email"];
      const metaVia   = r["Meta Match Phone"] ? "phone" : (r["Meta Match Email"] ? "email" : "");
      const metaDate  = String(r["Meta Form Date"] || "").slice(0, 10);
      const path   = String(r["Match Path"] || "");
      const lc     = path.toLowerCase();
      const isPost = /post card/.test(norm(finalF)) || /post card/.test(norm(mbSrc));

      /* how the Moveboard source was built (the phone-match story, shown under input ①) */
      let phone;
      if (has(crnn)) {
        phone = `phone matched CallRail <b>${RSC.esc(crnn)}</b>`
              + (has(crtr) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : "")
              + (gl ? ` — <span class="strc-em">CallRail beats Google Local</span>` : "");
      } else if (gl) {
        phone = `phone matched a <b>Google Local</b> lead`;
      } else {
        phone = `no phone match (CallRail / Google Local)`;
      }
      let mbNote = `Booked on the moveboard as <b>${RSC.esc(show(mbraw))}</b>; ${phone}.`;
      if (has(merged) && norm(merged) !== norm(mbraw))
        mbNote += ` Merged source <b>${RSC.esc(merged)}</b>` + (has(tran) && norm(tran) !== norm(merged) ? ` → <b>${RSC.esc(tran)}</b>` : "") + `.`;
      mbNote += pcRegionNote(mbSrc, pstate);

      /* which priority wins (6-rung ladder). Angi/Thumbtack lead matches only
         intercept the #6 fallback — never override #1–#3. */
      let win = 7;
      if (/returned customer|recommended/.test(lc)) win = 1;
      else if (metaMatch) win = 2;
      else if (/google local/.test(lc)) win = 3;
      else if (isPost) win = 4;
      else if (angiMatch) win = 5;
      else if (ttMatch) win = 6;
      const bookedWon = win === 7 && lc.includes("booked from") && !lc.includes("inherited");

      // #4/#5 rows: show the match even when a higher priority outranks it
      const leadRow = (n, matched, key, name) =>
        win === n ? `Wins → <b>${name}</b> (matched by <b>${RSC.esc(show(key))}</b>)`
        : matched ? `<span style="color:var(--amber);font-weight:700">Matched a ${name} lead by ${RSC.esc(show(key))}</span> — outranked by Priority #${win}`
        : `No ${name} lead match`;

      const rules = [
        { n: 1, t: "Returned customer",
          d: "Booked as a returning customer — wins outright, ahead of any phone, lead, or postcard match.",
          got: () => `Wins → <b>${RSC.esc(show(finalL))}</b>` },
        { n: 2, t: "Recommended",
          d: "Somebody sent them — kept ahead of any phone or lead match.",
          got: () => `Wins → <b>${RSC.esc(show(finalL))}</b>` },
        { n: 3, t: "Meta Referral — referral form match",
          d: "The customer's phone or email matches a Meta referral form, and the lead was created on or after that form within 90 days. Added to the live pipeline in Aug 2026 — Power BI never had this step, so the faithful chain above will disagree here on purpose.",
          matched: metaMatch,
          status: () => metaMatch
            ? (win === 2
                ? `Wins → <b>Meta Referral</b> (matched by <b>${RSC.esc(show(metaVia))}</b>${
                    metaKey ? " " + RSC.esc(show(metaKey)) : ""}${metaDate ? `, form filled ${RSC.esc(metaDate)}` : ""})`
                : `<span style="color:var(--amber);font-weight:700">Matched a Meta referral form</span> — outranked by Priority #${win}`)
            : "No referral-form match" },
        { n: 4, t: "Google Local phone match",
          d: "The customer's phone matched a Google Local lead (and no CallRail postcard overrides it).",
          got: () => `Wins → <b>Google Local</b>` },
        { n: 5, t: "Post Card — region from pickup state",
          d: "The source resolves to a Post Card → keep it, taking the region from the pickup state (not the number's label).",
          got: () => `Wins → <b>${RSC.esc(show(finalL))}</b>` },
        { n: 6, t: "Angi — lead-data match",
          d: "The customer matches an Angi lead by email or phone, or by name + zip / name + date.",
          matched: angiMatch, status: () => leadRow(6, angiMatch, angiKey, "Angi") },
        { n: 7, t: "Thumbtack — lead-data match",
          d: "The customer matches a Thumbtack lead by phone, or by name + zip / name + date.",
          matched: ttMatch, status: () => leadRow(7, ttMatch, ttKey, "Thumbtack") },
        { n: 8, t: "Moveboard source, else Closing booked-from",
          d: "Otherwise use the Moveboard source — unless it's blank or “Other”, in which case the Closing's booked-from is used.",
          got: () => bookedWon
            ? `Wins via <b>Closing booked-from</b> → <b>${RSC.esc(show(finalL))}</b>`
            : `Wins via <b>Moveboard source</b> → <b>${RSC.esc(show(finalL))}</b>` },
      ];

      const ladder = rules.map(rule => {
        const won = rule.n === win;
        const body = rule.status ? rule.status() : (won ? rule.got() : "Not this job");
        const cls = won ? "won" : (rule.matched ? "" : "skip");   // matched-but-outranked stays visible
        return `<div class="strc-rule ${cls}">
            <span class="strc-badge">${won ? "✓" : "#" + rule.n}</span>
            <div>
              <div class="rt">Priority #${rule.n} — ${rule.t}</div>
              <div class="rd">${rule.d}</div>
              <div class="rs ${won ? "" : "na"}">${body}</div>
            </div>
          </div>`;
      }).join("");

      const changed = norm(finalL) !== norm(finalC);

      /* start-to-finish value trail: raw moveboard source → … → final */
      const pm = phoneMatch(crnn, crtr, gl);
      const corrClose = r["Closing Corrected Source"];
      const chain = chainStrip([
        { label: "Raw moveboard source", value: mbraw, raw: true,
          note: "What ops entered on the moveboard, before any transformation." },
        { label: "Phone match — CallRail / Google Local", value: pm.value, note: pm.note, chg: pm.chg, badge: 1 },
        { label: "Merged source", value: merged, badge: 2,
          note: "Returned-Customer kept first, else the phone match, else the raw source.",
          chg: norm(merged) !== norm(mbraw) },
        { label: "Translated + Post-Card region", value: mbSrc, badge: 3,
          note: (has(tran) && norm(tran) !== norm(merged) ? "Canonical name via the Source Translator." : "")
            + pcRegionNote(mbSrc, pstate),
          chg: norm(mbSrc) !== norm(merged) },
        { label: "Closing corrected source", value: corrClose, badge: 4,
          note: `Closing inherits the moveboard source; its own “Booked from” (<b>${RSC.esc(show(bf))}</b>) is the fallback.`,
          chg: norm(corrClose) !== norm(mbSrc) },
        { label: "Final source", value: finalC, fin: true },
      ]);

      traceEl.innerHTML = `
        <div class="panel" style="margin-top:14px">
          <div class="panel-head">
            <span class="panel-title">Request #${RSC.esc(show(r["Request #"]))}
              <span style="color:var(--faint);font-weight:600">· ${RSC.esc(show(r["Customer"]))}
              · ${RSC.esc(show(r["Company"]))} · move ${RSC.esc(show(r["Move Date"]))}</span></span>
          </div>
          <div style="padding:16px 18px 8px">

            <div class="strc-io">
              <div class="strc-cell">
                <div class="strc-lab"><span class="num">1</span>Raw moveboard source</div>
                <div class="big">${RSC.esc(show(mbraw))}</div>
                <div class="strc-note">${mbNote}</div>
              </div>
              <div class="strc-cell">
                <div class="strc-lab"><span class="num">2</span>Raw closing source</div>
                <div class="big">${RSC.esc(show(bf))}</div>
                <div class="strc-note">The source as booked on the closing sheet ("Booked from") — the fallback if the moveboard source is blank.</div>
              </div>
            </div>

            <div class="strc-sechead">Source, start to finish <span>· raw → final, each transformation in order</span></div>
            ${chain}

            <div class="strc-sechead">Which priority decided it <span>· first match wins</span></div>
            <div class="strc-ladder">${ladder}</div>

            <div class="strc-final">
              <span class="fl">Final source</span>
              <span class="fv">${RSC.esc(show(finalL))}</span>
            </div>

            <div class="strc-cmp">
              <div class="strc-cell">
                <div class="strc-lab">Current pipeline (live)</div>
                <div class="big">${RSC.esc(show(finalC))}</div>
              </div>
              <div class="strc-cell">
                <div class="strc-lab">With Meta / Angi / Thumbtack matching</div>
                <div class="big">${RSC.esc(show(finalL))}</div>
              </div>
            </div>

            <div class="strc-verdict ${changed ? "warn" : "ok"}">
              <span class="vt">${changed
                ? "⤳ Lead matching would reassign this job"
                : "✓ No change — lead matching agrees with the live source"}</span>
              ${changed
                ? "The live pipeline stores <b>" + RSC.esc(show(finalC)) + "</b>, but the customer matches "
                  + (win === 6 ? "an <b>Angi</b>" : "a <b>Thumbtack</b>") + " lead — so lead-matching would set it to <b>"
                  + RSC.esc(show(finalL)) + "</b>. <span style='color:var(--faint)'>Diagnostic only — not yet applied to live reports.</span>"
                : "The lead-matched source equals what the pipeline already stores."}
              ${has(path) ? `<div class="strc-path">Base decision path: <code>${RSC.esc(path)}</code></div>` : ""}
            </div>
          </div>
        </div>`;
      traceEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    /* ---------------- MOVEBOARD trace (moveboard # grain — the upstream source) ---------------- */
    function renderMoveboard(r) {
      const rawS   = r["Moveboard Raw Source"];
      const crnn   = r["CallRail Number Name"];
      const crtr   = r["CallRail Translated"];
      const gl     = yes(r["Google Local Match"]);
      const merged = r["Merged Source"];
      const tran   = r["Translated Source"];
      const pstate = r["Pickup State"];
      const conn   = r["Source Connector"];               // current moveboard resolved source
      const connL  = r["Source Connector (with leads)"];  // with Angi/Thumbtack matching
      const angiMatch = yes(r["Angi Match"]), angiKey = r["Angi Match Key"];
      const ttMatch   = yes(r["Thumbtack Match"]), ttKey = r["Thumbtack Match Key"];
      const metaMatch = yes(r["Meta Referral Match"]);
      const metaKey   = r["Meta Match Phone"] || r["Meta Match Email"];
      const metaVia   = r["Meta Match Phone"] ? "phone" : (r["Meta Match Email"] ? "email" : "");
      const metaDate  = String(r["Meta Form Date"] || "").slice(0, 10);
      const path   = String(r["Match Path"] || "");
      const lc     = path.toLowerCase();
      const isPost = /post card/.test(norm(conn));

      const win = winMoveboard(r);   // one definition, shared with the browse list

      const mbLead = (n, matched, key, name) =>
        win === n ? `Wins → <b>${name}</b> (matched by <b>${RSC.esc(show(key))}</b>)`
        : matched ? `<span style="color:var(--amber);font-weight:700">Matched a ${name} lead by ${RSC.esc(show(key))}</span>`
        : `No ${name} lead match`;

      const rules = [
        { n: 1, t: "Returned Customer",
          d: "Booked on the moveboard as a returning customer — kept as Returned Customer.",
          got: () => `Wins → <b>Returned Customer</b>` },
        { n: 2, t: "Recommended",
          d: "Booked as recommended — somebody sent them. Kept ahead of any phone or lead match (protected 2026-08-18; before that a CallRail or Google match could overwrite it).",
          got: () => `Wins → <b>Recommended</b>` },
        { n: 3, t: "Meta Referral — referral form match",
          d: "The customer's phone or email matches a Meta referral form, and this lead was created on or after that form within 90 days. Both windows are deliberate: without them an existing customer filling the form would re-source their own older lead, and a move a year later would still be credited to the referral.",
          matched: metaMatch,
          status: () => metaMatch
            ? (win === 3
                ? `Wins → <b>Meta Referral</b> (matched by <b>${RSC.esc(show(metaVia))}</b>${
                    metaKey ? " " + RSC.esc(show(metaKey)) : ""}${metaDate ? `, form filled ${RSC.esc(metaDate)}` : ""})`
                : `<span style="color:var(--amber);font-weight:700">Matched a Meta referral form</span> — outranked by Priority #${win}`)
            : "No referral-form match" },
        { n: 4, t: "CallRail phone match",
          d: "The customer's phone matched a CallRail tracking number — its Number Name becomes the source (CallRail beats Google Local).",
          got: () => `Wins → <b>${RSC.esc(show(crnn))}</b>${has(crtr) && norm(crtr) !== norm(crnn) ? ` → <b>${RSC.esc(crtr)}</b>` : ""}` },
        { n: 5, t: "Post Card — region from pickup state",
          d: "Booked as a Post Card, so the region comes from the pickup state rather than the tracking number's label.",
          got: () => `Wins → <b>${RSC.esc(show(conn))}</b>` },
        { n: 6, t: "Google Local phone match",
          d: "The customer's phone matched a Google Local lead.",
          got: () => `Wins → <b>Google Local</b>` },
        { n: 7, t: "Angi — lead-data match",
          d: "The customer matches an Angi lead by email/phone, or name + zip / name + date.",
          matched: angiMatch, status: () => mbLead(7, angiMatch, angiKey, "Angi") },
        { n: 8, t: "Thumbtack — lead-data match",
          d: "The customer matches a Thumbtack lead by phone, or name + zip / name + date.",
          matched: ttMatch, status: () => mbLead(8, ttMatch, ttKey, "Thumbtack") },
        { n: 9, t: "Raw booked source",
          d: "Otherwise the moveboard's booked source, translated to its canonical name (Post Card split by pickup state).",
          got: () => `Wins → <b>${RSC.esc(show(conn))}</b>` },
      ];
      const ladder = rules.map(rule => {
        const won = rule.n === win;
        const body = rule.status ? rule.status() : (won ? rule.got() : "Not this job");
        const cls = won ? "won" : (rule.matched ? "" : "skip");
        return `<div class="strc-rule ${cls}">
            <span class="strc-badge">${won ? "✓" : "#" + rule.n}</span>
            <div><div class="rt">Priority #${rule.n} — ${rule.t}</div>
              <div class="rd">${rule.d}</div>
              <div class="rs ${won ? "" : "na"}">${body}</div></div>
          </div>`;
      }).join("");

      let phn;
      if (has(crnn)) phn = `matched CallRail <b>${RSC.esc(crnn)}</b>` + (has(crtr) && norm(crtr) !== norm(crnn) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : "") + (gl ? ` — <span class="strc-em">CallRail beats Google Local</span>` : "");
      else if (gl) phn = `matched a <b>Google Local</b> lead`;
      else phn = `no CallRail / Google Local match`;
      let note = `Customer phone <b>${RSC.esc(show(r["Customer Phone"]))}</b> ${phn}.`;
      if (viaQR(crnn)) note += ` They <b>scanned the QR code</b> on the postcard — a fact the`
        + ` source ladder folds away when it resolves this to Post Card.`;
      if (has(merged) && norm(merged) !== norm(rawS))
        note += ` Merged source <b>${RSC.esc(merged)}</b>` + (has(tran) && norm(tran) !== norm(merged) ? ` → <b>${RSC.esc(tran)}</b>` : "") + ".";
      note += pcRegionNote(conn, pstate);

      const changed = norm(connL) !== norm(conn);

      /* start-to-finish value trail: raw moveboard source → … → Source Connector */
      const pm = phoneMatch(crnn, crtr, gl);
      const chain = chainStrip([
        { label: "Raw moveboard source", value: rawS, raw: true,
          note: "What ops entered on the moveboard, before any transformation." },
        { label: "Phone match — CallRail / Google Local", value: pm.value, note: pm.note, chg: pm.chg, badge: 1 },
        { label: "Merged source", value: merged, badge: 2,
          note: "Returned-Customer kept first, else the phone match, else the raw source.",
          chg: norm(merged) !== norm(rawS) },
        { label: "Translated", value: tran, badge: 3,
          note: "Canonical name via the Source Translator.",
          chg: has(tran) && norm(tran) !== norm(merged) },
        { label: "Source Connector (final)", value: conn, fin: true,
          note: pcRegionNote(conn, pstate).trim() },
      ]);

      traceEl.innerHTML = `
        <div class="panel" style="margin-top:14px">
          <div class="panel-head">
            <span class="panel-title">Moveboard #${RSC.esc(show(r["Job No"]))}
              <span style="color:var(--faint);font-weight:600">· ${RSC.esc(show(r["Customer"]))}
              · ${RSC.esc(show(r["Company"]))} · move ${RSC.esc(show(r["Move Date"]))}</span></span>
          </div>
          <div style="padding:16px 18px 8px">
            <div class="strc-io" style="grid-template-columns:1fr">
              <div class="strc-cell">
                <div class="strc-lab"><span class="num">0</span>Raw moveboard source</div>
                <div class="big">${RSC.esc(show(rawS))}</div>
                <div class="strc-note">${note}</div>
              </div>
            </div>
            <div class="strc-sechead">Source, start to finish <span>· raw → final, each transformation in order</span></div>
            ${chain}
            <div class="strc-sechead">Which priority decided it <span>· first match wins</span></div>
            <div class="strc-ladder">${ladder}</div>
            <div class="strc-final">
              <span class="fl">Moveboard source</span>
              <span class="fv">${RSC.esc(show(connL))}</span>
            </div>
            <div class="strc-cmp">
              <div class="strc-cell"><div class="strc-lab">Current (live)</div><div class="big">${RSC.esc(show(conn))}</div></div>
              <div class="strc-cell"><div class="strc-lab">With Meta / Angi / Thumbtack matching</div><div class="big">${RSC.esc(show(connL))}</div></div>
            </div>
            <div class="strc-verdict ${changed ? "warn" : "ok"}">
              <span class="vt">${changed ? "⤳ Lead matching would reassign this lead" : "✓ No change — lead matching agrees with the live source"}</span>
              ${changed
                ? "The moveboard stores <b>" + RSC.esc(show(conn)) + "</b>, but the customer matches "
                  + (win === 7 ? "an <b>Angi</b>" : "a <b>Thumbtack</b>") + " lead — so lead-matching would set it to <b>"
                  + RSC.esc(show(connL)) + "</b>. <span style='color:var(--faint)'>Diagnostic only — not yet applied to live reports.</span>"
                : "The lead-matched source equals what the moveboard already stores."}
              ${has(path) ? `<div class="strc-path">Decision path: <code>${RSC.esc(path)}</code></div>` : ""}
            </div>
          </div>
        </div>`;
      traceEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    /* ---------------- wire modes + search + restore prior state ---------------- */
    let t = null;
    inp.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(inp.value), 120); };
    modesEl.querySelectorAll("button").forEach(btn => btn.onclick = async () => {
      if (ST_STATE.mode === btn.dataset.mode) return;
      modesEl.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === btn));
      ST_STATE.mode = btn.dataset.mode; ST_STATE.q = ""; ST_STATE.sel = null;
      ST_STATE.rung = null; ST_STATE.page = 0;   // rung numbers differ per mode
      inp.value = ""; resultsEl.innerHTML = ""; traceEl.innerHTML = "";
      { const e = document.getElementById("stBrowse"); if (e) e.innerHTML = ""; }
      { const e = document.getElementById("stIdle"); if (e) e.style.display = ""; }
      if (await loadMode(ST_STATE.mode)) { idleCount(); paintChips(); }
    });
    modesEl.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.mode === ST_STATE.mode));
    if (await loadMode(ST_STATE.mode)) {
      idleCount();
      paintChips();
      if (ST_STATE.rung) paintBrowse();
      if (ST_STATE.q) { inp.value = ST_STATE.q; runSearch(ST_STATE.q); }
      if (ST_STATE.sel) openTrace(ST_STATE.sel);
    }
  },
});
