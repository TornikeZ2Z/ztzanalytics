/* Insights & Recommendations — auto-computed monthly findings.
   Always renders the CURRENT-MONTH perspective from the full warehouse
   (global filter bar is intentionally NOT applied — noted in the header).
   Everything below is rule-based and computed live; no hand-written numbers.

   Page structure (C13 rebuild): findings are grouped by theme —
   Money leaks / People / Opportunities / Data health. Every finding's FIRST
   sentence states a dollar-or-job impact, severity is a word chip
   (Urgent / Watch / Good news / FYI), and each finding carries a
   "Why am I seeing this" expander with the trigger math in plain words.
   Rule IDs (I1..I19) reference the approved insight-rule backlog; every rule
   has a minimum-volume floor so it cannot fire on noise. */
registerPage({
  id: "insights",
  group: "pulse",
  title: "Insights & Recommendations",
  async render(host) {
    // Load each dataset ONCE (RS.load caches); every rule below reuses these arrays.
    const [closing, moveboard, scorecard, cardExp, claims, refunds,
           storage, callrail, leadsP, reviewCounts, reviewGoals, longDist,
           negReviews, helperSal, salesSal] = await Promise.all([
      RS.load("closing"), RS.load("moveboard"), RS.load("scorecard"),
      RS.load("card_expenses"), RS.load("claims"), RS.load("refunds"),
      RS.load("storage"), RS.load("callrail"), RS.load("leads"),
      RS.load("review_counts"), RS.load("review_goals"), RS.load("long_distance"),
      RS.load("negative_reviews"), RS.load("helper_salaries"), RS.load("sales_salaries")]);
    const M = RS.M, num = RS.num;

    /* ---------- empty-state guard: no dated closing rows → friendly message ---------- */
    if (!closing.length || !closing.some(r => r._d)) {
      host.innerHTML = `
        <div class="rs-page-head"><h1>Insights &amp; Recommendations</h1></div>
        <div class="insight-note">No data for the current filters — the closing dataset has no dated rows, so the monthly pulse cannot be computed.</div>`;
      return;
    }

    /* ---------- month helpers (anchored to the freshest closing date) ---------- */
    const maxD = closing.reduce((a, r) => (r._d > a ? r._d : a), "");
    const anchor = new Date(maxD + "T00:00:00");
    const mk = d => d.toISOString().slice(0, 7);                     // "YYYY-MM"
    const mkOff = i => mk(new Date(anchor.getFullYear(), anchor.getMonth() - i, 15));
    const CUR = maxD.slice(0, 7);                                    // current month
    const dayOf = +maxD.slice(8, 10);                                // days elapsed
    const daysInMonth = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    const prevM = mkOff(1), prev2M = mkOff(2);
    const lyM = (anchor.getFullYear() - 1) + "-" + CUR.slice(5);     // same month LY
    const monthLabel = k => RS.monthName(+k.slice(5)) + " " + k.slice(0, 4);
    const pct = (a, b) => (b ? (a - b) / Math.abs(b) : null);
    const avgOf = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    const chip = (g, inv) => g == null ? "" :
      `<span class="${(inv ? g <= 0 : g >= 0) ? "up" : "down"}">${g >= 0 ? "▲" : "▼"} ${Math.abs(100 * g).toFixed(1)}%</span>`;
    // Rounded dollar estimate for sentences ("roughly $61,000") — never false precision.
    const rough = v => {
      if (v == null || isNaN(v)) return "$0";
      const a = Math.abs(v);
      const r = a >= 20000 ? 1000 : a >= 2000 ? 100 : a >= 100 ? 10 : 1;
      return (v < 0 ? "-$" : "$") + (Math.round(a / r) * r).toLocaleString();
    };
    const pc = v => (v == null || isNaN(v)) ? "—" : (100 * v).toFixed(1) + "%";
    const ord = n => {   // 1 -> "1st", 22 -> "22nd", 13 -> "13th"
      const teens = Math.floor(n % 100 / 10) === 1;
      return n + ((teens || n % 10 > 3 || n % 10 === 0) ? "th" : ["th", "st", "nd", "rd"][n % 10]);
    };
    // Label of the C38 baseline window ("average of the prior 6 months"), offsets 2..7.
    const priorSixLabel = `${monthLabel(mkOff(7))} – ${monthLabel(mkOff(2))}`;

    /* ---------- one month-index per dataset (built once, reused by every rule) ---------- */
    const idxMonth = rows => {
      const g = {};
      for (const r of rows) { if (!r._d) continue; const k = r._d.slice(0, 7); (g[k] = g[k] || []).push(r); }
      return g;
    };
    const clM = idxMonth(closing), mbM = idxMonth(moveboard), refM = idxMonth(refunds),
          ceM = idxMonth(cardExp), clmM = idxMonth(claims), stoM = idxMonth(storage),
          ldM = idxMonth(longDist), ldsM = idxMonth(leadsP), crM = idxMonth(callrail),
          rcM = idxMonth(reviewCounts), rgM = idxMonth(reviewGoals);
    // Moveboard indexed by BOOKED month too — the canonical Booking Rate needs both sides.
    const mbBooked = {};
    moveboard.forEach(r => {
      const d = String(r["Booked Date"] || "").slice(0, 10);
      if (d.length === 10) (mbBooked[d.slice(0, 7)] = mbBooked[d.slice(0, 7)] || []).push(r);
    });
    const inMonth = (rows, m) => rows.filter(r => r._d && r._d.slice(0, 7) === m);
    const mtdOf = m => (clM[m] || []).filter(r => +r._d.slice(8, 10) <= dayOf);

    /* ---------- current-month pulse (KPI strip) ---------- */
    const curRows = clM[CUR] || [];
    const prevMtd = mtdOf(prevM), lyMtd = mtdOf(lyM);
    const bill = M["Revenue"].fn(curRows), jobs = curRows.length;
    const closeRev = M["Total Revenue"].fn(curRows);                 // closings only
    const tripRev = M["Additional Revenue from Trips"].fn(curRows);  // appended trips
    const projBill = dayOf ? bill / dayOf * daysInMonth : null;
    const projJobs = dayOf ? Math.round(jobs / dayOf * daysInMonth) : null;
    const lyFull = M["Revenue"].fn(clM[lyM] || []);
    /* Projection gate (audit F10, D5): a linear run-rate off 1–9 days multiplies
       unrepresentative days by 10–31× — pure noise. Before day 10 we blank the
       projection KPI (showing last-month/LY anchors instead), drop its vs-LY chip
       and the pace rule, and tag the kept same-days-vs-LY chips as noisy. */
    const projGated = dayOf < RS.MIN_MONTH_DAYS;
    const noisyTag = projGated ? ` · first ${dayOf} day${dayOf === 1 ? "" : "s"} — noisy` : "";
    const prevFull = M["Revenue"].fn(clM[prevM] || []);   // anchor: last full month

    // Company-wide reference numbers reused by several rules below.
    const avgBill = M["Average Bill"].fn(clM[prevM] || []) || M["Average Bill"].fn(closing) || 0;
    const companyBook = RS.bookingRate(mbM[prevM] || [], mbBooked[prevM] || []);

    host.innerHTML = `
      <div class="rs-page-head">
        <h1>Insights & Recommendations</h1>
        <p>Auto-generated monthly findings · data through <b>${maxD}</b> (day ${dayOf} of ${daysInMonth})</p>
      </div>
      <div class="insight-note">This page always shows the current-month view across the whole business — the global filter bar does not apply here.
        Findings look at <b>${monthLabel(prevM)}</b> (the last full month) unless they say otherwise; open “Why am I seeing this” under any finding for the exact math.</div>
      <div class="rs-kpis" id="kpis"></div>
      <div class="panel"><div class="panel-head"><span class="panel-title">Money leaks</span>
        <span style="font-size:11px;color:var(--faint)">dollars going missing right now</span></div><div id="th-money"></div></div>
      <div class="rs-grid2">
        <div class="panel"><div class="panel-head"><span class="panel-title">People</span>
          <span style="font-size:11px;color:var(--faint)">reps, crews and follow-up</span></div><div id="th-people"></div></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">Opportunities</span>
          <span style="font-size:11px;color:var(--faint)">what's working — feed it</span></div><div id="th-opps"></div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><span class="panel-title">Data health</span>
          <span style="font-size:11px;color:var(--faint)">numbers you can't trust yet · data through ${maxD}</span></div>
        <div id="th-data"></div>
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--faint);margin:12px 0 8px">Closing-sheet housekeeping</div>
        <div id="health" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px"></div>
      </div>
      <div class="rs-grid2">
        <div class="panel"><div class="panel-head"><span class="panel-title">What moved last month (${monthLabel(prevM)} vs ${monthLabel(prev2M)})</span></div><div class="tabwrap" id="movers"></div></div>
        <div class="panel"><div class="panel-head"><span class="panel-title">Foreman pulse — ${monthLabel(prevM)}</span></div><div class="tabwrap" id="foreman"></div></div>
      </div>
      <div class="panel"><div class="panel-head"><span class="panel-title">Ad efficiency — ${monthLabel(prevM)}</span></div><div class="tabwrap" id="ads"></div><div id="adscap"></div></div>`;

    /* KPI strip rendered inline (not RSC.kpis) because the subs carry HTML
       delta chips and RSC.kpis escapes the sub field. Same markup/classes. */
    const prevMtdBill = M["Revenue"].fn(prevMtd);
    document.getElementById("kpis").innerHTML = [
      { label: "Jobs — " + monthLabel(CUR), value: RS.fmtN(jobs),
        sub: `vs LY same days: ${RS.fmtN(lyMtd.length)} ` + chip(pct(jobs, lyMtd.length)) + noisyTag,
        wrap: projGated },
      { label: "Revenue MTD", value: RS.moneyC(bill),
        sub: `${RS.money(closeRev)} closings + ${RS.money(tripRev)} trips · vs LY same days ` + chip(pct(bill, M["Revenue"].fn(lyMtd))) + noisyTag,
        wrap: projGated },
      /* C38: the big number here is LAST month's total by the same day — titled as
         exactly that, with this-month-vs-that delta promoted next to the number. */
      { label: `Last month by day ${dayOf}`,
        value: RS.moneyC(prevMtdBill) +
          `<span style="font-size:12px;font-weight:700;margin-left:7px;vertical-align:2px">${chip(pct(bill, prevMtdBill))}</span>`,
        sub: `${monthLabel(prevM)} had reached ${RS.money(prevMtdBill)} by day ${dayOf}; this month sits at ${RS.money(bill)} — the arrow compares the two`,
        wrap: true },
      { label: "Projected month-end", value: (!projGated && projBill != null) ? RS.moneyC(projBill) : "—",
        sub: projGated
          ? `projection from day ${RS.MIN_MONTH_DAYS} — only ${dayOf} day${dayOf === 1 ? "" : "s"} of data · last month ${RS.money(prevFull)} · LY ${RS.money(lyFull)}`
          : (projBill != null ? `${RS.money(projBill)} · ~${RS.fmtN(projJobs || 0)} jobs at current run-rate` : ""),
        wrap: projGated },
      { label: monthLabel(lyM) + " (full)", value: RS.moneyC(lyFull),
        sub: RS.money(lyFull) + (!projGated && projBill && lyFull ? " · projection " + chip(pct(projBill, lyFull)) + " vs LY" : "") },
    ].map(x =>
      `<div class="kpi"><div class="l">${RSC.esc(x.label)}</div><div class="v">${x.value}</div><div class="s"${x.wrap ? ' style="white-space:normal"' : ""}>${x.sub || ""}</div></div>`
    ).join("");

    /* =================================================================
       FINDINGS ENGINE — push(theme, severity, firstSentence, detail, why)
       themes: money | people | opps | data
       severities (plain words): urgent | watch | good | fyi
       ================================================================= */
    const findings = [];
    const push = (th, sev, t, d, why) => findings.push({ th, sev, t, d, why });

    /* ---------- source-name join for ad rules (C12) ------------------------
       Spend keys on card_expenses Source/Provider; revenue keys on the closing
       sheets' Corrected Source (the warehouse's own standardized name), falling
       back to Source. Both sides then pass through ONE tidy-up: lowercase, strip
       spaces/punctuation, plus a small alias map for known spelling families.
       Exact-string matching used to make 'Google' vs 'Google Ads' read as a
       $0-revenue channel and scream a false money alert — never again: a spend
       source matching zero revenue is a DATA note, not a money alert. */
    const SRC_ALIAS = {
      googleads: "google", googleadwords: "google", googlead: "google",
      facebookads: "facebook", fbads: "facebook", fb: "facebook",
      yelpads: "yelp", thumbtackads: "thumbtack",
      homeadvisor: "angi",           // HomeAdvisor is Angi's old name (see Angi Analysis)
    };
    const canonSrc = s => {
      const k = String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return SRC_ALIAS[k] || k;
    };
    const _adM = {};      // offset -> { spend, rev, jobs, names, total } keyed by canonical source
    const adAt = i => {
      if (_adM[i]) return _adM[i];
      const m = mkOff(i), spend = {}, rev = {}, jobsBy = {}, names = {};
      (ceM[m] || []).forEach(r => {
        if (num(r["Is Advertising"]) !== 1) return;
        const raw = r.Source || r.Provider || "—", k = canonSrc(raw);
        spend[k] = (spend[k] || 0) + num(r.Amount); names[k] = names[k] || String(raw);
      });
      (clM[m] || []).forEach(r => {
        const raw = r["Corrected Source"] || r.Source || "—", k = canonSrc(raw);
        rev[k] = (rev[k] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]);
        jobsBy[k] = (jobsBy[k] || 0) + 1; names[k] = names[k] || String(raw);
      });
      const total = Object.values(spend).reduce((a, b) => a + b, 0);
      return _adM[i] = { spend, rev, jobs: jobsBy, names, total };
    };
    const A1 = adAt(1);

    /* ---------- kept rule: company booking-rate move (canonical RS.bookingRate,
       month-scoped on BOTH sides — created leads by create month, confirmed by
       booked month). Floor: ≥50 qualified leads in the month. ---------- */
    {
      const brOf = m => {
        const created = mbM[m] || [];
        return { q: created.filter(r => r["Status Category"] !== "Bad Lead").length,
                 r: RS.bookingRate(created, mbBooked[m] || []) };
      };
      const now = brOf(prevM), was = brOf(prev2M);
      if (now.r != null && was.r != null && now.q >= 50) {
        const diff = now.r - was.r;
        const jobsMoved = Math.round(Math.abs(diff) * now.q);
        const why = `Trigger: Booking Rate (confirmed leads by booked date ÷ qualified leads by create date — the portal's one official formula) moved 2 points or more month-over-month, with at least 50 qualified leads. ` +
          `${monthLabel(prevM)}: ${pc(now.r)} of ${RS.fmtN(now.q)} qualified leads vs ${pc(was.r)} in ${monthLabel(prev2M)}. Job estimate = the rate change × qualified leads; dollars = jobs × the ${rough(avgBill)} average job.`;
        if (diff <= -0.02)
          push("money", "urgent",
            `Roughly ${rough(jobsMoved * avgBill)} of bookings slipped away: booking rate fell ${(100 * -diff).toFixed(1)} points in ${monthLabel(prevM)}`,
            `${pc(now.r)} of ${RS.fmtN(now.q)} qualified leads booked, vs ${pc(was.r)} the month before — about ${jobsMoved} fewer booked jobs. Review follow-up speed and quote levels.`,
            why);
        else if (diff >= 0.02)
          push("opps", "good",
            `About ${jobsMoved} extra booked jobs (~${rough(jobsMoved * avgBill)}): booking rate rose ${(100 * diff).toFixed(1)} points in ${monthLabel(prevM)}`,
            `${pc(now.r)} of qualified leads booked — whatever changed, keep doing it.`,
            why);
      }
    }

    /* ---------- ad-channel money rules (C12 fix + I9 early warning) ----------
       One pass per spend source: zero matched revenue → data note; return < 1× →
       money loss (Urgent); return ≥ 1× but under half its own 3-month norm → I9
       early warning (Watch) so budget isn't burned for months before the old
       under-1× rule would have noticed. */
    Object.entries(A1.spend).forEach(([k, v]) => {
      const name = A1.names[k] || k, rev = A1.rev[k] || 0;
      const ret = v ? rev / v : null;
      if (v >= 500 && rev === 0) {          // C12: naming problem, never a money alert
        push("data", "fyi",
          `${rough(v)} of ${monthLabel(prevM)} ad spend on '${name}' matches no closing jobs by name`,
          `No closing jobs carry this source name — check the spelling on the closing sheets or on the card-expense entry. Until the names line up, this channel's return can't be measured.`,
          `Trigger: an advertising source with $500+ of monthly card spend whose name — after tidying spelling, spacing and known aliases — matches zero closing-sheet sources. This is a naming problem to fix, not a money loss.`);
        return;
      }
      if (v >= 500 && ret != null && ret < 1) {
        push("money", "urgent",
          `${name} lost about ${rough(v - rev)} in ${monthLabel(prevM)}: ${rough(v)} of ads brought back ${rough(rev)}`,
          `That is ${ret.toFixed(2)} of revenue per $1 of ads. Consider moving budget, or check how jobs from this channel get their source written on the closing sheet.`,
          `Trigger: revenue per $1 of ads under 1.00 with $500+ of monthly spend. Spend and revenue are matched by source name through one tidy-up map (spelling, spacing, 'Google' vs 'Google Ads'), using the closing sheets' corrected source where present.`);
        return;
      }
      if (v >= 1000 && ret != null && ret >= 1) {   // I9 — channel return collapsing
        const hist = [2, 3, 4].map(j => {
          const A = adAt(j), s = A.spend[k] || 0;
          return s >= 250 ? (A.rev[k] || 0) / s : null;
        }).filter(x => x != null);
        if (hist.length === 3) {
          const base = avgOf(hist);
          if (base > 0 && ret < 0.5 * base) {
            const sPrev = adAt(2).spend[k] || 0;
            const spendChg = pct(v, sPrev);
            push("money", "watch",
              `${name} is heading toward wasting money: ${rough(v)} of ads returned ${ret.toFixed(1)}× in ${monthLabel(prevM)} vs its usual ${base.toFixed(1)}×`,
              `Still above break-even, but the return dropped by more than half` +
              (spendChg != null && spendChg > 0.05 ? ` while spend rose ${Math.abs(100 * spendChg).toFixed(0)}%` : "") +
              `. Worth a look before it actually starts losing money.`,
              `Trigger: return per ad dollar under 50% of this channel's own average over ${monthLabel(mkOff(4))}–${monthLabel(mkOff(2))} (${base.toFixed(1)}×), with $1,000+ of monthly spend. Fires early — before the channel drops under 1× — instead of staying silent until the money is already lost.`);
          }
        }
      }
    });

    /* ---------- I2 — booked but never closed (Wave A) ---------- */
    {
      const iso = (y, m, d) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
      const cut = iso(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 14);
      const lo = iso(anchor.getFullYear(), anchor.getMonth() - 4, anchor.getDate());
      const closingKeys = new Set(closing.map(r => String(r["Unique Key"])));
      const ghosts = moveboard.filter(r => {
        if (r["Status Category"] !== "Confirmed") return false;
        const mv = String(r["Move Date"] || "").slice(0, 10);
        if (mv.length !== 10 || mv > cut || mv < lo) return false;
        const cc = r["Closing Sheet Connector"];
        return cc == null || cc === "" || !closingKeys.has(String(cc));
      });
      if (ghosts.length >= 5) {
        const quoted = ghosts.reduce((a, r) => a + num(r["Average Quote"]), 0);
        push("money", "urgent",
          `${rough(quoted)} of quoted work is confirmed but never reached a closing sheet (${ghosts.length} jobs)`,
          `These jobs were booked, their move date passed more than 14 days ago, and no closing sheet is linked — each one was either cancelled late or moved and never recorded. Check them in Moveboard before the money trail goes cold.`,
          `Trigger: confirmed leads with a move date between ${lo} and ${cut} (at least 14 days in the past) and no linked closing sheet. Found ${ghosts.length}; fires at 5 or more. The dollar figure sums their average quotes — an estimate of the work's value, not billed revenue.`);
      }
    }

    /* ---------- I3 — old unpaid balances (Wave A; trips unattributed per decision) ---------- */
    {
      const cut = new Date(Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 30))
        .toISOString().slice(0, 10);
      const due = closing.filter(r => num(r["Balance Due"]) > 0 && r._d && r._d <= cut);
      const total = due.reduce((a, r) => a + num(r["Balance Due"]), 0);
      if (total > 5000 && due.length >= 3) {
        // Trip rows never get salesperson attribution (owner's rule) — they count
        // in the total but are EXCLUDED from the per-salesperson listing.
        const named = due.filter(r => r["Record Source"] !== "trip");
        const tripTotal = total - named.reduce((a, r) => a + num(r["Balance Due"]), 0);
        const top = (rows, col) => {
          const g = {};
          rows.forEach(r => { const k = String(r[col] || "").trim() || "—";
            g[k] = g[k] || { $: 0, n: 0 }; g[k].$ += num(r["Balance Due"]); g[k].n++; });
          return Object.entries(g).sort((a, b) => b[1].$ - a[1].$);
        };
        const custs = top(named, "Customer").slice(0, 2);
        const reps = top(named, "Sales Person").slice(0, 3);
        push("money", "urgent",
          `${rough(total)} of unpaid balances sits on ${due.length} jobs finished more than 30 days ago`,
          (custs.length ? `${rough(custs.reduce((a, c) => a + c[1].$, 0))} of it is on just ${custs.length === 1 ? "one customer" : "two customers"} (${custs.map(c => c[0]).join(", ")}). ` : "") +
          (reps.length ? `By salesperson: ${reps.map(r => `${r[0]} ${rough(r[1].$)} (${r[1].n} job${r[1].n === 1 ? "" : "s"})`).join(" · ")}. ` : "") +
          (tripTotal > 0 ? `${rough(tripTotal)} sits on trip jobs, which carry no salesperson.` : ""),
          `Trigger: closing rows with a Balance Due above $0 and a move date on or before ${cut} (30+ days ago), firing when they total more than $5,000. The salesperson split leaves out trip rows — trips never get salesperson attribution — but their balances still count in the total.`);
      }
    }

    /* ---------- I4 — profit-margin dip, with the culprit named (Wave B) ----------
       Reuses the Operational Profit formula pattern from rs-core.js:474-494.
       The registered "Operational Profit by Formula" measure evaluates in the
       GLOBAL filter scope, so the same formula is rebuilt here per month:
       Total Bill − (Foreman + Driver + Helper pay + Sales commissions) −
       (Car + Fuel + Hotel + Tolls + Truck + Other expenses + Refunds).
       Helper/sales pay is scoped to the month via closing Unique-Key membership;
       refunds slice by refund month. The salesperson-deduction term is 0
       client-side — the same known gap the Financial Analysis page carries. */
    const _pnl = {};
    const pnl = m => {
      if (m in _pnl) return _pnl[m];
      const rows = clM[m] || [];
      if (!rows.length) return _pnl[m] = null;
      const keys = new Set(rows.map(r => String(r["Unique Key"])));
      const lines = {
        "Foreman pay":  M["Forman Salary"].fn(rows),
        "Driver pay":   M["Driver Salary"].fn(rows),
        "Helper pay":   M["Helper Salary"].fn(helperSal.filter(r => keys.has(String(r["Unique Key"])))),
        "Sales commissions": M["Sales Commission"].fn(salesSal.filter(r => keys.has(String(r["Unique Key"])))),
        "Car":    M["Car Expense"].fn(rows),
        "Fuel":   M["Fuel Expense"].fn(rows),
        "Hotels": M["Hotel Expense"].fn(rows),
        "Tolls":  M["Toll Expense"].fn(rows),
        "Truck":  M["Truck Expense"].fn(rows),
        "Other job expenses": M["Other Expenses"].fn(rows),
        "Refunds": M["Total Refunds"].fn(refM[m] || []),
      };
      const b = M["Total Bill"].fn(rows);
      const cost = Object.values(lines).reduce((a, x) => a + x, 0);
      return _pnl[m] = { bill: b, lines, profit: b - cost, margin: b ? (b - cost) / b : null, jobs: rows.length };
    };
    {
      const now = pnl(prevM);
      const bases = [2, 3, 4, 5, 6, 7].map(i => pnl(mkOff(i)))
        .filter(p => p && p.margin != null && p.jobs >= 10);
      if (now && now.margin != null && now.jobs >= 20 && bases.length >= 4) {
        const baseMargin = avgOf(bases.map(p => p.margin));
        if (baseMargin - now.margin > 0.05) {
          const impact = (baseMargin - now.margin) * now.bill;
          const movers = Object.keys(now.lines).map(l => ({
            l, d: now.lines[l] - avgOf(bases.map(p => p.lines[l] || 0)) }))
            .filter(x => x.d > 500).sort((a, b) => b.d - a.d).slice(0, 2);
          const baseBill = avgOf(bases.map(p => p.bill));
          const revG = pct(now.bill, baseBill);
          const revText = revG == null ? "" :
            Math.abs(revG) < 0.05 ? " while revenue stayed flat" :
            revG > 0 ? ` while revenue was up ${Math.abs(100 * revG).toFixed(0)}%` :
                       ` while revenue was down ${Math.abs(100 * revG).toFixed(0)}%`;
          push("money", "urgent",
            `${rough(impact)} of profit went missing in ${monthLabel(prevM)}: margin was ${pc(now.margin)} vs your ${pc(baseMargin)} norm`,
            (movers.length
              ? `Biggest movers: ${movers.map(x => `${x.l} +${rough(x.d)}`).join(" and ")} above their usual level${revText}.`
              : `No single cost line stands out — the dip is spread across several lines${revText}.`) +
            ` Margin, not sales, is the ${monthLabel(prevM)} problem.`,
            `Trigger: Operational Profit margin (revenue minus crew, driver, helper and sales pay, job expenses and refunds, ÷ revenue) more than 5 points below its average over the prior 6 months (${priorSixLabel}) — ${monthLabel(prevM)} itself is excluded from that average. The dollar figure = the margin gap × the month's revenue. Each cost line is compared to its own prior-6-month average to name the movers. One small deduction line (salesperson deductions) isn't in the portal's data yet — same as on the Financial Analysis page.`);
        }
      }
    }

    /* ---------- I5 — sales rep booking slump (Wave A; canonical RS.bookingRate) ---------- */
    {
      const repRows = (arr, rep) => arr.filter(r => String(r.Assigned || "").trim() === rep);
      const rateOf = (rep, m) => {
        const created = repRows(mbM[m] || [], rep);
        return { qual: created.filter(r => r["Status Category"] !== "Bad Lead").length,
                 rate: RS.bookingRate(created, repRows(mbBooked[m] || [], rep)) };
      };
      const reps = [...new Set((mbM[prevM] || []).map(r => String(r.Assigned || "").trim()).filter(Boolean))];
      reps.forEach(rep => {
        const now = rateOf(rep, prevM);
        if (now.qual < 30 || now.rate == null) return;           // floor: 30 qualified leads
        const hist = [2, 3, 4].map(i => rateOf(rep, mkOff(i)).rate).filter(v => v != null);
        if (hist.length < 3) return;
        const usual = avgOf(hist);
        if (usual - now.rate >= 0.08) {
          const lostJobs = Math.round((usual - now.rate) * now.qual);
          push("people", "urgent",
            `${rep}'s slump cost about ${lostJobs} booked jobs (~${rough(lostJobs * avgBill)}) in ${monthLabel(prevM)}`,
            `${rep} booked ${pc(now.rate)} of ${RS.fmtN(now.qual)} qualified leads, down from a usual ${pc(usual)}.` +
            (companyBook != null ? ` The team overall booked ${pc(companyBook)}.` : "") +
            ` Worth a check-in before another month passes.`,
            `Trigger: this rep's Booking Rate (the portal's one official formula — confirmed by booked date ÷ qualified by create date) at least 8 points below their own ${monthLabel(mkOff(4))}–${monthLabel(mkOff(2))} average, with at least 30 qualified leads in the month. Job estimate = the rate gap × their qualified leads; dollars = jobs × the ${rough(avgBill)} average job.`);
        }
      });
    }

    /* ---------- kept rule: foreman score declining 2 months running ---------- */
    // foreman -> month -> scorecard row (shared by this rule and I12 below)
    const scByF = {};
    scorecard.forEach(r => {
      if (r._d) (scByF[r.Foreman] = scByF[r.Foreman] || {})[r._d.slice(0, 7)] = r;
    });
    {
      Object.entries(scByF).forEach(([f, mm]) => {
        const r1 = mm[prevM], r2 = mm[prev2M], r3 = mm[mkOff(3)];
        if (!r1 || !r2 || !r3) return;
        if (num(r1["Total Jobs"]) < 5) return;                   // floor: 5 jobs last month
        const a = num(r1["Forman Score"]), b = num(r2["Forman Score"]), c = num(r3["Forman Score"]);
        if (a < b && b < c)
          push("people", "watch",
            `${f}'s score slid two months in a row across ${RS.fmtN(num(r1["Total Jobs"]))} jobs: ${c.toFixed(1)} → ${b.toFixed(1)} → ${a.toFixed(1)}`,
            `Worth a check-in; the score's components (jobs, packing, reviews, fault claims) are on the Foremen pages.`,
            `Trigger: the monthly scorecard score fell in each of the last two months (${monthLabel(mkOff(3))} → ${monthLabel(prev2M)} → ${monthLabel(prevM)}), with at least 5 jobs in the latest month so one odd job can't swing it.`);
      });
    }

    /* ---------- I11 — one crew driving the claims (Wave A) ---------- */
    {
      const sc = inMonth(scorecard, prevM);
      const teamJobs = sc.reduce((a, r) => a + num(r["Total Jobs"]), 0);
      const teamClaims = sc.reduce((a, r) => a + num(r["Forman Fault Claims"]), 0);
      const teamRate = teamJobs ? 100 * teamClaims / teamJobs : 0;
      sc.forEach(r => {
        const f = r.Foreman, fc = num(r["Forman Fault Claims"]), j = num(r["Total Jobs"]);
        const rate = j ? 100 * fc / j : 0;
        const byCount = fc >= 3;
        const byRate = j >= 15 && teamRate > 0 && rate > 2 * teamRate && fc >= 2;
        if (byCount || byRate)
          push("people", "watch",
            `${f} had ${fc} at-fault claims in ${monthLabel(prevM)} across ${RS.fmtN(j)} jobs — ${rate.toFixed(0)} per 100 jobs vs the team's ${teamRate.toFixed(0)}`,
            `Claims cost refunds and review damage; the Claims page shows what each one was about.`,
            `Trigger: 3+ at-fault claims in the month, or an at-fault rate more than double the team average with at least 15 jobs (so a foreman with 2 jobs and 1 claim can't top the list). At-fault counts come from the monthly foreman scorecard.`);
      });
    }

    /* ---------- I12 — foreman packing drop (Wave A) ---------- */
    {
      Object.entries(scByF).forEach(([f, mm]) => {
        const now = mm[prevM];
        if (!now) return;
        const j = num(now["Total Jobs"]), cf = num(now["Total CF"]);
        if (j < 10 || cf <= 0) return;                           // floors: 10 jobs + real CF
        const nowP = num(now["Packing per 100 CF"]);
        // baseline months must have recorded CF too (skips the $90 assumed-value months)
        const hist = [2, 3, 4].map(i => mm[mkOff(i)])
          .filter(r2 => r2 && num(r2["Total CF"]) > 0)
          .map(r2 => num(r2["Packing per 100 CF"]));
        if (hist.length < 3) return;
        const usual = avgOf(hist);
        if (usual > 0 && nowP < 0.75 * usual) {
          const gap$ = (usual - nowP) * cf / 100;
          push("people", "watch",
            `${rough(gap$)} of packing revenue left on the truck: ${f} wrote $${nowP.toFixed(0)} per 100 cubic feet in ${monthLabel(prevM)} vs his usual $${usual.toFixed(0)}`,
            `Across his ${RS.fmtN(j)} jobs (${RS.fmtN(cf)} cubic feet moved), that gap adds up. Packing materials are sold job by job — worth asking what changed.`,
            `Trigger: packing dollars per 100 cubic feet below 75% of this foreman's own ${monthLabel(mkOff(4))}–${monthLabel(mkOff(2))} average, with at least 10 jobs and real recorded cubic feet in every month compared (months where cubic feet weren't recorded are skipped). Dollar gap = (usual − current) × his cubic feet ÷ 100.`);
        }
      });
    }

    /* ---------- kept rules: claims / refunds spike — C38 baseline fix ----------
       Baseline = average of the PRIOR 6 months (offsets 2..7), EXCLUDING the month
       being judged, so a real spike can't dampen its own baseline. Labeled as such. */
    {
      const claimN = i => (clmM[mkOff(i)] || []).length;
      const base = avgOf([2, 3, 4, 5, 6, 7].map(claimN));
      const nowN = claimN(1);
      if (base > 0 && nowN >= 5 && nowN > 1.5 * base)
        push("people", "watch",
          `${nowN} claims came in during ${monthLabel(prevM)} — 1.5× the usual ~${base.toFixed(1)} a month`,
          `Check the Claims page for the responsibility split; claims caused by the crew foreman feed the scorecard.`,
          `Trigger: last month's claim count above 1.5× the average of the prior 6 months (${priorSixLabel} — ${monthLabel(prevM)} itself is excluded from the average), with at least 5 claims so two odd weeks can't fire it.`);
      const refByI = i => M["Total Refunds"].fn(refM[mkOff(i)] || []);
      const refBase = avgOf([2, 3, 4, 5, 6, 7].map(refByI));
      const refNow = refByI(1);
      if (refBase > 500 && refNow >= 1000 && refNow > 1.5 * refBase)
        push("money", "watch",
          `${rough(refNow)} of refunds went out in ${monthLabel(prevM)} — ${(refNow / refBase).toFixed(1)}× the usual ${rough(refBase)} a month`,
          `The Sales Person page shows commission deductions tied to refunds; the Customer Experience page lists each refund.`,
          `Trigger: last month's refund dollars above 1.5× the average of the prior 6 months (${priorSixLabel} — ${monthLabel(prevM)} itself is excluded from the average), with floors of $1,000 refunded and a $500+ baseline so quiet periods can't trip it.`);
    }

    /* ---------- I10 — refunds concentrating in one cause or person (Wave A) ---------- */
    {
      const win = [1, 2, 3].flatMap(i => refM[mkOff(i)] || []);
      const tot = win.reduce((a, r) => a + num(r["Total refund"]), 0);
      if (win.length >= 5 && tot >= 2000) {
        const conc = col => {
          const g = {};
          win.forEach(r => { const k = String(r[col] || "").trim(); if (!k) return;
            g[k] = (g[k] || 0) + num(r["Total refund"]); });
          const top = Object.entries(g).sort((a, b) => b[1] - a[1])[0];
          return top && top[1] >= 0.4 * tot && top[1] >= 2000 ? { k: top[0], $: top[1] } : null;
        };
        // strongest single concentration wins (avoids three near-duplicate findings)
        const cands = [
          { c: conc("Reason"), lbl: "cause" },
          { c: conc("Foreman"), lbl: "foreman" },
          { c: conc("Sales Person"), lbl: "salesperson" },
        ].filter(x => x.c).sort((a, b) => b.c.$ - a.c.$);
        if (cands.length) {
          const w = cands[0];
          push("money", "watch",
            `${rough(w.c.$)} of the last 3 months' refunds — ${Math.round(100 * w.c.$ / tot)}% — traces to one ${w.lbl}: ${w.c.k}`,
            `Total refunds ${monthLabel(mkOff(3))}–${monthLabel(prevM)}: ${rough(tot)} across ${win.length} refunds. When one ${w.lbl} carries this much of it, fixing that one thing moves the whole number.`,
            `Trigger: over the trailing 3 months, a single refund reason, foreman or salesperson accounts for 40%+ of refund dollars and at least $2,000, with at least 5 refunds in the window. Shown: the largest single concentration.`);
        }
      }
    }

    /* ---------- I13 — month out of season (Wave A) ---------- */
    const revAt = i => M["Revenue"].fn(clM[mkOff(i)] || []);
    {
      let cur12 = 0, prior12 = 0;
      for (let i = 1; i <= 12; i++) cur12 += revAt(i);
      for (let i = 13; i <= 24; i++) prior12 += revAt(i);
      const growth = prior12 > 0 ? cur12 / prior12 - 1 : 0;
      const seasonDev = i => {
        const key = mkOff(i), yy = +key.slice(0, 4), mm2 = key.slice(5);
        const a = M["Revenue"].fn(clM[(yy - 1) + "-" + mm2] || []);
        const b = M["Revenue"].fn(clM[(yy - 2) + "-" + mm2] || []);
        if (a < 10000 || b < 10000) return null;                 // floor: both prior years present
        const exp = (a + b) / 2 * (1 + growth);
        return exp ? { dev: (revAt(i) - exp) / exp, exp } : null;
      };
      const s = seasonDev(1);
      if (s && Math.abs(s.dev) >= 0.15) {
        const d2 = seasonDev(2), d3 = seasonDev(3);
        const onTrend = d2 && d3 && Math.abs(d2.dev) < 0.15 && Math.abs(d3.dev) < 0.15;
        const mName = RS.monthName(+prevM.slice(5));
        const below = s.dev < 0;
        push(below ? "money" : "opps", below ? "watch" : "good",
          `${monthLabel(prevM)} closed ${rough(Math.abs(revAt(1) - s.exp))} ${below ? "below" : "above"} a typical ${mName}: ${rough(revAt(1))} vs ${rough(s.exp)} expected`,
          `Expected = the average of the last two ${mName}s adjusted for your ${(100 * growth).toFixed(0)}% yearly growth.` +
          (onTrend ? ` ${monthLabel(mkOff(3))} and ${monthLabel(prev2M)} were on trend, so this looks specific to ${mName} — not a general ${below ? "slowdown" : "boom"}.` : ""),
          `Trigger: last month's revenue at least 15% away from the average of the same calendar month in the prior 2 years, scaled by the trailing-12-month growth rate (last 12 full months vs the 12 before: ${(100 * growth).toFixed(0)}%). Needs both prior years' same month on record to fire.`);
      }
    }

    /* ---------- I14 — state demand surge (Wave A) ---------- */
    {
      const lyPrevM = (+prevM.slice(0, 4) - 1) + "-" + prevM.slice(5);
      const stateOf = r => String(r["State Name"] || r.State || "").trim();
      const cntBy = m => {
        const g = {};
        (mbM[m] || []).forEach(r => { const s = stateOf(r); if (s) g[s] = (g[s] || 0) + 1; });
        return g;
      };
      const nowC = cntBy(prevM), lyC = cntBy(lyPrevM);
      Object.keys(nowC).forEach(st => {
        const n = nowC[st], l = lyC[st] || 0;
        if (n < 50 || !l || (n - l) / l < 0.4) return;           // floor: 50 leads, +40% vs LY
        const stRows = (mbM[prevM] || []).filter(r => stateOf(r) === st);
        const stBookedRows = (mbBooked[prevM] || []).filter(r => stateOf(r) === st);
        const stRate = RS.bookingRate(stRows, stBookedRows);
        const stQual = stRows.filter(r => r["Status Category"] !== "Bad Lead").length;
        let gapTxt = "", why2 = "";
        if (stRate != null && companyBook != null && companyBook - stRate > 0.03) {
          const worth = (companyBook - stRate) * stQual * avgBill;
          gapTxt = ` But you book only ${pc(stRate)} there vs ${pc(companyBook)} overall — closing that gap is worth roughly ${rough(worth)} a month.`;
          why2 = ` The dollar figure = (overall booking rate − ${st}'s rate) × its qualified leads × the ${rough(avgBill)} average job.`;
        } else if (stRate != null) {
          gapTxt = ` Booking rate there: ${pc(stRate)} vs ${pc(companyBook)} overall.`;
        }
        push("opps", "good",
          `${RS.fmtN(n)} leads came from ${st} in ${monthLabel(prevM)} — up ${Math.round(100 * (n - l) / l)}% vs last year's ${RS.fmtN(l)}.${gapTxt}`,
          `Demand surges are the cheapest growth there is — the leads are already arriving.`,
          `Trigger: a state's Moveboard leads up 40%+ vs the same month last year with at least 50 leads.${why2}`);
      });
    }

    /* ---------- I15 — card expense category spike, non-ad (Wave A) ---------- */
    {
      const catAt = i => {
        const g = {};
        (ceM[mkOff(i)] || []).forEach(r => {
          if (num(r["Is Advertising"]) === 1) return;
          const c = String(r["Expense Category"] || "").trim() || "—";
          g[c] = (g[c] || 0) + num(r.Amount);
        });
        return g;
      };
      const cats = [1, 2, 3, 4, 5, 6, 7].map(catAt);
      Object.entries(cats[0]).forEach(([cat, v]) => {
        if (v < 1000) return;                                    // floor: $1,000 in the month
        const hist = [1, 2, 3, 4, 5, 6].map(i => cats[i][cat]).filter(x => x != null && x > 0);
        if (hist.length < 3) return;                             // floor: 3 months of history
        const usual = avgOf(hist);
        if (v <= 2 * usual) return;
        const big = (ceM[prevM] || [])
          .filter(r => num(r["Is Advertising"]) !== 1 &&
            (String(r["Expense Category"] || "").trim() || "—") === cat && num(r.Amount) > 0)
          .sort((a, b) => num(b.Amount) - num(a.Amount)).slice(0, 3);
        push("money", "watch",
          `'${cat}' card spend hit ${rough(v)} in ${monthLabel(prevM)} — ${(v / usual).toFixed(1)}× its usual ${rough(usual)}`,
          big.length ? `Largest transactions: ${big.map(r =>
            `${rough(num(r.Amount))}${r._d ? " on the " + ord(+r._d.slice(8, 10)) : ""}`).join(", ")}.` : "",
          `Trigger: a non-advertising card expense category above 2× its own average over the prior 6 months (${priorSixLabel} — the spike month is excluded from the average), with at least $1,000 spent and 3+ months of history for that category.`);
      });
    }

    /* ================== Wave B ================== */

    /* ---------- I19 — paid leads that never matched (data health; gates I8) ---------- */
    const isUnmatched = r => {
      const s = String(r["Matching Status"] || "").toLowerCase();
      return !s || /unmatch|not match|no match/.test(s);
    };
    const provUnmatched = {};        // provider -> unmatched share last month (read by I8)
    {
      const rows = ldsM[prevM] || [];
      const byProv = {};
      rows.forEach(r => { const p = String(r.Source || "—"); (byProv[p] = byProv[p] || []).push(r); });
      Object.entries(byProv).forEach(([p, rs]) => {
        provUnmatched[p] = rs.length ? rs.filter(isUnmatched).length / rs.length : 0;
      });
      if (rows.length >= 30) {                                   // floor: 30 paid leads
        const un = rows.filter(isUnmatched).length;
        const share = un / rows.length;
        if (share > 0.2)
          push("data", "watch",
            `${Math.round(100 * share)}% of ${monthLabel(prevM)}'s paid leads (${un} of ${rows.length}) never matched a request in Moveboard`,
            `The money spent on those leads is invisible in every per-provider return number until the matching is repaired — cost-per-booked-job figures understate bookings where matching is weak.`,
            `Trigger: more than 20% of last month's paid-lead rows have no Moveboard match recorded, out of at least 30 leads. Providers over that line get their findings tagged 'matching incomplete' instead of stated as fact.`);
      }
    }

    /* ---------- I8 — lead price vs booked jobs (Wave B; fct_leads + moveboard ONLY,
       no Angi-file plumbing; gated by I19's per-provider matching health) ---------- */
    {
      const normNo = v => String(v == null ? "" : v).replace(/\.0+$/, "").trim();
      const confirmedNo = new Set(moveboard
        .filter(r => r["Status Category"] === "Confirmed")
        .map(r => normNo(r["Job No"])).filter(Boolean));
      const rows = ldsM[prevM] || [];
      const byProv = {};
      rows.forEach(r => { const p = String(r.Source || "—"); (byProv[p] = byProv[p] || []).push(r); });
      const stats = Object.entries(byProv).map(([p, rs]) => {
        const spend = rs.reduce((a, r) => a + num(r["Lead Cost"]), 0);
        const booked = rs.filter(r => {
          const q = normNo(r["Request # From Moveboard"]);
          return q && confirmedNo.has(q);
        }).length;
        return { p, n: rs.length, spend, booked };
      }).filter(s => s.spend >= 500 && s.n >= 10);               // floors: $500 spend, 10 leads
      const cpbs = stats.filter(s => s.booked > 0).map(s => s.spend / s.booked).sort((a, b) => a - b);
      const median = cpbs.length ? cpbs[Math.floor(cpbs.length / 2)] : null;
      const best = stats.filter(s => s.booked > 0).sort((a, b) => a.spend / a.booked - b.spend / b.booked)[0];
      if (median != null && cpbs.length >= 2) stats.forEach(s => {
        if (!s.booked) return;                 // 0 booked + weak matching = unreadable; I19 covers it
        const cpb = s.spend / s.booked;
        if (cpb <= 2.5 * median) return;
        const shaky = (provUnmatched[s.p] || 0) > 0.2;
        push("money", "watch",
          `${s.p} leads cost ${rough(cpb)} per booked job in ${monthLabel(prevM)} vs your ${rough(median)} median` +
          (shaky ? " — matching incomplete, so this number understates bookings" : ""),
          `${s.booked} of ${s.n} ${s.p} leads reached a confirmed booking, on ${rough(s.spend)} of lead spend.` +
          (best && best.p !== s.p ? ` ${best.p} delivered booked jobs at ${rough(best.spend / best.booked)}.` : "") +
          (shaky ? ` ${Math.round(100 * (provUnmatched[s.p] || 0))}% of ${s.p}'s leads never matched a Moveboard request — repair the matching before cutting this budget.` : ""),
          `Trigger: a provider's lead cost per booked job (lead spend ÷ leads that reached a confirmed Moveboard booking, matched by request number) above 2.5× the median across providers, with at least $500 of monthly spend and 10 leads. Providers whose lead matching is more than 20% incomplete are tagged, not judged.`);
      });
    }

    /* ---------- I6 — storage customers going quiet (Wave B) ---------- */
    {
      const paidIn = m => {
        const s = new Set();
        (stoM[m] || []).forEach(r => { if (num(r.Amount) > 0) s.add(String(r["Job Code"] || "").trim()); });
        s.delete("");
        return s;
      };
      const p1 = paidIn(prevM), pCur = paidIn(CUR);
      const p2 = paidIn(mkOff(2)), p3 = paidIn(mkOff(3)), p4 = paidIn(mkOff(4));
      const gone = [...p2].filter(c => p3.has(c) && p4.has(c) && !p1.has(c) && !pCur.has(c));
      if (gone.length >= 3) {                                    // floor: 3 customers
        const goneSet = new Set(gone);
        let paid = 0, lastPay = "";
        [2, 3, 4].forEach(i => (stoM[mkOff(i)] || []).forEach(r => {
          if (goneSet.has(String(r["Job Code"] || "").trim())) {
            paid += num(r.Amount);
            if (r._d > lastPay) lastPay = r._d;
          }
        }));
        const monthly = paid / 3;
        const gapDays = lastPay ? Math.round((anchor - new Date(lastPay + "T00:00:00")) / 86400000) : null;
        push("money", "watch",
          `${rough(monthly)} a month of storage income is at risk: ${gone.length} steady payers have gone quiet`,
          `These customers paid in each of ${monthLabel(mkOff(4))}, ${monthLabel(mkOff(3))} and ${monthLabel(mkOff(2))} but nothing in ${monthLabel(prevM)} or since.` +
          (gapDays != null ? ` Longest gap so far: ${gapDays} days.` : "") +
          ` A quick call usually settles whether they left or just missed a payment.`,
          `Trigger: storage customers (by job code) with a payment in each of the prior 3 months and none in the last completed month or the current one, firing at 3+ customers. The monthly figure is what those customers averaged per month over the 3 paid months.`);
      }
    }

    /* ---------- I16 — review goal falling behind (Wave B) ---------- */
    {
      // review_counts / review_goals rows are cumulative platform snapshots —
      // "new reviews in a month" = latest snapshot in that month minus the prior
      // month's, summed per platform across companies.
      const platTotal = rows => {
        const best = {};
        rows.forEach(r => {
          const k = (r.Company || "—") + "|" + (r.Platform || "—");
          if (!best[k] || (r._d || "") > (best[k]._d || "")) best[k] = r;
        });
        const per = {};
        Object.values(best).forEach(r => {
          const p = String(r.Platform || "—");
          per[p] = (per[p] || 0) + num(r["Number of Reviews"]);
        });
        return per;
      };
      const c1 = platTotal(rcM[prevM] || []), c2 = platTotal(rcM[prev2M] || []);
      const g1 = platTotal(rgM[prevM] || []), g2 = platTotal(rgM[prev2M] || []);
      const laggards = [], onPace = [];
      Object.keys(g1).forEach(p => {
        if (!(p in g2) || !(p in c1) || !(p in c2)) return;      // need both snapshots
        const goalInc = g1[p] - g2[p], added = c1[p] - c2[p];
        if (goalInc < 5) return;                                 // floor: real monthly goal
        const share = added / goalInc;
        if (share < 0.7) laggards.push({ p, added, goalInc, share });
        else onPace.push(`${p} ${Math.round(100 * share)}%`);
      });
      if (laggards.length) {
        laggards.sort((a, b) => a.share - b.share);
        const w = laggards[0];
        push("people", "watch",
          `${w.p} added ${w.added} new reviews in ${monthLabel(prevM)} against a ${w.goalInc}-review monthly goal (${Math.round(100 * w.share)}% of pace)`,
          (laggards.length > 1 ? `Also behind: ${laggards.slice(1).map(l => `${l.p} at ${Math.round(100 * l.share)}%`).join(", ")}. ` : "") +
          (onPace.length ? `On pace: ${onPace.join(", ")}. ` : "") +
          `At this pace the yearly target slips — reviews come from asking on the job, so this lands with the crews.`,
          `Trigger: a platform's new public reviews for the month (latest platform count minus the prior month's) below 70% of that month's goal increase from the review-goals sheet, for goals of 5+ reviews a month.`);
      }
    }

    /* ---------- I17 — carrier margin squeeze (Wave B) ---------- */
    {
      const win = [1, 2, 3].flatMap(i => ldM[mkOff(i)] || [])
        .filter(r => num(r["Total Bill"]) > 0 && String(r["Carrier Company"] || "").trim());
      const billAll = win.reduce((a, r) => a + num(r["Total Bill"]), 0);
      const carrAll = win.reduce((a, r) => a + num(r["Total To Carrier"]), 0);
      if (billAll > 0 && win.length >= 10) {
        const avgMargin = (billAll - carrAll) / billAll;
        const byCar = {};
        win.forEach(r => {
          const c = String(r["Carrier Company"]).trim();
          byCar[c] = byCar[c] || { bill: 0, carr: 0, n: 0 };
          byCar[c].bill += num(r["Total Bill"]); byCar[c].carr += num(r["Total To Carrier"]); byCar[c].n++;
        });
        Object.entries(byCar).forEach(([c, x]) => {
          if (x.n < 5 || x.bill <= 0) return;                    // floor: 5 jobs
          const margin = (x.bill - x.carr) / x.bill;
          if (avgMargin - margin > 0.10) {
            const gap$ = (avgMargin - margin) * x.bill;
            push("money", "watch",
              `${rough(gap$)} given up on jobs handed to ${c}: you kept a ${pc(margin)} margin vs your ${pc(avgMargin)} long-distance average`,
              `${x.n} jobs over ${monthLabel(mkOff(3))}–${monthLabel(prevM)}, ${rough(x.bill)} billed, ${rough(x.carr)} paid to the carrier. Worth renegotiating the rate or re-routing these jobs.`,
              `Trigger: a carrier's kept margin ((billed − paid to carrier) ÷ billed) over the trailing 3 months more than 10 points below the long-distance average, with at least 5 jobs. Dollar figure = the margin gap × that carrier's billed total.`);
          }
        });
      }
    }

    /* ---------- I18 — negative reviews going stale (Wave B) ---------- */
    {
      const iso = d => new Date(Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - d))
        .toISOString().slice(0, 10);
      const cut14 = iso(14), lo90 = iso(90);
      const isResolved = s => /resolv|closed|done|complete|fixed/i.test(String(s || ""));
      const stale = negReviews.filter(r => r._d && r._d >= lo90 && r._d <= cut14 && !isResolved(r.Status));
      if (stale.length >= 3) {                                   // floor: 3 reviews
        const unid = stale.filter(r => num(r["Is Identified"]) !== 1).length;
        const oldest = stale.reduce((a, r) => (!a || r._d < a ? r._d : a), "");
        const oldestDays = oldest ? Math.round((anchor - new Date(oldest + "T00:00:00")) / 86400000) : null;
        push("people", "watch",
          `${stale.length} negative reviews are still unresolved after 14+ days${oldestDays != null ? ` (oldest: ${oldestDays} days)` : ""} — each one costs future jobs while it sits`,
          (unid ? `${unid} of them ${unid === 1 ? "is" : "are"} not yet identified — nobody knows which job they belong to, so nobody is fixing them. ` : "") +
          `The Customer Experience page lists each one.`,
          `Trigger: negative reviews from the last 90 days whose status isn't resolved and that are older than 14 days, firing at 3 or more. 'Not identified' means the review hasn't been tied to a job yet.`);
      }
    }

    /* ---------- I7 — winning channel underfunded (Wave B; floors per decision) ---------- */
    {
      Object.keys(A1.spend).forEach(k => {
        const name = A1.names[k] || k;
        // 3 consecutive months: return ≥3× AND ≥8 attributed jobs AND <10% of ad budget
        const okAll = [1, 2, 3].every(i => {
          const A = adAt(i), s = A.spend[k] || 0;
          return s > 0 && (A.jobs[k] || 0) >= 8 && (A.rev[k] || 0) / s >= 3 &&
                 A.total > 0 && s / A.total < 0.10;
        });
        if (!okAll) return;
        if ((A1.spend[k] || 0) > (adAt(2).spend[k] || 0) * 1.05) return; // spend flat or falling
        const ret = (A1.rev[k] || 0) / A1.spend[k];
        push("opps", "good",
          `${name} brought back ${ret.toFixed(1)}× per ad dollar on just ${rough(A1.spend[k])} of spend in ${monthLabel(prevM)} — and it's done that 3 months straight`,
          `It gets under 10% of the ad budget and its spend isn't growing, while returning $3+ per $1 with at least 8 attributed jobs every month. Worth testing more budget and watching whether the return holds.`,
          `Trigger: 3 consecutive months at 3×+ revenue per ad dollar, at least 8 attributed jobs each month (so 2 lucky jobs on a tiny channel can't fire this), under 10% of total ad spend, and spend flat or falling month-over-month. No specific dollar shift is suggested — returns can drop as spend scales, so test in steps.`);
      });
    }

    /* ---------- kept rule: big source declines MoM (jobs) — normalized names ---------- */
    {
      const A2 = adAt(2);
      Object.keys(A2.jobs).filter(k => A2.jobs[k] >= 20).forEach(k => {  // floor: 20 jobs
        const nowJ = A1.jobs[k] || 0, prevJ = A2.jobs[k];
        const g = pct(nowJ, prevJ);
        if (g != null && g <= -0.3) {
          const name = A1.names[k] || A2.names[k] || k;
          push("money", "watch",
            `${prevJ - nowJ} fewer jobs from ${name} in ${monthLabel(prevM)} — ${prevJ} → ${nowJ}, down ${Math.abs(100 * g).toFixed(0)}%`,
            `If spend didn't change, the funnel for this source needs a look; if spend was cut on purpose, this is the expected result.`,
            `Trigger: a source's completed jobs down 30%+ month-over-month, from a base of at least 20 jobs. Source names are matched through the same tidy-up map the ad rules use.`);
        }
      });
    }

    /* ---------- kept rule: pace vs LY (suppressed before day 10 — projection gate) ---------- */
    if (!projGated && projBill != null && lyFull > 0 && projBill < lyFull * 0.95)
      push("money", "watch",
        `${monthLabel(CUR)} is pacing ${rough(lyFull - projBill)} behind ${monthLabel(lyM)}: projected ${rough(projBill)} vs ${rough(lyFull)} last year`,
        `Early-month projections are noisy — treat this as a heads-up, not a verdict, and watch it firm up as the month fills in.`,
        `Trigger: this month's straight-line projection (revenue so far ÷ ${dayOf} days × ${daysInMonth}) at least 5% below the same month last year. Suppressed entirely before day ${RS.MIN_MONTH_DAYS}, when a projection would be pure noise.`);

    /* ---------- I1 — missed-call revenue leak (CallRail half ONLY) ----------
       TODO (Wave 3): the RingCentral half of this rule (fct_ringcentral —
       Direction + Action Result columns for missed/voicemail office calls)
       needs a proper DATASETS entry in rs-core.js before it can be counted
       here. Do NOT approximate it from CallRail; CallRail only sees tracked
       marketing lines, so this finding says so and says "up to". */
    {
      const rows = crM[prevM] || [];
      if (rows.length >= 100) {                                  // floor: 100 tracked calls
        const isMissed = r => num(r["Duration Seconds"]) === 0 ||
          /miss|abandon|voicemail/i.test(String(r["Call Status"] || ""));
        const isFT = r => {
          const s = String(r["First-Time Caller"]).toLowerCase();
          return s === "1" || s === "true";
        };
        const missed = rows.filter(isMissed);
        const share = missed.length / rows.length;
        const ftShare = missed.length ? missed.filter(isFT).length / missed.length : 0;
        const est = missed.length * ftShare * (companyBook || 0) * avgBill;
        if (share > 0.10 || est > 10000) {
          push("money", "watch",
            (est > 0 ? `Up to ${rough(est)} at risk: ` : "") +
            `${missed.length} of ${RS.fmtN(rows.length)} tracked calls in ${monthLabel(prevM)} were missed or never connected (${Math.round(100 * share)}%)`,
            `${Math.round(100 * ftShare)}% of the missed calls were first-time callers — likely new customers who may not call twice. This counts CallRail-tracked marketing lines only; office lines aren't counted yet, so the real number may be higher.`,
            `Trigger: missed calls (0-second or marked missed/voicemail/abandoned) above 10% of tracked calls, or the estimated value at risk above $10,000. Estimate = missed calls × the first-time-caller share among them × the ${pc(companyBook)} booking rate × the ${rough(avgBill)} average job — an upper bound ("up to"), since not every missed caller was a bookable move.`);
        }
      }
    }

    /* =================================================================
       RENDER FINDINGS — by theme, severity words first, expander per finding
       ================================================================= */
    const SEV = {
      urgent: { w: "Urgent",    c: "var(--red)" },
      watch:  { w: "Watch",     c: "var(--amber)" },
      good:   { w: "Good news", c: "var(--brand)" },
      fyi:    { w: "FYI",       c: "var(--blue)" },
    };
    const SEV_ORD = { urgent: 0, watch: 1, good: 2, fyi: 3 };
    const recHtml = f => {
      const s = SEV[f.sev];
      return `<div class="rec" style="flex-direction:column;gap:7px">
        <div style="display:flex;gap:10px;align-items:flex-start;width:100%">
          <span style="flex:none;margin-top:2px;font-size:10px;font-weight:800;letter-spacing:.02em;padding:2px 8px;border-radius:99px;border:1px solid ${s.c};color:${s.c};white-space:nowrap">${s.w}</span>
          <div><div class="t">${RSC.esc(f.t)}</div>${f.d ? `<div class="d">${RSC.esc(f.d)}</div>` : ""}</div>
        </div>
        ${f.why ? `<details style="margin:0 0 2px 2px"><summary style="cursor:pointer;font-size:11px;color:var(--faint)">Why am I seeing this</summary><div style="font-size:11.5px;color:var(--muted);line-height:1.55;padding:6px 2px 2px">${RSC.esc(f.why)}</div></details>` : ""}
      </div>`;
    };
    const CAP = 8;   // per-theme cap so one bad month doesn't become a wall of text
    const renderTheme = (th, elId) => {
      const list = findings.filter(f => f.th === th).sort((a, b) => SEV_ORD[a.sev] - SEV_ORD[b.sev]);
      document.getElementById(elId).innerHTML = list.length
        ? list.slice(0, CAP).map(recHtml).join("") +
          (list.length > CAP ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${CAP} of ${list.length} findings</div>` : "")
        : `<div style="padding:4px 2px 8px;color:var(--muted);font-size:12px">Nothing to report — every signal in this group looks normal this month.</div>`;
    };
    renderTheme("money", "th-money");
    renderTheme("people", "th-people");
    renderTheme("opps", "th-opps");
    renderTheme("data", "th-data");

    /* ---------- movers table (sources by revenue, MoM) ---------- */
    {
      const revNow = {}, revPrev = {};
      (clM[prevM] || []).forEach(r => { const s = r.Source || "—"; revNow[s] = (revNow[s] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); });
      (clM[prev2M] || []).forEach(r => { const s = r.Source || "—"; revPrev[s] = (revPrev[s] || 0) + num(r["Total Bill"]) + num(r["Extra Bill From Trips"]); });
      const totalNow = Object.values(revNow).reduce((a, b) => a + b, 0);
      const all = [...new Set([...Object.keys(revNow), ...Object.keys(revPrev)])]
        .map(s => ({ s, now: revNow[s] || 0, prev: revPrev[s] || 0,
          sh: totalNow ? (revNow[s] || 0) / totalNow : null, g: pct(revNow[s] || 0, revPrev[s] || 0) }))
        .filter(x => x.now >= 5000 || x.prev >= 5000)
        .sort((a, b) => Math.abs(b.now - b.prev) - Math.abs(a.now - a.prev));
      const rows = all.slice(0, 12);
      document.getElementById("movers").innerHTML = rows.length ? RSC.table(
        [{ key: "s", label: "Source" },
         { key: "now", label: monthLabel(prevM), fmt: v => v == null ? "—" : RS.money(v) },
         { key: "sh", label: "% of total", fmt: v => v == null ? "—" : RS.fmtPct(v) },
         { key: "prev", label: monthLabel(prev2M), fmt: v => v == null ? "—" : RS.money(v) },
         { key: "g", label: "Change", fmt: g => g == null ? "—" : chip(g) }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} sources</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No sources cleared the $5k threshold in ${monthLabel(prevM)} or ${monthLabel(prev2M)}.</div>`;
    }
    /* ---------- foreman pulse (last full month leaderboard + delta) ---------- */
    {
      const all = inMonth(scorecard, prevM)
        .map(r => ({ f: r.Foreman, sc: num(r["Forman Score"]), rk: num(r["Forman Score Rank"]),
          d: r["Forman Score Prev Month"] == null ? null : num(r["Forman Score"]) - num(r["Forman Score Prev Month"]) }))
        .sort((a, b) => a.rk - b.rk);
      const rows = all.slice(0, 12);
      document.getElementById("foreman").innerHTML = rows.length ? RSC.table(
        [{ key: "rk", label: "#", fmt: v => (v == null || isNaN(v)) ? "—" : v },
         { key: "f", label: "Foreman" },
         { key: "sc", label: "Score", fmt: v => (v == null || isNaN(v)) ? "—" : v.toFixed(1) },
         { key: "d", label: "vs prior", fmt: v => (v == null || isNaN(v)) ? "—" :
           `<span class="${v >= 0 ? "up" : "down"}">${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)} pts</span>` }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} foremen</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No foreman scorecards recorded for ${monthLabel(prevM)}.</div>`;
    }
    /* ---------- ad efficiency table (normalized source join, N26 labels) ---------- */
    {
      const all = Object.entries(A1.spend).map(([k, v]) => ({
        s: A1.names[k] || k, v, rev: A1.rev[k] || 0, roi: v ? (A1.rev[k] || 0) / v : null }))
        .sort((a, b) => b.v - a.v);
      const rows = all.slice(0, 12);
      document.getElementById("ads").innerHTML = rows.length ? RSC.table(
        [{ key: "s", label: "Provider / Source" },
         { key: "v", label: "Ad Spend", fmt: v => v == null ? "—" : RS.money(v) },
         { key: "rev", label: "Attributed Revenue", fmt: v => v == null ? "—" : RS.money(v) },
         { key: "roi", label: "Revenue per $1 of ads", fmt: v => (v == null || isNaN(v)) ? "—" :
           `<span class="${v >= 3 ? "up" : v < 1 ? "down" : ""}">${v.toFixed(2)}×</span>` }], rows) +
        (all.length > rows.length ? `<div style="color:var(--muted);font-size:11px;padding:4px 2px">showing ${rows.length} of ${all.length} providers</div>` : "")
        : `<div style="padding:16px 14px;color:var(--muted)">No advertising spend recorded for ${monthLabel(prevM)}.</div>`;
      document.getElementById("adscap").innerHTML =
        `<div style="font-size:11px;color:var(--faint);padding:7px 2px 0">green = $3+ back per $1 · red = losing money · spend and revenue are matched by source name (spelling tidied on both sides)</div>`;
    }
    /* ---------- data health (audit F13) — closing-sheet hygiene counters ----------
       All computed live from the closing dataset already loaded above. Deliberately
       muted styling: these are housekeeping notes, not alerts. */
    {
      const isBlank = v => v == null || v === "";
      // 14-day window ending at maxD; UTC math so the ISO slice never shifts a day
      const cutIso = new Date(Date.UTC(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - 13))
        .toISOString().slice(0, 10);
      const awaiting = closing.filter(r => r._d && r._d >= cutIso && isBlank(r["Total Bill"])).length;
      const noForeman = closing.filter(r => isBlank(r.Foreman)).length;
      const noSource = closing.filter(r => isBlank(r.Source));
      const noSourceTrips = noSource.filter(r => r["Record Source"] === "trip").length;
      const undated = closing.filter(r => !r._d).length;
      const counters = [
        { n: awaiting, l: "Awaiting closing entry",
          h: `Jobs since ${cutIso} with no Total Bill yet — fill in the closing sheet so MTD revenue stays complete.` },
        { n: noForeman, l: "Missing foreman",
          h: "Closing rows with no Foreman — assign one so scorecard and claims attribution stay complete." },
        { n: noSource.length, l: "Missing source",
          h: `${RS.fmtN(noSourceTrips)} are trip rows, which never carry a lead source; review the other ${RS.fmtN(noSource.length - noSourceTrips)} in the sheet.` },
        { n: undated, l: "Undated rows",
          h: "Rows with no Date fall out of every month view — add the move date in the sheet." },
      ];
      document.getElementById("health").innerHTML = counters.map(c =>
        `<div style="border:1px solid var(--line);border-radius:11px;padding:10px 12px">
          <div style="font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:var(--faint)">${RSC.esc(c.l)}</div>
          <div style="font-size:18px;font-weight:800;color:var(--muted);margin-top:4px;font-variant-numeric:tabular-nums">${RS.fmtN(c.n)}</div>
          <div style="font-size:11px;color:var(--faint);margin-top:3px;line-height:1.45">${RSC.esc(c.h)}</div>
        </div>`).join("");
    }
  },
});
