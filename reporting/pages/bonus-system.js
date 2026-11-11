/* BONUS SYSTEM (Financial, id bonus-system) -- tracker ZTZ-45, 2026-11-10.

   Gvantsa's "Z2Z Bonus System" (a claude.ai artifact) rebuilt in the portal, rules unchanged:
   - Per YEAR: an estimated full-year gross profit, a target bonus budget (% of GP), pro-rating by
     months worked, a minimum number of months, a rating scale, the evaluation weights and the bonus
     levels.
   - Every DEPARTMENT's budget is 2 months' salary per current person, whatever their tenure. A
     department either scores KPI, Manager and HR evaluation, or also a peer component (Customer
     Support), each with its own weights.
   - Each PERSON: up to two salary periods in the year (a raise mid-year), their scores, the index
     (weighted score / max score), the level the index reaches, and the bonus: the level's months of
     salary, pro-rated by months worked. Nobody under the minimum months is paid. An adjustment can
     move the paid amount (never below $0); a raise for next year and training are budgeted against
     the department too.

   His decisions (10 Nov): salaries and scores are TYPED here, and so is GROSS PROFIT ("the gross profit
   we calculate is not proper gross profit as we don't account for most in house expenses - it should be
   written and no reference needed"), so the page reads no portal dataset at all. People come from the
   TEAM DIRECTORY (hrq_roster), each with a bonus department that may differ from the directory's; and
   the page is open to NAMED PEOPLE ONLY -- the bridge decides (bridge/bonus.py) and tells the shell
   through /api/_me `named`; an admin does not bypass it. Nothing about who is named lives in this public
   file.

   Gvantsa's fixes (11 Nov, ZTZ-63): "Add next year" copies the year before EXACTLY (scores, salaries,
   raises, training, notes, settings); "Headroom left" = target less (bonuses paid + raises + training).

   GROWTH, his rule (11 Nov, ZTZ-67): "in the first year gross profit must not touch the bonuses -- Salome's
   367 stays 367 whatever the gross profit; this year it only shows what is left for raises and training.
   From the next year the bonus moves by exactly the percentage the gross profit changed." So:
   - the first year in the system (no plan for the year before) has NO growth: gross profit only sets the
     target budget and the headroom;
   - every later year compares its gross profit with the PREVIOUS YEAR'S PLAN (its estimate, which she
     updates to the real figure) and every bonus and the 2-month budget move by that ratio, UP OR DOWN
     (his pick: a 10% fall is x0.90). The old typed "baseline" no longer drives anything; it stays in the
     stored plan and only feeds the missing-digit check.

   The page itself was redrawn on 11 Nov (his "build it as shown", design artifact H1WRRGDMcSxVpgeJfmB5Nd):
   settings as four tiles with units, grouped department columns, a needs-scores banner, foldable
   departments, and a save clash that keeps your typing (merged on top of the other person's save). */

/* BNS-ENGINE-START -- pure: no DOM, no RS. tests/test_bonus_system.py runs this block in node. */
const BNS_BUDGET_MONTHS = 2;   // "every department's budget is 2 months' salary per current employee"
/* ctx.prevGP: the gross profit of the year before, from that year's plan; none = the first year, no growth */
function bnsCompute(doc, ctx) {
  const st = (doc && doc.settings) || {};
  const n = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
  const z = v => n(v) || 0;
  const est = z(st.estGP);
  const prevGP = ctx && n(ctx.prevGP) > 0 ? n(ctx.prevGP) : null;
  const growth = prevGP && est > 0 ? est / prevGP : 1;
  const target = est * z(st.targetPct) / 100;
  const maxScore = z(st.maxScore) || 5;
  const W = st.weights || {};
  const levels = (st.levels || []).map((l, i) => ({ n: i + 1, min: z(l.min), months: z(l.months) }));
  const out = { est, prevGP, base: n(st.baselineGP), growth, target, depts: [], warn: [] };
  const KEYS = { general: ["kpi", "mgr", "hr"], peer: ["kpi", "mgr", "peer", "hr"] };
  Object.keys(KEYS).forEach(k => {
    const t = KEYS[k].reduce((a, x) => a + z((W[k] || {})[x]), 0);
    out.warn.push({ set: k, total: t, ok: Math.abs(t - 1) < 1e-6 });
  });
  const T = { budget: 0, spend: 0, raises: 0, training: 0, people: 0, missing: 0 };
  ((doc && doc.depts) || []).forEach(d => {
    const set = d.peer ? "peer" : "general", w = W[set] || {};
    const need = KEYS[set].filter(k => z(w[k]) > 0);
    const D = { id: d.id, name: d.name, peer: !!d.peer, people: [], sumAvg: 0, spend: 0, raises: 0, training: 0, missing: 0 };
    (d.people || []).forEach(p => {
      const m1 = z(p.m1), m2 = z(p.m2), months = m1 + m2;
      const avg = months > 0 ? (z(p.s1) * m1 + z(p.s2) * m2) / months : 0;
      const missing = !need.length || need.some(k => n(p[k]) == null);
      const idx = missing ? null : need.reduce((a, k) => a + z(w[k]) * n(p[k]), 0) / maxScore;
      let lvl = null;
      if (idx != null) levels.forEach(l => { if (idx >= l.min - 1e-9) lvl = l; });
      const eligible = months >= z(st.minMonths);
      const bonus = lvl && eligible ? lvl.months * avg * (st.prorate === false ? 1 : months / 12) * growth : 0;
      const paid = Math.max(0, bonus + z(p.adj));
      const raiseCost = z(p.raise) * z(p.raiseMonths), training = z(p.training);
      D.people.push({ rid: p.rid, name: p.name, months, avg, idx, missing, level: lvl ? lvl.n : null,
                      eligible, bonus, paid, raiseCost, training });
      D.sumAvg += avg; D.spend += paid; D.raises += raiseCost; D.training += training;
      if (missing) D.missing++;
    });
    D.budget = BNS_BUDGET_MONTHS * D.sumAvg * growth;
    D.share = est > 0 ? D.budget / est : null;
    D.used = D.spend + D.raises + D.training;
    D.unspent = D.budget - D.used;
    T.budget += D.budget; T.spend += D.spend; T.raises += D.raises; T.training += D.training;
    T.people += D.people.length; T.missing += D.missing;
    out.depts.push(D);
  });
  T.committed = T.budget + T.raises + T.training;
  // HEADROOM counts what is really paid out (Gvantsa, 10 Nov: "headroom left - minda mitvlides actual bonus
  // paid + trainings + raising"): the target less the bonuses paid after adjustments, the raises and the
  // training -- not less the 2-month budget, which is only a cap
  T.used = T.spend + T.raises + T.training;
  T.headroom = target - T.used;
  T.budgetPct = est > 0 ? T.budget / est : null;
  out.totals = T;
  return out;
}
/* What a typed box holds -> {ok, v}. Before 11 Nov every box went through isNaN(+v), so "1,500",
   "1 500", "$1500" or a decimal comma "3,94" (Gvantsa and Sopho's first entries) were stored as
   blank while the box still showed them: Save said Saved, a refresh showed them empty. Now spaces, a
   currency sign at either end and the Georgian decimal comma are read; anything still not a number is
   {ok:false} and the page keeps it red and refuses to save until it is fixed.
   money: a dollar box (salaries, adjustments, raises, training, gross profit), where "1,500" and
   "1.500" are thousands (no amount here has three decimals). Elsewhere (scores, months, weights,
   percentages) a comma is always the decimal point: "1,500" is 1.5. */
const BNS_MONEY = new Set(["s1", "s2", "adj", "raise", "training", "estGP", "baselineGP"]);
function bnsParseNum(raw, money) {
  let s = String(raw == null ? "" : raw).replace(/[\s  ]/g, "").replace(/−/g, "-");
  if (s === "") return { ok: true, v: null };
  s = s.replace(/^(-?)[$₾]/, "$1").replace(/[$₾]$/, "");
  if (money && /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");                  // 1,500 / 12,500.50
  else if (money && /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); // 1.500 / 1.500,50
  else if (/^-?\d*,\d+$/.test(s)) s = s.replace(",", ".");                                          // 3,94
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(s)) return { ok: false, v: null };
  return { ok: true, v: +s };
}
/* A SAVE CLASH keeps your typing (his pick, 11 Nov). When someone saved the same year after you opened
   it, the page fetches their version and puts YOUR changes on top of it, box by box:
   base = the year as you opened it, mine = your edits, theirs = their save. A box only you changed
   takes your value; one only they changed keeps theirs; one you both changed keeps yours and is
   counted as a clash. People and departments are matched by Team Directory id and department id, so
   an add or a removal on either side survives. */
