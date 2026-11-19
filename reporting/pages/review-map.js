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
 *   MONTHLY      19 Nov 2026, tracker ZTZ-135: the 36 lines of Tako's "Number of Reviews" sheet (Google per
 *                state, Yelp, Facebook, Trustpilot, Angi ... and Tuji's five) are pages here too, each with
 *                the line it counts toward (rv_page `Report As`). Google is read through the Places API and
 *                our Facebook Page through the Graph API; the rest like any page. On the 1st of each month
 *                the loader saves every page's count (rv_month, src/review_month.py) and the portal's monthly
 *                review numbers read that from Dec 2026 instead of the sheet. The Monthly counts tab shows the
 *                lines, the saved months and the sheet beside them (the November check). Line pages stay out
 *                of the directory views (map, table, targets): those are Tako's smaller sites.
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
      // the Monthly counts tab (ZTZ-135): a difference reads green up / red down, a missing link takes a paste
      + ".rvm-dif{font-weight:700;white-space:nowrap}"
      + ".rvm-dif.up{color:#3F7D20}"
      + ".rvm-dif.down{color:#B3261E}"
      + ".rvm-linkin{width:220px}"
      + ".rvm-edit-pages li .rs-pill{flex:none}"
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
      /* a monthly line needs a count once a month: when the check cannot read it and its last count is from
         before the 25th that opens this month's window (25th to the 3rd: the 1st's save takes what is typed
         by the 3rd) */
      const NY_TODAY = (() => {
        try { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); }
        catch (e) { return new Date().toISOString().slice(0, 10); }
      })();
      const LINE_FROM = (() => {
        const [y, m, d] = NY_TODAY.split("-").map(Number);
        const [yy, mm] = d >= 25 ? [y, m] : (m === 1 ? [y - 1, 12] : [y, m - 1]);
        return yy + "-" + String(mm).padStart(2, "0") + "-25";
      })();
      const CO0 = "Zip to Zip";
      const lineOf = pg => String(pg["Report As"] || "").trim() || null;
      const coOf = pg => String(pg["Company"] || "").trim() || CO0;
      function model() {
        const byPage = {};
        CHECKS.slice().sort((a, b) => String(a["Checked At"]).localeCompare(String(b["Checked At"])))
          .forEach(c => { (byPage[c["Page Key"]] = byPage[c["Page Key"]] || []).push(c); });
        const plats = {};
        ST.platforms.forEach(p => { plats[p["Platform Key"]] = Object.assign({ pages: [], lines: [], now: 0, known: 0 }, p); });
        const pages = ST.pages.filter(pg => plats[pg["Platform Key"]]).map(pg => {
          const hist = byPage[pg["Page Key"]] || [];
          let known = null, last = null;
          hist.forEach(c => { last = c; if (c["Count"] != null && c["Count"] !== "") known = c; });
          const line = lineOf(pg);
          return Object.assign({}, pg, { hist, known, last, line, co: coOf(pg),
            now: known ? +known["Count"] : null,
            /* a page the check cannot read needs a typed count only once its last known count is older
               than STALE_DAYS -- otherwise Tako would retype two thirds of the list every week */
            /* "skipped": the site shows Google's reviews, never counted (Tako's rule) -- nothing to type */
            needs: line
              ? (!last || last["Status"] !== "ok") && (!known || String(known["Checked At"]).slice(0, 10) < LINE_FROM)
              : !last || (last["Status"] !== "ok" && last["Status"] !== "manual" && last["Status"] !== "skipped"
                && (!known || String(known["Checked At"]).slice(0, 10) < STALE_FROM)) });
        });
        // a site's directory pages make its Now and its place on the map; its line pages are the Monthly tab's
        pages.forEach(pg => {
          const p = plats[pg["Platform Key"]];
          if (pg.line) { p.lines.push(pg); return; }
          p.pages.push(pg);
          if (pg.now != null) { p.now += pg.now; p.known++; }
        });
        const all = Object.values(plats);
        // the directory views: every site with a directory page, or none yet (just added)
        const list = all.filter(p => p.pages.length || !p.lines.length);
        const dirPages = pages.filter(pg => !pg.line), linePages = pages.filter(pg => pg.line);
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
              how: /^sheet/i.test(String(c["Method"] || "")) ? "Tako's sheet"
                : c["Status"] === "manual" ? "typed by " + String(c["Entered By"] || "").split("@")[0]
                : c["Method"] === "Places API" || c["Method"] === "Graph API" ? "check · " + c["Method"] : "weekly check" });
            prev = n;
          });
        });
        changes.sort((a, b) => b.at.localeCompare(a.at));
        const lastAuto = CHECKS.filter(c => c["Status"] !== "manual").map(c => String(c["Checked At"])).sort().pop() || null;
        return { plats, all, list, pages, dirPages, linePages, changes, lastAuto, mo: monthly(linePages) };
      }

      /* the monthly lines, the months the loader saved (rv_month) and Tako's sheet as typed (review_counts) */
      function monthly(linePages) {
        const lines = {};
        linePages.forEach(pg => {
          const k = pg.co + "|" + pg.line;
          const L = lines[k] || (lines[k] = { k, co: pg.co, line: pg.line, pages: [], now: null, needs: false, auto: true });
          L.pages.push(pg);
          if (pg.now != null) L.now = (L.now || 0) + pg.now;
          if (pg.needs) L.needs = true;
          if (!pg.last || pg.last["Status"] !== "ok") L.auto = false;
        });
        const months = {}, sheet = {};
        (ST.months || []).forEach(r => {
          const d = String(r["Date"]).slice(0, 10), k = (r["Company"] || CO0) + "|" + r["Platform"];
          const e = (months[d] = months[d] || {})[k] || (months[d][k] = { n: null, how: [] });
          if (r["Count"] != null && r["Count"] !== "") e.n = (e.n || 0) + +r["Count"];
          e.how.push((r["Source"] || "not known") + (r["Known At"] ? " " + String(r["Known At"]).slice(0, 10) : ""));
        });
        (ST.sheet || []).forEach(r => {
          (sheet[String(r["Date"]).slice(0, 10)] = sheet[String(r["Date"]).slice(0, 10)] || {})[(r["Company"] || CO0) + "|" + r["Platform"]] = +r["Count"];
        });
        const mDates = Object.keys(months).sort(), sDates = Object.keys(sheet).sort();
        /* the side-by-side: the latest saved month (against the sheet's column for the same month, when typed);
           before the first save, the Review Map now against the sheet's latest column */
        let cmp = null;
        if (mDates.length) {
          const withSheet = mDates.filter(d => sheet[d]);
          const d = withSheet.length ? withSheet[withSheet.length - 1] : mDates[mDates.length - 1];
          const portal = {}, how = {};
          Object.entries(months[d]).forEach(([k, e]) => { portal[k] = e.n; how[k] = e.how.join(" + "); });
          cmp = { live: false, date: d, sheet: sheet[d] || {}, portal, how };
        } else if (sDates.length) {
          const d = sDates[sDates.length - 1], portal = {}, how = {};
          Object.values(lines).forEach(L => { portal[L.k] = L.now; how[L.k] = L.pages.map(knownHow).join(" + "); });
          cmp = { live: true, date: d, sheet: sheet[d], portal, how };
        }
        const order = Object.values(lines).sort((a, b) => (a.co !== CO0) - (b.co !== CO0) || a.co.localeCompare(b.co)
          || (b.now || 0) - (a.now || 0) || a.line.localeCompare(b.line));
        return { lines: order, byKey: lines, months, mDates, sheet, sDates, cmp };
      }
      function knownHow(pg) {
        const c = pg.known, l = pg.last;
        // why the last check did not read it, when it did not
        const why = !l || l === c || l["Status"] === "ok" || l["Status"] === "manual" ? ""
          : " · last check: " + (l["Status"] === "blocked" ? "the site refuses it" : l["Status"] === "no link" ? "no link"
            : l["Status"] === "suspect" ? "held back (" + String(l["Note"] || "").split(":")[0] + ")"
            : l["Status"] === "unreadable" ? (l["Note"] ? String(l["Note"]).split(":")[0] : "no count on the page") : "error");
        if (!c) return "not known" + why;
        const d = fmtD(c["Checked At"]), m = String(c["Method"] || "");
        if (/^(sheet|tako)/i.test(m)) return "Tako's sheet, " + d + why;
        if (c["Status"] === "manual") return "typed " + d + (c["Entered By"] ? " by " + String(c["Entered By"]).split("@")[0] : "") + why;
        return "read " + d + (m ? " · " + m : "") + why;
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
        const nLines = M.mo.lines.length;
        // a view of the Reviews hub: the hub draws the big head, this one sits a size down (ZTZ-80)
        let h = '<div class="rvm">'
          + RSC.pageHeadHtml({ title: "Review Map", key: "review-map",
              sub: "Every page of ours on the smaller review sites, the reviews on each and the target for "
                + TARGET_DATE + "; and the monthly review counts the reports use." });
        h += '<div class="rs-kpis" style="--kpi-cols:6">'
          + kpi(fmt(M.list.length), "Review sites", fmt(M.dirPages.length) + " pages of ours", "")
          + kpi(fmt(tot), "Reviews now", "the pages' latest known counts", "")
          + kpi(fmt(tgt), "Target", "by " + TARGET_DATE + " · " + fmt(togo) + " still to go", "")
          + kpi(fmt(reached) + " of " + fmt(M.list.length), "Sites at target", M.list.length ? Math.round(100 * reached / M.list.length) + "%" : "", reached ? "pos" : "")
          + kpi(fmt(needs), "Needs a count", "pages the check cannot read, with an old count", needs ? "warn" : "")
          + kpi(M.lastAuto ? M.lastAuto.slice(0, 10) : "—", "Last check", "weekly, automatic", "")
          + "</div>";
        const tabs = [["map", "Map"], ["table", "Table"], ["monthly", "Monthly counts · " + nLines],
                      ["changes", "Changes · " + M.changes.length], ["needs", "Needs a count · " + needs], ["edit", "Edit the list"]];
        h += '<div class="rvm-tabs">' + tabs.map(([k, l]) => '<div class="rs-tog' + (S.tab === k ? " on" : "")
          + '" data-rvtab="' + k + '"><i></i>' + esc(l) + "</div>").join("") + "</div>";
        if (S.err) h += '<div class="rvm-err">' + esc(S.err) + "</div>";
        if (S.msg) h += '<div class="rvm-ok">' + esc(S.msg) + "</div>";
        if (!M.all.length && S.tab !== "edit") {
          h += '<div class="panel">No review sites yet. Tako\'s list arrives with the import of her page, or add sites '
            + 'under <b>Edit the list</b>.</div>';
        } else if (S.tab === "map") h += mapView(M);
        else if (S.tab === "table") h += tableView(M);
        else if (S.tab === "monthly") h += monthlyView(M);
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
        M.dirPages.forEach(pg => { const o = out[pg["Location"]]; if (!o) return; o.pages++; o.now += pg.now || 0; });
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

      const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const fmtD = d => { const [y, m, dd] = String(d).slice(0, 10).split("-"); return +dd + " " + MON[+m - 1] + " " + y; };
      const sign = n => n == null ? "—" : (n > 0 ? "+" : "") + fmt(n);
      function monthlyView(M) {
        const mo = M.mo;
        const from = ST.snapshot_from || "2026-12-01", grace = ST.grace_days || 3;
        if (!mo.lines.length) {
          return '<div class="panel">No monthly lines yet. They arrive with the seed of Tako\'s sheet '
            + "(scripts/seed_review_lines.py); until then the monthly review numbers come from her sheet.</div>";
        }
        const auto = mo.lines.filter(L => L.auto).length, need = mo.lines.filter(L => L.needs).length;
        const nowTot = mo.lines.reduce((a, L) => a + (L.now || 0), 0);
        let h = '<p class="rvm-note">From <b>' + esc(fmtD(from)) + "</b> the monthly review numbers in the Monthly Report, "
          + "Reviews, the Seasonal Report and the Marketing Overview come from these lines instead of Tako's "
          + "“Number of Reviews” sheet. On the 1st of each month the portal reads every line and saves it as the "
          + "month's opening count; a line it cannot read needs a count typed under <b>Needs a count</b> between the "
          + "25th and the " + grace + "rd. Google is read through Google's own API, Facebook through our Page, the rest "
          + "off their pages.</p>";
        h += '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(fmt(mo.lines.length), "Monthly lines", "the sheet's rows, " + fmt(M.linePages.length) + " pages", "")
          + kpi(fmt(nowTot), "Reviews now", "the lines' latest known counts", "")
          + kpi(fmt(auto) + " of " + fmt(mo.lines.length), "Read automatically", "at the last check", auto ? "pos" : "")
          + kpi(fmt(need), "Need a count", need ? "type them under Needs a count"
              : fmt(mo.lines.length - auto) + " the check cannot read: asked for from the 25th", need ? "warn" : "")
          + "</div>";
        h += compareView(mo);
        // the lines, with the last three saved months beside Now
        const shown = mo.mDates.slice(-3);
        h += '<div class="panel" style="padding:0;margin-top:12px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Line</th><th>Site · location</th>" + shown.map(d => "<th>" + esc(fmtD(d)) + "</th>").join("")
          + "<th>Now</th><th>How the portal knows it</th><th>Page</th></tr></thead><tbody>";
        h += mo.lines.map(L => {
          const pg = L.pages[0], site = (M.plats[pg["Platform Key"]] || {})["Platform"] || "";
          return "<tr><td><b>" + esc(L.line) + "</b>" + (L.co !== CO0 ? ' <span class="rs-pill info">' + esc(L.co) + "</span>" : "")
            + (L.needs ? ' <span class="rs-pill warn">needs a count</span>' : "") + "</td>"
            + '<td class="muted">' + esc(site + " · " + ((LOC[pg["Location"]] || {}).label || pg["Location"])) + "</td>"
            + shown.map(d => { const e = (mo.months[d] || {})[L.k]; return "<td>" + (e ? fmt(e.n) : "—") + "</td>"; }).join("")
            + "<td><b>" + fmt(L.now) + "</b></td>"
            + '<td class="muted">' + esc(L.pages.map(knownHow).join(" + ")) + "</td>"
            + '<td class="rvm-cell">' + L.pages.map(q => q["URL"]
                ? '<a href="' + esc(q["URL"]) + '" target="_blank" rel="noopener">Open ↗</a>'
                : '<input class="rs-inp rvm-linkin" placeholder="paste the page\'s link" data-rvlinkin="' + esc(q["Page Key"]) + '"> '
                  + '<button class="rs-btn" data-rvlink="' + esc(q["Page Key"]) + '">Save the link</button>').join("<br>") + "</td></tr>";
        }).join("");
        return h + "</tbody></table></div></div>";
      }

      /* Tako's sheet beside the Review Map, line by line: the November check, and every month after it the
         sheet still has a column for */
      function compareView(mo) {
        const c = mo.cmp;
        if (!c) return "";
        const keys = Array.from(new Set(Object.keys(c.sheet).concat(Object.keys(c.portal))));
        const rows = keys.map(k => {
          const [co, line] = k.split("|"), sv = c.sheet[k], pv = c.portal[k];
          return { co, line, sv: sv == null ? null : sv, pv: pv == null ? null : pv,
                   d: sv != null && pv != null ? pv - sv : null, how: c.how[k] || "not on the Review Map" };
        }).sort((a, b) => (b.d == null ? 1e9 : Math.abs(b.d)) - (a.d == null ? 1e9 : Math.abs(a.d)) || a.line.localeCompare(b.line));
        const sheetHas = Object.keys(c.sheet).length > 0;
        // no sheet column for the month: nothing to set beside the save, so no total and no difference
        const st = sheetHas ? rows.reduce((a, r) => a + (r.sv || 0), 0) : null, pt = rows.reduce((a, r) => a + (r.pv || 0), 0);
        const differ = sheetHas ? rows.filter(r => r.d !== 0).length : null;
        const title = c.live ? "Preview: Tako's sheet (" + fmtD(c.date) + ") beside the Review Map now"
          : "Tako's sheet beside the Review Map's save of " + fmtD(c.date);
        let h = '<div class="panel" style="margin-top:12px"><div class="panel-title">' + esc(title) + "</div>"
          + '<p class="rvm-note">' + (c.live
            ? "No month is saved yet: the first save is on " + fmtD(ST.snapshot_from || "2026-12-01") + ". Until then this puts the "
              + "sheet's latest column beside what the Review Map knows now, so a line that reads differently shows early."
            : sheetHas ? "The sheet's " + fmtD(c.date) + " column as Tako typed it, and what the Review Map saved for the same day. "
              + "A difference is either a line the sheet and the site count differently or a count that moved between the two readings."
            : "The sheet has no " + fmtD(c.date) + " column yet: the Review Map's save is shown alone.") + "</p>"
          + '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(st == null ? "—" : fmt(st), "Tako's sheet", fmtD(c.date) + " column" + (st == null ? ": not typed yet" : ""), "")
          + kpi(fmt(pt), "Review Map", c.live ? "now" : "saved " + fmtD(c.date), "")
          + kpi(st == null ? "—" : sign(pt - st), "Difference", "Review Map minus sheet", st == null ? "" : pt === st ? "pos" : "warn")
          + kpi(differ == null ? "—" : fmt(differ) + " of " + fmt(rows.length), "Lines that differ", "",
              differ == null ? "" : differ ? "warn" : "pos")
          + "</div>"
          + '<div class="rs-tablewrap"><table class="rs-table rs-even"><thead><tr><th>Line</th><th>Tako\'s sheet</th>'
          + "<th>Review Map</th><th>Difference</th><th>How the Review Map knows it</th></tr></thead><tbody>"
          + rows.map(r => "<tr><td><b>" + esc(r.line) + "</b>" + (r.co !== CO0 ? ' <span class="rs-pill info">' + esc(r.co) + "</span>" : "")
            + "</td><td>" + fmt(r.sv) + "</td><td>" + fmt(r.pv) + '</td><td><span class="rvm-dif' + (r.d > 0 ? " up" : r.d < 0 ? " down" : "")
            + '">' + esc(sign(r.d)) + '</span></td><td class="muted">' + esc(r.how) + "</td></tr>").join("")
          + "</tbody></table></div></div>";
        return h;
      }

      function changesView(M) {
        const rows = M.changes.slice(0, 500);
        return '<p class="rvm-note">Every time a page\'s known review count moved: from the weekly check, or typed in under Needs a count.</p>'
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Date</th><th>Site</th><th>Location</th><th>Before → after</th><th>How</th><th>Page</th></tr></thead><tbody>"
          + (rows.length ? rows.map(c => {
              const p = M.plats[c.pg["Platform Key"]] || {};
              const d = c.before == null ? "first count" : (c.after - c.before > 0 ? "+" : "") + (c.after - c.before);
              return "<tr><td class=\"nowrap\">" + esc(c.at) + "</td><td><b>" + esc(p["Platform"] || "") + "</b>"
                + (c.pg.line ? ' <span class="rs-pill mute">' + esc((c.pg.co !== CO0 ? c.pg.co + " · " : "") + c.pg.line) + "</span>" : "")
                + "</td><td>"
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
          : pg.last["Status"] === "no link" ? "no link yet: add it on the Monthly counts tab, or type the count"
          : pg.last["Status"] === "manual" ? "a monthly line: its last count is from before the 25th"
          : pg.last["Status"] === "unreadable" ? (pg.last["Note"] || "no count found on the page")
          : pg.last["Status"] === "suspect" || pg.last["Status"] === "rejected" ? "the number on the page looked wrong: " + (pg.last["Note"] || "")
          : "the page did not open";
        return '<p class="rvm-note">The weekly check could not read these pages, and their last count is more than '
          + STALE_DAYS + " days old (or there is none). Open the page, count the reviews and type the number: it stands "
          + "until the check reads one, or for " + STALE_DAYS + " days. A <b>monthly line</b> (Google NJ, Yelp CT …) "
          + "is asked for once a month, from the 25th: the count typed by the " + (ST.grace_days || 3) + "rd is the one the "
          + "1st's save keeps for the monthly review numbers.</p>"
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Site</th><th>Location</th><th>Why</th><th>Last known</th><th>Page</th><th>Reviews now</th></tr></thead><tbody>"
          + (rows.length ? rows.map(pg => "<tr><td><b>" + esc((M.plats[pg["Platform Key"]] || {})["Platform"]) + "</b>"
              + (pg.line ? ' <span class="rs-pill info">' + esc((pg.co !== CO0 ? pg.co + " · " : "") + pg.line) + "</span>" : "") + "</td><td>"
              + esc((LOC[pg["Location"]] || {}).label || pg["Location"]) + '</td><td class="muted">' + esc(why(pg)) + "</td><td>"
              + (pg.known ? fmt(pg.now) + ' <small class="dim">' + esc(String(pg.known["Checked At"]).slice(0, 10)) + "</small>" : "?")
              + '</td><td class="rvm-cell">' + (pg["URL"] ? '<a href="' + esc(pg["URL"]) + '" target="_blank" rel="noopener">Open ↗</a>'
                : '<span class="dim">no link</span>') + "</td>"
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
            + (p.pages.concat(p.lines).length ? p.pages.concat(p.lines).map(pg => "<li><b>" + esc((LOC[pg["Location"]] || {}).label || pg["Location"]) + "</b>"
              + (pg.line ? '<span class="rs-pill info">' + esc((pg.co !== CO0 ? pg.co + " · " : "") + pg.line) + "</span>" : "")
              + (pg["URL"] ? '<a href="' + esc(pg["URL"]) + '" target="_blank" rel="noopener">' + esc(pg["URL"]) + "</a>" : '<span class="dim">no link yet</span>')
              + '<button class="rvm-x" data-rvdelpage="' + esc(pg["Page Key"]) + '">remove</button></li>').join("") : '<li class="dim">No pages yet.</li>') + "</ul>"
            + '<div class="rvm-form"><div class="rs-fld"><span>Location</span><div id="rvpLoc"></div></div>'
            + '<label class="rs-fld wide"><span>Page address</span><input class="rs-inp" id="rvpUrl" placeholder="https://…"></label>'
            + '<div class="rs-fld"><span>Company</span><div id="rvpCo"></div></div>'
            + '<label class="rs-fld"><span>Monthly line (only for one)</span><input class="rs-inp" id="rvpLine" list="rvpLines" placeholder="e.g. Google NJ"></label>'
            + '<datalist id="rvpLines">' + M.mo.lines.map(L => '<option value="' + esc(L.line) + '">').join("") + "</datalist>"
            + '<button class="rs-btn" id="rvpAdd">Add the page</button>'
            + '<button class="rs-btn" id="rvfDel">Remove this site</button></div>';
        }
        h += "</div>";
        // every site, the big ones whose pages are all monthly lines too
        const list = M.all.slice().sort((a, b) => a["Platform"].localeCompare(b["Platform"]));
        h += '<div class="panel" style="padding:0;margin-top:12px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Site</th><th>Pages</th><th>Target</th><th>Last change</th><th></th></tr></thead><tbody>"
          + (list.length ? list.map(q => "<tr><td><b>" + esc(q["Platform"]) + '</b><span class="rvm-dom">' + esc(q["Domain"] || "") + "</span></td><td>"
              + fmt(q.pages.length + q.lines.length) + (q.lines.length ? ' <small class="dim">(' + q.lines.length + " monthly)</small>" : "")
              + "</td><td>" + (q.target != null ? fmt(q.target) : "—") + '</td><td class="muted">'
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
        let pageCo = CO0;
        const pc = host.querySelector("#rvpCo");
        if (pc) RSC.localSelect(pc, { label: "Company", form: true, required: true, value: pageCo,
          values: (ST.companies || [CO0, "Tuji"]).map(c => ({ v: c, l: c })), onChange: v => { pageCo = v; } });
        // a monthly line without a link: the pasted link becomes the page's (its line and company stay)
        host.querySelectorAll("[data-rvlink]").forEach(b => {
          b.onclick = () => {
            const pg = M.pages.find(x => x["Page Key"] === b.dataset.rvlink);
            const inp = host.querySelector('[data-rvlinkin="' + b.dataset.rvlink + '"]');
            const u = inp && inp.value.trim();
            if (!pg || !u) { S.err = "paste the page's link first"; paint(); return; }
            act({ op: "page", key: pg["Page Key"], platform_key: pg["Platform Key"], location: pg["Location"], url: u,
                  registered: pg["Registered"] || "" }, "Link saved: the next check reads it.");
          };
        });
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
        if (pa) pa.onclick = () => act({ op: "page", platform_key: S.edit.plat, location: pageLoc, url: val("#rvpUrl"),
          company: pageCo, report_as: val("#rvpLine") }, "Page added: the next weekly check reads it.");
        host.querySelectorAll("[data-rvdelpage]").forEach(b => {
          b.onclick = () => { if (confirm("Remove this page from the list?")) act({ op: "remove-page", key: b.dataset.rvdelpage }, "Page removed."); };
        });
      }

      function download(M) {
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [["Site", "Domain", "Category", "Target", "Location", "Company", "Monthly line", "Page", "Reviews now", "Last read",
          "Status"].map(cell).join(",")];
        M.pages.forEach(pg => { const p = M.plats[pg["Platform Key"]] || {};
          lines.push([p["Platform"], p["Domain"], p["Category"], p["Target"], pg["Location"], pg.co, pg.line || "", pg["URL"], pg.now,
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
