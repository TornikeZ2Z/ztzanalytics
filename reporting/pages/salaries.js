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
 *   Sales Person         reps typed Sales Rep. The CL partner (Peter Montanaro) and Yelp Team are
 *                        paid through the same slots but are not reps: they sit in 'Other slot
 *                        pay', inside the tie-out and never ranked among reps.
 *   Branch Owner         his cut only, so it equals His Cut on the Branch Owner page. His smaller
 *                        slot on a two-slot job is found by the mart's `Branch Owner Second Slot`,
 *                        never by his name (a bare 'Kolbaia' may be someone else, his 10 Jul ruling).
 *
 * COMMISSION IS AS RECORDED ON THE CLOSING SHEET, BY MOVE DATE -- never rate x revenue (only 62%
 * of 2026 slots equal that). REFUNDS are the mart's `Kind`='Refund' rows: the refunds sheet's
 * 'Sales Commission Reduced Amount', dated by the refund date, matched to the job by request
 * number (never by the name on the refunds sheet) and split over the job's paid slots in
 * proportion to pay, so every role carries its share. Their `Pay` is negative: Net = commission +
 * refunds. A refund whose request has no paid slot is deducted from nobody; the Sales Person tab
 * lists those so they are not lost. 2026 to 23 Sep: $3,625 taken back on 113 refunds.
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
             "Branch Owner Second Slot", "Refund Reduction", "Refund Note"],
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

    const TABS = [
      { key: "estimator", label: "Estimator", role: "Estimator", plural: "Estimators" },
      { key: "sales-person", label: "Sales Person", role: "Sales Person", plural: "Salespeople" },
      { key: "branch-owner", label: "Branch Owner", role: "Branch Owner", plural: "Branch owner" },
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
      tab: TABS.some(t => t.key === bootTab) ? bootTab : "estimator",
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

    paint();

    function paint() {
      const t = tab();
      const sc = scoped();
      const rs = sc.filter(r => r.Role === t.role && matchQ(r));
      const people = byPerson(rs);
      const keys = [...new Set(sc.filter(r => (isSlot(r) || isRef(r)) && r.Role).map(pkey).filter(Boolean))].sort();
      const key = { net: p => p.net, pay: p => p.pay, ref: p => -p.ref, jobs: p => p.jobs, rev: p => p.rev,
                    rate: p => p.rate == null ? -1 : p.rate, person: p => p.person }[S.sort] || (p => p.net);
      people.sort((a, b) => { const x = key(a), y = key(b);
        return (typeof x === "string" ? x.localeCompare(y) : x - y) * S.dir; });
      cur = { people, role: t.role, keys };

      host.innerHTML = `<div class="sal">${head}
        <div class="rs-bar" id="salBar"></div>
        <div class="rs-kpis" id="salKpis"></div>
        ${tieOut(sc)}
        ${refundLine(sc)}
        ${t.role === "Branch Owner" ? boNote(sc) : ""}
        <div class="panel">
          <div class="panel-head"><div class="panel-title">${esc(t.plural)}
            by ${S.grp === "period" ? "pay period" : "month"}</div></div>
          <p class="rs-hint">Click a name for the jobs and refunds behind the number. The ${S.grp === "period" ? "pay-period" : "month"}
            columns are net: commission on that ${S.grp === "period" ? "period's" : "month's"} moves, less refunds dated in it.${t.role === "Estimator"
            ? " Each job shows who sold it and what they were paid, and what the digital contract (DC) and the calendar say about the estimator." : ""}
            ${S.grp === "period" ? " Pay periods follow the ERP: moves on the 1st–15th are paid on the 14th of the next month, moves on the 16th to month end on the 30th (the last day of a shorter month)." : ""}</p>
          ${people.length ? personTable(people, keys, t.role) : `<div class="rs-hint">Nobody in this tab for ${esc(S.co || "all companies")}, ${esc(perTxt())}${S.q ? " matching “" + esc(S.q) + "”" : ""}.</div>`}
        </div>
        ${t.role === "Sales Person" ? otherPanel(sc) + loosePanel(sc) : ""}
        ${lookPanel(rs, t.role)}
        <p class="rs-hint sal-foot">Commission as recorded on the closing sheet, by move date. Refunds are the
          refunds sheet's "Sales Commission Reduced Amount", by refund date, matched to the job by request
          number and split over its paid slots in proportion to pay. Base pay and payment dates are not
          recorded in the warehouse, so this is pay earned, not pay paid.</p>
      </div>`;

      mountBar();
      RSC.kpis(host.querySelector("#salKpis"), kpis(rs, sc, t.role));
      host.querySelectorAll("[data-sort]").forEach(el => {
        el.onclick = () => {
          const k = el.dataset.sort;
          if (S.sort === k) S.dir = -S.dir; else { S.sort = k; S.dir = k === "person" ? 1 : -1; }
          paint();
        };
      });
      host.querySelectorAll("tr.rs-group[data-i]").forEach(tr => { tr.onclick = () => toggle(tr); });
      const oth = host.querySelector("#salOthCsv");
      if (oth) oth.onclick = () => downloadCsv(OTHER_ROLES, "other-slot-pay");
      const wrap = host.querySelector("#salTbl");
      if (wrap && window.innerWidth >= 900 && RSC.fitScroller) {
        try { RSC.fitScroller(wrap); } catch (e) { /* the kit's default height stands */ }
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
        const oth = sc.filter(r => (isSlot(r) || isRef(r)) && OTHER_ROLES.includes(r.Role) && matchQ(r));
        const ar = avg(ratesOf(slots));
        return [
          { label: "Net sales person pay", value: m0(net), sub: netSub, tone: "pos" },
          { label: "Jobs", value: fmtN(jobs), sub: `${fmtN(paid)} of ${fmtN(slots.length)} slots paid` },
          { label: "Revenue of those jobs", value: m0(rev), sub: "the whole bill of each job" },
          { label: "Avg typed rate", value: ar == null ? "—" : rateTxt(ar), sub: "mean of the rates typed on paid slots" },
          { label: "People", value: fmtN(people), sub: "reps typed Sales Rep on the roster" },
          { label: "Other slot pay", value: m0(sumPay(oth)), sub: "CL partner + Yelp Team, net, not ranked" },
        ];
      }
      // his smaller slot of two, by the mart's own marker -- a name would also catch a bare 'Kolbaia'
      const est = sc.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes");
      return [
        { label: "His cut", value: m0(pay), sub: `= His Cut on the Branch Owner page; refunds ${mS(ref)}, net ${m0(net)}`, tone: "pos" },
        { label: "Jobs", value: fmtN(jobs), sub: "jobs where he takes a cut" },
        { label: "Revenue of those jobs", value: m0(rev), sub: "the whole bill of each job" },
        { label: "Cut % of revenue", value: pctTxt(rev ? pay / rev : null), sub: "his cut over those bills" },
        { label: "His estimator pay", value: m0(sumPay(est)), sub: `two-slot jobs (${fmtN(est.length)}) — on the Estimator tab` },
      ];
    }

    function tieOut(sc) {
      const slot = sc.filter(isSlot);
      const by = {};
      slot.forEach(r => { by[r.Role] = (by[r.Role] || 0) + num(r.Pay); });
      const est = by["Estimator"] || 0, sp = by["Sales Person"] || 0, bo = by["Branch Owner"] || 0;
      const oth = OTHER_ROLES.reduce((a, k) => a + (by[k] || 0), 0);
      const tot = est + sp + bo + oth;
      const sheet = slot.reduce((a, r) => a + num(r["Sheet SP Salary"]), 0);
      const off = Math.round(tot - sheet);
      const role = tab().role;
      const part = (label, v, r) => `<span class="${r === role ? "on" : ""}">${label} <b>${m0(v)}</b></span>`;
      return `<div class="sal-tie">${part("Estimator", est, "Estimator")} + ${part("Sales Person", sp, "Sales Person")}
        + ${part("Branch Owner", bo, "Branch Owner")} + ${part("Other slot pay (CL partner, Yelp Team)", oth, "")}
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
      const est = by["Estimator"] || 0, sp = by["Sales Person"] || 0, bo = by["Branch Owner"] || 0;
      const oth = OTHER_ROLES.reduce((a, k) => a + (by[k] || 0), 0);
      const lone = refs.filter(r => !r.Role);
      const loneAmt = lone.reduce((a, r) => a + num(r["Refund Reduction"]), 0);
      const role = tab().role;
      const part = (label, v, r) => `<span class="${r === role ? "on" : ""}">${label} <b class="sal-neg">${mS(v)}</b></span>`;
      return `<div class="sal-tie">Refunds dated in this range, taken off the paid slots of each refunded job in
        proportion to pay: ${part("Estimator", est, "Estimator")} + ${part("Sales Person", sp, "Sales Person")}
        + ${part("Branch Owner", bo, "Branch Owner")} + ${part("Other slot pay", oth, "")}
        = <b class="sal-neg">${mS(est + sp + bo + oth)}</b>.${lone.length
          ? ` <span class="rs-pill warn" title="${esc(FLAG_WHY["No paid slot to deduct from"])}">${fmtN(lone.length)} more (${m0(loneAmt)})
              match no paid slot — deducted from nobody${role === "Sales Person" ? ", listed below" : ", listed on the Sales Person tab"}</span>` : ""}</div>`;
    }

    function boNote(sc) {
      const est = sumPay(sc.filter(r => isSlot(r) && r["Branch Owner Second Slot"] === "Yes"));
      return `<p class="rs-hint">His branch-owner cut only. On a job where he holds two salesperson
        slots, the larger is his cut and the other is estimator pay (his ruling, 23 Sep)${est
          ? ` — ${m0(est)} in this range, on the Estimator tab` : ""}. His cut equals His Cut on the
        <a class="sal-link" href="#page=branch-owner">Branch Owner</a> page for the same dates and company;
        that page has the profit view. Refunds on his jobs come off in proportion to his share of the
        job's salesperson pay, as for everyone else.</p>`;
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
          ${role === "Sales Person" ? `<td class="num">${has(r["SP Slot"]) ? "SP " + esc(r["SP Slot"]) : "—"}</td>` : ""}
          <td class="num">${rateTxt(r["Typed Rate"])}</td>
          <td class="num strong${rf ? " sal-neg" : ""}">${dc ? '<span title="nothing records an amount">—</span>' : rf ? m2(r.Pay) : m0(r.Pay)}</td>
          ${role === "Branch Owner" ? `<td class="num">${isSlot(r) ? pctTxt(num(r.Revenue) ? num(r.Pay) / num(r.Revenue) : null) : "—"}</td>` : ""}
          <td><div class="sal-ev">${rf ? refundPill(r) : flagPills(r.Flag)}${role === "Estimator" ? evidence(r) : ""}${
            writtenAs(r) ? `<span class="rs-pill mute" title="the name as written in the slot">written “${esc(r["Name Raw"])}”</span>` : ""}</div></td>
        </tr>`;
      }).join("");
      return `<table class="rs-table"><thead><tr><th>Date</th><th>Request #</th><th>Customer</th>
          <th class="num">Revenue</th>${role === "Estimator" ? "<th>Sold by (their pay)</th>" : ""}
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

    function otherPanel(sc) {
      const rs = sc.filter(r => (isSlot(r) || isRef(r)) && OTHER_ROLES.includes(r.Role) && matchQ(r));
      const groups = byPerson(rs).map(p => ({ ...p, role: p.rows[0].Role }))
        .sort((a, b) => b.net - a.net);
      const slots = rs.filter(isSlot), refs = rs.filter(isRef);
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Other slot pay</div><span class="spacer"></span>
          ${groups.length ? '<button type="button" class="rs-btn" id="salOthCsv">Download CSV</button>' : ""}</div>
        <p class="rs-hint">Paid through the same salesperson slots and counted in the tie-out, but not
          ranked among reps: the CL partner's slot is his deposit, not a commission (no rate is typed
          on any of his slots), and Yelp Team is a channel, not a person. Kept out of the Sales Person
          CSV, so its Pay column adds up to the tab; this panel has a CSV of its own.</p>
        ${groups.length ? `<div class="rs-tablewrap"><table class="rs-table">
          <thead><tr><th>Payee</th><th>Role</th><th class="num">Jobs</th><th class="num">Slots paid</th>
            <th class="num">Revenue of jobs</th><th class="num">Commission</th><th class="num">Refunds</th>
            <th class="num">Net pay</th></tr></thead>
          <tbody>${groups.map(p => `<tr><td class="strong">${esc(p.person)}</td>
            <td><span class="rs-pill mute">${esc(p.role)}</span></td>
            <td class="num">${fmtN(p.jobs)}</td><td class="num">${fmtN(p.paid)} / ${fmtN(p.slots)}</td>
            <td class="num">${m0(p.rev)}</td><td class="num">${m0(p.pay)}</td>
            <td class="num${p.ref ? " sal-neg" : ""}">${p.ref ? mS(p.ref) : "—"}</td>
            <td class="num strong">${mS(p.net)}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td colspan="2">Other slot pay</td><td class="num">${fmtN(jobsOf(rs))}</td>
            <td class="num">${fmtN(slots.filter(r => num(r.Pay) !== 0).length)} / ${fmtN(slots.length)}</td>
            <td class="num">${m0(revOf(rs))}</td><td class="num">${m0(sumPay(slots))}</td>
            <td class="num${refs.length ? " sal-neg" : ""}">${refs.length ? mS(sumPay(refs)) : "—"}</td>
            <td class="num">${mS(sumPay(rs))}</td></tr></tfoot>
        </table></div>` : '<div class="rs-hint">None in this range.</div>'}
      </div>`;
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
      csv.onclick = () => downloadCsv([tab().role], tab().key);
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
  },
});
