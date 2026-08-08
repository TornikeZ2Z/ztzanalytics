/* FOREMAN ASSESSMENT — the 40% a machine cannot see.
 *
 * Four things about a foreman can be counted: what packing he sold per 100 CF, how that
 * compared with the sales estimate, the reviews he earned, the complaints upheld against
 * him. They are 60% of Foreman of the Month and they arrive from the warehouse already
 * scored, through the range tables the office maintains.
 *
 * The rest cannot be counted — whether he loads a truck well, can take straight long-distance
 * work, runs a two-truck job, takes assignments without argument, brings his own crew and
 * leads it, follows the rules. Logistics scores those, and this page is where that happens.
 *
 * THE QUESTIONS ARE DATA, NOT CODE (Tornike, 2026-08-07). `forman_assessment_rubric` holds
 * one row per (month, question) with its label, its points and how it is answered, and
 * Ramaz edits it in the panel at the top of this page — add, remove, re-point, always
 * sharing 40 points. It is versioned by MONTH, so a month already scored still renders and
 * still totals the questions it was actually scored under.
 *
 * THE RULES THE PAGE ENFORCES IN ITS DESIGN (Tornike, 2026-08-05).
 * A month OPENS on its own 20th — before the 20th of August, August is not in the picker.
 * Nothing date-based ever closes it: the logistics team closes a month themselves with
 * SUBMIT, which stamps who signed it off. Only an admin can reopen a submitted month,
 * because reopening rewrites a published score. The model starts at July 2026.
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
             "Not Qualified Because", "Forman Score",
             // PAYLOAD CONTRACT: a column missing from this list never arrives, however
             // well the page is written. These four carry the 2026-07 model — what the
             // counted side is worth in that month (70 before it, 60 from it), how many
             // questions its rubric asked and for how many points, and whether the man
             // was rated on all of them.
             "Counted Total", "Questions In Rubric", "Manual Total", "Fully Assessed",
             "Claims Charged"],
    };
  }
})();

registerPage({
  id: "foreman-assessment",
  title: "Foreman Assessment",
  subtitle: "What only a person can judge — scored monthly on the rubric logistics sets, on top of what the warehouse already counts.",
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
    const num = v => (v == null || v === "" || isNaN(v)) ? null : +v;
    const fmtN = v => (+v || 0).toLocaleString();
    const fmt1 = v => (Math.round(+v * 10) / 10).toFixed(1);

    /* THE QUESTIONS COME FROM THE SERVER, PER MONTH. They used to be a hardcoded list here
     * — a third copy of the same six, alongside the loader's and the bridge's, which had to
     * be edited in step. Ramaz owns the rubric now (Tornike, 2026-08-07) and it is versioned
     * by month, so a month scored under a different set of questions still renders the set
     * it was actually scored under. `k` is what the database stores. */
    const QS = () => S.rubric || [];
    const NQ = () => QS().length;
    const MANUAL_TOTAL = () => S.manualTotal || 40;
    // his rule (2026-08-08): with 40 points to share, one question at 20 would quietly BE
    // the assessment. Mirrors bridge/app.py FA_MAX_QUESTION_POINTS, which is the real gate.
    const MAX_Q_POINTS = 10;

    // the four counted topics, for the "already counted" strip inside each card. Reviews
    // went 20 -> 10 when the manual side went 30 -> 40 (Tornike, 2026-08-07); months before
    // 2026-07 were scored on the old weights and say so via `Counted Total`.
    const AUTO_V2 = [
      { k: "Packing per 100 CF Score", w: 30, lab: "Packing per 100 CF",
        raw: "Packing per 100 CF", fmt: "usd" },
      { k: "Review Score", w: 10, lab: "Reviews earned",
        raw: "Reviews to Jobs Ratio", fmt: "ratio" },
      { k: "Packing Vs Estimate Score", w: 10, lab: "Packing vs estimate",
        raw: "Packing Difference %", fmt: "x" },
      { k: "Claim Score", w: 10, lab: "Complaints upheld",
        // the count the score was CHARGED on, not the per-job rollup -- see curated.py
        raw: "Claims Charged", fmt: "int" },
    ];
    const AUTO_V1 = AUTO_V2.map(a => a.k === "Review Score" ? Object.assign({}, a, { w: 20 }) : a);
    const autoFor = f => (num(f["Counted Total"]) === 70 ? AUTO_V1 : AUTO_V2);
    const countedTotal = f => num(f["Counted Total"]) || 60;
    const MIN_MONTH = "2026-07", OPEN_DAY = 20;
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
                    "August", "September", "October", "November", "December"];

    const S = window.__FA2 || (window.__FA2 = {
      month: "", sc: null, ratings: null, locked: false, subBy: null, subAt: null,
      canReopen: false, q: "", tab: "all", open: null, msg: "", msgErr: false, notOpen: null,
      rubric: [], manualTotal: 40, canEditRubric: false, rubricMonths: [],
      draft: null, view: "rate", rubMonth: "", qRubric: [], qRated: [], qLocked: false,
    });

    // The yard's calendar, not the viewer's: Tbilisi reaches the 20th eight hours before
    // New Jersey does, and the bridge gates writes on New Jersey time — so the picker must
    // open months on the same clock or the first hours of a month would 400 on every star.
    const njToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const monLab = m => m ? MONTHS[+m.slice(5, 7) - 1] + " " + m.slice(0, 4) : "—";

    const isOpenForRating = m => {
      const nj = njToday(), curYm = nj.slice(0, 7), day = +nj.slice(8, 10);
      return m >= MIN_MONTH && (m < curYm || (m === curYm && day >= OPEN_DAY));
    };

    /* The picker carries two kinds of month: those OPEN FOR RATING, and the current/next
     * month whose RUBRIC can still be shaped. They are not the same set, and conflating
     * them hid the feature: August's questions have to be settled before August opens on
     * the 20th, but a rating-only picker would not show August until the 20th — by which
     * point it is too late to decide what August asks. A month that is listed for its
     * rubric alone renders the panel and says rating opens on the 20th. */
    function openMonths() {
      const seen = {};
      (S.sc || []).forEach(r => { const m = String(r.Month || "").slice(0, 7); if (m) seen[m] = 1; });
      const rating = Object.keys(seen).filter(isOpenForRating);
      const shaping = (S.canEditRubric ? (S.rubricMonths || []) : [])
        .filter(m => m >= MIN_MONTH && seen[m] && rating.indexOf(m) < 0);
      return rating.concat(shaping).sort().reverse();
    }

    host.innerHTML = '<style id="fa2Css">'
      // THE STICKY SUBMIT BAR FLOATS OVER THE LIST, so the list needs room underneath it or
      // it covers the last question — which is exactly what it was doing: a description cut
      // mid-sentence with the bar drawn on top of it, looking like a text overflow bug.
      + ".fa2{font-variant-numeric:tabular-nums;padding-bottom:96px}"
      // ---- the two views: rating, and the questionnaire behind it ----------------------
      + ".fa2-views{display:flex;gap:8px;margin:0 0 16px}"
      + ".fa2-view{font-family:inherit;font-size:14.5px;font-weight:750;padding:11px 20px;"
      + "border-radius:12px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;display:inline-flex;align-items:center;gap:9px}"
      + ".fa2-view:hover{border-color:var(--line-2);color:var(--ink)}"
      + ".fa2-view.on{background:var(--ink);border-color:var(--ink);color:var(--panel)}"
      + ".fa2-view i{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.09em;"
      + "text-transform:uppercase;opacity:.7}"
      // ---- the questionnaire admin screen ---------------------------------------------
      + ".fa2-qn{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:0 0 26px}"
      /* THE ACTION BAR STICKS TO THE TOP AND THE BUTTONS SIT TOP-RIGHT -- his ask
         (2026-08-08). They used to live at the very bottom of a nine-row form, so after
         editing the fourth question you had to scroll past five more to find out whether
         you could save. Now the running total and the two buttons follow you down. */
      + ".fa2-qnact{position:sticky;top:0;z-index:12;display:flex;align-items:center;gap:16px;"
      + "flex-wrap:wrap;padding:15px 26px;background:var(--panel);border-bottom:1px solid var(--line);"
      + "border-radius:16px 16px 0 0}"
      + ".fa2-qnact .run{display:flex;align-items:baseline;gap:9px;margin-right:auto}"
      + ".fa2-qnact .run b{font-size:27px;font-weight:800;letter-spacing:-.7px;line-height:1;"
      + "font-variant-numeric:tabular-nums}"
      + ".fa2-qnact .run span{font-size:13.5px;color:var(--muted)}"
      + ".fa2-qnact.ok .run b{color:var(--pos)} .fa2-qnact.bad .run b{color:var(--warn)}"
      + ".fa2-qnact .state{font-size:13.5px;font-weight:750}"
      + ".fa2-qnact.ok .state{color:var(--pos)} .fa2-qnact.bad .state{color:var(--warn)}"
      + ".fa2-qnbody{padding:22px 26px 0}"
      + ".fa2-qnhead{display:flex;gap:32px;align-items:flex-start;flex-wrap:wrap;margin-bottom:22px}"
      + ".fa2-qnhead h2{margin:0 0 6px;font-size:23px;font-weight:800;letter-spacing:-.4px}"
      + ".fa2-qnhead p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.65;max-width:88ch}"
      + ".fa2-qnmon{margin-left:auto;display:flex;flex-direction:column;gap:5px;min-width:230px}"
      + ".fa2-qnmon label{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-qnmon select{font:inherit;font-size:15px;font-weight:700;background:var(--panel-2);"
      + "color:var(--ink);border:1px solid var(--line-2);border-radius:11px;padding:10px 13px}"
      + ".fa2-qnmon .hint{font-size:11.5px;color:var(--faint);line-height:1.5}"
      + ".fa2-qnbar{height:5px;border-radius:3px;background:var(--line);overflow:hidden;"
      + "width:190px;flex:0 0 auto}"
      + ".fa2-qnbar u{display:block;height:100%;background:var(--brand);transition:width .2s}"
      + ".fa2-qnlist{display:flex;flex-direction:column;gap:12px}"
      + ".fa2-qnrow{display:grid;grid-template-columns:52px minmax(0,1fr) 128px 232px auto;gap:18px;"
      + "align-items:start;background:var(--panel-2);border:1px solid var(--line);border-radius:14px;"
      + "padding:17px 19px;transition:border-color .12s,box-shadow .12s}"
      + ".fa2-qnrow:hover{border-color:var(--line-2)}"
      /* REORDERING -- his ask (2026-08-08). Drag by the handle (dragging the whole row would
         fight the text inputs inside it), or use the arrows, which also work from a keyboard
         and on a touchpad where drag is fiddly. */
      + ".fa2-qnrow.drag{opacity:.4}"
      + ".fa2-qnrow.over{border-color:var(--brand);box-shadow:0 -3px 0 -1px var(--brand) inset}"
      + ".fa2-qnord{display:flex;flex-direction:column;align-items:center;gap:2px}"
      + ".fa2-qngrip{cursor:grab;font-size:16px;line-height:1;color:var(--faint);padding:2px 6px;"
      + "border-radius:7px;user-select:none}"
      + ".fa2-qngrip:hover{color:var(--ink);background:var(--panel)}"
      + ".fa2-qngrip:active{cursor:grabbing}"
      + ".fa2-qnmv{font:inherit;font-size:12px;line-height:1;color:var(--faint);background:transparent;"
      + "border:1px solid transparent;border-radius:6px;padding:2px 7px;cursor:pointer}"
      + ".fa2-qnmv:hover:not(:disabled){color:var(--brand);border-color:var(--line-2)}"
      + ".fa2-qnmv:disabled{opacity:.25;cursor:default}"
      + ".fa2-qnrow .n{width:34px;height:34px;border-radius:10px;background:var(--panel);border:1px solid var(--line-2);"
      + "display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:800;color:var(--faint)}"
      + ".fa2-qnrow .f{display:flex;flex-direction:column;gap:7px;min-width:0}"
      + ".fa2-qnrow .p,.fa2-qnrow .s{display:flex;flex-direction:column;gap:5px}"
      + ".fa2-qnrow label{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-qnrow input,.fa2-qnrow select{font:inherit;font-size:15px;background:var(--panel);"
      + "color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:11px 14px;min-width:0}"
      + ".fa2-qnrow .rbq{font-size:17px;font-weight:700}"
      + ".fa2-qnrow .rbd{font-size:14px;color:var(--muted)}"
      + ".fa2-qnrow .p input{font-size:17px;font-weight:800;text-align:center;"
      + "font-variant-numeric:tabular-nums}"
      + ".fa2-qnrow .p input.over{border-color:var(--neg);color:var(--neg)}"
      + ".fa2-qnrow label{display:flex;align-items:baseline;gap:6px}"
      + ".fa2-qnrow label i{font-style:normal;font-weight:600;letter-spacing:0;text-transform:none;"
      + "color:var(--faint);font-size:10.5px}"
      + ".fa2-qnrow input:focus,.fa2-qnrow select:focus{outline:none;border-color:var(--brand)}"
      + ".fa2-qnrow select:disabled{opacity:.55;cursor:not-allowed}"
      + ".fa2-qnrow .rbx{align-self:center;font:inherit;font-size:12.5px;font-weight:700;background:transparent;"
      + "color:var(--faint);border:1px solid var(--line-2);border-radius:10px;padding:9px 14px;cursor:pointer;white-space:nowrap}"
      + ".fa2-qnrow .rbx:hover{color:var(--neg);border-color:var(--neg)}"
      + ".fa2-qnrow.rated{border-left:3px solid var(--blue)}"
      + ".fa2-qnfoot{display:flex;gap:16px;align-items:center;flex-wrap:wrap;margin-top:20px}"
      + ".fa2-qnfoot .hint{font-size:12.5px;color:var(--faint);line-height:1.6;max-width:78ch}"
      + ".fa2-qnadd{font-family:inherit;font-size:14px;font-weight:750;padding:12px 20px;"
      + "border-radius:12px;border:1px dashed var(--line-2);background:transparent;color:var(--muted);"
      + "cursor:pointer}"
      + ".fa2-qnadd:hover{border-color:var(--brand);color:var(--brand);border-style:solid}"
      + "@media(max-width:1150px){.fa2-qnrow{grid-template-columns:1fr;gap:10px}.fa2-qnrow .n{display:none}}"
      // ---- hero ------------------------------------------------------------------------
      // NOT overflow:hidden — the month list hangs out of the hero, and clipping it left
      // the dropdown showing exactly one row. The progress bar rounds its own corners.
      + ".fa2-hero{background:var(--panel);border:1px solid var(--line);border-radius:16px;margin-bottom:14px;box-shadow:var(--shadow);position:relative}"
      + ".fa2-hrow{display:flex;flex-wrap:wrap;gap:14px 30px;align-items:center;padding:18px 22px}"
      + ".fa2-eyebrow{font-size:11px;font-weight:800;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);margin-bottom:2px}"
      // the month picker: a native <select> popup cannot be styled, so the trigger is the
      // month title itself and the list is ours — each month carrying its open/submitted state
      + ".fa2-mon{position:relative;display:inline-block}"
      + ".fa2-monbtn{display:flex;align-items:center;gap:10px;background:transparent;border:0;color:var(--ink);font-family:inherit;font-size:31px;font-weight:800;letter-spacing:-.6px;padding:0;cursor:pointer;font-variant-numeric:tabular-nums}"
      + ".fa2-monbtn .car{font-size:13px;color:var(--faint);transition:transform .16s ease;margin-top:5px}"
      + ".fa2-monbtn:hover .car{color:var(--muted)}"
      + ".fa2-monbtn.open .car{transform:rotate(180deg)}"
      + ".fa2-mlist{position:absolute;top:calc(100% + 10px);left:-10px;min-width:252px;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 20px 44px rgba(0,0,0,.22),var(--shadow);padding:6px;z-index:44;display:none}"
      + ".fa2-mlist.open{display:block;animation:fa2in .14s ease}"
      + ".fa2-mopt{display:flex;align-items:center;gap:10px;width:100%;text-align:left;font-family:inherit;font-size:15px;font-weight:650;color:var(--ink);background:none;border:0;border-radius:9px;padding:9px 12px;cursor:pointer;font-variant-numeric:tabular-nums}"
      + ".fa2-mopt:hover{background:var(--panel-2)}"
      + ".fa2-mopt.cur{background:var(--brand-glow);color:var(--brand-d);font-weight:800}"
      + "body.rs-app:not(.light) .fa2-mopt.cur{color:var(--brand)}"
      + ".fa2-mopt .tag{margin-left:auto;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}"
      + ".fa2-mopt .tag.sub{color:var(--blue)} .fa2-mopt .tag.op{color:var(--pos)}"
      + ".fa2-pill{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:800;padding:7px 14px;border-radius:999px;margin-top:5px}"
      + ".fa2-pill.open{background:var(--pos-bg);color:var(--pos)}"
      + ".fa2-pill.sub{background:var(--blue-bg);color:var(--blue)}"
      + ".fa2-stats{display:flex;flex-wrap:wrap;margin-left:auto}"
      + ".fa2-st{padding:4px 28px;border-left:1px solid var(--line)}"
      + ".fa2-st b{display:block;font-size:26px;font-weight:750;letter-spacing:-.4px;line-height:1.15;white-space:nowrap}"
      + ".fa2-st span{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-st small{display:block;font-size:12px;color:var(--muted);margin-top:1px;white-space:nowrap}"
      + ".fa2-prog{height:5px;background:var(--panel-2);border-radius:0 0 15px 15px;overflow:hidden}"
      + ".fa2-prog i{display:block;height:100%;background:var(--blue);transition:width .4s ease}"
      // ---- toolbar ---------------------------------------------------------------------
      + ".fa2-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:12px}"
      + ".fa2-chip{font-family:inherit;font-size:13.5px;font-weight:700;padding:9px 16px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer}"
      + ".fa2-chip:hover{border-color:var(--line-2)}"
      + ".fa2-chip.on{background:var(--brand-glow);border-color:transparent;color:var(--brand-d)}"
      + "body.rs-app:not(.light) .fa2-chip.on{color:var(--brand)}"
      + ".fa2-bar input{margin-left:auto;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 12px;color:var(--ink);font-family:inherit;font-size:12.5px;min-width:220px}"
      + ".fa2-how{font-size:13px;color:var(--faint);line-height:1.65;max-width:112ch;margin:0 0 14px}"
      + ".fa2-how summary{cursor:pointer;font-weight:700;color:var(--muted);font-size:13.5px;user-select:none}"
      + ".fa2-how[open] summary{margin-bottom:5px}"
      + ".fa2-msg{font-size:13.5px;padding:11px 15px;border-radius:10px;margin-bottom:12px;display:none}"
      + ".fa2-msg.on{display:block;background:var(--pos-bg);color:var(--pos)}"
      + ".fa2-msg.err{display:block;background:var(--neg-bg);color:var(--neg)}"
      // ---- submitted banner ------------------------------------------------------------
      + ".fa2-done{background:var(--blue-bg);border-radius:14px;padding:13px 18px;margin-bottom:12px;display:flex;flex-wrap:wrap;gap:8px 16px;align-items:center;color:var(--blue);font-size:13px;font-weight:750}"
      + ".fa2-done small{color:var(--muted);font-weight:500;font-size:13px}"
      + ".fa2-ghost{font-family:inherit;font-size:13px;font-weight:700;padding:9px 16px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);color:var(--muted);cursor:pointer;margin-left:auto}"
      + ".fa2-ghost:hover{border-color:var(--faint);color:var(--ink)}"
      // ---- cards -----------------------------------------------------------------------
      + ".fa2-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;margin-bottom:9px;overflow:hidden;transition:border-color .15s,box-shadow .15s}"
      + ".fa2-card.on{border-color:var(--line-2);box-shadow:var(--shadow)}"
      // The 1fr was on the NAME, so the name column swallowed ~1050px and the six question
      // chips clumped against the score block with dead space before them. Flexible track
      // moves onto the chip strip (see .fa2-dots below, which now spreads across it).
      + ".fa2-head{display:grid;grid-template-columns:46px minmax(0,1fr) 172px 172px auto;"
      + "gap:24px;align-items:center;padding:19px 22px;cursor:pointer}"
      + ".fa2-head:hover{background:var(--panel-2)}"
      + ".fa2-rk{width:42px;height:42px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800;background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}"
      + ".fa2-rk.top{background:var(--brand);color:var(--brand-ink);border-color:transparent}"
      + ".fa2-rk.oor{background:transparent;color:var(--faint);border-style:dashed}"
      + ".fa2-nm{font-size:21px;font-weight:750;letter-spacing:-.3px}"
      + ".fa2-si{font-size:14px;color:var(--faint);margin-top:3px}"
      + ".fa2-si .oor{color:var(--warn);font-weight:650}"
      + ".fa2-half{display:flex;flex-direction:column;gap:3px;text-align:right}"
      + ".fa2-half b{font-size:22px;font-weight:750;letter-spacing:-.4px;line-height:1;"
      + "font-variant-numeric:tabular-nums}"
      + ".fa2-half b u{text-decoration:none;font-size:14px;font-weight:600;color:var(--faint);margin-left:2px}"
      + ".fa2-half span{font-size:12px;color:var(--faint);white-space:nowrap}"
      + "@media(max-width:1250px){.fa2-half{display:none}}"

      + ".fa2-sc{display:flex;align-items:center;gap:13px}"
      + ".fa2-sb{width:180px;height:11px;border-radius:6px;background:var(--panel-2);overflow:hidden;display:flex}"
      + ".fa2-sb u{display:block;height:100%}"
      + ".fa2-sb u.a{background:var(--brand)} .fa2-sb u.m{background:var(--blue)}"
      + ".fa2-tot{text-align:right;min-width:92px}"
      + ".fa2-tot b{font-size:31px;font-weight:800;letter-spacing:-.7px}"
      + ".fa2-tot i{display:block;font-style:normal;font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:1px}"
      + ".fa2-body{display:none;border-top:1px solid var(--line);padding:20px 22px 24px}"
      + ".fa2-card.on .fa2-body{display:block;animation:fa2in .16s ease}"
      + "@keyframes fa2in{from{opacity:0;transform:translateY(-3px)}to{opacity:1;transform:none}}"
      + ".fa2-sec{font-size:12px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);margin:6px 0 12px}"
      + ".fa2-sec b{color:var(--ink);font-size:17px;letter-spacing:-.2px}"
      + ".fa2-sec .rescale{text-transform:none;letter-spacing:0;font-weight:500;color:var(--muted)}"
      + ".fa2-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:22px}"
      + ".fa2-tile{background:var(--panel-2);border:1px solid var(--line);border-radius:13px;padding:14px 17px}"
      + ".fa2-tile .l{font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}"
      + ".fa2-tile .v{font-size:23px;font-weight:750;margin-top:5px;letter-spacing:-.4px}"
      + ".fa2-tile .v small{font-size:13px;color:var(--faint);font-weight:600}"
      + ".fa2-tile .r{font-size:12.5px;color:var(--muted);margin-top:3px}"
      + ".fa2-tile .tb{height:6px;border-radius:4px;background:var(--line);overflow:hidden;margin-top:11px}"
      + ".fa2-tile .tb i{display:block;height:100%;background:var(--brand)}"
      + ".fa2-tile.na{border-style:dashed} .fa2-tile.na .v{color:var(--faint);font-size:16px;font-weight:600}"
      // ---- questions -------------------------------------------------------------------
      /* ONE CARD PER QUESTION, ACROSS THE WHOLE WIDTH. The old layout capped the prose at
         104ch inside a 1700px card, so the text wrapped into a ribbon down the left third
         and the stars floated in the middle of nothing with the score marooned at the far
         right -- Tornike's words, "very tiny and stupid text breaks in the 33% of the
         screen" (2026-08-08). A question is one thing: its wording, how it is answered and
         what that earned belong in one box, and the boxes tile across the width. */
      + ".fa2-qgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(430px,1fr));gap:14px}"
      + ".fa2-q{display:flex;flex-direction:column;gap:0;background:var(--panel-2);"
      + "border:1px solid var(--line);border-left:4px solid var(--line-2);border-radius:14px;"
      + "padding:17px 19px 15px;transition:border-color .15s}"
      + ".fa2-q.rated{border-left-color:var(--pos);background:var(--panel)}"
      + ".fa2-q .qt{flex:1;display:flex;flex-direction:column;align-items:flex-start}"
      + ".fa2-q .qt b{font-size:17px;font-weight:750;display:block;letter-spacing:-.2px;line-height:1.3}"
      + ".fa2-q .qt span{font-size:14px;color:var(--muted);line-height:1.6;display:block;margin-top:7px}"
      + ".fa2-q .qt em{font-style:normal;font-size:12px;color:var(--faint);display:block;margin-top:8px}"
      + ".fa2-q .qt span:not(.qw){width:100%}"
      + ".fa2-qfoot{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;"
      + "margin-top:15px;padding-top:14px;border-top:1px solid var(--line)}"
      // ---- the rubric panel: what is being scored, and Ramaz's editor ------------------
      + ".fa2-rub{background:var(--panel);border:1px solid var(--line);border-radius:15px;padding:18px 20px;margin-bottom:14px}"
      + ".fa2-rub.edit{border-color:var(--brand)}"
      + ".fa2-rubh{display:flex;align-items:center;gap:12px;flex-wrap:wrap}"
      + ".fa2-rubh b{font-size:16px;font-weight:800}"
      + ".fa2-rubt{font-size:13px;font-weight:700;color:var(--muted);margin-right:auto}"
      + ".fa2-rubt.bad{color:var(--neg)}"
      + ".fa2-rubnote,.fa2-rubwarn{font-size:12.5px;color:var(--faint)}"
      + ".fa2-rubwarn{color:var(--warn)}"
      + ".fa2-rublist{display:flex;flex-wrap:wrap;gap:9px;margin-top:13px}"
      + ".fa2-rubchip{display:inline-flex;align-items:center;gap:10px;background:var(--panel-2);"
      + "border:1px solid var(--line-2);border-radius:999px;padding:7px 8px 7px 15px;font-size:14px}"
      + ".fa2-rubchip u{text-decoration:none;font-weight:800;background:var(--brand-glow);"
      + "color:var(--brand-d);border-radius:999px;padding:3px 11px;font-variant-numeric:tabular-nums;font-size:13.5px}"
      + "body.rs-app:not(.light) .fa2-rubchip u{color:var(--brand)}"
      + ".fa2-rubchip i.tri{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".fa2-go{font:inherit;font-size:12.5px;font-weight:800;background:var(--brand);"
      + "color:var(--brand-ink);border:0;border-radius:9px;padding:8px 16px;cursor:pointer}"
      + ".fa2-go:disabled{opacity:.45;cursor:default}"
      // ---- the three-way control -------------------------------------------------------
      + ".fa2-ctl{display:flex;gap:9px;align-items:center;flex-wrap:wrap}"
      + ".fa2-tri{display:inline-flex;gap:5px;flex-wrap:wrap}"
      + ".fa2-trib{font:inherit;font-size:14px;font-weight:700;background:var(--panel-2);"
      + "color:var(--muted);border:1px solid var(--line-2);border-radius:11px;padding:10px 16px;"
      + "cursor:pointer;display:inline-flex;align-items:center;gap:7px;white-space:nowrap}"
      + ".fa2-trib:hover:not(:disabled){border-color:var(--brand)}"
      + ".fa2-trib.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".fa2-trib u{text-decoration:none;font-size:12.5px;font-weight:800;opacity:.75;"
      + "font-variant-numeric:tabular-nums}"
      + ".fa2-trib:disabled{cursor:default;opacity:.7}"
      /* YES / NO -- his ask (2026-08-08). Stored in the same Stars column as everything
         else (5 or 0), so the mart needs no idea that this control exists. */
      + ".fa2-bool{display:inline-flex;gap:8px}"
      + ".fa2-boolb{font:inherit;font-size:15px;font-weight:750;background:var(--panel);"
      + "color:var(--muted);border:1px solid var(--line-2);border-radius:12px;padding:11px 24px;"
      + "cursor:pointer;min-width:96px}"
      + ".fa2-boolb:hover:not(:disabled){border-color:var(--brand)}"
      + ".fa2-boolb.on.y{background:var(--pos);border-color:var(--pos);color:#fff}"
      + ".fa2-boolb.on.n{background:var(--neg);border-color:var(--neg);color:#fff}"
      + ".fa2-boolb:disabled{cursor:default;opacity:.7}"
      + ".fa2-q .qw{align-self:flex-start;font-size:12px;font-weight:800;letter-spacing:.03em;"
      + "color:var(--faint);background:var(--panel);border:1px solid var(--line);"
      + "border-radius:999px;padding:3px 11px;margin-bottom:9px;font-variant-numeric:tabular-nums}"
      + ".fa2-q.rated .qw{background:var(--panel-2)}"
      + ".fa2-stars{display:flex;gap:1px;align-items:center}"
      + ".fa2-star{font-size:34px;line-height:1;cursor:pointer;background:none;border:0;padding:0 3px;color:var(--line-2);transition:transform .07s}"
      + ".fa2-star.on,.fa2-star.pv{color:var(--warn)}"
      + ".fa2-star:disabled{cursor:default;opacity:.7}"
      + ".fa2-star:hover:not(:disabled){transform:scale(1.2)}"
      + ".fa2-clr{font-size:11.5px;color:var(--faint);background:none;border:0;cursor:pointer;margin-left:7px;text-decoration:underline;font-family:inherit}"
      + ".fa2-pts{text-align:right;font-size:27px;font-weight:800;letter-spacing:-.6px;"
      + "line-height:1;white-space:nowrap;font-variant-numeric:tabular-nums}"
      + ".fa2-pts small{display:block;font-size:11px;font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".fa2-pts.un{color:var(--faint);font-weight:600;font-size:14px;letter-spacing:0}"
      + ".fa2-pts.un small{margin-top:4px}"
      // ---- submit bar ------------------------------------------------------------------
      + ".fa2-sub{position:sticky;bottom:18px;margin:18px 26px 0;background:var(--panel);border:1px solid var(--line-2);border-radius:14px;box-shadow:0 14px 38px rgba(0,0,0,.26),var(--shadow);padding:15px 22px;display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center;z-index:6}"
      + ".fa2-sub .t{font-size:14px;color:var(--muted)} .fa2-sub .t b{color:var(--ink);font-size:15.5px}"
      + ".fa2-spb{flex:1;min-width:150px;height:6px;border-radius:4px;background:var(--panel-2);overflow:hidden}"
      + ".fa2-spb i{display:block;height:100%;background:var(--blue);transition:width .3s}"
      + ".fa2-go{font-family:inherit;font-size:14px;font-weight:800;padding:12px 24px;border-radius:11px;border:0;background:var(--brand);color:var(--brand-ink);cursor:pointer}"
      + ".fa2-go:hover{background:var(--brand-d)} .fa2-go:disabled{opacity:.6;cursor:default}"
      + ".fa2-empty{padding:52px;text-align:center;color:var(--faint);font-size:15px;background:var(--panel);border:1px dashed var(--line-2);border-radius:14px}"
      + "@media(max-width:820px){.fa2-qgrid{grid-template-columns:1fr}.fa2-head{grid-template-columns:42px 1fr auto;gap:12px}.fa2-stats{margin-left:0}.fa2-st{padding-left:0;padding-right:24px;border-left:0}.fa2-sc{gap:9px}.fa2-sb{width:80px}}"
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
          // a month listed only so its rubric can be shaped is not ratable yet; the same
          // flag that disables the stars keeps the bridge from having to reject the writes
          S.notOpen = j.not_open || null;
          S.subBy = j.submitted_by || null;
          S.subAt = j.submitted_at || null;
          S.canReopen = !!j.can_reopen;
          S.rubric = j.rubric || [];
          S.manualTotal = j.manual_total || 40;
          S.canEditRubric = !!j.can_edit_rubric;
          S.rubricMonths = j.rubric_months || [];
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
      // a rating is worth Stars/5 of what THIS month's rubric pays for that question, and a
      // rating whose question the month does not ask is worth nothing — which is what lets
      // the rubric change without restating a month somebody already scored
      QS().forEach(q => {
        const v = r[q.Question];
        if (v && v.Stars != null) { answered++; manual += +v.Stars / 5 * (+q.Points || 0); }
      });
      const auto = num(f["Auto Score"]);
      return { f, r, answered, manual, auto,
               total: auto == null ? null : auto + manual,
               full: NQ() > 0 && answered >= NQ(),
               ok: +f["Qualified"] === 1, why: f["Not Qualified Because"] || "" };
    }

    const stat = (b, lab, sub) => '<div class="fa2-st"><span>' + esc(lab) + "</span><b>" + b
      + "</b><small>" + esc(sub) + "</small></div>";
    const chip = (id, lab) => '<button class="fa2-chip' + (S.tab === id ? " on" : "")
      + '" data-tab="' + id + '">' + lab + "</button>";

    /* THE RUBRIC, ON TOP OF THE VIEW — "imagine having list of assestments and points it
     * holds in the view on top ... he can easily add / remove question and assign points.
     * he should distribute 40 points in total" (Tornike, 2026-08-07).
     *
     * Read-only for everyone who can rate; editable only by an admin or the holder of the
     * rubric grant, and only for a month that is still being shaped — re-pointing a month
     * that already carries ratings would restate scores nobody touched. */
    function ratedKeys() {
      const out = {};
      Object.keys(S.ratings || {}).forEach(f => Object.keys(S.ratings[f] || {})
        .forEach(k => { if (S.ratings[f][k] && S.ratings[f][k].Stars != null) out[k] = 1; }));
      return out;
    }

    // The draft is built from the SHAPED month's rubric and the SHAPED month's ratings —
    // never from whatever month happens to be on the rating screen.
    function draftFromRubric() {
      const rated = {};
      (S.qRated || []).forEach(k => { rated[k] = 1; });
      return (S.qRubric || []).map(q => ({ question: q.Question, label: q.Label || "",
        description: q.Description || "", points: +q.Points || 0,
        scale: q.Scale || "stars5", rated: !!rated[q.Question] }));
    }

    /* One way in, so the shaped month is always chosen the same way: the month being
     * rated when it is still editable, otherwise the newest editable month. */
    function openQuestionnaire() {
      const ms = S.rubricMonths || [];
      const m = (ms.indexOf(S.month) >= 0) ? S.month : ms[ms.length - 1];
      S.view = "rubric"; S.msg = "";
      if (!m) { S.rubMonth = ""; S.qRubric = []; S.draft = []; paint(); return; }
      S.rubMonth = m;
      loadRubricFor(m);
    }

    function wireRubric() {
      const ed = main.querySelector("#fa2RubEdit");
      if (ed) ed.onclick = () => { openQuestionnaire(); };
      const cancel = main.querySelector("#fa2RubCancel");
      if (cancel) cancel.onclick = () => {
        // in the Questionnaire view "Undo changes" means reload the saved set, not leave
        S.draft = draftFromRubric(); S.msg = ""; paint();
      };
      // the Questionnaire view shapes a month of its own, which may not be the one being rated
      const qm = main.querySelector("#fa2QnMonth");
      if (qm) qm.onchange = () => {
        S.rubMonth = qm.value; S.msg = "";
        loadRubricFor(qm.value);
      };

      main.querySelectorAll(".fa2-qnrow input, .fa2-qnrow select").forEach(el => {
        const commit = () => {
          const row = S.draft[+el.dataset.i]; if (!row) return;
          if (el.dataset.k === "points") {
            // CLAMP HERE, not only on save. The bridge refuses anything over the ceiling,
            // and finding that out after typing nine questions and pressing Save is the
            // worst moment to learn it. `over` paints the field red as it happens.
            const v = +el.value || 0;
            row.points = v;
            el.classList.toggle("over", v > MAX_Q_POINTS);
          } else {
            row[el.dataset.k] = el.value;
          }
        };
        // repaint on points/scale (the running total and the Save gate move); leave text
        // alone until blur so the caret is not thrown to the end on every keystroke
        // NO REPAINT WHILE TYPING. Re-rendering on each keystroke removed the very
        // button the user was reaching for, so the first click after typing did nothing.
        // The only thing that has to move live is the running total, so move just that.
        el.oninput = () => { commit(); refreshTotal(); };
        el.onchange = () => { commit(); refreshTotal(); };
        el.onblur = commit;
      });
      main.querySelectorAll(".fa2-qnrow .rbx").forEach(b => {
        b.onclick = () => { S.draft.splice(+b.dataset.i, 1); paint(); };
      });

      /* REORDERING (his ask, 2026-08-08). The order the questions sit in here is the order
       * the raters see, and it is saved as `Sort Order` — the array index IS the order, so
       * moving a row is a splice and nothing else has to know. */
      const move = (from, to) => {
        const d = S.draft || [];
        if (from === to || from < 0 || to < 0 || from >= d.length || to >= d.length) return;
        d.splice(to, 0, d.splice(from, 1)[0]);
        paint();
      };
      main.querySelectorAll(".fa2-qnmv").forEach(b => {
        b.onclick = () => {
          const i = +b.dataset.i;
          move(i, b.dataset.mv === "up" ? i - 1 : i + 1);
        };
      });
      // DRAG BY THE GRIP, NOT THE ROW. A draggable row swallows click-and-drag inside its
      // own text inputs, which is how a person selects a word to retype it.
      let dragFrom = null;
      main.querySelectorAll(".fa2-qngrip").forEach(g => {
        g.ondragstart = ev => {
          dragFrom = +g.dataset.grip;
          ev.dataTransfer.effectAllowed = "move";
          // Firefox refuses to start a drag with no payload
          try { ev.dataTransfer.setData("text/plain", String(dragFrom)); } catch (e) { /* ok */ }
          const row = g.closest(".fa2-qnrow");
          if (row) row.classList.add("drag");
        };
        g.ondragend = () => {
          dragFrom = null;
          main.querySelectorAll(".fa2-qnrow").forEach(r => r.classList.remove("drag", "over"));
        };
      });
      main.querySelectorAll(".fa2-qnrow").forEach(row => {
        row.ondragover = ev => {
          if (dragFrom == null) return;
          ev.preventDefault();
          ev.dataTransfer.dropEffect = "move";
          row.classList.add("over");
        };
        row.ondragleave = () => row.classList.remove("over");
        row.ondrop = ev => {
          ev.preventDefault();
          row.classList.remove("over");
          if (dragFrom == null) return;
          const to = +row.dataset.row;
          const from = dragFrom;
          dragFrom = null;
          move(from, to);
        };
      });
      const add = main.querySelector("#fa2RubAdd");
      if (add) add.onclick = () => {
        S.draft.push({ question: "", label: "", description: "", points: 0,
                       scale: "stars5", rated: false, isNew: true });
        paint();
      };
      const save = main.querySelector("#fa2RubSave");
      if (save) save.onclick = saveRubric;
    }

    /* Update the running total in place. Everything else on the screen is already
     * correct while typing, and a full repaint would cost the user their caret and their
     * next click. */
    function refreshTotal() {
      const d = S.draft || [];
      const dt = d.reduce((s2, q) => s2 + (+q.points || 0), 0);
      const total = MANUAL_TOTAL();
      const left = Math.round((total - dt) * 10) / 10;
      const ok = Math.abs(dt - total) < 0.05;
      // the total lives in the sticky action bar now, so it stays on screen while typing
      const box = main.querySelector(".fa2-qnact");
      if (box) {
        box.classList.toggle("ok", ok);
        box.classList.toggle("bad", !ok);
        const b = box.querySelector(".run b"), st = box.querySelector(".state"),
              bar = box.querySelector(".fa2-qnbar u");
        if (b) b.textContent = fmt1(dt);
        if (st) st.textContent = ok ? "balanced"
          : left > 0 ? fmt1(left) + " still to give out" : fmt1(-left) + " too many";
        if (bar) bar.style.width = Math.min(100, dt / total * 100).toFixed(0) + "%";
      }
      const save = main.querySelector("#fa2RubSave");
      if (save) save.disabled = !ok;
      const rt = main.querySelector(".fa2-rubt");
      if (rt) { rt.classList.toggle("bad", !ok); }
    }

    function paintKeepFocus(el) {
      const sel = "." + el.className.split(" ")[0] + '[data-i="' + el.dataset.i + '"]';
      const at = el.selectionStart;
      paint();
      const again = main.querySelector(".fa2-qnrow " + sel);
      if (again) {
        again.focus();
        try { again.setSelectionRange(at, at); } catch (e) { /* number inputs refuse */ }
      }
    }

    /* The bridge requires ^[a-z][a-z0-9_]{2,39}$ and rejects anything else with a 400.
     * A short label ("QA") used to make a key too short, and the uniqueness counter could
     * push a long one past 40 — both only discoverable by saving and being refused. */
    function slugify(label, taken) {
      let base = String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "").slice(0, 34);
      if (!/^[a-z]/.test(base)) base = "q_" + base;
      while (base.length < 3) base += "_q";
      let k = base, n = 2;
      while (taken[k]) { k = (base.slice(0, 34) + "_" + n).slice(0, 40); n++; }
      return k;
    }

    /* Load one month's questions into the editor without disturbing the month being rated.
     * `ratedKeys()` deliberately still reads the RATED month's answers only when the two
     * months coincide — a question is scale-locked by ITS OWN month's ratings, and the
     * server enforces that regardless of what the page believes. */
    function loadRubricFor(m) {
      main.innerHTML = '<div class="fa2-empty">Loading ' + esc(monLab(m)) + "…</div>";
      api("/api/_farubric?month=" + encodeURIComponent(m))
        .then(j => {
          // NOT S.rubric — that belongs to the month being rated, and overwriting it here
          // is what made the rating screen render another month's questions.
          S.qRubric = j.rubric || [];
          S.qRated = j.rated || [];
          S.qLocked = !!j.locked;
          S.manualTotal = j.manual_total || 40;
          S.rubricMonths = j.editable_months || S.rubricMonths;
          S.draft = draftFromRubric();
          paint();
        })
        .catch(e => { S.msg = e.message; S.msgErr = true; paint(); });
    }

    function saveRubric() {
      const taken = {};
      QS().forEach(q => { taken[q.Question] = 1; });
      const items = (S.draft || []).map(r => {
        // a NEW question needs a key; existing ones keep theirs, because the key is what
        // every saved rating points at
        const key = r.question || slugify(r.label, taken);
        taken[key] = 1;
        return { question: key, label: (r.label || "").trim(), points: +r.points || 0,
                 scale: r.scale || "stars5", description: (r.description || "").trim() };
      });
      const bad = items.filter(i => !i.label);
      if (bad.length) { S.msg = "Every question needs a name."; S.msgErr = true; paint(); return; }
      S.msg = "Saving…"; S.msgErr = false; paint();
      // the Questionnaire view may be shaping a month other than the one being rated
      const target = S.view === "rubric" ? (S.rubMonth || S.month) : S.month;
      api("/api/_farubric", { method: "POST",
          body: JSON.stringify({ month: target, questions: items }) })
        .then(j => {
          S.msg = "Saved — " + j.questions + " questions, " + fmt1(j.points) + " points"
            + (j.retired && j.retired.length ? " · retired " + j.retired.join(", ") : "");
          S.msgErr = false;
          if (S.view === "rubric") { loadRubricFor(target); return null; }
          return load();
        })
        .catch(e => { S.msg = e.message; S.msgErr = true; paint(); });
    }

    /* THE QUESTIONNAIRE — Ramaz's own screen. He picks the month he is shaping, then adds,
     * removes, renames and re-points questions until they share the 40. A month is editable
     * while it is UNSUBMITTED: submitting freezes the questions along with the ratings, and
     * an admin reopening it unfreezes both. */
    function questionnaireView() {
      const months = (S.rubricMonths || []);
      if (!S.canEditRubric) {
        return '<div class="fa2-empty">The questionnaire is set by logistics management.</div>';
      }
      const m = S.rubMonth || (months.indexOf(S.month) >= 0 ? S.month : months[months.length - 1]);
      const d = S.draft || [];
      const dt = d.reduce((s2, q) => s2 + (+q.points || 0), 0);
      const left = Math.round((MANUAL_TOTAL() - dt) * 10) / 10;
      const balanced = Math.abs(dt - MANUAL_TOTAL()) < 0.05;

      // THE ACTION BAR, STICKY AT THE TOP. His ask (2026-08-08): Undo and Save belong
      // top-right, not at the bottom of a nine-row form where you cannot see whether the
      // points balance without scrolling past everything you just typed.
      let h = '<div class="fa2-qn">'
        + '<div class="fa2-qnact' + (balanced ? " ok" : " bad") + '">'
        + '<div class="run"><b>' + fmt1(dt) + "</b><span>of " + fmt1(MANUAL_TOTAL())
        + " points given out</span></div>"
        + '<div class="fa2-qnbar"><u style="width:'
        + Math.min(100, dt / MANUAL_TOTAL() * 100).toFixed(0) + '%"></u></div>'
        + '<span class="state">' + (balanced ? "balanced"
             : left > 0 ? fmt1(left) + " still to give out"
                        : fmt1(-left) + " too many") + "</span>"
        + '<button class="fa2-ghost" id="fa2RubCancel" style="margin-left:0">Undo changes</button>'
        + '<button class="fa2-go" id="fa2RubSave"' + (balanced ? "" : " disabled")
        + ">Save the questionnaire</button>"
        + "</div>"
        + '<div class="fa2-qnbody">'
        + '<div class="fa2-qnhead">'
        + "<div><h2>The questionnaire</h2>"
        + "<p>These are the questions logistics answers for every foreman, and what each one "
        + "is worth. They always share <b>" + fmt1(MANUAL_TOTAL()) + " points</b> — the other "
        + "60 the warehouse counts on its own. Change them for a month and that month is "
        + "scored the new way; months already submitted keep the questions they were scored "
        + "under.</p></div>"
        + '<div class="fa2-qnmon"><label>Month being shaped</label>'
        + '<select id="fa2QnMonth">'
        + (months.length ? months.slice().reverse().map(x =>
            '<option value="' + x + '"' + (x === m ? " selected" : "") + ">" + monLab(x) + "</option>").join("")
           : '<option value="">nothing open</option>')
        + "</select>"
        + '<span class="hint">' + (months.length
            ? "submitted months are not listed — reopen one to change it"
            : "every month is submitted; reopen one to change its questions") + "</span>"
        + "</div></div>";

      if (!months.length) return h + "</div></div>";

      h += '<div class="fa2-qnlist" id="fa2QnList">' + d.map((q, i) =>
          '<div class="fa2-qnrow' + (q.rated ? " rated" : "") + '" data-row="' + i + '">'
          // ORDER. The grip is what is draggable, not the row: a draggable row swallows
          // click-and-drag inside the text inputs, which is how you select a word. The
          // arrows do the same job from a keyboard and on a touchpad.
          + '<div class="fa2-qnord">'
          + '<span class="fa2-qngrip" draggable="true" data-grip="' + i + '" title="Drag to reorder">⠿</span>'
          + '<div class="n">' + (i + 1) + "</div>"
          + '<button class="fa2-qnmv" data-mv="up" data-i="' + i + '"'
          + (i === 0 ? " disabled" : "") + ' title="Move up">▲</button>'
          + '<button class="fa2-qnmv" data-mv="down" data-i="' + i + '"'
          + (i === d.length - 1 ? " disabled" : "") + ' title="Move down">▼</button>'
          + "</div>"
          + '<div class="f">'
          + '<input class="rbq" data-i="' + i + '" data-k="label" value="' + esc(q.label)
          + '" placeholder="What is being judged, in the rater\'s words">'
          + '<input class="rbd" data-i="' + i + '" data-k="description" value="'
          + esc(q.description || "") + '" placeholder="How to judge it — the rater reads this under the question">'
          + "</div>"
          + '<div class="p"><label>Points <i>max ' + fmt1(MAX_Q_POINTS) + "</i></label>"
          + '<input class="rbp' + ((+q.points || 0) > MAX_Q_POINTS ? " over" : "") + '"'
          + ' type="number" step="0.5" min="0.5" max="' + MAX_Q_POINTS + '" data-i="' + i
          + '" data-k="points" value="' + q.points + '"></div>'
          + '<div class="s"><label>Answered by</label>'
          + '<select class="rbs" data-i="' + i + '" data-k="scale"'
          + (q.rated ? ' disabled title="already rated this month — how it is answered cannot change"' : "") + ">"
          + '<option value="stars5"' + (q.scale === "stars5" ? " selected" : "") + ">★ Stars, 1 to 5</option>"
          + '<option value="bool"' + (q.scale === "bool" ? " selected" : "") + ">Yes or No</option>"
          // KEPT, NOT OFFERED FIRST. His own Long-Distance question is answered this way
          // (N7: no long distance scores nothing, regular scores half, regular and straight
          // scores full). Removing the option would break that question.
          + '<option value="tri"' + (q.scale === "tri" ? " selected" : "") + ">No / Partly / Fully</option>"
          + "</select></div>"
          + '<button class="rbx" data-i="' + i + '" title="Remove this question">Remove</button>'
          + "</div>").join("") + "</div>";

      h += '<div class="fa2-qnfoot">'
        + '<button class="fa2-qnadd" id="fa2RubAdd">+ Add a question</button>'
        + '<span class="hint">Drag the ⠿ handle or use ▲▼ to change the order — that is the '
        + "order the raters see. Removing a question stops it counting from this month on; "
        + "nothing already scored is lost. A question that has already been rated this month "
        + "cannot change how it is answered — add a new one instead.</span>"
        + "</div></div></div>";
      return h;
    }

    function rubricPanel() {
      const qs = QS(), total = qs.reduce((s2, q) => s2 + (+q.Points || 0), 0);
      const editable = S.canEditRubric && (S.rubricMonths || []).indexOf(S.month) >= 0 && !S.locked;

      if (!qs.length) {
        return '<div class="fa2-rub"><div class="fa2-rubh"><b>No rubric for '
          + esc(monLab(S.month)) + "</b>"
          + '<span class="fa2-rubwarn">Nothing can be scored until this month has questions. '
          + "The nightly pipeline seeds it; if this persists, say so.</span></div></div>";
      }

      return '<div class="fa2-rub"><div class="fa2-rubh">'
        + "<b>What is being scored · " + esc(monLab(S.month)) + "</b>"
        + '<span class="fa2-rubt' + (Math.abs(total - MANUAL_TOTAL()) > 0.05 ? " bad" : "") + '">'
        + fmt1(total) + " of " + fmt1(MANUAL_TOTAL()) + " points across "
        + qs.length + " question" + (qs.length === 1 ? "" : "s") + "</span>"
        + (S.canEditRubric
           ? '<button class="fa2-ghost" id="fa2RubEdit">'
             + (editable ? "Edit the questions" : "Open the questionnaire") + "</button>"
           : "")
        + (S.canEditRubric && !editable
           ? '<span class="fa2-rubnote">' + (S.locked
               ? "submitted — reopen this month to change its questions"
               : "this month's questions are fixed") + "</span>" : "")
        + "</div><div class=\"fa2-rublist\">"
        + qs.map(q => '<span class="fa2-rubchip" title="' + esc(q.Description || "") + '">'
            + esc(q.Label) + "<u>" + fmt1(q.Points) + "</u>"
            + (q.Scale === "tri" ? '<i class="tri">3-way</i>' : "") + "</span>").join("")
        + "</div></div>";
    }

    function paint() {
      const months = openMonths();
      if (!months.length) {
        main.innerHTML = '<div class="fa2-empty">The assessment starts with July 2026 — '
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

      const done = all.filter(x => x.full).length;
      const part = all.filter(x => x.answered > 0 && !x.full).length;
      const todo = all.length - done - part;
      const leader = all.filter(x => x.ok && x.total != null)[0];
      const nQual = all.filter(x => x.ok).length;

      let rows = all;
      if (S.tab === "todo") rows = rows.filter(x => x.answered === 0);
      else if (S.tab === "part") rows = rows.filter(x => x.answered > 0 && !x.full);
      else if (S.tab === "done") rows = rows.filter(x => x.full);
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
            + '<span class="tag ' + ((S.locks || {})[m] ? "sub" : isOpenForRating(m) ? "op" : "sub") + '">'
            + ((S.locks || {})[m] ? "✓ submitted" : isOpenForRating(m) ? "open" : "rubric only") + "</span></button>").join("")
        + "</div></div>"
        + '<div><span class="fa2-pill ' + (S.locked ? "sub" : S.notOpen ? "sub" : "open") + '">'
        + (S.locked ? "✓ Submitted — ratings are final" : S.notOpen ? "○ Rubric only — rating opens on the " + OPEN_DAY + "th" : "● Open for rating") + "</span></div></div>"
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
        + "The warehouse already scores four topics — packing per 100 CF (30), reviews (10), "
        + "packing against the sales estimate (10) and complaints upheld (10, less 2.5 for each "
        + "claim upheld against him): <b>60 points</b>. The questions below are yours, sharing "
        + "<b>" + fmt1(MANUAL_TOTAL()) + " points</b> as the rubric above divides them — change "
        + "that and this month changes with it, while months already scored keep theirs. "
        + "A question you have not answered is left "
        + "out of the total and shown as unrated — it is never counted as zero, because a zero "
        + "would say the man was assessed and failed. <b>Who can win:</b> a foreman is ranked "
        + "only once the month has said enough about him — at least five jobs run, and at least "
        + "half the counted score measurable. Everyone else keeps their score and is still "
        + "worth rating; they are simply out of the running. A month opens for rating on its "
        + "own " + OPEN_DAY + "th and closes when you submit it below.</details>";

      // TWO VIEWS, and the second one is the point of the whole rework: Ramaz builds
      // the questionnaire himself. It used to be a small Edit button on a panel that
      // said "cannot be changed" for the month you actually land on, which read as
      // "the questions are hardcoded" — because in practice they were.
      h += '<div class="fa2-views">'
        + '<button class="fa2-view' + (S.view === "rate" ? " on" : "") + '" data-view="rate">Rate foremen</button>'
        + (S.canEditRubric ? '<button class="fa2-view' + (S.view === "rubric" ? " on" : "") + '" data-view="rubric">Questionnaire <i>admin</i></button>' : "")
        + "</div>";
      h += '<div class="fa2-msg' + (S.msg ? (S.msgErr ? " err" : " on") : "") + '">' + esc(S.msg || "") + "</div>";
      if (S.view === "rubric") { main.innerHTML = h + questionnaireView(); wire(); return; }
      h += rubricPanel();

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

      if (!S.locked && !S.notOpen && all.length) {
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
        + (x.ok ? "" : ' · <span class="oor">' + esc(x.why) + "</span>")
        + "</div></div>"
        // TWO HALVES AND A TOTAL. The strip of nine per-question chips is gone: at nine
        // questions it was nine 10px labels nobody read, and he asked for the points and the
        // count instead. What survives is the shape of the score -- what the warehouse
        // measured, what a person judged, and whether that judging is finished.
        + '<div class="fa2-half"><b>' + (x.auto == null ? "—" : fmt1(x.auto))
        + '<u>/' + countedTotal(f) + "</u></b><span>counted by the system</span></div>"
        + '<div class="fa2-half"><b>' + fmt1(x.manual)
        + '<u>/' + fmt1(MANUAL_TOTAL()) + "</u></b><span>"
        + (x.full ? "all " + NQ() + " rated"
           : x.answered ? x.answered + " of " + NQ() + " rated"
           : "nothing rated yet") + "</span></div>"
        + '<div class="fa2-sc"><span class="fa2-sb">'
        + '<u class="a" style="width:' + (x.auto == null ? 0 : x.auto.toFixed(0)) + '%"></u>'
        + '<u class="m" style="width:' + x.manual.toFixed(0) + '%"></u></span>'
        + '<span class="fa2-tot"><b>' + (x.total == null ? "—" : fmt1(x.total)) + "</b>"
        + "<i>" + (x.total == null ? "not measurable" : x.ok ? "of 100" : "not ranked") + "</i></span></div>"
        + "</div>";

      h += '<div class="fa2-body">';
      const cTot = countedTotal(f);
      h += '<div class="fa2-sec">Already counted · <b>' + (x.auto == null ? "—" : fmt1(x.auto))
        + " / " + cTot + "</b>" + (measured != null && measured < cTot
            ? ' <span class="rescale">— only ' + measured + " of the " + cTot
              + " points could be measured, so his score is rescaled to what was measurable</span>" : "")
        + "</div>";
      h += '<div class="fa2-tiles">' + autoFor(f).map(a => {
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

      h += '<div class="fa2-sec">Your assessment · <b>' + fmt1(x.manual) + " / "
        + fmt1(MANUAL_TOTAL()) + "</b>"
        + (S.locked ? ' <span class="rescale">— submitted, final</span>'
           : x.answered && !x.full
             ? ' <span class="rescale">— ' + (NQ() - x.answered) + " still unrated; an "
               + "unanswered question is left out rather than counted as zero, so a part-rated "
               + "man scores below a fully-rated one</span>" : "")
        + "</div>";
      h += '<div class="fa2-qgrid">' + QS().map(q => {
        const cur = x.r[q.Question];
        const stars = cur && cur.Stars != null ? +cur.Stars : null;
        const pts = +q.Points || 0;
        const scale = q.Scale || "stars5";
        const tri = scale === "tri";
        // THE THREE-WAY CONTROL. Its 0 is an ANSWER ("he runs no long distance"), worth no
        // points — not the absence of one, which is what `clear` writes. Buttons are
        // labelled with what they actually pay, so re-pointing the question re-labels them
        // instead of leaving a stale 0 / 2.5 / 5 on screen.
        const control = scale === "bool"
          // YES / NO. Stored as 5 or 0 in the same Stars column as everything else, so the
          // question is worth all of its points or none of them and the mart is none the wiser.
          ? '<div class="fa2-bool">' + [[5, "Yes", "y"], [0, "No", "n"]].map(o => {
              const on = stars != null && Math.abs(stars - o[0]) < 0.01;
              return '<button class="fa2-boolb ' + o[2] + (on ? " on" : "") + '"'
                + ' data-f="' + esc(f.Foreman) + '" data-q="' + esc(q.Question) + '"'
                + ' data-s="' + o[0] + '" data-m="' + S.month + '"'
                + ((S.locked || S.notOpen) ? " disabled" : "") + ">" + o[1] + "</button>";
            }).join("") + "</div>"
          : tri
          ? '<div class="fa2-tri">' + [0, 0.5, 1].map(frac => {
              const st = frac * 5, on = stars != null && Math.abs(stars - st) < 0.01;
              // generic on purpose: the rubric is Ramaz's now, and only HE knows what a
              // three-way question he invented is asking. The question's own text says it.
              const lab = frac === 0 ? "No" : frac === 0.5 ? "Partly" : "Fully";
              return '<button class="fa2-trib' + (on ? " on" : "") + '"'
                + ' data-f="' + esc(f.Foreman) + '" data-q="' + esc(q.Question) + '"'
                + ' data-s="' + st + '" data-m="' + S.month + '"'
                + ((S.locked || S.notOpen) ? " disabled" : "") + ">" + lab
                + '<u>' + fmt1(frac * pts) + "</u></button>";
            }).join("") + "</div>"
          : '<div class="fa2-stars">' + [1, 2, 3, 4, 5].map(n2 =>
              '<button class="fa2-star' + (stars != null && n2 <= stars ? " on" : "") + '"'
              + ' data-f="' + esc(f.Foreman) + '" data-q="' + esc(q.Question) + '" data-s="' + n2 + '"'
              + ' data-m="' + S.month + '"'
              + ((S.locked || S.notOpen) ? " disabled" : "") + ' title="' + n2 + " star" + (n2 === 1 ? "" : "s") + '">★</button>').join("")
            + "</div>";
        return '<div class="fa2-q' + (stars != null ? " rated" : "") + '"><div class="qt">'
          + '<span class="qw">worth ' + fmt1(pts) + "</span>"
          + "<b>" + esc(q.Label) + "</b>"
          + "<span>" + esc(q.Description || "") + "</span>"
          + (cur && cur["Entered By"] ? "<em>" + esc(String(cur["Entered By"]).split("@")[0])
              + " · " + esc(String(cur["Entered At"] || "").slice(0, 10)) + "</em>" : "")
          + "</div>"
          + '<div class="fa2-qfoot">'
          + '<div class="fa2-ctl">' + control
          + (stars != null && !S.locked && !S.notOpen ? '<button class="fa2-clr" data-f="' + esc(f.Foreman)
              + '" data-q="' + esc(q.Question) + '" data-m="' + S.month + '">clear</button>' : "")
          + "</div>"
          + '<div class="fa2-pts' + (stars == null ? " un" : "") + '">'
          + (stars == null ? "not rated" : fmt1(stars / 5 * pts))
          + "<small>" + (stars == null ? "of " + fmt1(pts) : "of " + fmt1(pts) + " earned") + "</small>"
          + "</div></div></div>";
      }).join("") + "</div>";
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
      main.querySelectorAll(".fa2-view").forEach(b => {
        b.onclick = () => {
          if (b.dataset.view === "rubric") { openQuestionnaire(); return; }
          S.view = b.dataset.view; S.msg = "";
          paint();
        };
      });
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
      wireRubric();
      // The three-way control POSTS ITS ZERO. "He runs no long distance" is an answer worth
      // no points, not the absence of one — routing it through the clear path would leave
      // the man showing "8 of 9 rated" for ever and never counting as fully assessed.
      // ...and so does Yes/No: "No" is an answer worth nothing, not a blank.
      main.querySelectorAll(".fa2-trib:not(:disabled), .fa2-boolb:not(:disabled)").forEach(b => {
        b.onclick = e => { e.stopPropagation(); rate(b.dataset.f, b.dataset.q, +b.dataset.s, b.dataset.m); };
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
      const done = all.filter(x => x.full).length;
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
