/* SALES ▸ Estimate Accuracy — zipdispatch's "What Sales Person Estimated vs What Foreman Sold"
   (sales_vs_reality.html), rebuilt on the portal. His ask, 2026-10-06: "i need to have this as a
   new, modified and as better thing in sales page" + "analyze the logic … modernize / optimize and
   improve it a lot".

   FACTS: mart_estimate_accuracy (src/estimate_accuracy.py) — the contract database's own
   vw_job_cf_inventory_summary (the view behind the old sheet tab), one row per pickup job, plus the
   quote→bill gap from mart_estimate_actual. EXCLUSIONS: /api/_eaex (managers/admins only, with a
   reason — his call).

   WHAT CHANGED FROM THE OLD PAGE, and why:
   1. FOUR measures, not three. The old CF view compared the rep's estimate with the REAL cubic feet
      and never used the CF the foreman sold in between, so a miss could not be put on anyone. Here
      CF is a chain: the rep's estimate → what the foreman sold (the rep's accuracy) → what the truck
      took (the foreman's accuracy).
   2. ONE symmetric grade for all four: the ratio actual ÷ estimate, judged by how far it sits from
      ×1 either way (×1.25 and ×0.80 are equally wrong). The old % was capped at −100% one way and
      unbounded the other, and graded time in raw hours (1.5 h over was "normal" on a 3-hour job and
      on a 10-hour one). Bands: within 20% Okay, 20–50% Normal, beyond Problem — the old thresholds.
   3. TIME keeps BILLED hours (labor lifted to the minimum) — his call. Jobs the minimum held up are
      counted and labelled, never hidden. The time miss is SPLIT: how much the extra volume alone
      explains (the rep's side) and what is left (the crew's pace — the foreman's side).
   4. MONEY: every job carries its bill-vs-quote gap, so a person is judged by the surprise they
      caused, not only by how often they missed.
   5. FAIR RANKINGS: each person against the team, small samples pulled toward the team (10-job
      prior) so 3 lucky jobs cannot top the board, and the job count always shown. */
if (window.RS && RS.DATASETS && !RS.DATASETS.estimate_accuracy) {
  RS.DATASETS.estimate_accuracy = {
    table: "mart_estimate_accuracy",
    cols: ["Job Code", "Move Date", "Month", "Job Type", "Customer", "Sales Person", "Sales Person 2",
           "Foreman", "Foreman Nickname", "Crew", "Est Hours", "Labor Hours", "Min Hours", "Billed Hours",
           "Held By Minimum", "Est CF", "Sold CF", "Real CF", "Est Items", "Actual Items",
           "Request #", "Quote $", "Bill $", "Gap $", "Time Gap $", "Packing Gap $", "Other Gap $",
           "Gap Detail", "Sheet URL", "Contract URL"],
    dateCols: {}, defaultDate: null,
  };
}

