/* MARKETING OVERVIEW — the one page for marketing (Tornike 2026-10-15: "fully automated
 * marketing reporting. all in one page where we should have kinda everything together").
 *
 * TOP: WHAT EACH CHANNEL COST AND BROUGHT (2026-10-16, his decisions):
 *   * PERIOD: "Allow user to select whatever they want to select" -- the kit's period button
 *     (presets + any from/to), opening on This month and remembered per viewer: a preset is
 *     saved by NAME, so "This month" rolls into November by itself; a custom range by its dates.
 *   * BOOKED: "Leads from the period that booked" -- the cohort Source Analysis uses (leads
 *     CREATED in the period whose Status Category is 'Confirmed'), so both pages agree.
 *   * HEADLINE ("well, you tell me :)"): COST PER BOOKED JOB and $ PER $1, cost per lead after
 *     them. A lead is cheap to buy and easy to inflate; a booked job is what the money is for.
 *   * BOOKED VALUE ($ per $1 reads it): billed where the move happened, else the booked quote --
 *     a recent month has few moves done, and billed alone would call it a loss.
 *   * SPEND: the LIVE platform API where one exists (Google Ads, Local Services, Meta, ChatGPT,
 *     all Zip to Zip accounts) and the BANK LEDGER otherwise. The ledger is pasted monthly, so
 *     for days past its end a ledger channel has NO SPEND YET -- not free. Its cost figures are
 *     then read on the covered days only (spend and the leads of those same days), the row says
 *     so, and a period wholly past the ledger shows "not in yet" instead of a $0 that flatters.
 *   * PAID / UNPAID: a channel is paid when it has spend in the period or the year before its
 *     end (postcards are paid in lumps -- none in Jul-Aug 2026 -- and October, with no ledger
 *     yet, must still file Yelp as paid). The headline cost figures read paid channels only:
 *     organic and referral leads cost nothing to compare.
 *   * THE COMPARISON IS LIKE FOR LIKE, twice over. Bookings: last year's leads count as booked
 *     only if they had booked BY THE SAME POINT a year ago (mart `Booked Day`) -- 1-16 Oct 2025
 *     had 104 booked by 16 Oct 2025 and 142 by now, and comparing this October's young cohort
 *     with the 142 read as a 37% fall that was really 14%. Spend: a comparison day counts a
 *     ledger channel only if the matching day of the CURRENT period has its spend in, so while
 *     the ledger is behind both sides read the live channels alone.
 *   Data: mart_mkt_channel_day (src/mkt_overview_mart.py), one row per day x company x family.
 *
 * BOTTOM: THE DATA SOURCES (2026-10-15, his words: "show user what are the sources connected to
 * this dashboard and what is the latest status - is it up to date?"). One row per source from
 * mart_mkt_connector (src/mkt_connectors.py, rebuilt every hour after the freshness check):
 *   * MARKETING PLATFORMS — his eleven (Google split into Ads / Local Services / Analytics /
 *     Search Console, because each connects on its own), each with the login that holds it,
 *     the metrics he wants from it, whether data flows, and what unblocks it if not;
 *   * OUR OWN DATA — leads, calls, jobs, the bank spend ledger and the hand-dropped exports.
 * "Up to date" is judged against each source's OWN rhythm (Search Console is ~3 days behind by
 * design, the bank ledger is pasted monthly), so the status is computed in the mart. A strip
 * under the bar repeats it for the feeds the channel table reads.
 *
 * Plan of record: docs/plans/2026-10-15-marketing-overview.md. The platform panels (campaigns,
 * Local Services, Meta, ChatGPT) and the website / search panels come next.
 */
(function () {
  if (!window.RS || !RS.DATASETS) return;
  if (!RS.DATASETS.mkt_connector) {
    RS.DATASETS.mkt_connector = {
      table: "mart_mkt_connector",
      // A PAYLOAD CONTRACT: projection is always on, so a column missing here never arrives.
      cols: ["Key", "Sort", "Group", "Platform", "Login", "Account", "Link", "Metrics",
             "Connection", "Status", "Status Note", "Next Step", "Newest Data", "Last Pulled",
             "Days Behind", "Expected Lag", "Bank Year", "Bank Spend", "Bank Last Charge",
             "Bank Through", "Note", "Checked At"],
    };
  }
  if (!RS.DATASETS.mkt_channel) {
    RS.DATASETS.mkt_channel = {
      table: "mart_mkt_channel_day",
      cols: ["Date", "Company", "Family", "Booked Day", "Leads", "Booked", "Moved", "Billed",
             "Booked Value",
             "Spend Live", "Spend Ledger", "Impressions", "Clicks", "Platform Conversions",
             "Ledger End"],
      // its own period picker, never the global date filter
      dateCols: {}, defaultDate: null,
    };
  }
})();

