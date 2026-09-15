/* BIRDEYE SEND-OUTS — what Marketing sent through Birdeye, and who the weekly survey skipped.
 *
 * His ask 2026-09-15: "a reporting tool in the marketing department to see send-out reports",
 * scoped to two things:
 *
 *   SENT              every review request and survey that actually went out (live sends only),
 *                     newest first, from the send ledger -- a row here means Birdeye was asked.
 *   SURVEY COVERAGE   every Zip to Zip job in a survey week and what happened to it: sent, or
 *                     the reason it was not (has a claim, no email, same email already
 *                     surveyed, still waiting for its Tuesday).
 *
 * THE DATABASE OWNS EVERY VERDICT. `Status` is computed once in SQL (src/birdeye_api.py,
 * beside the campaign that applies the same rules); this page only counts and filters it.
 *
 * WEEKS ARE MONDAY-SUNDAY BY MOVE DATE, sent on the Tuesday two weeks after the week began.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.birdeye_sent) {
      RS.DATASETS.birdeye_sent = {
        table: "mart_birdeye_sent",
        // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives.
        cols: ["Campaign", "Campaign Label", "Job", "Customer", "Email", "Sent At",
               "Sent Date", "Sent Week"],
      };
    }
    if (!RS.DATASETS.birdeye_survey_status) {
      RS.DATASETS.birdeye_survey_status = {
        table: "mart_birdeye_survey_status",
        cols: ["Week Start", "Send Date", "Job", "Request No", "Customer", "Email",
               "Move Date", "Sent At", "Has Claim", "Status"],
      };
    }
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("bes-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "bes-style";
    // Bars, fields, tiles, tables and pills are THE COMPONENT KIT in rs.css. Only what the
    // kit has no name for lives here.
    st.textContent = ""
      + ".bes{font-variant-numeric:tabular-nums}"
      + ".bes-pg{display:flex;align-items:center;gap:10px;padding:12px 14px;"
      + "border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)}"
      + ".bes-pg .rs-spacer{flex:1}"
      + ".bes-tabs{display:flex;gap:8px;margin:14px 0 4px}"
      + ".bes-weeks{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 2px}"
      + ".bes-sub{display:block;font-size:11px;color:var(--dim);margin-top:3px;white-space:nowrap}"
      + ".bes-note{font-size:12px;color:var(--muted);margin:6px 2px 0}";
    document.head.appendChild(st);
  }

  const PAGE = 25;
  const STATUSES = ["Sent", "Has a claim", "No email", "Same email already surveyed",
                    "Waiting for its Tuesday", "Not sent"];

  registerPage({
    id: "birdeye-sends",
    group: "marketing",
    title: "Birdeye Send-outs",
    subtitle: "Every review request and survey sent through Birdeye — and, for the weekly " +
              "survey, who was not asked and why.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);

      const S = window.__BES || (window.__BES = {
        tab: "sent", q: "", campaign: "all", page: 0,
        week: null, status: "all", cq: "", cpage: 0,
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading the Birdeye send-outs…</div>';

      Promise.all([RS.load("birdeye_sent"), RS.load("birdeye_survey_status")])
        .then(([sent, cov]) => {
          if (!alive()) return;
          paint(sent || [], cov || []);
        })
        .catch(e => {
          if (!alive()) return;
          host.innerHTML = '<div class="panel">Could not load — ' + esc(e && e.message || e)
            + "</div>";
        });

      const d10 = v => { const s = String(v || ""); return s ? s.slice(0, 10) : "—"; };
      const dt16 = v => { const s = String(v || "").replace("T", " "); return s ? s.slice(0, 16) : "—"; };

      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
          + '</div><div class="v">' + esc(val) + '</div><div class="s">'
          + esc(sub) + "</div></div>";
      }

      function pager(total, page, pages, id) {
        const from = total ? page * PAGE + 1 : 0;
        const to = Math.min(total, (page + 1) * PAGE);
        return '<div class="bes-pg"><span>Showing <b>' + from + "–" + to
          + "</b> of <b>" + total.toLocaleString() + "</b></span>"
          + '<span class="rs-spacer"></span>'
          + '<button class="rs-btn" data-pg="' + id + ':prev"' + (page <= 0 ? " disabled" : "")
          + ">Previous</button><span>Page " + (page + 1) + " of " + Math.max(1, pages) + "</span>"
          + '<button class="rs-btn" data-pg="' + id + ':next"'
          + (page >= pages - 1 ? " disabled" : "") + ">Next</button></div>";
      }

      function statusPill(st) {
        const cls = st === "Sent" ? "ok"
          : (st === "No email" || st === "Not sent") ? "warn"
          : st === "Waiting for its Tuesday" ? "" : "mute";
        return '<span class="rs-pill ' + cls + '">' + esc(st.toLowerCase()) + "</span>";
      }

      function campaignPill(r) {
        const c = String(r["Campaign"] || "");
        return '<span class="rs-pill' + (c === "survey" ? " ok" : "") + '">'
          + esc(r["Campaign Label"] || c) + "</span>";
      }

      function paint(sent, cov) {
        if (!alive()) return;
        let html = '<div class="bes">'
          + '<div class="rs-page-head"><h1>Birdeye Send-outs</h1>'
          + "<p>What we sent through <b>Birdeye</b>: review requests the moment a foreman hears "
          + "a promise, and the <b>weekly Monthly Survey</b> every Tuesday to customers who moved "
          + "the week before last and filed no claim."
          + '<span class="freshness"> · a sent row means Birdeye was asked, from the send ledger</span></p></div>';

        html += '<div class="bes-tabs">'
          + '<div class="rs-tog' + (S.tab === "sent" ? " on" : "") + '" data-tab="sent"><i></i>Sent</div>'
          + '<div class="rs-tog' + (S.tab === "coverage" ? " on" : "") + '" data-tab="coverage"><i></i>'
          + "Survey coverage — who was not asked, and why</div></div>";

        html += S.tab === "sent" ? sentView(sent) : coverageView(cov);
        html += "</div>";
        host.innerHTML = html;
        wire(sent, cov);
      }

      // ---- SENT ---------------------------------------------------------------------------
      let sentList = [];
      function sentView(rows) {
        const now = Date.now();
        const inDays = (r, n) => {
          const t = Date.parse(String(r["Sent At"] || "").replace(" ", "T"));
          return isFinite(t) && now - t <= n * 864e5;
        };
        const surveys = rows.filter(r => r["Campaign"] === "survey").length;
        const reviews = rows.filter(r => r["Campaign"] === "review-request").length;
        const last7 = rows.filter(r => inDays(r, 7)).length;

        const q = S.q.trim().toLowerCase();
        sentList = rows.filter(r => {
          if (S.campaign !== "all" && r["Campaign"] !== S.campaign) return false;
          if (!q) return true;
          return [r["Customer"], r["Email"], r["Job"]].some(v =>
            String(v || "").toLowerCase().indexOf(q) >= 0);
        }).sort((a, b) => String(b["Sent At"] || "").localeCompare(String(a["Sent At"] || "")));

        const pages = Math.max(1, Math.ceil(sentList.length / PAGE));
        if (S.page >= pages) S.page = pages - 1;
        if (S.page < 0) S.page = 0;
        const shown = sentList.slice(S.page * PAGE, S.page * PAGE + PAGE);

        let h = '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(rows.length.toLocaleString(), "Sent in total", "every live send, both campaigns", "")
          + kpi(surveys.toLocaleString(), "Monthly Survey", "weekly, Tuesdays", surveys ? "pos" : "")
          + kpi(reviews.toLocaleString(), "Review requests", "when a foreman hears a promise", reviews ? "pos" : "")
          + kpi(last7.toLocaleString(), "Last 7 days", "both campaigns", "")
          + "</div>";

        h += '<div class="rs-bar" style="margin-top:14px">'
          + '<label class="rs-fld"><span>Find</span>'
          + '<input class="rs-inp" id="besQ" placeholder="Customer, email or job…" value="' + esc(S.q) + '"></label>'
          + ["all", "survey", "review-request"].map(c =>
              '<div class="rs-tog' + (S.campaign === c ? " on" : "") + '" data-camp="' + c + '"><i></i>'
              + (c === "all" ? "All campaigns" : c === "survey" ? "Monthly Survey" : "Review requests")
              + "</div>").join("")
          + '<span class="rs-spacer"></span>'
          + '<button class="rs-btn" id="besCsv">Download CSV · ' + sentList.length + "</button></div>";

        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0">'
          + '<table class="rs-table rs-even"><thead><tr>'
          + "<th>Sent</th><th>Campaign</th><th>Customer</th><th>Email</th><th>Job</th>"
          + "</tr></thead><tbody>"
          + (shown.length ? shown.map(r =>
              '<tr><td class="nowrap">' + esc(dt16(r["Sent At"])) + "</td>"
              + "<td>" + campaignPill(r) + "</td>"
              + "<td>" + esc(r["Customer"] || "—") + "</td>"
              + '<td class="muted">' + esc(r["Email"] || "—") + "</td>"
              + '<td class="nowrap strong">' + esc(r["Job"] || "—") + "</td></tr>").join("")
            : '<tr><td colspan="5" class="dim">Nothing sent matches.</td></tr>')
          + "</tbody></table></div>" + pager(sentList.length, S.page, pages, "s") + "</div>";
        return h;
      }

      // ---- SURVEY COVERAGE ----------------------------------------------------------------
      let covList = [];
      function coverageView(rows) {
        const weeks = Array.from(new Set(rows.map(r => d10(r["Week Start"]))))
          .filter(w => w !== "—").sort().reverse();
        if (!S.week || weeks.indexOf(S.week) < 0) {
          // the newest week that has actually been through its Tuesday, else the newest
          const done = weeks.filter(w => rows.some(r => d10(r["Week Start"]) === w
            && r["Status"] !== "Waiting for its Tuesday"));
          S.week = done[0] || weeks[0] || null;
        }
        const wk = rows.filter(r => d10(r["Week Start"]) === S.week);
        const count = st => wk.filter(r => r["Status"] === st).length;
        const sendDate = wk.length ? d10(wk[0]["Send Date"]) : "—";

        const q = S.cq.trim().toLowerCase();
        covList = wk.filter(r => {
          if (S.status !== "all" && r["Status"] !== S.status) return false;
          if (!q) return true;
          return [r["Customer"], r["Email"], r["Job"], r["Request No"]].some(v =>
            String(v || "").toLowerCase().indexOf(q) >= 0);
        }).sort((a, b) => STATUSES.indexOf(a["Status"]) - STATUSES.indexOf(b["Status"])
          || String(a["Customer"] || "").localeCompare(String(b["Customer"] || "")));

        const pages = Math.max(1, Math.ceil(covList.length / PAGE));
        if (S.cpage >= pages) S.cpage = pages - 1;
        if (S.cpage < 0) S.cpage = 0;
        const shown = covList.slice(S.cpage * PAGE, S.cpage * PAGE + PAGE);

        let h = '<div class="bes-weeks">' + (weeks.length ? weeks.map(w =>
            '<div class="rs-tog' + (S.week === w ? " on" : "") + '" data-week="' + esc(w) + '"><i></i>'
            + "Moves from " + esc(w) + "</div>").join("")
          : '<span class="dim">No survey weeks yet.</span>') + "</div>";
        h += '<p class="bes-note">Week of moves starting <b>' + esc(S.week || "—") + "</b> · survey day <b>"
          + esc(sendDate) + "</b> · Zip to Zip jobs on the closing sheet, by the job's last closing date.</p>";

        h += '<div class="rs-kpis" style="--kpi-cols:6">'
          + kpi(wk.length.toLocaleString(), "Jobs that week", "Zip to Zip closings", "")
          + kpi(count("Sent").toLocaleString(), "Sent", "got the Monthly Survey", count("Sent") ? "pos" : "")
          + kpi(count("Has a claim").toLocaleString(), "Has a claim", "skipped on purpose", "")
          + kpi(count("No email").toLocaleString(), "No email", "cannot be asked", count("No email") ? "warn" : "")
          + kpi(count("Same email already surveyed").toLocaleString(), "Same email", "that person was already asked", "")
          + kpi((count("Waiting for its Tuesday") + count("Not sent")).toLocaleString(), "Not sent yet",
                count("Not sent") ? count("Not sent") + " past their Tuesday" : "waiting for the send day",
                count("Not sent") ? "warn" : "")
          + "</div>";

        h += '<div class="rs-bar" style="margin-top:14px">'
          + '<label class="rs-fld"><span>Find</span>'
          + '<input class="rs-inp" id="besCQ" placeholder="Customer, email, job or request…" value="' + esc(S.cq) + '"></label>'
          + ["all"].concat(STATUSES).map(st =>
              '<div class="rs-tog' + (S.status === st ? " on" : "") + '" data-st="' + esc(st) + '"><i></i>'
              + esc(st === "all" ? "All" : st) + "</div>").join("")
          + '<span class="rs-spacer"></span>'
          + '<button class="rs-btn" id="besCovCsv">Download CSV · ' + covList.length + "</button></div>";

        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0">'
          + '<table class="rs-table rs-even"><thead><tr>'
          + "<th>Status</th><th>Customer</th><th>Email</th><th>Job</th><th>Move date</th>"
          + "</tr></thead><tbody>"
          + (shown.length ? shown.map(r =>
              "<tr><td>" + statusPill(String(r["Status"] || "Not sent"))
              + (r["Sent At"] ? '<span class="bes-sub">' + esc(dt16(r["Sent At"])) + "</span>" : "")
              + (+r["Has Claim"] === 1 && r["Status"] === "Sent"
                  ? '<span class="bes-sub">claim filed after the survey</span>' : "")
              + "</td><td>" + esc(r["Customer"] || "—") + "</td>"
              + '<td class="muted">' + esc(r["Email"] || "—") + "</td>"
              + '<td class="nowrap strong">' + esc(r["Job"] || "—") + "</td>"
              + '<td class="nowrap muted">' + esc(d10(r["Move Date"])) + "</td></tr>").join("")
            : '<tr><td colspan="5" class="dim">No jobs match.</td></tr>')
          + "</tbody></table></div>" + pager(covList.length, S.cpage, pages, "c") + "</div>";
        return h;
      }

      function csv(name, cols, list) {
        const cell = x => {
          let s = String(x == null ? "" : x);
          // a value opening as a live Excel formula is a real attack surface
          if (/^[=+\-@]/.test(s)) s = " " + s;
          return '"' + s.replace(/"/g, '""') + '"';
        };
        const lines = [cols.map(cell).join(",")].concat((list || []).map(r =>
          cols.map(c => cell(r[c])).join(",")));
        // the BOM is for Excel: without it a non-ASCII name opens as mojibake
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = name + "-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }

      function wire(sent, cov) {
        if (!alive()) return;
        const repaint = () => paint(sent, cov);
        host.querySelectorAll("[data-tab]").forEach(t => {
          t.onclick = () => { S.tab = t.dataset.tab; repaint(); };
        });
        host.querySelectorAll("[data-camp]").forEach(t => {
          t.onclick = () => { S.campaign = t.dataset.camp; S.page = 0; repaint(); };
        });
        host.querySelectorAll("[data-week]").forEach(t => {
          t.onclick = () => { S.week = t.dataset.week; S.cpage = 0; repaint(); };
        });
        host.querySelectorAll("[data-st]").forEach(t => {
          t.onclick = () => { S.status = t.dataset.st; S.cpage = 0; repaint(); };
        });
        [["#besQ", "q", "page"], ["#besCQ", "cq", "cpage"]].forEach(([sel, key, pg]) => {
          const box = host.querySelector(sel);
          if (!box) return;
          box.oninput = function () { S[key] = this.value; S[pg] = 0; };
          // repaint on a pause, not on every keystroke: a repaint would take the caret away
          box.onchange = repaint;
          box.onkeyup = e => { if (e.key === "Enter") repaint(); };
        });
        host.querySelectorAll("[data-pg]").forEach(b => {
          b.onclick = () => {
            const [which, dir] = b.dataset.pg.split(":");
            const k = which === "c" ? "cpage" : "page";
            S[k] += (dir === "next" ? 1 : -1);
            repaint();
          };
        });
        const c1 = host.querySelector("#besCsv");
        if (c1) c1.onclick = () => csv("birdeye-sent",
          ["Sent At", "Campaign Label", "Customer", "Email", "Job"], sentList);
        const c2 = host.querySelector("#besCovCsv");
        if (c2) c2.onclick = () => csv("birdeye-survey-coverage",
          ["Week Start", "Send Date", "Status", "Customer", "Email", "Job", "Request No",
           "Move Date", "Sent At", "Has Claim"], covList);
      }
    },
  });
})();
