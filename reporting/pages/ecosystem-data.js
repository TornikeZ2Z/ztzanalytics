/* SOPHIE'S "Zip to Zip marketing partnership and strategy ecosystem" (ZTZ-68), as data.
 *
 * Sophie Davitashvili (marketing head) built it as a claude.ai page in her own Claude org
 * (claude.ai/artifact/6nvN957ctAS4UW1UKbGBAc, last updated about 5 Nov 2026). It could not be exported, so
 * its text was copied from the page screen by screen on 12 Nov 2026 (his pick). It is a SNAPSHOT: when
 * Sophie changes her page, this file changes with it.
 *
 * Pages 1-5 are the Marketing page "Partnership & Strategy" (pages/partnership-strategy.js); page 6 is the
 * Competitor Map's "Content gaps" tab (pages/competitor-map.js). His picks, 11 Nov.
 *
 * Tables are written as pipe-separated rows (one row a line), so a correction is a one-line edit.
 * Inline marks: **bold**, {s:NJ} a state/place match (blue), {z:3BR+} a home-size match (amber).
 */
(function () {
  const T = s => s.trim().split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(c => c.trim()));
  window.ZTZ_ECO = {
    source: { title: "Zip to Zip marketing partnership and strategy ecosystem", owner: "Sophie Davitashvili",
              copied: "12 Nov 2026", updated: "about 5 Nov 2026" },
    header: {
      eyebrow: "Zip to Zip Moving · 2027 KPI strategy",
      intro: "One place for 2027 partnerships, audiences, channels and competitors. Universities are the first structured partnership channel, aimed at graduate, faculty, international and 2BR+ households rather than dorm moves. Open a page below; each has its own plan and sources.",
      kpis: [["15", "Universities shortlisted"], ["6", "A+ priority schools"], ["25", "Competitors tracked"],
             ["12", "Partner types mapped"], ["3", "Tier 1 partner types"], ["8", "Channel gaps to explore"]],
      footer: "Sources: University Marketing Target List, September 4, 2026; partnering and trade-signal reference images; Zip to Zip Moving lead and partner channel plan. Persona ranges, partner tiers and channel statuses are proposals to validate.",
    },

    /* ---- 1 · University partnerships ---------------------------------------------------------- */
    universities: {
      lead: "Top five schools per state, chosen from the September 2026 target list by priority grade, then move value. Priority grades are Zip to Zip Moving estimates, not university rankings.",
      audience: {
        title: "Audience size of the shortlisted schools",
        sub: "Thousands of students; latest public figure on the target list. Montclair State has no figure listed; UConn Stamford counts residential students only.",
        groups: [
          { label: "Pennsylvania · Philadelphia area", color: "#2563EB", rows: T(`
            University of Pennsylvania|29.4
            Drexel University|21.0
            Temple University|29.5
            Villanova University|9.8
            Saint Joseph's University|9.0`) },
          { label: "New Jersey", color: "#EA580C", rows: T(`
            Princeton University|9.1
            Rutgers University-New Brunswick|46.9
            Stevens Institute of Technology|8.4
            Rowan University|22.1
            Montclair State University|`) },
          { label: "Connecticut", color: "#0D9488", rows: T(`
            Yale University|15.7
            Fairfield University|7.2
            Sacred Heart University|10.0
            UConn Stamford|0.8
            Quinnipiac University|9.7`) },
        ],
        foot: "Next in line: Thomas Jefferson (PA), Seton Hall and Monmouth (NJ), University of New Haven (CT). New York, Delaware and the newer states are not on this target list yet.",
      },
      shortlist: { title: "The shortlist, by state",
        cols: ["State", "#", "University", "Priority", "Audience", "Move value", "Best target", "Best route in"],
        rows: T(`
          PA|1|University of Pennsylvania|A+|29.4k|Very high|Graduate/professional, faculty, international, parents|Daily Pennsylvanian 2026-27 media kit; Penn off-campus housing marketplace; apartment managers near University City
          PA|2|Drexel University|A+|~21k|Very high|41% graduate share; co-op / professional audience; University City|The Triangle; Drexel off-campus housing site; University City apartments
          PA|3|Temple University|A+|29.5k|High|Graduate/professional, transfers, international, large off-campus market|The Temple News; Temple off-campus housing ecosystem; property managers
          PA|4|Villanova University|A|9.8k|Very high|Graduate/law, affluent parent base, Main Line households|Off-campus housing site; student media; parent/family and local apartment partnerships
          PA|5|Saint Joseph's University|A|9k+|High|Graduate/health professions, Main Line + University City|Off-campus housing site; student media; graduate/health programs; local housing partners
          NJ|1|Princeton University|A+|~9.1k|Exceptional|Graduate students, faculty, international scholars, affluent households|Daily Princetonian digital/newsletter; graduate/faculty relocation; Princeton-area property managers
          NJ|2|Rutgers University-New Brunswick|A+|46.9k|Very high|Huge off-campus market, graduate programs, faculty/staff|Daily Targum / Rutgers campus media; Rutgers sponsorships; College Pads off-campus housing
          NJ|3|Stevens Institute of Technology|A|8.4k|Very high|4.2k graduate students; Hoboken/NYC apartment market; high-income career profile|The Stute digital/print ads; Hoboken apartment partnerships
          NJ|4|Rowan University|A|22.1k|High|Large student body, graduate/professional, Glassboro rentals|The Whit / student media; off-campus rentals; property managers
          NJ|5|Montclair State University|A-|Large (no figure listed)|High|Large North Jersey audience; graduate and commuter mix|The Montclarion web/social ads; apartment partnerships
          CT|1|Yale University|A+|15.7k|Exceptional|Large graduate/professional population, 5.8k faculty, international community|Yale Daily News print/web/newsletter; graduate/faculty relocation; New Haven property managers
          CT|2|Fairfield University|A|7.2k|Very high|903 off-campus boarders; graduate commuters; affluent family profile|Fairfield student media; parent/family audience; Fairfield apartment/property managers
          CT|3|Sacred Heart University|A|10k+|Very high|Fast-growing university; Fairfield/Bridgeport; affluent parent audience|The Spectrum; local apartment/property managers; sponsorship tests
          CT|4|UConn Stamford|A|840+ residential|High|Downtown Stamford apartments, incoming/out-of-area students, faculty/staff|UConn off-campus housing tool; Daily Campus; Stamford apartment buildings
          CT|5|Quinnipiac University|A-|9.7k|High|3.1k graduate/law/medical; out-of-state-heavy undergraduate base|Student media; graduate/medical communities; Hamden/New Haven apartment partners`) },
      offers: { title: "What Zip to Zip Moving offers", foot: "* Needs Operations approval before it is promised.", items: [
        "A free move-planning guide and checklist for graduate, faculty and international households, co-branded for each school.",
        "A licensed, USDOT-registered interstate mover (USDOT #2969363) for the housing office's resource list.",
        "A perk for graduate, faculty and staff households: a value-add such as a packing consult or storage credit, not a deep student discount that attracts small jobs.*",
        "A unique landing page, phone number and promo code per school, so every lead is traceable.",
        "Move-in and move-out support for campus housing partners during peak weeks.*"] },
      expects: { title: "What it expects in return", items: [
        "A non-exclusive listing as a recommended resource on housing or relocation pages.",
        "A slot in graduate and international orientation materials and newsletters.",
        "Warm introductions to the housing office, graduate and international services, and faculty relocation contacts.",
        "Access to housing fairs and move-out weeks, with tracked QR codes or promo codes.",
        "Quarterly feedback on referrals, and written approval before any \"preferred\" or \"official\" wording is used."] },
      models: { title: "Partnership models", sub: "Start at the lightest model and move a school up only when its leads earn it.",
        cols: ["Model", "Who", "We give", "We get", "Move up when"],
        rows: T(`
          Visibility partner|Student media, newsletters, orientation channels|Paid or in-kind placement with a unique landing page, phone number and promo code per outlet|Direct access to students, parents, faculty and alumni at move season|An outlet's leads skew 2BR+, interstate or faculty/graduate, not dorm or studio jobs
          Resource partner|Off-campus housing offices, graduate and international student services, faculty relocation contacts|Free co-branded move-planning guide and checklist; licensed, USDOT-registered mover for their resource list|Non-exclusive listing on housing/relocation pages; orientation and newsletter slots; warm intros|The school sends repeat qualified bookings across a full move season
          Campus property-manager referral|Apartment communities and property managers around each campus|Move-in/move-out partner program: priority quotes, resident welcome-kit insert, referral reward (needs Operations approval)|Repeat move-in/move-out volume and referrals into larger 2BR+ units|A building sends consistent monthly referrals; add it to the standing partner list
          Preferred partner (contract)|Schools willing to sign a written agreement|Community perk for graduate, faculty and staff households; agreed service levels; quarterly reporting|Written right to use "preferred" wording; event and housing-fair access; formal housing-office referral|Only with a signed agreement and Operations sign-off on pricing — never claimed before that`) },
      comms: { title: "Communication strategy", sub: "Three message pillars, one positioning rule, and a 90-day sequence per school.",
        pillars: ["Value for graduate students, faculty and families", "Licensed and verified: USDOT #2969363", "Local and interstate moving, packing and storage"],
        use: "\"Moving for Graduate Students, Faculty & Families near [University]\" and \"2BR+ Apartment & Household Moving near [University]\".",
        avoid: "\"Official University Mover\" or \"Preferred University Mover\" without a written agreement, and broad dorm-move messaging.",
        cols: ["Step", "Phase", "Timing", "Audience", "Channel", "Message", "Owner"],
        rows: T(`
          1|Map the school|Weeks 1-2|Housing office, graduate and international services, campus-area property managers|Desk research, LinkedIn, school directories|Internal: one named contact per school, current ad rates, off-campus housing site|Marketing
          2|Warm intro|Weeks 2-4|Off-campus housing office; graduate student services|Personal email + one-page partner brief|A licensed interstate mover for your graduate, faculty and international households, with a free move-planning guide for your community|B2B manager
          3|Resource offer|Weeks 4-6|Same contacts + faculty/staff relocation|Co-branded guide, resource-page listing request, call or campus visit|Moving for Graduate Students, Faculty & Families near [University]|Marketing + Sales & Operations
          4|Paid campus test|Weeks 4-12|Students, parents, faculty, alumni|Student-media newsletter and digital, QR/promo code|2BR+ apartment and household moving · Local + interstate · Packing · Storage|Marketing
          5|Property-manager referral|Weeks 6-10|Apartment communities near each campus|Visit + partner kit + referral reward|A dependable mover for move-in and move-out weeks|B2B manager
          6|Review and scale|Day 90|Internal, then each partner|Quarterly partner report|Pause sources producing mostly dorm, studio or 1BR jobs; scale 2BR+, family, interstate, packing, storage and faculty moves|Marketing Lead`) },
      tests: { title: "Low-friction paid tests", sub: "Published campus-media rates on the target list; confirm before buying.",
        cols: ["School", "Outlet", "Offer", "Low", "High", "Unit", "Note"],
        rows: T(`
          Stevens|The Stute|Web inventory|$50|$75|per week|Cheap test: 2 weeks digital + move-specific landing page
          Stevens|The Stute|1/4-page print|$100|$100|per placement|Pair with QR tracking
          Montclair State|The Montclarion|Web banner|$150|$150|per week|Use a trackable promo code
          Montclair State|The Montclarion|Instagram post|$65|$65|per post|Test banner + Instagram together
          Princeton|Daily Princetonian|Direct-to-student campaign (2 weeks)|$1,999|$1,999|per campaign|Ask for parent/graduate audience options
          Princeton|Daily Princetonian|All-inclusive digital blast (1 week)|$2,339|$2,339|per week|Newsletter + web/social first
          Monmouth|The Outlook|Quarter-page print options|$94|$141|per placement|Confirm 2026-27 dates; print only with digital/QR tracking`) },
      kpis: { title: "KPIs to report by university", sub: "Scale sources that produce 2BR+, family, interstate, packing, storage and faculty moves; pause the rest.",
        cols: ["Group", "KPI", "How to read it"],
        rows: T(`
          Acquisition|Spend, impressions, clicks|By university and by media outlet
          Acquisition|Cost per lead (CPL) by source|Each school and outlet has its own landing page, phone number and UTM tags
          Acquisition|Call and form attribution|Never send campus traffic to the generic homepage
          Lead quality|Bedrooms, cubic feet, move type|Scale 2BR+ and graduate/faculty households; pause dorm, studio and 1BR sources
          Lead quality|Local vs interstate|Interstate and long-distance carry the higher ticket
          Lead quality|Packing and storage interest|Signals full-service, higher-value moves
          Sales|Quote rate and booking rate|By university, from lead to booked move
          Sales|Average booked ticket|Compare against dorm-heavy sources
          Sales|Cancellation rate|Flags seasonal or discount-driven leads
          Unit economics|CAC per booked job|Spend divided by booked moves, by school
          Unit economics|Gross margin by source|Decides which schools earn a second season
          Unit economics|ROAS / contribution margin|Final scale-or-stop test per source`) },
    },

    /* ---- 2 · Partnership map ----------------------------------------------------------------- */
    partners: {
      lead: "The ecosystem around Zip to Zip Moving, ringed by priority. Hover a circle for what the partner brings and what we exchange.",
      table: { title: "Partner types by priority", cols: ["#", "Partner", "Tier", "What they bring", "What we exchange"],
        rows: T(`
          1|Realtors & brokerages|1|Refer buyer and seller clients at contract and closing|We give co-branded relocation guides and partner service; they give referrals
          2|Property managers & apartment communities|1|Repeat move-in and move-out volume, 2BR+ units|We give a partner kit and referral reward; they list us in resident welcome materials
          3|Universities (graduate, faculty, international)|1|Graduate, faculty and international households with larger moves|We give a free move guide and a resource listing; they give orientation and newsletter access
          4|New-construction builders|2|Buyers closing on new homes|Closing-gift move offer; builder lists us as a recommended mover
          5|Mortgage lenders, title & closing attorneys|2|Contact buyers at the moment a move becomes certain|Co-branded checklist; referral in closing packet
          6|Corporate relocation & HR teams|2|Employees relocating across the Northeast|Preferred-vendor program; one point of contact for HR
          7|Home-service trades (roofing, HVAC, plumbing)|2|Homeowners preparing a house for sale|Two-way referrals using shared lead signals (see signal table)
          8|Senior living & downsizing advisors|2|Seniors and downsizers|Specialist downsizing service; advisors refer
          9|Student & community media|3|Reach to students, parents and faculty|Paid or in-kind placement, tracked per outlet
          10|Storage, cleaning & junk removal|3|Move-adjacent services customers buy around a move|Bundle offers and cross-referrals
          11|Home inspectors & stagers|3|Touch sellers early in the listing process|Referral exchange and co-hosted content
          12|Community groups & local chambers|3|Local trust and word of mouth|Sponsorship, helpful replies, local events`) },
      // the ring diagram's short labels, in the table's order
      short: ["Realtors & brokerages", "Property managers", "Universities", "Home builders", "Lenders & title", "Corporate relocation",
              "Home-service trades", "Downsizing advisors", "Student media", "Storage & cleaning", "Inspectors & stagers", "Community groups"],
      signals: { title: "Lead signals home-service partners filter on",
        sub: "The same signals can drive two-way referrals: a listing in the last 14 days is a mover lead and a roofing or HVAC lead.",
        cols: ["Trade", "The signal you filter on"],
        rows: T(`
          Roofing|Roof age past warranty, older build year, recent storm-area listings
          HVAC|HVAC system age (10+ years), build year, seasonal timing
          Plumbing / water heater|Water heater install or replacement date, home age
          Movers|Newly listed (last 14 days), pending, coming soon
          General / multi-service|Home value floor, square footage, owner tenure`) },
    },

    /* ---- 3 · Personas and screens ------------------------------------------------------------ */
    personas: {
      lead: "Four customer types, ordered by how they come to book. Each card shows the screens that narrow the audience, in order. Cards show the order of screens, not audience size.",
      cards: [
        { name: "Homeowner", steps: T(`
          Geography|Origin or destination in NJ, NY, PA, CT or DE|Listing and address data
          Stage|Newly listed (last 14 days), pending or coming soon|Zillow now; MyMovingStoryPro trial
          Price|List price $300k+|Listing data
          Size|2+ bedrooms, with furniture|Listing photos and details
          Tenure|Home value floor and owner tenure|Public records`) },
        { name: "Renter", steps: T(`
          Metro|Philadelphia, Hoboken/Jersey City, Newark, Stamford, New Haven, NYC|Ad geo-targeting
          Timing|Lease ending within 60-90 days|Lease-turnover season; property managers
          Size|2BR+ buildings; exclude dorm, studio, 1BR|Landing-page and quote form fields
          Intent|Searches for movers or storage; asks in community groups|Search and group monitoring`) },
        { name: "Realtor / brokerage", steps: T(`
          Market|Active in NJ, CT, PA, DE or NY|Brokerage directories
          Volume|5-30 closed deals per year|Agent profiles
          Fit|Buyer-side agents and brokerages with relocation clients|Listings and reviews
          Engagement|Engaged with our market content or LinkedIn posts|LinkedIn and gated download`) },
        { name: "University", steps: T(`
          Campus|Top 5 per state from the shortlist|University target list
          Segment|Graduate, faculty and staff, international, parents of upperclassmen|School factbooks
          Housing|2-4BR off-campus; not dorm-only|Off-campus housing sites
          Route|Published ad rates or a housing marketplace to place in|Student media; housing offices`) },
      ],
      matrix: { title: "Persona matrix",
        sub: "Age, income and equity ranges are starting hypotheses. Replace them with the CRM and Meta breakdown as 2027 data comes in. Gender is not used as a screen.",
        cols: ["", "Homeowner", "Renter", "Realtor / brokerage", "University"],
        rows: T(`
          Booking intent|High: home listed, pending or closing|High and short: lease ends soon|Indirect: refers clients at contract and closing|Seasonal: move season, orientation, lease turnover
          Who they are|Selling or relocating owner household|Young professionals and graduate students in dense metros|Agents and brokerages with relocation clients|Graduate/professional students, faculty and staff, international scholars, parents
          Age (starting range)|35-64 (core 40-59)|22-38|28-60|Graduate 23-35; faculty and staff 30-65
          Gender|No screen: target the household and read the split from Meta and CRM|No screen: read the split from CRM|No screen|No screen
          Desired states|NJ, NY, PA, CT, DE first; VA, MD, MA second|Philadelphia, Hoboken/Jersey City, Newark, Stamford, New Haven, NYC|NJ, CT, PA, DE, NY|PA (Philadelphia area), NJ, CT
          Equity size|$150k+ equity; proxy: list price $300k+ and 5+ years of ownership|Not applicable (deposit and cash-flow sensitive)|Not applicable|Faculty and staff homeowners only
          Income size|Household $100k+|Household $60k-$120k|Commission based; 5-30 closed deals per year|Graduate stipends modest; faculty, physicians and researchers higher
          Home size|2+ bedrooms, furnished|2BR+ (not dorm, studio or 1BR)|Buyer and seller agents with active listings|2-4BR shared or family off-campus housing
          Message|Licensed interstate mover: Request the Quote|Lease-end moving plus storage for the gap|Explore a co-branded relocation guide for your clients|Moving for Graduate Students, Faculty & Families near [University]
          Main channels|Postcards to homes for sale, local search, Meta, SEO location pages|Local search, Meta, property managers, community groups|LinkedIn, partner visits, newsletters, co-branded guides|Student-media newsletters, off-campus housing sites, property managers
          Success measure|Quote rate, booking rate, average ticket|Cost per lead, booking rate, storage attach|New partners, referred moves|Leads and bookings by school; share of 2BR+ jobs`) },
    },

    /* ---- 4 · Channels to explore -------------------------------------------------------------- */
    channels: {
      lead: "Where coverage is thin, with a first step for each. Gaps come first. Statuses reflect the channel plan so far; correct any that have changed.",
      cols: ["Status", "Channel", "Audience", "Why it matters", "First step"],
      rows: T(`
        Gap|Student and campus media|Students, parents, faculty, alumni|Direct access at move season; several outlets publish rates|Two-week digital test at Stevens or Montclair with a tracked landing page
        Gap|Off-campus housing marketplaces|Students and faculty choosing housing|Reaches people exactly when they pick a place to live|Ask Penn, Drexel and Rutgers about vendor placements for larger units
        Gap|Campus-area property managers|Renters in 2BR+ buildings|Repeatable referral channel with recurring move-in and move-out volume|Partner kit and referral reward for the first 10 buildings near Tier 1 campuses
        Gap|Graduate and international orientation|Graduate and international households|Highest-value university audience with full-service needs|Request a slot in orientation resources and newsletters where permitted
        Gap|Mortgage, title and closing attorneys|Buyers with a move date|Touches clients at the moment a move is certain|Co-branded closing checklist offered to two or three local firms
        Gap|Corporate relocation and HR|Relocating employees|One contact can send repeat relocations|Start with university and hospital HR near the Tier 1 campuses
        Gap|Lead marketplaces (Porch, Service Direct)|Homeowners ready to book|Adds a paid lead source beside owned channels|Apply, then cap spend and compare cost per booked job
        Gap|Google Local Services Ads|High-intent local searchers|Pay-per-lead placement with a verified badge|Check eligibility in NJ, PA and CT; run one metro first
        Building|MyMovingStoryPro data trial|Homes for sale at $300k+, 2+ bedrooms|Widens postcard targeting beyond Zillow|One-month purchase, then compare booked jobs against Zillow-targeted postcards
        Building|Referral partners (Realtor Circle)|Realtors, brokerages, agents|Largest B2B direction in the channel plan|New Jersey visit to meet realtors, brokerage agents and moving managers
        Building|Community groups (Facebook, WhatsApp, Reddit, LinkedIn)|Renters and homeowners asking for movers|Helpful replies build trust where people ask|Alerts and AI-suggested replies posted by the community manager
        Running|Postcards to homes for sale|Homeowners with active listings|Reaches sellers at the start of the moving decision|Keep Zillow targeting; track booked jobs per mailing
        Running|Local search and SEO location pages|Local movers and renters|Owns the quote-intent search|Add one landing page per Tier 1 university
        Running|Meta ads and organic social|Homeowners, renters, families|Scales creative tests across personas|Split creative by persona and track the gender and age breakdown`),
    },
  };
})();
