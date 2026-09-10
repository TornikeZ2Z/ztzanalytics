/* Seasonal Report — the whole busy season (default May–August) in one page, compared season
   over season. Built 2026-09-10 from the "Summer Report 2025" deck (Ani, 90 slides), which was
   used as a CHECKLIST of analyses, not as a design to copy.

   Why a separate page and not a Monthly Report mode: every number here is a WINDOW SUM (May 1 →
   Aug 31) compared with the same window in earlier years. Ratios (booking rate, netcash rate,
   per-$1 returns) are recomputed on the pooled window rows — never averaged month by month —
   so a quiet May cannot count as much as a busy July.

   Money follows the deck's own vocabulary: Total Bill, and Netcash + Card (the rs-core measure
   "Operating Profit Before Commission" = Net Cash + Card Payment, trips included). Gross Profit
   (the Monthly Report's measure) is shown once, in the headline, as the bridge between the two.

   Zip to Zip only, like the Monthly Report's default. */
async function renderSeasonal(host) {
  const CO = "Zip to Zip";
  const M = RS.M, esc = RSC.esc;
  const money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN;
  const num = v => (v == null || v === "" || isNaN(v)) ? 0 : +v;
  const pct = v => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";
  const pct0 = v => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(0) + "%";
  const x1 = v => v == null || !isFinite(v) ? "—" : "$" + v.toFixed(1);
  const MON = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const MS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const st = window.__srState || (window.__srState = { year: 0, from: 5, to: 8 });

  host.innerHTML = `<div class="srx"><div class="srx-loading">Reading every season on file…</div></div>`;

  /* ---------- data ---------- */
  const failures = [];
  const grab = ds => RS.load(ds).catch(e => { failures.push(ds); console.error("SR feed failed:", ds, e); return []; });
  const api = (label, url) => ZTZ.api(url).then(j => j.rows || []).catch(e => { failures.push(label); console.error("SR feed failed:", label, e); return []; });
  // helper_salaries / sales_salaries / refunds must be in RS's cache: Gross Profit reads them via _msr()
  const [closing, moveboard, claims, refunds, cardEx, scorecard, helperSal] = await Promise.all([
    grab("closing"), grab("moveboard"), grab("claims"), grab("refunds"), grab("card_expenses"),
    grab("scorecard"), grab("helper_salaries"), grab("sales_salaries")]);
  const [callrail, rcLine, rcAgent] = await Promise.all([
    grab("callrail"),
    api("RingCentral lines", "/api/mart_rc_monthly_line?limit=100000"),
    api("RingCentral teammates", "/api/mart_rc_monthly_agent?limit=100000")]);
  const DS = { closing, moveboard, claims, refunds, card_expenses: cardEx, callrail };
  /* Claims + reviews deep-dives read tables that are granted with Claims Analysis / Review Performance.
     They are OPTIONAL here: a reader without those pages gets a note on the section (never a red
     banner), and this page never widens who can reach the claims board — the grant stays where it is. */
  const opt = url => ZTZ.api(url).then(j => j.rows || []).catch(e => { console.warn("SR optional feed:", url, e); return null; });
  const colq = a => "&cols=" + encodeURIComponent(a.join(","));
  const [cmart, ckw, credit, jov, negrev, revbk, rcounts] = await Promise.all([
    opt("/api/mart_claims_analysis?limit=100000"),
    opt("/api/mart_claim_keywords?limit=100000" + colq(["Monday Item Id", "Family Used"])),
    opt("/api/mart_sales_credit?limit=300000" + colq(["Request Joinkey", "Sales Person", "Share"])),
    opt("/api/fct_job_overview?limit=100000" + colq(["Job Date", "Job No", "Customer", "Foreman", "Company", "Job Type", "Number of Reviews",
      "Review Breakdown", "Eligible", "Exclusion Reason", "Final Status", "Foreman Reason", "Request Joinkey"])),
    grab("negative_reviews"), grab("reviews_breakdown"), grab("review_counts")]);
  DS.negative_reviews = negrev; DS.reviews_breakdown = revbk;
  // a manager's correction of a claim's family (Claims Analysis) — read-only here, same precedence as that page
  const OV = {};
  try { if (ZTZ.API && ZTZ.getToken && cmart) { const res = await fetch(ZTZ.API + "/api/_claimoverride", { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
    if (res.ok) ((await res.json()).overrides || []).forEach(o => { OV[String(o["Monday Item Id"])] = o; }); } } catch (e) { /* no access or none yet */ }

  const coRow = r => r.Company == null || String(r.Company) === CO;
  // fct_claims has no Company column — attribute each claim through the company's own closings
  const coJk = new Set(closing.filter(r => String(r.Company) === CO).map(r => String(r["Request Joinkey"] || "")).filter(Boolean));

  /* ---------- the season window ---------- */
  const latest = closing.reduce((a, r) => (coRow(r) && r._d && r._d > a ? r._d : a), "");
  const lastDay = (y, m) => new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, "0");
  if (!st.year) {
    // the newest season whose window has fully ENDED in the data — never a half-run season by default
    const ly = latest ? +latest.slice(0, 4) : new Date().getFullYear();
    const endKey = `${ly}-${pad(st.to)}-${pad(lastDay(ly, st.to))}`;
    st.year = latest && latest >= endKey ? ly : ly - 1;
  }
  const Y = st.year, F = st.from, T = st.to, LY = Y - 1;
  const winLbl = F === T ? MS[F] : MS[F] + "–" + MS[T];
  const seasonName = (F === 5 && T === 8) ? "Summer" : winLbl;
  const YEARS = []; for (let y = 2023; y <= Y; y++) YEARS.push(y);   // 2023 cutoff: nothing earlier is on file
  const yy = y => "'" + String(y).slice(2);
  const winMonths = (() => { const a = []; for (let m = F; m <= T; m++) a.push(m); return a; })();

  /* withWin: the Monthly Report's withMonth, widened to a window. Every RS.filtered call and every
     composite measure (_msr reads the GLOBAL state) sees exactly [from..to] of year y and Zip to Zip. */
  function withWin(y, fn, mFrom, mTo) {
    const S = RS.state, sv = { f: S.dateFrom, t: S.dateTo, df: S.dayFrom, dt: S.dayTo, m: S.multi };
    const a = mFrom || F, b = mTo || T;
    S.dateFrom = `${y}-${pad(a)}-01`; S.dateTo = `${y}-${pad(b)}-${pad(lastDay(y, b))}`;
    S.dayFrom = S.dayTo = null; S.multi = { company: new Set([CO]) };
    try { return fn(); } finally { S.dateFrom = sv.f; S.dateTo = sv.t; S.dayFrom = sv.df; S.dayTo = sv.dt; S.multi = sv.m; }
  }
  const _rc = new Map();
  function rows(ds, y, dateColumn, mFrom, mTo) {
    const key = [ds, y, dateColumn || "", mFrom || F, mTo || T].join("|");
    if (_rc.has(key)) return _rc.get(key);
    const out = !DS[ds] || !DS[ds].length ? [] : withWin(y, () => RS.filtered(ds, DS[ds], dateColumn ? { dateColumn } : undefined), mFrom, mTo);
    _rc.set(key, out); return out;
  }
  const cl = (y, a, b) => rows("closing", y, null, a, b);
  const bill = rs => M["Total Bill"].fn(rs);
  const ncc = rs => M["Operating Profit Before Commission"].fn(rs);
  const gpOf = y => withWin(y, () => M["Operational Profit by Formula"] ? M["Operational Profit by Formula"].fn(RS.filtered("closing", DS.closing)) : null);
  const created = (y, a, b) => rows("moveboard", y, null, a, b);
  const booked = (y, a, b) => rows("moveboard", y, "Booked Date", a, b);
  const qual = rs => rs.filter(r => String(r["Status Category"]) !== "Bad Lead").length;
  const conf = rs => rs.filter(r => String(r["Status Category"]) === "Confirmed").length;
  const isAd = r => Number(r["Is Advertising"]) === 1 || r["Is Advertising"] === true;
  const isLD = r => String(r["Moving Type"] || "") !== "Local Moving";
  const grp = (rs, keyFn) => { const g = new Map(); for (const r of rs) { const k = keyFn(r); if (k == null || k === "") continue; const a = g.get(k); if (a) a.push(r); else g.set(k, [r]); } return g; };
  const key = col => r => { const v = r[col]; return v == null || String(v).trim() === "" ? null : String(v).trim(); };
  const growth = (c, p) => (c == null || !p) ? null : (c - p) / Math.abs(p);
  // Post Card is booked per state ("Post Card - NJ") on some rows and pooled on others — pool for channel views
  const normSrc = s => /post ?card/i.test(String(s || "")) ? "Post Card" : String(s || "").trim();

  /* The ad ledger lags (card statements post ~a month late). Ad-based ratios compare LIKE FOR LIKE:
     if the picked season's last months are not posted yet, every year is cut to the same months. */
  const adLast = cardEx.filter(r => coRow(r) && isAd(r)).reduce((a, r) => { const d = String(r["Transaction Date"] || "").slice(0, 7); return d > a ? d : a; }, "");
  const adTo = (() => { if (!adLast) return null; const [ay, am] = adLast.split("-").map(Number); if (ay > Y || (ay === Y && am >= T)) return T; if (ay === Y && am >= F) return am; return null; })();
  const adCut = adTo != null && adTo < T;
  const adLbl = adTo == null ? "" : (F === adTo ? MS[F] : MS[F] + "–" + MS[adTo]);
  const adRows = y => adTo == null ? [] : rows("card_expenses", y, null, F, adTo).filter(isAd);

  /* ---------- palette (the Monthly Report's four-core system, so the two pages read as one family) ---------- */
  const INK = "#0e1621", INK2 = "#1b2a3f", SUB = "#5a6775", FAINT = "#93a0b2", LINE = "#e4e9f0", GRID = "#eef1f6", AXIS = "#7b869a";
  const LIME = "#b7e23b", LIMED = "#7ba317", BLUE = "#2f6fd0", VIOLET = "#8b5cf6", CTX = "#c6d0db", CTX_H = "#aab6c4", INK_H = "#34465f";
  const POS = "#1c7a4a", NEG = "#b02a37", WARN = "#7a5a12", POS_T1 = "#e0f0e6", NEG_T1 = "#fbe6e7", WARN_BG = "#fff8ec", WARN_BD = "#f2d492", WARN_A = "#f5a524";
  const MONO = "ui-monospace, 'SF Mono', 'Cascadia Mono', 'Roboto Mono', Menlo, monospace";
  // one colour per SEASON: history steps from pale to ink, the picked season is lime
  const yearColor = y => y === Y ? LIME : ["#c6d0db", "#8a9bb2", "#4a6285", INK][Math.max(0, 3 - (Y - 1 - y))] || CTX;

  if (!document.getElementById("srx-css")) {
    const s = document.createElement("style"); s.id = "srx-css";
    s.textContent = `
    .srx{background:#f4f6fa;color:${INK};border-radius:16px;padding:24px 24px 46px;font-family:Inter,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
    .srx *{box-sizing:border-box}
    .srx-loading{padding:60px 0;text-align:center;color:${SUB};font-weight:700}
    .srx-cover{position:relative;background:${INK};color:#fff;border-radius:16px;padding:26px 28px 22px;margin-bottom:16px}
    .srx-cover:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:${LIME};border-radius:16px 0 0 16px}
    .srx-eyebrow{font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${LIME}}
    .srx-h1{font-size:34px;font-weight:900;letter-spacing:-1px;margin:6px 0 2px}
    .srx-h1 em{font-style:normal;color:${LIME}}
    .srx-cvsub{color:#a9b6c6;font-size:12.5px;font-weight:600;margin-top:6px}
    .srx-pick{display:flex;gap:8px;margin:12px 0 4px;flex-wrap:wrap}
    .srx-pick .rs-slicer-btn .val{color:#fff}
    .srx-pick .rs-slicer-btn .chev{color:#a9b6c6}
    .srx-pick .rs-slicer-pop{z-index:70}
    .srx-print{position:absolute;top:22px;right:24px;background:transparent;color:#a9b6c6;border:1px solid #2c3e57;border-radius:9px;padding:9px 13px;font-size:12.5px;font-weight:700;cursor:pointer}
    .srx-print:hover{color:#fff;border-color:#46607f}
    .srx-banner{display:flex;gap:11px;align-items:flex-start;background:${WARN_BG};border:1px solid ${WARN_BD};border-left:4px solid ${WARN_A};border-radius:11px;padding:11px 15px;font-size:13px;color:${WARN};font-weight:600;margin-bottom:10px;line-height:1.5}
    .srx-banner b{font-family:${MONO};color:${INK}}
    .srx-banner.bad{background:${NEG_T1};border-color:#e5b6ba;border-left-color:${NEG};color:#7a1f28}
    .srx-toc{position:sticky;top:-16px;z-index:28;background:#fff;box-shadow:0 4px 14px rgba(14,22,33,.12);border-bottom:1px solid ${LINE};display:flex;gap:6px;flex-wrap:wrap;padding:10px 24px;margin:0 -24px 8px}
    .srx-tocb{display:inline-flex;gap:7px;align-items:baseline;font:inherit;font-size:13px;font-weight:750;color:${INK2};background:#fff;border:1px solid ${LINE};border-radius:10px;padding:6px 12px;cursor:pointer;white-space:nowrap}
    .srx-tocb i{font-style:normal;font-family:${MONO};font-size:12px;color:${FAINT}}
    .srx-tocb:hover{border-color:${INK};background:${GRID}}
    .srx-part{position:relative;display:flex;align-items:center;gap:20px;background:${LIME}24;border:1px solid ${LIME}80;border-radius:16px;padding:20px 26px;margin:44px 0 18px;scroll-margin-top:70px}
    .srx-part:before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:${LIMED};border-radius:16px 0 0 16px}
    .srx-part .pl{flex:1;min-width:0}
    .srx-part .pt{font-size:29px;font-weight:900;letter-spacing:-.8px;line-height:1.05}
    .srx-part .ps{font-size:13.5px;font-weight:600;opacity:.65;margin-top:5px}
    .srx-part .pn{font-family:${MONO};font-weight:900;font-size:50px;letter-spacing:-3px;color:${LIMED};opacity:.85;line-height:.9}
    .srx-grid{display:grid;gap:15px;grid-template-columns:repeat(2,minmax(0,1fr))}
    .srx-grid.k{grid-template-columns:repeat(4,minmax(0,1fr))}
    @media(max-width:900px){.srx-grid{grid-template-columns:1fr}.srx-grid.k{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .srx-card{position:relative;display:flex;flex-direction:column;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:15px 16px;box-shadow:0 1px 2px rgba(14,22,33,.05);min-width:0}
    .srx-card:before{content:"";position:absolute;left:16px;top:0;width:34px;height:3px;background:${LIME};border-radius:0 0 3px 3px}
    .srx-card.span2{grid-column:1/-1}
    .srx-ch{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;border-bottom:1px solid ${GRID};padding-bottom:9px;margin-bottom:10px}
    .srx-ct{font-size:16px;font-weight:750;line-height:1.25}
    .srx-cs{font-size:12px;font-weight:700;color:${FAINT};text-transform:uppercase;letter-spacing:.04em;font-family:${MONO};margin-top:2px}
    .srx-hv{text-align:right;white-space:nowrap}
    .srx-hv b{display:block;font-family:${MONO};font-size:20px;font-weight:800;letter-spacing:-.4px}
    .srx-box{position:relative;height:320px;flex:1 0 auto}
    .srx-note{margin-top:10px;font-size:13px;color:${SUB};line-height:1.55;background:#f6f8fb;border-left:3px solid ${LIME};padding:8px 11px;border-radius:0 7px 7px 0}
    .srx-note.how{border-left-color:${CTX}}
    .srx-note b{color:${LIMED}}.srx-note.how b{color:${SUB}}
    .srx-kpi{position:relative;background:#fff;border:1px solid ${LINE};border-radius:14px;padding:14px 15px 13px;overflow:hidden}
    .srx-kpi:before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:${INK}}
    .srx-kpi.srx-hero:before{background:${LIME}}
    .srx-kl{font-size:12px;font-weight:750;color:${SUB};text-transform:uppercase;letter-spacing:.05em}
    .srx-kv{font-family:${MONO};font-size:28px;font-weight:800;letter-spacing:-.6px;margin:5px 0 7px;font-variant-numeric:tabular-nums}
    .srx-chip{display:inline-block;font-family:${MONO};font-size:12px;font-weight:750;padding:2px 7px;border-radius:5px;margin-right:4px}
    .srx-exec{background:${INK};color:#e8edf3;border-radius:12px;padding:15px 18px;font-size:13.5px;line-height:1.6}
    .srx-exec b{color:${LIME}}
    .srx-exec ul{margin:6px 0 0;padding-left:18px}
    .srx-scroll{overflow-x:auto}
    .srx-tbl{width:100%;border-collapse:collapse;font-size:13.5px;font-family:${MONO};font-variant-numeric:tabular-nums}
    .srx-tbl th{font-family:Inter,sans-serif;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${SUB};text-align:right;padding:7px 9px;border-bottom:2px solid ${INK};white-space:nowrap}
    .srx-tbl th:first-child,.srx-tbl td:first-child{text-align:left}
    .srx-tbl td{padding:7px 9px;text-align:right;border-bottom:1px solid ${GRID};color:${INK2};white-space:nowrap}
    .srx-tbl td:first-child{font-family:Inter,sans-serif;font-weight:600;color:${INK}}
    .srx-tbl tr.tot td{font-weight:800;border-top:2px solid ${INK};border-bottom:0;color:${INK}}
    .srx-tbl td.dim{color:${FAINT}}
    .srx-tbl th.grp{text-align:center;border-bottom:1px solid ${LINE};color:${INK2}}
    .srx-tbl .up{color:${POS};font-weight:800}.srx-tbl .dn{color:${NEG};font-weight:800}
    .srx-tbl td.ok{color:${POS};font-weight:800}.srx-tbl td.no{color:${NEG};font-weight:800}
    .srx-mx td{text-align:center}.srx-mx td:first-child{text-align:left}
    .srx-mx td small{display:block;font-size:11.5px;color:${FAINT};font-weight:600}
    .srx-strip{display:grid;grid-template-columns:minmax(260px,1.6fr) repeat(auto-fit,minmax(150px,1fr));gap:14px;align-items:stretch}
    .srx-big{background:${INK};color:#fff;border-radius:12px;padding:16px 18px;display:flex;flex-direction:column;gap:4px}
    .srx-big b{font-family:${MONO};font-size:40px;font-weight:900;letter-spacing:-1.5px;color:${LIME};line-height:1}
    .srx-big span{font-size:13px;font-weight:700;color:#e8edf3}
    .srx-big em{font-style:normal;font-size:12px;color:#a9b6c6;font-family:${MONO};margin-top:4px}
    .srx-big .srx-chip{align-self:flex-start;margin-top:4px}
    .srx-st{border:1px solid ${LINE};border-radius:12px;padding:12px 14px;background:#fff}
    .srx-st .l{font-size:12px;font-weight:750;color:${SUB};text-transform:uppercase;letter-spacing:.05em}
    .srx-st .v{font-family:${MONO};font-size:24px;font-weight:800;margin:5px 0 3px;letter-spacing:-.5px}
    .srx-st .s{font-size:12px;color:${FAINT};font-weight:600;line-height:1.4}
    .srx-tbl tr.srx-dr{cursor:pointer}
    .srx-tbl tr.srx-dr:hover td{background:#f6f8fb}
    .srx-tbl tr.srx-dr.open td{background:#eef3e0}
    .srx-tbl td.srx-car{width:18px;color:${LIMED};font-weight:800;padding-right:0}
    .srx-tbl tr.srx-det>td{background:#fbfcf7;white-space:normal;padding:10px 14px 14px;border-bottom:2px solid ${LIME}}
    .srx-tbl tr.small td{color:${FAINT}}
    .srx-mini{width:100%;border-collapse:collapse;font-size:12.5px;font-family:Inter,sans-serif}
    .srx-mini th{text-align:left;font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${SUB};padding:5px 8px;border-bottom:1px solid ${LINE}}
    .srx-mini td{text-align:left!important;padding:5px 8px;border-bottom:1px solid ${GRID};font-weight:500!important;color:${INK2}!important;font-family:Inter,sans-serif!important;white-space:nowrap}
    .srx-mini td.no{color:${NEG}!important;font-weight:700!important}
    .srx-minif{margin-top:6px;font-size:12px;color:${SUB};font-weight:600}
    .srx-pg{display:flex;justify-content:space-between;align-items:center;margin-top:10px;font-family:${MONO};font-size:12.5px;font-weight:700;color:${SUB}}
    .srx-pg button{font:inherit;border:1px solid ${LINE};background:#fff;color:${INK};border-radius:7px;padding:5px 12px;margin-left:6px;cursor:pointer}
    .srx-pg button[disabled]{opacity:.4;cursor:default}
    .srx-pg button.all{background:${LIME};border-color:${LIME};font-weight:800}
    .srx-link{color:${BLUE};font-weight:700;text-decoration:none;font-family:Inter,sans-serif}
    .srx-link:hover{text-decoration:underline}
    .srx-empty{height:100%;min-height:120px;display:grid;place-items:center;color:${FAINT};font-size:13px;font-weight:600}
    .srx-gap li{margin:4px 0}
    @media print{
      html,body{height:auto!important;overflow:visible!important}
      body.rs-app,.rs-layout,.rs-main,.rs-content,#content,#app{height:auto!important;overflow:visible!important;display:block!important}
      .rs-side,.rs-filters,.rs-chips,.rs-topbar,header,.srx-toc,.srx-print,.srx-pick{display:none!important}
      .srx{background:#fff;padding:0}.srx-card,.srx-kpi,.srx-part{break-inside:avoid}
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
    }`;
    document.head.appendChild(s);
  }

  /* ---------- chart primitives ---------- */
  const tipTheme = { backgroundColor: INK, titleColor: "#fff", bodyColor: "#e8edf3", borderColor: "#2c3e57", borderWidth: 1, cornerRadius: 7, padding: 9,
    titleFont: { family: "Inter", weight: "700", size: 12 }, bodyFont: { family: MONO, size: 12 }, boxWidth: 9, boxHeight: 9, usePointStyle: true };
  const legend = on => ({ display: !!on, position: "top", align: "end", labels: { color: SUB, font: { size: 12.5, weight: "600" }, boxWidth: 9, boxHeight: 9, usePointStyle: true } });
  const base = (extra, fmtTip) => Object.assign({ __solidBars: true, maintainAspectRatio: false, animation: false,
    interaction: { mode: "index", axis: extra && extra.indexAxis === "y" ? "y" : "x", intersect: false },
    plugins: { legend: legend(false), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => (x.dataset.label ? x.dataset.label + ": " : "") + fmtTip(extra && extra.indexAxis === "y" ? x.parsed.x : x.parsed.y) } }) } }, extra || {});
  const axX = () => ({ ticks: { color: AXIS, font: { family: MONO, size: 12 } }, grid: { display: false }, border: { color: LINE } });
  const axY = (fmt, o) => Object.assign({ beginAtZero: true, ticks: { color: AXIS, font: { family: MONO, size: 12 }, maxTicksLimit: 6, callback: v => fmt(v) }, grid: { color: GRID }, border: { display: false } }, o || {});
  const axCat = () => ({ ticks: { color: INK2, font: { size: 12.5, weight: "600" } }, grid: { display: false }, border: { display: false } });
  const lab = c => c === LIME ? LIMED : c === CTX ? AXIS : c;
  const valLabels = (fmt, horiz) => ({ id: "srlab", afterDatasetsDraw(ch) {
    const ctx = ch.ctx; ctx.save(); ctx.font = "700 12px " + MONO;
    ch.data.datasets.forEach((d, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden || meta.type === "line") return;
      meta.data.forEach((el, i) => { const v = d.data[i]; if (v == null || isNaN(v)) return;
        const col = Array.isArray(d.backgroundColor) ? d.backgroundColor[i] : d.backgroundColor; ctx.fillStyle = lab(col) === LIME ? LIMED : (lab(col) || INK);
        if (horiz) { ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText(fmt(v), el.x + 5, el.y); }
        else { ctx.textAlign = "center"; ctx.textBaseline = "bottom"; ctx.fillText(fmt(v), el.x, el.y - 4); } }); });
    ctx.restore(); } });
  const lineLabels = fmt => ({ id: "srlline", afterDatasetsDraw(ch) {
    const ctx = ch.ctx; ctx.save(); ctx.font = "700 12px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
    ch.data.datasets.forEach((d, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden || meta.type !== "line") return;
      ctx.fillStyle = lab(d.borderColor); meta.data.forEach((el, i) => { const v = d.data[i]; if (v == null || isNaN(v)) return; ctx.fillText(fmt(v), el.x, el.y - 7); }); });
    ctx.restore(); } });

  let bodyEl, partN = 0; const tocItems = [];
  function part(title, sub) {
    partN++; const el = document.createElement("div"); el.className = "srx-part"; el.id = "srxp" + partN;
    el.innerHTML = `<div class="pl"><div class="pt">${esc(title)}</div><div class="ps">${esc(sub || "")}</div></div><div class="pn">${pad(partN)}</div>`;
    bodyEl.appendChild(el); tocItems.push({ n: partN, title, el });
    const g = document.createElement("div"); g.className = "srx-grid"; bodyEl.appendChild(g); return g;
  }
  function kgrid() { const g = document.createElement("div"); g.className = "srx-grid k"; bodyEl.appendChild(g); return g; }
  function card(mount, title, sub, opts) {
    opts = opts || {}; const c = document.createElement("div"); c.className = "srx-card" + (opts.span2 ? " span2" : "");
    c.innerHTML = `<div class="srx-ch"><div><div class="srx-ct">${esc(title)}</div>${sub ? `<div class="srx-cs">${esc(sub)}</div>` : ""}</div>${opts.head != null ? `<div class="srx-hv"><b>${opts.head}</b>${opts.chips || ""}</div>` : ""}</div>`;
    mount.appendChild(c); return c;
  }
  function note(c, txt, how) {
    if (!txt) return; const n = document.createElement("div"); n.className = "srx-note" + (how ? " how" : "");
    n.innerHTML = `<b>${how ? "How it's counted · " : "Insight · "}</b>${esc(txt)}`; c.appendChild(n);
  }
  function chartBox(c, h) { const b = document.createElement("div"); b.className = "srx-box"; if (h) b.style.height = h + "px"; const cv = document.createElement("canvas"); b.appendChild(cv); c.appendChild(b); return { b, cv }; }
  const empty = (b, msg) => { b.innerHTML = `<div class="srx-empty">${esc(msg || "No data in this window")}</div>`; };
  function chip(c, p, inv, lbl) {
    const g = growth(c, p); if (g == null) return `<span class="srx-chip" style="background:${GRID};color:${SUB}">${lbl || "vs " + yy(LY)} —</span>`;
    const good = inv ? g < 0 : g >= 0;
    return `<span class="srx-chip" style="background:${good ? POS_T1 : NEG_T1};color:${good ? POS : NEG}">${lbl || "vs " + yy(LY)} ${g >= 0 ? "▲" : "▼"} ${Math.abs(g * 100).toFixed(0)}%</span>`;
  }
  const dcell = (c, p, inv) => { const g = growth(c, p); if (g == null) return `<td class="dim">—</td>`; const good = inv ? g < 0 : g >= 0; return `<td class="${good ? "up" : "dn"}">${g >= 0 ? "+" : ""}${(g * 100).toFixed(0)}%</td>`; };
  // for a rate where lower is better (claims): the sign says which way it moved, the colour says whether that is good
  const ppInv = (c, p) => { if (c == null || p == null || !isFinite(c) || !isFinite(p)) return `<td class="dim">—</td>`; const d = (c - p) * 100; return `<td class="${d <= 0 ? "up" : "dn"}">${d >= 0 ? "+" : ""}${d.toFixed(1)}pp</td>`; };
  const ppcell = (c, p) => { if (c == null || p == null || !isFinite(c) || !isFinite(p)) return `<td class="dim">—</td>`; const d = (c - p) * 100; return `<td class="${d >= 0 ? "up" : "dn"}">${d >= 0 ? "+" : ""}${d.toFixed(1)}pp</td>`; };

  // columns across SEASONS — one dataset, or several side by side (e.g. Total Bill vs Netcash + Card)
  function seasonCols(mount, title, sub, sets, fmt, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, opts.h);
    if (!sets.some(s => s.vals.some(v => v != null))) { empty(b); return c; }
    const single = sets.length === 1;
    new Chart(cv, { type: "bar", data: { labels: YEARS.map(String), datasets: sets.map((s, i) => ({ label: s.label, data: s.vals,
      backgroundColor: single ? YEARS.map(yearColor) : (s.color || [INK, BLUE, VIOLET][i]), borderRadius: 5, maxBarThickness: single ? 64 : 40, categoryPercentage: .72, barPercentage: .86 })) },
      options: base({ layout: { padding: { top: 24 } }, plugins: { legend: legend(!single), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => (single ? "" : x.dataset.label + ": ") + (opts.tip || fmt)(x.parsed.y) } }) },
        scales: { x: axX(), y: axY(opts.axis || moneyC) } }, fmt), plugins: [valLabels(opts.lbl || fmt, false)] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // this season vs last, horizontal pairs per category
  function pairBars(mount, title, sub, labels, prev, cur, fmt, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, Math.max(210, 50 + labels.length * 34));
    if (!labels.length) { empty(b); return c; }
    new Chart(cv, { type: "bar", data: { labels, datasets: [
      { label: String(LY), data: prev, backgroundColor: CTX, hoverBackgroundColor: CTX_H, borderRadius: 3, maxBarThickness: 13 },
      { label: String(Y), data: cur, backgroundColor: INK, hoverBackgroundColor: INK_H, borderRadius: 3, maxBarThickness: 13 }] },
      options: base({ indexAxis: "y", layout: { padding: { right: 70 } }, plugins: { legend: legend(true), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.x) } }) },
        scales: { x: axY(opts.axis || fmt), y: axCat() } }, fmt), plugins: [valLabels(opts.lbl || fmt, true)] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  function rankBars(mount, title, sub, series, fmt, opts) {
    opts = opts || {}; const s = series.slice(0, opts.top || 14); const c = card(mount, title, sub, opts);
    const { b, cv } = chartBox(c, Math.max(210, 48 + s.length * 30)); if (!s.length) { empty(b); return c; }
    new Chart(cv, { type: "bar", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => i === 0 ? LIME : INK), hoverBackgroundColor: INK_H, borderRadius: 4, maxBarThickness: 20 }] },
      options: base({ indexAxis: "y", layout: { padding: { right: 70 } }, scales: { x: axY(opts.axis || fmt), y: axCat() } }, fmt), plugins: [valLabels(fmt, true)] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // bars + a line on its own axis (e.g. jobs vs hours, confirmed vs booking rate)
  function combo(mount, title, sub, labels, bars, barLbl, barFmt, line, lineLbl, lineFmt, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, opts.h);
    if (!labels.length) { empty(b); return c; }
    new Chart(cv, { data: { labels, datasets: [
      { type: "bar", label: barLbl, data: bars, backgroundColor: opts.barColors || labels.map(l => String(l) === String(Y) ? LIME : INK), borderRadius: 4, maxBarThickness: 46, yAxisID: "y", order: 2 },
      { type: "line", label: lineLbl, data: line, borderColor: BLUE, backgroundColor: BLUE, tension: 0, borderWidth: 2.6, pointRadius: 3.5, pointBackgroundColor: BLUE, pointBorderColor: "#fff", yAxisID: "y1", order: 1 }] },
      options: base({ layout: { padding: { top: 22, right: 8 } }, plugins: { legend: legend(true), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => x.dataset.yAxisID === "y1" ? lineLbl + ": " + lineFmt(x.parsed.y) : barLbl + ": " + barFmt(x.parsed.y) } }) },
        scales: { x: Object.assign(axX(), opts.rotate ? { ticks: { color: AXIS, font: { family: MONO, size: 11.5 }, maxRotation: 55, minRotation: 40 } } : {}),
          y: axY(opts.barAxis || barFmt), y1: axY(lineFmt, { position: "right", grid: { display: false }, beginAtZero: true }) } }, barFmt),
      plugins: [valLabels(opts.barLbl || barFmt, false), lineLabels(lineFmt)] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // one line per season across the window's months — how each season unfolded
  function seasonShape(mount, title, sub, valFn, fmt, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, opts.h);
    const sets = YEARS.map(y => ({ label: String(y), data: winMonths.map(m => valFn(y, m)), borderColor: yearColor(y), backgroundColor: yearColor(y),
      borderWidth: y === Y ? 3.4 : 2, pointRadius: y === Y ? 4 : 2.5, pointBackgroundColor: yearColor(y), pointBorderColor: "#fff", tension: 0, fill: false }));
    if (!sets.some(s => s.data.some(v => v))) { empty(b); return c; }
    new Chart(cv, { type: "line", data: { labels: winMonths.map(m => MS[m]), datasets: sets },
      options: base({ layout: { padding: { top: 12, right: 12 } }, plugins: { legend: legend(true), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => x.dataset.label + ": " + fmt(x.parsed.y) } }) },
        scales: { x: axX(), y: axY(opts.axis || fmt, { beginAtZero: false }) } }, fmt) });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  function donut(mount, title, sub, series, fmt, opts) {
    opts = opts || {}; const pos = series.filter(r => r.v > 0); const head = pos.slice(0, 8), tail = pos.slice(8);
    const s = tail.length ? head.concat([{ k: `All others (${tail.length})`, v: tail.reduce((a, r) => a + r.v, 0) }]) : head;
    const tot = s.reduce((a, r) => a + r.v, 0); const c = card(mount, title, sub, Object.assign({ head: fmt(tot) }, opts)); const { b, cv } = chartBox(c, 300);
    if (!s.length) { empty(b); return c; }
    const COL = [INK, BLUE, VIOLET, LIME, "#4a6285", "#84aef0", "#c4aef9", LIMED, "#aeb9c8"];
    new Chart(cv, { type: "doughnut", data: { labels: s.map(r => r.k), datasets: [{ data: s.map(r => r.v), backgroundColor: s.map((_, i) => COL[i % COL.length]), borderColor: "#fff", borderWidth: 3 }] },
      options: { __solidBars: true, maintainAspectRatio: false, animation: false, cutout: "62%", plugins: { legend: { position: "right", labels: { color: INK2, font: { size: 12.5 }, boxWidth: 12, usePointStyle: true } },
        tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => `${x.label}: ${fmt(x.parsed)} (${(x.parsed / tot * 100).toFixed(0)}%)` } }) } },
      plugins: [{ id: "srdl", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 12px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ch.getDatasetMeta(0).data.forEach((el, i) => { const p = s[i].v / tot; if (p < .05) return; const pt = el.tooltipPosition(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.strokeText((p * 100).toFixed(0) + "%", pt.x, pt.y); ctx.fillStyle = "#fff"; ctx.fillText((p * 100).toFixed(0) + "%", pt.x, pt.y); }); ctx.restore(); } }] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // table: headers can carry a group row via opts.groups = [[label, span], ...]
  function table(mount, title, sub, headers, bodyRows, opts) {
    opts = opts || {}; const c = card(mount, title, sub, Object.assign({ span2: opts.span2 !== false }, opts));
    const g = opts.groups ? `<tr>${opts.groups.map(([l, n]) => `<th class="grp" colspan="${n}">${esc(l)}</th>`).join("")}</tr>` : "";
    const w = document.createElement("div"); w.className = "srx-scroll";
    w.innerHTML = bodyRows.length ? `<table class="srx-tbl${opts.matrix ? " srx-mx" : ""}"><thead>${g}<tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows.join("")}</tbody></table>` : `<div class="srx-empty">No data in this window</div>`;
    c.appendChild(w); if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  const td = (v, cls) => `<td${cls ? ` class="${cls}"` : ""}>${v}</td>`;
  const tdn = (v, fmt) => v == null || (typeof v === "number" && !isFinite(v)) ? `<td class="dim">—</td>` : `<td>${fmt ? fmt(v) : v}</td>`;

  // a table whose rows can open into the records behind them, and page past 15 rows.
  // rows = [{ h: "<td>…</td>…", d: detailHtml | null, cls }]; the detail is built when the row is built,
  // so "these are the records behind this number" is true by construction.
  function ptable(mount, title, sub, headers, rowsIn, opts) {
    opts = opts || {}; const c = card(mount, title, sub, Object.assign({ span2: opts.span2 !== false }, opts));
    const per = opts.per || 0, n = headers.length + (opts.drillCol ? 1 : 0);
    const g = opts.groups ? `<tr>${opts.drillCol ? "<th></th>" : ""}${opts.groups.map(([l, k]) => `<th class="grp" colspan="${k}">${esc(l)}</th>`).join("")}</tr>` : "";
    const w = document.createElement("div"); w.className = "srx-scroll"; c.appendChild(w);
    let page = 0, all = false;
    const draw = () => {
      if (!rowsIn.length) { w.innerHTML = `<div class="srx-empty">No data in this window</div>`; return; }
      const shown = per && !all ? rowsIn.slice(page * per, page * per + per) : rowsIn;
      w.innerHTML = `<table class="srx-tbl${opts.matrix ? " srx-mx" : ""}"><thead>${g}<tr>${opts.drillCol ? "<th></th>" : ""}${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>` +
        shown.map((r, i) => `<tr class="${r.cls || ""}${r.d ? " srx-dr" : ""}" data-i="${i}">${opts.drillCol ? `<td class="srx-car">${r.d ? "▸" : ""}</td>` : ""}${r.h}</tr>` +
          (r.d ? `<tr class="srx-det" hidden><td colspan="${n}">${r.d}</td></tr>` : "")).join("") +
        (opts.tot ? `<tr class="tot">${opts.drillCol ? "<td></td>" : ""}${opts.tot}</tr>` : "") + `</tbody></table>` +
        (per && rowsIn.length > per ? `<div class="srx-pg"><span>${all ? `all ${rowsIn.length}` : `${page * per + 1}–${Math.min(rowsIn.length, page * per + per)} of ${rowsIn.length}`}</span>
          <span>${all ? "" : `<button type="button" data-p="-1" ${page ? "" : "disabled"}>‹ prev</button><button type="button" data-p="1" ${(page + 1) * per < rowsIn.length ? "" : "disabled"}>next ›</button>`}<button type="button" data-p="all" class="all">${all ? "show pages" : "show all"}</button></span></div>` : "");
    };
    w.addEventListener("click", e => {
      const pb = e.target.closest("button[data-p]");
      if (pb) { const v = pb.dataset.p; if (v === "all") all = !all; else page += +v; draw(); return; }
      if (e.target.closest("a")) return;
      const tr = e.target.closest("tr.srx-dr"); if (!tr) return;
      const det = tr.nextElementSibling; if (!det || !det.classList.contains("srx-det")) return;
      det.hidden = !det.hidden; tr.classList.toggle("open", !det.hidden);
      const car = tr.querySelector(".srx-car"); if (car) car.textContent = det.hidden ? "▸" : "▾";
    });
    draw();
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // the records behind a number, as a compact inner table
  const mini = (headers, rowsH, foot) => `<table class="srx-mini"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rowsH.join("")}</tbody></table>${foot ? `<div class="srx-minif">${foot}</div>` : ""}`;
  const mondayLink = u => u && /^https:\/\//.test(String(u)) ? `<a class="srx-link" href="${esc(u)}" target="_blank" rel="noopener">Monday ↗</a>` : "";

  // quality map — two rates against each other, bubble = volume, dashed lines = the team's own average.
  // Colour answers "good on both / bad on both / mixed", so a reader never has to decode the axes first.
  function quadrant(mount, title, sub, pts, xf, yf, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, opts.h || 420);
    if (pts.length < 2) { empty(b, "Too few people with enough jobs to compare"); return c; }
    const maxR = Math.max(...pts.map(p => p.r || 1));
    // one extreme performer must not squash everyone else into a corner: cap the x axis where the
    // pack sits, pin the outlier to the edge with its true value written beside it (and in the hover)
    const xsS = pts.map(p => p.x).sort((a, b) => a - b), q9 = xsS[Math.floor(xsS.length * 0.9)] || xsS[xsS.length - 1];
    const xCap = Math.max(q9 * 1.5, (opts.xAvg || 0) * 1.6), clampX = xsS[xsS.length - 1] > xCap;
    const xa = opts.xAvg != null ? opts.xAvg : pts.reduce((a, p) => a + p.x, 0) / pts.length;
    const ya = opts.yAvg != null ? opts.yAvg : pts.reduce((a, p) => a + p.y, 0) / pts.length;
    const okX = p => opts.goodX === "low" ? p.x <= xa : p.x >= xa, okY = p => opts.goodY === "low" ? p.y <= ya : p.y >= ya;
    const col = p => okX(p) && okY(p) ? LIME : !okX(p) && !okY(p) ? NEG : BLUE;
    new Chart(cv, { type: "bubble", data: { datasets: [{ data: pts.map(p => ({ x: clampX ? Math.min(p.x, xCap) : p.x, rx: p.x, over: clampX && p.x > xCap, y: p.y, r: 5 + 16 * Math.sqrt((p.r || 1) / maxR), k: p.k, sz: p.r })),
      backgroundColor: pts.map(col), borderColor: "#fff", borderWidth: 1.5, hoverBorderColor: INK }] },
      options: { __solidBars: true, maintainAspectRatio: false, animation: false, layout: { padding: { top: 18, right: 24 } },
        plugins: { legend: { display: false }, tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => `${x.raw.k}: ${opts.xLabel} ${xf(x.raw.rx)} · ${opts.yLabel} ${yf(x.raw.y)} · ${fmtN(x.raw.sz)} ${opts.rLabel || "jobs"}` } }) },
        scales: { x: Object.assign(axY(xf, { beginAtZero: false }), clampX ? { max: xCap * 1.04 } : {}, { title: { display: true, text: opts.xLabel, color: SUB, font: { size: 12, weight: "700" } }, grid: { color: GRID } }),
          y: Object.assign(axY(yf, { beginAtZero: false }), { title: { display: true, text: opts.yLabel, color: SUB, font: { size: 12, weight: "700" } } }) } },
      plugins: [{ id: "srq", afterDatasetsDraw(ch) {
        const ctx = ch.ctx, a = ch.chartArea, X = ch.scales.x.getPixelForValue(xa), Yp = ch.scales.y.getPixelForValue(ya);
        ctx.save(); ctx.strokeStyle = FAINT; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(X, a.top); ctx.lineTo(X, a.bottom); ctx.moveTo(a.left, Yp); ctx.lineTo(a.right, Yp); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = "700 11.5px " + MONO; ctx.fillStyle = FAINT; ctx.textAlign = "left"; ctx.fillText("team avg", X + 4, a.top + 11);
        if (opts.q) { ctx.font = "800 11.5px Inter"; ctx.fillStyle = SUB;
          const pos = { tl: [a.left + 6, a.top + 14, "left"], tr: [a.right - 6, a.top + 14, "right"], bl: [a.left + 6, a.bottom - 8, "left"], br: [a.right - 6, a.bottom - 8, "right"] };
          Object.entries(opts.q).forEach(([k2, t]) => { const p = pos[k2]; if (!p || !t) return; ctx.textAlign = p[2]; ctx.fillText(t, p[0], p[1]); }); }
        ctx.font = "700 11.5px Inter"; ctx.fillStyle = INK2; ctx.textAlign = "left"; ctx.textBaseline = "middle";
        ch.getDatasetMeta(0).data.forEach((el, i) => { const p = ch.data.datasets[0].data[i]; const nm = String(p.k).split(" ")[0]; if (p.over) { ctx.textAlign = "right"; ctx.fillText(nm + " " + xf(p.rx) + " ›", el.x - el.options.radius - 3, el.y); ctx.textAlign = "left"; } else ctx.fillText(nm, el.x + el.options.radius + 3, el.y); });
        ctx.restore(); } }] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }
  // bridge from one total to another — floating steps, green up, red down
  function waterfall(mount, title, sub, steps, fmt, opts) {
    opts = opts || {}; const c = card(mount, title, sub, opts); const { b, cv } = chartBox(c, opts.h || 330);
    let run = 0; const bars = [], cols = [];
    steps.forEach(s => { if (s.total) { bars.push([0, s.v]); cols.push(s.hero ? LIME : INK); run = s.v; } else { bars.push([run, run + s.v]); cols.push(s.v >= 0 ? POS : NEG); run += s.v; } });
    new Chart(cv, { type: "bar", data: { labels: steps.map(s => s.label), datasets: [{ data: bars, backgroundColor: cols, borderRadius: 3, maxBarThickness: 90, categoryPercentage: .9, barPercentage: .95 }] },
      options: base({ layout: { padding: { top: 24 } }, plugins: { legend: legend(false), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => { const d = x.raw; return fmt(d[1] - d[0]); } } }) },
        scales: { x: { ticks: { color: INK2, font: { size: 12, weight: "600" }, maxRotation: 0, autoSkip: false, callback(v) { const l = this.getLabelForValue(v); return l.length > 16 ? l.split(" — ") : l; } }, grid: { display: false } },
          y: axY(moneyC, { beginAtZero: !!opts.zero }) } }, fmt),
      plugins: [{ id: "srwf", afterDatasetsDraw(ch) { const ctx = ch.ctx; ctx.save(); ctx.font = "800 12px " + MONO; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ch.getDatasetMeta(0).data.forEach((el, i) => { const d = bars[i], v = d[1] - d[0], top = Math.min(el.y, el.base); ctx.fillStyle = steps[i].total ? INK : v >= 0 ? POS : NEG; ctx.fillText((steps[i].total ? "" : v >= 0 ? "+" : "−") + fmt(Math.abs(v)), el.x, top - 4); }); ctx.restore(); } }] });
    if (opts.note) note(c, opts.note); if (opts.how) note(c, opts.how, true); return c;
  }

  /* ---------- the headline, per season ---------- */
  const sumCol = (rs, col) => rs.reduce((a, r) => a + num(r[col]), 0);
  const H = {};
  YEARS.forEach(y => {
    const c = cl(y), cr = created(y), bk = booked(y), b = bill(c), n = ncc(c);
    const sc = scorecard.filter(r => { const m = String(r.Month || ""); return +m.slice(0, 4) === y && +m.slice(5, 7) >= F && +m.slice(5, 7) <= T; });
    const inb = rcLine.filter(r => String(r.Company) === CO && +String(r.Month).slice(0, 4) === y && +String(r.Month).slice(5, 7) >= F && +String(r.Month).slice(5, 7) <= T);
    const inCalls = sumCol(inb, "Calls"), missed = sumCol(inb.filter(r => /^(Missed|Voicemail)$/i.test(String(r["Action Result"] || ""))), "Calls");
    const ads = adRows(y), adSpend = sumCol(ads, "Amount");
    const paid = new Set(ads.map(r => normSrc(r.Source)).filter(Boolean));
    const adCl = adTo == null ? [] : cl(y, F, adTo);
    const scJobs = sumCol(sc, "Total Jobs");
    H[y] = { jobs: c.length, bill: b, ncc: n, rate: b ? n / b : null, gp: gpOf(y), avg: c.length ? b / c.length : null,
      leads: cr.length, qual: qual(cr), conf: conf(bk), book: RS.bookingRate(cr, bk), bad: cr.length ? 1 - qual(cr) / cr.length : null,
      claims: rows("claims", y).filter(r => coJk.has(String(r["Request Joinkey"] || ""))).length,
      refunds: sumCol(rows("refunds", y).filter(coRow), "Total refund"),
      revPerJob: scJobs && sumCol(sc, "Total Reviews Written") > 0 ? sumCol(sc, "Total Reviews Written") / scJobs : null,
      missRate: inCalls ? missed / inCalls : null, inCalls,
      adSpend, adPer1: adSpend ? ncc(adCl.filter(r => paid.has(normSrc(r.Source)))) / adSpend : null };
  });
  const C = H[Y], P = H[LY] || {};

  /* ---------- customer experience: claims + reviews, per season ----------
     CLAIMS follow Claims Analysis exactly: a claim counts in the window of the day it was FILED
     (New Jersey day), jobs count by the closing's date, and the rate is claims ÷ DISTINCT jobs
     (closing rows, one per request). The family counted is a manager's correction > the keyword
     reading > the board's own reason. Refunds are stored per JOB on the mart, so a job with two
     claims would carry its refund twice — every refund total here counts each job once.
     REVIEWS follow Review Performance: review EVENTS on ELIGIBLE jobs (no claim, refund or negative
     review on the job, and a foreman on it), by the job's date — so a job reviewed on three
     platforms counts three and a foreman can pass 100%. */
  const inWin = (d, y, a, b) => { d = String(d || "").slice(0, 10); if (d.length < 10) return false; const m = +d.slice(5, 7); return +d.slice(0, 4) === y && m >= (a || F) && m <= (b || T); };
  const jobKeys = (y, a, b) => { const s = new Set(); cl(y, a, b).forEach(r => { if (r["Record Source"] === "closing" && r["Request Joinkey"]) s.add(String(r["Request Joinkey"])); }); return s; };
  const KWF = {}; (ckw || []).forEach(r => { KWF[String(r["Monday Item Id"])] = r["Family Used"]; });
  const famOf = r => { const id = String(r["Monday Item Id"]); return (OV[id] && OV[id].Family) || KWF[id] || r["Reason Family"] || "Unclassified"; };
  const respOf = r => String(r["Responsibility Family"] || "").trim() || "Not assigned";
  const CM = (cmart || []).filter(r => String(r.Company || "") === CO);
  const claimsIn = (y, a, b) => CM.filter(r => inWin(r["Created Date"], y, a, b));
  const refundOf = rs => { const seen = new Set(); let t = 0; rs.forEach(r => { const jk = String(r["Request Joinkey"] || ""); if (seen.has(jk)) return; seen.add(jk); t += num(r["Refund $"]); }); return t; };
  const isOpenC = r => Number(r["Is Open"]) === 1, wentPublic = r => num(r["Negative Reviews"]) > 0;
  const median = a => { const s = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
  const JO = (jov || []).filter(r => !r.Company || String(r.Company) === CO);
  const joIn = (y, a, b) => JO.filter(r => inWin(r["Job Date"], y, a, b));
  const elig = r => Number(r.Eligible) === 1;
  const nRev = r => num(r["Number of Reviews"]);
  const CX = {};
  YEARS.forEach(y => {
    const jn = jobKeys(y).size, cs = cmart ? claimsIn(y) : null, el = jov ? joIn(y).filter(elig) : null;
    const o = CX[y] = { jobsN: jn, claims: cs ? cs.length : null, rate: cs && jn ? cs.length / jn : null, refund: cs ? refundOf(cs) : null,
      open: cs ? cs.filter(isOpenC).length : null, pub: cs ? cs.filter(wentPublic).length : null,
      eligN: el ? el.length : null, revs: el ? el.reduce((a, r) => a + nRev(r), 0) : null, reviewed: el ? el.filter(r => nRev(r) > 0).length : null,
      neg: rows("negative_reviews", y).length };
    o.revPerJob = o.eligN ? o.revs / o.eligN : null; o.revShare = o.eligN ? o.reviewed / o.eligN : null;
  });
  const CC = CX[Y], CP = CX[LY] || {};
  let FMCL = null, SPCL = null, REVFM = null;   // filled by the claims and reviews parts, read by crew + findings

  /* ---------- cover + honesty banners + contents ---------- */
  const root = host.querySelector(".srx"); root.innerHTML = "";
  const cover = document.createElement("div"); cover.className = "srx-cover";
  cover.innerHTML = `<button class="srx-print" id="srPrint" title="Browser print">🖨 Print</button>
    <div class="srx-eyebrow">Seasonal Report · ${esc(CO)}</div>
    <div class="srx-h1">${esc(seasonName)} <em>${Y}</em></div>
    <div class="srx-pick"><div id="srYear"></div><div id="srFrom"></div><div id="srTo"></div></div>
    <div class="srx-cvsub">${MON[F]} 1 – ${MON[T]} ${lastDay(Y, T)}, ${Y}, compared with the same window in every season since 2023${latest ? ` · closings through ${esc(latest)}` : ""} · ${esc(CO)} only</div>`;
  root.appendChild(cover);
  const banner = (html, bad) => { const b = document.createElement("div"); b.className = "srx-banner" + (bad ? " bad" : ""); b.innerHTML = html; root.appendChild(b); };
  if (failures.length) banner(`<span>Some feeds did not load (<b>${esc(failures.join(", "))}</b>) — the cards that read them are incomplete. Reload the page to try again.</span>`, true);
  const endKey = `${Y}-${pad(T)}-${pad(lastDay(Y, T))}`;
  if (latest && latest < endKey) banner(`<span>This season is still running — closings are on file through <b>${esc(latest)}</b>, so ${Y} is a partial season against full earlier seasons.</span>`);
  const pend = cl(Y).filter(r => r["Net Cash"] == null || String(r["Net Cash"]).trim() === "").length;
  if (pend) banner(`<span><b>${pend}</b> of <b>${fmtN(C.jobs)}</b> ${Y} jobs in this window still have no closing paperwork (blank Net Cash) — money totals will grow slightly as they come in.</span>`);
  if (adCut) banner(`<span>Advertising spend is posted through <b>${MS[adTo]} ${Y}</b> only (card statements lag about a month), so every ad-based number compares <b>${adLbl}</b> with <b>${adLbl}</b> of earlier seasons — like for like.</span>`);
  const toc = document.createElement("div"); toc.className = "srx-toc"; root.appendChild(toc);
  bodyEl = document.createElement("div"); root.appendChild(bodyEl);
  const grid = k => { const g = document.createElement("div"); g.className = "srx-grid" + (k ? " k" : ""); g.style.marginTop = "15px"; bodyEl.appendChild(g); return g; };

  /* ================= 01 · the season at a glance ================= */
  const g1 = part("The season at a glance", `${seasonName} ${Y} against ${seasonName} ${LY}`); g1.className = "srx-grid k";
  function kpi(g, l, v, c, p, o) {
    o = o || {}; const el = document.createElement("div"); // "srx-hero", never bare "hero": portal.css owns .hero {text-align:center;max-width:760px}
    el.className = "srx-kpi" + (o.hero ? " srx-hero" : "");
    let ch;
    if (o.pp) { const d = c != null && p != null ? (c - p) * 100 : null; ch = d == null ? `<span class="srx-chip" style="background:${GRID};color:${SUB}">vs ${yy(LY)} —</span>` : `<span class="srx-chip" style="background:${(o.inv ? d <= 0 : d >= 0) ? POS_T1 : NEG_T1};color:${(o.inv ? d <= 0 : d >= 0) ? POS : NEG}">vs ${yy(LY)} ${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}pp</span>`; }
    else ch = chip(c, p, o.inv);
    el.innerHTML = `<div class="srx-kl">${esc(l)}</div><div class="srx-kv">${v}</div>${ch}<span class="srx-chip" style="color:${FAINT}">${yy(LY)}: ${p == null ? "—" : (o.f || String)(p)}</span>`;
    g.appendChild(el);
  }
  kpi(g1, "Total Bill", money(C.bill), C.bill, P.bill, { hero: true, f: money });
  kpi(g1, "Netcash + Card", money(C.ncc), C.ncc, P.ncc, { f: money });
  kpi(g1, "Netcash rate", pct(C.rate), C.rate, P.rate, { pp: true, f: pct });
  kpi(g1, "Jobs done", fmtN(C.jobs), C.jobs, P.jobs, { f: fmtN });
  kpi(g1, "Gross Profit", C.gp == null ? "—" : money(C.gp), C.gp, P.gp, { f: money });
  kpi(g1, "Avg job value", C.avg == null ? "—" : money(C.avg), C.avg, P.avg, { f: money });
  kpi(g1, "Qualified leads", fmtN(C.qual), C.qual, P.qual, { f: fmtN });
  kpi(g1, "Booking rate", pct(C.book), C.book, P.book, { pp: true, f: pct });
  kpi(g1, "Claims — share of jobs", CC.rate == null ? "—" : pct(CC.rate), CC.rate, CP.rate, { pp: true, inv: true, f: pct });
  kpi(g1, "Refunds on claimed jobs", CC.refund == null ? "—" : money(CC.refund), CC.refund, CP.refund, { inv: true, f: money });
  kpi(g1, "Reviews per eligible job", CC.revPerJob == null ? "—" : pct0(CC.revPerJob), CC.revPerJob, CP.revPerJob, { pp: true, f: pct0 });
  kpi(g1, "Negative reviews", fmtN(CC.neg), CC.neg, CP.neg, { inv: true, f: fmtN });


  const g1b = grid();
  // the story, computed from the same numbers the tiles show — never written by hand
  const bestM = winMonths.map(m => ({ m, v: bill(cl(Y, m, m)) })).sort((a, b) => b.v - a.v)[0];
  const stTY = grp(cl(Y), key("State Name")), stLY = grp(cl(LY), key("State Name"));
  const stMove = [...new Set([...stTY.keys(), ...stLY.keys()])].map(s => ({ s, d: bill(stTY.get(s) || []) - bill(stLY.get(s) || []) })).sort((a, b) => b.d - a.d);
  const ex = document.createElement("div"); ex.className = "srx-card span2";
  const gb = growth(C.bill, P.bill), gj = growth(C.jobs, P.jobs);
  ex.innerHTML = `<div class="srx-exec"><b>${esc(seasonName)} ${Y} in one read.</b><ul>
    <li>Total Bill <b>${money(C.bill)}</b>${gb != null ? `, ${gb >= 0 ? "up" : "down"} ${Math.abs(gb * 100).toFixed(0)}% on ${LY}` : ""} — on ${fmtN(C.jobs)} jobs (${gj != null ? (gj >= 0 ? "+" : "") + (gj * 100).toFixed(0) + "%" : "—"}), so the average job moved from ${P.avg ? money(P.avg) : "—"} to <b>${C.avg ? money(C.avg) : "—"}</b>.</li>
    <li>Netcash + Card <b>${money(C.ncc)}</b> — ${pct(C.rate)} of the bill (${pct(P.rate)} in ${LY}).</li>
    <li>Qualified leads ${fmtN(C.qual)} (${fmtN(P.qual || 0)} in ${LY}); booking rate <b>${pct(C.book)}</b> vs ${pct(P.book)}${C.bad != null && P.bad != null && Math.abs(C.bad - P.bad) > .05 ? ` — but ${pct0(C.bad)} of ${Y} leads were marked bad against ${pct0(P.bad)} in ${LY}, and bad leads leave the denominator, so part of that rise is how leads were closed out, not more bookings (confirmed jobs: ${fmtN(C.conf)} vs ${fmtN(P.conf || 0)})` : ""}.</li>
    ${bestM && bestM.v ? `<li>Busiest month: <b>${MON[bestM.m]}</b> at ${money(bestM.v)}.</li>` : ""}
    ${stMove.length ? `<li>Biggest mover by state: <b>${esc(stMove[0].s)}</b> ${stMove[0].d >= 0 ? "+" : "−"}${money(Math.abs(stMove[0].d))}${stMove.length > 1 && stMove[stMove.length - 1].d < 0 ? `; weakest ${esc(stMove[stMove.length - 1].s)} −${money(Math.abs(stMove[stMove.length - 1].d))}` : ""}.</li>` : ""}
  </ul></div>`;
  g1b.appendChild(ex);

  /* The 2026 goals were written into the Summer Report 2025 deck (strategic suggestions + KPI goals
     slides). They are its authors' targets, shown here so the season can be graded against them. */
  const TARGETS = { 2026: [
    { g: "Total Bill (revenue target)", t: "≥ $4.5M", v: C.bill, ok: v => v >= 4.5e6, f: money, pv: P.bill },
    { g: "Netcash + Card (profit target)", t: "≥ $2.7M", v: C.ncc, ok: v => v >= 2.7e6, f: money, pv: P.ncc },
    { g: "Booking rate", t: "≥ 25%", v: C.book, ok: v => v >= .25, f: pct, pv: P.book },
    { g: "Incoming calls missed (incl. voicemail, all company lines)", t: "≤ 5%", v: C.missRate, ok: v => v <= .05, f: pct, pv: P.missRate },
    { g: "Reviews per job (foreman scorecard)", t: "≥ 70%", v: C.revPerJob, ok: v => v >= .7, f: pct0, pv: P.revPerJob },
    { g: `Netcash + Card per $1 of advertising (paid channels${adCut ? ", " + adLbl : ""})`, t: "≥ $10", v: C.adPer1, ok: v => v >= 10, f: x1, pv: P.adPer1 },
    { g: "Jobs lost to capacity", t: "< 10% of demand", v: null, why: "no surge-day / capacity data on file" },
    { g: "Postcard conversion (leads ÷ postcards sent)", t: "≥ 0.6%", v: null, why: "postcards-sent counts are not on file" },
    { g: "Google Search click-through rate", t: "≥ 0.6%", v: null, why: "Search Console is not connected" }] };
  if (TARGETS[Y]) {
    const rowsT = TARGETS[Y].map(t => {
      const has = t.v != null && isFinite(t.v), met = has && t.ok(t.v);
      return `<tr>${td(esc(t.g))}${td(esc(t.t))}${has ? td(t.f(t.v)) : `<td class="dim">—</td>`}${t.pv != null && isFinite(t.pv) ? td(t.f(t.pv)) : `<td class="dim">—</td>`}${has ? `<td class="${met ? "ok" : "no"}">${met ? "✓ met" : "✗ missed"}</td>` : `<td class="dim">${esc(t.why || "no data")}</td>`}</tr>`;
    });
    const met = TARGETS[Y].filter(t => t.v != null && isFinite(t.v) && t.ok(t.v)).length, measurable = TARGETS[Y].filter(t => t.v != null && isFinite(t.v)).length;
    table(g1b, `${Y} goals — set in the Summer Report ${LY}`, "graded on this season's data", ["Goal", "Target", String(Y), String(LY), "Result"], rowsT,
      { head: `${met} / ${measurable}`, how: `The targets are the ones the Summer Report ${LY} deck proposed for ${Y} (its strategy and KPI-goal slides). "Netcash + Card" is the deck's profit line: Net Cash + Card Payment. Booking rate divides by QUALIFIED leads, so it rises when more leads are marked bad${C.bad != null && P.bad != null ? ` (${pct0(C.bad)} of ${Y} leads vs ${pct0(P.bad)} of ${LY})` : ""} — read it next to the confirmed-jobs count. Missed calls read the RingCentral inbound log across every ${CO} line; the deck quoted a per-rep figure, which the data here cannot rebuild month by month yet.` });
  }

  // what moved the Total Bill: more jobs vs bigger jobs, local and long distance apart.
  // Per segment: volume = (jobs now − jobs then) × last season's average job; value = (average now −
  // average then) × jobs now. The two add up to the segment's change exactly, so the bars reconcile.
  const segOf = (y, loc) => cl(y).filter(r => loc ? !isLD(r) : isLD(r));
  const br = [["Local", true], ["Long distance", false]].map(([n, loc]) => { const t = segOf(Y, loc), l = segOf(LY, loc);
    const aT = t.length ? bill(t) / t.length : 0, aL = l.length ? bill(l) / l.length : 0;
    return { n, vol: (t.length - l.length) * aL, val: (aT - aL) * t.length, jT: t.length, jL: l.length, aT, aL }; });
  if (H[LY]) {
    const lbl = (b2, k) => k === "vol" ? `${b2.n} — ${b2.vol >= 0 ? "more" : "fewer"} jobs` : `${b2.n} — ${b2.val >= 0 ? "bigger" : "smaller"} avg job`;
    const vT = br.reduce((a, x) => a + x.vol, 0), pT = br.reduce((a, x) => a + x.val, 0);
    waterfall(g1b, `What moved the Total Bill, ${LY} → ${Y}`, "more jobs vs bigger jobs — local and long distance apart", [
      { label: `${seasonName} ${LY}`, v: P.bill, total: true },
      ...br.flatMap(b2 => [{ label: lbl(b2, "vol"), v: b2.vol }, { label: lbl(b2, "val"), v: b2.val }]),
      { label: `${seasonName} ${Y}`, v: C.bill, total: true, hero: true }], money,
      { span2: true, head: (C.bill - P.bill >= 0 ? "+" : "−") + money(Math.abs(C.bill - P.bill)),
        note: `${money(Math.abs(pT))} of the change came from the average job ${pT >= 0 ? "growing" : "shrinking"} and ${money(Math.abs(vT))} from ${vT >= 0 ? "doing more" : "doing fewer"} jobs. Local average job ${money(br[0].aL)} → ${money(br[0].aT)}; long distance ${money(br[1].aL)} → ${money(br[1].aT)}.`,
        how: "Volume effect = change in jobs × last season's average job. Value effect = change in the average job × this season's jobs. The value effect carries both price and job size (a bigger move bills more at the same rate). Long distance = Regular + Straight moves, standalone trips included." });
  }
  // season pace — the running Total Bill week by week, every season on one scale
  (() => {
    const c = card(g1b, "Season pace — running Total Bill by week", "cumulative from the first day of the window", { span2: true, head: money(C.bill) });
    const { b, cv } = chartBox(c, 330);
    const start = y => new Date(Date.UTC(y, F - 1, 1)), nW = Math.ceil(winMonths.reduce((a, m) => a + lastDay(Y, m), 0) / 7);
    const sets = YEARS.map(y => { const wk = new Array(nW).fill(0); let last = -1;
      cl(y).forEach(r => { const d = new Date(String(r._d || r.Date).slice(0, 10) + "T00:00:00Z"); const w = Math.min(nW - 1, Math.floor((d - start(y)) / 864e5 / 7)); if (w >= 0) { wk[w] += num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); if (w > last) last = w; } });
      let run = 0; return { label: String(y), data: wk.map((v, i) => { run += v; return i <= last ? run : null; }), borderColor: yearColor(y), backgroundColor: yearColor(y),
        borderWidth: y === Y ? 3.4 : 2, pointRadius: 0, tension: 0, fill: false }; });
    new Chart(cv, { type: "line", data: { labels: Array.from({ length: nW }, (_, i) => "Wk " + (i + 1)), datasets: sets },
      options: base({ layout: { padding: { top: 10, right: 12 } }, plugins: { legend: legend(true), tooltip: Object.assign({}, tipTheme, { callbacks: { label: x => x.dataset.label + ": " + money(x.parsed.y) } }) },
        scales: { x: axX(), y: axY(moneyC) } }, money) });
    const wkNow = sets[sets.length - 1].data.filter(v => v != null).length, prevAt = H[LY] ? sets[sets.length - 2].data[wkNow - 1] : null;
    if (prevAt && wkNow < nW) note(c, `After week ${wkNow} this season stands at ${money(sets[sets.length - 1].data[wkNow - 1])} against ${money(prevAt)} at the same point of ${LY}.`);
  })();

  /* ================= 02 · money, season over season ================= */
  const g2 = part("Financials", "Total Bill, Netcash + Card and jobs — every season on file");
  seasonCols(g2, "Total Bill and Netcash + Card", `${winLbl} · every season`, [
    { label: "Total Bill", vals: YEARS.map(y => H[y].bill), color: INK }, { label: "Netcash + Card", vals: YEARS.map(y => H[y].ncc), color: BLUE }], money,
    { lbl: moneyC, head: money(C.bill), chips: chip(C.bill, P.bill) });
  seasonCols(g2, "Netcash rate", "Netcash + Card ÷ Total Bill", [{ label: "Netcash rate", vals: YEARS.map(y => H[y].rate) }], pct,
    { axis: pct0, head: pct(C.rate), how: "Net Cash + Card Payment (trips included) divided by Total Bill, both summed over the whole window — not an average of monthly rates." });
  seasonCols(g2, "Jobs done", `${winLbl} · every season`, [{ label: "Jobs", vals: YEARS.map(y => H[y].jobs) }], fmtN, { axis: fmtN, head: fmtN(C.jobs), chips: chip(C.jobs, P.jobs) });
  seasonShape(g2, "How the season unfolded — Total Bill by month", "one line per season", (y, m) => bill(cl(y, m, m)) || null, money, { axis: moneyC });

  // Local vs long distance, one row per season
  table(g2, "Local vs Long-distance", "jobs, Total Bill and Netcash + Card per season", ["Season", "Jobs", "Total Bill", "Netcash + Card", "Jobs", "Total Bill", "Netcash + Card", "LD share of bill"],
    YEARS.slice().reverse().map(y => { const c = cl(y), l = c.filter(r => !isLD(r)), d = c.filter(isLD), bb = bill(c);
      return `<tr>${td(y === Y ? `<b>${y}</b>` : y)}${td(fmtN(l.length))}${td(money(bill(l)))}${td(money(ncc(l)))}${td(fmtN(d.length))}${td(money(bill(d)))}${td(money(ncc(d)))}${tdn(bb ? bill(d) / bb : null, pct)}</tr>`; }),
    { groups: [["", 1], ["Local moving", 3], ["Long distance (regular + straight)", 3], ["", 1]] });

  // states, this season vs last
  const states = [...new Set([...stTY.keys(), ...stLY.keys()])].map(s => { const a = stTY.get(s) || [], b = stLY.get(s) || [];
    return { s, jT: a.length, jL: b.length, bT: bill(a), bL: bill(b), nT: ncc(a), nL: ncc(b) }; }).filter(x => x.jT + x.jL >= 3).sort((a, b) => b.bT - a.bT);
  const stTot = { jT: C.jobs, jL: P.jobs || 0, bT: C.bill, bL: P.bill || 0, nT: C.ncc, nL: P.ncc || 0 };
  table(g2, "By state", `${Y} vs ${LY}`, ["State", String(LY), String(Y), "Δ", String(LY), String(Y), "Δ", String(LY), String(Y), "Rate " + Y],
    states.map(x => `<tr>${td(esc(x.s))}${td(fmtN(x.jL))}${td(fmtN(x.jT))}${dcell(x.jT, x.jL)}${td(money(x.bL))}${td(money(x.bT))}${dcell(x.bT, x.bL)}${td(money(x.nL))}${td(money(x.nT))}${tdn(x.bT ? x.nT / x.bT : null, pct)}</tr>`)
      .concat([`<tr class="tot">${td("All states")}${td(fmtN(stTot.jL))}${td(fmtN(stTot.jT))}${dcell(stTot.jT, stTot.jL)}${td(money(stTot.bL))}${td(money(stTot.bT))}${dcell(stTot.bT, stTot.bL)}${td(money(stTot.nL))}${td(money(stTot.nT))}${tdn(C.rate, pct)}</tr>`]),
    { groups: [["", 1], ["Jobs", 3], ["Total Bill", 3], ["Netcash + Card", 3]], how: "State = the pickup state on the closing (standalone trips use their delivery state). States with fewer than 3 jobs across both seasons are left out of the rows but stay in the total." });

  // where the profit comes from — size of move, and cubic feet (CF lives on the lead, joined by request)
  const sizeKey = s => { s = String(s || "").toLowerCase(); if (/single/.test(s)) return 1; if (/studio/.test(s)) return 5; const n = /(\d+)\s*bed/.exec(s); if (n) return 10 * +n[1] + (/house/.test(s) ? 1 : 0); if (/storage/.test(s)) return 100; if (/office/.test(s)) return 101; return 200; };
  function distTable(mount, title, keyFn, order, how) {
    const tY = grp(cl(Y), keyFn), tL = grp(cl(LY), keyFn); const keys = [...new Set([...tY.keys(), ...tL.keys()])].sort(order);
    const totY = ncc(cl(Y)), totL = ncc(cl(LY));
    table(mount, title, `${Y} · share of Netcash + Card vs ${LY}`, ["", "Jobs", "Total Bill", "Netcash + Card", "Share", "Share " + LY, "Δ"],
      keys.map(k => { const a = tY.get(k) || [], b = tL.get(k) || []; const sT = totY ? ncc(a) / totY : null, sL = totL ? ncc(b) / totL : null;
        return `<tr>${td(esc(k))}${td(fmtN(a.length))}${td(money(bill(a)))}${td(money(ncc(a)))}${tdn(sT, pct)}${tdn(sL, pct)}${ppcell(sT, sL)}</tr>`; })
        .concat([`<tr class="tot">${td("All jobs")}${td(fmtN(C.jobs))}${td(money(C.bill))}${td(money(C.ncc))}${td("100%")}${td("100%")}<td></td></tr>`]),
      { span2: false, how });
  }
  distTable(g2, "Profit distribution by size of move", r => r["Size of Move"] ? String(r["Size of Move"]).trim() : "(size not recorded)", (a, b) => sizeKey(a) - sizeKey(b) || a.localeCompare(b));
  const jkCF = new Map(); moveboard.forEach(r => { const jk = r["Request Joinkey"], cf = r["CF Range"]; if (jk && cf) jkCF.set(String(jk), String(cf)); });
  const cfBucket = r => { const cf = jkCF.get(String(r["Request Joinkey"] || "")); if (!cf) return "No CF on the lead"; const n = parseInt(String(cf).replace(/[^\d].*$/, ""), 10); if (/over/i.test(cf)) return "Over 1,000 CF"; if (isNaN(n)) return "No CF on the lead"; return n < 500 ? "Up to 500 CF" : n < 1000 ? "501–1,000 CF" : "Over 1,000 CF"; };
  const cfOrder = ["Up to 500 CF", "501–1,000 CF", "Over 1,000 CF", "No CF on the lead"];
  distTable(g2, "Profit distribution by cubic feet", cfBucket, (a, b) => cfOrder.indexOf(a) - cfOrder.indexOf(b),
    "Closings carry no cubic feet, so each job takes the CF range from its Moveboard lead (matched on the request key). Jobs whose lead has no CF range sit in their own row.");

  // second jobs of the day
  const aft = (y, m) => cl(y, m, m).filter(r => String(r["Job Part of the Day"] || "") === "Afternoon Job").length;
  const aT = winMonths.map(m => aft(Y, m)), aL = winMonths.map(m => aft(LY, m)), aTt = aT.reduce((a, b) => a + b, 0), aLt = aL.reduce((a, b) => a + b, 0);
  pairBars(g2, "Afternoon jobs — a foreman's second job of the day", `by month · ${Y} vs ${LY}`, winMonths.map(m => MON[m]), aL, aT, fmtN,
    { head: fmtN(aTt), chips: chip(aTt, aLt), how: "The closing sheet has no start time, so this counts jobs that were NOT the foreman's first job that day (foreman job order ≥ 2). The deck's \"evening jobs\" were counted by hand and run about 10% higher." });


  // packing — written vs material bought
  const packRow = y => { const c = cl(y), w = sumCol(c, "Material Total"), com = sumCol(c, "Material $");
    const bought = sumCol(rows("card_expenses", y).filter(r => Number(r["Is Packing Material Cost"]) === 1), "Amount"); return { y, w, com, bought }; };
  table(g2, "Packing — written vs material bought", "per season", ["Season", "Packing written", "Foreman packing commission", "Packing material bought", "Written per $1 of material"],
    YEARS.slice().reverse().map(y => { const p = packRow(y); return `<tr>${td(y === Y ? `<b>${y}</b>` : y)}${td(money(p.w))}${td(money(p.com))}${p.bought ? td(money(p.bought)) : `<td class="dim">—</td>`}${tdn(p.bought ? p.w / p.bought : null, x1)}</tr>`; }),
    { span2: false, how: "Written = Material Total on the closings. Commission = the foreman's packing share (Material $). Material bought = card transactions categorised Job Supplies → Packing Material; seasons before that category existed show —." });

  /* ================= claims ================= */
  const gC = part("Claims", "how many jobs draw a claim, what it is about, whose jobs — and how it ends");
  if (!cmart) {
    const c = card(gC, "The claims deep-dive needs Claims Analysis access", "", { span2: true });
    note(c, "This part reads the Claims Analysis data (reasons, responsibility, refunds, the link to each Monday case). That data is granted with the Claims Analysis and Review Cases pages only, and this report does not widen it. Below is the plain count every reader can see.", true);
    combo(gC, "Claims and refunds", "claims filed (by claim date) · refunds paid (by refund date)", YEARS.map(String), YEARS.map(y => H[y].claims), "Claims", fmtN, YEARS.map(y => H[y].refunds), "Refunds paid", moneyC,
      { span2: true, head: fmtN(C.claims) + " claims", chips: chip(C.claims, P.claims, true), barAxis: fmtN });
  } else {
    const csT = claimsIn(Y), csL = claimsIn(LY);
    const ppChip = (c, p) => { if (c == null || p == null) return ""; const d = (c - p) * 100; return `<span class="srx-chip" style="background:${d <= 0 ? POS_T1 : NEG_T1};color:${d <= 0 ? POS : NEG}">vs ${yy(LY)} ${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(1)}pp</span>`; };
    // headline strip
    const hero = card(gC, `Claims — ${seasonName} ${Y}`, "the one number, and what happened to those claims", { span2: true });
    const med = median(csT.map(r => r["Days After Job"] == null ? null : num(r["Days After Job"])));
    const stat = (l, v, s) => `<div class="srx-st"><div class="l">${esc(l)}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const hs = document.createElement("div"); hs.className = "srx-strip";
    hs.innerHTML = `<div class="srx-big"><b>${pct(CC.rate)}</b><span>of jobs drew a claim</span>${ppChip(CC.rate, CP.rate)}<em>${fmtN(CC.claims)} claims on ${fmtN(CC.jobsN)} jobs · ${LY}: ${fmtN(CP.claims || 0)} on ${fmtN(CP.jobsN || 0)} (${pct(CP.rate)})</em></div>` +
      stat("Still open", fmtN(CC.open), `${pct0(CC.claims ? CC.open / CC.claims : null)} of this season's claims`) +
      stat("Ended in a refund", money(CC.refund), `${fmtN(new Set(csT.filter(r => num(r["Refund $"]) > 0).map(r => r["Request Joinkey"])).size)} jobs refunded`) +
      stat("Went public", fmtN(CC.pub), "claims whose job also has a negative review") +
      stat("Typical lag", med == null ? "—" : fmtN(med) + (med === 1 ? " day" : " days"), "from the job to the claim (median)");
    hero.appendChild(hs);
    note(hero, `Claims count on the day they were filed; jobs on the day they were done — the same rule as Claims Analysis, ${CO} only. The claims board only came into full use during 2025 (it logged 1.9% of jobs in March 2025 and 11% by August), so part of the rise against ${LY} is the board being used, not only more claims.`, true);
    combo(gC, "Claims and claim rate — every season", "bars: claims filed · line: share of jobs", YEARS.map(String), YEARS.map(y => CX[y].claims), "Claims", fmtN, YEARS.map(y => CX[y].rate), "Share of jobs", pct,
      { barAxis: fmtN, head: pct(CC.rate) });
    const mRate = (y, m) => { const n = jobKeys(y, m, m).size; return n ? claimsIn(y, m, m).length / n : null; };
    pairBars(gC, "Claim rate by month", `${Y} vs ${LY} · share of that month's jobs`, winMonths.map(m => MON[m]), winMonths.map(m => mRate(LY, m)), winMonths.map(m => mRate(Y, m)), pct, { axis: pct0 });

    // local vs long distance, every season
    const jt = (y, ld) => { const ks = new Set(); cl(y).forEach(r => { if (r["Record Source"] === "closing" && r["Request Joinkey"] && isLD(r) === ld) ks.add(String(r["Request Joinkey"])); });
      const c2 = claimsIn(y).filter(r => (String(r["Job Type"] || "") === "Long distance") === ld && r["Job Type"]); return { n: ks.size, c: c2.length, r: ks.size ? c2.length / ks.size : null }; };
    table(gC, "Local vs long distance", "claims as a share of each kind of job", ["Season", "Jobs", "Claims", "Share", "Jobs", "Claims", "Share"],
      YEARS.slice().reverse().map(y => { const a = jt(y, false), b2 = jt(y, true);
        return `<tr>${td(y === Y ? `<b>${y}</b>` : y)}${td(fmtN(a.n))}${td(fmtN(a.c))}${tdn(a.r, pct)}${td(fmtN(b2.n))}${td(fmtN(b2.c))}${b2.r == null ? `<td class="dim">—</td>` : `<td class="dn">${pct(b2.r)}</td>`}</tr>`; }),
      { span2: false, groups: [["", 1], ["Local", 3], ["Long distance", 3]], note: (() => { const a = jt(Y, false), b2 = jt(Y, true); return a.r && b2.r ? `A long-distance job is ${(b2.r / a.r).toFixed(1)}× as likely to draw a claim as a local one (${pct(b2.r)} vs ${pct(a.r)}).` : ""; })() });

    // what the claims are about — this season vs last, with the money and the outcome per family
    const fT = grp(csT, famOf), fL = grp(csL, famOf);
    const fams = [...new Set([...fT.keys(), ...fL.keys()])].sort((a, b) => (fT.get(b) || []).length - (fT.get(a) || []).length);
    pairBars(gC, "What the claims are about", `${Y} vs ${LY} · claims per family`, fams, fams.map(f => (fL.get(f) || []).length), fams.map(f => (fT.get(f) || []).length), fmtN,
      { head: fmtN(csT.length), how: "Family = a manager's correction on Claims Analysis, else the keyword reading of the whole thread, else the reason support picked on the board. The keyword reading is what fills last season's claims, most of which were filed with no reason." });
    const rT = grp(csT, respOf), rL = grp(csL, respOf), resps = [...new Set([...rT.keys(), ...rL.keys()])].sort((a, b) => (rT.get(b) || []).length - (rT.get(a) || []).length);
    pairBars(gC, "Whose responsibility", `${Y} vs ${LY} · as recorded on the board`, resps, resps.map(f => (rL.get(f) || []).length), resps.map(f => (rT.get(f) || []).length), fmtN,
      { head: pct0(csT.length ? (rT.get("Not assigned") || []).length / csT.length : null) + " not assigned",
        note: (rT.get("Not assigned") || []).length > csT.length / 3 ? `${fmtN((rT.get("Not assigned") || []).length)} of ${fmtN(csT.length)} claims have no responsibility recorded — the board cannot say whose they are, which limits every "whose fault" number below.` : "" });
    const claimRow = r => `<tr>${td(esc(String(r["Created Date"] || "").slice(0, 10)))}${td(esc(r.Customer || "—"))}${td(esc(String(r["Request No"] || "—")))}${td(esc(famOf(r)))}${td(esc(respOf(r)))}${td(esc(r.Status || "—"))}${num(r["Refund $"]) ? td(money(num(r["Refund $"])), "no") : `<td class="dim">—</td>`}<td>${mondayLink(r["Monday Url"])}</td></tr>`;
    const claimHdr = ["Filed", "Customer", "Request", "Family", "Responsibility", "Status", "Job refund", ""];
    ptable(gC, "Families — outcome and money", `${seasonName} ${Y}`, ["Family", "Claims", String(LY), "Share of jobs", "Open", "Jobs refunded", "Refund $", "Went public", "Median days after job"],
      fams.map(f => { const a = fT.get(f) || [], l = fL.get(f) || [];
        return { h: `${td(esc(f))}${td(fmtN(a.length))}${td(fmtN(l.length))}${tdn(CC.jobsN ? a.length / CC.jobsN : null, pct)}${td(fmtN(a.filter(isOpenC).length))}${td(fmtN(new Set(a.filter(r => num(r["Refund $"]) > 0).map(r => r["Request Joinkey"])).size))}${td(money(refundOf(a)))}${td(fmtN(a.filter(wentPublic).length))}${tdn(median(a.map(r => r["Days After Job"] == null ? null : num(r["Days After Job"]))), fmtN)}`,
          d: a.length ? mini(claimHdr, a.slice().sort((x, y) => String(y["Created Date"]).localeCompare(String(x["Created Date"]))).map(claimRow)) : null }; }),
      { drillCol: true, tot: `${td("All")}${td(fmtN(csT.length))}${td(fmtN(csL.length))}${tdn(CC.rate, pct)}${td(fmtN(CC.open))}${td(fmtN(new Set(csT.filter(r => num(r["Refund $"]) > 0).map(r => r["Request Joinkey"])).size))}${td(money(CC.refund))}${td(fmtN(CC.pub))}${tdn(med, fmtN)}`,
        how: "Click a family to see its claims. Refund $ is the refund paid on the claimed job (any date), counted once per job." });

    // foremen: claims as a share of THEIR jobs (unweighted — one foreman per job), 30-job floor like Claims Analysis
    const MINJ = 30;
    const perForeman = y => { const jobs = new Map(); cl(y).forEach(r => { if (r["Record Source"] !== "closing" || !r.Foreman || !r["Request Joinkey"]) return; const f = String(r.Foreman).trim(); (jobs.get(f) || jobs.set(f, new Set()).get(f)).add(String(r["Request Joinkey"])); });
      const cls = grp(claimsIn(y), key("Foreman")); return { jobs, cls }; };
    const pfT = perForeman(Y), pfL = perForeman(LY);
    const fmRows = [...new Set([...pfT.jobs.keys(), ...pfT.cls.keys()])].map(f => { const n = (pfT.jobs.get(f) || new Set()).size, cs = pfT.cls.get(f) || [], nL = (pfL.jobs.get(f) || new Set()).size, cL = (pfL.cls.get(f) || []).length;
      return { f, n, cs, r: n ? cs.length / n : null, rL: nL >= MINJ ? cL / nL : null, small: n < MINJ }; }).filter(x => x.cs.length || x.n >= MINJ)
      .sort((a, b) => (a.small - b.small) || (b.r || 0) - (a.r || 0));
    FMCL = new Map(fmRows.map(x => [x.f, x]));   // reused by the crew and reviews parts
    ptable(gC, "Foremen — claims on their jobs", `${seasonName} ${Y} · worst first`, ["Foreman", "Jobs", "Claims", "Share of jobs", "vs " + LY, "Damage", "Missing", "Timing", "Refund $", "Went public"],
      fmRows.map(x => { const by = f => x.cs.filter(r => famOf(r) === f).length;
        return { cls: x.small ? "small" : "", h: `${td(esc(x.f))}${td(fmtN(x.n))}${td(fmtN(x.cs.length))}${x.r == null ? `<td class="dim">—</td>` : x.small ? `<td class="dim">${pct(x.r)} · small</td>` : `<td class="${x.r > CC.rate ? "dn" : "up"}">${pct(x.r)}</td>`}${x.small ? `<td class="dim">—</td>` : ppInv(x.r, x.rL)}${td(fmtN(by("Damage")))}${td(fmtN(by("Missing")))}${td(fmtN(by("Timing")))}${refundOf(x.cs) ? td(money(refundOf(x.cs)), "no") : `<td class="dim">—</td>`}${td(fmtN(x.cs.filter(wentPublic).length))}`,
          d: x.cs.length ? mini(claimHdr, x.cs.map(claimRow)) : null }; }),
      { drillCol: true, per: 15, how: `Share = claims on the foreman's jobs ÷ the jobs he led in the window (from the closing). Red = above the team's ${pct(CC.rate)}. Under ${MINJ} jobs the share is shown as "small" and sorted last — too few jobs to rank. "vs ${LY}" is green when his share fell. Click a foreman to see the claims behind his number.` });

    // salespeople: credited, like Claims Analysis — a 50/50 job gives each rep half the claim AND half the job
    const CRED = new Map(); (credit || []).forEach(r => { const jk = String(r["Request Joinkey"] || ""), p = String(r["Sales Person"] || "").trim(), sh = num(r.Share); if (jk && p && sh > 0) (CRED.get(jk) || CRED.set(jk, []).get(jk)).push({ p, sh }); });
    const credOf = (jk, fallback) => CRED.get(jk) || (fallback ? [{ p: fallback, sh: 1 }] : []);
    const perRep = y => { const jobs = new Map(), cls = new Map(), seen = new Set();
      cl(y).forEach(r => { const jk = String(r["Request Joinkey"] || ""); if (r["Record Source"] !== "closing" || !jk || seen.has(jk)) return; seen.add(jk); credOf(jk, r["Sales Person"]).forEach(({ p, sh }) => jobs.set(p, (jobs.get(p) || 0) + sh)); });
      claimsIn(y).forEach(r => credOf(String(r["Request Joinkey"] || ""), r["Sales Person"]).forEach(({ p, sh }) => { const a = cls.get(p) || cls.set(p, { c: 0, rows: [], price: 0 }).get(p); a.c += sh; a.rows.push({ r, sh }); if (famOf(r) === "Price") a.price += sh; }));
      return { jobs, cls }; };
    const prT = perRep(Y), prL = perRep(LY), f1 = v => v == null ? "—" : (Math.round(v * 10) / 10).toLocaleString();
    const spRows = [...new Set([...prT.jobs.keys(), ...prT.cls.keys()])].filter(p => !/^test\b/i.test(p)).map(p => { const n = prT.jobs.get(p) || 0, a = prT.cls.get(p) || { c: 0, rows: [], price: 0 }, nL = prL.jobs.get(p) || 0, aL = prL.cls.get(p);
      return { p, n, a, r: n ? a.c / n : null, rL: nL >= MINJ ? (aL ? aL.c : 0) / nL : null, small: n < MINJ }; }).filter(x => x.a.c > 0 || x.n >= MINJ)
      .sort((a, b) => (a.small - b.small) || (b.r || 0) - (a.r || 0));
    SPCL = new Map(spRows.map(x => [x.p, x]));
    ptable(gC, "Salespeople — claims on the jobs they sold", `${seasonName} ${Y} · credited share · worst first`, ["Salesperson", "Jobs (credited)", "Claims (credited)", "Share of jobs", "vs " + LY, "Price claims", "Refund $"],
      spRows.map(x => ({ cls: x.small ? "small" : "", h: `${td(esc(x.p))}${td(f1(x.n))}${td(f1(x.a.c))}${x.r == null ? `<td class="dim">—</td>` : x.small ? `<td class="dim">${pct(x.r)} · small</td>` : `<td class="${x.r > CC.rate ? "dn" : "up"}">${pct(x.r)}</td>`}${x.small ? `<td class="dim">—</td>` : ppInv(x.r, x.rL)}${td(f1(x.a.price))}${refundOf(x.a.rows.map(o => o.r)) ? td(money(refundOf(x.a.rows.map(o => o.r))), "no") : `<td class="dim">—</td>`}`,
        d: x.a.rows.length ? mini(claimHdr.concat(["Their share"]), x.a.rows.map(o => claimRow(o.r).replace(/<\/tr>$/, `<td>${o.sh >= .999 ? "all of it" : pct0(o.sh)}</td></tr>`))) : null })),
      { drillCol: true, per: 15, how: `Same rule as Claims Analysis: a job sold by two reps gives each their share of the job AND of any claim on it, so every rep's share stays a share of their own work and the column adds up to the season's claims. Price claims are the ones about the bill or the quote. Yelp Team and the CT branch owner carry no sales blame. Under ${MINJ} credited jobs = "small", sorted last.` });

    // when claims arrive, and how they end
    const lagB = r => { const d = r["Days After Job"]; if (d == null || d === "") return "No job date"; const v = num(d); return v <= 1 ? "Same or next day" : v <= 7 ? "2–7 days" : v <= 30 ? "8–30 days" : "Over 30 days"; };
    const LAGS = ["Same or next day", "2–7 days", "8–30 days", "Over 30 days", "No job date"];
    const lT = grp(csT, lagB), lL = grp(csL, lagB), lags = LAGS.filter(k => lT.has(k) || lL.has(k));
    pairBars(gC, "How long after the job the claim came in", `${Y} vs ${LY}`, lags, lags.map(k => (lL.get(k) || []).length), lags.map(k => (lT.get(k) || []).length), fmtN,
      { head: med == null ? "" : "median " + fmtN(med) + " d", how: "Days from the job's date to the day the claim was filed." });
    donut(gC, "Where this season's claims stand", `${seasonName} ${Y} · status on the board today`, [...grp(csT, r => String(r.Status || "(no status)")).entries()].map(([k, rs]) => ({ k, v: rs.length })).sort((a, b) => b.v - a.v), fmtN,
      { head: fmtN(CC.open) + " open" });
    ptable(gC, "Every claim this season", `${seasonName} ${Y} · newest first`, ["Filed", "Customer", "Request", "Family", "Responsibility", "Foreman", "Salesperson", "Job type", "Status", "Job refund", ""],
      csT.slice().sort((a, b) => String(b["Created Date"]).localeCompare(String(a["Created Date"]))).map(r => ({ h: `${td(esc(String(r["Created Date"] || "").slice(0, 10)))}${td(esc(r.Customer || "—"))}${td(esc(String(r["Request No"] || "—")))}${td(esc(famOf(r)))}${td(esc(respOf(r)))}${td(esc(r.Foreman || "—"))}${td(esc(r["Sales Person"] || "—"))}${td(esc(r["Job Type"] || "—"))}${td(esc(r.Status || "—"), isOpenC(r) ? "no" : "")}${num(r["Refund $"]) ? td(money(num(r["Refund $"])), "no") : `<td class="dim">—</td>`}<td>${mondayLink(r["Monday Url"])}</td>` })),
      { per: 15, how: "Monday ↗ opens the case on the claims board. For the full thread and the keyword reading, use Claims Analysis." });
  }

  /* ================= reviews ================= */
  const gR = part("Reviews", "how many reviews the season's jobs generated — by platform, foreman and salesperson");
  // counted reviews (the ones the platform publishes) — reviews_breakdown's Event Date is the JOB's date
  const isCounted = r => String(r.Counts || "") === "Yes";
  const rvIn = (y, a, b) => (DS.reviews_breakdown ? rows("reviews_breakdown", y, null, a, b) : []).filter(isCounted);
  const revN = rs => rs.reduce((a, r) => a + num(r["Number of Reviews"]), 0);
  const RV = {}; YEARS.forEach(y => { const rs = rvIn(y); RV[y] = { rs, n: revN(rs), img: revN(rs.filter(r => String(r["With Image"]) === "Yes")), five: revN(rs.filter(r => num(r["Review Score"]) === 5)) }; });
  const RY = RV[Y], RL = RV[LY] || { n: 0, rs: [] };
  const revYears = YEARS.filter(y => RV[y].n > 0);
  const endD = new Date(Date.UTC(Y, T - 1, lastDay(Y, T))), ageDays = Math.floor((Date.now() - endD) / 864e5);
  {
    const hero = card(gR, `Reviews — ${seasonName} ${Y}`, "what the season's jobs earned", { span2: true });
    const up = (c, p) => { if (c == null || p == null) return ""; const d = (c - p) * 100; return `<span class="srx-chip" style="background:${d >= 0 ? POS_T1 : NEG_T1};color:${d >= 0 ? POS : NEG}">vs ${yy(LY)} ${d >= 0 ? "▲" : "▼"} ${Math.abs(d).toFixed(0)}pp</span>`; };
    const stat = (l, v, s) => `<div class="srx-st"><div class="l">${esc(l)}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const hs = document.createElement("div"); hs.className = "srx-strip";
    hs.innerHTML = (jov ? `<div class="srx-big"><b>${pct0(CC.revPerJob)}</b><span>reviews per eligible job</span>${up(CC.revPerJob, CP.revPerJob)}<em>${fmtN(CC.revs)} reviews on ${fmtN(CC.eligN)} eligible jobs · ${LY}: ${CP.revPerJob == null ? "—" : pct0(CP.revPerJob)}</em></div>`
        : `<div class="srx-big"><b>${fmtN(RY.n)}</b><span>reviews generated</span>${chip(RY.n, RL.n)}</div>`) +
      stat("Reviews generated", fmtN(RY.n), `${LY}: ${fmtN(RL.n)} · ${chip(RY.n, RL.n)}`) +
      (jov ? stat("Jobs with a review", pct0(CC.revShare), `${fmtN(CC.reviewed)} of ${fmtN(CC.eligN)} eligible jobs`) : "") +
      stat("With a photo", pct0(RY.n ? RY.img / RY.n : null), `${fmtN(RY.img)} reviews`) +
      stat("Five stars", pct0(RY.n ? RY.five / RY.n : null), "of counted reviews (only 4–5★ are logged)") +
      stat("Negative reviews", fmtN(CC.neg), `${LY}: ${fmtN(CP.neg || 0)}`);
    hero.appendChild(hs);
    note(hero, `Counted reviews only — the ones the platform publishes. Reviews are dated by the JOB they belong to, and they arrive weeks after it (about a third within a month, three quarters within two to three months)${ageDays < 90 ? `, so the last weeks of ${seasonName.toLowerCase()} ${Y} will still grow — compare the early months first` : ""}. "Eligible" is Review Performance's rule: no claim, refund or negative review on the job, a foreman on it, and not a regular long-distance move. Job-level reviews are on file from 2025.`, true);
  }
  const mRevPer = (y, m) => { const el = joIn(y, m, m).filter(elig); return el.length ? el.reduce((a, r) => a + nRev(r), 0) / el.length : null; };
  pairBars(gR, "Reviews generated by month", `${Y} vs ${LY} · counted reviews, by job date`, winMonths.map(m => MON[m]), winMonths.map(m => revN(rvIn(LY, m, m))), winMonths.map(m => revN(rvIn(Y, m, m))), fmtN,
    { head: fmtN(RY.n), chips: chip(RY.n, RL.n) });
  if (jov) pairBars(gR, "Reviews per eligible job by month", `${Y} vs ${LY}`, winMonths.map(m => MON[m]), winMonths.map(m => mRevPer(LY, m)), winMonths.map(m => mRevPer(Y, m)), pct0,
    { axis: pct0, head: pct0(CC.revPerJob) });
  // platforms
  const pT = new Map(), pL = new Map(); RY.rs.forEach(r => pT.set(r.Source, (pT.get(r.Source) || 0) + num(r["Number of Reviews"]))); RL.rs.forEach(r => pL.set(r.Source, (pL.get(r.Source) || 0) + num(r["Number of Reviews"])));
  const plats = [...new Set([...pT.keys(), ...pL.keys()])].filter(Boolean).sort((a, b) => (pT.get(b) || 0) - (pT.get(a) || 0)).slice(0, 14);
  pairBars(gR, "Reviews by platform", `${Y} vs ${LY} · counted, per listing`, plats, plats.map(p => pL.get(p) || 0), plats.map(p => pT.get(p) || 0), fmtN, { head: fmtN(RY.n) });
  // public footprint — the only review series that reaches back to 2023: listing totals at the window's end minus its start
  const snapAt = (plat, key0) => { let best = null; (rcounts || []).forEach(r => { if (String(r.Company) !== CO || String(r.Platform) !== plat) return; const d = String(r.Date || "").slice(0, 10); if (d && d <= key0 && (!best || d > best.d)) best = { d, v: num(r["Number of Reviews"]) }; }); return best; };
  const platsAll = [...new Set((rcounts || []).filter(r => String(r.Company) === CO).map(r => String(r.Platform)))];
  // the footprint sheet is filled monthly and trails the calendar: every season is cut to the same span the latest snapshot allows
  const lastSnap = (rcounts || []).filter(r => String(r.Company) === CO).reduce((a, r) => { const d = String(r.Date || "").slice(0, 10); return d > a ? d : a; }, "");
  const endM = (() => { const want = T + 1; if (!lastSnap) return want; const sy = +lastSnap.slice(0, 4), sm = +lastSnap.slice(5, 7);
    if (sy > Y || (sy === Y && sm >= want)) return want; return sy === Y && sm > F ? sm : null; })();
  const resets = [];
  const footGrow = y => { if (endM == null) return null; const s = `${y}-${pad(F)}-01`, e = endM === 13 ? `${y + 1}-01-01` : `${y}-${pad(endM)}-01`; let tot = 0, any = false;
    platsAll.forEach(p => { const a = snapAt(p, s), b = snapAt(p, e); if (!(a && b && a.d >= `${y}-01-01` && b.d > a.d)) return;
      // a listing that loses 30%+ between snapshots was reset or renamed (or mistyped) — reviews do not go backwards that fast
      if (b.v < a.v * 0.7) { if (y === Y) resets.push(`${p} ${fmtN(a.v)} → ${fmtN(b.v)}`); return; }
      tot += b.v - a.v; any = true; }); return any ? tot : null; };
  const footVals = YEARS.map(footGrow);
  const footSpan = endM == null ? winLbl : (endM - 1 === F ? MS[F] : MS[F] + "–" + MS[endM === 13 ? 12 : endM - 1]);
  seasonCols(gR, "Public reviews added across all listings", `listing totals, start of ${MS[F]} → end of ${endM == null ? MS[T] : MS[endM === 13 ? 12 : endM - 1]} · every season`, [{ label: "Added", vals: footVals }], fmtN,
    { axis: fmtN, head: footVals[footVals.length - 1] == null ? "—" : fmtN(footVals[footVals.length - 1]),
      note: resets.length ? `Left out as a reset or rename — check the footprint sheet: ${resets.join("; ")}.` : "",
      how: `From the monthly footprint snapshots (review_counts): each ${CO} listing's public total at the end of the span minus its total at the start, summed. It counts everything the platforms show, including reviews not tied to a job. ${footSpan !== winLbl ? `The latest snapshot is ${lastSnap}, so every season is measured ${footSpan} to compare like for like. ` : ""}The first snapshot is 1 May 2023.` });

  // foremen — Review Performance's rule: review events ÷ eligible jobs
  const MINE = 15;
  const fmRev = y => { const g = new Map(); joIn(y).forEach(r => { const f = String(r.Foreman || "").trim(); if (!f) return; const a = g.get(f) || g.set(f, { el: 0, rv: 0, withR: 0, excl: 0, miss: [], all: 0 }).get(f);
    a.all++; if (elig(r)) { a.el++; a.rv += nRev(r); if (nRev(r) > 0) a.withR++; else a.miss.push(r); } else a.excl++; }); return g; };
  if (jov) {
    const frT = fmRev(Y), frL = fmRev(LY), teamR = CC.revPerJob;
    REVFM = new Map([...frT.entries()].map(([f, a]) => [f, a]));
    const fr = [...frT.entries()].map(([f, a]) => { const l = frL.get(f); return { f, a, r: a.el ? a.rv / a.el : null, rL: l && l.el >= MINE ? l.rv / l.el : null, small: a.el < MINE }; })
      .filter(x => x.a.all >= 5).sort((a, b) => (a.small - b.small) || (b.r || 0) - (a.r || 0));
    ptable(gR, "Foremen — reviews their jobs earned", `${seasonName} ${Y} · best first`, ["Foreman", "Jobs", "Eligible", "Reviews", "Per eligible job", "vs " + LY, "Jobs with a review", "Claims share", "Excluded"],
      fr.map(x => { const cc = FMCL && FMCL.get(x.f);
        return { cls: x.small ? "small" : "", h: `${td(esc(x.f))}${td(fmtN(x.a.all))}${td(fmtN(x.a.el))}${td(fmtN(x.a.rv))}${x.r == null ? `<td class="dim">—</td>` : x.small ? `<td class="dim">${pct0(x.r)} · small</td>` : `<td class="${x.r >= teamR ? "up" : "dn"}"><b>${pct0(x.r)}</b></td>`}${x.small ? `<td class="dim">—</td>` : ppcell(x.r, x.rL)}${tdn(x.a.el ? x.a.withR / x.a.el : null, pct0)}${cc && cc.r != null ? `<td class="${cc.small ? "dim" : cc.r > (CC.rate || 0) ? "dn" : "up"}">${pct(cc.r)}</td>` : `<td class="dim">—</td>`}${td(fmtN(x.a.excl))}`,
          d: x.a.miss.length ? mini(["Job date", "Customer", "Job", "Status", "Foreman's reason"], x.a.miss.slice().sort((p, q) => String(q["Job Date"]).localeCompare(String(p["Job Date"]))).map(r => `<tr>${td(esc(String(r["Job Date"] || "").slice(0, 10)))}${td(esc(r.Customer || "—"))}${td(esc(String(r["Job No"] || "—")))}${td(esc(r["Final Status"] || "—"))}${td(esc(r["Foreman Reason"] || "—"))}</tr>`), `${x.a.miss.length} eligible jobs with no review yet`) : null }; }),
      { drillCol: true, per: 15, how: `Per eligible job = review events ÷ eligible jobs, Review Performance's measure: a job reviewed on three platforms counts three, so a foreman can pass 100%. Green = at or above the team's ${pct0(teamR)}. Under ${MINE} eligible jobs = "small", sorted last. Excluded = jobs taken out of his count because of a claim, refund or negative review (or a regular long-distance move). Click a foreman to see his eligible jobs with no review yet and the reason he gave.` });
    // the quality map: reviews earned vs claims drawn, one bubble per foreman
    const qp = fr.filter(x => !x.small && x.r != null).map(x => { const cc = FMCL && FMCL.get(x.f); return cc && !cc.small && cc.r != null ? { k: x.f, x: x.r, y: cc.r, r: x.a.all } : null; }).filter(Boolean);
    if (FMCL) quadrant(gR, "Foreman quality map — reviews earned vs claims drawn", `${seasonName} ${Y} · bubble = jobs · dashed = team average`, qp, pct0, pct,
      { xLabel: "Reviews per eligible job", yLabel: "Claims — share of jobs", goodX: "high", goodY: "low", xAvg: teamR, yAvg: CC.rate, q: { br: "★ more reviews, fewer claims", tl: "fewer reviews, more claims" },
        how: `Only foremen with ${MINE}+ eligible jobs and 30+ jobs for the claim share. Lime = better than the team on both, red = worse on both, blue = mixed.` });
  } else {
    const c = card(gR, "Per-foreman reviews need Review Performance access", "", { span2: true });
    note(c, "The foreman view uses Review Performance's job table (eligible jobs, exclusions, the foreman's reason for a missing review). It is granted with that page; this report does not widen it.", true);
  }
  // salespeople — reviews on the jobs they closed (breakdown → the closing's salesperson; the review sheet's own name is mostly blank)
  const spRev = y => { const jkSP = new Map(); cl(y).forEach(r => { if (r["Record Source"] === "closing" && r["Request Joinkey"] && r["Sales Person"]) jkSP.set(String(r["Request Joinkey"]), String(r["Sales Person"]).trim()); });
    const jobs = new Map(); jkSP.forEach(p => jobs.set(p, (jobs.get(p) || 0) + 1));
    const rv = new Map(); rvIn(y).forEach(r => { const p = jkSP.get(String(r["Request Joinkey"] || "")); if (p) rv.set(p, (rv.get(p) || 0) + num(r["Number of Reviews"])); });
    return { jobs, rv }; };
  const srT = spRev(Y), srL = spRev(LY);
  const spR = [...srT.jobs.entries()].filter(([p, n]) => n >= 30 && !/^test\b/i.test(p)).map(([p, n]) => ({ p, r: (srT.rv.get(p) || 0) / n, rL: (srL.jobs.get(p) || 0) >= 30 ? (srL.rv.get(p) || 0) / srL.jobs.get(p) : null })).sort((a, b) => b.r - a.r);
  pairBars(gR, "Reviews per job by salesperson", `${Y} vs ${LY} · reps with 30+ jobs`, spR.map(x => x.p), spR.map(x => x.rL), spR.map(x => x.r), pct0,
    { axis: pct0, how: "Counted reviews on the jobs a rep closed ÷ their jobs (all jobs — reps have no eligibility rule). It shows whose customers leave reviews; the foreman on the day still matters most." });
  // negative reviews by platform
  const ngT = grp(rows("negative_reviews", Y), r => String(r.Source || r.Platform || "(no platform)")), ngL = grp(rows("negative_reviews", LY), r => String(r.Source || r.Platform || "(no platform)"));
  const ngK = [...new Set([...ngT.keys(), ...ngL.keys()])].sort((a, b) => (ngT.get(b) || []).length - (ngT.get(a) || []).length).slice(0, 12);
  pairBars(gR, "Negative reviews by platform", `${Y} vs ${LY}`, ngK, ngK.map(k => (ngL.get(k) || []).length), ngK.map(k => (ngT.get(k) || []).length), fmtN,
    { head: fmtN(CC.neg), chips: chip(CC.neg, CP.neg, true), how: "From the negative-reviews board: one row per platform listing, so one unhappy customer posting on two platforms counts twice. Removed reviews with no date fall out of the window." });

  /* ================= demand (Moveboard) ================= */
  const g3 = part("Demand", "leads, bookings and what was quoted — by segment and county");
  combo(g3, "Confirmed jobs and booking rate", "every season", YEARS.map(String), YEARS.map(y => H[y].conf), "Confirmed", fmtN, YEARS.map(y => H[y].book), "Booking rate", pct,
    { head: pct(C.book), chips: chip(C.book, P.book), barAxis: fmtN, how: "Booking rate = leads confirmed in the window (by booked date) ÷ qualified leads created in the window (all leads minus bad leads) — the portal's one booking-rate formula, the same as the Monthly Report." });
  seasonShape(g3, "Qualified leads by month", "one line per season", (y, m) => qual(created(y, m, m)) || null, fmtN);
  const estOf = y => { const bk = booked(y).filter(r => String(r["Status Category"]) === "Confirmed"); return { usd: sumCol(bk, "Average Quote"), cf: sumCol(bk, "Total CF"), n: bk.length }; };
  table(g3, "The funnel, season by season", `${winLbl} · leads by the date they came in, bookings by booked date`, ["Season", "Leads", "Qualified", "Confirmed", "Booking rate", "Estimates booked", "CF booked", "Avg estimate"],
    YEARS.slice().reverse().map(y => { const h = H[y], e = estOf(y);
      return `<tr>${td(y === Y ? `<b>${y}</b>` : y)}${td(fmtN(h.leads))}${td(fmtN(h.qual))}${td(fmtN(h.conf))}${tdn(h.book, pct)}${td(money(e.usd))}${td(fmtN(e.cf))}${tdn(e.n ? e.usd / e.n : null, money)}</tr>`; }),
    { how: "Estimates booked = the Moveboard average quote and total cubic feet of every lead confirmed in the window. Bad leads = Dead Lead, Archive and Spam." });

  function funnelTable(mount, title, keyFn, order, opts) {
    opts = opts || {};
    const cT = grp(created(Y), keyFn), cL = grp(created(LY), keyFn), bT = grp(booked(Y), keyFn), bL = grp(booked(LY), keyFn);
    let keys = [...new Set([...cT.keys(), ...cL.keys()])].map(k => ({ k, qT: qual(cT.get(k) || []), qL: qual(cL.get(k) || []) })).filter(x => x.qT + x.qL >= (opts.min || 5));
    keys = order ? keys.sort((a, b) => order(a.k, b.k)) : keys.sort((a, b) => b.qT - a.qT);
    if (opts.top) keys = keys.slice(0, opts.top);
    const rowsF = keys.map(x => { const rT = RS.bookingRate(cT.get(x.k) || [], bT.get(x.k) || []), rL = RS.bookingRate(cL.get(x.k) || [], bL.get(x.k) || []);
      return `<tr>${td(esc(x.k))}${td(fmtN(x.qL))}${td(fmtN(x.qT))}${dcell(x.qT, x.qL)}${td(fmtN(conf(bL.get(x.k) || [])))}${td(fmtN(conf(bT.get(x.k) || [])))}${tdn(rL, pct)}${tdn(rT, pct)}${ppcell(rT, rL)}</tr>`; });
    rowsF.push(`<tr class="tot">${td("All")}${td(fmtN(P.qual || 0))}${td(fmtN(C.qual))}${dcell(C.qual, P.qual)}${td(fmtN(P.conf || 0))}${td(fmtN(C.conf))}${tdn(P.book, pct)}${tdn(C.book, pct)}${ppcell(C.book, P.book)}</tr>`);
    table(mount, title, `${Y} vs ${LY}`, ["", String(LY), String(Y), "Δ", String(LY), String(Y), String(LY), String(Y), "Δ"], rowsF,
      { span2: opts.span2 || false, groups: [["", 1], ["Qualified leads", 3], ["Confirmed", 2], ["Booking rate", 3]], how: opts.how });
  }
  const cfKey = s => { const n = parseInt(String(s), 10); return /over/i.test(s) ? 1e6 : isNaN(n) ? 1e7 : n; };
  funnelTable(g3, "By service type", key("Service Type"));
  funnelTable(g3, "By size of move", key("Size of Move"), (a, b) => sizeKey(a) - sizeKey(b) || a.localeCompare(b));
  funnelTable(g3, "By state", key("State Name"));
  funnelTable(g3, "By cubic feet", key("CF Range"), (a, b) => cfKey(a) - cfKey(b));
  funnelTable(g3, "Top counties", r => r["County Name"] ? String(r["County Name"]).trim() + (r.State ? ", " + String(r.State).trim() : "") : null, null,
    { top: 20, min: 20, span2: true, how: "The 20 counties with the most qualified leads across both seasons (at least 20). County comes from the pickup address on the lead. The deck drew these as maps; a ranked table shows the same thing with the numbers readable." });

  /* ================= 04 · the sales team ================= */
  const g4 = part("Sales team", "each rep's season — money, conversion and what they sold");
  const repCl = y => grp(cl(y), key("Sales Person")), repCr = y => grp(created(y), key("Assigned")), repBk = y => grp(booked(y), key("Assigned"));
  const rClT = repCl(Y), rClL = repCl(LY), rCrT = repCr(Y), rCrL = repCr(LY), rBkT = repBk(Y), rBkL = repBk(LY);
  const rRef = grp(rows("refunds", Y).filter(coRow), key("Sales Person"));
  const isBig = r => String(r["Big Job Status"]) === "Yes";
  const repNames = [...new Set([...rClT.keys(), ...rCrT.keys()])].filter(n => !/^test/i.test(n) && ((rClT.get(n) || []).length >= 5 || (qual(rCrT.get(n) || []) >= 30 && conf(rBkT.get(n) || []) > 0)))
    .sort((a, b) => bill(rClT.get(b) || []) - bill(rClT.get(a) || []));
  const rep = n => { const c = rClT.get(n) || [], cr = rCrT.get(n) || [], bk = rBkT.get(n) || [], crL = rCrL.get(n) || [], bkL = rBkL.get(n) || [];
    const sold = bk.filter(r => String(r["Status Category"]) === "Confirmed"), soldL = bkL.filter(r => String(r["Status Category"]) === "Confirmed");
    const q = qual(cr), qL = qual(crL);
    return { n, jobs: c.length, bill: bill(c), billL: bill(rClL.get(n) || []), ncc: ncc(c), q, conf: conf(bk),
      book: q >= 10 ? RS.bookingRate(cr, bk) : null, bookL: qL >= 10 ? RS.bookingRate(crL, bkL) : null,
      estUsd: sumCol(sold, "Average Quote"), estUsdL: sumCol(soldL, "Average Quote"), estCf: sumCol(sold, "Total CF"), estCfL: sumCol(soldL, "Total CF"),
      big: qual(cr.filter(isBig)) >= 5 ? RS.bookingRate(cr.filter(isBig), bk.filter(isBig)) : null, ref: sumCol(rRef.get(n) || [], "Total refund") }; };
  const REPS = repNames.map(rep);
  table(g4, "Rep scorecard", `${seasonName} ${Y} · vs ${LY} where it matters`, ["Rep", "Jobs", "Total Bill", "vs " + LY, "Netcash + Card", "Qualified", "Confirmed", "Booking", "vs " + LY, "Estimates sold", "CF sold", "CF vs " + LY, "Big-move booking", "Refunds"],
    REPS.map(r => `<tr>${td(esc(r.n))}${td(fmtN(r.jobs))}${td(money(r.bill))}${dcell(r.bill, r.billL)}${td(money(r.ncc))}${td(fmtN(r.q))}${td(fmtN(r.conf))}${tdn(r.book, pct)}${ppcell(r.book, r.bookL)}${td(money(r.estUsd))}${td(fmtN(r.estCf))}${dcell(r.estCf, r.estCfL)}${tdn(r.big, pct)}${r.ref ? td(money(r.ref), "no") : `<td class="dim">—</td>`}</tr>`),
    { how: "Money = closings credited to the rep as Sales Person. Leads, bookings and estimates sold = Moveboard leads Assigned to the rep (estimates sold = average quote and CF of the leads they confirmed). A booking rate needs at least 10 qualified leads; big-move booking needs 5 big-move leads (the Moveboard Big Job flag). Refunds = paid in the window, by refund date." });
  const rb = REPS.filter(r => r.book != null);
  pairBars(g4, "Booking rate by rep", `${Y} vs ${LY}`, rb.map(r => r.n), rb.map(r => r.bookL), rb.map(r => r.book), pct, { axis: pct0, head: pct(C.book) + " team" });
  const re = REPS.filter(r => r.estUsd || r.estUsdL);
  pairBars(g4, "Estimates sold by rep", `${Y} vs ${LY} · $ of confirmed leads`, re.map(r => r.n), re.map(r => r.estUsdL), re.map(r => r.estUsd), money, { axis: moneyC, lbl: moneyC, head: money(estOf(Y).usd) });
  const qR = REPS.filter(r => r.book != null && r.jobs >= 20);
  quadrant(g4, "Salespeople — conversion vs job value", `${seasonName} ${Y} · bubble = jobs · dashed = team average`, qR.map(r => ({ k: r.n, x: r.book, y: r.bill / r.jobs, r: r.jobs })), pct0, money,
    { xLabel: "Booking rate", yLabel: "Average job value", goodX: "high", goodY: "high", xAvg: C.book, yAvg: C.avg, q: { tr: "★ converts more, sells bigger", bl: "converts less, sells smaller" },
      how: "Reps with a booking rate (10+ qualified leads) and 20+ jobs. A rep top-left sells big jobs but loses many leads; bottom-right books a lot of small ones." });

  // rep × lead source — which rep converts which provider
  const srcQ = grp(created(Y), r => normSrc(r.Source) || null), srcB = grp(booked(Y), r => normSrc(r.Source) || null);
  const topSrc = [...srcQ.keys()].map(s => ({ s, q: qual(srcQ.get(s)) })).filter(x => x.q >= 40).sort((a, b) => b.q - a.q).slice(0, 14).map(x => x.s);
  const mxReps = REPS.filter(r => r.q >= 40).map(r => r.n);
  const srcRate = s => RS.bookingRate(srcQ.get(s) || [], srcB.get(s) || []);
  table(g4, "Who converts which lead source", `${seasonName} ${Y} · booking rate, qualified leads underneath`, ["Lead source", "All reps"].concat(mxReps),
    topSrc.map(s => { const all = srcRate(s);
      return `<tr>${td(esc(s))}<td><b>${pct0(all)}</b><small>${fmtN(qual(srcQ.get(s)))}</small></td>` + mxReps.map(n => {
        const cr = (srcQ.get(s) || []).filter(r => String(r.Assigned || "").trim() === n), bk = (srcB.get(s) || []).filter(r => String(r.Assigned || "").trim() === n), q = qual(cr);
        if (q < 5) return `<td class="dim">${q ? `<small>${q}</small>` : "—"}</td>`;
        const v = RS.bookingRate(cr, bk), good = all != null && v != null && v >= all;
        return `<td><span class="${good ? "up" : "dn"}">${pct0(v)}</span><small>${fmtN(q)}</small></td>`; }).join("") + `</tr>`; }),
    { matrix: true, how: "Sources with at least 40 qualified leads and reps with at least 40 are shown; a cell needs 5 qualified leads. Green = the rep beat the whole team's rate on that source, red = below it. Post Card campaigns are pooled here." });

  // outbound calls by teammate (RingCentral) — the only per-person phone data served month by month
  const days = (y, a, b) => { let d = 0; for (let m = a; m <= b; m++) d += lastDay(y, m); return d; };
  const agentFold = y => { const g = new Map(); rcAgent.forEach(r => { if (String(r.Company) !== CO) return; const ym = String(r.Month || ""); if (+ym.slice(0, 4) !== y || +ym.slice(5, 7) < F || +ym.slice(5, 7) > T) return;
    const ext = String(r.Extension || "").trim(); if (!ext || /support zip to zip/i.test(ext)) return; const nm = ext.replace(/^\d+\s*-\s*/, "");
    const a = g.get(nm) || { calls: 0, dur: 0 }; a.calls += num(r.Calls); a.dur += num(r["Duration Seconds"]); g.set(nm, a); }); return g; };
  const agT = agentFold(Y), agL = agentFold(LY), dW = days(Y, F, T);
  const agRows = [...agT.entries()].filter(([, a]) => a.calls >= 50).sort((a, b) => b[1].calls - a[1].calls);
  const mmss = s => !s || !isFinite(s) ? "—" : Math.floor(s / 60) + ":" + pad(Math.round(s % 60));
  table(g4, "Outbound calls by teammate", `RingCentral · ${seasonName} ${Y}`, ["Teammate", "Calls", "Calls / day", "vs " + LY, "Talk hours", "Avg call"],
    agRows.map(([n, a]) => { const l = agL.get(n); return `<tr>${td(esc(n))}${td(fmtN(a.calls))}${td((a.calls / dW).toFixed(1))}${dcell(a.calls, l && l.calls)}${td(fmtN(Math.round(a.dur / 3600)))}${td(mmss(a.calls ? a.dur / a.calls : null))}</tr>`; }),
    { span2: false, how: "Outbound calls per RingCentral extension; calls per day divide by calendar days in the window, as the deck did. Inbound answered and missed calls per rep are not in the monthly phone rollups yet — see the gaps note at the end." });
  const rc = REPS.filter(r => r.conf || (rBkL.get(r.n) || []).length);
  pairBars(g4, "Confirmed jobs by rep", `${Y} vs ${LY}`, rc.map(r => r.n), rc.map(r => conf(rBkL.get(r.n) || [])), rc.map(r => r.conf), fmtN, { head: fmtN(C.conf) });

  /* ================= 05 · crew (foremen) ================= */
  const g5 = part("Crew", "foremen over the whole season — score, packing, reviews, hours");
  const scIn = y => scorecard.filter(r => { const m = String(r.Month || ""); return +m.slice(0, 4) === y && +m.slice(5, 7) >= F && +m.slice(5, 7) <= T; });
  const scFold = y => { const g = new Map(); scIn(y).forEach(r => { const n = String(r.Foreman || "").trim(); if (!n) return;
    const a = g.get(n) || { jobs: 0, sw: 0, sj: 0, w: 0, e: 0, cf: 0, rv: 0, fc: 0 }, j = num(r["Total Jobs"]), s = r["Total Score"];
    a.jobs += j; if (s != null && s !== "" && !isNaN(s)) { a.sw += +s * j; a.sj += j; }
    a.w += num(r["Total Packing Written"]); a.e += num(r["Total Packing Estimate"]); a.cf += num(r["Total CF"]); a.rv += num(r["Total Reviews Written"]); a.fc += num(r["Forman Fault Claims"]);
    g.set(n, a); }); return g; };
  const scT = scFold(Y), scL = scFold(LY), fcl = grp(cl(Y), key("Foreman")), fref = grp(rows("refunds", Y).filter(coRow), key("Foreman"));
  const FM = [...scT.entries()].filter(([, a]) => a.jobs >= 15 && a.sj).map(([n, a]) => { const l = scL.get(n), c = fcl.get(n) || [];
    return { n, a, score: a.sw / a.sj, scoreL: l && l.sj ? l.sw / l.sj : null, bill: bill(c), ncc: ncc(c), hrs: sumCol(c, "Foreman Hours"), ref: sumCol(fref.get(n) || [], "Total refund") }; })
    .sort((a, b) => b.score - a.score);
  table(g5, `Foreman of the ${seasonName.toLowerCase() === "summer" ? "Summer" : "Season"} ${Y}`, "job-weighted season score · ranked", ["#", "Foreman", "Score", "vs " + LY, "Jobs", "Total Bill", "Netcash + Card", "Hours / job", "Packing written", "vs estimate", "Packing / 100 CF", "Reviews / eligible job", "Claims share", "Refunds"],
    FM.map((f, i) => `<tr>${td(i + 1)}${td(`${i === 0 ? "👑 " : ""}${esc(f.n)}`, "")}${td(`<b>${f.score.toFixed(1)}</b>`)}${f.scoreL == null ? `<td class="dim">—</td>` : `<td class="${f.score >= f.scoreL ? "up" : "dn"}">${f.score >= f.scoreL ? "+" : ""}${(f.score - f.scoreL).toFixed(1)}</td>`}${td(fmtN(f.a.jobs))}${td(money(f.bill))}${td(money(f.ncc))}${tdn(f.a.jobs ? f.hrs / f.a.jobs : null, v => v.toFixed(1))}${td(money(f.a.w))}${tdn(f.a.e ? f.a.w / f.a.e : null, pct0)}${tdn(f.a.cf ? f.a.w / f.a.cf * 100 : null, money)}${(() => { const rv = REVFM && REVFM.get(f.n); return rv && rv.el ? tdn(rv.rv / rv.el, pct0) : tdn(f.a.jobs && f.a.rv ? f.a.rv / f.a.jobs : null, pct0); })()}${(() => { const x = FMCL && FMCL.get(f.n); return x && x.r != null ? `<td class="${x.small ? "dim" : x.r > (CC.rate || 0) ? "dn" : "up"}">${pct(x.r)}</td>` : (f.a.fc ? td(fmtN(f.a.fc) + " fault", "no") : td("0")); })()}${f.ref ? td(money(f.ref), "no") : `<td class="dim">—</td>`}</tr>`),
    { how: `Score = each month's foreman Total Score weighted by that month's jobs, so a busy July counts more than a quiet May. From July 2026 the monthly score is the 60 automatic + 40 assessment model; earlier months used the 70/30 model. Foremen with fewer than 15 jobs in the window are left out. Packing "vs estimate" = written ÷ the sales estimate: it is a floor, not a target — crews routinely write 1.5–3× the estimate. Reviews per eligible job and the claims share use the same rules as the Reviews and Claims parts above.` });
  const fh = [...fcl.entries()].map(([n, c]) => ({ n, j: c.length, h: sumCol(c, "Foreman Hours") })).filter(x => x.j >= 10).sort((a, b) => b.h - a.h).slice(0, 22);
  combo(g5, "Hours worked vs jobs done", `${seasonName} ${Y} · per foreman`, fh.map(x => x.n), fh.map(x => x.j), "Jobs", fmtN, fh.map(x => x.h), "Hours", fmtN,
    { span2: true, rotate: true, barColors: fh.map(() => INK), barAxis: fmtN, head: fmtN(fh.reduce((a, x) => a + x.h, 0)) + " h" });

  // what-ifs — static, computed from this season's own hours and packing (no dials to set)
  const helperIn = y => withWin(y, () => RS.filtered("helper_salaries", helperSal));
  const wf = y => { const c = cl(y), hl = helperIn(y); return { fh: sumCol(c, "Foreman Hours"), fp: sumCol(c, "Forman Total $"), hh: sumCol(hl, "Hours Worked"), hp: sumCol(hl, "Amount Received") }; };
  const w = wf(Y);
  table(g5, "What if crew pay rose by $1 an hour?", `${seasonName} ${Y} hours`, ["Role", "Hours", "Paid", "+$1 / hour costs", "Pay increase"],
    [[`Foremen`, w.fh, w.fp], [`Helpers`, w.hh, w.hp]].map(([r, h, p]) => `<tr>${td(r)}${td(fmtN(Math.round(h)))}${td(money(p))}${td(money(h))}${tdn(p ? h / p : null, pct)}</tr>`)
      .concat([`<tr class="tot">${td("Crew")}${td(fmtN(Math.round(w.fh + w.hh)))}${td(money(w.fp + w.hp))}${td(money(w.fh + w.hh))}${tdn(w.fp + w.hp ? (w.fh + w.hh) / (w.fp + w.hp) : null, pct)}</tr>`]),
    { span2: false, note: `One more dollar an hour for every foreman and helper would have cost ${money(w.fh + w.hh)} this season — ${C.ncc ? pct((w.fh + w.hh) / C.ncc) : "—"} of Netcash + Card.`,
      how: "Hours = foreman hours on the closings + helper hours on the helper salary sheet, for this window's jobs. Paid = foreman hourly + packing pay (Forman Total $) and helper amount received. Driver hours are not in the served data, so drivers are left out." });
  const pk = y => { const c = cl(y), sc = scFold(y); let alt = 0, com = 0, wr = 0, est = 0;
    grp(c, key("Foreman")).forEach((rs, n) => { const W = sumCol(rs, "Material Total"), K = sumCol(rs, "Material $"), E = (sc.get(n) || {}).e || 0; com += K; wr += W; est += E; if (W > 0) alt += K / W * Math.max(0, W - E); });
    return { wr, est, com, alt }; };
  table(g5, "What if packing commission were paid only above the estimate?", "per season", ["Season", "Packing written", "Sales estimate", "Commission paid", "If only above estimate", "Difference"],
    [Y, LY].filter(y => H[y]).map(y => { const p = pk(y); return `<tr>${td(y === Y ? `<b>${y}</b>` : y)}${td(money(p.wr))}${td(money(p.est))}${td(money(p.com))}${td(money(p.alt))}${td(money(p.com - p.alt), "up")}</tr>`; }),
    { span2: false, how: "Each foreman keeps his current commission rate, but earns it only on packing written above his sales estimate (estimate from the foreman scorecard). The difference is what the company would keep. It ignores how crews would change behaviour — a sizing, not a forecast." });

  /* ================= 06 · marketing ================= */
  const g6 = part("Marketing", `advertising, channels, postcards, repeat customers and phones${adCut ? ` · ad numbers ${adLbl}` : ""}`);
  seasonCols(g6, "Advertising spend", adTo == null ? "no ad spend posted for this window" : `${adLbl} · every season`, [{ label: "Ad spend", vals: YEARS.map(y => H[y].adSpend || null) }], money,
    { lbl: moneyC, head: money(C.adSpend), chips: chip(C.adSpend, P.adSpend, true), how: "Card transactions in the Advertising category, by transaction date." });
  donut(g6, "Jobs by lead source", `${seasonName} ${Y}`, [...grp(cl(Y), r => normSrc(r.Source) || "(no source)").entries()].map(([k, rs]) => ({ k, v: rs.length })).sort((a, b) => b.v - a.v), fmtN);
  const chan = y => { if (adTo == null) return new Map(); const g = new Map(), get = s => g.get(s) || (g.set(s, { ad: 0, leads: 0, jobs: 0, bill: 0, ncc: 0 }), g.get(s));
    adRows(y).forEach(r => { const s = normSrc(r.Source); if (s) get(s).ad += num(r.Amount); });
    created(y, F, adTo).forEach(r => { const s = normSrc(r.Source); if (g.has(s)) get(s).leads++; });
    grp(cl(y, F, adTo), r => normSrc(r.Source) || null).forEach((rs, s) => { if (g.has(s)) { const a = get(s); a.jobs = rs.length; a.bill = bill(rs); a.ncc = ncc(rs); } });
    return g; };
  const chT = chan(Y), chL = chan(LY);
  const chRows = [...chT.entries()].filter(([, a]) => a.ad > 0).sort((a, b) => b[1].ad - a[1].ad);
  const cpl = a => a && a.leads ? a.ad / a.leads : null, per1 = a => a && a.ad ? a.ncc / a.ad : null;
  const chTot = [...chT.values()].reduce((t, a) => ({ ad: t.ad + a.ad, leads: t.leads + a.leads, jobs: t.jobs + a.jobs, bill: t.bill + a.bill, ncc: t.ncc + a.ncc }), { ad: 0, leads: 0, jobs: 0, bill: 0, ncc: 0 });
  table(g6, "Paid channels — cost per lead and return per $1", `${adLbl || winLbl} ${Y} vs ${LY}`, ["Channel", "Ad spend", "Leads", "Cost / lead", "CPL " + LY, "Jobs", "Total Bill", "Netcash + Card", "Per $1", "Per $1 " + LY],
    chRows.map(([s, a]) => { const l = chL.get(s); const c1 = cpl(a), c0 = cpl(l), p1 = per1(a), p0 = per1(l);
      return `<tr>${td(esc(s))}${td(money(a.ad))}${td(fmtN(a.leads))}${tdn(c1, money)}${c0 == null ? `<td class="dim">—</td>` : `<td class="${c1 != null && c1 <= c0 ? "up" : "dn"}">${money(c0)}</td>`}${td(fmtN(a.jobs))}${td(money(a.bill))}${td(money(a.ncc))}${p1 == null ? `<td class="dim">—</td>` : `<td class="${p1 >= 5 ? "up" : p1 < 2 ? "dn" : ""}"><b>${x1(p1)}</b></td>`}${tdn(p0, x1)}</tr>`; })
      .concat([`<tr class="tot">${td("All paid channels")}${td(money(chTot.ad))}${td(fmtN(chTot.leads))}${tdn(cpl(chTot), money)}<td></td>${td(fmtN(chTot.jobs))}${td(money(chTot.bill))}${td(money(chTot.ncc))}${tdn(per1(chTot), x1)}<td></td></tr>`]),
    { how: `Every column uses the same months (${adLbl || winLbl}) so spend and results line up. Cost per lead = ad spend ÷ every lead from that source (bad leads included, as the deck did). Per $1 = Netcash + Card of the jobs from that source ÷ its ad spend. Last season's CPL is green when this season is cheaper. Post Card states are pooled here and split out below.` });

  const qC = chRows.map(([s, a]) => ({ k: s, x: cpl(a), y: per1(a), r: Math.round(a.ad) })).filter(p => p.x != null && p.y != null && p.r >= 1000);
  quadrant(g6, "Channels — cost per lead vs return per $1", `${adLbl || winLbl} ${Y} · bubble = ad spend`, qC, money, x1,
    { xLabel: "Cost per lead", yLabel: "Netcash + Card per $1", goodX: "low", goodY: "high", xAvg: cpl(chTot), yAvg: per1(chTot), rLabel: "ad $", q: { tl: "★ cheap leads, strong return", br: "dear leads, weak return" },
      how: "Channels with at least $1,000 of spend in the window. Lime = cheaper leads AND a better return than the paid average." });
  const pcKey = s => { const m = /post ?card\s*-\s*([A-Za-z]+)/i.exec(String(s || "")); return m ? "Post Card - " + m[1].toUpperCase() : null; };
  const pc = y => { if (adTo == null) return new Map(); const g = new Map(), get = k => g.get(k) || (g.set(k, { ad: 0, cr: [], bk: [], jobs: 0, ncc: 0 }), g.get(k));
    adRows(y).forEach(r => { const k = pcKey(r.Source) || pcKey(r.Provider); if (k) get(k).ad += num(r.Amount); });
    created(y, F, adTo).forEach(r => { const k = pcKey(r["Source Connector"]) || pcKey(r.Source); if (k) get(k).cr.push(r); });
    booked(y, F, adTo).forEach(r => { const k = pcKey(r["Source Connector"]) || pcKey(r.Source); if (k) get(k).bk.push(r); });
    grp(cl(y, F, adTo), r => pcKey(r.Source)).forEach((rs, k) => { const a = get(k); a.jobs = rs.length; a.ncc = ncc(rs); });
    return g; };
  const pcT = pc(Y), pcL = pc(LY);
  table(g6, "Postcard campaigns by state", `${adLbl || winLbl} ${Y} vs ${LY}`, ["Campaign", "Spend", "Leads", "Confirmed", "Booking", "Jobs", "Netcash + Card", "Per $1", "Per $1 " + LY],
    [...pcT.entries()].filter(([, a]) => a.ad || a.cr.length).sort((a, b) => b[1].ad - a[1].ad).map(([k, a]) => { const l = pcL.get(k), p1 = a.ad ? a.ncc / a.ad : null, p0 = l && l.ad ? l.ncc / l.ad : null;
      return `<tr>${td(esc(k))}${a.ad ? td(money(a.ad)) : `<td class="dim">—</td>`}${td(fmtN(a.cr.length))}${td(fmtN(conf(a.bk)))}${tdn(RS.bookingRate(a.cr, a.bk), pct)}${td(fmtN(a.jobs))}${td(money(a.ncc))}${tdn(p1, x1)}${tdn(p0, x1)}</tr>`; }),
    { span2: false, how: "Campaign = the state on the postcard's tracking line (Moveboard source connector, the closing's source, the card line's provider). The deck's conversion rate needs how many postcards were mailed — that count is not on file." });
  // Yelp — the card ledger books Yelp as ONE line, so return per $1 is company-wide; the funnel splits by state
  const yelpRows = (rs) => rs.filter(r => /^yelp/i.test(String(r.Source || "")));
  const yc = y => grp(yelpRows(created(y)), key("State Name")), yb = y => grp(yelpRows(booked(y)), key("State Name"));
  const ycT = yc(Y), ycL = yc(LY), ybT = yb(Y), ybL = yb(LY);
  const yAd = y => sumCol(adRows(y).filter(r => /^yelp/i.test(String(r.Source || ""))), "Amount"), yN = y => adTo == null ? 0 : ncc(cl(y, F, adTo).filter(r => /^yelp/i.test(String(r.Source || ""))));
  table(g6, "Yelp by state", `${Y} vs ${LY}`, ["State", String(LY), String(Y), String(LY), String(Y), String(LY), String(Y), "Δ"],
    [...new Set([...ycT.keys(), ...ycL.keys()])].map(s => ({ s, qT: qual(ycT.get(s) || []), qL: qual(ycL.get(s) || []) })).filter(x => x.qT + x.qL >= 10).sort((a, b) => b.qT - a.qT)
      .map(x => { const rT = RS.bookingRate(ycT.get(x.s) || [], ybT.get(x.s) || []), rL = RS.bookingRate(ycL.get(x.s) || [], ybL.get(x.s) || []);
        return `<tr>${td(esc(x.s))}${td(fmtN(x.qL))}${td(fmtN(x.qT))}${td(fmtN(conf(ybL.get(x.s) || [])))}${td(fmtN(conf(ybT.get(x.s) || [])))}${tdn(rL, pct)}${tdn(rT, pct)}${ppcell(rT, rL)}</tr>`; }),
    { span2: false, groups: [["", 1], ["Qualified leads", 2], ["Confirmed", 2], ["Booking rate", 3]],
      note: adTo == null ? "" : `Yelp spend ${money(yAd(Y))} returned ${x1(yAd(Y) ? yN(Y) / yAd(Y) : null)} of Netcash + Card per $1 (${adLbl}); ${LY}: ${x1(yAd(LY) ? yN(LY) / yAd(LY) : null)}.`,
      how: "Yelp is paid as a single account, so spend cannot be split by state — only the per-$1 return for Yelp as a whole is shown, in the insight line." });

  // repeat + referral customers
  const rr = (rs, which) => rs.filter(r => String(r.Source || "") === which);
  seasonCols(g6, "Repeat and referral customers — Total Bill", "Returned Customer vs Recommended · every season", [
    { label: "Returned customer", vals: YEARS.map(y => bill(rr(cl(y), "Returned Customer"))), color: LIMED }, { label: "Recommended", vals: YEARS.map(y => bill(rr(cl(y), "Recommended"))), color: INK }], money,
    { lbl: moneyC, head: money(bill(rr(cl(Y), "Returned Customer")) + bill(rr(cl(Y), "Recommended"))) });
  const rrSt = [...stTY.keys()].filter(s => (stTY.get(s) || []).length >= 20).sort((a, b) => (stTY.get(b) || []).length - (stTY.get(a) || []).length);
  const shr = (rs, which) => rs.length ? rr(rs, which).length / rs.length : null, rsh = rs => { const b = bill(rs); return b ? (bill(rr(rs, "Returned Customer")) + bill(rr(rs, "Recommended"))) / b : null; };
  table(g6, "Repeat and referral share by state", `${Y} vs ${LY}`, ["State", String(LY), String(Y), String(LY), String(Y), String(LY), String(Y)],
    rrSt.map(s => { const a = stTY.get(s) || [], b = stLY.get(s) || [];
      return `<tr>${td(esc(s))}${tdn(shr(b, "Returned Customer"), pct)}${tdn(shr(a, "Returned Customer"), pct)}${tdn(shr(b, "Recommended"), pct)}${tdn(shr(a, "Recommended"), pct)}${tdn(rsh(b), pct)}${tdn(rsh(a), pct)}</tr>`; }),
    { span2: false, groups: [["", 1], ["Returned % of jobs", 2], ["Recommended % of jobs", 2], ["Share of Total Bill", 2]], how: "A job is repeat when its closing source is Returned Customer, a referral when it is Recommended. States with at least 20 jobs this season." });

  // phones — RingCentral inbound lines, CallRail tracked numbers
  const lineFold = y => { const g = new Map(); rcLine.forEach(r => { if (String(r.Company) !== CO) return; const ym = String(r.Month || ""); if (+ym.slice(0, 4) !== y || +ym.slice(5, 7) < F || +ym.slice(5, 7) > T) return;
    const k = String(r["Line Name"] || "").trim() || "(unnamed numbers)", a = g.get(k) || { in: 0, ans: 0, miss: 0, dur: 0 }, n = num(r.Calls), res = String(r["Action Result"] || "");
    a.in += n; if (/^Accepted$/i.test(res)) { a.ans += n; a.dur += num(r["Duration Seconds"]); } else if (/^(Missed|Voicemail)$/i.test(res)) a.miss += n; g.set(k, a); }); return g; };
  const lnT = lineFold(Y), lnL = lineFold(LY);
  table(g6, "Inbound calls by company line", `RingCentral · ${seasonName} ${Y}`, ["Line", "Inbound", "vs " + LY, "Answered", "Missed (incl. VM)", "Avg handle time"],
    [...lnT.entries()].filter(([, a]) => a.in >= 20).sort((a, b) => b[1].in - a[1].in).map(([k, a]) => { const l = lnL.get(k), mr = a.in ? a.miss / a.in : null;
      return `<tr>${td(esc(k))}${td(fmtN(a.in))}${dcell(a.in, l && l.in)}${td(fmtN(a.ans))}${mr == null ? `<td class="dim">—</td>` : `<td class="${mr > .05 ? "dn" : "up"}">${pct(mr)}</td>`}${td(mmss(a.ans ? a.dur / a.ans : null))}</tr>`; }),
    { span2: false, how: "Inbound voice calls per company line (sessions, not ring legs). Missed includes voicemail, as the deck's \"% missed (w/ VM)\" did; red above the 5% goal. Handle time averages answered calls only." });
  const crT = rows("callrail", Y), crG = grp(crT, r => String(r.Source || "").trim() || "(no source)");
  table(g6, "Tracked marketing numbers", `CallRail · ${seasonName} ${Y}`, ["Source", "Calls", "First-time", "Returning", "Minutes", "Avg call"],
    [...crG.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 15).map(([k, rs]) => { const ft = rs.filter(r => Number(r["First-Time Caller"]) === 1).length, sec = sumCol(rs, "Duration Seconds");
      return `<tr>${td(esc(k))}${td(fmtN(rs.length))}${td(fmtN(ft))}${td(fmtN(rs.length - ft))}${td(fmtN(Math.round(sec / 60)))}${td(mmss(rs.length ? sec / rs.length : null))}</tr>`; }),
    { span2: false, how: "Calls to the CallRail tracking numbers, grouped by the source each number is assigned to. First-time = CallRail's first-time-caller flag." });

  /* ================= 07 · what the season says ================= */
  const g7 = part("What the season says", "findings computed from the cards above — and what this report cannot show yet");
  const F7 = [];
  if (gb != null) F7.push(`Total Bill ${gb >= 0 ? "grew" : "fell"} ${Math.abs(gb * 100).toFixed(0)}% while jobs ${gj >= 0 ? "grew" : "fell"} ${Math.abs((gj || 0) * 100).toFixed(0)}% — ${Math.abs(gb) > Math.abs(gj || 0) + .05 ? "price and job size did most of the work, not volume" : "volume and value moved together"}.`);
  if (C.rate != null && P.rate != null) F7.push(`The netcash rate ${C.rate >= P.rate ? "improved" : "slipped"} from ${pct(P.rate)} to ${pct(C.rate)}${Math.abs(C.rate - P.rate) < .01 ? " — essentially flat" : ""}.`);
  const chRank = chRows.map(([s, a]) => ({ s, p: per1(a), ad: a.ad, c: cpl(a) })).filter(x => x.ad >= 2000 && x.p != null).sort((a, b) => b.p - a.p);
  if (chRank.length >= 2) F7.push(`Best paid channel per $1: ${chRank[0].s} (${x1(chRank[0].p)}); weakest with real spend: ${chRank[chRank.length - 1].s} (${x1(chRank[chRank.length - 1].p)} on ${money(chRank[chRank.length - 1].ad)}).`);
  const cplRank = chRank.filter(x => x.c != null).sort((a, b) => a.c - b.c);
  if (cplRank.length >= 2) F7.push(`Cheapest leads: ${cplRank[0].s} at ${money(cplRank[0].c)} each; dearest: ${cplRank[cplRank.length - 1].s} at ${money(cplRank[cplRank.length - 1].c)}.`);
  const rbD = REPS.filter(r => r.book != null && r.bookL != null).map(r => ({ n: r.n, d: r.book - r.bookL })).sort((a, b) => b.d - a.d);
  if (rbD.length >= 2) F7.push(`Booking rate: ${rbD[0].n} gained the most (${rbD[0].d >= 0 ? "+" : ""}${(rbD[0].d * 100).toFixed(1)}pp); ${rbD[rbD.length - 1].n} lost the most (${(rbD[rbD.length - 1].d * 100).toFixed(1)}pp).`);
  if (C.missRate != null) F7.push(`${pct(C.missRate)} of inbound calls to company lines went unanswered or to voicemail (${P.missRate != null ? pct(P.missRate) + " last season" : "no prior season on file"}); the deck's goal is 5%.`);
  if (FM.length) F7.push(`Foreman of the ${seasonName.toLowerCase() === "summer" ? "Summer" : "Season"}: ${FM[0].n} (${FM[0].score.toFixed(1)}), ahead of ${FM.slice(1, 3).map(f => f.n + " (" + f.score.toFixed(1) + ")").join(" and ")}.`);
  if (CC.rate != null && CP.rate != null) F7.push(`Claims: ${pct(CC.rate)} of jobs drew one, against ${pct(CP.rate)} in ${LY} — ${fmtN(CC.claims)} claims, ${fmtN(CC.open)} still open, ${money(CC.refund || 0)} refunded on claimed jobs. Part of the rise is the claims board being used fully since mid-2025.`);
  if (FMCL) { const w = [...FMCL.values()].filter(x => !x.small && x.r != null).sort((a, b) => b.r - a.r); if (w.length >= 2) F7.push(`Highest claim share among foremen with 30+ jobs: ${w[0].f} (${pct(w[0].r)} of ${fmtN(w[0].n)} jobs); lowest: ${w[w.length - 1].f} (${pct(w[w.length - 1].r)}).`); }
  if (CC.revPerJob != null) F7.push(`Reviews: ${pct0(CC.revPerJob)} reviews per eligible job against ${CP.revPerJob == null ? "—" : pct0(CP.revPerJob)} in ${LY}; ${pct0(CC.revShare)} of eligible jobs got at least one. Negative reviews ${fmtN(CC.neg)} (${fmtN(CP.neg || 0)} in ${LY}).`);
  if (REVFM) { const b = [...REVFM.entries()].filter(([, a]) => a.el >= 15).map(([f, a]) => ({ f, r: a.rv / a.el })).sort((a, b2) => b2.r - a.r); if (b.length) F7.push(`Most reviews per eligible job: ${b[0].f} (${pct0(b[0].r)})${b.length > 1 ? `, then ${b[1].f} (${pct0(b[1].r)})` : ""}.`); }
  const fx = document.createElement("div"); fx.className = "srx-card span2";
  fx.innerHTML = `<div class="srx-exec"><b>Findings.</b><ul>${F7.map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>`;
  g7.appendChild(fx);
  const gap = card(g7, "In last summer's deck, not in this report yet", "missing data, not missing effort", { span2: true });
  const gl = document.createElement("div"); gl.className = "srx-note how";
  gl.innerHTML = `<b>Needs data we do not have · </b><ul class="srx-gap">
    <li><b>Customers lost to availability / price</b> — the deck counted surge days per state and the requests turned away on them. No surge-day or turned-away log exists; the Moveboard status "We are not available" is used on only a handful of leads.</li>
    <li><b>Postcard conversion rate</b> — needs the number of postcards mailed per campaign (a mailing file with campaign, state, date, count, cost).</li>
    <li><b>Google Search Console</b> clicks, impressions, CTR, position — not connected.</li>
    <li><b>CF written vs the carrier's CF</b> on long-distance jobs — the long-distance sheet keeps one CF value; a separate carrier CF is not recorded.</li>
    <li><b>Inbound answered / missed calls per sales rep</b> — the monthly phone rollups are per line (inbound) and per extension (outbound only). Rebuilding per-rep inbound needs a new rollup.</li>
    <li><b>Evening jobs by clock time</b> — the closing sheet has no start time; "afternoon jobs" (a foreman's second job of the day) stands in.</li>
    <li><b>Sales commission paid on the estimate</b> (the deck's what-if) — the rule it modelled was not written down; tell us the rule and it can be computed.</li></ul>`;
  gap.appendChild(gl);

  // layout balance: a half-width card with no partner on its row is promoted to full width, so a
  // card that is conditional (a missing grant, a thin season) can never leave a hole in the grid
  bodyEl.querySelectorAll(".srx-grid:not(.k)").forEach(g => { let pend = null;
    [...g.children].forEach(ch => { const full = ch.classList.contains("span2"); if (full) { if (pend) pend.classList.add("span2"); pend = null; } else pend = pend ? null : ch; });
    if (pend) pend.classList.add("span2"); });

  /* ---------- contents + controls ---------- */
  tocItems.forEach(t => { const b = document.createElement("button"); b.type = "button"; b.className = "srx-tocb"; b.innerHTML = `<i>${pad(t.n)}</i>${esc(t.title)}`; b.onclick = () => t.el.scrollIntoView({ behavior: document.visibilityState === "visible" ? "smooth" : "auto", block: "start" }); toc.appendChild(b); });
  const reRender = async () => {
    const sc = root.closest(".rs-content") || document.querySelector(".rs-content"), y = sc ? sc.scrollTop : 0;
    if (typeof renderPage === "function") await renderPage(); else await renderSeasonal(host);
    const s2 = document.querySelector(".rs-content"); if (s2) s2.scrollTop = y;
  };
  const maxY = latest ? +latest.slice(0, 4) : new Date().getFullYear();
  const yearVals = []; for (let y = maxY; y >= 2023; y--) yearVals.push({ v: String(y), l: String(y) });
  const monVals = MON.slice(1).map((l, i) => ({ v: String(i + 1), l }));
  RSC.localSelect(cover.querySelector("#srYear"), { label: "Season", values: yearVals, value: String(Y), required: true, onChange: v => { st.year = +v; reRender(); } });
  RSC.localSelect(cover.querySelector("#srFrom"), { label: "From", values: monVals, value: String(F), required: true, onChange: v => { st.from = +v; if (st.to < st.from) st.to = st.from; reRender(); } });
  RSC.localSelect(cover.querySelector("#srTo"), { label: "To", values: monVals, value: String(T), required: true, onChange: v => { st.to = +v; if (st.from > st.to) st.from = st.to; reRender(); } });
  const pb = cover.querySelector("#srPrint"); if (pb) pb.onclick = () => window.print();
}

registerPage({ id: "seasonal-report", group: "pulse", title: "Seasonal Report", render(host) { return renderSeasonal(host); } });
