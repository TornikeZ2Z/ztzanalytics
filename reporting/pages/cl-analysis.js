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
           "Adjusted Cut", "Adjusted Cut Our Price", "Cut On Fees",
           "Bill After Claims", "As Sales Person 5", "As Sales Person 9",
           "Refund His Share", "Refund By Profit",
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
        // THE PROPOSAL IS ITS OWN VIEW, not a panel inside the analysis: the slides are the
        // document CL will be sent, so they are shown at reading size on a plain ground,
        // one under the other, exactly as they print.
        ".cla-view{display:flex;flex-direction:column;gap:18px;padding:4px 0 8px}",
        ".cla-slide{background:#fff;color:#1B1A17;padding:34px 40px;border-radius:8px;"
          + "font-family:Georgia,'Times New Roman',serif;border:1px solid var(--line-2);"
          + "box-shadow:0 1px 2px rgba(0,0,0,.06),0 12px 32px -24px rgba(0,0,0,.5);"
          + "max-width:860px;width:100%;margin:0 auto}",
        ".cla-slide h2{font-family:inherit;font-size:21px;margin:0 0 10px;color:#1B1A17;"
          + "letter-spacing:-.01em}",
        ".cla-slide .eyebrow{font-size:9.5px;letter-spacing:.16em;text-transform:uppercase;"
          + "color:#A9691B;font-weight:700;margin:0 0 8px}",
        ".cla-slide p{font-size:13px;line-height:1.55;color:#3A3833;margin:0 0 9px;max-width:66ch}",
        ".cla-slide table{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:8px}",
        ".cla-slide th{text-align:left;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;"
          + "color:#78756B;padding:7px 10px;border-bottom:1px solid #DCDAD1;font-family:inherit}",
        ".cla-slide td{padding:7px 10px;border-bottom:1px solid #EDEBE4;color:#1B1A17}",
        ".cla-slide td.r,.cla-slide th.r{text-align:right;font-variant-numeric:tabular-nums}",
        ".cla-slide tr.hi td{background:#F6EADA}",
        ".cla-figs{display:flex;gap:0;border-block:1px solid #DCDAD1;margin:12px 0 4px}",
        ".cla-fig{flex:1;padding:12px 10px 12px 0}",
        ".cla-fig b{display:block;font-size:22px;color:#A9691B;font-family:Georgia,serif;"
          + "font-variant-numeric:tabular-nums}",
        ".cla-fig i{font-style:normal;font-size:10.5px;color:#78756B;display:block;margin-top:3px}",
        ".cla-split{display:grid;grid-template-columns:96px 1fr;gap:12px;padding:9px 0;"
          + "border-top:1px solid #EDEBE4;font-size:12.5px}",
        ".cla-split:first-of-type{border-top:0}",
        ".cla-splitb{display:flex;height:18px;border:1px solid #C9C6BA;overflow:hidden;margin-bottom:5px}",
        ".cla-splitb i{font-style:normal;font-size:9px;color:#fff;display:grid;place-items:center;"
          + "font-family:Arial,sans-serif}",
        ".cla-bar{display:flex;align-items:center;gap:9px;margin:5px 0;font-size:11.5px}",
        ".cla-bar span.t{width:150px;color:#3A3833}",
        ".cla-bar span.b{height:15px;background:#A9691B}",
        ".cla-bar span.b.now{background:#33566E}",
        ".cla-bar span.v{color:#3A3833;font-variant-numeric:tabular-nums;white-space:nowrap}",
        ".cla-vh{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:0 0 14px}",
        ".cla-vh .rs-hint{margin:0;flex:1 1 340px;min-width:0}",
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

    // page-local state; paint() recomputes the whole page over the filtered set.
    // `view` is the top-level switch: the analysis, or the document we send CL.
    const S = { q: "", fm: "", view: "analysis" };
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

    /* THE PROPOSAL FOR CL — built from the mart, so it can never drift from the page above it.
       Always the FULL set of his jobs, never the filtered view: a deck showing "his jobs with
       foreman X" would be read as his whole account and would be wrong.

       It prints as a SEPARATE DOCUMENT rather than @media print over the portal, for the reason
       hr-questionnaire.js gives: hiding a sidebar and hoping nothing else leaks onto the paper
       is not a document. What prints is exactly what is written here. */
    function deckData() {
      const rowsE = baseJobs.map(E).filter(Boolean);
      const S2 = (f) => rowsE.reduce((a, e) => a + (num(f(e)) || 0), 0);
      const n = rowsE.length;
      const bill = S2(e => e["Total Bill"]);
      const paid = S2(e => e["His Cut"]);
      const ours = S2(e => e["Our Price"]);
      const refund = S2(e => e["Refund $"]);
      const U = 1.20;
      const mk = (label, newBill, pay, note) => ({
        label, bill: newBill, pay, note,
        ticket: n ? newBill / n : 0,
        per: n ? pay / n : 0,
        breakeven: pay > 0 ? paid / (pay / n) : null,
      });
      const netBill = S2(e => e["Bill After Claims"]);
      const sp5 = S2(e => e["As Sales Person 5"]);
      const sp9 = S2(e => e["As Sales Person 9"]);

      // HOW HIS SHARE IS ACTUALLY DISTRIBUTED. This is the honest reason to rewrite the
      // agreement: not that he earns too much on average, but that job to job the number
      // is unpredictable — it has ranged from nothing to two thirds of the bill.
      const shares = rowsE.filter(e => num(e["Total Bill"]) > 0)
        .map(e => num(e["His Cut"]) / num(e["Total Bill"]));
      const bandOf = p => p < 0.20 ? 0 : p < 0.25 ? 1 : p < 0.30 ? 2 : p < 0.35 ? 3 : 4;
      const bands = [0, 0, 0, 0, 0];
      shares.forEach(p => { bands[bandOf(p)]++; });
      const sorted = shares.slice().sort((a, b) => a - b);
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;

      // per-job: which plan pays MORE than he actually got, and on how many jobs
      const payOf = (e, which) => {
        const b = num(e["Total Bill"]) || 0;
        if (which === "A") return 0.20 * (b / U);
        if (which === "B") return 0.25 * (b / U * 1.10);
        return 0.25 * (num(e["Our Price"]) || 0);
      };
      const split = which => {
        let up = 0, down = 0, upAmt = 0;
        rowsE.forEach(e => {
          const d = payOf(e, which) - num(e["His Cut"]);
          if (d > 0.5) { up++; upAmt += d; } else if (d < -0.5) { down++; }
        });
        return { up, down, upAmt };
      };
      // his ordinary work — the jobs that stayed inside the 30% he agreed to
      const under = rowsE.filter(e => num(e["Total Bill"]) > 0
        && num(e["His Cut"]) <= 0.30 * num(e["Total Bill"]));
      const uBill = under.reduce((a, e) => a + num(e["Total Bill"]), 0);
      const uPaid = under.reduce((a, e) => a + num(e["His Cut"]), 0);
      const uPay = which => under.reduce((a, e) => a + payOf(e, which), 0);
      const byMonth = {};
      baseJobs.forEach(r => {
        const k = String(r["Date"] || "").slice(0, 7);
        if (k) byMonth[k] = (byMonth[k] || 0) + 1;
      });

      return {
        n, bill, paid, ours, refund, netBill, sp5, sp9,
        bands, median, split, under: { n: under.length, bill: uBill, paid: uPaid, pay: uPay },
        months2: Object.keys(byMonth).sort().map(k => ({ m: k, n: byMonth[k] })),
        ticket: n ? bill / n : 0, per: n ? paid / n : 0,
        months: [...new Set(baseJobs.map(r => String(r["Date"] || "").slice(0, 7)).filter(Boolean))].length,
        plans: [
          mk("A · no uplift, 20% of the bill", bill / U, 0.20 * (bill / U),
             "The 20% increase comes off. You quote our calculator price exactly as it comes — the sharpest price you can put in front of a customer — and earn 20% of it."),
          mk("B · 10% uplift, 25% of the bill", bill / U * 1.10, 0.25 * (bill / U * 1.10),
             "Half the increase stays in the price — still cheaper than today — and your share of the bill rises from 20% to 25%."),
          mk("C · keep the 20%, 25% of our price", bill, 0.25 * ours,
             "Nothing changes for your customers: you quote exactly what you quote today. Your 25% is measured against our calculator price, under the three rules above."),
        ],
      };
    }

    function deckHtml(D) {
      const m0 = v => money0(v);
      const pj = D.plans;
      const A = pj[0], B = pj[1], C = pj[2];
      const pct1 = v => (v * 100).toFixed(1) + "%";
      const maxPay = Math.max(D.paid, A.per * (D.n * 1.8));
      const bar = (label, val, isNow, tail) => `<div class="cla-bar">
        <span class="t">${esc(label)}</span>
        <span class="b${isNow ? " now" : ""}" style="width:${Math.max(2, val / maxPay * 300)}px"></span>
        <span class="v">${m0(val)}${tail ? " — " + esc(tail) : ""}</span></div>`;
      const bandN = Math.max(...D.bands, 1);
      const bandLbl = ["under 20%", "20–25%", "25–30%", "30–35%", "over 35%"];
      const sB = D.split("B"), sC = D.split("C"), sA = D.split("A");
      const maxMonth = Math.max(...D.months2.map(x => x.n), 1);

      return `
      <section class="cla-slide">
        <p class="eyebrow">Zip to Zip · a new agreement</p>
        <h2>The CL Agreement</h2>
        <p>${fmtN(D.n)} jobs together in ${D.months} months, ${m0(D.bill)} billed, ${m0(D.paid)}
          earned by you. We want to keep all of it — and put one rule underneath it.</p>
        <div class="cla-figs">
          <div class="cla-fig"><b>${fmtN(D.n)}</b><i>jobs — about
            ${fmtN(Math.round(D.n / Math.max(1, D.months)))} a month</i></div>
          <div class="cla-fig"><b>${m0(D.ticket)}</b><i>average ticket</i></div>
          <div class="cla-fig"><b>${m0(D.per)}</b><i>you keep, per job</i></div>
          <div class="cla-fig"><b>${m0(D.paid)}</b><i>your earnings so far</i></div>
        </div>
      </section>

      <section class="cla-slide">
        <p class="eyebrow">Why we are rewriting it</p>
        <h2>Your share has no rule — it has ranged from nothing to two thirds of a bill</h2>
        <p>This is not a complaint about the amount. Across the ${fmtN(D.n)} jobs your share of the
          bill has landed almost anywhere, with a median of <b>${pct1(D.median)}</b>. On ${fmtN(D.bands[0])}
          jobs you took under 20%; on ${fmtN(D.bands[4])} you took over 35%. The agreement says 30% at
          most, and roughly a third of the jobs sit outside it in one direction or the other.</p>
        ${D.bands.map((v, i) => `<div class="cla-bar">
            <span class="t">${bandLbl[i]}</span>
            <span class="b" style="width:${Math.max(2, v / bandN * 210)}px"></span>
            <span class="v">${fmtN(v)} job${v === 1 ? "" : "s"}</span></div>`).join("")}
        <p style="margin-top:10px">Neither of us can plan on a number that moves like that. Everything
          below is an attempt to replace it with one you can calculate yourself before you quote.</p>
      </section>

      <section class="cla-slide">
        <p class="eyebrow">The offer</p>
        <h2>Three structures — pick the one that fits how you want to sell</h2>
        <table>
          <thead><tr><th>Plan</th><th class="r">Your average ticket</th><th class="r">You keep per job</th>
            <th class="r">Over ${fmtN(D.n)} jobs</th></tr></thead>
          <tbody>
            <tr class="hi"><td><b>Today</b> — no fixed rule</td><td class="r">${m0(D.ticket)}</td>
              <td class="r">${m0(D.per)}</td><td class="r">${m0(D.paid)}</td></tr>
            ${pj.map(p => `<tr><td><b>${esc(p.label)}</b></td><td class="r">${m0(p.ticket)}</td>
              <td class="r">${m0(p.per)}</td><td class="r">${m0(p.pay)}</td></tr>`).join("")}
          </tbody></table>
        ${pj.map(p => `<p style="margin-top:9px"><b>${esc(p.label)}.</b> ${esc(p.note)}</p>`).join("")}
      </section>

      <section class="cla-slide">
        <p class="eyebrow">What it means job by job</p>
        <h2>These are not blanket cuts — two of them pay you more on the work you do most</h2>
        <p>A total hides what actually happens on each job. Run every plan across all
          ${fmtN(D.n)} jobs one at a time:</p>
        <table>
          <thead><tr><th>Plan</th><th class="r">Pays you more on</th><th class="r">Pays you less on</th>
            <th class="r">On your ${fmtN(D.under.n)} jobs inside 30%</th></tr></thead>
          <tbody>
            <tr><td><b>Plan A</b></td><td class="r">${fmtN(sA.up)} jobs</td>
              <td class="r">${fmtN(sA.down)} jobs</td>
              <td class="r">${m0(D.under.pay("A") - D.under.paid)}</td></tr>
            <tr class="hi"><td><b>Plan B</b></td><td class="r">${fmtN(sB.up)} jobs</td>
              <td class="r">${fmtN(sB.down)} jobs</td>
              <td class="r">${m0(D.under.pay("B") - D.under.paid)}</td></tr>
            <tr><td><b>Plan C</b></td><td class="r">${fmtN(sC.up)} jobs</td>
              <td class="r">${fmtN(sC.down)} jobs</td>
              <td class="r">${m0(D.under.pay("C") - D.under.paid)}</td></tr>
          </tbody></table>
        <p style="margin-top:10px">The last column is the one worth reading twice. On the
          <b>${fmtN(D.under.n)} jobs where you stayed inside the 30%</b> — your ordinary work, which is
          ${(D.under.n / D.n * 100).toFixed(0)}% of everything you brought us —
          <b>Plan B pays you ${m0(Math.abs(D.under.pay("B") - D.under.paid))}
          ${D.under.pay("B") >= D.under.paid ? "more" : "less"} than you actually received</b>.
          What the plans reprice is the tail, not the everyday job.</p>
      </section>

      <section class="cla-slide">
        <p class="eyebrow">How the percentage is calculated</p>
        <h2>Three parts of a bill that no one earns commission on</h2>
        <p>So you can compute your own number before you quote, here is exactly what the percentage
          applies to. These rules are the same for every Zip to Zip sales person.</p>
        <div class="cla-split"><div><b>Stairs fee</b></div><div>
          <div class="cla-splitb"><i style="width:100%;background:#A9691B">100% to the crew</i></div>
          The company keeps nothing — it all goes to the foreman and helpers who carried the
          furniture, so there is no share to commission.</div></div>
        <div class="cla-split"><div><b>Bulky items</b></div><div>
          <div class="cla-splitb"><i style="width:50%;background:#A9691B">50% crew</i><i style="width:50%;background:#33566E">50% company</i></div>
          Split down the middle; commission is paid out of the company half only.</div></div>
        <div class="cla-split"><div><b>Storage</b></div><div>
          <div class="cla-splitb"><i style="width:20%;background:#33566E">month 1</i><i style="width:80%;background:#EBEAE4;color:#78756B">months 2, 3, 4, 5 …</i></div>
          Commission on the first month only — $1,000 a month for five months pays on $1,000, not
          $5,000. The rest pays for the warehouse.</div></div>
        <p style="margin-top:12px">And on the price itself: every CL quote is our Sales Price
          Calculator number <b>plus 20%</b>. Across these jobs that is ${m0(D.ours)} of our price
          against ${m0(D.bill)} billed. Plans A and B change that uplift; Plan C leaves it exactly
          as it is and measures your 25% against our number.</p>
        <p style="color:#78756B;font-size:11.5px">For context on the rates: our own sellers earn 9%
          or 5% of a bill. Every plan here pays you 20–25%, because you bring the work as well as
          closing it — that difference is deliberate and we are not proposing to remove it.</p>
      </section>

      <section class="cla-slide">
        <p class="eyebrow">If you want the cheaper price</p>
        <h2>Plan A only works if volume follows — here is the number it needs</h2>
        <p>Plan A drops your ticket by <b>${((1 - A.ticket / D.ticket) * 100).toFixed(0)}%</b>, from
          ${m0(D.ticket)} to ${m0(A.ticket)}, which is a real weapon in a quote. At ${m0(A.per)} a job
          you match today's ${m0(D.paid)} at <b>${fmtN(Math.round(A.breakeven))} jobs</b> —
          ${fmtN(Math.round(A.breakeven - D.n))} more than you brought, about
          <b>${(Math.round(A.breakeven - D.n) / Math.max(1, D.months)).toFixed(0)} extra a month</b>.</p>
        ${bar("Today · " + fmtN(D.n) + " jobs", D.paid, true, "")}
        ${[0, 0.20, 0.40, 0.56, 0.80].map(g => bar(
            g === 0 ? "Plan A · same volume" : "Plan A · +" + Math.round(g * 100) + "% → "
              + fmtN(Math.round(D.n * (1 + g))) + " jobs",
            A.per * D.n * (1 + g), false,
            Math.abs(g - 0.56) < .01 ? "level with today" : "")).join("")}
        <p style="margin-top:10px">Worth being straight about the starting point: your volume has
          been steady rather than climbing — ${D.months2.map(x => x.n).join(", ")} jobs a month since
          January. Plan A is a bet that a lower price changes that. <b>Plan B needs only
          ${fmtN(Math.round(B.breakeven))} jobs</b> and <b>Plan C ${fmtN(Math.round(C.breakeven))}</b>
          to leave you level.</p>
      </section>

      <section class="cla-slide">
        <p class="eyebrow">Our recommendation</p>
        <h2>Plan B — and here is what you get in any of them</h2>
        <p><b>We think Plan B fits best.</b> It is the closest to what you earn today, it is the only
          plan that pays you <b>more</b> on your ordinary jobs, it still lets you quote below today's
          price, and it needs the smallest change in volume — ${fmtN(Math.round(B.breakeven))} jobs
          against the ${fmtN(D.n)} you already do — to leave you level.</p>
        <p><b>One rule, calculable before you quote.</b> No more month-by-month conversation about
          what a job earned. You will be able to work out your own number from the quote.</p>
        <p><b>No cap.</b> Today's agreement caps you at 30% and it has not held in either direction.
          A flat percentage has no ceiling to argue about.</p>
        <p><b>The same job-level view we have</b> — the bill, what came off it and why, and your
          share, on every job.</p>
        <p><b>Refunds and claims stay named.</b> Across these ${D.months} months there was
          ${D.refund > 0 ? m0(D.refund) + " refunded on one job" : "no refund"} — small, and it should
          stay visible rather than disappear into an average.</p>
        <p style="color:#78756B;font-size:11.5px;margin-top:14px">Figures from closed jobs in our
          reporting system, ${fmtN(D.n)} jobs sourced through CL, ${D.months} months. "Our price" is
          the Sales Price Calculator amount after the stairs, bulky and storage rules and before the
          20% uplift. Per-job figures are period totals divided by ${fmtN(D.n)}; volume scenarios hold
          the per-job amount constant and vary the number of jobs.</p>
      </section>`;
    }

    function paintProposal() {
      host.innerHTML = `
        <div class="rs-page-head"><h1>CL Analysis</h1></div>
        <div class="cla-bar" id="claViews"></div>
        <div class="cla-vh">
          <p class="rs-hint">The document we send CL: his jobs, his ticket, what he keeps, and the
            volume each plan needs — <b>nothing about our margin</b>. Always his full
            ${fmtN(baseJobs.length)} jobs, never a filter. It is built from the same numbers as the
            analysis, so the two can never disagree.</p>
          <button class="rs-btn primary" id="clDeckPdf">Download PDF</button>
        </div>
        ${econReady
          ? `<div class="cla-view">${deckHtml(deckData())}</div>`
          : `<div class="panel">The economics mart has not been built yet — it lands on the next
               pipeline run, and the proposal fills itself in then.</div>`}`;
      mountViews();
      const b = host.querySelector("#clDeckPdf");
      if (b) b.onclick = deckPrint;
    }

    /* The view switch, mounted into whichever view is on screen. */
    function mountViews() {
      const host2 = host.querySelector("#claViews");
      if (!host2) return;
      const seg = document.createElement("div");
      seg.className = "rs-seg";
      [["analysis", "Analysis"], ["proposal", "Proposal for CL"]].forEach(([k, label]) => {
        const b = document.createElement("button");
        b.textContent = label;
        if (S.view === k) b.className = "on";
        b.onclick = () => { if (S.view !== k) { S.view = k; paint(); } };
        seg.appendChild(b);
      });
      host2.appendChild(seg);
    }

    function deckPrint() {
      const win = window.open("", "_blank");
      if (!win) { alert("Allow pop-ups for this site to save the presentation as a PDF."); return; }
      const css = `
        @page{size:A4;margin:14mm}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
        body{margin:0;background:#fff;color:#1B1A17;font-family:Georgia,'Times New Roman',serif}
        section{padding:0 0 26px;break-inside:avoid;break-after:page}
        section:last-child{break-after:auto}
        h2{font-size:26px;margin:0 0 12px;letter-spacing:-.02em}
        .eyebrow{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#A9691B;
          font-weight:700;margin:0 0 10px;font-family:Arial,sans-serif}
        p{font-size:13.5px;line-height:1.6;color:#3A3833;margin:0 0 11px;max-width:70ch}
        table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}
        th{text-align:left;font-size:10px;letter-spacing:.07em;text-transform:uppercase;color:#78756B;
          padding:9px 11px;border-bottom:1px solid #DCDAD1;font-family:Arial,sans-serif}
        td{padding:9px 11px;border-bottom:1px solid #EDEBE4}
        td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
        tr.hi td{background:#F6EADA}
        .cla-figs{display:flex;border-top:1px solid #DCDAD1;border-bottom:1px solid #DCDAD1;margin:16px 0}
        .cla-fig{flex:1;padding:16px 12px 16px 0}
        .cla-fig b{display:block;font-size:30px;color:#A9691B;font-variant-numeric:tabular-nums}
        .cla-fig i{font-style:normal;font-size:11px;color:#78756B;display:block;margin-top:5px}
        .cla-split{display:grid;grid-template-columns:110px 1fr;gap:14px;padding:11px 0;
          border-top:1px solid #EDEBE4;font-size:13px}
        .cla-splitb{display:flex;height:20px;border:1px solid #C9C6BA;overflow:hidden;margin-bottom:6px}
        .cla-splitb i{font-style:normal;font-size:9.5px;color:#fff;display:grid;place-items:center;
          font-family:Arial,sans-serif}
        .cla-bar{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:12px}
        .cla-bar span.t{width:170px;color:#3A3833}
        .cla-bar span.b{height:16px;background:#A9691B}
        .cla-bar span.b.now{background:#33566E}
        .cla-bar span.v{color:#3A3833;font-variant-numeric:tabular-nums;white-space:nowrap}`;
      win.document.write('<!doctype html><html><head><meta charset="utf-8">'
        + "<title>The CL Agreement</title><style>" + css + "</style></head><body>"
        + deckHtml(deckData()) + "</body></html>");
      win.document.close();
      win.focus();
      setTimeout(() => win.print(), 350);
    }

    function paint() {
      if (S.view === "proposal") { paintProposal(); return; }
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
      const adjCut = eSum(e => e["Adjusted Cut"]);            // his rate, fee parts removed
      const adjOur = eSum(e => e["Adjusted Cut Our Price"]);  // ...and off our price
      const cutOnFees = eSum(e => e["Cut On Fees"]);          // what he earned on those parts
      const feeMoney = eSum(e => num(e["Stairs Fee"]) + num(e["Bulky Fee"]) * 0.5
                                 + num(e["Storage Past Month 1"]));
      const withContract = jobs.filter(r => { const e = E(r); return e && String(e["Has Contract"]) === "Yes"; }).length;
      const netBill = eSum(e => e["Bill After Claims"]);   // claims off the bill first
      const sp5 = eSum(e => e["As Sales Person 5"]);
      const sp9 = eSum(e => e["As Sales Person 9"]);
      const refHis = eSum(e => e["Refund His Share"]);      // 30%, his agreed rate
      const refProfit = eSum(e => e["Refund By Profit"]);   // the case-by-case split
      const overJobs = jobs.filter(r => (cutPct(r) || 0) > CAP);
      const oBill = overJobs.reduce((a, r) => a + (num(r["Total Bill"]) || 0), 0);
      const oCut = overJobs.reduce((a, r) => a + cut(r), 0);
      const oStd = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["Standard Pay"]) || 0 : 0); }, 0);
      const oAdj = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["Adjusted Cut"]) || 0 : 0); }, 0);
      const oAdjOur = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["Adjusted Cut Our Price"]) || 0 : 0); }, 0);
      const oSp5 = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["As Sales Person 5"]) || 0 : 0); }, 0);
      const oSp9 = overJobs.reduce((a, r) => { const e = E(r); return a + (e ? num(e["As Sales Person 9"]) || 0 : 0); }, 0);
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

        <div class="cla-bar" id="claViews"></div>

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
          ${kpi("Refunded", econReady ? money0(refunds) : "—",
                econReady
                  ? (refunds ? money0(refHis) + " of it his at 30%" : "none on these jobs")
                  : "mart not built yet",
                refunds > 0 ? "warn" : "")}
          ${kpi("Without the fee parts", econReady ? pctS(billed ? adjCut / billed : null) : "—",
                econReady ? money0(adjCut) + " instead of " + money0(hisCut)
                          + " · " + money0(cutOnFees) + " earned on them" : "mart not built yet",
                econReady && adjCut < hisCut ? "pos" : "")}
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
          <div class="panel-head"><div class="panel-title">What he would have earned without the parts our sales people never earn on</div></div>
          <p class="rs-hint">His rate stays exactly what he was paid — only the <b>base it applies
            to</b> shrinks. Three parts of a bill are not the sales person's to earn on:
            <b>the stairs fee</b> (all of it goes to the crew, we keep nothing), <b>half the bulky
            fee</b> (the crew takes the other half), and <b>storage past the first month</b>. The
            last row goes one step further and prices him on <b>our Sales Price Calculator
            number</b> rather than the quote, which carries a 20% increase on top.</p>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>The question</th><th>What changes</th>
              <th class="num">Over all 109 jobs</th><th class="num">% of the bill</th>
              <th class="num">vs what he was paid</th></tr></thead>
            <tbody>
              <tr><td class="strong">What he was actually paid</td>
                <td class="muted">his cut, against the whole bill</td>
                <td class="num strong">${money0(hisCut)}</td>
                <td class="num ${billed && hisCut / billed > CAP ? "cla-over" : ""}">${pctS(billed ? hisCut / billed : null)}</td>
                <td class="num muted">—</td></tr>

              <tr><td colspan="5" class="muted" style="padding-top:14px">
                <b>If he kept his own rate, but only earned on what a sales person may earn on</b></td></tr>
              <tr><td>1 · Take out the parts nobody earns commission on</td>
                <td class="muted">the stairs fee, half the bulky fee, storage after month 1</td>
                <td class="num">${money0(adjCut)}</td>
                <td class="num">${pctS(billed ? adjCut / billed : null)}</td>
                <td class="num">${money0(adjCut - hisCut)}</td></tr>
              <tr><td>2 · …and price it on our number, not his quote</td>
                <td class="muted">every CL quote is our price plus 20% — this removes that</td>
                <td class="num strong">${money0(adjOur)}</td>
                <td class="num strong">${pctS(billed ? adjOur / billed : null)}</td>
                <td class="num strong">${money0(adjOur - hisCut)}</td></tr>

              <tr><td colspan="5" class="muted" style="padding-top:14px">
                <b>If he were on the payroll instead — our own sales rates</b></td></tr>
              <tr><td>At 9% — our senior rate</td>
                <td class="muted">the claim comes off the bill first, then 9%</td>
                <td class="num">${money0(sp9)}</td>
                <td class="num">${pctS(billed ? sp9 / billed : null)}</td>
                <td class="num">${money0(sp9 - hisCut)}</td></tr>
              <tr><td>At 5% — what most of the team is on</td>
                <td class="muted">same basis, our common rate</td>
                <td class="num">${money0(sp5)}</td>
                <td class="num">${pctS(billed ? sp5 / billed : null)}</td>
                <td class="num">${money0(sp5 - hisCut)}</td></tr>
            </tbody></table></div>

          <p class="rs-hint" style="margin-top:12px">Same five questions, asked only of the
            <b>${fmtN(overJobs.length)} jobs where he went past the 30% cap</b> (${money0(oBill)}
            billed): paid <b>${money0(oCut)}</b> (${pctS(oBill ? oCut / oBill : null)}) ·
            without the fee parts ${money0(oAdj)} · on our price ${money0(oAdjOur)}
            (${pctS(oBill ? oAdjOur / oBill : null)}) · at 9% ${money0(oSp9)} · at 5% ${money0(oSp5)}.</p>

          <div class="cla-checks" style="margin-top:14px">
            ${chk(false,
              "",
              `The fee rules move the number by only ${money0(hisCut - adjCut)} across ${fmtN(jobs.length)} jobs.
               There is ${money0(feeMoney)} of deductible fee on these jobs in total — the stairs fee appears
               on a handful, and storage past month one on none at all. The 20% quote increase is worth
               ${money0(adjCut - adjOur)} by comparison, which is where the real difference sits.`)}
            ${chk(false, "",
              `The last two rows are the same jobs on an employee's terms: the claim comes off the
               bill first (${money0(billed - netBill)} across these jobs), then our own rate — 9%,
               which four sellers are on, or 5%, which the rest of the team is on. He was paid
               ${money0(hisCut)}; the sales-person equivalents are ${money0(sp9)} and ${money0(sp5)}.`)}
            ${chk(false, "",
              `One thing the comparison does not hold equal, and it is worth saying before he does:
               our sales people are handed leads the company pays for. He brings the work as well as
               closing it, so the gap between 26.1% and 9% is not all margin — part of it is what we
               would otherwise spend to get the job.`)}
            ${chk(withContract === jobs.length,
              `All ${fmtN(jobs.length)} jobs have a digital contract, so every fee line is known`,
              `Only ${fmtN(withContract)} of ${fmtN(jobs.length)} jobs have a digital contract. On the other
               ${fmtN(jobs.length - withContract)} we cannot see a stairs or bulky fee even if one was charged,
               so the fee deduction above is a floor, not the full amount.`)}
          </div>

          <p class="rs-hint" style="margin-top:12px">For reference, a flat 30% of our price — the
            cap he already has, applied the way a salesperson would be paid — comes to
            <b>${money0(stdPay)}</b> (${pctS(stdPct)}) across all jobs and <b>${money0(oStd)}</b>
            (${pctS(oBill ? oStd / oBill : null)}) on the ${fmtN(overJobs.length)} over the cap.</p>
        </div>

        ${(refunds > 0 || claimsN > 0) ? `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Refunds and claims on his jobs</div></div>
          <p class="rs-hint">A refund is money that leaves after the job is closed. It is not part
            of the bill, and it is not ours alone to carry.</p>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>What</th><th class="num">Amount</th><th>Job</th></tr></thead>
            <tbody>
              <tr><td class="strong">Refunded to customers</td><td class="num">${money0(refunds)}</td>
                <td class="muted">${refunds > 0
                  ? esc(jobs.map(r => E(r)).filter(e => e && num(e["Refund $"]) > 0)
                        .map(e => e["Customer"] + " — " + (e["Refund Reason"] || "no reason recorded")).join(" · "))
                  : "none"}</td></tr>
              <tr><td class="strong">His share at his 30%</td>
                <td class="num">${money0(refHis)}</td>
                <td class="muted">the rate he is paid at, taken back the way a sales person's
                  commission is</td></tr>
              <tr><td class="strong">His share split by profit</td>
                <td class="num">${money0(refProfit)}</td>
                <td class="muted">the case-by-case rule below — ours to carry:
                  ${money0(refunds - refProfit)}</td></tr>
              <tr><td class="strong">Claims opened</td><td class="num">${fmtN(claimsN)}</td>
                <td class="muted">${claimsN > 0
                  ? esc(jobs.map(r => E(r)).filter(e => e && num(e["Claims"]) > 0)
                        .map(e => e["Customer"] + " — " + (e["Claim Reason"] || "—") + " (" + (e["Claim Status"] || "open") + ")").join(" · "))
                  : "none"}</td></tr>
            </tbody></table></div>
          <div class="cla-checks" style="margin-top:12px">
            ${chk(false, "",
              `THE RULE, going forward: a refund of any kind is handled case by case. We work out
               what each side actually made on that job and share the refund in the same proportion.
               Example: if we made $1,000 on the job and CL made $500, a $3,000 refund is $2,000
               from Zip to Zip and $1,000 from CL.`)}
          </div>
        </div>` : ""}` : `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">What he would have earned on our own rules</div></div>
          <p class="rs-hint">The economics mart has not been built yet — it lands on the next
            pipeline run, and this fills itself in then.</p>
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
      mountViews();

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
