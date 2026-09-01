/* LOGISTICS ▸ Crew Salaries — what every person on a truck was paid, and for what.
 *
 * Rebuilt from his "Crew Salaries" PBIX (2026-08-31), which had three pages — Forman,
 * Driver, Helper — each a person × month pivot of jobs, rate, hours, salary and tip. Three
 * pages because Power BI could not put three differently-shaped sources in one visual.
 *
 * ONE PAGE, ONE GRAIN. `mart_crew_salary` is a row per PERSON PER JOB with the role naming
 * the seat, so the same table answers every question his three pages did and the ones they
 * could not: rank everybody by pay regardless of role, see one man's whole year across all
 * three seats, compare what a foreman's crews cost.
 *
 * TIPS ARE NOT SALARY and are never folded into it silently. A helper on $17/h whose pay is
 * 40% tips is a different fact from one on $24/h, and the split is on every row and every
 * total. `Total Pay` exists for ranking; `Salary` and `Tip` exist so nobody has to guess.
 *
 * THE FOREMAN COLUMN IS THE JOB'S FOREMAN, on every row including drivers and helpers —
 * his PBIX slices the helper page by Forman List, because "what did this foreman's crews
 * cost" is a real question and it needs the foreman on the helper's row.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.mart_crew_salary) {
    // PAYLOAD CONTRACT: a column missing here never arrives, however well the page is written.
    RS.DATASETS.mart_crew_salary = {
      table: "mart_crew_salary",
      // `Total Bill`, `Move Type` and `Slot` are in the mart but NOT requested here: nothing
      // on this page reads them, and at 40k rows each unread column is ~0.5-1 MB of JSON the
      // browser parses and holds for nothing. The mart keeps them; the payload does not.
      cols: ["Unique Key", "Date", "Month", "Company", "Job No", "Request #", "Customer",
             "Moving Type", "Job Foreman", "Role", "Person",
             "Hours", "Rate", "Salary", "Tip", "Tip Company", "Tip Customer", "Total Pay",
             "Is Trip"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    };
  }
})();

registerPage({
  id: "crew-salaries",
  group: "logistics",
  title: "Crew Salaries",
  async render(host) {
    const num = RS.num, money = RS.money, fmtN = RS.fmtN;
    const m0 = v => (v == null || isNaN(v)) ? "—" : money(v, 0);
    const pct = v => (v == null || isNaN(v)) ? "—" : (v * 100).toFixed(0) + "%";
    const esc = RS.esc || (s => String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));

    if (!document.getElementById("crw-style")) {
      const st = document.createElement("style");
      st.id = "crw-style";
      st.textContent = [
        // Only what the kit cannot say. Everything else is .panel / .rs-table / .rs-kpis.
        ".crw-bar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 14px}",
        ".crw-in{font-family:inherit;background:var(--panel);border:1px solid var(--line);"
          + "border-radius:9px;color:var(--ink);padding:8px 12px;font-size:13px;outline:0;"
          + "transition:border-color .15s;min-width:0}",
        ".crw-in:focus{border-color:var(--brand)}",
        ".crw-count{font-size:12px;color:var(--faint);font-weight:600;margin-left:auto}",
        // the role a row belongs to, as a colour you learn once
        ".crw-role{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.05em;"
          + "text-transform:uppercase;padding:2px 7px;border-radius:5px;white-space:nowrap}",
        ".crw-role.foreman{background:var(--brand-bg,var(--panel-2));color:var(--brand)}",
        ".crw-role.driver{background:var(--pos-bg);color:var(--pos)}",
        ".crw-role.helper{background:var(--panel-2);color:var(--muted)}",
        // pay bar: salary solid, tip hatched on top, so the mix is visible without a legend
        ".crw-mix{display:flex;height:9px;border-radius:5px;overflow:hidden;background:var(--panel-2);"
          + "min-width:64px}",
        ".crw-mix i{display:block;height:100%}",
        // --pos resolves to --brand in this theme, so a wage/tip bar drawn in brand+pos is
        // ONE COLOUR and the split it exists to show is invisible. Tips are amber, which is
        // also what the Tips tile uses, so the same money is the same colour everywhere.
        ".crw-mix i.s{background:var(--brand)}",
        ".crw-mix i.t{background:var(--warn)}",
        ".crw-legend{display:flex;gap:14px;align-items:center;font-size:12px;color:var(--faint);"
          + "margin-top:8px}",
        ".crw-legend b{display:inline-block;width:9px;height:9px;border-radius:3px;margin-right:5px}",
        ".crw-legend .s b{background:var(--brand)} .crw-legend .t b{background:var(--warn)}",
        // the kit does not colour KPI values; these three classes are this page's own
        ".rs-kpis .kpi.pos .v{color:var(--pos)}",
        ".rs-kpis .kpi.warn .v{color:var(--warn)}",
        // the month matrix scrolls sideways on its own, never the page
        ".crw-mx{overflow-x:auto}",
        ".crw-mx table{min-width:max-content}",
        ".crw-mx td.m,.crw-mx th.m{text-align:right;font-variant-numeric:tabular-nums;"
          + "white-space:nowrap;padding-left:14px}",
        ".crw-mx tbody tr:hover{background:var(--panel-2)}",
        ".crw-nm{font-weight:700;cursor:pointer}",
        ".crw-nm:hover{color:var(--brand)}",
        // the person drawer
        ".crw-dr{position:fixed;inset:0 0 0 auto;width:min(640px,94vw);background:var(--panel);"
          + "border-left:1px solid var(--line);box-shadow:-18px 0 48px -28px rgba(0,0,0,.5);"
          + "z-index:60;display:flex;flex-direction:column;overflow:auto;padding:22px 24px 40px}",
        ".crw-back{position:fixed;inset:0;background:rgba(10,12,16,.34);z-index:59}",
        ".crw-drh{display:flex;align-items:flex-start;gap:12px;margin-bottom:6px}",
        ".crw-drh h2{margin:0;font-size:23px;letter-spacing:-.3px}",
        ".crw-x{margin-left:auto;border:0;background:transparent;color:var(--faint);cursor:pointer;"
          + "font-size:19px;line-height:1;padding:2px 6px}",
        ".crw-x:hover{color:var(--ink)}",
        ".crw-spark{display:flex;align-items:flex-end;gap:5px;height:56px;margin:12px 0 4px}",
        // a bar per month, capped: at six months a flex:1 bar is 200px wide and the trend
        // reads as a wall rather than a shape
        ".crw-spark i{flex:1 1 0;max-width:44px;background:var(--brand);border-radius:3px 3px 0 0;"
          + "min-height:3px;transition:opacity .12s}",
        ".crw-spark i:hover{opacity:.7}",
        ".crw-spark i.dim{background:var(--line-2)}",
        ".crw-trip{font-size:10.5px;font-weight:800;color:var(--blue);white-space:nowrap}",
        ".crw-pager{display:flex;gap:8px;align-items:center;justify-content:flex-end;"
          + "margin-top:12px;font-size:12.5px;color:var(--faint)}",
        ".crw-pager .rs-btn[disabled]{opacity:.4;pointer-events:none}",
      ].join("");
      document.head.appendChild(st);
    }

    host.innerHTML = `<div class="rs-page-head"><h1>Crew Salaries</h1></div>
      <div class="rs-loading" style="padding:22px">Reading the payroll…</div>`;

    const all = await RS.load("mart_crew_salary");
    if (!all || !all.length) {
      host.innerHTML = `<div class="rs-page-head"><h1>Crew Salaries</h1></div>
        <div class="panel">The crew salary mart has not been built yet — it lands on the next
          pipeline run.</div>`;
      return;
    }

    const months = [...new Set(all.map(r => r.Month).filter(Boolean))].sort();
    const companies = [...new Set(all.map(r => r.Company).filter(Boolean))].sort();
    const foremen = [...new Set(all.map(r => r["Job Foreman"]).filter(Boolean))].sort();
    const types = [...new Set(all.map(r => r["Moving Type"]).filter(Boolean))].sort();

    // A payroll page opens on the LAST COMPLETE MONTH, not on all time: the question is
    // always "what did we pay this month", and 3.6 years of rows answers a different one.
    /* Opens on the LAST 3 MONTHS (his ask, 2026-09-01 -- was 6) and on Zip to Zip:
       that is the company he reads payroll for; Tuji stays one click away. */
    const S = { role: "", from: months[Math.max(0, months.length - 3)] || "", to: months[months.length - 1] || "",
                co: companies.includes("Zip to Zip") ? "Zip to Zip" : "", fm: "", type: "",
                q: "", sort: "pay", dir: -1, person: null,
                page: 0, pageSize: 50, showAll: false };
    let qTimer = null;

    paint();

    function rows() {
      const q = S.q.trim().toLowerCase();
      return all.filter(r => {
        if (S.role && r.Role !== S.role) return false;
        if (S.from && (r.Month || "") < S.from) return false;
        if (S.to && (r.Month || "") > S.to) return false;
        if (S.co && r.Company !== S.co) return false;
        if (S.fm && r["Job Foreman"] !== S.fm) return false;
        if (S.type && r["Moving Type"] !== S.type) return false;
        if (q && !String(r.Person || "").toLowerCase().includes(q)) return false;
        return true;
      });
    }

    /* One person, folded up. Rate is HOURS-WEIGHTED, never a plain average of rates: a man
       who did one short job at $25 and forty long ones at $17 is on $17, and the mean of the
       two numbers would say otherwise. */
    function byPerson(rs) {
      const m = new Map();
      rs.forEach(r => {
        const k = r.Person + "|" + r.Role;
        let p = m.get(k);
        if (!p) m.set(k, p = { person: r.Person, role: r.Role, jobs: 0, hours: 0, salary: 0,
                              tip: 0, tipCo: 0, tipCu: 0, pay: 0, rateHours: 0, rateSum: 0,
                              trips: 0, months: new Set() });
        if (num(r["Is Trip"])) p.trips++; else p.jobs++;
        const h = num(r.Hours) || 0, rt = num(r.Rate) || 0;
        // a trip leg pays a DAY rate (260/day, no hours) — it must never touch the $/hr
        if (!num(r["Is Trip"]) && h > 0 && rt > 0) { p.rateHours += h; p.rateSum += rt * h; }
        p.hours += h;
        p.salary += num(r.Salary) || 0;
        p.tip += num(r.Tip) || 0;
        p.tipCo += num(r["Tip Company"]) || 0;
        p.tipCu += num(r["Tip Customer"]) || 0;
        p.pay += num(r["Total Pay"]) || 0;
        if (r.Month) p.months.add(r.Month);
      });
      return [...m.values()].map(p => ({ ...p,
        rate: p.rateHours ? p.rateSum / p.rateHours : null,
        perJob: (p.jobs + p.trips) ? p.pay / (p.jobs + p.trips) : null,
        tipShare: p.pay ? p.tip / p.pay : null }));
    }

    function paint() {
      const rs = rows();
      const people = byPerson(rs);
      const sum = f => rs.reduce((a, r) => a + (num(f(r)) || 0), 0);
      const salary = sum(r => r.Salary), tip = sum(r => r.Tip), pay = salary + tip;
      const hours = sum(r => r.Hours);
      const jobs = new Set(rs.filter(r => !num(r["Is Trip"])).map(r => r["Unique Key"])).size;
      const tripLegs = new Set(rs.filter(r => num(r["Is Trip"])).map(r => r["Unique Key"])).size;

      const key = { pay: p => p.pay, salary: p => p.salary, tip: p => p.tip,
                    tipCo: p => p.tipCo, tipCu: p => p.tipCu, jobs: p => p.jobs,
                    hours: p => p.hours, rate: p => p.rate || 0, perJob: p => p.perJob || 0,
                    person: p => p.person }[S.sort] || (p => p.pay);
      const sorted = people.slice().sort((a, b) => {
        const x = key(a), y = key(b);
        return (typeof x === "string" ? String(x).localeCompare(String(y)) : x - y) * S.dir;
      });

      const roleCls = r => "crw-role " + String(r || "").toLowerCase();
      const mix = p => {
        const t = p.pay || 1;
        return `<span class="crw-mix" title="${m0(p.salary)} salary · ${m0(p.tip)} tips">
          <i class="s" style="width:${p.salary / t * 100}%"></i>
          <i class="t" style="width:${p.tip / t * 100}%"></i></span>`;
      };

      const th = (k, label, cls) => `<th class="${cls || "num"}" data-sort="${k}"
        style="cursor:pointer" title="Sort by ${label}">${label}${S.sort === k
          ? (S.dir < 0 ? " ↓" : " ↑") : ""}</th>`;

      // per-role totals, for the mix panel
      const roles = ["Foreman", "Driver", "Helper"].map(role => {
        const rr = rs.filter(r => r.Role === role);
        const s = rr.reduce((a, r) => a + (num(r.Salary) || 0), 0);
        const t = rr.reduce((a, r) => a + (num(r.Tip) || 0), 0);
        return { role, n: new Set(rr.map(r => r.Person)).size, jobs: rr.length,
                 salary: s, tip: t, pay: s + t };
      }).filter(r => r.jobs);
      const maxRolePay = Math.max(1, ...roles.map(r => r.pay));

      // month trend across the filtered set
      const byMonth = {};
      rs.forEach(r => {
        const k = r.Month || "—";
        const b = byMonth[k] = byMonth[k] || { salary: 0, tip: 0, people: new Set() };
        b.salary += num(r.Salary) || 0; b.tip += num(r.Tip) || 0; b.people.add(r.Person);
      });
      const mKeys = Object.keys(byMonth).sort();

      /* PAGINATION (his ask, 2026-09-01): 300 rows of markup was the slow part of the
         paint -- 50 at a time, with Show all for the person who wants the whole roster. */
      const pages = S.showAll ? 1 : Math.max(1, Math.ceil(sorted.length / S.pageSize));
      S.page = Math.min(S.page, pages - 1);
      const pageRows = S.showAll ? sorted
        : sorted.slice(S.page * S.pageSize, (S.page + 1) * S.pageSize);

      const kpi = (l, v, s, cls) => `<div class="kpi ${cls || ""}">
        <div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;

      host.innerHTML = `
        <div class="rs-page-head"><h1>Crew Salaries</h1>
          <p>Every person who worked a truck and what they were paid for it — foreman, driver
             and helper in one place, with tips kept separate from wage.</p></div>

        <div class="crw-bar" id="crwBar"></div>

        <div class="rs-kpis" style="--kpi-cols:6">
          ${kpi("People paid", fmtN(people.length),
                (S.role || "all roles") + " · " + fmtN(mKeys.length) + " month" + (mKeys.length === 1 ? "" : "s"))}
          ${kpi("Jobs covered", fmtN(jobs), fmtN(rs.length) + " person-jobs"
                + (tripLegs ? " · +" + fmtN(tripLegs) + " trip leg" + (tripLegs === 1 ? "" : "s") : ""))}
          ${kpi("Total paid", m0(pay), m0(pay / (jobs || 1)) + " a job")}
          ${kpi("Wage", m0(salary), pct(pay ? salary / pay : null) + " of it", "pos")}
          ${kpi("Tips", m0(tip), m0(rs.reduce((a, r) => a + (num(r["Tip Customer"]) || 0), 0))
                + " customers · " + m0(rs.reduce((a, r) => a + (num(r["Tip Company"]) || 0), 0))
                + " company", "warn")}
          ${kpi("Hours", fmtN(Math.round(hours)),
                hours ? m0(salary / hours) + " a paid hour" : "—")}
        </div>

        ${roles.length > 1 ? `
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Where the money goes</div></div>
          <div class="rs-tablewrap"><table class="rs-table">
            <thead><tr><th>Seat</th><th class="num">People</th><th class="num">Person-jobs</th>
              <th class="num">Wage</th><th class="num">Tips</th><th class="num">Total</th>
              <th style="width:200px">Share</th></tr></thead>
            <tbody>${roles.map(r => `<tr>
              <td><span class="${roleCls(r.role)}">${esc(r.role)}</span></td>
              <td class="num">${fmtN(r.n)}</td><td class="num">${fmtN(r.jobs)}</td>
              <td class="num">${m0(r.salary)}</td><td class="num">${m0(r.tip)}</td>
              <td class="num strong">${m0(r.pay)}</td>
              <td><span class="crw-mix" style="width:${r.pay / maxRolePay * 100}%">
                <i class="s" style="width:${r.salary / (r.pay || 1) * 100}%"></i>
                <i class="t" style="width:${r.tip / (r.pay || 1) * 100}%"></i></span></td></tr>`).join("")}
            </tbody></table></div>
          <div class="crw-legend"><span class="s"><b></b>wage</span><span class="t"><b></b>tips</span></div>
        </div>` : ""}

        <div class="panel">
          <div class="panel-head"><div class="panel-title">Every person</div>
            <div class="rs-spacer"></div>
            <button class="rs-btn" id="crwCsv">Download CSV</button></div>
          <p class="rs-hint">Click a name for their months and jobs. <b>Rate</b> is weighted by
            hours, so one short job at an unusual rate cannot move it.</p>
          <div class="rs-tablewrap crw-mx"><table class="rs-table">
            <thead><tr>${th("person", "Person", "")}<th>Seat</th>
              ${th("jobs", "Jobs")}${th("hours", "Hours")}${th("rate", "Rate")}
              ${th("salary", "Wage")}${th("tipCu", "Tips · cust")}${th("tipCo", "Tips · co")}${th("pay", "Total pay")}
              ${th("perJob", "Per job")}<th style="width:140px">Mix</th></tr></thead>
            <tbody>${pageRows.map(p => `<tr>
              <td class="crw-nm" data-person="${esc(p.person)}" data-role="${esc(p.role)}">${esc(p.person)}</td>
              <td><span class="${roleCls(p.role)}">${esc(p.role)}</span></td>
              <td class="num">${fmtN(p.jobs)}${p.trips
                ? ' <span class="crw-trip" title="trip legs — day-rate, not jobs">+' + p.trips + "t</span>" : ""}</td>
              <td class="num">${p.hours ? fmtN(Math.round(p.hours)) : "—"}</td>
              <td class="num">${p.rate ? "$" + p.rate.toFixed(2) : "—"}</td>
              <td class="num">${m0(p.salary)}</td>
              <td class="num">${m0(p.tipCu)}</td>
              <td class="num muted">${p.tipCo ? m0(p.tipCo) : "—"}</td>
              <td class="num strong">${m0(p.pay)}</td>
              <td class="num muted">${m0(p.perJob)}</td>
              <td>${mix(p)}</td></tr>`).join("")}
            </tbody>
            <tfoot><tr><td colspan="2">${fmtN(sorted.length)} people</td>
              <td class="num">${fmtN(rs.length)}</td>
              <td class="num">${fmtN(Math.round(hours))}</td><td></td>
              <td class="num">${m0(salary)}</td>
              <td class="num">${m0(rs.reduce((a, r) => a + (num(r["Tip Customer"]) || 0), 0))}</td>
              <td class="num">${m0(rs.reduce((a, r) => a + (num(r["Tip Company"]) || 0), 0))}</td>
              <td class="num">${m0(pay)}</td><td></td><td></td></tr></tfoot>
          </table></div>
          <div class="crw-pager">
            ${S.showAll
              ? `<span>all ${fmtN(sorted.length)} people</span>
                 <button class="rs-btn" data-pg="pages">Back to pages</button>`
              : `<span>${fmtN(S.page * S.pageSize + 1)}–${fmtN(Math.min(sorted.length,
                    (S.page + 1) * S.pageSize))} of ${fmtN(sorted.length)}</span>
                 <button class="rs-btn" data-pg="prev" ${S.page === 0 ? "disabled" : ""}>‹ Prev</button>
                 <button class="rs-btn" data-pg="next" ${S.page >= pages - 1 ? "disabled" : ""}>Next ›</button>
                 <button class="rs-btn" data-pg="all">Show all</button>`}
          </div>
        </div>`;

      mountBar();
      host.querySelectorAll("[data-sort]").forEach(el => {
        el.onclick = () => {
          const k = el.dataset.sort;
          if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === "person" ? 1 : -1; }
          S.page = 0;
          paint();
        };
      });
      host.querySelectorAll("[data-pg]").forEach(el => {
        el.onclick = () => {
          const k = el.dataset.pg;
          if (k === "prev") S.page--;
          else if (k === "next") S.page++;
          else if (k === "all") S.showAll = true;
          else { S.showAll = false; S.page = 0; }
          paint();
        };
      });
      host.querySelectorAll(".crw-nm").forEach(el => {
        el.onclick = () => openPerson(el.dataset.person, el.dataset.role);
      });
      const csv = host.querySelector("#crwCsv");
      if (csv) csv.onclick = () => downloadCsv(sorted);
    }

    function mountBar() {
      const bar = host.querySelector("#crwBar");
      if (!bar) return;
      const seg = document.createElement("div");
      seg.className = "rs-seg";
      [["", "All seats"], ["Foreman", "Foremen"], ["Driver", "Drivers"], ["Helper", "Helpers"]]
        .forEach(([v, l]) => {
          const b = document.createElement("button");
          b.textContent = l;
          if (S.role === v) b.className = "on";
          b.onclick = () => { if (S.role !== v) { S.role = v; S.page = 0; paint(); } };
          seg.appendChild(b);
        });
      bar.appendChild(seg);

      const mLabel = m => m ? RS.monthName(+m.slice(5, 7)) + " " + m.slice(0, 4) : "";
      /* The SAME period control the other local pages wear (Area Plan, Truck Economics):
         preset chips + From/To month selects, instead of a bare pair of dropdowns. */
      const last = months[months.length - 1] || "";
      const back = n => months[Math.max(0, months.length - n)] || last;
      const seg2 = document.createElement("div");
      seg2.className = "rs-seg";
      [["Last month", last, last],
       ["Last 3 months", back(3), last],
       ["Last 6 months", back(6), last],
       ["This year", (last || "").slice(0, 4) + "-01", last],
       ["All time", months[0] || "", last]]
        .forEach(([l, f, t]) => {
          const b = document.createElement("button");
          b.textContent = l;
          if (S.from === f && S.to === t) b.className = "on";
          b.onclick = () => { S.from = f; S.to = t; S.page = 0; paint(); };
          seg2.appendChild(b);
        });
      const segWrap = document.createElement("div");
      segWrap.className = "rs-fld";
      segWrap.innerHTML = "<span>Period</span>";
      segWrap.appendChild(seg2);
      bar.appendChild(segWrap);
      RSC.localSelect(bar, { label: "From", required: true,
        values: months.map(m => ({ v: m, l: mLabel(m) })), value: S.from,
        onChange: v => { S.from = v; if (S.to < S.from) S.to = S.from; S.page = 0; paint(); } });
      RSC.localSelect(bar, { label: "To", required: true,
        values: months.map(m => ({ v: m, l: mLabel(m) })), value: S.to,
        onChange: v => { S.to = v; if (S.from > S.to) S.from = S.to; S.page = 0; paint(); } });
      RSC.localSelect(bar, { label: "Company", values: companies, value: S.co, allLabel: "All companies",
        onChange: v => { S.co = v; S.page = 0; paint(); } });
      RSC.localSelect(bar, { label: "Foreman on the job", values: foremen, value: S.fm,
        allLabel: "Any foreman", onChange: v => { S.fm = v; S.page = 0; paint(); } });
      RSC.localSelect(bar, { label: "Move type", values: types, value: S.type, allLabel: "All types",
        onChange: v => { S.type = v; S.page = 0; paint(); } });

      const q = document.createElement("input");
      q.className = "crw-in"; q.placeholder = "find a person…"; q.value = S.q;
      q.style.flex = "0 1 190px";
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S._focus = 1; S.page = 0; paint(); }, 300); };
      bar.appendChild(q);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    /* ONE PERSON. Their months, their rate over time, and the jobs behind it — because the
       first question after "he earned $38,000" is always "on what?". */
    function openPerson(person, role) {
      const rs = rows().filter(r => r.Person === person && r.Role === role);
      if (!rs.length) return;
      const byM = {};
      rs.forEach(r => {
        const b = byM[r.Month] = byM[r.Month] || { jobs: 0, hours: 0, salary: 0, tip: 0 };
        b.jobs++; b.hours += num(r.Hours) || 0;
        b.salary += num(r.Salary) || 0; b.tip += num(r.Tip) || 0;
      });
      const mk = Object.keys(byM).sort();
      const tot = rs.reduce((a, r) => a + (num(r["Total Pay"]) || 0), 0);
      const sal = rs.reduce((a, r) => a + (num(r.Salary) || 0), 0);
      const tp = tot - sal;
      const mx = Math.max(1, ...mk.map(k => byM[k].salary + byM[k].tip));

      const back = document.createElement("div"); back.className = "crw-back";
      const dr = document.createElement("div"); dr.className = "crw-dr";
      dr.innerHTML = `
        <div class="crw-drh">
          <div><h2>${esc(person)}</h2>
            <div class="rs-hint" style="margin:4px 0 0">
              <span class="crw-role ${String(role).toLowerCase()}">${esc(role)}</span>
              · ${fmtN(rs.length)} job${rs.length === 1 ? "" : "s"} · ${m0(tot)} paid
              (${m0(sal)} wage + ${m0(tp)} tips)</div></div>
          <button class="crw-x" title="Close">✕</button></div>

        <div class="crw-spark">${mk.map(k => {
          const b = byM[k];
          return `<i style="height:${Math.max(2, (b.salary + b.tip) / mx * 46)}px"
            title="${esc(k)} · ${m0(b.salary + b.tip)} · ${fmtN(b.jobs)} jobs"></i>`;
        }).join("")}</div>
        <p class="rs-hint">${esc(mk[0] || "")} — ${esc(mk[mk.length - 1] || "")}</p>

        <div class="rs-tablewrap" style="margin-top:14px"><table class="rs-table">
          <thead><tr><th>Month</th><th class="num">Jobs</th><th class="num">Hours</th>
            <th class="num">Wage</th><th class="num">Tips</th><th class="num">Total</th></tr></thead>
          <tbody>${mk.map(k => { const b = byM[k]; return `<tr>
            <td class="strong">${esc(k)}</td><td class="num">${fmtN(b.jobs)}</td>
            <td class="num">${b.hours ? fmtN(Math.round(b.hours)) : "—"}</td>
            <td class="num">${m0(b.salary)}</td><td class="num">${m0(b.tip)}</td>
            <td class="num strong">${m0(b.salary + b.tip)}</td></tr>`; }).join("")}
          </tbody></table></div>

        <div class="rs-tablewrap" style="margin-top:16px"><table class="rs-table">
          <thead><tr><th>Date</th><th>Job</th><th>Customer</th><th class="num">Hours</th>
            <th class="num">Rate</th><th class="num">Wage</th><th class="num">Tip</th></tr></thead>
          <tbody>${rs.slice().sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")))
            .slice(0, 120).map(r => `<tr>
              <td class="nowrap">${esc(String(r.Date || "").slice(0, 10))}</td>
              <td>${num(r["Is Trip"]) ? '<span class="rs-pill mute">Trip</span> ' : ""}${esc(r["Job No"] || r["Request #"] || "—")}</td>
              <td class="muted">${esc(r.Customer || "—")}</td>
              <td class="num">${r.Hours ? num(r.Hours) : "—"}</td>
              <td class="num">${r.Rate ? "$" + num(r.Rate).toFixed(2) : "—"}</td>
              <td class="num">${m0(num(r.Salary))}</td>
              <td class="num">${m0(num(r.Tip))}</td></tr>`).join("")}
          </tbody></table></div>
        ${rs.length > 120 ? `<p class="rs-hint">Showing the 120 most recent of ${fmtN(rs.length)}.</p>` : ""}`;

      const close = () => { dr.remove(); back.remove(); document.removeEventListener("keydown", onKey); };
      const onKey = e => { if (e.key === "Escape") close(); };
      back.onclick = close;
      dr.querySelector(".crw-x").onclick = close;
      document.addEventListener("keydown", onKey);
      document.body.appendChild(back);
      document.body.appendChild(dr);
    }

    function downloadCsv(people) {
      const head = ["Person", "Seat", "Jobs", "Trip Legs", "Hours", "Rate", "Wage",
                    "Tips Customer", "Tips Company", "Total Pay", "Per job"];
      // formula-injection guard: a leading =+-@ becomes text, the referral-list rule
      const cell = v => {
        let s = String(v == null ? "" : v);
        if (/^[=+\-@]/.test(s)) s = " " + s;
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const lines = [head.join(",")].concat(people.map(p => [p.person, p.role, p.jobs,
        p.trips || "",
        p.hours ? Math.round(p.hours) : "", p.rate ? p.rate.toFixed(2) : "",
        Math.round(p.salary), Math.round(p.tipCu), Math.round(p.tipCo), Math.round(p.pay),
        p.perJob ? Math.round(p.perJob) : ""].map(cell).join(",")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "crew-salaries-" + (S.from || "") + "-to-" + (S.to || "") + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }
  },
});
