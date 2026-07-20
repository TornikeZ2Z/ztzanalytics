/* MONEY FLOW — per-job cash reconciliation (FINANCIAL group). Rebuilds the old
   "Net Cash Closing System" sheet + "Jobs Money Flow" Looker on the warehouse, and
   REPLACES the Google-Form entry path.

   DESIGNED FOR THE LEAST-TECHNICAL USER IN THE COMPANY (Tornike 2026-07-20): the daily
   operator is a 60-year-old who must confirm cash with ONE CLICK. So:
     * two views only — Not Confirmed / Confirmed (future + filtered jobs hidden entirely)
     * a green CONFIRM button right in the row, PRESET with the amount that zeroes the
       balance — click it, the job settles, done. No drawer, no typing.
     * a full-card LOADER whenever data is being fetched, so nothing silently shifts
     * corrections / advances / deductions live behind the small "⋯" button per row
   Data: fct_money_flow (6h base) + /api/_mf live overlay; statuses recomputed client-side
   with the pipeline's proven rules. Writes: POST /api/_mf, edit-with-history. */

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
  group: "financial",
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
        .mf-tbl td{padding:10px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap}
        .mf-tbl tbody tr.mf-row:hover{background:var(--panel-2)}
        .mf-wrap{overflow:auto;max-height:calc(100vh - 320px)}
        .mf-confirm{font:inherit;font-size:12.5px;font-weight:800;background:${POS};color:#fff;border:0;border-radius:9px;padding:8px 14px;cursor:pointer;white-space:nowrap}
        .mf-confirm:hover{filter:brightness(1.08)}
        .mf-confirm[disabled]{opacity:.6;cursor:default}
        .mf-pill{display:inline-block;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;white-space:nowrap}
        .mf-st-rec{background:rgba(28,122,74,.13);color:${POS}}
        .mf-st-not{background:rgba(176,42,55,.12);color:${NEG}}
        .mf-st-bal{background:rgba(245,165,36,.16);color:#a06a00}
        .mf-st-con{background:rgba(47,111,208,.12);color:${BLUE}}
        .mf-neg{color:${NEG};font-weight:700} .mf-pos{color:${POS};font-weight:700}
        .mf-age{font-size:10.5px;color:var(--faint)}
        .mf-more{font:inherit;font-size:15px;font-weight:800;color:var(--faint);background:transparent;border:1px solid var(--line-2);border-radius:8px;padding:3px 9px;cursor:pointer}
        .mf-more:hover{color:var(--ink)}
        .mf-drawer td{white-space:normal;background:var(--panel-2);border-top:0;padding:0}
        .mf-din{display:grid;grid-template-columns:minmax(280px,380px) minmax(0,1fr);gap:0}
        @media(max-width:900px){.mf-din{grid-template-columns:minmax(0,1fr)}}
        .mf-form{padding:14px 16px;border-right:1px solid var(--line)}
        .mf-form h4{margin:0 0 10px;font-size:12.5px;font-weight:800}
        .mf-form label{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);margin:9px 0 3px}
        .mf-form select,.mf-form input{font:inherit;font-size:13px;width:100%;box-sizing:border-box;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:8px 10px}
        .mf-go{margin-top:12px;font:inherit;font-size:12.5px;font-weight:800;background:var(--brand);color:var(--brand-ink);border:0;border-radius:9px;padding:9px 16px;cursor:pointer}
        .mf-go[disabled]{opacity:.55;cursor:default}
        .mf-err{color:${NEG};font-size:11.5px;font-weight:700;margin-top:8px}
        .mf-okmsg{color:${POS};font-size:11.5px;font-weight:700;margin-top:8px}
        .mf-hist{padding:14px 16px}
        .mf-hist h4{margin:0 0 8px;font-size:12.5px;font-weight:800}
        .mf-htbl{width:100%;border-collapse:collapse;font-size:11.5px}
        .mf-htbl th{text-align:left;font-size:9.5px;text-transform:uppercase;color:var(--faint);padding:5px 8px;border-bottom:1px solid var(--line)}
        .mf-htbl td{padding:6px 8px;border-top:1px solid var(--line);vertical-align:top}
        .mf-htbl tr.gone td{opacity:.5;text-decoration:line-through}
        .mf-editbtn{font:inherit;font-size:10.5px;font-weight:700;color:${BLUE};background:transparent;border:1px solid var(--line-2);border-radius:7px;padding:2px 8px;cursor:pointer}
        .mf-fnote{padding:10px 14px;font-size:11px;color:var(--faint);border-top:1px solid var(--line)}
        .mf-load{padding:40px;text-align:center;color:var(--faint)}
        .mf-veil{position:absolute;inset:0;z-index:30;background:color-mix(in srgb, var(--panel) 72%, transparent);display:flex;align-items:center;justify-content:center;gap:12px;font-size:14px;font-weight:800;color:var(--muted)}
        .mf-spin{width:22px;height:22px;border:3px solid var(--line-2);border-top-color:var(--brand);border-radius:50%;animation:mfspin .8s linear infinite}
        @keyframes mfspin{to{transform:rotate(360deg)}}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="mf-head"><div>
        <h1>Money Flow <span class="mf-live off" id="mfLive">◷ syncing…</span></h1>
        <p>Every job’s cash: what we expect vs what was handed over. Press the green button to confirm — the amount is already filled in.</p>
      </div><div><button class="mf-editbtn" id="mfRefresh" style="padding:8px 14px;font-size:12.5px">↻ Refresh</button></div></div>
      <div id="mfBody"><div class="mf-load"><div class="mf-spin" style="margin:0 auto 12px"></div>Loading jobs…</div></div>`;

    var S = window.__MF || (window.__MF = {
      view: "todo", q: "", formen: [], live: null, liveOk: false,
      openEv: null, sort: { k: "Job Date", d: -1 }, edit: null, months: 0,
      fmOpen: false, busy: false,
    });
    if (!Array.isArray(S.formen)) S.formen = [];

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
          records: lv ? lv.records : (num(b["Cash Flow Records"]) || 0),
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
    var PILL = { "Money Received": "mf-st-rec", "Money Not Received": "mf-st-not",
                 "Not in Balance": "mf-st-bal", "Contract Not Received": "mf-st-con" };
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

    // the amount that settles the job: expected + advance − deduction (a NEW submission
    // REPLACES the old one — last-record-wins — so this is the full figure, not the diff)
    function settleAmount(r) {
      if (r.expected == null) return null;
      return Math.round((r.expected + (r.adv || 0) - (r.ded || 0)) * 100) / 100;
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
        var open = S.openEv === r.ev;
        var age = Math.floor((Date.now() - new Date(r.date + "T12:00:00")) / 864e5);
        var action;
        if (S.view === "done") {
          action = '<span class="mf-pill mf-st-rec">✓ Confirmed</span>';
        } else if (r.status === "Contract Not Received") {
          action = '<span class="mf-pill mf-st-con" title="No contract amount exists yet — open ⋯ to enter the cash manually">no contract</span>';
        } else {
          var amt = settleAmount(r);
          action = '<button class="mf-confirm" data-mfc="' + esc(r.ev) + '" title="Records this amount as handed over — the balance becomes $0">Confirm ' + money(amt) + "</button>";
        }
        // the Not-Confirmed view drops "Handed over" (almost always blank there) so the
        // CONFIRM button is on screen without horizontal scrolling — it is the main action
        var handed = S.view === "done" ? '<td class="r">' + money(r.flow) + "</td>" : "";
        var tr = '<tr class="mf-row" data-ev="' + esc(r.ev) + '">'
          + "<td>" + fmtD(r.date) + (S.view === "todo" && age > 0 ? ' <span class="mf-age">' + age + "d</span>" : "") + "</td>"
          + "<td>" + esc(r.jobNo || "—") + "</td>"
          + "<td>" + esc(r.customer || "—") + "</td>"
          + "<td>" + esc(r.forman) + "</td>"
          + '<td class="r">' + money(r.expected) + "</td>"
          + handed
          + '<td class="r ' + ((r.balance || 0) > MF_TOL ? "mf-neg" : (r.balance || 0) < -MF_TOL ? "mf-pos" : "") + '">' + money(r.balance) + "</td>"
          + "<td>" + action + "</td>"
          + '<td><button class="mf-more" data-mfo="' + esc(r.ev) + '" title="Details, corrections, advance, deduction">⋯</button></td></tr>';
        if (open) tr += '<tr class="mf-drawer"><td colspan="9">' + drawer(r) + "</td></tr>";
        return tr;
      }).join("");

      var veil = S.busy ? '<div class="mf-veil"><div class="mf-spin"></div>Updating…</div>' : "";
      var tbl = '<div class="mf-card">' + veil + '<div class="mf-wrap"><table class="mf-tbl"><thead><tr>'
        + '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Job #</th><th>Customer</th><th>Foreman</th>"
        + '<th class="r" data-mfs="Expected">Expected' + arrow("Expected") + "</th>"
        + (S.view === "done" ? '<th class="r">Handed over</th>' : "")
        + '<th class="r" data-mfs="Balance">Balance' + arrow("Balance") + "</th><th></th><th></th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="9" style="color:var(--faint);padding:18px">' + (S.view === "done" ? "Nothing confirmed yet." : "Nothing waiting — all cash is confirmed. 🎉") + "</td></tr>")
        + "</tbody></table></div>"
        + '<div class="mf-fnote">The green button records the exact amount that settles the job. If the real cash was different, press ⋯ and enter what was actually handed over — every change keeps its history.</div></div>';

      document.getElementById("mfBody").innerHTML = kp + bar + tbl;
      wire();
    }

    // ---------- drawer (details / corrections / advance / deduction) ----------
    function drawer(r) {
      var hist = (entriesByEv[r.ev] || []).slice().reverse();
      var editing = S.edit && S.edit.ev === r.ev ? S.edit : null;
      var defAmt = editing ? editing.amount : (settleAmount(r) != null ? Math.abs(settleAmount(r)) : "");
      var defType = editing ? editing.type
        : (settleAmount(r) != null && settleAmount(r) < 0) ? "Cash Taken Away from Base" : "Cash Brought to Base";
      var form = '<div class="mf-form">'
        + "<h4>" + (editing ? "Correct entry #" + editing.id : "Record for this job") + "</h4>"
        + '<label>Type</label><select id="mfType">'
        + ["Cash Brought to Base", "Cash Taken Away from Base", "Advance Payment", "Forman Deduction"].map(function (t) {
            return "<option" + (t === defType ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>"
        + '<label>Amount ($)</label><input id="mfAmt" type="number" step="0.01" min="0" value="' + esc(String(defAmt)) + '">'
        + '<label>Note (optional)</label><input id="mfNote" value="' + esc(editing ? (editing.note || "") : "") + '" placeholder="why / details">'
        + '<button class="mf-go" id="mfGo" data-ev="' + esc(r.ev) + '" data-job="' + esc(r.jobCode || "") + '"' + (editing ? ' data-rep="' + editing.id + '"' : "") + ">"
        + (editing ? "Save correction" : "Save entry") + "</button>"
        + (editing ? ' <button class="mf-editbtn" id="mfCancelEdit" style="margin-top:12px">✕ cancel</button>' : "")
        + '<div id="mfMsg"></div></div>';
      var meta = '<div style="font-size:11px;color:var(--faint);margin-bottom:8px">'
        + esc(r.ct || "") + (r.adv ? " · advance " + money(r.adv) : "") + (r.ded ? " · deduction " + money(r.ded) : "")
        + (r.flow != null ? " · current figure " + money(r.flow) + " from " + (r.flowSrc === "dc" ? "the digital contract" : r.flowSrc === "portal" ? "this page" : "the old form") + " (" + fmtTs(r.flowTs) + ")" : "") + "</div>";
      var htable = '<div class="mf-hist"><h4>Submission history</h4>' + meta
        + (hist.length ? '<table class="mf-htbl"><thead><tr><th>When</th><th>Type</th><th class="r">Amount</th><th>By</th><th>Note</th><th></th></tr></thead><tbody>'
          + hist.map(function (en) {
              return '<tr class="' + (en.current ? "" : "gone") + '"><td>' + fmtTs(en.at) + "</td><td>" + esc(en.type) + '</td><td class="r">' + money(en.amount) + "</td><td>" + esc(String(en.by || "").split("@")[0]) + "</td><td>" + esc(en.note || "") + "</td>"
                + "<td>" + (en.current ? '<button class="mf-editbtn" data-mfe="' + en.id + '" data-ev="' + esc(r.ev) + '">correct</button>' : "superseded") + "</td></tr>";
            }).join("") + "</tbody></table>"
          : '<div style="color:var(--faint);font-size:11.5px">No portal entries yet.</div>')
        + "</div>";
      return '<div class="mf-din">' + form + htable + "</div>";
    }

    async function saveEntry(body, doneMsgSel) {
      S.busy = true; paint();
      try {
        var r = await fetch(ZTZ.API + "/api/_mf", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
          body: JSON.stringify(body),
        });
        var j = await r.json().catch(function () { return {}; });
        if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
        await loadLive(true);
        S.busy = false; S.edit = null;
        setLiveBadge(); paint();
        return true;
      } catch (err) {
        S.busy = false; paint();
        var m = host.querySelector(doneMsgSel || "#mfMsg");
        if (m) m.innerHTML = '<div class="mf-err">Couldn’t save (' + esc(String(err && err.message || err)) + ") — nothing recorded.</div>";
        return false;
      }
    }

    function wire() {
      var root = host;
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfv]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-mfv"); S.openEv = null; S.edit = null; paint(); };
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
      // multi-select foreman
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
      // ONE-CLICK CONFIRM — the whole point of this page
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfc]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          if (S.busy) return;
          var ev = b.getAttribute("data-mfc");
          var r = overlaid().filter(function (x) { return x.ev === ev; })[0];
          if (!r) return;
          var amt = settleAmount(r);
          if (amt == null) return;
          b.disabled = true; b.textContent = "Saving…";
          saveEntry({
            entry_type: amt < 0 ? "Cash Taken Away from Base" : "Cash Brought to Base",
            amount: Math.abs(amt),
            note: "confirmed",
            event_id: ev, job_code: r.jobCode || "",
            customer: r.customer || "", forman: r.formanEmail || "",
          });
        };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfo]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var ev = b.getAttribute("data-mfo");
          S.openEv = S.openEv === ev ? null : ev; S.edit = null; paint();
        };
      });
      Array.prototype.forEach.call(root.querySelectorAll("[data-mfe]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var id = +b.getAttribute("data-mfe"), ev = b.getAttribute("data-ev");
          var en = (entriesByEv[ev] || []).filter(function (x) { return x.id === id; })[0];
          if (en) { S.edit = { ev: ev, id: id, amount: en.amount, type: en.type, note: en.note }; paint(); }
        };
      });
      var ce = root.querySelector("#mfCancelEdit"); if (ce) ce.onclick = function (e) { e.stopPropagation(); S.edit = null; paint(); };
      var go = root.querySelector("#mfGo");
      if (go) go.onclick = function (e) {
        e.stopPropagation();
        var msg = root.querySelector("#mfMsg");
        var amt = parseFloat(root.querySelector("#mfAmt").value);
        if (isNaN(amt)) { msg.innerHTML = '<div class="mf-err">Enter an amount.</div>'; return; }
        if (amt < 0) { msg.innerHTML = '<div class="mf-err">Amount must be positive — the direction comes from the type.</div>'; return; }
        var body = {
          entry_type: root.querySelector("#mfType").value, amount: amt,
          note: root.querySelector("#mfNote").value.trim(),
          event_id: go.getAttribute("data-ev"), job_code: go.getAttribute("data-job"),
        };
        var rep = go.getAttribute("data-rep"); if (rep) body.replaces_id = +rep;
        var row = overlaid().filter(function (r) { return r.ev === body.event_id; })[0];
        if (row) { body.customer = row.customer || ""; body.forman = row.formanEmail || ""; }
        go.disabled = true; go.textContent = "Saving…";
        saveEntry(body);
      };
    }

    function setLiveBadge() {
      var el = document.getElementById("mfLive"); if (!el) return;
      if (S.liveOk) { el.className = "mf-live"; el.textContent = "● live"; el.title = "Figures are current to about a minute — digital contracts and portal entries included."; }
      else { el.className = "mf-live off"; el.textContent = "◷ snapshot"; el.title = "Live update unreachable (" + (S.liveErr || "?") + ") — showing the last pipeline build."; }
    }

    S.busy = true; paint();                                    // table skeleton + veil
    loadLive(false).then(function () { S.busy = false; setLiveBadge(); paint(); });
  },
});
