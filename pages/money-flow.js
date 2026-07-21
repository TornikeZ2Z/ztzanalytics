/* MONEY FLOW — per-job cash reconciliation (FINANCIAL group). Rebuilds the old
   "Net Cash Closing System" sheet + "Jobs Money Flow" Looker on the warehouse, and
   REPLACES the Google-Form entry path.

   DESIGNED FOR THE LEAST-TECHNICAL USER IN THE COMPANY (Tornike 2026-07-20/21): the daily
   operator is a 60-year-old. EVERY action goes through ONE simple POPUP:
     * two views only — Not Confirmed / Confirmed (future + filtered jobs hidden entirely)
     * the green CONFIRM button and the row itself both open the SAME popup, with Type and
       Amount already filled so the Balance reads $0 — he checks, presses Save, done.
     * popup fields exactly as specified: Net Cash (read-only, + contract link), Net Cash
       Balance (live calculation, read-only), Type, Amount, Forman Deduction, Advance
       Payment, small Note. Labels use the ORIGINAL system's column names (his ask
       2026-07-21) so nobody needs retraining; table adds Contract URL + Submission Time.
     * Save records ONLY what changed (untouched deduction/advance write nothing).
     * a full-card LOADER whenever data is fetched or saved, so nothing silently shifts
     * no horizontal scrollbar — the table fits, details live in the popup
   Data: fct_money_flow (6h base) + /api/_mf live overlay; statuses recomputed client-side
   with the pipeline's proven rules. Writes: POST /api/_mf, history kept on every change. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_money_flow) {
    RS.DATASETS.fct_money_flow = {
      table: "fct_money_flow",
      cols: ["Event ID", "Calendar ID", "Job Date", "Event Title", "Job No", "Job Code", "Customer",
             "Forman Email", "Forman", "Job Type", "Contract Type", "Net Cash (DC)", "Net Cash (Closing)",
             "Expected Net Cash", "Contract URL", "DC Submission Time",
             "Cash Flow", "Cash Flow Time", "Cash Flow Source",
             "Cash Flow Records", "Advance", "Deduction", "Balance", "Status"],
    };
  }
})();

var MF_TOL = 10;   // settled when |balance| <= this — same constant as src/money_flow.py

registerPage({
  id: "money-flow",
  group: "logistics",
  title: "Money Flow",
  async render(host) {
    var esc = RSC.esc;
    var POS = "#1c7a4a", NEG = "#b02a37", BLUE = "#2f6fd0";

    if (!document.getElementById("mfCss")) {
      var st = document.createElement("style"); st.id = "mfCss";
      st.textContent = `
        .mf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .mf-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .mf-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
        .mf-live{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(28,122,74,.12);color:${POS};vertical-align:2px}
        .mf-live.off{background:rgba(245,165,36,.14);color:#a06a00}
        .mf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
        .mf-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
        .mf-kpi b{display:block;font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .mf-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
        .mf-kpi small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .mf-kpi.neg b{color:${NEG}} .mf-kpi.pos b{color:${POS}}
        .mf-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .mf-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px}
        .mf-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13.5px;font-weight:800;padding:8px 18px;border-radius:8px}
        .mf-seg button.on{background:var(--brand);color:var(--brand-ink)}
        .mf-seg button i{font-style:normal;font-weight:800;font-size:11px;opacity:.75;margin-left:6px}
        .mf-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:260px;flex:1;max-width:480px}
        .mf-sel{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 10px}
        .mf-fmwrap{position:relative}
        .mf-fmbtn{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;cursor:pointer}
        .mf-fmbtn.on{border-color:var(--brand)}
        .mf-fmpop{position:absolute;top:calc(100% + 6px);left:0;z-index:40;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;box-shadow:0 10px 30px rgba(14,22,33,.14);padding:8px;min-width:230px;max-height:320px;overflow:auto}
        .mf-fmpop label{display:flex;gap:8px;align-items:center;font-size:12.5px;padding:6px 8px;border-radius:8px;cursor:pointer}
        .mf-fmpop label:hover{background:var(--panel-2)}
        .mf-fmpop .clr{display:block;width:100%;margin-top:6px;font:inherit;font-size:11.5px;font-weight:700;color:${BLUE};background:transparent;border:1px solid var(--line-2);border-radius:8px;padding:6px;cursor:pointer}
        .mf-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden;position:relative}
        .mf-tbl{width:100%;border-collapse:collapse;font-size:13px}
        .mf-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none;z-index:2}
        .mf-tbl th.r,.mf-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .mf-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
        .mf-tbl tbody tr.mf-row{cursor:pointer}
        .mf-tbl tbody tr.mf-row:hover{background:var(--panel-2)}
        .mf-wrap{overflow-y:auto;overflow-x:hidden;max-height:calc(100vh - 320px)}
        .mf-confirm{font:inherit;font-size:12.5px;font-weight:800;background:${POS};color:#fff;border:0;border-radius:9px;padding:8px 14px;cursor:pointer;white-space:nowrap}
        .mf-confirm:hover{filter:brightness(1.08)}
        .mf-pill{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .mf-st-rec{background:rgba(28,122,74,.13);color:${POS}}
        .mf-st-con{background:rgba(47,111,208,.12);color:${BLUE}}
        .mf-st-mnr{background:rgba(176,42,55,.12);color:${NEG}}
        .mf-st-nib{background:rgba(245,165,36,.16);color:#a06a00}
        .mf-tbl.mfc th{padding:9px 10px}
        .mf-tbl.mfc td{padding:8px 10px;font-size:12.5px}
        .mf-dseg button{padding:8px 13px;font-size:12px}
        /* FIXED column layout: a wide customer name must never re-shape the table —
           every table locks its column widths, long text ellipses (his ask 2026-07-22) */
        .mf-tbl.fx{table-layout:fixed}
        .mf-tbl.fx td{max-width:none}
        .mf-bars{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
        .mf-bars .mf-bar{margin-bottom:0}
        .mf-dtwrap{position:relative}
        .mf-dtpop{position:absolute;top:calc(100% + 6px);left:0;z-index:40;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;box-shadow:0 10px 30px rgba(14,22,33,.14);padding:10px;min-width:280px}
        .mf-dtpop .pre{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px}
        .mf-dtpop .pre button{font:inherit;font-size:12px;font-weight:700;padding:7px 8px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink);cursor:pointer}
        .mf-dtpop .pre button:hover{background:var(--panel-2)}
        .mf-dtpop .pre button.on{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}
        .mf-dtpop .rng{display:flex;gap:6px;align-items:center;font-size:12px;color:var(--faint);margin-bottom:8px}
        .mf-dtpop input[type=date]{font:inherit;font-size:12px;padding:6px 7px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink);flex:1;min-width:0}
        .mf-dtpop .clr{display:block;width:100%;font:inherit;font-size:11.5px;font-weight:700;color:${BLUE};background:transparent;border:1px solid var(--line-2);border-radius:8px;padding:7px;cursor:pointer}
        .mf-fmrow{cursor:pointer}
        .mf-fmrow:hover{background:var(--panel-2)}
        .mf-fmrow td{font-weight:700}
        .mf-caret{color:var(--faint);font-size:11px;display:inline-block;width:14px}
        .mf-fmsub>td{padding:0 0 16px 24px;background:var(--panel-2)}
        .mf-fmsub .mf-tbl{background:var(--panel);border:1px solid var(--line-2);border-radius:10px}
        .mf-neg{color:${NEG};font-weight:700} .mf-pos{color:${POS};font-weight:700}
        .mf-age{font-size:10.5px;color:var(--faint)}
        .mf-doc{font-size:12px;font-weight:800;color:${BLUE};text-decoration:none;white-space:nowrap}
        .mf-doc:hover{text-decoration:underline}
        .mf-mdc{font-size:10.5px;color:var(--faint);margin:-4px 0 6px}
        .mf-fnote{padding:10px 14px;font-size:11px;color:var(--faint);border-top:1px solid var(--line)}
        .mf-load{padding:40px;text-align:center;color:var(--faint)}
        .mf-veil{position:absolute;inset:0;z-index:30;background:color-mix(in srgb, var(--panel) 72%, transparent);display:flex;align-items:center;justify-content:center;gap:12px;font-size:14px;font-weight:800;color:var(--muted)}
        .mf-spin{width:22px;height:22px;border:3px solid var(--line-2);border-top-color:var(--brand);border-radius:50%;animation:mfspin .8s linear infinite}
        @keyframes mfspin{to{transform:rotate(360deg)}}
        /* ---- THE popup ---- */
        .mf-back{position:fixed;inset:0;z-index:90;background:rgba(14,22,33,.45);display:flex;align-items:center;justify-content:center;padding:20px}
        .mf-modal{background:var(--panel);border:1px solid var(--line-2);border-radius:16px;box-shadow:0 24px 70px rgba(14,22,33,.35);width:min(430px,94vw);max-height:92vh;overflow:auto;position:relative}
        .mf-mhead{padding:16px 18px 12px;border-bottom:1px solid var(--line)}
        .mf-mhead b{font-size:15.5px;font-weight:800}
        .mf-mhead div{font-size:11.5px;color:var(--faint);margin-top:2px}
        .mf-mx{position:absolute;top:12px;right:14px;font:inherit;font-size:16px;font-weight:800;color:var(--faint);background:transparent;border:0;cursor:pointer;padding:4px 8px}
        .mf-mx:hover{color:var(--ink)}
        .mf-mbody{padding:14px 18px 18px}
        .mf-ro{display:flex;justify-content:space-between;align-items:baseline;padding:9px 12px;border:1px solid var(--line);border-radius:10px;margin-bottom:8px;background:var(--panel-2)}
        .mf-ro span{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}
        .mf-ro b{font-size:16px;font-weight:800;font-variant-numeric:tabular-nums}
        .mf-ro.bal b{transition:color .15s}
        .mf-ro.bal.ok b{color:${POS}} .mf-ro.bal.off b{color:${NEG}}
        .mf-fld{margin-top:10px}
        .mf-fld label{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-bottom:3px}
        .mf-fld select,.mf-fld input{font:inherit;font-size:14px;width:100%;box-sizing:border-box;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:9px 11px}
        .mf-fld input.note{font-size:12px;padding:7px 10px}
        .mf-mrow{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .mf-mfoot{display:flex;gap:10px;justify-content:flex-end;align-items:center;margin-top:14px}
        .mf-cancel{font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:10px 16px;cursor:pointer}
        .mf-save{font:inherit;font-size:14px;font-weight:800;background:${POS};color:#fff;border:0;border-radius:10px;padding:10px 22px;cursor:pointer}
        .mf-save[disabled]{opacity:.55;cursor:default}
        .mf-merr{color:${NEG};font-size:11.5px;font-weight:700;margin-top:8px}
        .mf-mhist{margin-top:12px;border-top:1px solid var(--line);padding-top:8px}
        .mf-mhist>button{font:inherit;font-size:11px;font-weight:700;color:${BLUE};background:transparent;border:0;padding:0;cursor:pointer}
        .mf-htbl{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
        .mf-htbl th{text-align:left;font-size:9px;text-transform:uppercase;color:var(--faint);padding:4px 6px;border-bottom:1px solid var(--line)}
        .mf-htbl td{padding:5px 6px;border-top:1px solid var(--line)}
        .mf-htbl tr.gone td{opacity:.5;text-decoration:line-through}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="mf-head"><div>
        <h1>Money Flow <span class="mf-live off" id="mfLive">◷ syncing…</span></h1>
      </div><div><button class="mf-cancel" id="mfRefresh" style="padding:8px 14px;font-size:12.5px">↻ Refresh</button></div></div>
      <div id="mfBody"><div class="mf-load"><div class="mf-spin" style="margin:0 auto 12px"></div>Loading jobs…</div></div>
      <div id="mfModalHost"></div>`;

    var S = window.__MF || (window.__MF = {
      view: "foreman",     // Balance by Foreman is the landing view (his pick 2026-07-21)
      q: "", formen: [], live: null, liveOk: false,
      sort: { k: "Job Date", d: -1 }, months: 0, fmOpen: false, busy: false, modalEv: null,
      dense: "overview",   // 'overview' = the compact table (default); 'details' = every column
      fmx: {},             // Balance-by-Foreman view: which foremen are expanded
    });
    if (!S.dense) S.dense = "overview";
    if (!S.fmx) S.fmx = {};
    if (!S.sel) S.sel = {};   // bulk-confirm ticks (event ids)
    if (!S.dateLabel) { S.dateFrom = null; S.dateTo = null; S.dateLabel = "All time"; S.dtOpen = false; }
    if (!Array.isArray(S.formen)) S.formen = [];
    S.modalEv = null;

    var base;
    try { base = await RS.load("fct_money_flow"); }
    catch (e) { document.getElementById("mfBody").innerHTML = '<div class="mf-load">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    // ---------- helpers ----------
    function num(v) { var x = parseFloat(v); return isNaN(x) ? null : x; }
    function money(v) {
      if (v == null) return "—";
      var n = Math.round(v);
      return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");
    }
    function money2(v) {
      if (v == null) return "—";
      return (v < 0 ? "-$" : "$") + Math.abs(Math.round(v * 100) / 100).toLocaleString("en-US");
    }
    function fmtD(v) {
      if (!v) return "—";
      var d = new Date(String(v).slice(0, 10) + "T12:00:00");
      return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    function fmtTs(v) { return v ? String(v).slice(0, 16).replace("T", " ") : "—"; }
    var todayIso = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    // ---------- live overlay (same rules as src/money_flow.py) ----------
    // MEMOIZED (2026-07-21): recomputing 3.5k rows' statuses on EVERY repaint cost ~1s —
    // ticks, expands and the post-save update all felt heavy. The result only changes
    // when the DATA changes (loadLive / patchLive), so those two invalidate the cache.
    var _ov = null;
    function overlaid() {
      if (_ov) return _ov;
      var liveByEv = {};
      if (S.live) S.live.rows.forEach(function (r) { liveByEv[r.ev] = r; });
      _ov = base.map(function (b) {
        var ev = b["Event ID"], lv = liveByEv[ev];
        var r = {
          ev: ev, date: String(b["Job Date"]).slice(0, 10), title: b["Event Title"],
          jobNo: b["Job No"], jobCode: b["Job Code"], customer: b["Customer"],
          forman: b["Forman"] || "—", formanEmail: b["Forman Email"],
          jobType: b["Job Type"], ct: b["Contract Type"],
          expected: num(lv && lv.expected != null ? lv.expected : b["Expected Net Cash"]),
          closingNC: num(b["Net Cash (Closing)"]),
          flow: lv ? (lv.flow != null ? lv.flow : null) : num(b["Cash Flow"]),
          flowTs: lv ? lv.flow_ts : b["Cash Flow Time"],
          flowSrc: lv ? lv.flow_src : b["Cash Flow Source"],
          adv: lv ? lv.adv : num(b["Advance"]),
          ded: lv ? lv.ded : num(b["Deduction"]),
          baseAdv: num(b["Advance"]),
          contractUrl: b["Contract URL"] || null,
          dcTs: b["DC Submission Time"] || null,
          calendarId: b["Calendar ID"] || null,
          baseStatus: b["Status"],
        };
        if (r.expected == null && r.closingNC != null) r.expected = r.closingNC;
        // DEPLOY-SKEW GUARD: an older bridge serves "taken away" advances UNSIGNED (+A)
        // while the nightly fact knows the true −A. When the two differ ONLY by sign,
        // trust the negative — otherwise the balance (and the Confirm preset that gets
        // WRITTEN to the ledger) is wrong by 2A. Harmless once both agree.
        if (lv && r.adv != null && r.baseAdv != null && r.adv > 0 && r.baseAdv < 0
            && Math.abs(r.adv + r.baseAdv) < 0.01) r.adv = r.baseAdv;
        // Balance = Expected − Advance − Flow + Deduction — the original system's exact
        // formula (col U−V−W+X). Advance arrives SIGNED from the server (brought +,
        // taken-away −); deduction ADDS: withheld foreman pay must still reach base.
        r.balance = (r.expected == null) ? null
          : r.expected - (r.adv || 0) - (r.flow || 0) + (r.ded || 0);
        r.status = computeStatus(r);
        return r;
      });
      return _ov;
    }
    function computeStatus(r) {
      // Job Type in the table is now the LITERAL replica of the old workbook's formula
      // (title overrides description; includes On Hold), so the client only re-applies
      // the same Filter-Out set + the blank-record and cancelled-title rules he asked for
      var jt = String(r.jobType || "");
      if (r.baseStatus === "Filter Out" || jt === "Box Delivery" || jt === "In-Home Estimate"
          || jt === "Cancelled" || jt === "On Hold" || !String(r.jobNo || "").trim()
          || /cancel|cancl|canel|o[n]?[ -]?hold/i.test(String(r.title || ""))) return "Filter Out";
      if (r.date > todayIso) return "Job is in the Future";
      if (r.baseStatus === "Tracked on Sibling Event" && r.expected == null) return "Tracked on Sibling Event";
      if (r.expected == null) return "Contract Not Received";
      if (r.flow == null && Math.abs(r.balance == null ? 0 : r.balance) > MF_TOL) return "Money Not Received";
      if (Math.abs(r.balance == null ? 0 : r.balance) <= MF_TOL) return "Money Received";
      return "Not in Balance";
    }
    // view split (his spec 2026-07-21): Balance by Foreman = waiting for cash
    // (incl. no-contract); Not in Balance Jobs = its own foreman-grouped tab; History =
    // everything confirmed. The old flat "Not Confirmed" list is gone.
    var MAINSET = { "Money Not Received": 1, "Contract Not Received": 1 };
    var NOTCONF = { "Money Not Received": 1, "Not in Balance": 1, "Contract Not Received": 1 };

    var entriesByEv = {};
    function indexEntries() {
      entriesByEv = {};
      ((S.live && S.live.entries) || []).forEach(function (en) {
        var k = en.event_id || "";
        if (k) (entriesByEv[k] = entriesByEv[k] || []).push(en);
      });
    }
    // OPTIMISTIC UPDATE (2026-07-21: after the save got fast, the operator still watched
    // an "Updating…" veil while the live query re-ran). We know exactly what was saved —
    // patch the in-memory overlay, repaint INSTANTLY, and let the real refresh reconcile
    // silently in the background.
    function patchLive(evId, type, amount) {
      if (!S.live || !S.live.rows) return;
      var lv = null;
      for (var i = 0; i < S.live.rows.length; i++) if (S.live.rows[i].ev === evId) { lv = S.live.rows[i]; break; }
      if (!lv) {
        var b = overlaid().filter(function (x) { return x.ev === evId; })[0];
        lv = { ev: evId, expected: b ? b.expected : null, flow: b ? b.flow : null,
               flow_ts: b ? b.flowTs : null, flow_src: b ? b.flowSrc : null,
               records: 0, adv: b ? b.adv : null, adv_ts: null, ded: b ? b.ded : null };
        S.live.rows.push(lv);
      }
      var nowTs = new Date().toISOString().slice(0, 16).replace("T", " ");
      if (type === "Cash Brought to Base") { lv.flow = amount; lv.flow_ts = nowTs; lv.flow_src = "portal"; lv.records = (lv.records || 0) + 1; }
      else if (type === "Cash Taken Away from Base") { lv.flow = -amount; lv.flow_ts = nowTs; lv.flow_src = "portal"; lv.records = (lv.records || 0) + 1; }
      else if (type === "Advance Payment") { lv.adv = amount; lv.adv_ts = nowTs; }
      else if (type === "Forman Deduction") { lv.ded = amount; }
      if (S.live.entries) S.live.entries.push({ event_id: evId, type: type, amount: amount,
        at: nowTs, by: "you", note: "", current: 1 });
      indexEntries();
      _ov = null;   // data changed — recompute the overlay on the next paint
    }

    async function loadLive(fresh) {
      try {
        var r = await fetch(ZTZ.API + "/api/_mf" + (fresh ? "?fresh=1" : ""),
          { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        S.live = await r.json(); S.liveOk = true; indexEntries();
        _ov = null;   // data changed — recompute the overlay on the next paint
      } catch (e) { S.liveOk = false; S.liveErr = String(e && e.message || e); }
    }

    // the settle preset: Type + Amount such that the balance becomes exactly $0
    // (a new record REPLACES the old one — last-record-wins — so this is the full figure)
    function settle(r) {
      if (r.expected == null) return null;
      var v = Math.round((r.expected - (r.adv || 0) + (r.ded || 0)) * 100) / 100;
      return { type: v < 0 ? "Cash Taken Away from Base" : "Cash Brought to Base", amount: Math.abs(v) };
    }

    // ---------- painting ----------
    function paint() {
      if (S.view === "todo") S.view = "foreman";      // migrate pre-rework stored state
      if (S.view === "done") S.view = "history";
      var rows = overlaid();
      var q = S.q.trim().toLowerCase();
      var main = rows.filter(function (r) { return MAINSET[r.status]; });
      var nib = rows.filter(function (r) { return r.status === "Not in Balance"; });
      var done = rows.filter(function (r) { return r.status === "Money Received"; });
      var cur = done.slice();                          // History = the flat table
      if (S.formen.length) cur = cur.filter(function (r) { return S.formen.indexOf(r.forman) >= 0; });
      if (S.dateFrom) cur = cur.filter(function (r) { return r.date >= S.dateFrom; });
      if (S.dateTo) cur = cur.filter(function (r) { return r.date <= S.dateTo; });
      if (q) cur = cur.filter(function (r) {
        return String(r.customer || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobNo || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobCode || "").toLowerCase().indexOf(q) >= 0
          || String(r.forman || "").toLowerCase().indexOf(q) >= 0;
      });
      var k = S.sort.k, d = S.sort.d;
      cur.sort(function (a, b) {
        var va = k === "Balance" ? (a.balance == null ? -Infinity : a.balance)
               : k === "Expected" ? (a.expected == null ? -Infinity : a.expected) : a.date;
        var vb = k === "Balance" ? (b.balance == null ? -Infinity : b.balance)
               : k === "Expected" ? (b.expected == null ? -Infinity : b.expected) : b.date;
        return va < vb ? -d : va > vb ? d : 0;
      });

      var outBal = 0; main.forEach(function (r) { outBal += (r.balance || 0); });
      var nibBal = 0; nib.forEach(function (r) { nibBal += (r.balance || 0); });
      var noCon = main.filter(function (r) { return r.status === "Contract Not Received"; }).length;

      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi neg"><b>' + money(outBal) + '</b><span>Waiting for cash</span><small>' + main.length + ' job' + (main.length === 1 ? "" : "s") + ' open</small></div>'
        + '<div class="mf-kpi"><b>' + money(nibBal) + '</b><span>Not in balance</span><small>' + nib.length + ' job' + (nib.length === 1 ? "" : "s") + ' off by more than $' + MF_TOL + '</small></div>'
        + '<div class="mf-kpi"><b>' + noCon + '</b><span>No contract data</span><small>needs a manual amount</small></div>'
        + '<div class="mf-kpi pos"><b>' + done.length.toLocaleString() + '</b><span>History</span><small>confirmed, settled within $' + MF_TOL + '</small></div></div>';

      var allF = {};
      rows.forEach(function (r) { if (NOTCONF[r.status] || r.status === "Money Received") { if (r.forman && r.forman !== "—") allF[r.forman] = 1; } });
      var fmLabel = S.formen.length ? "Foremen (" + S.formen.length + ")" : "All foremen";
      var fmPop = S.fmOpen ? '<div class="mf-fmpop">' + Object.keys(allF).sort().map(function (f) {
          return '<label><input type="checkbox" data-mff="' + esc(f) + '"' + (S.formen.indexOf(f) >= 0 ? " checked" : "") + '> ' + esc(f) + "</label>";
        }).join("") + '<button class="clr" id="mfFmClr">Show all foremen</button></div>' : "";

      // foreman grouping — used by BOTH grouped tabs (Balance by Foreman = waiting for
      // cash incl. no-contract; Not in Balance Jobs = its own identical screen); jobs
      // with no contract amount are LISTED but add $0 to the total (his call 2026-07-21)
      var groupsFor = function (jobsIn) {
        var jobs = jobsIn.slice();
        if (S.dateFrom) jobs = jobs.filter(function (r) { return r.date >= S.dateFrom; });
        if (S.dateTo) jobs = jobs.filter(function (r) { return r.date <= S.dateTo; });
        var groups = {};
        jobs.forEach(function (r) {
          var f = r.forman || "—";
          (groups[f] = groups[f] || { jobs: [], total: 0, noCon: 0 }).jobs.push(r);
          if (r.balance != null) groups[f].total += r.balance; else groups[f].noCon++;
        });
        var gnames = Object.keys(groups);
        if (S.formen.length) gnames = gnames.filter(function (f) { return S.formen.indexOf(f) >= 0; });
        if (q) gnames = gnames.filter(function (f) { return f.toLowerCase().indexOf(q) >= 0; });
        gnames.sort(function (a, b) { return Math.abs(groups[b].total) - Math.abs(groups[a].total); });
        return { groups: groups, names: gnames };
      };

      // bulk selection — the presets of every ticked job (only settleable jobs tick)
      var selEvs = Object.keys(S.sel).filter(function (ev) { return S.sel[ev]; });
      var selJobs = rows.filter(function (r) { return S.sel[r.ev] && settle(r) && r.status !== "Money Received"; });
      var selTotal = 0;
      selJobs.forEach(function (r) {
        var p = settle(r); selTotal += (p.type === "Cash Taken Away from Base" ? -p.amount : p.amount);
      });

      var segBtn = function (id, label, n) {
        return '<button class="' + (S.view === id ? "on" : "") + '" data-mfv="' + id + '">' + label + "<i>" + n + "</i></button>";
      };
      var dBtn = function (id, label) {
        return '<button class="' + (S.dense === id ? "on" : "") + '" data-mfd="' + id + '">' + label + "</button>";
      };
      // date filter: preset ranges + a custom from→to, in a popover like the foremen one
      var iso = function (d2) { return d2.toLocaleDateString("en-CA"); };
      var now2 = new Date();
      var firstThis = iso(new Date(now2.getFullYear(), now2.getMonth(), 1));
      var firstPrev = iso(new Date(now2.getFullYear(), now2.getMonth() - 1, 1));
      var lastPrev = iso(new Date(now2.getFullYear(), now2.getMonth(), 0));
      var back3 = new Date(now2); back3.setMonth(back3.getMonth() - 3);
      var presets = [
        ["All time", "", ""], ["This month", firstThis, todayIso],
        ["Past month", firstPrev, lastPrev], ["Last 3 months", iso(back3), todayIso],
        ["This year", now2.getFullYear() + "-01-01", todayIso],
      ];
      var dtPop = S.dtOpen ? '<div class="mf-dtpop">'
        + '<div class="pre">' + presets.map(function (p) {
            return '<button data-mfdt="' + esc(p[0]) + '" data-f="' + p[1] + '" data-t="' + p[2] + '"'
              + (S.dateLabel === p[0] ? ' class="on"' : "") + ">" + esc(p[0]) + "</button>";
          }).join("") + "</div>"
        + '<div class="rng"><input type="date" id="mfDtFrom" value="' + esc(S.dateFrom || "") + '"><span>→</span>'
        + '<input type="date" id="mfDtTo" value="' + esc(S.dateTo || "") + '"></div>'
        + '<button class="clr" id="mfDtApply">Apply this range</button>'
        + "</div>" : "";
      var bar = '<div class="mf-bars">'
        + '<div class="mf-bar"><div class="mf-seg">' + segBtn("foreman", "Balance by Foreman", main.length)
        + segBtn("nib", "Not in Balance Jobs", nib.length)
        + segBtn("history", "History", done.length) + "</div></div>"
        + '<div class="mf-bar">'
        + '<div class="mf-seg mf-dseg">' + dBtn("overview", "Overview") + dBtn("details", "Details") + "</div>"
        + '<div class="mf-fmwrap"><button class="mf-fmbtn' + (S.formen.length ? " on" : "") + '" id="mfFmBtn">' + esc(fmLabel) + ' ▾</button>' + fmPop + "</div>"
        + '<div class="mf-dtwrap"><button class="mf-fmbtn' + (S.dateFrom || S.dateTo ? " on" : "") + '" id="mfDtBtn">📅 ' + esc(S.dateLabel) + ' ▾</button>' + dtPop + "</div>"
        + '<input class="mf-q" id="mfQ" placeholder="' + (S.view === "history" ? "Search customer / job / foreman" : "Search foreman") + '" value="' + esc(S.q) + '">'
        + (selJobs.length ? '<button class="mf-confirm" id="mfBulk" style="padding:9px 16px">Confirm ' + selJobs.length + " selected — " + money(selTotal) + "</button>" : "")
        + "</div></div>";

      var arrow = function (kk) { return S.sort.k === kk ? (S.sort.d < 0 ? " ↓" : " ↑") : ""; };
      var statusPill = function (r) {
        if (r.status === "Money Received") return '<span class="mf-pill mf-st-rec">Received</span>';
        if (r.status === "Contract Not Received") return '<span class="mf-pill mf-st-con">No Contract</span>';
        if (r.status === "Not in Balance") return '<span class="mf-pill mf-st-nib">Not in Balance</span>';
        return '<span class="mf-pill mf-st-mnr">Not Received</span>';
      };
      var actionCell = function (r) {
        if (r.status === "Money Received") return '<span class="mf-pill mf-st-rec">✓ Confirmed</span>';
        if (r.status === "Contract Not Received")
          return '<span class="mf-pill mf-st-con" title="No contract amount yet — click the row and enter the cash manually">no contract</span>';
        return '<button class="mf-confirm" data-mfc="' + esc(r.ev) + '">Confirm ' + money(settle(r).type === "Cash Taken Away from Base" ? -settle(r).amount : settle(r).amount) + "</button>";
      };
      var docCell = function (r) {
        return r.contractUrl
          ? '<a class="mf-doc" href="' + esc(r.contractUrl) + '" target="_blank" rel="noopener" title="Open the contract file">Open ↗</a>'
          : '<span style="color:var(--faint)">—</span>';
      };
      var balCls = function (r) {
        return (r.balance || 0) > MF_TOL ? "mf-neg" : (r.balance || 0) < -MF_TOL ? "mf-pos" : "";
      };

      var veil = S.busy ? '<div class="mf-veil"><div class="mf-spin"></div>Updating…</div>' : "";
      var content;

      // one checkbox per settleable job — ticked jobs confirm together (his ask)
      var ckCell = function (r) {
        if (!settle(r) || r.status === "Money Received") return "<td></td>";
        return '<td><input type="checkbox" class="mf-ck" data-mfsel="' + esc(r.ev) + '"'
          + (S.sel[r.ev] ? " checked" : "") + "></td>";
      };
      var renderGrouped = function (jobsSet, label) {
        var gg = groupsFor(jobsSet), groups = gg.groups, gnames = gg.names;
        var frows = gnames.map(function (f) {
          var g = groups[f], open = !!S.fmx[f];
          var head = '<tr class="mf-fmrow" data-mfx="' + esc(f) + '">'
            + '<td><span class="mf-caret">' + (open ? "▾" : "▸") + "</span>" + esc(f) + "</td>"
            + '<td class="r">' + g.jobs.length + "</td>"
            + '<td class="r">' + (g.noCon ? g.noCon : "—") + "</td>"
            + '<td class="r ' + (Math.abs(g.total) > MF_TOL ? "mf-neg" : "") + '"><b>' + money(g.total) + "</b></td></tr>";
          var sub = "";
          if (open) {
            // the job list honours the Overview/Details toggle too (his ask 2026-07-21)
            var jobs = g.jobs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
            var subHead, subBody;
            if (S.dense === "details") {
              subHead = "<th></th><th>Job date</th><th>Job #</th><th>Customer</th>"
                + '<th class="r">Net Cash</th><th class="r">Advance Payment</th>'
                + '<th class="r">Forman Deduction</th><th class="r">Net Cash Flow</th>'
                + '<th class="r">Net Cash Balance</th><th>Submission Time</th>'
                + "<th>Contract</th><th>Status</th><th></th>";
              subBody = jobs.map(function (r) {
                return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
                  + ckCell(r)
                  + "<td>" + fmtD(r.date) + "</td>"
                  + "<td>" + esc(r.jobNo || "—") + "</td>"
                  + '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>"
                  + '<td class="r">' + money(r.expected) + "</td>"
                  + '<td class="r">' + (r.adv ? money(r.adv) : "—") + "</td>"
                  + '<td class="r">' + (r.ded ? money(r.ded) : "—") + "</td>"
                  + '<td class="r">' + money(r.flow) + "</td>"
                  + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
                  + "<td>" + fmtTs(r.flowTs) + "</td>"
                  + "<td>" + docCell(r) + "</td>"
                  + "<td>" + statusPill(r) + "</td>"
                  + "<td>" + actionCell(r) + "</td></tr>";
              }).join("");
            } else {
              subHead = "<th></th><th>Job date</th><th>Customer</th><th class=\"r\">Net Cash Balance</th>"
                + "<th>Contract</th><th>Status</th><th></th>";
              subBody = jobs.map(function (r) {
                return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
                  + ckCell(r)
                  + "<td>" + fmtD(r.date) + "</td>"
                  + '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>"
                  + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
                  + "<td>" + docCell(r) + "</td>"
                  + "<td>" + statusPill(r) + "</td>"
                  + "<td>" + actionCell(r) + "</td></tr>";
              }).join("");
            }
            var subCols = S.dense === "details"
              ? '<colgroup><col style="width:32px"><col style="width:95px"><col style="width:85px"><col>'
                + '<col style="width:95px"><col style="width:110px"><col style="width:115px"><col style="width:100px">'
                + '<col style="width:110px"><col style="width:125px"><col style="width:70px"><col style="width:110px"><col style="width:160px"></colgroup>'
              : '<colgroup><col style="width:36px"><col style="width:110px"><col>'
                + '<col style="width:130px"><col style="width:90px"><col style="width:140px"><col style="width:180px"></colgroup>';
            sub = '<tr class="mf-fmsub"><td colspan="4"><table class="mf-tbl mfc fx">' + subCols + '<thead><tr>'
              + subHead + "</tr></thead><tbody>" + subBody + "</tbody></table></td></tr>";
          }
          return head + sub;
        }).join("");
        return '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl fx">'
          + '<colgroup><col><col style="width:110px"><col style="width:110px"><col style="width:180px"></colgroup><thead><tr>'
          + '<th>Foreman</th><th class="r">Open jobs</th><th class="r">No contract</th><th class="r">Total Net Cash Balance</th>'
          + "</tr></thead><tbody>"
          + (frows || '<tr><td colspan="4" style="color:var(--faint);padding:18px">' + label + " 🎉</td></tr>")
          + "</tbody></table></div></div>";
      };

      if (S.view === "foreman") {
        content = renderGrouped(main, "No outstanding balances.");
      } else if (S.view === "nib") {
        content = renderGrouped(nib, "Nothing out of balance.");
      } else if (S.dense === "overview") {
        // ---- compact Overview: Job date · Customer · Foreman · Balance · Contract · Status ----
        var bodyO = cur.map(function (r) {
          var age = Math.floor((Date.now() - new Date(r.date + "T12:00:00")) / 864e5);
          return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
            + "<td>" + fmtD(r.date) + "</td>"
            + '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>"
            + "<td>" + esc(r.forman) + "</td>"
            + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
            + "<td>" + docCell(r) + "</td>"
            + "<td>" + statusPill(r) + "</td>"
            + "<td>" + actionCell(r) + "</td></tr>";
        }).join("");
        content = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl mfc fx">'
          + '<colgroup><col style="width:115px"><col><col style="width:170px"><col style="width:140px"><col style="width:90px"><col style="width:140px"><col style="width:180px"></colgroup><thead><tr>'
          + '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Customer</th><th>Foreman</th>"
          + '<th class="r" data-mfs="Balance">Net Cash Balance' + arrow("Balance") + "</th>"
          + "<th>Contract</th><th>Status</th><th></th>"
          + "</tr></thead><tbody>"
          + (bodyO || '<tr><td colspan="7" style="color:var(--faint);padding:18px">' + "Nothing confirmed yet." + "</td></tr>")
          + "</tbody></table></div></div>";
      } else {
        // ---- full Details: the ORIGINAL system's columns; Net Cash Flow sits to the RIGHT
        // of Forman Deduction (his order, 2026-07-21) so the arithmetic still reads
        // left-to-right into the balance ----
        var bodyD = cur.map(function (r) {
          var age = Math.floor((Date.now() - new Date(r.date + "T12:00:00")) / 864e5);
          return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
            + "<td>" + fmtD(r.date) + "</td>"
            + "<td>" + esc(r.jobNo || "—") + "</td>"
            + '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>"
            + "<td>" + esc(r.forman) + "</td>"
            + '<td class="r">' + money(r.expected) + "</td>"
            + '<td class="r">' + (r.adv ? money(r.adv) : "—") + "</td>"
            + '<td class="r">' + (r.ded ? money(r.ded) : "—") + "</td>"
            + '<td class="r">' + money(r.flow) + "</td>"
            + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
            + "<td>" + fmtTs(r.flowTs) + "</td>"
            + "<td>" + docCell(r) + "</td>"
            + "<td>" + actionCell(r) + "</td></tr>";
        }).join("");
        content = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl fx">'
          + '<colgroup><col style="width:100px"><col style="width:90px"><col><col style="width:150px"><col style="width:100px"><col style="width:115px"><col style="width:120px"><col style="width:105px"><col style="width:120px"><col style="width:130px"><col style="width:80px"><col style="width:170px"></colgroup><thead><tr>'
          + '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Job #</th><th>Customer</th><th>Foreman</th>"
          + '<th class="r" data-mfs="Expected">Net Cash' + arrow("Expected") + "</th>"
          + '<th class="r">Advance Payment</th>'
          + '<th class="r">Forman Deduction</th>'
          + '<th class="r">Net Cash Flow</th>'
          + '<th class="r" data-mfs="Balance">Net Cash Balance' + arrow("Balance") + "</th>"
          + "<th>Submission Time</th>"
          + "<th>Contract</th><th></th>"
          + "</tr></thead><tbody>"
          + (bodyD || '<tr><td colspan="12" style="color:var(--faint);padding:18px">' + "Nothing confirmed yet." + "</td></tr>")
          + "</tbody></table></div></div>";
      }

      // repainting replaces the whole table — without restoring the scroll, expanding a
      // foreman far down the list snapped back to the top (his catch 2026-07-21). The
      // vertical scroller is the TABLE WRAP (.mf-wrap), not the window — restore both.
      var sx = window.scrollX, sy = window.scrollY;
      var wrap0 = document.querySelector("#mfBody .mf-wrap");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      document.getElementById("mfBody").innerHTML = kp + bar + content;
      wire();
      var wrap1 = document.querySelector("#mfBody .mf-wrap");
      if (wrap1) { wrap1.scrollTop = wt; wrap1.scrollLeft = wl; }
      window.scrollTo(sx, sy);
    }

    // ---------- BULK CONFIRM: one summary popup for all ticked jobs ----------
    function openBulkModal() {
      var rows = overlaid();
      var jobs = rows.filter(function (r) { return S.sel[r.ev] && settle(r) && r.status !== "Money Received"; });
      if (!jobs.length) return;
      var total = 0;
      jobs.forEach(function (r) {
        var p = settle(r); total += (p.type === "Cash Taken Away from Base" ? -p.amount : p.amount);
      });
      var hostEl = document.getElementById("mfModalHost");
      hostEl.innerHTML = '<div class="mf-back" id="mfBack"><div class="mf-modal">'
        + '<button class="mf-mx" id="mfMx">✕</button>'
        + '<div class="mf-mhead"><b>Confirm ' + jobs.length + " job" + (jobs.length === 1 ? "" : "s") + "</b><div>each records its preset amount so its balance becomes $0</div></div>"
        + '<div class="mf-mbody">'
        + '<table class="mf-htbl"><thead><tr><th>Job date</th><th>Customer</th><th class="r">Amount</th></tr></thead><tbody>'
        + jobs.map(function (r) {
            var p = settle(r);
            return "<tr><td>" + fmtD(r.date) + "</td><td>" + esc(r.customer || "—") + '</td><td class="r">'
              + money2(p.type === "Cash Taken Away from Base" ? -p.amount : p.amount) + "</td></tr>";
          }).join("")
        + '</tbody></table>'
        + '<div class="mf-ro bal ok" style="margin-top:10px"><span>Total</span><b>' + money2(total) + "</b></div>"
        + '<div class="mf-mfoot"><button class="mf-cancel" id="mfMCancel">Cancel</button>'
        + '<button class="mf-save" id="mfBulkSave">Confirm all</button></div>'
        + '<div id="mfMErr"></div>'
        + "</div></div></div>";
      function close() { hostEl.innerHTML = ""; }
      document.getElementById("mfMx").onclick = close;
      document.getElementById("mfMCancel").onclick = close;
      document.getElementById("mfBack").onclick = function (e) { if (e.target && e.target.id === "mfBack") close(); };
      document.getElementById("mfBulkSave").onclick = async function () {
        var btn = this, errEl = document.getElementById("mfMErr");
        btn.disabled = true;
        var saved = 0;
        try {
          for (var i = 0; i < jobs.length; i++) {
            var r = jobs[i], p = settle(r);
            if (!S.sel[r.ev]) continue;   // already saved on a previous attempt
            btn.textContent = "Saving " + (i + 1) + " / " + jobs.length + "…";
            var res = await fetch(ZTZ.API + "/api/_mf", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
              body: JSON.stringify({ entry_type: p.type, amount: p.amount, note: "bulk confirmed",
                                     event_id: r.ev, job_code: r.jobCode || "",
                                     customer: r.customer || "", forman: r.formanEmail || "" }),
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok || !j.ok) throw new Error((r.customer || r.ev) + ": " + (j.error || ("HTTP " + res.status)));
            saved++; delete S.sel[r.ev];
            patchLive(r.ev, p.type, p.amount);              // instant local truth
          }
          close();
          paint();                                          // table updates immediately
          loadLive(true).then(function () { setLiveBadge(); paint(); });  // silent reconcile
        } catch (err) {
          btn.disabled = false; btn.textContent = "Confirm all";
          errEl.innerHTML = '<div class="mf-merr">Saved ' + saved + " of " + jobs.length + ", then failed ("
            + esc(String(err && err.message || err)) + "). The saved ones are recorded — press Confirm all to retry the rest.</div>";
          loadLive(true).then(function () { setLiveBadge(); });
        }
      };
    }

    // ---------- THE POPUP ----------
    function openModal(ev) {
      var r = overlaid().filter(function (x) { return x.ev === ev; })[0];
      if (!r) return;
      S.modalEv = ev;
      var pre = settle(r) || { type: "Cash Brought to Base", amount: "" };
      var hist = (entriesByEv[ev] || []).slice().reverse();
      var hostEl = document.getElementById("mfModalHost");
      hostEl.innerHTML = '<div class="mf-back" id="mfBack"><div class="mf-modal">'
        + '<button class="mf-mx" id="mfMx">✕</button>'
        + '<div class="mf-mhead"><b>' + esc(r.customer || "—") + "</b><div>"
        + esc(r.jobNo || "") + " · " + esc(r.forman) + " · " + fmtD(r.date) + "</div></div>"
        + '<div class="mf-mbody">'
        + '<div class="mf-ro"><span>Net Cash</span><b>' + money2(r.expected)
        + (r.contractUrl ? ' <a class="mf-doc" href="' + esc(r.contractUrl) + '" target="_blank" rel="noopener">contract ↗</a>' : "")
        + (r.calendarId ? ' <a class="mf-doc" href="https://calendar.google.com/calendar/u/0/r/event?eid='
            + esc(btoa(r.ev + " " + r.calendarId).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""))
            + '" target="_blank" rel="noopener">calendar ↗</a>' : "")
        + "</b></div>"
        + (r.dcTs ? '<div class="mf-mdc">Recorded in the contract system ' + fmtTs(r.dcTs) + "</div>" : "")
        + '<div class="mf-ro bal ok" id="mfMBalRow"><span>Net Cash Balance</span><b id="mfMBal">$0</b></div>'
        + '<div class="mf-fld"><label>Type</label><select id="mfMType">'
        + ["Cash Brought to Base", "Cash Taken Away from Base"].map(function (t) {
            return "<option" + (t === pre.type ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>"
        + '<div class="mf-fld"><label>Amount ($)</label><input id="mfMAmt" type="number" step="0.01" min="0" value="' + esc(String(pre.amount)) + '"></div>'
        + '<div class="mf-mrow">'
        + '<div class="mf-fld"><label>Forman Deduction ($)</label><input id="mfMDed" type="number" step="0.01" min="0" value="' + esc(String(r.ded != null ? Math.abs(r.ded) : "")) + '" placeholder="0"></div>'
        // a NEGATIVE advance is a legacy office refund ('Cash Taken Away from Base' in the
        // old advance form) — the portal write path is positive-only (bridge rejects
        // negatives; direction lives in the entry TYPE), so show it locked, not editable
        + '<div class="mf-fld"><label>Advance Payment ($)</label><input id="mfMAdv" type="number" step="0.01"'
        + (r.adv != null && r.adv < 0
            ? ' disabled title="Recorded by the office as a refund (taken away from base) — edited only in the office ledger"'
            : ' min="0"')
        + ' value="' + esc(String(r.adv != null ? r.adv : "")) + '" placeholder="0"></div>'
        + "</div>"
        + '<div class="mf-fld"><label>Note</label><input id="mfMNote" class="note" placeholder="optional"></div>'
        + '<div class="mf-mfoot"><button class="mf-cancel" id="mfMCancel">Cancel</button>'
        + '<button class="mf-save" id="mfMSave">Save</button></div>'
        + '<div id="mfMErr"></div>'
        + (hist.length ? '<div class="mf-mhist"><button id="mfMHistBtn">History (' + hist.length + ") ▸</button><div id=\"mfMHist\" style=\"display:none\">"
          + '<table class="mf-htbl"><thead><tr><th>When</th><th>Type</th><th class="r">Amount</th><th>By</th><th>Note</th></tr></thead><tbody>'
          + hist.map(function (en) {
              return '<tr class="' + (en.current ? "" : "gone") + '"><td>' + fmtTs(en.at) + "</td><td>" + esc(String(en.type).replace("Cash ", "")) + '</td><td class="r">' + money2(en.amount) + "</td><td>" + esc(String(en.by || "").split("@")[0]) + "</td><td>" + esc(en.note || "") + "</td></tr>";
            }).join("") + "</tbody></table></div></div>" : "")
        + "</div></div></div>";

      function calc() {
        var el = document.getElementById("mfMBal"), row = document.getElementById("mfMBalRow");
        // no contract amount -> no balance to compute; a red "−$X" here would tell the
        // operator his CORRECT manual entry is wrong (he was trained: green $0 = good)
        if (r.expected == null) { el.textContent = "no contract amount"; row.className = "mf-ro bal"; return; }
        var type = document.getElementById("mfMType").value;
        var amt = num(document.getElementById("mfMAmt").value);
        var ded = num(document.getElementById("mfMDed").value) || 0;
        var adv = num(document.getElementById("mfMAdv").value) || 0;
        var flow = amt == null ? 0 : (type === "Cash Taken Away from Base" ? -amt : amt);
        var bal = r.expected - adv - flow + ded;
        el.textContent = money2(bal);
        row.className = "mf-ro bal " + (Math.abs(bal) <= MF_TOL ? "ok" : "off");
      }
      ["mfMType", "mfMAmt", "mfMDed", "mfMAdv"].forEach(function (id) {
        var el = document.getElementById(id);
        el.oninput = calc; el.onchange = calc;
      });
      calc();

      function close() { S.modalEv = null; hostEl.innerHTML = ""; }
      document.getElementById("mfMx").onclick = close;
      document.getElementById("mfMCancel").onclick = close;
      document.getElementById("mfBack").onclick = function (e) { if (e.target && e.target.id === "mfBack") close(); };
      var hb = document.getElementById("mfMHistBtn");
      if (hb) hb.onclick = function () {
        var h = document.getElementById("mfMHist");
        var show = h.style.display === "none";
        h.style.display = show ? "" : "none";
        hb.textContent = "History (" + hist.length + ") " + (show ? "▾" : "▸");
      };
      document.getElementById("mfMSave").onclick = async function () {
        var errEl = document.getElementById("mfMErr");
        var type = document.getElementById("mfMType").value;
        var amt = num(document.getElementById("mfMAmt").value);
        var ded = num(document.getElementById("mfMDed").value);
        // a locked (legacy-refund) advance is display-only — never read it back for saving
        var advEl = document.getElementById("mfMAdv");
        var adv = advEl.disabled ? null : num(advEl.value);
        var note = document.getElementById("mfMNote").value.trim();
        if (amt == null || amt < 0) { errEl.innerHTML = '<div class="mf-merr">Enter the amount (a positive number).</div>'; return; }
        // the write path is positive-only: direction comes from the TYPE, and the bridge
        // rejects negatives — catch a typed minus here with words, not an HTTP 400
        if (ded != null && ded < 0) { errEl.innerHTML = '<div class="mf-merr">Forman Deduction must be a positive number.</div>'; return; }
        if (adv != null && adv < 0) { errEl.innerHTML = '<div class="mf-merr">Advance Payment must be a positive number.</div>'; return; }
        // CLEARING a prefilled deduction/advance means "remove it" — record an explicit $0
        // (last-record-wins), otherwise the deletion is silently dropped
        if (ded == null && r.ded != null) ded = 0;
        if (adv == null && r.adv != null && r.adv >= 0) adv = 0;
        // only what CHANGED gets recorded — an untouched deduction/advance writes nothing
        var posts = [];
        var curFlow = r.flow == null ? null : r.flow;
        var newFlow = type === "Cash Taken Away from Base" ? -amt : amt;
        if (curFlow == null || Math.abs(newFlow - curFlow) > 0.009)
          posts.push({ entry_type: type, amount: amt, note: note || "confirmed" });
        if (ded != null && Math.abs(ded - Math.abs(r.ded || 0)) > 0.009)
          posts.push({ entry_type: "Forman Deduction", amount: ded, note: note });
        if (adv != null && Math.abs(adv - (r.adv || 0)) > 0.009)
          posts.push({ entry_type: "Advance Payment", amount: adv, note: note });
        if (!posts.length) { close(); return; }
        var sv = document.getElementById("mfMSave");
        sv.disabled = true; sv.textContent = "Saving…";
        var saved = 0;
        try {
          for (var i = 0; i < posts.length; i++) {
            var body = posts[i];
            body.event_id = ev; body.job_code = r.jobCode || "";
            body.customer = r.customer || ""; body.forman = r.formanEmail || "";
            var res = await fetch(ZTZ.API + "/api/_mf", {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
              body: JSON.stringify(body),
            });
            var j = await res.json().catch(function () { return {}; });
            if (!res.ok || !j.ok) throw new Error(j.error || ("HTTP " + res.status));
            saved++;
            patchLive(ev, body.entry_type, body.amount);   // instant local truth
          }
          close();
          paint();                                          // table updates immediately
          loadLive(true).then(function () { setLiveBadge(); paint(); });  // silent reconcile
        } catch (err) {
          sv.disabled = false; sv.textContent = "Save";
          // each POST commits on its own — never claim "nothing recorded" if some landed
          var state = saved ? "Saved " + saved + " of " + posts.length + " changes, then failed"
                            : "Nothing was recorded";
          errEl.innerHTML = '<div class="mf-merr">Couldn’t finish saving (' + esc(String(err && err.message || err)) + "). " + state + " — press Save to try the rest again.</div>";
          if (saved) { loadLive(true).then(function () { setLiveBadge(); }); }
        }
      };
    }

    function wire() {
      var root = host;
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfv]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-mfv"); paint(); };
      });
      // Overview / Details density toggle
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfd]"), function (b) {
        b.onclick = function () { S.dense = b.getAttribute("data-mfd"); paint(); };
      });
      // Balance by Foreman: a foreman row expands/collapses his open-job list
      Array.prototype.forEach.call(root.querySelectorAll("tr[data-mfx]"), function (tr) {
        tr.onclick = function () {
          var f = tr.getAttribute("data-mfx");
          S.fmx[f] = !S.fmx[f]; paint();
        };
      });
      Array.prototype.forEach.call(root.querySelectorAll("th[data-mfs]"), function (th) {
        th.onclick = function () {
          var kk = th.getAttribute("data-mfs");
          if (S.sort.k === kk) S.sort.d = -S.sort.d; else S.sort = { k: kk, d: -1 };
          paint();
        };
      });
      var q = root.querySelector("#mfQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = root.querySelector("#mfQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      var db2 = root.querySelector("#mfDtBtn");
      if (db2) db2.onclick = function (e) { e.stopPropagation(); S.dtOpen = !S.dtOpen; S.fmOpen = false; paint(); };
      var dpop = root.querySelector(".mf-dtpop");
      if (dpop) dpop.onclick = function (e) { e.stopPropagation(); };
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfdt]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          S.dateFrom = b.getAttribute("data-f") || null;
          S.dateTo = b.getAttribute("data-t") || null;
          S.dateLabel = b.getAttribute("data-mfdt");
          S.dtOpen = false; paint();
        };
      });
      var dap = root.querySelector("#mfDtApply");
      if (dap) dap.onclick = function (e) {
        e.stopPropagation();
        var f = root.querySelector("#mfDtFrom").value || null;
        var t = root.querySelector("#mfDtTo").value || null;
        S.dateFrom = f; S.dateTo = t;
        S.dateLabel = (f || t) ? ((f ? fmtD(f) : "…") + " – " + (t ? fmtD(t) : "…")) : "All time";
        S.dtOpen = false; paint();
      };
      var rf = root.querySelector("#mfRefresh");
      if (rf) rf.onclick = async function () { S.busy = true; paint(); await loadLive(true); S.busy = false; setLiveBadge(); paint(); };
      var fb = root.querySelector("#mfFmBtn");
      if (fb) fb.onclick = function (e) { e.stopPropagation(); S.fmOpen = !S.fmOpen; S.dtOpen = false; paint(); };
      var pop = root.querySelector(".mf-fmpop");
      if (pop) pop.onclick = function (e) { e.stopPropagation(); };
      Array.prototype.forEach.call(root.querySelectorAll("[data-mff]"), function (cb) {
        cb.onchange = function () {
          var f = cb.getAttribute("data-mff");
          var i = S.formen.indexOf(f);
          if (cb.checked && i < 0) S.formen.push(f);
          if (!cb.checked && i >= 0) S.formen.splice(i, 1);
          paint(); S.fmOpen = true;
        };
      });
      var fc = root.querySelector("#mfFmClr"); if (fc) fc.onclick = function () { S.formen = []; S.fmOpen = false; paint(); };
      if ((S.fmOpen || S.dtOpen) && !wire._docClose) {
        wire._docClose = true;
        document.addEventListener("click", function closeFm() {
          if (S.fmOpen || S.dtOpen) { S.fmOpen = false; S.dtOpen = false; paint(); }
          document.removeEventListener("click", closeFm); wire._docClose = false;
        });
      }
      // contract links open the FILE, not the popup — stop the row click underneath
      Array.prototype.forEach.call(root.querySelectorAll("a.mf-doc"), function (a) {
        a.onclick = function (e) { e.stopPropagation(); };
      });
      // bulk-select checkboxes: tick without opening the popup, repaint the bulk button
      Array.prototype.forEach.call(root.querySelectorAll("input.mf-ck"), function (ck) {
        ck.onclick = function (e) { e.stopPropagation(); };
        ck.onchange = function () {
          var ev2 = ck.getAttribute("data-mfsel");
          if (ck.checked) S.sel[ev2] = true; else delete S.sel[ev2];
          paint();
        };
      });
      var bulk = root.querySelector("#mfBulk");
      if (bulk) bulk.onclick = function () { openBulkModal(); };
      // every action opens THE popup
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfc]"), function (b) {
        b.onclick = function (e) { e.stopPropagation(); openModal(b.getAttribute("data-mfc")); };
      });
      Array.prototype.forEach.call(root.querySelectorAll("tr.mf-row"), function (tr) {
        tr.onclick = function () { openModal(tr.getAttribute("data-ev")); };
      });
    }

    function setLiveBadge() {
      var el = document.getElementById("mfLive"); if (!el) return;
      if (S.liveOk) { el.className = "mf-live"; el.textContent = "● live"; el.title = "Figures are current to about a minute — digital contracts and portal entries included."; }
      else { el.className = "mf-live off"; el.textContent = "◷ snapshot"; el.title = "Live update unreachable (" + (S.liveErr || "?") + ") — showing the last pipeline build."; }
    }

    S.busy = true; paint();
    loadLive(false).then(function () { S.busy = false; setLiveBadge(); paint(); });
  },
});
