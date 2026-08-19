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
      cols: ["Row Id", "Company", "Event Date", "Customer", "Request No", "Platforms",
             "Five Star Reviews", "Counted", "Email", "Phone",
             "Move Type", "Size of Move", "Lead Source",
             "Pickup State", "Delivery State", "Sales Person",
             "Satisfaction Score", "Bill Total", "Quote High", "Lead Matched"],
    };
  }
})();

(() => {
  function injectStyle() {
    var old = document.getElementById("rf-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "rf-style";
    st.textContent = ""
      + ".rf{font-variant-numeric:tabular-nums}"
      + ".rf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:16px}"
      + ".rf-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".rf-kpi b{display:block;font-size:25px;font-weight:850;letter-spacing:-.5px;line-height:1.1}"
      + ".rf-kpi span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:4px}"
      + ".rf-kpi small{display:block;font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4}"
      + ".rf-kpi.pos b{color:var(--pos)} .rf-kpi.warn b{color:var(--warn)}"
      + ".rf-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:0 0 14px}"
      + ".rf-fld{display:flex;flex-direction:column;gap:4px}"
      + ".rf-fld>span{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".rf-bar select,.rf-bar input{background:var(--panel);color:var(--ink);border:1px solid var(--line-2);"
      + "border-radius:10px;padding:8px 12px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer}"
      + ".rf-bar select:hover{border-color:var(--brand)}"
      + ".rf-bar input{min-width:230px;cursor:text;font-weight:500}"
      + ".rf-tog{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line-2);"
      + "border-radius:10px;padding:9px 13px;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;user-select:none}"
      + ".rf-tog.on{border-color:var(--brand);color:var(--ink)}"
      + ".rf-tog i{width:10px;height:10px;border-radius:3px;background:var(--line-2);display:block}"
      + ".rf-tog.on i{background:var(--brand)}"
      + ".rf-btn{font:inherit;font-size:13px;font-weight:700;color:var(--muted);background:var(--panel);"
      + "border:1px solid var(--line-2);border-radius:10px;padding:9px 14px;cursor:pointer;white-space:nowrap}"
      + ".rf-btn:hover{border-color:var(--brand);color:var(--brand)}"
      + ".rf-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;"
      + "box-shadow:var(--shadow);padding:20px 22px}"
      + ".rf-h{font-size:16px;font-weight:800;color:var(--ink);margin-bottom:4px}"
      + ".rf-h .n{font-weight:600;color:var(--faint);font-size:14px;margin-left:6px}"
      + ".rf-sub{font-size:13px;color:var(--muted);line-height:1.55;margin-bottom:14px;max-width:110ch}"
      // the zebra used 14% of --line, a hairline tint that reads as NO styling at all on a
      // white panel (his screenshot). Stripe on the ink instead, band the header, and give
      // rows real separation.
      + ".rf-tbl{width:100%;border-collapse:collapse;font-size:13.5px}"
      + ".rf-tbl th{padding:10px 12px;font-size:11px;font-weight:800;text-transform:uppercase;"
      + "letter-spacing:.05em;color:var(--muted);border-bottom:2px solid var(--line-2);text-align:left;"
      + "white-space:nowrap;position:sticky;top:0;background:var(--panel-2);z-index:1}"
      + ".rf-tbl td{padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:middle}"
      + ".rf-tbl tbody tr:nth-child(even) td{background:color-mix(in srgb,var(--ink) 3.5%,transparent)}"
      + ".rf-tbl tbody tr:hover td{background:color-mix(in srgb,var(--brand) 12%,transparent)}"
      + ".rf-nowrap{white-space:nowrap}"
      + ".rf-name{font-weight:750}"
      + ".rf-mail a{color:var(--blue);text-decoration:none;font-weight:600}"
      + ".rf-mail a:hover{text-decoration:underline}"
      + ".rf-dim{color:var(--faint)}"
      + ".rf-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11.5px;"
      + "font-weight:700;background:color-mix(in srgb,var(--pos) 12%,transparent);color:var(--pos);white-space:nowrap}"
      + ".rf-pill.q{background:color-mix(in srgb,var(--warn) 12%,transparent);color:var(--warn)}"
      + ".rf-pill.bad{background:color-mix(in srgb,var(--neg,#dc2626) 12%,transparent);color:var(--neg,#dc2626)}"
      + ".rf-why{font-size:11.5px;color:var(--muted);margin-top:3px;max-width:230px;white-space:normal;line-height:1.4}"
      + ".rf-plat{font-size:12.5px;color:var(--muted);white-space:nowrap}"
      + ".rf-wrap{overflow:auto;max-height:70vh;border:1px solid var(--line);border-radius:12px}"
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
                                            src: "", mt: "", size: "", sp: "", verdict: "" });
    /* THE GATES (Tornike 2026-08-19, confirmed 2026-08-20): a five-star review alone is not
     * enough to ask for a referral. GOOD TO ASK = the customer rated the move 10/10 on the
     * closing AND the bill stayed within 25% (and $300) of the quote's top end. Anything
     * rated below 10, or a bill that ran away, is RULED OUT — shown and flagged, never
     * hidden, so the list stays checkable. A missing score is its own bucket: absence of
     * evidence, not a verdict. */
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
    host.innerHTML = '<div class="rf-card">Loading five-star reviewers…</div>';

    RS.load("referral_candidates").then(function (rows) {
      rows = (rows || []).map(function (r) {
        r["Five Star Reviews"] = +r["Five Star Reviews"] || 1;
        r["Lead Matched"] = +r["Lead Matched"] || 0;
        r["Counted"] = +r["Counted"] || 0;
        r.Day = String(r["Event Date"] || "").slice(0, 10);
        r._g = gate(r);
        return r;
      });
      if (!rows.length) {
        host.innerHTML = '<div class="rf-card">No five-star reviews found — the table may ' +
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
          if (S.co && r.Company !== S.co) return false;
          if (S.plat && platsOf(r).indexOf(S.plat) < 0) return false;
          if (S.src && r["Lead Source"] !== S.src) return false;
          if (S.mt && r["Move Type"] !== S.mt) return false;
          if (S.size && r["Size of Move"] !== S.size) return false;
          if (S.sp && r["Sales Person"] !== S.sp) return false;
          if (S.verdict && r._g.v !== S.verdict) return false;
          if (S.contact && !r.Email && !r.Phone) return false;
          if (S.q) {
            var q = S.q.toLowerCase();
            if (String(r.Customer || "").toLowerCase().indexOf(q) < 0
              && String(r.Email || "").toLowerCase().indexOf(q) < 0
              && String(r.Phone || "").toLowerCase().indexOf(q) < 0
              && String(r["Request No"] || "").toLowerCase().indexOf(q) < 0) return false;
          }
          return true;
        }).sort(function (a, b) { return String(b.Day).localeCompare(String(a.Day)); });
      }

      function sel(id, label, current, values) {
        return '<label class="rf-fld"><span>' + label + '</span><select id="' + id + '">'
          + '<option value="">All</option>'
          + Object.keys(values).sort().map(function (v) {
              return '<option value="' + esc(v) + '"' + (current === v ? " selected" : "")
                + ">" + esc(v) + "</option>";
            }).join("") + "</select></label>";
      }

      function paint() {
        var v = view();
        // coverage: the literal answer to "do we have all the data?"
        var withMail = v.filter(function (r) { return r.Email; }).length;
        var withPhone = v.filter(function (r) { return r.Phone; }).length;
        var unmatched = v.filter(function (r) { return !r["Lead Matched"]; }).length;
        var fiveTotal = v.reduce(function (a, r) { return a + r["Five Star Reviews"]; }, 0);
        var gOk = v.filter(function (r) { return r._g.v === "ok"; }).length;
        var gBad = v.filter(function (r) { return r._g.v === "bad"; }).length;
        var gNos = v.length - gOk - gBad;
        var pctOf = function (n) { return v.length ? Math.round(n / v.length * 100) + "%" : "—"; };

        var html = '<div class="rf">'
          + '<div class="rs-page-head"><h1>List of Possible Referrals</h1>'
          + "<p>Customers who left a <b>five-star review</b> — with the email and phone "
          + "their lead carried. Newest review first."
          + '<span class="freshness"> · reviews since 2025 · contact details come from the '
          + "lead the move was booked on</span></p></div>"
          + '<div class="rf-kpis">'
          + kpi(v.length.toLocaleString(), "Five-star customers", fiveTotal.toLocaleString() + " five-star reviews between them", "")
          + kpi(gOk.toLocaleString(), "Good to ask",
                "rated the move 10/10 and the bill stayed near the quote", "pos")
          + kpi(gBad.toLocaleString(), "Ruled out — არ ვარგა",
                "rated below 10, or the bill ran 25%+ over the quote", gBad ? "warn" : "pos")
          + kpi(gNos.toLocaleString(), "No score on the closing",
                "nothing to judge by — neither ruled in nor out", "")
          + kpi(withMail.toLocaleString(), "With an email", pctOf(withMail) + " of the list", "pos")
          + kpi(withPhone.toLocaleString(), "With a phone", pctOf(withPhone) + " of the list", "pos")
          + "</div>"
          + '<div class="rf-bar">'
          + sel("rfCo", "Company", S.co, allCos)
          + sel("rfPlat", "Platform", S.plat, allPlats)
          + sel("rfSrc", "Source", S.src, allSrc)
          + sel("rfMt", "Move type", S.mt, allMt)
          + sel("rfSize", "Size", S.size, allSize)
          + sel("rfSp", "Sales person", S.sp, allSp)
          + '<label class="rf-fld"><span>Verdict</span><select id="rfVerdict">'
          + '<option value="">All</option>'
          + '<option value="ok"' + (S.verdict === "ok" ? " selected" : "") + ">Good to ask</option>"
          + '<option value="bad"' + (S.verdict === "bad" ? " selected" : "") + ">Ruled out</option>"
          + '<option value="nos"' + (S.verdict === "nos" ? " selected" : "") + ">No score</option>"
          + "</select></label>"
          + '<div class="rf-tog' + (S.contact ? " on" : "") + '" id="rfContact"><i></i>Only with contact details</div>'
          + '<label class="rf-fld"><span>Find</span><input id="rfQ" placeholder="Name, email, phone or request…" '
          + 'value="' + esc(S.q) + '"></label>'
          + '<span style="flex:1"></span>'
          + '<button class="rf-btn" id="rfMail">Copy emails · ' + withMail + "</button>"
          + '<button class="rf-btn" id="rfPhone">Copy phones · ' + withPhone + "</button>"
          + '<button class="rf-btn" id="rfCsv">Download CSV · ' + v.length + "</button>"
          + "</div>"
          + '<div class="rf-card"><div class="rf-h">The list<span class="n">' + v.length + "</span></div>"
          + '<div class="rf-sub">Every five-star reviewer, matched back to the lead the move was booked on. '
          + "A blank email or phone means the lead was created without one — "
          + (unmatched ? unmatched + " could not be matched to a lead at all and carry the name and request number only. " : "")
          + "Rows marked <i>uncounted</i> are reviews the platform later filtered; the customer still wrote them, "
          + "so they still belong on a referral list.</div>";

        if (!v.length) {
          html += '<div class="rf-note">Nothing matches these filters.</div></div></div>';
          host.innerHTML = html;
          wire();
          return;
        }
        var CAP = 1000;
        html += '<div class="rf-wrap"><table class="rf-tbl"><thead><tr>'
          + "<th>Verdict</th><th>Review</th><th>Customer</th><th>Email</th><th>Phone</th><th>Platform</th>"
          + "<th>Reviews</th><th>Score</th><th>Company</th><th>Request #</th><th>Move type</th><th>Size</th>"
          + "<th>Route</th><th>Source</th><th>Sales person</th>"
          + "</tr></thead><tbody>"
          + v.slice(0, CAP).map(function (r) {
              var route = [r["Pickup State"], r["Delivery State"]].filter(Boolean).join(" → ");
              var g = r._g;
              var vcell = g.v === "ok"
                ? '<span class="rf-pill">good to ask</span>'
                : g.v === "bad"
                  ? '<span class="rf-pill bad" title="' + esc(g.why.join("; ")) + '">არ ვარგა</span>'
                    + '<div class="rf-why">' + esc(g.why.join(" · ")) + "</div>"
                  : '<span class="rf-pill q">no score</span>';
              return '<tr><td>' + vcell + "</td>"
                + '<td class="rf-nowrap">' + esc(dayLab(r.Day)) + "</td>"
                + '<td class="rf-name">' + esc(r.Customer || "—") + "</td>"
                + '<td class="rf-mail">' + (r.Email
                    ? '<a href="mailto:' + esc(r.Email) + '">' + esc(r.Email) + "</a>"
                    : '<span class="rf-dim">—</span>') + "</td>"
                + '<td class="rf-nowrap">' + (r.Phone ? esc(r.Phone) : '<span class="rf-dim">—</span>') + "</td>"
                + '<td class="rf-plat">' + esc(r.Platforms || "—") + "</td>"
                + "<td>" + (r["Counted"]
                    ? '<span class="rf-pill">★ ' + r["Five Star Reviews"] + "</span>"
                    : '<span class="rf-pill q" title="the platform later filtered this review; the customer still wrote it">★ '
                      + r["Five Star Reviews"] + " · uncounted</span>") + "</td>"
                + "<td>" + (r["Satisfaction Score"] == null || r["Satisfaction Score"] === ""
                    ? '<span class="rf-dim">—</span>' : esc(String(r["Satisfaction Score"])) + "/10") + "</td>"
                + "<td>" + esc(r.Company || "—") + "</td>"
                + "<td>" + esc(r["Request No"] || "—") + "</td>"
                + '<td class="rf-nowrap">' + esc(r["Move Type"] || "—") + "</td>"
                + "<td>" + esc(r["Size of Move"] || "—") + "</td>"
                + '<td class="rf-nowrap">' + esc(route || "—") + "</td>"
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
        return '<div class="rf-kpi ' + (cls || "") + '"><b>' + esc(val) + "</b><span>" + esc(lab)
          + "</span><small>" + esc(sub) + "</small></div>";
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
        [["rfCo", "co"], ["rfPlat", "plat"], ["rfSrc", "src"], ["rfMt", "mt"],
         ["rfSize", "size"], ["rfSp", "sp"], ["rfVerdict", "verdict"]].forEach(function (pair) {
          var el = host.querySelector("#" + pair[0]);
          if (el) el.onchange = function () { S[pair[1]] = this.value; paint(); };
        });
        var tg = host.querySelector("#rfContact");
        if (tg) tg.onclick = function () { S.contact = !S.contact; paint(); };
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
          var cols = ["Review Date", "Customer", "Email", "Phone", "Platforms",
                      "Five Star Reviews", "Counted", "Company", "Request No",
                      "Move Type", "Size of Move", "Lead Source",
                      "Pickup State", "Delivery State", "Sales Person",
                      "Satisfaction Score", "Bill Total", "Quote High", "Verdict"];
          var cell = function (x) {
            var s = String(x == null ? "" : x);
            // customer-typed values opening as live Excel formulas is a real attack
            // surface; a leading space neutralises =, +, - and @ without mangling data
            if (/^[=+\-@]/.test(s)) s = " " + s;
            return '"' + s.replace(/"/g, '""') + '"';
          };
          var lines = [cols.map(cell).join(",")].concat((v || []).map(function (r) {
            return [r.Day, r.Customer, r.Email, r.Phone, r.Platforms,
                    r["Five Star Reviews"], r.Counted ? "counted" : "uncounted",
                    r.Company, r["Request No"], r["Move Type"], r["Size of Move"],
                    r["Lead Source"], r["Pickup State"],
                    r["Delivery State"], r["Sales Person"],
                    r["Satisfaction Score"], r["Bill Total"], r["Quote High"],
                    r._g.v === "ok" ? "good to ask"
                      : r._g.v === "bad" ? "ruled out: " + r._g.why.join("; ")
                      : "no score"].map(cell).join(",");
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
      host.innerHTML = '<div class="rf-card">Could not load the referral list — '
        + esc(e && e.message || e) + "</div>";
    });
  },
});
})();
