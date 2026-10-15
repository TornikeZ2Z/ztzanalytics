/* MARKETING OVERVIEW — the one page for marketing (Tornike 2026-10-15: "fully automated
 * marketing reporting. all in one page where we should have kinda everything together").
 *
 * FIRST SECTION, his words: "show user what are the sources connected to this dashboard and
 * what is the latest status - is it up to date?" One row per source from mart_mkt_connector
 * (src/mkt_connectors.py, rebuilt every hour after the freshness check):
 *
 *   * MARKETING PLATFORMS — his eleven (Google split into Ads / Local Services / Analytics /
 *     Search Console, because each connects on its own), each with the login that holds it,
 *     the metrics he wants from it, whether data flows, and what unblocks it if not;
 *   * OUR OWN DATA — leads, calls, jobs, the bank spend ledger and the hand-dropped exports.
 *
 * "Up to date" is judged against each source's OWN rhythm (Search Console is ~3 days behind
 * by design, the bank ledger is pasted monthly), so the status is computed in the mart, not
 * guessed here. The BANK column is the only number we hold for a platform with no connector:
 * what the bank ledger shows paid to it this year — the reason it is on the list at all.
 *
 * Plan of record: docs/plans/2026-10-15-marketing-overview.md. The channel KPIs, the paid
 * table and the website / search panels follow as each connector lands.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.mkt_connector) {
    RS.DATASETS.mkt_connector = {
      table: "mart_mkt_connector",
      // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives.
      cols: ["Key", "Sort", "Group", "Platform", "Login", "Account", "Link", "Metrics",
             "Connection", "Status", "Status Note", "Next Step", "Newest Data", "Last Pulled",
             "Days Behind", "Expected Lag", "Bank Year", "Bank Spend", "Bank Last Charge",
             "Bank Through", "Note", "Checked At"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("mko-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "mko-style";
    // Panels, tables, pills and the KPI strip are THE COMPONENT KIT in rs.css. Only what the
    // kit has no name for lives here.
    st.textContent = ""
      + ".mko{font-variant-numeric:tabular-nums}"
      + ".mko .mko-src{font-weight:600}"
      + ".mko .mko-src a{color:inherit;text-decoration:none;border-bottom:1px dotted currentColor}"
      + ".mko .mko-src a:hover{color:var(--brand)}"
      + ".mko .mko-sub{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.45}"
      + ".mko .mko-note{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45;max-width:420px}"
      + ".mko .mko-step{font-size:12.5px;line-height:1.45;max-width:340px}"
      + ".mko .mko-met{font-size:12.5px;line-height:1.45;max-width:300px;color:var(--muted)}"
      + ".mko td{vertical-align:top}"
      + ".mko .mko-num{text-align:right;white-space:nowrap}"
      + ".mko .mko-date{white-space:nowrap}"
      + ".mko .mko-foot{font-size:12px;color:var(--muted);margin-top:10px}"
      + "body.rs-app.light.v2 .mko .mko-sub,body.rs-app.light.v2 .mko .mko-note,"
      + "body.rs-app.light.v2 .mko .mko-met,body.rs-app.light.v2 .mko .mko-foot{color:#64748B}";
    document.head.appendChild(st);
  }

  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  registerPage({
    id: "marketing-overview",
    group: "marketing",
    title: "Marketing Overview",
    subtitle: "Every marketing source in one place. First: which sources feed this page, and " +
              "whether each one is up to date.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);

      // dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"; read the calendar day only, so
      // no browser timezone can move it
      const ymd = v => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
        return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
      };
      const day = v => {
        const p = ymd(v);
        return p ? p.d + " " + MON[p.m - 1] + " " + p.y : "—";
      };
      const shortDay = v => {
        const p = ymd(v);
        return p ? p.d + " " + MON[p.m - 1] : "—";
      };
      const money = v => v == null || v === "" ? "—"
        : "$" + Math.round(+v).toLocaleString("en-US");

      const PILL = {
        "Up to date": "ok", "Behind": "warn", "No data": "bad", "Not connected": "mute",
      };
      const pill = s => '<span class="rs-pill ' + (PILL[s] || "mute") + '">' + esc(s) + "</span>";

      injectStyle();
      host.innerHTML = '<div class="panel">Loading the source list…</div>';

      RS.load("mkt_connector").then(rows => {
        if (!alive()) return;
        rows = (rows || []).slice().sort((a, b) => (+a.Sort || 0) - (+b.Sort || 0));
        if (!rows.length) {
          host.innerHTML = '<div class="panel">The source list is not built yet — it is '
            + "written by the hourly pipeline (sources=freshness).</div>";
          return;
        }

        const count = s => rows.filter(r => r.Status === s).length;
        const connected = rows.filter(r => r.Status !== "Not connected").length;
        const plat = rows.filter(r => r.Group === "Marketing platforms");
        const ours = rows.filter(r => r.Group !== "Marketing platforms");
        const bankThrough = (plat.find(r => r["Bank Through"]) || {})["Bank Through"];
        const bankYear = (plat.find(r => r["Bank Year"]) || {})["Bank Year"] || "";

        function sourceCell(r) {
          const name = r.Link
            ? '<a href="' + esc(r.Link) + '" target="_blank" rel="noopener">' + esc(r.Platform)
              + " ↗</a>"
            : esc(r.Platform);
          const who = [r.Login, r.Account].filter(Boolean).map(esc).join(" · ");
          return '<div class="mko-src">' + name + "</div>"
            + (who ? '<div class="mko-sub">' + who + "</div>" : "")
            + (r.Note ? '<div class="mko-note">' + esc(r.Note) + "</div>" : "");
        }
        function statusCell(r) {
          return pill(r.Status)
            + (r.Connection !== r.Status ? '<div class="mko-sub">' + esc(r.Connection) + "</div>" : "")
            // the date column already says "through X"; the note earns its line only when late
            + ((r.Status === "Behind" || r.Status === "No data") && r["Status Note"]
              ? '<div class="mko-note">' + esc(r["Status Note"]) + "</div>" : "");
        }
        function bankCell(r) {
          if (r["Bank Spend"] == null) return '<span class="mko-sub">—</span>';
          const v = +r["Bank Spend"];
          return '<div>' + (v ? money(v) : "$0") + "</div>"
            + '<div class="mko-sub">' + (r["Bank Last Charge"]
              ? "last charge " + shortDay(r["Bank Last Charge"]) : "no charges") + "</div>";
        }

        function table(list, withBank) {
          let h = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
            + "<th>Source</th><th>Status</th><th>Data through</th><th>Last pulled</th>"
            + (withBank ? '<th class="mko-num">Bank ' + esc(bankYear) + "</th>" : "")
            + "<th>What it gives</th><th>Next step</th></tr></thead><tbody>";
          list.forEach(r => {
            h += "<tr><td>" + sourceCell(r) + "</td>"
              + "<td>" + statusCell(r) + "</td>"
              + '<td class="mko-date">' + (r["Newest Data"] ? day(r["Newest Data"]) : '<span class="mko-sub">—</span>') + "</td>"
              + '<td class="mko-date">' + (r["Last Pulled"] ? shortDay(r["Last Pulled"]) : '<span class="mko-sub">—</span>') + "</td>"
              + (withBank ? '<td class="mko-num">' + bankCell(r) + "</td>" : "")
              + '<td><div class="mko-met">' + esc(r.Metrics || "") + "</div></td>"
              + '<td><div class="mko-step">' + esc(r["Next Step"] || "") + "</div></td>"
              + "</tr>";
          });
          return h + "</tbody></table></div>";
        }

        const checked = rows.map(r => r["Checked At"]).filter(Boolean).sort().pop();

        host.innerHTML = '<div class="mko">'
          + '<div class="rs-kpis" id="mkoKpis"></div>'
          + '<div class="panel"><div class="panel-head"><span class="panel-title">Marketing platforms'
          + "</span></div>"
          + '<p class="rs-hint">Each platform with the login that holds it and the numbers we want '
          + "from it. Not connected means no data flows yet; the last column says what unblocks it. "
          + "The bank column is what the bank ledger shows paid to the platform in " + esc(bankYear)
          + (bankThrough ? ", through " + esc(day(bankThrough)) : "") + ".</p>"
          + table(plat, true) + "</div>"
          + '<div class="panel"><div class="panel-head"><span class="panel-title">Our own data'
          + "</span></div>"
          + '<p class="rs-hint">What the page reads beside the platforms: our leads, calls, jobs and '
          + "spend. Each is judged against its own rhythm, so a monthly ledger is not called late "
          + "every day.</p>"
          + table(ours, false) + "</div>"
          + '<div class="mko-foot">Status checked ' + esc(day(checked))
          + (checked && String(checked).length > 10 ? " " + esc(String(checked).slice(11, 16)) + " UTC" : "")
          + " · refreshed every hour by the pipeline.</div>"
          + "</div>";

        RSC.kpis(host.querySelector("#mkoKpis"), [
          { label: "Sources connected", value: connected + " of " + rows.length,
            sub: plat.filter(r => r.Status !== "Not connected").length + " of " + plat.length
              + " marketing platforms" },
          { label: "Up to date", value: String(count("Up to date")),
            sub: "on their usual rhythm" },
          { label: "Behind", value: String(count("Behind")),
            sub: "older than they should be" },
          { label: "Not connected", value: String(count("Not connected")),
            sub: "no data flows yet" },
        ]);
      }).catch(e => {
        if (!alive()) return;
        host.innerHTML = '<div class="panel">Could not load the source list — '
          + esc(e && e.message || e) + "</div>";
      });
    },
  });
})();
