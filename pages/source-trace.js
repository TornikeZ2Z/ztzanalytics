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
      ],
    };
  }
})();

/* persists the admin's lookup across incidental re-renders (a global filter change still
   re-runs render() even though this page ignores those filters) */
const ST_STATE = { q: "", sel: null, mode: "closing" };

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
    const chainStrip = steps => `<div class="st-chain">` + steps.map(s => {
      const cls = s.raw ? "raw" : s.fin ? "fin" : s.chg ? "chg" : "";
      const badge = s.raw ? "0" : s.fin ? "★" : (s.badge || "");
      return `<div class="st-step ${cls}">
          <div class="st-dot">${badge}</div>
          <div class="st-sbody">
            <div class="st-slab">${RSC.esc(s.label)}</div>
            <div class="st-sval">${RSC.esc(show(s.value))}</div>
            ${s.note ? `<div class="st-snote">${s.note}</div>` : ""}
          </div>
        </div>`;
    }).join("") + `</div>`;

    /* the phone-match value + human note, shared by both traces */
    const phoneMatch = (crnn, crtr, gl) => ({
      value: has(crnn) ? (has(crtr) ? crtr : crnn) : (gl ? "Google Local" : "—"),
      note: has(crnn)
        ? `Customer phone matched CallRail <b>${RSC.esc(crnn)}</b>${has(crtr) && norm(crtr) !== norm(crnn) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : ""}${gl ? " — <b>CallRail beats Google Local</b>" : ""}.`
        : gl ? `Customer phone matched a <b>Google Local</b> lead.`
             : `No phone match — the raw booked source carries through.`,
      chg: has(crnn) || gl,
    });

    // one-time style block: two input cards, the priority ladder, the final chip, the verdict
    if (!document.getElementById("st-style")) {
      const st = document.createElement("style");
      st.id = "st-style";
      st.textContent = `
        #stSearch{width:100%;max-width:520px;padding:11px 14px;border-radius:11px;
          border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:14px;font-family:inherit;outline:none}
        #stSearch:focus{border-color:var(--brand)}
        .st-modes{display:inline-flex;gap:2px;background:var(--panel);border:1px solid var(--line-2);
          border-radius:11px;padding:3px;margin-bottom:13px}
        .st-modes button{border:0;background:transparent;color:var(--muted);font-family:inherit;
          font-size:13px;font-weight:700;padding:7px 15px;border-radius:8px;cursor:pointer}
        .st-modes button.on{background:var(--brand);color:var(--brand-ink)}
        .st-results{margin-top:12px}
        .st-hit{display:grid;grid-template-columns:auto auto 1fr auto auto;gap:10px 16px;
          align-items:center;padding:10px 14px;border:1px solid var(--line);border-radius:11px;
          margin-bottom:7px;cursor:pointer;background:var(--panel-2)}
        .st-hit:hover{border-color:var(--brand);background:var(--panel)}
        .st-hit b{color:var(--ink);font-size:13.5px}
        .st-hit .st-mini{color:var(--muted);font-size:12.5px}
        .st-tag{font-size:11px;font-weight:700;padding:2px 8px;border-radius:999px;white-space:nowrap}
        .st-tag.ok{background:var(--brand-glow);color:var(--brand-d)}
        .st-tag.bad{background:rgba(248,113,113,.14);color:var(--red)}
        .st-lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--faint)}
        .st-note{font-size:12.5px;color:var(--muted);line-height:1.55}
        .st-note .st-em{color:var(--amber);font-weight:700}
        .st-note b{color:var(--ink)}
        /* two raw-input cards */
        .st-io{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin:2px 0 20px}
        @media(max-width:640px){.st-io{grid-template-columns:1fr}}
        .st-cell{border:1px solid var(--line-2);border-radius:13px;padding:14px 16px;background:var(--panel-2)}
        .st-cell .num{display:inline-flex;width:20px;height:20px;border-radius:6px;margin-right:7px;
          background:var(--panel);border:1px solid var(--line-2);color:var(--muted);
          font-size:11px;font-weight:800;align-items:center;justify-content:center;vertical-align:middle}
        .st-cell .big{font-size:18px;font-weight:800;color:var(--ink);margin:6px 0 6px}
        /* the priority ladder */
        .st-sechead{font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;
          color:var(--muted);margin:2px 0 11px}
        .st-sechead span{color:var(--faint);font-weight:700;text-transform:none;letter-spacing:0}
        .st-ladder{display:flex;flex-direction:column;gap:8px;margin-bottom:18px}
        .st-rule{display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;
          padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel-2)}
        .st-rule.won{border-color:var(--brand-d);background:var(--brand-glow)}
        .st-rule.skip{opacity:.52}
        .st-badge{width:26px;height:26px;border-radius:8px;background:var(--panel);
          border:1px solid var(--line-2);color:var(--muted);font-size:12px;font-weight:800;
          display:flex;align-items:center;justify-content:center}
        .st-rule.won .st-badge{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .st-rule .rt{font-size:14px;font-weight:700;color:var(--ink)}
        .st-rule.skip .rt{font-weight:600}
        .st-rule .rd{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.5}
        .st-rule .rs{font-size:12.5px;font-weight:800;margin-top:6px;display:flex;align-items:center;gap:6px}
        .st-rule.won .rs{color:var(--brand-d)}
        .st-rule .rs.na{color:var(--faint);font-weight:700}
        /* final source chip */
        .st-final{display:flex;align-items:center;justify-content:space-between;gap:12px;
          padding:15px 18px;border-radius:14px;background:var(--brand);color:var(--brand-ink);margin-bottom:16px}
        .st-final .fl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;opacity:.9}
        .st-final .fv{font-size:22px;font-weight:800}
        /* faithful vs current + verdict */
        .st-cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        @media(max-width:640px){.st-cmp{grid-template-columns:1fr}.st-hit{grid-template-columns:1fr 1fr}}
        .st-cmp .st-cell .big{font-size:17px;margin:4px 0 0}
        .st-verdict{margin-top:14px;border-radius:13px;padding:14px 16px;font-size:14px;line-height:1.55}
        .st-verdict.ok{background:var(--brand-glow);border:1px solid var(--brand-d)}
        .st-verdict.bad{background:rgba(248,113,113,.12);border:1px solid var(--red)}
        .st-verdict.warn{background:rgba(245,158,11,.12);border:1px solid var(--amber)}
        .st-verdict .vt{font-weight:800;font-size:15px;display:block;margin-bottom:3px}
        .st-verdict.ok .vt{color:var(--brand-d)}
        .st-verdict.bad .vt{color:var(--red)}
        .st-verdict.warn .vt{color:var(--amber)}
        .st-path{margin-top:8px;font-size:13px;color:var(--muted)}
        .st-path code{background:var(--panel);border:1px solid var(--line);border-radius:7px;
          padding:2px 8px;color:var(--ink);font-size:12.5px}
        /* start-to-finish transformation chain */
        .st-chain{display:flex;flex-direction:column;margin:4px 0 20px}
        .st-step{position:relative;display:grid;grid-template-columns:26px 1fr;gap:13px;padding:0 0 16px}
        .st-step:last-child{padding-bottom:0}
        .st-step:not(:last-child)::before{content:"";position:absolute;left:12px;top:26px;bottom:0;
          width:2px;background:var(--line-2)}
        .st-dot{width:26px;height:26px;border-radius:50%;background:var(--panel);border:2px solid var(--line-2);
          display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;
          color:var(--muted);z-index:1}
        .st-step.chg .st-dot{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .st-step.raw .st-dot{background:var(--ink);border-color:var(--ink);color:var(--panel)}
        .st-step.fin .st-dot{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .st-sbody{padding-top:0}
        .st-slab{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint)}
        .st-sval{font-size:15.5px;font-weight:800;color:var(--ink);margin:1px 0 1px}
        .st-step.chg .st-sval,.st-step.fin .st-sval{color:var(--brand-d)}
        .st-step.raw .st-sval{font-size:17px}
        .st-snote{font-size:12px;color:var(--muted);line-height:1.45}
        .st-snote b{color:var(--ink)}`;
      document.head.appendChild(st);
    }

    /* ---------------- shell ---------------- */
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Source Trace</h1>
        <p>Look up any job and see how its lead <b>source</b> is decided, step by step — the
           priority ladder (incl. CallRail, Google Local, <b>Angi</b> / <b>Thumbtack</b>
           lead-data matching, Post Card region) that resolves it. Switch between the
           <b>Closing</b> sheet source and the upstream <b>Moveboard</b> source.
           <span class="freshness">· read-only</span></p>
      </div>
      <div class="panel">
        <div style="padding:14px 16px">
          <div class="st-modes" id="stModes">
            <button data-mode="closing" class="on">Closing jobs</button>
            <button data-mode="moveboard">Moveboard leads</button>
          </div>
          <input id="stSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, Job Code, or customer name…">
          <div class="st-note" style="margin-top:8px" id="stCount">Loading…</div>
        </div>
        <div id="stResults" class="st-results" style="padding:0 16px 8px"></div>
      </div>
      <div id="stTrace"></div>`;

    const inp = document.getElementById("stSearch");
    const countEl = document.getElementById("stCount");
    const resultsEl = document.getElementById("stResults");
    const traceEl = document.getElementById("stTrace");
    const modesEl = document.getElementById("stModes");

    /* ---------------- mode config (closing jobs / moveboard leads) ---------------- */
    let rows = [];             // current mode's dataset
    const loaded = {};         // dataset name -> rows (loaded lazily, once)

    const MODES = {
      closing: {
        dataset: "source_trace", unit: "closing job",
        placeholder: "Search by Request #, Job Code, or customer name…",
        key: r => r["Request Joinkey"] || r["Request #"] || r["Job Code"],
        match: (r, nq) => norm(r["Request #"]).includes(nq) || norm(r["Job Code"]).includes(nq) || norm(r["Customer"]).includes(nq),
        exact: (r, nq) => norm(r["Request #"]) === nq,
        hit: r => {
          const ch = norm(r["Final Source (with leads)"]) !== norm(r["Final Source (current)"]);
          return `<b>#${RSC.esc(show(r["Request #"]))}</b>
            <span class="st-mini">${RSC.esc(show(r["Job Code"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Customer"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Final Source (with leads)"]))}</span>
            <span class="st-tag ${ch ? "bad" : "ok"}">${ch ? "Lead-flip" : "Stable"}</span>`;
        },
        render: renderClosing,
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
            <span class="st-mini">${RSC.esc(show(r["Company"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Customer"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Source Connector (with leads)"]))}</span>
            <span class="st-tag ${ch ? "bad" : "ok"}">${ch ? "Lead-flip" : "Stable"}</span>`;
        },
        render: renderMoveboard,
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
        `<div class="st-hit" data-k="${RSC.esc(m.key(r))}">${m.hit(r)}</div>`).join("");
      resultsEl.querySelectorAll(".st-hit").forEach(el => el.onclick = () => openTrace(el.dataset.k));
    }

    /* dispatch a trace to the current mode's renderer */
    function openTrace(key) {
      const m = MODES[ST_STATE.mode];
      ST_STATE.sel = key;
      const r = rows.find(x => String(m.key(x)) === String(key));
      if (!r) { traceEl.innerHTML = ""; return; }
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
      const path   = String(r["Match Path"] || "");
      const lc     = path.toLowerCase();
      const isPost = /post card/.test(norm(finalF)) || /post card/.test(norm(mbSrc));

      /* how the Moveboard source was built (the phone-match story, shown under input ①) */
      let phone;
      if (has(crnn)) {
        phone = `phone matched CallRail <b>${RSC.esc(crnn)}</b>`
              + (has(crtr) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : "")
              + (gl ? ` — <span class="st-em">CallRail beats Google Local</span>` : "");
      } else if (gl) {
        phone = `phone matched a <b>Google Local</b> lead`;
      } else {
        phone = `no phone match (CallRail / Google Local)`;
      }
      let mbNote = `Booked on the moveboard as <b>${RSC.esc(show(mbraw))}</b>; ${phone}.`;
      if (has(merged) && norm(merged) !== norm(mbraw))
        mbNote += ` Merged source <b>${RSC.esc(merged)}</b>` + (has(tran) && norm(tran) !== norm(merged) ? ` → <b>${RSC.esc(tran)}</b>` : "") + `.`;
      if (isPost && has(pstate))
        mbNote += ` Post Card → region from pickup state <b>${RSC.esc(pstate)}</b>.`;

      /* which priority wins (6-rung ladder). Angi/Thumbtack lead matches only
         intercept the #6 fallback — never override #1–#3. */
      let win = 6;
      if (/returned customer|recommended/.test(lc)) win = 1;
      else if (/google local/.test(lc)) win = 2;
      else if (isPost) win = 3;
      else if (angiMatch) win = 4;
      else if (ttMatch) win = 5;
      const bookedWon = win === 6 && lc.includes("booked from") && !lc.includes("inherited");

      // #4/#5 rows: show the match even when a higher priority outranks it
      const leadRow = (n, matched, key, name) =>
        win === n ? `Wins → <b>${name}</b> (matched by <b>${RSC.esc(show(key))}</b>)`
        : matched ? `<span style="color:var(--amber);font-weight:700">Matched a ${name} lead by ${RSC.esc(show(key))}</span> — outranked by Priority #${win}`
        : `No ${name} lead match`;

      const rules = [
        { n: 1, t: "Returned / Recommended customer",
          d: "Booked as a returning or recommended customer — wins outright, ahead of any phone, lead, or postcard match.",
          got: () => `Wins → <b>${RSC.esc(show(finalL))}</b>` },
        { n: 2, t: "Google Local phone match",
          d: "The customer's phone matched a Google Local lead (and no CallRail postcard overrides it).",
          got: () => `Wins → <b>Google Local</b>` },
        { n: 3, t: "Post Card — region from pickup state",
          d: "The source resolves to a Post Card → keep it, taking the region from the pickup state (not the number's label).",
          got: () => `Wins → <b>${RSC.esc(show(finalL))}</b>` },
        { n: 4, t: "Angi — lead-data match",
          d: "The customer matches an Angi lead by email or phone, or by name + zip / name + date.",
          matched: angiMatch, status: () => leadRow(4, angiMatch, angiKey, "Angi") },
        { n: 5, t: "Thumbtack — lead-data match",
          d: "The customer matches a Thumbtack lead by phone, or by name + zip / name + date.",
          matched: ttMatch, status: () => leadRow(5, ttMatch, ttKey, "Thumbtack") },
        { n: 6, t: "Moveboard source, else Closing booked-from",
          d: "Otherwise use the Moveboard source — unless it's blank or “Other”, in which case the Closing's booked-from is used.",
          got: () => bookedWon
            ? `Wins via <b>Closing booked-from</b> → <b>${RSC.esc(show(finalL))}</b>`
            : `Wins via <b>Moveboard source</b> → <b>${RSC.esc(show(finalL))}</b>` },
      ];

      const ladder = rules.map(rule => {
        const won = rule.n === win;
        const body = rule.status ? rule.status() : (won ? rule.got() : "Not this job");
        const cls = won ? "won" : (rule.matched ? "" : "skip");   // matched-but-outranked stays visible
        return `<div class="st-rule ${cls}">
            <span class="st-badge">${won ? "✓" : "#" + rule.n}</span>
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
            + (isPost && has(pstate) ? ` Post Card split by pickup state <b>${RSC.esc(pstate)}</b>.` : ""),
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

            <div class="st-io">
              <div class="st-cell">
                <div class="st-lab"><span class="num">1</span>Raw moveboard source</div>
                <div class="big">${RSC.esc(show(mbraw))}</div>
                <div class="st-note">${mbNote}</div>
              </div>
              <div class="st-cell">
                <div class="st-lab"><span class="num">2</span>Raw closing source</div>
                <div class="big">${RSC.esc(show(bf))}</div>
                <div class="st-note">The source as booked on the closing sheet ("Booked from") — the fallback if the moveboard source is blank.</div>
              </div>
            </div>

            <div class="st-sechead">Source, start to finish <span>· raw → final, each transformation in order</span></div>
            ${chain}

            <div class="st-sechead">Which priority decided it <span>· first match wins</span></div>
            <div class="st-ladder">${ladder}</div>

            <div class="st-final">
              <span class="fl">Final source</span>
              <span class="fv">${RSC.esc(show(finalL))}</span>
            </div>

            <div class="st-cmp">
              <div class="st-cell">
                <div class="st-lab">Current pipeline (live)</div>
                <div class="big">${RSC.esc(show(finalC))}</div>
              </div>
              <div class="st-cell">
                <div class="st-lab">With Angi / Thumbtack matching</div>
                <div class="big">${RSC.esc(show(finalL))}</div>
              </div>
            </div>

            <div class="st-verdict ${changed ? "warn" : "ok"}">
              <span class="vt">${changed
                ? "⤳ Lead matching would reassign this job"
                : "✓ No change — lead matching agrees with the live source"}</span>
              ${changed
                ? "The live pipeline stores <b>" + RSC.esc(show(finalC)) + "</b>, but the customer matches "
                  + (win === 4 ? "an <b>Angi</b>" : "a <b>Thumbtack</b>") + " lead — so lead-matching would set it to <b>"
                  + RSC.esc(show(finalL)) + "</b>. <span style='color:var(--faint)'>Diagnostic only — not yet applied to live reports.</span>"
                : "The lead-matched source equals what the pipeline already stores."}
              ${has(path) ? `<div class="st-path">Base decision path: <code>${RSC.esc(path)}</code></div>` : ""}
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
      const path   = String(r["Match Path"] || "");
      const lc     = path.toLowerCase();
      const isPost = /post card/.test(norm(conn));

      let win = 6;
      if (lc.includes("returned customer")) win = 1;
      else if (lc.indexOf("callrail") === 0) win = 2;
      else if (lc.includes("google local")) win = 3;
      else if (norm(connL) === "angi" && norm(conn) !== "angi") win = 4;
      else if (norm(connL) === "thumbtack" && norm(conn) !== "thumbtack") win = 5;

      const mbLead = (n, matched, key, name) =>
        win === n ? `Wins → <b>${name}</b> (matched by <b>${RSC.esc(show(key))}</b>)`
        : matched ? `<span style="color:var(--amber);font-weight:700">Matched a ${name} lead by ${RSC.esc(show(key))}</span>`
        : `No ${name} lead match`;

      const rules = [
        { n: 1, t: "Returned Customer",
          d: "Booked on the moveboard as a returning customer — kept as Returned Customer.",
          got: () => `Wins → <b>Returned Customer</b>` },
        { n: 2, t: "CallRail phone match",
          d: "The customer's phone matched a CallRail tracking number — its Number Name becomes the source (CallRail beats Google Local).",
          got: () => `Wins → <b>${RSC.esc(show(crnn))}</b>${has(crtr) && norm(crtr) !== norm(crnn) ? ` → <b>${RSC.esc(crtr)}</b>` : ""}` },
        { n: 3, t: "Google Local phone match",
          d: "The customer's phone matched a Google Local lead.",
          got: () => `Wins → <b>Google Local</b>` },
        { n: 4, t: "Angi — lead-data match",
          d: "The customer matches an Angi lead by email/phone, or name + zip / name + date.",
          matched: angiMatch, status: () => mbLead(4, angiMatch, angiKey, "Angi") },
        { n: 5, t: "Thumbtack — lead-data match",
          d: "The customer matches a Thumbtack lead by phone, or name + zip / name + date.",
          matched: ttMatch, status: () => mbLead(5, ttMatch, ttKey, "Thumbtack") },
        { n: 6, t: "Raw booked source",
          d: "Otherwise the moveboard's booked source, translated to its canonical name (Post Card split by pickup state).",
          got: () => `Wins → <b>${RSC.esc(show(conn))}</b>` },
      ];
      const ladder = rules.map(rule => {
        const won = rule.n === win;
        const body = rule.status ? rule.status() : (won ? rule.got() : "Not this job");
        const cls = won ? "won" : (rule.matched ? "" : "skip");
        return `<div class="st-rule ${cls}">
            <span class="st-badge">${won ? "✓" : "#" + rule.n}</span>
            <div><div class="rt">Priority #${rule.n} — ${rule.t}</div>
              <div class="rd">${rule.d}</div>
              <div class="rs ${won ? "" : "na"}">${body}</div></div>
          </div>`;
      }).join("");

      let phn;
      if (has(crnn)) phn = `matched CallRail <b>${RSC.esc(crnn)}</b>` + (has(crtr) && norm(crtr) !== norm(crnn) ? ` (reads as <b>${RSC.esc(crtr)}</b>)` : "") + (gl ? ` — <span class="st-em">CallRail beats Google Local</span>` : "");
      else if (gl) phn = `matched a <b>Google Local</b> lead`;
      else phn = `no CallRail / Google Local match`;
      let note = `Customer phone <b>${RSC.esc(show(r["Customer Phone"]))}</b> ${phn}.`;
      if (has(merged) && norm(merged) !== norm(rawS))
        note += ` Merged source <b>${RSC.esc(merged)}</b>` + (has(tran) && norm(tran) !== norm(merged) ? ` → <b>${RSC.esc(tran)}</b>` : "") + ".";
      if (isPost && has(pstate)) note += ` Post Card → region from pickup state <b>${RSC.esc(pstate)}</b>.`;

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
          note: isPost && has(pstate) ? `Post Card split by pickup state <b>${RSC.esc(pstate)}</b>.` : "" },
      ]);

      traceEl.innerHTML = `
        <div class="panel" style="margin-top:14px">
          <div class="panel-head">
            <span class="panel-title">Moveboard #${RSC.esc(show(r["Job No"]))}
              <span style="color:var(--faint);font-weight:600">· ${RSC.esc(show(r["Customer"]))}
              · ${RSC.esc(show(r["Company"]))} · move ${RSC.esc(show(r["Move Date"]))}</span></span>
          </div>
          <div style="padding:16px 18px 8px">
            <div class="st-io" style="grid-template-columns:1fr">
              <div class="st-cell">
                <div class="st-lab"><span class="num">0</span>Raw moveboard source</div>
                <div class="big">${RSC.esc(show(rawS))}</div>
                <div class="st-note">${note}</div>
              </div>
            </div>
            <div class="st-sechead">Source, start to finish <span>· raw → final, each transformation in order</span></div>
            ${chain}
            <div class="st-sechead">Which priority decided it <span>· first match wins</span></div>
            <div class="st-ladder">${ladder}</div>
            <div class="st-final">
              <span class="fl">Moveboard source</span>
              <span class="fv">${RSC.esc(show(connL))}</span>
            </div>
            <div class="st-cmp">
              <div class="st-cell"><div class="st-lab">Current (live)</div><div class="big">${RSC.esc(show(conn))}</div></div>
              <div class="st-cell"><div class="st-lab">With Angi / Thumbtack matching</div><div class="big">${RSC.esc(show(connL))}</div></div>
            </div>
            <div class="st-verdict ${changed ? "warn" : "ok"}">
              <span class="vt">${changed ? "⤳ Lead matching would reassign this lead" : "✓ No change — lead matching agrees with the live source"}</span>
              ${changed
                ? "The moveboard stores <b>" + RSC.esc(show(conn)) + "</b>, but the customer matches "
                  + (win === 4 ? "an <b>Angi</b>" : "a <b>Thumbtack</b>") + " lead — so lead-matching would set it to <b>"
                  + RSC.esc(show(connL)) + "</b>. <span style='color:var(--faint)'>Diagnostic only — not yet applied to live reports.</span>"
                : "The lead-matched source equals what the moveboard already stores."}
              ${has(path) ? `<div class="st-path">Decision path: <code>${RSC.esc(path)}</code></div>` : ""}
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
      inp.value = ""; resultsEl.innerHTML = ""; traceEl.innerHTML = "";
      if (await loadMode(ST_STATE.mode)) idleCount();
    });
    modesEl.querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.mode === ST_STATE.mode));
    if (await loadMode(ST_STATE.mode)) {
      idleCount();
      if (ST_STATE.q) { inp.value = ST_STATE.q; runSearch(ST_STATE.q); }
      if (ST_STATE.sel) openTrace(ST_STATE.sel);
    }
  },
});
