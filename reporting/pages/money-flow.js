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
        .mf-refwrap{display:flex;align-items:center;gap:10px}
        .mf-last{font-size:11.5px;color:var(--faint);white-space:nowrap}
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
        .mf-fmpop{position:absolute;top:calc(100% + 6px);left:0;z-index:40;background:var(--panel);border:1px solid var(--line-2);border-radius:12px;box-shadow:0 10px 30px rgba(14,22,33,.14);padding:8px;min-width:340px;max-height:380px;overflow:auto}
        .mf-fmhd{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);padding:4px 8px 8px;border-bottom:1px solid var(--line);margin-bottom:4px}
        .mf-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}
        .mf-pager b{color:var(--ink);font-variant-numeric:tabular-nums}
        .mf-pgnav{display:flex;align-items:center;gap:9px}
        .mf-pgnav span{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;min-width:92px;text-align:center}
        .mf-pgnav button{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:7px 14px;cursor:pointer}
        .mf-pgnav button:hover:not(:disabled){border-color:var(--brand)}
        .mf-pgnav button:disabled{opacity:.35;cursor:default}
        .mf-fmpop label{display:flex;gap:9px;align-items:center;font-size:13px;padding:7px 8px;border-radius:8px;cursor:pointer}
        .mf-fmpop label:hover{background:var(--panel-2)}
        .mf-fmname{flex:1;color:var(--ink);font-weight:600}
        .mf-fmct{font-size:11.5px;font-weight:800;color:var(--brand-d,var(--ink));background:var(--panel-2);border:1px solid var(--line-2);border-radius:999px;padding:1px 9px;min-width:26px;text-align:center;font-variant-numeric:tabular-nums}
        .mf-fmpop .clr{display:block;width:100%;margin-top:6px;font:inherit;font-size:11.5px;font-weight:700;color:${BLUE};background:transparent;border:1px solid var(--line-2);border-radius:8px;padding:6px;cursor:pointer}
        .mf-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden;position:relative}
        .mf-tbl{width:100%;border-collapse:collapse;font-size:14px}
        .mf-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none;z-index:2}
        .mf-tbl th.r,.mf-tbl td.r,.mf-htbl th.r,.mf-htbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .mf-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px}
        .mf-tbl tbody tr.mf-row{cursor:pointer}
        .mf-tbl tbody tr.mf-row:hover{background:var(--panel-2)}
        /* the 320px is only the pre-measurement fallback — RSC.fitScroller sets --pg-chrome
           from the chrome actually above the table, so a collapsed bar leaves no dead gap */
        .mf-wrap{overflow-y:auto;overflow-x:auto;max-height:calc(100vh - var(--pg-chrome, 320px))}
        /* the fixed layouts need their full width — below it the wrap scrolls rather
           than CLIPPING the right-hand headers (the real cause of "headers not fully
           visible", 2026-07-22) */
        .mf-tbl.fx{min-width:1150px}
        .mf-tbl.fx.det{min-width:1650px}
        /* every row the SAME height — a "No Contract" pill used to make its row shorter
           than the button rows (his catch 2026-07-22) */
        .mf-tbl.fx tbody tr{height:56px}
        .mf-fmmeta{font-size:12px;font-weight:600;color:var(--faint);margin-left:10px}
        .mf-tbl td.ck{padding:0 0 0 12px;overflow:visible;text-overflow:clip}
        .mf-tbl td.ck input{margin:0;width:15px;height:15px;cursor:pointer}
        .mf-tbl .mf-fmrow td{background:var(--panel-2);font-weight:800;font-size:14.5px}
        .mf-confirm{font:inherit;font-size:13.5px;font-weight:800;background:${POS};color:#fff;border:0;border-radius:9px;padding:8px 14px;cursor:pointer;white-space:nowrap}
        .mf-confirm:hover{filter:brightness(1.08)}
        .mf-pill{display:inline-block;font-size:12px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .mf-st-rec{background:rgba(28,122,74,.13);color:${POS}}
        .mf-st-con{background:rgba(47,111,208,.12);color:${BLUE}}
        .mf-st-mnr{background:rgba(176,42,55,.12);color:${NEG}}
        .mf-st-nib{background:rgba(245,165,36,.16);color:#a06a00}
        .mf-st-nnc{background:var(--panel-2);color:var(--faint);border:1px solid var(--line-2)}
        .mf-tbl.mfc th{padding:9px 10px}
        .mf-tbl.mfc td{padding:8px 10px;font-size:13.5px}
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
        .mf-tbl .mf-fmrow:hover td{background:var(--line)}
        .mf-fmrow td{font-weight:700}
        .mf-caret{color:var(--faint);font-size:11px;display:inline-block;width:14px}
        .mf-fmsub>td{padding:0 0 16px 24px;background:var(--panel-2)}
        .mf-fmsub .mf-tbl{background:var(--panel);border:1px solid var(--line-2);border-radius:10px}
        /* ---- Fines & Debt (N5) ---- */
        .mf-fnhead{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:16px 18px;border-bottom:1px solid var(--line)}
        .mf-fntot{display:flex;flex-direction:column;gap:2px;min-width:150px}
        .mf-fntot span{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
        .mf-fntot b{font-size:24px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .mf-fntot i{font-style:normal;font-size:11.5px;color:var(--muted)}
        .mf-fnbtn{font:inherit;font-size:13px;font-weight:700;padding:9px 15px;border-radius:10px;cursor:pointer;
                  border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink)}
        .mf-fnbtn.go{margin-left:auto;border-color:${BLUE};color:${BLUE};background:transparent}
        .mf-fnbtn.go:hover{background:${BLUE};color:#fff}
        .mf-fnowe{color:${NEG}}
        /* the Action on a foreman's own row: quiet until you look for it, because most rows
           on most days do not need one */
        .mf-charge{font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);
                   background:var(--panel);border:1px solid var(--line-2);border-radius:9px;
                   padding:7px 13px;cursor:pointer;white-space:nowrap}
        .mf-charge:hover{color:${NEG};border-color:${NEG}}
        .mf-tbl .mf-fmrow:hover .mf-charge{border-color:var(--faint)}
        .mf-tbl .mf-fmrow:hover .mf-charge:hover{border-color:${NEG}}
        .mf-debtchip{margin-left:10px;font-size:11.5px;font-weight:800;color:${NEG};cursor:pointer;
                     border:1px solid ${NEG};border-radius:999px;padding:2px 9px;white-space:nowrap}
        .mf-debtchip:hover{background:${NEG};color:#fff}
        .mf-fnrow.settled td{opacity:.62}
        .mf-fnwhy{white-space:normal;line-height:1.45}
        .mf-fnjob{font-size:11px;font-weight:700;color:var(--faint);border:1px solid var(--line-2);
                  border-radius:6px;padding:1px 6px;margin-left:6px;white-space:nowrap}
        .mf-fnpill{font-size:11px;font-weight:800;letter-spacing:.03em;padding:3px 9px;border-radius:999px;
                   border:1px solid var(--line-2);color:var(--muted);white-space:nowrap}
        .mf-fnpill.fine{color:${NEG};border-color:${NEG}}
        .mf-fnpill.repayment{color:${POS};border-color:${POS}}
        .mf-fnpill.opening{color:${BLUE};border-color:${BLUE}}
        .mf-fnedit{font:inherit;font-size:12px;font-weight:700;color:${BLUE};background:transparent;
                   border:1px solid var(--line-2);border-radius:8px;padding:4px 10px;cursor:pointer}
        .mf-fnedit:hover{border-color:${BLUE}}
        .mf-fnsettled{font-size:11.5px;color:var(--faint);border-bottom:1px dotted var(--line-2);cursor:help}
        .mf-fnhint{font-size:12px;color:var(--faint);line-height:1.55;margin:2px 0 4px}
        .mf-fnerr{display:flex;flex-direction:column;gap:8px;align-items:flex-start;padding:22px}
        .mf-fnerr b{font-size:15px}
        .mf-fnerr span{font-size:12.5px;color:var(--muted)}
        .mf-fld label i{font-style:normal;font-weight:600;color:var(--faint);text-transform:none;letter-spacing:0}
        .mf-neg{color:${NEG};font-weight:700} .mf-pos{color:${POS};font-weight:700}
        .mf-age{font-size:10.5px;color:var(--faint)}
        .mf-doc{font-size:13px;font-weight:800;color:${BLUE};text-decoration:none;white-space:nowrap}
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
      </div><div class="mf-refwrap"><span class="mf-last" id="mfLast"></span><button class="mf-cancel" id="mfRefresh" style="padding:8px 14px;font-size:12.5px">↻ Refresh</button></div></div>
      <div id="mfBody"><div class="mf-load"><div class="mf-spin" style="margin:0 auto 12px"></div>Loading jobs…</div></div>
      <div id="mfModalHost"></div>`;

    var S = window.__MF || (window.__MF = {
      view: "foreman",     // Balance by Foreman is the landing view (his pick 2026-07-21)
      q: "", formen: [], live: null, liveOk: false,
      sort: { k: "Job Date", d: -1 }, months: 0, fmOpen: false, busy: false, modalEv: null,
      dense: "details",    // 'details' = every column (default); 'overview' = the compact table
      fmx: {},             // Balance-by-Foreman view: which foremen are expanded
      fines: null,         // the fines/debt ledger from /api/_ffines (null until loaded)
      finesErr: "",        // why it could not be loaded, if it could not
      fnx: {},             // Fines view: which foremen are expanded
      fineEdit: null,      // the entry being corrected, or null for a new one
    });
    if (!S.dense) S.dense = "details";        // Details is the landing density (his pick)
    if (!S.fmx) S.fmx = {};
    if (S.hpage == null) S.hpage = 0;         // History pager (2,890 settled rows = too slow to paint at once)
    if (!S.sel) S.sel = {};   // bulk-confirm ticks (event ids)
    if (!S.dateLabel) { S.dateFrom = null; S.dateTo = null; S.dateLabel = "All time"; S.dtOpen = false; }
    if (!Array.isArray(S.formen)) S.formen = [];
    S.modalEv = null;
    // generation token: each page-open bumps it; a stale render's async callbacks compare
    // against it and skip painting once a newer open has taken over (see paint()).
    var myGen = (window.__MFGEN = (window.__MFGEN || 0) + 1);

    var base;
    try { base = await RS.load("fct_money_flow"); }
    catch (e) { var b0 = document.getElementById("mfBody"); if (b0) b0.innerHTML = '<div class="mf-load">Couldn’t load — ' + esc(e.message) + "</div>"; return; }

    // ---------- helpers ----------
    function num(v) { var x = parseFloat(v); return isNaN(x) ? null : x; }
    function money(v) {
      if (v == null) return "—";
      var n = Math.round(v);
      return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US");
    }
    function money2(v) {
      if (v == null) return "—";
      // toLocaleString drops a trailing zero, so $125.50 printed as "$125.5" -- which reads
      // as a typo on a number somebody is about to dispute. Pad the cents when there ARE
      // cents; whole amounts stay whole, the way every other figure on this page shows them.
      var a = Math.abs(Math.round(v * 100) / 100);
      var frac = Math.round(a * 100) % 100 !== 0;
      return (v < 0 ? "-$" : "$") + a.toLocaleString("en-US",
        frac ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : undefined);
    }
    function fmtD(v) {
      if (!v) return "—";
      var d = new Date(String(v).slice(0, 10) + "T12:00:00");
      return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }
    function fmtTs(v) { return v ? String(v).slice(0, 16).replace("T", " ") : "—"; }
    // Google's event deep link: base64url(event_id + " " + calendar_id)
    function calUrl(r) {
      if (!r || !r.ev || !r.calendarId) return null;
      try {
        return "https://calendar.google.com/calendar/u/0/r/event?eid="
          + btoa(r.ev + " " + r.calendarId).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      } catch (e) { return null; }
    }
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
          forman: b["Forman"] || MF_NO_FOREMAN, formanEmail: b["Forman Email"],
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
      // this event has NO closing row of its own — it points at another leg's closing and
      // collected nothing. A real gap in the closing sheet (Tornike verified 2026-07-29),
      // so it is always shown and never confirmable.
      if (r.baseStatus === "Missing Closing" && r.expected == null) return "Missing Closing";
      if (r.expected == null) return "Contract Not Received";
      if (r.flow == null && Math.abs(r.balance == null ? 0 : r.balance) > MF_TOL) return "Money Not Received";
      if (Math.abs(r.balance == null ? 0 : r.balance) <= MF_TOL) return "Money Received";
      return "Not in Balance";
    }
    // view split (his spec 2026-07-21): Balance by Foreman = waiting for cash
    // (incl. no-contract); Not in Balance Jobs = its own foreman-grouped tab; History =
    // everything confirmed. The old flat "Not Confirmed" list is gone.
    // "Missing Closing" is deliberately NOT here: the second leg of a closing has nothing
    // to collect, so it never belongs in the cash worklist (Tornike 2026-07-29). The real
    // problems are listed in Data Quality > Issues in Money Flow.
    // A job the translator could not resolve to a person: say that, never a bare dash —
    // "—" reads as "no data here" when the truth is "nobody is on the hook for this cash".
    var MF_NO_FOREMAN = "Foreman Not Identified";
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
        S.live = await r.json(); S.liveOk = true; S.liveAt = Date.now(); indexEntries();
        _ov = null;   // data changed — recompute the overlay on the next paint
      } catch (e) { S.liveOk = false; S.liveErr = String(e && e.message || e); }
    }

    /* THE FINES LEDGER. Kept separate from loadLive() on purpose: the money-flow overlay
     * is a 6-hour-cached recomputation of every job, and a fine has nothing to do with any
     * of that. Failing to load it must leave the rest of the page working, so the error is
     * remembered and shown in its own view rather than thrown. */
    async function loadFines() {
      try {
        var r = await fetch(ZTZ.API + "/api/_ffines",
          { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
        var j = await r.json();
        if (!r.ok) throw new Error(j && j.error || ("HTTP " + r.status));
        S.fines = j; S.finesErr = "";
      } catch (e) { S.finesErr = String(e && e.message || e); }
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
      // RACE GUARD (his catch 2026-07-22): when you switch pages fast, an in-flight loadLive()
      // resolves AFTER this page's #mfBody has been torn down — writing innerHTML on the (now
      // null) element threw "Cannot set properties of null". Bail if the container is gone, and
      // ignore a paint from a render that a newer page-open has superseded.
      var mfBody = document.getElementById("mfBody");
      if (!mfBody || myGen !== window.__MFGEN) return;
      if (S.view === "todo") S.view = "foreman";      // migrate pre-rework stored state
      if (S.view === "done") S.view = "history";
      var rows = overlaid();
      var q = S.q.trim().toLowerCase();
      var main = rows.filter(function (r) { return MAINSET[r.status]; });
      var nib = rows.filter(function (r) { return r.status === "Not in Balance"; });
      var done = rows.filter(function (r) { return r.status === "Money Received"; });
      // SEARCH EVERYTHING (his ask 2026-07-22): customer, request #, job code, foreman —
      // and plain numbers match the amounts too ("2132" finds the $2,132 job)
      var qNum = q.replace(/[$,\s]/g, "");
      var matches = function (r) {
        if (!q) return true;
        if (String(r.customer || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobNo || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobCode || "").toLowerCase().indexOf(q) >= 0
          || String(r.forman || "").toLowerCase().indexOf(q) >= 0) return true;
        if (qNum && /^\d+$/.test(qNum)) {
          if (r.balance != null && String(Math.round(Math.abs(r.balance))).indexOf(qNum) >= 0) return true;
          if (r.expected != null && String(Math.round(Math.abs(r.expected))).indexOf(qNum) >= 0) return true;
          if (r.flow != null && String(Math.round(Math.abs(r.flow))).indexOf(qNum) >= 0) return true;
        }
        return false;
      };
      var cur = done.slice();                          // History = the flat table
      if (S.formen.length) cur = cur.filter(function (r) { return S.formen.indexOf(r.forman) >= 0; });
      if (S.dateFrom) cur = cur.filter(function (r) { return r.date >= S.dateFrom; });
      if (S.dateTo) cur = cur.filter(function (r) { return r.date <= S.dateTo; });
      if (q) cur = cur.filter(matches);
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

      // Foreman filter is VIEW-SCOPED (his ask): the working views (Balance / Not in Balance)
      // list only foremen with something to close; departed / settled-only foremen — who have
      // nothing open and live only in the History — appear in the filter ONLY on the History view.
      // count each foreman's jobs in the current view (working = open jobs still to close;
      // History = settled) so the filter shows the workload at a glance.
      var allF = {};
      // EXACTLY the current view's jobs — "Not in Balance" must list only foremen who have
      // NIB jobs (using main+nib here leaked Balance-only foremen into the NIB filter).
      var fSrc = S.view === "history" ? done : S.view === "nib" ? nib
        : S.view === "advded" ? rows.filter(function (r) {
            return Math.abs(r.adv || 0) > 0.005 || Math.abs(r.ded || 0) > 0.005; })
        : main;
      fSrc.forEach(function (r) { if (r.forman && r.forman !== MF_NO_FOREMAN) allF[r.forman] = (allF[r.forman] || 0) + 1; });
      var fmKeys = Object.keys(allF).sort(function (a, b) { return allF[b] - allF[a] || a.localeCompare(b); });
      var fmLabel = S.formen.length ? "Foremen (" + S.formen.length + ")" : "All foremen";
      var fmHdN = fSrc.filter(function (r) { return r.forman && r.forman !== MF_NO_FOREMAN; }).length;
      var fmNoun = S.view === "history" ? " settled jobs" : S.view === "nib" ? " jobs off balance"
        : S.view === "advded" ? " jobs with money moved" : " jobs to close";
      var fmPop = S.fmOpen ? '<div class="mf-fmpop">'
          + '<div class="mf-fmhd">' + fmKeys.length + ' foremen · ' + fmHdN + fmNoun + '</div>'
          + fmKeys.map(function (f) {
              return '<label><input type="checkbox" data-mff="' + esc(f) + '"' + (S.formen.indexOf(f) >= 0 ? " checked" : "")
                + '><span class="mf-fmname">' + esc(f) + '</span><span class="mf-fmct">' + allF[f] + '</span></label>';
            }).join("")
          + '<button class="clr" id="mfFmClr">Show all foremen</button></div>' : "";

      // foreman grouping — used by BOTH grouped tabs (Balance by Foreman = waiting for
      // cash incl. no-contract; Not in Balance Jobs = its own identical screen); jobs
      // with no contract amount are LISTED but add $0 to the total (his call 2026-07-21)
      var groupsFor = function (jobsIn) {
        var jobs = jobsIn.slice();
        // no date filter on the working views (his call) — Balance / Not-in-Balance are just
        // the open worklist; a date range only makes sense on History.
        if (q) jobs = jobs.filter(matches);   // job-level search; foreman name matches keep his whole group
        var groups = {};
        jobs.forEach(function (r) {
          var f = r.forman || MF_NO_FOREMAN;
          var g = (groups[f] = groups[f] || { jobs: [], total: 0, noCon: 0, tNet: 0, tAdv: 0, tDed: 0, tFlow: 0 });
          g.jobs.push(r);
          if (r.balance != null) g.total += r.balance; else g.noCon++;
          g.tNet += (r.expected || 0); g.tAdv += (r.adv || 0);
          g.tDed += (r.ded || 0); g.tFlow += (r.flow || 0);
        });
        var gnames = Object.keys(groups);
        if (S.formen.length) gnames = gnames.filter(function (f) { return S.formen.indexOf(f) >= 0; });
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

      // ADVANCES & DEDUCTIONS — every job where money moved between us and the foreman,
      // whatever the job's balance state. A job settled months ago still carries the advance
      // that was paid on it, so this view deliberately spans ALL statuses (main + nib + done)
      // rather than the open worklist the other tabs show.
      var advDed = rows.filter(function (r) {
        return Math.abs(r.adv || 0) > 0.005 || Math.abs(r.ded || 0) > 0.005;
      });

      // the ledger, one row per foreman. Computed by the BRIDGE, not here: the statement,
      // this page and the closing email all have to answer "what does he owe" with the same
      // number, and three implementations is three answers.
      var fineBal = (S.fines && S.fines.balances || []).filter(function (b) {
        return b.entries > 0;
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
        + '<div class="mf-bar" id="mfVBar"><div class="mf-seg">' + segBtn("foreman", "Balance by Foreman", main.length)
        + segBtn("nib", "Not in Balance Jobs", nib.length)
        + segBtn("history", "History", done.length)
        + segBtn("advded", "Advances & Deductions", advDed.length)
        + segBtn("fines", "Fines & Debt", fineBal.length) + "</div></div>"
        // id="mfFBar" is load-bearing on main: the collapsible-filters bar finds this
        // element to hide it. The branch added the Advances & Deductions segment. Both sides
        // are real, and they are independent -- keeping only one would either lose the new
        // view or silently break Hide filters on this page.
        + '<div class="mf-bar" id="mfFBar">'
        + '<div class="mf-seg mf-dseg">' + dBtn("details", "Details") + dBtn("overview", "Compact") + "</div>"
        + '<div class="mf-fmwrap"><button class="mf-fmbtn' + (S.formen.length ? " on" : "") + '" id="mfFmBtn">' + esc(fmLabel) + ' ▾</button>' + fmPop + "</div>"
        + (S.view === "history" ? '<div class="mf-dtwrap"><button class="mf-fmbtn' + (S.dateFrom || S.dateTo ? " on" : "") + '" id="mfDtBtn">📅 ' + esc(S.dateLabel) + ' ▾</button>' + dtPop + "</div>" : "")
        + '<input class="mf-q" id="mfQ" placeholder="Search customer / request # / job code / foreman / amount" value="' + esc(S.q) + '">'
        + (selJobs.length ? '<button class="mf-confirm" id="mfBulk" style="padding:9px 16px">Confirm ' + selJobs.length + " selected — " + money(selTotal) + "</button>" : "")
        + "</div></div>";

      var arrow = function (kk) { return S.sort.k === kk ? (S.sort.d < 0 ? " ↓" : " ↑") : ""; };
      var statusPill = function (r) {
        if (r.status === "Money Received") return '<span class="mf-pill mf-st-rec">Received</span>';
        if (r.status === "Contract Not Received") return '<span class="mf-pill mf-st-con">No Contract</span>';
        if (r.status === "Not in Balance") return '<span class="mf-pill mf-st-nib">Not in Balance</span>';
        if (r.status === "Missing Closing") return '<span class="mf-pill mf-st-nnc">Missing Closing</span>';
        return '<span class="mf-pill mf-st-mnr">Not Received</span>';
      };
      var actionCell = function (r) {
        if (r.status === "Money Received") return '<span class="mf-pill mf-st-rec">✓ Confirmed</span>';
        if (r.status === "Missing Closing")
          return '<span class="mf-pill mf-st-nnc" title="This event has no closing-sheet entry of its own — it points at another leg’s closing. File the closing for this job, or remove the extra calendar event.">File the closing</span>';
        if (r.status === "Contract Not Received")
          return '<span class="mf-pill mf-st-con" title="No contract amount yet — click the row and enter the cash manually">No Contract</span>';
        return '<button class="mf-confirm" data-mfc="' + esc(r.ev) + '">Confirm ' + money(settle(r).type === "Cash Taken Away from Base" ? -settle(r).amount : settle(r).amount) + "</button>";
      };
      var docCell = function (r) {
        return r.contractUrl
          ? '<a class="mf-doc" href="' + esc(r.contractUrl) + '" target="_blank" rel="noopener" title="Open the contract file">Open ↗</a>'
          : '<span style="color:var(--faint)">—</span>';
      };
      // Google Calendar deep link — same shape as the popup's (his ask 2026-07-22: the
      // link must be reachable straight from the table, like the contract one)
      var calCell = function (r) {
        var u = calUrl(r);
        return u ? '<a class="mf-doc" href="' + esc(u) + '" target="_blank" rel="noopener" title="Open the calendar event">Open ↗</a>'
                 : '<span style="color:var(--faint)">—</span>';
      };
      var balCls = function (r) {
        return (r.balance || 0) > MF_TOL ? "mf-neg" : (r.balance || 0) < -MF_TOL ? "mf-pos" : "";
      };

      var veil = S.busy ? '<div class="mf-veil"><div class="mf-spin"></div>Updating…</div>' : "";
      var content;

      // one checkbox per settleable job — ticked jobs confirm together (his ask)
      var ckCell = function (r) {
        if (!settle(r) || r.status === "Money Received") return '<td class="ck"></td>';
        return '<td class="ck"><input type="checkbox" class="mf-ck" data-mfsel="' + esc(r.ev) + '"'
          + (S.sel[r.ev] ? " checked" : "") + "></td>";
      };
      var det = S.dense === "details";

      // ---- COLUMN PLANS -------------------------------------------------------------
      // PERCENTAGES: the table always fills the whole window (his ask 2026-07-22) while
      // the widths stay content-independent, so a long customer name can never reshape
      // the grid — it ellipses instead (full name on hover).
      // `before` / `after` = how many columns sit either side of Net Cash Balance, so a
      // foreman's TOTAL can be placed in exactly that column.
      var PLAN = det ? {
        cols: '<col style="width:2.5%"><col style="width:6.5%"><col style="width:5.5%"><col style="width:5%"><col style="width:8%">'
            + '<col style="width:6%"><col style="width:7.5%"><col style="width:8%"><col style="width:7%">'
            + '<col style="width:8%"><col style="width:8%"><col style="width:5%"><col style="width:5%">'
            + '<col style="width:7.5%"><col style="width:10.5%">',
        head: "<th></th><th>Job date</th><th>Job Code</th><th>Job #</th><th>Customer</th>"
            + '<th class="r">Net Cash</th><th class="r" title="Money already handed to him — it comes OFF what he still owes">Advance Payment ↓</th>'
            + '<th class="r" title="Charged to him on this job — it goes ON TOP of what he owes">Forman Deduction ↑</th><th class="r">Net Cash Flow</th>'
            + '<th class="r">Net Cash Balance</th><th>Submission Time</th>'
            + "<th>Contract</th><th>Calendar</th><th>Status</th><th>Action</th>",
        before: 9, after: 5, n: 15,
      } : {
        cols: '<col style="width:3%"><col style="width:11%"><col style="width:10%"><col style="width:18%"><col style="width:14%">'
            + '<col style="width:9%"><col style="width:9%"><col style="width:11%"><col style="width:15%">',
        head: '<th></th><th>Job date</th><th>Job Code</th><th>Customer</th><th class="r">Net Cash Balance</th>'
            + "<th>Contract</th><th>Calendar</th><th>Status</th><th>Action</th>",
        before: 4, after: 4, n: 9,
      };

      // Submission Time = when the DIGITAL CONTRACT was submitted (the source of the net
      // cash figure), NOT when the money-flow entry was recorded — his call 2026-07-22.
      var jobRow = function (r) {
        var cust = '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>";
        if (det) {
          return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
            + ckCell(r)
            + "<td>" + fmtD(r.date) + "</td>"
            + "<td>" + esc(r.jobCode || "—") + "</td>"
            + "<td>" + esc(r.jobNo || "—") + "</td>"
            + cust
            + '<td class="r">' + money(r.expected) + "</td>"
            + '<td class="r">' + (r.adv ? money(r.adv) : "—") + "</td>"
            + '<td class="r">' + (r.ded ? money(r.ded) : "—") + "</td>"
            + '<td class="r">' + money(r.flow) + "</td>"
            + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
            + "<td>" + fmtTs(r.dcTs) + "</td>"
            + "<td>" + docCell(r) + "</td>"
            + "<td>" + calCell(r) + "</td>"
            + "<td>" + statusPill(r) + "</td>"
            + "<td>" + actionCell(r) + "</td></tr>";
        }
        return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
          + ckCell(r)
          + "<td>" + fmtD(r.date) + "</td>"
          + "<td>" + esc(r.jobCode || "—") + "</td>"
          + cust
          + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
          + "<td>" + docCell(r) + "</td>"
          + "<td>" + calCell(r) + "</td>"
          + "<td>" + statusPill(r) + "</td>"
          + "<td>" + actionCell(r) + "</td></tr>";
      };

      var renderGrouped = function (jobsSet, label) {
        var gg = groupsFor(jobsSet), groups = gg.groups, gnames = gg.names;
        var body = gnames.map(function (f) {
          var g = groups[f], open = !!S.fmx[f] || !!q;
          // ONE table for foremen AND their jobs: the foreman row spans the columns before
          // the balance, so his total lands exactly under the job rows' Net Cash Balance
          // (his ask 2026-07-22); the counts ride along the name as quiet grey text.
          var owes = debtOf(f);
          var nameCell = '<td colspan="' + (det ? 5 : PLAN.before) + '"><span class="mf-caret">' + (open ? "▾" : "▸") + "</span>"
            + esc(f) + '<span class="mf-fmmeta">' + g.jobs.length + " job" + (g.jobs.length === 1 ? "" : "s")
            + (g.noCon ? " · " + g.noCon + " no contract" : "") + "</span>"
            + (owes > 0.005
                ? '<span class="mf-debtchip" data-mfdebt="' + esc(f)
                  + '" title="Owed on top of the cash — fines and opening balances. '
                  + 'Click to open his ledger.">owes ' + money2(owes) + "</span>"
                : "")
            + "</td>";
          var balCls2 = Math.abs(g.total) > MF_TOL ? "mf-neg" : "";
          // DETAIL: a subtotal under every numeric column (his ask 2026-07-22); COMPACT: just the balance
          var head = det
            ? '<tr class="mf-fmrow" data-mfx="' + esc(f) + '">' + nameCell
              + '<td class="r">' + money(g.tNet) + "</td><td class=\"r\">" + money(g.tAdv) + "</td>"
              + '<td class="r">' + money(g.tDed) + "</td><td class=\"r\">" + money(g.tFlow) + "</td>"
              + '<td class="r ' + balCls2 + '">' + money(g.total) + '</td><td colspan="5"></td></tr>'
            : '<tr class="mf-fmrow" data-mfx="' + esc(f) + '">' + nameCell
              + '<td class="r ' + balCls2 + '">' + money(g.total) + '</td><td colspan="' + PLAN.after + '"></td></tr>';
          if (!open) return head;
          var jobs = g.jobs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
          return head + jobs.map(jobRow).join("");
        }).join("");
        return '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl fx' + (det ? " det" : "") + '">'
          + "<colgroup>" + PLAN.cols + "</colgroup><thead><tr>" + PLAN.head + "</tr></thead><tbody>"
          + (body || '<tr><td colspan="' + PLAN.n + '" style="color:var(--faint);padding:18px">' + label + " 🎉</td></tr>")
          + "</tbody></table></div></div>";
      };

      if (S.view === "advded") {
        /* Advances & Deductions — the same shape as Balance by Foreman (foreman row, click to
         * open his jobs) but answering a different question: not "what is owed" but "what has
         * moved". Advance arrives SIGNED from the server (brought + / taken −), so his total
         * is a net; deductions are shown as the charge they are. */
        var ad = advDed.slice();
        if (q) ad = ad.filter(matches);
        var adG = {};
        ad.forEach(function (r) {
          var f = r.forman || MF_NO_FOREMAN;
          var g = (adG[f] = adG[f] || { jobs: [], adv: 0, ded: 0, advN: 0, dedN: 0 });
          g.jobs.push(r);
          if (Math.abs(r.adv || 0) > 0.005) { g.adv += r.adv; g.advN++; }
          if (Math.abs(r.ded || 0) > 0.005) { g.ded += r.ded; g.dedN++; }
        });
        var adNames = Object.keys(adG);
        if (S.formen.length) adNames = adNames.filter(function (f) { return S.formen.indexOf(f) >= 0; });
        adNames.sort(function (a, b) {
          return (Math.abs(adG[b].adv) + Math.abs(adG[b].ded)) - (Math.abs(adG[a].adv) + Math.abs(adG[a].ded));
        });
        var tAdvAll = 0, tDedAll = 0;
        adNames.forEach(function (f) { tAdvAll += adG[f].adv; tDedAll += adG[f].ded; });

        var adBody = adNames.map(function (f) {
          var g = adG[f], open = !!S.fmx[f] || !!q;
          var head = '<tr class="mf-fmrow" data-mfx="' + esc(f) + '">'
            + '<td colspan="3"><span class="mf-caret">' + (open ? "\u25be" : "\u25b8") + "</span>"
            + esc(f) + '<span class="mf-fmmeta">' + g.jobs.length + " job" + (g.jobs.length === 1 ? "" : "s")
            + (g.advN ? " \u00b7 " + g.advN + " advance" + (g.advN === 1 ? "" : "s") : "")
            + (g.dedN ? " \u00b7 " + g.dedN + " deduction" + (g.dedN === 1 ? "" : "s") : "")
            + "</span></td>"
            + '<td class="r">' + (g.adv ? money(g.adv) : "") + "</td>"
            + '<td class="r">' + (g.ded ? money(g.ded) : "") + "</td>"
            + '<td class="r"><b>' + money(g.adv + g.ded) + "</b></td></tr>";
          if (!open) return head;
          var jobs = g.jobs.slice().sort(function (a, b) { return a.date < b.date ? 1 : -1; });
          return head + jobs.map(function (r) {
            return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
              + "<td>" + fmtD(r.date) + "</td>"
              + "<td>" + esc(r.jobCode || "\u2014") + "</td>"
              + '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "\u2014") + "</td>"
              + '<td class="r">' + (Math.abs(r.adv || 0) > 0.005 ? money(r.adv) : '<span style="color:var(--faint)">\u2014</span>') + "</td>"
              + '<td class="r">' + (Math.abs(r.ded || 0) > 0.005 ? money(r.ded) : '<span style="color:var(--faint)">\u2014</span>') + "</td>"
              + '<td class="r">' + money((r.adv || 0) + (r.ded || 0)) + "</td></tr>";
          }).join("");
        }).join("");

        content = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl fx">'
          + '<colgroup><col style="width:11%"><col style="width:14%"><col style="width:29%">'
          + '<col style="width:15%"><col style="width:15%"><col style="width:16%"></colgroup>'
          + '<thead><tr><th>Job date</th><th>Job #</th><th>Customer</th>'
          + '<th class="r" title="Money already handed to him — it comes OFF what he still owes">Advance Payment ↓</th><th class="r" title="Charged to him on this job — it goes ON TOP of what he owes">Forman Deduction ↑</th>'
          + '<th class="r">Net moved</th></tr></thead><tbody>'
          + (adBody || '<tr><td colspan="6" style="color:var(--faint);padding:18px">'
              + "No advances or deductions recorded" + (q ? " for that search" : "") + ".</td></tr>")
          + (adNames.length ? '<tr class="mf-fmrow"><td colspan="3"><b>All foremen</b>'
              + '<span class="mf-fmmeta">' + ad.length + " job" + (ad.length === 1 ? "" : "s") + "</span></td>"
              + '<td class="r"><b>' + money(tAdvAll) + "</b></td>"
              + '<td class="r"><b>' + money(tDedAll) + "</b></td>"
              + '<td class="r"><b>' + money(tAdvAll + tDedAll) + "</b></td></tr>" : "")
          + "</tbody></table></div></div>";
      } else if (S.view === "fines") {
        content = finesView();
      } else if (S.view === "foreman") {
        content = renderGrouped(main, "No outstanding balances.");
      } else if (S.view === "nib") {
        content = renderGrouped(nib, "Nothing out of balance.");
      } else {
        // ---- History: the same grid plus Foreman, flat (everything here is settled, so
        // the last column IS the status) ----
        var HP = det ? {
          cols: '<col style="width:7%"><col style="width:5%"><col style="width:11%"><col style="width:10.5%">'
              + '<col style="width:6.5%"><col style="width:8%"><col style="width:8.5%"><col style="width:7.5%">'
              + '<col style="width:8.5%"><col style="width:9%"><col style="width:5.5%"><col style="width:5.5%">'
              + '<col style="width:7.5%">',
          head: '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Job #</th><th>Customer</th><th>Foreman</th>"
              + '<th class="r" data-mfs="Expected">Net Cash' + arrow("Expected") + "</th>"
              + '<th class="r" title="Money already handed to him — it comes OFF what he still owes">Advance Payment ↓</th><th class="r" title="Charged to him on this job — it goes ON TOP of what he owes">Forman Deduction ↑</th>'
              + '<th class="r">Net Cash Flow</th>'
              + '<th class="r" data-mfs="Balance">Net Cash Balance' + arrow("Balance") + "</th>"
              + "<th>Submission Time</th><th>Contract</th><th>Calendar</th><th>Status</th>",
          n: 13,
        } : {
          cols: '<col style="width:12%"><col style="width:20%"><col style="width:16%"><col style="width:13%">'
              + '<col style="width:12%"><col style="width:8%"><col style="width:8%"><col style="width:11%">',
          head: '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Customer</th><th>Foreman</th>"
              + '<th class="r" data-mfs="Balance">Net Cash Balance' + arrow("Balance") + "</th>"
              + "<th>Submission Time</th><th>Contract</th><th>Calendar</th><th>Status</th>",
          n: 8,
        };
        var hRow = function (r) {
          var cust = '<td title="' + esc(r.customer || "") + '">' + esc(r.customer || "—") + "</td>";
          if (det) {
            return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
              + "<td>" + fmtD(r.date) + "</td>"
              + "<td>" + esc(r.jobNo || "—") + "</td>"
              + cust
              + "<td>" + esc(r.forman) + "</td>"
              + '<td class="r">' + money(r.expected) + "</td>"
              + '<td class="r">' + (r.adv ? money(r.adv) : "—") + "</td>"
              + '<td class="r">' + (r.ded ? money(r.ded) : "—") + "</td>"
              + '<td class="r">' + money(r.flow) + "</td>"
              + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
              + "<td>" + fmtTs(r.dcTs) + "</td>"
              + "<td>" + docCell(r) + "</td>"
              + "<td>" + calCell(r) + "</td>"
              + "<td>" + actionCell(r) + "</td></tr>";
          }
          return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
            + "<td>" + fmtD(r.date) + "</td>"
            + cust
            + "<td>" + esc(r.forman) + "</td>"
            + '<td class="r ' + balCls(r) + '">' + money(r.balance) + "</td>"
            + "<td>" + fmtTs(r.dcTs) + "</td>"
            + "<td>" + docCell(r) + "</td>"
            + "<td>" + calCell(r) + "</td>"
            + "<td>" + actionCell(r) + "</td></tr>";
        };
        // PAGINATED (2026-07-25): painting all ~2,900 settled rows x 13 columns on every
        // repaint made History crawl. Render one page at a time; search/sort still span
        // the whole set, we just show a slice of the result.
        var HPP = 150;
        var hPages = Math.max(1, Math.ceil(cur.length / HPP));
        if (S.hpage >= hPages) S.hpage = hPages - 1;
        if (S.hpage < 0) S.hpage = 0;
        var hStart = S.hpage * HPP;
        var hSlice = cur.slice(hStart, hStart + HPP);
        var hPager = cur.length ? '<div class="mf-pager">'
            + '<div>Showing <b>' + (hStart + 1).toLocaleString() + "–" + Math.min(hStart + HPP, cur.length).toLocaleString()
            + "</b> of <b>" + cur.length.toLocaleString() + "</b> settled jobs</div>"
            + '<div class="mf-pgnav"><button id="mfHPrev"' + (S.hpage ? "" : " disabled") + ">‹ Prev</button>"
            + "<span>Page " + (S.hpage + 1) + " of " + hPages + "</span>"
            + '<button id="mfHNext"' + (S.hpage + 1 < hPages ? "" : " disabled") + ">Next ›</button></div></div>" : "";
        content = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl fx' + (det ? " det" : "") + '">'
          + "<colgroup>" + HP.cols + "</colgroup><thead><tr>" + HP.head + "</tr></thead><tbody>"
          + (hSlice.map(hRow).join("") || '<tr><td colspan="' + HP.n + '" style="color:var(--faint);padding:18px">Nothing confirmed yet.</td></tr>')
          + "</tbody></table></div>" + hPager + "</div>";
      }

      // repainting replaces the whole table — without restoring the scroll, expanding a
      // foreman far down the list snapped back to the top (his catch 2026-07-21). The
      // vertical scroller is the TABLE WRAP (.mf-wrap), not the window — restore both.
      var sx = window.scrollX, sy = window.scrollY;
      var wrap0 = document.querySelector("#mfBody .mf-wrap");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      mfBody.innerHTML = kp + bar + content;
      wire();
      // the chevron lives in the VIEW row, so collapsing gives the whole filter row back
      // instead of trading it for a toggle row of the same height
      RSC.collapsible(document.getElementById("mfFBar"), "rsBarCollapsed:money-flow", {
        host: document.getElementById("mfVBar"),
        count: function () {
          var labels = [];
          if (S.formen.length) labels.push("Foremen (" + S.formen.length + ")");
          if (S.q) labels.push("Search");
          if (S.view === "history" && (S.dateFrom || S.dateTo)) labels.push(S.dateLabel);
          return { n: labels.length, labels: labels };
        },
      });
      var wrap1 = document.querySelector("#mfBody .mf-wrap");
      if (wrap1) { wrap1.scrollTop = wt; wrap1.scrollLeft = wl; }
      RSC.fitScroller(wrap1);
      // same idea for the foremen POPOVER list: it has its own scroller and was rebuilt
      // at the top on every checkbox tick
      var fmp = document.querySelector(".mf-fmpop");
      if (fmp && S.fmScroll) { fmp.scrollTop = S.fmScroll; }
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


    /* FINES & DEBT (N5). Tornike: "we fined a foreman -- Money Flow should let us pick him
     * and take the money off, and his additional DEBT should be visible."
     *
     * Deliberately NOT a job view. A fine belongs to the man: money_flow_entries drops
     * anything it cannot tie to a calendar event, and closings settle per job, so a fine for
     * something that happened at the base would be stored and never seen again. The ledger
     * is foreman-keyed and the job link is optional -- see src/foreman_fines.py.
     *
     * The ledger starts at ZERO (his rule): anyone who genuinely owes gets a typed opening
     * balance. Nothing is inferred from history, because a number nobody entered is a number
     * nobody will defend when the foreman argues about it. */
    function finesView() {
      if (S.finesErr) {
        return '<div class="mf-card"><div class="mf-fnerr"><b>The fines ledger did not load.</b>'
          + "<span>" + esc(S.finesErr) + "</span>"
          + '<button class="mf-fnbtn go" id="mfFnRetry">Try again</button></div></div>';
      }
      if (!S.fines) {
        return '<div class="mf-card"><div class="mf-load"><div class="mf-spin" '
          + 'style="margin:0 auto 12px"></div>Loading the fines ledger…</div></div>';
      }
      var bal = (S.fines.balances || []).filter(function (b) { return b.entries > 0; });
      if (S.formen.length) {
        bal = bal.filter(function (b) { return S.formen.indexOf(b.foreman) >= 0; });
      }
      var q = S.q.trim().toLowerCase();
      var entriesOf = {};
      (S.fines.entries || []).forEach(function (e) {
        (entriesOf[String(e.Foreman || "").trim()] = entriesOf[String(e.Foreman || "").trim()] || []).push(e);
      });
      if (q) {
        bal = bal.filter(function (b) {
          if (b.foreman.toLowerCase().indexOf(q) >= 0) return true;
          return (entriesOf[b.foreman] || []).some(function (e) {
            return String(e.Reason || "").toLowerCase().indexOf(q) >= 0
              || String(e["Job Code"] || "").toLowerCase().indexOf(q) >= 0;
          });
        });
      }

      var owed = 0, unsettled = 0;
      bal.forEach(function (b) { if (b.owes > 0) owed += b.owes; unsettled += b.unsettled; });

      var head = '<div class="mf-fnhead">'
        + '<div class="mf-fntot"><span>Outstanding</span><b>' + money2(owed) + "</b>"
        + "<i>" + (function () {
            var n2 = bal.filter(function (b) { return b.owes > 0.005; }).length;
            return n2 + (n2 === 1 ? " foreman owing" : " foremen owing");
          }()) + "</i></div>"
        + '<div class="mf-fntot"><span>Rides into the next statement</span><b>' + money2(unsettled) + "</b>"
        + "<i>charged, not yet settled</i></div>"
        + '<button class="mf-fnbtn go" id="mfFnAdd">+ Record a fine, repayment or opening balance</button>'
        + "</div>";

      var TYPE_LABEL = { fine: "Fine", repayment: "Repayment", opening: "Opening balance" };
      var body = bal.map(function (b) {
        var open = !!S.fnx[b.foreman] || !!q;
        var ent = (entriesOf[b.foreman] || []);
        var head2 = '<tr class="mf-fmrow" data-mffn="' + esc(b.foreman) + '">'
          + '<td colspan="3"><span class="mf-caret">' + (open ? "\u25be" : "\u25b8") + "</span>"
          + esc(b.foreman) + '<span class="mf-fmmeta">' + b.entries
          + " entr" + (b.entries === 1 ? "y" : "ies")
          + (b.unsettled > 0.005 ? " \u00b7 " + money2(b.unsettled) + " not yet on a statement" : "")
          + "</span></td>"
          + '<td class="r">' + (b.fined ? money2(b.fined) : "\u2014") + "</td>"
          + '<td class="r">' + (b.opening ? money2(b.opening) : "\u2014") + "</td>"
          + '<td class="r">' + (b.repaid ? money2(b.repaid) : "\u2014") + "</td>"
          + '<td class="r"><b class="' + (b.owes > 0.005 ? "mf-fnowe" : "") + '">'
          + money2(b.owes) + "</b></td></tr>";
        if (!open) return head2;
        return head2 + ent.filter(function (e) { return e["Is Current"]; })
          .map(function (e) {
            var settled = e["Settled Report Id"] != null;
            return '<tr class="mf-row mf-fnrow' + (settled ? " settled" : "") + '">'
              + "<td>" + esc(String(e["Fine Date"] || "").slice(0, 10)) + "</td>"
              + '<td><span class="mf-fnpill ' + esc(e["Entry Type"]) + '">'
              + esc(TYPE_LABEL[e["Entry Type"]] || e["Entry Type"]) + "</span></td>"
              + '<td class="mf-fnwhy" title="' + esc(e.Reason || "") + '">' + esc(e.Reason || "\u2014")
              + (e["Job Code"] ? ' <span class="mf-fnjob">' + esc(e["Job Code"]) + "</span>" : "")
              + "</td>"
              + '<td class="r">' + (e["Entry Type"] === "fine" ? money2(e.Amount) : "") + "</td>"
              + '<td class="r">' + (e["Entry Type"] === "opening" ? money2(e.Amount) : "") + "</td>"
              + '<td class="r">' + (e["Entry Type"] === "repayment" ? money2(e.Amount) : "") + "</td>"
              + '<td class="r">'
              + (settled
                  ? '<span class="mf-fnsettled" title="already carried on a closing statement '
                    + '\u2014 record a repayment instead of rewriting it">on a statement</span>'
                  : '<button class="mf-fnedit" data-mffe="' + e.id + '">Correct</button>')
              + "</td></tr>";
          }).join("");
      }).join("");

      return '<div class="mf-card">' + head + '<div class="mf-wrap"><table class="mf-tbl fx">'
        + '<colgroup><col style="width:13%"><col style="width:12%"><col style="width:31%">'
        + '<col style="width:11%"><col style="width:11%"><col style="width:11%">'
        + '<col style="width:11%"></colgroup>'
        + '<thead><tr><th>Date</th><th>Type</th><th>What for</th>'
        + '<th class="r">Fined</th><th class="r">Opening</th><th class="r">Repaid</th>'
        + '<th class="r">Owes</th></tr></thead><tbody>'
        + (body || '<tr><td colspan="7" style="color:var(--faint);padding:18px">'
            + (q ? "Nothing matches that search."
                 : "Nobody has been fined and nobody carries an opening balance. "
                   + "The ledger starts at zero \u2014 record the first entry above.")
            + "</td></tr>")
        + "</tbody></table></div></div>";
    }

    /* The entry form. One dialog for all three movements, because they are one ledger:
     * choosing the type is choosing the direction, exactly like the money entries above. */
    function openFineModal(editId) {
      var e = editId
        ? (S.fines.entries || []).filter(function (x) { return String(x.id) === String(editId); })[0]
        : null;
      var names = mfForemen();
      var hostEl = document.getElementById("mfModalHost");
      var t = e ? e["Entry Type"] : "fine";
      hostEl.innerHTML = '<div class="mf-back" id="mfBack"><div class="mf-modal">'
        + '<button class="mf-mx" id="mfMx">\u2715</button>'
        + '<div class="mf-mhead"><b>'
        + (e ? "Correct this entry"
             : who ? esc(who) : "Record a fine, repayment or opening balance")
        + "</b><div>"
        + (e ? "A correction writes a new row and retires the old one \u2014 nothing is deleted."
             : (who
                 ? "Money that belongs to him and not to any one job."
                   + (owesNow > 0.005 ? " He owes " + money2(owesNow) + " today." : "")
                   + " The direction comes from the type."
                 : "The direction comes from the type. Amounts are always positive."))
        + "</div></div>"
        + '<div class="mf-mbody">'
        // CHOSEN FROM A ROW -> LOCKED, because the row IS the choice: nothing is typed
        // twice and nobody charges the wrong man by mistyping a name. Opened from the ledger
        // with nobody picked -> a name field with the crew behind it.
        + (who
            ? '<input type="hidden" id="mfFnWho" value="' + esc(who) + '">'
            : '<div class="mf-fld"><label>Foreman</label>'
              + '<input id="mfFnWho" list="mfFnList" placeholder="Start typing a name" autocomplete="off">'
              + '<datalist id="mfFnList">'
              + names.map(function (n) { return '<option value="' + esc(n) + '">'; }).join("")
              + "</datalist></div>")
        + '<div class="mf-fld"><label>What kind of movement</label><select id="mfFnType">'
        + [["fine", "Fine \u2014 we charged him (debt goes up)"],
           ["repayment", "Repayment \u2014 he paid it back (debt goes down)"],
           ["opening", "Opening balance \u2014 what he already owed (debt goes up)"]]
            .map(function (o) {
              return '<option value="' + o[0] + '"' + (o[0] === t ? " selected" : "") + ">"
                + o[1] + "</option>"; }).join("")
        + "</select></div>"
        + '<div class="mf-mrow">'
        + '<div class="mf-fld"><label>Amount ($)</label><input id="mfFnAmt" type="number" step="0.01" '
        + 'min="0" value="' + esc(e ? String(e.Amount) : "") + '" placeholder="0.00"></div>'
        + '<div class="mf-fld"><label>Date</label><input id="mfFnDate" type="date" value="'
        + esc(e ? String(e["Fine Date"] || "").slice(0, 10) : todayIso) + '"></div>'
        + "</div>"
        + '<div class="mf-fld"><label>What for</label>'
        + '<input id="mfFnWhy" class="note" maxlength="500" value="' + esc(e ? (e.Reason || "") : "")
        + '" placeholder="Damaged a customer\u2019s door \u2014 he agreed to cover it"></div>'
        + '<div class="mf-fld"><label>Job code <i>optional</i></label>'
        + '<input id="mfFnJob" value="' + esc(e ? (e["Job Code"] || "") : "") + '" placeholder="if it was about one job"></div>'
        + '<div class="mf-fnhint">Waiving a fine is a correction to <b>$0</b> with the reason \u2014 '
        + "the original stays readable in the history.</div>"
        + '<div class="mf-mfoot"><button class="mf-cancel" id="mfFnCancel">Cancel</button>'
        + '<button class="mf-save" id="mfFnSave">Save</button></div>'
        + '<div id="mfFnErr"></div>'
        + "</div></div></div>";

      function close() { S.fineEdit = null; hostEl.innerHTML = ""; }
      document.getElementById("mfMx").onclick = close;
      document.getElementById("mfFnCancel").onclick = close;
      document.getElementById("mfBack").onclick = function (ev2) {
        if (ev2.target && ev2.target.id === "mfBack") close();
      };
      // land the cursor where the typing actually starts: the name when it is unknown, the
      // amount when the row has already answered that
      var firstEl = document.getElementById(who ? "mfFnAmt" : "mfFnWho");
      if (firstEl && !e) firstEl.focus();

      document.getElementById("mfFnSave").onclick = async function () {
        var btn = this, err = document.getElementById("mfFnErr");
        var body = {
          foreman: (document.getElementById("mfFnWho").value || "").trim(),
          entry_type: document.getElementById("mfFnType").value,
          amount: num(document.getElementById("mfFnAmt").value),
          date: document.getElementById("mfFnDate").value || "",
          reason: (document.getElementById("mfFnWhy").value || "").trim(),
          job_code: (document.getElementById("mfFnJob").value || "").trim(),
        };
        if (e) body.replaces_id = e.id;
        // say it here rather than making the server say it: the field is on screen
        if (!body.foreman) { err.textContent = "Pick a foreman."; return; }
        if (body.amount == null) { err.textContent = "Enter an amount."; return; }
        if (body.entry_type === "fine" && !body.reason && body.amount > 0) {
          err.textContent = "Say what the fine is for \u2014 a fine with no reason cannot be defended.";
          return;
        }
        btn.disabled = true; btn.textContent = "Saving\u2026"; err.textContent = "";
        try {
          var res = await fetch(ZTZ.API + "/api/_ffines", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
            body: JSON.stringify(body),
          });
          var j = await res.json();
          if (!res.ok) throw new Error(j && j.error || ("HTTP " + res.status));
          S.fines = j;                       // the server returns the whole ledger back
          S.fnx[body.foreman] = true;        // open him up so the new row is visible
          close(); paint();
        } catch (ex) {
          err.textContent = String(ex && ex.message || ex);
          btn.disabled = false; btn.textContent = "Save";
        }
      };
    }

    /* What this man still owes outside the cash: fines and opening balances, less what he
     * has repaid. Zero unless the ledger has been loaded -- Balance by Foreman must never
     * wait on a second request to paint, so the chip appears when the ledger arrives. */
    function debtOf(name) {
      var b = ((S.fines || {}).balances || []);
      for (var i = 0; i < b.length; i++) {
        if (b[i].foreman === name) return b[i].owes || 0;
      }
      return 0;
    }

    /* Every foreman the page knows about, for the name field. Drawn from the jobs on screen
     * plus anyone already in the ledger, so a man with no open job this week is still
     * fineable -- which is exactly when a fine tends to be recorded. */
    function mfForemen() {
      var set = {};
      (overlaid() || []).forEach(function (r) {
        if (r.forman && r.forman !== MF_NO_FOREMAN) set[r.forman] = 1;
      });
      ((S.fines || {}).balances || []).forEach(function (b) { if (b.foreman) set[b.foreman] = 1; });
      return Object.keys(set).sort();
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
        + (calUrl(r) ? ' <a class="mf-doc" href="' + esc(calUrl(r))
            + '" target="_blank" rel="noopener">calendar ↗</a>' : "")
        + "</b></div>"
        + (r.dcTs ? '<div class="mf-mdc">Recorded in the contract system ' + fmtTs(r.dcTs) + "</div>" : "")
        + '<div class="mf-ro bal ok" id="mfMBalRow"><span>Net Cash Balance</span><b id="mfMBal">$0</b></div>'
        + '<div class="mf-fld"><label>Type</label><select id="mfMType">'
        + ["Cash Brought to Base", "Cash Taken Away from Base"].map(function (t) {
            return "<option" + (t === pre.type ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>"
        + '<div class="mf-fld"><label>Amount ($)</label><input id="mfMAmt" type="number" step="0.01" min="0" value="' + esc(String(pre.amount)) + '"></div>'
        + '<div class="mf-mrow">'
        + '<div class="mf-fld"><label>Forman Deduction ($) <i>on top of what he owes</i></label><input id="mfMDed" type="number" step="0.01" min="0" value="' + esc(String(r.ded != null ? Math.abs(r.ded) : "")) + '" placeholder="0"></div>'
        // a NEGATIVE advance is a legacy office refund ('Cash Taken Away from Base' in the
        // old advance form) — the portal write path is positive-only (bridge rejects
        // negatives; direction lives in the entry TYPE), so show it locked, not editable
        + '<div class="mf-fld"><label>Advance Payment ($) <i>already handed to him</i></label><input id="mfMAdv" type="number" step="0.01"'
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
        // A BLANK AMOUNT IS AN ANSWER: "nothing was handed over, but he owes a deduction."
        // Demanding a number here made the deduction-only case unsaveable (Ryan Lester), and
        // the only way through was to invent a cash entry that never happened. Blank now
        // means no cash entry is recorded at all; the deduction and advance save on their own.
        if (amt != null && amt < 0) {
          errEl.innerHTML = '<div class="mf-merr">The amount must be a positive number — '
            + "which way the money went is set by the Type.</div>";
          return;
        }
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
        // no amount typed -> no cash entry. Without this guard a blank field posted `null`
        // as an amount and the bridge answered 400.
        if (amt != null) {
          var newFlow = type === "Cash Taken Away from Base" ? -amt : amt;
          if (curFlow == null || Math.abs(newFlow - curFlow) > 0.009)
            posts.push({ entry_type: type, amount: amt, note: note || "confirmed" });
        }
        if (ded != null && Math.abs(ded - Math.abs(r.ded || 0)) > 0.009)
          posts.push({ entry_type: "Forman Deduction", amount: ded, note: note });
        if (adv != null && Math.abs(adv - (r.adv || 0)) > 0.009)
          posts.push({ entry_type: "Advance Payment", amount: adv, note: note });
        if (!posts.length) {
          // nothing typed anywhere is a mistake, not a no-op: the person pressed Save
          if (amt == null && ded == null && adv == null) {
            errEl.innerHTML = '<div class="mf-merr">Nothing to save — enter an amount, a '
              + "deduction or an advance.</div>";
            return;
          }
          close(); return;
        }
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
        b.onclick = function () {
          S.view = b.getAttribute("data-mfv"); S.hpage = 0; paint();
          // the ledger is fetched the first time it is asked for, not on every page open:
          // most visits never open this view, and the bridge should not pay for them
          if (S.view === "fines" && !S.fines && !S.finesErr) {
            loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
          }
        };
      });
      // History pager
      var hp = root.querySelector("#mfHPrev");
      if (hp) hp.onclick = function () { S.hpage--; paint(); var w = root.querySelector(".mf-wrap"); if (w) w.scrollTop = 0; };
      var hn = root.querySelector("#mfHNext");
      if (hn) hn.onclick = function () { S.hpage++; paint(); var w = root.querySelector(".mf-wrap"); if (w) w.scrollTop = 0; };
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
      // Fines: expand a foreman, open the form, correct an entry, retry a failed load
      Array.prototype.forEach.call(root.querySelectorAll("tr[data-mffn]"), function (tr) {
        tr.onclick = function () {
          var f = tr.getAttribute("data-mffn");
          S.fnx[f] = !S.fnx[f]; paint();
        };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-mffe]"), function (b) {
        b.onclick = function (ev2) {
          ev2.stopPropagation();          // the row itself toggles; the button must not
          openFineModal(b.getAttribute("data-mffe"));
        };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfdebt]"), function (c) {
        c.onclick = function (ev2) {
          ev2.stopPropagation();          // the row toggles his jobs; the chip goes elsewhere
          var f = c.getAttribute("data-mfdebt");
          S.view = "fines"; S.fnx[f] = true; paint();
        };
      });
      var fnAdd = root.querySelector("#mfFnAdd");
      if (fnAdd) fnAdd.onclick = function () { openFineModal(null); };
      var fnRetry = root.querySelector("#mfFnRetry");
      if (fnRetry) fnRetry.onclick = async function () {
        this.textContent = "Loading…"; this.disabled = true;
        S.finesErr = ""; S.fines = null; paint();
        await loadFines(); paint();
      };

      Array.prototype.forEach.call(root.querySelectorAll("th[data-mfs]"), function (th) {
        th.onclick = function () {
          var kk = th.getAttribute("data-mfs");
          if (S.sort.k === kk) S.sort.d = -S.sort.d; else S.sort = { k: kk, d: -1 };
          paint();
        };
      });
      var q = root.querySelector("#mfQ");
      if (q) q.oninput = function () { S.q = q.value; S.hpage = 0; var pos = q.selectionStart; paint(); var n2 = root.querySelector("#mfQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
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
          S.dtOpen = false; S.hpage = 0; paint();
        };
      });
      var dap = root.querySelector("#mfDtApply");
      if (dap) dap.onclick = function (e) {
        e.stopPropagation();
        var f = root.querySelector("#mfDtFrom").value || null;
        var t = root.querySelector("#mfDtTo").value || null;
        S.dateFrom = f; S.dateTo = t;
        S.dateLabel = (f || t) ? ((f ? fmtD(f) : "…") + " – " + (t ? fmtD(t) : "…")) : "All time";
        S.dtOpen = false; S.hpage = 0; paint();
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
          var _pop = root.querySelector(".mf-fmpop");
          S.fmScroll = _pop ? _pop.scrollTop : 0;   // the tick repaints the whole bar -- keep the
          S.hpage = 0; paint(); S.fmOpen = true;    // list where the user had scrolled it
        };
      });
      var fc = root.querySelector("#mfFmClr"); if (fc) fc.onclick = function () { S.formen = []; S.fmOpen = false; S.hpage = 0; paint(); };
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
      var last = document.getElementById("mfLast");
      if (last) last.textContent = S.liveAt
        ? ("Updated " + new Date(S.liveAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
        : "";
      var el = document.getElementById("mfLive"); if (!el) return;
      if (S.liveOk) { el.className = "mf-live"; el.textContent = "● live"; el.title = "Figures are current to about a minute — digital contracts and portal entries included."; }
      else { el.className = "mf-live off"; el.textContent = "◷ snapshot"; el.title = "Live update unreachable (" + (S.liveErr || "?") + ") — showing the last pipeline build."; }
    }

    // SKIP the live sync if we already synced within the last minute (his ask 2026-07-22 —
    // switching pages fast shouldn't re-hit the server each time; reuse the in-memory data).
    // Otherwise sync + repaint, guarding against a stale open so a late resolve can't paint
    // over a newer page.
    if (S.live && S.liveAt && (Date.now() - S.liveAt < 60000)) {
      S.busy = false; setLiveBadge(); paint();
    } else {
      S.busy = true; paint();
      loadLive(false).then(function () { if (myGen === window.__MFGEN) { S.busy = false; setLiveBadge(); paint(); } });
    }
    // the view is remembered across visits, so landing straight back on Fines has to fetch
    // it too -- otherwise the segment reads 0 over a ledger nobody ever read
    // the ledger is small and every view can show a debt chip, so fetch it once per visit
    // in the background -- it must never hold up the cash tables, which are the point
    if (!S.fines && !S.finesErr) {
      loadFines().then(function () { if (myGen === window.__MFGEN) paint(); });
    }
  },
});
