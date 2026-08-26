/* SALES COMMUNICATION ANALYSIS — what was said on a sales call, per rep.
 *
 * His ask (2026-08-25): how the communication with the customer went, what could have been
 * done better, what was not done properly. His sales head's own rules arrive later; this is
 * the frame they drop into.
 *
 * THIS PAGE IS A GAP MAP, NOT A GRADE, and every one of the following is a decision:
 *
 *   * NO BOOKED RATE and no conversion column. Measured raw, confirmed rate runs 24.3% on a
 *     call made within an hour of the lead landing to 78.6% on one made a fortnight later, so
 *     every sensible behaviour scores NEGATIVE against booking — asking about floors −21
 *     points, taking an inventory −20 — purely because discovery happens early and early leads
 *     convert less. Put a conversion column beside this checklist and it teaches the sales team
 *     that asking questions loses deals.
 *
 *   * NO COMPOSITE SCORE and no rank number. "Checks fired" correlates +0.62 with how many
 *     words the rep said, so a total out of sixteen is a word-count ranking in a rubric's
 *     clothes. And the perturbation test is explicit about how far the ordering can be
 *     trusted: on "asked for the booking" the top three survive any reasonable rewording of
 *     the pattern, but below about 7% the rep order moves with the regex rather than with the
 *     rep. So the page shows RATES and lets the reader sort; it never prints a position.
 *
 *   * EVERY VERDICT SAYS "SAID", NEVER "DONE WELL". A pattern cannot tell a warm deposit
 *     explanation from a recited one, and pretending otherwise makes every row arguable.
 *
 *   * THE SHARED LINE IS NOT A PERSON. "Support Zip To Zip" is a quarter of the corpus and
 *     would top any leaderboard at 88.7% because 99% of its calls happen after the booking. It
 *     is shown below the rule, labelled, and never scored.
 *
 * THE WORDS THEMSELVES ARE NOT IN THIS PAYLOAD. The mart carries verdicts and the utterance
 * `Seq` that produced each one; the transcript is fetched one call at a time from the gated
 * /api/_salescall, because ringsense_utterances is 530,000 rows of customer conversation and
 * is in the bridge's EXCLUDE_TABLES for exactly that reason.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_call_score) {
    RS.DATASETS.sales_call_score = {
      table: "mart_sales_call_score",
      // A PAYLOAD CONTRACT: a column missing here is never sent, arrives undefined and paints
      // an em dash with no error. The seq pointers are deliberately NOT here — they come back
      // with the transcript, one call at a time.
      cols: ["Record Id", "Rep", "Shared Line", "Transferred", "Started", "Duration Sec",
             "Job No", "Customer", "Source", "Direction", "Linked", "Stage", "Priced",
             "First Contact", "Rep Turns", "Customer Turns", "Rep Words", "Customer Words",
             "Talk Share", "Objection", "Longest Monologue Sec", "Questions",
             "Questions Per Min", "Ended With Next Step", "Customer Ending Share",
             "open_identified", "open_goodtime", "disc_date", "disc_inventory", "disc_access",
             "disc_heavy", "disc_packing", "price_after_discovery", "px_explained",
             "dep_named", "dep_purpose", "close_ask", "obj_response", "gave_direct_line",
             "shape_broadcast", "shape_monologue"],
    };
  }
})();

(function () {
  // id, what a sales head would call it, and the population it is measured over
  var CHECKS = [
    ["open_identified", "Said who you are and the company", "quote"],
    ["open_goodtime", "Asked if it was a good time", "outbound"],
    ["disc_date", "Established the move date", "first"],
    ["disc_inventory", "Established what is being moved", "first"],
    ["disc_access", "Established floors and elevator", "first"],
    ["disc_heavy", "Established heavy items", "first"],
    ["disc_packing", "Established boxes and packing", "first"],
    ["price_after_discovery", "Learned something before quoting", "priced"],
    ["px_explained", "Explained how the price is built", "priced"],
    ["dep_named", "Raised the deposit", "priced"],
    ["dep_purpose", "Said what the deposit is for", "priced"],
    ["close_ask", "Asked for the booking", "priced"],
    ["obj_response", "Answered the pushback", "objection"],
    ["gave_direct_line", "Gave a direct line back", "quote"],
    ["shape_broadcast", "Let the customer speak", "quote"],
    ["shape_monologue", "Did not hold the floor 90s", "quote"],
  ];
  var POP = {
    quote: "quote calls", outbound: "outbound quote calls", first: "first contacts",
    priced: "calls where a price was said", objection: "calls with pushback",
  };
  var MIN_CALLS = 50;

  function injectStyle() {
    var old = document.getElementById("scx-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "scx-style";
    // Bars, tables, pills, panels and KPI tiles are THE COMPONENT KIT in rs.css. Only what the
    // kit has no name for lives here — and the KPI colour classes, which the kit does NOT
    // define: passing "neg" to a kpi tile without this renders identically to a plain one.
    st.textContent = ""
      + ".scx{font-variant-numeric:tabular-nums}"
      + ".scx .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".scx .rs-kpis .kpi.warn .v{color:var(--warn)}"
      + ".scx .rs-kpis .kpi.pos .v{color:var(--pos)}"
      // the population ladder: what was excluded, and why, above every percentage
      + ".scx-funnel{display:flex;flex-wrap:wrap;gap:0;align-items:stretch;margin:2px 0 16px}"
      + ".scx-fstep{flex:1 1 0;min-width:120px;padding:9px 13px;background:var(--panel);"
      + "border:1px solid var(--line);border-right:0;position:relative}"
      + ".scx-fstep:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}"
      + ".scx-fstep:first-child{border-radius:10px 0 0 10px}"
      + ".scx-fstep b{display:block;font-size:17px;font-weight:800;line-height:1.1}"
      + ".scx-fstep span{display:block;font-size:11px;color:var(--faint);margin-top:2px;line-height:1.35}"
      + ".scx-fstep.on b{color:var(--brand)}"
      // the rate cell: a number you can rank by eye without a rank number
      + ".scx-rate{display:block;font-size:12.5px;font-weight:700;line-height:1.2}"
      + ".scx-bar{display:block;height:4px;border-radius:3px;background:var(--panel-2);"
      + "margin-top:3px;overflow:hidden;min-width:38px}"
      + ".scx-bar i{display:block;height:100%;background:var(--brand)}"
      + ".scx-bar i.low{background:var(--neg)}"
      + ".scx-bar i.mid{background:var(--warn)}"
      + ".scx-thin{color:var(--faint);font-size:11.5px;font-style:italic}"
      // the one row a reader must not mistake for a person
      + ".scx-shared{background:var(--panel-2)}"
      + ".scx-shared td:first-child::after{content:'shared line — not a person';"
      + "display:block;font-size:10.5px;color:var(--faint);font-style:italic;font-weight:600}"
      // the drill-down
      + ".scx-utt{padding:6px 0;border-bottom:1px solid var(--line);font-size:13.5px;line-height:1.55}"
      + ".scx-utt:last-child{border-bottom:0}"
      + ".scx-utt.rep{padding-left:0}"
      + ".scx-utt.cust{padding-left:26px;color:var(--muted)}"
      + ".scx-who{font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--faint);margin-right:8px}"
      + ".scx-utt.hit{background:var(--warn-bg);border-radius:6px;padding-left:8px;padding-right:8px}"
      + ".scx-vlist{display:flex;flex-wrap:wrap;gap:5px;margin:8px 0 12px}"
      + ".scx-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:74ch}";
    document.head.appendChild(st);
  }

  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Reading the calls…</div>';
    var S = { rep: null, call: null, rows: [] };

    RS.load("sales_call_score").then(function (d) {
      S.rows = (d && (d.rows || d)) || [];
      paint(host, S);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the call scores — '
        + esc(e.message) + "</div>";
    });
  }

  function paint(host, S) {
    var all = S.rows;
    var stage = function (s) { return all.filter(function (r) { return r.Stage === s; }); };
    var quote = stage("quote call");
    var human = quote.filter(function (r) { return !+r["Shared Line"]; });

    // ---- the ladder. Every percentage below is over "quote calls", so the page has to say
    // what a quote call is and what fell out on the way there, above the numbers rather than
    // in a footnote.
    var funnel = [
      [all.length, "transcribed calls", "RingSense returned words"],
      [all.length - stage("not a conversation").length, "two-way conversations",
       "the rest are voicemail, no answer, or a few seconds of silence"],
      [quote.length, "quote calls", "a price or the shape of the job was actually discussed"],
      [human.length, "scored", "the shared support line is not a person and is not scored"],
    ];

    var byRep = {};
    human.forEach(function (r) {
      var k = r.Rep || "—";
      (byRep[k] = byRep[k] || []).push(r);
    });
    var reps = Object.keys(byRep).sort(function (a, b) {
      return byRep[b].length - byRep[a].length;
    });

    // company-wide, for the tiles: the two biggest gaps
    function companyRate(cid) {
      var app = human.filter(function (r) { return r[cid] != null; });
      return { n: app.length, pct: pct(app.filter(function (r) { return +r[cid]; }).length, app.length) };
    }
    var close = companyRate("close_ask");
    var depp = companyRate("dep_purpose");
    var nextstep = pct(human.filter(function (r) { return +r["Ended With Next Step"]; }).length,
                       human.length);

    var html = ''
      + '<div class="rs-page-head"><h1>Sales Communication Analysis</h1>'
      + "<p>What was <b>said</b> on each sales call, per rep — the house script written down "
      + "from the calls themselves. This is a coaching map: it records what was said, never "
      + "how well it was said, and it carries no booked rate on purpose.</p></div>"

      + '<div class="scx-funnel">'
      + funnel.map(function (f, i) {
          return '<div class="scx-fstep' + (i === funnel.length - 1 ? " on" : "") + '"><b>'
            + f[0].toLocaleString() + "</b><span><b>" + esc(f[1]) + "</b><br>"
            + esc(f[2]) + "</span></div>";
        }).join("")
      + "</div>"

      + '<div class="rs-kpis" style="--kpi-cols:4">'
      + kpi("Scored quote calls", human.length.toLocaleString(),
            reps.length + " reps", "")
      + kpi("Asked for the booking", close.pct + "%",
            "of " + close.n.toLocaleString() + " calls where a price was said", "neg")
      + kpi("Said what the deposit is for", depp.pct + "%",
            "of the same calls", "neg")
      + kpi("Ended with a next step", nextstep + "%",
            "of scored quote calls", nextstep < 40 ? "neg" : "warn")
      + "</div>"

      + '<div class="panel"><div class="panel-head"><div class="panel-title">By rep</div></div>'
      + '<p class="rs-hint">Each column is the share of that rep\'s <b>applicable</b> calls '
      + "where the thing was said — a rep is never counted against a check the call never "
      + "called for, and a fact the customer volunteered counts as established. Sorted by "
      + "volume; there is deliberately no rank and no total, because a total of sixteen checks "
      + "is mostly a measure of how long the rep talked.</p>"
      + repTable(byRep, reps, quote)
      + "</div>";

    host.innerHTML = '<div class="scx">' + html + "</div>";
  }

  function kpi(label, value, sub, cls) {
    return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(label) + "</div>"
      + '<div class="v">' + esc(value) + '</div><div class="s">' + esc(sub) + "</div></div>";
  }

  function applicable(rows, cid) {
    return rows.filter(function (r) { return r[cid] != null; });
  }

  function rateCell(rows, cid) {
    var app = applicable(rows, cid);
    if (app.length < 10) {
      return '<td class="num"><span class="scx-thin">too few</span></td>';
    }
    var p = pct(app.filter(function (r) { return +r[cid]; }).length, app.length);
    var tone = p >= 60 ? "" : (p >= 25 ? "mid" : "low");
    return '<td class="num" title="' + app.length + ' applicable calls">'
      + '<span class="scx-rate">' + p + "%</span>"
      + '<span class="scx-bar"><i class="' + tone + '" style="width:' + p + '%"></i></span></td>';
  }

  function repTable(byRep, reps, quote) {
    var shared = quote.filter(function (r) { return +r["Shared Line"]; });
    var head = '<tr><th>Rep</th><th class="num">Quote calls</th>'
      + '<th class="num">Outbound</th><th class="num">First contact</th>'
      + CHECKS.map(function (c) {
          return '<th class="num" title="measured over ' + esc(POP[c[2]]) + '">'
            + esc(c[1]) + "</th>";
        }).join("") + "</tr>";

    var body = reps.map(function (rep) {
      var rows = byRep[rep];
      // BELOW THE FLOOR WE PRINT WORDS, NOT A NUMBER. A rate over twenty calls looks exactly
      // as authoritative as one over seven hundred and is not, and the natural management
      // instinct with a new hire is to want the number anyway.
      if (rows.length < MIN_CALLS) {
        return "<tr><td>" + esc(rep) + '</td><td class="num">' + rows.length + "</td>"
          + '<td colspan="' + (CHECKS.length + 2) + '"><span class="scx-thin">'
          + "not enough calls to show a rate — under " + MIN_CALLS + " scored quote calls"
          + "</span></td></tr>";
      }
      var ob = pct(rows.filter(function (r) {
        return /out/i.test(String(r.Direction || ""));
      }).length, rows.length);
      var fc = pct(rows.filter(function (r) { return +r["First Contact"]; }).length, rows.length);
      return "<tr><td class=\"strong\">" + esc(rep) + "</td>"
        + '<td class="num">' + rows.length + "</td>"
        + '<td class="num">' + ob + "%</td>"
        + '<td class="num">' + fc + "%</td>"
        + CHECKS.map(function (c) { return rateCell(rows, c[0]); }).join("")
        + "</tr>";
    }).join("");

    // the shared line, below the rule and labelled, so nobody reads it as a colleague
    if (shared.length) {
      body += '<tr class="scx-shared"><td>Support Zip To Zip</td>'
        + '<td class="num">' + shared.length + "</td>"
        + '<td colspan="' + (CHECKS.length + 2) + '"><span class="scx-thin">'
        + "a shared queue with no identifiable person on the record — its calls are excluded "
        + "from every rate above</span></td></tr>";
    }

    return '<div class="rs-tablewrap rs-fit"><table class="rs-table rs-fixed">'
      + "<thead>" + head + "</thead><tbody>" + body + "</tbody></table></div>";
  }

  if (window.registerPage) {
    registerPage({
      id: "sales-comms",
      group: "sales",
      title: "Sales Communication Analysis",
      render: render,
    });
  }
})();
