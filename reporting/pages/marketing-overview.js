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
 * THE REDESIGN (2026-10-17). His verdict on the stacked page: "its ugly, it is not analytical, and the
 * metrics team asked us to track - is not there", and "whats live and what is not is something we
 * should have on separate tab, lets say settings". Approved from the canvas prototype as FIVE TABS on
 * one Company / Period / Compare bar (the tab is remembered per viewer):
 *   * OVERVIEW -- the KPI row, WHAT STANDS OUT (fixed checks on the period's numbers, his "Yes,
 *     rule-based": platform conversions far above our real leads, one platform's cost per booking
 *     1.8x another's, spend up while bookings fall, organic clicks or the Ahrefs estimate sliding, a
 *     tracked city outside Google's top 100, the ledger behind), cost per booking by platform, the
 *     PLATFORM SCOREBOARD (each platform's own claim beside our leads and bookings; platforms with
 *     no connector keep a row with the bank's spend), Google Ads spend and conversions over time,
 *     and every channel.
 *   * PAID ADS -- the four platform panels above, each carrying the metrics his team listed, plus a
 *     card per platform not connected yet (Reddit, Nextdoor, LinkedIn, TikTok).
 *   * SEARCH AND SEO -- Search Console (ext_gsc_site_day, the monthly query mart), Ahrefs and
 *     BrightLocal's weekly rank reports (ext_brightlocal_rank, src/brightlocal_api.py).
 *   * WEBSITE -- GA4: active users, engagement time, bounce rate, sources, locations (the month x
 *     region mart) and demographics, under a banner whenever GA4 saw fewer users than we got leads.
 *   * SETTINGS -- the data sources, as before, out of the way.
 *
 * BATCH 1 OF THE MARKETING HEAD'S COMMENTS (2026-10-19):
 *   * Google Ads by ACTIVE campaign (ENABLED in ext_ads_campaign) with Google's conversions split by
 *     kind (ext_ads_conv_day): leads (forms, calls, quote requests) apart from the rest. In October 2026
 *     537 of 573 were "YouTube follow-on views", counted since 22 Aug 2026.
 *   * Meta campaigns by category, read from the name (Referral / B2B / Leads / Awareness / ...).
 *   * ChatGPT Ads per ad, with the ad's own words (ext_chatgpt_ads_ad_day + ext_chatgpt_ad).
 *   * Nextdoor / Perplexity / Gemini / Quora / Reddit / Grok as their own group of channels.
 *   * SEO: keywords by service (the monthly query mart), on-page (Ahrefs Site Audit) and off-page.
 *   * REVIEWS, a tab of its own: every listing's reviews now against its goal (fct_review_counts /
 *     fct_review_goals, the Monthly Report's rule: a goal dated 1 Sep is the total by the end of
 *     August), with what the period added and what platforms REMOVED kept apart (RS.reviewFlow).
 *
 * Plan of record: docs/plans/2026-10-15-marketing-overview.md.
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
                cols: ["Date", "Campaign Id", "Campaign", "Objective", "Impressions", "Reach", "Clicks",
                       "Spend", "Post Engagement", "Leads", "Results", "Result Indicator"] },
    mkt_gpt: { table: "ext_chatgpt_ads_day",
               cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks", "Spend", "Conversions"] },
    // the Search and SEO tab
    mkt_gsc: { table: "ext_gsc_site_day", cols: ["Date", "Clicks", "Impressions", "Position"] },
    mkt_gscq: { table: "mart_gsc_query", cols: ["Date", "Query", "Type", "Clicks", "Impressions", "Position"] },
    mkt_ahd: { table: "ext_ahrefs_day", cols: ["Date", "Domain Rating", "Org Keywords", "Org Keywords Top 3",
                                              "Org Traffic", "Backlinks Live", "Ref Domains Live"] },
    mkt_ahm: { table: "ext_ahrefs_month", cols: ["Month", "Domain Rating", "Org Traffic", "Ref Domains History"] },
    // batch 1 (2026-10-19): Google conversions by kind and campaign status, ChatGPT per ad, the site
    // audit, and the review listings with their goals
    mkt_adsconv: { table: "ext_ads_conv_day", cols: ["Date", "Campaign Id", "Action", "Category", "Conversions"] },
    mkt_adscamp: { table: "ext_ads_campaign", cols: ["Campaign Id", "Campaign", "Channel", "Status"] },
    mkt_gptad: { table: "ext_chatgpt_ads_ad_day", cols: ["Date", "Ad Id", "Ad", "Ad Group", "Impressions", "Clicks",
                                                         "Spend", "Conversions"] },
    mkt_gptads: { table: "ext_chatgpt_ad", cols: ["Ad Id", "Ad", "Status", "Format", "Title", "Body"] },
    mkt_audit: { table: "ext_ahrefs_audit", cols: ["Date", "Health Score", "Pages Errors", "Pages Warnings",
                                                   "Pages Notices", "Pages Total", "Crawl Date"] },
    mkt_issue: { table: "ext_ahrefs_audit_issue", cols: ["Date", "Issue", "Importance", "Category", "Pages", "Change"] },
    mkt_rcount: { table: "fct_review_counts", cols: ["Company", "Platform", "Date", "Number of Reviews"] },
    mkt_rgoal: { table: "fct_review_goals", cols: ["Company", "Platform", "Date", "Number of Reviews"] },
    mkt_bl: { table: "ext_brightlocal_rank", cols: ["Report Id", "Location", "Postcode", "Run Date", "Keyword",
                                                    "Engine", "Rank", "Listings"] },
    // the Website tab
    mkt_ga4: { table: "ext_ga4_site_day", cols: ["Date", "Sessions", "Engaged Sessions", "Active Users",
                                                "Engagement Seconds", "Key Events"] },
    mkt_ga4ch: { table: "ext_ga4_channel_day", cols: ["Date", "Channel Group", "Sessions"] },
    mkt_ga4demo: { table: "ext_ga4_demo_month", cols: ["Month", "Age", "Gender", "Active Users"] },
    mkt_ga4geo: { table: "mart_mkt_ga4_geo_month", cols: ["Month", "Country", "Region", "Active Users"] },
  };
  Object.keys(PLAT).forEach(k => {
    if (!RS.DATASETS[k]) RS.DATASETS[k] = Object.assign({ dateCols: {}, defaultDate: null }, PLAT[k]);
  });
})();

