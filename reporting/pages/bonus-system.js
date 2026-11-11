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
   - GROWTH: when the year's GP beats the baseline, every bonus and the 2-month budget scale up by the
     same ratio. A decline never shrinks anything (the multiplier floors at x1).

   His decisions (10 Nov): salaries and scores are TYPED here, and so is GROSS PROFIT -- both the
   year's estimate and last year's baseline ("the gross profit we calculate is not proper gross profit
   as we don't account for most in house expenses - it should be written and no reference needed"), so
   the page reads no portal dataset at all. People come from the TEAM DIRECTORY (hrq_roster), each with
   a bonus department that may differ from the directory's; and the page is open to NAMED PEOPLE ONLY --
   the bridge decides (bridge/bonus.py) and tells the shell through /api/_me `named`; an admin does not
   bypass it. Nothing about who is named lives in this public file.

   Gvantsa's fixes (11 Nov, ZTZ-63): "Add next year" copies the year before EXACTLY (scores, salaries,
   raises, training, notes, settings); "Headroom left" = target less (bonuses paid + raises + training). */

/* BNS-ENGINE-START -- pure: no DOM, no RS. tests/test_bonus_system.py runs this block in node. */
const BNS_BUDGET_MONTHS = 2;   // "every department's budget is 2 months' salary per current employee"
function bnsCompute(doc) {
  const st = (doc && doc.settings) || {};
  const n = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
  const z = v => n(v) || 0;
  const est = z(st.estGP);
  const base = n(st.baselineGP);
  const growth = base > 0 && est > 0 ? Math.max(1, est / base) : 1;
  const target = est * z(st.targetPct) / 100;
  const maxScore = z(st.maxScore) || 5;
  const W = st.weights || {};
  const levels = (st.levels || []).map((l, i) => ({ n: i + 1, min: z(l.min), months: z(l.months) }));
  const out = { est, base, growth, target, depts: [], warn: [] };
  const KEYS = { general: ["kpi", "mgr", "hr"], peer: ["kpi", "mgr", "peer", "hr"] };
  Object.keys(KEYS).forEach(k => {
    const t = KEYS[k].reduce((a, x) => a + z((W[k] || {})[x]), 0);
    out.warn.push({ set: k, total: t, ok: Math.abs(t - 1) < 1e-6 });
  });
  const T = { budget: 0, spend: 0, raises: 0, training: 0, people: 0 };
  ((doc && doc.depts) || []).forEach(d => {
    const set = d.peer ? "peer" : "general", w = W[set] || {};
    const need = KEYS[set].filter(k => z(w[k]) > 0);
    const D = { id: d.id, name: d.name, peer: !!d.peer, people: [], sumAvg: 0, spend: 0, raises: 0, training: 0 };
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
      D.people.push({ rid: p.rid, name: p.name, months, avg, idx, level: lvl ? lvl.n : null,
                      eligible, bonus, paid, raiseCost, training });
      D.sumAvg += avg; D.spend += paid; D.raises += raiseCost; D.training += training;
    });
    D.budget = BNS_BUDGET_MONTHS * D.sumAvg * growth;
    D.share = est > 0 ? D.budget / est : null;
    D.unspent = D.budget - D.spend - D.raises - D.training;
    T.budget += D.budget; T.spend += D.spend; T.raises += D.raises; T.training += D.training;
    T.people += D.people.length;
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
/* BNS-ENGINE-END */

(function () {
  const PAGE_ID = "bonus-system";
  const SCORE_KEYS = [["kpi", "KPI"], ["mgr", "Manager"], ["peer", "Peer"], ["hr", "HR eval."]];
  const DEFAULTS = {
    estGP: null, baselineGP: null, targetPct: 2,
    prorate: true, minMonths: 3, maxScore: 5,
    weights: { general: { kpi: 0.65, mgr: 0.3, hr: 0.05 }, peer: { kpi: 0.6, mgr: 0.3, peer: 0.05, hr: 0.05 } },
    levels: [{ min: 0, months: 0 }, { min: 0.5, months: 0.5 }, { min: 0.65, months: 1 },
             { min: 0.8, months: 1.5 }, { min: 0.95, months: 2 }],
  };
  const clone = o => JSON.parse(JSON.stringify(o));

  function injectStyle() {
    if (document.getElementById("bns-style")) return;
    const st = document.createElement("style");
    st.id = "bns-style";
    st.textContent = ""
      + ".bns{font-variant-numeric:tabular-nums}"
      + ".bns-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:0 0 12px}"
      + ".bns-bar .rs-tabs{margin:0}"
      + ".bns-sp{flex:1}"
      + ".bns-who{font-size:12px;color:var(--faint)}"
      + ".bns-dirty{display:inline-block;font-size:11.5px;font-weight:700;padding:3px 9px;border-radius:99px;"
      + "background:rgba(217,119,6,.14);color:#b45309}"
      + ".bns-msg{font-size:13px;margin:-4px 2px 12px;color:var(--muted)}"
      + ".bns-msg.bns-bad{color:#b91c1c;font-weight:600}"
      + ".bns-x{border:0;background:none;color:var(--faint);cursor:pointer;font-size:15px;line-height:1;padding:2px 5px;border-radius:6px}"
      + ".bns-x:hover{color:#b91c1c;background:rgba(220,38,38,.08)}"
      + ".bns-set{margin-bottom:14px}"
      + ".bns-set summary{cursor:pointer;font-weight:700;font-size:14px;color:var(--ink);padding:2px 0;list-style:none}"
      + ".bns-set summary::-webkit-details-marker{display:none}"
      + ".bns-set summary::before{content:'▸';display:inline-block;width:16px;color:var(--faint)}"
      + ".bns-set[open] summary::before{content:'▾'}"
      + ".bns-fields{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px 16px;margin:12px 0 4px}"
      + ".bns-f label{display:block;font-size:12px;font-weight:600;color:var(--muted);margin:0 0 4px}"
      + ".bns-f .bns-in{width:100%}"
      + ".bns-f .bns-src{font-size:11.5px;color:var(--faint);margin-top:4px;line-height:1.4}"
      + ".bns-h{font-size:13px;font-weight:700;color:var(--ink);margin:16px 0 8px}"
      + ".bns-wts{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px}"
      + ".bns-wt{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px 10px}"
      + ".bns-wt label{display:block;font-size:11.5px;color:var(--muted);margin-bottom:4px;font-weight:600}"
      + ".bns-tot{font-size:12.5px;color:var(--muted);margin-top:8px}"
      + ".bns-tot b.bns-off{color:#b91c1c}"
      + ".bns-lv{border-collapse:collapse;font-size:13px;min-width:420px}"
      + ".bns-lv th{text-align:left;font-size:11.5px;color:var(--faint);font-weight:700;padding:4px 10px 4px 0}"
      + ".bns-lv td{padding:3px 10px 3px 0}"
      + ".bns-how{font-size:12.5px;color:var(--muted);line-height:1.55;margin:14px 0 2px;max-width:1000px}"
      + ".bns-in{font:inherit;font-size:13px;padding:5px 7px;border:1px solid var(--line);border-radius:7px;"
      + "background:var(--panel);color:var(--ink);box-sizing:border-box;font-variant-numeric:tabular-nums}"
      + ".bns-in:focus{outline:none;border-color:var(--brand)}"
      + ".bns-in.bns-unread,.bns-in.bns-unread:focus{border-color:#dc2626;background:rgba(220,38,38,.10);box-shadow:inset 0 0 0 1px #dc2626}"
      + ".bns-in.bns-n{width:64px;text-align:right}"
      + ".bns-in.bns-s{width:52px;text-align:right}"
      + ".bns-in.bns-name{width:200px;font-weight:700;font-size:14.5px}"
      + ".bns-dept{border-left:4px solid var(--brand);margin-bottom:14px}"
      + ".bns-dh{display:flex;align-items:center;gap:10px;flex-wrap:wrap}"
      + ".bns-cnt{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px;background:var(--panel-2);color:var(--muted)}"
      + ".bns-tg{font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;cursor:pointer}"
      + ".bns-sw{appearance:none;width:32px;height:18px;border-radius:99px;background:var(--line);position:relative;"
      + "cursor:pointer;vertical-align:middle;transition:background .15s;margin:0}"
      + ".bns-sw:checked{background:var(--brand)}"
      + ".bns-sw::after{content:'';position:absolute;top:3px;left:3px;width:12px;height:12px;border-radius:50%;"
      + "background:#fff;transition:left .15s}"
      + ".bns-sw:checked::after{left:17px}"
      + ".bns-stats{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--muted);margin:10px 0 8px;align-items:center}"
      + ".bns-stats b{color:var(--ink)}"
      + ".bns-meter{width:120px;height:6px;border-radius:99px;background:var(--panel-2);overflow:hidden;display:inline-block}"
      + ".bns-meter i{display:block;height:100%;background:var(--brand)}"
      + ".bns-meter i.bns-over{background:#d1495b}"
      + ".bns-tw{overflow-x:auto}"
      + ".bns-t{border-collapse:collapse;font-size:13px;width:100%;min-width:1180px}"
      + ".bns-t th{font-size:10.5px;color:var(--faint);font-weight:800;text-transform:uppercase;letter-spacing:.05em;"
      + "text-align:right;padding:6px 5px;border-bottom:1px solid var(--line);white-space:nowrap}"
      + ".bns-t th.bns-l,.bns-t td.bns-l{text-align:left}"
      + ".bns-t td{padding:4px 5px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}"
      + ".bns-t td.bns-o{color:var(--muted)}"
      + ".bns-t td.bns-paid{font-weight:800;color:var(--ink)}"
      + ".bns-pn{font-weight:700;color:var(--ink)}"
      + ".bns-pd{display:block;font-size:11px;color:var(--faint);font-weight:500;max-width:240px;overflow:hidden;text-overflow:ellipsis}"
      + ".bns-left{font-size:10.5px;font-weight:700;color:#b45309;margin-left:6px}"
      + ".bns-na{color:var(--faint);font-size:12px}"
      + ".bns-lvl{display:inline-block;min-width:24px;text-align:center;font-size:11px;font-weight:800;padding:2px 6px;border-radius:99px}"
      + ".bns-l1{background:rgba(220,38,38,.12);color:#b91c1c}"
      + ".bns-l2{background:rgba(217,119,6,.14);color:#b45309}"
      + ".bns-l3{background:rgba(141,177,60,.22);color:#4d6b12}"
      + ".bns-l4{background:rgba(22,163,74,.16);color:#15803d}"
      + ".bns-l5{background:#14301F;color:#fff}"
      + ".bns-add{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap}"
      + ".bns-add .rs-sel{min-width:280px}"
      + ".bns-newd{display:flex;gap:8px;align-items:center;margin:4px 0 30px}"
      + ".bns-empty{padding:26px;text-align:center;color:var(--muted)}"
      + ".bns-cfm{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:9999}"
      + ".bns-cfm .bns-box{background:var(--panel);border-radius:14px;padding:20px 22px;max-width:440px;width:92%;box-shadow:0 20px 60px rgba(0,0,0,.25)}"
      + ".bns-cfm h3{margin:0 0 8px;font-size:16px;color:var(--ink)}"
      + ".bns-cfm p{margin:0 0 16px;font-size:13.5px;color:var(--muted);line-height:1.5}"
      + ".bns-cfm .bns-btns{display:flex;gap:8px;justify-content:flex-end}"
      + ".bns-btn-danger{background:#b91c1c !important;border-color:#b91c1c !important;color:#fff !important}";
    document.head.appendChild(st);
  }

  function bnsConfirm(o) {
    return new Promise(res => {
      const box = document.createElement("div");
      box.className = "bns-cfm";
      box.innerHTML = `<div class="bns-box"><h3>${o.t}</h3><p>${o.b}</p><div class="bns-btns">`
        + `<button class="rs-btn" data-no>${o.no || "Cancel"}</button>`
        + `<button class="rs-btn pri${o.danger ? " bns-btn-danger" : ""}" data-yes>${o.yes || "Confirm"}</button></div></div>`;
      document.body.appendChild(box);
      const done = v => { box.remove(); document.removeEventListener("keydown", onk); res(v); };
      const onk = e => { if (e.key === "Escape") done(false); };
      document.addEventListener("keydown", onk);
      box.querySelector("[data-yes]").onclick = () => done(true);
      box.querySelector("[data-no]").onclick = () => done(false);
      box.onclick = e => { if (e.target === box) done(false); };
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
      const pct1 = v => v == null ? "—" : (Math.round(v * 1000 + 1e-7) / 10).toFixed(1) + "%";
      const pct2 = v => v == null ? "—" : (v * 100).toFixed(2) + "%";
      const fv = v => v == null ? "" : String(v);
      const when = v => {
        if (!v) return "";
        const d = new Date(String(v).replace(" ", "T") + "Z");
        return isNaN(d) ? String(v) : d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short",
          day: "numeric", hour: "numeric", minute: "2-digit" }) + " NJ";
      };
      const thisYear = () => +new Date().toLocaleString("en-US", { timeZone: "America/New_York", year: "numeric" });
      const yearsList = () => Object.keys(S.years).map(Number).sort((a, b) => a - b);
      const Y = () => S.years[S.cur];
      const doc = () => Y().doc;
      const rosterById = () => { const m = new Map(); S.roster.forEach(r => m.set(r.id, r)); return m; };
      let seq = 0;
      const newId = () => "d" + Date.now().toString(36) + (seq++);
      const say = (m, bad) => { S.msg = m || ""; S.bad = !!bad; };
      const markDirty = () => { S.dirty.add(S.cur); };

      /* typed numbers: a box that cannot be read stays red with its text (kept across repaints by key)
         and Save refuses until it is fixed, so nothing typed is ever dropped quietly again */
      const kF = (d, p, f) => "f|" + S.cur + "|" + d.id + "|" + p.rid + "|" + f;
      const kS = k => "s|" + S.cur + "|" + k;
      const kW = k => "w|" + S.cur + "|" + k;
      const kL = k => "l|" + S.cur + "|" + k;
      const UNREAD_TIP = "This can't be read as a number. Type just the number, like 1500 or 3.5.";
      const boxVal = (key, v) => { const t = S.unread.get(key); return t != null ? t : fv(v); };
      const boxCls = key => S.unread.has(key) ? " bns-unread" : "";
      const boxAttr = key => S.unread.has(key) ? ` aria-invalid="true" title="${UNREAD_TIP}"` : "";
      function readBox(el, key, money) {
        const r = bnsParseNum(el.value, money);
        if (r.ok) S.unread.delete(key); else S.unread.set(key, el.value);
        el.classList.toggle("bns-unread", !r.ok);
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

      /* ---------------- loading ---------------- */
      function load() {
        S.err = ""; paint();
        return api("/api/_bonus").then(j => {
          S.years = {};
          (j.years || []).forEach(y => { S.years[y.year] = { version: y.version, doc: normalize(y.doc),
            updated_by: y.updated_by, updated_at: y.updated_at }; });
          S.roster = j.roster || []; S.me = j.me || "";
          S.dirty = new Set(); S.unread = new Map(); S.loaded = true;
          const ys = yearsList();
          if (!ys.length) {
            const y = thisYear();
            S.years[y] = { version: 0, doc: normalize({}), updated_by: null, updated_at: null };
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
      const compute = () => bnsCompute(doc());

      /* ---------------- painting ---------------- */
      function paint() {
        if (!alive() && S.loaded) return;
        injectStyle();
        const head = `<div class="rs-page-head"><h1>Bonus System</h1><p>Department bonus budgets from gross profit, each
          person's KPI, manager, peer and HR scores, and the bonuses, raises and training that follow. Calculated
          live; open only to the people named for it.</p></div>`;
        if (S.err) {
          host.innerHTML = `<div class="bns">${head}<section class="panel"><div class="bns-empty">${esc(S.err)}</div></section></div>`;
          return;
        }
        if (!S.loaded) {
          host.innerHTML = `<div class="bns">${head}<div class="rs-loading"><div>Loading <b>the bonus plan</b>…</div><div class="bar"><i></i></div></div></div>`;
          return;
        }
        const R = compute(), st = doc().settings, y = Y();
        const tabs = yearsList().map(yy => `<button class="rs-tab${yy === S.cur ? " on" : ""}" data-act="year" data-y="${yy}">${yy}${S.dirty.has(yy) ? " •" : ""}</button>`).join("");
        const saved = y.updated_by ? `Saved by ${esc(y.updated_by.split("@")[0])}, ${esc(when(y.updated_at))}` : "Not saved yet";
        host.innerHTML = `<div class="bns">${head}
          <div class="bns-bar"><div class="rs-tabs">${tabs}</div>
            <button class="rs-btn" data-act="add-year">+ Add next year</button>
            <span class="bns-sp"></span>
            <span class="bns-who">${saved}</span>
            ${S.dirty.size ? `<span class="bns-dirty">Unsaved changes</span>` : ""}
            <button class="rs-btn pri" data-act="save" ${S.dirty.size && !S.saving ? "" : "disabled"}>${S.saving ? "Saving…" : "Save"}</button></div>
          ${S.msg ? `<div class="bns-msg${S.bad ? " bns-bad" : ""}">${esc(S.msg)}</div>` : ""}
          <div class="bns-msg bns-bad" id="bns-unread" aria-live="polite"${S.unread.size ? "" : " hidden"}>${S.unread.size ? esc(unreadMsg()) : ""}</div>
          <div class="rs-kpis" id="bns-kpis"></div>
          ${settingsHtml(st, R)}
          <div id="bns-depts">${doc().depts.map((d, i) => deptHtml(d, i, R.depts[i])).join("")}</div>
          <div class="bns-newd"><input class="bns-in" id="bns-newname" placeholder="New department name" maxlength="60" style="width:240px">
            <button class="rs-btn" data-act="add-dept">+ Add department</button>
            <span class="bns-sp"></span>
            <button class="rs-btn" data-act="del-year">Remove ${S.cur}</button></div>
        </div>`;
        paintKpis(R);
        wire();
      }

      function paintKpis(R) {
        const k = host.querySelector("#bns-kpis");
        if (!k || !window.RSC || !RSC.kpis) return;
        const st = doc().settings, T = R.totals;
        const baseTxt = R.base == null ? "no baseline typed yet"
          : "vs baseline " + moneyM(R.base) + (R.growth > 1 ? " · growth ×" + R.growth.toFixed(3) : "");
        RSC.kpis(k, [
          { label: "Gross profit (estimate)", value: moneyM(R.est), sub: baseTxt },
          { label: "Target budget (" + (n(st.targetPct) || 0) + "% of GP)", value: money(R.target) },
          { label: "Total budget", value: money(T.budget), sub: pct2(T.budgetPct) + " of GP · " + T.people + " people" },
          { label: "Actual spend", value: money(T.spend), sub: "bonuses paid, after adjustments" },
          { label: "Committed", value: money(T.committed), sub: "budget + raises " + money(T.raises) + " + training " + money(T.training) },
          { label: "Headroom left", value: money(T.headroom), sub: "target less bonuses paid " + money(T.spend) + ", raises and training",
            tone: T.headroom < 0 ? "bad" : "" },
        ]);
      }

      function fld(label, key, val, extra) {
        const b = kS(key);
        return `<div class="bns-f"><label>${esc(label)}</label><input class="bns-in${boxCls(b)}" data-s="${key}" value="${esc(boxVal(b, val))}" inputmode="decimal"${boxAttr(b)}>${extra || ""}</div>`;
      }
      function settingsHtml(st, R) {
        const wset = (k, keys, title) => keys.map(([x, l]) => { const b = kW(k + "." + x); return `<div class="bns-wt"><label>${title} — ${l}</label>
            <input class="bns-in${boxCls(b)}" style="width:100%" data-w="${k}.${x}" value="${esc(boxVal(b, st.weights[k][x]))}" inputmode="decimal"${boxAttr(b)}></div>`; }).join("");
        const tot = w => R.warn.find(x => x.set === w);
        const totTxt = w => { const t = tot(w); return `<b class="${t.ok ? "" : "bns-off"}">${(t.total * 100).toFixed(1)}%</b>`; };
        const lbox = (i, f, v) => { const b = kL(i + "." + f);
          return `<input class="bns-in bns-n${boxCls(b)}" data-l="${i}.${f}" value="${esc(boxVal(b, v))}" inputmode="decimal"${boxAttr(b)}>`; };
        const lv = st.levels.map((l, i) => `<tr><td>Level ${i + 1}</td>
            <td>${lbox(i, "min", l.min)}</td>
            <td>${lbox(i, "months", l.months)}</td></tr>`).join("");
        return `<details class="panel bns-set"${S.openSet ? " open" : ""}><summary>Settings for ${S.cur}</summary>
          <div class="bns-fields">
            ${fld("Estimated full-year gross profit ($)", "estGP", st.estGP)}
            ${fld("Baseline gross profit ($), last year's, for the growth comparison", "baselineGP", st.baselineGP)}
            ${fld("Target bonus budget (% of gross profit)", "targetPct", st.targetPct)}
            <div class="bns-f"><label>Pro-rate bonus by months worked</label>
              <select class="rs-sel" style="width:100%" data-s="prorate"><option value="1"${st.prorate !== false ? " selected" : ""}>Yes</option>
                <option value="0"${st.prorate === false ? " selected" : ""}>No</option></select></div>
            ${fld("Minimum months to be eligible", "minMonths", st.minMonths)}
            ${fld("Max score on the rating scale", "maxScore", st.maxScore)}
          </div>
          <div class="bns-h">Evaluation weights</div>
          <div class="bns-wts">${wset("general", [["kpi", "KPI"], ["mgr", "Manager"], ["hr", "HR eval."]], "Standard")}
            ${wset("peer", [["kpi", "KPI"], ["mgr", "Manager"], ["peer", "Peer"], ["hr", "HR eval."]], "With peer")}</div>
          <div class="bns-tot">Standard total ${totTxt("general")} · With peer total ${totTxt("peer")} (each should be 100%)</div>
          <div class="bns-h">Bonus levels</div>
          <table class="bns-lv"><thead><tr><th>Level</th><th>Min index (0–1)</th><th>Bonus (months of salary)</th></tr></thead><tbody>${lv}</tbody></table>
          <div class="bns-how"><b>How this works:</b> every department's budget is ${BNS_BUDGET_MONTHS} months' salary per
            current person, whatever their tenure. Each person is paid exactly their own pro-rated, rating-based bonus;
            nothing is scaled up to spend a department's whole budget. A department scores KPI, Manager and HR
            evaluation, or with the peer switch on, a peer-feedback component too, each with its own weights.
            Nobody under the minimum months is paid. An adjustment moves the paid amount (never below $0).<br>
            <b>Gross profit</b> is typed here, both figures: the portal's own gross profit leaves out most in-house
            expenses, so it is not the one bonuses follow.<br>
            <b>Gross-profit growth:</b> if the estimate beats the baseline, every bonus and the ${BNS_BUDGET_MONTHS}-month
            budget scale up by the same ratio (GP up 16.7% → ×1.167). A decline never shrinks a bonus (the multiplier
            floors at ×1).</div>
        </details>`;
      }

      function deptHtml(d, i, D) {
        const ros = rosterById();
        const peerCols = d.peer;
        const rows = d.people.map((p, j) => {
          const P = D.people[j], r = ros.get(+p.rid);
          const sub = r ? [r.department, r.title].filter(Boolean).join(" · ") : "";
          const nm = (r && r.name) || p.name || ("#" + p.rid);
          const inp = (k, cls) => { const b = kF(d, p, k);
            return `<input class="bns-in ${cls}${boxCls(b)}" data-f="${k}" data-d="${i}" data-p="${j}" value="${esc(boxVal(b, p[k]))}" inputmode="decimal"${boxAttr(b)}>`; };
          const sc = k => (k === "peer" && !peerCols) ? `<span class="bns-na">n/a</span>` : inp(k, "bns-s");
          return `<tr>
            <td class="bns-l"><span class="bns-pn">${esc(nm)}</span>${r && !r.active ? `<span class="bns-left">not active in the directory</span>` : ""}
              <span class="bns-pd">${esc(sub)}</span></td>
            <td>${inp("s1", "bns-n")}</td><td>${inp("m1", "bns-s")}</td><td>${inp("s2", "bns-n")}</td><td>${inp("m2", "bns-s")}</td>
            <td class="bns-o" data-o="${i}.${j}.avg">${money(P.avg)}</td>
            <td>${sc("kpi")}</td><td>${sc("mgr")}</td><td>${sc("peer")}</td><td>${sc("hr")}</td>
            <td class="bns-o" data-o="${i}.${j}.idx">${pct1(P.idx)}</td>
            <td data-o="${i}.${j}.lvl">${lvlHtml(P)}</td>
            <td class="bns-o" data-o="${i}.${j}.bonus">${money(P.bonus)}</td>
            <td>${inp("adj", "bns-n")}</td>
            <td class="bns-paid" data-o="${i}.${j}.paid">${money(P.paid)}</td>
            <td>${inp("raise", "bns-n")}</td><td>${inp("raiseMonths", "bns-s")}</td><td>${inp("training", "bns-n")}</td>
            <td><button class="bns-x" title="Remove from ${esc(String(S.cur))}" data-act="del-person" data-d="${i}" data-p="${j}">×</button></td></tr>`;
        }).join("");
        const onPlan = new Set(doc().depts.flatMap(x => x.people.map(p => +p.rid)));
        const byDept = {};
        S.roster.filter(r => r.active && !onPlan.has(r.id)).forEach(r => { (byDept[r.department || "No department"] =
          byDept[r.department || "No department"] || []).push(r); });
        const opts = Object.keys(byDept).sort().map(k => `<optgroup label="${esc(k)}">${byDept[k].map(r =>
          `<option value="${r.id}">${esc(r.name)}${r.title ? " — " + esc(r.title) : ""}</option>`).join("")}</optgroup>`).join("");
        return `<section class="panel bns-dept">
          <div class="bns-dh">
            <input class="bns-in bns-name" data-dn="${i}" value="${esc(d.name)}" maxlength="60">
            <span class="bns-cnt">${d.people.length} ${d.people.length === 1 ? "person" : "people"}</span>
            <label class="bns-tg"><input type="checkbox" class="bns-sw" data-peer="${i}"${d.peer ? " checked" : ""}> Peer component</label>
            <span class="bns-sp"></span>
            <button class="rs-btn" data-act="up-dept" data-d="${i}" ${i ? "" : "disabled"} title="Move up">↑</button>
            <button class="rs-btn" data-act="down-dept" data-d="${i}" ${i < doc().depts.length - 1 ? "" : "disabled"} title="Move down">↓</button>
            <button class="bns-x" title="Remove department" data-act="del-dept" data-d="${i}">×</button></div>
          <div class="bns-stats" data-o="${i}.stats">${statsHtml(D)}</div>
          <div class="bns-tw"><table class="bns-t"><thead><tr><th class="bns-l">Name</th><th>Sal 1</th><th>Mo 1</th><th>Sal 2</th><th>Mo 2</th>
            <th>Avg</th><th>KPI</th><th>Mgr</th><th>Peer</th><th>HR</th><th>Idx</th><th>Lvl</th><th>Bonus</th><th>Adj</th><th>Paid</th>
            <th>Raise/mo</th><th>Raise mo.</th><th>Training</th><th></th></tr></thead>
            <tbody>${rows || `<tr><td class="bns-l" colspan="19"><span class="bns-na">Nobody in ${esc(d.name)} yet.</span></td></tr>`}</tbody></table></div>
          <div class="bns-add"><select class="rs-sel" data-pick="${i}"><option value="">Add a person from the Team Directory…</option>${opts}</select>
            <button class="rs-btn" data-act="add-person" data-d="${i}">Add to ${esc(d.name)}</button></div>
        </section>`;
      }
      function lvlHtml(P) {
        if (P.level == null) return `<span class="bns-na">—</span>`;
        return `<span class="bns-lvl bns-l${Math.min(5, P.level)}" title="${P.eligible ? "" : "under the minimum months: not paid"}">L${P.level}</span>`;
      }
      function statsHtml(D) {
        const used = D.budget > 0 ? (D.spend + D.raises + D.training) / D.budget : 0;
        return `<span>Budget <b>${money(D.budget)}</b></span><span>Share of GP <b>${pct2(D.share)}</b></span>
          <span>Spend <b>${money(D.spend)}</b></span><span>Next year's raises <b>${money(D.raises)}</b></span>
          <span>Unspent after raises &amp; training <b>${money(D.unspent)}</b></span>
          <span class="bns-meter"><i class="${used > 1 ? "bns-over" : ""}" style="width:${Math.min(100, Math.round(used * 100))}%"></i></span>`;
      }

      /* refresh the computed cells without repainting the inputs (keeps the cursor where it is) */
      function refresh() {
        const R = compute();
        R.depts.forEach((D, i) => {
          const s = host.querySelector(`[data-o="${i}.stats"]`); if (s) s.innerHTML = statsHtml(D);
          D.people.forEach((P, j) => {
            const set = (k, v, html) => { const e = host.querySelector(`[data-o="${i}.${j}.${k}"]`); if (e) e[html ? "innerHTML" : "textContent"] = v; };
            set("avg", money(P.avg)); set("idx", pct1(P.idx)); set("lvl", lvlHtml(P), true);
            set("bonus", money(P.bonus)); set("paid", money(P.paid));
          });
        });
        paintKpis(R);
        const un = host.querySelector("#bns-unread");
        if (un) { un.hidden = !S.unread.size; un.textContent = S.unread.size ? unreadMsg() : ""; }
        const sv = host.querySelector('[data-act="save"]'); if (sv) sv.disabled = !S.dirty.size || S.saving;
        const tb = host.querySelector(`.rs-tab[data-y="${S.cur}"]`); if (tb) tb.textContent = S.cur + (S.dirty.has(S.cur) ? " •" : "");
        const bar = host.querySelector(".bns-bar");
        if (bar && S.dirty.size && !bar.querySelector(".bns-dirty")) {
          const sp = document.createElement("span"); sp.className = "bns-dirty"; sp.textContent = "Unsaved changes";
          bar.insertBefore(sp, bar.querySelector('[data-act="save"]'));
        }
      }

      /* ---------------- events ---------------- */
      function wire() {
        const set = doc().settings;
        host.querySelectorAll("[data-s]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
          const k = el.dataset.s;
          if (k === "prorate") set.prorate = el.value === "1";
          else set[k] = readBox(el, kS(k), BNS_MONEY.has(k));
          markDirty(); refresh();
        }));
        host.querySelectorAll("[data-w]").forEach(el => el.addEventListener("input", () => {
          const [k, x] = el.dataset.w.split("."); set.weights[k][x] = readBox(el, kW(el.dataset.w), false); markDirty();
          const tot = host.querySelector(".bns-tot");
          refresh();
          if (tot) { const R = compute(); tot.innerHTML = ["general", "peer"].map(w => { const t = R.warn.find(q => q.set === w);
            return (w === "general" ? "Standard total " : "With peer total ") + `<b class="${t.ok ? "" : "bns-off"}">${(t.total * 100).toFixed(1)}%</b>`; })
            .join(" · ") + " (each should be 100%)"; }
        }));
        host.querySelectorAll("[data-l]").forEach(el => el.addEventListener("input", () => {
          const [i, k] = el.dataset.l.split("."); set.levels[+i][k] = readBox(el, kL(el.dataset.l), false); markDirty(); refresh();
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
        host.querySelectorAll("[data-act]").forEach(el => el.addEventListener("click", () => act(el.dataset.act, el)));
      }

      async function act(a, el) {
        const D = doc().depts;
        if (a === "year") { S.cur = +el.dataset.y; say(""); paint(); return; }
        if (a === "add-year") {
          const ys = yearsList(), last = ys[ys.length - 1], src = S.years[last].doc, y = last + 1;
          // AN EXACT COPY of the year before (Gvantsa, 10 Nov: "next years rom vacvebi minda cina celi
          // kopirdebodes zustad"): every setting, department, person, salary, score, adjustment, raise,
          // training and note, as they are. She changes what is different for the new year herself.
          const nd = normalize(clone(src));
          S.years[y] = { version: 0, doc: nd, updated_by: null, updated_at: null };
          S.cur = y; S.dirty.add(y);
          say(y + " is an exact copy of " + last + ": every setting, person, salary and score. Change what is "
            + "different for " + y + ". Nothing is saved until you press Save.");
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

      async function save() {
        if (S.saving || !S.dirty.size) return;
        if (S.unread.size) {
          // never save around a box that can't be read: show the first red one instead
          const ys = unreadYears();
          if (!ys.includes(S.cur)) S.cur = ys[0];
          if ([...S.unread.keys()].some(k => /^[swl]\|/.test(k) && +k.split("|")[1] === S.cur)) S.openSet = true;
          say(""); paint();
          const first = host.querySelector("input.bns-unread");
          if (first) { first.focus(); first.select(); }
          return;
        }
        S.saving = true; say(""); paint();
        const ros = rosterById();
        try {
          for (const y of [...S.dirty].sort((a, b) => a - b)) {
            const Yr = S.years[y];
            if (!Yr) { S.dirty.delete(y); continue; }
            Yr.doc.depts.forEach(d => d.people.forEach(p => { const r = ros.get(+p.rid); if (r) p.name = r.name; }));
            const j = await post({ action: "save", year: y, version: Yr.version, doc: Yr.doc });
            S.years[y] = { version: j.version, doc: normalize(j.doc), updated_by: j.updated_by, updated_at: j.updated_at };
            S.dirty.delete(y);
          }
          say("Saved.");
        } catch (e) {
          say(e.code === "conflict" || e.code === "gone" ? e.message : "Not saved: " + (e.message || String(e)), true);
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
