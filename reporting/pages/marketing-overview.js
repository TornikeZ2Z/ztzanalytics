/* MARKETING OVERVIEW — the one page for marketing (Tornike 2026-10-15: "fully automated
 * marketing reporting. all in one page where we should have kinda everything together").
 *
 * TOP: WHAT EACH CHANNEL COST AND BROUGHT (2026-10-16, his decisions):
 *   * PERIOD: "Allow user to select whatever they want to select" -- the kit's period button
 *     (presets + any from/to), opening on This month and remembered per viewer: a preset is
 *     saved by NAME, so "This month" rolls into November by itself; a custom range by its dates.
 *   * BOOKED: "Leads from the period that booked" -- the cohort Source Analysis uses (leads
 *     CREATED in the period whose Status Category is 'Confirmed'), so both pages agree.
 *   * HEADLINE ("well, you tell me :)"): COST PER BOOKED JOB and $ PER $1, cost per lead after
 *     them. A lead is cheap to buy and easy to inflate; a booked job is what the money is for.
 *   * BOOKED VALUE ($ per $1 reads it): billed where the move happened, else the booked quote --
 *     a recent month has few moves done, and billed alone would call it a loss.
 *   * SPEND: the LIVE platform API where one exists (Google Ads, Local Services, Meta, ChatGPT,
 *     all Zip to Zip accounts) and the BANK LEDGER otherwise. The ledger is pasted monthly, so
 *     for days past its end a ledger channel has NO SPEND YET -- not free. Its cost figures are
 *     then read on the covered days only (spend and the leads of those same days), the row says
 *     so, and a period wholly past the ledger shows "not in yet" instead of a $0 that flatters.
 *   * PAID / UNPAID: a channel is paid when it has spend in the period or the year before its
 *     end (postcards are paid in lumps -- none in Jul-Aug 2026 -- and October, with no ledger
 *     yet, must still file Yelp as paid). The headline cost figures read paid channels only:
 *     organic and referral leads cost nothing to compare.
 *   * THE COMPARISON IS LIKE FOR LIKE, twice over. Bookings: last year's leads count as booked
 *     only if they had booked BY THE SAME POINT a year ago (mart `Booked Day`) -- 1-16 Oct 2025
 *     had 104 booked by 16 Oct 2025 and 142 by now, and comparing this October's young cohort
 *     with the 142 read as a 37% fall that was really 14%. Spend: a comparison day counts a
 *     ledger channel only if the matching day of the CURRENT period has its spend in, so while
 *     the ledger is behind both sides read the live channels alone.
 *   Data: mart_mkt_channel_day (src/mkt_overview_mart.py), one row per day x company x family.
 *
 * BOTTOM: THE DATA SOURCES (2026-10-15, his words: "show user what are the sources connected to
 * this dashboard and what is the latest status - is it up to date?"). One row per source from
 * mart_mkt_connector (src/mkt_connectors.py, rebuilt every hour after the freshness check):
 *   * MARKETING PLATFORMS — his eleven (Google split into Ads / Local Services / Analytics /
 *     Search Console, because each connects on its own), each with the login that holds it,
 *     the metrics he wants from it, whether data flows, and what unblocks it if not;
 *   * OUR OWN DATA — leads, calls, jobs, the bank spend ledger and the hand-dropped exports.
 * "Up to date" is judged against each source's OWN rhythm (Search Console is ~3 days behind by
 * design, the bank ledger is pasted monthly), so the status is computed in the mart. A strip
 * under the bar repeats it for the feeds the channel table reads.
 *
 * MIDDLE: THE AD PLATFORMS (stage 2, 2026-10-16) -- each platform's OWN numbers for the same
 * Company / Period / Compare bar, between the channel table and the source list:
 *   * GOOGLE ADS (ext_ads_campaign_day): cost, clicks, CTR, CPC and Google's conversions, a cost
 *     line, the split by campaign type (Performance Max / Search / Demand Gen) and every campaign.
 *   * LOCAL SERVICES (ext_lsa_cost_day + mart_mkt_lsa_lead_day): cost, Google's leads by job type,
 *     charged vs credited, phone vs message, cost per charged lead. The lead list itself holds
 *     callers' phones and never reaches the portal; the mart is a count.
 *   * META (ext_meta_ads_day): spend, impressions, clicks and RESULTS per campaign. A result is
 *     whatever the campaign is set to win (ad recallers, page likes, form leads...), so results of
 *     different kinds are listed side by side and never added. The account runs on LA time.
 *   * CHATGPT ADS (ext_chatgpt_ads_day): spend, impressions, clicks. No conversion event is
 *     attached in Ads Manager, so its 0 conversions mean "not measured" and the panel says so
 *     instead of printing 0 as a result.
 *   Every live account is Zip to Zip's: with Tuji picked the section says so instead of zeros.
 *   A comparison is drawn only when the platform already had data on the comparison's first day.
 *   The cost a panel shows is the same live spend the channel table reads for that family.
 *
 * Plan of record: docs/plans/2026-10-15-marketing-overview.md. The website (GA4) and search
 * panels come next.
 */