function bnsFlat(doc) {
  const o = {}, st = (doc && doc.settings) || {};
  Object.keys(st).forEach(k => { o["s|" + k] = (k === "weights" || k === "levels") ? JSON.stringify(st[k]) : st[k]; });
  ((doc && doc.depts) || []).forEach(d => {
    o["d|" + d.id] = 1; o["d|" + d.id + "|name"] = d.name; o["d|" + d.id + "|peer"] = !!d.peer;
    (d.people || []).forEach(p => {
      o["p|" + d.id + "|" + p.rid] = 1;
      Object.keys(p).forEach(k => { if (k !== "rid") o["p|" + d.id + "|" + p.rid + "|" + k] = p[k] == null ? null : p[k]; });
    });
  });
  return o;
}
function bnsMerge(base, mine, theirs) {
  const B = bnsFlat(base), M = bnsFlat(mine), T = bnsFlat(theirs), R = {};
  const v0 = x => (x === undefined ? null : x);
  // "d|<id>" and "p|<id>|<rid>" say a department or a person is there (1) or not (absent)
  const presence = k => (k[0] === "d" && k.split("|").length === 2) || (k[0] === "p" && k.split("|").length === 3);
  let clashes = 0;
  new Set([...Object.keys(B), ...Object.keys(M), ...Object.keys(T)]).forEach(k => {
    const b = v0(B[k]), m = v0(M[k]), t = v0(T[k]);
    let v;
    if (m !== b) { v = m; if (t !== b && t !== m) clashes++; } else v = t;
    if (presence(k)) { if (v === 1) R[k] = 1; } else R[k] = v;
  });
  const settings = {};
  Object.keys(R).forEach(k => {
    if (k.indexOf("s|") !== 0) return;
    const key = k.slice(2);
    settings[key] = (key === "weights" || key === "levels") && typeof R[k] === "string" ? JSON.parse(R[k]) : R[k];
  });
  const union = (a, b) => { const o = a.slice(); b.forEach(x => { if (o.indexOf(x) < 0) o.push(x); }); return o; };
  const ids = x => ((x && x.depts) || []).map(d => d.id);
  const rids = (x, id) => { const d = ((x && x.depts) || []).filter(q => q.id === id)[0]; return d ? (d.people || []).map(p => p.rid) : []; };
  const depts = union(ids(theirs), ids(mine)).filter(id => R["d|" + id] === 1).map(id => ({
    id, name: R["d|" + id + "|name"], peer: !!R["d|" + id + "|peer"],
    people: union(rids(theirs, id), rids(mine, id)).filter(r => R["p|" + id + "|" + r] === 1).map(r => {
      const p = { rid: r }, pre = "p|" + id + "|" + r + "|";
      Object.keys(R).forEach(k => { if (k.indexOf(pre) === 0) p[k.slice(pre.length)] = R[k]; });
      return p;
    }),
  }));
  return { doc: { settings, depts }, clashes };
}
/* BNS-ENGINE-END */

