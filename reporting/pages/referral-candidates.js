/* LIST OF POSSIBLE REFERRALS — customers who left a five-star review.
 *
 * Marketing's ask (2026-08-19, via Tornike): who wrote us a five-star review, with name,
 * email and phone — a call sheet for referral asks. The warehouse already had every piece:
 * fct_reviews_breakdown parses the star runs (a five-star token is CHAR_LENGTH '★★★★★' = 5),
 * fct_reviews carries the customer's name per review, and fct_moveboard carries the email
 * and phone the lead was created with. fct_referral_candidates (curated.py) joins the three
 * by Request Joinkey; this page is a VIEW of it — no engine, no statistics, just the list.
 *
 * "Do we have all the data?" is answered on the page itself: the coverage line counts how
 * many reviewers carry an email, a phone, or could not be matched to a lead at all —
 * a row with blank contacts is part of the answer, not a row to hide.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.referral_candidates) {
    RS.DATASETS.referral_candidates = {
      table: "fct_referral_candidates",
      // THIS LIST IS A PAYLOAD CONTRACT, not documentation. Projection is always on, so a
      // column missing here is a column the bridge never sends -- the page then reads
      // undefined and renders an em dash, with no error anywhere to say why. Both of the
      // columns below were added to the mart and left out of this list: `Later Jobs`
      // exported blank in the CSV for a day, and `Move Date` emptied the entire Move column
      // the moment the page started reading it. The cache key includes this list, so
      // extending it also invalidates every stale browser copy.
      cols: ["Row Id", "Company", "Event Date", "Move Date", "Customer", "Request No",
             "Platforms", "Five Star Reviews", "Counted", "Email", "Phone",
             "Move Type", "Size of Move", "Lead Source",
             "Pickup State", "Delivery State", "Sales Person",
             "Satisfaction Score", "Bill Total", "Quote High", "Later Jobs",
             "Lead Matched"],
    };
  }
})();

(() => {
  function injectStyle() {
    var old = document.getElementById("rf-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "rf-style";
    // The bar, the fields, the toggle, the buttons, the card, the table, the pills and the
    // reason line now come from THE COMPONENT KIT in rs.css. What is left here is what the
    // kit does not name -- plus a handful of one-line adjustments TO kit components.
    st.textContent = ""
      + ".rf{font-variant-numeric:tabular-nums}"
      // six tiles across one row -- the column count RSC.kpis would have computed for six
      + ".rf .rs-kpis{--kpi-cols:6}"
      // six tiles across means a narrow label box, and the kit ellipsizes -- which cut
      // his own Georgian phrase to "არ ვა…". These labels wrap instead.
      + ".rf .rs-kpis .kpi .l{white-space:normal;overflow:visible;text-overflow:clip}"
      // the kit paints every tile value in --ink; a good / ruled-out count wants its own tone
      + ".rf .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".rf .rs-kpis .kpi.warn .v{color:var(--warn)}"
      // the find box carries a long placeholder, so it asks a little more than the kit's 210px
      + ".rf .rs-inp{min-width:230px}"
      // the list runs to a thousand rows: cap the scroller so the sticky header earns its keep
      + ".rf .rs-tablewrap{max-height:70vh}"
      // a reason line living inside a table cell has to wrap without widening the column
      + ".rf .rs-why{max-width:230px;white-space:normal}"
      // the row count beside the panel title
      + ".rf .panel-head .n{font-weight:600;color:var(--faint);font-size:14px}"
      // a footnote UNDER the table: quieter than .rs-hint, and it hangs below, not above
      + ".rf-note{font-size:12.5px;color:var(--faint);margin-top:10px;line-height:1.55}";
    document.head.appendChild(st);
  }

registerPage({
  id: "referral-candidates",
  group: "marketing",
  title: "List of Possible Referrals",
  subtitle: "Customers who left a five-star review — with the email and phone their lead " +
            "carried. A call sheet for referral asks.",
  datasets: [],

  render: function (host) {
    var esc = function (s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__RF || (window.__RF = { q: "", co: "", plat: "", contact: false,
                                            src: "", mt: "", size: "", sp: "", unrated: false,
                                            from: null, to: null });
    /* THE GATES (Tornike 2026-08-19, confirmed 2026-08-20): a five-star review alone is not
     * enough to ask for a referral. GOOD TO ASK = the customer rated the move 10/10 on the
     * closing AND the bill stayed within 25% (and $300) of the quote's top end.
     *
     * THE GATE IS A FILTER, NOT A COLUMN (his call 2026-08-21: "i need user just to see the
     * list of people who are good — not all of them with status"). The first cut showed all
     * 1,928 five-star customers with a verdict pill against each; the page is a CALL SHEET,
     * and a caller should never have to read a status before dialling. Failing rows leave
     * the table entirely — 720 rated below 10 or billed well over the quote.
     *
     * A missing score is not a failure, it is missing evidence — 391 customers whose closing
     * recorded no rating. They cannot be certified good, so they are out of the default list,
     * but one switch in the bar brings them back: silently dropping a fifth of a call sheet
     * with no way to see it would be its own kind of lie. The counts are stated in the hint. */
    function gate(r) {
      var sat = r["Satisfaction Score"] == null || r["Satisfaction Score"] === ""
        ? null : +r["Satisfaction Score"];
      var bill = +r["Bill Total"] || null;
      // a $0 quote is NO quote (10,628 of the moveboard's quoted rows carry Max Quote=0);
      // treating it as a real ceiling would rule out every bill on those jobs
      var qh = (+r["Quote High"] > 0) ? +r["Quote High"] : null;
      var over = bill != null && qh != null && bill > qh * 1.25 && (bill - qh) >= 300;
      var why = [];
      if (sat != null && sat < 10) why.push("rated the move " + sat + "/10");
      if (over) why.push("bill $" + Math.round(bill).toLocaleString() + " ran "
        + Math.round((bill / qh - 1) * 100) + "% over the $" + Math.round(qh).toLocaleString() + " quote");
      if ((sat != null && sat < 10) || over) return { v: "bad", why: why };
      if (sat == null) return { v: "nos", why: ["no satisfaction score on the closing"] };
      return { v: "ok", why: [] };
    }
    injectStyle();
    host.innerHTML = '<div class="panel">Loading five-star reviewers…</div>';

    RS.load("referral_candidates").then(function (rows) {
      rows = (rows || []).map(function (r) {
        r["Five Star Reviews"] = +r["Five Star Reviews"] || 1;
        r["Lead Matched"] = +r["Lead Matched"] || 0;
        r["Counted"] = +r["Counted"] || 0;
        // THE PAGE'S DATE IS THE MOVE DATE (his call 2026-08-22). Everything that reads
        // a date off a row -- the filter, the sort, the column -- reads this one, so the
        // page cannot end up filtering on one basis and sorting on another. The review
        // date survives in the CSV alone, where an export may still want it.
        r.Day = String(r["Move Date"] || "").slice(0, 10);
        r.Reviewed = String(r["Event Date"] || "").slice(0, 10);
        r._g = gate(r);
        return r;
      });
      if (!rows.length) {
        host.innerHTML = '<div class="panel">No five-star reviews found — the table may ' +
          "not be built yet (sources=curated) or there is nothing to show.</div>";
        return;
      }

      var MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      var dayLab = function (d) {
        if (!d || d.length < 10) return "—";
        return d.slice(8, 10) + " " + MONTHS[+d.slice(5, 7)] + " " + d.slice(0, 4);
      };
      var platsOf = function (r) {
        return String(r.Platforms || "").split(", ").map(function (p) {
          return p.replace(" (photo)", "");
        }).filter(Boolean);
      };
      var allPlats = {}, allCos = {}, allSrc = {}, allMt = {}, allSize = {}, allSp = {};
      rows.forEach(function (r) {
        platsOf(r).forEach(function (p) { allPlats[p] = 1; });
        if (r.Company) allCos[r.Company] = 1;
        if (r["Lead Source"]) allSrc[r["Lead Source"]] = 1;
        if (r["Move Type"]) allMt[r["Move Type"]] = 1;
        if (r["Size of Move"]) allSize[r["Size of Move"]] = 1;
        if (r["Sales Person"]) allSp[r["Sales Person"]] = 1;
      });

      function view() {
        return rows.filter(function (r) {
          return passes(r) && gateLetsIn(r);
        }).sort(function (a, b) { return String(b.Day).localeCompare(String(a.Day)); });
      }

      // the gate, applied as a FILTER: only the good ones, plus the unrated when the
      // switch is on. Kept apart from the other filters so the hint can count what the
      // gate alone removed FROM THIS VIEW -- "720 more are left out" has to mean 720 of
      // the rows the company/source/size filters already agreed to show.
      function gateLetsIn(r) {
        return r._g.v === "ok" || (r._g.v === "nos" && S.unrated);
      }

      function passes(r) {
        if (S.co && r.Company !== S.co) return false;
        if (S.plat && platsOf(r).indexOf(S.plat) < 0) return false;
        if (S.src && r["Lead Source"] !== S.src) return false;
        if (S.mt && r["Move Type"] !== S.mt) return false;
        if (S.size && r["Size of Move"] !== S.size) return false;
        if (S.sp && r["Sales Person"] !== S.sp) return false;
        // WHEN WE MOVED THEM. Both bounds are inclusive; r.Day is already 'YYYY-MM-DD',
        // so a string compare IS a date compare and no parsing (or timezone) enters into
        // it. One candidate in 1,929 has no move date on any closing and drops out of any
        // range -- the alternative, keeping it in every range, would make it appear under
        // filters that contradict each other.
        if (S.from && (!r.Day || r.Day < S.from)) return false;
        if (S.to && (!r.Day || r.Day > S.to)) return false;
        if (S.contact && !r.Email && !r.Phone) return false;
        if (S.q) {
          var q = S.q.toLowerCase();
          if (String(r.Customer || "").toLowerCase().indexOf(q) < 0
            && String(r.Email || "").toLowerCase().indexOf(q) < 0
            && String(r.Phone || "").toLowerCase().indexOf(q) < 0
            && String(r["Request No"] || "").toLowerCase().indexOf(q) < 0) return false;
        }
        return true;
      }

      // the kit slicer's mount point -- RSC.localSelect is mounted onto it in wire(),
      // which is also where the label, options and current value are handed over
      function sel(id) { return '<div id="' + id + '"></div>'; }

      function paint() {
        var v = view();
        // coverage: the literal answer to "do we have all the data?"
        var withMail = v.filter(function (r) { return r.Email; }).length;
        var withPhone = v.filter(function (r) { return r.Phone; }).length;
        var unmatched = v.filter(function (r) { return !r["Lead Matched"]; }).length;
        var fiveTotal = v.reduce(function (a, r) { return a + r["Five Star Reviews"]; }, 0);
        // what the gates left out, counted on the SAME filters the visible list uses, so
        // the sentence under the table always describes this view and not the whole table
        var others = rows.filter(function (r) { return passes(r) && !gateLetsIn(r); });
        var nBad = others.filter(function (r) { return r._g.v === "bad"; }).length;
        var nNos = others.filter(function (r) { return r._g.v === "nos"; }).length;
        var pctOf = function (n) { return v.length ? Math.round(n / v.length * 100) + "%" : "—"; };

        var html = '<div class="rf">'
          + '<div class="rs-page-head"><h1>List of Possible Referrals</h1>'
          + "<p>Customers who left a <b>five-star review</b> — with the email and phone "
          + "their lead carried. <b>Newest move first.</b>"
          + '<span class="freshness"> · reviews since 2025 · every date on this page is the '
          + "MOVE date · contact details come from the lead the move was booked on</span></p></div>"
          + '<div class="rs-kpis">'
          + kpi(v.length.toLocaleString(), "People to ask",
                "five-star reviewers whose move went right", "pos")
          + kpi(fiveTotal.toLocaleString(), "Five-star reviews",
                "written by these customers between them", "")
          + kpi(withMail.toLocaleString(), "With an email", pctOf(withMail) + " of the list", "pos")
          + kpi(withPhone.toLocaleString(), "With a phone", pctOf(withPhone) + " of the list", "pos")
          + "</div>"
          + '<div class="rs-bar">'
          // the kit's date picker (RSC.dateRange), mounted in wire(). It keeps ITS RANGE
          // HERE, in this page's own state -- the global slicer's dateBar would write into
          // RS.state instead, and picking "This year" on a call sheet would then quietly
          // narrow the Monthly Report the next time it was opened.
          + '<div class="rs-fld"><span>Move date</span><div id="rfDateHost"></div></div>'
          + sel("rfCo")
          + sel("rfPlat")
          + sel("rfSrc")
          + sel("rfMt")
          + sel("rfSize")
          + sel("rfSp")
          + '<div class="rs-tog' + (S.contact ? " on" : "") + '" id="rfContact"><i></i>Only with contact details</div>'
          + '<div class="rs-tog' + (S.unrated ? " on" : "") + '" id="rfUnrated"><i></i>Include unrated moves</div>'
          + '<label class="rs-fld"><span>Find</span><input class="rs-inp" id="rfQ" placeholder="Name, email, phone or request…" '
          + 'value="' + esc(S.q) + '"></label>'
          + '<span class="rs-spacer"></span>'
          + '<button class="rs-btn" id="rfMail">Copy emails · ' + withMail + "</button>"
          + '<button class="rs-btn" id="rfPhone">Copy phones · ' + withPhone + "</button>"
          + '<button class="rs-btn" id="rfCsv">Download CSV · ' + v.length + "</button>"
          + "</div>"
          + '<div class="panel"><div class="panel-head"><div class="panel-title">The list</div>'
          + '<span class="n">' + v.length + "</span></div>"
          + '<div class="rs-hint">Five-star reviewers whose move also went right — they rated it '
          + "<b>10/10</b> on the closing and the bill stayed close to the quote. "
          + (nBad ? "<b>" + nBad + "</b> more five-star customers are left out: they rated the move "
             + "below 10, or the bill ran 25%+ over the quote. " : "")
          + (nNos ? "<b>" + nNos + "</b> have no rating on their closing"
             + (S.unrated ? " and are included here." : " — switch on <i>Include unrated moves</i> to see them.") + " " : "")
          + "Contact details come from the lead the move was booked on, so a blank email or phone means the lead "
          + "was created without one"
          + (unmatched ? "; " + unmatched + " could not be matched to a lead at all and carry the name and request number only" : "")
          + ". Rows marked <i>uncounted</i> are reviews the platform later filtered; the customer still wrote them, "
          + "so they still belong on a referral list.</div>";

        if (!v.length) {
          html += '<div class="rf-note">Nothing matches these filters.</div></div></div>';
          host.innerHTML = html;
          wire();
          return;
        }
        var CAP = 1000;
        html += '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
          + "<th>Move</th><th>Customer</th><th>Email</th><th>Phone</th><th>Platform</th>"
          + "<th>Reviews</th><th>Score</th><th>Company</th><th>Request #</th><th>Move type</th><th>Size</th>"
          + "<th>Route</th><th>Source</th><th>Sales person</th>"
          + "</tr></thead><tbody>"
          + v.slice(0, CAP).map(function (r) {
              var route = [r["Pickup State"], r["Delivery State"]].filter(Boolean).join(" → ");
              return "<tr>"
                + '<td class="nowrap">' + esc(dayLab(r.Day)) + "</td>"
                + '<td class="strong">' + esc(r.Customer || "—") + "</td>"
                + (r.Email
                    ? '<td><a href="mailto:' + esc(r.Email) + '">' + esc(r.Email) + "</a></td>"
                    : '<td class="dim">—</td>')
                + (r.Phone ? '<td class="nowrap">' + esc(r.Phone) + "</td>"
                           : '<td class="nowrap dim">—</td>')
                + '<td class="nowrap muted">' + esc(r.Platforms || "—") + "</td>"
                + "<td>" + (r["Counted"]
                    ? '<span class="rs-pill ok">★ ' + r["Five Star Reviews"] + "</span>"
                    : '<span class="rs-pill warn" title="the platform later filtered this review; the customer still wrote it">★ '
                      + r["Five Star Reviews"] + " · uncounted</span>") + "</td>"
                + (r["Satisfaction Score"] == null || r["Satisfaction Score"] === ""
                    ? '<td class="nowrap dim">not rated</td>'
                    : "<td>" + esc(String(r["Satisfaction Score"])) + "/10</td>")
                + "<td>" + esc(r.Company || "—") + "</td>"
                + "<td>" + esc(r["Request No"] || "—") + "</td>"
                + '<td class="nowrap">' + esc(r["Move Type"] || "—") + "</td>"
                + "<td>" + esc(r["Size of Move"] || "—") + "</td>"
                + '<td class="nowrap">' + esc(route || "—") + "</td>"
                + "<td>" + esc(r["Lead Source"] || "—") + "</td>"
                + "<td>" + esc(r["Sales Person"] || "—") + "</td></tr>";
            }).join("")
          + "</tbody></table></div>";
        if (v.length > CAP) html += '<div class="rf-note">' + (v.length - CAP)
          + " more — narrow the search above.</div>";
        html += "</div></div>";
        host.innerHTML = html;
        wire(v);
      }

      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
          + '</div><div class="v">' + esc(val) + '</div><div class="s">' + esc(sub) + "</div></div>";
      }

      function copyList(items, btn, word) {
        if (!items.length) return;
        var t = btn.textContent;
        var flash = function (text) {
          btn.textContent = text;
          setTimeout(function () { btn.textContent = t; }, 1600);
        };
        try {
          navigator.clipboard.writeText(items.join("\n"))
            .then(function () { flash("Copied " + items.length + " " + word); })
            .catch(function () { flash("Copy blocked by the browser"); });
        } catch (e) { flash("Copy unavailable here"); }
      }

      function wire(v) {
        // the kit's page-local single-selects: same options in the same order as the old
        // native dropdowns, and the state stays in S (never RS.state, which is the GLOBAL
        // filter bar). Every paint rebuilds the bar wholesale, so these mount fresh each
        // time with the current value.
        [["rfCo", "co", "Company", allCos], ["rfPlat", "plat", "Platform", allPlats],
         ["rfSrc", "src", "Source", allSrc], ["rfMt", "mt", "Move type", allMt],
         ["rfSize", "size", "Size", allSize], ["rfSp", "sp", "Sales person", allSp]
        ].forEach(function (pair) {
          var el = host.querySelector("#" + pair[0]);
          if (el && window.RSC && RSC.localSelect) {
            RSC.localSelect(el, {
              label: pair[2],
              values: Object.keys(pair[3]).sort(),
              value: S[pair[1]],
              allLabel: "All",
              onChange: function (v) { S[pair[1]] = v; paint(); },
            });
          }
        });
        var dh = host.querySelector("#rfDateHost");
        if (dh && window.RSC && RSC.dateRange) {
          RSC.dateRange(dh, {
            get: function () { return { from: S.from, to: S.to }; },
            set: function (f, t) { S.from = f; S.to = t; },
            onChange: paint,
          });
        }
        var tg = host.querySelector("#rfContact");
        if (tg) tg.onclick = function () { S.contact = !S.contact; paint(); };
        var tu = host.querySelector("#rfUnrated");
        if (tu) tu.onclick = function () { S.unrated = !S.unrated; paint(); };
        var q = host.querySelector("#rfQ");
        if (q) q.oninput = function () {
          S.q = this.value;
          var at = this.selectionStart;
          paint();
          var n = host.querySelector("#rfQ");
          if (n) { n.focus(); n.setSelectionRange(at, at); }
        };
        var uniq = function (xs) {
          var seen = {}, out = [];
          xs.forEach(function (x) { var k = x.toLowerCase(); if (!seen[k]) { seen[k] = 1; out.push(x); } });
          return out;
        };
        var bm = host.querySelector("#rfMail");
        if (bm) bm.onclick = function () {
          copyList(uniq((v || []).map(function (r) { return r.Email; }).filter(Boolean)), bm, "emails");
        };
        var bp = host.querySelector("#rfPhone");
        if (bp) bp.onclick = function () {
          copyList(uniq((v || []).map(function (r) { return r.Phone; }).filter(Boolean)), bp, "phones");
        };
        // the download is the CURRENT view -- whatever the filters left visible, all of it
        // (the 1000-row render cap is a screen limit, not a data limit)
        var bc = host.querySelector("#rfCsv");
        if (bc) bc.onclick = function () {
          var cols = ["Move Date", "Review Date", "Customer", "Email", "Phone", "Platforms",
                      "Five Star Reviews", "Counted", "Company", "Request No",
                      "Move Type", "Size of Move", "Lead Source",
                      "Pickup State", "Delivery State", "Sales Person",
                      "Satisfaction Score", "Bill Total", "Quote High",
                      "Later Jobs"];
          var cell = function (x) {
            var s = String(x == null ? "" : x);
            // customer-typed values opening as live Excel formulas is a real attack
            // surface; a leading space neutralises =, +, - and @ without mangling data
            if (/^[=+\-@]/.test(s)) s = " " + s;
            return '"' + s.replace(/"/g, '""') + '"';
          };
          var lines = [cols.map(cell).join(",")].concat((v || []).map(function (r) {
            return [r.Day, r.Reviewed, r.Customer, r.Email, r.Phone, r.Platforms,
                    r["Five Star Reviews"], r.Counted ? "counted" : "uncounted",
                    r.Company, r["Request No"], r["Move Type"], r["Size of Move"],
                    r["Lead Source"], r["Pickup State"],
                    r["Delivery State"], r["Sales Person"],
                    r["Satisfaction Score"], r["Bill Total"],
                    r["Quote High"],
                    // jobs this customer had MORE than 60 days after the first, which the
                    // bill-vs-quote test leaves out -- a repeat customer, and a strong
                    // referral signal in its own right
                    r["Later Jobs"]].map(cell).join(",");
          }));
          // the BOM is for Excel: without it a Georgian or accented name opens as mojibake
          var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
          var a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "possible-referrals-" + new Date().toISOString().slice(0, 10) + ".csv";
          document.body.appendChild(a);
          a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        };
      }

      paint();
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the referral list — '
        + esc(e && e.message || e) + "</div>";
    });
  },
});
})();
