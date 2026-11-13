/* REVIEW MAP — every page of ours on the smaller review sites, and how many reviews each has.
 *
 * 10 Nov 2026, tracker ZTZ-56. Tako Berikashvili (Review and Reputation Manager) built a "ZipToZip
 * Review Map" as a claude.ai page; his picks the same day: it becomes a tab of Quality Team > Reviews,
 * its list LIVES IN THE PORTAL (no sheets) and the portal checks the pages itself.
 *
 *   THE LIST     review sites (rv_platform: name, domain, category, target) and our listing page on
 *                each site per location (rv_page). Tako edits both here (/api/_reviewmap).
 *   THE CHECK    once a week the loader opens every page and reads its review count
 *                (src/review_pages.py -> rv_check). Many directories refuse automated visits (a
 *                10 Nov test read 14 of 41), so a page it cannot read shows under "Needs a count",
 *                where Tako types the number; a typed count stands until the check next reads one.
 *   NOW          a page's latest known count; a site's Now is its pages' sum. TARGET is per site.
 *   CHANGES      every time a page's known count moved, from the check history.
 *
 * Google, Yelp, Facebook and the other big platforms stay on the Review Counts sheet (Settings tab).
 */
(() => {
  const TARGET_DATE = "30 Apr 2027";
  /* where each location's pin sits: the base's ZIP centre (ld_bases / dim_zip), Kearny and Shafto
     on their own offices; Maryland and Virginia have no base, so mid-state */
  const LOC = {
    "NJ Kearny": { st: "NJ", lat: 40.7523, lng: -74.1231, label: "NJ · Kearny", pin: "Kearny" },
    "NJ Shafto": { st: "NJ", lat: 40.2149, lng: -74.0789, label: "NJ · Shafto", pin: "Shafto" },
    "NY": { st: "NY", lat: 40.5991, lng: -73.9961, label: "New York", pin: "NY" },
    "CT": { st: "CT", lat: 41.2093, lng: -73.1646, label: "Connecticut", pin: "CT" },
    "PA": { st: "PA", lat: 40.0399, lng: -75.6406, label: "Pennsylvania", pin: "PA" },
    "MA": { st: "MA", lat: 42.4629, lng: -71.3645, label: "Massachusetts", pin: "MA" },
    "DE": { st: "DE", lat: 39.7376, lng: -75.6671, label: "Delaware", pin: "DE" },
    "MD": { st: "MD", lat: 39.0458, lng: -76.6413, label: "Maryland", pin: "MD" },
    "VA": { st: "VA", lat: 37.4316, lng: -78.6569, label: "Virginia", pin: "VA" },
    "General": { st: null, label: "General listing" },
  };
  const ORDER = ["NJ Kearny", "NJ Shafto", "NY", "CT", "PA", "MA", "DE", "MD", "VA", "General"];

  function injectStyle() {
    const old = document.getElementById("rvm-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "rvm-style";
    st.textContent = ""
      + ".rvm{font-variant-numeric:tabular-nums}"
      + ".rvm-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 10px}"
      + ".rvm-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".rvm-mapwrap{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:14px}"
      + "@media (max-width:1100px){.rvm-mapwrap{grid-template-columns:1fr}}"
      + ".rvm-map{height:min(70vh,640px);min-height:460px;border-radius:12px;border:1px solid var(--line);overflow:hidden;background:#d0cfd4}"
      + ".rvm-locs{display:flex;flex-direction:column;gap:6px}"
      + ".rvm-loc{display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--line);border-radius:10px;cursor:pointer;background:var(--panel)}"
      + ".rvm-loc:hover,.rvm-loc.on{border-color:var(--ink)}"
      + ".rvm-loc b{flex:1;font-size:13.5px}"
      + ".rvm-loc span{font-size:12px;color:var(--muted);text-align:right;line-height:1.3}"
      // the font as four properties: "font:700 12px/1.2 inherit" is invalid CSS (inherit cannot sit
      // inside the shorthand), so the whole declaration was dropped and the pins took Leaflet's font
      + ".rvm-pin{background:#C2410C;color:#fff;border-radius:999px;padding:3px 9px;font-family:inherit;"
      + "font-size:12px;font-weight:700;line-height:1.2;"
      + "box-shadow:0 1px 4px rgba(0,0,0,.3);white-space:nowrap;border:2px solid #fff}"
      + ".rvm-pin.sel{background:#14301F}"
      + ".rvm-pin.zero{background:#94A3B8;font-weight:600}"
      + ".rvm-cell{white-space:nowrap}"
      + ".rvm-cell a{color:#C2410C;font-weight:700;text-decoration:none}"
      + ".rvm-cell small{margin-left:4px;color:var(--muted);font-weight:600}"
      + ".rvm-cell .q{color:var(--faint)}"
      + ".rvm-dom{display:block;font-size:12px;color:var(--muted)}"
      + ".rvm-go{font-weight:700}"
      + ".rvm-go.ok{color:#3F7D20}"
      + ".rvm-inp{width:84px}"
      + ".rvm-pick{min-width:160px}"
      + ".rvm-form{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;align-items:end;margin:6px 0 12px}"
      + ".rvm-form .wide{grid-column:span 2}"
      + ".rvm-err{color:#B3261E;font-size:12.5px;margin:6px 2px}"
      + ".rvm-ok{color:#3F7D20;font-size:12.5px;margin:6px 2px}"
      + ".rvm-edit-pages{margin:4px 0 0 0;padding:0;list-style:none;font-size:12.5px}"
      + ".rvm-edit-pages li{display:flex;gap:8px;align-items:center;padding:3px 0}"
      + ".rvm-edit-pages li a{max-width:520px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block}"
      + ".rvm-x{border:0;background:none;color:#B3261E;cursor:pointer;font-size:12.5px;padding:0 4px}"
      // the Edit view's two headings sat at the browser's sizes; on the type scale now (ZTZ-80)
      + ".rvm .panel h3{font-size:16px;font-weight:600}"
      + ".rvm .panel h4{font-size:14px;font-weight:600}";
    document.head.appendChild(st);
  }

  registerPage({
    id: "review-map",
    group: "reviews",
    title: "Review Map",
    subtitle: "Every page of ours on the smaller review sites, the reviews on each, and the target for "
      + TARGET_DATE + ".",
    datasets: [],

    render(host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const mine = host;
      const alive = () => document.body.contains(mine);
      const S = window.__RVM || (window.__RVM = { tab: "map", loc: "all", q: "", sort: "now", msg: "", err: "",
                                                  edit: null });
      injectStyle();
      host.innerHTML = '<div class="panel">Loading the Review Map…</div>';

      let ST = { platforms: [], pages: [], locations: ORDER };
      let CHECKS = [];
      let MAP = null;

      /* everything, the check history included, through the page's own endpoint: a count Tako types
         is written by the bridge, and RS.load would hide it until the next pipeline run */
      const load = () => ZTZ.api("/api/_reviewmap").then(st => { ST = st || ST; CHECKS = (st && st.checks) || []; });

      load().then(() => { if (alive()) paint(); }).catch(e => {
        if (!alive()) return;
        const m = String(e && e.message || e);
        host.innerHTML = '<div class="panel">' + (m.indexOf("table_missing") >= 0
          ? "The Review Map's tables arrive with the first weekly run."
          : "Could not load — " + esc(m)) + "</div>";
      });

      function post(body) {
        return fetch(ZTZ.API + "/api/_reviewmap", {
          method: "POST",
          headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).then(r => r.json().catch(() => ({})).then(j => {
          if (!r.ok || j.error) {
            if (j && j.code === "view_as_readonly") throw new Error("preview mode — nothing is saved while viewing as someone else");
            throw new Error(j.error || ("HTTP " + r.status));
          }
          ST = j; CHECKS = j.checks || [];
        }));
      }

      /* ---- the model ------------------------------------------------------------------------- */
      const STALE_DAYS = 28;
      const STALE_FROM = new Date(Date.now() - STALE_DAYS * 864e5).toISOString().slice(0, 10);
      function model() {
        const byPage = {};
        CHECKS.slice().sort((a, b) => String(a["Checked At"]).localeCompare(String(b["Checked At"])))
          .forEach(c => { (byPage[c["Page Key"]] = byPage[c["Page Key"]] || []).push(c); });
        const plats = {};
        ST.platforms.forEach(p => { plats[p["Platform Key"]] = Object.assign({ pages: [], now: 0, known: 0 }, p); });
        const pages = ST.pages.filter(pg => plats[pg["Platform Key"]]).map(pg => {
          const hist = byPage[pg["Page Key"]] || [];
          let known = null, last = null;
          hist.forEach(c => { last = c; if (c["Count"] != null && c["Count"] !== "") known = c; });
          return Object.assign({}, pg, { hist, known, last,
            now: known ? +known["Count"] : null,
            /* a page the check cannot read needs a typed count only once its last known count is older
               than STALE_DAYS -- otherwise Tako would retype two thirds of the list every week */
            /* "skipped": the site shows Google's reviews, never counted (Tako's rule) -- nothing to type */
            needs: !last || (last["Status"] !== "ok" && last["Status"] !== "manual" && last["Status"] !== "skipped"
              && (!known || String(known["Checked At"]).slice(0, 10) < STALE_FROM)) });
        });
        pages.forEach(pg => {
          const p = plats[pg["Platform Key"]];
          p.pages.push(pg);
          if (pg.now != null) { p.now += pg.now; p.known++; }
        });
        const list = Object.values(plats);
        list.forEach(p => { p.target = p["Target"] != null ? +p["Target"] : null;
          p.reached = p.target != null && p.now >= p.target; p.togo = p.target != null ? Math.max(0, p.target - p.now) : null; });
        // changes: every move of a page's known count, newest first
        const changes = [];
        pages.forEach(pg => {
          let prev = null;
          pg.hist.forEach(c => {
            if (c["Count"] == null || c["Count"] === "") return;
            const n = +c["Count"];
            if (prev == null || n !== prev) changes.push({ at: String(c["Checked At"]).slice(0, 10), pg, before: prev, after: n,
              how: c["Status"] === "manual" ? "typed by " + String(c["Entered By"] || "").split("@")[0] : "weekly check" });
            prev = n;
          });
        });
        changes.sort((a, b) => b.at.localeCompare(a.at));
        const lastAuto = CHECKS.filter(c => c["Status"] !== "manual").map(c => String(c["Checked At"])).sort().pop() || null;
        return { plats, list, pages, changes, lastAuto };
      }

      /* ---- painting --------------------------------------------------------------------------- */
      const fmt = n => n == null ? "?" : Number(n).toLocaleString();
      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab) + '</div><div class="v">' + esc(val)
          + '</div><div class="s">' + esc(sub) + "</div></div>";
      }

      function paint() {
        if (!alive()) return;
        const M = model();
        const tot = M.list.reduce((a, p) => a + p.now, 0);
        // the sum of the targets Tako set (her page's 487); "to go" counts only sites still below theirs, so a
        // site past its target does not hide another one's shortfall
        const tgt = M.list.reduce((a, p) => a + (p.target != null ? p.target : p.now), 0);
        const togo = M.list.reduce((a, p) => a + (p.togo || 0), 0);
        const reached = M.list.filter(p => p.reached).length;
        const needs = M.pages.filter(pg => pg.needs).length;
        // a view of the Reviews hub: the hub draws the big head, this one sits a size down (ZTZ-80)
        let h = '<div class="rvm">'
          + RSC.pageHeadHtml({ title: "Review Map", key: "review-map",
              sub: "Every page of ours on the smaller review sites, the reviews on each, and the target for "
                + TARGET_DATE + "." });
        h += '<div class="rs-kpis" style="--kpi-cols:6">'
          + kpi(fmt(M.list.length), "Review sites", fmt(M.pages.length) + " pages of ours", "")
          + kpi(fmt(tot), "Reviews now", "the pages' latest known counts", "")
          + kpi(fmt(tgt), "Target", "by " + TARGET_DATE + " · " + fmt(togo) + " still to go", "")
          + kpi(fmt(reached) + " of " + fmt(M.list.length), "Sites at target", M.list.length ? Math.round(100 * reached / M.list.length) + "%" : "", reached ? "pos" : "")
          + kpi(fmt(needs), "Needs a count", "unreadable, last count over " + STALE_DAYS + " days old", needs ? "warn" : "")
          + kpi(M.lastAuto ? M.lastAuto.slice(0, 10) : "—", "Last check", "weekly, automatic", "")
          + "</div>";
        const tabs = [["map", "Map"], ["table", "Table"], ["changes", "Changes · " + M.changes.length],
                      ["needs", "Needs a count · " + needs], ["edit", "Edit the list"]];
        h += '<div class="rvm-tabs">' + tabs.map(([k, l]) => '<div class="rs-tog' + (S.tab === k ? " on" : "")
          + '" data-rvtab="' + k + '"><i></i>' + esc(l) + "</div>").join("") + "</div>";
        if (S.err) h += '<div class="rvm-err">' + esc(S.err) + "</div>";
        if (S.msg) h += '<div class="rvm-ok">' + esc(S.msg) + "</div>";
        if (!M.list.length && S.tab !== "edit") {
          h += '<div class="panel">No review sites yet. Tako\'s list arrives with the import of her page, or add sites '
            + 'under <b>Edit the list</b>.</div>';
        } else if (S.tab === "map") h += mapView(M);
        else if (S.tab === "table") h += tableView(M);
        else if (S.tab === "changes") h += changesView(M);
        else if (S.tab === "needs") h += needsView(M);
        else h += editView(M);
        h += "</div>";
        if (MAP) { try { MAP.remove(); } catch (e) { /* gone with the old DOM */ } MAP = null; }
        host.innerHTML = h;
        wire(M);
      }

      function locStats(M) {
        const out = {};
        ORDER.forEach(k => { out[k] = { pages: 0, now: 0 }; });
        M.pages.forEach(pg => { const o = out[pg["Location"]]; if (!o) return; o.pages++; o.now += pg.now || 0; });
        return out;
      }

      function mapView(M) {
        const L0 = locStats(M);
        return '<div class="rvm-mapwrap"><div class="rvm-map" id="rvmMap"></div><div class="rvm-locs">'
          + ORDER.map(k => '<div class="rvm-loc' + (S.loc === k ? " on" : "") + '" data-rvloc="' + esc(k) + '"><b>'
            + esc(LOC[k].label) + "</b><span>" + fmt(L0[k].pages) + " pages<br>" + fmt(L0[k].now) + " reviews</span></div>").join("")
          + '<p class="rvm-note">Click a location to see its pages in the Table.</p></div></div>';
      }

      function tableView(M) {
        const q = S.q.trim().toLowerCase();
        let rows = M.list.filter(p => !q || (p["Platform"] + " " + (p["Domain"] || "") + " " + (p["Category"] || ""))
          .toLowerCase().indexOf(q) >= 0);
        if (S.loc !== "all") rows = rows.filter(p => p.pages.some(pg => pg["Location"] === S.loc));
        const by = { now: (a, b) => b.now - a.now || a["Platform"].localeCompare(b["Platform"]),
                     name: (a, b) => a["Platform"].localeCompare(b["Platform"]),
                     togo: (a, b) => (b.togo || 0) - (a.togo || 0) || b.now - a.now };
        rows.sort(by[S.sort] || by.now);
        const cols = S.loc === "all" ? ORDER : [S.loc];
        let h = '<div class="rs-bar"><label class="rs-fld"><span>Find</span><input class="rs-inp" id="rvmQ" placeholder="Site, domain or category…" value="'
          + esc(S.q) + '"></label>'
          // the two pickers are kit localSelect mounts (wire), in the .rs-fld caption's form variant
          + '<div class="rs-fld"><span>Location</span><div class="rvm-pick" id="rvmLoc"></div></div>'
          + '<div class="rs-fld"><span>Sort</span><div class="rvm-pick" id="rvmSort"></div></div>'
          + '<span class="rs-spacer"></span><button class="rs-btn" id="rvmCsv">Download CSV</button></div>';
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Site</th><th>Now</th><th>Target</th><th>To go</th>"
          + cols.map(k => "<th>" + esc(LOC[k].label) + "</th>").join("") + "</tr></thead><tbody>";
        h += rows.length ? rows.map(p => "<tr><td><b>" + esc(p["Platform"]) + "</b>"
            + '<span class="rvm-dom">' + esc([p["Domain"], p["Category"]].filter(Boolean).join(" · ")) + "</span></td>"
            + "<td>" + fmt(p.now) + (p.known < p.pages.length ? ' <small class="dim">(' + (p.pages.length - p.known) + " unread)</small>" : "") + "</td>"
            + "<td>" + (p.target != null ? fmt(p.target) : "—") + "</td>"
            + '<td><span class="rvm-go' + (p.reached ? " ok" : "") + '">' + (p.target == null ? "—" : p.reached ? "reached" : fmt(p.togo)) + "</span></td>"
            + cols.map(k => '<td class="rvm-cell">' + p.pages.filter(pg => pg["Location"] === k).map(pg =>
                '<a href="' + esc(pg["URL"]) + '" target="_blank" rel="noopener">Open ↗</a><small' + (pg.now == null ? ' class="q"' : "")
                + ">" + fmt(pg.now) + "</small>").join("<br>") + "</td>").join("") + "</tr>").join("")
          : '<tr><td colspan="' + (4 + cols.length) + '" class="dim">No sites match.</td></tr>';
        return h + "</tbody></table></div></div>";
      }

      function changesView(M) {
        const rows = M.changes.slice(0, 500);
        return '<p class="rvm-note">Every time a page\'s known review count moved: from the weekly check, or typed in under Needs a count.</p>'
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Date</th><th>Site</th><th>Location</th><th>Before → after</th><th>How</th><th>Page</th></tr></thead><tbody>"
          + (rows.length ? rows.map(c => {
              const p = M.plats[c.pg["Platform Key"]] || {};
              const d = c.before == null ? "first count" : (c.after - c.before > 0 ? "+" : "") + (c.after - c.before);
              return "<tr><td class=\"nowrap\">" + esc(c.at) + "</td><td><b>" + esc(p["Platform"] || "") + "</b></td><td>"
                + esc((LOC[c.pg["Location"]] || {}).label || c.pg["Location"]) + "</td><td>" + (c.before == null ? "?" : fmt(c.before))
                + " → " + fmt(c.after) + ' <small class="dim">' + esc(d) + "</small></td><td class=\"muted\">" + esc(c.how)
                + '</td><td class="rvm-cell"><a href="' + esc(c.pg["URL"]) + '" target="_blank" rel="noopener">Open ↗</a></td></tr>';
            }).join("") : '<tr><td colspan="6" class="dim">No changes yet: they appear from the second check on.</td></tr>')
          + "</tbody></table></div></div>";
      }

      function needsView(M) {
        const rows = M.pages.filter(pg => pg.needs).sort((a, b) =>
          ((M.plats[a["Platform Key"]] || {})["Platform"] || "").localeCompare((M.plats[b["Platform Key"]] || {})["Platform"] || ""));
        const why = pg => !pg.last ? "not checked yet" : pg.last["Status"] === "blocked" ? "the site refuses automated visits"
          : pg.last["Status"] === "unreadable" ? "no count found on the page"
          : pg.last["Status"] === "suspect" || pg.last["Status"] === "rejected" ? "the number on the page looked wrong: " + (pg.last["Note"] || "")
          : "the page did not open";
        return '<p class="rvm-note">The weekly check could not read these pages, and their last count is more than '
          + STALE_DAYS + " days old (or there is none). Open the page, count the reviews and type the number: it stands "
          + "until the check reads one, or for " + STALE_DAYS + " days.</p>"
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Site</th><th>Location</th><th>Why</th><th>Last known</th><th>Page</th><th>Reviews now</th></tr></thead><tbody>"
          + (rows.length ? rows.map(pg => "<tr><td><b>" + esc((M.plats[pg["Platform Key"]] || {})["Platform"]) + "</b></td><td>"
              + esc((LOC[pg["Location"]] || {}).label || pg["Location"]) + '</td><td class="muted">' + esc(why(pg)) + "</td><td>"
              + (pg.known ? fmt(pg.now) + ' <small class="dim">' + esc(String(pg.known["Checked At"]).slice(0, 10)) + "</small>" : "?")
              + '</td><td class="rvm-cell"><a href="' + esc(pg["URL"]) + '" target="_blank" rel="noopener">Open ↗</a></td>'
              + '<td class="nowrap"><input class="rs-inp rvm-inp" type="number" min="0" data-rvcount="' + esc(pg["Page Key"]) + '"> '
              + '<button class="rs-btn" data-rvsave="' + esc(pg["Page Key"]) + '">Save</button></td></tr>').join("")
            : '<tr><td colspan="6" class="dim">Every page has a count.</td></tr>')
          + "</tbody></table></div></div>";
      }

      function editView(M) {
        const e = S.edit || {};
        const p = e.plat ? M.plats[e.plat] : null;
        let h = '<div class="panel"><h3 style="margin:0 0 4px">' + (p ? "Change " + esc(p["Platform"]) : "Add a review site") + "</h3>"
          + '<div class="rvm-form">'
          + '<label class="rs-fld"><span>Name</span><input class="rs-inp" id="rvfName" value="' + esc(p ? p["Platform"] : "") + '"></label>'
          + '<label class="rs-fld"><span>Website</span><input class="rs-inp" id="rvfDom" placeholder="homeadvisor.com" value="' + esc(p ? p["Domain"] || "" : "") + '"></label>'
          + '<label class="rs-fld"><span>Category</span><input class="rs-inp" id="rvfCat" placeholder="Directory" value="' + esc(p ? p["Category"] || "" : "") + '"></label>'
          + '<label class="rs-fld"><span>Target (reviews by ' + TARGET_DATE + ')</span><input class="rs-inp" id="rvfTgt" type="number" min="0" value="' + esc(p && p["Target"] != null ? p["Target"] : "") + '"></label>'
          + '<button class="rs-btn" id="rvfSave">' + (p ? "Save the site" : "Add the site") + "</button>"
          + (p ? '<button class="rs-btn" id="rvfCancel">New site instead</button>' : "") + "</div>";
        if (p) {
          h += '<h4 style="margin:12px 0 4px">Its pages</h4><ul class="rvm-edit-pages">'
            + (p.pages.length ? p.pages.map(pg => "<li><b>" + esc((LOC[pg["Location"]] || {}).label || pg["Location"]) + '</b><a href="'
              + esc(pg["URL"]) + '" target="_blank" rel="noopener">' + esc(pg["URL"]) + '</a><button class="rvm-x" data-rvdelpage="'
              + esc(pg["Page Key"]) + '">remove</button></li>').join("") : '<li class="dim">No pages yet.</li>') + "</ul>"
            + '<div class="rvm-form"><div class="rs-fld"><span>Location</span><div id="rvpLoc"></div></div>'
            + '<label class="rs-fld wide"><span>Page address</span><input class="rs-inp" id="rvpUrl" placeholder="https://…"></label>'
            + '<button class="rs-btn" id="rvpAdd">Add the page</button>'
            + '<button class="rs-btn" id="rvfDel">Remove this site</button></div>';
        }
        h += "</div>";
        const list = M.list.slice().sort((a, b) => a["Platform"].localeCompare(b["Platform"]));
        h += '<div class="panel" style="padding:0;margin-top:12px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Site</th><th>Pages</th><th>Target</th><th>Last change</th><th></th></tr></thead><tbody>"
          + (list.length ? list.map(q => "<tr><td><b>" + esc(q["Platform"]) + '</b><span class="rvm-dom">' + esc(q["Domain"] || "") + "</span></td><td>"
              + fmt(q.pages.length) + "</td><td>" + (q.target != null ? fmt(q.target) : "—") + '</td><td class="muted">'
              + esc(String(q["Entered At"] || "").slice(0, 10)) + " · " + esc(String(q["Entered By"] || "").split("@")[0]) + "</td>"
              + '<td><button class="rs-btn" data-rvedit="' + esc(q["Platform Key"]) + '">Edit</button></td></tr>').join("")
            : '<tr><td colspan="5" class="dim">No sites yet.</td></tr>') + "</tbody></table></div></div>";
        return h;
      }

      /* ---- the map ---------------------------------------------------------------------------- */
      function ensureLeaflet(cb) {
        if (window.L && window.L.map) { cb(); return; }
        if (!document.getElementById("rvmLeafCss")) {
          const lc = document.createElement("link");
          lc.id = "rvmLeafCss"; lc.rel = "stylesheet"; lc.href = "assets/vendor/leaflet/leaflet.css";
          document.head.appendChild(lc);
        }
        let sc = document.getElementById("rvmLeafJs");
        if (sc) { sc.addEventListener("load", () => cb()); return; }
        sc = document.createElement("script");
        sc.id = "rvmLeafJs"; sc.src = "assets/vendor/leaflet/leaflet.js";
        sc.onload = () => cb();
        document.head.appendChild(sc);
      }
      let STATES = null;
      function drawMap(M) {
        const el = host.querySelector("#rvmMap");
        if (!el) return;
        ensureLeaflet(() => {
          const go = () => {
            if (!alive() || !host.querySelector("#rvmMap")) return;
            const L0 = locStats(M);
            const m = MAP = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false })
              .setView([40.4, -75.2], 6);
            const dark = !document.body.classList.contains("light");
            const ESRI = "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_" + (dark ? "Dark" : "Light") + "_Gray_";
            L.tileLayer(ESRI + "Base/MapServer/tile/{z}/{y}/{x}", { maxZoom: 14 }).addTo(m);
            const byState = {};
            ORDER.forEach(k => { const st = LOC[k].st; if (st) byState[st] = (byState[st] || 0) + L0[k].pages; });
            const max = Math.max(1, ...Object.values(byState));
            if (STATES && STATES.features) {
              const lyr = L.geoJSON(STATES, {
                style: f => { const n = byState[f.properties.st] || 0;
                  return { color: "#C2410C", weight: 1, fillColor: "#EA580C", fillOpacity: n ? .12 + .5 * n / max : 0 }; },
              }).addTo(m);
              try { m.fitBounds(lyr.getBounds(), { padding: [10, 10] }); } catch (e) { /* keep the default view */ }
            }
            ORDER.filter(k => LOC[k].lat != null).forEach(k => {
              // short labels: Kearny, Shafto and New York sit within 40 miles of each other
              const icon = L.divIcon({ className: "", html: '<div class="rvm-pin' + (S.loc === k ? " sel" : "")
                + (L0[k].pages ? "" : " zero") + '">' + esc(LOC[k].pin) + " " + esc(fmt(L0[k].pages)) + "</div>", iconSize: null });
              L.marker([LOC[k].lat, LOC[k].lng], { icon, zIndexOffset: 100 * L0[k].pages }).addTo(m)
                .bindTooltip(esc(LOC[k].label) + ": " + fmt(L0[k].pages) + " pages, " + fmt(L0[k].now) + " reviews")
                .on("click", () => { S.loc = k; S.tab = "table"; paint(); });
            });
          };
          if (STATES) go();
          else fetch("assets/vendor/geo/states8.geojson").then(r => r.ok ? r.json() : null).catch(() => null)
            .then(j => { STATES = j; go(); });
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
        host.querySelectorAll("[data-rvtab]").forEach(t => { t.onclick = () => { S.tab = t.dataset.rvtab; S.msg = S.err = ""; paint(); }; });
        host.querySelectorAll("[data-rvloc]").forEach(t => { t.onclick = () => { S.loc = t.dataset.rvloc; S.tab = "table"; paint(); }; });
        if (S.tab === "map") drawMap(M);
        const q = host.querySelector("#rvmQ");
        if (q) { q.oninput = function () { S.q = this.value; }; q.onchange = paint; q.onkeyup = e => { if (e.key === "Enter") paint(); }; }
        // kit dropdowns: onChange runs on a CHANGE only, as the native selects' change event did
        const lo = host.querySelector("#rvmLoc");
        if (lo) RSC.localSelect(lo, { label: "Location", form: true, required: true, value: S.loc,
          values: [{ v: "all", l: "All locations" }].concat(ORDER.map(k => ({ v: k, l: LOC[k].label }))),
          onChange: v => { if (v === S.loc) return; S.loc = v; paint(); } });
        const so = host.querySelector("#rvmSort");
        if (so) RSC.localSelect(so, { label: "Sort", form: true, required: true, value: S.sort,
          values: [["now", "Most reviews"], ["togo", "Most to go"], ["name", "Name"]].map(([k, l]) => ({ v: k, l: l })),
          onChange: v => { if (v === S.sort) return; S.sort = v; paint(); } });
        // the new page's location starts on the first one each paint, as the native select did
        let pageLoc = ORDER[0];
        const pl = host.querySelector("#rvpLoc");
        if (pl) RSC.localSelect(pl, { label: "Location", form: true, required: true, value: pageLoc,
          values: ORDER.map(k => ({ v: k, l: LOC[k].label })), onChange: v => { pageLoc = v; } });
        const csv = host.querySelector("#rvmCsv");
        if (csv) csv.onclick = () => download(M);
        host.querySelectorAll("[data-rvsave]").forEach(b => {
          b.onclick = () => {
            const inp = host.querySelector('[data-rvcount="' + b.dataset.rvsave + '"]');
            const v = inp && inp.value.trim();
            if (v === "" || v == null) { S.err = "type the number of reviews first"; paint(); return; }
            act({ op: "count", page_key: b.dataset.rvsave, count: +v }, "Saved.");
          };
        });
        host.querySelectorAll("[data-rvedit]").forEach(b => { b.onclick = () => { S.edit = { plat: b.dataset.rvedit }; S.msg = S.err = ""; paint(); }; });
        const val = id => { const x = host.querySelector(id); return x ? x.value.trim() : ""; };
        const fs = host.querySelector("#rvfSave");
        if (fs) fs.onclick = () => {
          const key = S.edit && S.edit.plat;
          act({ op: "platform", key: key || undefined, platform: val("#rvfName"), domain: val("#rvfDom"),
                category: val("#rvfCat"), target: val("#rvfTgt") }, key ? "Site saved." : "Site added.")
            .then(() => { if (!key && !S.err) { const k2 = ST.platforms.find(p => p["Platform"] === val("#rvfName"));
              S.edit = k2 ? { plat: k2["Platform Key"] } : null; paint(); } });
        };
        const fc = host.querySelector("#rvfCancel");
        if (fc) fc.onclick = () => { S.edit = null; paint(); };
        const fd = host.querySelector("#rvfDel");
        if (fd) fd.onclick = () => {
          if (!confirm("Remove this site and all its pages from the list? Their check history is kept.")) return;
          act({ op: "remove-platform", key: S.edit.plat }, "Site removed.").then(() => { S.edit = null; paint(); });
        };
        const pa = host.querySelector("#rvpAdd");
        if (pa) pa.onclick = () => act({ op: "page", platform_key: S.edit.plat, location: pageLoc, url: val("#rvpUrl") },
          "Page added: the next weekly check reads it.");
        host.querySelectorAll("[data-rvdelpage]").forEach(b => {
          b.onclick = () => { if (confirm("Remove this page from the list?")) act({ op: "remove-page", key: b.dataset.rvdelpage }, "Page removed."); };
        });
      }

      function download(M) {
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [["Site", "Domain", "Category", "Target", "Location", "Page", "Reviews now", "Last read", "Status"].map(cell).join(",")];
        M.pages.forEach(pg => { const p = M.plats[pg["Platform Key"]] || {};
          lines.push([p["Platform"], p["Domain"], p["Category"], p["Target"], pg["Location"], pg["URL"], pg.now,
            pg.known ? String(pg.known["Checked At"]).slice(0, 10) : "", pg.last ? pg.last["Status"] : "not checked"].map(cell).join(",")); });
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "review-map-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }
    },
  });
})();
