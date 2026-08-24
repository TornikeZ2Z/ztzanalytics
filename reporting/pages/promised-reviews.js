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
               "mobile", "Can Send", "Age Days"],
      };
    }
    if (!RS.DATASETS.birdie_log) {
      RS.DATASETS.birdie_log = {
        table: "birdie_sent",
        cols: ["Job Code", "Customer", "Customer Email", "Customer Mobile", "Job Date",
               "Foreman", "Promised At", "Batch", "Sent At", "Sent To", "Mode"],
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
      + ".prv-c .sep{color:var(--faint);margin:0 6px}";
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
        view: "list", page: 0, logPage: 0, q: "", onlySendable: false,
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading the follow-up list…</div>';

      Promise.all([
        RS.load("review_promised"),
        // the log is young and may be empty; an empty log is a normal state, not a failure
        RS.load("birdie_log").catch(() => []),
      ]).then(([rows, log]) => {
        if (!alive()) return;
        rows = (rows || []).map(r => {
          r.canSend = +r["Can Send"] === 1;
          r.age = r["Age Days"] == null ? null : +r["Age Days"];
          return r;
        });
        log = log || [];
        paint(rows, log);
      }).catch(e => {
        if (!alive()) return;
        host.innerHTML = '<div class="panel">Could not load — ' + esc(e && e.message || e)
          + "</div>";
      });

      function fmtDate(v) {
        const s = String(v || "");
        return s ? s.slice(0, 10) : "—";
      }

      function contact(mail, tel) {
        const m = String(mail || "").trim(), t = String(tel || "").trim();
        const bits = [];
        if (m) bits.push('<a href="mailto:' + esc(m) + '">' + esc(m) + "</a>");
        if (t) bits.push('<a href="tel:' + esc(t.replace(/[^0-9+]/g, "")) + '">'
          + esc(t) + "</a>");
        return bits.length ? '<span class="prv-c">' + bits.join('<span class="sep">·</span>')
          + "</span>" : '<span class="rs-pill mute">no email</span>';
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

      function paint(rows, log) {
        if (!alive()) return;

        const q = S.q.trim().toLowerCase();
        let list = rows.filter(r => {
          if (S.onlySendable && !r.canSend) return false;
          if (!q) return true;
          return [r.customer, r.job_code, r.email, r.foreman].some(v =>
            String(v || "").toLowerCase().indexOf(q) >= 0);
        }).sort((a, b) => (b.age || 0) - (a.age || 0));

        const sendable = rows.filter(r => r.canSend).length;
        const pages = Math.max(1, Math.ceil(list.length / PAGE));
        if (S.page >= pages) S.page = pages - 1;
        if (S.page < 0) S.page = 0;
        const shown = list.slice(S.page * PAGE, S.page * PAGE + PAGE);

        const logSorted = log.slice().sort((a, b) =>
          String(b["Sent At"] || "").localeCompare(String(a["Sent At"] || "")));
        const lPages = Math.max(1, Math.ceil(logSorted.length / PAGE));
        if (S.logPage >= lPages) S.logPage = lPages - 1;
        if (S.logPage < 0) S.logPage = 0;
        const lShown = logSorted.slice(S.logPage * PAGE, S.logPage * PAGE + PAGE);
        const lastBatch = logSorted.length ? fmtDate(logSorted[0]["Sent At"]) : null;

        let html = '<div class="prv">'
          + '<div class="rs-page-head"><h1>Promised Reviews</h1>'
          + "<p>Customers whose foreman reported that they would write a review later. "
          + "Every night the ones who still have not written are handed to <b>Birdie</b>, "
          + "who send them a review form — <b>each job once, and never again</b>."
          + '<span class="freshness"> · we never email the customer ourselves</span></p></div>';

        html += '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(rows.length.toLocaleString(), "Waiting to be asked",
                "promised, and no review since", rows.length ? "warn" : "pos")
          + kpi(sendable.toLocaleString(), "Ready for tonight",
                "have an email address", "")
          + kpi((rows.length - sendable).toLocaleString(), "Unreachable",
                "no email on file — not sent, not retired",
                (rows.length - sendable) ? "warn" : "")
          + kpi(logSorted.length.toLocaleString(), "Handed over so far",
                lastBatch ? "last on " + lastBatch : "nothing sent yet", "")
          + "</div>";

        html += '<div class="rs-seg" id="prvView">'
          + '<button data-v="list"' + (S.view === "list" ? ' class="on"' : "")
          + ">The list · " + rows.length + "</button>"
          + '<button data-v="log"' + (S.view === "log" ? ' class="on"' : "")
          + ">Sent to Birdie · " + logSorted.length + "</button></div>";

        if (S.view === "list") {
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
            + "<th>Customer</th><th>Contact</th><th>Foreman</th><th>Tonight</th>"
            + "</tr></thead><tbody>"
            + (shown.length ? shown.map(r =>
                "<tr><td class=\"nowrap\">" + esc(fmtDate(r.promised_at)) + "</td>"
                + '<td class="num nowrap">' + (r.age == null ? "—" : r.age + "d") + "</td>"
                + '<td class="strong nowrap">' + esc(r.job_code || "—") + "</td>"
                + '<td class="nowrap muted">' + esc(fmtDate(r.job_date)) + "</td>"
                + "<td>" + esc(r.customer || "—") + "</td>"
                + "<td>" + contact(r.email, r.mobile) + "</td>"
                + '<td class="muted">' + esc(r.foreman || "—") + "</td>"
                + "<td>" + (r.canSend
                    ? '<span class="rs-pill ok">goes tonight</span>'
                    : '<span class="rs-pill warn">needs an email</span>') + "</td></tr>"
              ).join("")
              : '<tr><td colspan="8" class="dim">Nobody is waiting — everyone who promised '
                + "has either written a review or been handed over.</td></tr>")
            + "</tbody></table></div>"
            + pager(list.length, S.page, pages, "l") + "</div>";
        } else {
          html += '<div class="rs-hint" style="margin-top:14px">Every row here has been sent '
            + "to Birdie and <b>will never be sent again</b> — the job code is unique in the "
            + "log, so a repeat is refused by the database rather than by a filter. "
            + "A row sent while the mailer was in <b>test</b> mode is not recorded at all, "
            + "which is why a test run leaves this view unchanged.</div>";

          html += '<div class="panel" style="padding:0">'
            + '<div class="rs-tablewrap" style="border:0">'
            + '<table class="rs-table rs-even"><thead><tr>'
            + "<th>Sent</th><th>Batch</th><th>Job</th><th>Customer</th><th>Email</th>"
            + "<th>Foreman</th><th>To</th>"
            + "</tr></thead><tbody>"
            + (lShown.length ? lShown.map(r =>
                "<tr><td class=\"nowrap\">" + esc(String(r["Sent At"] || "").slice(0, 16))
                + "</td>"
                + '<td class="nowrap muted">' + esc(r.Batch || "—") + "</td>"
                + '<td class="strong nowrap">' + esc(r["Job Code"] || "—") + "</td>"
                + "<td>" + esc(r.Customer || "—") + "</td>"
                + "<td>" + esc(r["Customer Email"] || "—") + "</td>"
                + '<td class="muted">' + esc(r.Foreman || "—") + "</td>"
                + '<td class="muted nowrap">' + esc(r["Sent To"] || "—") + "</td></tr>"
              ).join("")
              : '<tr><td colspan="7" class="dim">Nothing has been handed to Birdie yet. '
                + "The mailer is in test mode until somebody turns it live, and a test run "
                + "deliberately records nothing.</td></tr>")
            + "</tbody></table></div>"
            + pager(logSorted.length, S.logPage, lPages, "g") + "</div>";
        }

        html += "</div>";
        host.innerHTML = html;
        wire(rows, log, list);
      }

      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
          + '</div><div class="v">' + esc(val) + '</div><div class="s">'
          + esc(sub) + "</div></div>";
      }

      function wire(rows, log, list) {
        if (!alive()) return;
        host.querySelectorAll("#prvView button").forEach(b => {
          b.onclick = () => { S.view = b.dataset.v; paint(rows, log); };
        });
        const q = host.querySelector("#prvQ");
        if (q) {
          q.oninput = function () { S.q = this.value; S.page = 0; };
          // repaint on a pause, not on every keystroke: a repaint would take the caret away
          q.onchange = () => paint(rows, log);
          q.onkeyup = e => { if (e.key === "Enter") paint(rows, log); };
        }
        const tg = host.querySelector("#prvSend");
        if (tg) tg.onclick = () => { S.onlySendable = !S.onlySendable; S.page = 0; paint(rows, log); };
        host.querySelectorAll("[data-pg]").forEach(b => {
          b.onclick = () => {
            const [which, dir] = b.dataset.pg.split(":");
            const k = which === "l" ? "page" : "logPage";
            S[k] += (dir === "next" ? 1 : -1);
            paint(rows, log);
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
