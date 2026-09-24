/* SUPPORT OF THE MONTH — picked by the record alone (CEO decision 2026-09-24: "automated").
 *
 * WHAT CAN BE CREDITED TO A PERSON, AND WHAT CANNOT. The support team is three people —
 * Mariam Ninidze, Avto Samadalashvili, Nikoloz Gogoladze — and most of their day is the phone.
 * Every one of those calls, texts and transcripts runs through ONE shared RingCentral user
 * (extension 1, "Support Zip To Zip"), and it stays that way (decision 24 Sep). So the phone
 * is shown here as a TEAM panel and it never ranks anybody. The only record that names a
 * person is the Monday claims board: who owns each claim. That is what the score reads.
 *
 * FIXED BARS, NOT PERCENTILES. Sales Person of the Month ranks each rep by where they stand in
 * the month's pool and needs four people per measure. Three people cannot make a percentile,
 * so each measure is read against a bar that does not move with who else worked the month.
 *
 * THE PERTURBATION TEST DECIDED WHAT IS SCORED (24 Sep 2026, May–Aug). Each measure was read
 * once a little wider and once a little tighter. Share of claims resolved reversed the order
 * in 3 of 4 months, so it is shown here but not scored. Days and escalations reversed once
 * each and carry the score, 60 and 40. The page says, month by month, whether the order
 * survives those re-readings — with three people and 15–20 claims each, it often will not,
 * and the reader should know that before handing out an award.
 *
 * EVERY OWNED CLAIM IS TIMED (review, 24 Sep 2026). The days were first a median over the
 * resolved claims alone, which rewards leaving the slow ones open: August's lowest resolver
 * (7 of 16) scored 100. Now a resolved claim is timed to its last status change and any other
 * at its age so far, so closing a claim can only stop its clock, never lose points.
 *
 * AT LEAST 10 OWNED CLAIMS TO BE RANKED. Below that the person is shown, labelled "not
 * enough claims", and not placed.
 */
(function () {
  if (!(window.RS && RS.DATASETS)) return;
  // PAYLOAD CONTRACTS: a column missing from these lists never arrives — rs-core asks the
  // bridge for exactly these names.
  if (!RS.DATASETS.supotm_line) RS.DATASETS.supotm_line = {
    table: "mart_support_line_month",
    cols: ["Month", "Answered Calls", "Missed Calls", "Missed Calls Checked",
           "Missed Outside Number", "Called Back 1h", "Called Back 24h",
           "Called Back 1h Share", "Called Back 24h Share", "Reached 1h", "Reached 24h",
           "Reached 1h Share", "Reached 24h Share", "Median Callback Minutes",
           "Outbound Calls", "Texts In", "Texts Out", "Transcripts", "Months Matured"],
  };
  if (!RS.DATASETS.supotm_work) RS.DATASETS.supotm_work = {
    table: "mart_support_casework",
    cols: ["Month", "Person", "On Team", "Is Person", "Claims Filed In Month", "Claims Owned",
           "Claims Touched", "Shared Claims", "Resolved", "Resolved Share", "Resolved Share Wide",
           "Resolved Share Tight", "Customer Went Silent", "Still Open",
           "Median Days To Last Status", "Days Measured On", "Median Days All Claims",
           "Claims Timed", "Timed At Age So Far", "Median Days All Claims Wide",
           "Median Days All Claims Tight", "Escalations", "Escalation Rate", "Escalation Rate Wide",
           "Escalation Rate Tight", "Updates Written", "Negative Review Cases",
           "Negative Reviews Removed", "Months Matured"],
  };
  if (!RS.DATASETS.supotm_score) RS.DATASETS.supotm_score = {
    table: "mart_support_scorecard",
    cols: ["Month", "Person", "On Team", "Claims Owned", "Ranked", "Not Ranked Because",
           "Bar Days", "Bar Escalation", "Points Days", "Points Escalation", "Weight Measured",
           "Score", "Rank", "Ranked People", "Is Winner",
           "Score Days Wide", "Score Days Tight", "Score Escalation Wide", "Score Escalation Tight",
           "Rank Days Wide", "Rank Days Tight", "Rank Escalation Wide", "Rank Escalation Tight",
           "Order Holds Of 4", "Leader Holds Of 4", "Months Matured"],
  };
})();