(() => {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LS_PERIOD = "mkoPeriod", LS_CMP = "mkoCmp", LS_TAB = "mkoTab";
  const TABS = [["ov", "Overview"], ["paid", "Paid ads"], ["seo", "Search and SEO"], ["web", "Website"],
                ["rev", "Reviews"], ["set", "Settings"]];
  // Google's conversion categories that are a lead; everything else (YouTube follow-on views,
  // engagement, page views) is counted apart
  const CONV_LEAD = new Set(["SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "REQUEST_QUOTE", "CONTACT", "BOOK_APPOINTMENT",
                             "IMPORTED_LEAD", "QUALIFIED_LEAD", "CONVERTED_LEAD"]);
  const CONV_WORD = { YOUTUBE_FOLLOW_ON_VIEWS: "YouTube follow-on views", ENGAGEMENT: "engagements",
                      PAGE_VIEW: "page views", SUBMIT_LEAD_FORM: "lead forms", PHONE_CALL_LEAD: "calls",
                      REQUEST_QUOTE: "quote requests", CONTACT: "contacts", BOOK_APPOINTMENT: "bookings" };
  // the marketing head (2026-10-19): these lead sources are their own group, not mixed into paid / unpaid
  const COMMUNITY = ["Nextdoor", "Perplexity", "Gemini", "Quora", "Reddit", "Grok"];
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
  const S = { co: LIVE_CO, from: null, to: null, cmp: "ly", tab: "ov", booted: false };
  const D = { ready: false, conn: [], connErr: null, rows: [], chErr: null,
              liveFrom: {}, ledgerEnd: null, minDay: null, maxDay: null };
  // the platform panels: rows per platform, its first / last day on file, a load error
  const P = { ads: [], lsaC: [], lsaL: [], meta: [], gpt: [], gsc: [], gscq: [], ahd: [], ahm: [], bl: [],
              ga4: [], ga4ch: [], demo: [], geo: [], conv: [], camp: {}, gptad: [], gptads: {}, audit: null,
              issues: [], rc: [], rg: [], first: {}, last: {}, err: {} };
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
      // the redesign: tabs, the status chip, two equal columns, insights, bars, cards, ranks
      + ".mko .mko-tabs{display:flex;flex-wrap:wrap;gap:2px;border-bottom:1px solid var(--line);margin:6px 0 16px}"
      + ".mko .mko-tabs button{font:inherit;font-size:14px;font-weight:600;color:var(--muted);background:none;border:0;"
      + "border-bottom:3px solid transparent;margin-bottom:-1px;padding:10px 14px;cursor:pointer}"
      + ".mko .mko-tabs button:hover{color:var(--ink)}"
      + ".mko .mko-tabs button.on{color:var(--ink);border-bottom-color:var(--brand)}"
      + ".mko .mko-chip{font:inherit;font-size:12.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;"
      + "padding:8px 13px;border-radius:999px;border:1px solid var(--line-2);background:var(--panel);color:var(--ink);"
      + "cursor:pointer;margin-left:auto;align-self:flex-end}"
      + ".mko .mko-chip:hover{border-color:var(--brand)}"
      + ".mko .mko-g2e{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(440px,100%),1fr));gap:14px;align-items:start}"
      + ".mko .mko-ins{display:flex;gap:12px;align-items:flex-start;padding:11px 0;border-bottom:1px solid var(--line);"
      + "font-size:13.5px;line-height:1.55}"
      + ".mko .mko-ins:last-child{border-bottom:0}"
      + ".mko .mko-ins b{font-weight:700}"
      + ".mko .mko-ins-i{flex:none;width:26px;height:26px;border-radius:50%;display:flex;align-items:center;"
      + "justify-content:center;font-weight:800;font-size:13px;background:var(--panel-2);color:var(--ink)}"
      + ".mko .mko-ins-i.warn{background:rgba(217,119,6,.16);color:#B45309}"
      + ".mko .mko-ins-i.bad{background:rgba(220,38,38,.13);color:var(--neg)}"
      + ".mko .mko-ins button{font:inherit;font-size:12.5px;font-weight:600;background:none;border:0;padding:0;"
      + "margin-left:4px;color:var(--ink);cursor:pointer;border-bottom:1px dotted currentColor}"
      + ".mko .mko-ins button:hover{color:var(--brand)}"
      + ".mko .mko-hbar{display:grid;grid-template-columns:minmax(90px,150px) minmax(0,1fr) 72px;gap:10px;"
      + "align-items:center;margin:9px 0;font-size:13px}"
      + ".mko .mko-hbar b{font-weight:700;text-align:right}"
      + ".mko .mko-hbar .mko-sub{display:block;margin:0}"
      + ".mko .mko-track{display:block;height:16px;border-radius:5px;background:var(--line)}"
      + ".mko .mko-track i{display:block;height:16px;border-radius:5px;background:var(--brand)}"
      + ".mko .mko-track i.bad{background:var(--neg)}.mko .mko-track i.thin{opacity:.4}"
      + ".mko .mko-ours{background:rgba(127,127,127,.06)}"
      + ".mko .mko-offs{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(240px,100%),1fr));gap:12px}"
      + ".mko .mko-off{border:1px dashed var(--line-2);border-radius:12px;padding:14px 16px;font-size:12.5px;"
      + "line-height:1.55;color:var(--muted);display:flex;flex-direction:column;gap:6px}"
      + ".mko .mko-off b{font-size:14px;font-weight:700;color:var(--ink)}"
      + ".mko .mko-warn{background:rgba(217,119,6,.10);border:1px solid rgba(217,119,6,.35);border-radius:10px;"
      + "padding:11px 14px;font-size:13px;line-height:1.55;margin:0 0 12px}"
      + ".mko .mko-h3{margin:14px 0 2px;font-size:14px;font-weight:700;color:var(--ink)}"
      + ".mko .mko-rk{font-weight:700}.mko .mko-rk.top{color:var(--pos)}.mko .mko-rk.low{color:var(--muted)}"
      + ".mko .mko-track.mko-mini{display:inline-block;width:70px;height:8px;margin-right:8px;vertical-align:middle}"
      + ".mko .mko-track.mko-mini i{height:8px}"
      + ".mko .mko-neg{color:var(--neg);font-weight:600}.mko .mko-pos{color:var(--pos);font-weight:600}"
      + ".mko .mko-k3{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:10px}"
      + "@media(max-width:600px){.mko .rs-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}"
      + ".mko .rs-kpis .kpi{padding:10px 12px}}"
      + "body.rs-app.light.v2 .mko .mko-sub,body.rs-app.light.v2 .mko .mko-note,"
      + "body.rs-app.light.v2 .mko .mko-met,body.rs-app.light.v2 .mko .mko-foot,"
      + "body.rs-app.light.v2 .mko .mko-feed,body.rs-app.light.v2 .mko .mko-cov,"
      + "body.rs-app.light.v2 .mko .mko-pnav,body.rs-app.light.v2 .mko .mko-empty,"
      + "body.rs-app.light.v2 .mko .mko-off,body.rs-app.light.v2 .mko .mko-tabs button,"
      + "body.rs-app.light.v2 .mko .mko-rk.low{color:#64748B}"
      + "body.rs-app.light.v2 .mko .mko-tabs button.on{color:#0F172A;border-bottom-color:#3F7D20}"
      + "body.rs-app.light.v2 .mko .mko-track i{background:#3F7D20}"
      + "body.rs-app.light.v2 .mko .mko-track i.bad{background:#B42318}"
      + "body.rs-app.light.v2 .mko .mko-rk.top{color:#17733F}"
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
    const t = lsGet(LS_TAB);
    if (TABS.some(x => x[0] === t)) S.tab = t;
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

  function channelRows(list, label, sortKey, totLabel) {
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
    const paid = list.some(f => f.paid);
    h += '<tr class="mko-tot"><td>' + esc(totLabel || "All " + label.toLowerCase()) + "</td>"
      + '<td class="mko-num">' + (!paid ? '<span class="mko-sub">—</span>'
        : list.filter(f => f.paid).some(f => f.anyCov) ? money0(t.spend)
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
    const isCom = f => COMMUNITY.includes(f.fam);
    const paid = fams.filter(f => f.paid && !isCom(f)), free = fams.filter(f => !f.paid && !isCom(f));
    const com = fams.filter(isCom);
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
      + channelRows(com, "AI assistants and communities", "leads", "All AI assistants and communities")
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
        reach: num(r.Reach), eng: num(r["Post Engagement"]), leads, kind, res: ind ? num(r.Results) : leads };
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
  // the search and website tables: the day ones go through indexPlat (so platWin cuts them like a
  // platform), the monthly ones keep their month
  function indexWeb(t) {
    indexPlat("gsc", t.gsc, r => ({ d: d10(r.Date), clk: num(r.Clicks), imp: num(r.Impressions),
      pos: r.Position == null ? null : num(r.Position) }));
    indexPlat("ga4", t.ga4, r => ({ d: d10(r.Date), ses: num(r.Sessions), eng: num(r["Engaged Sessions"]),
      users: num(r["Active Users"]), secs: num(r["Engagement Seconds"]), kev: num(r["Key Events"]) }));
    indexPlat("ga4ch", t.ga4ch, r => ({ d: d10(r.Date), grp: r["Channel Group"] || "", ses: num(r.Sessions) }));
    const m7 = v => String(v || "").slice(0, 7);
    P.gscq = (t.gscq || []).map(r => ({ m: m7(r.Date), q: r.Query || "", type: r.Type || "Other",
      clk: num(r.Clicks), imp: num(r.Impressions), pos: r.Position == null ? null : num(r.Position) }));
    P.ahd = (t.ahd || []).map(r => ({ d: d10(r.Date), dr: r["Domain Rating"] == null ? null : num(r["Domain Rating"]),
      kw: num(r["Org Keywords"]), kw3: num(r["Org Keywords Top 3"]), traffic: num(r["Org Traffic"]),
      bl: num(r["Backlinks Live"]), rd: num(r["Ref Domains Live"]) })).sort((a, b) => (a.d < b.d ? -1 : 1));
    P.ahm = (t.ahm || []).map(r => ({ m: m7(r.Month), dr: r["Domain Rating"] == null ? null : num(r["Domain Rating"]),
      traffic: num(r["Org Traffic"]) })).filter(r => r.m).sort((a, b) => (a.m < b.m ? -1 : 1));
    P.bl = (t.bl || []).map(r => ({ rep: String(r["Report Id"]), loc: r.Location || "", post: r.Postcode || "",
      d: d10(r["Run Date"]), kw: r.Keyword || "", eng: r.Engine || "", rank: r.Rank == null ? null : num(r.Rank) }))
      .filter(r => r.d && r.kw);
    P.demo = (t.demo || []).map(r => ({ m: m7(r.Month), age: r.Age || "", sex: r.Gender || "", users: num(r["Active Users"]) }));
    P.geo = (t.geo || []).map(r => ({ m: m7(r.Month), country: r.Country || "", region: r.Region || "",
      users: num(r["Active Users"]) }));
    P.ahm.forEach((r, i) => { const src = (t.ahm || []).find(x => m7(x.Month) === r.m); r.rdh = src && src["Ref Domains History"] != null ? num(src["Ref Domains History"]) : null; });
  }
  function indexBatch1(t) {
    P.conv = (t.conv || []).map(r => ({ d: d10(r.Date), cid: String(r["Campaign Id"]), action: r.Action || "",
      cat: r.Category || "", n: num(r.Conversions) })).filter(r => r.d);
    P.camp = {};
    (t.camp || []).forEach(r => { P.camp[String(r["Campaign Id"])] = { name: r.Campaign, type: r.Channel, status: r.Status }; });
    indexPlat("gptad", t.gptad, r => ({ d: d10(r.Date), id: r["Ad Id"], name: r.Ad || "", grp: r["Ad Group"] || "",
      cost: num(r.Spend), imp: num(r.Impressions), clk: num(r.Clicks), conv: num(r.Conversions) }));
    P.gptads = {};
    (t.gptads || []).forEach(r => { P.gptads[r["Ad Id"]] = { status: r.Status || "", format: r.Format || "",
      title: r.Title || "", body: r.Body || "" }; });
    const audits = (t.audit || []).map(r => ({ d: d10(r.Date), health: r["Health Score"] == null ? null : num(r["Health Score"]),
      err: num(r["Pages Errors"]), warn: num(r["Pages Warnings"]), note: num(r["Pages Notices"]),
      total: num(r["Pages Total"]), crawl: d10(r["Crawl Date"]) })).sort((a, b) => (a.d < b.d ? -1 : 1));
    P.audit = audits.length ? audits[audits.length - 1] : null;
    P.auditPrev = audits.length > 1 ? audits[audits.length - 2] : null;
    const iss = (t.issue || []).map(r => ({ d: d10(r.Date), name: r.Issue || "", imp: r.Importance || "",
      cat: r.Category || "", pages: num(r.Pages), change: num(r.Change) }));
    const lastD = iss.reduce((a, r) => (r.d > a ? r.d : a), "");
    P.issues = iss.filter(r => r.d === lastD);
    const rv = r => ({ co: r.Company || "", plat: r.Platform || "", d: d10(r.Date), n: num(r["Number of Reviews"]) });
    P.rc = (t.rc || []).map(rv).filter(r => r.d);
    P.rg = (t.rg || []).map(rv).filter(r => r.d);
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
    // what Google counted, by kind: leads apart from YouTube views and the rest
    const cv = inRange(P.conv, pw.a, pw.b);
    const cvLead = sum(cv.filter(r => CONV_LEAD.has(r.cat)), "n"), cvAll = sum(cv, "n");
    const cvKinds = groupBy(cv, r => r.cat).map(x => ({ k: x.k, n: sum(x.rows, "n") })).filter(x => x.n).sort((a, b) => b.n - a.n);
    const ytFirst = P.conv.filter(r => r.cat === "YOUTUBE_FOLLOW_ON_VIEWS")
      .reduce((a, r) => (!a || r.d < a ? r.d : a), null);
    const kindWord = k => CONV_WORD[k] || prettyCode(k).toLowerCase();
    const mix = cvKinds.map(x => fmtN(x.n) + " " + kindWord(x.k)).join(" · ");
    const yt = sum(cv.filter(r => r.cat === "YOUTUBE_FOLLOW_ON_VIEWS"), "n");
    const html = head
      + '<div class="rs-kpis" id="mkoK-ads"></div>'
      + (cvAll && yt / cvAll >= 0.3 ? '<div class="mko-warn">Of the <b>' + fmtN(cvAll) + "</b> conversions Google "
        + "counted in this period, <b>" + fmtN(yt) + "</b> are YouTube follow-on views"
        + (ytFirst ? " (Google has counted them since " + esc(day(ytFirst)) + ")" : "") + " and only <b>"
        + fmtN(cvLead) + "</b> are leads: forms, calls and quote requests. Judge the account on its lead "
        + "conversions and on cost per booking.</div>" : "")
      + '<p class="rs-hint">Conversions are what Google counts on this account' + (mix ? " (" + esc(mix) + ")" : "")
      + ", not our leads or booked jobs: those are the Google row in the channel table, whose spend is this "
      + "same cost.</p>" + noCmpHint("Google Ads", pw)
      + '<div class="mko-g2"><div id="mkoC-ads"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">By campaign type</span></div>'
      + adsTypeTable(rows, cur) + "</div></div>"
      + adsCampHtml(rows, cv);
    return { html, wire(host) {
      const f = famStat("Google", pw.a, pw.b);
      RSC.kpis(host.querySelector("#mkoK-ads"), [
        kp("Impressions", cur.imp, prev.imp, compact, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "cost ÷ clicks", pw),
        kp("Cost", cur.cost, prev.cost, money, null, "", pw),
        kp("Conversions", cur.conv, prev.conv, fmtN, false,
           cvAll ? fmtN(cvLead) + " leads · " + fmtN(cvAll - cvLead) + " other" : "Google's count", pw),
        kp("Cost per conv.", cpa(cur), cmp ? cpa(prev) : undefined, money0, true,
           cvLead ? "per lead conversion " + money0(ratio(cur.cost, cvLead)) : "", pw),
        { label: "Cost per booking", value: f && f.cpb != null ? money0(f.cpb) : "—",
          sub: f ? fmtN(f.booked) + " booked of " + fmtN(f.leads) + " Google leads" : "our side" },
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
  /* the campaigns, ACTIVE (enabled) first: each one's own conversions split into leads and the rest,
     and its cost per lead conversion; a paused campaign that still spent in the period sits below */
  function adsCampHtml(rows, cv) {
    const lead = {}, other = {};
    cv.forEach(r => { const m = CONV_LEAD.has(r.cat) ? lead : other; m[r.cid] = (m[r.cid] || 0) + r.n; });
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const c = P.camp[String(x.k)] || {};
      return Object.assign({ id: String(x.k), name: last.name, type: last.type, status: c.status || "",
                             lead: lead[x.k] || 0, other: other[x.k] || 0 }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost || b.imp - a.imp);
    const known = Object.keys(P.camp).length > 0;
    const active = known ? list.filter(x => x.status === "ENABLED") : list;
    const paused = known ? list.filter(x => x.status !== "ENABLED") : [];
    const idle = Object.entries(P.camp).filter(([id, c]) => c.status === "ENABLED" && !list.some(x => x.id === id));
    const cols = [
      { h: "Campaign", name: true, cell: r => esc(r.name)
          + (r.type ? '<div class="mko-sub">' + esc(ADS_TYPE[r.type] || prettyCode(r.type)) + "</div>" : "") },
      { h: "Cost", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => compact(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "Lead conv.", num: true, tip: "forms, calls and quote requests Google counted", cell: r => "<b>" + fmtN(r.lead) + "</b>" },
      { h: "Other conv.", num: true, tip: "YouTube follow-on views, engagements, page views", cell: r => fmtN(r.other) },
      { h: "Cost / lead conv.", num: true, cell: r => money0(ratio(r.cost, r.lead)) },
    ];
    const tot = xs => Object.assign({ name: "All", type: "", lead: sum(xs, "lead"), other: sum(xs, "other") },
      { cost: sum(xs, "cost"), imp: sum(xs, "imp"), clk: sum(xs, "clk") },
      { ctr: ratio(sum(xs, "clk"), sum(xs, "imp")), cpc: ratio(sum(xs, "cost"), sum(xs, "clk")) });
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Active campaigns</span>'
      + '<span class="mko-sub">' + (known ? "enabled in Google Ads, most cost first" : "every campaign that showed an ad")
      + "</span></div>" + (active.length ? ptable(cols, active, active.length > 1 ? tot(active) : null)
        : '<div class="mko-empty">No active campaign spent in this period.</div>')
      + (idle.length ? '<p class="rs-hint">Enabled but no spend in the period: ' + esc(idle.map(([, c]) => c.name).join(", ")) + ".</p>" : "")
      + "</div>"
      + (paused.length ? '<div class="panel"><div class="panel-head"><span class="panel-title">Paused campaigns that spent in the period</span></div>'
        + ptable(cols, paused, paused.length > 1 ? tot(paused) : null) + "</div>" : "");
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
  /* a campaign's category, read from its name the way the team names them ("July 2026 // Referral //
     Leads", "awareness NJ", "FB Followers"), the objective when the name says nothing */
  function metaCat(name, obj) {
    const t = String(name || "").toLowerCase();
    if (/referr/.test(t)) return "Referral";
    if (/\bb2b\b|business to business/.test(t)) return "B2B";
    if (/lead/.test(t) || obj === "OUTCOME_LEADS") return "Leads";
    if (/awareness|video view|\breach\b/.test(t) || obj === "OUTCOME_AWARENESS") return "Awareness";
    if (/follower|engagement|\blikes?\b/.test(t) || obj === "OUTCOME_ENGAGEMENT") return "Engagement";
    if (/traffic/.test(t) || obj === "OUTCOME_TRAFFIC") return "Traffic";
    return "Other";
  }
  function metaCatTable(rows, cur) {
    const list = groupBy(rows, r => metaCat(r.name, r.obj)).map(x => {
      const m = metaResult(x.rows);
      // clickStats carries its own `n` (rows): the campaign count needs a name of its own
      return Object.assign({ k: x.k, leads: sum(x.rows, "leads"), m }, clickStats(x.rows),
                           { camps: new Set(x.rows.map(r => r.id)).size });
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    if (!list.length) return '<div class="mko-empty">No campaign spent in this period.</div>';
    return ptable([
      { h: "Category", name: true, cell: r => shareName("<b>" + esc(r.k) + "</b>", r.cost, cur.cost)
          + '<div class="mko-sub">' + r.camps + " campaign" + (r.camps === 1 ? "" : "s") + "</div>" },
      { h: "Spend", num: true, cell: r => withShare(money0(r.cost), r.cost, cur.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => compact(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "Leads", num: true, tip: "Meta's lead count", cell: r => fmtN(r.leads) },
      { h: "Main result", num: true, tip: "the result the most money bought; kinds are never added",
        cell: r => r.m ? compact(r.m.top.res) + '<div class="mko-sub">' + esc(metaKind(r.m.top.k)) + "</div>" : "—" },
    ], list, null);
  }
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
    cur.reach = sum(rows, "reach"); prev.reach = cmp ? sum(cmp, "reach") : undefined;
    cur.eng = sum(rows, "eng"); prev.eng = cmp ? sum(cmp, "eng") : undefined;
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
      + '<div class="panel"><div class="panel-head"><span class="panel-title">By category</span>'
      + '<span class="mko-sub">read from each campaign\'s name: Referral, B2B, Leads, Awareness, Engagement, Traffic</span></div>'
      + metaCatTable(rows, cur) + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">every campaign that spent in the period, most spend first</span></div>'
      + metaCampTable(rows, cur) + "</div>";
    return { html, wire(host) {
      // a result of one kind is compared only with the same kind in the other period
      const mr = metaResult(rows), pm = cmp && mr
        ? sum(cmp.filter(r => r.kind === mr.top.k), "res") : undefined;
      RSC.kpis(host.querySelector("#mkoK-meta"), [
        kp("Impressions", cur.imp, prev.imp, compact, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "all clicks", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Reach", cur.reach, prev.reach, compact, false, "summed per day", pw),
        kp("Engagement", cur.eng, prev.eng, compact, false, "post engagements", pw),
        kp("Cost per click", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        mr ? kp("Results", mr.top.res, pm, compact, false, metaKind(mr.top.k)
               + (mr.others ? " · +" + mr.others + " other kind" + (mr.others > 1 ? "s" : "") : ""), pw)
           : { label: "Results", value: "—", sub: "no campaign returned one" },
        kp("Cost", cur.cost, prev.cost, money, null, "", pw),
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
      return Object.assign({ name: last.name, obj: last.obj, cat: metaCat(last.name, last.obj), kinds }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost || b.imp - a.imp);
    const tot = Object.assign({ name: "All campaigns", obj: "", kinds: null }, cur);
    return ptable([
      { h: "Campaign", name: true, cell: r => esc(r.name)
          + (r.obj ? '<div class="mko-sub">' + esc((r.cat ? r.cat + " · " : "") + (META_OBJ[r.obj] || prettyCode(r.obj))) + "</div>" : "") },
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
      + ptable(cols, list, list.length > 1 ? Object.assign({ name: "All campaigns" }, cur) : null) + "</div>"
      + gptAdsHtml(pw);
    return { html, wire(host) {
      const k = [
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        kp("Avg CPM", cur.cpm, prev.cpm, cents, true, "spend per 1,000 impressions", pw),
        kp("Spend", cur.cost, prev.cost, money, null, "", pw),
        tracked ? kp("Conversions", cur.conv, prev.conv, fmtN, false, "ChatGPT's count", pw)
          : { label: "Conversions", value: '<span class="mko-cov">not measured</span>',
              sub: "no conversion event set up" },
      ];
      RSC.kpis(host.querySelector("#mkoK-gpt"), k);
      costCard(host.querySelector("#mkoC-gpt"), "gpt", "Spend", pw, rows, cmp, null);
    } };
  }

  /* ChatGPT per ad, with the ad's own words: "Ad 1" / "Ad 2" say nothing by themselves */
  function gptAdsHtml(pw) {
    if (P.err.gptad) return "";
    const rows = inRange(P.gptad, pw.a, pw.b);
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      return Object.assign({ id: x.k, name: last.name, grp: last.grp, ad: P.gptads[x.k] || {} }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    if (!list.length) return "";
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Ads</span>'
      + '<span class="mko-sub">each ad in the period, with its own words</span></div>'
      + ptable([
        { h: "Ad", name: true, cell: r => "<b>" + esc(r.name) + "</b> "
            + (r.ad.status ? pill(r.ad.status, r.ad.status === "active" ? "ok" : "mute") : "")
            + (r.ad.title ? '<div class="mko-sub"><b>' + esc(r.ad.title) + "</b> · " + esc(r.ad.body || "") + "</div>" : "")
            + (r.grp ? '<div class="mko-sub">' + esc(r.grp) + "</div>" : "") },
        { h: "Spend", num: true, cell: r => money0(r.cost) },
        { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
        { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
        { h: "CTR", num: true, cell: r => pct2(r.ctr) },
        { h: "CPC", num: true, cell: r => cents(r.cpc) },
        { h: "CPM", num: true, tip: "spend per 1,000 impressions", cell: r => cents(r.cpm) },
      ], list, null) + "</div>";
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
    const head = '<p class="rs-hint" id="mkoPlatforms">Each platform\'s own numbers for the period: what it '
      + "charged, what it showed and what it counts as a result, with the metrics your team tracks.</p>";
    if (S.co === "Tuji") {
      return { html: head + '<div class="panel"><div class="mko-nm">Every live ad account here (Google '
        + "Ads, Local Services, Meta, ChatGPT) is Zip to Zip's. Tuji has none: its spend reaches us "
        + "through the bank ledger only, in the Overview's channel table. Pick Zip to Zip or Both "
        + "companies to see the platforms.</div></div>", wire() {} };
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

  /* ------------------------------------------------------------------ the five tabs ---- */
  // a channel family's numbers on Zip to Zip only (every live ad account is Zip to Zip's)
  function withCo(co, fn) {
    const keep = S.co;
    S.co = co;
    try { return fn(); } finally { S.co = keep; }
  }
  function famStat(fam, a, b) { return withCo(LIVE_CO, () => aggregate(a, b).find(f => f.fam === fam) || null); }
  const upDown = d => (d >= 0 ? "up " : "down ") + Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + "%";
  // a change of a rate, in points (bounce rate, CTR)
  function deltaPts(cur, prev, lowerIsBetter) {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return "";
    const d = (cur - prev) * 100;
    if (Math.abs(d) < 0.05) return '<span class="mko-d eq">± 0 pts</span>';
    const good = lowerIsBetter ? d < 0 : d > 0;
    return '<span class="mko-d ' + (good ? "up" : "dn") + '" title="change in percentage points">'
      + (d > 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1) + " pts</span>";
  }
  const dur = s => s == null || isNaN(s) ? "—" : s < 60 ? Math.round(s) + "s"
    : Math.floor(s / 60) + "m " + Math.round(s % 60) + "s";
  // an average search position moves in places, and down the list is better
  function posDelta(cur, prev) {
    if (cur == null || prev == null) return "";
    const d = prev - cur;
    if (Math.abs(d) < 0.05) return '<span class="mko-d eq">± 0</span>';
    return '<span class="mko-d ' + (d > 0 ? "up" : "dn") + '" title="change in average position">'
      + (d > 0 ? "▲ " : "▼ ") + Math.abs(d).toFixed(1) + (d > 0 ? " better" : " worse") + "</span>";
  }
  const months = (a, b) => { const out = []; for (let m = a.slice(0, 7); m <= b.slice(0, 7);) {
    out.push(m); const y = +m.slice(0, 4), mo = +m.slice(5, 7); m = mo === 12 ? (y + 1) + "-01" : y + "-" + String(mo + 1).padStart(2, "0"); }
    return out; };
  const monthWord = m => MON[+m.slice(5, 7) - 1] + " " + m.slice(0, 4);
  const monthSpan = list => !list.length ? "" : list.length === 1 ? monthWord(list[0])
    : monthWord(list[0]) + " to " + monthWord(list[list.length - 1]);
  const pill = (s, cls) => '<span class="rs-pill ' + cls + '">' + esc(s) + "</span>";

  /* Meta's result for a set of rows: one kind is a number; several kinds are never added, so the
     kind the most money bought speaks, and the line says how many others there were */
  function metaResult(rows) {
    const kinds = groupBy(rows.filter(r => r.kind), r => r.kind)
      .map(x => ({ k: x.k, res: sum(x.rows, "res"), cost: sum(x.rows, "cost") }))
      .filter(x => x.res).sort((a, b) => b.cost - a.cost);
    return kinds.length ? { top: kinds[0], others: kinds.length - 1 } : null;
  }

  /* --- the platform scoreboard: each ad platform's own claim beside what we booked from it --- */
  const AD_PLATFORMS = [["ads", "Google Ads", "Google"], ["lsa", "Local Services", "Google Local"],
                        ["meta", "Meta", "Meta"], ["gpt", "ChatGPT Ads", "ChatGPT"]];
  // the ad platforms with no connector yet, and the family their leads are filed under
  const OFF_ADS = { reddit: "Reddit", nextdoor: "Nextdoor", linkedin: "LinkedIn", tiktok: "TikTok" };
  const OFF_KEYS = { tiktok: "parked", semrush: "not upgrading" };
  function scoreRows(w) {
    const out = [];
    AD_PLATFORMS.forEach(([k, name, fam]) => {
      const pw = platWin(k, w, null);
      const o = { k, name, fam, live: true, spend: null, imp: null, clk: null, ctr: null, cpc: null, says: "—" };
      if (pw && !pw.before && !pw.after) {
        if (k === "lsa") {
          const c = clickStats(inRange(P.lsaC, pw.a, pw.b));
          const ch = sum(inRange(P.lsaL, pw.a, pw.b).filter(r => r.chg === "Charged"), "n");
          Object.assign(o, { spend: c.cost, imp: c.imp, clk: c.clk, ctr: c.ctr, cpc: c.cpc,
                             says: fmtN(ch) + " charged leads" });
        } else {
          const rows = inRange(P[k], pw.a, pw.b), c = clickStats(rows);
          Object.assign(o, { spend: c.cost, imp: c.imp, clk: c.clk, ctr: c.ctr, cpc: c.cpc });
          if (k === "ads") o.says = fmtN(sum(rows, "conv")) + " conversions";
          if (k === "meta") { const m = metaResult(rows); o.says = m ? compact(m.top.res) + " " + metaKind(m.top.k) : "no result"; }
          if (k === "gpt") o.says = P.gpt.some(r => r.conv > 0) ? fmtN(sum(rows, "conv")) + " conversions" : "not measured";
        }
      }
      const f = famStat(fam, w.a, w.bEff);
      Object.assign(o, { leads: f ? f.leads : 0, booked: f ? f.booked : 0, cpb: f ? f.cpb : null,
                         thin: !f || f.cBooked < THIN, uncov: !!(f && f.uncov) });
      out.push(o);
    });
    D.conn.filter(r => OFF_ADS[r.Key] && r.Connection === "Not connected").forEach(r => {
      const f = famStat(OFF_ADS[r.Key], w.a, w.bEff);
      out.push({ k: r.Key, name: r.Platform, fam: OFF_ADS[r.Key], live: false,
                 state: OFF_KEYS[r.Key] || "waiting", bank: r["Bank Spend"], year: r["Bank Year"],
                 leads: f ? f.leads : 0, booked: f ? f.booked : 0 });
    });
    return out;
  }
  function scoreboardHtml(rows) {
    const live = rows.filter(r => r.live), off = rows.filter(r => !r.live);
    const dash = '<span class="mko-sub">—</span>';
    const tr = r => "<tr><td class=\"mko-name\"><b>" + esc(r.name) + "</b> "
      + (r.live ? pill("live", "ok") : pill(r.state, r.state === "waiting" ? "warn" : "mute")) + "</td>"
      + '<td class="mko-num">' + (r.live ? money0(r.spend) : r.bank != null
        ? money0(+r.bank) + '<div class="mko-sub">bank ' + esc(r.year || "") + "</div>" : dash) + "</td>"
      + '<td class="mko-num">' + (r.live ? compact(r.imp) : dash) + "</td>"
      + '<td class="mko-num">' + (r.live ? fmtN(r.clk) : dash) + "</td>"
      + '<td class="mko-num">' + (r.live ? pct2(r.ctr) : dash) + "</td>"
      + '<td class="mko-num">' + (r.live ? cents(r.cpc) : dash) + "</td>"
      + '<td class="mko-num">' + (r.live ? esc(r.says) : dash) + "</td>"
      + '<td class="mko-num mko-ours">' + fmtN(r.leads) + (FAM_NOTE[r.fam] ? "*" : "") + "</td>"
      + '<td class="mko-num mko-ours">' + fmtN(r.booked) + "</td>"
      + '<td class="mko-num mko-ours"><b>' + (r.live && r.cpb != null ? money0(r.cpb) + (r.uncov ? "*" : "") : "—") + "</b></td></tr>";
    return '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr>'
      + "<th>Platform</th>"
      + '<th class="mko-num">Spend</th><th class="mko-num" title="impressions">Impr.</th>'
      + '<th class="mko-num">Clicks</th><th class="mko-num">CTR</th><th class="mko-num">CPC</th>'
      + '<th class="mko-num" title="what the platform counts as its result">Platform says</th>'
      + '<th class="mko-num mko-ours" title="Moveboard leads filed under this source">Our leads</th>'
      + '<th class="mko-num mko-ours" title="of those leads, how many booked">Booked</th>'
      + '<th class="mko-num mko-ours" title="spend ÷ booked jobs, as in the Channels table">Cost / booking</th>'
      + "</tr></thead><tbody>" + live.map(tr).join("") + off.map(tr).join("") + "</tbody></table></div>"
      + '<p class="rs-hint">Platforms with no connector yet show what the bank ledger paid them this '
      + "year, so they stay on the board. * ChatGPT leads include visitors from chatgpt.com answers.</p>";
  }
  // cost per booking, one bar per live platform, cheapest first; the dearest is drawn red when it
  // costs at least 1.8 times the cheapest, a thin sample is drawn faint
  function cpbBarsHtml(rows) {
    const list = rows.filter(r => r.live && r.cpb != null).sort((a, b) => a.cpb - b.cpb);
    if (!list.length) return '<div class="mko-empty">No platform booked a job in this period.</div>';
    const max = list[list.length - 1].cpb, min = list[0].cpb;
    return list.map((r, i) => {
      const cls = r.thin ? "thin" : i === list.length - 1 && list.length > 1 && max >= 1.8 * min ? "bad" : "";
      return '<div class="mko-hbar"><span>' + esc(r.name) + (r.thin ? '<span class="mko-sub">few bookings</span>' : "")
        + '</span><span class="mko-track"><i class="' + cls + '" style="width:' + Math.max(3, Math.round(100 * r.cpb / max))
        + '%"></i></span><b>' + money0(r.cpb) + "</b></div>";
    }).join("") + '<p class="rs-hint">Spend ÷ the bookings of leads filed under each platform. Lower is better.</p>';
  }

  /* --- what stands out: fixed checks on this period's numbers, most important first --- */
  function insights(w, cw, score) {
    const out = [];
    const add = (rank, tone, icon, html, tab) => out.push({ rank, tone, icon, html, tab });
    if (S.co !== "Tuji") {
      const pw = platWin("ads", w, cw);
      if (pw && !pw.before && !pw.after) {
        const conv = sum(inRange(P.ads, pw.a, pw.b), "conv"), f = famStat("Google", pw.a, pw.b);
        if (f && conv >= 30 && conv >= 1.3 * f.leads) {
          const pc = pw.cw ? sum(inRange(P.ads, pw.cw.a, pw.cw.b), "conv") : 0;
          const cv = inRange(P.conv, pw.a, pw.b);
          const yt = sum(cv.filter(r => r.cat === "YOUTUBE_FOLLOW_ON_VIEWS"), "n");
          const lead = sum(cv.filter(r => CONV_LEAD.has(r.cat)), "n");
          add(1, "warn", "!", "Google Ads counts <b>" + fmtN(conv) + " conversions</b>"
            + (pc ? ", " + upDown(conv / pc - 1) + " on the " + esc(pw.cw.label) : "")
            + (yt ? ", but " + fmtN(yt) + " of them are YouTube follow-on views and only " + fmtN(lead)
              + " are lead forms, calls and quote requests" : "")
            + ". Moveboard got " + fmtN(f.leads) + " Google leads and " + fmtN(f.booked)
            + " bookings, so judge Google on cost per booking.", "paid");
        }
      }
      const ok = score.filter(r => r.live && r.cpb != null && !r.thin).sort((a, b) => a.cpb - b.cpb);
      if (ok.length >= 2) {
        const lo = ok[0], hi = ok[ok.length - 1];
        if (hi.cpb >= 1.8 * lo.cpb) {
          add(2, "bad", "$", esc(hi.name) + " costs <b>" + money0(hi.cpb) + " per booking</b>, "
            + (hi.cpb / lo.cpb).toFixed(1) + " times " + esc(lo.name) + " (" + money0(lo.cpb) + "), on "
            + money(hi.spend) + " of spend against " + money(lo.spend) + ".", "paid");
        }
      }
      const gp = score.find(r => r.k === "gpt");
      if (gp && gp.spend > 0 && !P.gpt.some(r => r.conv > 0)) {
        add(8, "info", "i", "ChatGPT Ads spent " + money0(gp.spend) + " with no conversion event set up, so "
          + "it reports 0 conversions. Read its leads on our side instead.", "paid");
      }
    }
    if (cw) {
      const cur = totals(aggregate(w.a, w.bEff)), prev = totals(aggregate(cw.a, cw.b, cw));
      if (prev.spend > 0 && prev.booked > 0 && cur.spend / prev.spend - 1 >= 0.15 && cur.booked / prev.booked - 1 <= -0.05) {
        add(3, "bad", "↕", "Ad spend is <b>" + upDown(cur.spend / prev.spend - 1) + "</b> on the " + esc(cw.label)
          + " while bookings are " + upDown(cur.booked / prev.booked - 1) + ".");
      }
    }
    const gw = platWin("gsc", w, cw);
    if (gw && gw.cw && !gw.before && !gw.after) {
      const c = sum(inRange(P.gsc, gw.a, gw.b), "clk"), p = sum(inRange(P.gsc, gw.cw.a, gw.cw.b), "clk");
      if (p > 0 && c / p - 1 <= -0.15) {
        add(4, "bad", "↓", "Organic search is sliding: Search Console clicks are <b>" + upDown(c / p - 1)
          + "</b> on the " + esc(gw.cw.label) + ".", "seo");
      }
    }
    const am = P.ahm.slice(-7);
    if (am.length >= 4) {
      const peak = am.slice(0, -1).reduce((a, r) => (r.traffic > a.traffic ? r : a), am[0]);
      const last = am[am.length - 1];
      if (peak.traffic > 0 && last.traffic / peak.traffic - 1 <= -0.35) {
        add(5, "warn", "↓", "The Ahrefs organic traffic estimate is <b>" + upDown(last.traffic / peak.traffic - 1)
          + "</b> from " + esc(monthWord(peak.m)) + " (" + fmtN(peak.traffic) + " to " + fmtN(last.traffic) + " a month).", "seo");
      }
    }
    blLatest().forEach(loc => {
      const g = loc.kws.filter(k => k.Google != null);
      const maps = loc.kws.map(k => k.Maps).filter(v => v != null).sort((a, b) => a - b);
      if (loc.kws.length && !g.length) {
        add(6, "warn", "⌖", esc(loc.loc) + " is <b>not in Google's top 100</b> for any of its " + loc.kws.length
          + " tracked keywords" + (maps.length ? "; in Maps it ranks " + maps[0] + (maps.length > 1 ? " to " + maps[maps.length - 1] : "")
          + " for " + maps.length + " of them" : ", nor in Maps") + ".", "seo");
      }
    });
    if (D.ledgerEnd && dayCount(D.ledgerEnd, today()) > 40) {
      add(7, "info", "i", "The bank ledger runs through " + esc(day(D.ledgerEnd)) + ": Yelp, Angi, postcards "
        + "and the other ledger channels have no spend after that day until the next paste.", "set");
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 5);
  }
  function insightsHtml(list) {
    if (!list.length) return '<div class="mko-empty">Nothing unusual in this period.</div>';
    const go = { paid: "See Paid ads", seo: "See Search and SEO", set: "See Settings", web: "See Website" };
    return list.map(x => '<div class="mko-ins"><span class="mko-ins-i ' + x.tone + '" aria-hidden="true">'
      + esc(x.icon) + "</span><div>" + x.html
      + (x.tab ? ' <button type="button" data-tab="' + x.tab + '">' + go[x.tab] + "</button>" : "")
      + "</div></div>").join("");
  }

  /* a plain bar chart card of one measure per bucket, with its table twin */
  function barCard(host, key, title, keys, g, vals, fmt, color) {
    RSC.chartCard(host, {
      title, key: "mko-" + key,
      buildChart(canvas) {
        const C = palette();
        return new Chart(canvas, {
          type: "bar",
          data: { labels: keys.map(k => bucketLabel(k, g)), datasets: [{ label: title, data: vals,
            backgroundColor: C[color] || C.main, borderRadius: 3, maxBarThickness: 26 }] },
          options: { responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmt(c.raw) } } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => fmt(v) } },
                      x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } } },
        });
      },
      buildTable() {
        return '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>'
          + esc(GRAIN_WORD[g][0].toUpperCase() + GRAIN_WORD[g].slice(1)) + '</th><th class="mko-num">'
          + esc(title) + "</th></tr></thead><tbody>" + keys.map((k, i) => "<tr><td>" + esc(bucketLabel(k, g))
          + '</td><td class="mko-num">' + fmt(vals[i]) + "</td></tr>").join("") + "</tbody></table></div>";
      },
    });
  }

  /* === OVERVIEW === */
  function overviewTab(w, cw) {
    if (D.chErr) {
      return { html: '<div class="panel">The channel numbers could not load — ' + esc(D.chErr)
        + (/404|unknown dataset|not granted/i.test(D.chErr)
          ? " (they arrive with the next pipeline run, or a <b>mkt-overview</b> rebuild)" : "") + "</div>" };
    }
    const score = S.co === "Tuji" ? [] : scoreRows(w);
    const fams = aggregate(w.a, w.bEff);
    const past = D.ledgerEnd && w.bEff > D.ledgerEnd;
    const apw = S.co === "Tuji" ? null : platWin("ads", w, null);
    const html = '<div class="rs-kpis" id="mkoKpis"></div>'
      + '<p class="rs-hint hidden" id="mkoKpiHint"></p>'
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">What stands out</span>'
      + '<span class="mko-sub">read from this period\'s numbers</span></div>' + insightsHtml(insights(w, cw, score)) + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Cost per booking by platform</span></div>'
      + (S.co === "Tuji" ? '<div class="mko-empty">Every ad platform here is Zip to Zip\'s.</div>' : cpbBarsHtml(score)) + "</div>"
      + "</div>"
      + (S.co === "Tuji" ? "" : '<div class="panel"><div class="panel-head"><span class="panel-title">Platform scoreboard</span>'
        + '<span class="mko-sub">what each platform claims, beside what we booked from it</span></div>'
        + scoreboardHtml(score) + "</div>")
      + (apw && !apw.before && !apw.after ? '<div class="mko-g2e"><div id="mkoGw1"></div><div id="mkoGw2"></div></div>' : "")
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Every channel</span>'
      + '<span class="mko-sub">the ad platforms and every bank-ledger source</span></div>'
      + '<p class="rs-hint">Booked = leads created in the period that booked. Spend is live from Google Ads, '
      + "Local Services, Meta and ChatGPT; every other channel is the bank ledger"
      + (D.ledgerEnd ? ", which runs through " + esc(day(D.ledgerEnd)) : "")
      + (past ? "; a * marks cost figures read on the leads whose spend is in" : "")
      + ". Click a channel to open it in Source Analysis.</p>" + channelsHtml(fams) + "</div>";
    return { html, wire(host) {
      const k = host.querySelector("#mkoKpis");
      if (k) kpisFor(k, w, cw);
      const kh = host.querySelector("#mkoKpiHint");
      if (kh) {
        const bits = [];
        if (fams.some(f => f.paid && f.uncov)) {
          bits.push("The bank ledger runs through " + day(D.ledgerEnd) + ": for later days the cost figures "
            + "count only the channels with live spend (Google Ads, Local Services, Meta, ChatGPT)"
            + (cw ? ", in both periods" : "") + ".");
        }
        if (cw) {
          bits.push("The " + cw.label + "'s bookings are counted as they stood on " + day(cw.asOf)
            + ", so a young cohort is not set against one that had longer to book.");
        }
        kh.innerHTML = bits.map(esc).join(" ");
        kh.classList.toggle("hidden", !bits.length);
      }
      if (apw && !apw.before && !apw.after) {
        const rows = inRange(P.ads, apw.a, apw.b), keys = bucketsOf(apw.a, apw.b, apw.g);
        barCard(host.querySelector("#mkoGw1"), "gw-cost", "Google Ads spend by " + GRAIN_WORD[apw.g], keys, apw.g,
                seriesOf(rows, keys, apw.g, r => r.cost).map(v => +v.toFixed(2)), money0, "main");
        barCard(host.querySelector("#mkoGw2"), "gw-conv", "Conversions Google counts by " + GRAIN_WORD[apw.g], keys, apw.g,
                seriesOf(rows, keys, apw.g, r => r.conv).map(v => +v.toFixed(1)), fmtN, "alt");
      }
    } };
  }

  /* === PAID ADS === */
  function offCardsHtml(w) {
    const rows = D.conn.filter(r => OFF_ADS[r.Key] && r.Connection === "Not connected");
    if (!rows.length) return "";
    return '<div class="mko-h"><h2>Not connected yet</h2><span class="mko-sub">each card fills itself the day '
      + "its connector lands; until then it shows what the bank paid</span></div>"
      + '<div class="mko-offs">' + rows.map(r => {
        const f = S.co === "Tuji" ? null : famStat(OFF_ADS[r.Key], w.a, w.bEff);
        const st = OFF_KEYS[r.Key] || "waiting";
        return '<div class="mko-off"><div><b>' + esc(r.Platform) + "</b> " + pill(st, st === "waiting" ? "warn" : "mute")
          + "</div><div>" + esc(r.Metrics || "") + "</div>"
          + "<div>Bank " + esc(r["Bank Year"] || "") + ": <b>" + (r["Bank Spend"] != null ? money0(+r["Bank Spend"]) : "—") + "</b>"
          + (f && f.leads ? " · " + fmtN(f.leads) + " leads filed under it in the period" : "") + "</div>"
          + (r["Next Step"] ? "<div>Next: " + esc(r["Next Step"]) + "</div>" : "") + "</div>";
      }).join("") + "</div>";
  }
  function paidTab(w, cw) {
    const plat = platformsSection(w, cw);
    return { html: plat.html + offCardsHtml(w), wire: plat.wire };
  }

  /* === SEARCH AND SEO === */
  // BrightLocal: each location's newest run, one row per keyword with a rank per engine, and the
  // run before it for the change
  function blLatest() {
    const out = [];
    groupBy(P.bl, r => r.rep).forEach(g => {
      const runs = Array.from(new Set(g.rows.map(r => r.d))).sort();
      const last = runs[runs.length - 1], prev = runs.length > 1 ? runs[runs.length - 2] : null;
      const at = d => { const m = {}; g.rows.filter(r => r.d === d).forEach(r => { (m[r.kw] = m[r.kw] || {})[r.eng] = r.rank; }); return m; };
      const cur = at(last), before = prev ? at(prev) : {};
      const engines = Array.from(new Set(g.rows.filter(r => r.d === last).map(r => r.eng)));
      const kws = Object.keys(cur).sort().map(kw => Object.assign({ kw, prev: before[kw] || null }, cur[kw]));
      out.push({ rep: g.k, loc: g.rows[0].loc, post: g.rows[0].post, run: last, prevRun: prev, engines, kws });
    });
    return out.sort((a, b) => String(a.loc).localeCompare(String(b.loc)));
  }
  const ENGINE_ORDER = ["Google", "Google mobile", "Local pack", "Maps", "Bing", "Bing local pack"];
  function rankCell(v, was) {
    if (v == null) return '<span class="mko-sub">—</span>' + (was != null ? '<div class="mko-sub">was ' + was + "</div>" : "");
    const cls = v <= 3 ? "top" : v <= 10 ? "mid" : "low";
    const ch = was == null ? "" : was === v ? "" : was > v ? ' <span class="mko-d up">▲ ' + (was - v) + "</span>"
      : ' <span class="mko-d dn">▼ ' + (v - was) + "</span>";
    return '<span class="mko-rk ' + cls + '">' + v + "</span>" + ch;
  }
  function blHtml() {
    if (P.err.bl) return '<div class="mko-empty">BrightLocal could not load — ' + esc(P.err.bl) + "</div>";
    const locs = blLatest();
    if (!locs.length) return '<div class="mko-empty">BrightLocal rankings arrive with the first weekly pull.</div>';
    return '<div class="mko-g2e">' + locs.map(L => {
      const engines = ENGINE_ORDER.filter(e => L.engines.includes(e)).concat(L.engines.filter(e => !ENGINE_ORDER.includes(e)));
      const maps = L.kws.map(k => k.Maps).filter(v => v != null);
      const g = L.kws.filter(k => k.Google != null).length;
      const sumLine = (maps.length ? "Maps: average rank " + (maps.reduce((a, b) => a + b, 0) / maps.length).toFixed(1)
        + ", " + maps.filter(v => v <= 10).length + " of " + L.kws.length + " keywords in the top 10" : "Maps: no keyword ranked")
        + " · Google: " + g + " of " + L.kws.length + " in the top 100";
      return "<div><h3 class=\"mko-h3\">" + esc(L.loc || "Location") + (L.post ? " " + esc(L.post) : "") + "</h3>"
        + '<div class="mko-sub">run ' + esc(day(L.run)) + (L.prevRun ? " · change against " + esc(shortDay(L.prevRun)) : "") + "</div>"
        + '<div class="rs-tablewrap"><table class="rs-table mko-pt mko-tight"><thead><tr><th>Keyword</th>'
        + engines.map(e => '<th class="mko-num">' + esc(e) + "</th>").join("") + "</tr></thead><tbody>"
        + L.kws.map(k => '<tr><td class="mko-name">' + esc(k.kw) + "</td>" + engines.map(e => '<td class="mko-num">'
          + rankCell(k[e] == null ? null : k[e], k.prev ? (k.prev[e] == null ? null : k.prev[e]) : null) + "</td>").join("") + "</tr>").join("")
        + "</tbody></table></div><p class=\"rs-hint\">" + esc(sumLine) + ". — means not in the top 100.</p></div>";
    }).join("") + "</div>";
  }
  function seoTab(w, cw) {
    const gw = platWin("gsc", w, cw);
    const gRows = gw && !gw.before && !gw.after ? inRange(P.gsc, gw.a, gw.b) : [];
    const gPrev = gw && gw.cw ? inRange(P.gsc, gw.cw.a, gw.cw.b) : null;
    const stat = rows => { const clk = sum(rows, "clk"), imp = sum(rows, "imp");
      let pw = 0; rows.forEach(r => { pw += (r.pos || 0) * r.imp; }); return { clk, imp, pos: imp ? pw / imp : null }; };
    const cur = stat(gRows), prev = gPrev ? stat(gPrev) : {};
    const snap = P.ahd.length ? P.ahd[P.ahd.length - 1] : null;
    // the query mart is monthly: the months the period touches
    const ms = gw && !gw.before && !gw.after ? months(gw.a, gw.b) : [];
    const qs = groupBy(P.gscq.filter(r => ms.includes(r.m) && r.type !== "Hidden by Google"), r => r.q).map(x => {
      const imp = sum(x.rows, "imp"); let pw = 0; x.rows.forEach(r => { pw += (r.pos || 0) * r.imp; });
      return { q: x.k, type: x.rows[0].type, clk: sum(x.rows, "clk"), imp, pos: imp ? pw / imp : null };
    }).sort((a, b) => b.clk - a.clk || b.imp - a.imp);
    const allClk = sum(qs, "clk"), brandClk = sum(qs.filter(q => q.type === "Brand"), "clk");
    const gate = platGate("Search Console", "gsc", gw, gRows);
    const html = '<div class="rs-kpis" id="mkoK-seo"></div>'
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Search Console</span>'
      + '<span class="mko-sub">Google search' + (gw && gw.last ? " · data through " + esc(day(gw.last)) : "") + "</span></div>"
      + (gate || '<div id="mkoC-gsc"></div>'
        + '<h3 class="mko-h3">Top queries</h3><div class="mko-sub">' + esc(monthSpan(ms)) + " (the query list is monthly)"
        + (allClk ? " · searches for our name bring " + pct(brandClk / allClk) + " of the clicks" : "") + "</div>"
        + ptable([
          { h: "Query", name: true, cell: q => esc(q.q) + " " + pill(q.type === "Brand" ? "brand" : q.type, q.type === "Brand" ? "mute" : "ok") },
          { h: "Clicks", num: true, cell: q => fmtN(q.clk) },
          { h: "Impr.", num: true, tip: "impressions", cell: q => fmtN(q.imp) },
          { h: "Position", num: true, tip: "average, weighted by impressions", cell: q => q.pos == null ? "—" : q.pos.toFixed(1) },
        ], qs.slice(0, 10), null, true))
      + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Keywords by service</span>'
      + '<span class="mko-sub">' + esc(monthSpan(ms)) + " · Search Console, monthly</span></div>"
      + svcHtml(qs) + "</div>"
      + "</div>"
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">On-page · Ahrefs Site Audit</span>'
      + '<span class="mko-sub">' + (P.audit ? "crawl " + esc(day(P.audit.crawl)) : "no crawl yet") + "</span></div>"
      + onPageHtml() + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Off-page · Ahrefs</span>'
      + '<span class="mko-sub">' + (snap ? "snapshot " + esc(day(snap.d)) : "no snapshot yet") + "</span></div>"
      + (P.err.ahd ? '<div class="mko-empty">Ahrefs could not load — ' + esc(P.err.ahd) + "</div>" : !snap ? "" :
        '<div class="rs-kpis" id="mkoK-ah"></div><div id="mkoC-ah"></div>'
        + '<p class="rs-hint">Ahrefs\' own estimates from its crawler and keyword panel, not our measured '
        + "traffic (that is Search Console and Analytics).</p>")
      + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Local rankings · BrightLocal</span>'
      + '<span class="mko-sub">weekly rank reports, Mondays</span></div>' + blHtml()
      + '<p class="rs-hint">Citation Tracker is not in BrightLocal\'s Management API, so citations are not '
      + "pulled yet. Semrush: not upgrading (your call, 16 Oct); Ahrefs covers its numbers.</p></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">AI visibility</span>'
      + '<span class="mko-sub">the prompt universe: where AI answers leave us out</span></div>' + aiVisHtml() + "</div>";
    return { html, wire(host) {
      const on = !!(gw && gw.cw);
      RSC.kpis(host.querySelector("#mkoK-seo"), [
        kp("Search clicks", cur.clk, on ? prev.clk : undefined, fmtN, false, "Search Console", gw),
        kp("Search impressions", cur.imp, on ? prev.imp : undefined, compact, false, "", gw),
        { label: "Avg position", value: (cur.pos == null ? "—" : cur.pos.toFixed(1))
            + (on && prev.pos ? posDelta(cur.pos, prev.pos) : ""),
          sub: (on && prev.pos ? (S.cmp === "prev" ? "previous" : "last year") + ": " + prev.pos.toFixed(1) + " · " : "") + "lower is better" },
        { label: "Domain rating", value: snap && snap.dr != null ? String(Math.round(snap.dr)) : "—", sub: "Ahrefs, out of 100" },
        { label: "Organic keywords", value: snap ? fmtN(snap.kw) : "—", sub: snap ? fmtN(snap.kw3) + " in the top 3 · Ahrefs" : "" },
      ]);
      if (!gate && host.querySelector("#mkoC-gsc")) {
        const keys = bucketsOf(gw.a, gw.b, gw.g);
        barCard(host.querySelector("#mkoC-gsc"), "gsc-clk", "Search clicks by " + GRAIN_WORD[gw.g], keys, gw.g,
                seriesOf(gRows, keys, gw.g, r => r.clk), fmtN, "main");
      }
      if (snap && host.querySelector("#mkoK-ah")) {
        RSC.kpis(host.querySelector("#mkoK-ah"), [
          { label: "Domain rating", value: snap.dr != null ? String(Math.round(snap.dr)) : "—", sub: "out of 100" },
          { label: "Referring domains", value: fmtN(snap.rd), sub: "live" },
          { label: "Backlinks", value: fmtN(snap.bl), sub: "live" },
          { label: "Organic traffic", value: fmtN(snap.traffic), sub: "estimate a month" },
        ]);
        const hist = P.ahm.slice(-12);
        if (hist.length) {
          RSC.chartCard(host.querySelector("#mkoC-ah"), {
            title: "Organic traffic estimate by month", key: "mko-ah-traffic",
            buildChart(canvas) {
              const C = palette();
              return new Chart(canvas, { type: "line",
                data: { labels: hist.map(r => monthWord(r.m)), datasets: [{ label: "Organic traffic", data: hist.map(r => r.traffic),
                  borderColor: C.main, backgroundColor: C.main, borderWidth: 2, pointRadius: 2, cubicInterpolationMode: "monotone" }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
            },
            buildTable() {
              return ptable([{ h: "Month", cell: r => esc(monthWord(r.m)) },
                { h: "Organic traffic", num: true, cell: r => fmtN(r.traffic) },
                { h: "Domain rating", num: true, cell: r => r.dr == null ? "—" : String(Math.round(r.dr)) },
                { h: "Referring domains", num: true, tip: "Ahrefs' monthly history count (a stricter definition than the live figure)",
                  cell: r => r.rdh == null ? "—" : fmtN(r.rdh) }], hist.slice().reverse());
            },
          });
        }
      }
    } };
  }

  /* keywords by the service they ask about, read from the query's words; brand searches apart */
  const SERVICES = [
    ["Brand", q => q.type === "Brand"],
    ["Long distance", q => /long ?distance|cross[- ]?country|interstate|out of state|state to state|nationwide/.test(q.q)],
    ["Packing", q => /\bpack(ing|ers?)?\b|unpack|boxes/.test(q.q)],
    ["Storage", q => /storage/.test(q.q)],
    ["Commercial / office", q => /office|commercial|business|corporate/.test(q.q)],
    ["Specialty items", q => /piano|\bsafe\b|antique|pool table|hot tub|artwork/.test(q.q)],
    ["Junk / labor", q => /junk|labor|loading|unloading|hauling/.test(q.q)],
    ["Local and general moving", q => /mov(er|ers|ing)|relocat/.test(q.q)],
  ];
  const svcOf = q => (SERVICES.find(s => s[1](q)) || ["Other"])[0];
  function svcHtml(qs) {
    if (!qs.length) return '<div class="mko-empty">No queries for these months yet.</div>';
    const by = groupBy(qs, q => svcOf(q)).map(x => {
      const imp = sum(x.rows, "imp"); let pw = 0; x.rows.forEach(r => { pw += (r.pos || 0) * r.imp; });
      return { k: x.k, clk: sum(x.rows, "clk"), imp, pos: imp ? pw / imp : null, n: x.rows.length,
               top: x.rows.slice().sort((a, b) => b.clk - a.clk || b.imp - a.imp).slice(0, 3) };
    });
    const order = SERVICES.map(s => s[0]).concat(["Other"]);
    by.sort((a, b) => order.indexOf(a.k) - order.indexOf(b.k));
    return ptable([
      { h: "Service", name: true, cell: r => "<b>" + esc(r.k) + "</b>" + '<div class="mko-sub">' + r.top.map(q =>
          esc(q.q) + (q.pos != null ? " (" + q.pos.toFixed(1) + ")" : "")).join(" · ") + "</div>" },
      { h: "Queries", num: true, cell: r => fmtN(r.n) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => compact(r.imp) },
      { h: "Position", num: true, tip: "average, weighted by impressions", cell: r => r.pos == null ? "—" : r.pos.toFixed(1) },
    ], by, null, true) + '<p class="rs-hint">Each query is filed under the first service its words name; '
      + "the three under a service are its most clicked, with their average position.</p>";
  }
  const IMP_PILL = { Error: "bad", Warning: "warn", Notice: "mute" };
  function onPageHtml() {
    if (P.err.audit) return '<div class="mko-empty">The site audit could not load — ' + esc(P.err.audit) + "</div>";
    const a = P.audit;
    if (!a) return '<div class="mko-empty">The first site audit snapshot arrives with the next Ahrefs pull.</div>';
    const rank = { Error: 0, Warning: 1, Notice: 2 };
    const list = P.issues.slice().sort((x, y) => (rank[x.imp] ?? 3) - (rank[y.imp] ?? 3) || y.pages - x.pages).slice(0, 12);
    const hp = P.auditPrev && P.auditPrev.health != null && a.health != null ? a.health - P.auditPrev.health : null;
    return '<div class="rs-kpis mko-k3"><div class="kpi"><div class="l">Health score</div><div class="v">'
      + (a.health == null ? "—" : a.health) + (hp ? ' <span class="mko-d ' + (hp > 0 ? "up" : "dn") + '">'
        + (hp > 0 ? "▲ " : "▼ ") + Math.abs(hp) + "</span>" : "") + '</div><div class="s">out of 100</div></div>'
      + '<div class="kpi"><div class="l">Pages with errors</div><div class="v">' + fmtN(a.err) + '</div><div class="s">of '
      + fmtN(a.total) + " crawled</div></div>"
      + '<div class="kpi"><div class="l">Pages with warnings</div><div class="v">' + fmtN(a.warn) + '</div><div class="s">'
      + fmtN(a.note) + " with notices</div></div></div>"
      + ptable([
        { h: "Issue", name: true, cell: r => pill(r.imp || "Notice", IMP_PILL[r.imp] || "mute") + " " + esc(r.name)
            + '<div class="mko-sub">' + esc(r.cat) + "</div>" },
        { h: "Pages", num: true, cell: r => fmtN(r.pages) },
        { h: "Change", num: true, tip: "since the previous crawl", cell: r => r.change ? (r.change > 0 ? "+" : "") + fmtN(r.change) : "—" },
      ], list, null, true);
  }
  function aiVisHtml() {
    const ai = P.issues.filter(r => /ai discoverab/i.test(r.cat));
    return '<div class="mko-nm"><p>BrightLocal\'s <b>Local AI Visibility</b> report works with our key, but '
      + "the account holds no such report yet. Creating one per location (Tinton Falls, Arlington) is the next "
      + "step; once it runs, this panel lists the prompts where ChatGPT, Gemini and Perplexity name competitors "
      + "and not us.</p>"
      + (ai.length ? "<p>Meanwhile the site audit already flags " + ai.length + " AI-discoverability issue"
        + (ai.length > 1 ? "s" : "") + ": " + esc(ai.map(r => r.name + " (" + r.pages + " pages)").join("; ")) + ".</p>" : "")
      + "</div>";
  }

  /* === REVIEWS === */
  /* every listing's reviews against its goal for the period, with what the period ADDED and what
     platforms REMOVED kept apart (RS.reviewFlow, the portal's one rule). A goal row dated 1 Sep is
     the total to reach by the end of August (Monthly Report's rule): the period's goal is the first
     goal date after its last month, else the last one before it. */
  function reviewsTab(w) {
    if (P.err.rc) return { html: '<div class="panel">The review counts could not load — ' + esc(P.err.rc) + "</div>" };
    const co = r => !S.co || r.co === S.co;
    const rc = P.rc.filter(co), rg = P.rg.filter(co);
    if (!rc.length) return { html: '<div class="panel"><div class="mko-empty">No review counts for this company.</div></div>' };
    const flow = RS.reviewFlow(rc.map(r => ({ Company: r.co, Platform: r.plat, Date: r.d, "Number of Reviews": r.n })));
    const a = w.a.slice(0, 7), b = w.bEff.slice(0, 7);
    const dates = Array.from(new Set(rg.map(r => r.d))).sort();
    const goalDate = dates.find(d => d > b + "-31") || dates.filter(d => d <= b + "-31").pop() || null;
    const goalBy = {};
    rg.filter(r => r.d === goalDate).forEach(r => { goalBy[flow.key({ Company: r.co, Platform: r.plat })] = r.n; });
    const list = Object.entries(flow.byPlat).map(([k, g]) => {
      const yms = Object.keys(g.steps).filter(ym => ym <= b).sort();
      const now = yms.length ? g.steps[yms[yms.length - 1]].level : null;
      let added = 0, removed = 0, reset = 0;
      Object.entries(g.steps).forEach(([ym, st]) => {
        if (ym >= a && ym <= b && st.from != null) { added += st.added; removed += st.removed; reset += st.reset; }
      });
      const goal = goalBy[k] == null ? null : goalBy[k];
      return { k, label: g.label, co: g.company, now, added, removed, reset, goal,
               togo: goal != null && now != null ? Math.max(0, goal - now) : null,
               prog: goal ? Math.min(1, (now || 0) / goal) : null };
    }).filter(x => x.now != null || x.goal != null)
      .sort((x, y) => (y.togo || 0) - (x.togo || 0) || (y.now || 0) - (x.now || 0));
    const tot = { now: sum(list, "now"), added: sum(list, "added"), removed: sum(list, "removed"),
                  goal: sum(list.filter(x => x.goal != null), "goal"), togo: sum(list, "togo") };
    const withGoal = list.filter(x => x.goal != null);
    const nowWithGoal = sum(withGoal, "now");
    const resets = list.filter(x => x.reset);
    const goalWord = goalDate ? "by " + day(addDays(goalDate, -1)) : "";
    const months12 = flow.months.filter(ym => ym <= b).slice(-12);
    const html = '<div class="rs-kpis" id="mkoK-rev"></div>'
      + '<p class="rs-hint">Counts are each listing\'s public total from the monthly snapshot sheet. <b>Added</b> and '
      + "<b>Removed</b> are the period's rises and the reviews platforms took back, never netted"
      + (goalDate ? "; the goal is the total to reach " + esc(goalWord) : "") + ".</p>"
      + '<div class="mko-g2e"><div id="mkoC-rev"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Furthest from goal</span></div>'
      + (withGoal.length ? withGoal.filter(x => x.togo).slice(0, 8).map(x => '<div class="mko-hbar"><span>' + esc(x.label)
          + (S.co ? "" : '<span class="mko-sub">' + esc(x.co) + "</span>") + '</span><span class="mko-track"><i style="width:'
          + Math.round(100 * (x.prog || 0)) + '%"></i></span><b>' + fmtN(x.togo) + " to go</b></div>").join("")
        || '<div class="mko-empty">Every listing has reached its goal.</div>'
        : '<div class="mko-empty">No goals set for this company.</div>') + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Every listing</span>'
      + '<span class="mko-sub">most still to go first</span></div>'
      + ptable([
        { h: "Listing", name: true, cell: x => "<b>" + esc(x.label) + "</b>" + (S.co ? "" : '<div class="mko-sub">' + esc(x.co) + "</div>")
            + (x.reset ? '<div class="mko-sub">a reset of ' + fmtN(x.reset) + " is left out</div>" : "") },
        { h: "Reviews now", num: true, cell: x => fmtN(x.now) },
        { h: "Added", num: true, tip: "the period's rises", cell: x => x.added ? "+" + fmtN(x.added) : "—" },
        { h: "Removed", num: true, tip: "reviews the platform took back in the period", cell: x => x.removed ? '<span class="mko-neg">−' + fmtN(x.removed) + "</span>" : "—" },
        { h: "Goal", num: true, tip: goalWord, cell: x => x.goal == null ? '<span class="mko-sub">—</span>' : fmtN(x.goal) },
        { h: "Progress", num: true, cell: x => x.prog == null ? "" : '<span class="mko-track mko-mini"><i style="width:'
            + Math.round(100 * x.prog) + '%"></i></span>' + pct(x.prog) },
        { h: "To go", num: true, cell: x => x.togo == null ? "" : x.togo ? "<b>" + fmtN(x.togo) + "</b>" : '<span class="mko-pos">done</span>' },
      ], list, null)
      + (resets.length ? '<p class="rs-hint">A fall of 30% or more in one month reads as a listing reset or rename, not '
        + "reviews removed, and is left out of both columns.</p>" : "") + "</div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-rev"), [
        { label: "Reviews now", value: fmtN(tot.now), sub: list.length + " listings" },
        { label: "Added", value: "+" + fmtN(tot.added), sub: "in " + monthSpan(months(w.a, w.bEff)) },
        { label: "Removed by platforms", value: tot.removed ? "−" + fmtN(tot.removed) : "0", sub: "taken back, kept apart" },
        { label: "Goal", value: tot.goal ? fmtN(tot.goal) : "—", sub: goalWord || "no goal set" },
        { label: "Progress", value: tot.goal ? pct(Math.min(1, nowWithGoal / tot.goal)) : "—",
          sub: tot.goal ? fmtN(tot.togo) + " still to go" : "" },
      ]);
      const C = palette();
      RSC.chartCard(host.querySelector("#mkoC-rev"), {
        title: "Reviews added and removed by month", key: "mko-rev-flow",
        buildChart(canvas) {
          return new Chart(canvas, { type: "bar",
            data: { labels: months12.map(monthWord), datasets: [
              { label: "Added", data: months12.map(ym => (flow.byMonth[ym] || {}).added || 0), backgroundColor: C.main, borderRadius: 3 },
              { label: "Removed", data: months12.map(ym => -((flow.byMonth[ym] || {}).removed || 0)), backgroundColor: "#B91C1C", borderRadius: 3 }] },
            options: { responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: "top", labels: { boxWidth: 12 } },
                         tooltip: { callbacks: { label: c => c.dataset.label + ": " + fmtN(Math.abs(c.raw)) } } },
              scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true } },
                        y: { stacked: true, ticks: { callback: v => fmtN(Math.abs(v)) } } } } });
        },
        buildTable() {
          return ptable([{ h: "Month", cell: ym => esc(monthWord(ym)) },
            { h: "Added", num: true, cell: ym => fmtN((flow.byMonth[ym] || {}).added || 0) },
            { h: "Removed", num: true, cell: ym => fmtN((flow.byMonth[ym] || {}).removed || 0) },
            { h: "All listings", num: true, cell: ym => fmtN((flow.byMonth[ym] || {}).level || 0) }], months12.slice().reverse());
        },
      });
    } };
  }

  /* === WEBSITE (GA4) === */
  function webTab(w, cw) {
    const pw = platWin("ga4", w, cw);
    const gate = platGate("Google Analytics", "ga4", pw, pw ? inRange(P.ga4, pw.a, pw.b).map(r => ({ cost: r.ses })) : []);
    if (gate) return { html: '<div class="panel">' + gate + "</div>" };
    const rows = inRange(P.ga4, pw.a, pw.b), cmp = pw.cw ? inRange(P.ga4, pw.cw.a, pw.cw.b) : null;
    const st = rs => { const users = sum(rs, "users"), ses = sum(rs, "ses"), eng = sum(rs, "eng");
      return { users, ses, eng, secs: sum(rs, "secs"), kev: sum(rs, "kev"),
               per: users ? sum(rs, "secs") / users : null, bounce: ses ? 1 - eng / ses : null }; };
    const cur = st(rows), prev = cmp ? st(cmp) : {};
    const leads = withCo(LIVE_CO, () => totals(aggregate(pw.a, pw.b)).leads || 0);
    const ch = groupBy(inRange(P.ga4ch, pw.a, pw.b), r => r.grp).map(x => ({ k: x.k || "(other)", v: sum(x.rows, "ses") }))
      .filter(x => x.v).sort((a, b) => b.v - a.v);
    const chMax = ch.length ? ch[0].v : 0;
    const ms = months(pw.a, pw.b);
    // our own office is in Tbilisi: the country Georgia is left out (the US state is "Georgia" too,
    // but its country reads United States)
    const geo = P.geo.filter(r => ms.includes(r.m) && r.country !== "Georgia");
    const us = groupBy(geo.filter(r => r.country === "United States"), r => r.region)
      .map(x => ({ k: x.k, v: sum(x.rows, "users") })).filter(x => x.v).sort((a, b) => b.v - a.v);
    const abroad = sum(geo.filter(r => r.country !== "United States"), "users");
    const demo = P.demo.filter(r => ms.includes(r.m));
    const dTot = sum(demo, "users");
    const ages = groupBy(demo.filter(r => r.age && r.age !== "unknown"), r => r.age).map(x => ({ k: x.k, v: sum(x.rows, "users") }))
      .sort((a, b) => a.k.localeCompare(b.k));
    const sex = groupBy(demo.filter(r => r.sex && r.sex !== "unknown"), r => r.sex).map(x => ({ k: x.k, v: sum(x.rows, "users") }));
    const known = sum(ages, "v");
    const bars = (list, max) => list.map(x => '<div class="mko-hbar"><span>' + esc(x.k) + '</span><span class="mko-track"><i style="width:'
      + Math.max(2, Math.round(100 * x.v / (max || 1))) + '%"></i></span><b>' + fmtN(x.v) + "</b></div>").join("");
    const html = (leads && cur.users < leads ? '<div class="mko-warn">Google Analytics under-records: it saw '
        + fmtN(cur.users) + " users in this period while Moveboard took " + fmtN(leads) + " leads. Read this tab "
        + "for trends and mix, not for totals." + (cur.kev > cur.ses ? " Key events (" + fmtN(cur.kev) + ") exceed sessions ("
        + fmtN(cur.ses) + "), so an event fires more than once." : "") + "</div>" : "")
      + noCmpHint("Google Analytics", pw)
      + '<div class="rs-kpis" id="mkoK-web"></div>'
      + '<div class="mko-g2e"><div id="mkoC-web"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Traffic source</span><span class="mko-sub">sessions</span></div>'
      + (ch.length ? bars(ch, chMax) : '<div class="mko-empty">No sessions in this period.</div>') + "</div></div>"
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Locations</span><span class="mko-sub">active users · '
      + esc(monthSpan(ms)) + "</span></div>" + (us.length ? bars(us.slice(0, 8), us[0].v) : '<div class="mko-empty">No locations.</div>')
      + (abroad ? '<p class="rs-hint">Outside the US: ' + fmtN(abroad) + " users. Our own office in Georgia (the country) is left out.</p>" : "")
      + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Demographics</span><span class="mko-sub">'
      + (dTot ? "age known for " + pct(known / dTot) + " of users" : "no data") + "</span></div>"
      + (ages.length ? bars(ages, Math.max.apply(null, ages.map(a => a.v))) : '<div class="mko-empty">GA4 knows no ages for this period.</div>')
      + (sex.length ? '<p class="rs-hint">' + sex.map(s => esc(s.k[0].toUpperCase() + s.k.slice(1)) + " " + fmtN(s.v)).join(" · ") + "</p>" : "")
      + '<p class="rs-hint">Google signals off in GA4 leaves most visitors without an age or gender.</p></div>'
      + "</div>";
    return { html, wire(host) {
      const was = (v, fmt) => pw.cw ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(v) : "";
      RSC.kpis(host.querySelector("#mkoK-web"), [
        kp("Active users", cur.users, prev.users, fmtN, false, "GA4's daily counts, summed", pw),
        kp("Avg engagement time", cur.per, prev.per, dur, false, "per active user", pw),
        { label: "Bounce rate", value: pct(cur.bounce) + (pw.cw ? deltaPts(cur.bounce, prev.bounce, true) : ""),
          sub: [was(prev.bounce, pct), "sessions not engaged"].filter(Boolean).join(" · ") },
        kp("Sessions", cur.ses, prev.ses, fmtN, false, "", pw),
        kp("Key events", cur.kev, prev.kev, fmtN, false, cur.kev > cur.ses ? "more than sessions: check the tag" : "", pw),
      ]);
      const keys = bucketsOf(pw.a, pw.b, pw.g);
      barCard(host.querySelector("#mkoC-web"), "web-ses", "Sessions by " + GRAIN_WORD[pw.g], keys, pw.g,
              seriesOf(rows, keys, pw.g, r => r.ses), fmtN, "main");
    } };
  }

  /* === SETTINGS === */
  function settingsTab() {
    const plat = D.conn.filter(r => r.Group === "Marketing platforms");
    const ours = D.conn.filter(r => r.Group !== "Marketing platforms");
    const live = plat.filter(r => r.Connection !== "Not connected");
    const off = plat.filter(r => r.Connection === "Not connected" && OFF_KEYS[r.Key]);
    const wait = plat.filter(r => r.Connection === "Not connected" && !OFF_KEYS[r.Key]);
    const behind = ours.filter(r => r.Status === "Behind");
    const names = list => list.map(r => r.Platform.replace(/ \(.*\)$/, "")).join(", ");
    return { html: '<div class="rs-kpis" id="mkoK-set"></div>' + sourcesHtml(), wire(host) {
      RSC.kpis(host.querySelector("#mkoK-set"), [
        { label: "Live", value: String(live.length), sub: "platforms pulled by API" },
        { label: "Waiting on others", value: String(wait.length), sub: names(wait) || "none" },
        { label: "Off", value: String(off.length), sub: names(off) || "none" },
        { label: "Our data behind", value: String(behind.length), sub: names(behind) || "all on time" },
      ]);
    } };
  }
  function statusChip() {
    const plat = D.conn.filter(r => r.Group === "Marketing platforms");
    if (!plat.length) return "";
    const live = plat.filter(r => r.Connection !== "Not connected").length;
    const wait = plat.filter(r => r.Connection === "Not connected" && !OFF_KEYS[r.Key]).length;
    const late = D.conn.filter(r => r.Status === "Behind").length;
    return '<button type="button" class="mko-chip" data-tab="set" title="Open Settings: every source and its status">'
      + '<i class="mko-dot ' + (late ? "warn" : "ok") + '"></i>' + live + " live · " + wait + " waiting"
      + (late ? " · " + late + " behind" : "") + "</button>";
  }

  /* --- the data sources (the Settings tab) --- */
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
    return '<p class="rs-hint" id="mkoSources">' + esc(parts.join(" · ")) + ".</p>"
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
    const tab = { ov: overviewTab, paid: paidTab, seo: seoTab, web: webTab, rev: reviewsTab, set: settingsTab }[S.tab] || overviewTab;
    const body = tab(w, cw);
    host.innerHTML = '<div class="mko">'
      + '<div class="rs-page-head"><h1>Marketing Overview</h1>'
      + "<p>Every channel, ad platform and search signal in one place.</p></div>"
      + '<div class="rs-bar">'
      + '<div id="mkoCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="mkoDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="mkoCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + statusChip()
      + "</div>"
      + '<nav class="mko-tabs" aria-label="Marketing Overview tabs">' + TABS.map(([k, l]) =>
        '<button type="button" data-tab="' + k + '"' + (k === S.tab ? ' class="on" aria-current="page"' : "")
        + ">" + esc(l) + "</button>").join("") + "</nav>"
      + '<div id="mkoBody">' + body.html + "</div>"
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
    // the tab bar, the status chip and every "See ..." link inside a tab switch tabs
    host.querySelectorAll("[data-tab]").forEach(b => {
      b.onclick = () => {
        S.tab = b.dataset.tab; lsSet(LS_TAB, S.tab); paint(host);
        const nav = host.querySelector(".mko-tabs");
        if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: "start" });
      };
    });
    if (body.wire) body.wire(host);
  }

  registerPage({
    id: "marketing-overview",
    group: "marketing",
    title: "Marketing Overview",
    subtitle: "Every channel, ad platform and search signal in one place: overview, paid ads, search " +
              "and SEO, website, and the data sources under Settings.",
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
        plat("mkt_gsc", "gsc"), plat("mkt_gscq", "gscq"), plat("mkt_ahd", "ahd"), plat("mkt_ahm", "ahm"),
        plat("mkt_bl", "bl"), plat("mkt_ga4", "ga4"), plat("mkt_ga4ch", "ga4ch"), plat("mkt_ga4demo", "demo"),
        plat("mkt_ga4geo", "geo"),
        plat("mkt_adsconv", "conv"), plat("mkt_adscamp", "camp"), plat("mkt_gptad", "gptad"),
        plat("mkt_gptads", "gptads"), plat("mkt_audit", "audit"), plat("mkt_issue", "issue"),
        plat("mkt_rcount", "rc"), plat("mkt_rgoal", "rg"),
      ]).then(([conn, ch, ads, lsaC, lsaL, meta, gpt, gsc, gscq, ahd, ahm, bl, ga4, ga4ch, demo, geo,
                conv, camp, gptad, gptads, audit, issue, rc, rg]) => {
        D.conn = (conn || []).slice().sort((a, b) => (+a.Sort || 0) - (+b.Sort || 0));
        index(ch || []);
        indexPlatforms(ads, lsaC, lsaL, meta, gpt);
        indexWeb({ gsc, gscq, ahd, ahm, bl, ga4, ga4ch, demo, geo });
        indexBatch1({ conv, camp, gptad, gptads, audit, issue, rc, rg });
        // a failed read is tried again on the next visit
        D.ready = !D.chErr && !D.connErr && !Object.keys(P.err).length;
        if (!alive()) return;
        boot();
        paint(host);
      });
    },
  });
})();
