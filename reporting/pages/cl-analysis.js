/* FINANCIAL page: CL Analysis — the jobs our CL partner brings us.
 *
 * His ask (2026-08-25): every detail about the jobs where the sales person is Peter and the
 * source is CL. CL is a partner who brings the work and takes the deposit as his cut.
 *
 * THE ONE THING TO UNDERSTAND BEFORE READING ANY NUMBER HERE, and it is his ruling: HIS CUT IS
 * ALREADY PAID AS HIS SALES SALARY. The deposit and `Sales 1 Salary` are the same money written
 * down twice — checked across every job on the page and they agree to the cent — and the salary
 * is already inside `Total Expense`. So `Profit per Job` is ALREADY NET of what he takes.
 * Subtracting the deposit again would take it off twice and understate these jobs by the whole
 * of his cut. The page therefore reports profit as it stands and never nets it a second time.
 *
 * TWO IDENTITIES THAT COINCIDE, AND ARE STILL CHECKED SEPARATELY. Every CL job is Peter's and
 * every one of Peter's jobs is CL — today the two filters select exactly the same rows. They
 * are kept as two conditions anyway, and the page says so when they stop agreeing.
 *
 * "CL" IS NOT "Craiglist". The warehouse carries a separate `Craiglist` source belonging to
 * other salespeople entirely.
 *
 * SEARCH AND THE FOREMAN FILTER (his ask 2026-08-27) ARE PAGE-LOCAL AND FILTER EVERYTHING —
 * tiles, trend, checks and tables all recompute over the filtered set, so "his jobs with
 * foreman X" is the whole page about foreman X, not one table. The global Source and Sales
 * slicers stay deliberately fixed (this page IS one source and one salesperson); Foreman
 * lives here instead so the control sits next to the tables it drives.
 */
// The economics mart: the fee rules, the uplift, refunds and claims, computed once in
// the warehouse (src/curated.py::mart_cl_analysis) so the page never re-derives money.
// PAYLOAD CONTRACT: a column missing from this list never arrives, however well the
// page is written.
if (window.RS && RS.DATASETS && !RS.DATASETS.mart_cl_analysis) {
  RS.DATASETS.mart_cl_analysis = {
    table: "mart_cl_analysis",
    cols: ["Unique Key", "Date", "Job No", "Request #", "Customer", "Foreman",
           "Total Bill", "His Cut", "Profit per Job",
           "Stairs Fee", "Bulky Fee", "Storage Monthly", "Storage Past Month 1",
           "Commissionable Bill", "Our Price", "Standard Pay",
           "Over Cap", "Over Cap $",
           "Refund $", "Refund Reason", "Claims", "Claim Status", "Claim Reason",
           "Extra Spend", "Other Expenses", "Company Tip", "Discount Given",
           "Has Contract"],
    dateCols: { "Date": "Date" }, defaultDate: "Date",
  };
}

