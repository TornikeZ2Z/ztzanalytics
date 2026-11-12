/* COMPETITOR MAP — who we compete with in each state, where their offices are, and how they do on Google.
 *
 * OFF THE PORTAL since 12 Nov 2026 19:40 (ZTZ-71, his word): index.html no longer loads this file and no
 * department lists it, until Tako has updated her map; then the page is rebuilt from her new version. Its
 * Content gaps tab (Sophie's competitor analysis) is page 6 of Partnership & Strategy now, so drop that tab
 * here when this page comes back.
 *
 * 10 Nov 2026, tracker ZTZ-57. Tako Berikashvili built a "Zip To Zip Competitor Map" as a claude.ai page
 * (the top 5 competitors in each of 8 states, profiles, a social media playbook, a monthly watchlist).
 * His picks the same day: its own Quality Team page; the list LIVES IN THE PORTAL (no sheets); her
 * research plus LIVE Google ratings; drawn on the TARGET MAP'S tiers, not her own city lists.
 *
 *   COMPETITORS  her research, edited here (/api/_competitors -> cmp_competitor, cmp_office, cmp_note):
 *                score, services vs ours, lead sources, sponsorships, partnerships, recent posts
 *   GOOGLE       each office's rating and review count, weekly (src/tako_maps.py -> cmp_google)
 *   COUNTIES     green = has Tier 1 cities, blue = Tier 2 only, from the Target Map's city tiers
 *                (mart_cmp_county_tier). Massachusetts and Virginia have no tiered city there.
 *   TOP ON GOOGLE / WATCHLIST  once a month Google is asked for the movers in every tiered county and
 *                every county a competitor has an office in (cmp_scan). Movers not on the list with the
 *                most reviews, and the fastest growing month on month, are the watchlist.
 *   RANK         a state's competitors are her records for that state (key "nj-04"; one added here follows
 *                its offices), by her score, then by Google reviews. Her scores are research estimates.
 *   LAYOUT       11 Nov, ZTZ-71: the Map tab follows Tako's FINAL map (his pick "her layout, keep our
 *                extras"): the state alone, its top 5 only, a county pane with "Open gap", her profile.
 *                Who works in a county = office county + the counties of the cities she says they serve
 *                (the bridge places each city in its county: /api/_competitors "places").
 *   CONTENT GAPS 12 Nov, ZTZ-68: Sophie's competitor analysis (her 25 competitors in five states, ten
 *                layers) as a tab, drawn by pages/ecosystem.js from a snapshot of her page. The page is
 *                listed under Marketing too (his pick), so her team opens it from there.
 */
(function () {
  if (window.RS && RS.DATASETS) {
    const D = RS.DATASETS;
    if (!D.cmp_google) D.cmp_google = { table: "cmp_google",
      cols: ["Date", "Office Key", "Place Id", "Name", "Address", "Rating", "Reviews", "Latitude", "Longitude", "Status"] };
    if (!D.cmp_scan) D.cmp_scan = { table: "cmp_scan",
      cols: ["Month", "State", "County", "Rank", "Place Id", "Name", "Address", "Rating", "Reviews", "Latitude", "Longitude"] };
    if (!D.cmp_pull) D.cmp_pull = { table: "cmp_pull", cols: ["Date", "Kind", "Calls"] };
    if (!D.cmp_county_tier) D.cmp_county_tier = { table: "mart_cmp_county_tier",
      cols: ["State", "County", "Tier 1 Cities", "Tier 2 Cities", "Tier 3 Cities", "Best Tier", "Tier 1 List", "Tier 2 List"] };
  }
})();

