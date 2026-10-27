/* JOB P&L -- one job's full cost breakdown (Financial).
 *
 * His ask (2026-10-21), after the two-day Aaron Greene breakdown he sent to Giga: "i need now to
 * create it as a functionality in company overview. i need user to be able to select a job and
 * see full costs breakdown. in the same style we just did." His picks: a linked second day
 * (pickup LM21-0220, delivery LM21-02200) shows side by side with a combined total; the page adds
 * the costs the closing sheet leaves out -- truck, WEX card fuel, packing cost at 15%, refunds and
 * claims. 2026-10-22: moved to Financial, before Salaries (his word); it shows crew pay and
 * commission job by job, so it is opened by Financial holders only, like Salaries.
 *
 * Everything is computed in the warehouse (src/job_pnl.py -> mart_job_pnl, one row per closing).
 * This page only finds a job, lays its days side by side and says where every line comes from.
 *
 * THE LIST (his ask 2026-10-27: "add some total statistics on top, make the table with filters and
 * proper search, have paginated list for all jobs and add totals and simple 1 graph on top of the
 * table for trend"). His picks on the drawn proposal: a job opens in a SIDE PANEL over the list;
 * the chart is billed per month split into full profit and costs, the margin over each bar; compact
 * columns; the page opens on the year to date. One row per job: a delivery day folds into its
 * pickup. The tiles, the chart and the table all follow the company and every filter; the tiles
 * and the table also follow the period, while the chart always shows the 13 months to its end.
 * The closing sheet stays the money of record: its Total Expense is reproduced exactly, and what
 * it holds beyond its own columns is itemised from the contract (review, bulky and other crew
 * extras) or shown as "Other on the closing sheet".
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.job_pnl) {
    RS.DATASETS.job_pnl = {
      table: "mart_job_pnl",
      cols: ["Unique Key", "Job Key", "Date", "Company", "Closing #", "Job Code", "Is Second Day",
             "Customer", "Foreman", "Driver", "Crew Size", "Source", "Sales Person", "Sales Person 2",
             "Sales Person 3", "State", "Moving Type", "Job Status", "Truck", "Truck Ownership",
             "Truck Vendor", "Truck Day Jobs", "Total Bill", "Card Payment", "Deposit", "Balance Due",
             "Customer Tip", "Discount Given", "Has Contract", "Labor Charge", "Packing Charged",
             "Stairs Fee", "Bulky Fee", "Hoisting Fee", "Overnight Fee", "Storage Fee", "Other Charges",
             "Contract Discounts", "Contract Total", "Packing Sold", "Sales Commission", "Foreman Pay",
             "Foreman Packing Commission", "Driver Pay", "Helpers Pay", "Company Tip", "Car",
             "Fuel on Sheet", "Tolls", "Truck Rent on Sheet", "Hotel", "Other Expenses",
             "Crew Review Pay", "Crew Bulky Pay", "Crew Other Extras", "Sheet Other",
             "Sheet Total Expense", "Sheet Profit", "Truck Cost", "Truck Day Rate", "Card Fuel",
             "Packing Cost", "Refunds", "Claims Filed", "Added Costs", "Full Profit",
             "Miles", "Miles Basis", "Fuel Per Gallon", "Fuel Est", "Toll Per Mile", "Toll Est",
             "Card Fee", "Ad Source", "Ad Month", "Ad Spend Month", "Ad Jobs Month", "Ad Cost", "Replaced on Sheet"],
    };
  }
  // the WEX fleet-card swipes (src/fuel_mart.py), for the real fuel spent beside the estimate
  if (window.RS && RS.DATASETS && !RS.DATASETS.job_fuel) {
    RS.DATASETS.job_fuel = {
      table: "fct_fuel",
      cols: ["Line Key", "Date", "Datetime", "Work Day", "Foreman", "Truck", "Vehicle Raw", "Fuel Kind", "Gallons", "Net Cost",
             "Unique Key", "Match Status", "Merchant Name", "Merchant City", "Merchant State"],
    };
  }
})();

(() => {
  function injectStyle() {
    const old = document.getElementById("jpl-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "jpl-style";
    st.textContent = `
    /* the shared kit (assets/rs.css) carries panels, KPI tiles, inputs and tables; only the
       ledger's own marks live here */
    .jpl-top{display:flex;flex-wrap:wrap;gap:10px 14px;align-items:center;margin:0 0 12px}
    .jpl-top .rs-inp{min-width:0;width:150px}
    .jpl-chart{position:relative;height:230px}
    .jpl-qfld{flex:1 1 300px}
    .jpl-ledger tr.jpl-info td{color:var(--muted);font-style:italic}
    .jpl-dim{color:var(--muted)}
    .jpl-flag{margin:8px 0 4px;padding:8px 12px;border-radius:10px;background:var(--neg-bg);color:var(--neg);font-weight:700;font-size:13.5px}
    .jpl-fuel .rs-tablewrap{margin:8px 0 12px}
    .jpl-fuel tr.jpl-me td{font-weight:700}
    .jpl-link{color:var(--brand);font-weight:650;text-decoration:none}
    .jpl-link:hover{text-decoration:underline}
    @media (max-width:760px){.jpl-tiles .rs-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .jpl-qfld .rs-inp{width:100%}
    .jpl-chead{display:flex;flex-wrap:wrap;gap:6px 16px;justify-content:space-between;align-items:baseline;margin-bottom:6px}
    .jpl-chead b{font-size:14px}
    .jpl-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12px;color:var(--muted)}
    .jpl-list .rs-table th{white-space:nowrap}
    .jpl-list .rs-table th button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer;font-weight:inherit;text-transform:inherit;letter-spacing:inherit}
    .jpl-list .rs-table th button:hover{color:var(--ink)}
    .jpl-list .rs-table th.on button{color:var(--ink)}
    .jpl-list .rs-table td{white-space:nowrap}
    .jpl-list .rs-table td.jpl-cust{white-space:normal;min-width:150px}
    .jpl-list .rs-table tfoot td{font-weight:800;border-top:2px solid var(--line-2);background:var(--panel-2)}
    .jpl-pager{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;justify-content:space-between;margin-top:12px;font-size:13px;color:var(--muted)}
    .jpl-pages{display:flex;flex-wrap:wrap;gap:4px;align-items:center}
    .jpl-pages .rs-btn{min-width:34px;padding:5px 9px}
    .jpl-pages .rs-btn.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}
    .jpl-scrim{position:fixed;inset:0;background:rgba(8,12,20,.38);z-index:300}
    .jpl-drawer{position:fixed;top:0;right:0;bottom:0;width:min(1000px,100vw);z-index:301;background:var(--bg,var(--panel));
      border-left:1px solid var(--line-2);overflow-y:auto;overscroll-behavior:contain;padding:14px 18px 40px}
    .jpl-dhead{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:0 0 10px;position:sticky;top:-14px;
      background:var(--bg,var(--panel));padding:8px 0;z-index:1}
    @media (max-width:760px){.jpl-drawer{padding:10px 12px 40px}}
    .jpl-eyebrow{font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .jpl-wrap{max-width:1040px}
    .jpl-title{font-size:24px;font-weight:800;margin:4px 0 6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
    .jpl-sub{color:var(--muted);font-size:13px;line-height:1.6}
    .jpl-sub b{color:var(--ink);font-weight:600}
    .jpl-chip{display:inline-block;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;
      background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}
    .jpl-chip.jpl-ok{color:var(--pos);background:var(--pos-bg);border-color:transparent}
    .jpl-chip.jpl-warn{color:var(--warn);background:var(--warn-bg);border-color:transparent}
    .jpl-summary{font-size:15px;line-height:1.65;color:var(--muted);margin:10px 0 14px;max-width:86ch}
    .jpl-summary b{color:var(--ink);font-weight:700}
    .jpl-bar{display:flex;height:26px;border-radius:8px;overflow:hidden;gap:2px;background:var(--panel-2)}
    .jpl-bar span{display:block;height:100%;min-width:2px}
    .jpl-legend{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:9px;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
    .jpl-legend b{color:var(--ink);font-weight:700;margin-left:4px}
    .jpl-sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
    /* the job's five boxes on ONE line (his ask 2026-10-27: "its perfect, just this next line is something i dont
       like... fix it so its all on 1 line, or somehow make it more compact"); three, then two, on small screens */
    .jpl-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:16px}
    @media (max-width:760px){.jpl-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media (max-width:480px){.jpl-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
    .jpl-kpi{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;min-width:0}
    .jpl-kpi .k{font-size:12px;color:var(--muted);font-weight:600}
    .jpl-kpi .v{font-size:24px;font-weight:800;margin:3px 0 2px;font-variant-numeric:tabular-nums}
    .jpl-kpi .s{font-size:12px;color:var(--muted);line-height:1.45}
    .jpl-kpi.jpl-hero{border:2px solid var(--pos)}
    .jpl-up{color:var(--pos)} .jpl-down{color:var(--neg)}
    .jpl-ledger{width:100%;min-width:640px;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
    .jpl-ledger th,.jpl-ledger td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
    .jpl-ledger th:first-child,.jpl-ledger td:first-child{text-align:left;white-space:normal}
    .jpl-ledger thead th{font-size:12px;color:var(--muted);font-weight:700;vertical-align:bottom;border-bottom:2px solid var(--line)}
    .jpl-ledger thead th small{display:block;font-weight:500}
    .jpl-ledger td small{color:var(--muted);font-size:12px}
    .jpl-ledger td.jpl-z{color:var(--faint,var(--muted))}
    .jpl-ledger td.jpl-p{color:var(--muted);font-size:12.5px;width:72px}
    .jpl-ledger tr.jpl-grp td{font-weight:800;padding-top:16px;border-bottom:1px solid var(--line-2,var(--line))}
    .jpl-ledger tr.jpl-grp td:first-child{font-size:12px;letter-spacing:.07em;text-transform:uppercase}
    .jpl-ledger tr.jpl-item td:first-child{padding-left:28px}
    .jpl-ledger tr.jpl-tot td{font-weight:800;border-top:1px solid var(--ink);border-bottom:0}
    .jpl-ledger tr.jpl-band td{font-weight:800;font-size:15.5px;background:var(--pos-bg);border-bottom:0}
    .jpl-ledger tr.jpl-band.jpl-loss td{background:var(--neg-bg)}
    .jpl-ledger tr.jpl-band td:first-child{border-radius:8px 0 0 8px} .jpl-ledger tr.jpl-band td:last-child{border-radius:0 8px 8px 0}
    .jpl-ledger tr.jpl-final td{font-weight:800;font-size:16px;border-bottom:0;border-top:2px solid var(--ink)}
    .jpl-tag{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.03em;padding:0 6px;border-radius:99px;
      margin-left:6px;vertical-align:1px;color:var(--muted);border:1px solid var(--line)}
    .jpl-tag.jpl-est{color:var(--warn);background:var(--warn-bg);border-color:transparent}
    .jpl-pos{color:var(--pos)} .jpl-neg{color:var(--neg)}
    .jpl-notes{margin:12px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--muted);line-height:1.55}
    .jpl-notes b{color:var(--ink);font-weight:600}
    .jpl-src summary{cursor:pointer;font-weight:700}
    .jpl-src ul{margin:8px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.55;color:var(--muted)}
    .jpl-empty{color:var(--muted);padding:14px 2px}
    `;
    document.head.appendChild(st);
  }

  registerPage({
    id: "job-pnl",
    group: "financial",
    title: "Job P&L",
    subtitle: "Pick a job and see where its money went: what was billed, every cost on the closing " +
              "sheet, the costs the sheet leaves out, and what was left.",
    datasets: [],

    render: function (host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      const num = v => (v == null || v === "" || isNaN(+v)) ? 0 : +v;
      const money = v => { const r = Math.round(num(v)); return (r < 0 ? "−$" : "$") + Math.abs(r).toLocaleString(); };
      const day = d => { const s = String(d || "").slice(0, 10); if (!s) return "—";
        const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("en-US",
          { month: "short", day: "numeric", year: "numeric" }); };
      const pct = (a, b) => b ? Math.round(100 * a / b) + "%" : "—";

      injectStyle();
      host.innerHTML = '<div class="panel"><div class="rs-loading">Reading every job’s costs…</div></div>';

      // the swipes are extra: without them (an older bridge, no grant) the page still works
      const fuelLoad = RS.load("job_fuel").catch(e => { console.warn("job-pnl: no WEX swipes", e); return null; });
      return Promise.all([RS.load("job_pnl"), fuelLoad]).then(([rows, fuelRows]) => {
        if (!rows.length) {
          host.innerHTML = '<div class="panel">The job P&L table has not been built yet. It arrives with the next pipeline run.</div>';
          return;
        }
        rows.forEach(r => { r._d = String(r["Date"] || "").slice(0, 10); });
        const byKey = new Map();
        const seen = new Set();
        rows.forEach(r => {
          if (seen.has(r["Unique Key"])) return;   // one closing, one column
          seen.add(r["Unique Key"]);
          const k = r["Job Key"]; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(r);
        });
        byKey.forEach(list => list.sort((a, b) => a._d < b._d ? -1 : a._d > b._d ? 1 : 0));
        const latest = rows.slice().sort((a, b) => a._d < b._d ? 1 : a._d > b._d ? -1 : 0);
        // FIXED COSTS = the owned truck's share (insurance, parking, loan payments) -- his pick:
        // everything else in the ledger rises and falls with the job
        const fixedOf = r => r["Truck Ownership"] === "Owned" ? num(r["Truck Cost"]) : 0;
        // AD SPEND comes last, below fixed costs (his ask 2026-10-22: "as the last thing with a
        // little statistics"), so the margin before fixed costs is before it too
        const adOf = r => num(r["Ad Cost"]);
        const beforeFixed = r => num(r["Full Profit"]) + fixedOf(r) + adOf(r);
        // the yardstick: the same move type's margin before fixed costs over the last 12 months
        const lastDay = latest.length ? latest[0]._d : "";
        const yearAgo = lastDay ? String(+lastDay.slice(0, 4) - 1) + lastDay.slice(4) : "";
        const AVG = {};
        rows.forEach(r => {
          if (r._d <= yearAgo || num(r["Total Bill"]) <= 0) return;
          const t = r["Moving Type"] || "Other";
          const a = AVG[t] = AVG[t] || { bill: 0, kept: 0, n: 0 };
          a.bill += num(r["Total Bill"]); a.kept += beforeFixed(r); a.n += 1;
        });

        /* REAL FUEL, BESIDE THE ESTIMATE (his ask 2026-10-27): "at the end of the day, foreman should fill the
           truck fully therefore the morning job has full fuel. i want to see whether the estimated cost of fuel is
           really cost of fuel ... add it in the list as FUEL REAL EXPENDITURE or something and do not substract".
           Shown, never counted. ONE RULE WITH FUEL CONTROL (his pick 2026-10-27, "this new report and that page
           should combine"): the loader puts every swipe on a work day -- noon to noon, a morning fill tops up after
           the day before -- and on the foreman's jobs of that day, split by their miles (src/fuel_mart.py). The
           job's share is its `Card Fuel`; paid = that + the fuel on its closing sheet. The swipes are read here
           only to show the evidence: the ones that count, and his card or the job's truck the day before and after. */
        const PLACED_FUEL = { assigned: 1, assigned_trip: 1 };
        const nameKey = v => (String(v || "").toLowerCase().match(/[a-z]+/g) || []).sort().join(" ");
        const FUEL = (fuelRows || []).map(f => ({
          key: f["Line Key"], d: String(f["Date"] || "").slice(0, 10), t: String(f["Datetime"] || ""), who: f["Foreman"] || "",
          wd: String(f["Work Day"] || f["Date"] || "").slice(0, 10), nk: nameKey(f["Foreman"]), uk: f["Unique Key"] || "",
          placed: PLACED_FUEL[f["Match Status"]] === 1, trip: f["Match Status"] === "assigned_trip", kind: f["Fuel Kind"] || "",
          truck: String(f["Truck"] || "").replace(/^#/, ""), veh: f["Vehicle Raw"] || "", gal: num(f["Gallons"]), cost: num(f["Net Cost"]),
          where: [f["Merchant Name"], f["Merchant City"], f["Merchant State"]].filter(Boolean).join(", ") }));
        const fuelFrom = FUEL.reduce((a, f) => f.d && f.d < a ? f.d : a, "9999");
        // the swipes the loader placed, by the job carrying them (a day of several jobs: the biggest share)
        const fuelByUk = new Map();
        FUEL.forEach(f => { if (f.placed && f.uk) { if (!fuelByUk.has(f.uk)) fuelByUk.set(f.uk, []); fuelByUk.get(f.uk).push(f); } });
        const byForemanDay = new Map();
        byKey.forEach(list => list.forEach(r => {
          if (!r["Foreman"]) return;
          const k = r["Foreman"] + "|" + r._d;
          if (!byForemanDay.has(k)) byForemanDay.set(k, []);
          byForemanDay.get(k).push(r);
        }));
        const addDays = (d, n) => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
        function fuelDay(r) {
          if (!FUEL.length || !r._d || r._d < fuelFrom) return null;
          const who = r["Foreman"] || "", nk = nameKey(who), truck = r["Truck Ownership"] === "Owned" ? String(r["Truck"] || "").replace(/^#/, "") : "";
          const d0 = r._d, prev = addDays(d0, -1), next = addDays(d0, 1);
          const jobs = byForemanDay.get(who + "|" + d0) || [r];
          const keys = new Set(jobs.map(x => x["Unique Key"]));
          const counted = [].concat(...jobs.map(x => fuelByUk.get(x["Unique Key"]) || [])).filter(f => !f.trip);
          const near = FUEL.filter(f => !(f.placed && keys.has(f.uk)) && f.d >= prev && f.d <= next && ((nk && f.nk === nk) || (truck && f.truck === truck)));
          const fills = counted.map(f => Object.assign({}, f, { counts: true })).concat(near.map(f => Object.assign({}, f, { counts: false })))
            .sort((a, b) => a.t < b.t ? -1 : a.t > b.t ? 1 : 0);
          const wex = counted.reduce((a, f) => a + f.cost, 0), card = num(r["Card Fuel"]), sheet = num(r["Fuel on Sheet"]);
          return { who, truck, d0, prev, next, fills, jobs, wex, card, sheet, share: wex > 0.5 ? card / wex : null, real: card + sheet, est: num(r["Fuel Est"]) };
        }
        // the same foreman-week in Fuel Control, for the people who can open it (Logistics)
        const weekOf = d => { const x = new Date(d + "T12:00:00"); x.setDate(x.getDate() - (x.getDay() + 6) % 7); return x.toISOString().slice(0, 10); };
        const fuelLink = r => (typeof canSee === "function" && !canSee("fuel-control")) ? "" :
          '<a class="jpl-link" href="#page=fuel-control&tab=estimate&who=' + encodeURIComponent(r["Foreman"] || "") + "&wk=" + weekOf(r._d) + '">' +
          "Open " + esc(r["Foreman"] || "the foreman") + "’s week in Fuel Control →</a>";
        // THE FUEL FLAG (his rule 2026-10-27): "if fuel expenditure is more by 30% then what was expected we should
        // flag it as some issue. but lets make minimum of 10$" -- paid at least 30% AND at least $10 over the
        // estimate. Nothing paid at all is not "over": it has its own state (cash fuel never written down?).
        const FUEL_OVER_PCT = 0.30, FUEL_OVER_MIN = 10;
        function fuelOf(days) {
          const fs = days.map(fuelDay);
          if (!fs.some(Boolean)) return null;
          const real = fs.reduce((a, x) => a + (x ? x.real : 0), 0), est = fs.reduce((a, x) => a + (x ? x.est : 0), 0), diff = real - est;
          const state = real < 0.5 ? "none" : diff >= Math.max(FUEL_OVER_PCT * est, FUEL_OVER_MIN) ? "over" : "ok";
          return { real, est, diff, pct: est > 0 ? diff / est : null, state };
        }

        const hashJob = () => { const m = /[#&]job=([^&]+)/.exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : ""; };
        const resolveJob = s => {
          if (!s || byKey.has(s)) return s;
          // a link may carry a bare job code or closing number: find its job
          const hit = rows.find(r => r["Job Code"] === s || String(r["Closing #"]) === s);
          return hit ? hit["Job Key"] : "";
        };
        let sel = resolveJob(hashJob());

        /* ---- one row per job (a delivery day folds into its pickup) ---- */
        const JOBS = [];
        byKey.forEach((days, key) => {
          const f = days[0], sales = [f["Sales Person"], f["Sales Person 2"], f["Sales Person 3"]].filter(Boolean);
          const j = { key, d: f._d, code: f["Job Code"] || "#" + f["Closing #"], customer: f["Customer"] || "",
            company: f["Company"] || "", type: f["Moving Type"] || "", state: f["State"] || "", foreman: f["Foreman"] || "",
            sales: sales.join(", "), salesAll: sales, source: f["Source"] || "", days: days.length,
            bill: days.reduce((a, r) => a + num(r["Total Bill"]), 0), full: days.reduce((a, r) => a + num(r["Full Profit"]), 0) };
          j.m = j.bill > 0 ? j.full / j.bill : null;
          j.fuel = fuelOf(days);
          j.fdiff = j.fuel && j.fuel.state !== "none" ? j.fuel.diff : null;
          j.hay = [j.code, j.customer, j.foreman, j.sales].concat(days.map(r => "#" + r["Closing #"] + " " + r["Closing #"] + " " + (r["Job Code"] || "")))
            .join(" ").toLowerCase();
          JOBS.push(j);
        });
        const firstDay = JOBS.reduce((a, j) => j.d && j.d < a ? j.d : a, lastDay || "9999");
        const yr = (lastDay || "2026").slice(0, 4);
        const PERIODS = [["month", "This month"], ["ytd", yr + " to date"], ["12m", "Last 12 months"], ["custom", "Custom"]];
        const COLS = [["d", "Date"], ["code", "Job"], ["customer", "Customer"], ["company", "Company"], ["type", "Move type"],
          ["state", "State"], ["foreman", "Foreman"], ["sales", "Salesperson"], ["bill", "Billed", 1], ["full", "Full profit", 1], ["m", "Margin", 1], ["fdiff", "Fuel vs estimate", 1]];
        const FUELS = [["", "All"], ["over", "Over the estimate"], ["ok", "Within the estimate"], ["none", "No fuel recorded"], ["nodata", "Before the WEX data"]];
        const BANDS = [["", "All"], ["loss", "Loss-making"], ["0", "0–20%"], ["20", "20–40%"], ["40", "40% and up"], ["nobill", "Nothing billed"]];
        const V = { period: "ytd", from: "", to: "", company: "", q: "", type: "", state: "", foreman: "", sales: "", source: "",
                    band: "", fuel: "", sort: "d", dir: -1, page: 0, size: 25 };
        const ymd = dt => dt.toISOString().slice(0, 10);
        const shiftYear = (d, n) => String(+d.slice(0, 4) + n) + d.slice(4);
        function range() {
          const end = lastDay || ymd(new Date());
          if (V.period === "month") return [end.slice(0, 8) + "01", end];
          if (V.period === "12m") { const a = new Date(shiftYear(end, -1) + "T00:00:00"); a.setDate(a.getDate() + 1); return [ymd(a), end]; }
          if (V.period === "custom") return [V.from || firstDay, V.to || end];
          return [yr + "-01-01", end];
        }
        const pctTxt = v => v == null ? "—" : (v < 0 ? "−" : "") + Math.abs(Math.round(100 * v)) + "%";
        const shortMoney = v => { const a = Math.abs(v), sg = v < 0 ? "−$" : "$";
          return a >= 1e6 ? sg + (a / 1e6).toFixed(2) + "M" : a >= 1e4 ? sg + Math.round(a / 1e3) + "k" : sg + Math.round(a).toLocaleString(); };
        function inBand(j) {
          if (!V.band) return true;
          if (V.band === "loss") return j.full < 0;
          if (V.band === "nobill") return !(j.bill > 0);
          if (j.m == null) return false;
          return V.band === "0" ? j.m >= 0 && j.m < 0.2 : V.band === "20" ? j.m >= 0.2 && j.m < 0.4 : j.m >= 0.4;
        }
        // everything but the period: the chart's months come from here too
        function passes(j) {
          if (V.company && j.company !== V.company) return false;
          if (V.type && j.type !== V.type) return false;
          if (V.state && j.state !== V.state) return false;
          if (V.foreman && j.foreman !== V.foreman) return false;
          if (V.sales && !j.salesAll.includes(V.sales)) return false;
          if (V.source && j.source !== V.source) return false;
          if (!inBand(j)) return false;
          if (V.fuel && (j.fuel ? j.fuel.state : "nodata") !== V.fuel) return false;
          const q = V.q.trim().toLowerCase();
          return !q || q.split(/\s+/).every(t => j.hay.includes(t));
        }
        const within = (j, r) => j.d >= r[0] && j.d <= r[1];

        host.innerHTML =
          '<div class="rs-page-head"><div class="jpl-eyebrow">Financial</div><h1>Job P&L</h1>' +
          '<p class="jpl-sub">Every job with what it billed and what it left after every cost. Pick one to see its full ' +
          'breakdown: every cost on its closing sheet, the costs the sheet leaves out (truck, card fuel, packing, refunds) ' +
          'and what was left. A delivery day counts with its pickup.</p></div>' +
          '<div class="jpl-top"><div class="rs-seg" id="jplPer" role="group" aria-label="Period">' +
            PERIODS.map(p => '<button type="button" data-per="' + p[0] + '">' + esc(p[1]) + "</button>").join("") + "</div>" +
            '<span id="jplCustom" hidden><input type="date" class="rs-inp" id="jplFrom" aria-label="From"> – ' +
            '<input type="date" class="rs-inp" id="jplTo" aria-label="To"></span>' +
            '<select class="rs-sel" id="jplCo" aria-label="Company"></select></div>' +
          '<div id="jplKpis" class="jpl-tiles"></div>' +
          '<div class="panel"><div class="jpl-chead"><b>Month by month</b><span class="jpl-key">' +
            '<span><i class="jpl-sw" id="jplSwP"></i>Full profit</span><span><i class="jpl-sw" id="jplSwC"></i>Costs</span>' +
            '<span>% = profit margin · click a month to see its jobs</span></span></div>' +
            '<div class="jpl-chart"><canvas id="jplChart" role="img" aria-label="Billed per month, split into full profit and costs, with the profit margin above each month"></canvas></div></div>' +
          '<div class="rs-bar" id="jplBar">' +
            '<div class="rs-fld jpl-qfld"><span>Search</span><input id="jplQ" class="rs-inp" type="search" autocomplete="off" ' +
              'placeholder="Job code, customer, closing #, foreman, salesperson" aria-label="Search jobs"></div>' +
            [["type", "Move type"], ["state", "State"], ["foreman", "Foreman"], ["sales", "Salesperson"], ["source", "Source"]]
              .map(f => '<div class="rs-fld"><span>' + f[1] + '</span><select class="rs-sel" data-f="' + f[0] + '"></select></div>').join("") +
            '<div class="rs-fld"><span>Margin</span><select class="rs-sel" data-f="band">' +
              BANDS.map(b => '<option value="' + b[0] + '">' + esc(b[1]) + "</option>").join("") + "</select></div>" +
            '<div class="rs-fld"><span>Fuel check</span><select class="rs-sel" data-f="fuel" title="Over = paid at least 30% and at least $10 more than the route’s estimate"></select></div>' +
            '<button type="button" class="rs-tog" id="jplLoss"><i></i>Losses only</button>' +
            '<button type="button" class="rs-btn" id="jplReset">Reset</button></div>' +
          '<div class="panel jpl-list"><div id="jplTable"></div></div>' +
          '<div class="jpl-scrim" id="jplScrim" hidden></div>' +
          '<aside class="jpl-drawer" id="jplDrawer" role="dialog" aria-modal="true" aria-label="Job breakdown" hidden>' +
            '<div class="jpl-dhead"><span class="jpl-eyebrow">Job breakdown</span>' +
            '<button type="button" class="rs-btn" id="jplClose">Close</button></div><div id="jplJob"></div></aside>';
        const $ = id => host.querySelector("#" + id);
        const $q = $("jplQ"), $job = $("jplJob"), $drawer = $("jplDrawer"), $scrim = $("jplScrim");
        const css = (name, dflt) => { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || dflt; };
        const C_PROFIT = css("--pos", "#1baf7a"), C_COST = css("--line-2", "#c3c2b7");
        $("jplSwP").style.background = C_PROFIT; $("jplSwC").style.background = C_COST;

        /* ---- controls ---- */
        function fillSelect(el, label, values, cur) {
          el.innerHTML = '<option value="">' + esc(label) + "</option>" +
            values.map(v => '<option value="' + esc(v[0]) + '"' + (v[0] === cur ? " selected" : "") + ">" + esc(v[0]) + " (" + v[1] + ")</option>").join("");
          if (cur && !values.some(v => v[0] === cur)) el.insertAdjacentHTML("beforeend", '<option value="' + esc(cur) + '" selected>' + esc(cur) + " (0)</option>");
        }
        const counted = (list, f) => { const c = new Map(); list.forEach(j => [].concat(f(j)).forEach(v => { if (v) c.set(v, (c.get(v) || 0) + 1); }));
          return Array.from(c.entries()).sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))); };
        function paintControls() {
          host.querySelectorAll("[data-per]").forEach(b => b.classList.toggle("on", b.dataset.per === V.period));
          $("jplCustom").hidden = V.period !== "custom";
          const r = range(); $("jplFrom").value = r[0]; $("jplTo").value = r[1];
          const inR = JOBS.filter(j => within(j, r));
          fillSelect($("jplCo"), "All companies", counted(inR, j => j.company), V.company);
          const pool = inR.filter(j => !V.company || j.company === V.company);
          fillSelect(host.querySelector('[data-f="type"]'), "All", counted(pool, j => j.type), V.type);
          fillSelect(host.querySelector('[data-f="state"]'), "All", counted(pool, j => j.state), V.state);
          fillSelect(host.querySelector('[data-f="foreman"]'), "All", counted(pool, j => j.foreman), V.foreman);
          fillSelect(host.querySelector('[data-f="sales"]'), "All", counted(pool, j => j.salesAll), V.sales);
          fillSelect(host.querySelector('[data-f="source"]'), "All", counted(pool, j => j.source), V.source);
          host.querySelector('[data-f="band"]').value = V.band;
          const fc = { over: 0, ok: 0, none: 0, nodata: 0 };
          pool.forEach(j => { fc[j.fuel ? j.fuel.state : "nodata"]++; });
          host.querySelector('[data-f="fuel"]').innerHTML = FUELS.map(o => '<option value="' + o[0] + '"' + (o[0] === V.fuel ? " selected" : "") + ">" +
            esc(o[1]) + (o[0] ? " (" + fc[o[0]].toLocaleString() + ")" : "") + "</option>").join("");
          $("jplLoss").classList.toggle("on", V.band === "loss");
        }

        /* ---- the tiles ---- */
        function paintKpis(list, r) {
          const n = list.length, bill = list.reduce((a, j) => a + j.bill, 0), full = list.reduce((a, j) => a + j.full, 0);
          const ms = list.filter(j => j.m != null).map(j => j.m).sort((a, b) => a - b);
          const med = ms.length ? ms[Math.floor(ms.length / 2)] : null;
          const loss = list.filter(j => j.full < 0).length;
          // the same days a year earlier, with the same filters -- only when the data reaches back that far
          const pr = [shiftYear(r[0], -1), shiftYear(r[1], -1)];
          let cmp = "";
          if (pr[0] >= firstDay) {
            const before = JOBS.filter(j => within(j, pr) && passes(j)).length;
            if (before) { const d = Math.round(100 * (n - before) / before); cmp = (d >= 0 ? "+" : "−") + Math.abs(d) + "% on the same days of " + pr[0].slice(0, 4); }
          }
          const tile = (l, v, sub, cls) => '<div class="kpi"><div class="l">' + l + '</div><div class="v' + (cls ? " " + cls : "") + '">' + v +
            '</div><div class="s">' + sub + "</div></div>";
          $("jplKpis").innerHTML = '<div class="rs-kpis" style="--kpi-cols:6">' +
            tile("Jobs", n.toLocaleString(), cmp || esc(day(r[0])) + " – " + esc(day(r[1]))) +
            tile("Billed", shortMoney(bill), n ? money(bill / n) + " a job" : "—") +
            tile("Full profit", shortMoney(full), "after every cost", full < 0 ? "jpl-down" : "") +
            tile("Profit margin", bill > 0 ? (100 * full / bill).toFixed(1).replace("-", "−") + "%" : "—", med == null ? "—" : "median job " + pctTxt(med)) +
            tile("Profit a job", n ? money(full / n) : "—", "average") +
            tile("Loss-making", loss.toLocaleString(), n ? pctTxt(loss / n) + " of jobs" : "—", loss ? "jpl-down" : "") + "</div>";
        }

        /* ---- the chart: the 13 months to the period's end, billed = profit + costs ---- */
        let chart = null;
        function paintChart(r) {
          const end = r[1].slice(0, 7), months = [];
          let y = +end.slice(0, 4), mo = +end.slice(5, 7);
          for (let k = 0; k < 13; k++) { months.unshift(y + "-" + String(mo).padStart(2, "0")); if (--mo === 0) { mo = 12; y--; } }
          const agg = new Map(months.map(m => [m, { bill: 0, full: 0 }]));
          JOBS.forEach(j => { const a = agg.get(j.d.slice(0, 7)); if (a && passes(j)) { a.bill += j.bill; a.full += j.full; } });
          const B = months.map(m => agg.get(m).bill), P = months.map(m => agg.get(m).full), Cc = B.map((b, k) => b - P[k]);
          const lbl = months.map(m => (RS.monthName ? RS.monthName(+m.slice(5)) : m).slice(0, 3) + (m.endsWith("-01") || m === months[0] ? " " + m.slice(2, 4) : ""));
          const ink = css("--muted", "#5b6b7c"), grid = css("--line", "#e2e8f0");
          const marginLabels = { id: "jplMargins", afterDatasetsDraw(c) {
            const x = c.ctx, top = c.getDatasetMeta(1);
            x.save(); x.font = "11px " + getComputedStyle(document.body).fontFamily; x.fillStyle = ink; x.textAlign = "center";
            // on a narrow screen the bars are too thin to carry a label each; the tooltip still has it
            if (top.data.length && top.data[0].width < 22) { x.restore(); return; }
            top.data.forEach((bar, k) => { if (B[k] > 0) x.fillText(pctTxt(P[k] / B[k]), bar.x, Math.min(bar.y, c.getDatasetMeta(0).data[k].y) - 5); });
            x.restore(); } };
          if (chart) { try { chart.destroy(); } catch (e) { /* gone with the canvas */ } chart = null; }
          if (typeof Chart === "undefined") return;
          try {
            chart = new Chart($("jplChart"), {
              type: "bar",
              data: { labels: lbl, datasets: [
                { label: "Full profit", data: P, backgroundColor: C_PROFIT, maxBarThickness: 26, borderRadius: 0 },
                { label: "Costs", data: Cc, backgroundColor: C_COST, maxBarThickness: 26, borderRadius: { topLeft: 4, topRight: 4 } }] },
              options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 18 } },
                onClick: (e, els) => { if (!els.length) return; const m = months[els[0].index];
                  const last = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate();
                  V.period = "custom"; V.from = m + "-01"; V.to = m + "-" + String(last).padStart(2, "0"); V.page = 0; paintAll(); },
                onHover: (e, els) => { e.native.target.style.cursor = els.length ? "pointer" : "default"; },
                plugins: { legend: { display: false }, tooltip: { callbacks: {
                  title: items => { const m = months[items[0].dataIndex]; return (RS.monthName ? RS.monthName(+m.slice(5)) : m) + " " + m.slice(0, 4); },
                  label: t => t.dataset.label + ": " + money(t.raw),
                  footer: items => { const k = items[0].dataIndex; return "Billed " + money(B[k]) + (B[k] > 0 ? " · margin " + pctTxt(P[k] / B[k]) : ""); } } } },
                scales: { x: { stacked: true, grid: { display: false }, ticks: { color: ink, autoSkip: true, maxRotation: 0 } },
                  y: { stacked: true, grid: { color: grid }, border: { display: false }, ticks: { color: ink, callback: v => shortMoney(v) } } } },
              plugins: [marginLabels] });
          } catch (e) { console.warn("job-pnl chart:", e); }
        }

        /* ---- the table ---- */
        function sorted(list) {
          const k = V.sort, dir = V.dir;
          return list.slice().sort((a, b) => {
            const x = a[k], y = b[k];
            if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
            return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir || (a.d < b.d ? 1 : a.d > b.d ? -1 : 0);
          });
        }
        const signed$ = v => (v < 0 ? "−$" : "+$") + Math.round(Math.abs(v)).toLocaleString();
        const signedPct = v => (v < 0 ? "−" : "+") + Math.abs(Math.round(100 * v)) + "%";
        function fuelCell(f) {
          if (!f) return '<span class="jpl-dim" title="The WEX card data starts ' + esc(day(fuelFrom)) + '">—</span>';
          const tip = "Paid " + money(f.real) + " against an estimate of " + money(f.est);
          if (f.state === "none") return '<span class="jpl-dim" title="No WEX fill and no fuel on the closing sheet; estimate ' + money(f.est) + '">none paid</span>';
          const t = signed$(f.diff) + (f.pct != null ? " · " + signedPct(f.pct) : "");
          return f.state === "over" ? '<span class="rs-pill bad" title="' + tip + '">' + t + "</span>" : '<span title="' + tip + '">' + t + "</span>";
        }
        let current = [];
        function paintTable(list) {
          current = sorted(list);
          const n = current.length, pages = Math.max(1, Math.ceil(n / V.size));
          if (V.page >= pages) V.page = pages - 1;
          const from = V.page * V.size, slice = current.slice(from, from + V.size);
          // the fuel total: paid against estimated over the jobs that have fuel paid, and how many were flagged
          function fuelTotal(list) {
            const fx = list.filter(j => j.fuel && j.fuel.state !== "none");
            if (!fx.length) return "—";
            const real = fx.reduce((a, j) => a + j.fuel.real, 0), est = fx.reduce((a, j) => a + j.fuel.est, 0), over = fx.filter(j => j.fuel.state === "over").length;
            return '<span title="Paid ' + money(real) + " against " + money(est) + ' estimated, on ' + fx.length + ' jobs">' + signed$(real - est) +
              (est > 0 ? " · " + signedPct((real - est) / est) : "") + "</span>" + (over ? '<br><small class="jpl-neg">' + over.toLocaleString() + " flagged</small>" : "");
          }
          const bill = current.reduce((a, j) => a + j.bill, 0), full = current.reduce((a, j) => a + j.full, 0);
          const neg = v => v < 0 ? " jpl-neg" : "";
          if (!n) {
            $("jplTable").innerHTML = '<div class="jpl-empty">No job matches these filters. <button type="button" class="rs-btn" data-reset>Reset the filters</button></div>';
            return;
          }
          const pageBtns = [];
          const add = p => pageBtns.push('<button type="button" class="rs-btn' + (p === V.page ? " on" : "") + '" data-page="' + p + '"' +
            (p === V.page ? ' aria-current="page"' : "") + ">" + (p + 1) + "</button>");
          let last = -1;
          for (let p = 0; p < pages; p++) {
            if (p === 0 || p === pages - 1 || Math.abs(p - V.page) <= 2) { if (last >= 0 && p - last > 1) pageBtns.push("<span>…</span>"); add(p); last = p; }
          }
          $("jplTable").innerHTML = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>' +
            COLS.map(c => '<th class="' + (c[2] ? "num" : "") + (V.sort === c[0] ? " on" : "") + '"' +
              (V.sort === c[0] ? ' aria-sort="' + (V.dir > 0 ? "ascending" : "descending") + '"' : "") + '><button type="button" data-sort="' + c[0] + '">' +
              esc(c[1]) + (V.sort === c[0] ? (V.dir > 0 ? " ▲" : " ▼") : "") + "</button></th>").join("") + "</tr></thead><tbody>" +
            slice.map(j => '<tr class="click" data-key="' + esc(j.key) + '" tabindex="0">' +
              "<td>" + esc(day(j.d)) + "</td><td>" + esc(j.code) + (j.days > 1 ? ' <span class="jpl-chip">' + j.days + " days</span>" : "") + "</td>" +
              '<td class="jpl-cust">' + esc(j.customer || "—") + "</td><td>" + esc(j.company) + "</td><td>" + esc(String(j.type).replace(/ Moving$/, "")) + "</td>" +
              "<td>" + esc(j.state) + "</td><td>" + esc(j.foreman || "—") + "</td><td>" + esc(j.sales || "—") + "</td>" +
              '<td class="num">' + money(j.bill) + '</td><td class="num' + neg(j.full) + '">' + money(j.full) + '</td><td class="num' + neg(j.full) + '">' + pctTxt(j.m) + '</td><td class="num">' + fuelCell(j.fuel) + "</td></tr>").join("") +
            '</tbody><tfoot><tr><td colspan="8">Total · ' + n.toLocaleString() + " job" + (n === 1 ? "" : "s") + (pages > 1 ? " (all pages)" : "") + "</td>" +
              '<td class="num">' + money(bill) + '</td><td class="num' + neg(full) + '">' + money(full) + '</td><td class="num' + neg(full) + '">' +
              (bill > 0 ? pctTxt(full / bill) : "—") + '</td><td class="num">' + fuelTotal(current) + "</td></tr></tfoot></table></div>" +
            '<div class="jpl-pager"><span>' + (from + 1).toLocaleString() + "–" + Math.min(from + V.size, n).toLocaleString() + " of " + n.toLocaleString() +
              ' · <select class="rs-sel" id="jplSize" aria-label="Jobs a page">' + [25, 50, 100].map(k => '<option value="' + k + '"' + (k === V.size ? " selected" : "") + ">" + k + " a page</option>").join("") + "</select></span>" +
              '<span class="jpl-pages"><button type="button" class="rs-btn" data-page="' + (V.page - 1) + '"' + (V.page === 0 ? " disabled" : "") + ' aria-label="Previous page">‹</button>' +
              pageBtns.join("") + '<button type="button" class="rs-btn" data-page="' + (V.page + 1) + '"' + (V.page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">›</button></span>' +
              '<button type="button" class="rs-btn" id="jplCsv">Download for Excel</button></div>';
          $("jplSize").onchange = e => { V.size = +e.target.value; V.page = 0; paintTable(list); };
          $("jplCsv").onclick = () => download(current);
        }
        // every job the filters keep, not only this page; a text that starts like a formula is quoted
        function download(list) {
          const cell = v => { let t = v == null ? "" : String(v); if (typeof v === "string" && /^[=+\-@]/.test(t)) t = "'" + t;
            return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
          const head = ["Date", "Job", "Customer", "Company", "Move type", "State", "Foreman", "Salesperson", "Source", "Days", "Billed", "Full profit", "Profit margin %",
                        "Fuel estimate", "Fuel paid", "Fuel check"];
          const FUELTXT = { over: "Over the estimate", ok: "Within", none: "No fuel recorded" };
          const lines = [head.join(",")].concat(list.map(j => [j.d, j.code, j.customer, j.company, j.type, j.state, j.foreman, j.sales, j.source, j.days,
            Math.round(j.bill * 100) / 100, Math.round(j.full * 100) / 100, j.m == null ? "" : Math.round(1000 * j.m) / 10,
            j.fuel ? Math.round(j.fuel.est * 100) / 100 : "", j.fuel ? Math.round(j.fuel.real * 100) / 100 : "",
            j.fuel ? FUELTXT[j.fuel.state] : "Before the WEX data"].map(cell).join(",")));
          const r = range(), a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
          a.download = "Job P&L " + r[0] + " to " + r[1] + " (" + list.length + " jobs).csv";
          document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
        }

        function paintAll(skipChart) {
          paintControls();
          const r = range(), list = JOBS.filter(j => within(j, r) && passes(j));
          paintKpis(list, r);
          if (!skipChart) paintChart(r);
          paintTable(list);
        }

        /* ---- the side panel ---- */
        function open(key) {
          sel = key;
          try { history.replaceState(null, "", "#page=job-pnl&job=" + encodeURIComponent(key)); } catch (e) { /* ignore */ }
          paintJob();
          $drawer.hidden = false; $scrim.hidden = false; $drawer.scrollTop = 0;
          $("jplClose").focus();
        }
        function close() {
          if ($drawer.hidden) return;
          sel = null; $drawer.hidden = true; $scrim.hidden = true; $job.innerHTML = "";
          try { history.replaceState(null, "", "#page=job-pnl"); } catch (e) { /* ignore */ }
        }

        // what each cost paid for -- his pick: group by purpose, every line shown; the tag says
        // where a line comes from when it is not the closing sheet
        const GROUPS = [
          { id: "crew", label: "Crew", color: "#2a78d6", lines: [
            ["Foreman, hourly", r => num(r["Foreman Pay"]) - num(r["Foreman Packing Commission"]), "", r => r["Foreman"]],
            ["Foreman, packing commission", r => r["Foreman Packing Commission"], ""],
            ["Driver", r => r["Driver Pay"], "", r => r["Driver"]],
            ["Helpers", r => r["Helpers Pay"], ""],
            ["Review bonus", r => r["Crew Review Pay"], "contract"],
            ["Bulky items pay", r => r["Crew Bulky Pay"], "contract"],
            ["Hoisting, storage and junk pay", r => r["Crew Other Extras"], "contract"],
            ["Company-paid tip", r => r["Company Tip"], ""]] },
          { id: "comm", label: "Commission", color: "#6250d6", lines: [
            ["Sales commission", r => r["Sales Commission"], "", r => [r["Sales Person"], r["Sales Person 2"], r["Sales Person 3"]].filter(Boolean).join(", ")]] },
          // FUEL AND TOLLS FOR THE WHOLE ROUTE (his ruling 2026-10-22, the CL Analysis way): they
          // replace the sheet's Fuel and Tolls, which hold whatever fill-up or toll fell on that day
          { id: "truck", label: "Truck and fuel", color: "#eda100", lines: [
            ["Rental truck", r => r["Truck Ownership"] === "Rental" ? r["Truck Cost"] : 0, "added", r => r["Truck Ownership"] === "Rental" ? truckNote(r) : ""],
            ["Truck rent", r => r["Truck Rent on Sheet"], ""],
            ["Fuel", r => r["Fuel Est"], "estimated", r => miles(r) + " ÷ 7 mpg × $" + num(r["Fuel Per Gallon"]).toFixed(2) + " a gallon"],
            ["Tolls", r => r["Toll Est"], "estimated", r => miles(r) + " × $" + num(r["Toll Per Mile"]).toFixed(3) + " a mile"],
            ["Crew car", r => r["Car"], ""]] },
          { id: "other", label: "Packing and other", color: "#e87ba4", lines: [
            ["Packing material cost", r => r["Packing Cost"], "estimated", () => "15% of packing sold"],
            ["Card processing fee", r => r["Card Fee"], "estimated", r => num(r["Card Fee"]) > 0 ? "3.5% of " + money(r["Card Payment"]) + " paid by card" : ""],
            ["Hotel", r => r["Hotel"], ""],
            ["Other expenses", r => r["Other Expenses"], ""],
            ["Other on the closing sheet", r => r["Sheet Other"], "", () => "in the sheet’s total, not in a column of its own"],
            ["Refunds", r => r["Refunds"], "added"]] },
        ];
        const FIXED_COLOR = "#898781", AD_COLOR = "#eb6834";
        const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August",
                        "September", "October", "November", "December"];
        const monthName = ym => { const p = String(ym || "").split("-"); return p.length === 2 ? MONTHS[+p[1] - 1] + " " + p[0] : String(ym || ""); };
        // the month's statistics behind one job's share of the ads
        function adNote(r) {
          const src = r["Ad Source"] || r["Source"] || "this source", jm = String(r._d || "").slice(0, 7), am = r["Ad Month"] || jm;
          if (num(r["Is Second Day"]) === 1) return "";   // the pickup day carries the job's share
          const spend = num(r["Ad Spend Month"]), jobs = num(r["Ad Jobs Month"]);
          if (!(spend > 0)) return src + ": no ad spend" + (am === jm ? " in " + monthName(am) : "");
          const late = am !== jm ? " (" + monthName(jm) + "’s ads are not in the books yet)" : "";
          return src + ", " + monthName(am) + ": " + money(spend) + " of ads ÷ " + jobs + " job" + (jobs === 1 ? "" : "s") +
            " = " + money(spend / Math.max(jobs, 1)) + " a job" + late;
        }
        const BASIS = { "GPS": "GPS", "Contract": "contract miles", "Zip codes": "zip codes", "Average": "the move type’s average" };
        // a long-distance closing names its own leg (src/job_pnl.py, mart_ld_route)
        const miles = r => Math.round(num(r["Miles"])) + " mi (" + (BASIS[r["Miles Basis"]] ||
          (/^long-distance/.test(r["Miles Basis"] || "") ? r["Miles Basis"] : "the move type’s average")) + ")";
        function truckNote(r) {
          const rate = num(r["Truck Day Rate"]), share = num(r["Truck Day Jobs"]);
          const who = r["Truck Ownership"] === "Owned" ? "truck " + r["Truck"]
            : (r["Truck Vendor"] === "Unit #" || r["Truck Vendor"] === "Unlabeled" ? "rental" : r["Truck Vendor"]);
          return who + (rate ? ", " + money(rate) + " a day" : "") + (share > 1 ? ", shared by " + share + " jobs" : "");
        }

        function paintJob() {
          const days = sel ? byKey.get(sel) : null;
          if (!days || !days.length) { $job.innerHTML = ""; return; }
          const first = days[0], multi = days.length > 1;
          const sum = f => days.reduce((acc, r) => acc + num(f(r)), 0);
          const billed = sum(r => r["Total Bill"]);
          const groupTotal = (g, r) => g.lines.reduce((acc, ln) => acc + num(ln[1](r)), 0);
          const gTot = GROUPS.map(g => sum(r => groupTotal(g, r)));
          const fixed = sum(fixedOf), ads = sum(adOf), kept = sum(beforeFixed), full = sum(r => r["Full Profit"]);
          const type = first["Moving Type"] || "Other";
          const avg = AVG[type] && AVG[type].bill ? AVG[type].kept / AVG[type].bill : null;
          const m = billed ? kept / billed : null;
          const signed = n => (n < 0 ? "−" : "") + Math.abs(n);
          const share = v => billed ? signed(Math.round(100 * v / billed)) + "%" : "—";
          const ncols = days.length + (multi ? 1 : 0) + 2;

          /* ---- the summary: what the job was and what it left ---- */
          const typeWord = String(type).replace(/ Moving$/, "").toLowerCase();
          const parts = [];
          const opener = (multi ? (days.length === 2 ? "two" : days.length) + "-day " : "") + esc(typeWord) + " move" +
            (first["State"] ? " in " + esc(first["State"]) : "") + ".";
          parts.push(opener.charAt(0).toUpperCase() + opener.slice(1));
          if (multi) {
            parts.push(days.map((r, i) => num(r["Total Bill"]) > 0
              ? "day " + (i + 1) + " billed <b>" + money(r["Total Bill"]) + "</b>"
              : "day " + (i + 1) + " was worked but <b>not billed</b>").join("; ").replace(/^d/, "D") + ".");
          } else if (billed > 0) {
            parts.push("It billed <b>" + money(billed) + "</b>.");
          } else {
            parts.push("It has <b>no bill</b> on its closing sheet.");
          }
          if (billed > 0) {
            let cmp = "";
            if (avg != null) {
              const d = Math.round(100 * (m - avg));
              cmp = d >= 2 ? ", above the " + esc(typeWord) + "-move average of " + Math.round(100 * avg) + "%"
                : d <= -2 ? ", below the " + esc(typeWord) + "-move average of " + Math.round(100 * avg) + "%"
                : ", in line with the " + esc(typeWord) + "-move average of " + Math.round(100 * avg) + "%";
            }
            parts.push("After crew, sales, truck, fuel and every other job cost, <b>" + money(kept) + " (" + share(kept) + ")</b> was left before fixed costs" + cmp + ".");
            const big = GROUPS.map((g, i) => [g.label, gTot[i]]).sort((x, y) => y[1] - x[1])[0];
            if (big && big[1] > 0) parts.push("The biggest cost was " + esc(big[0].toLowerCase()) + ", " + share(big[1]) + " of the bill.");
            if (fixed > 0.5 || ads > 0.5) {
              const after = [fixed > 0.5 ? "the owned truck’s fixed share (" + money(fixed) + ")" : "",
                             ads > 0.5 ? "this job’s share of " + esc(first["Ad Source"] || "its source") + "’s ads (" + money(ads) + ")" : ""].filter(Boolean);
              parts.push(after.join(" and ").replace(/^t/, "T") + (after.length > 1 ? " leave" : " leaves") + " a full profit of <b>" + money(full) + "</b>.");
            }
          }
          const refunds = sum(r => r["Refunds"]);
          if (refunds > 0.5) parts.push("A " + money(refunds) + " refund was paid.");
          // his ask: say plainly how much of it is worked out rather than recorded
          const estimated = sum(r => num(r["Fuel Est"]) + num(r["Toll Est"]) + num(r["Packing Cost"]) + num(r["Card Fee"]) + adOf(r));
          if (estimated > 0.5) parts.push(money(estimated) + " of the costs are estimates (fuel, tolls, packing, card fee, ad spend), marked in the ledger.");

          /* ---- where each billed dollar went ---- */
          let barHtml = "";
          if (billed > 0) {
            const segs = GROUPS.map((g, i) => [g.label, gTot[i], g.color]).concat([["Fixed costs", fixed, FIXED_COLOR], ["Ad spend", ads, AD_COLOR]]);
            const costSum = segs.reduce((acc, x) => acc + Math.max(0, x[1]), 0);
            const base = Math.max(billed, costSum);
            if (full > 0) segs.push(["Kept", full, "var(--pos)"]);
            barHtml = '<div class="jpl-bar" role="img" aria-label="Where each billed dollar went">' +
              segs.filter(x => x[1] > 0.5).map(x => '<span style="width:' + (100 * x[1] / base).toFixed(2) + "%;background:" + x[2] + '" title="' +
                esc(x[0]) + " " + money(x[1]) + '"></span>').join("") + "</div>" +
              '<div class="jpl-legend">' + segs.filter(x => x[1] > 0.5).map(x => '<span><i class="jpl-sw" style="background:' + x[2] + '"></i>' +
                esc(x[0]) + "<b>" + share(x[1]) + "</b></span>").join("") +
              (full < 0 ? '<span class="jpl-neg">Loss <b class="jpl-neg">' + money(full) + "</b></span>" : "") + "</div>";
          }

          /* ---- the ledger ---- */
          const rowsHtml = [];
          const fd = days.map(fuelDay);
          const tcell = (v, cls) => '<td class="' + (cls || "") + (Math.abs(v) < 0.5 && !cls ? " jpl-z" : "") + '">' +
            (Math.abs(v) < 0.5 ? "—" : money(v)) + "</td>";
          const pcell = v => '<td class="jpl-p">' + (Math.abs(v) < 0.5 ? "" : share(v)) + "</td>";
          const rowVals = f => { const vals = days.map(f).map(num); return { vals, tot: vals.reduce((x, y) => x + y, 0) }; };
          const pushRow = (cls, label, f, opts) => {
            opts = opts || {};
            const { vals, tot } = rowVals(f);
            if (!opts.always && vals.every(v => Math.abs(v) < 0.5)) return;
            rowsHtml.push('<tr class="' + cls + '"><td>' + label + "</td>" + vals.map(v => tcell(v, opts.cellCls)).join("") +
              (multi ? tcell(tot, opts.cellCls) : "") + pcell(tot) + "</tr>");
          };
          const head = label => rowsHtml.push('<tr class="jpl-grp"><td colspan="' + ncols + '">' + label + "</td></tr>");

          head("Money in");
          const anyContract = days.some(r => num(r["Has Contract"]) === 1);
          if (anyContract) {
            const contractLines = r => num(r["Labor Charge"]) + num(r["Packing Charged"]) + num(r["Stairs Fee"]) + num(r["Bulky Fee"]) +
              num(r["Hoisting Fee"]) + num(r["Overnight Fee"]) + num(r["Storage Fee"]) + num(r["Other Charges"]) - num(r["Contract Discounts"]);
            pushRow("jpl-item", "Labor", r => r["Labor Charge"]);
            pushRow("jpl-item", "Packing materials", r => r["Packing Charged"]);
            pushRow("jpl-item", "Stairs fee", r => r["Stairs Fee"]);
            pushRow("jpl-item", "Bulky items fee", r => r["Bulky Fee"]);
            pushRow("jpl-item", "Hoisting", r => r["Hoisting Fee"]);
            pushRow("jpl-item", "Overnight", r => r["Overnight Fee"]);
            pushRow("jpl-item", "Storage", r => r["Storage Fee"]);
            pushRow("jpl-item", "Other charges <small>service, waiting time, long carry, floor, junk</small>", r => r["Other Charges"]);
            pushRow("jpl-item", "Discounts", r => -num(r["Contract Discounts"]));
            pushRow("jpl-item", "Billed without a contract", r => num(r["Has Contract"]) === 1 ? 0 : num(r["Total Bill"]));
            pushRow("jpl-item", "Closing sheet differs from the contract by", r => num(r["Has Contract"]) === 1 ? num(r["Total Bill"]) - contractLines(r) : 0);
          }
          pushRow("jpl-tot", "Billed", r => r["Total Bill"], { always: true });

          GROUPS.forEach((g, gi) => {
            if (gTot[gi] === 0 && days.every(r => Math.abs(groupTotal(g, r)) < 0.5)) return;
            const vals = days.map(r => groupTotal(g, r));
            rowsHtml.push('<tr class="jpl-grp"><td><i class="jpl-sw" style="background:' + g.color + '"></i>' + esc(g.label) + "</td>" +
              vals.map(v => tcell(v, "")).join("") + (multi ? tcell(gTot[gi], "") : "") + pcell(gTot[gi]) + "</tr>");
            g.lines.forEach(ln => {
              const who = ln[3] ? Array.from(new Set(days.map(r => ln[3](r)).filter(Boolean))).join(" · ") : "";
              const label = esc(ln[0]) + (ln[2] ? '<span class="jpl-tag' + (ln[2] === "estimated" ? " jpl-est" : "") + '">' + ln[2] + "</span>" : "") + (who ? " <small>" + esc(who) + "</small>" : "");
              pushRow("jpl-item", label, ln[1]);
            });
            // what was really paid for fuel, beside the estimate -- never in a total
            if (g.id === "truck" && fd.some(Boolean)) {
              const fv0 = fd.map(x => x ? x.real : 0);
              rowsHtml.push('<tr class="jpl-item jpl-info"><td>Fuel, real spending<span class="jpl-tag">not counted</span> ' +
                "<small>WEX card + closing sheet, this job’s share by miles · see the fuel check below</small></td>" +
                fd.map(x => "<td>" + (x ? money(x.real) : "—") + "</td>").join("") +
                (multi ? "<td>" + money(fv0.reduce((a, b) => a + b, 0)) + "</td>" : "") + '<td class="jpl-p"></td></tr>');
            }
          });

          const kv = rowVals(beforeFixed);
          rowsHtml.push('<tr class="jpl-band' + (kv.tot < 0 ? " jpl-loss" : "") + '"><td>Before fixed costs</td>' +
            kv.vals.map(v => '<td class="' + (v < 0 ? "jpl-neg" : "jpl-pos") + '">' + money(v) + "</td>").join("") +
            (multi ? '<td class="' + (kv.tot < 0 ? "jpl-neg" : "jpl-pos") + '">' + money(kv.tot) + "</td>" : "") +
            '<td class="jpl-p">' + share(kv.tot) + "</td></tr>");
          rowsHtml.push('<tr class="jpl-grp"><td><i class="jpl-sw" style="background:' + FIXED_COLOR + '"></i>Fixed costs</td>' +
            days.map(r => tcell(fixedOf(r), "")).join("") + (multi ? tcell(fixed, "") : "") + pcell(fixed) + "</tr>");
          const ownedTrucks = Array.from(new Set(days.filter(r => r["Truck Ownership"] === "Owned").map(truckNote))).join(" · ");
          pushRow("jpl-item", 'Owned truck<span class="jpl-tag">added</span> <small>' +
            (ownedTrucks ? esc(ownedTrucks) + " · insurance, parking, maintenance, loan payments" : "no owned truck on this job") +
            "</small>", fixedOf, { always: true });
          rowsHtml.push('<tr class="jpl-grp"><td><i class="jpl-sw" style="background:' + AD_COLOR + '"></i>Ad spend</td>' +
            days.map(r => tcell(adOf(r), "")).join("") + (multi ? tcell(ads, "") : "") + pcell(ads) + "</tr>");
          pushRow("jpl-item", 'This job’s share<span class="jpl-tag jpl-est">estimated</span> <small>' +
            esc(Array.from(new Set(days.map(adNote).filter(Boolean))).join(" · ")) + "</small>", adOf, { always: true });
          const fv = rowVals(r => r["Full Profit"]);
          rowsHtml.push('<tr class="jpl-final"><td>Full profit</td>' +
            fv.vals.map(v => '<td class="' + (v < 0 ? "jpl-neg" : "") + '">' + money(v) + "</td>").join("") +
            (multi ? '<td class="' + (fv.tot < 0 ? "jpl-neg" : "") + '">' + money(fv.tot) + "</td>" : "") +
            '<td class="jpl-p">' + share(fv.tot) + "</td></tr>");

          /* ---- notes ---- */
          const tip = sum(r => r["Customer Tip"]), balance = sum(r => r["Balance Due"]), claims = sum(r => r["Claims Filed"]);
          const notes = [];
          if (tip > 0) notes.push("The customer’s <b>" + money(tip) + "</b> tip went to the crew and is in neither money in nor costs.");
          if (balance > 0.5) notes.push("<b>" + money(balance) + "</b> was still due on the closing sheet.");
          if (claims > 0) notes.push("<b>" + claims + "</b> claim" + (claims > 1 ? "s were" : " was") + " filed on this job. Claims carry no dollar amount; any refund paid is in Refunds.");
          days.forEach((r, i) => {
            if (num(r["Has Contract"]) !== 1) notes.push((multi ? "Day " + (i + 1) : "This job") + " has no final digital contract, so its bill is shown as one line.");
          });
          if (days.some(r => r["Truck Ownership"] === "Rental" && num(r["Truck Rent on Sheet"]) > 0))
            notes.push("The rental truck’s rent is on the closing sheet, so nothing is added for it.");
          const sheetFuel = sum(r => r["Fuel on Sheet"]), sheetTolls = sum(r => r["Tolls"]), wex = sum(r => r["Card Fuel"]);
          if (sheetFuel + sheetTolls > 0.5)
            notes.push("The closing sheet recorded " + [sheetFuel > 0.5 ? money(sheetFuel) + " of fuel" : "", sheetTolls > 0.5 ? money(sheetTolls) + " of tolls" : ""]
              .filter(Boolean).join(" and ") + ": whatever was paid that day, not what this route used, so the route’s fuel and tolls replace it.");
          if (wex > 0.5) notes.push("WEX fill-ups on " + (multi ? "these days" : "this day") + " came to " + money(wex) + ". They are not counted; the route’s fuel is.");

          /* ---- the fuel check: the estimate against what was paid, with the evidence ---- */
          const jf = fuelOf(days);
          const fuelHtml = !fd.some(Boolean) ? "" : '<div class="panel jpl-wrap jpl-fuel"><div class="jpl-eyebrow">Fuel check · not counted in the profit</div>' +
            (jf && jf.state === "over" ? '<p class="jpl-flag">Flagged: ' + money(jf.real) + " paid against an estimate of " + money(jf.est) +
              ", " + signed$(jf.diff) + (jf.pct != null ? " (" + signedPct(jf.pct) + ")" : "") + ". The check flags a job paid at least 30% and at least $10 over its estimate.</p>" : "") +
            days.map((r, i) => {
              const x = fd[i];
              if (!x) return '<p class="jpl-sub">' + (multi ? "Day " + (i + 1) + ": " : "") + "the WEX card data starts " + esc(day(fuelFrom)) + ".</p>";
              const head = (multi ? "<b>Day " + (i + 1) + ", " + esc(day(x.d0)) + ".</b> " : "") +
                "The route’s fuel was estimated at <b>" + money(x.est) + "</b>. " +
                (x.real > 0.5
                  ? "Paid: <b>" + money(x.card) + "</b> on the WEX card" +
                    (x.jobs.length > 1 && x.share != null ? " (" + Math.round(100 * x.share) + "% of the " + money(x.wex) + " the card paid for his day, split by miles)" : "") +
                    (x.sheet > 0.5 ? " + <b>" + money(x.sheet) + "</b> written on the closing sheet" : "") + " = <b>" + money(x.real) + "</b>."
                  : "No fuel was paid for this job: nothing on " + esc(x.who || "the foreman") + "’s card from noon that day to noon the next, and none on the closing sheet.");
              const jobsT = x.jobs.length <= 1 ? "" : '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>' + esc(x.who) + "’s jobs that day</th><th>Customer</th>" +
                '<th class="num">Miles</th><th class="num">WEX card</th><th class="num">Fuel on the sheet</th></tr></thead><tbody>' +
                x.jobs.map(j => "<tr" + (j === r ? ' class="jpl-me"' : "") + "><td>" + esc(j["Job Code"] || "#" + j["Closing #"]) + "</td><td>" + esc(j["Customer"] || "—") + "</td>" +
                  '<td class="num">' + Math.round(num(j["Miles"])) + '</td><td class="num">' + money(j["Card Fuel"]) + '</td><td class="num">' + money(j["Fuel on Sheet"]) + "</td></tr>").join("") +
                "</tbody></table></div>";
              const forLabel = f => f.counts ? '<b class="jpl-pos">this day</b>' : !f.placed ? "not placed: in Fuel Control’s queue"
                : f.trip ? "a long-distance trip" : f.wd < x.d0 ? "the day before" : f.wd > x.d0 ? "the next day" : esc(f.who || "another card") + "’s jobs";
              const fillsT = !x.fills.length
                ? '<p class="jpl-sub">No WEX fill on ' + esc(x.who || "the foreman") + "’s card" + (x.truck ? " or on truck " + esc(x.truck) : "") + " from " + esc(day(x.prev)) + " to " + esc(day(x.next)) + ".</p>"
                : '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>WEX fill</th><th>Card</th><th>Truck</th><th>Station</th><th>Product</th><th class="num">Gallons</th><th class="num">Paid</th><th>Counts for</th></tr></thead><tbody>' +
                  x.fills.map(f => "<tr><td>" + esc(day(f.d)) + " " + esc(f.t.slice(11, 16)) + "</td><td>" + esc(f.who || "—") + "</td><td>" + esc(f.truck ? "#" + f.truck : f.veh || "—") + "</td>" +
                    "<td>" + esc(f.where || "—") + "</td><td>" + esc(f.kind || "—") + '</td><td class="num">' + f.gal.toFixed(1) + '</td><td class="num">' + money(f.cost) + "</td>" +
                    "<td>" + forLabel(f) + "</td></tr>").join("") +
                  "</tbody></table></div>";
              return '<p class="jpl-summary">' + head + "</p>" + jobsT + fillsT;
            }).join("") +
            '<p class="jpl-sub">The same rule as Fuel Control: a fill counts for the day it topped up after, from noon that day to noon the next, so a morning fill ' +
            "belongs to the day before (unless he ran nothing the day before, or the pump’s truck is this day’s). A day of several jobs is split by their miles. " +
            "A swipe by someone with no job of his own reaches the job he drove or helped on, then his card’s truck’s job, then his next day’s. " +
            "His card or the job’s truck the day before and after is listed to judge the rule. Nothing here changes the profit, which uses the route’s estimate.</p>" +
            (days[0] && days[0]._d >= fuelFrom ? '<p class="jpl-sub">' + fuelLink(days[0]) + "</p>" : "") + "</div>";

          /* ---- tiles ---- */
          let avgLine = "", mCls = "";
          if (avg != null && m != null) {
            const d = Math.round(100 * (m - avg));
            mCls = d >= 2 ? "jpl-up" : d <= -2 ? "jpl-down" : "";
            avgLine = esc(typeWord) + "-move average " + Math.round(100 * avg) + "% (" + (d > 0 ? "+" : "") + signed(d) + " pts)";
          }
          const ownedNote = Array.from(new Set(days.filter(r => r["Truck Ownership"] === "Owned").map(r => "truck " + r["Truck"]))).join(", ");
          const codes = days.map(r => r["Job Code"] || "#" + r["Closing #"]).join(" + ");
          const people = Array.from(new Set(days.flatMap(r => [r["Sales Person"], r["Sales Person 2"], r["Sales Person 3"]]).filter(Boolean))).join(", ");
          const eyebrow = [codes, days.map(r => day(r._d)).join(" and "), first["Company"], first["Source"], people].filter(Boolean).map(esc).join(" · ");

          $job.innerHTML =
            '<div class="panel jpl-wrap"><div class="jpl-eyebrow">' + eyebrow + "</div>" +
            '<div class="jpl-title">' + esc(first["Customer"] || "—") +
              (anyContract ? '<span class="jpl-chip jpl-ok">contract</span>' : '<span class="jpl-chip jpl-warn">no contract</span>') +
              (multi ? '<span class="jpl-chip">' + days.length + " days</span>" : "") +
              (first["Moving Type"] ? '<span class="jpl-chip">' + esc(first["Moving Type"]) + (first["State"] ? " · " + esc(first["State"]) : "") + "</span>" : "") +
            "</div>" +
            '<p class="jpl-summary">' + parts.join(" ") + "</p>" + barHtml +
            '<div class="jpl-kpis">' +
              '<div class="jpl-kpi"><div class="k">Billed</div><div class="v">' + money(billed) + '</div><div class="s">' +
                (multi ? days.map((r, i) => "day " + (i + 1) + " " + money(r["Total Bill"])).join(" · ") : "closing sheet") + "</div></div>" +
              '<div class="jpl-kpi jpl-hero"><div class="k">Margin before fixed costs</div><div class="v ' + mCls + '">' + (m == null ? "—" : signed(Math.round(100 * m)) + "%") +
                '</div><div class="s">' + money(kept) + (avgLine ? " · " + avgLine : "") + "</div></div>" +
              '<div class="jpl-kpi"><div class="k">Fixed costs</div><div class="v">' + money(fixed) + '</div><div class="s">' +
                (fixed > 0.5 ? "owned " + esc(ownedNote) : "no owned truck on this job") + "</div></div>" +
              '<div class="jpl-kpi"><div class="k">Ad spend</div><div class="v">' + money(ads) + '</div><div class="s">' +
                esc(ads > 0.5 ? (first["Ad Source"] || "its source") + " · " + monthName(first["Ad Month"]) : (first["Ad Source"] || first["Source"] || "this source") + ": no ad spend") +
                "</div></div>" +
              '<div class="jpl-kpi"><div class="k">Full profit</div><div class="v ' + (full < 0 ? "jpl-down" : "") + '">' + money(full) +
                '</div><div class="s">' + (billed ? share(full) + " of billed" : "nothing billed") + "</div></div>" +
            "</div></div>" +
            '<div class="panel jpl-wrap"><div class="rs-tablewrap"><table class="jpl-ledger"><thead><tr><th></th>' +
              days.map((r, i) => "<th>" + (multi ? "Day " + (i + 1) + " · " : "") + esc(day(r._d)) + "<small>" +
                esc(r["Job Code"] || "#" + r["Closing #"]) + " · closing #" + esc(r["Closing #"]) + "</small></th>").join("") +
              (multi ? "<th>Total<small>all days</small></th>" : "") + "<th>% of bill</th>" +
            "</tr></thead><tbody>" + rowsHtml.join("") + "</tbody></table></div>" +
            (notes.length ? '<ul class="jpl-notes">' + notes.map(n => "<li>" + n + "</li>").join("") + "</ul>" : "") + "</div>" + fuelHtml +
            '<div class="panel jpl-wrap"><details class="jpl-src"><summary>Where the numbers come from</summary><ul>' +
              "<li><b>Billed</b> and every line without a tag come from the closing sheet, the money of record; its total cost is kept exactly. Lines tagged <i>contract</i> are crew pay the sheet counts in its total but has no column for (review bonus, bulky items, hoisting, storage, junk), itemised from the final digital contract.</li>" +
              "<li><b>Money in</b> is the final digital contract’s payment calculation, where the job has one (contracts start October 2025).</li>" +
              "<li>Lines tagged <i>added</i> are costs the closing sheet leaves out, taken from our own records. <b>Rental truck</b>: that month’s spend with the vendor ÷ its truck-days (an unknown vendor uses the average rental); nothing is added when the rent is on the sheet. <b>Refunds</b>: once per request.</li>" +
              "<li>Lines tagged <i>estimated</i> are worked out, not recorded, the way CL Analysis does it. <b>Fuel</b> and <b>tolls</b> cover the whole route and replace the sheet’s own Fuel and Tolls, which hold whatever fill-up or toll fell on that day. Miles: the GPS legs the foreman filed, else the contract’s miles corrected to GPS (×1.263), else the round trip the zip codes imply (×1.632), else the move type’s average. Fuel = miles ÷ 7 mpg × our WEX diesel price; tolls = miles × our toll accounts’ cost per mile (E-ZPass on every mile, the rental-toll rebills on rented trucks, the PA Turnpike and New York accounts on routes that go there). <b>Packing material cost</b>: 15% of packing sold. <b>Card processing fee</b>: 3.5% of what was paid by card.</li>" +
              "<li><b>Ad spend</b> comes last, below the fixed costs: what the job’s source spent on ads in the job’s month ÷ the jobs it brought that month (a delivery day is not a second job). A month the bank files have not finished yet uses the latest complete month. A referral, a returning customer or a CL job has no ad spend.</li>" +
              "<li><b>Fixed costs</b> are the owned truck’s share: that month’s fleet insurance, parking, maintenance and loan payments ÷ the days owned trucks worked, split between the jobs it did that day. Everything above them rises and falls with the job.</li>" +
              "<li>The <b>average</b> is the same move type’s margin before fixed costs over the last 12 months.</li>" +
            "</ul></details></div>";
        }

        let qTimer = null;
        $q.addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => { V.q = $q.value; V.page = 0; paintAll(); }, 160); });
        host.querySelectorAll("[data-per]").forEach(b => b.addEventListener("click", () => { V.period = b.dataset.per; V.page = 0; paintAll(); }));
        $("jplFrom").addEventListener("change", e => { V.from = e.target.value; V.page = 0; paintAll(); });
        $("jplTo").addEventListener("change", e => { V.to = e.target.value; V.page = 0; paintAll(); });
        $("jplCo").addEventListener("change", e => { V.company = e.target.value; V.page = 0; paintAll(); });
        $("jplBar").addEventListener("change", e => { const f = e.target.dataset.f; if (!f) return; V[f] = e.target.value; V.page = 0; paintAll(); });
        $("jplLoss").addEventListener("click", () => { V.band = V.band === "loss" ? "" : "loss"; V.page = 0; paintAll(); });
        const reset = () => { Object.assign(V, { company: "", q: "", type: "", state: "", foreman: "", sales: "", source: "", band: "", fuel: "", page: 0 }); $q.value = ""; paintAll(); };
        $("jplReset").addEventListener("click", reset);
        $("jplTable").addEventListener("click", e => {
          const s0 = e.target.closest("[data-sort]"), pg = e.target.closest("[data-page]"), tr = e.target.closest("tr[data-key]");
          if (e.target.closest("[data-reset]")) { reset(); return; }
          if (s0) { const k = s0.dataset.sort; if (V.sort === k) V.dir = -V.dir; else { V.sort = k; V.dir = k === "d" || k === "bill" || k === "full" || k === "m" ? -1 : 1; } V.page = 0; paintAll(true); return; }
          if (pg && !pg.disabled) { V.page = +pg.dataset.page; paintAll(true); host.querySelector(".jpl-list").scrollIntoView({ block: "start", behavior: "smooth" }); return; }
          if (tr) open(tr.dataset.key);
        });
        $("jplTable").addEventListener("keydown", e => { const tr = e.target.closest("tr[data-key]"); if (tr && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(tr.dataset.key); } });
        $("jplClose").addEventListener("click", close);
        $scrim.addEventListener("click", close);
        // Escape closes the panel; the listener lets go once the page is replaced
        const onKey = e => { if (!$drawer.isConnected) { document.removeEventListener("keydown", onKey); return; } if (e.key === "Escape") close(); };
        document.addEventListener("keydown", onKey);
        // a pasted link to another job while the page is open: the shell keeps the page (same
        // page=), so the page follows the job= itself; it lets go once its view is replaced
        const onHash = () => {
          if (!$job.isConnected) { window.removeEventListener("hashchange", onHash); return; }
          const key = resolveJob(hashJob());
          if (key && key !== sel) open(key); else if (!key) close();
        };
        window.addEventListener("hashchange", onHash);
        paintAll();
        if (sel) open(sel);
      });
    },
  });
})();
