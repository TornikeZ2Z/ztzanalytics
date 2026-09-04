/* SALES PERSON OF THE MONTH — the whole score, and not one hand-typed number in it.
 *
 * Foreman of the Month splits 60 counted / 40 assessed, because half of what a foreman does
 * happens where no system is watching. A salesperson's month is the opposite: every part of
 * it already leaves a trace. The leads they were handed, what they did with them, how fast
 * they picked up the phone, what the jobs earned, what came back as a claim. So there is
 * nothing here to rate by hand, and no rating panel — the page is a reading of the record.
 *
 * THE MODEL IS THE ONE SALES PERSON ANALYSIS ALREADY USES, not a new invention. Six topics,
 * the same six weights, and each rep placed by their PERCENTILE inside that month's own pool
 * rather than against an absolute bar. That shape is deliberate: "profit per lead" has no
 * natural out-of-ten, and a month when every lead was hard should not mark everybody down.
 * What a percentile says is narrower and truer — of the people working the same month, where
 * did this one stand.
 *
 * WHY EVERY NUMBER IS A COHORT NUMBER. A lead belongs to the month it ARRIVED in, and every
 * question is asked of that same set of leads. It is the only basis the warehouse can answer
 * — there is no confirmed-date column on the lead journey — and it is the basis the
 * conversion topic requires anyway, since expected and actual have to be read over the same
 * leads or the comparison stops measuring skill. The price is that a young month keeps
 * growing: a fifth of the leads that eventually close do so more than a month after they
 * came in. The page says so on its face rather than letting a half-grown month read as a
 * verdict.
 *
 * TWENTY LEADS TO BE RANKED. Below that a month is not a performance, it is a sample, and
 * the estimator who caught nine stray leads would otherwise land in the ranking beside
 * someone who worked two hundred. They are still listed, still shown, and told why.
 *
 * A REP WHO HAS SINCE LEFT KEEPS THE MONTHS THEY WORKED. The live Sales Person Analysis drops
 * departed reps from its pool, which is right for a page about the team as it stands today —
 * but this page is an archive of finished months, and rewriting last winter because someone
 * resigned in spring would be a lie about what happened.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.sotm) {
    RS.DATASETS.sotm = {
      table: "mart_sales_scorecard",
      // PAYLOAD CONTRACT: a column missing from this list never arrives, however well the
      // page below is written — rs-core asks the bridge for exactly these names.
      cols: ["Month", "Month Date", "Sales Person",
             "Leads", "Qualified", "Dead", "Confirmed", "Closed", "Claims", "Tuji Leads",
             "Revenue", "Profit", "Dials", "Connected Calls",
             "Calls To These Leads", "Calls Per Lead",
             "Booking Rate", "Expected Rate", "Mix Gap", "Profit Per Lead", "Claim Rate",
             "Median TTO", "Connect Rate", "Dead Pct",
             "Pct Conversion", "Pct Profit", "Pct Quality", "Pct Speed", "Pct Effort",
             "Pct Qualification",
             "Points Conversion", "Points Profit", "Points Quality", "Points Speed",
             "Points Effort", "Points Qualification",
             "Weight Measured", "Score", "Verdict", "Ranked", "Not Ranked Because",
             "Rank", "Ranked Reps", "Roster Status", "Rep Type", "Months Matured"],
    };
  }
})();

registerPage({
  id: "sales-of-the-month",
  group: "sales",
  title: "Sales Person of the Month",
  subtitle: "Every point counted from the record — no one rates anybody here.",
  datasets: [],

  render(host) {
    const RSC = window.RSC || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])));
    const num = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
    const fmtN = n => (n == null ? "—" : Number(n).toLocaleString("en-US"));
    const fmt1 = n => (n == null ? "—" : Number(n).toFixed(1));
    const money0 = n => (n == null ? "—" : "$" + Math.round(n).toLocaleString("en-US"));
    const pct1 = n => (n == null ? "—" : Number(n).toFixed(1) + "%");

    /* THE SIX TOPICS, in the page's own order and the page's own words.
     * `w` is the weight, `pctf`/`ptsf` the mart columns, `read` turns the raw value into the
     * sentence a person would say out loud, and `hi` says which direction is good — it is
     * used ONLY for the month-on-month arrow, never for the score, which the mart settled. */
    const TOPICS = [
      { k: "conversion", label: "Conversion skill", w: 30, c: 1,
        pctf: "Pct Conversion", ptsf: "Points Conversion", raw: "Mix Gap", hi: true,
        blurb: "how far above or below the booking rate their own lead mix predicts",
        read: r => {
          const g = num(r["Mix Gap"]);
          if (g == null) return "no qualified leads to read";
          const s = (g >= 0 ? "+" : "−") + Math.abs(g).toFixed(1) + " pts";
          return s + " · booked " + pct1(num(r["Booking Rate"]))
            + " where the mix predicts " + pct1(num(r["Expected Rate"]));
        } },
      { k: "profit", label: "Profit per lead", w: 22, c: 2,
        pctf: "Pct Profit", ptsf: "Points Profit", raw: "Profit Per Lead", hi: true,
        blurb: "gross profit on the jobs that closed, spread over every lead handled",
        read: r => {
          const v = num(r["Profit Per Lead"]);
          if (v == null) return "no profit filed on these jobs";
          return money0(v) + " a lead · " + money0(num(r["Profit"])) + " over "
            + fmtN(num(r["Leads"])) + " leads";
        } },
      { k: "quality", label: "Quality", w: 12, c: 3,
        pctf: "Pct Quality", ptsf: "Points Quality", raw: "Claim Rate", hi: false,
        blurb: "claims raised against the jobs they sold",
        read: r => {
          const v = num(r["Claim Rate"]), cl = num(r["Closed"]), n = num(r["Claims"]);
          if (v == null) return "nothing closed yet — nothing to judge";
          if (!n) return "a clean month — no claims on " + fmtN(cl) + " closed jobs";
          return fmtN(n) + " claim" + (n === 1 ? "" : "s") + " on " + fmtN(cl)
            + " closed jobs · " + (v * 100).toFixed(1) + " per 100";
        } },
      { k: "speed", label: "First-call speed", w: 14, c: 4,
        pctf: "Pct Speed", ptsf: "Points Speed", raw: "Median TTO", hi: false,
        blurb: "the middle lead's wait for a first outbound call, in business minutes",
        read: r => {
          const v = num(r["Median TTO"]);
          if (v == null) return "no first-call times on file";
          return (v < 90 ? Math.round(v) + " min" : (v / 60).toFixed(1) + " h") + " to the median lead";
        } },
      { k: "effort", label: "Call effort", w: 14, c: 5,
        pctf: "Pct Effort", ptsf: "Points Effort", raw: "Connect Rate", hi: true,
        blurb: "outbound calls that connected, from RingCentral's own log",
        read: r => {
          const v = num(r["Connect Rate"]), d = num(r["Dials"]);
          if (v == null) return d ? "only " + fmtN(d) + " dials — too few to rank"
                                  : "no calls found under this name";
          return pct1(v) + " of " + fmtN(d) + " dials connected";
        } },
      { k: "qualification", label: "Lead qualification", w: 8, c: 6,
        pctf: "Pct Qualification", ptsf: "Points Qualification", raw: "Dead Pct", hi: false,
        blurb: "share of their leads written off as bad",
        read: r => {
          const v = num(r["Dead Pct"]);
          if (v == null) return "no leads to read";
          return pct1(v) + " written off · " + fmtN(num(r["Dead"])) + " of "
            + fmtN(num(r["Leads"]));
        } },
    ];

    /* THE PRINTED SHEET'S CSS, ONCE. The overlay writes it into this page's stylesheet and
     * the print document writes the same string into its own <head>, so what is on screen
     * and what comes out of the printer are the same rules, not two drifting copies. It uses
     * literal ink colours rather than the app's tokens on purpose: a standalone print
     * document defines none of them. */
    const SHEET_CSS =
      ".sm-sheet{width:210mm;min-height:297mm;background:#fff;color:#16181D;padding:14mm;"
      + "box-shadow:0 18px 60px rgba(0,0,0,.4);font-size:10.5px;line-height:1.45;"
      + "font-variant-numeric:tabular-nums}"
      + ".sm-sheet h1{font-size:20px;margin:0;letter-spacing:-.4px}"
      + ".sm-sheet .rhd{display:flex;align-items:flex-end;gap:12px;border-bottom:2px solid #16181D;"
      + "padding-bottom:9px;margin-bottom:13px}"
      + ".sm-sheet .rhd .sub{font-size:11px;color:#5B5F6B;margin-top:3px}"
      + ".sm-sheet .rhd .big{margin-left:auto;text-align:right;line-height:1}"
      + ".sm-sheet .rhd .big b{font-size:36px;font-weight:800;letter-spacing:-1.1px}"
      + ".sm-sheet .rhd .big i{display:block;font-style:normal;font-size:9px;font-weight:800;"
      + "letter-spacing:.08em;text-transform:uppercase;color:#7A7E88;margin-top:3px}"
      + ".sm-sheet .rstrip{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:13px}"
      + ".sm-sheet .rstrip>div{border:1px solid #DCDEE3;border-radius:5px;padding:8px 9px;"
      + "display:flex;flex-direction:column}"
      + ".sm-sheet .rstrip .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;"
      + "color:#7A7E88;line-height:1.25;flex:1}"
      + ".sm-sheet .rstrip .v{font-size:16px;font-weight:750;margin-top:2px}"
      + ".sm-sheet .rstrip .s{font-size:9px;color:#7A7E88;margin-top:2px}"
      + ".sm-sheet h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A7E88;"
      + "margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #DCDEE3}"
      + ".sm-sheet table{width:100%;border-collapse:collapse;margin-bottom:13px}"
      + ".sm-sheet th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;"
      + "color:#7A7E88;padding:4px 6px;border-bottom:1px solid #DCDEE3;font-weight:700}"
      + ".sm-sheet td{padding:5px 6px;border-bottom:1px solid #EFF0F3;vertical-align:top}"
      + ".sm-sheet td.n{text-align:right;white-space:nowrap}"
      + ".sm-sheet td.q{color:#7A7E88;font-size:9.5px}"
      + ".sm-sheet .bar{height:6px;border-radius:3px;background:#EFF0F3;overflow:hidden;margin-top:4px}"
      + ".sm-sheet .bar>i{display:block;height:100%;background:#5F7C20}"
      + ".sm-sheet .up{color:#5F7C20;font-style:normal;font-weight:750}"
      + ".sm-sheet .dn{color:#C0392B;font-style:normal;font-weight:750}"
      + ".sm-sheet .fl{color:#7A7E88;font-style:normal;font-weight:700}"
      + ".sm-sheet .foot{font-size:9px;color:#7A7E88;line-height:1.55;border-top:1px solid #DCDEE3;"
      + "padding-top:8px;margin-top:4px}";

    /* State survives leaving and re-entering the page, the way the assessment board does —
     * nothing from the warehouse is kept here, only what the reader chose. */
    const S = window.__SOTM || (window.__SOTM = { month: null, open: null, q: "", rows: null });

    host.innerHTML = '<style id="smCss">'
      + ".sm-wrap{display:flex;flex-direction:column;gap:14px}"
      /* the six topic hues, defined once. They are the page's whole colour argument: the
         stacked bar, the tiles and the sheet all name the same topic with the same hue. */
      + ".sm-wrap{--sm-c1:var(--brand);--sm-c2:var(--blue);--sm-c3:var(--purple);"
      + "--sm-c4:var(--amber);--sm-c5:color-mix(in srgb,var(--blue) 55%,var(--brand));"
      + "--sm-c6:var(--muted)}"
      + ".sm-hero{position:relative;overflow:hidden}"
      + ".sm-htop{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap}"
      + ".sm-monbtn{appearance:none;border:0;background:none;font:inherit;font-size:31px;"
      + "font-weight:800;letter-spacing:-.6px;color:var(--ink);cursor:pointer;padding:0;"
      + "display:flex;align-items:center;gap:8px}"
      + ".sm-monbtn .car{font-size:14px;color:var(--faint);transition:transform .16s}"
      + ".sm-monbtn.open .car{transform:rotate(180deg)}"
      + ".sm-mwrap{position:relative}"
      + ".sm-mlist{position:absolute;top:calc(100% + 6px);left:0;min-width:250px;z-index:44;"
      + "background:var(--panel);border:1px solid var(--line-2);border-radius:14px;"
      + "box-shadow:var(--shadow);padding:6px;display:none;max-height:340px;overflow:auto}"
      + ".sm-mlist.open{display:block}"
      + ".sm-mopt{display:flex;align-items:center;gap:10px;width:100%;appearance:none;border:0;"
      + "background:none;font:inherit;font-size:13.5px;font-weight:650;color:var(--ink);"
      + "padding:8px 11px;border-radius:9px;cursor:pointer;text-align:left}"
      + ".sm-mopt:hover{background:var(--panel-2)}"
      + ".sm-mopt.cur{background:var(--brand-glow);font-weight:800}"
      + ".sm-mopt .tag{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".sm-mopt .tag.yg{color:var(--warn)}"
      + ".sm-sub{font-size:12.5px;color:var(--muted);margin-top:5px;max-width:var(--rs-prose,68ch)}"
      + ".sm-stats{margin-left:auto;display:flex;gap:0}"
      + ".sm-st{padding:0 20px;border-left:1px solid var(--line)}"
      + ".sm-st:first-child{border-left:0}"
      + ".sm-st span{display:block;font-size:11px;font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--muted)}"
      + ".sm-st b{display:block;font-size:26px;font-weight:750;letter-spacing:-.5px;"
      + "color:var(--ink);margin-top:3px;font-variant-numeric:tabular-nums}"
      + ".sm-st small{display:block;font-size:12px;color:var(--faint);margin-top:2px}"
      /* the legend doubles as the model: weight, hue and name in one row */
      + ".sm-legend{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}"
      + ".sm-lg{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:650;"
      + "color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:5px 12px}"
      + ".sm-lg i{width:9px;height:9px;border-radius:3px;flex-shrink:0}"
      + ".sm-lg b{color:var(--ink);font-weight:800;font-variant-numeric:tabular-nums}"
      + ".sm-card{border:1px solid var(--line);border-radius:14px;background:var(--panel);"
      + "overflow:hidden;margin-bottom:9px;transition:border-color .14s}"
      + ".sm-card.on{border-color:var(--line-2);box-shadow:var(--shadow)}"
      + ".sm-head{display:grid;grid-template-columns:44px minmax(0,1fr) 220px auto;gap:20px;"
      + "align-items:center;padding:15px 18px;cursor:pointer}"
      + ".sm-rk{width:40px;height:40px;border-radius:12px;display:grid;place-items:center;"
      + "font-size:16px;font-weight:800;background:var(--panel-2);color:var(--muted);"
      + "font-variant-numeric:tabular-nums}"
      + ".sm-rk.top{background:var(--brand);color:var(--brand-ink)}"
      + ".sm-rk.oor{background:none;border:1px dashed var(--line-2);color:var(--faint)}"
      + ".sm-nm{font-size:20px;font-weight:750;letter-spacing:-.3px;color:var(--ink);"
      + "display:flex;align-items:center;gap:8px;flex-wrap:wrap}"
      + ".sm-gone{font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--faint);border:1px solid var(--line-2);border-radius:999px;padding:1px 8px}"
      + ".sm-si{font-size:13px;color:var(--faint);margin-top:3px;display:flex;gap:7px;"
      + "flex-wrap:wrap;align-items:center}"
      + ".sm-si .oor{color:var(--warn);font-weight:700}"
      + ".sm-pv{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:650;"
      + "color:var(--muted);background:var(--panel-2);border-radius:999px;padding:2px 9px}"
      + ".sm-pv i{font-style:normal;font-weight:800}"
      + ".sm-pv i.up{color:var(--pos)} .sm-pv i.down{color:var(--neg)} .sm-pv i.same{color:var(--faint)}"
      /* the stacked bar IS the score: six segments, each as wide as the points it earned */
      + ".sm-bar{height:12px;border-radius:6px;background:var(--panel-2);overflow:hidden;"
      + "display:flex}"
      + ".sm-bar u{display:block;height:100%;text-decoration:none}"
      + ".sm-barcap{font-size:11px;color:var(--faint);margin-top:5px;font-weight:650}"
      + ".sm-tot{text-align:right;min-width:92px}"
      + ".sm-tot b{display:block;font-size:30px;font-weight:800;letter-spacing:-.9px;"
      + "color:var(--ink);font-variant-numeric:tabular-nums;line-height:1}"
      + ".sm-tot i{display:block;font-style:normal;font-size:10px;font-weight:800;"
      + "letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:3px}"
      + ".sm-vd{font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;"
      + "border-radius:999px;padding:2px 10px;border:1px solid}"
      + ".sm-vd.top{color:var(--pos);border-color:var(--pos);background:var(--pos-bg)}"
      + ".sm-vd.good{color:var(--brand-d);border-color:var(--line-2)}"
      + ".sm-vd.mid{color:var(--muted);border-color:var(--line-2)}"
      + ".sm-vd.warn{color:var(--warn);border-color:var(--warn);background:var(--warn-bg)}"
      + ".sm-vd.bad{color:var(--neg);border-color:var(--neg);background:var(--neg-bg)}"
      + ".sm-vd.dim{color:var(--faint);border-color:var(--line)}"
      + ".sm-rep{appearance:none;border:1px solid var(--line-2);background:var(--panel);"
      + "border-radius:9px;color:var(--muted);font:inherit;font-size:12px;font-weight:700;"
      + "padding:6px 13px;cursor:pointer;transition:.13s}"
      + ".sm-rep:hover{border-color:var(--brand);color:var(--brand-d)}"
      + ".sm-body{display:none;padding:0 18px 18px;border-top:1px solid var(--line)}"
      + ".sm-card.on .sm-body{display:block;animation:smin .16s ease-out}"
      + "@keyframes smin{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}"
      + ".sm-sec{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;"
      + "color:var(--muted);margin:16px 0 10px}"
      + ".sm-sec .rescale{text-transform:none;letter-spacing:0;font-weight:600;color:var(--warn)}"
      + ".sm-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}"
      + ".sm-tile{border:1px solid var(--line);border-radius:11px;padding:12px 13px;"
      + "background:var(--panel-2);border-left:3px solid var(--tc,var(--line-2))}"
      + ".sm-tile.na{border-style:dashed;opacity:.72}"
      + ".sm-tl{display:flex;align-items:baseline;gap:8px}"
      + ".sm-tl .l{font-size:13px;font-weight:750;color:var(--ink)}"
      + ".sm-tl .v{margin-left:auto;font-size:18px;font-weight:800;color:var(--ink);"
      + "font-variant-numeric:tabular-nums}"
      + ".sm-tl .v small{font-size:11px;font-weight:700;color:var(--faint)}"
      + ".sm-tb{height:6px;border-radius:3px;background:var(--line);overflow:hidden;margin:8px 0 7px}"
      + ".sm-tb>i{display:block;height:100%;background:var(--tc,var(--brand))}"
      + ".sm-tr{font-size:12px;color:var(--muted);line-height:1.5}"
      + ".sm-tw{font-size:11px;color:var(--faint);margin-top:5px;display:flex;gap:8px;"
      + "align-items:center;flex-wrap:wrap}"
      + ".sm-tw b{color:var(--muted);font-weight:750}"
      + ".sm-empty{border:1px dashed var(--line-2);border-radius:12px;padding:52px 20px;"
      + "text-align:center;color:var(--faint);font-size:13.5px}"
      + ".sm-note{font-size:12px;color:var(--faint);line-height:1.55;margin-top:12px}"
      /* the report overlay */
      + ".sm-rdim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:70;overflow:auto;"
      + "padding:26px 16px;display:flex;flex-direction:column;align-items:center}"
      + ".sm-rbar{width:210mm;max-width:100%;display:flex;gap:9px;margin-bottom:12px}"
      + ".sm-rbar .sp{flex:1}"
      + ".sm-rbtn{appearance:none;border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.1);"
      + "color:#fff;font:inherit;font-size:13px;font-weight:700;border-radius:9px;padding:8px 16px;"
      + "cursor:pointer}"
      + ".sm-rbtn.pri{background:#fff;color:#16181D;border-color:#fff}"
      + "@media(max-width:1180px){.sm-head{grid-template-columns:44px minmax(0,1fr) auto}"
      + ".sm-head .sm-scwrap{display:none}}"
      + "@media(max-width:820px){.sm-rep{display:none}.sm-stats{margin-left:0;margin-top:12px}}"
      + SHEET_CSS
      + "</style><div class='sm-wrap' id='smWrap'><div class='sm-empty'>Reading the record…</div></div>";

    const wrap = host.querySelector("#smWrap");

    // ---------------------------------------------------------------- helpers
    const monLab = m => {
      if (!m) return "—";
      const [y, mo] = String(m).split("-");
      return ["January", "February", "March", "April", "May", "June", "July", "August",
              "September", "October", "November", "December"][+mo - 1] + " " + y;
    };
    const monShort = m => {
      if (!m) return "—";
      const [y, mo] = String(m).split("-");
      return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov",
              "Dec"][+mo - 1] + " " + y;
    };
    const ord = n => {
      if (n == null) return "—";
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const vClass = v => ({ "Top performer": "top", "Solid": "good", "Developing": "mid",
                           "Needs attention": "warn", "At risk": "bad" }[v] || "dim");
    const departed = r => /not/i.test(String(r["Roster Status"] || ""));

    // ---------------------------------------------------------------- data
    function load() {
      wrap.innerHTML = "<div class='sm-empty'>Reading the record…</div>";
      // RS.load takes ONE dataset key and resolves to its rows — there is no RS.rows()
      // accessor to read them back out afterwards.
      RS.load("sotm").then(rows => {
        S.rows = (rows || []).slice();
        paint();
      }).catch(e => {
        wrap.innerHTML = "<div class='sm-empty'>Could not load the scorecard — " + esc(e && e.message || e) + "</div>";
      });
    }

    const monthsOf = () => Array.from(new Set((S.rows || []).map(r => r["Month"])))
      .filter(Boolean).sort().reverse();

    function rowsFor(m) {
      return (S.rows || []).filter(r => r["Month"] === m).sort((a, b) => {
        const ra = num(a["Rank"]), rb = num(b["Rank"]);
        if (ra != null && rb != null) return ra - rb;
        if (ra != null) return -1;
        if (rb != null) return 1;
        return (num(b["Leads"]) || 0) - (num(a["Leads"]) || 0);
      });
    }

    // last month's row for the same person, for the arrows and the sheet
    function prevOf(name, m) {
      const all = monthsOf().slice().sort();
      const i = all.indexOf(m);
      if (i <= 0) return null;
      const pm = all[i - 1];
      return (S.rows || []).find(r => r["Month"] === pm && r["Sales Person"] === name) || null;
    }

    // ---------------------------------------------------------------- paint
    function paint() {
      const months = monthsOf();
      if (!months.length) {
        wrap.innerHTML = "<div class='sm-empty'>No scored months yet.</div>";
        return;
      }
      // OPEN ON THE LAST MONTH THAT ACTUALLY FINISHED. The newest row is the month we are
      // standing in — a handful of days, four people over the twenty-lead line, and a
      // ranking that will not survive the week. An award page should land on a month that
      // happened.
      if (!S.month || months.indexOf(S.month) < 0) {
        S.month = months.find(m => (num((rowsFor(m)[0] || {})["Months Matured"]) || 0) >= 1)
                  || months[0];
      }
      const rows = rowsFor(S.month);
      const ranked = rows.filter(r => num(r["Rank"]) != null);
      const leader = ranked[0] || null;
      const matured = num((rows[0] || {})["Months Matured"]);
      const totLeads = rows.reduce((a, r) => a + (num(r["Leads"]) || 0), 0);
      const q = (S.q || "").trim().toLowerCase();
      const shown = q ? rows.filter(r => String(r["Sales Person"] || "").toLowerCase().includes(q)) : rows;

      const stat = (lab, v, sub) => "<div class='sm-st'><span>" + esc(lab) + "</span><b>"
        + v + "</b><small>" + sub + "</small></div>";

      // A YOUNG MONTH IS SAID OUT LOUD. Under two months of maturity a fifth of the
      // eventual bookings have not landed, so the ranking is a draft, not a result.
      const young = matured != null && matured < 2;
      const maturity = matured == null ? "—"
        : matured <= 0 ? "still running"
        : matured === 1 ? "one month on"
        : matured + " months on";

      const hero = "<div class='panel sm-hero'><div class='sm-htop'>"
        + "<div><div class='sm-mwrap'>"
        + "<button class='sm-monbtn' id='smMonBtn'>" + esc(monLab(S.month))
        + " <span class='car'>▾</span></button>"
        + "<div class='sm-mlist' id='smMList'>"
        + months.map(m => {
            const rr = rowsFor(m).filter(x => num(x["Rank"]) != null);
            const mm = num((rowsFor(m)[0] || {})["Months Matured"]);
            const growing = mm != null && mm < 2;
            return "<button class='sm-mopt" + (m === S.month ? " cur" : "") + "' data-m='" + esc(m) + "'>"
              + esc(monLab(m)) + "<span class='tag" + (growing ? " yg" : "") + "'>"
              + rr.length + " ranked" + (growing ? " · growing" : "") + "</span></button>";
          }).join("")
        + "</div></div>"
        + "<div class='sm-sub'>Everything here is counted from the record — the leads that "
        + "arrived in " + esc(monLab(S.month)) + ", what became of them, and what the jobs "
        + "earned. Nobody rates anybody on this page."
        + (young ? " <b>" + esc(monLab(S.month)) + " is still growing</b> — a fifth of the "
                 + "leads that eventually book do so more than a month after they arrive, so "
                 + "this order will still move." : "")
        // A PERCENTILE NEEDS PEOPLE TO BE A PERCENTILE OF. With four reps over the line,
        // last place on the two topics that could be measured scores a flat 0.0 — which
        // reads as a verdict on the person when it only means "the lowest of four". Say so
        // rather than let the number speak for itself.
        + (ranked.length && ranked.length < 6
            ? " <b>Only " + ranked.length + " salespeople cleared 20 leads here</b>, so these "
              + "standings separate very few people — the bottom of a pool this small scores "
              + "near zero by arithmetic, not by judgement." : "")
        + "</div></div>"
        + "<div class='sm-stats'>"
        + stat("Ranked", fmtN(ranked.length),
               rows.length > ranked.length ? (rows.length - ranked.length) + " under 20 leads" : "everyone who worked")
        + stat("Leads handled", fmtN(totLeads), "in " + esc(monShort(S.month)))
        + stat("Leading", leader ? esc(String(leader["Sales Person"]).split(" ")[0]) : "—",
               leader ? fmt1(num(leader["Score"])) + " of 100" : "nobody qualifies")
        + stat("Month", esc(maturity), young ? "provisional" : "settled")
        + "</div></div>"
        + "<div class='sm-legend'>"
        + TOPICS.map(t => "<span class='sm-lg'><i style='background:var(--sm-c" + t.c + ")'></i>"
            + esc(t.label) + " <b>" + t.w + "</b></span>").join("")
        + "</div></div>";

      const bar = "<div class='rs-bar'><input class='rs-inp' id='smQ' placeholder='Find a salesperson…' value=\""
        + esc(S.q || "") + "\"><span class='rs-spacer'></span>"
        + "<span class='rs-hint' style='margin:0'>Click a card for the six topics behind the score.</span></div>";

      wrap.innerHTML = hero + bar
        + (shown.length ? shown.map(card).join("")
                        : "<div class='sm-empty'>No salesperson matches “" + esc(S.q) + "”.</div>");
      wire();
    }

    function card(r) {
      const name = String(r["Sales Person"] || "");
      const rank = num(r["Rank"]), score = num(r["Score"]), w = num(r["Weight Measured"]);
      const open = S.open === name;
      const rkCls = rank === 1 ? " top" : rank == null ? " oor" : "";
      const why = r["Not Ranked Because"];

      const segs = TOPICS.map(t => {
        const p = num(r[t.ptsf]);
        return p ? "<u style='width:" + p.toFixed(2) + "%;background:var(--sm-c" + t.c + ")' title='"
          + esc(t.label) + " " + fmt1(p) + " of " + t.w + "'></u>" : "";
      }).join("");

      const pv = prevBit(r);

      return "<div class='sm-card" + (open ? " on" : "") + "' data-n='" + esc(name) + "'>"
        + "<div class='sm-head'>"
        + "<div class='sm-rk" + rkCls + "'" + (why ? " title='" + esc(why) + "'" : "") + ">"
        + (rank == null ? "–" : rank) + "</div>"
        + "<div><div class='sm-nm'>" + esc(name)
        + (departed(r) ? "<span class='sm-gone'>no longer on the team</span>" : "")
        + "</div><div class='sm-si'>"
        + fmtN(num(r["Leads"])) + " leads · " + fmtN(num(r["Confirmed"])) + " booked · "
        + money0(num(r["Revenue"]))
        + (why ? " · <span class='oor'>" + esc(why) + "</span>" : "")
        + (pv ? " " + pv : "")
        + "</div></div>"
        + "<div class='sm-scwrap'><div class='sm-bar'>" + segs + "</div>"
        + "<div class='sm-barcap'>"
        + (w != null && w < 100 ? "measured on " + Math.round(w) + " of the 100 points"
                                : "all six topics measured")
        + "</div></div>"
        + "<div style='display:flex;align-items:center;gap:14px'>"
        + "<div class='sm-tot'><b>" + (score == null ? "—" : fmt1(score)) + "</b>"
        + "<i>" + (score == null ? "not scored" : rank == null ? "not ranked" : "of 100") + "</i></div>"
        + "<button class='sm-rep' data-rep='" + esc(name) + "'>Report</button>"
        + "</div></div>"
        + "<div class='sm-body'>" + (open ? body(r) : "") + "</div></div>";
    }

    /* LAST MONTH IN ONE CLAUSE, and silent when there is nothing honest to say. */
    function prevBit(r) {
      const p = prevOf(String(r["Sales Person"] || ""), r["Month"]);
      if (!p) return "<span class='sm-pv'>new this month</span>";
      const ps = num(p["Score"]), cs = num(r["Score"]);
      if (ps == null) return "<span class='sm-pv'>" + esc(monShort(p["Month"])) + " not scored</span>";
      const pr = num(p["Rank"]);
      let arrow = "";
      if (cs != null) {
        const d = cs - ps;
        arrow = Math.abs(d) < 0.5
          ? " <i class='same' title='within half a point'>→</i>"
          : " <i class='" + (d > 0 ? "up" : "down") + "'>" + (d > 0 ? "▲" : "▼")
            + Math.abs(d).toFixed(1) + "</i>";
      }
      return "<span class='sm-pv'>" + esc(monShort(p["Month"])) + " "
        + (pr != null ? "<b>" + ord(pr) + "</b> · " : "") + fmt1(ps) + arrow + "</span>";
    }

    function body(r) {
      const w = num(r["Weight Measured"]);
      const missing = TOPICS.filter(t => num(r[t.pctf]) == null);
      const prev = prevOf(String(r["Sales Person"] || ""), r["Month"]);

      const tiles = TOPICS.map(t => {
        const pctv = num(r[t.pctf]), pts = num(r[t.ptsf]);
        const na = pctv == null;
        const pp = prev ? num(prev[t.ptsf]) : null;
        let delta = "";
        if (!na && pp != null) {
          const d = pts - pp;
          delta = Math.abs(d) < 0.05
            ? "<b>=</b> same as " + esc(monShort(prev["Month"]))
            : "<b style='color:var(--" + (d > 0 ? "pos" : "neg") + ")'>"
              + (d > 0 ? "▲" : "▼") + Math.abs(d).toFixed(1) + "</b> vs "
              + esc(monShort(prev["Month"])) + " (" + fmt1(pp) + ")";
        } else if (!na && prev) {
          delta = "<b>—</b> not measured in " + esc(monShort(prev["Month"]));
        }
        return "<div class='sm-tile" + (na ? " na" : "") + "' style='--tc:var(--sm-c" + t.c + ")'>"
          + "<div class='sm-tl'><span class='l'>" + esc(t.label) + "</span>"
          + "<span class='v'>" + (na ? "—" : fmt1(pts))
          + "<small> / " + t.w + "</small></span></div>"
          + "<div class='sm-tb'><i style='width:" + (na ? 0 : Math.round(100 * pctv)) + "%'></i></div>"
          + "<div class='sm-tr'>" + esc(t.read(r)) + "</div>"
          + "<div class='sm-tw'>" + (na ? "<b>not measured</b> · its " + t.w
                + " points are shared out over the rest"
              : "<b>" + ord(Math.round(1 + (1 - pctv) * (num(r["Ranked Reps"]) - 1)))
                + "</b> of " + fmtN(num(r["Ranked Reps"])) + " this month")
          + (delta ? " · " + delta : "") + "</div></div>";
      }).join("");

      return "<div class='sm-sec'>The six topics"
        + (w != null && w < 100
            ? " <span class='rescale'>— " + missing.map(t => t.label.toLowerCase()).join(" and ")
              + " could not be measured, so the score is out of the "
              + Math.round(w) + " points that could</span>" : "")
        + "</div><div class='sm-tiles'>" + tiles + "</div>"
        + "<div class='sm-note'>Each topic places this rep against everyone else ranked in "
        + esc(monLab(r["Month"])) + " — the bar is that standing, the number is the points it "
        + "earns out of the topic's weight. Ties share the middle of their band, so several "
        + "spotless months all read as spotless.</div>";
    }

    // ---------------------------------------------------------------- the printable sheet
    function reportHtml(r) {
      const name = String(r["Sales Person"] || "");
      const prev = prevOf(name, r["Month"]);
      const score = num(r["Score"]), rank = num(r["Rank"]), w = num(r["Weight Measured"]);

      const strip = [
        ["Leads handled", fmtN(num(r["Leads"])), "arrived in " + monShort(r["Month"])],
        ["Booked", fmtN(num(r["Confirmed"])), pct1(num(r["Booking Rate"])) + " of qualified"],
        ["Revenue", money0(num(r["Revenue"])), fmtN(num(r["Closed"])) + " jobs closed"],
        ["Gross profit", money0(num(r["Profit"])), money0(num(r["Profit Per Lead"])) + " a lead"],
        ["Claims", fmtN(num(r["Claims"])), num(r["Claims"]) ? "on the jobs sold" : "a clean month"],
      ].map(x => "<div><span class='l'>" + esc(x[0]) + "</span><span class='v'>" + x[1]
        + "</span><span class='s'>" + esc(x[2]) + "</span></div>").join("");

      const rowsHtml = TOPICS.map(t => {
        const pctv = num(r[t.pctf]), pts = num(r[t.ptsf]);
        const pp = prev ? num(prev[t.ptsf]) : null;
        let d = "<span class='fl'>—</span>";
        if (pts != null && pp != null) {
          const dd = pts - pp;
          d = Math.abs(dd) < 0.05 ? "<span class='fl'>=</span>"
            : "<span class='" + (dd > 0 ? "up" : "dn") + "'>" + (dd > 0 ? "▲" : "▼")
              + Math.abs(dd).toFixed(1) + "</span>";
        }
        return "<tr><td><b>" + esc(t.label) + "</b><br><span class='q'>" + esc(t.blurb)
          + "</span></td><td class='q'>" + esc(t.read(r))
          + (pctv == null ? "" : "<div class='bar'><i style='width:" + Math.round(100 * pctv)
             + "%'></i></div>") + "</td>"
          + "<td class='n'>" + (pts == null ? "—" : fmt1(pts)) + " <span class='q'>/ " + t.w
          + "</span></td><td class='n'>" + d + "</td></tr>";
      }).join("");

      return "<div class='sm-sheet' id='smSheet'><div class='fit'>"
        + "<div class='rhd'><div><h1>" + esc(name) + "</h1>"
        + "<div class='sub'>Sales performance for " + esc(monLab(r["Month"])) + " · "
        + fmtN(num(r["Leads"])) + " leads · " + fmtN(num(r["Confirmed"])) + " booked</div></div>"
        + "<div class='big'><b>" + (score == null ? "—" : fmt1(score)) + "</b><i>"
        + (rank == null ? "not ranked" : "out of 100 · place #" + rank + " of "
           + fmtN(num(r["Ranked Reps"]))) + "</i></div></div>"
        + "<div class='rstrip'>" + strip + "</div>"
        + "<h2>How the score was made — every topic counted, none rated by hand</h2>"
        + "<table><thead><tr><th>Topic</th><th>What the record shows</th>"
        + "<th class='n'>Earned</th><th class='n'>vs " + esc(monShort(prev ? prev["Month"] : "")) + "</th>"
        + "</tr></thead><tbody>" + rowsHtml + "</tbody></table>"
        + "<div class='foot'>Each topic places " + esc(name.split(" ")[0]) + " against the "
        + fmtN(num(r["Ranked Reps"])) + " salespeople ranked in " + esc(monLab(r["Month"]))
        + ", and the points are that standing out of the topic's weight"
        + (w != null && w < 100 ? " — only " + Math.round(w) + " of the 100 points could be "
           + "measured this month, so the score is taken out of those" : "")
        + ". A lead belongs to the month it arrived in and every question is asked of that same "
        + "set of leads, so a recent month still rises as its leads book. Generated "
        + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        + ".</div></div></div>";
    }

    /* ONE PAGE, MEASURED WHERE IT LANDS. Never scales up — a short sheet keeps its size. */
    function fitSheet(sheet) {
      if (!sheet) return;
      const box = sheet.querySelector(".fit");
      if (!box) return;
      box.style.transform = ""; box.style.width = "";
      const cs = getComputedStyle(sheet);
      const avail = sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const need = box.scrollHeight;
      if (need > avail && need > 0) {
        const k = Math.max(0.62, avail / need);
        box.style.transformOrigin = "top left";
        box.style.transform = "scale(" + k.toFixed(4) + ")";
        box.style.width = (100 / k).toFixed(2) + "%";
      }
    }

    function printSheet(name, sheet) {
      if (!sheet) return;
      const doc = '<!doctype html><html><head><meta charset="utf-8"><title>'
        + esc(name + " — " + monLab(S.month)) + "</title><style>"
        + "@page{size:A4 portrait;margin:0}"
        + "*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}"
        + "html,body{margin:0;padding:0;background:#fff}"
        + SHEET_CSS
        // on paper the sheet IS the page: no shadow, and @page margin 0 turns the sheet's
        // own 14mm padding into the printed margin
        + ".sm-sheet{box-shadow:none;margin:0}"
        + "</style></head><body>" + sheet.outerHTML + "</body></html>";
      if (!(window.RSC && RSC.printDoc)) { window.print(); return; }
      RSC.printDoc(doc, {
        title: name, width: "210mm", height: "297mm",
        // the frame lays the sheet out itself, so the fit must be measured in ITS document
        beforePrint: (w2, d2) => {
          const s2 = d2.getElementById("smSheet");
          const box = s2 && s2.querySelector(".fit");
          if (!box) return;
          const cs = w2.getComputedStyle(s2);
          const avail = s2.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
          const need = box.scrollHeight;
          if (need > avail && need > 0) {
            const k = Math.max(0.62, avail / need);
            box.style.transformOrigin = "top left";
            box.style.transform = "scale(" + k.toFixed(4) + ")";
            box.style.width = (100 / k).toFixed(2) + "%";
          }
        },
      });
    }

    function closeReport() {
      document.querySelectorAll(".sm-rdim").forEach(e => e.remove());
      document.removeEventListener("keydown", onReportEsc);
    }
    function onReportEsc(e) { if (e.key === "Escape") closeReport(); }

    function openReport(name) {
      const r = (S.rows || []).find(x => x["Month"] === S.month && x["Sales Person"] === name);
      if (!r) return;
      closeReport();
      const dim = document.createElement("div");
      dim.className = "sm-rdim";
      dim.innerHTML = "<div class='sm-rbar'><span class='sp'></span>"
        + "<button class='sm-rbtn pri' id='smPdf'>Save as PDF</button>"
        + "<button class='sm-rbtn' id='smRx'>Close</button></div>" + reportHtml(r);
      document.body.appendChild(dim);
      dim.addEventListener("click", e => { if (e.target === dim) closeReport(); });
      document.addEventListener("keydown", onReportEsc);
      const sheet = dim.querySelector("#smSheet");
      // ORDER IS LOAD-BEARING: wire both buttons BEFORE measuring, and let the measure throw
      // harmlessly — a layout helper that dies between the two once left "Save as PDF" dead.
      dim.querySelector("#smRx").onclick = closeReport;
      dim.querySelector("#smPdf").onclick = () => printSheet(name, sheet);
      try { fitSheet(sheet); } catch (e) { /* the sheet is readable unscaled */ }
    }

    // ---------------------------------------------------------------- wiring
    function wire() {
      const btn = wrap.querySelector("#smMonBtn"), list = wrap.querySelector("#smMList");
      if (btn && list) {
        btn.onclick = e => {
          e.stopPropagation();
          const on = list.classList.toggle("open");
          btn.classList.toggle("open", on);
          if (!on) return;
          // registered on a timeout so the click that OPENED it cannot also close it
          setTimeout(() => {
            const off = () => { list.classList.remove("open"); btn.classList.remove("open");
                                document.removeEventListener("click", off);
                                document.removeEventListener("keydown", key); };
            const key = ev => { if (ev.key === "Escape") off(); };
            document.addEventListener("click", off);
            document.addEventListener("keydown", key);
          }, 0);
        };
        list.querySelectorAll(".sm-mopt").forEach(b => {
          b.onclick = e => { e.stopPropagation(); S.month = b.dataset.m; S.open = null; paint(); };
        });
      }
      const q = wrap.querySelector("#smQ");
      if (q) q.oninput = () => {
        S.q = q.value;
        paint();
        const nq = wrap.querySelector("#smQ");
        if (nq) { nq.focus(); nq.setSelectionRange(nq.value.length, nq.value.length); }
      };
      // the Report button lives INSIDE the card head, which is itself the toggle — so it
      // has to stop the event before the head ever sees it
      wrap.querySelectorAll(".sm-rep").forEach(b => {
        b.onclick = e => { e.stopPropagation(); openReport(b.dataset.rep); };
      });
      wrap.querySelectorAll(".sm-card").forEach(c => {
        const head = c.querySelector(".sm-head");
        if (head) head.onclick = () => {
          S.open = S.open === c.dataset.n ? null : c.dataset.n;
          paint();
        };
      });
    }

    load();
  },
});
