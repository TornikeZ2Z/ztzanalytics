/* CENSUS DATA — the Census survey figures behind Seasonal Planning, laid open for Marketing.
 *
 * Tornike, 2026-09-23: "let marketing team observe the data we just took from that census …
 * make sure it is correct data". So the page does two jobs, in this order:
 *
 *   1. PROVE IT. The state tie-out sets our ZIP figures, summed per state, beside the Census
 *      Bureau's OWN state total from the same dataset. Population ties to a fraction of a
 *      percent; movers run ~1% over BY DESIGN (our per-ZIP figure is population x mover rate
 *      and the rate's base leaves out babies under one), so the table shows that expected gap
 *      and what is left after it. Coverage then says, per state, how many ZIPs carry each
 *      figure and why the rest do not.
 *   2. LET THEM LOOK. One row per postal ZIP in the ten states, including the ZIPs the Census
 *      draws no area for, each with its margin of error and a reliability chip, searchable,
 *      filterable, exportable, and linked to the Census's own page for that area.
 *
 * VIEW ONLY (his call): no flag queue, no weekly re-check. Zillow is deliberately NOT here.
 * No map yet (table first). High-turnover ZIPs (campus, base, prison, downtown rentals) are
 * LABELLED, never excluded.
 *
 * The words matter more than usual here because the audience will quote them:
 *   - Mover rate = the share of PEOPLE aged 1 and over who lived in a different house a year
 *     earlier. Not households. A family of four that moves is four movers.
 *   - 5-year estimate = interviews pooled over 2020-2024. Not "2024's numbers".
 *   - A ZCTA is the Census's drawing of a ZIP's delivery area. PO boxes and business ZIPs
 *     have none, so they have no residents to count.
 *   - Income is top/bottom coded: $250,000+ and $2,500 or less are bands, not values.
 *
 * Data: mart_census_zip + mart_census_state (src/curated.py), fed by ext_acs_zcta and
 * ext_acs_state (src/area_external.py, sources=area-external).
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.census_zip) {
    RS.DATASETS.census_zip = {
      table: "mart_census_zip",
      cols: ["Zip", "City", "County", "State", "State Name", "Has ZCTA", "Has ACS", "Status", "Status Label",
             "Census 2020 Population",
             "Population", "Population MOE", "Median Income", "Median Income MOE", "Income Coded",
             "Mover Rate", "Mover Rate MOE", "Owner Share", "Owner Share MOE", "Movers Per Year",
             "Mover Rate CV", "Income CV", "Mover Reliability", "Income Reliability", "Leads 12m",
             "MOE Method", "Vintage", "Census Loaded"],
    };
    RS.DATASETS.census_state = {
      table: "mart_census_state",
      cols: ["State", "State Name", "ZIPs", "With Census Area", "With ACS Row", "With Residents", "With Income",
             "With Mover Rate", "No ZCTA", "ZCTA No ACS", "Unchecked", "No ACS Pop 2020",
             "No Residents", "Income Withheld", "High Turnover",
             "County Unknown", "Mover High", "Mover Medium", "Mover Low",
             "Our Population", "Our Movers", "Census Population", "Census Aged 1 Plus",
             "Census Movers", "Census Movers MOE", "Census Mover Rate", "Census Mover Rate MOE",
             "Census Median Income", "Census Median Income MOE", "Census Owner Share",
             "Population Gap Pct", "Explained Gap Pct", "Movers Gap Pct", "Under One Pct", "Movers Residual Pct",
             "Leads 12m", "Vintage", "Census Loaded", "State Vintage", "State Loaded"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("csd-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "csd-style";
    // Bars, fields, tables, pills and tiles come from THE COMPONENT KIT in rs.css. Only what
    // the kit has no name for lives here, and all of it under .csd.
    st.textContent = ""
      + ".csd{font-variant-numeric:tabular-nums}"
      // the provenance strip: where the numbers come from, in one line of facts
      + ".csd .csd-prov{display:flex;flex-wrap:wrap;gap:8px 22px;align-items:baseline;"
      + "padding:12px 16px;margin:0 0 14px;border:1px solid var(--line);border-radius:12px;"
      + "background:var(--panel-2);font-size:12.5px;color:var(--muted)}"
      + ".csd .csd-prov b{color:var(--ink);font-weight:750}"
      + ".csd .csd-prov .csd-k{display:block;font-size:10.5px;font-weight:800;letter-spacing:.07em;"
      + "text-transform:uppercase;color:var(--faint);margin-bottom:3px}"
      // is / is not: two columns that stack on a phone
      + ".csd .csd-isnot{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 26px}"
      + "@media(max-width:820px){.csd .csd-isnot{grid-template-columns:1fr}}"
      + ".csd .csd-isnot h4{margin:0 0 8px;font-size:12px;font-weight:800;letter-spacing:.06em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".csd .csd-isnot ul{margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:var(--ink)}"
      + ".csd .csd-isnot li{margin:0 0 5px}"
      + ".csd .csd-isnot li span{color:var(--muted)}"
      // a margin of error rides beside its value, quieter
      + ".csd .csd-moe{color:var(--faint);font-size:12px;font-weight:600;margin-left:5px;white-space:nowrap}"
      + ".csd .csd-cell{white-space:nowrap}"
      + ".csd .csd-cell .rs-pill{margin-left:6px;padding:1px 7px;font-size:10.5px}"
      // the place under the ZIP
      + ".csd .csd-zip{font-weight:800;color:var(--ink);letter-spacing:.02em}"
      + ".csd .csd-place{display:block;font-size:12px;color:var(--muted);margin-top:2px;white-space:nowrap}"
      // the tie-out verdict: the gap bar reads before the number does
      + ".csd .csd-gap{font-weight:750}"
      + ".csd .csd-gap.ok{color:var(--pos)}.csd .csd-gap.warn{color:var(--warn)}.csd .csd-gap.bad{color:var(--neg)}"
      // reliability distribution: three segments, one row per state
      + ".csd .csd-dist{display:flex;height:8px;border-radius:5px;overflow:hidden;min-width:120px;"
      + "background:var(--line)}"
      + ".csd .csd-dist i{display:block;height:100%}"
      + ".csd .csd-dist .h{background:var(--pos)}.csd .csd-dist .m{background:var(--warn)}"
      + ".csd .csd-dist .l{background:var(--neg)}"
      + ".csd .csd-legend{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);margin-top:10px}"
      + ".csd .csd-legend i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}"
      + ".csd .csd-legend .h{background:var(--pos)}.csd .csd-legend .m{background:var(--warn)}"
      + ".csd .csd-legend .l{background:var(--neg)}"
      + ".csd .csd-warnbox{border:1px solid var(--warn);background:var(--warn-bg);color:var(--ink);"
      + "border-radius:12px;padding:11px 14px;margin:0 0 14px;font-size:13px;line-height:1.55}"
      + ".csd .csd-more{display:flex;gap:12px;align-items:center;justify-content:center;padding:12px 0 2px}"
      + ".csd .csd-tot td{font-weight:800;border-top:2px solid var(--line-2)}"
      + ".csd .csd-src{font-size:12px;font-weight:700;white-space:nowrap}"
      + ".csd th.csd-sort{cursor:pointer;user-select:none}"
      + ".csd th.csd-sort:hover{color:var(--ink)}"
      + ".csd th.csd-sort.on{color:var(--ink)}";
    document.head.appendChild(st);
  }

  const STATE_ORDER = ["NJ", "PA", "NY", "DE", "CT", "MA", "MD", "VA", "RI", "NH"];
  // The labels mirror mart_census_zip's `Status Label`. 2026-09-23 review: a missing ACS row is
  // no longer read as "no residents" -- it is checked against the 2020 census's own list of ZIP
  // areas (zcta_no_acs = real area the ACS skips; unchecked = the list is not loaded yet), and the
  // 35%-movers label names what that rule really catches instead of calling downtowns campuses.
  const STATUS = {
    full:         { l: "Full data", pill: "" },
    turnover:     { l: "High-turnover area — campus, base, prison or downtown rentals", pill: "info" },
    withheld:     { l: "Census withheld: too few households", pill: "warn" },
    zcta_no_acs:  { l: "Census area exists — the ACS publishes no row for it", pill: "bad" },
    unchecked:    { l: "No ACS row — not yet checked against the Census area list", pill: "warn" },
    no_residents: { l: "Census area with no residents", pill: "mute" },
    no_zcta:      { l: "PO box / business ZIP — no residents", pill: "mute" },
  };
  const REL = { High: "ok", Medium: "warn", Low: "bad", Unknown: "mute" };
  const PAGE = 150;

registerPage({
  id: "census-data",
  group: "marketing",
  title: "Census Data",
  subtitle: "The Census survey figures behind Seasonal Planning — population, income, movers and " +
            "home ownership for every ZIP in our ten states, checked against the Census's own totals.",
  datasets: [],

  render: function (host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const num = v => (v == null || v === "" || isNaN(+v)) ? null : +v;
    const fmtN = v => num(v) == null ? "—" : Math.round(+v).toLocaleString("en-US");
    const fmtP = (v, d) => num(v) == null ? "—" : (+v * 100).toFixed(d == null ? 1 : d) + "%";
    const fmt$ = v => num(v) == null ? "—" : "$" + Math.round(+v).toLocaleString("en-US");
    const fmtGap = v => num(v) == null ? "—" : (+v > 0 ? "+" : +v < 0 ? "−" : "") + Math.abs(+v).toFixed(2) + "%";
    const fmtDate = s => {
      if (!s) return "—";
      const d = new Date(String(s).replace(" ", "T") + "Z");
      return isNaN(d) ? String(s).slice(0, 10)
        : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    };

    const S = window.__CSD || (window.__CSD = { q: "", st: "", county: "", status: "", sort: "movers", dir: -1, shown: PAGE });
    injectStyle();
    host.innerHTML = '<div class="csd"><div class="panel">Loading the Census data…</div></div>';
    const mine = host.querySelector(".csd");
    // #content is one element shared by every report: never paint over the page the reader
    // navigated to while this one was still loading
    const alive = () => host.querySelector(".csd") === mine;

    return Promise.all([RS.load("census_zip"), RS.load("census_state").catch(() => [])]).then(([zrows, srows]) => {
      if (!alive()) return;
      zrows = zrows || [];
      srows = srows || [];
      if (!zrows.length) {
        mine.innerHTML = '<div class="panel">No Census rows yet — the mart builds on the next pipeline '
          + "run after the Census load (sources=area-external).</div>";
        return;
      }
      const Z = zrows.map(r => ({
        zip: String(r.Zip || ""), city: r.City || "", county: r.County || "", st: r.State || "",
        stName: r["State Name"] || r.State || "", has: +r["Has ZCTA"] === 1, hasAcs: +r["Has ACS"] === 1,
        status: r.Status || "full", statusLabel: r["Status Label"] || "",
        pop20: num(r["Census 2020 Population"]), moeMethod: r["MOE Method"] || "",
        pop: num(r.Population), popM: num(r["Population MOE"]),
        inc: num(r["Median Income"]), incM: num(r["Median Income MOE"]), coded: r["Income Coded"] || "",
        mr: num(r["Mover Rate"]), mrM: num(r["Mover Rate MOE"]),
        own: num(r["Owner Share"]), ownM: num(r["Owner Share MOE"]),
        movers: num(r["Movers Per Year"]), mrCv: num(r["Mover Rate CV"]), incCv: num(r["Income CV"]),
        mrRel: r["Mover Reliability"] || "", incRel: r["Income Reliability"] || "",
        leads: num(r["Leads 12m"]) || 0, vintage: r.Vintage || "", loaded: r["Census Loaded"] || "",
      }));
      const byOrder = (a, b) => (STATE_ORDER.indexOf(a.State) - STATE_ORDER.indexOf(b.State));
      // the state mart builds right after the ZIP mart; should it be missing, the coverage
      // counts are rebuilt here from the ZIP rows (same definitions) and the tie-out waits
      const ST = (srows.length ? srows : STATE_ORDER.filter(st => Z.some(z => z.st === st)).map(st => {
        const L = Z.filter(z => z.st === st), c = f => L.filter(f).length;
        const noAcs = L.filter(z => z.status === "zcta_no_acs");
        return { State: st, "State Name": L[0].stName, ZIPs: L.length, "With Census Area": c(z => z.has),
          "With ACS Row": c(z => z.hasAcs),
          "With Residents": c(z => z.pop > 0), "With Income": c(z => z.inc != null),
          "With Mover Rate": c(z => z.mr != null && z.pop > 0), "No ZCTA": c(z => z.status === "no_zcta"),
          "ZCTA No ACS": noAcs.length, "Unchecked": c(z => z.status === "unchecked"),
          "No ACS Pop 2020": noAcs.reduce((a, z) => a + (z.pop20 || 0), 0),
          "No Residents": c(z => z.status === "no_residents"), "Income Withheld": c(z => z.pop > 0 && z.inc == null),
          "High Turnover": c(z => z.status === "turnover"), "County Unknown": c(z => !z.county),
          "Mover High": c(z => z.mrRel === "High"), "Mover Medium": c(z => z.mrRel === "Medium"),
          "Mover Low": c(z => z.mrRel === "Low"), "Leads 12m": L.reduce((a, z) => a + z.leads, 0) };
      })).slice().sort(byOrder);
      const vintage = (Z.find(z => z.vintage) || {}).vintage || "—";
      const loaded = Z.reduce((m, z) => (z.loaded > m ? z.loaded : m), "");
      const stateLoaded = ST.some(s => s["State Loaded"]);
      // Mover-rate margins print only when the ZIP rows THEMSELVES say they were built by the
      // corrected method (`MOE Method`, stamped by area_external.py on every row). 2026-09-23
      // review: this used to be inferred from the state totals being loaded, but those load
      // independently -- a failed state call would have hidden correct margins (and called them
      // wrong), and stale state totals could have vouched for old ones.
      const moeOk = Z.some(z => z.hasAcs && z.moeMethod);
      // the ZIP areas the ACS publishes no row for (2026-09-23: 11717 Brentwood + 11798 Wyandanch)
      const skipped = Z.filter(z => z.status === "zcta_no_acs");
      const nUnchecked = Z.filter(z => z.status === "unchecked").length;
      const skippedList = L => L.map(z => esc(z.zip) + " " + esc(z.city || "")).join(", ");

      /* ---------------- tiles ---------------- */
      const tot = k => ST.reduce((a, s) => a + (num(s[k]) || 0), 0);
      const nZip = Z.length, nRow = Z.filter(z => z.has).length;
      const nPo = Z.filter(z => z.status === "no_zcta").length;
      const pop = Z.reduce((a, z) => a + (z.pop || 0), 0);
      const mov = Z.reduce((a, z) => a + (z.movers || 0), 0);
      const popGapMax = ST.length && stateLoaded
        ? Math.max.apply(null, ST.map(s => Math.abs(num(s["Population Gap Pct"]) || 0))) : null;
      const kpi = (val, lab, sub) => '<div class="kpi"><div class="l">' + esc(lab)
        + '</div><div class="v">' + esc(val) + '</div><div class="s">' + sub + "</div></div>";

      let h = '<div class="rs-kpis" style="--kpi-cols:4">'
        + kpi(fmtN(nZip), "ZIPs in our ten states",
              fmtN(nRow) + " have a Census area · " + fmtN(nPo) + " are PO box / business ZIPs"
              + (skipped.length ? " · " + fmtN(skipped.length) + " skipped by the ACS" : "")
              + (nUnchecked ? " · " + fmtN(nUnchecked) + " not yet checked" : ""))
        + kpi(fmtN(pop), "People counted", "summed over the ZIPs · " + esc(vintage))
        + kpi(fmtN(mov), "Movers a year",
              "<b>people</b> who moved house in a year — population × mover rate")
        + kpi(popGapMax == null ? "—" : "±" + popGapMax.toFixed(2) + "%", "Ties to the Census",
              popGapMax == null ? "the Census's own state totals load with the next Census refresh"
                : "largest population gap, any state, against the Census's own total")
        + "</div>";

      /* ---------------- provenance ---------------- */
      h += '<div class="csd-prov">'
        + '<div><span class="csd-k">Source</span><b>U.S. Census Bureau</b> — American Community Survey (api.census.gov)</div>'
        + '<div><span class="csd-k">Vintage</span><b>' + esc(vintage) + "</b> — interviews pooled over 2020–2024</div>"
        + '<div><span class="csd-k">Geography</span><b>ZCTA</b> — the Census\'s drawing of each ZIP\'s area</div>'
        + '<div><span class="csd-k">Loaded</span><b>' + esc(fmtDate(loaded)) + "</b>"
        + (stateLoaded ? "" : " · state totals not loaded yet") + "</div>"
        + '<div><span class="csd-k">States</span><b>' + STATE_ORDER.join(" ") + "</b></div>"
        + '<div><span class="csd-k">Use</span><b>View only</b> — nothing here changes a plan</div>'
        + "</div>";

      if (!moeOk) {
        h += '<div class="csd-warnbox"><b>Mover-rate margins are held back until the next Census refresh.</b> '
          + "The first load worked the margin out from “everyone aged 1+” minus “same house”, which "
          + "treats two nearly identical counts as independent and made the margin about 3.6 times too wide "
          + "(Freehold 07728 read 6.1% ±3.2 points; the Census publishes ±1.2). The estimates themselves are "
          + "right. The corrected margins arrive with the next Census load (sources=area-external); until "
          + "then this page shows mover rates without a ± or a reliability chip.</div>";
      }
      if (nUnchecked) {
        h += '<div class="csd-warnbox"><b>' + fmtN(nUnchecked) + " ZIPs have no ACS row and are not yet checked.</b> "
          + "The 2020 census's list of ZIP areas, which tells a PO box or business ZIP from a real area the "
          + "survey simply skipped, arrives with the next Census load. Until then these rows claim nothing "
          + "about residents.</div>";
      }

      /* ---------------- is / is not ---------------- */
      h += '<div class="panel"><div class="panel-head"><span class="panel-title">What this data is — and is not</span></div>'
        + '<div class="csd-isnot"><div><h4>It is</h4><ul>'
        // 2026-09-23 review: not every figure has a ± (movers a year, top/bottom-coded incomes,
        // and mover rates until the corrected margins load), so the sentence says "where"
        + "<li><b>A survey estimate</b> for the people living in each ZIP's area. <span>Survey figures carry a "
        + "margin of error at 90% confidence, shown as ± where the Census publishes one"
        + (moeOk ? "" : " (mover-rate margins are held back until the next refresh)") + ".</span></li>"
        + "<li><b>A 5-year estimate.</b> <span>Interviews from 2020 to 2024 pooled into one figure — the only "
        + "ACS product published down to ZIP level. It is a five-year average, not 2024 alone.</span></li>"
        + "<li><b>Mover rate = share of PEOPLE</b> aged 1 and over who lived in a different house a year "
        + "earlier. <span>Not households: a family of four that moves counts four times.</span></li>"
        + "<li><b>Movers a year = people</b>: population × mover rate, the same figure Seasonal Planning adds up.</li>"
        + "<li><b>Median income</b> is per household; <b>owner share</b> is the share of occupied homes lived in "
        + "by their owner.</li>"
        + "</ul></div><div><h4>It is not</h4><ul>"
        + "<li><b>Not ZIP-exact.</b> <span>A ZCTA (ZIP Code Tabulation Area) is the Census's drawing of a ZIP's "
        + "delivery area from census blocks. PO box, business and single-building ZIPs have no area at all — "
        + "checked against the 2020 census's own list of ZIP areas — so they show here as “PO box / business "
        + "ZIP — no residents”.</span></li>"
        + (skipped.length
          ? "<li><b>Not every area, every time.</b> <span>The ACS 2024 publishes no row for "
            + (skipped.length === 1 ? "one real ZIP area" : fmtN(skipped.length) + " real ZIP areas") + " (" + skippedList(skipped)
            + " — " + fmtN(skipped.reduce((a, z) => a + (z.pop20 || 0), 0)) + " people at the 2020 census). They are "
            + "labelled “Census area exists — the ACS publishes no row for it” and are missing from every sum "
            + "here, and from Seasonal Planning's demand.</span></li>"
          : "")
        // 2026-09-23 review: the bands are on the coefficient of variation (standard error over
        // the value); the ± printed here is the 90% margin, 1.645x wider -- say it in those terms
        + "<li><b>Not complete for small places.</b> <span>Where too few households answered, the Census "
        + "withholds the median income (“Census withheld: too few households”). The chip says how far to "
        + "trust a value: <b>High</b> — the ± margin is under about 20% of the value, <b>Medium</b> — about "
        + "20–66%, <b>Low</b> — over 66%. (These are the Census's usual 12% / 40% bands on the standard "
        + "error, restated for the 90% ± shown here.)</span></li>"
        + "<li><b>Not exact at the ends.</b> <span>Income is banded by the Census: <b>$250,000+</b> and "
        + "<b>$2,500 or less</b> are the top and bottom bands, not real medians.</span></li>"
        + "<li><b>Not a household move count in a high-turnover area.</b> <span>ZIPs where 35%+ of 1,000+ "
        + "people moved in a year are campuses, bases and prisons, but also downtown rental cores. They are "
        + "labelled “High-turnover area”, and left in every total.</span></li>"
        + "</ul></div></div></div>";

      /* ---------------- state tie-out ---------------- */
      h += '<div class="panel"><div class="panel-head"><span class="panel-title">Does it add up? Our ZIPs against the Census\'s own state totals</span></div>'
        + '<p class="rs-hint">Each state\'s ZIP figures summed, beside the total the Census publishes for the '
        // 2026-09-23 review: the old line blamed ZIP areas straddling a state line; measured, the
        // neighbours tie exactly and NY's gap is the two areas the ACS publishes no row for
        + "whole state from the same survey. <b>Population</b> should match almost exactly; a real ZIP area the "
        + "survey publishes no row for opens a gap, and is named under the table. <b>Movers</b> run about 1% over on purpose: "
        + "our per-ZIP figure is population × mover rate, and the rate's base leaves out babies under one. "
        + "<b>Expected</b> is that gap worked out from the Census's own numbers; <b>Left over</b> is what remains "
        + "after it, and is the real test.</p>";
      if (!stateLoaded) {
        h += '<div class="panel" style="margin:0">The Census\'s state totals are not loaded yet. They come in '
          + "with the next Census refresh (sources=area-external), and this table fills in on the pipeline run "
          + "after it.</div></div>";
      } else {
        // 2026-09-23 review: nine states tie within ±0.05% on both tests; the old <1% threshold
        // gave NY's missing Brentwood + Wyandanch (−0.41%) a green chip. Ties out < 0.1%,
        // Close < 0.5%, else Check -- a missing town now shows.
        const gapCls = v => { const a = Math.abs(num(v) || 0); return a < 0.1 ? "ok" : a < 0.5 ? "warn" : "bad"; };
        const verdict = s => {
          const p = Math.abs(num(s["Population Gap Pct"]) || 0), m = Math.abs(num(s["Movers Residual Pct"]) || 0);
          if (num(s["Census Population"]) == null) return '<span class="rs-pill mute">No Census total</span>';
          const w = Math.max(p, m);
          const tip = ' title="Ties out: both gaps under 0.1% · Close: under 0.5% · Check: 0.5% or more"';
          return w < 0.1 ? '<span class="rs-pill ok"' + tip + ">Ties out</span>"
            : w < 0.5 ? '<span class="rs-pill warn"' + tip + ">Close</span>" : '<span class="rs-pill bad"' + tip + ">Check</span>";
        };
        // the measured cause of each population gap: the areas the ACS publishes no row for
        const causes = ST.filter(s => (num(s["ZCTA No ACS"]) || 0) > 0).map(s => {
          const L = skipped.filter(z => z.st === s.State);
          return "<b>" + esc(s.State) + "</b>: the ACS publishes no row for " + skippedList(L) + " — "
            + fmtN(s["No ACS Pop 2020"]) + " people at the 2020 census. Added back, the gap is "
            + fmtGap(s["Explained Gap Pct"]) + ".";
        });
        h += '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
          + "<th>State</th>"
          + '<th class="num">Our population</th><th class="num">Census total</th><th class="num">Gap</th>'
          + '<th class="num">Our movers a year</th><th class="num">Census movers</th><th class="num">Gap</th>'
          + '<th class="num">Expected</th><th class="num">Left over</th><th>Verdict</th>'
          + "</tr></thead><tbody>"
          + ST.map(s => "<tr>"
            + '<td><span class="csd-zip">' + esc(s.State) + '</span><span class="csd-place">' + esc(s["State Name"]) + "</span></td>"
            + '<td class="num">' + fmtN(s["Our Population"]) + "</td>"
            + '<td class="num">' + fmtN(s["Census Population"]) + '<span class="csd-moe" title="The ACS controls a state\'s population to the official estimate: no sampling error">exact</span></td>'
            + '<td class="num"><span class="csd-gap ' + gapCls(s["Population Gap Pct"]) + '">' + fmtGap(s["Population Gap Pct"]) + "</span></td>"
            + '<td class="num">' + fmtN(s["Our Movers"]) + "</td>"
            + '<td class="num">' + fmtN(s["Census Movers"])
            + (num(s["Census Movers MOE"]) != null ? '<span class="csd-moe">±' + fmtN(s["Census Movers MOE"]) + "</span>" : "") + "</td>"
            + '<td class="num muted">' + fmtGap(s["Movers Gap Pct"]) + "</td>"
            + '<td class="num muted">' + fmtGap(s["Under One Pct"]) + "</td>"
            + '<td class="num"><span class="csd-gap ' + gapCls(s["Movers Residual Pct"]) + '">' + fmtGap(s["Movers Residual Pct"]) + "</span></td>"
            + "<td>" + verdict(s) + "</td></tr>").join("")
          + '<tr class="csd-tot"><td>All ten</td>'
          + '<td class="num">' + fmtN(tot("Our Population")) + '</td><td class="num">' + fmtN(tot("Census Population")) + "</td>"
          + '<td class="num">' + fmtGap(tot("Census Population") ? (tot("Our Population") / tot("Census Population") - 1) * 100 : null) + "</td>"
          + '<td class="num">' + fmtN(tot("Our Movers")) + '</td><td class="num">' + fmtN(tot("Census Movers")) + "</td>"
          + '<td class="num">' + fmtGap(tot("Census Movers") ? (tot("Our Movers") / tot("Census Movers") - 1) * 100 : null) + "</td>"
          + "<td></td><td></td><td></td></tr>"
          + "</tbody></table></div>"
          + (causes.length ? '<p class="rs-hint" style="margin:10px 0 0"><b>Why a population gap:</b> '
              + causes.join(" ") + "</p>" : "")
          // 2026-09-23 review: a mover rate is a rate, not a median
          + '<p class="rs-hint" style="margin:10px 0 0">For reference, the Census\'s own state figures: '
          + ST.map(s => "<b>" + esc(s.State) + "</b> median income " + fmt$(s["Census Median Income"])
            + ", mover rate " + fmtP(s["Census Mover Rate"])).join(" · ")
          + " (mover rate = people aged 1+). ZIP medians cannot be added up into a state median, so income is "
          + "not in the tie-out.</p></div>";
      }

      /* ---------------- coverage by state ---------------- */
      const pctOf = (a, b) => b ? Math.round(a / b * 100) + "%" : "—";
      h += '<div class="panel"><div class="panel-head"><span class="panel-title">Coverage — which ZIPs carry which figure, and why the rest do not</span></div>'
        + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
        + '<th>State</th><th class="num">ZIPs</th><th class="num">With a Census area</th>'
        + '<th class="num">With residents</th><th class="num">With income</th><th class="num">With mover rate</th>'
        + '<th class="num">PO box / business</th><th class="num">Skipped by the ACS</th>'
        + (nUnchecked ? '<th class="num">Not yet checked</th>' : "")
        + '<th class="num">No residents</th><th class="num">Income withheld</th>'
        + '<th class="num">High turnover</th><th class="num">County unknown</th>'
        + (moeOk ? "<th>Mover-rate reliability</th>" : "")
        + '<th class="num">Our leads, 12 mo</th>'
        + "</tr></thead><tbody>"
        + ST.map(s => {
          const z = num(s.ZIPs) || 0, hi = num(s["Mover High"]) || 0, me = num(s["Mover Medium"]) || 0, lo = num(s["Mover Low"]) || 0;
          const n = hi + me + lo;
          return "<tr>"
            + '<td><span class="csd-zip">' + esc(s.State) + "</span></td>"
            + '<td class="num strong">' + fmtN(z) + "</td>"
            + '<td class="num">' + fmtN(s["With Census Area"]) + '<span class="csd-moe">' + pctOf(num(s["With Census Area"]), z) + "</span></td>"
            + '<td class="num">' + fmtN(s["With Residents"]) + "</td>"
            + '<td class="num">' + fmtN(s["With Income"]) + "</td>"
            + '<td class="num">' + fmtN(s["With Mover Rate"]) + "</td>"
            + '<td class="num muted">' + fmtN(s["No ZCTA"]) + "</td>"
            + '<td class="num' + ((num(s["ZCTA No ACS"]) || 0) > 0 ? " strong" : " muted") + '"'
            + ((num(s["ZCTA No ACS"]) || 0) > 0 ? ' title="' + fmtN(s["No ACS Pop 2020"]) + ' people at the 2020 census"' : "")
            + ">" + fmtN(s["ZCTA No ACS"]) + "</td>"
            + (nUnchecked ? '<td class="num muted">' + fmtN(s["Unchecked"]) + "</td>" : "")
            + '<td class="num muted">' + fmtN(s["No Residents"]) + "</td>"
            + '<td class="num muted">' + fmtN(s["Income Withheld"]) + "</td>"
            + '<td class="num muted">' + fmtN(s["High Turnover"]) + "</td>"
            + '<td class="num muted">' + fmtN(s["County Unknown"]) + "</td>"
            + (moeOk ? '<td title="High ' + hi + " · Medium " + me + " · Low " + lo + '"><span class="csd-dist">'
                + (n ? '<i class="h" style="width:' + (hi / n * 100) + '%"></i><i class="m" style="width:' + (me / n * 100)
                  + '%"></i><i class="l" style="width:' + (lo / n * 100) + '%"></i>' : "") + "</span></td>" : "")
            + '<td class="num">' + fmtN(s["Leads 12m"]) + "</td></tr>";
        }).join("")
        + "</tbody></table></div>"
        // 2026-09-23 review: worded as the ± the page prints (90% margin = 1.645 x the standard
        // error the 12% / 40% bands are set on), so the legend matches the numbers on screen
        + (moeOk ? '<div class="csd-legend"><span><i class="h"></i>High — the ± margin is under about 20% of the rate</span>'
          + '<span><i class="m"></i>Medium — about 20–66%</span><span><i class="l"></i>Low — over 66%: a small area, read it as a range</span></div>' : "")
        + '<p class="rs-hint" style="margin:10px 0 0"><b>ZIPs</b> is every postal ZIP in our reference list for the '
        + "state. Missing income = PO box / business + skipped by the ACS" + (nUnchecked ? " + not yet checked" : "")
        + " + no residents + withheld, exactly. <b>Skipped by the ACS</b> are real Census areas (on the 2020 census's "
        + "list) the survey publishes no row for; <b>PO box / business</b> ZIPs are on no Census list at all. <b>County unknown</b> means our "
        + "ZIP reference carries no county for it, so those ZIPs drop out of any county roll-up (Seasonal Planning's "
        + "county map included) while still counting in the state. <b>Our leads</b> are by pickup ZIP over the last "
        + "twelve months, all brands — context, not part of the Census data.</p></div>";

      /* ---------------- ZIP explorer ---------------- */
      h += '<div class="panel"><div class="panel-head"><span class="panel-title">Every ZIP</span>'
        + '<span class="rs-hint" style="margin:0" id="csdCount"></span></div>'
        + '<div class="rs-bar">'
        + '<div class="rs-fld"><span>Search</span><input class="rs-inp" id="csdQ" placeholder="ZIP, town or county" value="' + esc(S.q) + '"></div>'
        + '<div id="csdSt"></div><div id="csdCo"></div><div id="csdStatus"></div>'
        + '<div class="rs-spacer"></div>'
        + '<button class="rs-btn" id="csdCsv" type="button">Export CSV</button>'
        + "</div>"
        + '<div class="rs-tablewrap rs-fit" id="csdWrap"></div>'
        + '<div class="csd-more" id="csdMore"></div>'
        + '<p class="rs-hint" style="margin:10px 0 0"><b>Check at Census</b> opens the Census\'s own page for that '
        // 2026-09-23 review: say the real reason plainly -- data.census.gov answers 403 to Georgia,
        // so a reader here will likely fail too; no search fallback, it is the same site
        + "area (table B19013, median household income, ACS 2024 5-year). data.census.gov refuses connections "
        + "from Georgia, so these links are <b>untested</b> and will likely only open from a US connection or a "
        + "VPN. Click a column heading to sort.</p></div>";

      mine.innerHTML = h;

      /* ---- explorer logic ---- */
      const COLS = [
        { k: "zip", l: "ZIP", sort: z => z.zip },
        { k: "status", l: "Census status", sort: z => z.statusLabel },
        { k: "pop", l: "Population", num: 1, sort: z => z.pop },
        { k: "inc", l: "Median income", num: 1, sort: z => z.inc },
        { k: "mr", l: "Mover rate", num: 1, sort: z => z.mr },
        { k: "movers", l: "Movers a year", num: 1, sort: z => z.movers },
        { k: "own", l: "Owner share", num: 1, sort: z => z.own },
        { k: "leads", l: "Our leads, 12 mo", num: 1, sort: z => z.leads },
        { k: "src", l: "Census", sort: null },
      ];
      const counties = st => [...new Set(Z.filter(z => z.st === st).map(z => z.county || "County unknown"))]
        .sort((a, b) => a === "County unknown" ? 1 : b === "County unknown" ? -1 : a.localeCompare(b));

      function filtered() {
        const q = S.q.trim().toLowerCase();
        return Z.filter(z => (!S.st || z.st === S.st)
          && (!S.county || (z.county || "County unknown") === S.county)
          && (!S.status || z.status === S.status)
          && (!q || z.zip.indexOf(q) === 0 || z.city.toLowerCase().indexOf(q) >= 0
              || z.county.toLowerCase().indexOf(q) >= 0));
      }
      function sorted(list) {
        const c = COLS.find(x => x.k === S.sort) || COLS[5];
        const f = c.sort;
        return list.slice().sort((a, b) => {
          const x = f(a), y = f(b);
          if (x == null && y == null) return a.zip.localeCompare(b.zip);
          if (x == null) return 1;          // blanks last, whichever way
          if (y == null) return -1;
          if (x < y) return -S.dir;
          if (x > y) return S.dir;
          return a.zip.localeCompare(b.zip);
        });
      }
      const chip = (rel, cv) => rel && REL[rel]
        ? '<span class="rs-pill ' + REL[rel] + '" title="' + (cv != null
            // 2026-09-23 review: cv is the standard error over the value; the ± shown is the
            // 90% margin, 1.645x that -- print both so the tooltip matches the ± on screen
            ? "the ± margin is " + Math.round(cv * 164.5) + "% of the value (standard error "
              + Math.round(cv * 100) + "%)"
            : "no margin published") + '">' + esc(rel) + "</span>" : "";
      const moe = (txt) => '<span class="csd-moe">±' + txt + "</span>";
      function incCell(z) {
        if (z.inc == null) return z.pop ? '<td class="dim">withheld</td>' : '<td class="dim">—</td>';
        if (z.coded === "top") return '<td class="num csd-cell">$250,000+<span class="rs-why">top band — the Census publishes no higher</span></td>';
        if (z.coded === "bottom") return '<td class="num csd-cell">$2,500 or less<span class="rs-why">bottom band</span></td>';
        return '<td class="num csd-cell">' + fmt$(z.inc) + (z.incM != null ? moe(fmt$(z.incM).slice(1)) : "") + chip(z.incRel, z.incCv) + "</td>";
      }
      function mrCell(z) {
        if (z.mr == null || !z.pop) return '<td class="dim">—</td>';
        // per row: only a margin the row itself says was built by the corrected method
        const ok = moeOk && !!z.moeMethod;
        return '<td class="num csd-cell">' + fmtP(z.mr) + (ok && z.mrM != null ? moe((z.mrM * 100).toFixed(1) + " pts") : "")
          + (ok ? chip(z.mrRel, z.mrCv) : "") + "</td>";
      }
      function row(z) {
        const st = STATUS[z.status] || STATUS.full;
        return "<tr>"
          + '<td class="nowrap"><span class="csd-zip">' + esc(z.zip) + '</span><span class="csd-place">'
          + esc([z.city, z.county || "County unknown", z.st].filter(Boolean).join(" · ")) + "</span></td>"
          + "<td>" + (st.pill ? '<span class="rs-pill ' + st.pill + '">' + esc(st.l) + "</span>"
                      : '<span class="csd-src" style="color:var(--muted)">' + esc(st.l) + "</span>") + "</td>"
          + (z.pop == null
              ? (z.status === "zcta_no_acs" && z.pop20 != null
                ? '<td class="num csd-cell dim">' + fmtN(z.pop20) + '<span class="rs-why">2020 census count — the ACS has no row</span></td>'
                : '<td class="dim">—</td>')
              : '<td class="num csd-cell">' + fmtN(z.pop) + (z.popM != null ? moe(fmtN(z.popM)) : "") + "</td>")
          + incCell(z) + mrCell(z)
          + (z.movers == null || !z.pop ? '<td class="dim">—</td>' : '<td class="num">' + fmtN(z.movers) + "</td>")
          + (z.own == null || !z.pop ? '<td class="dim">—</td>'
              : '<td class="num csd-cell">' + fmtP(z.own, 0) + (z.ownM != null ? moe((z.ownM * 100).toFixed(1) + " pts") : "") + "</td>")
          + '<td class="num' + (z.leads ? "" : " muted") + '">' + fmtN(z.leads) + "</td>"
          + "<td>" + (z.has
              ? '<a class="csd-src" target="_blank" rel="noopener noreferrer" href="https://data.census.gov/table/ACSDT5Y2024.B19013?g=860XX00US'
                + encodeURIComponent(z.zip) + '">Check at Census ↗</a>'
              : '<span class="csd-src" style="color:var(--faint)">no area</span>') + "</td>"
          + "</tr>";
      }
      function paintTable() {
        if (!alive()) return;
        const list = sorted(filtered());
        const shown = list.slice(0, S.shown);
        const cnt = mine.querySelector("#csdCount");
        if (cnt) cnt.textContent = list.length.toLocaleString("en-US") + " ZIP" + (list.length === 1 ? "" : "s")
          + (list.length > shown.length ? " · showing " + shown.length.toLocaleString("en-US") : "");
        const wrap = mine.querySelector("#csdWrap");
        wrap.innerHTML = list.length
          ? '<table class="rs-table rs-sticky"><thead><tr>'
            + COLS.map(c => "<th" + (c.sort ? ' data-k="' + c.k + '"' : "")
              + ' class="' + (c.num ? "num " : "") + (c.sort ? "csd-sort" : "") + (S.sort === c.k ? " on" : "") + '">'
              + esc(c.l) + (S.sort === c.k ? (S.dir < 0 ? " ↓" : " ↑") : "") + "</th>").join("")
            + "</tr></thead><tbody>" + shown.map(row).join("") + "</tbody></table>"
          : '<div class="panel" style="margin:0">No ZIP matches these filters.</div>';
        wrap.querySelectorAll("th[data-k]").forEach(th => th.onclick = () => {
          const k = th.dataset.k;
          if (S.sort === k) S.dir = -S.dir;
          else { S.sort = k; S.dir = (k === "zip" || k === "status") ? 1 : -1; }
          paintTable();
        });
        const more = mine.querySelector("#csdMore");
        more.innerHTML = list.length > shown.length
          ? '<button class="rs-btn" type="button" id="csdMoreBtn">Show ' + Math.min(PAGE, list.length - shown.length)
            + " more</button><span class=\"rs-hint\" style=\"margin:0\">or narrow the search — the CSV always has all "
            + list.length.toLocaleString("en-US") + "</span>"
          : "";
        const mb = mine.querySelector("#csdMoreBtn");
        if (mb) mb.onclick = () => { S.shown += PAGE; paintTable(); };
        try { RSC.fitScroller(wrap); } catch (e) { /* the kit sizes it on the next resize */ }
      }
      function mountFilters() {
        const st = mine.querySelector("#csdSt"), co = mine.querySelector("#csdCo"), stt = mine.querySelector("#csdStatus");
        st.innerHTML = ""; co.innerHTML = ""; stt.innerHTML = "";
        RSC.localSelect(st, { label: "State", allLabel: "All ten",
          values: STATE_ORDER.filter(s => Z.some(z => z.st === s)).map(s => ({ v: s, l: s + " — " + ((Z.find(z => z.st === s) || {}).stName || s),
            n: Z.filter(z => z.st === s).length })),
          value: S.st, onChange: v => { S.st = v; S.county = ""; S.shown = PAGE; mountFilters(); paintTable(); } });
        if (S.st) {
          RSC.localSelect(co, { label: "County", allLabel: "All counties",
            values: counties(S.st).map(c => ({ v: c, l: c, n: Z.filter(z => z.st === S.st && (z.county || "County unknown") === c).length })),
            value: S.county, onChange: v => { S.county = v; S.shown = PAGE; paintTable(); } });
        }
        RSC.localSelect(stt, { label: "Census status", allLabel: "Every status",
          values: Object.keys(STATUS).map(k => ({ v: k, l: STATUS[k].l, n: Z.filter(z => z.status === k).length }))
            .filter(o => o.n > 0 || o.v === S.status),
          value: S.status, onChange: v => { S.status = v; S.shown = PAGE; paintTable(); } });
      }
      function exportCsv() {
        const list = sorted(filtered());
        const cols = [["ZIP", z => z.zip], ["City", z => z.city], ["County", z => z.county], ["State", z => z.st],
          ["Census status", z => z.statusLabel], ["Has Census area (ZCTA)", z => z.has ? "Yes" : "No"],
          ["Has ACS row", z => z.hasAcs ? "Yes" : "No"],
          ["2020 census population (areas the ACS skips)", z => z.status === "zcta_no_acs" ? z.pop20 : ""],
          ["Population", z => z.pop], ["Population MOE (90%)", z => z.popM],
          ["Median household income", z => z.coded === "top" ? "250,000+" : z.coded === "bottom" ? "2,500 or less" : z.inc],
          ["Median income MOE (90%)", z => z.incM], ["Income reliability", z => z.incRel],
          ["Mover rate (share of people aged 1+)", z => z.mr],
          ["Mover rate MOE (90%)", z => z.moeMethod ? z.mrM : ""], ["Mover rate reliability", z => z.moeMethod ? z.mrRel : ""],
          ["Movers a year (people)", z => z.movers], ["Owner share", z => z.own], ["Owner share MOE (90%)", z => z.ownM],
          ["Our leads, last 12 months", z => z.leads], ["Vintage", z => z.vintage]];
        const cell = x => {
          let s = String(x == null ? "" : x);
          if (/^[=+\-@]/.test(s)) s = " " + s;         // never a live formula in Excel
          return '"' + s.replace(/"/g, '""') + '"';
        };
        const lines = [cols.map(c => cell(c[0])).join(",")].concat(list.map(z => cols.map(c => cell(c[1](z))).join(",")));
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Census data " + (S.st || "10 states") + (S.county ? " " + S.county : "")
          + " (" + vintage + ", " + list.length + " ZIPs).csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }

      let tq = null;
      mine.querySelector("#csdQ").oninput = e => {
        clearTimeout(tq);
        tq = setTimeout(() => { S.q = e.target.value; S.shown = PAGE; paintTable(); }, 160);
      };
      mine.querySelector("#csdCsv").onclick = exportCsv;
      mountFilters();
      paintTable();
    }).catch(e => {
      if (!alive()) return;
      mine.innerHTML = '<div class="panel">Could not load the Census data — ' + esc(e && e.message || e) + "</div>";
    });
  },
});
})();
