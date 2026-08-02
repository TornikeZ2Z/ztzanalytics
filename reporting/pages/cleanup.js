/* CALENDAR CLEANUP — does every day have enough crews, and where is it tight?
 *
 * The question this answers is not "what is booked" but "can we staff it, and do we still
 * have room for tomorrow's sale". Every day should keep a couple of crews spare; a day that
 * runs to the last foreman has no room for a callback, a sick driver or a same-day booking.
 *
 * Reads fct_cleanup_day (the verdict) and fct_cleanup_job (the drill-down), both precomputed
 * by the pipeline from the same engine the dispatcher board runs.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.fct_cleanup_day) {
      RS.DATASETS.fct_cleanup_day = {
        table: "fct_cleanup_day",
        cols: ["Day", "Weekday", "Jobs", "Routes", "Routes Before Chaining", "Crews Available",
               "Target", "Spare", "Status", "Near Full", "Chains Applied", "Crews Off",
               "Chained Jobs"],
      };
    }
    if (!RS.DATASETS.fct_cleanup_job) {
      RS.DATASETS.fct_cleanup_job = {
        table: "fct_cleanup_job",
        cols: ["Day", "Job Code", "Customer", "Start", "Hours", "CF", "Crew", "Moving Type",
               "Job Type", "Pickup Zip", "Pickup City", "Pickup State", "Delivery Zip",
               "Delivery City", "Delivery State", "Foreman Email", "Route", "Route Legs",
               "Chained After"],
      };
    }
  }
})();

registerPage({
  id: "cleanup",
  title: "Calendar Cleanup",
  subtitle: "Crews needed against crews available, day by day — and where the buffer runs out.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__CU || (window.__CU = { days: null, jobs: null, sel: null, probOnly: false });

    host.innerHTML = '<style id="cuCss">'
      + ".cu-wrap{max-width:1280px}"
      + ".cu-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}"
      + ".cu-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".cu-kpi b{display:block;font-size:26px;letter-spacing:-.5px;line-height:1.1}"
      + ".cu-kpi span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:4px}"
      + ".cu-kpi small{display:block;font-size:11px;color:var(--faint);margin-top:2px}"
      + ".cu-kpi.bad b{color:var(--neg,#b02a37)} .cu-kpi.warn b{color:#b26b0b}"
      + ".cu-kpi.good b{color:var(--pos,#1c7a4a)}"
      /* the horizon: one tile per day, so a problem is found by scanning not reading */
      + ".cu-strip{display:flex;gap:8px;overflow-x:auto;padding:2px 2px 10px;margin-bottom:16px}"
      + ".cu-day{flex:0 0 auto;width:104px;background:var(--panel);border:1px solid var(--line);"
      + "border-radius:12px;padding:9px 10px;cursor:pointer;text-align:left;font:inherit;color:var(--ink)}"
      + ".cu-day:hover{border-color:var(--blue)}"
      + ".cu-day.on{border-color:var(--ink);box-shadow:0 0 0 1px var(--ink)}"
      + ".cu-day .dow{font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".cu-day .dat{font-size:14px;font-weight:750;letter-spacing:-.2px;margin-top:1px}"
      + ".cu-day .bar{height:5px;border-radius:99px;background:var(--panel-2);margin:8px 0 6px;overflow:hidden}"
      + ".cu-day .bar i{display:block;height:100%;border-radius:99px;background:var(--pos,#1c7a4a)}"
      + ".cu-day.tight .bar i{background:#b26b0b} .cu-day.short .bar i{background:var(--neg,#b02a37)}"
      + ".cu-day .fig{font-size:11.5px;color:var(--faint);font-variant-numeric:tabular-nums}"
      + ".cu-day .fig b{color:var(--ink);font-weight:700}"
      + ".cu-day.today{background:linear-gradient(0deg,var(--panel-2),var(--panel))}"
      + ".cu-day.today .dow{color:var(--blue)}"
      + ".cu-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;margin-bottom:14px}"
      + ".cu-hd{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-bottom:12px}"
      + ".cu-hd b{font-size:16px;letter-spacing:-.25px}"
      + ".cu-pill{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "padding:2px 8px;border-radius:999px;background:var(--panel-2);color:var(--faint)}"
      + ".cu-pill.ok{background:rgba(28,122,74,.12);color:var(--pos,#1c7a4a)}"
      + ".cu-pill.tight{background:rgba(178,107,11,.14);color:#b26b0b}"
      + ".cu-pill.short{background:rgba(176,42,55,.12);color:var(--neg,#b02a37)}"
      /* the sentence a dispatcher actually needs */
      + ".cu-verdict{font-size:14px;line-height:1.6;color:var(--ink);margin-bottom:12px}"
      + ".cu-verdict b{font-variant-numeric:tabular-nums}"
      + ".cu-off{font-size:12.5px;color:var(--faint);margin-bottom:12px}"
      + ".cu-tbl{width:100%;border-collapse:collapse;font-size:13px}"
      + ".cu-tbl th{text-align:left;font-size:9.5px;font-weight:800;text-transform:uppercase;"
      + "letter-spacing:.07em;color:var(--faint);padding:0 10px 7px 0;white-space:nowrap}"
      + ".cu-tbl td{padding:6px 10px 6px 0;border-top:1px solid var(--line-2);vertical-align:top}"
      + ".cu-tbl tr.chained td{background:rgba(47,111,208,.05)}"
      + ".cu-tbl .r{text-align:right;font-variant-numeric:tabular-nums}"
      + ".cu-rt{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;"
      + "background:var(--panel-2);color:var(--faint);white-space:nowrap}"
      + ".cu-rt.ch{background:rgba(47,111,208,.12);color:var(--blue)}"
      + ".cu-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:10px}"
      + ".cu-empty{color:var(--faint);font-size:13.5px;padding:16px 0}"
      + "</style><div class='cu-wrap'><div id='cuBody'><div class='cu-empty'>Loading the horizon…</div></div></div>";

    var gen = (window.__CUGEN = (window.__CUGEN || 0) + 1);

    function money(n) { return Number(n || 0).toLocaleString(); }
    function fmtDay(iso) {
      var d = new Date(String(iso).slice(0, 10) + "T12:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    var TODAY = new Date().toISOString().slice(0, 10);

    function paint() {
      // the page may have been swapped out while the tables were loading
      if (window.__CUGEN !== gen) return;
      var body = document.getElementById("cuBody");
      if (!body) return;

      var days = (S.days || []).slice().sort(function (a, b) {
        return String(a.Day).localeCompare(String(b.Day)); });
      if (!days.length) {
        body.innerHTML = "<div class='cu-empty'>No days in the horizon yet — the pipeline "
          + "builds this on its next run.</div>";
        return;
      }
      var shown = S.probOnly
        ? days.filter(function (d) { return d.Status !== "ok" || +d["Near Full"]; })
        : days;
      if (!S.sel || !days.some(function (d) { return String(d.Day).slice(0, 10) === S.sel; })) {
        // open on the first day that needs attention, else today, else the first day
        var prob = days.filter(function (d) { return d.Status !== "ok"; })[0];
        var tod = days.filter(function (d) { return String(d.Day).slice(0, 10) >= TODAY; })[0];
        S.sel = String((prob || tod || days[0]).Day).slice(0, 10);
      }

      var nProb = days.filter(function (d) { return d.Status !== "ok"; }).length;
      var nNear = days.filter(function (d) { return d.Status === "ok" && +d["Near Full"]; }).length;
      var tightest = days.slice().sort(function (a, b) { return (+a.Spare) - (+b.Spare); })[0];
      var totJobs = days.reduce(function (a, d) { return a + (+d.Jobs || 0); }, 0);
      var totChain = days.reduce(function (a, d) { return a + (+d["Chains Applied"] || 0); }, 0);

      var kpis = "<div class='cu-kpis'>"
        + "<div class='cu-kpi " + (nProb ? "bad" : "good") + "'><b>" + nProb + "</b>"
        + "<span>Days short of crews</span><small>fewer crews than routes</small></div>"
        + "<div class='cu-kpi " + (nNear ? "warn" : "") + "'><b>" + nNear + "</b>"
        + "<span>Days with no buffer</span><small>staffed, but nothing spare</small></div>"
        + "<div class='cu-kpi'><b>" + (tightest ? tightest.Spare : "—") + "</b>"
        + "<span>Tightest day</span><small>" + (tightest ? fmtDay(tightest.Day) : "") + " · spare crews</small></div>"
        + "<div class='cu-kpi'><b>" + money(totJobs) + "</b>"
        + "<span>Jobs in horizon</span><small>" + days.length + " days</small></div>"
        + "<div class='cu-kpi'><b>" + totChain + "</b>"
        + "<span>Crews freed by chaining</span><small>jobs sharing a crew</small></div>"
        + "</div>";

      var strip = "<div class='cu-strip'>" + shown.map(function (d) {
        var iso = String(d.Day).slice(0, 10);
        var av = +d["Crews Available"] || 0, rt = +d.Routes || 0;
        var pct = av ? Math.min(100, Math.round(rt / av * 100)) : 0;
        return "<button class='cu-day " + esc(d.Status)
          + (iso === S.sel ? " on" : "") + (iso === TODAY ? " today" : "")
          + "' data-day='" + esc(iso) + "'>"
          + "<div class='dow'>" + esc(d.Weekday) + (iso === TODAY ? " · today" : "") + "</div>"
          + "<div class='dat'>" + fmtDay(iso) + "</div>"
          + "<div class='bar'><i style='width:" + pct + "%'></i></div>"
          + "<div class='fig'><b>" + rt + "</b>/" + av + " crews</div>"
          + "<div class='fig'>" + (+d.Spare >= 0 ? "+" : "") + d.Spare + " spare</div>"
          + "</button>";
      }).join("") + "</div>";

      var d = days.filter(function (x) { return String(x.Day).slice(0, 10) === S.sel; })[0];
      var detail = "";
      if (d) {
        var av = +d["Crews Available"], rt = +d.Routes, sp = +d.Spare, tg = +d.Target;
        var verdict = rt > av
          ? "This day needs <b>" + rt + "</b> crews and only <b>" + av + "</b> are available — "
            + "<b>" + (rt - av) + "</b> short."
          : (sp <= (av - tg)
             ? "Staffed, but with <b>" + sp + "</b> spare there is no room for a callback or a same-day sale."
             : "Comfortable: <b>" + rt + "</b> crews needed of <b>" + av + "</b> available, "
               + "<b>" + sp + "</b> spare.");
        var chained = +d["Chains Applied"] || 0;
        if (chained) {
          verdict += " Chaining already saved <b>" + (+d["Routes Before Chaining"] - rt)
            + "</b> " + ((+d["Routes Before Chaining"] - rt) === 1 ? "crew" : "crews") + ".";
        }
        var jobs = (S.jobs || []).filter(function (j) {
          return String(j.Day).slice(0, 10) === S.sel; })
          .sort(function (a, b) { return String(a.Start).localeCompare(String(b.Start)); });

        detail = "<div class='cu-card'>"
          + "<div class='cu-hd'><b>" + new Date(S.sel + "T12:00").toLocaleDateString("en-US",
              { weekday: "long", month: "long", day: "numeric" }) + "</b>"
          + "<span class='cu-pill " + esc(d.Status) + "'>" + esc(d.Status) + "</span>"
          + "<span class='cu-pill'>" + d.Jobs + " jobs</span>"
          + "<span class='cu-pill'>" + rt + " crews needed</span></div>"
          + "<div class='cu-verdict'>" + verdict + "</div>"
          + (d["Crews Off"] ? "<div class='cu-off'><b>Off today:</b> " + esc(d["Crews Off"]) + "</div>" : "")
          + (jobs.length ? "<table class='cu-tbl'><thead><tr>"
              + "<th>Start</th><th>Job</th><th>Customer</th><th>From</th><th>To</th>"
              + "<th class='r'>CF</th><th class='r'>Crew</th><th class='r'>Hrs</th><th>Type</th><th>Crew slot</th>"
              + "</tr></thead><tbody>"
              + jobs.map(function (j) {
                  var sh = (+j["Route Legs"] || 1) > 1;
                  return "<tr" + (sh ? " class='chained'" : "") + ">"
                    + "<td>" + esc(j.Start || "") + "</td>"
                    + "<td>" + esc(j["Job Code"] || "") + "</td>"
                    + "<td>" + esc(j.Customer || "") + "</td>"
                    + "<td>" + esc((j["Pickup City"] || "") + " " + (j["Pickup State"] || "")) + "</td>"
                    + "<td>" + esc((j["Delivery City"] || "") + " " + (j["Delivery State"] || "")) + "</td>"
                    + "<td class='r'>" + money(j.CF) + "</td>"
                    + "<td class='r'>" + esc(j.Crew || "") + "</td>"
                    + "<td class='r'>" + esc(j.Hours || "") + "</td>"
                    + "<td>" + esc(j["Job Type"] || j["Moving Type"] || "") + "</td>"
                    + "<td><span class='cu-rt" + (sh ? " ch" : "") + "'>" + esc(j.Route || "—")
                    + (sh ? " · shared" : "") + "</span></td></tr>";
                }).join("")
              + "</tbody></table>"
            : "<div class='cu-empty'>No jobs on this day.</div>")
          + "<div class='cu-note'>A <b>crew slot</b> is one foreman's day. Jobs on the same slot "
          + "are chained — one crew runs them back to back, which is why the day needs fewer "
          + "crews than it has jobs. The target keeps 2 crews spare for callbacks and same-day sales.</div>"
          + "</div>";
      }

      var toggle = "<div class='cu-hd' style='margin-bottom:10px'>"
        + "<button class='cu-pill" + (S.probOnly ? " tight" : "") + "' id='cuProb' "
        + "style='cursor:pointer;border:0;font:inherit;font-size:10px;font-weight:800'>"
        + (S.probOnly ? "Showing days that need attention" : "Show only days that need attention")
        + "</button></div>";

      body.innerHTML = kpis + toggle + strip + detail;

      Array.prototype.forEach.call(body.querySelectorAll("[data-day]"), function (b) {
        b.onclick = function () { S.sel = b.getAttribute("data-day"); paint(); };
      });
      var pb = document.getElementById("cuProb");
      if (pb) pb.onclick = function () { S.probOnly = !S.probOnly; paint(); };
    }

    if (S.days && S.jobs) { paint(); return; }
    Promise.all([RS.load("fct_cleanup_day"), RS.load("fct_cleanup_job")])
      .then(function (res) {
        S.days = res[0] || [];
        S.jobs = res[1] || [];
        paint();
      })
      .catch(function (e) {
        if (window.__CUGEN !== gen) return;
        var body = document.getElementById("cuBody");
        if (body) body.innerHTML = "<div class='cu-empty'>Could not load the horizon: "
          + esc(String(e)) + "</div>";
      });
  },
});
