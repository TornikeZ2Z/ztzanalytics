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
             "Suspect Reschedule", "Calendar Link", "Contract URL",
             // WHO CHAINED THIS JOB, AND WHOSE DEADLINE WE ARE GRADING AGAINST. Calendar
             // Cleanup can rewrite a chained job's arrival window, and that window IS the
             // deadline on this page -- so a crew can be "on time" because the board moved
             // the line. `Original Deadline` is what the customer had before we touched it.
             "Chained", "Chain Source", "Chained Behind", "Window Rewritten",
             "Originally Strict", "Original Deadline", "Late Minutes vs Original",
             "On Time Only After Rewrite",
             // THE SCORING BOUNDARY + THE CLAIM TRAIL (2026-08-27): only a morning window
             // can cost Foreman-of-the-Month points, and a claim on a late job is part of
             // its story — reasons shown, lateness-worded ones flagged.
             "Morning Window", "Claims N", "Claim Reasons", "Claim Cites Lateness"],
    };
  }
  // The Slack Confirm/Dismiss ledger — which latenesses actually count for Foreman of the
  // Month. Written ONLY by the Slack buttons on the daily digest; read-only here.
  if (window.RS && RS.DATASETS && !RS.DATASETS.late_adj) {
    RS.DATASETS.late_adj = {
      table: "late_adjudication",
      cols: ["Job Key", "Action", "Decided By", "Entered At", "Is Current"],
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
      // how wide the pivot needs before it starts scrolling sideways rather than squeezing
      + ".fla .rs-tablewrap{--rs-tmin:1080px}"
      // the rate bar: the eye ranks foremen before it reads a single number
      + ".fla-rate{position:relative;display:block;height:6px;border-radius:4px;"
      + "background:color-mix(in srgb,var(--ink) 10%,transparent);margin-top:5px;"
      + "overflow:hidden;min-width:54px}"
      + ".fla-rate i{display:block;height:100%;border-radius:4px;background:var(--warn)}"
      + ".fla-rate i.bad{background:var(--neg)}"
      // the window we replaced, sitting under the one being graded
      + ".fla-was{display:block;font-size:11px;color:var(--faint);text-decoration:line-through}"
      + ".fla-lnk{color:var(--blue);font-weight:700;text-decoration:none;margin-right:10px}"
      + ".fla-lnk:hover{text-decoration:underline}"
      // the answer form. It opens INSIDE the job list rather than in a dialog, because the
      // question it asks -- was this really our fault -- can only be answered while the
      // window, the arrival and the minutes late are still on screen next to it.
      + ".fla-form>td{background:var(--panel-2);padding:0 12px 14px}"
      + ".fla-fbox{border:1px solid var(--line-2);border-left:3px solid var(--brand);"
      + "border-radius:10px;background:var(--panel);padding:14px 16px;display:flex;"
      + "flex-direction:column;gap:11px}"
      + ".fla-fq{font-size:13px;font-weight:800;color:var(--ink)}"
      + ".fla-fq small{display:block;font-weight:500;color:var(--muted);margin-top:3px}"
      + ".fla-tx{width:100%;min-height:62px;resize:vertical;font-family:inherit;font-size:13px;"
      + "line-height:1.55;padding:10px 12px;border-radius:10px;border:1px solid var(--line-2);"
      + "background:var(--panel-2);color:var(--ink);outline:0}"
      + ".fla-tx:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}"
      + ".fla-fact{display:flex;gap:9px;align-items:center;flex-wrap:wrap}"
      + ".fla-vsel{min-width:330px;max-width:100%}"
      + ".fla-err{font-size:12.5px;font-weight:700;color:var(--neg)}"
      + ".fla-ok{font-size:12.5px;color:var(--muted)}"
      // the answer as it reads afterwards, in the row itself
      + ".fla-why{display:flex;flex-direction:column;align-items:flex-start;gap:2px;"
      + "min-width:0;max-width:100%;font:inherit;background:none;border:0;padding:0;"
      + "cursor:pointer;text-align:left}"
      + ".fla-why:hover em{color:var(--ink)}"
      + ".fla-why em{font-style:normal;font-size:11.5px;color:var(--muted);overflow:hidden;"
      + "text-overflow:ellipsis;white-space:nowrap;max-width:230px}"
      + ".fla-ask{font:inherit;font-size:12px;font-weight:700;color:var(--blue);background:none;"
      + "border:0;padding:0;cursor:pointer;text-align:left}"
      + ".fla-ask:hover{text-decoration:underline}";
    document.head.appendChild(st);
  }

  const MON3 = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  /* THE FOUR ANSWERS. His ask, 2026-08-24: "user will be able to say if it was really a
     problem or it was lets say caused by customer, they asked us to arrive later".

     Only `ours` is the crew's own doing -- that is the whole point of splitting them, and it
     is what lets the page offer a late rate that counts only what somebody there could have
     controlled. The list is closed and mirrored in bridge/app.py (LATE_VERDICTS): a verdict
     drives a count, so a free-text one would silently invent a fifth bucket. */
  const VERDICTS = [
    ["customer", "The customer moved it", "bad",
     "They asked us to come later, or were not ready for us"],
    ["outside", "Outside our control", "warn",
     "Traffic, weather, the job before overran, no access to the building"],
    ["ours", "On us", "bad", "The crew or dispatch, and nothing else"],
    ["window", "The window is wrong", "mute",
     "The calendar never matched what was actually agreed with the customer"],
  ];
  const VMAP = {};
  VERDICTS.forEach(v => { VMAP[v[0]] = { label: v[1], hint: v[3] }; });
  // how each verdict READS in a row. `ours` is the only one that stays red -- the others are
  // answers, not accusations, so they must not go on looking like unresolved problems.
  const VPILL = { customer: "info", outside: "info", ours: "bad", window: "mute" };

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
        // the answers, keyed by "<Job Code>|<date>", and the form that is open over them
        reviews: {}, openJob: null, draft: {}, msg: "", msgErr: false, msgFor: null,
        // OFF by default. Turning it on removes excused jobs from the LATE count only --
        // never from the job count, because the job still happened.
        blameOnly: false,
      });

      injectStyle();
      host.innerHTML = '<div class="panel">Loading arrival times…</div>';

      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(r => r.json().then(j => {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        }));
      }

      const jobKey = r => String(r["Job Code"] || "") + "|" + String(r.Day || "");

      // TWO SOURCES, and the answers are the live one. The mart carries no verdict at all --
      // it is rebuilt with CREATE TABLE ... AS on every run, so anything written onto it
      // would be gone within the hour. If the answers fail to load we say so out loud rather
      // than rendering an empty set: showing every job as unexplained would quietly send
      // somebody to re-answer thirty jobs they had already done.
      let reviewError = null;
      Promise.all([
        RS.load("foreman_late"),
        api("/api/_latereview").catch(e => {
          reviewError = e.message || String(e);
          return { reviews: [] };
        }),
        // the Slack ledger arriving empty is a real state (nothing decided yet), and a
        // failed fetch must not sink the page — the pills just show "awaiting review"
        RS.load("late_adj").catch(() => []),
      ]).then(([rows, rev, adj]) => {
        S.reviews = {};
        (rev.reviews || []).forEach(x => { S.reviews[x["Job Key"]] = x; });
        S.adj = {};
        (adj || []).forEach(x => {
          if (+x["Is Current"]) S.adj[x["Job Key"]] = x;
        });
        return rows;
      }).then(rows => {
        if (!alive()) return;
        rows = (rows || []).map(r => {
          r.Day = String(r.Date || "").slice(0, 10);
          r.late = +r["Late Minutes"] || 0;
          r.isLate = !!(+r["Is Late"]);
          r.over = !!(+r["Over An Hour"]);
          r.strict = !!(+r["Strict Appointment"]);
          r.suspect = !!(+r["Suspect Reschedule"]);
          r.chained = !!(+r.Chained);
          r.byBoard = String(r["Chain Source"] || "") === "Board";
          r.rewritten = !!(+r["Window Rewritten"]);
          r.wasStrict = !!(+r["Originally Strict"]);
          r.rescued = !!(+r["On Time Only After Rewrite"]);
          r.origLate = r["Late Minutes vs Original"] == null
            ? null : +r["Late Minutes vs Original"];
          r.morning = !!(+r["Morning Window"]);
          r.claimsN = +r["Claims N"] || 0;
          r.claimWhy = r["Claim Reasons"] || "";
          r.claimLate = !!(+r["Claim Cites Lateness"]);
          r.key = jobKey(r);
          decorate(r);
          return r;
        });
        if (!rows.length) {
          host.innerHTML = '<div class="panel">No arrival data yet — the mart may not be ' +
            "built (sources=curated).</div>";
          return;
        }

        // The verdict does not live on the row, it lives on the answer -- so everything
        // that reads r.verdict has to be refreshed when an answer changes. One function,
        // called on load and again after every save, so a row has one way to learn its own
        // answer and there is nowhere for the two to drift apart.
        function decorate(r) {
          const v = S.reviews[r.key];
          r.verdict = v ? v.Verdict : null;
          r.why = v ? v.Explanation : null;
          r.whoSaid = v ? String(v["Entered By"] || "").split("@")[0] : null;
          r.whenSaid = v ? String(v["Entered At"] || "").slice(0, 10) : null;
          r.answered = !!v;
          // EXCUSED IS NOT THE SAME AS ANSWERED. A job answered "on us" is answered and still
          // entirely the crew's fault; it has to keep counting, or this feature becomes a way
          // to make a bad number go away by writing a sentence under it.
          r.excused = !!v && v.Verdict !== "ours";
          // THE SLACK DECISION is separate from the explanation above: Confirm/Dismiss in
          // the daily digest channel is what Foreman of the Month reads, and only a
          // CONFIRMED morning-window lateness costs points.
          const a = (S.adj || {})[r.key];
          r.adj = a ? String(a.Action || "") : null;
          r.adjBy = a ? String(a["Decided By"] || "") : null;
          r.counts = r.isLate && r.morning && r.adj === "confirmed";
          return r;
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
            const g = out[k] || (out[k] = { key: k, n: 0, late: 0, over: 0, strict: 0,
                                            answered: 0, excused: 0, rows: [] });
            g.n++; g.late += r.isLate ? 1 : 0; g.over += r.over ? 1 : 0;
            g.strict += r.strict ? 1 : 0;
            // only LATE jobs count as answered or excused -- a note on an on-time job would
            // otherwise inflate the explained figure with nothing that needed explaining
            if (r.isLate && r.answered) g.answered++;
            if (r.isLate && r.excused) g.excused++;
            g.rows.push(r);
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

        function jobTable(list) {
          return '<div class="rs-sub-card"><table class="rs-table"><thead><tr>'
            + "<th>Date</th><th>Job</th><th>Customer</th><th>Window</th><th>Arrived</th>"
            + '<th class="num">Late by</th><th></th><th>Why</th><th>Open</th>'
            + "</tr></thead><tbody>" + jobRows(list) + "</tbody></table></div>";
        }

        /* THE ANSWER, as the row reads once it has been given: the verdict, the sentence
           behind it and who said so. An unanswered late job gets the ask instead; an on-time
           job gets nothing at all, because there is nothing to explain. */
        function whyCell(r) {
          if (r.answered) {
            const v = VMAP[r.verdict] || { label: r.verdict || "—" };
            // A BUTTON, not a label. An answer has to be reachable again: people change
            // their minds, and the withdrawal lives inside the form this reopens.
            return '<button class="fla-why" data-explain="' + esc(r.key)
              + '" title="Change or withdraw this answer"><span class="rs-pill '
              + (VPILL[r.verdict] || "mute") + '">' + esc(v.label) + "</span>"
              + '<em title="' + esc(r.why || "") + '">' + esc(r.why || "")
              + (r.whoSaid ? " — " + esc(r.whoSaid) : "") + "</em></button>";
          }
          if (!r.isLate) return "";
          return '<button class="fla-ask" data-explain="' + esc(r.key) + '">Why?</button>';
        }

        /* The form is rebuilt from S on every rows repaint, so an open form survives one --
           which is exactly why the draft lives in S.draft and not only in the textarea. */
        function formRow(r) {
          const d = S.draft[r.key] != null ? S.draft[r.key] : (r.why || "");
          const cur = S.draft[r.key + "|v"] != null ? S.draft[r.key + "|v"] : (r.verdict || "");
          return '<tr class="fla-form"><td colspan="9"><div class="fla-fbox">'
            + '<div class="fla-fq">Why was this one late?'
            + "<small>The job keeps its minutes either way — this decides whether they count "
            + "against the crew.</small></div>"
            + '<div class="fla-fact">'
            + '<select class="rs-sel fla-vsel" data-vd="' + esc(r.key) + '">'
            + '<option value="">Pick what happened…</option>'
            + VERDICTS.map(v => '<option value="' + v[0] + '"'
                + (cur === v[0] ? " selected" : "") + ">" + esc(v[1]) + " — "
                + esc(v[3]) + "</option>").join("")
            + "</select></div>"
            + '<textarea class="fla-tx" data-ex="' + esc(r.key) + '" '
            + 'placeholder="What actually happened? One sentence is enough.">'
            + esc(d) + "</textarea>"
            + '<div class="fla-fact">'
            + '<button class="rs-btn pri" data-save="' + esc(r.key) + '">Save</button>'
            + '<button class="rs-btn" data-cancel="1">Cancel</button>'
            + (r.answered
                ? '<span class="rs-spacer"></span><button class="rs-btn" data-withdraw="'
                  + esc(r.key) + '">Withdraw this answer</button>'
                : "")
            + (S.msgFor === r.key
                ? '<span class="' + (S.msgErr ? "fla-err" : "fla-ok") + '">' + esc(S.msg)
                  + "</span>"
                : "")
            + (r.answered && r.whenSaid
                ? '<span class="fla-ok">answered ' + esc(r.whenSaid)
                  + (r.whoSaid ? " by " + esc(r.whoSaid) : "") + "</span>"
                : "")
            + "</div></div></td></tr>";
        }

        function jobRows(list) {
          return list.slice().sort((a, b) => b.late - a.late).map(r => {
            const links = (r["Calendar Link"]
                ? '<a class="fla-lnk" href="' + esc(r["Calendar Link"])
                  + '" target="_blank" rel="noopener">Calendar</a>' : "")
              + (r["Contract URL"]
                ? '<a class="fla-lnk" href="' + esc(r["Contract URL"])
                  + '" target="_blank" rel="noopener">Contract</a>' : "");
            return "<tr><td class=\"nowrap\">" + esc(r.Day) + "</td>"
              + '<td class="strong">' + esc(r["Job Code"] || "—") + "</td>"
              + "<td>" + esc(r.Customer || "—") + "</td>"
              + '<td class="nowrap muted">' + esc(r["Window Start"] || "—") + " – "
              + esc(r.Deadline || "—")
              // THE PROMISE WE REPLACED, under the one we grade against. Only ever shown
              // where the two differ, so an untouched job reads exactly as it always did.
              + (r.rewritten && r["Original Deadline"]
                  ? '<span class="fla-was">was – ' + esc(r["Original Deadline"])
                    + "</span>" : "")
              + "</td>"
              + '<td class="nowrap">' + esc(r.Arrived || "—") + "</td>"
              + '<td class="num nowrap">' + (r.isLate
                  ? '<span class="rs-pill ' + (r.over ? "bad" : "warn") + '">+'
                    + r.late + " min</span>"
                  : '<span class="rs-pill ok">on time</span>') + "</td>"
              + "<td>" + (r.strict ? '<span class="rs-pill info">exact time</span>' : "")
                + (!r.strict && r.wasStrict
                    ? ' <span class="rs-pill info">was an exact time</span>' : "")
                + (r.chained
                    ? ' <span class="rs-pill mute">chained' + (r.byBoard ? " by the board" : "")
                      + (r["Chained Behind"] ? " · " + esc(r["Chained Behind"]) : "")
                      + "</span>" : "")
                /* THE ONE A READER MUST NOT MISS. On time against the window this system
                   wrote, late against the one the customer agreed. Loud on purpose: it is
                   the only row shape where the number above it flatters us. */
                + (r.rescued
                    ? ' <span class="rs-pill bad">on time only after we moved the window'
                      + (r.origLate != null ? " · +" + r.origLate + " min against it" : "")
                      + "</span>"
                    : (r.rewritten
                        ? ' <span class="rs-pill warn">window rewritten by the board</span>'
                        : ""))
                + (r.suspect ? ' <span class="rs-pill mute">looks rescheduled</span>' : "")
                /* WHAT THE MONTH WILL READ. Confirmed = counts in Foreman of the Month;
                   dismissed = our side caused it; a late MORNING job nobody has pressed a
                   button on yet is awaiting the Slack digest; an afternoon window never
                   costs points at all (his rule, 2026-08-27). */
                + (r.isLate
                    ? (r.adj === "confirmed"
                        ? ' <span class="rs-pill bad">counts for FotM'
                          + (r.adjBy ? " · " + esc(r.adjBy) : "") + "</span>"
                        : r.adj === "dismissed"
                          ? ' <span class="rs-pill mute">dismissed — our side'
                            + (r.adjBy ? " · " + esc(r.adjBy) : "") + "</span>"
                          : r.morning
                            ? ' <span class="rs-pill info">awaiting Slack review</span>'
                            : ' <span class="rs-pill mute">afternoon — stats only</span>')
                    : "")
                + (r.claimsN
                    ? ' <span class="rs-pill ' + (r.claimLate ? "bad" : "warn") + '" title="'
                      + esc(r.claimWhy) + '">' + r.claimsN + " claim"
                      + (r.claimsN === 1 ? "" : "s")
                      + (r.claimLate ? " · cites lateness" : "") + "</span>"
                    : "")
              + "</td>"
              + "<td>" + whyCell(r) + "</td>"
              + '<td class="nowrap">' + links + "</td></tr>"
              + (S.openJob === r.key ? formRow(r) : "");
          }).join("");
        }

        // what paint() last drew, so repaintRows() can redraw the same view without
        // recomputing it and without touching anything above the table
        let last = null;

        function paint() {
          if (!alive()) return;
          const v = rows.filter(passes);
          const lateRows = v.filter(r => r.isLate);
          const nLate = lateRows.length;
          const nOver = v.filter(r => r.over).length;
          const nStrict = v.filter(r => r.strict).length;
          const hidden = rows.filter(r => r.suspect).length;
          const nAnswered = lateRows.filter(r => r.answered).length;
          const nExcused = lateRows.filter(r => r.excused).length;
          // WHAT THE CREW IS ACTUALLY ANSWERABLE FOR. Every late job still happened and still
          // counts in `nLate`; this is the same set minus the ones somebody has looked at and
          // said were not the crew's doing. It only ever appears when the reader asks for it.
          const nBlame = nLate - nExcused;

          const byFm = group(v, "Foreman").sort((a, b) =>
            (b.late / (b.n || 1)) - (a.late / (a.n || 1)) || b.n - a.n);
          last = { v: v, byFm: byFm };

          let html = '<div class="fla">'
            + '<div class="rs-page-head"><h1>Late Arrivals</h1>'
            + "<p>The calendar event is the window the customer agreed to, so its <b>end is "
            + "the latest the crew may arrive</b>. Arrival is the digital contract's own "
            + "clock — the job's start, or the recorded arrival on a flat-rate job."
            + '<span class="freshness"> · local moves with a contract, from November 2025 · '
            + "both sides are New York time</span></p></div>"
            // FIVE, said out loud: the kit's grid defaults to four, so the fifth tile
            // dropped onto a row of its own and read as a separate, more important thing.
            + '<div class="rs-kpis" style="--kpi-cols:5">'
            + kpi(v.length.toLocaleString(), "Jobs", "with a window and a recorded arrival", "")
            + kpi((S.blameOnly ? nBlame : nLate).toLocaleString(),
                  S.blameOnly ? "Late, and ours" : "Arrived late",
                  pct(S.blameOnly ? nBlame : nLate, v.length) + "% of jobs"
                    + (S.blameOnly ? " — " + nExcused.toLocaleString() + " excused" : ""),
                  (S.blameOnly ? nBlame : nLate) ? "warn" : "pos")
            + kpi(nOver.toLocaleString(), "More than an hour late",
                  pct(nOver, v.length) + "% of jobs", nOver ? "neg" : "pos")
            + kpi(nStrict.toLocaleString(), "Exact-time appointments",
                  pct(nStrict, v.length) + "% of jobs — no window to spare", "")
            + kpi(nAnswered.toLocaleString() + " / " + nLate.toLocaleString(), "Explained",
                  nLate ? (nExcused.toLocaleString() + " were not the crew's doing")
                        : "nothing to explain", "")
            + "</div>"
            + '<div class="rs-bar">'
            + '<div class="rs-fld"><span>Job date</span><div id="flaDate"></div></div>'
            + sel("flaCo", "Company", S.co, cos)
            + sel("flaFm", "Foreman", S.fm, fms)
            + '<div class="rs-tog' + (S.hideSuspect ? " on" : "") + '" id="flaSus"><i></i>'
            + "Hide jobs that look rescheduled</div>"
            + '<div class="rs-tog' + (S.blameOnly ? " on" : "") + '" id="flaBlame"><i></i>'
            + "Count only what was the crew's fault</div>"
            + '<span class="rs-spacer"></span>'
            + '<button class="rs-btn" id="flaCsv">Download CSV · ' + v.length + "</button>"
            + "</div>"
            + '<div class="panel"><div class="panel-head">'
            + '<div class="panel-title">By foreman</div><span class="n">'
            + byFm.length + "</span></div>"
            + '<div class="rs-hint">Ranked by how often they were late. Click a foreman for '
            + "his months, and a month for the jobs themselves — each one links to its "
            + "calendar event and its digital contract, and each late one can be answered "
            + '<b>Why?</b> — the customer moved it, something outside anyone\'s control, or '
            + "the crew. "
            + (reviewError
                ? '<span class="em">The answers could not be loaded (' + esc(reviewError)
                  + ") — every job below is showing as unanswered, so do not re-answer them "
                  + "until this clears.</span> "
                : "")
            + (S.blameOnly
                ? "<b>Late % counts only what was the crew's fault</b> — " + nExcused
                  + " answered job" + (nExcused === 1 ? "" : "s")
                  + " are not counted. The job total is unchanged. "
                : "")
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

          html += '<div class="rs-tablewrap rs-fit" id="flaScroll">'
            + '<table class="rs-table rs-fixed rs-even">'
            + '<colgroup><col style="width:24%"><col style="width:8%"><col style="width:8%">'
            + '<col style="width:14%"><col style="width:10%"><col style="width:11%">'
            + '<col style="width:13%"><col style="width:12%"></colgroup>'
            + "<thead><tr>"
            + "<th>Foreman</th><th class=\"num\">Jobs</th><th class=\"num\">Late</th>"
            + "<th class=\"num\">Late %</th><th class=\"num\">&gt; 1 hour</th>"
            + "<th class=\"num\">&gt; 1 hour %</th><th class=\"num\">Explained</th>"
            + "<th class=\"num\">Exact-time jobs</th>"
            + '</tr></thead><tbody id="flaBody">' + bodyHtml(byFm)
            + "</tbody></table></div></div></div>";
          host.innerHTML = html;
          wire(v);
        }

        /* THE ROWS ARE THEIR OWN WRITE.
           Opening a foreman changes nothing above the table: not the tiles, not the filters,
           not the hint, not even the other foremen. Rewriting the page for it replayed the
           kit's entrance animation (rs.css `rsfade`, which starts at opacity:0) on every
           single click -- "for a split second it hides and shows everything", his words,
           2026-08-24 -- and threw the scroll position away with it, so a click on a foreman
           near the bottom bounced the reader back to the top.

           So a disclosure writes ONE tbody. The scroller, the header and the wired handlers
           are all the same elements afterwards, which is why the click delegation in wire()
           sits on the tbody and not on the rows. */
        function bodyHtml(byFm) {
          let out = "";
          byFm.forEach(f => {
            // the LATE figure the reader asked for: raw, or net of what somebody has said
            // was not the crew's doing. The job count never changes either way.
            const fl = S.blameOnly ? (f.late - f.excused) : f.late;
            const p = pct(fl, f.n), po = pct(f.over, f.n);
            const open = S.openFm === f.key;
            out += '<tr class="rs-group' + (open ? " on" : "") + '" data-fm="'
              + esc(f.key) + '">'
              + '<td class="strong"><span class="rs-caret">&rsaquo;</span> ' + esc(f.key) + "</td>"
              + '<td class="num">' + f.n + "</td>"
              + '<td class="num">' + fl + "</td>"
              + '<td class="num">' + p + "%"
              + '<span class="fla-rate"><i class="' + (p >= 40 ? "bad" : "")
              + '" style="width:' + Math.min(100, p) + '%"></i></span></td>'
              + '<td class="num">' + f.over + "</td>"
              + '<td class="num">' + po + "%</td>"
              + '<td class="num' + (f.answered ? "" : " dim") + '">'
                + (f.late ? f.answered + " / " + f.late : "—") + "</td>"
              + '<td class="num muted">' + pct(f.strict, f.n) + "%</td></tr>";

            if (!open) return;
            group(f.rows, "Month").sort((a, b) => String(b.key).localeCompare(String(a.key)))
              .forEach(m => {
                const ml = S.blameOnly ? (m.late - m.excused) : m.late;
                const mp = pct(ml, m.n);
                const mopen = S.openMo === f.key + "|" + m.key;
                out += '<tr class="rs-group2' + (mopen ? " on" : "") + '" data-mo="'
                  + esc(f.key + "|" + m.key) + '">'
                  + '<td><span class="rs-caret">&rsaquo;</span> ' + esc(fmtMonth(m.key)) + "</td>"
                  + '<td class="num">' + m.n + "</td>"
                  + '<td class="num">' + ml + "</td>"
                  + '<td class="num">' + mp + "%</td>"
                  + '<td class="num">' + m.over + "</td>"
                  + '<td class="num">' + pct(m.over, m.n) + "%</td>"
                  + '<td class="num' + (m.answered ? "" : " dim") + '">'
                    + (m.late ? m.answered + " / " + m.late : "—") + "</td>"
                  + '<td class="num muted">' + pct(m.strict, m.n) + "%</td></tr>";
                if (mopen) {
                  out += '<tr class="rs-sub"><td colspan="8">' + jobTable(m.rows) + "</td></tr>";
                }
              });
          });
          return out;
        }

        /* A SAVE CHANGES NUMBERS ABOVE THE TABLE -- the tiles and every foreman's Explained
           column -- so unlike a disclosure it needs the whole page. The scroll offset is
           carried across by hand, because somebody who has just answered a job forty rows
           down should still be looking at it afterwards. */
        function repaintAll() {
          const before = host.querySelector("#flaScroll");
          const top = before ? before.scrollTop : 0;
          paint();
          const after = host.querySelector("#flaScroll");
          if (after) after.scrollTop = top;
        }

        function rowFor(k) { return (rows || []).filter(r => r.key === k)[0]; }

        function saveAnswer(key, btn) {
          // read the controls, not the draft: the draft is the fallback for a form that was
          // rebuilt underneath the reader, not the source of truth while it is on screen
          const box = host.querySelector('[data-ex="' + CSS.escape(key) + '"]');
          const vsel = host.querySelector('[data-vd="' + CSS.escape(key) + '"]');
          const ex = String(box ? box.value : (S.draft[key] || "")).trim();
          const vd = String(vsel ? vsel.value : (S.draft[key + "|v"] || ""));
          S.draft[key] = ex;
          S.draft[key + "|v"] = vd;

          const complain = m => {
            S.msg = m; S.msgErr = true; S.msgFor = key;
            repaintRows();
          };
          if (!vd) return complain("Pick what happened first.");
          if (!ex) return complain("Say what happened — a verdict on its own explains nothing.");

          if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
          api("/api/_latereview", { method: "POST", body: JSON.stringify({
                job_key: key, verdict: vd, explanation: ex }) })
            .then(j => {
              // patch what we hold rather than re-pulling the mart: the answer is ours, and
              // the mart has nothing to say about it in the first place
              S.reviews[key] = { "Job Key": key, Verdict: vd, Explanation: ex,
                                 "Entered By": j.by || "you",
                                 "Entered At": new Date().toISOString().slice(0, 19).replace("T", " ") };
              const r = rowFor(key);
              if (r) decorate(r);
              delete S.draft[key];
              delete S.draft[key + "|v"];
              S.openJob = null;
              S.msg = ""; S.msgErr = false; S.msgFor = null;
              repaintAll();
            })
            .catch(e => {
              if (btn) { btn.disabled = false; btn.textContent = "Save"; }
              complain("Not saved — " + (e.message || e));
            });
        }

        function withdraw(key, btn) {
          if (btn) { btn.disabled = true; btn.textContent = "…"; }
          api("/api/_latereview", { method: "POST",
                                    body: JSON.stringify({ job_key: key, reopen: true }) })
            .then(() => {
              delete S.reviews[key];
              const r = rowFor(key);
              if (r) decorate(r);
              delete S.draft[key];
              delete S.draft[key + "|v"];
              S.openJob = null;
              S.msg = ""; S.msgErr = false; S.msgFor = null;
              repaintAll();
            })
            .catch(e => {
              if (btn) { btn.disabled = false; btn.textContent = "Withdraw this answer"; }
              S.msg = "Not withdrawn — " + (e.message || e);
              S.msgErr = true; S.msgFor = key;
              repaintRows();
            });
        }

        function repaintRows() {
          if (!alive() || !last) return;
          const tb = host.querySelector("#flaBody");
          // no tbody means the empty-state is on screen, and that IS a full repaint
          if (!tb) { paint(); return; }
          tb.innerHTML = bodyHtml(last.byFm);
        }

        function kpi(val, lab, sub, cls) {
          return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab)
            + '</div><div class="v">' + esc(val) + '</div><div class="s">'
            + esc(sub) + "</div></div>";
        }

        function wire(v) {
          if (!alive()) return;
          // A sticky header only sticks against a SCROLLING ANCESTOR. rs-fit gives the wrap
          // a viewport-sized max-height, and fitScroller measures the chrome actually above
          // it so a collapsed filter bar leaves no dead gap. It must run after EVERY repaint:
          // the table is rebuilt wholesale, so the previous element is gone.
          const sc = host.querySelector("#flaScroll");
          if (sc && window.RSC && RSC.fitScroller) RSC.fitScroller(sc);
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
          const bl = host.querySelector("#flaBlame");
          if (bl) bl.onclick = () => { S.blameOnly = !S.blameOnly; repaintAll(); };
          // DELEGATED, on the tbody: the rows are replaced on every disclosure, so a handler
          // bound to a row would be thrown away with it. The tbody survives, so this is bound
          // once per full paint and keeps working for every rows-only write after it.
          const tb = host.querySelector("#flaBody");
          // the answer form lives inside the job list, so its controls arrive at the same
          // delegate as the disclosures -- and must be taken FIRST, or a click on Save would
          // fall through and be read as a click on the month that contains it
          if (tb) tb.oninput = e => {
            const t = e.target.closest("[data-ex]");
            if (t) S.draft[t.dataset.ex] = t.value;
          };
          if (tb) tb.onchange = e => {
            const v = e.target.closest("[data-vd]");
            if (v) S.draft[v.dataset.vd + "|v"] = v.value;
          };
          if (tb) tb.onclick = e => {
            if (e.target.closest("a")) return;      // a link opens a job; it does not toggle

            const ask = e.target.closest("[data-explain]");
            if (ask) {
              S.openJob = S.openJob === ask.dataset.explain ? null : ask.dataset.explain;
              S.msg = ""; S.msgFor = null;
              repaintRows();
              return;
            }
            const save = e.target.closest("[data-save]");
            if (save) { saveAnswer(save.dataset.save, save); return; }
            if (e.target.closest("[data-cancel]")) {
              S.openJob = null; S.msg = ""; S.msgFor = null;
              repaintRows();
              return;
            }
            const wd = e.target.closest("[data-withdraw]");
            if (wd) { withdraw(wd.dataset.withdraw, wd); return; }
            // a click anywhere else inside an open form must not toggle the month under it
            if (e.target.closest(".fla-form")) return;

            const mo = e.target.closest("[data-mo]");
            if (mo) {
              S.openMo = S.openMo === mo.dataset.mo ? null : mo.dataset.mo;
              repaintRows();
              return;
            }
            const fm = e.target.closest("[data-fm]");
            if (fm) {
              S.openFm = S.openFm === fm.dataset.fm ? null : fm.dataset.fm;
              S.openMo = null;
              repaintRows();
            }
          };
          const csv = host.querySelector("#flaCsv");
          if (csv) csv.onclick = () => {
            const cols = ["Date", "Job Code", "Foreman", "Customer", "Company", "Job Type",
                          "Arrival Source", "Window Start", "Deadline", "Arrived",
                          "Late Minutes", "Is Late", "Over An Hour", "Strict Appointment",
                          "Suspect Reschedule", "Chained", "Chain Source", "Chained Behind",
                          "Window Rewritten", "Original Deadline", "Late Minutes vs Original",
                          "On Time Only After Rewrite",
                          "Verdict", "Explanation", "Answered By",
                          "Answered At", "Calendar Link", "Contract URL"];
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
               r.chained ? "yes" : "no", r["Chain Source"] || "", r["Chained Behind"] || "",
               r.rewritten ? "yes" : "no", r["Original Deadline"] || "",
               r.origLate == null ? "" : r.origLate, r.rescued ? "yes" : "no",
               r.verdict ? ((VMAP[r.verdict] || {}).label || r.verdict) : "",
               r.why || "", r.whoSaid || "", r.whenSaid || "",
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
