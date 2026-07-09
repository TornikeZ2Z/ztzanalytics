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
  // register the dataset the first time this module loads (RS.load needs a spec)
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
      ],
    };
  }
})();

/* persists the admin's lookup across incidental re-renders (a global filter change still
   re-runs render() even though this page ignores those filters) */
const ST_STATE = { q: "", sel: null };

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

    // one-time style block: two input cards, the priority ladder, the final chip, the verdict
    if (!document.getElementById("st-style")) {
      const st = document.createElement("style");
      st.id = "st-style";
      st.textContent = `
        #stSearch{width:100%;max-width:520px;padding:11px 14px;border-radius:11px;
          border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:14px;font-family:inherit;outline:none}
        #stSearch:focus{border-color:var(--brand)}
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
        .st-verdict .vt{font-weight:800;font-size:15px;display:block;margin-bottom:3px}
        .st-verdict.ok .vt{color:var(--brand-d)}
        .st-verdict.bad .vt{color:var(--red)}
        .st-path{margin-top:8px;font-size:13px;color:var(--muted)}
        .st-path code{background:var(--panel);border:1px solid var(--line);border-radius:7px;
          padding:2px 8px;color:var(--ink);font-size:12.5px}`;
      document.head.appendChild(st);
    }

    /* ---------------- shell ---------------- */
    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Source Trace</h1>
        <p>Look up any closing job and see how its lead <b>source</b> is decided — the source
           on the <b>Moveboard</b>, the source on the <b>Closing</b> sheet, and the priority
           ladder that reconciles them into the final source.
           <span class="freshness">· read-only · one row per closing job</span></p>
      </div>
      <div class="panel">
        <div style="padding:14px 16px">
          <input id="stSearch" type="text" autocomplete="off" spellcheck="false"
            placeholder="Search by Request #, Job Code, or customer name…">
          <div class="st-note" style="margin-top:8px" id="stCount">Loading jobs…</div>
        </div>
        <div id="stResults" class="st-results" style="padding:0 16px 8px"></div>
      </div>
      <div id="stTrace"></div>`;

    const inp = document.getElementById("stSearch");
    const countEl = document.getElementById("stCount");
    const resultsEl = document.getElementById("stResults");
    const traceEl = document.getElementById("stTrace");

    /* ---------------- load once ---------------- */
    let rows;
    try {
      rows = await RS.load("source_trace");
    } catch (e) {
      countEl.innerHTML = `<span class="err">Couldn't load the source trace table — ${RSC.esc(e.message)}</span>`;
      return;
    }
    if (!document.getElementById("stSearch")) return;   // navigated away mid-load
    countEl.textContent = RS.fmtN(rows.length) + " closing jobs loaded · start typing to find one";

    const keyOf = r => r["Request Joinkey"] || r["Request #"] || r["Job Code"];

    /* ---------------- search + results list ---------------- */
    function runSearch(q) {
      ST_STATE.q = q;
      const nq = norm(q);
      resultsEl.innerHTML = "";
      if (!nq) { countEl.textContent = RS.fmtN(rows.length) + " closing jobs · start typing to find one"; return; }
      const hits = rows.filter(r =>
        norm(r["Request #"]).includes(nq) ||
        norm(r["Job Code"]).includes(nq) ||
        norm(r["Customer"]).includes(nq));

      const exact = hits.find(r => norm(r["Request #"]) === nq);
      if (exact) { openTrace(keyOf(exact)); }

      countEl.textContent = hits.length
        ? RS.fmtN(hits.length) + " match" + (hits.length === 1 ? "" : "es")
          + (hits.length > CAP ? " · showing first " + CAP : "")
        : "No jobs match “" + q + "” — try a Request #, Job Code, or customer name.";

      resultsEl.innerHTML = hits.slice(0, CAP).map(r => {
        const ok = yes(r["Matches Current"]);
        return `<div class="st-hit" data-k="${RSC.esc(keyOf(r))}">
            <b>#${RSC.esc(show(r["Request #"]))}</b>
            <span class="st-mini">${RSC.esc(show(r["Job Code"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Customer"]))}</span>
            <span class="st-mini">${RSC.esc(show(r["Move Date"]))}</span>
            <span class="st-tag ${ok ? "ok" : "bad"}">${ok ? "Matches" : "Differs"}</span>
          </div>`;
      }).join("");
      resultsEl.querySelectorAll(".st-hit").forEach(el =>
        el.onclick = () => openTrace(el.dataset.k));
    }

    /* ---------------- the priority-ladder trace for one job ---------------- */
    function openTrace(key) {
      ST_STATE.sel = key;
      const r = rows.find(x => String(keyOf(x)) === String(key));
      if (!r) { traceEl.innerHTML = ""; return; }

      const bf     = r["Closing Booked From"];
      const mbraw  = r["Moveboard Raw Source"];
      const crnn   = r["CallRail Number Name"];
      const crtr   = r["CallRail Translated"];
      const gl     = yes(r["Google Local Match"]);
      const merged = r["Moveboard Source (merged)"];
      const tran   = r["Translated Source"];
      const pstate = r["Pickup State"];
      const mbSrc  = r["Source Connector"];              // moveboard's RESOLVED source
      const finalF = r["Final Source (faithful)"];
      const finalC = r["Final Source (current)"];
      const path   = String(r["Match Path"] || "");
      const lc     = path.toLowerCase();
      const ok     = yes(r["Matches Current"]);
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

      /* which reconciliation priority won (derived from the recorded Match Path) */
      let win = 4;                                   // default: moveboard-vs-booked fallback
      if (/returned customer|recommended/.test(lc)) win = 1;
      else if (/google local/.test(lc)) win = 2;
      else if (isPost) win = 3;
      const bookedWon = win === 4 && lc.includes("booked from") && !lc.includes("inherited");

      const rules = [
        { n: 1, t: "Returned / Recommended customer",
          d: "Booked as a returning or recommended customer — this wins outright, ahead of any phone or postcard match.",
          got: () => `Wins → <b>${RSC.esc(show(finalF))}</b>` },
        { n: 2, t: "Google Local phone match",
          d: "The customer's phone matched a Google Local lead (and no CallRail postcard overrides it).",
          got: () => `Wins → <b>Google Local</b>` },
        { n: 3, t: "Post Card — region from pickup state",
          d: "The source resolves to a Post Card → keep it, taking the region from the pickup state (not the number's label).",
          got: () => `Wins → <b>${RSC.esc(show(finalF))}</b>` },
        { n: 4, t: "Moveboard source, else Closing booked-from",
          d: "Otherwise use the Moveboard source — unless it's blank or “Other”, in which case the Closing's booked-from is used.",
          got: () => bookedWon
            ? `Wins via <b>Closing booked-from</b> → <b>${RSC.esc(show(finalF))}</b>`
            : `Wins via <b>Moveboard source</b> → <b>${RSC.esc(show(finalF))}</b>` },
      ];

      const ladder = rules.map(rule => {
        const won = rule.n === win;
        return `<div class="st-rule ${won ? "won" : "skip"}">
            <span class="st-badge">${won ? "✓" : "#" + rule.n}</span>
            <div>
              <div class="rt">Priority #${rule.n} — ${rule.t}</div>
              <div class="rd">${rule.d}</div>
              <div class="rs ${won ? "" : "na"}">${won ? rule.got() : "Not this job"}</div>
            </div>
          </div>`;
      }).join("");

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
                <div class="st-lab"><span class="num">1</span>Source from Moveboard</div>
                <div class="big">${RSC.esc(show(mbSrc))}</div>
                <div class="st-note">${mbNote}</div>
              </div>
              <div class="st-cell">
                <div class="st-lab"><span class="num">2</span>Source from Closing</div>
                <div class="big">${RSC.esc(show(bf))}</div>
                <div class="st-note">The source as booked on the closing sheet ("Booked from").</div>
              </div>
            </div>

            <div class="st-sechead">Transformation priorities <span>· first match wins</span></div>
            <div class="st-ladder">${ladder}</div>

            <div class="st-final">
              <span class="fl">Final source</span>
              <span class="fv">${RSC.esc(show(finalF))}</span>
            </div>

            <div class="st-cmp">
              <div class="st-cell">
                <div class="st-lab">Faithful (PBIX)</div>
                <div class="big">${RSC.esc(show(finalF))}</div>
              </div>
              <div class="st-cell">
                <div class="st-lab">Current pipeline</div>
                <div class="big">${RSC.esc(show(finalC))}</div>
              </div>
            </div>

            <div class="st-verdict ${ok ? "ok" : "bad"}">
              <span class="vt">${ok
                ? "✓ Match — the pipeline stores the faithful source"
                : "✗ Mismatch — the pipeline differs from the faithful source"}</span>
              ${ok
                ? "The current stored source equals the PBIX-faithful answer for this job."
                : "The current stored source (<b>" + RSC.esc(show(finalC)) +
                  "</b>) does not equal the faithful answer (<b>" + RSC.esc(show(finalF)) + "</b>)."}
              ${has(path) ? `<div class="st-path">Decision path: <code>${RSC.esc(path)}</code></div>` : ""}
            </div>
          </div>
        </div>`;
      traceEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    /* ---------------- wire the search box + restore prior state ---------------- */
    let t = null;
    inp.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(inp.value), 120); };
    if (ST_STATE.q) { inp.value = ST_STATE.q; runSearch(ST_STATE.q); }
    if (ST_STATE.sel) openTrace(ST_STATE.sel);
  },
});
