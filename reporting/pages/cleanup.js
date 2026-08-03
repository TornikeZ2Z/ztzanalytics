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
               "Chained Jobs", "Skipped", "Skipped Why"],
      };
    }
    if (!RS.DATASETS.fct_cleanup_option) {
      RS.DATASETS.fct_cleanup_option = {
        table: "fct_cleanup_option",
        cols: ["Day", "Rank", "Kind", "Job Code", "Customer", "CF", "After Code",
               "After Customer", "Move To", "Target Spare", "Link Miles", "Link Minutes",
               "Cost", "Discount", "Recommended", "Purpose", "Lands Behind", "Status"],
      };
    }
    if (!RS.DATASETS.fct_cleanup_job) {
      RS.DATASETS.fct_cleanup_job = {
        table: "fct_cleanup_job",
        cols: ["Day", "Job Code", "Customer", "Start", "Hours", "CF", "Crew", "Moving Type",
               "Job Type", "Pickup Zip", "Pickup City", "Pickup State", "Delivery Zip",
               "Delivery City", "Delivery State", "Foreman Email", "Foreman", "Route", "Route Legs",
               "Chained After", "Base", "Company"],
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
    var S = window.__CU || (window.__CU = { days: null, jobs: null, opts: null,
      sel: null, probOnly: false, busy: "", msg: "",
      baseF: null, coF: null, focus: null, mapOn: true });

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
      + ".cu-opt{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-top:1px solid var(--line-2)}"
      + ".cu-opt:first-child{border-top:0}"
      + ".cu-opt.done{opacity:.5}"
      + ".cu-obody{flex:1;min-width:0}"
      + ".cu-otitle{font-size:13.5px;font-weight:700;letter-spacing:-.1px}"
      + ".cu-owhy{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:2px}"
      + ".cu-oact{display:flex;gap:6px;flex:0 0 auto}"
      + ".cu-btn{font:inherit;font-size:12px;font-weight:750;color:var(--ink);background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:9px;padding:6px 12px;cursor:pointer;white-space:nowrap}"
      + ".cu-btn:hover{border-color:var(--blue)} .cu-btn:disabled{opacity:.5;cursor:default}"
      + ".cu-btn.pri{background:var(--brand);color:var(--brand-ink);border:0}"
      + ".cu-msg{font-size:12.5px;font-weight:650;min-height:17px;margin-top:8px}"
      /* DAY NAV */
      + ".cu-nav{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:10px}"
      + ".cu-nav .cu-btn{padding:5px 11px}"
      /* FILTERS */
      + ".cu-fil{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:12px}"
      + ".cu-fil .lab{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin-right:2px}"
      + ".cu-chip{font:inherit;font-size:11.5px;font-weight:700;padding:4px 10px;border-radius:999px;"
      + "background:var(--panel-2);border:1px solid var(--line-2);color:var(--faint);cursor:pointer}"
      + ".cu-chip.on{background:var(--ink);border-color:var(--ink);color:var(--panel)}"
      /* TIMELINE: a route is a bar on a clock, grouped by the depot it leaves from */
      + ".cu-tl{margin-top:4px}"
      + ".cu-tlax{position:relative;height:16px;margin-left:150px;border-bottom:1px solid var(--line)}"
      + ".cu-tlax span{position:absolute;top:0;font-size:9.5px;color:var(--faint);"
      + "transform:translateX(-50%);font-variant-numeric:tabular-nums}"
      + ".cu-base{margin-top:10px}"
      + ".cu-bhd{font-size:10px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;"
      + "color:var(--faint);background:var(--panel-2);border-radius:7px;padding:3px 9px;"
      + "display:inline-block;margin-bottom:5px}"
      + ".cu-row{display:flex;align-items:center;gap:0;min-height:30px}"
      + ".cu-rlab{flex:0 0 150px;font-size:11.5px;line-height:1.3;padding-right:10px}"
      + ".cu-rlab b{font-size:12px;font-variant-numeric:tabular-nums}"
      + ".cu-rlab span{display:block;color:var(--faint);font-size:10.5px;overflow:hidden;"
      + "text-overflow:ellipsis;white-space:nowrap}"
      + ".cu-track{position:relative;flex:1;height:26px;border-left:1px solid var(--line-2)}"
      + ".cu-bar{position:absolute;top:3px;height:20px;border-radius:6px;background:var(--pos,#1c7a4a);"
      + "color:#fff;font-size:10.5px;font-weight:700;line-height:20px;padding:0 7px;overflow:hidden;"
      + "white-space:nowrap;text-overflow:ellipsis;cursor:pointer}"
      + ".cu-bar.long{background:#b26b0b} .cu-bar.straight{background:#7c5ce0}"
      + ".cu-bar.labor{background:#78808d}"
      + ".cu-bar.dim{opacity:.35} .cu-bar.sel{outline:2px solid var(--ink);outline-offset:1px}"
      /* MAP */
      + ".cu-map{height:420px;border-radius:12px;overflow:hidden;border:1px solid var(--line);"
      + "background:var(--panel-2)}"
      + ".cu-mleg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--faint);margin-top:8px}"
      + ".cu-mleg i{display:inline-block;width:16px;height:3px;border-radius:2px;margin-right:5px;"
      + "vertical-align:2px}"
      + "</style><div class='cu-wrap'><div id='cuBody'><div class='cu-empty'>Loading the horizon…</div></div></div>";

    var gen = (window.__CUGEN = (window.__CUGEN || 0) + 1);

    function money(n) { return Number(n || 0).toLocaleString(); }
    function fmtDay(iso) {
      var d = new Date(String(iso).slice(0, 10) + "T12:00");
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    var TODAY = new Date().toISOString().slice(0, 10);

    // ---- filters -------------------------------------------------------------------
    function filters(jobs) {
      var bases = [], cos = [];
      jobs.forEach(function (j) {
        if (j.Base && bases.indexOf(j.Base) < 0) bases.push(j.Base);
        if (j.Company && cos.indexOf(j.Company) < 0) cos.push(j.Company);
      });
      bases.sort(); cos.sort();
      if (bases.length < 2 && cos.length < 2) return "";
      function chips(list, cur, attr) {
        return list.map(function (v) {
          return "<button class='cu-chip" + (cur === v ? " on" : "") + "' " + attr + "='"
            + esc(v) + "'>" + esc(v) + "</button>";
        }).join("");
      }
      return "<div class='cu-fil'>"
        + (bases.length > 1 ? "<span class='lab'>Base</span>"
            + "<button class='cu-chip" + (S.baseF ? "" : " on") + "' data-base=''>All</button>"
            + chips(bases, S.baseF, "data-base") : "")
        + (cos.length > 1 ? "<span class='lab' style='margin-left:10px'>Company</span>"
            + "<button class='cu-chip" + (S.coF ? "" : " on") + "' data-co=''>All</button>"
            + chips(cos, S.coF, "data-co") : "")
        + "</div>";
    }

    // ---- the timeline: one row per crew, grouped by depot ---------------------------
    var DAY_FROM = 7, DAY_TO = 21;   // the clock the board uses
    function pos(hhmm) {
      var p = String(hhmm || "").split(":");
      var h = (+p[0] || 0) + (+p[1] || 0) / 60;
      return Math.max(0, Math.min(100, (h - DAY_FROM) / (DAY_TO - DAY_FROM) * 100));
    }
    function barClass(j) {
      var mt = String(j["Moving Type"] || "").toLowerCase();
      var jt = String(j["Job Type"] || "").toLowerCase();
      if (jt.indexOf("labor") >= 0) return "labor";
      if (jt.indexOf("straight") >= 0) return "straight";
      if (mt.indexOf("long") >= 0) return "long";
      return "";
    }
    function timeline(jobs) {
      // group jobs into their crew's route, then routes into their depot
      var byRoute = {};
      jobs.forEach(function (j) {
        var k = j.Route || ("solo:" + j["Job Code"]);
        (byRoute[k] = byRoute[k] || []).push(j);
      });
      var byBase = {};
      Object.keys(byRoute).forEach(function (k) {
        var legs = byRoute[k].sort(function (a, b) {
          return String(a.Start).localeCompare(String(b.Start)); });
        var b = legs[0].Base || "—";
        (byBase[b] = byBase[b] || []).push({ id: k, legs: legs });
      });

      var axis = "<div class='cu-tlax'>";
      for (var h = DAY_FROM; h <= DAY_TO; h += 2) {
        axis += "<span style='left:" + ((h - DAY_FROM) / (DAY_TO - DAY_FROM) * 100) + "%'>"
          + h + ":00</span>";
      }
      axis += "</div>";

      return "<div class='cu-tl'>" + axis + Object.keys(byBase).sort().map(function (b) {
        var rs = byBase[b].sort(function (x, y) {
          return String(x.legs[0].Start).localeCompare(String(y.legs[0].Start)); });
        return "<div class='cu-base'><div class='cu-bhd'>" + esc(b) + " base · "
          + rs.length + " crew" + (rs.length === 1 ? "" : "s") + "</div>"
          + rs.map(function (r) {
              var cf = r.legs.reduce(function (a, j) { return a + (+j.CF || 0); }, 0);
              var first = r.legs[0];
              var who = first.Foreman || "";
              return "<div class='cu-row'>"
                + "<div class='cu-rlab'><b>" + esc(r.id) + (who ? " " + esc(who) : "")
                + " · " + money(cf) + " CF</b>"
                + "<span>" + esc((first["Pickup City"] || "") + " → "
                    + (r.legs[r.legs.length - 1]["Delivery City"] || "")) + "</span></div>"
                + "<div class='cu-track'>"
                + r.legs.map(function (j, i) {
                    var l = pos(j.Start);
                    var hrs = +j.Hours || 2;
                    var w = Math.max(3, (hrs / (DAY_TO - DAY_FROM)) * 100);
                    var dim = S.focus && S.focus !== r.id;
                    return "<button class='cu-bar " + barClass(j) + (dim ? " dim" : "")
                      + (S.focus === r.id ? " sel" : "") + "' data-route='" + esc(r.id)
                      + "' style='left:" + l + "%;width:" + Math.min(w, 100 - l) + "%' title='"
                      + esc((j.Customer || j["Job Code"]) + " · " + j.Start + " · " + hrs + "h · "
                            + money(j.CF) + " CF") + "'>"
                      + (r.legs.length > 1 ? (i + 1) + "/" + r.legs.length + " · " : "")
                      + esc((j["Pickup City"] || "") + " → " + (j["Delivery City"] || ""))
                      + " · " + money(j.CF) + " CF</button>";
                  }).join("")
                + "</div></div>";
            }).join("")
          + "</div>";
      }).join("") + "</div>";
    }

    // ---- the map: real road routes, via the same HERE service the LD board uses -----
    function ensureLeaflet(cb) {
      if (window.L && window.L.map) { cb(); return; }
      if (!document.getElementById("ldLeafCss")) {
        var lc = document.createElement("link");
        lc.id = "ldLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
        document.head.appendChild(lc);
      }
      var sc = document.getElementById("ldLeafJs");
      if (sc) { sc.addEventListener("load", function () { cb(); }); return; }
      sc = document.createElement("script");
      sc.id = "ldLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js";
      sc.onload = function () { cb(); };
      document.head.appendChild(sc);
    }

    function drawMap(jobs) {
      var box = document.getElementById("cuMap");
      if (!box || !jobs.length) return;
      // Every leg we want drawn: the loaded run of each job, plus the EMPTY drive between
      // two jobs a crew runs back to back -- that empty leg is the cost chaining is trading
      // away, so it is the one a dispatcher most needs to see.
      var byRoute = {};
      jobs.forEach(function (j) {
        var k = j.Route || ("solo:" + j["Job Code"]);
        (byRoute[k] = byRoute[k] || []).push(j);
      });
      var legs = [];
      Object.keys(byRoute).forEach(function (k) {
        if (S.focus && S.focus !== k) return;
        var r = byRoute[k].sort(function (a, b) {
          return String(a.Start).localeCompare(String(b.Start)); });
        r.forEach(function (j, i) {
          if (j["Pickup Zip"] && j["Delivery Zip"])
            legs.push({ a: j["Pickup Zip"], b: j["Delivery Zip"], kind: barClass(j) || "loaded",
                        route: k, label: (j.Customer || j["Job Code"]) });
          var nx = r[i + 1];
          if (nx && j["Delivery Zip"] && nx["Pickup Zip"])
            legs.push({ a: j["Delivery Zip"], b: nx["Pickup Zip"], kind: "empty", route: k,
                        label: "empty drive" });
        });
      });
      if (!legs.length) { box.innerHTML = "<div style='padding:18px;color:var(--faint)'>"
        + "No mappable stops on this day.</div>"; return; }

      // the geometry service joins a leg's two zips with ":" and takes at most 16 per call,
      // so a busy day is fetched in batches and stitched back in order
      var pairs = legs.map(function (l) { return l.a + ":" + l.b; });
      var hdr = { headers: { Authorization: "Bearer " + ZTZ.getToken() } };
      var gen = window.__CUGEN;

      function fetchAll(est) {
        var out = [], i = 0;
        function next() {
          if (i >= pairs.length) return Promise.resolve({ legs: out });
          var batch = pairs.slice(i, i + 16);
          i += 16;
          return fetch(ZTZ.API + "/api/_ldgeo?" + (est ? "est=1&" : "") + "legs="
                       + encodeURIComponent(batch.join(",")), hdr)
            .then(function (r) { return r.json(); })
            .then(function (j) { out = out.concat((j && j.legs) || []); return next(); });
        }
        return next();
      }

      function render(j) {
        if (window.__CUGEN !== gen) return false;
        var got = (j && j.legs) || [];
        ensureLeaflet(function () {
          var m = box._m;
          if (!m) {
            m = L.map(box, { scrollWheelZoom: false, zoomSnap: 0.5 });
            L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
              { maxZoom: 18, subdomains: "abcd",
                attribution: "© OpenStreetMap · © CARTO" }).addTo(m);
            box._m = m; box._lay = [];
          }
          (box._lay || []).forEach(function (l) { try { m.removeLayer(l); } catch (e) {} });
          box._lay = [];
          // The frame follows the LOCAL work. One job to Florida would otherwise zoom the
          // whole day out to the eastern seaboard and turn the crews' actual morning into a
          // smudge, so long runs are drawn in full but do not get a vote on the bounds --
          // click their bar to follow one out.
          var bounds = [], far = 0;
          got.forEach(function (g, i) {
            var c = g.coords || [];
            if (c.length < 2) return;
            var meta = legs[i] || {};
            var empty = meta.kind === "empty";
            var col = empty ? "#7c5ce0" : (meta.kind === "long" ? "#b26b0b"
                      : meta.kind === "straight" ? "#7c5ce0" : "#1c7a4a");
            var pl = L.polyline(c, empty
              ? { color: col, weight: 2.5, dashArray: "6 7", opacity: 0.9 }
              : { color: col, weight: 4, opacity: 0.85 }).addTo(m);
            pl.bindTooltip((meta.label || "") + (g.miles ? " · " + g.miles + " mi" : "")
                           + (empty ? " (empty)" : ""), { sticky: true });
            box._lay.push(pl);
            if (meta.kind === "long" || meta.kind === "straight") far++;
            else c.forEach(function (p) { bounds.push(p); });
            if (!empty) {
              var mk = L.circleMarker(c[0], { radius: 4, color: col, fillColor: "#fff",
                                              fillOpacity: 1, weight: 2 }).addTo(m);
              box._lay.push(mk);
            }
          });
          if (!bounds.length) {   // a day of nothing but long runs still has to show them
            got.forEach(function (g) { (g.coords || []).forEach(function (p) { bounds.push(p); }); });
          }
          if (bounds.length) m.fitBounds(bounds, { padding: [24, 24] });
          var fn = document.getElementById("cuFar");
          if (fn) fn.textContent = far
            ? (far + " long-distance " + (far === 1 ? "run runs" : "runs run")
               + " off the frame — click the bar to follow one.") : "";
          // Leaflet measures the container at creation; it was hidden until now
          setTimeout(function () { try { m.invalidateSize(); } catch (e) {} }, 60);
        });
        return got.length > 0;
      }

      // straight lines first so something is on screen immediately, then the real roads
      fetchAll(true)
        .then(function (j) {
          render(j);
          var need = (j.legs || []).some(function (l) { return l.source !== "here"; });
          if (need && window.__CUGEN === gen) fetchAll(false).then(render).catch(function () {});
        })
        .catch(function () {
          if (window.__CUGEN === gen && box)
            box.innerHTML = "<div style='padding:18px;color:var(--faint)'>Map unavailable.</div>";
        });
    }

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

        // filters narrow WHAT IS SHOWN, never what the day's verdict was computed from --
        // the crew count is a fact about the whole day, not about the slice you are looking at
        var shown = jobs.filter(function (j) {
          return (!S.baseF || j.Base === S.baseF) && (!S.coF || j.Company === S.coF);
        });

        // WHAT COULD BE DONE — the three-tier ladder, cheapest first. Shown even when the
        // day is comfortable, because a free chain is a crew freed for tomorrow's sale.
        var opts = (S.opts || []).filter(function (o) {
          return String(o.Day).slice(0, 10) === S.sel; })
          .sort(function (a, b) {
            return (+b.Recommended - +a.Recommended) || ((+a.Rank) - (+b.Rank)); });
        var openOpts = opts.filter(function (o) { return o.Status === "open"; });
        var optHtml = "";
        if (opts.length) {
          optHtml = "<div class='cu-card'><div class='cu-hd'><b>What could free a crew</b>"
            + "<span class='cu-pill'>" + openOpts.length + " open</span>"
            + (opts.length - openOpts.length
                ? "<span class='cu-pill'>" + (opts.length - openOpts.length) + " decided</span>" : "")
            + "</div>"
            + opts.map(function (o) {
                var done = o.Status !== "open";
                var isCall = o.Kind === "call";
                var title = isCall
                  ? esc(o.Customer || o["Job Code"]) + " runs after " + esc(o["After Customer"] || o["After Code"])
                  : esc(o.Customer || o["Job Code"]) + " moves to " + fmtDay(o["Move To"]);
                var why = isCall
                  ? ("Chaining this job behind " + esc(o["After Code"] || "") + " frees one crew. "
                     + (o["Link Minutes"] != null ? "About " + o["Link Minutes"] + " min ("
                        + o["Link Miles"] + " mi) between them. " : "")
                     + (o.Discount ? "Needs a call and a $" + o.Discount + " same-day discount." : ""))
                  : ("Moving the date frees a crew here; "
                     + fmtDay(o["Move To"]) + " has " + (o["Target Spare"] != null ? o["Target Spare"] : "?")
                     + " spare. "
                     + (o["Lands Behind"] ? "It would chain behind " + esc(o["Lands Behind"])
                        + " there, so it costs no crew on the day it moves to."
                        : "It would need its own crew on that day."));
                return "<div class='cu-opt" + (done ? " done" : "") + "'>"
                  + "<div class='cu-obody'><div class='cu-otitle'>"
                  + "<span class='cu-pill " + (isCall ? "" : "tight") + "' style='margin-right:7px'>"
                  + (isCall ? "chain" : "move date") + "</span>" + title
                  + (+o.Recommended ? " <span class='cu-pill ok'>recommended</span>" : "")
                  + "</div><div class='cu-owhy'>" + why + "</div></div>"
                  + "<div class='cu-oact'>"
                  + (done
                     ? "<span class='cu-pill " + (o.Status === "accepted" ? "ok" : "short") + "'>"
                       + esc(o.Status) + "</span>"
                       + "<button class='cu-btn' data-dec='reopened' data-kind='" + esc(o.Kind)
                       + "' data-code='" + esc(o["Job Code"]) + "' data-cust='" + esc(o.Customer || "")
                       + "' data-after='" + esc(o["After Code"] || "") + "' data-to='"
                       + esc(o["Move To"] || "") + "'" + (S.busy ? " disabled" : "") + ">Reopen</button>"
                     : "<button class='cu-btn pri' data-dec='accepted' data-kind='" + esc(o.Kind)
                       + "' data-code='" + esc(o["Job Code"]) + "' data-cust='" + esc(o.Customer || "")
                       + "' data-after='" + esc(o["After Code"] || "") + "' data-to='"
                       + esc(o["Move To"] || "") + "'" + (S.busy ? " disabled" : "") + ">Accept</button>"
                       + "<button class='cu-btn' data-dec='declined' data-kind='" + esc(o.Kind)
                       + "' data-code='" + esc(o["Job Code"]) + "' data-cust='" + esc(o.Customer || "")
                       + "' data-after='" + esc(o["After Code"] || "") + "' data-to='"
                       + esc(o["Move To"] || "") + "'" + (S.busy ? " disabled" : "") + ">Decline</button>")
                  + "</div></div>";
              }).join("")
            + "<div class='cu-msg'>" + esc(S.msg || "") + "</div>"
            + "<div class='cu-note'>Declining is <b>permanent and per customer</b> — you only "
            + "get to ask someone once, so a customer who says no is never suggested again, on "
            + "any day. Decisions are recorded for everyone, not just this browser. Accepting "
            + "records the decision; the calendar is not changed yet.</div></div>";
        }

        detail = "<div class='cu-card'>"
          + "<div class='cu-hd'><b>" + new Date(S.sel + "T12:00").toLocaleDateString("en-US",
              { weekday: "long", month: "long", day: "numeric" }) + "</b>"
          + "<span class='cu-pill " + esc(d.Status) + "'>" + esc(d.Status) + "</span>"
          + "<span class='cu-pill'>" + d.Jobs + " jobs</span>"
          + "<span class='cu-pill'>" + rt + " crews needed</span>"
          + (+d.Skipped ? "<span class='cu-pill tight' title='" + esc(d["Skipped Why"] || "")
              + "'>" + d.Skipped + " event" + (+d.Skipped === 1 ? "" : "s")
              + " skipped</span>" : "")
          + "</div>"
          + "<div class='cu-verdict'>" + verdict + "</div>"
          + (+d.Skipped ? "<div class='cu-off'><b>Not counted:</b> "
              + esc(d["Skipped Why"] || "") + "</div>" : "")
          + (d["Crews Off"] ? "<div class='cu-off'><b>Off today:</b> " + esc(d["Crews Off"]) + "</div>" : "")
          + filters(jobs)
          + "<div class='cu-mleg' style='margin:0 0 6px'>"
          + "<span><i style='background:#1c7a4a'></i>local</span>"
          + "<span><i style='background:#b26b0b'></i>long distance</span>"
          + "<span><i style='background:#7c5ce0'></i>straight</span>"
          + "<span><i style='background:#78808d'></i>labor only</span></div>"
          + (shown.length ? timeline(shown)
            : "<div class='cu-empty'>No jobs match this filter.</div>")
          + "<div class='cu-note'>Each row is <b>one crew's day</b>, grouped by the depot it "
          + "leaves from and laid out on the clock. A row with two bars is a chain — one crew "
          + "running both jobs, which is why the day needs fewer crews than it has jobs. Click "
          + "a bar to trace that run on the map.</div>"
          + "</div>"
          + (shown.length ? "<div class='cu-card'><div class='cu-hd'><b>Where the day goes</b>"
              + "<span class='cu-pill'>" + (S.focus ? "one run" : "every run") + "</span>"
              + (S.focus && S.mapOn ? "<button class='cu-btn' id='cuAll' style='margin-left:auto'>"
                  + "Show every run</button>" : "")
              + "<button class='cu-btn' id='cuMapT' style='margin-left:"
              + (S.focus && S.mapOn ? "6px" : "auto") + "'>"
              + (S.mapOn ? "Hide map" : "Show map") + "</button></div>"
              + (S.mapOn ? "<div class='cu-map' id='cuMap'></div>" : "")
              + (S.mapOn ? "<div class='cu-mleg'>"
              + "<span><i style='background:#1c7a4a'></i>loaded — pickup to delivery</span>"
              + "<span><i style='background:#7c5ce0'></i>empty — the drive between two chained jobs</span>"
              + "<span><i style='background:#b26b0b'></i>long distance</span>"
              + "<span id='cuFar'></span></div>" : "") + "</div>" : "");
      }

      // day navigation: the strip is for scanning the horizon, these are for walking it
      var order = shown.map(function (x) { return String(x.Day).slice(0, 10); });
      var at = order.indexOf(S.sel);
      var tomorrow = new Date(TODAY + "T12:00");
      tomorrow.setDate(tomorrow.getDate() + 1);
      var TOM = tomorrow.toISOString().slice(0, 10);
      var has = function (iso) {
        return days.some(function (x) { return String(x.Day).slice(0, 10) === iso; }); };

      var toggle = "<div class='cu-nav'>"
        + "<button class='cu-btn' id='cuPrev'" + (at <= 0 ? " disabled" : "") + ">‹</button>"
        + "<button class='cu-btn' id='cuNext'"
        + (at < 0 || at >= order.length - 1 ? " disabled" : "") + ">›</button>"
        + "<button class='cu-btn" + (S.sel === TODAY ? " pri" : "") + "' data-jump='" + TODAY + "'"
        + (has(TODAY) ? "" : " disabled") + ">Today</button>"
        + "<button class='cu-btn" + (S.sel === TOM ? " pri" : "") + "' data-jump='" + TOM + "'"
        + (has(TOM) ? "" : " disabled") + ">Tomorrow</button>"
        + "<button class='cu-pill" + (S.probOnly ? " tight" : "") + "' id='cuProb' "
        + "style='cursor:pointer;border:0;font:inherit;font-size:10px;font-weight:800;margin-left:auto'>"
        + (S.probOnly ? "Showing days that need attention" : "Show only days that need attention")
        + "</button></div>";

      body.innerHTML = kpis + toggle + strip + detail + (typeof optHtml === "string" ? optHtml : "");

      Array.prototype.forEach.call(body.querySelectorAll("[data-day]"), function (b) {
        b.onclick = function () { S.sel = b.getAttribute("data-day"); paint(); };
      });
      var pb = document.getElementById("cuProb");
      if (pb) pb.onclick = function () { S.probOnly = !S.probOnly; paint(); };
      var pv = document.getElementById("cuPrev"), nx = document.getElementById("cuNext");
      if (pv) pv.onclick = function () {
        if (at > 0) { S.sel = order[at - 1]; S.focus = null; paint(); } };
      if (nx) nx.onclick = function () {
        if (at >= 0 && at < order.length - 1) { S.sel = order[at + 1]; S.focus = null; paint(); } };
      Array.prototype.forEach.call(body.querySelectorAll("[data-jump]"), function (b) {
        b.onclick = function () {
          S.sel = b.getAttribute("data-jump"); S.focus = null;
          // jumping to a day the "needs attention" view has hidden would land on nothing
          if (order.indexOf(S.sel) < 0) S.probOnly = false;
          paint();
        };
      });

      Array.prototype.forEach.call(body.querySelectorAll("[data-dec]"), function (b) {
        b.onclick = function () { decide(b); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-base]"), function (b) {
        b.onclick = function () { S.baseF = b.getAttribute("data-base") || null; S.focus = null; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-co]"), function (b) {
        b.onclick = function () { S.coF = b.getAttribute("data-co") || null; S.focus = null; paint(); };
      });
      Array.prototype.forEach.call(body.querySelectorAll("[data-route]"), function (b) {
        b.onclick = function () {
          var r = b.getAttribute("data-route");
          S.focus = (S.focus === r) ? null : r;   // click the same run again to see them all
          paint();
        };
      });
      var ab = document.getElementById("cuAll");
      if (ab) ab.onclick = function () { S.focus = null; paint(); };
      var mt = document.getElementById("cuMapT");
      if (mt) mt.onclick = function () { S.mapOn = !S.mapOn; paint(); };

      // the map is drawn after the DOM exists, and only for what is actually shown
      if (document.getElementById("cuMap")) {
        var vis = (S.jobs || []).filter(function (j) {
          return String(j.Day).slice(0, 10) === S.sel
            && (!S.baseF || j.Base === S.baseF) && (!S.coF || j.Company === S.coF); });
        drawMap(vis);
      }
    }

    function decide(btn) {
      if (S.busy) return;
      var action = btn.getAttribute("data-dec");
      var code = btn.getAttribute("data-code");
      var cust = btn.getAttribute("data-cust");
      // Declining is permanent and reaches every other day, so it gets a confirm; accepting
      // only records an intention and is easily reopened.
      if (action === "declined" && !window.confirm(
            "Decline for " + (cust || code) + "?\n\nThis is permanent: " + (cust || "this customer")
            + " will not be suggested again on any day, for any option.")) return;
      S.busy = code; S.msg = ""; paint();
      fetch(ZTZ.API + "/api/_cleanupdecide", {
        method: "POST",
        headers: { "Content-Type": "application/json",
                   Authorization: "Bearer " + ZTZ.getToken() },
        body: JSON.stringify({
          day: S.sel, job_code: code, customer: cust, kind: btn.getAttribute("data-kind"),
          action: action, after_code: btn.getAttribute("data-after") || null,
          move_to: btn.getAttribute("data-to") || null }),
      }).then(function (r) { return r.json().then(function (j) {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          // reflect it now; the mart re-reads decisions on its next build
          var shows = action === "reopened" ? "open" : action;
          (S.opts || []).forEach(function (o) {
            if (o["Job Code"] === code && String(o.Day).slice(0, 10) === S.sel) o.Status = shows;
            if (action === "declined" && cust && o.Customer === cust) o.Status = "declined";
            // reopening lifts the customer-wide block the decline had cast
            if (action === "reopened" && cust && o.Customer === cust && o.Status === "declined")
              o.Status = "open";
          });
          S.busy = "";
          S.msg = action === "reopened"
            ? "Reopened — " + (cust || code) + " is back on the list."
            : "Recorded — " + action + " for " + (cust || code) + ".";
          paint();
        }); })
        .catch(function (e) {
          S.busy = ""; S.msg = "Could not record that: " + String(e.message || e);
          paint();
        });
    }

    if (S.days && S.jobs && S.opts) { paint(); return; }
    Promise.all([RS.load("fct_cleanup_day"), RS.load("fct_cleanup_job"),
                 RS.load("fct_cleanup_option")])
      .then(function (res) {
        S.days = res[0] || [];
        S.jobs = res[1] || [];
        S.opts = res[2] || [];
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
