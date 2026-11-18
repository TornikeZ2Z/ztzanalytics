/* FINANCIAL page: Pre-payroll Check (report id pre-payroll; tracker ZTZ-114, 18 Nov 2026).
   Before payroll, the closing rows that disagree with what else knows the job -- the calendar, the Digital Contract
   and the carrier post in Slack: a sales person or carrier typed wrong, a person left off, a job entered twice.
   Fixing the row in the sheet takes it off the list within the hour.
   DATA PATH: everything through /api/_prepay (bridge/pre_payroll.py) -- no RS.load, no dataset; the report id maps
   to no tables. No customer name, phone or address ever reaches the page. */
(() => {
  const esc = s => RSC.esc(s == null ? "" : String(s));
  const S = { data: null, err: "", period: "30", group: "" };   // module-level: a re-render keeps the picks
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const money = v => "$" + Math.round(+v || 0).toLocaleString("en-US");
  const fmtN = v => RS.fmtN(+v || 0);
  const day = v => { const s = String(v || "").slice(0, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? MON[+s.slice(5, 7) - 1] + " " + +s.slice(8, 10) : "—"; };
  const nyToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const iso = d => d.toISOString().slice(0, 10);
  const GROUPS = ["Sales person", "Crew", "Entered twice", "Long distance"];

  /* the period picker's choices -> [from, to] in New York dates */
  function range(p) {
    const t = nyToday(), d = new Date(t + "T12:00:00Z");
    const y = d.getUTCFullYear(), m = d.getUTCMonth();
    if (p === "month") return [iso(new Date(Date.UTC(y, m, 1, 12))), t];
    if (p === "last") return [iso(new Date(Date.UTC(y, m - 1, 1, 12))), iso(new Date(Date.UTC(y, m, 0, 12)))];
    if (p === "year") return [y + "-01-01", t];
    const n = +p || 30;
    return [iso(new Date(d.getTime() - n * 86400000)), t];
  }
  const PERIOD_PHRASE = { "30": "In the last 30 days", month: "This month", last: "Last month", "90": "In the last 90 days", year: "This year" };
  const GROUP_PHRASE = { "Sales person": "about sales people", "Crew": "about crew", "Entered twice": "entered twice", "Long distance": "about long distance" };
  const PERIODS = [{ v: "30", l: "Last 30 days" }, { v: "month", l: "This month" }, { v: "last", l: "Last month" },
                   { v: "90", l: "Last 90 days" }, { v: "year", l: "This year" }];

  function injectStyle() {
    const old = document.getElementById("ppc-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "ppc-style";
    st.textContent = `
      .ppc-wrap{max-width:none}
      .ppc-bar{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:4px 0 14px}
      .ppc-sec{font-size:15px;font-weight:600;color:var(--ink);margin:24px 0 10px}
      .ppc-note{font-size:12.5px;color:var(--faint);line-height:1.55;margin-top:8px}
      .rs-table td .ppc-sub{display:block;font-size:12px;color:var(--muted);font-weight:400;margin-top:2px}
      .rs-table td.ppc-what{font-weight:600;min-width:220px}
      .rs-table td.ppc-said{min-width:200px;color:var(--ink)}
      .ppc-new{display:inline-block;font-size:12px;font-weight:600;color:var(--muted);border:1px solid var(--line);
        border-radius:999px;padding:0 7px;margin-left:6px;vertical-align:1px}
      .ppc-link{color:var(--brand);text-decoration:underline}
      .ppc-count{font-size:13px;font-weight:500;color:var(--muted);margin-left:6px}`;
    document.head.appendChild(st);
  }

  const how = () => {
    const d = S.data || {}, c = d.coverage || {};
    return `<h3>What this page shows</h3><p>Closing rows to look at before payroll. Each one disagrees with something else that
        knows the job: the calendar, the Digital Contract (the crew's tablet app) or the carrier post in Slack. A row here is
        not proven wrong; it is a row a person should open. Fix it in the closing sheet and it leaves this list at the next
        hourly refresh. Cancelled rows are never checked.</p>
      <h3>Sales person</h3><p>The sales people on the closing (SP 1&ndash;3) are compared with the calendar's Sales Rep 1&ndash;3 and
        the contract's sales persons. A name is listed when <b>neither</b> the calendar nor the contract has it (that person is
        paid a commission on this row), or when <b>both</b> have a name the closing lacks. The branch owner's slot is skipped,
        and an unnamed "Estimator" on the calendar leaves room for one estimator. "Giorgi" alone is never called a mistake,
        because three people answer to it. Names are matched by the rep's email or first name, with the nicknames the sheets
        use.</p>
      <h3>Crew</h3><p>"Same person in two crew slots" = one name in two of Foreman, Driver and H 1&ndash;8 on one row, with pay in
        both. "Fewer crew than the Digital Contract" = fewer crew slots filled on the closing than people on the contract's
        final crew list (a two-truck job's rows are counted together). The last two days are not checked for this: their
        crew may still be being typed in. Rows from the last week carry a "new" mark.</p>
      <h3>Entered twice</h3><p>"Exact copy" = a later row of the same request with the same bill, the same net cash and the same
        crew; its crew and sales pay would be paid twice. "Same request and same bill" = two rows of one request with the same
        bill but not an exact copy.</p>
      <h3>Long distance</h3><p>The LD tab's carrier against the carrier in the custody post in Slack for the same job
        (first names compared, spelling variants allowed), and the LD tab's delivery state against the calendar's.</p>
      <h3>Pay at stake</h3><p>The money on the row that the finding is about: the commission paid to a sales person neither
        source names, the smaller of the two wages of a person paid twice, the crew and sales pay on an exact copy, and what
        the row pays the carrier. It is what to look at, not a proven loss.</p>
      <p>In these dates: ${fmtN(c.rows)} closing rows checked; ${fmtN(c.with_calendar)} have a calendar entry and
        ${fmtN(c.with_contract)} a Digital Contract; ${fmtN(c.carrier_checked)} carriers had a Slack post to compare.
        Closings to ${esc(day(d.newest_closing))}.</p>`;
  };

  function render(host) {
    const d = S.data;
    const all = d.findings || [];
    const rows = S.group ? all.filter(f => f.group === S.group) : all;
    const c = d.coverage || {};
    const pay = all.reduce((a, f) => a + (+f.money || 0), 0);
    const per = GROUPS.map(g => [g, all.filter(f => f.group === g).length]).filter(x => x[1]);
    const when = (PERIOD_PHRASE[S.period] || PERIOD_PHRASE["30"]) + ` (${day(d.from)} to ${day(d.to)})`;
    const one = all.length === 1;
    const headline = all.length
      ? `${esc(when)}, <b>${fmtN(all.length)}</b> closing row${one ? " needs" : "s need"} a look`
        + (per.length ? ": " + per.map(([g, n]) => `${fmtN(n)} ${esc(GROUP_PHRASE[g] || g)}`).join(", ") : "")
        + (pay ? `, with <b>${money(pay)}</b> of pay on ${one ? "it" : "them"}.` : ".")
      : `${esc(when)}, nothing to look at: all ${fmtN(c.rows)} closing rows agree with the calendar, the contract and the carrier posts.`;
    const kpis = RSC.kpisHtml([
      { label: "Rows to look at", value: fmtN(all.length), sub: `of ${fmtN(c.rows)} closing rows checked` },
      { label: "Pay on them", value: pay ? money(pay) : "—", sub: "commissions, double wages, copies, carrier" },
      { label: "With a calendar entry", value: c.rows ? Math.round(c.with_calendar / c.rows * 100) + "%" : "—", sub: `${fmtN(c.with_calendar)} rows` },
      { label: "With a Digital Contract", value: c.rows ? Math.round(c.with_contract / c.rows * 100) + "%" : "—", sub: `${fmtN(c.with_contract)} rows` },
    ]);
    const sec = g => {
      const rs = rows.filter(f => f.group === g);
      if (!rs.length) return "";
      return `<div class="ppc-sec">${esc(g)} <span class="ppc-count">${fmtN(rs.length)}</span></div>`
        + `<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Date</th><th>Closing row</th><th>Job</th>`
        + `<th>What to check</th><th>The closing says</th><th>The others say</th><th class="num">Pay on it</th></tr></thead><tbody>`
        + rs.map(f => `<tr><td>${esc(day(f.date))}</td>`
          + `<td>${esc(f.row)}<span class="ppc-sub">${esc(f.file)}</span></td>`
          + `<td>${esc(f.job || "—")}${f.request ? `<span class="ppc-sub">request ${esc(f.request)}</span>` : ""}</td>`
          + `<td class="ppc-what">${esc(f.title)}${f.recent ? '<span class="ppc-new">new</span>' : ""}</td>`
          + `<td class="ppc-said">${esc(f.sheet)}</td>`
          + `<td class="ppc-said">${esc(f.expected)}${f.link ? ` <a class="ppc-link" href="${esc(f.link)}" target="_blank" rel="noopener">Slack post</a>` : ""}</td>`
          + `<td class="num">${f.money ? money(f.money) : "—"}${f.money_note ? `<span class="ppc-sub">${esc(f.money_note)}</span>` : ""}</td></tr>`).join("")
        + `</tbody></table></div>`;
    };
    const body = rows.length ? GROUPS.map(sec).join("")
      : RSC.emptyHtml({ title: "Nothing to look at", body: S.group ? `No ${esc(S.group.toLowerCase())} rows in these dates.` : "Every closing row in these dates agrees with the calendar, the contract and the carrier posts." });
    host.innerHTML = `<div class="ppc-wrap">
      ${RSC.pageHeadHtml({ title: "Pre-payroll Check", key: "pre-payroll",
        sub: "Closing rows to look at before payroll: sales people, crew, copies and carriers that disagree with the calendar, the contract or Slack.",
        chip: "Closings to " + day(d.newest_closing), how })}
      <div class="ppc-bar"><div id="ppcPeriod"></div><div id="ppcGroup"></div></div>
      ${RSC.headlineHtml(headline)}
      ${kpis}
      ${body}
      <div class="ppc-note">Fix a row in the closing sheet and it leaves this list at the next hourly refresh.</div>
    </div>`;
    RSC.localSelect(host.querySelector("#ppcPeriod"), { label: "Dates", required: true, values: PERIODS, value: S.period,
      onChange: v => { S.period = v; load(host); } });
    RSC.localSelect(host.querySelector("#ppcGroup"), { label: "Kind", allLabel: "All", values: GROUPS.map(g => ({ v: g, l: g })),
      value: S.group, onChange: v => { S.group = v || ""; render(host); } });
  }

  async function load(host) {
    host.innerHTML = RSC.loadingHtml("Pre-payroll Check", "Comparing the closings with the calendar, the contracts and Slack…");
    const [from, to] = range(S.period);
    try {
      S.data = await ZTZ.api("/api/_prepay?from=" + encodeURIComponent(from) + "&to=" + encodeURIComponent(to));
      S.err = "";
    } catch (e) {
      S.data = null;
      S.err = String(e && e.message || e);
    }
    if (!S.data) {
      RSC.failed(host, { title: "The pre-payroll check could not load", error: S.err.slice(0, 200), onRetry: () => load(host) });
      return;
    }
    render(host);
  }

  registerPage({
    id: "pre-payroll",
    group: "financial",
    title: "Pre-payroll Check",
    async render(host) {
      injectStyle();
      await load(host);
    },
  });
})();
