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
 *
 * RETURN ON AD SPEND BY STATE OPENS THE PAGE AGAIN (Tornike 2026-10-15: "in the source we had this
 * ROA thing as the main start - why dont we have it any more ?" -- the original Source Analysis
 * opened on revenue per $1 of ads; the 23 Sep rebuild started on one source instead). Every source,
 * every state, for the period and company in the bar: revenue per $1 of ads, PER SOURCE (Angi spend
 * in NJ against Angi jobs' revenue in NJ, summed per state), spend placed in a state by
 * mart_source_state_spend (how each dollar was placed rides on the row), and the spend the data
 * cannot place shown as missing, with the dollars he types per source, MONTH and state
 * (mkt_state_amount via /api/_mktamount -- his call the same day: "split the expenditure for adds
 * by month only, by amounts on each state"; it replaced a one-percentage-for-every-month split).
 *
 * TWO TABS, EACH FILTER APPLYING TO EVERYTHING ON ITS TAB (his call 2026-10-19: "the filter of the
 * source is working on some of the stuff and does not work on some of the stuff ... have a separate
 * tab for ROI / ROA, and have general statistics on 2nd tab"). Measured that day: one bar sat over
 * the every-source ROAS table (it ignored Source) and over Spend and return (it ignored State,
 * Local / LD, size and rep), so a filter changed half the page.
 *   * RETURN ON AD SPEND (opens first): Sources (several, none = every source), Company, Period,
 *     State. The source x state tables and, his pick, Spend and return as ONE ROW PER SOURCE with the
 *     month-by-month spend and cash for the sources picked.
 *   * SOURCE STATISTICS: one Source (and Campaign), Company, Period, Compare and the Filters panel
 *     (State, Local / LD, Size, Rep) -- every card, chart, the pivot and the list follow them all.
 * Company and Period are shared by the two tabs; each tab keeps its own state filter. A link that
 * names a source (the Marketing Overview's rows) opens the statistics tab; ours carry &tab=.
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
  if (!RS.DATASETS.src_state_spend) {
    RS.DATASETS.src_state_spend = {
      table: "mart_source_state_spend",
      cols: ["Month", "Company", "Family", "State", "How", "Spend"],
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
  var SIDES0 = [["Local", "Local"], ["Long distance", "Long distance"]];
  var THIN = 30;          // below this many qualified leads a rate is marked "small sample"

  /* Page state lives at module scope so a re-render (theme switch, a global filter change on
     another page) keeps the reader's picks. */
  var S = {
    fam: null, camp: "", co: "Zip to Zip", from: null, to: null, cmp: "ly",
    states: new Set(), mts: new Set(), sizes: new Set(), reps: new Set(), by: "month",
    list: { page: 0, per: 50, q: "", cat: "" },
    cols: null, bootDone: false,
    // the two tabs (2026-10-19): which is open, and the Return-on-ad-spend tab's own picks
    tab: "roi", roiFams: new Set(), roiStates: new Set(),
  };
  /* THE FILTERS PANEL (his ask 2026-10-15: "apply it to montlhy report and other reports too"):
     Pickup state, Local / Long distance, Size of move and Rep, in the right-hand panel the other
     reports have; Source and Campaign stay in the bar. Pickup state was the bar's own multi and
     Local / Long distance the Breakdowns' three buttons -- both moved in. All four are Sets in this
     module's memory (empty = every value), never RS.state.multi, never localStorage. Local / Long
     distance is the lead's Moving Type: Service Type 'Long Distance' is Long distance, every other
     service type Local (the page's own definition above). Return on ad spend follows the State
     filter only; Spend and return follows none (the ledger has no state, size, rep or type). */
  var PF_NAME = { state: "State", mt: "Local / Long distance", size: "Size of move", rep: "Rep" };
  var DATA = { ready: false, byFam: null, minDay: null, maxDay: null, ledgerEnd: null, formsDate: null };
  var FORMS_STALE_DAYS = 10;   // the export is due weekly (his call 2026-09-24); 10 days = one Monday missed
  var DETAIL = {};        // "fam|co|from|to" -> {rows: {jk: row}, capped, error} (or a Promise)
  /* the ROAS section: placed spend rows, the typed amounts ("co|fam" -> {"YYYY-MM": [{State,
     Amount, ...}]}), and which source's amounts editor is open */
  var ROAS = { rows: null, err: null, amts: null, amtErr: null, edit: null, note: "" };
  var AMT_STATES = ["NJ", "PA", "NY", "CT", "DE", "MD", "MA", "VA"];
  var SMALL_SPEND = 500;   // a source x state cell with less placed spend is shown greyed, not rated
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
    /* design v2: --blue and --brand are the same accent there, so the two bar series would merge.
       The v2 categorical order instead: light blue for the wider set, navy for the booked. */
    if (RS.isV2 && RS.isV2()) {
      var V = RS.V2;
      return { blue: V.accentL, brand: V.navy, ink: V.ink, violet: V.cat[4], faint: V.other, muted: V.muted };
    }
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
      // DESIGN V2 "Calm finance" (2026-10-06), light only: the funnel steps light -> navy so
      // leads, qualified and confirmed stay apart now that --blue and --brand are one accent
      + "body.rs-app.light.v2 .sra .sra-fb i.c-lead{background:#DCEFB0}"
      + "body.rs-app.light.v2 .sra .sra-fb i.c-qual{background:#A3CF3A;filter:none}"
      + "body.rs-app.light.v2 .sra .sra-fb i.c-conf{background:#14301F}"
      + "body.rs-app.light.v2 .sra .sra-fb{background:#F1F5F9}"
      + "body.rs-app.light.v2 .sra .sra-h h2{font-weight:600}"
      + "body.rs-app.light.v2 .sra :is(.sra-h .sra-sub,.sra-fl small,.sra-fv em,.sra-rate .sra-ss){font-size:12px}"
      + "body.rs-app.light.v2 .sra .sra-fl{font-weight:600}"
      + "body.rs-app.light.v2 .sra :is(.sra-fv,.sra-d){font-weight:600}"
      + "body.rs-app.light.v2 .sra .sra-tot td{font-weight:600;background:#F8FAFC}"
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
      // the ROAS section (2026-10-15)
      + ".sra .sra-roas .rs-table td.num small{display:block;color:var(--faint);font-size:11px;font-weight:600}"
      + ".sra .sra-roas .sra-x{font-weight:700;font-variant-numeric:tabular-nums}"
      + ".sra .sra-roas .sra-x.hi{color:var(--pos)}.sra .sra-roas .sra-x.lo{color:var(--neg)}"
      + ".sra .sra-roas .sra-np{color:var(--faint)}"
      + ".sra .sra-amt-msg.bad{color:var(--neg)}"
      // the split panel (2026-10-20) lives on <body>, outside .sra, so its rules carry their own prefix
      + ".sra-ov{position:fixed;inset:0;background:var(--scrim,rgba(10,16,24,.45));z-index:60;display:flex;justify-content:flex-end}"
      + ".sra-dr{width:min(600px,100vw);height:100%;overflow:auto;background:var(--bg);color:var(--ink);padding:18px 20px 22px;"
      + "box-shadow:-12px 0 32px rgba(15,23,42,.18);display:flex;flex-direction:column;gap:12px}"
      + ".sra-dr .rs-hint{margin:0}"
      + ".sra-dr-h{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}"
      + ".sra-dr-t{font-size:16px;font-weight:700}.sra-dr-s{font-size:12.5px;color:var(--muted);margin-top:2px}"
      + ".sra-xb{width:32px;height:32px;flex:none;border-radius:50%;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;font:inherit}"
      + ".sra-xb:hover,.sra-qc:hover,.sra-fc:hover,.sra-sc:hover,.sra-mc:hover,.sra-nx:hover{border-color:var(--brand)}"
      + ".sra-q{display:flex;gap:6px;flex-wrap:wrap}"
      + ".sra-qc,.sra-fc,.sra-sc,.sra-nx{font:inherit;font-size:12.5px;border-radius:999px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;"
      + "padding:5px 12px;display:inline-flex;align-items:center;gap:6px;line-height:1.3;transition:border-color .12s,background .12s}"
      + ".sra-qc{font-size:12px;padding:4px 10px}.sra-qc small,.sra-fc small{color:var(--muted);font-size:11px}.sra-qc.done{color:var(--pos)}"
      + ".sra-qc.on{background:var(--ink);border-color:var(--ink);color:var(--bg)}.sra-qc.on small{color:inherit;opacity:.75}"
      + ".sra-msh{display:flex;align-items:baseline;gap:8px;font-size:13px}.sra-msh small{color:var(--muted);font-size:12px}"
      + ".sra-mcs{display:grid;grid-template-columns:repeat(auto-fill,minmax(100px,1fr));gap:8px}"
      + ".sra-mc{font:inherit;text-align:left;border-radius:12px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);cursor:pointer;"
      + "padding:7px 10px;display:flex;flex-direction:column;gap:1px;transition:border-color .12s,background .12s}"
      + ".sra-mc-l{font-size:11.5px;color:var(--muted);font-weight:600}.sra-mc-v{font-weight:700;font-variant-numeric:tabular-nums}"
      + ".sra-mc-p{font-size:11px;color:var(--muted)}"
      + ".sra-mc.full{background:var(--pos-bg);border-color:var(--pos)}.sra-mc.full .sra-mc-v,.sra-mc.full .sra-mc-p{color:var(--pos)}"
      + ".sra-mc.part{background:var(--warn-bg);border-color:var(--warn)}.sra-mc.part .sra-mc-p{color:var(--warn)}"
      + ".sra-mc.over{background:var(--neg-bg);border-color:var(--neg)}.sra-mc.over .sra-mc-p{color:var(--neg)}"
      + ".sra-mc.on{outline:2px solid var(--ink);outline-offset:1px}"
      + ".sra-pick,.sra-empty2{border:1px dashed var(--line-2);border-radius:12px;padding:16px;text-align:center;font-size:13px;color:var(--muted)}"
      + ".sra-pick b{color:var(--ink)}.sra-pick .g{color:var(--pos);font-weight:700}.sra-pick .a{color:var(--warn);font-weight:700}"
      + ".sra-mh2{display:flex;justify-content:space-between;align-items:center;gap:10px;font-size:13.5px}.sra-mh2 b{font-size:15px}"
      + ".sra-fills{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.sra-fills>span{font-size:12px;color:var(--muted);margin-right:2px}"
      + ".sra-note{font-size:12.5px;color:var(--warn);background:var(--warn-bg);border-radius:8px;padding:6px 10px}"
      + ".sra-scs{display:flex;gap:6px;flex-wrap:wrap}"
      + ".sra-sc{font-weight:600;padding:5px 11px 5px 9px}.sra-sc i{width:8px;height:8px;border-radius:50%;background:var(--c);display:inline-block}"
      + ".sra-sc small{font-size:10.5px;font-weight:600;color:var(--muted);background:var(--panel-2);border-radius:999px;padding:0 6px}"
      + ".sra-sc.on{background:color-mix(in srgb,var(--c) 14%,var(--panel));border-color:var(--c)}"
      + ".sra-bar{display:flex;height:10px;border-radius:999px;overflow:hidden;background:var(--panel-2)}.sra-bar i{display:block;height:100%}"
      + ".sra-sr{display:grid;grid-template-columns:52px minmax(0,1fr) 62px 12px 82px 26px;gap:8px;align-items:center;padding:3px 0}"
      + ".sra-sr b{font-weight:700;display:flex;align-items:center;gap:6px}.sra-sr b i{width:9px;height:9px;border-radius:50%;background:var(--c);display:inline-block}"
      + ".sra-sr input[type=range]{width:100%;accent-color:var(--c)}"
      + ".sra-sr .rs-inp{width:62px;min-width:0;text-align:right;padding:4px 6px;font-variant-numeric:tabular-nums;border-radius:8px}"
      + ".sra-sr .num{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}"
      + ".sra-rm{width:24px;height:24px;border-radius:50%;border:0;background:transparent;color:var(--faint);cursor:pointer;font:inherit;font-size:12px}"
      + ".sra-rm:hover{color:var(--neg);background:var(--neg-bg)}"
      + ".sra-sum{font-size:13px}.sra-sum .ok{color:var(--pos);font-weight:600}.sra-sum .bad{color:var(--neg);font-weight:600}"
      + ".sra-dr-f{display:flex;gap:10px;align-items:center;justify-content:flex-end;margin-top:auto;padding-top:10px;border-top:1px solid var(--line)}"
      + ".sra-dr-f .sra-amt-msg{margin-right:auto;font-size:12.5px;color:var(--muted)}.sra-dr-f .sra-amt-msg.bad{color:var(--neg)}"
      + "@media(max-width:560px){.sra-sr{grid-template-columns:44px minmax(0,1fr) 56px 10px 70px 24px}}"
      + ".sra .sra-roas tr.sra-ed td{background:var(--panel-2)}"
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
  function mtOk(r) { return !S.mts.size || S.mts.has(r["Moving Type"]); }
  // the one side picked, or null when the filter is off (none or both picked)
  function mtOne() { return S.mts.size === 1 ? Array.from(S.mts)[0] : null; }
  function sizeOk(r) { return !S.sizes.size || S.sizes.has(String(r["Size of Move"] || "")); }
  function repOk(r) { return !S.reps.size || S.reps.has(String(r.Rep || "")); }
  // every lead section reads the family's leads through this; Local / Long distance splits the
  // two sides and slices the breakdowns and the list (sliceMt)
  function leadOk(r) { return stOk(r) && sizeOk(r) && repOk(r); }
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
        var got = await Promise.all([RS.load("src_lead"), RS.load("src_job"), RS.load("src_spend"),
          RS.load("src_state_spend").catch(function (e) { ROAS.err = e; return null; })]);
        index(got[0] || [], got[1] || [], got[2] || []);
        ROAS.rows = (got[3] || []).map(function (r) {
          return { _m: String(r.Month || "").slice(0, 10), co: r.Company, fam: r.Family || "(no source)",
                   st: r.State ? String(r.State).trim().toUpperCase() : "", how: r.How, sp: num(r.Spend) };
        });
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
    // a link that names a source wins on EVERY arrival, not only the first: the Marketing
    // Overview's channel rows open #page=source-report&src=<family> in a tab that may have
    // shown another source already (2026-10-16)
    var lk = /[#&]src=([^&]+)/.exec(location.hash || "");
    var tk = /[#&]tab=(roi|stats)\b/.exec(location.hash || "");
    if (tk) S.tab = tk[1];
    else if (lk) S.tab = "stats";   // the Marketing Overview's rows name a source: they mean its statistics
    if (lk) {
      var lf = null;
      try { lf = decodeURIComponent(lk[1]); } catch (e) { lf = null; }
      if (lf && lf !== S.fam && DATA.byFam.has(lf)) { S.fam = lf; S.camp = ""; S.list.page = 0; }
    }
    if (!PREF.loaded && !PREF.loading) loadPrefs(host);
    // a read that failed (the table not built yet, a bridge hiccup) is tried again on the next render
    if ((ROAS.amts == null || ROAS.amtErr) && !ROAS.loadingAmts) loadAmounts(host);
    paint(host);
  }

  /* first render only: family from the link, else the reader's last pick, else the biggest */
  function boot() {
    if (S.bootDone) return;
    S.bootDone = true;
    S.tab = lsGet("sraTab") === "stats" ? "stats" : "roi";   // Return on ad spend opens first (his order)
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
      history.replaceState(null, "", "#page=source-report&tab=" + S.tab + "&src=" + encodeURIComponent(S.fam || "")
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
    var leadsSt = pack.leads.filter(leadOk);
    var isPC = S.fam === "Post Card";

    var head = '<div class="rs-page-head"><h1>Source Analysis</h1>'
      + "<p>What every source returns on its ad spend, by state; and, for one source, the leads it sent, "
      + "how many booked and what they were worth.</p></div>"
      + '<div class="rs-tabs" id="sraTabs">'
      + '<button type="button" class="rs-tab' + (S.tab === "roi" ? " on" : "") + '" data-tab="roi">Return on ad spend</button>'
      + '<button type="button" class="rs-tab' + (S.tab === "stats" ? " on" : "") + '" data-tab="stats">Source statistics</button>'
      + "</div>";
    if (S.tab === "roi") {
      host.innerHTML = '<div class="sra">' + head
        + '<div class="rs-bar" id="sraBar">'
        + '<div id="sraRoiFam"></div><div id="sraCo"></div>'
        + '<div class="rs-fld"><span>Period</span><div id="sraDate"></div></div>'
        + '<div id="sraRoiSt"></div>'
        + "</div>"
        + formsStaleHtml()
        + '<div class="sra-h"><h2>Return on ad spend · by source and state</h2>'
        + '<span class="sra-sub">every filter above applies</span></div>'
        + '<div class="sra-roas" id="sraRoas"></div>'
        + '<div class="sra-h"><h2>Spend and return · by source</h2><span id="sraSpendPills"></span></div>'
        + '<div id="sraSpendAll"></div>'
        + "</div>";
      wireTabs(host);
      mountRoiBar(host, w);
      try { paintRoas(host, w); }
      catch (e) { var re0 = host.querySelector("#sraRoas"); if (re0) re0.innerHTML = '<div class="panel"><div class="rs-hint">The return-on-ad-spend view could not draw: ' + esc(e.message) + "</div></div>"; }
      try { paintSpendAll(host, w); }
      catch (e) { var se0 = host.querySelector("#sraSpendAll"); if (se0) se0.innerHTML = '<div class="panel"><div class="rs-hint">Spend and return could not draw: ' + esc(e.message) + "</div></div>"; }
      return;
    }

    host.innerHTML = '<div class="sra">' + head
      + '<div class="rs-bar" id="sraBar">'
      + '<div id="sraFam"></div>'
      + (isPC ? '<div id="sraCamp"></div>' : "")
      + '<div id="sraCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="sraDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="sraCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + '<div id="sraFilt" style="margin-left:auto"></div>'
      + "</div>"
      + '<div id="sraChips"></div>'
      + formsStaleHtml()
      + '<div class="sra-h"><h2 id="sraOneH">One source in detail</h2>'
      + '<span class="sra-sub">every filter above applies</span></div>'
      + '<div class="rs-hint" id="sraLead"></div>'
      + '<div class="rs-grid2" id="sraSides"></div>'
      + '<div class="sra-h"><h2>Breakdowns</h2>'
      + '<span class="sra-sub">leads by create date · confirmed by booked date</span></div>'
      + '<div class="rs-grid2 sra-grid" id="sraCharts"></div>'
      + '<div class="sra-h"><h2>Analyze by</h2><div id="sraBy"></div></div>'
      + '<div class="panel" id="sraPivot"></div>'
      + '<div class="sra-h"><h2>Leads</h2><span class="sra-sub">every lead created in the period '
      + "that passes the filters above, newest first</span></div>"
      + '<div class="panel sra-list" id="sraList"></div>'
      + "</div>";

    wireTabs(host);
    mountBar(host, w);
    var oh = host.querySelector("#sraOneH"); if (oh) oh.textContent = (S.fam || "One source") + " in detail";
    paintLead(host, w, cw, pack, leadsSt);
    paintSides(host, w, cw, leadsSt);
    paintCharts(host, w, leadsSt);
    paintPivot(host, w, leadsSt);
    paintList(host, w, leadsSt);
  }

  function wireTabs(host) {
    host.querySelectorAll("#sraTabs [data-tab]").forEach(function (b) {
      b.onclick = function () {
        if (S.tab === b.dataset.tab) return;
        S.tab = b.dataset.tab; lsSet("sraTab", S.tab); paint(host);
        var sc = host.closest && host.closest(".rs-content"); if (sc) sc.scrollTop = 0;
      };
    });
  }

  /* the Return-on-ad-spend tab's bar: Sources (several; none = every paying source), Company,
     Period and State -- the only filters on that tab, and every number there follows all four */
  function mountRoiBar(host, w) {
    var led = DATA.ledgerEnd, e = led && w.bEff > led ? led : w.bEff, m0 = w.a.slice(0, 8) + "01";
    var spent = {};
    (ROAS.rows || []).forEach(function (r) {
      if ((S.co && r.co !== S.co) || r._m < m0 || r._m > e) return;
      spent[r.fam] = (spent[r.fam] || 0) + r.sp;
    });
    S.roiFams.forEach(function (f) { if (!(f in spent)) spent[f] = 0; });
    var fams = Object.keys(spent).filter(function (f) { return spent[f] > 0.5 || S.roiFams.has(f); })
      .sort(function (a, b) { return spent[b] - spent[a] || a.localeCompare(b); });
    RSC.localMulti(host.querySelector("#sraRoiFam"), {
      label: "Sources", emptyLabel: "All sources",
      values: fams.map(function (f) { return { v: f, l: f }; }),
      selected: S.roiFams, startOpen: S.reopen === "fam",
      onChange: function (set) { S.roiFams = new Set(set); S.reopen = "fam"; paint(host); },
    });
    RSC.localSelect(host.querySelector("#sraCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: S.co,
      onChange: function (v) { S.co = v; paint(host); },
    });
    RSC.dateRange(host.querySelector("#sraDate"), {
      get: function () { return { from: S.from, to: S.to }; },
      set: function (f, t) { S.from = f; S.to = t; },
      onChange: function () { paint(host); },
    });
    RSC.localMulti(host.querySelector("#sraRoiSt"), {
      label: "State", emptyLabel: "All states",
      values: SERVICE_STATES.concat([OTHER_ST]).map(function (x) { return { v: x, l: x }; }),
      selected: S.roiStates, startOpen: S.reopen === "st",
      onChange: function (set) { S.roiStates = new Set(set); S.reopen = "st"; paint(host); },
    });
    // the page repaints on every tick; the list being ticked opens again so several can be picked
    S.reopen = null;
  }

  /* ---- RETURN ON AD SPEND, EVERY SOURCE BY STATE (2026-10-15) ---- */
  function loadAmounts(host) {
    ROAS.loadingAmts = true;
    ZTZ.api("/api/_mktamount").then(function (j) {
      var m = {};
      ((j && j.amounts) || []).forEach(function (r) {
        var M = m[r.Company + "|" + r.Family] = m[r.Company + "|" + r.Family] || {};
        (M[r.Month] = M[r.Month] || []).push(r);
      });
      ROAS.amts = m; ROAS.amtErr = null;
    }).catch(function (e) { ROAS.amts = {}; ROAS.amtErr = e; })
      .then(function () { ROAS.loadingAmts = false; if (host.isConnected && host.querySelector("#sraRoas")) paintRoas(host, win()); });
  }
  // the amounts typed for one source and month; the months of the period that have any
  function amtOf(co, fam, ym) { var M = ROAS.amts && ROAS.amts[co + "|" + fam]; return (M && M[ym]) || []; }
  function typedIn(co, fam, R) {
    var M = ROAS.amts && ROAS.amts[co + "|" + fam], a = R.m0.slice(0, 7), b = R.e.slice(0, 7);
    return !M ? [] : Object.keys(M).filter(function (ym) { return ym >= a && ym <= b && M[ym].length; }).sort();
  }
  var HOW_SHORT = { "From the source label": "label", "Google Ads state report": "Google report",
                    "Thumbtack lead cost": "lead cost", "Split by leads": "by leads", "Your amounts": "typed" };
  /* the period's numbers: spend placed per source and state (the typed amounts applied to what the
     data could not place, month by month), revenue of each paying source's jobs per state, what is
     still unplaced */
  function roasCalc(w) {
    var led = DATA.ledgerEnd, e = led && w.bEff > led ? led : w.bEff;
    var m0 = w.a.slice(0, 8) + "01";
    var fams = {}, unpl = {}, total = 0, mon = {}, over = [];
    var cell = function (f, st) {
      var F = fams[f] = fams[f] || { sp: 0, unpl: 0, st: {} };
      return F.st[st] = F.st[st] || { sp: 0, rev: 0, jobs: 0, how: {} };
    };
    var famIn = function (f) { return !S.roiFams.size || S.roiFams.has(f); };
    (ROAS.rows || []).forEach(function (r) {
      if ((S.co && r.co !== S.co) || r._m < m0 || r._m > e || !famIn(r.fam)) return;
      total += r.sp;
      var F = fams[r.fam] = fams[r.fam] || { sp: 0, unpl: 0, st: {} };
      F.sp += r.sp;
      if (r.how !== "Not placed") {
        var c = cell(r.fam, stateKey(r.st)); c.sp += r.sp; c.how[r.how] = (c.how[r.how] || 0) + r.sp;
        return;
      }
      // the dollars typed for this source and month go to their states, up to the month's unplaced
      // spend; typed more than the month now has (the ledger moved since)? scaled down to fit and
      // named under Missing data. Whatever is left stays not placed.
      var ym = r._m.slice(0, 7), A = amtOf(r.co, r.fam, ym), T = 0;
      A.forEach(function (x) { T += num(x.Amount); });
      var Mo = mon[r.fam] = mon[r.fam] || {};
      Mo[ym] = (Mo[ym] || 0) + r.sp;
      var fit = T > 0 ? Math.min(1, r.sp / T) : 0;
      if (T > r.sp + 1) over.push({ fam: r.fam, ym: ym, typed: T, spend: r.sp });
      A.forEach(function (x) {
        var part = num(x.Amount) * fit, c2 = cell(r.fam, stateKey(x.State));
        c2.sp += part; c2.how["Your amounts"] = (c2.how["Your amounts"] || 0) + part;
      });
      var rest = r.sp - T * fit;
      if (rest <= 0.5) return;
      F.unpl += rest;
      var U = unpl[r.fam] = unpl[r.fam] || { sp: 0, months: {} };
      U.sp += rest; U.months[ym] = (U.months[ym] || 0) + rest;
    });
    // revenue: each paying source's jobs, by the closing's state, same company and days
    var noState = { n: 0, rev: 0, rows: [] };
    DATA.byFam.forEach(function (v, f) {
      if (!famIn(f)) return;
      v.jobs.forEach(function (r) {
        if (!coOk(r) || !inR(r._d, w.a, e)) return;
        var blank = !String(r.State || "").trim();
        if (blank && r["Record Source"] === "closing") { noState.n++; noState.rev += num(r.Billed); if (noState.rows.length < 25) noState.rows.push(r); }
        if (!fams[f] || fams[f].sp <= 0) return;
        var c = cell(f, stateKey(r.State));
        c.rev += num(r.Billed);
        if (r["Record Source"] === "closing") c.jobs++;
      });
    });
    return { e: e, m0: m0, clipped: e < w.bEff, fams: fams, unpl: unpl, total: total, noState: noState,
             mon: mon, over: over };
  }
  function xTxt(rev, sp) {
    if (!(sp > 0)) return '<span class="sra-np">—</span>';
    var x = rev / sp;
    return '<span class="sra-x ' + (x >= 5 ? "hi" : x < 2 ? "lo" : "") + '">' + x.toFixed(1) + "×</span>";
  }
  function paintRoas(host, w) {
    var el = host.querySelector("#sraRoas");
    if (!el) return;
    if (ROAS.err && !ROAS.rows) {
      el.innerHTML = '<div class="panel"><div class="rs-hint">' + (/404|unknown dataset|1146/i.test(String(ROAS.err.message))
        ? "The spend-by-state table is not built yet — it arrives with the next data refresh."
        : "The spend-by-state table could not be read: " + esc(ROAS.err.message)) + "</div></div>";
      return;
    }
    var R = roasCalc(w), st = SERVICE_STATES.concat([OTHER_ST]);
    /* A STATE FILTER (2026-10-15) keeps only those states, spend and revenue on the same footing:
       the spend placed in a state against the revenue of the same sources' jobs there. Spend no
       rule can place has no state -- it may belong to these states or not -- so it stays named in
       full (the Not placed row and column, Missing data), as does the all-sources return. */
    var PS = S.roiStates.size ? S.roiStates : null;
    var stIn = function (s0) { return !PS || PS.has(s0); };
    var psTxt = PS ? st.filter(stIn).join(", ") : "";
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0; })
      .sort(function (a, b) { return R.fams[b].sp - R.fams[a].sp; });
    // per state: only cells where spend IS placed count, so a source whose spend is unplaced never
    // inflates a state's return with revenue it did not pay for
    var byS = {}, placed = 0, revPlaced = 0, revAll = 0, placedPS = 0, revPS = 0;
    st.forEach(function (s0) { byS[s0] = { sp: 0, rev: 0, jobs: 0, how: {} }; });
    famList.forEach(function (f) {
      Object.keys(R.fams[f].st).forEach(function (s0) {
        var c = R.fams[f].st[s0];
        revAll += c.rev;
        if (!(c.sp > 0)) return;
        var B = byS[s0]; B.sp += c.sp; B.rev += c.rev; B.jobs += c.jobs; placed += c.sp; revPlaced += c.rev;
        if (stIn(s0)) { placedPS += c.sp; revPS += c.rev; }
        Object.keys(c.how).forEach(function (h) { B.how[h] = (B.how[h] || 0) + c.how[h]; });
      });
    });
    var unplTot = R.total - placed, unplFams = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; });
    var hint = '<div class="rs-hint">Spend '
      + (R.clipped ? "up to <b>" + esc(niceDay(R.e)) + "</b>, the last day the advertising ledger is posted (revenue stops there too)" : "for the period")
      + ", by month. Return = revenue (Total Bill) of each source's jobs in a state ÷ that source's spend placed in the state. "
      + "Spend is placed from the source's label (post cards, Yelp-DE), Google's own state report, Thumbtack's cost per lead, "
      + "Angi's and Google Local's leads by state, or the dollars you type per month; anything else waits under <b>Missing data</b> below.</div>"
      + (PS ? '<div class="rs-hint">Spend no rule can place has no state, so under a State filter it stays whole and '
          + "named (the Not placed row and Missing data), and so does the all-sources return.</div>" : "");
    var k = !PS ? [
      { label: "Ad spend", value: money0(R.total), sub: famList.length + " paying sources" },
      { label: "Placed in a state", value: R.total ? pct1(placed / R.total) : "—", sub: money0(placed) + " of it" },
      { label: "Return where placed", value: placed > 0 ? (revPlaced / placed).toFixed(1) + "×" : "—",
        sub: money0(revPlaced) + " revenue ÷ " + money0(placed) },
      { label: "Return, all paying sources", value: R.total > 0 ? (revAll / R.total).toFixed(1) + "×" : "—",
        sub: money0(revAll) + " revenue ÷ every ad dollar" },
      { label: "Not placed yet", value: money0(unplTot), sub: unplFams.length ? unplFams.length + " source" + (unplFams.length === 1 ? "" : "s") + " — see Missing data" : "nothing missing",
        tone: unplTot > 0.5 ? "warn" : "" },
    ] : [
      { label: "Ad spend", value: money0(placedPS), sub: "placed in " + psTxt + " · " + money0(R.total) + " in all" },
      { label: "Placed in a state", value: R.total ? pct1(placedPS / R.total) : "—", sub: "of all ad spend is placed in these states" },
      { label: "Return where placed", value: placedPS > 0 ? (revPS / placedPS).toFixed(1) + "×" : "—",
        sub: money0(revPS) + " revenue ÷ " + money0(placedPS) },
      { label: "Return, all paying sources", value: R.total > 0 ? (revAll / R.total).toFixed(1) + "×" : "—",
        sub: "every state: " + money0(revAll) + " ÷ every ad dollar" },
      { label: "Not placed yet", value: money0(unplTot), sub: (unplFams.length ? unplFams.length + " source" + (unplFams.length === 1 ? "" : "s") + ", any state — see Missing data" : "nothing missing"),
        tone: unplTot > 0.5 ? "warn" : "" },
    ];
    var stRows = st.filter(function (s0) { return stIn(s0) && (byS[s0].sp > 0 || byS[s0].rev > 0); });
    var howTxt = function (how, sp) {
      return Object.keys(how).sort(function (a, b) { return how[b] - how[a]; })
        .map(function (h) { return (HOW_SHORT[h] || h) + " " + Math.round(100 * how[h] / (sp || 1)) + "%"; }).join(" · ");
    };
    var stTable = '<div class="panel"><div class="panel-head"><span class="panel-title">By state</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Spend placed</th>'
      + '<th class="num">Revenue, same sources</th><th class="num">Jobs</th><th class="num">Return per $1</th><th>How the spend was placed</th></tr></thead><tbody>'
      + stRows.sort(function (a, b) { return byS[b].sp - byS[a].sp; }).map(function (s0) {
          var B = byS[s0];
          return "<tr><td>" + esc(s0) + '</td><td class="num">' + money0(B.sp) + '</td><td class="num">' + money0(B.rev)
            + '</td><td class="num">' + fmtN(B.jobs) + '</td><td class="num">' + xTxt(B.rev, B.sp) + '</td><td class="sra-np">'
            + esc(howTxt(B.how, B.sp)) + "</td></tr>";
        }).join("")
      + (unplTot > 0.5 ? '<tr><td>Not placed' + (PS ? ", any state" : "") + '</td><td class="num">' + money0(unplTot) + '</td><td class="num sra-np">—</td><td></td>'
          + '<td class="num sra-np">—</td><td class="sra-np">see Missing data</td></tr>' : "")
      + '</tbody><tfoot><tr class="sra-tot">' + (PS
          ? '<td>These states</td><td class="num">' + money0(placedPS) + '</td><td class="num">' + money0(revPS)
            + '</td><td></td><td class="num">' + xTxt(revPS, placedPS) + "</td><td></td>"
          : '<td>All</td><td class="num">' + money0(R.total) + '</td><td class="num">' + money0(revPlaced)
            + '</td><td></td><td class="num">' + xTxt(revPlaced, placed) + "</td><td></td>")
      + "</tr></tfoot></table></div></div>";
    var cols = st.filter(function (s0) { return stIn(s0) && famList.some(function (f) { var c = R.fams[f].st[s0]; return c && (c.sp > 0 || c.rev > 0); }); });
    // under a State filter: the sources with something in these states, or spend nobody placed
    var famRows = !PS ? famList : famList.filter(function (f) {
      return R.fams[f].unpl > 0.5 || cols.some(function (s0) { var c = R.fams[f].st[s0]; return c && (c.sp > 0 || c.rev > 0); });
    });
    var mx = '<div class="panel"><div class="panel-head"><span class="panel-title">Every source by state · return per $1</span>'
      + '<span class="sra-sub" style="margin-left:auto">hover a cell for spend and revenue · "—" = no spend placed there · grey = under $500 placed</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">' + (PS ? "Spend placed here" : "Spend") + "</th>"
      + cols.map(function (s0) { return '<th class="num">' + esc(s0 === OTHER_ST ? "Other" : s0) + "</th>"; }).join("")
      + '<th class="num">Not placed</th>' + (PS ? '<th class="num" title="revenue where spend is placed in these states ÷ that spend">These states</th>'
                                                 : '<th class="num">All states</th>') + "</tr></thead><tbody>"
      + famRows.map(function (f) {
          var F = R.fams[f], revF = 0, spF = F.sp;
          if (PS) {
            // these states, where-placed footing: the same cells the by-state table counts
            spF = 0;
            cols.forEach(function (s0) { var c = F.st[s0]; if (c && c.sp > 0) { spF += c.sp; revF += c.rev; } });
          } else Object.keys(F.st).forEach(function (s0) { revF += F.st[s0].rev; });
          return "<tr><td>" + esc(f) + '</td><td class="num">' + money0(spF) + "</td>"
            + cols.map(function (s0) {
                var c = F.st[s0];
                if (!c || !(c.sp > 0)) return '<td class="num" title="' + (c && c.rev ? esc(money0(c.rev) + " revenue, no spend placed") : "") + '"><span class="sra-np">—</span></td>';
                // under $500 placed, a ratio says more about the denominator than the source
                if (c.sp < SMALL_SPEND) return '<td class="num" title="' + esc("only " + money0(c.sp) + " of spend placed here (" + money0(c.rev) + " revenue) — too little to rate") + '"><span class="sra-np">' + (c.rev / c.sp).toFixed(1) + "×</span></td>";
                return '<td class="num" title="' + esc(money0(c.sp) + " spend · " + money0(c.rev) + " revenue · " + c.jobs + " jobs") + '">' + xTxt(c.rev, c.sp) + "</td>";
              }).join("")
            + '<td class="num">' + (F.unpl > 0.5 ? money0(F.unpl) : '<span class="sra-np">—</span>') + "</td>"
            + '<td class="num" title="' + esc(money0(revF) + " revenue ÷ " + money0(spF) + " spend") + '">' + xTxt(revF, spF) + "</td></tr>";
        }).join("")
      + "</tbody></table></div></div>";
    el.innerHTML = '<div class="panel">' + hint + '<div class="rs-kpis" id="sraRoasK"></div></div>'
      + '<div class="rs-grid2">' + stTable + missingHtml(R) + "</div>" + mx;
    RSC.kpis(el.querySelector("#sraRoasK"), k);
    wireAmounts(host, el);
    // the split panel reads this period's numbers; after a save it opens the next source
    ROAS.R = R;
    if (ROAS.reopen && !ROAS.loadingAmts) {
      var nf = ROAS.reopen, ns = ROAS.reopenSel; ROAS.reopen = null; ROAS.reopenSel = null;
      openSplit(host, nf);
      if (SP && ns && SP.months.indexOf(ns) >= 0) { SP.sel = ns; drawSplit(host); }
    } else if (SP) drawSplit(host);
  }
  /* MISSING DATA: spend no rule can place, by source -- each opens the amounts editor -- and jobs
     with no state */
  function missingHtml(R) {
    var co = S.co;
    var fams = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; })
      .sort(function (a, b) { return R.unpl[b].sp - R.unpl[a].sp; });
    // sources whose unplaced spend in the period is all typed in now -- still listed, to change
    var done = !co ? [] : Object.keys(R.mon).filter(function (f) { return fams.indexOf(f) < 0 && typedIn(co, f, R).length; }).sort();
    var row = function (f, all) {
      var U = R.unpl[f] || { sp: 0, months: {} }, ms = Object.keys(U.months).sort(), open = !!SP && SP.fam === f;
      var t = co ? typedIn(co, f, R) : [], tot = 0;
      t.forEach(function (ym) { amtOf(co, f, ym).forEach(function (x) { tot += num(x.Amount); }); });
      return "<tr" + (open ? ' class="sra-ed"' : "") + "><td>" + esc(f)
        + (t.length ? '<small class="sra-np" style="display:block">' + money0(tot) + " typed in " + t.length + " month" + (t.length === 1 ? "" : "s") + "</small>" : "") + "</td>"
        + '<td class="num' + (all ? " sra-np" : "") + '">' + (all ? "all placed" : money0(U.sp))
        + "<small>" + (all ? "by your amounts" : ms.length + " month" + (ms.length === 1 ? "" : "s")
          + (ms.length ? ", " + esc(monthLbl(ms[0])) + (ms.length > 1 ? "–" + esc(monthLbl(ms[ms.length - 1])) : "") : "")) + "</small></td>"
        + '<td style="text-align:right">' + (co ? '<button type="button" class="rs-btn" data-amt="' + esc(f) + '">'
          + (t.length ? "Change split" : "Split by state") + "</button>" : "") + "</td></tr>";
    };
    var over = R.over || [];
    var NS = R.noState;
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Missing data</span></div>'
      + '<div class="rs-hint">Spend no rule can place in a state. Open a source and say how it splits across the states: one '
      + "split for the whole period, starting from where that source's leads came from. What you leave out stays not placed. "
      + "Its return counts by state at once. "
      + (co ? "" : "<b>Pick one company in the bar to split spend.</b> ")
      + (ROAS.note ? "<b>" + esc(ROAS.note) + "</b> " : "")
      + (ROAS.amtErr ? "Saved amounts could not be read (" + esc(ROAS.amtErr.message) + "). " : "")
      + (over.length ? '<b class="sra-amt-msg bad">More typed than the month now has:</b> ' + over.slice(0, 6).map(function (o) {
          return esc(o.fam + " " + monthLbl(o.ym)) + " (" + money0(o.typed) + " typed, " + money0(o.spend) + " not placed)";
        }).join(" · ") + " — scaled down to fit; change the amounts. " : "") + "</div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">Not placed</th><th></th></tr></thead><tbody>'
      + (fams.map(function (f) { return row(f, false); }).join("") || '<tr><td colspan="3" class="sra-np">Every ad dollar in the period is placed in a state.</td></tr>')
      + done.map(function (f) { return row(f, true); }).join("")
      + "</tbody></table></div>"
      + '<div class="rs-hint" style="margin-top:10px">' + (NS.n
          ? "<b>" + fmtN(NS.n) + " closing" + (NS.n === 1 ? "" : "s") + " with no state</b> (" + money0(NS.rev) + " billed) count toward no state: "
            + NS.rows.slice(0, 12).map(function (r) { return esc((r["Unique Key"] || "") + " · " + niceDay(r._d)); }).join(", ") + (NS.n > 12 ? " …" : "")
            + ". The state comes from the closing's pickup zip; fixing the zip on the closing sheet fixes it here."
          : "Every closing in the period has a state.") + "</div></div>";
  }
  /* THE SPLIT PANEL, MONTH BY MONTH (his notes 2026-10-20 on the first version):
     - "where its leads came from is kinda confusing": a state with fewer than 3 leads in the month
       is left at 0, and nothing is prefilled when the panel opens.
     - "month selection should be a must": a month is picked before anything can be split; every
       month has its own split.
     - "you have to memorize that you did first month": every month is a chip that turns green
       when it is fully split (amber part-way, red over 100%), so where you are is always visible.
     - "more modern selectors, chips": states are chips you switch on, each with a slider.
     - "copy distribution from previous month": one click.
     The endpoint is unchanged: share x each month's unplaced spend = the dollars /api/_mktamount
     stores, rounded to the cent and never more than the month has; only changed months are sent.
     The panel lives on <body>, walks the Missing data list by dollars ("Save and next"), and
     closes when the page is left. */
  var SP = null;   // {fam, base:{ym:sp}, months:[ym], pct:{ym:{st:p}}, sel:ym|null, note}
  var MIN_LEADS = 3;
  var ST_COL = { NJ: "#2F6B4F", PA: "#7A9A3A", NY: "#B8862E", CT: "#3A6EA5", DE: "#8B5A9E", MD: "#B5523B", MA: "#5E7C8A", VA: "#9A8F6E" };
  function r1(v) { return Math.round(v * 10) / 10; }
  function pctSum(P) { var t = 0; Object.keys(P || {}).forEach(function (k) { t += P[k] || 0; }); return r1(t); }
  // whole-number weights -> shares that add to exactly 100.0 (the rounding goes to the biggest)
  function pctOf(n) {
    var ks = AMT_STATES.filter(function (s0) { return n[s0] > 0; }), t = 0, o = {};
    ks.forEach(function (k) { t += n[k]; });
    if (!t) return o;
    ks.forEach(function (k) { o[k] = r1(100 * n[k] / t); });
    var big = ks.slice().sort(function (a, b) { return o[b] - o[a]; })[0];
    o[big] = r1(o[big] + 100 - pctSum(o));
    return o;
  }
  // the source's leads in one month by state (the eight states only); under MIN_LEADS counts as none
  function monthLeads(f, ym) {
    var pack = DATA.byFam.get(f), n = {}, kept = {}, t = 0;
    if (pack) pack.leads.forEach(function (r) {
      if (!coOk(r) || !r._cd || r._cd.slice(0, 7) !== ym) return;
      var s0 = stateKey(r.State);
      if (AMT_STATES.indexOf(s0) >= 0) n[s0] = (n[s0] || 0) + 1;
    });
    AMT_STATES.forEach(function (s0) { if (n[s0] >= MIN_LEADS) { kept[s0] = n[s0]; t += n[s0]; } });
    return { n: n, kept: kept, t: t };
  }
  function splitQueue(R) {
    var co = S.co;
    var open = Object.keys(R.unpl).filter(function (f) { return R.unpl[f].sp > 0.5; })
      .sort(function (a, b) { return R.unpl[b].sp - R.unpl[a].sp; });
    var done = !co ? [] : Object.keys(R.mon).filter(function (f) { return open.indexOf(f) < 0 && typedIn(co, f, R).length; }).sort();
    return open.concat(done);
  }
  // the dollars saved for a month, as shares of that month's unplaced spend
  function savedPct(f, ym, sp) {
    var o = {};
    amtOf(S.co, f, ym).forEach(function (x) { if (sp > 0 && num(x.Amount) > 0) o[x.State] = r1(100 * num(x.Amount) / sp); });
    return o;
  }
  function monthState(P) {
    var t = pctSum(P);
    return t > 100.05 ? "over" : t >= 99.95 ? "full" : t > 0 ? "part" : "blank";
  }
  // shares -> cents per state for each month, never more than the month's unplaced spend
  function splitDollars(P, sp) {
    var a = [], s = 0;
    AMT_STATES.forEach(function (s0) {
      var p = P[s0] || 0;
      if (p > 0) { var v = Math.round(sp * p) / 100; if (v > 0) { a.push({ state: s0, amount: v }); s += v; } }
    });
    if (s > sp && a.length) {
      a.sort(function (x, y) { return y.amount - x.amount; });
      a[0].amount = Math.round((a[0].amount - (s - sp)) * 100) / 100;
    }
    return a.sort(function (x, y) { return x.state < y.state ? -1 : 1; });
  }
  function dollarKey(a) {
    return a.map(function (x) { return (x.state || x.State) + ":" + num(x.amount != null ? x.amount : x.Amount).toFixed(2); }).sort().join("|");
  }
  // the months whose split differs from what is saved -- what a save sends
  function changedMonths() {
    return SP.months.filter(function (ym) {
      return dollarKey(splitDollars(SP.pct[ym] || {}, SP.base[ym])) !== dollarKey(amtOf(S.co, SP.fam, ym));
    });
  }
  function openSplit(host, f) {
    var R = ROAS.R;
    if (!R || !S.co) return;
    var base = R.mon[f] || {};
    var months = Object.keys(base).filter(function (ym) { return base[ym] > 0.5; }).sort();
    // blank on open: a month shows what was saved for it, nothing else
    SP = { fam: f, base: base, months: months, pct: {}, sel: null, note: "" };
    months.forEach(function (ym) { SP.pct[ym] = savedPct(f, ym, base[ym]); });
    drawSplit(host);
  }
  function closeSplit(host) {
    SP = null;
    var ov = document.getElementById("sraSplitOv");
    if (ov) ov.remove();
    if (host && host.isConnected && host.querySelector("#sraRoas")) paintRoas(host, win());
  }
  function drawSplit(host) {
    var R = ROAS.R, ov = document.getElementById("sraSplitOv");
    if (!SP || !R) { if (ov) ov.remove(); return; }
    if (!ov) {
      ov = document.createElement("div");
      ov.id = "sraSplitOv"; ov.className = "sra-ov";
      ov.innerHTML = '<div class="sra-dr" role="dialog" aria-modal="true" aria-label="Split by state"></div>';
      document.body.appendChild(ov);
      var onk = function (e) { if (e.key === "Escape" && document.getElementById("sraSplitOv")) leave(); };
      var leave = function () {
        if (SP && changedMonths().length && !window.confirm("Close without saving the " + SP.fam + " split?")) return;
        document.removeEventListener("keydown", onk);
        window.removeEventListener("hashchange", gone);
        closeSplit(host);
      };
      // leaving the page takes the panel with it: it lives on <body>, outside the page host
      var gone = function () { document.removeEventListener("keydown", onk); SP = null; var o = document.getElementById("sraSplitOv"); if (o) o.remove(); };
      document.addEventListener("keydown", onk);
      window.addEventListener("hashchange", gone, { once: true });
      ov.addEventListener("click", function (e) { if (e.target === ov) leave(); });
      ov._leave = leave;
    }
    var f = SP.fam, Q = splitQueue(R), qi = Q.indexOf(f), next = Q[qi + 1] || null;
    var sel = SP.sel, si = sel ? SP.months.indexOf(sel) : -1;
    var prev = si > 0 ? SP.months[si - 1] : null, nextM = si >= 0 && si < SP.months.length - 1 ? SP.months[si + 1] : null;
    var spOf = function (ym) { return SP.base[ym] || 0; };
    var cur = function () { return sel ? (SP.pct[sel] = SP.pct[sel] || {}) : {}; };
    var all = 0; SP.months.forEach(function (ym) { all += spOf(ym); });
    var nFull = SP.months.filter(function (ym) { return monthState(SP.pct[ym]) === "full"; }).length;
    var span = SP.months.length ? monthLbl(SP.months[0]) + (SP.months.length > 1 ? "–" + monthLbl(SP.months[SP.months.length - 1]) : "") : "";
    var L = sel ? monthLeads(f, sel) : null;
    var chg = changedMonths().length;

    var monthChip = function (ym) {
      var st = monthState(SP.pct[ym]), t = Math.min(100, pctSum(SP.pct[ym]));
      return '<button type="button" class="sra-mc ' + st + (sel === ym ? " on" : "") + '" data-ym="' + esc(ym) + '" aria-pressed="' + (sel === ym) + '">'
        + '<span class="sra-mc-l">' + esc(monthLbl(ym)) + "</span>"
        + '<span class="sra-mc-v">' + (st === "full" ? "✓ " : "") + money0(spOf(ym)) + "</span>"
        + '<span class="sra-mc-p">' + (st === "blank" ? "not split" : st === "over" ? pctSum(SP.pct[ym]) + "%, over" : t + "%") + "</span></button>";
    };
    var stateChip = function (s0) {
      var P = cur(), on = P[s0] != null, ln = L ? (L.n[s0] || 0) : 0;
      return '<button type="button" class="sra-sc' + (on ? " on" : "") + '" data-tog="' + s0 + '" aria-pressed="' + on + '" style="--c:' + ST_COL[s0] + '">'
        + '<i></i>' + s0 + (on ? " · " + (P[s0] || 0) + "%" : "") + (ln ? '<small title="' + ln + " lead" + (ln === 1 ? "" : "s") + " this month" + '">' + ln + "</small>" : "") + "</button>";
    };
    var rowsHtml = function () {
      var P = cur(), on = AMT_STATES.filter(function (s0) { return P[s0] != null; });
      if (!on.length) return '<div class="sra-empty2">Switch on the states this month\'s ' + esc(f) + " money went to, or fill it from a button above.</div>";
      return on.map(function (s0) {
        var p = P[s0] || 0;
        return '<div class="sra-sr" style="--c:' + ST_COL[s0] + '"><b><i></i>' + s0 + "</b>"
          + '<input type="range" min="0" max="100" step="0.5" value="' + p + '" data-st="' + s0 + '" aria-label="' + s0 + ' share">'
          + '<input class="rs-inp" inputmode="decimal" value="' + (p ? p : "") + '" placeholder="0" data-pc="' + s0 + '" aria-label="' + s0 + ' percent"><span>%</span>'
          + '<span class="num">' + money0(spOf(sel) * p / 100) + "</span>"
          + '<button type="button" class="sra-rm" data-tog="' + s0 + '" aria-label="Remove ' + s0 + '">✕</button></div>';
      }).join("");
    };
    var barHtml = function () {
      var P = cur();
      return AMT_STATES.map(function (s0) {
        var p = P[s0] || 0;
        return p > 0 ? '<i style="width:' + Math.min(100, p) + "%;background:" + ST_COL[s0] + '" title="' + s0 + " " + p + '%"></i>' : "";
      }).join("");
    };
    var sumHtml = function () {
      var P = cur(), t = pctSum(P), sp = spOf(sel);
      return t > 100.05 ? '<span class="bad">' + t + "% — bring it down to 100%.</span>"
        : t >= 99.95 ? '<span class="ok">✓ 100% — all ' + money0(sp) + " of " + esc(monthLbl(sel)) + " placed.</span>"
        : t > 0 ? "<span>" + t + "% — " + money0(sp * (100 - t) / 100) + " left to place.</span>"
        : "<span>Nothing placed yet.</span>";
    };

    var body;
    if (!SP.months.length) body = '<div class="rs-hint">No month of the period has ' + esc(f) + " spend left to place.</div>";
    else if (!sel) body = '<div class="sra-pick"><b>Pick a month</b> to split it. A month turns <span class="g">green</span> when it\'s fully split'
      + ' and <span class="a">amber</span> while part of it is still not placed.</div>';
    else {
      var fills = '<button type="button" class="sra-fc" data-fill="leads"' + (L.t ? "" : ' title="No state had ' + MIN_LEADS + ' or more ' + esc(f) + ' leads this month"') + ">"
          + "Its leads" + (L.t ? " <small>" + fmtN(L.t) + "</small>" : " <small>too few</small>") + "</button>"
        + (prev ? '<button type="button" class="sra-fc" data-fill="prev">Copy from ' + esc(monthLbl(prev)) + (monthState(SP.pct[prev]) === "blank" ? " <small>empty</small>" : "") + "</button>" : "")
        + '<button type="button" class="sra-fc" data-fill="even">Even</button>'
        + '<button type="button" class="sra-fc" data-fill="clear">Clear</button>';
      body = '<div class="sra-mh2"><div><b>' + esc(monthLbl(sel)) + "</b> · " + money0(spOf(sel)) + " not placed by the data</div>"
          + (nextM ? '<button type="button" class="sra-nx" data-ym="' + esc(nextM) + '">' + esc(monthLbl(nextM)) + " →</button>" : "") + "</div>"
        + '<div class="sra-fills"><span>Fill from</span>' + fills + "</div>"
        + (SP.note ? '<div class="sra-note">' + esc(SP.note) + "</div>" : "")
        + '<div class="sra-scs">' + AMT_STATES.map(stateChip).join("") + "</div>"
        + '<div class="sra-bar">' + barHtml() + "</div>"
        + '<div class="sra-srs">' + rowsHtml() + "</div>"
        + '<div class="sra-sum">' + sumHtml() + "</div>";
    }

    var dr = ov.querySelector(".sra-dr");
    dr.innerHTML = '<div class="sra-dr-h"><div><div class="sra-dr-t">' + esc(f) + " · split by state</div>"
        + '<div class="sra-dr-s">' + money0(all) + " not placed by the data · " + esc(span)
        + (Q.length > 1 ? " · source " + (qi + 1) + " of " + Q.length : "") + "</div></div>"
        + '<button type="button" class="sra-xb" data-x="1" aria-label="Close">✕</button></div>'
      + (Q.length > 1 ? '<div class="sra-q">' + Q.map(function (q) {
          var u = R.unpl[q];
          return '<button type="button" class="sra-qc' + (q === f ? " on" : "") + (u && u.sp > 0.5 ? "" : " done") + '" data-q="' + esc(q) + '">'
            + (u && u.sp > 0.5 ? "" : "✓ ") + esc(q) + " <small>" + (u && u.sp > 0.5 ? money0(u.sp) : "placed") + "</small></button>";
        }).join("") + "</div>" : "")
      + (SP.months.length ? '<div class="sra-msh"><b>Months</b><small>' + nFull + " of " + SP.months.length + " fully split</small></div>"
        + '<div class="sra-mcs">' + SP.months.map(monthChip).join("") + "</div>" : "")
      + body
      + '<div class="sra-dr-f"><span class="sra-amt-msg">' + (chg ? chg + " month" + (chg === 1 ? "" : "s") + " not saved yet" : "") + "</span>"
        + (next ? '<button type="button" class="rs-btn" data-skip="1">Skip</button>' : "")
        + (SP.months.length ? '<button type="button" class="rs-btn' + (next ? "" : " pri") + '" data-save="0">Save</button>'
          + (next ? '<button type="button" class="rs-btn pri" data-save="1">Save and next: ' + esc(next) + "</button>" : "") : "")
      + "</div>";

    var redraw = function () { SP.note = ""; drawSplit(host); };
    // dragging must not rebuild the panel (a rebuilt slider drops the drag): only the numbers move
    var live = function () {
      var P = cur();
      dr.querySelectorAll(".sra-sr").forEach(function (row) {
        var rg = row.querySelector("input[data-st]"), pc = row.querySelector("input[data-pc]"), s0 = rg.dataset.st, p = P[s0] || 0;
        if (document.activeElement !== rg) rg.value = p;
        if (document.activeElement !== pc) pc.value = p ? p : "";
        row.querySelector(".num").textContent = money0(spOf(sel) * p / 100);
      });
      dr.querySelectorAll(".sra-sc").forEach(function (c) {
        var s0 = c.dataset.tog; if (P[s0] == null) return;
        var sm = c.querySelector("small");
        c.innerHTML = "<i></i>" + s0 + " · " + (P[s0] || 0) + "%";
        if (sm) c.appendChild(sm);
      });
      dr.querySelector(".sra-bar").innerHTML = barHtml();
      dr.querySelector(".sra-sum").innerHTML = sumHtml();
      var mc = dr.querySelector('.sra-mc[data-ym="' + sel + '"]');
      if (mc) { var tmp = document.createElement("div"); tmp.innerHTML = monthChip(sel); mc.className = tmp.firstChild.className; mc.innerHTML = tmp.firstChild.innerHTML; }
      var n2 = SP.months.filter(function (ym) { return monthState(SP.pct[ym]) === "full"; }).length;
      dr.querySelector(".sra-msh small").textContent = n2 + " of " + SP.months.length + " fully split";
      var c2 = changedMonths().length;
      dr.querySelector(".sra-dr-f .sra-amt-msg").textContent = c2 ? c2 + " month" + (c2 === 1 ? "" : "s") + " not saved yet" : "";
    };
    var setP = function (s0, v) { var P = cur(); P[s0] = Math.max(0, Math.min(100, r1(v || 0))); };
    dr.querySelectorAll("input[data-st]").forEach(function (i) {
      i.oninput = function () { setP(i.dataset.st, +i.value); live(); };
    });
    dr.querySelectorAll("input[data-pc]").forEach(function (i) {
      i.oninput = function () { setP(i.dataset.pc, parseFloat(String(i.value).replace(/[%,\s]/g, "")) || 0); live(); };
      i.onblur = function () { var P = cur(); i.value = P[i.dataset.pc] || ""; };
    });
    // a state switched on takes what is left of the month; switched off, it gives its share back
    dr.querySelectorAll("[data-tog]").forEach(function (b) {
      b.onclick = function () {
        var P = cur(), s0 = b.dataset.tog;
        if (P[s0] != null) delete P[s0];
        else P[s0] = Math.max(0, r1(100 - pctSum(P)));
        redraw();
      };
    });
    dr.querySelectorAll("[data-fill]").forEach(function (b) {
      b.onclick = function () {
        var how = b.dataset.fill, P;
        if (how === "leads") {
          if (!L.t) { SP.note = "No state had " + MIN_LEADS + " or more " + f + " leads in " + monthLbl(sel) + ". Switch the states on yourself."; drawSplit(host); return; }
          SP.pct[sel] = pctOf(L.kept);
        } else if (how === "prev") {
          if (monthState(SP.pct[prev]) === "blank") { SP.note = monthLbl(prev) + " has no split to copy yet."; drawSplit(host); return; }
          SP.pct[sel] = Object.assign({}, SP.pct[prev]);
        } else if (how === "even") {
          P = cur();
          var on = AMT_STATES.filter(function (s0) { return P[s0] != null; });
          if (!on.length) on = AMT_STATES.filter(function (s0) { return L.kept[s0]; });
          if (!on.length) { SP.note = "Switch on the states first, then split them evenly."; drawSplit(host); return; }
          var o = {}; on.forEach(function (s0) { o[s0] = 1; });
          SP.pct[sel] = pctOf(o);
        } else SP.pct[sel] = {};
        redraw();
      };
    });
    dr.querySelectorAll("[data-ym]").forEach(function (b) {
      b.onclick = function () { SP.sel = SP.sel === b.dataset.ym && !b.classList.contains("sra-nx") ? null : b.dataset.ym; redraw(); };
    });
    dr.querySelector("[data-x]").onclick = function () { ov._leave(); };
    dr.querySelectorAll("[data-q]").forEach(function (b) {
      b.onclick = function () {
        if (b.dataset.q === f) return;
        if (changedMonths().length && !window.confirm("Leave the " + f + " split without saving?")) return;
        openSplit(host, b.dataset.q);
      };
    });
    var sk = dr.querySelector("[data-skip]");
    if (sk) sk.onclick = function () {
      if (changedMonths().length && !window.confirm("Skip " + f + " without saving?")) return;
      openSplit(host, next);
    };
    dr.querySelectorAll("[data-save]").forEach(function (b) {
      b.onclick = function () { saveSplit(host, dr, b.dataset.save === "1" ? next : null); };
    });
  }
  function saveSplit(host, dr, next) {
    var f = SP.fam, msg = dr.querySelector(".sra-dr-f .sra-amt-msg"), months = [], bad = [];
    SP.months.forEach(function (ym) { if (monthState(SP.pct[ym]) === "over") bad.push(monthLbl(ym)); });
    msg.classList.remove("bad");
    if (bad.length) { msg.textContent = "Over 100% in " + bad.join(", ") + " — bring it down to save."; msg.classList.add("bad"); return; }
    changedMonths().forEach(function (ym) { months.push({ month: ym, amounts: splitDollars(SP.pct[ym] || {}, SP.base[ym]) }); });
    if (!months.length) {
      if (next) { openSplit(host, next); return; }
      msg.textContent = "Nothing changed."; return;
    }
    msg.textContent = "Saving…";
    fetch(ZTZ.API + "/api/_mktamount", {
      method: "POST",
      headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
      body: JSON.stringify({ company: S.co, family: f, months: months }),
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) {
          if (j && j.code === "view_as_readonly") throw new Error("preview mode — amounts are not saved while viewing as someone else");
          throw new Error(j.error || ("HTTP " + r.status));
        }
        ROAS.note = f + ": " + months.length + " month" + (months.length === 1 ? "" : "s") + " saved.";
        // the same source stays open on the same month after a plain Save; "and next" moves on
        ROAS.reopen = next || f;
        ROAS.reopenSel = next ? null : SP.sel;
        loadAmounts(host);
      });
    }).catch(function (e) { msg.textContent = "Not saved: " + e.message; msg.classList.add("bad"); });
  }
  function wireAmounts(host, el) {
    el.querySelectorAll("[data-amt]").forEach(function (b) {
      b.onclick = function () { ROAS.note = ""; openSplit(host, b.dataset.amt); };
    });
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
    // the Filters panel: values counted on this source's leads in the period (company and
    // campaign as the bar has them), most first; a fixed list keeps its zeros, and a pick that
    // counts nothing here stays listed so it can still be unticked
    var lead0 = famPack().leads.filter(function (r) { return inR(r._cd, w.a, w.b); });
    var pfVals = function (fixed, keyOf, sel) {
      var g = {};
      (fixed || []).forEach(function (v) { g[v] = 0; });
      sel.forEach(function (v) { if (!(v in g)) g[v] = 0; });
      lead0.forEach(function (r) { var v = keyOf(r); if (v) g[v] = (g[v] || 0) + 1; });
      return Object.keys(g).sort(function (a, b) { return g[b] - g[a]; }).map(function (v) { return { v: v, l: v, n: g[v] }; });
    };
    var fields = [
      { key: "state", label: "Pickup state", values: pfVals(SERVICE_STATES.concat([OTHER_ST]), function (r) { return r._st; }, S.states) },
      { key: "mt", label: "Local / Long distance", values: pfVals(["Local", "Long distance"], function (r) { return r["Moving Type"]; }, S.mts) },
      { key: "size", label: "Size of move", values: pfVals(null, function (r) { return r["Size of Move"]; }, S.sizes) },
      { key: "rep", label: "Rep", values: pfVals(null, function (r) { return r.Rep; }, S.reps) },
    ];
    var sel = { state: S.states, mt: S.mts, size: S.sizes, rep: S.reps };
    var apply = function (next) {
      S.states = new Set(next.state); S.mts = new Set(next.mt); S.sizes = new Set(next.size); S.reps = new Set(next.rep);
      S.list.page = 0; paint(host);
    };
    RSC.filterPanel(host.querySelector("#sraFilt"), { fields: fields, selected: sel, onApply: apply,
      note: "Every number on this tab follows these. Spend and return lives on the <b>Return on ad spend</b> tab, "
        + "one row per source, with its own Sources and State filters." });
    RSC.filterChips(host.querySelector("#sraChips"), { fields: fields, selected: sel, onChange: apply });
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
    // Local / Long distance in the panel shows the side(s) picked; the share stays of all leads
    var SIDES = SIDES0.filter(function (s) { return !S.mts.size || S.mts.has(s[0]); });
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
    var mtName = !mtOne() ? "" : (mtOne() === "Long distance" ? " · long distance" : " · local");
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
  /* ---- SPEND AND RETURN, ONE ROW PER SOURCE (his pick 2026-10-19) ----
     Every paying source the tab's picks keep, for the company and the period up to the last posted
     ledger day (leads, bookings and jobs after it would read as free). Spend is the ledger's; under a
     State filter it is the spend PLACED in those states (the ROAS table's footing) and leads, bookings,
     jobs and cash are the same states'. Cash = Net Cash + Card of the source's jobs by move date, the
     Monthly Report's basis; revenue per $1 is the ROAS table's (Total Bill). Under them, the months. */
  function paintSpendAll(host, w) {
    var el = host.querySelector("#sraSpendAll"), pills = host.querySelector("#sraSpendPills");
    if (!el) return;
    var R = roasCalc(w), e = R.e, PS = S.roiStates.size ? S.roiStates : null;
    var stIn = function (st) { return !PS || PS.has(st); };
    var famList = Object.keys(R.fams).filter(function (f) { return R.fams[f].sp > 0.5; });
    var rows = famList.map(function (f) {
      var F = R.fams[f], sp = 0, rev = 0;
      if (PS) Object.keys(F.st).forEach(function (st) { var c = F.st[st]; if (stIn(st) && c.sp > 0) { sp += c.sp; rev += c.rev; } });
      else { sp = F.sp; Object.keys(F.st).forEach(function (st) { rev += F.st[st].rev; }); }
      var v = DATA.byFam.get(f) || { leads: [], jobs: [] }, leads = 0, conf = 0, jobs = 0, cash = 0;
      v.leads.forEach(function (r) {
        if (!coOk(r) || !stIn(r._st)) return;
        if (inR(r._cd, w.a, e)) leads++;
        if (inR(r._bd, w.a, e)) conf++;
      });
      v.jobs.forEach(function (r) {
        if (!coOk(r) || !stIn(r._st) || !inR(r._d, w.a, e)) return;
        if (r["Record Source"] === "closing") jobs++;
        cash += num(r.Cash);
      });
      return { f: f, sp: sp, rev: rev, leads: leads, conf: conf, jobs: jobs, cash: cash, unpl: F.unpl };
    }).filter(function (x) { return x.sp > 0.5 || x.leads || x.jobs; })
      .sort(function (a, b) { return b.sp - a.sp || a.f.localeCompare(b.f); });
    var T = rows.reduce(function (a, x) { a.sp += x.sp; a.rev += x.rev; a.leads += x.leads; a.conf += x.conf; a.jobs += x.jobs; a.cash += x.cash; return a; },
      { sp: 0, rev: 0, leads: 0, conf: 0, jobs: 0, cash: 0 });
    if (pills) pills.innerHTML = DATA.ledgerEnd ? '<span class="rs-pill info">spend through ' + esc(niceDay(DATA.ledgerEnd)) + "</span>" : "";
    var per = function (a, b) { return b > 0 && a ? money0(b / a) : '<span class="sra-np">—</span>'; };
    var cashX = function (cash, sp) {
      if (!(sp > 0)) return '<span class="sra-np">—</span>';
      var x = cash / sp;
      return '<span class="sra-x ' + (x >= 5 ? "hi" : x < 1 ? "lo" : "") + '">$' + x.toFixed(2) + "</span>";
    };
    var cells = function (x) {
      return '<td class="num">' + money0(x.sp) + '</td><td class="num">' + fmtN(x.leads) + '</td><td class="num">' + per(x.leads, x.sp)
        + '</td><td class="num">' + fmtN(x.conf) + '</td><td class="num">' + per(x.conf, x.sp)
        + '</td><td class="num">' + fmtN(x.jobs) + '</td><td class="num">' + money0(x.cash) + '</td><td class="num">' + cashX(x.cash, x.sp)
        + '</td><td class="num">' + xTxt(x.rev, x.sp) + "</td>";
    };
    var table = '<div class="panel"><div class="rs-hint">'
      + (R.clipped ? "Up to <b>" + esc(niceDay(e)) + "</b>, the last day the advertising ledger is posted — leads, bookings and jobs after it "
          + "would read as free, so they are left out. " : "For the period. ")
      + (PS ? "Spend is what is <b>placed</b> in " + esc(Array.from(PS).join(", ")) + " (spend no rule can place has no state and is not in it); "
            + "leads, bookings, jobs and cash are the same states'. " : "Spend is each source's whole advertising ledger. ")
      + "Cash is Net Cash + Card of the source's jobs, by move date. Revenue per $1 is the table above's (Total Bill ÷ spend).</div>"
      + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Source</th><th class="num">' + (PS ? "Spend placed" : "Ad spend") + "</th>"
      + '<th class="num">Leads</th><th class="num">Cost per lead</th><th class="num">Booked</th><th class="num">Cost per booking</th>'
      + '<th class="num">Jobs moved</th><th class="num">Cash collected</th><th class="num">Cash per $1</th><th class="num">Revenue per $1</th></tr></thead><tbody>'
      + (rows.length ? rows.map(function (x) { return "<tr><td>" + esc(x.f) + "</td>" + cells(x) + "</tr>"; }).join("")
          : '<tr><td colspan="10" class="sra-np">No ad spend on file for these picks.</td></tr>')
      + '</tbody><tfoot><tr class="sra-tot"><td>' + (rows.length === 1 ? "Total" : "All " + rows.length + " sources") + "</td>" + cells(T) + "</tr></tfoot></table></div></div>";
    el.innerHTML = table;
    // the months: spend and cash for the sources picked (bars only -- a post card paid in one lump
    // makes a monthly ratio mostly zeros and one spike)
    var ms = monthsOf(w.a, w.bEff);
    if (ms.length > 48) ms = ms.slice(-48);
    var spM = {}, cashM = {}, jobsM = {}, ledM = DATA.ledgerEnd ? DATA.ledgerEnd.slice(0, 7) : null;
    var keep = {}; rows.forEach(function (x) { keep[x.f] = 1; });
    if (PS) {
      (ROAS.rows || []).forEach(function (r) {
        if ((S.co && r.co !== S.co) || !keep[r.fam] || r.how === "Not placed" || !PS.has(stateKey(r.st))) return;
        var m = r._m.slice(0, 7); spM[m] = (spM[m] || 0) + r.sp;
      });
    } else {
      rows.forEach(function (x) {
        ((DATA.byFam.get(x.f) || { spend: [] }).spend).forEach(function (r) {
          if (!coOk(r) || !inR(r._d, w.a, w.bEff)) return;
          var m = r._d.slice(0, 7); spM[m] = (spM[m] || 0) + r._sp;
        });
      });
    }
    rows.forEach(function (x) {
      ((DATA.byFam.get(x.f) || { jobs: [] }).jobs).forEach(function (r) {
        if (!coOk(r) || !stIn(r._st) || !inR(r._d, w.a, w.bEff)) return;
        var m = r._d.slice(0, 7);
        cashM[m] = (cashM[m] || 0) + num(r.Cash);
        if (r["Record Source"] === "closing") jobsM[m] = (jobsM[m] || 0) + 1;
      });
    });
    RSC.chartCard(el, {
      title: "Ad spend and cash collected, by month" + (S.roiFams.size ? " · " + Array.from(S.roiFams).join(", ") : " · every paying source"),
      key: "sra-spend-all",
      buildChart: function (canvas) {
        var C = palette();
        return new Chart(canvas, {
          type: "bar",
          data: { labels: ms.map(monthLbl), datasets: [
            { label: "Ad spend (right axis)", data: ms.map(function (m) { return ledM && m > ledM ? null : Math.round(spM[m] || 0); }),
              backgroundColor: C.violet, yAxisID: "y1" },
            { label: "Cash collected (left axis)", data: ms.map(function (m) { return Math.round(cashM[m] || 0); }),
              backgroundColor: C.brand, yAxisID: "y" },
          ] },
          options: { responsive: true, maintainAspectRatio: false,
                     interaction: { mode: "index", intersect: false },
                     scales: {
                       y: { beginAtZero: true, position: "left", title: { display: true, text: "Cash collected", color: C.muted },
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
                + (late ? '<td class="num dim">not posted</td>' : '<td class="num">' + money0(spM[m] || 0) + "</td>")
                + '<td class="num">' + money0(cashM[m] || 0) + '</td><td class="num">' + fmtN(jobsM[m] || 0) + "</td></tr>";
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
    var mtName = !mtOne() ? "Local and long distance" : (mtOne() === "Long distance" ? "Long distance only" : "Local only");
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
      if (list && host.isConnected) paintList(host, win(), famPack().leads.filter(leadOk));
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
      if (host.isConnected && detailKey(win()) === key) paintList(host, win(), famPack().leads.filter(leadOk));
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
    var mtName = !mtOne() ? "" : (mtOne() === "Long distance" ? " · long distance" : " · local");
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
          return '<tr data-lead="' + esc(r["Request Joinkey"] || "") + '" style="cursor:pointer" title="Open the lead file">' + cols.map(function (c) {
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
