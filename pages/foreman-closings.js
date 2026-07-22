/* FOREMAN NET CASH CLOSINGS — the weekly batch-settlement monitor (LOGISTICS group).
   Rebuilds his "Forman Weekly Closing" Google Sheet: whatever a foreman CONFIRMED in Money
   Flow since his last closing is grouped into one batch; the pipeline auto-closes on a
   schedule (when the go-live flag is on) and archives a PDF statement to Drive. This page is
   READ-ONLY (delivery is parked): it shows each foreman's PENDING next batch and the full
   HISTORY of past closings, with drill-down to the jobs and the PDF links. Data: /api/_fnc. */

registerPage({
  id: "foreman-closings",
  group: "logistics",
  title: "Foreman Closings",
  async render(host) {
    var esc = RSC.esc;
    var POS = "#1c7a4a", NEG = "#b02a37", BLUE = "#2f6fd0", MUT = "var(--faint)";

    if (!document.getElementById("fncCss")) {
      var st = document.createElement("style"); st.id = "fncCss";
      st.textContent = `
        .fnc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .fnc-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.4px}
        .fnc-head p{margin:4px 0 0;font-size:12.5px;color:var(--muted);max-width:720px}
        .fnc-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:14px}
        .fnc-kpi{background:var(--panel);border:1px solid var(--line-2);border-radius:12px;padding:12px 14px}
        .fnc-kpi b{display:block;font-size:21px;font-weight:800;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
        .fnc-kpi span{display:block;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint);margin-top:2px}
        .fnc-kpi small{display:block;font-size:10.5px;color:var(--faint);margin-top:2px}
        .fnc-kpi.pos b{color:${POS}}
        .fnc-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
        .fnc-seg{display:inline-flex;background:var(--panel-2);border:1px solid var(--line-2);border-radius:11px;padding:3px}
        .fnc-seg button{border:0;background:transparent;color:var(--muted);cursor:pointer;font:inherit;font-size:13.5px;font-weight:800;padding:8px 18px;border-radius:8px}
        .fnc-seg button.on{background:var(--brand);color:var(--brand-ink)}
        .fnc-seg button i{font-style:normal;font-weight:800;font-size:11px;opacity:.75;margin-left:6px}
        .fnc-q{font:inherit;font-size:13px;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;min-width:240px;flex:1;max-width:420px}
        .fnc-card{background:var(--panel);border:1px solid var(--line-2);border-radius:14px;overflow:hidden;position:relative}
        .fnc-wrap{overflow-x:auto}
        .fnc-tbl{width:100%;border-collapse:collapse;font-size:13.5px;table-layout:fixed;min-width:940px}
        .fnc-tbl th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);font-weight:800;padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap}
        .fnc-tbl th.r,.fnc-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .fnc-tbl td{padding:11px 12px;border-bottom:1px solid var(--line);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .fnc-tbl tbody tr.fnc-fmrow{cursor:pointer}
        .fnc-tbl tbody tr.fnc-fmrow:hover{background:var(--panel-2)}
        .fnc-fmrow td{font-weight:700}
        .fnc-caret{color:var(--faint);font-size:11px;display:inline-block;width:14px}
        .fnc-meta{font-size:12px;font-weight:600;color:var(--faint);margin-left:8px}
        .fnc-sub>td{background:var(--panel-2);padding:0 0 14px 22px}
        .fnc-sub table{background:var(--panel);border:1px solid var(--line-2);border-radius:10px;margin-top:2px}
        .fnc-neg{color:${NEG};font-weight:700} .fnc-pos{color:${POS};font-weight:700}
        .fnc-doc{font-size:12.5px;font-weight:800;color:${BLUE};text-decoration:none;white-space:nowrap}
        .fnc-doc:hover{text-decoration:underline}
        .fnc-pill{display:inline-block;font-size:11px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;background:var(--panel-2);color:var(--faint)}
        .fnc-pill.auto{background:rgba(28,122,74,.12);color:${POS}} .fnc-pill.imp{background:rgba(47,111,208,.12);color:${BLUE}}
        .fnc-note{padding:10px 14px;font-size:11px;color:var(--faint);border-top:1px solid var(--line)}
        .fnc-load{padding:40px;text-align:center;color:var(--faint)}
      `;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="fnc-head"><div>
        <h1>Foreman Net Cash Closings</h1>
        <p>Every job a foreman confirms in Money Flow is grouped into a batch, closed once, and archived as a PDF statement. <b>Pending</b> shows each foreman's next batch; <b>History</b> is every closing sent.</p>
      </div></div>
      <div id="fncBody"><div class="fnc-load">Loading closings…</div></div>`;

    var S = window.__FNC || (window.__FNC = { view: "pending", q: "", open: {}, hist: {} });

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
    function balCls(b) { return (b || 0) > 0.5 ? "fnc-neg" : (b || 0) < -0.5 ? "fnc-pos" : ""; }

    var JOBCOLS = '<colgroup><col style="width:15%"><col style="width:14%"><col style="width:22%"><col style="width:12%"><col style="width:12%"><col style="width:11%"><col style="width:14%"></colgroup>';
    var JOBHEAD = '<th>Job code</th><th>Job date</th><th>Customer</th><th class="r">Net Cash</th><th class="r">Advance</th><th class="r">Deduction</th><th class="r">Balance</th>';
    function jobRows(jobs) {
      return jobs.map(function (j) {
        return "<tr><td>" + esc(j.job_code || "—") + "</td><td>" + fmtD(j.job_date)
          + '</td><td title="' + esc(j.customer || "") + '">' + esc(j.customer || "—") + "</td>"
          + '<td class="r">' + money2(j.net_cash) + "</td>"
          + '<td class="r">' + (j.advance ? money2(j.advance) : "—") + "</td>"
          + '<td class="r">' + (j.deduction ? money2(j.deduction) : "—") + "</td>"
          + '<td class="r ' + balCls(j.balance) + '">' + money2(j.balance) + "</td></tr>";
      }).join("");
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
      var bar = '<div class="fnc-bar"><div class="fnc-seg">'
        + segBtn("pending", "Pending", pend.length) + segBtn("history", "History", hist.length) + "</div>"
        + '<input class="fnc-q" id="fncQ" placeholder="Search foreman" value="' + esc(S.q) + '"></div>';

      var content;
      if (S.view === "pending") {
        var rows = pend.filter(function (p) { return !q || String(p.foreman || "").toLowerCase().indexOf(q) >= 0; });
        var body = rows.map(function (p) {
          var open = !!S.open[p.foreman];
          var head = '<tr class="fnc-fmrow" data-fncx="' + esc(p.foreman) + '">'
            + '<td colspan="3"><span class="fnc-caret">' + (open ? "▾" : "▸") + "</span>" + esc(p.foreman)
            + '<span class="fnc-meta">' + p.n_jobs + " job" + (p.n_jobs === 1 ? "" : "s") + "</span></td>"
            + '<td class="r">' + money(p.total_net_cash) + "</td>"
            + '<td class="r">' + money(p.total_confirmed) + "</td>"
            + '<td class="r ' + balCls(p.balance) + '">' + money(p.balance) + "</td>"
            + "<td></td></tr>";
          var sub = "";
          if (open) {
            sub = '<tr class="fnc-sub"><td colspan="7"><table class="fnc-tbl" style="min-width:0">' + JOBCOLS
              + "<thead><tr>" + JOBHEAD + "</tr></thead><tbody>" + jobRows(p.jobs) + "</tbody></table></td></tr>";
          }
          return head + sub;
        }).join("");
        content = '<div class="fnc-card"><div class="fnc-wrap"><table class="fnc-tbl">'
          + '<colgroup><col style="width:16%"><col style="width:12%"><col style="width:14%"><col style="width:15%"><col style="width:15%"><col style="width:15%"><col style="width:13%"></colgroup>'
          + '<thead><tr><th colspan="3">Foreman</th><th class="r">Net Cash</th><th class="r">Confirmed</th><th class="r">Balance</th><th></th></tr></thead><tbody>'
          + (body || '<tr><td colspan="7" style="color:var(--faint);padding:18px">Nothing pending — every confirmed job is closed. 🎉</td></tr>')
          + "</tbody></table></div>"
          + '<div class="fnc-note">These jobs will be closed automatically on the next scheduled run (when go-live is on). Click a foreman to see the jobs in his next batch.</div></div>';
      } else {
        var hrows = hist.filter(function (h) { return !q || String(h.foreman || "").toLowerCase().indexOf(q) >= 0; });
        var hbody = hrows.map(function (h) {
          var open = !!S.hist[h.id];
          var src = h.source === "sheet-import" ? '<span class="fnc-pill imp">imported</span>'
                  : h.source === "auto" ? '<span class="fnc-pill auto">auto</span>'
                  : '<span class="fnc-pill">' + esc(h.source || "") + "</span>";
          var head = '<tr class="fnc-fmrow" data-fnch="' + h.id + '">'
            + '<td><span class="fnc-caret">' + (open ? "▾" : "▸") + "</span>" + esc(h.foreman) + "</td>"
            + "<td>" + fmtD(h.date_from) + " → " + fmtD(h.date_to) + "</td>"
            + '<td class="r">' + h.n_jobs + "</td>"
            + '<td class="r">' + money(h.total_net_cash) + "</td>"
            + '<td class="r">' + money(h.total_confirmed) + "</td>"
            + '<td class="r ' + balCls(h.balance) + '">' + money(h.balance) + "</td>"
            + "<td>" + src + "</td>"
            + "<td>" + (h.statement_url ? '<a class="fnc-doc" href="' + esc(h.statement_url) + '" target="_blank" rel="noopener">PDF ↗</a>' : '<span style="color:var(--faint)">—</span>') + "</td></tr>";
          var sub = "";
          if (open) {
            var jr = S._jobs && S._jobs[h.id];
            sub = '<tr class="fnc-sub"><td colspan="8"><table class="fnc-tbl" style="min-width:0">' + JOBCOLS
              + "<thead><tr>" + JOBHEAD + "</tr></thead><tbody>"
              + (jr ? jobRows(jr) : '<tr><td colspan="7" style="color:var(--faint);padding:12px">Loading jobs…</td></tr>')
              + "</tbody></table></td></tr>";
          }
          return head + sub;
        }).join("");
        content = '<div class="fnc-card"><div class="fnc-wrap"><table class="fnc-tbl" style="min-width:1040px">'
          + '<colgroup><col style="width:15%"><col style="width:20%"><col style="width:7%"><col style="width:12%"><col style="width:12%"><col style="width:11%"><col style="width:11%"><col style="width:9%"></colgroup>'
          + '<thead><tr><th>Foreman</th><th>Period</th><th class="r">Jobs</th><th class="r">Net Cash</th><th class="r">Confirmed</th><th class="r">Balance</th><th>Source</th><th>Statement</th></tr></thead><tbody>'
          + (hbody || '<tr><td colspan="8" style="color:var(--faint);padding:18px">No closings yet.</td></tr>')
          + "</tbody></table></div>"
          + '<div class="fnc-note">Every closing ever sent, newest first. Click a row to see its jobs; open the PDF statement on the right.</div></div>';
      }

      var sx = window.scrollX, sy = window.scrollY;
      document.getElementById("fncBody").innerHTML = kp + bar + content;
      wire();
      window.scrollTo(sx, sy);
    }

    function wire() {
      Array.prototype.forEach.call(host.querySelectorAll("[data-fncv]"), function (b) {
        b.onclick = function () { S.view = b.getAttribute("data-fncv"); paint(); };
      });
      var q = host.querySelector("#fncQ");
      if (q) q.oninput = function () { S.q = q.value; var pos = q.selectionStart; paint(); var n2 = host.querySelector("#fncQ"); if (n2) { n2.focus(); try { n2.setSelectionRange(pos, pos); } catch (e) {} } };
      Array.prototype.forEach.call(host.querySelectorAll("tr[data-fncx]"), function (tr) {
        tr.onclick = function () { var f = tr.getAttribute("data-fncx"); S.open[f] = !S.open[f]; paint(); };
      });
      Array.prototype.forEach.call(host.querySelectorAll("tr[data-fnch]"), function (tr) {
        tr.onclick = async function () {
          var id = tr.getAttribute("data-fnch");
          S.hist[id] = !S.hist[id]; paint();
          if (S.hist[id] && !(S._jobs && S._jobs[id])) {
            try {
              var j = await fetch(ZTZ.API + "/api/_fnc?report=" + encodeURIComponent(id), { headers: { "Authorization": "Bearer " + ZTZ.getToken() } }).then(function (r) { return r.json(); });
              S._jobs = S._jobs || {}; S._jobs[id] = j.jobs || [];
              if (S.hist[id]) paint();
            } catch (e) {}
          }
        };
      });
    }

    paint();
  },
});
