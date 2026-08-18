/* ADMIN page: Refresh Log — per-run pipeline timing from meta_refresh_log (/api/_refresh_log).
   Shows the RAW source refresh and the CURATION build for each run, as KPIs + a proportional
   raw/curation split + a stage timeline (gantt) + per-source detail + expandable history.
   Read-only. Registered in Settings; canSee() gates it to admins. Styles use the portal tokens
   (--panel/--ink/--blue/--purple/--brand...), so it follows dark & light themes automatically. */

const RL = (() => {
  // history pager index (module state so it survives a re-render)
  var hpage = 0;
  const STAGE_LABEL = {
    sharepoint: "SharePoint exports", closing: "Closing sheets", card_expenses: "Card expenses",
    sheets: "Google Sheets", calendar: "Google Calendar", excel: "Reference workbooks",
    ringcentral_api: "RingCentral API",
    curated: "Curation · silver layer", calendar_curated: "Calendar model", money_flow: "Money flow",
    job_overview: "Job overview", lead_call: "Lead calls", ld_planning: "LD planning",
    foreman_closings: "Foreman closings", health: "Health checks",
  };
  const SRC_LABEL = {
    crew_members: "Crew members", vehicles: "Vehicles", reviews: "Reviews data",
    review_counts: "Review counts", review_goals: "Review goals", review_responses: "Review responses",
    negative_reviews: "Negative reviews", claims: "Claims", refunds: "Refunds",
    storage_payments: "Storage payments", storage_items: "Storage items",
    debit_transactions: "Debit transactions", card_transactions: "Card transactions",
    marketing_transactions: "Marketing spend", money_flow_form: "Money-flow forms",
    advance_payment_form: "Advance payments", forman_deduction_form: "Foreman deductions",
    money_flow_exclusions: "Money-flow exclusions", foreman_translator: "Foreman translator",
  };
  const CURATION = new Set(["curated", "calendar_curated", "money_flow", "job_overview",
    "lead_call", "ld_planning", "foreman_closings", "health"]);
  const titleize = s => String(s || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const stLabel = s => STAGE_LABEL[s.step] || titleize(s.step);
  const srcLabel = s => SRC_LABEL[s.step] || titleize(s.step);
  const phase = s => (s.kind === "source" ? "raw" : (CURATION.has(s.step) ? "curation" : "raw"));
  const ms = t => (t ? Date.parse(t.replace(" ", "T") + "Z") : null);
  const fmtDur = sec => {
    if (sec == null) return "—";
    sec = Math.round(sec); if (sec < 60) return sec + "s";
    const m = Math.floor(sec / 60), r = sec % 60; return m + "m" + (r ? " " + r + "s" : "");
  };
  // The pipeline runs on Cloud Run and stores UTC (verified: a run stamped 13:32 was 17:32
  // in Tbilisi). ms() already parses with a "Z", so every time on this page is formatted
  // through Intl in Asia/Tbilisi -- Tornike reads these in Georgian time.
  const TZ = "Asia/Tbilisi";
  const _tz = (t, opts) => {
    const m = ms(t);
    if (m == null || isNaN(m)) return "—";
    return new Intl.DateTimeFormat("en-GB", Object.assign({ timeZone: TZ, hour12: false }, opts))
      .format(new Date(m));
  };
  const tOnly = t => _tz(t, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dOnly = t => { const v = _tz(t, { year: "numeric", month: "2-digit", day: "2-digit" });
    return v === "—" ? v : v.split("/").reverse().join("-"); };
  const ago = t => {
    if (!t) return "—";
    const mn = (Date.now() - ms(t)) / 6e4;
    if (mn < 60) return Math.max(1, Math.round(mn)) + "m ago";
    const h = mn / 60; if (h < 24) return Math.round(h) + "h ago";
    return Math.round(h / 24) + "d ago";
  };
  const pill = st => {
    const c = { ok: "ok", error: "err", skipped: "skip", running: "run" }[st] || "skip";
    const l = { ok: "OK", error: "Error", skipped: "Skipped", running: "Running" }[st] || st;
    return `<span class="rl-pill ${c}">${RSC.esc(l)}</span>`;
  };
  function process(run) {
    const steps = (run.steps || []).map(s => ({ ...s, phase: phase(s), s0: ms(s.started_at), s1: ms(s.ended_at) }));
    const stages = steps.filter(s => s.kind === "stage");
    const sources = steps.filter(s => s.kind === "source");
    const starts = steps.map(s => s.s0).filter(x => x != null);
    const ends = steps.map(s => s.s1).filter(x => x != null);
    const t0 = starts.length ? Math.min.apply(null, starts) : 0;
    const t1 = ends.length ? Math.max.apply(null, ends) : t0 + 1000;
    const span = arr => {
      const a = arr.map(s => s.s0).filter(x => x != null), b = arr.map(s => s.s1).filter(x => x != null);
      return (a.length && b.length) ? [Math.min.apply(null, a), Math.max.apply(null, b)] : null;
    };
    const rawSpan = span(stages.filter(s => s.phase === "raw"));
    const curSpan = span(stages.filter(s => s.phase === "curation"));
    return {
      run, steps, stages, sources, t0, t1, total: (t1 - t0) / 1000,
      rawDur: rawSpan ? (rawSpan[1] - rawSpan[0]) / 1000 : 0,
      curDur: curSpan ? (curSpan[1] - curSpan[0]) / 1000 : 0,
      nLoaded: sources.filter(s => s.status === "ok").length,
      nSkipped: sources.filter(s => s.status === "skipped").length,
      totalRows: sources.filter(s => s.status === "ok").reduce((a, s) => a + (s.rows || 0), 0),
    };
  }
  /* WHERE A FEED COMES FROM. `Kind` is set by src/source_freshness._feeds(); this only
     turns it into a badge, so a new kind shows up as itself rather than being dropped. */
  const ORIGIN = {
    "SharePoint": { label: "SharePoint", cls: "sp" },
    "Google Sheet": { label: "Google Sheet", cls: "gs" },
    "Excel table": { label: "Excel table", cls: "xl" },
    "RingCentral API": { label: "RingCentral API", cls: "api" },
    "Google Calendar": { label: "Google Calendar", cls: "cal" },
  };
  const origin = k => ORIGIN[k] || { label: k || "unknown", cls: "oth" };
  // report id -> the label the Users & Access screen uses, so "used by" reads in the
  // same words as the grant that controls it
  // REPORT_LABELS is a top-level `const` in index.html: a global LEXICAL binding, which
  // is NOT window.REPORT_LABELS (the same trap that silently disabled CONV). Read it bare,
  // guarded by typeof — exactly how index.html:761 reads it.
  const reportLabel = id => (typeof REPORT_LABELS !== "undefined" && REPORT_LABELS[id])
    || String(id || "").replace(/-/g, " ").replace(/\w/g, c => c.toUpperCase());
  return { stLabel, srcLabel, phase, ms, fmtDur, tOnly, dOnly, ago, pill, process, hpage, TZ,
           origin, reportLabel, USED: {}, LIVE: {} };
})();

function rlInjectStyle() {
  if (document.getElementById("rl-style")) return;
  const st = document.createElement("style"); st.id = "rl-style";
  st.textContent = `
  .rl-org{font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid var(--line-2);white-space:nowrap}
  .rl-org.sp{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 45%,transparent)}
  .rl-org.gs{color:var(--brand);border-color:color-mix(in srgb,var(--brand) 45%,transparent)}
  .rl-org.api{color:var(--purple);border-color:color-mix(in srgb,var(--purple) 45%,transparent)}
  .rl-org.xl{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 45%,transparent)}
  .rl-org.portal{color:var(--brand);border-color:color-mix(in srgb,var(--brand) 45%,transparent)}
  .rl-org.cal{color:var(--muted)} .rl-org.oth{color:var(--faint)}
  .rl-mode{font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
  .rl-mode.live{color:var(--brand)} .rl-mode.ref{color:var(--faint)}
  .rl-used{font-size:11.5px;color:var(--muted);max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rl-bar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;margin:2px 0 16px}
  .rl-btn{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 14px;cursor:pointer}
  .rl-btn:hover:not(:disabled){border-color:var(--brand)}
  .rl-btn.primary{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}
  .rl-btn:disabled{opacity:.5;cursor:default}
  .rl-runmsg{font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:7px}
  .rl-dot{width:8px;height:8px;border-radius:50%;background:var(--faint);display:inline-block;flex:none}
  .rl-dot.ok{background:var(--brand)} .rl-dot.warn{background:var(--amber)} .rl-dot.bad{background:var(--red)}
  .rl-dot.run{background:var(--blue);animation:rlpulse 1.1s infinite}
  @keyframes rlpulse{0%,100%{opacity:1}50%{opacity:.25}}
  .rl-alert{background:color-mix(in srgb,var(--red) 8%,var(--panel));border:1px solid color-mix(in srgb,var(--red) 45%,transparent);border-radius:14px;padding:14px 17px;margin-bottom:16px}
  .rl-alert-h{font-weight:800;color:var(--red);font-size:13.5px;margin-bottom:8px}
  .rl-alert-r{font-size:12.5px;color:var(--ink);padding:6px 0;border-top:1px solid var(--line)}
  .rl-alert-d{color:var(--muted);font-family:ui-monospace,monospace;font-size:11.5px}
  .rl-alert-when{font-size:11px;color:var(--faint);margin-top:3px}
  .rl-covgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin:4px 0 2px}
  .rl-cov{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px}
  .rl-cov .lbl{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
  .rl-covsub{font-weight:600;letter-spacing:0;text-transform:none;color:var(--faint)}
  .rl-cov .rng{font-size:14px;font-weight:700;color:var(--ink);margin-top:6px;font-variant-numeric:tabular-nums}
  .rl-cov .rng .arw{color:var(--faint);margin:0 3px}
  .rl-cov .meta{font-size:11.5px;color:var(--muted);margin-top:5px;display:flex;align-items:center;gap:6px}
  .rl-note{font-size:11.5px;color:var(--faint);margin-top:10px}
  .rl-live{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:14px;box-shadow:var(--shadow)}
  .rl-live.on{border-color:var(--blue)}
  .rl-lvhead{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:13.5px;color:var(--ink)}
  .rl-lvsub{font-size:11.5px;color:var(--faint);font-weight:500}
  .rl-lvcount{font-size:11.5px;color:var(--muted);font-variant-numeric:tabular-nums}
  .rl-lvcount .bad{color:var(--neg)}
  .rl-lvpulse{width:9px;height:9px;border-radius:50%;background:var(--line);flex:none}
  .rl-lvpulse.on{background:var(--blue);animation:rllive 1.25s ease-in-out infinite}
  @keyframes rllive{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.8)}}
  @media (prefers-reduced-motion:reduce){.rl-lvpulse.on{animation:none}}
  .rl-lvbar{height:6px;border-radius:99px;background:var(--panel-2);overflow:hidden;margin:11px 0 8px}
  .rl-lvfill{height:100%;background:var(--blue);border-radius:99px;transition:width .5s ease}
  .rl-lvnow{font-size:12.5px;color:var(--ink)}
  .rl-lvlist{margin-top:11px;border-top:1px solid var(--line);padding-top:9px}
  .rl-lvcap{font-size:10.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:6px}
  .rl-lvrow{display:flex;align-items:center;gap:9px;font-size:12px;padding:2.5px 0}
  .rl-lvstep{color:var(--ink);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rl-lvmeta{color:var(--faint);font-variant-numeric:tabular-nums}
  .rl-lvtime{color:var(--faint);font-variant-numeric:tabular-nums;min-width:62px;text-align:right}
  .rl-dot.skip{background:var(--faint)}
  .rl-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 4px 2px;font-size:12.5px;color:var(--muted)}
  .rl-pager b{color:var(--ink);font-variant-numeric:tabular-nums}
  .rl-pgnav{display:flex;align-items:center;gap:9px}
  .rl-pgnav span{font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums;min-width:92px;text-align:center}
  .rl-pgnav button{font:inherit;font-size:12.5px;font-weight:700;background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:9px;padding:7px 14px;cursor:pointer}
  .rl-pgnav button:hover:not(:disabled){border-color:var(--brand)}
  .rl-pgnav button:disabled{opacity:.35;cursor:default}
  /* auto-fit, not a hard 4. The fifth tile (oldest feed) only renders when a feed is actually
     ageing, so a fixed four-column grid left it orphaned across a whole row on its own —
     a lone card the width of the screen, which reads as an error rather than a stat.
     auto-fit collapses the empty tracks, so four cards sit four-up and five sit five-up. */
  .rl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px;margin-bottom:16px}
  @media(max-width:820px){.rl-kpis{grid-template-columns:repeat(2,1fr)}}
  .rl-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow);position:relative;overflow:hidden}
  .rl-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--line-2)}
  .rl-kpi.raw::before{background:var(--blue)} .rl-kpi.cur::before{background:var(--purple)}
  .rl-kpi.tot::before{background:var(--brand)}
  .rl-kpi .lbl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
  .rl-kpi .val{font-size:23px;font-weight:820;color:var(--ink);margin-top:6px;letter-spacing:-.4px;font-variant-numeric:tabular-nums}
  .rl-kpi .sub{font-size:11.5px;color:var(--faint);margin-top:3px}
  .rl-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;box-shadow:var(--shadow);padding:18px 20px;margin-bottom:16px}
  .rl-sec{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:2px 0 13px}
  .rl-hhead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:14px}
  .rl-htitle{font-size:16px;font-weight:800;color:var(--ink)}
  .rl-hsub{font-size:12.5px;color:var(--muted)}
  .rl-htot{margin-left:auto;font-size:12.5px;color:var(--muted)}.rl-htot b{color:var(--ink);font-size:17px;font-weight:820}
  .rl-legend{display:flex;gap:22px;flex-wrap:wrap;margin-bottom:9px}
  .rl-leg{display:flex;align-items:center;gap:8px}
  /* scoped to .rl-leg: unscoped, this second .rl-dot won on source order and turned
     every 8px round status dot on the page into an 11px rounded square. */
  .rl-leg .rl-dot{width:11px;height:11px;border-radius:3px;flex:none}
  .rl-leg .rl-dot.raw{background:var(--blue)} .rl-leg .rl-dot.cur{background:var(--purple)}
  .rl-leg .lk{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .rl-leg .lv{font-size:15px;font-weight:820;color:var(--ink);margin-left:2px;font-variant-numeric:tabular-nums}
  .rl-leg .ls{font-size:11.5px;color:var(--faint);margin-left:4px}
  .rl-split{display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--panel-2);border:1px solid var(--line)}
  .rl-split .seg{height:100%}
  .rl-split .seg.raw{background:var(--blue)}
  .rl-split .seg.cur{background:var(--purple)}
  .rl-gantt{display:flex;flex-direction:column;margin-top:2px}
  .rl-grow{display:grid;grid-template-columns:158px 1fr 66px;align-items:center;gap:12px;padding:4px 0}
  .rl-glabel{font-size:12.5px;color:var(--ink);font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rl-glabel .ph{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .rl-gtrack{position:relative;height:16px;background:var(--panel-2);border-radius:5px;overflow:hidden}
  .rl-gbar{position:absolute;top:0;bottom:0;border-radius:5px;min-width:3px}
  .rl-gbar.raw{background:var(--blue)} .rl-gbar.curation{background:var(--purple)}
  .rl-gdur{font-size:12px;font-weight:700;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
  .rl-src{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:8px}
  .rl-scard{border:1px solid var(--line);border-radius:9px;padding:9px 11px;background:var(--panel-2)}
  .rl-scard.skip{opacity:.55}
  /* the two halves of the page: what a PERSON feeds in, and what the pipeline derives */
  .rl-sgroup{margin-top:16px}
  .rl-sghead{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;padding-bottom:6px;
             border-bottom:1px solid var(--line)}
  .rl-sghead b{font-size:13px;font-weight:800;letter-spacing:-.1px;color:var(--ink)}
  .rl-sghead span{font-size:11.5px;color:var(--faint)}
  .rl-stale{margin-left:auto;font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;
            background:var(--warn-bg);color:var(--warn)}
  /* how long since this feed actually brought something new -- the "did I forget" signal */
  .rl-age{display:inline-block;margin-top:6px;font-size:10px;font-weight:800;letter-spacing:.03em;
          padding:1px 7px;border-radius:999px;background:var(--panel);border:1px solid var(--line);
          color:var(--faint)}
  .rl-age.fresh{color:var(--brand-d);border-color:var(--brand)}
  body.rs-app:not(.light) .rl-age.fresh{color:var(--brand)}
  .rl-age.ok{color:var(--muted)}
  .rl-age.warn{color:var(--warn);border-color:var(--warn)}
  .rl-age.old{color:var(--red);border-color:var(--red);font-weight:800}
  .rl-kpi.stale::before{background:var(--amber)}
  /* the freshness board */
  .rl-fresh-ok{margin-left:auto;font-size:10.5px;font-weight:800;padding:2px 9px;border-radius:999px;
               background:var(--pos-bg);color:var(--pos)}
  .rl-ftab{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:10px}
  .rl-ftab th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.07em;
              text-transform:uppercase;color:var(--faint);padding:6px 10px;
              border-bottom:1px solid var(--line);white-space:nowrap}
  .rl-ftab th.n,.rl-ftab td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
  .rl-ftab td{padding:7px 10px;border-bottom:1px solid var(--line);color:var(--muted)}
  .rl-ftab tr:last-child td{border-bottom:0}
  .rl-ftab td b{color:var(--ink);font-weight:650}
  .rl-fr.old td{background:var(--neg-bg)}
  .rl-fr.warn td{background:var(--warn-bg)}
  .rl-fkind{display:block;font-size:10px;color:var(--faint);margin-top:1px}
  .rl-fnote{display:block;font-size:9.5px;color:var(--faint)}
  .rl-fdet{margin-top:12px}
  .rl-fdet summary{cursor:pointer;font-size:12px;font-weight:700;color:var(--muted);
                   user-select:none;padding:4px 0}
  .rl-fdet[open] summary{margin-bottom:2px}
  .rl-fhelp{font-size:11px;color:var(--faint);line-height:1.6;margin-top:12px;max-width:100ch}
  /* the per-feed reload switch */
  .rl-sw{font-family:inherit;font-size:10px;font-weight:800;letter-spacing:.04em;
         padding:2px 9px;border-radius:999px;cursor:pointer;border:1px solid;background:transparent}
  .rl-sw.on{color:var(--brand-d);border-color:var(--brand)}
  body.rs-app:not(.light) .rl-sw.on{color:var(--brand)}
  .rl-sw.off{color:var(--muted);border-color:var(--line-2);background:var(--panel-2)}
  .rl-sw:hover:not(:disabled){filter:brightness(1.15)}
  .rl-sw:disabled{opacity:.6;cursor:default}
  .rl-fr.paused td{background:var(--panel-2);opacity:.72}
  .rl-fr.paused b{text-decoration:line-through;text-decoration-color:var(--faint)}
  .rl-sname{font-size:12.5px;font-weight:650;color:var(--ink);display:flex;align-items:center;justify-content:space-between;gap:6px}
  .rl-smeta{font-size:11.5px;color:var(--muted);margin-top:4px;display:flex;justify-content:space-between}
  .rl-smeta b{color:var(--ink);font-weight:700;font-variant-numeric:tabular-nums}
  .rl-pill{display:inline-flex;align-items:center;font-size:10.5px;font-weight:800;padding:1px 8px;border-radius:999px;border:1px solid;background:transparent;letter-spacing:.02em}
  .rl-pill.ok{color:var(--brand);border-color:var(--brand)}
  .rl-pill.skip{color:var(--amber);border-color:var(--amber)}
  .rl-pill.err{color:var(--red);border-color:var(--red)}
  .rl-pill.run{color:var(--blue);border-color:var(--blue)}
  .rl-run{background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);margin-bottom:9px;overflow:hidden}
  .rl-rhead{display:flex;align-items:center;gap:13px;padding:12px 16px;cursor:pointer;user-select:none;transition:background .1s}
  .rl-rhead:hover{background:var(--panel-2)}
  .rl-chev{width:15px;height:15px;color:var(--faint);flex:none;transition:transform .15s}
  .rl-run.open .rl-chev{transform:rotate(90deg)}
  .rl-rdate{font-weight:750;color:var(--ink);font-size:13.5px;font-variant-numeric:tabular-nums}
  .rl-rstats{margin-left:auto;display:flex;gap:18px;align-items:center;font-size:12px;color:var(--muted);flex-wrap:wrap}
  .rl-rstats .st b{color:var(--ink);font-weight:750;font-variant-numeric:tabular-nums}
  .rl-rstats .st i{font-style:normal;font-weight:800;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;margin-right:5px}
  .rl-rstats .st.raw i{color:var(--blue)} .rl-rstats .st.cur i{color:var(--purple)}
  .rl-rbody{display:none;padding:2px 16px 16px;border-top:1px solid var(--line)}
  .rl-run.open .rl-rbody{display:block}
  .rl-mini-t{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);margin:14px 0 9px}`;
  document.head.appendChild(st);
}

const CHEV = '<svg class="rl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>';

function rlGantt(p) {
  const span = Math.max(1, p.t1 - p.t0);
  return `<div class="rl-gantt">` + p.stages.map(s => {
    const left = ((s.s0 - p.t0) / span) * 100;
    const w = Math.max(0.7, ((s.s1 - s.s0) / span) * 100);
    return `<div class="rl-grow">
      <div class="rl-glabel"><span class="ph" style="background:var(--${s.phase === "curation" ? "purple" : "blue"})"></span>${RSC.esc(RL.stLabel(s))}</div>
      <div class="rl-gtrack"><div class="rl-gbar ${s.phase}" style="left:${left.toFixed(2)}%;width:${w.toFixed(2)}%"></div></div>
      <div class="rl-gdur">${RL.fmtDur(s.duration_s)}</div>
    </div>`;
  }).join("") + `</div>`;
}

// WHEN DID EACH SOURCE LAST ACTUALLY ARRIVE. Built once from the whole run history: for every
// source, the most recent run in which it LOADED rather than skipped. That is the only signal
// on this page that can answer "did I forget to drop an export" -- a feed nobody has updated
// in three weeks reports unchanged every hour, indistinguishable from a feed where genuinely
// nothing happened, unless somebody dates it.
let RL_LAST = null;
function rlBuildLastLoaded(runs) {
  const out = {};
  runs.forEach(r => {
    (r.steps || []).forEach(x => {
      if (x.kind !== "source" || x.status !== "ok") return;
      const t = x.ended_at || x.started_at;
      if (!t) return;
      if (!out[x.step] || String(t) > String(out[x.step])) out[x.step] = t;
    });
  });
  RL_LAST = out;
}

// Curated tables are DERIVED -- the pipeline rebuilds them from the raw feeds whenever their
// inputs move, so "unchanged" there is the system working, never a person forgetting.
const rlIsCurated = st => /^curated[:_]/i.test(String(st || ""));

function rlDaysAgo(iso) {
  if (!iso) return null;
  const d = new Date(String(iso).replace(" ", "T"));
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function rlSourceCard(s, withAge) {
  const skip = s.status === "skipped";
  let age = "";
  if (withAge) {
    const d = rlDaysAgo((RL_LAST || {})[s.step]);
    // The thresholds are deliberately loose. Some feeds are weekly by nature, so this is a
    // prompt to look, never a verdict -- the tooltip carries the actual date.
    const cls = d == null ? "none" : d <= 2 ? "fresh" : d <= 9 ? "ok" : d <= 20 ? "warn" : "old";
    const lbl = d == null ? "never seen load" : d === 0 ? "today" : d === 1 ? "yesterday" : d + "d ago";
    age = `<span class="rl-age ${cls}" title="last actually loaded: ${
      RSC.esc((RL_LAST || {})[s.step] || "not in this history")}">${lbl}</span>`;
  }
  return `<div class="rl-scard ${skip ? "skip" : ""}">
    <div class="rl-sname">${RSC.esc(RL.srcLabel(s))} ${RL.pill(s.status)}</div>
    <div class="rl-smeta"><span>${skip ? "unchanged" : "loaded"}</span>
      <b>${skip ? "\u2014" : RS.fmtN(s.rows || 0) + " rows"}</b></div>
    ${age}
  </div>`;
}

function rlSources(p) {
  if (!p.sources.length) return `<div style="color:var(--faint);font-size:12.5px;padding:4px 0">No individual source detail for this run.</div>`;
  const all = p.sources.slice().sort((a, b) => (b.rows || 0) - (a.rows || 0));
  const raw = all.filter(s => !rlIsCurated(s.step));
  const cur = all.filter(s => rlIsCurated(s.step));
  const stale = raw.filter(s => { const d = rlDaysAgo((RL_LAST || {})[s.step]); return d != null && d > 20; });

  const block = (title, sub, list, withAge, extra) => !list.length ? "" : `
    <div class="rl-sgroup">
      <div class="rl-sghead"><b>${title}</b><span>${sub}</span>${extra || ""}</div>
      <div class="rl-src">${list.map(s => rlSourceCard(s, withAge)).join("")}</div>
    </div>`;

  const staleChip = stale.length
    ? `<span class="rl-stale">${stale.length} not updated in 3 weeks</span>` : "";
  return block("What we feed it", raw.filter(s => s.status === "ok").length + " loaded · "
               + raw.filter(s => s.status === "skipped").length + " unchanged", raw, true, staleChip)
       + block("What it builds", cur.filter(s => s.status === "ok").length + " rebuilt · "
               + cur.filter(s => s.status === "skipped").length + " already current", cur, false, "");
}

function rlSplit(p) {
  const denom = Math.max(1, p.rawDur + p.curDur);
  const rawPct = (p.rawDur / denom) * 100, curPct = (p.curDur / denom) * 100;
  return `<div class="rl-legend">
      <div class="rl-leg"><span class="rl-dot raw"></span><span><span class="lk">Raw refresh</span><span class="lv">${RL.fmtDur(p.rawDur)}</span><span class="ls">· ${p.nLoaded} loaded, ${p.nSkipped} unchanged</span></span></div>
      <div class="rl-leg"><span class="rl-dot cur"></span><span><span class="lk">Curation</span><span class="lv">${RL.fmtDur(p.curDur)}</span><span class="ls">· silver layer &amp; models</span></span></div>
    </div>
    <div class="rl-split"><div class="seg raw" style="width:${rawPct.toFixed(1)}%"></div><div class="seg cur" style="width:${curPct.toFixed(1)}%"></div></div>`;
}

// ---- data coverage: what the warehouse actually holds right now -----------------
function rlCoverage(cov) {
  if (!cov) return "";
  const S = [
    ["leads", "Leads", "lead journey"], ["jobs", "Jobs", "closing sheets"],
    ["calls", "Calls & SMS", "RingCentral"], ["reviews", "Reviews", "review events"],
  ];
  const cards = S.map(([k, lbl, sub]) => {
    const c = cov[k];
    if (!c) return "";
    const to = String(c.to || "").slice(0, 10), from = String(c.from || "").slice(0, 10);
    // how stale is the newest record?
    let age = "", cls = "";
    if (to) {
      const d = Math.floor((Date.now() - Date.parse(to + "T12:00:00Z")) / 864e5);
      age = d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
      cls = d <= 2 ? "ok" : d <= 7 ? "warn" : "bad";
    }
    return `<div class="rl-cov">
      <div class="lbl">${RSC.esc(lbl)} <span class="rl-covsub">${RSC.esc(sub)}</span></div>
      <div class="rng">${RSC.esc(from || "—")} <span class="arw">→</span> <b>${RSC.esc(to || "—")}</b></div>
      <div class="meta"><span class="rl-dot ${cls}"></span>newest ${RSC.esc(age || "—")} · ${Number(c.rows || 0).toLocaleString()} rows</div>
    </div>`;
  }).join("");
  if (!cards) return "";
  return `<div class="rl-card">
    <div class="rl-hhead"><span class="rl-htitle">Data on hand</span>
      <span class="rl-hsub">what the warehouse currently covers${cov.stamped_at ? " · stamped " + RSC.esc(String(cov.stamped_at).slice(0, 16)) : ""}</span></div>
    <div class="rl-covgrid">${cards}</div>
    <div class="rl-note">First → newest record in each source. "Newest" is how far the data reaches, not when it was loaded — a source can refresh successfully and still have no new records.</div>
  </div>`;
}

/* LIVE PROGRESS. Before this, steps were buffered in memory and written only when the run
   ENDED, so a refresh in flight looked identical to nothing happening (Tornike 2026-07-28:
   "i dont see that it is refreshing or the refresh is in progress"). runlog now writes each
   step as it starts and finishes, so this panel can show what the pipeline is doing right now. */
const RL_STAGE_ORDER = ["sharepoint", "closing", "card_expenses", "sheets", "calendar", "excel",
  "curated", "calendar_curated", "money_flow", "job_overview", "lead_call", "lead_journey",
  "ld_planning", "foreman_closings", "health"];

function rlLiveHtml(st) {
  if (!st || !st.run) return "";
  const r = st.run, live = !!st.running;
  const started = RL.ms(r.started_at);
  const elapsed = started ? Math.max(0, Math.round((Date.now() - started) / 1000)) : null;
  const cur = st.current;
  const done = st.steps_done || 0;
  // progress is indicative: stages are a known list, sources are not, so show BOTH a stage
  // position and a raw completed-step count rather than a fake precise percentage.
  const idx = cur ? RL_STAGE_ORDER.indexOf(cur.step) : -1;
  const pct = live
    ? (idx >= 0 ? Math.round(100 * (idx + 0.5) / RL_STAGE_ORDER.length) : Math.min(96, 6 + done * 1.2))
    : 100;
  const recent = (st.recent || []).slice(0, 6).map(x => {
    const cls = x.status === "error" ? "bad" : x.status === "skipped" ? "skip" : "ok";
    const lbl = x.kind === "source" ? RL.srcLabel(x) : RL.stLabel(x);
    return `<div class="rl-lvrow"><span class="rl-dot ${cls}"></span>
      <span class="rl-lvstep">${RSC.esc(lbl)}</span>
      <span class="rl-lvmeta">${x.rows != null ? RS.fmtN(x.rows) + " rows" : (x.status === "skipped" ? "unchanged" : "")}</span>
      <span class="rl-lvtime">${RL.tOnly(x.ended_at)}</span></div>`;
  }).join("");
  return `<div class="rl-live ${live ? "on" : "off"}">
    <div class="rl-lvhead">
      <span class="rl-lvpulse ${live ? "on" : ""}"></span>
      <b>${live ? "Refresh in progress" : "No refresh running"}</b>
      <span class="rl-lvsub">${live
        ? `started ${RSC.esc(RL.tOnly(r.started_at))} · running ${RL.fmtDur(elapsed)} · ${RSC.esc(r.trigger || "")}`
        : `last run finished ${RSC.esc(RL.tOnly(r.ended_at || r.started_at))} · ${RSC.esc(r.status || "")}`}</span>
      <span style="flex:1"></span>
      <span class="rl-lvcount">${done} step${done === 1 ? "" : "s"} done${st.steps_error ? ` · <b class="bad">${st.steps_error} error</b>` : ""}</span>
    </div>
    ${live ? `<div class="rl-lvbar"><div class="rl-lvfill" style="width:${pct}%"></div></div>
    <div class="rl-lvnow">${cur
      ? `Now: <b>${RSC.esc(cur.kind === "source" ? RL.srcLabel(cur) : RL.stLabel(cur))}</b>
         <span class="rl-lvsub">since ${RSC.esc(RL.tOnly(cur.started_at))}</span>`
      : `<span class="rl-lvsub">starting…</span>`}</div>` : ""}
    ${recent ? `<div class="rl-lvlist"><div class="rl-lvcap">${live ? "Just finished" : "Last steps"}</div>${recent}</div>` : ""}
    <div class="rl-note" style="margin-top:8px">All times Georgian (Tbilisi).</div>
  </div>`;
}

async function rlPollLive(host) {
  const slot = host.querySelector("#rlLive");
  if (!slot) return;                       // page navigated away
  let st = null;
  try { st = await ZTZ.api("/api/_refresh_status"); }
  catch (e) {
    // one failed fetch must not kill the poll chain -- retry on the idle cadence
    clearTimeout(host.__rlTimer);
    host.__rlTimer = setTimeout(() => rlPollLive(host), 15000);
    return;
  }
  if (!host.querySelector("#rlLive")) return;
  slot.innerHTML = rlLiveHtml(st);
  const wasRunning = host.__rlRunning;
  host.__rlRunning = !!(st && st.running);
  if (host.__rlRunning) host.__rlSeenRun = true;
  // "just clicked Run" is not "a run ended": the marker takes a cold start to appear, so the
  // ended-transition only fires once a running marker has actually been OBSERVED (and the
  // awaiting window keeps the fast cadence until it shows up, capped at 90s)
  const awaiting = host.__rlAwait && (Date.now() - host.__rlAwait < 90000) && !host.__rlSeenRun;
  if (host.__rlSeenRun && wasRunning && !host.__rlRunning) {
    try { if (window.RS && RS.refresh) RS.refresh(); await renderPage(); return; } catch (e) {}
  }
  clearTimeout(host.__rlTimer);
  host.__rlTimer = setTimeout(() => rlPollLive(host), (host.__rlRunning || awaiting) ? 4000 : 20000);
}

// WHEN WAS EACH FEED LAST UPDATED UPSTREAM -- the whole point of this page for him.
// The run history reaches back about a day, so it can only ever say "unchanged this hour".
// This reads the SOURCE FILE's own modified date, which is what actually answers "did I
// forget to drop an export". Sorted worst-first, because the stale ones are the reason to
// look at all; anything under a fortnight collapses out of the way.
function rlFreshness(fresh) {
  if (!fresh || !fresh.length) return "";
  const STALE = 21, WATCH = 10;
  const live = fresh.filter(f => !f.paused), off = fresh.filter(f => f.paused);
  const bad = live.filter(f => (f.days_since_file != null) && f.days_since_file >= STALE);
  const watch = live.filter(f => (f.days_since_file != null)
                                 && f.days_since_file >= WATCH && f.days_since_file < STALE);
  const fine = live.filter(f => f.days_since_file == null || f.days_since_file < WATCH);

  const row = f => {
    const d = f.days_since_file;
    const cls = d == null ? "none" : d >= STALE ? "old" : d >= WATCH ? "warn" : "fresh";
    const age = d == null ? "unknown" : d === 0 ? "today" : d === 1 ? "1 day" : d + " days";
    // The file date and the data date are different claims: a re-saved export is fresh by
    // file and stale by contents, and only showing both tells them apart.
    const dd = f.days_since_data;
    // the switch. Admin-only server-side, so a non-admin simply gets told; the button is
    // shown to everyone because knowing a feed is OFF matters more than tidiness
    const sw = `<button class="rl-sw ${f.paused ? "off" : "on"}" data-t="${RSC.esc(f.table)}"
      data-p="${f.paused ? 1 : 0}" title="${f.paused
        ? "Paused — click to start reloading it again"
        : "Reloading every run — click to pause"}">${f.paused ? "paused" : "on"}</button>`;
    // WHERE IT COMES FROM, and whether a person writes it or the pipeline pulls it.
    // `live` wins over the origin badge: a table people type into is current the moment
    // they save, which is a different promise from "reloaded at 09:00".
    const live = RL.LIVE && RL.LIVE[f.table];
    const org = RL.origin(f.kind);
    const users = (RL.USED && RL.USED[f.table]) || [];
    const usedTxt = users.length
      ? users.map(r => RL.reportLabel(r)).join(", ")
      : (live ? "written in the portal" : "—");
    return `<tr class="rl-fr ${f.paused ? "paused" : cls}">
      <td><b>${RSC.esc(f.feed || f.table)}</b><span class="rl-fkind">${RSC.esc(f.table)}${
        f.paused && f.pause_note ? " · " + RSC.esc(f.pause_note) : ""}</span></td>
      <td><span class="rl-org ${org.cls}">${RSC.esc(org.label)}</span></td>
      <td><span class="rl-mode ${live ? "live" : "ref"}" title="${RSC.esc(live || "pulled by the hourly pipeline")}">${
        live ? "live" : "refreshed"}</span></td>
      <td class="rl-used" title="${RSC.esc(usedTxt)}">${RSC.esc(usedTxt)}</td>
      <td class="n">${sw}</td>
      <td class="n"><span class="rl-age ${f.paused ? "none" : cls}">${age}</span></td>
      <td class="n">${RSC.esc(f.file_updated ? String(f.file_updated).slice(0, 10) : "—")}</td>
      <td class="n">${RSC.esc(f.newest_data || "—")}${dd != null && dd > 30
        ? `<span class="rl-fnote">${dd}d of data</span>` : ""}</td>
      <td class="n">${f.rows == null ? "—" : RS.fmtN(f.rows)}</td>
    </tr>`;
  };
  const head = `<thead><tr><th>Feed</th><th>Comes from</th><th>How</th><th>Used by</th>
    <th class="n">Reload</th><th class="n">Last updated</th>
    <th class="n">File date</th><th class="n">Newest row</th><th class="n">Rows</th></tr></thead>`;

  /* LIVE tables have no freshness row and never could: nobody "reloads" them, people
     WRITE them through the portal, so they are current the second someone saves. They
     were invisible on this page, which made the warehouse look entirely file-fed. */
  const liveRows = Object.keys(RL.LIVE || {}).sort().map(t => {
    const users = (RL.USED && RL.USED[t]) || [];
    return `<tr class="rl-fr fresh">
      <td><b>${RSC.esc(RL.LIVE[t])}</b><span class="rl-fkind">${RSC.esc(t)}</span></td>
      <td><span class="rl-org portal">Portal</span></td>
      <td><span class="rl-mode live">live</span></td>
      <td class="rl-used">${RSC.esc(users.map(r => RL.reportLabel(r)).join(", ") || "written in the portal")}</td>
    </tr>`;
  }).join("");
  const liveCard = liveRows ? `<details class="rl-fdet">
      <summary>${Object.keys(RL.LIVE).length} live table${Object.keys(RL.LIVE).length === 1 ? "" : "s"} — written in the portal, never reloaded</summary>
      <table class="rl-ftab"><thead><tr><th>What it is</th><th>Comes from</th><th>How</th><th>Used by</th></tr></thead>
      <tbody>${liveRows}</tbody></table>
      <div class="rl-fhelp">These are not exports. Somebody typing in the portal — a money-flow
        confirmation, a cleanup decision, a questionnaire answer — writes straight to the
        warehouse, so there is nothing to go stale and nothing to pause.</div>
    </details>` : "";

  return `<div class="rl-card">
    <div class="rl-hhead">
      <span class="rl-htitle">Is anything going stale?</span>
      <span class="rl-hsub">when each feed was last updated at the source — not when we last looked</span>
      ${bad.length ? `<span class="rl-stale">${bad.length} over three weeks</span>`
                   : `<span class="rl-fresh-ok">everything current</span>`}
    </div>
    ${bad.length || watch.length ? `<table class="rl-ftab">${head}<tbody>
        ${bad.map(row).join("")}${watch.map(row).join("")}</tbody></table>` : ""}
    ${off.length ? `<details class="rl-fdet">
      <summary>${off.length} feed${off.length === 1 ? "" : "s"} paused — not reloaded at all</summary>
      <table class="rl-ftab">${head}<tbody>${off.map(row).join("")}</tbody></table>
    </details>` : ""}
    <details class="rl-fdet"${bad.length || watch.length ? "" : " open"}>
      <summary>${fine.length} feed${fine.length === 1 ? "" : "s"} updated in the last ${WATCH} days</summary>
      <table class="rl-ftab">${head}<tbody>${fine.map(row).join("")}</tbody></table>
    </details>
    ${liveCard}
    <div class="rl-fhelp">A feed goes amber after ${WATCH} days and red after three weeks.
      Some are meant to sit still — reference tables like zip codes barely change — so this is a
      prompt to look, not a fault. <b>Last updated</b> is the export file's own modified date;
      <b>newest row</b> is the freshest date inside it, which is the one that catches a file
      re-saved without new data. <b>Reload</b> switches a feed off entirely — useful for
      reference tables that never change, like zip codes, which is 42,000 rows of United States
      geography re-read every hour to arrive at the same 42,000 rows. A paused feed keeps its
      data and stops being counted as stale; it is listed separately so it can never be
      mistaken for a live one.</div>
  </div>`;
}

function rlRender(host, runs, cov, fresh) {
  const procs = runs.map(RL.process);
  rlBuildLastLoaded(procs);
  const L = procs[0];
  const kpi = (cls, lbl, val, sub) => `<div class="rl-kpi ${cls}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  const kpis = `<div class="rl-kpis">
    ${kpi("", "Last refresh", RL.ago(L.run.ended_at || L.run.started_at), "on " + RL.dOnly(L.run.started_at) + " " + RL.tOnly(L.run.started_at))}
    ${kpi("raw", "Raw refresh", RL.fmtDur(L.rawDur), L.nLoaded + " sources loaded")}
    ${kpi("cur", "Curation", RL.fmtDur(L.curDur), "silver layer rebuilt")}
    ${kpi("tot", "Total run", RL.fmtDur(L.total), RSC.esc(L.run.trigger || "") + " · " + (L.run.status === "error" ? "had errors" : "all OK"))}
    ${(() => {
      // The same question the board below answers, and it MUST answer it the same way. An
      // earlier version of this tile counted from the run history and said "today" while the
      // board said seventy-nine days -- two numbers, one question, and the smaller one on top.
      if (!fresh || !fresh.length) return "";
      const aged = fresh.filter(f => f.days_since_file != null && !f.paused)
                        .sort((a, b) => b.days_since_file - a.days_since_file);
      if (!aged.length) return "";
      const w = aged[0], stale = aged.filter(f => f.days_since_file >= 21);
      return kpi(stale.length ? "stale" : "", "Oldest feed",
        w.days_since_file === 0 ? "today" : w.days_since_file + "d",
        RSC.esc(w.feed || w.table) + (stale.length > 1
          ? " · " + stale.length + " over three weeks" : ""));
    })()}
  </div>`;

  const freshBoard = rlFreshness(fresh);

  const hero = `<div class="rl-card">
    <div class="rl-hhead">
      <span class="rl-htitle">Latest refresh</span>
      <span class="rl-hsub">${RL.dOnly(L.run.started_at)} · ${RL.tOnly(L.run.started_at)} → ${RL.tOnly(L.run.ended_at)}</span>
      ${RL.pill(L.run.status)}
      <span class="rl-htot">total <b>${RL.fmtDur(L.total)}</b></span>
    </div>
    ${rlSplit(L)}
    <div class="rl-mini-t">Timeline</div>
    ${rlGantt(L)}
    ${rlSources(L)}
  </div>`;

  const rrow = (p, i) => {
    const s = p.run;
    return `<div class="rl-run" data-i="${i}">
      <div class="rl-rhead">${CHEV}
        <span class="rl-rdate">${RL.dOnly(s.started_at)} · ${RL.tOnly(s.started_at)}</span>
        ${RL.pill(s.status)}
        <span class="rl-rstats">
          <span class="st raw"><i>Raw</i><b>${RL.fmtDur(p.rawDur)}</b></span>
          <span class="st cur"><i>Curation</i><b>${RL.fmtDur(p.curDur)}</b></span>
          <span class="st"><i>Total</i><b>${RL.fmtDur(p.total)}</b></span>
        </span>
      </div>
      <div class="rl-rbody">
        ${rlSplit(p)}
        <div class="rl-mini-t">Timeline</div>${rlGantt(p)}
        ${rlSources(p)}
      </div>
    </div>`;
  };
  // Paginated: the run list grows with every refresh (now hourly), and each row carries a
  // full gantt + source grid, so rendering them all makes the page crawl.
  const RPP = 8;
  const rest = procs.slice(1);
  const pages = Math.max(1, Math.ceil(rest.length / RPP));
  if (RL.hpage >= pages) RL.hpage = pages - 1;
  if (RL.hpage < 0) RL.hpage = 0;
  const from = RL.hpage * RPP;
  const slice = rest.slice(from, from + RPP);
  const history = rest.length
    ? `<div class="rl-sec">Earlier runs · ${rest.length}</div>`
      + slice.map((p, i) => rrow(p, from + i + 1)).join("")
      + (pages > 1 ? `<div class="rl-pager">
          <div>Showing <b>${from + 1}–${Math.min(from + RPP, rest.length)}</b> of <b>${rest.length}</b> earlier runs</div>
          <div class="rl-pgnav">
            <button id="rlPrev"${RL.hpage ? "" : " disabled"}>‹ Prev</button>
            <span>Page ${RL.hpage + 1} of ${pages}</span>
            <button id="rlNext"${RL.hpage + 1 < pages ? "" : " disabled"}>Next ›</button>
          </div></div>` : "")
    : "";

  // surface failing steps prominently — an error buried in a per-source row got missed
  const failing = [];
  procs.forEach(p => (p.run.steps || []).forEach(st => {
    if (String(st.status).toLowerCase() === "error")
      failing.push({ run: p.run.started_at, step: st.step, detail: st.detail });
  }));
  // NOT `alert`: this is function-scoped and the pause/resume handler below calls the
  // GLOBAL alert() on its only error path -- shadowed, that call threw instead of reporting.
  let alertHtml = "";
  if (failing.length) {
    const byStep = {};
    failing.forEach(f => { (byStep[f.step] = byStep[f.step] || []).push(f); });
    alertHtml = `<div class="rl-alert">
      <div class="rl-alert-h">⚠ ${failing.length} failed step${failing.length === 1 ? "" : "s"} in the last ${procs.length} runs</div>
      ${Object.entries(byStep).map(([step, list]) => `<div class="rl-alert-r">
        <b>${RSC.esc(RL.srcLabel({ step }))}</b> — failed ${list.length}× ·
        <span class="rl-alert-d">${RSC.esc(list[0].detail || "no detail recorded")}</span>
        <div class="rl-alert-when">${list.map(f => RSC.esc(String(f.run).slice(0, 16))).join(" · ")}</div>
      </div>`).join("")}
    </div>`;
  }
  host.innerHTML = kpis + alertHtml + freshBoard + rlCoverage(cov) + hero + history;
  host.querySelectorAll(".rl-run .rl-rhead").forEach(h => h.onclick = () => h.parentNode.classList.toggle("open"));
  host.querySelectorAll(".rl-sw").forEach(b => {
    b.onclick = async () => {
      const on = b.dataset.p === "1";          // currently paused -> we are turning it back on
      const t = b.dataset.t;
      let note = null;
      if (!on) {
        note = prompt("Pause \"" + t + "\" — it will stop reloading every run.\n"
                      + "Why? (optional, but it helps whoever finds this later)", "");
        if (note === null) return;             // cancelled
      }
      b.disabled = true; b.textContent = "…";
      try {
        const resp = await fetch(ZTZ.API + "/api/_srcswitch", {
          method: "POST",
          headers: { Authorization: "Bearer " + ZTZ.getToken(),
                     "Content-Type": "application/json" },
          body: JSON.stringify({ table: t, paused: !on, note: note || undefined }),
        });
        const j = await resp.json();
        if (!resp.ok || j.error) throw new Error(j.error || ("HTTP " + resp.status));
        // the mart still holds the old flag until the next run, so repaint from the server
        const d = await ZTZ.api("/api/_refresh_log");
        if (d && d.used_by) RL.USED = d.used_by;
        if (d && d.live_tables) RL.LIVE = d.live_tables;
        rlRender(host, (d && d.runs) || runs, d && d.coverage, d && d.freshness);
      } catch (e) {
        b.disabled = false; b.textContent = on ? "paused" : "on";
        alert("Could not change it: " + (e.message || e));
      }
    };
  });
  const pv = host.querySelector("#rlPrev");
  if (pv) pv.onclick = () => { RL.hpage--; rlRender(host, runs, cov, fresh); };
  const nx = host.querySelector("#rlNext");
  if (nx) nx.onclick = () => { RL.hpage++; rlRender(host, runs, cov, fresh); };
}

registerPage({
  id: "refresh-log",
  group: "settings",
  title: "Refresh Log",
  async render(host) {
    rlInjectStyle();
    host.innerHTML = `<div class="rs-page-head">
        <h1>Refresh Log</h1>
        <p>How each data refresh ran — the raw source loads and the curation build, per run.
          <span class="freshness">· the pipeline runs every hour</span></p>
      </div>
      <div class="rl-bar">
        <button class="rl-btn" id="rlReload">↻ Reload this page's data</button>
        <button class="rl-btn primary" id="rlRun">▶ Run a refresh now</button>
        <span class="rl-runmsg" id="rlMsg"></span>
      </div>
      <div id="rlLive"></div>
      <div id="rlBody"><div class="rs-loading" style="padding:26px">Loading refresh history…</div></div>`;
    const body = host.querySelector("#rlBody");
    let data;
    try {
      data = await ZTZ.api("/api/_refresh_log");
    } catch (e) {
      body.innerHTML = `<div class="rl-card" style="color:var(--muted)">Couldn't load the refresh log: ${RSC.esc(e.message || String(e))}</div>`;
      return;
    }
    const runs = (data && data.runs) || [];
    if (!runs.length) {
      body.innerHTML = `<div class="rl-card" style="text-align:center;color:var(--muted);padding:30px">
        No refresh runs recorded yet. This fills in automatically as the pipeline runs
        (every hour, or when a refresh is triggered).</div>`;
      return;
    }
    if (data && data.used_by) RL.USED = data.used_by;
    if (data && data.live_tables) RL.LIVE = data.live_tables;
    rlRender(body, runs, data && data.coverage, data && data.freshness);

    // ---- controls -------------------------------------------------------------
    clearTimeout(host.__rlTimer);
    rlPollLive(host);                       // live progress: paints now, then polls itself
    const msg = host.querySelector("#rlMsg");
    const reload = host.querySelector("#rlReload");
    if (reload) reload.onclick = async () => {
      msg.textContent = "Reloading…";
      try { if (window.RS && RS.refresh) RS.refresh(); await renderPage(); }
      catch (e) { msg.textContent = "Reload failed: " + (e.message || e); }
    };
    const run = host.querySelector("#rlRun");
    if (run) run.onclick = async () => {
      if (!confirm("Start a full data refresh now? It takes about 15 minutes — you can keep using the portal, and the numbers update when it finishes.")) return;
      run.disabled = true;
      msg.innerHTML = `<span class="rl-dot run"></span>Starting…`;
      try {
        // ZTZ.api() is GET-only (it takes just a path), so POST with raw fetch.
        const resp = await fetch(ZTZ.API + "/api/_refresh_run", {
          method: "POST",
          headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
          body: "{}",
        });
        const r = await resp.json();
        msg.innerHTML = r && r.started
          ? `<span class="rl-dot ok"></span>Refresh started — progress is shown below, live.`
          : `<span class="rl-dot bad"></span>${RSC.esc((r && r.error) || "Could not start the refresh.")}`;
        if (r && r.started) {
          // poll fast until the loader publishes its run marker -- but do NOT pretend the run
          // is already visible (the optimistic flag used to trip the "run ended" branch 2.5s
          // after the click, wiping the message and dropping to the idle cadence)
          host.__rlAwait = Date.now();
          host.__rlSeenRun = false;
          clearTimeout(host.__rlTimer);
          setTimeout(() => rlPollLive(host), 2500);
        }
      } catch (e) {
        msg.innerHTML = `<span class="rl-dot bad"></span>${RSC.esc(e.message || String(e))}`;
      }
      setTimeout(() => { run.disabled = false; }, 30000);
    };
  },
});
