/* FOREMAN NET CASH CLOSINGS — the weekly batch-settlement monitor (LOGISTICS group).
   Rebuilds his "Forman Weekly Closing" sheet: whatever a foreman CONFIRMED in Money Flow
   since his last closing is grouped into one batch, closed once, and archived as a PDF.
   Styled to MATCH the Money Flow "Balance by Foreman" view exactly (his ask 2026-07-22) —
   same table, fonts, sizing, foreman-row + expand-to-jobs, Overview/Details toggle — just
   without the confirm actions (this is read-only; the closing runs automatically). Data:
   /api/_fnc. */

registerPage({
  id: "foreman-closings",
  group: "logistics",
  title: "Foreman Closings",
  async render(host) {
    var esc = RSC.esc;
    var POS = "#1c7a4a", NEG = "#b02a37", BLUE = "#2f6fd0";

    if (!document.getElementById("fncCss")) {
      var st = document.createElement("style"); st.id = "fncCss";
      // values copied verbatim from the Money Flow page so the two look identical
      st.textContent = `
        .fnc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .fnc-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .fnc-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted);max-width:760px}
        .fnc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px;margin-bottom:14px}
        .fnc-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
        .fnc-kpi b{display:block;font-size:20px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .fnc-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
        .fnc-kpi small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .fnc-kpi.pos b{color:${POS}}
        .fnc-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .fnc-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px}
        .fnc-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13.5px;font-weight:800;padding:8px 18px;border-radius:8px}
        .fnc-seg button.on{background:var(--brand);color:var(--brand-ink)}
        .fnc-seg button i{font-style:normal;font-weight:800;font-size:11px;opacity:.75;margin-left:6px}
        .fnc-dseg button{padding:8px 13px;font-size:12px}
        .fnc-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:260px;flex:1;max-width:480px}
        .fnc-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden;position:relative}
        .fnc-wrap{overflow-y:auto;overflow-x:auto;max-height:calc(100vh - 320px)}
        .fnc-tbl{width:100%;border-collapse:collapse;font-size:14px;table-layout:fixed}
        .fnc-tbl th{position:sticky;top:0;background:var(--panel);text-align:left;font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;z-index:2}
        .fnc-tbl th.r,.fnc-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .fnc-tbl td{padding:11px 12px;border-top:1px solid var(--line);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .fnc-tbl tbody tr.fnc-row{cursor:pointer}
        .fnc-tbl tbody tr.fnc-row:hover{background:var(--panel-2)}
        .fnc-tbl.fx tbody tr{height:56px}
        .fnc-tbl.fx{min-width:1150px}
        .fnc-tbl.fx.det{min-width:1680px}
        .fnc-fmrow{cursor:pointer}
        .fnc-fmrow:hover{background:var(--panel-2)}
        .fnc-tbl .fnc-fmrow td{background:var(--panel-2);font-weight:800;font-size:14.5px}
        .fnc-caret{color:var(--faint);font-size:11px;display:inline-block;width:14px}
        .fnc-meta{font-size:12px;font-weight:600;color:var(--faint);margin-left:10px}
        .fnc-neg{color:${NEG};font-weight:700} .fnc-pos{color:${POS};font-weight:700}
        .fnc-doc{font-size:12.5px;font-weight:800;color:${BLUE};text-decoration:none;white-space:nowrap}
        .fnc-doc:hover{text-decoration:underline}
        .fnc-pill{display:inline-block;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;background:var(--panel-2);color:var(--faint)}
        .fnc-pill.auto{background:rgba(28,122,74,.12);color:${POS}} .fnc-pill.imp{background:rgba(47,111,208,.12);color:${BLUE}}
        .fnc-pill.conf{background:rgba(28,122,74,.12);color:${POS}}
        .fnc-note{padding:10px 14px;font-size:11px;color:var(--faint);border-top:1px solid var(--line)}
        .fnc-load{padding:40px;text-align:center;color:var(--faint)}
        .fnc-run{font:inherit;font-size:13px;font-weight:800;background:${POS};color:#fff;border:0;border-radius:9px;padding:9px 16px;cursor:pointer;white-space:nowrap}
        .fnc-run:hover{filter:brightness(1.08)} .fnc-run:disabled{opacity:.6;cursor:default}
        .fnc-auto{font-size:12px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;margin-left:auto}
        .fnc-auto b{color:var(--ink);font-variant-numeric:tabular-nums}
        .fnc-mini{font:inherit;font-size:11.5px;font-weight:800;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);border-radius:8px;padding:5px 11px;cursor:pointer;white-space:nowrap;margin-left:6px}
        .fnc-mini:hover{background:var(--panel-2)} .fnc-mini.go{border-color:${POS};color:${POS}} .fnc-mini:disabled{opacity:.5;cursor:default}
        .fnc-act{display:flex;gap:6px;align-items:center} .fnc-act .fnc-mini{margin-left:0}
        .fnc-back{position:fixed;inset:0;z-index:90;background:rgba(14,22,33,.5);display:flex;align-items:center;justify-content:center;padding:20px}
        .fnc-doc-modal{background:#fff;color:#222;border-radius:10px;box-shadow:0 24px 70px rgba(14,22,33,.4);width:min(960px,96vw);max-height:92vh;overflow:auto;position:relative;font-family:Arial,Helvetica,sans-serif}
        .fnc-mx{position:absolute;top:8px;right:10px;font-size:20px;font-weight:800;color:#fff;background:transparent;border:0;cursor:pointer;z-index:3;line-height:1}
        .fnc-doc-title{background:#111821;color:#fff;font-size:19px;font-weight:800;padding:14px 20px}
        .fnc-doc-body{padding:16px 20px 22px}
        .fnc-dh{display:flex;gap:40px;flex-wrap:wrap;margin-bottom:14px}
        .fnc-dh table{border-collapse:collapse;font-size:13px}
        .fnc-dh td{padding:4px 0}.fnc-dh td.l{color:#6e747c;padding-right:22px}.fnc-dh td.v{font-weight:700}.fnc-dh td.v.neg{color:#b02a37}
        .fnc-dbanner{background:#f4f6f8;color:#6e747c;font-size:11px;font-weight:800;letter-spacing:.05em;padding:6px 10px;margin:6px 0 8px}
        .fnc-dt{width:100%;border-collapse:collapse;font-size:12.5px}
        .fnc-dt th{text-align:left;color:#6e747c;font-size:11px;font-weight:800;border-bottom:1px solid #dde2e6;padding:6px 8px;white-space:nowrap}
        .fnc-dt th.r,.fnc-dt td.r{text-align:right;font-variant-numeric:tabular-nums}
        .fnc-dt td{border-bottom:1px solid #eef1f3;padding:6px 8px;white-space:nowrap}
        .fnc-dt td.neg{color:#b02a37}
      `;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="fnc-head"><div>
        <h1>Foreman Net Cash Closings</h1>
        <p>Every job a foreman confirms in Money Flow is grouped into a batch, closed once, and archived as a PDF statement. <b>Pending</b> is each foreman's next batch; <b>History</b> is every closing sent.</p>
      </div></div>
      <div id="fncBody"><div class="fnc-load">Loading closings…</div></div>`;

    var S = window.__FNC || (window.__FNC = { view: "pending", dense: "details", q: "", open: {}, hopen: {}, copen: {}, _jobs: {} });
    if (!S.dense) S.dense = "details";

    var data;
    try {
      data = await fetch(ZTZ.API + "/api/_fnc", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
      if (data.error) throw new Error(data.error);
    } catch (e) {
      document.getElementById("fncBody").innerHTML = '<div class="fnc-load">Couldn’t load — ' + esc(String(e.message || e)) + "</div>"; return;
    }

    function money(v) { if (v == null) return "—"; var n = Math.round(v); return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("en-US"); }
    function money2(v) { if (v == null) return "—"; return (v < 0 ? "-$" : "$") + Math.abs(Math.round(v * 100) / 100).toLocaleString("en-US"); }
    function fmtD(v) { if (!v) return "—"; var d = new Date(String(v).slice(0, 10) + "T12:00:00"); return isNaN(d) ? String(v).slice(0, 10) : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    function fmtTs(v) { return v ? String(v).slice(0, 16).replace("T", " ") : "—"; }
    function balCls(b) { return (b || 0) > 0.5 ? "fnc-neg" : (b || 0) < -0.5 ? "fnc-pos" : ""; }
    function fmtCountdown(nextIso) {
      if (!nextIso) return "—";
      var ms = new Date(nextIso) - new Date();
      if (ms <= 0) return "any moment";
      var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
      return (h > 0 ? h + "h " : "") + m + "m " + (s % 60) + "s";
    }
    function autoStatusHtml() {
      return data.auto_on
        ? '⏱ Automatic run in <b id="fncCd">' + fmtCountdown(data.next_auto) + "</b>"
        : '<span style="color:var(--faint)">Automatic closing is off — runs only when you press the button</span>';
    }

    function calUrl(j) {
      if (!j.event_id || !j.calendar_id) return null;
      try { return "https://calendar.google.com/calendar/u/0/r/event?eid=" + btoa(j.event_id + " " + j.calendar_id).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
      catch (e) { return null; }
    }
    function docCell(j) { return j.contract_url ? '<a class="fnc-doc" href="' + esc(j.contract_url) + '" target="_blank" rel="noopener">Open ↗</a>' : '<span style="color:var(--faint)">—</span>'; }
    function calCell(j) { var u = calUrl(j); return u ? '<a class="fnc-doc" href="' + esc(u) + '" target="_blank" rel="noopener">Open ↗</a>' : '<span style="color:var(--faint)">—</span>'; }

    var det = function () { return S.dense === "details"; };

    // every pending closing job is confirmed by definition — a green Status pill, mirroring
    // Money Flow's "Received" pill so the two tables read identically.
    function statusPill() { return '<span class="fnc-pill conf">✓ Confirmed</span>'; }
    // the per-foreman batch actions, shown in the Action column of the FOREMAN row
    function fmActions(name) {
      var prev = '<button class="fnc-mini" data-fnc-prev="' + esc(name) + '">Preview</button>';
      var close = data.can_run ? '<button class="fnc-mini go" data-fnc-close="' + esc(name) + '">Close now</button>' : "";
      return '<div class="fnc-act">' + prev + close + "</div>";
    }

    // job sub-rows — columns 1:1 with the Money Flow foreman view (his ask 2026-07-22). The
    // Action cell is blank on jobs; the batch's Preview/Close live on the foreman row.
    function jobRow(j) {
      var cust = '<td title="' + esc(j.customer || "") + '">' + esc(j.customer || "—") + "</td>";
      if (det()) {
        return '<tr class="fnc-jrow"><td></td>'
          + "<td>" + fmtD(j.job_date) + "</td>"
          + "<td>" + esc(j.job_no || j.job_code || "—") + "</td>"
          + cust
          + '<td class="r">' + money(j.net_cash) + "</td>"
          + '<td class="r">' + (j.advance ? money(j.advance) : "—") + "</td>"
          + '<td class="r">' + (j.deduction ? money(j.deduction) : "—") + "</td>"
          + '<td class="r">' + money(j.confirmed) + "</td>"
          + '<td class="r ' + balCls(j.balance) + '">' + money(j.balance) + "</td>"
          + "<td>" + fmtTs(j.submit_time) + "</td>"
          + "<td>" + docCell(j) + "</td>"
          + "<td>" + calCell(j) + "</td>"
          + "<td>" + statusPill() + "</td>"
          + "<td></td></tr>";
      }
      return '<tr class="fnc-jrow"><td></td>'
        + "<td>" + fmtD(j.job_date) + "</td>"
        + cust
        + '<td class="r ' + balCls(j.balance) + '">' + money(j.balance) + "</td>"
        + "<td>" + docCell(j) + "</td>"
        + "<td>" + calCell(j) + "</td>"
        + "<td>" + statusPill() + "</td>"
        + "<td></td></tr>";
    }

    // column grids — copied 1:1 from Money Flow's Balance-by-Foreman view so the two systems
    // are identical (widths, headers, order). 14 cols in Details, 8 in Compact.
    function plan() {
      return det() ? {
        cols: '<colgroup><col style="width:2.5%"><col style="width:7%"><col style="width:5%"><col style="width:8.5%">'
            + '<col style="width:6.5%"><col style="width:8%"><col style="width:8.5%"><col style="width:7.5%">'
            + '<col style="width:8.5%"><col style="width:8.5%"><col style="width:5.5%"><col style="width:5.5%">'
            + '<col style="width:8%"><col style="width:10.5%"></colgroup>',
        head: "<th></th><th>Job date</th><th>Job #</th><th>Customer</th>"
            + '<th class="r">Net Cash</th><th class="r">Advance Payment</th>'
            + '<th class="r">Forman Deduction</th><th class="r">Net Cash Flow</th>'
            + '<th class="r">Net Cash Balance</th><th>Submission Time</th>'
            + "<th>Contract</th><th>Calendar</th><th>Status</th><th>Action</th>",
        n: 14
      } : {
        cols: '<colgroup><col style="width:3%"><col style="width:12%"><col style="width:22%"><col style="width:15%">'
            + '<col style="width:10%"><col style="width:10%"><col style="width:13%"><col style="width:15%"></colgroup>',
        head: '<th></th><th>Job date</th><th>Customer</th><th class="r">Net Cash Balance</th>'
            + "<th>Contract</th><th>Calendar</th><th>Status</th><th>Action</th>",
        n: 8
      };
    }

    // foreman header row — a SUBTOTAL under every numeric column (his ask), and the batch's
    // Preview/Close in the Action column. Subtotals sum the visible jobs so they always
    // reconcile with the rows below.
    function fmRow(p, open) {
      var name = p.foreman, meta = p.n_jobs + " job" + (p.n_jobs === 1 ? "" : "s");
      var caret = '<span class="fnc-caret">' + (open ? "▾" : "▸") + "</span>";
      var sum = function (k) { return (p.jobs || []).reduce(function (a, j) { return a + (j[k] || 0); }, 0); };
      var tNet = sum("net_cash"), tAdv = sum("advance"), tDed = sum("deduction"),
          tFlow = sum("confirmed"), tBal = sum("balance");
      if (det()) {
        return '<tr class="fnc-fmrow" data-fk="' + esc(name) + '">'
          + '<td colspan="4">' + caret + esc(name) + '<span class="fnc-meta">' + meta + "</span></td>"
          + '<td class="r">' + money(tNet) + "</td>"
          + '<td class="r">' + money(tAdv) + "</td>"
          + '<td class="r">' + money(tDed) + "</td>"
          + '<td class="r">' + money(tFlow) + "</td>"
          + '<td class="r ' + balCls(tBal) + '">' + money(tBal) + "</td>"
          + '<td colspan="4"></td>'
          + "<td>" + fmActions(name) + "</td></tr>";
      }
      return '<tr class="fnc-fmrow" data-fk="' + esc(name) + '">'
        + '<td colspan="3">' + caret + esc(name) + '<span class="fnc-meta">' + meta + "</span></td>"
        + '<td class="r ' + balCls(tBal) + '">' + money(tBal) + "</td>"
        + '<td colspan="3"></td>'
        + "<td>" + fmActions(name) + "</td></tr>";
    }

    function paint() {
      var pend = data.pending || [], hist = data.history || [];
      var q = S.q.trim().toLowerCase();
      var pendJobs = pend.reduce(function (a, p) { return a + p.n_jobs; }, 0);
      var pendCash = pend.reduce(function (a, p) { return a + (p.total_net_cash || 0); }, 0);

      var kp = '<div class="fnc-kpis">'
        + '<div class="fnc-kpi"><b>' + pend.length + '</b><span>Foremen pending</span><small>have confirmed jobs to close</small></div>'
        + '<div class="fnc-kpi"><b>' + pendJobs + '</b><span>Jobs pending</span><small>' + money(pendCash) + ' net cash</small></div>'
        + '<div class="fnc-kpi pos"><b>' + hist.length.toLocaleString() + '</b><span>Closings to date</span><small>archived statements</small></div>'
        + '<div class="fnc-kpi"><b>' + hist.reduce(function (a, h) { return a + h.n_jobs; }, 0).toLocaleString() + '</b><span>Jobs settled</span><small>each closed once</small></div></div>';

      var segBtn = function (id, label, n) { return '<button class="' + (S.view === id ? "on" : "") + '" data-fncv="' + id + '">' + label + "<i>" + n + "</i></button>"; };
      var dBtn = function (id, label) { return '<button class="' + (S.dense === id ? "on" : "") + '" data-fncd="' + id + '">' + label + "</button>"; };
      var bar = '<div class="fnc-bar"><div class="fnc-seg">'
        + segBtn("pending", "Pending", pend.length) + segBtn("history", "History", hist.length) + "</div>"
        + '<div class="fnc-seg fnc-dseg">' + dBtn("details", "Details") + dBtn("overview", "Compact") + "</div>"
        + '<input class="fnc-q" id="fncQ" placeholder="Search foreman" value="' + esc(S.q) + '">'
        + (S.view === "pending" ? '<div class="fnc-auto" id="fncAuto">' + autoStatusHtml() + "</div>"
             + (data.can_run ? '<button class="fnc-run" id="fncRunAll">Run closings now</button>' : "") : "")
        + "</div>";

      var P = plan();
      var content;
      if (S.view === "pending") {
        var rows = pend.filter(function (p) { return !q || String(p.foreman || "").toLowerCase().indexOf(q) >= 0; });
        var body = rows.map(function (p) {
          var open = !!S.open[p.foreman];
          return fmRow(p, open) + (open ? p.jobs.map(jobRow).join("") : "");
        }).join("");
        content = '<div class="fnc-card"><div class="fnc-wrap"><table class="fnc-tbl fx' + (det() ? " det" : "") + '">'
          + P.cols + "<thead><tr>" + P.head + "</tr></thead><tbody>"
          + (body || '<tr><td colspan="' + P.n + '" style="color:var(--faint);padding:18px">Nothing pending — every confirmed job is closed. 🎉</td></tr>')
          + "</tbody></table></div>"
          + '<div class="fnc-note">Click a foreman to see the jobs in his next batch. These close automatically on the next scheduled run once go-live is on.</div></div>';
      } else {
        // History grouped by foreman: foreman → his closings (with PDF + drill to jobs)
        var byFm = {};
        hist.forEach(function (h) { (byFm[h.foreman] = byFm[h.foreman] || []).push(h); });
        var names = Object.keys(byFm).filter(function (f) { return !q || f.toLowerCase().indexOf(q) >= 0; });
        names.sort();
        var hbody = names.map(function (f) {
          var closings = byFm[f], open = !!S.hopen[f];
          var jobs = closings.reduce(function (a, c) { return a + c.n_jobs; }, 0);
          var head = '<tr class="fnc-fmrow" data-hk="' + esc(f) + '">'
            + '<td colspan="2"><span class="fnc-caret">' + (open ? "▾" : "▸") + "</span>" + esc(f)
            + '<span class="fnc-meta">' + closings.length + " closing" + (closings.length === 1 ? "" : "s") + " · " + jobs + " jobs</span></td>"
            + '<td class="r">' + money(closings.reduce(function (a, c) { return a + c.total_net_cash; }, 0)) + "</td>"
            + '<td colspan="4"></td></tr>';
          var sub = "";
          if (open) {
            sub = closings.map(function (c) {
              var src = c.source === "sheet-import" ? '<span class="fnc-pill imp">imported</span>' : c.source === "auto" ? '<span class="fnc-pill auto">auto</span>' : '<span class="fnc-pill">' + esc(c.source || "") + "</span>";
              var crow = '<tr class="fnc-row" data-hc="' + c.id + '">'
                + "<td>" + fmtD(c.date_from) + " → " + fmtD(c.date_to) + "</td>"
                + '<td class="r">' + c.n_jobs + "</td>"
                + '<td class="r">' + money(c.total_net_cash) + "</td>"
                + '<td class="r">' + money(c.total_confirmed) + "</td>"
                + '<td class="r ' + balCls(c.balance) + '">' + money(c.balance) + "</td>"
                + "<td>" + src + "</td>"
                + "<td>" + (c.statement_url ? '<a class="fnc-doc" href="' + esc(c.statement_url) + '" target="_blank" rel="noopener">PDF ↗</a>' : '<span style="color:var(--faint)">—</span>') + "</td></tr>";
              var jr = "";
              if (S.copen[c.id]) {
                var jobsData = S._jobs[c.id];
                jr = '<tr><td colspan="7" style="padding:0 0 8px 20px;background:var(--panel-2)"><table class="fnc-tbl" style="min-width:0;table-layout:auto;background:var(--panel);border:1px solid var(--line-2);border-radius:10px">'
                  + '<thead><tr><th>Job date</th><th>Job code</th><th>Customer</th><th class="r">Net Cash</th><th class="r">Confirmed</th><th class="r">Balance</th></tr></thead><tbody>'
                  + (jobsData ? jobsData.map(function (j) { return "<tr><td>" + fmtD(j.job_date) + "</td><td>" + esc(j.job_code) + '</td><td title="' + esc(j.customer || "") + '">' + esc(j.customer || "—") + '</td><td class="r">' + money2(j.net_cash) + '</td><td class="r">' + money2(j.confirmed) + '</td><td class="r ' + balCls(j.balance) + '">' + money2(j.balance) + "</td></tr>"; }).join("") : '<tr><td colspan="6" style="color:var(--faint);padding:10px">Loading…</td></tr>')
                  + "</tbody></table></td></tr>";
              }
              return crow + jr;
            }).join("");
          }
          return head + sub;
        }).join("");
        content = '<div class="fnc-card"><div class="fnc-wrap"><table class="fnc-tbl fx" style="min-width:1040px">'
          + '<colgroup><col style="width:24%"><col style="width:8%"><col style="width:14%"><col style="width:14%"><col style="width:13%"><col style="width:13%"><col style="width:14%"></colgroup>'
          + '<thead><tr><th>Foreman / Period</th><th class="r">Jobs</th><th class="r">Net Cash</th><th class="r">Confirmed</th><th class="r">Balance</th><th>Source</th><th>Statement</th></tr></thead><tbody>'
          + (hbody || '<tr><td colspan="7" style="color:var(--faint);padding:18px">No closings yet.</td></tr>')
          + "</tbody></table></div>"
          + '<div class="fnc-note">Every closing, grouped by foreman. Click a foreman to see his closings; click a closing to see its jobs, or open its PDF statement.</div></div>';
      }

      var wrap0 = document.querySelector("#fncBody .fnc-wrap");
      var wt = wrap0 ? wrap0.scrollTop : 0, wl = wrap0 ? wrap0.scrollLeft : 0;
      var sy = window.scrollY;
      document.getElementById("fncBody").innerHTML = kp + bar + content;
      wire();
      var wrap1 = document.querySelector("#fncBody .fnc-wrap");
      if (wrap1) { wrap1.scrollTop = wt; wrap1.scrollLeft = wl; }
      window.scrollTo(window.scrollX, sy);

      // live countdown to the next automatic run (updates the #fncCd span each second)
      if (window.__FNC_TICK) clearInterval(window.__FNC_TICK);
      window.__FNC_TICK = setInterval(function () {
        if (!document.getElementById("fncBody")) { clearInterval(window.__FNC_TICK); return; }
        var el = document.getElementById("fncCd");
        if (el) el.textContent = fmtCountdown(data.next_auto);
      }, 1000);
    }

    // PREVIEW — a white, PDF-styled modal built from the foreman's pending batch, so the
    // user sees exactly how the archived statement will look before it's generated.
    function openPreview(name) {
      var p = (data.pending || []).filter(function (x) { return x.foreman === name; })[0];
      if (!p) return;
      var today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      var vneg = function (x) { return x < 0 ? " neg" : ""; };
      var jobsHtml = p.jobs.map(function (j) {
        return "<tr><td>" + esc(j.job_code || "-") + "</td><td>" + fmtD(j.job_date)
          + '</td><td>' + esc(j.customer || "-") + "</td><td>" + esc(j.submit_time || "")
          + '</td><td class="r">' + money2(j.net_cash) + '</td><td class="r">' + (j.advance ? money2(j.advance) : "-")
          + '</td><td class="r">' + (j.deduction ? money2(j.deduction) : "-") + '</td><td class="r">' + money2(j.confirmed)
          + '</td><td class="r' + (Math.abs(j.balance) > 0.01 ? " neg" : "") + '">' + money2(j.balance) + "</td></tr>";
      }).join("");
      var m = document.createElement("div");
      m.className = "fnc-back"; m.id = "fncPrevBack";
      m.innerHTML = '<div class="fnc-doc-modal"><button class="fnc-mx" id="fncPrevX">✕</button>'
        + '<div class="fnc-doc-title">Foreman Weekly Net Cash Closing</div><div class="fnc-doc-body">'
        + '<div class="fnc-dh"><table>'
        + '<tr><td class="l">Foreman</td><td class="v">' + esc(p.foreman) + "</td></tr>"
        + '<tr><td class="l">Email</td><td class="v">' + esc(p.email || "-") + "</td></tr>"
        + '<tr><td class="l">Date To</td><td class="v">' + today + "</td></tr>"
        + '<tr><td class="l">Number of Jobs</td><td class="v">' + p.n_jobs + "</td></tr></table><table>"
        + '<tr><td class="l">Total Net Cash</td><td class="v">' + money2(p.total_net_cash) + "</td></tr>"
        + '<tr><td class="l">Total Advance</td><td class="v' + vneg(p.total_advance) + '">' + money2(p.total_advance) + "</td></tr>"
        + '<tr><td class="l">Total Deduction</td><td class="v">' + money2(p.total_deduction) + "</td></tr>"
        + '<tr><td class="l">Total Confirmed</td><td class="v' + vneg(p.total_confirmed) + '">' + money2(p.total_confirmed) + "</td></tr>"
        + '<tr><td class="l">Final Balance</td><td class="v' + vneg(p.balance) + '">' + money2(p.balance) + "</td></tr></table></div>"
        + '<div class="fnc-dbanner">DETAILED BREAKDOWN</div>'
        + '<table class="fnc-dt"><thead><tr><th>Job Code</th><th>Job Date</th><th>Customer</th><th>Submit Time</th><th class="r">Net Cash</th><th class="r">Advance</th><th class="r">Deduction</th><th class="r">Confirmed</th><th class="r">Balance</th></tr></thead><tbody>'
        + jobsHtml + "</tbody></table>"
        + '<div style="margin-top:12px;font-size:11px;color:#9aa0a6">Preview — this is how the archived PDF statement will look. Amounts in USD.</div>'
        + "</div></div>";
      document.body.appendChild(m);
      m.onclick = function (e) { if (e.target === m) m.remove(); };
      document.getElementById("fncPrevX").onclick = function () { m.remove(); };
    }

    // MANUAL RUN — POST to the bridge, which invokes the pipeline to close (force=true).
    async function doRun(foreman, btn) {
      var orig = btn ? btn.textContent : "";
      if (btn) { btn.disabled = true; btn.textContent = foreman ? "Closing…" : "Running…"; }
      try {
        var body = { action: "run" };
        if (foreman) body.foreman = foreman;
        var res = await fetch(ZTZ.API + "/api/_fnc", { method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
          body: JSON.stringify(body) });
        var j = await res.json().catch(function () { return {}; });
        if (!res.ok || !j.ok) throw new Error(j.error || ("HTTP " + res.status));
        data = await fetch(ZTZ.API + "/api/_fnc", { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
        paint();
      } catch (e) {
        if (btn) { btn.disabled = false; btn.textContent = "Failed — retry"; setTimeout(function () { btn.textContent = orig; }, 3000); }
      }
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll("[data-fncv]"), function (b) { b.onclick = function () { S.view = b.getAttribute("data-fncv"); paint(); }; });
      Array.prototype.forEach.call(host.querySelectorAll("[data-fncd]"), function (b) { b.onclick = function () { S.dense = b.getAttribute("data-fncd"); paint(); }; });
      var q = host.querySelector("#fncQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = host.querySelector("#fncQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      Array.prototype.forEach.call(host.querySelectorAll("a.fnc-doc"), function (a) { a.onclick = function (e) { e.stopPropagation(); }; });
      // manual-run controls
      var runAll = host.querySelector("#fncRunAll");
      if (runAll) runAll.onclick = function () {
        var n = (data.pending || []).length;
        if (!n) return;
        if (confirm("Close " + n + " pending foreman" + (n === 1 ? "" : "s") + " now? This generates their statements and archives the PDFs. (No emails are sent.)"))
          doRun(null, runAll);
      };
      Array.prototype.forEach.call(host.querySelectorAll("[data-fnc-prev]"), function (b) {
        b.onclick = function (e) { e.stopPropagation(); openPreview(b.getAttribute("data-fnc-prev")); };
      });
      Array.prototype.forEach.call(host.querySelectorAll("[data-fnc-close]"), function (b) {
        b.onclick = function (e) {
          e.stopPropagation();
          var f = b.getAttribute("data-fnc-close");
          if (confirm("Close " + f + "'s batch now? This generates his statement and archives the PDF. (No email is sent.)"))
            doRun(f, b);
        };
      });
      Array.prototype.forEach.call(host.querySelectorAll("tr[data-fk]"), function (tr) { tr.onclick = function () { var f = tr.getAttribute("data-fk"); S.open[f] = !S.open[f]; paint(); }; });
      Array.prototype.forEach.call(host.querySelectorAll("tr[data-hk]"), function (tr) { tr.onclick = function () { var f = tr.getAttribute("data-hk"); S.hopen[f] = !S.hopen[f]; paint(); }; });
      Array.prototype.forEach.call(host.querySelectorAll("tr[data-hc]"), function (tr) {
        tr.onclick = async function () {
          var id = tr.getAttribute("data-hc");
          S.copen[id] = !S.copen[id]; paint();
          if (S.copen[id] && !S._jobs[id]) {
            try {
              var j = await fetch(ZTZ.API + "/api/_fnc?report=" + encodeURIComponent(id), { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
              S._jobs[id] = j.jobs || [];
              if (S.copen[id]) paint();
            } catch (e) {}
          }
        };
      });
    }

    paint();
  },
});