registerPage({
  id: "support-of-the-month",
  group: "sales",
  title: "Support of the Month",
  subtitle: "Counted from the claims board — the shared phone line is shown for the team, never ranked.",
  datasets: [],

  render(host) {
    const RSC = window.RSC || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])));
    const num = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
    const fmtN = n => (n == null ? "—" : Number(n).toLocaleString("en-US"));
    const fmt1 = n => (n == null ? "—" : Number(n).toFixed(1));
    // a credited claim count: 16 prints 16, a half-share 9.5 prints 9.5 — never rounded to a
    // whole claim, or the people stop adding up to the team
    const fmtC = n => (n == null ? "—" : (Math.abs(n - Math.round(n)) < 0.005
      ? String(Math.round(n)) : Number(n).toFixed(1)));
    const pct0 = n => (n == null ? "—" : Math.round(100 * n) + "%");

    /* THE RULES, the same numbers as src/curated.py (_SOTM_*); tests/test_support_month.py
     * holds the two together so the sentence on the page cannot drift from the arithmetic. */
    const SOTM_RULES = { minClaims: 10, minDaysOn: 5, daysFull: 7, daysZero: 35,
                         escZero: 0.20, wDays: 60, wEsc: 40 };

    /* The four re-readings the order is tested against, in the page's own words. */
    const VARIANTS = [
      { rk: "Rank Days Wide", sc: "Score Days Wide", label: "Days, read wider",
        what: "a claim where the customer went silent timed as resolved, not at its age" },
      { rk: "Rank Days Tight", sc: "Score Days Tight", label: "Days, read tighter",
        what: "leaving out a resolved claim whose status changed more than 60 days after filing" },
      { rk: "Rank Escalation Wide", sc: "Score Escalation Wide", label: "Escalations, read wider",
        what: "also counting a negative review the board never marked" },
      { rk: "Rank Escalation Tight", sc: "Score Escalation Tight", label: "Escalations, read tighter",
        what: "only claims in the board's own escalation group" },
    ];
    /* The three claim measures and their neighbours, for the per-month reversal check. */
    const MEASURES = [
      { label: "Share of owned claims resolved", scored: false, low: false,
        cols: ["Resolved Share", "Resolved Share Wide", "Resolved Share Tight"] },
      { label: "Median days, every owned claim timed", scored: true, low: true,
        cols: ["Median Days All Claims", "Median Days All Claims Wide", "Median Days All Claims Tight"] },
      { label: "Escalation rate", scored: true, low: true,
        cols: ["Escalation Rate", "Escalation Rate Wide", "Escalation Rate Tight"] },
    ];

    /* THE PRINTED SHEET'S CSS, ONCE — the overlay and the print document write the same
     * string, with literal ink colours because a standalone print document has no tokens. */
    const SHEET_CSS =
      ".spm-sheet{width:210mm;min-height:297mm;background:#fff;color:#16181D;padding:14mm;"
      + "box-shadow:0 18px 60px rgba(0,0,0,.4);font-size:10.5px;line-height:1.45;"
      + "font-variant-numeric:tabular-nums}"
      + ".spm-sheet h1{font-size:20px;margin:0;letter-spacing:-.4px}"
      + ".spm-sheet .rhd{display:flex;align-items:flex-end;gap:12px;border-bottom:2px solid #16181D;"
      + "padding-bottom:9px;margin-bottom:13px}"
      + ".spm-sheet .rhd .sub{font-size:11px;color:#5B5F6B;margin-top:3px}"
      + ".spm-sheet .rhd .big{margin-left:auto;text-align:right;line-height:1}"
      + ".spm-sheet .rhd .big b{font-size:36px;font-weight:800;letter-spacing:-1.1px}"
      + ".spm-sheet .rhd .big i{display:block;font-style:normal;font-size:9px;font-weight:800;"
      + "letter-spacing:.08em;text-transform:uppercase;color:#7A7E88;margin-top:3px}"
      + ".spm-sheet .rstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:13px}"
      + ".spm-sheet .rstrip>div{border:1px solid #DCDEE3;border-radius:5px;padding:8px 9px;"
      + "display:flex;flex-direction:column}"
      + ".spm-sheet .rstrip .l{font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;"
      + "color:#7A7E88;line-height:1.25;flex:1}"
      + ".spm-sheet .rstrip .v{font-size:16px;font-weight:750;margin-top:2px}"
      + ".spm-sheet .rstrip .s{font-size:9px;color:#7A7E88;margin-top:2px}"
      + ".spm-sheet h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A7E88;"
      + "margin:0 0 6px;padding-bottom:4px;border-bottom:1px solid #DCDEE3}"
      + ".spm-sheet table{width:100%;border-collapse:collapse;margin-bottom:13px}"
      + ".spm-sheet th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.05em;"
      + "color:#7A7E88;padding:4px 6px;border-bottom:1px solid #DCDEE3;font-weight:700}"
      + ".spm-sheet td{padding:5px 6px;border-bottom:1px solid #EFF0F3;vertical-align:top}"
      + ".spm-sheet td.n{text-align:right;white-space:nowrap}"
      + ".spm-sheet td.q{color:#7A7E88;font-size:9.5px}"
      + ".spm-sheet .bar{height:6px;border-radius:3px;background:#EFF0F3;overflow:hidden;margin-top:4px}"
      + ".spm-sheet .bar>i{display:block;height:100%;background:#5F7C20}"
      + ".spm-sheet .foot{font-size:9px;color:#7A7E88;line-height:1.55;border-top:1px solid #DCDEE3;"
      + "padding-top:8px;margin-top:4px}";

    const S = window.__SUPOTM || (window.__SUPOTM = { month: null, line: null, work: null,
                                                      score: null, err: {} });

    host.innerHTML = '<style id="spmCss">'
      + ".spm-wrap{display:flex;flex-direction:column;gap:14px;"
      + "--spm-c1:var(--brand);--spm-c2:var(--purple)}"
      + ".spm-htop{display:flex;align-items:flex-start;gap:18px;flex-wrap:wrap}"
      + ".spm-monbtn{appearance:none;border:0;background:none;font:inherit;font-size:31px;"
      + "font-weight:800;letter-spacing:-.6px;color:var(--ink);cursor:pointer;padding:0;"
      + "display:flex;align-items:center;gap:8px}"
      + ".spm-monbtn .car{font-size:14px;color:var(--faint);transition:transform .16s}"
      + ".spm-monbtn.open .car{transform:rotate(180deg)}"
      + ".spm-mwrap{position:relative}"
      + ".spm-mlist{position:absolute;top:calc(100% + 6px);left:0;min-width:260px;z-index:44;"
      + "background:var(--panel);border:1px solid var(--line-2);border-radius:14px;"
      + "box-shadow:var(--shadow);padding:6px;display:none;max-height:340px;overflow:auto}"
      + ".spm-mlist.open{display:block}"
      + ".spm-mopt{display:flex;align-items:center;gap:10px;width:100%;appearance:none;border:0;"
      + "background:none;font:inherit;font-size:13.5px;font-weight:650;color:var(--ink);"
      + "padding:8px 11px;border-radius:9px;cursor:pointer;text-align:left}"
      + ".spm-mopt:hover{background:var(--panel-2)}"
      + ".spm-mopt.cur{background:var(--brand-glow);font-weight:800}"
      + ".spm-mopt .tag{margin-left:auto;font-size:10px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".spm-mopt .tag.yg{color:var(--warn)}"
      + ".spm-sub{font-size:12.5px;color:var(--muted);margin-top:5px;max-width:var(--rs-prose,72ch);"
      + "line-height:1.55}"
      + ".spm-stats{margin-left:auto;display:flex;flex-wrap:wrap;row-gap:12px;min-width:0}"
      + ".spm-st{padding:0 20px;border-left:1px solid var(--line)}"
      + ".spm-st:first-child{border-left:0}"
      + ".spm-st span{display:block;font-size:11px;font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--muted)}"
      + ".spm-st b{display:block;font-size:26px;font-weight:750;letter-spacing:-.5px;"
      + "color:var(--ink);margin-top:3px;font-variant-numeric:tabular-nums}"
      + ".spm-st small{display:block;font-size:12px;color:var(--faint);margin-top:2px}"
      /* the winner card */
      + ".spm-win{display:flex;align-items:center;gap:18px;flex-wrap:wrap;border:1px solid var(--line-2);"
      + "border-radius:16px;background:var(--panel);padding:18px 20px;box-shadow:var(--shadow)}"
      + ".spm-win .medal{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;"
      + "background:var(--brand);color:var(--brand-ink);font-size:26px;font-weight:800;flex-shrink:0}"
      + ".spm-win .medal.dim{background:var(--panel-2);color:var(--faint)}"
      + ".spm-win .k{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;"
      + "color:var(--muted)}"
      + ".spm-win .nm{font-size:24px;font-weight:800;letter-spacing:-.4px;color:var(--ink);margin-top:2px}"
      + ".spm-win .why{font-size:12.5px;color:var(--muted);margin-top:3px;line-height:1.5}"
      + ".spm-win .sc{margin-left:auto;text-align:right}"
      + ".spm-win .sc b{display:block;font-size:34px;font-weight:800;letter-spacing:-1px;"
      + "color:var(--ink);line-height:1;font-variant-numeric:tabular-nums}"
      + ".spm-win .sc i{display:block;font-style:normal;font-size:10px;font-weight:800;"
      + "letter-spacing:.07em;text-transform:uppercase;color:var(--faint);margin-top:4px}"
      + ".spm-tag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;border-radius:999px;padding:2px 9px;border:1px solid var(--line-2);"
      + "color:var(--faint);margin-left:6px;vertical-align:middle}"
      + ".spm-tag.yg{color:var(--warn);border-color:var(--warn);background:var(--warn-bg)}"
      + ".spm-tag.ok{color:var(--pos);border-color:var(--pos);background:var(--pos-bg)}"
      + ".spm-tag.frag{color:var(--neg);border-color:var(--neg);background:var(--neg-bg)}"
      /* the people, side by side */
      + ".spm-sec{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;"
      + "color:var(--muted);margin:2px 0 8px}"
      + ".spm-cmpwrap{overflow-x:auto}"
      + ".spm-cmp{width:100%;border-collapse:separate;border-spacing:0;min-width:640px}"
      + ".spm-cmp th,.spm-cmp td{padding:10px 14px;border-bottom:1px solid var(--line);"
      + "vertical-align:top;text-align:left}"
      + ".spm-cmp thead th{border-bottom:1px solid var(--line-2);vertical-align:bottom}"
      + ".spm-cmp .lab{width:230px;font-size:12.5px;font-weight:700;color:var(--muted)}"
      + ".spm-cmp .lab small{display:block;font-weight:500;color:var(--faint);margin-top:2px;"
      + "line-height:1.45}"
      + ".spm-cmp .grp td{font-size:10.5px;font-weight:800;letter-spacing:.08em;"
      + "text-transform:uppercase;color:var(--faint);padding-top:16px;background:none}"
      + ".spm-cmp .v{font-size:17px;font-weight:750;color:var(--ink);font-variant-numeric:tabular-nums}"
      + ".spm-cmp .s{font-size:12px;color:var(--faint);margin-top:2px;line-height:1.45}"
      + ".spm-cmp .na .v{color:var(--faint)}"
      + ".spm-ph{display:flex;flex-direction:column;gap:6px;min-width:170px}"
      + ".spm-ph .hd{display:flex;align-items:center;gap:10px}"
      + ".spm-rk{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;"
      + "font-size:15px;font-weight:800;background:var(--panel-2);color:var(--muted);flex-shrink:0;"
      + "font-variant-numeric:tabular-nums}"
      + ".spm-rk.top{background:var(--brand);color:var(--brand-ink)}"
      + ".spm-rk.oor{background:none;border:1px dashed var(--line-2);color:var(--faint)}"
      + ".spm-ph .nm{font-size:16px;font-weight:750;color:var(--ink);letter-spacing:-.2px}"
      + ".spm-ph .scr{font-size:26px;font-weight:800;letter-spacing:-.8px;color:var(--ink);"
      + "font-variant-numeric:tabular-nums;line-height:1}"
      + ".spm-ph .scr small{font-size:11px;font-weight:700;color:var(--faint);letter-spacing:0}"
      + ".spm-ph .oor{font-size:12px;font-weight:700;color:var(--warn)}"
      + ".spm-bar{height:10px;border-radius:5px;background:var(--panel-2);overflow:hidden;display:flex}"
      + ".spm-bar u{display:block;height:100%;text-decoration:none}"
      + ".spm-rep{appearance:none;border:1px solid var(--line-2);background:var(--panel);"
      + "border-radius:9px;color:var(--muted);font:inherit;font-size:12px;font-weight:700;"
      + "padding:5px 12px;cursor:pointer;align-self:flex-start}"
      + ".spm-rep:hover{border-color:var(--brand);color:var(--brand-d)}"
      /* the stability panel */
      + ".spm-stab{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}"
      + ".spm-vl{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:7px}"
      + ".spm-vl li{font-size:12.5px;color:var(--muted);line-height:1.5;display:flex;gap:8px}"
      + ".spm-vl li b{color:var(--ink);font-weight:750}"
      + ".spm-vl .ok{color:var(--pos);font-weight:800}"
      + ".spm-vl .mv{color:var(--neg);font-weight:800}"
      + ".spm-note{font-size:12px;color:var(--faint);line-height:1.6;margin-top:10px}"
      /* the team panel */
      + ".spm-tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}"
      + ".spm-tile{border:1px solid var(--line);border-radius:12px;padding:12px 13px;background:var(--panel-2)}"
      + ".spm-tile .l{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;"
      + "color:var(--muted)}"
      + ".spm-tile .v{font-size:22px;font-weight:800;color:var(--ink);margin-top:4px;"
      + "font-variant-numeric:tabular-nums;letter-spacing:-.4px}"
      + ".spm-tile .s{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.45}"
      + ".spm-empty{border:1px dashed var(--line-2);border-radius:12px;padding:40px 20px;"
      + "text-align:center;color:var(--faint);font-size:13.5px}"
      /* the report overlay */
      + ".spm-rdim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:70;overflow:auto;"
      + "padding:26px 16px;display:flex;flex-direction:column;align-items:center}"
      + ".spm-rbar{width:210mm;max-width:100%;display:flex;gap:9px;margin-bottom:12px}"
      + ".spm-rbar .sp{flex:1}"
      + ".spm-rbtn{appearance:none;border:1px solid rgba(255,255,255,.34);background:rgba(255,255,255,.1);"
      + "color:#fff;font:inherit;font-size:13px;font-weight:700;border-radius:9px;padding:8px 16px;"
      + "cursor:pointer}"
      + ".spm-rbtn.pri{background:#fff;color:#16181D;border-color:#fff}"
      + "@media(max-width:820px){.spm-stats{margin-left:0;margin-top:12px}.spm-win .sc{margin-left:0}"
      /* on a phone the table scrolls sideways; the label column keeps its name, drops its gloss */
      + ".spm-cmp .lab{min-width:130px}.spm-cmp .lab small{display:none}}"
      /* a phone: the four hero figures sit two by two, and a wrapped figure opens its row
       * without the divider (375 px: the one-row strip ran to 474 px and scrolled the page) */
      + "@media(max-width:640px){.spm-stats{display:grid;grid-template-columns:1fr 1fr;width:100%}"
      + ".spm-st{padding:0 12px;min-width:0}.spm-st:nth-child(odd){border-left:0;padding-left:0}"
      + ".spm-st b{font-size:20px;overflow-wrap:anywhere}.spm-win .nm{font-size:20px}}"
      + SHEET_CSS
      + "</style><div class='spm-wrap' id='spmWrap'><div class='spm-empty'>Reading the record…</div></div>";

    const wrap = host.querySelector("#spmWrap");

    // ---------------------------------------------------------------- helpers
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
                    "September", "October", "November", "December"];
    const monLab = m => {
      if (!m) return "—";
      const [y, mo] = String(m).split("-");
      return MONTHS[+mo - 1] + " " + y;
    };
    const monShort = m => (m ? monLab(m).slice(0, 3) + " " + String(m).slice(0, 4) : "—");
    const ord = n => {
      if (n == null) return "—";
      const s = ["th", "st", "nd", "rd"], v = n % 100;
      return n + (s[(v - 20) % 10] || s[v] || s[0]);
    };
    const first = name => String(name || "").split(" ")[0];
    const growing = mm => mm != null && mm < 2;

    // ---------------------------------------------------------------- data
    /* Each mart loads on its own: a mart that is not built yet (the first deploy, or a failed
     * build) must cost its own panel, not the whole page. */
    function load() {
      wrap.innerHTML = "<div class='spm-empty'>Reading the record…</div>";
      const one = (k, ds) => RS.load(ds).then(rows => { S[k] = (rows || []).slice(); S.err[k] = null; })
        .catch(e => { S[k] = []; S.err[k] = String(e && e.message || e); });
      Promise.all([one("line", "supotm_line"), one("work", "supotm_work"),
                   one("score", "supotm_score")]).then(paint);
    }

    const monthsOf = () => Array.from(new Set((S.work || []).map(r => r["Month"])
      .concat((S.line || []).map(r => r["Month"])))).filter(Boolean).sort().reverse();
    const maturedOf = m => {
      const r = (S.work || []).find(x => x["Month"] === m) || (S.line || []).find(x => x["Month"] === m);
      return r ? num(r["Months Matured"]) : null;
    };
    const scoreOf = (m, p) => (S.score || []).find(r => r["Month"] === m && r["Person"] === p) || null;
    const workOf = (m, p) => (S.work || []).find(r => r["Month"] === m && r["Person"] === p) || null;

    // the people of a month: ranked first by place, then the rest by claims owned
    function peopleFor(m) {
      return (S.work || []).filter(r => r["Month"] === m && num(r["Is Person"]) === 1)
        .map(w => ({ w, s: scoreOf(m, w["Person"]) }))
        .sort((a, b) => {
          const ra = a.s ? num(a.s["Rank"]) : null, rb = b.s ? num(b.s["Rank"]) : null;
          if (ra != null && rb != null) return ra - rb;
          if (ra != null) return -1;
          if (rb != null) return 1;
          const ta = num(a.w["On Team"]) || 0, tb = num(b.w["On Team"]) || 0;
          if (ta !== tb) return tb - ta;
          return (num(b.w["Claims Owned"]) || 0) - (num(a.w["Claims Owned"]) || 0);
        });
    }

    function prevRank(p, m) {
      const all = monthsOf().slice().sort();
      const i = all.indexOf(m);
      if (i <= 0) return null;
      return scoreOf(all[i - 1], p);
    }

    /* A REVERSAL is a pair strictly ahead under one reading and strictly behind under the
     * other; a tie opening or closing is not one. The same rule the mart's test used. */
    function reversals(people, cols) {
      const out = [];
      for (let i = 0; i < people.length; i++) for (let j = i + 1; j < people.length; j++) {
        const a = people[i].w, b = people[j].w;
        const x0 = num(a[cols[0]]), y0 = num(b[cols[0]]);
        [1, 2].forEach(k => {
          const x1 = num(a[cols[k]]), y1 = num(b[cols[k]]);
          if ([x0, y0, x1, y1].some(v => v == null)) return;
          const s0 = Math.sign(x0 - y0), s1 = Math.sign(x1 - y1);
          if (s0 && s1 && s0 !== s1) out.push({ k, pair: first(a["Person"]) + " and " + first(b["Person"]) });
        });
      }
      return out;
    }

    // ---------------------------------------------------------------- paint
    function paint() {
      const months = monthsOf();
      if (!months.length) {
        wrap.innerHTML = "<div class='spm-empty'>"
          + (S.err.work ? "Could not load the claim work — " + esc(S.err.work)
                        : "No months to show yet.") + "</div>";
        return;
      }
      // OPEN ON THE NEWEST MONTH THAT HAS ENDED. The month we are standing in is a handful of
      // days and a ranking that will not survive the week; an award lands on a month that
      // happened, and says so when that month is still growing.
      if (!S.month || months.indexOf(S.month) < 0) {
        S.month = months.find(m => (maturedOf(m) || 0) >= 1) || months[0];
      }
      const m = S.month;
      const mm = maturedOf(m);
      const people = peopleFor(m);
      const ranked = people.filter(p => p.s && num(p.s["Rank"]) != null);
      const mRows = (S.work || []).filter(r => r["Month"] === m);
      // the mart's own count of the month's claims: the people's shares are rounded to 2
      // places, so their sum prints 46.0 for July 2026's 46 claims (review 2026-09-24)
      const filedCol = mRows.length ? num(mRows[0]["Claims Filed In Month"]) : null;
      const claimsFiled = filedCol != null ? filedCol
        : Math.round(10 * mRows.reduce((a, r) => a + (num(r["Claims Owned"]) || 0), 0)) / 10;
      const unassigned = num((mRows.find(r => r["Person"] === "Unassigned") || {})["Claims Owned"]) || 0;

      /* A MART THAT DID NOT LOAD IS SAID, NEVER READ AS AN EMPTY MONTH (review 2026-09-24): with
       * the scorecard missing the page used to say "Nobody owned 10 claims" over people who
       * owned 16, 16 and 20; with the casework missing, "every one owned" over 0 claims. */
      const fail = S.err.work ? ["claim work", S.err.work] : S.err.score ? ["scorecard", S.err.score] : null;
      const failBox = () => "<div class='spm-empty'>The " + fail[0] + " could not be loaded — "
        + esc(fail[1]) + ". Nobody is ranked until it loads; nothing here is a zero.</div>";

      wrap.innerHTML = hero(months, m, mm, people, ranked, claimsFiled, unassigned)
        + (fail ? "<div class='spm-win'><div class='medal dim'>!</div><div><div class='k'>"
                  + esc(monLab(m)) + "</div><div class='nm'>No ranking shown</div><div class='why'>The "
                  + fail[0] + " could not be loaded — " + esc(fail[1]) + ".</div></div></div>"
                : winnerCard(m, mm, people, ranked))
        + "<div class='panel'><div class='spm-sec'>The claim work, person by person — "
        + esc(monLab(m)) + "</div>" + (S.err.work ? failBox() : compare(m, mm, people)) + "</div>"
        + "<div class='panel'><div class='spm-sec'>How stable is this order</div>"
        + (fail ? failBox() : stability(m, ranked, people)) + "</div>"
        + "<div class='panel'><div class='spm-sec'>The support line — the whole team, one shared phone</div>"
        + teamPanel(m) + "</div>";
      wire();
    }

    function hero(months, m, mm, people, ranked, claimsFiled, unassigned) {
      const stat = (lab, v, sub) => "<div class='spm-st'><span>" + esc(lab) + "</span><b>"
        + v + "</b><small>" + sub + "</small></div>";
      const leader = ranked[0] || null;
      const maturity = mm == null ? "—" : mm <= 0 ? "still running" : mm === 1 ? "one month on"
                     : mm + " months on";
      return "<div class='panel'><div class='spm-htop'><div><div class='spm-mwrap'>"
        + "<button class='spm-monbtn' id='spmMonBtn'>" + esc(monLab(m))
        + " <span class='car'>▾</span></button><div class='spm-mlist' id='spmMList'>"
        + months.map(x => {
            const n = peopleFor(x).filter(p => p.s && num(p.s["Rank"]) != null).length;
            const xm = maturedOf(x), g = growing(xm);
            return "<button class='spm-mopt" + (x === m ? " cur" : "") + "' data-m='" + esc(x) + "'>"
              + esc(monLab(x)) + "<span class='tag" + (g ? " yg" : "") + "'>"
              + [S.err.work || S.err.score ? "" : n + " ranked",
                 xm != null && xm <= 0 ? "running" : g ? "still growing" : ""].filter(Boolean).join(" · ")
              + "</span></button>";
          }).join("")
        + "</div></div>"
        + "<div class='spm-sub'>Counted from the Monday claims board: the claims filed in "
        + esc(monLab(m)) + ", who owns them, how fast they reached their last status and whether "
        + "they escalated. Nobody rates anybody here. <b>With three people and about 15–20 claims "
        + "each, this order is fragile</b> — a claim or two either way can move it, so read the "
        + "stability panel before the ranking."
        + (growing(mm) ? " <b>" + esc(monLab(m)) + " is still growing</b> — its claims are still "
                         + "reaching their last status, so these numbers will move." : "")
        + "</div></div>"
        + "<div class='spm-stats'>"
        + (S.err.work ? stat("Claims filed", "—", "claim work not loaded")
           : stat("Claims filed", fmtC(claimsFiled), unassigned ? fmtC(unassigned) + " with no owner"
                                                                : "every one owned"))
        + (S.err.work || S.err.score
           ? stat("Ranked", "—", (S.err.work ? "claim work" : "scorecard") + " not loaded")
             + stat("Leading", "—", (S.err.work ? "claim work" : "scorecard") + " not loaded")
           : stat("Ranked", fmtN(ranked.length), people.length > ranked.length
                  ? (people.length - ranked.length) + (people.every(p => ranked.indexOf(p) >= 0
                      || (num(p.w["Claims Owned"]) || 0) < SOTM_RULES.minClaims)
                      ? " under " + SOTM_RULES.minClaims + " claims" : " not ranked")
                  : "everyone with claims")
             + stat("Leading", leader ? esc(first(leader.w["Person"])) : "—",
                    leader ? fmt1(num(leader.s["Score"])) + " of 100" : "nobody qualifies"))
        + stat("Month", esc(maturity), growing(mm) ? "provisional" : "settled")
        + "</div></div></div>";
    }

    function holdsTag(s) {
      const oh = num(s && s["Order Holds Of 4"]), lh = num(s && s["Leader Holds Of 4"]);
      // one person ranked is not an order, so there is nothing for a re-reading to hold
      if (oh == null || (num(s["Ranked People"]) || 0) < 2) return "";
      if (oh === 4) return "<span class='spm-tag ok'>order holds under all 4 re-readings</span>";
      return "<span class='spm-tag frag'>" + (lh === 4 ? "leader holds, order moves under "
        + (4 - oh) + " of 4" : "leader changes under " + (4 - lh) + " of 4 re-readings") + "</span>";
    }

    function winnerCard(m, mm, people, ranked) {
      const tops = ranked.filter(p => num(p.s["Rank"]) === 1);
      if (!tops.length) {
        const enough = people.some(p => (num(p.w["Claims Owned"]) || 0) >= SOTM_RULES.minClaims);
        return "<div class='spm-win'><div class='medal dim'>–</div><div><div class='k'>"
          + esc(monLab(m)) + "</div><div class='nm'>No winner</div><div class='why'>"
          + (enough ? "Nobody could be scored this month (see the reason under each name)"
                    : "Nobody owned " + SOTM_RULES.minClaims + " claims this month")
          + ", so nobody is ranked — everyone is still shown below.</div></div></div>";
      }
      const running = mm != null && mm <= 0;
      const k = running ? "Leading so far — " + monLab(m) + " is still running"
              : (tops.length > 1 ? "Joint Support of the Month — " : "Support of the Month — ") + monLab(m);
      const s = tops[0].s;
      return "<div class='spm-win'><div class='medal" + (running ? " dim" : "") + "'>★</div><div>"
        + "<div class='k'>" + esc(k)
        + (growing(mm) && !running ? "<span class='spm-tag yg'>still growing</span>" : "") + "</div>"
        + "<div class='nm'>" + tops.map(p => esc(p.w["Person"])).join(" and ") + "</div>"
        + "<div class='why'>" + tops.map(p => esc((tops.length > 1 ? first(p.w["Person"]) + ": " : "")
                                                   + whyLine(p))).join("")
        + (ranked.length === 1 ? "The only person with " + SOTM_RULES.minClaims
           + " or more claims this month — a default, not a contest. " : "")
        + holdsTag(s) + "</div></div>"
        + "<div class='sc'><b>" + fmt1(num(s["Score"])) + "</b><i>of 100 · "
        + fmtN(num(s["Ranked People"])) + " ranked</i></div></div>";
    }

    /* THE DAYS THE SCORE READ, or why it read none — the same gate as the table row, so the
     * winner card and the sheet never cite a median the score did not use (review 2026-09-24). */
    function daysRead(w) {
      const d = num(w["Median Days All Claims"]), n = num(w["Claims Timed"]) || 0;
      const open = num(w["Timed At Age So Far"]) || 0;
      if (d == null || n < SOTM_RULES.minDaysOn) return { d: null, n, open,
        text: "days not read — " + n + " claim" + (n === 1 ? "" : "s") + " timed, "
              + SOTM_RULES.minDaysOn + " needed" };
      return { d, n, open, text: "median " + fmt1(d) + " days over " + fmtN(n) + " claims"
        + (open ? " (" + fmtN(open) + " unresolved, timed at their age so far)" : "") };
    }

    function whyLine(p) {
      const w = p.w, e = num(w["Escalations"]);
      return fmtC(num(w["Claims Owned"])) + " claims owned · " + daysRead(w).text + " · "
        + (e ? fmtC(e) + " escalated" : "none escalated") + ". ";
    }

    // ---------------------------------------------------------------- the side-by-side table
    function compare(m, mm, people) {
      if (!people.length) return "<div class='spm-empty'>No claim owners this month.</div>";
      const head = "<thead><tr><th class='lab'></th>" + people.map(p => {
        const s = p.s || {}, name = String(p.w["Person"]);
        const rank = num(s["Rank"]), score = num(s["Score"]);
        const why = s["Not Ranked Because"] || (!p.s ? "not scored" : "");
        const gone = num(p.w["On Team"]) !== 1;
        // the bar is the score: points over the weight that was measured, so a score out of
        // fewer than 100 points fills its bar as far as its number says
        const wm = num(s["Weight Measured"]) || 100;
        const segs = [["Points Days", "--spm-c1", "Days", SOTM_RULES.wDays],
                      ["Points Escalation", "--spm-c2", "Escalations", SOTM_RULES.wEsc]]
          .map(([c, col, lab, w]) => {
            const v = num(s[c]);
            return v ? "<u style='width:" + (100 * v / wm).toFixed(2) + "%;background:var(" + col
              + ")' title='" + esc(lab) + " " + fmt1(v) + " of " + w + "'></u>" : "";
          }).join("");
        return "<th><div class='spm-ph'><div class='hd'><div class='spm-rk"
          + (rank === 1 ? " top" : rank == null ? " oor" : "") + "'>" + (rank == null ? "–" : rank)
          + "</div><div class='nm'>" + esc(name)
          + (gone ? "<span class='spm-tag'>no longer on the team</span>" : "") + "</div></div>"
          + (rank != null ? "<div class='scr'>" + fmt1(score) + "<small> / 100</small></div>"
             + "<div class='spm-bar'>" + segs + "</div>"
             + (num(s["Weight Measured"]) != null && num(s["Weight Measured"]) < 100
                ? "<div class='oor'>measured on " + fmtN(num(s["Weight Measured"])) + " of the 100 points</div>" : "")
             : "<div class='oor'>" + esc(why) + "</div>")
          + (rank != null ? "<button class='spm-rep' data-rep='" + esc(name) + "'>Report</button>" : "")
          + "</div></th>";
      }).join("") + "</tr></thead>";

      const row = (lab, sub, cell) => "<tr><td class='lab'>" + esc(lab)
        + (sub ? "<small>" + esc(sub) + "</small>" : "") + "</td>"
        + people.map(p => { const c = cell(p); return "<td" + (c.na ? " class='na'" : "") + "><div class='v'>"
          + c.v + "</div>" + (c.s ? "<div class='s'>" + c.s + "</div>" : "") + "</td>"; }).join("") + "</tr>";
      const grp = t => "<tr class='grp'><td colspan='" + (people.length + 1) + "'>" + esc(t) + "</td></tr>";

      const body = grp("Scored — " + SOTM_RULES.wDays + " + " + SOTM_RULES.wEsc + " points")
        + row("Median days, every owned claim",
              "a resolved claim from filing to its last status change, an unresolved one at its "
              + "age so far — full marks at " + SOTM_RULES.daysFull + " days or under, none at "
              + SOTM_RULES.daysZero + "+",
              p => {
                const r = daysRead(p.w), pts = p.s ? num(p.s["Points Days"]) : null;
                if (r.d == null) return { na: true, v: "—", s: esc(r.text) };
                return { v: fmt1(r.d) + " days", s: "over " + fmtN(r.n) + " claims"
                  + (r.open ? ", " + fmtN(r.open) + " still unresolved" : "")
                  + (pts != null ? " · " + fmt1(pts) + " / " + SOTM_RULES.wDays + " pts" : "") };
              })
        + row("Escalations", "a bank dispute or a negative review — lower is better; none at all "
              + "is full marks, one claim in " + Math.round(1 / SOTM_RULES.escZero) + " is none",
              p => {
                const e = num(p.w["Escalations"]) || 0, o = num(p.w["Claims Owned"]) || 0;
                const pts = p.s ? num(p.s["Points Escalation"]) : null;
                return { v: e ? fmtC(e) + " of " + fmtC(o) : "none",
                  s: pct0(num(p.w["Escalation Rate"])) + " of owned claims"
                    + (pts != null ? " · " + fmt1(pts) + " / " + SOTM_RULES.wEsc + " pts" : "") };
              })
        + grp("Shown, not scored")
        + row("Claims owned", "a shared claim gives each owner a share", p => ({
                v: fmtC(num(p.w["Claims Owned"])),
                s: fmtN(num(p.w["Claims Touched"])) + " touched · " + fmtN(num(p.w["Shared Claims"])) + " shared" }))
        + row("Resolved", "not scored on its own: its order reversed in 3 of 4 months when re-read "
              + "(see below) — an unresolved claim is timed at its age in the days above",
              p => ({ v: pct0(num(p.w["Resolved Share"])),
                      s: fmtC(num(p.w["Resolved"])) + " of " + fmtC(num(p.w["Claims Owned"])) + " in a Closed group" }))
        + row("Median days, resolved claims alone", "not scored: it leaves out every claim still "
              + "unresolved, so leaving the slow ones open would lower it",
              p => {
                const d = num(p.w["Median Days To Last Status"]), n = num(p.w["Days Measured On"]) || 0;
                return d == null ? { na: true, v: "—", s: "none resolved" }
                                 : { v: fmt1(d) + " days", s: "over " + fmtN(n) + " resolved" };
              })
        + row("Still open", "", p => ({ v: fmtC(num(p.w["Still Open"])) }))
        + row("Customer went silent", "parked in “no respond after claim form”",
              p => ({ v: fmtC(num(p.w["Customer Went Silent"])) }))
        + row("Updates written", "on the claims board — volume and style, not quality", p => {
                const u = num(p.w["Updates Written"]);
                return u == null ? { na: true, v: "—", s: "their Monday account no longer exists" } : { v: fmtN(u) };
              })
        + row("Negative-review cases", "owned on the reviews board", p => {
                const c = num(p.w["Negative Review Cases"]);
                if (c == null) return { na: true, v: "—" };
                return { v: fmtN(c), s: c ? fmtN(num(p.w["Negative Reviews Removed"])) + " removed" : "" };
              })
        + row("Last month", "", p => {
                if (S.err.score) return { na: true, v: "—", s: "scorecard not loaded" };
                const pr = prevRank(p.w["Person"], m);
                if (!pr) return { na: true, v: "—", s: "no earlier month" };
                const r = num(pr["Rank"]);
                return r == null ? { na: true, v: "not ranked", s: monShort(pr["Month"]) }
                                 : { v: ord(r), s: monShort(pr["Month"]) + " · " + fmt1(num(pr["Score"])) };
              });

      return (S.err.score ? "<div class='spm-empty' style='padding:14px 16px;margin-bottom:10px'>"
                + "The scorecard could not be loaded — " + esc(S.err.score) + ". Nobody is placed; "
                + "the claim facts below are complete.</div>" : "")
        + "<div class='spm-cmpwrap'><table class='spm-cmp'>" + head + "<tbody>" + body
        + "</tbody></table></div>"
        + "<div class='spm-note'>A claim belongs to the month it was filed and to whoever the board "
        + "names as its owner (the People column first, the old dropdown when People is blank). "
        + "At least " + SOTM_RULES.minClaims + " owned claims to be ranked. <b>Every owned claim is "
        + "timed</b>: a resolved one from filing to its last status change, an unresolved one (open, "
        + "customer silent, stuck) at its age so far — so leaving a claim open never scores better "
        + "than closing it, and a month keeps moving while its claims are open. A person with no "
        + "escalations has a real zero, which is full marks. <b>What changed, 24 Sep 2026:</b> the "
        + "days were first read over the resolved claims alone, which put August's lowest resolver "
        + "first on 100 points (Mariam: 7 of 16 resolved, at 6.7 days; Avto 87.5, Nikoloz 80.3). "
        + "Timed over every owned claim, August read Mariam 24.3, Avto 24.0 and Nikoloz 31.7 days "
        + "that day, and scores 62.9, 51.1 and 47.1 — the same order, far closer.</div>";
    }

    // ---------------------------------------------------------------- stability
    function stability(m, ranked, people) {
      const sRows = ranked.map(p => p.s);
      let left;
      if (ranked.length < 2) {
        left = "<div class='spm-note' style='margin-top:0'>" + (ranked.length
          ? "Only " + esc(first(ranked[0].w["Person"])) + " is ranked this month, so there is no order to test."
          : "Nobody is ranked this month.") + "</div>";
      } else {
        const oh = num(sRows[0]["Order Holds Of 4"]), lh = num(sRows[0]["Leader Holds Of 4"]);
        left = "<div style='font-size:14px;font-weight:750;color:var(--ink);margin-bottom:8px'>"
          + "The order holds under " + oh + " of 4 re-readings; the leader under " + lh + " of 4.</div>"
          + "<ul class='spm-vl'>" + VARIANTS.map(v => {
              const moved = sRows.some(s => num(s[v.rk]) !== num(s["Rank"]));
              const lead = ranked.filter(p => num(p.s[v.rk]) === 1).map(p => first(p.w["Person"]));
              return "<li><span class='" + (moved ? "mv'>✗" : "ok'>✓") + "</span><span><b>" + esc(v.label)
                + "</b> — " + esc(v.what) + ": " + (moved ? "order becomes "
                  + ranked.slice().sort((a, b) => num(a.s[v.rk]) - num(b.s[v.rk]))
                      .map(p => esc(first(p.w["Person"])) + " " + fmt1(num(p.s[v.sc]))).join(", ")
                  + (lead.join() !== first(ranked[0].w["Person"]) ? " — " + esc(lead.join(" and ")) + " would lead" : "")
                  : "same order") + "</span></li>";
            }).join("") + "</ul>";
      }
      // each claim measure's OWN order, re-read, for this month's ranked people
      const own = "<ul class='spm-vl'>" + MEASURES.map(me => {
          const rv = ranked.length >= 2 ? reversals(ranked, me.cols) : [];
          const ks = Array.from(new Set(rv.map(r => r.k === 1 ? "wider" : "tighter")));
          return "<li><span class='" + (rv.length ? "mv'>✗" : "ok'>✓") + "</span><span><b>" + esc(me.label)
            + "</b>" + (me.scored ? "" : " (not scored)") + ": "
            + (ranked.length < 2 ? "nothing to compare"
               : rv.length ? "reverses read " + ks.join(" and ") + " (" + esc(Array.from(new Set(rv.map(r => r.pair))).join("; ")) + ")"
               : "no reversal") + "</span></li>";
        }).join("") + "</ul>";
      // across every finished month on file, how often did the whole order survive?
      const done = monthsOf().filter(x => (maturedOf(x) || 0) >= 1);
      const tested = done.filter(x => peopleFor(x).filter(p => p.s && num(p.s["Rank"]) != null).length >= 2);
      const held = tested.filter(x => {
        const r = (S.score || []).find(s => s["Month"] === x && num(s["Rank"]) != null);
        return r && num(r["Order Holds Of 4"]) === 4;
      });
      return "<div class='spm-stab'><div>" + left + "</div><div>"
        + "<div style='font-size:13px;font-weight:750;color:var(--ink);margin-bottom:8px'>Each measure's own order, re-read</div>"
        + own + "</div></div>"
        + "<div class='spm-note'><b>What the re-readings are.</b> Each scored measure is read once a "
        + "little wider and once a little tighter, and the score is recomputed with only that one "
        + "change. If the order moves, the ranking is resting on a definition, not on the people. "
        + (tested.length ? "Across the " + tested.length + " finished months with two or more people ranked, "
           + "the whole order held under all four in " + held.length + "." : "")
        + "<br><b>Tested 24 Sep 2026 on May–August 2026:</b> the share of claims resolved reversed "
        + "the order in 3 of 4 months (June read both ways, July tighter, August wider), so it is "
        + "shown and not scored — an unresolved claim counts in the days instead, at its age. The "
        + "median days over every owned claim reversed once (June, read wider: counting a claim "
        + "whose customer went silent as resolved moves Mariam from 44.0 days to 10.0) and "
        + "escalations once (June, read tighter); both are scored. With three people and about "
        + "15–20 claims each, one claim more or less can move this order.</div>";
    }

    // ---------------------------------------------------------------- the team panel
    function teamPanel(m) {
      if (S.err.line) return "<div class='spm-empty'>The support line could not be loaded — "
        + esc(S.err.line) + "</div>";
      const r = (S.line || []).find(x => x["Month"] === m);
      if (!r) return "<div class='spm-empty'>No support-line figures for " + esc(monLab(m)) + ".</div>";
      const outside = num(r["Missed Outside Number"]) || 0, missed = num(r["Missed Calls"]) || 0;
      const tr = num(r["Transcripts"]);
      const tile = (l, v, s) => "<div class='spm-tile'><div class='l'>" + esc(l) + "</div><div class='v'>"
        + v + "</div>" + (s ? "<div class='s'>" + s + "</div>" : "") + "</div>";
      const mins = num(r["Median Callback Minutes"]);
      return "<div class='spm-tiles'>"
        + tile("Calls answered", fmtN(num(r["Answered Calls"])), "inbound, picked up on the support line")
        + tile("Missed calls", fmtN(missed), "10 seconds or longer — a shorter ring is a hang-up")
        + tile("Called back within 1 hour", pct0(num(r["Called Back 1h Share"])),
               fmtN(num(r["Called Back 1h"])) + " of " + fmtN(outside) + " from an outside number")
        + tile("Called back within 24 hours", pct0(num(r["Called Back 24h Share"])),
               fmtN(num(r["Called Back 24h"])) + " of " + fmtN(outside))
        + tile("Reached within 24 hours", pct0(num(r["Reached 24h Share"])),
               "called back, or rang again and support picked up — " + fmtN(num(r["Reached 24h"]))
               + " of " + fmtN(outside) + " · " + pct0(num(r["Reached 1h Share"])) + " within 1 hour")
        + tile("Typical callback wait", mins == null ? "—" : (mins < 90 ? Math.round(mins) + " min"
               : fmt1(mins / 60) + " h"), "median, of the calls returned the same day")
        + tile("Outbound calls", fmtN(num(r["Outbound Calls"])), "placed from the support line")
        + tile("Texts", fmtN(num(r["Texts In"])) + " in · " + fmtN(num(r["Texts Out"])) + " out", "on the support number")
        + tile("Transcripts", tr == null ? "—" : fmtN(tr), tr == null ? "none recorded before June 2026" : "RingSense, support user")
        + "</div><div class='spm-note'>All of the support team's phone work runs through one shared "
        + "RingCentral user (extension 1, “Support Zip To Zip”), and it stays that way — so "
        + "no call can be credited to Mariam, Avto or Nikoloz. This panel is the team's, and it never "
        + "ranks anybody." + (missed > outside ? " " + fmtN(missed - outside) + " of the missed calls "
        + "came from our own extensions or a withheld number and are left out of the callback share." : "")
        + " A callback is the support line's first outbound call to the same number after the miss; "
        + "a caller who rang again and was answered by support is <b>reached</b> but not called back."
        + " <b>A different base from the 24 Sep 2026 discovery:</b> that study read August as 83% called "
        + "back within 1 hour and 94% within 24, over the support phone's own missed rings (253 calls); "
        + "this panel reads every missed or voicemail call that rang the support user from an outside "
        + "number (293 in August), so its shares run lower. Neither is a change in how the team works.</div>";
    }

    // ---------------------------------------------------------------- the printable sheet
    function reportHtml(name) {
      const m = S.month, w = workOf(m, name) || {}, s = scoreOf(m, name) || {};
      const line = (S.line || []).find(x => x["Month"] === m) || {};
      const score = num(s["Score"]), rank = num(s["Rank"]), wm = num(s["Weight Measured"]);
      const dr = daysRead(w), dRes = num(w["Median Days To Last Status"]);
      const strip = [
        ["Claims owned", fmtC(num(w["Claims Owned"])), fmtN(num(w["Claims Touched"])) + " touched"],
        ["Median days", dr.d == null ? "—" : fmt1(dr.d), dr.d == null ? "not read"
          : "every owned claim" + (dr.open ? ", " + dr.open + " still unresolved" : "")],
        ["Escalated", fmtC(num(w["Escalations"]) || 0), pct0(num(w["Escalation Rate"])) + " of owned"],
        ["Resolved", pct0(num(w["Resolved Share"])), "shown, not scored"],
      ].map(x => "<div><span class='l'>" + esc(x[0]) + "</span><span class='v'>" + x[1]
        + "</span><span class='s'>" + esc(x[2]) + "</span></div>").join("");
      const trow = (lab, blurb, read, pts, w0, bar) => "<tr><td><b>" + esc(lab) + "</b><br><span class='q'>"
        + esc(blurb) + "</span></td><td class='q'>" + esc(read)
        + (bar == null ? "" : "<div class='bar'><i style='width:" + Math.round(100 * bar) + "%'></i></div>")
        + "</td><td class='n'>" + (pts == null ? "—" : fmt1(pts)) + " <span class='q'>/ " + w0 + "</span></td></tr>";
      const holds = num(s["Order Holds Of 4"]);
      return "<div class='spm-sheet' id='spmSheet'><div class='fit'>"
        + "<div class='rhd'><div><h1>" + esc(name) + "</h1><div class='sub'>Support claim work for "
        + esc(monLab(m)) + (growing(num(w["Months Matured"])) ? " · still growing" : "") + "</div></div>"
        + "<div class='big'><b>" + (score == null ? "—" : fmt1(score)) + "</b><i>"
        + (rank == null ? "not ranked" : "out of 100 · place #" + rank + " of " + fmtN(num(s["Ranked People"])))
        + "</i></div></div>"
        + "<div class='rstrip'>" + strip + "</div>"
        + "<h2>How the score was made — counted from the claims board, nobody rated anybody</h2>"
        + "<table><thead><tr><th>Measure</th><th>What the record shows</th><th class='n'>Earned</th></tr></thead><tbody>"
        + trow("Days, every owned claim", "median days: a resolved claim from filing to its last status "
               + "change, an unresolved one at its age so far; full marks at "
               + SOTM_RULES.daysFull + " days or under, none at " + SOTM_RULES.daysZero + "+",
               dr.d == null ? dr.text : dr.text + (dRes == null ? "" : "; the resolved ones alone "
                 + fmt1(dRes) + " days (not scored)"),
               dr.d == null ? null : num(s["Points Days"]), SOTM_RULES.wDays,
               dr.d == null ? null : num(s["Bar Days"]))
        + trow("Escalations", "claims that went to a bank dispute or a negative review; none is full marks, one in "
               + Math.round(1 / SOTM_RULES.escZero) + " is none",
               (num(w["Escalations"]) ? fmtC(num(w["Escalations"])) : "none") + " of " + fmtC(num(w["Claims Owned"]))
               + " owned claims", num(s["Points Escalation"]), SOTM_RULES.wEsc, num(s["Bar Escalation"]))
        + "</tbody></table>"
        + "<h2>Shown, not scored</h2><table><tbody>"
        + "<tr><td>Resolved (in a Closed group)</td><td class='n'>" + fmtC(num(w["Resolved"])) + " of "
        + fmtC(num(w["Claims Owned"])) + "</td><td class='q'>its order reversed in 3 of 4 months when re-read, so it is not scored</td></tr>"
        + "<tr><td>Still open · customer went silent</td><td class='n'>" + fmtC(num(w["Still Open"])) + " · "
        + fmtC(num(w["Customer Went Silent"])) + "</td><td class='q'></td></tr>"
        + "<tr><td>Updates written on the claims board</td><td class='n'>" + fmtN(num(w["Updates Written"]))
        + "</td><td class='q'>volume and style, not quality</td></tr>"
        + "<tr><td>Negative-review cases owned</td><td class='n'>" + fmtN(num(w["Negative Review Cases"]))
        + "</td><td class='q'>" + fmtN(num(w["Negative Reviews Removed"])) + " removed</td></tr>"
        + "</tbody></table>"
        + "<h2>The support line this month — the whole team, never ranked</h2><table><tbody>"
        + "<tr><td>Calls answered · missed (10 s+)</td><td class='n'>" + fmtN(num(line["Answered Calls"])) + " · "
        + fmtN(num(line["Missed Calls"])) + "</td></tr>"
        + "<tr><td>Called back within 1 hour · 24 hours</td><td class='n'>" + pct0(num(line["Called Back 1h Share"]))
        + " · " + pct0(num(line["Called Back 24h Share"])) + "</td></tr>"
        + "<tr><td>Reached within 1 hour · 24 hours (called back, or rang again and answered)</td><td class='n'>"
        + pct0(num(line["Reached 1h Share"])) + " · " + pct0(num(line["Reached 24h Share"])) + "</td></tr>"
        + "<tr><td>Outbound calls · texts in / out</td><td class='n'>" + fmtN(num(line["Outbound Calls"])) + " · "
        + fmtN(num(line["Texts In"])) + " / " + fmtN(num(line["Texts Out"])) + "</td></tr>"
        + "</tbody></table>"
        + "<div class='foot'>A claim belongs to the month it was filed and to whoever the board names "
        + "as its owner; a shared claim gives each owner a share. At least " + SOTM_RULES.minClaims
        + " owned claims to be ranked." + (wm != null && wm < 100 ? " Only " + wm + " of the 100 points "
        + "could be measured this month, so the score is taken out of those." : "")
        + " With three people and about 15–20 claims each the order is fragile"
        + (holds == null ? "" : ": this month it held under " + holds + " of 4 re-readings of the measures")
        + ". The phone runs on one shared line and is the team's, not this person's. Generated "
        + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        + ".</div></div></div>";
    }

    const fitBox = (sheet, w2) => {
      const box = sheet && sheet.querySelector(".fit");
      if (!box) return;
      box.style.transform = ""; box.style.width = "";
      const cs = (w2 || window).getComputedStyle(sheet);
      const avail = sheet.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      const need = box.scrollHeight;
      if (need > avail && need > 0) {
        const k = Math.max(0.62, avail / need);
        box.style.transformOrigin = "top left";
        box.style.transform = "scale(" + k.toFixed(4) + ")";
        box.style.width = (100 / k).toFixed(2) + "%";
      }
    };

    function printSheet(name, sheet) {
      if (!sheet) return;
      const doc = '<!doctype html><html><head><meta charset="utf-8"><title>'
        + esc(name + " — " + monLab(S.month)) + "</title><style>"
        + "@page{size:A4 portrait;margin:0}"
        + "*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}"
        + "html,body{margin:0;padding:0;background:#fff}"
        + SHEET_CSS + ".spm-sheet{box-shadow:none;margin:0}"
        + "</style></head><body>" + sheet.outerHTML + "</body></html>";
      if (!(window.RSC && RSC.printDoc)) { window.print(); return; }
      RSC.printDoc(doc, {
        title: name, width: "210mm", height: "297mm",
        // the frame lays the sheet out itself, so the fit is measured in ITS document
        beforePrint: (w2, d2) => fitBox(d2.getElementById("spmSheet"), w2),
      });
    }

    function closeReport() {
      document.querySelectorAll(".spm-rdim").forEach(e => e.remove());
      document.removeEventListener("keydown", onReportEsc);
    }
    function onReportEsc(e) { if (e.key === "Escape") closeReport(); }

    function openReport(name) {
      if (!workOf(S.month, name)) return;
      closeReport();
      const dim = document.createElement("div");
      dim.className = "spm-rdim";
      dim.innerHTML = "<div class='spm-rbar'><span class='sp'></span>"
        + "<button class='spm-rbtn pri' id='spmPdf'>Save as PDF</button>"
        + "<button class='spm-rbtn' id='spmRx'>Close</button></div>" + reportHtml(name);
      document.body.appendChild(dim);
      dim.addEventListener("click", e => { if (e.target === dim) closeReport(); });
      document.addEventListener("keydown", onReportEsc);
      const sheet = dim.querySelector("#spmSheet");
      // ORDER IS LOAD-BEARING: wire both buttons BEFORE measuring (sales-of-the-month.js)
      dim.querySelector("#spmRx").onclick = closeReport;
      dim.querySelector("#spmPdf").onclick = () => printSheet(name, sheet);
      try { fitBox(sheet); } catch (e) { /* the sheet is readable unscaled */ }
    }

    // ---------------------------------------------------------------- wiring
    function wire() {
      const btn = wrap.querySelector("#spmMonBtn"), list = wrap.querySelector("#spmMList");
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
        list.querySelectorAll(".spm-mopt").forEach(b => {
          b.onclick = e => { e.stopPropagation(); S.month = b.dataset.m; paint(); };
        });
      }
      wrap.querySelectorAll(".spm-rep").forEach(b => {
        b.onclick = e => { e.stopPropagation(); openReport(b.dataset.rep); };
      });
    }

    load();
  },
});