(() => {
  const STATES = ["NJ", "NY", "PA", "CT", "DE", "MA", "MD", "VA"];
  const SNAME = { NJ: "New Jersey", NY: "New York", PA: "Pennsylvania", CT: "Connecticut", DE: "Delaware",
                  MA: "Massachusetts", MD: "Maryland", VA: "Virginia" };
  const TYPE_COL = { Local: "#16A34A", Regional: "#EA580C", National: "#B91C1C" };
  const FREE = 1000;   // Places API Enterprise calls free a month, per SKU
  const ckey = v => String(v == null ? "" : v).toLowerCase().trim()
    .replace(/saint /g, "st ").replace(/st\. /g, "st ")
    .replace(/\b(county|parish|city and borough|borough|census area|municipality)\b/g, "")
    .replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();

  function injectStyle() {
    const old = document.getElementById("cmpm-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "cmpm-style";
    st.textContent = ""
      + ".cmpm{font-variant-numeric:tabular-nums}"
      + ".cmpm-states{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 12px}"
      + ".cmpm-grid{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:14px;align-items:start}"
      + "@media (max-width:1150px){.cmpm-grid{grid-template-columns:1fr}}"
      + ".cmpm-side{display:flex;flex-direction:column;gap:12px}"
      + ".cmpm-side h3{margin:0 0 6px;font-size:15px}"
      + ".cmpm-side .sub{font-size:12.5px;color:var(--muted);line-height:1.45}"
      + ".cmpm-chips{display:flex;gap:6px;flex-wrap:wrap}"
      + ".cmpm-chip{border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12.5px;cursor:pointer;background:var(--panel)}"
      + ".cmpm-chip:hover{border-color:var(--ink)}"
      + ".cmpm-card{display:grid;grid-template-columns:34px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 11px;"
      + "border:1px solid var(--line);border-radius:10px;cursor:pointer;background:var(--panel)}"
      + ".cmpm-card:hover,.cmpm-card.on{border-color:var(--ink)}"
      + ".cmpm-card .n{font-weight:800;color:var(--muted)}"
      + ".cmpm-card b{font-size:13.5px;line-height:1.3}"
      + ".cmpm-card small{display:block;font-size:12px;color:var(--muted)}"
      + ".cmpm-card .s{font-weight:800;font-size:15px}"
      + ".cmpm-prof dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;font-size:13px}"
      + ".cmpm-prof dt{color:var(--muted);font-weight:600}"
      + ".cmpm-prof dd{margin:0;white-space:pre-wrap;line-height:1.45}"
      + ".cmpm-star{color:#B45309;font-weight:700}"
      + ".cmpm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;margin:6px 0 10px}"
      + ".cmpm-form .wide{grid-column:1/-1}"
      + ".cmpm-form textarea{min-height:70px;width:100%}"
      + ".cmpm-err{color:#B3261E;font-size:12.5px;margin:6px 2px}"
      + ".cmpm-ok{color:#3F7D20;font-size:12.5px;margin:6px 2px}"
      + ".cmpm-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".cmpm-x{border:0;background:none;color:#B3261E;cursor:pointer;font-size:12.5px;padding:0 4px}"
      + ".cmpm-play{white-space:pre-wrap;line-height:1.55;font-size:13.5px}"
      // TAKO'S LAYOUT (ZTZ-71, 11 Nov): the state alone, solid county fills, typed markers, one side pane
      + ".cmpm-mapcard{border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}"
      + ".cmpm-mapbar{display:flex;gap:14px;flex-wrap:wrap;align-items:center;padding:9px 12px;border-bottom:1px solid var(--line);font-size:12.5px}"
      + ".cmpm-mapbar label{display:inline-flex;align-items:center;gap:5px;cursor:pointer;white-space:nowrap}"
      + ".cmpm-mapbar i{display:inline-block;width:12px;height:12px;border-radius:2px}"
      + ".cmpm-mapbar input[type=search]{margin-left:auto;width:190px}"
      + ".cmpm-cmap{height:min(74vh,700px);min-height:480px;background:#EEF2F7}"
      + "body.rs-app:not(.light) .cmpm-cmap{background:#131A24}"
      + ".cmpm-foot{font-size:11.5px;color:var(--muted);padding:7px 12px;border-top:1px solid var(--line)}"
      // .leaflet-tooltip comes later in the page, so the label rule needs its weight to win
      + ".leaflet-tooltip.cmpm-lbl{background:transparent;border:0;box-shadow:none;padding:0;font:700 11px/1.1 system-ui,sans-serif;"
      + "color:#0F172A;text-shadow:0 0 3px #fff,0 0 3px #fff,0 0 2px #fff;pointer-events:none}"
      + ".leaflet-tooltip.cmpm-lbl:before{display:none}"
      + ".leaflet-tooltip.cmpm-lbl.dk{color:#E2E8F0;text-shadow:0 0 3px #0B1220,0 0 3px #0B1220,0 0 2px #0B1220}"
      + ".cmpm-mk{position:relative;width:18px;height:18px}"
      + ".cmpm-mk svg{display:block;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.45))}"
      + ".cmpm-mk span{position:absolute;left:13px;top:-10px;font:800 10px/1 system-ui,sans-serif;color:#0F172A;background:#fff;"
      + "border-radius:4px;padding:2px 3px;box-shadow:0 0 0 1px rgba(15,23,42,.3)}"
      + ".cmpm-mk.on span{background:#0F172A;color:#fff}"
      + ".cmpm-pane{max-height:calc(min(74vh,700px) + 92px);overflow-y:auto;overflow-x:hidden;overflow-wrap:anywhere}"
      + ".cmpm-pane h3{margin:16px 0 7px;font-size:14px}"
      + ".cmpm-cap{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}"
      + ".cmpm-h{margin:3px 0 4px;font-size:20px;line-height:1.2}"
      + ".cmpm-back{display:inline-block;font-size:12.5px;color:var(--muted);cursor:pointer;margin-bottom:8px}"
      + ".cmpm-back:hover{color:var(--ink)}"
      + ".cmpm-link{font-size:12.5px;color:var(--brand,#3F7D20);cursor:pointer;font-weight:600}"
      + ".cmpm-top{display:inline-block;font-size:9.5px;font-weight:800;letter-spacing:.04em;background:#0F172A;color:#fff;"
      + "border-radius:3px;padding:1px 4px;margin-left:4px;vertical-align:1px}"
      + "body.rs-app:not(.light) .cmpm-top{background:#E2E8F0;color:#0F172A}"
      + ".cmpm-badges{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 2px}"
      + ".cmpm-badges span{font-size:11.5px;font-weight:700;border-radius:999px;padding:3px 9px}"
      + ".cmpm-badges .b1{background:#1D4ED8;color:#fff}.cmpm-badges .b2{background:#BFDBFE;color:#1E3A8A}"
      + ".cmpm-badges .gap{background:#DCFCE7;color:#166534}.cmpm-badges .b0{background:#E2E8F0;color:#334155}"
      + ".cmpm-pb{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-top:12px;cursor:pointer}"
      + ".cmpm-pb:hover{border-color:var(--ink)}.cmpm-pb b{font-size:13.5px}.cmpm-pb small{display:block;color:var(--muted);font-size:12px}"
      + ".cmpm-pb em{margin-left:auto;font-style:normal;font-size:12.5px;color:var(--muted);white-space:nowrap}"
      + ".cmpm-svc{display:flex;gap:5px;flex-wrap:wrap}"
      + ".cmpm-svc span{font-size:12px;border-radius:6px;padding:3px 7px}"
      + ".cmpm-svc .y{background:#DCFCE7;color:#166534}.cmpm-svc .n{background:#FEE2E2;color:#991B1B}"
      + ".cmpm-ev{font-size:12.5px;line-height:1.45;padding:7px 9px;border:1px solid var(--line);border-radius:8px;margin-bottom:5px}"
      + ".cmpm-p{font-size:13px;line-height:1.5;margin:0 0 6px}"
      + ".cmpm-why{font-size:11.5px;color:var(--muted);display:block}"
      + ".cmpm-pane details{margin-top:14px;font-size:12.5px}.cmpm-pane summary{cursor:pointer;font-weight:600}";
    document.head.appendChild(st);
  }

  registerPage({
    id: "competitor-map",
    group: "reviews",
    title: "Competitor Map",
    subtitle: "Our competitors in each state: where their offices are, how they do on Google, and what we know about them.",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);
      const S = window.__CMPM || (window.__CMPM = { st: "NJ", tab: "map", sel: null, county: null, err: "", msg: "", edit: null });
      injectStyle();
      host.innerHTML = '<div class="panel">Loading the Competitor Map…</div>';

      let ST = { competitors: [], offices: [], notes: [] };
      let G = [], SCAN = [], PULL = [], TIER = [];
      let MAP = null, GEO = null;

      const load = () => Promise.all([
        ZTZ.api("/api/_competitors"),
        RS.load("cmp_google").catch(() => []), RS.load("cmp_scan").catch(() => []),
        RS.load("cmp_pull").catch(() => []), RS.load("cmp_county_tier").catch(() => []),
      ]).then(([st, g, sc, pu, ti]) => { ST = st || ST; G = g || []; SCAN = sc || []; PULL = pu || []; TIER = ti || []; });

      load().then(() => { if (alive()) paint(); }).catch(e => {
        if (!alive()) return;
        const m = String(e && e.message || e);
        host.innerHTML = '<div class="panel">' + (m.indexOf("table_missing") >= 0
          ? "The Competitor Map's tables arrive with the first weekly run." : "Could not load — " + esc(m)) + "</div>";
      });

      function post(body) {
        return fetch(ZTZ.API + "/api/_competitors", {
          method: "POST",
          headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => r.json().catch(() => ({})).then(j => {
          if (!r.ok || j.error) {
            if (j && j.code === "view_as_readonly") throw new Error("preview mode — nothing is saved while viewing as someone else");
            throw new Error(j.error || ("HTTP " + r.status));
          }
          ST = j;
        }));
      }

      /* ---- the model ------------------------------------------------------------------------- */
      const num = v => (v == null || v === "") ? null : +v;
      function model() {
        // each office's latest Google answer
        const gl = {};
        G.slice().sort((a, b) => String(a["Date"]).localeCompare(String(b["Date"])))
          .forEach(r => { if (r["Status"] === "ok") gl[r["Office Key"]] = r; });
        const comps = {};
        ST.competitors.forEach(c => { comps[c["Competitor Key"]] = Object.assign({ offices: [], reviews: 0, rsum: 0 }, c); });
        const offices = ST.offices.filter(o => comps[o["Competitor Key"]]).map(o => {
          const g = gl[o["Office Key"]] || null;
          const lat = num(o["Latitude"]) != null ? num(o["Latitude"]) : g && num(g["Latitude"]);
          const lng = num(o["Longitude"]) != null ? num(o["Longitude"]) : g && num(g["Longitude"]);
          return Object.assign({}, o, { g, lat, lng });
        });
        offices.forEach(o => {
          const c = comps[o["Competitor Key"]];
          c.offices.push(o);
          if (o.g && o.g["Reviews"] != null) { c.reviews += +o.g["Reviews"]; c.rsum += (+o.g["Rating"] || 0) * (+o.g["Reviews"]); }
        });
        Object.values(comps).forEach(c => { c.rating = c.reviews ? c.rsum / c.reviews : null; });
        // WHERE THEY OPERATE (ZTZ-71, Tako's layout): a record is one state's ("nj-04"; a record added here
        // follows its offices), and works in its office's county plus the counties of the Tier 1 / Tier 2
        // cities her research says it serves (the bridge places each city in its county, ST.places)
        const places = ST.places || {};
        Object.values(comps).forEach(c => {
          const m = /^([a-z]{2})-\d+$/.exec(String(c["Competitor Key"] || ""));
          c.states = new Set(m ? [m[1].toUpperCase()] : c.offices.map(o => o["State"]).filter(Boolean));
          c.cities = [];
          String(c["Notes"] || "").replace(/^Tier [12] cities they serve:[ \t]*(.+)$/gm, (all, l) => {
            l.split(",").forEach(x => { x = x.trim(); if (x && c.cities.indexOf(x) < 0) c.cities.push(x); }); return all; });
          c.cover = {};
          const add = (k, why) => { (c.cover[k] = c.cover[k] || []).push(why); };
          c.offices.forEach(o => { if (o["State"] && o["County"]) add(o["State"] + "|" + ckey(o["County"]), "office in " + (o["City"] || o["County"])); });
          c.states.forEach(st => c.cities.forEach(city => {
            const cty = places[st + "|" + city.toLowerCase()];
            if (cty) add(st + "|" + ckey(cty), city);
          }));
        });
        const ours = new Set(offices.map(o => (o["Place Id"] || (o.g && o.g["Place Id"]) || "")).filter(Boolean));
        // the scan: latest month and the one before
        const months = Array.from(new Set(SCAN.map(r => String(r["Month"]).slice(0, 10)))).sort();
        const cur = months[months.length - 1] || null, prev = months[months.length - 2] || null;
        const placeOf = m => { const o = {}; SCAN.filter(r => String(r["Month"]).slice(0, 10) === m).forEach(r => {
          const k = r["Place Id"]; const x = o[k] || (o[k] = Object.assign({}, r, { counties: [] }));
          x.counties.push(r["County"] + " " + r["State"]); }); return o; };
        const scanNow = cur ? placeOf(cur) : {}, scanPrev = prev ? placeOf(prev) : {};
        const tier = {};
        TIER.forEach(t => { tier[t["State"] + "|" + ckey(t["County"])] = t; });
        const month = new Date().toISOString().slice(0, 7);
        const calls = {};
        PULL.filter(p => String(p["Date"]).slice(0, 7) === month).forEach(p => { calls[p["Kind"]] = (calls[p["Kind"]] || 0) + (+p["Calls"] || 0); });
        return { comps, offices, ours, scanNow, scanPrev, cur, prev, tier, calls };
      }
      // a state's list, by her score (her ranks follow it in every state: checked 11 Nov), then Google reviews.
      // The top 5 are the five best scores, so an edited score moves a competitor in or out of the map.
      function ranked(M, st) {
        return Object.values(M.comps).filter(c => c.states.has(st))
          .sort((a, b) => (num(b["Score"]) || -1) - (num(a["Score"]) || -1) || b.reviews - a.reviews);
      }
      const TOP = 5;
      const operatesIn = (c, st, county) => c.cover[st + "|" + ckey(county)] || null;

      /* ---- painting --------------------------------------------------------------------------- */
      const fmt = n => n == null ? "—" : Number(n).toLocaleString();
      const stars = (r, n) => r == null ? '<span class="dim">no Google data yet</span>'
        : '<span class="cmpm-star">' + Number(r).toFixed(1) + "★</span> / " + fmt(n) + " reviews";

      function paint() {
        if (!alive()) return;
        const M = model();
        let h = '<div class="cmpm">';
        // CONTENT GAPS (ZTZ-68, 12 Nov, his pick): Sophie's competitor analysis as a tab; it has its own five-state
        // filter, so the map's eight state toggles step aside there (pages/ecosystem.js draws it)
        const gapsTab = S.tab === "gaps";
        h += '<div class="cmpm-states">' + (gapsTab ? "" : STATES.map(s => '<div class="rs-tog' + (S.st === s ? " on" : "") + '" data-cst="' + s + '"><i></i>'
          + s + "</div>").join("")) + '<span class="rs-spacer"></span>'
          + [["map", "Map"], ["google", "Top on Google"], ["gaps", "Content gaps"], ["playbook", "Social playbook"], ["edit", "Edit"]].map(([k, l]) =>
            '<div class="rs-tog' + (S.tab === k ? " on" : "") + '" data-ctab="' + k + '"><i></i>' + l + "</div>").join("") + "</div>";
        if (S.err) h += '<div class="cmpm-err">' + esc(S.err) + "</div>";
        if (S.msg) h += '<div class="cmpm-ok">' + esc(S.msg) + "</div>";
        if (S.tab === "map") h += mapView(M);
        else if (S.tab === "google") h += googleView(M);
        else if (gapsTab) h += '<div id="cmpmGaps"></div>';
        else if (S.tab === "playbook") h += playbookView(M);
        else h += editView(M);
        const used = (M.calls.details || 0) + (M.calls.find || 0) + (M.calls.scan || 0);
        if (!gapsTab) h += '<p class="cmpm-note">Google lookups this month: ' + fmt(M.calls.details || 0) + " office checks, "
          + fmt((M.calls.scan || 0) + (M.calls.find || 0)) + " searches (" + FREE.toLocaleString() + " of each are free a month)."
          + (used ? "" : " Nothing has been looked up yet: the first weekly run fills it in.") + "</p>";
        h += "</div>";
        if (MAP) { try { MAP.remove(); } catch (e) { /* gone with the old DOM */ } MAP = null; }
        host.innerHTML = h;
        const gh = host.querySelector("#cmpmGaps");
        if (gh) { if (window.ECO && ECO.renderGaps) ECO.renderGaps(gh, paint); else gh.innerHTML = '<div class="panel">The content gaps did not load.</div>'; }
        wire(M);
      }

      /* THE MAP TAB = TAKO'S FINAL LAYOUT (ZTZ-71, his pick 11 Nov "her layout, keep our extras"): one state
       * drawn alone with solid county fills and county names, only its top 5 as typed markers (● local,
       * ■ regional, ▲ national) with their rank, tick-boxes for each layer and a county search. One side pane
       * that is the state (playbook card, contested counties, the top 5, ranks 6-20 on request, the watchlist),
       * a county (its tiers, who of the top 5 works there or "Open gap") or a competitor (her profile). */
      const TYPE_LABEL = { Local: "Local mover", Regional: "Regional mover", National: "National brand" };
      function shape(type, size, ring) {
        const col = TYPE_COL[type] || "#64748B", s = size || 18, w = ring ? 2.5 : 2, sc = ring ? "#0F172A" : "#fff";
        const body = type === "National" ? '<polygon points="9,1.5 17,16 1,16" '
          : type === "Regional" ? '<rect x="2" y="2" width="14" height="14" rx="2" ' : '<circle cx="9" cy="9" r="7" ';
        return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 18 18" aria-hidden="true" style="vertical-align:-' + Math.round(s / 5)
          + 'px">' + body + 'fill="' + col + '" stroke="' + sc + '" stroke-width="' + w + '"/></svg>';
      }
      if (!S.lay) S.lay = { t1: true, t2: true, Local: true, Regional: true, National: true };
      const scoreTxt = c => (c["Score"] != null ? Number(c["Score"]).toFixed(1) : "—");
      const cityIn = (c, st) => c.offices.filter(o => o["State"] === st).map(o => o["City"]).filter(Boolean)[0]
        || (c.offices[0] && c.offices[0]["City"]) || "";
      function card(c, rank, st, why) {
        return '<div class="cmpm-card' + (S.sel === c["Competitor Key"] ? " on" : "") + '" data-csel="' + esc(c["Competitor Key"])
          + '"><span class="n">#' + rank + "</span><div><b>" + shape(c["Type"], 12) + " " + esc(c["Name"])
          + (rank <= TOP ? '<span class="cmpm-top">TOP 5</span>' : "") + "</b><small>"
          + esc([TYPE_LABEL[c["Type"]] || c["Type"], cityIn(c, st)].filter(Boolean).join(" · ")) + " · " + stars(c.rating, c.reviews)
          + (why ? '<span class="cmpm-why">' + esc(why) + "</span>" : "") + '</small></div><span class="s">' + scoreTxt(c) + "</span></div>";
      }
      // counties of a state: Target Map tiers, and how many of the top 5 work in each
      function stateFacts(M, st) {
        const list = ranked(M, st), top = list.slice(0, TOP);
        const tiers = TIER.filter(t => t["State"] === st);
        const per = {};
        top.forEach(c => Object.keys(c.cover).forEach(k => { if (k.indexOf(st + "|") === 0) per[k] = (per[k] || 0) + 1; }));
        const nameOf = {};
        tiers.forEach(t => { nameOf[st + "|" + ckey(t["County"])] = t["County"]; });
        M.offices.forEach(o => { if (o["State"] === st && o["County"]) nameOf[st + "|" + ckey(o["County"])] = nameOf[st + "|" + ckey(o["County"])] || o["County"]; });
        Object.entries(ST.places || {}).forEach(([k, v]) => {
          if (k.split("|")[0] === st) nameOf[st + "|" + ckey(v)] = nameOf[st + "|" + ckey(v)] || v; });
        const contested = Object.entries(per).sort((a, b) => b[1] - a[1] || String(nameOf[a[0]]).localeCompare(String(nameOf[b[0]])))
          .slice(0, 10).map(([k, n]) => [nameOf[k] || k.split("|")[1], n]);
        const t1 = tiers.reduce((a, t) => a + (+t["Tier 1 Cities"] || 0), 0);
        const t2 = tiers.reduce((a, t) => a + (+t["Tier 2 Cities"] || 0), 0);
        const open = tiers.filter(t => (+t["Tier 1 Cities"] || 0) > 0 && !per[st + "|" + ckey(t["County"])])
          .reduce((a, t) => a + (+t["Tier 1 Cities"] || 0), 0);
        return { list, top, per, contested, t1, t2, open };
      }

      function mapView(M) {
        const st = S.st;
        const F = stateFacts(M, st);
        let pane;
        if (S.sel && M.comps[S.sel]) pane = profile(M, M.comps[S.sel], st, F);
        else if (S.county) pane = countyPanel(M, st, S.county, F);
        else pane = statePane(M, st, F);
        const counties = GEO && GEO.features ? GEO.features.filter(f => f.properties.st === st).map(f => f.properties.name).sort()
          : TIER.filter(t => t["State"] === st).map(t => t["County"]);
        const tick = (k, label, mark) => '<label><input type="checkbox" data-clay="' + k + '"' + (S.lay[k] ? " checked" : "") + ">" + mark + label + "</label>";
        return '<div class="cmpm-grid"><div class="cmpm-mapcard"><div class="cmpm-mapbar">'
          + tick("t1", "County with Tier 1 cities", '<i style="background:#7CC68D"></i>')
          + tick("t2", "Tier 2 cities only", '<i style="background:#93B4F4"></i>')
          + tick("Local", "Local mover", shape("Local", 13)) + tick("Regional", "Regional mover", shape("Regional", 13))
          + tick("National", "National / van-line", shape("National", 13))
          + '<input type="search" class="rs-inp" id="cmpmFind" list="cmpmCounties" placeholder="Find a county…" aria-label="Find a county">'
          + '<datalist id="cmpmCounties">' + counties.map(n => '<option value="' + esc(n) + '">').join("") + "</datalist></div>"
          + '<div class="cmpm-cmap" id="cmpmMap"></div>'
          + '<div class="cmpm-foot">Green county = has Tier 1 cities on the Target Map · blue = Tier 2 only · #N = rank among ' + esc(st)
          + "'s top 5 · click a county or a marker</div></div>"
          + '<div class="panel cmpm-pane">' + pane + "</div></div>";
      }

      function statePane(M, st, F) {
        const pb = ST.notes.find(n => n["Note Key"] === "playbook");
        let h = '<div class="cmpm-cap">' + esc(SNAME[st]) + '</div><h2 class="cmpm-h">Click a county or office</h2>'
          + '<div class="sub">' + fmt(F.t1) + " Tier 1 and " + fmt(F.t2) + " Tier 2 target cities · " + fmt(F.list.length)
          + " competitor" + (F.list.length === 1 ? "" : "s") + " researched, the top " + Math.min(TOP, F.list.length) + " on the map"
          + (F.t1 ? " · " + fmt(F.open) + " Tier 1 cities in counties none of the top 5 works in" : "") + "</div>";
        if (pb) h += '<div class="cmpm-pb" data-ctab="playbook"><div><b>' + esc(pb["Title"] || "Social media playbook")
          + "</b><small>What competitors post on each platform, what performs, and when they post (ET)</small></div><em>Open →</em></div>";
        if (F.contested.length) h += "<h3>Most contested counties</h3><div class=\"cmpm-chips\">"
          + F.contested.map(([k, n]) => '<span class="cmpm-chip" data-ccounty="' + esc(k) + '">' + esc(k) + " · " + n + "</span>").join("") + "</div>";
        h += "<h3>Top " + Math.min(TOP, F.list.length) + " competitors</h3>"
          + (F.top.length ? '<div class="cmpm-side">' + F.top.map((c, i) => card(c, i + 1, st)).join("") + "</div>"
            : '<div class="sub">No competitor is on ' + esc(SNAME[st]) + "'s list yet. Add them under Edit.</div>");
        if (F.list.length > TOP) h += S.more
          ? "<h3>Ranks " + (TOP + 1) + "–" + F.list.length + '</h3><div class="cmpm-side">' + F.list.slice(TOP).map((c, i) => card(c, TOP + i + 1, st)).join("")
            + '</div><div style="margin-top:8px"><span class="cmpm-link" data-cmore="0">Show the top 5 only</span></div>'
          : '<div style="margin-top:8px"><span class="cmpm-link" data-cmore="1">Show ranks ' + (TOP + 1) + "–" + F.list.length + "</span></div>";
        const watch = watchlist(M, st).slice(0, 5);
        h += "<h3>Watchlist</h3>" + (watch.length ? '<div class="sub">Movers on Google in ' + esc(st) + " that are not on our list"
            + (M.prev ? ", fastest growing first." : ", most reviews first (growth shows from the second monthly scan).") + " Open a county to see its own.</div>"
            + '<table class="rs-table" style="margin-top:6px"><tbody>' + watch.map(w => "<tr><td><b>" + esc(w["Name"]) + '</b><br><small class="dim">'
              + esc(w.counties.slice(0, 3).join(", ")) + "</small></td><td class=\"nowrap\">" + stars(w["Rating"], w["Reviews"])
              + (w.growth != null ? '<br><small class="dim">+' + fmt(w.growth) + " in a month</small>" : "") + "</td></tr>").join("")
            + "</tbody></table>"
          : '<div class="sub">' + (M.cur ? "The monthly Google scan covers no county in " + esc(SNAME[st])
              + " yet: it scans counties with a tiered city on the Target Map and counties a competitor has an office in."
              : "The monthly Google scan has not run yet.") + "</div>");
        return h;
      }

      function countyPanel(M, st, county, F) {
        const t = M.tier[st + "|" + ckey(county)];
        const working = F.list.map((c, i) => [c, i + 1, operatesIn(c, st, county)]).filter(x => x[2]);
        const top = working.filter(x => x[1] <= TOP), rest = working.filter(x => x[1] > TOP);
        const why = w => { const off = w.filter(x => x.indexOf("office in ") === 0), cities = w.filter(x => x.indexOf("office in ") !== 0);
          return [off[0], cities.length ? "serves " + cities.slice(0, 4).join(", ") + (cities.length > 4 ? " +" + (cities.length - 4) : "") : ""].filter(Boolean).join(" · "); };
        const g = Object.values(M.scanNow).filter(p => p["State"] === st && p.counties.some(c => ckey(c.replace(/ [A-Z]{2}$/, "")) === ckey(county)))
          .sort((a, b) => (+b["Reviews"] || 0) - (+a["Reviews"] || 0)).slice(0, 8);
        const n1 = t ? +t["Tier 1 Cities"] || 0 : 0, n2 = t ? +t["Tier 2 Cities"] || 0 : 0;
        return '<span class="cmpm-back" data-cback="county">← Back</span>'
          + '<div class="cmpm-cap">' + esc(st) + (n1 || n2 ? " · Target county" : " · County") + '</div><h2 class="cmpm-h">' + esc(county) + " County</h2>"
          + '<div class="cmpm-badges">' + (n1 ? '<span class="b1">' + fmt(n1) + " Tier 1 cit" + (n1 === 1 ? "y" : "ies") + "</span>" : "")
          + (n2 ? '<span class="b2">' + fmt(n2) + " Tier 2 cit" + (n2 === 1 ? "y" : "ies") + "</span>" : "")
          + (!n1 && !n2 ? '<span class="b0">No tiered city on the Target Map</span>' : "")
          + (!top.length && (n1 || n2) ? '<span class="gap">Open gap</span>' : "") + "</div>"
          + "<h3>Top-5 competitors operating here (by lead score)</h3>"
          + (top.length ? '<div class="cmpm-side">' + top.map(([c, r, w]) => card(c, r, st, why(w))).join("") + "</div>"
            : '<div class="sub">None of ' + esc(SNAME[st]) + "'s top-5 competitors has evidence of operating in this county."
              + (n1 || n2 ? " It is a likely opportunity." : "") + "</div>")
          + (rest.length ? "<h3>Also on our list here (ranks 6–20)</h3><div class=\"cmpm-side\">" + rest.map(([c, r, w]) => card(c, r, st, why(w))).join("") + "</div>" : "")
          + (g.length ? "<h3>Top on Google here</h3>" + g.map(p => '<div class="cmpm-p">' + esc(p["Name"]) + " · "
              + stars(p["Rating"], p["Reviews"]) + (M.ours.has(p["Place Id"]) ? ' <span class="rs-pill ok">on our list</span>' : "") + "</div>").join("") : "")
          + (t && t["Tier 1 List"] ? '<h3>Tier 1 cities</h3><div class="sub">' + esc(t["Tier 1 List"]) + "</div>" : "")
          + (t && t["Tier 2 List"] ? '<h3>Tier 2 cities</h3><div class="sub">' + esc(t["Tier 2 List"]) + "</div>" : "");
      }

      function watchlist(M, st) {
        return Object.values(M.scanNow).filter(p => p["State"] === st && !M.ours.has(p["Place Id"])).map(p => {
          const before = M.scanPrev[p["Place Id"]];
          return Object.assign({}, p, { growth: before && before["Reviews"] != null && p["Reviews"] != null ? (+p["Reviews"]) - (+before["Reviews"]) : null });
        }).sort((a, b) => (M.prev ? (b.growth || 0) - (a.growth || 0) : 0) || (+b["Reviews"] || 0) - (+a["Reviews"] || 0));
      }

      /* HER PROFILE, read from the labelled lines the import wrote ("Why this rank: …", "We both offer: …"); Tako
       * edits them as text under Edit. A field she rewrites without its label still shows, under "Everything". */
      const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const lineOf = (text, label) => { const m = String(text || "").match(new RegExp("^" + reEsc(label) + ":[ \\t]*(.+)$", "m")); return m ? m[1].trim() : ""; };
      const listOf = s => (s ? s.split(/,\s*/).map(x => x.trim()).filter(Boolean) : []);
      // escape first, then link the http(s) addresses: nothing typed can become markup
      const linkify = s => esc(s).replace(/https?:\/\/[^\s<>"]+/g, u => {
        const t = u.match(/(?:&#39;|&quot;|[.,;:)\]])+$/), tail = t ? t[0] : "", url = tail ? u.slice(0, -tail.length) : u;
        return '<a href="' + url + '" target="_blank" rel="noopener">' + url + "</a>" + tail;
      });
      function evidence(text) {
        return String(text || "").split("\n").map(l => l.trim()).filter(l => /^[•\-*]\s/.test(l)).map(l => {
          l = l.replace(/^[•\-*]\s*/, "");
          let url = "";
          const m = l.match(/\s—\s(https?:\/\/\S+)\s*$/);
          if (m) { url = m[1]; l = l.slice(0, m.index); }
          const i = l.indexOf(": ");
          return '<div class="cmpm-ev">' + (i > 0 ? "<b>" + esc(l.slice(0, i)) + "</b> — " + esc(l.slice(i + 2)) : esc(l))
            + (url ? ' <a href="' + esc(url) + '" target="_blank" rel="noopener">evidence</a>' : "") + "</div>";
        }).join("");
      }
      function profile(M, c, st, F) {
        const rank = F.list.indexOf(c) + 1;
        const notes = c["Notes"] || "", serv = c["Services"] || "";
        const offs = c.offices.filter(o => o["State"] === st);
        const o = offs[0] || c.offices[0] || null;
        const pid = o && (o["Place Id"] || (o.g && o.g["Place Id"]));
        const dot = (notes.match(/^USDOT .+$/m) || [""])[0] || (notes.match(/^MC-\d+.*$/m) || [""])[0];
        const ver = lineOf(notes, "Verification");
        const shared = listOf(lineOf(serv, "We both offer")), extra = listOf(lineOf(serv, "They offer, we don't"));
        const pos = lineOf(serv, "Positioning"), diff = lineOf(serv, "How they stand out");
        const row = (k, v) => (v ? "<dt>" + esc(k) + "</dt><dd>" + v + "</dd>" : "");
        let h = '<span class="cmpm-back" data-cback="sel">← Back</span>'
          + '<div class="cmpm-cap">' + [rank && rank <= TOP ? "Top 5" : "", rank ? "Rank #" + rank + " in " + st : "", "Lead score " + scoreTxt(c),
              c["Entered At"] ? "Updated " + String(c["Entered At"]).slice(0, 10) : ""].filter(Boolean).join(" · ") + "</div>"
          + '<h2 class="cmpm-h">' + esc(c["Name"]) + "</h2>"
          + '<div class="cmpm-tags cmpm-chips" style="margin:4px 0 2px"><span class="cmpm-chip" style="cursor:default">' + shape(c["Type"], 11) + " "
          + esc(TYPE_LABEL[c["Type"]] || c["Type"] || "Mover") + "</span>"
          + (/^verified/i.test(ver) ? '<span class="cmpm-chip" style="cursor:default">Verified</span>' : "") + "</div>"
          + '<div class="cmpm-prof"><dl>'
          + row("Main office", esc(o ? [o["Label"], o["Address"]].filter(Boolean).join(", ") || [o["City"], o["State"]].filter(Boolean).join(", ") : ""))
          + row("Phone", esc(c["Phone"] || ""))
          + row("Website", c["Website"] ? '<a href="' + esc(c["Website"]) + '" target="_blank" rel="noopener">' + esc(String(c["Website"]).replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")) + "</a>" : "")
          + row("Reputation", "Google " + stars(c.rating, c.reviews)
              + (pid ? ' · <a href="https://www.google.com/maps/place/?q=place_id:' + encodeURIComponent(pid) + '" target="_blank" rel="noopener">Maps</a>' : "")
              + (lineOf(notes, "BBB") ? " · BBB " + esc(lineOf(notes, "BBB")) : ""))
          + row("USDOT / MC", esc(String(dot).replace(/^USDOT\s*/, "")))
          + row("Why the rank", esc(lineOf(notes, "Why this rank")))
          + row("Threat to us", esc(lineOf(notes, "Threat")))
          + "</dl></div>";
        if (shared.length || extra.length) h += "<h3>Services vs Zip To Zip</h3><div class=\"cmpm-svc\">"
          + shared.map(s => '<span class="y">✓ ' + esc(s) + "</span>").join("") + extra.map(s => '<span class="n">✗ ' + esc(s) + "</span>").join("")
          + '</div><div class="cmpm-note" style="margin:6px 0 0">Green = Zip To Zip also offers · Red = Zip To Zip does not offer</div>';
        else if (serv) h += '<h3>Services vs Zip To Zip</h3><p class="cmpm-p" style="white-space:pre-wrap">' + linkify(serv) + "</p>";
        if (pos || diff) h += "<h3>Market positioning</h3>" + (pos ? '<p class="cmpm-p">' + esc(pos) + "</p>" : "")
          + (diff ? '<p class="cmpm-p"><b>Key differentiator:</b> ' + esc(diff) + "</p>" : "");
        const block = (title, text) => { if (!text) return ""; const ev = evidence(text);
          return "<h3>" + title + "</h3>" + (ev || '<p class="cmpm-p" style="white-space:pre-wrap">' + linkify(text) + "</p>"); };
        h += block("Lead sources", c["Lead Sources"]) + block("Sponsorships", c["Sponsorships"]) + block("Partnerships", c["Partnerships"]);
        if (c["Posts"]) h += '<h3>Recent posts</h3><p class="cmpm-p" style="white-space:pre-wrap">' + linkify(c["Posts"]) + "</p>";
        const where = Object.keys(c.cover).filter(k => k.indexOf(st + "|") === 0).length;
        if (c.cities.length) h += "<h3>Target cities they serve</h3><div class=\"sub\">" + esc(c.cities.join(", "))
          + (where ? " · works in " + where + " count" + (where === 1 ? "y" : "ies") + " of " + esc(SNAME[st] || st) : "") + "</div>";
        if (notes) h += "<details><summary>Everything in Tako's research</summary><p class=\"cmpm-p\" style=\"white-space:pre-wrap;margin-top:8px\">"
          + linkify(notes) + "</p></details>";
        return h + '<div style="margin-top:12px"><button class="rs-btn" data-cedit="' + esc(c["Competitor Key"]) + '">Edit</button></div>';
      }

      function googleView(M) {
        const st = S.st;
        const rows = Object.values(M.scanNow).filter(p => p["State"] === st).sort((a, b) => (+b["Reviews"] || 0) - (+a["Reviews"] || 0)).slice(0, 60);
        return '<p class="cmpm-note">Google\'s movers in ' + esc(SNAME[st]) + "'s tiered counties and every county a competitor has an office in, "
          + (M.cur ? "scanned " + esc(M.cur.slice(0, 7)) : "not scanned yet") + ". Most reviews first.</p>"
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>#</th><th>Mover</th><th>Google</th><th>Counties</th><th></th></tr></thead><tbody>"
          + (rows.length ? rows.map((p, i) => "<tr><td>" + (i + 1) + "</td><td><b>" + esc(p["Name"]) + '</b><br><small class="dim">' + esc(p["Address"] || "")
              + "</small></td><td class=\"nowrap\">" + stars(p["Rating"], p["Reviews"]) + "</td><td class=\"muted\">" + esc(p.counties.join(", "))
              + "</td><td>" + (M.ours.has(p["Place Id"]) ? '<span class="rs-pill ok">on our list</span>'
                : '<button class="rs-btn" data-cadd="' + esc(p["Place Id"]) + '">Add to the list</button>') + "</td></tr>").join("")
            : '<tr><td colspan="5" class="dim">The monthly Google scan has not run yet.</td></tr>') + "</tbody></table></div></div>";
      }

      function playbookView(M) {
        const notes = ST.notes.filter(n => String(n["Note Key"]).indexOf("playbook") === 0);
        return '<p class="cmpm-note">What competitors post on each platform, what performs, and when. Tako keeps it here.</p>'
          + (notes.length ? notes.map(n => '<div class="panel"><h3>' + esc(n["Title"] || n["Note Key"]) + '</h3><div class="cmpm-play">' + esc(n["Body"])
              + '</div><div class="cmpm-note">' + esc(String(n["Entered At"]).slice(0, 10)) + " · " + esc(String(n["Entered By"] || "").split("@")[0])
              + ' · <button class="cmpm-x" style="color:inherit" data-cnote="' + esc(n["Note Key"]) + '">edit</button></div></div>').join("")
            : '<div class="panel">No playbook yet. It arrives with the import of Tako\'s page, or write one under Edit.</div>');
      }

      function editView(M) {
        const e = S.edit || {};
        const c = e.comp ? M.comps[e.comp] : null;
        const v = k => esc(c ? (c[k] == null ? "" : c[k]) : (e.seed && e.seed[k]) || "");
        const ta = (id, k, l) => '<label class="rs-fld wide"><span>' + l + '</span><textarea class="rs-inp" id="' + id + '">' + v(k) + "</textarea></label>";
        let h = '<div class="panel"><h3 style="margin:0 0 4px">' + (c ? "Change " + esc(c["Name"]) : "Add a competitor") + "</h3>"
          + '<div class="cmpm-form">'
          + '<label class="rs-fld"><span>Name</span><input class="rs-inp" id="cfName" value="' + v("Name") + '"></label>'
          + '<label class="rs-fld"><span>Brand or parent</span><input class="rs-inp" id="cfBrand" value="' + v("Brand") + '"></label>'
          + '<label class="rs-fld"><span>Type</span><select class="rs-inp" id="cfType"><option value=""></option>'
          + ["Local", "Regional", "National"].map(t => '<option' + ((c ? c["Type"] : "") === t ? " selected" : "") + ">" + t + "</option>").join("") + "</select></label>"
          + '<label class="rs-fld"><span>Score (0-100)</span><input class="rs-inp" id="cfScore" type="number" step="0.1" value="' + v("Score") + '"></label>'
          + '<label class="rs-fld"><span>Website</span><input class="rs-inp" id="cfWeb" value="' + v("Website") + '"></label>'
          + '<label class="rs-fld"><span>Phone</span><input class="rs-inp" id="cfPhone" value="' + v("Phone") + '"></label>'
          + ta("cfServ", "Services", "Services vs Zip To Zip") + ta("cfLead", "Lead Sources", "Lead sources")
          + ta("cfSpon", "Sponsorships", "Sponsorships") + ta("cfPart", "Partnerships", "Partnerships")
          + ta("cfPosts", "Posts", "Recent posts") + ta("cfNotes", "Notes", "Notes")
          + '<button class="rs-btn" id="cfSave">' + (c ? "Save" : "Add the competitor") + "</button>"
          + (c ? '<button class="rs-btn" id="cfNew">New competitor instead</button><button class="rs-btn" id="cfDel">Remove</button>' : "")
          + "</div>";
        if (c) {
          h += '<h4 style="margin:10px 0 4px">Offices</h4>' + (c.offices.length ? c.offices.map(o => "<div>" + esc([o["Label"], o["Address"], o["City"], o["County"] && o["County"] + " County", o["State"], o["Zip"]].filter(Boolean).join(", "))
              + (o.g ? " — Google: " + esc(o.g["Name"] || "") + " " + stars(o.g["Rating"], o.g["Reviews"]) : ' <small class="dim">Google finds it on the next weekly run</small>')
              + ' <button class="cmpm-x" data-cdeloff="' + esc(o["Office Key"]) + '">remove</button></div>').join("") : '<div class="dim">No offices yet.</div>')
            + '<div class="cmpm-form"><label class="rs-fld"><span>Office name</span><input class="rs-inp" id="coLabel" placeholder="e.g. Fairfield / Livingston franchise"></label>'
            + '<label class="rs-fld"><span>Address</span><input class="rs-inp" id="coAddr"></label>'
            + '<label class="rs-fld"><span>City</span><input class="rs-inp" id="coCity"></label>'
            + '<label class="rs-fld"><span>County</span><input class="rs-inp" id="coCounty"></label>'
            + '<label class="rs-fld"><span>State</span><select class="rs-inp" id="coState">' + STATES.map(s => "<option" + (s === S.st ? " selected" : "") + ">" + s + "</option>").join("") + "</select></label>"
            + '<label class="rs-fld"><span>ZIP</span><input class="rs-inp" id="coZip"></label>'
            + '<label class="rs-fld"><span>Google place id (optional)</span><input class="rs-inp" id="coPid" value="' + esc((e.seed && e.seed.pid) || "") + '"></label>'
            + '<button class="rs-btn" id="coAdd">Add the office</button></div>';
        }
        h += "</div>";
        const pb = ST.notes.find(n => n["Note Key"] === (S.noteKey || "playbook"));
        h += '<div class="panel" style="margin-top:12px"><h3 style="margin:0 0 4px">Social media playbook</h3><div class="cmpm-form">'
          + '<label class="rs-fld wide"><span>Title</span><input class="rs-inp" id="cnTitle" value="' + esc(pb ? pb["Title"] || "" : "Social media playbook") + '"></label>'
          + '<label class="rs-fld wide"><span>Text</span><textarea class="rs-inp" id="cnBody" style="min-height:160px">' + esc(pb ? pb["Body"] || "" : "") + "</textarea></label>"
          + '<button class="rs-btn" id="cnSave">Save the playbook</button></div></div>';
        const all = Object.values(M.comps).sort((a, b) => a["Name"].localeCompare(b["Name"]));
        h += '<div class="panel" style="padding:0;margin-top:12px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Competitor</th><th>Type</th><th>Offices</th><th>Score</th><th>Google</th><th></th></tr></thead><tbody>"
          + (all.length ? all.map(x => "<tr><td><b>" + esc(x["Name"]) + "</b></td><td>" + esc(x["Type"] || "") + "</td><td>"
              + esc(x.offices.map(o => o["State"]).filter(Boolean).join(", ")) + "</td><td>" + (x["Score"] != null ? Number(x["Score"]).toFixed(1) : "—")
              + '</td><td class="nowrap">' + stars(x.rating, x.reviews) + '</td><td><button class="rs-btn" data-cedit="' + esc(x["Competitor Key"]) + '">Edit</button></td></tr>').join("")
            : '<tr><td colspan="6" class="dim">No competitors yet.</td></tr>') + "</tbody></table></div></div>";
        return h;
      }

      /* ---- the map ---------------------------------------------------------------------------- */
      function ensureLeaflet(cb) {
        if (window.L && window.L.map) { cb(); return; }
        if (!document.getElementById("cmpmLeafCss")) {
          const lc = document.createElement("link");
          lc.id = "cmpmLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
          document.head.appendChild(lc);
        }
        let sc = document.getElementById("cmpmLeafJs");
        if (sc) { sc.addEventListener("load", () => cb()); return; }
        sc = document.createElement("script");
        sc.id = "cmpmLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js";
        sc.onload = () => cb();
        document.head.appendChild(sc);
      }
      function drawMap(M) {
        const el = host.querySelector("#cmpmMap");
        if (!el) return;
        ensureLeaflet(() => {
          const go = () => {
            if (!alive() || !host.querySelector("#cmpmMap")) return;
            const st = S.st;
            // no street map under it (her layout): the state's counties on their own, the neighbours faint
            const m = MAP = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false, zoomSnap: .25 })
              .setView([40.2, -74.6], 8);
            const dark = document.body.classList.contains("rs-app") && !document.body.classList.contains("light");
            const F = stateFacts(M, st);
            if (GEO && GEO.features) {
              L.geoJSON({ type: "FeatureCollection", features: GEO.features.filter(f => f.properties.st !== st) }, {
                interactive: false,
                style: () => ({ color: dark ? "#2B3545" : "#D5DCE5", weight: .6, fillColor: dark ? "#1A2230" : "#F6F8FB", fillOpacity: 1 }),
              }).addTo(m);
              const lyr = L.geoJSON({ type: "FeatureCollection", features: GEO.features.filter(f => f.properties.st === st) }, {
                style: f => {
                  const t = M.tier[st + "|" + ckey(f.properties.name)], best = t ? +t["Best Tier"] : null;
                  const on = S.county && ckey(S.county) === ckey(f.properties.name);
                  const fill = on ? "#FACC15" : best === 1 && S.lay.t1 ? "#7CC68D" : best === 2 && S.lay.t2 ? "#93B4F4" : (dark ? "#3A4558" : "#E3E8EF");
                  return { color: on ? "#0F172A" : (dark ? "#0F172A" : "#64748B"), weight: on ? 2.2 : .8, fillColor: fill, fillOpacity: 1 };
                },
                onEachFeature: (f, l) => {
                  // dark theme: a county with no tier colour is dark, so its name goes light
                  const t = M.tier[st + "|" + ckey(f.properties.name)], best = t ? +t["Best Tier"] : null;
                  const lit = (best === 1 && S.lay.t1) || (best === 2 && S.lay.t2) || (S.county && ckey(S.county) === ckey(f.properties.name));
                  l.bindTooltip(esc(f.properties.name), { permanent: true, direction: "center", className: "cmpm-lbl" + (dark && !lit ? " dk" : ""), opacity: 1 });
                  l.on("mouseover", () => l.setStyle({ weight: 2 })).on("mouseout", () => lyr.resetStyle(l));
                  l.on("click", () => { S.county = f.properties.name; S.sel = null; paint(); });
                },
              }).addTo(m);
              try { m.fitBounds(lyr.getBounds(), { padding: [12, 12] }); } catch (e) { /* default view */ }
            }
            // only this state's top 5 (and a competitor opened from ranks 6-20), shaped by type, with their rank
            const show = F.top.slice(), seen = {};   // two offices on one spot (NJ #2 and #3 are both in Fairfield) sit side by side
            if (S.sel && M.comps[S.sel] && show.indexOf(M.comps[S.sel]) < 0 && F.list.indexOf(M.comps[S.sel]) >= 0) show.push(M.comps[S.sel]);
            show.forEach(c => {
              if (!S.lay[c["Type"]] && S.sel !== c["Competitor Key"]) return;
              const rank = F.list.indexOf(c) + 1, on = S.sel === c["Competitor Key"];
              const offs = c.offices.filter(o => o.lat != null && o.lng != null);
              (offs.filter(o => o["State"] === st).length ? offs.filter(o => o["State"] === st) : offs.slice(0, 1)).forEach(o => {
                const spot = (+o.lat).toFixed(2) + "," + (+o.lng).toFixed(2), n = seen[spot] = (seen[spot] || 0) + 1;
                L.marker([o.lat, o.lng], { icon: L.divIcon({ className: "", html: '<div class="cmpm-mk' + (on ? " on" : "") + '">'
                    + shape(c["Type"], 18, on) + "<span>#" + rank + "</span></div>", iconSize: [18, 18], iconAnchor: [9 - 24 * (n - 1), 9] }),
                    zIndexOffset: on ? 900 : 500 - rank })
                  .addTo(m).bindTooltip("<b>#" + rank + " " + esc(c["Name"]) + "</b><br>" + esc([o["City"], o["State"]].filter(Boolean).join(", "))
                    + " · score " + scoreTxt(c) + (o.g ? "<br>" + Number(o.g["Rating"]).toFixed(1) + "★ / " + fmt(o.g["Reviews"]) + " reviews" : ""))
                  .on("click", () => { S.sel = c["Competitor Key"]; S.county = null; paint(); });
              });
            });
          };
          if (GEO) go();
          else fetch("assets/vendor/geo/counties8.geojson").then(r => r.ok ? r.json() : null).catch(() => null)
            .then(j => { GEO = j; go(); });
        });
      }

      /* ---- wiring ----------------------------------------------------------------------------- */
      function act(body, ok) {
        S.err = ""; S.msg = "";
        return post(body).then(() => { S.msg = ok; return load(); })
          .catch(e => { S.err = String(e && e.message || e); })
          .then(() => paint());
      }
      function wire(M) {
        host.querySelectorAll("[data-cst]").forEach(t => { t.onclick = () => { S.st = t.dataset.cst; S.county = null; S.sel = null; S.more = false; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-ctab]").forEach(t => { t.onclick = () => { S.tab = t.dataset.ctab; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-csel]").forEach(t => { t.onclick = () => { S.sel = S.sel === t.dataset.csel ? null : t.dataset.csel; paint(); }; });
        host.querySelectorAll("[data-ccounty]").forEach(t => { t.onclick = () => { S.county = t.dataset.ccounty || null; S.sel = null; paint(); }; });
        // Tako's layout: Back (a profile goes back to the county it was opened from), ranks 6-20, layers, county search
        host.querySelectorAll("[data-cback]").forEach(t => { t.onclick = () => { if (t.dataset.cback === "sel") S.sel = null; else S.county = null; paint(); }; });
        host.querySelectorAll("[data-cmore]").forEach(t => { t.onclick = () => { S.more = t.dataset.cmore === "1"; paint(); }; });
        host.querySelectorAll("[data-clay]").forEach(t => { t.onchange = () => { S.lay[t.dataset.clay] = t.checked; paint(); }; });
        const fc = host.querySelector("#cmpmFind");
        if (fc) {
          const pick = () => {
            const q = ckey(fc.value);
            if (!q) return;
            const hit = TIER.filter(t => t["State"] === S.st).map(t => t["County"]).find(n => ckey(n) === q)
              || (GEO && GEO.features || []).filter(f => f.properties.st === S.st).map(f => f.properties.name).find(n => ckey(n) === q);
            if (hit) { S.county = hit; S.sel = null; paint(); }
          };
          fc.onchange = pick;
          fc.onkeydown = e => { if (e.key === "Enter") pick(); };
        }
        host.querySelectorAll("[data-cedit]").forEach(b => { b.onclick = () => { S.edit = { comp: b.dataset.cedit }; S.tab = "edit"; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-cnote]").forEach(b => { b.onclick = () => { S.noteKey = b.dataset.cnote; S.tab = "edit"; paint(); }; });
        host.querySelectorAll("[data-cadd]").forEach(b => {
          b.onclick = () => {
            const p = M.scanNow[b.dataset.cadd];
            if (!p) return;
            S.edit = { seed: { Name: p["Name"], pid: p["Place Id"] } };
            S.tab = "edit"; S.msg = "Fill in the type and score, add it, then add its office (the place id is filled in)."; paint();
          };
        });
        if (S.tab === "map") drawMap(M);
        const val = id => { const x = host.querySelector(id); return x ? x.value.trim() : ""; };
        const cs = host.querySelector("#cfSave");
        if (cs) cs.onclick = () => {
          const key = S.edit && S.edit.comp;
          const seed = S.edit && S.edit.seed;
          const name = val("#cfName");
          act({ op: "competitor", key: key || undefined, name, brand: val("#cfBrand"), type: val("#cfType"),
                score: val("#cfScore"), website: val("#cfWeb"), phone: val("#cfPhone"), services: val("#cfServ"),
                lead_sources: val("#cfLead"), sponsorships: val("#cfSpon"), partnerships: val("#cfPart"),
                posts: val("#cfPosts"), notes: val("#cfNotes") }, key ? "Saved." : "Added: now add its offices.")
            .then(() => { if (!key && !S.err) { const n = ST.competitors.find(x => x["Name"] === name);
              S.edit = n ? { comp: n["Competitor Key"], seed: seed ? { pid: seed.pid } : null } : null; paint(); } });
        };
        const cn = host.querySelector("#cfNew");
        if (cn) cn.onclick = () => { S.edit = null; paint(); };
        const cd = host.querySelector("#cfDel");
        if (cd) cd.onclick = () => {
          if (!confirm("Remove this competitor and its offices from the list? Their Google history is kept.")) return;
          act({ op: "remove-competitor", key: S.edit.comp }, "Removed.").then(() => { S.edit = null; S.sel = null; paint(); });
        };
        const oa = host.querySelector("#coAdd");
        if (oa) oa.onclick = () => act({ op: "office", competitor_key: S.edit.comp, label: val("#coLabel"), address: val("#coAddr"),
          city: val("#coCity"), county: val("#coCounty").replace(/\s+county$/i, ""), state: val("#coState"), zip: val("#coZip"),
          place_id: val("#coPid") }, "Office added: Google's rating arrives with the next weekly run.");
        host.querySelectorAll("[data-cdeloff]").forEach(b => {
          b.onclick = () => { if (confirm("Remove this office?")) act({ op: "remove-office", key: b.dataset.cdeloff }, "Office removed."); };
        });
        const ns = host.querySelector("#cnSave");
        if (ns) ns.onclick = () => act({ op: "note", key: S.noteKey || "playbook", title: val("#cnTitle"), body: val("#cnBody") }, "Playbook saved.");
      }
    },
  });
})();
