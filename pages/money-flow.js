/* MONEY FLOW — per-job cash reconciliation (FINANCIAL group). Rebuilds the old
   "Net Cash Closing System" sheet + "Jobs Money Flow" Looker on the warehouse, and
   REPLACES the Google-Form entry path: logistics records/corrects cash right here.

   Data: fct_money_flow (6h pipeline base) + /api/_mf live overlay (ztzcmdb is the
   Digital Contract system's own DB on our instance, ~1 min behind reality; portal
   entries are instant). Statuses are recomputed CLIENT-SIDE from the overlaid
   numbers with the same proven rules as src/money_flow.py, so a recorded entry
   settles its job on the very next paint — no waiting for the pipeline.

   Writes: POST /api/_mf — edit-with-history (a correction supersedes, never erases).
   Every entry also mirrors to the old forms sheet via the relay, so the old system
   keeps seeing new data until it is retired. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_money_flow) {
    RS.DATASETS.fct_money_flow = {
      table: "fct_money_flow",
      // payload contract — add columns only with a real consumer
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
    var INK = "#0e1621", SUB = "#5a6775", FAINT = "#93a0b2", LINE = "#e4e9f0";
    var LIME = "#b7e23b", LIMED = "#7ba317", BLUE = "#2f6fd0";
    var POS = "#1c7a4a", NEG = "#b02a37", WARN_A = "#f5a524";

    if (!document.getElementById("mfCss")) {
      var st = document.createElement("style"); st.id = "mfCss";
      st.textContent = `
        .mf-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .mf-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .mf-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted)}
        .mf-live{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:800;padding:3px 10px;border-radius:999px;background:rgba(28,122,74,.12);color:${POS};vertical-align:2px}
        .mf-live.off{background:rgba(245,165,36,.14);color:#a06a00}
        .mf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px}
        .mf-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
        .mf-kpi b{display:block;font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .mf-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
        .mf-kpi small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .mf-kpi.neg b{color:${NEG}} .mf-kpi.pos b{color:${POS}}
        .mf-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .mf-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px;flex-wrap:wrap}
        .mf-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:12.5px;font-weight:700;padding:6px 13px;border-radius:8px}
        .mf-seg button.on{background:var(--brand);color:var(--brand-ink)}
        .mf-seg button i{font-style:normal;font-weight:800;font-size:10.5px;opacity:.75;margin-left:5px}
        .mf-q{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:7px 11px;min-width:190px}
        .mf-sel{font:inherit;font-size:12.5px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:7px 9px}
        .mf-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden}
        .mf-tbl{width:100%;border-collapse:collapse;font-size:12.5px}
        .mf-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:10px 12px;border-bottom:1px solid var(--line);white-space:nowrap;cursor:pointer;user-select:none}
        .mf-tbl th.r,.mf-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .mf-tbl td{padding:9px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap}
        .mf-tbl tbody tr.mf-row{cursor:pointer}
        .mf-tbl tbody tr.mf-row:hover{background:var(--panel-2)}
        .mf-tbl tr.open{background:var(--panel-2)}
        .mf-wrap{overflow:auto;max-height:calc(100vh - 330px)}
        .mf-pill{display:inline-block;font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;white-space:nowrap}
        .mf-st-rec{background:rgba(28,122,74,.13);color:${POS}}
        .mf-st-not{background:rgba(176,42,55,.12);color:${NEG}}
        .mf-st-bal{background:rgba(245,165,36,.16);color:#a06a00}
        .mf-st-con{background:rgba(47,111,208,.12);color:${BLUE}}
        .mf-st-fut{background:var(--panel-2);color:var(--muted)}
        .mf-st-fil{background:var(--panel-2);color:var(--faint)}
        .mf-ct{font-size:10px;font-weight:800;color:var(--faint);border:1px solid var(--line-2);border-radius:6px;padding:1px 6px;margin-left:6px}
        .mf-neg{color:${NEG};font-weight:700} .mf-pos{color:${POS};font-weight:700}
        .mf-age{font-size:10.5px;color:var(--faint)}
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
        .mf-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin:0 0 14px}
        .mf-fcard{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:11px 13px}
        .mf-fcard .nm{font-size:12.5px;font-weight:800}
        .mf-fcard .amt{font-size:17px;font-weight:800;font-variant-numeric:tabular-nums;color:${NEG}}
        .mf-fcard small{font-size:10.5px;color:var(--faint)}
        .mf-load{padding:40px;text-align:center;color:var(--faint)}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="mf-head"><div>
        <h1>Money Flow <span class="mf-live off" id="mfLive">◷ syncing live…</span></h1>
        <p>Cash reconciliation per job — <b>expected net cash</b> (digital contract, else closing sheet) vs <b>handed over</b>.
           Click a job to confirm cash, record an advance or a deduction — corrections keep full history.</p>
      </div><div><button class="mf-editbtn" id="mfRefresh" style="padding:7px 13px;font-size:12px">↻ Refresh</button></div></div>
      <div id="mfBody"><div class="mf-load">Loading jobs…</div></div>`;

    var S = window.__MF || (window.__MF = {
      view: "out", q: "", forman: "", live: null, liveOk: false,
      openEv: null, sort: { k: "Job Date", d: -1 }, edit: null, months: 0,
    });

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
    function crewName(email) {
      var s = String(email || "").split(",")[0].trim();
      if (!s) return "—";
      var p = s.split("@")[0].replace(/[._\d]+/g, " ").trim();
      return p ? p.replace(/\b\w/g, function (c) { return c.toUpperCase(); }) : s;
    }
    var todayIso = new Date().toISOString().slice(0, 10);

    // ---------- live overlay ----------
    // Merge order matters: the overlay's money numbers REPLACE the base row's, then the
    // status is recomputed with the same rules as the pipeline. A job settled a minute
    // ago must read settled NOW.
    function overlaid() {
      var liveByEv = {};
      if (S.live) S.live.rows.forEach(function (r) { liveByEv[r.ev] = r; });
      return base.map(function (b) {
        var ev = b["Event ID"], lv = liveByEv[ev];
        var r = {
          ev: ev, date: String(b["Job Date"]).slice(0, 10), title: b["Event Title"],
          jobNo: b["Job No"], jobCode: b["Job Code"], customer: b["Customer"],
          forman: b["Forman"] || crewName(b["Forman Email"]), formanEmail: b["Forman Email"],
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
        // DC net cash may be live even when the base row predates it
        if (lv && lv.expected != null && r.ct === "Paper") r.ct = "Digital Contract";
        if (lv && lv.expected != null && r.ct === "No Contract Available") r.ct = "Digital Contract";
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
      if (r.expected == null) return "Contract Not Received";
      if (r.flow == null && r.expected !== 0) return "Money Not Received";
      if (Math.abs(r.balance == null ? 0 : r.balance) <= MF_TOL) return "Money Received";
      return "Not in Balance";
    }
    var PILL = { "Money Received": "mf-st-rec", "Money Not Received": "mf-st-not",
                 "Not in Balance": "mf-st-bal", "Contract Not Received": "mf-st-con",
                 "Job is in the Future": "mf-st-fut", "Filter Out": "mf-st-fil" };

    var entriesByEv = {};
    function indexEntries() {
      entriesByEv = {};
      ((S.live && S.live.entries) || []).forEach(function (en) {
        var k = en.event_id || "";
        if (!k) return;
        (entriesByEv[k] = entriesByEv[k] || []).push(en);
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

    // ---------- painting ----------
    function paint() {
      var rows = overlaid();
      var q = S.q.trim().toLowerCase();
      var views = {
        out: rows.filter(function (r) { return r.status === "Money Not Received" || r.status === "Not in Balance"; }),
        con: rows.filter(function (r) { return r.status === "Contract Not Received"; }),
        rec: rows.filter(function (r) { return r.status === "Money Received"; }),
        all: rows.filter(function (r) { return r.status !== "Filter Out" && r.status !== "Job is in the Future"; }),
      };
      var cur = views[S.view] || views.out;
      if (S.forman) cur = cur.filter(function (r) { return r.forman === S.forman; });
      if (S.months) {
        var lim = new Date(); lim.setMonth(lim.getMonth() - S.months);
        var limIso = lim.toISOString().slice(0, 10);
        cur = cur.filter(function (r) { return r.date >= limIso; });
      }
      if (q) cur = cur.filter(function (r) {
        return String(r.customer || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobNo || "").toLowerCase().indexOf(q) >= 0
          || String(r.jobCode || "").toLowerCase().indexOf(q) >= 0;
      });
      var k = S.sort.k, d = S.sort.d;
      cur.sort(function (a, b) {
        var va = k === "Balance" ? (a.balance == null ? -Infinity : a.balance)
               : k === "Expected" ? (a.expected == null ? -Infinity : a.expected) : a.date;
        var vb = k === "Balance" ? (b.balance == null ? -Infinity : b.balance)
               : k === "Expected" ? (b.expected == null ? -Infinity : b.expected) : b.date;
        return va < vb ? d : va > vb ? -d : 0;
      });

      // KPIs — over ACTIONABLE rows (outstanding + not-in-balance), not the current view
      var out = views.out, outBal = 0;
      out.forEach(function (r) { outBal += (r.balance || 0); });
      var settledN = views.rec.length;
      var age30 = out.filter(function (r) { var dd = (Date.now() - new Date(r.date + "T12:00:00")) / 864e5; return dd > 30; }).length;
      var conN = views.con.length;

      // by-foreman outstanding rollup (top 4 cards)
      var byF = {};
      out.forEach(function (r) {
        var o = byF[r.forman] = byF[r.forman] || { n: 0, bal: 0 };
        o.n++; o.bal += (r.balance || 0);
      });
      var fTop = Object.keys(byF).map(function (f) { return { f: f, n: byF[f].n, bal: byF[f].bal }; })
        .sort(function (a, b) { return b.bal - a.bal; }).slice(0, 4);

      var formen = {};
      rows.forEach(function (r) { if (r.forman && r.forman !== "—") formen[r.forman] = 1; });

      var kp = '<div class="mf-kpis">'
        + '<div class="mf-kpi neg"><b>' + money(outBal) + '</b><span>Outstanding</span><small>' + out.length + ' job' + (out.length === 1 ? "" : "s") + ' waiting for cash</small></div>'
        + '<div class="mf-kpi"><b>' + age30 + '</b><span>Older than 30 days</span><small>outstanding — chase first</small></div>'
        + '<div class="mf-kpi"><b>' + conN + '</b><span>No contract data</span><small>paper / missing — can’t verify</small></div>'
        + '<div class="mf-kpi pos"><b>' + settledN.toLocaleString() + '</b><span>Settled</span><small>within $' + MF_TOL + ' tolerance</small></div></div>';

      var fc = fTop.length && (S.view === "out") ? '<div class="mf-summary">' + fTop.map(function (o) {
        return '<div class="mf-fcard"><div class="nm">' + esc(o.f) + '</div><div class="amt">' + money(o.bal) + '</div><small>' + o.n + ' open job' + (o.n === 1 ? "" : "s") + '</small></div>';
      }).join("") + "</div>" : "";

      var segBtn = function (id, label, n) {
        return '<button class="' + (S.view === id ? "on" : "") + '" data-mfv="' + id + '">' + label + "<i>" + n + "</i></button>";
      };
      var bar = '<div class="mf-bar">'
        + '<div class="mf-seg">' + segBtn("out", "Outstanding", views.out.length) + segBtn("con", "No Contract", views.con.length)
        + segBtn("rec", "Received", views.rec.length) + segBtn("all", "All Jobs", views.all.length) + "</div>"
        + '<input class="mf-q" id="mfQ" placeholder="Search customer / job #" value="' + esc(S.q) + '">'
        + '<select class="mf-sel" id="mfF"><option value="">All foremen</option>' + Object.keys(formen).sort().map(function (f) {
            return '<option' + (S.forman === f ? " selected" : "") + ">" + esc(f) + "</option>"; }).join("") + "</select>"
        + '<select class="mf-sel" id="mfM"><option value="0"' + (!S.months ? " selected" : "") + '>All time</option><option value="1"' + (S.months === 1 ? " selected" : "") + '>Last month</option><option value="3"' + (S.months === 3 ? " selected" : "") + '>Last 3 months</option></select></div>';

      var arrow = function (kk) { return S.sort.k === kk ? (S.sort.d < 0 ? " ↓" : " ↑") : ""; };
      var body = cur.map(function (r) {
        var open = S.openEv === r.ev;
        var age = Math.floor((Date.now() - new Date(r.date + "T12:00:00")) / 864e5);
        var tr = '<tr class="mf-row' + (open ? " open" : "") + '" data-ev="' + esc(r.ev) + '">'
          + "<td>" + fmtD(r.date) + (r.status !== "Money Received" && age > 0 && S.view !== "rec" ? ' <span class="mf-age">' + age + "d</span>" : "") + "</td>"
          + "<td>" + esc(r.jobNo || "—") + "</td>"
          + "<td>" + esc(r.customer || "—") + "</td>"
          + "<td>" + esc(r.forman) + "</td>"
          + '<td>' + esc(r.ct === "Digital Contract" ? "Digital" : r.ct === "Paper" ? "Paper" : "—") + "</td>"
          + '<td class="r">' + money(r.expected) + "</td>"
          + '<td class="r">' + money(r.flow) + (r.records > 1 ? ' <span class="mf-age">×' + r.records + "</span>" : "") + "</td>"
          + '<td class="r">' + (r.adv ? money(r.adv) : "—") + "</td>"
          + '<td class="r">' + (r.ded ? money(r.ded) : "—") + "</td>"
          + '<td class="r ' + ((r.balance || 0) > MF_TOL ? "mf-neg" : (r.balance || 0) < -MF_TOL ? "mf-pos" : "") + '">' + money(r.balance) + "</td>"
          + '<td><span class="mf-pill ' + (PILL[r.status] || "") + '">' + esc(r.status) + "</span></td></tr>";
        if (open) tr += '<tr class="mf-drawer"><td colspan="11">' + drawer(r) + "</td></tr>";
        return tr;
      }).join("");

      var tbl = '<div class="mf-card"><div class="mf-wrap"><table class="mf-tbl"><thead><tr>'
        + '<th data-mfs="Job Date">Job date' + arrow("Job Date") + "</th><th>Job #</th><th>Customer</th><th>Foreman</th><th>Contract</th>"
        + '<th class="r" data-mfs="Expected">Expected' + arrow("Expected") + '</th><th class="r">Handed over</th><th class="r">Advance</th><th class="r">Deduction</th>'
        + '<th class="r" data-mfs="Balance">Balance' + arrow("Balance") + "</th><th>Status</th>"
        + "</tr></thead><tbody>"
        + (body || '<tr><td colspan="11" style="color:var(--faint);padding:18px">Nothing here.</td></tr>')
        + "</tbody></table></div>"
        + '<div class="mf-fnote">Expected = digital contract net cash, else the closing sheet’s. "Handed over" is the latest submission — a correction replaces the previous one, and the full history stays on the job. Rows update live; the pipeline snapshot refreshes every 6h.</div></div>';

      document.getElementById("mfBody").innerHTML = kp + fc + bar + tbl;
      wire();
    }

    // ---------- drawer: record / correct + history ----------
    function drawer(r) {
      var hist = (entriesByEv[r.ev] || []).slice().reverse();
      var editing = S.edit && S.edit.ev === r.ev ? S.edit : null;
      var defAmt = editing ? editing.amount
        : (r.status === "Money Not Received" && r.expected != null) ? Math.round(r.expected * 100) / 100 : "";
      var defType = editing ? editing.type : "Cash Brought to Base";
      var form = '<div class="mf-form">'
        + "<h4>" + (editing ? "Correct entry #" + editing.id : "Record for this job") + "</h4>"
        + '<label>Type</label><select id="mfType">'
        + ["Cash Brought to Base", "Cash Taken Away from Base", "Advance Payment", "Forman Deduction"].map(function (t) {
            return "<option" + (t === defType ? " selected" : "") + ">" + t + "</option>"; }).join("") + "</select>"
        + '<label>Amount ($)</label><input id="mfAmt" type="number" step="0.01" value="' + esc(String(defAmt)) + '" placeholder="' + (r.expected != null ? "expected " + Math.round(r.expected) : "") + '">'
        + '<label>Note (optional)</label><input id="mfNote" value="' + esc(editing ? (editing.note || "") : "") + '" placeholder="why / details">'
        + '<button class="mf-go" id="mfGo" data-ev="' + esc(r.ev) + '" data-job="' + esc(r.jobCode || "") + '"' + (editing ? ' data-rep="' + editing.id + '"' : "") + ">"
        + (editing ? "Save correction" : "Save entry") + "</button>"
        + (editing ? ' <button class="mf-editbtn" id="mfCancelEdit" style="margin-top:12px">✕ cancel</button>' : "")
        + '<div id="mfMsg"></div></div>';
      var htable = '<div class="mf-hist"><h4>Submission history</h4>'
        + (hist.length ? '<table class="mf-htbl"><thead><tr><th>When</th><th>Type</th><th class="r">Amount</th><th>By</th><th>Note</th><th></th></tr></thead><tbody>'
          + hist.map(function (en) {
              return '<tr class="' + (en.current ? "" : "gone") + '"><td>' + fmtTs(en.at) + "</td><td>" + esc(en.type) + '</td><td class="r">' + money(en.amount) + "</td><td>" + esc(String(en.by || "").split("@")[0]) + "</td><td>" + esc(en.note || "") + "</td>"
                + "<td>" + (en.current ? '<button class="mf-editbtn" data-mfe="' + en.id + '" data-ev="' + esc(r.ev) + '">correct</button>' : "superseded") + "</td></tr>";
            }).join("") + "</tbody></table>"
          : '<div style="color:var(--faint);font-size:11.5px">No portal entries yet' + (r.flow != null ? " — the current figure came from the " + (r.flowSrc === "dc" ? "digital contract" : "old form") + " (" + fmtTs(r.flowTs) + ")" : "") + ".</div>")
        + (r.flow != null && hist.length ? '<div style="color:var(--faint);font-size:10.5px;margin-top:6px">Counted "handed over": the newest record across all sources — currently ' + money(r.flow) + " from " + (r.flowSrc === "dc" ? "the digital contract" : r.flowSrc === "portal" ? "this page" : "the old form") + ".</div>" : "")
        + "</div>";
      return '<div class="mf-din">' + form + htable + "</div>";
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
      var f = root.querySelector("#mfF"); if (f) f.onchange = function () { S.forman = f.value; paint(); };
      var m = root.querySelector("#mfM"); if (m) m.onchange = function () { S.months = +m.value; paint(); };
      var rf = root.querySelector("#mfRefresh"); if (rf) rf.onclick = async function () { rf.disabled = true; await loadLive(true); rf.disabled = false; setLiveBadge(); paint(); };
      Array.prototype.forEach.call(root.querySelectorAll("tr.mf-row"), function (tr) {
        tr.onclick = function () {
          var ev = tr.getAttribute("data-ev");
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
      if (go) go.onclick = async function (e) {
        e.stopPropagation();
        var msg = root.querySelector("#mfMsg");
        var amt = parseFloat(root.querySelector("#mfAmt").value);
        if (isNaN(amt)) { msg.innerHTML = '<div class="mf-err">Enter an amount.</div>'; return; }
        go.disabled = true; go.textContent = "Saving…";
        var body = {
          entry_type: root.querySelector("#mfType").value, amount: amt,
          note: root.querySelector("#mfNote").value.trim(),
          event_id: go.getAttribute("data-ev"), job_code: go.getAttribute("data-job"),
        };
        var rep = go.getAttribute("data-rep"); if (rep) body.replaces_id = +rep;
        // context for the sheet mirror only
        var row = overlaid().filter(function (r) { return r.ev === body.event_id; })[0];
        if (row) { body.customer = row.customer || ""; body.forman = row.formanEmail || ""; }
        try {
          var r = await fetch(ZTZ.API + "/api/_mf", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
            body: JSON.stringify(body),
          });
          var j = await r.json().catch(function () { return {}; });
          if (!r.ok || !j.ok) throw new Error(j.error || ("HTTP " + r.status));
          S.edit = null;
          await loadLive(true);   // the entry must be visible in the very next paint
          setLiveBadge(); paint();
          var msg2 = root.querySelector("#mfMsg");
          if (msg2) msg2.innerHTML = '<div class="mf-okmsg">Saved' + (j.mirrored ? " · copied to the old sheet" : " · sheet copy pending") + ".</div>";
        } catch (err) {
          go.disabled = false; go.textContent = rep ? "Save correction" : "Save entry";
          msg.innerHTML = '<div class="mf-err">Couldn’t save (' + esc(String(err && err.message || err)) + ") — nothing recorded.</div>";
        }
      };
    }

    function setLiveBadge() {
      var el = document.getElementById("mfLive"); if (!el) return;
      if (S.liveOk) { el.className = "mf-live"; el.textContent = "● live"; el.title = "Money figures include the Digital Contract system and portal entries as of right now (≤1 min behind reality)."; }
      else { el.className = "mf-live off"; el.textContent = "◷ 6h snapshot"; el.title = "Live overlay unreachable (" + (S.liveErr || "?") + ") — showing the last pipeline build."; }
    }

    paint();                      // instant paint from the 6h base…
    loadLive(false).then(function () { setLiveBadge(); paint(); });   // …live lands over it
  },
});