(function () {
  if (!window.RS || !RS.DATASETS) return;
  if (!RS.DATASETS.mkt_connector) {
    RS.DATASETS.mkt_connector = {
      table: "mart_mkt_connector",
      // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives.
      cols: ["Key", "Sort", "Group", "Platform", "Login", "Account", "Link", "Metrics",
             "Connection", "Status", "Status Note", "Next Step", "Newest Data", "Last Pulled",
             "Days Behind", "Expected Lag", "Bank Year", "Bank Spend", "Bank Last Charge",
             "Bank Through", "Note", "Checked At"],
    };
  }
  if (!RS.DATASETS.mkt_channel) {
    RS.DATASETS.mkt_channel = {
      table: "mart_mkt_channel_day",
      cols: ["Date", "Company", "Family", "Booked Day", "Leads", "Booked", "Moved", "Billed",
             "Booked Value",
             "Spend Live", "Spend Ledger", "Impressions", "Clicks", "Platform Conversions",
             "Ledger End"],
      // its own period picker, never the global date filter
      dateCols: {}, defaultDate: null,
    };
  }
  // the platform panels: each platform's own day table, a few thousand rows each, read whole and
  // cut to the period on the page (same period picker, never the global date filter)
  const PLAT = {
    mkt_ads: { table: "ext_ads_campaign_day",
               cols: ["Date", "Campaign Id", "Campaign", "Channel", "Cost", "Impressions", "Clicks",
                      "Conversions"] },
    mkt_lsa_cost: { table: "ext_lsa_cost_day", cols: ["Date", "Cost", "Impressions", "Clicks"] },
    mkt_lsa_lead: { table: "mart_mkt_lsa_lead_day", cols: ["Date", "Lead Type", "Service", "Charge", "Leads"] },
    mkt_meta: { table: "ext_meta_ads_day",
                cols: ["Date", "Campaign Id", "Campaign", "Objective", "Impressions", "Clicks", "Spend",
                       "Leads", "Results", "Result Indicator"] },
    mkt_gpt: { table: "ext_chatgpt_ads_day",
               cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks", "Spend", "Conversions"] },
  };
  Object.keys(PLAT).forEach(k => {
    if (!RS.DATASETS[k]) RS.DATASETS[k] = Object.assign({ dateCols: {}, defaultDate: null }, PLAT[k]);
  });
})();

(() => {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LS_PERIOD = "mkoPeriod", LS_CMP = "mkoCmp";
  const PAID_LOOKBACK = 365;         // days before the period's end that still make a channel paid
  const LIVE_CO = "Zip to Zip";      // every live ad account is Zip to Zip's
  const THIN = 5;                    // fewer booked jobs than this: the cost per booked is a guess
  // the feeds the channel table reads, in the strip under the bar (mart_mkt_connector keys)
  const FEEDS = [["leads", "Leads"], ["google-ads", "Google Ads"], ["google-lsa", "Local Services"],
                 ["meta", "Meta"], ["chatgpt", "ChatGPT Ads"], ["bank", "Bank ledger"]];
  // a channel whose leads are wider than its ads
  const FAM_NOTE = {
    "ChatGPT": "leads include visitors from chatgpt.com answers, not only the ads",
  };
  const PILL = { "Up to date": "ok", "Behind": "warn", "No data": "bad", "Not connected": "mute" };

  // module memory: survives a theme re-render, not a page load
  const S = { co: LIVE_CO, from: null, to: null, cmp: "ly", booted: false };
  const D = { ready: false, conn: [], connErr: null, rows: [], chErr: null,
              liveFrom: {}, ledgerEnd: null, minDay: null, maxDay: null };
  // the platform panels: rows per platform, its first / last day on file, a load error
  const P = { ads: [], lsaC: [], lsaL: [], meta: [], gpt: [], first: {}, last: {}, err: {} };
  const ADS_TYPE = { PERFORMANCE_MAX: "Performance Max", SEARCH: "Search", DEMAND_GEN: "Demand Gen",
                     DISPLAY: "Display", VIDEO: "Video", SHOPPING: "Shopping" };
  const META_OBJ = { OUTCOME_LEADS: "Leads", OUTCOME_AWARENESS: "Awareness", OUTCOME_ENGAGEMENT: "Engagement",
                     OUTCOME_TRAFFIC: "Traffic", OUTCOME_SALES: "Sales", OUTCOME_APP_PROMOTION: "App promotion" };
  // what a Meta "result" is, by the indicator Meta returns with it
  const META_KIND = {
    "estimated_ad_recallers": "ad recallers (est.)", "reach": "people reached",
    "actions:like": "page likes", "actions:offsite_conversion.fb_pixel_lead": "website leads",
    "actions:onsite_conversion.lead_grouped": "Facebook form leads", "lead": "leads",
    "total_profile_visits": "profile visits", "actions:post_engagement": "post engagements",
    "video_thruplay_watched_actions": "ThruPlays", "actions:link_click": "link clicks",
  };
  const LSA_CHARGE = ["Charged", "Credited", "In review", "Not charged"];

  /* ------------------------------------------------------------------ helpers ---- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = v => (window.RS && RS.num ? RS.num(v) : +v) || 0;
  const iso = d => d.toLocaleDateString("en-CA");
  const today = () => iso(new Date());
  function addDays(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  function addYears(s, n) { const d = new Date(s + "T12:00:00"); d.setFullYear(d.getFullYear() + n); return iso(d); }
  function dayCount(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5) + 1; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"; read the calendar day only, so no
  // browser timezone can move it
  function ymd(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function day(v) { const p = ymd(v); return p ? p.d + " " + MON[p.m - 1] + " " + p.y : "—"; }
  function shortDay(v) { const p = ymd(v); return p ? p.d + " " + MON[p.m - 1] : "—"; }
  function money(v) {
    if (v == null || isNaN(v)) return "—";
    const a = Math.abs(v), sg = v < 0 ? "−" : "";
    if (a >= 1e6) return sg + "$" + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return sg + "$" + (a / 1e3).toFixed(1) + "k";
    return sg + "$" + Math.round(a).toLocaleString("en-US");
  }
  const money0 = v => v == null || isNaN(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
  const fmtN = v => v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("en-US");
  const pct = v => v == null || isNaN(v) ? "—" : (100 * v).toFixed(1) + "%";
  const perDollar = v => v == null || isNaN(v) ? "—" : "$" + v.toFixed(v < 10 ? 2 : 1);
  const ratio = (a, b) => b > 0 ? a / b : null;

  /* ▲ / ▼ against the comparison window, as Source Analysis draws it. `lowerIsBetter` flips the
     colour for costs; null = a change neither good nor bad by itself (spending more). */
  function delta(cur, prev, lowerIsBetter) {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return "";
    if (!prev) return cur ? '<span class="mko-d eq">new</span>' : "";
    const d = cur / prev - 1;
    if (Math.abs(d) < 0.0005) return '<span class="mko-d eq">± 0%</span>';
    const good = lowerIsBetter ? d < 0 : d > 0;
    const cls = lowerIsBetter === null ? "eq" : (good ? "up" : "dn");
    return '<span class="mko-d ' + cls + '" title="change in percent">' + (d > 0 ? "▲ " : "▼ ")
      + Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + "%</span>";
  }

  function injectStyle() {
    const old = document.getElementById("mko-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "mko-style";
    // Panels, tables, pills, the bar and the KPI strip are THE COMPONENT KIT in rs.css. Only
    // what the kit has no name for lives here.
    st.textContent = ""
      + ".mko{font-variant-numeric:tabular-nums}"
      + ".mko .mko-src{font-weight:600}"
      + ".mko .mko-src a{color:inherit;text-decoration:none;border-bottom:1px dotted currentColor}"
      + ".mko .mko-src a:hover{color:var(--brand)}"
      + ".mko .mko-sub{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.45}"
      + ".mko .mko-note{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45;max-width:420px}"
      + ".mko .mko-step{font-size:12.5px;line-height:1.45;max-width:340px}"
      + ".mko .mko-met{font-size:12.5px;line-height:1.45;max-width:300px;color:var(--muted)}"
      + ".mko .mko-srcs td{vertical-align:top}"
      + ".mko .mko-num{text-align:right;white-space:nowrap}"
      + ".mko .mko-date{white-space:nowrap}"
      + ".mko .mko-foot{font-size:12px;color:var(--muted);margin-top:10px}"
      + ".mko .mko-d{display:inline-block;margin-left:8px;font-size:12px;font-weight:800;vertical-align:middle}"
      + ".mko .mko-d.up{color:var(--pos)}.mko .mko-d.dn{color:var(--neg)}.mko .mko-d.eq{color:var(--faint)}"
      + ".mko .mko-feeds{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:2px 0 12px;font-size:12.5px}"
      + ".mko .mko-feed{display:inline-flex;align-items:center;gap:6px;color:var(--muted)}"
      + ".mko .mko-feed b{color:var(--ink);font-weight:600}"
      + ".mko .mko-dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:none}"
      + ".mko .mko-dot.ok{background:var(--pos)}.mko .mko-dot.warn{background:var(--warn,#D97706)}"
      + ".mko .mko-dot.bad{background:var(--neg)}"
      + ".mko .mko-feeds a{color:var(--muted)}"
      + ".mko .mko-ch th,.mko .mko-ch td{white-space:nowrap}"
      + ".mko .mko-ch td.mko-fam{white-space:normal;min-width:150px}"
      + ".mko .mko-ch tr.mko-grp td{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;"
      + "color:var(--muted);padding-top:14px;background:transparent}"
      + ".mko .mko-ch tr.mko-tot td{font-weight:700;border-top:1px solid var(--line-2)}"
      + ".mko .mko-ch a.mko-go{color:inherit;text-decoration:none;font-weight:600}"
      + ".mko .mko-ch a.mko-go:hover{color:var(--brand);text-decoration:underline}"
      + ".mko .mko-tag{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;"
      + "margin-left:6px;vertical-align:1px;border:1px solid var(--line-2);color:var(--muted)}"
      + ".mko .mko-tag.live{color:var(--pos);border-color:currentColor}"
      + ".mko .mko-cov{color:var(--muted)}"
      + ".mko .mko-thin{color:var(--faint)}"
      + ".mko .mko-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:22px 0 8px}"
      + ".mko .mko-h h2{margin:0;font-size:17px}"
      + ".mko .mko-h .mko-sub{margin:0}"
      // the platform panels
      + ".mko .mko-pnav{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12.5px;margin:0 0 4px;color:var(--muted)}"
      + ".mko .mko-pnav button{font:inherit;font-weight:600;color:var(--ink);background:none;border:0;padding:0;"
      + "cursor:pointer;border-bottom:1px dotted currentColor}"
      + ".mko .mko-pnav button:hover{color:var(--brand)}"
      + ".mko .mko-plat{border-top:1px solid var(--line);margin-top:18px;padding-top:4px}"
      + ".mko .mko-ph{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:12px 0 10px}"
      + ".mko .mko-ph h3{margin:0;font-size:15.5px;font-weight:800;color:var(--ink)}"
      + ".mko .mko-ph .mko-sub{margin:0}"
      + ".mko .mko-g2{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:14px;align-items:start}"
      + "@media(max-width:1100px){.mko .mko-g2{grid-template-columns:minmax(0,1fr)}}"
      + ".mko .mko-pt th,.mko .mko-pt td{white-space:nowrap}"
      + ".mko .mko-pt td.mko-name{white-space:normal;min-width:180px}"
      + ".mko .mko-pt.mko-tight{font-size:13px}"
      + ".mko .mko-pt.mko-tight th,.mko .mko-pt.mko-tight td{padding:9px 8px}"
      + ".mko .mko-pt.mko-tight td.mko-name{min-width:110px}"
      + ".mko .mko-pt tr.mko-tot td{font-weight:700;border-top:1px solid var(--line-2)}"
      + ".mko .mko-share{display:block;height:5px;border-radius:3px;background:var(--line);margin-top:5px;min-width:60px}"
      + ".mko .mko-share i{display:block;height:100%;border-radius:3px;background:var(--brand)}"
      + ".mko .mko-empty{font-size:13px;color:var(--muted);padding:6px 0 10px}"
      + ".mko .mko-nm{font-size:13px;line-height:1.55;color:var(--ink)}"
      + ".mko .mko-nm b{font-weight:700}"
      + ".mko .mko-nm p{margin:0 0 8px}"
      + "@media(max-width:600px){.mko .rs-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}"
      + ".mko .rs-kpis .kpi{padding:10px 12px}}"
      + "body.rs-app.light.v2 .mko .mko-sub,body.rs-app.light.v2 .mko .mko-note,"
      + "body.rs-app.light.v2 .mko .mko-met,body.rs-app.light.v2 .mko .mko-foot,"
      + "body.rs-app.light.v2 .mko .mko-feed,body.rs-app.light.v2 .mko .mko-cov,"
      + "body.rs-app.light.v2 .mko .mko-pnav,body.rs-app.light.v2 .mko .mko-empty{color:#64748B}"
      + "body.rs-app.light.v2 .mko .mko-share i{background:#3F7D20}"
      + "body.rs-app.light.v2 .mko .mko-d{font-weight:600}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ data ---- */
  function index(rows) {
    D.rows = (rows || []).map(r => ({
      d: String(r.Date || "").slice(0, 10), co: r.Company, fam: r.Family || "(no source)",
      bd: r["Booked Day"] ? String(r["Booked Day"]).slice(0, 10) : null,
      leads: num(r.Leads), booked: num(r.Booked), billed: num(r.Billed), bval: num(r["Booked Value"]),
      spL: r["Spend Live"] == null ? null : num(r["Spend Live"]),
      spG: r["Spend Ledger"] == null ? null : num(r["Spend Ledger"]),
      imp: r.Impressions == null ? null : num(r.Impressions),
      clk: r.Clicks == null ? null : num(r.Clicks),
    })).filter(r => r.d);
    D.liveFrom = {}; D.ledgerEnd = null; D.minDay = null; D.maxDay = null;
    rows.forEach(r => {
      const le = String(r["Ledger End"] || "").slice(0, 10);
      if (le && (!D.ledgerEnd || le > D.ledgerEnd)) D.ledgerEnd = le;
    });
    D.rows.forEach(r => {
      if (r.spL != null && (!D.liveFrom[r.fam] || r.d < D.liveFrom[r.fam])) D.liveFrom[r.fam] = r.d;
      if (!D.minDay || r.d < D.minDay) D.minDay = r.d;
      if (r.leads && (!D.maxDay || r.d > D.maxDay)) D.maxDay = r.d;
    });
  }
  // a family-day whose spend is IN: a live API day, or a day the ledger has reached
  function liveDay(r) { return r.co === LIVE_CO && !!D.liveFrom[r.fam] && r.d >= D.liveFrom[r.fam]; }
  function covered(r) { return liveDay(r) || (!!D.ledgerEnd && r.d <= D.ledgerEnd); }

  /* the reading window [a, b]; `bEff` stops at the newest lead on file so a comparison window
     is day-matched instead of charging this year for days that have not happened */
  function win() {
    const a = S.from || D.minDay || "2024-01-01";
    const b = S.to || today();
    let bEff = D.maxDay && b > D.maxDay ? D.maxDay : b;
    if (bEff < a) bEff = b;
    return { a, b, bEff, open: !S.from };
  }
  /* the comparison window, with `asOf` (bookings as they stood that day) and `shift` (a
     comparison day -> the matching day of the current window, where spend coverage is judged) */
  function cmpWin(w) {
    if (w.open) return null;
    if (S.cmp === "prev") {
      const n = dayCount(w.a, w.bEff);
      return { a: addDays(w.a, -n), b: addDays(w.a, -1), label: "previous period",
               asOf: addDays(today(), -n), shift: d => addDays(d, n) };
    }
    return { a: addYears(w.a, -1), b: addYears(w.bEff, -1), label: "same days last year",
             asOf: addYears(today(), -1), shift: d => (+d.slice(0, 4) + 1) + d.slice(4) };
  }

  /* every family's measures for [a, b] and the company in the bar. `cw` (the comparison only):
     bookings counted as they stood on cw.asOf, spend coverage judged on cw.shift(day). */
  function aggregate(a, b, cw) {
    const by = new Map();
    // paid = spend inside the period, or in the year before its end (a month the ledger has not
    // reached yet, a postcard run between drops) -- per COMPANY and family: Tuji's Google Local
    // leads cost nothing, so with both companies picked they are not "spend not in yet"
    const look = [a, addDays(b, -PAID_LOOKBACK)].sort()[0];
    const paidKey = new Set();
    D.rows.forEach(r => {
      if (r.d >= look && r.d <= b && ((r.spL || 0) + (r.spG || 0))) paidKey.add(r.co + "|" + r.fam);
    });
    D.rows.forEach(r => {
      if (S.co && r.co !== S.co) return;
      if (r.d > b || r.d < a) return;
      let f = by.get(r.fam);
      if (!f) {
        f = { fam: r.fam, leads: 0, booked: 0, billed: 0, bval: 0, spL: 0, spG: 0, imp: 0, clk: 0,
              hasImp: false, cLeads: 0, cBooked: 0, cBval: 0, uncov: false, anyCov: false,
              live: false, ledger: false, paid: false };
        by.set(r.fam, f);
      }
      const pk = paidKey.has(r.co + "|" + r.fam);
      if (pk) f.paid = true;
      const bk = !cw || (!!r.bd && r.bd <= cw.asOf);
      // a company that never pays this family has nothing to wait for: its leads are covered
      const cov = !pk || covered(cw ? { co: r.co, fam: r.fam, d: cw.shift(r.d) } : r);
      f.leads += r.leads;
      if (bk) { f.booked += r.booked; f.billed += r.billed; f.bval += r.bval; }
      if (cov) {
        if (r.spL) { f.spL += r.spL; f.live = true; }
        if (r.spG) { f.spG += r.spG; f.ledger = true; }
        if (r.imp != null) { f.imp += r.imp; f.hasImp = true; }
        if (r.clk != null) f.clk += r.clk;
        f.cLeads += r.leads; f.anyCov = true;
        if (bk) { f.cBooked += r.booked; f.cBval += r.bval; }
      } else if (r.leads) f.uncov = true;
    });
    const out = [];
    by.forEach(f => {
      f.spend = f.spL + f.spG;
      if (!f.leads && !f.spend) return;          // quiet in this period: no row
      if (!f.paid) f.uncov = false;
      // spend days past the ledger's end are not in yet for a ledger channel; a live one has them
      f.cpb = f.paid && f.spend ? ratio(f.spend, f.cBooked) : null;
      f.roas = f.paid && f.spend ? ratio(f.cBval, f.spend) : null;
      f.cpl = f.paid && f.spend ? ratio(f.spend, f.cLeads) : null;
      f.book = ratio(f.booked, f.leads);
      out.push(f);
    });
    return out;
  }
  function totals(list) {
    const t = { leads: 0, booked: 0, billed: 0, bval: 0, spend: 0, spL: 0, spG: 0,
                pLeads: 0, pBooked: 0, pBval: 0, pSpend: 0, uncov: false };
    list.forEach(f => {
      t.leads += f.leads; t.booked += f.booked; t.billed += f.billed; t.bval += f.bval;
      t.spend += f.spend; t.spL += f.spL; t.spG += f.spG;
      if (f.paid) {
        t.pSpend += f.spend; t.pLeads += f.cLeads; t.pBooked += f.cBooked; t.pBval += f.cBval;
        if (f.uncov) t.uncov = true;
      }
    });
    t.cpb = ratio(t.pSpend, t.pBooked);
    t.roas = ratio(t.pBval, t.pSpend);
    t.cpl = ratio(t.pSpend, t.pLeads);
    t.book = ratio(t.booked, t.leads);
    return t;
  }

  /* ------------------------------------------------------------------ period memory ---- */
  function boot() {
    if (S.booted) return;
    S.booted = true;
    const P = RSC.datePresets();
    let saved = null;
    try { saved = JSON.parse(lsGet(LS_PERIOD) || "null"); } catch (e) { saved = null; }
    const hit = saved && saved.p ? P.find(p => p[0] === saved.p) : null;
    const okDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (hit) { S.from = hit[1] || null; S.to = hit[2] || null; }
    else if (saved && (okDay(saved.f) || okDay(saved.t))) {
      S.from = okDay(saved.f) ? saved.f : null; S.to = okDay(saved.t) ? saved.t : null;
    } else {
      const tm = P.find(p => p[0] === "This month");
      S.from = tm[1]; S.to = tm[2];
    }
    const c = lsGet(LS_CMP);
    if (c === "ly" || c === "prev") S.cmp = c;
  }
  // a preset by NAME (so "This month" moves with the calendar), anything else by its dates
  function savePeriod() {
    const hit = RSC.datePresets().find(p => p[1] === (S.from || "") && p[2] === (S.to || ""));
    lsSet(LS_PERIOD, JSON.stringify(hit ? { p: hit[0] } : { f: S.from, t: S.to }));
  }

  /* ------------------------------------------------------------------ paint ---- */
  function feedsHtml() {
    if (!D.conn.length) return "";
    const by = {};
    D.conn.forEach(r => { by[r.Key] = r; });
    return '<div class="mko-feeds"><span>Data in:</span>' + FEEDS.map(([k, name]) => {
      const r = by[k];
      if (!r) return "";
      const cls = PILL[r.Status] || "mute";
      const when = r["Newest Data"] ? "through " + shortDay(r["Newest Data"]) : String(r.Status || "").toLowerCase();
      return '<span class="mko-feed" title="' + esc(r.Status + (r["Status Note"] ? " · " + r["Status Note"] : "")) + '">'
        + '<i class="mko-dot ' + cls + '"></i><b>' + esc(name) + "</b> " + esc(when) + "</span>";
    }).join("") + '<a href="#mkoSources">all sources ↓</a></div>';
  }

  function famCell(f) {
    const href = "#page=source-report&src=" + encodeURIComponent(f.fam);
    return '<a class="mko-go" href="' + esc(href) + '" title="Open ' + esc(f.fam)
      + ' in Source Analysis">' + esc(f.fam) + "</a>"
      + (FAM_NOTE[f.fam] ? '<div class="mko-sub">' + esc(FAM_NOTE[f.fam]) + "</div>" : "");
  }
  function spendCell(f) {
    if (!f.paid) return '<span class="mko-sub">—</span>';
    const tag = f.live && f.ledger ? '<span class="mko-tag live" title="live API, bank ledger before it went live">live + ledger</span>'
      : f.live ? '<span class="mko-tag live" title="from the platform API, updated daily">live</span>'
      : '<span class="mko-tag" title="from the bank ledger, pasted monthly">ledger</span>';
    if (!f.anyCov) {
      return '<span class="mko-cov" title="the bank ledger runs through ' + esc(day(D.ledgerEnd))
        + '">not in yet</span>' + tag;
    }
    let h = money0(f.spend) + tag;
    if (f.uncov) {
      h += '<div class="mko-sub">' + (f.live ? "ledger part " : "") + "through "
        + esc(shortDay(D.ledgerEnd)) + "</div>";
    } else if (f.hasImp && f.clk && f.spL) {
      // live spend over live clicks: ledger days before the API went live have no clicks
      h += '<div class="mko-sub">' + fmtN(f.clk) + " clicks · $" + (f.spL / f.clk).toFixed(2)
        + " a click</div>";
    }
    return h;
  }
  // a cost read on the covered days only says so; a thin sample is drawn muted
  // a cost read on the covered days only carries a * (the table hint says what it means); a
  // thin sample is drawn muted
  function costCell(v, f, fmt, thin) {
    if (v == null) return '<span class="mko-sub">—</span>';
    const tip = [thin ? "fewer than " + THIN + " booked jobs: a small sample" : "",
                 f.uncov ? "read on the leads whose spend is in (the bank ledger runs through "
                   + day(D.ledgerEnd) + ")" : ""].filter(Boolean).join(" · ");
    return "<span" + (thin ? ' class="mko-thin"' : "") + (tip ? ' title="' + esc(tip) + '"' : "") + ">"
      + fmt(v) + (f.uncov ? "*" : "") + "</span>";
  }

  function channelRows(list, label, sortKey) {
    if (!list.length) return "";
    list.sort((x, y) => (y[sortKey] - x[sortKey]) || (y.leads - x.leads));
    const t = totals(list);
    let h = '<tr class="mko-grp"><td colspan="9">' + esc(label) + " · " + list.length
      + (list.length === 1 ? " channel" : " channels") + "</td></tr>";
    list.forEach(f => {
      h += '<tr><td class="mko-fam">' + famCell(f) + "</td>"
        + '<td class="mko-num">' + spendCell(f) + "</td>"
        + '<td class="mko-num">' + fmtN(f.leads) + "</td>"
        + '<td class="mko-num">' + fmtN(f.booked) + "</td>"
        + '<td class="mko-num">' + pct(f.book) + "</td>"
        + '<td class="mko-num">' + money0(f.bval) + "</td>"
        + '<td class="mko-num">' + costCell(f.cpb, f, money0, f.cBooked < THIN) + "</td>"
        + '<td class="mko-num">' + costCell(f.roas, f, perDollar, f.cBooked < THIN) + "</td>"
        + '<td class="mko-num">' + costCell(f.cpl, f, money0, false) + "</td>"
        + "</tr>";
    });
    const paid = list[0] && list[0].paid;
    h += '<tr class="mko-tot"><td>All ' + esc(label.toLowerCase()) + "</td>"
      + '<td class="mko-num">' + (!paid ? '<span class="mko-sub">—</span>'
        : list.some(f => f.anyCov) ? money0(t.spend)
        : '<span class="mko-cov">not in yet</span>') + "</td>"
      + '<td class="mko-num">' + fmtN(t.leads) + "</td>"
      + '<td class="mko-num">' + fmtN(t.booked) + "</td>"
      + '<td class="mko-num">' + pct(t.book) + "</td>"
      + '<td class="mko-num">' + money0(t.bval) + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.cpb, t, money0, false) : "—") + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.roas, t, perDollar, false) : "—") + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.cpl, t, money0, false) : "—") + "</td></tr>";
    return h;
  }

  function channelsHtml(fams) {
    const paid = fams.filter(f => f.paid), free = fams.filter(f => !f.paid);
    if (!fams.length) return '<div class="rs-hint">No leads or spend in this period for this company.</div>';
    return '<div class="rs-tablewrap"><table class="rs-table mko-ch"><thead><tr>'
      + "<th>Channel</th>"
      + '<th class="mko-num">Spend</th>'
      + '<th class="mko-num" title="leads created in the period">Leads</th>'
      + '<th class="mko-num" title="of those leads, how many booked (Confirmed)">Booked</th>'
      + '<th class="mko-num" title="booked ÷ leads">Book %</th>'
      + '<th class="mko-num" title="billed where the move happened, else the booked quote">Booked value</th>'
      + '<th class="mko-num" title="spend ÷ booked jobs">Cost per booking</th>'
      + '<th class="mko-num" title="booked value ÷ spend">$ per $1</th>'
      + '<th class="mko-num" title="spend ÷ leads">Cost per lead</th>'
      + "</tr></thead><tbody>"
      + channelRows(paid, "Paid", "spend")
      + channelRows(free, "Unpaid", "leads")
      + "</tbody></table></div>";
  }

  function kpisFor(host, w, cw) {
    const cur = totals(aggregate(w.a, w.bEff));
    const prev = cw ? totals(aggregate(cw.a, cw.b, cw)) : null;
    // a KPI card has two short lines: the comparison names its side in two words
    const was = (v, fmt) => prev ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(v) : "";
    const spendSub = cur.spL && cur.spG ? "live " + money(cur.spL) + " · ledger " + money(cur.spG)
      : cur.spL ? "live APIs" : "bank ledger";
    RSC.kpis(host, [
      { label: "Spend", value: money(cur.spend) + (prev ? delta(cur.spend, prev.spend, null) : ""),
        sub: (prev ? was(prev.spend, money) + " · " : "") + spendSub },
      { label: "Leads", value: fmtN(cur.leads) + (prev ? delta(cur.leads, prev.leads) : ""),
        sub: was(prev && prev.leads, fmtN) || "created in the period" },
      { label: "Booked jobs", value: fmtN(cur.booked) + (prev ? delta(cur.booked, prev.booked) : ""),
        sub: pct(cur.book) + " of leads" + (prev ? " · " + was(prev.booked, fmtN) : "") },
      { label: "Cost per booking", value: money0(cur.cpb) + (prev ? delta(cur.cpb, prev.cpb, true) : ""),
        sub: "paid channels" + (prev ? " · " + was(prev.cpb, money0) : "") },
      { label: "$ per $1 of ads", value: perDollar(cur.roas) + (prev ? delta(cur.roas, prev.roas) : ""),
        sub: "booked value ÷ spend" + (prev ? " · " + was(prev.roas, perDollar) : "") },
      { label: "Cost per lead", value: money0(cur.cpl) + (prev ? delta(cur.cpl, prev.cpl, true) : ""),
        sub: "paid channels" + (prev ? " · " + was(prev.cpl, money0) : "") },
    ]);
  }

  /* ------------------------------------------------------------------ platforms ---- */
  const d10 = v => String(v || "").slice(0, 10);
  const pct2 = v => v == null || isNaN(v) ? "—" : (100 * v).toFixed(2) + "%";
  const cents = v => v == null || isNaN(v) ? "—" : "$" + v.toFixed(2);
  // a big count in a KPI's second line, short enough for a phone card
  const compact = v => v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e4 ? Math.round(v / 1e3) + "k" : fmtN(v);
  const prettyCode = s => String(s || "").replace(/^OUTCOME_|^actions:/i, "").replace(/[._]+/g, " ")
    .toLowerCase().replace(/^\w/, c => c.toUpperCase());

  function indexPlat(key, rows, map) {
    P[key] = (rows || []).map(map).filter(r => r.d);
    let f = null, l = null;
    P[key].forEach(r => { if (!f || r.d < f) f = r.d; if (!l || r.d > l) l = r.d; });
    P.first[key] = f; P.last[key] = l;
  }
  function indexPlatforms(ads, lsaC, lsaL, meta, gpt) {
    indexPlat("ads", ads, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: r.Campaign || "(no name)",
      type: r.Channel || "", cost: num(r.Cost), imp: num(r.Impressions), clk: num(r.Clicks),
      conv: num(r.Conversions) }));
    indexPlat("lsaC", lsaC, r => ({ d: d10(r.Date), cost: num(r.Cost), imp: num(r.Impressions),
      clk: num(r.Clicks) }));
    indexPlat("lsaL", lsaL, r => ({ d: d10(r.Date), lt: r["Lead Type"] || "Other",
      svc: r.Service || "Not given", chg: r.Charge || "Not charged", n: num(r.Leads) }));
    // a Meta row's result: Meta's own Results where it returned them; a campaign that returned
    // none but counted leads reads its lead count (kind "lead"); otherwise it has no result
    indexPlat("meta", meta, r => {
      const ind = r["Result Indicator"] || "", leads = num(r.Leads);
      const kind = ind || (leads ? "lead" : "");
      return { d: d10(r.Date), id: r["Campaign Id"], name: r.Campaign || "(no name)",
        obj: r.Objective || "", cost: num(r.Spend), imp: num(r.Impressions), clk: num(r.Clicks),
        leads, kind, res: ind ? num(r.Results) : leads };
    });
    indexPlat("gpt", gpt, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: r.Campaign || "(no name)",
      cost: num(r.Spend), imp: num(r.Impressions), clk: num(r.Clicks), conv: num(r.Conversions) }));
    // Local Services is one panel over two tables: it covers the days BOTH have (leads arrive
    // through today, cost through yesterday -- today's calls against no cost would flatter it)
    const lf = [P.first.lsaC, P.first.lsaL].filter(Boolean).sort();
    const ll = [P.last.lsaC, P.last.lsaL].filter(Boolean).sort();
    P.first.lsa = lf.length === 2 ? lf[1] : null;
    P.last.lsa = ll.length === 2 ? ll[0] : null;
  }

  const inRange = (rows, a, b) => rows.filter(r => r.d >= a && r.d <= b);
  function sum(rows, k) { let s = 0; rows.forEach(r => { s += r[k] || 0; }); return s; }
  function clickStats(rows) {
    const cost = sum(rows, "cost"), imp = sum(rows, "imp"), clk = sum(rows, "clk");
    return { cost, imp, clk, ctr: ratio(clk, imp), cpc: ratio(cost, clk),
             cpm: imp ? 1000 * cost / imp : null, n: rows.length };
  }
  // rows -> [{k, rows}] by a key, in first-seen order
  function groupBy(rows, keyFn) {
    const m = new Map();
    rows.forEach(r => { const k = keyFn(r); if (!m.has(k)) m.set(k, []); m.get(k).push(r); });
    return Array.from(m, ([k, rs]) => ({ k, rows: rs }));
  }

  /* the period a platform reads: the page's window from the platform's first day on (All time
     must not draw two flat years before an account existed) up to its newest day (a day it has
     not reported yet is not a $0 day). The comparison is cut to match that window, and drawn only
     when the platform already had data on its first day -- half a window reads as a collapse. */
  function platWin(key, w, cw) {
    const first = P.first[key], last = P.last[key];
    if (!first || !last) return null;
    const a = w.a > first ? w.a : first;
    const b = last < w.bEff ? last : w.bEff;
    // `g` = the chart bucket, chosen on the page's period (from the platform's start), not on the
    // platform's last day: one platform a day behind must not switch from days to weeks
    const out = { a, b, first, last, before: w.bEff < first, after: a > last, cw: null, noCmp: false,
                  late: a > w.a, g: grainOf(a, w.bEff > a ? w.bEff : a) };
    if (cw && !out.before && !out.after) {
      const pc = cmpWin({ a, bEff: b, open: w.open });
      if (pc && first <= pc.a) out.cw = pc; else out.noCmp = true;
    }
    return out;
  }

  /* chart buckets: days up to three months, weeks up to ~13 months, months beyond */
  function grainOf(a, b) { const n = dayCount(a, b); return n <= 92 ? "day" : n <= 400 ? "week" : "month"; }
  function bucketOf(d, g) {
    if (g === "day") return d;
    if (g === "month") return d.slice(0, 7);
    const x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));          // the Monday of its week
    return iso(x);
  }
  function bucketsOf(a, b, g) {
    const out = [];
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const k = bucketOf(d, g);
      if (out[out.length - 1] !== k) out.push(k);
    }
    return out;
  }
  function bucketLabel(k, g) {
    if (g === "month") return MON[+k.slice(5, 7) - 1] + " " + k.slice(0, 4);
    return (g === "week" ? "wk " : "") + shortDay(k);
  }
  const GRAIN_WORD = { day: "day", week: "week", month: "month" };
  // a measure per bucket, aligned to `keys`
  function seriesOf(rows, keys, g, val) {
    const m = {};
    rows.forEach(r => { const k = bucketOf(r.d, g); m[k] = (m[k] || 0) + val(r); });
    return keys.map(k => m[k] || 0);
  }

  /* chart colours are the theme's tokens, read at paint time (the theme button re-renders) */
  function palette() {
    if (RS.isV2 && RS.isV2()) {
      const V = RS.V2;
      return { main: V.navy, alt: V.accent, light: V.accentL, ctx: V.ctx, faint: V.other, violet: V.cat[4] };
    }
    const cs = getComputedStyle(document.body);
    const v = (n, fb) => (cs.getPropertyValue(n) || "").trim() || fb;
    return { main: v("--brand", "#b7e23b"), alt: v("--blue", "#5b8cff"), light: v("--purple", "#a78bfa"),
             ctx: v("--faint", "#5c6a7c"), faint: v("--faint", "#5c6a7c"), violet: v("--purple", "#a78bfa") };
  }
  const moneyTick = v => v >= 1000 ? "$" + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + "k" : "$" + v;

  /* the platform's cost per bucket, with the comparison period drawn quiet and dashed under it
     (aligned day 1 to day 1) when there is one */
  function costCard(host, key, title, pw, rows, cmpRows, extra) {
    const g = pw.g;
    const keys = bucketsOf(pw.a, pw.b, g);
    const cost = seriesOf(rows, keys, g, r => r.cost);
    const clk = seriesOf(rows, keys, g, r => r.clk);
    let prev = null;
    if (pw.cw && cmpRows) {
      const ck = bucketsOf(pw.cw.a, pw.cw.b, g);
      prev = seriesOf(cmpRows, ck, g, r => r.cost).slice(0, keys.length);
    }
    const ex = extra ? keys.map(() => 0) : null;
    if (extra) {
      const m = {};
      rows.forEach(r => { const k = bucketOf(r.d, g); m[k] = (m[k] || 0) + extra.val(r); });
      keys.forEach((k, i) => { ex[i] = m[k] || 0; });
    }
    // a platform that reports today reports a day still running: its last stretch is dashed
    const partial = pw.b >= today();
    const lastI = keys.length - 1;
    RSC.chartCard(host, {
      title: title + " by " + GRAIN_WORD[g],
      key: "mko-" + key + "-cost",
      controlsHtml: partial ? '<span class="lbl">dashed end = today so far</span>' : "",
      controlsGraphOnly: true,
      buildChart(canvas) {
        const C = palette();
        const sets = [{ label: title, data: cost.map(v => +v.toFixed(2)), borderColor: C.main,
                        backgroundColor: C.main, borderWidth: 2, pointRadius: keys.length > 45 ? 0 : 2,
                        cubicInterpolationMode: "monotone", fill: false,
                        segment: { borderDash: s => partial && s.p1DataIndex === lastI ? [4, 4] : undefined } }];
        if (prev) {
          sets.push({ label: pw.cw.label, data: prev.map(v => +v.toFixed(2)), borderColor: C.ctx,
                      backgroundColor: C.ctx, borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0,
                      cubicInterpolationMode: "monotone", fill: false });
        }
        return new Chart(canvas, {
          type: "line",
          data: { labels: keys.map(k => bucketLabel(k, g)), datasets: sets },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { display: !!prev, position: "top", labels: { boxWidth: 12 } },
                       tooltip: { callbacks: { label: c => c.dataset.label + ": " + money0(c.raw)
                         + (partial && c.datasetIndex === 0 && c.dataIndex === lastI ? " (so far)" : "") } } },
            scales: { y: { beginAtZero: true, ticks: { callback: moneyTick } },
                      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } },
          },
        });
      },
      buildTable() {
        let h = '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>'
          + esc(GRAIN_WORD[g][0].toUpperCase() + GRAIN_WORD[g].slice(1)) + "</th>"
          + '<th class="mko-num">Cost</th><th class="mko-num">Clicks</th><th class="mko-num">CPC</th>'
          + (extra ? '<th class="mko-num">' + esc(extra.label) + "</th>" : "")
          + (prev ? '<th class="mko-num">Cost, ' + esc(pw.cw.label) + "</th>" : "")
          + "</tr></thead><tbody>";
        keys.forEach((k, i) => {
          h += "<tr><td>" + esc(bucketLabel(k, g))
            + (partial && i === lastI ? ' <span class="mko-sub">so far</span>' : "") + "</td>"
            + '<td class="mko-num">' + money0(cost[i]) + "</td>"
            + '<td class="mko-num">' + fmtN(clk[i]) + "</td>"
            + '<td class="mko-num">' + cents(ratio(cost[i], clk[i])) + "</td>"
            + (extra ? '<td class="mko-num">' + extra.fmt(ex[i]) + "</td>" : "")
            + (prev ? '<td class="mko-num">' + (i < prev.length ? money0(prev[i]) : "—") + "</td>" : "")
            + "</tr>";
        });
        return h + "</tbody></table></div>";
      },
    });
  }

  /* one KPI card with its comparison: `lower` = a cost (down is good), null = neither */
  function kp(label, cur, prev, fmt, lower, sub, pw) {
    const on = !!(pw && pw.cw) && prev !== undefined;
    const was = on ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(prev) : "";
    return { label, value: fmt(cur) + (on ? delta(cur, prev, lower) : ""),
             sub: [was, sub].filter(Boolean).join(" · ") };
  }
  function platHead(key, title, sub, pw) {
    return '<div class="mko-ph"><h3>' + esc(title) + '</h3><span class="mko-sub">' + esc(sub)
      + (pw && pw.last ? " · data through " + esc(day(pw.last)) : "") + "</span></div>";
  }
  // a platform younger than the period reads from its first day; say so, and why there is no
  // comparison
  function noCmpHint(name, pw) {
    if (!pw.noCmp && !pw.late) return "";
    return '<p class="rs-hint">' + esc(name) + " data starts " + esc(day(pw.first))
      + (pw.late ? ", so this panel reads from that day on" + (pw.noCmp ? " with no comparison" : "")
        : ", so there is no comparison for this period") + ".</p>";
  }
  // one rs-table: cols [{h, num?, tip?, cell(row)}], rows, an optional totals row; `tight` for
  // the narrow side column beside a chart
  function ptable(cols, rows, tot, tight) {
    const th = cols.map(c => "<th" + (c.num ? ' class="mko-num"' : "")
      + (c.tip ? ' title="' + esc(c.tip) + '"' : "") + ">" + esc(c.h) + "</th>").join("");
    const tr = (r, cls) => "<tr" + (cls ? ' class="' + cls + '"' : "") + ">" + cols.map(c =>
      "<td" + (c.num ? ' class="mko-num"' : c.name ? ' class="mko-name"' : "") + ">" + c.cell(r) + "</td>").join("") + "</tr>";
    return '<div class="rs-tablewrap"><table class="rs-table mko-pt' + (tight ? " mko-tight" : "") + '"><thead><tr>'
      + th + "</tr></thead><tbody>"
      + rows.map(r => tr(r)).join("") + (tot ? tr(tot, "mko-tot") : "") + "</tbody></table></div>";
  }
  // a name with its share of the whole drawn as a bar beneath it (the % rides in the next cell)
  const shareName = (name, v, of) => name + '<span class="mko-share" title="' + esc(pct(of > 0 ? v / of : 0))
    + ' of the period"><i style="width:' + Math.round(100 * (of > 0 ? v / of : 0)) + '%"></i></span>';
  const withShare = (txt, v, of) => txt + '<div class="mko-sub">' + pct(of > 0 ? v / of : 0) + "</div>";
  // a cost per result: results like "people reached" cost a fraction of a cent each
  const each = v => v == null || isNaN(v) ? "—" : v < 0.1 ? "$" + v.toFixed(3) : cents(v);

  /* --- Google Ads --- */
  function adsSection(w, cw) {
    const pw = platWin("ads", w, cw);
    const head = platHead("ads", "Google Ads", "account 233-468-1938", pw);
    const rows = pw ? inRange(P.ads, pw.a, pw.b) : [];
    const gate = platGate("Google Ads", "ads", pw, rows);
    if (gate) return { html: head + gate };
    const cmp = pw.cw ? inRange(P.ads, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    cur.conv = sum(rows, "conv"); prev.conv = cmp ? sum(cmp, "conv") : undefined;
    const cpa = s => ratio(s.cost, s.conv);
    const html = head
      + '<div class="rs-kpis" id="mkoK-ads"></div>'
      + '<p class="rs-hint">Conversions are what Google counts as a conversion on this account, not '
      + "our leads or booked jobs: those are the Google row in the Channels table, whose spend is this "
      + "same cost.</p>" + noCmpHint("Google Ads", pw)
      + '<div class="mko-g2"><div id="mkoC-ads"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">By campaign type</span></div>'
      + adsTypeTable(rows, cur) + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">every campaign that showed an ad in the period, most cost first</span></div>'
      + adsCampTable(rows, cur) + "</div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-ads"), [
        kp("Cost", cur.cost, prev.cost, money, null, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, compact(cur.imp) + " impr.", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "cost ÷ clicks", pw),
        kp("Conversions", cur.conv, prev.conv, fmtN, false, "Google's count", pw),
        kp("Cost per conv.", cpa(cur), cmp ? cpa(prev) : undefined, money0, true, "", pw),
      ]);
      costCard(host.querySelector("#mkoC-ads"), "ads", "Cost", pw, rows, cmp,
               { label: "Conversions", val: r => r.conv, fmt: fmtN });
    } };
  }
  function adsTypeTable(rows, cur) {
    const list = groupBy(rows, r => r.type).map(x => Object.assign({ k: x.k, conv: sum(x.rows, "conv") },
      clickStats(x.rows))).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    return ptable([
      { h: "Type", name: true, cell: r => shareName(esc(ADS_TYPE[r.k] || prettyCode(r.k) || "(none)"), r.cost, cur.cost) },
      { h: "Cost", num: true, tip: "and its share of the period's cost", cell: r => withShare(money0(r.cost), r.cost, cur.cost) },
      { h: "Clicks", num: true, cell: r => withShare(fmtN(r.clk), r.clk, cur.clk) },
      { h: "Conv.", num: true, tip: "Google's conversions", cell: r => fmtN(r.conv) },
      { h: "Cost / conv.", num: true, cell: r => money0(ratio(r.cost, r.conv)) },
    ], list, null, true);
  }
  function adsCampTable(rows, cur) {
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      return Object.assign({ name: last.name, type: last.type, conv: sum(x.rows, "conv") }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost || b.imp - a.imp);
    const tot = Object.assign({ name: "All campaigns", type: "", conv: sum(rows, "conv") }, cur);
    return ptable([
      { h: "Campaign", name: true, cell: r => esc(r.name)
          + (r.type ? '<div class="mko-sub">' + esc(ADS_TYPE[r.type] || prettyCode(r.type)) + "</div>" : "") },
      { h: "Cost", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "Conv.", num: true, tip: "Google's conversions", cell: r => fmtN(r.conv) },
      { h: "Cost / conv.", num: true, cell: r => money0(ratio(r.cost, r.conv)) },
    ], list, tot);
  }

  /* --- Local Services --- */
  function lsaSection(w, cw) {
    const pw = platWin("lsa", w, cw);
    const head = platHead("lsa", "Local Services", "account 748-852-6235 · Google's leads, by phone call or message", pw);
    const cost = pw ? inRange(P.lsaC, pw.a, pw.b) : [];
    const leads = pw ? inRange(P.lsaL, pw.a, pw.b) : [];
    const gate = platGate("Local Services", "lsa", pw, cost.concat(leads));
    if (gate) return { html: head + gate };
    const stat = (c, l) => {
      const s = { cost: sum(c, "cost"), leads: sum(l, "n") };
      LSA_CHARGE.forEach(k => { s[k] = sum(l.filter(r => r.chg === k), "n"); });
      s.cpcl = ratio(s.cost, s.Charged);
      return s;
    };
    const cur = stat(cost, leads);
    const prev = pw.cw ? stat(inRange(P.lsaC, pw.cw.a, pw.cw.b), inRange(P.lsaL, pw.cw.a, pw.cw.b)) : {};
    const types = groupBy(leads, r => r.lt).map(x => ({ k: x.k, n: sum(x.rows, "n") })).sort((a, b) => b.n - a.n);
    const phone = (types.find(t => t.k === "Phone call") || {}).n || 0;
    const typeLine = types.length === 1 && types[0].k === "Phone call"
      ? "all phone calls, no messages"
      : types.map(t => fmtN(t.n) + " " + t.k.toLowerCase() + (t.n === 1 ? "" : "s")).join(" · ");
    const html = head
      + '<div class="rs-kpis" id="mkoK-lsa"></div>'
      + '<p class="rs-hint"><b>Charged</b> = Google billed the lead · <b>Credited</b> = billed, then '
      + "refunded after a dispute · <b>Not charged</b> = Google did not bill it. These are Google's own "
      + "leads; the Google Local row in the Channels table is the Moveboard leads matched to them by phone.</p>"
      + noCmpHint("Local Services", pw)
      + '<div class="mko-g2"><div id="mkoC-lsa"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Leads by job type</span>'
      + '<span class="mko-sub">' + esc(typeLine) + "</span></div>"
      + lsaTypeTable(leads, cur) + "</div></div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-lsa"), [
        kp("Cost", cur.cost, prev.cost, money, null, "", pw),
        kp("Leads", cur.leads, prev.leads, fmtN, false,
           phone === cur.leads ? "all phone calls" : fmtN(phone) + " phone calls", pw),
        kp("Charged leads", cur.Charged, prev.Charged, fmtN, null, pct(ratio(cur.Charged, cur.leads)) + " of leads", pw),
        kp("Cost per charged lead", cur.cpcl, prev.cpcl, money0, true, "cost ÷ charged leads", pw),
        kp("Credited", cur.Credited, prev.Credited, fmtN, null,
           cur["In review"] ? fmtN(cur["In review"]) + " in review" : "billed, then refunded", pw),
      ]);
      lsaCard(host.querySelector("#mkoC-lsa"), pw, cost, leads);
    } };
  }
  function lsaTypeTable(leads, cur) {
    const list = groupBy(leads, r => r.svc).map(x => {
      const o = { k: x.k, n: sum(x.rows, "n") };
      LSA_CHARGE.forEach(c => { o[c] = sum(x.rows.filter(r => r.chg === c), "n"); });
      return o;
    }).sort((a, b) => (a.k === "Not given") - (b.k === "Not given") || b.n - a.n);
    const tot = { k: "All leads", n: cur.leads };
    LSA_CHARGE.forEach(c => { tot[c] = cur[c]; });
    const isTot = r => r.k === "All leads";
    return ptable([
      { h: "Job type", name: true, tip: "Not given = Google recorded no job type for the lead",
        cell: r => isTot(r) ? esc(r.k) : shareName(esc(r.k)
          + (r.k === "Not given" ? '<div class="mko-sub">no job type recorded</div>' : ""), r.n, cur.leads) },
      { h: "Leads", num: true, cell: r => isTot(r) ? fmtN(r.n) : withShare(fmtN(r.n), r.n, cur.leads) },
      { h: "Charged", num: true, cell: r => fmtN(r.Charged) },
      { h: "Credited", num: true, cell: r => fmtN(r.Credited) },
      { h: "Not charged", num: true, tip: "not billed by Google (and any still in review)",
        cell: r => fmtN(r["Not charged"] + r["In review"]) },
    ], list, tot, true);
  }
  /* Local Services: leads per bucket stacked by charge, the cost a line on its own axis */
  function lsaCard(host, pw, cost, leads) {
    const g = pw.g;
    const keys = bucketsOf(pw.a, pw.b, g);
    const c = seriesOf(cost, keys, g, r => r.cost);
    const by = {};
    LSA_CHARGE.forEach(k => { by[k] = seriesOf(leads.filter(r => r.chg === k), keys, g, r => r.n); });
    const notCh = keys.map((_, i) => by["Not charged"][i] + by["In review"][i]);
    RSC.chartCard(host, {
      title: "Leads and cost by " + GRAIN_WORD[g],
      key: "mko-lsa-leads",
      buildChart(canvas) {
        const C = palette();
        return new Chart(canvas, {
          data: { labels: keys.map(k => bucketLabel(k, g)), datasets: [
            { type: "bar", label: "Charged", data: by.Charged, backgroundColor: C.main, stack: "l", yAxisID: "y", order: 2 },
            { type: "bar", label: "Credited", data: by.Credited, backgroundColor: C.violet, stack: "l", yAxisID: "y", order: 2 },
            { type: "bar", label: "Not charged", data: notCh, backgroundColor: C.faint, stack: "l", yAxisID: "y", order: 2 },
            { type: "line", label: "Cost", data: c.map(v => +v.toFixed(2)), borderColor: C.alt, backgroundColor: C.alt,
              borderWidth: 2, pointRadius: keys.length > 45 ? 0 : 2, cubicInterpolationMode: "monotone",
              yAxisID: "y1", order: 1 },
          ] },
          options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } },
                       tooltip: { callbacks: { label: x => x.dataset.label + ": "
                         + (x.dataset.yAxisID === "y1" ? money0(x.raw) : fmtN(x.raw) + " leads") } } },
            scales: { y: { stacked: true, beginAtZero: true, ticks: { precision: 0 },
                           title: { display: true, text: "leads" } },
                      y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false },
                            ticks: { callback: moneyTick }, title: { display: true, text: "cost" } },
                      x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } },
          },
        });
      },
      buildTable() {
        let h = '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>'
          + esc(GRAIN_WORD[g][0].toUpperCase() + GRAIN_WORD[g].slice(1)) + '</th><th class="mko-num">Cost</th>'
          + '<th class="mko-num">Leads</th><th class="mko-num">Charged</th><th class="mko-num">Credited</th>'
          + '<th class="mko-num">Not charged</th><th class="mko-num">Cost per charged</th></tr></thead><tbody>';
        keys.forEach((k, i) => {
          const n = by.Charged[i] + by.Credited[i] + notCh[i];
          h += "<tr><td>" + esc(bucketLabel(k, g)) + '</td><td class="mko-num">' + money0(c[i])
            + '</td><td class="mko-num">' + fmtN(n) + '</td><td class="mko-num">' + fmtN(by.Charged[i])
            + '</td><td class="mko-num">' + fmtN(by.Credited[i]) + '</td><td class="mko-num">' + fmtN(notCh[i])
            + '</td><td class="mko-num">' + money0(ratio(c[i], by.Charged[i])) + "</td></tr>";
        });
        return h + "</tbody></table></div>";
      },
    });
  }

  /* --- Meta --- */
  const metaKind = k => META_KIND[k] || prettyCode(k).toLowerCase();
  function metaSection(w, cw) {
    const pw = platWin("meta", w, cw);
    const head = platHead("meta", "Meta", "Facebook + Instagram · account 276439726601232 · Los Angeles days", pw);
    const rows = pw ? inRange(P.meta, pw.a, pw.b) : [];
    const gate = platGate("Meta", "meta", pw, rows);
    if (gate) return { html: head + gate };
    const cmp = pw.cw ? inRange(P.meta, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    cur.leads = sum(rows, "leads"); prev.leads = cmp ? sum(cmp, "leads") : undefined;
    const html = head
      + '<div class="rs-kpis" id="mkoK-meta"></div>'
      + '<p class="rs-hint">The account runs on Los Angeles time, so a Meta day ends three hours after '
      + "New York's. A <b>result</b> is whatever a campaign is set to win (ad recallers, page likes, form "
      + "leads...), so results of different kinds are listed side by side and never added up.</p>"
      + noCmpHint("Meta", pw)
      + '<div class="mko-g2"><div id="mkoC-meta"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Results by kind</span>'
      + '<span class="mko-sub">what the money bought, in each campaign\'s own unit</span></div>'
      + metaKindTable(rows) + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">every campaign that spent in the period, most spend first</span></div>'
      + metaCampTable(rows, cur) + "</div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-meta"), [
        kp("Spend", cur.cost, prev.cost, money, null, "", pw),
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "all clicks", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        kp("Leads", cur.leads, prev.leads, fmtN, false, "Meta's lead count", pw),
      ]);
      costCard(host.querySelector("#mkoC-meta"), "meta", "Spend", pw, rows, cmp,
               { label: "Leads", val: r => r.leads, fmt: fmtN });
    } };
  }
  function metaKindTable(rows) {
    const list = groupBy(rows.filter(r => r.kind), r => r.kind)
      .map(x => ({ k: x.k, res: sum(x.rows, "res"), cost: sum(x.rows, "cost") }))
      .filter(x => x.res || x.cost).sort((a, b) => b.cost - a.cost);
    const none = sum(rows.filter(r => !r.kind), "cost");
    if (!list.length) return '<div class="mko-empty">No campaign returned a result in this period.</div>';
    return ptable([
      { h: "Result", name: true, cell: r => esc(metaKind(r.k)) },
      { h: "Results", num: true, cell: r => fmtN(r.res) },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Cost each", num: true, cell: r => each(ratio(r.cost, r.res)) },
    ], list) + (none ? '<div class="mko-foot">' + money0(none) + " was spent by campaigns that returned "
      + "no result.</div>" : "");
  }
  function metaCampTable(rows, cur) {
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const kinds = groupBy(x.rows.filter(r => r.kind), r => r.kind)
        .map(y => ({ k: y.k, res: sum(y.rows, "res") })).filter(y => y.res).sort((a, b) => b.res - a.res);
      return Object.assign({ name: last.name, obj: last.obj, kinds }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost || b.imp - a.imp);
    const tot = Object.assign({ name: "All campaigns", obj: "", kinds: null }, cur);
    return ptable([
      { h: "Campaign", name: true, cell: r => esc(r.name)
          + (r.obj ? '<div class="mko-sub">' + esc(META_OBJ[r.obj] || prettyCode(r.obj)) + "</div>" : "") },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "Results", num: true, tip: "in each campaign's own unit; never added across kinds",
        cell: r => !r.kinds ? "" : !r.kinds.length ? '<span class="mko-sub">—</span>'
          : r.kinds.map(y => fmtN(y.res) + ' <span class="mko-sub">' + esc(metaKind(y.k)) + "</span>").join("<br>") },
      { h: "Cost each", num: true, cell: r => r.kinds && r.kinds.length === 1
          ? each(ratio(r.cost, r.kinds[0].res)) : "" },
    ], list, tot);
  }

  /* --- ChatGPT Ads --- */
  function gptSection(w, cw) {
    const pw = platWin("gpt", w, cw);
    const head = platHead("gpt", "ChatGPT Ads", "OpenAI Ads Manager · New York days", pw);
    const rows = pw ? inRange(P.gpt, pw.a, pw.b) : [];
    const gate = platGate("ChatGPT Ads", "gpt", pw, rows);
    if (gate) return { html: head + gate };
    const cmp = pw.cw ? inRange(P.gpt, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    // 0 conversions with no conversion event attached is "not measured", not "none": the card
    // and the conversions column only appear once the account has ever reported one
    const tracked = P.gpt.some(r => r.conv > 0);
    cur.conv = sum(rows, "conv"); prev.conv = cmp ? sum(cmp, "conv") : undefined;
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      return Object.assign({ name: last.name, conv: sum(x.rows, "conv") }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    const cols = [
      { h: "Campaign", name: true, cell: r => esc(r.name) },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "CPM", num: true, tip: "spend per 1,000 impressions", cell: r => cents(r.cpm) },
    ];
    if (tracked) cols.push({ h: "Conv.", num: true, cell: r => fmtN(r.conv) });
    const note = tracked ? "" : '<div class="panel"><div class="panel-head"><span class="panel-title">'
      + "Conversions: not measured</span></div><div class=\"mko-nm\">"
      + "<p>ChatGPT reports <b>0 conversions</b> every day because no conversion event is attached to "
      + "the campaign in Ads Manager (Set up, under Conversions). That 0 means <b>not measured</b>, not "
      + "that the ads brought nothing, so this panel shows no result figure.</p>"
      + "<p>What the ads brought is read on our side: the ChatGPT row in the Channels table counts the "
      + "leads filed under ChatGPT, which also include visitors from chatgpt.com answers, not only "
      + "the ads.</p></div></div>";
    const html = head
      + '<div class="rs-kpis" id="mkoK-gpt"></div>' + noCmpHint("ChatGPT Ads", pw)
      + (note ? '<div class="mko-g2"><div id="mkoC-gpt"></div>' + note + "</div>" : '<div id="mkoC-gpt"></div>')
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span></div>'
      + ptable(cols, list, list.length > 1 ? Object.assign({ name: "All campaigns" }, cur) : null) + "</div>";
    return { html, wire(host) {
      const k = [
        kp("Spend", cur.cost, prev.cost, money, null, "", pw),
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        tracked ? kp("Conversions", cur.conv, prev.conv, fmtN, false, "ChatGPT's count", pw)
          : { label: "Conversions", value: '<span class="mko-cov">not measured</span>',
              sub: "no conversion event set up" },
      ];
      RSC.kpis(host.querySelector("#mkoK-gpt"), k);
      costCard(host.querySelector("#mkoC-gpt"), "gpt", "Spend", pw, rows, cmp, null);
    } };
  }

  /* the states a panel shows instead of numbers: a failed read, no data at all, a period before
     the account existed, a period with nothing in it */
  function platGate(name, key, pw, rows) {
    const errKey = key === "lsa" ? (P.err.lsaC || P.err.lsaL) : P.err[key];
    if (errKey) {
      return '<div class="mko-empty">Could not load ' + esc(name) + " — " + esc(errKey)
        + (/404|unknown dataset|not granted|403/i.test(errKey)
          ? " (it arrives with the next bridge deploy or pipeline run)" : "") + "</div>";
    }
    if (!pw) return '<div class="mko-empty">No ' + esc(name) + " data on file yet.</div>";
    if (pw.before) {
      return '<div class="mko-empty">' + esc(name) + " data starts " + esc(day(pw.first))
        + ": pick a period from then on.</div>";
    }
    if (pw.after) {
      return '<div class="mko-empty">' + esc(name) + " data runs through " + esc(day(pw.last))
        + ": nothing has arrived for this period yet.</div>";
    }
    if (!rows.length || !rows.some(r => r.cost || r.imp || r.n)) {
      return '<div class="mko-empty">No ' + esc(name) + " activity in this period.</div>";
    }
    return "";
  }

  /* the whole middle section; `wire` runs once the markup is in the page */
  function platformsSection(w, cw) {
    const head = '<div class="mko-h" id="mkoPlatforms"><h2>Ad platforms</h2><span class="mko-sub">'
      + "Each platform's own numbers for the period: what it charged, what it showed and what it "
      + "counts as a result.</span></div>";
    if (S.co === "Tuji") {
      return { html: head + '<div class="panel"><div class="mko-nm">Every live ad account here (Google '
        + "Ads, Local Services, Meta, ChatGPT) is Zip to Zip's. Tuji has none: its spend reaches us "
        + "through the bank ledger only, in the Channels table above. Pick Zip to Zip or Both companies "
        + "to see the platforms.</div></div>", wire() {} };
    }
    const parts = [["ads", "Google Ads", adsSection], ["lsa", "Local Services", lsaSection],
                   ["meta", "Meta", metaSection], ["gpt", "ChatGPT Ads", gptSection]]
      .map(([k, name, fn]) => Object.assign({ k, name }, fn(w, cw)));
    const nav = '<div class="mko-pnav"><span>Jump to:</span>' + parts.map(p =>
      '<button type="button" data-go="mkoP-' + p.k + '">' + esc(p.name) + "</button>").join("") + "</div>";
    return {
      html: head + nav + parts.map(p => '<section class="mko-plat" id="mkoP-' + p.k + '">' + p.html
        + "</section>").join(""),
      wire(host) {
        host.querySelectorAll(".mko-pnav [data-go]").forEach(b => {
          b.onclick = () => {
            const t = host.querySelector("#" + b.dataset.go);
            if (t) t.scrollIntoView({ block: "start" });
          };
        });
        parts.forEach(p => { if (p.wire) p.wire(host.querySelector("#mkoP-" + p.k)); });
      },
    };
  }

  /* --- the data sources (bottom) --- */
  function sourcesHtml() {
    const rows = D.conn;
    if (D.connErr) return '<div class="panel">Could not load the source list — ' + esc(D.connErr) + "</div>";
    if (!rows.length) {
      return '<div class="panel">The source list is not built yet — it is written by the hourly '
        + "pipeline (sources=freshness).</div>";
    }
    const count = s => rows.filter(r => r.Status === s).length;
    const plat = rows.filter(r => r.Group === "Marketing platforms");
    const ours = rows.filter(r => r.Group !== "Marketing platforms");
    const bankThrough = (plat.find(r => r["Bank Through"]) || {})["Bank Through"];
    const bankYear = (plat.find(r => r["Bank Year"]) || {})["Bank Year"] || "";
    const pill = s => '<span class="rs-pill ' + (PILL[s] || "mute") + '">' + esc(s) + "</span>";

    function sourceCell(r) {
      const name = r.Link
        ? '<a href="' + esc(r.Link) + '" target="_blank" rel="noopener">' + esc(r.Platform) + " ↗</a>"
        : esc(r.Platform);
      const who = [r.Login, r.Account].filter(Boolean).map(esc).join(" · ");
      return '<div class="mko-src">' + name + "</div>"
        + (who ? '<div class="mko-sub">' + who + "</div>" : "")
        + (r.Note ? '<div class="mko-note">' + esc(r.Note) + "</div>" : "");
    }
    function statusCell(r) {
      return pill(r.Status)
        + (r.Connection !== r.Status ? '<div class="mko-sub">' + esc(r.Connection) + "</div>" : "")
        // the date column already says "through X"; the note earns its line only when late
        + ((r.Status === "Behind" || r.Status === "No data") && r["Status Note"]
          ? '<div class="mko-note">' + esc(r["Status Note"]) + "</div>" : "");
    }
    function bankCell(r) {
      if (r["Bank Spend"] == null) return '<span class="mko-sub">—</span>';
      const v = +r["Bank Spend"];
      return "<div>" + (v ? money0(v) : "$0") + "</div>"
        + '<div class="mko-sub">' + (r["Bank Last Charge"]
          ? "last charge " + shortDay(r["Bank Last Charge"]) : "no charges") + "</div>";
    }
    function table(list, withBank) {
      let h = '<div class="rs-tablewrap"><table class="rs-table mko-srcs"><thead><tr>'
        + "<th>Source</th><th>Status</th><th>Data through</th><th>Last pulled</th>"
        + (withBank ? '<th class="mko-num">Bank ' + esc(bankYear) + "</th>" : "")
        + "<th>What it gives</th><th>Next step</th></tr></thead><tbody>";
      list.forEach(r => {
        h += "<tr><td>" + sourceCell(r) + "</td>"
          + "<td>" + statusCell(r) + "</td>"
          + '<td class="mko-date">' + (r["Newest Data"] ? day(r["Newest Data"]) : '<span class="mko-sub">—</span>') + "</td>"
          + '<td class="mko-date">' + (r["Last Pulled"] ? shortDay(r["Last Pulled"]) : '<span class="mko-sub">—</span>') + "</td>"
          + (withBank ? '<td class="mko-num">' + bankCell(r) + "</td>" : "")
          + '<td><div class="mko-met">' + esc(r.Metrics || "") + "</div></td>"
          + '<td><div class="mko-step">' + esc(r["Next Step"] || "") + "</div></td>"
          + "</tr>";
      });
      return h + "</tbody></table></div>";
    }
    const checked = rows.map(r => r["Checked At"]).filter(Boolean).sort().pop();
    const connected = rows.filter(r => r.Status !== "Not connected").length;
    const parts = [connected + " of " + rows.length + " connected"];
    [["Up to date", "up to date"], ["Behind", "behind"], ["No data", "connected without data"],
     ["Not connected", "not connected"]].forEach(([st, l]) => { if (count(st)) parts.push(count(st) + " " + l); });
    return '<div class="mko-h" id="mkoSources"><h2>Data sources</h2><span class="mko-sub">'
      + esc(parts.join(" · ")) + "</span></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Marketing platforms'
      + "</span></div>"
      + '<p class="rs-hint">Each platform with the login that holds it and the numbers we want '
      + "from it. Not connected means no data flows yet; the last column says what unblocks it. "
      + "The bank column is what the bank ledger shows paid to the platform in " + esc(bankYear)
      + (bankThrough ? ", through " + esc(day(bankThrough)) : "") + ".</p>"
      + table(plat, true) + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Our own data'
      + "</span></div>"
      + '<p class="rs-hint">What the page reads beside the platforms: our leads, calls, jobs and '
      + "spend. Each is judged against its own rhythm, so a monthly ledger is not called late "
      + "every day.</p>"
      + table(ours, false) + "</div>"
      + '<div class="mko-foot">Status checked ' + esc(day(checked))
      + (checked && String(checked).length > 10 ? " " + esc(String(checked).slice(11, 16)) + " UTC" : "")
      + " · refreshed every hour by the pipeline.</div>";
  }

  function paint(host) {
    const w = win();
    const cw = cmpWin(w);
    let body;
    if (D.chErr) {
      body = '<div class="panel">The channel table could not load — ' + esc(D.chErr)
        + (/404|unknown dataset|not granted/i.test(D.chErr)
          ? " (it arrives with the next pipeline run, or a <b>mkt-overview</b> rebuild)" : "") + "</div>";
    } else {
      const fams = aggregate(w.a, w.bEff);
      const past = D.ledgerEnd && w.bEff > D.ledgerEnd;
      body = '<div class="rs-kpis" id="mkoKpis"></div>'
        + '<p class="rs-hint hidden" id="mkoKpiHint"></p>'
        + '<div class="panel"><div class="panel-head"><span class="panel-title">Channels</span></div>'
        + '<p class="rs-hint">Every source with leads or spend in the period. Booked = leads created in '
        + "the period that booked. Spend is live from Google Ads, Local Services, Meta and ChatGPT; "
        + "every other channel is the bank ledger"
        + (D.ledgerEnd ? ", which runs through " + esc(day(D.ledgerEnd)) : "")
        + (past ? "; a * marks cost figures read on the leads whose spend is in" : "")
        + ". Click a channel to open it in Source Analysis.</p>"
        + channelsHtml(fams) + "</div>";
    }
    // the platforms read their own tables: they stand even when the channel table failed
    const plat = platformsSection(w, cw);
    host.innerHTML = '<div class="mko">'
      + '<div class="rs-page-head"><h1>Marketing Overview</h1>'
      + "<p>What each channel cost and brought in the period, each ad platform's own numbers, then "
      + "every source that feeds this page and whether it is up to date.</p></div>"
      + '<div class="rs-bar">'
      + '<div id="mkoCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="mkoDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="mkoCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + "</div>"
      + feedsHtml()
      + body
      + plat.html
      + sourcesHtml()
      + "</div>";

    RSC.localSelect(host.querySelector("#mkoCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: S.co,
      onChange: v => { S.co = v; paint(host); },
    });
    RSC.dateRange(host.querySelector("#mkoDate"), {
      get: () => ({ from: S.from, to: S.to }),
      set: (f, t) => { S.from = f; S.to = t; savePeriod(); },
      onChange: () => paint(host),
    });
    const cmp = host.querySelector("#mkoCmp");
    cmp.querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", !w.open && b.dataset.v === S.cmp);
      b.disabled = !!w.open;
      if (w.open) b.title = "no comparison for All time — pick a period to compare";
      b.onclick = () => { S.cmp = b.dataset.v; lsSet(LS_CMP, S.cmp); paint(host); };
    });
    const k = host.querySelector("#mkoKpis");
    if (k) kpisFor(k, w, cw);
    const kh = host.querySelector("#mkoKpiHint");
    if (kh) {
      const short = aggregate(w.a, w.bEff).some(f => f.paid && f.uncov);
      const bits = [];
      if (short) {
        bits.push("The bank ledger runs through " + day(D.ledgerEnd) + ": for later days the cost "
          + "figures count only the channels with live spend (Google Ads, Local Services, Meta, "
          + "ChatGPT)" + (cw ? ", in both periods" : "") + ".");
      }
      if (cw) {
        bits.push("The " + cw.label + "'s bookings are counted as they stood on " + day(cw.asOf)
          + ", so a young cohort is not set against one that had longer to book.");
      }
      kh.innerHTML = bits.map(esc).join(" ");
      kh.classList.toggle("hidden", !bits.length);
    }
    plat.wire(host);
  }

  registerPage({
    id: "marketing-overview",
    group: "marketing",
    title: "Marketing Overview",
    subtitle: "What each channel cost and brought for any period, each ad platform's own numbers, " +
              "then every source that feeds this page and whether it is up to date.",
    datasets: [],

    render(host) {
      const mine = host;
      const alive = () => document.body.contains(mine);
      injectStyle();
      // RS.load caches per refresh epoch, so asking again on every visit is free and picks up the
      // hourly rebuild; the loading bar shows on the first visit only
      if (!D.ready) {
        host.innerHTML = '<div class="rs-loading">Reading leads, bookings and ad spend by channel…'
          + '<div class="bar"><i></i></div></div>';
      }
      D.connErr = null; D.chErr = null; P.err = {};
      // each platform table fails on its own: its panel says so and the rest still draw
      const plat = (ds, k) => RS.load(ds).catch(e => { P.err[k] = (e && e.message) || String(e); return []; });
      Promise.all([
        RS.load("mkt_connector").catch(e => { D.connErr = (e && e.message) || String(e); return []; }),
        RS.load("mkt_channel").catch(e => { D.chErr = (e && e.message) || String(e); return []; }),
        plat("mkt_ads", "ads"), plat("mkt_lsa_cost", "lsaC"), plat("mkt_lsa_lead", "lsaL"),
        plat("mkt_meta", "meta"), plat("mkt_gpt", "gpt"),
      ]).then(([conn, ch, ads, lsaC, lsaL, meta, gpt]) => {
        D.conn = (conn || []).slice().sort((a, b) => (+a.Sort || 0) - (+b.Sort || 0));
        index(ch || []);
        indexPlatforms(ads, lsaC, lsaL, meta, gpt);
        // a failed read is tried again on the next visit
        D.ready = !D.chErr && !D.connErr && !Object.keys(P.err).length;
        if (!alive()) return;
        boot();
        paint(host);
      });
    },
  });
})();
