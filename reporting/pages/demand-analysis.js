/* DEMAND ANALYSIS — what the market asked us to move, by MOVE DATE.
 *
 * READ THE BASIS FIRST. Every other lead number in this portal counts a lead on the day it CAME
 * IN. This page counts it on the day the customer wants to MOVE. A lead created in March for a
 * July Saturday is March in the funnel and July here, so the two totals will never agree and
 * are not supposed to. That is why the basis is stamped on the page, on every card and in the
 * tooltip: the one failure mode that matters here is somebody trying to reconcile this with the
 * Lead Funnel and concluding one of them is broken.
 *
 * DEMAND IS WHAT WAS ASKED FOR. Every lead aimed at a date counts, booked or not — a Saturday
 * with forty enquiries and six confirmations had forty units of demand. The booked subset is
 * drawn ON TOP of it (the blue foot of each cell) rather than instead of it, because the
 * difference between the two is the whole question.
 *
 * IT IS NOT A PRICING TOOL (Tornike, 2026-08-06: no seasonality table, no multipliers, none
 * wanted). The last section puts quote against cubic feet across demand levels and stops there.
 * It states no rule and reaches no verdict — the judgement about pricing is his, and this page
 * exists to give him the picture to make it on.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.demand_move_date) {
    // PAYLOAD CONTRACT: a column missing from this list never arrives, however well the page
    // is written. It is also the whole download, one row per date per book — so the mart's
    // `Month` / `Weekday` / `Avg CF` / `Top State` columns are deliberately NOT here. The
    // calendar has to do real date arithmetic anyway, and an average this page can divide out
    // of two numbers it already has is a column it should not be paying to ship.
    RS.DATASETS.demand_move_date = {
      table: "mart_demand_move_date",
      cols: ["Move Date", "Company", "Leads", "Qualified", "Booked",
             "Total CF", "CF Leads", "Booked CF",
             "Avg Quote", "Quote Leads", "Booked Closing Total",
             "Avg Crew", "Crew Leads", "Avg Trucks", "Truck Leads",
             "Priced Leads", "Priced Quote", "Priced CF",
             "Avg Lead Days", "Lead Days Leads",
             "LD Leads", "Local Leads", "Service Unknown",
             "Size Small", "Size Mid", "Size Big", "Size Other",
             "Service Mix", "Size Mix", "CF Mix", "State Mix",
             "Top Source", "Top Source Leads"],
      dateCols: { "Move Date": "Move Date" }, defaultDate: "Move Date",
    };
  }
  // THE PER-LEAD COMPANION (2026-08-20): status/source/size filters, the leads behind a
  // clicked day, and the after-the-day-was-full count all need individual leads. Loaded
  // lazily in the background — the default view stays on the cheap aggregate.
  if (window.RS && RS.DATASETS && !RS.DATASETS.demand_leads) {
    RS.DATASETS.demand_leads = {
      table: "mart_demand_leads",
      cols: ["Move Date", "Company", "Job No", "Customer", "Create Date", "Created NY",
             "Status", "Source", "Size", "Service", "Moving Type", "CF Range", "State",
             "CF", "Quote", "Closing Total", "Crew", "Trucks"],
      dateCols: { "Move Date": "Move Date" }, defaultDate: "Move Date",
    };
  }
})();

registerPage({
  id: "demand-analysis",
  title: "Demand Analysis",
  subtitle: "Every lead aimed at each MOVE DATE — the demand the market asked for, with what we booked laid over it.",
  datasets: [],

  render: function (host) {
    // window.RSC is the real global (assets/rs-components.js:3). This read RS_COMPONENTS,
    // which has never existed, so `|| {}` handed every one of these pages an EMPTY object
    // and each helper quietly fell through to its local fallback. Nothing looked wrong
    // until `collapsible` -- the one member with no fallback -- was called, and Packing
    // Control and Storage Control died with "RSC.collapsible is not a function".
    const RSC = window.RSC || {};
    const esc = RSC.esc || (v => String(v == null ? "" : v).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));

    const nn = v => (v == null || v === "" || isNaN(v)) ? null : +v;
    const num = v => nn(v) || 0;
    const fmtN = v => Math.round(num(v)).toLocaleString();
    const fmt1 = v => (Math.round(num(v) * 10) / 10).toLocaleString(undefined,
      { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const money0 = v => "$" + Math.round(num(v)).toLocaleString();
    const money2 = v => "$" + (Math.round(num(v) * 100) / 100).toLocaleString(undefined,
      { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    // an unmeasured value renders as a dash, never as a zero
    const dash = (v, f) => (v == null ? "—" : f(v));
    const pct = v => (v == null ? "—" : Math.round(v * 100) + "%");

    const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const MONL = ["January", "February", "March", "April", "May", "June", "July", "August",
                  "September", "October", "November", "December"];
    const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const TODAY = new Date().toISOString().slice(0, 10);

    // The three things the calendar can be shaded by. Booked is deliberately available as a
    // shading too — "where did the demand actually turn into work" is a different picture from
    // "where was the demand", and flipping between them beats guessing from one overlay.
    const METRIC = {
      leads: { lab: "Leads asked", get: d => d.leads, fmt: fmtN, noun: "leads" },
      cf: { lab: "Cubic feet asked", get: d => d.cf, fmt: fmtN, noun: "cu ft" },
      booked: { lab: "Booked", get: d => d.booked, fmt: fmtN, noun: "booked" },
    };

    const S = window.__DEM || (window.__DEM = {
      rows: null, year: null, co: "", metric: "leads", day: null, err: "",
      // the per-lead layer: filters, the lazy rows, and the capacity input (his #5)
      status: "", src: "", size: "", leads: null, leadsLoading: false, leadsErr: "",
      cap: +(localStorage.getItem("ztzDemandCap") || 10) || 10,
    });

    host.innerHTML = '<style id="dmCss">'
      + ".dm{font-variant-numeric:tabular-nums}"
      // ---- the basis banner: the one thing nobody may miss ------------------------------
      + ".dm-basis{display:flex;gap:12px;align-items:flex-start;background:var(--brand-glow);"
      + "border:1px solid var(--line);border-left:4px solid var(--brand);border-radius:13px;"
      + "padding:12px 16px;margin-bottom:14px}"
      + ".dm-basis .bt{font-size:9.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;"
      + "color:var(--brand-d);background:var(--panel);border-radius:999px;padding:5px 10px;white-space:nowrap}"
      + "body.rs-app:not(.light) .dm-basis .bt{color:var(--brand)}"
      + ".dm-basis p{margin:0;font-size:12.5px;line-height:1.65;color:var(--muted);max-width:112ch}"
      + ".dm-basis b{color:var(--ink)}"
      // ---- toolbar ----------------------------------------------------------------------
      + ".dm-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px}"
      + ".dm-seg{display:flex;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;overflow:hidden}"
      + ".dm-seg button{font-family:inherit;font-size:12px;font-weight:700;padding:7px 13px;border:0;"
      + "background:none;color:var(--muted);cursor:pointer}"
      + ".dm-seg button.on{background:var(--brand);color:var(--brand-ink)}"
      + ".dm-bar .sp{margin-left:auto;font-size:11.5px;color:var(--faint)}"
      + ".dm-fld{display:flex;flex-direction:column;gap:3px}"
      + ".dm-fld>span{font-size:9.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".dm-fld select{background:var(--panel);color:var(--ink);border:1px solid var(--line-2);"
      + "border-radius:9px;padding:6px 10px;font-size:12.5px;font-weight:700;font-family:inherit;"
      + "cursor:pointer;max-width:210px}"
      + ".dm-fld select:hover:not(:disabled){border-color:var(--brand)}"
      + ".dm-cap{width:64px;background:var(--panel);color:var(--ink);border:1.5px solid var(--line-2);"
      + "border-radius:9px;padding:6px 9px;font-size:13px;font-weight:800;font-family:inherit;text-align:right}"
      + ".dm-cap:focus{outline:none;border-color:var(--brand)}"
      + ".dm-lead-tbl td{white-space:nowrap}"
      // ---- kpis --------------------------------------------------------------------------
      + ".dm-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(172px,1fr));gap:11px;margin-bottom:16px}"
      + ".dm-k{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}"
      + ".dm-k b{display:block;font-size:23px;font-weight:750;letter-spacing:-.5px;line-height:1.15}"
      + ".dm-k span{display:block;font-size:9px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);margin-top:5px}"
      + ".dm-k small{display:block;font-size:11px;color:var(--muted);margin-top:2px}"
      + ".dm-k.blue b{color:var(--blue)}"
      // ---- cards -------------------------------------------------------------------------
      + ".dm-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px 17px 17px;margin-bottom:14px}"
      + ".dm-h{display:flex;flex-wrap:wrap;gap:9px;align-items:baseline;margin-bottom:4px}"
      + ".dm-h h3{margin:0;font-size:14.5px;font-weight:750;letter-spacing:-.2px;color:var(--ink)}"
      + ".dm-h .tag{font-size:8.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;"
      + "color:var(--brand-d);background:var(--brand-glow);border-radius:999px;padding:3px 8px}"
      + "body.rs-app:not(.light) .dm-h .tag{color:var(--brand)}"
      + ".dm-h .rt{margin-left:auto;font-size:11.5px;color:var(--faint)}"
      + ".dm-note{font-size:11.5px;color:var(--faint);line-height:1.65;max-width:112ch;margin:0 0 12px}"
      + ".dm-note b{color:var(--muted)}"
      + ".dm-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:14px}"
      // ---- calendar heatmap ---------------------------------------------------------------
      /* Twelve months want a factor of twelve, not "as many as fit". auto-fit at 196px gave
         nine across on a 2560px screen, so Oct/Nov/Dec dropped to a third-width orphan row
         under a full one -- a calendar that looks broken rather than annual. Six across (6x2)
         above 1500px, four (4x3) on a laptop, three below that: every row full, always. */
      + ".dm-cal{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}"
      + "@media(min-width:1050px){.dm-cal{grid-template-columns:repeat(4,minmax(0,1fr))}}"
      + "@media(min-width:1500px){.dm-cal{grid-template-columns:repeat(6,minmax(0,1fr))}}"
      + ".dm-mon .ml{font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;"
      + "color:var(--muted);margin-bottom:6px}"
      + ".dm-wk{display:grid;grid-template-columns:repeat(7,1fr);gap:3px}"
      + ".dm-wk .wh{font-size:8.5px;font-weight:700;color:var(--faint);text-align:center;padding-bottom:2px}"
      + ".dm-c{position:relative;aspect-ratio:1;border-radius:4px;background:var(--panel-2);"
      + "border:1px solid var(--line);overflow:hidden;cursor:pointer}"
      + ".dm-c.pad{background:none;border:0;cursor:default}"
      + ".dm-c .lv{position:absolute;inset:0;background:var(--brand)}"
      + ".dm-c .bk{position:absolute;left:0;right:0;bottom:0;background:var(--blue);opacity:.85}"
      + ".dm-c.ahead{border-style:dashed;border-color:var(--line-2)}"
      + ".dm-c.on{outline:2px solid var(--ink);outline-offset:1px;z-index:2}"
      + ".dm-c:hover{outline:2px solid var(--brand-d);outline-offset:1px;z-index:2}"
      + ".dm-leg{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:11px;color:var(--faint);margin-top:13px}"
      + ".dm-leg .sw{display:inline-flex;gap:3px;align-items:center;vertical-align:middle}"
      + ".dm-leg .sw i{width:13px;height:13px;border-radius:3px;background:var(--brand);display:inline-block;"
      + "border:1px solid var(--line)}"
      + ".dm-leg .bl{width:13px;height:6px;border-radius:2px;background:var(--blue);display:inline-block}"
      // ---- tooltip -------------------------------------------------------------------------
      + ".dm-tt{position:fixed;z-index:60;pointer-events:none;display:none;background:var(--panel);"
      + "border:1px solid var(--line-2);border-radius:11px;box-shadow:var(--shadow);padding:10px 13px;"
      + "font-size:12px;min-width:190px;max-width:290px}"
      + ".dm-tt.on{display:block}"
      + ".dm-tt .d{font-weight:800;font-size:12.5px;margin-bottom:5px}"
      + ".dm-tt .r{display:flex;justify-content:space-between;gap:14px;color:var(--muted);line-height:1.75}"
      + ".dm-tt .r b{color:var(--ink);font-weight:700}"
      + ".dm-tt .f{margin-top:6px;font-size:10.5px;color:var(--faint);border-top:1px solid var(--line);padding-top:5px}"
      // ---- tables ---------------------------------------------------------------------------
      + ".dm-t{border-collapse:collapse;width:100%;font-size:12.5px}"
      + ".dm-t th{text-align:right;font-size:9.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;"
      + "color:var(--faint);padding:8px 10px;border-bottom:1px solid var(--line-2);white-space:nowrap}"
      + ".dm-t th:first-child,.dm-t td:first-child{text-align:left}"
      + ".dm-t td{padding:8px 10px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}"
      + ".dm-t tbody tr:hover{background:var(--panel-2)}"
      + ".dm-t td.nm{font-weight:700}"
      + ".dm-scroll{overflow-x:auto}"
      // ---- distribution bars -----------------------------------------------------------------
      + ".dm-bars{display:flex;flex-direction:column;gap:7px}"
      + ".dm-b{display:grid;grid-template-columns:minmax(96px,1.2fr) minmax(0,3fr) auto;gap:10px;align-items:center;font-size:12px}"
      + ".dm-b .lb{color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".dm-b .tr{position:relative;height:9px;border-radius:5px;background:var(--panel-2);overflow:hidden}"
      + ".dm-b .tr i{position:absolute;left:0;top:0;bottom:0;border-radius:5px;background:var(--brand)}"
      + ".dm-b .vv{font-weight:700;white-space:nowrap}"
      + ".dm-b .vv small{color:var(--faint);font-weight:500;margin-left:5px}"
      // ---- weekday x month matrix ---------------------------------------------------------
      // no width, so the table sized to its content -- a ~655px matrix floating in a 2054px
      // card with 1400px of the card left blank. Full width, and a bigger cell floor so the
      // extra goes to every column evenly instead of the last one taking it all.
      + ".dm-mx{border-collapse:separate;border-spacing:3px;font-size:11.5px;width:100%}"
      + ".dm-mx th{font-size:9px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:2px 4px}"
      + ".dm-mx td{position:relative;text-align:center;padding:7px 4px;border-radius:6px;min-width:90px;"
      + "font-weight:700;color:var(--ink);background:var(--panel-2)}"
      + ".dm-mx td .lv{position:absolute;inset:0;border-radius:6px;background:var(--brand)}"
      + ".dm-mx td span{position:relative}"
      + ".dm-mx td.tot{background:var(--panel);border:1px solid var(--line-2);font-weight:800}"
      + ".dm-mx th.rh{text-align:right}"
      // ---- day detail -----------------------------------------------------------------------
      + ".dm-day{background:var(--panel-2);border:1px solid var(--line-2);border-radius:12px;padding:13px 15px;margin-top:14px}"
      + ".dm-day .dh{display:flex;flex-wrap:wrap;gap:10px;align-items:baseline;margin-bottom:9px}"
      + ".dm-day .dh b{font-size:14px;font-weight:800}"
      + ".dm-day .dh span{font-size:11.5px;color:var(--muted)}"
      + ".dm-day .dh button{margin-left:auto;font-family:inherit;font-size:11px;font-weight:700;"
      + "padding:5px 11px;border-radius:999px;border:1px solid var(--line);background:var(--panel);color:var(--muted);cursor:pointer}"
      + ".dm-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(142px,1fr));gap:8px}"
      + ".dm-f{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:8px 11px}"
      + ".dm-f .l{font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}"
      + ".dm-f .v{font-size:13.5px;font-weight:750;margin-top:2px}"
      + ".dm-f .s{font-size:10.5px;color:var(--muted);margin-top:1px;overflow:hidden;text-overflow:ellipsis}"
      + ".dm-empty{padding:38px;text-align:center;color:var(--faint);font-size:13.5px;background:var(--panel);"
      + "border:1px dashed var(--line-2);border-radius:14px}"
      + "@media(max-width:700px){.dm-cal{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}}"
      + '</style><div class="dm"><div id="dmMain"></div></div><div class="dm-tt" id="dmTip"></div>';

    const main = host.querySelector("#dmMain");
    const tip = host.querySelector("#dmTip");
    main.innerHTML = '<div class="dm-empty">Loading the demand calendar…</div>';

    /* ================================================================= data =============== */
    // "Local Moving:12;Flat Rate:3" -> [["Local Moving",12],...]. The mart packs each day's
    // distribution into one column rather than shipping four more tables to grant and cache.
    function parseMix(s) {
      if (!s) return [];
      return String(s).split(";").map(p => {
        const i = p.lastIndexOf(":");
        if (i < 0) return null;
        return [p.slice(0, i).trim(), +p.slice(i + 1) || 0];
      }).filter(x => x && x[0]);
    }
    const addMix = (into, s) => parseMix(s).forEach(([k, n]) => { into[k] = (into[k] || 0) + n; });
    const mixList = obj => Object.keys(obj).map(k => ({ k, n: obj[k] }))
      .sort((a, b) => b.n - a.n || a.k.localeCompare(b.k));

    function blank(d) {
      return { d: d, leads: 0, qual: 0, booked: 0, cf: 0, cfN: 0, bookedCf: 0,
               qSum: 0, qN: 0, ct: 0, crewSum: 0, crewN: 0, truckSum: 0, truckN: 0,
               pq: 0, pcf: 0, pn: 0, ldSum: 0, ldN: 0,
               ld: 0, local: 0, svcUnknown: 0,
               small: 0, mid: 0, big: 0, other: 0,
               svc: {}, size: {}, cfr: {}, st: {}, src: {} };
    }
    // One accumulator, used for a day, a weekday, a demand level and the whole window alike —
    // so every figure on the page comes from one definition of how these rows add up.
    function fold(a, r) {
      a.leads += num(r.Leads); a.qual += num(r.Qualified); a.booked += num(r.Booked);
      // the count of leads that actually stated a volume travels with the volume: a window
      // where nobody filled the field must read as unmeasured, not as nought cubic feet
      a.cf += num(r["Total CF"]); a.cfN += num(r["CF Leads"]); a.bookedCf += num(r["Booked CF"]);
      // Avg Quote is a mean over the day's quoted leads: re-weight by that count, never
      // average the averages (a day with two quotes would otherwise weigh like a day with 60).
      if (nn(r["Avg Quote"]) != null && num(r["Quote Leads"]) > 0) {
        a.qSum += num(r["Avg Quote"]) * num(r["Quote Leads"]); a.qN += num(r["Quote Leads"]);
      }
      a.ct += num(r["Booked Closing Total"]);
      if (nn(r["Avg Crew"]) != null && num(r["Crew Leads"]) > 0) {
        a.crewSum += num(r["Avg Crew"]) * num(r["Crew Leads"]); a.crewN += num(r["Crew Leads"]);
      }
      if (nn(r["Avg Trucks"]) != null && num(r["Truck Leads"]) > 0) {
        a.truckSum += num(r["Avg Trucks"]) * num(r["Truck Leads"]); a.truckN += num(r["Truck Leads"]);
      }
      a.pq += num(r["Priced Quote"]); a.pcf += num(r["Priced CF"]); a.pn += num(r["Priced Leads"]);
      if (nn(r["Avg Lead Days"]) != null && num(r["Lead Days Leads"]) > 0) {
        a.ldSum += num(r["Avg Lead Days"]) * num(r["Lead Days Leads"]);
        a.ldN += num(r["Lead Days Leads"]);
      }
      a.ld += num(r["LD Leads"]); a.local += num(r["Local Leads"]); a.svcUnknown += num(r["Service Unknown"]);
      a.small += num(r["Size Small"]); a.mid += num(r["Size Mid"]);
      a.big += num(r["Size Big"]); a.other += num(r["Size Other"]);
      addMix(a.svc, r["Service Mix"]); addMix(a.size, r["Size Mix"]);
      addMix(a.cfr, r["CF Mix"]); addMix(a.st, r["State Mix"]);
      // `src` is the day's WINNING source only — the mart carries no full source breakdown at
      // this grain. Read it at day level (the tooltip and the day card) and nowhere else: a
      // tally of daily winners is not a count of leads by source.
      if (r["Top Source"]) a.src[r["Top Source"]] = (a.src[r["Top Source"]] || 0) + num(r["Top Source Leads"]);
      return a;
    }
    const avgQuote = a => (a.qN ? a.qSum / a.qN : null);
    const avgCrew = a => (a.crewN ? a.crewSum / a.crewN : null);
    const avgTrucks = a => (a.truckN ? a.truckSum / a.truckN : null);
    const perCF = a => (a.pcf > 0 ? a.pq / a.pcf : null);
    const leadDays = a => (a.ldN ? a.ldSum / a.ldN : null);
    // Booking rate is confirmed / qualified — the portal's canonical definition
    // (RS.bookingRate in assets/rs-core.js), read here off pre-summed columns.
    const bookRate = a => (a.qual ? Math.min(1, a.booked / a.qual) : null);

    const years = () => [...new Set((S.rows || []).map(r => String(r["Move Date"]).slice(0, 4)))]
      .filter(Boolean).sort();
    const companies = () => [...new Set((S.rows || []).map(r => r.Company).filter(Boolean))].sort();

    function scope() {
      let rs = S.rows || [];
      if (S.co) rs = rs.filter(r => r.Company === S.co);
      if (S.year) rs = rs.filter(r => String(r["Move Date"]).slice(0, 4) === S.year);
      return rs;
    }

    /* ---------------- the per-lead layer (2026-08-20) --------------------------------- */
    const leadFilterOn = () => !!(S.status || S.src || S.size);
    function loadLeads() {
      if (S.leads || S.leadsLoading) return;
      S.leadsLoading = true;
      RS.load("demand_leads").then(rs => {
        S.leads = (rs || []).map(r => {
          r.d = String(r["Move Date"]).slice(0, 10);
          r.cd = String(r["Created NY"] || r["Create Date"] || "");
          return r;
        });
        S.leadsLoading = false;
        paint();                      // filters + day lists + the overflow card wake up
      }).catch(e => { S.leadsErr = e.message; S.leadsLoading = false; paint(); });
    }
    function scopeLeads() {
      let ls = S.leads || [];
      if (S.co) ls = ls.filter(l => l.Company === S.co);
      if (S.year) ls = ls.filter(l => l.d.slice(0, 4) === S.year);
      if (S.status) ls = ls.filter(l => (l.Status || "") === S.status);
      if (S.src) ls = ls.filter(l => (l.Source || "") === S.src);
      if (S.size) ls = ls.filter(l => (l.Size || "") === S.size);
      return ls;
    }
    // the same size buckets the mart computes, read off the label the same way
    function sizeBucketOf(label) {
      const t = String(label || "").toLowerCase();
      if (/single item|studio/.test(t)) return "small";
      const m = t.match(/(\d+)\s*(?:bed|br\b)/);
      if (m) return +m[1] <= 2 ? "mid" : "big";
      return "other";
    }
    /* one lead into the SAME accumulator shape fold() fills from mart rows, so every card
       renders identically whichever layer computed it */
    function foldLead(a, l) {
      a.leads++;
      const sc = l.Status || "";
      if (sc !== "Bad Lead") a.qual++;
      const bk = sc === "Confirmed";
      if (bk) a.booked++;
      const cf = nn(l.CF);
      if (cf != null && cf > 0) { a.cf += cf; a.cfN++; if (bk) a.bookedCf += cf; }
      const q = nn(l.Quote);
      if (q != null && q > 0) {
        a.qSum += q; a.qN++;
        if (cf != null && cf > 0) { a.pq += q; a.pcf += cf; a.pn++; }
      }
      if (bk) a.ct += num(l["Closing Total"]);
      const crew = nn(l.Crew);
      if (crew != null && crew > 0) { a.crewSum += crew; a.crewN++; }
      const tr = nn(l.Trucks);
      if (tr != null && tr > 0) { a.truckSum += tr; a.truckN++; }
      const cd = String(l["Create Date"] || "").slice(0, 10);
      if (cd) {
        a.ldSum += (new Date(l.d + "T00:00:00Z") - new Date(cd + "T00:00:00Z")) / 864e5;
        a.ldN++;
      }
      const mt = l["Moving Type"] || "";
      if (mt === "Long Distance") a.ld++;
      else if (mt === "Local Moving") a.local++;
      else a.svcUnknown++;
      a[({ small: "small", mid: "mid", big: "big", other: "other" })[sizeBucketOf(l.Size)]]++;
      const bump = (o, k) => { const kk = k || "(not stated)"; o[kk] = (o[kk] || 0) + 1; };
      bump(a.svc, l.Service); bump(a.size, l.Size); bump(a.cfr, l["CF Range"]);
      bump(a.st, l.State); bump(a.src, l.Source);
      return a;
    }
    function byDayLeads(ls) {
      const m = new Map();
      ls.forEach(l => {
        if (!m.has(l.d)) m.set(l.d, blank(l.d));
        foldLead(m.get(l.d), l);
      });
      return m;
    }
    // date -> folded day, companies merged (the calendar is one square per date, not per book)
    function byDay(rs) {
      const m = new Map();
      rs.forEach(r => {
        const d = String(r["Move Date"]).slice(0, 10);
        if (!m.has(d)) m.set(d, blank(d));
        fold(m.get(d), r);
      });
      return m;
    }

    /* ================================================================= paint =============== */
    function load() {
      return RS.load("demand_move_date").then(rows => {
        S.rows = rows || [];
        if (!S.year) {
          const ys = years();
          const now = String(new Date().getFullYear());
          S.year = ys.indexOf(now) >= 0 ? now : (ys[ys.length - 1] || now);
        }
        paint();
        loadLeads();     // the per-lead layer streams in behind the first paint
      }).catch(e => {
        main.innerHTML = '<div class="dm-empty">Could not load the demand mart — ' + esc(e.message)
          + "</div>";
      });
    }

    function paint() {
      if (!S.rows || !S.rows.length) {
        main.innerHTML = '<div class="dm-empty">No demand rows yet — <b>mart_demand_move_date</b> '
          + "is built by the nightly refresh from the Moveboard leads.</div>";
        return;
      }
      // a lead filter switches the WHOLE page onto the per-lead layer, computed into the
      // same accumulators — every card renders from one shape whichever layer filled it
      let days, all;
      if (leadFilterOn() && S.leads) {
        const ls = scopeLeads();
        days = byDayLeads(ls);
        all = blank("");
        ls.forEach(l => foldLead(all, l));
      } else {
        const rs = scope();
        days = byDay(rs);
        all = blank("");
        rs.forEach(r => fold(all, r));
      }

      let h = basisBanner() + toolbar() + kpis(all, days);
      if (leadFilterOn() && !S.leads) {
        h += '<div class="dm-empty">' + (S.leadsErr
          ? "Could not load the per-lead detail — " + esc(S.leadsErr)
          : "Loading the per-lead detail for these filters…")
          + "</div>";
      }
      h += calendarCard(days);
      h += matrixCard(days);
      h += '<div class="dm-grid2">' + cfCard(all) + sizeCard(all) + "</div>";
      h += '<div class="dm-grid2">' + peakCard(days) + marketCard(all) + "</div>";
      h += overflowCard();
      h += quoteCard(days);
      main.innerHTML = h;
      wire(days);
    }

    function basisBanner() {
      return '<div class="dm-basis"><span class="bt">Move-date basis</span>'
        + "<p>Every number on this page is counted on the <b>date of the move the customer "
        + "asked for</b> — not the date the lead came in. The Lead Funnel, Sales pages and the "
        + "Monthly Report all count leads by <b>create date</b>, so the two will not add up to "
        + "each other and are not meant to: one lead created in March for a July Saturday is "
        + "March there and July here. <b>Demand means everything that was asked for</b>, booked "
        + "or not; the blue foot on each square is the part we confirmed.</p></div>";
    }

    function toolbar() {
      const ys = years(), cos = companies();
      let h = '<div class="dm-bar"><div class="dm-seg">'
        + ys.map(y => '<button data-y="' + esc(y) + '"' + (y === S.year ? ' class="on"' : "") + ">"
            + esc(y) + "</button>").join("") + "</div>";
      if (cos.length > 1) {
        h += '<div class="dm-seg"><button data-co=""' + (S.co ? "" : ' class="on"') + ">Both books</button>"
          + cos.map(c => '<button data-co="' + esc(c) + '"' + (c === S.co ? ' class="on"' : "") + ">"
              + esc(c) + "</button>").join("") + "</div>";
      }
      h += '<div class="dm-seg">'
        + Object.keys(METRIC).map(k => '<button data-m="' + k + '"'
            + (k === S.metric ? ' class="on"' : "") + ">" + esc(METRIC[k].lab) + "</button>").join("")
        + "</div>";
      // the per-lead filters (his ask, 2026-08-19): status / source / size. Options come
      // from the lead layer, so they show real values, not guesses; until it streams in
      // they render disabled rather than empty-but-clickable.
      const ldSel = (id, label, cur, key) => {
        if (!S.leads) {
          return '<label class="dm-fld"><span>' + label + '</span><select disabled><option>'
            + (S.leadsErr ? "unavailable" : "loading…") + "</option></select></label>";
        }
        const vals = [...new Set(S.leads.map(l => l[key] || ""))].filter(Boolean).sort();
        return '<label class="dm-fld"><span>' + label + '</span><select data-lf="' + id + '">'
          + '<option value="">All</option>'
          + vals.map(v => '<option value="' + esc(v) + '"' + (cur === v ? " selected" : "") + ">"
              + esc(v) + "</option>").join("")
          + "</select></label>";
      };
      h += ldSel("status", "Status", S.status, "Status")
        + ldSel("src", "Source", S.src, "Source")
        + ldSel("size", "Size", S.size, "Size");
      h += '<span class="sp">Shading follows the metric; the blue foot is always the booked share.'
        + (leadFilterOn() ? " <b>Filters on — every card is recomputed from the individual leads.</b>" : "")
        + "</span>";
      return h + "</div>";
    }

    function kpis(a, days) {
      const dayVals = [...days.values()].map(d => d.leads).sort((x, y) => x - y);
      const med = dayVals.length
        ? (dayVals.length % 2 ? dayVals[(dayVals.length - 1) / 2]
            : (dayVals[dayVals.length / 2 - 1] + dayVals[dayVals.length / 2]) / 2) : null;
      let peak = null;
      days.forEach(d => { if (!peak || d.leads > peak.leads) peak = d; });
      const ahead = [...days.values()].filter(d => d.d > TODAY)
        .reduce((s, d) => s + d.leads, 0);

      const k = (b, lab, sub, cls) => '<div class="dm-k ' + (cls || "") + '"><b>' + esc(b) + "</b><span>"
        + esc(lab) + "</span><small>" + esc(sub) + "</small></div>";
      return '<div class="dm-kpis">'
        + k(fmtN(a.leads), "Leads asking for " + S.year,
            fmtN(days.size) + " date" + (days.size === 1 ? "" : "s") + " asked for")
        + k(fmtN(a.booked), "Booked onto those dates",
            dash(bookRate(a), pct) + " of qualified leads", "blue")
        + k(a.cfN ? fmtN(a.cf) + " cf" : "—", "Cubic feet asked for",
            a.cfN ? fmtN(a.cfN) + " leads stated a volume" : "no lead stated a volume")
        + k(med == null ? "—" : fmt1(med), "Typical day",
            "median leads on a date that was asked for")
        + k(peak ? fmtN(peak.leads) : "—", "Busiest single date",
            peak ? longDate(peak.d) : "—")
        + k(dash(perCF(a), v => money2(v)), "Quote per cubic foot",
            fmtN(a.pn) + " leads with both a quote and a volume")
        + (ahead ? k(fmtN(ahead), "Still ahead of us",
            "leads for dates after today — those dates are still filling") : "")
        + "</div>";
    }

    /* ---- the centrepiece: twelve months of squares ------------------------------------- */
    function levels(vals) {
      // Quartile ramp, not a linear one. Daily demand is heavily skewed — a handful of
      // month-end Saturdays would flatten every ordinary week to the palest shade on a linear
      // scale, which is exactly the detail this page is for.
      const v = vals.filter(x => x > 0).sort((a, b) => a - b);
      if (!v.length) return [];
      const q = p => v[Math.min(v.length - 1, Math.floor(p * v.length))];
      return [q(0.25), q(0.5), q(0.75)];
    }
    const OPACITY = [0, 0.22, 0.44, 0.68, 1];
    // The matrix prints a number inside each cell, so its ramp stops well short of a solid
    // fill — a figure nobody can read is worse than a slightly flatter scale.
    const MX_OPACITY = [0, 0.12, 0.28, 0.46, 0.66];
    function levelOf(v, cuts) {
      if (!(v > 0)) return 0;
      if (!cuts.length) return 4;
      return v <= cuts[0] ? 1 : v <= cuts[1] ? 2 : v <= cuts[2] ? 3 : 4;
    }

    function calendarCard(days) {
      const M = METRIC[S.metric];
      const cuts = levels([...days.values()].map(M.get));
      const y = +S.year;
      let cal = "";
      for (let m = 0; m < 12; m++) {
        const first = new Date(Date.UTC(y, m, 1));
        const lead = (first.getUTCDay() + 6) % 7;             // grid starts on Monday
        const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        let cells = WD.map(w => '<div class="wh">' + w[0] + "</div>").join("");
        for (let i = 0; i < lead; i++) cells += '<div class="dm-c pad"></div>';
        for (let dd = 1; dd <= n; dd++) {
          const iso = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
          const d = days.get(iso);
          const v = d ? M.get(d) : 0;
          const lv = levelOf(v, cuts);
          const share = d && d.leads ? Math.min(1, d.booked / d.leads) : 0;
          cells += '<div class="dm-c' + (iso > TODAY ? " ahead" : "")
            + (S.day === iso ? " on" : "") + '" data-day="' + iso + '">'
            + (lv ? '<i class="lv" style="opacity:' + OPACITY[lv] + '"></i>' : "")
            + (share > 0 ? '<i class="bk" style="height:' + (share * 100).toFixed(0) + '%"></i>' : "")
            + "</div>";
        }
        cal += '<div class="dm-mon"><div class="ml">' + MONL[m] + '</div><div class="dm-wk">'
          + cells + "</div></div>";
      }
      const legSw = OPACITY.slice(1).map(o => '<i style="opacity:' + o + '"></i>').join("");
      return '<div class="dm-card"><div class="dm-h"><h3>Demand calendar — ' + esc(S.year)
        + '</h3><span class="tag">by move date</span>'
        + '<span class="rt">' + esc(M.lab) + " · one square a day</span></div>"
        + '<p class="dm-note">Each square is a date somebody wanted to move on. The shading is '
        + "<b>" + esc(M.lab.toLowerCase()) + "</b>; the blue foot is the share of that day's leads "
        + "we confirmed. A dashed square is a date <b>still ahead of us</b> — demand for it is "
        + "still arriving, so a pale future square means nothing yet. Hover for the day, click to "
        + "pin it below.</p>"
        + '<div class="dm-cal">' + cal + "</div>"
        + '<div class="dm-leg"><span>Less <span class="sw">' + legSw + '</span> more</span>'
        + '<span><span class="bl"></span> booked share of the day</span>'
        + "<span>Dashed border = date still ahead of us</span></div>"
        + dayDetail(days) + "</div>";
    }

    function dayDetail(days) {
      if (!S.day) return "";
      const d = days.get(S.day);
      if (!d) {
        return '<div class="dm-day"><div class="dh"><b>' + esc(longDate(S.day)) + "</b>"
          + "<span>" + (leadFilterOn() ? "no leads match the current filters on this date"
              : S.day > TODAY ? "nobody has asked for this date yet"
              : "no lead ever asked for this date") + "</span>"
          + '<button data-close="1">Close</button></div></div>';
      }
      const f = (l, v, s) => '<div class="dm-f"><div class="l">' + esc(l) + '</div><div class="v">'
        + esc(v) + '</div><div class="s">' + esc(s || "") + "</div></div>";
      const topOf = obj => { const l = mixList(obj); return l.length ? l[0].k + " · " + l[0].n : "—"; };
      return '<div class="dm-day"><div class="dh"><b>' + esc(longDate(S.day)) + "</b>"
        + "<span>" + fmtN(d.leads) + " leads · " + fmtN(d.booked) + " booked · "
        + dash(bookRate(d), pct) + " of qualified</span>"
        + '<button data-close="1">Close</button></div>'
        + '<div class="dm-facts">'
        + f("Cubic feet asked", d.cfN ? fmtN(d.cf) : "—",
            d.cfN ? fmtN(d.cfN) + " of " + fmtN(d.leads) + " leads stated one" : "none stated")
        + f("Average quote", dash(avgQuote(d), money0), fmtN(d.qN) + " leads quoted")
        + f("Quote per cu ft", dash(perCF(d), money2), fmtN(d.pn) + " leads priced")
        + f("Crew asked for", dash(avgCrew(d), fmt1), dash(avgTrucks(d), v => fmt1(v) + " trucks"))
        + f("Booked at closing", d.ct ? money0(d.ct) : "—", "Moveboard's own closing total")
        + f("Asked this far ahead", dash(leadDays(d), v => fmt1(v) + " days"), "from lead to move date")
        + f("Move type", d.ld + " long / " + d.local + " local",
            d.svcUnknown ? d.svcUnknown + " unmapped" : "")
        + f("Biggest market", topOf(d.st), "pickup state")
        + f("Top service", topOf(d.svc), "")
        + f("Top size", topOf(d.size), "")
        + "</div>" + dayLeadsTable() + "</div>";
    }

    /* the leads behind the pinned day — his ask: "ლიდების სია დაჭერაზე" */
    function dayLeadsTable() {
      if (!S.leads) {
        return '<p class="dm-note" style="margin-top:10px">'
          + (S.leadsErr ? "Per-lead detail unavailable — " + esc(S.leadsErr)
             : "The lead list for this day is still loading…") + "</p>";
      }
      const CAPN = 300;
      const ls = scopeLeads().filter(l => l.d === S.day)
        .sort((a, b) => String(a.cd).localeCompare(String(b.cd)));
      if (!ls.length) return '<p class="dm-note" style="margin-top:10px">No leads match the '
        + "current filters on this day.</p>";
      return '<div class="dm-scroll" style="margin-top:12px;max-height:46vh;overflow:auto">'
        + '<table class="dm-t dm-lead-tbl"><thead><tr><th>Came in</th><th>Moveboard #</th>'
        + "<th>Customer</th><th>Status</th><th>Source</th><th>Size</th><th>Cu ft</th>"
        + "<th>Quote</th></tr></thead><tbody>"
        + ls.slice(0, CAPN).map(l =>
            '<tr><td class="nm">' + esc(String(l.cd).slice(0, 16) || "—") + "</td>"
            + "<td>#" + esc(String(l["Job No"] || "—")) + "</td>"
            + '<td style="text-align:left">' + esc(l.Customer || "—") + "</td>"
            + "<td" + (l.Status === "Confirmed" ? ' style="color:var(--blue);font-weight:700"' : "")
            + ">" + esc(l.Status || "—") + "</td>"
            + "<td>" + esc(l.Source || "—") + "</td>"
            + "<td>" + esc(l.Size || "—") + "</td>"
            + "<td>" + (nn(l.CF) != null ? fmtN(l.CF) : "—") + "</td>"
            + "<td>" + (nn(l.Quote) != null ? money0(l.Quote) : "—") + "</td></tr>").join("")
        + "</tbody></table>"
        + (ls.length > CAPN ? '<p class="dm-note">' + fmtN(ls.length - CAPN) + " more on this day.</p>" : "")
        + "</div>";
    }

    /* ---- his #5: once a day passed X jobs, how many leads still came in ------------------
       There is no timestamp for the moment a booking was CONFIRMED (`Booked Date` is
       written date-like on every lead and is not a booking signal — the warehouse's own
       rule), so the moment a day "reached X jobs" is approximated by the CREATION time of
       its Xth eventually-confirmed lead. Bookings usually follow their lead quickly, so
       the approximation is honest — and it is stated on the card, not hidden. */
    function ordinal(n) {
      const t = n % 100;
      if (t >= 11 && t <= 13) return n + "th";
      return n + ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th");
    }
    function overflowCard() {
      if (!S.leads) {
        return '<div class="dm-card"><div class="dm-h"><h3>Demand after a day was already full</h3>'
          + '<span class="tag">capacity</span></div><div class="dm-empty">'
          + (S.leadsErr ? "Per-lead detail unavailable — " + esc(S.leadsErr)
             : "Loading the per-lead detail…") + "</div></div>";
      }
      const X = Math.max(1, Math.round(S.cap || 10));
      const byD = new Map();
      scopeLeads().forEach(l => {
        if (!byD.has(l.d)) byD.set(l.d, []);
        byD.get(l.d).push(l);
      });
      const hit = [];
      let afterAll = 0, afterBooked = 0, afterLost = 0;
      byD.forEach((ls, d) => {
        // THE FUTURE IS NOT EVIDENCE (the page's own rule, and the portal's): a date still
        // ahead of us is still filling — its open leads are pipeline, not lost demand
        if (d > TODAY) return;
        // creation-time order, tie-broken by lead # so bulk imports with one timestamp
        // cannot flip which side of the cut a lead lands on between rebuilds
        const keyOf = l => String(l.cd) + "|" + String(l["Job No"] || "");
        ls.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
        const bookedKeys = ls.filter(l => l.Status === "Confirmed" && l.cd).map(keyOf);
        if (bookedKeys.length < X) return;
        const cut = bookedKeys[X - 1];
        const after = ls.filter(l => l.cd && keyOf(l) > cut);
        const ab = after.filter(l => l.Status === "Confirmed").length;
        const al = after.filter(l => l.Status !== "Confirmed" && l.Status !== "Bad Lead").length;
        afterAll += after.length; afterBooked += ab; afterLost += al;
        hit.push({ d, booked: bookedKeys.length, after: after.length, ab, al });
      });
      hit.sort((a, b) => b.after - a.after);
      const k = (b, lab, sub, cls) => '<div class="dm-k ' + (cls || "") + '"><b>' + esc(b)
        + "</b><span>" + esc(lab) + "</span><small>" + esc(sub) + "</small></div>";
      return '<div class="dm-card"><div class="dm-h"><h3>Demand after a day was already full</h3>'
        + '<span class="tag">capacity</span>'
        + '<span class="rt">a full day = <input type="number" class="dm-cap" id="dmCap" min="1" '
        + 'step="1" value="' + X + '"> booked jobs</span></div>'
        + '<p class="dm-note">For every move date that reached <b>' + X + " booked jobs</b>, this "
        + "counts the leads that arrived <b>after</b> that point — demand we could only have "
        + "taken with more capacity. Dates still ahead of us are excluded: their leads are "
        + "pipeline, not lost demand. The moment a day filled is approximated by when its "
        + ordinal(X) + " eventually-booked lead was created (the warehouse has no "
        + "timestamp for the confirmation itself; `Booked Date` is not usable). Change the "
        + "number to your real daily capacity — it recalculates instantly and respects the "
        + "filters above.</p>"
        + '<div class="dm-kpis">'
        + k(fmtN(hit.length), "Days that reached " + X + " bookings", "in this window")
        + k(fmtN(afterAll), "Leads after the day was full", "arrived once " + X + " jobs already stood", afterAll ? "blue" : "")
        + k(fmtN(afterBooked), "…of which we STILL booked", "the day went past " + X + " — capacity was found")
        + k(fmtN(afterLost), "…qualified but never booked", "the demand a bigger fleet could have taken", afterLost ? "blue" : "")
        + "</div>"
        + (hit.length
          ? '<div class="dm-scroll"><table class="dm-t"><thead><tr><th>Move date</th>'
            + "<th>Booked that day</th><th>Leads after #" + X + "</th><th>…booked anyway</th>"
            + "<th>…qualified, never booked</th></tr></thead><tbody>"
            + hit.slice(0, 15).map(x => '<tr data-jump="' + esc(x.d) + '"><td class="nm">'
                + esc(shortDate(x.d)) + "</td><td>" + fmtN(x.booked) + "</td><td>"
                + fmtN(x.after) + "</td><td>" + fmtN(x.ab) + "</td><td>" + fmtN(x.al)
                + "</td></tr>").join("")
            + "</tbody></table></div>"
          : '<div class="dm-empty">No day in this window reached ' + X + " bookings.</div>")
        + "</div>";
    }

    /* ---- weekday x month ---------------------------------------------------------------- */
    function matrixCard(days) {
      const y = +S.year;
      // Averages, not totals: a month with five Saturdays would otherwise beat a month with
      // four for reasons that have nothing to do with demand.
      const sum = {}, occ = {};
      const curY = String(new Date().getFullYear());
      // Dates nobody could have asked for yet would drag the average down for no reason, so
      // the current year stops at today. A year entirely in the future has no such cut to
      // make — every one of its dates is still filling, and the note says so.
      const cutoff = S.year === curY ? TODAY : "9999-12-31";
      const aheadYear = S.year > curY;
      let future = 0;
      for (let m = 0; m < 12; m++) {
        const n = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        for (let dd = 1; dd <= n; dd++) {
          const iso = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(dd).padStart(2, "0");
          if (iso > cutoff) { future++; continue; }
          const w = (new Date(Date.UTC(y, m, dd)).getUTCDay() + 6) % 7;
          const k = w + "|" + m;
          occ[k] = (occ[k] || 0) + 1;
          sum[k] = (sum[k] || 0) + (days.get(iso) ? days.get(iso).leads : 0);
        }
      }
      const cellAvg = (w, m) => { const k = w + "|" + m; return occ[k] ? sum[k] / occ[k] : null; };
      const vals = [];
      for (let w = 0; w < 7; w++) for (let m = 0; m < 12; m++) {
        const v = cellAvg(w, m); if (v != null) vals.push(v);
      }
      const cuts = levels(vals);
      const rowAvg = w => {
        let s = 0, o = 0;
        for (let m = 0; m < 12; m++) { const k = w + "|" + m; s += sum[k] || 0; o += occ[k] || 0; }
        return o ? s / o : null;
      };
      const colAvg = m => {
        let s = 0, o = 0;
        for (let w = 0; w < 7; w++) { const k = w + "|" + m; s += sum[k] || 0; o += occ[k] || 0; }
        return o ? s / o : null;
      };
      const gridAvg = () => {
        let s = 0, o = 0;
        Object.keys(occ).forEach(k => { s += sum[k] || 0; o += occ[k]; });
        return o ? s / o : null;
      };
      let body = "";
      for (let w = 0; w < 7; w++) {
        body += '<tr><th class="rh">' + WD[w] + "</th>";
        for (let m = 0; m < 12; m++) {
          const v = cellAvg(w, m);
          const lv = levelOf(v == null ? 0 : v, cuts);
          body += "<td>" + (lv ? '<i class="lv" style="opacity:' + MX_OPACITY[lv] + '"></i>' : "")
            + "<span>" + (v == null ? "—" : fmt1(v)) + "</span></td>";
        }
        body += '<td class="tot">' + dash(rowAvg(w), fmt1) + "</td></tr>";
      }
      body += '<tr><th class="rh">All</th>'
        + MON.map((lab, m) => '<td class="tot">' + dash(colAvg(m), fmt1) + "</td>").join("")
        + '<td class="tot">' + dash(gridAvg(), fmt1) + "</td></tr>";

      return '<div class="dm-card"><div class="dm-h"><h3>Which weekdays the market wants</h3>'
        + '<span class="tag">by move date</span>'
        + '<span class="rt">average leads per calendar day</span></div>'
        + '<p class="dm-note">Leads per <b>occurrence</b> of that weekday in that month, so a '
        + "five-Saturday month cannot out-rank a four-Saturday one on arithmetic alone. "
        + (future ? "Dates after today are excluded — " + fmtN(future) + " of them in "
            + esc(S.year) + " are still filling. " : "")
        + (aheadYear ? "<b>Every date in " + esc(S.year) + " is still ahead of us</b>, so read "
            + "the shape across weekdays rather than the level: these averages will rise as "
            + "leads arrive. " : "")
        + "A dash means the month has no such day inside the window.</p>"
        + '<div class="dm-scroll"><table class="dm-mx"><thead><tr><th></th>'
        + MON.map(m => "<th>" + m + "</th>").join("") + "<th>All</th></tr></thead><tbody>"
        + body + "</tbody></table></div></div>";
    }

    /* ---- distributions ------------------------------------------------------------------ */
    function bars(list, total) {
      const mx = Math.max.apply(null, list.map(x => x.n)) || 1;
      return '<div class="dm-bars">' + list.map(x =>
        '<div class="dm-b"><div class="lb" title="' + esc(x.k) + '">' + esc(x.k) + "</div>"
        + '<div class="tr"><i style="width:' + (x.n / mx * 100).toFixed(1) + '%"></i>'
        + '</div><div class="vv">' + fmtN(x.n)
        + "<small>" + (total ? Math.round(x.n / total * 100) + "%" : "—") + "</small></div></div>")
        .join("") + "</div>";
    }

    function cfCard(a) {
      // CF Range is the warehouse's own volume band (fct_moveboard `CF Range`) — the same
      // bands the Monthly Report's lead tables use, so the two can be read side by side.
      const list = mixList(a.cfr);
      const cfKey = s => { const m = String(s).match(/\d+/); return m ? +m[0] : Infinity; };
      list.sort((x, y) => cfKey(x.k) - cfKey(y.k));
      return '<div class="dm-card"><div class="dm-h"><h3>How big the asked-for moves are</h3>'
        + '<span class="tag">by move date</span></div>'
        + '<p class="dm-note">Every lead pointing at a date in this window, by its <b>CF Range</b> '
        + "band. Leads with no volume recorded appear as their own band rather than being "
        + "dropped.</p>"
        + (list.length ? bars(list, a.leads) : '<div class="dm-empty">Nothing in this window.</div>')
        + "</div>";
    }

    function sizeCard(a) {
      const list = mixList(a.size);
      const sizeKey = s => { const t = String(s).toLowerCase();
        if (/single item/.test(t)) return 1;
        if (/studio/.test(t)) return 5;
        const m = t.match(/(\d+)\s*(bed|br\b)/); if (m) return 10 * (+m[1]) + (/house/.test(t) ? 1 : 0);
        if (/storage/.test(t)) return 100;
        if (/office/.test(t)) return 101;
        return 200; };
      list.sort((x, y) => sizeKey(x.k) - sizeKey(y.k) || x.k.localeCompare(y.k));
      const tot = a.small + a.mid + a.big + a.other;
      const coarse = [{ k: "Studio or single item", n: a.small }, { k: "1–2 bedroom", n: a.mid },
                      { k: "3+ bedroom", n: a.big }, { k: "Storage, office, unstated", n: a.other }];
      return '<div class="dm-card"><div class="dm-h"><h3>What the market is moving</h3>'
        + '<span class="tag">by move date</span></div>'
        + '<p class="dm-note">Size of Move as the office recorded it, ordered small to large '
        + "(the Monthly Report's own size ordering). The four coarse buckets underneath are the "
        + "same leads grouped by bedroom count.</p>"
        + (list.length ? bars(list, a.leads) : '<div class="dm-empty">Nothing in this window.</div>')
        + (tot ? '<div style="height:11px"></div>' + bars(coarse, tot) : "")
        + "</div>";
    }

    /* ---- peaks + markets ---------------------------------------------------------------- */
    function peakCard(days) {
      const list = [...days.values()].sort((a, b) => b.leads - a.leads).slice(0, 15);
      return '<div class="dm-card"><div class="dm-h"><h3>The dates the market wants most</h3>'
        + '<span class="tag">by move date</span><span class="rt">top 15</span></div>'
        + '<p class="dm-note">Ranked on <b>leads asked</b>, not on what we booked — a date we '
        + "turned away is still a date the market wanted.</p>"
        + (!list.length
            ? '<div class="dm-empty">No move date in this window was asked for at all.</div>'
            : '<div class="dm-scroll"><table class="dm-t"><thead><tr><th>Move date</th><th>Leads</th>'
        + "<th>Booked</th><th>Rate</th><th>Cu ft</th><th>Avg quote</th><th>Top market</th>"
        + "</tr></thead><tbody>"
        + list.map(d => {
            const st = mixList(d.st);
            return '<tr data-jump="' + esc(d.d) + '"><td class="nm">' + esc(shortDate(d.d))
              + "</td><td>" + fmtN(d.leads) + "</td><td>" + fmtN(d.booked) + "</td><td>"
              + dash(bookRate(d), pct) + "</td><td>" + (d.cfN ? fmtN(d.cf) : "—") + "</td><td>"
              + dash(avgQuote(d), money0) + "</td><td>" + esc(st.length ? st[0].k : "—")
              + "</td></tr>";
          }).join("")
        + "</tbody></table></div>")
        + "</div>";
    }

    function marketCard(a) {
      const list = mixList(a.st).slice(0, 12);
      const tot = list.reduce((s, x) => s + x.n, 0);
      const mvTot = a.ld + a.local + a.svcUnknown;
      return '<div class="dm-card"><div class="dm-h"><h3>Where the demand is</h3>'
        + '<span class="tag">by move date</span></div>'
        + '<p class="dm-note">Pickup state, parsed from the lead\'s <b>Moving From</b>. This is '
        + "<b>demand only</b> — the booked split is not carried per state at this grain, so no "
        + "booking rate is shown here rather than one invented from a partial count. "
        + "Destination is not parsed anywhere in the warehouse yet, so there is no "
        + "where-they-are-going cut to give.</p>"
        + (list.length ? bars(list, tot) : '<div class="dm-empty">Nothing in this window.</div>')
        + (mvTot ? '<div style="height:11px"></div>'
            + bars([{ k: "Long distance", n: a.ld }, { k: "Local", n: a.local }]
                     .concat(a.svcUnknown ? [{ k: "Service type unmapped", n: a.svcUnknown }] : []),
                   mvTot) : "")
        + "</div>";
    }

    /* ---- the secondary cut: raw material, no verdict ------------------------------------ */
    function quoteCard(days) {
      const list = [...days.values()].filter(d => d.leads > 0).sort((a, b) => a.leads - b.leads);
      if (list.length < 8) {
        return '<div class="dm-card"><div class="dm-h"><h3>Quote against volume, by how busy the '
          + 'date is</h3><span class="tag">context, not a verdict</span></div>'
          + '<div class="dm-empty">Not enough dates in this window to split into demand levels.</div>'
          + "</div>";
      }
      // Quartiles of DATES, so each band holds the same number of days and the comparison is
      // between like and like.
      const q = Math.ceil(list.length / 4);
      const bands = [
        { lab: "Quietest quarter of dates", rows: list.slice(0, q) },
        { lab: "Below the middle", rows: list.slice(q, 2 * q) },
        { lab: "Above the middle", rows: list.slice(2 * q, 3 * q) },
        { lab: "Busiest quarter of dates", rows: list.slice(3 * q) },
      ].filter(b => b.rows.length);
      const line = b => {
        const a = blank("");
        // days are already folded; add their sums straight into one accumulator
        b.rows.forEach(d => {
          a.leads += d.leads; a.qual += d.qual; a.booked += d.booked;
          a.cf += d.cf; a.cfN += d.cfN;
          a.qSum += d.qSum; a.qN += d.qN; a.pq += d.pq; a.pcf += d.pcf; a.pn += d.pn;
          a.crewSum += d.crewSum; a.crewN += d.crewN;
        });
        const lo = b.rows[0].leads, hi = b.rows[b.rows.length - 1].leads;
        return "<tr><td class='nm'>" + esc(b.lab) + '<div style="font-size:10.5px;color:var(--faint);'
          + "font-weight:500\">" + fmtN(lo) + "–" + fmtN(hi) + " leads a day</div></td><td>"
          + fmtN(b.rows.length) + "</td><td>" + fmtN(a.leads) + "</td><td>"
          + fmt1(a.leads / b.rows.length) + "</td><td>" + (a.cfN ? fmtN(a.cf) : "—") + "</td><td>"
          + dash(avgQuote(a), money0) + "</td><td>" + dash(perCF(a), money2) + "</td><td>"
          + dash(a.pn ? a.pcf / a.pn : null, fmtN) + "</td><td>" + dash(bookRate(a), pct)
          + "</td><td>" + dash(avgCrew(a), fmt1) + "</td></tr>";
      };
      return '<div class="dm-card"><div class="dm-h"><h3>Quote against volume, by how busy the '
        + 'date is</h3><span class="tag">context, not a verdict</span>'
        + '<span class="rt">dates split into four equal groups</span></div>'
        + '<p class="dm-note"><b>This section states nothing and recommends nothing.</b> It sorts '
        + "the dates in this window by how many leads asked for them, cuts them into four equal "
        + "groups, and reports what was quoted per cubic foot in each. <b>Quote per cu ft</b> is "
        + "total quoted dollars over total cubic feet across the leads that carried both — a "
        + "dollar-weighted rate, so it can be compared between groups without a big move in a "
        + "quiet week distorting it. Whether these numbers mean the pricing is right is a "
        + "judgement about the business, and this page does not make it.</p>"
        + '<div class="dm-scroll"><table class="dm-t"><thead><tr><th>Demand level</th><th>Dates</th>'
        + "<th>Leads</th><th>Leads / date</th><th>Cu ft asked</th><th>Avg quote</th>"
        + "<th>Quote / cu ft</th><th>Avg cu ft priced</th><th>Booking rate</th><th>Avg crew</th>"
        + "</tr></thead><tbody>" + bands.map(line).join("") + "</tbody></table></div></div>";
    }

    /* ================================================================= wiring ============== */
    const longDate = iso => {
      const d = new Date(iso + "T00:00:00Z");
      return WD[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + " " + MONL[d.getUTCMonth()]
        + " " + d.getUTCFullYear();
    };
    const shortDate = iso => {
      const d = new Date(iso + "T00:00:00Z");
      return WD[(d.getUTCDay() + 6) % 7] + " " + d.getUTCDate() + " " + MON[d.getUTCMonth()];
    };

    function wire(days) {
      main.querySelectorAll("[data-y]").forEach(b => {
        b.onclick = () => { S.year = b.dataset.y; S.day = null; paint(); };
      });
      main.querySelectorAll("[data-co]").forEach(b => {
        b.onclick = () => { S.co = b.dataset.co; paint(); };
      });
      main.querySelectorAll("[data-m]").forEach(b => {
        b.onclick = () => { S.metric = b.dataset.m; paint(); };
      });
      main.querySelectorAll("[data-lf]").forEach(el => {
        el.onchange = () => { S[el.dataset.lf] = el.value; paint(); };
      });
      const cap = main.querySelector("#dmCap");
      if (cap) cap.onchange = () => {
        S.cap = Math.max(1, Math.round(+cap.value) || S.cap);   // a cleared box keeps the prior X
        try { localStorage.setItem("ztzDemandCap", String(S.cap)); } catch (e) {}
        paint();
        // the repaint destroyed the input mid-interaction; hand focus back so the spinner
        // arrows keep working stroke after stroke
        const c2 = main.querySelector("#dmCap");
        if (c2) c2.focus();
      };
      const close = main.querySelector("[data-close]");
      if (close) close.onclick = () => { S.day = null; paint(); };
      main.querySelectorAll("[data-jump]").forEach(tr => {
        tr.style.cursor = "pointer";
        tr.onclick = () => {
          S.day = tr.dataset.jump;
          paint();
          const c = main.querySelector('.dm-c[data-day="' + S.day + '"]');
          if (c) c.scrollIntoView({ block: "center", behavior: "smooth" });
        };
      });
      // Delegated, not 365 sets of handlers: the calendar is redrawn on every filter click and
      // a year of squares wired three times over is the kind of thing that makes a page feel
      // slow for no visible reason.
      const cal = main.querySelector(".dm-cal");
      if (!cal) return;
      let hovered = null;
      cal.onclick = e => {
        const c = e.target.closest(".dm-c[data-day]");
        if (!c) return;
        S.day = (S.day === c.dataset.day ? null : c.dataset.day);
        paint();
      };
      cal.onmousemove = e => {
        const c = e.target.closest(".dm-c[data-day]");
        if (!c) { hovered = null; tip.classList.remove("on"); return; }
        if (c.dataset.day !== hovered) {
          hovered = c.dataset.day;
          showTip(days.get(hovered), hovered);
        }
        moveTip(e);
      };
      cal.onmouseleave = () => { hovered = null; tip.classList.remove("on"); };
    }

    // The tooltip is rebuilt from the day's data on hover rather than stamped into an
    // attribute at paint time: 365 pre-rendered tooltips is 365 strings nobody reads.
    function showTip(d, iso) {
      const row = (l, v) => '<div class="r"><span>' + esc(l) + "</span><b>" + esc(v) + "</b></div>";
      let h = '<div class="d">' + esc(longDate(iso)) + "</div>";
      if (!d) {
        h += '<div class="r"><span>' + (iso > TODAY ? "not asked for yet" : "no lead asked for this date")
          + "</span></div>";
      } else {
        const st = mixList(d.st), src = mixList(d.src);
        h += row("Leads asked", fmtN(d.leads))
          + row("Booked", fmtN(d.booked) + " · " + dash(bookRate(d), pct))
          + row("Cubic feet", d.cfN ? fmtN(d.cf) : "—")
          + row("Average quote", dash(avgQuote(d), money0))
          + row("Top market", st.length ? st[0].k : "—")
          + row("Top source", src.length ? src[0].k : "—");
      }
      h += '<div class="f">Move-date basis' + (iso > TODAY ? " · still ahead of us" : "") + "</div>";
      tip.innerHTML = h;
      tip.classList.add("on");
    }
    function moveTip(e) {
      const w = tip.offsetWidth || 220, hh = tip.offsetHeight || 140;
      let x = e.clientX + 16, y = e.clientY + 16;
      if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      if (y + hh > window.innerHeight - 8) y = e.clientY - hh - 14;
      tip.style.left = Math.max(8, x) + "px";
      tip.style.top = Math.max(8, y) + "px";
    }

    load();
  },
});
