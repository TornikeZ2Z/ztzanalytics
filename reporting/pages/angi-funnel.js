/* MARKETING page: Angi Lead Funnel — every Angi lead, from arrival to outcome.
 *
 * Built for Angi's own request (2026-08-26): lead-level funnel data so they can find where
 * their leads fall through. The page is the working view; the CSV is what actually goes to
 * them.
 *
 * BUILT ON THE SHARED KIT, not on its own vocabulary. The first cut hand-rolled .agf-bar /
 * .agf-fld / .agf-src at values a few pixels off the kit's, which is exactly how a page ends
 * up looking foreign on a portal where every other page shares one bar and one table. It now
 * uses .rs-bar / .rs-fld / .rs-sel / .rs-inp / .rs-tablewrap / .rs-table / .rs-pill, so it
 * inherits the hover and focus states those carry — the hand-rolled selects had neither.
 * Page CSS below is only what is genuinely specific to this page.
 *
 * ITS OWN FILTERS, NOT THE GLOBAL BAR. Registered with no datasets in the shell's map, so the
 * portal-wide slicers are hidden. They would be wrong here in both directions: half of them
 * (Foreman, Size of Move as the shell defines it) do not apply to a LEAD, and the ones that do
 * would not offer the cuts Angi actually asked about — status, response speed, ZIP, outcome.
 * So the toolbar is the questions this page exists to answer.
 *
 * NO VERBATIM CUSTOMER SPEECH, his ruling. Angi asked for "call or CRM notes"; the mart reads
 * the RingSense summaries and reduces each to a short tag before anything is stored, so the
 * pattern travels and the conversation does not. The `Reason Source` marker says whether a
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
  var S = { rows: [], f: {}, page: 0, per: 50, all: false };

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

  /* 250 rows share a customer and a date with another row — 99 of them one lead sitting in
     BOTH Moveboard accounts, the rest one customer entered several times in one account.
     Collapsing them moves the lead count AND the close rate, so the choice is a control the
     reader makes and can see, not a decision taken quietly in a build script. Default is
     every row, because that is what the warehouse actually holds. */
  var DUPE_MODES = [
    ["", "All rows"],
    ["primary", "One per customer/day"],
    ["dupes", "Duplicates only"],
  ];

  /* Angi's taxonomy, toned. "Closed lost" is deliberately MUTE rather than bad: it is 7,615 of
     10,962 rows, and painting two thirds of a table red says nothing except that most leads do
     not book, which is what a close rate is for. */
  var STATUS_TONE = {
    "Closed won": "ok",
    "Contacted": "info",
    "Not contacted": "warn",
    "Closed lost": "mute",
  };

  function injectStyle() {
    var old = document.getElementById("agf-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "agf-style";
    /* Page-specific only. Everything structural — bar, field, select, input, button, table,
       pill — comes from rs.css and must NOT be redeclared here. */
    st.textContent = ""
      // the search box wants room for "Name, ZIP or lead ID…" without truncating the placeholder
      + ".agf .rs-inp{min-width:210px}"
      // a 14-column table over 10,962 rows: cap the scroller so the sticky header has a
      // scrolling ancestor to stick against, and keep columns from crushing on a narrow window
      + ".agf .rs-tablewrap{max-height:calc(100vh - var(--pg-chrome,420px));min-height:280px}"
      + ".agf .rs-table{min-width:1240px}"
      // the reason-source marker rides INSIDE a cell beside the reason, so it steps down from a
      // standalone pill rather than competing with the status pill in the column beside it
      + ".agf .rs-pill.src{font-size:9.5px;padding:2px 7px;margin-left:7px;letter-spacing:.06em;"
      + "vertical-align:1px}"
      // the pager: kit buttons, kit tokens, sitting under the scroller inside the same panel
      + ".agf-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;"
      + "padding:11px 2px 0;font-size:12.5px;color:var(--muted)}"
      + ".agf-foot .rs-btn{padding:5px 11px;font-size:12.5px}"
      + ".agf-pg{display:inline-flex;align-items:center;gap:8px}"
      + ".agf-pg b{font-weight:800;color:var(--ink);min-width:62px;text-align:center;"
      + "font-variant-numeric:tabular-nums}"
      + ".agf-empty{padding:26px 14px;text-align:center;color:var(--faint);font-size:13px}";
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
    var untracked = view.length - tracked.length;
    var dupes = view.filter(function (r) { return !+r["Dup Primary"]; }).length;
    var revenue = won.reduce(function (a, r) { return a + (num(r["Revenue"]) || 0); }, 0);
    var pc = function (n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "—"; };

    var opts = function (key) {
      var seen = {};
      S.rows.forEach(function (r) {
        var v = r[key] == null ? "" : String(r[key]);
        if (v) seen[v] = (seen[v] || 0) + 1;
      });
      return Object.keys(seen).sort().map(function (v) {
        return '<option value="' + esc(v) + '"' + (S.f[key] === v ? " selected" : "") + ">"
          + esc(v) + " · " + fmtN(seen[v]) + "</option>";
      }).join("");
    };

    host.innerHTML = '<div class="agf">'
      + '<div class="rs-page-head"><h1>Angi Lead Funnel</h1>'
      + "<p>Every Angi lead from arrival to outcome — the lead-level detail Angi asked for.</p>"
      + "</div>"

      + '<div class="rs-kpis" id="agfKpis"></div>'

      + '<div class="rs-bar">'
      + FILTERS.map(function (f) {
          return '<label class="rs-fld"><span>' + esc(f[1]) + "</span>"
            + '<select class="rs-sel" data-k="' + esc(f[0]) + '"><option value="">All</option>'
            + opts(f[0]) + "</select></label>";
        }).join("")
      + '<label class="rs-fld"><span>Duplicate leads</span>'
      + '<select class="rs-sel" id="agfDupe">'
      + DUPE_MODES.map(function (m) {
          return '<option value="' + esc(m[0]) + '"'
            + ((S.f._dupe || "") === m[0] ? " selected" : "") + ">" + esc(m[1]) + "</option>";
        }).join("")
      + "</select></label>"
      + '<label class="rs-fld"><span>Find</span>'
      + '<input class="rs-inp" id="agfQ" placeholder="Name, ZIP or lead ID…" value="'
      + esc(S.f._q || "") + '"></label>'
      + '<span class="rs-spacer"></span>'
      + '<button class="rs-btn" id="agfClear">Clear filters</button>'
      + '<button class="rs-btn pri" id="agfCsv">Download CSV · ' + fmtN(view.length) + "</button>"
      + "</div>"

      + '<div class="panel"><div class="panel-head">'
      + '<div class="panel-title">Leads</div>'
      + '<span class="rs-pill mute">' + fmtN(view.length) + "</span></div>"

      + '<div class="rs-hint"><b>Contact is not the bottleneck</b> — we reach '
      + pc(connected.length, tracked.length) + " of the leads we can see. The gap is the mix: "
      + "studios and urban ZIPs convert far below the rest. A reason drawn from a recorded call "
      + 'is marked <span class="rs-pill ok src">call</span>; the rest come from our CRM status '
      + '<span class="rs-pill mute src">crm</span>, which is weaker evidence.'
      + (untracked
          ? " Call tracking starts <b>1 Mar 2025</b>; the " + fmtN(untracked)
            + " leads before it have no call record, are not counted as unreached, and read "
            + "<b>No call record</b> rather than <i>Never called</i>."
          : "")
      + (dupes
          ? " " + fmtN(dupes) + " row" + (dupes === 1 ? " shares" : "s share")
            + " a customer and a date with another — one lead landing in <b>both Moveboard "
            + "accounts</b> (Zip to Zip and Tuji), or one customer entered twice in one. "
            + "Nothing is dropped; switch <b>Duplicate leads</b> above for the deduplicated count."
          : "")
      + "</div>"

      + '<div class="rs-tablewrap" id="agfTbl"><table class="rs-table"><thead><tr>'
      + "<th>Received</th><th>Lead</th><th>Customer</th><th>ZIP</th><th>State</th>"
      + "<th>Size</th><th>Status</th><th>Furthest stage</th><th>Reason</th>"
      + '<th class="num nowrap">Mins to call</th><th class="num">Attempts</th>'
      + '<th>Connected</th><th class="num">Revenue</th><th>Rep</th>'
      + "</tr></thead><tbody></tbody></table></div>"
      + '<div class="agf-foot" data-foot></div></div>'
      + "</div>";

    /* RSC.kpis balances the grid itself — six items become one row of six, where the hardcoded
       four left three cards and a hole. */
    RSC.kpis(host.querySelector("#agfKpis"), [
      { label: "Leads", value: fmtN(view.length),
        sub: view.length === S.rows.length ? "all Angi leads"
                                           : "of " + fmtN(S.rows.length) + " · filtered" },
      { label: "Contacted", value: pc(connected.length, tracked.length), tone: "pos",
        sub: fmtN(connected.length) + " of " + fmtN(tracked.length) + " tracked" },
      { label: "Closed won", value: fmtN(won.length), sub: "booked jobs" },
      { label: "Close rate", value: pc(won.length, view.length), sub: "of leads shown",
        tone: (won.length / Math.max(view.length, 1)) < 0.05 ? "neg" : "" },
      { label: "Revenue", value: money0(revenue), sub: "from closed won" },
      { label: "No call record", value: fmtN(untracked), tone: untracked ? "warn" : "",
        sub: "before call tracking began" },
    ]);

    var rowsHtml = view.slice().sort(function (a, b) {
      return String(b["Received At"] || "").localeCompare(String(a["Received At"] || ""));
    }).map(function (r) {
      var src = String(r["Reason Source"] || "");
      var st = String(r["Angi Status"] || "");
      var reason = r["Reason"];
      return "<tr>"
        + '<td class="nowrap muted">' + esc(String(r["Received At"] || "").slice(0, 16)) + "</td>"
        + '<td class="strong nowrap">' + esc(r["Lead ID"]) + "</td>"
        + "<td>" + esc(r["Customer"] || "—") + "</td>"
        + '<td class="nowrap">' + esc(r["Zip"] || "—") + "</td>"
        + '<td class="nowrap muted">' + esc(r["State"] || "—") + "</td>"
        + '<td class="muted">' + esc(r["Size of Move"] || "—") + "</td>"
        + "<td>" + (st ? '<span class="rs-pill ' + (STATUS_TONE[st] || "mute") + '">'
                         + esc(st) + "</span>" : '<span class="dim">—</span>') + "</td>"
        + '<td class="muted nowrap">' + esc(r["Furthest Stage"] || "—") + "</td>"
        + (reason
            ? "<td>" + esc(reason)
              + (src === "call" || src === "crm"
                  ? '<span class="rs-pill ' + (src === "call" ? "ok" : "mute") + ' src">'
                    + esc(src) + "</span>"
                  : "") + "</td>"
            : '<td class="dim">—</td>')
        + '<td class="num' + (r["Mins To First Call"] == null ? " dim" : "") + '">'
          + (r["Mins To First Call"] == null ? "—" : fmtN(r["Mins To First Call"])) + "</td>"
        + '<td class="num' + (+r["Call Attempts"] ? "" : " dim") + '">'
          + fmtN(r["Call Attempts"] || 0) + "</td>"
        + '<td class="' + (+r["Ever Connected"] ? "" : "dim") + '">'
          + (+r["Ever Connected"] ? "Yes" : "No") + "</td>"
        + '<td class="num' + (r["Revenue"] == null ? " dim" : "") + '">'
          + (r["Revenue"] == null ? "—" : money0(num(r["Revenue"]))) + "</td>"
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
    host.querySelector("#agfClear").onclick = function () {
      S.f = {}; S.page = 0; S.all = false; paint(host);
    };
    host.querySelector("#agfCsv").onclick = function () { downloadCsv(view); };

    // measure the scroller so the sticky header has a real ancestor height to stick against
    if (window.RSC && RSC.fitScroller) RSC.fitScroller(host.querySelector("#agfTbl"));
  }

  function paginate(host, rowsHtml) {
    var mount = host.querySelector("#agfTbl");
    var tbody = mount.querySelector("tbody");
    // the footer sits OUTSIDE the scrolling wrapper so it does not scroll away sideways,
    // so it is found on the panel rather than inside the mount
    var foot = mount.parentElement.querySelector("[data-foot]");
    var per = S.per;
    var pages = Math.max(1, Math.ceil(rowsHtml.length / per));
    function draw() {
      if (S.page >= pages) S.page = 0;
      tbody.innerHTML = (S.all ? rowsHtml
        : rowsHtml.slice(S.page * per, S.page * per + per)).join("")
        || '<tr><td colspan="14" class="agf-empty">Nothing matches these filters.</td></tr>';
      if (rowsHtml.length <= per) {
        foot.innerHTML = rowsHtml.length
          ? "<span>" + RS.fmtN(rowsHtml.length) + " lead"
            + (rowsHtml.length === 1 ? "" : "s") + "</span>"
          : "";
        return;
      }
      var from = S.all ? 1 : S.page * per + 1;
      var to = S.all ? rowsHtml.length : Math.min(rowsHtml.length, S.page * per + per);
      foot.innerHTML = "<span>" + RS.fmtN(from) + "–" + RS.fmtN(to) + " of "
        + RS.fmtN(rowsHtml.length) + "</span>"
        + (S.all ? "" : '<span class="agf-pg">'
            + '<button class="rs-btn" data-prev ' + (S.page === 0 ? "disabled" : "") + ">‹ Prev</button>"
            + "<b>" + (S.page + 1) + " / " + pages + "</b>"
            + '<button class="rs-btn" data-next ' + (S.page >= pages - 1 ? "disabled" : "") + ">Next ›</button>"
            + "</span>")
        + '<span class="rs-spacer"></span>'
        + '<button class="rs-btn" data-all>' + (S.all ? "Paginate" : "Show all") + "</button>";
      var pv = foot.querySelector("[data-prev]");
      if (pv) pv.onclick = function () { if (S.page > 0) { S.page--; draw(); } };
      var nx = foot.querySelector("[data-next]");
      if (nx) nx.onclick = function () { if (S.page < pages - 1) { S.page++; draw(); } };
      var al = foot.querySelector("[data-all]");
      if (al) al.onclick = function () { S.all = !S.all; S.page = 0; draw(); };
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
