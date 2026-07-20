/* MONEY FLOW — per-job cash reconciliation (FINANCIAL group). Rebuilds the old
   "Net Cash Closing System" sheet + "Jobs Money Flow" Looker on the warehouse, and
   REPLACES the Google-Form entry path.

   DESIGNED FOR THE LEAST-TECHNICAL USER IN THE COMPANY (Tornike 2026-07-20/21): the daily
   operator is a 60-year-old. EVERY action goes through ONE simple POPUP:
     * two views only — Not Confirmed / Confirmed (future + filtered jobs hidden entirely)
     * the green CONFIRM button and the row itself both open the SAME popup, with Type and
       Amount already filled so the Balance reads $0 — he checks, presses Save, done.
     * popup fields exactly as specified: Expected (read-only), Balance (live calculation,
       read-only), Type, Amount, Deduction, Advance Payment, small Note.
     * Save records ONLY what changed (untouched deduction/advance write nothing).
     * a full-card LOADER whenever data is fetched or saved, so nothing silently shifts
     * no horizontal scrollbar — the table fits, details live in the popup
   Data: fct_money_flow (6h base) + /api/_mf live overlay; statuses recomputed client-side
   with the pipeline's proven rules. Writes: POST /api/_mf, history kept on every change. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_money_flow) {
    RS.DATASETS.fct_money_flow = {
      table: "fct_money_flow",
      cols: ["Event ID", "Job Date", "Event Title", "Job No", "Job Code", "Customer",
             "Forman Email", "Forman", "Job Type", "Contract Type", "Net Cash (DC)", "Net Cash (Closing)",
             "Expected Net Cash", "Cash Flow", "Cash Flow Time", "Cash Flow Source",
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
        .mf-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:200px}
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
        .mf-neg{color:${NEG};font-weight:700} .mf-pos{color:${POS};font-weight:700}
        .mf-age{font-size:10.5px;color:var(--faint)}
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
        <p>Every job’s cash: what we expect vs what was handed over. Press <b>Confirm</b>, check the popup, press <b>Save</b> — done.</p>
      </div><div><button class="mf-cancel" id="mfRefresh" style="padding:8px 14px;font-size:12.5px">↻ Refresh</button></div></div>
      <div id="mfBody"><div class="mf-load"><div class="mf-spin" style="margin:0 auto 12px"></div>Loading jobs…</div></div>
      <div id="mfModalHost"></div>`;

    var S = window.__MF || (window.__MF = {
      view: "todo", q: "", formen: [], live: null, liveOk: false,
      sort: { k: "Job Date", d: -1 }, months: 0, fmOpen: false, busy: false, modalEv: null,
    });
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
    function overlaid() {
      var liveByEv = {};
      if (S.live) S.live.rows.forEach(function (r) { liveByEv[r.ev] = r; });
      return base.map(function (b) {
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
          baseStatus: b["Status"],
        };
        if (r.expected == null && r.closingNC != null) r.expected = r.closingNC;
        r.balance = (r.expected == null) ? null
          : r.expected + (r.adv || 0) - (r.flow || 0) - (r.ded || 0);
        r.status = computeStatus(r);
        return r;
      });
    }
    function computeStatus(r) {
      var jt = String(r.jobType || "");
      if (r.baseStatus === "Filter Out" || jt === "Box Delivery" || jt === "In-Home Estimate"
          || jt === "Cancelled" || /cancel/i.test(String(r.title || ""))) return "Filter Out";
      if (r.date > todayIso) return "Job is in the Future";
      if (r.baseStatus === "Tracked on Sibling Event" && r.expected == null) return "Tracked on Sibling Event";
      if (r.expected == null) return "Contract Not Received";
      if (r.flow == null && r.expected !== 0) return "Money Not Received";
      if (Math.abs(r.balance == null ? 0 : r.balance) <= MF_TOL) return "Money Received";
      return "Not in Balance";
    }
    var NOTCONF = { "Money Not Received": 1, "Not in Balance": 1, "Contract Not Received": 1 };

    var entriesByEv = {};
    function indexEntries() {
      entriesByEv = {};
      ((S.live && S.live.entries) || []).forEach(function (en) {
        var k = en.event_id || "";
        if (k) (entriesByEv[k] = entriesByEv[k] || []).push(en);
      });
    }
    async function loadLive(fresh) {
      try {
        var r = await fetch(ZTZ.API + "/api/_mf" + (fresh ? "?fresh=1" : ""),
          { headers: { "Authorization": "Bearer " + ZTZ.getToken() } });
        if (!r.ok) throw new Error("HTTP " + r.status);
        S.live = await r.json(); S.liveOk = true; indexEntries();
      } catch (e) { S.liveOk = false; S.liveErr = String(e && e.message || e); }
    }

    // the settle preset: Type + Amount such that the balance becomes exactly $0
    // (a new record REPLACES the old one — last-record-wins — so this is the full figure)
    function settle(r) {
      if (r.expected == null) return null;
      var v = Math.round((r.expected + (r.adv || 0) - (r.ded || 0)) * 100) / 100;
      return { type: v < 0 ? "Cash Taken Away from Base" : "Cash Brought to Base", amount: Math.abs(v) };
    }

    // ---------- painting ----------
    function paint() {
      var rows = overlaid();
      var q = S.q.trim().toLowerCase();
      var todo = rows.filter(function (r) { return NOTCONF[r.status]; });
      var done = rows.filter(function (r) { return r.status === "Money Received"; });
      var cur = (S.view === "done" ? done : todo).slice();
      if (S.formen.length) cur = cur.filter(function (r) { return S.formen.indexOf(r.forman) >= 0; });
      if (S.months) {
        var lim = new Date(); lim.setMonth(lim.getMonth() - S.months);
        var limIso = lim.toISOString().slice(0, 10);
        cur = cur.filter(function (r) { return r.date >= limIso; });
      }
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

      var outBal = 0; todo.forEach(function (r) { outBal += (r.balance || 0); });
      var age30 = todo.filter(function (r) { return (Date.now() - new Date(r.date + "T12:00:00")) / 864e5 > 30; }).length;
      var noCon = todo.filter(function (r) { return r.status === "Contract Not Received"; }).length;

      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi neg"><b>' + money(outBal) + '</b><span>Waiting for cash</span><small>' + todo.length + ' job' + (todo.length === 1 ? "" : "s") + ' not confirmed</small></div>'
        + '<div class="mf-kpi"><b>' + age30 + '</b><span>Older than 30 days</span><small>chase these first</small></div>'
        + '<div class="mf-kpi"><b>' + noCon + '</b><span>No contract data</span><small>needs a manual amount</small></div>'
        + '<div class="mf-kpi pos"><b>' + done.length.toLocaleString() + '</b><span>Confirmed</span><small>settled within $' + MF_TOL + '</small></div></div>';

      var allF = {};
      rows.forEach(function (r) { if (NOTCONF[r.status] || r.status === "Money Received") { if (r.forman && r.forman !== "—") allF[r.forman] = 1; } });
      var fmLabel = S.formen.length ? "Foremen (" + S.formen.length + ")" : "All foremen";
      var fmPop = S.fmOpen ? '<div class="mf-fmpop">' + Object.keys(allF).sort().map(function (f) {
          return '<label><input type="checkbox" data-mff="' + esc(f) + '"' + (S.formen.indexOf(f) >= 0 ? " checked" : "") + '> ' + esc(f) + "</label>";
        }).join("") + '<button class="clr" id="mfFmClr">Show all foremen</button></div>' : "";

      var segBtn = function (id, label, n) {
        return '<button class="' + (S.view === id ? "on" : "") + '" data-mfv="' + id + '">' + label + "<i>" + n + "</i></button>";
      };
      var bar = '<div class="mf-bar">'
        + '<div class="mf-seg">' + segBtn("todo", "Not Confirmed", todo.length) + segBtn("done", "Confirmed", done.length) + "</div>"
        + '<input class="mf-q" id="mfQ" placeholder="Search customer / job / foreman" value="' + esc(S.q) + '">'
        + '<div class="mf-fmwrap"><button class="mf-fmbtn' + (S.formen.length ? " on" : "") + '" id="mfFmBtn">' + esc(fmLabel) + ' ▾</button>' + fmPop + "</div>"
        + '<select class="mf-sel" id="mfM"><option value="0"' + (!S.months ? " selected" : "") + '>All time</option><option value="1"' + (S.months === 1 ? " selected" : "") + '>Last month</option><option value="3"' + (S.months === 3 ? " selected" : "") + '>Last 3 months</option></select></div>';

      var arrow = function (kk) { return S.sort.k === kk ? (S.sort.d < 0 ? " ↓" : " ↑") : ""; };
      var body = cur.map(function (r) {
        var age = Math.floor((Date.now() - new Date(r.date + "T12:00:00")) / 864e5);
        var action;
        if (S.view === "done") {
          action = '<span class="mf-pill mf-st-rec">✓ Confirmed</span>';
        } else if (r.status === "Contract Not Received") {
          action = '<span class="mf-pill mf-st-con" title="No contract amount yet — click the row and enter the cash manually">no contract</span>';
        } else {
          action = '<button class="mf-confirm" data-mfc="' + esc(r.ev) + '">Confirm ' + money(settle(r).type === "Cash Taken Away from Base" ? -settle(r).amount : settle(r).amount) + "</button>";
        }
        var handed = S.view === "done" ? '<td class="r">' + money(r.flow) + "</td>" : "";
        return '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
          + "<td>" + fmtD(r.date) + (S.view === "todo" && age > 0 ? ' <span class="mf-age">' + age + "d</span>" : "") + "</td>"
          + "<td>" + esc(r.jobNo || "—") + "</td>"
          + "<td>" + esc(r.customer || "—") + "</td>"
          + "<td>" + esc(r.forman) + "</td>"
          + '<td class="r">' + money(r.expected) + "</td>"
          + handed
          + '<td class="r ' + ((r.balance || 0) > MF_TOL ? "mf-neg" : (r.balance || 0) < -MF_TOL ? "mf-pos" : "") + '">' + money(r.balance) + "</td>"
          + "<td>" + action + "</td></tr>";
      }).join("");

      var veil = S.busy ? '<div class="mf-veil"><div class="mf-spin"></div>Updating…</div>' : "";
      var cols = S.view === "done" ? 8 : 7;
      var tbl = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl"><thead><tr>'
        + '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Job #</th><th>Customer</th><th>Foreman</th>"
        + '<th class="r" data-mfs="Expected">Expected' + arrow("Expected") + "</th>"
        + (S.view === "done" ? '<th class="r">Handed over</th>' : "")
        + '<th class="r" data-mfs="Balance">Balance' + arrow("Balance") + "</th><th></th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="' + cols + '" style="color:var(--faint);padding:18px">' + (S.view === "done" ? "Nothing confirmed yet." : "Nothing waiting — all cash is confirmed. 🎉") + "</td></tr>")
        + "</tbody></table></div>"
        + '<div class="mf-fnote">Click any row (or the green button) to open the job — the amount is prefilled so the balance becomes $0. Every save keeps its history.</div></div>';

      document.getElementById("mfBody").innerHTML = kp + bar + tbl;
      wire();
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
        + '<div class="mf-ro"><span>Expected</span><b>' + money2(r.expected) + "</b></div>"
        + '<div class="mf-ro bal ok" id="mfMBalRow"><span>Balance</span><b id="mfMBal">$0</b></div>'
        + '<div class="mf-fld"><label>Type</label><select id="mfMType">'
        + ["Cash Brought to Base", "Cash Taken Away from Base"].map(function (t) {
            return "<option" + (t === pre.type ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select></div>"
        + '<div class="mf-fld"><label>Amount ($)</label><input id="mfMAmt" type="number" step="0.01" min="0" value="' + esc(String(pre.amount)) + '"></div>'
        + '<div class="mf-mrow">'
        + '<div class="mf-fld"><label>Deduction ($)</label><input id="mfMDed" type="number" step="0.01" min="0" value="' + esc(String(r.ded != null ? Math.abs(r.ded) : "")) + '" placeholder="0"></div>'
        + '<div class="mf-fld"><label>Advance Payment ($)</label><input id="mfMAdv" type="number" step="0.01" min="0" value="' + esc(String(r.adv != null ? Math.abs(r.adv) : "")) + '" placeholder="0"></div>'
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
        var type = document.getElementById("mfMType").value;
        var amt = num(document.getElementById("mfMAmt").value);
        var ded = num(document.getElementById("mfMDed").value) || 0;
        var adv = num(document.getElementById("mfMAdv").value) || 0;
        var flow = amt == null ? 0 : (type === "Cash Taken Away from Base" ? -amt : amt);
        var bal = (r.expected || 0) + adv - flow - ded;
        var el = document.getElementById("mfMBal"), row = document.getElementById("mfMBalRow");
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
        var adv = num(document.getElementById("mfMAdv").value);
        var note = document.getElementById("mfMNote").value.trim();
        if (amt == null || amt < 0) { errEl.innerHTML = '<div class="mf-merr">Enter the amount (a positive number).</div>'; return; }
        // only what CHANGED gets recorded — an untouched deduction/advance writes nothing
        var posts = [];
        var curFlow = r.flow == null ? null : r.flow;
        var newFlow = type === "Cash Taken Away from Base" ? -amt : amt;
        if (curFlow == null || Math.abs(newFlow - curFlow) > 0.009)
          posts.push({ entry_type: type, amount: amt, note: note || "confirmed" });
        if (ded != null && Math.abs(ded - Math.abs(r.ded || 0)) > 0.009)
          posts.push({ entry_type: "Forman Deduction", amount: ded, note: note });
        if (adv != null && Math.abs(adv - Math.abs(r.adv || 0)) > 0.009)
          posts.push({ entry_type: "Advance Payment", amount: adv, note: note });
        if (!posts.length) { close(); return; }
        var sv = document.getElementById("mfMSave");
        sv.disabled = true; sv.textContent = "Saving…";
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
          }
          close();
          S.busy = true; paint();
          await loadLive(true);
          S.busy = false; setLiveBadge(); paint();
        } catch (err) {
          sv.disabled = false; sv.textContent = "Save";
          errEl.innerHTML = '<div class="mf-merr">Couldn’t save (' + esc(String(err && err.message || err)) + ") — nothing recorded.</div>";
        }
      };
    }

    function wire() {
      var root = host;
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfv]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-mfv"); paint(); };
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
      var m = root.querySelector("#mfM"); if (m) m.onchange = function () { S.months = +m.value; paint(); };
      var rf = root.querySelector("#mfRefresh");
      if (rf) rf.onclick = async function () { S.busy = true; paint(); await loadLive(true); S.busy = false; setLiveBadge(); paint(); };
      var fb = root.querySelector("#mfFmBtn");
      if (fb) fb.onclick = function (e) { e.stopPropagation(); S.fmOpen = !S.fmOpen; paint(); };
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
      if (S.fmOpen && !wire._docClose) {
        wire._docClose = true;
        document.addEventListener("click", function closeFm() {
          if (S.fmOpen) { S.fmOpen = false; paint(); }
          document.removeEventListener("click", closeFm); wire._docClose = false;
        });
      }
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
