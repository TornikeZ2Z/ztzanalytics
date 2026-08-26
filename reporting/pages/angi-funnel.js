/* MARKETING page: Angi Lead Funnel — every Angi lead, from arrival to outcome.
 *
 * Built for Angi's own request (2026-08-26): lead-level funnel data so they can find where
 * their leads fall through. The page is the working view; the CSV is what actually goes to
 * them.
 *
 * BUILT ON THE SHARED KIT, not on its own vocabulary. The first cut hand-rolled .agf-bar /
 * .agf-fld / .agf-src at values a few pixels off the kit's, which is exactly how a page ends
 * up looking foreign on a portal where every other page shares one bar and one table. It now
 * uses .rs-bar / .rs-fld / .rs-sel / .rs-inp / .rs-tablewrap.rs-fit / .rs-table.rs-sticky
 * .rs-fixed / .rs-pill, so it inherits their hover, focus and pinning behaviour rather than
 * re-typing approximations of them.
 *
 * THE KIT DEFINES NO .kpi TONE RULE — that is a real gap, not an oversight to route around.
 * RSC.kpis emits the `tone` class and rs.css colours nothing, so every page carries its own
 * copy. cl-analysis.js declares its copy UN-NAMESPACED, which means this page's KPIs came out
 * green and red only for a reader who had opened CL Analysis earlier in the same session, and
 * plain black for anyone who landed here first. The rules below are namespaced under .agf so
 * they work here and leak nowhere.
 *
 * ITS OWN FILTERS, NOT THE GLOBAL BAR. Registered with no datasets in the shell's map, so the
 * portal-wide slicers are hidden. They would be wrong here in both directions: half of them
 * (Foreman, Size of Move as the shell defines it) do not apply to a LEAD, and the ones that do
 * would not offer the cuts Angi actually asked about — status, response speed, ZIP, outcome.
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
      cols: ["Lead ID", "Angi Lead ID", "Angi ID Match", "Customer", "Zip",
             "Moving From", "Moving To", "State", "County",
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
  var S = { rows: [], f: {}, page: 0, per: 50, opts: null };

  var FILTERS = [
    ["Received Month", "Month"],
    ["Angi Status", "Status"],
    ["Size of Move", "Size of move"],
    ["State", "State"],
    ["Speed Bucket", "Response speed"],
    ["Reason", "Reason / outcome"],
    ["Sales Rep", "Sales rep"],
    ["Company", "Account"],
    ["Angi ID Match", "Angi ID"],
  ];

  /* Column widths as PERCENTAGES, because .rs-fixed is table-layout:fixed and without a
     colgroup that means fifteen equal columns. Percentages rather than pixels so the table
     still fills a wide window and still honours --rs-tmin on a narrow one. Must sum to 100. */
  var COLS = [
    ["Received", 11, "nowrap"], ["Lead", 4.5, "nowrap"], ["Angi lead", 7.5, "nowrap"],
    ["Customer", 9, "wrap"], ["ZIP", 3.5, "nowrap"], ["State", 5.5, "nowrap"],
    ["Size", 6.5, "wrap"], ["Status", 9, "nowrap"], ["Furthest stage", 8, "wrap"],
    ["Reason", 10.5, "wrap"], ["Mins to call", 5, "num nowrap"], ["Attempts", 4, "num"],
    ["Connected", 4.5, ""], ["Revenue", 4.5, "num"], ["Rep", 7, "wrap"],
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
    /* Page-specific only, and every rule namespaced under .agf. Structural things — bar,
       field, select, input, button, table, pill — come from rs.css and are NOT redeclared. */
    st.textContent = ""
      // the sideways-scroll threshold for fifteen columns. A documented kit token, set per
      // page, which is the sanctioned way to move it (rs.css) rather than re-typing min-width.
      + ".agf{--rs-tmin:1364px}"
      // a floor so the scroller does not collapse to two rows when a filter bites hard. The
      // kit has no min-height and should not grow one.
      + ".agf .rs-tablewrap{min-height:280px}"
      /* .rs-fixed forces nowrap + ellipsis on EVERY cell, which would cut a reason in half and
         take its call/crm marker with it. The text-carrying columns wrap instead — the same
         thing the referral table does — so nothing is lost and the widths still never move. */
      + ".agf .rs-table.rs-fixed td.wrap{white-space:normal;overflow:visible;text-overflow:clip}"
      /* THE KIT COLOURS NO KPI TONE. Namespaced here so it works on this page and leaks to no
         other — unlike cl-analysis.js, whose un-namespaced copy is why these tiles used to be
         coloured only for a reader who had visited that page first. */
      + ".agf .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".agf .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".agf .rs-kpis .kpi.warn .v{color:var(--warn)}"
      // a second pill sharing a cell with text: spacing only, the kit owns its size and colour
      + ".agf .rs-pill.src{margin-left:7px}"
      // the pager. Confirmed the kit has no pagination component; cl-analysis.js is the only
      // sibling with a real one, and these are its metrics.
      + ".agf-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;"
      + "padding:11px 2px 0;font-size:12.5px;color:var(--muted)}"
      + ".agf-foot .rs-btn{padding:5px 11px;font-size:12.5px}"
      + ".agf-pg{display:inline-flex;align-items:center;gap:8px}"
      + ".agf-pg b{font-weight:800;color:var(--ink);min-width:62px;text-align:center;"
      + "font-variant-numeric:tabular-nums}"
      + ".agf-tip{font-size:11.5px;color:var(--faint)}"
      + ".agf-empty{padding:26px 14px;text-align:center;color:var(--faint);font-size:13px}";
    document.head.appendChild(st);
  }

  // RSC.esc escapes both quote characters; the local fallback exists only for the load-order
  // case where the kit has not arrived yet.
  function esc(s) {
    if (window.RSC && RSC.esc) return RSC.esc(s == null ? "" : s);
    return String(s == null ? "" : s).replace(/&/g, "&amp;")
      .replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function match(r) {
    for (var k in S.f) {
      if (!S.f[k]) continue;
      if (k === "_dupe") {
        if (S.f._dupe === "primary" && !+r["Dup Primary"]) return false;
        if (S.f._dupe === "dupes" && +r["Dup Count"] < 2) return false;
      } else if (k === "_q") {
        var q = S.f._q.toLowerCase();
        var hay = [r["Customer"], r["Zip"], r["Lead ID"], r["Angi Lead ID"],
                   r["Moving From"], r["Moving To"]].join(" ").toLowerCase();
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
      S.opts = null;
      paint(host);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load — ' + esc(e.message) + "</div>";
    });
  }

  /* The dropdown options depend on S.rows, which never changes after load — so they are built
     ONCE. They used to be rebuilt on every repaint, which meant nine full scans of eleven
     thousand rows per keystroke in the search box. */
  function optionHtml(key) {
    if (!S.opts) {
      S.opts = {};
      var counts = {};
      FILTERS.forEach(function (f) { counts[f[0]] = {}; });
      S.rows.forEach(function (r) {
        FILTERS.forEach(function (f) {
          var v = r[f[0]] == null ? "" : String(r[f[0]]);
          if (v) counts[f[0]][v] = (counts[f[0]][v] || 0) + 1;
        });
      });
      FILTERS.forEach(function (f) {
        S.opts[f[0]] = Object.keys(counts[f[0]]).sort().map(function (v) {
          return { v: v, n: counts[f[0]][v] };
        });
      });
    }
    return S.opts[key].map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (S.f[key] === o.v ? " selected" : "") + ">"
        + esc(o.v) + " · " + RS.fmtN(o.n) + "</option>";
    }).join("");
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
    var haveId = view.filter(function (r) { return r["Angi Lead ID"]; });
    var withId = haveId.length;
    /* How far Angi's own file reaches. It is a periodic manual drop -- at the time of writing
       it ran to 6 Aug while the warehouse was on the 26th -- so the NEWEST leads have no Angi
       id yet. The table is newest-first, which means page one is the worst-covered page on the
       whole dataset and reads as a broken join unless the page says otherwise. Derived from
       the data rather than stored, so it is right on its own the next time the file lands. */
    var angiThrough = haveId.reduce(function (a, r) {
      var d = String(r["Received Date"] || "").slice(0, 10);
      return d > a ? d : a;
    }, "");
    var revenue = won.reduce(function (a, r) { return a + (num(r["Revenue"]) || 0); }, 0);
    var pc = function (n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "—"; };

    host.innerHTML = '<div class="agf">'
      + '<div class="rs-page-head"><h1>Angi Lead Funnel</h1>'
      + "<p>Every Angi lead from arrival to outcome — the lead-level detail Angi asked for.</p>"
      + "</div>"

      + '<div class="rs-kpis" id="agfKpis"></div>'

      + '<div class="rs-bar">'
      + FILTERS.map(function (f) {
          return '<label class="rs-fld"><span>' + esc(f[1]) + "</span>"
            + '<select class="rs-sel" data-k="' + esc(f[0]) + '"><option value="">All</option>'
            + optionHtml(f[0]) + "</select></label>";
        }).join("")
      + '<label class="rs-fld"><span>Duplicate leads</span>'
      + '<select class="rs-sel" id="agfDupe">'
      + DUPE_MODES.map(function (m) {
          return '<option value="' + esc(m[0]) + '"'
            + ((S.f._dupe || "") === m[0] ? " selected" : "") + ">" + esc(m[1]) + "</option>";
        }).join("")
      + "</select></label>"
      + '<label class="rs-fld"><span>Find</span>'
      + '<input class="rs-inp" id="agfQ" placeholder="Name, ZIP, lead or Angi ID…" value="'
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
      + '<span class="rs-pill mute src">crm</span>, which is weaker evidence. '
      + "<b>" + pc(withId, view.length) + "</b> carry Angi's own lead number, so those rows can "
      + "be reconciled against their system."
      + (angiThrough
          ? " Angi's own file is a periodic drop and currently reaches <b>" + esc(angiThrough)
            + "</b>, so leads newer than that have no id yet — which is why the first page, "
            + "sorted newest-first, shows the fewest."
          : "")
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

      /* .rs-fit sizes the scroller to the VIEWPORT so the pinned header has a scrolling
         ancestor to stick against; .rs-sticky is required with it, because under
         border-collapse the header's border belongs to the table and does not travel with the
         sticky cell; .rs-fixed locks the columns so they stop resizing on every pager click. */
      + '<div class="rs-tablewrap rs-fit" id="agfTbl">'
      + '<table class="rs-table rs-sticky rs-fixed"><colgroup>'
      + COLS.map(function (c) { return '<col style="width:' + c[1] + '%">'; }).join("")
      + "</colgroup><thead><tr>"
      + COLS.map(function (c) {
          return "<th" + (/num/.test(c[2]) ? ' class="num nowrap"' : "") + ">"
            + esc(c[0]) + "</th>";
        }).join("")
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

    /* .dim is the kit's tone for an ABSENT value and rs.css says in as many words that it must
       not be borrowed for present ones. So a missing customer or ZIP is dim; a measured zero
       and a measured "No" are not — those are answers, not gaps. */
    var td = function (cls, html) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + html + "</td>"; };
    var val = function (cls, v) {
      return v == null || v === "" ? td((cls ? cls + " " : "") + "dim", "—") : td(cls, esc(v));
    };

    var rowsHtml = view.slice().sort(function (a, b) {
      return String(b["Received At"] || "").localeCompare(String(a["Received At"] || ""));
    }).map(function (r) {
      var src = String(r["Reason Source"] || "");
      var st = String(r["Angi Status"] || "");
      var mins = r["Mins To First Call"];
      return "<tr>"
        + val("nowrap muted", String(r["Received At"] || "").slice(0, 16))
        + val("strong nowrap", r["Lead ID"])
        // Angi's own number, with a marker when we could not pin it to exactly one of their
        // leads — a bare id would claim more certainty than the match carries
        + (r["Angi Lead ID"]
            ? td("nowrap", esc(r["Angi Lead ID"])
                + (r["Angi ID Match"] === "multiple"
                    ? '<span class="rs-pill warn src" title="this job matched more than one '
                      + 'Angi lead; the lowest id is shown">?</span>' : ""))
            : td("nowrap dim", "not in Angi’s file"))
        + val("wrap", r["Customer"])
        + val("nowrap", r["Zip"])
        + val("nowrap muted", r["State"])
        + val("wrap muted", r["Size of Move"])
        + td("nowrap", st ? '<span class="rs-pill ' + (STATUS_TONE[st] || "mute") + '">'
                            + esc(st) + "</span>" : "—")
        + val("wrap muted", r["Furthest Stage"])
        + (r["Reason"]
            ? td("wrap", esc(r["Reason"])
                + (src === "call" || src === "crm"
                    ? '<span class="rs-pill ' + (src === "call" ? "ok" : "mute") + ' src">'
                      + esc(src) + "</span>" : ""))
            : td("wrap dim", "—"))
        + (mins == null ? td("num dim", "—") : td("num", fmtN(mins)))
        + td("num", fmtN(r["Call Attempts"] || 0))
        + td("", +r["Ever Connected"] ? "Yes" : "No")
        + (r["Revenue"] == null ? td("num dim", "—") : td("num", money0(num(r["Revenue"]))))
        + val("wrap muted", r["Sales Rep"])
        + "</tr>";
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
      S.f = {}; S.page = 0; paint(host);
    };
    host.querySelector("#agfCsv").onclick = function () { downloadCsv(view); };

    // measure the scroller so .rs-fit's viewport height is this page's, not the CSS fallback
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
      tbody.innerHTML = rowsHtml.slice(S.page * per, S.page * per + per).join("")
        || '<tr><td colspan="' + COLS.length + '" class="agf-empty">'
           + "Nothing matches these filters.</td></tr>";
      if (rowsHtml.length <= per) {
        foot.innerHTML = rowsHtml.length
          ? "<span>" + RS.fmtN(rowsHtml.length) + " lead"
            + (rowsHtml.length === 1 ? "" : "s") + "</span>"
          : "";
        return;
      }
      /* NO "SHOW ALL". His call, and he is right: it put ten thousand rows into the DOM in one
         insert, which locks the tab and can take the page down. Narrow with the filters, or
         take the CSV — the download already carries everything the filters leave. */
      foot.innerHTML = "<span>" + RS.fmtN(S.page * per + 1) + "–"
        + RS.fmtN(Math.min(rowsHtml.length, S.page * per + per)) + " of "
        + RS.fmtN(rowsHtml.length) + "</span>"
        + '<span class="agf-pg">'
        + '<button class="rs-btn" data-first ' + (S.page === 0 ? "disabled" : "") + ">« First</button>"
        + '<button class="rs-btn" data-prev ' + (S.page === 0 ? "disabled" : "") + ">‹ Prev</button>"
        + "<b>" + RS.fmtN(S.page + 1) + " / " + RS.fmtN(pages) + "</b>"
        + '<button class="rs-btn" data-next ' + (S.page >= pages - 1 ? "disabled" : "") + ">Next ›</button>"
        + '<button class="rs-btn" data-last ' + (S.page >= pages - 1 ? "disabled" : "") + ">Last »</button>"
        + "</span>"
        + '<span class="rs-spacer"></span>'
        + '<span class="agf-tip">All ' + RS.fmtN(rowsHtml.length)
        + " rows are in the CSV — the download takes whatever the filters leave.</span>";
      var go = function (sel, next) {
        var b = foot.querySelector(sel);
        if (b) b.onclick = function () { S.page = next(); draw(); mount.scrollTop = 0; };
      };
      go("[data-first]", function () { return 0; });
      go("[data-prev]", function () { return Math.max(0, S.page - 1); });
      go("[data-next]", function () { return Math.min(pages - 1, S.page + 1); });
      go("[data-last]", function () { return pages - 1; });
    }
    draw();
  }

  /* THE FILE THAT ACTUALLY GOES TO ANGI. It exports what is ON SCREEN, filters and all, so a
     narrowed view is a narrowed file and nobody sends ten thousand rows meaning to send one
     ZIP. Still no verbatim speech: the Reason column is the tag, never the sentence. */
  function downloadCsv(view) {
    var cols = ["Lead ID", "Angi Lead ID", "Angi ID Match",
      "Customer", "Zip", "Moving From", "Moving To", "State", "County",
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
