/* ADMIN page: Source Trace — a per-job diagnostic that shows, step by step, how one
   closing job's lead SOURCE was decided, and whether the PBIX-faithful answer matches
   what my pipeline currently stores. Read-only.

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

    // one-time style block for the vertical step timeline + match banner
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
        .st-steps{position:relative;margin:6px 0 4px;padding-left:8px}
        .st-step{position:relative;padding:0 0 20px 34px}
        .st-step:before{content:"";position:absolute;left:11px;top:22px;bottom:0;width:2px;
          background:var(--line-2)}
        .st-step:last-child:before{display:none}
        .st-num{position:absolute;left:0;top:0;width:24px;height:24px;border-radius:50%;
          background:var(--panel-2);border:2px solid var(--line-2);color:var(--muted);
          font-size:12px;font-weight:800;display:flex;align-items:center;justify-content:center}
        .st-step.final .st-num{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
        .st-lab{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;
          color:var(--faint)}
        .st-val{font-size:15px;font-weight:700;color:var(--ink);margin-top:2px}
        .st-val.dim{color:var(--faint);font-weight:600}
        .st-note{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.5}
        .st-note .st-em{color:var(--amber);font-weight:700}
        .st-cmp{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
        @media(max-width:640px){.st-cmp{grid-template-columns:1fr}
          .st-hit{grid-template-columns:1fr 1fr}}
        .st-cell{border:1px solid var(--line-2);border-radius:13px;padding:14px 16px;background:var(--panel-2)}
        .st-cell .st-lab{margin-bottom:4px}
        .st-cell .big{font-size:17px;font-weight:800;color:var(--ink)}
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
        <p>Look up any closing job and see exactly how its lead <b>source</b> was decided —
           every step from the raw booking to the final display source — and whether the
           PBIX-faithful answer matches what the pipeline stores now.
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
    // guard: navigated away mid-load
    if (!document.getElementById("stSearch")) return;
    countEl.textContent = RS.fmtN(rows.length) + " closing jobs loaded · start typing to find one";

    const norm = s => String(s == null ? "" : s).trim().toLowerCase();
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

      // exact Request # match → open it straight away
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

    /* ---------------- the step-by-step trace for one job ---------------- */
    function openTrace(key) {
      ST_STATE.sel = key;
      const r = rows.find(x => String(keyOf(x)) === String(key));
      if (!r) { traceEl.innerHTML = ""; return; }
      const path = String(r["Match Path"] || "");
      const lc = path.toLowerCase();
      const ok = yes(r["Matches Current"]);

      // step 4: describe how (or whether) the phone matched a source
      const cr = r["CallRail Number Name"], gl = yes(r["Google Local Match"]);
      let phoneVal, phoneNote = "";
      if (has(cr)) {
        phoneVal = "CallRail: " + cr;
        const tr = r["CallRail Translated"];
        phoneNote = has(tr) ? "Number Name translates to <b style='color:var(--ink)'>" + RSC.esc(tr) + "</b>." : "";
        if (gl) phoneNote += (phoneNote ? " " : "") +
          `<span class="st-em">CallRail wins over Google Local</span> when both match the same phone.`;
      } else if (gl) {
        phoneVal = "Google Local";
        phoneNote = "Matched a Google Local number (no CallRail number matched this phone).";
      } else {
        phoneVal = "No phone match";
        phoneNote = "This phone matched neither a CallRail number nor a Google Local number.";
      }
      const phoneResult = r["Phone-Matched Source"];
      if (has(phoneResult)) phoneNote += (phoneNote ? " " : "") +
        "Resulting source adjustment: <b style='color:var(--ink)'>" + RSC.esc(phoneResult) + "</b>.";

      // step 5: flag a Returned-Customer override kept from the moveboard
      let mergeNote = "The source carried over from the moveboard after phone matching.";
      if (lc.includes("returned customer")) mergeNote =
        `<span class="st-em">Returned Customer kept</span> — this job's source was preserved as a returned customer, ahead of any phone match.`;

      const step = (n, lab, val, note, opts) => {
        const dim = blank(val) ? " dim" : "";
        return `<div class="st-step${opts && opts.final ? " final" : ""}">
            <span class="st-num">${opts && opts.final ? "★" : n}</span>
            <div class="st-lab">${lab}</div>
            <div class="st-val${dim}">${RSC.esc(show(val))}</div>
            ${note ? `<div class="st-note">${note}</div>` : ""}
          </div>`;
      };

      const region = [show(r["Pickup State"]), has(r["Source Connector"]) ? "→ " + r["Source Connector"] : ""]
        .filter(Boolean).join(" ");

      traceEl.innerHTML = `
        <div class="panel" style="margin-top:14px">
          <div class="panel-head">
            <span class="panel-title">Request #${RSC.esc(show(r["Request #"]))}
              <span style="color:var(--faint);font-weight:600">· ${RSC.esc(show(r["Customer"]))}
              · ${RSC.esc(show(r["Company"]))} · move ${RSC.esc(show(r["Move Date"]))}</span></span>
          </div>
          <div style="padding:16px 18px 6px">
            <div class="st-steps">
              ${step(1, "Closing “Booked from” (raw)", r["Closing Booked From"])}
              ${step(2, "Moveboard raw source", r["Moveboard Raw Source"])}
              ${step(3, "Customer phone", r["Customer Phone"])}
              ${step(4, "Phone match", phoneVal, phoneNote)}
              ${step(5, "Moveboard source (after merge)", r["Moveboard Source (merged)"], mergeNote)}
              ${step(6, "Translated source", r["Translated Source"],
                  "The merged source mapped through the source-correction table.")}
              ${step(7, "Pickup state + region", region || "—",
                  "Region assigned after the Post-Card state split (Source Connector).")}
              ${step(8, "Closing source from moveboard (inherited)", r["Closing Source From Moveboard"])}
              ${step(9, "Closing corrected source", r["Closing Corrected Source"])}
              ${step(10, "Final source", r["Final Source (faithful)"], "", { final: true })}
            </div>

            <div class="st-cmp">
              <div class="st-cell">
                <div class="st-lab">Faithful (PBIX)</div>
                <div class="big">${RSC.esc(show(r["Final Source (faithful)"]))}</div>
              </div>
              <div class="st-cell">
                <div class="st-lab">Current pipeline</div>
                <div class="big">${RSC.esc(show(r["Final Source (current)"]))}</div>
              </div>
            </div>

            <div class="st-verdict ${ok ? "ok" : "bad"}">
              <span class="vt">${ok
                ? "✓ Match — the pipeline stores the faithful source"
                : "✗ Mismatch — the pipeline differs from the faithful source"}</span>
              ${ok
                ? "The current stored source equals the PBIX-faithful answer for this job."
                : "The current stored source (<b>" + RSC.esc(show(r["Final Source (current)"])) +
                  "</b>) does not equal the faithful answer (<b>" + RSC.esc(show(r["Final Source (faithful)"])) + "</b>)."}
              ${has(path) ? `<div class="st-path">How it was decided: <code>${RSC.esc(path)}</code></div>` : ""}
            </div>
          </div>
        </div>`;
      // scroll the trace into view when opened from a click
      traceEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    /* ---------------- wire the search box + restore prior state ---------------- */
    let t = null;
    inp.oninput = () => { clearTimeout(t); t = setTimeout(() => runSearch(inp.value), 120); };
    if (ST_STATE.q) { inp.value = ST_STATE.q; runSearch(ST_STATE.q); }
    if (ST_STATE.sel) openTrace(ST_STATE.sel);
  },
});