(function () {
  const PAGE_ID = "bonus-system";
  const DEFAULTS = {
    estGP: null, baselineGP: null, targetPct: 2,
    prorate: true, minMonths: 3, maxScore: 5,
    weights: { general: { kpi: 0.65, mgr: 0.3, hr: 0.05 }, peer: { kpi: 0.6, mgr: 0.3, peer: 0.05, hr: 0.05 } },
    levels: [{ min: 0, months: 0 }, { min: 0.5, months: 0.5 }, { min: 0.65, months: 1 },
             { min: 0.8, months: 1.5 }, { min: 0.95, months: 2 }],
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const CHEV = '<svg class="bns-chev" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const WARN = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
  const LABEL = { s1: "salary", m1: "months at that salary", s2: "raised salary", m2: "months at the raised salary",
    kpi: "KPI score", mgr: "manager score", peer: "peer score", hr: "HR score", adj: "adjustment",
    raise: "raise per month next year", raiseMonths: "months of the raise", training: "training" };

  function injectStyle() {
    if (document.getElementById("bns-style-v3")) return;
    const old = document.getElementById("bns-style"); if (old) old.remove();
    const st = document.createElement("style");
    st.id = "bns-style-v3";
    st.textContent = [
      ".bns{font-variant-numeric:tabular-nums;display:flex;flex-direction:column;gap:14px}",
      ".bns .rs-page-head{margin:0}",
      ".bns-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:14px}",
      ".bns-top .rs-page-head{flex:1 1 480px;min-width:0}",
      ".bns-savebar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
      ".bns-who{font-size:12.5px;color:var(--muted)}",
      ".bns-chip{display:inline-flex;align-items:center;gap:4px;height:22px;padding:0 9px;border-radius:99px;font-size:12px;font-weight:600;white-space:nowrap}",
      ".bns-chip.warn{background:var(--warn-bg);color:var(--warn)}",
      "body.rs-app.light .bns-chip.warn{color:#7a4f00}",
      ".bns-chip.mute{background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}",
      "body.rs-app.light .bns .rs-btn.pri{background:var(--brand-d);border-color:var(--brand-d);color:#fff}",
      ".bns-years{display:flex;flex-wrap:wrap;align-items:center;gap:8px}",
      ".bns-seg{display:inline-flex;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:3px;gap:2px}",
      ".bns-seg button{height:30px;border:0;background:transparent;color:var(--muted);font:inherit;font-size:13px;font-weight:600;padding:0 14px;border-radius:7px;cursor:pointer}",
      ".bns-seg button.on{background:var(--brand-glow);color:var(--pos)}",
      ".bns-link{border:0;background:transparent;color:var(--pos);font:inherit;font-size:13px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px;padding:6px 8px;border-radius:8px}",
      ".bns-link:hover{background:var(--brand-glow)}",
      ".bns-link.danger{color:var(--neg)}.bns-link.danger:hover{background:var(--neg-bg)}",
      ".bns-sp{flex:1}",
      ".bns-msg{font-size:13px;color:var(--muted)}",
      ".bns-msg.bns-bad{color:var(--neg);font-weight:600}",
      ".bns-notes{display:flex;flex-direction:column;gap:8px}",
      ".bns-notes:empty{display:none}",
      ".bns-note{display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 16px;font-size:13.5px;color:var(--ink)}",
      ".bns-note svg{flex:none;color:var(--warn)}",
      "body.rs-app.light .bns-note svg{color:#a36a00}",
      ".bns-note span{flex:1;min-width:220px}",
      ".bns-kbar{display:flex;height:6px;border-radius:99px;overflow:hidden;background:var(--panel-2);margin-top:8px}",
      ".bns-kbar i{display:block;height:100%}",
      ".bns-card{background:var(--panel);border:1px solid var(--line);border-radius:14px}",
      ".bns-set{padding:14px 18px}",
      ".bns-set>summary{display:flex;align-items:center;gap:10px;flex-wrap:wrap;cursor:pointer;list-style:none}",
      ".bns-set>summary::-webkit-details-marker{display:none}",
      ".bns-chev{color:var(--muted);transition:transform .15s;flex:none}",
      ".bns-set:not([open])>summary .bns-chev{transform:rotate(-90deg)}",
      ".bns-h2{margin:0;font-size:16px;font-weight:700;color:var(--ink)}",
      ".bns-sum{font-size:13px;color:var(--muted)}",
      ".bns-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,470px),1fr));gap:14px;margin-top:14px}",
      ".bns-tile{border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}",
      ".bns-tile h3{margin:0 0 4px;font-size:14px;font-weight:700;color:var(--ink)}",
      ".bns-hint{margin:0 0 10px;font-size:12.5px;color:var(--muted);line-height:1.5}",
      ".bns-fg{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:12px;align-items:end;margin-top:10px}",
      ".bns-lab{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin-bottom:6px}",
      ".bns-box{display:flex;align-items:center;gap:6px;height:36px;border:1px solid var(--line-2);border-radius:8px;padding:0 10px;background:var(--panel);box-sizing:border-box}",
      ".bns-box:focus-within{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}",
      ".bns-box input{border:0;outline:0;flex:1;min-width:0;width:100%;font:inherit;font-size:14px;font-weight:500;color:var(--ink);text-align:right;background:transparent;font-variant-numeric:tabular-nums;padding:0}",
      ".bns-u{font-size:13px;color:var(--muted);white-space:nowrap}",
      ".bns-box.ro{background:var(--panel-2)}",
      ".bns-box.ro b{flex:1;text-align:right;font-weight:500;font-size:14px;color:var(--ink)}",
      ".bns-box.bns-unread{border-color:#dc2626;background:rgba(220,38,38,.10)}",
      ".bns-strip{display:flex;flex-wrap:wrap;gap:6px 22px;background:var(--panel-2);border-radius:10px;padding:9px 14px;margin-top:12px;font-size:13px;color:var(--muted);line-height:1.5}",
      ".bns-strip b{color:var(--ink)}.bns-strip b.up{color:var(--pos)}.bns-strip b.down{color:var(--neg)}",
      ".bns-mini{display:grid;grid-template-columns:minmax(0,1fr) 118px 118px;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--line);font-size:13.5px;color:var(--ink)}",
      ".bns-mini:last-child{border-bottom:0}",
      ".bns-mini.h{font-size:12px;font-weight:600;color:var(--muted);padding:2px 0 7px}",
      ".bns-mini .r{text-align:right}",
      ".bns-mini .bns-box{height:32px}",
      ".bns-ok{color:var(--pos);font-weight:700}.bns-off{color:var(--neg);font-weight:700}",
      ".bns-ladder{display:flex;height:10px;border-radius:99px;overflow:hidden;margin-top:12px;background:var(--panel-2)}",
      ".bns-ladder i{display:block;height:100%}",
      ".bns-ticks{position:relative;height:16px;font-size:11.5px;color:var(--muted);margin-top:4px}",
      ".bns-ticks span{position:absolute;transform:translateX(-50%)}",
      ".bns-how{margin-top:12px;padding:12px 14px;border-radius:10px;background:var(--panel-2);font-size:13px;line-height:1.6;color:var(--muted)}",
      ".bns-how b{color:var(--ink)}",
      ".bns-sec{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:6px}",
      ".bns-sec h2{margin:0;font-size:18px;font-weight:700;color:var(--ink)}",
      ".bns-newd{display:flex;gap:8px;align-items:center}",
      ".bns-in{font:inherit;font-size:13px;height:30px;padding:0 7px;border:1px solid var(--line-2);border-radius:7px;background:var(--panel);color:var(--ink);box-sizing:border-box;width:100%;text-align:right;font-variant-numeric:tabular-nums}",
      ".bns-in:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}",
      ".bns-in.bns-unread,.bns-in.bns-unread:focus{border-color:#dc2626;background:rgba(220,38,38,.10);box-shadow:inset 0 0 0 1px #dc2626}",
      ".bns-in.txt{text-align:left}",
      ".bns-dept{overflow:hidden}",
      ".bns-dh{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px}",
      ".bns-dept.open .bns-dh{border-bottom:1px solid var(--line)}",
      ".bns-fold{border:0;background:transparent;color:var(--muted);width:30px;height:30px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0}",
      ".bns-fold:hover{background:var(--panel-2)}",
      ".bns-dept:not(.open) .bns-fold .bns-chev{transform:rotate(-90deg)}",
      ".bns-dname{font:inherit;font-size:16px;font-weight:700;color:var(--ink);border:1px solid transparent;background:transparent;border-radius:7px;padding:3px 6px;width:210px}",
      ".bns-dname:hover{border-color:var(--line)}.bns-dname:focus{outline:none;border-color:var(--brand);background:var(--panel)}",
      ".bns-tg{font-size:13px;color:var(--muted);display:inline-flex;align-items:center;gap:8px;cursor:pointer}",
      ".bns-sw{appearance:none;-webkit-appearance:none;width:34px;height:20px;border-radius:99px;background:var(--line-2);position:relative;cursor:pointer;margin:0;flex:none;transition:background .15s}",
      ".bns-sw:checked{background:var(--brand-d)}",
      "body.rs-app:not(.light) .bns-sw:checked{background:var(--brand)}",
      ".bns-sw::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}",
      ".bns-sw:checked::after{left:17px}",
      ".bns-sw:focus-visible{outline:2px solid var(--brand);outline-offset:2px}",
      ".bns-meter{display:flex;flex-direction:column;gap:5px;min-width:240px}",
      ".bns-meter .t{font-size:12.5px;color:var(--muted)}.bns-meter .t b{color:var(--ink)}",
      ".bns-meter .b{height:6px;border-radius:99px;background:var(--panel-2);overflow:hidden}",
      ".bns-meter .b i{display:block;height:100%;background:var(--brand-d)}",
      "body.rs-app:not(.light) .bns-meter .b i{background:var(--brand)}",
      ".bns-meter .b i.hi{background:var(--warn)}.bns-meter .b i.over{background:var(--neg)}",
      ".bns-ib{border:0;background:transparent;color:var(--muted);width:30px;height:30px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;font-size:15px;padding:0}",
      ".bns-ib:hover:not(:disabled){background:var(--panel-2);color:var(--ink)}",
      ".bns-ib.del:hover{background:var(--neg-bg);color:var(--neg)}",
      ".bns-ib:disabled{opacity:.35;cursor:default}",
      ".bns-tw{overflow-x:auto;padding:2px 12px 6px}",
      ".bns-g{display:grid;grid-template-columns:minmax(210px,1.6fr) 78px 60px 78px 60px 72px 58px 66px 58px 58px 64px 106px 72px 80px 74px 76px 60px 76px 32px;column-gap:6px;align-items:center;min-width:1352px}",
      ".bns-g>div{font-size:13px;text-align:right;white-space:nowrap;color:var(--ink)}",
      ".bns-g>div.l{text-align:left;white-space:normal;min-width:0}",
      ".bns-g.grp>div{font-size:12px;font-weight:700;text-align:center;padding:6px 0 4px;border-bottom:2px solid var(--line)}",
      ".bns-g.grp>div.sc{color:var(--pos);border-bottom-color:var(--brand)}",
      ".bns-g.grp>div.nx{color:var(--blue);border-bottom-color:var(--blue)}",
      ".bns-g.grp>div.e{border-bottom:0}",
      ".bns-g.hd>div{font-size:12px;font-weight:600;color:var(--muted);padding:7px 0}",
      ".bns-g.row{border-top:1px solid var(--line);padding:5px 0}",
      ".bns-g.row[hidden]{display:none}",
      ".bns-g .o{color:var(--muted)}",
      ".bns-g .paid{font-weight:700}",
      ".bns-pn{font-weight:600;color:var(--ink)}",
      ".bns-pd{display:block;font-size:12px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".bns-left{display:inline-block;font-size:11.5px;font-weight:600;color:var(--warn);margin-left:6px}",
      "body.rs-app.light .bns-left{color:#7a4f00}",
      ".bns-na{color:var(--muted)}",
      ".bns-lvl{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:99px;font-size:12px;font-weight:600}",
      ".bns-l1{background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}",
      ".bns-l2{background:rgba(127,163,43,.12);color:var(--pos)}",
      ".bns-l3{background:rgba(127,163,43,.24);color:var(--pos)}",
      ".bns-l4{background:rgba(127,163,43,.40);color:var(--pos)}",
      "body.rs-app.light .bns-l2,body.rs-app.light .bns-l3,body.rs-app.light .bns-l4{color:#2f4010}",
      ".bns-l5{background:var(--brand-d);color:#fff}",
      "body.rs-app:not(.light) .bns-l5{background:var(--brand);color:var(--brand-ink)}",
      ".bns-lvl.no{opacity:.6;text-decoration:line-through}",
      ".bns-add{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid var(--line);background:var(--panel-2)}",
      ".bns-add label{font-size:13px;color:var(--muted)}",
      ".bns-add .rs-sel{min-width:280px}",
      ".bns-empty{padding:26px;text-align:center;color:var(--muted)}",
      ".bns-cfm{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9999}",
      ".bns-cfm .bns-box2{background:var(--panel);border-radius:14px;padding:20px 22px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.25)}",
      ".bns-cfm h3{margin:0 0 8px;font-size:16px;color:var(--ink)}",
      ".bns-cfm p{margin:0 0 16px;font-size:13.5px;color:var(--muted);line-height:1.5}",
      ".bns-cfm .bns-btns{display:flex;gap:8px;justify-content:flex-end}",
      ".bns-btn-danger{background:#b91c1c !important;border-color:#b91c1c !important;color:#fff !important}",
    ].join("");
    document.head.appendChild(st);
  }

  function bnsConfirm(o) {
    return new Promise(res => {
      const box = document.createElement("div");
      box.className = "bns-cfm";
      box.innerHTML = `<div class="bns-box2" role="dialog" aria-modal="true"><h3>${o.t}</h3><p>${o.b}</p><div class="bns-btns">`
        + `<button class="rs-btn" data-no>${o.no || "Cancel"}</button>`
        + `<button class="rs-btn pri${o.danger ? " bns-btn-danger" : ""}" data-yes>${o.yes || "Confirm"}</button></div></div>`;
      document.body.appendChild(box);
      const done = v => { box.remove(); document.removeEventListener("keydown", onk); res(v); };
      const onk = e => { if (e.key === "Escape") done(false); };
      document.addEventListener("keydown", onk);
      box.querySelector("[data-yes]").onclick = () => done(true);
      box.querySelector("[data-no]").onclick = () => done(false);
      box.onclick = e => { if (e.target === box) done(false); };
      box.querySelector("[data-no]").focus();
    });
  }

  registerPage({
    id: PAGE_ID,
    group: "financial",
    title: "Bonus System",
    subtitle: "Department bonus budgets from gross profit, each person's scores and the bonuses that follow.",
    datasets: [],
    render(host) {
      const esc = (window.RSC && RSC.esc) || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
      const mine = host;
      const myRender = (window.__BNS_RENDER = (window.__BNS_RENDER || 0) + 1);
      const alive = () => document.body.contains(mine) && window.__BNS_RENDER === myRender
        && /(^|[#&])page=bonus-system(&|$)/.test(location.hash);
      // edits survive leaving the page inside the portal; a reload or a closed tab asks first
      const S = window.__BNS || (window.__BNS = {
        loaded: false, err: "", years: {}, cur: null, roster: [], me: "", dirty: new Set(), saving: false,
        msg: "", bad: false, unread: new Map(),
      });
      if (!S.unread) S.unread = new Map();   // boxes whose text is not a number: key -> the text, kept red
      if (!S.fold) S.fold = new Set();       // departments folded to one line (this browser tab only)
      if (!window.__BNS_UNLOAD) {
        window.__BNS_UNLOAD = true;
        window.addEventListener("beforeunload", e => {
          if (window.__BNS && window.__BNS.dirty.size) { e.preventDefault(); e.returnValue = ""; }
        });
      }

      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(r => r.json().catch(() => ({})).then(j => {
          if (!r.ok || j.error) { const e = new Error(j.error || ("HTTP " + r.status)); e.status = r.status; e.code = j.code; throw e; }
          return j;
        }));
      }
      const post = body => api("/api/_bonus", { method: "POST", body: JSON.stringify(body) });

      const n = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
      const money = v => v == null ? "—" : (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US");
      const moneyM = v => v == null ? "—" : Math.abs(v) >= 1e6 ? (v < 0 ? "−$" : "$") + (Math.abs(v) / 1e6).toFixed(2) + "M" : money(v);
      // half up, as her sheet showed it (0.6725 -> 67.3%): float products land a hair under the half
      const pct1 = v => v == null ? "–" : (Math.round(v * 1000 + 1e-7) / 10).toFixed(1) + "%";
      const fv = v => v == null ? "" : String(v);
      const asPct = v => v == null ? "" : String(Math.round(v * 100 * 1e6) / 1e6);   // 0.65 -> "65"
      const fromPct = v => v == null ? null : Math.round(v / 100 * 1e9) / 1e9;          // 65 -> 0.65
      /* times in the portal's chosen zone (the header clock: NJ, Tbilisi or UTC); the bridge stores UTC */
      const when = v => {
        if (!v) return "";
        const d = new Date(String(v).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? "" : "Z"));
        if (isNaN(d)) return String(v);
        if (window.RS && RS.fmtTz && RS.tzChoice)
          return RS.fmtTzDay(d) + " at " + RS.fmtTz(d) + " (" + RS.tzChoice().label + ")";
        return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric",
          hour: "numeric", minute: "2-digit" }) + " (New Jersey)";
      };
      const who = (name, by) => name || (by && by.indexOf("@") > 0
        ? by.split("@")[0].replace(/^./, c => c.toUpperCase()) : "someone");
      const thisYear = () => +new Date().toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric" });
      const yearsList = () => Object.keys(S.years).map(Number).sort((a, b) => a - b);
      const Y = () => S.years[S.cur];
      const doc = () => Y().doc;
      const rosterById = () => { const m = new Map(); S.roster.forEach(r => m.set(r.id, r)); return m; };
      let seq = 0;
      const newId = () => "d" + Date.now().toString(36) + (seq++);
      const say = (m, bad) => { S.msg = m || ""; S.bad = !!bad; };
      const markDirty = () => { S.dirty.add(S.cur); };
      /* the growth rule's context: the gross profit of the year before, from THAT year's plan */
      const ctxFor = y => { const p = S.years[y - 1]; return { prevGP: p ? n(p.doc.settings.estGP) : null }; };
      const compute = () => bnsCompute(doc(), ctxFor(S.cur));

      /* typed numbers: a box that cannot be read stays red with its text (kept across repaints by key)
         and Save refuses until it is fixed, so nothing typed is ever dropped quietly again */
      const kF = (d, p, f) => "f|" + S.cur + "|" + d.id + "|" + p.rid + "|" + f;
      const kS = k => "s|" + S.cur + "|" + k;
      const kW = k => "w|" + S.cur + "|" + k;
      const kL = k => "l|" + S.cur + "|" + k;
      const UNREAD_TIP = "This can't be read as a number. Type just the number, like 1500 or 3.5.";
      // dollar boxes show thousands separators (2,313,000); bnsParseNum reads them back
      const fvMoney = v => v == null ? "" : Math.abs(+v) >= 1000 ? (+v).toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(v);
      const boxVal = (key, v, money) => { const t = S.unread.get(key); return t != null ? t : money ? fvMoney(v) : fv(v); };
      const boxCls = key => S.unread.has(key) ? " bns-unread" : "";
      const boxAttr = key => S.unread.has(key) ? ` aria-invalid="true" title="${UNREAD_TIP}"` : "";
      function readBox(el, key, money) {
        const r = bnsParseNum(el.value, money);
        if (r.ok) S.unread.delete(key); else S.unread.set(key, el.value);
        const mark = el.closest(".bns-box") || el;
        mark.classList.toggle("bns-unread", !r.ok);
        if (r.ok) { el.removeAttribute("aria-invalid"); el.removeAttribute("title"); }
        else { el.setAttribute("aria-invalid", "true"); el.title = UNREAD_TIP; }
        return r.v;
      }
      const unreadYears = () => [...new Set([...S.unread.keys()].map(k => +k.split("|")[1]))].sort((a, b) => a - b);
      function unreadMsg() {
        const c = S.unread.size, ys = unreadYears(), other = ys.filter(y => y !== S.cur);
        return (c === 1 ? "1 box in red can't" : c + " boxes in red can't") + " be read as a number"
          + (other.length ? " (" + (ys.includes(S.cur) ? "here and in " : "in ") + other.join(", ") + ")" : "")
          + ". Type just the number, like 1500 or 3.5. Nothing is saved until " + (c === 1 ? "it is" : "they are") + " fixed.";
      }
      const dropUnread = prefix => { [...S.unread.keys()].forEach(k => { if (k.startsWith(prefix)) S.unread.delete(k); }); };

      function normalize(d) {
        d = d && typeof d === "object" ? d : {};
        const st = Object.assign(clone(DEFAULTS), d.settings || {});
        st.weights = { general: Object.assign(clone(DEFAULTS.weights.general), (d.settings && d.settings.weights && d.settings.weights.general) || {}),
                       peer: Object.assign(clone(DEFAULTS.weights.peer), (d.settings && d.settings.weights && d.settings.weights.peer) || {}) };
        st.levels = Array.isArray(st.levels) && st.levels.length ? st.levels : clone(DEFAULTS.levels);
        const depts = (Array.isArray(d.depts) ? d.depts : []).map(x => ({ id: x.id || newId(), name: x.name || "Department",
          peer: !!x.peer, people: Array.isArray(x.people) ? x.people : [] }));
        return { settings: st, depts };
      }
      /* one year as the page keeps it: `orig` is the year as last read or saved, the base of a clash merge */
      const yearOf = y => {
        const d = normalize(y.doc);
        return { version: y.version, doc: d, orig: clone(d), updated_by: y.updated_by,
                 updated_by_name: y.updated_by_name, updated_at: y.updated_at };
      };

      /* ---------------- loading ---------------- */
      function load() {
        S.err = ""; paint();
        return api("/api/_bonus").then(j => {
          S.years = {};
          (j.years || []).forEach(y => { S.years[y.year] = yearOf(y); });
          S.roster = j.roster || []; S.me = j.me || "";
          S.dirty = new Set(); S.unread = new Map(); S.loaded = true;
          const ys = yearsList();
          if (!ys.length) {
            const y = thisYear();
            S.years[y] = { version: 0, doc: normalize({}), orig: null, updated_by: null, updated_at: null };
            S.cur = y; S.dirty.add(y);
            say("No plan saved yet. Set up " + y + " below and press Save.");
          } else if (!S.years[S.cur]) {
            const ty = thisYear();
            S.cur = ys.includes(ty) ? ty : ys[ys.length - 1];
          }
          if (alive()) paint();
        }).catch(e => { S.err = e.code === "not_named" ? "This page is open only to the people named for it." : (e.message || String(e));
                        if (alive()) paint(); });
      }

      /* ---------------- painting ---------------- */
      function savedTxt() {
        const y = Y();
        if (y.updated_by) return "Saved by " + esc(who(y.updated_by_name, y.updated_by)) + ", " + esc(when(y.updated_at));
        return y.version ? "" : "Not saved yet";
      }
      function paint() {
        if (!alive() && S.loaded) return;
        injectStyle();
        const head = `<div class="rs-page-head"><h1>Bonus System</h1><p>Each person's scores pick a bonus level, and
          the level sets the bonus in months of salary. Open only to the people named for it.</p></div>`;
        if (S.err) {
          host.innerHTML = `<div class="bns">${head}<section class="panel"><div class="bns-empty">${esc(S.err)}</div></section></div>`;
          return;
        }
        if (!S.loaded) {
          host.innerHTML = `<div class="bns">${head}<div class="rs-loading"><div>Loading <b>the bonus plan</b>…</div><div class="bar"><i></i></div></div></div>`;
          return;
        }
        const R = compute(), st = doc().settings, ys = yearsList(), last = ys[ys.length - 1];
        const tabs = ys.map(yy => `<button type="button" role="tab" aria-selected="${yy === S.cur}" class="${yy === S.cur ? "on" : ""}"
          data-act="year" data-y="${yy}">${yy}${S.dirty.has(yy) ? " •" : ""}</button>`).join("");
        const allFolded = doc().depts.length && doc().depts.every(d => S.fold.has(d.id));
        host.innerHTML = `<div class="bns">
          <div class="bns-top">${head}
            <div class="bns-savebar"><span class="bns-who">${savedTxt()}</span>
              <span class="bns-chip warn" data-o="dirty"${S.dirty.size ? "" : " hidden"}>Unsaved changes</span>
              <button type="button" class="rs-btn pri" data-act="save" ${S.dirty.size && !S.saving ? "" : "disabled"}>${S.saving ? "Saving…" : "Save changes"}</button></div></div>
          <div class="bns-years"><div class="bns-seg" role="tablist" aria-label="Plan year">${tabs}</div>
            <button type="button" class="bns-link" data-act="add-year">+ Start ${last + 1} as a copy of ${last}</button>
            <span class="bns-sp"></span>
            <button type="button" class="bns-link danger" data-act="del-year">Remove ${S.cur}</button></div>
          ${S.msg ? `<div class="bns-msg${S.bad ? " bns-bad" : ""}" role="status">${esc(S.msg)}</div>` : ""}
          <div class="bns-msg bns-bad" id="bns-unread" aria-live="polite"${S.unread.size ? "" : " hidden"}>${S.unread.size ? esc(unreadMsg()) : ""}</div>
          <div class="bns-notes" data-o="notes">${notesHtml(R)}</div>
          <div class="rs-kpis" id="bns-kpis"></div>
          ${settingsHtml(st, R)}
          <div class="bns-sec"><h2>Departments</h2><span class="bns-sum" data-o="dcount">${deptCount(R)}</span>
            <span class="bns-sp"></span>
            ${doc().depts.length ? `<button type="button" class="bns-link" data-act="fold-all">${allFolded ? "Unfold all" : "Fold all"}</button>` : ""}
            <div class="bns-newd"><input class="bns-in txt" id="bns-newname" placeholder="New department name" maxlength="60"
              aria-label="New department name" style="width:210px;height:34px">
              <button type="button" class="rs-btn" data-act="add-dept">+ Add department</button></div></div>
          <div id="bns-depts" style="display:flex;flex-direction:column;gap:12px">${doc().depts.map((d, i) => deptHtml(d, i, R.depts[i])).join("")
            || `<div class="bns-card bns-empty">No departments in ${S.cur} yet. Add one above.</div>`}</div>
        </div>`;
        paintKpis(R);
        wire();
      }

      const deptCount = R => R.depts.length + (R.depts.length === 1 ? " department · " : " departments · ")
        + R.totals.people + (R.totals.people === 1 ? " person" : " people");

      function notesHtml(R) {
        const out = [], ref = R.prevGP || (R.base > 0 ? R.base : null);
        if (R.est > 0 && ref && (R.est < ref * 0.5 || R.est > ref * 2)) {
          const refTxt = R.prevGP ? S.cur - 1 + "'s gross profit" : "last year's gross profit";
          const how = R.est < ref ? Math.round((1 - R.est / ref) * 100) + "% below " : (R.est / ref).toFixed(1) + " times ";
          out.push(`<div class="bns-note" role="status">${WARN}<span>This year's gross profit, ${money(R.est)}, is ${how}${refTxt}
            (${money(ref)}). Check it for a missing or extra digit.</span></div>`);
        }
        const T = R.totals;
        if (T.missing) {
          out.push(`<div class="bns-note" role="status">${WARN}<span>${T.missing} of ${T.people} ${T.people === 1 ? "person has" : "people have"}
            no scores yet, so their bonus shows $0.</span><button type="button" class="rs-btn" data-act="missing">${S.onlyMissing ? "Show everyone" : "Show them"}</button></div>`);
        } else if (S.onlyMissing) S.onlyMissing = false;
        return out.join("");
      }

      function paintKpis(R) {
        const k = host.querySelector("#bns-kpis");
        if (!k || !window.RSC || !RSC.kpis) return;
        const st = doc().settings, T = R.totals;
        const g = R.growth - 1;
        const gpSub = R.prevGP ? (g >= 0 ? "+" : "−") + Math.abs(g * 100).toFixed(1) + "% on " + (S.cur - 1) + " (" + moneyM(R.prevGP) + ")"
          : "first year: sets the target only";
        const used = R.target > 0 ? T.used / R.target : null;
        RSC.kpis(k, [
          { label: "Gross profit, this year", value: moneyM(R.est), sub: gpSub },
          { label: "Target budget", value: money(R.target), sub: (n(st.targetPct) || 0) + "% of gross profit" },
          { label: "Department budgets", value: money(T.budget), sub: BNS_BUDGET_MONTHS + " months' salary × " + T.people + " people" },
          { label: "Paid and committed", value: money(T.used), sub: "Bonuses " + money(T.spend) + " · raises " + money(T.raises) + " · training " + money(T.training) },
          { label: "Headroom left", value: money(T.headroom), sub: used == null ? "no target yet" : Math.round(used * 100) + "% of the target used",
            tone: T.headroom < 0 ? "bad" : "" },
        ]);
        const lastCard = k.lastElementChild;
        if (lastCard && R.target > 0) {
          const a = Math.min(100, T.spend / R.target * 100), b = Math.min(100 - a, (T.raises + T.training) / R.target * 100);
          const bar = document.createElement("div");
          bar.className = "bns-kbar"; bar.setAttribute("aria-hidden", "true");
          bar.innerHTML = `<i style="width:${a}%;background:${T.headroom < 0 ? "var(--neg)" : "var(--brand-d)"}"></i><i style="width:${b}%;background:var(--brand)"></i>`;
          lastCard.appendChild(bar);
        }
      }

      function stripHtml(R) {
        const st = doc().settings, tgt = `<span>Target budget <b>${money(R.target)}</b>, ${esc(fv(st.targetPct))}% of gross profit</span>`;
        if (!R.prevGP) return `<span>${S.cur} is the first year in the system, so bonuses don't follow gross profit; it sets the target and the headroom only.</span>${tgt}`;
        const g = R.growth - 1;
        if (Math.abs(g) < 0.0005) return `<span>Gross profit is the same as ${S.cur - 1}'s, so bonuses stay as calculated (×1.000)</span>${tgt}`;
        return `<span>Gross profit ${g > 0 ? "up" : "down"} <b class="${g > 0 ? "up" : "down"}">${Math.abs(g * 100).toFixed(1)}%</b> on ${S.cur - 1},
          so every bonus is multiplied by <b>${R.growth.toFixed(3)}</b></span>${tgt}`;
      }
      function setSum(R) {
        const st = doc().settings, ok = R.warn.every(w => w.ok);
        return "Gross profit " + moneyM(R.est) + " · budget " + esc(fv(st.targetPct)) + "% · weights "
          + (ok ? "100%" : "not 100%") + " · " + st.levels.length + " levels";
      }
      function wtotHtml(R) {
        const t = w => R.warn.find(x => x.set === w);
        const cell = w => `<span class="r ${t(w).ok ? "bns-ok" : "bns-off"}">${t(w).ok ? "✓ " : ""}${(Math.round(t(w).total * 1000) / 10)}%</span>`;
        return `<span>Total</span>${cell("general")}${cell("peer")}`;
      }
      function ladderHtml(st) {
        const lv = st.levels.map(l => ({ min: Math.max(0, Math.min(1, n(l.min) || 0)), months: n(l.months) || 0 }));
        const shades = ["var(--panel-2)", "rgba(127,163,43,.28)", "rgba(127,163,43,.5)", "rgba(127,163,43,.75)", "var(--brand-d)"];
        const segs = lv.map((l, i) => {
          const to = i + 1 < lv.length ? lv[i + 1].min : 1, w = Math.max(0, to - l.min) * 100;
          return `<i style="width:${w}%;background:${l.months ? shades[Math.min(4, Math.max(1, i))] : "var(--line)"}"></i>`;
        }).join("");
        const ticks = lv.filter(l => l.min > 0 && l.min < 1).map(l => `<span style="left:${l.min * 100}%">${Math.round(l.min * 100)}%</span>`).join("");
        return `<div class="bns-ladder" aria-hidden="true">${segs}</div><div class="bns-ticks" aria-hidden="true"><span style="left:0;transform:none">0%</span>${ticks}<span style="left:100%;transform:translateX(-100%)">100%</span></div>`;
      }

      function box(label, key, val, pre, suf, id) {
        const b = kS(key);
        return `<div><label class="bns-lab" for="${id}">${esc(label)}</label><div class="bns-box${boxCls(b)}">${pre ? `<span class="bns-u">${pre}</span>` : ""}<input id="${id}" data-s="${key}" value="${esc(boxVal(b, val, BNS_MONEY.has(key)))}" inputmode="decimal"${boxAttr(b)}>${suf ? `<span class="bns-u">${suf}</span>` : ""}</div></div>`;
      }
      function settingsHtml(st, R) {
        const W = st.weights;
        const wbox = (set, x, name) => { const k = set + "." + x, b = kW(k), shown = S.unread.has(b) ? S.unread.get(b) : asPct(W[set][x]);
          return `<div class="bns-box${boxCls(b)}"><input data-w="${k}" value="${esc(shown)}" inputmode="decimal" aria-label="${set === "peer" ? "With peer" : "Standard"} ${name} weight"${boxAttr(b)}><span class="bns-u">%</span></div>`; };
        const wrow = (x, name) => `<div class="bns-mini"><span>${name}</span>${x === "peer" ? `<span class="r bns-na">not used</span>` : wbox("general", x, name)}${wbox("peer", x, name)}</div>`;
        const lbox = (i, f, v) => { const k = i + "." + f, b = kL(k), shown = S.unread.has(b) ? S.unread.get(b) : (f === "min" ? asPct(v) : fv(v));
          return `<div class="bns-box${boxCls(b)}"><input data-l="${k}" value="${esc(shown)}" inputmode="decimal" aria-label="Level ${i + 1} ${f === "min" ? "starts at" : "bonus in months"}"${boxAttr(b)}><span class="bns-u">${f === "min" ? "%" : "months"}</span></div>`; };
        const lrows = st.levels.map((l, i) => {
          const floor = i === 0 && !n(l.min) && !n(l.months);
          const nxt = st.levels[1] ? asPct(st.levels[1].min) + "%" : "";
          return `<div class="bns-mini"><span><span class="bns-lvl bns-l${Math.min(5, i + 1)}">Level ${i + 1}</span></span>`
            + (floor ? `<span class="r bns-na">below ${nxt}</span><span class="r bns-na">no bonus</span>` : lbox(i, "min", l.min) + lbox(i, "months", l.months)) + `</div>`;
        }).join("");
        return `<details class="bns-card bns-set"${S.openSet ? " open" : ""}><summary>${CHEV}<h2 class="bns-h2">Settings for ${S.cur}</h2>
            <span class="bns-sum" data-o="setsum">${setSum(R)}</span></summary>
          <div class="bns-tiles">
            <div class="bns-tile"><h3>Budget</h3>
              <div class="bns-fg">
                ${box("Gross profit, this year (estimate)", "estGP", st.estGP, "$", "", "bns-f-est")}
                ${R.prevGP ? `<div><span class="bns-lab">Gross profit, ${S.cur - 1}, from that plan</span><div class="bns-box ro"><span class="bns-u">$</span><b>${Math.round(R.prevGP).toLocaleString("en-US")}</b></div></div>` : ""}
                ${box("Bonus budget, share of gross profit", "targetPct", st.targetPct, "", "%", "bns-f-pct")}
              </div>
              <div class="bns-strip" data-o="strip">${stripHtml(R)}</div></div>
            <div class="bns-tile"><h3>Rules</h3>
              <div class="bns-fg">
                <div><span class="bns-lab" id="bns-l-pro">Pro-rate by months worked</span><label class="bns-tg" style="height:36px;color:var(--ink);font-size:14px">
                  <input type="checkbox" class="bns-sw" data-s="prorate" aria-labelledby="bns-l-pro"${st.prorate !== false ? " checked" : ""}>${st.prorate !== false ? "On" : "Off"}</label></div>
                ${box("Minimum to be eligible", "minMonths", st.minMonths, "", "months", "bns-f-min")}
                ${box("Rating scale", "maxScore", st.maxScore, "1 to", "", "bns-f-max")}
              </div>
              <p class="bns-hint" style="margin:12px 0 0">Each department's budget is ${BNS_BUDGET_MONTHS} months' salary per person. Nobody under the minimum months is paid.</p></div>
            <div class="bns-tile"><h3>Evaluation weights</h3>
              <p class="bns-hint">How much each score counts. Departments with the peer switch on use the second column.</p>
              <div class="bns-mini h"><span>Score</span><span class="r">Standard</span><span class="r">With peer score</span></div>
              ${wrow("kpi", "KPI")}${wrow("mgr", "Manager")}${wrow("peer", "Peer")}${wrow("hr", "HR")}
              <div class="bns-mini" style="font-weight:700" data-o="wtot">${wtotHtml(R)}</div></div>
            <div class="bns-tile"><h3>Bonus levels</h3>
              <p class="bns-hint">The weighted score, as a share of the rating scale, picks the level.</p>
              <div class="bns-mini h"><span>Level</span><span class="r">From score</span><span class="r">Bonus</span></div>
              ${lrows}
              <div data-o="ladder">${ladderHtml(st)}</div></div>
          </div>
          <button type="button" class="bns-link" data-act="how" aria-expanded="${!!S.how}" style="margin-top:10px">${S.how ? "Hide" : "How bonuses are calculated"}</button>
          ${S.how ? `<div class="bns-how"><b>Bonus:</b> the weighted score (KPI, manager and HR, plus peer where it is switched on), as a share
            of the rating scale, picks the level. The level pays its months of the person's average monthly salary, pro-rated by
            months worked. Nobody under the minimum months is paid. An adjustment moves the paid amount, never below $0.<br>
            <b>Department budget:</b> ${BNS_BUDGET_MONTHS} months' salary per person: a cap to compare against, not a pot to spend.<br>
            <b>Gross profit</b> is typed here, because the portal's own gross profit leaves out most in-house costs. In the first year
            in the system it only sets the target budget and the headroom. From the next year, every bonus and budget moves by
            the same percentage as gross profit against the year before: up 10% makes ×1.10, down 10% makes ×0.90.<br>
            <b>Headroom left:</b> the target less the bonuses paid, the raises and the training.</div>` : ""}
        </details>`;
      }

      function meterHtml(D) {
        const r = D.budget > 0 ? D.used / D.budget : (D.used > 0 ? 2 : 0);
        return `<div class="t"><b>${money(D.used)}</b> of the ${money(D.budget)} budget used</div>
          <div class="b"><i class="${r > 1 ? "over" : r > 0.85 ? "hi" : ""}" style="width:${Math.min(100, Math.round(r * 100))}%"></i></div>`;
      }
      function lvlHtml(P) {
        if (P.missing) return `<span class="bns-chip warn">Needs scores</span>`;
        if (P.level == null) return `<span class="bns-na">–</span>`;
        return `<span class="bns-lvl bns-l${Math.min(5, P.level)}${P.eligible ? "" : " no"}"${P.eligible ? "" : ` title="Under the minimum months: not paid"`}>Level ${P.level}</span>`;
      }
      function deptHtml(d, i, D) {
        const ros = rosterById(), open = !S.fold.has(d.id), nm = esc(d.name);
        const rows = d.people.map((p, j) => {
          const P = D.people[j], r = ros.get(+p.rid);
          const sub = r ? [r.department, r.title].filter(Boolean).join(" · ") : "";
          const pn = (r && r.name) || p.name || ("#" + p.rid);
          const inp = k => { const b = kF(d, p, k);
            return `<input class="bns-in${boxCls(b)}" data-f="${k}" data-d="${i}" data-p="${j}" value="${esc(boxVal(b, p[k], BNS_MONEY.has(k)))}" inputmode="decimal" aria-label="${esc(pn)}, ${LABEL[k]}"${boxAttr(b)}>`; };
          const sc = k => (k === "peer" && !d.peer) ? `<span class="bns-na" title="The peer score is off for ${nm}">–</span>` : inp(k);
          return `<div class="bns-g row" role="row" data-row="${i}.${j}"${S.onlyMissing && !P.missing ? " hidden" : ""}>
            <div class="l" role="cell"><span class="bns-pn">${esc(pn)}</span>${r && !r.active ? `<span class="bns-left">not active in the directory</span>` : ""}
              <span class="bns-pd">${esc(sub)}</span></div>
            <div role="cell">${inp("s1")}</div><div role="cell">${inp("m1")}</div><div role="cell">${inp("s2")}</div><div role="cell">${inp("m2")}</div>
            <div role="cell" class="o" data-o="${i}.${j}.avg">${money(P.avg)}</div>
            <div role="cell">${sc("kpi")}</div><div role="cell">${sc("mgr")}</div><div role="cell">${sc("peer")}</div><div role="cell">${sc("hr")}</div>
            <div role="cell" class="o" data-o="${i}.${j}.idx">${P.missing ? "–" : pct1(P.idx)}</div>
            <div role="cell" data-o="${i}.${j}.lvl">${lvlHtml(P)}</div>
            <div role="cell" class="o" data-o="${i}.${j}.bonus">${money(P.bonus)}</div>
            <div role="cell">${inp("adj")}</div>
            <div role="cell" class="paid" data-o="${i}.${j}.paid">${money(P.paid)}</div>
            <div role="cell">${inp("raise")}</div><div role="cell">${inp("raiseMonths")}</div><div role="cell">${inp("training")}</div>
            <div role="cell"><button type="button" class="bns-ib del" aria-label="Remove ${esc(pn)} from ${S.cur}" data-act="del-person" data-d="${i}" data-p="${j}">×</button></div></div>`;
        }).join("");
        const onPlan = new Set(doc().depts.flatMap(x => x.people.map(p => +p.rid)));
        const byDept = {};
        S.roster.filter(r => r.active && !onPlan.has(r.id)).forEach(r => { (byDept[r.department || "No department"] =
          byDept[r.department || "No department"] || []).push(r); });
        const opts = Object.keys(byDept).sort().map(k => `<optgroup label="${esc(k)}">${byDept[k].map(r =>
          `<option value="${r.id}">${esc(r.name)}${r.title ? " — " + esc(r.title) : ""}</option>`).join("")}</optgroup>`).join("");
        const body = !open ? "" : `<div class="bns-tw"><div role="table" aria-label="${nm}">
            <div class="bns-g grp" aria-hidden="true"><div class="e"></div><div style="grid-column:2 / span 5">Salary this year</div>
              <div class="sc" style="grid-column:7 / span 6">Scores</div><div style="grid-column:13 / span 3">Bonus</div>
              <div class="nx" style="grid-column:16 / span 3">Next year</div><div class="e"></div></div>
            <div class="bns-g hd" role="row"><div class="l" role="columnheader">Person</div>
              <div role="columnheader">Salary</div><div role="columnheader">Months</div><div role="columnheader">Raised to</div><div role="columnheader">Months</div><div role="columnheader">Average</div>
              <div role="columnheader">KPI</div><div role="columnheader">Manager</div><div role="columnheader">Peer</div><div role="columnheader">HR</div><div role="columnheader">Index</div><div role="columnheader">Level</div>
              <div role="columnheader">Earned</div><div role="columnheader">Adjust</div><div role="columnheader">Paid</div>
              <div role="columnheader">Raise / mo</div><div role="columnheader">Months</div><div role="columnheader">Training</div><div></div></div>
            ${rows || `<div class="bns-g row"><div class="l" style="grid-column:1 / -1"><span class="bns-na">Nobody in ${nm} yet.</span></div></div>`}
          </div></div>
          <div class="bns-add"><label for="bns-pick-${i}">Add a person</label><select class="rs-sel" id="bns-pick-${i}" data-pick="${i}"><option value="">Choose from the Team Directory</option>${opts}</select>
            <button type="button" class="rs-btn" data-act="add-person" data-d="${i}">Add</button></div>`;
        return `<section class="bns-card bns-dept${open ? " open" : ""}">
          <div class="bns-dh">
            <button type="button" class="bns-fold" data-act="fold" data-d="${i}" aria-expanded="${open}" aria-label="${open ? "Fold" : "Unfold"} ${nm}">${CHEV}</button>
            <input class="bns-dname" data-dn="${i}" value="${nm}" maxlength="60" aria-label="Department name">
            <span class="bns-chip mute">${d.people.length} ${d.people.length === 1 ? "person" : "people"}</span>
            <span data-o="${i}.miss">${D.missing ? `<span class="bns-chip warn">${D.missing} need${D.missing === 1 ? "s" : ""} scores</span>` : ""}</span>
            <label class="bns-tg"><input type="checkbox" class="bns-sw" data-peer="${i}"${d.peer ? " checked" : ""}>Peer score</label>
            <span class="bns-sp"></span>
            <div class="bns-meter" data-o="${i}.meter">${meterHtml(D)}</div>
            <button type="button" class="bns-ib" data-act="up-dept" data-d="${i}" ${i ? "" : "disabled"} aria-label="Move ${nm} up">↑</button>
            <button type="button" class="bns-ib" data-act="down-dept" data-d="${i}" ${i < doc().depts.length - 1 ? "" : "disabled"} aria-label="Move ${nm} down">↓</button>
            <button type="button" class="bns-ib del" data-act="del-dept" data-d="${i}" aria-label="Remove ${nm}">×</button></div>
          ${body}
        </section>`;
      }

      /* refresh the computed parts without repainting the inputs (keeps the cursor where it is) */
      function refresh() {
        const R = compute(), st = doc().settings;
        const set = (sel, v, html) => { const e = host.querySelector(`[data-o="${sel}"]`); if (e) e[html ? "innerHTML" : "textContent"] = v; };
        R.depts.forEach((D, i) => {
          set(i + ".meter", meterHtml(D), true);
          set(i + ".miss", D.missing ? `<span class="bns-chip warn">${D.missing} need${D.missing === 1 ? "s" : ""} scores</span>` : "", true);
          D.people.forEach((P, j) => {
            set(`${i}.${j}.avg`, money(P.avg)); set(`${i}.${j}.idx`, P.missing ? "–" : pct1(P.idx));
            set(`${i}.${j}.lvl`, lvlHtml(P), true); set(`${i}.${j}.bonus`, money(P.bonus)); set(`${i}.${j}.paid`, money(P.paid));
          });
        });
        set("notes", notesHtml(R), true);
        set("strip", stripHtml(R), true);
        set("setsum", setSum(R), true);
        set("wtot", wtotHtml(R), true);
        set("ladder", ladderHtml(st), true);
        set("dcount", deptCount(R));
        paintKpis(R);
        const un = host.querySelector("#bns-unread");
        if (un) { un.hidden = !S.unread.size; un.textContent = S.unread.size ? unreadMsg() : ""; }
        const sv = host.querySelector('[data-act="save"]'); if (sv) sv.disabled = !S.dirty.size || S.saving;
        const dc = host.querySelector('[data-o="dirty"]'); if (dc) dc.hidden = !S.dirty.size;
        const tb = host.querySelector(`.bns-seg [data-y="${S.cur}"]`); if (tb) tb.textContent = S.cur + (S.dirty.has(S.cur) ? " •" : "");
      }

      /* ---------------- events ---------------- */
      function wire() {
        const set = doc().settings;
        host.querySelectorAll("[data-s]").forEach(el => el.addEventListener(el.type === "checkbox" ? "change" : "input", () => {
          const k = el.dataset.s;
          if (k === "prorate") { set.prorate = el.checked; const t = el.parentNode.lastChild; if (t && t.nodeType === 3) t.nodeValue = el.checked ? "On" : "Off"; }
          else set[k] = readBox(el, kS(k), BNS_MONEY.has(k));
          markDirty(); refresh();
        }));
        host.querySelectorAll("[data-w]").forEach(el => el.addEventListener("input", () => {
          const [k, x] = el.dataset.w.split(".");
          set.weights[k][x] = fromPct(readBox(el, kW(el.dataset.w), false)); markDirty(); refresh();
        }));
        host.querySelectorAll("[data-l]").forEach(el => el.addEventListener("input", () => {
          const [i, k] = el.dataset.l.split("."), v = readBox(el, kL(el.dataset.l), false);
          set.levels[+i][k] = k === "min" ? fromPct(v) : v; markDirty(); refresh();
        }));
        host.querySelectorAll("[data-f]").forEach(el => el.addEventListener("input", () => {
          const d = doc().depts[+el.dataset.d], p = d.people[+el.dataset.p], f = el.dataset.f;
          p[f] = readBox(el, kF(d, p, f), BNS_MONEY.has(f)); markDirty(); refresh();
        }));
        host.querySelectorAll("[data-dn]").forEach(el => el.addEventListener("input", () => {
          doc().depts[+el.dataset.dn].name = el.value; markDirty(); refresh();
        }));
        host.querySelectorAll("[data-peer]").forEach(el => el.addEventListener("change", () => {
          doc().depts[+el.dataset.peer].peer = el.checked; markDirty(); paint();
        }));
        const det = host.querySelector(".bns-set");
        if (det) det.addEventListener("toggle", () => { S.openSet = det.open; });
        // one delegated click handler: buttons inside parts that refresh() redraws keep working
        host.onclick = e => { const el = e.target.closest("[data-act]"); if (el && host.contains(el) && !el.disabled) act(el.dataset.act, el); };
      }

      async function act(a, el) {
        const D = doc().depts;
        if (a === "year") { S.cur = +el.dataset.y; say(""); paint(); return; }
        if (a === "how") { S.how = !S.how; paint(); return; }
        if (a === "missing") { S.onlyMissing = !S.onlyMissing; if (S.onlyMissing) D.forEach(d => S.fold.delete(d.id)); paint(); return; }
        if (a === "fold-all") { const all = D.every(d => S.fold.has(d.id)); D.forEach(d => all ? S.fold.delete(d.id) : S.fold.add(d.id)); paint(); return; }
        if (a === "add-year") {
          const ys = yearsList(), last = ys[ys.length - 1], src = S.years[last].doc, y = last + 1;
          // AN EXACT COPY of the year before (Gvantsa, 10 Nov: "next years rom vacvebi minda cina celi
          // kopirdebodes zustad"): every setting, department, person, salary, score, adjustment, raise,
          // training and note, as they are. She changes what is different for the new year herself.
          const nd = normalize(clone(src));
          S.years[y] = { version: 0, doc: nd, orig: null, updated_by: null, updated_at: null };
          S.cur = y; S.dirty.add(y);
          say(y + " is an exact copy of " + last + ": every setting, person, salary and score. Change what is "
            + "different for " + y + "; its bonuses follow its gross profit against " + last + "'s. Nothing is saved until you press Save.");
          paint(); return;
        }
        if (a === "del-year") {
          const y = S.cur, Yr = Y();
          const ok = await bnsConfirm({ t: "Remove " + y + "?", danger: true, yes: "Remove " + y,
            b: Yr.version ? "The " + y + " plan, with every salary and score in it, is deleted for everyone. A copy stays in the log." :
              "This year was never saved; it is simply dropped." });
          if (!ok) return;
          try {
            if (Yr.version) await post({ action: "delete", year: y, version: Yr.version });
            delete S.years[y]; S.dirty.delete(y);
            [...S.unread.keys()].forEach(k => { if (+k.split("|")[1] === y) S.unread.delete(k); });
            const ys = yearsList();
            if (!ys.length) { S.loaded = false; return load(); }
            S.cur = ys[ys.length - 1]; say(y + " removed."); paint();
          } catch (e) { say(e.message || String(e), true); paint(); }
          return;
        }
        if (a === "save") return save();
        if (a === "add-dept") {
          const inp = host.querySelector("#bns-newname"), name = (inp && inp.value || "").trim();
          if (!name) { say("Type the new department's name first.", true); paint(); return; }
          if (D.some(d => d.name.toLowerCase() === name.toLowerCase())) { say("There is already a department called " + name + ".", true); paint(); return; }
          D.push({ id: newId(), name, peer: false, people: [] }); markDirty(); say(""); paint(); return;
        }
        const i = +el.dataset.d;
        if (a === "fold") { const id = D[i].id; S.fold.has(id) ? S.fold.delete(id) : S.fold.add(id); paint(); return; }
        if (a === "up-dept" && i > 0) { [D[i - 1], D[i]] = [D[i], D[i - 1]]; markDirty(); paint(); return; }
        if (a === "down-dept" && i < D.length - 1) { [D[i + 1], D[i]] = [D[i], D[i + 1]]; markDirty(); paint(); return; }
        if (a === "del-dept") {
          const ok = !D[i].people.length || await bnsConfirm({ t: "Remove " + D[i].name + "?", danger: true, yes: "Remove",
            b: "Its " + D[i].people.length + " people and their numbers leave " + S.cur + " too (once you save)." });
          if (!ok) return;
          dropUnread("f|" + S.cur + "|" + D[i].id + "|");
          D.splice(i, 1); markDirty(); paint(); return;
        }
        if (a === "del-person") {
          const p = D[i].people[+el.dataset.p], r = rosterById().get(+p.rid);
          const ok = await bnsConfirm({ t: "Remove " + ((r && r.name) || p.name) + "?", yes: "Remove",
            b: "Their salary and scores leave " + S.cur + " (once you save)." });
          if (!ok) return;
          dropUnread("f|" + S.cur + "|" + D[i].id + "|" + p.rid + "|");
          D[i].people.splice(+el.dataset.p, 1); markDirty(); paint(); return;
        }
        if (a === "add-person") {
          const sel = host.querySelector(`[data-pick="${i}"]`), rid = sel && +sel.value;
          if (!rid) { say("Pick a person from the Team Directory list first.", true); paint(); return; }
          const r = rosterById().get(rid);
          D[i].people.push({ rid, name: r ? r.name : "", s1: null, m1: 12, s2: null, m2: null, kpi: null, mgr: null,
                             peer: null, hr: null, adj: null, raise: null, raiseMonths: null, training: null, note: "" });
          markDirty(); say(""); paint();
        }
      }

      /* someone saved year y after it was opened here: put this tab's changes on top of their save */
      async function rebase(y) {
        const Yr = S.years[y], j = await api("/api/_bonus");
        if (j.roster) S.roster = j.roster;
        const t = (j.years || []).filter(x => x.year === y)[0];
        if (!t) {
          Yr.version = 0; Yr.orig = null;
          return y + " was removed by someone while you were editing it. Your version is still here: press Save to keep it.";
        }
        const theirs = normalize(t.doc);
        const m = bnsMerge(Yr.orig || { settings: {}, depts: [] }, Yr.doc, theirs);
        S.years[y] = { version: t.version, doc: normalize(m.doc), orig: clone(theirs), updated_by: t.updated_by,
                       updated_by_name: t.updated_by_name, updated_at: t.updated_at };
        return who(t.updated_by_name, t.updated_by) + " saved " + y + " on " + when(t.updated_at) + ", while you were editing. "
          + "Your changes are kept on top of theirs" + (m.clashes ? "; " + m.clashes + (m.clashes === 1 ? " box you both changed keeps" : " boxes you both changed keep") + " your value" : "")
          + ". Check them, then press Save again.";
      }

      async function save() {
        if (S.saving || !S.dirty.size) return;
        if (S.unread.size) {
          // never save around a box that can't be read: show the first red one instead
          const ys = unreadYears();
          if (!ys.includes(S.cur)) S.cur = ys[0];
          if ([...S.unread.keys()].some(k => /^[swl]\|/.test(k) && +k.split("|")[1] === S.cur)) S.openSet = true;
          [...S.unread.keys()].forEach(k => { const p = k.split("|"); if (p[0] === "f" && +p[1] === S.cur) S.fold.delete(p[2]); });
          say(""); paint();
          const first = host.querySelector("input.bns-unread, .bns-unread input");
          if (first) { first.focus(); first.select(); }
          return;
        }
        S.saving = true; say(""); paint();
        const ros = rosterById(), notes = [];
        try {
          for (const y of [...S.dirty].sort((a, b) => a - b)) {
            const Yr = S.years[y];
            if (!Yr) { S.dirty.delete(y); continue; }
            Yr.doc.depts.forEach(d => d.people.forEach(p => { const r = ros.get(+p.rid); if (r) p.name = r.name; }));
            try {
              const j = await post({ action: "save", year: y, version: Yr.version, doc: Yr.doc });
              S.years[y] = yearOf(j);
              S.dirty.delete(y);
            } catch (e) {
              if (e.code !== "conflict" && e.code !== "gone") throw e;
              notes.push(await rebase(y));          // keeps y unsaved, on top of their version
            }
          }
          if (notes.length) say(notes.join(" "), true); else say("Saved.");
        } catch (e) {
          say("Not saved: " + (e.message || String(e)), true);
        }
        S.saving = false;
        if (alive()) paint();
      }

      // a return visit keeps unsaved edits; otherwise it reads the latest from the bridge
      if (S.loaded && S.dirty.size) paint(); else { S.loaded = false; load(); }
      paint();
    },
  });
})();
