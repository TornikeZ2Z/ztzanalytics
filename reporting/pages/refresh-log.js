/* ADMIN page: Refresh Log — per-run pipeline timing from meta_refresh_log (/api/_refresh_log).
   Shows the RAW source refresh and the CURATION build for each run, as KPIs + a proportional
   raw/curation split + a stage timeline (gantt) + per-source detail + expandable history.
   Read-only. Registered in Settings; canSee() gates it to admins. Styles use the portal tokens
   (--panel/--ink/--blue/--purple/--brand...), so it follows dark & light themes automatically. */

const RL = (() => {
  const STAGE_LABEL = {
    sharepoint: "SharePoint exports", closing: "Closing sheets", card_expenses: "Card expenses",
    sheets: "Google Sheets", calendar: "Google Calendar", excel: "Reference workbooks",
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
  const tOnly = t => (t ? t.slice(11, 19) : "—");
  const dOnly = t => (t ? t.slice(0, 10) : "—");
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
  return { stLabel, srcLabel, phase, ms, fmtDur, tOnly, dOnly, ago, pill, process };
})();

function rlInjectStyle() {
  if (document.getElementById("rl-style")) return;
  const st = document.createElement("style"); st.id = "rl-style";
  st.textContent = `
  .rl-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
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
  .rl-dot{width:11px;height:11px;border-radius:3px;flex:none}
  .rl-dot.raw{background:var(--blue)} .rl-dot.cur{background:var(--purple)}
  .rl-leg .lk{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}
  .rl-leg .lv{font-size:15px;font-weight:820;color:var(--ink);margin-left:2px;font-variant-numeric:tabular-nums}
  .rl-leg .ls{font-size:11.5px;color:var(--faint);margin-left:4px}
  .rl-split{display:flex;height:16px;border-radius:8px;overflow:hidden;background:var(--panel-2);border:1px solid var(--line)}
  .rl-split .seg{height:100%}
  .rl-split .seg.raw{background:var(--blue)}
  .rl-split .seg.cur{background:var(--purple)}
  .rl-grow{display:grid;grid-template-columns:158px 1fr 66px;align-items:center;gap:12px;padding:4px 0}
  .rl-glabel{font-size:12.5px;color:var(--ink);font-weight:600;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .rl-glabel .ph{display:inline-block;width:7px;height:7px;border-radius:2px;margin-right:6px;vertical-align:middle}
  .rl-gtrack{position:relative;height:16px;background:var(--panel-2);border-radius:5px;overflow:hidden}
  .rl-gbar{position:absolute;top:0;bottom:0;border-radius:5px;min-width:3px}
  .rl-gbar.raw{background:var(--blue)} .rl-gbar.curation{background:var(--purple)}
  .rl-gdur{font-size:12px;font-weight:700;color:var(--muted);text-align:right;font-variant-numeric:tabular-nums}
  .rl-src{display:grid;grid-template-columns:repeat(auto-fill,minmax(188px,1fr));gap:8px}
  .rl-scard{border:1px solid var(--line);border-radius:9px;padding:9px 11px;background:var(--panel-2)}
  .rl-scard.skip{opacity:.5}
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

function rlSources(p) {
  if (!p.sources.length) return `<div style="color:var(--faint);font-size:12.5px;padding:4px 0">No individual source detail for this run.</div>`;
  const cards = p.sources.slice().sort((a, b) => (b.rows || 0) - (a.rows || 0)).map(s => {
    const skip = s.status === "skipped";
    return `<div class="rl-scard ${skip ? "skip" : ""}">
      <div class="rl-sname">${RSC.esc(RL.srcLabel(s))} ${RL.pill(s.status)}</div>
      <div class="rl-smeta"><span>${skip ? "unchanged" : "loaded"}</span><b>${skip ? "—" : RS.fmtN(s.rows || 0) + " rows"}</b></div>
    </div>`;
  }).join("");
  return `<div class="rl-src">${cards}</div>`;
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

function rlRender(host, runs) {
  const procs = runs.map(RL.process);
  const L = procs[0];
  const kpi = (cls, lbl, val, sub) => `<div class="rl-kpi ${cls}"><div class="lbl">${lbl}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`;
  const kpis = `<div class="rl-kpis">
    ${kpi("", "Last refresh", RL.ago(L.run.ended_at || L.run.started_at), "on " + RL.dOnly(L.run.started_at) + " " + RL.tOnly(L.run.started_at))}
    ${kpi("raw", "Raw refresh", RL.fmtDur(L.rawDur), L.nLoaded + " sources loaded")}
    ${kpi("cur", "Curation", RL.fmtDur(L.curDur), "silver layer rebuilt")}
    ${kpi("tot", "Total run", RL.fmtDur(L.total), RSC.esc(L.run.trigger || "") + " · " + (L.run.status === "error" ? "had errors" : "all OK"))}
  </div>`;

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
    <div class="rl-mini-t">Raw sources · ${L.nLoaded} loaded, ${L.nSkipped} unchanged</div>
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
        <div class="rl-mini-t">Raw sources</div>${rlSources(p)}
      </div>
    </div>`;
  };
  const history = procs.length > 1
    ? `<div class="rl-sec">Earlier runs · last ${procs.length - 1}</div>` + procs.slice(1).map((p, i) => rrow(p, i + 1)).join("")
    : "";

  host.innerHTML = kpis + hero + history;
  host.querySelectorAll(".rl-run .rl-rhead").forEach(h => h.onclick = () => h.parentNode.classList.toggle("open"));
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
          <span class="freshness">· read-only · the pipeline runs every 6 hours or on demand</span></p>
      </div>
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
        (every 6 hours, or when a refresh is triggered).</div>`;
      return;
    }
    rlRender(body, runs);
  },
});
