/* MARKETING page: Source Analysis — pick one source and see everything it did.
 *
 * Tornike, 2026-09-23: "create a new report, Source Analysis ... allow user to choose the
 * source and show them all the statistics ... filters like date, state etc ... review the
 * leads and its conversions ... make it perfect". His dummy PBIX ("Single Lead Analysis", four
 * pages) was the completeness checklist, not the design: its Graph page, its Latest Leads list
 * and its "Analyze by" pivot live here on ONE page; its Comparison page (broken in the dummy --
 * no axis, ignores its own period picker) becomes vs-previous-period / vs-last-year arrows on
 * the cards. Page id `source-report`, because `source-analysis` is a RETIRED id that redirects
 * to the Monthly Report and would bounce this page away.
 *
 * DATA: three narrow marts built by src/source_analysis.py and nothing wider -- Marketing has
 * never held fct_moveboard / fct_closing. The lead list's contact columns (name, phone, email,
 * addresses) are not in any granted mart (2026-09-23 review: they live in a table the generic
 * path never serves); /api/_srclead serves them for one source, one company and one window
 * at a time.
 *
 * THE DEFINITIONS, each one the portal's existing rule rather than a new one:
 *   Source          a FAMILY of the `Source` label Source Trace and the Monthly Report read:
 *                   post cards pooled ("Post Card - NJ" is Post Card), state-suffixed spend
 *                   labels folded ("Yelp-DE" is Yelp). Inside Post Card, a campaign drill.
 *   Booking rate    RS.bookingRate: confirmed BY BOOKED DATE / qualified BY CREATE DATE
 *                   (date-basis-authority). It can count bookings of leads created before the
 *                   window, so a COHORT line sits under it: of the leads created in the window,
 *                   how many booked, how many moved (a closing exists), what they were billed.
 *   Local / LD      service_type_map: everything except Service Type 'Long Distance' is Local.
 *   Dead            Status Category 'Bad Lead' -- shown as an EXIT from the funnel with its
 *                   reasons (the rep's Flag), never as a funnel step.
 *   Not quoted      a lead whose Max Quote is not positive. Moveboard files those at a fake
 *                   $500, which would make "$501-$1,000" look like where leads go to die.
 *   States          the 8 service states by pickup state; every other state and a blank one are
 *                   grouped as "Other / unknown", never dropped.
 *   Spend           the advertising ledger, pooled per family. It has no state and no Local /
 *                   LD split, so the spend section ignores both and says so.
 *
 * ITS OWN FILTERS, NOT THE GLOBAL BAR: PAGE_DATASETS [] + BARE_CHROME. Company defaults to
 * Zip to Zip (Tuji is its own Moveboard account and its own picker value).
 */
