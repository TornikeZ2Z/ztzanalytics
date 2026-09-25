/* FINANCIAL ▸ Salaries — what the closing sheet pays through its three salesperson slots, by role.
 *
 * Built 2026-09-24 for the person who pays people (Gvantsa, who holds Financial): one page with
 * estimator, salesperson and branch-owner pay side by side. The closing sheet's SP 1-3 salary
 * columns are the only record of that pay, and they pay five kinds of payee at once. So the page
 * reads ONE mart, `mart_salaries` (src/curated.py), a row per SP slot per closing with exactly one
 * Role, and splits it into three tabs:
 *
 *   Estimator (default)  estimators' slots, the $0 ones included (39 of the 92 in 2025-26), plus
 *                        Kolbaia's smaller slot where he holds two ($906 in 2026). What the DC and
 *                        the calendar say about the estimator rides along as evidence; a DC
 *                        estimator whom no slot names is a 'DC only' row with no amount.
 *   Sales Person         reps typed Sales Rep, AND the CL partner (Peter Montanaro) and Yelp Team,
 *                        paid through the same slots -- "they kinda are sales persons" (his ruling
 *                        25 Sep 2026). Their rows keep their own Role and carry a pill saying so.
 *                        Tab order since that ruling: Sales Person, Estimator, Branch Owner.
 *   Branch Owner         his cut only, so it equals His Cut on the Branch Owner page. His smaller
 *                        slot on a two-slot job is found by the mart's `Branch Owner Second Slot`,
 *                        never by his name (a bare 'Kolbaia' may be someone else, his 10 Jul ruling).
 *
 * COMMISSION IS AS RECORDED ON THE CLOSING SHEET, BY MOVE DATE -- never rate x revenue (only 62%
 * of 2026 slots equal that). REFUNDS are the mart's `Kind`='Refund' rows: the refunds sheet's
 * 'Sales Commission Reduced Amount', dated by the refund date, matched to the job by request
 * number and taken off the salesperson the refunds sheet names (his ruling 24 Sep: "it maps to
 * them and deduces their numbers"); a bare first name ('Alanna') is that person's full name. When
 * nobody paid on the job answers to the name ('George Chase' on George Davis's 2026 jobs), the
 * job's paid salespeople share it by pay. The branch owner and estimators never carry one. Their
 * `Pay` is negative: Net = commission + refunds. A refund whose request has no paid slot is
 * deducted from nobody; the Sales Person tab lists those so they are not lost. 2026 to 23 Sep:
 * $3,625 taken back on 113 refunds.
 *
 * THE TIE-OUT LINE sits on every tab: Estimator + Sales Person + Branch Owner + Other = the closing
 * sheet's SP 1-3 salary for the company and period. The right-hand side is summed from the mart's
 * `Sheet SP Salary` (each job's own three columns, once per job), so the line is a check that can
 * fail on screen, not an identity. It is commission only (Slot rows); the refunds of the range sit
 * on a line of their own beneath it.
 *
 * NO REVENUE-CREDIT COLUMN on the Sales Person tab. The CEO ruled on 24 Sep 2026 that estimators
 * come out of the revenue split like the branch owner; that ships with the sales-attribution change
 * once he has seen its before/after. It moves revenue credit, not pay, so this page -- pay, slots,
 * jobs and the whole bill of those jobs -- reads the same either side of it.
 *
 * Its own bar (PAGE_DATASETS [] + BARE_CHROME): tabs, period chips + From/To, Month or ERP pay
 * period, company (Zip to Zip by default, as on Crew Salaries), person search, CSV.
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.mart_salaries) {
    // PAYLOAD CONTRACT: a column missing here never arrives. `Request Joinkey`, `Job No` and
    // `Job Foreman` stay in the mart; nothing on the page reads them.
    RS.DATASETS.mart_salaries = {
      table: "mart_salaries",
      cols: ["Unique Key", "Kind", "Date", "Month", "Pay Period", "Pay Date", "Company", "Request #",
             "Customer", "Moving Type", "Revenue", "SP Slot", "Name Raw", "Person", "Role",
             "On Sales Roster", "Name Inferred", "Typed Rate", "Pay", "Salespeople On Job",
             "DC Estimator", "Calendar Estimator", "Flag", "Sheet SP Salary",
             "Branch Owner Second Slot", "Refund Reduction", "Refund Note",
             // the job's state, for the Branch Owner tab's breakdown (2026-09-25)
             "State"],
      dateCols: { "Date": "Date" }, defaultDate: "Date",
    };
  }
})();

registerPage({
  id: "salaries",
  group: "financial",
  title: "Salaries",
  async render(host) {
    const num = RS.num, money = RS.money, fmtN = RS.fmtN;
    const esc = s => RSC.esc(s == null ? "" : String(s));
    const has = v => v != null && v !== "";
    const m0 = v => has(v) ? money(num(v)) : "—";
    // a signed total with a true minus sign: refunds are always money taken back
    const mS = v => { const n = Math.round(num(v)); return n < 0 ? "−" + money(-n) : money(n); };
    // cents: one refund's share of a job is often a few dollars
    const m2 = v => { if (!has(v)) return "—"; const n = num(v);
      return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
    const rateTxt = v => has(v) ? +(num(v) * 100).toFixed(2) + "%" : "—";
    const pctTxt = v => (v == null || !isFinite(v)) ? "—" : (v * 100).toFixed(1) + "%";
    const mLabel = m => m ? RS.monthName(+m.slice(5, 7)) + " " + m.slice(0, 4) : "";
    const dLabel = d => { const s = String(d || "").slice(0, 10);
      return s ? RS.monthName(+s.slice(5, 7)) + " " + (+s.slice(8, 10)) + ", " + s.slice(0, 4) : "—"; };
    // "2026-07-B" -> "Jul 16–31, 2026": the half spelled out, so a period never reads as a day
    const pLabel = p => {
      if (!p) return "";
      const y = +p.slice(0, 4), m = +p.slice(5, 7);
      return RS.monthName(m) + " " + (p.slice(8) === "A" ? "1–15" : "16–" + new Date(y, m, 0).getDate()) + ", " + y;
    };

    if (!document.getElementById("sal-style")) {
      const st = document.createElement("style");
      st.id = "sal-style";
      st.textContent = [
        // only what the kit cannot say; everything else is .rs-bar / .rs-table / .rs-kpis / .rs-pill
        ".sal .rs-bar .rs-tabs{margin:0}",
        // five period chips do not fit a phone on one line; they wrap instead of pushing the page sideways
        ".sal .rs-bar .rs-seg{flex-wrap:wrap;max-width:100%}",
        ".sal .rs-bar .rs-inp{min-width:0;width:190px;max-width:100%}",
        // the kit does not colour KPI values; these tones are this page's own and stay under .sal
        ".sal .rs-kpis .kpi.pos .v{color:var(--pos)}",
        ".sal .rs-kpis .kpi.warn .v{color:var(--warn)}",
        ".sal-tie{font-size:13px;line-height:1.7;color:var(--muted);background:var(--panel-2);"
          + "border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:0 0 14px}",
        ".sal-tie b{color:var(--ink);font-variant-numeric:tabular-nums}",
        ".sal-tie .on{color:var(--ink);font-weight:700}",
        ".sal-tie .rs-pill{margin-left:4px}",
        ".sal-tie + .sal-tie{margin-top:-8px}",
        ".sal-nm{font-weight:800;white-space:nowrap}",
        // money taken back reads as such wherever it sits
        ".sal .sal-neg{color:var(--neg)}",
        // the caret, the name and its pills on one line: a squeezed column must not stack them
        ".sal td.sal-pc{white-space:nowrap}",
        ".sal td.sal-pc .sal-pills{flex-wrap:nowrap}",
        ".sal-pills{display:inline-flex;flex-wrap:wrap;gap:4px;margin-left:6px;vertical-align:middle}",
        ".sal-pills .rs-pill{font-size:10.5px;padding:2px 8px}",
        ".sal-sm{display:block;font-size:11.5px;color:var(--faint);font-weight:600;margin-top:2px}",
        ".sal-th small{display:block;font-size:10px;letter-spacing:0;text-transform:none;"
          + "color:var(--faint);font-weight:600;margin-top:2px}",
        // the person's jobs: a wide nested table scrolls inside its card, never the page
        ".sal-subwrap{overflow-x:auto}",
        ".sal-ev{display:flex;flex-wrap:wrap;gap:4px;min-width:140px}",
        ".sal-ev .sal-sm{flex-basis:100%;max-width:420px;white-space:normal}",
        ".sal-sold{font-size:12.5px;color:var(--muted);min-width:150px}",
        ".sal-foot{margin-top:6px}",
        ".sal a.sal-link{color:var(--blue);font-weight:700;text-decoration:none}",
        ".sal a.sal-link:hover{text-decoration:underline}",
        // the tie-out and refund lines, folded to one (2026-09-25)
        ".sal-fold{margin:0 0 14px}",
        ".sal-fold>summary{list-style:none;cursor:pointer;font-size:13px;line-height:1.7;color:var(--muted);"
          + "background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:8px 14px}",
        ".sal-fold>summary::-webkit-details-marker{display:none}",
        ".sal-fold>summary b{color:var(--ink);font-variant-numeric:tabular-nums}",
        ".sal-fold>summary .sal-more{color:var(--blue);font-weight:700;margin-left:6px}",
        ".sal-fold[open]>summary{margin-bottom:8px}",
        ".sal-fold[open]>summary .sal-more{display:none}",
        ".sal .panel{margin-bottom:14px}",
      ].join("");
      document.head.appendChild(st);
    }

    const head = `<div class="rs-page-head"><h1>Salaries</h1>
      <p>What the closing sheet pays through its three salesperson slots, person by person:
         estimators, salespeople and the branch owner, less the commission refunds took back.</p></div>`;
    host.innerHTML = `<div class="sal">${head}
      <div class="rs-loading" style="padding:22px">Reading the pay slots…</div></div>`;

    let all;
    try {
      all = await RS.load("mart_salaries");
    } catch (e) {
      const msg = String(e && e.message || e);
      host.innerHTML = `<div class="sal">${head}<div class="panel">${
        /403|forbidden|permitted/i.test(msg)
          ? "This page belongs to the Financial group. An admin can grant it."
          : /unknown|not found|404|mart_salaries/i.test(msg)
            ? "The salaries table (mart_salaries) has not been built yet — it lands on the next pipeline run."
            : "Could not load the salaries table — " + esc(msg)}</div></div>`;
      return;
    }
    if (!all || !all.length) {
      host.innerHTML = `<div class="sal">${head}<div class="panel">The salaries table
        (mart_salaries) has not been built yet — it lands on the next pipeline run.</div></div>`;
      return;
    }

    /* HIS RULING 2026-09-25: "we should have CL Partner and YELP TEAM within the SALES PERSON - they
       kinda are sales persons. the ordering should be Sales Person, Estimator, Branch Owner." The mart
       keeps their own Role (the CL partner's slot is a deposit, Yelp Team a channel), so a row still
       says what it is; the Sales Person tab simply reads all three. */
    const SP_ROLES = ["Sales Person", "CL Partner", "Yelp Team"];
    const TABS = [
      { key: "sales-person", label: "Sales Person", role: "Sales Person", roles: SP_ROLES, plural: "Salespeople" },
      { key: "estimator", label: "Estimator", role: "Estimator", roles: ["Estimator"], plural: "Estimators" },
      { key: "branch-owner", label: "Branch Owner", role: "Branch Owner", roles: ["Branch Owner"], plural: "Branch owner" },
      // his ask 2026-09-25: "a separate tab ... all the salaries by person combined" -- one row per
      // person, a column per role, so Kolbaia's cut and his estimator pay finally sit on one line
      { key: "all-people", label: "All people", role: null, plural: "Everyone paid through the slots" },
    ];
    const OTHER_ROLES = ["CL Partner", "Yelp Team"];
    const isSlot = r => r.Kind === "Slot";
    const isRef = r => r.Kind === "Refund";
    const months = [...new Set(all.map(r => r.Month).filter(Boolean))].sort();
    /* The chips count back from the sheet's last CLOSING month, not from the last month anything
       is dated in: a refund dated after the last closing must not slide the default window onto
       months with no pay in them. */
    const slotMonths = [...new Set(all.filter(isSlot).map(r => r.Month).filter(Boolean))].sort();
    const last = slotMonths[slotMonths.length - 1] || months[months.length - 1] || "";
    const back = n => slotMonths[Math.max(0, slotMonths.length - n)] || last;
    // the closings' companies: a refund that matched no closing keeps the refunds sheet's own label
    const companies = [...new Set(all.filter(isSlot).map(r => r.Company).filter(Boolean))].sort();
    // #page=salaries&tab=sales-person -- read once; the shell's router stops at the &
    const bootTab = (location.hash.match(/[#&]tab=([\w-]+)/) || [])[1];
    /* Opens on the LAST 3 MONTHS and on Zip to Zip, his Crew Salaries choices (2026-09-01):
       the company payroll is read for; Tuji stays one click away, and the tie-out line names
       the company so Tuji's pay is never silently missing from a total. */
    const S = {
      tab: TABS.some(t => t.key === bootTab) ? bootTab : TABS[0].key,
      from: back(3), to: last,
      grp: "month", co: companies.includes("Zip to Zip") ? "Zip to Zip" : "", q: "",
      open: new Set(), sort: "net", dir: -1,
    };
    let qTimer = null;
    let cur = { people: [], role: "", keys: [] };

    const tab = () => TABS.find(t => t.key === S.tab) || TABS[0];
    const pkey = r => S.grp === "period" ? r["Pay Period"] : r.Month;
    const sumPay = rs => rs.reduce((a, r) => a + num(r.Pay), 0);
    // revenue of the JOBS, each job once however many slots a person holds on it
    const revOf = rs => { const seen = new Set(); let t = 0;
      rs.forEach(r => { if (isSlot(r) && !seen.has(r["Unique Key"])) { seen.add(r["Unique Key"]); t += num(r.Revenue); } });
      return t; };
    const jobsOf = rs => new Set(rs.filter(isSlot).map(r => r["Unique Key"])).size;
    // the rates typed on PAID slots (a $0 slot's typed 0% says nothing about the rate)
    const ratesOf = rs => rs.filter(r => isSlot(r) && num(r.Pay) !== 0 && has(r["Typed Rate"]) && num(r["Typed Rate"]) > 0)
      .map(r => num(r["Typed Rate"]));
    const avg = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

    function scoped() {        // the period and company: the tie-out's scope
      return all.filter(r => (!S.from || (r.Month || "") >= S.from) && (!S.to || (r.Month || "") <= S.to)
        && (!S.co || r.Company === S.co));
    }
    function matchQ(r) {
      const q = S.q.trim().toLowerCase();
      return !q || String(r.Person || "").toLowerCase().includes(q);
    }

    function byPerson(rs) {
      const m = new Map();
      rs.forEach(r => {
        const k = r.Person || "(no name)";
        let p = m.get(k);
        if (!p) m.set(k, p = { person: k, rows: [], pay: 0, ref: 0, slots: 0, paid: 0, dcOnly: 0, per: {},
                              inferred: 0, uncertain: 0, offRoster: false });
        p.rows.push(r);
        if (!isSlot(r) && !isRef(r)) { p.dcOnly++; return; }
        // the period columns are NET: commission on the period's moves, less refunds dated in it
        const k2 = pkey(r);
        p.per[k2] = (p.per[k2] || 0) + num(r.Pay);
        if (isRef(r)) { p.ref += num(r.Pay); return; }
        p.slots++;
        if (num(r.Pay) !== 0) p.paid++;
        p.pay += num(r.Pay);
        if (r["Name Inferred"] === "Yes") p.inferred++;
        if (/(^|; )Name uncertain(;|$)/.test(r.Flag || "")) p.uncertain++;
        if (r["On Sales Roster"] === "No") p.offRoster = true;
      });
      return [...m.values()].map(p => ({ ...p, net: p.pay + p.ref, jobs: jobsOf(p.rows), rev: revOf(p.rows),
                                         rate: avg(ratesOf(p.rows)) }));
    }

    const FLAG_TONE = { "Named, not paid": "warn", "DC rate, $0 paid": "bad", "Placeholder request": "warn",
                        "Alone in SP 1": "warn", "Name inferred": "info", "Name uncertain": "warn",
                        "Name from the slot above": "mute", "DC only": "warn", "No paid slot to deduct from": "bad" };
    const FLAG_WHY = {
      "Named, not paid": "a name in the slot and no pay recorded",
      "DC rate, $0 paid": "the DC gives this person a rate on this request, and the sheet paid $0 — no amount is assumed",
      "Placeholder request": "the request number is a placeholder, not a real job",
      "Alone in SP 1": "an estimator in SP 1 with no salesperson on the job",
      "Name inferred": "written 'Giorgi K' on a Tuji closing before 2026 — Giorgi Kirvalidze by the CEO's ruling (24 Sep), inferred for 2024-25",
      "Name uncertain": "a short form the sales list reads as Giorgi Kolbaia; only the full 'Giorgi Kolbaia' is certainly him (his ruling, 10 Jul), so it stays as written and is not his pay",
      "Name from the slot above": "a paid slot with no name takes the name above it, as the sales fact does",
      "DC only": "the DC names this estimator; no closing slot on the request does — no amount recorded",
      "No paid slot to deduct from": "the refund's request matches no closing with a paid salesperson slot — deducted from nobody",
    };
    const flagPills = f => String(f || "").split("; ").filter(Boolean).map(x =>
      `<span class="rs-pill ${FLAG_TONE[x] || "mute"}" title="${esc(FLAG_WHY[x] || "")}">${esc(x)}</span>`).join("");
    /* The sheet's spelling, shown only where it is not plainly the person's own name: 'Giorgi K'
       (Kirvalidze by the ruling, though it starts his name), 'Gio' for George Davis. 'Kakha' for
       Kakha Kakhetelidze on every row would be noise. */
    const writtenAs = r => {
      const raw = String(r["Name Raw"] || ""), p = String(r.Person || "");
      return raw !== "" && r.Kind === "Slot"
        && (raw === "Giorgi K" || !p.toLowerCase().startsWith(raw.toLowerCase()));
    };
    const evidence = r => (has(r["DC Estimator"])
        ? `<span class="rs-pill info" title="the digital contract's estimator on this request, with the DC's rate">DC: ${esc(r["DC Estimator"])}</span>` : "")
      + (has(r["Calendar Estimator"])
        ? `<span class="rs-pill mute" title="the calendar event's estimator on this request">Calendar: ${esc(r["Calendar Estimator"])}</span>` : "");
    const refundPill = r => `<span class="rs-pill bad" title="${esc(r["Refund Note"] || "")}">Refund</span>`
      + (has(r["Refund Note"]) ? `<span class="sal-sm">${esc(r["Refund Note"])}</span>` : "");

    const ALL_ROLES = ["Sales Person", "Estimator", "Branch Owner", "CL Partner", "Yelp Team"];
    let charts = [];
    Object.assign(S, { bk: "Moving Type", jq: "", js: "date", jd: -1 });

    function paint() {
      charts.forEach(c => { try { c.destroy(); } catch (e) { /* gone with its canvas */ } });
      charts = [];
      const t = tab();
      const sc = scoped();
      const isAll = !t.role, isBO = t.role === "Branch Owner";
      const rs = sc.filter(r => (isAll ? (r.Role && (isSlot(r) || isRef(r))) : t.roles.includes(r.Role)) && matchQ(r));
      const people = isAll ? byPersonAll(rs) : byPerson(rs);
      const keys = [...new Set(sc.filter(r => (isSlot(r) || isRef(r)) && r.Role).map(pkey).filter(Boolean))].sort();
      const key = { net: p => p.net, pay: p => p.pay, ref: p => -p.ref, jobs: p => p.jobs, rev: p => p.rev,
                    rate: p => p.rate == null ? -1 : p.rate, person: p => p.person,
                    ...Object.fromEntries(ALL_ROLES.map(k => ["role:" + k, p => (p.byRole || {})[k] || 0])) }[S.sort] || (p => p.net);
      people.sort((a, b) => { const x = key(a), y = key(b);
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * S.dir; });
      cur = { people, role: isAll ? "All" : t.role, keys };

      const grpTxt = S.grp === "period" ? "pay period" : "month";
      const tablePanel = `<div class="panel">
          <div class="panel-head"><div class="panel-title">${esc(t.plural)}
            by ${grpTxt}</div></div>
          <p class="rs-hint">${isAll
            ? "Everything the salesperson slots pay each person, whatever role they were paid in: a person who sold some jobs and estimated others has both on one line. "
            : ""}Click a name for the jobs and refunds behind the number. The ${S.grp === "period" ? "pay-period" : "month"}
            columns are net: commission on that ${S.grp === "period" ? "period's" : "month's"} moves, less refunds dated in it.${t.role === "Estimator"
            ? " Each job shows who sold it and what they were paid, and what the digital contract (DC) and the calendar say about the estimator." : ""}
            ${S.grp === "period" ? " Pay periods follow the ERP: moves on the 1st–15th are paid on the 14th of the next month, moves on the 16th to month end on the 30th (the last day of a shorter month)." : ""}</p>
          ${people.length ? (isAll ? allTable(people, keys) : personTable(people, keys, t.role))
            : `<div class="rs-hint">Nobody in this tab for ${esc(S.co || "all companies")}, ${esc(perTxt())}${S.q ? " matching “" + esc(S.q) + "”" : ""}.</div>`}
        </div>`;

      host.innerHTML = `<div class="sal">${head}
        <div class="rs-bar" id="salBar"></div>
        <div class="rs-kpis" id="salKpis"></div>
        ${tieFold(sc)}
        ${isBO ? boNote(sc) + boTrendPanel() + boStatementPanel(sc) + boBreakPanel(rs) + boJobsPanel(rs) : tablePanel}
        ${t.role === "Sales Person" ? loosePanel(sc) : ""}
        ${isAll ? loosePanel(sc) : ""}
        ${lookPanel(rs, isAll ? "All" : t.role)}
        <p class="rs-hint sal-foot">Commission as recorded on the closing sheet, by move date. Refunds are the
          refunds sheet's "Sales Commission Reduced Amount", by refund date, matched to the job by request
          number and taken off the salesperson the refunds sheet names; when nobody paid on that job
          answers to the name, off the job's paid salespeople by pay. Base pay and payment dates are not
          recorded in the warehouse, so this is pay earned, not pay paid.</p>
      </div>`;

      mountBar();
      RSC.kpis(host.querySelector("#salKpis"), kpis(rs, sc, isAll ? "All" : t.role));
      host.querySelectorAll("[data-sort]").forEach(el => {
        el.onclick = () => {
          const k = el.dataset.sort;
          if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === "person" ? 1 : -1; }
          paint();
        };
      });
      host.querySelectorAll("tr.rs-group[data-i]").forEach(tr => { tr.onclick = () => toggle(tr); });
      if (isBO) wireBO(sc, rs);
      const wrap = host.querySelector("#salTbl");
      if (wrap && window.innerWidth >= 900 && RSC.fitScroller) {
        try { RSC.fitScroller(wrap); } catch (e) { /* the kit's default height stands */ }
      }
    }

    /* THE TIE-OUT AND REFUND LINES, FOLDED (his pick 2026-09-25): one line that still proves the
       sheet -- the pill turns red and the fold opens by itself when the tabs stop adding up. */
    function tieFold(sc) {
      const slot = sc.filter(isSlot);
      const tot = sumPay(slot);
      const sheet = slot.reduce((a, r) => a + num(r["Sheet SP Salary"]), 0);
      const off = Math.round(tot - sheet);
      const refs = sc.filter(isRef);
      const refAmt = sumPay(refs.filter(r => r.Role));
      const lone = refs.filter(r => !r.Role);
      const role = tab().role;
      const mine = role ? sumPay(refs.filter(r => tab().roles.includes(r.Role))) : null;
      return `<details class="sal-fold"${off !== 0 ? " open" : ""}><summary>${off === 0
          ? '<span class="rs-pill ok">ties to the closing sheet</span>'
          : `<span class="rs-pill bad">off the closing sheet by ${m0(Math.abs(off))}</span>`}
        SP 1–3 salary <b>${m0(tot)}</b> for ${esc(S.co || "all companies")}, ${esc(perTxt())}
        · refunds <b class="sal-neg">${mS(refAmt)}</b>${mine != null ? ` (${mine ? mS(mine) : "none"} on this tab)` : ""}${lone.length
          ? ` · ${fmtN(lone.length)} (${m0(lone.reduce((a, r) => a + num(r["Refund Reduction"]), 0))}) deducted from nobody` : ""}
        <span class="sal-more">details</span></summary>${tieOut(sc)}${refundLine(sc)}</details>`;
    }

    /* ALL PEOPLE: a person's pay in every role on one line (his ask 2026-09-25). Rows with no Role
       are refunds that matched no paid slot -- deducted from nobody, listed below the table. */
    function byPersonAll(rs) {
      const m = new Map();
      rs.forEach(r => {
        const k = r.Person || "(no name)";
        let p = m.get(k);
        if (!p) m.set(k, p = { person: k, rows: [], pay: 0, ref: 0, slots: 0, paid: 0, per: {}, byRole: {}, roles: new Set() });
        p.rows.push(r);
        const k2 = pkey(r);
        p.per[k2] = (p.per[k2] || 0) + num(r.Pay);
        if (isRef(r)) { p.ref += num(r.Pay); return; }
        p.slots++;
        if (num(r.Pay) !== 0) p.paid++;
        p.pay += num(r.Pay);
        const rk = SP_ROLES.includes(r.Role) ? "Sales Person" : r.Role;
        p.byRole[rk] = (p.byRole[rk] || 0) + num(r.Pay);
        p.roles.add(rk);
      });
      return [...m.values()].map(p => ({ ...p, net: p.pay + p.ref, jobs: jobsOf(p.rows), rev: revOf(p.rows) }));
    }
    const ROLE_HEAD = { "Branch Owner": "Branch owner cut", "CL Partner": "CL partner", "Yelp Team": "Yelp Team" };
    function allTable(people, keys) {
      const th = (k, label, cls, tip) => `<th class="${cls == null ? "num" : cls}" data-sort="${k}" style="cursor:pointer"
        title="${esc(tip || "Sort by " + label)}">${esc(label)}${S.sort === k ? (S.dir < 0 ? " ↓" : " ↑") : ""}</th>`;
      const usedRoles = ALL_ROLES.filter(k => people.some(p => p.byRole[k]));
      const payDate = {};
      all.forEach(r => { if (r["Pay Period"] && !payDate[r["Pay Period"]]) payDate[r["Pay Period"]] = r["Pay Date"]; });
      const colHead = k => S.grp === "period"
        ? `<th class="num sal-th">${esc(pLabel(k))}<small>ERP pays ${esc(dLabel(payDate[k]))}</small></th>`
        : `<th class="num sal-th">${esc(mLabel(k))}</th>`;
      const allRows = people.flatMap(p => p.rows);
      const colTot = {};
      allRows.forEach(r => { const k = pkey(r); colTot[k] = (colTot[k] || 0) + num(r.Pay); });
      const roleTot = {};
      allRows.filter(isSlot).forEach(r => { const rk = SP_ROLES.includes(r.Role) ? "Sales Person" : r.Role;
        roleTot[rk] = (roleTot[rk] || 0) + num(r.Pay); });
      const totPay = sumPay(allRows.filter(isSlot)), totRef = sumPay(allRows.filter(isRef));
      const dash = '<span class="sal-sm" style="display:inline">—</span>';
      const refCell = v => v ? `<td class="num sal-neg">${mS(v)}</td>` : `<td class="num">${dash}</td>`;
      const ncol = 5 + usedRoles.length + keys.length;
      return `<div class="rs-tablewrap rs-fit" id="salTbl"><table class="rs-table rs-sticky">
        <thead><tr>${th("person", "Person", "")}${th("net", "Net pay", null, "every role, less refunds — sort")}
          ${usedRoles.map(k => th("role:" + k, ROLE_HEAD[k] || k, null, "paid in the " + k + " role — sort")).join("")}
          ${th("ref", "Refunds", null, "commission refunds took back — sort")}${th("jobs", "Jobs")}${th("rev", "Revenue of jobs")}
          ${keys.map(colHead).join("")}</tr></thead>
        <tbody>${people.map((p, i) => {
          const open = S.open.has(p.person);
          return `<tr class="rs-group${open ? " on" : ""}" data-i="${i}">
            <td class="sal-pc"><span class="rs-caret">›</span> <span class="sal-nm">${esc(p.person)}</span>${p.roles.size > 1
              ? `<span class="sal-pills"><span class="rs-pill info" title="${esc([...p.roles].join(", "))}">${fmtN(p.roles.size)} roles</span></span>` : ""}</td>
            <td class="num strong">${mS(p.net)}</td>
            ${usedRoles.map(k => `<td class="num">${p.byRole[k] ? m0(p.byRole[k]) : dash}</td>`).join("")}
            ${refCell(p.ref)}
            <td class="num">${fmtN(p.jobs)}</td><td class="num">${m0(p.rev)}</td>
            ${keys.map(k => `<td class="num">${has(p.per[k]) ? mS(p.per[k]) : dash}</td>`).join("")}</tr>`
            + (open ? subRow(p, "All", ncol) : "");
        }).join("")}</tbody>
        <tfoot><tr><td>${fmtN(people.length)} ${people.length === 1 ? "person" : "people"}</td>
          <td class="num">${mS(totPay + totRef)}</td>
          ${usedRoles.map(k => `<td class="num">${m0(roleTot[k] || 0)}</td>`).join("")}
          ${refCell(totRef)}<td class="num">${fmtN(jobsOf(allRows))}</td><td class="num">${m0(revOf(allRows))}</td>
          ${keys.map(k => `<td class="num">${mS(colTot[k] || 0)}</td>`).join("")}</tr></tfoot>
      </table></div>`;
    }

    /* ================= BRANCH OWNER TAB (his picks 2026-09-25) =================
       a 12-month trend beside last year, a pay-period statement, his jobs open, breakdowns. */
    const boMine = r => (r.Role === "Branch Owner" && (isSlot(r) || isRef(r)))
      || (isSlot(r) && r["Branch Owner Second Slot"] === "Yes");
    const ymShift = (mk, k) => { const t = +mk.slice(0, 4) * 12 + (+mk.slice(5, 7) - 1) + k;
      return Math.floor(t / 12) + "-" + String(t % 12 + 1).padStart(2, "0"); };
    function boMonthly() {
      const src = all.filter(r => (!S.co || r.Company === S.co) && boMine(r));
      const end = S.to || last;
      const months12 = Array.from({ length: 12 }, (_, i) => ymShift(end, i - 11));
      const one = mk => {
        const rs = src.filter(r => r.Month === mk);
        const cutRows = rs.filter(r => isSlot(r) && r.Role === "Branch Owner");
        return { mk, jobs: jobsOf(cutRows), rev: revOf(cutRows), cut: sumPay(cutRows),
                 est: sumPay(rs.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes")),
                 ref: sumPay(rs.filter(isRef)) };
      };
      return months12.map(mk => ({ ...one(mk), ly: one(ymShift(mk, -12)) }));
    }
    function boTrendPanel() { return `<div id="salBoTrend"></div>`; }

    function boStatementRows(sc) {
      const mine = sc.filter(boMine);
      const m = new Map();
      mine.forEach(r => {
        const k = r["Pay Period"] || "";
        let g = m.get(k);
        if (!g) m.set(k, g = { k, pay: r["Pay Date"], rows: [] });
        g.rows.push(r);
      });
      return [...m.values()].sort((a, b) => a.k.localeCompare(b.k)).map(g => {
        const cutRows = g.rows.filter(r => isSlot(r) && r.Role === "Branch Owner");
        const cut = sumPay(cutRows), est = sumPay(g.rows.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes"));
        const ref = sumPay(g.rows.filter(isRef));
        return { k: g.k, pay: g.pay, jobs: jobsOf(cutRows), rev: revOf(cutRows), cut, est, ref, net: cut + est + ref };
      });
    }
    function boStatementPanel(sc) {
      const rows = boStatementRows(sc);
      const t = rows.reduce((a, r) => ({ jobs: a.jobs + r.jobs, rev: a.rev + r.rev, cut: a.cut + r.cut,
        est: a.est + r.est, ref: a.ref + r.ref, net: a.net + r.net }), { jobs: 0, rev: 0, cut: 0, est: 0, ref: 0, net: 0 });
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Pay-period statement</div><span class="spacer"></span>
          ${rows.length ? '<button type="button" class="rs-btn" id="salBoPrint">Print / save as PDF</button>' : ""}</div>
        <p class="rs-hint">By the ERP's pay periods: moves on the 1st–15th are paid on the 14th of the next month,
          moves on the 16th to month end on the 30th. To pay = his branch-owner cut + his estimator pay on two-slot
          jobs − commission refunds dated in the period. What the closing sheet records, not a payment record.</p>
        ${rows.length ? `<div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Moves</th><th>ERP pays</th><th class="num">Jobs</th><th class="num">Revenue of jobs</th>
            <th class="num">Cut</th><th class="num">Estimator pay</th><th class="num">Refunds</th><th class="num">To pay</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td class="nowrap">${esc(pLabel(r.k))}</td><td class="nowrap">${esc(dLabel(r.pay))}</td>
            <td class="num">${fmtN(r.jobs)}</td><td class="num">${m0(r.rev)}</td><td class="num">${m0(r.cut)}</td>
            <td class="num">${r.est ? m0(r.est) : "—"}</td><td class="num${r.ref ? " sal-neg" : ""}">${r.ref ? mS(r.ref) : "—"}</td>
            <td class="num strong">${mS(r.net)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="2">${esc(perTxt())}</td><td class="num">${fmtN(t.jobs)}</td><td class="num">${m0(t.rev)}</td>
            <td class="num">${m0(t.cut)}</td><td class="num">${t.est ? m0(t.est) : "—"}</td>
            <td class="num${t.ref ? " sal-neg" : ""}">${t.ref ? mS(t.ref) : "—"}</td><td class="num">${mS(t.net)}</td></tr></tfoot>
        </table></div>` : `<div class="rs-hint">No branch-owner pay in ${esc(perTxt())}.</div>`}
      </div>`;
    }
    function printStatement(sc) {
      const rows = boStatementRows(sc);
      const who = [...new Set(sc.filter(r => r.Role === "Branch Owner").map(r => r.Person))].join(", ") || "Branch owner";
      const cell = "padding:6px 10px;border-bottom:1px solid #ddd";
      const td = v => `<td style="text-align:right;${cell}">${v}</td>`;
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Pay-period statement</title></head>
        <body style="font-family:Inter,Segoe UI,Arial,sans-serif;color:#0e1621;margin:24px">
        <h2 style="margin:0 0 4px">Pay-period statement — ${esc(who)}</h2>
        <div style="color:#5a6775;margin-bottom:14px">${esc(S.co || "All companies")} · ${esc(perTxt())} ·
          branch-owner cut + estimator pay on two-slot jobs − commission refunds, as the closing sheet records them</div>
        <table style="border-collapse:collapse;width:100%;font-size:13px"><thead><tr>
          ${["Moves", "ERP pays", "Jobs", "Revenue of jobs", "Cut", "Estimator pay", "Refunds", "To pay"]
            .map((h, i) => `<th style="text-align:${i < 2 ? "left" : "right"};padding:6px 10px;border-bottom:2px solid #0e1621">${h}</th>`).join("")}
        </tr></thead><tbody>${rows.map(r => `<tr><td style="${cell}">${esc(pLabel(r.k))}</td>
          <td style="${cell}">${esc(dLabel(r.pay))}</td>
          ${td(fmtN(r.jobs))}${td(m0(r.rev))}${td(m0(r.cut))}${td(r.est ? m0(r.est) : "—")}${td(r.ref ? mS(r.ref) : "—")}
          ${td("<b>" + mS(r.net) + "</b>")}</tr>`).join("")}</tbody></table>
        <p style="color:#5a6775;font-size:11px;margin-top:14px">Printed from the Salaries page, ${esc(new Date().toLocaleString())}.</p>
        </body></html>`;
      RSC.printDoc(html, { title: "Pay-period statement", width: "297mm", height: "210mm" });
    }

    const BO_BRK = [["Moving Type", "Moving type"], ["State", "State"], ["Company", "Company"], ["rate", "Typed rate"]];
    function boBreakPanel(rs) {
      const cutRows = rs.filter(r => isSlot(r) && r.Role === "Branch Owner");
      const keyOf = r => S.bk === "rate" ? (has(r["Typed Rate"]) && num(r["Typed Rate"]) > 0 ? rateTxt(r["Typed Rate"]) : "no rate typed")
        : (has(r[S.bk]) ? String(r[S.bk]) : "(blank)");
      const m = new Map();
      cutRows.forEach(r => { const k = keyOf(r); (m.get(k) || m.set(k, []).get(k)).push(r); });
      const tot = sumPay(cutRows), totRev = revOf(cutRows);
      const rows = [...m.entries()].map(([k, g]) => ({ k, jobs: jobsOf(g), rev: revOf(g), cut: sumPay(g) }))
        .sort((a, b) => S.bk === "rate" ? (parseFloat(a.k) || 999) - (parseFloat(b.k) || 999) : b.cut - a.cut);
      const segBtns = BO_BRK.map(([v, l]) => `<button type="button" data-sal-bk="${esc(v)}" class="${v === S.bk ? "on" : ""}">${esc(l)}</button>`).join("");
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Where his cut came from</div><span class="spacer"></span>
          <span class="rs-seg">${segBtns}</span></div>
        ${rows.length ? `<div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>${esc((BO_BRK.find(x => x[0] === S.bk) || [0, S.bk])[1])}</th><th class="num">Jobs</th>
            <th class="num">Revenue of jobs</th><th class="num">Cut</th><th class="num">Cut %</th><th class="num">Share of his cut</th></tr></thead>
          <tbody>${rows.map(r => `<tr><td class="strong">${esc(r.k)}</td><td class="num">${fmtN(r.jobs)}</td>
            <td class="num">${m0(r.rev)}</td><td class="num">${m0(r.cut)}</td><td class="num">${pctTxt(r.rev ? r.cut / r.rev : null)}</td>
            <td class="num">${pctTxt(tot ? r.cut / tot : null)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td>Total</td><td class="num">${fmtN(jobsOf(cutRows))}</td><td class="num">${m0(totRev)}</td>
            <td class="num">${m0(tot)}</td><td class="num">${pctTxt(totRev ? tot / totRev : null)}</td><td class="num">100.0%</td></tr></tfoot>
        </table></div>` : `<div class="rs-hint">No branch-owner jobs in ${esc(perTxt())}.</div>`}
        ${S.bk === "rate" ? '<p class="rs-hint">The rate typed in his slot on the closing sheet; the cut is what was recorded, which is not always rate × bill.</p>' : ""}
      </div>`;
    }

    const BO_SORT = { date: r => String(r.Date || ""), cust: r => String(r.Customer || "").toLowerCase(),
      rev: r => isSlot(r) ? num(r.Revenue) : -1, cut: r => num(r.Pay),
      pct: r => isSlot(r) && num(r.Revenue) ? num(r.Pay) / num(r.Revenue) : -1 };
    function boJobsPanel(rs) {
      const q = S.jq.trim().toLowerCase();
      const rows = rs.filter(r => isSlot(r) || isRef(r))
        .filter(r => !q || [r.Customer, r["Request #"], r["Moving Type"], r.State, r.Company]
          .some(v => String(v || "").toLowerCase().includes(q)));
      const f = BO_SORT[S.js] || BO_SORT.date;
      rows.sort((a, b) => { const x = f(a), y = f(b); return (typeof x === "string" ? x.localeCompare(y) : x - y) * S.jd; });
      const th = (k, l, cls) => `<th class="${cls || ""}" data-sal-js="${k}" style="cursor:pointer" title="Sort by ${esc(l)}">${esc(l)}${S.js === k ? (S.jd < 0 ? " ↓" : " ↑") : ""}</th>`;
      const cap = 500;
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">His jobs — ${esc(perTxt())}</div><span class="spacer"></span>
          <input class="rs-inp" id="salJq" placeholder="find a customer, request #, state…" value="${esc(S.jq)}" aria-label="Find a job"></div>
        <div class="rs-tablewrap" style="max-height:520px"><table class="rs-table rs-sticky">
          <thead><tr>${th("date", "Move date")}<th>Request #</th>${th("cust", "Customer")}<th>Moving type · state</th>
            ${th("rev", "Revenue", "num")}<th class="num">Typed rate</th>${th("cut", "Cut", "num")}${th("pct", "Cut %", "num")}<th>Flags</th></tr></thead>
          <tbody>${rows.slice(0, cap).map(r => { const rf = isRef(r);
            return `<tr><td class="nowrap">${esc(dLabel(r.Date))}${rf ? '<span class="sal-sm">refund date</span>'
              : `<span class="sal-sm">ERP pays ${esc(dLabel(r["Pay Date"]))}</span>`}</td>
            <td class="nowrap">${esc(r["Request #"] || "—")}<span class="sal-sm">${esc(r.Company || "")}</span></td>
            <td>${esc(r.Customer || "—")}</td>
            <td>${esc([r["Moving Type"], r.State].filter(Boolean).join(" · ") || "—")}</td>
            <td class="num">${isSlot(r) ? m0(r.Revenue) : "—"}</td><td class="num">${rateTxt(r["Typed Rate"])}</td>
            <td class="num strong${rf ? " sal-neg" : ""}">${rf ? m2(r.Pay) : m0(r.Pay)}</td>
            <td class="num">${isSlot(r) ? pctTxt(num(r.Revenue) ? num(r.Pay) / num(r.Revenue) : null) : "—"}</td>
            <td><div class="sal-ev">${rf ? refundPill(r) : flagPills(r.Flag)}</div></td></tr>`; }).join("")}</tbody>
        </table></div>
        <p class="rs-hint" style="margin-top:8px">${fmtN(rows.length)} row${rows.length === 1 ? "" : "s"}${rows.length > cap
          ? ` — showing the first ${cap}; the CSV has them all` : ""}. His estimator pay on two-slot jobs is on the Estimator tab; the All people tab puts both on one line.</p>
      </div>`;
    }

    function wireBO(sc, rs) {
      host.querySelectorAll("[data-sal-bk]").forEach(b => b.onclick = () => { if (S.bk !== b.dataset.salBk) { S.bk = b.dataset.salBk; paint(); } });
      host.querySelectorAll("[data-sal-js]").forEach(el => el.onclick = () => {
        const k = el.dataset.salJs;
        if (S.js === k) S.jd = -S.jd; else { S.js = k; S.jd = k === "cust" ? 1 : -1; }
        paint();
      });
      const q = host.querySelector("#salJq");
      if (q) {
        q.oninput = () => { clearTimeout(qTimer); qTimer = setTimeout(() => { S.jq = q.value; S._jfocus = 1; paint(); }, 300); };
        if (S._jfocus) { S._jfocus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }
      const pr = host.querySelector("#salBoPrint");
      if (pr) pr.onclick = () => printStatement(sc);
      const mount = host.querySelector("#salBoTrend");
      if (!mount || !window.Chart) return;
      try {
        const data = boMonthly();
        const light = document.body.classList.contains("light");
        const CTX = light ? "#c6d0db" : "#3a4658";
        const pctCh = d => d.ly.cut ? (d.cut - d.ly.cut) / d.ly.cut : null;
        RSC.chartCard(mount, {
          title: "His cut, month by month — 12 months to " + mLabel(S.to || last),
          key: "sal-bo-trend",
          buildChart(canvas) {
            const ch = new Chart(canvas, {
              type: "bar",
              data: { labels: data.map(d => mLabel(d.mk)), datasets: [
                { label: "His cut", data: data.map(d => d.cut), backgroundColor: "#84cc16", yAxisID: "y", order: 2 },
                { label: "Same month last year", data: data.map(d => d.ly.cut), backgroundColor: CTX, yAxisID: "y", order: 3 },
                { type: "line", label: "Cut % of revenue", data: data.map(d => d.rev ? +(100 * d.cut / d.rev).toFixed(2) : null),
                  borderColor: "#2f6fd0", backgroundColor: "#2f6fd0", yAxisID: "y1", tension: .3, order: 1, spanGaps: true },
              ] },
              options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
                plugins: { legend: { position: "bottom" },
                  tooltip: { callbacks: { label: it => it.dataset.label + ": " + (it.dataset.yAxisID === "y1" ? it.parsed.y + "%" : m0(it.parsed.y)) } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => m0(v) } },
                          y1: { position: "right", beginAtZero: true, grid: { drawOnChartArea: false }, ticks: { callback: v => v + "%" } } } },
            });
            charts.push(ch);
            return ch;
          },
          buildTable() {
            const tot = k => data.reduce((a, d) => a + (k(d) || 0), 0);
            return `<table class="tab"><thead><tr><th>Month</th><th>Jobs</th><th>Revenue of jobs</th><th>Cut</th><th>Cut %</th>
              <th>Estimator pay</th><th>Refunds</th><th>Last year cut</th><th>vs last year</th></tr></thead><tbody>
              ${data.map(d => `<tr><td>${esc(mLabel(d.mk))}</td><td>${fmtN(d.jobs)}</td><td>${m0(d.rev)}</td><td>${m0(d.cut)}</td>
                <td>${pctTxt(d.rev ? d.cut / d.rev : null)}</td><td>${d.est ? m0(d.est) : "—"}</td><td>${d.ref ? mS(d.ref) : "—"}</td>
                <td>${d.ly.cut ? m0(d.ly.cut) : "—"}</td><td>${pctCh(d) == null ? "—"
                  : (pctCh(d) >= 0 ? "+" : "−") + Math.abs(pctCh(d) * 100).toFixed(1) + "%"}</td></tr>`).join("")}</tbody>
              <tfoot><tr><td>12 months</td><td>${fmtN(tot(d => d.jobs))}</td><td>${m0(tot(d => d.rev))}</td><td>${m0(tot(d => d.cut))}</td>
                <td>${pctTxt(tot(d => d.rev) ? tot(d => d.cut) / tot(d => d.rev) : null)}</td><td>${m0(tot(d => d.est))}</td>
                <td>${mS(tot(d => d.ref))}</td><td>${m0(tot(d => d.ly.cut))}</td><td></td></tr></tfoot></table>`;
          },
        });
        const card = mount.querySelector(".panel");
        if (card) {
          const h = document.createElement("p");
          h.className = "rs-hint";
          h.textContent = "The 12 months ending at the To month, whatever period is picked above, so the trend always has a year to show. "
            + "Green = his cut, grey = the same month a year earlier, blue line = cut as a share of the revenue of his jobs.";
          card.insertBefore(h, card.querySelector(".gview"));
        }
      } catch (e) {
        console.error("salaries bo trend:", e);
        mount.innerHTML = `<div class="panel"><div class="rs-loading">The monthly trend could not draw (${esc(e.message || e)}).</div></div>`;
      }
    }

    function perTxt() {
      return S.from === S.to ? mLabel(S.from) : mLabel(S.from) + " – " + mLabel(S.to);
    }

    function kpis(rs, sc, role) {
      const slots = rs.filter(isSlot);
      const pay = sumPay(slots), ref = sumPay(rs.filter(isRef)), net = pay + ref;
      const jobs = jobsOf(slots), rev = revOf(slots);
      const paid = slots.filter(r => num(r.Pay) !== 0).length;
      const people = new Set(slots.map(r => r.Person)).size;
      const netSub = `commission ${m0(pay)}, refunds ${mS(ref)}`;
      if (role === "Estimator") {
        const rates = slots.filter(r => has(r["Typed Rate"]) && num(r["Typed Rate"]) > 0).map(r => num(r["Typed Rate"]));
        const lo = rates.length ? Math.min(...rates) : null, hi = rates.length ? Math.max(...rates) : null;
        const dc = rs.filter(r => r.Kind === "DC only").length;
        return [
          { label: "Net estimator pay", value: m0(net), sub: netSub, tone: "pos" },
          { label: "Jobs estimated", value: fmtN(jobs),
            sub: dc ? `+ ${fmtN(dc)} named only in the DC (no slot, no amount)` : "jobs with an estimator in a slot" },
          { label: "Paid / named slots", value: `${fmtN(paid)} / ${fmtN(slots.length)}`,
            sub: `${fmtN(slots.length - paid)} named, not paid`, tone: slots.length > paid ? "warn" : "" },
          { label: "People", value: fmtN(people), sub: "estimators paid or named in a slot" },
          { label: "Typed rate range", value: lo == null ? "—" : rateTxt(lo) + (hi > lo ? " – " + rateTxt(hi) : ""),
            sub: "rates typed in their slots" },
        ];
      }
      if (role === "Sales Person") {
        const ar = avg(ratesOf(slots));
        const oth = sumPay(slots.filter(r => OTHER_ROLES.includes(r.Role)));
        return [
          { label: "Net sales person pay", value: m0(net), sub: netSub, tone: "pos" },
          { label: "Jobs", value: fmtN(jobs), sub: `${fmtN(paid)} of ${fmtN(slots.length)} slots paid` },
          { label: "Revenue of those jobs", value: m0(rev), sub: "the whole bill of each job" },
          { label: "Avg typed rate", value: ar == null ? "—" : rateTxt(ar), sub: "mean of the rates typed on paid slots" },
          { label: "People", value: fmtN(people), sub: "reps, the CL partner and Yelp Team" },
          { label: "CL partner + Yelp Team", value: m0(oth), sub: "inside the total, marked on their rows" },
        ];
      }
      if (role === "All") {
        return [
          { label: "Net pay, everyone", value: m0(net), sub: netSub, tone: "pos" },
          { label: "People", value: fmtN(people), sub: "paid or named in a slot, in any role" },
          { label: "Jobs", value: fmtN(jobs), sub: `${fmtN(paid)} of ${fmtN(slots.length)} slots paid` },
          { label: "Revenue of those jobs", value: m0(rev), sub: "the whole bill of each job" },
          { label: "Slot pay % of revenue", value: pctTxt(rev ? pay / rev : null), sub: "everything the SP slots pay, over those bills" },
        ];
      }
      // his smaller slot of two, by the mart's own marker -- a name would also catch a bare 'Kolbaia'
      const est = sc.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes");
      return [
        { label: "His cut", value: m0(pay), sub: `= His Cut on the Branch Owner page; refunds ${mS(ref)}, net ${m0(net)}`, tone: "pos" },
        { label: "Jobs", value: fmtN(jobs), sub: "jobs where he takes a cut" },
        { label: "Revenue of those jobs", value: m0(rev), sub: "the whole bill of each job" },
        { label: "Cut % of revenue", value: pctTxt(rev ? pay / rev : null), sub: "his cut over those bills" },
        { label: "His estimator pay", value: m0(sumPay(est)), sub: `two-slot jobs (${fmtN(est.length)}) — on the Estimator tab; All people puts both on one line` },
      ];
    }

    function tieOut(sc) {
      const slot = sc.filter(isSlot);
      const by = {};
      slot.forEach(r => { by[r.Role] = (by[r.Role] || 0) + num(r.Pay); });
      const est = by["Estimator"] || 0, bo = by["Branch Owner"] || 0;
      const sp = SP_ROLES.reduce((a, k) => a + (by[k] || 0), 0);
      const tot = est + sp + bo;
      const sheet = slot.reduce((a, r) => a + num(r["Sheet SP Salary"]), 0);
      const off = Math.round(tot - sheet);
      const role = tab().role;
      const part = (label, v, r) => `<span class="${r === role ? "on" : ""}">${label} <b>${m0(v)}</b></span>`;
      return `<div class="sal-tie">${part("Sales Person (CL partner and Yelp Team included)", sp, "Sales Person")}
        + ${part("Estimator", est, "Estimator")} + ${part("Branch Owner", bo, "Branch Owner")}
        = <b>${m0(tot)}</b>, the closing sheet's SP 1–3 salary for ${esc(S.co || "all companies")},
        ${esc(perTxt())}. ${off === 0
          ? '<span class="rs-pill ok">ties to the dollar</span>'
          : `<span class="rs-pill bad">the sheet says ${m0(sheet)}: off by ${m0(Math.abs(off))}</span>`}</div>`;
    }

    /* The refunds of the range, by role, on their own line: the tie-out above is commission only,
       so it keeps proving the sheet. A refund whose request has no paid slot is counted here and
       deducted from nobody. */
    function refundLine(sc) {
      const refs = sc.filter(isRef);
      if (!refs.length) return `<div class="sal-tie">No refund took commission back in ${esc(perTxt())} for ${esc(S.co || "all companies")}.</div>`;
      const by = {};
      refs.filter(r => r.Role).forEach(r => { by[r.Role] = (by[r.Role] || 0) + num(r.Pay); });
      const est = by["Estimator"] || 0, bo = by["Branch Owner"] || 0;
      const sp = SP_ROLES.reduce((a, k) => a + (by[k] || 0), 0);
      const lone = refs.filter(r => !r.Role);
      const loneAmt = lone.reduce((a, r) => a + num(r["Refund Reduction"]), 0);
      const role = tab().role;
      const part = (label, v, r) => `<span class="${r === role ? "on" : ""}">${label} <b class="sal-neg">${mS(v)}</b></span>`;
      return `<div class="sal-tie">Refunds dated in this range, taken off the salesperson the refunds sheet
        names on each refunded job: ${part("Sales Person", sp, "Sales Person")} + ${part("Estimator", est, "Estimator")}
        + ${part("Branch Owner", bo, "Branch Owner")}
        = <b class="sal-neg">${mS(est + sp + bo)}</b>.${lone.length
          ? ` <span class="rs-pill warn" title="${esc(FLAG_WHY["No paid slot to deduct from"])}">${fmtN(lone.length)} more (${m0(loneAmt)})
              match no paid slot — deducted from nobody${role === "Sales Person" ? ", listed below" : ", listed on the Sales Person tab"}</span>` : ""}</div>`;
    }

    function boNote(sc) {
      const est = sumPay(sc.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes"));
      return `<p class="rs-hint">His branch-owner cut only. On a job where he holds two salesperson
        slots, the larger is his cut and the other is estimator pay (his ruling, 23 Sep)${est
          ? ` — ${m0(est)} in this range, on the Estimator tab` : ""}. His cut equals His Cut on the
        <a class="sal-link" href="#page=branch-owner">Branch Owner</a> page for the same dates and company;
        that page has the profit view. Refunds come off the salesperson the refunds sheet names,
        never off his cut.</p>`;
    }

    function personTable(people, keys, role) {
      const th = (k, label, cls, tip) => `<th class="${cls == null ? "num" : cls}" data-sort="${k}" style="cursor:pointer"
        title="${esc(tip || "Sort by " + label)}">${label}${S.sort === k ? (S.dir < 0 ? " ↓" : " ↑") : ""}</th>`;
      const payDate = {};
      all.forEach(r => { if (r["Pay Period"] && !payDate[r["Pay Period"]]) payDate[r["Pay Period"]] = r["Pay Date"]; });
      const colHead = k => S.grp === "period"
        ? `<th class="num sal-th">${esc(pLabel(k))}<small>ERP pays ${esc(dLabel(payDate[k]))}</small></th>`
        : `<th class="num sal-th">${esc(mLabel(k))}</th>`;
      const allRows = people.flatMap(p => p.rows);
      const colTot = {};
      allRows.filter(r => isSlot(r) || isRef(r)).forEach(r => { const k = pkey(r); colTot[k] = (colTot[k] || 0) + num(r.Pay); });
      const slots = allRows.filter(isSlot);
      const slotsN = slots.length, paidN = slots.filter(r => num(r.Pay) !== 0).length;
      const totPay = sumPay(slots), totRef = sumPay(allRows.filter(isRef)), totRev = revOf(allRows);
      const isSP = role === "Sales Person", isBO = role === "Branch Owner";
      const ncol = 7 + keys.length + (isSP || isBO ? 1 : 0);
      const refCell = v => v ? `<td class="num sal-neg">${mS(v)}</td>` : '<td class="num"><span class="sal-sm" style="display:inline">—</span></td>';
      /* NET PAY SITS NEXT TO THE NAME, not after the periods: at six pay periods the table is
         wider than a laptop and the last column is the one a scroller hides -- and the net is
         the number this page exists for. Commission and refunds follow it; the periods trail to
         the right and scroll inside. */
      return `<div class="rs-tablewrap rs-fit" id="salTbl"><table class="rs-table rs-sticky">
        <thead><tr>${th("person", "Person", "")}${th("net", "Net pay", null, "commission less refunds — sort")}
          ${th("pay", isBO ? "Cut" : "Commission")}${th("ref", "Refunds", null, "commission refunds took back — sort")}
          ${th("jobs", "Jobs")}<th class="num">Slots paid</th>${th("rev", "Revenue of jobs")}
          ${isSP ? th("rate", "Avg typed rate", null, "mean of the rates typed on paid slots — sort") : ""}
          ${isBO ? '<th class="num">Cut %</th>' : ""}${keys.map(colHead).join("")}</tr></thead>
        <tbody>${people.map((p, i) => {
          const open = S.open.has(p.person);
          return `<tr class="rs-group${open ? " on" : ""}" data-i="${i}">
            <td class="sal-pc"><span class="rs-caret">›</span> <span class="sal-nm">${esc(p.person)}</span>${namePills(p, role)}</td>
            <td class="num strong">${mS(p.net)}</td>
            <td class="num">${m0(p.pay)}</td>
            ${refCell(p.ref)}
            <td class="num">${fmtN(p.jobs)}</td>
            <td class="num">${fmtN(p.paid)} / ${fmtN(p.slots)}</td>
            <td class="num">${m0(p.rev)}</td>
            ${isSP ? `<td class="num">${p.rate == null ? "—" : rateTxt(p.rate)}</td>` : ""}
            ${isBO ? `<td class="num">${pctTxt(p.rev ? p.pay / p.rev : null)}</td>` : ""}
            ${keys.map(k => `<td class="num">${has(p.per[k]) ? mS(p.per[k]) : '<span class="sal-sm" style="display:inline">—</span>'}</td>`).join("")}</tr>`
            + (open ? subRow(p, role, ncol) : "");
        }).join("")}</tbody>
        <tfoot><tr><td>${fmtN(people.length)} ${people.length === 1 ? "person" : "people"}</td>
          <td class="num">${mS(totPay + totRef)}</td><td class="num">${m0(totPay)}</td>${refCell(totRef)}
          <td class="num">${fmtN(jobsOf(allRows))}</td><td class="num">${fmtN(paidN)} / ${fmtN(slotsN)}</td>
          <td class="num">${m0(totRev)}</td>
          ${isSP ? `<td class="num">${(v => v == null ? "—" : rateTxt(v))(avg(ratesOf(allRows)))}</td>` : ""}
          ${isBO ? `<td class="num">${pctTxt(totRev ? totPay / totRev : null)}</td>` : ""}
          ${keys.map(k => `<td class="num">${mS(colTot[k] || 0)}</td>`).join("")}</tr></tfoot>
      </table></div>`;
    }

    function namePills(p, role) {
      const out = [];
      const own = [...new Set(p.rows.filter(r => OTHER_ROLES.includes(r.Role)).map(r => r.Role))];
      own.forEach(r2 => out.push(`<span class="rs-pill info" title="paid through a salesperson slot; counted as a salesperson (his ruling 25 Sep)">${esc(r2 === "CL Partner" ? "CL partner" : r2)}</span>`));
      if (p.offRoster && role !== "Branch Owner")
        out.push('<span class="rs-pill warn" title="this name is not on the sales person list">not on the sales roster</span>');
      if (p.inferred)
        out.push(`<span class="rs-pill info" title="${esc(FLAG_WHY["Name inferred"])}">${fmtN(p.inferred)} inferred</span>`);
      if (p.uncertain)
        out.push(`<span class="rs-pill warn" title="${esc(FLAG_WHY["Name uncertain"])}">name uncertain</span>`);
      if (p.dcOnly)
        out.push(`<span class="rs-pill warn" title="${esc(FLAG_WHY["DC only"])}">DC only ×${fmtN(p.dcOnly)}</span>`);
      return out.length ? `<span class="sal-pills">${out.join("")}</span>` : "";
    }

    function subRow(p, role, ncol) {
      return `<tr class="rs-sub"><td colspan="${ncol}"><div class="rs-sub-card"><div class="sal-subwrap">${jobsTable(p.rows, role)}</div></div></td></tr>`;
    }

    function jobsTable(rows, role) {
      const rs = rows.slice().sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")));
      const cap = 200;
      const body = rs.slice(0, cap).map(r => {
        const dc = r.Kind === "DC only", rf = isRef(r);
        return `<tr>
          <td class="nowrap">${esc(dLabel(r.Date))}${dc ? "" : rf ? '<span class="sal-sm">refund date</span>' : `<span class="sal-sm"
            title="ERP pay period ${esc(pLabel(r["Pay Period"]))}: the date the ERP's schedule pays it, not a recorded payment">ERP pays ${esc(dLabel(r["Pay Date"]))}</span>`}</td>
          <td class="nowrap">${esc(r["Request #"] || "—")}</td>
          <td>${esc(r.Customer || "—")}<span class="sal-sm">${esc([r.Company, r["Moving Type"]].filter(Boolean).join(" · "))}</span></td>
          <td class="num">${isSlot(r) ? m0(r.Revenue) : "—"}</td>
          ${role === "Estimator" ? `<td><div class="sal-sold">${esc(r["Salespeople On Job"] || (isSlot(r) ? "no salesperson on the job" : ""))}</div></td>` : ""}
          ${role === "All" ? `<td><span class="rs-pill mute">${esc(r.Role || "—")}</span></td>` : ""}
          ${role === "Sales Person" ? `<td class="num">${has(r["SP Slot"]) ? "SP " + esc(r["SP Slot"]) : "—"}</td>` : ""}
          <td class="num">${rateTxt(r["Typed Rate"])}</td>
          <td class="num strong${rf ? " sal-neg" : ""}">${dc ? '<span title="nothing records an amount">—</span>' : rf ? m2(r.Pay) : m0(r.Pay)}</td>
          ${role === "Branch Owner" ? `<td class="num">${isSlot(r) ? pctTxt(num(r.Revenue) ? num(r.Pay) / num(r.Revenue) : null) : "—"}</td>` : ""}
          <td><div class="sal-ev">${rf ? refundPill(r) : flagPills(r.Flag)}${role === "Estimator" ? evidence(r) : ""}${
            writtenAs(r) ? `<span class="rs-pill mute" title="the name as written in the slot">written “${esc(r["Name Raw"])}”</span>` : ""}</div></td>
        </tr>`;
      }).join("");
      return `<table class="rs-table"><thead><tr><th>Date</th><th>Request #</th><th>Customer</th>
          <th class="num">Revenue</th>${role === "Estimator" ? "<th>Sold by (their pay)</th>" : ""}${role === "All" ? "<th>Role</th>" : ""}
          ${role === "Sales Person" ? '<th class="num">Slot</th>' : ""}<th class="num">Typed rate</th>
          <th class="num">${role === "Branch Owner" ? "Cut" : "Pay"}</th>${role === "Branch Owner" ? '<th class="num">Cut %</th>' : ""}
          <th>${role === "Estimator" ? "Evidence and flags" : "Flags"}</th></tr></thead>
        <tbody>${body}</tbody></table>${rs.length > cap
          ? `<p class="rs-hint" style="margin:8px 12px">Showing the ${cap} most recent of ${fmtN(rs.length)} — the CSV has them all.</p>` : ""}`;
    }

    function toggle(tr) {
      const p = cur.people[+tr.dataset.i];
      if (!p) return;
      const next = tr.nextElementSibling;
      if (S.open.has(p.person)) {
        S.open.delete(p.person);
        tr.classList.remove("on");
        if (next && next.classList.contains("rs-sub")) next.remove();
      } else {
        S.open.add(p.person);
        tr.classList.add("on");
        const ncol = tr.children.length;
        tr.insertAdjacentHTML("afterend", subRow(p, cur.role, ncol));
      }
    }

    /* Refunds the office took commission back on whose request matches no closing with a paid
       slot -- a mistyped request number, a move before 2023, the CL partner's own sheet. They are
       deducted from nobody: the name on the refunds sheet is shown, never used to charge anyone. */
    function loosePanel(sc) {
      const rs = sc.filter(r => isRef(r) && !r.Role && matchQ(r))
        .sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")));
      if (!rs.length) return "";
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Refunds with no paid slot to deduct from</div>
          <span class="sal-pills"><span class="rs-pill warn">${fmtN(rs.length)} · ${m0(rs.reduce((a, r) => a + num(r["Refund Reduction"]), 0))}</span></span></div>
        <p class="rs-hint">The refunds sheet took this commission back, but its request number matches no
          closing with a paid salesperson slot, so none of it is deducted above. The name the refunds
          sheet gives is shown, never charged: a mistyped request is fixed on the sheet.</p>
        <div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Refund date</th><th>Request #</th><th>Customer</th><th>Refunds sheet names</th>
            <th class="num">Commission taken back</th><th>Note</th></tr></thead>
          <tbody>${rs.map(r => `<tr>
            <td class="nowrap">${esc(dLabel(r.Date))}</td>
            <td class="nowrap">${esc(r["Request #"] || "—")}<span class="sal-sm">${esc(r.Company || "")}</span></td>
            <td>${esc(r.Customer || "—")}</td>
            <td class="strong">${esc(r.Person || "—")}</td>
            <td class="num sal-neg">${m2(-num(r["Refund Reduction"]))}</td>
            <td><div class="sal-ev"><span class="sal-sm">${esc(r["Refund Note"] || "")}</span></div></td>
          </tr>`).join("")}</tbody></table></div>
      </div>`;
    }

    function lookPanel(rs, role) {
      const flagged = rs.filter(r => r.Flag).sort((a, b) => String(b.Date || "").localeCompare(String(a.Date || "")));
      if (!flagged.length) return "";
      const cap = 60;
      const counts = {};
      flagged.forEach(r => String(r.Flag).split("; ").forEach(f => { counts[f] = (counts[f] || 0) + 1; }));
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Needs a look</div>
          <span class="sal-pills">${Object.keys(counts).sort().map(f =>
            `<span class="rs-pill ${FLAG_TONE[f] || "mute"}" title="${esc(FLAG_WHY[f] || "")}">${esc(f)} ×${fmtN(counts[f])}</span>`).join("")}</span></div>
        <p class="rs-hint">Rows the sheet leaves open. Nothing here is priced: a slot with no pay stays
          at $0 and a DC-only estimator has no amount, because nothing records one.</p>
        <div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Move date</th><th>Request #</th><th>Person</th><th class="num">Recorded pay</th>
            <th>What</th>${role === "Estimator" ? "<th>Sold by (their pay)</th>" : ""}</tr></thead>
          <tbody>${flagged.slice(0, cap).map(r => `<tr>
            <td class="nowrap">${esc(dLabel(r.Date))}</td>
            <td class="nowrap">${esc(r["Request #"] || "—")}<span class="sal-sm">${esc(r.Customer || "")}</span></td>
            <td class="strong">${esc(r.Person || "—")}</td>
            <td class="num">${isSlot(r) ? m0(r.Pay) : "—"}</td>
            <td><div class="sal-ev">${flagPills(r.Flag)}${role === "Estimator" ? evidence(r) : ""}</div></td>
            ${role === "Estimator" ? `<td><div class="sal-sold">${esc(r["Salespeople On Job"] || "—")}</div></td>` : ""}
          </tr>`).join("")}</tbody></table></div>
        ${flagged.length > cap ? `<p class="rs-hint" style="margin-top:8px">Showing ${cap} of ${fmtN(flagged.length)} — the CSV has every row.</p>` : ""}
      </div>`;
    }

    function mountBar() {
      const bar = host.querySelector("#salBar");
      if (!bar) return;
      const tabs = document.createElement("div");
      tabs.className = "rs-tabs";
      tabs.setAttribute("role", "tablist");
      TABS.forEach(t => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "rs-tab" + (t.key === S.tab ? " on" : "");
        b.setAttribute("role", "tab");
        b.setAttribute("aria-selected", t.key === S.tab ? "true" : "false");
        b.textContent = t.label;
        b.onclick = () => {
          if (S.tab === t.key) return;
          S.tab = t.key; S.open.clear(); S.sort = "net"; S.dir = -1;
          try { history.replaceState(null, "", "#page=salaries&tab=" + t.key); } catch (e) { /* file:// */ }
          paint();
        };
        tabs.appendChild(b);
      });
      bar.appendChild(tabs);

      const seg = document.createElement("div");
      seg.className = "rs-seg";
      [["Last month", last, last], ["3 months", back(3), last], ["6 months", back(6), last],
       ["This year", (last || "").slice(0, 4) + "-01", last],
       ["All time", months[0] || "", months[months.length - 1] || last]]
        .forEach(([l, f, t]) => {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = l;
          if (S.from === f && S.to === t) b.className = "on";
          b.onclick = () => { S.from = f; S.to = t; paint(); };
          seg.appendChild(b);
        });
      const segWrap = document.createElement("div");
      segWrap.className = "rs-fld";
      segWrap.innerHTML = "<span>Period</span>";
      segWrap.appendChild(seg);
      bar.appendChild(segWrap);
      const mv = months.map(m => ({ v: m, l: mLabel(m) }));
      RSC.localSelect(bar, { label: "From", required: true, values: mv, value: S.from,
        onChange: v => { S.from = v; if (S.to < S.from) S.to = S.from; paint(); } });
      RSC.localSelect(bar, { label: "To", required: true, values: mv, value: S.to,
        onChange: v => { S.to = v; if (S.from > S.to) S.from = S.to; paint(); } });

      const g = document.createElement("div");
      g.className = "rs-seg";
      [["month", "Month"], ["period", "Pay period"]].forEach(([v, l]) => {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = l;
        if (S.grp === v) b.className = "on";
        b.onclick = () => { if (S.grp !== v) { S.grp = v; paint(); } };
        g.appendChild(b);
      });
      const gWrap = document.createElement("div");
      gWrap.className = "rs-fld";
      gWrap.innerHTML = "<span>Group by</span>";
      gWrap.appendChild(g);
      bar.appendChild(gWrap);

      RSC.localSelect(bar, { label: "Company", values: companies, value: S.co, allLabel: "All companies",
        onChange: v => { S.co = v; paint(); } });

      const q = document.createElement("input");
      q.className = "rs-inp";
      q.placeholder = "find a person…";
      q.value = S.q;
      q.setAttribute("aria-label", "Find a person");
      q.oninput = () => { clearTimeout(qTimer);
        qTimer = setTimeout(() => { S.q = q.value; S._focus = 1; paint(); }, 300); };
      bar.appendChild(q);
      const sp = document.createElement("div");
      sp.className = "rs-spacer";
      bar.appendChild(sp);
      const csv = document.createElement("button");
      csv.type = "button";
      csv.className = "rs-btn";
      csv.textContent = "Download CSV";
      csv.onclick = () => downloadCsv(tab().roles || ALL_ROLES, tab().key);
      bar.appendChild(csv);
      if (S._focus) { S._focus = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
    }

    /* The rows of ONE role under the current filters -- what an accountant pastes into a sheet.
       Commission rows, refund rows (Pay negative) and, on the Estimator tab, DC-only rows (no Pay),
       so the Pay column adds up to the tab's net pay. The CL partner and Yelp Team have their own
       CSV on the Sales Person tab's 'Other slot pay' panel: mixed in, they put the CL partner's
       $26,748 (35 rows) into a Sales Person file whose tab showed $167,741 (Zip to Zip, Jul-Sep
       2026, measured 24 Sep). */
    function downloadCsv(roles, fileKey) {
      const rs = scoped().filter(r => roles.includes(r.Role) && matchQ(r))
        .sort((a, b) => String(a.Date || "").localeCompare(String(b.Date || "")));
      const head = ["Row", "Date", "Pay Period", "Pay Date", "Company", "Request #", "Customer", "Moving Type",
                    "Revenue", "Person", "Role", "SP Slot", "Name on the sheet", "Typed Rate", "Pay",
                    "Refund Reduction", "Refund Note", "Branch Owner Second Slot",
                    "Salespeople On Job", "DC Estimator", "Calendar Estimator", "Flag"];
      // formula-injection guard: a leading =+-@ becomes text (crew-salaries.js, the referral-list rule)
      const cell = v => {
        let s = String(v == null ? "" : v);
        if (/^[=+\-@]/.test(s)) s = " " + s;
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      // numbers stay numbers: a negative refund share is written bare, not through the text guard
      const numCell = v => v === "" ? "" : String(v);
      const lines = [head.join(",")].concat(rs.map(r => [
        cell(r.Kind), cell(String(r.Date || "").slice(0, 10)), cell(r["Pay Period"]),
        cell(String(r["Pay Date"] || "").slice(0, 10)), cell(r.Company), cell(r["Request #"]), cell(r.Customer),
        cell(r["Moving Type"]), numCell(isSlot(r) && has(r.Revenue) ? num(r.Revenue).toFixed(2) : ""),
        cell(r.Person), cell(r.Role), cell(r["SP Slot"]), cell(r["Name Raw"]),
        numCell(has(r["Typed Rate"]) ? num(r["Typed Rate"]) : ""),
        numCell(has(r.Pay) ? num(r.Pay).toFixed(2) : ""),
        numCell(has(r["Refund Reduction"]) ? num(r["Refund Reduction"]).toFixed(2) : ""),
        cell(r["Refund Note"]), cell(r["Branch Owner Second Slot"]),
        cell(r["Salespeople On Job"]), cell(r["DC Estimator"]), cell(r["Calendar Estimator"]), cell(r.Flag),
      ].join(",")));
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "salaries-" + fileKey + "-" + (S.co || "all").replace(/\s+/g, "-").toLowerCase()
        + "-" + (S.from || "") + "-to-" + (S.to || "") + ".csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }

    // LAST, after every const the paint path reads (boMine, ROLE_HEAD, BO_BRK, BO_SORT, ymShift):
    // called any earlier, the Branch Owner and All people tabs died in the temporal dead zone
    paint();
  },
});
