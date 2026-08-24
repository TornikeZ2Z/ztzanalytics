/* FOREMAN LATE ARRIVALS — did the crew get there by the time the customer was promised.
 *
 * His ask (2026-08-24): by foreman, then by month — jobs, times late, and the percentage —
 * drilling all the way to the individual job, with its calendar event and its digital
 * contract one click away.
 *
 * THE DEADLINE IS THE CALENDAR EVENT'S END, because the event is the arrival window the
 * customer agreed to: 08:00–10:00 means "be there by ten". The arrival is the digital
 * contract's own clock — START for an hourly job, ARRIVAL for a flat rate one. Both are New
 * York local, so nothing is re-zoned. All of that is settled in `mart_foreman_late`; this
 * page only counts and ranks.
 *
 * TWO COLUMNS, NOT ONE VERDICT. He asked for all lateness measured with more than an hour
 * highlighted, so the page never collapses them: a foreman five minutes past a window and a
 * foreman ninety minutes past it are both late, and pretending otherwise would hide the
 * difference that actually matters to a customer.
 *
 * A STRICT APPOINTMENT IS A HARDER JOB. Where the customer asked for an exact time the
 * calendar carries a zero-length window, and those jobs run late 59% of the time against 18%
 * for a real window. Nobody should be ranked against that without it being visible, so the
 * share of a foreman's work that was strict sits in his row.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.foreman_late) {
    RS.DATASETS.foreman_late = {
      table: "mart_foreman_late",
      // A PAYLOAD CONTRACT: projection is always on, so a column missing here is a column
      // the bridge never sends — it arrives undefined and renders as an em dash with no
      // error anywhere. The cache key is built from this list, so extending it also
      // invalidates every stale browser copy.
      cols: ["Job Code", "Request No", "Date", "Month", "Company", "Foreman", "Customer",
             "Job Type", "Arrival Source", "Window Start", "Deadline", "Arrived",
             "Late Minutes", "Is Late", "Over An Hour", "Strict Appointment",
             "Suspect Reschedule", "Calendar Link", "Contract URL"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("fla-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "fla-style";
    // Bar, fields, toggles, tiles, tables and pills are THE COMPONENT KIT in rs.css. Only
    // what the kit has no name for lives here.
    st.textContent = ""
      + ".fla{font-variant-numeric:tabular-nums}"
      // the rate bar: the eye ranks foremen before it reads a single number
      + ".fla-rate{position:relative;display:block;height:6px;border-radius:4px;"
      + "background:color-mix(in srgb,var(--ink) 7%,transparent);margin-top:5px;overflow:hidden}"
      + ".fla-rate i{display:block;height:100%;border-radius:4px;background:var(--warn)}"
      + ".fla-rate i.bad{background:var(--neg)}"
      // an expandable row reads as expandable
      + ".fla-x{cursor:pointer}"
      + ".fla-x .ch{display:inline-block;width:14px;color:var(--faint);font-weight:800;"
      + "transition:transform .12s}"
      + ".fla-x.on .ch{transform:rotate(90deg);color:var(--brand)}"
      // the month rows sit inside their foreman, the job rows inside their month
      + ".fla-m td{background:color-mix(in srgb,var(--ink) 3%,transparent)}"
      + ".fla-m td:first-child{padding-left:34px}"
      + ".fla-j td{background:color-mix(in srgb,var(--ink) 5%,transparent);font-size:12.8px}"
      + ".fla-j td:first-child{padding-left:52px}"
      + ".fla-lnk{color:var(--brand);font-weight:700;text-decoration:none;margin-right:10px}"
      + ".fla-lnk:hover{text-decoration:underline}";
    document.head.appendChild(st);
  }

  const MON3 = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  registerPage({
    id: "foreman-late",
    group: "logistics",
    title: "Late Arrivals",
    subtitle: "Did the crew arrive inside the window the customer was promised — by foreman, " +
              "by month, down to the job.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      // A repaint can outlive its page: the reader clicks away while the load is in flight,
      // and the late render would otherwise draw this page over whatever they opened.
      const mine = host;
      const alive = () => document.body.contains(mine);

      const S = window.__FLA || (window.__FLA = {
        from: null, to: null, co: "", fm: "", hideSuspect: true, openFm: null, openMo: null,
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading arrival times…</div>';

      RS.load("foreman_late").then(rows => {
        if (!alive()) return;
        rows = (rows || []).map(r => {
          r.Day = String(r.Date || "").slice(0, 10);
          r.late = +r["Late Minutes"] || 0;
          r.isLate = !!(+r["Is Late"]);
          r.over = !!(+r["Over An Hour"]);
          r.strict = !!(+r["Strict Appointment"]);
          r.suspect = !!(+r["Suspect Reschedule"]);
          return r;
        });
        if (!rows.length) {
          host.innerHTML = '<div class="panel">No arrival data yet — the mart may not be ' +
            "built (sources=curated).</div>";
          return;
        }

        const cos = {}, fms = {};
        rows.forEach(r => {
          if (r.Company) cos[r.Company] = 1;
          if (r.Foreman) fms[r.Foreman] = 1;
        });

        function passes(r) {
          if (S.co && r.Company !== S.co) return false;
          if (S.fm && r.Foreman !== S.fm) return false;
          if (S.from && (!r.Day || r.Day < S.from)) return false;
          if (S.to && (!r.Day || r.Day > S.to)) return false;
          // The suspect rows are excluded BY DEFAULT rather than deleted: nine jobs whose
          // start is hours past the deadline and whose end crosses midnight read as a job
          // moved without the calendar being updated, and a ranking of people led by stale
          // calendar entries would be wrong about them. The switch puts them back.
          if (S.hideSuspect && r.suspect) return false;
          return true;
        }

        const pct = (n, d) => (d ? Math.round(100 * n / d) : 0);
        const fmtMonth = m => {
          const p = String(m || "").split("-");
          return p.length === 2 ? MON3[+p[1]] + " " + p[0] : (m || "—");
        };

        function group(list, key) {
          const out = {};
          list.forEach(r => {
            const k = r[key] || "—";
            const g = out[k] || (out[k] = { key: k, n: 0, late: 0, over: 0, strict: 0, rows: [] });
            g.n++; g.late += r.isLate ? 1 : 0; g.over += r.over ? 1 : 0;
            g.strict += r.strict ? 1 : 0; g.rows.push(r);
          });
          return Object.values(out);
        }

        function sel(id, label, cur, values) {
          return '<label class="rs-fld"><span>' + label + '</span>'
            + '<select class="rs-sel" id="' + id + '"><option value="">All</option>'
            + Object.keys(values).sort().map(v =>
                '<option value="' + esc(v) + '"' + (cur === v ? " selected" : "") + ">"
                + esc(v) + "</option>").join("")
            + "</select></label>";
        }

        function jobRows(list) {
          return list.slice().sort((a, b) => b.late - a.late).map(r => {
            const links = (r["Calendar Link"]
                ? '<a class="fla-lnk" href="' + esc(r["Calendar Link"])
                  + '" target="_blank" rel="noopener">Calendar</a>' : "")
              + (r["Contract URL"]
                ? '<a class="fla-lnk" href="' + esc(r["Contract URL"])
                  + '" target="_blank" rel="noopener">Contract</a>' : "");
            return '<tr class="fla-j"><td class="nowrap">' + esc(r.Day) + "</td>"
              + '<td class="strong">' + esc(r["Job Code"] || "—") + "</td>"
              + "<td>" + esc(r.Customer || "—") + "</td>"
              + '<td class="nowrap muted">' + esc(r["Window Start"] || "—") + " – "
              + esc(r.Deadline || "—") + "</td>"
              + '<td class="nowrap">' + esc(r.Arrived || "—") + "</td>"
              + '<td class="num">' + (r.isLate
                  ? '<span class="rs-pill ' + (r.over ? "bad" : "warn") + '">+'
                    + r.late + " min</span>"
                  : '<span class="rs-pill ok">on time</span>') + "</td>"
              + "<td>" + (r.strict ? '<span class="rs-pill info">exact time</span>' : "")
                + (r.suspect ? ' <span class="rs-pill mute">looks rescheduled</span>' : "")
              + "</td>"
              + '<td class="nowrap">' + links + "</td></tr>";
          }).join("");
        }

        function paint() {
          if (!alive()) return;
          const v = rows.filter(passes);
          const nLate = v.filter(r => r.isLate).length;
          const nOver = v.filter(r => r.over).length;
          const nStrict = v.filter(r => r.strict).length;
          const hidden = rows.filter(r => r.suspect).length;

          const byFm = group(v, "Foreman").sort((a, b) =>
            (b.late / (b.n || 1)) - (a.late / (a.n || 1)) || b.n - a.n);

          let html = '<div class="fla">'
            + '<div class="rs-page-head"><h1>Late Arrivals</h1>'
            + "<p>The calendar event is the window the customer agreed to, so its <b>end is "
            + "the latest the crew may arrive</b>. Arrival is the digital contract's own "
            + "clock — the job's start, or the recorded arrival on a flat-rate job."
            + '<span class="freshness"> · local moves with a contract, from November 2025 · '
            + "both sides are New York time</span></p></div>"
            + '<div class="rs-kpis">'
            + kpi(v.length.toLocaleString(), "Jobs", "with a window and a recorded arrival", "")
            + kpi(nLate.toLocaleString(), "Arrived late", pct(nLate, v.length) + "% of jobs",
                  nLate ? "warn" : "pos")
            + kpi(nOver.toLocaleString(), "More than an hour late",
                  pct(nOver, v.length) + "% of jobs", nOver ? "neg" : "pos")
            + kpi(nStrict.toLocaleString(), "Exact-time appointments",
                  pct(nStrict, v.length) + "% of jobs — no window to spare", "")
            + "</div>"
            + '<div class="rs-bar">'
            + '<div class="rs-fld"><span>Job date</span><div id="flaDate"></div></div>'
            + sel("flaCo", "Company", S.co, cos)
            + sel("flaFm", "Foreman", S.fm, fms)
            + '<div class="rs-tog' + (S.hideSuspect ? " on" : "") + '" id="flaSus"><i></i>'
            + "Hide jobs that look rescheduled</div>"
            + '<span class="rs-spacer"></span>'
            + '<button class="rs-btn" id="flaCsv">Download CSV · ' + v.length + "</button>"
            + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">By foreman</div><span class="n">'
            + byFm.length + "</span></div>"
            + '<div class="rs-hint">Ranked by how often they were late. Click a foreman for '
            + "his months, and a month for the jobs themselves — each one links to its "
            + "calendar event and its digital contract. "
            + (S.hideSuspect && hidden
                ? "<b>" + hidden + "</b> job" + (hidden === 1 ? " is" : "s are") + " hidden: the "
                  + "recorded start is hours past the deadline and the job ended after "
                  + "midnight, which reads as a job moved without the calendar being updated "
                  + "rather than a crew arriving that late. Switch them back on above."
                : "")
            + "</div>";

          if (!v.length) {
            html += '<div class="rs-hint">Nothing matches these filters.</div></div></div>';
            host.innerHTML = html;
            wire();
            return;
          }

          html += '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
            + "<th>Foreman</th><th>Jobs</th><th>Late</th><th>Late %</th>"
            + "<th>&gt; 1 hour</th><th>&gt; 1 hour %</th><th>Exact-time jobs</th>"
            + "</tr></thead><tbody>";

          byFm.forEach(f => {
            const p = pct(f.late, f.n), po = pct(f.over, f.n);
            const open = S.openFm === f.key;
            html += '<tr class="fla-x' + (open ? " on" : "") + '" data-fm="' + esc(f.key) + '">'
              + '<td class="strong"><span class="ch">›</span> ' + esc(f.key) + "</td>"
              + '<td class="num">' + f.n + "</td>"
              + '<td class="num">' + f.late + "</td>"
              + '<td class="num">' + p + "%"
              + '<span class="fla-rate"><i class="' + (p >= 40 ? "bad" : "")
              + '" style="width:' + Math.min(100, p) + '%"></i></span></td>'
              + '<td class="num">' + f.over + "</td>"
              + '<td class="num">' + po + "%</td>"
              + '<td class="num muted">' + pct(f.strict, f.n) + "%</td></tr>";

            if (!open) return;
            group(f.rows, "Month").sort((a, b) => String(b.key).localeCompare(String(a.key)))
              .forEach(m => {
                const mp = pct(m.late, m.n);
                const mopen = S.openMo === f.key + "|" + m.key;
                html += '<tr class="fla-x fla-m' + (mopen ? " on" : "") + '" data-mo="'
                  + esc(f.key + "|" + m.key) + '">'
                  + '<td><span class="ch">›</span> ' + esc(fmtMonth(m.key)) + "</td>"
                  + '<td class="num">' + m.n + "</td>"
                  + '<td class="num">' + m.late + "</td>"
                  + '<td class="num">' + mp + "%</td>"
                  + '<td class="num">' + m.over + "</td>"
                  + '<td class="num">' + pct(m.over, m.n) + "%</td>"
                  + '<td class="num muted">' + pct(m.strict, m.n) + "%</td></tr>";
                if (mopen) {
                  html += '<tr class="fla-j"><td colspan="7" style="padding:0">'
                    + '<div class="rs-tablewrap" style="border:0;box-shadow:none;margin:0">'
                    + '<table class="rs-table"><thead><tr><th>Date</th><th>Job</th>'
                    + "<th>Customer</th><th>Window</th><th>Arrived</th><th>Late by</th>"
                    + "<th></th><th>Open</th></tr></thead><tbody>"
                    + jobRows(m.rows) + "</tbody></table></div></td></tr>";
                }
              });
          });

          html += "</tbody></table></div></div></div>";
          host.innerHTML = html;
          wire(v);
        }

        function kpi(val, lab, sub, cls) {
          return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
            + '</div><div class="v">' + esc(val) + '</div><div class="s">'
            + esc(sub) + "</div></div>";
        }

        function wire(v) {
          if (!alive()) return;
          const dh = host.querySelector("#flaDate");
          if (dh && window.RSC && RSC.dateRange) {
            RSC.dateRange(dh, {
              get: () => ({ from: S.from, to: S.to }),
              set: (f, t) => { S.from = f; S.to = t; },
              onChange: paint,
            });
          }
          const co = host.querySelector("#flaCo");
          if (co) co.onchange = function () { S.co = this.value; paint(); };
          const fm = host.querySelector("#flaFm");
          if (fm) fm.onchange = function () { S.fm = this.value; paint(); };
          const sus = host.querySelector("#flaSus");
          if (sus) sus.onclick = () => { S.hideSuspect = !S.hideSuspect; paint(); };
          host.querySelectorAll("[data-fm]").forEach(tr => {
            tr.onclick = () => {
              S.openFm = S.openFm === tr.dataset.fm ? null : tr.dataset.fm;
              S.openMo = null;
              paint();
            };
          });
          host.querySelectorAll("[data-mo]").forEach(tr => {
            tr.onclick = e => {
              e.stopPropagation();
              S.openMo = S.openMo === tr.dataset.mo ? null : tr.dataset.mo;
              paint();
            };
          });
          const csv = host.querySelector("#flaCsv");
          if (csv) csv.onclick = () => {
            const cols = ["Date", "Job Code", "Foreman", "Customer", "Company", "Job Type",
                          "Arrival Source", "Window Start", "Deadline", "Arrived",
                          "Late Minutes", "Is Late", "Over An Hour", "Strict Appointment",
                          "Suspect Reschedule", "Calendar Link", "Contract URL"];
            const cell = x => {
              let s = String(x == null ? "" : x);
              // a value opening as a live Excel formula is a real attack surface
              if (/^[=+\-@]/.test(s)) s = " " + s;
              return '"' + s.replace(/"/g, '""') + '"';
            };
            const lines = [cols.map(cell).join(",")].concat((v || []).map(r =>
              [r.Day, r["Job Code"], r.Foreman, r.Customer, r.Company, r["Job Type"],
               r["Arrival Source"], r["Window Start"], r.Deadline, r.Arrived,
               r.late, r.isLate ? "yes" : "no", r.over ? "yes" : "no",
               r.strict ? "yes" : "no", r.suspect ? "yes" : "no",
               r["Calendar Link"], r["Contract URL"]].map(cell).join(",")));
            // the BOM is for Excel: without it a Georgian name opens as mojibake
            const blob = new Blob(["﻿" + lines.join("\r\n")],
                                  { type: "text/csv;charset=utf-8" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "late-arrivals-" + new Date().toISOString().slice(0, 10) + ".csv";
            document.body.appendChild(a);
            a.click();
            setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
          };
        }

        paint();
      }).catch(e => {
        if (!alive()) return;
        host.innerHTML = '<div class="panel">Could not load the arrival data — '
          + esc(e && e.message || e) + "</div>";
      });
    },
  });
})();