(function () {
  if (!window.RS || !RS.DATASETS) return;
  if (!RS.DATASETS.src_lead) {
    RS.DATASETS.src_lead = {
      table: "mart_source_lead",
      // the ANALYTIC half only; contact detail comes from /api/_srclead when the list needs it
      cols: ["Request Joinkey", "Company", "Create Date", "Booked Date", "Status",
             "Status Category", "Flag", "Source", "Family", "Campaign", "Service Type",
             "Moving Type", "State", "Size of Move", "CF", "CF Range", "Quote", "Quote Band",
             "Rep", "Moved", "Billed"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.src_job) {
    RS.DATASETS.src_job = {
      table: "mart_source_job",
      cols: ["Unique Key", "Company", "Date", "Record Source", "Source", "Family", "Campaign",
             "State", "Moving Type", "Billed", "Cash", "Has Lead"],
      dateCols: {}, defaultDate: null,
    };
  }
  if (!RS.DATASETS.src_spend) {
    RS.DATASETS.src_spend = {
      table: "mart_source_spend",
      // Form Export Date (2026-09-24): the newest website-form export, the only source of UTM tags
      cols: ["Date", "Company", "Source", "Family", "Campaign", "Spend", "Ledger End", "Form Export Date"],
      dateCols: {}, defaultDate: null,
    };
  }
})();

(function () {
  var PREF_KEY = "source-report.cols";
  var SERVICE_STATES = ["NJ", "PA", "NY", "DE", "CT", "MD", "MA", "VA"];
  var OTHER_ST = "Other / unknown";
  var CF_ORDER = ["0-200", "201-500", "501-800", "801-1000", "1001-1500", "1501-2000",
                  "Over 2000", "(no volume)"];
  var QB_ORDER = ["Not quoted", "$0 - $500", "$501 - $1,000", "$1,001 - $3,000",
                  "$3,001 - $5,000", "$5,001 - $10,000", "$10,001 - $20,000", "Over $20,000"];
  var SIDES = [["Local", "Local"], ["Long distance", "Long distance"]];
  var THIN = 30;          // below this many qualified leads a rate is marked "small sample"

  /* Page state lives at module scope so a re-render (theme switch, a global filter change on
     another page) keeps the reader's picks. */
  var S = {
    fam: null, camp: "", co: "Zip to Zip", from: null, to: null, cmp: "ly",
    states: new Set(), mt: "both", by: "month",
    list: { page: 0, per: 50, q: "", cat: "" },
    cols: null, bootDone: false,
  };
  var DATA = { ready: false, byFam: null, minDay: null, maxDay: null, ledgerEnd: null, formsDate: null };
  var FORMS_STALE_DAYS = 10;   // the export is due weekly (his call 2026-09-24); 10 days = one Monday missed
  var DETAIL = {};        // "fam|co|from|to" -> {rows: {jk: row}, capped, error} (or a Promise)
  var PREF = { loaded: false, loading: false, saved: null, note: "" };
  var saveTimer = null;

  /* ------------------------------------------------------------------ helpers ---- */
  function esc(s) { return RSC.esc(s == null ? "" : String(s)); }
  var num = function (v) { return RS.num(v) || 0; };
  var fmtN = function (v) { return RS.fmtN(v); };
  var money0 = function (v) { return (v == null || isNaN(v)) ? "—" : RS.money(v, 0); };
  var pct1 = function (v) { return (v == null || isNaN(v)) ? "—" : (100 * v).toFixed(1) + "%"; };
  var iso = function (d) { return d.toLocaleDateString("en-CA"); };
  var today = function () { return iso(new Date()); };
  function addDays(s, n) { var d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  function addYears(s, n) { var d = new Date(s + "T12:00:00"); d.setFullYear(d.getFullYear() + n); return iso(d); }
  function dayCount(a, b) {
    return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5) + 1;
  }
  function inR(d, a, b) { return !!d && d >= a && d <= b; }
  function niceDay(s) {
    if (!s) return "—";
    var d = new Date(s + "T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  function monthLbl(ym) {
    var d = new Date(ym + "-15T12:00:00");
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  function stateKey(st) {
    var s = String(st == null ? "" : st).trim().toUpperCase();
    return SERVICE_STATES.indexOf(s) >= 0 ? s : OTHER_ST;
  }
  function isQual(r) { return r["Status Category"] !== "Bad Lead"; }
  function isDead(r) { return r["Status Category"] === "Bad Lead"; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  /* Chart colours are the THEME's tokens, read at paint time, so light and dark both come out
     right and the theme toggle (which re-renders the page) repaints them. Solid fills only. */
  function palette() {
    var cs = getComputedStyle(document.body);
    var v = function (n, fb) { var x = (cs.getPropertyValue(n) || "").trim(); return x || fb; };
    return { blue: v("--blue", "#5b8cff"), brand: v("--brand", "#b7e23b"),
             ink: v("--ink", "#e9eef6"), violet: v("--purple", "#a78bfa"),
             faint: v("--faint", "#5c6a7c"), muted: v("--muted", "#8b98a8") };
  }

  function injectStyle() {
    if (document.getElementById("sra-style")) return;
    var st = document.createElement("style");
    st.id = "sra-style";
    /* Page-specific visuals only, all under .sra. Bars, fields, tables, pills and KPI tiles
       come from the kit (rs.css). */
    st.textContent = ""
      + ".sra .sra-h{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0 10px}"
      + ".sra .sra-h h2{font-size:15px;font-weight:800;letter-spacing:-.2px;margin:0;color:var(--ink)}"
      + ".sra .sra-h .sra-sub{font-size:12px;color:var(--faint)}"
      // the KIT COLOURS NO KPI TONE (portal-design-system): namespaced copies, leak nowhere
      + ".sra .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".sra .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".sra .rs-kpis .kpi.warn .v{color:var(--warn)}"
      // the comparison arrow inside a KPI value
      + ".sra .sra-d{display:inline-block;margin-left:8px;font-size:12px;font-weight:800;"
      + "letter-spacing:0;vertical-align:middle}"
      + ".sra .sra-d.up{color:var(--pos)}.sra .sra-d.dn{color:var(--neg)}.sra .sra-d.eq{color:var(--faint)}"
      + ".sra .sra-side .rs-kpis{margin-bottom:10px}"
      // four tiles in HALF a page: 2 x 2, never 3 + an orphan; 4 across only when there is room
      + ".sra .sra-side .rs-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}"
      + "@media(min-width:1700px){.sra .sra-side .rs-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}}"
      + ".sra .sra-side .panel-head .rs-pill{margin-left:auto}"
      // the funnel: three steps and an exit
      + ".sra .sra-fn{display:grid;gap:7px;margin:4px 0 10px}"
      + ".sra .sra-fr{display:grid;grid-template-columns:92px 1fr 150px;align-items:center;gap:10px;font-size:13px}"
      + ".sra .sra-fl{color:var(--muted);font-weight:700;line-height:1.15}"
      // 2026-09-23: the Confirmed step says which basis it is on, under its name
      + ".sra .sra-fl small{display:block;font-size:10.5px;font-weight:600;color:var(--faint)}"
      + ".sra .sra-fb{height:18px;background:var(--panel-2);border-radius:6px;overflow:hidden}"
      + ".sra .sra-fb i{display:block;height:100%;border-radius:6px}"
      + ".sra .sra-fb i.c-lead{background:var(--blue)}"
      + ".sra .sra-fb i.c-qual{background:var(--blue);opacity:1;filter:saturate(.55)}"
      + ".sra .sra-fb i.c-conf{background:var(--brand)}"
      + ".sra .sra-fv{font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}"
      + ".sra .sra-fv em{font-style:normal;font-weight:600;color:var(--faint);font-size:11.5px;margin-left:6px}"
      + ".sra .sra-exit{margin-left:102px;border-left:3px solid var(--neg);padding:6px 10px;"
      + "font-size:12.5px;color:var(--muted);line-height:1.55;background:var(--panel-2);border-radius:0 8px 8px 0}"
      + ".sra .sra-exit b{color:var(--ink)}"
      + ".sra .sra-cohort{font-size:12.5px;color:var(--muted);line-height:1.6;border-top:1px solid var(--line);padding-top:9px}"
      + ".sra .sra-cohort b{color:var(--ink)}"
      + ".sra .sra-thin{color:var(--faint)}"
      // the breakdown grid: an odd last card spans both columns instead of leaving a hole
      + ".sra .sra-grid>.panel:last-child:nth-child(odd){grid-column:1/-1}"
      // minmax(0,1fr), not the kit's bare 1fr: a chart canvas has an intrinsic width, and a
      // 1fr track grows to fit it -- the grid blew out sideways past the viewport
      + ".sra .rs-grid2{grid-template-columns:repeat(2,minmax(0,1fr))}"
      + ".sra .rs-grid2>*{min-width:0}"
      + "@media(max-width:1100px){.sra .rs-grid2{grid-template-columns:minmax(0,1fr)}}"
      + ".sra .sra-grid .rs-table td,.sra .sra-grid .rs-table th{padding:9px 11px}"
      + ".sra .sra-tot td{font-weight:800;border-top:1px solid var(--line-2)}"
      + ".sra .rs-table td.num,.sra .rs-table th.num{white-space:nowrap}"
      + ".sra .sra-rate small{color:var(--faint);font-weight:600;margin-left:5px}"
      // 2026-09-23: a small sample is said in WORDS, not only by the faint colour
      + ".sra .sra-rate .sra-ss{font-style:normal;font-weight:700;color:var(--warn);margin-left:5px;"
      + "font-size:11px;white-space:nowrap}"
      + ".sra .rs-seg.sra-off button{opacity:.45;cursor:not-allowed}"
      // the lead list
      + ".sra .sra-list .rs-tablewrap{min-height:260px}"
      /* the list sits at the BOTTOM of a long page, so RSC.fitScroller (which sizes a scroller
         by its distance from the top) would leave it 200px tall. It gets the viewport minus the
         portal header instead: scrolled into view it fills the screen, and the sticky header
         has its own scrolling ancestor to stick to. */
      + ".sra .sra-list .rs-tablewrap.rs-fit{--pg-chrome:150px}"
      + ".sra .sra-list td.wrap{white-space:normal;min-width:220px}"
      + ".sra .sra-list td a.sra-tr{white-space:nowrap}"
      + ".sra .sra-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:11px 2px 0;"
      + "font-size:12.5px;color:var(--muted)}"
      + ".sra .sra-foot .rs-btn{padding:5px 11px;font-size:12.5px}"
      + ".sra .sra-pg{display:inline-flex;align-items:center;gap:8px}"
      + ".sra .sra-pg b{font-weight:800;color:var(--ink);min-width:62px;text-align:center}"
      + ".sra .sra-cols .rs-slicer-pop{min-width:280px;left:auto;right:0}"
      + ".sra .sra-cols .sra-reset{margin-top:8px;width:100%}"
      + ".sra .sra-save{font-size:11.5px;color:var(--faint)}"
      + ".sra .sra-empty{padding:26px 14px;text-align:center;color:var(--faint);font-size:13px}"
      + "@media(max-width:700px){.sra .sra-fr{grid-template-columns:78px 1fr 110px}.sra .sra-exit{margin-left:0}}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ data ---- */
  function index(L, J, Sp) {
    var fams = new Map();
    var get = function (f) {
      var k = f || "(no source)";
      if (!fams.has(k)) fams.set(k, { leads: [], jobs: [], spend: [] });
      return fams.get(k);
    };
    var lo = "9999-12-31", hi = "", led = "", frm = "";
    L.forEach(function (r) {
      r._cd = String(r["Create Date"] || "").slice(0, 10);
      r._bd = r["Booked Date"] ? String(r["Booked Date"]).slice(0, 10) : "";
      r._st = stateKey(r.State);
      r._fam = r.Family || "(no source)";
      if (r._cd) { if (r._cd < lo) lo = r._cd; if (r._cd > hi) hi = r._cd; }
      get(r._fam).leads.push(r);
    });
    J.forEach(function (r) {
      r._d = String(r.Date || "").slice(0, 10);
      r._st = stateKey(r.State);
      get(r.Family).jobs.push(r);
    });
    Sp.forEach(function (r) {
      r._d = String(r.Date || "").slice(0, 10);
      r._sp = num(r.Spend);
      var le = String(r["Ledger End"] || "").slice(0, 10);
      if (le > led) led = le;
      var fe = String(r["Form Export Date"] || "").slice(0, 10);
      if (fe > frm) frm = fe;
      get(r.Family).spend.push(r);
    });
    DATA.byFam = fams;
    DATA.minDay = hi ? lo : null;
    DATA.maxDay = hi || null;
    DATA.ledgerEnd = led || null;
    DATA.formsDate = frm || null;
    DATA.ready = true;
  }

  function coOk(r) { return !S.co || r.Company === S.co; }
  function campOk(r) { return !S.camp || r.Campaign === S.camp; }
  function stOk(r) { return !S.states.size || S.states.has(r._st); }
  function mtOk(r) { return S.mt === "both" || r["Moving Type"] === (S.mt === "ld" ? "Long distance" : "Local"); }

  /* the reading window [a, b]; `bEff` stops at the newest lead on file so a comparison
     window is day-matched instead of charging this year for days that have not happened */
  function win() {
    var a = S.from || DATA.minDay || "2023-01-01";
    var b = S.to || today();
    var bEff = DATA.maxDay && b > DATA.maxDay ? DATA.maxDay : b;
    if (bEff < a) bEff = b;
    return { a: a, b: b, bEff: bEff, open: !S.from };
  }
  function cmpWin(w) {
    if (w.open) return null;
    if (S.cmp === "prev") {
      var n = dayCount(w.a, w.bEff);
      return { a: addDays(w.a, -n), b: addDays(w.a, -1), label: "vs previous period" };
    }
    return { a: addYears(w.a, -1), b: addYears(w.bEff, -1), label: "vs same period last year" };
  }

  function famPack() {
    var f = (DATA.byFam && DATA.byFam.get(S.fam)) || { leads: [], jobs: [], spend: [] };
    return {
      leads: f.leads.filter(function (r) { return coOk(r) && campOk(r); }),
      jobs: f.jobs.filter(function (r) { return coOk(r) && campOk(r); }),
      spend: f.spend.filter(function (r) { return coOk(r) && campOk(r); }),
    };
  }

  /* one side of the funnel for [a, b]. `rows` are the family's leads after every filter. */
  function funnel(rows, a, b) {
    var created = rows.filter(function (r) { return inR(r._cd, a, b); });
    var booked = rows.filter(function (r) { return inR(r._bd, a, b); });
    var qual = created.filter(isQual).length;
    var dead = created.length - qual;
    var reasons = {};
    created.forEach(function (r) {
      if (!isDead(r)) return;
      var k = r.Flag || "(no reason recorded)";
      reasons[k] = (reasons[k] || 0) + 1;
    });
    var billed = 0;
    created.forEach(function (r) { billed += num(r.Billed); });
    return {
      created: created, booked: booked, leads: created.length, qual: qual, dead: dead,
      conf: booked.length, br: RS.bookingRate(created, booked),
      cBooked: created.filter(function (r) { return r["Status Category"] === "Confirmed"; }).length,
      moved: created.filter(function (r) { return +r.Moved; }).length,
      open: created.filter(function (r) { return r["Status Category"] === "Incoming Lead"; }).length,
      billed: billed, reasons: reasons,
    };
  }

  /* ▲ / ▼ against the comparison window. Counts compare as a percentage, rates in points;
     `lowerIsBetter` flips the colour for costs. Always a word or arrow, never colour alone. */
  function delta(cur, prev, kind, lowerIsBetter) {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return "";
    var d, txt;
    if (kind === "pp") {
      d = (cur - prev) * 100;
      if (Math.abs(d) < 0.05) return '<span class="sra-d eq">± 0 pts</span>';
      txt = Math.abs(d).toFixed(1) + " pts";
    } else {
      if (!prev) return cur ? '<span class="sra-d eq">new</span>' : "";
      d = cur / prev - 1;
      if (Math.abs(d) < 0.0005) return '<span class="sra-d eq">± 0%</span>';
      txt = Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + "%";
    }
    // lowerIsBetter === null: a change that is neither good nor bad by itself (spending more)
    var good = lowerIsBetter ? d < 0 : d > 0;
    var cls = lowerIsBetter === null ? "eq" : (good ? "up" : "dn");
    return '<span class="sra-d ' + cls + '" title="change ' +
      (kind === "pp" ? "in percentage points" : "in percent") + '">' +
      (d > 0 ? "▲ " : "▼ ") + txt + "</span>";
  }

  function rateHtml(conf, qual) {
    var r = RS.bookingRate(new Array(qual).fill({ "Status Category": "" }),
                           new Array(conf).fill({ "Status Category": "Confirmed" }));
    // 2026-09-23 review: under THIN qualified leads the rate SAYS "small sample" -- the faint
    // colour alone broke the page's own "a word or arrow, never colour alone" rule
    var thin = qual > 0 && qual < THIN;
    return '<span class="sra-rate' + (thin ? " sra-thin" : "") + '"' +
      (thin ? ' title="small sample: ' + qual + ' qualified leads"' : "") + ">" + pct1(r) +
      "<small>" + fmtN(conf) + " / " + fmtN(qual) + "</small>"
      + (thin ? '<em class="sra-ss">small sample</em>' : "") + "</span>";
  }

  /* group created + booked rows by a dimension. `kc` keys a created row, `kb` a booked row
     (they differ only for Month, where a booking belongs to the month it was BOOKED). */
  function groupBy(created, booked, kc, kb) {
    var g = {};
    var at = function (k) {
      return g[k] || (g[k] = { k: k, leads: 0, qual: 0, dead: 0, conf: 0, cBooked: 0, moved: 0,
                                billed: 0, qSum: 0, qN: 0 });
    };
    created.forEach(function (r) {
      var o = at(kc(r));
      o.leads++;
      if (isQual(r)) o.qual++; else o.dead++;
      if (r["Status Category"] === "Confirmed") o.cBooked++;
      if (+r.Moved) o.moved++;
      o.billed += num(r.Billed);
      var q = num(r.Quote);
      if (q > 0) { o.qSum += q; o.qN++; }
    });
    booked.forEach(function (r) { at(kb(r)).conf++; });
    return g;
  }

  /* ------------------------------------------------------------------ render ---- */
  async function render(host) {
    injectStyle();
    if (!DATA.ready) {
      host.innerHTML = '<div class="rs-loading">Reading every lead, job and ad dollar by source…'
        + '<div class="bar"><i></i></div></div>';
      try {
        var got = await Promise.all([RS.load("src_lead"), RS.load("src_job"), RS.load("src_spend")]);
        index(got[0] || [], got[1] || [], got[2] || []);
      } catch (e) {
        host.innerHTML = '<div class="panel"><div class="panel-head"><span class="panel-title">'
          + 'Source Analysis could not load</span></div><div class="rs-hint">' + esc(e.message)
          + (/404|unknown dataset/i.test(String(e.message))
              ? " — the Source Analysis marts have not been built yet; they arrive with the next "
                + "pipeline run (or a <b>source-analysis</b> fast-path rebuild)." : "")
          + "</div></div>";
        return;
      }
      if (!host.isConnected) return;
    }
    boot();
    if (!PREF.loaded && !PREF.loading) loadPrefs(host);
    paint(host);
  }

  /* first render only: family from the link, else the reader's last pick, else the biggest */
  function boot() {
    if (S.bootDone) return;
    S.bootDone = true;
    var y = new Date().getFullYear();
    S.from = y + "-01-01"; S.to = today();
    var m = /[#&]src=([^&]+)/.exec(location.hash || "");
    var want = null;
    if (m) { try { want = decodeURIComponent(m[1]); } catch (e) { want = null; } }
    if (!want) want = lsGet("sraFam");
    // Company is NOT remembered: it opens on Zip to Zip every time (his default), so nobody
    // lands on a Tuji view left over from last week without noticing
    if (want && DATA.byFam.has(want)) S.fam = want;
    var mc = /[#&]camp=([^&]+)/.exec(location.hash || "");
    if (mc && S.fam === "Post Card") { try { S.camp = decodeURIComponent(mc[1]); } catch (e) { S.camp = ""; } }
    if (!S.fam) {
      var best = null, n = -1;
      DATA.byFam.forEach(function (v, k) {
        var c = v.leads.filter(function (r) { return coOk(r) && r._cd >= S.from; }).length;
        if (c > n) { n = c; best = k; }
      });
      S.fam = best;
    }
  }

  function setHash() {
    // the link is shareable: source and post-card campaign ride in the hash
    try {
      history.replaceState(null, "", "#page=source-report&src=" + encodeURIComponent(S.fam || "")
        + (S.camp ? "&camp=" + encodeURIComponent(S.camp) : ""));
    }
    catch (e) {}
    lsSet("sraFam", S.fam || "");
  }

  function destroyCharts(host) {
    host.querySelectorAll("canvas").forEach(function (c) {
      var ch = window.Chart && Chart.getChart ? Chart.getChart(c) : null;
      if (ch) ch.destroy();
    });
  }

  function paint(host) {
    destroyCharts(host);
    setHash();
    var w = win();
    var cw = cmpWin(w);
    var pack = famPack();
    var leadsSt = pack.leads.filter(stOk);
    var isPC = S.fam === "Post Card";

    host.innerHTML = '<div class="sra">'
      + '<div class="rs-page-head"><h1>Source Analysis</h1>'
      + "<p>One source, all of it: the leads it sent, how many booked, what they were worth and "
      + "what the source cost.</p></div>"
      + '<div class="rs-bar" id="sraBar">'
      + '<div id="sraFam"></div>'
      + (isPC ? '<div id="sraCamp"></div>' : "")
      + '<div id="sraCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="sraDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="sraCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + '<div id="sraSt"></div>'
      + "</div>"
      + formsStaleHtml()
      + '<div class="rs-hint" id="sraLead"></div>'
      + '<div class="rs-grid2" id="sraSides"></div>'
      + '<div class="sra-h"><h2>Breakdowns</h2>'
      + '<div class="rs-seg" id="sraMt"><button type="button" data-v="local">Local</button>'
      + '<button type="button" data-v="ld">Long distance</button>'
      + '<button type="button" data-v="both">Both</button></div>'
      + '<span class="sra-sub">leads by create date · confirmed by booked date · the switch also '
      + "drives the Analyze-by table and the lead list</span></div>"
      + '<div class="rs-grid2 sra-grid" id="sraCharts"></div>'
      + '<div class="sra-h"><h2>Spend and return</h2><span id="sraSpendPills"></span></div>'
      + '<div id="sraSpend"></div>'
      + '<div class="sra-h"><h2>Analyze by</h2><div id="sraBy"></div></div>'
      + '<div class="panel" id="sraPivot"></div>'
      + '<div class="sra-h"><h2>Leads</h2><span class="sra-sub">every lead created in the period '
      + "that passes the filters above, newest first</span></div>"
      + '<div class="panel sra-list" id="sraList"></div>'
      + "</div>";

    mountBar(host, w);
    paintLead(host, w, cw, pack, leadsSt);
    paintSides(host, w, cw, leadsSt);
    paintCharts(host, w, leadsSt);
    paintSpend(host, w, cw, pack);
    paintPivot(host, w, leadsSt);
    paintList(host, w, leadsSt);
  }

  /* ---- the control bar ---- */
  function mountBar(host, w) {
    // families ranked by leads in the period for the chosen company; paid ones first
    var rows = [];
    DATA.byFam.forEach(function (v, k) {
      var n = 0;
      v.leads.forEach(function (r) { if (coOk(r) && inR(r._cd, w.a, w.b)) n++; });
      var paid = v.spend.some(coOk);
      // every family the company ever had leads, jobs or spend for -- a source quiet in this
      // period is still pickable (it reads zero here rather than vanishing from the list)
      var any = n || v.leads.some(coOk) || v.jobs.some(coOk) || paid;
      if (any || k === S.fam) rows.push({ v: k, l: k, n: n, paid: paid });
    });
    rows.sort(function (a, b) { return b.n - a.n || a.l.localeCompare(b.l); });
    var paid = rows.filter(function (r) { return r.paid; });
    var free = rows.filter(function (r) { return !r.paid; });
    var vals = [];
    if (paid.length) vals = vals.concat([{ div: "Ad spend on file" }], paid);
    if (free.length) vals = vals.concat([{ div: "No ad spend on file" }], free);
    RSC.localSelect(host.querySelector("#sraFam"), {
      label: "Source", values: vals.map(function (r) { return r.div ? r : { v: r.v, l: r.l, n: r.n }; }),
      value: S.fam || "", required: true,
      onChange: function (v) { S.fam = v; S.camp = ""; S.list.page = 0; paint(host); },
    });
    var campHost = host.querySelector("#sraCamp");
    if (campHost) {
      var cc = {};
      var f = DATA.byFam.get("Post Card") || { leads: [] };
      f.leads.forEach(function (r) { if (coOk(r) && inR(r._cd, w.a, w.b)) cc[r.Campaign] = (cc[r.Campaign] || 0) + 1; });
      (f.spend || []).forEach(function (r) { if (coOk(r) && !(r.Campaign in cc)) cc[r.Campaign] = 0; });
      // the active pick always stays listed, or the button would read "All post cards" over a
      // filter that is still on (a campaign from a shared link the company never ran)
      if (S.camp && !(S.camp in cc)) cc[S.camp] = 0;
      RSC.localSelect(campHost, {
        label: "Campaign", allLabel: "All post cards",
        values: Object.keys(cc).filter(Boolean).sort().map(function (k) { return { v: k, l: k, n: cc[k] }; }),
        value: S.camp,
        onChange: function (v) { S.camp = v; S.list.page = 0; paint(host); },
      });
    }
    RSC.localSelect(host.querySelector("#sraCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: S.co,
      onChange: function (v) { S.co = v; S.list.page = 0; paint(host); },
    });
    RSC.dateRange(host.querySelector("#sraDate"), {
      get: function () { return { from: S.from, to: S.to }; },
      set: function (f, t) { S.from = f; S.to = t; },
      onChange: function () { S.list.page = 0; paint(host); },
    });
    var cmp = host.querySelector("#sraCmp");
    // All time has nothing before it to compare with (cmpWin -> null): the switch is shown
    // disabled with the reason, not left clickable and doing nothing (2026-09-23 review)
    cmp.classList.toggle("sra-off", !!w.open);
    if (w.open) cmp.title = "no comparison for All time -- pick a period to compare";
    cmp.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", !w.open && b.dataset.v === S.cmp);
      b.disabled = !!w.open;
      b.onclick = function () { S.cmp = b.dataset.v; paint(host); };
    });
    var stc = {};
    famPack().leads.forEach(function (r) { if (inR(r._cd, w.a, w.b)) stc[r._st] = (stc[r._st] || 0) + 1; });
    RSC.localMulti(host.querySelector("#sraSt"), {
      label: "Pickup state", emptyLabel: "All states",
      values: SERVICE_STATES.concat([OTHER_ST]).map(function (k) { return { v: k, l: k, n: stc[k] || 0 }; }),
      selected: S.states,
      onChange: function (set) { S.states = new Set(set); S.list.page = 0; paint(host); },
    });
    var mt = host.querySelector("#sraMt");
    mt.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.v === S.mt);
      b.onclick = function () { S.mt = b.dataset.v; S.list.page = 0; paint(host); };
    });
  }

  /* ---- the website-form export's age (2026-09-24). The UTM tags that tell Google from Google
     Local (a Business Profile click) and find the ChatGPT leads arrive ONLY with the CMS export
     (cms_leads). It was loaded once, on 2026-09-03; from the week of 7 Sep no lead carried a tag
     and Google Local read 30 in September against 309 in August -- a gap that looks like a
     collapse and is only a missing file. One line, whatever source is picked, once the export is
     10+ days old. ---- */
  function formsStaleHtml() {
    var d = DATA.formsDate;
    if (!d) return "";
    var age = dayCount(d, today()) - 1;
    if (age < FORMS_STALE_DAYS) return "";
    return '<div class="rs-hint" id="sraForms"><span class="rs-pill warn">Tags ' + fmtN(age) + " days old</span> "
      + "Website-form tags last loaded <b>" + esc(niceDay(d)) + "</b> — Google vs Google Local and ChatGPT splits "
      + "after that date are incomplete.</div>";
  }

  /* ---- the sentence under the bar: what is being read, and the traps it avoids ---- */
  function paintLead(host, w, cw, pack, leadsSt) {
    var el = host.querySelector("#sraLead");
    var labels = {};
    pack.leads.forEach(function (r) { if (inR(r._cd, w.a, w.b) && r.Source) labels[r.Source] = 1; });
    var lab = Object.keys(labels).sort();
    var through = DATA.maxDay ? " Leads on file through <b>" + esc(niceDay(DATA.maxDay)) + "</b>." : "";
    el.innerHTML = "<b>" + esc(S.fam || "—") + "</b>" + (S.camp ? " · " + esc(S.camp) : "")
      + " · " + (S.co ? esc(S.co) : "both companies") + " · "
      + (w.open ? "all time" : esc(niceDay(w.a)) + " – " + esc(niceDay(w.b)))
      + (cw ? " · compared " + esc(cw.label.replace(/^vs /, "with the ")) + " (" + esc(niceDay(cw.a))
              + " – " + esc(niceDay(cw.b)) + ")" : "")
      + "." + through
      + (lab.length > 1 ? " Labels pooled into this source: " + lab.map(esc).join(", ") + "." : "")
      + (S.states.size ? " Pickup state filter: <b>" + esc(Array.from(S.states).join(", ")) + "</b>." : "")
      + ' Every lead links to <a href="#page=source-trace">Source Trace</a> for why it counts as this source.';
  }

  /* ---- Local | Long distance, side by side ---- */
  function paintSides(host, w, cw, leadsSt) {
    var wrap = host.querySelector("#sraSides");
    var all = funnel(leadsSt, w.a, w.b);
    wrap.innerHTML = SIDES.map(function (s, i) {
      return '<div class="panel sra-side"><div class="panel-head"><span class="panel-title">'
        + esc(s[1]) + '</span><span class="rs-pill mute" data-share="' + i + '"></span></div>'
        + '<div class="rs-kpis" data-k="' + i + '"></div><div data-f="' + i + '"></div></div>';
    }).join("");
    SIDES.forEach(function (s, i) {
      var rows = leadsSt.filter(function (r) { return r["Moving Type"] === s[0]; });
      var f = funnel(rows, w.a, w.b);
      var p = cw ? funnel(rows, cw.a, cw.b) : null;
      var share = all.leads ? f.leads / all.leads : null;
      wrap.querySelector('[data-share="' + i + '"]').textContent =
        share == null ? "no leads" : pct1(share).replace(".0%", "%") + " of leads";
      var sub = function (v, fmt) { return p ? (cw.label.replace("vs ", "") + ": " + fmt(v)) : ""; };
      RSC.kpis(wrap.querySelector('[data-k="' + i + '"]'), [
        { label: "Leads", value: fmtN(f.leads) + (p ? delta(f.leads, p.leads, "pct") : ""),
          sub: sub(p && p.leads, fmtN) || "created in the period" },
        { label: "Qualified", value: fmtN(f.qual) + (p ? delta(f.qual, p.qual, "pct") : ""),
          sub: sub(p && p.qual, fmtN) || "not dead" },
        { label: "Confirmed", value: fmtN(f.conf) + (p ? delta(f.conf, p.conf, "pct") : ""),
          sub: sub(p && p.conf, fmtN) || "booked in the period" },
        // 2026-09-23: a small sample says so in words, and its ▲/▼ is drawn muted (either side
        // under THIN) -- 2 of 15 vs 2 of 6 is not a 20-point fall anybody should act on
        { label: "Booking rate",
          value: pct1(f.br) + (p ? delta(f.br, p.br, "pp",
                                         thinAny(f.qual, p.qual) ? null : undefined) : ""),
          sub: (f.qual && f.qual < THIN ? "small sample · " : "")
               + fmtN(f.conf) + " confirmed / " + fmtN(f.qual) + " qualified"
               + (p ? " · " + cw.label.replace("vs ", "") + ": " + pct1(p.br)
                    + (p.qual && p.qual < THIN ? " (small sample)" : "") : ""),
          tone: f.qual && f.qual < THIN ? "warn" : "" },
      ]);
      wrap.querySelector('[data-f="' + i + '"]').innerHTML = funnelHtml(f);
    });
  }

  function thinAny(a, b) { return (a > 0 && a < THIN) || (b > 0 && b < THIN); }

  function funnelHtml(f) {
    if (!f.leads && !f.conf) return '<div class="sra-empty">No leads in this period.</div>';
    var base = Math.max(f.leads, 1);
    var bar = function (n, cls) {
      return '<span class="sra-fb"><i class="' + cls + '" style="width:'
        + Math.max(n ? 1.5 : 0, Math.min(100, 100 * n / base)).toFixed(1) + '%"></i></span>';
    };
    var top = Object.keys(f.reasons).map(function (k) { return [k, f.reasons[k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var shown = top.slice(0, 4);
    var rest = top.slice(4).reduce(function (a, x) { return a + x[1]; }, 0);
    return '<div class="sra-fn">'
      + '<div class="sra-fr"><span class="sra-fl">Leads</span>' + bar(f.leads, "c-lead")
      + '<span class="sra-fv">' + fmtN(f.leads) + "</span></div>"
      + '<div class="sra-fr"><span class="sra-fl">Qualified</span>' + bar(f.qual, "c-qual")
      + '<span class="sra-fv">' + fmtN(f.qual) + "<em>" + (f.leads ? pct1(f.qual / f.leads) : "—")
      + " of leads</em></span></div>"
      // 2026-09-23 review: bookings MADE in the period (some from earlier leads), so in a
      // short window it can pass Qualified; the label says so instead of passing as a subset
      + '<div class="sra-fr" title="bookings made in the period, including leads created before it'
      + (f.conf > f.leads ? " -- more than the period's own leads, so the bar is full" : "")
      + '"><span class="sra-fl">Confirmed<small>booked in period</small></span>' + bar(f.conf, "c-conf")
      + '<span class="sra-fv">' + fmtN(f.conf) + "<em>" + rateHtml(f.conf, f.qual) + "</em></span></div>"
      + (f.dead
          // the lead's CURRENT status -- often set after a quote ("price exceeded their budget"),
          // so not "left before qualifying" (2026-09-23 review)
          ? '<div class="sra-exit"><b>Dead · ' + fmtN(f.dead) + "</b> (" + pct1(f.dead / base)
            + " of leads), by reason: "
            + shown.map(function (x) { return esc(x[0]) + " <b>" + fmtN(x[1]) + "</b>"; }).join(" · ")
            + (rest ? " · other reasons <b>" + fmtN(rest) + "</b>" : "") + "</div>"
          : "")
      + "</div>"
      + '<div class="sra-cohort">Of the <b>' + fmtN(f.leads) + "</b> leads created in the period: <b>"
      + fmtN(f.cBooked) + "</b> booked · <b>" + fmtN(f.moved) + "</b> moved · <b>" + money0(f.billed)
      + "</b> billed · <b>" + fmtN(f.open) + "</b> still open. "
      + '<span class="sra-thin">Confirmed above counts bookings MADE in the period (some from '
      + "earlier leads); this line follows the period's own leads.</span></div>";
  }

  /* ---- the four breakdowns + why leads die ---- */
  function monthsOf(a, b) {
    var out = [], d = a.slice(0, 7), end = b.slice(0, 7), guard = 0;
    while (d <= end && guard++ < 200) {
      out.push(d);
      var y = +d.slice(0, 4), m = +d.slice(5, 7) + 1;
      if (m > 12) { m = 1; y++; }
      d = y + "-" + String(m).padStart(2, "0");
    }
    return out;
  }

  function dims() {
    return {
      month: { label: "Month", kc: function (r) { return r._cd.slice(0, 7); },
               kb: function (r) { return r._bd.slice(0, 7); }, fmt: monthLbl, ordered: true },
      state: { label: "Pickup state", kc: function (r) { return r._st; }, kb: function (r) { return r._st; },
               order: SERVICE_STATES.concat([OTHER_ST]) },
      cf: { label: "Volume band (cu ft)", kc: function (r) { return r["CF Range"] || "(no volume)"; },
            kb: function (r) { return r["CF Range"] || "(no volume)"; }, order: CF_ORDER },
      quote: { label: "Quote band", kc: function (r) { return r["Quote Band"] || "Not quoted"; },
               kb: function (r) { return r["Quote Band"] || "Not quoted"; }, order: QB_ORDER },
      size: { label: "Size of move", kc: function (r) { return r["Size of Move"] || "(not stated)"; },
              kb: function (r) { return r["Size of Move"] || "(not stated)"; } },
      service: { label: "Service type", kc: function (r) { return r["Service Type"] || "(not stated)"; },
                 kb: function (r) { return r["Service Type"] || "(not stated)"; } },
      rep: { label: "Sales rep", kc: function (r) { return r.Rep || "(unassigned)"; },
             kb: function (r) { return r.Rep || "(unassigned)"; } },
      status: { label: "Lead status", kc: function (r) { return r.Status || "(none)"; },
                kb: function (r) { return r.Status || "(none)"; } },
      flag: { label: "Rep disposition (Flag)", kc: function (r) { return r.Flag || "(no reason recorded)"; },
              kb: function (r) { return r.Flag || "(no reason recorded)"; } },
      label: { label: "Source label", kc: function (r) { return r.Source || "(none)"; },
               kb: function (r) { return r.Source || "(none)"; } },
      campaign: { label: "Post-card campaign", onlyPC: true,
                  kc: function (r) { return r.Campaign || "(none)"; }, kb: function (r) { return r.Campaign || "(none)"; } },
      company: { label: "Company", onlyAllCo: true, kc: function (r) { return r.Company; },
                 kb: function (r) { return r.Company; } },
    };
  }

  function ordered(g, dim, w) {
    var keys = Object.keys(g);
    if (dim.ordered) {
      var ms = monthsOf(w.a, w.bEff);
      keys.forEach(function (k) { if (ms.indexOf(k) < 0 && k) ms.push(k); });
      return ms.filter(function (k) { return k >= w.a.slice(0, 7) && k <= w.bEff.slice(0, 7); }).sort();
    }
    if (dim.order) {
      return dim.order.filter(function (k) { return g[k]; })
        .concat(keys.filter(function (k) { return dim.order.indexOf(k) < 0; }));
    }
    return keys.sort(function (a, b) { return g[b].leads - g[a].leads || g[b].conf - g[a].conf; });
  }

  function sliceMt(rows) { return rows.filter(mtOk); }

  function paintCharts(host, w, leadsSt) {
    var grid = host.querySelector("#sraCharts");
    var rows = sliceMt(leadsSt);
    var created = rows.filter(function (r) { return inR(r._cd, w.a, w.bEff); });
    var booked = rows.filter(function (r) { return inR(r._bd, w.a, w.bEff); });
    var D = dims();
    var mtName = S.mt === "both" ? "" : (S.mt === "ld" ? " · long distance" : " · local");
    [["month", "By month"], ["state", "By pickup state"], ["cf", "By volume band (cu ft)"],
     ["quote", "By quote band"]].forEach(function (spec) {
      var dim = D[spec[0]];
      var g = groupBy(created, booked, dim.kc, dim.kb);
      var keys = ordered(g, dim, w);
      if (spec[0] === "month" && keys.length > 48) keys = keys.slice(-48);
      var empty = { leads: 0, qual: 0, dead: 0, conf: 0 };
      var get = function (k) { return g[k] || empty; };
      RSC.chartCard(grid, {
        title: spec[1] + mtName, key: "sra-" + spec[0],
        buildChart: function (canvas) {
          return barRate(canvas, keys.map(dim.fmt || String), keys.map(function (k) { return get(k).qual; }),
            keys.map(function (k) { return get(k).conf; }), !!dim.ordered);
        },
        buildTable: function () { return dimTable(keys, g, dim, false); },
      });
    });
    // why leads die: the Flag on dead leads created in the period
    var dead = created.filter(isDead);
    var rc = {};
    dead.forEach(function (r) { var k = r.Flag || "(no reason recorded)"; rc[k] = (rc[k] || 0) + 1; });
    var rk = Object.keys(rc).sort(function (a, b) { return rc[b] - rc[a]; });
    var topK = rk.slice(0, 12);
    var restN = rk.slice(12).reduce(function (a, k) { return a + rc[k]; }, 0);
    if (restN) { topK.push("All other reasons"); rc["All other reasons"] = restN; }
    RSC.chartCard(grid, {
      title: "Why leads die" + mtName + " · " + fmtN(dead.length) + " dead of " + fmtN(created.length),
      key: "sra-dead",
      buildChart: function (canvas) {
        var C = palette();
        return new Chart(canvas, {
          type: "bar",
          data: { labels: topK, datasets: [{ label: "Dead leads", data: topK.map(function (k) { return rc[k]; }),
                                             backgroundColor: C.faint }] },
          options: { indexAxis: "y", responsive: true, maintainAspectRatio: false,
                     plugins: { legend: { display: false },
                                tooltip: { callbacks: { label: function (ctx) {
                                  return fmtN(ctx.raw) + " dead leads · " + pct1(ctx.raw / Math.max(dead.length, 1)) + " of dead";
                                } } } },
                     scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
        });
      },
      buildTable: function () {
        if (!rk.length) return '<div class="sra-empty">No dead leads in this period.</div>';
        return '<table class="rs-table"><thead><tr><th>Reason (rep disposition)</th>'
          + '<th class="num">Dead leads</th><th class="num">Share of dead</th></tr></thead><tbody>'
          + rk.map(function (k) {
              return "<tr><td>" + esc(k) + '</td><td class="num">' + fmtN(rc[k]) + '</td><td class="num">'
                + pct1(rc[k] / Math.max(dead.length, 1)) + "</td></tr>";
            }).join("") + "</tbody></table>";
      },
    });
  }

  /* `timeline`: months get a rate LINE; states and bands get rate MARKERS only -- a line
     drawn from New Jersey to Pennsylvania would claim a trend between unrelated categories */
  function barRate(canvas, labels, qual, conf, timeline) {
    var C = palette();
    var rate = qual.map(function (q, i) {
      var r = RS.bookingRate(new Array(q).fill({ "Status Category": "" }),
                             new Array(conf[i]).fill({ "Status Category": "Confirmed" }));
      return r == null ? null : +(100 * r).toFixed(1);
    });
    return new Chart(canvas, {
      type: "bar",
      data: { labels: labels, datasets: [
        { label: "Qualified leads", data: qual, backgroundColor: C.blue, yAxisID: "y", order: 2 },
        { label: "Confirmed (booked)", data: conf, backgroundColor: C.brand, yAxisID: "y", order: 2 },
        { type: "line", label: "Booking rate", data: rate, borderColor: C.ink, backgroundColor: C.ink,
          // monotone (2026-09-23): tension 0.3 overshot the y1 maximum and clipped at the top
          yAxisID: "y1", order: 1, cubicInterpolationMode: "monotone", spanGaps: true, showLine: !!timeline,
          pointRadius: timeline ? 3 : 5, pointStyle: timeline ? "circle" : "rectRot" },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false },
                ticks: { callback: function (v) { return v + "%"; } } },
        },
        plugins: { tooltip: { callbacks: { label: function (ctx) {
          if (ctx.dataset.yAxisID === "y1") {
            var i = ctx.dataIndex;
            return "Booking rate " + (ctx.raw == null ? "—" : ctx.raw + "%") + "  (" + fmtN(conf[i])
              + " / " + fmtN(qual[i]) + (qual[i] < THIN ? ", small sample" : "") + ")";
          }
          return ctx.dataset.label + ": " + fmtN(ctx.raw);
        } } } },
      },
    });
  }

  /* one table for every breakdown: the counts the rate is made of stand beside it */
  function dimTable(keys, g, dim, full) {
    if (!keys.length) return '<div class="sra-empty">No leads in this period.</div>';
    var t = { leads: 0, qual: 0, dead: 0, conf: 0, cBooked: 0, moved: 0, billed: 0, qSum: 0, qN: 0 };
    var empty = { leads: 0, qual: 0, dead: 0, conf: 0, cBooked: 0, moved: 0, billed: 0, qSum: 0, qN: 0 };
    var body = keys.map(function (k) {
      var o = g[k] || empty;
      Object.keys(t).forEach(function (x) { t[x] += o[x]; });
      return rowHtml((dim.fmt || String)(k), o, full);
    }).join("");
    return '<table class="rs-table"><thead><tr><th>' + esc(dim.label) + "</th>"
      + '<th class="num">Leads</th><th class="num">Qualified</th><th class="num">Dead</th>'
      + '<th class="num">Confirmed</th><th class="num">Booking rate</th>'
      + (full ? '<th class="num" title="of the leads in this row, how many are confirmed now">Booked (cohort)</th>'
              + '<th class="num" title="a closing sheet exists for the lead">Moved</th>'
              + '<th class="num">Billed</th><th class="num">Avg quote</th>' : "")
      + "</tr></thead><tbody>" + body
      + '<tr class="sra-tot">' + rowCells("Total", t, full) + "</tr></tbody></table>";
  }
  function rowHtml(label, o, full) { return "<tr>" + rowCells(label, o, full) + "</tr>"; }
  function rowCells(label, o, full) {
    return "<td>" + esc(label) + '</td><td class="num">' + fmtN(o.leads) + '</td><td class="num">'
      + fmtN(o.qual) + '</td><td class="num">' + fmtN(o.dead)
      + (o.leads ? " <span class=\"sra-thin\">" + pct1(o.dead / o.leads) + "</span>" : "")
      + '</td><td class="num">' + fmtN(o.conf) + '</td><td class="num">' + rateHtml(o.conf, o.qual) + "</td>"
      + (full ? '<td class="num">' + fmtN(o.cBooked) + '</td><td class="num">' + fmtN(o.moved)
              + '</td><td class="num">' + money0(o.billed) + '</td><td class="num">'
              + (o.qN ? money0(o.qSum / o.qN) : "—") + "</td>" : "");
  }

  /* ---- spend and return: source-wide, both moving types, clipped to the ledger ---- */
  function paintSpend(host, w, cw, pack) {
    var el = host.querySelector("#sraSpend");
    var pills = host.querySelector("#sraSpendPills");
    var led = DATA.ledgerEnd;
    var e = led && w.bEff > led ? led : w.bEff;
    var clipped = e < w.bEff;
    var sumSpend = function (a, b) {
      var s = 0; pack.spend.forEach(function (r) { if (inR(r._d, a, b)) s += r._sp; }); return s;
    };
    var calc = function (a, b) {
      var sp = sumSpend(a, b);
      var leads = 0, conf = 0;
      pack.leads.forEach(function (r) { if (inR(r._cd, a, b)) leads++; if (inR(r._bd, a, b)) conf++; });
      var jobs = 0, cash = 0;
      pack.jobs.forEach(function (r) {
        if (!inR(r._d, a, b)) return;
        if (r["Record Source"] === "closing") jobs++;
        cash += num(r.Cash);
      });
      return { sp: sp, leads: leads, conf: conf, jobs: jobs, cash: cash,
               cpl: sp > 0 && leads ? sp / leads : null, cpb: sp > 0 && conf ? sp / conf : null,
               per: sp > 0 ? cash / sp : null };
    };
    // a period that starts after the ledger's last posting has no spend to read yet
    var unposted = e < w.a;
    var cur = unposted ? { sp: 0, leads: 0, conf: 0, jobs: 0, cash: 0, cpl: null, cpb: null, per: null }
                       : calc(w.a, e);
    var prev = null;
    if (cw && !unposted) {
      // the comparison window is clipped by the SAME number of days, so both sides cover
      // equal stretches of the ledger
      var cut = dayCount(e, w.bEff) - 1;
      prev = calc(cw.a, cut > 0 ? addDays(cw.b, -cut) : cw.b);
    }
    var everSpend = pack.spend.some(function (r) { return r._sp; });
    var noState = 0;
    if (S.fam === "Post Card" && S.camp) {
      var f = DATA.byFam.get("Post Card");
      (f ? f.spend : []).forEach(function (r) {
        if (coOk(r) && r.Campaign === "Post Card (no state)" && inR(r._d, w.a, e)) noState += r._sp;
      });
    }
    pills.innerHTML = (led ? '<span class="rs-pill info">spend through ' + esc(niceDay(led)) + "</span> " : "")
      + (S.states.size ? '<span class="rs-pill warn" title="the ledger has no state, so the state '
         + 'filter does not apply to this section">source-wide</span> ' : "")
      + (S.mt !== "both" ? '<span class="rs-pill mute" title="the ledger has no Local / long-distance '
         + 'split">both moving types</span>' : "");
    var k = unposted ? [
      // 2026-09-23 review: zeros here read as real ("$0 spend, 0 leads") next to the September
      // leads above. Nothing is posted yet, so every tile says that.
      { label: "Ad spend", value: "—", sub: "not posted yet (ledger ends " + niceDay(led) + ")" },
      { label: "Cost per lead", value: "—", sub: "not posted yet" },
      { label: "Cost per booked job", value: "—", sub: "not posted yet" },
      { label: "Cash collected", value: "—", sub: "read against spend once it is posted" },
      { label: "Cash per $1 spent", value: "—", sub: "not posted yet" },
    ] : [
      { label: "Ad spend", value: money0(cur.sp) + (prev ? delta(cur.sp, prev.sp, "pct", null) : ""),
        sub: prev ? cw.label.replace("vs ", "") + ": " + money0(prev.sp) : "advertising ledger" },
      { label: "Cost per lead", value: cur.cpl == null ? "—" : money0(cur.cpl)
          + (prev && prev.cpl != null ? delta(cur.cpl, prev.cpl, "pct", true) : ""),
        sub: fmtN(cur.leads) + " leads" + (prev && prev.cpl != null ? " · before: " + money0(prev.cpl) : "") },
      { label: "Cost per booked job", value: cur.cpb == null ? "—" : money0(cur.cpb)
          + (prev && prev.cpb != null ? delta(cur.cpb, prev.cpb, "pct", true) : ""),
        sub: fmtN(cur.conf) + " confirmed" + (prev && prev.cpb != null ? " · before: " + money0(prev.cpb) : "") },
      { label: "Cash collected", value: money0(cur.cash) + (prev ? delta(cur.cash, prev.cash, "pct") : ""),
        sub: fmtN(cur.jobs) + " jobs moved (Net Cash + Card)" },
      { label: "Cash per $1 spent", value: cur.per == null ? "—" : "$" + cur.per.toFixed(2)
          + (prev && prev.per != null ? delta(cur.per, prev.per, "pct") : ""),
        sub: prev && prev.per != null ? "before: $" + prev.per.toFixed(2) : "cash ÷ ad spend",
        tone: cur.per != null && cur.per < 1 ? "neg" : "" },
    ];
    el.innerHTML = '<div class="panel"><div class="rs-hint">'
      + (unposted ? "<b>The advertising ledger is posted only to " + esc(niceDay(led)) + "</b>, before this "
          + "period starts, so there is no spend to set against these leads yet. " : "")
      + (unposted ? "" : everSpend
          ? "Window totals " + (clipped ? "up to <b>" + esc(niceDay(e)) + "</b>, the last day the ledger is posted "
              + "— leads, bookings and jobs after it would read as free, so they are left out of these ratios"
              : "for the period") + ". "
          : "<b>No ad spend on file for " + esc(S.fam) + (S.co ? " (" + esc(S.co) + ")" : "")
            + "</b> — nothing in the advertising ledger is booked to it, so there is no cost per lead. ")
      + "Cash is Net Cash + Card Payment of the jobs whose closing source is " + esc(S.fam)
      + ", by move date — the Monthly Report's basis. Those are not exactly the leads above: a job can "
      + "carry a different source than its lead (a returning customer, a partner job)."
      + (noState ? " Post-card spend booked without a state (" + money0(noState)
          + " in the period) cannot be given to one campaign and is not in these figures." : "")
      + '</div><div class="rs-kpis" id="sraSpendK"></div></div>';
    RSC.kpis(el.querySelector("#sraSpendK"), k);
    // monthly spend vs cash -- bars only, no ratio line (a post card paid in one lump makes a
    // monthly ratio mostly zeros and one spike)
    var ms = monthsOf(w.a, w.bEff);
    if (ms.length > 48) ms = ms.slice(-48);
    var sp = {}, cash = {}, jobs = {};
    pack.spend.forEach(function (r) { if (inR(r._d, w.a, w.bEff)) { var m = r._d.slice(0, 7); sp[m] = (sp[m] || 0) + r._sp; } });
    pack.jobs.forEach(function (r) {
      if (!inR(r._d, w.a, w.bEff)) return;
      var m = r._d.slice(0, 7);
      cash[m] = (cash[m] || 0) + num(r.Cash);
      if (r["Record Source"] === "closing") jobs[m] = (jobs[m] || 0) + 1;
    });
    var ledM = led ? led.slice(0, 7) : null;
    RSC.chartCard(el, {
      title: "Ad spend and cash collected, by month", key: "sra-spend",
      buildChart: function (canvas) {
        var C = palette();
        return new Chart(canvas, {
          type: "bar",
          data: { labels: ms.map(monthLbl), datasets: [
            { label: "Ad spend (right axis)", data: ms.map(function (m) { return ledM && m > ledM ? null : Math.round(sp[m] || 0); }),
              backgroundColor: C.violet, yAxisID: "y1" },
            { label: "Cash collected (left axis)", data: ms.map(function (m) { return Math.round(cash[m] || 0); }),
              backgroundColor: C.brand, yAxisID: "y" },
          ] },
          // TWO SCALES (2026-09-23 review): cash runs 20-30x spend for the big sources, so on one
          // axis the spend bars were slivers. Spend reads off the right axis -- still bars only,
          // no ratio line (the spec's rule is about a ratio, not about a second scale).
          options: { responsive: true, maintainAspectRatio: false,
                     interaction: { mode: "index", intersect: false },
                     scales: {
                       y: { beginAtZero: true, position: "left",
                            title: { display: true, text: "Cash collected", color: C.muted },
                            ticks: { callback: function (v) { return RS.moneyC(v); } } },
                       y1: { beginAtZero: true, position: "right", grid: { drawOnChartArea: false },
                             title: { display: true, text: "Ad spend", color: C.muted },
                             ticks: { callback: function (v) { return RS.moneyC(v); } } },
                     },
                     plugins: { tooltip: { callbacks: { label: function (ctx) {
                       var nm = ctx.dataset.label.replace(/ \((left|right) axis\)$/, "");
                       if (ctx.raw == null) return nm + ": ledger not posted yet";
                       return nm + ": " + money0(ctx.raw);
                     } } } } },
        });
      },
      buildTable: function () {
        return '<table class="rs-table"><thead><tr><th>Month</th><th class="num">Ad spend</th>'
          + '<th class="num">Cash collected</th><th class="num">Jobs moved</th></tr></thead><tbody>'
          + ms.map(function (m) {
              var late = ledM && m > ledM;
              return "<tr><td>" + esc(monthLbl(m)) + "</td>"
                + (late ? '<td class="num dim">not posted</td>' : '<td class="num">' + money0(sp[m] || 0) + "</td>")
                + '<td class="num">' + money0(cash[m] || 0) + '</td><td class="num">' + fmtN(jobs[m] || 0) + "</td></tr>";
            }).join("") + "</tbody></table>";
      },
    });
  }

  /* ---- the Analyze-by pivot ---- */
  function paintPivot(host, w, leadsSt) {
    var D = dims();
    var opts = Object.keys(D).filter(function (k) {
      if (D[k].onlyPC && S.fam !== "Post Card") return false;
      if (D[k].onlyAllCo && S.co) return false;
      return true;
    });
    if (opts.indexOf(S.by) < 0) S.by = "month";
    RSC.localSelect(host.querySelector("#sraBy"), {
      label: "Rows", required: true,
      values: opts.map(function (k) { return { v: k, l: D[k].label }; }),
      value: S.by,
      onChange: function (v) { S.by = v; paintPivot(host, w, leadsSt); },
    });
    var byHost = host.querySelector("#sraBy");
    // localSelect APPENDS; a re-mount must not stack a second control beside the first
    while (byHost.children.length > 1) byHost.removeChild(byHost.firstChild);
    var dim = D[S.by];
    var rows = sliceMt(leadsSt);
    var created = rows.filter(function (r) { return inR(r._cd, w.a, w.bEff); });
    var booked = rows.filter(function (r) { return inR(r._bd, w.a, w.bEff); });
    var g = groupBy(created, booked, dim.kc, dim.kb);
    var keys = ordered(g, dim, w);
    var mtName = S.mt === "both" ? "Local and long distance" : (S.mt === "ld" ? "Long distance only" : "Local only");
    host.querySelector("#sraPivot").innerHTML = '<div class="rs-hint">' + esc(mtName)
      + ". Confirmed and Booking rate are the headline basis (bookings made in the period). The "
      + "last four columns follow the leads in each row instead: how many of them are booked now, "
      + "moved, and what they were billed.</div>"
      + '<div class="rs-tablewrap">' + dimTable(keys, g, dim, true) + "</div>";
  }

  /* ---- the lead list ---- */
  /* Column registry. `def` = shown until the reader chooses otherwise. `get(r, d)` returns
     {h: html, t: text}; `d` is the contact-detail row, which arrives separately. */
  function dash() { return { h: null, t: "" }; }
  function txt(v) { return v == null || v === "" ? dash() : { h: esc(v), t: String(v) }; }
  function need(d, f) { return d ? f(d) : { h: '<span class="sra-thin">…</span>', t: "" }; }
  var CATTONE = { "Confirmed": "ok", "Bad Lead": "mute", "Incoming Lead": "info" };
  var LCOLS = [
    // the date the lead is COUNTED on (Create Date, the portal-wide basis); the New York
    // timestamp can fall on the neighbouring day, so it rides in the tooltip, not the cell
    { k: "created", label: "Created", def: true, cls: "nowrap", get: function (r, d) {
        var t = d && d["Created NY"] ? String(d["Created NY"]).slice(0, 16) : "";
        return { h: t ? '<span title="created ' + esc(t) + ' New York time">' + esc(r._cd) + "</span>" : esc(r._cd),
                 t: r._cd }; } },
    { k: "customer", label: "Customer", def: true, get: function (r, d) { return need(d, function (x) { return txt(x.Customer); }); } },
    // contact columns sit next to the customer when switched on (offered, not default)
    { k: "req", label: "Request #", cls: "nowrap", get: function (r) {
        var jk = String(r["Request Joinkey"] || ""); var n = jk.split(" ").pop();
        return n ? { h: "#" + esc(n), t: n } : dash(); } },
    { k: "phone", label: "Phone", cls: "nowrap", get: function (r, d) { return need(d, function (x) { return txt(x.Phone); }); } },
    { k: "email", label: "Email", cls: "nowrap", get: function (r, d) { return need(d, function (x) { return txt(x.Email); }); } },
    { k: "status", label: "Status", def: true, cls: "nowrap", get: function (r) {
        var c = r["Status Category"] || "";
        var s = r.Status || c || "—";
        return { h: '<span class="rs-pill ' + (CATTONE[c] || "mute") + '">' + esc(c === "Bad Lead" ? "Dead · " + s : s) + "</span>",
                 t: (c === "Bad Lead" ? "Dead · " : "") + s }; } },
    { k: "service", label: "Service type", def: true, cls: "nowrap", get: function (r) { return txt(r["Service Type"]); } },
    { k: "route", label: "Pickup → drop-off", def: true, cls: "wrap", get: function (r, d) {
        return need(d, function (x) {
          if (!x["Moving From"] && !x["Moving To"]) return dash();
          var s = (x["Moving From"] || "?") + " → " + (x["Moving To"] || "?");
          return { h: esc(s), t: s }; }); } },
    { k: "move", label: "Move date", def: true, cls: "nowrap", get: function (r, d) {
        return need(d, function (x) { return txt(x["Move Date"] ? String(x["Move Date"]).slice(0, 10) : null); }); } },
    { k: "cf", label: "CF", def: true, num: true, get: function (r) { return r.CF == null ? dash() : { h: fmtN(num(r.CF)), t: String(r.CF) }; } },
    { k: "quote", label: "Quote", def: true, num: true, get: function (r) {
        return num(r.Quote) > 0 ? { h: money0(num(r.Quote)), t: String(Math.round(num(r.Quote))) }
                                : { h: '<span class="sra-thin">not quoted</span>', t: "not quoted" }; } },
    { k: "rep", label: "Rep", def: true, cls: "nowrap", get: function (r) { return txt(r.Rep); } },
    { k: "reason", label: "Reason (Flag)", def: true, get: function (r) { return txt(r.Flag); } },
    // offered through "Add columns"
    { k: "size", label: "Size of move", cls: "nowrap", get: function (r) { return txt(r["Size of Move"]); } },
    { k: "booked", label: "Booked date", cls: "nowrap", get: function (r) { return txt(r._bd || null); } },
    { k: "qrange", label: "Quote range", cls: "nowrap", num: true, get: function (r, d) {
        return need(d, function (x) {
          if (!(num(x["Max Quote"]) > 0)) return dash();
          var s = money0(num(x["Min Quote"])) + " – " + money0(num(x["Max Quote"]));
          return { h: esc(s), t: s }; }); } },
    { k: "qband", label: "Quote band", cls: "nowrap", get: function (r) { return txt(r["Quote Band"]); } },
    { k: "cfband", label: "Volume band", cls: "nowrap", get: function (r) { return txt(r["CF Range"]); } },
    { k: "source", label: "Source label", cls: "nowrap", get: function (r) { return txt(r.Source); } },
    { k: "campaign", label: "Post-card campaign", cls: "nowrap", get: function (r) { return txt(r.Campaign); } },
    { k: "state", label: "Pickup state", cls: "nowrap", get: function (r) { return txt(r.State); } },
    { k: "company", label: "Company", cls: "nowrap", get: function (r) { return txt(r.Company); } },
    { k: "moved", label: "Moved", cls: "nowrap", get: function (r) { return +r.Moved ? { h: "Yes", t: "Yes" } : { h: "No", t: "No" }; } },
    { k: "billed", label: "Billed", num: true, get: function (r) {
        return r.Billed == null ? dash() : { h: money0(num(r.Billed)), t: String(num(r.Billed)) }; } },
    { k: "closing", label: "Closing", cls: "nowrap", get: function (r, d) {
        return need(d, function (x) {
          if (!x["Closing Key"]) return dash();
          var s = String(x["Closing Key"]) + (x["First Job Date"] ? " · " + String(x["First Job Date"]).slice(0, 10) : "")
            + (+x.Jobs > 1 ? " · " + x.Jobs + " closings" : "");
          // the job-side trace (Source Trace's closing mode, keyed on the closing's Unique Key)
          return { h: '<a href="#page=source-trace&job=' + encodeURIComponent(String(x["Closing Key"]))
                      + '" title="open this closing in Source Trace">' + esc(s) + "</a>", t: s }; }); } },
    { k: "utm", label: "UTM campaign", cls: "nowrap", get: function (r, d) {
        return need(d, function (x) {
          var s = [x["UTM Source"], x["UTM Campaign"]].filter(Boolean).join(" / ");
          return s ? { h: esc(s), t: s } : dash(); }); } },
    { k: "qr", label: "Via QR", cls: "nowrap", get: function (r, d) {
        return need(d, function (x) { return +x["Via QR"] ? { h: "Yes", t: "Yes" } : { h: "No", t: "No" }; }); } },
  ];
  var DEF_COLS = LCOLS.filter(function (c) { return c.def; }).map(function (c) { return c.k; });

  function activeCols() {
    var want = S.cols && S.cols.length ? S.cols : DEF_COLS;
    return LCOLS.filter(function (c) { return want.indexOf(c.k) >= 0; });
  }

  /* the reader's column choice lives in THEIR account (user_pref via /api/_pref) -- read back
     from the same table it is written to, never from a cache */
  function loadPrefs(host) {
    PREF.loading = true;
    ZTZ.api("/api/_pref?key=" + encodeURIComponent(PREF_KEY)).then(function (j) {
      var v = j && j.value;
      if (v && Array.isArray(v.cols)) {
        var ok = v.cols.filter(function (k) { return LCOLS.some(function (c) { return c.k === k; }); });
        if (ok.length) S.cols = ok;
      }
      PREF.saved = !!(j && j.stored);
    }).catch(function () {
      PREF.note = "Your saved columns could not be read — showing the defaults.";
    }).then(function () {
      PREF.loaded = true; PREF.loading = false;
      var list = host.querySelector("#sraList");
      if (list && host.isConnected) paintList(host, win(), famPack().leads.filter(stOk));
    });
  }

  function savePrefs(host) {
    clearTimeout(saveTimer);
    PREF.note = "Saving…";
    var sv = host.querySelector(".sra-save");
    if (sv) sv.textContent = PREF.note;
    saveTimer = setTimeout(function () {
      var value = S.cols ? { v: 1, cols: S.cols } : null;
      fetch(ZTZ.API + "/api/_pref", {
        method: "POST",
        headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
        body: JSON.stringify({ key: PREF_KEY, value: value }),
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok || j.error) {
            if (j && j.code === "view_as_readonly") throw new Error("preview mode — columns are not saved while viewing as someone else");
            throw new Error(j.error || ("HTTP " + r.status));
          }
          PREF.note = "Saved to your account.";
        });
      }).catch(function (e) {
        PREF.note = "Not saved: " + e.message;
      }).then(function () {
        var el = host.querySelector(".sra-save");
        if (el) el.textContent = PREF.note;
      });
    }, 500);
  }

  function detailKey(w) { return [S.fam, S.co, w.a, w.bEff].join("|"); }

  function fetchDetail(host, w) {
    var key = detailKey(w);
    if (DETAIL[key]) return DETAIL[key];
    var q = "/api/_srclead?family=" + encodeURIComponent(S.fam || "")
      + "&company=" + encodeURIComponent(S.co || "")
      + "&from=" + encodeURIComponent(w.a) + "&to=" + encodeURIComponent(w.bEff);
    // names and phone numbers stay in memory for the few slices recently read, not forever
    var ks = Object.keys(DETAIL);
    if (ks.length >= 4) delete DETAIL[ks[0]];
    DETAIL[key] = { loading: true };
    ZTZ.api(q).then(function (j) {
      var map = {};
      (j.rows || []).forEach(function (r) { map[r["Request Joinkey"]] = r; });
      DETAIL[key] = { rows: map, capped: !!j.capped };
    }).catch(function (e) {
      DETAIL[key] = { rows: null, error: /mart_missing|not built/.test(String(e.message))
        ? "The contact columns arrive once the Source Analysis marts are built." : String(e.message) };
    }).then(function () {
      if (host.isConnected && detailKey(win()) === key) paintList(host, win(), famPack().leads.filter(stOk));
    });
    return DETAIL[key];
  }

  function listRows(w, leadsSt) {
    var rows = sliceMt(leadsSt).filter(function (r) { return inR(r._cd, w.a, w.bEff); });
    if (S.list.cat) rows = rows.filter(function (r) { return r["Status Category"] === S.list.cat; });
    // newest first: by the counted date, then the Moveboard number (numeric -- "99999" must not
    // sort above "114516" as a string would)
    var no = function (r) { return +String(r["Request Joinkey"] || "").split(" ").pop() || 0; };
    return rows.sort(function (a, b) { return b._cd.localeCompare(a._cd) || no(b) - no(a); });
  }

  function paintList(host, w, leadsSt) {
    var el = host.querySelector("#sraList");
    if (!el) return;
    var det = fetchDetail(host, w);
    var dmap = det && det.rows;
    var all = listRows(w, leadsSt);
    var q = S.list.q.trim().toLowerCase();
    var qd = q.replace(/[^0-9]/g, "");
    var rows = !q ? all : all.filter(function (r) {
      var d = dmap && dmap[r["Request Joinkey"]];
      var hay = [r["Request Joinkey"], r.Rep, r.Flag, r.Status, d && d.Customer, d && d.Email,
                 d && d["Moving From"], d && d["Moving To"]].join(" ").toLowerCase();
      if (hay.indexOf(q) >= 0) return true;
      return qd.length >= 4 && d && String(d.Phone || "").replace(/[^0-9]/g, "").indexOf(qd) >= 0;
    });
    var cols = activeCols();
    var per = S.list.per;
    var pages = Math.max(1, Math.ceil(rows.length / per));
    if (S.list.page >= pages) S.list.page = 0;
    var slice = rows.slice(S.list.page * per, S.list.page * per + per);
    var catBtn = function (v, l) {
      return '<button type="button" data-cat="' + v + '"' + (S.list.cat === v ? ' class="on"' : "") + ">" + l + "</button>";
    };
    var mtName = S.mt === "both" ? "" : (S.mt === "ld" ? " · long distance" : " · local");
    el.innerHTML = '<div class="panel-head"><span class="panel-title">' + esc(S.fam || "") + mtName
      + '</span><span class="rs-pill mute">' + fmtN(rows.length) + " lead" + (rows.length === 1 ? "" : "s") + "</span></div>"
      + '<div class="rs-bar">'
      + '<div class="rs-fld"><span>Status</span><div class="rs-seg" id="sraCat">'
      + catBtn("", "All") + catBtn("Incoming Lead", "Open") + catBtn("Confirmed", "Confirmed") + catBtn("Bad Lead", "Dead")
      + "</div></div>"
      + '<label class="rs-fld"><span>Find</span><input class="rs-inp" id="sraQ" placeholder="Name, phone, email, request #…" value="'
      + esc(S.list.q) + '"></label>'
      + '<span class="rs-spacer"></span>'
      + '<div class="rs-slicer sra-cols" id="sraCols"></div>'
      + '<button class="rs-btn pri" id="sraCsv" type="button">Download CSV · ' + fmtN(rows.length) + "</button>"
      + "</div>"
      + '<div class="rs-hint">'
      + (det && det.error ? "<b>" + esc(det.error) + "</b> " : "")
      + (det && det.loading ? "Fetching names and contact details… " : "")
      + (det && det.capped ? "<b>Contact details stop at 30,000 leads</b> — narrow the period to see them all. " : "")
      + "The <b>Trace</b> link on each row opens Source Trace on that lead: why it counts as "
      + esc(S.fam || "this source") + ". "
      + '<span class="sra-save">' + esc(PREF.note || (PREF.saved ? "Your columns are saved to your account." : "")) + "</span>"
      + "</div>"
      + '<div class="rs-tablewrap rs-fit" id="sraTbl"><table class="rs-table rs-sticky"><thead><tr>'
      + cols.map(function (c) { return "<th" + (c.num ? ' class="num"' : "") + ">" + esc(c.label) + "</th>"; }).join("")
      + '<th title="why is this lead this source">Why this source</th></tr></thead><tbody>'
      + (slice.length ? slice.map(function (r) {
          var d = dmap ? (dmap[r["Request Joinkey"]] || {}) : null;
          return "<tr>" + cols.map(function (c) {
            var v = c.get(r, d);
            var cls = [c.num ? "num" : "", c.cls || ""].filter(Boolean).join(" ");
            return v.h == null ? '<td class="' + (cls ? cls + " " : "") + 'dim">—</td>'
                               : '<td' + (cls ? ' class="' + cls + '"' : "") + ">" + v.h + "</td>";
          }).join("")
            + '<td class="nowrap"><a class="sra-tr" href="#page=source-trace&lead='
            + encodeURIComponent(r["Request Joinkey"] || "") + '">Trace ↗</a></td></tr>';
        }).join("")
        : '<tr><td colspan="' + (cols.length + 1) + '" class="sra-empty">No leads match.</td></tr>')
      + "</tbody></table></div>"
      + '<div class="sra-foot" id="sraFoot"></div>';

    // pager (no "show all": ten thousand rows in one insert locks the tab -- the CSV has them)
    var foot = el.querySelector("#sraFoot");
    if (rows.length > per) {
      foot.innerHTML = "<span>" + fmtN(S.list.page * per + 1) + "–" + fmtN(Math.min(rows.length, S.list.page * per + per))
        + " of " + fmtN(rows.length) + "</span>"
        + '<span class="sra-pg"><button class="rs-btn" data-p="first"' + (S.list.page === 0 ? " disabled" : "") + ">« First</button>"
        + '<button class="rs-btn" data-p="prev"' + (S.list.page === 0 ? " disabled" : "") + ">‹ Prev</button>"
        + "<b>" + fmtN(S.list.page + 1) + " / " + fmtN(pages) + "</b>"
        + '<button class="rs-btn" data-p="next"' + (S.list.page >= pages - 1 ? " disabled" : "") + ">Next ›</button>"
        + '<button class="rs-btn" data-p="last"' + (S.list.page >= pages - 1 ? " disabled" : "") + ">Last »</button></span>";
      foot.querySelectorAll("[data-p]").forEach(function (b) {
        b.onclick = function () {
          var p = b.dataset.p;
          S.list.page = p === "first" ? 0 : p === "last" ? pages - 1
            : p === "prev" ? Math.max(0, S.list.page - 1) : Math.min(pages - 1, S.list.page + 1);
          paintList(host, w, leadsSt);
          var t = host.querySelector("#sraTbl"); if (t) t.scrollTop = 0;
        };
      });
    }
    el.querySelectorAll("#sraCat button").forEach(function (b) {
      b.onclick = function () { S.list.cat = b.dataset.cat; S.list.page = 0; paintList(host, w, leadsSt); };
    });
    var qi = el.querySelector("#sraQ");
    qi.oninput = function () {
      S.list.q = this.value; S.list.page = 0;
      var at = this.selectionStart;
      paintList(host, w, leadsSt);
      var n = host.querySelector("#sraQ");
      if (n) { n.focus(); n.setSelectionRange(at, at); }
    };
    el.querySelector("#sraCsv").onclick = function () { downloadCsv(rows, cols, dmap); };
    mountCols(host, el.querySelector("#sraCols"), w, leadsSt);
  }

  /* "Add columns": the kit's slicer look (button + checkbox popover), state saved per account */
  function mountCols(host, wrap, w, leadsSt) {
    var on = activeCols().map(function (c) { return c.k; });
    var extra = on.filter(function (k) { return DEF_COLS.indexOf(k) < 0; }).length;
    var hidden = DEF_COLS.filter(function (k) { return on.indexOf(k) < 0; }).length;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "rs-slicer-btn" + (S.cols ? " on" : "");
    btn.innerHTML = '<span class="lbl">Columns</span><span class="val">+ Add columns'
      + (extra || hidden ? " (" + (extra ? "+" + extra : "") + (extra && hidden ? " " : "") + (hidden ? "−" + hidden : "") + ")" : "")
      + '</span><span class="chev">▾</span>';
    var pop = document.createElement("div");
    pop.className = "rs-slicer-pop hidden";
    var opt = function (c) {
      return '<label class="opt"><input type="checkbox" value="' + esc(c.k) + '"' + (on.indexOf(c.k) >= 0 ? " checked" : "")
        + '> <span class="ol">' + esc(c.label) + "</span></label>";
    };
    pop.innerHTML = '<div class="opts"><div class="opt-div">Shown by default</div>'
      + LCOLS.filter(function (c) { return c.def; }).map(opt).join("")
      + '<div class="opt-div">More columns</div>'
      + LCOLS.filter(function (c) { return !c.def; }).map(opt).join("")
      + '</div><button type="button" class="rs-btn sra-reset">Reset to the default columns</button>';
    pop.addEventListener("click", function (e) { e.stopPropagation(); });
    pop.addEventListener("change", function () {
      var picked = [];
      pop.querySelectorAll("input:checked").forEach(function (cb) { picked.push(cb.value); });
      if (!picked.length) picked = DEF_COLS.slice();
      var same = picked.length === DEF_COLS.length && picked.every(function (k) { return DEF_COLS.indexOf(k) >= 0; });
      S.cols = same ? null : LCOLS.map(function (c) { return c.k; }).filter(function (k) { return picked.indexOf(k) >= 0; });
      savePrefs(host);
      paintList(host, w, leadsSt);
      var np = host.querySelector("#sraCols .rs-slicer-pop");
      if (np) np.classList.remove("hidden");   // keep the checkbox session open after the repaint
    });
    pop.querySelector(".sra-reset").onclick = function () {
      S.cols = null; savePrefs(host); paintList(host, w, leadsSt);
    };
    btn.onclick = function (e) {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop, .rs-datepop").forEach(function (p) { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
    };
    wrap.appendChild(btn); wrap.appendChild(pop);
  }

  /* the CSV is what is on screen: the chosen columns, every row the filters leave */
  function downloadCsv(rows, cols, dmap) {
    var cell = function (x) {
      var s = String(x == null ? "" : x);
      if (/^[=+\-@]/.test(s)) s = " " + s;      // a leading formula character executes in Excel
      return '"' + s.replace(/"/g, '""') + '"';
    };
    var head = ["Request Joinkey"].concat(cols.map(function (c) { return c.label; }));
    var lines = [head.map(cell).join(",")].concat(rows.map(function (r) {
      var d = dmap ? (dmap[r["Request Joinkey"]] || {}) : null;
      return [r["Request Joinkey"]].concat(cols.map(function (c) { return c.get(r, d).t; })).map(cell).join(",");
    }));
    var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "Source Analysis - " + (S.fam || "source") + " (" + rows.length + " leads).csv";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
  }

  if (window.registerPage) {
    registerPage({
      id: "source-report",
      group: "marketing",
      title: "Source Analysis",
      render: render,
    });
  }
})();
