/* FOREMAN ASSESSMENT — the 30% a machine cannot see.
 *
 * Four things about a foreman can be counted: what packing he sold per 100 CF, how that
 * compared with the sales estimate, the reviews he earned, the complaints upheld against
 * him. They are 70% of Foreman of the Month and they arrive from the warehouse already
 * scored, through the range tables the office maintains.
 *
 * The other six cannot be counted — whether he loads a truck well, prepares properly for a
 * long-distance move, can run a two-truck job, takes assignments without argument, keeps a
 * crew together, follows the rules. Logistics scores those out of five stars at month end,
 * and this page is where that happens. Six questions × 5 points = the remaining 30%.
 *
 * TWO RULES THE PAGE ENFORCES IN ITS DESIGN.
 * Unanswered is not zero. A question nobody has rated shows as unrated and is left out of
 * the total, because scoring it 0 would say "we assessed him and he failed" about a
 * conversation that never happened.
 * The month closes. After the 5th, ratings are read-only — a score people are paid against
 * should stop moving. An admin can reopen a month, and that is recorded.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fa_scorecard) {
    RS.DATASETS.fa_scorecard = {
      table: "mart_forman_scorecard",
      cols: ["Foreman", "Month", "Month Year", "Total Jobs", "Total CF",
             "Total Packing Written", "Total Packing Estimate", "Total Reviews Written",
             "Forman Fault Claims", "Packing per 100 CF", "Packing per 100 CF Score",
             "Packing Difference %", "Packing Vs Estimate Score", "Reviews to Jobs Ratio",
             "Review Score", "Claim Score", "Auto Score", "Auto Weight Measured",
             "Manual Points", "Questions Answered", "Assessed By", "Assessed At",
             "Total Score", "Total Score Rank", "Forman Score"],
    };
  }
})();

registerPage({
  id: "foreman-assessment",
  title: "Foreman Assessment",
  subtitle: "The six things only a person can judge — scored monthly, on top of what the warehouse already counts.",
  datasets: [],

  render: function (host) {
    var RSC = window.RS_COMPONENTS || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };

    /* The six questions, verbatim from the logistics department's sheet. `k` is what the
     * database stores — renaming one orphans every rating that references it. */
    var QUESTIONS = [
      { k: "packing_loading", t: "Efficient Packing and Truck Loading",
        d: "Knows how to properly pack and load items into the truck, using less space without compromising the safety of the customer's belongings." },
      { k: "ld_preparation", t: "Preparation for Long-Distance Moves",
        d: "Understands the difference between local and long-distance moves. For long-distance moves, allows additional space in the truck when necessary to protect the items and ensure safe transportation." },
      { k: "big_jobs", t: "Large Jobs Requiring Two or More Trucks",
        d: "Can organize, manage, and supervise large jobs involving two or more trucks." },
      { k: "discipline", t: "Work Discipline and Attitude Toward Assignments",
        d: "Does not create problems simply because they do not like a particular job. Does not allow personal emotions to affect how they respond to information received from the sales representative, the customer, or the office." },
      { k: "team_management", t: "Team Management",
        d: "Has and consistently maintains a team of two or more crew members. Knows how to assign responsibilities, manage the crew, and maintain a professional working environment." },
      { k: "compliance", t: "Compliance with Company Rules",
        d: "Follows company policies, work standards, safety requirements, and internal procedures." },
    ];
    var PER_Q = 5;            // points a 5-star answer is worth
    var MANUAL_TOTAL = 30;    // 6 × 5

    // the four automatic topics, for the breakdown panel
    var AUTO = [
      { k: "Packing per 100 CF Score", w: 30, lab: "Packing per 100 CF",
        raw: "Packing per 100 CF", fmt: "usd" },
      { k: "Review Score", w: 20, lab: "Value to the company & reviews",
        raw: "Reviews to Jobs Ratio", fmt: "ratio" },
      { k: "Packing Vs Estimate Score", w: 10, lab: "Packing vs sales estimate",
        raw: "Packing Difference %", fmt: "x" },
      { k: "Claim Score", w: 10, lab: "Complaints & incidents",
        raw: "Forman Fault Claims", fmt: "int" },
    ];

    var S = window.__FA || (window.__FA = {
      month: "", sc: null, ratings: null, locked: false, canReopen: false,
      q: "", busy: "", msg: "", open: null,
    });

    var num = function (v) { return v == null || v === "" ? null : +v; };
    function monLab(m) {
      if (!m) return "—";
      var p = String(m).split("-");
      return ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"][+p[1] - 1] + " " + p[0];
    }
    function thisMonth() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    }
    if (!S.month) S.month = thisMonth();

    host.innerHTML = '<style id="faCss">'
      + ".fa{--t1:26px;--t2:15px;--t3:13.5px;--t4:12px;--t5:11px;--t6:9.5px;max-width:none;font-variant-numeric:tabular-nums}"
      + ".fa-bar{display:flex;flex-wrap:wrap;gap:9px;align-items:center;margin-bottom:14px}"
      + ".fa-bar select,.fa-bar input{background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:9px;padding:8px 11px;font-size:var(--t4);font-family:inherit}"
      + ".fa-bar input{min-width:190px}"
      + ".fa-lock{display:inline-flex;align-items:center;gap:8px;font-size:var(--t4);font-weight:700;padding:7px 12px;border-radius:9px}"
      + ".fa-lock.on{background:var(--warn-bg);color:var(--warn)}"
      + ".fa-lock.off{background:var(--pos-bg);color:var(--pos)}"
      + ".fa-btn{font:inherit;font-size:var(--t4);font-weight:700;padding:7px 13px;border-radius:9px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer}"
      + ".fa-btn:hover{border-color:var(--line-2)}"
      + ".fa-note{font-size:var(--t5);color:var(--faint);line-height:1.6;max-width:96ch;margin-bottom:16px}"
      + ".fa-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(165px,1fr));gap:12px;margin-bottom:16px}"
      + ".fa-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".fa-kpi b{display:block;font-size:var(--t1);letter-spacing:-.6px;line-height:1.1}"
      + ".fa-kpi span{display:block;font-size:var(--t6);font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".fa-kpi small{display:block;font-size:var(--t5);color:var(--muted);margin-top:3px}"
      // the roster of foremen
      + ".fa-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:11px;overflow:hidden}"
      + ".fa-head{display:flex;align-items:center;gap:12px;padding:13px 16px;cursor:pointer}"
      + ".fa-head:hover{background:var(--panel-2)}"
      + ".fa-nm{font-size:var(--t2);font-weight:750;letter-spacing:-.2px}"
      + ".fa-sub{font-size:var(--t5);color:var(--faint)}"
      + ".fa-tot{margin-left:auto;text-align:right;white-space:nowrap}"
      + ".fa-tot b{font-size:20px;letter-spacing:-.4px}"
      + ".fa-tot i{display:block;font-style:normal;font-size:var(--t6);color:var(--faint);text-transform:uppercase;letter-spacing:.06em;font-weight:800;margin-top:2px}"
      + ".fa-split{display:flex;gap:3px;height:7px;border-radius:4px;overflow:hidden;background:var(--panel-2);width:150px;margin-top:6px}"
      + ".fa-split u{display:block;height:100%}"
      + ".fa-split u.a{background:var(--blue)} .fa-split u.m{background:var(--pos)}"
      + ".fa-body{border-top:1px solid var(--line);padding:6px 16px 14px;display:none}"
      + ".fa-card.on .fa-body{display:block}"
      + ".fa-sec{font-size:var(--t6);font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin:14px 0 8px}"
      // question rows
      + ".fa-q{display:flex;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)}"
      + ".fa-q:last-child{border-bottom:0}"
      + ".fa-q .qt{flex:1;min-width:0}"
      + ".fa-q .qt b{font-size:var(--t3);font-weight:650;display:block}"
      + ".fa-q .qt span{font-size:var(--t5);color:var(--faint);line-height:1.5;display:block;margin-top:2px}"
      + ".fa-q .qt em{font-style:normal;font-size:var(--t6);color:var(--muted);display:block;margin-top:3px}"
      + ".fa-stars{display:flex;gap:2px;flex:none;align-items:center}"
      + ".fa-star{font-size:19px;line-height:1;cursor:pointer;background:none;border:0;padding:0 1px;color:var(--line-2)}"
      + ".fa-star.on{color:var(--warn)}"
      + ".fa-star:disabled{cursor:default;opacity:.75}"
      + ".fa-star:hover:not(:disabled){transform:scale(1.12)}"
      + ".fa-clr{font-size:var(--t6);color:var(--faint);background:none;border:0;cursor:pointer;margin-left:6px;text-decoration:underline}"
      + ".fa-pts{min-width:44px;text-align:right;font-size:var(--t4);font-weight:700}"
      + ".fa-pts.un{color:var(--faint);font-weight:500}"
      // the automatic breakdown
      + ".fa-auto{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}"
      + ".fa-a{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:9px 11px}"
      + ".fa-a .l{font-size:var(--t6);font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint)}"
      + ".fa-a .v{font-size:var(--t2);font-weight:700;margin-top:3px}"
      + ".fa-a .s{font-size:var(--t5);color:var(--muted);margin-top:1px}"
      + ".fa-a.na .v{color:var(--faint)}"
      + ".fa-empty{padding:30px;text-align:center;color:var(--faint);font-size:var(--t3);background:var(--panel);border:1px solid var(--line);border-radius:14px}"
      + ".fa-msg{font-size:var(--t4);padding:8px 12px;border-radius:9px;margin-bottom:12px;display:none}"
      + ".fa-msg.on{display:block;background:var(--pos-bg);color:var(--pos)}"
      + ".fa-msg.err{display:block;background:var(--neg-bg);color:var(--neg)}"
      + "</style><div class=\"fa\"><div id=\"faMain\"></div></div>";

    var main = host.querySelector("#faMain");
    main.innerHTML = '<div class="fa-empty">Loading the scorecard…</div>';

    function api(path, opts) {
      return fetch(ZTZ.API + path, Object.assign({
        headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                               (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
      }, opts || {})).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        });
      });
    }

    function load() {
      return Promise.all([
        S.sc ? Promise.resolve(S.sc) : RS.load("fa_scorecard"),
        api("/api/_fassess?month=" + encodeURIComponent(S.month)),
      ]).then(function (r) {
        S.sc = r[0];
        var j = r[1];
        S.locked = !!j.locked;
        S.canReopen = !!j.can_reopen;
        S.ratings = {};
        (j.ratings || []).forEach(function (x) {
          (S.ratings[x.Foreman] = S.ratings[x.Foreman] || {})[x.Question] = x;
        });
        paint();
      }).catch(function (e) {
        main.innerHTML = '<div class="fa-empty">Could not load — ' + esc(e.message) + "</div>";
      });
    }

    // one foreman's month: the automatic side from the mart, the manual side from ratings
    function rowFor(f) {
      var r = S.ratings[f.Foreman] || {};
      var answered = 0, manual = 0;
      QUESTIONS.forEach(function (q) {
        var v = r[q.k];
        if (v && v.Stars != null) { answered++; manual += (+v.Stars) / 5 * PER_Q; }
      });
      var auto = num(f["Auto Score"]);
      return { f: f, r: r, answered: answered, manual: manual,
               auto: auto, total: auto == null ? null : auto + manual };
    }

    function paint() {
      var mrows = (S.sc || []).filter(function (r) {
        return String(r.Month || "").slice(0, 7) === S.month;
      });
      var months = {};
      (S.sc || []).forEach(function (r) { months[String(r.Month || "").slice(0, 7)] = 1; });
      var mList = Object.keys(months).filter(Boolean).sort().reverse();
      if (mList.indexOf(thisMonth()) < 0) mList.unshift(thisMonth());

      var rows = mrows.map(rowFor);
      if (S.q) {
        var qq = S.q.toLowerCase();
        rows = rows.filter(function (x) { return x.f.Foreman.toLowerCase().indexOf(qq) >= 0; });
      }
      rows.sort(function (a, b) {
        if ((a.total == null) !== (b.total == null)) return a.total == null ? 1 : -1;
        return (b.total || 0) - (a.total || 0);
      });

      var done = rows.filter(function (x) { return x.answered === QUESTIONS.length; }).length;
      var part = rows.filter(function (x) { return x.answered > 0 && x.answered < QUESTIONS.length; }).length;
      var none = rows.filter(function (x) { return x.answered === 0; }).length;
      var top = rows.filter(function (x) { return x.total != null; })[0];

      var h = '<div class="fa-bar">'
        + '<select id="faMonth">' + mList.map(function (m) {
            return '<option value="' + m + '"' + (m === S.month ? " selected" : "") + ">"
              + monLab(m) + "</option>";
          }).join("") + "</select>"
        + '<span class="fa-lock ' + (S.locked ? "on" : "off") + '">'
        + (S.locked ? "✓ Closed — ratings are final" : "✎ Open for rating") + "</span>"
        + (S.canReopen ? '<button class="fa-btn" id="faLock">'
            + (S.locked ? "Reopen this month" : "Close this month") + "</button>" : "")
        + '<input id="faQ" placeholder="Find a foreman…" value="' + esc(S.q) + '">'
        + "</div>"
        + '<div class="fa-msg' + (S.msg ? (S.msgErr ? " err" : " on") : "") + '" id="faMsg">'
        + esc(S.msg || "") + "</div>";

      h += '<p class="fa-note"><b>How this works.</b> The warehouse already scores four topics — '
        + "packing per 100 CF (30), reviews (20), packing against the sales estimate (10) and "
        + "complaints upheld (10) — through the range tables the office maintains: <b>70 points</b>. "
        + "The six below are yours, five points each: <b>30 points</b>. A question you have not "
        + "answered is left out of the total and shown as unrated — it is never counted as zero, "
        + "because a zero would say the man was assessed and failed.</p>";

      h += '<div class="fa-kpis">'
        + kpi(String(rows.length), "Foremen this month", "with work recorded in " + monLab(S.month), "")
        + kpi(done + " / " + rows.length, "Fully assessed",
              part ? part + " partly · " + none + " not started" : (none ? none + " not started" : "all done"),
              done === rows.length && rows.length ? "pos" : "")
        + kpi(top ? top.f.Foreman.split(" ")[0] : "—", "Leading",
              top ? (top.total.toFixed(1) + " of 100 · " + top.auto.toFixed(1) + " auto + " + top.manual.toFixed(1) + " yours") : "no scores yet", "")
        + "</div>";

      h += rows.length ? rows.map(card).join("")
        : '<div class="fa-empty">No foreman has work recorded in ' + esc(monLab(S.month)) + ".</div>";

      main.innerHTML = h;
      wire(rows);
    }

    function kpi(v, lab, sub, cls) {
      return '<div class="fa-kpi ' + cls + '"><b>' + esc(v) + "</b><span>" + esc(lab)
        + "</span><small>" + esc(sub) + "</small></div>";
    }

    function card(x) {
      var f = x.f, open = S.open === f.Foreman;
      var pct = function (v) { return Math.max(0, Math.min(100, v)); };
      var h = '<div class="fa-card' + (open ? " on" : "") + '" data-f="' + esc(f.Foreman) + '">'
        + '<div class="fa-head"><div><div class="fa-nm">' + esc(f.Foreman) + "</div>"
        + '<div class="fa-sub">' + (num(f["Total Jobs"]) || 0) + " job"
        + ((num(f["Total Jobs"]) || 0) === 1 ? "" : "s")
        + (num(f["Total CF"]) ? " · " + Math.round(num(f["Total CF"])).toLocaleString() + " CF" : "")
        + " · " + (x.answered === QUESTIONS.length ? "assessed"
            : x.answered ? x.answered + " of " + QUESTIONS.length + " answered" : "not assessed yet")
        + "</div>"
        + '<div class="fa-split"><u class="a" style="width:' + pct((x.auto || 0)) + '%"></u>'
        + '<u class="m" style="width:' + pct(x.manual) + '%"></u></div></div>'
        + '<div class="fa-tot"><b>' + (x.total == null ? "—" : x.total.toFixed(1)) + "</b>"
        + "<i>" + (x.total == null ? "not measurable" : "of 100") + "</i></div></div>";

      h += '<div class="fa-body">';
      // the automatic half, so the rater sees what the numbers already said
      h += '<div class="fa-sec">Already counted · ' + (x.auto == null ? "—" : x.auto.toFixed(1))
        + " of 70" + (num(f["Auto Weight Measured"]) != null && num(f["Auto Weight Measured"]) < 70
            ? ' <span style="text-transform:none;letter-spacing:0;font-weight:500">— only '
              + num(f["Auto Weight Measured"]) + " points’ worth could be measured this month, so his score is scaled to what was measurable</span>" : "")
        + "</div>";
      h += '<div class="fa-auto">' + AUTO.map(function (a) {
          var sc = num(f[a.k]), rawv = num(f[a.raw]);
          var shown = sc == null ? "not measured" : (sc / 100 * a.w).toFixed(1) + " / " + a.w;
          var rawTxt = rawv == null ? "" :
            a.fmt === "usd" ? "$" + rawv.toFixed(2) + " per 100 CF"
            : a.fmt === "x" ? rawv.toFixed(2) + "× the estimate"
            : a.fmt === "ratio" ? (rawv * 100).toFixed(0) + "% of jobs earned one"
            : rawv + (rawv === 1 ? " claim upheld" : " claims upheld");
          return '<div class="fa-a' + (sc == null ? " na" : "") + '"><div class="l">' + esc(a.lab)
            + '</div><div class="v">' + esc(shown) + '</div><div class="s">' + esc(rawTxt) + "</div></div>";
        }).join("") + "</div>";

      h += '<div class="fa-sec">Your assessment · ' + x.manual.toFixed(1) + " of " + MANUAL_TOTAL
        + (S.locked ? " — this month is closed" : "") + "</div>";
      h += QUESTIONS.map(function (q) {
        var cur = x.r[q.k];
        var stars = cur && cur.Stars != null ? +cur.Stars : null;
        return '<div class="fa-q"><div class="qt"><b>' + esc(q.t) + "</b>"
          + "<span>" + esc(q.d) + "</span>"
          + (cur && cur["Entered By"] ? "<em>" + esc(String(cur["Entered By"]).split("@")[0])
              + " · " + esc(String(cur["Entered At"] || "").slice(0, 10)) + "</em>" : "")
          + "</div>"
          + '<div class="fa-stars">' + [1, 2, 3, 4, 5].map(function (n2) {
              return '<button class="fa-star' + (stars != null && n2 <= stars ? " on" : "") + '"'
                + ' data-f="' + esc(x.f.Foreman) + '" data-q="' + q.k + '" data-s="' + n2 + '"'
                + (S.locked ? " disabled" : "") + ' title="' + n2 + ' star' + (n2 === 1 ? "" : "s") + '">★</button>';
            }).join("")
          + (stars != null && !S.locked ? '<button class="fa-clr" data-f="' + esc(x.f.Foreman)
              + '" data-q="' + q.k + '">clear</button>' : "")
          + "</div>"
          + '<div class="fa-pts' + (stars == null ? " un" : "") + '">'
          + (stars == null ? "unrated" : (stars / 5 * PER_Q).toFixed(1)) + "</div></div>";
      }).join("");
      h += "</div></div>";
      return h;
    }

    function wire(rows) {
      var m = main.querySelector("#faMonth");
      if (m) m.onchange = function () { S.month = this.value; S.msg = ""; load(); };
      var q = main.querySelector("#faQ");
      if (q) q.oninput = function () {
        S.q = this.value;
        var at = this.selectionStart;
        paint();
        var nq = main.querySelector("#faQ");
        if (nq) { nq.focus(); nq.setSelectionRange(at, at); }
      };
      var lk = main.querySelector("#faLock");
      if (lk) lk.onclick = function () {
        var body = {};
        body[S.locked ? "unlock" : "lock"] = true;
        body.month = S.month;
        lk.disabled = true;
        api("/api/_fassess", { method: "POST", body: JSON.stringify(body) })
          .then(function () { S.msg = S.locked ? "Reopened " + monLab(S.month) : "Closed " + monLab(S.month); S.msgErr = false; load(); })
          .catch(function (e) { lk.disabled = false; S.msg = e.message; S.msgErr = true; paint(); });
      };
      main.querySelectorAll(".fa-head").forEach(function (hd) {
        hd.onclick = function () {
          var f = hd.parentElement.dataset.f;
          S.open = S.open === f ? null : f;
          paint();
        };
      });
      main.querySelectorAll(".fa-star:not(:disabled)").forEach(function (b) {
        b.onclick = function (e) { e.stopPropagation(); rate(b.dataset.f, b.dataset.q, +b.dataset.s); };
      });
      main.querySelectorAll(".fa-clr").forEach(function (b) {
        b.onclick = function (e) { e.stopPropagation(); rate(b.dataset.f, b.dataset.q, null); };
      });
    }

    function rate(foreman, question, stars) {
      // paint the new value immediately, then confirm — a star that waits for a round trip
      // feels broken when you are rating sixty of them
      var cur = (S.ratings[foreman] = S.ratings[foreman] || {});
      var before = cur[question];
      if (stars == null) delete cur[question];
      else cur[question] = { Foreman: foreman, Question: question, Stars: stars,
                             "Entered By": "you", "Entered At": new Date().toISOString().slice(0, 10) };
      paint();
      api("/api/_fassess", { method: "POST", body: JSON.stringify({
            month: S.month, foreman: foreman, question: question, stars: stars }) })
        .then(function () { S.msg = ""; })
        .catch(function (e) {
          // put it back exactly as it was: a rating that silently failed is worse than none
          if (before) cur[question] = before; else delete cur[question];
          S.msg = "Not saved — " + e.message;
          S.msgErr = true;
          paint();
        });
    }

    load();
  },
});
