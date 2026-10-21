/* JOB P&L -- one job's full cost breakdown (Company Overview).
 *
 * His ask (2026-10-21), after the two-day Aaron Greene breakdown he sent to Giga: "i need now to
 * create it as a functionality in company overview. i need user to be able to select a job and
 * see full costs breakdown. in the same style we just did." His picks: a linked second day
 * (pickup LM21-0220, delivery LM21-02200) shows side by side with a combined total; the page adds
 * the costs the closing sheet leaves out -- truck, WEX card fuel, packing cost at 15%, refunds and
 * claims; anyone who opens Company Overview opens this.
 *
 * Everything is computed in the warehouse (src/job_pnl.py -> mart_job_pnl, one row per closing).
 * This page only finds a job, lays its days side by side and says where every line comes from.
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
             "Packing Cost", "Refunds", "Claims Filed", "Added Costs", "Full Profit"],
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
    .jpl-search{display:flex;gap:10px;align-items:center;flex-wrap:wrap;max-width:1040px}
    .jpl-hits{max-width:1040px}
    .jpl-search .rs-inp{flex:1 1 320px;min-width:0}
    .jpl-hits{margin-top:10px;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;overflow:hidden}
    .jpl-hit{display:grid;grid-template-columns:92px 120px minmax(0,1fr) minmax(0,160px) 96px 96px;gap:10px;
      align-items:center;padding:8px 12px;background:var(--panel);border:0;border-top:1px solid var(--line);
      text-align:left;font:inherit;color:var(--ink);cursor:pointer;font-variant-numeric:tabular-nums}
    .jpl-hit:first-child{border-top:0}
    .jpl-hit:hover,.jpl-hit:focus-visible{background:var(--panel-2);outline:none}
    .jpl-hit .r{text-align:right}
    .jpl-hit small{color:var(--muted)}
    .jpl-hit.jpl-head{cursor:default;font-size:12px;color:var(--muted);background:var(--panel-2)}
    @media (max-width:760px){.jpl-hit{grid-template-columns:84px minmax(0,1fr) 90px}
      .jpl-hit .jpl-c2,.jpl-hit .jpl-c4,.jpl-hit .jpl-c5{display:none}}
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
    .jpl-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:16px}
    .jpl-kpi{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:12px 14px;min-width:0}
    .jpl-kpi .k{font-size:12px;color:var(--muted);font-weight:600}
    .jpl-kpi .v{font-size:26px;font-weight:800;margin:3px 0 2px;font-variant-numeric:tabular-nums}
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
    group: "company",
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

      return RS.load("job_pnl").then(rows => {
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
        const beforeFixed = r => num(r["Full Profit"]) + fixedOf(r);
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

        const hashJob = () => { const m = /[#&]job=([^&]+)/.exec(location.hash || ""); return m ? decodeURIComponent(m[1]) : ""; };
        let sel = hashJob();
        if (sel && !byKey.has(sel)) {
          // a link may carry a bare job code or closing number: find its job
          const hit = rows.find(r => r["Job Code"] === sel || String(r["Closing #"]) === sel);
          sel = hit ? hit["Job Key"] : "";
        }
        let query = "";

        host.innerHTML =
          '<div class="rs-page-head"><div class="jpl-eyebrow">Company Overview</div><h1>Job P&L</h1>' +
          '<p class="jpl-sub">Pick a job to see what it billed, every cost on its closing sheet, the costs the ' +
          'sheet leaves out (truck, card fuel, packing, refunds) and what was left. A delivery day opens with its pickup.</p></div>' +
          '<div class="panel"><div class="jpl-search"><input id="jplQ" class="rs-inp" type="search" autocomplete="off" ' +
          'placeholder="Job code, customer or closing #" aria-label="Find a job"></div><div id="jplHits"></div></div>' +
          '<div id="jplJob"></div>';
        const $q = host.querySelector("#jplQ"), $hits = host.querySelector("#jplHits"), $job = host.querySelector("#jplJob");

        function hitsHtml(list, label) {
          if (!list.length) return '<div class="jpl-empty">No job matches “' + esc(query) + '”.</div>';
          return '<div class="jpl-hits" role="list"><div class="jpl-hit jpl-head"><span>' + esc(label) + '</span>' +
            '<span class="jpl-c2">Job code</span><span>Customer</span><span class="jpl-c4">Foreman</span>' +
            '<span class="r jpl-c5">Billed</span><span class="r">Full profit</span></div>' +
            list.map(r => '<button type="button" class="jpl-hit" role="listitem" data-key="' + esc(r["Job Key"]) + '">' +
              "<span>" + esc(day(r._d)) + "</span>" +
              '<span class="jpl-c2">' + esc(r["Job Code"] || "#" + r["Closing #"]) + "</span>" +
              "<span>" + esc(r["Customer"] || "—") + (r["Company"] && r["Company"] !== "Zip to Zip" ? " <small>· " + esc(r["Company"]) + "</small>" : "") + "</span>" +
              '<span class="jpl-c4"><small>' + esc(r["Foreman"] || "—") + "</small></span>" +
              '<span class="r jpl-c5">' + money(r["Total Bill"]) + "</span>" +
              '<span class="r ' + (num(r["Full Profit"]) < 0 ? "jpl-neg" : "") + '">' + money(r["Full Profit"]) + "</span></button>").join("") +
            "</div>";
        }

        function paintHits() {
          const q = query.trim().toLowerCase();
          if (!q) { $hits.innerHTML = sel ? "" : hitsHtml(latest.slice(0, 12), "Latest jobs"); return; }
          const terms = q.split(/\s+/);
          const out = [];
          for (const r of latest) {
            const hay = (String(r["Job Code"] || "") + " " + (r["Customer"] || "") + " #" + r["Closing #"] + " " +
                         r["Closing #"] + " " + (r["Foreman"] || "")).toLowerCase();
            if (terms.every(t => hay.includes(t))) { out.push(r); if (out.length >= 15) break; }
          }
          $hits.innerHTML = hitsHtml(out, "Matches");
        }

        function select(key) {
          sel = key; query = ""; $q.value = "";
          try { history.replaceState(null, "", "#page=job-pnl&job=" + encodeURIComponent(key)); } catch (e) { /* ignore */ }
          paintHits(); paintJob();
          $job.scrollIntoView({ block: "start", behavior: "smooth" });
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
          { id: "truck", label: "Truck and fuel", color: "#eda100", lines: [
            ["Rental truck", r => r["Truck Ownership"] === "Rental" ? r["Truck Cost"] : 0, "added", r => r["Truck Ownership"] === "Rental" ? truckNote(r) : ""],
            ["Truck rent", r => r["Truck Rent on Sheet"], ""],
            ["Fuel paid by the crew", r => r["Fuel on Sheet"], ""],
            ["Card fuel (WEX)", r => r["Card Fuel"], "added"],
            ["Tolls", r => r["Tolls"], ""],
            ["Crew car", r => r["Car"], ""]] },
          { id: "other", label: "Packing and other", color: "#e87ba4", lines: [
            ["Packing material cost", r => r["Packing Cost"], "added", () => "15% of packing sold"],
            ["Hotel", r => r["Hotel"], ""],
            ["Other expenses", r => r["Other Expenses"], ""],
            ["Other on the closing sheet", r => r["Sheet Other"], "", () => "in the sheet’s total, not in a column of its own"],
            ["Refunds", r => r["Refunds"], "added"]] },
        ];
        const FIXED_COLOR = "#898781";
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
          const fixed = sum(fixedOf), kept = sum(beforeFixed), full = sum(r => r["Full Profit"]);
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
            parts.push("After crew, commission and job costs, <b>" + money(kept) + " (" + share(kept) + ")</b> was left before fixed costs" + cmp + ".");
            const big = GROUPS.map((g, i) => [g.label, gTot[i]]).sort((x, y) => y[1] - x[1])[0];
            if (big && big[1] > 0) parts.push("The biggest cost was " + esc(big[0].toLowerCase()) + ", " + share(big[1]) + " of the bill.");
            if (fixed > 0.5) parts.push("The owned truck’s fixed share (" + money(fixed) + ") leaves a full profit of <b>" + money(full) + "</b>.");
          }
          const refunds = sum(r => r["Refunds"]);
          if (refunds > 0.5) parts.push("A " + money(refunds) + " refund was paid.");

          /* ---- where each billed dollar went ---- */
          let barHtml = "";
          if (billed > 0) {
            const segs = GROUPS.map((g, i) => [g.label, gTot[i], g.color]).concat([["Fixed costs", fixed, FIXED_COLOR]]);
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
              const label = esc(ln[0]) + (ln[2] ? '<span class="jpl-tag">' + ln[2] + "</span>" : "") + (who ? " <small>" + esc(who) + "</small>" : "");
              pushRow("jpl-item", label, ln[1]);
            });
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
              '<div class="jpl-kpi"><div class="k">Full profit</div><div class="v ' + (full < 0 ? "jpl-down" : "") + '">' + money(full) +
                '</div><div class="s">' + (billed ? share(full) + " of billed" : "nothing billed") + "</div></div>" +
            "</div></div>" +
            '<div class="panel jpl-wrap"><div class="rs-tablewrap"><table class="jpl-ledger"><thead><tr><th></th>' +
              days.map((r, i) => "<th>" + (multi ? "Day " + (i + 1) + " · " : "") + esc(day(r._d)) + "<small>" +
                esc(r["Job Code"] || "#" + r["Closing #"]) + " · closing #" + esc(r["Closing #"]) + "</small></th>").join("") +
              (multi ? "<th>Total<small>all days</small></th>" : "") + "<th>% of bill</th>" +
            "</tr></thead><tbody>" + rowsHtml.join("") + "</tbody></table></div>" +
            (notes.length ? '<ul class="jpl-notes">' + notes.map(n => "<li>" + n + "</li>").join("") + "</ul>" : "") + "</div>" +
            '<div class="panel jpl-wrap"><details class="jpl-src"><summary>Where the numbers come from</summary><ul>' +
              "<li><b>Billed</b> and every line without a tag come from the closing sheet, the money of record; its total cost is kept exactly. Lines tagged <i>contract</i> are crew pay the sheet counts in its total but has no column for (review bonus, bulky items, hoisting, storage, junk), itemised from the final digital contract.</li>" +
              "<li><b>Money in</b> is the final digital contract’s payment calculation, where the job has one (contracts start October 2025).</li>" +
              "<li>Lines tagged <i>added</i> are costs the closing sheet leaves out. <b>Rental truck</b>: that month’s spend with the vendor ÷ its truck-days (an unknown vendor uses the average rental); nothing is added when the rent is on the sheet. <b>Card fuel</b>: WEX charges Fuel Control matched to the job (from mid-July 2026; trip fuel is matched to the trip). <b>Packing material cost</b>: 15% of packing sold. <b>Refunds</b>: once per request.</li>" +
              "<li><b>Fixed costs</b> are the owned truck’s share: that month’s fleet insurance, parking, maintenance and loan payments ÷ the days owned trucks worked, split between the jobs it did that day. Everything above them rises and falls with the job.</li>" +
              "<li>The <b>average</b> is the same move type’s margin before fixed costs over the last 12 months.</li>" +
            "</ul></details></div>";
        }

        $q.addEventListener("input", () => { query = $q.value; paintHits(); });
        $hits.addEventListener("click", e => { const b = e.target.closest("[data-key]"); if (b) select(b.getAttribute("data-key")); });
        paintHits();
        paintJob();
      });
    },
  });
})();