(() => {
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const LS_PERIOD = "mkoPeriod", LS_CMP = "mkoCmp";
  const PAID_LOOKBACK = 365;         // days before the period's end that still make a channel paid
  const LIVE_CO = "Zip to Zip";      // every live ad account is Zip to Zip's
  const THIN = 5;                    // fewer booked jobs than this: the cost per booked is a guess
  // the feeds the channel table reads, in the strip under the bar (mart_mkt_connector keys)
  const FEEDS = [["leads", "Leads"], ["google-ads", "Google Ads"], ["google-lsa", "Local Services"],
                 ["meta", "Meta"], ["chatgpt", "ChatGPT Ads"], ["bank", "Bank ledger"]];
  // a channel whose leads are wider than its ads
  const FAM_NOTE = {
    "ChatGPT": "leads include visitors from chatgpt.com answers, not only the ads",
  };
  const PILL = { "Up to date": "ok", "Behind": "warn", "No data": "bad", "Not connected": "mute" };

  // module memory: survives a theme re-render, not a page load
  const S = { co: LIVE_CO, from: null, to: null, cmp: "ly", booted: false };
  const D = { ready: false, conn: [], connErr: null, rows: [], chErr: null,
              liveFrom: {}, ledgerEnd: null, minDay: null, maxDay: null };

  /* ------------------------------------------------------------------ helpers ---- */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = v => (window.RS && RS.num ? RS.num(v) : +v) || 0;
  const iso = d => d.toLocaleDateString("en-CA");
  const today = () => iso(new Date());
  function addDays(s, n) { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
  function addYears(s, n) { const d = new Date(s + "T12:00:00"); d.setFullYear(d.getFullYear() + n); return iso(d); }
  function dayCount(a, b) { return Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 864e5) + 1; }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  // dates arrive as "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS"; read the calendar day only, so no
  // browser timezone can move it
  function ymd(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
  }
  function day(v) { const p = ymd(v); return p ? p.d + " " + MON[p.m - 1] + " " + p.y : "—"; }
  function shortDay(v) { const p = ymd(v); return p ? p.d + " " + MON[p.m - 1] : "—"; }
  function money(v) {
    if (v == null || isNaN(v)) return "—";
    const a = Math.abs(v), sg = v < 0 ? "−" : "";
    if (a >= 1e6) return sg + "$" + (a / 1e6).toFixed(2) + "M";
    if (a >= 1e4) return sg + "$" + (a / 1e3).toFixed(1) + "k";
    return sg + "$" + Math.round(a).toLocaleString("en-US");
  }
  const money0 = v => v == null || isNaN(v) ? "—" : "$" + Math.round(v).toLocaleString("en-US");
  const fmtN = v => v == null || isNaN(v) ? "—" : Math.round(v).toLocaleString("en-US");
  const pct = v => v == null || isNaN(v) ? "—" : (100 * v).toFixed(1) + "%";
  const perDollar = v => v == null || isNaN(v) ? "—" : "$" + v.toFixed(v < 10 ? 2 : 1);
  const ratio = (a, b) => b > 0 ? a / b : null;

  /* ▲ / ▼ against the comparison window, as Source Analysis draws it. `lowerIsBetter` flips the
     colour for costs; null = a change neither good nor bad by itself (spending more). */
  function delta(cur, prev, lowerIsBetter) {
    if (cur == null || prev == null || isNaN(cur) || isNaN(prev)) return "";
    if (!prev) return cur ? '<span class="mko-d eq">new</span>' : "";
    const d = cur / prev - 1;
    if (Math.abs(d) < 0.0005) return '<span class="mko-d eq">± 0%</span>';
    const good = lowerIsBetter ? d < 0 : d > 0;
    const cls = lowerIsBetter === null ? "eq" : (good ? "up" : "dn");
    return '<span class="mko-d ' + cls + '" title="change in percent">' + (d > 0 ? "▲ " : "▼ ")
      + Math.abs(d * 100).toFixed(Math.abs(d) < 0.1 ? 1 : 0) + "%</span>";
  }

  function injectStyle() {
    const old = document.getElementById("mko-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "mko-style";
    // Panels, tables, pills, the bar and the KPI strip are THE COMPONENT KIT in rs.css. Only
    // what the kit has no name for lives here.
    st.textContent = ""
      + ".mko{font-variant-numeric:tabular-nums}"
      + ".mko .mko-src{font-weight:600}"
      + ".mko .mko-src a{color:inherit;text-decoration:none;border-bottom:1px dotted currentColor}"
      + ".mko .mko-src a:hover{color:var(--brand)}"
      + ".mko .mko-sub{font-size:12px;color:var(--muted);margin-top:2px;line-height:1.45}"
      + ".mko .mko-note{font-size:12px;color:var(--muted);margin-top:4px;line-height:1.45;max-width:420px}"
      + ".mko .mko-step{font-size:12.5px;line-height:1.45;max-width:340px}"
      + ".mko .mko-met{font-size:12.5px;line-height:1.45;max-width:300px;color:var(--muted)}"
      + ".mko .mko-srcs td{vertical-align:top}"
      + ".mko .mko-num{text-align:right;white-space:nowrap}"
      + ".mko .mko-date{white-space:nowrap}"
      + ".mko .mko-foot{font-size:12px;color:var(--muted);margin-top:10px}"
      + ".mko .mko-d{display:inline-block;margin-left:8px;font-size:12px;font-weight:800;vertical-align:middle}"
      + ".mko .mko-d.up{color:var(--pos)}.mko .mko-d.dn{color:var(--neg)}.mko .mko-d.eq{color:var(--faint)}"
      + ".mko .mko-feeds{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin:2px 0 12px;font-size:12.5px}"
      + ".mko .mko-feed{display:inline-flex;align-items:center;gap:6px;color:var(--muted)}"
      + ".mko .mko-feed b{color:var(--ink);font-weight:600}"
      + ".mko .mko-dot{width:8px;height:8px;border-radius:50%;background:var(--faint);flex:none}"
      + ".mko .mko-dot.ok{background:var(--pos)}.mko .mko-dot.warn{background:var(--warn,#D97706)}"
      + ".mko .mko-dot.bad{background:var(--neg)}"
      + ".mko .mko-feeds a{color:var(--muted)}"
      + ".mko .mko-ch th,.mko .mko-ch td{white-space:nowrap}"
      + ".mko .mko-ch td.mko-fam{white-space:normal;min-width:150px}"
      + ".mko .mko-ch tr.mko-grp td{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;"
      + "color:var(--muted);padding-top:14px;background:transparent}"
      + ".mko .mko-ch tr.mko-tot td{font-weight:700;border-top:1px solid var(--line-2)}"
      + ".mko .mko-ch a.mko-go{color:inherit;text-decoration:none;font-weight:600}"
      + ".mko .mko-ch a.mko-go:hover{color:var(--brand);text-decoration:underline}"
      + ".mko .mko-tag{display:inline-block;font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;"
      + "margin-left:6px;vertical-align:1px;border:1px solid var(--line-2);color:var(--muted)}"
      + ".mko .mko-tag.live{color:var(--pos);border-color:currentColor}"
      + ".mko .mko-cov{color:var(--muted)}"
      + ".mko .mko-thin{color:var(--faint)}"
      + ".mko .mko-h{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin:22px 0 8px}"
      + ".mko .mko-h h2{margin:0;font-size:17px}"
      + ".mko .mko-h .mko-sub{margin:0}"
      + "body.rs-app.light.v2 .mko .mko-sub,body.rs-app.light.v2 .mko .mko-note,"
      + "body.rs-app.light.v2 .mko .mko-met,body.rs-app.light.v2 .mko .mko-foot,"
      + "body.rs-app.light.v2 .mko .mko-feed,body.rs-app.light.v2 .mko .mko-cov{color:#64748B}"
      + "body.rs-app.light.v2 .mko .mko-d{font-weight:600}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------ data ---- */
  function index(rows) {
    D.rows = (rows || []).map(r => ({
      d: String(r.Date || "").slice(0, 10), co: r.Company, fam: r.Family || "(no source)",
      bd: r["Booked Day"] ? String(r["Booked Day"]).slice(0, 10) : null,
      leads: num(r.Leads), booked: num(r.Booked), billed: num(r.Billed), bval: num(r["Booked Value"]),
      spL: r["Spend Live"] == null ? null : num(r["Spend Live"]),
      spG: r["Spend Ledger"] == null ? null : num(r["Spend Ledger"]),
      imp: r.Impressions == null ? null : num(r.Impressions),
      clk: r.Clicks == null ? null : num(r.Clicks),
    })).filter(r => r.d);
    D.liveFrom = {}; D.ledgerEnd = null; D.minDay = null; D.maxDay = null;
    rows.forEach(r => {
      const le = String(r["Ledger End"] || "").slice(0, 10);
      if (le && (!D.ledgerEnd || le > D.ledgerEnd)) D.ledgerEnd = le;
    });
    D.rows.forEach(r => {
      if (r.spL != null && (!D.liveFrom[r.fam] || r.d < D.liveFrom[r.fam])) D.liveFrom[r.fam] = r.d;
      if (!D.minDay || r.d < D.minDay) D.minDay = r.d;
      if (r.leads && (!D.maxDay || r.d > D.maxDay)) D.maxDay = r.d;
    });
  }
  // a family-day whose spend is IN: a live API day, or a day the ledger has reached
  function liveDay(r) { return r.co === LIVE_CO && !!D.liveFrom[r.fam] && r.d >= D.liveFrom[r.fam]; }
  function covered(r) { return liveDay(r) || (!!D.ledgerEnd && r.d <= D.ledgerEnd); }

  /* the reading window [a, b]; `bEff` stops at the newest lead on file so a comparison window
     is day-matched instead of charging this year for days that have not happened */
  function win() {
    const a = S.from || D.minDay || "2024-01-01";
    const b = S.to || today();
    let bEff = D.maxDay && b > D.maxDay ? D.maxDay : b;
    if (bEff < a) bEff = b;
    return { a, b, bEff, open: !S.from };
  }
  /* the comparison window, with `asOf` (bookings as they stood that day) and `shift` (a
     comparison day -> the matching day of the current window, where spend coverage is judged) */
  function cmpWin(w) {
    if (w.open) return null;
    if (S.cmp === "prev") {
      const n = dayCount(w.a, w.bEff);
      return { a: addDays(w.a, -n), b: addDays(w.a, -1), label: "previous period",
               asOf: addDays(today(), -n), shift: d => addDays(d, n) };
    }
    return { a: addYears(w.a, -1), b: addYears(w.bEff, -1), label: "same days last year",
             asOf: addYears(today(), -1), shift: d => (+d.slice(0, 4) + 1) + d.slice(4) };
  }

  /* every family's measures for [a, b] and the company in the bar. `cw` (the comparison only):
     bookings counted as they stood on cw.asOf, spend coverage judged on cw.shift(day). */
  function aggregate(a, b, cw) {
    const by = new Map();
    // paid = spend inside the period, or in the year before its end (a month the ledger has not
    // reached yet, a postcard run between drops) -- per COMPANY and family: Tuji's Google Local
    // leads cost nothing, so with both companies picked they are not "spend not in yet"
    const look = [a, addDays(b, -PAID_LOOKBACK)].sort()[0];
    const paidKey = new Set();
    D.rows.forEach(r => {
      if (r.d >= look && r.d <= b && ((r.spL || 0) + (r.spG || 0))) paidKey.add(r.co + "|" + r.fam);
    });
    D.rows.forEach(r => {
      if (S.co && r.co !== S.co) return;
      if (r.d > b || r.d < a) return;
      let f = by.get(r.fam);
      if (!f) {
        f = { fam: r.fam, leads: 0, booked: 0, billed: 0, bval: 0, spL: 0, spG: 0, imp: 0, clk: 0,
              hasImp: false, cLeads: 0, cBooked: 0, cBval: 0, uncov: false, anyCov: false,
              live: false, ledger: false, paid: false };
        by.set(r.fam, f);
      }
      const pk = paidKey.has(r.co + "|" + r.fam);
      if (pk) f.paid = true;
      const bk = !cw || (!!r.bd && r.bd <= cw.asOf);
      // a company that never pays this family has nothing to wait for: its leads are covered
      const cov = !pk || covered(cw ? { co: r.co, fam: r.fam, d: cw.shift(r.d) } : r);
      f.leads += r.leads;
      if (bk) { f.booked += r.booked; f.billed += r.billed; f.bval += r.bval; }
      if (cov) {
        if (r.spL) { f.spL += r.spL; f.live = true; }
        if (r.spG) { f.spG += r.spG; f.ledger = true; }
        if (r.imp != null) { f.imp += r.imp; f.hasImp = true; }
        if (r.clk != null) f.clk += r.clk;
        f.cLeads += r.leads; f.anyCov = true;
        if (bk) { f.cBooked += r.booked; f.cBval += r.bval; }
      } else if (r.leads) f.uncov = true;
    });
    const out = [];
    by.forEach(f => {
      f.spend = f.spL + f.spG;
      if (!f.leads && !f.spend) return;          // quiet in this period: no row
      if (!f.paid) f.uncov = false;
      // spend days past the ledger's end are not in yet for a ledger channel; a live one has them
      f.cpb = f.paid && f.spend ? ratio(f.spend, f.cBooked) : null;
      f.roas = f.paid && f.spend ? ratio(f.cBval, f.spend) : null;
      f.cpl = f.paid && f.spend ? ratio(f.spend, f.cLeads) : null;
      f.book = ratio(f.booked, f.leads);
      out.push(f);
    });
    return out;
  }
  function totals(list) {
    const t = { leads: 0, booked: 0, billed: 0, bval: 0, spend: 0, spL: 0, spG: 0,
                pLeads: 0, pBooked: 0, pBval: 0, pSpend: 0, uncov: false };
    list.forEach(f => {
      t.leads += f.leads; t.booked += f.booked; t.billed += f.billed; t.bval += f.bval;
      t.spend += f.spend; t.spL += f.spL; t.spG += f.spG;
      if (f.paid) {
        t.pSpend += f.spend; t.pLeads += f.cLeads; t.pBooked += f.cBooked; t.pBval += f.cBval;
        if (f.uncov) t.uncov = true;
      }
    });
    t.cpb = ratio(t.pSpend, t.pBooked);
    t.roas = ratio(t.pBval, t.pSpend);
    t.cpl = ratio(t.pSpend, t.pLeads);
    t.book = ratio(t.booked, t.leads);
    return t;
  }

  /* ------------------------------------------------------------------ period memory ---- */
  function boot() {
    if (S.booted) return;
    S.booted = true;
    const P = RSC.datePresets();
    let saved = null;
    try { saved = JSON.parse(lsGet(LS_PERIOD) || "null"); } catch (e) { saved = null; }
    const hit = saved && saved.p ? P.find(p => p[0] === saved.p) : null;
    const okDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
    if (hit) { S.from = hit[1] || null; S.to = hit[2] || null; }
    else if (saved && (okDay(saved.f) || okDay(saved.t))) {
      S.from = okDay(saved.f) ? saved.f : null; S.to = okDay(saved.t) ? saved.t : null;
    } else {
      const tm = P.find(p => p[0] === "This month");
      S.from = tm[1]; S.to = tm[2];
    }
    const c = lsGet(LS_CMP);
    if (c === "ly" || c === "prev") S.cmp = c;
  }
  // a preset by NAME (so "This month" moves with the calendar), anything else by its dates
  function savePeriod() {
    const hit = RSC.datePresets().find(p => p[1] === (S.from || "") && p[2] === (S.to || ""));
    lsSet(LS_PERIOD, JSON.stringify(hit ? { p: hit[0] } : { f: S.from, t: S.to }));
  }

  /* ------------------------------------------------------------------ paint ---- */
  function feedsHtml() {
    if (!D.conn.length) return "";
    const by = {};
    D.conn.forEach(r => { by[r.Key] = r; });
    return '<div class="mko-feeds"><span>Data in:</span>' + FEEDS.map(([k, name]) => {
      const r = by[k];
      if (!r) return "";
      const cls = PILL[r.Status] || "mute";
      const when = r["Newest Data"] ? "through " + shortDay(r["Newest Data"]) : String(r.Status || "").toLowerCase();
      return '<span class="mko-feed" title="' + esc(r.Status + (r["Status Note"] ? " · " + r["Status Note"] : "")) + '">'
        + '<i class="mko-dot ' + cls + '"></i><b>' + esc(name) + "</b> " + esc(when) + "</span>";
    }).join("") + '<a href="#mkoSources">all sources ↓</a></div>';
  }

  function famCell(f) {
    const href = "#page=source-report&src=" + encodeURIComponent(f.fam);
    return '<a class="mko-go" href="' + esc(href) + '" title="Open ' + esc(f.fam)
      + ' in Source Analysis">' + esc(f.fam) + "</a>"
      + (FAM_NOTE[f.fam] ? '<div class="mko-sub">' + esc(FAM_NOTE[f.fam]) + "</div>" : "");
  }
  function spendCell(f) {
    if (!f.paid) return '<span class="mko-sub">—</span>';
    const tag = f.live && f.ledger ? '<span class="mko-tag live" title="live API, bank ledger before it went live">live + ledger</span>'
      : f.live ? '<span class="mko-tag live" title="from the platform API, updated daily">live</span>'
      : '<span class="mko-tag" title="from the bank ledger, pasted monthly">ledger</span>';
    if (!f.anyCov) {
      return '<span class="mko-cov" title="the bank ledger runs through ' + esc(day(D.ledgerEnd))
        + '">not in yet</span>' + tag;
    }
    let h = money0(f.spend) + tag;
    if (f.uncov) {
      h += '<div class="mko-sub">' + (f.live ? "ledger part " : "") + "through "
        + esc(shortDay(D.ledgerEnd)) + "</div>";
    } else if (f.hasImp && f.clk && f.spL) {
      // live spend over live clicks: ledger days before the API went live have no clicks
      h += '<div class="mko-sub">' + fmtN(f.clk) + " clicks · $" + (f.spL / f.clk).toFixed(2)
        + " a click</div>";
    }
    return h;
  }
  // a cost read on the covered days only says so; a thin sample is drawn muted
  // a cost read on the covered days only carries a * (the table hint says what it means); a
  // thin sample is drawn muted
  function costCell(v, f, fmt, thin) {
    if (v == null) return '<span class="mko-sub">—</span>';
    const tip = [thin ? "fewer than " + THIN + " booked jobs: a small sample" : "",
                 f.uncov ? "read on the leads whose spend is in (the bank ledger runs through "
                   + day(D.ledgerEnd) + ")" : ""].filter(Boolean).join(" · ");
    return "<span" + (thin ? ' class="mko-thin"' : "") + (tip ? ' title="' + esc(tip) + '"' : "") + ">"
      + fmt(v) + (f.uncov ? "*" : "") + "</span>";
  }

  function channelRows(list, label, sortKey) {
    if (!list.length) return "";
    list.sort((x, y) => (y[sortKey] - x[sortKey]) || (y.leads - x.leads));
    const t = totals(list);
    let h = '<tr class="mko-grp"><td colspan="9">' + esc(label) + " · " + list.length
      + (list.length === 1 ? " channel" : " channels") + "</td></tr>";
    list.forEach(f => {
      h += '<tr><td class="mko-fam">' + famCell(f) + "</td>"
        + '<td class="mko-num">' + spendCell(f) + "</td>"
        + '<td class="mko-num">' + fmtN(f.leads) + "</td>"
        + '<td class="mko-num">' + fmtN(f.booked) + "</td>"
        + '<td class="mko-num">' + pct(f.book) + "</td>"
        + '<td class="mko-num">' + money0(f.bval) + "</td>"
        + '<td class="mko-num">' + costCell(f.cpb, f, money0, f.cBooked < THIN) + "</td>"
        + '<td class="mko-num">' + costCell(f.roas, f, perDollar, f.cBooked < THIN) + "</td>"
        + '<td class="mko-num">' + costCell(f.cpl, f, money0, false) + "</td>"
        + "</tr>";
    });
    const paid = list[0] && list[0].paid;
    h += '<tr class="mko-tot"><td>All ' + esc(label.toLowerCase()) + "</td>"
      + '<td class="mko-num">' + (!paid ? '<span class="mko-sub">—</span>'
        : list.some(f => f.anyCov) ? money0(t.spend)
        : '<span class="mko-cov">not in yet</span>') + "</td>"
      + '<td class="mko-num">' + fmtN(t.leads) + "</td>"
      + '<td class="mko-num">' + fmtN(t.booked) + "</td>"
      + '<td class="mko-num">' + pct(t.book) + "</td>"
      + '<td class="mko-num">' + money0(t.bval) + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.cpb, t, money0, false) : "—") + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.roas, t, perDollar, false) : "—") + "</td>"
      + '<td class="mko-num">' + (paid ? costCell(t.cpl, t, money0, false) : "—") + "</td></tr>";
    return h;
  }

  function channelsHtml(fams) {
    const paid = fams.filter(f => f.paid), free = fams.filter(f => !f.paid);
    if (!fams.length) return '<div class="rs-hint">No leads or spend in this period for this company.</div>';
    return '<div class="rs-tablewrap"><table class="rs-table mko-ch"><thead><tr>'
      + "<th>Channel</th>"
      + '<th class="mko-num">Spend</th>'
      + '<th class="mko-num" title="leads created in the period">Leads</th>'
      + '<th class="mko-num" title="of those leads, how many booked (Confirmed)">Booked</th>'
      + '<th class="mko-num" title="booked ÷ leads">Book %</th>'
      + '<th class="mko-num" title="billed where the move happened, else the booked quote">Booked value</th>'
      + '<th class="mko-num" title="spend ÷ booked jobs">Cost per booking</th>'
      + '<th class="mko-num" title="booked value ÷ spend">$ per $1</th>'
      + '<th class="mko-num" title="spend ÷ leads">Cost per lead</th>'
      + "</tr></thead><tbody>"
      + channelRows(paid, "Paid", "spend")
      + channelRows(free, "Unpaid", "leads")
      + "</tbody></table></div>";
  }

  function kpisFor(host, w, cw) {
    const cur = totals(aggregate(w.a, w.bEff));
    const prev = cw ? totals(aggregate(cw.a, cw.b, cw)) : null;
    // a KPI card has two short lines: the comparison names its side in two words
    const was = (v, fmt) => prev ? (S.cmp === "prev" ? "previous" : "last year") + ": " + fmt(v) : "";
    const spendSub = cur.spL && cur.spG ? "live " + money(cur.spL) + " · ledger " + money(cur.spG)
      : cur.spL ? "live APIs" : "bank ledger";
    RSC.kpis(host, [
      { label: "Spend", value: money(cur.spend) + (prev ? delta(cur.spend, prev.spend, null) : ""),
        sub: (prev ? was(prev.spend, money) + " · " : "") + spendSub },
      { label: "Leads", value: fmtN(cur.leads) + (prev ? delta(cur.leads, prev.leads) : ""),
        sub: was(prev && prev.leads, fmtN) || "created in the period" },
      { label: "Booked jobs", value: fmtN(cur.booked) + (prev ? delta(cur.booked, prev.booked) : ""),
        sub: pct(cur.book) + " of leads" + (prev ? " · " + was(prev.booked, fmtN) : "") },
      { label: "Cost per booking", value: money0(cur.cpb) + (prev ? delta(cur.cpb, prev.cpb, true) : ""),
        sub: "paid channels" + (prev ? " · " + was(prev.cpb, money0) : "") },
      { label: "$ per $1 of ads", value: perDollar(cur.roas) + (prev ? delta(cur.roas, prev.roas) : ""),
        sub: "booked value ÷ spend" + (prev ? " · " + was(prev.roas, perDollar) : "") },
      { label: "Cost per lead", value: money0(cur.cpl) + (prev ? delta(cur.cpl, prev.cpl, true) : ""),
        sub: "paid channels" + (prev ? " · " + was(prev.cpl, money0) : "") },
    ]);
  }

  /* --- the data sources (bottom) --- */
  function sourcesHtml() {
    const rows = D.conn;
    if (D.connErr) return '<div class="panel">Could not load the source list — ' + esc(D.connErr) + "</div>";
    if (!rows.length) {
      return '<div class="panel">The source list is not built yet — it is written by the hourly '
        + "pipeline (sources=freshness).</div>";
    }
    const count = s => rows.filter(r => r.Status === s).length;
    const plat = rows.filter(r => r.Group === "Marketing platforms");
    const ours = rows.filter(r => r.Group !== "Marketing platforms");
    const bankThrough = (plat.find(r => r["Bank Through"]) || {})["Bank Through"];
    const bankYear = (plat.find(r => r["Bank Year"]) || {})["Bank Year"] || "";
    const pill = s => '<span class="rs-pill ' + (PILL[s] || "mute") + '">' + esc(s) + "</span>";

    function sourceCell(r) {
      const name = r.Link
        ? '<a href="' + esc(r.Link) + '" target="_blank" rel="noopener">' + esc(r.Platform) + " ↗</a>"
        : esc(r.Platform);
      const who = [r.Login, r.Account].filter(Boolean).map(esc).join(" · ");
      return '<div class="mko-src">' + name + "</div>"
        + (who ? '<div class="mko-sub">' + who + "</div>" : "")
        + (r.Note ? '<div class="mko-note">' + esc(r.Note) + "</div>" : "");
    }
    function statusCell(r) {
      return pill(r.Status)
        + (r.Connection !== r.Status ? '<div class="mko-sub">' + esc(r.Connection) + "</div>" : "")
        // the date column already says "through X"; the note earns its line only when late
        + ((r.Status === "Behind" || r.Status === "No data") && r["Status Note"]
          ? '<div class="mko-note">' + esc(r["Status Note"]) + "</div>" : "");
    }
    function bankCell(r) {
      if (r["Bank Spend"] == null) return '<span class="mko-sub">—</span>';
      const v = +r["Bank Spend"];
      return "<div>" + (v ? money0(v) : "$0") + "</div>"
        + '<div class="mko-sub">' + (r["Bank Last Charge"]
          ? "last charge " + shortDay(r["Bank Last Charge"]) : "no charges") + "</div>";
    }
    function table(list, withBank) {
      let h = '<div class="rs-tablewrap"><table class="rs-table mko-srcs"><thead><tr>'
        + "<th>Source</th><th>Status</th><th>Data through</th><th>Last pulled</th>"
        + (withBank ? '<th class="mko-num">Bank ' + esc(bankYear) + "</th>" : "")
        + "<th>What it gives</th><th>Next step</th></tr></thead><tbody>";
      list.forEach(r => {
        h += "<tr><td>" + sourceCell(r) + "</td>"
          + "<td>" + statusCell(r) + "</td>"
          + '<td class="mko-date">' + (r["Newest Data"] ? day(r["Newest Data"]) : '<span class="mko-sub">—</span>') + "</td>"
          + '<td class="mko-date">' + (r["Last Pulled"] ? shortDay(r["Last Pulled"]) : '<span class="mko-sub">—</span>') + "</td>"
          + (withBank ? '<td class="mko-num">' + bankCell(r) + "</td>" : "")
          + '<td><div class="mko-met">' + esc(r.Metrics || "") + "</div></td>"
          + '<td><div class="mko-step">' + esc(r["Next Step"] || "") + "</div></td>"
          + "</tr>";
      });
      return h + "</tbody></table></div>";
    }
    const checked = rows.map(r => r["Checked At"]).filter(Boolean).sort().pop();
    const connected = rows.filter(r => r.Status !== "Not connected").length;
    const parts = [connected + " of " + rows.length + " connected"];
    [["Up to date", "up to date"], ["Behind", "behind"], ["No data", "connected without data"],
     ["Not connected", "not connected"]].forEach(([st, l]) => { if (count(st)) parts.push(count(st) + " " + l); });
    return '<div class="mko-h" id="mkoSources"><h2>Data sources</h2><span class="mko-sub">'
      + esc(parts.join(" · ")) + "</span></div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Marketing platforms'
      + "</span></div>"
      + '<p class="rs-hint">Each platform with the login that holds it and the numbers we want '
      + "from it. Not connected means no data flows yet; the last column says what unblocks it. "
      + "The bank column is what the bank ledger shows paid to the platform in " + esc(bankYear)
      + (bankThrough ? ", through " + esc(day(bankThrough)) : "") + ".</p>"
      + table(plat, true) + "</div>"
      + '<div class="panel"><div class="panel-head"><span class="panel-title">Our own data'
      + "</span></div>"
      + '<p class="rs-hint">What the page reads beside the platforms: our leads, calls, jobs and '
      + "spend. Each is judged against its own rhythm, so a monthly ledger is not called late "
      + "every day.</p>"
      + table(ours, false) + "</div>"
      + '<div class="mko-foot">Status checked ' + esc(day(checked))
      + (checked && String(checked).length > 10 ? " " + esc(String(checked).slice(11, 16)) + " UTC" : "")
      + " · refreshed every hour by the pipeline.</div>";
  }

  function paint(host) {
    const w = win();
    const cw = cmpWin(w);
    let body;
    if (D.chErr) {
      body = '<div class="panel">The channel table could not load — ' + esc(D.chErr)
        + (/404|unknown dataset|not granted/i.test(D.chErr)
          ? " (it arrives with the next pipeline run, or a <b>mkt-overview</b> rebuild)" : "") + "</div>";
    } else {
      const fams = aggregate(w.a, w.bEff);
      const past = D.ledgerEnd && w.bEff > D.ledgerEnd;
      body = '<div class="rs-kpis" id="mkoKpis"></div>'
        + '<p class="rs-hint hidden" id="mkoKpiHint"></p>'
        + '<div class="panel"><div class="panel-head"><span class="panel-title">Channels</span></div>'
        + '<p class="rs-hint">Every source with leads or spend in the period. Booked = leads created in '
        + "the period that booked. Spend is live from Google Ads, Local Services, Meta and ChatGPT; "
        + "every other channel is the bank ledger"
        + (D.ledgerEnd ? ", which runs through " + esc(day(D.ledgerEnd)) : "")
        + (past ? "; a * marks cost figures read on the leads whose spend is in" : "")
        + ". Click a channel to open it in Source Analysis.</p>"
        + channelsHtml(fams) + "</div>";
    }
    host.innerHTML = '<div class="mko">'
      + '<div class="rs-page-head"><h1>Marketing Overview</h1>'
      + "<p>What each channel cost and brought in the period, then every source that feeds this "
      + "page and whether it is up to date.</p></div>"
      + '<div class="rs-bar">'
      + '<div id="mkoCo"></div>'
      + '<div class="rs-fld"><span>Period</span><div id="mkoDate"></div></div>'
      + '<div class="rs-fld"><span>Compare</span><div class="rs-seg" id="mkoCmp">'
      + '<button type="button" data-v="ly">vs last year</button>'
      + '<button type="button" data-v="prev">vs previous period</button></div></div>'
      + "</div>"
      + feedsHtml()
      + body
      + sourcesHtml()
      + "</div>";

    RSC.localSelect(host.querySelector("#mkoCo"), {
      label: "Company", allLabel: "Both companies",
      values: [{ v: "Zip to Zip", l: "Zip to Zip" }, { v: "Tuji", l: "Tuji" }],
      value: S.co,
      onChange: v => { S.co = v; paint(host); },
    });
    RSC.dateRange(host.querySelector("#mkoDate"), {
      get: () => ({ from: S.from, to: S.to }),
      set: (f, t) => { S.from = f; S.to = t; savePeriod(); },
      onChange: () => paint(host),
    });
    const cmp = host.querySelector("#mkoCmp");
    cmp.querySelectorAll("button").forEach(b => {
      b.classList.toggle("on", !w.open && b.dataset.v === S.cmp);
      b.disabled = !!w.open;
      if (w.open) b.title = "no comparison for All time — pick a period to compare";
      b.onclick = () => { S.cmp = b.dataset.v; lsSet(LS_CMP, S.cmp); paint(host); };
    });
    const k = host.querySelector("#mkoKpis");
    if (k) kpisFor(k, w, cw);
    const kh = host.querySelector("#mkoKpiHint");
    if (kh) {
      const short = aggregate(w.a, w.bEff).some(f => f.paid && f.uncov);
      const bits = [];
      if (short) {
        bits.push("The bank ledger runs through " + day(D.ledgerEnd) + ": for later days the cost "
          + "figures count only the channels with live spend (Google Ads, Local Services, Meta, "
          + "ChatGPT)" + (cw ? ", in both periods" : "") + ".");
      }
      if (cw) {
        bits.push("The " + cw.label + "'s bookings are counted as they stood on " + day(cw.asOf)
          + ", so a young cohort is not set against one that had longer to book.");
      }
      kh.innerHTML = bits.map(esc).join(" ");
      kh.classList.toggle("hidden", !bits.length);
    }
  }

  registerPage({
    id: "marketing-overview",
    group: "marketing",
    title: "Marketing Overview",
    subtitle: "What each channel cost and brought for any period, then every source that feeds " +
              "this page and whether it is up to date.",
    datasets: [],

    render(host) {
      const mine = host;
      const alive = () => document.body.contains(mine);
      injectStyle();
      // RS.load caches per refresh epoch, so asking again on every visit is free and picks up the
      // hourly rebuild; the loading bar shows on the first visit only
      if (!D.ready) {
        host.innerHTML = '<div class="rs-loading">Reading leads, bookings and ad spend by channel…'
          + '<div class="bar"><i></i></div></div>';
      }
      D.connErr = null; D.chErr = null;
      Promise.all([
        RS.load("mkt_connector").catch(e => { D.connErr = (e && e.message) || String(e); return []; }),
        RS.load("mkt_channel").catch(e => { D.chErr = (e && e.message) || String(e); return []; }),
      ]).then(([conn, ch]) => {
        D.conn = (conn || []).slice().sort((a, b) => (+a.Sort || 0) - (+b.Sort || 0));
        index(ch || []);
        D.ready = !D.chErr && !D.connErr;   // a failed read is tried again on the next visit
        if (!alive()) return;
        boot();
        paint(host);
      });
    },
  });
})();
