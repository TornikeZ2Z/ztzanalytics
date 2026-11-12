/* Sophie's ecosystem page 6, "Competitor analysis" (ZTZ-68): the Competitor Map's "Content gaps" tab.
 * Her own note: copied on 6 Nov 2026 from the Zip to Zip Moving competitor gap map (that original refreshes
 * monthly). Copied from her page on 12 Nov 2026; see pages/ecosystem-data.js for the format.
 * These are her 25 competitors (5 per state in NJ, NY, PA, CT, DE), not Tako's 160 on the map. */
(function () {
  const T = s => s.trim().split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(c => c.trim()));
  window.ZTZ_ECO = window.ZTZ_ECO || {};
  window.ZTZ_ECO.competitors = {
    lead: "**Connecticut** has the widest content gap against competitors (score **67** out of 100). The gap that most often tops a state's list is **community & partner proof**, which is also what a partnership program can fix. Snapshot: **November 2026**.",
    kpis: [["25", "Competitors tracked in five states"], ["Connecticut", "Widest-gap state"], ["5", "High-priority gaps to close"],
           ["97%", "Zip to Zip Moving positive reviews (moveBuddha)"], ["3,687", "Zip to Zip Moving organic visits a month (Semrush)"]],
    states: [["NJ", "New Jersey"], ["NY", "New York"], ["PA", "Pennsylvania"], ["CT", "Connecticut"], ["DE", "Delaware"]],
    layers: [["overview", "Overview"], ["activity", "Activity map: rank and leads"], ["positioning", "Positioning and partnerships"],
             ["reputation", "Reputation and platforms"], ["tactics", "Tactics versus ours"], ["community", "Community and route pages"],
             ["gaps", "Gaps and 30-day plan"], ["campaigns", "Campaigns"], ["search", "Search snapshot"], ["method", "Method and limits"]],

    /* -- Overview: gap score and the biggest gaps per state -- */
    overview: {
      title: "Gap score by state", sub: "Higher means competitors do more that Zip to Zip Moving does not. Click a bar to open that state.",
      // state | score | tactics missing or thin | covered
      scores: T(`
        CT|67|4|Specialty service pages
        NY|63|4|Specialty service pages
        DE|59|4|Specialty service pages
        PA|57|4|Specialty service pages · Credentials & associations
        NJ|50|3|Specialty service pages · Credentials & associations`),
      // state | gap | Zip to Zip status | competitors using it (of 5)
      gaps: T(`
        CT|Origin→destination route guides|missing|2
        CT|Community & partner proof|missing|2
        CT|Planning tools & FAQ hubs|partial|2
        CT|State/city cost guide|partial|1
        CT|Credentials & associations|partial|1
        NY|State/city cost guide|partial|4
        NY|Credentials & associations|partial|4
        NY|Price-lock / written pricing|missing|3
        NY|Planning tools & FAQ hubs|partial|3
        NY|County, city & borough pages|thin|2
        DE|County, city & borough pages|thin|4
        DE|Credentials & associations|partial|3
        DE|Community & partner proof|missing|2
        DE|Planning tools & FAQ hubs|partial|2
        DE|Price-lock / written pricing|missing|1
        PA|Community & partner proof|missing|3
        PA|County, city & borough pages|thin|3
        PA|Planning tools & FAQ hubs|partial|3
        PA|Price-lock / written pricing|missing|2
        PA|State/city cost guide|partial|1
        NJ|Community & partner proof|missing|2
        NJ|County, city & borough pages|partial|2
        NJ|Planning tools & FAQ hubs|partial|2
        NJ|Origin→destination route guides|missing|1
        NJ|Price-lock / written pricing|missing|1`),
      // state | competitor | the page that does the most for them
      competitors: T(`
        CT|RT Relocation|Moving from Connecticut to New Jersey: complete guide
        CT|JB Moving Services|Fine-home moving, wine storage, document destruction
        CT|Kaster Moving & Storage|2026 Moving Cost Guide for Stamford, CT
        CT|Colonial Moving & Storage|CT-to-Vermont / Rhode Island guides + packing content
        CT|Hands On Moving & Storage|How many boxes do I need to relocate?
        NY|Moishe's Moving Systems|How much do movers cost in NYC? (2026 price guide)
        NY|Piece of Cake Moving & Storage|Average moving costs in NYC (2026 guide)
        NY|FlatRate Moving|Best moving companies in NYC 2026 (comparison guide)
        NY|Oz Moving & Storage|What is a moving COI and how to get one
        NY|Caddy Moving|Ultimate guide to moving in NYC: neighborhoods, costs, tips (2026)
        DE|Stewart Moving & Storage|Dover, DE location page: full-service, crating, storage
        DE|Bayshore Transportation (Allied)|Newark, DE page with local area content
        DE|TWO MEN AND A TRUCK Delaware South|Dover hub: service-area towns, video guides, team page
        DE|Move Crew LLC|Wilmington, DE moving company services page
        DE|All Around Moverz|Published rate card: $140/hr local, flat long-distance, beat-any-rate offer
        PA|The Armstrong Company|Harrisburg moving service page + resource hub
        PA|Gentle Giant Moving Company|Philadelphia page: neighborhoods, crews and services
        PA|EverSafe Moving Co.|Philadelphia Price Lock Guarantee + pricing FAQs
        PA|Hughes Relocation Services|Office downtime, disassembly and interstate guides
        PA|Forward Moving LLC|Chester County FAQs: hourly, packing, storage, downsizing
        NJ|White Glove Moving & Storage|Moving FAQs + route and senior guides
        NJ|Ample Moving|Hudson County moving service page
        NJ|Molloy Bros. / Molloy Moving|Moving checklist, packing tips and Ask a Mover
        NJ|College HUNKS Hauling Junk & Moving|NJ local hubs: moving, labor and donation pickup
        NJ|Booth Movers|Cost of Moving in New Jersey in 2026`),
    },

    /* -- Activity map: rank and leads -- */
    activity: {
      title: "What moves brand rank and leads: the activity map",
      sub: "Every marketing activity sits in one of three stages: be found, be believed, be chosen. The bar is its estimated share of the value that puts a mover at the top of a region and makes it the first choice, whatever the price.",
      kpis: [["34%", "All SEO and links together"], ["20%", "Reviews alone"], ["6%", "Community, CSR and sponsorship"], ["8%", "Partner referrals"]],
      stages: [["Be found", 38], ["Be believed", 42], ["Be chosen → lead", 20]],
      firstMeet: [["Comparing", "50%"], ["Searching now", "38%"], ["Referred", "8%"], ["Will move soon", "4%"]],
      answer: "Reviews are the biggest single lever, ahead of any one SEO activity, and all SEO work together is still the largest group. Community and CSR partnerships are a small direct ranking driver. Their value is what they feed: reviews, local links, press and mentions that AI answers repeat. Partnerships and postcards win leads that never compare, so they work beside ranking, not instead of it.",
      note: "These shares are a working model, not a measured result; no study splits brand rank this way. Each row cites the evidence it rests on, and the weights can be changed in the data as real results come in. The shares apply to all five states; per-state weights need Search Console and Google Business Profile data.",
      cols: ["Stage", "Activity", "Share %", "Direct ranking effect", "Feeds", "What triggers the lead", "Evidence", "Zip to Zip Moving", "Next step"],
      rows: T(`
        1 Be found|Google Business Profile and map listing|12|High|Reviews, photos, posts, local links|Customer searches 'movers near me' or a town|Whitespark's annual expert survey puts the Google Business Profile, led by the primary category, as the largest single slice of map-pack ranking.|Not audited|Audit categories, services, photos and weekly posts for each state; no audit was done in this research.
        1 Be found|Route, town and cost guide pages (SEO content)|12|High|Links, Reddit citations, AI answers|Customer searches 'movers from X to Y' or 'cost to move'|Whitespark's organic factors put a dedicated page per service or place first. The gap list shows route, cost and town pages as High priority gaps.|Gap|Publish route, cost and town pages first for New Jersey to New York and Connecticut.
        1 Be found|Guest posts, backlinks and local citations|6|Medium|Authority for guide pages|Search engines reading links as proof of local authority|Link and citation signals are a smaller slice than the profile and on-page factors in the Whitespark expert survey.|Partial|Prioritise local news, chambers, university and partner sites over bought guest posts.
        1 Be found|Technical SEO: site that renders for crawlers|4|Medium|Everything above it|Crawler cannot read the page, so no page can trigger a lead|Gap G01 in the gap list: the staged site depends on JavaScript rendering. This is a multiplier, so it is a small share but a hard block when broken.|Gap|Fix rendering before publishing new pages.
        1 Be found|Paid lead platforms: Thumbtack, moveBuddha, Yelp ads|4|Low|Review count on those platforms|Customer requests quotes on a marketplace|Buys leads, not ranking. Gap G14 flags marketplace dependence, and moveBuddha profiles feed review comparisons.|Partial|Cap spend; use it to collect reviews and test states, not as the base.
        2 Be believed|Reviews: volume, recency, rating and replies|20|High|Map ranking, AI answers, conversion|Customer compares two or three shortlisted movers|BrightLocal 2026 survey of 1,002 US adults: 85% more likely to use a business after positive reviews; 74% look for reviews from the last three months; 31% only use 4.5 stars or higher; 80% prefer businesses that reply to all reviews.|Partial|Ratings are strong (Google 4.9, Trustpilot 4.9, Yelp 5.0); the gap is review volume on moveBuddha. Ask every job for a review and reply to all.
        2 Be believed|Reddit, Quora and 'best of' list mentions|8|Medium|AI search answers|Customer asks an AI tool or Google for the best mover and sees named brands|Whitespark's first AI-search chart ranks being named on expert 'best of' lists first. BrightEdge (17 May to 2 Aug 2026): Google AI Overviews carries about 88% of Reddit's AI citation volume, and shoppers use Reddit to check a brand, not to find one.|Gap|Earn mentions in state subreddits and on best-mover lists; no self-promotion.
        2 Be believed|Credentials and price transparency: licence, insurance, binding estimate|6|Low|Conversion, review sentiment|Customer worried about scams or surprise bills|This Old House 2025 survey, cited by Netpeak: 43% of movers offer a binding estimate; 89% of customers quoted a rate said the final bill matched. Gap G06 is price lock.|Gap|Put USDOT, MC number, insurance and the price lock promise on every page.
        2 Be believed|Community and CSR partnerships|3|Low|Reviews, local links, press, AI mentions|Customer sees the brand as local and trusted; rarely the first trigger|No study found measures a direct ranking effect for charity partnerships. Competitor examples (Move For Hunger, food banks, Movers for Moms) earn local links and mentions, which are counted in the rows they feed.|Gap|Run one partnership per state and publish a page for it that earns local links and reviews.
        2 Be believed|Signature brand campaign or sponsorship|3|Low|Branded search, press, social|Customer already knows the name and searches it directly|Piece of Cake and the Knicks sponsorship is the one signature campaign in the competitor research; its effect is branded search and recall, not map ranking.|Gap|Test a small local sponsorship only after reviews and pages are working.
        2 Be believed|Video and crew bios|2|Low|Reviews, conversion|Customer wants to see who comes to the house|Gaps G08 and G09 in the gap list: crew bios and video appear on competitor pages and are missing from ours.|Gap|Short crew intros on route pages and the profile.
        3 Be chosen|Partner referrals: lenders, insurers, agents, universities|8|Low|Reviews, brand search|Customer is told 'call this mover' by someone they trust at the moment of a move|Competitors in the partnership lens win through referral partners. These leads come before the customer compares, so ranking matters less.|Gap|Start with the closing and welcome kits and the university plan.
        3 Be chosen|Quote experience: speed, price clarity, follow-up|8|Low|Reviews|Customer has two quotes and picks the one that answers first and clearly|Communication is the leading complaint among dissatisfied customers in the This Old House 2025 survey (53%), cited by Netpeak.|Not audited|Not audited here. Measure time to first reply and send a clear written estimate.
        3 Be chosen|Signal-based postcards to homes for sale|4|Low|Brand recall, branded search|Home listed for sale or purchase signals a move within weeks|Reaches people who are not searching yet; this is the signal-based play from the postcard programme. The effect on ranking is indirect, through branded search.|Partial|Keep the test running and track code ZIP20 redemptions.`),
    },

    /* -- Positioning and partnerships -- */
    positioning: {
      lens: { title: "Partnership lens: how competitors win through partners",
        sub: "Competitors whose single most effective play is a partnership, filtered by the state above. These are the same kinds of partners as on the partnership map.",
        cards: T(`
          NJ|College HUNKS Hauling Junk & Moving|Donation-minded hauling, incl. Ukraine relief trucks (2022)
          NY|Moishe's Moving Systems|Monthly giving to Wounded Warrior Project and Susan G. Komen, plus Mana Contemporary arts ties
          PA|The Armstrong Company|Move For Hunger Mover of the Month (Lancaster, Dec 2023)
          PA|Forward Moving LLC|Community Warehouse Project furniture-donation partnership
          CT|JB Moving Services|Shred Station Express document-destruction partnership
          CT|Hands On Moving & Storage|Hands On Foundation Fund at the Community Foundation
          DE|Bayshore Transportation (Allied)|Move For Hunger wrapped truck and customer pantry pickups for the Food Bank of Delaware`),
        means: T(`
          Medium|No community or partner proof|Run one partner pilot (realtor + nonprofit donation day), document it, and add a Community page.
          Medium|No signature brand campaign or partnership|Choose one recurring signature campaign (see Featured campaigns) and run it in every state.`) },
      known: { title: "What each competitor is known for",
        sub: "Positioning in one line, then the single content piece, partnership, campaign or reputation play doing the most work for them. Zip to Zip Moving comes first for comparison.",
        // state | name | known for | play type | play
        cards: T(`
          All|Zip to Zip Moving|Licensed interstate mover across 8 states, top-rated on lead marketplaces|Reputation|Thumbtack Top Pro six times (2019, 2021-2025); 5.0 on Angi (288) and HomeAdvisor (434); 4.9 on Trustpilot (422)
          NJ|White Glove Moving & Storage|30-year mover for fine homes: pianos, antiques, estates, custom crating|Campaign|Free-move giveaway: every estimate request entered to win a move worth up to $5,000 (Sept 2026)
          NJ|Ample Moving|Fast-growing, affordable North Jersey mover|Content|County-by-county NJ service pages (Hudson County and more)
          NJ|Molloy Bros. / Molloy Moving|48-year Mayflower agent for full-service moves and storage|Content|Tools & Tips hub: checklist, glossary, Ask a Mover and MySite planner
          NJ|College HUNKS Hauling Junk & Moving|Moving plus junk removal and donation pickup in one booking|Partnership|Donation-minded hauling, incl. Ukraine relief trucks (2022)
          NJ|Booth Movers|81-year family institution (since 1945), pianos and storage|Content|Cost of Moving in New Jersey in 2026 pricing guide
          NY|Moishe's Moving Systems|NYC since 1983: own crews, owned art and wine storage|Partnership|Monthly giving to Wounded Warrior Project and Susan G. Komen, plus Mana Contemporary arts ties
          NY|Piece of Cake Moving & Storage|NYC's most-reviewed mover with an all-inclusive flat quote|Campaign|Official Moving & Storage Partner of the New York Knicks
          NY|FlatRate Moving|Guaranteed all-inclusive flat-rate pricing; GSA, military and UN certified|Content|Self-published Best movers in NYC 2026 comparison guide
          NY|Oz Moving & Storage|Building-compliant NYC mover: 'Organized. Outstanding. On Time.'|Content|Moving COI guide backed by preferred-mover building relationships
          NY|Caddy Moving|On-demand hourly moving labor in 90+ cities|Content|Ultimate NYC neighborhoods, costs and tips guide (2026)
          PA|The Armstrong Company|National relocation network with local Harrisburg service|Partnership|Move For Hunger Mover of the Month (Lancaster, Dec 2023)
          PA|Gentle Giant Moving Company|Athlete crews: a moving company built on rowers|Campaign|400+ rowers employed, Olympic medallists, Move For Hunger Mover of the Year 2021
          PA|EverSafe Moving Co.|Price certainty for Philadelphia moves|Content|Philadelphia Price Lock Guarantee
          PA|Hughes Relocation Services|United Van Lines agent for office and corporate relocations|Content|Office-downtime and business relocation guides
          PA|Forward Moving LLC|Affordable Chester County mover with downsizing help|Partnership|Community Warehouse Project furniture-donation partnership
          CT|RT Relocation|The military and law-enforcement mover|Content|Moving from Connecticut to New Jersey route guide
          CT|JB Moving Services|Complex estate and fine-home moves: wine, antiques, crating|Partnership|Shred Station Express document-destruction partnership
          CT|Kaster Moving & Storage|49-year Atlas agent serving Fairfield County|Content|2026 Moving Cost Guide for Stamford, CT
          CT|Colonial Moving & Storage|Last-minute moves and flexible support|Content|CT-to-Vermont and Rhode Island route guides
          CT|Hands On Moving & Storage|Founder-led New Haven mover|Partnership|Hands On Foundation Fund at the Community Foundation
          DE|Stewart Moving & Storage|Dover's established full-service mover with custom crating|Reputation|Seven-location regional network, top of moveBuddha's Delaware list
          DE|Bayshore Transportation (Allied)|53-year Allied agent known for fighting hunger|Partnership|Move For Hunger wrapped truck and customer pantry pickups for the Food Bank of Delaware
          DE|TWO MEN AND A TRUCK Delaware South|'Movers Who Care': the most visible community mover in Kent and Sussex|Campaign|Movers for Moms shelter drive and Thunder Over Dover air show sponsorship
          DE|Move Crew LLC|Budget-friendly, flexible Wilmington crew|Content|Wilmington services page with piano, hot tub and junk add-ons
          DE|All Around Moverz|Affordable New Castle mover with a public rate card and senior/military discounts|Content|Service Pledge: no weight, mileage, stair or last-minute fees; on-site price guaranteed`) },
    },

    /* -- Reputation and platforms -- */
    reputation: {
      ratings: { title: "Star ratings: Google and Yelp",
        sub: "One row per company, from moveBuddha profiles so ratings compare like for like; New York City companies come from their own sites. A missing dot means no rating was found." },
      board: { title: "Reputation scoreboard", sub: "Verified reviews and share positive are moveBuddha's counts across platforms.",
        cols: ["Company", "State", "Google", "Google reviews", "Yelp", "BBB", "Verified reviews", "% positive", "Years"],
        rows: T(`
          Zip to Zip Moving|All|4.7||4.8|A+|382|97%|8
          EverSafe Moving Co.|PA|4.9|799|4.7|A+|962|99%|15
          Gentle Giant Moving Company|PA|4.9|375|4.8|A+|242|98%|46
          Forward Moving LLC|PA|4.9|562|3.7|A+|694|98%|9
          Ample Moving|NJ|4.8||4.0|A|769|96%|8
          Booth Movers|NJ|4.9||4.3|A+|965|96%|81
          RT Relocation|CT|4.8||3.5|A+|815|96%|16
          Stewart Moving & Storage|DE|4.8|||A+|211|95%|29
          College HUNKS Hauling Junk & Moving|NJ|4.9||4.1|A+|288|93%|3
          Hughes Relocation Services|PA|4.7|373|3.4|A+|626|93%|44
          Move Crew LLC|DE|4.8||3.9|F|738|93%|
          White Glove Moving & Storage|NJ|4.7||4.3|A+|1,631|91%|30
          JB Moving Services|CT|4.6||4.1|A+|128|87%|40
          Kaster Moving & Storage|CT|4.5||3.3|A+|104|85%|49
          Colonial Moving & Storage|CT|4.5||3.0|A+|469|85%|8
          Bayshore Transportation (Allied)|DE|4.5||2.9|A+|321|84%|53
          All Around Moverz|DE|4.6||4.0|A+|138|84%|16
          Hands On Moving & Storage|CT|4.3||3.8|F|288|83%|12
          TWO MEN AND A TRUCK Delaware South|DE|4.3||2.9|A+|247|81%|11
          Molloy Bros. / Molloy Moving|NJ|4.3||3.9|A+|82|79%|48
          Moishe's Moving Systems|NY|4.7|1,000|||||43
          Piece of Cake Moving & Storage|NY|4.8|14,788|4.6||||
          FlatRate Moving|NY|4.7|2,724||A+|||35
          Oz Moving & Storage|NY|4.7|1,300||A+|||33
          Caddy Moving|NY|||||||
          The Armstrong Company|PA|||||||`) },
      leads: { title: "Where they get leads and reviews",
        sub: "Rating and review count where shown; \"Listed\" means a profile exists without a rating. A blank cell means not found, not proof of absence.",
        cols: ["Company", "State", "Google", "Yelp", "BBB", "Angi", "HomeAdvisor", "Thumbtack", "Trustpilot", "moveBuddha", "Other channels", "Lead model"],
        rows: T(`
          Zip to Zip Moving|All|4.7|4.8|A+|5.0 · 288|5.0 · 434|4.9 · 404|4.9 · 422|4.8|MyMovingReviews 5.0 · Bark · YellowPages · Nextdoor, Zillow, Reddit, Moving Waldo landing pages|Marketplace-led: Thumbtack Top Pro 2019 and 2021-2025, 466 Thumbtack hires; new partner referral program staged
          White Glove Moving & Storage|NJ|4.7|4.3|A+|||||4.7|Free-move giveaway (estimate = entry, Sept 2026) · scholarship|Organic + reviews
          Ample Moving|NJ|4.8|4.0|A|4.9 · 34||||4.6|moveBuddha partner (paid listing)|Directory partner + Angi
          Molloy Bros. / Molloy Moving|NJ|4.3|3.9|A+|||||4.5|Mayflower network · TAG|Van line (Mayflower) + organic tools hub
          College HUNKS Hauling Junk & Moving|NJ|4.9|4.1|A+|||||4.4|National franchise brand + own review pages|Franchise brand demand
          Booth Movers|NJ|4.9|4.3|A+|||||4.4|NJ movers association Circle of Excellence|Heritage brand + association
          Moishe's Moving Systems|NY|4.7||||||||Trustindex verified badge · 4 Google location profiles|Google reviews per location + 15% off pop-up
          Piece of Cake Moving & Storage|NY|4.8|4.6||||4.8 · 214|4.9 · 12,649||Instagram promo codes · referral program|Brand + Knicks audience + Thumbtack
          FlatRate Moving|NY|4.7||A+||||4.7 · 83||Birdeye 4.7 · Verified Surveys 5.0 · Consumer Affairs · unpakt|Review aggregators + $50 referral
          Oz Moving & Storage|NY|4.7||A+||||||Preferred-mover building lists|Building management referrals
          Caddy Moving|NY||||||Listed|Listed||Craigslist ads · HireAHelper|On-demand marketplaces
          The Armstrong Company|PA||||||||Listed|MyMovingReviews · Facebook|National network
          Gentle Giant Moving Company|PA|4.9|4.8|A+|||||4.5|Move For Hunger|Brand + community
          EverSafe Moving Co.|PA|4.9|4.7|A+|||||4.4|MyMovingReviews · Moving Company Reviews|Reviews + price guarantee
          Hughes Relocation Services|PA|4.7|3.4|A+|||||4.5|United Van Lines · MyMovingReviews|Van line + corporate
          Forward Moving LLC|PA|4.9|3.7|A+|||||4.6|Community Warehouse Project|Google reviews + local partners
          RT Relocation|CT|4.8|3.5|A+|||||4.7|Military/law-enforcement discount|Niche audiences
          JB Moving Services|CT|4.6|4.1|A+|||||4.7|Shred Station Express co-referrals|Business partner referrals
          Kaster Moving & Storage|CT|4.5|3.3|A+|||||4.6|Atlas Van Lines · ProMover|Van line + organic
          Colonial Moving & Storage|CT|4.5|3.0|A+|||||4.5|Discount promotions|Price-led
          Hands On Moving & Storage|CT|4.3|3.8|F|||||4.7|Founder foundation|Community
          Stewart Moving & Storage|DE|4.8||A+|||||4.5|7 locations|Regional network
          Bayshore Transportation (Allied)|DE|4.5|2.9|A+|||||4.5|Allied Van Lines · Women's Choice Award|Van line + community
          TWO MEN AND A TRUCK Delaware South|DE|4.3|2.9|A+|||||4.2|Own reviews (877, 97% referral) · videos|Franchise brand + events
          Move Crew LLC|DE|4.8|3.9|F|||||4.4||Review volume
          All Around Moverz|DE|4.6|4.0|A+|4.9 · 16||||4.4|HireAHelper 4.8 · 149 (615 moves booked) · published rate card|Own rate card + HireAHelper marketplace`) },
    },

    /* -- Tactics versus ours -- */
    tactics: {
      title: "What competitors do versus what Zip to Zip Moving has",
      sub: "Each cell: Zip to Zip Moving's status, then how many of that state's tracked competitors use the tactic. Click a cell for the evidence.",
      // tactic | NJ | NY | PA | CT | DE   (status · competitors using it, of 5)
      matrix: T(`
        State/city cost guide|Partial 1|Partial 4|Partial 1|Partial 1|Partial 1
        County, city & borough pages|Partial 2|Thin 2|Thin 3|Thin 0|Thin 4
        Origin→destination route guides|Missing 1|Missing 0|Missing 0|Missing 2|Missing 0
        Planning tools & FAQ hubs|Partial 2|Partial 3|Partial 3|Partial 2|Partial 2
        Price-lock / written pricing|Missing 1|Missing 3|Missing 2|Missing 0|Missing 1
        Specialty service pages|Covered 1|Covered 0|Covered 1|Covered 1|Covered 2
        Community & partner proof|Missing 2|Missing 1|Missing 3|Missing 2|Missing 2
        Named experts & crew bios|Partial 0|Partial 2|Partial 1|Partial 0|Partial 1
        Credentials & associations|Covered 3|Partial 4|Covered 3|Partial 1|Partial 3`),
      // what was found on ziptozipmoving.com: tactic | states ("*" = every state) | text
      evidence: T(`
        State/city cost guide|*|One general cost article plus a cost calculator; no state, city or 2026 guide. Staged new site (site.ziptozip.app, not yet live): Move Report (Sept 2026) adds a 2026 local cost table by home size.
        County, city & borough pages|NJ|State page plus North, Central and South Jersey area pages; no county or town pages. Staged new site (site.ziptozip.app, not yet live): 21 counties, 565 town pages.
        County, city & borough pages|NY DE|One generic state page; no county, city or borough pages. The staged new site also shows only a local office for this state.
        County, city & borough pages|PA|One generic state page; no county, city or borough pages. Staged new site (site.ziptozip.app, not yet live): 9 counties, 118 town pages.
        County, city & borough pages|CT|One generic state page; no county, city or borough pages. Staged new site (site.ziptozip.app, not yet live): 7 counties, 115 town pages.
        Origin→destination route guides|*|No origin-to-destination route guides in the sitemap or on the staged new site's 91-guide blog.
        Planning tools & FAQ hubs|*|Move-day checklist, FAQ and cost calculator; no packing or box tools.
        Price-lock / written pricing|*|Valuation coverage page only; no price-lock or written-pricing guarantee page.
        Specialty service pages|*|Pages for piano, fine art, antiques, wine, medical, trade-show, senior and COI moves.
        Community & partner proof|*|No nonprofit, donation, scholarship or sponsorship page found. Staged new site (site.ziptozip.app, not yet live): a partner referral program page, but no named partners or charity work.
        Named experts & crew bios|*|One blog author and a team page; no local crew bios or signed guides. Staged new site (site.ziptozip.app, not yet live): homepage introduces foreman George; guides still unsigned.
        Credentials & associations|NJ|NJ license, USDOT and MC shown site-wide.
        Credentials & associations|PA|PA PUC number, USDOT and MC shown site-wide.
        Credentials & associations|NY CT DE|Footer shows USDOT, MC, NJ and PA licenses only; no state-specific credential or association badge for this state.`),
      content: { title: "Competitor content and trust tactics",
        sub: "The page or proof each competitor leans on, why it may work, and the trust signal behind it.",
        cols: ["State", "Competitor", "Content", "Why it may help", "Trust and activity", "Tactics"],
        rows: T(`
          NJ|White Glove Moving & Storage|Moving FAQs + route and senior guides|Direct answers to tipping, prep and coverage questions (updated May 2026), plus a guaranteed long-distance inventory price, connect research to a quote.|$1,000 scholarship; 2026 recipient named on page|Planning tools & FAQ hubs · Origin→destination route guides · Community & partner proof · Price-lock / written pricing
          NJ|Ample Moving|Hudson County moving service page|County and town pages match local service intent and link a broad NJ coverage network.|Published local license, locations and quote form|County, city & borough pages · Credentials & associations
          NJ|Molloy Bros. / Molloy Moving|Moving checklist, packing tips and Ask a Mover|A connected tools hub answers several planning needs with a clear next step.|Mayflower agency and TAG partnership shown on site|Planning tools & FAQ hubs · Credentials & associations
          NJ|College HUNKS Hauling Junk & Moving|NJ local hubs: moving, labor and donation pickup|City pages and online estimates cover several needs around one household move.|North NJ trucks supported Ukraine donations (2022)|County, city & borough pages · Specialty service pages · Community & partner proof
          NJ|Booth Movers|Cost of Moving in New Jersey in 2026|A state-and-year pricing topic meets commercial intent and explains quote factors.|NJ movers association Circle of Excellence listing|State/city cost guide · Credentials & associations
          NY|Moishe's Moving Systems|How much do movers cost in NYC? (2026 price guide)|Prices by home size plus walk-up, parking and co-op COI rules answer the NYC buying question; signed by the company president.|NJ, NY DOT and USDOT numbers in footer; president byline|State/city cost guide · Planning tools & FAQ hubs · Named experts & crew bios · Credentials & associations
          NY|Piece of Cake Moving & Storage|Average moving costs in NYC (2026 guide)|Cost tables by home size plus building and co-op hidden fees and an obligation-free guaranteed flat price, feeding a multi-step quote form.|Official moving partner of the New York Knicks, renewed Oct 2025|State/city cost guide · Community & partner proof · Credentials & associations · Price-lock / written pricing
          NY|FlatRate Moving|Best moving companies in NYC 2026 (comparison guide)|A self-published comparison with ratings, Reddit quotes and a cost table captures 'best movers NYC' research searches.|Founded 1991; BBB A+; Google 4.7 from 2,700+ reviews (self-reported); flat-rate pricing|Price-lock / written pricing · Credentials & associations · State/city cost guide
          NY|Oz Moving & Storage|What is a moving COI and how to get one|Step-by-step COI guidance signed by the GM answers a building requirement every NYC mover hits; borough pages like Manhattan add guaranteed upfront pricing.|30+ years; Google 4.7 (1,300+), BBB A+, Movage agent|Planning tools & FAQ hubs · County, city & borough pages · Credentials & associations · Named experts & crew bios · Price-lock / written pricing
          NY|Caddy Moving|Ultimate guide to moving in NYC: neighborhoods, costs, tips (2026)|Borough-by-borough profiles, a cost breakdown and a 10-question FAQ cover relocation research end to end.|Cites Census, Zillow and BLS data; no reviews or community proof on page|County, city & borough pages · State/city cost guide · Planning tools & FAQ hubs
          PA|The Armstrong Company|Harrisburg moving service page + resource hub|Local service pages with guaranteed move estimates and the PA PUC number connect residential, office and storage needs to a national resource library.|Lancaster team recognized by Move For Hunger (Dec 2023)|County, city & borough pages · Planning tools & FAQ hubs · Community & partner proof · Price-lock / written pricing · Credentials & associations
          PA|Gentle Giant Moving Company|Philadelphia page: neighborhoods, crews and services|Named neighborhoods and local staff bios make city-level expertise tangible.|Philadelphia food-rescue volunteering (Move For Hunger)|County, city & borough pages · Named experts & crew bios · Community & partner proof
          PA|EverSafe Moving Co.|Philadelphia Price Lock Guarantee + pricing FAQs|Tackles the main buying objection, an unexpected final bill, beside quote links and pricing.|2026 Philly Favorites gold (Inquirer), BBB accreditation, 10% over-quote cap|Price-lock / written pricing · State/city cost guide · Credentials & associations
          PA|Hughes Relocation Services|Office downtime, disassembly and interstate guides|Task-specific articles address household questions and business relocation risks.|United Van Lines agency shown prominently|Planning tools & FAQ hubs · Specialty service pages · Credentials & associations
          PA|Forward Moving LLC|Chester County FAQs: hourly, packing, storage, downsizing|Local service explanations support the whole move, including decluttering and closing-date gaps.|Community Warehouse Project furniture-donation partner|Planning tools & FAQ hubs · County, city & borough pages · Community & partner proof
          CT|RT Relocation|Moving from Connecticut to New Jersey: complete guide|Origin-to-destination content matches a specific relocation need and links to long-distance quotes.|Military and law-enforcement discount page|Origin→destination route guides
          CT|JB Moving Services|Fine-home moving, wine storage, document destruction|Specialist pages address valuable household and business needs beyond generic moving queries.|Shred Station Express partnership confirmed by both businesses|Specialty service pages · Community & partner proof
          CT|Kaster Moving & Storage|2026 Moving Cost Guide for Stamford, CT|City pricing factors (stairs, parking, scope, season) lead readers to an estimate.|Atlas agency, ProMover and BBB credentials|State/city cost guide · Credentials & associations
          CT|Colonial Moving & Storage|CT-to-Vermont / Rhode Island guides + packing content|Route-specific planning and packing articles map to a clear service need.|Promotes reviews and discounts; sponsorship not verified|Origin→destination route guides · Planning tools & FAQ hubs
          CT|Hands On Moving & Storage|How many boxes do I need to relocate?|A concrete planning question is a natural route into packing and moving services.|Founder's Hands On Foundation Fund (2022–23 report)|Planning tools & FAQ hubs · Community & partner proof
          DE|Stewart Moving & Storage|Dover, DE location page: full-service, crating, storage|A dedicated Dover page with hourly rates, nearby towns, Dover AFB PCS moves and crating; claims AMSA ProMover.|29 years; 211 reviews, 95% positive (moveBuddha); military discount|County, city & borough pages · Specialty service pages · Credentials & associations
          DE|Bayshore Transportation (Allied)|Newark, DE page with local area content|Allied's Newark agent page weaves in University of Delaware, parks and Main Street content (it does not name Bayshore).|Move For Hunger truck + Food Bank of Delaware donations; Allied, BBB, ProMover|County, city & borough pages · Community & partner proof · Credentials & associations
          DE|TWO MEN AND A TRUCK Delaware South|Dover hub: service-area towns, video guides, team page|Town-level service area, how-to videos and named crew make a franchise feel local.|Movers for Moms, Food Bank of Delaware, Toys for Tots and more|County, city & borough pages · Named experts & crew bios · Planning tools & FAQ hubs · Community & partner proof
          DE|Move Crew LLC|Wilmington, DE moving company services page|A Wilmington page plus piano, hot tub and junk services pulls varied local demand.|738 reviews, 93% positive (moveBuddha); BBB grade F|County, city & borough pages · Specialty service pages
          DE|All Around Moverz|Published rate card: $140/hr local, flat long-distance, beat-any-rate offer|Exact prices, a local vs long-distance calculator and a beat-any-quote promise answer 'how much?' before the first call.|Service Pledge: no hidden fees, on-site price guaranteed; USDOT/MC shown; BBB A+|Price-lock / written pricing · State/city cost guide · Planning tools & FAQ hubs · Credentials & associations`) },
    },

    /* -- Community and route pages -- */
    community: { title: "Community and route pages: what competitors promote",
      sub: "Each row is a real competitor page. Community rows follow the state above; route pages apply to every state.",
      cols: ["Type", "Competitor", "State", "What they promote", "Page", "Idea for Zip to Zip Moving"],
      rows: T(`
        Community partnership|Bayshore Transportation (Allied)|DE|Food bank: customers donate leftover pantry food|Move For Hunger truck hits the road (Food Bank of Delaware)|Add a one-line pantry-donation offer to the sales script; partner with one food bank per state.
        Community partnership|The Armstrong Company|PA|Hunger relief: Move For Hunger Mover of the Month|Mover of the Month award, Lancaster (Dec 2023)|Join Move For Hunger or a local equivalent and publish the recognition.
        Community partnership|TWO MEN AND A TRUCK Delaware South|DE|Annual drive and event sponsorship: Movers for Moms shelter drive|Community page|Pick one annual drive per state and repeat it every year.
        Community partnership|Forward Moving LLC|PA|Furniture donation: Community Warehouse Project|Forward Moving home page (partner named)|Pair a partner realtor with a furniture-donation day.
        Community partnership|JB Moving Services|CT|Document destruction: Shred Station Express|Drop-and-shred locations|Offer a shred or donation add-on through one local partner.
        Community partnership|Hands On Moving & Storage|CT|Community foundation: Hands On Foundation Fund|Community Foundation annual report (PDF)|A longer-term option; start with a drive before a fund.
        Community partnership|Moishe's Moving Systems|NY|Monthly charity giving: Wounded Warrior Project and Susan G. Komen|Moishe's home page|Name one cause and give on a fixed schedule.
        Community partnership|College HUNKS Hauling Junk & Moving|NJ|Donation pickup and relief trucks, built into the booking|Move the world: company purpose|Offer donation pickup as an add-on on the quote form.
        Community partnership|Piece of Cake Moving & Storage|NY|Pro sports sponsorship: official partner of the New York Knicks|Renewed multi-year partnership|Use a local team's ticket giveaway with a quote form to capture leads.
        Route page|RT Relocation|CT|Connecticut to New Jersey, one full guide|Moving from Connecticut to New Jersey: complete guide|Publish CT→NJ first; it is the pair competitors already win.
        Route page|Colonial Moving & Storage|CT|Connecticut to Vermont and Rhode Island guides|Colonial Moving & Storage home page (route guides listed)|Add one guide per neighboring state pair once the six first routes are live.
        Route page|White Glove Moving & Storage|NJ|Route and senior guides inside the FAQ hub|Moving FAQs, route and senior guides|Group route guides under one hub page with a short FAQ per route.`) },

    /* -- Gaps and 30-day plan -- */
    gaps: {
      ranked: { title: "Zip to Zip Moving's gaps, ranked", sub: "Filtered by the state above. Each gap names the evidence and the action that closes it.",
        cols: ["Priority", "Gap", "States", "Evidence", "Action", "Owner"],
        rows: T(`
          High|Pages only render with JavaScript|All|ziptozipmoving.com pages still return an empty shell without JavaScript (rechecked 6 Nov). The staged new site, site.ziptozip.app, now serves full HTML for home, service area, 91 guides, Move Report and partnerships, but its canonical still points to the old domain.|Launch site.ziptozip.app on ziptozipmoving.com with 301 redirects from every old URL; prerender the old site until the switch.|Dev + SEO
          High|No origin→destination route guides|All|White Glove, RT Relocation and Colonial win route searches (e.g. CT→NJ). Zip to Zip Moving has none on the live site, and the new site's 91 guides include only generic big-city/small-town tips.|Publish 6 route guides first: NY→NJ, NJ→PA, CT→NJ, NJ→NY, PA→NJ, DE→NJ, each with real move examples and a quote CTA.|SEO + Copywriter
          High|No state or city cost guides for 2026|NJ, NY, PA, CT, DE|Booth (NJ), Moishe's (updated 4 Nov 2026), Piece of Cake, Caddy (NYC), EverSafe (Philadelphia), Kaster (Stamford) rank dated price guides; All Around Moverz publishes a DE rate card. The new site's Move Report (Sept 2026) has a 2026 cost table, but no state or city guides.|Turn the Move Report's cost table into five guides: NJ, NYC, Philadelphia, Stamford, Wilmington, with anonymized real quotes and what each price includes.|SEO + Sales/Ops
          High|Thin state pages; no county, city or borough pages|NY, PA, CT, DE|Ample, Gentle Giant, Armstrong, Forward, Oz, Stewart, Move Crew and TWO MEN AND A TRUCK run town-level pages. The new site adds 565 NJ, 118 PA and 115 CT town pages, but NY and DE still have only an office listing, and none of it is live yet.|Ship the new site's town pages; add NY borough pages (Brooklyn, Manhattan, Queens) and DE pages (Wilmington, Newark, Dover) before launch.|SEO + Copywriter
          High|No price-lock or written-pricing guarantee|NJ, NY, PA, DE|Now 8 competitors promise written pricing: EverSafe (10% cap), FlatRate, Piece of Cake and Oz (guaranteed flat/upfront price), White Glove (guaranteed long-distance inventory price), Armstrong (guaranteed estimates) and All Around Moverz (Service Pledge).|Publish what a Zip to Zip Moving quote includes and when a price can change, with Sales/Ops sign-off.|Sales/Ops + Copywriter
          Medium|No community or partner proof|All|10 of 25 competitors show public proof: Move For Hunger, food banks, Movers for Moms, scholarships, Knicks sponsorship. The new site's partnerships page offers referral payments but names no partners or charity work.|Run one partner pilot (realtor + nonprofit donation day), document it, and add a Community page.|Marketing Lead + Community
          Medium|State credentials and associations not shown|NY, CT, DE|Only NJ and PA licenses appear. Competitors display BBB, ProMover, state association and van-line agency badges.|Add each state's applicable license or registration and association memberships to its page (verify each first).|Ops + SEO
          Medium|No crew bios or signed expert content|All|Moishe's (president) and Oz (GM) sign their guides; Gentle Giant names Philadelphia staff. The new site introduces foreman George on the homepage, but guides carry no bylines.|Add foreman and mover profiles per state and sign cost and route guides with a named expert.|Copywriter + Social
          Medium|No video proof from real moves|All|TWO MEN AND A TRUCK Delaware South uses how-to videos; the site has only an Instagram feed.|Six short crew videos (stairs, floor protection, packing, closing-date gap, large home, office) embedded on service pages.|Social + Videographer
          Medium|Verified review volume trails state leaders|NJ, PA, CT|Zip to Zip Moving has 382 moveBuddha-verified reviews (unchanged) vs White Glove 1,631, Booth 965, EverSafe 962 and RT Relocation 815. NYC leaders show Google counts of 14,788 (Piece of Cake) and 2,724 (FlatRate). Angi rose to 288 and Trustpilot shows 4.9 from 422.|Send a review request after every move, rotating Google and Yelp by state, and show review counts on the site.|Reputation + Sales/Ops
          Medium|No signature brand campaign or partnership|All|Piece of Cake (Knicks, Pinky the Truck), Gentle Giant (rowing crews) and TWO MEN AND A TRUCK (Movers for Moms) each own one memorable story. Zip to Zip Moving's strength is marketplace ratings, which buyers can't recall.|Choose one recurring signature campaign (see Featured campaigns) and run it in every state.|Marketing Lead
          Low|Not in moveBuddha's Delaware top 10|DE|Zip to Zip Moving has a moveBuddha Delaware profile but isn't in its ranked list; Stewart, Bayshore, Move Crew and All Around Moverz are.|Push Delaware customer reviews to the moveBuddha profile.|Reputation
          Low|Footer still says © 2022|All|Last checked on the old site; the new site's footer already shows © 2026, so this closes at launch.|Update the footer to show the current year automatically.|Dev
          Low|Marketplace lead dependence|All|Zip to Zip Moving is strongest on Thumbtack (4.9 · 404, Top Pro 2019 and 2021–2025), Angi (5.0 · 288), HomeAdvisor (5.0 · 434) and Trustpilot (4.9 · 422), while competitors grow through brand, building lists, van lines and partners. A new partner referral program is staged on the new site.|Keep marketplaces, but track cost per booking by channel and grow referral and partner leads toward a set share.|Paid + CRM`) },
      examples: { title: "One real example page for each gap",
        sub: "Ranked like the table above. Open the page to see the gap closed by a competitor, or on Zip to Zip Moving's own site.",
        cols: ["Rank", "Priority", "Gap", "Example page", "Company", "What it shows", "Move for Zip to Zip Moving"],
        rows: T(`
          1|High|Pages only render with JavaScript|Staged new site (site.ziptozip.app)|Zip to Zip Moving · All · our own page|The staged new site is the fix: it serves real content without JavaScript. No competitor page is needed as a reference.|Launch it on ziptozipmoving.com with 301 redirects from every old URL.
          2|High|No origin→destination route guides|Moving from Connecticut to New Jersey: complete guide|RT Relocation · CT|One page per origin and destination pair, matching a specific relocation search.|Publish the NY→NJ, NJ→PA, CT→NJ, NJ→NY, PA→NJ and DE→NJ guides with real move examples.
          3|High|No state or city cost guides for 2026|Cost of Moving in New Jersey in 2026: a Booth pricing guide|Booth Movers · NJ|A dated, state-specific price guide that ranks for cost searches.|Turn the Move Report's cost table into guides for NJ, NYC, Philadelphia, Stamford and Wilmington.
          4|High|Thin state pages; no county, city or borough pages|Philadelphia moving company: neighborhoods, crews and services|Gentle Giant Moving Company · PA|A local page built around neighborhoods and named crews, not a generic state page.|Ship the new site's town pages; add NY borough pages and Delaware pages.
          5|High|No price-lock or written-pricing guarantee|Philadelphia Price Lock Guarantee|EverSafe Moving Co. · PA|A plain statement of what is locked and when a price can change.|Publish what a Zip to Zip Moving quote includes and when it can change, with Sales and Operations sign-off.
          6|Medium|No community or partner proof|Community page: Movers for Moms, Food Bank of Delaware, Toys for Tots|TWO MEN AND A TRUCK Delaware South · DE|A dedicated community page that names each cause and partner.|Run one partner pilot (realtor and nonprofit donation day), document it and add a Community page.
          7|Medium|State credentials and associations not shown|Manhattan movers page: Google 4.7, BBB A+, Movage agent|Oz Moving & Storage · NY|Credentials and ratings shown on the state or borough page itself.|Add each state's license or registration and association memberships to its page, after verifying them.
          8|Medium|No crew bios or signed expert content|How much do movers cost in NYC? (2026 price guide, signed by the president)|Moishe's Moving Systems · NY|A guide signed by a named company leader.|Add foreman and mover profiles per state and sign cost and route guides with a named expert.
          9|Medium|No video proof from real moves|Dover hub: service-area towns, how-to videos and team page|TWO MEN AND A TRUCK Delaware South · DE|How-to videos and a named crew on a local page.|Record six short crew videos (stairs, floor protection, packing, closing-date gap, large home, office).
          10|Medium|Verified review volume trails state leaders|moveBuddha profile: 1,631 verified reviews|White Glove Moving & Storage · NJ|The review volume Zip to Zip Moving is measured against (382 verified).|Send a review request after every move, rotating Google and Yelp by state.
          11|Medium|No signature brand campaign or partnership|Renewed multi-year partnership with the New York Knicks|Piece of Cake Moving & Storage · NY|One recurring story the brand owns in its market.|Pick one recurring signature campaign and run it in every state (see Campaigns worth learning from).
          12|Low|Not in moveBuddha's Delaware top 10|moveBuddha Delaware profile: 211 reviews, 95% positive|Stewart Moving & Storage · DE|A ranked Delaware profile Zip to Zip Moving can compare against.|Push Delaware customer reviews to the moveBuddha profile.
          13|Low|Footer still says © 2022|Staged new site (site.ziptozip.app)|Zip to Zip Moving · All · our own page|The new site's footer already shows © 2026, so this closes at launch.|Make the footer show the current year automatically.
          14|Low|Marketplace lead dependence|Thumbtack profile: Top Pro six times, 4.9 from 404 reviews|Zip to Zip Moving · All · our own page|Zip to Zip Moving's strongest listings are on lead marketplaces.|Track cost per booking by channel and grow referral and partner leads.`) },
      next: { title: "Next 30 days: what to test first", sub: "Four tests, each with owners and the metric that shows it worked.",
        // title | text | owners | track
        cards: T(`
          Route + pricing guides|Two route guides (NY→NJ, CT→NJ) and three cost guides (NJ, NYC, Philadelphia) built from the Move Report's 2026 cost table, with real anonymized moves and quote inclusions.|SEO + Copywriter + Sales/Ops|Non-brand clicks → qualified quotes → booked moves by page
          Launch the server-rendered site|site.ziptozip.app already serves full HTML (checked 6 Nov). Switch ziptozipmoving.com to it with 301 redirects, add NY and DE town pages, and resubmit the sitemap.|Dev + SEO|Indexed pages; non-brand clicks; AI-overview keywords month over month
          Proof from actual moves|Six short crew videos plus foreman and mover bios on NY, PA and DE pages.|Senior Social + Videographer + SEO|Video-assisted inquiries and page quote conversion
          One partner pilot|Use the new partnerships page: sign one realtor + one nonprofit in one state, run a donation day, and publish the named partners and a written result story.|Marketing Lead + Community + Operations|Partner referrals → qualified leads → bookings; cost per booking`) },
    },

    /* -- Campaigns -- */
    campaigns: { title: "Campaigns worth learning from",
      sub: "The most effective creative and partnership plays across the five states, and what Zip to Zip Moving can take from each.",
      // company | state | title | what | why | for us
      cards: T(`
        Piece of Cake Moving & Storage|NY|Knicks partnership + 'Move Like A New Yorker'|Official Moving & Storage Partner of the Knicks since 2022, renewed in 2025: social campaign, ticket sweepstakes and on-court content at Madison Square Garden, plus Pinky the Truck, a mascot with its own Instagram.|Borrows a beloved local team's audience and turns it into sweepstakes leads.|Only sponsor where you can capture leads (a local team's ticket giveaway with a quote form), and give a truck a name and personality on social.
        Bayshore Transportation (Allied)|DE|Move For Hunger pantry pickups|Sales staff ask every customer to donate leftover pantry food; a wrapped Move For Hunger truck delivers it to the Food Bank of Delaware. About half of customers opted in, and 1,000+ lbs were delivered in one year.|Costs almost nothing, fits the move itself, and gives the food bank a reason to tell the story.|Add a one-line pantry-donation offer to Zip to Zip Moving's sales script and partner with one food bank per state.
        Gentle Giant Moving Company|PA|Athlete crews as the brand|The company has employed 400+ rowers, including Olympic medallists, and was named Move For Hunger's Mover of the Year in 2021. Its rowing culture is part of the brand story.|Turns crew strength and character into a memorable reason to trust them.|Tell real foreman and mover stories in short videos; a recognizable crew culture is hard to copy.
        TWO MEN AND A TRUCK Delaware South|DE|Movers for Moms|An annual Mother's Day drive collecting items for women's shelters, alongside sponsorship of the Thunder Over Dover air show (200,000+ attendees).|A recurring calendar moment that local press and partners promote every year.|Pick one annual drive per state (e.g. back-to-school or winter coats) and repeat it every year.
        FlatRate Moving|NY|Own the 'best movers' search|A self-published Best moving companies in NYC 2026 guide comparing itself with seven competitors using ratings and Reddit quotes, plus a $50 Amazon gift-card referral program.|Captures shoppers at the comparison stage, where AI answers often pull from.|Publish an honest Best movers in New Jersey comparison that includes Zip to Zip Moving's ratings and credentials.
        White Glove Moving & Storage|NJ|Free-move giveaway|From Aug 25 to Oct 1, 2026, every estimate request in NJ/NY was entered to win one neighbor's move worth up to $5,000, announced by press release with a drawing around Oct 10.|Turns the quote form itself into the entry form, so the promotion generates qualified leads and press coverage at the same time.|Run a seasonal 'move on us' draw where a quote request is the entry, timed for the slow winter months, and announce the winner with their story.`) },

    /* -- Search snapshot -- */
    search: {
      visits: { title: "Organic visits a month", sub: "Semrush US estimate. Only three domains were covered: the Semrush account ran out of API units." },
      ai: { title: "Keywords showing an AI overview", sub: "Ranking keywords where Google shows an AI overview, a proxy for visibility in AI answers." },
      cols: ["Company", "Organic keywords", "Organic visits a month", "Local-pack keywords", "AI-overview keywords"],
      rows: T(`
        Zip to Zip Moving|1,592|3,687|551|985
        White Glove (NJ)|4,090|2,736|1,278|3,208
        Ample Moving (NJ)|692|3,781|387|296`),
    },

    /* -- Method and limits -- */
    method: {
      title: "How the competitor map is built, and its limits",
      sections: [
        ["Competitors and tactics", "Five priority movers per state (four in Delaware at the first review), chosen from moveBuddha and FreightWaves state lists and from who ranks for local moving searches. Each competitor is tagged with the content and trust tactics its pages show: cost guides, county or city pages, route guides, planning tools, price guarantees, specialty services, community or partner proof, named experts and credentials. Zip to Zip Moving's site is checked against the same tactics for each state and marked Covered, Partial, Thin or Missing."],
        ["Gap score", "For each tactic, the share of a state's competitors using it is weighted by how far Zip to Zip Moving is from having it: Covered counts nothing, Missing counts fully, Partial and Thin sit between. The weighted total is divided by the total competitor share, so a score of 100 means Zip to Zip Moving lacks everything that state's competitors do."],
      ],
      limits: [
        "Exact Google positions and lead lift are not measured. \"Why it may help\" describes a plausible mechanism, not a result.",
        "Semrush figures cover three domains because the account ran out of API units.",
        "National brands are tagged on their local pages; their domain-wide traffic is not comparable.",
        "State license requirements for NY, CT and DE are flagged to verify, not stated as missing.",
      ],
      source: "Source: copied on 6 November 2026 from the Zip to Zip Moving competitor gap map. It is a snapshot and does not refresh here; the original refreshes monthly.",
    },
  };
})();
