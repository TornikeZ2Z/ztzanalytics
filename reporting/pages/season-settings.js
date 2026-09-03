/* DIFFERENT ANALYSIS ▸ Planning Variables — the numbers Seasonal Planning seeds from, editable
 * (his ask, 2026-09-03: "determine from data and let me change those stuff from separate page
 * named variables or configuration or something").
 *
 * One object in app_settings (`season_plan`), edited through the admin-gated /api/_gset the
 * General Translators page already uses. src/area_plan.py reads it at build and carries it into
 * the model as `overrides`; the Seasonal Planning page applies it over whatever seed is chosen,
 * so a cell set here WINS everywhere. Empty means "seed everything from the data".
 *
 * What lives here:
 *   season_share_of_peak  the threshold that decides which months are the season (0.65)
 *   days_per_month        the jobs-per-foreman ceiling the calculator bridges with (30)
 *   utilization / leads_per_rep / dollars_per_lead   dial defaults (blank = measured)
 *   bases[state] = {cur, add, byCo: {company: {cur, add}}}   the foreman table overrides
 *
 * The page shows the MEASURED value beside every override so nobody edits blind.
 */
registerPage({
  id: "season-settings",
  group: "different",
  title: "Planning Variables",
  subtitle: "What Seasonal Planning seeds from — the season threshold, the ceiling, the dial " +
            "defaults and the per-state foreman table. A value set here wins over the data.",
  datasets: [],

  async render(host) {
    const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g,
      c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const num = v => { const x = parseFloat(v); return isNaN(x) ? null : x; };
    const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    if (!document.getElementById("ssv-style")) {
      const st = document.createElement("style");
      st.id = "ssv-style";
      st.textContent = [
        ".ssv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:12px;margin-top:12px}",
        ".ssv-grid>.panel{min-width:0}",
        ".ssv-say{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:none;margin:0 0 12px}",
        ".ssv-say b{color:var(--ink)}",
        ".ssv-row{display:grid;grid-template-columns:minmax(160px,1fr) 110px minmax(120px,1fr);gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line-2)}",
        ".ssv-row:last-child{border-bottom:0}",
        ".ssv-row .l{font-size:13px;font-weight:600}",
        ".ssv-row .l small{display:block;font-weight:500;font-size:11px;color:var(--faint);line-height:1.4}",
        ".ssv-row .m{font-size:11.5px;color:var(--faint)}",
        ".ssv-row .m b{color:var(--muted)}",
        ".ssv-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);border-radius:9px;color:var(--ink);padding:7px 10px;font-size:13px;outline:0;width:100px}",
        ".ssv-in:focus{border-color:var(--brand)}",
        ".ssv-in.set{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 8%,var(--panel))}",
        ".ssv-sub td{color:var(--muted);font-size:12px;background:var(--panel-2)}",
        ".ssv-sub td:first-child{padding-left:26px}",
        ".ssv-actions{display:flex;gap:10px;align-items:center;margin-top:14px;flex-wrap:wrap}",
        ".ssv-msg{font-size:12px;color:var(--muted)} .ssv-msg.bad{color:var(--neg);font-weight:700} .ssv-msg.ok{color:var(--pos);font-weight:700}",
        ".ssv-meta{font-size:11px;color:var(--faint);margin-top:8px}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="rs-page-head"><h1>Planning Variables</h1></div>' +
      '<div class="rs-loading" style="padding:22px">Reading the variables and the measured seeds…</div>';

    const hdr = { Authorization: "Bearer " + ZTZ.getToken() };
    const [gset, modelRow] = await Promise.all([
      fetch(ZTZ.API + "/api/_gset", { headers: hdr }).then(r => r.json()).catch(e => ({ error: String(e) })),
      ZTZ.api("/api/mart_area_plan_model?limit=1").then(j => JSON.parse(((j.rows || [])[0] || {}).payload || "null")).catch(() => null),
    ]);
    if (gset.error) {
      host.innerHTML = '<div class="rs-page-head"><h1>Planning Variables</h1></div><div class="panel">' +
        (/admin/i.test(gset.error) ? "This page is admin-only: it writes the values every planner seeds from."
          : "Could not read the variables: " + esc(gset.error)) + "</div>";
      return;
    }
    const model = modelRow || {};
    const SEASON = model.season || {};
    const SEED = model.base_seed || {};
    const CAP = model.capacity || {};
    const saved = ((gset.settings || {}).season_plan || {}).value || {};
    const meta = (gset.settings || {}).season_plan || {};
    const V = JSON.parse(JSON.stringify(saved));   // the working copy
    V.bases = V.bases || {};

    // the states the plan table shows: the eight service areas + any state the data seeds 3+
    const SERVICE_AREAS = ["NJ", "PA", "NY", "DE", "CT", "MA", "MD", "VA"];
    const states = SERVICE_AREAS.slice();
    Object.entries(SEED).forEach(([st, d]) => { if (!states.includes(st) && (num((d || {})._all) || 0) >= 3) states.push(st); });
    const companiesOf = st => Object.keys(SEED[st] || {}).filter(c => c !== "_all").sort();

    // measured dial values over last season, for the "beside every override" rule
    const lastWin = SEASON.last || [];
    const measured = (() => {
      const yms = Object.keys(CAP).filter(m => lastWin[0] && m >= lastWin[0] && m <= lastWin[1]);
      const jpf = yms.map(m => ((CAP[m] || {})._national || {}).jobs_per_foreman).filter(Boolean);
      const med = a => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : null; };
      const S = model.sales || {}, M = model.marketing || {};
      return {
        jobsPerForeman: med(jpf),
        leadsPerRep: med(yms.map(m => (S[m] || {}).leads_per_rep_median).filter(Boolean)),
        dollarsPerLead: med(yms.map(m => (M[m] || {}).dollars_per_lead).filter(Boolean)),
      };
    })();

    function inp(key, val, ph, cls) {
      return '<input class="ssv-in' + (val != null && val !== "" ? " set" : "") + (cls ? " " + cls : "") + '" data-key="' + esc(key) + '" type="number" step="any" placeholder="' + esc(ph || "") + '" value="' + (val == null ? "" : esc(val)) + '">';
    }
    const row = (label, small, control, measuredNote) =>
      '<div class="ssv-row"><div class="l">' + label + (small ? "<small>" + small + "</small>" : "") + "</div>" +
      "<div>" + control + '</div><div class="m">' + (measuredNote || "") + "</div></div>";

    function paint() {
      const b = st => V.bases[st] || {};
      host.innerHTML =
        '<div class="rs-page-head"><h1>Planning Variables</h1>' +
        '<p style="max-width:none">Every number here is a seed <a href="#page=area-plan">Seasonal Planning</a> starts from. Leave a cell <b>blank</b> to let the data decide; type a value and it wins — on the page, in the model, for everyone. The measured figure sits beside each cell so nothing is edited blind. Saved values apply to the plan on its next rebuild (daily at 07:50 NJ, or run <b>sources=area-plan</b>).</p></div>' +

        '<div class="ssv-grid">' +
        '<div class="panel"><div class="panel-title">The season</div>' +
          '<div class="ssv-say">A month is in the season when its jobs reach this share of the year\'s peak month, in at least two of the years with data. Lower it and the shoulders (May, September) join; raise it and only the summer core stays.</div>' +
          row("Share of peak", "0.50 – 0.95", inp("season_share_of_peak", V.season_share_of_peak, "0.65"),
              "measured: at <b>" + Math.round((SEASON.share || 0.65) * 100) + "%</b> the season is <b>" + (SEASON.months || []).map(m => MONTH_NAMES[m]).join("–") + "</b>" +
              (SEASON.next ? " · next: " + esc(SEASON.next.join(" – ")) : "")) +
          row("Days per month", "the jobs-per-foreman ceiling", inp("days_per_month", V.days_per_month, "30"),
              "measured last season: <b>" + (measured.jobsPerForeman ? measured.jobsPerForeman + " jobs per foreman-month" : "—") + "</b>") +
        "</div>" +
        '<div class="panel"><div class="panel-title">Dial defaults</div>' +
          '<div class="ssv-say">The three dials on the plan re-seed from the chosen period. Set one here and it opens on your number instead.</div>' +
          row("Utilization, %", "of the ceiling", inp("utilization", V.utilization, "measured"), "the plan measures this per period") +
          row("Leads per rep / month", "", inp("leads_per_rep", V.leads_per_rep, "measured"),
              "measured last season: <b>" + (measured.leadsPerRep || "—") + "</b> median") +
          row("Marketing $ per lead", "", inp("dollars_per_lead", V.dollars_per_lead, "measured"),
              "measured last season: <b>" + (measured.dollarsPerLead ? "$" + measured.dollarsPerLead : "—") + "</b>") +
        "</div></div>" +

        '<div class="panel" style="margin-top:12px"><div class="panel-title">The foreman table</div>' +
          '<div class="ssv-say">Per state: the foremen on hand and the additions being considered. <b>Worked last season</b> is the distinct foremen on closings over ' + esc((lastWin || []).join(" – ") || "the season") + ' — the seed the plan opens on. Where two companies run a state, each has its own line and the state line is the pooled figure.</div>' +
          '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>State</th><th class="num">Worked last season</th><th class="num">Foreman quantity</th><th class="num">Additional</th></tr></thead><tbody>' +
          states.map(st => {
            const cos = companiesOf(st);
            return '<tr><td class="strong">' + esc(st) + '</td><td class="num">' + ((SEED[st] || {})._all || '<span class="ssv-meta">—</span>') + "</td>" +
              '<td class="num">' + inp("bases." + st + ".cur", b(st).cur, String((SEED[st] || {})._all || 0)) + "</td>" +
              '<td class="num">' + inp("bases." + st + ".add", b(st).add, "0") + "</td></tr>" +
              cos.map(c => { const bc = (b(st).byCo || {})[c] || {};
                return '<tr class="ssv-sub"><td>' + esc(c) + '</td><td class="num">' + ((SEED[st] || {})[c] || 0) + "</td>" +
                  '<td class="num">' + inp("bases." + st + ".byCo." + c + ".cur", bc.cur, String((SEED[st] || {})[c] || 0)) + "</td>" +
                  '<td class="num">' + inp("bases." + st + ".byCo." + c + ".add", bc.add, "0") + "</td></tr>"; }).join("");
          }).join("") + "</tbody></table></div>" +
          '<div class="ssv-actions"><button class="rs-btn pri" id="ssvSave">Save variables</button>' +
          '<button class="rs-btn" id="ssvClear">Clear all (back to the data)</button>' +
          '<span class="ssv-msg" id="ssvMsg"></span></div>' +
          '<div class="ssv-meta">' + (meta.at ? "last saved " + esc(meta.at) + " by " + esc(meta.by || "") : "nothing saved yet — the plan seeds entirely from the data") + "</div>" +
        "</div>";

      host.querySelectorAll(".ssv-in").forEach(el => el.addEventListener("input", () => {
        const v = num(el.value);
        setPath(V, el.dataset.key, el.value.trim() === "" ? null : v);
        el.classList.toggle("set", el.value.trim() !== "");
      }));
      host.querySelector("#ssvSave").onclick = () => saveAll();
      host.querySelector("#ssvClear").onclick = () => {
        Object.keys(V).forEach(k => delete V[k]); V.bases = {};
        saveAll(true);
      };
    }

    function setPath(obj, path, val) {
      const parts = path.split(".");
      let o = obj;
      for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]] = o[parts[i]] || {};
      if (val == null) delete o[parts[parts.length - 1]]; else o[parts[parts.length - 1]] = val;
    }
    function prune(o) {   // drop empty objects so "blank" really means "from the data"
      Object.keys(o).forEach(k => {
        if (o[k] && typeof o[k] === "object") { prune(o[k]); if (!Object.keys(o[k]).length) delete o[k]; }
        else if (o[k] == null) delete o[k];
      });
      return o;
    }
    async function saveAll(cleared) {
      const msg = host.querySelector("#ssvMsg");
      const share = num(V.season_share_of_peak);
      if (share != null && (share < 0.5 || share > 0.95)) { msg.className = "ssv-msg bad"; msg.textContent = "share of peak must be between 0.50 and 0.95"; return; }
      const dpm = num(V.days_per_month);
      if (dpm != null && (dpm < 1 || dpm > 31)) { msg.className = "ssv-msg bad"; msg.textContent = "days per month must be 1–31"; return; }
      msg.className = "ssv-msg"; msg.textContent = "saving…";
      const body = prune(JSON.parse(JSON.stringify(V)));
      try {
        const r = await fetch(ZTZ.API + "/api/_gset", { method: "POST", headers: { ...hdr, "Content-Type": "application/json" },
          body: JSON.stringify({ name: "season_plan", value: body }) });
        const j = await r.json();
        if (!r.ok || j.error) throw new Error(j.error || r.status);
        msg.className = "ssv-msg ok";
        msg.textContent = cleared ? "cleared — the plan will seed from the data on its next rebuild" : "saved — applies on the plan's next rebuild";
        meta.at = new Date().toISOString().slice(0, 16).replace("T", " ");
        if (cleared) paint();
      } catch (e) {
        msg.className = "ssv-msg bad"; msg.textContent = "not saved: " + String(e.message || e);
      }
    }

    paint();
  },
});
