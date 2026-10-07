/* SALES ▸ Estimate Accuracy — rebuilt 2026-10-07 around the question the old page never asked:
   WHERE DO CUSTOMERS GET A BIGGER BILL THAN THEY WERE QUOTED, WHY, AND WHO NEEDS COACHING.

   His brief: "i believe it can be 10000 times better - and we just copy pasted what we had … i
   think you know the IDEA of what i am trying to achieve". The evidence that set the shape
   (2026 jobs with a final contract, measured before building):
     · 51% of customers paid 20%+ more than their quote — $1.44M over the quotes, $603 a job;
     · those jobs end in a claim ~3x as often (15% vs 5.5%), ~2x inside every job-size band, and
       the commonest reason on them is "Increased Price";
     · three quarters of the extra is hours, and hours follow the inventory the rep under-counted.
   His calls (MCQ): build it; a SURPRISE = bill 20%+ over the quote; the weekly review list lives
   on the page only (nothing is emailed).

   FACTS: mart_estimate_accuracy (src/estimate_accuracy.py) — the contract system's own
   vw_job_cf_inventory_summary (one row per pickup job), the quote→bill gap with its hours /
   packing / other split (mart_estimate_actual: Moveboard quote, closing-sheet bill), claims and
   negative reviews by request, and the lead's size + type of home. EXCLUSIONS: /api/_eaex
   (managers/admins with a reason; 2 = "the figures are right"). */
