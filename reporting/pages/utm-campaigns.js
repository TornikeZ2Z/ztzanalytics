/* MARKETING page: Website Forms & UTM — what the tagged links actually brought in.
 *
 * Tornike (2026-09-03): "the additional data it gives us - is the UTM TAGS we have done for
 * every link that exists ... in addition - lets add campaign and other stuff too so we can
 * have that information."
 *
 * ONE TABLE, `mart_web_form_lead`: one row per submission on the website form, matched to the
 * Moveboard lead it became, carrying the UTM tags of the page it was submitted from and the
 * lead's own outcome. The page never loads the 78k-row Moveboard dataset — the mart already
 * carries status and booking, so the campaign→booked question is answered without it.
 *
 * TWO THINGS THIS PAGE MUST NOT LET A READER BELIEVE, both stated on the page itself:
 *
 *  1. NO TAG IS NOT NO CAMPAIGN. Only 5.5% of submissions carry UTM tags — tagging is recent
 *     and partial. An untagged submission means the link was untagged, never that the visit
 *     was organic. So the campaign table counts only tagged rows and says so, rather than
 *     showing a giant "(none)" bucket that would read as the biggest campaign we run.
 *
 *  2. THERE IS NO SUBMISSION DATE. The export carries the customer's requested MOVE date and
 *     nothing else — no timestamp of the submission itself. Every month here is therefore the
 *     matched lead's Moveboard create date, which an unmatched submission simply does not
 *     have. Those rows sit under "No lead" and are excluded from any month, deliberately.
 *
 * Registered with no datasets in PAGE_DATASETS, so the portal-wide slicers stay hidden: the
 * global date filter runs on a date this table does not have.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.web_form_lead) {
    RS.DATASETS.web_form_lead = {
      table: "mart_web_form_lead",
      // payload contract: projection is always on, so a column missing here never arrives
      cols: ["Request Joinkey", "Match Rule", "Matched", "Form Dropdown", "Form Customer",
        "Form Email", "Form Phone", "Form Move Date", "Form Service Type",
        "Form From State", "Form To State",
        "UTM Source", "UTM Medium", "UTM Campaign", "UTM Content", "UTM Term",
        "UTM Landing Page", "Ad Campaign Id", "Paid Click", "Has UTM",
        "UTM Source Corrected", "UTM Won", "UTM Unmapped", "Moveboard Booked Source",
        "Lead Customer", "Lead Created", "Lead Status", "Lead Status Category", "Booked",
        "Lead Est Quote"],
    };
  }
})();

(function () {
  var S = { rows: [], f: {}, view: "campaign", page: 0, per: 50, opts: null };

  /* Page-specific ONLY, every rule namespaced under .wfu. Bar, field, select, input, button,
     table, pill, segmented control all come from rs.css and are not redeclared here. The two
     things the kit genuinely does not own are the KPI tone colours and a pager. */
  function injectStyle() {
    var old = document.getElementById("wfu-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "wfu-style";
    st.textContent = ""
      + ".wfu{--rs-tmin:1180px}"
      + ".wfu .rs-tablewrap{min-height:280px}"
      + ".wfu .rs-table.rs-fixed td.wrap{white-space:normal;overflow:visible;text-overflow:clip}"
      + ".wfu .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".wfu .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".wfu .rs-kpis .kpi.warn .v{color:var(--warn)}"
      + ".wfu-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;"
      + "padding:11px 2px 0;font-size:12.5px;color:var(--muted)}"
      + ".wfu-foot .rs-btn{padding:5px 11px;font-size:12.5px}"
      + ".wfu-foot b{font-weight:800;color:var(--ink);min-width:62px;text-align:center;"
      + "font-variant-numeric:tabular-nums}";
    document.head.appendChild(st);
  }

  var FILTERS = [
    ["_month", "Lead month"],
    ["UTM Source", "UTM source"],
    ["UTM Campaign", "Campaign"],
    ["UTM Medium", "Medium"],
    ["Moveboard Booked Source", "Booked source"],
    ["Lead Status Category", "Lead status"],
  ];

  var VIEWS = [["campaign", "By campaign"], ["submission", "Submissions"]];

  /* Percentages, because .rs-fixed is table-layout:fixed. Each set must sum to 100. */
  var CAMP_COLS = [
    ["Campaign", 20, "wrap"], ["UTM source", 12, "wrap"], ["Medium", 10, "wrap"],
    ["Resolved source", 13, "wrap"], ["Paid", 6, ""], ["Submissions", 8, "num"],
    ["Became a lead", 9, "num"], ["Booked", 7, "num"], ["Booking rate", 8, "num"],
    ["Decided the source", 7, "num"],
  ];
  var SUB_COLS = [
    ["Lead created", 9, "nowrap"], ["Customer", 12, "wrap"], ["Move date", 8, "nowrap"],
    ["Form said", 9, "wrap"], ["UTM source", 9, "wrap"], ["Medium", 7, "wrap"],
    ["Campaign", 13, "wrap"], ["Landing page", 10, "wrap"], ["Source on the lead", 10, "wrap"],
    ["Lead status", 8, "wrap"], ["Matched by", 5, "wrap"],
  ];

  function esc(s) {
    if (window.RSC && RSC.esc) return RSC.esc(s == null ? "" : s);
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  var mon = function (r) { return String(r["Lead Created"] || "").slice(0, 7); };

  function match(r) {
    for (var i = 0; i < FILTERS.length; i++) {
      var k = FILTERS[i][0], want = S.f[k];
      if (!want) continue;
      var got = k === "_month" ? mon(r) : (r[k] == null ? "" : String(r[k]));
      if (got !== want) return false;
    }
    if (S.f._tagged === "yes" && !+r["Has UTM"]) return false;
    if (S.f._tagged === "no" && +r["Has UTM"]) return false;
    if (S.f._lead === "yes" && !+r.Matched) return false;
    if (S.f._lead === "no" && +r.Matched) return false;
    var q = (S.f._q || "").trim().toLowerCase();
    if (q) {
      var hay = [r["Form Customer"], r["Lead Customer"], r["Form Email"], r["Form Phone"],
                 r["UTM Campaign"], r["UTM Source"], r["Request Joinkey"]]
        .join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }

  function optionHtml(key) {
    if (!S.opts) {
      S.opts = {};
      var counts = {};
      FILTERS.forEach(function (f) { counts[f[0]] = {}; });
      S.rows.forEach(function (r) {
        FILTERS.forEach(function (f) {
          var v = f[0] === "_month" ? mon(r) : (r[f[0]] == null ? "" : String(r[f[0]]));
          if (v) counts[f[0]][v] = (counts[f[0]][v] || 0) + 1;
        });
      });
      FILTERS.forEach(function (f) {
        var keys = Object.keys(counts[f[0]]).sort();
        if (f[0] === "_month") keys.reverse();
        S.opts[f[0]] = keys.map(function (v) { return { v: v, n: counts[f[0]][v] }; });
      });
    }
    return S.opts[key].map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (S.f[key] === o.v ? " selected" : "") + ">"
        + esc(o.v) + " · " + RS.fmtN(o.n) + "</option>";
    }).join("");
  }

  /* one row per campaign × source × medium, over TAGGED submissions only */
  function campaignRows(view) {
    var by = {};
    view.forEach(function (r) {
      if (!+r["Has UTM"]) return;
      // JSON, not a bare concatenation: joined plainly, campaign "ab" + source "c" and
      // campaign "a" + source "bc" would collapse into one row
      var k = JSON.stringify([r["UTM Campaign"] || "", r["UTM Source"] || "",
                              r["UTM Medium"] || ""]);
      var g = by[k] || (by[k] = {
        camp: r["UTM Campaign"], src: r["UTM Source"], med: r["UTM Medium"],
        res: r["UTM Source Corrected"], paid: 0, n: 0, leads: 0, booked: 0, won: 0,
      });
      g.n++;
      g.paid += +r["Paid Click"] ? 1 : 0;
      g.leads += +r.Matched ? 1 : 0;
      g.booked += +r.Booked ? 1 : 0;
      g.won += +r["UTM Won"] ? 1 : 0;
      if (!g.res) g.res = r["UTM Source Corrected"];
    });
    return Object.keys(by).map(function (k) { return by[k]; })
      .sort(function (a, b) { return b.n - a.n; });
  }

  function render(host) {
    injectStyle();
    if (S.rows.length) { paint(host); return; }
    host.innerHTML = '<div class="rs-page-head"><h1>Website Forms &amp; UTM</h1>'
      + "<p>Loading website form submissions…</p></div>";
    RS.load("web_form_lead").then(function (rows) {
      S.rows = rows || [];
      paint(host);
    }).catch(function (e) {
      host.innerHTML = '<div class="rs-page-head"><h1>Website Forms &amp; UTM</h1></div>'
        + '<div class="rs-hint">Couldn’t load — ' + esc(e.message) + "</div>";
    });
  }

  function paint(host) {
    var fmtN = RS.fmtN;
    var view = S.rows.filter(match);
    var tagged = view.filter(function (r) { return +r["Has UTM"]; });
    var leads = view.filter(function (r) { return +r.Matched; });
    var booked = view.filter(function (r) { return +r.Booked; });
    var won = view.filter(function (r) { return +r["UTM Won"]; });
    var unmapped = {};
    view.forEach(function (r) {
      var u = r["UTM Unmapped"];
      if (u) unmapped[u] = (unmapped[u] || 0) + 1;
    });
    var unmappedKeys = Object.keys(unmapped).sort();
    var pc = function (n, d) { return d ? (100 * n / d).toFixed(1) + "%" : "—"; };

    var camps = campaignRows(view);
    var isCamp = S.view === "campaign";
    var COLS = isCamp ? CAMP_COLS : SUB_COLS;

    host.innerHTML = '<div class="wfu">'
      + '<div class="rs-page-head"><h1>Website Forms &amp; UTM</h1>'
      + "<p>Every submission on the website form, the campaign link it arrived through, "
      + "and what became of the lead.</p></div>"

      + '<div class="rs-kpis" id="wfuKpis"></div>'

      + '<div class="rs-bar">'
      + '<div class="rs-seg" id="wfuSeg">'
      + VIEWS.map(function (v) {
          return "<button" + (S.view === v[0] ? ' class="on"' : "") + ' data-v="'
            + v[0] + '">' + esc(v[1]) + "</button>";
        }).join("")
      + "</div>"
      + FILTERS.map(function (f) {
          return '<label class="rs-fld"><span>' + esc(f[1]) + "</span>"
            + '<select class="rs-sel" data-k="' + esc(f[0]) + '"><option value="">All</option>'
            + optionHtml(f[0]) + "</select></label>";
        }).join("")
      + '<label class="rs-fld"><span>Tagged link</span><select class="rs-sel" data-k="_tagged">'
      + ['<option value="">All</option>',
         '<option value="yes"' + (S.f._tagged === "yes" ? " selected" : "") + ">Tagged only</option>",
         '<option value="no"' + (S.f._tagged === "no" ? " selected" : "") + ">Untagged only</option>"].join("")
      + "</select></label>"
      + '<label class="rs-fld"><span>Became a lead</span><select class="rs-sel" data-k="_lead">'
      + ['<option value="">All</option>',
         '<option value="yes"' + (S.f._lead === "yes" ? " selected" : "") + ">Matched a lead</option>",
         '<option value="no"' + (S.f._lead === "no" ? " selected" : "") + ">No lead found</option>"].join("")
      + "</select></label>"
      + '<label class="rs-fld"><span>Find</span><input class="rs-inp" id="wfuQ" '
      + 'placeholder="Customer, email, phone, campaign…" value="' + esc(S.f._q || "") + '"></label>'
      + '<span class="rs-spacer"></span>'
      + '<button class="rs-btn" id="wfuClear">Clear filters</button>'
      + '<button class="rs-btn pri" id="wfuCsv">Download CSV</button>'
      + "</div>"

      + '<div class="panel"><div class="panel-head">'
      + '<div class="panel-title">' + (isCamp ? "Campaigns" : "Submissions") + "</div>"
      + '<span class="rs-pill mute">' + fmtN(isCamp ? camps.length : view.length) + "</span></div>"

      + '<div class="rs-hint">'
      + "<b>An untagged link is not an organic visit.</b> " + pc(tagged.length, view.length)
      + " of these submissions arrived on a tagged link — tagging is recent and still partial, "
      + "so the campaign view counts only the tagged ones rather than showing a "
      + "<i>(none)</i> bucket that would read as the biggest campaign we run. "
      + "<b>The export carries no submission date</b>, only the move date the customer asked "
      + "for, so every month here is the matched lead’s Moveboard create date and the "
      + fmtN(view.length - leads.length) + " submissions with no lead sit outside every month. "
      + "A tag decides the lead’s source only where nothing above it did: <b>Returned</b>, "
      + "<b>Recommended</b>, a referral form, a <b>phone match</b> on a tracked number, and "
      + "<b>Post Card</b> all rank higher (his ruling 2026-09-05 — a phone that rang a "
      + "tracked number is the harder evidence). So <b>Tag set the source</b> below counts "
      + "the leads the tag actually decided, not every lead that carried one."
      + (unmappedKeys.length
          ? ' <span class="rs-pill warn">no rule</span> '
            + unmappedKeys.map(function (u) {
                return "<b>" + esc(u) + "</b> (" + fmtN(unmapped[u]) + ")";
              }).join(", ")
            + " — tagged, but <code>utm_source_map</code> has no rule for "
            + (unmappedKeys.length === 1 ? "it" : "them") + ", so "
            + (unmappedKeys.length === 1 ? "it decides" : "they decide") + " nothing. "
            + "Add a row to that table and the next rebuild picks it up."
          : "")
      + "</div>"

      + '<div class="rs-tablewrap rs-fit" id="wfuTbl">'
      + '<table class="rs-table rs-sticky rs-fixed"><colgroup>'
      + COLS.map(function (c) { return '<col style="width:' + c[1] + '%">'; }).join("")
      + "</colgroup><thead><tr>"
      + COLS.map(function (c) {
          return "<th" + (/num/.test(c[2]) ? ' class="num nowrap"' : "") + ">" + esc(c[0]) + "</th>";
        }).join("")
      + "</tr></thead><tbody></tbody></table></div>"
      + '<div class="wfu-foot" data-foot></div></div>'
      + "</div>";

    RSC.kpis(host.querySelector("#wfuKpis"), [
      { label: "Submissions", value: fmtN(view.length),
        sub: view.length === S.rows.length ? "all form fills"
                                           : "of " + fmtN(S.rows.length) + " · filtered" },
      { label: "Became a lead", value: pc(leads.length, view.length),
        sub: fmtN(leads.length) + " matched to Moveboard" },
      { label: "Tagged links", value: fmtN(tagged.length),
        sub: pc(tagged.length, view.length) + " of submissions" },
      { label: "Booked", value: fmtN(booked.length),
        sub: pc(booked.length, Math.max(leads.length, 1)) + " of the leads" },
      { label: "Tag set the source", value: fmtN(won.length), tone: won.length ? "pos" : "",
        sub: "leads re-sourced by their UTM" },
      { label: "Tags with no rule", value: fmtN(unmappedKeys.length),
        tone: unmappedKeys.length ? "warn" : "", sub: "utm_source_map needs a row" },
    ]);

    var td = function (cls, html) { return "<td" + (cls ? ' class="' + cls + '"' : "") + ">" + html + "</td>"; };
    var val = function (cls, v) {
      return v == null || v === "" ? td((cls ? cls + " " : "") + "dim", "—") : td(cls, esc(v));
    };

    var body, total;
    if (isCamp) {
      total = camps.length;
      body = camps.map(function (g) {
        return "<tr>" + val("wrap", g.camp) + val("wrap", g.src) + val("wrap", g.med)
          + val("wrap", g.res)
          + td("", g.paid ? '<span class="rs-pill info">' + fmtN(g.paid) + " paid</span>" : "—")
          + td("num", fmtN(g.n)) + td("num", fmtN(g.leads)) + td("num", fmtN(g.booked))
          + td("num", g.leads ? (100 * g.booked / g.leads).toFixed(1) + "%" : "—")
          + td("num", g.won ? fmtN(g.won) : '<span class="dim">—</span>')
          + "</tr>";
      }).join("");
    } else {
      var sorted = view.slice().sort(function (a, b) {
        return String(b["Lead Created"] || "").localeCompare(String(a["Lead Created"] || ""));
      });
      total = sorted.length;
      var per = S.per, pages = Math.max(1, Math.ceil(total / per));
      if (S.page >= pages) S.page = pages - 1;
      body = sorted.slice(S.page * per, S.page * per + per).map(function (r) {
        var lc = String(r["Lead Created"] || "").slice(0, 10);
        return "<tr>"
          + (lc ? td("nowrap", esc(lc)) : td("dim nowrap", "no lead"))
          + val("wrap", r["Lead Customer"] || r["Form Customer"])
          + val("nowrap", String(r["Form Move Date"] || "").slice(0, 10))
          + val("wrap", r["Form Dropdown"])
          + val("wrap", r["UTM Source"]) + val("wrap", r["UTM Medium"])
          + val("wrap", r["UTM Campaign"]) + val("wrap", r["UTM Landing Page"])
          + td("wrap", esc(r["Moveboard Booked Source"] || "—")
               + (+r["UTM Won"] ? ' <span class="rs-pill ok">tag</span>' : ""))
          + val("wrap", r["Lead Status Category"])
          + val("wrap", r["Match Rule"])
          + "</tr>";
      }).join("");
    }
    host.querySelector("tbody").innerHTML = body
      || '<tr><td class="dim" colspan="' + COLS.length + '">Nothing matches these filters.</td></tr>';

    var foot = host.querySelector("[data-foot]");
    if (isCamp) {
      foot.innerHTML = "<span>" + fmtN(camps.length) + " campaign combination"
        + (camps.length === 1 ? "" : "s") + " · tagged submissions only</span>";
    } else {
      var pages2 = Math.max(1, Math.ceil(total / S.per));
      foot.innerHTML = "<span>" + fmtN(S.page * S.per + 1) + "–"
        + fmtN(Math.min(total, S.page * S.per + S.per)) + " of " + fmtN(total) + "</span>"
        + '<span class="rs-spacer"></span>'
        + '<button class="rs-btn" data-pg="-1"' + (S.page ? "" : " disabled") + ">Prev</button>"
        + "<b>" + fmtN(S.page + 1) + " / " + fmtN(pages2) + "</b>"
        + '<button class="rs-btn" data-pg="1"' + (S.page + 1 >= pages2 ? " disabled" : "") + ">Next</button>";
      foot.querySelectorAll("[data-pg]").forEach(function (b) {
        b.onclick = function () { S.page += +b.dataset.pg; paint(host); };
      });
    }

    if (window.RSC && RSC.fitScroller) RSC.fitScroller(host.querySelector("#wfuTbl"));

    host.querySelectorAll(".rs-sel[data-k]").forEach(function (sel) {
      sel.onchange = function () { S.f[sel.dataset.k] = sel.value; S.page = 0; paint(host); };
    });
    host.querySelectorAll("#wfuSeg button").forEach(function (b) {
      b.onclick = function () { S.view = b.dataset.v; S.page = 0; paint(host); };
    });
    var q = host.querySelector("#wfuQ");
    var t = null;
    q.oninput = function () {
      clearTimeout(t);
      t = setTimeout(function () {
        S.f._q = q.value; S.page = 0; paint(host);
        var el = host.querySelector("#wfuQ");
        if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      }, 220);
    };
    host.querySelector("#wfuClear").onclick = function () { S.f = {}; S.page = 0; S.opts = null; paint(host); };
    host.querySelector("#wfuCsv").onclick = function () { csv(isCamp, view, camps); };
  }

  function csv(isCamp, view, camps) {
    var lines, name;
    var q = function (v) {
      var s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    if (isCamp) {
      lines = [["Campaign", "UTM source", "Medium", "Resolved source", "Paid clicks",
                "Submissions", "Became a lead", "Booked", "Booking rate %",
                "Decided the source"].join(",")];
      camps.forEach(function (g) {
        lines.push([g.camp, g.src, g.med, g.res, g.paid, g.n, g.leads, g.booked,
                    g.leads ? (100 * g.booked / g.leads).toFixed(1) : "", g.won].map(q).join(","));
      });
      name = "Website form campaigns (" + camps.length + ").csv";
    } else {
      var cols = ["Lead Created", "Lead Customer", "Form Customer", "Form Email", "Form Phone",
        "Form Move Date", "Form Dropdown", "UTM Source", "UTM Medium", "UTM Campaign",
        "UTM Content", "UTM Term", "UTM Landing Page", "Ad Campaign Id", "Paid Click",
        "UTM Source Corrected", "UTM Won", "Moveboard Booked Source", "Lead Status",
        "Lead Status Category", "Booked", "Match Rule", "Request Joinkey"];
      lines = [cols.join(",")];
      view.forEach(function (r) { lines.push(cols.map(function (c) { return q(r[c]); }).join(",")); });
      name = "Website form submissions (" + view.length + ").csv";
    }
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  if (window.registerPage) {
    registerPage({
      id: "utm-campaigns",
      group: "marketing",
      title: "Website Forms & UTM",
      render: render,
    });
  }
})();
