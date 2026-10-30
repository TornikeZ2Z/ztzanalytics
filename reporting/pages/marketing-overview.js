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
 *   * LOCAL SERVICES (ext_lsa_cost_day + mart_mkt_lsa_lead_day): cost, Google's leads by OUR service (the
 *     Moveboard request each became, matched by phone in the mart) with Google's own job type beside,
 *     charged vs credited, phone vs message, cost per charged lead. The lead list itself holds
 *     callers' phones and never reaches the portal; the mart is a count.
 *   * META (ext_meta_ads_day): spend, impressions, clicks and RESULTS per campaign. A result is
 *     whatever the campaign is set to win (ad recallers, page likes, form leads...), so results of
 *     different kinds are listed side by side and never added. The account runs on LA time.
 *   * CHATGPT ADS (ext_chatgpt_ads_day): spend, impressions, clicks. No conversion event is
 *     attached in Ads Manager, so its 0 conversions mean "not measured" and the panel says so
 *     instead of printing 0 as a result.
 *   * REDDIT ADS (ext_reddit_ads_day, 2026-10-23): spend, impressions, clicks per campaign, GMT days.
 *     The bank's Reddit total is more than this account (an agency fee and other charges), so the
 *     Channels table keeps the bank and this panel is the account's own figures.
 *   * LINKEDIN (ext_linkedin_ads_day + ext_linkedin_page_day, 2026-10-28): the ad account 551791282
 *     per campaign, UTC days, and the Company Page (followers, page views, post statistics). The
 *     bank files LinkedIn as not advertising, so the Channels table has no LinkedIn spend; the cost
 *     per booking is the account's spend over LinkedIn's bookings (marked ‡).
 *   * COST PER BOOKING on every platform (2026-10-23, the marketing team), and per Google Ads campaign:
 *     bookings traced by the form's UTM campaign or the campaign's CallRail number
 *     (mart_mkt_campaign_lead), the rest on one "not traced" row; coloured against $600.
 *   * SEARCH AND SEO IN TOPIC TABS (2026-10-23), with the CITATION MAP from Ahrefs (ext_ahrefs_refdomain,
 *     ext_ahrefs_anchor, weekly) and AI visibility planned on Ahrefs Brand Radar.
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
 *     card per platform not connected yet (TikTok; Nextdoor's connector was dropped 2026-10-28).
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
 *   * Nextdoor / Quora / Reddit / Grok as their own group of channels.
 *   * Gemini, Perplexity and Craiglist are not channels marketing runs (its head, 2026-10-22): their
 *     leads count under Other, so every total still holds every lead.
 *   * SEO: keywords by service (the monthly query mart), on-page (Ahrefs Site Audit) and off-page.
 *   * REVIEWS, a tab of its own: every listing's reviews now against its goal (fct_review_counts /
 *     fct_review_goals, the Monthly Report's rule: a goal dated 1 Sep is the total by the end of
 *     August), with what the period added and what platforms REMOVED kept apart (RS.reviewFlow).
 *
 * SEARCH AND YOUTUBE APART (2026-10-19). Performance Max spends on both, and since 22 Aug 2026 Google
 * counts YouTube follow-on views as conversions: 19 Sep - 18 Oct, YouTube took $16,159 of $19,195 with
 * 891 conversions and not one lead, Search $3,007 with all 44 lead conversions. The Google Ads panel
 * splits cost, impressions, clicks and LEAD conversions by network (ext_ads_network_day +
 * ext_ads_network_conv_day; search partners count as Search), and the campaign-type table counts lead
 * conversions only.
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
    mkt_lsa_lead: { table: "mart_mkt_lsa_lead_day", cols: ["Date", "Lead Type", "Service", "Zip Service", "Charge", "Leads"] },
    mkt_meta: { table: "ext_meta_ads_day",
                cols: ["Date", "Campaign Id", "Campaign", "Objective", "Impressions", "Reach", "Clicks",
                       "Spend", "Post Engagement", "Leads", "Results", "Result Indicator"] },
    mkt_gpt: { table: "ext_chatgpt_ads_day",
               cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks", "Spend", "Conversions"] },
    // the Search and SEO tab
    mkt_gsc: { table: "ext_gsc_site_day", cols: ["Date", "Clicks", "Impressions", "Position"] },
    mkt_gscq: { table: "mart_gsc_query", cols: ["Date", "Query", "Type", "State", "City", "Clicks", "Impressions", "Position"] },
    mkt_gsca: { table: "mart_gsc_area", cols: ["Date", "Level", "State", "City", "County", "Query Clicks", "Query Impressions", "Query Position",
                                               "Impr Top 3", "Impr 4 To 10", "Impr 11 To 20", "Impr 21 Plus",
                                               "Business Profile Clicks", "City Page Clicks", "Location Page Clicks",
                                               "Search Volume", "Leads", "Jobs", "Days"] },
    mkt_ahd: { table: "ext_ahrefs_day", cols: ["Date", "Domain Rating", "Org Keywords", "Org Keywords Top 3",
                                              "Org Traffic", "Backlinks Live", "Ref Domains Live"] },
    mkt_ahm: { table: "ext_ahrefs_month", cols: ["Month", "Domain Rating", "Org Traffic", "Ref Domains History"] },
    // batch 1 (2026-10-19): Google conversions by kind and campaign status, ChatGPT per ad, the site
    // audit, and the review listings with their goals
    mkt_adsconv: { table: "ext_ads_conv_day", cols: ["Date", "Campaign Id", "Action", "Category", "Conversions"] },
    mkt_adscamp: { table: "ext_ads_campaign", cols: ["Campaign Id", "Campaign", "Channel", "Status"] },
    // Google by network (2026-10-19): Search and YouTube apart, each with its conversions by kind
    mkt_adsnet: { table: "ext_ads_network_day", cols: ["Date", "Campaign Id", "Network", "Cost", "Impressions", "Clicks"] },
    mkt_adsnetc: { table: "ext_ads_network_conv_day", cols: ["Date", "Campaign Id", "Network", "Category", "Conversions"] },
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
    mkt_ga4: { table: "ext_ga4_site_day", cols: ["Date", "Sessions", "Engaged Sessions", "Active Users", "New Users",
                                                "Engagement Seconds", "Key Events", "Views", "Session Seconds",
                                                "Lead Events"] },
    mkt_ga4ch: { table: "ext_ga4_channel_day", cols: ["Date", "Channel Group", "Source", "Medium", "Sessions",
                                                     "Engaged Sessions", "Session Seconds", "Key Events", "Lead Events"] },
    mkt_ga4demo: { table: "ext_ga4_demo_month", cols: ["Month", "Age", "Gender", "Active Users"] },
    mkt_ga4geo: { table: "mart_mkt_ga4_geo_month", cols: ["Month", "Country", "Region", "Active Users"] },
    // batch 2 (2026-10-21): the SEO report, the GA4 dashboard and the negative reviews (with names, his call)
    mkt_gscp: { table: "mart_gsc_page", cols: ["Date", "Page", "Family", "State", "Place", "Tag", "Clicks", "Impressions", "Position"] },
    mkt_links: { table: "ext_ahrefs_backlink", cols: ["URL From", "Domain From", "Title", "Domain Rating", "Is Spam",
                                                      "First Seen"] },
    mkt_ga4ev: { table: "ext_ga4_event_day", cols: ["Date", "Event", "Key Events", "Event Count"] },
    mkt_ga4dev: { table: "ext_ga4_device_day", cols: ["Date", "Device", "Visitor", "Sessions", "Engaged Sessions",
                                                     "Lead Events"] },
    mkt_ga4lp: { table: "ext_ga4_landing_month", cols: ["Month", "Landing Page", "Sessions", "Engaged Sessions",
                                                       "Session Seconds", "Views", "Lead Events"] },
    mkt_ga4u: { table: "ext_ga4_users_month", cols: ["Month", "Total Users", "New Users"] },
    mkt_negrev: { table: "fct_negative_reviews", cols: ["Company", "Group", "Customer", "Request No", "Status",
                                                       "Case Owner", "Review Score", "Source", "Written Date"] },
    // 2026-10-22: the SEO report compares the same days (his pick), so its gained / lost lists, brand
    // share and listing clicks read the day-grain twins of the two marts (days with a click only)
    mkt_gscqd: { table: "mart_gsc_query_click_day", cols: ["Date", "Query", "Type", "Clicks"] },
    mkt_gscpd: { table: "mart_gsc_page_click_day", cols: ["Date", "Page", "Family", "Clicks"] },
    // 2026-10-23: Reddit Ads per campaign-day (src/reddit_ads.py), the account's own figures
    mkt_reddit: { table: "ext_reddit_ads_day", cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks",
                                                      "Spend", "Conversions"] },
    // 2026-10-28: LinkedIn per campaign-day and the Company Page per day (src/linkedin_ads.py)
    mkt_li: { table: "ext_linkedin_ads_day", cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks",
                                                    "Landing Page Clicks", "Spend", "Leads", "Conversions"] },
    // 2026-10-30 TikTok Ads per campaign-day (src/tiktok_ads.py)
    mkt_tt: { table: "ext_tiktok_ads_day", cols: ["Date", "Campaign Id", "Campaign", "Impressions", "Clicks", "Reach", "Spend",
                                                  "Conversions", "Video Views", "Likes", "Comments", "Shares"] },
    mkt_lipage: { table: "ext_linkedin_page_day", cols: ["Date", "Followers Gained", "Paid Followers Gained",
                                                         "Page Views", "Post Impressions", "Post Clicks",
                                                         "Post Reactions", "Post Comments", "Post Shares", "Followers"] },
    // 2026-10-23: the citation map (Ahrefs, weekly) and Google bookings traced to a campaign
    mkt_refdom: { table: "ext_ahrefs_refdomain", cols: ["Domain", "Domain Rating", "Is Spam", "Dofollow Links", "Links",
                                                        "First Seen", "Last Seen"] },
    mkt_anchor: { table: "ext_ahrefs_anchor", cols: ["Anchor", "Ref Domains", "Links", "Dofollow Links", "First Seen",
                                                     "Last Seen"] },
    mkt_ctrace: { table: "mart_mkt_campaign_lead", cols: ["Date", "Campaign Id", "Via", "Leads", "Booked"] },
    mkt_utmc: { table: "mart_mkt_utm_campaign_lead", cols: ["Date", "Platform", "UTM Campaign", "Leads", "Booked"] },
    // 2026-10-26 AI visibility: Ahrefs Brand Radar answers to our questions (src/brand_radar.py), monthly
    mkt_brans: { table: "ext_brandradar_answer", cols: ["Date", "Engine", "Prompt Key", "Question", "Tags", "Us Mentioned"] },
    mkt_brmen: { table: "ext_brandradar_mention", cols: ["Date", "Engine", "Prompt Key", "Brand", "Is Us", "Sentiment"] },
    mkt_brcit: { table: "ext_brandradar_citation", cols: ["Date", "Engine", "Prompt Key", "Domain", "Is Ours"] },
    // 2026-10-26 Ahrefs API units: each pull's measured cost and the month's quota (src/ahrefs_budget.py)
    mkt_ahuse: { table: "ext_ahrefs_usage", cols: ["Run At", "Step", "Ran", "Reason", "Cadence Days", "Calls", "Units",
                                                   "Est Units"] },
    mkt_ahquota: { table: "ext_ahrefs_quota", cols: ["Checked At", "When", "Units Limit", "Units Used", "Key Used",
                                                     "Reset Date"] },
    // 2026-10-27 Semrush through its own connector (src/semrush_mcp.py), beside Ahrefs in the same tiles
    mkt_smov: { table: "ext_semrush_overview", cols: ["Target", "Date", "Authority Score", "Backlinks", "Ref Domains"] },
    mkt_smas: { table: "ext_semrush_ascore", cols: ["Target", "Date", "Authority Score", "Ref Domains"] },
    mkt_smorg: { table: "ext_semrush_organic", cols: ["Target", "Date", "Semrush Rank", "Org Keywords", "Org Traffic",
                                                     "Org Traffic Cost"] },
    mkt_smkw: { table: "ext_semrush_keyword", cols: ["Date", "Keyword", "Position", "Previous Position", "Volume", "URL",
                                                    "Traffic Pct"] },
    mkt_smaud: { table: "ext_semrush_audit", cols: ["Target", "Date", "Errors", "Warnings", "Notices", "Errors Change",
                                                   "Pages Crawled", "Pages With Issues", "Last Crawl"] },
    mkt_smhist: { table: "ext_semrush_history", cols: ["Month", "Backlinks", "Ref Domains", "Authority Score",
                                                      "Org Keywords", "Org Traffic"] },
    // 2026-10-30 Facebook + Instagram per post, organic against paid (src/meta_page.py)
    mkt_mpost: { table: "ext_meta_post", cols: ["Post Id", "Platform", "Date", "Format", "Text", "Link", "Views", "Organic Views", "Paid Views",
                                                "Reach", "Clicks", "Reactions", "Comments", "Shares", "Saves", "Profile Visits"] },
    mkt_mad: { table: "ext_meta_ad", cols: ["Ad Id", "Ad Name", "Campaign", "Story Id", "Media Id", "Text"] },
    mkt_mlife: { table: "ext_meta_ad_life", cols: ["Ad Id", "Platform", "Reach"] },
    mkt_mpd: { table: "ext_meta_ad_post_day", cols: ["Date", "Ad Id", "Platform", "Spend", "Impressions", "Reach", "Clicks", "Reactions", "Comments",
                                                     "Shares", "Saves", "Leads"] },
    mkt_msoc: { table: "ext_meta_social_day", cols: ["Platform", "Date", "Views", "Organic Views", "Paid Views", "Organic Reach", "Paid Reach",
                                                     "New Followers", "Followers", "Page Views"] },
    mkt_smuse: { table: "ext_semrush_usage", cols: ["Run At", "Step", "Ran", "Reason", "Cadence Days", "Calls", "Units",
                                                   "Est Units"] },
  };
  Object.keys(PLAT).forEach(k => {
    if (!RS.DATASETS[k]) RS.DATASETS[k] = Object.assign({ dateCols: {}, defaultDate: null }, PLAT[k]);
  });
})();

(() => {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LS_PERIOD = "mkoPeriod", LS_CMP = "mkoCmp", LS_TAB = "mkoTab";
  // THE MARKETING DASHBOARD (2026-10-29, his "beautiful redesign … imagine yourself as marketer"):
  // one tab per question a marketer asks. Settings left the tab bar: the "Data sources" pill in the
  // header opens it (S.tab "set"); Reviews became Reputation; Social & content is new.
  const TABS = [["ov", "Overview"], ["paid", "Paid ads"], ["seo", "Search & SEO"], ["web", "Website"],
                ["rev", "Reputation"], ["soc", "Social & content"]];
  // the Search and SEO tab's topics (2026-10-23, his pick: topic tabs), the last one remembered.
  // "Searches and demand" is the Organic Search page itself, hosted here since 2026-10-29.
  const SEO_TOPICS = [["ov", "Overview"], ["demand", "Searches and demand"], ["kw", "Keywords and pages"],
                      ["blog", "Blog"], ["links", "Backlinks and citations"], ["ai", "AI answers"],
                      ["onpage", "Site health"], ["local", "Local rankings"]];
  const LS_SEO = "mkoSeoTopic";
  // Google's conversion categories that are a lead; everything else (YouTube follow-on views,
  // engagement, page views) is counted apart
  const CONV_LEAD = new Set(["SUBMIT_LEAD_FORM", "PHONE_CALL_LEAD", "REQUEST_QUOTE", "CONTACT", "BOOK_APPOINTMENT",
                             "IMPORTED_LEAD", "QUALIFIED_LEAD", "CONVERTED_LEAD"]);
  const CONV_WORD = { YOUTUBE_FOLLOW_ON_VIEWS: "YouTube follow-on views", ENGAGEMENT: "engagements",
                      PAGE_VIEW: "page views", SUBMIT_LEAD_FORM: "lead forms", PHONE_CALL_LEAD: "calls",
                      REQUEST_QUOTE: "quote requests", CONTACT: "contacts", BOOK_APPOINTMENT: "bookings" };
  // the marketing head (2026-10-19): these lead sources are their own group, not mixed into paid / unpaid
  const COMMUNITY = ["Nextdoor", "Quora", "Reddit", "Grok"];
  // ... and these sources are not channels at all (2026-10-22): read as Other
  const AS_OTHER = new Set(["Gemini", "Perplexity", "Craiglist"]);
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
  const S = { co: LIVE_CO, from: null, to: null, cmp: "ly", tab: "ov", booted: false, linkView: "clean", linkAdd: false, seoTopic: "ov" };
  const D = { ready: false, conn: [], connErr: null, rows: [], chErr: null,
              liveFrom: {}, ledgerEnd: null, minDay: null, maxDay: null };
  // the platform panels: rows per platform, its first / last day on file, a load error
  const P = { ads: [], lsaC: [], lsaL: [], meta: [], gpt: [], gsc: [], gscq: [], gsca: [], ahd: [], ahm: [], bl: [],
              ga4: [], ga4ch: [], demo: [], geo: [], conv: [], camp: {}, net: [], netc: [], gptad: [], gptads: {}, audit: null,
              issues: [], rc: [], rg: [], gscp: [], links: [], ga4ev: [], ga4dev: [], ga4lp: [], ga4u: {}, neg: [], marks: [],
              gscqd: [], gscpd: [], reddit: [], li: [], lip: [], tt: [], utmc: [], mpost: [], mpd: [], msoc: [], mad: {}, mlife: {}, refdom: [], anchor: [], ctrace: [], brA: [], brM: [], brC: [],
              ahU: [], ahQ: [],
              smOv: [], smOrg: [], smAs: [], smKw: [], smKwDay: null, smAud: [], smHist: [], smU: [], sm: {},
              first: {}, last: {}, err: {} };
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
  // the mart's Zip Service rows that found no Moveboard request, and what each means (src/mkt_overview_mart.py)
  const LSA_ZIP_DAYS = 30;
  const LSA_NO_SVC = { "Not in Moveboard": "the caller never became a Moveboard request",
                       "No phone": "Google cleared the caller's phone before we stored it",
                       "Not checked": "Moveboard was rebuilding; it fills in next hour" };

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
    // past +300% a percentage stops meaning anything: say the multiple
    if (d >= 3) return '<span class="mko-d ' + cls + '" title="' + (d * 100).toFixed(0) + '% up">×' + (d + 1).toFixed(d + 1 >= 10 ? 0 : 1) + "</span>";
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
      + ".mko .mko-topics{display:flex;flex-wrap:wrap;gap:6px;margin:2px 0 14px}"
      + ".mko .mko-topics button{font:inherit;font-size:12.5px;font-weight:600;color:var(--muted);background:none;"
      + "border:1px solid var(--line);border-radius:999px;padding:4px 12px;cursor:pointer}"
      + ".mko .mko-topics button:hover{color:var(--ink)}"
      + ".mko .mko-topics button.on{color:var(--ink);border-color:var(--brand);background:rgba(132,204,22,.12)}"
      + ".mko table.mko-camp td.mko-bk,.mko table.mko-camp th.mko-bk{background:rgba(132,204,22,.10)}"
      + ".mko table.mko-camp td:first-child,.mko table.mko-camp th:first-child{position:sticky;left:0;z-index:1;background:var(--panel)}"
      + ".mko .mko-amb{color:#D97706;font-weight:600}"
      // one tile, both tools (2026-10-27, his pick): Ahrefs first, Semrush beside it
      + ".mko .mko-two{display:inline-flex;flex-direction:column;line-height:1.05;margin-right:18px;vertical-align:top}"
      + ".mko .mko-two i{font-style:normal;font-size:11px;font-weight:600;color:var(--muted);margin-top:4px}"
      + ".mko .mko-bands{display:flex;height:26px;border-radius:6px;overflow:hidden;font-size:11.5px;font-weight:600;margin:6px 0 8px}"
      + ".mko .mko-bands span{display:flex;align-items:center;padding:0 8px;white-space:nowrap;overflow:hidden;min-width:0}"
      + ".mko .mko-bands .b0{background:rgba(185,28,28,.16);color:var(--neg)}"
      + ".mko .mko-bands .b1{background:rgba(148,163,184,.22);color:var(--muted)}"
      + ".mko .mko-bands .b2{background:rgba(101,163,13,.18);color:var(--ink)}"
      + ".mko .mko-bands .b3{background:rgba(63,125,32,.36);color:var(--ink)}"
      + ".mko .mko-cmap{width:100%;max-width:620px;display:block;margin:0 auto;color:var(--ink)}"
      + ".mko .mko-cmap text{font-size:10px;fill:var(--muted)}"
      + ".mko .mko-ctodo{margin:0;padding-left:18px}.mko .mko-ctodo li{margin:0 0 8px;line-height:1.5}"
      // the citation lists scroll inside their panel, header pinned (2026-10-26, the marketing head: "too long")
      + ".mko .mko-scroll .rs-tablewrap{max-height:340px;overscroll-behavior:contain}"
      + ".mko .mko-scroll thead th{position:sticky;top:0;z-index:2;background:var(--panel)}"
      + ".mko .mko-cchart{height:280px;position:relative}"
      // AI visibility heat tables: low red -> high green, the way the marketing head's report reads them
      + ".mko .mko-heat td.h0{background:rgba(185,28,28,.14)}.mko .mko-heat td.h1{background:rgba(185,28,28,.07)}"
      + ".mko .mko-heat td.h2{background:rgba(148,163,184,.16)}.mko .mko-heat td.h3{background:rgba(101,163,13,.18)}"
      + ".mko .mko-heat td.h4{background:rgba(63,125,32,.32)}.mko .mko-heat td.na{color:var(--faint)}"
      + ".mko .mko-heat tr.mko-us td{font-weight:700}"
      + ".mko .mko-q{font:inherit;font-size:12.5px;width:100%;max-width:320px;margin:0 0 8px;padding:5px 9px;"
      + "border:1px solid var(--line);border-radius:8px;background:none;color:var(--ink)}"
      + ".mko .mko-lnk{font:inherit;font-weight:600;color:var(--brand);background:none;border:0;padding:0;"
      + "cursor:pointer;text-decoration:underline}"
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
      + ".mko .mko-lk-bar{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;justify-content:space-between;margin:10px 0}"
      + ".mko .mko-lk-add{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0 0 10px}"
      + ".mko .mko-lk-add .rs-inp{min-width:0;flex:1 1 240px}.mko .mko-lk-add .mko-lk-day{flex:0 0 auto}"
      + ".mko .mko-lk-msg{font-size:12.5px;color:var(--muted)}.mko .mko-lk-msg.bad{color:var(--neg)}"
      + ".mko .mko-lk-top:empty{display:none}.mko .mko-lk-top{margin:0 0 8px}"
      + ".mko .mko-lk-mark{font-size:12px;padding:4px 10px;white-space:nowrap}.mko .mko-lk-mark.on{color:var(--pos)}"
      + ".mko .mko-pt tr.mko-grp td{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;"
      + "color:var(--muted);padding-top:12px;background:transparent}"
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
      + "body.rs-app.light.v2 .mko .mko-track i.bad{background:#B04A7E}"
      + "body.rs-app.light.v2 .mko .mko-track i.mid{background:#B7791F}"
      + "body.rs-app.light.v2 .mko .mko-rk.top{color:#17733F}"
      + "body.rs-app.light.v2 .mko .mko-share i{background:#3F7D20}"
      + "body.rs-app.light.v2 .mko .mko-d{font-weight:600}"
      /* THE MARKETING DASHBOARD LOOK (2026-10-29): soft 16px cards, a pill tab bar, KPI tiles with a
         12-month spark, tagged action cards, month bars and a cost-per-booking bar in the table.
         Theme variables first (dark works), the green identity on the light theme. Colour, radius
         and type only on the kit's own classes (.panel): never padding (the v2 trap). */
      + ".mkd{display:flex;flex-direction:column;gap:18px}"
      + ".mkd #mkoBody{display:flex;flex-direction:column;gap:18px}"
      + ".mkd #mkoBody>.panel,.mkd #mkoBody .mkd-sec>.panel{margin:0}"
      + ".mkd .mkd-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:14px}"
      + ".mkd .mkd-title{min-width:0}"
      + ".mkd .mkd-eye{font-size:12px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--brand)}"
      + ".mkd .mkd-head h1{margin:2px 0 0;font-size:28px;font-weight:700;letter-spacing:-.02em;line-height:1.15;color:var(--ink)}"
      + ".mkd .mkd-head p{margin:4px 0 0;font-size:14px;color:var(--muted);line-height:1.45}"
      + ".mkd .mkd-acts-r{display:flex;flex-wrap:wrap;gap:10px;align-items:center}"
      + ".mkd .mkd-pill{display:inline-flex;align-items:center;gap:8px;min-height:40px;padding:0 16px;border-radius:999px;"
      + "border:1px solid var(--line);background:var(--panel);font:inherit;font-size:13px;color:var(--ink);cursor:pointer}"
      + ".mkd .mkd-pill i{width:8px;height:8px;border-radius:50%;background:var(--pos)}"
      + ".mkd .mkd-pill.warn i{background:var(--amber,#B7791F)}"
      + ".mkd .mkd-pill:hover{border-color:var(--muted)}"
      + ".mkd .mkd-btn{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid var(--ink);background:var(--ink);"
      + "color:var(--panel);font:inherit;font-size:13px;font-weight:600;cursor:pointer}"
      + ".mkd .mkd-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px 14px;"
      + "background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:8px 10px;scroll-margin-top:12px}"
      + ".mkd .mkd-tabs{display:flex;flex-wrap:wrap;gap:4px}"
      + ".mkd .mkd-tabs button{min-height:40px;padding:0 15px;border:0;border-radius:10px;background:transparent;font:inherit;"
      + "font-size:14px;font-weight:500;color:var(--muted);cursor:pointer}"
      + ".mkd .mkd-tabs button:hover{background:var(--panel-2);color:var(--ink)}"
      + ".mkd .mkd-tabs button.on{background:var(--ink);color:var(--panel);font-weight:600}"
      + ".mkd .mkd-ctl{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}"
      + "body.rs-app .mko.mkd .panel{border-radius:16px;box-shadow:none}"
      + "body.rs-app .mko.mkd .rs-kpis .kpi{border-radius:14px}"
      + ".mkd .mkd-h{display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:4px 12px}"
      + ".mkd .mkd-h h2{margin:0;font-size:18px;font-weight:700;color:var(--ink)}"
      + ".mkd .mkd-card .mkd-h h2{font-size:16px}"
      + ".mkd .mkd-h span{font-size:13px;color:var(--muted)}"
      + ".mkd .mkd-h span.bad{color:var(--neg);font-weight:600}"
      + ".mkd .mkd-sec{display:flex;flex-direction:column;gap:12px}"
      + ".mkd .mkd-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;"
      + "display:flex;flex-direction:column;gap:12px;min-width:0}"
      + ".mkd .mkd-card .rs-hint{margin:0}"
      + ".mkd .mkd-quiet{color:var(--muted);font-size:14px}"
      + ".mkd .mkd-g2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr));gap:14px}"
      /* tiles */
      + ".mkd .mkd-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px}"
      + ".mkd .mkd-kpi{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px 12px;"
      + "display:flex;flex-direction:column;gap:6px;min-width:0}"
      + ".mkd .mkd-kpi .l{font-size:13px;color:var(--muted);font-weight:500}"
      + ".mkd .mkd-kpi .v{display:flex;align-items:baseline;flex-wrap:wrap;gap:8px}"
      + ".mkd .mkd-kpi .v b{font-size:30px;font-weight:700;letter-spacing:-.02em;line-height:1.1;color:var(--ink)}"
      + ".mkd .mkd-kpi .s{font-size:12.5px;color:var(--muted);line-height:1.4}"
      + ".mkd .mkd-chip{display:inline-block;font-size:12px;font-weight:600;padding:3px 9px;border-radius:999px;"
      + "background:var(--panel-2);color:var(--muted);white-space:nowrap}"
      + ".mkd .mkd-chip.good{background:var(--pos-bg);color:var(--pos)}"
      + ".mkd .mkd-chip.bad{background:var(--neg-bg);color:var(--neg)}"
      + ".mkd .mkd-chip.mid{background:var(--warn-bg);color:var(--warn)}"
      + ".mkd .mkd-spark{display:flex;align-items:flex-end;gap:3px;height:36px;margin-top:6px}"
      + ".mkd .mkd-spark i{flex:1;background:var(--line-2);border-radius:3px 3px 0 0;min-height:2px}"
      + ".mkd .mkd-spark i.now{background:var(--brand)}.mkd .mkd-spark i.bad{background:var(--neg)}"
      + ".mkd .mkd-spark.sm{height:22px;gap:2px;width:132px;margin:0}"
      + ".mkd .mkd-ends{display:flex;justify-content:space-between;font-size:11px;color:var(--muted)}"
      /* what to act on */
      + ".mkd .mkd-acts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(215px,100%),1fr));gap:14px}"
      + ".mkd .mkd-act{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;"
      + "display:flex;flex-direction:column;gap:8px;min-width:0}"
      + ".mkd .mkd-act .t{display:flex;justify-content:space-between;align-items:center;gap:8px}"
      + ".mkd .mkd-tag{font-size:11px;font-weight:700;letter-spacing:.1em;padding:4px 10px;border-radius:999px;"
      + "background:var(--panel-2);color:var(--muted)}"
      + ".mkd .mkd-tag.cut,.mkd .big.cut{color:var(--neg)}.mkd .mkd-tag.cut{background:var(--neg-bg)}"
      + ".mkd .mkd-tag.scale,.mkd .big.scale{color:var(--pos)}.mkd .mkd-tag.scale{background:var(--pos-bg)}"
      + ".mkd .mkd-tag.fix,.mkd .big.fix{color:var(--blue)}.mkd .mkd-tag.fix{background:var(--blue-bg)}"
      + ".mkd .mkd-tag.watch,.mkd .big.watch{color:var(--warn)}.mkd .mkd-tag.watch{background:var(--warn-bg)}"
      + ".mkd .mkd-act .big{font-size:22px;font-weight:700;letter-spacing:-.01em}"
      + ".mkd .mkd-act h3{margin:0;font-size:15.5px;font-weight:600;line-height:1.35;color:var(--ink)}"
      + ".mkd .mkd-act p{margin:0;font-size:13.5px;color:var(--muted);line-height:1.5}"
      + ".mkd .mkd-act .go{margin-top:auto;align-self:flex-start;background:none;border:0;padding:6px 0 0;font:inherit;"
      + "font-size:13px;font-weight:600;color:var(--brand);cursor:pointer;text-decoration:none}"
      + ".mkd .mkd-act .go:hover{text-decoration:underline}"
      /* month bars */
      + ".mkd .mkd-mb{display:flex;align-items:flex-end;gap:6px;height:180px;border-bottom:1px solid var(--line-2)}"
      + ".mkd .mkd-mb>div{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:4px;min-width:0}"
      + ".mkd .mkd-mb span{font-size:10.5px;font-weight:600;color:var(--ink);white-space:nowrap}"
      + ".mkd .mkd-mb i{width:100%;background:var(--line-2);border-radius:5px 5px 0 0}"
      + ".mkd .mkd-mb i.now{background:var(--brand)}.mkd .mkd-mb i.bad{background:var(--neg)}"
      + ".mkd .mkd-ml{display:flex;gap:6px}.mkd .mkd-ml span{flex:1;text-align:center;font-size:11px;color:var(--muted)}"
      + "@media(max-width:760px){.mkd .mkd-mb span{display:none}}"
      /* horizontal bars (search mix, AI answers) */
      + ".mkd .mkd-hb{display:grid;grid-template-columns:minmax(0,170px) minmax(0,1fr) 54px;align-items:center;gap:12px;font-size:13.5px}"
      + ".mkd .mkd-hb span.us{font-weight:700}"
      + ".mkd .mkd-hb .tr{height:16px;background:var(--panel-2);border-radius:5px;overflow:hidden}"
      + ".mkd .mkd-hb .tr i{display:block;height:100%;background:var(--line-2);border-radius:5px}"
      + ".mkd .mkd-hb .tr i.now{background:var(--brand)}"
      + ".mkd .mkd-hb b{text-align:right;font-variant-numeric:tabular-nums}"
      /* where bookings came from */
      + ".mkd .mkd-src{width:100%;border-collapse:collapse;font-size:13.5px;min-width:920px}"
      + ".mkd .mkd-src th{text-align:left;font-size:12px;font-weight:600;color:var(--muted);padding:10px;border-bottom:1px solid var(--line);white-space:nowrap}"
      + ".mkd .mkd-src td{padding:10px;border-bottom:1px solid var(--line);vertical-align:middle}"
      + ".mkd .mkd-src .n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}"
      + ".mkd .mkd-src tr.grp td{background:var(--panel-2);font-size:11.5px;font-weight:700;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--muted);padding:8px 10px}"
      + ".mkd .mkd-src tr.tot td{font-weight:700;background:var(--panel-2)}"
      + ".mkd .mkd-cpb{display:flex;align-items:center;gap:10px;min-width:190px}"
      + ".mkd .mkd-cpb .tr{flex:1;height:8px;border-radius:999px;background:var(--panel-2);overflow:hidden}"
      + ".mkd .mkd-cpb .tr i{display:block;height:100%;border-radius:999px;background:var(--pos)}"
      + ".mkd .mkd-cpb .tr i.mid{background:var(--amber,#B7791F)}.mkd .mkd-cpb .tr i.hi{background:var(--neg)}"
      + ".mkd .mkd-cpb b{min-width:64px;text-align:right;font-weight:600}"
      /* platform cards */
      + ".mkd .mkd-plats{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(340px,100%),1fr));gap:14px}"
      + ".mkd .mkd-plat{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px;"
      + "display:flex;flex-direction:column;gap:12px;min-width:0}"
      + ".mkd .mkd-plat.off{background:var(--panel-2);border-style:dashed}"
      + ".mkd .mkd-plat .hd{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}"
      + ".mkd .mkd-plat .nm{display:flex;align-items:center;gap:8px;flex-wrap:wrap}"
      + ".mkd .mkd-plat h3{margin:0;font-size:16px;font-weight:700;color:var(--ink)}"
      + ".mkd .mkd-plat .sp{text-align:right}.mkd .mkd-plat .sp b{display:block;font-size:22px;font-weight:700;color:var(--ink)}"
      + ".mkd .mkd-plat .sp span{font-size:11.5px;color:var(--muted)}"
      + ".mkd .mkd-plat p{margin:0;font-size:13px;color:var(--muted);line-height:1.5}"
      + ".mkd .mkd-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}"
      + ".mkd .mkd-stats div{background:var(--panel-2);border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}"
      + ".mkd .mkd-stats span{font-size:11px;color:var(--muted)}.mkd .mkd-stats b{font-size:14px;font-weight:600;color:var(--ink)}"
      + ".mkd .mkd-plat .ours{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:12px;font-size:13px}"
      + ".mkd .mkd-plat .ours .c{margin-left:auto;font-size:13px}"
      /* Search & SEO topics as pills */
      + ".mkd .mko-topics{display:flex;flex-wrap:wrap;gap:6px;border:0;margin:0}"
      + ".mkd .mko-topics button{min-height:36px;padding:0 14px;border-radius:999px;border:1px solid var(--line);"
      + "background:var(--panel);font:inherit;font-size:13px;color:var(--ink);cursor:pointer}"
      + ".mkd .mko-topics button.on{border-color:var(--brand);background:var(--brand-glow);color:var(--ink);font-weight:600}"
      + "@media(max-width:600px){.mkd .mkd-stats{grid-template-columns:repeat(2,minmax(0,1fr))}.mkd .mkd-head h1{font-size:24px}}"
      /* the light theme: the portal's green identity */
      + "body.rs-app.light .mkd .mkd-eye{color:#3F7D20}"
      + "body.rs-app.light .mkd .mkd-tabs button.on,body.rs-app.light .mkd .mkd-btn{background:#14301F;border-color:#14301F;color:#FFFFFF}"
      + "body.rs-app.light .mkd .mkd-tabs button{color:#33403A}"
      + "body.rs-app.light .mkd .mkd-pill i{background:#3F7D20}"
      + "body.rs-app.light .mkd .mkd-spark i,body.rs-app.light .mkd .mkd-mb i{background:#C9DABD}"
      + "body.rs-app.light .mkd .mkd-spark i.now,body.rs-app.light .mkd .mkd-mb i.now,"
      + "body.rs-app.light .mkd .mkd-hb .tr i.now{background:#3F7D20}"
      + "body.rs-app.light .mkd .mkd-hb .tr i{background:#A3ADA5}"
      + "body.rs-app.light .mkd .mkd-spark i.bad,body.rs-app.light .mkd .mkd-mb i.bad{background:#B04A7E}"
      + "body.rs-app.light .mkd .mkd-h span.bad{color:#8E2F5F}"
      + "body.rs-app.light .mkd .mkd-chip.good,body.rs-app.light .mkd .mkd-tag.scale{background:#EEF5E6;color:#2D5A17}"
      + "body.rs-app.light .mkd .big.scale{color:#2D5A17}"
      + "body.rs-app.light .mkd .mkd-chip.bad,body.rs-app.light .mkd .mkd-tag.cut{background:#FAEFF5;color:#8E2F5F}"
      + "body.rs-app.light .mkd .big.cut{color:#8E2F5F}"
      + "body.rs-app.light .mkd .mkd-chip.mid,body.rs-app.light .mkd .mkd-tag.watch{background:#FBF3E2;color:#7A4E00}"
      + "body.rs-app.light .mkd .big.watch{color:#7A4E00}"
      + "body.rs-app.light .mkd .mkd-tag.fix{background:#EAF0FB;color:#2F4F99}body.rs-app.light .mkd .big.fix{color:#2F4F99}"
      + "body.rs-app.light .mkd .mkd-cpb .tr i{background:#3F7D20}"
      + "body.rs-app.light .mkd .mkd-cpb .tr i.mid{background:#B7791F}body.rs-app.light .mkd .mkd-cpb .tr i.hi{background:#B04A7E}"
      // one tile system and one heading scale over the old kit panels (his advisor, 2026-10-30)
      + "body.rs-app.light .mko.mkd .rs-kpis .kpi{border-top:1px solid var(--line);border-radius:16px;padding:16px 18px}"
      + ".mkd .panel-title{font-size:16px;font-weight:700}"
      + ".mkd .mko-ph h3{font-size:18px;font-weight:700}.mkd .mko-ph .mko-sub{font-size:12.5px}"
      // the month still running: an outlined bar, never a collapse
      + ".mkd .mkd-spark i.part,.mkd .mkd-mb i.part{background:transparent;box-shadow:inset 0 0 0 1.5px var(--brand)}"
      + "body.rs-app.light .mkd .mkd-spark i.part,body.rs-app.light .mkd .mkd-mb i.part{background:transparent;box-shadow:inset 0 0 0 1.5px #3F7D20}"
      + ".mkd .mkd-note{margin:0 0 10px;padding:9px 12px;border-radius:10px;background:var(--warn-bg);color:var(--ink);font-size:13px;line-height:1.45}"
      + ".mkd .mkd-fold{cursor:pointer}.mkd .mkd-fold td{color:var(--muted);font-size:13px;font-weight:600}.mkd .mkd-fold:hover td{color:var(--ink)}"
      + ".mkd .mkd-fold.on .rs-caret{transform:rotate(90deg);display:inline-block}"
      // Paid ads: the jump row stays in reach, each platform's detail opens on demand
      + ".mkd .mko-pnav{position:sticky;top:0;z-index:5;background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:9px 14px;margin:0 0 10px}"
      + ".mkd details.mko-plat{border:1px solid var(--line);border-radius:16px;background:var(--panel);margin:0 0 12px;scroll-margin-top:56px}"
      + ".mkd details.mko-plat>summary{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:14px 18px;cursor:pointer;list-style:none}"
      + ".mkd details.mko-plat>summary::-webkit-details-marker{display:none}"
      + ".mkd details.mko-plat>summary b{font-size:16px;font-weight:700;color:var(--ink)}"
      + ".mkd details.mko-plat>summary span{font-size:13px;color:var(--muted)}"
      + ".mkd details.mko-plat>summary i{margin-left:auto;font-style:normal;font-size:13px;font-weight:600;color:var(--brand)}"
      + "body.rs-app.light .mkd details.mko-plat>summary i{color:#3F7D20}"
      + ".mkd details.mko-plat[open]>summary{border-bottom:1px solid var(--line)}"
      + ".mkd details.mko-plat[open]>summary i{font-size:0}.mkd details.mko-plat[open]>summary i::after{content:'Close';font-size:13px}"
      + ".mkd details.mko-plat>*:not(summary){margin-left:18px;margin-right:18px}"
      + ".mkd details.mko-plat>.mko-ph{margin-top:14px}.mkd details.mko-plat>.mko-ph h3{display:none}"
      + ".mkd .mkd-plat .go{align-self:flex-start;background:none;border:0;padding:6px 0 0;font:inherit;font-size:13px;font-weight:600;color:var(--brand);cursor:pointer}"
      + "body.rs-app.light .mkd .mkd-plat .go{color:#3F7D20}.mkd .mkd-plat .go:hover{text-decoration:underline}"
      + ".mkd .mkd-plat .why{font-size:12.5px;color:var(--muted)}"
      // Google: where the money went
      + ".mkd .mkd-split{display:flex;height:16px;border-radius:5px;overflow:hidden;background:var(--line);margin:4px 0 10px}"
      + ".mkd .mkd-split i{display:block}.mkd .mkd-split .s{background:#3F7D20}.mkd .mkd-split .y{background:#B04A7E}.mkd .mkd-split .o{background:#A3ADA5}"
      + ".mkd .mkd-nets{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}"
      + ".mkd .mkd-nb{background:var(--panel-2);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}"
      + ".mkd .mkd-nb span{font-size:12.5px;font-weight:600;color:var(--muted)}.mkd .mkd-nb b{font-size:22px;font-weight:700;color:var(--ink)}"
      + ".mkd .mkd-nb em{font-style:normal;font-size:12.5px;color:var(--muted)}"
      // anything that folds away
      + ".mkd details.mkd-more{border:1px solid var(--line);border-radius:16px;background:var(--panel)}"
      + ".mkd details.mkd-more>summary{padding:14px 18px;cursor:pointer;font-size:14px;font-weight:600;color:var(--ink)}"
      + ".mkd .mkd-morein{padding:0 18px 14px;font-size:13.5px;color:var(--muted);line-height:1.55}"
      + ".mkd .mkd-morein h3{margin:12px 0 4px;font-size:14px;color:var(--ink)}.mkd .mkd-morein p{margin:0 0 8px}"
      + ".mkd .mkd-apis{display:flex;flex-direction:column;gap:14px;padding:0 18px 14px}"
      // Searches and demand
      + ".mkd .mkd-dmbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px}"
      + ".mkd #mkoDm{display:flex;flex-direction:column;gap:14px}.mkd #mkoDm .panel{margin:0}"
      + ".mkd .mkd-dmtools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 10px}"
      + ".mkd .mkd-in{font:inherit;font-size:13.5px;min-height:38px;padding:0 12px;min-width:240px;border:1px solid var(--line-2);border-radius:8px;background:var(--panel);color:var(--ink)}"
      + ".mkd .mkd-bands{display:flex;height:12px;min-width:110px;border-radius:4px;overflow:hidden;background:var(--line)}"
      + ".mkd .mkd-bands i,.mkd .mkd-bandkey i{display:block}"
      + ".mkd .b1{background:#14301F}.mkd .b2{background:#3F7D20}.mkd .b3{background:#A9C793}.mkd .b4{background:#D5DAD3}"
      + ".mkd .mkd-bandkey{display:flex;flex-wrap:wrap;gap:6px 16px;margin:10px 0 0;font-size:12.5px;color:var(--muted)}"
      + ".mkd .mkd-bandkey span{display:inline-flex;align-items:center;gap:6px}.mkd .mkd-bandkey i{width:12px;height:12px;border-radius:3px}"
      + ".mkd .mkd-verdicts{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:0 0 12px}"
      + ".mkd .mkd-vt{border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:2px}"
      + ".mkd .mkd-vt b{font-size:24px;font-weight:700;line-height:1.1}.mkd .mkd-vt span{font-size:12.5px}"
      + ".mkd .mkd-vt.win{background:#14301F;color:#FFFFFF}.mkd .mkd-vt.p1{background:#3F7D20;color:#FFFFFF}"
      + ".mkd .mkd-vt.p2{background:#FBF3E2;color:#7A4E00}.mkd .mkd-vt.inv{background:#FAEFF5;color:#8E2F5F}"
      + ".mkd .mkd-vt.few{background:var(--panel-2);color:var(--muted)}"
      + ".mkd .mkd-grey td{color:var(--muted)}body.rs-app.light .mkd .mko-d.dn{color:#B04A7E}"
      + ".mkd .mkd-pager{display:flex;align-items:center;justify-content:flex-end;gap:10px;margin-top:10px}.mkd .mkd-pager .mko-sub{margin-right:auto}"
      // Facebook and Instagram: the two teams, and the list that adds up to them
      + ".mkd .mkd-teams{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin:12px 0}"
      + ".mkd .mkd-team{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px 18px}"
      + ".mkd .mkd-team h3{margin:0;font-size:16px;font-weight:700;color:var(--ink)}"
      + ".mkd .mkd-team p{margin:2px 0 12px;font-size:12.5px;color:var(--muted)}"
      + ".mkd .mkd-tstats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}"
      + ".mkd .mkd-tstats .mkd-nb b{display:flex;align-items:center;gap:8px;flex-wrap:wrap}"
      + ".mkd #mkoMeta{display:flex;flex-direction:column;gap:14px}.mkd #mkoMeta .panel,.mkd #mkoMeta .mkd-teams{margin:0}"
      + ".mkd #mkoMeta .panel-head{gap:10px;flex-wrap:wrap}"
      + ".mkd .mkd-mt th.grp{text-align:center}.mkd .mkd-mt .sep{border-left:1px solid var(--line-2)}"
      + ".mkd .mkd-mt thead tr:nth-child(2) th{top:36px}"
      + ".mkd .mkd-mt .mkd-post{min-width:300px;max-width:400px;white-space:normal}"
      + ".mkd .mkd-mt .mkd-post a{color:var(--ink);font-weight:600;text-decoration:none}.mkd .mkd-mt .mkd-post a:hover{text-decoration:underline}"
      + ".mkd .mkd-mt .mkd-post .mko-sub{display:flex;align-items:center;gap:6px;margin-top:3px}"
      + ".mkd .mkd-thb{all:unset;cursor:pointer;font:inherit}.mkd .mkd-thb:hover,.mkd .mkd-thb.on{color:var(--ink)}"
      + ".mkd .mkd-thb:focus-visible{outline:2px solid var(--brand);outline-offset:2px}"
      // the ranking: top or bottom X of a team on any metric
      + ".mkd .mkd-tophead{display:flex;flex-wrap:wrap;gap:10px 18px;align-items:center;margin:0 0 12px}"
      + ".mkd .mkd-rkn{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--muted)}"
      + ".mkd .mkd-rkn .mkd-in{min-width:0;width:72px}"
      + ".mkd .mkd-rks{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}"
      + ".mkd .mkd-rk{display:grid;grid-template-columns:28px minmax(0,1fr) 200px 100px;gap:12px;align-items:center;"
      + "background:var(--panel-2);border-radius:12px;padding:10px 14px}"
      + ".mkd .mkd-rk .n{width:28px;height:28px;border-radius:8px;display:flex;align-items:center;justify-content:center;"
      + "font-weight:700;font-size:13px;background:#3F7D20;color:#FFFFFF}"
      + ".mkd .mkd-rk.low .n{background:#B04A7E}"
      + ".mkd .mkd-rk .w{min-width:0;display:flex;flex-direction:column;gap:3px}"
      + ".mkd .mkd-rk a,.mkd .mkd-rk .t{font-size:13.5px;font-weight:600;line-height:1.35;color:var(--ink);text-decoration:none}"
      + ".mkd .mkd-rk a:hover{text-decoration:underline}.mkd .mkd-rk .mko-sub{display:flex;flex-wrap:wrap;align-items:center;gap:6px}"
      + ".mkd .mkd-rk .bar{height:10px;border-radius:5px;background:var(--line);overflow:hidden}"
      + ".mkd .mkd-rk .bar i{display:block;height:100%;background:#3F7D20}.mkd .mkd-rk.low .bar i{background:#B04A7E}"
      + ".mkd .mkd-rk b.v{font-size:18px;font-weight:700;text-align:right;color:var(--ink)}"
      + ".mkd .mkd-scroll{max-height:560px;overflow:auto}.mkd .mkd-scroll th{position:sticky;top:0;z-index:1;background:var(--panel-2)}"
      + ".mkd .mkd-heat{display:inline-block;min-width:26px;padding:1px 5px;border-radius:5px;text-align:center;font-weight:600;"
      + "background:color-mix(in srgb,#3F7D20 var(--h),transparent);color:var(--ink)}"
      + "body.rs-app.light .mkd .mkd-act .go{color:#2F6316}"
      + "body.rs-app.light .mkd .mko-topics button.on{border-color:#3F7D20;background:#EEF5E6;color:#2D5A17}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ data ---- */
  function index(rows) {
    D.rows = (rows || []).map(r => ({
      d: String(r.Date || "").slice(0, 10), co: r.Company,
      fam: AS_OTHER.has(r.Family) ? "Other" : (r.Family || "(no source)"),
      bd: r["Booked Day"] ? String(r["Booked Day"]).slice(0, 10) : null,
      leads: num(r.Leads), booked: num(r.Booked), billed: num(r.Billed), bval: num(r["Booked Value"]),
      spL: r["Spend Live"] == null ? null : num(r["Spend Live"]),
      spG: r["Spend Ledger"] == null ? null : num(r["Spend Ledger"]),
      imp: r.Impressions == null ? null : num(r.Impressions),
      clk: r.Clicks == null ? null : num(r.Clicks),
    })).filter(r => r.d);
    // aggregate() runs once per month for the 12-month trends: it reads these buckets, not every row
    D.byYm = new Map();
    D.rows.forEach(r => {
      const ym = r.d.slice(0, 7);
      if (!D.byYm.has(ym)) D.byYm.set(ym, []);
      D.byYm.get(ym).push(r);
    });
    D.paidMemo = new Map();
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
    const span = (lo, hi, fn) => D.byYm.forEach((rows, ym) => {
      if (ym < lo.slice(0, 7) || ym > hi.slice(0, 7)) return;
      rows.forEach(r => { if (r.d >= lo && r.d <= hi) fn(r); });
    });
    let paidKey = D.paidMemo.get(look + "|" + b);
    if (!paidKey) {
      paidKey = new Set();
      span(look, b, r => { if ((r.spL || 0) + (r.spG || 0)) paidKey.add(r.co + "|" + r.fam); });
      D.paidMemo.set(look + "|" + b, paidKey);
    }
    span(a, b, r => {
      if (S.co && r.co !== S.co) return;
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
  /* the marketing ladder (his pick, 2026-10-30): "Yesterday" means little on a page driven by a
     monthly ledger. This page only; the kit's wording wherever the two lists overlap. */
  function periodPresets() {
    const kit = RSC.datePresets(), by = n => kit.find(p => p[0] === n), t = today();
    return [by("This month"), by("Past month"), ["Last 30 days", addDays(t, -29), t], by("Last 3 months"),
            ["Year to date", t.slice(0, 4) + "-01-01", t], ["Last 12 months", addYears(t, -1), t], by("All time")].filter(Boolean);
  }
  function boot() {
    if (S.booted) return;
    S.booted = true;
    const P = periodPresets();
    let saved = null;
    try { saved = JSON.parse(lsGet(LS_PERIOD) || "null"); } catch (e) { saved = null; }
    if (saved && saved.p === "This year") saved.p = "Year to date";      // the kit's name for it
    const hit = saved && saved.p ? P.find(p => p[0] === saved.p) : null;
    const okDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (hit) { S.from = hit[1] || null; S.to = hit[2] || null; }
    else if (saved && (okDay(saved.f) || okDay(saved.t))) {
      S.from = okDay(saved.f) ? saved.f : null; S.to = okDay(saved.t) ? saved.t : null;
    } else {
      // the last whole month (2026-10-29): every number in it is complete, the bank ledger's too
      const tm = P.find(p => p[0] === "Past month") || P.find(p => p[0] === "This month");   // the kit's whole previous month
      S.from = tm[1]; S.to = tm[2];
    }
    const c = lsGet(LS_CMP);
    if (c === "ly" || c === "prev") S.cmp = c;
    const t = lsGet(LS_TAB);
    if (TABS.some(x => x[0] === t) || t === "set") S.tab = t;
    const st = lsGet(LS_SEO);
    if (SEO_TOPICS.some(x => x[0] === st)) S.seoTopic = st;
  }
  // a preset by NAME (so "This month" moves with the calendar), anything else by its dates
  function savePeriod() {
    const hit = periodPresets().find(p => p[1] === (S.from || "") && p[2] === (S.to || ""));
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
  // 2026-10-23: the citation map's domains (each typed once) and anchors, and the campaign tracing
  function indexBatch3(t) {
    P.refdom = (t.refdom || []).map(r => ({ dom: String(r.Domain || "").toLowerCase(),
      dr: r["Domain Rating"] == null ? null : num(r["Domain Rating"]), spam: num(r["Is Spam"]) === 1,
      dof: num(r["Dofollow Links"]), links: num(r.Links), first: d10(r["First Seen"]) || null,
      last: d10(r["Last Seen"]) || null })).filter(r => r.dom);
    P.refdom.forEach(r => { r.type = citeType(r.dom); });
    P.anchor = (t.anchor || []).map(r => ({ text: String(r.Anchor == null ? "" : r.Anchor), rd: num(r["Ref Domains"]),
      links: num(r.Links), first: d10(r["First Seen"]) || null }));
    indexPlat("ctrace", t.ctrace, r => ({ d: d10(r.Date), cid: String(r["Campaign Id"]), via: r.Via || "",
      leads: num(r.Leads), booked: num(r.Booked) }));
  }
  // 2026-10-26: AI visibility, the Brand Radar answers, the movers they name and the sites they cite
  function indexBrandRadar(t) {
    const yes = v => num(v) === 1;
    P.brA = (t.brans || []).map(r => ({ d: d10(r.Date), eng: r.Engine, pk: r["Prompt Key"], q: String(r.Question || ""),
      tags: r.Tags || "", us: yes(r["Us Mentioned"]) })).filter(r => r.d && r.pk);
    P.brM = (t.brmen || []).map(r => ({ d: d10(r.Date), eng: r.Engine, pk: r["Prompt Key"], brand: r.Brand,
      us: yes(r["Is Us"]), sent: r.Sentiment || null })).filter(r => r.d && r.pk && r.brand);
    P.brC = (t.brcit || []).map(r => ({ d: d10(r.Date), eng: r.Engine, pk: r["Prompt Key"],
      dom: String(r.Domain || "").toLowerCase(), ours: yes(r["Is Ours"]) })).filter(r => r.d && r.pk);
  }
  // 2026-10-26: Ahrefs API units, every run's steps (UTC times) and the month's quota readings
  function indexAhrefsUsage(t) {
    const at = v => String(v || "").replace("T", " ").slice(0, 19);
    P.ahU = (t.ahuse || []).map(r => ({ at: at(r["Run At"]), step: r.Step, ran: num(r.Ran) === 1, why: r.Reason || "",
      days: r["Cadence Days"] == null ? null : num(r["Cadence Days"]), calls: num(r.Calls), units: num(r.Units),
      est: num(r["Est Units"]) })).filter(r => r.at && r.step).sort((a, b) => (a.at < b.at ? -1 : 1));
    P.ahQ = (t.ahquota || []).map(r => ({ at: at(r["Checked At"]), limit: num(r["Units Limit"]), used: num(r["Units Used"]),
      key: r["Key Used"] == null ? null : num(r["Key Used"]), reset: d10(r["Reset Date"]) }))
      .filter(r => r.at && r.limit).sort((a, b) => (a.at < b.at ? -1 : 1));
  }
  // 2026-10-27: Semrush through its own connector (src/semrush_mcp.py), shown beside Ahrefs
  const SM_US = "ziptozipmoving.com";
  function indexSemrush(t) {
    const nn = v => v == null || v === "" ? null : num(v);
    const site = v => String(v || "").toLowerCase();
    const at = v => String(v || "").replace("T", " ").slice(0, 19);
    const byD = (a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
    P.smOv = (t.smov || []).map(r => ({ t: site(r.Target), d: d10(r.Date), as: nn(r["Authority Score"]),
      bl: nn(r.Backlinks), rd: nn(r["Ref Domains"]) })).filter(r => r.t && r.d).sort(byD);
    P.smOrg = (t.smorg || []).map(r => ({ t: site(r.Target), d: d10(r.Date), rank: nn(r["Semrush Rank"]),
      kw: nn(r["Org Keywords"]), traffic: nn(r["Org Traffic"]), cost: nn(r["Org Traffic Cost"]) }))
      .filter(r => r.t && r.d).sort(byD);
    P.smAs = (t.smas || []).filter(r => site(r.Target) === SM_US)
      .map(r => ({ d: d10(r.Date), as: num(r["Authority Score"]), n: num(r["Ref Domains"]) })).filter(r => r.d);
    const kw = (t.smkw || []).map(r => ({ d: d10(r.Date), kw: r.Keyword || "", pos: nn(r.Position),
      prev: nn(r["Previous Position"]), vol: nn(r.Volume), url: r.URL || "", share: nn(r["Traffic Pct"]) }))
      .filter(r => r.d && r.kw);
    P.smKwDay = kw.reduce((m, r) => (r.d > m ? r.d : m), "") || null;
    P.smKw = kw.filter(r => r.d === P.smKwDay).sort((a, b) => (b.share || 0) - (a.share || 0));
    P.smAud = (t.smaud || []).map(r => ({ t: site(r.Target), d: d10(r.Date), err: nn(r.Errors), warn: nn(r.Warnings),
      note: nn(r.Notices), errCh: nn(r["Errors Change"]), crawled: nn(r["Pages Crawled"]),
      issues: nn(r["Pages With Issues"]), crawl: d10(r["Last Crawl"]) || null })).filter(r => r.t && r.d).sort(byD);
    P.smHist = (t.smhist || []).map(r => ({ m: String(r.Month || "").slice(0, 7), bl: nn(r.Backlinks),
      rd: nn(r["Ref Domains"]), as: nn(r["Authority Score"]), kw: nn(r["Org Keywords"]), traffic: nn(r["Org Traffic"]) }))
      .filter(r => r.m).sort((a, b) => (a.m < b.m ? -1 : 1));
    P.smU = (t.smuse || []).map(r => ({ at: at(r["Run At"]), step: r.Step, ran: num(r.Ran) === 1, why: r.Reason || "",
      days: r["Cadence Days"] == null ? null : num(r["Cadence Days"]), calls: num(r.Calls), units: num(r.Units),
      est: num(r["Est Units"]) })).filter(r => r.at && r.step).sort((a, b) => (a.at < b.at ? -1 : 1));
    const last = (rows, s) => rows.filter(r => r.t === s).pop() || null;
    P.sm = { ov: last(P.smOv, SM_US), org: last(P.smOrg, SM_US), aud: last(P.smAud, SM_US) };
  }
  // Reddit reports only days that ran, so a paused account's last row is its last delivery: its data
  // runs through the last PULL (the connectors row's Newest Data, from ext_reddit_ads_pull)
  function indexReddit(rows) {
    indexPlat("reddit", rows, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: (r.Campaign || "").trim() || "(no name)",
      cost: num(r.Spend), imp: num(r.Impressions), clk: num(r.Clicks), conv: num(r.Conversions) }));
    const c = D.conn.find(r => r.Key === "reddit"), pulled = c && c["Newest Data"] ? d10(c["Newest Data"]) : null;
    if (P.first.reddit && pulled && pulled > P.last.reddit) P.last.reddit = pulled;
  }
  // LinkedIn (2026-10-28): the ads report only days that ran, like Reddit, so they run through the
  // last pull; the Page reports every day, with the follower total on the days a pull saw it
  function indexLinkedIn(ads, page) {
    indexPlat("li", ads, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: (r.Campaign || "").trim() || "(no name)",
      cost: num(r.Spend), imp: num(r.Impressions), clk: num(r.Clicks), lp: num(r["Landing Page Clicks"]),
      conv: num(r.Leads) + num(r.Conversions) }));
    const c = D.conn.find(r => r.Key === "linkedin"), pulled = c && c["Newest Data"] ? d10(c["Newest Data"]) : null;
    if (P.first.li && pulled && pulled > P.last.li) P.last.li = pulled;
    indexPlat("lip", page, r => ({ d: d10(r.Date), gain: num(r["Followers Gained"]) + num(r["Paid Followers Gained"]),
      views: num(r["Page Views"]), imp: num(r["Post Impressions"]), clk: num(r["Post Clicks"]),
      eng: num(r["Post Reactions"]) + num(r["Post Comments"]) + num(r["Post Shares"]),
      fol: r.Followers == null || r.Followers === "" ? null : num(r.Followers), cost: 0 }));
  }
  // TikTok (2026-10-30): reports only days that ran, so it runs through the last pull, as LinkedIn does
  function indexTikTok(rows) {
    indexPlat("tt", rows, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: (r.Campaign || "").trim() || "(no name)", cost: num(r.Spend),
      imp: num(r.Impressions), clk: num(r.Clicks), conv: num(r.Conversions), vv: num(r["Video Views"]),
      eng: num(r.Likes) + num(r.Comments) + num(r.Shares) }));
    const c = D.conn.find(r => r.Key === "tiktok"), pulled = c && c["Newest Data"] ? d10(c["Newest Data"]) : null;
    if (P.first.tt && pulled && pulled > P.last.tt) P.last.tt = pulled;
  }
  // the Page's follower total at the end of day `d`: the newest total a pull saw, less the gains after d
  function followersAt(d) {
    const snap = P.lip.filter(r => r.fol != null).reduce((a, r) => (!a || r.d > a.d ? r : a), null);
    if (!snap) return null;
    return snap.fol - P.lip.filter(r => r.d > d && r.d <= snap.d).reduce((s, r) => s + r.gain, 0);
  }
  function indexPlatforms(ads, lsaC, lsaL, meta, gpt) {
    indexPlat("ads", ads, r => ({ d: d10(r.Date), id: r["Campaign Id"], name: r.Campaign || "(no name)",
      type: r.Channel || "", cost: num(r.Cost), imp: num(r.Impressions), clk: num(r.Clicks),
      conv: num(r.Conversions) }));
    indexPlat("lsaC", lsaC, r => ({ d: d10(r.Date), cost: num(r.Cost), imp: num(r.Impressions),
      clk: num(r.Clicks) }));
    indexPlat("lsaL", lsaL, r => ({ d: d10(r.Date), lt: r["Lead Type"] || "Other",
      svc: r.Service || "Not given", zs: r["Zip Service"] || "Not checked", chg: r.Charge || "Not charged",
      n: num(r.Leads) }));
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
      users: num(r["Active Users"]), newu: num(r["New Users"]), secs: num(r["Engagement Seconds"]),
      kev: num(r["Key Events"]), views: num(r.Views), ssec: num(r["Session Seconds"]), lead: num(r["Lead Events"]) }));
    indexPlat("ga4ch", t.ga4ch, r => ({ d: d10(r.Date), grp: r["Channel Group"] || "", src: r.Source || "(not set)",
      med: r.Medium || "(not set)", ses: num(r.Sessions), eng: num(r["Engaged Sessions"]), ssec: num(r["Session Seconds"]),
      kev: num(r["Key Events"]), lead: num(r["Lead Events"]) }));
    const m7 = v => String(v || "").slice(0, 7);
    P.gsca = (t.gsca || []).map(r => ({ m: m7(r.Date), lvl: r.Level || "", st: r.State || "", city: r.City || "", county: r.County || "",
      qc: num(r["Query Clicks"]), qi: num(r["Query Impressions"]), qp: num(r["Query Position"]),
      b1: num(r["Impr Top 3"]), b2: num(r["Impr 4 To 10"]), b3: num(r["Impr 11 To 20"]), b4: num(r["Impr 21 Plus"]),
      bp: num(r["Business Profile Clicks"]), cp: num(r["City Page Clicks"]), lp: num(r["Location Page Clicks"]),
      vol: r["Search Volume"] == null || r["Search Volume"] === "" ? null : num(r["Search Volume"]),
      leads: num(r.Leads), jobs: num(r.Jobs), days: num(r.Days) })).filter(r => r.m);
    P.gscq = (t.gscq || []).map(r => ({ m: m7(r.Date), q: r.Query || "", type: r.Type || "Other", st: r.State || "", city: r.City || "",
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
    indexPlat("net", t.net, r => ({ d: d10(r.Date), cid: String(r["Campaign Id"]), net: r.Network || "UNKNOWN",
      cost: num(r.Cost), imp: num(r.Impressions), clk: num(r.Clicks) }));
    P.netc = (t.netc || []).map(r => ({ d: d10(r.Date), cid: String(r["Campaign Id"]), net: r.Network || "UNKNOWN",
      cat: r.Category || "", n: num(r.Conversions) })).filter(r => r.d);
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

  // batch 2 (2026-10-21): Search Console pages, Ahrefs' new links, the GA4 breakdowns, negative reviews
  function indexBatch2(t) {
    const m7 = v => String(v || "").slice(0, 7);
    P.gscqd = (t.gscqd || []).map(r => ({ d: d10(r.Date), q: r.Query || "", type: r.Type || "Other", clk: num(r.Clicks) }))
      .filter(r => r.d);
    P.gscpd = (t.gscpd || []).map(r => ({ d: d10(r.Date), page: r.Page || "", fam: r.Family || "Other", clk: num(r.Clicks) }))
      .filter(r => r.d);
    P.gscp = (t.gscp || []).map(r => ({ m: m7(r.Date), page: r.Page || "", fam: r.Family || "Other", st: r.State || "", place: r.Place || "",
      tag: r.Tag || "", clk: num(r.Clicks), imp: num(r.Impressions), pos: num(r.Position) })).filter(r => r.m);
    P.links = (t.links || []).map(r => ({ d: d10(r["First Seen"]), url: r["URL From"] || "", dom: r["Domain From"] || "",
      title: r.Title || "", dr: r["Domain Rating"] == null ? null : num(r["Domain Rating"]), spam: num(r["Is Spam"]) === 1 }))
      .filter(r => r.d);
    indexPlat("ga4ev", t.ga4ev, r => ({ d: d10(r.Date), ev: r.Event || "", kev: num(r["Key Events"]), n: num(r["Event Count"]) }));
    indexPlat("ga4dev", t.ga4dev, r => ({ d: d10(r.Date), dev: r.Device || "(not set)", vis: r.Visitor || "(not set)",
      ses: num(r.Sessions), eng: num(r["Engaged Sessions"]), lead: num(r["Lead Events"]) }));
    P.ga4lp = (t.ga4lp || []).map(r => ({ m: m7(r.Month), page: r["Landing Page"] || "(not set)", ses: num(r.Sessions),
      eng: num(r["Engaged Sessions"]), ssec: num(r["Session Seconds"]), views: num(r.Views), lead: num(r["Lead Events"]) }))
      .filter(r => r.m);
    P.ga4u = {};
    (t.ga4u || []).forEach(r => { P.ga4u[m7(r.Month)] = { users: num(r["Total Users"]), newu: num(r["New Users"]) }; });
    // the platform and the stars through rs-core's one map, the same as Claims & Negative Reviews
    P.neg = (t.neg || []).map(r => ({ d: d10(r["Written Date"]) || null, co: r.Company || "",
      grp: String(r.Group || "").trim(), who: r.Customer || "", req: r["Request No"] || "", st: r.Status || "",
      owner: r["Case Owner"] || "", src: String(r.Source || "").trim(),
      plat: RS.reviewPlatform(r.Source), stars: RS.reviewStars(r["Review Score"]) }));
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
      return { main: V.navy, alt: V.accent, light: V.accentL, ctx: V.ctx, faint: V.other, violet: "#7FA864", neg: "#B04A7E" };
    }
    const cs = getComputedStyle(document.body);
    const v = (n, fb) => (cs.getPropertyValue(n) || "").trim() || fb;
    return { main: v("--brand", "#b7e23b"), alt: v("--blue", "#5b8cff"), light: v("--purple", "#a78bfa"),
             ctx: v("--faint", "#5c6a7c"), faint: v("--faint", "#5c6a7c"), violet: "#7FA864", neg: "#B04A7E" };
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
    // a platform that reports today or yesterday reports a day still filling (Meta runs on Los
    // Angeles time, Reddit on GMT; the morning pull catches yesterday half done): dashed end
    const partial = pw.b >= addDays(today(), -1);
    const lastI = keys.length - 1;
    RSC.chartCard(host, {
      title: title + " by " + GRAIN_WORD[g],
      key: "mko-" + key + "-cost",
      controlsHtml: partial ? '<span class="lbl">dashed end = still filling</span>' : "",
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
                         + (partial && c.datasetIndex === 0 && c.dataIndex === lastI ? " (still filling)" : "") } } },
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
  const VOLUME = /^(impressions|clicks|reach|engagement|results|conversions|to site)$/i;
  function kp(label, cur, prev, fmt, lower, sub, pw) {
    // more impressions or clicks is not a win by itself: only money per outcome keeps red and green
    if (VOLUME.test(label)) lower = null;
    const on = !!(pw && pw.cw) && prev !== undefined;
    const was = on ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(prev) : "";
    return { label, value: fmt(cur) + (on ? delta(cur, prev, lower) : ""),
             sub: [was, sub].filter(Boolean).join(" · ") };
  }
  function platHead(key, title, sub, pw) {
    return '<div class="mko-ph"><h3>' + esc(title) + '</h3><span class="mko-sub">' + esc(sub)
      + (pw && pw.last ? " · data through " + esc(day(pw.last))
        + (pw.last >= addDays(today(), -1) ? ", the last day still filling" : "") : "") + "</span></div>";
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
  /* a long list in pages, so the card keeps its height (Giga, 2026-10-30) */
  function pagedTable(el, cols, rows, size, tight) {
    let page = 0;
    const pages = Math.ceil(rows.length / size);
    const paint = () => {
      const from = page * size, to = Math.min(rows.length, from + size);
      el.innerHTML = ptable(cols, rows.slice(from, to), null, tight)
        + (pages > 1 ? '<div class="mkd-pager"><span class="mko-sub">' + fmtN(from + 1) + "–" + fmtN(to) + " of " + fmtN(rows.length) + "</span>"
          + '<button type="button" class="rs-btn" data-p="-1"' + (page ? "" : " disabled") + '>‹ Previous</button>'
          + '<button type="button" class="rs-btn" data-p="1"' + (page < pages - 1 ? "" : " disabled") + ">Next ›</button></div>" : "");
      el.querySelectorAll("[data-p]").forEach(b => { b.onclick = () => { page += +b.dataset.p; paint(); }; });
    };
    paint();
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
      + adsNetHtml(pw, cur)
      + '<div class="mko-g2"><div id="mkoC-ads"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">By campaign type</span></div>'
      + adsTypeTable(rows, cur, cv) + "</div></div>"
      + adsCampHtml(rows, cv, pw);
    return { html, wire(host) {
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
        cpbKp("Google", pw, "Google"),
      ]);
      costCard(host.querySelector("#mkoC-ads"), "ads", "Cost", pw, rows, cmp,
               { label: "Conversions", val: r => r.conv, fmt: fmtN });
    } };
  }
  /* by campaign type, on LEAD conversions only: Google's own count would credit Performance Max with
     every YouTube follow-on view (cv: ext_ads_conv_day rows of the period) */
  function adsTypeTable(rows, cur, cv) {
    const lead = {};
    cv.forEach(r => { if (CONV_LEAD.has(r.cat)) lead[r.cid] = (lead[r.cid] || 0) + r.n; });
    const typeOf = {};
    P.ads.forEach(r => { typeOf[String(r.id)] = r.type; });
    const leadOf = t => Object.keys(lead).filter(id => typeOf[id] === t).reduce((a, id) => a + lead[id], 0);
    const list = groupBy(rows, r => r.type).map(x => Object.assign({ k: x.k, lead: leadOf(x.k) },
      clickStats(x.rows))).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    return ptable([
      { h: "Type", name: true, cell: r => shareName(esc(ADS_TYPE[r.k] || prettyCode(r.k) || "(none)"), r.cost, cur.cost) },
      { h: "Cost", num: true, tip: "and its share of the period's cost", cell: r => withShare(money0(r.cost), r.cost, cur.cost) },
      { h: "Clicks", num: true, cell: r => withShare(fmtN(r.clk), r.clk, cur.clk) },
      { h: "Lead conv.", num: true, tip: "forms, calls and quote requests Google counted; YouTube follow-on views and engagements left out",
        cell: r => fmtN(r.lead) },
      // short: this is the narrow side table, and the dark look's capitals push a long head off the edge
      { h: "Cost / lead", num: true, tip: "cost ÷ lead conversions", cell: r => money0(ratio(r.cost, r.lead)) },
    ], list, null, true);
  }
  /* NETWORK SPLIT -- where Google showed the ads: Search (Google Search and its search partners),
     YouTube, and the rest. A network's conversions are split into leads and the rest by category
     (ext_ads_network_conv_day), so YouTube's follow-on views never pass for leads. */
  const NET_GROUP = { SEARCH: "Search", SEARCH_PARTNERS: "Search",
                      YOUTUBE: "YouTube", YOUTUBE_SEARCH: "YouTube", YOUTUBE_WATCH: "YouTube" };
  const NET_WORD = { SEARCH: "Google Search", SEARCH_PARTNERS: "search partners", YOUTUBE: "YouTube",
                     YOUTUBE_SEARCH: "YouTube", YOUTUBE_WATCH: "YouTube", CONTENT: "Display", DISCOVER: "Discover",
                     MAPS: "Maps", GMAIL: "Gmail", MIXED: "cross-network", GOOGLE_TV: "Google TV",
                     GOOGLE_OWNED_CHANNELS: "Google channels" };
  // net / nconv: the period's rows; typeOf(campaign id) -> its campaign type
  function adsNetSplit(net, nconv, typeOf) {
    const out = ["Search", "YouTube", "Other"].map(k => ({ k, cost: 0, imp: 0, clk: 0, lead: 0, other: 0,
                                                           parts: {}, types: {} }));
    const by = {};
    out.forEach(o => { by[o.k] = o; });
    const grp = n => by[NET_GROUP[n] || "Other"];
    net.forEach(r => {
      const o = grp(r.net), t = typeOf(r.cid) || "";
      o.cost += r.cost; o.imp += r.imp; o.clk += r.clk;
      o.parts[r.net] = (o.parts[r.net] || 0) + r.cost;
      o.types[t] = (o.types[t] || 0) + r.cost;
    });
    nconv.forEach(r => { const o = grp(r.net); if (CONV_LEAD.has(r.cat)) o.lead += r.n; else o.other += r.n; });
    out.forEach(o => { o.ctr = ratio(o.clk, o.imp); o.cpc = ratio(o.cost, o.clk); });
    return out;
  }
  /* END NETWORK SPLIT */
  function adsNetHtml(pw, cur) {
    const wrap = body => '<div class="panel"><div class="panel-head"><span class="panel-title">Search and YouTube</span>'
      + '<span class="mko-sub">where Google showed the ads · Performance Max runs on both</span></div>' + body + "</div>";
    const err = P.err.net || P.err.netc;
    if (err) {
      return wrap('<div class="mko-empty">The split by network could not load — ' + esc(err)
        + (/404|unknown dataset|not granted|403/i.test(err) ? " (it arrives with the next bridge deploy or pipeline run)" : "")
        + "</div>");
    }
    if (!P.net.length) return wrap('<div class="mko-empty">The split by network arrives with the next Google Ads pull.</div>');
    const tmap = {};
    P.ads.forEach(r => { tmap[String(r.id)] = r.type; });
    const typeOf = id => tmap[id] || (P.camp[id] || {}).type || "";
    const all = adsNetSplit(inRange(P.net, pw.a, pw.b), inRange(P.netc, pw.a, pw.b), typeOf);
    const list = all.filter(o => o.k !== "Other" || o.cost || o.imp || o.lead || o.other);
    const tc = sum(all, "cost");
    const typeWord = t => t === "SEARCH" ? "Search campaigns" : ADS_TYPE[t] || prettyCode(t) || "other";
    const top = (m, word) => Object.entries(m).filter(([, v]) => v >= 0.5).sort((a, b) => b[1] - a[1])
      .map(([k, v]) => word(k) + " " + money0(v)).join(" · ");
    const sub = o => {
      const bits = [top(o.types, typeWord)];
      if (o.k === "Search" && (o.parts.SEARCH_PARTNERS || 0) >= 0.5) bits.push("incl. search partners " + money0(o.parts.SEARCH_PARTNERS));
      if (o.k === "Other") bits.unshift(top(o.parts, k => NET_WORD[k] || prettyCode(k)));
      return bits.filter(Boolean).map(esc).join("<br>");
    };
    const cols = [
      { h: "Network", name: true, cell: r => shareName("<b>" + esc(r.k === "Other" ? "Other networks" : r.k) + "</b>", r.cost, tc)
          + (r.sub ? '<div class="mko-sub">' + r.sub + "</div>" : "") },
      { h: "Cost", num: true, tip: "and its share of the period's cost", cell: r => withShare(money0(r.cost), r.cost, tc) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => compact(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "Lead conv.", num: true, tip: "forms, calls and quote requests Google counted", cell: r => "<b>" + fmtN(r.lead) + "</b>" },
      { h: "Other conv.", num: true, tip: "YouTube follow-on views, engagements, page views", cell: r => fmtN(r.other) },
      { h: "Cost / lead conv.", num: true, cell: r => money0(ratio(r.cost, r.lead)) },
    ];
    list.forEach(o => { o.sub = sub(o); });
    const tot = { k: "All", sub: "", cost: tc, imp: sum(all, "imp"), clk: sum(all, "clk"), lead: sum(all, "lead"),
                  other: sum(all, "other") };
    tot.ctr = ratio(tot.clk, tot.imp); tot.cpc = ratio(tot.cost, tot.clk);
    const yt = all[1], notes = [];
    if (yt.cost >= 1 && tc > 0) {
      notes.push("YouTube took " + pct(yt.cost / tc) + " of the cost for " + fmtN(yt.lead) + " lead conversion"
        + (Math.round(yt.lead) === 1 ? "" : "s") + (yt.other >= 1 ? "; its " + fmtN(yt.other)
          + " other conversions are follow-on views and engagements, not leads" : "") + ".");
    }
    // the split is its own pull: say so when it does not add up to the panel's cost
    if (Math.abs(tc - cur.cost) > Math.max(1, 0.01 * cur.cost)) {
      notes.push("The split covers " + money0(tc) + " of the period's " + money0(cur.cost)
        + " (it is pulled on its own; the next Google Ads pull evens it out).");
    }
    return wrap(ptable(cols, list, tot)
      + (notes.length ? '<p class="rs-hint">' + notes.map(esc).join(" ") + "</p>" : ""));
  }
  /* the campaigns, ACTIVE (enabled) first; a paused campaign that still spent sits below. The marketing
     team's layout (2026-10-23, his picks): Clicks over CTR · CPC, Google's lead conversions over their
     cost, OUR bookings traced to the campaign over the cost per booking (coloured against CPB_TARGET),
     and Google's own total. A booking sits on a campaign only where the website form's UTM campaign or a
     call to the campaign's CallRail number proves it (mart_mkt_campaign_lead); a "not traced" row keeps
     the column adding up to the Google bookings of the Channels table. */
  const CPB_TARGET = 600;
  const cpbCls = v => v <= CPB_TARGET ? "mko-pos" : v <= CPB_TARGET * 1.25 ? "mko-amb" : "mko-neg";
  function adsCampHtml(rows, cv, pw) {
    const lead = {}, other = {};
    cv.forEach(r => { const m = CONV_LEAD.has(r.cat) ? lead : other; m[r.cid] = (m[r.cid] || 0) + r.n; });
    const tr = {};
    inRange(P.ctrace, pw.a, pw.b).forEach(r => {
      const x = tr[r.cid] = tr[r.cid] || { leads: 0, bk: 0 };
      x.leads += r.leads; x.bk += r.booked;
    });
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const c = P.camp[String(x.k)] || {};
      return Object.assign({ id: String(x.k), name: last.name, type: last.type, status: c.status || "",
                             lead: lead[x.k] || 0, other: other[x.k] || 0, conv: sum(x.rows, "conv"),
                             bk: (tr[String(x.k)] || {}).bk || 0 }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost || b.imp - a.imp);
    const known = Object.keys(P.camp).length > 0;
    const active = known ? list.filter(x => x.status === "ENABLED") : list;
    const paused = known ? list.filter(x => x.status !== "ENABLED") : [];
    const idle = Object.entries(P.camp).filter(([id, c]) => c.status === "ENABLED" && !list.some(x => x.id === id));
    const g = famStat("Google", pw.a, pw.b), gBooked = g ? g.booked : 0;
    const traced = Object.values(tr).reduce((a, x) => a + x.bk, 0);
    // under half the bookings traced, a campaign's "0 bookings" is the tracing, not the campaign:
    // no red, and Google's leads are the column to read
    const thinTrace = gBooked >= THIN && traced / gBooked < 0.5;
    const bkCell = r => {
      if (r.nt) return "<b>" + fmtN(r.bk) + "</b>";
      if (thinTrace && !r.tot) return '<span class="mko-sub">' + fmtN(r.bk) + "</span>";
      if (r.tot) return "<b>" + fmtN(r.bk) + "</b>" + '<div class="mko-sub">' + (r.cpb != null ? money0(r.cpb) + " each" : "—") + "</div>";
      return "<b>" + fmtN(r.bk) + "</b>" + '<div class="mko-sub">' + (r.bk ? '<span class="' + cpbCls(r.cost / r.bk) + '">'
        + money0(r.cost / r.bk) + " each</span>" : r.cost >= 1 ? '<span class="mko-neg">' + money0(r.cost) + " spent</span>" : "—") + "</div>";
    };
    const dash = '<span class="mko-sub">—</span>';
    const cols = [
      { h: "Campaign", cell: r => r.nt ? '<span class="mko-sub"><b>Not traced to a campaign</b></span><div class="mko-sub">calls '
          + "to the main number, Moveboard's own Google leads, forms without a campaign</div>"
          : r.tot ? "<b>" + esc(r.name) + "</b>" + (r.sub ? '<div class="mko-sub">' + esc(r.sub) + "</div>" : "")
          : esc(r.name) + (r.type ? '<div class="mko-sub">' + esc(ADS_TYPE[r.type] || prettyCode(r.type)) + "</div>" : "") },
      { h: "Cost", num: true, cell: r => r.nt ? dash : money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => r.nt ? dash : compact(r.imp) },
      { h: "Clicks", num: true, tip: "CTR · CPC beneath", cell: r => r.nt ? dash : fmtN(r.clk) + '<div class="mko-sub">'
          + pct2(r.ctr) + " · " + cents(r.cpc) + "</div>" },
      { h: "Leads", num: true, tip: "lead conversions Google counted (forms, calls, quote requests), with Google's cost per lead",
        cell: r => r.nt ? dash : "<b>" + fmtN(r.lead) + "</b>" + '<div class="mko-sub">' + (r.lead >= 0.5 ? money0(r.cost / r.lead) + " each" : "—") + "</div>" },
      { h: "Bookings", num: true, cls: "mko-bk", tip: "our leads created in the period that booked (as the Channels table), traced "
          + "to the campaign by the website form's UTM campaign or a call to its CallRail number; colour against $"
          + CPB_TARGET + " a booking", cell: bkCell },
      // his call 2026-10-21: Google's own number beside the split, as the marketing team's dashboard shows it
      { h: "Google's total", num: true, tip: "Google's own conversions: leads, YouTube follow-on views and engagements "
          + "together, with Google's cost per conversion", cell: r => r.nt ? dash : fmtN(r.conv)
          + (r.conv >= 0.5 ? '<div class="mko-sub">' + money0(ratio(r.cost, r.conv)) + " each</div>" : "") },
    ];
    const table = rs => '<div class="rs-tablewrap"><table class="rs-table mko-pt mko-camp"><thead><tr>'
      + cols.map(c => '<th class="' + [c.num ? "mko-num" : "", c.cls || ""].join(" ").trim() + '"'
        + (c.tip ? ' title="' + esc(c.tip) + '"' : "") + ">" + esc(c.h) + "</th>").join("") + "</tr></thead><tbody>"
      + rs.map(r => "<tr" + (r.tot ? ' class="mko-tot"' : "") + ">" + cols.map(c => '<td class="'
        + [c.num ? "mko-num" : "mko-name", c.cls || ""].join(" ").trim() + '">' + c.cell(r) + "</td>").join("") + "</tr>").join("")
      + "</tbody></table></div>";
    const sumOf = xs => ({ cost: sum(xs, "cost"), imp: sum(xs, "imp"), clk: sum(xs, "clk"), lead: sum(xs, "lead"),
                           conv: sum(xs, "conv"), ctr: ratio(sum(xs, "clk"), sum(xs, "imp")), cpc: ratio(sum(xs, "cost"), sum(xs, "clk")) });
    // the totals are every campaign of the period (paused ones too) against all of Google's bookings
    const allRow = Object.assign({ tot: true, name: "All Google", sub: paused.length ? "the paused campaigns below included" : "",
                                   bk: gBooked, cpb: g ? g.cpb : null }, sumOf(list));
    const ntRow = { nt: true, bk: Math.max(gBooked - traced, 0) };
    const formTo = P.ctrace.filter(r => r.via === "Form").reduce((a, r) => (r.d > a ? r.d : a), "");
    const notes = thinTrace ? [] : ["Colours against $" + fmtN(CPB_TARGET) + " a booking: green under, amber up to $" + fmtN(CPB_TARGET * 1.25)
      + ", red above it or spend with no booking."];
    if (formTo && pw.b > addDays(formTo, 7)) {
      notes.push("Website forms are traced through " + day(formTo) + ": the CMS form export has not arrived since, so later "
        + "bookings trace through CallRail calls only.");
    }
    if (P.err.ctrace) notes.unshift("Bookings by campaign could not load — " + P.err.ctrace + ".");
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Active campaigns</span>'
      + '<span class="mko-sub">' + (known ? "enabled in Google Ads, most cost first" : "every campaign that showed an ad")
      + (gBooked ? " · " + fmtN(traced) + " of " + fmtN(gBooked) + " Google bookings traced to a campaign" : "") + "</span></div>"
      + (thinTrace ? '<p class="mkd-note">Only ' + fmtN(traced) + " of " + fmtN(gBooked) + " bookings can be traced to a campaign "
        + "(website form UTM or a CallRail number): judge campaigns on cost per lead until tracing improves.</p>" : "")
      + (active.length ? table(active.concat(gBooked ? [ntRow] : [], [allRow]))
        : '<div class="mko-empty">No active campaign spent in this period.</div>')
      + '<p class="rs-hint">' + notes.map(esc).join(" ") + "</p>"
      + (idle.length ? '<p class="rs-hint">Enabled but no spend in the period: ' + esc(idle.map(([, c]) => c.name).join(", ")) + ".</p>" : "")
      + "</div>"
      + (paused.length ? '<div class="panel"><div class="panel-head"><span class="panel-title">Paused campaigns that spent in the period</span></div>'
        + table(paused) + "</div>" : "");
  }
  // the Channels table's cost per booking for a platform's source family (2026-10-23: on every platform)
  function cpbKp(fam, pw, word, mark) {
    const f = famStat(fam, pw.a, pw.b);
    return { label: "Cost per booking", value: f && f.cpb != null ? money0(f.cpb) + (mark || "") : "—",
             sub: f ? fmtN(f.booked) + " booked of " + fmtN(f.leads) + " " + word + " leads" : "our side" };
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
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Leads by service</span>'
      + '<span class="mko-sub">' + esc(typeLine) + "</span></div>"
      + '<p class="rs-hint">The service is our own: the Moveboard request each lead became (the same phone, '
      + "the nearest request within " + LSA_ZIP_DAYS + " days). Google's job type is what the customer picked on "
      + "Google, in Google's words, and Google leaves it blank on most leads.</p>"
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
        cpbKp("Google Local", pw, "Google Local"),
      ]);
      lsaCard(host.querySelector("#mkoC-lsa"), pw, cost, leads);
    } };
  }
  /* By OUR service (2026-10-29, the marketing head: Google's "Senior move" is no word of ours): the
     Moveboard request's Service Type, from mart_mkt_lsa_lead_day.Zip Service. The rows that found no
     request sink to the bottom with what they mean; Google's own job type rides beside, small. */
  function lsaTypeTable(leads, cur) {
    const list = groupBy(leads, r => r.zs).map(x => {
      const o = { k: x.k, n: sum(x.rows, "n"), g: groupBy(x.rows.filter(r => r.svc !== "Not given"), r => r.svc)
        .map(y => ({ k: y.k, n: sum(y.rows, "n") })).sort((a, b) => b.n - a.n) };
      LSA_CHARGE.forEach(c => { o[c] = sum(x.rows.filter(r => r.chg === c), "n"); });
      return o;
    }).sort((a, b) => (LSA_NO_SVC[a.k] ? 1 : 0) - (LSA_NO_SVC[b.k] ? 1 : 0) || b.n - a.n);
    const tot = { k: "All leads", n: cur.leads, g: null };
    LSA_CHARGE.forEach(c => { tot[c] = cur[c]; });
    const isTot = r => r.k === "All leads";
    return ptable([
      { h: "Service", name: true, tip: "the Service Type of the Moveboard request the lead became",
        cell: r => isTot(r) ? esc(r.k) : shareName(esc(r.k)
          + (LSA_NO_SVC[r.k] ? '<div class="mko-sub">' + esc(LSA_NO_SVC[r.k]) + "</div>" : ""), r.n, cur.leads) },
      { h: "Leads", num: true, cell: r => isTot(r) ? fmtN(r.n) : withShare(fmtN(r.n), r.n, cur.leads) },
      { h: "Charged", num: true, cell: r => fmtN(r.Charged) },
      { h: "Credited", num: true, cell: r => fmtN(r.Credited) },
      { h: "Not charged", num: true, tip: "not billed by Google (and any still in review)",
        cell: r => fmtN(r["Not charged"] + r["In review"]) },
      { h: "Google's job type", tip: "what the customer picked on Google; blank on most leads",
        cell: r => !r.g ? "" : r.g.length
          ? '<span class="mko-sub">' + r.g.map(t => fmtN(t.n) + " " + esc(t.k.toLowerCase())).join(" · ") + "</span>"
          : '<span class="mko-sub">not given</span>' },
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
      + metaCampTable(rows, cur, pw) + "</div>";
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
        cpbKp("Meta", pw, "Meta"),
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
  /* Bookings by campaign on every source (Giga, 2026-10-30). The UTM on a lead's website form is the
     only link from a lead to these campaigns; Google has its call-tracking numbers too. A campaign is
     found by its id or its name, so utm_campaign={{campaign.id}} and a typed name both work. */
  const normCamp = v => String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]+/g, "");
  function utmTrace(key, a, b) {
    const map = {};
    let leads = 0, booked = 0;
    P.utmc.forEach(r => {
      if (r.plat !== key || r.d < a || r.d > b) return;
      const x = map[r.camp] = map[r.camp] || { leads: 0, booked: 0 };
      x.leads += r.leads; x.booked += r.booked; leads += r.leads; booked += r.booked;
    });
    return { map, leads, booked };
  }
  function traceCols(t) {
    const of = r => (r.name === "All campaigns" ? t : t.map[normCamp(r.id)] || t.map[normCamp(r.name)] || null);
    return [
      { h: "Leads", num: true, tip: "our leads whose website form carried this campaign's UTM", cell: r => (of(r) ? fmtN(of(r).leads) : "—") },
      { h: "Booked", num: true, cell: r => (of(r) ? fmtN(of(r).booked) : "—") },
      { h: "Cost per booking", num: true, cell: r => (of(r) && of(r).booked ? money0(r.cost / of(r).booked) : "—") },
    ];
  }
  function utmNote(t, list, fam, pw) {
    const f = famStat(fam, pw.a, pw.b), known = new Set();
    list.forEach(r => { known.add(normCamp(r.id)); known.add(normCamp(r.name)); });
    const stray = Object.keys(t.map).filter(k => !known.has(k));
    return '<p class="rs-hint">Leads and bookings by campaign read the UTM on the website form, so only ads whose link carries one can be traced: <b>'
      + fmtN(t.leads) + " of " + fmtN(f ? f.leads : 0) + "</b> leads filed under " + esc(fam) + " in this period. New links reach this table with the next website form export."
      + (stray.length ? " " + fmtN(stray.length) + (stray.length === 1 ? " UTM names" : " UTMs name") + " no campaign here: " + esc(stray.slice(0, 3).join(", ")) + "." : "") + "</p>";
  }
  function metaCampTable(rows, cur, pw) {
    const tr = utmTrace("meta", pw.a, pw.b);
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const kinds = groupBy(x.rows.filter(r => r.kind), r => r.kind)
        .map(y => ({ k: y.k, res: sum(y.rows, "res") })).filter(y => y.res).sort((a, b) => b.res - a.res);
      return Object.assign({ id: x.k, name: last.name, obj: last.obj, cat: metaCat(last.name, last.obj), kinds }, clickStats(x.rows));
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
    ].concat(traceCols(tr)), list, tot) + utmNote(tr, list, "Meta", pw);
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
      return Object.assign({ id: x.k, name: last.name, conv: sum(x.rows, "conv") }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => b.cost - a.cost);
    const tr = utmTrace("gpt", pw.a, pw.b), allF = famStat("ChatGPT", pw.a, pw.b);
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
    traceCols(tr).forEach(c => cols.push(c));
    const note = tracked ? "" : '<div class="panel"><div class="panel-head"><span class="panel-title">'
      + "Conversions: not measured</span></div><div class=\"mko-nm\">"
      + "<p>ChatGPT reports <b>0 conversions</b> every day because no conversion event is attached to "
      + "the campaign in Ads Manager (Set up, under Conversions). That 0 means <b>not measured</b>, not "
      + "that the ads brought nothing, so this panel shows no result figure.</p>"
      + "<p>What the ads brought is read on our side, from the UTM on the lead's website form. The ChatGPT row "
      + "in the Channels table counts every lead filed under ChatGPT, so it also holds visitors from "
      + "chatgpt.com answers: that total is never the ads' result.</p></div></div>";
    const html = head
      + '<div class="rs-kpis" id="mkoK-gpt"></div>' + noCmpHint("ChatGPT Ads", pw)
      + (note ? '<div class="mko-g2"><div id="mkoC-gpt"></div>' + note + "</div>" : '<div id="mkoC-gpt"></div>')
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span></div>'
      + ptable(cols, list, list.length > 1 ? Object.assign({ name: "All campaigns" }, cur) : null) + utmNote(tr, list, "ChatGPT", pw) + "</div>"
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
        { label: "Leads from the ads", value: fmtN(tr.leads), sub: fmtN(allF ? allF.leads : 0) + " ChatGPT leads in all, answers included" },
        { label: "Cost per booking", value: tr.booked && cur.cost ? money0(cur.cost / tr.booked) : "—",
          sub: fmtN(tr.booked) + " booked from the ads, by UTM" },
      ];
      RSC.kpis(host.querySelector("#mkoK-gpt"), k);
      costCard(host.querySelector("#mkoC-gpt"), "gpt", "Spend", pw, rows, cmp, null);
    } };
  }

  /* Reddit Ads (2026-10-23): the account's own figures. The bank's Reddit total is more than this
     account, so the Channels table keeps the bank and this panel says why the two differ. */
  function redditSection(w, cw) {
    const pw = platWin("reddit", w, cw);
    const head = platHead("reddit", "Reddit Ads", "Reddit Ads Manager · GMT days", pw);
    const rows = pw ? inRange(P.reddit, pw.a, pw.b) : [];
    const gate = platGate("Reddit Ads", "reddit", pw, rows);
    // a paused account reads as "nothing here?" (2026-10-26): say when it last spent
    const ran = P.reddit.filter(r => r.cost > 0 && (!pw || r.d < pw.a)).reduce((a, r) => (r.d > a ? r.d : a), "");
    if (gate && ran && /activity in this period/.test(gate)) {
      return { html: head + '<div class="mko-empty">No Reddit Ads spend in this period: the account last spent on '
        + esc(day(ran)) + ". The pull still runs daily, so new spend shows up the day after it happens.</div>" };
    }
    if (gate) return { html: head + gate };
    const cmp = pw.cw ? inRange(P.reddit, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const days = x.rows.map(r => r.d).sort();
      return Object.assign({ id: x.k, name: last.name, from: days[0], to: days[days.length - 1] }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => (a.to < b.to ? 1 : -1));
    const tr = utmTrace("reddit", pw.a, pw.b);
    const cols = [
      { h: "Campaign", name: true, cell: r => esc(r.name) + '<div class="mko-sub">' + esc(shortDay(r.from))
          + (r.to !== r.from ? " – " + esc(shortDay(r.to)) : "") + "</div>" },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "CPM", num: true, tip: "spend per 1,000 impressions", cell: r => cents(r.cpm) },
    ].concat(traceCols(tr));
    const note = '<div class="panel"><div class="panel-head"><span class="panel-title">'
      + "Why the bank shows more</span></div><div class=\"mko-nm\">"
      + "<p>This is the ad account alone. The bank's Reddit total also carries Taktical Digital's "
      + "$3,500 a month (May 2025 – May 2026) and other charges filed under Reddit (Apr – Jul 2026, when "
      + "the account spent nothing), so the Channels table keeps the bank as Reddit's money.</p>"
      + "<p>Conversions read <b>not measured</b>: no Lead event is set up on Reddit's pixel, so its 0 "
      + "does not mean the ads brought nothing. The Reddit row in the Channels table counts the leads "
      + "filed under Reddit.</p></div></div>";
    const html = head
      + '<div class="rs-kpis" id="mkoK-reddit"></div>' + noCmpHint("Reddit Ads", pw)
      + '<div class="mko-g2"><div id="mkoC-reddit"></div>' + note + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">newest first</span></div>'
      + ptable(cols, list, list.length > 1 ? Object.assign({ name: "All campaigns" }, cur) : null) + utmNote(tr, list, "Reddit", pw) + "</div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-reddit"), [
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        kp("Avg CPM", cur.cpm, prev.cpm, cents, true, "spend per 1,000 impressions", pw),
        kp("Spend", cur.cost, prev.cost, money, null, "the ad account only", pw),
        { label: "Conversions", value: '<span class="mko-cov">not measured</span>', sub: "no Lead event set up" },
        (k => Object.assign(k, { sub: k.sub + " · † the bank's Reddit spend" }))(cpbKp("Reddit", pw, "Reddit", "†")),
      ]);
      costCard(host.querySelector("#mkoC-reddit"), "reddit", "Spend", pw, rows, cmp, null);
    } };
  }

  /* LinkedIn (2026-10-28): the ad account's own figures and the Company Page. The bank files LinkedIn
     as not advertising, so the Channels table has no LinkedIn spend and the cost per booking here is
     the account's spend over the bookings filed under LinkedIn (‡). */
  function linkedinSection(w, cw) {
    const pw = platWin("li", w, cw);
    const head = platHead("li", "LinkedIn", "Campaign Manager · UTC days", pw);
    // the Company Page moved to Social & content (2026-10-29); this section is the ads alone
    const page = { html: "", wire: null };
    const rows = pw ? inRange(P.li, pw.a, pw.b) : [];
    const gate = platGate("LinkedIn Ads", "li", pw, rows);
    const ran = P.li.filter(r => r.cost > 0 && (!pw || r.d < pw.a)).reduce((a, r) => (r.d > a ? r.d : a), "");
    if (gate) {
      const msg = ran && /activity in this period/.test(gate)
        ? '<div class="mko-empty">No LinkedIn Ads spend in this period: the account last spent on ' + esc(day(ran))
          + ". The pull still runs daily, so new spend shows up the day after it happens.</div>" : gate;
      return { html: head + msg + page.html, wire: page.wire };
    }
    const cmp = pw.cw ? inRange(P.li, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    const lp = sum(rows, "lp"), lpPrev = cmp ? sum(cmp, "lp") : undefined;
    const tracked = P.li.some(r => r.conv > 0);
    // the lead family is filed "Linkedin" (small i), as the source mart spells it
    const f = famStat(LI_FAM, pw.a, pw.b);
    const cpb = f && f.cBooked && cur.cost ? cur.cost / f.cBooked : null;
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]);
      const days = x.rows.map(r => r.d).sort();
      return Object.assign({ id: x.k, name: last.name, from: days[0], to: days[days.length - 1], lp: sum(x.rows, "lp") },
                           clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => (a.to < b.to ? 1 : -1));
    const cols = [
      { h: "Campaign", name: true, cell: r => esc(r.name) + '<div class="mko-sub">' + esc(shortDay(r.from))
          + (r.to !== r.from ? " – " + esc(shortDay(r.to)) : "") + "</div>" },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "To site", num: true, tip: "landing-page clicks: clicks that reached the website", cell: r => fmtN(r.lp) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "CPM", num: true, tip: "spend per 1,000 impressions", cell: r => cents(r.cpm) },
    ].concat(traceCols(utmTrace("li", pw.a, pw.b)));
    const note = '<div class="panel"><div class="panel-head"><span class="panel-title">'
      + "Why the Channels table has no LinkedIn spend</span></div><div class=\"mko-nm\">"
      + "<p>The bank files LinkedIn under Marketing Related, not advertising, so its charges never reach "
      + "the Channels table. This panel is the ad account alone (opened 2 Jul 2026); its August spend "
      + "ties to the bank's $100.00 charge. The bank's Mar – Jun 2026 LinkedIn charges came before this "
      + "account and are not in it.</p>"
      + "<p>Clicks count every click on an ad (likes, the company name, “see more”); "
      + "<b>to site</b> is the clicks that reached the website.</p></div></div>";
    const sum0 = Object.assign({ name: "All campaigns", lp }, cur);
    const html = head
      + '<div class="rs-kpis" id="mkoK-li"></div>' + noCmpHint("LinkedIn Ads", pw)
      + '<div class="mko-g2"><div id="mkoC-li"></div>' + note + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">newest first</span></div>'
      + ptable(cols, list, list.length > 1 ? sum0 : null) + utmNote(utmTrace("li", pw.a, pw.b), list, LI_FAM, pw) + "</div>" + page.html;
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-li"), [
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("To site", lp, lpPrev, fmtN, false, "clicks that reached the website", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        kp("Avg CPM", cur.cpm, prev.cpm, cents, true, "spend per 1,000 impressions", pw),
        kp("Spend", cur.cost, prev.cost, money, null, "the ad account only", pw),
        tracked ? kp("Leads", sum(rows, "conv"), cmp ? sum(cmp, "conv") : undefined, fmtN, false,
                     "lead forms + website conversions", pw)
          : { label: "Leads", value: '<span class="mko-cov">not measured</span>',
              sub: "no lead form or Insight Tag conversion set up" },
        { label: "Cost per booking", value: cpb != null ? money0(cpb) + "‡" : "—",
          sub: f ? fmtN(f.booked) + " booked of " + fmtN(f.leads) + " LinkedIn leads · ‡ the ad account's spend"
            : "our side" },
      ]);
      costCard(host.querySelector("#mkoC-li"), "li", "Spend", pw, rows, cmp, null);
      if (page.wire) page.wire(host);
    } };
  }
  function tiktokSection(w, cw) {
    const pw = platWin("tt", w, cw);
    const head = platHead("tt", "TikTok", "Ads Manager · the ad account's own days", pw);
    const rows = pw ? inRange(P.tt, pw.a, pw.b) : [];
    const gate = platGate("TikTok Ads", "tt", pw, rows);
    const ran = P.tt.filter(r => r.cost > 0 && (!pw || r.d < pw.a)).reduce((a, r) => (r.d > a ? r.d : a), "");
    if (gate) {
      return { html: head + (ran && /activity in this period/.test(gate)
        ? '<div class="mko-empty">No TikTok spend in this period: the account last spent on ' + esc(day(ran))
          + ". The pull still runs daily, so new spend shows up the day after it happens.</div>" : gate), wire: null };
    }
    const cmp = pw.cw ? inRange(P.tt, pw.cw.a, pw.cw.b) : null;
    const cur = clickStats(rows), prev = cmp ? clickStats(cmp) : {};
    const conv = sum(rows, "conv"), convPrev = cmp ? sum(cmp, "conv") : undefined, tracked = P.tt.some(r => r.conv > 0);
    const f = famStat("TikTok", pw.a, pw.b), cpb = f && f.cBooked && cur.cost ? cur.cost / f.cBooked : null;
    const list = groupBy(rows, r => r.id).map(x => {
      const last = x.rows.reduce((a, r) => (r.d > a.d ? r : a), x.rows[0]), days = x.rows.map(r => r.d).sort();
      return Object.assign({ id: x.k, name: last.name, from: days[0], to: days[days.length - 1], conv: sum(x.rows, "conv"), vv: sum(x.rows, "vv") }, clickStats(x.rows));
    }).filter(x => x.cost || x.imp).sort((a, b) => (a.to < b.to ? 1 : -1));
    const cols = [
      { h: "Campaign", name: true, cell: r => esc(r.name) + '<div class="mko-sub">' + esc(shortDay(r.from)) + (r.to !== r.from ? " – " + esc(shortDay(r.to)) : "") + "</div>" },
      { h: "Spend", num: true, cell: r => money0(r.cost) },
      { h: "Impr.", num: true, tip: "impressions", cell: r => fmtN(r.imp) },
      { h: "Clicks", num: true, cell: r => fmtN(r.clk) },
      { h: "CTR", num: true, cell: r => pct2(r.ctr) },
      { h: "CPC", num: true, cell: r => cents(r.cpc) },
      { h: "CPM", num: true, tip: "spend per 1,000 impressions", cell: r => cents(r.cpm) },
      { h: "Conv.", num: true, tip: "TikTok's conversions", cell: r => (tracked ? fmtN(r.conv) : "—") },
      { h: "CVR", num: true, tip: "conversions ÷ clicks", cell: r => (tracked ? pct2(ratio(r.conv, r.clk)) : "—") },
      { h: "CPA", num: true, tip: "spend ÷ conversions", cell: r => (tracked && r.conv ? cents(r.cost / r.conv) : "—") },
      { h: "Video views", num: true, cell: r => fmtN(r.vv) },
    ].concat(traceCols(utmTrace("tt", pw.a, pw.b)));
    const sum0 = Object.assign({ name: "All campaigns", conv, vv: sum(rows, "vv") }, cur);
    const html = head + '<div class="rs-kpis" id="mkoK-tt"></div>' + noCmpHint("TikTok Ads", pw)
      + '<div id="mkoC-tt"></div><div class="panel"><div class="panel-head"><span class="panel-title">Campaigns</span>'
      + '<span class="mko-sub">newest first</span></div>' + ptable(cols, list, list.length > 1 ? sum0 : null) + utmNote(utmTrace("tt", pw.a, pw.b), list, "TikTok", pw) + "</div>";
    return { html, wire(host) {
      RSC.kpis(host.querySelector("#mkoK-tt"), [
        kp("Impressions", cur.imp, prev.imp, fmtN, false, "", pw),
        kp("Clicks", cur.clk, prev.clk, fmtN, false, "", pw),
        kp("CTR", cur.ctr, prev.ctr, pct2, false, "clicks ÷ impressions", pw),
        kp("Avg CPC", cur.cpc, prev.cpc, cents, true, "spend ÷ clicks", pw),
        kp("Avg CPM", cur.cpm, prev.cpm, cents, true, "spend per 1,000 impressions", pw),
        kp("Spend", cur.cost, prev.cost, money, null, "the ad account only", pw),
        tracked ? kp("Conversions", conv, convPrev, fmtN, false, "CVR " + pct2(ratio(conv, cur.clk)) + (conv ? " · CPA " + cents(cur.cost / conv) : ""), pw)
          : { label: "Conversions", value: '<span class="mko-cov">not measured</span>', sub: "no conversion event set up" },
        { label: "Cost per booking", value: cpb != null ? money0(cpb) + "‡" : "—",
          sub: f ? fmtN(f.booked) + " booked of " + fmtN(f.leads) + " TikTok leads · ‡ the ad account's spend" : "our side" },
      ]);
      costCard(host.querySelector("#mkoC-tt"), "tt", "Spend", pw, rows, cmp, null);
    } };
  }
  /* the Company Page: followers, page views and what its posts reached, for the same period */
  function linkedinPage(w, cw) {
    const pw = platWin("lip", w, cw);
    const head = platHead("lip", "LinkedIn Company Page", "Zip To Zip Moving · organic and boosted posts", pw);
    const rows = pw ? inRange(P.lip, pw.a, pw.b) : [];
    const gate = platGate("LinkedIn Page", "lip", pw, rows.length ? [{ n: 1 }] : []);
    if (gate) return { html: head + gate, wire: null };
    const cmp = pw.cw ? inRange(P.lip, pw.cw.a, pw.cw.b) : null;
    const s = rs => ({ gain: sum(rs, "gain"), views: sum(rs, "views"), imp: sum(rs, "imp"), clk: sum(rs, "clk"),
                       eng: sum(rs, "eng") });
    const cur = s(rows), prev = cmp ? s(cmp) : {};
    const rate = x => (x.imp ? (x.clk + x.eng) / x.imp : null);
    const end = followersAt(pw.b);
    return {
      html: head + '<div class="rs-kpis" id="mkoK-lip"></div>',
      wire(host) {
        RSC.kpis(host.querySelector("#mkoK-lip"), [
          { label: "Followers", value: end == null ? "—" : fmtN(end),
            sub: "at " + day(pw.b) + (end != null ? " · " + (cur.gain >= 0 ? "+" : "") + fmtN(cur.gain) + " in the period" : "") },
          kp("New followers", cur.gain, prev.gain, fmtN, false, "", pw),
          kp("Page views", cur.views, prev.views, fmtN, false, "", pw),
          kp("Post impressions", cur.imp, prev.imp, fmtN, false, "", pw),
          kp("Post clicks", cur.clk, prev.clk, fmtN, false, "", pw),
          kp("Engagement rate", rate(cur), cmp ? rate(prev) : undefined, pct2, false,
             "clicks, reactions, comments and shares ÷ impressions", pw),
        ]);
      },
    };
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
  function drawNow(fn) {
    const was = Chart.defaults.animation;
    Chart.defaults.animation = false;
    try { fn(); } finally { Chart.defaults.animation = was; }
  }
  function platformsSection(w, cw, score) {
    const head = '<p class="rs-hint" id="mkoPlatforms">Each platform\'s own numbers for the period: what it '
      + "charged, what it showed and what it counts as a result, with the metrics your team tracks.</p>";
    if (S.co === "Tuji") {
      return { html: head + '<div class="panel"><div class="mko-nm">Every live ad account here (Google '
        + "Ads, Local Services, Meta, ChatGPT, Reddit, LinkedIn, TikTok) is Zip to Zip's. Tuji has none: its spend reaches us "
        + "through the bank ledger only, in the Overview's channel table. Pick Zip to Zip or Both "
        + "companies to see the platforms.</div></div>", wire() {} };
    }
    const parts = [["ads", "Google Ads", adsSection], ["lsa", "Local Services", lsaSection],
                   ["meta", "Meta", metaSection], ["gpt", "ChatGPT Ads", gptSection],
                   ["reddit", "Reddit Ads", redditSection], ["li", "LinkedIn", linkedinSection], ["tt", "TikTok", tiktokSection]]
      .map(([k, name, fn]) => Object.assign({ k, name }, fn(w, cw)));
    const nav = '<div class="mko-pnav"><span>Jump to:</span>' + parts.map(p =>
      '<button type="button" data-go="mkoP-' + p.k + '">' + esc(p.name) + "</button>").join("") + "</div>";
    const line = k => {
      const r = (score || []).find(x => x.k === k);
      return r ? (r.spend != null ? money0(r.spend) + " spent · " : "") + fmtN(r.leads) + " leads · " + fmtN(r.booked) + " booked" : "";
    };
    return {
      // closed until asked for: 9,400px of detail is one click away, not in the way
      html: head + nav + parts.map(p => '<details class="mko-plat" id="mkoP-' + p.k + '"><summary><b>' + esc(p.name) + "</b><span>"
        + esc(line(p.k)) + "</span><i>Open detail ›</i></summary>" + p.html + "</details>").join(""),
      wire(host) {
        const go = id => {
          const t = host.querySelector("#" + id);
          if (t) { t.open = true; t.scrollIntoView({ block: "start" }); }
        };
        host.querySelectorAll(".mko-pnav [data-go]").forEach(b => { b.onclick = () => go(b.dataset.go); });
        host.querySelectorAll("[data-open]").forEach(b => { b.onclick = () => go(b.dataset.open); });
        // a chart built in a closed box measures nothing: each detail wires on its first opening
        parts.forEach(p => {
          const el = host.querySelector("#mkoP-" + p.k);
          let done = false;
          el.addEventListener("toggle", () => {
            if (el.open && !done) { done = true; if (p.wire) drawNow(() => p.wire(el)); }
          });
        });
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
  // "1–20 Oct 2026", "11 Sep – 10 Oct 2026", "20 Dec 2025 – 10 Jan 2026"
  const dayRange = (a, b) => {
    const x = ymd(a), y = ymd(b);
    if (!x || !y) return "";
    if (x.y !== y.y) return day(a) + " – " + day(b);
    if (x.m !== y.m) return shortDay(a) + " – " + day(b);
    return (x.d === y.d ? "" : x.d + "–") + day(b);
  };
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
  const LI_FAM = "Linkedin";          // mart_source_lead.Family, spelled as the source mapping writes it
  const AD_PLATFORMS = [["ads", "Google Ads", "Google"], ["lsa", "Local Services", "Google Local"],
                        ["meta", "Meta", "Meta"], ["gpt", "ChatGPT Ads", "ChatGPT"], ["reddit", "Reddit Ads", "Reddit"],
                        ["li", "LinkedIn Ads", LI_FAM], ["tt", "TikTok Ads", "TikTok"]];
  // the ad platforms with no connector yet, and the family their leads are filed under
  // (Nextdoor's connector was dropped 2026-10-28: its spend and leads stay in the Channels table)
  const OFF_ADS = {};
  const OFF_KEYS = {};
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
          if (k === "gpt" || k === "reddit" || k === "tt") o.says = P[k].some(r => r.conv > 0) ? fmtN(sum(rows, "conv")) + " conversions" : "not measured";
          if (k === "li") o.says = P.li.some(r => r.conv > 0) ? fmtN(sum(rows, "conv")) + " leads" : "not measured";
        }
      }
      const f = famStat(fam, w.a, w.bEff);
      Object.assign(o, { leads: f ? f.leads : 0, booked: f ? f.booked : 0, cpb: f ? f.cpb : null,
                         thin: !f || f.cBooked < THIN, uncov: !!(f && f.uncov) });
      // LinkedIn has no spend in the Channels table (the bank files it as not advertising): its cost
      // per booking is the ad account's spend over the bookings filed under LinkedIn
      // (TikTok reads the same way, so a month the ledger has not reached still has a figure)
      if (k === "li" || k === "tt") o.cpb = f && f.cBooked && o.spend ? o.spend / f.cBooked : null;
      // ChatGPT's filed leads hold its answers too: the ads' own result is what their UTM traced (Giga)
      if (k === "gpt") {
        const tr = utmTrace("gpt", w.a, w.bEff);
        Object.assign(o, { allLeads: o.leads, allBooked: o.booked, leads: tr.leads, booked: tr.booked,
                           cpb: tr.booked && o.spend ? o.spend / tr.booked : null, thin: tr.booked < THIN });
      }
      // why a card reads the way it does: no spend, or nothing set up to count a result
      const src = k === "lsa" ? P.lsaC : P[k];
      const lastSpend = (src || []).reduce((a, r) => (r.cost > 0 && r.d > a ? r.d : a), "");
      if (o.spend === 0 && lastSpend) o.why = lastSpend < w.a ? "no spend since " + day(lastSpend) : "no spend in this period";
      else if ((k === "li" || k === "gpt" || k === "reddit" || k === "tt") && o.says === "not measured") o.why = "no conversion event set up";
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
      + '<td class="mko-num mko-ours"><b>' + (r.live && r.cpb != null ? money0(r.cpb) + (r.uncov ? "*" : "")
        + (r.k === "reddit" ? "†" : r.k === "li" || r.k === "tt" ? "‡" : "") : "—") + "</b></td></tr>";
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
      + "year, so they stay on the board. * ChatGPT leads include visitors from chatgpt.com answers. "
      + "† Reddit's cost per booking is the Channels table's: the bank's Reddit total, which is more than "
      + "the ad account (an agency fee and other charges). ‡ LinkedIn's is the ad account's spend: the "
      + "bank files LinkedIn as not advertising, so the Channels table has none.</p>";
  }
  // cost per booking, one bar per live platform, cheapest first, coloured against the paid average as
  // the sources table is. The scale stops at twice the average (at least $1,000): one runaway channel
  // must not squash the rest into the left edge
  function cpbBarsHtml(rows, avg) {
    const list = rows.filter(r => r.live && r.cpb != null).sort((a, b) => a.cpb - b.cpb);
    if (!list.length) return '<div class="mko-empty">No platform booked a job in this period.</div>';
    const cap = Math.max(1000, 2 * (avg || 0));
    return list.map(r => {
      const cls = (r.thin ? "thin " : "") + (!avg || r.cpb <= avg ? "" : r.cpb <= 2 * avg ? "mid" : "bad");
      const off = r.cpb > cap;
      return '<div class="mko-hbar"><span>' + esc(r.name) + (r.thin ? '<span class="mko-sub">few bookings</span>' : "")
        + '</span><span class="mko-track"><i class="' + cls + '" style="width:' + (off ? 100 : Math.max(3, Math.round(100 * r.cpb / cap)))
        + '%"></i></span><b>' + money0(r.cpb) + (off ? '<span class="mko-sub">off the scale</span>' : "") + "</b></div>";
    }).join("") + '<p class="rs-hint">Spend ÷ the bookings of leads filed under each platform. Lower is better.'
      + (avg ? " Green at or under the paid average of " + money0(avg) + ", amber up to twice it, raspberry beyond." : "") + "</p>";
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

  /* === THE DASHBOARD LOOK (2026-10-29) ===
     His ask: "beautiful redesign … name it marketing dashboard … smoother … imagine yourself as
     marketer" (mockup approved: "yes i love it"). The numbers are the page's own (aggregate,
     totals, scoreRows, platWin); what changes is the order a marketer reads them in: how are we
     doing (five tiles, each with its last 12 months), what to act on (tagged cards), how the
     year ran (bookings and cost per booking a month), where the bookings came from (one table). */
  const ymAdd = (ym, n) => {
    let y = +ym.slice(0, 4), m = +ym.slice(5, 7) + n;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    return y + "-" + String(m).padStart(2, "0");
  };
  const ymLast = ym => addDays(ymAdd(ym, 1) + "-01", -1);
  const monShort = ym => MON[+ym.slice(5, 7) - 1] + " " + ym.slice(2, 4);
  // the twelve whole months up to the window's end: its own month when the window reaches the
  // month's last day, else the month before (This month's half-month never draws as a collapse)
  function trendMonths(w) {
    const endYm = w.bEff.slice(0, 7);
    const last = addDays(w.bEff, 1).slice(0, 7) !== endYm ? endYm : ymAdd(endYm, -1);
    const out = [];
    for (let i = 11; i >= 0; i--) out.push(ymAdd(last, -i));
    return out;
  }
  // the month still running, when the period reaches into it: drawn as a 13th, outlined bar
  function runningMonth(tm, w) {
    const nx = ymAdd(tm[tm.length - 1], 1);
    return nx <= w.bEff.slice(0, 7) ? nx : null;
  }
  // a month's families, per company pick; cleared when the data is read again (render)
  const TREND = {};
  function monthFams(ym) {
    const k = (S.co || "*") + "|" + ym;
    if (!TREND[k]) TREND[k] = aggregate(ym + "-01", ymLast(ym));
    return TREND[k];
  }
  function sparkHtml(vals, badLast, cls, running) {
    const mx = Math.max.apply(null, vals.concat(running == null ? [] : [running]).map(v => v || 0)) || 1;
    return '<span class="mkd-spark' + (cls ? " " + cls : "") + '" aria-hidden="true">' + vals.map((v, i) =>
      "<i" + (i === vals.length - 1 ? ' class="' + (badLast ? "bad" : "now") + '"' : "")
      + ' style="height:' + Math.max(4, Math.round(100 * (v || 0) / mx)) + '%"></i>').join("")
      + (running == null ? "" : '<i class="part" style="height:' + Math.max(4, Math.round(100 * (running || 0) / mx)) + '%"></i>')
      + "</span>";
  }
  // a change as a chip: good / bad when the direction means something, plain when it does not
  function chipHtml(cur, prev, lowerIsBetter) {
    if (cur == null || prev == null || !prev || isNaN(cur)) return "";
    const d = cur / prev - 1;
    if (Math.abs(d) < 0.005) return '<span class="mkd-chip">± 0%</span>';
    const good = lowerIsBetter == null ? null : lowerIsBetter ? d < 0 : d > 0;
    return '<span class="mkd-chip' + (good == null ? "" : good ? " good" : " bad") + '">' + (d > 0 ? "+" : "−")
      + Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + "%</span>";
  }
  function tileHtml(label, value, chip, sub, spark) {
    return '<div class="mkd-kpi"><div class="l">' + esc(label) + '</div><div class="v"><b>' + value + "</b>"
      + (chip || "") + '</div><div class="s">' + sub + "</div>" + (spark || "") + "</div>";
  }
  const wasWord = () => (S.cmp === "prev" ? "previous period " : "last year ");

  function overviewTiles(w, cw, tm) {
    const fams = aggregate(w.a, w.bEff);
    const cur = totals(fams), prev = cw ? totals(aggregate(cw.a, cw.b, cw)) : null;
    const was = (v, f) => prev ? esc(wasWord() + f(v)) + " · " : "";
    const series = tm.map(m => totals(monthFams(m)));
    const run = runningMonth(tm, w), rt = run ? totals(monthFams(run)) : null;
    const ends = '<div class="mkd-ends"><span>' + esc(monShort(tm[0])) + "</span><span>"
      + esc(run ? MON[+run.slice(5, 7) - 1] + " to date" : monShort(tm[tm.length - 1])) + "</span></div>";
    const spark = (f, bad) => sparkHtml(series.map(f), bad, "", rt ? f(rt) : null) + ends;
    const cpbs = series.map(t => t.cpb || 0);
    // the same rule as the month chart under it, so the spark and the chart never disagree
    const cpbTop = cpbs.length > 1 && cpbs[cpbs.length - 1] > 0 && cpbs[cpbs.length - 1] >= Math.max.apply(null, cpbs);
    // the tile says it in words only when the period IS that month
    const lastYm = tm[tm.length - 1], isLast = w.a === lastYm + "-01" && w.bEff === ymLast(lastYm);
    // nothing to read yet is not $0: the page's own rule
    const notIn = cur.spend === 0 && fams.some(f => f.paid && f.uncov && !f.anyCov);
    const ledger = D.ledgerEnd ? "bank ledger runs through " + day(D.ledgerEnd) : "bank ledger";
    return '<section class="mkd-kpis" aria-label="Headline numbers">'
      + tileHtml("Bookings", fmtN(cur.booked), prev && chipHtml(cur.booked, prev.booked, false),
          was(prev && prev.booked, fmtN) + pct(cur.book) + " of leads booked", spark(t => t.booked))
      + tileHtml("Cost per booking", money0(cur.cpb), notIn ? "" : prev && chipHtml(cur.cpb, prev.cpb, true),
          notIn ? esc(ledger) : was(prev && prev.cpb, money0) + (isLast && cpbTop ? "the highest in 12 months"
            : cur.uncov ? "paid, live channels" : "paid channels, communities included"), spark(t => t.cpb, cpbTop))
      + tileHtml("Booked value per $1", perDollar(cur.roas), notIn ? "" : prev && chipHtml(cur.roas, prev.roas, false),
          notIn ? esc(ledger) : was(prev && prev.roas, perDollar) + "booked value ÷ spend", spark(t => t.roas))
      + tileHtml("Marketing spend", notIn ? "not in yet" : money(cur.spend), notIn ? "" : prev && chipHtml(cur.spend, prev.spend, null),
          notIn ? esc(ledger) : was(prev && prev.spend, money) + (cur.spL && cur.spG ? "live ads + bank ledger"
            : cur.spL ? "live ad accounts; ledger not in yet" : "bank ledger"), spark(t => t.spend))
      + tileHtml("Leads", fmtN(cur.leads), prev && chipHtml(cur.leads, prev.leads, false),
          was(prev && prev.leads, fmtN) + (cur.cpl != null ? money0(cur.cpl) + " a paid lead" : "created in the period"),
          spark(t => t.leads))
      + "</section>";
  }

  /* --- what to act on: the period's checks as tagged cards, the most pressing first ---
     CUT a channel whose bookings cost far more than the rest · SCALE one that books cheaply ·
     FIX something broken or misleading · WATCH a slide · NOTE what the numbers cannot see yet */
  function actions(w, cw, score, fams) {
    const out = [];
    const add = (rank, tag, big, title, why, go) => out.push(Object.assign({ rank, tag, big, title, why }, go || {}));
    const toSrc = f => ({ go: "Open " + f.fam + " in Source Analysis", href: "#page=source-report&src=" + encodeURIComponent(f.fam) });
    const t = totals(fams);
    // a channel whose leads are wider than its ads cannot be judged on them: ChatGPT's "$47 a booking"
    // divided the ads' spend by bookings that came from its answers too
    const paid = fams.filter(f => f.paid && f.spend > 0 && f.anyCov && !COMMUNITY.includes(f.fam) && !FAM_NOTE[f.fam]);
    let cutFam = null;
    if (t.cpb) {
      const cut = paid.filter(f => f.spend >= 1500 && (f.cBooked === 0 || f.cpb >= 3 * t.cpb))
        .sort((a, b) => (b.cpb == null ? 1e12 : b.cpb) - (a.cpb == null ? 1e12 : a.cpb) || b.spend - a.spend)[0];
      if (cut) {
        cutFam = cut.fam;
        add(1, "CUT", cut.cBooked ? money0(cut.cpb) : "0 booked",
          esc(cut.fam) + ": " + money0(cut.spend) + " for " + fmtN(cut.cBooked) + (cut.cBooked === 1 ? " booking" : " bookings"),
          (cut.cBooked ? money0(cut.cpb) + " a booking, " + (cut.cpb / t.cpb).toFixed(1) + " times the paid average of " + money0(t.cpb) + ". " : "")
          + pct(cut.book) + " of its " + fmtN(cut.leads) + " leads booked.", toSrc(cut));
      }
      const scale = paid.filter(f => f.cBooked >= THIN && f.cpb != null && f.cpb <= 0.5 * t.cpb)
        .sort((a, b) => a.cpb - b.cpb)[0];
      if (scale) {
        add(3, "SCALE", money0(scale.cpb), esc(scale.fam) + " books at " + money0(scale.cpb),
          fmtN(scale.cBooked) + " bookings for " + money0(scale.spend) + "; " + pct(scale.book)
          + " of its leads book. The paid average is " + money0(t.cpb) + ".", toSrc(scale));
      }
    }
    if (S.co !== "Tuji") {
      const pw = platWin("ads", w, cw);
      if (pw && !pw.before && !pw.after) {
        const conv = sum(inRange(P.ads, pw.a, pw.b), "conv"), f = famStat("Google", pw.a, pw.b);
        if (f && conv >= 30 && conv >= 1.3 * f.leads) {
          const cv = inRange(P.conv, pw.a, pw.b);
          const yt = sum(cv.filter(r => r.cat === "YOUTUBE_FOLLOW_ON_VIEWS"), "n");
          const lead = sum(cv.filter(r => CONV_LEAD.has(r.cat)), "n");
          add(2, "FIX", yt ? fmtN(yt) + " of " + fmtN(conv) : fmtN(conv), yt ? "Most of Google's conversions are YouTube views"
            : "Google counts more conversions than we get leads",
            "Google Ads counts " + fmtN(conv) + " conversions" + (yt ? "; " + fmtN(yt) + " are YouTube follow-on views and "
              + fmtN(lead) + " are lead forms, calls and quote requests" : "") + ". Moveboard got " + fmtN(f.leads)
            + " Google leads and " + fmtN(f.booked) + " bookings: judge Google on cost per booking.",
            { tab: "paid", go: "See Paid ads" });
        }
      }
      // against the paid average, never against the cheapest channel: ChatGPT's $70 on $700 must not
      // make the channel with a third of the bookings look like a cut (his advisor's catch, 2026-10-30)
      const hi = score.filter(r => r.live && r.cpb != null && !r.thin).sort((a, b) => b.cpb - a.cpb)[0];
      if (hi && t.cpb && hi.spend >= 1500 && hi.fam !== cutFam && hi.cpb >= 1.5 * t.cpb) {
        const x = hi.cpb / t.cpb;
        add(4, x >= 2 ? "CUT" : "WATCH", money0(hi.cpb), esc(hi.name) + " costs " + x.toFixed(1) + " times the paid average",
          money0(hi.cpb) + " a booking on " + money(hi.spend) + " of spend; the paid average is " + money0(t.cpb) + ".",
          { tab: "paid", go: "See Paid ads" });
      }
      // leads Google charged for that never became a Moveboard request (his pick, 2026-10-30)
      const lw = platWin("lsa", w, cw);
      if (lw && !lw.before && !lw.after) {
        const ch = inRange(P.lsaL, lw.a, lw.b).filter(r => r.chg === "Charged");
        const all = sum(ch, "n"), lost = sum(ch.filter(r => r.zs === "Not in Moveboard"), "n");
        if (all >= 20 && lost / all >= 0.3) {
          add(2.5, "FIX", pct(lost / all), "Local Services: " + fmtN(lost) + " charged leads never became a request",
            "Of " + fmtN(all) + " leads Google charged for, " + fmtN(lost) + " have no Moveboard request from the same phone within "
            + LSA_ZIP_DAYS + " days. Dispute them with Google, or chase them in sales.", { tab: "paid", go: "See Paid ads" });
        }
      }
      const gp = score.find(r => r.k === "gpt");
      if (gp && gp.spend > 0 && !P.gpt.some(r => r.conv > 0)) {
        add(9, "NOTE", "", "ChatGPT Ads has no conversion event",
          "It spent " + money0(gp.spend) + " and reports 0 conversions; read its leads and bookings on our side.",
          { tab: "paid", go: "See Paid ads" });
      }
    }
    if (cw) {
      const cur = totals(aggregate(w.a, w.bEff)), prev = totals(aggregate(cw.a, cw.b, cw));
      if (prev.spend > 0 && prev.booked > 0 && cur.spend / prev.spend - 1 >= 0.15 && cur.booked / prev.booked - 1 <= -0.05) {
        // the one finding the CEO must see: first, before any channel's own card
        add(0, "WATCH", upDown(cur.spend / prev.spend - 1).replace(/^up /, "+"),
          "Spend is " + upDown(cur.spend / prev.spend - 1) + " while bookings are " + upDown(cur.booked / prev.booked - 1),
          "On the " + esc(cw.label) + ": " + money(prev.spend) + " to " + money(cur.spend) + " of spend, "
          + fmtN(prev.booked) + " to " + fmtN(cur.booked) + " bookings.", { tab: "paid", go: "See Paid ads" });
      }
    }
    // Search Console, Ahrefs and BrightLocal are Zip to Zip's site: nothing of Tuji's in them
    const gw = S.co === "Tuji" ? null : platWin("gsc", w, cw);
    if (gw && gw.cw && !gw.before && !gw.after) {
      const c = sum(inRange(P.gsc, gw.a, gw.b), "clk"), p = sum(inRange(P.gsc, gw.cw.a, gw.cw.b), "clk");
      if (p > 0 && c / p - 1 <= -0.15) {
        add(6, "WATCH", "−" + Math.round(100 * (1 - c / p)) + "%", "Organic clicks are sliding",
          "Search Console clicks are " + upDown(c / p - 1) + " on the " + esc(gw.cw.label) + ": " + fmtN(p) + " to " + fmtN(c) + ".",
          { tab: "seo", go: "See Search & SEO" });
      }
    }
    if (S.co !== "Tuji" && P.refdom.length) {
      const st = citeStats(w.a, w.bEff);
      if (st.live.length && st.spam.length / st.live.length >= 0.5) {
        add(7, "FIX", fmtN(st.spam.length) + " of " + fmtN(st.live.length), "Most sites linking to us are flagged as spam",
          "Ahrefs flags " + pct(st.spam.length / st.live.length) + " of the sites linking to us. Disavow the network before it costs rankings.",
          { tab: "seo", topic: "links", go: "See Backlinks" });
      }
    }
    if (S.co !== "Tuji") blLatest().forEach(loc => {
      const g = loc.kws.filter(k => k.Google != null);
      if (loc.kws.length && !g.length) {
        add(8, "FIX", "", esc(loc.loc) + " is not in Google's top 100",
          "None of its " + loc.kws.length + " tracked keywords ranks on Google's first ten pages.", { tab: "seo", go: "See Search & SEO" });
      }
    });
    if (D.ledgerEnd && dayCount(D.ledgerEnd, today()) > 40) {
      add(10, "NOTE", "", "The bank ledger needs this month's paste",
        "It runs through " + esc(day(D.ledgerEnd)) + ": Yelp, Angi, postcards and the other ledger channels show no spend after that.",
        { tab: "set", go: "See data sources" });
    }
    return out.sort((a, b) => a.rank - b.rank).slice(0, 5);
  }
  function actionsHtml(list) {
    if (!list.length) return '<div class="mkd-card mkd-quiet">Nothing needs action in this period.</div>';
    return '<div class="mkd-acts">' + list.map(a => {
      const t = a.tag.toLowerCase();
      return '<article class="mkd-act"><div class="t"><span class="mkd-tag ' + t + '">' + a.tag + "</span>"
        + (a.big ? '<span class="big ' + t + '">' + esc(a.big) + "</span>" : "") + "</div>"
        + "<h3>" + a.title + "</h3><p>" + a.why + "</p>"
        + (a.tab ? '<button type="button" class="go" data-tab="' + a.tab + '"' + (a.topic ? ' data-topic-go="' + a.topic + '"' : "") + ">" + esc(a.go) + " ›</button>"
          : a.href ? '<a class="go" href="' + esc(a.href) + '">' + esc(a.go) + " ›</a>" : "")
        + "</article>";
    }).join("") + "</div>";
  }

  /* a month bar chart drawn in HTML: the value over each bar, the latest month in the strong colour */
  function monthBarsHtml(title, sub, subBad, tm, vals, fmt, badLast, run, runVal) {
    const mx = Math.max.apply(null, vals.concat(run ? [runVal] : []).map(v => v || 0)) || 1;
    const bar = (v, cls) => "<div><span>" + (v ? fmt(v) : "—") + '</span><i class="' + cls
      + '" style="height:' + Math.max(2, Math.round(86 * (v || 0) / mx)) + '%"></i></div>';
    return '<div class="mkd-card"><div class="mkd-h"><h2>' + esc(title) + "</h2><span" + (subBad ? ' class="bad"' : "")
      + ">" + esc(sub) + "</span></div>"
      + '<div class="mkd-mb" role="img" aria-label="' + esc(title + ", " + monthWord(tm[0]) + " to " + monthWord(run || tm[tm.length - 1])) + '">'
      + vals.map((v, i) => bar(v, i === vals.length - 1 ? (badLast ? "bad" : "now") : "")).join("") + (run ? bar(runVal, "part") : "")
      + '</div><div class="mkd-ml">' + tm.map(m => "<span>" + esc(MON[+m.slice(5, 7) - 1]) + "</span>").join("")
      + (run ? "<span>" + esc(MON[+run.slice(5, 7) - 1]) + " to date</span>" : "") + "</div></div>";
  }
  function trendCharts(tm, run) {
    const series = tm.map(m => totals(monthFams(m))), rt = run ? totals(monthFams(run)) : null;
    const bk = series.map(t => t.booked), cp = series.map(t => t.cpb || 0);
    const peak = bk.indexOf(Math.max.apply(null, bk));
    const cpTop = cp.length > 1 && cp[cp.length - 1] > 0 && cp[cp.length - 1] >= Math.max.apply(null, cp);
    const lowI = cp.reduce((b, v, i) => (v > 0 && (cp[b] <= 0 || v < cp[b]) ? i : b), 0);
    return '<div class="mkd-g2">'
      + monthBarsHtml("Bookings a month", "peak " + fmtN(bk[peak]) + " in " + monthWord(tm[peak]), false, tm, bk, fmtN, false, run, rt && rt.booked)
      + monthBarsHtml("Cost per booking", cpTop && rt && rt.cpb > cp[cp.length - 1]
          ? monthWord(tm[tm.length - 1]) + " is the highest whole month; " + MON[+run.slice(5, 7) - 1] + " is running at " + money0(rt.cpb)
          : cpTop ? monthWord(tm[tm.length - 1]) + " is the highest in 12 months"
          : "lowest " + money0(cp[lowI]) + " in " + monthWord(tm[lowI]), cpTop, tm, cp, money0, cpTop, run, rt && (rt.cpb || 0))
      + "</div>";
  }

  /* --- where bookings came from: one row a source, its cost per booking as a bar, its year as a spark --- */
  function srcRows(list, label, sortKey, totLabel, tm, avg) {
    if (!list.length) return "";
    list.sort((x, y) => (y[sortKey] - x[sortKey]) || (y.leads - x.leads));
    const t = totals(list);
    const bar = (v, f) => {
      if (v == null) return costCell(v, f, money0, false);
      const cls = !avg || v <= avg ? "" : v <= 2 * avg ? "mid" : "hi";
      return '<div class="mkd-cpb"><span class="tr" aria-hidden="true"><i class="' + cls + '" style="width:'
        + Math.max(3, Math.min(100, Math.round(100 * v / Math.max(1000, 2 * (avg || 0))))) + '%"></i></span><b>'
        + costCell(v, f, money0, f.cBooked < THIN) + "</b></div>";
    };
    let h = '<tr class="grp"><td colspan="8">' + esc(label) + " · " + list.length + (list.length === 1 ? " source" : " sources") + "</td></tr>";
    // ledger channels with nothing in yet and no booking: one line, opened on a click
    const quiet = list.filter(f => f.paid && f.uncov && !f.anyCov && !f.booked);
    const fold = quiet.length >= 3 ? new Set(quiet) : null;
    if (fold) list = list.filter(f => !fold.has(f)).concat(quiet);
    let folded = false;
    list.forEach(f => {
      const sp = tm.map(m => { const x = monthFams(m).find(y => y.fam === f.fam); return x ? x.booked : 0; });
      const hide = !!fold && fold.has(f);
      if (hide && !folded) {
        folded = true;
        h += '<tr class="mkd-fold" tabindex="0" role="button" aria-expanded="false"><td colspan="8"><span class="rs-caret">›</span> '
          + fmtN(quiet.length) + " more ledger channels, 0 bookings</td></tr>";
      }
      h += "<tr" + (hide ? ' class="mkd-folded" hidden' : "") + '><td class="mko-fam">' + famCell(f) + "</td>"
        + '<td class="n">' + spendCell(f) + "</td>"
        + '<td class="n">' + fmtN(f.leads) + "</td>"
        + '<td class="n"><b>' + fmtN(f.booked) + "</b></td>"
        + '<td class="n">' + pct(f.book) + "</td>"
        + "<td>" + (f.paid ? bar(f.cpb, f) : '<span class="mko-sub">free</span>') + "</td>"
        + '<td class="n">' + (f.paid ? costCell(f.roas, f, perDollar, f.cBooked < THIN) : '<span class="mko-sub">—</span>') + "</td>"
        + "<td>" + (sp.some(v => v) ? sparkHtml(sp, false, "sm") : '<span class="mko-sub">—</span>') + "</td></tr>";
    });
    const paid = list.some(f => f.paid);
    h += '<tr class="tot"><td>' + esc(totLabel || "All " + label.toLowerCase()) + "</td>"
      + '<td class="n">' + (!paid ? "—" : list.filter(f => f.paid).some(f => f.anyCov) ? money0(t.spend) : '<span class="mko-cov">not in yet</span>') + "</td>"
      + '<td class="n">' + fmtN(t.leads) + "</td>"
      + '<td class="n">' + fmtN(t.booked) + (paid && t.pBooked < t.booked
        ? '<div class="mko-sub">' + fmtN(t.pBooked) + " with spend in</div>" : "") + "</td>"
      + '<td class="n">' + pct(t.book) + "</td>"
      + '<td class="n" title="' + (paid ? "spend ÷ the " + fmtN(t.pBooked) + " bookings of channels whose spend is in" : "") + '">'
      + (paid ? costCell(t.cpb, t, money0, false) : "—") + "</td>"
      + '<td class="n">' + (paid ? costCell(t.roas, t, perDollar, false) : "—") + "</td><td></td></tr>";
    return h;
  }
  function sourcesTableHtml(fams, tm) {
    if (!fams.length) return '<div class="mkd-card mkd-quiet">No leads or spend in this period for this company.</div>';
    const isCom = f => COMMUNITY.includes(f.fam);
    const avg = totals(fams).cpb;
    return '<div class="rs-tablewrap"><table class="mkd-src"><thead><tr>'
      + '<th scope="col">Source</th><th scope="col" class="n">Spend</th>'
      + '<th scope="col" class="n" title="leads created in the period">Leads</th>'
      + '<th scope="col" class="n" title="of those leads, how many booked (Confirmed)">Booked</th>'
      + '<th scope="col" class="n" title="booked ÷ leads">Booking rate</th>'
      + '<th scope="col" title="spend ÷ booked jobs; green at or under the paid average, amber up to twice it, red beyond">Cost per booking</th>'
      + '<th scope="col" class="n" title="booked value ÷ spend">Value per $1</th>'
      + '<th scope="col" title="bookings a month, ' + esc(monthWord(tm[0]) + " to " + monthWord(tm[tm.length - 1])) + '">Bookings, 12 months</th>'
      + "</tr></thead><tbody>"
      + srcRows(fams.filter(f => f.paid && !isCom(f)), "Paid", "spend", null, tm, avg)
      + srcRows(fams.filter(isCom), "AI assistants and communities", "leads", "All AI assistants and communities", tm, avg)
      + srcRows(fams.filter(f => !f.paid && !isCom(f)), "Unpaid", "leads", null, tm, avg)
      + "</tbody></table></div>";
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
    const tm = trendMonths(w);
    const past = D.ledgerEnd && w.bEff > D.ledgerEnd;
    const notes = [];
    if (fams.some(f => f.paid && f.uncov)) {
      notes.push("The bank ledger runs through " + day(D.ledgerEnd) + ": for later days the cost figures count only the "
        + "channels with live spend (Google Ads, Local Services, Meta, ChatGPT)" + (cw ? ", in both periods" : "") + ".");
    }
    if (cw) notes.push("The " + cw.label + "'s bookings are counted as they stood on " + day(cw.asOf)
      + ", so a young cohort is not set against one that had longer to book.");
    const html = overviewTiles(w, cw, tm)
      + (notes.length ? '<p class="rs-hint">' + esc(notes.join(" ")) + "</p>" : "")
      + '<section class="mkd-sec" aria-labelledby="mkdActH"><div class="mkd-h"><h2 id="mkdActH">What to act on</h2>'
      + "<span>read from this period's numbers; each card opens the place to fix it</span></div>"
      + actionsHtml(actions(w, cw, score, fams)) + "</section>"
      + trendCharts(tm, runningMonth(tm, w))
      + '<section class="mkd-card" aria-labelledby="mkdSrcH"><div class="mkd-h"><h2 id="mkdSrcH">Where bookings came from</h2>'
      + "<span>leads created in the period and how many booked · click a source to open it in Source Analysis</span></div>"
      + sourcesTableHtml(fams, tm)
      + '<p class="rs-hint">Spend is live from Google Ads, Local Services, Meta and ChatGPT; every other channel is the bank ledger'
      + (D.ledgerEnd ? ", which runs through " + esc(day(D.ledgerEnd)) : "")
      + (past ? "; a * marks a cost read on the leads whose spend is in" : "")
      + ". Booked value is the bill where the move happened, the quote where it is still to come.</p></section>";
    return { html, wire(host) {
      const line = host.querySelector(".mkd-fold");
      if (!line) return;
      const flip = () => {
        const open = line.getAttribute("aria-expanded") !== "true";
        line.setAttribute("aria-expanded", String(open));
        line.classList.toggle("on", open);
        host.querySelectorAll(".mkd-folded").forEach(r => { r.hidden = !open; });
      };
      line.onclick = flip;
      line.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); flip(); } };
    } };
  }

  /* === PAID ADS === */
  function offCardsHtml(w) {
    const rows = D.conn.filter(r => OFF_ADS[r.Key] && r.Connection === "Not connected");
    return rows.map(r => {
      const f = S.co === "Tuji" ? null : famStat(OFF_ADS[r.Key], w.a, w.bEff);
      const st = OFF_KEYS[r.Key] || "waiting";
      return '<article class="mkd-plat off"><div class="hd"><div><div class="nm"><h3>' + esc(r.Platform) + "</h3>"
        + '<span class="mkd-chip">' + esc(st) + "</span></div>"
        + '<div class="mko-sub">' + esc(r.Metrics || "") + "</div></div></div>"
        + "<p>Bank " + esc(r["Bank Year"] || "") + ": <b>" + (r["Bank Spend"] != null ? money0(+r["Bank Spend"]) : "—") + "</b>"
        + (f && f.leads ? " · " + fmtN(f.leads) + " leads filed under it in the period" : "") + "."
        + (r["Next Step"] ? " Next: " + esc(r["Next Step"]) : "") + "</p></article>";
    }).join("");
  }
  /* the mockup's card: where Google's money went, Search against YouTube */
  function googleSplitCard(w) {
    const pw = platWin("ads", w, null);
    if (!pw || pw.before || pw.after || !P.net.length) return "";
    const tmap = {};
    P.ads.forEach(r => { tmap[String(r.id)] = r.type; });
    const all = adsNetSplit(inRange(P.net, pw.a, pw.b), inRange(P.netc, pw.a, pw.b), id => tmap[id] || (P.camp[id] || {}).type || "");
    const tc = sum(all, "cost");
    if (!tc) return "";
    const seg = (x, c) => (x.cost > 0 ? '<i class="' + c + '" style="width:' + (100 * x.cost / tc).toFixed(1) + '%"></i>' : "");
    const box = x => '<div class="mkd-nb"><span>' + esc(x.k) + " · " + pct(x.cost / tc) + "</span><b>" + money0(x.cost) + "</b><em>" + fmtN(x.lead)
      + (x.lead === 1 ? " lead" : " leads") + (x.lead >= 0.5 ? " · " + money0(x.cost / x.lead) + " each" : "") + "</em></div>";
    const [s, y, o] = all;
    return '<div class="mkd-card"><div class="mkd-h"><h2>Google Ads: where the money went</h2><span>by network; leads are Google\'s lead conversions</span></div>'
      + '<div class="mkd-split" role="img" aria-label="Search ' + pct(s.cost / tc) + ", YouTube " + pct(y.cost / tc) + '">'
      + seg(s, "s") + seg(y, "y") + seg(o, "o") + '</div><div class="mkd-nets">' + box(s) + box(y) + (o.cost >= 1 ? box(o) : "") + "</div>"
      + (y.cost > s.cost && y.lead < s.lead ? '<p class="rs-hint">Most of the money shows ads on YouTube; most of the leads come from Search.</p>' : "") + "</div>";
  }
  function platCardHtml(r, avg) {
    const dash = "—";
    const tone = r.cpb == null ? "" : !avg || r.cpb <= avg ? " good" : r.cpb <= 2 * avg ? " mid" : " bad";
    const stat = (l, v) => "<div><span>" + l + "</span><b>" + v + "</b></div>";
    return '<article class="mkd-plat"><div class="hd"><div><div class="nm"><h3>' + esc(r.name) + '</h3><span class="mkd-chip good">live</span></div>'
      + '<div class="mko-sub">Platform says: ' + esc(r.says) + "</div>"
      + (r.why ? '<div class="why">' + esc(r.why) + "</div>" : "") + "</div>"
      + '<div class="sp"><b>' + (r.spend != null ? money0(r.spend) : dash) + "</b><span>spent</span></div></div>"
      + '<div class="mkd-stats">' + stat("Impressions", r.imp != null ? compact(r.imp) : dash) + stat("Clicks", r.clk != null ? fmtN(r.clk) : dash)
      + stat("CTR", pct2(r.ctr)) + stat("CPC", cents(r.cpc)) + "</div>"
      + (r.allLeads != null ? '<div class="why">' + fmtN(r.allLeads) + " ChatGPT leads in all, " + fmtN(r.allBooked) + " booked: answers and ads together</div>" : "")
      + '<div class="ours"><span><b>' + fmtN(r.leads) + (r.allLeads == null && FAM_NOTE[r.fam] ? "*" : "") + "</b> " + (r.allLeads != null ? "leads from the ads" : "leads") + "</span>"
      + '<span aria-hidden="true">→</span><span><b>' + fmtN(r.booked) + "</b> booked</span>"
      + '<span class="mkd-chip c' + tone + '">' + (r.cpb != null ? money0(r.cpb) + (r.uncov ? "*" : "")
        + (r.k === "reddit" ? "†" : r.k === "li" || r.k === "tt" ? "‡" : "") + " a booking" : "no bookings") + "</span></div>"
      + '<button type="button" class="go" data-open="mkoP-' + r.k + '">Open detail ›</button></article>';
  }
  function paidTab(w, cw) {
    if (S.co === "Tuji") {
      const plat = platformsSection(w, cw);
      return { html: plat.html, wire: plat.wire };
    }
    const score = scoreRows(w), live = score.filter(r => r.live);
    // one number per concept per period: the Overview's own totals, never a second sum of the ad
    // accounts ($39.6k and $400 here against $39.3k and $397 there, until 2026-10-30)
    const t = totals(aggregate(w.a, w.bEff));
    const spend = t.spend, leads = sum(live, "leads"), booked = t.pBooked;
    const avg = t.cpb;
    const g = live.find(r => r.k === "ads");
    const gConv = g ? (String(g.says).match(/^[\d,]+/) || [""])[0] : "";
    const plat = platformsSection(w, cw, score);
    const li = live.find(r => r.k === "li");
    const html = '<section class="mkd-kpis" aria-label="Paid ads in total">'
      + tileHtml("Paid spend", money(spend), "", t.spG ? "the " + live.length + " ad accounts + ledger channels: Yelp, Angi, postcards"
          : live.length + " live ad accounts; ledger not in yet")
      + tileHtml("Leads from the " + live.length + " ad accounts", fmtN(leads), "", "our Moveboard leads, not platform counts")
      + tileHtml("Booked", fmtN(booked), "", pct(ratio(t.pBooked, t.pLeads)) + " of " + fmtN(t.pLeads) + " leads on channels with spend in")
      + tileHtml("Cost per booking", money0(avg), "", t.uncov ? "paid, live channels" : "paid channels, communities included")
      + (g ? tileHtml("Google says vs we booked", (gConv || "—") + " vs " + fmtN(g.booked), "",
          "Google Ads conversions against our Google bookings") : "")
      + "</section>"
      + '<div class="mkd-g2"><div class="mkd-card"><div class="mkd-h"><h2>Cost per booking, by platform</h2><span>our bookings from each platform\'s leads; lower is better</span></div>'
      + cpbBarsHtml(score, avg) + "</div>" + googleSplitCard(w) + "</div>"
      + '<section class="mkd-sec" aria-labelledby="mkdPlatH"><div class="mkd-h"><h2 id="mkdPlatH">Every platform</h2>'
      + "<span>what each platform reports, next to what we booked from it</span></div>"
      + '<div class="mkd-plats">' + live.map(r => platCardHtml(r, avg)).join("") + offCardsHtml(w) + "</div>"
      + '<p class="rs-hint">* ChatGPT leads include visitors from chatgpt.com answers. † Reddit\'s cost per booking is the '
      + "Channels table's: the bank's Reddit total, which is more than the ad account. ‡ TikTok's is the ad account's spend, "
      + "and so is LinkedIn's: the bank files LinkedIn as not advertising"
      + (li && li.spend ? ", so its " + money0(li.spend) + " is not in the Paid spend above" : "") + ".</p></section>"
      + '<section class="mkd-sec" aria-labelledby="mkdDetH"><div class="mkd-h"><h2 id="mkdDetH">Platform detail</h2>'
      + "<span>each account's campaigns, charts and results</span></div>" + plat.html + "</section>";
    return { html, wire: plat.wire };
  }

  /* === SOCIAL AND CONTENT (2026-10-29) === our own pages and posts, outside the ads */
  /* === FACEBOOK AND INSTAGRAM, ORGANIC TEAM AGAINST PAID TEAM (2026-10-30, src/meta_page.py) ===
     He: "we have employees who take care of paid and who take care of organic and we want to see who
     did what." Two totals and every post, no personal names. What the numbers obey:
       * The list holds what the team did IN THE PERIOD: posts published in it, and ads that ran in it.
         A post boosted now but published earlier shows its paid side only, so the rows add up to the
         tiles. A post's organic numbers are its total to date; an ad's numbers are inside the period.
       * 81% of the spend runs on ad-only creatives, so they are rows of their own, grouped by the ad's
         post: several ads on one creative are one row.
       * Meta splits only VIEWS on a boosted Facebook post, so its organic reach, clicks and engagement
         are its total x its organic share of views, marked ≈. Subtracting the ads does not work.
       * Reach is people: totals add up each row's reach, and say so. An ad's reach in a period is the
         lesser of its daily reach added up and its reach over 13 months.
       * Engagement is reactions + comments + shares + saves on both sides, so they compare: Meta's own
         post_engagement also holds 3-second video plays. Rate = engagement ÷ reach.
       * Instagram gives a post no clicks, so its organic side shows profile visits (Reels: neither). */
  const MK = { net: "Facebook", show: "", sort: "new", asc: false, all: false,
               team: "org", met: "reach", dir: "top", n: 5, fmt: "", kind: "" };
  /* Rank by anything (Elene and Tornike, 2026-10-30): top or bottom X of a team on any metric, by
     format and kind. The ranking panel and the list's column heads read the same value. The bottom
     of a list needs guards the top does not: a post from yesterday is low only because it is new,
     and a test ad that spent cents is not a result. */
  const META_MET = { reach: "Reach", views: "Views", act: "Clicks", eng: "Engagement", rate: "Engagement rate",
                     cost: "Spend", cpc: "Cost per click", cpm: "Cost per 1,000 views" };
  const META_PAID_ONLY = ["cost", "cpc", "cpm"];
  const META_MIN_REACH = 100;      // under this a rate is a handful of people: 2 likes on 5 reached reads 40%
  const META_MIN_SPEND = 5, META_SETTLE = 3;
  function metaVal(r, team, m) {
    const x = team === "paid" ? r.paid : r.org;
    if (!x) return null;
    if (m === "rate") return x.reach >= META_MIN_REACH ? x.eng / x.reach : null;
    if (m === "cpc") return x.clk ? x.cost / x.clk : null;
    if (m === "cpm") return x.imp ? 1000 * x.cost / x.imp : null;
    if (team === "paid" && m === "reach") return x.reach || null;     // past 13 months Meta keeps none
    return team === "paid" ? x[{ views: "imp", act: "clk" }[m] || m] : x[m];
  }
  function metaRank(rows, o, settled) {
    const low = o.dir === "bottom";
    return rows.map(r => ({ r, v: metaVal(r, o.team, o.met) }))
      .filter(x => x.v != null && (low || x.v > 0) && (!o.fmt || x.r.fmt === o.fmt) && (!o.kind || x.r.kind === o.kind)
        && (!low || (o.team === "paid" ? x.r.paid.cost >= META_MIN_SPEND : x.r.d <= settled)))
      .sort((a, b) => (low ? a.v - b.v : b.v - a.v)).slice(0, o.n);
  }
  function metaList(rows) {
    const [team, met] = MK.sort.split(":"), sign = MK.asc ? 1 : -1;
    const key = MK.sort === "new" ? r => r.d : r => metaVal(r, team, met);
    return rows.filter(r => !MK.show || r.kind === MK.show).sort((a, b) => {
      const x = key(a), y = key(b);
      if (x == null || y == null) return x == null ? (y == null ? 0 : 1) : -1;   // an empty cell sorts last either way
      return x < y ? -sign : x > y ? sign : 0;
    });
  }
  const META_SHOW = { Organic: "Organic posts", Boosted: "Boosted posts", "Ad only": "Ad-only creatives" };
  function indexMeta(t) {
    P.mpost = (t.mpost || []).map(r => ({ id: r["Post Id"], net: r.Platform, d: d10(r.Date), fmt: r.Format || "", text: r.Text || "",
      link: r.Link || "", views: num(r.Views), orgV: num(r["Organic Views"]), paidV: num(r["Paid Views"]), reach: num(r.Reach),
      clk: num(r.Clicks), pv: num(r["Profile Visits"]),
      eng: num(r.Reactions) + num(r.Comments) + num(r.Shares) + num(r.Saves) })).filter(r => r.d);
    P.mad = {};
    (t.mad || []).forEach(r => { P.mad[r["Ad Id"]] = { name: r["Ad Name"] || "", camp: r.Campaign || "", story: r["Story Id"] || "",
      media: r["Media Id"] || "", text: r.Text || "" }; });
    P.mlife = {};
    (t.mlife || []).forEach(r => { if (r.Reach != null && r.Reach !== "") P.mlife[r["Ad Id"] + "|" + r.Platform] = num(r.Reach); });
    indexPlat("mpd", t.mpd, r => ({ d: d10(r.Date), ad: r["Ad Id"], plat: r.Platform, cost: num(r.Spend), imp: num(r.Impressions),
      reach: r.Reach == null || r.Reach === "" ? null : num(r.Reach), clk: num(r.Clicks), lead: num(r.Leads),
      eng: num(r.Reactions) + num(r.Comments) + num(r.Shares) + num(r.Saves) }));
    indexPlat("msoc", t.msoc, r => ({ d: d10(r.Date), net: r.Platform, views: num(r.Views), orgV: num(r["Organic Views"]),
      paidV: num(r["Paid Views"]), orgR: num(r["Organic Reach"]), paidR: num(r["Paid Reach"]), gain: num(r["New Followers"]),
      fol: r.Followers == null || r.Followers === "" ? null : num(r.Followers), pv: num(r["Page Views"]) }));
  }
  function metaPaid(net, a, b) {
    const plat = net.toLowerCase(), byAd = {}, other = {};
    P.mpd.forEach(r => {
      if (r.d < a || r.d > b) return;
      if (r.plat !== "facebook" && r.plat !== "instagram") { other[r.plat] = (other[r.plat] || 0) + r.cost; return; }
      if (r.plat !== plat) return;
      const x = byAd[r.ad] = byAd[r.ad] || { cost: 0, imp: 0, days: 0, hasR: false, clk: 0, eng: 0, lead: 0, first: r.d };
      x.cost += r.cost; x.imp += r.imp; x.clk += r.clk; x.eng += r.eng; x.lead += r.lead;
      if (r.reach != null) { x.days += r.reach; x.hasR = true; }
      if (r.d < x.first) x.first = r.d;
    });
    const groups = {};
    Object.keys(byAd).forEach(id => {
      const x = byAd[id], info = P.mad[id] || {}, life = P.mlife[id + "|" + plat];
      const reach = !x.hasR ? 0 : life != null ? Math.min(x.days, life) : x.days;
      const key = (net === "Instagram" ? info.media : info.story) || info.story || "ad:" + id;
      const g = groups[key] = groups[key] || { ads: 0, cost: 0, imp: 0, reach: 0, clk: 0, eng: 0, lead: 0, first: x.first, text: "", name: "" };
      g.ads++; g.cost += x.cost; g.imp += x.imp; g.reach += reach; g.clk += x.clk; g.eng += x.eng; g.lead += x.lead;
      if (x.first < g.first) g.first = x.first;
      g.text = g.text || info.text; g.name = g.name || info.name;
    });
    return { groups, other };
  }
  function metaRows(net, a, b) {
    const { groups, other } = metaPaid(net, a, b), rows = [], seen = {};
    P.mpost.forEach(p => {
      if (p.net !== net) return;
      const paid = groups[p.id], inP = p.d >= a && p.d <= b;
      if (!paid && !inP) return;
      seen[p.id] = 1;
      const share = p.paidV > 0 && p.views ? p.orgV / p.views : 1;
      rows.push({ d: p.d, fmt: p.fmt, text: p.text, link: p.link, kind: paid ? "Boosted" : "Organic", paid: paid || null,
        org: inP ? { views: p.orgV, reach: p.reach * share, act: (net === "Instagram" ? p.pv : p.clk) * share, eng: p.eng * share, approx: share < 1 } : null });
    });
    Object.keys(groups).forEach(k => {
      if (seen[k]) return;
      const g = groups[k];
      rows.push({ d: g.first, fmt: "", text: g.text || g.name || "(no text)", link: "", kind: "Ad only", paid: g, org: null });
    });
    return { rows, other };
  }
  function metaSum(rows) {
    const t = { posts: 0, views: 0, reach: 0, act: 0, eng: 0, ads: 0, cost: 0, imp: 0, pReach: 0, clk: 0, pEng: 0, lead: 0 };
    rows.forEach(r => {
      if (r.org) { t.posts++; t.views += r.org.views; t.reach += r.org.reach; t.act += r.org.act; t.eng += r.org.eng; }
      if (r.paid) { t.ads += r.paid.ads; t.cost += r.paid.cost; t.imp += r.paid.imp; t.pReach += r.paid.reach; t.clk += r.paid.clk; t.pEng += r.paid.eng; t.lead += r.paid.lead; }
    });
    return t;
  }
  function metaTable(rows, net, tot) {
    const list = metaList(rows);
    const shown = MK.all ? list : list.slice(0, 40);
    const ap = o => (o.approx ? "≈ " : "");
    const th = (label, sort, cls) => '<th class="' + (cls == null ? "mko-num" : cls) + '"><button type="button" class="mkd-thb' + (MK.sort === sort ? " on" : "")
      + '" data-sort="' + sort + '">' + esc(label) + (MK.sort === sort ? (MK.asc ? " ▲" : " ▼") : "") + "</button></th>";
    const cells = (o, p) => (o ? '<td class="mko-num sep">' + fmtN(o.views) + '</td><td class="mko-num">' + ap(o) + fmtN(o.reach) + '</td><td class="mko-num">'
        + (o.act ? ap(o) + fmtN(o.act) : "—") + '</td><td class="mko-num">' + ap(o) + fmtN(o.eng) + '</td><td class="mko-num">' + pct2(ratio(o.eng, o.reach)) + "</td>"
      : '<td class="mko-num sep">—</td><td class="mko-num">—</td><td class="mko-num">—</td><td class="mko-num">—</td><td class="mko-num">—</td>')
      + (p ? '<td class="mko-num sep"><b>' + money0(p.cost) + '</b></td><td class="mko-num">' + fmtN(p.imp) + '</td><td class="mko-num">' + (p.reach ? fmtN(p.reach) : "—")
        + '</td><td class="mko-num">' + fmtN(p.clk) + '</td><td class="mko-num">' + fmtN(p.eng) + '</td><td class="mko-num">' + pct2(ratio(p.eng, p.reach)) + "</td>"
      : '<td class="mko-num sep">—</td><td class="mko-num">—</td><td class="mko-num">—</td><td class="mko-num">—</td><td class="mko-num">—</td><td class="mko-num">—</td>');
    const pillOf = { Organic: "ok", Boosted: "info", "Ad only": "warn" };
    const row = r => {
      const words = r.text.length > 90 ? r.text.slice(0, 88) + "…" : r.text;
      return '<tr><td class="mkd-post">' + (r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener">' + esc(words) + "</a>" : esc(words))
        + '<span class="mko-sub">' + pill(r.kind, pillOf[r.kind]) + " " + esc([r.fmt, day(r.d)].filter(Boolean).join(" · "))
        + (r.paid && r.paid.ads > 1 ? " · " + r.paid.ads + " ads" : "") + "</span></td>" + cells(r.org, r.paid) + "</tr>";
    };
    return '<div class="rs-tablewrap mkd-scroll"><table class="rs-table mko-pt mkd-mt"><thead><tr><th></th><th class="sep grp" colspan="5">Organic team</th><th class="sep grp" colspan="6">Paid team</th></tr>'
      + "<tr>" + th(MK.sort !== "new" ? "Post" : MK.asc ? "Post, oldest first" : "Post, newest first", "new", "") + th("Views", "org:views", "mko-num sep") + th("Reach", "org:reach")
      + th(net === "Instagram" ? "Profile visits" : "Clicks", "org:act") + th("Engagement", "org:eng") + th("Rate", "org:rate")
      + th("Spend", "paid:cost", "mko-num sep") + th("Views", "paid:views") + th("Reach", "paid:reach") + th("Clicks", "paid:act")
      + th("Engagement", "paid:eng") + th("Rate", "paid:rate") + "</tr></thead><tbody>"
      + (shown.length ? shown.map(row).join("") : '<tr><td colspan="12" class="mko-sub">Nothing in this period.</td></tr>')
      + '<tr class="mko-tot"><td>All ' + fmtN(rows.length) + " rows, reach added up</td>"
      + cells({ views: tot.views, reach: tot.reach, act: tot.act, eng: tot.eng }, { cost: tot.cost, imp: tot.imp, reach: tot.pReach, clk: tot.clk, eng: tot.pEng })
      + "</tr></tbody></table></div>"
      + (list.length > 40 ? '<button type="button" class="rs-btn" id="mkoMtAll">' + (MK.all ? "Show the first 40" : "Show all " + fmtN(list.length)) + "</button>" : "");
  }
  function metaPaint(box, w, cw) {
    if (window.Chart) Object.values(Chart.instances || {}).forEach(ch => { if (ch.canvas && box.contains(ch.canvas)) ch.destroy(); });
    const pw = platWin("msoc", w, cw), any = P.mpost.length ? [{ n: 1 }] : [];
    const gate = P.err.mpost ? platGate("Facebook and Instagram", "mpost", pw, any) : platGate("Facebook and Instagram", "msoc", pw, any);
    if (gate) { box.innerHTML = gate; return; }
    const net = MK.net, { rows, other } = metaRows(net, pw.a, pw.b), cur = metaSum(rows);
    const prev = pw.cw ? metaSum(metaRows(net, pw.cw.a, pw.cw.b).rows) : null;
    const days = P.msoc.filter(r => r.net === net && r.d >= pw.a && r.d <= pw.b);
    const was = k => (prev ? prev[k] : null), rate = (e, r) => ratio(e, r), late = net === "Instagram" && days.length && days[0].d > pw.a;
    const box6 = (l, v, chip, s) => '<div class="mkd-nb"><span>' + esc(l) + "</span><b>" + v + (chip || "") + "</b>" + (s ? "<em>" + esc(s) + "</em>" : "") + "</div>";
    const orgV = sum(days, "orgV"), paidV = sum(days, "paidV"), gain = sum(days, "gain");
    const fol = P.msoc.filter(r => r.net === net && r.fol != null && r.d <= pw.b).reduce((a, r) => (!a || r.d > a.d ? r : a), null);
    const otherKeys = Object.keys(other).filter(k => other[k] >= 1), otherSum = otherKeys.reduce((a, k) => a + other[k], 0);
    box.innerHTML = platHead("msoc", "Facebook and Instagram", "Organic team against Paid team · posts published and ads run in the period", pw)
      + '<div class="mko-topics" id="mkoMtNet">' + ["Facebook", "Instagram"].map(k => '<button type="button" data-net="' + k + '" class="' + (k === net ? "on" : "") + '">' + k + "</button>").join("") + "</div>"
      + '<div class="mkd-teams">'
      + '<section class="mkd-team"><h3>Organic team</h3><p>' + fmtN(cur.posts) + " posts published · each post's numbers to date</p><div class=\"mkd-tstats\">"
      + box6("Views", compact(cur.views), chipHtml(cur.views, was("views"), false))
      + box6("Reach", compact(cur.reach), chipHtml(cur.reach, was("reach"), false), "added up by post")
      + box6(net === "Instagram" ? "Profile visits" : "Clicks", fmtN(cur.act), chipHtml(cur.act, was("act"), false))
      + box6("Engagement", fmtN(cur.eng), chipHtml(cur.eng, was("eng"), false), "reactions, comments, shares, saves")
      + box6("Engagement rate", pct2(rate(cur.eng, cur.reach)), "", "engagement ÷ reach")
      + box6("Posts", fmtN(cur.posts), chipHtml(cur.posts, was("posts"), false))
      + '</div></section><section class="mkd-team"><h3>Paid team</h3><p>' + fmtN(cur.ads) + " ads on " + net + " · their own numbers inside the period</p><div class=\"mkd-tstats\">"
      + box6("Views", compact(cur.imp), chipHtml(cur.imp, was("imp"), false))
      + box6("Reach", cur.pReach ? compact(cur.pReach) : "—", chipHtml(cur.pReach, was("pReach"), false), cur.pReach ? "added up by ad" : "Meta keeps it 13 months")
      + box6("Clicks", fmtN(cur.clk), chipHtml(cur.clk, was("clk"), false), cur.clk ? "$" + (cur.cost / cur.clk).toFixed(2) + " a click" : "")
      + box6("Engagement", fmtN(cur.pEng), chipHtml(cur.pEng, was("pEng"), false), "reactions, comments, shares, saves")
      + box6("Engagement rate", pct2(rate(cur.pEng, cur.pReach)), "", "engagement ÷ reach")
      + box6("Spend", money0(cur.cost), chipHtml(cur.cost, was("cost"), null), fmtN(cur.lead) + " leads by Meta's count")
      + "</div></section></div>"
      + '<div class="panel" id="mkoMtTop"></div>'
      + '<div class="rs-kpis" id="mkoK-meta"></div><div id="mkoMtChart"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Every post and ad</span><span id="mkoMtShow"></span>'
      + '<span class="mko-sub">click a column heading to rank by it, again to flip it</span>'
      + '<span class="rs-spacer"></span><button type="button" class="rs-btn" id="mkoMtCsv">Export CSV</button></div><div id="mkoMtList"></div>'
      + '<p class="rs-hint">Organic numbers are each post\'s total to date, for posts published in the period; paid numbers are the ads\' own, inside the period. '
      + "≈ on a boosted post: Meta splits only its views, so its organic reach and engagement are its total × the organic share of its views. "
      + "Reach is people, so a person who saw two posts counts twice in the totals. An ad's reach in a period is the lesser of its daily reach added up and its reach over 13 months."
      + " The chart is Meta's count for the whole account, every placement and every older post, so it does not match the tables to the view."
      + (net === "Instagram" ? " Instagram gives a post no click count, so the organic side shows profile visits, and Reels give neither." : "")
      + (otherSum ? " Also ran, not in these tables: " + money0(otherSum) + " on " + esc(otherKeys.join(", ").replace(/_/g, " ")) + "." : "") + "</p></div>";
    const repaint = () => metaPaint(box, w, cw);
    box.querySelectorAll("#mkoMtNet [data-net]").forEach(b => { b.onclick = () => { MK.net = b.dataset.net; MK.all = false; repaint(); }; });
    RSC.kpis(box.querySelector("#mkoK-meta"), [
      { label: "Followers", value: fol ? fmtN(fol.fol) : "—", sub: fol ? "at " + day(fol.d) : "from the next pull on" },
      { label: "New followers", value: net === "Instagram" ? "—" : fmtN(gain), sub: net === "Instagram" ? "Instagram keeps no daily count here" : "in the period" },
      { label: "Views from ads", value: pct(ratio(paidV, orgV + paidV)), sub: "of every view of our content" + (late ? ", from " + day(days[0].d) : "") },
    ]);
    const keys = bucketsOf(pw.a, pw.b, pw.g), series = [["Organic", "#3F7D20", "orgV"], ["Paid", "#B7791F", "paidV"]];
    RSC.chartCard(box.querySelector("#mkoMtChart"), {
      title: "All views of our " + net + " content: organic against ads", key: "mko-mt-views",
      buildChart(canvas) {
        return new Chart(canvas, { type: "bar",
          data: { labels: keys.map(k => bucketLabel(k, pw.g)), datasets: series.map(([l, c, f]) => ({ label: l, data: seriesOf(days, keys, pw.g, r => r[f]), backgroundColor: c, stack: "a" })) },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
            scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true } }, y: { stacked: true, beginAtZero: true } } } });
      },
      buildTable() {
        const a = seriesOf(days, keys, pw.g, r => r.orgV), b = seriesOf(days, keys, pw.g, r => r.paidV);
        return ptable([{ h: "When", cell: i => esc(bucketLabel(keys[i], pw.g)) }, { h: "Organic", num: true, cell: i => fmtN(a[i]) }, { h: "Paid", num: true, cell: i => fmtN(b[i]) }], keys.map((_, i) => i));
      },
    });
    // these two repaint alone: picking a metric must not redraw the chart or move the page
    const paintList = () => {
      const el = box.querySelector("#mkoMtList");
      el.innerHTML = metaTable(rows, net, cur);
      el.querySelectorAll("[data-sort]").forEach(b => {
        b.onclick = () => { const k = b.dataset.sort; MK.asc = MK.sort === k ? !MK.asc : false; MK.sort = k; MK.all = false; paintList(); };
      });
      const all = el.querySelector("#mkoMtAll");
      if (all) all.onclick = () => { MK.all = !MK.all; paintList(); };
    };
    const paintTop = () => {
      const el = box.querySelector("#mkoMtTop"), paid = MK.team === "paid", mine = rows.filter(r => (paid ? r.paid : r.org));
      const mets = Object.keys(META_MET).filter(k => paid || !META_PAID_ONLY.includes(k));
      const fmts = Array.from(new Set(mine.map(r => r.fmt).filter(Boolean))).sort(), kinds = Object.keys(META_SHOW).filter(k => mine.some(r => r.kind === k));
      if (!mets.includes(MK.met)) MK.met = "reach";
      if (!fmts.includes(MK.fmt)) MK.fmt = "";
      if (!kinds.includes(MK.kind)) MK.kind = "";
      const name = k => (k === "act" && !paid && net === "Instagram" ? "Profile visits" : META_MET[k]);
      const fmt = (k, v) => (k === "rate" ? pct2(v) : k === "cost" ? money0(v) : k === "cpc" || k === "cpm" ? "$" + v.toFixed(2) : fmtN(v));
      const pills = (id, opts, on) => '<div class="mko-topics" id="' + id + '">' + opts.map(([k, l]) => '<button type="button" data-k="' + k + '" class="' + (k === on ? "on" : "") + '">' + esc(l) + "</button>").join("") + "</div>";
      const kindPill = { Organic: "ok", Boosted: "info", "Ad only": "warn" };
      el.innerHTML = '<div class="panel-head"><span class="panel-title" id="mkoRkT"></span><span class="mko-sub" id="mkoRkS"></span></div><div class="mkd-tophead">'
        + pills("mkoRkDir", [["top", "Top"], ["bottom", "Bottom"]], MK.dir)
        + '<label class="mkd-rkn">How many <input class="mkd-in" id="mkoRkN" type="number" min="1" max="50" value="' + MK.n + '"></label>'
        + pills("mkoRkTeam", [["org", "Organic team"], ["paid", "Paid team"]], MK.team) + '<span id="mkoRkFmt"></span><span id="mkoRkKind"></span></div>'
        + '<div class="mkd-tophead">' + pills("mkoRkMet", mets.map(k => [k, name(k)]), MK.met) + '</div><div id="mkoRkList"></div>';
      const paintRows = () => {
        const low = MK.dir === "bottom", list = metaRank(rows, MK, addDays(today(), -META_SETTLE)), mx = list.reduce((a, o) => Math.max(a, o.v), 0) || 1;
        const row = (o, i) => {
          const r = o.r, x = paid ? r.paid : r.org, words = r.text.length > 110 ? r.text.slice(0, 108) + "…" : r.text;
          const near = !paid && x.approx && MK.met !== "views" ? "≈ " : "";
          const rest = mets.filter(k => k !== MK.met && !META_PAID_ONLY.slice(1).includes(k)).map(k => {
            const v = k === "rate" ? ratio(x.eng, x.reach) : metaVal(r, MK.team, k);
            return v == null ? "" : name(k) + " " + fmt(k, v);
          }).filter(Boolean).join(" · ");
          return '<li class="mkd-rk' + (low ? " low" : "") + '"><span class="n">' + (i + 1) + '</span><div class="w">'
            + (r.link ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener">' + esc(words) + "</a>" : '<span class="t">' + esc(words) + "</span>")
            + '<span class="mko-sub">' + pill(r.kind, kindPill[r.kind]) + " " + esc([r.fmt, day(r.d)].filter(Boolean).join(" · ")) + '</span><span class="mko-sub">' + esc(rest) + "</span></div>"
            + '<div class="bar"><i style="width:' + Math.max(2, Math.round(100 * o.v / mx)) + '%"></i></div><b class="v">' + near + fmt(MK.met, o.v) + "</b></li>";
        };
        const notes = [];
        if (MK.met === "rate") notes.push("Only rows that reached at least " + META_MIN_REACH + " people, so a handful of people cannot top or sink the list.");
        if (low && paid) notes.push("Leaves out ads that spent under $" + META_MIN_SPEND + " in the period.");
        if (low && !paid) notes.push("Leaves out posts from the last " + META_SETTLE + " days: they are still collecting numbers.");
        if (list.length && list.length < MK.n) notes.push("Only " + list.length + " match.");
        el.querySelector("#mkoRkT").textContent = (low ? "Bottom " : "Top ") + MK.n + " by " + name(MK.met).toLowerCase();
        el.querySelector("#mkoRkS").textContent = net + ", " + (paid ? "ads that ran in the period" : "posts published in the period") + (low ? ", lowest first" : ", highest first");
        el.querySelector("#mkoRkList").innerHTML = (list.length ? '<ol class="mkd-rks mkd-scroll">' + list.map(row).join("") + "</ol>" : '<div class="mko-empty">Nothing to rank with these picks in this period.</div>')
          + (notes.length ? '<p class="rs-hint">' + esc(notes.join(" ")) + "</p>" : "");
      };
      const pick = (id, set) => el.querySelectorAll("#" + id + " [data-k]").forEach(b => { b.onclick = () => { set(b.dataset.k); paintTop(); }; });
      pick("mkoRkDir", v => { MK.dir = v; });
      pick("mkoRkTeam", v => { MK.team = v; });
      pick("mkoRkMet", v => { MK.met = v; });
      let tn = null;
      el.querySelector("#mkoRkN").oninput = e => {
        clearTimeout(tn);
        tn = setTimeout(() => { MK.n = Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1)); paintRows(); }, 200);
      };
      RSC.localSelect(el.querySelector("#mkoRkFmt"), { label: "Format", allLabel: "Every format", values: fmts.map(v => ({ v, l: v })), value: MK.fmt,
        onChange: v => { MK.fmt = v; paintRows(); } });
      RSC.localSelect(el.querySelector("#mkoRkKind"), { label: "Kind", allLabel: "Every kind", values: kinds.map(v => ({ v, l: META_SHOW[v] })), value: MK.kind,
        onChange: v => { MK.kind = v; paintRows(); } });
      paintRows();
    };
    paintTop();
    paintList();
    RSC.localSelect(box.querySelector("#mkoMtShow"), { label: "Show", allLabel: "Everything",
      values: Object.keys(META_SHOW).map(k => ({ v: k, l: META_SHOW[k], n: rows.filter(r => r.kind === k).length })), value: MK.show,
      onChange: v => { MK.show = v; MK.all = false; paintList(); } });
    box.querySelector("#mkoMtCsv").onclick = () => {
      const cell = x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"', o = (r, k) => (r.org ? Math.round(r.org[k]) : ""), p = (r, k) => (r.paid ? Math.round(r.paid[k]) : "");
      const lines = [["Date", "Kind", "Format", "Text", "Link", "Organic views", "Organic reach", net === "Instagram" ? "Profile visits" : "Organic clicks", "Organic engagement",
                      "Spend", "Paid views", "Paid reach", "Paid clicks", "Paid engagement", "Leads (Meta)"]]
        .concat(metaList(rows).map(r => [r.d, r.kind, r.fmt, r.text, r.link, o(r, "views"), o(r, "reach"), o(r, "act"), o(r, "eng"),
                                                                          r.paid ? r.paid.cost.toFixed(2) : "", p(r, "imp"), p(r, "reach"), p(r, "clk"), p(r, "eng"), p(r, "lead")]));
      const blob = new Blob([lines.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = net + " posts and ads (" + pw.a + " to " + pw.b + ").csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    };
  }

  function socialTab(w, cw) {
    const li = linkedinPage(w, cw);
    const card = (name, chip, body) => '<article class="mkd-plat off"><div class="hd"><div><div class="nm"><h3>' + esc(name)
      + '</h3><span class="mkd-chip">' + esc(chip) + "</span></div></div></div><p>" + body + "</p></article>";
    const html = '<section class="mkd-sec" id="mkoMeta" aria-label="Facebook and Instagram"></section>'
      + '<section class="mkd-sec" aria-label="LinkedIn Company Page">' + li.html + "</section>"
      + '<section class="mkd-sec" aria-labelledby="mkdSocH"><div class="mkd-h"><h2 id="mkdSocH">Coming next</h2>'
      + "<span>fills in the day its access comes through</span></div><div class=\"mkd-plats\">"
      + card("TikTok", "later", "Organic video stats need TikTok's account scope, which the reporting app does not "
          + "ask for yet. The ads are on the Paid ads tab.")
      + "</div></section>";
    return { html, wire(host) {
      const box = host.querySelector("#mkoMeta");
      if (S.co === "Tuji") box.innerHTML = '<p class="mkd-note">The Facebook Page and Instagram account are Zip to Zip\'s, so they are not shown for Tuji.</p>';
      else metaPaint(box, w, cw);
      if (li.wire) li.wire(host);
    } };
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
  /* === THE SEO REPORT (batch 2, 2026-10-21) ===
     The marketing head's monthly SEO report, built from our own feeds instead of her exports: Search
     Console's day-grain click marts over the period's exact days against the comparison's (2026-10-22,
     his pick: the monthly marts set 1–20 Oct against ALL of October 2025), the monthly page mart for
     the blog, and Ahrefs' new links (the page's period). Google shows AI-feature impressions and the
     social profiles only on its own Search Console site, never in the API, so those two are a note. */
  const LINKS_FROM = "2026-09-01";          // ext_ahrefs_backlink's first day (src/ahrefs_api.py LINKS_FROM)
  const visibleQ = r => r.type !== "Hidden by Google" && r.q && r.q[0] !== "(";
  // each key's clicks in the period against the comparison; gained = up, lost = down
  function moves(rows, keyOf, isCur, isPrev) {
    const m = new Map();
    rows.forEach(r => {
      const inC = isCur(r), inP = !inC && isPrev(r);
      if (!inC && !inP) return;
      const k = keyOf(r), x = m.get(k) || { k, now: 0, was: 0 };
      if (inC) x.now += r.clk; else x.was += r.clk;
      m.set(k, x);
    });
    const all = Array.from(m.values());
    all.forEach(x => { x.d = x.now - x.was; });
    return { up: all.filter(x => x.d > 0).sort((a, b) => b.d - a.d || b.now - a.now),
             down: all.filter(x => x.d < 0).sort((a, b) => a.d - b.d || b.now - a.now) };
  }
  // a blog post is its number: one post reaches Search Console under up to 7 addresses
  const postId = page => { const m = /\/singleview\/(\d+)-/.exec(page); return m ? +m[1] : null; };
  const postTitle = page => {
    const slug = (/\/singleview\/\d+-([^/?#]+)/.exec(page) || [])[1] || page;
    return slug.replace(/-/g, " ").replace(/^./, c => c.toUpperCase());
  };
  const pagePath = page => String(page || "").replace(/^https?:\/\/(www\.)?ziptozipmoving\.com/i, "") || "/";
  function movesHtml(mv, name, n) {
    if (!mv.up.length && !mv.down.length) return '<div class="mko-empty">Nothing moved between the two periods.</div>';
    const row = x => '<tr><td class="mko-name">' + name(x.k) + '</td><td class="mko-num">' + fmtN(x.now) + "</td>"
      + '<td class="mko-num"><span class="' + (x.d > 0 ? "mko-pos" : "mko-neg") + '">' + (x.d > 0 ? "+" : "−")
      + fmtN(Math.abs(x.d)) + "</span></td></tr>";
    const grp = (label, list) => list.length ? '<tr class="mko-grp"><td colspan="3">' + esc(label) + "</td></tr>"
      + list.slice(0, n).map(row).join("") : "";
    return '<div class="rs-tablewrap"><table class="rs-table mko-pt mko-tight"><thead><tr><th></th>'
      + '<th class="mko-num">Clicks</th><th class="mko-num" title="against the comparison days">Change</th></tr></thead><tbody>'
      + grp("Lost most · " + fmtN(mv.down.length), mv.down) + grp("Gained most · " + fmtN(mv.up.length), mv.up)
      + "</tbody></table></div>";
  }
  /* GUEST-POST MARKS (2026-10-22, his picks): anyone on the page marks a linking PAGE as our guest
     post, or adds one Ahrefs has not found yet. Stored by the bridge (/api/_mktmark, mkt_backlink_mark,
     history kept); read back through it so a mark shows at once. A page is its address without scheme,
     "www.", query, fragment or trailing slash -- the bridge's _url_key() is the twin. */
  const normUrl = u => {
    const m = /^https?:\/\/([^/?#\s]+)([^?#\s]*)/i.exec(String(u || "").trim());
    return m ? (m[1].toLowerCase().replace(/^www\./, "") + m[2].replace(/\/+$/, "")).slice(0, 500) : "";
  };
  function indexMarks(list) {
    P.marks = (list || []).map(m => ({ url: m.URL || "", key: m.Key || normUrl(m.URL), site: m.Site || "",
      date: m.Published ? d10(m.Published) : null, by: m["Entered By"] || "", at: d10(m["Entered At"]) })).filter(m => m.key);
  }
  function saveMark(body) {
    return fetch(ZTZ.API + "/api/_mktmark", {
      method: "POST",
      headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json().catch(() => ({})).then(j => {
      if (!r.ok || j.error) {
        if (j && j.code === "view_as_readonly") throw new Error("preview mode — marks are not saved while viewing as someone else");
        throw new Error(j.error || ("HTTP " + r.status));
      }
      indexMarks(j.marks || []);
    }));
  }
  const whoShort = e => String(e || "").split("@")[0].replace(/^./, c => c.toUpperCase());
  // Ahrefs' new links in [a, b]: a SITE is new when its first link on file falls in the window. A
  // site carrying a marked page shows that page; OURS = the period's marked links (by Ahrefs' first
  // seen) and the pages added by hand (by their date) that Ahrefs has not found.
  function linkStats(a, b) {
    const firstBy = {}, markBy = {}, onFile = new Set();
    P.marks.forEach(m => { markBy[m.key] = m; });
    P.links.forEach(r => { if (!firstBy[r.dom] || r.d < firstBy[r.dom]) firstBy[r.dom] = r.d; onFile.add(normUrl(r.url)); });
    const rows = P.links.filter(r => r.d >= a && r.d <= b);
    const site = x => {
      const top = x.rows.slice().sort((p, q) => (q.dr || 0) - (p.dr || 0))[0];
      const mr = x.rows.find(r => markBy[normUrl(r.url)]) || null, show = mr || top;
      return { dom: x.k, n: x.rows.length, dr: top.dr, spam: x.rows.some(r => r.spam), url: show.url, title: show.title,
               d: x.rows.reduce((m, r) => (r.d < m ? r.d : m), x.rows[0].d), mark: mr ? markBy[normUrl(mr.url)] : null };
    };
    const sites = groupBy(rows.filter(r => firstBy[r.dom] >= a), r => r.dom).map(site);
    const byDr = (p, q) => (q.dr || 0) - (p.dr || 0) || q.n - p.n;
    const clean = sites.filter(x => !x.spam).sort(byDr);
    const ours = rows.filter(r => markBy[normUrl(r.url)]).map(r => ({ dom: r.dom, n: 1, dr: r.dr, spam: r.spam, url: r.url,
      title: r.title, d: r.d, mark: markBy[normUrl(r.url)] }))
      .concat(P.marks.filter(m => !onFile.has(m.key) && (m.date || m.at) >= a && (m.date || m.at) <= b)
        .map(m => ({ dom: m.site, n: 1, dr: null, spam: false, url: m.url, title: "", d: m.date || m.at, mark: m, hand: true })))
      .sort(byDr);
    return { links: rows.length, sites: sites.length, clean, spam: sites.length - clean.length, all: sites.sort(byDr), ours,
             big: sites.slice().sort((p, q) => q.n - p.n)[0] || null };
  }
  // the backlinks list: clean sites (with every marked site, spam or not), our guest posts, or all
  function linksBody(lk) {
    const view = S.linkView;
    const list = view === "ours" ? lk.ours : view === "all" ? lk.all
      : lk.clean.concat(lk.all.filter(x => x.spam && x.mark)).sort((p, q) => (q.dr || 0) - (p.dr || 0) || q.n - p.n);
    const SHOW = 25;
    const seg = [["clean", "Clean sites · " + fmtN(lk.clean.length)], ["ours", "Our guest posts · " + fmtN(lk.ours.length)],
                 ["all", "Show spam too"]];
    return '<div class="rs-kpis" id="mkoK-links"></div>'
      + '<div class="mko-lk-bar"><div class="rs-seg">' + seg.map(([k, l]) => '<button type="button" data-lview="' + k + '"'
        + (k === view ? ' class="on"' : "") + ">" + esc(l) + "</button>").join("") + "</div>"
      + '<button type="button" class="rs-btn" data-ladd="1">+ Add a guest post Ahrefs hasn\'t found</button></div>'
      + (S.linkAdd ? '<div class="mko-lk-add"><input class="rs-inp mko-lk-url" type="url" placeholder="https://site.com/the-article" '
        + 'aria-label="Address of the guest post"><input class="rs-inp mko-lk-day" type="date" value="' + today() + '" '
        + 'aria-label="Date it went live"><button type="button" class="rs-btn" data-lsave="1">Save</button>'
        + '<button type="button" class="rs-btn" data-lcancel="1">Cancel</button><span class="mko-lk-msg" role="status"></span></div>' : "")
      + '<div class="mko-lk-msg mko-lk-top" role="status"></div>'
      + (list.length ? ptable([
        { h: "Site", name: true, cell: x => '<a href="' + esc(x.url) + '" target="_blank" rel="noopener">' + esc(x.dom) + " ↗</a>"
            + (x.mark ? " " + pill("Guest post", "ok") : "") + (x.spam ? " " + pill("spam flag", "mute") : "")
            + (x.title || x.mark ? '<div class="mko-sub">' + esc((x.title || "").slice(0, 90))
              + (x.mark ? (x.title ? " · " : "") + "marked by " + esc(whoShort(x.mark.by)) + ", " + esc(shortDay(x.mark.at))
                + (x.hand ? " · added by hand, Ahrefs hasn't found it yet" : "") : "") + "</div>" : "") },
        { h: "DR", num: true, tip: "Ahrefs Domain Rating of the linking site", cell: x => x.dr == null ? "—" : String(Math.round(x.dr)) },
        { h: "Links", num: true, cell: x => fmtN(x.n) },
        { h: "First seen", num: true, cell: x => esc(shortDay(x.d)) },
        { h: "Ours?", num: true, cell: x => '<button type="button" class="rs-btn mko-lk-mark' + (x.mark ? " on" : "") + '" data-lmark="'
            + esc(x.url) + '" data-lon="' + (x.mark ? "0" : "1") + '">' + (x.mark ? "✓ Guest post" : "Mark as ours") + "</button>" }],
        list.slice(0, SHOW), null)
        + (list.length > SHOW ? '<p class="rs-hint">And ' + fmtN(list.length - SHOW) + " more.</p>" : "")
        : '<div class="mko-empty">' + (view === "ours" ? "No guest post marked in this period yet." : "No new linking site in this period.") + "</div>")
      + (P.err.marks ? '<p class="rs-hint">The marks could not load — ' + esc(P.err.marks) + "</p>" : "");
  }
  // draws the backlinks box for [a, b] from the links and the marks as they stand, and wires it; a
  // mark or a view change redraws the box alone, so the page keeps its place
  function wireLinks(host, a, b, cw, note) {
    const box = host.querySelector("#mkoLinks");
    if (!box) return;
    const lk = linkStats(a, b), lkPrev = cw && cw.a >= LINKS_FROM ? linkStats(cw.a, cw.b) : null;
    box.innerHTML = linksBody(lk);
    if (note) box.querySelector(".mko-lk-top").textContent = note;
    const redraw = msg => wireLinks(host, a, b, cw, msg);
    const drs = lk.ours.map(x => x.dr).filter(v => v != null), hand = lk.ours.filter(x => x.hand).length;
    RSC.kpis(box.querySelector("#mkoK-links"), [
      { label: "New linking sites", value: fmtN(lk.sites) + (lkPrev ? delta(lk.sites, lkPrev.sites, null) : ""),
        sub: (lkPrev ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmtN(lkPrev.sites) + " · " : "")
          + fmtN(lk.links) + " links" },
      { label: "Clean sites", value: fmtN(lk.clean.length), sub: "not flagged as spam" },
      { label: "Our guest posts", value: fmtN(lk.ours.length), sub: !drs.length ? "marked by the team"
          : "DR " + Math.round(Math.min.apply(null, drs)) + (drs.length > 1 && Math.min.apply(null, drs) !== Math.max.apply(null, drs)
            ? "–" + Math.round(Math.max.apply(null, drs)) : "") + (hand ? " · " + hand + " added by hand" : "") },
      { label: "Spam sites", value: fmtN(lk.spam), sub: lk.sites ? pct(lk.spam / lk.sites) + " of the new sites" : "" },
    ]);
    box.querySelectorAll("[data-lview]").forEach(btn => { btn.onclick = () => { S.linkView = btn.dataset.lview; redraw(); }; });
    const add = box.querySelector("[data-ladd]");
    if (add) add.onclick = () => { S.linkAdd = !S.linkAdd; redraw(); const u = box.querySelector(".mko-lk-url"); if (u) u.focus(); };
    const cancel = box.querySelector("[data-lcancel]");
    if (cancel) cancel.onclick = () => { S.linkAdd = false; redraw(); };
    const save = box.querySelector("[data-lsave]");
    if (save) save.onclick = () => {
      const url = box.querySelector(".mko-lk-url").value.trim(), dd = box.querySelector(".mko-lk-day").value;
      const msg = box.querySelector(".mko-lk-add .mko-lk-msg");
      msg.classList.remove("bad");
      if (!normUrl(url)) { msg.textContent = "Give the page's full address, starting http:// or https://"; msg.classList.add("bad"); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dd)) { msg.textContent = "Pick the date it went live."; msg.classList.add("bad"); return; }
      save.disabled = true; msg.textContent = "Saving…";
      saveMark({ url, mark: true, date: dd })
        .then(() => { S.linkAdd = false; S.linkView = "ours"; redraw("Saved: " + normUrl(url).split("/")[0] + " is marked as our guest post."); })
        .catch(e => { save.disabled = false; msg.textContent = "Not saved: " + e.message; msg.classList.add("bad"); });
    };
    box.querySelectorAll("[data-lmark]").forEach(btn => {
      btn.onclick = () => {
        const on = btn.dataset.lon === "1";
        btn.disabled = true; btn.textContent = "Saving…";
        saveMark({ url: btn.dataset.lmark, mark: on })
          .then(() => redraw(on ? "Marked as our guest post." : "Mark taken off."))
          .catch(e => { btn.disabled = false; btn.textContent = on ? "Mark as ours" : "✓ Guest post";
            const top = box.querySelector(".mko-lk-top"); top.textContent = "Not saved: " + e.message; top.classList.add("bad"); });
      };
    });
  }
  function seoReport(gw, w, cw, ms) {
    // the period's exact days and the comparison's -- the KPI strip's windows -- on the day-grain marts
    const cur = gw && !gw.before && !gw.after ? { a: gw.a, b: gw.b } : null;
    const cmp = cur && gw.cw ? { a: gw.cw.a, b: gw.cw.b } : null;
    const inW = win => r => !!win && r.d >= win.a && r.d <= win.b;
    const qv = P.gscqd.filter(visibleQ);
    const inM = (list, mm) => list.filter(r => mm.includes(r.m));
    const brand = win => { const xs = qv.filter(inW(win)); const all = sum(xs, "clk");
      return { share: all ? sum(xs.filter(r => r.type === "Brand"), "clk") / all : null,
               kw: new Set(xs.map(r => r.q)).size }; };
    const listing = win => { const xs = P.gscpd.filter(r => r.fam === "Business Profile listing" && inW(win)(r));
      return { clk: sum(xs, "clk"), n: new Set(xs.map(r => r.page)).size }; };
    const kwMv = cmp ? moves(qv, r => r.q, inW(cur), inW(cmp)) : null;
    const pgMv = cmp ? moves(P.gscpd.filter(r => r.fam !== "Business Profile listing"), r => r.page, inW(cur), inW(cmp)) : null;
    const spanCur = cur ? dayRange(cur.a, cur.b) : monthSpan(ms);
    // the blog: clicks per post (its number), and the posts whose first month in Search Console is a period month
    let start = null;
    const first = {};
    P.gscp.forEach(r => {
      if (!start || r.m < start) start = r.m;
      const id = postId(r.page);
      if (id && (!first[id] || r.m < first[id])) first[id] = r.m;
    });
    const posts = groupBy(inM(P.gscp, ms).filter(r => postId(r.page)), r => postId(r.page)).map(x => ({
      id: x.k, title: postTitle(x.rows[0].page), clk: sum(x.rows, "clk"), imp: sum(x.rows, "imp") }))
      .sort((a, b) => b.clk - a.clk || b.imp - a.imp);
    const fresh = Object.keys(first).filter(id => ms.includes(first[id]) && first[id] > start).map(Number);
    const freshList = fresh.map(id => posts.find(x => x.id === id) || { id, title: "", clk: 0, imp: 0 })
      .sort((a, b) => b.id - a.id);
    const blogClk = sum(inM(P.gscp, ms).filter(r => r.fam === "Blog"), "clk");
    const la = w.a > LINKS_FROM ? w.a : LINKS_FROM;
    const lk = linkStats(la, w.bEff), lkPrev = cw && cw.a >= LINKS_FROM ? linkStats(cw.a, cw.b) : null;
    // the last twelve months' clicks and impressions, the month the period ends in last
    const endM = (gw && gw.b ? gw.b : w.bEff).slice(0, 7);
    const m12 = months(addDays(endM + "-01", -330), endM + "-01").slice(-12);
    const byM = {};
    P.gsc.forEach(r => { const m = r.d.slice(0, 7); const x = byM[m] = byM[m] || { clk: 0, imp: 0 }; x.clk += r.clk; x.imp += r.imp; });
    const done = Object.keys(byM).filter(m => m < today().slice(0, 7)).sort().slice(-12);
    const best = done.reduce((b, m) => (!b || byM[m].clk > byM[b].clk ? m : b), null);
    // the month still running says how far its bar goes (his pick, 2026-10-22): "Oct 2026 (to 20 Oct)"
    const lastG = P.last.gsc;
    const mLabel = m => monthWord(m) + (lastG && m === lastG.slice(0, 7) && addDays(lastG, 1).slice(0, 7) === m
      ? " (to " + shortDay(lastG) + ")" : "");
    const panel = (title, sub, body) => '<div class="panel"><div class="panel-head"><span class="panel-title">' + title
      + '</span><span class="mko-sub">' + sub + "</span></div>" + body + "</div>";
    const noCmp = '<div class="mko-empty">Pick a period with a comparison to see what gained and lost.</div>';
    const span = esc(spanCur) + (cmp ? " against " + esc(dayRange(cmp.a, cmp.b)) : "");
    const head = '<div class="mko-h"><h2>SEO report</h2><span class="mko-sub">' + span
      + " · Search Console" + (cur && gw.last && cur.b === gw.last ? " to " + esc(day(gw.last)) : "")
      + " and Ahrefs' new links</span></div>";
    // one piece per topic tab (2026-10-23): Overview, Keywords and pages, Blog, Backlinks and citations
    const parts = {
      ov: head + '<div id="mkoC-seom"></div>'
        + '<p class="rs-hint">AI Overviews / AI Mode impressions and the social profiles\' search clicks are only on Google\'s '
        + "Search Console site; its API has neither (checked 20 Oct 2026), so they are not here.</p>",
      kw: '<div class="mko-h"><h2>Keywords and pages</h2><span class="mko-sub">' + span + "</span></div>"
        + '<div class="mko-g2e">'
        + panel("Keywords", "clicks in the period and the change", kwMv ? movesHtml(kwMv, k => esc(k), 6) : noCmp)
        + panel("Pages", "Business Profile listings apart", (pgMv ? movesHtml(pgMv, k => postId(k)
            ? "Blog · " + esc(postTitle(k)) : esc(pagePath(k)), 5) : noCmp)
          + (function () { const L = listing(cur); return '<p class="rs-hint"><b>Google Business Profile:</b> ' + fmtN(L.n)
          + " listings brought " + fmtN(L.clk) + " clicks"
          + (cmp ? " (" + fmtN(listing(cmp).clk) + " on the comparison days)" : "") + ".</p>"; })())
        + "</div>",
      blog: panel("Blog", esc(monthSpan(ms)) + " · " + fmtN(blogClk) + " clicks · " + fmtN(freshList.length) + " new posts",
        (posts.length ? ptable([
          { h: "Post", name: true, cell: x => esc(x.title) },
          { h: "Clicks", num: true, cell: x => fmtN(x.clk) },
          { h: "Impr.", num: true, tip: "impressions", cell: x => compact(x.imp) }], posts.slice(0, 6), null, true)
          : '<div class="mko-empty">No blog clicks in these months.</div>')
        + '<h3 class="mko-h3">New this period</h3>'
        + (freshList.length ? '<div class="mko-sub">' + freshList.map(x => "#" + x.id + " " + esc(x.title || "(no title)")).join("<br>") + "</div>"
          : '<div class="mko-empty">No new post reached Search Console in these months.</div>')
        + '<p class="rs-hint">New = the first month a post number shows in Search Console, which is one to two weeks '
        + "after it goes live; a post out at a month's end counts in the next month.</p>"),
      links: panel("New backlinks · Ahrefs", "sites linking to us for the first time · " + esc(day(la)) + " – " + esc(day(w.bEff)),
        '<div id="mkoLinks"></div>'
        + '<p class="rs-hint">Ahrefs flags ' + fmtN(lk.spam) + " of the " + fmtN(lk.sites) + " new sites as spam (link farms); "
        + "they are listed only under Show spam too." + (lk.big && lk.big.n > 50 ? " " + esc(lk.big.dom) + " alone added "
        + fmtN(lk.big.n) + " links." : "") + " Ahrefs does not say which links are ours: anyone on this page marks a guest "
        + "post, and the mark keeps who set it and when."
        + (w.a < LINKS_FROM ? " New links are tracked from " + esc(day(LINKS_FROM)) + "." : "") + "</p>"),
    };
    return {
      parts, brand: brand(cur), brandPrev: cmp ? brand(cmp) : null, spanCur, lk, lkPrev,
      best: best ? { m: best, clk: byM[best].clk } : null,
      wire(host) {
        wireLinks(host, la, w.bEff, cw);
        const el = host.querySelector("#mkoC-seom");
        if (!el || !m12.length) return;
        RSC.chartCard(el, {
          title: "Organic clicks by month", key: "mko-seo-month",
          buildChart(canvas) {
            const C = palette();
            return new Chart(canvas, { type: "bar",
              data: { labels: m12.map(mLabel), datasets: [
                { type: "bar", label: "Clicks", data: m12.map(m => (byM[m] || {}).clk || 0), backgroundColor: C.main,
                  borderRadius: 3, maxBarThickness: 26, yAxisID: "y" },
                { type: "line", label: "Impressions", data: m12.map(m => (byM[m] || {}).imp || 0), borderColor: "#6B7F73",
                  backgroundColor: "#6B7F73", borderWidth: 1.5, pointRadius: 2, yAxisID: "y2" }] },
              options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => fmtN(v) } },
                          y2: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { callback: v => compact(v) } },
                          x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
          },
          buildTable() {
            return ptable([{ h: "Month", cell: m => esc(mLabel(m)) },
              { h: "Clicks", num: true, cell: m => fmtN((byM[m] || {}).clk || 0) },
              { h: "Impressions", num: true, cell: m => fmtN((byM[m] || {}).imp || 0) },
              { h: "CTR", num: true, cell: m => pct2(ratio((byM[m] || {}).clk || 0, (byM[m] || {}).imp || 0)) }], m12.slice().reverse());
          },
        });
      },
    };
  }

  /* === SEARCHES AND DEMAND, NATIVE (his pick, 2026-10-30) ===
     The Organic Search page rebuilt inside the dashboard: its own window and compare switches sat
     60px under the dashboard's, it fetched three marts under its own keys, and its stacked charts
     wore eight colours. Now the topic reads the dashboard's Period and Compare, whole months only
     (the marts are monthly; a month still filling says so). What the numbers obey, each measured
     when the page was built (2026-09-24):
       * Google hides about 45% of clicks from the query rows. Every query breakdown carries a
         "hidden by Google" remainder so it adds up to the site total, and every place figure is a
         FLOOR: Search Console never says where the searcher was; a place comes only from the words
         of the search or the page they landed on.
       * Impressions and position broke on 12-13 Sep 2025 (Google ended the 100-results setting),
         so a compare is CLICKS ONLY and impressions / position count from Oct 2025.
       * The compare matches whole months only: a month both sides hold completely.
       * Leads beside the searches are context, never cause: the lead side cannot tell paid Google
         from organic, and ChatGPT leads never pass through Search Console.
       * A Business Profile click is a click on the listing's WEBSITE link only, not a call or a
         direction request.
       * Under 100 impressions an average position is a handful of searches (the Bronx read "page
         1" on 18 impressions), so it gets no verdict. */
  const GSC_CLEAN = "2025-10", GSC_BREAK = "12–13 Sep 2025", DM_TOP = 100;
  const MIN_VERDICT_IMPR = 100;
  function verdictOf(pos, imp) {
    if (!imp || pos == null) return "Not shown";
    if (imp < MIN_VERDICT_IMPR) return "Rarely shown";
    return pos <= 3.5 ? "Winning" : pos <= 10.5 ? "Page 1" : pos <= 20.5 ? "Page 2" : "Invisible";
  }
  const DM_PILL = { Winning: "ok", "Page 1": "info", "Page 2": "warn", Invisible: "bad", "Rarely shown": "mute", "Not shown": "mute" };
  const dmPill = (pos, imp) => { const v = verdictOf(pos, imp); return pill(v, DM_PILL[v]); };
  const QTYPES = ["Brand", "Movers near me", "Movers + place", "Movers generic", "How-to", "Town name only", "Other"];
  // a green ramp and one grey, never a rainbow: six series at most on a chart
  const Q_CHART = [["Brand", "#14301F"], ["Movers near me", "#3F7D20"], ["Movers + place", "#7FA864"],
                   ["Movers generic", "#A9C793"], ["Everything else", "#C9DABD"], ["Hidden by Google", "#A3ADA5"]];
  const qBucket = t => (Q_CHART.some(c => c[0] === t) ? t : "Everything else");
  const PAGE_CHART = [["Home", "#14301F"], ["Business Profile listing", "#3F7D20"], ["Location and state pages", "#7FA864"],
                      ["City pages", "#A9C793"], ["Service pages", "#C9DABD"], ["Everything else", "#A3ADA5"]];
  const pBucket = f => (f === "Location page" || f === "State page" ? "Location and state pages" : f === "City page" ? "City pages"
    : f === "Service page" ? "Service pages" : f === "Home" || f === "Business Profile listing" ? f : "Everything else");
  const DM = { st: "", fam: "", qType: "", q: "", open: {}, cityAll: false };
  const dmPos = v => (v == null ? "—" : v.toFixed(1));

  function dmInfo() {
    const days = {};
    P.gsca.forEach(r => { days[r.m] = Math.max(days[r.m] || 0, r.days); });
    const list = Array.from(new Set(P.gscq.map(r => r.m).concat(Object.keys(days)))).sort();
    const whole = m => (days[m] || 0) >= new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
    return { days, list, whole };
  }
  function dmClicks(ms) {
    const set = new Set(ms), t = {};
    P.gscq.forEach(r => { if (set.has(r.m)) t[r.type] = (t[r.type] || 0) + r.clk; });
    const site = Object.keys(t).reduce((a, k) => a + t[k], 0), hidden = t["Hidden by Google"] || 0;
    return { t, site, hidden, named: site - hidden };
  }
  function dmSum(rows) {
    const z = { qc: 0, qi: 0, pw: 0, b1: 0, b2: 0, b3: 0, b4: 0, bp: 0, cp: 0, lp: 0, leads: 0, jobs: 0, vol: null };
    rows.forEach(r => {
      z.qc += r.qc; z.bp += r.bp; z.cp += r.cp; z.lp += r.lp; z.leads += r.leads; z.jobs += r.jobs;
      if (r.vol != null) z.vol = r.vol;
      if (r.m >= GSC_CLEAN) {
        z.qi += r.qi; z.pw += r.qp * r.qi;
        z.b1 += r.b1; z.b2 += r.b2; z.b3 += r.b3; z.b4 += r.b4;
      }
    });
    z.pos = z.qi ? z.pw / z.qi : null;
    return z;
  }
  function dmBands(z) {
    const n = z.b1 + z.b2 + z.b3 + z.b4;
    if (!n) return '<span class="mko-sub">—</span>';
    const w = x => (100 * x / n).toFixed(1);
    return '<span class="mkd-bands" title="positions 1–3: ' + w(z.b1) + "% · 4–10: " + w(z.b2) + "% · 11–20: " + w(z.b3) + "% · 21+: " + w(z.b4) + '%">'
      + '<i class="b1" style="width:' + w(z.b1) + '%"></i><i class="b2" style="width:' + w(z.b2) + '%"></i>'
      + '<i class="b3" style="width:' + w(z.b3) + '%"></i><i class="b4" style="width:' + w(z.b4) + '%"></i></span>';
  }
  const dmCells = z => '<td class="mko-num"><b>' + fmtN(z.qc) + '</b></td><td class="mko-num">' + (z.qi ? fmtN(z.qi) : "—")
    + '</td><td class="mko-num">' + dmPos(z.pos) + "</td><td>" + dmBands(z) + "</td>"
    + '<td class="mko-num">' + fmtN(z.bp) + '</td><td class="mko-num">' + fmtN(z.cp + z.lp) + '</td><td class="mko-num">' + fmtN(z.leads) + "</td>";
  const dmHead = first => "<thead><tr><th>" + esc(first) + '</th><th class="mko-num" title="movers searches that name the place">Clicks</th>'
    + '<th class="mko-num">Impressions</th><th class="mko-num">Position</th><th>Where we rank</th>'
    + '<th class="mko-num" title="website-link clicks on the Business Profile listings in this place">Listing clicks</th>'
    + '<th class="mko-num" title="clicks that landed on our city, location and state pages about this place">Page clicks</th>'
    + '<th class="mko-num" title="Zip to Zip leads created in these months, by pickup place: context, never cause">Leads</th></tr></thead>';

  function dmStateDetail(ms, st, whole) {
    const set = new Set(ms), rows = P.gsca.filter(r => set.has(r.m) && r.st === st && r.lvl !== "State");
    const by = {};
    rows.forEach(r => {
      if (r.lvl === "Other") return;
      const k = r.lvl + "|" + (r.lvl === "County" ? r.county : r.city);
      (by[k] = by[k] || []).push(r);
    });
    const list = Object.keys(by).map(k => ({ k, z: dmSum(by[k]) }))
      .filter(o => o.z.qc || o.z.qi || o.z.bp || o.z.cp || o.z.lp)
      .sort((a, b) => (b.z.qc - a.z.qc) || (b.z.qi - a.z.qi));
    const shown = list.slice(0, 40), parts = dmSum(rows), rest = dmSum(rows.filter(r => r.lvl === "Other"));
    list.slice(40).forEach(o => { ["qc", "qi", "pw", "b1", "b2", "b3", "b4", "bp", "cp", "lp"].forEach(k => { rest[k] += o.z[k]; }); });
    rest.pos = rest.qi ? rest.pw / rest.qi : null;
    rest.leads = 0;
    const grey = (label, z) => '<tr class="mkd-grey"><td>' + esc(label) + '</td><td class="mko-num">' + fmtN(z.qc) + '</td><td class="mko-num">'
      + (z.qi ? fmtN(z.qi) : "—") + '</td><td class="mko-num">' + dmPos(z.pos) + "</td><td></td>"
      + '<td class="mko-num">' + fmtN(z.bp) + '</td><td class="mko-num">' + fmtN(z.cp + z.lp) + "</td><td></td></tr>";
    return '<table class="rs-table mko-pt">' + dmHead("Place") + "<tbody>" + shown.map(o => {
      const p = o.k.split("|"), z = o.z;
      if (p[0] === "County") z.leads = 0;
      return "<tr><td>" + esc(p[1]) + (p[0] === "County" && !/county$/i.test(p[1]) ? ' <span class="mko-sub">county</span>' : "") + "</td>" + dmCells(z) + "</tr>";
    }).join("")
      + grey(list.length > shown.length ? "Every other place (" + fmtN(list.length - shown.length) + " more, plus the small ones)"
        : "Smaller places (under 20 impressions and no click in a month)", rest)
      + grey("The state named alone (no town)", { qc: whole.qc - parts.qc, qi: 0, pos: null, bp: whole.bp - parts.bp, cp: whole.cp - parts.cp, lp: whole.lp - parts.lp })
      + "</tbody></table>";
  }
  function dmStates(ms) {
    const set = new Set(ms);
    const rows = P.gsca.filter(r => set.has(r.m) && r.lvl === "State" && (!DM.st || r.st === DM.st));
    const by = {};
    rows.forEach(r => { (by[r.st] = by[r.st] || []).push(r); });
    const sts = Object.keys(by).map(st => ({ st, z: dmSum(by[st]) }))
      .filter(o => o.z.qc || o.z.qi || o.z.bp || o.z.cp || o.z.lp || o.z.leads)
      .sort((a, b) => (b.z.qi - a.z.qi) || (b.z.qc - a.z.qc));
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Where the demand comes from</span>'
      + '<span class="mko-sub">click a state for its cities and counties</span></div>'
      + '<p class="rs-hint">Only a search that <b>names a place</b> can be put in a state ("movers wilmington de"), plus the pages about a '
      + "place, so these are floors, not that state's whole demand.</p>"
      + '<div class="rs-tablewrap"><table class="rs-table mko-pt" id="mkoDmStates">' + dmHead("State") + "<tbody>"
      + sts.map(o => {
        const open = !!DM.open[o.st];
        return '<tr class="rs-group' + (open ? " on" : "") + '" data-st="' + esc(o.st) + '" tabindex="0"><td><span class="rs-caret">›</span> ' + esc(o.st) + "</td>" + dmCells(o.z) + "</tr>"
          + (open ? '<tr class="rs-sub"><td colspan="8"><div class="rs-sub-card">' + dmStateDetail(ms, o.st, o.z) + "</div></td></tr>" : "");
      }).join("")
      + '<tr class="mko-tot"><td>' + (DM.st ? esc(DM.st) : "All states") + "</td>" + dmCells(dmSum(rows)) + "</tr></tbody></table></div>"
      + '<div class="mkd-bandkey"><span><i class="b1"></i>positions 1–3</span><span><i class="b2"></i>4–10, page 1</span>'
      + '<span><i class="b3"></i>11–20</span><span><i class="b4"></i>21+, nobody scrolls there</span></div></div>';
  }
  function dmCities(ms, I) {
    const set = new Set(ms);
    const rows = P.gsca.filter(r => set.has(r.m) && r.lvl === "City" && r.vol != null && (!DM.st || r.st === DM.st));
    const by = {};
    rows.forEach(r => { const k = r.st + "|" + r.city; (by[k] = by[k] || []).push(r); });
    const mths = ms.reduce((a, m) => a + (I.days[m] || 0), 0) / 30.4375;
    const list = Object.keys(by).map(k => {
      const z = dmSum(by[k]), p = k.split("|");
      return { st: p[0], city: p[1], z, per: z.vol && mths ? 1000 * z.qc / (z.vol * mths) : null };
    }).sort((a, b) => (b.z.vol || 0) - (a.z.vol || 0));
    if (!list.length) return "";
    const T = { vol: 0, qc: 0 }, tags = {};
    list.forEach(o => { T.vol += o.z.vol || 0; T.qc += o.z.qc; const v = verdictOf(o.z.pos, o.z.qi); tags[v] = (tags[v] || 0) + 1; });
    const perAll = mths && T.vol ? 1000 * T.qc / (T.vol * mths) : null;
    const shown = DM.cityAll ? list : list.slice(0, 15);
    const count = k => tags[k] || 0;
    const tile = (n, label, cls) => '<div class="mkd-vt ' + cls + '"><b>' + n + "</b><span>" + esc(label) + "</span></div>";
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Are we winning it</span>'
      + '<span class="mko-sub">the ' + list.length + " cities with Keyword Planner volume · "
      + (perAll == null ? "—" : perAll.toFixed(2)) + " clicks per 1,000 searches</span></div>"
      + '<div class="mkd-verdicts">' + tile(count("Winning"), "winning, positions 1–3", "win") + tile(count("Page 1"), "on page 1", "p1")
      + tile(count("Page 2"), "on page 2", "p2") + tile(count("Invisible"), "invisible, 21 or worse", "inv")
      + tile(count("Rarely shown") + count("Not shown"), "shown too rarely to judge", "few") + "</div>"
      + '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>City</th><th class="mko-num" title="Keyword Planner: searches a month for movers in this city">Searches a month</th>'
      + '<th class="mko-num">Our clicks</th><th class="mko-num">Position</th><th>Verdict</th>'
      + '<th class="mko-num" title="our clicks per 1,000 Keyword Planner searches over these months">Clicks per 1,000</th>'
      + '<th class="mko-num">Leads</th><th class="mko-num">Jobs</th></tr></thead><tbody>'
      + shown.map(o => "<tr><td><b>" + esc(o.city) + '</b> <span class="mko-sub">' + esc(o.st) + "</span></td>"
        + '<td class="mko-num">' + fmtN(o.z.vol) + '</td><td class="mko-num"><b>' + fmtN(o.z.qc) + '</b></td><td class="mko-num">' + dmPos(o.z.pos)
        + "</td><td>" + dmPill(o.z.pos, o.z.qi) + '</td><td class="mko-num">' + (o.per == null ? "—" : o.per.toFixed(2))
        + '</td><td class="mko-num">' + fmtN(o.z.leads) + '</td><td class="mko-num">' + fmtN(o.z.jobs) + "</td></tr>").join("")
      + "</tbody></table></div>"
      + (list.length > 15 ? '<button type="button" class="rs-btn" id="mkoDmCities">' + (DM.cityAll ? "Show the top 15" : "Show all " + list.length) + "</button>" : "")
      + '<p class="rs-hint">Under ' + MIN_VERDICT_IMPR + " impressions an average position is a handful of searches, so there is no verdict.</p></div>";
  }
  function dmTopHtml(ms) {
    const set = new Set(ms), agg = {}, tail = {};
    let hidden = 0;
    P.gscq.forEach(r => {
      if (!set.has(r.m)) return;
      const clean = r.m >= GSC_CLEAN, i = clean ? r.imp : 0, pw = clean ? (r.pos || 0) * r.imp : 0;
      if (r.type === "Hidden by Google") { hidden += r.clk; return; }
      if (r.q === "(long tail)") { const t = tail[r.type] = tail[r.type] || { c: 0, i: 0 }; t.c += r.clk; t.i += i; return; }
      if (DM.st && r.st !== DM.st) return;
      const a = agg[r.q] = agg[r.q] || { q: r.q, type: r.type, st: r.st, city: r.city, c: 0, i: 0, pw: 0 };
      a.c += r.clk; a.i += i; a.pw += pw;
    });
    const all = Object.keys(agg).map(k => agg[k]);
    const brand = all.filter(a => a.type === "Brand");
    const brandT = { c: sum(brand, "c"), i: sum(brand, "i"), pw: sum(brand, "pw") };
    const q = DM.q.trim().toLowerCase();
    const list = all.filter(a => (!DM.qType || a.type === DM.qType) && (!q || a.q.indexOf(q) >= 0) && (DM.qType === "Brand" || q || a.type !== "Brand"))
      .sort((a, b) => (b.c - a.c) || (b.i - a.i));
    const shown = list.slice(0, DM_TOP), more = list.slice(DM_TOP);
    const counts = {};
    all.forEach(a => { counts[a.type] = (counts[a.type] || 0) + 1; });
    const row = a => '<tr><td class="mko-name">' + esc(a.q) + "</td><td>" + esc(a.type) + "</td><td>" + esc([a.city, a.st].filter(Boolean).join(", ") || "—")
      + '</td><td class="mko-num"><b>' + fmtN(a.c) + '</b></td><td class="mko-num">' + (a.i ? fmtN(a.i) : "—") + '</td><td class="mko-num">' + dmPos(a.i ? a.pw / a.i : null) + "</td></tr>";
    const grey = (label, type, c, i) => '<tr class="mkd-grey"><td>' + esc(label) + "</td><td>" + esc(type) + '</td><td>—</td><td class="mko-num">' + fmtN(c)
      + '</td><td class="mko-num">' + (i ? fmtN(i) : "—") + '</td><td class="mko-num">—</td></tr>';
    const plain = !DM.qType && !q;
    return { list, counts, html: '<div class="panel-head"><span class="panel-title">Top searches</span><span class="mko-sub">' + fmtN(list.length) + " searches match"
      + (more.length ? " · top " + DM_TOP + " shown" : "") + "</span></div>"
      + '<div class="mkd-dmtools"><span id="mkoDmType"></span><input class="mkd-in" id="mkoDmQ" aria-label="Find a word in the search" placeholder="Find a word in the search" value="' + esc(DM.q) + '">'
      + '<span class="rs-spacer"></span><button type="button" class="rs-btn" id="mkoDmCsv">Export CSV</button></div>'
      + '<div class="rs-tablewrap mkd-scroll"><table class="rs-table mko-pt"><thead><tr><th>Search</th><th>Type</th><th>Place named</th>'
      + '<th class="mko-num">Clicks</th><th class="mko-num">Impressions</th><th class="mko-num">Position</th></tr></thead><tbody>'
      + (plain && brand.length ? '<tr class="rs-group" id="mkoDmBrand" tabindex="0"><td>All brand searches <span class="mko-sub">' + fmtN(brand.length)
        + ' searches · open to list them</span></td><td>Brand</td><td>—</td><td class="mko-num">' + fmtN(brandT.c) + '</td><td class="mko-num">' + fmtN(brandT.i)
        + '</td><td class="mko-num">' + dmPos(brandT.i ? brandT.pw / brandT.i : null) + "</td></tr>" : "")
      + (shown.length ? shown.map(row).join("") : '<tr><td colspan="6" class="mko-sub">No search matches.</td></tr>')
      + (more.length ? grey("(" + fmtN(more.length) + " more listed searches, all in the CSV)", "—", sum(more, "c"), sum(more, "i")) : "")
      + (plain ? Object.keys(tail).map(k => grey("(long tail: rare searches)", k, tail[k].c, tail[k].i)).join("") + grey("(hidden by Google)", "—", hidden, 0) : "")
      + "</tbody></table></div>"
      + '<p class="rs-hint">A search is listed on its own once it earned a click or 50 impressions in a month; the rest is its type\'s long tail. '
      + "With no filter the rows add up to the site total. The State pick follows searches that name a place; the long tail and hidden rows name none.</p>" };
  }
  function dmTopPaint(el, ms) {
    const T = dmTopHtml(ms);
    el.innerHTML = T.html;
    RSC.localSelect(el.querySelector("#mkoDmType"), {
      label: "Type", allLabel: "Every type",
      values: QTYPES.map(k => ({ v: k, l: k, n: T.counts[k] || 0 })), value: DM.qType,
      onChange: v => { DM.qType = v; dmTopPaint(el, ms); },
    });
    let tq = null;
    el.querySelector("#mkoDmQ").oninput = e => {
      clearTimeout(tq);
      tq = setTimeout(() => {
        DM.q = e.target.value; dmTopPaint(el, ms);
        const inp = el.querySelector("#mkoDmQ");
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 220);
    };
    const br = el.querySelector("#mkoDmBrand");
    if (br) {
      const go = () => { DM.qType = "Brand"; dmTopPaint(el, ms); };
      br.onclick = go;
      br.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    }
    el.querySelector("#mkoDmCsv").onclick = () => {
      const cell = x => '"' + String(x == null ? "" : x).replace(/"/g, '""') + '"';
      const lines = [["Search", "Type", "State", "Place named", "Clicks", "Impressions (from " + GSC_CLEAN + ")", "Position"]]
        .concat(T.list.map(a => [a.q, a.type, a.st || "", a.city || "", a.c, a.i, a.i ? (a.pw / a.i).toFixed(1) : ""]));
      const blob = new Blob([lines.map(r => r.map(cell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "Organic searches (" + T.list.length + ").csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    };
  }
  function dmPages(ms) {
    const set = new Set(ms), agg = {};
    P.gscp.forEach(r => {
      if (!set.has(r.m) || (DM.st && r.st !== DM.st) || (DM.fam && r.fam !== DM.fam)) return;
      const a = agg[r.page] = agg[r.page] || { p: r.page, f: r.fam, st: r.st, place: r.place, c: 0, i: 0, pw: 0 };
      a.c += r.clk;
      if (r.m >= GSC_CLEAN) { a.i += r.imp; a.pw += r.pos * r.imp; }
    });
    const list = Object.keys(agg).map(k => agg[k]).sort((a, b) => (b.c - a.c) || (b.i - a.i)).slice(0, 25);
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Top landing pages</span><span id="mkoDmFam"></span></div>'
      + '<div class="rs-tablewrap mkd-scroll"><table class="rs-table mko-pt"><thead><tr><th>Page</th><th>Kind</th><th>Place</th>'
      + '<th class="mko-num">Clicks</th><th class="mko-num">Impressions</th><th class="mko-num">Position</th></tr></thead><tbody>'
      + (list.length ? list.map(a => '<tr><td class="mko-name">' + esc(pagePath(a.p)) + "</td><td>" + esc(a.f) + "</td><td>" + esc([a.place, a.st].filter(Boolean).join(", ") || "—")
        + '</td><td class="mko-num"><b>' + fmtN(a.c) + '</b></td><td class="mko-num">' + (a.i ? fmtN(a.i) : "—") + '</td><td class="mko-num">' + dmPos(a.i ? a.pw / a.i : null) + "</td></tr>").join("")
        : '<tr><td colspan="6" class="mko-sub">No page matches.</td></tr>')
      + "</tbody></table></div></div>";
  }
  function dmListings(ms, I) {
    const rows = P.gscp.filter(r => r.fam === "Business Profile listing" && (!DM.st || r.st === DM.st));
    if (!rows.length) return "";
    const by = {}, first = {}, tags = {}, meta = {};
    rows.forEach(r => {
      const o = by[r.page] = by[r.page] || {};
      o[r.m] = (o[r.m] || 0) + r.clk;
      if (r.clk || r.imp) first[r.page] = first[r.page] && first[r.page] < r.m ? first[r.page] : r.m;
      (r.tag ? String(r.tag).split(", ") : []).forEach(t => { (tags[r.page] = tags[r.page] || {})[t] = 1; });
      meta[r.page] = { st: r.st || "", place: r.place || "" };
    });
    const set = new Set(ms);
    const cols = I.list.filter(m => Object.keys(by).some(k => by[k][m])).slice(-12);
    const inWin = k => cols.reduce((a, m) => a + (set.has(m) ? by[k][m] || 0 : 0), 0);
    const keys = Object.keys(by).sort((a, b) => (inWin(b) - inWin(a)) || a.localeCompare(b));
    const mx = Math.max.apply(null, keys.map(k => Math.max.apply(null, cols.map(m => by[k][m] || 0)))) || 1;
    const heat = v => (!v ? '<span class="mko-sub">·</span>' : '<span class="mkd-heat" style="--h:' + Math.max(8, Math.round(100 * v / mx)) + '%">' + fmtN(v) + "</span>");
    return '<div class="panel"><div class="panel-head"><span class="panel-title">Business Profile listings</span>'
      + '<span class="mko-sub">website clicks by month · a month with clicks is the sign the listing is live</span></div>'
      + '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>Listing</th><th>First click</th>'
      + cols.map(m => '<th class="mko-num">' + esc(monShort(m)) + (I.whole(m) ? "" : "*") + "</th>").join("") + '<th class="mko-num">In the period</th></tr></thead><tbody>'
      + keys.map(k => "<tr><td><b>" + esc(meta[k].place ? meta[k].place + ", " + meta[k].st : (meta[k].st ? meta[k].st + ", statewide" : k)) + '</b> <span class="mko-sub">'
        + esc(Object.keys(tags[k] || {}).join(" · ")) + "</span></td><td>" + (first[k] ? esc(monShort(first[k])) : "—") + "</td>"
        + cols.map(m => '<td class="mko-num">' + heat(by[k][m] || 0) + "</td>").join("") + '<td class="mko-num"><b>' + fmtN(inWin(k)) + "</b></td></tr>").join("")
      + "</tbody></table></div>"
      + '<p class="rs-hint">Search Console sees only the click on the listing\'s <b>website</b> link: not calls, directions or views. A first click here is when its '
      + "tagged link first earned one, not when the listing was made.</p></div>";
  }
  function dmUnplaced(ms) {
    const set = new Set(ms), amb = {};
    P.gscq.forEach(r => {
      if (!set.has(r.m) || r.type !== "Movers + place" || r.st || !r.city) return;
      const a = amb[r.city] = amb[r.city] || { c: 0, i: 0, n: 0 };
      a.c += r.clk; a.i += r.imp; a.n++;
    });
    const keys = Object.keys(amb).sort((a, b) => amb[b].i - amb[a].i).slice(0, 15);
    return "<h3>Place names we could not put in one state</h3><p>A movers search naming a town several of our states share, with no state in the search and "
      + "no leads to break the tie, is left out of the state table.</p>"
      + (keys.length ? '<div class="rs-tablewrap"><table class="rs-table mko-pt"><thead><tr><th>Name in the search</th><th class="mko-num">Searches</th><th class="mko-num">Clicks</th>'
        + '<th class="mko-num">Impressions</th></tr></thead><tbody>' + keys.map(k => "<tr><td>" + esc(k) + '</td><td class="mko-num">' + fmtN(amb[k].n) + '</td><td class="mko-num">'
        + fmtN(amb[k].c) + '</td><td class="mko-num">' + fmtN(amb[k].i) + "</td></tr>").join("") + "</tbody></table></div>" : "<p>None in this period.</p>");
  }
  function demandPaint(box, ms0) {
    if (window.Chart) Object.values(Chart.instances || {}).forEach(ch => { if (ch.canvas && box.contains(ch.canvas)) ch.destroy(); });
    const err = P.err.gsca || P.err.gscq || P.err.gscp;
    if (err) {
      box.innerHTML = '<div class="mko-empty">Searches and demand could not load — ' + esc(err)
        + (/404|unknown dataset|not granted|403/i.test(err) ? " (it arrives with the next bridge deploy)" : "") + "</div>";
      return;
    }
    const I = dmInfo(), ms = ms0.filter(m => I.list.includes(m));
    if (!ms.length) { box.innerHTML = '<div class="mko-empty">No Search Console months in this period.</div>'; return; }
    const cur = dmClicks(ms);
    const back = S.cmp === "prev" ? ms.length : 12;
    const hasBack = m => I.whole(m) && I.list.includes(ymAdd(m, -back)) && I.whole(ymAdd(m, -back));
    const matched = ms.filter(hasBack);
    // one running month holds nothing whole: the last whole month before it answers instead
    const lastWhole = matched.length ? "" : I.list.filter(m => m < ms[0] && hasBack(m)).slice(-1)[0] || "";
    const cmpMs = matched.length ? matched : lastWhole ? [lastWhole] : [];
    const nowC = cmpMs.length ? dmClicks(cmpMs) : null, wasC = cmpMs.length ? dmClicks(cmpMs.map(m => ymAdd(m, -back))) : null;
    const brand = cur.t.Brand || 0, movers = (cur.t["Movers near me"] || 0) + (cur.t["Movers + place"] || 0) + (cur.t["Movers generic"] || 0);
    const set = new Set(ms), nList = new Set();
    let listing = 0;
    P.gscp.forEach(r => { if (set.has(r.m) && r.fam === "Business Profile listing") { listing += r.clk; nList.add(r.page); } });
    const running = ms.filter(m => !I.whole(m));
    const cmpSub = nowC ? monthSpan(cmpMs) + " " + (S.cmp !== "prev" ? "vs a year earlier" : back === 1 ? "vs the month before" : "vs the months before")
      + ": " + fmtN(wasC.site) + " to " + fmtN(nowC.site) : "no whole month to compare";
    const cleanNote = ms.some(m => m < GSC_CLEAN) ? '<p class="mkd-note">Impressions and position count from ' + esc(monthWord(GSC_CLEAN)) + " only: Google changed how it counts on "
      + GSC_BREAK + ", so earlier months cannot be compared. Clicks were not affected.</p>" : "";
    box.innerHTML = '<div class="mkd-dmbar"><span class="mko-sub">' + esc(monthSpan(ms))
      + (running.length === ms.length ? " to date, still filling" : (running.length ? " · " + esc(monthWord(running[running.length - 1])) + " still filling" : "")
        + " · whole months, from the Period above")
      + "</span><span class=\"rs-spacer\"></span><span id=\"mkoDmState\"></span></div>"
      + '<section class="mkd-kpis" aria-label="Organic search in numbers">'
      + tileHtml("Organic clicks", fmtN(cur.site), matched.length ? chipHtml(nowC.site, wasC.site, false) : "", esc(cmpSub))
      + tileHtml("Brand share", pct(ratio(brand, cur.named)), "", "of the clicks Google names: people who searched for us by name")
      + tileHtml("Movers searches", fmtN(movers), "", pct(ratio(movers, cur.named)) + " of named clicks · " + fmtN(cur.t["Movers + place"] || 0) + " named a place")
      + tileHtml("Hidden by Google", pct(ratio(cur.hidden, cur.site)), "", "clicks Google counts but never names")
      + tileHtml("Listing clicks", fmtN(listing), "", "website-link clicks on " + nList.size + " Business Profile listings")
      + "</section>" + cleanNote
      + (S.co === "Tuji" ? '<p class="mkd-note">Search Console covers ziptozipmoving.com only, so this is the Zip to Zip site whichever company is picked.</p>' : "")
      + '<div id="mkoDmWho"></div>' + dmStates(ms) + dmCities(ms, I)
      + '<div class="panel" id="mkoDmTop"></div><div id="mkoDmPg"></div>' + dmPages(ms) + dmListings(ms, I)
      + '<details class="mkd-more"><summary>How to read these numbers</summary><div class="mkd-morein">'
      + "<ul><li><b>Search Console never says where the searcher was.</b> A place comes only from the words of the search or the page they landed on, so every place "
      + "figure is a floor. Keyword Planner's volume is the demand number.</li><li><b>Google hides about " + pct(ratio(cur.hidden, cur.site)) + " of clicks</b> from the list of searches; the "
      + "hidden remainder keeps every search total equal to the site total.</li><li><b>Impressions and position changed meaning on " + GSC_BREAK + ".</b> Across that date a compare "
      + "would show a fake collapse, so it is clicks only, and impressions count from " + esc(monthWord(GSC_CLEAN)) + ".</li><li><b>Summer 2025 is capped</b>: each day to 11 Sep 2025 holds "
      + "5,000 searches, so rare searches are missing there. Clicks look unaffected.</li><li><b>Leads are context, not cause.</b> The lead side cannot separate paid Google from organic, and "
      + "ChatGPT leads never pass through Search Console.</li><li>Google finalises a day about 3 days late.</li></ul>" + dmUnplaced(ms) + "</div></details>";

    const repaint = () => demandPaint(box, ms0);
    const states = Array.from(new Set(P.gsca.filter(r => r.lvl === "State" && r.st).map(r => r.st))).sort();
    RSC.localSelect(box.querySelector("#mkoDmState"), {
      label: "State", allLabel: "All states", values: states.map(v => ({ v, l: v })), value: DM.st,
      onChange: v => { DM.st = v; repaint(); },
    });
    const fams = Array.from(new Set(P.gscp.map(r => r.fam))).sort();
    RSC.localSelect(box.querySelector("#mkoDmFam"), {
      label: "Kind of page", allLabel: "Every kind", values: fams.map(v => ({ v, l: v })), value: DM.fam,
      onChange: v => { DM.fam = v; repaint(); },
    });
    box.querySelectorAll("#mkoDmStates tr.rs-group").forEach(tr => {
      const go = () => { const st = tr.getAttribute("data-st"); DM.open[st] = !DM.open[st]; repaint(); };
      tr.onclick = go;
      tr.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    const ca = box.querySelector("#mkoDmCities");
    if (ca) ca.onclick = () => { DM.cityAll = !DM.cityAll; repaint(); };
    dmTopPaint(box.querySelector("#mkoDmTop"), ms);
    const endM = ms[ms.length - 1], lastM = I.list.filter(m => m <= endM).slice(-13);
    const stack = (el, key, title, series, val, note) => RSC.chartCard(el, {
      title, key,
      buildChart(canvas) {
        return new Chart(canvas, { type: "bar",
          data: { labels: lastM.map(m => monShort(m) + (I.whole(m) ? "" : "*")),
                  datasets: series.map(([k, col]) => ({ label: k, data: lastM.map(m => val(m, k)), backgroundColor: col, stack: "a" })) },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
            scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true } }, y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } } } } });
      },
      buildTable() {
        return ptable([{ h: "Month", cell: m => esc(monthWord(m)) }].concat(series.map(([k]) => ({ h: k, num: true, cell: m => fmtN(val(m, k)) }))), lastM.slice().reverse());
      },
    });
    const byQ = {}, byP = {};
    P.gscq.forEach(r => { const o = byQ[r.m] = byQ[r.m] || {}, k = qBucket(r.type); o[k] = (o[k] || 0) + r.clk; });
    P.gscp.forEach(r => { if (DM.st && r.st !== DM.st) return; const o = byP[r.m] = byP[r.m] || {}, k = pBucket(r.fam); o[k] = (o[k] || 0) + r.clk; });
    stack(box.querySelector("#mkoDmWho"), "mko-dm-who", "Who finds us: clicks by what was searched", Q_CHART, (m, k) => (byQ[m] || {})[k] || 0);
    stack(box.querySelector("#mkoDmPg"), "mko-dm-pg", "Which pages win: clicks by the page they landed on", PAGE_CHART, (m, k) => (byP[m] || {})[k] || 0);
  }

  /* SEARCH AND SEO IN TOPICS (2026-10-23, the marketing head: "click a topic and it opens its full data";
     his pick: topic tabs). The KPI strip stays on top, one topic shows at a time, and the page keeps the
     last one (LS_SEO). */
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
    const rep = seoReport(gw, w, cw, ms);
    const topic = SEO_TOPICS.some(t => t[0] === S.seoTopic) ? S.seoTopic : "ov";
    const nav = '<nav class="mko-topics" aria-label="Search and SEO topics">' + SEO_TOPICS.map(([k, l]) =>
      '<button type="button" data-topic="' + k + '"' + (k === topic ? ' class="on" aria-current="true"' : "") + ">"
      + esc(l) + "</button>").join("") + "</nav>";
    const panel = (title, sub, body) => '<div class="panel"><div class="panel-head"><span class="panel-title">' + title
      + '</span><span class="mko-sub">' + sub + "</span></div>" + body + "</div>";
    const card = (title, sub, body) => '<div class="mkd-card"><div class="mkd-h"><h2>' + title + "</h2><span>" + sub
      + "</span></div>" + body + "</div>";
    const topics = {
      ov: () => '<div class="mkd-g2">'
        + card("What people searched", esc(monthSpan(ms)) || "Search Console", queryMixHtml(ms))
        + card("Who AI answers recommend", "ChatGPT and Google AI Overviews", aiMixHtml()) + "</div>"
        + (gate || rep.parts.ov)
        + panel("Us and the competitors · Semrush", (smLast(P.smOrg) ? esc(day(smLast(P.smOrg))) + " · " : "") + "weekly, US",
          smSitesHtml()),
      kw: () => (gate || rep.parts.kw + panel("Search clicks", "Google search" + (gw && gw.last ? " · data through " + esc(day(gw.last)) : ""),
          '<div id="mkoC-gsc"></div>') + '<div class="mko-g2e">'
        + panel("Top queries", esc(monthSpan(ms)) + " (the query list is monthly)"
          + (allClk ? " · searches for our name bring " + pct(brandClk / allClk) + " of the clicks" : ""), ptable([
          { h: "Query", name: true, cell: q => esc(q.q) + " " + pill(q.type === "Brand" ? "brand" : q.type, q.type === "Brand" ? "mute" : "ok") },
          { h: "Clicks", num: true, cell: q => fmtN(q.clk) },
          { h: "Impr.", num: true, tip: "impressions", cell: q => fmtN(q.imp) },
          { h: "Position", num: true, tip: "average, weighted by impressions", cell: q => q.pos == null ? "—" : q.pos.toFixed(1) },
        ], qs.slice(0, 10), null, true))
        + panel("Keywords by service", esc(monthSpan(ms)) + " · Search Console, monthly", svcHtml(qs)) + "</div>")
        + panel("Top keywords · Semrush", (P.smKwDay ? esc(day(P.smKwDay)) + " · " : "") + "by traffic, weekly"
          + (P.sm.org && P.sm.org.kw ? " · of " + fmtN(P.sm.org.kw) + " keywords Semrush ranks us for" : ""), smKwHtml()),
      demand: () => gate || '<div id="mkoDm"></div>',
      blog: () => gate || rep.parts.blog,
      links: () => { const cite = citeHtml(w); return (CITE_TODO.length ? panel("What to do", "from the numbers below",
          '<ol class="mko-ctodo">' + CITE_TODO.map(t => "<li>" + t + "</li>").join("") + "</ol>") : "") + rep.parts.links
        + panel("Authority Score bands · Semrush", (smAsDays() ? esc(day(smAsDays().cur)) + " · " : "") + "daily", smBandsHtml())
        + cite
        + panel("Off-page · Ahrefs and Semrush", [snap ? "Ahrefs " + esc(day(snap.d)) : "", P.sm.ov ? "Semrush " + esc(day(P.sm.ov.d)) : ""]
            .filter(Boolean).join(" · ") || "no snapshot yet",
          P.err.ahd && !P.sm.ov ? '<div class="mko-empty">Ahrefs could not load — ' + esc(P.err.ahd) + "</div>" : !snap && !P.sm.ov ? "" :
          '<div class="rs-kpis" id="mkoK-ah"></div><div id="mkoC-ah"></div>'
          + '<p class="rs-hint">Each tool\'s own estimates from its crawler and keyword panel, side by side and never added up; '
          + "not our measured traffic (that is Search Console and Analytics).</p>"); },
      ai: () => aiVisHtml(),
      onpage: () => panel("On-page · Ahrefs Site Audit", P.audit ? "crawl " + esc(day(P.audit.crawl)) : "no crawl yet", onPageHtml())
        + panel("On-page · Semrush Site Audit", P.sm.aud && P.sm.aud.crawl ? "crawl " + esc(day(P.sm.aud.crawl)) : "weekly", smAuditHtml()),
      local: () => panel("Local rankings · BrightLocal", "weekly rank reports, Mondays", blHtml()
        + '<p class="rs-hint">Citation Tracker is not in BrightLocal\'s Management API, so its citations are not '
        + "pulled; the Backlinks and citations topic maps every site linking to us from Ahrefs.</p>"),
    };
    // Searches and demand carries its own tiles for its own months: no second row above it
    const html = (topic === "demand" ? "" : '<div class="rs-kpis" id="mkoK-seo"></div>') + nav + topics[topic]();
    return { html, wire(host) {
      const on = !!(gw && gw.cw);
      // impressions and position changed meaning on 12-13 Sep 2025: no delta across that date
      const same = on && gw.cw.a >= GSC_CLEAN + "-01", notSame = "not comparable across Sep 2025";
      // the average rises by itself when deep-ranked impressions disappear: no credit for that
      const deep = same && prev.imp && prev.pos && cur.imp <= 0.6 * prev.imp && cur.pos < prev.pos;
      if (host.querySelector("#mkoDm")) demandPaint(host.querySelector("#mkoDm"), ms);
      if (host.querySelector("#mkoK-seo")) RSC.kpis(host.querySelector("#mkoK-seo"), [
        kp("Search clicks", cur.clk, on ? prev.clk : undefined, fmtN, false,
           rep.best ? "best month " + monthWord(rep.best.m) + ": " + fmtN(rep.best.clk) : "Search Console", gw),
        kp("Search impressions", cur.imp, same ? prev.imp : undefined, compact, false, (on && !same ? notSame + " · " : "") + "CTR " + pct2(ratio(cur.clk, cur.imp)), gw),
        { label: "Avg position", value: (cur.pos == null ? "—" : cur.pos.toFixed(1))
            + (same && prev.pos ? (deep ? posDelta(cur.pos, prev.pos).replace("mko-d up", "mko-d eq") : posDelta(cur.pos, prev.pos)) : ""),
          sub: deep ? "was " + prev.pos.toFixed(1) + "; deep-ranked impressions fell"
            : same && prev.pos ? (S.cmp === "prev" ? "previous" : "last year") + ": " + prev.pos.toFixed(1) + " · lower is better" : on ? notSame : "lower is better" },
        kp("Brand share", rep.brand.share, rep.brandPrev ? rep.brandPrev.share : undefined, pct, null,
           fmtN(rep.brand.kw) + " keywords with clicks · " + rep.spanCur, gw),
        { label: "Authority", value: two(snap && snap.dr != null ? snap.dr : null, P.sm.ov ? P.sm.ov.as : null, v => String(Math.round(v))),
          sub: "Domain Rating · Authority Score, out of 100" },
        { label: "New linking sites", value: fmtN(rep.lk.sites) + (rep.lkPrev ? delta(rep.lk.sites, rep.lkPrev.sites, null) : ""),
          sub: fmtN(rep.lk.clean.length) + " clean · " + fmtN(rep.lk.spam) + " flagged spam · Ahrefs" },
      ]);
      host.querySelectorAll(".mko-topics [data-topic]").forEach(b => {
        b.onclick = () => {
          S.seoTopic = b.dataset.topic; lsSet(LS_SEO, S.seoTopic); paint(host);
          const tn = host.querySelector(".mko-topics");
          if (tn && tn.getBoundingClientRect().top < 0) tn.scrollIntoView({ block: "start" });
        };
      });
      rep.wire(host);           // the month chart and the new links, wherever their boxes are on the page
      citeWire(host, w);
      smBandsWire(host);
      aiWire(host);
      if (!gate && host.querySelector("#mkoC-gsc")) {
        const keys = bucketsOf(gw.a, gw.b, gw.g);
        barCard(host.querySelector("#mkoC-gsc"), "gsc-clk", "Search clicks by " + GRAIN_WORD[gw.g], keys, gw.g,
                seriesOf(gRows, keys, gw.g, r => r.clk), fmtN, "main");
      }
      if ((snap || P.sm.ov) && host.querySelector("#mkoK-ah")) {
        const A = snap || {}, so = P.sm.ov || {}, sg = P.sm.org || {};
        RSC.kpis(host.querySelector("#mkoK-ah"), [
          { label: "Referring domains", value: two(A.rd, so.rd, fmtN), sub: "live" },
          { label: "Backlinks", value: two(A.bl, so.bl, compact), sub: "live" },
          { label: "Organic keywords", value: two(A.kw, sg.kw, fmtN), sub: "US" },
          { label: "Organic traffic", value: two(A.traffic, sg.traffic, fmtN), sub: "estimate a month" },
        ]);
        const smM = {};
        P.smHist.forEach(r => { smM[r.m] = r; });
        const hist = P.ahm.slice(-12);
        if (hist.length) {
          RSC.chartCard(host.querySelector("#mkoC-ah"), {
            title: "Organic traffic estimate by month", key: "mko-ah-traffic",
            buildChart(canvas) {
              const C = palette();
              return new Chart(canvas, { type: "line",
                data: { labels: hist.map(r => monthWord(r.m)), datasets: [{ label: "Ahrefs", data: hist.map(r => r.traffic),
                  borderColor: C.main, backgroundColor: C.main, borderWidth: 2, pointRadius: 2, cubicInterpolationMode: "monotone" },
                  { label: "Semrush", data: hist.map(r => (smM[r.m] ? smM[r.m].traffic : null)), spanGaps: true,
                    borderColor: C.alt, backgroundColor: C.alt, borderWidth: 2, pointRadius: 2, cubicInterpolationMode: "monotone" }] },
                options: { responsive: true, maintainAspectRatio: false,
                  plugins: { legend: { display: P.smHist.length > 0, position: "top", labels: { boxWidth: 12 } } },
                  scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
            },
            buildTable() {
              return ptable([{ h: "Month", cell: r => esc(monthWord(r.m)) },
                { h: "Organic traffic", num: true, cell: r => fmtN(r.traffic) },
                { h: "Semrush traffic", num: true, cell: r => fmtN(smM[r.m] ? smM[r.m].traffic : null) },
                { h: "Domain rating", num: true, cell: r => r.dr == null ? "—" : String(Math.round(r.dr)) },
                { h: "Authority Score", num: true, tip: "Semrush", cell: r => smM[r.m] && smM[r.m].as != null ? String(smM[r.m].as) : "—" },
                { h: "Referring domains", num: true, tip: "Ahrefs' monthly history count (a stricter definition than the live figure)",
                  cell: r => r.rdh == null ? "—" : fmtN(r.rdh) }], hist.slice().reverse());
            },
          });
        }
      }
    } };
  }

  /* the Overview topic's two cards (2026-10-29): what the months' searches were, and who AI answers name */
  function hbHtml(rows) {
    const mx = Math.max.apply(null, rows.map(r => r.n)) || 1;
    return rows.map(r => '<div class="mkd-hb"><span' + (r.strong ? ' class="us"' : "") + ">" + esc(r.k) + '</span><span class="tr" aria-hidden="true"><i'
      + (r.strong ? ' class="now"' : "") + ' style="width:' + Math.max(1, Math.round(100 * r.n / mx)) + '%"></i></span><b>'
      + fmtN(r.n) + "</b></div>").join("");
  }
  function queryMixHtml(ms) {
    const rows = P.gscq.filter(r => ms.includes(r.m));
    if (!rows.length) return '<div class="mko-empty">No search list for these months yet.</div>';
    const by = groupBy(rows, r => r.type).map(x => ({ k: x.k, n: sum(x.rows, "clk") })).filter(x => x.n > 0);
    const hidden = (by.find(x => x.k === "Hidden by Google") || {}).n || 0;
    const named = by.filter(x => x.k !== "Hidden by Google").sort((a, b) => b.n - a.n);
    const tot = sum(named, "n"), brand = (named.find(x => x.k === "Brand") || {}).n || 0;
    return hbHtml(named.map(x => ({ k: x.k === "Brand" ? "Our own name" : x.k, n: x.n, strong: x.k === "Brand" })))
      + '<p class="rs-hint">' + fmtN(tot) + " clicks Google names" + (hidden ? ", and " + fmtN(hidden) + " more it hides" : "")
      + (tot ? ". Searches for our own name are " + pct(brand / tot) + " of the named clicks; the rest are people still choosing a mover." : ".") + "</p>";
  }
  function aiMixHtml() {
    const m = aiModel();
    if (!m) return '<div class="mko-empty">No AI answers read yet.</div>';
    const top = m.rows.filter(r => r.men > 0 || r.us).slice(0, 6);
    return hbHtml(top.map(r => ({ k: r.b, n: r.men, strong: r.us })))
      + '<p class="rs-hint">We are named in ' + fmtN(m.usAns) + " of " + fmtN(m.answers) + " answers ("
      + esc(m.engines.map(e => e[1]).join(" + ")) + ", " + esc(m.dates.map(day).join(", "))
      + "). Leads from AI answers never pass through Search Console. The AI answers topic has the questions we miss.</p>";
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
  /* === SEMRUSH beside Ahrefs (2026-10-27, his pick: the same tiles) ===
     src/semrush_mcp.py pulls the Authority numbers daily and the rest weekly through Semrush's own connector. */
  function two(a, s, f) {
    const one = (v, who) => '<span class="mko-two">' + (v == null ? "—" : f(v)) + "<i>" + who + "</i></span>";
    return one(a, "Ahrefs") + one(s, "Semrush");
  }
  const smErr = () => P.err.smov || P.err.smas || P.err.smorg || P.err.smkw || P.err.smaud || P.err.smhist;
  function smWait(what) {
    const e = smErr();
    return '<div class="mko-empty">' + (e ? "Semrush could not load — " + esc(e)
      + (/404|unknown dataset|not granted|403/i.test(e) ? " (it arrives with the next bridge deploy)" : "")
      : "The first Semrush " + what + " arrives with the next daily pull.") + "</div>";
  }
  // the marketing head's bands of the sites linking to us, by Semrush Authority Score
  const SM_BANDS = [["b0", "AS 0–2", 0, 2, "where Semrush puts link farms"], ["b1", "AS 3–19", 3, 19, "weak"],
                    ["b2", "AS 20–39", 20, 39, "solid"], ["b3", "AS 40+", 40, 100, "strong"]];
  function smBands(rows) {
    const tot = rows.reduce((s, r) => s + r.n, 0);
    return SM_BANDS.map(([cls, label, lo, hi, what]) => {
      const n = rows.filter(r => r.as >= lo && r.as <= hi).reduce((s, r) => s + r.n, 0);
      return { cls, label, what, n, share: tot ? n / tot : null, tot };
    });
  }
  // the newest profile, and the one nearest 30 days before it to compare against
  function smAsDays() {
    const days = [...new Set(P.smAs.map(r => r.d))].sort();
    if (!days.length) return null;
    const cur = days[days.length - 1], prev = days.filter(d => d <= addDays(cur, -30)).pop() || null;
    return { cur, prev, rows: P.smAs.filter(r => r.d === cur), prevRows: prev ? P.smAs.filter(r => r.d === prev) : null };
  }
  function smBandsHtml() {
    const x = smAsDays();
    if (!x) return smWait("Authority Score profile");
    const b = smBands(x.rows), tot = b[0].tot;
    return '<div class="rs-kpis" id="mkoK-smb"></div>'
      + '<div class="mko-bands" role="img" aria-label="Sites linking to us by Semrush Authority Score band">'
      // the smallest bands get room for their label; the tiles above carry the exact counts
      + b.filter(r => r.n).map(r => '<span class="' + r.cls + '" style="flex:' + Math.max(r.n, tot * 0.12).toFixed(0) + '" title="'
        + esc(r.label) + ": " + fmtN(r.n) + " sites, " + pct(r.share) + '">'
        + esc(r.label) + ": " + fmtN(r.n) + "</span>").join("") + "</div>"
      + '<p class="rs-hint">Semrush\'s Authority Score of every site linking to us, in the bands the marketing team '
      + "works with. The citation map below reads Ahrefs' Domain Rating and spam flag instead.</p>";
  }
  function smBandsWire(host) {
    const x = smAsDays(), box = host.querySelector("#mkoK-smb");
    if (!x || !box) return;
    const b = smBands(x.rows), pb = x.prevRows ? smBands(x.prevRows) : null;
    RSC.kpis(box, b.map((r, i) => ({ label: r.label, value: fmtN(r.n) + (pb ? delta(r.n, pb[i].n, i === 0) : ""),
      sub: pct(r.share) + " of " + fmtN(r.tot) + " · " + r.what + (pb ? " · vs " + shortDay(x.prev) : "") })));
  }
  // us, Tuji and the Brand Radar competitors with a known website (src/semrush_mcp.SITES)
  const SM_SITES = [["Zip to Zip Moving", "ziptozipmoving.com"], ["Tuji Moving", "tujimoving.com"],
    ["Piece of Cake Moving", "pieceofcakemoving.com"], ["Two Men and a Truck", "twomenandatruck.com"],
    ["Allied Van Lines", "allied.com"], ["North American Van Lines", "northamerican.com"], ["U-Pack", "upack.com"],
    ["PODS", "pods.com"], ["U-Haul", "uhaul.com"], ["United Van Lines", "unitedvanlines.com"]];
  function smSitesHtml() {
    const lastOf = (rows, s) => rows.filter(r => r.t === s).pop() || null;
    const rows = SM_SITES.map(([name, dom]) => ({ name, dom, us: dom === SM_US, ov: lastOf(P.smOv, dom), org: lastOf(P.smOrg, dom) }))
      .filter(r => r.ov || r.org).sort((a, b) => ((b.ov && b.ov.as) || 0) - ((a.ov && a.ov.as) || 0));
    if (!rows.some(r => !r.us)) return smWait("competitor comparison");
    return ptable([
      { h: "Site", name: true, cell: r => (r.us ? "<b>" + esc(r.name) + "</b>" : esc(r.name)) + '<div class="mko-sub">' + esc(r.dom) + "</div>" },
      { h: "Authority", num: true, tip: "Semrush Authority Score, out of 100", cell: r => r.ov && r.ov.as != null ? String(r.ov.as) : "—" },
      { h: "Ref. domains", num: true, tip: "sites linking to it", cell: r => fmtN(r.ov && r.ov.rd) },
      { h: "Backlinks", num: true, cell: r => compact(r.ov && r.ov.bl) },
      { h: "Keywords", num: true, tip: "organic keywords, US", cell: r => fmtN(r.org && r.org.kw) },
      { h: "Traffic", num: true, tip: "Semrush's organic traffic estimate a month, US", cell: r => fmtN(r.org && r.org.traffic) },
      { h: "Traffic value", num: true, tip: "what that traffic would cost as Google ads", cell: r => money(r.org && r.org.cost) },
    ], rows, null, true);
  }
  function smKwHtml() {
    if (!P.smKw.length) return smWait("keyword list");
    const mv = r => r.pos == null || r.prev == null || r.prev === r.pos ? ""
      : !r.prev ? ' <span class="mko-d eq">new</span>'
      : ' <span class="mko-d ' + (r.prev > r.pos ? "up" : "dn") + '">' + (r.prev > r.pos ? "▲ " : "▼ ") + Math.abs(r.prev - r.pos) + "</span>";
    return ptable([
      { h: "Keyword", name: true, cell: r => esc(r.kw) + '<div class="mko-sub">' + esc(pagePath(r.url)) + "</div>" },
      { h: "Position", num: true, tip: "Google, US; the arrow is the change since Semrush's previous check", cell: r => (r.pos == null ? "—" : String(r.pos)) + mv(r) },
      { h: "Searches", num: true, tip: "a month, US", cell: r => fmtN(r.vol) },
      { h: "Traffic share", num: true, tip: "of our Semrush organic traffic estimate", cell: r => r.share == null ? "—" : r.share.toFixed(1) + "%" },
    ], P.smKw.slice(0, 15), null, true);
  }
  function smAuditHtml() {
    const a = P.sm.aud;
    if (!a) return smWait("Site Audit summary");
    const tj = P.smAud.filter(r => r.t === "tujimoving.com").pop();
    const ch = a.errCh ? ' <span class="mko-d ' + (a.errCh > 0 ? "dn" : "up") + '">' + (a.errCh > 0 ? "▲ " : "▼ ") + fmtN(Math.abs(a.errCh)) + "</span>" : "";
    return '<div class="rs-kpis mko-k3"><div class="kpi"><div class="l">Errors</div><div class="v">' + fmtN(a.err) + ch
      + '</div><div class="s">issues found on the crawl</div></div>'
      + '<div class="kpi"><div class="l">Warnings</div><div class="v">' + fmtN(a.warn) + '</div><div class="s">'
      + fmtN(a.note) + " notices</div></div>"
      + '<div class="kpi"><div class="l">Pages with issues</div><div class="v">' + fmtN(a.issues) + '</div><div class="s">of '
      + fmtN(a.crawled) + " crawled</div></div></div>"
      + '<p class="rs-hint">Semrush counts issues, and one page can carry several; Ahrefs above counts pages.'
      + (tj ? " Tuji Moving: " + fmtN(tj.err) + " errors and " + fmtN(tj.warn) + " warnings on " + fmtN(tj.crawled) + " pages." : "")
      + "</p>";
  }
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
  /* === CITATIONS (2026-10-23, the marketing head's citation map; his picks: from Ahrefs, not Semrush) ===
     Every domain linking to us (ext_ahrefs_refdomain, pulled weekly): Domain Rating stands in for
     Semrush's Authority Score and Ahrefs' spam flag for its 0-2 tier. A domain's TYPE comes from the
     lists below first, then from words in its name; everything else is "Blogs and other". */
  const CITE_OTHER = "Blogs and other";
  const CITE_TYPES = [
    ["Reviews and ratings", ["bbb.org", "homeadvisor.com", "birdeye.com", "consumeraffairs.com", "yelp.com", "trustpilot.com",
      "angi.com", "angieslist.com", "thumbtack.com", "houzz.com", "porch.com", "bark.com", "provenexpert.com",
      "threebestrated.com", "expertise.com", "mymovingreviews.com", "moverreviews.com", "sitejabber.com", "clutch.co",
      "trustindex.io", "topratedlocal.com", "reviewsdir.com"],
     /review|rating|rated|trust|yelp|angi|thumbtack|houzz|porch|bark/],
    ["Directories", ["yellowpages.com", "yp.com", "manta.com", "mapquest.com", "dexknows.com", "superpages.com",
      "citysquares.com", "freelistingusa.com", "find-us-here.com", "loc8nearme.com", "bizapedia.com", "crunchbase.com",
      "theorg.com", "chamberofcommerce.com", "hotfrog.com", "cylex.us.com", "brownbook.net", "merchantcircle.com",
      "ezlocal.com", "showmelocal.com", "bestprosintown.com", "bippermedia.com", "n49.com", "foursquare.com",
      "yahoo.com", "bing.com", "apple.com", "nearfinderus.com", "us-business.info", "storeboard.com"],
     /yellowpages|directory|listing|citysquares|manta|mapquest|chamber|superpages|hotfrog|cylex|brownbook|merchantcircle|showmelocal|ezlocal|bizapedia/],
    ["Moving and storage", ["unpakt.com", "extraspace.com", "moving.com", "movers.com"],
     /mov(e|er|ers|ing)|relocat|van-?lines|storage/],
    ["Press", ["accessnewswire.com", "phillymag.com", "artdaily.com", "artdaily.cc", "usatoday.com", "nj.com", "patch.com",
      "digitaljournal.com", "prnewswire.com", "einpresswire.com", "newswire.com", "app.com"],
     /news|times|press|journal|herald|gazette|tribune|magazine/],
    ["Social", ["facebook.com", "instagram.com", "linkedin.com", "pinterest.com", "youtube.com", "tiktok.com", "x.com",
      "twitter.com", "reddit.com", "nextdoor.com", "medium.com", "quora.com", "tumblr.com", "substack.com"], null],
  ];
  const CITE_ORDER = CITE_TYPES.map(t => t[0]).concat([CITE_OTHER]);
  const CITE_COLOR = { "Reviews and ratings": "#14301F", Directories: "#3F7D20", "Moving and storage": "#7FA864",
                       Press: "#A9C793", Social: "#C9DABD", [CITE_OTHER]: "#A3ADA5" };
  function citeType(dom) {
    const d = String(dom || "").replace(/^www\./, "");
    for (const [t, list] of CITE_TYPES) if (list.some(x => d === x || d.endsWith("." + x))) return t;
    for (const [t, , rx] of CITE_TYPES) if (rx && rx.test(d)) return t;
    return CITE_OTHER;
  }
  // anchors that sell links: the September 2026 waves ("Premium SEO Links...", "DR boost services...")
  const SPAM_ANCHOR = /\bseo\b|backlink|link (insertion|package|building)|\bpbn\b|telegram|guest post|dr boost|authority link|dofollow|casino|crypto/i;
  // the review sites and directories a mover should be listed on (the "what to do" list names the missing)
  const KEY_SITES = ["yelp.com", "bbb.org", "angi.com", "thumbtack.com", "trustpilot.com", "homeadvisor.com",
                     "yellowpages.com", "nextdoor.com", "mapquest.com", "facebook.com", "houzz.com", "porch.com"];
  // hosting and CDN domains carry links for whatever they host: not a citation, so never counted
  const CITE_INFRA = /(^|\.)(cloudfront\.net|cloudflare\.net|azurewebsites\.net|amazonaws\.com|googleusercontent\.com|herokuapp\.com|netlify\.app|vercel\.app|github\.io|za\.com)$/;
  function citeStats(a, b) {
    const doms = P.refdom.filter(r => !CITE_INFRA.test(r.dom));
    const live = doms.filter(r => !r.last), lost = doms.filter(r => r.last);
    const clean = live.filter(r => !r.spam), dr = r => r.dr || 0;
    return { live, lost, clean, spam: live.filter(r => r.spam),
             strong: clean.filter(r => dr(r) >= 40), mid: clean.filter(r => dr(r) >= 20 && dr(r) < 40),
             lostClean: lost.filter(r => !r.spam && dr(r) >= 20),
             newIn: live.filter(r => r.first && r.first >= a && r.first <= b),
             newSpam: live.filter(r => r.spam && r.first && r.first >= a && r.first <= b) };
  }
  /* the two charts side by side under the map, as on the marketing head's own dashboard (2026-10-26:
     "it was easier to read there -- bring it over exactly"): clean sites from DR 20 by type, live
     (solid DR 40+, light DR 20-39) and no longer linking; and every live site by Domain Rating band,
     the spam flag stacked in red -- the lowest band is almost all spam. */
  const CITE_BANDS = [[0, 20, "DR 0–19"], [20, 40, "DR 20–39"], [40, 60, "DR 40–59"], [60, 80, "DR 60–79"], [80, 101, "DR 80+"]];
  function citeBreakdowns(st) {
    const dr = r => r.dr || 0;
    const byType = CITE_ORDER.map(t => {
      const xs = st.clean.filter(r => r.type === t && dr(r) >= 20);
      return { k: t, strong: xs.filter(r => dr(r) >= 40).length, mid: xs.filter(r => dr(r) < 40).length,
               lost: st.lostClean.filter(r => r.type === t).length,
               top: xs.slice().sort((a, b) => dr(b) - dr(a)).slice(0, 3).map(r => r.dom) };
    });
    const mix = CITE_BANDS.map(([lo, hi, k]) => {
      const xs = st.live.filter(r => dr(r) >= lo && dr(r) < hi);
      return { k, clean: xs.filter(r => !r.spam).length, spam: xs.filter(r => r.spam).length };
    });
    return { byType, mix };
  }
  // us at the centre; each clean site from DR 20 in its type's sector, closer = stronger, hollow = lost
  function citeMapSvg(st) {
    const W = 620, H = 430, cx = W / 2, cy = H / 2 + 4, rMin = 30, rMax = 170;
    const seg = 2 * Math.PI / CITE_ORDER.length;
    const dist = v => rMin + (100 - Math.min(Math.max(v, 20), 100)) / 80 * (rMax - rMin);
    const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };
    const xy = (ang, r) => [cx + r * Math.cos(ang), cy + r * Math.sin(ang)].map(v => v.toFixed(1));
    let svg = '<svg class="mko-cmap" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Citation map: the sites '
      + 'linking to us by type and Domain Rating">';
    [80, 60, 40, 20].forEach(v => {
      svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + dist(v).toFixed(1) + '" fill="none" stroke="currentColor" '
        + 'stroke-opacity=".18" stroke-width="1"/><text x="' + (cx + 3) + '" y="' + (cy - dist(v) - 2).toFixed(1) + '">DR ' + v + "</text>";
    });
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + (rMax + 14) + '" fill="none" stroke="#E24B4A" stroke-opacity=".55" '
      + 'stroke-dasharray="3 4"/>';
    CITE_ORDER.forEach((t, i) => {
      const a0 = -Math.PI / 2 + i * seg, [x1, y1] = xy(a0, rMin - 8), [x2, y2] = xy(a0, rMax + 6);
      svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="currentColor" stroke-opacity=".12"/>';
      const [lx, ly] = xy(a0 + seg / 2, rMax + 32);
      svg += '<text x="' + lx + '" y="' + ly + '" text-anchor="middle" style="fill:' + CITE_COLOR[t] + ';font-weight:600">'
        + esc(t) + "</text>";
    });
    st.clean.concat(st.lostClean).filter(r => (r.dr || 0) >= 20).forEach(r => {
      const i = CITE_ORDER.indexOf(r.type), ang = -Math.PI / 2 + i * seg + seg * (0.08 + 0.84 * (hash(r.dom) % 1000) / 1000);
      const [x, y] = xy(ang, dist(r.dr)), rad = (2 + r.dr / 22).toFixed(1), c = CITE_COLOR[r.type];
      svg += '<circle cx="' + x + '" cy="' + y + '" r="' + rad + '" ' + (r.last ? 'fill="none" stroke="' + c + '" stroke-width="1.4"'
        : 'fill="' + c + '" fill-opacity=".85"') + "><title>" + esc(r.dom + " · DR " + Math.round(r.dr) + " · " + r.type
        + (r.last ? " · lost since " + day(r.last) : "")) + "</title></circle>";
    });
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="15" fill="#639922"/><text x="' + cx + '" y="' + (cy + 3.5)
      + '" text-anchor="middle" style="fill:#fff;font-weight:700">ZtZ</text></svg>';
    return svg + '<p class="rs-hint">Rings at Domain Rating 80, 60, 40 and 20 from the middle out; a dot is a site, '
      + "sized by its rating; hollow = it no longer links to us. The red dotted ring stands for the "
      + fmtN(st.spam.length) + " spam-flagged sites, which are not drawn.</p>";
  }
  let CITE_TODO = [];        // citeHtml's to-do list; the topic shows it first
  function citeHtml(w) {
    CITE_TODO = [];
    const err = P.err.refdom;
    const wrap = body => '<div class="mko-h"><h2>Citation map</h2><span class="mko-sub">every site linking to '
      + "ziptozipmoving.com · Ahrefs, weekly</span></div>" + body;
    if (err) return wrap('<div class="panel"><div class="mko-empty">The citation map could not load — ' + esc(err)
      + (/404|unknown dataset|not granted|403/i.test(err) ? " (it arrives with the next bridge deploy or pipeline run)" : "") + "</div></div>");
    if (!P.refdom.length) return wrap('<div class="panel"><div class="mko-empty">The citation map arrives with the next weekly '
      + "Ahrefs pull (Mondays).</div></div>");
    const st = citeStats(w.a, w.bEff), panel = (t, s, b) => '<div class="panel"><div class="panel-head"><span class="panel-title">'
      + t + '</span><span class="mko-sub">' + s + "</span></div>" + b + "</div>";
    const bd = citeBreakdowns(st), low = bd.mix[0], lowN = low.clean + low.spam;
    const strongest = bd.byType.filter(r => r.k !== CITE_OTHER).sort((a, b) => b.strong + b.mid - a.strong - a.mid)[0];
    const anchors = P.anchor.filter(a => SPAM_ANCHOR.test(a.text) || a.text.length > 120).sort((a, b) => b.rd - a.rd);
    const newest = st.live.slice().sort((a, b) => (a.first < b.first ? 1 : -1)).slice(0, 50);
    const inv = st.clean.filter(r => r.dr >= 20).concat(st.lostClean).sort((a, b) => b.dr - a.dr);
    const cut = (s, n) => s.length > n ? s.slice(0, n - 1) + "…" : s;
    // what to do: rules over the same numbers, never a judgement call
    const todo = [];
    CITE_TODO = todo;
    if (st.spam.length) {
      todo.push("<b>Disavow the spam network.</b> " + fmtN(st.spam.length) + " of the " + fmtN(st.live.length)
        + " sites linking to us carry Ahrefs' spam flag (" + pct(st.spam.length / st.live.length) + ")"
        + (st.newSpam.length ? ", " + fmtN(st.newSpam.length) + " of them new in this period" : "")
        + '. <button type="button" class="mko-lnk" id="mkoDisavow">Download a disavow file</button> for Google Search '
        + "Console, and confirm no agency bought them.");
    }
    if (anchors.length) {
      todo.push("<b>" + fmtN(anchors.length) + " anchor texts sell links</b>, the biggest on " + fmtN(anchors[0].rd)
        + " sites since " + esc(day(anchors[0].first)) + ": “" + esc(cut(anchors[0].text, 90)) + "”. Treat them as "
        + "negative SEO or an unapproved vendor.");
    }
    const yearAgo = addDays(w.bEff, -365);
    const lapsed = st.lostClean.filter(r => r.dr >= 40 && r.last >= yearAgo).sort((a, b) => b.dr - a.dr).slice(0, 6);
    if (lapsed.length) {
      todo.push("<b>Win back lapsed citations.</b> " + esc(lapsed.map(r => r.dom + " (DR " + Math.round(r.dr) + ")").join(", "))
        + " stopped linking in the last year: check each listing is live, has the right name, address and phone, and "
        + "still links to ziptozipmoving.com.");
    }
    const have = new Set(st.live.map(r => r.dom.replace(/^www\./, "")));
    const missing = KEY_SITES.filter(d => !have.has(d) && ![...have].some(h => h.endsWith("." + d)));
    if (missing.length) {
      todo.push("<b>Fill the gaps in reviews and directories.</b> No live link from " + esc(missing.join(", "))
        + " (or Ahrefs has not seen one).");
    }
    const press = st.clean.filter(r => r.type === "Press" && r.dr >= 40);
    todo.push("<b>Earn editorial citations.</b> " + fmtN(press.length) + " press site" + (press.length === 1 ? "" : "s")
      + " at DR 40+ link to us" + (press.length ? " (" + esc(press.slice(0, 4).map(r => r.dom).join(", ")) + ")" : "")
      + ": local press and “best movers” roundups are the links AI answers cite.");
    return wrap('<div id="mkoCite"><div class="rs-kpis" id="mkoK-cite"></div>'
      + panel("Citation map", "clean sites from Domain Rating 20, by type", citeMapSvg(st))
      + '<div class="mko-g2e">'
      + panel("Citations by type", "clean sites from Domain Rating 20, by type, and how many no longer link to us",
        '<div class="chartbox mko-cchart"><canvas id="mkoCiteType" role="img" aria-label="Clean sites linking to us by type"></canvas></div>'
        + '<p class="rs-hint">Each type has two bars: live sites (solid DR 40+, light DR 20–39) and, in outline, sites that no longer link. '
        + (strongest && strongest.strong + strongest.mid ? "Most live outside blogs: " + esc(strongest.k) + ", "
          + fmtN(strongest.strong + strongest.mid) + " sites, " + fmtN(strongest.strong) + " of them DR 40+. " : "")
        + "Hover a bar for its strongest sites.</p>")
      + panel("Authority mix of referring domains", "every site linking to us, by Domain Rating band; red is Ahrefs' spam flag",
        '<div class="chartbox mko-cchart"><canvas id="mkoCiteMix" role="img" aria-label="Sites linking to us by Domain Rating band"></canvas></div>'
        + '<p class="rs-hint">' + (lowN ? pct(ratio(low.spam, lowN)) + " of the " + fmtN(lowN) + " sites under DR 20 carry the spam flag: "
          + "that band is the paid-link network, not citations. " : "") + fmtN(st.spam.length) + " of " + fmtN(st.live.length)
        + " flagged in all.</p>") + "</div>"
      + '<div id="mkoC-cite"></div>'
      + '<div class="mko-g2e">'
      + panel("Anchors that sell links", "anchor text on the most sites, flagged by its words", anchors.length ? '<div class="mko-scroll">' + ptable([
          { h: "Anchor", name: true, cell: a => esc(cut(a.text, 110)) },
          { h: "Sites", num: true, cell: a => fmtN(a.rd) },
          { h: "Links", num: true, cell: a => fmtN(a.links) },
          { h: "First seen", num: true, cell: a => esc(shortDay(a.first)) }], anchors, null, true) + "</div>"
          : '<div class="mko-empty">No anchor reads like a paid link.</div>')
      + panel("Newest referring domains", "the 50 most recent · " + fmtN(newest.filter(r => r.spam).length) + " flagged spam", '<div class="mko-scroll">' + ptable([
          { h: "Site", name: true, cell: r => esc(r.dom) + " " + (r.spam ? pill("spam", "bad") : "") + '<div class="mko-sub">' + esc(r.type) + "</div>" },
          { h: "DR", num: true, cell: r => r.dr == null ? "—" : String(Math.round(r.dr)) },
          { h: "First seen", num: true, cell: r => esc(shortDay(r.first)) }], newest, null, true) + "</div>") + "</div>"
      + panel("Citation inventory", fmtN(inv.length) + " clean sites from DR 20, strongest first",
        '<input type="search" class="mko-q" id="mkoCiteQ" placeholder="Search a site or a type" aria-label="Search the inventory">'
        + '<div class="mko-scroll"><div class="rs-tablewrap"><table class="rs-table mko-pt mko-tight" id="mkoCiteInv"><thead><tr><th>Site</th><th>Type</th>'
        + '<th class="mko-num">DR</th><th class="mko-num" title="links to us, dofollow beneath">Links</th>'
        + '<th class="mko-num">First seen</th><th class="mko-num">Status</th></tr></thead><tbody>'
        + inv.map(r => '<tr data-q="' + esc((r.dom + " " + r.type).toLowerCase()) + '"><td class="mko-name">' + esc(r.dom) + "</td><td>"
          + esc(r.type) + '</td><td class="mko-num">' + Math.round(r.dr) + '</td><td class="mko-num">' + fmtN(r.links)
          + '<div class="mko-sub">' + fmtN(r.dof) + ' dofollow</div></td><td class="mko-num">' + esc(shortDay(r.first)) + '</td><td class="mko-num">'
          + (r.last ? '<span class="mko-neg">lost ' + esc(shortDay(r.last)) + "</span>" : '<span class="mko-pos">live</span>') + "</td></tr>").join("")
        + "</tbody></table></div></div>")
      + "</div>");
  }
  function citeWire(host, w) {
    const box = host.querySelector("#mkoCite");
    if (!box) return;
    const st = citeStats(w.a, w.bEff), snap = P.ahd.length ? P.ahd[P.ahd.length - 1] : null;
    RSC.kpis(box.querySelector("#mkoK-cite"), [
      { label: "Domain rating", value: snap && snap.dr != null ? String(Math.round(snap.dr)) : "—", sub: "Ahrefs, out of 100" },
      { label: "Referring domains", value: fmtN(st.live.length), sub: fmtN(st.newIn.length) + " new in the period" },
      { label: "Flagged spam", value: '<span class="mko-neg">' + fmtN(st.spam.length) + "</span>",
        sub: pct(ratio(st.spam.length, st.live.length)) + " of them · Ahrefs' flag" },
      { label: "Strong citations", value: fmtN(st.strong.length), sub: "clean, Domain Rating 40+" },
      { label: "Clean DR 20–39", value: fmtN(st.mid.length), sub: fmtN(st.clean.length) + " clean in all" },
      { label: "Lost citations", value: fmtN(st.lostClean.length), sub: "clean, DR 20+, no longer linking" },
    ]);
    const bd = citeBreakdowns(st), C = palette(), GREY = "#94A3B8", SPAM_RED = "#E24B4A";
    // each bar's total at its tip: "Blogs and other" sets the scale, so the named types are short bars
    // that need their number (2026-10-26, first look at the live charts)
    const totals = { id: "mkoCiteTotals", afterDatasetsDraw(ch) {
      const horiz = ch.options.indexAxis === "y", metas = ch.getSortedVisibleDatasetMetas(), top = {};
      metas.forEach(m => { top[ch.data.datasets[m.index].stack || ""] = m; });
      const ctx = ch.ctx;
      ctx.save();
      ctx.font = "600 11px " + (Chart.defaults.font.family || "sans-serif");
      ctx.fillStyle = Chart.defaults.color;
      ctx.textAlign = horiz ? "left" : "center";
      ctx.textBaseline = horiz ? "middle" : "bottom";
      Object.entries(top).forEach(([stack, m]) => m.data.forEach((el, i) => {
        const n = metas.filter(x => (ch.data.datasets[x.index].stack || "") === stack)
          .reduce((s, x) => s + (+ch.data.datasets[x.index].data[i] || 0), 0);
        if (n) ctx.fillText(fmtN(n), horiz ? el.x + 4 : el.x, horiz ? el.y : el.y - 3);
      }));
      ctx.restore();
    } };
    const tcan = box.querySelector("#mkoCiteType");
    if (tcan) {
      // live (solid DR 40+ and light DR 20-39 stacked) and no longer linking as a second bar beside it,
      // so a type's lost sites never stretch its live bar
      const col = bd.byType.map(r => CITE_COLOR[r.k]), live = { stack: "live", borderRadius: 3, maxBarThickness: 16 };
      const keyItem = (text, i, fill, stroke) => ({ text, datasetIndex: i, fillStyle: fill, strokeStyle: stroke || fill,
        lineWidth: stroke ? 1.5 : 0, hidden: false });
      new Chart(tcan, { type: "bar",
        data: { labels: bd.byType.map(r => r.k), datasets: [
          Object.assign({ label: "DR 40+", data: bd.byType.map(r => r.strong), backgroundColor: col }, live),
          Object.assign({ label: "DR 20–39", data: bd.byType.map(r => r.mid), backgroundColor: col.map(c => c + "73") }, live),
          Object.assign({ label: "No longer linking", data: bd.byType.map(r => r.lost), backgroundColor: "transparent",
                          borderColor: col, borderWidth: 1.5 }, live, { stack: "lost" })] },
        plugins: [totals],
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom", labels: { generateLabels: () => [keyItem("DR 40+", 0, GREY),
                       keyItem("DR 20–39", 1, GREY + "73"), keyItem("No longer linking", 2, "transparent", GREY)] } },
            tooltip: { callbacks: { footer: xs => { const r = bd.byType[xs[0].dataIndex];
              return r.top.length ? "Strongest: " + r.top.join(", ") : ""; } } } },
          scales: { x: { stacked: true, beginAtZero: true, grace: "10%", ticks: { precision: 0 } },
                    y: { stacked: true, grid: { display: false }, ticks: { color: c => CITE_COLOR[CITE_ORDER[c.index]] } } } } });
    }
    const mcan = box.querySelector("#mkoCiteMix");
    if (mcan) {
      const bar = { borderRadius: 3, maxBarThickness: 56 };
      new Chart(mcan, { type: "bar",
        data: { labels: bd.mix.map(r => r.k), datasets: [
          Object.assign({ label: "Clean", data: bd.mix.map(r => r.clean), backgroundColor: C.main }, bar),
          Object.assign({ label: "Flagged spam", data: bd.mix.map(r => r.spam), backgroundColor: SPAM_RED }, bar)] },
        plugins: [totals],
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { footer: xs => { const r = bd.mix[xs[0].dataIndex], n = r.clean + r.spam;
            return fmtN(n) + " sites · " + pct(ratio(n, st.live.length)) + " of all"; } } } },
          scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, beginAtZero: true, grace: "8%", ticks: { precision: 0 } } } } });
    }
    const hist = P.ahm.filter(r => r.rdh != null).slice(-14);
    const el = box.querySelector("#mkoC-cite");
    if (el && hist.length) {
      RSC.chartCard(el, {
        title: "Referring domains by month", key: "mko-cite-month",
        buildChart(canvas) {
          const C = palette();
          return new Chart(canvas, { type: "bar",
            data: { labels: hist.map(r => monthWord(r.m)), datasets: [{ label: "Referring domains", data: hist.map(r => r.rdh),
              backgroundColor: C.main, borderRadius: 3, maxBarThickness: 26 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true }, x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
        },
        buildTable() {
          return ptable([{ h: "Month", cell: r => esc(monthWord(r.m)) },
            { h: "Referring domains", num: true, tip: "Ahrefs' monthly history count, a stricter definition than the live figure",
              cell: r => fmtN(r.rdh) }], hist.slice().reverse());
        },
      });
    }
    const q = box.querySelector("#mkoCiteQ");
    if (q) q.oninput = () => {
      const v = q.value.trim().toLowerCase();
      box.querySelectorAll("#mkoCiteInv tbody tr").forEach(tr => { tr.hidden = !!v && !tr.dataset.q.includes(v); });
    };
    const dis = box.querySelector("#mkoDisavow");
    if (dis) dis.onclick = () => {
      const txt = "# Spam-flagged domains linking to ziptozipmoving.com (Ahrefs, " + day(today()) + "): review before uploading\n"
        + st.spam.map(r => "domain:" + r.dom).sort().join("\n") + "\n";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([txt], { type: "text/plain" }));
      a.download = "disavow-ziptozipmoving.txt";
      document.body.appendChild(a); a.click(); a.remove();
    };
  }
  /* === AI VISIBILITY (2026-10-26, his pick: Ahrefs Brand Radar on the plan we already pay for) ===
     The marketing head's Searchable report is the idea: how visible we are in AI answers, share of
     voice against the competitors, and visibility and sentiment per AI engine. Ours comes from 50
     questions asked monthly of ChatGPT, Perplexity and Google AI Overviews (src/brand_radar.py):
     - VISIBILITY: the share of an engine's answers that name the brand;
     - SHARE OF VOICE: a brand's share of all the times the answers named a tracked mover;
     - SENTIMENT: the share of a brand's mentions Ahrefs reads as positive ("—" where it is not named).
     Searchable's 0-100 score and its percentile against 10,000 brands are its own benchmark, so
     nothing here imitates them. Beyond her report: the questions where competitors are named and we
     are not, and the sites the answers cite -- the places to get listed. Each engine is read at its
     latest check; older checks make the month-by-month line. */
  const AI_ENGINES = [["chatgpt", "ChatGPT"], ["perplexity", "Perplexity"], ["google_ai_overviews", "AI Overviews"]];
  const AI_US = "Zip to Zip Moving";
  function aiModel() {
    if (!P.brA.length) return null;
    const last = {};
    P.brA.forEach(r => { if (!last[r.eng] || r.d > last[r.eng]) last[r.eng] = r.d; });
    const cur = r => last[r.eng] === r.d;
    const A = P.brA.filter(cur), M = P.brM.filter(cur), C = P.brC.filter(cur);
    const engines = AI_ENGINES.filter(([k]) => last[k]);
    const n = {}, named = {}, rated = {}, pos = {};
    const bump = (o, b, e) => { (o[b] = o[b] || {})[e] = (o[b][e] || 0) + 1; };
    const get = (o, b, e) => (o[b] && o[b][e]) || 0;
    A.forEach(a => { n[a.eng] = (n[a.eng] || 0) + 1; });
    M.forEach(m => {
      bump(named, m.brand, m.eng);
      if (m.sent) { bump(rated, m.brand, m.eng); if (m.sent === "positive") bump(pos, m.brand, m.eng); }
    });
    const brands = Object.keys(named).concat(named[AI_US] ? [] : [AI_US]);
    const men = b => engines.reduce((s, [e]) => s + get(named, b, e), 0);
    const all = brands.reduce((s, b) => s + men(b), 0);
    const rows = brands.map(b => ({ b, us: b === AI_US, men: men(b), sov: ratio(men(b), all) || 0,
      vis: Object.fromEntries(engines.map(([e]) => [e, n[e] ? get(named, b, e) / n[e] : null])),
      sent: Object.fromEntries(engines.map(([e]) => [e, get(rated, b, e) ? get(pos, b, e) / get(rated, b, e) : null])) }))
      .sort((x, y) => y.men - x.men || (x.us ? -1 : y.us ? 1 : x.b < y.b ? -1 : 1));
    // the questions where a competitor is named and we are not, engine by engine
    const who = {};
    M.forEach(m => { if (!m.us) (who[m.eng + "|" + m.pk] = who[m.eng + "|" + m.pk] || []).push(m.brand); });
    const gapBy = {};
    A.forEach(a => {
      const w = who[a.eng + "|" + a.pk] || [];
      if (a.us || !w.length) return;
      const g = (gapBy[a.pk] = gapBy[a.pk] || { q: a.q, eng: [], who: {} });
      g.eng.push(a.eng);
      w.forEach(x => { g.who[x] = (g.who[x] || 0) + 1; });
    });
    const gaps = Object.values(gapBy).map(g => ({ q: g.q, eng: g.eng,
      who: Object.keys(g.who).sort((x, y) => g.who[y] - g.who[x] || (x < y ? -1 : 1)) }))
      .sort((x, y) => y.eng.length - x.eng.length || y.who.length - x.who.length || (x.q < y.q ? -1 : 1));
    // the sites the answers cite: in how many answers, and in how many that do not name us
    const usAns = new Set(A.filter(a => a.us).map(a => a.eng + "|" + a.pk));
    const dom = {};
    C.forEach(c => {
      if (!c.dom) return;
      const d = (dom[c.dom] = dom[c.dom] || { dom: c.dom, ours: c.ours, ans: new Set(), noUs: new Set() });
      const k = c.eng + "|" + c.pk;
      d.ans.add(k);
      if (!usAns.has(k)) d.noUs.add(k);
    });
    const sites = Object.values(dom).map(d => ({ dom: d.dom, ours: d.ours, n: d.ans.size, noUs: d.noUs.size }))
      .sort((x, y) => y.n - x.n || (x.dom < y.dom ? -1 : 1));
    const byM = {};
    P.brA.forEach(a => { const o = (byM[a.d.slice(0, 7)] = byM[a.d.slice(0, 7)] || { n: 0, us: 0 }); o.n++; if (a.us) o.us++; });
    return { engines, answers: A.length, usAns: usAns.size, questions: new Set(A.map(a => a.pk)).size,
             usQ: new Set(A.filter(a => a.us).map(a => a.pk)).size, rows, us: rows.find(r => r.us), gaps, sites,
             oursCited: sites.filter(s => s.ours).reduce((s, x) => s + x.n, 0),
             dates: [...new Set(Object.values(last))].sort(),
             trend: Object.keys(byM).sort().map(m => ({ m, rate: byM[m].us / byM[m].n, n: byM[m].n })) };
  }
  const pct0 = v => v == null || isNaN(v) ? "—" : Math.round(100 * v) + "%";
  function aiVisHtml() {
    const panel = (t, s, b) => '<div class="panel"><div class="panel-head"><span class="panel-title">' + t
      + '</span><span class="mko-sub">' + s + "</span></div>" + b + "</div>";
    const issues = P.issues.filter(r => /ai discoverab/i.test(r.cat));
    const audit = issues.length ? '<p class="rs-hint">The site audit flags ' + issues.length + " AI-discoverability issue"
      + (issues.length > 1 ? "s" : "") + ": " + esc(issues.map(r => r.name + " (" + r.pages + " pages)").join("; ")) + ".</p>" : "";
    const err = ["brans", "brmen", "brcit"].map(k => P.err[k]).find(Boolean);
    if (err) {
      return panel("AI visibility", "Ahrefs Brand Radar", '<div class="mko-empty">AI visibility could not load — ' + esc(err)
        + (/404|unknown|not granted|403/i.test(err) ? " (it arrives with the next bridge deploy or pipeline run)" : "") + "</div>");
    }
    const mo = aiModel();
    if (!mo) {
      return panel("AI visibility", "Ahrefs Brand Radar · 50 questions a month", '<div class="mko-nm">'
        + "<p><b>The first AI answers have not arrived yet.</b> Ahrefs Brand Radar will ask ChatGPT, Perplexity and "
        + "Google AI Overviews 50 questions a month, written the way customers ask about movers in our markets: the 150 "
        + "checks our Ahrefs plan includes. Once the marketing head approves the questions, the first answers land within a day.</p>"
        + "<p>This tab then shows how often AI answers name us, our share of voice against 13 competitors, visibility and "
        + "sentiment by AI engine, the questions where competitors are named and we are not, and the sites the answers cite.</p>"
        + "<p>Last outside reading, Searchable on 26 May 2026 over 150 answers: visibility 23.3 (bottom 31% of brands), "
        + "share of voice 7.1% (first of the movers named); named in 18% of ChatGPT, 28% of Perplexity and 24% of "
        + "AI Overviews answers.</p></div>" + audit);
    }
    const E = mo.engines, U = mo.us;
    const card = (l, v, s) => '<div class="kpi"><div class="l">' + esc(l) + '</div><div class="v">' + v
      + '</div><div class="s">' + esc(s) + "</div></div>";
    const cards = html => '<div class="rs-kpis" style="--kpi-cols:' + E.length + '">' + html + "</div>";
    const heat = key => {
      const max = Math.max(0, ...mo.rows.map(r => Math.max(0, ...E.map(([e]) => r[key][e] || 0))));
      return '<div class="rs-tablewrap"><table class="rs-table mko-pt mko-tight mko-heat"><thead><tr><th>Brand</th>'
        + E.map(([, l]) => '<th class="mko-num">' + esc(l) + "</th>").join("") + "</tr></thead><tbody>"
        + mo.rows.map(r => "<tr" + (r.us ? ' class="mko-us"' : "") + '><td class="mko-name">' + esc(r.b) + "</td>"
          + E.map(([e]) => { const v = r[key][e];
            return '<td class="mko-num ' + (v == null ? "na" : "h" + Math.min(4, Math.floor((max ? v / max : 0) * 5))) + '">'
              + pct0(v) + "</td>"; }).join("") + "</tr>").join("") + "</tbody></table></div>";
    };
    const lead = E.map(([e, l]) => {
      const nx = mo.rows.filter(r => !r.us).sort((a, b) => (b.vis[e] || 0) - (a.vis[e] || 0))[0];
      const d = (U.vis[e] || 0) - (nx ? nx.vis[e] || 0 : 0);
      return card(l, (d >= 0 ? "+" : "−") + Math.round(Math.abs(d) * 100) + " pts",
        nx && nx.vis[e] ? (d >= 0 ? "ahead of " : "behind ") + nx.b + ", " + pct0(nx.vis[e]) : "no other mover named");
    }).join("");
    const rank = E.map(([e, l]) => {
      const rk = mo.rows.filter(r => r.sent[e] != null).sort((a, b) => b.sent[e] - a.sent[e]);
      const i = rk.indexOf(U);
      return card(l, i < 0 ? "not named" : "#" + (i + 1) + " of " + rk.length,
        i === 0 ? (rk[1] ? "we lead; next: " + rk[1].b + ", " + pct0(rk[1].sent[e]) : "the only mover rated")
          : rk.length ? "top: " + rk[0].b + ", " + pct0(rk[0].sent[e]) : "no sentiment read");
    }).join("");
    const chips = es => es.map(e => '<span class="rs-pill mute">' + esc((AI_ENGINES.find(x => x[0] === e) || [e, e])[1]) + "</span>").join(" ");
    const how = '<p class="rs-hint">Named = the share of an engine\'s answers that name the mover. Share of voice = its share of '
      + "all the times the answers named a tracked mover. Sentiment = the share of its mentions Ahrefs reads as positive; "
      + "— means that engine did not name it. Each engine is read at its latest monthly check.</p>";
    return '<div id="mkoAi"><p class="rs-hint">' + fmtN(mo.questions) + " questions asked of " + esc(E.map(e => e[1]).join(", "))
      + " · checked " + esc(mo.dates.map(day).join(", ")) + " · Ahrefs Brand Radar, monthly</p>"
      + '<div class="rs-kpis" id="mkoK-ai"></div>'
      + panel("Share of voice", "when AI answers name movers, how often each one is named",
        '<div class="chartbox mko-cchart"><canvas id="mkoAiSov" role="img" aria-label="Share of voice in AI answers"></canvas></div>'
        + '<p class="rs-hint">' + pct(U.sov) + " of the mentions are ours; " + pct(1 - U.sov) + " go to the competitors.</p>")
      + '<div class="mko-g2e">'
      + panel("Visibility by AI engine", "the share of each engine's answers that name the mover", cards(lead) + heat("vis"))
      + panel("Sentiment by AI engine", "the share of each mover's mentions that read positive", cards(rank) + heat("sent"))
      + "</div>"
      + '<div class="mko-g2e">'
      + panel("Where competitors are named and we are not", fmtN(mo.gaps.length) + " of " + fmtN(mo.questions) + " questions",
        mo.gaps.length ? '<div class="mko-scroll">' + ptable([
          { h: "Question", name: true, cell: g => esc(g.q) + '<div class="mko-sub">' + esc(g.who.slice(0, 3).join(" · ")) + "</div>" },
          { h: "Engines", num: true, cell: g => chips(g.eng) }], mo.gaps, null, true) + "</div>"
          : '<div class="mko-empty">Every answer that names a competitor names us too.</div>')
      + panel("Sites the answers cite", "the places to get listed: cited in answers that do not name us",
        mo.sites.length ? '<div class="mko-scroll">' + ptable([
          { h: "Site", name: true, cell: s => esc(s.dom) + (s.ours ? ' <span class="rs-pill ok">ours</span>' : "") },
          { h: "Answers", num: true, tip: "answers that link to it", cell: s => fmtN(s.n) },
          { h: "Without us", num: true, tip: "of those, answers that do not name us", cell: s => fmtN(s.noUs) }], mo.sites, null, true) + "</div>"
          : '<div class="mko-empty">These answers cite no sites.</div>')
      + "</div>"
      + (mo.trend.length > 1 ? panel("Named in AI answers, month by month", "all engines together", ptable([
          { h: "Month", cell: t => esc(monthWord(t.m)) },
          { h: "Named in", num: true, cell: t => pct0(t.rate) },
          { h: "Answers", num: true, cell: t => fmtN(t.n) }], mo.trend.slice().reverse(), null, true)) : "")
      + how + audit + "</div>";
  }
  function aiWire(host) {
    const box = host.querySelector("#mkoAi"), mo = box && aiModel();
    if (!mo) return;
    const U = mo.us, named = mo.rows.filter(r => r.men > 0), rk = named.indexOf(U) + 1;
    RSC.kpis(box.querySelector("#mkoK-ai"), [
      { label: "Named in AI answers", value: pct0(ratio(mo.usAns, mo.answers)),
        sub: "missing from " + pct0(1 - (ratio(mo.usAns, mo.answers) || 0)) + " of " + fmtN(mo.answers) + " answers" },
      { label: "Share of voice", value: pct(U.sov), sub: rk ? "#" + rk + " of " + named.length + " movers named" : "not named yet" },
      { label: "Questions we're named in", value: fmtN(mo.usQ), sub: "of " + fmtN(mo.questions) + ", by at least one engine" },
      { label: "Answers citing our site", value: fmtN(mo.oursCited), sub: fmtN(mo.sites.length) + " sites cited in all" },
    ]);
    const can = box.querySelector("#mkoAiSov");
    if (!can) return;
    const C = palette(), list = named.slice(0, 10);
    const tips = { id: "mkoAiTips", afterDatasetsDraw(ch) {
      const ctx = ch.ctx, meta = ch.getDatasetMeta(0);
      ctx.save();
      ctx.font = "600 11px " + (Chart.defaults.font.family || "sans-serif");
      ctx.fillStyle = Chart.defaults.color; ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      meta.data.forEach((el, i) => ctx.fillText(pct(list[i].sov), el.x, el.y - 3));
      ctx.restore();
    } };
    new Chart(can, { type: "bar",
      data: { labels: list.map(r => r.b), datasets: [{ label: "Share of voice", data: list.map(r => +(100 * r.sov).toFixed(1)),
        backgroundColor: list.map(r => r.us ? C.alt : "#94A3B8"), borderRadius: 3, maxBarThickness: 48 }] },
      plugins: [tips],
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: x => pct(list[x.dataIndex].sov) + " of mentions · named " + fmtN(list[x.dataIndex].men) + " times" } } },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 30 } },
                  y: { beginAtZero: true, grace: "10%", ticks: { callback: v => v + "%" } } } } });
  }

  /* === REVIEWS === */
  /* every listing's reviews against its goal for the period, with what the period ADDED and what
     platforms REMOVED kept apart (RS.reviewFlow, the portal's one rule). A goal row dated 1 Sep is
     the total to reach by the end of August (Monthly Report's rule): the period's goal is the first
     goal date after its last month, else the last one before it. */
  /* the negative reviews (batch 2, 2026-10-21): the Monday cases board -- written in the period, still
     open, removed, where they land, by month, and the cases WITH the customer's name (his call). A case
     the board never dated (93 of 316, every one Removed) is in the all-time counts and nowhere else. */
  const starCell = x => x.stars.kind === "stars" ? '<span title="' + x.stars.n + ' stars">' + "★".repeat(x.stars.n) + "</span>"
    : x.stars.kind === "complaint" ? pill("Complaint", "warn") : '<span class="mko-sub">—</span>';
  function negHtml(w, cw) {
    if (P.err.neg) return { html: '<div class="panel">The negative reviews could not load — ' + esc(P.err.neg) + "</div>" };
    const all = P.neg.filter(r => !S.co || r.co === S.co);
    const inW = (a, b) => all.filter(r => r.d && r.d >= a && r.d <= b);
    const cur = inW(w.a, w.bEff), prev = cw ? inW(cw.a, cw.b) : null;
    const open = all.filter(r => r.grp === "Open"), stuck = open.filter(r => /stuck/i.test(r.st));
    const removed = all.filter(r => r.grp === "Removed"), undated = all.filter(r => !r.d);
    const rated = cur.filter(r => r.stars.kind === "stars");
    const avg = rated.length ? sum(rated.map(r => ({ n: r.stars.n })), "n") / rated.length : null;
    const plats = groupBy(cur, r => r.plat).map(x => {
      const xr = x.rows.filter(r => r.stars.kind === "stars");
      return { k: x.k, n: x.rows.length, open: x.rows.filter(r => r.grp === "Open").length,
               avg: xr.length ? sum(xr.map(r => ({ n: r.stars.n })), "n") / xr.length : null,
               lists: groupBy(x.rows, r => r.src || "(no label)").map(y => ({ k: y.k, n: y.rows.length })).sort((a, b) => b.n - a.n) };
    }).sort((a, b) => b.n - a.n);
    const end = w.bEff.slice(0, 7);
    const m12 = months(addDays(end + "-01", -330), end + "-01").slice(-12);
    const byM = {};
    all.forEach(r => { if (r.d) byM[r.d.slice(0, 7)] = (byM[r.d.slice(0, 7)] || 0) + 1; });
    const cases = cur.slice().sort((a, b) => (a.d < b.d ? 1 : -1));
    const SHOW = 30;
    const html = '<div class="mko-h"><h2>Negative reviews</h2><span class="mko-sub">the cases board · written '
      + esc(day(w.a)) + " – " + esc(day(w.bEff)) + "</span></div>"
      + '<div class="rs-kpis" id="mkoK-neg"></div>'
      + '<div class="mko-g2e"><div id="mkoC-neg"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Where they land</span>'
      + '<span class="mko-sub">written in the period</span></div>'
      + (plats.length ? ptable([
        { h: "Platform", name: true, cell: x => "<b>" + esc(x.k) + "</b>" + '<div class="mko-sub">'
            + x.lists.slice(0, 3).map(y => esc(y.k) + " " + y.n).join(" · ") + "</div>" },
        { h: "Reviews", num: true, cell: x => fmtN(x.n) },
        { h: "Open", num: true, cell: x => x.open ? '<span class="mko-neg">' + fmtN(x.open) + "</span>" : "—" },
        { h: "Avg stars", num: true, cell: x => x.avg == null ? "—" : "★" + x.avg.toFixed(1) }], plats, null, true)
        : '<div class="mko-empty">No negative review written in this period.</div>') + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">The cases</span>'
      + '<span class="mko-sub">newest first' + (cases.length > SHOW ? " · " + SHOW + " of " + fmtN(cases.length) : "") + "</span></div>"
      + (cases.length ? ptable([
        { h: "Written", cell: x => '<span class="mko-date">' + esc(shortDay(x.d)) + "</span>" },
        { h: "Customer", name: true, cell: x => "<b>" + esc(x.who || "—") + "</b>" + (x.req ? '<div class="mko-sub">#' + esc(x.req) + "</div>" : "") },
        { h: "Listing", cell: x => esc(x.plat) + (x.src && x.src !== x.plat ? '<div class="mko-sub">' + esc(x.src) + "</div>" : "") },
        { h: "Review", cell: starCell },
        { h: "Group", cell: x => x.grp === "Open" ? pill("Open", "warn") : pill(x.grp || "—", "mute") },
        { h: "Status", cell: x => esc(x.st || "—") },
        { h: "Owner", cell: x => '<span class="mko-sub">' + esc(x.owner || "—") + "</span>" }], cases.slice(0, SHOW), null)
        + (cases.length > SHOW ? '<p class="rs-hint">The rest, with the claims beside them, are on '
          + '<a href="#page=reviews-cases">Claims &amp; Negative Reviews</a>.</p>' : "")
        : '<div class="mko-empty">No case written in this period.</div>') + "</div>";
    return { html, wire(host) {
      const on = !!cw;
      RSC.kpis(host.querySelector("#mkoK-neg"), [
        kp("Written", cur.length, on ? prev.length : undefined, fmtN, true, "negative reviews in the period", { cw }),
        { label: "Still open", value: fmtN(open.length), sub: (stuck.length ? fmtN(stuck.length) + " stuck · " : "") + "on the board now" },
        { label: "Removed", value: fmtN(cur.filter(r => r.grp === "Removed").length),
          sub: "of the period's · " + fmtN(removed.length) + " of " + fmtN(all.length) + " all time"
            + (undated.length ? " (" + fmtN(undated.length) + " never dated)" : "") },
        { label: "Average stars", value: avg == null ? "—" : "★" + avg.toFixed(1),
          sub: (function () { const nc = cur.filter(r => r.stars.kind === "complaint").length;
            return fmtN(rated.length) + " rated · " + fmtN(nc) + (nc === 1 ? " complaint" : " complaints"); })() },
      ]);
      RSC.chartCard(host.querySelector("#mkoC-neg"), {
        title: "Negative reviews written by month", key: "mko-neg-month",
        buildChart(canvas) {
          return new Chart(canvas, { type: "bar",
            data: { labels: m12.map(monthWord), datasets: [{ label: "Written", data: m12.map(m => byM[m] || 0),
              backgroundColor: "#B04A7E", borderRadius: 3, maxBarThickness: 26 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
              scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxRotation: 0, autoSkip: true } } } } });
        },
        buildTable() {
          return ptable([{ h: "Month", cell: m => esc(monthWord(m)) }, { h: "Written", num: true, cell: m => fmtN(byM[m] || 0) }],
            m12.slice().reverse());
        },
      });
    } };
  }

  function reviewsTab(w, cw) {
    const neg = negHtml(w, cw);
    if (P.err.rc) return { html: '<div class="panel">The review counts could not load — ' + esc(P.err.rc) + "</div>" + neg.html,
                           wire: neg.wire };
    const co = r => !S.co || r.co === S.co;
    const rc = P.rc.filter(co), rg = P.rg.filter(co);
    if (!rc.length) return { html: '<div class="panel"><div class="mko-empty">No review counts for this company.</div></div>' + neg.html,
                             wire: neg.wire };
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
        + "reviews removed, and is left out of both columns.</p>" : "") + "</div>"
      + neg.html;
    return { html, wire(host) {
      if (neg.wire) neg.wire(host);
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
              { label: "Removed", data: months12.map(ym => -((flow.byMonth[ym] || {}).removed || 0)), backgroundColor: "#B04A7E", borderRadius: 3 }] },
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
  /* Batch 2 (2026-10-21, the marketing team's GA4 dashboard): lead actions beside GA's own key events,
     unique users by the month, session time and views, channels with their lead actions, the key events
     by name, source / medium, landing pages, devices and new vs returning.
     GA's KEY EVENTS ARE NOT LEADS: first_visit has been marked a key event since Aug 2026, and the quote
     form's "continue" step and "read reviews" were already; in Sep 2026 that made 1,677 key events against
     200 lead actions. Lead actions = the key events in src/ga4_api.py LEAD_EVENTS, and both are shown. */
  const GA4_LEAD = { request_a_quote: "Request a quote", submit_and_view_quote: "Submit and view quote",
                     call_us_button: "Call us button", chat_interaction: "Chat", request_call_back: "Request call back",
                     Thank_You_Page2025_Real: "Thank-you page (Jan–Feb 2026)" };
  const GA4_NOT_LEAD = { first_visit: "First visit — every new visitor", clicked_continue: "Quote form: continue step",
                         read_reviews: "Read reviews", Thank_You_Page2025: "Thank-you page (counted twice)",
                         ThankYouPage2025: "Thank-you page (duplicate)", Thanks_2025_Real: "Thank-you page (duplicate)" };
  const monthEnd = m => iso(new Date(+m.slice(0, 4), +m.slice(5, 7), 0));
  // GA4 cannot add days of users: a period of whole months reads the months' own unique users
  function webUsers(a, b, rows) {
    const ms = months(a, b);
    if (ms.length && ms.every(m => a <= m + "-01" && b >= monthEnd(m) && P.ga4u[m])) {
      return { v: ms.reduce((t, m) => t + P.ga4u[m].users, 0),
               how: ms.length === 1 ? "unique in the month" : "each month's unique users, added" };
    }
    return { v: sum(rows, "users"), how: "a part month: daily users, summed" };
  }
  function webTab(w, cw) {
    const pw = platWin("ga4", w, cw);
    const gate = platGate("Google Analytics", "ga4", pw, pw ? inRange(P.ga4, pw.a, pw.b).map(r => ({ cost: r.ses })) : []);
    if (gate) return { html: '<div class="panel">' + gate + "</div>" };
    const rows = inRange(P.ga4, pw.a, pw.b), cmp = pw.cw ? inRange(P.ga4, pw.cw.a, pw.cw.b) : null;
    const st = rs => { const ses = sum(rs, "ses"), eng = sum(rs, "eng"), users = sum(rs, "users");
      return { ses, eng, users, kev: sum(rs, "kev"), lead: sum(rs, "lead"), views: sum(rs, "views"),
               er: ratio(eng, ses), avg: ratio(sum(rs, "ssec"), ses), per: ratio(sum(rs, "secs"), users), vps: ratio(sum(rs, "views"), ses) }; };
    const cur = st(rows), prev = cmp ? st(cmp) : {};
    const U = webUsers(pw.a, pw.b, rows), Up = cmp ? webUsers(pw.cw.a, pw.cw.b, cmp) : null;
    const leads = withCo(LIVE_CO, () => totals(aggregate(pw.a, pw.b)).leads || 0);
    // channels: sessions, engaged share and lead actions
    const chRows = inRange(P.ga4ch, pw.a, pw.b);
    const ch = groupBy(chRows, r => r.grp).map(x => ({ k: x.k || "(other)", ses: sum(x.rows, "ses"), eng: sum(x.rows, "eng"),
      lead: sum(x.rows, "lead"), kev: sum(x.rows, "kev") })).filter(x => x.ses).sort((a, b) => b.ses - a.ses);
    const sm = groupBy(chRows, r => r.src + " / " + r.med).map(x => ({ k: x.k, ses: sum(x.rows, "ses"), eng: sum(x.rows, "eng"),
      ssec: sum(x.rows, "ssec"), lead: sum(x.rows, "lead") })).filter(x => x.ses).sort((a, b) => b.ses - a.ses);
    // the key events by name, lead actions first
    const ev = groupBy(inRange(P.ga4ev, pw.a, pw.b).filter(r => r.kev > 0), r => r.ev).map(x => ({ k: x.k, n: sum(x.rows, "kev") }))
      .sort((a, b) => b.n - a.n);
    const evLead = ev.filter(x => GA4_LEAD[x.k]), evOther = ev.filter(x => !GA4_LEAD[x.k]);
    // landing pages are monthly: the months the period touches
    const ms = months(pw.a, pw.b);
    const lp = groupBy(P.ga4lp.filter(r => ms.includes(r.m)), r => r.page).map(x => ({ k: x.k, ses: sum(x.rows, "ses"),
      eng: sum(x.rows, "eng"), ssec: sum(x.rows, "ssec"), views: sum(x.rows, "views"), lead: sum(x.rows, "lead") }))
      .filter(x => x.ses).sort((a, b) => b.ses - a.ses);
    const devRows = inRange(P.ga4dev, pw.a, pw.b);
    const dev = groupBy(devRows, r => r.dev).map(x => ({ k: x.k, v: sum(x.rows, "ses"), eng: sum(x.rows, "eng"), lead: sum(x.rows, "lead") }))
      .filter(x => x.v).sort((a, b) => b.v - a.v);
    const vis = groupBy(devRows, r => r.vis).map(x => ({ k: x.k, v: sum(x.rows, "ses"), eng: sum(x.rows, "eng"), lead: sum(x.rows, "lead") }))
      .filter(x => x.v).sort((a, b) => b.v - a.v);
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
    const bars = (list, max, sub) => list.map(x => '<div class="mko-hbar"><span>' + esc(x.k)
      + (sub ? '<span class="mko-sub">' + sub(x) + "</span>" : "") + '</span><span class="mko-track"><i style="width:'
      + Math.max(2, Math.round(100 * x.v / (max || 1))) + '%"></i></span><b>' + fmtN(x.v) + "</b></div>").join("");
    const engSub = x => pct(ratio(x.eng, x.v)) + " engaged" + (x.lead ? " · " + fmtN(x.lead) + " leads" : "");
    const evRow = (label, x) => '<tr><td class="mko-name">' + esc(label) + '</td><td class="mko-num">' + fmtN(x.n) + "</td></tr>";
    const evHtml = '<div class="rs-tablewrap"><table class="rs-table mko-pt mko-tight"><tbody>'
      + '<tr class="mko-grp"><td colspan="2">Lead actions · ' + fmtN(sum(evLead, "n")) + "</td></tr>"
      + (evLead.length ? evLead.map(x => evRow(GA4_LEAD[x.k], x)).join("") : '<tr><td colspan="2" class="mko-sub">none in this period</td></tr>')
      + '<tr class="mko-grp"><td colspan="2">Also marked as key events in GA4 · ' + fmtN(sum(evOther, "n")) + "</td></tr>"
      + evOther.map(x => evRow(GA4_NOT_LEAD[x.k] || x.k.replace(/_/g, " "), x)).join("")
      + "</tbody></table></div>";
    const html = (leads && U.v < leads ? '<div class="mko-warn">Google Analytics under-records: it saw '
        + fmtN(U.v) + " users in this period while Moveboard took " + fmtN(leads) + " leads. Read this tab "
        + "for trends and mix, not for totals.</div>" : "")
      + noCmpHint("Google Analytics", pw)
      + '<div class="rs-kpis" id="mkoK-web"></div>'
      + '<div class="mko-g2e"><div id="mkoC-web"></div>'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Key events</span>'
      + '<span class="mko-sub">by name · GA4 counts more than leads</span></div>' + evHtml
      + '<p class="rs-hint">GA4 marks first visits, the quote form\'s "continue" step and "read reviews" as key events '
      + "(first_visit since August 2026), so its key-event total is not a lead count. Lead actions are the rest.</p></div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Sessions by channel</span>'
      + '<span class="mko-sub">GA4 default channel grouping</span></div>'
      + (ch.length ? ptable([
        { h: "Channel", name: true, cell: x => shareName(esc(x.k), x.ses, cur.ses) },
        { h: "Sessions", num: true, cell: x => withShare(fmtN(x.ses), x.ses, cur.ses) },
        { h: "Engaged", num: true, tip: "engaged sessions ÷ sessions", cell: x => pct(ratio(x.eng, x.ses)) },
        { h: "Lead actions", num: true, cell: x => "<b>" + fmtN(x.lead) + "</b>" },
        { h: "Key events", num: true, tip: "GA4's own count, first visits included", cell: x => fmtN(x.kev) }], ch, null)
        : '<div class="mko-empty">No sessions in this period.</div>') + "</div>"
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Source / medium</span>'
      + '<span class="mko-sub">top 12 by sessions</span></div>'
      + (sm.length ? ptable([
        { h: "Source / medium", name: true, cell: x => esc(x.k) },
        { h: "Sessions", num: true, cell: x => fmtN(x.ses) },
        { h: "Engaged", num: true, cell: x => pct(ratio(x.eng, x.ses)) },
        { h: "Avg. session", num: true, cell: x => dur(ratio(x.ssec, x.ses)) },
        { h: "Lead actions", num: true, cell: x => fmtN(x.lead) }], sm.slice(0, 12), null, true)
        : '<div class="mko-empty">No sessions in this period.</div>') + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Landing pages</span>'
      + '<span class="mko-sub">by sessions · ' + esc(monthSpan(ms)) + " (monthly)</span></div>"
      + (lp.length ? '<div id="mkoLpList"></div>' : '<div class="mko-empty">No landing pages for these months yet.</div>') + "</div>"
      + "</div>"
      + '<div class="mko-g2e">'
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Devices</span><span class="mko-sub">sessions</span></div>'
      + (dev.length ? bars(dev, dev[0].v, engSub) : '<div class="mko-empty">No device data for this period.</div>')
      + '<h3 class="mko-h3">New vs returning</h3>'
      + (vis.length ? bars(vis, vis[0].v, engSub) : '<div class="mko-empty">No visitor data for this period.</div>') + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Locations</span><span class="mko-sub">active users · '
      + esc(monthSpan(ms)) + "</span></div>" + (us.length ? bars(us.slice(0, 8), us[0].v) : '<div class="mko-empty">No locations.</div>')
      + (abroad ? '<p class="rs-hint">Outside the US: ' + fmtN(abroad) + " users. Our own office in Georgia (the country) is left out.</p>" : "")
      + "</div></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Demographics</span><span class="mko-sub">'
      + (dTot ? "age known for " + pct(known / dTot) + " of users" : "no data") + "</span></div>"
      + (ages.length ? bars(ages, Math.max.apply(null, ages.map(a => a.v))) : '<div class="mko-empty">GA4 knows no ages for this period.</div>')
      + (sex.length ? '<p class="rs-hint">' + sex.map(x => esc(x.k[0].toUpperCase() + x.k.slice(1)) + " " + fmtN(x.v)).join(" · ") + "</p>" : "")
      + '<p class="rs-hint">Google signals off in GA4 leaves most visitors without an age or gender.</p></div>';
    return { html, wire(host) {
      if (lp.length) pagedTable(host.querySelector("#mkoLpList"), [
        { h: "Landing page", name: true, cell: x => esc(x.k) + (x.k === "(not set)" ? '<div class="mko-sub">sessions with no page view: a tag or bot pattern</div>' : "") },
        { h: "Sessions", num: true, cell: x => fmtN(x.ses) },
        { h: "Engaged", num: true, cell: x => pct(ratio(x.eng, x.ses)) },
        { h: "Avg. session", num: true, cell: x => dur(ratio(x.ssec, x.ses)) },
        { h: "Lead actions", num: true, cell: x => fmtN(x.lead) }], lp, 12, true);
      const was = (v, fmt) => pw.cw ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(v) : "";
      RSC.kpis(host.querySelector("#mkoK-web"), [
        kp("Sessions", cur.ses, prev.ses, fmtN, false, "", pw),
        kp("Users", U.v, Up ? Up.v : undefined, fmtN, false, U.how, pw),
        { label: "Engagement rate", value: pct(cur.er) + (pw.cw ? deltaPts(cur.er, prev.er, false) : ""),
          sub: [was(prev.er, pct), "bounce " + pct(cur.er == null ? null : 1 - cur.er)].filter(Boolean).join(" · ") },
        kp("Avg. session", cur.avg, prev.avg, dur, false, "engaged " + dur(cur.per) + " per user", pw),
        kp("Views", cur.views, prev.views, fmtN, false, cur.vps == null ? "" : cur.vps.toFixed(2) + " a session", pw),
        kp("Lead actions", cur.lead, prev.lead, fmtN, false, "quote, call, chat, call back", pw),
        kp("GA's key events", cur.kev, prev.kev, fmtN, null, "first visits and form steps included", pw),
      ]);
      const keys = bucketsOf(pw.a, pw.b, pw.g);
      const ses = seriesOf(rows, keys, pw.g, r => r.ses), lead = seriesOf(rows, keys, pw.g, r => r.lead);
      RSC.chartCard(host.querySelector("#mkoC-web"), {
        title: "Sessions and lead actions by " + GRAIN_WORD[pw.g], key: "mko-web-ses",
        buildChart(canvas) {
          const C = palette();
          return new Chart(canvas, { type: "bar",
            data: { labels: keys.map(k => bucketLabel(k, pw.g)), datasets: [
              { type: "bar", label: "Sessions", data: ses, backgroundColor: C.main, borderRadius: 3, maxBarThickness: 26, yAxisID: "y" },
              { type: "line", label: "Lead actions", data: lead, borderColor: C.alt, backgroundColor: C.alt, borderWidth: 2,
                pointRadius: keys.length > 45 ? 0 : 2, cubicInterpolationMode: "monotone", yAxisID: "y2" }] },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
              plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
              scales: { y: { beginAtZero: true, ticks: { callback: v => fmtN(v) } },
                        y2: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { precision: 0 } },
                        x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } } } });
        },
        buildTable() {
          return ptable([{ h: GRAIN_WORD[pw.g][0].toUpperCase() + GRAIN_WORD[pw.g].slice(1), cell: i => esc(bucketLabel(keys[i], pw.g)) },
            { h: "Sessions", num: true, cell: i => fmtN(ses[i]) },
            { h: "Lead actions", num: true, cell: i => fmtN(lead[i]) }], keys.map((k, i) => i));
        },
      });
    } };
  }

  /* === AHREFS API UNITS (2026-10-26, his ask: track what Ahrefs costs and pace the pulls to it) ===
     The loader measures every call and plans each pull's cadence inside the month (src/ahrefs_budget.py,
     ext_ahrefs_usage and ext_ahrefs_quota). This shows the month against the plan's limit, what each
     pull costs and how often it runs now. Times are UTC, as the loader writes them. */
  const AH_STEPS = [["snapshot", "Daily snapshot", "DR, keywords, traffic, backlinks"],
    ["history", "Monthly history", "the months Ahrefs keeps revising"], ["audit", "Site Audit", "health score and issues"],
    ["links", "New backlinks", "links first seen since the last pull"],
    ["citations", "Citations", "every referring domain and the top anchors"]];
  const AH_NORMAL = { snapshot: 1, history: 1, audit: 1, links: 1, citations: 7 };
  const AH_RESERVE = 0.10;   // src/ahrefs_budget.RESERVE: left for the workspace's MCP key and people
  function ahUsageModel() {
    if (!P.ahQ.length) return null;
    const q = P.ahQ[P.ahQ.length - 1], ms = s => Date.parse(s.replace(" ", "T") + "Z");
    const now = ms(q.at), reset = q.reset ? Date.parse(q.reset + "T00:00:00Z") : null;
    const start = reset ? (d => { d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 19).replace("T", " "); })(new Date(reset)) : "";
    const week = new Date(now - 7 * 864e5).toISOString().slice(0, 19).replace("T", " ");
    const daysLeft = reset ? Math.max(0, (reset - now) / 864e5) : null;
    const steps = AH_STEPS.map(([k, name, what]) => {
      const mine = P.ahU.filter(r => r.step === k), lastRow = mine[mine.length - 1], lastRan = mine.filter(r => r.ran).pop();
      return { k, name, what, row: lastRow, ran: lastRan, normal: AH_NORMAL[k] };
    });
    // the pace: measured once the log holds 2+ days of real pulls; before that, what the planner expects
    // (each pull's typical units / its cadence now) -- a log of free runs would read "0 a day" (26 Oct)
    const firstRan = P.ahU.find(r => r.ran);
    const span = firstRan ? Math.min(7, (now - ms(firstRan.at)) / 864e5) : 0;
    const measured = span >= 2;
    const perDay = measured ? P.ahU.filter(r => r.at >= week).reduce((s, r) => s + r.units, 0) / span
      : steps.reduce((s, x) => s + (x.row && x.row.days ? x.row.est / x.row.days : 0), 0);
    // our key's month is Ahrefs' own count; the log only knows the runs since it began
    const logged = P.ahU.filter(r => r.at >= start).reduce((s, r) => s + r.units, 0);
    return { q, reset: q.reset, daysLeft, perDay, measured, projected: daysLeft == null ? null : q.used + perDay * daysLeft,
             left: q.limit * (1 - AH_RESERVE) - q.used, ours: q.key == null ? logged : q.key, logged,
             others: q.key == null ? null : Math.max(0, q.used - q.key), steps };
  }
  function ahUsageHtml() {
    const head = sub => '<div class="panel"><div class="panel-head"><span class="panel-title">Ahrefs API units</span>'
      + '<span class="mko-sub">' + sub + "</span></div>";
    const err = P.err.ahuse || P.err.ahquota;
    if (err) {
      return head("what each Ahrefs pull costs") + '<div class="mko-empty">The usage log could not load — ' + esc(err)
        + (/404|unknown dataset|not granted|403/i.test(err) ? " (it arrives with the next bridge deploy or pipeline run)" : "") + "</div></div>";
    }
    const m = ahUsageModel();
    if (!m) {
      return head("what each Ahrefs pull costs") + '<div class="mko-empty">Measured from the next daily Ahrefs run: the month\'s '
        + "limit and usage, and the units each pull spends.</div></div>";
    }
    const how = d => d == null ? "paused" : d === 1 ? "daily" : d === 7 ? "weekly" : "every " + d + " days";
    const at = s => s ? day(s.slice(0, 10)) + " " + s.slice(11, 16) : "—";
    return head(fmtN(m.q.limit) + " units a month on the Lite plan · resets " + esc(day(m.reset)) + " · times UTC")
      + '<div class="rs-kpis" id="mkoK-ahu"></div>'
      + ptable([
        { h: "Pull", name: true, cell: s => esc(s.name) + '<div class="mko-sub">' + esc(s.what) + "</div>" },
        { h: "How often now", cell: s => !s.row ? "—" : how(s.row.days)
            + (s.row.days == null || s.row.days > s.normal ? ' <span class="rs-pill warn">' + (s.row.days == null ? "paused" : "stretched") + "</span>" : "")
            + '<div class="mko-sub">normally ' + how(s.normal) + "</div>" },
        { h: "Last pull", num: true, cell: s => esc(at(s.ran && s.ran.at)) },
        { h: "Units then", num: true, cell: s => s.ran ? fmtN(s.ran.units) : "—" },
        { h: "Typical", num: true, tip: "the median of its last runs, what the planner budgets", cell: s => s.row ? fmtN(s.row.est) : "—" },
        { h: "Latest decision", cell: s => s.row ? esc(s.row.why) : "—" }], m.steps, null, true)
      + '<div id="mkoC-ahu"></div>'
      + '<p class="rs-hint">The loader keeps ' + Math.round(100 * AH_RESERVE) + "% of the month (" + fmtN(m.q.limit * AH_RESERVE)
      + " units) for the workspace's other key and people. When the normal cadences would spend more than is left before "
      + "the reset, it pulls the dearest step less often (the citations first, down to monthly), and pauses steps until the "
      + "reset only if that is not enough. Free calls (the quota itself, Brand Radar's AI answers) cost nothing.</p></div>";
  }
  function ahUsageWire(host) {
    const m = ahUsageModel(), box = host.querySelector("#mkoK-ahu");
    if (!m || !box) return;
    RSC.kpis(box, [
      { label: "Units used", value: pct(ratio(m.q.used, m.q.limit)),
        sub: fmtN(m.q.used) + " of " + fmtN(m.q.limit) + " · resets " + day(m.reset) },
      { label: "On pace for", value: m.projected == null ? "—" : fmtN(m.projected),
        sub: (m.projected == null ? "" : pct(ratio(m.projected, m.q.limit)) + " of the limit · ") + fmtN(m.perDay)
          + (m.measured ? " a day lately" : " a day planned (measured after 2 days of pulls)") },
      { label: "Left to spend", value: fmtN(Math.max(0, m.left)),
        sub: (m.daysLeft == null ? "" : Math.ceil(m.daysLeft) + " days to the reset · ") + "after the reserve" },
      { label: "Our loader's key this month", value: fmtN(m.ours),
        sub: m.others == null ? "measured since this log began" : fmtN(m.others) + " by the workspace's other keys" },
    ]);
    const el = host.querySelector("#mkoC-ahu");
    const days = [...new Set(P.ahU.map(r => r.at.slice(0, 10)))].sort().slice(-30);
    if (!el || !days.length) return;
    if (!P.ahU.some(r => r.units > 0)) {
      el.innerHTML = '<div class="mko-empty">No units spent in the logged runs yet: the chart starts with the next paid pull.</div>';
      return;
    }
    const units = (k, d) => P.ahU.filter(r => r.step === k && r.at.slice(0, 10) === d).reduce((s, r) => s + r.units, 0);
    RSC.chartCard(el, {
      title: "Units spent a day, by pull", key: "mko-ahrefs-units",
      buildChart(canvas) {
        const C = palette(), col = [C.main, C.alt, C.light, C.violet, C.faint];
        return new Chart(canvas, { type: "bar",
          data: { labels: days.map(d => day(d)), datasets: AH_STEPS.map(([k, name], i) => ({ label: name,
            data: days.map(d => units(k, d)), backgroundColor: col[i], borderRadius: 2, maxBarThickness: 26 })) },
          options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
            plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
            scales: { x: { stacked: true, ticks: { maxRotation: 0, autoSkip: true } },
                      y: { stacked: true, beginAtZero: true, ticks: { precision: 0, callback: v => fmtN(v) } } } } });
      },
      buildTable() {
        return ptable([{ h: "Day", cell: d => esc(day(d)) }].concat(AH_STEPS.map(([k, name]) =>
          ({ h: name, num: true, cell: d => fmtN(units(k, d)) }))), days.slice().reverse());
      },
    });
  }

  /* Semrush API units (2026-10-27): the account's pool, our calls only (Semrush does not say what is left) */
  const SM_STEPS = [["authority", "Authority", "Authority Score, backlinks, sites linking by score", 1],
                    ["competitors", "Competitors", "us, Tuji and 8 competitors: authority and organic", 7],
                    ["organic", "Keywords", "our top 100 keywords by traffic", 7],
                    ["audit", "Site Audit", "our project and Tuji's", 7],
                    ["history", "History", "the monthly series, newest months", 7]];
  const SM_POOL = 50000;   // src/semrush_mcp.POOL: the Guru plan's connector units a month, the whole account's
  const smLast = rows => rows.reduce((m, r) => (r.d > m ? r.d : m), "") || null;
  function smUsageModel() {
    if (!P.smU.length) return null;
    const now = new Date(), y = now.getUTCFullYear(), mo = now.getUTCMonth();
    const start = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 10);
    const reset = new Date(Date.UTC(y, mo + 1, 1)).toISOString().slice(0, 10);
    const ours = P.smU.filter(r => r.at >= start).reduce((s, r) => s + r.units, 0);
    const lastRun = P.smU[P.smU.length - 1].at;
    const empty = P.smU.some(r => r.at === lastRun && /pool empty/.test(r.why));
    const steps = SM_STEPS.map(([k, name, what, normal]) => {
      const mine = P.smU.filter(r => r.step === k);
      return { k, name, what, normal, row: mine.length ? mine[mine.length - 1] : null, ran: mine.filter(r => r.ran).pop() || null };
    });
    const perDay = steps.reduce((s, x) => s + (x.row && x.row.days ? x.row.est / x.row.days : 0), 0);
    const daysLeft = Math.max(0, (Date.parse(reset + "T00:00:00Z") - now) / 864e5);
    return { start, reset, ours, perDay, projected: ours + perDay * daysLeft, empty, lastRun, steps };
  }
  function smUsageHtml() {
    const head = sub => '<div class="panel"><div class="panel-head"><span class="panel-title">Semrush API units</span>'
      + '<span class="mko-sub">' + sub + "</span></div>";
    if (P.err.smuse) {
      return head("what each Semrush pull costs") + '<div class="mko-empty">The usage log could not load — ' + esc(P.err.smuse)
        + (/404|unknown dataset|not granted|403/i.test(P.err.smuse) ? " (it arrives with the next bridge deploy)" : "") + "</div></div>";
    }
    const m = smUsageModel();
    if (!m) {
      return head("what each Semrush pull costs") + '<div class="mko-empty">Measured from the next daily pull: the units each '
        + "Semrush pull spends from the account's " + fmtN(SM_POOL) + " a month.</div></div>";
    }
    const how = d => d == null ? "paused" : d === 1 ? "daily" : d === 7 ? "weekly" : "every " + d + " days";
    const at = s => s ? day(s.slice(0, 10)) + " " + s.slice(11, 16) : "—";
    return head(fmtN(SM_POOL) + " units a month on the Guru plan, shared by the whole account · times UTC")
      + '<div class="rs-kpis" id="mkoK-smu"></div>'
      + ptable([
        { h: "Pull", name: true, cell: s => esc(s.name) + '<div class="mko-sub">' + esc(s.what) + "</div>" },
        { h: "How often now", cell: s => !s.row ? "—" : how(s.row.days)
            + (s.row.days == null || s.row.days > s.normal ? ' <span class="rs-pill warn">' + (s.row.days == null ? "paused" : "stretched") + "</span>" : "")
            + '<div class="mko-sub">normally ' + how(s.normal) + "</div>" },
        { h: "Last pull", num: true, cell: s => esc(at(s.ran && s.ran.at)) },
        { h: "Units then", num: true, cell: s => s.ran ? fmtN(s.ran.units) : "—" },
        { h: "Typical", num: true, tip: "the median of its last runs, what the planner budgets", cell: s => s.row ? fmtN(s.row.est) : "—" },
        { h: "Latest decision", cell: s => s.row ? esc(s.row.why) : "—" }], m.steps, null, true)
      + '<p class="rs-hint">Through Semrush\'s own connector, with our key. The pool is the whole account\'s: the marketing '
      + "team's Claude connector spends from it too, and Semrush does not say how much is left, so this counts our calls "
      + "only. No units are held back for others (your call, 27 Oct). If Semrush says the pool is empty, the pulls stop and "
      + "try again the next day.</p></div>";
  }
  function smUsageWire(host) {
    const m = smUsageModel(), box = host.querySelector("#mkoK-smu");
    if (!m || !box) return;
    const at = s => day(s.slice(0, 10)) + " " + s.slice(11, 16);
    RSC.kpis(box, [
      { label: "Our units this month", value: fmtN(m.ours), sub: pct(ratio(m.ours, SM_POOL)) + " of the pool · since " + day(m.start) },
      { label: "On pace for", value: fmtN(m.projected), sub: fmtN(m.perDay) + " a day planned · resets " + day(m.reset) },
      { label: "Pool", value: m.empty ? "Empty" : "OK",
        sub: (m.empty ? "Semrush refused the pull of " : "last pull ") + at(m.lastRun) },
    ]);
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
    return { html: '<div class="rs-kpis" id="mkoK-set"></div>' + sourcesHtml()
      + '<details class="mkd-more" id="mkoApi"><summary>API budgets: Ahrefs and Semrush units this month</summary><div class="mkd-apis">'
      + ahUsageHtml() + smUsageHtml() + "</div></details>", wire(host) {
      // their charts measure their box: drawn on the first opening
      const api = host.querySelector("#mkoApi");
      let done = false;
      api.addEventListener("toggle", () => {
        if (api.open && !done) { done = true; drawNow(() => { ahUsageWire(host); smUsageWire(host); }); }
      });
      RSC.kpis(host.querySelector("#mkoK-set"), [
        { label: "Live", value: String(live.length), sub: "platforms pulled by API" },
        { label: "Waiting on others", value: String(wait.length), sub: names(wait) || "none" },
        { label: "Off", value: String(off.length), sub: names(off) || "none" },
        { label: "Our data behind", value: String(behind.length), sub: names(behind) || "all on time" },
      ]);
    } };
  }
  // the header's "Data sources" pill: how many connected sources are up to date; amber when one is
  // behind. It opens the data sources (S.tab "set"), which is no longer a tab of its own.
  function sourcesPill() {
    const on = D.conn.filter(r => r.Status !== "Not connected");
    if (!on.length) return "";
    const fresh = on.filter(r => r.Status === "Up to date").length, late = on.filter(r => r.Status === "Behind").length;
    // the only freshness signal a marketer sees: a monthly ledger counts as late past 40 days
    const age = D.ledgerEnd ? dayCount(D.ledgerEnd, today()) : 0, oldLedger = age >= 40;
    return '<button type="button" class="mkd-pill' + (late || oldLedger ? " warn" : "") + '" data-tab="set" title="Every source, '
      + 'what it gives and how fresh it is"><i aria-hidden="true"></i>Data sources: ' + fresh + " of " + on.length
      + " up to date" + (late ? " · " + late + " behind" : "") + (oldLedger ? " · ledger " + age + " days behind" : "") + "</button>";
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

  // what each tab answers, said under the title with the window it reads
  const TAB_ASK = {
    ov: "Every channel, what it cost and what it booked.", paid: "Is each ad platform earning its money?",
    seo: "Who finds us without an ad, where that demand is, and whether we win it.",
    web: "What visitors do on the website.", rev: "Reviews against their goals, and the negative ones.",
    soc: "Our pages and posts: what the organic team did, and what the paid team did.", set: "Every source this dashboard reads, and whether it is up to date.",
  };
  function paint(host) {
    const w = win();
    const cw = cmpWin(w);
    const tab = { ov: overviewTab, paid: paidTab, seo: seoTab, web: webTab, rev: reviewsTab, soc: socialTab, set: settingsTab }[S.tab] || overviewTab;
    if (!TAB_ASK[S.tab]) S.tab = "ov";
    const body = tab(w, cw);
    const when = w.open ? "All time" : dayRange(w.a, w.bEff) + (cw ? ", against the " + cw.label : "");
    host.innerHTML = '<div class="mko mkd">'
      + '<header class="mkd-head"><div class="mkd-title"><div class="mkd-eye">Marketing</div>'
      + "<h1>" + (S.tab === "set" ? "Data sources" : "Marketing Dashboard") + "</h1>"
      + "<p>" + esc(TAB_ASK[S.tab]) + (S.tab === "set" ? "" : " " + esc(when) + ".") + "</p></div>"
      + '<div class="mkd-acts-r">' + (S.tab === "set" ? '<button type="button" class="mkd-pill" data-tab="ov">← Back to the dashboard</button>' : sourcesPill())
      + (window.RSC && RSC.printView && S.tab !== "set" ? '<button type="button" class="mkd-btn" id="mkdPdf">Download PDF</button>' : "")
      + "</div></header>"
      + '<div class="mkd-bar">'
      + '<nav class="mkd-tabs" aria-label="Marketing Dashboard tabs">' + TABS.map(([k, l]) =>
        '<button type="button" data-tab="' + k + '"' + (k === S.tab ? ' class="on" aria-current="page"' : "")
        + ">" + esc(l) + "</button>").join("") + "</nav>"
      + '<div class="mkd-ctl">'
      + '<div class="rs-fld"><span>Period</span><div id="mkoDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="mkoCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + '<div id="mkoCo"></div>'
      + "</div></div>"
      + '<div id="mkoBody">' + body.html + "</div>"
      + "</div>";
    const pdf = host.querySelector("#mkdPdf");
    if (pdf) {
      pdf.onclick = () => {
        // a closed detail would print as one line: open them all, let their charts draw, then print
        const shut = Array.from(host.querySelectorAll("details.mko-plat:not([open])"));
        shut.forEach(d => { d.open = true; });
        setTimeout(() => RSC.printView({ host: host.querySelector("#mkoBody"),
          title: "Marketing Dashboard · " + ((TABS.find(t => t[0] === S.tab) || [])[1] || ""),
          subtitle: (S.co || "Both companies") + " · " + when }), shut.length ? 500 : 0);
      };
    }

    RSC.localSelect(host.querySelector("#mkoCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: S.co,
      onChange: v => { S.co = v; paint(host); },
    });
    RSC.dateRange(host.querySelector("#mkoDate"), {
      presets: periodPresets(),
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
        S.tab = b.dataset.tab; lsSet(LS_TAB, S.tab);
        if (b.dataset.topicGo) { S.seoTopic = b.dataset.topicGo; lsSet(LS_SEO, S.seoTopic); }
        paint(host);
        const nav = host.querySelector(".mkd-bar");
        if (nav && nav.getBoundingClientRect().top < 0) nav.scrollIntoView({ block: "start" });
      };
    });
    if (body.wire) body.wire(host);
  }

  registerPage({
    id: "marketing-overview",
    group: "marketing",
    title: "Marketing Dashboard",
    subtitle: "Every channel, what it cost and what it booked: overview, paid ads, search and SEO (Organic " +
              "Search included), website, reputation, social, and the data sources behind it.",
    datasets: [],

    render(host) {
      const mine = host;
      const alive = () => document.body.contains(mine);
      // an old #page=organic-search link is forwarded here by the shell's REDIRECTS: open its topic
      const fromOrganic = window.__navRequested === "organic-search";
      if (fromOrganic) window.__navRequested = null;
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
        plat("mkt_gsc", "gsc"), plat("mkt_gscq", "gscq"), plat("mkt_gsca", "gsca"), plat("mkt_ahd", "ahd"), plat("mkt_ahm", "ahm"),
        plat("mkt_bl", "bl"), plat("mkt_ga4", "ga4"), plat("mkt_ga4ch", "ga4ch"), plat("mkt_ga4demo", "demo"),
        plat("mkt_ga4geo", "geo"),
        plat("mkt_adsconv", "conv"), plat("mkt_adscamp", "camp"), plat("mkt_gptad", "gptad"),
        plat("mkt_gptads", "gptads"), plat("mkt_audit", "audit"), plat("mkt_issue", "issue"),
        plat("mkt_rcount", "rc"), plat("mkt_rgoal", "rg"), plat("mkt_adsnet", "net"), plat("mkt_adsnetc", "netc"),
        plat("mkt_gscp", "gscp"), plat("mkt_links", "links"), plat("mkt_ga4ev", "ga4ev"), plat("mkt_ga4dev", "ga4dev"),
        plat("mkt_ga4lp", "ga4lp"), plat("mkt_ga4u", "ga4u"), plat("mkt_negrev", "neg"),
        ZTZ.api("/api/_mktmark").then(j => (j && j.marks) || [])
          .catch(e => { P.err.marks = (e && e.message) || String(e); return []; }),
        plat("mkt_gscqd", "gscqd"), plat("mkt_gscpd", "gscpd"), plat("mkt_reddit", "reddit"),
        plat("mkt_refdom", "refdom"), plat("mkt_anchor", "anchor"), plat("mkt_ctrace", "ctrace"), plat("mkt_utmc", "utmc"),
        plat("mkt_brans", "brans"), plat("mkt_brmen", "brmen"), plat("mkt_brcit", "brcit"),
        plat("mkt_ahuse", "ahuse"), plat("mkt_ahquota", "ahquota"),
        plat("mkt_smov", "smov"), plat("mkt_smas", "smas"), plat("mkt_smorg", "smorg"), plat("mkt_smkw", "smkw"),
        plat("mkt_smaud", "smaud"), plat("mkt_smhist", "smhist"), plat("mkt_smuse", "smuse"),
        plat("mkt_li", "li"), plat("mkt_lipage", "lip"), plat("mkt_tt", "tt"),
        plat("mkt_mpost", "mpost"), plat("mkt_mad", "mad"), plat("mkt_mlife", "mlife"), plat("mkt_mpd", "mpd"), plat("mkt_msoc", "msoc"),
      ]).then(([conn, ch, ads, lsaC, lsaL, meta, gpt, gsc, gscq, gsca, ahd, ahm, bl, ga4, ga4ch, demo, geo,
                conv, camp, gptad, gptads, audit, issue, rc, rg, net, netc,
                gscp, links, ga4ev, ga4dev, ga4lp, ga4u, neg, marks, gscqd, gscpd, reddit, refdom, anchor, ctrace, utmc,
                brans, brmen, brcit, ahuse, ahquota, smov, smas, smorg, smkw, smaud, smhist, smuse, li, lip, tt, mpost, mad, mlife, mpd, msoc]) => {
        D.conn = (conn || []).slice().sort((a, b) => (+a.Sort || 0) - (+b.Sort || 0));
        index(ch || []);
        indexPlatforms(ads, lsaC, lsaL, meta, gpt);
        indexWeb({ gsc, gscq, gsca, ahd, ahm, bl, ga4, ga4ch, demo, geo });
        indexBatch1({ conv, camp, gptad, gptads, audit, issue, rc, rg, net, netc });
        indexBatch2({ gscp, links, ga4ev, ga4dev, ga4lp, ga4u, neg, gscqd, gscpd });
        indexMarks(marks);
        indexReddit(reddit);
        indexLinkedIn(li, lip);
        indexTikTok(tt);
        indexMeta({ mpost, mad, mlife, mpd, msoc });
        indexBatch3({ refdom, anchor, ctrace });
        P.utmc = (utmc || []).map(r => ({ d: d10(r.Date), plat: r.Platform, camp: normCamp(r["UTM Campaign"]), leads: num(r.Leads), booked: num(r.Booked) }));
        indexBrandRadar({ brans, brmen, brcit });
        indexAhrefsUsage({ ahuse, ahquota });
        indexSemrush({ smov, smas, smorg, smkw, smaud, smhist, smuse });
        // a failed read is tried again on the next visit
        D.ready = !D.chErr && !D.connErr && !Object.keys(P.err).length;
        Object.keys(TREND).forEach(k => { delete TREND[k]; });   // the month trends read the new rows
        if (!alive()) return;
        boot();
        if (fromOrganic) { S.tab = "seo"; S.seoTopic = "demand"; }
        paint(host);
      });
    },
  });
})();
