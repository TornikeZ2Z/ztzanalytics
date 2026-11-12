/* Sophie's ecosystem page 5, "Segment strategies" (ZTZ-68): five layers. Copied from her page on 12 Nov 2026;
 * see pages/ecosystem-data.js for the format. */
(function () {
  const T = s => s.trim().split("\n").map(l => l.trim()).filter(Boolean).map(l => l.split("|").map(c => c.trim()));
  window.ZTZ_ECO = window.ZTZ_ECO || {};
  window.ZTZ_ECO.segments = {
    layers: [["three", "Our three segments"], ["audience", "Audience map 2026"], ["journey", "Decision journey and triggers"],
             ["trust", "Market and trust"], ["cases", "Cases and campaigns"]],

    /* -- Our three segments -- */
    three: {
      lead: "Three more segments, each with who they are, who reaches them first, and how we win them. Plays and partner rewards marked * need Operations approval.",
      cards: [
        { name: "Not-yet-searching movers", fields: T(`
          Who|Owners and renters with a move signal who have not searched for a mover: new buyers, loans or leases above X, storage inquirers
          Core idea|Reach them early through the companies that see the signal first, then stay visible until they decide
          First move|Co-branded closing and welcome kits with a lender, insurer or agent, plus signal-based postcards
          Watch|Signal-to-quote rate, days from signal to booking, leads per partner`) },
        { name: "B2B affiliate partners", fields: T(`
          Who|Realtors, brokerages, lenders, insurers, property managers, storage operators, inspectors
          Core idea|A tiered referral program that is easy to join, tracked per partner, rewarded on booked moves and supported with co-branded content
          First move|Launch three tiers and sign the first partners during the planned New Jersey visit
          Watch|Active partners, referred bookings, partner-sourced revenue`) },
        { name: "Commercial moves", fields: T(`
          Who|Offices, practices, studios, venues, sports teams and employers relocating a business or staff
          Core idea|Win on trigger events (new leases, expansions, rosters, productions) through the brokers and coordinators who see them first
          First move|Build a trigger list and send commercial brokers and HR contacts a one-page commercial brief
          Watch|Qualified commercial quotes, win rate, average commercial ticket`) },
      ],
      a: {
        title: "A · Not-yet-searching movers",
        text: "These people will probably move but have not looked for a mover. Something else already shows it: a purchase, a large loan or lease, a storage rental. The companies that see that signal first are our route to them. X is the monthly lease or payment that fits a 2BR+ home in that metro, set per metro at the local 2BR median.",
        // signal | seen by | lead time | route
        stages: [
          { name: "Move confirmed", signals: T(`
            Home purchase under contract or closing date set|Agents, lenders, title and closing attorneys|Weeks|Closing checklist and card in the closing packet
            Home newly listed, pending or coming soon|Listing data, listing agents|Now|Postcards: Zillow now, MyMovingStoryPro trial
            New lease signed|Property managers, leasing offices|Weeks|Welcome-kit card and leasing-office referral`) },
          { name: "Move likely", signals: T(`
            Mortgage pre-approval or loan above X|Lenders, banks, mortgage brokers|Months|Partner-sent email or insert in the approval and closing emails
            Monthly lease or payment above X (2BR+ level)|Property managers, landlords|Months|Renewal-notice insert and welcome kit
            Contacted or rented with a storage service|Self-storage operators|Weeks to months|Bundled move and storage quote on the confirmation email
            New homeowner or renter insurance policy or quote|Insurance agents and carriers|Weeks|Policy-welcome email and agent referral`) },
          { name: "Move possible", signals: T(`
            Home inspection ordered or staging booked|Inspectors, stagers|Weeks|Report email footer and referral exchange
            Utility or internet transfer request|Utility and internet providers|Days to weeks|Listing in their moving-checklist or move-services page
            Large furniture or appliance purchase|Furniture and appliance retailers|Weeks|Delivery-day card and post-purchase email
            Life event: new job, marriage, new baby|Employers and HR, family-service providers|Months|Relocation-package listing and partner content`) },
        ],
        companies: { title: "Companies whose customers show these signals",
          sub: "Tier 1 first. Partners keep their customer data; the route column is how our offer reaches their customers.",
          use: "The partner sends our offer to its own customers in closing packets, welcome emails, statement inserts and delivery cards, or opt-in leads the customer chooses to share.",
          avoid: "Asking banks, lenders or insurers for customer lists, or contacting people from financial or insurance records. Financial privacy rules and customer trust make that route unsafe.",
          cols: ["Tier", "Company type", "Customers they hold", "Signal", "How our offer reaches them", "We give"],
          rows: T(`
            1|Mortgage lenders and brokers|Buyers with pre-approvals and closings|Loan size, closing date|The lender adds our moving checklist to its approval or closing email; we never receive the list|Co-branded checklist; partner pricing for their clients
            1|Real estate agencies and brokerages|Buyers and sellers under contract|Contract signed, listing live|The agent hands out our guide at contract and closing|Client moving guide; referral reward*
            1|Title companies and closing attorneys|Buyers at the closing table|Closing date|Card and quick-quote link in the closing packet|Branded closing card
            1|Self-storage operators|Unit renters, many mid-move|Unit rental or storage inquiry|Referral at the counter and in the confirmation email; bundled move and storage quote|Bundle offer; cross-referrals
            1|Property managers and landlords|Renters moving up or out|Lease signed or renewed above X|Welcome kit, renewal-notice insert, leasing-office card|Partner kit; preferred-vendor listing
            2|Banks and credit unions|New mortgage and home-equity customers|Loan above X; new home-equity line|Welcome-to-your-new-home email or statement insert sent by the bank|Co-branded offer for their customers
            2|Insurance agents and carriers|New homeowner and renter policyholders|New policy or quote at a new address|Policy-welcome email and agent referral|Co-branded checklist; agent referral reward*
            2|Home builders|New-construction buyers|Closing date on a new build|Closing gift or move credit in the builder welcome package|Closing-gift offer
            2|Employers and HR relocation teams|Employees with a new role or relocation|New hire or relocation approval|Preferred-vendor listing in relocation packages|One contact and priority scheduling
            3|Home inspectors and stagers|Buyers and sellers in a transaction|Inspection ordered, staging booked|Report-email footer and stager referral|Referral exchange
            3|Utility, internet and TV providers|Customers requesting a service transfer|Transfer-of-service request|Listing on their moving-checklist page|Content swap and directory listing
            3|Furniture and appliance retailers|Customers furnishing a new home|Large furnishing purchase|Delivery-day card and post-purchase email|Co-branded settling-in offer`) },
      },
      b: {
        title: "B · B2B affiliate partners",
        text: "Partners who recommend Zip to Zip Moving to their own customers. A tiered program lets anyone start with a tracked link and grow into a named, written partnership.",
        cols: ["Tier", "Who", "How they refer", "We give", "We expect", "Move up when"],
        rows: T(`
          Referrer|Agents, inspectors, storage staff, past customers|Share a personal tracked link or code|A tracked link and a reward on each booked move*|Honest referrals; no exclusivity|Repeat booked referrals
          Partner|Active realtors, lenders, property managers, storage operators|Co-branded guide, client introduction at contract or closing, link on their site|Co-branded guide and checklist, priority quotes, a monthly referral report|Display our guide and introduce us at the key moment|Consistent monthly referrals
          Preferred partner|Top referrers and brokerages|Named in client packets and agent onboarding|A dedicated contact, quarterly business review, joint campaigns|Recommended-mover wording agreed in writing|Written agreement and Operations sign-off`),
        foot: "Reward amounts are not set here. Operations decides them before anything is promised to a partner.",
      },
      c: {
        title: "C · Commercial moves",
        text: "Offices, practices, studios, venues and teams move on trigger events. We find the trigger, then approach the person who sees it first: a commercial broker, an HR or relocation lead, a production manager or a team's operations staff.",
        cols: ["Tier", "Target", "Who", "Trigger", "Where to find them", "Who to approach"],
        rows: T(`
          1|Office relocations and expansions|Small businesses and corporate offices in NJ, NY, PA, CT and DE|New lease, lease expiry, headcount growth|Commercial brokerage listings and announcements, local business journals, new business registrations|Commercial real estate brokers; office managers
          1|Employers relocating staff|Headquarters moves and new regional offices|Relocation announcement, new hires from out of state|News, job postings that offer relocation, HR networks|HR and relocation leads
          1|Medical, dental and law practices|Practices moving, merging or opening a second site|Practice sale, merger, new location|Professional associations, brokers who specialise in practices|Practice managers
          2|Entertainment: studios, production companies, venues, restaurants|Production offices, sets, stages, venue and restaurant fit-outs|New production, season start, lease change|Film-office listings, production calendars, local trade press|Production managers, venue and restaurant operators
          2|Sports: teams, leagues and athletes|Players and staff relocating after trades, signings or drafts|Roster moves and new seasons|Team announcements and transaction news|Team operations, relocation coordinators and agents; never individuals directly
          2|Co-working and flex-space operators|Operators opening, closing or reconfiguring floors|New location, member moves|Operator announcements, broker listings|Community and operations managers
          2|Retail and hospitality openings|New stores, restaurants and hotels|Opening or closing dates|Permit and property announcements|Operations and facilities managers
          3|Startups and scale-ups|Fast-growing companies changing offices|Funding round, hiring growth|Funding news, LinkedIn hiring posts|Founders and office managers
          3|Schools, labs and nonprofits|Institutions with facility moves|Capital projects, new buildings|Public announcements and procurement notices|Facilities and procurement teams`),
        foot: "For athletes and sports staff, approach the team, agent or relocation coordinator, never the individual directly.",
      },
      win: { title: "How we win each segment", sub: "Five plays per segment, with channel and timing.",
        cols: ["Segment", "Step", "Play", "Detail", "Channel", "Timing"],
        rows: T(`
          Not-yet-searching movers|1|Set X per metro|X is the monthly lease or payment that fits a 2BR+ home in that metro; set it at the local 2BR median and test it on the quote form|Internal|Start
          Not-yet-searching movers|2|Signal-based postcards and email|Homes listed or pending, closings and new leases; keep Zillow, run the MyMovingStoryPro trial|Direct mail, email|Ongoing
          Not-yet-searching movers|3|Partner inserts|Closing packets, welcome kits, policy-welcome and approval emails sent by the partner to its own customers|Partner channels|After first partners sign
          Not-yet-searching movers|4|Opt-in countdown series|A moving-timeline email and SMS series for people who leave an email before they are ready for a quote|Email, SMS|Ongoing
          Not-yet-searching movers|5|Measure by signal and partner|A UTM, code or phone number per partner and signal, so each source shows its own booking rate|Tracking|From day one
          B2B affiliate partners|1|Build the program|Three tiers, reward rules (Operations approval), tracking codes and a one-page agreement|Internal|Start
          B2B affiliate partners|2|Prioritise the partner list|Tier 1 first: realtors, property managers, storage operators, lenders, title and closing attorneys|Research|Start
          B2B affiliate partners|3|Field visits|New Jersey visit to meet realtors, brokerage agents and moving managers; repeat in each state|In person|Planned visit
          B2B affiliate partners|4|Co-branded content|Client moving guides and the Northeast Relocation Index as the reason to start a conversation|LinkedIn, email, PDF|Ongoing
          B2B affiliate partners|5|Activate and review|Monthly referral report to each partner and a quarterly review for the top partners|Email, call|Monthly and quarterly
          Commercial moves|1|Define the commercial offer|Office, practice, studio and venue moves: site survey, project manager, after-hours crews, insurance and storage|Internal|Start
          Commercial moves|2|Build the trigger list|New leases, lease expiries, expansions, new business registrations, hiring surges, relocation announcements|Research|Monthly refresh
          Commercial moves|3|Approach the gatekeepers|Commercial brokers, property managers, HR and relocation leads, production managers, team operations and agents|LinkedIn, email, calls|After the list is built
          Commercial moves|4|Proof and a one-page brief|A commercial brief and case studies; local business associations and chambers for introductions|PDF, events|Ongoing
          Commercial moves|5|Free walk-through and follow-up|Offer a walk-through survey, send a written quote, follow up until the lease or roster date|Sales|Per account`) },
      kpis: { title: "KPIs for the three segments", sub: "Set targets from 2026 baselines once the sources are tracked.",
        cols: ["Segment", "KPI", "How to read it"],
        rows: T(`
          Not-yet-searching movers|Signal-to-quote rate by signal type|Shows which signals are worth paying for
          Not-yet-searching movers|Days from signal to booking|Sets how early each message should arrive
          Not-yet-searching movers|Leads and bookings per partner insert|Decides which partners get more material
          B2B affiliate partners|Active partners by tier|Active means at least one referral in the period
          B2B affiliate partners|Referred bookings and revenue per partner|Feeds the monthly partner report
          B2B affiliate partners|Time from signup to first referral|Flags partners who need onboarding help
          Commercial moves|Qualified commercial quotes|By trigger type and by gatekeeper
          Commercial moves|Win rate and average commercial ticket|Compare against residential jobs
          Commercial moves|Cost to win an account|Decides how much outreach each target type earns`) },
    },

    /* -- Audience map 2026 -- */
    audience: {
      title: "Audience map 2026: eleven segments, matched to Zip to Zip Moving",
      sub: "From the U.S. Mover Target Audience Map 2026. Pool sizes and fit are national and sourced. The two match columns and colors are our assessment of how each segment lines up with what Zip to Zip Moving does.",
      kpis: [["5", "Segments with a 2+ bedroom fit"], ["5", "Segments naming one of our states"], ["4", "Matching both"]],
      legend: "{z:2+ bedroom} size match: a home of two bedrooms or more · {s:NJ, NY} state match: NJ, NY, PA, CT, DE, VA, MD, MA",
      // id | segment | age | income | move | pool | fit | triggers | size match | size note | states | state note
      cols: ["Segment", "Age", "Typical income", "Move type and area", "National pool", "Fit", "Top decision triggers", "2+ bedroom match", "State match"],
      rows: T(`
        S01|Undergraduate students|18-24|Part-time income; full-time workers 16-24 earn about $40k-$44k/yr|Dorm or shared apartment, small local loads, summer storage, out-of-state campus moves|16.2M undergrads ({s:NJ}: 355k total enrollment)|Low-medium|Parents' approval, low flat price, instant mobile booking, student discount, peer proof on TikTok and Instagram|No|Dorm and small loads|NJ|NJ enrollment is named
        S02|Graduate students and new grads|22-29|About $41k-$60k individual|Studio or 1BR, first-job relocation, city to city|3.2M grad students; interstate movers average 33 years old|Medium|Fast reply, binding price, online quote, social and AI discovery, authenticity|No|Studio or 1BR||No state named
        S03|Young professionals and couples (renters)|28-39|About $60k-$80k each; dual-income households often $100k+|{z:1-2BR}, {s:NYC} to {s:NJ}, {s:NJ}/{s:NY} to the Southeast|Renters move at 16.2% a year|High|Time savings, packing service, guaranteed quote, AI search (64% of 30-44s have asked AI)|Partly|1-2BR; the 2BR end fits|NJ, NY|NYC to NJ and NJ/NY outbound lanes
        S04|First-time home buyers|Median 40|$94,400 household median|Apartment to first home, median move 30 miles|21% of home purchases|High|Price certainty, coverage clarity, dates that flex around closing, realtor referral|Likely|Apartment to first home; size not stated||No state named
        S05|Growing families (repeat buyers)|35-54|$111,700 repeat-buyer median|{z:3BR+} house, suburb or out-of-state, school-calendar timing|79% of home buyers are repeat buyers|Very high|Safety, punctuality, live updates, care for children's and valuable items|Yes|3BR+ house|NJ, NY|NJ/NY to the Southeast
        S06|Corporate relocatees|25-54|Bachelor's holders median about $91k|Employer-paid interstate moves via HR or relocation firms|54% of firms raised volume in 2025; 61% plan bigger 2026 budgets|High (B2B)|Approved-vendor status, claims process, tracking, speed; HR decides|Not stated|Home size not stated||No state named
        S07|Military families|18-45|Pay-grade based|PCS moves, government-booked or self-managed|About 300,000 moves a year; 95k-110k retirements a year|Medium|Reliability, respect, PCS know-how, veteran-owned or veteran-friendly|Not stated|Home size not stated||No state named
        S08|Affluent households|40-70|Top 10%: $261k+|White-glove, art, pianos, second homes|About 10% of households|High value|Discretion, specialty crating, named team, concierge service|Likely|Whole-home and specialty moves|NJ, NY|Manhattan, Westchester, Bergen County
        S09|Empty nesters and downsizers|55-74|Peak earning years; $111,700 repeat-buyer median|House to condo, {s:NJ}/{s:NY} to FL, Carolinas, {s:DE}; retirement drives 13.9% of interstate moves|Sellers' median age 64 after 11 years in the home; 51% of boomers have downsized or plan to|Very high|Patience, decluttering and donation help, packing, emotional care, family referral|Likely|House to condo|NJ, NY, DE|NJ/NY origin, Delaware destination
        S10|Seniors moving to assisted or independent living|75+|Fixed income; adult children often pay|Short local moves, partial loads, setup at the new home|70M+ Americans aged 65+, mover rate 3.3%|Medium|Empathy, senior move manager partners, safety; adult child decides|No|Short local and partial loads||No state named
        S11|Small business owners|30-60|Varies by business|Office or retail relocation, after-hours and weekend work|36.2M small businesses, 6.4M with employees|Medium-high (B2B)|Zero downtime, insurance certificates, weekend crews, business references|Not applicable|Commercial move, no bedroom count||No state named`),
      foot: "Realtors, property managers, relocation firms and senior move managers are gatekeepers, not customers; they influence the first-time buyer, growing family, corporate, downsizer and senior segments. \"Likely\" and \"Partly\" mean the source does not state home size, so the match is our reading.",
      dives: { title: "Segment deep dives: from dorm to boardroom", sub: "How each life-stage group moves, decides and is won. Follows the filter above.",
        // title | segment ids | move | decide | wins
        cards: T(`
          Students and new grads (18-29)|S01, S02|Dorm move-in and move-out, summer storage, first apartment, first-job relocation. Small loads, tight dates in May-June and August.|Price first, but Gen Z is value-conscious rather than price-only; they reject brands that "try too hard" and 38% of Gen Z have regretted a purchase because reviews turned out misleading. Parents often pay or approve, so the parent needs to see insurance and licensing.|An instant mobile quote, a student flat rate, real-crew social video, and a sustainability angle (reusable bins, donation pickup).
          Young professionals and first-time buyers (28-40)|S03, S04|{z:1-2BR} apartments, {s:NYC} to {s:NJ} commuter towns, then the first home. First-time buyers are now a median 40 years old with $94,400 household income, and they move a median of 30 miles.|Heavy AI and mobile users; 75% of local searches end in a decision within 30 minutes. They value time over money and buy packing services.|A guaranteed quote in minutes, evening booking, closing-date flexibility, and a realtor who recommends you.
          Growing families (35-54)|S05|{z:3BR+} houses, school-district or cost-of-living moves, often {s:NJ}/{s:NY} to the Southeast. Highest tickets among everyday consumers.|Safety and reliability; one in four movers worries about loved ones getting hurt. Poor communication is the top complaint that turns into a bad review.|Background-checked crews, arrival windows and text updates, a kids'-room packing kit, and scheduling around the school year.
          Corporate relocatees and military families|S06, S07|Employer- or government-paid interstate moves. Job and transfer reasons drive 25.9% of interstate moves; the Pentagon moves about 300,000 service members and civilians a year.|A third party decides. HR teams and relocation management companies pick approved vendors; the military books through its Personal Property Activity, while retirees and self-managed moves choose freely.|Vendor-ready documentation, claims speed, tracking, and for veterans, a visible and specific military program.
          Affluent households (top 10%, $261k+)|S08|Primary and second homes, art, antiques, pianos, wine; often {s:Manhattan}, {s:Westchester}, {s:Bergen County}, the Hamptons, Florida.|Discretion and craftsmanship; referrals from designers, realtors and wealth managers outweigh ads.|A named move manager, specialty crating, white-glove packing, and quiet proof (insured value handled, not star counts).
          Empty nesters, downsizers and seniors (55+)|S09, S10|Houses held a median 11 years, to condos, 55+ communities or near grandchildren; retirement is 13.9% of interstate moves. Older seniors move short distances into independent (75% of move-manager jobs) or assisted living (20%).|Emotion and family. 78% of seniors report grief during downsizing, adult children often book, and only 24% of over-60s use AI for local recommendations, so referrals and phone calls matter.|Patience, decluttering and donation coordination, partnerships with senior move managers, and a crew lead who explains every step.
          Small business owners|S11|Offices, clinics, retail and storage; 6.4M small businesses have employees.|Downtime is the cost, not the moving fee. They need insurance certificates for buildings and after-hours crews.|A written downtime plan, weekend execution, IT and file handling, and references from similar businesses.`) },
    },

    /* -- Decision journey and triggers -- */
    journey: {
      title: "Customers decide in minutes, but only after they verify",
      sub: "The 2026 mover-selection journey, with the share of consumers at each step. The blue step is where most mover brands lose the customer. Each step has a play that generates the trigger for Zip to Zip Moving.",
      steps: T(`
        1|Trigger|job, family, sale, retirement, lease
        2|Discover|Google 71%, FB 49%, AI tools 45%
        3|Shortlist|72% compare three or fewer firms
        4|Verify|88% check AI picks; license, quote, reviews
        5|Book|75% decide in under 30 minutes
        6|Moving day|on time, updates, nothing damaged
        7|Advocate|70% would recommend their mover`),
      loop: ["Reviews feed the next search", "Customer checks, then books"],
      foot: "The share figures are copied from the journey graphic supplied for this dashboard. Only some of them also appear in the Target Audience Map, so confirm the rest before they go into a presentation.",
      plays: { title: "Trigger plays by step", sub: "What we do at each step to start or win a lead, and the signal that shows it is happening. Our states are marked in blue.",
        cols: ["Step", "Name", "What consumers do", "Trigger play for Zip to Zip Moving", "Signal to watch"],
        rows: T(`
          1|Trigger|job, family, sale, retirement, lease|Reach people when the event happens, before they search: lender and insurer closing and welcome kits, signal-based postcards to homes for sale, HR and relocation contacts for job moves, landlords and property managers for lease moves. Start in {s:NJ} and {s:NY}, the largest outbound states.|Purchase, large loan or lease, storage rental, listing, job transfer, retirement
          2|Discover|Google 71%, FB 49%, AI tools 45%|Be present where they look: complete Google Business Profile, route and town pages, answers in Facebook groups through the community desk, and FAQ content that AI tools can quote.|Search for movers near me, route or cost questions, group posts asking for a mover
          3|Shortlist|72% compare three or fewer firms|Be one of the three: fresh reviews, a visible star rating, price lock and credentials near the top of every page, and profiles on the marketplaces they compare.|Quote requests sent to two or three firms at once
          4|Verify|88% check AI picks; license, quote, reviews|Make every check pass in one click: USDOT and MC numbers linked to the FMCSA record, a written binding quote, replies to every review, and the same name, address and phone everywhere.|Visits to the licence, reviews and quote pages; a call asking about insurance
          5|Book|75% decide in under 30 minutes|Answer inside the decision window: instant online quote, a named estimator who replies in minutes, a phone that is answered, evening booking, and the ZIP20 offer shown on the page.|Quote opened, form started, call received
          6|Moving day|on time, updates, nothing damaged|Deliver the promises people check later: arrival windows, text updates, background-checked crews, and a published claims process.|Job completed; any delay or damage report
          7|Advocate|70% would recommend their mover|Turn the move into the next lead: ask for a review within a week, reply the same day, give a referral code, and thank the partner that sent the customer. Reviews feed the next search at step 2.|Review posted, referral code used, partner thank-you sent`) },
    },

    /* -- Market and trust -- */
    trust: {
      insights: { title: "Five insights that shape the map", sub: "What U.S. customers value and how they decide in 2026.",
        cards: T(`
          Predictability beats price|Cost is still the top factor, but only 43% of movers were offered a binding estimate, so a guaranteed number is a differentiator, not a hygiene factor.
          Discovery has moved to AI, verification has not|Use of ChatGPT and similar tools for local recommendations jumped from 6% to 45% in one year, yet 88% of AI users check the sources before they contact a business.
          Speed and a human voice are trust signals in themselves|84% of consumers say fast response is critical to authentic service, and 81% want a human tone.
          Values only work as evidence|62% of U.S. consumers weigh brand values, but only 43% believe brands live their stated purpose; cause partnerships raise trust for 46% when they are concrete and local.
          Each life stage has a different buyer|Students' parents, HR managers, adult children of seniors and business owners often make the decision, not the person who moves.`) },
      market: { title: "Market context 2026", sub: "Our states are marked where the figure names them. The Northeast is the country's biggest exporter of movers.",
        cols: ["Indicator", "Latest figure", "Source"],
        rows: T(`
          People who moved in a year|11.8% of the population, about 40.1 million adults (2024)|Census via MovingPlace
          Interstate share of moves|21.5% crossed state lines, 78.5% stayed in-state (2025)|MovingPlace
          People moving between states|7.16 million (2.1% of population)|USAFacts / ACS
          Average interstate mover age|33 (national median age about 40)|StorageCafe
          Renter vs owner mover rate|Renters 16.2%, owners 4.1% (a record low)|HomeSnacks / CPS
          Top reasons for interstate moves (2025)|Closer to family 29.1%, new job or transfer 25.9%, retirement 13.9%, lifestyle 9.5%|StorageCafe citing United Van Lines
          Top outbound states (2025)|{s:New Jersey} (62% outbound, 8th year at #1), {s:New York} (58%), California; {s:Massachusetts} is #7|United Van Lines
          Median household income (2025)|$87,460 pre-tax, $76,060 post-tax, a record high|U.S. Census Bureau
          Income spread|90th percentile about $261,300; 10th percentile about $20,010|Axios
          Median full-time weekly pay (Q3 2026)|$1,232 (about $64,000 a year)|BLS
          Typical cost with pro movers|$1,692 local, $4,401 long distance|Angi`) },
      triggers: { title: "Trust triggers beyond reviews", sub: "Behaviors a customer can test before booking. Each works only when it is shown, not claimed.",
        cols: ["Trust trigger", "Evidence it moves decisions", "How a mover proves it"],
        rows: T(`
          Price certainty|Only 43% of movers were offered a binding estimate; clear pricing is a top-3 contact reason (29%)|Binding or not-to-exceed quote in writing, itemized, no large upfront deposit
          Speed and a human voice|84% call quick response critical, 81% want a human tone; 19% now expect same-day replies to reviews (6% a year earlier)|Reply in minutes, named estimator, real phone answer, same-day review replies
          Verifiable credentials|Licensed, vetted movers correlate with higher satisfaction; large deposits and unclear fees are the top scam red flags|USDOT and MC numbers linked to the FMCSA record, insurance and valuation options explained in plain words
          Consistent presence, including AI|45% use AI for local recommendations; only 68% of business details on ChatGPT and Perplexity match Google Business Profiles|Same name, address, phone, services and prices on the site, GBP, directories and press; FAQ content AI tools can quote
          Real people over polish|Only 31% trust AI-generated content; polished creative can read as "too produced to trust"|Real crew photos and names, foreman intros, unscripted move-day video, AI use disclosed
          Care for people, not just boxes|24% worry about loved ones getting hurt; 44% say there is an age to hand off the heavy lifting|Background-checked crews, safety protocol, senior and family move options
          Damage and claims transparency|Damage is the top complaint (62% of unhappy customers)|Published claims process and timelines, protection materials shown on video
          Live communication|Poor communication is cited by 53% of dissatisfied customers|Arrival windows, text updates, crew tracking, one point of contact
          Trusted intermediaries|Unpaid voices are the top trust influence (41% vs 20% for the brand)|Referrals via realtors, HR and relocation firms, property managers, senior move managers
          Visible community commitment|Cause-based partnerships raise trust for 46%, the strongest partnership type measured|Ongoing local program with counted results (see case studies)
          Shared identity|66% are hesitant to trust people with different values or backgrounds|Crews and creative that reflect the neighborhoods served; multilingual service where relevant`) },
    },

    /* -- Cases and campaigns -- */
    cases: {
      title: "Case studies: emotional cause campaigns by moving companies",
      sub: "Both tie a cause to something movers already do, repeat it every year and publish counted results.",
      // title | what | scale | trigger | segment | lesson
      cards: T(`
        TWO MEN AND A TRUCK: Movers for Moms (families and women)|An annual spring drive before Mother's Day. Local franchises turn businesses, schools and community sites into collection points for essential items, then their crews sort and deliver everything to women's and family shelters.|2025 was the program's 18th year; it collected 528,039 items against a 450,000 goal. It runs in 47 states with nearly 1,500 collection partners, and the 2026 edition added another 519,363 items. An {s:Ocean Township}, {s:New Jersey} franchise is one of its featured local runs.|The brand was founded by a mother, so the cause is its origin story, not a borrowed one. Mother's Day timing makes it seasonal and shareable.|Mothers and growing families, schools and PTAs, local employers|A sister program set (Movers for Mutts, Movers for Military, Truckload of Warmth) gives each audience its own reason to engage.
        Move For Hunger: The moving-industry food-rescue network (homeowners, renters, employers)|A nonprofit that grew from one {s:New Jersey} moving company into a network in all 50 states and Canada. Movers offer customers to donate unopened food on moving day and deliver it to local food banks; they also haul food from drives and events.|The network moved over 17 million pounds of food in 2025, feeding more than 14 million people. United Van Lines joined in April 2025; Sirva, Allied and North American together donated 466,209 meals in 2025. Good Greek Moving & Storage in Florida has carried over 118,000 pounds since 2023; NorthStar Moving rescued 686 pounds from the Los Angeles Marathon in 2025.|Guilt-free decluttering. Moving day becomes a moment of giving, and the customer sees their own pantry feed a neighbor.|Downsizers and families with full pantries, values-driven millennials and Gen Z, apartment communities and employers who run drives|The cause lives inside the service, so every booking is a participation moment and every pound is a reportable proof point.`),
      ideas: { title: "Campaign ideas for Zip to Zip Moving by segment",
        sub: "Starting concepts to test, each with one counted proof metric. Run each on the same calendar moment every year and publish the running count on the website, Google Business Profile and social channels.",
        cols: ["Segment", "Campaign concept", "Emotional trigger", "Partner type", "Proof metric"],
        rows: T(`
          {s:NJ}/{s:NY} outbound movers (all ages)|"Leave a Little Behind": every interstate move out of NJ or NY offers a moving-day food pickup for a local food bank|Saying goodbye by giving back to the old neighborhood|Move For Hunger and county food banks|Pounds donated per month, share of moves participating
          Students and new grads|Campus move-out drive: crews collect unwanted furniture, linens and food at semester end|Waste guilt turned into impact; a cause they can post|University sustainability and residence-life offices|Items rescued per campus, student bookings with campus code
          Growing families|August "Back-to-School Run": collection boxes at schools and offices, crews deliver supplies to shelters|Every child starts the year ready|PTAs, family shelters, local employers|Backpacks delivered, school partners, family leads from partner pages
          Downsizers and seniors|"Rightsizing with Respect": free downsizing talks at 55+ communities; surplus furniture goes to families leaving shelters|Your things start someone else's new home|Senior move managers, furniture banks, senior centers|Attendees, households helped, referral bookings
          Veterans and military families|Veterans Day "Welcome Home Move": one donated or deeply discounted move per quarter for a veteran family|Gratitude made concrete|Veteran nonprofits, VFW and American Legion posts|Moves donated, veteran bookings, press pickups
          Small businesses and corporate HR|Office-move food and supply drive built into every commercial job|A relocation that leaves a community benefit|HR teams, chambers of commerce|Pounds collected per office move, repeat B2B accounts`) },
    },
  };
})();