registerPage({
  id: "estimate-accuracy",
  group: "sales",
  title: "Estimate Accuracy",
  async render(host) {
    const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    const num = v => (v == null || v === "" || isNaN(v) ? null : +v);
    const int = v => Math.round(v).toLocaleString("en-US");
    const money = v => v == null ? "—" : (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
    const sMoney = v => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
    const pc = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
    const median = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q);
      if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
    const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
    const xr = r => r == null ? "—" : "×" + r.toFixed(2);
    const sgnPct = r => r == null ? "—" : (r >= 1 ? "+" : "−") + Math.round(Math.abs(r - 1) * 100) + "%";

    if (!document.getElementById("eac-style")) {
      const st = document.createElement("style");
      st.id = "eac-style";
      st.textContent = [
        ".eac-bar{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        ".eac-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:9px;"
          + "color:var(--ink);padding:8px 12px;font-size:13px;outline:0}",
        ".eac-in:focus{border-color:var(--brand)}",
        ".eac-lead{color:var(--muted);font-size:13px;line-height:1.55;margin:-4px 0 14px;max-width:980px}",
        ".eac-tabs{margin:2px 0 14px}",
        ".eac-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}",
        ".eac-grid>.panel{min-width:0}",
        "@media(max-width:1100px){.eac-grid{grid-template-columns:minmax(0,1fr)}}",
        ".eac-band{display:flex;height:34px;border-radius:7px;overflow:hidden;background:var(--panel-2);margin:6px 0 10px}",
        ".eac-band span{display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;"
          + "min-width:0;overflow:hidden;white-space:nowrap;cursor:pointer}",
        ".eac-ok{background:var(--pos)}.eac-nm{background:var(--warn)}.eac-pr{background:var(--neg)}",
        ".eac-band span.off{opacity:.35}",
        ".eac-cap{font-size:13px;color:var(--muted);line-height:1.55}",
        ".eac-cap b{color:var(--ink)}",
        ".eac-dist{display:grid;grid-template-columns:120px minmax(60px,1fr) 70px;gap:8px;align-items:center;font-size:12.5px;padding:3px 0}",
        ".eac-dist .t{height:12px;background:var(--panel-2);border-radius:4px;overflow:hidden}",
        ".eac-dist .t i{display:block;height:100%;border-radius:4px}",
        ".eac-dist .v{text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}",
        ".eac-div{position:relative;height:14px;background:var(--panel-2);border-radius:4px;min-width:120px}",
        ".eac-div .m{position:absolute;left:50%;top:-2px;bottom:-2px;width:1px;background:var(--muted)}",
        ".eac-div i{position:absolute;top:0;bottom:0;border-radius:3px}",
        ".eac-faint{color:var(--faint)}",
        ".eac-chip{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px;white-space:nowrap}",
        ".eac-chip.ok{background:rgba(22,163,74,.12);color:var(--pos)}",
        ".eac-chip.nm{background:rgba(217,119,6,.13);color:var(--warn)}",
        ".eac-chip.pr{background:rgba(220,38,38,.12);color:var(--neg)}",
        ".eac-chip.na{background:var(--panel-2);color:var(--faint)}",
        ".eac-chip.min{background:var(--panel-2);color:var(--muted);font-weight:600}",
        ".eac-a{color:var(--brand);text-decoration:none;font-weight:600;margin-right:8px;white-space:nowrap}",
        ".eac-a:hover{text-decoration:underline}",
        ".eac-btn{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--muted);"
          + "border-radius:7px;padding:3px 9px;cursor:pointer;white-space:nowrap}",
        ".eac-btn:hover{border-color:var(--neg);color:var(--neg)}",
        ".eac-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px;font-size:12.5px;color:var(--faint)}",
        ".eac-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
        ".eac-note{font-size:12px;color:var(--faint);margin-top:8px;line-height:1.6}",
        ".eac-sort{cursor:pointer;user-select:none;white-space:nowrap}",
        ".eac-sort:hover{color:var(--ink)}",
        "body.rs-app.light.v2 .eac-in{border-radius:999px;border-color:var(--line-2);height:36px;padding:0 14px;background:#FFFFFF}",
        "body.rs-app.light.v2 .eac-note,body.rs-app.light.v2 .eac-faint{font-size:12.5px}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Estimate Accuracy</h1></div>
      <div class="rs-loading" style="padding:22px">Reading the contracts…</div>`;

    const authed = (path, opt) => fetch(ZTZ.API + path, Object.assign({}, opt || {},
      { headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" }, (opt || {}).headers || {}) }))
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }));
    const [raw, exRes] = await Promise.all([RS.load("estimate_accuracy"),
      authed("/api/_eaex").catch(() => ({ rows: [], can_edit: false }))]);

    /* ---------------- rows ---------------- */
    const ROWS = (raw || []).map(r => {
      const d = String(r["Move Date"] || "").slice(0, 10);
      const o = {
        key: String(r["Job Code"] || "") + "|" + d, job: String(r["Job Code"] || ""), date: d,
        type: r["Job Type"] || "—", cust: r["Customer"] || "", rep: r["Sales Person"] || "—",
        fore: r["Foreman"] || "—", crew: num(r["Crew"]),
        estH: num(r["Est Hours"]), labH: num(r["Labor Hours"]), minH: num(r["Min Hours"]), billH: num(r["Billed Hours"]),
        heldMin: +r["Held By Minimum"] === 1,
        estCF: num(r["Est CF"]), soldCF: num(r["Sold CF"]), realCF: num(r["Real CF"]),
        estI: num(r["Est Items"]), actI: num(r["Actual Items"]),
        gap: num(r["Gap $"]), tgap: num(r["Time Gap $"]), pgap: num(r["Packing Gap $"]),
        detail: +r["Gap Detail"] === 1, sheet: r["Sheet URL"] || "", contract: r["Contract URL"] || "",
      };
      return o;
    });
    let EX = {};          // key -> {excluded, reason, by, at}
    const setEx = rows => { EX = {}; (rows || []).forEach(x => { EX[x.job + "|" + x.date] = x; }); };
    setEx(exRes.rows);
    const CAN = !!exRes.can_edit;
    const isEx = r => !!(EX[r.key] && EX[r.key].excluded);

    /* ---------------- the four measures ---------------- */
    const M = {
      items: { label: "Inventory", who: "rep", unit: "items", dp: 0, est: r => r.estI, act: r => r.actI,
        el: "Estimated items", al: "Counted items",
        what: "Items the rep listed against the items the crew counted on the day." },
      cfsale: { label: "CF · rep's estimate", who: "rep", unit: "cf", dp: 0, est: r => r.estCF, act: r => r.soldCF,
        el: "Estimated CF", al: "Sold CF",
        what: "The rep's cubic-feet estimate against what the foreman sold on the day — the rep's accuracy." },
      cffore: { label: "CF · foreman's sold", who: "fore", unit: "cf", dp: 0, est: r => r.soldCF, act: r => r.realCF,
        el: "Sold CF", al: "Real CF",
        what: "What the foreman sold the customer against what the truck actually took — the foreman's accuracy." },
      time: { label: "Time", who: "both", unit: "h", dp: 1, est: r => r.estH, act: r => r.billH,
        el: "Estimated hours", al: "Billed hours",
        what: "The ACT time on the calendar against the hours billed (labor lifted to the job's minimum)." },
    };
    const ratio = (m, r) => { const e = M[m].est(r), a = M[m].act(r); return (e > 0 && a > 0) ? a / e : null; };
    const band = q => q == null ? null : (Math.max(q, 1 / q) < 1.2 ? 0 : Math.max(q, 1 / q) < 1.5 ? 1 : 2);
    const BANDS = [["ok", "Okay", "within 20%"], ["nm", "Normal", "20–50% off"], ["pr", "Problem", "more than 50% off"]];

    /* ---------------- state ---------------- */
    const yr = new Date().getFullYear();
    const S = { from: yr + "-01-01", to: new Date().toLocaleDateString("en-CA"), m: "items",
      reps: new Set(), fores: new Set(), types: new Set(), q: "", band: null,
      view: "measured", sort: "date", dir: -1, page: 0, per: 25 };
    let qTimer = null;

    const base = () => ROWS.filter(r =>
      (!S.from || r.date >= S.from) && (!S.to || r.date <= S.to)
      && (!S.reps.size || S.reps.has(r.rep)) && (!S.fores.size || S.fores.has(r.fore))
      && (!S.types.size || S.types.has(r.type)));

    /* person stats with a 10-job prior toward the team (on the log ratio) */
    const K = 10;
    function groupStats(rows, m, keyFn, teamLog) {
      const g = {};
      rows.forEach(r => { const q = ratio(m, r); if (q == null) return; (g[keyFn(r)] = g[keyFn(r)] || []).push({ r, q }); });
      return Object.entries(g).map(([name, xs]) => {
        // the person's MEDIAN miss (the team figure is a median too -- a mean would be dragged up
        // by the 2x-and-worse tail and put every rep "above the team"), pulled toward the team
        // in proportion to how few jobs they have
        const logs = xs.map(x => Math.log(x.q)), n = xs.length;
        const shr = Math.exp((n * median(logs) + K * teamLog) / (n + K));
        const c = [0, 0, 0]; xs.forEach(x => c[band(x.q)]++);
        const under = xs.filter(x => x.q >= 1.2).length, over = xs.filter(x => x.q <= 1 / 1.2).length;
        const det = xs.filter(x => x.r.detail && x.r.gap != null);
        return { name, n, typical: Math.exp(median(logs)), shrunk: shr, c, under, over,
          gapJob: det.length ? mean(det.map(x => x.r.gap)) : null, detN: det.length };
      });
    }

    function timeSplit(rows) {
      // expected hours for the volume actually moved, at the planned pace = est h × real/est CF
      let vol = 0, pace = 0, n = 0;
      const per = [];
      rows.forEach(r => {
        if (!(r.estH > 0 && r.billH > 0 && r.estCF > 0 && r.realCF > 0)) return;
        const exp = r.estH * Math.min(Math.max(r.realCF / r.estCF, 0.2), 5);
        const v = exp - r.estH, p = r.billH - exp;
        vol += v; pace += p; n++; per.push({ r, v, p });
      });
      return { vol, pace, n, per };
    }

    /* ---------------- paint ---------------- */
    function paint() {
      const all = base();
      const live = all.filter(r => !isEx(r));
      const m = S.m, D = M[m];
      const meas = live.filter(r => ratio(m, r) != null);
      const qs = meas.map(r => ratio(m, r));
      const teamLog = qs.length ? median(qs.map(Math.log)) : 0;
      const c = [0, 0, 0]; qs.forEach(q => c[band(q)]++);
      const under = qs.filter(q => q >= 1.2).length, over = qs.filter(q => q <= 1 / 1.2).length;

      // overview of all four measures
      const ov = Object.keys(M).map(k => {
        const xs = live.map(r => ratio(k, r)).filter(q => q != null);
        const cc = [0, 0, 0]; xs.forEach(q => cc[band(q)]++);
        return { k, n: xs.length, typ: xs.length ? Math.exp(median(xs.map(Math.log))) : null, prob: cc[2],
          under: xs.filter(q => q >= 1.2).length, over: xs.filter(q => q <= 1 / 1.2).length };
      });
      const det = live.filter(r => r.detail && r.gap != null);
      const gapSum = det.reduce((s, r) => s + r.gap, 0), tSum = det.reduce((s, r) => s + (r.tgap || 0), 0);

      const tabs = Object.keys(M).map(k => `<button data-m="${k}" class="${k === m ? "on" : ""}">${esc(M[k].label)}</button>`).join("");
      const bandBar = BANDS.map((b, i) => { const w = qs.length ? c[i] / qs.length * 100 : 0;
        return `<span class="eac-${b[0]}${S.band != null && S.band !== i ? " off" : ""}" data-band="${i}" style="width:${w}%" title="${b[1]} · ${b[2]}: ${c[i]} jobs">${w > 9 ? Math.round(w) + "%" : ""}</span>`; }).join("");

      // distribution of the ratio
      const BK = [["more than 50% below", q => q < 1 / 1.5, "var(--neg)"], ["20–50% below", q => q >= 1 / 1.5 && q < 1 / 1.2, "var(--warn)"],
        ["within 20%", q => q >= 1 / 1.2 && q < 1.2, "var(--pos)"], ["20–50% above", q => q >= 1.2 && q < 1.5, "var(--warn)"],
        ["50–100% above", q => q >= 1.5 && q < 2, "var(--neg)"], ["double or more", q => q >= 2, "var(--neg)"]];
      const bkN = BK.map(b => qs.filter(b[1]).length), bkMax = Math.max(1, ...bkN);
      const dist = BK.map((b, i) => `<div class="eac-dist"><span>${esc(b[0])}</span><span class="t"><i style="width:${bkN[i] / bkMax * 100}%;background:${b[2]}"></i></span><span class="v">${int(bkN[i])} · ${pc(bkN[i], qs.length)}</span></div>`).join("");

      // people
      const repRows = groupStats(meas, m, r => r.rep, teamLog);
      const foreRows = groupStats(meas, m, r => r.fore, teamLog);
      const teamQ = Math.exp(teamLog);
      const peopleTable = (rows, title, sub) => {
        rows = rows.filter(x => x.name !== "—").sort((a, b) => Math.abs(Math.log(b.shrunk)) - Math.abs(Math.log(a.shrunk)) || b.n - a.n);
        if (!rows.length) return "";
        const mx = Math.max(0.05, ...rows.map(x => Math.abs(Math.log(x.shrunk))));
        const body = rows.map(x => {
          const l = Math.log(x.shrunk), w = Math.abs(l) / mx * 50;
          const col = Math.max(x.shrunk, 1 / x.shrunk) < 1.2 ? "var(--pos)" : Math.max(x.shrunk, 1 / x.shrunk) < 1.5 ? "var(--warn)" : "var(--neg)";
          const vsTeam = x.shrunk / teamQ;
          return `<tr class="${x.n < 10 ? "eac-faint" : ""}"><td>${esc(x.name)}</td><td class="num">${int(x.n)}</td>
            <td style="min-width:140px"><div class="eac-div"><span class="m"></span><i style="width:${w}%;${l < 0 ? "right" : "left"}:50%;background:${col}"></i></div></td>
            <td class="num"><b>${sgnPct(x.shrunk)}</b></td>
            <td class="num">${Math.abs(vsTeam - 1) < 0.02 ? "≈ team" : sgnPct(vsTeam)}</td>
            <td class="num">${pc(x.c[2], x.n)}</td><td class="num">${pc(x.under, x.n)} / ${pc(x.over, x.n)}</td>
            <td class="num">${x.detN ? sMoney(x.gapJob) : "—"}</td></tr>`;
        }).join("");
        return `<div class="panel"><div class="panel-head"><div class="panel-title">${esc(title)}</div></div>
          <div class="eac-cap" style="margin-bottom:8px">${sub}</div>
          <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Name</th><th class="num">Jobs</th><th>Typical miss</th>
          <th class="num">Typical</th><th class="num">vs team</th><th class="num">Problem</th><th class="num">Under / over</th><th class="num">Bill vs quote / job</th></tr></thead>
          <tbody>${body}</tbody></table></div>
          <div class="eac-note">Typical = the person's usual actual ÷ estimate, pulled toward the team's (${sgnPct(teamQ)}) when they have few jobs — faint rows have fewer than 10. Under = reality came in 20%+ higher than estimated; over = 20%+ lower. Bill vs quote = the average job's bill minus its quote, where the contract detail exists.</div></div>`;
      };
      const repSub = `Who estimated <b>${esc(D.label.toLowerCase())}</b> closest to reality — sales person 1 on the job.`;
      const foreSub = m === "cffore" ? "Who sold the customer the cubic feet the truck then actually took — foreman 1 on the job."
        : "Foreman 1 on the job.";
      let peopleHtml = "";
      if (D.who === "rep") peopleHtml = peopleTable(repRows, "By sales person", repSub);
      else if (D.who === "fore") peopleHtml = peopleTable(foreRows, "By foreman", foreSub);
      else peopleHtml = `<div class="eac-grid">${peopleTable(repRows, "By sales person", repSub)}${peopleTable(foreRows, "By foreman", "Foreman 1 on the job.")}</div>`;

      // time split
      const hrs = v => (v > 0 ? "+" : v < 0 ? "−" : "") + int(Math.abs(v)) + " h";
      let splitHtml = "";
      if (m === "time") {
        const ts = timeSplit(live);
        const repV = {}, foreP = {};
        ts.per.forEach(x => { (repV[x.r.rep] = repV[x.r.rep] || []).push(x.v); (foreP[x.r.fore] = foreP[x.r.fore] || []).push(x.p); });
        const pace = {};
        live.forEach(r => { if (r.realCF > 0 && r.labH > 0 && r.crew > 0) (pace[r.fore] = pace[r.fore] || []).push(r.realCF / (r.labH * r.crew)); });
        const teamPace = median([].concat(...Object.values(pace)));
        const lst = (o, f) => Object.entries(o).filter(([k, v]) => k !== "—" && v.length >= 10)
          .map(([k, v]) => [k, mean(v), v.length]).sort((a, b) => b[1] - a[1]).slice(0, 8)
          .map(([k, v, n]) => `<tr><td>${esc(k)}</td><td class="num">${(v > 0 ? "+" : "") + v.toFixed(2)} h</td><td class="num">${n}</td>${f ? f(k) : ""}</tr>`).join("");
        splitHtml = `<div class="panel"><div class="panel-head"><div class="panel-title">Why the time ran over</div></div>
          <div class="eac-cap">On ${int(ts.n)} jobs with both volumes and both times: the jobs ran <b>${(ts.vol + ts.pace > 0 ? "+" : "") + (ts.vol + ts.pace).toFixed(0)} hours</b> against the estimate.
          <b>${(ts.vol > 0 ? "+" : "") + ts.vol.toFixed(0)} h</b> is what the extra volume alone would have added at the planned pace (the estimate's side);
          <b>${(ts.pace > 0 ? "+" : "") + ts.pace.toFixed(0)} h</b> is the rest — the crew's pace, the minimum, everything else (the job's side).</div>
          <div class="rs-kpis" style="--kpi-cols:3;margin:10px 0">
            <div class="kpi"><div class="l">From the extra volume</div><div class="v">${hrs(ts.vol)}</div><div class="s">more stuff than estimated, at the planned pace</div></div>
            <div class="kpi"><div class="l">From pace, minimum &amp; the rest</div><div class="v">${hrs(ts.pace)}</div><div class="s">${ts.pace < 0 ? "crews worked faster than the plan assumed" : "crews took longer than the volume explains"}</div></div>
            <div class="kpi"><div class="l">Billed over the estimate</div><div class="v">${hrs(ts.vol + ts.pace)}</div><div class="s">${int(ts.n)} jobs</div></div>
          </div>
          <div class="eac-grid">
            <div><div class="eac-faint" style="margin:6px 0">Extra hours from volume, per job — by sales person</div>
              <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Sales person</th><th class="num">Per job</th><th class="num">Jobs</th></tr></thead><tbody>${lst(repV)}</tbody></table></div></div>
            <div><div class="eac-faint" style="margin:6px 0">Extra hours from pace, per job — by foreman (team pace ${teamPace ? Math.round(teamPace) : "—"} CF per man-hour)</div>
              <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Foreman</th><th class="num">Per job</th><th class="num">Jobs</th><th class="num">CF / man-hour</th></tr></thead><tbody>${lst(foreP, k => `<td class="num">${pace[k] ? Math.round(median(pace[k])) : "—"}</td>`)}</tbody></table></div></div>
          </div>
          <div class="eac-note">Volume part = estimated hours × (real CF ÷ estimated CF) − estimated hours. ${int(live.filter(r => r.heldMin).length)} jobs in view finished faster than their minimum and were billed the minimum — they count at the billed hours, as you chose.</div></div>`;
      }

      // job type
      const byType = {};
      meas.forEach(r => (byType[r.type] = byType[r.type] || []).push(ratio(m, r)));
      const typeHtml = Object.entries(byType).sort((a, b) => b[1].length - a[1].length).map(([t, xs]) => {
        const cc = [0, 0, 0]; xs.forEach(q => cc[band(q)]++);
        return `<tr><td>${esc(t)}</td><td class="num">${int(xs.length)}</td><td class="num">${sgnPct(Math.exp(median(xs.map(Math.log))))}</td>
          <td class="num">${pc(cc[0], xs.length)}</td><td class="num">${pc(cc[1], xs.length)}</td><td class="num">${pc(cc[2], xs.length)}</td></tr>`;
      }).join("");

      // month trend
      const byMonth = {};
      meas.forEach(r => (byMonth[r.date.slice(0, 7)] = byMonth[r.date.slice(0, 7)] || []).push(ratio(m, r)));
      const months = Object.keys(byMonth).sort();
      const trendHtml = months.map(mo => { const xs = byMonth[mo], cc = [0, 0, 0]; xs.forEach(q => cc[band(q)]++);
        const pr = cc[2] / xs.length;
        return `<div class="eac-dist"><span>${esc(mo)}</span><span class="t"><i style="width:${pr * 100}%;background:var(--neg)"></i></span><span class="v">${Math.round(pr * 100)}% · ${xs.length}</span></div>`; }).join("");

      // jobs table
      const missing = all.filter(r => !isEx(r) && ratio(m, r) == null);
      let list = S.view === "excluded" ? all.filter(isEx) : S.view === "missing" ? missing : meas;
      if (S.view === "measured" && S.band != null) list = list.filter(r => band(ratio(m, r)) === S.band);
      if (S.q) { const q = S.q.toLowerCase();
        list = list.filter(r => (r.job + " " + r.cust + " " + r.rep + " " + r.fore).toLowerCase().includes(q)); }
      const acc = { date: r => r.date, job: r => r.job, rep: r => r.rep, fore: r => r.fore,
        est: r => D.est(r), act: r => D.act(r), ratio: r => { const q = ratio(m, r); return q == null ? null : Math.abs(Math.log(q)); },
        gap: r => r.gap };
      const f = acc[S.sort] || acc.date;
      list = list.slice().sort((a, b) => { const x = f(a), y = f(b);
        if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * S.dir; });
      const pages = Math.max(1, Math.ceil(list.length / S.per));
      if (S.page >= pages) S.page = pages - 1;
      const slice = list.slice(S.page * S.per, S.page * S.per + S.per);
      const fmtV = v => v == null ? "—" : (D.dp ? v.toFixed(D.dp) : int(v));
      const th = (k, l, cls) => `<th class="eac-sort ${cls || ""}" data-sort="${k}">${l}${S.sort === k ? (S.dir < 0 ? " ▼" : " ▲") : ""}</th>`;
      const rowsHtml = slice.map(r => {
        const q = ratio(m, r), b = band(q), ex = EX[r.key];
        const chip = b == null ? `<span class="eac-chip na">${D.est(r) > 0 ? "no actual" : "no estimate"}</span>` : `<span class="eac-chip ${BANDS[b][0]}">${BANDS[b][1]}</span>`;
        const act = !CAN ? "" : isEx(r) ? `<button class="eac-btn" data-restore="${esc(r.key)}">Restore</button>` : `<button class="eac-btn" data-exclude="${esc(r.key)}">Exclude</button>`;
        const docs = (r.sheet ? `<a class="eac-a" href="${esc(r.sheet)}" target="_blank" rel="noopener">Sheet</a>` : "")
          + (r.contract ? `<a class="eac-a" href="${esc(r.contract)}" target="_blank" rel="noopener">Contract</a>` : "");
        return `<tr><td><b>${esc(r.job)}</b>${ex && ex.excluded ? `<div class="eac-faint" title="${esc(ex.by + " · " + ex.at)}">${esc(ex.reason)}</div>` : ""}</td>
          <td>${esc(r.date)}</td><td>${esc(r.cust)}</td><td>${esc(r.type)}</td><td>${esc(r.rep)}</td><td>${esc(r.fore)}</td>
          <td class="num">${fmtV(D.est(r))}</td><td class="num">${fmtV(D.act(r))}${m === "time" && r.heldMin ? ` <span class="eac-chip min" title="Worked ${r.labH} h, billed the ${r.minH} h minimum">min</span>` : ""}</td>
          <td class="num">${sgnPct(q)}</td><td>${chip}</td><td class="num">${r.detail ? sMoney(r.gap) : "—"}</td><td>${docs || "—"}</td><td>${act}</td></tr>`;
      }).join("");

      const k = ov.find(x => x.k === m);
      host.innerHTML = `
        <div class="rs-page-head"><h1>Estimate Accuracy</h1></div>
        <div class="eac-lead">How close the estimate came to the job, measured four ways. Every job is graded on <b>actual ÷ estimate</b> —
          within 20% is Okay, 20–50% Normal, further is a Problem, whichever way it misses. From the Digital Contracts (pickup jobs, Zip to Zip, 2026 onward), refreshed hourly.</div>
        <div class="eac-bar" id="eacBar"></div>
        <div class="rs-kpis" style="--kpi-cols:5">
          ${ov.map(x => `<div class="kpi${x.k === m ? " on" : ""}"><div class="l">${esc(M[x.k].label)}</div>
            <div class="v">${sgnPct(x.typ)}</div><div class="s">${int(x.n)} jobs · ${pc(x.prob, x.n)} problem · ${pc(x.under, x.n)} under</div></div>`).join("")}
          <div class="kpi"><div class="l">Bill vs quote</div><div class="v">${sMoney(gapSum)}</div>
            <div class="s">${int(det.length)} jobs · ${sMoney(tSum)} of it time</div></div>
        </div>
        <div class="rs-seg eac-tabs" id="eacTabs">${tabs}</div>
        <div class="eac-grid">
          <div class="panel"><div class="panel-head"><div class="panel-title">${esc(D.label)}</div></div>
            <div class="eac-cap">${esc(D.what)}</div>
            <div class="eac-band" id="eacBand">${bandBar}</div>
            <div class="eac-cap"><b>${int(qs.length)}</b> jobs measured${missing.length ? `, ${int(missing.length)} without both figures` : ""}.
              The typical job came in <b>${sgnPct(k && k.typ)}</b> against the estimate; <b>${pc(under, qs.length)}</b> were under-estimated by 20% or more, <b>${pc(over, qs.length)}</b> over-estimated.
              ${S.band != null ? ` Showing ${BANDS[S.band][1]} jobs below — click the bar again to clear.` : " Click a band to list its jobs."}</div></div>
          <div class="panel"><div class="panel-head"><div class="panel-title">How far off</div></div>${dist}</div>
        </div>
        ${splitHtml}
        ${peopleHtml}
        <div class="eac-grid">
          <div class="panel"><div class="panel-head"><div class="panel-title">By job type</div></div>
            <div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Type</th><th class="num">Jobs</th><th class="num">Typical</th><th class="num">Okay</th><th class="num">Normal</th><th class="num">Problem</th></tr></thead><tbody>${typeHtml}</tbody></table></div></div>
          <div class="panel"><div class="panel-head"><div class="panel-title">Problem share by month</div></div>${trendHtml || '<div class="eac-faint">No measured jobs.</div>'}</div>
        </div>
        <div class="panel" id="eacJobs"><div class="panel-head"><div class="panel-title">Jobs</div>
          <div class="rs-seg" id="eacView" style="margin-left:12px">
            <button data-v="measured" class="${S.view === "measured" ? "on" : ""}">Measured ${int(meas.length)}</button>
            <button data-v="missing" class="${S.view === "missing" ? "on" : ""}">Missing figures ${int(missing.length)}</button>
            <button data-v="excluded" class="${S.view === "excluded" ? "on" : ""}">Excluded ${int(all.filter(isEx).length)}</button></div></div>
          <div class="rs-tablewrap"><table class="rs-table"><thead><tr>${th("job", "Job")}${th("date", "Date")}<th>Customer</th><th>Type</th>${th("rep", "Sales person")}${th("fore", "Foreman")}
            ${th("est", esc(D.el), "num")}${th("act", esc(D.al), "num")}${th("ratio", "Diff", "num")}<th>Grade</th>${th("gap", "Bill vs quote", "num")}<th>Docs</th><th></th></tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="13" class="eac-faint" style="padding:18px">No jobs here.</td></tr>`}</tbody></table></div>
          <div class="eac-pager"><span>${list.length ? int(S.page * S.per + 1) + "–" + int(Math.min(list.length, S.page * S.per + S.per)) + " of " + int(list.length) : "0"}</span>
            <button class="rs-btn" id="eacPrev" ${S.page <= 0 ? "disabled" : ""}>‹ Prev</button><button class="rs-btn" id="eacNext" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button></div>
          ${CAN ? "" : '<div class="eac-note">Only managers can hold a job out of the numbers.</div>'}</div>`;
      mountBar();
      wire();
    }

    function mountBar() {
      const bar = host.querySelector("#eacBar");
      const fld = label => { const w = document.createElement("div"); w.className = "rs-fld"; w.innerHTML = `<span>${label}</span>`; bar.appendChild(w); return w; };
      if (window.RSC && RSC.dateRange) RSC.dateRange(fld("Move dates"), {
        get: () => ({ from: S.from, to: S.to }), set: (f, t) => { S.from = f; S.to = t; }, onChange: () => { S.page = 0; paint(); } });
      const opts = key => { const n = {}; ROWS.forEach(r => { if (r[key] && r[key] !== "—") n[r[key]] = (n[r[key]] || 0) + 1; });
        return Object.entries(n).sort((a, b) => b[1] - a[1]).map(([v, c]) => ({ v, l: v, n: c })); };
      if (window.RSC && RSC.localMulti) {
        RSC.localMulti(fld("Sales person"), { label: "Sales person", values: opts("rep"), selected: S.reps, emptyLabel: "All",
          onChange: s => { S.reps = new Set(s); S.page = 0; paint(); } });
        RSC.localMulti(fld("Foreman"), { label: "Foreman", values: opts("fore"), selected: S.fores, emptyLabel: "All",
          onChange: s => { S.fores = new Set(s); S.page = 0; paint(); } });
        RSC.localMulti(fld("Job type"), { label: "Job type", values: opts("type"), selected: S.types, emptyLabel: "All",
          onChange: s => { S.types = new Set(s); S.page = 0; paint(); } });
      }
      const q = document.createElement("input");
      q.className = "eac-in"; q.placeholder = "find a job, customer, person…"; q.value = S.q; q.style.flex = "0 1 240px";
      q.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = q.value; S.page = 0; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    function wire() {
      host.querySelectorAll("#eacTabs button").forEach(b => b.onclick = () => { S.m = b.dataset.m; S.band = null; S.page = 0; paint(); });
      host.querySelectorAll("#eacBand [data-band]").forEach(b => b.onclick = () => { const i = +b.dataset.band;
        S.band = S.band === i ? null : i; S.view = "measured"; S.page = 0; paint();
        const j = host.querySelector("#eacJobs"); if (j && S.band != null) j.scrollIntoView({ behavior: "smooth", block: "start" }); });
      host.querySelectorAll("#eacView button").forEach(b => b.onclick = () => { S.view = b.dataset.v; S.page = 0; paint(); });
      host.querySelectorAll("[data-sort]").forEach(t => t.onclick = () => { const k = t.dataset.sort;
        if (S.sort === k) S.dir *= -1; else { S.sort = k; S.dir = ["job", "rep", "fore"].includes(k) ? 1 : -1; } S.page = 0; paint(); });
      const pv = host.querySelector("#eacPrev"), nx = host.querySelector("#eacNext");
      if (pv) pv.onclick = () => { S.page--; paint(); };
      if (nx) nx.onclick = () => { S.page++; paint(); };
      host.querySelectorAll("[data-exclude]").forEach(b => b.onclick = async () => {
        const [job, date] = b.dataset.exclude.split("|");
        const reason = await RSC.ask({ title: "Hold " + job + " out of the numbers?",
          body: "It leaves every chart and ranking. Anyone with the page will see who excluded it and why.",
          placeholder: "Why is this job an exception?", yes: "Exclude" });
        if (!reason || !String(reason).trim()) return;
        save(job, date, 1, String(reason).trim());
      });
      host.querySelectorAll("[data-restore]").forEach(b => b.onclick = () => { const [job, date] = b.dataset.restore.split("|"); save(job, date, 0, ""); });
    }

    async function save(job, date, excluded, reason) {
      try {
        const j = await authed("/api/_eaex", { method: "POST", body: JSON.stringify({ job, date, excluded, reason }) });
        setEx(j.rows); paint();
      } catch (e) {
        RSC.notice({ title: "Not saved", body: String(e.message || e) });
      }
    }

    paint();
  },
});