registerPage({
  id: "cl-analysis",
  group: "financial",
  title: "CL Analysis",
  async render(host) {
    const num = RS.num, money = RS.money, fmtN = RS.fmtN;
    const money0 = v => (v == null || isNaN(v)) ? "—" : money(v, 0);
    const pctS = (v) => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(1) + "%";
    const esc = RS.esc || (s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

    // Panels, tables, pills and KPI tiles are THE COMPONENT KIT. Only the assumption strip,
    // the local filter bar and the totals row are page-specific — plus the KPI colour
    // classes, which the kit does NOT define.
    if (!document.getElementById("cla-style")) {
      const st = document.createElement("style");
      st.id = "cla-style";
      st.textContent = [
        ".rs-kpis .kpi.warn .v{color:var(--warn)}",
        ".rs-kpis .kpi.pos .v{color:var(--pos)}",
        ".rs-kpis .kpi.neg .v{color:var(--neg)}",
        ".cla-checks{display:flex;flex-direction:column;gap:7px;margin-top:4px}",
        ".cla-chk{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.5}",
        ".cla-chk span{flex:0 0 18px;height:18px;border-radius:999px;display:grid;"
          + "place-items:center;font-size:11px;font-weight:800;margin-top:1px}",
        ".cla-chk.ok span{background:var(--pos-bg);color:var(--pos)}",
        ".cla-chk.ok div{color:var(--muted)}",
        ".cla-chk.bad span{background:var(--warn-bg);color:var(--warn)}",
        ".cla-chk.bad div{color:var(--ink);font-weight:650}",
        ".cla-over{color:var(--neg)!important;font-weight:800}",
        ".cla-of{color:var(--faint);font-weight:400;font-size:11px}",
        ".cla-foot{display:flex;align-items:center;gap:12px;padding:9px 2px 2px;"
          + "font-size:12px;color:var(--muted)}",
        ".cla-foot .rs-btn{padding:4px 10px;font-size:12px}",
        ".cla-foot > button[data-all]{margin-left:auto}",
        ".cla-pg{display:inline-flex;align-items:center;gap:8px}",
        ".cla-pg b{font-weight:700;color:var(--ink);min-width:52px;text-align:center}",
        // the local filter bar
        ".cla-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}",
        ".cla-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;"
          + "transition:border-color .15s}",
        ".cla-in:focus{border-color:var(--brand)}",
        ".cla-count{font-size:12px;color:var(--faint);font-weight:600}",
        // THE TOTALS ROW LIVES IN A TFOOT, so pagination (which rewrites the tbody alone)
        // can never page it away — the sum is always in sight under whatever page is open.
        ".rs-table tfoot td{font-weight:800;border-top:2px solid var(--line-2);"
          + "color:var(--ink)}",
        ".rs-table tfoot .cla-of{font-weight:400}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>CL Analysis</h1></div>
      <div class="rs-loading" style="padding:22px">Reading the closings…</div>`;

    const all = await RS.load("closing");
    const rows = RS.filtered("closing", all).filter(r => r["Record Source"] === "closing");

    // The economics mart, keyed by Unique Key so every job on this page can look up its
    // own fee rules, refund and claim. If the mart has not been built yet the page still
    // renders -- the new panels simply say so rather than showing wrong money.
    let econ = {};
    let econReady = false;
    try {
      const em = await RS.load("mart_cl_analysis");
      (em || []).forEach(r => { if (r["Unique Key"]) econ[r["Unique Key"]] = r; });
      econReady = Object.keys(econ).length > 0;
    } catch (e) { econReady = false; }
    const E = r => econ[r["Unique Key"]] || null;

    const isCL = r => String(r["Source"] || "").trim().toUpperCase() === "CL";
    const isPeter = r => /peter/i.test(String(r["Sales Person"] || ""));
    const baseJobs = rows.filter(r => isCL(r) || isPeter(r));

    if (!baseJobs.length) {
      host.innerHTML = `<div class="rs-page-head"><h1>CL Analysis</h1></div>
        <div class="panel">No CL jobs in the current date and company filter.</div>`;
      return;
    }

    const CAP = 0.30;
    const cut = r => num(r["Sales 1 Salary"]) || 0;
    const dep = r => num(r["Deposit"]) || 0;
    const cutPct = r => {
      const b = num(r["Total Bill"]) || 0;
      return b > 0 ? cut(r) / b : null;
    };
    const overBy = r => {
      const b = num(r["Total Bill"]) || 0;
      return b > 0 ? Math.max(0, cut(r) - CAP * b) : 0;
    };

    const foremen = [...new Set(baseJobs.map(r => String(r["Foreman"] || "").trim())
      .filter(Boolean))].sort();

    // page-local state; paint() recomputes the whole page over the filtered set
    const S = { q: "", fm: "" };
    let qTimer = null;

    paint();

    function filteredJobs() {
      const q = S.q.toLowerCase();
      return baseJobs.filter(r => {
        if (S.fm && String(r["Foreman"] || "").trim() !== S.fm) return false;
        if (!q) return true;
        return [r["Job No"], r["Request #"], r["Customer"], r["Foreman"],
                r["State Name"] || r["State"], r["Size of Move"],
                r["Move Type"] || r["Moving Type"], String(r["Date"] || "").slice(0, 10)]
          .some(v => String(v || "").toLowerCase().includes(q));
      });
    }

    function paint() {
      const jobs = filteredJobs();
      const filtered = S.q || S.fm;

      const clOnly = jobs.filter(r => isCL(r) && !isPeter(r));
      const peterOnly = jobs.filter(r => isPeter(r) && !isCL(r));
      const mismatch = jobs.filter(r => Math.abs(cut(r) - dep(r)) > 1);
      const overCap = jobs.filter(r => (cutPct(r) || 0) > CAP);

      const sum = (f) => jobs.reduce((a, r) => a + (f(r) || 0), 0);
      const revenue = sum(r => num(r["Total Bill"]) + (num(r["Extra Bill From Trips"]) || 0));
      const billed = sum(r => num(r["Total Bill"]));
      const hisCut = sum(cut);
      const profit = sum(r => num(r["Profit per Job"]));
      const overPaid = sum(overBy);
      const avgProfit = jobs.length ? profit / jobs.length : null;
      // WHAT ELSE THESE JOBS COST US, and what he would earn on our own rules.
      // Every number here comes from the mart, never re-derived in the page.
      const eSum = f => jobs.reduce((a, r) => { const e = E(r); return a + (e ? (num(f(e)) || 0) : 0); }, 0);
      const refunds = eSum(e => e["Refund $"]);
      const claimsN = eSum(e => e["Claims"]);
      const extraSpend = eSum(e => e["Extra Spend"]);
      const stdPay = eSum(e => e["Standard Pay"]);
      const ourPrice = eSum(e => e["Our Price"]);
      const stdPct = billed ? stdPay / billed : null;
      const overJobs = jobs.filter(r => (cutPct(r) || 0) > CAP);
      const oBill = overJobs.reduce((a, r) => a + (num(r["Total Bill"]) || 0), 0);
      const oCut = overJobs.reduce((a, r) => a + cut(r), 0);
      const oStd = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["Standard Pay"]) || 0 : 0); }, 0);
      const tForeman = sum(r => num(r["Forman Total $"]));
      const tMaterial = sum(r => num(r["Material $"]));
      const tExpense = sum(r => num(r["Total Expense"]));

      /* HIS SHARE OF OUR WORK needs the jobs he did NOT bring; the denominator follows the
         global date picker, never a fixed total. Under a local foreman/search filter the
         share column is hidden rather than recomputed — his filtered jobs against ALL our
         jobs would read as a collapse that is only an artefact of the filter. */
      const allByMonth = {};
      rows.forEach(r => {
        const m = String(r["Date"] || "").slice(0, 7);
        if (m) allByMonth[m] = (allByMonth[m] || 0) + 1;
      });

      const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ""}">
        <div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;

      const byMonth = {};
      jobs.forEach(r => {
        const m = String(r["Date"] || "").slice(0, 7) || "—";
        const b = byMonth[m] = byMonth[m]
          || { n: 0, rev: 0, cut: 0, prof: 0, over: 0, overAmt: 0 };
        b.n++; b.rev += num(r["Total Bill"]) || 0; b.cut += cut(r);
        b.prof += num(r["Profit per Job"]) || 0;
        if ((cutPct(r) || 0) > CAP) { b.over++; b.overAmt += overBy(r); }
      });
      const months = Object.keys(byMonth).sort();

      const monthRows = months.map(m => {
        const b = byMonth[m];
        const share = (!filtered && allByMonth[m]) ? b.n / allByMonth[m] : null;
        const cp = b.rev ? b.cut / b.rev : null;
        return `<tr><td class="strong">${esc(m)}</td>
          <td class="num">${fmtN(b.n)}</td>
          <td class="num">${filtered ? '<span class="cla-of">filtered</span>'
            : pctS(share) + `<span class="cla-of"> of ${fmtN(allByMonth[m] || 0)}</span>`}</td>
          <td class="num">${money0(b.rev)}</td>
          <td class="num">${money0(b.cut)}</td>
          <td class="num ${cp > CAP ? "cla-over" : ""}">${pctS(cp)}</td>
          <td class="num">${b.over
              ? `<span class="rs-pill warn">${fmtN(b.over)}</span> <span class="cla-of">${money0(b.overAmt)}</span>`
              : `<span class="cla-of">—</span>`}</td>
          <td class="num">${money0(b.prof)}</td>
          <td class="num">${money0(b.n ? b.prof / b.n : null)}</td>
          <td class="num">${pctS(b.rev ? b.prof / b.rev : null)}</td></tr>`;
      }).join("");

      // TOTALS (his ask 2026-08-27): sums where money, weighted rates where a rate — an
      // average of monthly percentages would weight a 2-job month like a 30-job one. The
      // share total is against OUR closings in HIS months, not all-time — 109 jobs against
      // every closing since 2023 reads 0.9% while every month above says 2-4%, and the
      // mismatch would be read as a bug (it briefly was one).
      const oursInHisMonths = months.reduce((a, m) => a + (allByMonth[m] || 0), 0);
      const monthTotal = `<tr>
        <td>All</td>
        <td class="num">${fmtN(jobs.length)}</td>
        <td class="num">${filtered ? '<span class="cla-of">—</span>'
          : pctS(oursInHisMonths ? jobs.length / oursInHisMonths : null)
            + `<span class="cla-of"> of ${fmtN(oursInHisMonths)}</span>`}</td>
        <td class="num">${money0(billed)}</td>
        <td class="num">${money0(hisCut)}</td>
        <td class="num ${billed && hisCut / billed > CAP ? "cla-over" : ""}">${pctS(billed ? hisCut / billed : null)}</td>
        <td class="num">${overCap.length
            ? `<span class="rs-pill warn">${fmtN(overCap.length)}</span> <span class="cla-of">${money0(overPaid)}</span>`
            : `<span class="cla-of">—</span>`}</td>
        <td class="num">${money0(profit)}</td>
        <td class="num">${money0(avgProfit)}</td>
        <td class="num">${pctS(billed ? profit / billed : null)}</td></tr>`;

      const jobRowsHtml = jobs.slice().sort((a, b) =>
        String(b["Date"] || "").localeCompare(String(a["Date"] || ""))).map(r => {
        const rev = num(r["Total Bill"]) || 0;
        const c = cut(r), d = dep(r);
        const pr = num(r["Profit per Job"]);
        const off = Math.abs(c - d) > 1;
        const pc = cutPct(r), over = overBy(r);
        return `<tr>
          <td class="nowrap">${esc(String(r["Date"] || "").slice(0, 10))}</td>
          <td class="strong">${esc(r["Job No"] || r["Request #"] || "—")}</td>
          <td>${esc(r["Customer"] || "—")}</td>
          <td class="nowrap muted">${esc(r["Move Type"] || r["Moving Type"] || "—")}</td>
          <td class="nowrap muted">${esc(r["Size of Move"] || "—")}</td>
          <td class="nowrap muted">${esc(r["State Name"] || r["State"] || "—")}</td>
          <td class="num">${money0(rev)}</td>
          <td class="num">${money0(c)}${off
              ? ` <span class="rs-pill warn" title="the deposit on this job is ${money0(d)}">deposit differs</span>`
              : ""}</td>
          <td class="num ${over > 0 ? "cla-over" : ""}">${pctS(pc)}</td>
          <td class="num">${over > 0
              ? `<span class="rs-pill bad">+${money0(over)}</span>`
              : `<span class="cla-of">—</span>`}</td>
          <td class="num muted">${money0(num(r["Forman Total $"]))}</td>
          <td class="num muted">${money0(num(r["Material $"]))}</td>
          <td class="num muted">${money0(num(r["Total Expense"]))}</td>
          <td class="num">${money0(pr)}</td>
          <td class="num">${pctS(rev ? (pr || 0) / rev : null)}</td>
          <td class="nowrap muted">${esc(r["Foreman"] || "—")}</td></tr>`;
      });

      const jobsTotal = `<tr>
        <td colspan="6">${fmtN(jobs.length)} job${jobs.length === 1 ? "" : "s"}
          <span class="cla-of">avg profit ${money0(avgProfit)} a job</span></td>
        <td class="num">${money0(billed)}</td>
        <td class="num">${money0(hisCut)}</td>
        <td class="num ${billed && hisCut / billed > CAP ? "cla-over" : ""}">${pctS(billed ? hisCut / billed : null)}</td>
        <td class="num">${overPaid > 0 ? money0(overPaid) : '<span class="cla-of">—</span>'}</td>
        <td class="num">${money0(tForeman)}</td>
        <td class="num">${money0(tMaterial)}</td>
        <td class="num">${money0(tExpense)}</td>
        <td class="num">${money0(profit)}</td>
        <td class="num">${pctS(billed ? profit / billed : null)}</td>
        <td></td></tr>`;

      const overRowsHtml = overCap.slice()
        .sort((a, b) => (cutPct(b) || 0) - (cutPct(a) || 0)).map(r => `<tr>
          <td class="nowrap">${esc(String(r["Date"] || "").slice(0, 10))}</td>
          <td class="strong">${esc(r["Job No"] || r["Request #"] || "—")}</td>
          <td>${esc(r["Customer"] || "—")}</td>
          <td class="num">${money0(num(r["Total Bill"]))}</td>
          <td class="num">${money0(cut(r))}</td>
          <td class="num cla-over">${pctS(cutPct(r))}</td>
          <td class="num">${money0(overBy(r))}</td></tr>`);

      const overTotal = `<tr>
        <td colspan="3">${fmtN(overCap.length)} job${overCap.length === 1 ? "" : "s"} over the cap</td>
        <td class="num">${money0(overCap.reduce((a, r) => a + (num(r["Total Bill"]) || 0), 0))}</td>
        <td class="num">${money0(overCap.reduce((a, r) => a + cut(r), 0))}</td>
        <td></td>
        <td class="num">${money0(overPaid)}</td></tr>`;

      host.innerHTML = `
        <div class="rs-page-head"><h1>CL Analysis</h1>
          <p>The jobs our <b>CL</b> partner brings us — sold under <b>Peter Montanaro</b>. He takes
             the deposit as his cut, and that cut is <b>already paid as his sales salary</b> and
             already inside job expenses, so the profit below is <b>net of it</b> and is not
             reduced again.</p></div>

        <div class="cla-bar">
          <input class="cla-in" id="claQ" style="flex:0 1 260px" placeholder="search job #, customer, state…"
            value="${esc(S.q)}">
          <span id="claFmMount"></span>
          <span class="cla-count">${filtered
            ? `${fmtN(jobs.length)} of ${fmtN(baseJobs.length)} jobs`
            : `${fmtN(jobs.length)} jobs`}</span>
          ${filtered ? `<button class="rs-btn" id="claClear">Clear</button>` : ""}
        </div>

        ${jobs.length ? `
        <div class="rs-kpis" style="--kpi-cols:8">
          ${kpi("Jobs " + (S.fm ? "with " + esc(S.fm) : "he brought"), fmtN(jobs.length),
                months.length + (months.length === 1 ? " month" : " months"))}
          ${kpi("Revenue", money0(revenue), "billed on these jobs")}
          ${kpi("His cut", money0(hisCut), "paid as sales salary", "warn")}
          ${kpi("Cut of revenue", pctS(billed ? hisCut / billed : null),
                "the deal says 30% at most")}
          ${kpi("Over the 30% cap", fmtN(overCap.length),
                overCap.length ? money0(overPaid) + " paid above it" : "none",
                overCap.length ? "neg" : "pos")}
          ${kpi("Profit to us", money0(profit),
                "already net of his cut · " + money0(avgProfit) + " a job", "pos")}
          ${kpi("Spent on top", econReady ? money0(extraSpend + refunds) : "—",
                econReady
                  ? money0(extraSpend) + " extras" + (refunds ? " · " + money0(refunds) + " refunded" : "")
                  : "mart not built yet",
                (extraSpend + refunds) > 0 ? "warn" : "")}
          ${kpi("Paid our way", econReady ? pctS(stdPct) : "—",
                econReady ? money0(stdPay) + " instead of " + money0(hisCut) : "mart not built yet",
                econReady && stdPay < hisCut ? "pos" : "")}
        </div>

        <div id="clTrend"></div>

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Is the picture still what we think it is?</div></div>
          <p class="rs-hint">Three assumptions this page rests on, re-checked on every load.</p>
          <div class="cla-checks">
            ${chk(mismatch.length === 0,
                `His cut and the deposit agree on all ${fmtN(jobs.length)} jobs`,
                `${fmtN(mismatch.length)} job(s) where the sales salary and the deposit differ by more than $1 — flagged in the table below`)}
            ${chk(clOnly.length === 0,
                "Every CL job was sold by Peter",
                `${fmtN(clOnly.length)} CL job(s) sold by somebody else — their sales salary is not this partner's cut`)}
            ${chk(peterOnly.length === 0,
                "Every one of Peter's jobs came from CL",
                `${fmtN(peterOnly.length)} Peter job(s) from another source — included here, but not partner-sourced`)}
          </div>
        </div>

        ${econReady ? `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">If he were paid the way our sales people are paid</div>
            <div class="rs-spacer"></div>
            <span class="rs-pill ${oStd < oCut ? "warn" : ""}">${pctS(oBill ? oStd / oBill : null)} on the
              ${fmtN(overJobs.length)} over-cap job${overJobs.length === 1 ? "" : "s"}</span></div>
          <p class="rs-hint">Our own sales people do not earn on the whole bill. Three parts come
            out first — <b>the stairs fee</b> (all of it goes to the crew, we keep nothing),
            <b>half the bulky fee</b> (the crew takes the other half), and <b>storage past the
            first month</b> (the sales person earns on month one only). And they earn on
            <b>our Sales Price Calculator price</b>, while every CL quote is that price
            <b>plus 20%</b>. What is left is the commissionable bill; 30% of it — his own cap —
            is what the same job would have paid him.</p>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Jobs</th><th class="num">Bill</th><th class="num">His cut</th>
              <th class="num">Cut %</th><th class="num">Our price</th>
              <th class="num">Paid our way</th><th class="num">% of bill</th>
              <th class="num">Difference</th></tr></thead>
            <tbody>
              <tr><td class="strong">All ${fmtN(jobs.length)}</td>
                <td class="num">${money0(billed)}</td>
                <td class="num">${money0(hisCut)}</td>
                <td class="num ${billed && hisCut / billed > CAP ? "cla-over" : ""}">${pctS(billed ? hisCut / billed : null)}</td>
                <td class="num muted">${money0(ourPrice)}</td>
                <td class="num">${money0(stdPay)}</td>
                <td class="num strong">${pctS(stdPct)}</td>
                <td class="num ${stdPay < hisCut ? "cla-over" : ""}">${money0(stdPay - hisCut)}</td></tr>
              <tr><td class="strong">The ${fmtN(overJobs.length)} over the cap</td>
                <td class="num">${money0(oBill)}</td>
                <td class="num">${money0(oCut)}</td>
                <td class="num cla-over">${pctS(oBill ? oCut / oBill : null)}</td>
                <td class="num muted">${money0(overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["Our Price"]) || 0 : 0); }, 0))}</td>
                <td class="num">${money0(oStd)}</td>
                <td class="num strong">${pctS(oBill ? oStd / oBill : null)}</td>
                <td class="num cla-over">${money0(oStd - oCut)}</td></tr>
            </tbody></table></div>
          <p class="rs-hint" style="margin-top:10px">On the jobs where he went past 30%, the same
            work on our own rules pays <b>${pctS(oBill ? oStd / oBill : null)}</b> of the bill —
            he was paid <b>${pctS(oBill ? oCut / oBill : null)}</b>.</p>
        </div>

        ${(refunds > 0 || claimsN > 0 || extraSpend > 0) ? `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">What these jobs cost us beyond the crew</div></div>
          <p class="rs-hint">Money that leaves after the job is closed, and is not in the crew or
            materials lines.</p>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>What</th><th class="num">Amount</th><th>Where it shows</th></tr></thead>
            <tbody>
              <tr><td class="strong">Refunds</td><td class="num">${money0(refunds)}</td>
                <td class="muted">${refunds > 0
                  ? esc(jobs.map(r => E(r)).filter(e => e && num(e["Refund $"]) > 0)
                        .map(e => e["Customer"] + " — " + (e["Refund Reason"] || "no reason recorded")).join(" · "))
                  : "none on these jobs"}</td></tr>
              <tr><td class="strong">Claims</td><td class="num">${fmtN(claimsN)}</td>
                <td class="muted">${claimsN > 0
                  ? esc(jobs.map(r => E(r)).filter(e => e && num(e["Claims"]) > 0)
                        .map(e => e["Customer"] + " — " + (e["Claim Reason"] || "—") + " (" + (e["Claim Status"] || "open") + ")").join(" · "))
                  : "none on these jobs"}</td></tr>
              <tr><td class="strong">Extra spend</td><td class="num">${money0(extraSpend)}</td>
                <td class="muted">other expenses, company tips and discounts given</td></tr>
              <tr><td class="strong">Total on top</td><td class="num strong">${money0(refunds + extraSpend)}</td>
                <td class="muted">${pctS(billed ? (refunds + extraSpend) / billed : null)} of the bill on these jobs</td></tr>
            </tbody></table></div>
        </div>` : ""}` : `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">If he were paid the way our sales people are paid</div></div>
          <p class="rs-hint">The economics mart has not been built yet — it lands on the next
            pipeline run, and this panel fills itself in then.</p>
        </div>`}

        <div class="panel">
          <div class="panel-head"><div class="panel-title">By month</div></div>
          <p class="rs-hint">How much work he brings us, and what it costs. <b>Share of our
            jobs</b> is his jobs against every closing in the same filter${filtered
              ? " — hidden while a page filter is on, because his filtered jobs against ALL our jobs would only mislead"
              : ""}.</p>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Month</th><th class="num">Jobs</th>
              <th class="num">Share of our jobs</th><th class="num">Revenue</th>
              <th class="num">His cut</th><th class="num">Cut %</th>
              <th class="num">Over cap</th>
              <th class="num">Profit</th><th class="num">Per job</th>
              <th class="num">Margin</th></tr></thead>
            <tbody>${monthRows}</tbody>
            <tfoot>${monthTotal}</tfoot></table></div>
        </div>

        ${overCap.length ? `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Over the 30% cap</div>
            <div class="rs-spacer"></div>
            <span class="rs-pill bad">${fmtN(overCap.length)} of ${fmtN(jobs.length)} jobs
              · ${money0(overPaid)} above the cap</span></div>
          <p class="rs-hint">The deal is 30% at most. These jobs paid more, worst first.</p>
          <div class="rs-tablewrap" id="clOver"><table class="rs-table">
            <thead><tr><th>Date</th><th>Job</th><th>Customer</th><th class="num">Revenue</th>
              <th class="num">His cut</th><th class="num">Cut %</th>
              <th class="num">Over by</th></tr></thead>
            <tbody></tbody>
            <tfoot>${overTotal}</tfoot>
          </table></div>
          <div class="cla-foot" data-foot></div>
        </div>` : ""}

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Every job${S.fm ? " — foreman " + esc(S.fm) : " he has given us"}</div>
            <div class="rs-spacer"></div>
            <button class="rs-btn" id="clCsv">Download CSV</button></div>
          <div class="rs-tablewrap" id="clJobs"><table class="rs-table">
            <thead><tr><th>Date</th><th>Job</th><th>Customer</th><th>Type</th><th>Size</th>
              <th>State</th><th class="num">Revenue</th><th class="num">His cut</th>
              <th class="num">Cut %</th><th class="num">Over cap</th>
              <th class="num">Foreman $</th><th class="num">Materials</th>
              <th class="num">Expenses</th><th class="num">Profit</th><th class="num">Margin</th>
              <th>Foreman</th></tr></thead>
            <tbody></tbody>
            <tfoot>${jobsTotal}</tfoot></table></div>
          <div class="cla-foot" data-foot></div>
        </div>`
        : `<div class="panel">No jobs match the search — clear it to see all
             ${fmtN(baseJobs.length)}.</div>`}`;

      // ---- wire the local bar (debounced, focus preserved across the repaint)
      const qEl = host.querySelector("#claQ");
      qEl.oninput = () => {
        clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = qEl.value.trim(); paint();
          const el2 = host.querySelector("#claQ");
          el2.focus(); el2.setSelectionRange(el2.value.length, el2.value.length);
        }, 250);
      };
      // the KIT dropdown, not a naked <select> — his call 2026-08-27. Local state, so it
      // never grows a chip in the global filter bar and "Clear all" cannot sweep it.
      RSC.localSelect(host.querySelector("#claFmMount"), {
        label: "Foreman", values: foremen, value: S.fm, allLabel: "All foremen",
        onChange: v => { S.fm = v; paint(); },
      });
      const clr = host.querySelector("#claClear");
      if (clr) clr.onclick = () => { S.q = ""; S.fm = ""; paint(); };
      if (!jobs.length) return;

      paginate("clJobs", jobRowsHtml, 25);
      paginate("clOver", overRowsHtml, 15);

      /* PROFIT PER JOB, MONTH BY MONTH — bars are what we keep on an average job; the line
         is his cut as a share of the bill with the 30% cap drawn across it. Recomputed over
         the filtered set like everything else on the page. */
      RSC.chartCard(document.getElementById("clTrend"), {
        title: "Profit per job, and his cut against the 30% cap",
        key: "cl-analysis-trend",
        buildChart(canvas) {
          return new Chart(canvas, {
            type: "bar",
            data: {
              labels: months,
              datasets: [
                { label: "Profit per job",
                  data: months.map(m => byMonth[m].n ? byMonth[m].prof / byMonth[m].n : 0),
                  backgroundColor: "rgba(132,204,22,.78)", yAxisID: "y", order: 3 },
                { type: "line", label: "His cut %",
                  data: months.map(m => byMonth[m].rev
                    ? 100 * byMonth[m].cut / byMonth[m].rev : null),
                  borderColor: "#b45309", backgroundColor: "#b45309", tension: .3,
                  yAxisID: "y1", order: 1 },
                { type: "line", label: "The 30% cap",
                  data: months.map(() => 30), borderColor: "#dc2626", borderDash: [5, 4],
                  pointRadius: 0, borderWidth: 1.5, yAxisID: "y1", order: 2 },
              ],
            },
            options: {
              responsive: true, maintainAspectRatio: false,
              plugins: { legend: { position: "bottom" } },
              scales: {
                y: { position: "left", beginAtZero: true,
                     title: { display: true, text: "Profit per job ($)" } },
                y1: { position: "right", beginAtZero: true, suggestedMax: 40,
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: "His cut (% of bill)" } },
              },
            },
          });
        },
        buildTable() {
          const trows = months.map(m => ({
            k: m, jobs: byMonth[m].n,
            per: byMonth[m].n ? byMonth[m].prof / byMonth[m].n : null,
            pctv: byMonth[m].rev ? byMonth[m].cut / byMonth[m].rev : null,
          }));
          return RSC.table(
            [{ key: "k", label: "Month" },
             { key: "jobs", label: "Jobs", align: "r", fmt: fmtN },
             { key: "per", label: "Profit per job", align: "r", fmt: money0 },
             { key: "pctv", label: "His cut %", align: "r", fmt: pctS }],
            trows,
            { k: "All", jobs: jobs.length, per: avgProfit,
              pctv: billed ? hisCut / billed : null });
        },
      });

      const csv = host.querySelector("#clCsv");
      if (csv) csv.onclick = () => {
        const cols = ["Date", "Job No", "Customer", "Move Type", "Size of Move", "State",
          "Revenue", "His Cut (sales salary)", "Deposit", "Cut %", "Foreman $", "Materials",
          "Total Expense", "Profit", "Margin", "Foreman"];
        const cell = x => {
          let s = String(x == null ? "" : x);
          if (/^[=+\-@]/.test(s)) s = " " + s;   // no live formulas; finance opens in Excel
          return '"' + s.replace(/"/g, '""') + '"';
        };
        const lines = [cols.map(cell).join(",")].concat(jobs.map(r => {
          const rev = num(r["Total Bill"]) || 0, c = cut(r), pr = num(r["Profit per Job"]) || 0;
          return [String(r["Date"] || "").slice(0, 10), r["Job No"] || r["Request #"] || "",
            r["Customer"] || "", r["Move Type"] || r["Moving Type"] || "", r["Size of Move"] || "",
            r["State Name"] || r["State"] || "", rev, c, dep(r),
            rev ? (c / rev) : "", num(r["Forman Total $"]) || 0, num(r["Material $"]) || 0,
            num(r["Total Expense"]) || 0, pr, rev ? (pr / rev) : "", r["Foreman"] || ""]
            .map(cell).join(",");
        }));
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "CL Analysis.csv";
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      };
    }

    /* PAGINATION — rows arrive as row-HTML so paging costs nothing; the totals row lives in
       the tfoot and never pages away. */
    function paginate(mountId, rowsHtml, per) {
      const mount = document.getElementById(mountId);
      if (!mount) return;
      const tbody = mount.querySelector("tbody");
      // THE FOOTER IS A SIBLING OF THE TABLE WRAPPER, not a child — it has to sit outside
      // the horizontally-scrolling box or it scrolls away with the widest column.
      const foot = (mount.parentElement || document).querySelector("[data-foot]");
      if (!tbody || !foot) return;
      per = per || 25;
      let page = 0, all = rowsHtml.length <= per;
      const pages = Math.max(1, Math.ceil(rowsHtml.length / per));
      function draw() {
        tbody.innerHTML = (all ? rowsHtml
          : rowsHtml.slice(page * per, page * per + per)).join("");
        if (rowsHtml.length <= per) {
          foot.innerHTML = `<span>${fmtN(rowsHtml.length)} `
            + `row${rowsHtml.length === 1 ? "" : "s"}</span>`;
          return;
        }
        const from = all ? 1 : page * per + 1;
        const to = all ? rowsHtml.length : Math.min(rowsHtml.length, page * per + per);
        foot.innerHTML = `<span>${fmtN(from)}–${fmtN(to)} of ${fmtN(rowsHtml.length)}</span>`
          + (all ? "" : `<span class="cla-pg">
               <button class="rs-btn" data-prev ${page === 0 ? "disabled" : ""}>‹</button>
               <b>${page + 1} / ${pages}</b>
               <button class="rs-btn" data-next ${page >= pages - 1 ? "disabled" : ""}>›</button>
             </span>`)
          + `<button class="rs-btn" data-all>${all ? "Paginate" : "Show all"}</button>`;
        const pv = foot.querySelector("[data-prev]");
        if (pv) pv.onclick = () => { if (page > 0) { page--; draw(); } };
        const nx = foot.querySelector("[data-next]");
        if (nx) nx.onclick = () => { if (page < pages - 1) { page++; draw(); } };
        const al = foot.querySelector("[data-all]");
        if (al) al.onclick = () => { all = !all; page = 0; draw(); };
      }
      draw();
    }

    function chk(ok, good, bad) {
      return `<div class="cla-chk ${ok ? "ok" : "bad"}">
        <span>${ok ? "✓" : "!"}</span><div>${ok ? esc(good) : esc(bad)}</div></div>`;
    }
  },
});
