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
             "Move Type", "Pickup State", "Delivery State", "Sales Person", "Lead Matched"],
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
      + ".rf-tbl{width:100%;border-collapse:collapse;font-size:13.5px}"
      + ".rf-tbl th{padding:9px 11px;font-size:11px;font-weight:800;text-transform:uppercase;"
      + "letter-spacing:.05em;color:var(--faint);border-bottom:2px solid var(--line);text-align:left;"
      + "white-space:nowrap;position:sticky;top:0;background:var(--panel);z-index:1}"
      + ".rf-tbl td{padding:9px 11px;border-top:1px solid var(--line);vertical-align:middle}"
      + ".rf-tbl tbody tr:nth-child(even){background:color-mix(in srgb,var(--line) 14%,transparent)}"
      + ".rf-tbl tbody tr:hover{background:color-mix(in srgb,var(--brand-d,var(--brand)) 7%,transparent)}"
      + ".rf-name{font-weight:750}"
      + ".rf-mail a{color:var(--blue);text-decoration:none;font-weight:600}"
      + ".rf-mail a:hover{text-decoration:underline}"
      + ".rf-dim{color:var(--faint)}"
      + ".rf-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11.5px;"
      + "font-weight:700;background:color-mix(in srgb,var(--pos) 12%,transparent);color:var(--pos);white-space:nowrap}"
      + ".rf-pill.q{background:color-mix(in srgb,var(--warn) 12%,transparent);color:var(--warn)}"
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
    var S = window.__RF || (window.__RF = { q: "", co: "", plat: "", contact: false });
    injectStyle();
    host.innerHTML = '<div class="rf-card">Loading five-star reviewers…</div>';

    RS.load("referral_candidates").then(function (rows) {
      rows = (rows || []).map(function (r) {
        r["Five Star Reviews"] = +r["Five Star Reviews"] || 1;
        r["Lead Matched"] = +r["Lead Matched"] || 0;
        r["Counted"] = +r["Counted"] || 0;
        r.Day = String(r["Event Date"] || "").slice(0, 10);
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
      var allPlats = {};
      var allCos = {};
      rows.forEach(function (r) {
        platsOf(r).forEach(function (p) { allPlats[p] = 1; });
        if (r.Company) allCos[r.Company] = 1;
      });

      function view() {
        return rows.filter(function (r) {
          if (S.co && r.Company !== S.co) return false;
          if (S.plat && platsOf(r).indexOf(S.plat) < 0) return false;
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

      function paint() {
        var v = view();
        // coverage: the literal answer to "do we have all the data?"
        var withMail = v.filter(function (r) { return r.Email; }).length;
        var withPhone = v.filter(function (r) { return r.Phone; }).length;
        var unmatched = v.filter(function (r) { return !r["Lead Matched"]; }).length;
        var fiveTotal = v.reduce(function (a, r) { return a + r["Five Star Reviews"]; }, 0);
        var pctOf = function (n) { return v.length ? Math.round(n / v.length * 100) + "%" : "—"; };

        var html = '<div class="rf">'
          + '<div class="rs-page-head"><h1>List of Possible Referrals</h1>'
          + "<p>Customers who left a <b>five-star review</b> — with the email and phone "
          + "their lead carried. Newest review first."
          + '<span class="freshness"> · reviews since 2025 · contact details come from the '
          + "lead the move was booked on</span></p></div>"
          + '<div class="rf-kpis">'
          + kpi(v.length.toLocaleString(), "Five-star customers", fiveTotal.toLocaleString() + " five-star reviews between them", "")
          + kpi(withMail.toLocaleString(), "With an email", pctOf(withMail) + " of the list", "pos")
          + kpi(withPhone.toLocaleString(), "With a phone", pctOf(withPhone) + " of the list", "pos")
          + kpi(String(unmatched), "No lead matched",
                unmatched ? "name and request number only — no contact on file" : "every reviewer matched a lead",
                unmatched ? "warn" : "pos")
          + "</div>"
          + '<div class="rf-bar">'
          + '<label class="rf-fld"><span>Company</span><select id="rfCo"><option value="">Both books</option>'
          + Object.keys(allCos).sort().map(function (c) {
              return '<option value="' + esc(c) + '"' + (S.co === c ? " selected" : "") + ">" + esc(c) + "</option>";
            }).join("") + "</select></label>"
          + '<label class="rf-fld"><span>Platform</span><select id="rfPlat"><option value="">All platforms</option>'
          + Object.keys(allPlats).sort().map(function (p) {
              return '<option value="' + esc(p) + '"' + (S.plat === p ? " selected" : "") + ">" + esc(p) + "</option>";
            }).join("") + "</select></label>"
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
          + "<th>Review</th><th>Customer</th><th>Email</th><th>Phone</th><th>Platform</th>"
          + "<th>Reviews</th><th>Company</th><th>Request #</th><th>Move</th><th>Sales person</th>"
          + "</tr></thead><tbody>"
          + v.slice(0, CAP).map(function (r) {
              var move = [r["Move Type"], [r["Pickup State"], r["Delivery State"]]
                .filter(Boolean).join(" → ")].filter(Boolean).join(" · ");
              return "<tr><td>" + esc(dayLab(r.Day)) + "</td>"
                + '<td class="rf-name">' + esc(r.Customer || "—") + "</td>"
                + '<td class="rf-mail">' + (r.Email
                    ? '<a href="mailto:' + esc(r.Email) + '">' + esc(r.Email) + "</a>"
                    : '<span class="rf-dim">—</span>') + "</td>"
                + "<td>" + (r.Phone ? esc(r.Phone) : '<span class="rf-dim">—</span>') + "</td>"
                + '<td class="rf-plat">' + esc(r.Platforms || "—") + "</td>"
                + "<td>" + (r["Counted"]
                    ? '<span class="rf-pill">★ ' + r["Five Star Reviews"] + "</span>"
                    : '<span class="rf-pill q" title="the platform later filtered this review; the customer still wrote it">★ '
                      + r["Five Star Reviews"] + " · uncounted</span>") + "</td>"
                + "<td>" + esc(r.Company || "—") + "</td>"
                + "<td>" + esc(r["Request No"] || "—") + "</td>"
                + '<td class="rf-plat">' + esc(move || "—") + "</td>"
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
        var co = host.querySelector("#rfCo");
        if (co) co.onchange = function () { S.co = this.value; paint(); };
        var pl = host.querySelector("#rfPlat");
        if (pl) pl.onchange = function () { S.plat = this.value; paint(); };
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
                      "Move Type", "Pickup State", "Delivery State", "Sales Person"];
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
                    r.Company, r["Request No"], r["Move Type"], r["Pickup State"],
                    r["Delivery State"], r["Sales Person"]].map(cell).join(",");
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