if (window.RS && RS.DATASETS) {
  RS.DATASETS.estimate_accuracy = {
    table: "mart_estimate_accuracy",
    cols: ["Job Code", "Move Date", "Job Type", "Customer", "Sales Person", "Foreman", "Crew",
           "Est Hours", "Labor Hours", "Min Hours", "Billed Hours", "Held By Minimum",
           "Est CF", "Sold CF", "Real CF", "Est Items", "Actual Items",
           "Quote $", "Bill $", "Gap $", "Time Gap $", "Packing Gap $", "Other Gap $", "Gap Detail",
           "Claim", "Claim Reason", "Negative Review", "Size of Move", "Move Size", "Home Type", "Size Rank",
           "Sheet URL", "Contract URL"],
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
    const int = v => Math.round(v || 0).toLocaleString("en-US");
    const usd = v => v == null ? "—" : (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
    const usdS = v => v == null ? "—" : (v > 0 ? "+" : v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v)).toLocaleString("en-US");
    const usdK = v => { const a = Math.abs(v || 0), s = v < 0 ? "−$" : "$"; return a >= 1e6 ? s + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? s + Math.round(a / 1e3) + "k" : s + Math.round(a).toLocaleString("en-US"); };
    const pct = (a, b) => b ? Math.round(a / b * 100) : null;
    const pctS = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
    const median = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q);
      if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
    const mean = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
    const sgn = r => r == null ? "—" : (r >= 1 ? "+" : "−") + Math.round(Math.abs(r - 1) * 100) + "%";

    if (!document.getElementById("eav-style")) {
      const st = document.createElement("style");
      st.id = "eav-style";
      st.textContent = [
        ".eav-hero{font-size:20px;font-weight:600;line-height:1.35;margin:2px 0 14px;max-width:1000px;color:var(--ink)}",
        ".eav-hero em{font-style:normal;color:var(--neg)}",
        ".eav-bar{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin:0 0 14px}",
        ".eav-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0}",
        ".eav-g2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-bottom:14px}",
        ".eav-g2>.panel{min-width:0;margin:0}",
        "@media(max-width:1100px){.eav-g2{grid-template-columns:minmax(0,1fr)}}",
        ".eav-note{font-size:12.5px;color:var(--faint);margin-top:8px;line-height:1.55}",
        ".eav-note b{color:var(--ink)}",
        ".eav-wf{display:flex;align-items:flex-end;gap:12px;height:170px;padding:18px 4px 0;border-bottom:1px solid var(--line)}",
        ".eav-wf .c{flex:1;display:flex;flex-direction:column;justify-content:flex-end;height:100%;position:relative}",
        ".eav-wf .c i{display:block;border-radius:4px 4px 0 0;min-height:2px}",
        ".eav-wf .c b{position:absolute;left:0;right:0;text-align:center;font-size:12.5px;font-weight:700;font-variant-numeric:tabular-nums}",
        ".eav-wf-l{display:flex;gap:12px;padding:6px 4px 0}.eav-wf-l span{flex:1;text-align:center;font-size:12px;color:var(--muted)}",
        ".eav-hm{border-collapse:separate;border-spacing:4px;width:100%;font-size:12.5px}",
        ".eav-hm th{font-weight:600;color:var(--faint);font-size:11px;text-transform:uppercase;letter-spacing:.04em;padding:2px 6px;text-align:center}",
        ".eav-hm th.rh{text-align:right;text-transform:none;letter-spacing:0;font-size:12.5px;color:var(--ink)}",
        ".eav-hm td{text-align:center;border-radius:7px;padding:8px 4px;background:var(--panel-2)}",
        ".eav-hm td b{display:block;font-size:14px;font-variant-numeric:tabular-nums}",
        ".eav-hm td small{color:var(--muted);font-size:11px}",
        ".eav-hm td.nil{color:var(--faint)}",
        ".eav-tabs{margin:0 0 12px}",
        ".eav-t{width:100%;border-collapse:collapse;font-size:13px}",
        ".eav-t th{font-size:11.5px;font-weight:600;color:var(--faint);text-align:right;padding:7px 8px;border-bottom:1px solid var(--line);white-space:nowrap}",
        ".eav-t th:first-child,.eav-t td:first-child{text-align:left}",
        ".eav-t td{text-align:right;padding:8px;border-bottom:1px solid var(--line-2);font-variant-numeric:tabular-nums;white-space:nowrap}",
        ".eav-t tr.pp{cursor:pointer}.eav-t tr.pp:hover td{background:var(--panel-2)}",
        ".eav-t tr.on td{background:var(--blue-bg,rgba(37,99,235,.08))}",
        ".eav-t tr.faint td{color:var(--faint)}",
        ".eav-t td.nm{font-weight:600}",
        ".eav-sb{display:inline-flex;align-items:center;gap:8px;justify-content:flex-end}",
        ".eav-sb i{display:inline-block;height:9px;border-radius:3px;background:var(--neg);opacity:.75}",
        ".eav-drv{font-size:11.5px;font-weight:600;border-radius:999px;padding:1px 8px;background:var(--panel-2);border:1px solid var(--line);color:var(--muted)}",
        ".eav-up{color:var(--neg)}.eav-dn{color:var(--pos)}",
        ".eav-dr td{background:var(--panel-2)!important;padding:14px 16px!important;white-space:normal!important;text-align:left!important}",
        ".eav-dg{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:20px}",
        ".eav-dg h4{margin:0 0 6px;font-size:12.5px;color:var(--faint);font-weight:600}",
        ".eav-fact{font-size:13px;line-height:1.9;color:var(--muted)}.eav-fact b{color:var(--ink)}",
        ".eav-jl{width:100%;border-collapse:collapse;font-size:12.5px}",
        ".eav-jl td{padding:5px 6px;border-bottom:1px solid var(--line);white-space:nowrap}",
        ".eav-a{color:var(--brand);text-decoration:none;font-weight:600;margin-right:8px}.eav-a:hover{text-decoration:underline}",
        ".eav-btn{font:inherit;font-size:12px;border:1px solid var(--line);background:var(--panel);color:var(--muted);border-radius:7px;padding:3px 9px;cursor:pointer;white-space:nowrap;margin-left:4px}",
        ".eav-btn:hover{border-color:var(--brand);color:var(--brand)}",
        ".eav-chip{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:999px}",
        ".eav-chip.neg{background:rgba(185,28,28,.1);color:var(--neg)}.eav-chip.pos{background:rgba(21,128,61,.1);color:var(--pos)}",
        ".eav-chip.mut{background:var(--panel-2);color:var(--faint)}",
        ".eav-more summary{cursor:pointer;font-weight:600;color:var(--brand);font-size:13px;margin:4px 0}",
        ".eav-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:10px;font-size:12.5px;color:var(--faint)}",
        ".eav-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
        "body.rs-app.light.v2 .eav-in{border-radius:999px;border-color:var(--line-2);height:36px;padding:0 14px;background:#FFFFFF}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Estimate Accuracy</h1></div><div class="rs-loading" style="padding:22px">Reading the contracts…</div>`;
    const authed = (path, opt) => fetch(ZTZ.API + path, Object.assign({}, opt || {},
      { headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" }, (opt || {}).headers || {}) }))
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || ("HTTP " + r.status)); return j; }));
    const [raw, exRes] = await Promise.all([RS.load("estimate_accuracy"),
      authed("/api/_eaex").catch(() => ({ rows: [], can_edit: false }))]);

    /* ---------------- one row per job ---------------- */
    const ROWS = (raw || []).map(r => {
      const d = String(r["Move Date"] || "").slice(0, 10);
      const q = num(r["Quote $"]), b = num(r["Bill $"]), det = +r["Gap Detail"] === 1 && q > 0 && b > 0;
      const estI = num(r["Est Items"]), actI = num(r["Actual Items"]);
      return {
        key: String(r["Job Code"] || "") + "|" + d, job: String(r["Job Code"] || ""), date: d,
        type: r["Job Type"] || "—", cust: r["Customer"] || "", rep: r["Sales Person"] || "—", fore: r["Foreman"] || "—",
        crew: num(r["Crew"]), estH: num(r["Est Hours"]), labH: num(r["Labor Hours"]), billH: num(r["Billed Hours"]),
        estCF: num(r["Est CF"]), soldCF: num(r["Sold CF"]), realCF: num(r["Real CF"]), estI, actI,
        q, b, det, extra: det ? b - q : null, tg: num(r["Time Gap $"]), pg: num(r["Packing Gap $"]), og: num(r["Other Gap $"]),
        claim: +r["Claim"] === 1, reason: r["Claim Reason"] || "", nrev: +r["Negative Review"] === 1,
        msize: r["Move Size"] || null, htype: r["Home Type"] || null, som: r["Size of Move"] || "",
        sheet: r["Sheet URL"] || "", contract: r["Contract URL"] || "",
      };
    });
    let EX = {};
    const setEx = rows => { EX = {}; (rows || []).forEach(x => { EX[x.job + "|" + x.date] = x; }); };
    setEx(exRes.rows);
    const CAN = !!exRes.can_edit;
    const isEx = r => !!(EX[r.key] && +EX[r.key].excluded === 1);
    const isOk = r => !!(EX[r.key] && +EX[r.key].excluded === 2);
    const SURPRISE = 1.2;                       // his call: a bill 20%+ over the quote
    const surprised = r => r.det && r.b / r.q >= SURPRISE;
    // an item count 5x off either way is far likelier a typo than an estimate: it leaves the
    // inventory figures (not the money) until a manager confirms it ("flag, don't drop")
    const itemsRatio = r => { if (!(r.estI > 0 && r.actI > 0)) return null; const x = r.actI / r.estI;
      return (x > 5 || x < 0.2) && !isOk(r) ? null : x; };
    const cfFore = r => (r.soldCF > 0 && r.realCF > 0) ? r.realCF / r.soldCF : null;

    /* ---------------- state ---------------- */
    const yr = new Date().getFullYear();
    const S = { from: yr + "-01-01", to: new Date().toLocaleDateString("en-CA"), types: new Set(), q: "",
      tab: "sales", open: null, page: 0, per: 25, sort: "date", dir: -1 };
    let qTimer = null;
    const scoped = () => ROWS.filter(r => !isEx(r) && (!S.from || r.date >= S.from) && (!S.to || r.date <= S.to)
      && (!S.types.size || S.types.has(r.type)));

    /* ---------------- figures ---------------- */
    function headline(rs) {
      const det = rs.filter(r => r.det), sur = det.filter(surprised), ok = det.filter(r => !surprised(r));
      const extra = det.reduce((s, r) => s + r.extra, 0);
      const clS = sur.filter(r => r.claim).length, clO = ok.filter(r => r.claim).length;
      const rS = sur.length ? clS / sur.length : null, rO = ok.length ? clO / ok.length : null;
      const reasons = {}; sur.filter(r => r.claim && r.reason).forEach(r => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
      const top = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];
      return { det, sur, extra, rS, rO, clS, top,
        avgQ: mean(det.map(r => r.q)), avgB: mean(det.map(r => r.b)),
        avgT: mean(det.map(r => r.tg || 0)), avgP: mean(det.map(r => r.pg || 0)), avgO: mean(det.map(r => r.og || 0)) };
    }
    function personStats(rs, keyOf, team) {
      const g = {};
      rs.forEach(r => { const k = keyOf(r); if (!k || k === "—") return; (g[k] = g[k] || []).push(r); });
      const cut = new Date(Date.parse(S.to || new Date().toLocaleDateString("en-CA")) - 90 * 864e5).toISOString().slice(0, 10);
      return Object.entries(g).map(([name, xs]) => {
        const det = xs.filter(r => r.det), sur = det.filter(surprised);
        const recent = det.filter(r => r.date >= cut), before = det.filter(r => r.date < cut);
        const tr = recent.length >= 10 && before.length >= 10
          ? pct(recent.filter(surprised).length, recent.length) - pct(before.filter(surprised).length, before.length) : null;
        const ir = xs.map(itemsRatio).filter(x => x != null);
        const cf = xs.map(cfFore).filter(x => x != null);
        const avgT = mean(det.map(r => r.tg || 0)) || 0, avgP = mean(det.map(r => r.pg || 0)) || 0;
        const pace = xs.filter(r => r.realCF > 0 && r.labH > 0 && r.crew > 0).map(r => r.realCF / (r.labH * r.crew));
        const paceH = xs.filter(r => r.estH > 0 && r.billH > 0 && r.estCF > 0 && r.realCF > 0)
          .map(r => r.billH - r.estH * Math.min(Math.max(r.realCF / r.estCF, 0.2), 5));
        return { name, n: xs.length, det: det.length, sur: sur.length, sr: det.length ? sur.length / det.length : null,
          extra: det.length ? mean(det.map(r => r.extra)) : null, driver: avgT >= avgP ? "hours" : "packing", avgT, avgP,
          avgO: mean(det.map(r => r.og || 0)) || 0, items: ir.length ? Math.exp(median(ir.map(Math.log))) : null, irN: ir.length,
          cf: cf.length ? Math.exp(median(cf.map(Math.log))) : null, cfOff: cf.length ? cf.filter(x => Math.max(x, 1 / x) >= SURPRISE).length / cf.length : null,
          pace: median(pace), paceH: mean(paceH), claims: xs.filter(r => r.claim).length, cr: xs.length ? xs.filter(r => r.claim).length / xs.length : null,
          trend: tr, rows: xs };
      });
    }

    /* ---------------- paint ---------------- */
    function paint() {
      const rs = scoped(), H = headline(rs);
      const surPct = pct(H.sur.length, H.det.length);
      const mult = H.rS != null && H.rO ? H.rS / H.rO : null;
      const hero = H.det.length
        ? `${surPct}% of customers paid 20%+ more than they were quoted` + (mult && mult >= 1.3
            ? `, and those jobs end in a claim <em>${mult >= 2.5 ? Math.round(mult) + "×" : mult.toFixed(1) + "×"} as often</em>.` : ".")
        : "No finished contracts in this window yet.";
      let h = `<div class="rs-page-head"><h1>Estimate Accuracy</h1></div><div class="eav-bar" id="eavBar"></div>
        <p class="eav-hero">${hero}</p>
        <div class="rs-kpis" style="--kpi-cols:4">
          <div class="kpi"><div class="l">Billed 20%+ over the quote</div><div class="v">${surPct == null ? "—" : surPct + "%"}</div><div class="s">${int(H.sur.length)} of ${int(H.det.length)} jobs with a final contract</div></div>
          <div class="kpi"><div class="l">Extra over the quotes</div><div class="v">${usdK(H.extra)}</div><div class="s">${H.det.length ? usdS(H.extra / H.det.length) + " a job" : "—"}</div></div>
          <div class="kpi"><div class="l">Claims when billed 20%+ over</div><div class="v" style="color:var(--neg)">${H.rS == null ? "—" : Math.round(H.rS * 1000) / 10 + "%"}</div><div class="s">vs ${H.rO == null ? "—" : Math.round(H.rO * 1000) / 10 + "%"} when within 20%</div></div>
          <div class="kpi"><div class="l">Top claim reason on those jobs</div><div class="v" style="font-size:18px">${esc(H.top ? H.top[0] : "—")}</div><div class="s">${H.top ? int(H.top[1]) + " of " + int(H.clS) + " claims" : "no claims"}</div></div>
        </div>
        <div class="eav-g2">${waterfall(H)}${heatmap(rs)}</div>
        <div class="panel"><div class="rs-seg eav-tabs" id="eavTabs">
          <button data-tab="sales" class="${S.tab === "sales" ? "on" : ""}">Sales people</button>
          <button data-tab="fore" class="${S.tab === "fore" ? "on" : ""}">Foremen</button></div>
          ${S.tab === "sales" ? salesTable(rs, H) : foreTable(rs)}</div>
        ${reviewList(rs)}
        ${allJobs(rs)}`;
      host.innerHTML = h;
      mountBar();
      wire();
    }

    function waterfall(H) {
      if (!H.det.length) return '<div class="panel"><div class="panel-head"><div class="panel-title">Where the extra comes from</div></div><div class="eav-note">No finished contracts in this window.</div></div>';
      const steps = [["Quote", H.avgQ, "base"], ["More hours", H.avgT, "d"], ["Packing", H.avgP, "d"], ["Discounts, fees", H.avgO, "d"], ["Bill", H.avgB, "base"]];
      const top = Math.max(H.avgB, H.avgQ + Math.max(0, H.avgT) + Math.max(0, H.avgP)) * 1.08;
      let run = 0;
      const COL = { base: "#93C5FD", hours: "#F87171", pack: "#FBBF24", other: "#86EFAC" };
      const cols = steps.map(([lab, v, kind], i) => {
        let bottom, hgt, color;
        if (kind === "base") { bottom = 0; hgt = v; color = i === 0 ? COL.base : "var(--brand)"; run = i === 0 ? v : run; }
        else { bottom = v >= 0 ? run : run + v; hgt = Math.abs(v); run += v; color = i === 1 ? COL.hours : i === 2 ? COL.pack : COL.other; }
        const pb = bottom / top * 100, ph = Math.max(1, hgt / top * 100);
        const label = kind === "base" ? usd(v) : usdS(v);
        return `<div class="c"><b style="bottom:calc(${(pb + ph).toFixed(1)}% + 4px)">${label}</b><i style="height:${ph.toFixed(1)}%;margin-bottom:${pb.toFixed(1)}%;background:${color}"></i></div>`;
      }).join("");
      const share = H.avgB - H.avgQ > 0 ? Math.round(Math.max(0, H.avgT) / (H.avgB - H.avgQ) * 100) : null;
      return `<div class="panel"><div class="panel-head"><div class="panel-title">Where the extra comes from</div><span class="rt">the average job</span></div>
        <div class="eav-wf">${cols}</div><div class="eav-wf-l">${steps.map(s => "<span>" + s[0] + "</span>").join("")}</div>
        <div class="eav-note">${share != null ? "<b>" + share + "% of the extra is hours</b> — the crew needed more time than was sold, mostly because there was more to move than the rep listed. " : ""}Quote from Moveboard, bill from the closing sheet.</div></div>`;
    }

    function heatmap(rs) {
      const SIZES = ["Studio", "1 BR", "2 BR", "3 BR", "4+ BR"], TYPES = ["Apartment / condo", "House / townhouse"];
      const cell = {};
      rs.forEach(r => { if (!r.msize || !TYPES.includes(r.htype)) return; const k = r.msize + "|" + r.htype; (cell[k] = cell[k] || []).push(r); });
      const allIr = rs.map(itemsRatio).filter(x => x != null), team = allIr.length ? Math.exp(median(allIr.map(Math.log))) : 1;
      const color = x => { const d = Math.log(x) - Math.log(team); return d > 0.12 ? "rgba(220,38,38,.22)" : d > 0.04 ? "rgba(245,158,11,.22)" : d < -0.04 ? "rgba(22,163,74,.16)" : "var(--panel-2)"; };
      const body = SIZES.map(sz => '<tr><th class="rh">' + sz + "</th>" + TYPES.map(ty => {
        const xs = cell[sz + "|" + ty] || [], ir = xs.map(itemsRatio).filter(x => x != null);
        if (ir.length < 8) return '<td class="nil">—</td>';
        const m = Math.exp(median(ir.map(Math.log))), det = xs.filter(r => r.det);
        return `<td style="background:${color(m)}" title="${ir.length} jobs"><b>${sgn(m)}</b><small>${det.length ? pctS(det.filter(surprised).length, det.length) + " billed 20%+ over" : ""}</small></td>`;
      }).join("") + "</tr>").join("");
      return `<div class="panel"><div class="panel-head"><div class="panel-title">Where estimates break</div><span class="rt">items counted vs listed, typical job</span></div>
        <table class="eav-hm"><thead><tr><th></th>${TYPES.map(t => "<th>" + t + "</th>").join("")}</tr></thead><tbody>${body}</tbody></table>
        <div class="eav-note">Team typical: <b>${sgn(team)}</b> more items than listed. Red = worse than the team, green = better. Cells need 8+ jobs.</div></div>`;
    }

    function salesTable(rs, H) {
      const team = H.det.length ? H.sur.length / H.det.length : null;
      const ps = personStats(rs, r => r.rep).filter(p => p.det >= 5).sort((a, b) => (b.sr || 0) - (a.sr || 0) || b.det - a.det);
      if (!ps.length) return '<div class="eav-note">No sales person has 5+ finished contracts in this window.</div>';
      const mx = Math.max(...ps.map(p => p.sr || 0), 0.01);
      const body = ps.map(p => {
        const on = S.open === "r:" + p.name;
        const tr = p.trend == null ? "<span style=\"color:var(--faint)\">—</span>" : Math.abs(p.trend) < 3 ? "≈" : `<span class="${p.trend > 0 ? "eav-up" : "eav-dn"}">${p.trend > 0 ? "▲" : "▼"} ${Math.abs(p.trend)} pts</span>`;
        return `<tr class="pp${on ? " on" : ""}${p.det < 20 ? " faint" : ""}" data-open="r:${esc(p.name)}"><td class="nm">${esc(p.name)}</td><td>${int(p.det)}</td>
          <td><span class="eav-sb"><i style="width:${((p.sr || 0) / mx * 70).toFixed(0)}px"></i>${pctS(p.sur, p.det)}</span></td>
          <td>${usdS(p.extra)}</td><td><span class="eav-drv">${p.driver}</span></td><td>${p.items ? sgn(p.items) : "—"}</td>
          <td class="${p.cr != null && H.rO != null && p.cr > (H.rS + H.rO) / 2 ? "eav-up" : ""}">${p.cr == null ? "—" : (Math.round(p.cr * 1000) / 10) + "%"}</td><td>${tr}</td></tr>`
          + (on ? `<tr class="eav-dr"><td colspan="8">${drill(p, rs, "rep")}</td></tr>` : "");
      }).join("");
      return `<table class="eav-t"><thead><tr><th>Sales person</th><th>Jobs</th><th>Billed 20%+ over</th><th>Extra / job</th><th>Main driver</th><th>Items vs listed</th><th>Claims</th><th>Last 90 days</th></tr></thead><tbody>${body}</tbody></table>
        <div class="eav-note">Team: <b>${team == null ? "—" : Math.round(team * 100) + "%"}</b> billed 20%+ over, <b>${H.det.length ? usdS(H.extra / H.det.length) : "—"}</b> extra a job. Jobs = finished contracts; faint rows have fewer than 20. "Last 90 days" = change in the 20%+ share against the rest of the window. Click a person for their pattern.</div>`;
    }

    function foreTable(rs) {
      const ps = personStats(rs, r => r.fore).filter(p => p.n >= 10).sort((a, b) => (b.cfOff || 0) - (a.cfOff || 0) || b.n - a.n);
      if (!ps.length) return '<div class="eav-note">No foreman has 10+ jobs in this window.</div>';
      const body = ps.map(p => {
        const on = S.open === "f:" + p.name;
        return `<tr class="pp${on ? " on" : ""}" data-open="f:${esc(p.name)}"><td class="nm">${esc(p.name)}</td><td>${int(p.n)}</td>
          <td>${p.cf ? sgn(p.cf) : "—"}</td><td>${p.cfOff == null ? "—" : Math.round(p.cfOff * 100) + "%"}</td>
          <td>${p.pace ? Math.round(p.pace) : "—"}</td><td>${p.paceH == null ? "—" : (p.paceH > 0 ? "+" : "") + p.paceH.toFixed(1) + " h"}</td>
          <td>${p.cr == null ? "—" : (Math.round(p.cr * 1000) / 10) + "%"}</td></tr>`
          + (on ? `<tr class="eav-dr"><td colspan="7">${drill(p, rs, "fore")}</td></tr>` : "");
      }).join("");
      return `<table class="eav-t"><thead><tr><th>Foreman</th><th>Jobs</th><th>Truck vs sold CF</th><th>CF off 20%+</th><th>CF per man-hour</th><th>Hours vs plan</th><th>Claims</th></tr></thead><tbody>${body}</tbody></table>
        <div class="eav-note">"Truck vs sold CF" = what the truck took against what the foreman sold the customer on the day. "Hours vs plan" = hours billed beyond what the actual volume needed at the planned pace — the crew's side of the overrun. Click a foreman for the jobs.</div>`;
    }

    function drill(p, rs, who) {
      const xs = p.rows;
      let facts;
      if (who === "rep") {
        const allIr = rs.map(itemsRatio).filter(x => x != null), team = allIr.length ? Math.exp(median(allIr.map(Math.log))) : null;
        const cells = {};
        xs.forEach(r => { if (!r.msize || !r.htype) return; const k = r.msize + " " + (r.htype === "House / townhouse" ? "house" : "apartment"); const x = itemsRatio(r); if (x == null) return; (cells[k] = cells[k] || []).push(x); });
        const worst = Object.entries(cells).filter(([, v]) => v.length >= 5).map(([k, v]) => [k, Math.exp(median(v.map(Math.log))), v.length]).sort((a, b) => b[1] - a[1])[0];
        const reasons = {}; xs.filter(r => r.claim && r.reason).forEach(r => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
        const topR = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => esc(k) + " " + v).join(" · ");
        facts = `Lists <b>${p.items ? sgn(p.items) : "—"}</b> fewer items than the crew counts on a typical job${team ? " (team " + sgn(team) + ")" : ""}<br>`
          + (worst ? `Misses most on <b>${esc(worst[0])}</b>: ${sgn(worst[1])} (${worst[2]} jobs)<br>` : "")
          + `Customers paid <b>${usdS(p.extra)}</b> over the quote a job: ${usdS(p.avgT)} hours, ${usdS(p.avgP)} packing, ${usdS(p.avgO)} other<br>`
          + `<b>${int(p.claims)}</b> claims on ${int(p.n)} jobs${topR ? " — " + topR : ""}`;
      } else {
        facts = `The truck took <b>${p.cf ? sgn(p.cf) : "—"}</b> against the CF he sold on a typical job; ${p.cfOff == null ? "—" : Math.round(p.cfOff * 100) + "%"} of jobs off by 20%+<br>`
          + `Crew pace <b>${p.pace ? Math.round(p.pace) : "—"}</b> CF per man-hour; ${p.paceH == null ? "—" : (p.paceH > 0 ? "+" : "") + p.paceH.toFixed(1) + " h"} a job against the plan for the volume moved<br>`
          + `<b>${int(p.claims)}</b> claims on ${int(p.n)} jobs`;
      }
      const worstJobs = xs.slice().sort((a, b) => who === "rep"
        ? ((b.extra || 0) - (a.extra || 0)) || ((itemsRatio(b) || 1) - (itemsRatio(a) || 1))
        : Math.abs(Math.log(cfFore(b) || 1)) - Math.abs(Math.log(cfFore(a) || 1))).slice(0, 8);
      const jl = worstJobs.map(r => `<tr><td><b>${esc(r.job)}</b></td><td>${esc(r.date.slice(5))}</td><td>${esc(r.cust)}</td>
        <td>${who === "rep" ? (r.estI ? int(r.estI) + " → " + int(r.actI) + " items" : "—") : (r.soldCF ? int(r.soldCF) + " → " + int(r.realCF) + " CF" : "—")}</td>
        <td>${r.det ? usdS(r.extra) : "—"}</td><td>${r.claim ? '<span class="eav-chip neg">claim</span>' : ""}</td>
        <td>${r.contract ? `<a class="eav-a" href="${esc(r.contract)}" target="_blank" rel="noopener">Contract</a>` : ""}${r.sheet ? `<a class="eav-a" href="${esc(r.sheet)}" target="_blank" rel="noopener">Sheet</a>` : ""}</td></tr>`).join("");
      return `<div class="eav-dg"><div><h4>Pattern</h4><div class="eav-fact">${facts}</div></div>
        <div><h4>${who === "rep" ? "Biggest surprises" : "Biggest CF misses"}</h4><table class="eav-jl">${jl}</table></div></div>`;
    }

    function reviewList(rs) {
      const last = rs.reduce((m, r) => r.date > m ? r.date : m, "");
      if (!last) return "";
      const from = new Date(Date.parse(last) - 6 * 864e5).toISOString().slice(0, 10);
      const xs = rs.filter(r => r.date >= from && !isOk(r) && (surprised(r) || (itemsRatio(r) || 0) >= 1.5 || (r.estI > 0 && r.actI > 0 && itemsRatio(r) == null)))
        .sort((a, b) => ((b.extra || 0) - (a.extra || 0)) || ((itemsRatio(b) || 9) - (itemsRatio(a) || 9))).slice(0, 15);
      const rows = xs.map(r => {
        const ir = r.estI > 0 && r.actI > 0 ? r.actI / r.estI : null, typo = ir != null && itemsRatio(r) == null;
        return `<tr><td><b>${esc(r.job)}</b></td><td>${esc(r.date.slice(5))}</td><td>${esc(r.rep)}</td><td>${esc(r.cust)}</td>
          <td>${r.estI ? int(r.estI) + " → " + int(r.actI) + " items" : "—"}${typo ? ' <span class="eav-chip mut">check figures</span>' : ""}</td>
          <td>${r.det ? usd(r.q) + " → " + usd(r.b) : '<span style="color:var(--faint)">no final bill yet</span>'}</td>
          <td>${r.det ? `<b class="eav-up">${usdS(r.extra)}</b>` : ""}</td><td>${r.claim ? '<span class="eav-chip neg">claim</span>' : ""}</td>
          <td>${r.contract ? `<a class="eav-a" href="${esc(r.contract)}" target="_blank" rel="noopener">Contract</a>` : ""}${CAN ? (typo ? `<button class="eav-btn" data-okfig="${esc(r.key)}">Figures right</button>` : "") + `<button class="eav-btn" data-exclude="${esc(r.key)}">Exclude</button>` : ""}</td></tr>`;
      }).join("");
      return `<div class="panel" style="margin-top:14px"><div class="panel-head"><div class="panel-title">This week's review list</div><span class="rt">moves ${esc(from.slice(5))} – ${esc(last.slice(5))} · biggest surprises first</span></div>
        ${rows ? `<table class="eav-t"><tbody>${rows}</tbody></table>` : '<div class="eav-note">No surprises in the last week of moves.</div>'}
        <div class="eav-note">Jobs billed 20%+ over the quote, or with 50%+ more items than listed. "Check figures" = an item count 5× off, held out of the numbers until someone confirms it.${CAN ? "" : " Only managers can exclude a job."}</div></div>`;
    }

    function allJobs(rs) {
      let list = rs.slice();
      if (S.q) { const q = S.q.toLowerCase(); list = list.filter(r => (r.job + " " + r.cust + " " + r.rep + " " + r.fore).toLowerCase().includes(q)); }
      const acc = { date: r => r.date, extra: r => r.extra, items: r => { const x = itemsRatio(r); return x == null ? null : Math.abs(Math.log(x)); } };
      const f = acc[S.sort] || acc.date;
      list.sort((a, b) => { const x = f(a), y = f(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * S.dir; });
      const pages = Math.max(1, Math.ceil(list.length / S.per)); if (S.page >= pages) S.page = pages - 1;
      const th = (k, l) => `<th class="eav-sort" data-sort="${k}" style="cursor:pointer">${l}${S.sort === k ? (S.dir < 0 ? " ▼" : " ▲") : ""}</th>`;
      const rows = list.slice(S.page * S.per, S.page * S.per + S.per).map(r => `<tr><td><b>${esc(r.job)}</b></td><td>${esc(r.date)}</td><td>${esc(r.cust)}</td>
        <td>${esc(r.rep)}</td><td>${esc(r.fore)}</td><td>${esc(r.som || "—")}</td>
        <td>${r.estI ? int(r.estI) + " → " + int(r.actI) : "—"}</td><td>${r.estCF ? int(r.estCF) + " → " + int(r.soldCF) + " → " + int(r.realCF) : "—"}</td>
        <td>${r.estH ? r.estH + " → " + r.billH : "—"}</td><td>${r.det ? usd(r.q) + " → " + usd(r.b) : "—"}</td>
        <td>${r.det ? (surprised(r) ? `<b class="eav-up">${usdS(r.extra)}</b>` : usdS(r.extra)) : "—"}</td><td>${r.claim ? '<span class="eav-chip neg">claim</span>' : ""}</td>
        <td>${r.contract ? `<a class="eav-a" href="${esc(r.contract)}" target="_blank" rel="noopener">Contract</a>` : ""}${CAN ? `<button class="eav-btn" data-exclude="${esc(r.key)}">Exclude</button>` : ""}</td></tr>`).join("");
      const exN = ROWS.filter(isEx).length;
      return `<details class="panel eav-more" style="margin-top:14px" ${S.jobsOpen ? "open" : ""} id="eavJobs"><summary>All ${int(list.length)} jobs${exN ? " · " + exN + " excluded" : ""}</summary>
        <table class="eav-t" style="margin-top:8px"><thead><tr><th>Job</th>${th("date", "Date")}<th>Customer</th><th>Sales person</th><th>Foreman</th><th>Size</th>${th("items", "Items listed → counted")}<th>CF est → sold → truck</th><th>Hours est → billed</th><th>Quote → bill</th>${th("extra", "Extra")}<th></th><th></th></tr></thead><tbody>${rows}</tbody></table>
        <div class="eav-pager"><span>${list.length ? int(S.page * S.per + 1) + "–" + int(Math.min(list.length, S.page * S.per + S.per)) + " of " + int(list.length) : "0"}</span>
          <button class="rs-btn" id="eavPrev" ${S.page <= 0 ? "disabled" : ""}>‹ Prev</button><button class="rs-btn" id="eavNext" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button></div>
        ${exN ? `<div class="eav-note">Excluded: ${ROWS.filter(isEx).map(r => `<b>${esc(r.job)}</b> (${esc((EX[r.key] || {}).reason || "")})${CAN ? ` <button class="eav-btn" data-restore="${esc(r.key)}">Restore</button>` : ""}`).join(" · ")}</div>` : ""}</details>`;
    }

    function mountBar() {
      const bar = host.querySelector("#eavBar");
      const fld = label => { const w = document.createElement("div"); w.className = "rs-fld"; w.innerHTML = `<span>${label}</span>`; bar.appendChild(w); return w; };
      if (window.RSC && RSC.dateRange) RSC.dateRange(fld("Move dates"), {
        get: () => ({ from: S.from, to: S.to }), set: (f, t) => { S.from = f; S.to = t; }, onChange: () => { S.page = 0; S.open = null; paint(); } });
      const types = {}; ROWS.forEach(r => { types[r.type] = (types[r.type] || 0) + 1; });
      if (window.RSC && RSC.localMulti) RSC.localMulti(fld("Job type"), { label: "Job type",
        values: Object.entries(types).sort((a, b) => b[1] - a[1]).map(([v, n]) => ({ v, l: v, n })), selected: S.types, emptyLabel: "All",
        onChange: s => { S.types = new Set(s); S.page = 0; paint(); } });
      const q = document.createElement("input");
      q.className = "eav-in"; q.placeholder = "find a job, customer, person…"; q.value = S.q; q.style.flex = "0 1 240px";
      q.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.q = q.value; S.page = 0; S.jobsOpen = true; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    function wire() {
      host.querySelectorAll("#eavTabs button").forEach(b => b.onclick = () => { S.tab = b.dataset.tab; S.open = null; paint(); });
      host.querySelectorAll("tr[data-open]").forEach(tr => tr.onclick = () => { S.open = S.open === tr.dataset.open ? null : tr.dataset.open; paint(); });
      const det = host.querySelector("#eavJobs"); if (det) det.addEventListener("toggle", () => { S.jobsOpen = det.open; });
      host.querySelectorAll(".eav-sort").forEach(t => t.onclick = () => { const k = t.dataset.sort; if (S.sort === k) S.dir *= -1; else { S.sort = k; S.dir = -1; } S.page = 0; S.jobsOpen = true; paint(); });
      const pv = host.querySelector("#eavPrev"), nx = host.querySelector("#eavNext");
      if (pv) pv.onclick = () => { S.page--; S.jobsOpen = true; paint(); };
      if (nx) nx.onclick = () => { S.page++; S.jobsOpen = true; paint(); };
      host.querySelectorAll("[data-exclude]").forEach(b => b.onclick = async e => {
        e.stopPropagation();
        const [job, date] = b.dataset.exclude.split("|");
        const reason = await RSC.ask({ title: "Hold " + job + " out of the numbers?",
          body: "It leaves every figure on this page. Anyone with the page sees who excluded it and why.",
          placeholder: "Why is this job an exception?", yes: "Exclude" });
        if (!reason || !String(reason).trim()) return;
        save(job, date, 1, String(reason).trim());
      });
      host.querySelectorAll("[data-restore]").forEach(b => b.onclick = e => { e.stopPropagation(); const [job, date] = b.dataset.restore.split("|"); save(job, date, 0, ""); });
      host.querySelectorAll("[data-okfig]").forEach(b => b.onclick = e => { e.stopPropagation(); const [job, date] = b.dataset.okfig.split("|"); save(job, date, 2, "figures confirmed"); });
    }

    async function save(job, date, excluded, reason) {
      try { const j = await authed("/api/_eaex", { method: "POST", body: JSON.stringify({ job, date, excluded, reason }) }); setEx(j.rows); paint(); }
      catch (e) { RSC.notice({ title: "Not saved", body: String(e.message || e) }); }
    }

    paint();
  },
});
