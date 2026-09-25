/* FINANCIAL OVERVIEW (Financial, id financial-overview) -- Tornike 2026-09-25: "MTD / YTD
   Comparisons and stats, + explaining how many contracts missing the data. MTD should be kinda
   based on previous date - as we dont have todays contracts in the system."

   His answers (25 Sep):
   - A DAY PICKER, default yesterday (NJ). When yesterday has no closings yet (the sheet is filled
     after the job), it falls back to the newest day that has some, and says so.
   - MTD = days 1..D of the picked month, set against the same days of the 5 months before it and
     of the same month in every earlier year on file. YTD = Jan 1..the picked day, every year.
   - Company: one at a time, Zip to Zip by default.
   - Missing data = closings with blanks (no bill, no foreman, no hours or pay, no salesperson).
   - Figures: revenue / jobs / average bill, the gross-profit build-up, how the money came in,
     breakdowns; plus a month-end projection, a daily pace chart and "booked this month".

   EVERY FIGURE IS THE PORTAL'S OWN MEASURE, so a month here equals the Monthly Report's month:
   Revenue = RS.M "Total Bill" (Total Bill + Extra Bill From Trips), jobs = "Total Jobs" (trip rows
   included, as there), Gross Profit = the "Operational Profit by Formula" build-up -- revenue less
   foreman, driver, helper and sales pay, less car / fuel / hotel / tolls / truck / other, less the
   refunds DATED in the window (fct_refunds by Refund Date, the portal-wide refund basis).
   Bookings = the Booking Rate's numerator: Status Category 'Confirmed' by Booked Date, valued at
   the Moveboard quote -- read from mart_fin_bookings, a narrow table with no customer on it. */
if (window.RS && RS.DATASETS && !RS.DATASETS.fin_bookings) {
  RS.DATASETS.fin_bookings = {
    table: "mart_fin_bookings",
    cols: ["Company", "Booked Date", "Move Date", "Service Type", "Size of Move", "State", "Source",
           "Min Quote", "Max Quote", "Average Quote"],
    dateCols: { "Booked Date": "Booked Date" }, defaultDate: "Booked Date",
  };
}

