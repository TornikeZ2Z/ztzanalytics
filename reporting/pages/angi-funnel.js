/* MARKETING page: Angi Lead Funnel — every Angi lead, from arrival to outcome.
 *
 * Built for Angi's own request (2026-08-26): lead-level funnel data so they can find where
 * their leads fall through. The page is the working view; the CSV is what actually goes to
 * them.
 *
 * ITS OWN FILTERS, NOT THE GLOBAL BAR. Registered with no datasets in the shell's map, so the
 * portal-wide slicers are hidden. They would be wrong here in both directions: half of them
 * (Foreman, Size of Move as the shell defines it) do not apply to a LEAD, and the ones that do
 * would not offer the cuts Angi actually asked about — status, response speed, ZIP, outcome.
 * So the toolbar is the questions this page exists to answer.
 *
 * NO VERBATIM CUSTOMER SPEECH, his ruling. Angi asked for "call or CRM notes"; the mart reads
 * the RingSense summaries and reduces each to a short tag before anything is stored, so the
 * pattern travels and the conversation does not. The `Reason Source` column says whether a
 * reason came from a call or merely from our CRM status, because those are not equally strong
 * and a reader should not have to guess which they are looking at.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.angi_lead) {
    RS.DATASETS.angi_lead = {
      table: "mart_angi_lead",
      cols: ["Lead ID", "Customer", "Zip", "Moving From", "Moving To", "State", "County",
             "Service Type", "Size of Move", "Received At", "Received Date", "Received Month",
             "Our Status", "Our Category", "Angi Status", "Furthest Stage", "Reason",
             "Reason Source", "Est Quote", "Revenue", "Move Date", "Sales Rep",
             "First Called At", "First Connected At", "Mins To First Call", "Speed Bucket",
             "Call Attempts", "Ever Connected", "Texted", "Call Tracked",
             "Company", "Dup Count", "Dup Primary"],
    };
  }
})();

(function () {
  var S = { rows: [], f: {}, page: 0, per: 50 };

  var FILTERS = [
    ["Received Month", "Month"],
    ["Angi Status", "Status"],
    ["Size of Move", "Size of move"],
    ["State", "State"],
    ["Speed Bucket", "Response speed"],
    ["Reason", "Reason / outcome"],
    ["Sales Rep", "Sales rep"],
    ["Company", "Account"],
  ];

  /* 250 rows share a customer and a date with another row -- 99 of them one lead sitting in
     BOTH Moveboard accounts, the rest one customer entered several times in one account.
     Collapsing them moves the lead count AND the close rate, so the choice is a control the
     reader makes and can see, not a decision taken quietly in a build script. Default is
     every row, because that is what the warehouse actually holds. */
  var DUPE_MODES = [
    ["", "All rows"],
    ["primary", "One per customer/day"],
    ["dupes", "Duplicates only"],
  ];

  function injectStyle() {
    var old = document.getElementById("agf-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "agf-style";
    st.textContent = ""
      + ".agf{font-variant-numeric:tabular-nums}"
      + ".agf .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".agf .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".agf .rs-kpis .kpi.warn .v{color:var(--warn)}"
      + ".agf-bar{display:flex;flex-wrap:wrap;gap:9px;align-items:flex-end;margin:2px 0 14px}"
      + ".agf-fld{display:flex;flex-direction:column;gap:3px}"
      + ".agf-fld span{font-size:10px;font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".agf-fld select,.agf-fld input{font:inherit;font-size:13px;padding:7px 10px;"
      + "border:1px solid var(--line-2);border-radius:9px;background:var(--panel);"
      + "color:var(--ink);min-width:150px}"
      + ".agf-sp{flex:1 1 auto}"
      + ".agf-foot{display:flex;align-items:center;gap:12px;padding:9px 2px 2px;"
      + "font-size:12px;color:var(--muted)}"
      + ".agf-foot .rs-btn{padding:4px 10px;font-size:12px}"
      + ".agf-pg{display:inline-flex;align-items:center;gap:8px}"
      + ".agf-pg b{font-weight:700;color:var(--ink);min-width:56px;text-align:center}"
      + ".agf-src{font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;"
      + "border-radius:999px;padding:1px 6px;margin-left:5px}"
      + ".agf-src.call{color:var(--pos);background:var(--pos-bg)}"
      + ".agf-src.crm{color:var(--faint);background:var(--panel-2)}"
      + ".agf .rs-table{min-width:1500px}";
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function match(r) {
    for (var k in S.f) {
      if (!S.f[k]) continue;
      if (k === "_dupe") {
        if (S.f._dupe === "primary" && !+r["Dup Primary"]) return false;
        if (S.f._dupe === "dupes" && +r["Dup Count"] < 2) return false;
      } else if (k === "_q") {
        var q = S.f._q.toLowerCase();
        var hay = [r["Customer"], r["Zip"], r["Lead ID"], r["Moving From"], r["Moving To"]]
          .join(" ").toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      } else if (String(r[k] == null ? "" : r[k]) !== S.f[k]) return false;
    }
    return true;
  }

  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Reading Angi leads…</div>';
    RS.load("angi_lead").then(function (d) {
      S.rows = (d && (d.rows || d)) || [];
      paint(host);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load — ' + esc(e.message) + "</div>";
    });
  }

  function paint(host) {
    var num = RS.num, fmtN = RS.fmtN, money = RS.money;
    var money0 = function (v) { return (v == null || isNaN(v)) ? "—" : money(v, 0); };
    var view = S.rows.filter(match);

    var won = view.filter(function (r) { return r["Angi Status"] === "Closed won"; });
    var connected = view.filter(function (r) { return +r["Ever Connected"]; });
    /* CONTACT RATE DIVIDES BY TRACKED LEADS, NOT ALL LEADS. Call tracking starts 2025-03-01,
       so 1,655 of these have no call record — nothing was recording, which is not the same as
       nobody rang them. Divided by everything the rate reads 72% and invites Angi to conclude
       we ignored a quarter of their leads. Divided by what we can actually see, it is 84%. */
    var tracked = view.filter(function (r) { return +r["Call Tracked"]; });
    var dupes = view.filter(function (r) { return !+r["Dup Primary"]; }).length;
    var revenue = won.reduce(function (a, r) { return a + (num(r["Revenue"]) || 0); }, 0);
    var pc = function (n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "—"; };
    var kpi = function (l, v, s, cls) {
      return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(l) + "</div>"
        + '<div class="v">' + esc(v) + '</div><div class="s">' + esc(s || "") + "</div></div>";
    };

    var opts = function (key) {
      var seen = {};
      S.rows.forEach(function (r) {
        var v = r[key] == null ? "" : String(r[key]);
        if (v) seen[v] = (seen[v] || 0) + 1;
      });
      return Object.keys(seen).sort().map(function (v) {
        return '<option value="' + esc(v) + '"' + (S.f[key] === v ? " selected" : "") + ">"
          + esc(v) + " (" + fmtN(seen[v]) + ")</option>";
      }).join("");
    };

    host.innerHTML = '<div class="agf">'
      + '<div class="rs-page-head"><h1>Angi Lead Funnel</h1>'
      + "<p>Every Angi lead from arrival to outcome — the lead-level detail Angi asked for. "
      + "<b>Contact is not the bottleneck</b>: we reach most of them. The gap is the mix — "
      + "studios and urban ZIPs convert far below the rest. Reasons drawn from a recorded call "
      + "are marked <b>call</b>; the rest come from our CRM status.</p></div>"

      + '<div class="agf-bar">'
      + FILTERS.map(function (f) {
          return '<label class="agf-fld"><span>' + esc(f[1]) + "</span>"
            + '<select data-k="' + esc(f[0]) + '"><option value="">All</option>'
            + opts(f[0]) + "</select></label>";
        }).join("")
      + '<label class="agf-fld"><span>Duplicate leads</span>'
      + '<select id="agfDupe">'
      + DUPE_MODES.map(function (m) {
          return '<option value="' + esc(m[0]) + '"'
            + ((S.f._dupe || "") === m[0] ? " selected" : "") + ">" + esc(m[1]) + "</option>";
        }).join("")
      + '</select></label>'
      + '<label class="agf-fld"><span>Search</span>'
      + '<input id="agfQ" placeholder="name, ZIP, lead ID…" value="' + esc(S.f._q || "") + '"></label>'
      + '<span class="agf-sp"></span>'
      + '<label class="agf-fld"><span>&nbsp;</span>'
      + '<button class="rs-btn" id="agfClear">Clear filters</button></label>'
      + '<label class="agf-fld"><span>&nbsp;</span>'
      + '<button class="rs-btn pri" id="agfCsv">Download CSV</button></label>'
      + "</div>"

      + '<div class="rs-kpis" style="--kpi-cols:4">'
      + kpi("Leads", fmtN(view.length),
            view.length === S.rows.length ? "all Angi leads" : "of " + fmtN(S.rows.length) + " filtered")
      + kpi("Contacted", pc(connected.length, tracked.length),
            fmtN(connected.length) + " of " + fmtN(tracked.length) + " tracked", "pos")
      + kpi("Closed won", fmtN(won.length), "booked jobs")
      + kpi("Close rate", pc(won.length, view.length), "of leads shown",
            (won.length / Math.max(view.length, 1)) < 0.05 ? "neg" : "")
      + kpi("Revenue", money0(revenue), "from closed won")
      + kpi("No call record", fmtN(view.length - tracked.length),
            "before call tracking began", (view.length - tracked.length) ? "warn" : "")
      + kpi("Duplicate rows", fmtN(dupes), "same customer, same day", dupes ? "warn" : "")
      + "</div>"
      + (view.length - tracked.length
          ? '<div class="rs-hint">Call tracking starts <b>1 Mar 2025</b>. The '
            + fmtN(view.length - tracked.length) + " leads before it have no call record — "
            + "they are not counted as unreached, and their stage reads "
            + "<b>No call record</b> rather than <i>Never called</i>.</div>"
          : "")
      + (dupes
          ? '<div class="rs-hint">' + fmtN(dupes) + " row"
            + (dupes === 1 ? " shares" : "s share") + " a customer and a date with another — "
            + "one lead landing in <b>both Moveboard accounts</b> (Zip to Zip and Tuji), or one "
            + "customer entered twice in one. Nothing is dropped; switch "
            + "<b>Duplicate leads</b> above to see the deduplicated count.</div>"
          : "")

      + '<div class="panel"><div class="panel-head">'
      + '<div class="panel-title">Leads</div></div>'
      + '<div class="rs-tablewrap" id="agfTbl"><table class="rs-table"><thead><tr>'
      + "<th>Received</th><th>Lead</th><th>Customer</th><th>ZIP</th><th>State</th>"
      + "<th>Size</th><th>Status</th><th>Furthest stage</th><th>Reason</th>"
      + '<th class="num">Mins to call</th><th class="num">Attempts</th>'
      + "<th>Connected</th><th class=\"num\">Revenue</th><th>Rep</th>"
      + "</tr></thead><tbody></tbody></table></div>"
      + '<div class="agf-foot" data-foot></div></div>'
      + "</div>";

    var rowsHtml = view.slice().sort(function (a, b) {
      return String(b["Received At"] || "").localeCompare(String(a["Received At"] || ""));
    }).map(function (r) {
      var src = String(r["Reason Source"] || "");
      return "<tr><td class=\"nowrap\">" + esc(String(r["Received At"] || "").slice(0, 16)) + "</td>"
        + '<td class="strong">' + esc(r["Lead ID"]) + "</td>"
        + "<td>" + esc(r["Customer"] || "—") + "</td>"
        + '<td class="nowrap">' + esc(r["Zip"] || "—") + "</td>"
        + '<td class="nowrap muted">' + esc(r["State"] || "—") + "</td>"
        + '<td class="nowrap muted">' + esc(r["Size of Move"] || "—") + "</td>"
        + "<td>" + esc(r["Angi Status"] || "—") + "</td>"
        + '<td class="muted">' + esc(r["Furthest Stage"] || "—") + "</td>"
        + "<td>" + esc(r["Reason"] || "—")
          + (src ? '<span class="agf-src ' + esc(src) + '">' + esc(src) + "</span>" : "") + "</td>"
        + '<td class="num">' + (r["Mins To First Call"] == null ? "—" : fmtN(r["Mins To First Call"])) + "</td>"
        + '<td class="num">' + fmtN(r["Call Attempts"] || 0) + "</td>"
        + "<td>" + (+r["Ever Connected"] ? "Yes" : "No") + "</td>"
        + '<td class="num">' + (r["Revenue"] == null ? "—" : money0(num(r["Revenue"]))) + "</td>"
        + '<td class="nowrap muted">' + esc(r["Sales Rep"] || "—") + "</td></tr>";
    });

    paginate(host, rowsHtml);

    host.querySelectorAll("select[data-k]").forEach(function (sel) {
      sel.onchange = function () { S.f[sel.dataset.k] = sel.value; S.page = 0; paint(host); };
    });
    host.querySelector("#agfDupe").onchange = function () {
      S.f._dupe = this.value; S.page = 0; paint(host);
    };
    var q = host.querySelector("#agfQ");
    q.oninput = function () {
      S.f._q = this.value; S.page = 0;
      var at = this.selectionStart;
      paint(host);
      var n = host.querySelector("#agfQ");
      if (n) { n.focus(); n.setSelectionRange(at, at); }
    };
    host.querySelector("#agfClear").onclick = function () { S.f = {}; S.page = 0; paint(host); };
    host.querySelector("#agfCsv").onclick = function () { downloadCsv(view); };
  }

  function paginate(host, rowsHtml) {
    var mount = host.querySelector("#agfTbl");
    var tbody = mount.querySelector("tbody");
    // the footer sits OUTSIDE the scrolling wrapper so it does not scroll away sideways,
    // so it is found on the panel rather than inside the mount
    var foot = mount.parentElement.querySelector("[data-foot]");
    var per = S.per, all = false;
    var pages = Math.max(1, Math.ceil(rowsHtml.length / per));
    function draw() {
      if (S.page >= pages) S.page = 0;
      tbody.innerHTML = (all ? rowsHtml
        : rowsHtml.slice(S.page * per, S.page * per + per)).join("")
        || '<tr><td colspan="14" style="padding:16px;color:var(--faint)">Nothing matches these filters.</td></tr>';
      if (rowsHtml.length <= per) {
        foot.innerHTML = "<span>" + RS.fmtN(rowsHtml.length) + " lead"
          + (rowsHtml.length === 1 ? "" : "s") + "</span>";
        return;
      }
      var from = all ? 1 : S.page * per + 1;
      var to = all ? rowsHtml.length : Math.min(rowsHtml.length, S.page * per + per);
      foot.innerHTML = "<span>" + RS.fmtN(from) + "–" + RS.fmtN(to) + " of "
        + RS.fmtN(rowsHtml.length) + "</span>"
        + (all ? "" : '<span class="agf-pg">'
            + '<button class="rs-btn" data-prev ' + (S.page === 0 ? "disabled" : "") + ">‹</button>"
            + "<b>" + (S.page + 1) + " / " + pages + "</b>"
            + '<button class="rs-btn" data-next ' + (S.page >= pages - 1 ? "disabled" : "") + ">›</button>"
            + "</span>")
        + '<button class="rs-btn" data-all>' + (all ? "Paginate" : "Show all") + "</button>";
      var pv = foot.querySelector("[data-prev]");
      if (pv) pv.onclick = function () { if (S.page > 0) { S.page--; draw(); } };
      var nx = foot.querySelector("[data-next]");
      if (nx) nx.onclick = function () { if (S.page < pages - 1) { S.page++; draw(); } };
      var al = foot.querySelector("[data-all]");
      if (al) al.onclick = function () { all = !all; S.page = 0; draw(); };
    }
    draw();
  }

  /* THE FILE THAT ACTUALLY GOES TO ANGI. It exports what is ON SCREEN, filters and all, so a
     narrowed view is a narrowed file and nobody sends ten thousand rows meaning to send one
     ZIP. Still no verbatim speech: the Reason column is the tag, never the sentence. */
  function downloadCsv(view) {
    var cols = ["Lead ID", "Customer", "Zip", "Moving From", "Moving To", "State", "County",
      "Service Type", "Size of Move", "Received At", "First Called At", "First Connected At",
      "Mins To First Call", "Speed Bucket", "Call Attempts", "Ever Connected", "Texted",
      "Call Tracked", "Company", "Dup Count", "Dup Primary",
      "Angi Status", "Furthest Stage", "Our Status", "Reason", "Reason Source",
      "Est Quote", "Revenue", "Move Date", "Sales Rep"];
    var cell = function (x) {
      var s = String(x == null ? "" : x);
      // a value opening as a live formula executes in Excel, and this file is going outside
      if (/^[=+\-@]/.test(s)) s = " " + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var lines = [cols.map(cell).join(",")].concat(view.map(function (r) {
      return cols.map(function (c) {
        if (c === "Ever Connected" || c === "Texted" || c === "Call Tracked")
          return cell(+r[c] ? "Yes" : "No");
      if (c === "Dup Primary") return cell(+r[c] ? "Primary" : "Duplicate");
        return cell(r[c]);
      }).join(",");
    }));
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Angi lead funnel (" + view.length + " leads).csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  if (window.registerPage) {
    registerPage({
      id: "angi-funnel",
      group: "marketing",
      title: "Angi Lead Funnel",
      render: render,
    });
  }
})();
