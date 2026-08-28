/* FUEL CONTROL — every card swipe, against the job it belongs to.
 *
 * The card knows who swiped, when, where and into which truck. The warehouse knows which jobs
 * that man ran that day. The mart puts them together; this page is where a person acts on the
 * result — and the result that matters is the short list of swipes that answer to nothing.
 *
 * SO THE QUEUE COMES FIRST. Not the totals, not the charts: the transactions nobody can
 * explain yet, with the reason spelled out and a box to write what actually happened. His
 * rule (2026-08-05): a foreman has the truck only if he had a job that day — anything else is
 * the card being used for something we have not been told about. Writing the explanation is
 * what clears it; there is no "mark checked" without saying why, because a checkbox with
 * nothing behind it is exactly the outcome the queue exists to prevent.
 *
 * NOTHING HERE IS AN ACCUSATION. A fill in Georgia on a long-distance run is normal. Gasoline
 * in a diesel truck is a keying mistake far more often than anything else. Flags are questions.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fuel) {
    RS.DATASETS.fuel = {
      table: "fct_fuel",
      cols: ["Line Key", "Trans ID", "Ticket", "Date", "Time", "Datetime", "Month", "Weekday",
             "Driver Raw", "Foreman", "Card", "Product", "Product Description", "Fuel Kind",
             "Is Fuel", "Gallons", "Unit Cost", "Fuel Cost", "Other Cost", "Fees",
             "Gross Cost", "Net Cost", "Merchant", "Merchant Name", "Merchant City",
             "Merchant State", "Vehicle Raw", "Truck", "Truck Fuel", "Unique Key",
             "Job Request", "Job Customer", "Job Company", "Job Truck", "Job Start",
             "Job Moving Type", "Job State", "Jobs That Day", "Trip Share", "Trip Cost Share",
             "Match Status", "Match Note",
             "Flags", "Notes", "Flag Count", "Needs Review", "Resolved", "Resolution",
             "Resolved By", "Resolved At"],
      dateCols: { Date: "Date" }, defaultDate: "Date",
    };
  }
})();

registerPage({
  id: "fuel-control",
  title: "Fuel Control",
  subtitle: "Every fleet-card swipe against the job it belongs to — and the ones that belong to nothing.",
  datasets: [],

  render: function (host) {
    // window.RSC is the real global (assets/rs-components.js:3). This read RS_COMPONENTS,
    // which has never existed, so `|| {}` handed every one of these pages an EMPTY object
    // and each helper quietly fell through to its local fallback. Nothing looked wrong
    // until `collapsible` -- the one member with no fallback -- was called, and Packing
    // Control and Storage Control died with "RSC.collapsible is not a function".
    const RSC = window.RSC || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const nn = v => (v == null || v === "" || isNaN(v)) ? null : +v;
    const num = v => nn(v) || 0;
    const money = v => "$" + (Math.round(num(v) * 100) / 100).toLocaleString(undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const money0 = v => "$" + Math.round(num(v)).toLocaleString();
    const fmtN = v => Math.round(num(v)).toLocaleString();
    const fmt1 = v => (Math.round(num(v) * 10) / 10).toLocaleString(undefined,
      { minimumFractionDigits: 1, maximumFractionDigits: 1 });

    // What each unplaceable status means in one line — the queue explains itself rather than
    // making the reader learn a vocabulary.
    const WHY = {
      unknown_foreman: "the card names somebody who is not on the crew list",
      no_job_that_day: "he ran no job on this date",
      ambiguous_no_time: "several jobs that day and no way to tell which came first",
      known_non_crew: "a known card holder who is not on the crew list",
    };
    const STATUS_LABEL = {
      assigned: "Assigned", assigned_trip: "On a trip", unknown_foreman: "Unknown driver",
      no_job_that_day: "No job that day", ambiguous_no_time: "Which job?",
      ambiguous_trip: "Which trip?", known_non_crew: "Known card holder",
    };
    // Two ways a swipe lands on real work: a local job that day, or a long-distance trip
    // whose span covers the date — a man away for six days has the truck for all six.
    const PLACED = { assigned: 1, assigned_trip: 1 };

    const S = window.__FUEL || (window.__FUEL = {
      rows: null, view: "queue", month: "", q: "", showResolved: false,
      busy: "", msg: "", msgErr: false, msgFor: null, open: null, draft: {},
    });

    // THE KIT (assets/rs.css, "THE COMPONENT KIT") now supplies the KPI strip, the control
    // bar with its segments / select / find box / toggle, the reading hint, both data tables
    // and every button. What is left below is what the kit cannot say -- the queue card with
    // its verdict edge and its drawer, the fact tiles, the flag chips, the spend bar drawn
    // inside a cell -- plus a handful of one-line adjustments layered ON kit components.
    host.innerHTML = '<style id="fuCss">'
      + ".fu{font-variant-numeric:tabular-nums}"
      // FIVE tiles across one row -- the column count RSC.kpis would have computed for five.
      // And no entrance fade: paint() rewrites this whole body on every keystroke in the find
      // box, so the kit's animation would replay on each one and the strip would flinch.
      + ".rs-content .fu .rs-kpis{--kpi-cols:5;animation:none}"
      // the kit paints every tile in --ink on a neutral card. The tile that is ASKING for an
      // answer wears the warn tone instead -- its top rule included, brand-green by default.
      + "body.rs-app .fu .rs-kpis .kpi.alert{border-color:var(--warn);background:var(--warn-bg)}"
      + ".fu .rs-kpis .kpi.alert .v{color:var(--warn)}"
      + ".fu .rs-kpis .kpi.alert::before{background:linear-gradient(90deg,var(--warn),transparent 70%)}"
      // what the page says back after a save: a block notice, which the kit does not name
      + ".fu-msg{font-size:12.5px;padding:9px 13px;border-radius:10px;margin-bottom:12px;display:none}"
      + ".fu-msg.on{display:block;background:var(--pos-bg);color:var(--pos)}"
      + ".fu-msg.err{display:block;background:var(--neg-bg);color:var(--neg)}"
      // ---- queue cards -----------------------------------------------------------------
      // The LEFT EDGE IS THE VERDICT: amber for a swipe that answers to nothing, quiet for one
      // already placed on a job, green once a person has written down what happened. No kit
      // component says that, and the card is this page's own object.
      + ".fu-card{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--warn);border-radius:13px;margin-bottom:9px;overflow:hidden}"
      + ".fu-card.ok{border-left-color:var(--line-2)}"
      + ".fu-card.done{border-left-color:var(--pos);opacity:.78}"
      // Four columns, not three. The old 1.35fr first column was ~1160px on a wide screen for
      // a name and a date that need ~400, so every row read as "foreman ... [canyon] ... verdict".
      // The station moved out of the sub-line into a column of its own and fills the gap.
      + ".fu-head{display:grid;grid-template-columns:minmax(0,.9fr) minmax(0,.85fr) minmax(0,1.25fr) auto;"
      + "gap:16px;align-items:center;padding:12px 16px;cursor:pointer}"
      + ".fu-where{font-size:12.5px;font-weight:650;color:var(--muted);min-width:0}"
      + ".fu-where span{display:block;font-size:11px;font-weight:500;color:var(--faint);margin-top:1px}"
      + ".fu-head:hover{background:var(--panel-2)}"
      + ".fu-who{font-size:14.5px;font-weight:750;letter-spacing:-.15px}"
      + ".fu-when{font-size:11px;color:var(--faint);margin-top:1px}"
      + ".fu-why{font-size:12px;color:var(--warn);font-weight:650}"
      + ".fu-why.ok{color:var(--muted);font-weight:500}"
      + ".fu-amt{text-align:right;white-space:nowrap}"
      + ".fu-amt b{font-size:17px;font-weight:800;letter-spacing:-.3px}"
      + ".fu-amt i{display:block;font-style:normal;font-size:10px;color:var(--faint);margin-top:1px}"
      + ".fu-body{display:none;border-top:1px solid var(--line);padding:13px 16px 15px}"
      + ".fu-card.on .fu-body{display:block}"
      + ".fu-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:9px;margin-bottom:12px}"
      + ".fu-f{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px 11px}"
      + ".fu-f .l{font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".fu-f .v{font-size:13px;font-weight:700;margin-top:2px;word-break:break-word}"
      + ".fu-f .s{font-size:10.5px;color:var(--muted);margin-top:1px}"
      + ".fu-flags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}"
      // NOT .rs-pill: a pill is a one-word verdict that may never wrap, and these carry a
      // whole sentence -- "card says truck 1207, the job says 1103". They stay chips that wrap.
      + ".fu-flag{font-size:11px;font-weight:650;padding:4px 10px;border-radius:999px;background:var(--warn-bg);color:var(--warn)}"
      + ".fu-flag.ctx{background:var(--panel-2);color:var(--muted);font-weight:500}"
      // the box and the two buttons are kit controls; only the row holding them is ours, and
      // the box stretches to fill whatever the buttons leave
      + ".fu-res{display:flex;flex-wrap:wrap;gap:8px;align-items:center}"
      + ".fu .fu-res .rs-inp{flex:1;min-width:260px}"
      + ".fu-done{font-size:12px;color:var(--pos);font-weight:700}"
      + ".fu-done small{color:var(--muted);font-weight:500}"
      // ---- tables: kit tables, numeric by convention -------------------------------------
      // These stand on the page without a card of their own, so the scroller keeps the panel
      // ground it always had, and the height cap keeps the sticky header earning its keep.
      + ".fu .rs-tablewrap{background:var(--panel);max-height:calc(100vh - 330px)}"
      // every column but the first is a quantity, so alignment is a RULE here rather than
      // forty hand-tagged .num cells
      + ".fu .fu-t th,.fu .fu-t td{text-align:right}"
      + ".fu .fu-t th:first-child,.fu .fu-t td:first-child{text-align:left}"
      + ".fu .fu-t td{white-space:nowrap}"
      // spend drawn INSIDE the cell: the bar is this row's share of the biggest spender
      + ".fu .fu-t td.bar{position:relative;min-width:110px}"
      + ".fu .fu-t td.bar i{position:absolute;left:12px;top:50%;transform:translateY(-50%);height:6px;border-radius:4px;background:var(--brand);opacity:.5}"
      + ".fu .fu-t td.bar span{position:relative}"
      // the totals row, which the kit's zebra and hover would otherwise paint over
      + ".fu .fu-t tr.tot td{font-weight:800;border-top:2px solid var(--line-2);border-bottom:0;background:var(--panel-2)}"
      + ".fu-neg{color:var(--neg);font-weight:800}"
      + ".fu-empty{padding:40px;text-align:center;color:var(--faint);font-size:13.5px;background:var(--panel);border:1px dashed var(--line-2);border-radius:14px}"
      + ".fu-empty b{display:block;font-size:16px;color:var(--pos);margin-bottom:5px}"
      // a footnote UNDER a table: quieter than .rs-hint, and it hangs below, not above
      + ".fu-note{font-size:12.5px;color:var(--faint);line-height:1.55;margin:10px 0 0;max-width:var(--rs-prose)}"
      // the divider over the swipes somebody has already explained, at the kit's label scale
      + ".fu-h2{font-size:10.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:20px 0 9px}"
      + "@media(max-width:820px){.fu-head{grid-template-columns:1fr;gap:6px}.fu-amt{text-align:left}}"
      + '</style><div class="fu"><div id="fuMain"></div></div>';

    const main = host.querySelector("#fuMain");
    main.innerHTML = '<div class="rs-loading">Loading the fuel card…</div>';

    function api(path, opts) {
      return fetch(ZTZ.API + path, Object.assign({
        headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                               (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
      }, opts || {})).then(r => r.json().then(j => {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      }));
    }

    function load() {
      // TWO SOURCES, and the second is not optional. The mart carries a resolution only from
      // the next pipeline run onward, so a page that trusted it alone would hand somebody
      // back the thirty exceptions they just cleared, the moment they refreshed. The live
      // table is the truth about what has been answered; the mart is the truth about the money.
      return Promise.all([RS.load("fuel"), api("/api/_fuelrev").catch(() => ({ reviews: [] }))])
        .then(([rows, rev]) => {
          const by = {};
          (rev.reviews || []).forEach(x => { by[x["Line Key"]] = x; });
          S.rows = (rows || []).map(r => {
            const v = by[r["Line Key"]];
            return Object.assign({}, r, v
              ? { Resolved: 1, Resolution: v.Explanation,
                  "Resolved By": v["Entered By"], "Resolved At": v["Entered At"] }
              : { Resolved: 0, Resolution: null, "Resolved By": null, "Resolved At": null });
          });
          paint();
        }).catch(e => {
          main.innerHTML = '<div class="fu-empty">Could not load — ' + esc(e.message) + "</div>";
        });
    }

    const months = () => [...new Set((S.rows || []).map(r => r.Month).filter(Boolean))]
      .sort().reverse();

    function scope() {
      let rs = S.rows || [];
      if (S.month) rs = rs.filter(r => r.Month === S.month);
      if (S.q) {
        const q = S.q.toLowerCase();
        rs = rs.filter(r => [r.Foreman, r["Driver Raw"], r.Truck, r["Vehicle Raw"], r.Merchant,
                             r["Merchant Name"], r["Merchant City"], r["Job Customer"],
                             r["Job Request"], r["Trans ID"]]
          .join(" ").toLowerCase().indexOf(q) >= 0);
      }
      return rs;
    }

    function paint() {
      if (!S.rows || !S.rows.length) {
        main.innerHTML = '<div class="fu-empty">No fuel transactions yet — the card export '
          + "lands in SharePoint's <b>Fuel Export</b> folder and arrives on the next refresh.</div>";
        return;
      }
      const rs = scope();
      const openQ = rs.filter(r => +r["Needs Review"] === 1 && +r.Resolved !== 1);
      const resolved = rs.filter(r => +r.Resolved === 1);
      const unplaced = rs.filter(r => !PLACED[r["Match Status"]]);
      const spend = rs.reduce((a, r) => a + num(r["Net Cost"]), 0);
      const openSpend = openQ.reduce((a, r) => a + num(r["Net Cost"]), 0);
      const gallons = rs.reduce((a, r) => a + num(r.Gallons), 0);
      const assigned = rs.filter(r => PLACED[r["Match Status"]]);

      let h = '<div class="rs-kpis">'
        + kpi(money0(spend), "Card spend", fmtN(rs.length) + " transaction" + (rs.length === 1 ? "" : "s"))
        + kpi(fmtN(gallons) + " gal", "Fuel bought",
              gallons ? "$" + (spend / gallons).toFixed(2) + " a gallon" : "—")
        + kpi(fmtN(assigned.length) + " / " + fmtN(rs.length), "Placed on a job",
              rs.length ? Math.round(assigned.length / rs.length * 100) + "% of swipes" : "—")
        + kpi(fmtN(openQ.length), "Need an answer",
              openQ.length ? money0(openSpend) + " unexplained" : "all clear",
              openQ.length ? "alert" : "")
        + kpi(fmtN(resolved.length), "Explained", resolved.length ? "checked by a person" : "none yet")
        + "</div>";

      h += '<div class="rs-bar">'
        + '<div class="rs-seg">'
        + seg("queue", "Queue" + (openQ.length ? " " + openQ.length : ""))
        + seg("foremen", "By foreman") + seg("trucks", "By truck") + seg("all", "All swipes")
        + "</div>"
        + '<div id="fuMonth"></div>'
        + '<input class="rs-inp" id="fuQ" placeholder="Find a foreman, truck, merchant…" value="' + esc(S.q) + '">'
        + (S.view === "queue"
            ? '<span class="rs-spacer"></span><div class="rs-tog' + (S.showResolved ? " on" : "")
              + '" id="fuShowRes"><i></i>Show explained</div>' : "")
        + "</div>";

      h += '<div class="fu-msg' + (S.msg && !S.msgFor ? (S.msgErr ? " err" : " on") : "") + '">'
        + esc(S.msgFor ? "" : (S.msg || "")) + "</div>";

      // the guard above tests the whole feed; this one tests what the month and the search
      // actually left. It renders BELOW the bar on purpose -- an early return would have
      // wiped the search box the user is typing into (it did, and threw doing it).
      if (!rs.length) h += '<div class="fu-empty">No card swipes match this month or search.</div>';
      else if (S.view === "queue") h += queueView(openQ, resolved);
      else if (S.view === "foremen") h += foremanView(rs);
      else if (S.view === "trucks") h += truckView(rs);
      else h += allView(rs);

      main.innerHTML = h;
      wire();
    }

    const kpi = (b, lab, sub, cls) => '<div class="kpi ' + (cls || "") + '"><div class="l">'
      + esc(lab) + '</div><div class="v">' + esc(b) + '</div><div class="s">' + esc(sub)
      + "</div></div>";
    const seg = (id, lab) => '<button data-v="' + id + '"' + (S.view === id ? ' class="on"' : "")
      + ">" + esc(lab) + "</button>";
    const MON = ["January", "February", "March", "April", "May", "June", "July", "August",
                 "September", "October", "November", "December"];
    const monLab = m => m ? MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : "";

    // ---- the queue: the reason this page exists ---------------------------------------
    function queueView(openQ, resolved) {
      let h = '<p class="rs-hint"><b>A swipe belongs to a job.</b> A foreman has the truck '
        + "because he is running a job that day, so the day's fuel goes on that day's first "
        + "job. Everything below is a swipe that could not be placed that way, or that could "
        + "be placed but looks odd — the reason is on each card. <b>Nothing here costs a job "
        + "anything</b> until somebody writes down what happened; that explanation is what "
        + "clears it, and it stays attached to the transaction afterwards.</p>";

      if (!openQ.length) {
        h += '<div class="fu-empty"><b>Nothing to answer.</b>Every swipe in this window is '
          + "either on a job or already explained.</div>";
      } else {
        h += openQ.map(card).join("");
      }
      if (S.showResolved && resolved.length) {
        h += '<div class="fu-h2">Explained · '
          + resolved.length + "</div>" + resolved.map(card).join("");
      }
      return h;
    }

    function card(r) {
      const open = S.open === r["Line Key"], done = +r.Resolved === 1;
      const st = r["Match Status"], placed = !!PLACED[st];
      const flags = String(r.Flags || "").split(";").map(x => x.trim()).filter(Boolean);
      const notes = String(r.Notes || "").split(";").map(x => x.trim()).filter(Boolean);
      const key = esc(r["Line Key"]);

      let h = '<div class="fu-card' + (open ? " on" : "") + (done ? " done" : placed ? " ok" : "")
        + '" data-k="' + key + '">'
        + '<div class="fu-head"><div>'
        + '<div class="fu-who">' + esc(r.Foreman || r["Driver Raw"] || "unnamed driver")
        + (r.Truck || r["Vehicle Raw"]
            ? ' <span style="font-weight:500;color:var(--faint);font-size:12px">· truck '
              + esc(r.Truck || r["Vehicle Raw"]) + "</span>" : "")
        + "</div>"
        + '<div class="fu-when">' + esc(String(r.Date || "").slice(0, 10))
        + (r.Time ? " at " + esc(String(r.Time).slice(0, 5)) : "") + "</div></div>"
        + '<div class="fu-where">' + esc(r.Merchant || r["Merchant Name"] || "—")
        + "<span>"
        + esc([r["Merchant City"], r["Merchant State"]].filter(Boolean).join(" ") || "location not on the card feed")
        + "</span></div>"
        + "<div>"
        + '<div class="fu-why' + (placed ? " ok" : "") + '">'
        + esc(placed ? (st === "assigned_trip" ? "Trip · " : "On ")
                     + (r["Job Customer"] || r["Job Request"] || "a job") : (STATUS_LABEL[st] || st))
        + (flags.length ? ' <span style="color:var(--warn)">· ' + flags.length + " to check</span>" : "")
        + "</div>"
        + '<span class="rs-why">' + esc(r["Match Note"] || WHY[st] || "") + "</span></div>"
        + '<div class="fu-amt"><b>' + money(r["Net Cost"]) + "</b>"
        + "<i>" + (r.Gallons ? fmt1(r.Gallons) + " gal · " : "")
        + esc(r["Fuel Kind"] || r.Product || "") + "</i></div></div>";

      h += '<div class="fu-body">';
      h += '<div class="fu-facts">'
        + fact("Driver on the card", r["Driver Raw"] || "—",
               r.Foreman ? "matched to " + r.Foreman : "no crew match")
        + fact("Vehicle on the card", r["Vehicle Raw"] || "none",
               r.Truck ? (r["Truck Fuel"] ? "register: " + r["Truck Fuel"] : "in the fleet register")
                       : "not in the fleet register")
        + fact("Jobs that day", fmtN(r["Jobs That Day"]),
               st === "assigned_trip" ? "away on a trip"
                 : placed ? "fuel went on the first" : "none to place it on")
        + fact("The job", placed ? (r["Job Customer"] || r["Job Request"] || "—") : "—",
               placed ? [r["Job Request"] ? "#" + r["Job Request"] : "",
                         r["Job Truck"] ? "truck " + r["Job Truck"] : "",
                         r["Job Moving Type"] || ""].filter(Boolean).join(" · ") : "unassigned")
        + fact("Cost", money(r["Net Cost"]),
               [r["Unit Cost"] ? "$" + (+r["Unit Cost"]).toFixed(3) + "/gal" : "",
                num(r.Fees) ? "fees " + money(r.Fees) : ""].filter(Boolean).join(" · ") || "net")
        + (nn(r["Trip Share"]) != null && +r["Trip Share"] < 1
             ? fact("This job's share", money(r["Trip Cost Share"]),
                    "a consolidated run — " + Math.round(+r["Trip Share"] * 100)
                    + "% of the swipe by cubic feet")
             : "")
        + fact("Ticket", r["Trans ID"] || "—", r.Ticket ? "ticket " + r.Ticket : "")
        + "</div>";

      if (flags.length || notes.length) {
        h += '<div class="fu-flags">'
          + flags.map(f => '<span class="fu-flag">' + esc(f) + "</span>").join("")
          + notes.map(f => '<span class="fu-flag ctx">' + esc(f) + "</span>").join("") + "</div>";
      }

      if (done) {
        h += '<div class="fu-res"><span class="fu-done">✓ ' + esc(r.Resolution || "")
          + " <small>— " + esc(String(r["Resolved By"] || "").split("@")[0])
          + (r["Resolved At"] ? " · " + esc(String(r["Resolved At"]).slice(0, 10)) : "")
          + "</small></span>"
          + '<button class="rs-btn" data-reopen="' + key + '">Put it back in the queue</button></div>';
      } else {
        h += '<div class="fu-res">'
          + '<input class="rs-inp" data-ex="' + key + '" placeholder="What actually happened? (required)" '
          + 'value="' + esc(S.draft[r["Line Key"]] || "") + '" maxlength="300">'
          + '<button class="rs-btn pri" data-resolve="' + key + '">Checked — nothing to worry about</button>'
          + (S.msgFor === r["Line Key"]
              ? '<span style="font-size:11.5px;color:var(--neg);font-weight:650">'
                + esc(S.msg) + "</span>" : "")
          + "</div>";
      }
      h += "</div></div>";
      return h;
    }

    const fact = (l, v, s) => '<div class="fu-f"><div class="l">' + esc(l) + '</div><div class="v">'
      + esc(v) + '</div><div class="s">' + esc(s || "") + "</div></div>";

    // ---- by foreman: the card against what he declared ---------------------------------
    function foremanView(rs) {
      const by = {};
      rs.forEach(r => {
        const f = r.Foreman || r["Driver Raw"] || "(unnamed)";
        const b = by[f] || (by[f] = { f, n: 0, gal: 0, usd: 0, open: 0, openUsd: 0, flags: 0,
                                      jobs: new Set(), trucks: new Set() });
        b.n++; b.gal += num(r.Gallons); b.usd += num(r["Net Cost"]);
        if (+r["Needs Review"] === 1 && +r.Resolved !== 1) { b.open++; b.openUsd += num(r["Net Cost"]); }
        b.flags += num(r["Flag Count"]);
        if (r["Unique Key"]) b.jobs.add(r["Unique Key"]);
        if (r.Truck || r["Vehicle Raw"]) b.trucks.add(r.Truck || r["Vehicle Raw"]);
      });
      const list = Object.values(by).sort((a, b) => b.usd - a.usd);
      const mx = Math.max.apply(null, list.map(x => x.usd)) || 1;
      const tot = list.reduce((a, x) => ({ n: a.n + x.n, gal: a.gal + x.gal, usd: a.usd + x.usd,
                                           open: a.open + x.open }), { n: 0, gal: 0, usd: 0, open: 0 });
      return '<div class="rs-tablewrap"><table class="rs-table fu-t"><thead><tr><th>Foreman</th><th>Swipes</th>'
        + "<th>Gallons</th><th>Spend</th><th>$ / gal</th><th>Jobs fuelled</th><th>Trucks</th>"
        + "<th>To answer</th></tr></thead><tbody>"
        + list.map(x => '<tr><td class="strong">' + esc(x.f) + "</td><td>" + fmtN(x.n) + "</td><td>"
            + fmt1(x.gal) + '</td><td class="bar"><i style="width:'
            + (x.usd / mx * 100).toFixed(0) + '%"></i><span>' + money0(x.usd) + "</span></td><td>"
            + (x.gal ? "$" + (x.usd / x.gal).toFixed(2) : "—") + "</td><td>" + fmtN(x.jobs.size)
            + "</td><td>" + esc([...x.trucks].sort().join(", ") || "—") + "</td><td"
            + (x.open ? ' class="fu-neg"' : "") + ">"
            + (x.open ? fmtN(x.open) + " · " + money0(x.openUsd) : "—") + "</td></tr>").join("")
        + '<tr class="tot"><td>All drivers</td><td>' + fmtN(tot.n) + "</td><td>" + fmt1(tot.gal)
        + "</td><td>" + money0(tot.usd) + "</td><td>"
        + (tot.gal ? "$" + (tot.usd / tot.gal).toFixed(2) : "—")
        + "</td><td></td><td></td><td>" + (tot.open ? fmtN(tot.open) : "—")
        + "</td></tr></tbody></table></div>"
        + '<p class="fu-note">Spend is the card\'s <b>net</b> cost, fees included. "Jobs fuelled" '
        + "counts the distinct jobs a man's swipes were placed on — a swipe in the queue is on "
        + "nobody's job, which is why the last column matters more than the first.</p>";
    }

    // ---- by truck ----------------------------------------------------------------------
    function truckView(rs) {
      const by = {};
      rs.forEach(r => {
        const t = r.Truck || r["Vehicle Raw"] || "(no vehicle)";
        const b = by[t] || (by[t] = { t, n: 0, gal: 0, usd: 0, kinds: {}, drivers: new Set(),
                                      known: !!r.Truck, fuel: r["Truck Fuel"] || "", flags: 0 });
        b.n++; b.gal += num(r.Gallons); b.usd += num(r["Net Cost"]);
        b.flags += num(r["Flag Count"]);
        const k = r["Fuel Kind"] || "Other";
        b.kinds[k] = (b.kinds[k] || 0) + 1;
        if (r.Foreman || r["Driver Raw"]) b.drivers.add(r.Foreman || r["Driver Raw"]);
      });
      const list = Object.values(by).sort((a, b) => b.usd - a.usd);
      const mx = Math.max.apply(null, list.map(x => x.usd)) || 1;
      return '<div class="rs-tablewrap"><table class="rs-table fu-t"><thead><tr><th>Truck</th><th>Swipes</th>'
        + "<th>Gallons</th><th>Spend</th><th>$ / gal</th><th>Products</th><th>Who fuelled it</th>"
        + "</tr></thead><tbody>"
        + list.map(x => '<tr><td class="strong">' + esc(x.t)
            + (x.known ? (x.fuel ? ' <span style="font-weight:500;color:var(--faint)">· '
                                   + esc(x.fuel) + "</span>" : "")
                       : ' <span class="fu-neg" style="font-size:10px">not in the register</span>')
            + "</td><td>" + fmtN(x.n) + "</td><td>" + fmt1(x.gal)
            + '</td><td class="bar"><i style="width:' + (x.usd / mx * 100).toFixed(0)
            + '%"></i><span>' + money0(x.usd) + "</span></td><td>"
            + (x.gal ? "$" + (x.usd / x.gal).toFixed(2) : "—") + "</td><td>"
            + esc(Object.keys(x.kinds).sort().join(", ")) + "</td><td>"
            + esc([...x.drivers].sort().slice(0, 4).join(", ")
                  + (x.drivers.size > 4 ? " +" + (x.drivers.size - 4) : "")) + "</td></tr>").join("")
        + "</tbody></table></div>"
        + '<p class="fu-note">A truck the fleet register has never heard of is worth a look — it '
        + "is either a rental nobody logged or a card assigned to the wrong vehicle. Where the "
        + "register knows what the truck drinks, a mismatched product shows up as a flag on the "
        + "swipe itself.</p>";
    }

    // ---- all swipes --------------------------------------------------------------------
    function allView(rs) {
      const list = rs.slice().sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || ""))
        || String(b.Time || "").localeCompare(String(a.Time || "")));
      const cap = list.slice(0, 400);
      return '<div class="rs-tablewrap"><table class="rs-table fu-t"><thead><tr><th>Date</th><th>Foreman</th>'
        + "<th>Truck</th><th>Merchant</th><th>Product</th><th>Gallons</th><th>Net</th>"
        + "<th>Placed on</th></tr></thead><tbody>"
        + cap.map(r => '<tr><td class="strong">' + esc(String(r.Date || "").slice(0, 10))
            + (r.Time ? ' <span style="color:var(--faint);font-weight:500">'
                        + esc(String(r.Time).slice(0, 5)) + "</span>" : "")
            + "</td><td>" + esc(r.Foreman || r["Driver Raw"] || "—") + "</td><td>"
            + esc(r.Truck || r["Vehicle Raw"] || "—") + "</td><td>"
            + esc((r.Merchant || "—") + (r["Merchant State"] ? " " + r["Merchant State"] : ""))
            + "</td><td>" + esc(r["Fuel Kind"] || r.Product || "—") + "</td><td>"
            + (r.Gallons ? fmt1(r.Gallons) : "—") + "</td><td>" + money(r["Net Cost"]) + "</td><td"
            + (PLACED[r["Match Status"]] ? "" : ' class="fu-neg"') + ">"
            + esc(PLACED[r["Match Status"]]
                  ? (r["Job Customer"] || r["Job Request"] || "a job")
                  : (STATUS_LABEL[r["Match Status"]] || r["Match Status"]))
            + "</td></tr>").join("")
        + "</tbody></table></div>"
        + (list.length > cap.length
            ? '<p class="fu-note">Showing the newest ' + cap.length + " of " + fmtN(list.length)
              + " — narrow the month or search to see the rest.</p>" : "");
    }

    function wire() {
      main.querySelectorAll(".rs-seg button").forEach(b => {
        b.onclick = () => { S.view = b.dataset.v; S.msg = ""; paint(); };
      });
      // kit slicer instead of the native month <select> — same "" = every-month value
      const m = main.querySelector("#fuMonth");
      if (m && RSC.localSelect) RSC.localSelect(m, {
        label: "Month",
        values: months().map(mo => ({ v: mo, l: monLab(mo) })),
        value: S.month,
        allLabel: "Every month",
        onChange: v => { S.month = v; paint(); },
      });
      const q = main.querySelector("#fuQ");
      if (q) q.oninput = function () {
        S.q = this.value;
        const at = this.selectionStart;
        paint();
        const nq = main.querySelector("#fuQ");
        if (nq) { nq.focus(); nq.setSelectionRange(at, at); }
      };
      const sr = main.querySelector("#fuShowRes");
      if (sr) sr.onclick = () => { S.showResolved = !S.showResolved; paint(); };
      main.querySelectorAll(".fu-head").forEach(hd => {
        hd.onclick = () => {
          const k = hd.parentElement.dataset.k;
          S.open = S.open === k ? null : k;
          paint();
        };
      });
      main.querySelectorAll("[data-resolve]").forEach(b => {
        b.onclick = e => {
          e.stopPropagation();
          const k = b.dataset.resolve;
          const inp = main.querySelector('[data-ex="' + CSS.escape(k) + '"]');
          resolve(k, inp ? inp.value : "", b);
        };
      });
      main.querySelectorAll("[data-ex]").forEach(i => {
        i.onclick = e => e.stopPropagation();
        // keep the draft in state: any repaint (a search keystroke, another card resolving)
        // rebuilds this input, and a half-written explanation must survive that
        i.oninput = () => { S.draft[i.dataset.ex] = i.value; };
        i.onkeydown = e => {
          if (e.key !== "Enter") return;
          e.stopPropagation();
          const b = main.querySelector('[data-resolve="' + CSS.escape(i.dataset.ex) + '"]');
          resolve(i.dataset.ex, i.value, b);
        };
      });
      main.querySelectorAll("[data-reopen]").forEach(b => {
        b.onclick = e => { e.stopPropagation(); reopen(b.dataset.reopen, b); };
      });
    }

    function rowFor(k) { return (S.rows || []).filter(r => r["Line Key"] === k)[0]; }

    function resolve(key, text, btn) {
      const ex = String(text || "").trim();
      if (!ex) {
        S.msg = "Say what happened first.";
        S.msgErr = true;
        S.msgFor = key;              // shown beside the box being answered, not in the header
        paint();
        const again = main.querySelector('[data-ex="' + CSS.escape(key) + '"]');
        if (again) again.focus();
        return;
      }
      S.msgFor = null;
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
      api("/api/_fuelrev", { method: "POST", body: JSON.stringify({
            line_key: key, explanation: ex }) })
        .then(j => {
          // patch the loaded row rather than re-pulling the whole mart: the answer is ours,
          // and the mart will carry it from the next pipeline run onward
          const r = rowFor(key);
          if (r) {
            r.Resolved = 1; r.Resolution = ex;
            r["Resolved By"] = j.by || "you";
            r["Resolved At"] = new Date().toISOString().slice(0, 19).replace("T", " ");
          }
          delete S.draft[key];
          S.msg = "Explained — it has left the queue and the note stays with the transaction.";
          S.msgErr = false;
          S.msgFor = null;
          S.open = null;
          paint();
        })
        .catch(e => { S.msg = "Not saved — " + e.message; S.msgErr = true; paint(); });
    }

    function reopen(key, btn) {
      if (btn) { btn.disabled = true; btn.textContent = "…"; }
      api("/api/_fuelrev", { method: "POST", body: JSON.stringify({ line_key: key, reopen: true }) })
        .then(() => {
          const r = rowFor(key);
          if (r) { r.Resolved = 0; r.Resolution = null; r["Resolved By"] = null; r["Resolved At"] = null; }
          S.msg = "Back in the queue.";
          S.msgErr = false;
          paint();
        })
        .catch(e => { S.msg = e.message; S.msgErr = true; paint(); });
    }

    load();
  },
});
