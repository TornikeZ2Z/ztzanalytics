/* FOREMAN ASSESSMENT — the 30% a machine cannot see.
 *
 * Four things about a foreman can be counted: what packing he sold per 100 CF, how that
 * compared with the sales estimate, the reviews he earned, the complaints upheld against
 * him. They are 70% of Foreman of the Month and they arrive from the warehouse already
 * scored, through the range tables the office maintains.
 *
 * The other six cannot be counted — whether he loads a truck well, prepares properly for a
 * long-distance move, can run a two-truck job, takes assignments without argument, keeps a
 * crew together, follows the rules. Logistics scores those out of five stars, and this page
 * is where that happens. Six questions × 5 points = the remaining 30%.
 *
 * THE RULES THE PAGE ENFORCES IN ITS DESIGN (Tornike, 2026-08-05).
 * A month OPENS on its own 20th — before the 20th of August, August is not in the picker.
 * Nothing date-based ever closes it: the logistics team closes a month themselves with
 * SUBMIT, which stamps who signed it off. Only an admin can reopen a submitted month,
 * because reopening rewrites a published score. The model starts at January 2026.
 * Unanswered is not zero: a question nobody rated is left out of the total and shown as
 * unrated, because a zero would say "we assessed him and he failed".
 * The month's calendar is New Jersey's — the yard's clock, not the viewer's.
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
             "Total Score", "Total Score Rank", "Qualified",
             "Not Qualified Because", "Forman Score"],
    };
  }
})();

registerPage({
  id: "foreman-assessment",
  title: "Foreman Assessment",
  subtitle: "The six things only a person can judge — scored monthly, on top of what the warehouse already counts.",
  datasets: [],

  render: function (host) {
    const RSC = window.RS_COMPONENTS || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const num = v => (v == null || v === "" || isNaN(v)) ? null : +v;
    const fmtN = v => (+v || 0).toLocaleString();
    const fmt1 = v => (Math.round(+v * 10) / 10).toFixed(1);

    /* The six questions, verbatim from the logistics department's sheet. `k` is what the
     * database stores — renaming one orphans every rating that references it. */
    const QUESTIONS = [
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
    const NQ = QUESTIONS.length, MANUAL_TOTAL = 30;

    // the four counted topics, for the "already counted" strip inside each card
    const AUTO = [
      { k: "Packing per 100 CF Score", w: 30, lab: "Packing per 100 CF",
        raw: "Packing per 100 CF", fmt: "usd" },
      { k: "Review Score", w: 20, lab: "Reviews earned",
        raw: "Reviews to Jobs Ratio", fmt: "ratio" },
      { k: "Packing Vs Estimate Score", w: 10, lab: "Packing vs estimate",
        raw: "Packing Difference %", fmt: "x" },
      { k: "Claim Score", w: 10, lab: "Complaints upheld",
        raw: "Forman Fault Claims", fmt: "int" },
    ];
    const MIN_MONTH = "2026-01", OPEN_DAY = 20;
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                    "August", "September", "October", "November", "December"];

    const S = window.__FA2 || (window.__FA2 = {
      month: "", sc: null, ratings: null, locked: false, subBy: null, subAt: null,
      canReopen: false, q: "", tab: "all", open: null, msg: "", msgErr: false,
    });

    // The yard's calendar, not the viewer's: Tbilisi reaches the 20th eight hours before
    // New Jersey does, and the bridge gates writes on New Jersey time — so the picker must
    // open months on the same clock or the first hours of a month would 400 on every star.
    const njToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const monLab = m => m ? MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : "—";

    function openMonths() {
      const nj = njToday(), curYm = nj.slice(0, 7), day = +nj.slice(8, 10);
      const seen = {};
      (S.sc || []).forEach(r => { const m = String(r.Month || "").slice(0, 7); if (m) seen[m] = 1; });
      return Object.keys(seen)
        .filter(m => m >= MIN_MONTH && (m < curYm || (m === curYm && day >= OPEN_DAY)))
        .sort().reverse();
    }

    host.innerHTML = '<style id="fa2Css">'
      + ".fa2{max-width:1240px;font-variant-numeric:tabular-nums}"
      // ---- hero ------------------------------------------------------------------------
      // NOT overflow:hidden — the month list hangs out of the hero, and clipping it left
      // the dropdown showing exactly one row. The progress bar rounds its own corners.
      + ".fa2-hero{background:var(--panel);border:1px solid var(--line);border-radius:16px;margin-bottom:14px;box-shadow:var(--shadow);position:relative}"
      + ".fa2-hrow{display:flex;flex-wrap:wrap;gap:14px 30px;align-items:center;padding:18px 22px}"
      + ".fa2-eyebrow{font-size:9.5px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin-bottom:2px}"
      // the month picker: a native <select> popup cannot be styled, so the trigger is the
      // month title itself and the list is ours — each month carrying its open/submitted state
      + ".fa2-mon{position:relative;display:inline-block}"
      + ".fa2-monbtn{display:flex;align-items:center;gap:10px;background:transparent;border:0;color:var(--ink);font-family:inherit;font-size:25px;font-weight:800;letter-spacing:-.6px;padding:0;cursor:pointer;font-variant-numeric:tabular-nums}"
      + ".fa2-monbtn .car{font-size:11px;color:var(--faint);transition:transform .16s ease;margin-top:5px}"
      + ".fa2-monbtn:hover .car{color:var(--muted)}"
      + ".fa2-monbtn.open .car{transform:rotate(180deg)}"
      + ".fa2-mlist{position:absolute;top:calc(100% + 10px);left:-10px;min-width:252px;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 20px 44px rgba(0,0,0,.22),var(--shadow);padding:6px;z-index:44;display:none}"
      + ".fa2-mlist.open{display:block;animation:fa2in .14s ease}"
      + ".fa2-mopt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font-family:inherit;font-size:14px;font-weight:650;color:var(--ink);background:none;border:0;border-radius:9px;padding:9px 12px;cursor:pointer;font-variant-numeric:tabular-nums}"
      + ".fa2-mopt:hover{background:var(--panel-2)}"
      + ".fa2-mopt.cur{background:var(--brand-glow);color:var(--brand-d);font-weight:800}"
      + "body.rs-app:not(.light) .fa2-mopt.cur{color:var(--brand)}"
      + ".fa2-mopt .tag{margin-left:auto;font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}"
      + ".fa2-mopt .tag.sub{color:var(--blue)} .fa2-mopt .tag.op{color:var(--pos)}"
      + ".fa2-pill{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:800;padding:5px 11px;border-radius:999px;margin-top:5px}"
      + ".fa2-pill.open{background:var(--pos-bg);color:var(--pos)}"
      + ".fa2-pill.sub{background:var(--blue-bg);color:var(--blue)}"
      + ".fa2-stats{display:flex;flex-wrap:wrap;margin-left:auto}"
      + ".fa2-st{padding:2px 24px;border-left:1px solid var(--line)}"
      + ".fa2-st b{display:block;font-size:21px;font-weight:750;letter-spacing:-.4px;line-height:1.15;white-space:nowrap}"
      + ".fa2-st span{font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-st small{display:block;font-size:10.5px;color:var(--muted);margin-top:1px;white-space:nowrap}"
      + ".fa2-prog{height:5px;background:var(--panel-2);border-radius:0 0 15px 15px;overflow:hidden}"
      + ".fa2-prog i{display:block;height:100%;background:var(--blue);transition:width .4s ease}"
      // ---- toolbar ---------------------------------------------------------------------
      + ".fa2-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}"
      + ".fa2-chip{font-family:inherit;font-size:12px;font-weight:700;padding:7px 13px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer}"
      + ".fa2-chip:hover{border-color:var(--line-2)}"
      + ".fa2-chip.on{background:var(--brand-glow);border-color:transparent;color:var(--brand-d)}"
      + "body.rs-app:not(.light) .fa2-chip.on{color:var(--brand)}"
      + ".fa2-bar input{margin-left:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;color:var(--ink);font-family:inherit;font-size:12.5px;min-width:220px}"
      + ".fa2-how{font-size:11.5px;color:var(--faint);line-height:1.65;max-width:112ch;margin:0 0 14px}"
      + ".fa2-how summary{cursor:pointer;font-weight:700;color:var(--muted);font-size:12px;user-select:none}"
      + ".fa2-how[open] summary{margin-bottom:5px}"
      + ".fa2-msg{font-size:12.5px;padding:9px 13px;border-radius:10px;margin-bottom:12px;display:none}"
      + ".fa2-msg.on{display:block;background:var(--pos-bg);color:var(--pos)}"
      + ".fa2-msg.err{display:block;background:var(--neg-bg);color:var(--neg)}"
      // ---- submitted banner ------------------------------------------------------------
      + ".fa2-done{background:var(--blue-bg);border-radius:14px;padding:13px 18px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;color:var(--blue);font-size:13px;font-weight:750}"
      + ".fa2-done small{color:var(--muted);font-weight:500;font-size:12px}"
      + ".fa2-ghost{font-family:inherit;font-size:12px;font-weight:700;padding:8px 14px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);cursor:pointer;margin-left:auto}"
      + ".fa2-ghost:hover{border-color:var(--faint);color:var(--ink)}"
      // ---- cards -----------------------------------------------------------------------
      + ".fa2-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:9px;overflow:hidden;transition:border-color .15s,box-shadow .15s}"
      + ".fa2-card.on{border-color:var(--line-2);box-shadow:var(--shadow)}"
      + ".fa2-head{display:grid;grid-template-columns:34px minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:12px 18px;cursor:pointer}"
      + ".fa2-head:hover{background:var(--panel-2)}"
      + ".fa2-rk{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:12.5px;font-weight:800;background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}"
      + ".fa2-rk.top{background:var(--brand);color:var(--brand-ink);border-color:transparent}"
      + ".fa2-rk.oor{background:transparent;color:var(--faint);border-style:dashed}"
      + ".fa2-nm{font-size:15.5px;font-weight:750;letter-spacing:-.2px}"
      + ".fa2-si{font-size:11px;color:var(--faint);margin-top:1px}"
      + ".fa2-si .oor{color:var(--warn);font-weight:650}"
      + ".fa2-dots{display:flex;gap:4px}"
      + ".fa2-dots i{width:7px;height:7px;border-radius:50%;background:var(--panel-2);border:1px solid var(--line-2)}"
      + ".fa2-dots i.on{background:var(--blue);border-color:transparent}"
      + ".fa2-sc{display:flex;align-items:center;gap:13px}"
      + ".fa2-sb{width:132px;height:7px;border-radius:5px;background:var(--panel-2);overflow:hidden;display:flex}"
      + ".fa2-sb u{display:block;height:100%}"
      + ".fa2-sb u.a{background:var(--brand)} .fa2-sb u.m{background:var(--blue)}"
      + ".fa2-tot{text-align:right;min-width:62px}"
      + ".fa2-tot b{font-size:19px;font-weight:800;letter-spacing:-.4px}"
      + ".fa2-tot i{display:block;font-style:normal;font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:1px}"
      + ".fa2-body{display:none;border-top:1px solid var(--line);padding:14px 18px 16px}"
      + ".fa2-card.on .fa2-body{display:block;animation:fa2in .16s ease}"
      + "@keyframes fa2in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}"
      + ".fa2-sec{font-size:9.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:4px 0 9px}"
      + ".fa2-sec b{color:var(--ink);font-size:12px;letter-spacing:0}"
      + ".fa2-sec .rescale{text-transform:none;letter-spacing:0;font-weight:500;color:var(--muted)}"
      + ".fa2-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(205px,1fr));gap:9px;margin-bottom:15px}"
      + ".fa2-tile{background:var(--panel-2);border:1px solid var(--line);border-radius:11px;padding:10px 13px}"
      + ".fa2-tile .l{font-size:9px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-tile .v{font-size:16px;font-weight:750;margin-top:3px}"
      + ".fa2-tile .v small{font-size:11px;color:var(--faint);font-weight:600}"
      + ".fa2-tile .r{font-size:11px;color:var(--muted);margin-top:1px}"
      + ".fa2-tile .tb{height:4px;border-radius:3px;background:var(--line);overflow:hidden;margin-top:8px}"
      + ".fa2-tile .tb i{display:block;height:100%;background:var(--brand)}"
      + ".fa2-tile.na{border-style:dashed} .fa2-tile.na .v{color:var(--faint);font-size:13px;font-weight:600}"
      // ---- questions -------------------------------------------------------------------
      + ".fa2-q{display:grid;grid-template-columns:minmax(0,1fr) auto 50px;gap:22px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line);max-width:1100px}"
      + ".fa2-q:last-of-type{border-bottom:0}"
      + ".fa2-q .qt b{font-size:13.5px;font-weight:700;display:block}"
      + ".fa2-q .qt span{font-size:11px;color:var(--faint);line-height:1.55;display:block;margin-top:2px;max-width:80ch}"
      + ".fa2-q .qt em{font-style:normal;font-size:9.5px;color:var(--muted);display:block;margin-top:3px}"
      + ".fa2-stars{display:flex;gap:1px;align-items:center}"
      + ".fa2-star{font-size:23px;line-height:1;cursor:pointer;background:none;border:0;padding:0 2px;color:var(--line-2);transition:transform .07s}"
      + ".fa2-star.on,.fa2-star.pv{color:var(--warn)}"
      + ".fa2-star:disabled{cursor:default;opacity:.7}"
      + ".fa2-star:hover:not(:disabled){transform:scale(1.2)}"
      + ".fa2-clr{font-size:9.5px;color:var(--faint);background:none;border:0;cursor:pointer;margin-left:7px;text-decoration:underline;font-family:inherit}"
      + ".fa2-pts{text-align:right;font-size:13px;font-weight:800}"
      + ".fa2-pts.un{color:var(--faint);font-weight:500;font-size:10.5px}"
      // ---- submit bar ------------------------------------------------------------------
      + ".fa2-sub{position:sticky;bottom:14px;margin-top:18px;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;box-shadow:var(--shadow);padding:13px 18px;display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;z-index:6}"
      + ".fa2-sub .t{font-size:12.5px;color:var(--muted)} .fa2-sub .t b{color:var(--ink);font-size:13.5px}"
      + ".fa2-spb{flex:1;min-width:150px;height:6px;border-radius:4px;background:var(--panel-2);overflow:hidden}"
      + ".fa2-spb i{display:block;height:100%;background:var(--blue);transition:width .3s}"
      + ".fa2-go{font-family:inherit;font-size:13px;font-weight:800;padding:10px 20px;border-radius:11px;border:0;background:var(--brand);color:var(--brand-ink);cursor:pointer}"
      + ".fa2-go:hover{background:var(--brand-d)} .fa2-go:disabled{opacity:.6;cursor:default}"
      + ".fa2-empty{padding:38px;text-align:center;color:var(--faint);font-size:13.5px;background:var(--panel);border:1px dashed var(--line-2);border-radius:14px}"
      + "@media(max-width:820px){.fa2-q{grid-template-columns:1fr;gap:8px}.fa2-pts{text-align:left}.fa2-stats{margin-left:0}.fa2-st{padding-left:0;padding-right:24px;border-left:0}.fa2-sc{gap:9px}.fa2-sb{width:80px}}"
      + '</style><div class="fa2"><div id="fa2Main"></div></div>';

    const main = host.querySelector("#fa2Main");
    main.innerHTML = '<div class="fa2-empty">Loading the scorecard…</div>';

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
      // ALWAYS through RS.load — it is epoch-keyed, so a pipeline rebuild reaches this
      // page on the next visit. Caching rows on window state kept yesterday's scorecard
      // alive for as long as the tab lived.
      return RS.load("fa_scorecard").then(sc => {
        S.sc = sc;
        const months = openMonths();
        if (!months.length) { S.month = ""; paint(); return null; }
        if (months.indexOf(S.month) < 0) S.month = months[0];
        return api("/api/_fassess?month=" + encodeURIComponent(S.month)).then(j => {
          S.locked = !!j.locked;
          S.subBy = j.submitted_by || null;
          S.subAt = j.submitted_at || null;
          S.canReopen = !!j.can_reopen;
          // the whole lock table rides along on every GET — the month list uses it to tag
          // each month open / submitted without a request per month
          S.locks = {};
          (j.locks || []).forEach(l => {
            if (+l.Locked === 1) S.locks[String(l.Month || "").slice(0, 7)] = 1;
          });
          S.ratings = {};
          (j.ratings || []).forEach(x => {
            (S.ratings[x.Foreman] = S.ratings[x.Foreman] || {})[x.Question] = x;
          });
          paint();
        });
      }).catch(e => {
        main.innerHTML = '<div class="fa2-empty">Could not load — ' + esc(e.message) + "</div>";
      });
    }

    // one foreman's month: the counted side from the mart, the assessed side live
    function rowFor(f) {
      const r = (S.ratings || {})[f.Foreman] || {};
      let answered = 0, manual = 0;
      QUESTIONS.forEach(q => {
        const v = r[q.k];
        if (v && v.Stars != null) { answered++; manual += +v.Stars; }
      });
      const auto = num(f["Auto Score"]);
      return { f, r, answered, manual, auto,
               total: auto == null ? null : auto + manual,
               ok: +f["Qualified"] === 1, why: f["Not Qualified Because"] || "" };
    }

    const stat = (b, lab, sub) => '<div class="fa2-st"><span>' + esc(lab) + "</span><b>" + b
      + "</b><small>" + esc(sub) + "</small></div>";
    const chip = (id, lab) => '<button class="fa2-chip' + (S.tab === id ? " on" : "")
      + '" data-tab="' + id + '">' + lab + "</button>";

    function paint() {
      const months = openMonths();
      if (!months.length) {
        main.innerHTML = '<div class="fa2-empty">The assessment starts with January 2026 — '
          + "a month opens for rating on its own " + OPEN_DAY + "th.</div>";
        return;
      }

      const all = (S.sc || [])
        .filter(r => String(r.Month || "").slice(0, 7) === S.month)
        .map(rowFor)
        .sort((a, b) => (a.ok === b.ok ? 0 : a.ok ? -1 : 1)
          || ((b.total != null ? b.total : -1) - (a.total != null ? a.total : -1))
          || (num(b.f["Total Jobs"]) || 0) - (num(a.f["Total Jobs"]) || 0));
      let rk = 0;
      all.forEach(x => { x.rank = x.ok ? ++rk : null; });

      const done = all.filter(x => x.answered === NQ).length;
      const part = all.filter(x => x.answered > 0 && x.answered < NQ).length;
      const todo = all.length - done - part;
      const leader = all.filter(x => x.ok && x.total != null)[0];
      const nQual = all.filter(x => x.ok).length;

      let rows = all;
      if (S.tab === "todo") rows = rows.filter(x => x.answered === 0);
      else if (S.tab === "part") rows = rows.filter(x => x.answered > 0 && x.answered < NQ);
      else if (S.tab === "done") rows = rows.filter(x => x.answered === NQ);
      if (S.q) {
        const qq = S.q.toLowerCase();
        rows = rows.filter(x => x.f.Foreman.toLowerCase().indexOf(qq) >= 0);
      }

      let h = '<div class="fa2-hero"><div class="fa2-hrow">'
        + '<div><div class="fa2-eyebrow">Foreman assessment</div>'
        + '<div class="fa2-mon"><button class="fa2-monbtn" id="fa2MonBtn" type="button">'
        + esc(monLab(S.month)) + ' <span class="car">▼</span></button>'
        + '<div class="fa2-mlist" id="fa2MList">'
        + months.map(m => '<button class="fa2-mopt' + (m === S.month ? " cur" : "")
            + '" type="button" data-m="' + m + '">' + monLab(m)
            + '<span class="tag ' + ((S.locks || {})[m] ? "sub" : "op") + '">'
            + ((S.locks || {})[m] ? "✓ submitted" : "open") + "</span></button>").join("")
        + "</div></div>"
        + '<div><span class="fa2-pill ' + (S.locked ? "sub" : "open") + '">'
        + (S.locked ? "✓ Submitted — ratings are final" : "● Open for rating") + "</span></div></div>"
        + '<div class="fa2-stats">'
        + stat(fmtN(all.length), "Foremen", "with work in " + monLab(S.month))
        + stat(done + " / " + all.length, "Fully assessed",
               (part || todo) ? (part + " partly · " + todo + " not started") : "all done")
        + stat(leader ? esc(leader.f.Foreman.split(" ")[0]) : "—", "Leading",
               leader ? fmt1(leader.total) + " of 100" : "nobody qualifies yet")
        + stat(nQual + " / " + all.length, "In the running", "5+ jobs · half measurable")
        + "</div></div>"
        + '<div class="fa2-prog"><i style="width:' + (all.length ? (done / all.length * 100).toFixed(0) : 0) + '%"></i></div></div>';

      h += '<details class="fa2-how"><summary>How the scoring works · who can win</summary>'
        + "The warehouse already scores four topics — packing per 100 CF (30), reviews (20), "
        + "packing against the sales estimate (10) and complaints upheld (10) — through the "
        + "range tables the office maintains: <b>70 points</b>. The six questions below are "
        + "yours, five points each: <b>30 points</b>. A question you have not answered is left "
        + "out of the total and shown as unrated — it is never counted as zero, because a zero "
        + "would say the man was assessed and failed. <b>Who can win:</b> a foreman is ranked "
        + "only once the month has said enough about him — at least five jobs run, and at least "
        + "half the counted score measurable. Everyone else keeps their score and is still "
        + "worth rating; they are simply out of the running. A month opens for rating on its "
        + "own " + OPEN_DAY + "th and closes when you submit it below.</details>";

      h += '<div class="fa2-msg' + (S.msg ? (S.msgErr ? " err" : " on") : "") + '">' + esc(S.msg || "") + "</div>";

      if (S.locked) {
        h += '<div class="fa2-done">✓ ' + esc(monLab(S.month)) + " is submitted — ratings are final"
          + (S.subBy ? " <small>by " + esc(String(S.subBy).split("@")[0])
              + (S.subAt ? " · " + esc(String(S.subAt).slice(0, 16)) : "") + "</small>" : "")
          + (S.canReopen ? '<button class="fa2-ghost" id="fa2Reopen">Reopen this month</button>' : "")
          + "</div>";
      }

      h += '<div class="fa2-bar">'
        + chip("all", "All " + all.length) + chip("todo", "Not started " + todo)
        + chip("part", "In progress " + part) + chip("done", "Done " + done)
        + '<input id="fa2Q" placeholder="Find a foreman…" value="' + esc(S.q) + '">'
        + "</div>";

      h += rows.length ? rows.map(card).join("")
        : '<div class="fa2-empty">No foreman matches here.</div>';

      if (!S.locked && all.length) {
        h += '<div class="fa2-sub"><span class="t"><b>' + done + " of " + all.length
          + "</b> fully assessed" + (done < all.length ? "" : " — ready to sign off") + "</span>"
          + '<span class="fa2-spb"><i style="width:' + (done / all.length * 100).toFixed(0) + '%"></i></span>'
          + '<button class="fa2-go" id="fa2Submit">Submit ' + esc(monLab(S.month)) + "</button></div>";
      }

      main.innerHTML = h;
      wire();
    }

    function card(x) {
      const f = x.f, open = S.open === f.Foreman;
      const jobs = num(f["Total Jobs"]) || 0, cf = num(f["Total CF"]);
      const measured = num(f["Auto Weight Measured"]);

      let h = '<div class="fa2-card' + (open ? " on" : "") + '" data-f="' + esc(f.Foreman) + '">'
        + '<div class="fa2-head">'
        + '<div class="fa2-rk' + (x.ok ? (x.rank === 1 ? " top" : "") : " oor") + '"'
        + (x.ok ? "" : ' title="' + esc(x.why) + '"') + ">" + (x.ok ? x.rank : "–") + "</div>"
        + '<div><div class="fa2-nm">' + esc(f.Foreman) + "</div>"
        + '<div class="fa2-si">' + fmtN(jobs) + " job" + (jobs === 1 ? "" : "s")
        + (cf ? " · " + fmtN(Math.round(cf)) + " CF" : "")
        + " · " + (x.answered === NQ ? "assessed ✓"
            : x.answered ? x.answered + " of " + NQ + " rated" : "not rated yet")
        + (x.ok ? "" : ' · <span class="oor">' + esc(x.why) + "</span>")
        + "</div></div>"
        + '<div class="fa2-dots">' + QUESTIONS.map(q =>
            "<i" + ((x.r[q.k] && x.r[q.k].Stars != null) ? ' class="on"' : "") + "></i>").join("") + "</div>"
        + '<div class="fa2-sc"><span class="fa2-sb">'
        + '<u class="a" style="width:' + (x.auto == null ? 0 : x.auto.toFixed(0)) + '%"></u>'
        + '<u class="m" style="width:' + x.manual.toFixed(0) + '%"></u></span>'
        + '<span class="fa2-tot"><b>' + (x.total == null ? "—" : fmt1(x.total)) + "</b>"
        + "<i>" + (x.total == null ? "not measurable" : x.ok ? "of 100" : "not ranked") + "</i></span></div>"
        + "</div>";

      h += '<div class="fa2-body">';
      h += '<div class="fa2-sec">Already counted · <b>' + (x.auto == null ? "—" : fmt1(x.auto))
        + " / 70</b>" + (measured != null && measured < 70
            ? ' <span class="rescale">— only ' + measured + " of the 70 points could be measured, so his score is rescaled to what was measurable</span>" : "")
        + "</div>";
      h += '<div class="fa2-tiles">' + AUTO.map(a => {
          const sc = num(f[a.k]), rawv = num(f[a.raw]);
          const rawTxt = rawv == null ? "" :
            a.fmt === "usd" ? "$" + rawv.toFixed(2) + " per 100 CF"
            : a.fmt === "x" ? rawv.toFixed(2) + "× the estimate"
            : a.fmt === "ratio" ? (rawv * 100).toFixed(0) + "% of jobs earned one"
            : rawv + (rawv === 1 ? " claim upheld" : " claims upheld");
          return '<div class="fa2-tile' + (sc == null ? " na" : "") + '"><div class="l">' + esc(a.lab)
            + '</div><div class="v">' + (sc == null ? "not measured"
                : fmt1(sc / 100 * a.w) + " <small>/ " + a.w + "</small>")
            + '</div><div class="r">' + esc(rawTxt) + "</div>"
            + '<div class="tb"><i style="width:' + (sc == null ? 0 : sc.toFixed(0)) + '%"></i></div></div>';
        }).join("") + "</div>";

      h += '<div class="fa2-sec">Your assessment · <b>' + fmt1(x.manual) + " / " + MANUAL_TOTAL + "</b>"
        + (S.locked ? ' <span class="rescale">— submitted, final</span>' : "") + "</div>";
      h += QUESTIONS.map(q => {
        const cur = x.r[q.k];
        const stars = cur && cur.Stars != null ? +cur.Stars : null;
        return '<div class="fa2-q"><div class="qt"><b>' + esc(q.t) + "</b>"
          + "<span>" + esc(q.d) + "</span>"
          + (cur && cur["Entered By"] ? "<em>" + esc(String(cur["Entered By"]).split("@")[0])
              + " · " + esc(String(cur["Entered At"] || "").slice(0, 10)) + "</em>" : "")
          + "</div>"
          + '<div class="fa2-stars">' + [1, 2, 3, 4, 5].map(n2 =>
              '<button class="fa2-star' + (stars != null && n2 <= stars ? " on" : "") + '"'
              + ' data-f="' + esc(f.Foreman) + '" data-q="' + q.k + '" data-s="' + n2 + '"'
              + ' data-m="' + S.month + '"'
              + (S.locked ? " disabled" : "") + ' title="' + n2 + " star" + (n2 === 1 ? "" : "s") + '">★</button>').join("")
          + (stars != null && !S.locked ? '<button class="fa2-clr" data-f="' + esc(f.Foreman)
              + '" data-q="' + q.k + '" data-m="' + S.month + '">clear</button>' : "")
          + "</div>"
          + '<div class="fa2-pts' + (stars == null ? " un" : "") + '">'
          + (stars == null ? "unrated" : fmt1(stars)) + "</div></div>";
      }).join("");
      h += "</div></div>";
      return h;
    }

    function wire() {
      const mb = main.querySelector("#fa2MonBtn"), ml = main.querySelector("#fa2MList");
      if (mb && ml) {
        mb.onclick = e => {
          e.stopPropagation();
          const open = ml.classList.toggle("open");
          mb.classList.toggle("open", open);
          if (open) {
            // close on any click outside the list, or on Escape — the handlers remove
            // themselves so repaints can't stack them up
            const off = ev => {
              if (ev.type === "keydown" && ev.key !== "Escape") return;
              if (ev.type === "click" && ml.contains(ev.target)) return;
              ml.classList.remove("open"); mb.classList.remove("open");
              document.removeEventListener("click", off);
              document.removeEventListener("keydown", off);
            };
            setTimeout(() => {
              document.addEventListener("click", off);
              document.addEventListener("keydown", off);
            }, 0);
          }
        };
        ml.querySelectorAll(".fa2-mopt").forEach(o => {
          o.onclick = () => {
            ml.classList.remove("open"); mb.classList.remove("open");
            if (o.dataset.m === S.month) return;
            S.month = o.dataset.m; S.msg = ""; S.open = null;
            // clear the board BEFORE the async load: a star clicked on the old month's
            // cards during the swap would otherwise write into the newly selected month
            main.innerHTML = '<div class="fa2-empty">Loading ' + esc(monLab(S.month)) + "…</div>";
            load();
          };
        });
      }
      main.querySelectorAll(".fa2-chip").forEach(c => {
        c.onclick = () => { S.tab = c.dataset.tab; paint(); };
      });
      const q = main.querySelector("#fa2Q");
      if (q) q.oninput = function () {
        S.q = this.value;
        const at = this.selectionStart;
        paint();
        const nq = main.querySelector("#fa2Q");
        if (nq) { nq.focus(); nq.setSelectionRange(at, at); }
      };
      main.querySelectorAll(".fa2-head").forEach(hd => {
        hd.onclick = () => {
          const f = hd.parentElement.dataset.f;
          S.open = S.open === f ? null : f;
          paint();
        };
      });
      main.querySelectorAll(".fa2-star:not(:disabled)").forEach(b => {
        b.onclick = e => { e.stopPropagation(); rate(b.dataset.f, b.dataset.q, +b.dataset.s, b.dataset.m); };
        // preview: hovering the 4th star lights 1-4, so the click's meaning is visible first
        b.onmouseenter = () => {
          b.parentElement.querySelectorAll(".fa2-star").forEach(s2 =>
            s2.classList.toggle("pv", +s2.dataset.s <= +b.dataset.s));
        };
      });
      main.querySelectorAll(".fa2-stars").forEach(w => {
        w.onmouseleave = () => w.querySelectorAll(".fa2-star.pv")
          .forEach(s2 => s2.classList.remove("pv"));
      });
      main.querySelectorAll(".fa2-clr").forEach(b => {
        b.onclick = e => { e.stopPropagation(); rate(b.dataset.f, b.dataset.q, null, b.dataset.m); };
      });
      const sub = main.querySelector("#fa2Submit");
      if (sub) sub.onclick = submitMonth;
      const ro = main.querySelector("#fa2Reopen");
      if (ro) ro.onclick = reopenMonth;
    }

    function rate(foreman, question, stars, m) {
      // a click that raced a month switch is dropped whole: its card belonged to the month
      // that was on screen, not the one the picker now points at
      if (m && m !== S.month) return;
      const month = S.month;
      const key = foreman + "|" + question;
      const seq = S._seq || (S._seq = {});
      const my = seq[key] = (seq[key] || 0) + 1;

      // paint the new value immediately, then confirm — a star that waits for a round trip
      // feels broken when you are rating a hundred and thirty of them
      const cur = (S.ratings[foreman] = S.ratings[foreman] || {});
      const before = cur[question];
      if (stars == null) delete cur[question];
      else cur[question] = { Foreman: foreman, Question: question, Stars: stars,
                             "Entered By": "you", "Entered At": new Date().toISOString().slice(0, 10) };
      S.msg = "";
      paint();
      // SERIALIZED per question: two fast clicks otherwise race to the server and the last
      // click can lose the ordering there, while a late failure here could roll the UI
      // back over a newer, successful write
      const chain = S._chain || (S._chain = {});
      chain[key] = (chain[key] || Promise.resolve()).then(() =>
        api("/api/_fassess", { method: "POST", body: JSON.stringify({
              month: month, foreman: foreman, question: question, stars: stars }) })
      ).then(() => {}, e => {
        if (seq[key] !== my) return;   // a newer click owns this question now
        // put it back exactly as it was: a rating that silently failed is worse than none
        if (before) cur[question] = before; else delete cur[question];
        S.msg = "Not saved — " + e.message;
        S.msgErr = true;
        paint();
      });
    }

    function submitMonth() {
      const all = (S.sc || []).filter(r => String(r.Month || "").slice(0, 7) === S.month).map(rowFor);
      const done = all.filter(x => x.answered === NQ).length;
      const lbl = monLab(S.month);
      const ask = done < all.length
        ? "Only " + done + " of " + all.length + " foremen are fully assessed.\n\nSubmit " + lbl
          + " anyway? Ratings become final and only an admin can reopen the month."
        : "Submit " + lbl + "? Ratings become final and only an admin can reopen the month.";
      if (!confirm(ask)) return;
      const btn = main.querySelector("#fa2Submit");
      if (btn) { btn.disabled = true; btn.textContent = "Submitting…"; }
      api("/api/_fassess", { method: "POST", body: JSON.stringify({ month: S.month, submit: true }) })
        .then(() => { S.msg = lbl + " submitted — ratings are final."; S.msgErr = false; load(); })
        .catch(e => { S.msg = e.message; S.msgErr = true; paint(); });
    }

    function reopenMonth() {
      if (!confirm("Reopen " + monLab(S.month) + " for rating? The published standing can change.")) return;
      api("/api/_fassess", { method: "POST", body: JSON.stringify({ month: S.month, unlock: true }) })
        .then(() => { S.msg = monLab(S.month) + " reopened."; S.msgErr = false; load(); })
        .catch(e => { S.msg = e.message; S.msgErr = true; paint(); });
    }

    load();
  },
});
