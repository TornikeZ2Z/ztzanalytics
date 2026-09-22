/* PACKING MATERIALS SOLD — which materials the crews actually sell, and how much, per job.
 *
 * Marketing's ask (Tornike, 2026-09-09): "which packing materials are sold the most based on
 * CF, jobs and a lot of stuff ... per job statistics ... we are planning to buy different
 * shapes." So the page answers the buying question from three directions: which materials
 * move (units, jobs, dollars), how much of each a job takes (per buying job, per 100 CF),
 * and how that changes with the size of the move (CF bucket, building size) and over time.
 *
 * THE SOURCE IS WHAT WAS SOLD, NOT WHAT WAS QUOTED. Every line comes from the contract's
 * packing modal — the crew's record at the job, with quantity and unit price on 100% of
 * lines. The calendar's packing estimate is a different thing (the sale pitched at quoting)
 * and is deliberately not mixed in here; Packing Control compares the two.
 *
 * TWO MARTS, TWO GRAINS. The line table cannot say how many jobs bought NOTHING, and the
 * attach rate is the single number a buyer most needs. So a second, per-contract table
 * carries every final contract in the window, bought or not. A contract is the unit — two
 * contracts can share a job code (a split load, a re-delivery) and both can sell.
 *
 * THE RUNNING MONTH IS NOT A RESULT. It is marked wherever it appears and excluded from any
 * "per month" average, for the same reason Jobs by Area does it: an unfinished month beside
 * finished ones is the easiest thing to misread on a page about what sells.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    if (!RS.DATASETS.packing_sales_line) {
      RS.DATASETS.packing_sales_line = {
        table: "mart_packing_sales_line",
        // A PAYLOAD CONTRACT: projection is always on, a column missing here never arrives
        cols: ["Job Code", "Contract Id", "Company", "ym", "Material", "Material Raw", "Category", "Units",
               "Unit Price", "Line USD", "Labor Units", "Job CF", "CF Bucket",
               "Building Size", "Moving Type", "Job Type", "Foreman"],
      };
    }
    if (!RS.DATASETS.packing_sales_job) {
      RS.DATASETS.packing_sales_job = {
        table: "mart_packing_sales_job",
        cols: ["Contract Id", "Job Code", "Company", "ym", "Job CF", "CF Bucket",
               "Building Size", "Moving Type", "Job Type", "Foreman", "Has Materials",
               "Materials USD", "Units", "Kinds", "Closing Material Total", "Total Bill"],
      };
    }
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("pks-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "pks-style";
    // bars, fields, tiles, tables and pills are THE COMPONENT KIT in rs.css; only what the
    // kit has no name for lives here
    st.textContent = ""
      + ".pks{font-variant-numeric:tabular-nums}"
      // a share bar behind a number, so the eye ranks before it reads
      + ".pks-bar{position:relative;display:block;height:6px;border-radius:4px;"
      + "background:color-mix(in srgb,var(--ink) 7%,transparent);margin-top:5px;overflow:hidden}"
      + ".pks-bar i{display:block;height:100%;border-radius:4px;background:var(--brand)}"
      + ".pks-cat{font-size:11px;color:var(--muted);display:block;margin-top:1px}"
      // the size matrix: many narrow numeric columns, the material name sticky on the left
      + ".pks-mx th,.pks-mx td{white-space:nowrap}"
      + ".pks-mx th:first-child,.pks-mx td:first-child{position:sticky;left:0;background:var(--panel);z-index:1}"
      + ".pks-heat{display:inline-block;min-width:38px;padding:1px 6px;border-radius:5px;"
      + "background:color-mix(in srgb,var(--brand) var(--h,0%),transparent)}"
      // the running month, wherever it appears
      + ".pks-part{color:var(--warn);font-weight:700}"
      + ".pks-sortable th{cursor:pointer;user-select:none}"
      + ".pks-sortable th.on{color:var(--brand)}"
      + ".pks-seg{display:inline-flex;gap:4px;flex-wrap:wrap}"
      // a panel's heading row: title left, its segment control right
      + ".pks-sec{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 10px}"
      + ".pks-sec h3{margin:0;font-size:15px;flex:1 1 auto}"
      // the merge editor: raw name, where it counts, what it sold
      + ".pks-map input{font-family:inherit;font-size:12.5px;padding:4px 7px;border-radius:7px;border:1px solid var(--line);"
      + "background:var(--panel);color:var(--ink);width:100%;max-width:290px;outline:0}"
      + ".pks-map input:focus{border-color:var(--brand)}"
      + ".pks-map input.ok{border-color:var(--pos)} .pks-map input.bad{border-color:var(--neg)}"
      + ".pks-map tr.merged td:first-child{color:var(--muted)}"
      + ".pks-map .to{font-weight:700;color:var(--brand-d)}"
      + ".pks-sug{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 2px}"
      + ".pks-sug button{font-family:inherit;font-size:12px;padding:4px 10px;border-radius:999px;border:1px solid var(--line-2);"
      + "background:var(--panel);color:var(--ink);cursor:pointer}"
      + ".pks-sug button:hover{border-color:var(--brand)}"
      + ".pks-msg{font-size:12px;color:var(--muted)} .pks-msg.bad{color:var(--neg);font-weight:700}";
    document.head.appendChild(st);
  }

  const MON3 = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const PERIODS = [
    { k: "3m",  lab: "Last 3 months",  months: 3 },
    { k: "6m",  lab: "Last 6 months",  months: 6 },
    { k: "12m", lab: "Last 12 months", months: 12 },
    { k: "ytd", lab: "This year" },
    { k: "all", lab: "All time" },
  ];

registerPage({
  id: "packing-sales",
  group: "logistics",
  title: "Packing Materials Sold",
  subtitle: "Which materials the crews sell, how many a job takes, and how that shifts with " +
            "the size of the move — from the contract's own packing lines.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const fmtN = v => (v == null || isNaN(v)) ? "—" : Math.round(+v).toLocaleString();
    const fmt1 = v => (v == null || isNaN(v)) ? "—" : (+v).toFixed(1);
    const fmtUSD = v => (v == null || isNaN(v)) ? "—" : "$" + Math.round(+v).toLocaleString();
    const pct = (a, b) => b ? (a / b * 100 < 1 && a > 0 ? (a / b * 100).toFixed(1) : Math.round(a / b * 100)) + "%" : "—";
    const ymLab = ym => { const [y, m] = String(ym).split("-"); return MON3[+m] + " " + y; };

    const S = window.__PKS || (window.__PKS = {
      period: "12m", co: "", cat: "", size: "", cf: "", sort: "usd", sizeBy: "cf", fm: "",
    });
    injectStyle();
    host.innerHTML = '<div class="pks"><div class="panel">Loading the packing lines…</div></div>';
    const mine = host.querySelector(".pks");
    const alive = () => host.querySelector(".pks") === mine;

    const TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
    const NOW_YM = TODAY.slice(0, 7);

    /* THE MERGE MAP (his ask 2026-09-18). The same material has been labelled several ways in the
       contract's packing modal, so `packing_material_map` says which name each raw label counts under.
       The mart already applies it; the page applies it again over the RAW label so an edit shows at
       once instead of waiting for the next rebuild. A reader without write access still sees the
       merged numbers -- only the editor is hidden.

       THE NAME A LINE COUNTS UNDER IS NOT A LOAD-TIME FACT. It was computed once, here, and a
       saved merge then repainted from the stale name -- the table did not move until a full
       reload, under a panel that says "merges everywhere on this page at once". So a line keeps
       only what cannot change (its raw label, the category the mart gave it) and applyMap()
       re-derives `mat` and `cat` from MAP whenever MAP has changed (mapDirty), before anything
       is aggregated. It reads the RAW label, never the mart's `Material`: that column is the
       merge as of the last rebuild, so a merge he has just CLEARED would otherwise stay merged. */
    const mapHdr = { Authorization: "Bearer " + ZTZ.getToken() };
    const loadMap = () => fetch(ZTZ.API + "/api/_pkmap", { headers: mapHdr }).then(r => r.json()).catch(e => ({ error: String(e) }));
    return Promise.all([RS.load("packing_sales_line"), RS.load("packing_sales_job"), loadMap()]).then(([lines, jobs, mapRes]) => {
      if (!alive()) return;
      const canMap = !!(mapRes && !mapRes.error && mapRes.rows);
      const MAP = {};   // raw name -> { material, category, note } -- the whole row, it all goes back on a save
      ((mapRes && mapRes.rows) || []).forEach(r => {
        if (r && r.raw) MAP[r.raw] = { material: (r.material || "").trim(), category: (r.category || "").trim(), note: (r.note || "").trim() };
      });
      const rawOf = r => r["Material Raw"] || r.Material;
      lines = (lines || []).map(r => ({
        job: r["Job Code"], cid: String(r["Contract Id"]), co: r.Company || "Unknown", ym: r.ym,
        mat: "", raw: rawOf(r), cat: "", cat0: r.Category || "Other", units: +r.Units || 0,
        price: +r["Unit Price"] || 0, usd: +r["Line USD"] || 0, labor: +r["Labor Units"] || 0,
        cf: r["Job CF"] == null ? null : +r["Job CF"], cfb: r["CF Bucket"], size: r["Building Size"],
        mt: r["Moving Type"], jt: r["Job Type"], fm: r.Foreman || "Unknown",
      }));
      // the category a raw label's own lines carry -- what a label merged INTO it inherits
      const ownCat = {};
      lines.forEach(l => { if (!ownCat[l.raw]) ownCat[l.raw] = l.cat0; });
      const matOfRaw = raw => { const m = MAP[raw]; return (m && m.material) || raw; };
      /* a merged line sits in ONE category with the material it merged into: the map's own
         category first, then the target's, then the line's. Without the middle step a merge
         across categories (an old crate filed under Boxes into today's Carton Cratings) splits
         one material over two categories and the Category filter shows half of it. */
      const catOfLine = l => {
        const m = MAP[l.raw];
        if (m && m.category) return m.category;
        if (m && m.material) { const t = MAP[m.material]; return (t && t.category) || ownCat[m.material] || l.cat0; }
        return l.cat0;
      };
      let cats = [], mapDirty = true;
      function applyMap() {
        lines.forEach(l => { l.mat = matOfRaw(l.raw); l.cat = catOfLine(l); });
        cats = [...new Set(lines.map(l => l.cat))].filter(Boolean).sort();
        if (S.cat && cats.indexOf(S.cat) < 0) S.cat = "";   // a merge can empty the category being filtered on
        mapDirty = false;
      }
      jobs = (jobs || []).map(r => ({
        cid: String(r["Contract Id"]), job: r["Job Code"], co: r.Company || "Unknown", ym: r.ym,
        cf: r["Job CF"] == null ? null : +r["Job CF"], cfb: r["CF Bucket"], size: r["Building Size"],
        mt: r["Moving Type"], jt: r["Job Type"], fm: r.Foreman || "Unknown",
        has: +r["Has Materials"] === 1, usd: +r["Materials USD"] || 0, units: +r.Units || 0,
        kinds: +r.Kinds || 0, closingMat: r["Closing Material Total"] == null ? null : +r["Closing Material Total"],
        bill: r["Total Bill"] == null ? null : +r["Total Bill"],
      }));
      if (!lines.length) {
        mine.innerHTML = '<div class="panel">No packing lines found — the marts may not be built '
          + "yet (run sources=curated) or there is nothing to show.</div>";
        return;
      }

      const yms = [...new Set(jobs.map(j => j.ym))].filter(Boolean).sort();
      const cos = [...new Set(jobs.map(j => j.co))].filter(Boolean).sort();
      const sizes = [...new Set(jobs.map(j => j.size))].filter(Boolean).sort();
      const cfbs = [...new Set(jobs.map(j => j.cfb))].filter(Boolean).sort();
      const fms = [...new Set(jobs.filter(j => j.has).map(j => j.fm))].filter(Boolean).sort();

      /* the period resolves to a set of months; the running month stays IN the window
         (it is real, recent sales) but is marked and left out of per-month averages */
      function monthsFor(p) {
        if (p === "all") return new Set(yms);
        if (p === "ytd") return new Set(yms.filter(y => y.slice(0, 4) === NOW_YM.slice(0, 4)));
        const n = PERIODS.find(x => x.k === p).months;
        const idx = yms.indexOf(NOW_YM);
        const end = idx >= 0 ? idx : yms.length - 1;
        return new Set(yms.slice(Math.max(0, end - n + 1), end + 1));
      }

      function paint() {
        if (!alive()) return;
        if (mapDirty) applyMap();   // BEFORE any aggregate: a saved merge has to move every table below
        const months = monthsFor(S.period);
        const jobOk = j => months.has(j.ym) && (!S.co || j.co === S.co)
          && (!S.size || j.size === S.size) && (!S.cf || j.cfb === S.cf) && (!S.fm || j.fm === S.fm);
        const J = jobs.filter(jobOk);
        const jobSet = new Set(J.map(j => j.cid));
        const L = lines.filter(l => jobSet.has(l.cid) && (!S.cat || l.cat === S.cat));

        // ---- the headline numbers ---------------------------------------------------- //
        const contracts = J.length;
        const buyers = J.filter(j => j.has).length;
        const usd = L.reduce((a, l) => a + l.usd, 0);
        const units = L.reduce((a, l) => a + l.units, 0);
        const buyerIds = new Set(L.map(l => l.cid));
        const nBuy = buyerIds.size;
        const cfSum = J.filter(j => j.has && j.cf).reduce((a, j) => a + j.cf, 0);
        const kindsAvg = buyers ? J.filter(j => j.has).reduce((a, j) => a + j.kinds, 0) / buyers : 0;
        const finishedMonths = [...months].filter(m => m !== NOW_YM).length;

        // ---- per material ---------------------------------------------------------- //
        const byMat = {};
        L.forEach(l => {
          const m = byMat[l.mat] || (byMat[l.mat] = { mat: l.mat, cat: l.cat, units: 0, usd: 0, jobs: new Set(), cf: 0, cfUnits: 0, priceSum: 0, priceN: 0 });
          m.units += l.units; m.usd += l.usd; m.jobs.add(l.cid);
          if (l.cf) { m.cf += l.cf; m.cfUnits += l.units; }
          m.priceSum += l.price * l.units; m.priceN += l.units;
        });
        // per 100 CF is computed on the CF of the jobs that BOUGHT the material, once each —
        // summing job CF per line would count a job's CF as many times as it has lines
        const cfOfJob = {}; J.forEach(j => { cfOfJob[j.cid] = j.cf; });
        const mats = Object.values(byMat).map(m => {
          let cfTot = 0; m.jobs.forEach(c => { cfTot += cfOfJob[c] || 0; });
          return {
            mat: m.mat, cat: m.cat, units: m.units, usd: m.usd, jobs: m.jobs.size,
            perJob: m.jobs.size ? m.units / m.jobs.size : 0,
            per100: cfTot ? m.units / cfTot * 100 : null,
            price: m.priceN ? m.priceSum / m.priceN : 0,
          };
        });
        const sortKey = { usd: "usd", units: "units", jobs: "jobs", perjob: "perJob", per100: "per100" }[S.sort] || "usd";
        mats.sort((a, b) => (b[sortKey] || 0) - (a[sortKey] || 0));
        const maxUsd = Math.max(1, ...mats.map(m => m.usd));

        // ---- per category ---------------------------------------------------------- //
        const byCat = {};
        mats.forEach(m => {
          const c = byCat[m.cat] || (byCat[m.cat] = { cat: m.cat, units: 0, usd: 0, kinds: 0 });
          c.units += m.units; c.usd += m.usd; c.kinds += 1;
        });
        const catJobs = {};
        L.forEach(l => { (catJobs[l.cat] = catJobs[l.cat] || new Set()).add(l.cid); });

        // ---- per month --------------------------------------------------------------- //
        const byYm = {};
        [...months].sort().forEach(ym => { byYm[ym] = { ym: ym, contracts: 0, buyers: 0, units: 0, usd: 0 }; });
        J.forEach(j => { const r = byYm[j.ym]; if (!r) return; r.contracts++; if (j.has) r.buyers++; });
        L.forEach(l => { const r = byYm[l.ym]; if (!r) return; r.units += l.units; r.usd += l.usd; });
        const monthRows = Object.values(byYm);

        // ---- per size: the "which shapes" matrix -------------------------------------- //
        const sizeKey = S.sizeBy === "size" ? "size" : "cfb";
        const sizeGroups = [...new Set(J.map(j => j[sizeKey]))].filter(Boolean).sort();
        const topMats = mats.slice(0, 10).map(m => m.mat);
        // a column head drops the bracket to stay narrow -- unless the bracket is all that tells two
        // columns apart (both mattress covers reach the top ten "by jobs" and both read "Mattress Cover")
        const shortN = {}; topMats.forEach(m => { const s = shortMat(m); shortN[s] = (shortN[s] || 0) + 1; });
        const headOf = m => shortN[shortMat(m)] > 1 ? String(m).slice(0, 30) : shortMat(m);
        const cellUnits = {}, groupJobs = {};
        J.forEach(j => { const g = j[sizeKey]; (groupJobs[g] = groupJobs[g] || new Set()).add(j.cid); });
        const jobGroup = {}; J.forEach(j => { jobGroup[j.cid] = j[sizeKey]; });
        L.forEach(l => {
          if (topMats.indexOf(l.mat) < 0) return;
          const g = jobGroup[l.cid]; if (!g) return;
          const k = g + "" + l.mat;
          cellUnits[k] = (cellUnits[k] || 0) + l.units;
        });
        let cellMax = 0;
        sizeGroups.forEach(g => topMats.forEach(m => {
          const n = groupJobs[g] ? groupJobs[g].size : 0;
          const v = n ? (cellUnits[g + "" + m] || 0) / n : 0;
          if (v > cellMax) cellMax = v;
        }));

        // ---- per foreman ------------------------------------------------------------- //
        const byFm = {};
        J.forEach(j => {
          const f = byFm[j.fm] || (byFm[j.fm] = { fm: j.fm, contracts: 0, buyers: 0, usd: 0, units: 0 });
          f.contracts++; if (j.has) { f.buyers++; f.usd += j.usd; f.units += j.units; }
        });
        const fmRows = Object.values(byFm).filter(f => f.contracts >= 5).sort((a, b) => b.usd - a.usd).slice(0, 12);

        // ---- reconciliation against the closing sheet -------------------------------- //
        const rec = J.filter(j => j.has && j.closingMat != null);
        const recLines = rec.reduce((a, j) => a + j.usd, 0), recClosing = rec.reduce((a, j) => a + j.closingMat, 0);

        // ---- paint ------------------------------------------------------------------- //
        const periodLab = PERIODS.find(p => p.k === S.period).lab;
        let h = '<div class="rs-page-head"><h1>Packing Materials Sold</h1>'
          + "<p>What the crews actually sold on the job, line by line from the digital contract — "
          + "not the estimate pitched at quoting. A <b>contract</b> is the unit: two can share a job "
          + "code and both can sell.</p></div>";

        h += '<div class="rs-bar">'
          + '<div class="pks-seg" id="pksPeriod">' + PERIODS.map(p =>
              '<button class="rs-btn' + (S.period === p.k ? " pri" : "") + '" data-p="' + p.k + '">' + esc(p.lab) + "</button>").join("") + "</div>"
          + '<span class="rs-spacer"></span>'
          + '<div id="pksCo"></div><div id="pksCat"></div><div id="pksSize"></div><div id="pksCf"></div><div id="pksFm"></div>'
          + "</div>";

        h += '<div class="rs-kpis" style="--kpi-cols:6">'
          + kpi("Contracts", fmtN(contracts), periodLab + (S.co ? " · " + esc(S.co) : ""))
          + kpi("Bought materials", fmtN(buyers), "<b>" + pct(buyers, contracts) + "</b> attach rate")
          + kpi("Materials revenue", fmtUSD(usd), fmtN(units) + " units")
          + kpi("Per buying job", fmtUSD(nBuy ? usd / nBuy : 0), fmt1(nBuy ? units / nBuy : 0) + " units · " + fmt1(kindsAvg) + " kinds")
          + kpi("Per 100 CF", fmt1(cfSum ? units / cfSum * 100 : 0) + " units", fmtUSD(cfSum ? usd / cfSum * 100 : 0) + " per 100 CF")
          + kpi("Per finished month", fmtUSD(finishedMonths ? usd / finishedMonths : 0),
                finishedMonths + " month" + (finishedMonths === 1 ? "" : "s") + (months.has(NOW_YM) ? ' · <span class="pks-part">running month excluded</span>' : ""))
          + "</div>";

        // A. the materials table
        h += '<div class="panel"><div class="pks-sec"><h3>Which materials sell</h3>'
          + '<div class="pks-seg" id="pksSort">' + [["usd", "by revenue"], ["units", "by units"], ["jobs", "by jobs"], ["perjob", "per buying job"], ["per100", "per 100 CF"]].map(([k, l]) =>
              '<button class="rs-btn' + (S.sort === k ? " pri" : "") + '" data-k="' + k + '">' + l + "</button>").join("") + "</div></div>"
          + '<div class="rs-tablewrap"><table class="rs-table pks-sortable"><thead><tr>'
          + "<th>Material</th><th class=\"num\">Units</th><th class=\"num\">Jobs</th><th class=\"num\">Attach</th>"
          + "<th class=\"num\">Revenue</th><th class=\"num\">Share</th><th class=\"num\">Units / buying job</th>"
          + "<th class=\"num\">Units / 100 CF</th><th class=\"num\">Avg price</th></tr></thead><tbody>"
          + mats.map(m => "<tr><td>" + esc(m.mat) + '<span class="pks-cat">' + esc(m.cat) + "</span></td>"
              + '<td class="num strong">' + fmtN(m.units) + "</td>"
              + '<td class="num">' + fmtN(m.jobs) + "</td>"
              + '<td class="num muted">' + pct(m.jobs, contracts) + "</td>"
              + '<td class="num strong">' + fmtUSD(m.usd) + '<span class="pks-bar"><i style="width:' + (m.usd / maxUsd * 100).toFixed(1) + '%"></i></span></td>'
              + '<td class="num muted">' + pct(m.usd, usd) + "</td>"
              + '<td class="num">' + fmt1(m.perJob) + "</td>"
              + '<td class="num">' + (m.per100 == null ? "—" : fmt1(m.per100)) + "</td>"
              + '<td class="num muted">$' + m.price.toFixed(2) + "</td></tr>").join("")
          + "</tbody></table></div>"
          + '<p class="rs-hint"><b>Attach</b> is the share of all contracts in the window that bought this '
          + "material. <b>Units / buying job</b> counts only jobs that bought it. <b>Units / 100 CF</b> divides "
          + "by the recorded CF of those same jobs (the crew's final CF where it exists, the contract's estimate otherwise).</p></div>";

        // B. categories
        h += '<div class="panel"><div class="pks-sec"><h3>By category</h3></div>'
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Category</th><th class="num">Materials</th>'
          + '<th class="num">Units</th><th class="num">Jobs</th><th class="num">Attach</th><th class="num">Revenue</th><th class="num">Share</th></tr></thead><tbody>'
          + Object.values(byCat).sort((a, b) => b.usd - a.usd).map(c => "<tr><td>" + esc(c.cat) + "</td>"
              + '<td class="num">' + c.kinds + "</td><td class=\"num strong\">" + fmtN(c.units) + "</td>"
              + '<td class="num">' + fmtN(catJobs[c.cat] ? catJobs[c.cat].size : 0) + "</td>"
              + '<td class="num muted">' + pct(catJobs[c.cat] ? catJobs[c.cat].size : 0, contracts) + "</td>"
              + '<td class="num strong">' + fmtUSD(c.usd) + "</td><td class=\"num muted\">" + pct(c.usd, usd) + "</td></tr>").join("")
          + "</tbody></table></div></div>";

        // C. the size matrix
        h += '<div class="panel"><div class="pks-sec"><h3>How much a job takes, by size of move</h3>'
          + '<div class="pks-seg" id="pksSizeBy">'
          + '<button class="rs-btn' + (S.sizeBy === "cf" ? " pri" : "") + '" data-k="cf">by CF</button>'
          + '<button class="rs-btn' + (S.sizeBy === "size" ? " pri" : "") + '" data-k="size">by building size</button></div></div>'
          + '<div class="rs-tablewrap"><table class="rs-table pks-mx"><thead><tr><th>' + (S.sizeBy === "size" ? "Building size" : "Job CF") + "</th>"
          + '<th class="num">Contracts</th><th class="num">Attach</th><th class="num">$ / buying job</th>'
          + topMats.map(m => '<th class="num" title="' + esc(m) + '">' + esc(headOf(m)) + "</th>").join("") + "</tr></thead><tbody>"
          + sizeGroups.map(g => {
              const ids = groupJobs[g] || new Set(); const n = ids.size;
              const gj = J.filter(j => j[sizeKey] === g); const gb = gj.filter(j => j.has);
              const gusd = gb.reduce((a, j) => a + j.usd, 0);
              return "<tr><td>" + esc(g.replace(/^\d\s+/, "")) + "</td>"
                + '<td class="num">' + fmtN(n) + "</td>"
                + '<td class="num muted">' + pct(gb.length, n) + "</td>"
                + '<td class="num">' + fmtUSD(gb.length ? gusd / gb.length : 0) + "</td>"
                + topMats.map(m => {
                    const v = n ? (cellUnits[g + "" + m] || 0) / n : 0;
                    const hpct = cellMax ? Math.round(v / cellMax * 70) : 0;
                    return '<td class="num"><span class="pks-heat" style="--h:' + hpct + '%">' + fmt1(v) + "</span></td>";
                  }).join("") + "</tr>";
            }).join("")
          + "</tbody></table></div>"
          + '<p class="rs-hint">Each cell is <b>units per contract</b> in that size band (all contracts, bought or not) for the '
          + "ten best-selling materials — the number to buy stock against. Darker is more. Bands and building sizes with few contracts are noisy; read the Contracts column first.</p></div>";

        // D. months
        h += '<div class="panel"><div class="pks-sec"><h3>Month by month</h3></div>'
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Month</th><th class="num">Contracts</th>'
          + '<th class="num">Bought</th><th class="num">Attach</th><th class="num">Units</th><th class="num">Revenue</th><th class="num">$ / buying job</th></tr></thead><tbody>'
          + monthRows.map(r => { const part = r.ym === NOW_YM;
              return "<tr><td>" + esc(ymLab(r.ym)) + (part ? ' <span class="pks-part">running</span>' : "") + "</td>"
                + '<td class="num">' + fmtN(r.contracts) + "</td><td class=\"num\">" + fmtN(r.buyers) + "</td>"
                + '<td class="num muted">' + pct(r.buyers, r.contracts) + "</td>"
                + '<td class="num">' + fmtN(r.units) + "</td><td class=\"num strong\">" + fmtUSD(r.usd) + "</td>"
                + '<td class="num">' + fmtUSD(r.buyers ? r.usd / r.buyers : 0) + "</td></tr>"; }).join("")
          + "</tbody></table></div></div>";

        // E. foremen
        h += '<div class="panel"><div class="pks-sec"><h3>Who sells it</h3></div>'
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Foreman</th><th class="num">Contracts</th>'
          + '<th class="num">Attach</th><th class="num">Revenue</th><th class="num">$ / buying job</th><th class="num">Units / buying job</th></tr></thead><tbody>'
          + fmRows.map(f => "<tr><td>" + esc(f.fm) + "</td><td class=\"num\">" + fmtN(f.contracts) + "</td>"
              + '<td class="num muted">' + pct(f.buyers, f.contracts) + "</td><td class=\"num strong\">" + fmtUSD(f.usd) + "</td>"
              + '<td class="num">' + fmtUSD(f.buyers ? f.usd / f.buyers : 0) + "</td><td class=\"num\">" + fmt1(f.buyers ? f.units / f.buyers : 0) + "</td></tr>").join("")
          + "</tbody></table></div>"
          + '<p class="rs-hint">Foremen with at least five contracts in the window, top twelve by revenue.</p></div>';

        // F. reconciliation
        h += '<div class="panel"><div class="pks-sec"><h3>Ties out to the closing sheet</h3></div>'
          + '<p class="rs-hint" style="margin:0">On the ' + fmtN(rec.length) + " buying contracts that also have a closing figure, the packing lines sum to <b>"
          + fmtUSD(recLines) + "</b> against the closing sheet's Material Total of <b>" + fmtUSD(recClosing) + "</b>"
          + (recClosing ? " (" + pct(recLines, recClosing) + ")" : "") + ". The closing stays the money of record; this page is the "
          + "material detail behind it, and a gap is a sale recorded on one and not the other.</p></div>";

        h += mapPanel();

        mine.innerHTML = h;
        wire();
        wireMap();

        function kpi(lab, val, sub) {
          // the kit's tile: .rs-kpis .kpi with .v (value) .l (label) .s (sub), value first
          return '<div class="kpi"><div class="v">' + val + '</div><div class="l">' + lab + '</div><div class="s">' + sub + "</div></div>";
        }
      }

      /* WHICH NAMES ARE THE SAME THING — the page's suggestion, never applied by itself.

         A CONFIRMED LIST, NOT A GUESS. The first version normalised the size in brackets away,
         and on the real names that offered all six mattress covers as one material (Queen/King
         with Twin/Full -- two products on two shelves), offered Moving Blanket (Rent for storage)
         into (Sale) -- a rental into a sale -- and MISSED the two biggest true duplicates, which
         share no normal form at all: "Roll of tape" / "Roll of Moving Tape" and "Wardrobe box" /
         'Wardrobe box 24" (w/ Hanging bar)'. One click on "Merge all" would have written every
         one of those. What is in the brackets IS the product.

         So the pairs are spelled out, exactly as mart_packing_sales_line has them (read
         2026-09-22, 29 raw names, every company on the page). Each was checked against the dates:
         the modal was re-labelled on 2025-11-17/18, and the old name stops the day the new one
         starts. The four single-size mattress covers of the old modal fold into the pair that
         CONTAINS their size (a Single is a Twin); nothing crosses from one pair to the other.
         The plain China Box is the same 5.2 cu. ft box at the same $22, seven lines in 2026.

         NOT here, on purpose -- only he can say which is which: the old crates (Large / Small
         Glass-Mirror-picture, Large / Small TV, Extra Large) against today's Small / Medium /
         Large by CF, and "Shrink Wrap per item" against the three wrap sizes. Those cross a size.
         And Rent never merges into Sale. */
      const KNOWN_SAME = [
        ["Roll of tape",                        "Roll of Moving Tape"],
        ["Wardrobe box",                        'Wardrobe box 24" (w/ Hanging bar)'],
        ["China Box / Dish Pack (5.2 cu. Ft)",  "China Box / Dish Pack (Double Wall ~ 5.2 cu. Ft)"],
        ["Mattress Cover (Queen)",              "Mattress Cover (Queen/King)"],
        ["Mattress Cover (King)",               "Mattress Cover (Queen/King)"],
        ["Mattress Cover (Full)",               "Mattress Cover (Twin/Full)"],
        ["Mattress Cover (Single)",             "Mattress Cover (Twin/Full)"],
      ];
      /* the fallback, for a label that is only RE-TYPED tomorrow: case, punctuation, spacing, a
         plural. Every word and every number stays, brackets included, so two sizes -- or a rent
         and a sale -- can never land on the same string. On today's 29 names it finds nothing. */
      const normMat = m => String(m || "").toLowerCase()
        .replace(/[^a-z0-9]+/g, " ").replace(/\b([a-z]{3,})s\b/g, "$1").trim();
      function mapRows() {
        const t = {};
        lines.forEach(l => { const a = t[l.raw] || (t[l.raw] = { raw: l.raw, units: 0, usd: 0, cat: l.cat }); a.units += l.units; a.usd += l.usd; });
        return Object.values(t).sort((a, b) => b.usd - a.usd);
      }
      // one entry per label to move: { from: <row>, into: <name> }. A label already mapped is his
      // decision and is left alone; a target that is itself mapped is followed, so no chain is built.
      function suggestions(rows) {
        const have = {}; rows.forEach(r => { have[r.raw] = r; });
        const mapped = raw => !!(MAP[raw] || {}).material;
        const out = [], taken = {};
        const offer = (from, into) => {
          const to = mapped(into) ? MAP[into].material : into;
          if (!have[from] || !have[into] || mapped(from) || taken[from] || from === to) return;
          taken[from] = 1; out.push({ from: have[from], into: to });
        };
        KNOWN_SAME.forEach(p => offer(p[0], p[1]));
        const targets = new Set(KNOWN_SAME.map(p => p[1]));
        const g = {};
        rows.forEach(r => { if (mapped(r.raw) || taken[r.raw]) return; const k = normMat(r.raw); (g[k] = g[k] || []).push(r); });
        Object.values(g).filter(a => a.length > 1).forEach(a => {
          const s = a.slice().sort((x, y) => y.usd - x.usd);
          const head = s.find(r => targets.has(r.raw)) || s[0];   // never move a label others are moving INTO
          s.forEach(r => { if (r !== head && !targets.has(r.raw)) offer(r.raw, head.raw); });
        });
        return out;
      }
      let mapMsg = { text: "", bad: false };   // outlives the repaint a save triggers -- written into the DOM it was wiped at once
      function mapPanel() {
        const rows = mapRows();
        const names = [...new Set(rows.map(r => (MAP[r.raw] || {}).material || r.raw))].sort();
        const sug = suggestions(rows);
        let x = '<div class="panel" id="pksMap"><div class="pks-sec"><h3>Material names — merge the ones that are the same</h3></div>'
          + '<p class="rs-hint" style="margin:0 0 10px">The contract\'s packing modal has been re-labelled over the years, so one material sells under several names. '
          + 'Type the name a label should count under and it merges everywhere on this page at once; leave it empty to keep the label as it is. '
          + (canMap ? "Saved for everyone, and the marts follow at the next refresh." : "<b>Your access here is read-only.</b>") + "</p>";
        if (canMap && sug.length) {
          // the FULL names on every chip: the bracket is what tells a Queen/King from a Twin/Full
          x += '<div class="pks-sug"><span class="pks-msg">The same material under an older label:</span>'
            + sug.map(s2 => '<button type="button" data-from="' + esc(s2.from.raw) + '" data-into="' + esc(s2.into) + '" title="'
              + esc(fmtN(s2.from.units) + " units · " + fmtUSD(s2.from.usd) + " would count under " + s2.into) + '">'
              + esc(s2.from.raw) + " → " + esc(s2.into) + "</button>").join("")
            + (sug.length > 1 ? '<button type="button" data-sugall="1">Merge all ' + sug.length + "</button>" : "") + "</div>";
        }
        x += '<datalist id="pksNames">' + names.map(n => '<option value="' + esc(n) + '"></option>').join("") + "</datalist>"
          + '<div class="rs-tablewrap pks-map"><table class="rs-table"><thead><tr><th>Name on the contract</th><th>Counts under</th>'
          + '<th class="num">Units</th><th class="num">Sold</th><th>Category</th></tr></thead><tbody>'
          + rows.map(r => { const m = MAP[r.raw] || {}; const to = (m.material || "").trim();
            return '<tr' + (to ? ' class="merged"' : "") + '><td>' + esc(r.raw) + "</td>"
              + '<td>' + (canMap ? '<input list="pksNames" data-raw="' + esc(r.raw) + '" value="' + esc(to) + '" placeholder="— keeps its own name —">'
                                 : (to ? '<span class="to">' + esc(to) + "</span>" : '<span class="rs-hint">—</span>')) + "</td>"
              + '<td class="num">' + fmtN(r.units) + '</td><td class="num">' + fmtUSD(r.usd) + "</td>"
              + "<td>" + esc(m.category || r.cat) + "</td></tr>"; }).join("")
          + '</tbody></table></div><div class="pks-msg' + (mapMsg.bad ? " bad" : "") + '" id="pksMapMsg">' + esc(mapMsg.text) + "</div></div>";
        return x;
      }
      async function saveMap(raw, material, inp) {
        if (inp) inp.classList.remove("ok", "bad");
        /* THE WHOLE ROW GOES BACK. The endpoint writes Category and Note from the payload on
           every save (ON DUPLICATE KEY UPDATE ... VALUES(`Category`)), so a POST of raw + material
           alone NULLs a category somebody set for that label. Send what the row already holds. */
        const prev = MAP[raw] || {};
        const body = { raw: raw, material: material };
        if (prev.category) body.category = prev.category;
        if (prev.note) body.note = prev.note;
        const r = await fetch(ZTZ.API + "/api/_pkmap", { method: "POST", headers: Object.assign({ "Content-Type": "application/json" }, mapHdr),
          body: JSON.stringify(body) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        // a cleared merge keeps its row, as the table does: the name goes back to the label's own, the category stays
        // the endpoint answers with the row as STORED (it no longer wipes a field we did not send),
        // so the map takes what the warehouse actually holds rather than what we hoped it wrote
        MAP[raw] = { material: String(j.material || "").trim(),
                     category: String(j.category != null ? j.category : (prev.category || "")).trim(),
                     note: String(j.note != null ? j.note : (prev.note || "")).trim() };
        mapDirty = true;   // paint() re-derives every line's name and category before it aggregates
        if (inp) inp.classList.add("ok");
      }
      function wireMap() {
        if (!alive() || !canMap) return;
        const msg = mine.querySelector("#pksMapMsg");
        const failed = e => { mapMsg = { text: "not saved — " + String(e && e.message || e), bad: true }; };
        mine.querySelectorAll('#pksMap input[data-raw]').forEach(inp => {
          inp.addEventListener("change", async () => {
            const raw = inp.dataset.raw, to = inp.value.trim();
            try {
              await saveMap(raw, to, inp);
              const now = (MAP[raw] || {}).material;
              mapMsg = { text: "saved — " + (now ? raw + " now counts under " + now : raw + " keeps its own name"), bad: false };
              paint();
            } catch (e) {
              // nothing changed, so nothing is repainted: what he typed stays in the box, marked
              failed(e); inp.classList.add("bad");
              if (msg) { msg.className = "pks-msg bad"; msg.textContent = mapMsg.text; }
            }
          });
        });
        // several saves in a row: whatever did save is shown, even when a later one fails
        const runAll = async pairs => {
          let n = 0;
          try {
            for (const p of pairs) { await saveMap(p[0], p[1]); n++; }
            mapMsg = { text: "saved — " + n + " label" + (n === 1 ? "" : "s") + " merged", bad: false };
          } catch (e) { failed(e); if (n) mapMsg.text += " (" + n + " saved before it)"; }
          paint();
        };
        mine.querySelectorAll("#pksMap button[data-from]").forEach(b => {
          b.onclick = () => runAll([[b.dataset.from, b.dataset.into]]);
        });
        const all = mine.querySelector("#pksMap button[data-sugall]");
        if (all) all.onclick = () => runAll(suggestions(mapRows()).map(s2 => [s2.from.raw, s2.into]));
      }

      function shortMat(m) {
        return String(m).replace(/\s*\(.*?\)\s*/g, " ").replace(/Carton Crate|Carton Crating/i, "Crate").trim().slice(0, 22);
      }

      function wire() {
        if (!alive()) return;
        mine.querySelectorAll("#pksPeriod button").forEach(b => { b.onclick = () => { S.period = b.dataset.p; paint(); }; });
        mine.querySelectorAll("#pksSort button").forEach(b => { b.onclick = () => { S.sort = b.dataset.k; paint(); }; });
        mine.querySelectorAll("#pksSizeBy button").forEach(b => { b.onclick = () => { S.sizeBy = b.dataset.k; paint(); }; });
        const sel = (id, label, values, cur, allLabel, set) => {
          const el = mine.querySelector("#" + id);
          if (el) RSC.localSelect(el, { label: label, values: values, value: cur, allLabel: allLabel,
            onChange: function (v) { set(v); paint(); } });
        };
        sel("pksCo", "Company", cos, S.co, "All books", v => { S.co = v; });
        sel("pksCat", "Category", cats, S.cat, "All categories", v => { S.cat = v; });
        sel("pksSize", "Building size", sizes, S.size, "Any size", v => { S.size = v; });
        sel("pksCf", "Job CF", cfbs.map(c => ({ v: c, l: c.replace(/^\d\s+/, "") })), S.cf, "Any CF", v => { S.cf = v; });
        sel("pksFm", "Foreman", fms, S.fm, "All foremen", v => { S.fm = v; });
      }

      paint();
    }).catch(e => {
      if (!alive()) return;
      mine.innerHTML = '<div class="panel">Could not load the packing lines — ' + esc(e && e.message || e) + "</div>";
    });
  },
});
})();
