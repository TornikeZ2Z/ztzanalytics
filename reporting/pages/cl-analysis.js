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
 * are kept as two conditions anyway, and the page says so when they stop agreeing: the day
 * somebody else sells a CL job, or Peter sells something that is not CL, silently folding them
 * together would hide it.
 *
 * "CL" IS NOT "Craiglist". The warehouse carries a separate `Craiglist` source belonging to
 * other salespeople entirely. Matching on "craig" would pull in work that is nothing to do with
 * this partner.
 */
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

    // Panels, tables, pills and KPI tiles are THE COMPONENT KIT. Only the assumption strip is
    // page-specific — and the KPI colour classes, which the kit does NOT define: passing
    // "warn" to a tile without this renders identically to a plain one.
    if (!document.getElementById("cla-style")) {
      const st = document.createElement("style");
      st.id = "cla-style";
      st.textContent = [
        ".rs-kpis .kpi.warn .v{color:var(--warn)}",
        ".rs-kpis .kpi.pos .v{color:var(--pos)}",
        ".cla-checks{display:flex;flex-direction:column;gap:7px;margin-top:4px}",
        ".cla-chk{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.5}",
        ".cla-chk span{flex:0 0 18px;height:18px;border-radius:999px;display:grid;"
          + "place-items:center;font-size:11px;font-weight:800;margin-top:1px}",
        ".cla-chk.ok span{background:var(--pos-bg);color:var(--pos)}",
        ".cla-chk.ok div{color:var(--muted)}",
        ".cla-chk.bad span{background:var(--warn-bg);color:var(--warn)}",
        ".cla-chk.bad div{color:var(--ink);font-weight:650}",
        // a cut over the agreed ceiling: the number itself carries the warning, so the row
        // does not need a whole colour and the table stays readable
        ".cla-over{color:var(--neg)!important;font-weight:800}",
        ".cla-of{color:var(--faint);font-weight:400;font-size:11px}",
        ".cla-foot{display:flex;align-items:center;gap:12px;padding:9px 2px 2px;"
          + "font-size:12px;color:var(--muted)}",
        ".cla-foot .rs-btn{padding:4px 10px;font-size:12px}",
        ".cla-foot > button[data-all]{margin-left:auto}",
        ".cla-pg{display:inline-flex;align-items:center;gap:8px}",
        ".cla-pg b{font-weight:700;color:var(--ink);min-width:52px;text-align:center}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>CL Analysis</h1>
      <p>The jobs our <b>CL</b> partner brings us — sold under <b>Peter Montanaro</b>. He takes
         the deposit as his cut, and that cut is <b>already paid as his sales salary</b>, so the
         profit below is net of it and must not be reduced again.</p></div>
      <div class="rs-loading" style="padding:22px">Reading the closings…</div>`;

    const all = await RS.load("closing");
    const rows = RS.filtered("closing", all).filter(r => r["Record Source"] === "closing");

    const isCL = r => String(r["Source"] || "").trim().toUpperCase() === "CL";
    const isPeter = r => /peter/i.test(String(r["Sales Person"] || ""));
    const jobs = rows.filter(r => isCL(r) || isPeter(r));

    if (!jobs.length) {
      host.innerHTML = host.innerHTML.replace(/<div class="rs-loading[\s\S]*?<\/div>/,
        `<div class="panel">No CL jobs in the current date and company filter.</div>`);
      return;
    }

    // ---- the two identities, checked rather than assumed
    const clOnly = jobs.filter(r => isCL(r) && !isPeter(r));
    const peterOnly = jobs.filter(r => isPeter(r) && !isCL(r));

    /* THE CAP. His ruling: the cut is 30% at most. It is a term of the arrangement rather
       than anything the data enforces, so the page measures against it instead of assuming it
       holds — and it does not hold. Every job carries how far over it went, and the money
       above the cap is added up, because that total is the only version of this a partner
       conversation can actually be had about. */
    const CAP = 0.30;

    // ---- his cut, and whether the two records of it still agree
    const cut = r => num(r["Sales 1 Salary"]) || 0;
    const dep = r => num(r["Deposit"]) || 0;
    const mismatch = jobs.filter(r => Math.abs(cut(r) - dep(r)) > 1);

    const cutPct = r => {
      const b = num(r["Total Bill"]) || 0;
      return b > 0 ? cut(r) / b : null;
    };
    const overBy = r => {
      const b = num(r["Total Bill"]) || 0;
      return b > 0 ? Math.max(0, cut(r) - CAP * b) : 0;
    };
    const overCap = jobs.filter(r => (cutPct(r) || 0) > CAP);

    const sum = (f) => jobs.reduce((a, r) => a + (f(r) || 0), 0);
    const revenue = sum(r => num(r["Total Bill"]) + (num(r["Extra Bill From Trips"]) || 0));
    const hisCut = sum(cut);
    const profit = sum(r => num(r["Profit per Job"]));
    const expense = sum(r => num(r["Total Expense"]));
    const overPaid = sum(overBy);
    const avgProfit = jobs.length ? profit / jobs.length : null;

    /* HIS SHARE OF OUR WORK, which needs the jobs he did NOT bring. `rows` is every closing
       in the current filter, so the denominator moves with the date picker exactly like the
       numerator — a share computed against a fixed total would drift the moment anybody
       narrowed the range. */
    const allByMonth = {};
    rows.forEach(r => {
      const m = String(r["Date"] || "").slice(0, 7);
      if (m) allByMonth[m] = (allByMonth[m] || 0) + 1;
    });

    const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ""}">
      <div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;

    // ---- by month
    const byMonth = {};
    jobs.forEach(r => {
      const m = String(r["Date"] || "").slice(0, 7) || "—";
      const b = byMonth[m] = byMonth[m] || { n: 0, rev: 0, cut: 0, prof: 0, over: 0, overAmt: 0 };
      b.n++; b.rev += num(r["Total Bill"]) || 0; b.cut += cut(r);
      b.prof += num(r["Profit per Job"]) || 0;
      if ((cutPct(r) || 0) > CAP) { b.over++; b.overAmt += overBy(r); }
    });
    const months = Object.keys(byMonth).sort();

    const monthRows = months.map(m => {
      const b = byMonth[m];
      const share = allByMonth[m] ? b.n / allByMonth[m] : null;
      const cp = b.rev ? b.cut / b.rev : null;
      return `<tr><td class="strong">${esc(m)}</td>
        <td class="num">${fmtN(b.n)}</td>
        <td class="num">${pctS(share)}<span class="cla-of"> of ${fmtN(allByMonth[m] || 0)}</span></td>
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

    // ---- every job, newest first
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

    const overRowsHtml = overCap.slice()
      .sort((a, b) => (cutPct(b) || 0) - (cutPct(a) || 0)).map(r => `<tr>
        <td class="nowrap">${esc(String(r["Date"] || "").slice(0, 10))}</td>
        <td class="strong">${esc(r["Job No"] || r["Request #"] || "—")}</td>
        <td>${esc(r["Customer"] || "—")}</td>
        <td class="num">${money0(num(r["Total Bill"]))}</td>
        <td class="num">${money0(cut(r))}</td>
        <td class="num cla-over">${pctS(cutPct(r))}</td>
        <td class="num">${money0(overBy(r))}</td></tr>`);

    host.innerHTML = `
      <div class="rs-page-head"><h1>CL Analysis</h1>
        <p>The jobs our <b>CL</b> partner brings us — sold under <b>Peter Montanaro</b>. He takes
           the deposit as his cut, and that cut is <b>already paid as his sales salary</b> and
           already inside job expenses, so the profit below is <b>net of it</b> and is not
           reduced again.</p></div>

      <div class="rs-kpis" style="--kpi-cols:6">
        ${kpi("Jobs he brought", fmtN(jobs.length),
              months.length + (months.length === 1 ? " month" : " months"))}
        ${kpi("Revenue", money0(revenue), "billed on these jobs")}
        ${kpi("His cut", money0(hisCut), "paid as sales salary", "warn")}
        ${kpi("Cut of revenue", pctS(revenue ? hisCut / revenue : null),
              "the deal says 30% at most")}
        ${kpi("Over the 30% cap", fmtN(overCap.length),
              overCap.length ? money0(overPaid) + " paid above it" : "none",
              overCap.length ? "neg" : "pos")}
        ${kpi("Profit to us", money0(profit),
              "already net of his cut · " + money0(avgProfit) + " a job", "pos")}
      </div>

      <div id="clTrend"></div>

      <div class="panel">
        <div class="panel-head"><div class="panel-title">Is the picture still what we think it is?</div></div>
        <p class="rs-hint">Three assumptions this page rests on. Each is re-checked on every
          load rather than trusted, because all three are true today and any of them could stop
          being true without anybody noticing.</p>
        <div class="cla-checks">
          ${chk(mismatch.length === 0,
              `His cut and the deposit agree on all ${fmtN(jobs.length)} jobs`,
              `${fmtN(mismatch.length)} job(s) where the sales salary and the deposit differ by more than $1 — they are flagged in the table below, and on those the two records of his cut disagree`)}
          ${chk(clOnly.length === 0,
              "Every CL job was sold by Peter",
              `${fmtN(clOnly.length)} CL job(s) sold by somebody else — their sales salary is not this partner's cut`)}
          ${chk(peterOnly.length === 0,
              "Every one of Peter's jobs came from CL",
              `${fmtN(peterOnly.length)} Peter job(s) from another source — included here, but they are not partner-sourced work`)}
        </div>
      </div>

      <div class="panel">
        <div class="panel-head"><div class="panel-title">By month</div></div>
        <p class="rs-hint">How much work he brings us, and what it costs. <b>Share of our
          jobs</b> is his jobs against every closing in the same filter, so it moves with the
          date picker rather than against a fixed total.</p>
        <div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Month</th><th class="num">Jobs</th>
            <th class="num">Share of our jobs</th><th class="num">Revenue</th>
            <th class="num">His cut</th><th class="num">Cut %</th>
            <th class="num">Over cap</th>
            <th class="num">Profit</th><th class="num">Per job</th>
            <th class="num">Margin</th></tr></thead>
          <tbody>${monthRows}</tbody></table></div>
      </div>

      ${overCap.length ? `
      <div class="panel">
        <div class="panel-head"><div class="panel-title">Over the 30% cap</div>
          <div class="rs-spacer"></div>
          <span class="rs-pill bad">${fmtN(overCap.length)} of ${fmtN(jobs.length)} jobs
            \u00b7 ${money0(overPaid)} above the cap</span></div>
        <p class="rs-hint">The deal is 30% at most. These jobs paid more than that, worst
          first, with how much each one went over. The total is what a conversation with him
          would actually be about.</p>
        <div class="rs-tablewrap" id="clOver"><table class="rs-table">
          <thead><tr><th>Date</th><th>Job</th><th>Customer</th><th class="num">Revenue</th>
            <th class="num">His cut</th><th class="num">Cut %</th>
            <th class="num">Over by</th></tr></thead>
          <tbody></tbody>
        </table></div>
        <div class="cla-foot" data-foot></div>
      </div>` : ""}

      <div class="panel">
        <div class="panel-head"><div class="panel-title">Every job he has given us</div>
          <div class="rs-spacer"></div>
          <button class="rs-btn" id="clCsv">Download CSV</button></div>
        <div class="rs-tablewrap" id="clJobs"><table class="rs-table">
          <thead><tr><th>Date</th><th>Job</th><th>Customer</th><th>Type</th><th>Size</th>
            <th>State</th><th class="num">Revenue</th><th class="num">His cut</th>
            <th class="num">Cut %</th><th class="num">Over cap</th>
            <th class="num">Foreman $</th><th class="num">Materials</th>
            <th class="num">Expenses</th><th class="num">Profit</th><th class="num">Margin</th>
            <th>Foreman</th></tr></thead>
          <tbody></tbody></table></div>
        <div class="cla-foot" data-foot></div>
      </div>`;

    paginate("clJobs", jobRowsHtml, 25);
    paginate("clOver", overRowsHtml, 15);

    /* PROFIT PER JOB, MONTH BY MONTH — the trend he asked for. Bars are what we keep on an
       average job; the line is his cut as a share of the bill, with the 30% cap drawn across
       it, because the two only mean anything read together: a month can look profitable per
       job and still be one where he took more than the deal allows. */
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
        // RSC.table takes COLUMN OBJECTS and ROW OBJECTS, plus an optional totals row —
        // not parallel arrays. Same shape as branch-owner.js, so the two read alike.
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
            pctv: revenue ? hisCut / revenue : null });
      },
    });

    /* PAGINATION. A hundred and eight rows in one scroll is a wall, and the two long tables
       here are the ones a reader actually works through. Rows are rendered from an array of
       row-HTML rather than re-derived per page, so paging costs nothing and "Show all" stays
       available for anybody who wants to search the lot with the browser's own find. */
    function paginate(mountId, rowsHtml, per) {
      const mount = document.getElementById(mountId);
      if (!mount) return;
      const tbody = mount.querySelector("tbody");
      // THE FOOTER IS A SIBLING OF THE TABLE WRAPPER, not a child of it — it has to sit
      // outside the horizontally-scrolling box or it scrolls away with the widest column.
      // Looking for it inside the mount found nothing and silently drew no rows at all.
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
        foot.innerHTML = `<span>${fmtN(from)}\u2013${fmtN(to)} of ${fmtN(rowsHtml.length)}</span>`
          + (all ? "" : `<span class="cla-pg">
               <button class="rs-btn" data-prev ${page === 0 ? "disabled" : ""}>\u2039</button>
               <b>${page + 1} / ${pages}</b>
               <button class="rs-btn" data-next ${page >= pages - 1 ? "disabled" : ""}>\u203a</button>
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

    const csv = host.querySelector("#clCsv");
    if (csv) csv.onclick = () => {
      const cols = ["Date", "Job No", "Customer", "Move Type", "Size of Move", "State",
        "Revenue", "His Cut (sales salary)", "Deposit", "Cut %", "Foreman $", "Materials",
        "Total Expense", "Profit", "Margin", "Foreman"];
      const cell = x => {
        let s = String(x == null ? "" : x);
        // a value opening as a live formula executes in Excel; finance opens these in Excel
        if (/^[=+\-@]/.test(s)) s = " " + s;
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
  },
});