registerPage({
  id: "financial-overview",
  group: "financial",
  title: "Financial Overview",
  async render(host) {
    const num = RS.num, money = RS.money, moneyC = RS.moneyC, fmtN = RS.fmtN, M = RS.M;
    const esc = s => RSC.esc(s == null ? "" : String(s));
    const has = v => v != null && String(v).trim() !== "";
    const sumC = (rs, c) => rs.reduce((a, r) => a + num(r[c]), 0);

    /* ---------- dates: plain YYYY-MM-DD strings, never a local-midnight Date ---------- */
    const pad = n => String(n).padStart(2, "0");
    const iso = (y, m, d) => y + "-" + pad(m) + "-" + pad(d);
    const dim = (y, m) => new Date(y, m, 0).getDate();
    const ymd = s => [+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)];
    const addDays = (s, n) => {
      const [y, m, d] = ymd(s);
      return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
    };
    const shiftM = (y, m, k) => { const t = y * 12 + (m - 1) + k; return [Math.floor(t / 12), (t % 12) + 1]; };
    // the business runs on New Jersey time: "yesterday" is New Jersey's yesterday, whoever reads
    const njToday = () => {
      try { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date()); }
      catch (e) { return new Date().toLocaleDateString("en-CA"); }
    };
    const MON = m => RS.monthName(m);
    const dLabel = s => s ? MON(+s.slice(5, 7)) + " " + (+s.slice(8, 10)) + ", " + s.slice(0, 4) : "—";
    const dShort = s => s ? MON(+s.slice(5, 7)) + " " + (+s.slice(8, 10)) : "—";
    const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dow = s => { const [y, m, d] = ymd(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

    /* ---------- formatting ---------- */
    const m0 = v => v == null || !isFinite(v) ? "—" : (v < 0 ? "−" + money(-v) : money(v));
    const mC = v => v == null || !isFinite(v) ? "—" : (v < 0 ? "−" + moneyC(-v) : moneyC(v));
    const pct1 = v => v == null || !isFinite(v) ? "—" : (v * 100).toFixed(1) + "%";
    const chg = (a, b) => (a == null || b == null || !isFinite(a) || !isFinite(b) || b === 0) ? null : (a - b) / Math.abs(b);
    const chgTxt = c => c == null ? "—" : (c >= 0 ? "+" : "−") + Math.abs(c * 100).toFixed(1) + "%";
    const ptsTxt = (a, b) => (a == null || b == null) ? "—"
      : (a - b >= 0 ? "+" : "−") + Math.abs((a - b) * 100).toFixed(1) + " pts";
    const chgCell = c => c == null ? `<td class="num fo-mute">—</td>`
      : `<td class="num ${c >= 0 ? "fo-up" : "fo-dn"}">${c >= 0 ? "▲" : "▼"} ${chgTxt(c)}</td>`;

    if (!document.getElementById("fo-style")) {
      const st = document.createElement("style");
      st.id = "fo-style";
      st.textContent = [
        // only what the kit cannot say; everything else is .rs-bar / .rs-kpis / table.tab / .panel
        ".fo .rs-bar .rs-seg{flex-wrap:wrap;max-width:100%}",
        ".fo-sec{font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;"
          + "color:var(--faint);margin:6px 0 8px}",
        ".fo-note{font-size:13px;line-height:1.65;color:var(--muted);background:var(--panel-2);"
          + "border:1px solid var(--line);border-radius:12px;padding:10px 14px;margin:0 0 14px}",
        ".fo-note b{color:var(--ink)}",
        ".fo-note.warn{border-color:var(--warn);}",
        ".fo .fo-up{color:var(--pos)}",
        ".fo .fo-dn{color:var(--neg)}",
        ".fo .fo-mute{color:var(--faint)}",
        ".fo table.tab tr.fo-sel td{color:var(--ink);font-weight:750}",
        ".fo table.tab tr.fo-grp td{color:var(--faint);font-size:10.5px;font-weight:800;"
          + "text-transform:uppercase;letter-spacing:.07em;text-align:left;background:transparent}",
        ".fo table.tab tr.fo-tot td{color:var(--ink);font-weight:750;border-top:1px solid var(--line-2)}",
        ".fo table.tab td.fo-l{text-align:left}",
        ".fo .fo-grid2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}",
        "@media (max-width:980px){.fo .fo-grid2{grid-template-columns:minmax(0,1fr)}}",
        ".fo .panel{margin-bottom:14px}",
        ".fo .fo-proj{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin:4px 0 10px}",
        ".fo .fo-proj .fo-pv{font-size:22px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}",
        ".fo .fo-proj .fo-pl{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--faint)}",
        ".fo .fo-proj .fo-ps{font-size:12px;color:var(--muted);margin-top:2px}",
        ".fo .fo-proj > div{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;padding:10px 14px}",
        ".fo .rs-datepop .rng input{min-width:0}",
        ".fo .fo-pick{position:relative}",
        ".fo .fo-miss{display:inline-block;padding:1px 7px;border-radius:999px;font-size:11px;font-weight:700;"
          + "border:1px solid var(--line-2);color:var(--muted);margin:1px 3px 1px 0;white-space:nowrap}",
      ].join("\n");
      document.head.appendChild(st);
    }

    const head = `<div class="report-head"><div><h2>Financial Overview</h2>
      <div class="sub">Month to date and year to date, day for day against earlier months and years,
        with how many closings are still missing data. Everything counts by move date, up to the day
        you pick.</div></div></div>`;
    host.innerHTML = `<div class="fo">${head}<div class="rs-loading">Reading the closings…</div></div>`;

    /* ================= PHASE 1: closings + bookings ================= */
    let closing, bookings = [], bookErr = null;
    try {
      closing = await RS.load("closing");
    } catch (e) {
      console.error("financial-overview closing:", e);
      host.innerHTML = `<div class="fo">${head}<div class="panel"><div class="rs-loading">The closings
        could not load (${esc(e.message || e)}). Reload the page to try again.</div></div></div>`;
      return;
    }
    try { bookings = await RS.load("fin_bookings"); }
    catch (e) { bookErr = e; bookings = []; console.error("financial-overview bookings:", e); }

    /* ---------- index: every row gets its day once; rows sorted by day per company ---------- */
    const rowDay = r => String(r.Date || "").slice(0, 10);
    const coCount = {};
    closing.forEach(r => { if (r.Company) coCount[r.Company] = (coCount[r.Company] || 0) + 1; });
    const COS = Object.keys(coCount).sort((a, b) => coCount[b] - coCount[a]);
    const ALL = "";
    const SCOPE = new Map();
    function scoped(co) {
      if (SCOPE.has(co)) return SCOPE.get(co);
      const rs = closing.filter(r => rowDay(r).length === 10 && (co === ALL || r.Company === co))
        .map(r => ({ r, d: rowDay(r) }))
        .sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      const o = { rows: rs.map(x => x.r), days: rs.map(x => x.d) };
      SCOPE.set(co, o);
      return o;
    }
    const lo = (arr, v) => { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m] < v) a = m + 1; else b = m; } return a; };
    const hi = (arr, v) => { let a = 0, b = arr.length; while (a < b) { const m = (a + b) >> 1; if (arr[m] <= v) a = m + 1; else b = m; } return a; };
    const inWin = (co, from, to) => { const s = scoped(co); return s.rows.slice(lo(s.days, from), hi(s.days, to)); };

    const bkDay = r => String(r["Booked Date"] || "").slice(0, 10);
    const BK = new Map();
    function bkScoped(co) {
      if (BK.has(co)) return BK.get(co);
      const rs = bookings.filter(r => bkDay(r).length === 10 && (co === ALL || r.Company === co))
        .map(r => ({ r, d: bkDay(r) })).sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
      const o = { rows: rs.map(x => x.r), days: rs.map(x => x.d) };
      BK.set(co, o);
      return o;
    }
    const bkWin = (co, from, to) => { const s = bkScoped(co); return s.rows.slice(lo(s.days, from), hi(s.days, to)); };
    const hasBookings = co => bkScoped(co).rows.length > 0;

    /* ================= PHASE 2 (async): the gross-profit inputs ================= */
    let P2 = null, p2Err = null;
    (async () => {
      try {
        const [salesAll, helperAll, refundAll] = await Promise.all([
          RS.load("sales_salaries"), RS.load("helper_salaries"), RS.load("refunds")]);
        const byUK = (src, col) => { const m = new Map();
          src.forEach(r => { const k = r["Unique Key"]; if (!has(k)) return; m.set(k, (m.get(k) || 0) + num(r[col])); });
          return m; };
        const refunds = refundAll.map(r => ({ r, d: String(r["Refund Date"] || "").slice(0, 10) }))
          .filter(x => x.d.length === 10);
        P2 = { sales: byUK(salesAll, "Salary"), helper: byUK(helperAll, "Amount Received"), refunds };
      } catch (e) { p2Err = e; console.error("financial-overview costs:", e); }
      if (host.isConnected && host.querySelector(".fo")) paint();
    })();
    const refundsIn = (co, from, to) => !P2 ? null : P2.refunds
      .filter(x => x.d >= from && x.d <= to && (co === ALL || x.r.Company === co))
      .reduce((a, x) => a + num(x.r["Total refund"]), 0);

    /* ---------- one window's numbers ---------- */
    function agg(co, from, to) {
      const rs = inWin(co, from, to);
      const o = { from, to, rows: rs, jobs: M["Total Jobs"].fn(rs), rev: M["Total Bill"].fn(rs) };
      o.avg = o.jobs ? o.rev / o.jobs : null;
      o.cash = M["Net Cash"].fn(rs); o.card = M["Card Payment"].fn(rs);
      o.deposit = sumC(rs, "Deposit"); o.due = sumC(rs, "Balance Due");
      o.tipCust = sumC(rs, "Tip From the Customers"); o.tipCo = sumC(rs, "Tip from Company");
      o.disc = sumC(rs, "Discount Given"); o.discN = rs.filter(r => num(r["Discount Given"]) > 0).length;
      o.packing = M["Total Packing Written"].fn(rs);
      const bk = bkWin(co, from, to);
      o.bkN = bk.length; o.bkV = sumC(bk, "Average Quote");
      if (P2) {
        const sumUK = map => rs.reduce((a, r) => a + (map.get(r["Unique Key"]) || 0), 0);
        o.forman = M["Forman Salary"].fn(rs); o.driver = M["Driver Salary"].fn(rs);
        o.helper = sumUK(P2.helper); o.sales = sumUK(P2.sales);
        o.car = M["Car Expense"].fn(rs); o.fuel = M["Fuel Expense"].fn(rs); o.hotel = M["Hotel Expense"].fn(rs);
        o.tolls = M["Toll Expense"].fn(rs); o.truck = M["Truck Expense"].fn(rs); o.other = M["Other Expenses"].fn(rs);
        o.refunds = refundsIn(co, from, to);
        o.pay = o.forman + o.driver + o.helper + o.sales;
        o.exp = o.car + o.fuel + o.hotel + o.tolls + o.truck + o.other;
        o.gp = o.rev - o.pay - o.exp - o.refunds;
        o.gm = o.rev ? o.gp / o.rev : null;
      }
      return o;
    }

    /* ---------- missing data: closings with blanks ---------- */
    const MISS = [
      ["bill", "No bill", r => !has(r["Total Bill"]) && r["Split Rebill"] !== "Yes"],
      ["foreman", "No foreman", r => !has(r.Foreman)],
      ["hours", "No foreman hours", r => !(num(r["Foreman Hours"]) > 0)],
      ["pay", "No foreman pay", r => !(num(r["Forman Total $"]) > 0)],
      ["sp", "No salesperson", r => !has(r["Sales Person"])],
    ];
    const missOf = r => r["Record Source"] !== "closing" ? [] : MISS.filter(x => x[2](r));
    function missing(co, from, to) {
      const rs = inWin(co, from, to).filter(r => r["Record Source"] === "closing");
      const out = { closings: rs.length, rows: [], by: {} };
      MISS.forEach(x => { out.by[x[0]] = 0; });
      rs.forEach(r => { const f = missOf(r); if (!f.length) return;
        f.forEach(x => { out.by[x[0]]++; }); out.rows.push({ r, f }); });
      return out;
    }

    /* ---------- state ---------- */
    const yesterday = addDays(njToday(), -1);
    const lastFilled = (co, upTo) => { const s = scoped(co);
      const i = hi(s.days, upTo) - 1; return i >= 0 ? s.days[i] : null; };
    const dayCount = (co, d) => inWin(co, d, d).filter(r => r["Record Source"] === "closing").length;
    const S = { co: COS.indexOf("Zip to Zip") >= 0 ? "Zip to Zip" : (COS[0] || ALL),
                day: null, picked: false, pace: "rev", brk: "Moving Type", missScope: "mtd" };
    function defaultDay() {
      if (dayCount(S.co, yesterday) > 0) return { day: yesterday, fell: false };
      const lf = lastFilled(S.co, yesterday);
      return { day: lf || yesterday, fell: !!lf };
    }
    let fell = false;
    { const d0 = defaultDay(); S.day = d0.day; fell = d0.fell; }

    /* ---------- the picker: the kit's date button + popover, one day instead of a range ---------- */
    function mountPicker(bar) {
      const wrap = document.createElement("div");
      wrap.className = "rs-dtwrap fo-pick";
      const lf = lastFilled(S.co, yesterday);
      const [py, pm] = ymd(S.day);
      const [ly, lm] = shiftM(py, pm, -1);
      const PRE = [["Yesterday", yesterday], ["Last day with closings", lf],
                   ["End of last month", iso(ly, lm, dim(ly, lm))],
                   ["End of last year", iso(py - 1, 12, 31)]].filter(p => p[1]);
      wrap.innerHTML = `<button class="rs-datebtn on" type="button">📅 As of ${esc(dLabel(S.day))} ▾</button>
        <div class="rs-datepop hidden">
          <div class="pre">${PRE.map((p, i) => `<button type="button" data-p="${i}" class="${p[1] === S.day ? "on" : ""}">${esc(p[0])}</button>`).join("")}</div>
          <div class="rng"><input type="date" class="one" max="${esc(njToday())}" value="${esc(S.day)}" aria-label="Pick a day"></div>
          <button class="apply" type="button">Show this day</button>
        </div>`;
      const btn = wrap.querySelector(".rs-datebtn"), pop = wrap.querySelector(".rs-datepop");
      const set = d => { if (!d || d.length !== 10) return; pop.classList.add("hidden");
        S.day = d; S.picked = true; fell = false; paint(); };
      pop.querySelectorAll(".pre button").forEach(b => b.onclick = () => set(PRE[+b.dataset.p][1]));
      wrap.querySelector(".apply").onclick = () => set(wrap.querySelector(".one").value);
      btn.onclick = e => { e.stopPropagation();
        document.querySelectorAll(".rs-slicer-pop, .rs-datepop").forEach(x => { if (x !== pop) x.classList.add("hidden"); });
        pop.classList.toggle("hidden"); };
      pop.addEventListener("click", e => e.stopPropagation());
      bar.appendChild(wrap);
    }
    if (!window.__foDocClick) {
      window.__foDocClick = true;
      document.addEventListener("click", () =>
        document.querySelectorAll(".fo .rs-datepop").forEach(p => p.classList.add("hidden")));
    }

    function seg(label, items, cur, onPick) {
      const w = document.createElement("div");
      w.className = "rs-fld";
      w.innerHTML = `<span>${esc(label)}</span>`;
      const g = document.createElement("div");
      g.className = "rs-seg";
      items.forEach(([v, l]) => {
        const b = document.createElement("button");
        b.type = "button"; b.textContent = l;
        if (v === cur) b.className = "on";
        b.onclick = () => { if (v !== cur) onPick(v); };
        g.appendChild(b);
      });
      w.appendChild(g);
      return w;
    }

    /* ---------- periods ---------- */
    function periods() {
      const [Y, Mo, D] = ymd(S.day);
      const s = scoped(S.co);
      const first = s.days[0] || S.day;
      const firstMonth = first.slice(0, 7);
      const minYear = +first.slice(0, 4);
      const mtd = (y, m) => ({ y, m, from: iso(y, m, 1), to: iso(y, m, Math.min(D, dim(y, m))),
        label: MON(m) + " " + y, days: Math.min(D, dim(y, m)) });
      const sel = mtd(Y, Mo);
      const prevMonths = [];
      for (let k = 1; k <= 5; k++) { const [y, m] = shiftM(Y, Mo, -k);
        if (iso(y, m, 1).slice(0, 7) >= firstMonth) prevMonths.push(mtd(y, m)); }
      const prevYears = [];
      for (let y = Y - 1; y >= minYear; y--) if (iso(y, Mo, 1).slice(0, 7) >= firstMonth) prevYears.push(mtd(y, Mo));
      const ytd = y => ({ y, from: iso(y, 1, 1), to: iso(y, Mo, Math.min(D, dim(y, Mo))), label: String(y) });
      const years = [];
      for (let y = Y; y >= minYear; y--) years.push(ytd(y));
      return { Y, Mo, D, sel, prevMonths, prevYears, years, first };
    }

    /* ================= paint ================= */
    let paceChart = null;
    function paint() {
      if (paceChart) { try { paceChart.destroy(); } catch (e) { /* already gone */ } paceChart = null; }
      host.querySelectorAll("canvas").forEach(c => { const ch = window.Chart && Chart.getChart(c); if (ch) ch.destroy(); });
      const P = periods();
      const A = agg(S.co, P.sel.from, P.sel.to);
      const PMo = P.prevMonths.map(p => Object.assign(agg(S.co, p.from, p.to), { p }));
      const PYr = P.prevYears.map(p => Object.assign(agg(S.co, p.from, p.to), { p }));
      const YT = P.years.map(p => Object.assign(agg(S.co, p.from, p.to), { p }));
      const LM = PMo[0] || null, LY = PYr[0] || null, YTD = YT[0], YTDLY = YT[1] || null;
      const coName = S.co || "All companies";
      const recorded = dayCount(S.co, S.day);
      const lf = lastFilled(S.co, njToday());

      host.innerHTML = `<div class="fo">${head}
        <div class="rs-bar" id="foBar"></div>
        ${dayNote(P, recorded, lf)}
        <div class="fo-sec">Month to date · ${esc(MON(P.Mo))} 1–${P.sel.days}, ${P.Y}</div>
        <div class="rs-kpis" id="foKpiM"></div>
        <div class="fo-sec">Year to date · Jan 1 – ${esc(dShort(P.sel.to))}, ${P.Y}</div>
        <div class="rs-kpis" id="foKpiY"></div>
        ${missingPanel(P)}
        ${mtdPanel(P, A, PMo, PYr)}
        ${ytdPanel(P, YT)}
        <div id="foPace"></div>
        ${projPanel(P, A)}
        <div class="fo-grid2">${moneyPanel(P, A, LM, LY, YTD, YTDLY)}${costPanel(P, A, LM, LY, YTD, YTDLY)}</div>
        ${breakPanel(P, A, LY)}
        <p class="rs-hint">Revenue, jobs, costs and gross profit are the portal's own measures, the same
          ones the Monthly Report uses, so a whole month here equals that month there. Revenue is the
          closing sheet's Total Bill plus extra bill from trips, by move date; jobs count every closing row.
          Gross profit is revenue less foreman, driver, helper and sales pay, less car, fuel, hotel, tolls,
          truck and other expenses, less the refunds dated in the same days (refunds count by the day they
          were issued, as everywhere in the portal). Booked = leads confirmed in Moveboard, by the day they
          were booked, valued at their quote — an estimate, never revenue; a booking cancelled later drops
          out of its day, as it does in the Booking Rate. ${bookErr ? "<b>Bookings could not load:</b> " + esc(bookErr.message || bookErr) + "." : ""}</p>
      </div>`;

      const bar = host.querySelector("#foBar");
      mountPicker(bar);
      RSC.localSelect(bar, { label: "Company", values: COS.map(c => ({ v: c, l: c, n: coCount[c] })),
        value: S.co, allLabel: "All companies",
        onChange: v => { S.co = v;
          if (!S.picked) { const d0 = defaultDay(); S.day = d0.day; fell = d0.fell; }
          paint(); } });

      const bkTxt = o => !hasBookings(S.co) ? "no Moveboard account" : fmtN(o.bkN) + " jobs · " + mC(o.bkV) + " quoted";
      const vs = (a, b, fn) => b ? (fn ? fn(a, b) : chgTxt(chg(a, b))) : "—";
      const gpSub = (o, lm, ly) => !P2 ? (p2Err ? "costs could not load" : "adding up the costs…")
        : "margin " + pct1(o.gm) + " · vs last month " + vs(o.gp, lm && lm.gp) + " · last year " + vs(o.gp, ly && ly.gp);
      RSC.kpis(host.querySelector("#foKpiM"), [
        { label: "Revenue", value: mC(A.rev), sub: "vs " + (LM ? LM.p.label : "—") + " " + vs(A.rev, LM && LM.rev)
            + " · vs " + (LY ? LY.p.label : "—") + " " + vs(A.rev, LY && LY.rev) },
        { label: "Jobs", value: fmtN(A.jobs), sub: "vs last month " + vs(A.jobs, LM && LM.jobs) + " · last year " + vs(A.jobs, LY && LY.jobs) },
        { label: "Average bill", value: mC(A.avg), sub: "vs last month " + vs(A.avg, LM && LM.avg) + " · last year " + vs(A.avg, LY && LY.avg) },
        { label: "Gross profit", value: P2 ? mC(A.gp) : "…", sub: gpSub(A, LM, LY) },
        { label: "Booked", value: hasBookings(S.co) ? fmtN(A.bkN) : "—",
          sub: bkTxt(A) + (LY && hasBookings(S.co) ? " · last year " + fmtN(LY.bkN) + " jobs" : "") },
      ]);
      RSC.kpis(host.querySelector("#foKpiY"), [
        { label: "Revenue", value: mC(YTD.rev), sub: "vs " + (YTDLY ? YTDLY.p.label + " to the same day " : "— ") + vs(YTD.rev, YTDLY && YTDLY.rev) },
        { label: "Jobs", value: fmtN(YTD.jobs), sub: "vs last year " + vs(YTD.jobs, YTDLY && YTDLY.jobs) },
        { label: "Average bill", value: mC(YTD.avg), sub: "vs last year " + vs(YTD.avg, YTDLY && YTDLY.avg) },
        { label: "Gross profit", value: P2 ? mC(YTD.gp) : "…",
          sub: !P2 ? (p2Err ? "costs could not load" : "adding up the costs…")
            : "margin " + pct1(YTD.gm) + " · vs last year " + vs(YTD.gp, YTDLY && YTDLY.gp) },
        { label: "Booked", value: hasBookings(S.co) ? fmtN(YTD.bkN) : "—",
          sub: bkTxt(YTD) + (YTDLY && hasBookings(S.co) ? " · last year " + fmtN(YTDLY.bkN) + " jobs" : "") },
      ]);

      // a chart that fails must not take the tables with it
      try { mountPace(P, A); }
      catch (e) {
        console.error("financial-overview pace:", e);
        const m = host.querySelector("#foPace");
        if (m) m.innerHTML = `<div class="panel"><div class="rs-loading">The pace chart could not draw (${esc(e.message || e)}).</div></div>`;
      }
      host.querySelectorAll("[data-fo-brk]").forEach(b => b.onclick = () => { S.brk = b.dataset.foBrk; paint(); });
      host.querySelectorAll("[data-fo-miss]").forEach(b => b.onclick = () => { S.missScope = b.dataset.foMiss; paint(); });
    }

    /* ---------- the day note: which day, why, and how filled it is ---------- */
    function dayNote(P, recorded, lf) {
      // how many closings a normal day of this weekday carries: the 4 same weekdays before it
      const typ = [7, 14, 21, 28].map(k => dayCount(S.co, addDays(S.day, -k)));
      const typAvg = typ.reduce((a, b) => a + b, 0) / typ.length;
      const parts = [];
      if (fell) parts.push(`No closings are recorded for <b>${esc(dLabel(yesterday))}</b> yet (the sheet is filled after the job), so this opens on <b>${esc(dLabel(S.day))}</b>, the newest day that has some.`);
      else parts.push(`Showing up to <b>${esc(dLabel(S.day))}</b>.`);
      parts.push(`${esc(DOW[dow(S.day)])} ${esc(dShort(S.day))} has <b>${fmtN(recorded)}</b> closing${recorded === 1 ? "" : "s"} recorded for ${esc(S.co || "all companies")}; the four ${esc(DOW[dow(S.day)])}s before it averaged ${typAvg.toFixed(1)}.`);
      if (recorded && typAvg && recorded < typAvg * 0.6) parts.push(`It may still be filling in.`);
      if (lf && S.day > lf) parts.push(`Closings are recorded only through <b>${esc(dLabel(lf))}</b>, so the days after it are empty, not zero.`);
      parts.push(`Every comparison uses the same days: 1–${P.sel.days} of each month.`);
      const warn = fell || (recorded && typAvg && recorded < typAvg * 0.6) || (lf && S.day > lf);
      return `<div class="fo-note${warn ? " warn" : ""}">${parts.join(" ")}</div>`;
    }

    /* ---------- MTD: the picked month against 5 months and every earlier year ---------- */
    const gpCell = o => P2 ? `<td class="num">${m0(o.gp)}</td><td class="num">${pct1(o.gm)}</td>`
      : `<td class="num fo-mute">…</td><td class="num fo-mute">…</td>`;
    const bkCells = o => hasBookings(S.co) ? `<td class="num">${fmtN(o.bkN)}</td><td class="num">${m0(o.bkV)}</td>`
      : `<td class="num fo-mute">—</td><td class="num fo-mute">—</td>`;
    const rowHtml = (label, o, base, cls) => `<tr class="${cls || ""}"><td>${esc(label)}</td>
      <td class="num">${fmtN(o.jobs)}</td><td class="num">${m0(o.rev)}</td><td class="num">${m0(o.avg)}</td>
      ${gpCell(o)}${bkCells(o)}
      ${base ? chgCell(chg(base.rev, o.rev)) : `<td class="num fo-mute">—</td>`}</tr>`;
    const HEAD = `<thead><tr><th>Period</th><th>Jobs</th><th>Revenue</th><th>Avg bill</th><th>Gross profit</th>
      <th>Margin</th><th>Booked</th><th>Booked quote</th><th title="How the picked period's revenue compares with this row's">Picked vs this</th></tr></thead>`;
    function mtdPanel(P, A, PMo, PYr) {
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Month to date, day for day — days 1–${P.sel.days}</div></div>
        <p class="rs-hint">Each row is days 1–${P.sel.days} of that month (a shorter month stops at its last day).
          The last column is how ${esc(P.sel.label)} so far compares with that row: ▲ means ahead of it.</p>
        <div class="tabwrap"><table class="tab">${HEAD}<tbody>
          ${rowHtml(P.sel.label + " (picked)", A, null, "fo-sel")}
          ${PMo.length ? `<tr class="fo-grp"><td colspan="9">The 5 months before</td></tr>` : ""}
          ${PMo.map(o => rowHtml(o.p.label + (o.p.days < P.sel.days ? " (1–" + o.p.days + ")" : ""), o, A)).join("")}
          ${PYr.length ? `<tr class="fo-grp"><td colspan="9">${esc(MON(P.Mo))} in earlier years</td></tr>` : ""}
          ${PYr.map(o => rowHtml(o.p.label + (o.p.days < P.sel.days ? " (1–" + o.p.days + ")" : ""), o, A)).join("")}
        </tbody></table></div></div>`;
    }
    function ytdPanel(P, YT) {
      const base = YT[0];
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Year to date, day for day — Jan 1 to ${esc(dShort(P.sel.to))}</div></div>
        <div class="tabwrap"><table class="tab">${HEAD}<tbody>
          ${YT.map((o, i) => rowHtml(o.p.label + (i === 0 ? " (picked)" : ""), o, i ? base : null, i ? "" : "fo-sel")).join("")}
        </tbody></table></div>
        ${P.first.slice(0, 4) === String(YT[YT.length - 1].p.y) && P.first > YT[YT.length - 1].p.from
          ? `<p class="rs-hint">${esc(YT[YT.length - 1].p.label)} starts on ${esc(dLabel(P.first))}, the first closing on file for ${esc(S.co || "all companies")}.</p>` : ""}
      </div>`;
    }

    /* ---------- the daily pace chart ---------- */
    function mountPace(P, A) {
      const mount = host.querySelector("#foPace");
      if (!mount) return;
      const light = () => document.body.classList.contains("light");
      const SEL = () => light() ? "#0e1621" : "#e9eef6";
      const CTX = () => light() ? "#c6d0db" : "#3a4658";
      const BLUE = "#2f6fd0", VIOLET = "#8b5cf6";
      const tone = c => typeof c === "function" ? c() : c;
      const METRICS = { rev: ["Revenue", (rs) => M["Total Bill"].fn(rs), true],
                        jobs: ["Jobs", (rs) => M["Total Jobs"].fn(rs), false],
                        bk: ["Booked quote", null, true] };
      if (!hasBookings(S.co) && S.pace === "bk") S.pace = "rev";
      const [mLabel, mFn, isMoney] = METRICS[S.pace];
      // one series per period: its FULL month, cumulative by day; the picked month stops at D
      const series = (p, stopAt) => {
        const n = dim(p.y, p.m), out = [];
        let run = 0;
        for (let d = 1; d <= n; d++) {
          const day = iso(p.y, p.m, d);
          if (stopAt && day > stopAt) break;
          run += S.pace === "bk" ? sumC(bkWin(S.co, day, day), "Average Quote") : mFn(inWin(S.co, day, day));
          out.push(run);
        }
        return out;
      };
      const lf = lastFilled(S.co, njToday()) || P.sel.to;
      const sel = { ...P.sel, stop: P.sel.to };
      const others = [...P.prevMonths.map((p, i) => ({ p, color: i === 0 ? BLUE : null, name: p.label + (i === 0 ? " (last month)" : "") })),
                      ...P.prevYears.map((p, i) => ({ p, color: i === 0 ? VIOLET : null, name: p.label + (i === 0 ? " (last year)" : "") }))];
      const data = [{ name: sel.label + " (picked)", vals: series(sel, sel.stop < lf ? sel.stop : lf), color: SEL, width: 3 },
        ...others.map(o => ({ name: o.name, vals: series(o.p, null), color: o.color || CTX, width: o.color ? 2 : 1.5 }))];
      const labels = Array.from({ length: 31 }, (_, i) => String(i + 1));
      const fmtV = v => isMoney ? mC(v) : fmtN(v);
      const ctl = `<span class="rs-seg">${[["rev", "Revenue"], ["jobs", "Jobs"]].concat(hasBookings(S.co) ? [["bk", "Booked quote"]] : [])
        .map(([v, l]) => `<button type="button" data-fo-pace="${v}" class="${v === S.pace ? "on" : ""}">${l}</button>`).join("")}</span>`;
      RSC.chartCard(mount, {
        title: "Pace — " + mLabel.toLowerCase() + " added up day by day",
        key: "fo-pace",
        controlsHtml: ctl,
        buildChart(canvas) {
          paceChart = new Chart(canvas, {
            type: "line",
            data: { labels, datasets: data.map((s, i) => ({
              // theme-aware colours are functions (read at draw time), fixed ones plain strings
              label: s.name, data: s.vals, borderColor: tone(s.color), backgroundColor: tone(s.color),
              borderWidth: s.width, pointRadius: 0, pointHitRadius: 6, tension: 0.15,
              order: data.length - i, spanGaps: false })) },
            options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
              plugins: { legend: { position: "bottom" },
                tooltip: { callbacks: { title: it => "Day " + it[0].label, label: it => it.dataset.label + ": " + fmtV(it.parsed.y) } } },
              scales: { x: { title: { display: true, text: "Day of the month" } },
                        y: { beginAtZero: true, ticks: { callback: v => fmtV(v) } } } },
          });
          return paceChart;
        },
        buildTable() {
          const n = Math.max(...data.map(s => s.vals.length));
          return `<table class="tab"><thead><tr><th>Day</th>${data.map(s => `<th>${esc(s.name)}</th>`).join("")}</tr></thead><tbody>`
            + Array.from({ length: n }, (_, d) => `<tr><td>${d + 1}</td>${data.map(s =>
              `<td class="num">${s.vals[d] == null ? "—" : fmtV(s.vals[d])}</td>`).join("")}</tr>`).join("")
            + `</tbody></table>`;
        },
      });
      const card = mount.querySelector(".panel");
      if (card) {
        const hint = document.createElement("p");
        hint.className = "rs-hint";
        hint.textContent = "The picked month runs to the picked day; every other line is its whole month, so you can see how "
          + "the rest of a month usually goes. Bold = picked, blue = the month before, violet = the same month last year, "
          + "grey = the other earlier months and years.";
        card.insertBefore(hint, card.querySelector(".gview"));
        card.querySelectorAll("[data-fo-pace]").forEach(b => b.onclick = () => { if (S.pace !== b.dataset.foPace) { S.pace = b.dataset.foPace; paint(); } });
      }
    }

    /* ---------- month-end projection ---------- */
    function projPanel(P, A) {
      const n = dim(P.Y, P.Mo);
      if (P.D >= n) return `<div class="panel"><div class="panel-head"><div class="panel-title">Month-end projection</div></div>
        <p class="rs-hint">${esc(P.sel.label)} is picked through its last day, so there is nothing left to project.</p></div>`;
      const lfAll = lastFilled(S.co, njToday()) || P.sel.to;
      // a year counts only when that month is complete on file
      const ratios = P.prevYears.map(p => {
        const full = agg(S.co, iso(p.y, p.m, 1), iso(p.y, p.m, dim(p.y, p.m)));
        const part = agg(S.co, p.from, p.to);
        return { y: p.y, rev: part.rev ? full.rev / part.rev : null, jobs: part.jobs ? full.jobs / part.jobs : null,
                 fullRev: full.rev, partRev: part.rev, done: iso(p.y, p.m, dim(p.y, p.m)) <= lfAll };
      }).filter(x => x.done && x.rev && isFinite(x.rev));
      const rest = { from: addDays(P.sel.to, 1), to: iso(P.Y, P.Mo, n) };
      const ahead = hasBookings(S.co)
        ? bookings.filter(r => (S.co === ALL || r.Company === S.co)
            && String(r["Move Date"] || "").slice(0, 10) >= rest.from && String(r["Move Date"] || "").slice(0, 10) <= rest.to)
        : null;
      if (!ratios.length) return `<div class="panel"><div class="panel-head"><div class="panel-title">Month-end projection</div></div>
        <p class="rs-hint">No earlier ${esc(MON(P.Mo))} is on file for ${esc(S.co || "all companies")}, so there is no shape to project with.</p></div>`;
      const ly = ratios[0];
      const rv = ratios.map(x => x.rev);
      const lo2 = Math.min(...rv), hi2 = Math.max(...rv);
      const jr = ratios.filter(x => x.jobs).map(x => x.jobs);
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Month-end projection — where ${esc(P.sel.label)} lands</div></div>
        <p class="rs-hint">If the rest of the month goes the way the same days went in earlier years: each earlier
          ${esc(MON(P.Mo))}'s whole-month total divided by its days 1–${P.D}, applied to this month so far. A guide, not a
          forecast, and never added into the actuals.</p>
        <div class="fo-proj">
          <div><div class="fo-pl">If it goes like ${ly.y}</div><div class="fo-pv">${mC(A.rev * ly.rev)}</div>
            <div class="fo-ps">revenue · ${ly.jobs && A.jobs ? "about " + fmtN(Math.round(A.jobs * ly.jobs)) + " jobs" : ""}</div></div>
          <div><div class="fo-pl">Range across ${ratios.length} year${ratios.length === 1 ? "" : "s"}</div>
            <div class="fo-pv">${mC(A.rev * lo2)} – ${mC(A.rev * hi2)}</div>
            <div class="fo-ps">${jr.length && A.jobs ? fmtN(Math.round(A.jobs * Math.min(...jr))) + "–" + fmtN(Math.round(A.jobs * Math.max(...jr))) + " jobs" : ""}</div></div>
          <div><div class="fo-pl">So far</div><div class="fo-pv">${mC(A.rev)}</div>
            <div class="fo-ps">${fmtN(A.jobs)} jobs through ${esc(dShort(P.sel.to))}</div></div>
          ${ahead ? `<div><div class="fo-pl">On the books for ${esc(dShort(rest.from))}–${esc(dShort(rest.to))}</div>
            <div class="fo-pv">${fmtN(ahead.length)} jobs</div>
            <div class="fo-ps">${mC(sumC(ahead, "Average Quote"))} quoted · confirmed in Moveboard today with a move date in the rest of the month</div></div>` : ""}
        </div>
        <div class="tabwrap"><table class="tab"><thead><tr><th>Year</th><th>${esc(MON(P.Mo))} 1–${P.D}</th><th>Whole ${esc(MON(P.Mo))}</th><th>Whole ÷ days 1–${P.D}</th><th>${esc(P.sel.label)} at that pace</th></tr></thead><tbody>
          ${ratios.map(x => `<tr><td>${x.y}</td><td class="num">${m0(x.partRev)}</td><td class="num">${m0(x.fullRev)}</td>
            <td class="num">× ${x.rev.toFixed(2)}</td><td class="num">${m0(A.rev * x.rev)}</td></tr>`).join("")}
        </tbody></table></div></div>`;
    }

    /* ---------- how the money came in / what it cost: picked vs last month vs last year, and YTD ---------- */
    const cols5 = (P, LM, LY, YTDLY) => [
      [P.sel.label + " 1–" + P.sel.days, "A"],
      [LM ? LM.p.label + " 1–" + LM.p.days : "Last month", "LM"],
      [LY ? LY.p.label + " 1–" + LY.p.days : "Last year", "LY"],
      ["YTD " + P.Y, "YTD"],
      ["YTD " + (P.Y - 1), "YTDLY"]];
    function lineTable(P, sets, lines, note) {
      const [A, LM, LY, YTD, YTDLY] = sets;
      const cs = cols5(P, LM, LY, YTDLY);
      const get = { A, LM, LY, YTD, YTDLY };
      return `<div class="tabwrap"><table class="tab"><thead><tr><th></th>${cs.map(c => `<th>${esc(c[0])}</th>`).join("")}<th>vs last year</th></tr></thead><tbody>
        ${lines.map(([label, key, fmt, cls]) => {
          const v = k => { const o = get[k]; return o ? o[key] : null; };
          const f = fmt || m0;
          return `<tr class="${cls || ""}"><td>${esc(label)}</td>${cs.map(c => `<td class="num">${v(c[1]) == null ? "—" : f(v(c[1]))}</td>`).join("")}
            ${key === "gm" ? `<td class="num">${ptsTxt(v("A"), v("LY"))}</td>` : chgCell(chg(v("A"), v("LY")))}</tr>`;
        }).join("")}
      </tbody></table></div>${note ? `<p class="rs-hint">${note}</p>` : ""}`;
    }
    function moneyPanel(P, A, LM, LY, YTD, YTDLY) {
      return `<div class="panel"><div class="panel-head"><div class="panel-title">How the money came in</div></div>
        ${lineTable(P, [A, LM, LY, YTD, YTDLY], [
          ["Revenue", "rev", null, "fo-sel"], ["Net cash", "cash"], ["Card", "card"], ["Deposits", "deposit"],
          ["Balance due", "due"], ["Tips from customers", "tipCust"], ["Tips from the company", "tipCo"],
          ["Packing written", "packing"], ["Discounts given", "disc"]],
          `Net cash includes net cash from trips, as in the Monthly Report. Discounts are what the closing sheet records
           in Discount Given — ${fmtN(YTD.discN)} closing${YTD.discN === 1 ? "" : "s"} carry one this year, so a discount
           usually lives in the quote instead.`)}</div>`;
    }
    function costPanel(P, A, LM, LY, YTD, YTDLY) {
      if (!P2) return `<div class="panel"><div class="panel-head"><div class="panel-title">Costs and gross profit</div></div>
        <div class="rs-loading">${p2Err ? "The pay and refund tables could not load — reload to try again." : "Adding up pay, expenses and refunds…"}</div></div>`;
      return `<div class="panel"><div class="panel-head"><div class="panel-title">Costs and gross profit</div></div>
        ${lineTable(P, [A, LM, LY, YTD, YTDLY], [
          ["Revenue", "rev", null, "fo-sel"], ["Foreman pay", "forman"], ["Driver pay", "driver"], ["Helper pay", "helper"],
          ["Sales commission", "sales"], ["Car", "car"], ["Fuel", "fuel"], ["Hotel", "hotel"], ["Tolls", "tolls"],
          ["Truck", "truck"], ["Other expenses", "other"], ["Refunds (by refund date)", "refunds"],
          ["Gross profit", "gp", null, "fo-tot"], ["Gross margin", "gm", pct1, "fo-tot"]],
          `Sales commission is every salesperson slot the closing sheet pays, the branch owner's cut included. Helper pay
           is the helper sheet, matched to the job. A closing with no foreman pay recorded adds no foreman cost, so its
           profit reads high — see the missing-data panel.`)}</div>`;
    }

    /* ---------- breakdowns: the picked month so far against the same days last year ---------- */
    const BRK = [["Moving Type", "Moving type"], ["State Name", "State"], ["Sales Person", "Salesperson"], ["Source", "Source"]];
    function breakPanel(P, A, LY) {
      const col = S.brk;
      const grp = rs => { const m = new Map();
        rs.forEach(r => { const k = has(r[col]) ? String(r[col]).trim() : "(blank)";
          (m.get(k) || m.set(k, []).get(k)).push(r); });
        return m; };
      const a = grp(A.rows), b = LY ? grp(LY.rows) : new Map();
      const keys = [...new Set([...a.keys(), ...b.keys()])];
      const rows = keys.map(k => { const ra = a.get(k) || [], rb = b.get(k) || [];
        const rev = M["Total Bill"].fn(ra), revLY = M["Total Bill"].fn(rb);
        return { k, jobs: ra.length, rev, avg: ra.length ? rev / ra.length : null, share: A.rev ? rev / A.rev : null,
                 jobsLY: rb.length, revLY }; })
        .sort((x, y) => y.rev - x.rev || y.revLY - x.revLY);
      const tabs = BRK.map(([v, l]) => `<button type="button" data-fo-brk="${esc(v)}" class="${v === col ? "on" : ""}">${esc(l)}</button>`).join("");
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Where ${esc(P.sel.label)} 1–${P.sel.days} came from</div>
          <span class="spacer"></span><span class="rs-seg">${tabs}</span></div>
        ${col === "Sales Person" ? `<p class="rs-hint">By the first salesperson on the closing. A job two people sold sits under the first; the Salaries page has the split pay.</p>` : ""}
        <div class="tabwrap"><table class="tab"><thead><tr><th>${esc((BRK.find(x => x[0] === col) || [0, col])[1])}</th>
          <th>Jobs</th><th>Revenue</th><th>Avg bill</th><th>Share</th>
          <th>${esc(LY ? LY.p.label + " 1–" + LY.p.days : "Last year")} jobs</th><th>Revenue</th><th>vs last year</th></tr></thead><tbody>
          ${rows.map(r => `<tr><td>${esc(r.k)}</td><td class="num">${fmtN(r.jobs)}</td><td class="num">${m0(r.rev)}</td>
            <td class="num">${m0(r.avg)}</td><td class="num">${pct1(r.share)}</td>
            <td class="num">${fmtN(r.jobsLY)}</td><td class="num">${m0(r.revLY)}</td>${chgCell(chg(r.rev, r.revLY))}</tr>`).join("")}
        </tbody><tfoot><tr><td>Total</td><td class="num">${fmtN(A.jobs)}</td><td class="num">${m0(A.rev)}</td>
          <td class="num">${m0(A.avg)}</td><td class="num">${A.rev ? "100.0%" : "—"}</td>
          <td class="num">${LY ? fmtN(LY.jobs) : "—"}</td><td class="num">${LY ? m0(LY.rev) : "—"}</td>${chgCell(chg(A.rev, LY && LY.rev))}</tr></tfoot>
        </table></div></div>`;
    }

    /* ---------- missing data ---------- */
    function missingPanel(P) {
      const mtd = missing(S.co, P.sel.from, P.sel.to);
      const ytd = missing(S.co, P.years[0].from, P.years[0].to);
      const cur = S.missScope === "ytd" ? ytd : mtd;
      const n = cur.rows.length;
      const others = S.co === ALL ? [] : COS.filter(c => c !== S.co).map(c => ({ c, m: missing(c, P.sel.from, P.sel.to) }))
        .filter(x => x.m.rows.length);
      const cnt = (o, k) => o.by[k] ? `<b>${fmtN(o.by[k])}</b>` : "0";
      const list = cur.rows.slice().sort((a, b) => rowDay(b.r).localeCompare(rowDay(a.r)));
      const scopeBtns = [["mtd", "This month so far"], ["ytd", "Year to date"]]
        .map(([v, l]) => `<button type="button" data-fo-miss="${v}" class="${v === S.missScope ? "on" : ""}">${l}</button>`).join("");
      return `<div class="panel">
        <div class="panel-head"><div class="panel-title">Closings missing data</div>
          <span class="spacer"></span><span class="rs-seg">${scopeBtns}</span></div>
        <div class="tabwrap"><table class="tab"><thead><tr><th>Window</th><th>Closings</th><th>With a gap</th>
          ${MISS.map(x => `<th>${esc(x[1])}</th>`).join("")}</tr></thead><tbody>
          <tr class="${S.missScope === "mtd" ? "fo-sel" : ""}"><td>${esc(P.sel.label)} 1–${P.sel.days}</td><td class="num">${fmtN(mtd.closings)}</td>
            <td class="num">${fmtN(mtd.rows.length)}</td>${MISS.map(x => `<td class="num">${cnt(mtd, x[0])}</td>`).join("")}</tr>
          <tr class="${S.missScope === "ytd" ? "fo-sel" : ""}"><td>YTD ${P.Y}</td><td class="num">${fmtN(ytd.closings)}</td>
            <td class="num">${fmtN(ytd.rows.length)}</td>${MISS.map(x => `<td class="num">${cnt(ytd, x[0])}</td>`).join("")}</tr>
        </tbody></table></div>
        <p class="rs-hint">A closing with <b>no bill</b> adds nothing to revenue above, so the month reads low by whatever
          those jobs billed. <b>No foreman hours or pay</b> means no foreman cost was recorded, so gross profit reads high.
          A split job whose bill sits on its other leg is not counted as missing.${others.length
            ? " Other companies, same days: " + others.map(x => `${esc(x.c)} ${fmtN(x.m.rows.length)} of ${fmtN(x.m.closings)}`).join(", ") + "." : ""}</p>
        ${n ? `<div class="tabwrap" style="max-height:360px"><table class="tab"><thead><tr><th>Move date</th><th>Company</th><th>Job #</th>
            <th>Request #</th><th>Customer</th><th>Foreman</th><th>Bill</th><th>Missing</th></tr></thead><tbody>
          ${list.map(({ r, f }) => `<tr><td>${esc(dLabel(rowDay(r)))}</td><td class="fo-l">${esc(r.Company)}</td>
            <td class="fo-l">${esc(r["Job No"] || "—")}</td><td class="fo-l">${esc(r["Request #"] || "—")}</td>
            <td class="fo-l">${esc(r.Customer || "—")}</td><td class="fo-l">${esc(r.Foreman || "—")}</td>
            <td class="num">${has(r["Total Bill"]) ? m0(num(r["Total Bill"])) : "—"}</td>
            <td class="fo-l">${f.map(x => `<span class="fo-miss">${esc(x[1])}</span>`).join("")}</td></tr>`).join("")}
        </tbody></table></div>` : `<div class="rs-hint">Nothing missing for ${esc(S.co || "all companies")} in this window.</div>`}
      </div>`;
    }

    paint();
  },
});
