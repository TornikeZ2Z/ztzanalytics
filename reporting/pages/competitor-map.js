/* COMPETITOR MAP — who we compete with in each state, where their offices are, and how they do on Google.
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
 *   RANK         a state's competitors are those with an office there, by her score, then by Google
 *                reviews. Her scores are research estimates, not market share.
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
      + ".cmpm-map{height:min(72vh,680px);min-height:480px;border-radius:12px;border:1px solid var(--line);overflow:hidden;background:#d0cfd4}"
      + ".cmpm-key{display:flex;gap:14px;flex-wrap:wrap;font-size:12.5px;color:var(--muted);margin:0 0 8px;align-items:center}"
      + ".cmpm-key i{display:inline-block;width:14px;height:11px;border-radius:3px;vertical-align:-1px;margin-right:5px}"
      + ".cmpm-key u{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:-1px;margin-right:5px;text-decoration:none}"
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
      + ".cmpm-dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:5px;vertical-align:0}"
      + ".cmpm-prof dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:6px 10px;margin:8px 0 0;font-size:13px}"
      + ".cmpm-prof dt{color:var(--muted);font-weight:600}"
      + ".cmpm-prof dd{margin:0;white-space:pre-wrap;line-height:1.45}"
      + ".cmpm-star{color:#B45309;font-weight:700}"
      + ".cmpm-pin{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}"
      + ".cmpm-g{width:7px;height:7px;border-radius:50%;background:#64748B;border:1px solid #fff;opacity:.8}"
      + ".cmpm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;margin:6px 0 10px}"
      + ".cmpm-form .wide{grid-column:1/-1}"
      + ".cmpm-form textarea{min-height:70px;width:100%}"
      + ".cmpm-err{color:#B3261E;font-size:12.5px;margin:6px 2px}"
      + ".cmpm-ok{color:#3F7D20;font-size:12.5px;margin:6px 2px}"
      + ".cmpm-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".cmpm-x{border:0;background:none;color:#B3261E;cursor:pointer;font-size:12.5px;padding:0 4px}"
      + ".cmpm-play{white-space:pre-wrap;line-height:1.55;font-size:13.5px}";
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
      function ranked(M, st) {
        return Object.values(M.comps).filter(c => c.offices.some(o => o["State"] === st))
          .sort((a, b) => (num(b["Score"]) || -1) - (num(a["Score"]) || -1) || b.reviews - a.reviews);
      }

      /* ---- painting --------------------------------------------------------------------------- */
      const fmt = n => n == null ? "—" : Number(n).toLocaleString();
      const stars = (r, n) => r == null ? '<span class="dim">no Google data yet</span>'
        : '<span class="cmpm-star">' + Number(r).toFixed(1) + "★</span> / " + fmt(n) + " reviews";

      function paint() {
        if (!alive()) return;
        const M = model();
        let h = '<div class="cmpm">';
        h += '<div class="cmpm-states">' + STATES.map(s => '<div class="rs-tog' + (S.st === s ? " on" : "") + '" data-cst="' + s + '"><i></i>'
          + s + "</div>").join("") + '<span class="rs-spacer"></span>'
          + [["map", "Map"], ["google", "Top on Google"], ["playbook", "Social playbook"], ["edit", "Edit"]].map(([k, l]) =>
            '<div class="rs-tog' + (S.tab === k ? " on" : "") + '" data-ctab="' + k + '"><i></i>' + l + "</div>").join("") + "</div>";
        if (S.err) h += '<div class="cmpm-err">' + esc(S.err) + "</div>";
        if (S.msg) h += '<div class="cmpm-ok">' + esc(S.msg) + "</div>";
        if (S.tab === "map") h += mapView(M);
        else if (S.tab === "google") h += googleView(M);
        else if (S.tab === "playbook") h += playbookView(M);
        else h += editView(M);
        const used = (M.calls.details || 0) + (M.calls.find || 0) + (M.calls.scan || 0);
        h += '<p class="cmpm-note">Google lookups this month: ' + fmt(M.calls.details || 0) + " office checks, "
          + fmt((M.calls.scan || 0) + (M.calls.find || 0)) + " searches (" + FREE.toLocaleString() + " of each are free a month)."
          + (used ? "" : " Nothing has been looked up yet: the first weekly run fills it in.") + "</p></div>";
        if (MAP) { try { MAP.remove(); } catch (e) { /* gone with the old DOM */ } MAP = null; }
        host.innerHTML = h;
        wire(M);
      }

      function mapView(M) {
        const st = S.st;
        const list = ranked(M, st);
        const tiers = TIER.filter(t => t["State"] === st);
        const t1 = tiers.reduce((a, t) => a + (+t["Tier 1 Cities"] || 0), 0);
        const t2 = tiers.reduce((a, t) => a + (+t["Tier 2 Cities"] || 0), 0);
        const officeCounties = {};
        M.offices.filter(o => o["State"] === st && o["County"]).forEach(o => {
          const k = o["County"]; (officeCounties[k] = officeCounties[k] || new Set()).add(o["Competitor Key"]); });
        const contested = Object.entries(officeCounties).map(([k, s]) => [k, s.size]).sort((a, b) => b[1] - a[1]).slice(0, 10);
        const uncovered = tiers.filter(t => (+t["Tier 1 Cities"] || 0) > 0 && !officeCounties[t["County"]])
          .reduce((a, t) => a + (+t["Tier 1 Cities"] || 0), 0);
        let side = '<div class="panel"><h3>' + esc(SNAME[st]) + '</h3><div class="sub">' + fmt(t1) + " Tier 1 and " + fmt(t2)
          + " Tier 2 cities on the Target Map · " + fmt(list.length) + " competitor" + (list.length === 1 ? "" : "s") + " with an office here"
          + (t1 ? " · " + fmt(uncovered) + " Tier 1 cities in counties with no competitor office" : "") + "</div>";
        if (contested.length) side += '<h3 style="margin-top:12px">Most contested counties</h3><div class="cmpm-chips">'
          + contested.map(([k, n]) => '<span class="cmpm-chip" data-ccounty="' + esc(k) + '">' + esc(k) + " · " + n + "</span>").join("") + "</div>";
        side += "</div>";
        if (S.county) side += countyPanel(M, st, S.county);
        side += '<div class="panel"><h3>Competitors in ' + esc(st) + "</h3>"
          + (list.length ? '<div class="cmpm-side">' + list.map((c, i) => '<div class="cmpm-card' + (S.sel === c["Competitor Key"] ? " on" : "")
              + '" data-csel="' + esc(c["Competitor Key"]) + '"><span class="n">#' + (i + 1) + "</span><div><b>"
              + '<span class="cmpm-dot" style="background:' + (TYPE_COL[c["Type"]] || "#64748B") + '"></span>' + esc(c["Name"]) + "</b><small>"
              + esc([c["Type"], c.offices.filter(o => o["State"] === st).map(o => o["City"]).filter(Boolean).join(", ")].filter(Boolean).join(" · "))
              + " · " + stars(c.rating, c.reviews) + '</small></div><span class="s">' + (c["Score"] != null ? Number(c["Score"]).toFixed(1) : "—")
              + "</span></div>").join("") + "</div>"
            : '<div class="sub">No competitor has an office in ' + esc(SNAME[st]) + " yet. Add them under Edit.</div>") + "</div>";
        if (S.sel && M.comps[S.sel]) side += profile(M, M.comps[S.sel]);
        const watch = watchlist(M, st).slice(0, 5);
        side += '<div class="panel"><h3>Watchlist</h3>' + (watch.length ? '<div class="sub">Movers on Google in ' + esc(st)
            + " that are not on our list" + (M.prev ? ", fastest growing first" : ", most reviews first (growth shows from the second monthly scan)") + "</div>"
            + '<table class="rs-table" style="margin-top:6px"><tbody>' + watch.map(w => "<tr><td><b>" + esc(w["Name"]) + '</b><br><small class="dim">'
              + esc(w.counties.slice(0, 3).join(", ")) + "</small></td><td class=\"nowrap\">" + stars(w["Rating"], w["Reviews"])
              + (w.growth != null ? '<br><small class="dim">+' + fmt(w.growth) + " in a month</small>" : "") + "</td></tr>").join("")
            + "</tbody></table>"
          : '<div class="sub">' + (M.cur ? "The monthly Google scan covers no county in " + esc(SNAME[st])
              + " yet: it scans counties with a tiered city on the Target Map and counties a competitor has an office in."
              : "The monthly Google scan has not run yet.") + "</div>") + "</div>";
        return '<div class="cmpm-key"><span><i style="background:#22C55E;opacity:.55"></i>County with Tier 1 cities</span>'
          + '<span><i style="background:#3B82F6;opacity:.5"></i>Tier 2 cities only</span>'
          + Object.entries(TYPE_COL).map(([k, c]) => '<span><u style="background:' + c + '"></u>' + k + " mover</span>").join("")
          + '<span><u style="background:#64748B"></u>Other movers on Google</span></div>'
          + '<div class="cmpm-grid"><div class="cmpm-map" id="cmpmMap"></div><div class="cmpm-side">' + side + "</div></div>";
      }

      function countyPanel(M, st, county) {
        const t = M.tier[st + "|" + ckey(county)];
        const here = M.offices.filter(o => o["State"] === st && ckey(o["County"]) === ckey(county));
        const g = Object.values(M.scanNow).filter(p => p["State"] === st && p.counties.some(c => ckey(c.replace(/ [A-Z]{2}$/, "")) === ckey(county)))
          .sort((a, b) => (+b["Reviews"] || 0) - (+a["Reviews"] || 0)).slice(0, 8);
        return '<div class="panel"><h3>' + esc(county) + " County, " + esc(st) + ' <button class="cmpm-x" data-ccounty="">close</button></h3>'
          + '<div class="sub">' + (t ? fmt(t["Tier 1 Cities"]) + " Tier 1 · " + fmt(t["Tier 2 Cities"]) + " Tier 2 cities"
            + (t["Tier 1 List"] ? "<br>Tier 1: " + esc(t["Tier 1 List"]) : "") : "No tiered city here on the Target Map.") + "</div>"
          + (here.length ? '<h3 style="margin-top:10px">Our list</h3>' + here.map(o => "<div><b>" + esc(M.comps[o["Competitor Key"]]["Name"])
              + "</b> · " + esc(o["City"] || "") + " · " + stars(o.g && o.g["Rating"], o.g && o.g["Reviews"]) + "</div>").join("") : "")
          + (g.length ? '<h3 style="margin-top:10px">Top on Google here</h3>' + g.map(p => "<div>" + esc(p["Name"]) + " · "
              + stars(p["Rating"], p["Reviews"]) + (M.ours.has(p["Place Id"]) ? ' <span class="rs-pill ok">on our list</span>' : "") + "</div>").join("") : "")
          + "</div>";
      }

      function watchlist(M, st) {
        return Object.values(M.scanNow).filter(p => p["State"] === st && !M.ours.has(p["Place Id"])).map(p => {
          const before = M.scanPrev[p["Place Id"]];
          return Object.assign({}, p, { growth: before && before["Reviews"] != null && p["Reviews"] != null ? (+p["Reviews"]) - (+before["Reviews"]) : null });
        }).sort((a, b) => (M.prev ? (b.growth || 0) - (a.growth || 0) : 0) || (+b["Reviews"] || 0) - (+a["Reviews"] || 0));
      }

      function profile(M, c) {
        const row = (k, v) => v ? "<dt>" + esc(k) + "</dt><dd>" + esc(v) + "</dd>" : "";
        return '<div class="panel cmpm-prof"><h3><span class="cmpm-dot" style="background:' + (TYPE_COL[c["Type"]] || "#64748B") + '"></span>'
          + esc(c["Name"]) + '</h3><div class="sub">' + esc([c["Type"] && c["Type"] + " mover", c["Brand"]].filter(Boolean).join(" · "))
          + (c["Website"] ? ' · <a href="' + esc(c["Website"]) + '" target="_blank" rel="noopener">website ↗</a>' : "")
          + (c["Phone"] ? " · " + esc(c["Phone"]) : "") + "</div><dl>"
          + "<dt>Score</dt><dd>" + (c["Score"] != null ? Number(c["Score"]).toFixed(1) + " (Tako's research estimate)" : "—") + "</dd>"
          + "<dt>Google</dt><dd>" + stars(c.rating, c.reviews) + (c.offices.length > 1 ? " across " + c.offices.length + " offices" : "") + "</dd>"
          + "<dt>Offices</dt><dd>" + c.offices.map(o => esc([o["Label"], o["Address"],
              /* a full street address already names its city and state */
              String(o["Address"] || "").indexOf(o["City"] || "\u0000") >= 0 ? null : o["City"],
              new RegExp("\\b" + (o["State"] || "\u0000") + "\\b").test(String(o["Address"] || "")) ? null : o["State"]].filter(Boolean).join(", "))
            + (o.g ? " — " + stars(o.g["Rating"], o.g["Reviews"]) + (o.g["Name"] && o.g["Name"] !== c["Name"] ? ' <small class="dim">(Google: ' + esc(o.g["Name"]) + ")</small>" : "") : "")).join("\n") + "</dd>"
          + row("Services vs ours", c["Services"]) + row("Lead sources", c["Lead Sources"]) + row("Sponsorships", c["Sponsorships"])
          + row("Partnerships", c["Partnerships"]) + row("Recent posts", c["Posts"]) + row("Notes", c["Notes"])
          + '</dl><div style="margin-top:8px"><button class="rs-btn" data-cedit="' + esc(c["Competitor Key"]) + '">Edit</button></div></div>';
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
            const m = MAP = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false }).setView([40.2, -74.6], 8);
            const dark = !document.body.classList.contains("light");
            const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_" + (dark ? "Dark" : "Light") + "_Gray_";
            L.tileLayer(ESRI + "Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 14 }).addTo(m);
            const lp = m.createPane("cmpLabels"); lp.style.zIndex = 460; lp.style.pointerEvents = "none";
            L.tileLayer(ESRI + "Reference/MapServer/tile/{z}/{y}/{x}", { maxZoom: 14, pane: "cmpLabels", opacity: .85 }).addTo(m);
            if (GEO && GEO.features) {
              const feats = { type: "FeatureCollection", features: GEO.features.filter(f => f.properties.st === st) };
              const lyr = L.geoJSON(feats, {
                style: f => { const t = M.tier[st + "|" + ckey(f.properties.name)];
                  const best = t ? +t["Best Tier"] : null;
                  const fill = best === 1 ? "#22C55E" : best === 2 ? "#3B82F6" : null;
                  return { color: "#475569", weight: .8, fillColor: fill || "#94A3B8", fillOpacity: fill ? .38 : .06 }; },
                onEachFeature: (f, l) => {
                  const t = M.tier[st + "|" + ckey(f.properties.name)];
                  l.bindTooltip("<b>" + esc(f.properties.name) + "</b>" + (t ? "<br>" + fmt(t["Tier 1 Cities"]) + " Tier 1 · " + fmt(t["Tier 2 Cities"]) + " Tier 2 cities" : ""), { sticky: true });
                  l.on("click", () => { S.county = f.properties.name; paint(); });
                },
              }).addTo(m);
              try { m.fitBounds(lyr.getBounds(), { padding: [8, 8] }); } catch (e) { /* default view */ }
            }
            // Google's other movers, small and grey, under our list
            Object.values(M.scanNow).filter(p => p["State"] === st && !M.ours.has(p["Place Id"]) && p["Latitude"] != null).forEach(p => {
              L.marker([+p["Latitude"], +p["Longitude"]], { icon: L.divIcon({ className: "", html: '<div class="cmpm-g"></div>', iconSize: [7, 7] }) })
                .addTo(m).bindTooltip(esc(p["Name"]) + "<br>" + (p["Rating"] != null ? Number(p["Rating"]).toFixed(1) + "★ / " : "") + fmt(p["Reviews"]) + " reviews");
            });
            M.offices.filter(o => o.lat != null && o.lng != null).forEach(o => {
              const c = M.comps[o["Competitor Key"]];
              const col = TYPE_COL[c["Type"]] || "#64748B";
              L.marker([o.lat, o.lng], { icon: L.divIcon({ className: "", html: '<div class="cmpm-pin" style="background:' + col
                  + (S.sel === c["Competitor Key"] ? ";outline:3px solid #0F172A" : "") + '"></div>', iconSize: [14, 14] }), zIndexOffset: 500 })
                .addTo(m).bindTooltip("<b>" + esc(c["Name"]) + "</b><br>" + esc([o["City"], o["State"]].filter(Boolean).join(", "))
                  + (o.g ? "<br>" + Number(o.g["Rating"]).toFixed(1) + "★ / " + fmt(o.g["Reviews"]) + " reviews" : ""))
                .on("click", () => { S.sel = c["Competitor Key"]; paint(); });
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
        host.querySelectorAll("[data-cst]").forEach(t => { t.onclick = () => { S.st = t.dataset.cst; S.county = null; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-ctab]").forEach(t => { t.onclick = () => { S.tab = t.dataset.ctab; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-csel]").forEach(t => { t.onclick = () => { S.sel = S.sel === t.dataset.csel ? null : t.dataset.csel; paint(); }; });
        host.querySelectorAll("[data-ccounty]").forEach(t => { t.onclick = () => { S.county = t.dataset.ccounty || null; paint(); }; });
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
