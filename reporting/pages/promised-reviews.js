/* PROMISED A REVIEW — the follow-up list, and the record of what went to Birdie.
 *
 * Marketing asked for this list on its own (it also lives inside Response Analysis), and for
 * the nightly hand-off that acts on it. Two views:
 *
 *   THE LIST   customers whose foreman reported "they promised to write later", who have not
 *              written one since, and who have not already been handed over.
 *   THE LOG    what actually went to Birdie, and when.
 *
 * NOBODY IS ASKED TWICE. A job leaves this list the moment it is handed over and never comes
 * back: `birdie_sent` carries a UNIQUE key on the job code, so the guarantee is the
 * database's, not a filter's. Tornike's unit is the JOB, so a repeat customer moving again is
 * a new experience and may be asked about that move.
 *
 * WE DO NOT EMAIL THE CUSTOMER. The nightly file goes to Birdie, who send the review forms.
 *
 * A ROW WITH NO EMAIL IS SHOWN BUT NOT SENT. Birdie asks by email, and stamping an
 * unreachable row as handed over would retire the job for good over a missing address. Those
 * rows sit here marked "no email" until somebody fills one in.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.review_promised) {
      RS.DATASETS.review_promised = {
        table: "mart_review_promised",
        // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives.
        cols: ["job_code", "promised_at", "foreman", "job_date", "customer", "email",
               "mobile", "Can Send", "Age Days",
               // THE OUTCOME. This list is a projection contract: omit one of these and the
               // page silently reports every promise as un-asked, with no error anywhere.
               "Status", "Request Sent At", "Reviewed", "Days Since Sent"],
      };
    }
    // ⭐ THE TYPED EMAIL, READ STRAIGHT FROM ITS OWN TABLE. The mart already COALESCEs this
    // override in -- but the mart is a table rebuilt hourly, so between the save and that
    // rebuild it still reports the OLD empty address. The page would then show "needs an
    // email" over a value somebody had just typed, which is indistinguishable from the save
    // having been lost. This is the same defect he reported on LD Planning, and I shipped it
    // here the same morning: a write path that patches the row in memory looks perfect until
    // the first reload.
    if (!RS.DATASETS.review_email_override) {
      RS.DATASETS.review_email_override = {
        table: "review_contact_override",
        cols: ["Job Code", "Email", "Updated By", "Updated At"],
      };
    }
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("prv-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "prv-style";
    // Bars, fields, tiles, tables and pills are THE COMPONENT KIT in rs.css. Only what the
    // kit has no name for lives here.
    st.textContent = ""
      + ".prv{font-variant-numeric:tabular-nums}"
      + ".prv-pg{display:flex;align-items:center;gap:10px;padding:12px 14px;"
      + "border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}"
      + ".prv-pg .rs-spacer{flex:1}"
      + ".prv-c a{color:var(--blue);text-decoration:none;font-weight:600}"
      + ".prv-c a:hover{text-decoration:underline}"
      + ".prv-c .sep{color:var(--faint);margin:0 6px}"
      + ".prv-sub{display:block;font-size:11px;color:var(--dim);margin-top:3px;white-space:nowrap}"
      + ".prv-edit{display:inline-flex;gap:6px;align-items:center}"
      + ".prv-em{min-width:210px;padding:3px 7px;font-size:12px}"
      + ".prv-save{padding:3px 10px;font-size:12px}"
      + ".prv-pen{border:0;background:none;cursor:pointer;color:var(--faint);font-size:12px;padding:0 4px}"
      + ".prv-pen:hover{color:var(--blue)}";
    document.head.appendChild(st);
  }

  const PAGE = 25;

  registerPage({
    id: "promised-reviews",
    group: "marketing",
    title: "Promised Reviews",
    subtitle: "Customers who said they would write a review — and the nightly hand-off to " +
              "Birdie that asks them, once each.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);

      const S = window.__PRV || (window.__PRV = {
        page: 0, q: "", onlySendable: false,
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading the follow-up list…</div>';

      // The mart, plus the overrides it has not absorbed yet. An empty override table is a
      // normal state, not a failure -- the list must still render if nobody has typed one.
      Promise.all([
        RS.load("review_promised"),
        RS.load("review_email_override").catch(() => []),
      ]).then(([rows, ovr]) => {
        if (!alive()) return;
        const byJob = {};
        (ovr || []).forEach(o => {
          const em = String(o["Email"] || "").trim();
          if (em) byJob[String(o["Job Code"] || "").trim().toUpperCase()] = em;
        });
        rows = (rows || []).map(r => {
          r.canSend = +r["Can Send"] === 1;
          r.age = r["Age Days"] == null ? null : +r["Age Days"];
          r.status = String(r["Status"] || "Not asked yet");
          r.sentAt = r["Request Sent At"] || null;
          r.reviewed = +r["Reviewed"] === 1;   // detail only -- Status is the verdict
          r.daysSinceSent = r["Days Since Sent"] == null ? null : +r["Days Since Sent"];
          // THE TYPED ADDRESS WINS UNTIL THE MART CATCHES UP. Only "No email" is rewritten:
          // a row already asked or already reviewed keeps that verdict, because an address
          // typed afterwards changes how we reach them, not what has happened to them.
          const typed = byJob[String(r.job_code || "").trim().toUpperCase()];
          if (typed) {
            r.email = typed;
            if (r.status === "No email") { r.status = "Not asked yet"; r.canSend = true; }
          }
          return r;
        });
        paint(rows);
      }).catch(e => {
        if (!alive()) return;
        host.innerHTML = '<div class="panel">Could not load — ' + esc(e && e.message || e)
          + "</div>";
      });

      function fmtDate(v) {
        const s = String(v || "");
        return s ? s.slice(0, 10) : "—";
      }

      // The whole point of the page now: what happened to this promise. Each chip also
      // carries the WHEN, because "sent" without a date is the kind of status nobody trusts.
      // THE DATABASE OWNS THE VERDICT. This used to re-derive it from three raw fields,
      // and when a column arrived under a different name than expected the browser quietly
      // decided a customer who had ALREADY REVIEWED "needs an email". `Status` is computed
      // once, in SQL; the raw fields are only for the detail line underneath.
      function statusCell(r) {
        // "reviewed" and nothing else. It used to add "Nd after we asked" or "wrote
        // before we asked", which reads as a verdict on whether the request worked -- see
        // the KPI note. The review exists; that is the whole claim.
        if (r.status === "Reviewed") {
          return '<span class="rs-pill ok">reviewed</span>';
        }
        if (r.status === "Request sent") {
          return '<span class="rs-pill">request sent</span><span class="prv-sub">'
            + esc(fmtDate(r.sentAt))
            + (r.daysSinceSent != null ? " · " + r.daysSinceSent + "d ago" : "") + "</span>";
        }
        if (r.status === "No email") {
          return '<span class="rs-pill warn">needs an email</span>';
        }
        return '<span class="rs-pill mute">not asked yet</span>';
      }

      function contact(r) {
        const m = String(r.email || "").trim(), t = String(r.mobile || "").trim();
        const job = esc(r.job_code || "");
        const tel = t ? '<a href="tel:' + esc(t.replace(/[^0-9+]/g, "")) + '">'
          + esc(t) + "</a>" : "";

        // NO ADDRESS: the box goes right here, because this is the row somebody is looking
        // at when they realise they know the email. It is also the only thing standing
        // between this customer and being asked.
        if (!m) {
          return '<span class="prv-c prv-edit">'
            + '<input class="rs-inp prv-em" data-job="' + job + '" type="email" '
            + 'placeholder="add an email to unblock this one…">'
            + '<button class="rs-btn prv-save" data-job="' + job + '">Save</button>'
            + (tel ? '<span class="sep">·</span>' + tel : "") + "</span>";
        }
        // HAS ONE: keep the row readable, but an address we hold can be wrong and somebody
        // chasing a bounce needs to fix it without leaving the page.
        return '<span class="prv-c">'
          + '<a href="mailto:' + esc(m) + '">' + esc(m) + "</a>"
          + '<button class="prv-pen" data-job="' + job
          + '" title="Change this address">✎</button>'
          + (tel ? '<span class="sep">·</span>' + tel : "") + "</span>";
      }

      function pager(total, page, pages, id) {
        const from = total ? page * PAGE + 1 : 0;
        const to = Math.min(total, (page + 1) * PAGE);
        return '<div class="prv-pg"><span>Showing <b>' + from + "–" + to
          + "</b> of <b>" + total.toLocaleString() + "</b></span>"
          + '<span class="rs-spacer"></span>'
          + '<button class="rs-btn" data-pg="' + id + ':prev"'
          + (page <= 0 ? " disabled" : "") + ">Previous</button>"
          + "<span>Page " + (page + 1) + " of " + Math.max(1, pages) + "</span>"
          + '<button class="rs-btn" data-pg="' + id + ':next"'
          + (page >= pages - 1 ? " disabled" : "") + ">Next</button></div>";
      }

      function paint(rows) {
        if (!alive()) return;

        const q = S.q.trim().toLowerCase();
        let list = rows.filter(r => {
          if (S.onlySendable && !r.canSend) return false;
          if (!q) return true;
          return [r.customer, r.job_code, r.email, r.foreman].some(v =>
            String(v || "").toLowerCase().indexOf(q) >= 0);
        // NEWEST PROMISE FIRST (his call). It was oldest-first, which suits a queue you
        // are working down but buries what just happened -- and now that the table
        // carries outcomes, today's sends are the rows anyone opens it to see.
        }).sort((a, b) => String(b.promised_at || "").localeCompare(
                          String(a.promised_at || "")));

        const sendable = rows.filter(r => r.canSend).length;
        const pages = Math.max(1, Math.ceil(list.length / PAGE));
        if (S.page >= pages) S.page = pages - 1;
        if (S.page < 0) S.page = 0;
        const shown = list.slice(S.page * PAGE, S.page * PAGE + PAGE);

        // RESTORED. Retiring the hand-off tab, I cut from the old `logSorted` line down
        // to here -- and the page head sat between them, so `html` lost its declaration
        // and the page died with "html is not defined". Shipped it, saw it, fixing it.
        let html = '<div class="prv">'
          + '<div class="rs-page-head"><h1>Promised Reviews</h1>'
          + "<p>Customers whose foreman reported that they would write a review later. "
          // NOT "every night" -- there is no scheduler. His ruling 2026-09-07: the
          // trigger is the foreman's own submission, seconds after he answers.
          + "The moment a foreman answers, that customer is sent a review form by "
          + "<b>Birdeye</b>, <b>each job once, and never again</b>."
          + '<span class="freshness"> · a row here means the form actually went, from the ledger</span></p></div>';

        const asked = rows.filter(r => r.sentAt).length;
        const reviewed = rows.filter(r => r.status === "Reviewed").length;
        const waiting = rows.filter(r => r.status === "Not asked yet").length;
        const noEmail = rows.filter(r => r.status === "No email").length;

        // THREE FACTS, NO CAUSATION. There was a fourth KPI here -- "Converted" -- and it
        // could not be earned: proving a review CAME FROM our request needs the date the
        // customer wrote (Birdeye has it, we do not) and an attribution from review back to
        // the person we asked (customerId was null on all 20 recent reviews). The honest
        // fallback is matching reviewer names to customer names, which is the fuzzy match
        // that nearly merged two different salespeople -- and here it would err in the
        // flattering direction. A rate nobody can stand behind still gets quoted.
        html += '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(rows.length.toLocaleString(), "Promised a review",
                "every promise a foreman has relayed", "")
          + kpi(asked.toLocaleString(), "Request sent",
                waiting + " still waiting to be asked", asked ? "pos" : "warn")
          + kpi(reviewed.toLocaleString(), "Have reviewed",
                "a review exists for that job", reviewed ? "pos" : "")
          + kpi(noEmail.toLocaleString(), "No email",
                "cannot be asked until somebody fills one in", noEmail ? "warn" : "")
          + "</div>";

        {
          html += '<div class="rs-bar" style="margin-top:14px">'
            + '<label class="rs-fld"><span>Find</span>'
            + '<input class="rs-inp" id="prvQ" placeholder="Customer, job, email or foreman…" '
            + 'value="' + esc(S.q) + '"></label>'
            + '<div class="rs-tog' + (S.onlySendable ? " on" : "") + '" id="prvSend"><i></i>'
            + "Only those we can actually send</div>"
            + '<span class="rs-spacer"></span>'
            + '<button class="rs-btn" id="prvCsv">Download CSV · ' + list.length + "</button>"
            + "</div>";

          html += '<div class="panel" style="padding:0">'
            + '<div class="rs-tablewrap" style="border:0">'
            + '<table class="rs-table rs-even"><thead><tr>'
            + "<th>Promised</th><th class=\"num\">Age</th><th>Job</th><th>Job date</th>"
            + "<th>Customer</th><th>Contact</th><th>Foreman</th><th>Status</th>"
            + "</tr></thead><tbody>"
            + (shown.length ? shown.map(r =>
                "<tr><td class=\"nowrap\">" + esc(fmtDate(r.promised_at)) + "</td>"
                + '<td class="num nowrap">' + (r.age == null ? "—" : r.age + "d") + "</td>"
                + '<td class="strong nowrap">' + esc(r.job_code || "—") + "</td>"
                + '<td class="nowrap muted">' + esc(fmtDate(r.job_date)) + "</td>"
                + "<td>" + esc(r.customer || "—") + "</td>"
                + "<td>" + contact(r) + "</td>"
                + '<td class="muted">' + esc(r.foreman || "—") + "</td>"
                + "<td>" + statusCell(r) + "</td></tr>"
              ).join("")
              : '<tr><td colspan="8" class="dim">Nobody is waiting — everyone who promised '
                + "has either written a review or been handed over.</td></tr>")
            + "</tbody></table></div>"
            + pager(list.length, S.page, pages, "l") + "</div>";
        }

        html += "</div>";
        host.innerHTML = html;
        wire(rows, list);
      }

      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
          + '</div><div class="v">' + esc(val) + '</div><div class="s">'
          + esc(sub) + "</div></div>";
      }

      // Writes the address, then REPAINTS FROM THE ANSWER rather than assuming it worked.
      // An input that just clears itself leaves the row looking untouched, which is how the
      // same address gets typed twice.
      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(r => r.json().then(j => {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        }));
      }

      function saveEmail(job, addr, rows) {
        const row = rows.filter(x => String(x.job_code) === String(job))[0];
        return api("/api/_revemail", {method: "POST",
                    body: JSON.stringify({job_code: job, email: addr})})
          .then(res => {
            if (!alive()) return;
            if (row) {
              row.email = (res && res.email) || "";
              // ONLY the "can we reach them" half of the verdict moves. Setting the status
              // from the address alone would demote a row we have ALREADY asked, or one that
              // has already been reviewed, back to "not asked yet" -- correcting somebody's
              // address is not an undo of what happened to them. Same rule as the load path.
              if (row.status === "No email" && row.email) row.status = "Not asked yet";
              else if (row.status === "Not asked yet" && !row.email) row.status = "No email";
              row.canSend = !!row.email && !row.sentAt && !row.reviewed;
            }
            paint(rows);
          })
          .catch(e => {
            if (!alive()) return;
            window.alert("Could not save that address — " + (e && e.message || e));
          });
      }

      function wire(rows, list) {
        if (!alive()) return;
        host.querySelectorAll(".prv-save").forEach(b => {
          b.onclick = () => {
            const box = host.querySelector('.prv-em[data-job="' + b.dataset.job + '"]');
            saveEmail(b.dataset.job, box ? box.value.trim() : "", rows);
          };
        });
        host.querySelectorAll(".prv-em").forEach(inp => {
          inp.onkeyup = e => {
            if (e.key === "Enter") saveEmail(inp.dataset.job, inp.value.trim(), rows);
          };
        });
        // THE SAME INLINE EDITOR the empty rows get, rather than a browser prompt. A
        // modal is unstyled, blocks the page, and is the only thing on this portal that
        // would look like that.
        host.querySelectorAll(".prv-pen").forEach(p => {
          p.onclick = () => {
            const row = rows.filter(x => String(x.job_code) === String(p.dataset.job))[0];
            if (row) { row._editing = true; paint(rows); }
          };
        });
        const q = host.querySelector("#prvQ");
        if (q) {
          q.oninput = function () { S.q = this.value; S.page = 0; };
          // repaint on a pause, not on every keystroke: a repaint would take the caret away
          q.onchange = () => paint(rows);
          q.onkeyup = e => { if (e.key === "Enter") paint(rows); };
        }
        const tg = host.querySelector("#prvSend");
        if (tg) tg.onclick = () => { S.onlySendable = !S.onlySendable; S.page = 0; paint(rows); };
        host.querySelectorAll("[data-pg]").forEach(b => {
          b.onclick = () => {
            const [which, dir] = b.dataset.pg.split(":");
            const k = "page";
            S[k] += (dir === "next" ? 1 : -1);
            paint(rows);
          };
        });
        const csv = host.querySelector("#prvCsv");
        if (csv) csv.onclick = () => {
          const cols = ["job_code", "job_date", "customer", "email", "mobile", "foreman",
                        "promised_at", "Age Days", "Can Send"];
          const cell = x => {
            let s = String(x == null ? "" : x);
            // a value opening as a live Excel formula is a real attack surface
            if (/^[=+\-@]/.test(s)) s = " " + s;
            return '"' + s.replace(/"/g, '""') + '"';
          };
          const lines = [cols.map(cell).join(",")].concat((list || []).map(r =>
            cols.map(c => cell(r[c])).join(",")));
          // the BOM is for Excel: without it a non-ASCII name opens as mojibake
          const blob = new Blob(["﻿" + lines.join("\r\n")],
                                { type: "text/csv;charset=utf-8" });
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = "promised-reviews-" + new Date().toISOString().slice(0, 10) + ".csv";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        };
      }
    },
  });
})();
