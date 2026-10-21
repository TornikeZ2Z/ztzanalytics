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
    .jpl-title{font-size:22px;font-weight:700;margin:2px 0 4px}
    .jpl-sub{color:var(--muted);font-size:13px;line-height:1.6}
    .jpl-sub b{color:var(--ink);font-weight:600}
    .jpl-chip{display:inline-block;font-size:11px;font-weight:700;padding:1px 8px;border-radius:99px;margin-left:6px;
      background:var(--panel-2);color:var(--muted);border:1px solid var(--line)}
    .jpl-chip.jpl-ok{color:var(--pos)} .jpl-chip.jpl-warn{color:var(--warn)}
    .jpl-ledger{width:100%;min-width:620px;max-width:1040px;border-collapse:collapse;font-size:14px;font-variant-numeric:tabular-nums}
    .jpl-ledger th,.jpl-ledger td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:right;white-space:nowrap}
    .jpl-ledger th:first-child,.jpl-ledger td:first-child{text-align:left;white-space:normal}
    .jpl-ledger thead th{font-size:12px;color:var(--muted);font-weight:700;vertical-align:bottom;border-bottom:2px solid var(--line)}
    .jpl-ledger thead th small{display:block;font-weight:500}
    .jpl-ledger td small{color:var(--muted);font-size:12px}
    .jpl-ledger tr.jpl-sec td{font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
      color:var(--muted);padding-top:16px;border-bottom:0}
    .jpl-ledger tr.jpl-tot td{font-weight:700;border-top:1px solid var(--ink);border-bottom:0}
    .jpl-ledger tr.jpl-profit td{font-size:17px;font-weight:800;border-bottom:0}
    .jpl-ledger tr.jpl-muted td{color:var(--muted);font-size:12.5px}
    .jpl-pos{color:var(--pos)} .jpl-neg{color:var(--neg)}
    .jpl-notes{margin:10px 0 0;padding-left:18px;display:flex;flex-direction:column;gap:5px;font-size:13px;color:var(--muted);line-height:1.55}
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

        function paintJob() {
          const days = sel ? byKey.get(sel) : null;
          if (!days || !days.length) { $job.innerHTML = ""; return; }
          const first = days[0], multi = days.length > 1;
          const colHead = (r, i) => (multi ? (i === 0 ? "Day 1" : "Day " + (i + 1)) + " · " : "") + esc(day(r._d)) +
            "<small>" + esc(r["Job Code"] || "#" + r["Closing #"]) + " · closing #" + esc(r["Closing #"]) + "</small>";
          const sum = (f) => days.reduce((a, r) => a + num(f(r)), 0);
          const rowsHtml = [];
          const cell = v => '<td>' + (v == null ? "—" : money(v)) + "</td>";
          const line = (label, f, opts) => {
            opts = opts || {};
            const vals = days.map(f).map(num);
            if (!opts.always && vals.every(v => Math.abs(v) < 0.5)) return;
            const note = opts.note ? " <small>" + opts.note + "</small>" : "";
            rowsHtml.push('<tr class="' + (opts.cls || "") + '"><td>' + label + note + "</td>" + vals.map(v => cell(v)).join("") +
              (multi ? cell(vals.reduce((a, b) => a + b, 0)) : "") + "</tr>");
          };
          const sec = t => rowsHtml.push('<tr class="jpl-sec"><td colspan="' + (days.length + (multi ? 2 : 1)) + '">' + t + "</td></tr>");

          /* ---- money in ---- */
          sec("Money in");
          const contractLines = r => num(r["Labor Charge"]) + num(r["Packing Charged"]) + num(r["Stairs Fee"]) + num(r["Bulky Fee"]) +
            num(r["Hoisting Fee"]) + num(r["Overnight Fee"]) + num(r["Storage Fee"]) + num(r["Other Charges"]) - num(r["Contract Discounts"]);
          const anyContract = days.some(r => num(r["Has Contract"]) === 1);
          if (anyContract) {
            line("Labor", r => r["Labor Charge"]);
            line("Packing materials", r => r["Packing Charged"]);
            line("Stairs fee", r => r["Stairs Fee"]);
            line("Bulky items fee", r => r["Bulky Fee"]);
            line("Hoisting", r => r["Hoisting Fee"]);
            line("Overnight", r => r["Overnight Fee"]);
            line("Storage", r => r["Storage Fee"]);
            line("Other charges", r => r["Other Charges"], { note: "service, waiting time, long carry, floor, junk" });
            line("Discounts", r => -num(r["Contract Discounts"]));
            line("Billed without a contract", r => num(r["Has Contract"]) === 1 ? 0 : num(r["Total Bill"]));
            line("Closing sheet differs from the contract by", r => num(r["Has Contract"]) === 1 ? num(r["Total Bill"]) - contractLines(r) : 0,
                 { cls: "jpl-muted" });
          }
          line("Billed", r => r["Total Bill"], { cls: "jpl-tot", always: true });

          /* ---- the closing sheet's costs ---- */
          sec("Costs on the closing sheet");
          const sp = days.map(r => [r["Sales Person"], r["Sales Person 2"], r["Sales Person 3"]].filter(Boolean)).flat();
          const spNames = Array.from(new Set(sp)).join(", ");
          line("Sales commission", r => r["Sales Commission"], { note: spNames ? esc(spNames) : "" });
          line("Foreman, hourly", r => num(r["Foreman Pay"]) - num(r["Foreman Packing Commission"]),
               { note: esc(Array.from(new Set(days.map(r => r["Foreman"]).filter(Boolean))).join(", ")) });
          line("Foreman, packing commission", r => r["Foreman Packing Commission"]);
          line("Driver", r => r["Driver Pay"]);
          line("Helpers", r => r["Helpers Pay"]);
          line("Crew review bonus", r => r["Crew Review Pay"]);
          line("Crew bulky items pay", r => r["Crew Bulky Pay"]);
          line("Crew hoisting, storage and junk pay", r => r["Crew Other Extras"]);
          line("Company-paid tip", r => r["Company Tip"]);
          line("Crew car", r => r["Car"]);
          line("Fuel paid by the crew", r => r["Fuel on Sheet"]);
          line("Tolls", r => r["Tolls"]);
          line("Truck rent", r => r["Truck Rent on Sheet"]);
          line("Hotel", r => r["Hotel"]);
          line("Other expenses", r => r["Other Expenses"]);
          line("Other on the closing sheet", r => r["Sheet Other"], { note: "in the sheet’s total, not in a column of its own" });
          line("Closing sheet costs", r => r["Sheet Total Expense"], { cls: "jpl-tot", always: true });

          /* ---- what the sheet leaves out ---- */
          sec("Costs the closing sheet leaves out");
          const truckNote = r => {
            const o = r["Truck Ownership"], rate = num(r["Truck Day Rate"]), share = num(r["Truck Day Jobs"]);
            if (o === "Owned") return "owned truck " + esc(r["Truck"]) + (rate ? ", " + money(rate) + " a day" : "") + (share > 1 ? ", shared by " + share + " jobs" : "");
            if (o === "Rental") return esc(r["Truck Vendor"] === "Unit #" || r["Truck Vendor"] === "Unlabeled" ? "rental" : r["Truck Vendor"] + " rental") +
              (rate ? ", " + money(rate) + " a day" : "") + (share > 1 ? ", shared by " + share + " jobs" : "");
            return "";
          };
          const tn = Array.from(new Set(days.map(truckNote).filter(Boolean))).join(" · ");
          line("Truck", r => r["Truck Cost"], { note: tn });
          line("Card fuel (WEX)", r => r["Card Fuel"]);
          line("Packing material cost", r => r["Packing Cost"], { note: "15% of packing sold" });
          line("Refunds", r => r["Refunds"]);
          line("Added costs", r => r["Added Costs"], { cls: "jpl-tot", always: true });

          /* ---- profit ---- */
          sec("What was left");
          const pcell = v => '<td class="' + (v < 0 ? "jpl-neg" : "jpl-pos") + '">' + money(v) + "</td>";
          const prof = (label, f, cls) => {
            const vals = days.map(f).map(num);
            rowsHtml.push('<tr class="' + cls + '"><td>' + label + "</td>" + vals.map(pcell).join("") + (multi ? pcell(vals.reduce((a, b) => a + b, 0)) : "") + "</tr>");
          };
          prof("Profit on the closing sheet", r => r["Sheet Profit"], "jpl-tot");
          prof("Full profit", r => r["Full Profit"], "jpl-profit");
          rowsHtml.push('<tr class="jpl-muted"><td>Full profit margin</td>' + days.map(r => "<td>" + pct(num(r["Full Profit"]), num(r["Total Bill"])) + "</td>").join("") +
            (multi ? "<td>" + pct(sum(r => r["Full Profit"]), sum(r => r["Total Bill"])) + "</td>" : "") + "</tr>");

          /* ---- tiles, notes ---- */
          const billed = sum(r => r["Total Bill"]), full = sum(r => r["Full Profit"]), sheetP = sum(r => r["Sheet Profit"]);
          const added = sum(r => r["Added Costs"]), balance = sum(r => r["Balance Due"]), tip = sum(r => r["Customer Tip"]);
          const claims = sum(r => r["Claims Filed"]);
          const notes = [];
          if (tip > 0) notes.push("The customer’s <b>" + money(tip) + "</b> tip went to the crew and is in neither money in nor costs.");
          if (balance > 0.5) notes.push("<b>" + money(balance) + "</b> was still due on the closing sheet.");
          if (claims > 0) notes.push("<b>" + claims + "</b> claim" + (claims > 1 ? "s were" : " was") + " filed on this job. Claims carry no dollar amount; any refund paid is in Refunds.");
          days.forEach((r, i) => {
            if (num(r["Total Bill"]) <= 0) notes.push((multi ? "Day " + (i + 1) + " (" + esc(r["Job Code"]) + ")" : "This job") + " has no bill on its closing sheet.");
            if (num(r["Has Contract"]) !== 1) notes.push((multi ? "Day " + (i + 1) : "This job") + " has no final digital contract, so its bill is shown as one line.");
          });
          if (days.some(r => r["Truck Ownership"] === "Rental" && num(r["Truck Rent on Sheet"]) > 0))
            notes.push("The rental truck’s rent is on the closing sheet, so nothing is added for it.");
          const cust = first["Customer"] || "—";
          const codes = days.map(r => r["Job Code"] || "#" + r["Closing #"]).join(" + ");
          const meta = [first["Company"], first["Moving Type"], first["State"], first["Source"] ? "source " + first["Source"] : ""]
            .filter(Boolean).map(esc).join(" · ");

          $job.innerHTML =
            '<div class="panel"><div class="jpl-eyebrow">' + esc(codes) + "</div>" +
            '<div class="jpl-title">' + esc(cust) + (anyContract ? '<span class="jpl-chip jpl-ok">contract</span>' : '<span class="jpl-chip jpl-warn">no contract</span>') +
            (multi ? '<span class="jpl-chip">' + days.length + " days</span>" : "") + "</div>" +
            '<div class="jpl-sub">' + days.map(r => esc(day(r._d))).join(" and ") + (meta ? " · " + meta : "") + "</div>" +
            '<div class="rs-kpis" style="margin-top:14px">' +
              '<div class="kpi"><div class="k">Billed</div><div class="v">' + money(billed) + '</div><div class="s">' + (multi ? days.length + " days" : "closing sheet") + "</div></div>" +
              '<div class="kpi"><div class="k">Full profit</div><div class="v ' + (full < 0 ? "jpl-neg" : "jpl-pos") + '">' + money(full) + '</div><div class="s">' + pct(full, billed) + " of billed</div></div>" +
              '<div class="kpi"><div class="k">Profit on the closing sheet</div><div class="v">' + money(sheetP) + '</div><div class="s">before the costs it leaves out</div></div>' +
              '<div class="kpi"><div class="k">Costs the sheet leaves out</div><div class="v">' + money(added) + '</div><div class="s">truck, card fuel, packing, refunds</div></div>' +
            "</div></div>" +
            '<div class="panel"><div class="rs-tablewrap"><table class="jpl-ledger"><thead><tr><th></th>' +
              days.map((r, i) => "<th>" + colHead(r, i) + "</th>").join("") + (multi ? "<th>Total<small>both days</small></th>" : "") +
            "</tr></thead><tbody>" + rowsHtml.join("") + "</tbody></table></div>" +
            (notes.length ? '<ul class="jpl-notes">' + notes.map(n => "<li>" + n + "</li>").join("") + "</ul>" : "") + "</div>" +
            '<div class="panel"><details class="jpl-src"><summary>Where the numbers come from</summary><ul>' +
              "<li><b>Billed and the closing sheet costs</b> come from the closing sheet, the money of record. Its total is kept exactly. The contract itemises the pay the sheet has no column for (review bonus, bulky items, hoisting, storage, junk); anything else in its total is “Other on the closing sheet”.</li>" +
              "<li><b>Money in</b> is the final digital contract’s payment calculation, where the job has one (contracts start October 2025).</li>" +
              "<li><b>Truck</b>: an owned truck costs that month’s fleet insurance, parking, maintenance and loan payments ÷ the days owned trucks worked; a rental costs that month’s spend with that vendor ÷ its truck-days (an unknown vendor uses the average rental). A truck that did two jobs that day is split between them. A rental whose rent is on the closing sheet gets nothing more.</li>" +
              "<li><b>Card fuel</b> is the WEX charges Fuel Control matched to this job (from mid-July 2026; fuel on a long-distance trip is matched to the trip, not a job). Fuel the crew paid is on the closing sheet.</li>" +
              "<li><b>Packing material cost</b> is 15% of the packing materials sold. <b>Refunds</b> come from the refunds sheet, once per request.</li>" +
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
