/* Sales Person Analysis — the sales LEAD's lead-360 report (report id: sales-command;
   page was named "Sales Team Command" until 2026-07-25 — the ID never changes, ACLs ride on it).
   v3 (Tornike 2026-07-23 feedback round):
     - Speed/Inflow tabs REMOVED (they live as their own pages)
     - CONTACT truth: contacted = outbound call OR answered incoming ("we spoke")
     - canonical funnel reused verbatim: Qualified = Status Category !== 'Bad Lead',
       Dead = 'Bad Lead', Confirmed = 'Confirmed' (by confirmed date), RS.bookingRate
     - Estimate -> Actual with the change % everywhere
     - Detailed / Compact toggle on the people table (Money-Flow style), bigger type
     - Lead File drawer MUCH bigger: full closing-sheet section + refunds/claims/reviews
   Global filter bar applies, EXCEPT Moving Type: that slicer's options are the closing
   sheet's coarse job vocabulary and this dataset carries moveboard's fine-grained lead
   Service Type, so it is deliberately unmapped here (see FIELDS in rs-core.js) rather
   than silently dropping most leads. Giorgi Kolbaia (branch owner) excluded from people. */

(() => {
  const EXCLUDE_SP = new Set(["giorgi kolbaia"]);
  // branch owner + non-person accounts (test/training/draft/routing buckets) never count
  // as an individual salesperson to assess.
  const excluded = n => {
    n = (n || "").trim().toLowerCase();
    return !n || EXCLUDE_SP.has(n) || /\btest\b|training|draft user|yelp team|^-\d|^-\s|^test/.test(n);
  };
  // Not-Active (departed) reps are dropped from the Rep Profile — list AND the ranking pool,
  // so the assessment compares each rep only against the current active team. Status comes
  // from the crew roster (fct_rep_stats); reps with no roster status are treated as active.
  const inactive = p => /not/i.test((p && p.call && p.call.status) || "");
  // Minimum leads (in the current filter) to list & assess a rep — below this we can't
  // read them reliably, so low-volume stragglers (estimators/support who catch a stray
  // lead) drop off the Rep Profile instead of showing "Not enough data".
  const ASSESS_MIN = 20;
  let ST_LAST_TAB = "team";   // remembers the active tab across a global page re-render
  const TH_KEY = "st_thresholds_v1";
  const thDefaults = { slowMin: 30, neverPct: 10, convFrac: 0.5, minLeads: 5 };
  const thGet = () => { try { return { ...thDefaults, ...(JSON.parse(localStorage.getItem(TH_KEY)) || {}) }; } catch (e) { return { ...thDefaults }; } };
  const thSet = t => { try { localStorage.setItem(TH_KEY, JSON.stringify(t)); } catch (e) {} };

  const esc = s => RSC.esc(s == null ? "" : String(s));
  const num = v => (v == null || v === "" ? null : +v);
  const money0 = v => (v == null || isNaN(v) ? "—" : RS.money(+v));
  const pct1 = v => (v == null || isNaN(v) ? "—" : (Math.round(v * 10) / 10) + "%");
  const mins = v => {
    if (v == null) return "—";
    v = +v;
    if (v < 60) return Math.round(v) + "m";
    const h = v / 60;
    return h < 24 ? (Math.round(h * 10) / 10) + "h" : Math.round(h / 24) + "d";
  };
  const secH = v => {
    if (!v) return "—";
    v = Math.round(+v);
    if (v < 60) return v + "s";
    const m = Math.floor(v / 60);
    return m < 60 ? m + "m " + (v % 60) + "s" : Math.floor(m / 60) + "h " + (m % 60) + "m";
  };
  const median = a => {
    const v = a.filter(x => x != null).sort((x, y) => x - y);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  };
  /* canonical funnel predicates — rs-core's registered measures, verbatim */
  const isConf = r => String(r["Status Category"] || "").trim() === "Confirmed";
  const isDead = r => String(r["Status Category"] || "").trim() === "Bad Lead";
  const isQual = r => !isDead(r);
  const isContacted = r => !!+r["Contacted"] || !!+r["Called"];   // RC evidence: Contacted col, Called fallback
  // Confirmation is proof of contact ("no way to confirm without talking to them" — Tornike).
  // A confirmed lead is REACHED even when RingCentral shows no call (it happened after the
  // export cutoff, or on a line we don't capture). Only un-confirmed leads can be "no contact".
  const isReached = r => isContacted(r) || isConf(r);
  const isNeverContacted = r => inWindow(r) && !isReached(r);
  // Leads created after the newest call in the warehouse can't be judged on contact
  // (Austin Hayes case: confirmed next-day, but the RC export ends earlier).
  const inWindow = r => r["In Call Window"] == null ? true : !!+r["In Call Window"];
  const estActual = r => {
    const q = num(r["Avg Quote"]), b = num(r["Total Bill"]);
    if (q == null && b == null) return "—";
    if (b == null) return money0(q);
    const d = r["Bill Vs Quote Pct"];
    return `${money0(q)} → <b>${money0(b)}</b>` +
      (d != null ? ` <span class="${+d >= 0 ? "st-good" : "st-bad"}">${+d > 0 ? "+" : ""}${pct1(+d)}</span>` : "");
  };
  const stripExt = s => String(s == null ? "" : s).replace(/\b\d+\s*-\s*/g, "").trim();
  const calMismatch = r => !!+r["Cal Found"] &&
    ((r["Cal Date Match"] != null && !+r["Cal Date Match"]) ||
     (r["Cal Loc Match"] != null && !+r["Cal Loc Match"]));
  // Move date + (when we have one) a button straight to the Google Calendar event, and the
  // calendar's own date underneath whenever the two sources disagree.
  const calLink = r => {
    const u = String(r["Cal Link"] || "").trim();
    if (/^https:\/\/(www\.)?(calendar\.)?google\.com\//i.test(u)) return u;
    // no stored link (event predates the loader change): fall back to the calendar's day view
    const d = String(r["Cal Event Date"] || "").slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(d)
      ? `https://calendar.google.com/calendar/u/0/r/day/${d.slice(0, 4)}/${+d.slice(5, 7)}/${+d.slice(8, 10)}`
      : null;
  };
  const moveCell = r => {
    const mv = String(r["Move Date"] || "").slice(0, 10);
    const cd = String(r["Cal Event Date"] || "").slice(0, 10);
    const u = +r["Cal Found"] ? calLink(r) : null;
    const btn = u ? `<a class="st-cal" href="${esc(u)}" target="_blank" rel="noopener"
        title="Open this job's Google Calendar event" onclick="event.stopPropagation()">📅</a>` : "";
    const diff = mv && cd && mv !== cd
      ? `<span class="st-caldiff" title="Moveboard says ${mv}, the calendar event says ${cd}">calendar: ${cd}</span>` : "";
    return (mv ? `<b>${esc(mv)}</b>` : `<span style="color:var(--faint)">—</span>`) + btn + diff;
  };

  const contactCell = r => {
    if (+r["Called"]) return r["TTO Biz Min"] != null ? mins(+r["TTO Biz Min"]) : "yes";
    // Contacted=1 with Called=0 is EITHER an answered incoming call OR an outbound dial in the
    // 24h before the lead was entered (CRM lag). Only claim "they called in" when an answered
    // incoming call is actually on record.
    if (isContacted(r)) return +r["Answered In"]
      ? `<span class="st-good" title="The customer called in and we answered — counted as contact (a call still open at export time is treated as completed).">answered ✓</span>`
      : `<span class="st-good" title="Contact happened just before this lead was entered in the CRM — the call is on the customer's number within 24h of creation.">contacted ✓</span>`;
    if (isConf(r)) return `<span class="st-good" title="${+r["Conf After Horizon"] ? "Confirmed after the RingCentral export cutoff — the closing calls are past the data window" : "Confirmed — sales spoke to the customer; the call isn't in RingCentral (off-system or after the export cutoff)"}">confirmed ✓</span>`;
    if (!inWindow(r)) return `<span class="st-dim" title="This lead was created after the newest call data in the warehouse — refresh the RingCentral export to see its calls">no data yet</span>`;
    return `<span class="st-bad">no contact</span>`;
  };

  function injectStyle() {
    const old = document.getElementById("st-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "st-style";
    st.textContent = `
    /* ===== full-bleed, modern data-command design ===== */
    .st-page{max-width:none;margin:0}
    /* tabs — segmented pill */
    .st-tabbar{display:inline-flex;gap:3px;background:var(--panel-2);border:1px solid var(--line);border-radius:13px;padding:4px;margin:2px 0 20px}
    .st-tab{appearance:none;border:0;background:none;font-family:inherit;font-size:14px;font-weight:750;color:var(--muted);padding:9px 20px;cursor:pointer;border-radius:9px;transition:color .15s,background .15s}
    .st-tab:hover{color:var(--ink)}
    .st-tab.on{color:var(--brand-ink);background:var(--brand);box-shadow:0 3px 10px var(--brand-glow)}
    /* KPI tiles */
    .st-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:18px}
    @media(max-width:900px){.st-kpis{grid-template-columns:repeat(2,1fr)}}
    .st-draftnm{color:var(--faint);font-style:italic;font-weight:650;border-bottom:1px dotted var(--line-2);cursor:help}
    .st-kpi{position:relative;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:14px;padding:12px 16px 11px;box-shadow:var(--shadow);overflow:hidden;transition:transform .16s,box-shadow .16s,border-color .16s}
    .st-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--brand),var(--brand-d));opacity:0;transition:opacity .16s}
    .st-kpi:hover{transform:translateY(-2px);border-color:var(--line-2);box-shadow:0 2px 4px rgba(0,0,0,.04),0 18px 42px rgba(0,0,0,.13)}
    .st-kpi:hover::before{opacity:.95}
    .st-kpi .l{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .st-kpi .v{font-size:27px;font-weight:850;color:var(--ink);margin-top:5px;letter-spacing:-.5px;font-variant-numeric:tabular-nums;line-height:1.04}
    .st-kpi .v.st-bad{color:var(--red)} .st-kpi .v.st-good{color:var(--brand-d)}
    .st-kpi .s{font-size:11.5px;color:var(--faint);margin-top:3px}
    /* cards */
    .st-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:18px 20px;margin-bottom:16px}
    /* tables (shared) */
    .st-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13.5px}
    .st-tbl th{text-align:left;color:var(--muted);font-weight:750;font-size:11px;text-transform:uppercase;letter-spacing:.05em;padding:11px 13px;border-bottom:1px solid var(--line);white-space:nowrap;background:var(--panel)}
    .st-tbl td{padding:11px 13px;border-bottom:1px solid var(--line);white-space:nowrap;font-variant-numeric:tabular-nums}
    .st-tbl tbody tr:last-child td{border-bottom:0}
    .st-tbl tr.click{cursor:pointer} .st-tbl tr.click:hover td{background:var(--brand-glow)}
    /* Lead-Explorer data grid: rounded frame, frozen header, own scroll */
    .st-grid{border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);background:var(--panel);overflow:hidden}
    .st-gridscroll{max-height:calc(100vh - 340px);min-height:340px;overflow:auto}
    .st-gridscroll .st-tbl thead th{position:sticky;top:0;z-index:3;background:var(--panel-2);border-bottom:1px solid var(--line-2);box-shadow:0 1px 0 var(--line-2)}
    .st-gridscroll .st-tbl tbody tr:hover td{background:var(--brand-glow)}
    .st-bad{color:var(--red);font-weight:750} .st-good{color:var(--brand);font-weight:700}
    .st-dim{color:var(--faint);font-weight:600}
    .st-flag{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.03em;border:1px solid;border-radius:999px;padding:1px 8px;margin-right:4px}
    .st-flag.r{color:var(--red);border-color:color-mix(in srgb,var(--red) 55%,transparent)} .st-flag.a{color:var(--amber);border-color:color-mix(in srgb,var(--amber) 55%,transparent)}
    .st-flag.b{color:var(--blue);border-color:color-mix(in srgb,var(--blue) 55%,transparent)} .st-flag.p{color:var(--purple);border-color:color-mix(in srgb,var(--purple) 55%,transparent)}
    /* toolbar */
    .st-toolbar{display:flex;gap:9px;align-items:center;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 12px;box-shadow:var(--shadow);margin-bottom:12px}
    .st-search{position:relative;flex:1;min-width:240px}
    .st-search input{width:100%;background:var(--panel-2) no-repeat 11px center;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='%238a97a6' stroke-width='2.2' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M21 21l-4.3-4.3'/%3E%3C/svg%3E");border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:13.5px;padding:9px 12px 9px 34px;outline:0;transition:border-color .15s,box-shadow .15s}
    .st-search input:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}
    .st-toolbar select{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:13px;font-weight:600;padding:9px 11px;outline:0;cursor:pointer;transition:border-color .15s}
    .st-toolbar select:hover{border-color:var(--line-2)} .st-toolbar select:focus{border-color:var(--brand)}
    .st-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
    .st-bar select{background:var(--panel);border:1px solid var(--line);border-radius:10px;color:var(--ink);font:inherit;font-size:13px;padding:9px 11px;outline:0;cursor:pointer}
    .st-chips{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:13px}
    .st-chip{appearance:none;border:1px solid var(--line-2);background:var(--panel);border-radius:999px;color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;padding:7px 15px;cursor:pointer;transition:.13s}
    .st-chip:hover{color:var(--ink);border-color:var(--faint)}
    .st-chip.on{color:var(--brand-ink);border-color:var(--brand);background:var(--brand);box-shadow:0 2px 8px var(--brand-glow)}
    /* ===== rep profile — futuristic ===== */
    .rp-head{position:relative;display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:space-between;
      background:radial-gradient(130% 180% at 0% 0%,var(--brand-glow),transparent 52%),linear-gradient(180deg,var(--panel),var(--panel-2));
      border:1px solid var(--line);border-radius:20px;box-shadow:var(--shadow);padding:22px 26px;margin-bottom:16px;overflow:hidden}
    .rp-head::after{content:"";position:absolute;right:-60px;top:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(closest-side,var(--brand-glow),transparent);opacity:.6;pointer-events:none}
    .rp-id{display:flex;align-items:center;gap:17px;position:relative;z-index:1}
    .rp-avatar{width:58px;height:58px;border-radius:17px;display:grid;place-items:center;font-size:23px;font-weight:850;color:var(--brand-ink);background:linear-gradient(140deg,var(--brand),var(--brand-d));box-shadow:0 8px 22px var(--brand-glow);letter-spacing:-.5px;flex-shrink:0}
    .rp-name{font-size:29px;font-weight:860;color:var(--ink);letter-spacing:-.7px;line-height:1.08}
    .rp-sub{font-size:12.5px;color:var(--muted);margin-top:6px;font-weight:600;display:flex;gap:7px;align-items:center;flex-wrap:wrap}
    .rp-pill{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:750;padding:3px 10px;border-radius:999px;border:1px solid var(--line-2);color:var(--muted)}
    .rp-pill.on{color:var(--brand-d);border-color:color-mix(in srgb,var(--brand) 45%,transparent);background:var(--brand-glow)}
    .rp-strengths{display:grid;gap:7px;min-width:290px;position:relative;z-index:1}
    .rp-watch{margin-top:12px}
    .rp-cap{font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);margin-bottom:3px}
    .rp-str{display:flex;align-items:center;gap:10px;font-size:12.5px;padding:8px 13px;border-radius:11px;background:var(--panel);border:1px solid var(--line)}
    .rp-str-l{flex:1;color:var(--muted);font-weight:650}
    .rp-str-v{font-weight:820;color:var(--ink);font-variant-numeric:tabular-nums}
    .rp-str-r{font-size:11px;color:var(--brand-d);font-weight:800;min-width:58px;text-align:right}
    .rp-watch .rp-str-r{color:var(--amber)}
    .rp-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
    @media(max-width:900px){.rp-cols{grid-template-columns:1fr}}
    .rp-cardcap{font-size:13px;font-weight:800;color:var(--ink);margin-bottom:12px;letter-spacing:-.1px}
    .rp-alltime{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--amber);border:1px solid color-mix(in srgb,var(--amber) 45%,transparent);border-radius:999px;padding:1px 8px;margin-left:7px;vertical-align:middle}
    .rp-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--panel-2);gap:1px}
    .rp-stack>div{min-width:2px}
    .rp-trend{display:flex;gap:12px;align-items:flex-end;padding:10px 2px 2px;overflow-x:auto;width:100%}
    .rp-mo{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:6px;cursor:default}
    .rp-mo-val{font-size:11px;font-weight:750;color:var(--muted);font-variant-numeric:tabular-nums;text-align:center}
    /* fixed-height slot so every month shares one baseline; the bar sits at its bottom */
    .rp-mo-slot{display:flex;align-items:flex-end;justify-content:center}
    /* one bar = that month's leads, split bottom-up: confirmed / qualified-not-confirmed / dead.
       The printed % is confirmed / qualified, which is now exactly the green share of the
       non-grey part -- you can check the number against the picture. */
    .rp-mo-bar{width:100%;max-width:30px;border-radius:4px 4px 0 0;display:flex;flex-direction:column;
      overflow:hidden;transition:filter .12s;background:var(--blue)}
    .rp-mo-dead{width:100%;background:var(--line)}
    .rp-mo-open{width:100%;background:var(--blue)}
    .rp-mo-fill{width:100%;background:var(--brand)}
    .rp-mo:hover .rp-mo-bar{filter:brightness(1.14)}
    .rp-mo-x{font-size:10px;color:var(--faint);font-variant-numeric:tabular-nums;text-align:center}
    .rp-mo-pct{font-size:9.5px;font-weight:700;color:var(--brand);font-variant-numeric:tabular-nums;text-align:center}
    .rp-trend-base{height:1px;background:var(--line);margin:0 2px}
    .st-cal{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;
      border:1px solid var(--line);border-radius:6px;text-decoration:none;font-size:11px;line-height:1;
      background:var(--panel-2);vertical-align:middle;margin-left:5px}
    .st-cal:hover{border-color:var(--blue);background:var(--panel)}
    .st-caldiff{display:block;font-size:10.5px;font-weight:700;color:var(--warn);font-variant-numeric:tabular-nums}
    .rp-lg{display:inline-block;width:9px;height:9px;border-radius:2px;vertical-align:middle}
    .rp-lg-l{background:var(--blue)} .rp-lg-c{background:var(--brand)} .rp-lg-d{background:var(--line)}
    /* mix-adjusted booking — visual gauge */
    .rp-mix{display:flex;align-items:center;gap:22px;flex-wrap:wrap;margin:2px 0 10px}
    .rp-mix-cell{min-width:140px}
    .rp-mix-l{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}
    .rp-mix-v{font-size:30px;font-weight:850;color:var(--ink);font-variant-numeric:tabular-nums;letter-spacing:-.6px;margin-top:3px}
    .rp-mix-arrow{font-size:24px;color:var(--faint)}
    .rp-mix-gap{font-size:20px;font-weight:850;padding:8px 16px;border-radius:12px;font-variant-numeric:tabular-nums;border:1px solid var(--line)}
    .rp-mix-gap.st-good{color:var(--brand-d);background:var(--brand-glow);border-color:color-mix(in srgb,var(--brand) 40%,transparent)}
    .rp-mix-gap.st-bad{color:var(--red);background:color-mix(in srgb,var(--red) 10%,transparent);border-color:color-mix(in srgb,var(--red) 40%,transparent)}
    .rp-track{position:relative;height:9px;border-radius:999px;background:var(--panel-2);border:1px solid var(--line);margin:2px 0 2px;overflow:visible}
    .rp-track-fill{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:linear-gradient(90deg,var(--brand),var(--brand-d))}
    .rp-track-mark{position:absolute;top:-3px;bottom:-3px;width:3px;border-radius:2px;background:var(--ink);opacity:.55}
    /* distribution / win-leak — segmented toggle */
    .rp-dimbar{display:inline-flex;gap:3px;background:var(--panel-2);border:1px solid var(--line);border-radius:11px;padding:3px;margin:2px 0 12px;flex-wrap:wrap}
    .rp-dimbtn{appearance:none;border:0;background:none;color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;padding:7px 14px;border-radius:8px;cursor:pointer;transition:.13s}
    .rp-dimbtn:hover{color:var(--ink)} .rp-dimbtn.on{background:var(--brand);color:var(--brand-ink);box-shadow:0 2px 7px var(--brand-glow)}
    .rp-dist td,.rp-dist th{font-size:13px}
    /* integrity */
    .rp-intgrid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:2px 0 4px}
    @media(max-width:900px){.rp-intgrid{grid-template-columns:1fr}}
    .rp-int{display:flex;gap:12px;align-items:center;padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(180deg,var(--panel),var(--panel-2))}
    .rp-int.flag{border-color:color-mix(in srgb,var(--red) 50%,transparent);background:color-mix(in srgb,var(--red) 7%,var(--panel))}
    .rp-int-i{width:26px;height:26px;border-radius:8px;display:grid;place-items:center;font-size:14px;font-weight:800;flex-shrink:0}
    .rp-int.ok .rp-int-i{color:var(--brand-d);background:var(--brand-glow)} .rp-int.flag .rp-int-i{color:var(--red);background:color-mix(in srgb,var(--red) 14%,transparent)}
    .rp-int-b{flex:1}
    .rp-int-t{font-weight:780;font-size:13.5px;color:var(--ink)}
    .rp-int-n{font-size:12px;color:var(--muted);margin-top:2px}
    .rp-int-v{font-size:13px;font-weight:800;color:var(--ink);text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums}
    .st-hint{display:none}
    .rp-who{font-size:14.5px;font-weight:750;color:var(--muted)}
    .rp-who b{color:var(--ink);font-weight:820}
    /* head-of-sales assessment */
    .rp-assess{border-radius:18px;border:1px solid var(--line);box-shadow:var(--shadow);padding:20px 22px;margin-bottom:16px;background:linear-gradient(180deg,var(--panel),var(--panel-2))}
    .rp-assess.top{border-color:color-mix(in srgb,var(--brand) 55%,transparent)}
    .rp-assess.warn,.rp-assess.bad{border-color:color-mix(in srgb,var(--red) 45%,transparent)}
    .rp-verdict{display:flex;align-items:center;gap:20px;margin-bottom:14px;flex-wrap:wrap}
    .rp-vscore{display:flex;align-items:baseline;gap:4px;min-width:92px}
    .rp-vnum{font-size:46px;font-weight:870;letter-spacing:-1.6px;color:var(--ink);font-variant-numeric:tabular-nums;line-height:1}
    .rp-assess.top .rp-vnum{color:var(--brand-d)} .rp-assess.warn .rp-vnum,.rp-assess.bad .rp-vnum{color:var(--red)}
    .rp-vout{font-size:14px;font-weight:750;color:var(--faint)}
    .rp-vmeta{flex:1;min-width:240px}
    .rp-vtitle{font-size:19px;font-weight:850;color:var(--ink);letter-spacing:-.3px;display:flex;align-items:center;gap:9px}
    .rp-vicon{width:27px;height:27px;border-radius:8px;display:grid;place-items:center;font-size:14px;background:var(--panel-2);border:1px solid var(--line)}
    .rp-assess.top .rp-vicon{color:var(--brand-ink);background:var(--brand);border-color:var(--brand)}
    .rp-assess.good .rp-vicon{color:var(--brand-d);background:var(--brand-glow)}
    .rp-assess.warn .rp-vicon,.rp-assess.bad .rp-vicon{color:var(--red);background:color-mix(in srgb,var(--red) 12%,transparent);border-color:color-mix(in srgb,var(--red) 40%,transparent)}
    .rp-vsum{font-size:14px;color:var(--muted);margin-top:4px;font-weight:600;line-height:1.5}
    .rp-assess-cols{display:grid;grid-template-columns:1fr 1fr 1.25fr;gap:22px;padding:15px 0 6px;border-top:1px solid var(--line)}
    @media(max-width:900px){.rp-assess-cols{grid-template-columns:1fr}}
    .rp-alist{margin:6px 0 0;padding-left:16px;display:grid;gap:6px}
    .rp-alist li{font-size:12.8px;color:var(--ink);line-height:1.5}
    .rp-alist li b{font-weight:750}
    .rp-calc{margin-top:13px;border-top:1px dashed var(--line);padding-top:9px}
    .rp-calc summary{font-size:12px;font-weight:750;color:var(--brand-d);cursor:pointer;list-style:none}
    .rp-calc summary::-webkit-details-marker{display:none}
    .rp-dist-tot td{border-top:2px solid var(--line-2)!important;font-weight:800;background:var(--panel-2)}
    .st-seg{display:inline-flex;border:1px solid var(--line-2);border-radius:10px;overflow:hidden}
    .st-seg button{appearance:none;border:0;background:var(--panel);color:var(--muted);font:inherit;font-size:12.5px;font-weight:700;padding:8px 14px;cursor:pointer}
    .st-seg button.on{background:var(--brand);color:var(--brand-ink)}
    .st-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 16px;border-top:1px solid var(--line);background:var(--panel-2);font-size:13px;color:var(--muted);flex-wrap:wrap}
    .st-pager-info b{color:var(--ink);font-variant-numeric:tabular-nums;font-weight:750}
    .st-pager-nav{display:flex;align-items:center;gap:8px}
    .st-pager-nav button{border:1px solid var(--line-2);background:var(--panel);border-radius:9px;color:var(--ink);font:inherit;font-weight:700;font-size:13px;padding:7px 15px;cursor:pointer;transition:.13s}
    .st-pager-nav button:hover:not(:disabled){border-color:var(--brand);color:var(--brand-d)}
    .st-pager-nav button:disabled{opacity:.35;cursor:default}
    .st-pager-pages{font-variant-numeric:tabular-nums;font-weight:750;color:var(--ink);min-width:96px;text-align:center}
    /* drawer — BIG (v3) */
    .st-scrim{position:fixed;inset:0;background:rgba(0,0,0,.42);z-index:70;opacity:0;pointer-events:none;transition:opacity .15s}
    .st-scrim.on{opacity:1;pointer-events:auto}
    .st-drawer{position:fixed;top:0;right:-1160px;bottom:0;width:min(1120px,97vw);background:var(--bg);border-left:1px solid var(--line);z-index:71;transition:right .18s;display:flex;flex-direction:column;box-shadow:-14px 0 40px rgba(0,0,0,.4)}
    .st-drawer.on{right:0}
    .st-dh{padding:18px 24px 14px;border-bottom:1px solid var(--line);background:var(--panel)}
    .st-dh .t{font-size:19px;font-weight:800;color:var(--ink);display:flex;gap:10px;align-items:center;flex-wrap:wrap}
    .st-dh .s{font-size:13px;color:var(--muted);margin-top:5px;line-height:1.55}
    .st-dx{position:absolute;top:14px;right:16px;border:0;background:none;color:var(--muted);font-size:22px;cursor:pointer}
    .st-db{overflow:auto;padding:18px 24px;flex:1}
    .st-cols{display:grid;grid-template-columns:1fr 1fr;gap:0 26px}
    @media(max-width:900px){.st-cols{grid-template-columns:1fr}}
    .st-sec{font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:16px 0 9px}
    .st-fin{display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:9px}
    .st-fin .c{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 12px}
    .st-fin .l{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
    .st-fin .v{font-size:16px;font-weight:780;color:var(--ink);margin-top:4px;font-variant-numeric:tabular-nums}
    .st-fin .v.small{font-size:12.5px}
    .st-est{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 15px;margin-bottom:4px;font-size:15px;color:var(--ink)}
    .st-est b{font-size:18px}
    .st-tl{position:relative;margin-left:9px;border-left:2px solid var(--line);padding:2px 0 2px 17px}
    .st-ev{position:relative;margin-bottom:12px}
    .st-ev::before{content:"";position:absolute;left:-23.5px;top:4px;width:10px;height:10px;border-radius:50%;background:var(--faint)}
    .st-ev.call_out::before{background:var(--blue)} .st-ev.call_in::before{background:var(--purple)}
    .st-ev.sms_out::before,.st-ev.sms_in::before{background:var(--amber)}
    .st-ev.confirmed::before{background:var(--brand)} .st-ev.closing::before{background:var(--brand)}
    .st-ev.refund::before{background:var(--red)} .st-ev.lead_created::before{background:var(--ink)}
    .st-ev .h{font-size:13.5px;color:var(--ink)} .st-ev .h b{font-weight:750}
    .st-ev .m{font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.5}
    .st-all{margin-top:8px}
    .st-calrow{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
    .st-xfer{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:9px 13px;margin-top:8px;font-size:12.5px;color:var(--muted)}
    .st-xfer b{color:var(--ink)}
    .st-callink{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--blue);text-decoration:none;border:1px solid var(--line-2);border-radius:9px;padding:6px 11px;background:var(--panel)}
    .st-callink:hover{border-color:var(--blue)}
    .st-all summary{font-size:12px;font-weight:700;color:var(--blue);cursor:pointer;padding:4px 0}
    .st-kv{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:5px 14px;font-size:12px}
    .st-kv div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px dashed var(--line);padding:3px 0}
    .st-kv span:first-child{color:var(--muted)} .st-kv span:last-child{color:var(--ink);font-weight:650;text-align:right;overflow:hidden;text-overflow:ellipsis}
    .st-set{position:relative}
    .st-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:60;background:var(--panel);border:1px solid var(--line);border-radius:11px;box-shadow:var(--shadow);padding:12px 14px;min-width:250px}
    .st-pop label{display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:12.5px;color:var(--muted);margin-bottom:8px}
    .st-pop input{width:64px;background:var(--bg);border:1px solid var(--line);border-radius:7px;color:var(--ink);font:inherit;padding:4px 7px}
    .st-note{font-size:12px;color:var(--faint);margin-top:8px;line-height:1.5}`;
    document.head.appendChild(st);
  }

  const EV_LABEL = { lead_created: "Lead created", call_out: "Outbound call", call_in: "Incoming call",
    sms_out: "Text sent", sms_in: "Text received", confirmed: "Confirmed", closing: "Job closed",
    refund: "Refund" };

  /* ---------------- Lead File drawer (BIG) ---------------- */
  let drawerEl = null;
  function openDrawer(jk) {
    if (!drawerEl) {
      drawerEl = document.createElement("div");
      drawerEl.innerHTML = `<div class="st-scrim"></div>
        <div class="st-drawer"><button class="st-dx">✕</button>
          <div class="st-dh"><div class="t" id="stDT">Lead</div><div class="s" id="stDS"></div></div>
          <div class="st-db" id="stDB"></div></div>`;
      document.body.appendChild(drawerEl);
      const close = () => { drawerEl.querySelector(".st-scrim").classList.remove("on"); drawerEl.querySelector(".st-drawer").classList.remove("on"); };
      drawerEl.querySelector(".st-scrim").onclick = close;
      drawerEl.querySelector(".st-dx").onclick = close;
    }
    drawerEl.querySelector(".st-scrim").classList.add("on");
    drawerEl.querySelector(".st-drawer").classList.add("on");
    drawerEl.querySelector("#stDT").textContent = "Loading…";
    drawerEl.querySelector("#stDS").textContent = "";
    drawerEl.querySelector("#stDB").innerHTML = `<div class="rs-loading" style="padding:24px">Loading the lead file…</div>`;
    fetch(ZTZ.API + "/api/_leadfile?jk=" + encodeURIComponent(jk),
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(r => r.json()).then(d => {
        if (d && d.error) throw new Error(d.error);
        if (!d || !d.journey) throw new Error("lead not found in the journey mart");
        paintDrawer(d);
      })
      .catch(e => { drawerEl.querySelector("#stDB").innerHTML = `<div class="st-card">Couldn't load this lead: ${esc(e.message)}</div>`; });
  }

  const finCard = (l, v, small) =>
    `<div class="c"><div class="l">${l}</div><div class="v${small ? " small" : ""}">${v}</div></div>`;

  function jobSection(j, d) {
    const mv = (j["Move Date"] || "").slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    let stateHtml;
    if (d.closing) stateHtml = `<span class="st-good">✓ Job done — closing filed</span>`;
    else if (mv && mv >= today) {
      const days = Math.round((Date.parse(mv) - Date.parse(today)) / 864e5);
      stateHtml = `<span style="color:var(--blue);font-weight:750">Upcoming — in ${days} day${days === 1 ? "" : "s"}</span>`;
    } else if (mv) stateHtml = `<span class="st-bad">Move date passed — no closing filed</span>`;
    else stateHtml = `<span class="st-dim">no move date</span>`;
    const cal = (d.calendar || []).map(c =>
      `<a class="st-callink" href="${esc(c.url || "#")}" target="_blank" rel="noopener">📅 ${esc((c.event_date || "").slice(0, 10))} ${esc(c.event_title || "calendar event").slice(0, 44)}</a>`).join("");
    // transfer-accuracy: did the salesperson copy Moveboard -> Calendar correctly?
    let xfer = "";
    const ce = (d.calendar || [])[0];
    if (ce) {
      const mb = d.moveboard || {};
      const dOk = mv && ce.event_date ? String(ce.event_date).slice(0, 10) === mv : null;
      const zip = String(mb["Pickup Zip"] || "").trim();
      const lOk = zip && ce.location ? String(ce.location).includes(zip) : null;
      const mark = ok => ok == null ? `<span class="st-dim">n/a</span>`
        : ok ? `<span class="st-good">✓</span>` : `<span class="st-bad">✗</span>`;
      xfer = `<div class="st-xfer">
        <b>Moveboard → Calendar transfer:</b>
        date ${mark(dOk)} <span class="st-dim">${esc(mv || "?")} vs ${esc(String(ce.event_date || "?").slice(0, 10))}</span>
        &nbsp;·&nbsp; address ${mark(lOk)} <span class="st-dim">${esc(String(mb["Moving From"] || "").slice(0, 44))} vs ${esc(String(ce.location || "—").slice(0, 44))}</span>
      </div>`;
    }
    return `<div class="st-sec">Job</div><div class="st-fin">
      ${finCard("Status", stateHtml, true)}
      ${finCard("Move date", esc(mv || "—"))}
      ${j["Booked Date"] ? finCard("Confirmed on", esc(String(j["Booked Date"]).slice(0, 10)))
                         : finCard("Confirmed", `<span class="st-dim">not yet</span>`, true)}
    </div>${cal ? `<div class="st-calrow">${cal}</div>` : `<div class="st-note" style="margin:6px 0 0">No calendar event linked.</div>`}${xfer}`;
  }

  /* Field curation (Tornike: "keep only the important / sales-connected ones — but don't
     delete anything, keep it usable"): the main grids show what matters; the expandable
     shows useful extras; the PLUMBING fields live in a nested "Technical" expandable. */
  const TECH_CLOSING = new Set(["Request Joinkey", "Unique Key", "Record Source",
    "Is Last Encounter", "Request Encounter", "Is Flat Rate", "Cancellation Reason",
    "Source1", "Source2", "Source From Moveboard", "Corrected Source", "Bill Range",
    "Commission Bucket Range", "State Name", "Total Bill by Cash Rate", "Forman Raw",
    "Forman Job Order", "Total Jobs Done by Forman", "Move Type", "Company", "File Name",
    "File Path", "Update Date", "Pickup Zip"]);
  const TECH_MB = new Set(["Request Joinkey", "Closing Sheet Connector", "Label",
    "Create Datetime NY", "Source Before Adjustment", "Source Connector", "Source M",
    "State Name", "CF/Lbs", "Bill Range", "CF Range", "Sales Commission Bucket Range",
    "Big Job Status", "Closing Total", "Payment total", "Company", "File Name",
    "File Path", "Update Date"]);
  function fieldsDump(obj, techSet, label) {
    const keys = Object.keys(obj).filter(k =>
      obj[k] != null && String(obj[k]).trim() !== "" && !k.startsWith("__"));
    const useful = keys.filter(k => !techSet.has(k)).sort();
    const tech = keys.filter(k => techSet.has(k)).sort();
    const kv = list => `<div class="st-kv" style="margin-top:8px">` +
      list.map(k => `<div><span>${esc(k)}</span><span>${esc(String(obj[k]).slice(0, 60))}</span></div>`).join("") + `</div>`;
    return `<details class="st-all"><summary>${label} (${useful.length})</summary>${kv(useful)}
      ${tech.length ? `<details class="st-all" style="margin-left:6px"><summary>Technical fields (${tech.length})</summary>${kv(tech)}</details>` : ""}
    </details>`;
  }

  function moveboardSection(mb, j) {
    const src = mb || j;
    const main = `<div class="st-fin">
      ${finCard("Status", esc(src["Status"] || "—"), true)}
      ${finCard("Category", esc(src["Status Category"] || "—"), true)}
      ${finCard("Flag", esc(src["Flag"] || j["Flag"] || "—"), true)}
      ${finCard("Service type", esc(src["Service Type"] || "—"), true)}
      ${finCard("Size of move", esc(src["Size of Move"] || "—"), true)}
      ${finCard("Total CF", src["Total CF"] != null ? RS.fmtN(Math.round(+src["Total CF"])) : "—")}
      ${finCard("Min quote", money0(num(src["Min Quote"])))}
      ${finCard("Avg quote", money0(num(src["Average Quote"] != null ? src["Average Quote"] : j["Avg Quote"])))}
      ${finCard("Max quote", money0(num(src["Max Quote"])))}
      ${mb ? finCard("Moving from", esc(String(mb["Moving From"] || "—").slice(0, 60)), true) : ""}
      ${mb ? finCard("Moving to", esc(String(mb["Moving To"] || "—").slice(0, 60)), true) : ""}
      ${mb ? finCard("Phone", esc(mb["Phone"] || "—"), true) : ""}
      ${mb ? finCard("Email", esc(String(mb["Email"] || "—").slice(0, 40)), true) : ""}
    </div>`;
    if (!mb) return `<div class="st-sec">Moveboard</div>` + main;
    return `<div class="st-sec">Moveboard</div>` + main +
      fieldsDump(mb, TECH_MB, "More Moveboard fields");
  }

  function closingSection(cl) {
    if (!cl) return `<div class="st-sec">Closing sheet</div>
      <div class="st-note" style="margin:0 0 6px">No closing sheet filed for this lead yet.</div>`;
    const g = k => cl[k];
    const m = k => money0(num(cl[k]));
    const helpers = [];
    for (let i = 1; i <= 7; i++) {
      if (g("H " + i)) helpers.push(esc(g("H " + i)));
    }
    const main = `<div class="st-fin">
      ${finCard("Move date", esc((g("Date") || "—").slice(0, 10)))}
      ${finCard("Foreman", esc(g("Foreman") || g("Forman") || "—"), true)}
      ${finCard("Job status", esc(g("Job Status") || "—"), true)}
      ${finCard("Total bill", "<b>" + m("Total Bill") + "</b>")}
      ${finCard("Net cash", m("Net Cash"))}
      ${finCard("Deposit", m("Deposit"))}
      ${finCard("Card payment", m("Card Payment"))}
      ${finCard("Balance due", m("Balance Due"))}
      ${finCard("Materials", m("Material Total"))}
      ${finCard("Storage", esc(g("Storage") || "—"), true)}
      ${finCard("Foreman total $", m("Forman Total $"))}
      ${finCard("Total expense", m("Total Expense"))}
      ${finCard("Profit per job", m("Profit per Job"))}
      ${finCard("Sales commission", money0((num(cl["Sales 1 Salary"]) || 0) + (num(cl["Sales 2 Salary"]) || 0) + (num(cl["Sales 3 Salary"]) || 0) || null))}
      ${finCard("Bill increase", (cl.__gapPct != null ? ((+cl.__gapPct > 0 ? "+" : "") + pct1(+cl.__gapPct)) : "—"))}
      ${finCard("Sales person", esc(g("Sales Person") || "—"), true)}
      ${finCard("Crew size", esc(g("Crew Size") || "—"))}
      ${finCard("Driver", esc(g("Driver") || "—"), true)}
      ${helpers.length ? finCard("Helpers", helpers.join(", "), true) : ""}
    </div>`;
    return `<div class="st-sec">Closing sheet</div>` + main +
      fieldsDump(cl, TECH_CLOSING, "More closing-sheet fields");
  }

  function paintDrawer(d) {
    const j = d.journey || {}, ev = d.events || [];
    const flags = [];
    if (+j["Flag Never Called"]) flags.push(`<span class="st-flag r">NO CONTACT</span>`);
    else if (isConf(j) && !isContacted(j)) flags.push(`<span class="st-flag a" title="Confirmed, so sales did talk to them — the call just isn't in RingCentral (${+j["Conf After Horizon"] ? "confirmed after the export cutoff" : "off-system or after the cutoff"})">CALL NOT IN RC</span>`);
    if (!inWindow(j)) flags.push(`<span class="st-flag a">CREATED AFTER NEWEST CALL DATA</span>`);
    if (+j["Flag Slow First Call"]) flags.push(`<span class="st-flag a">SLOW FIRST CALL</span>`);
    if (+j["Flag Big Quote Gap"]) flags.push(`<span class="st-flag p">QUOTE GAP</span>`);
    if (+j["Flag Confirmed No Closing"]) flags.push(`<span class="st-flag r">NO CLOSING</span>`);
    if (+j["Is LD"]) flags.push(`<span class="st-flag b">LONG DISTANCE</span>`);
    drawerEl.querySelector("#stDT").innerHTML =
      `${esc(j["Customer"] || "Lead")} <span style="color:var(--faint);font-weight:600;font-size:14px">#${esc(j["Job No"] || "")}</span> ${flags.join("")}`;
    drawerEl.querySelector("#stDS").innerHTML =
      `${esc(j["Company"] || "")} · ${esc(j["Source"] || "no source")} · assigned to <b>${esc(j["Assigned"] || "—")}</b>` +
      ` · created ${esc((j["Create Datetime"] || "").slice(0, 16))} · status <b>${esc(j["Status"] || "—")}</b>` +
      (j["Flag"] ? ` · flag: <b>${esc(j["Flag"])}</b>` : "") + (j["Label"] ? ` · label: <b>${esc(j["Label"])}</b>` : "");

    const est = `<div class="st-sec">Estimate → actual</div>
      <div class="st-est">${estActual(j)}
        <span style="color:var(--faint);font-size:12px;margin-left:8px">${
          num(j["Min Quote"]) != null && num(j["Max Quote"]) != null && num(j["Min Quote"]) !== num(j["Max Quote"])
            ? `quote range ${money0(num(j["Min Quote"]))} – ${money0(num(j["Max Quote"]))} · ` : "flat quote · "
        }${j["Total CF"] != null ? RS.fmtN(Math.round(+j["Total CF"])) + " CF" : "no CF"}</span></div>`;

    // only render the cards that actually have something — an unclosed lead used to show six
    // empty "—" tiles.
    const finCards = [
      num(j["Net Cash"]) != null ? finCard("Net cash", money0(num(j["Net Cash"]))) : "",
      num(j["Material Total"]) ? finCard("Materials (upsell)", money0(num(j["Material Total"]))) : "",
      j["Refund Total"] != null ? finCard("Refunded", money0(+j["Refund Total"])) : "",
      (j["Sales People"] || j["Sales Person"]) ? finCard("Sales people", esc(j["Sales People"] || j["Sales Person"]), true) : "",
      j["Review Score"] != null ? finCard("Review", (+j["Review Score"]).toFixed(1) + "★") : "",
      +j["Claims N"] ? finCard("Claims", j["Claims N"]) : "",
    ].filter(Boolean).join("");
    const fin = `<div class="st-sec">Money summary</div>` + (finCards
      ? `<div class="st-fin">${finCards}</div>`
      : `<div class="st-note">Nothing billed yet — this lead has no closing sheet, refund, review or claim.</div>`);

    const resp = `<div class="st-sec">Response</div><div class="st-fin">
      ${finCard("First contact", (+j["Called"] ? (j["TTO Biz Min"] != null ? mins(+j["TTO Biz Min"]) + " (biz)" : "called")
                   : (isContacted(j) ? "answered incoming"
                      : (isConf(j) ? "<span class='st-good'>confirmed ✓</span> <span class='st-dim'>" + (+j["Conf After Horizon"] ? "call after data cutoff" : "call not in RC") + "</span>"
                         : (!inWindow(j) ? "<span class='st-dim'>no call data yet</span>" : "<span class='st-bad'>none</span>")))))}
      ${finCard("Calls out / in", (+j["Out Calls"] || 0) + " / " + (+j["In Calls"] || 0))}
      ${finCard("Answered incoming", (+j["Answered In"] || 0))}
      ${((+j["Sms Out"] || 0) + (+j["Sms In"] || 0)) ? finCard("Texts out / in", (+j["Sms Out"] || 0) + " / " + (+j["Sms In"] || 0)) : ""}
      ${+j["Talk Sec Out"] ? finCard("Talk time (out)", secH(j["Talk Sec Out"])) : ""}
      ${stripExt(j["Dialers"]) ? finCard("Dialers", esc(stripExt(j["Dialers"])), true) : ""}
      ${j["Last Touch At"] ? finCard("Last touch", esc(String(j["Last Touch At"]).slice(0, 16)), true) : ""}
    </div>`;

    const aftermath = (d.refunds || []).length || (d.claims || []).length || (d.reviews || []).length
      ? `<div class="st-sec">Aftermath</div>
        ${(d.refunds || []).map(r => `<div class="st-ev refund" style="margin-left:9px"><div class="h"><b>Refund</b> ${money0(num(r["Total refund"]))} · ${esc((r["Refund Date"] || "").slice(0, 10))}</div><div class="m">${esc(r["Reason"] || "")}</div></div>`).join("")}
        ${(d.claims || []).map(c => `<div class="st-ev refund" style="margin-left:9px"><div class="h"><b>Claim</b> · ${esc((c["Date"] || c["Claim Date"] || "").toString().slice(0, 10))}</div><div class="m">${esc(c["Reason"] || c["Responsibility"] || "")}</div></div>`).join("")}
        ${(d.reviews || []).map(r => `<div class="st-ev confirmed" style="margin-left:9px"><div class="h"><b>Review</b> ${r["Review Score"] != null ? esc(String(r["Review Score"])) + "★" : ""} · ${esc(r["Source"] || "")}</div></div>`).join("")}`
      : "";

    const tl = `<div class="st-sec">Timeline · ${ev.length} events</div><div class="st-tl">` +
      ev.map(e => {
        const t = (e["Event At"] || "").slice(0, 16);
        const kind = e["Event Type"];
        const dur = e["Duration Sec"] != null ? ` · ${secH(e["Duration Sec"])}` : "";
        const amt = e["Amount"] != null ? ` · ${money0(+e["Amount"])}` : "";
        return `<div class="st-ev ${esc(kind)}">
          <div class="h"><b>${esc(EV_LABEL[kind] || kind)}</b>${e["Actor"] ? " — " + esc(kind.indexOf("call") === 0 || kind.indexOf("sms") === 0 ? stripExt(e["Actor"]) : e["Actor"]) : ""}<span style="color:var(--faint)"> · ${esc(t)}${dur}${amt}</span></div>
          ${e["Detail"] ? `<div class="m">${esc(e["Detail"])}</div>` : ""}</div>`;
      }).join("") + `</div>`;

    if (d.closing) d.closing.__gapPct = j["Bill Vs Quote Pct"];
    drawerEl.querySelector("#stDB").innerHTML =
      `<div class="st-cols"><div>` + est + jobSection(j, d) + fin + resp
      + moveboardSection(d.moveboard, j) + closingSection(d.closing) + aftermath +
      `</div><div>` + tl + `</div></div>`;
  }

  /* ---------------- per-person aggregation ---------------- */
  function personStats(rows, confRows, th, omit) {
    const by = {};
    const add = (name, fn) => {
      const k = (name || "Unassigned").trim() || "Unassigned";
      if (excluded(k)) return;
      if (omit && omit.has(k.toLowerCase())) return;   // Not-Active reps (from the roster)
      (by[k] = by[k] || { name: k, leads: 0, qual: 0, dead: 0, conf: 0, confEv: 0,
        contacted: 0, covered: 0, tto: [], out: 0, talk: 0, rev: 0, closed: 0, gaps: [] }).x = 1;
      fn(by[k]);
    };
    rows.forEach(r => add(r["Assigned"], p => {
      p.leads++;
      if (isQual(r)) p.qual++;
      if (isDead(r)) p.dead++;
      if (isConf(r)) p.conf++;
      if (inWindow(r)) {
        p.covered++;
        if (isReached(r)) p.contacted++;   // RC evidence OR confirmed (confirmation = contact)
      }
      if (r["TTO Biz Min"] != null) p.tto.push(+r["TTO Biz Min"]);
      p.out += +r["Out Calls"] || 0;
      p.talk += +r["Talk Sec Out"] || 0;
      if (r["Total Bill"] != null) { p.rev += +r["Total Bill"]; p.closed++; }
      if (r["Bill Vs Quote Pct"] != null) p.gaps.push(+r["Bill Vs Quote Pct"]);
    }));
    confRows.forEach(r => add(r["Assigned"], p => { if (isConf(r)) p.confEv++; }));
    const list = Object.values(by);
    list.forEach(p => {
      p.deadPct = p.leads ? 100 * p.dead / p.leads : null;
      // CANONICAL booking rate, the rs-core.bookingRate SWITCH verbatim: confirmations counted
      // on their CONFIRMED date (confEv), qualified on the lead's CREATE date. This column used
      // the create-date cohort, so it disagreed with the "Booking rate" KPI card above it while
      // both carried the same "canonical" caption -- reps looked worse the more their bookings
      // lagged lead creation.
      p.convPct = p.confEv > p.qual ? 100
        : (!p.qual && !p.confEv) ? null
        : !p.confEv ? 0
        : 100 * p.confEv / p.qual;
      p.cohortPct = p.qual ? 100 * p.conf / p.qual : null;   // of THIS period's leads, % confirmed so far
      p.noContactPct = p.covered ? 100 * (p.covered - p.contacted) / p.covered : null;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
      p.avgGap = p.gaps.length ? p.gaps.reduce((a, b) => a + b, 0) / p.gaps.length : null;
    });
    // normalise against the reps the table actually SHOWS — a hidden 5-lead outlier used to
    // set the 100% ceiling and quietly deflate every visible score.
    const scoreMin = Math.max(th.minLeads, ASSESS_MIN);
    const ranked = list.filter(p => p.leads >= scoreMin && p.name !== "Unassigned");
    const mx = {
      conv: Math.max(1e-9, ...ranked.map(p => p.convPct || 0)),
      rev: Math.max(1e-9, ...ranked.map(p => p.revLead || 0)),
    };
    list.forEach(p => {
      if (p.leads < scoreMin || p.name === "Unassigned") { p.score = null; return; }
      // weight only the components that HAVE data (a missing first-call median means
      // "no call data in range", not "slowest on the team").
      let sc = 0, ws = 0;
      const add = (w, v) => { if (v != null) { sc += w * v; ws += w; } };
      add(0.5, (mx.conv && p.convPct != null) ? p.convPct / mx.conv : null);
      add(0.3, p.medTto == null ? null : Math.max(0, 1 - Math.min(p.medTto, 120) / 120));
      add(0.2, mx.rev ? (p.revLead || 0) / mx.rev : null);
      p.score = ws ? Math.round(100 * sc / ws) : null;
    });
    list.sort((a, b) => ((b.score != null ? b.score : -1) - (a.score != null ? a.score : -1)) || b.leads - a.leads);
    return list;
  }

  /* ---------------- Team tab ---------------- */
  async function renderTeam(host, ctx) {
    const th = thGet();
    const rows = ctx.rows, confRows = ctx.confRows;
    const nQual = rows.filter(isQual).length;
    const nDead = rows.filter(isDead).length;
    const brate = RS.bookingRate(rows, confRows);
    // LOW CONV judges each rep's canonical Booking % -- so the team baseline must be the
    // canonical team rate too, not the create-date cohort (mixed bases fired false flags).
    const teamAvgConv = brate != null ? 100 * brate : 0;
    const kpi = (l, v, s) => `<div class="st-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const medAll = median(rows.map(r => r["TTO Biz Min"]).filter(v => v != null).map(Number));
    const covered = rows.filter(inWindow);
    const noContact = covered.length ? 100 * covered.filter(r => !isReached(r)).length / covered.length : null;
    const rev = rows.reduce((a, r) => a + (+r["Total Bill"] || 0), 0);
    const dense = ctx.dense || "detail";

    // real active reps only: drop the Unassigned bucket + low-volume stragglers, matching
    // the Rep Profile list (inactive already removed inside personStats).
    const people = personStats(rows, confRows, th, ctx.inactiveNames)
      .filter(p => p.name !== "Unassigned" && p.leads >= ASSESS_MIN);
    const flagCell = p => {
      const f = [];
      if (p.noContactPct != null && p.noContactPct > th.neverPct) f.push(`<span class="st-flag r">${Math.round(p.noContactPct)}% NO CONTACT</span>`);
      if (p.medTto != null && p.medTto > th.slowMin) f.push(`<span class="st-flag a">SLOW ${mins(p.medTto)}</span>`);
      if (p.convPct != null && teamAvgConv && p.convPct < th.convFrac * teamAvgConv) f.push(`<span class="st-flag p">LOW CONV</span>`);
      return f.join("") || `<span class="st-good">✓</span>`;
    };

    const DETAIL_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th><th>Dead %</th>
      <th title="Of the leads created in this period, how many have confirmed so far">Confirmed (cohort)</th>
      <th title="Confirmations that happened in this period, whenever the lead came in - the Booking % numerator">Confirms in period</th>
      <th title="Confirms in period ÷ Qualified - the portal's canonical formula">Booking %</th><th>Median 1st call</th>
      <th>No contact</th><th>Calls</th><th>Talk</th><th>Revenue</th><th>$ / lead</th><th>Δ est→act</th><th>Flags</th>`;
    const COMPACT_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th>
      <th>Confirms in period</th><th>Booking %</th><th>No contact</th><th>Revenue</th><th>Flags</th>`;
    const drow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td>
      <td>${p.deadPct != null ? pct1(p.deadPct) : "—"}</td>
      <td>${RS.fmtN(p.conf)}</td>
      <td>${RS.fmtN(p.confEv)}</td>
      <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
      <td>${p.medTto != null ? mins(p.medTto) : "—"}</td>
      <td class="${p.noContactPct > th.neverPct ? "st-bad" : ""}">${p.noContactPct != null ? pct1(p.noContactPct) : "—"}</td>
      <td>${RS.fmtN(p.out)}</td><td>${secH(p.talk)}</td>
      <td>${money0(p.rev)}</td><td>${money0(p.revLead)}</td>
      <td>${p.avgGap != null ? (p.avgGap > 0 ? "+" : "") + pct1(p.avgGap) : "—"}</td>
      <td>${flagCell(p)}</td></tr>`;
    const crow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td><td>${RS.fmtN(p.confEv)}</td>
      <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
      <td class="${p.noContactPct > th.neverPct ? "st-bad" : ""}">${p.noContactPct != null ? pct1(p.noContactPct) : "—"}</td>
      <td>${money0(p.rev)}</td><td>${flagCell(p)}</td></tr>`;

    host.innerHTML = `
      <div class="st-kpis">
        ${kpi("Leads received", RS.fmtN(rows.length), "created in the selected period")}
        ${kpi("Qualified", RS.fmtN(nQual), pct1(rows.length ? 100 * nQual / rows.length : null) + " of received")}
        ${kpi("Dead leads", RS.fmtN(nDead), pct1(rows.length ? 100 * nDead / rows.length : null) + " of received")}
        ${kpi("Confirmed (in period)", RS.fmtN(confRows.length), "by their confirmed date")}
        ${kpi("Booking rate", brate != null ? pct1(100 * brate) : "—", "confirmed ÷ qualified (canonical)")}
        ${kpi("Median first call", medAll != null ? mins(medAll) : "—", "business minutes")}
        ${kpi("Never worked", pct1(noContact), "no contact & not confirmed, within call-data coverage")}
        ${kpi("Revenue (closed)", money0(rev), "billed on these leads")}
      </div>
      <div class="st-card">
        <div class="st-bar" style="margin-bottom:10px">
          <b style="color:var(--ink);font-size:15px">People · ${people.length}</b>
          <div class="st-seg"><button data-d="detail" class="${dense === "detail" ? "on" : ""}">Details</button><button data-d="compact" class="${dense === "compact" ? "on" : ""}">Compact</button></div>
          <span style="flex:1"></span>
          <div class="st-set"><button class="st-chip" id="stTh">⚙ Thresholds</button>
            <div class="st-pop hidden" id="stThPop">
              <label>Slow first call, min <input type="number" id="thSlow" value="${th.slowMin}"></label>
              <label>No-contact alert, % <input type="number" id="thNever" value="${th.neverPct}"></label>
              <label>Low conversion, × team avg <input type="number" step="0.1" id="thConv" value="${th.convFrac}"></label>
              <label>Min leads to rank <input type="number" id="thMin" value="${th.minLeads}"></label>
              <div class="st-note">Saved on this device. Score = 50% booking · 30% speed · 20% revenue per lead.</div>
            </div></div>
        </div>
        <div style="overflow-x:auto"><table class="st-tbl"><thead><tr>${dense === "compact" ? COMPACT_COLS : DETAIL_COLS}</tr></thead>
        <tbody>${people.map(dense === "compact" ? crow : drow).join("")}</tbody></table></div>
        <div class="st-note">Click a person to open their Rep Profile (and pin the Sales Person filter to them). Booking % = <b>Confirms in period ÷ Qualified</b> — the portal's canonical formula, the same one behind the Booking rate card above (confirmations count on their confirmed date, qualified leads on their created date). "Confirmed (cohort)" is the different question: how many of <i>this period's</i> leads have confirmed so far — always lower for recent months, because bookings lag creation. Every other column follows the lead's created date. Branch owner excluded. Call data currently ends at the newest RingCentral export.</div>
      </div>`;

    host.querySelectorAll(".st-seg button").forEach(b => b.onclick = () => { ctx.dense = b.dataset.d; renderTeam(host, ctx); });
    const pop = host.querySelector("#stThPop");
    host.querySelector("#stTh").onclick = e => {
      e.stopPropagation();
      pop.classList.toggle("hidden");
      // arm the outside-click closer when the panel OPENS (a {once:true} listener registered
      // at render time was consumed by an unrelated click and left the popup stuck open).
      if (!pop.classList.contains("hidden")) {
        setTimeout(() => document.addEventListener("click", function close() {
          pop.classList.add("hidden"); document.removeEventListener("click", close);
        }, { once: true }), 0);
      }
    };
    pop.onclick = e => e.stopPropagation();
    ["thSlow", "thNever", "thConv", "thMin"].forEach(id => {
      host.querySelector("#" + id).onchange = () => {
        thSet({ slowMin: +host.querySelector("#thSlow").value || 30,
                neverPct: +host.querySelector("#thNever").value || 10,
                convFrac: +host.querySelector("#thConv").value || 0.5,
                minLeads: +host.querySelector("#thMin").value || 5 });
        renderTeam(host, ctx);
      };
    });
    // clicking a person opens THEIR profile, and pins the top Sales Person filter to them
    host.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => {
      jumpToRepLeads(ctx, tr.dataset.sp, "rep");
    });
  }

  /* ---------------- Lead Explorer tab ---------------- */
  function renderExplorer(host, ctx) {
    const state = { q: "", sp: (ctx.explorerPreset && ctx.explorerPreset.sp) || "", chip: "",
      sort: "new", page: 0, src: "", stat: "", called: "", type: "", bucket: "" };
    ctx.explorerPreset = null;
    const PAGE = 100;
    const uniq = col => {
      const cnt = {};
      ctx.rows.forEach(r => { const v = (r[col] || "").toString().trim(); if (v) cnt[v] = (cnt[v] || 0) + 1; });
      return Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a]);
    };
    const sps = [...new Set(ctx.rows.map(r => (r["Assigned"] || "").trim()).filter(Boolean))].sort();
    const sources = uniq("Source").slice(0, 40);
    const stats = uniq("Status Category");
    const buckets = ["<= 5 min", "5-15 min", "15-30 min", "30-60 min", "> 1 hour", "Not called"];

    const CHIPS = [
      ["important", "★ Important"], ["nocontact", "No contact"], ["slow", "Slow first call"],
      ["gap", "Quote gap"], ["noclose", "Confirmed, no closing"], ["dead", "Dead leads"],
      ["calbad", "Calendar mismatch"],
    ];
    const sel = (id, label, opts, cur) =>
      `<select id="${id}"><option value="">${label}</option>` +
      opts.map(o => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("") + `</select>`;
    host.innerHTML = `
      <div class="st-toolbar">
        <div class="st-search"><input type="text" id="stQ" placeholder="Search customer, job #, or source…"></div>
        <select id="stCalled"><option value="">Contact — any</option>
          <option value="y">Contacted</option><option value="n">No contact</option>
          <option value="c">Connected out</option></select>
        <select id="stType"><option value="">LD + local</option>
          <option value="ld">Long distance</option><option value="loc">Local</option></select>
        ${sel("stBucket", "Any speed", buckets, "")}
        <select id="stSort">
          <option value="new">Newest first</option><option value="move">Move date (soonest)</option><option value="slow">Slowest first call</option>
          <option value="bill">Biggest bill</option><option value="gap">Biggest quote gap</option>
          <option value="cf">Biggest CF</option><option value="calls">Most calls</option>
          <option value="talk">Most talk time</option>
        </select>
      </div>
      <div class="st-chips">
        ${CHIPS.map(([k, l]) => `<button class="st-chip" data-c="${k}">${l}</button>`).join("")}
      </div>
      <div class="st-grid">
        <div class="st-gridscroll" id="stTblWrap"></div>
        <div class="st-pager" id="stPg"></div>
      </div>`;

    const apply = () => {
      let rows = ctx.rows;
      if (state.sp) rows = rows.filter(r => (r["Assigned"] || "").trim() === state.sp);
      if (state.src) rows = rows.filter(r => (r["Source"] || "").trim() === state.src);
      if (state.stat) rows = rows.filter(r => (r["Status Category"] || "").trim() === state.stat);
      if (state.called === "y") rows = rows.filter(isReached);
      if (state.called === "n") rows = rows.filter(isNeverContacted);
      if (state.called === "c") rows = rows.filter(r => +r["Connected"]);
      if (state.type === "ld") rows = rows.filter(r => +r["Is LD"]);
      if (state.type === "loc") rows = rows.filter(r => !+r["Is LD"]);
      if (state.bucket) rows = rows.filter(r => (r["Speed Bucket"] || "") === state.bucket);
      if (state.q) {
        const q = state.q.toLowerCase();
        rows = rows.filter(r => String(r["Customer"] || "").toLowerCase().includes(q)
          || String(r["Job No"] || "").toLowerCase().includes(q)
          || String(r["Source"] || "").toLowerCase().includes(q));
      }
      if (state.chip === "important") rows = rows.filter(r => +r["Is LD"] || (num(r["Total CF"]) || 0) >= 700 || (num(r["Avg Quote"]) || 0) >= 4000);
      if (state.chip === "nocontact") rows = rows.filter(isNeverContacted);
      if (state.chip === "slow") rows = rows.filter(r => +r["Flag Slow First Call"]);
      if (state.chip === "gap") rows = rows.filter(r => +r["Flag Big Quote Gap"]);
      if (state.chip === "noclose") rows = rows.filter(r => +r["Flag Confirmed No Closing"]);
      if (state.chip === "dead") rows = rows.filter(isDead);
      if (state.chip === "calbad") rows = rows.filter(calMismatch);
      const key = { new: r => r["Create Date"] || "", move: r => String(r["Move Date"] || ""),
        slow: r => (r["TTO Biz Min"] != null ? +r["TTO Biz Min"] : -1),
        bill: r => +(r["Total Bill"] || 0), gap: r => Math.abs(+(r["Bill Vs Quote Pct"] || 0)),
        cf: r => +(r["Total CF"] || 0),
        calls: r => (+r["Out Calls"] || 0) + (+r["In Calls"] || 0),
        talk: r => +(r["Talk Sec Out"] || 0) }[state.sort];
      rows = rows.slice().sort((a, b) => (key(b) > key(a) ? 1 : key(b) < key(a) ? -1 : 0));
      return rows;
    };

    const paint = () => {
      const rows = apply();
      const start = state.page * PAGE;
      const pg = rows.slice(start, start + PAGE);
      const flagIcons = r => {
        const f = [];
        if (isNeverContacted(r)) f.push(`<span class="st-flag r">✕ contact</span>`);
        else if (+r["Flag Slow First Call"]) f.push(`<span class="st-flag a">slow</span>`);
        if (+r["Flag Big Quote Gap"]) f.push(`<span class="st-flag p">gap</span>`);
        if (+r["Flag Confirmed No Closing"]) f.push(`<span class="st-flag r">no closing</span>`);
        // calendar vs Moveboard disagreement -- name WHICH field differs, not a generic "mismatch"
        if (+r["Cal Found"] && r["Cal Date Match"] != null && !+r["Cal Date Match"])
          f.push(`<span class="st-flag r" title="Moveboard move date ${esc(String(r["Move Date"] || "—").slice(0, 10))} vs calendar event ${esc(String(r["Cal Event Date"] || "—").slice(0, 10))}">cal date ≠</span>`);
        if (+r["Cal Found"] && r["Cal Loc Match"] != null && !+r["Cal Loc Match"])
          f.push(`<span class="st-flag a" title="The calendar event's location does not contain this job's pickup zip">cal place ≠</span>`);
        if (+r["Is LD"]) f.push(`<span class="st-flag b">LD</span>`);
        if (r["Flag"]) f.push(`<span class="st-flag b">${esc(r["Flag"])}</span>`);
        return f.join("");
      };
      host.querySelector("#stTblWrap").innerHTML = `<table class="st-tbl"><thead><tr>
        <th>Created</th><th title="The move date from Moveboard. When a Google Calendar event exists for the job, the button opens it; if the calendar says a different date, that date is shown underneath in amber.">Move date</th>
        <th>#</th><th>Customer</th><th>Source</th><th>Assigned</th><th>CF</th>
        <th>Status</th><th>Contact</th><th>Calls</th><th>Texts</th>
        <th>Estimate → actual</th><th>Flags</th></tr></thead><tbody>` +
        pg.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"])}">
          <td>${esc((r["Create Date"] || "").slice(0, 10))}</td>
          <td>${moveCell(r)}</td>
          <td>${esc(r["Job No"] || "—")}</td>
          <td>${String(r["Customer"] || "").trim() === "Draft User"
            ? `<b class="st-draftnm" title="Moveboard draft placeholder — a real lead with a real phone whose name was never filled in. Kept because excluding it would understate lead counts and booking rates.">(name not filled)</b>`
            : `<b>${esc(r["Customer"] || "—")}</b>`}</td>
          <td>${esc(r["Source"] || "—")}</td>
          <td>${esc(r["Assigned"] || "—")}</td>
          <td>${r["Total CF"] != null ? RS.fmtN(Math.round(+r["Total CF"])) : "—"}</td>
          <td>${esc(r["Status Category"] || r["Status"] || "—")}</td>
          <td>${contactCell(r)}</td>
          <td>${(+r["Out Calls"] || 0) + (+r["In Calls"] || 0)}</td>
          <td>${(+r["Sms Out"] || 0) + (+r["Sms In"] || 0)}</td>
          <td>${estActual(r)}</td>
          <td>${flagIcons(r)}</td></tr>`).join("") +
        `</tbody></table>`;
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      const from = rows.length ? start + 1 : 0, to = Math.min(start + PAGE, rows.length);
      host.querySelector("#stPg").innerHTML =
        `<div class="st-pager-info">Showing <b>${RS.fmtN(from)}–${RS.fmtN(to)}</b> of <b>${RS.fmtN(rows.length)}</b> leads</div>
         <div class="st-pager-nav">
           <button id="stPrev" ${state.page ? "" : "disabled"}>‹ Prev</button>
           <span class="st-pager-pages">Page ${state.page + 1} of ${pages}</span>
           <button id="stNext" ${state.page + 1 < pages ? "" : "disabled"}>Next ›</button>
         </div>`;
      host.querySelector("#stPrev").onclick = () => { state.page--; paint(); host.querySelector("#stTblWrap").scrollTop = 0; };
      host.querySelector("#stNext").onclick = () => { state.page++; paint(); host.querySelector("#stTblWrap").scrollTop = 0; };
      host.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => openDrawer(tr.dataset.jk));
    };

    host.querySelector("#stQ").oninput = e => { state.q = e.target.value; state.page = 0; paint(); };
    // worklist chips (toggle): rendered + filtered in apply(), but the click binding was lost
    // in the toolbar redesign, leaving all seven dead.
    host.querySelectorAll(".st-chips .st-chip").forEach(b => b.onclick = () => {
      state.chip = state.chip === b.dataset.c ? "" : b.dataset.c;
      state.page = 0;
      host.querySelectorAll(".st-chips .st-chip").forEach(x => x.classList.toggle("on", x.dataset.c === state.chip));
      paint();
    });
    [["stCalled", "called"], ["stType", "type"], ["stBucket", "bucket"], ["stSort", "sort"]]
      .forEach(([id, k]) => {
        const el = host.querySelector("#" + id);
        if (el) el.onchange = e => { state[k] = e.target.value; state.page = 0; paint(); };
      });
    paint();
  }

  /* ================= Rep Profile ================= *
   * A statistical deep-dive on ONE selected salesperson. Two lenses merged by a
   * CANONICAL identity (the mart folds cross-system name typos like Moveboard
   * 'Mike Greeup' -> RC 'Mike Greenup'):
   *   Lead lens (respects the global filter bar) — funnel, speed, financials, quality.
   *   Phone lens (all-time RingCentral) — outbound dials/connects & INBOUND received:
   *     when a customer called and reached this rep, what happened (accepted/missed/vm).
   * Plus a ranked "Strong sides" read comparing the rep against the whole team. */

  function repCanonMap(repStats) {
    const m = {};
    (repStats || []).forEach(r => {
      const c = (r["Sales Person"] || "").trim();
      if (!c) return;
      m[c.toLowerCase()] = c;
      (r["Aliases"] || "").split(",").forEach(a => { a = a.trim(); if (a) m[a.toLowerCase()] = c; });
    });
    return m;
  }

  function repBook(ctx) {
    const cmap = ctx.repCanon || {};
    const srcRows = ctx.repRows || ctx.rows;   // sales-slicer-free: peers must stay comparable
    const canonOf = n => cmap[(n || "").trim().toLowerCase()] || (n || "").trim() || "Unassigned";
    const by = {};
    const get = name => (by[name] = by[name] || { name, rows: [], leads: 0, qual: 0, dead: 0, conf: 0,
      closed: 0, rev: 0, net: 0, mat: 0, tto: [], slow: 0, called: 0, reached: 0, covered: 0,
      out: 0, talk: 0, gapBill: 0, gapQuote: 0, gapN: 0,
      gaps: [], rev5: [], claims: 0, bySrc: {}, byMonth: {},
      profit: 0, expense: 0, commission: 0, sat5: [], refunds: 0, connLeads: 0,
      confNoClose: 0, deadUnworked: 0, confEv: 0 });
    srcRows.forEach(r => {
      const c = canonOf(r["Assigned"]);
      if (excluded(c)) return;
      const p = get(c);
      p.rows.push(r);
      p.leads++;
      if (isQual(r)) p.qual++;
      if (isDead(r)) p.dead++;
      if (isConf(r)) p.conf++;
      if (r["Total Bill"] != null) { p.rev += +r["Total Bill"]; p.closed++; }
      if (r["Net Cash"] != null) p.net += +r["Net Cash"];
      if (r["Material Total"] != null) p.mat += +r["Material Total"];
      if (r["Profit"] != null) p.profit += +r["Profit"];
      if (r["Total Expense"] != null) p.expense += +r["Total Expense"];
      if (r["Sales Commission"] != null) p.commission += +r["Sales Commission"];
      if (r["Satisfaction"] != null) p.sat5.push(+r["Satisfaction"]);
      if (r["Refund Total"] != null) p.refunds += +r["Refund Total"];
      if (r["TTO Biz Min"] != null) p.tto.push(+r["TTO Biz Min"]);
      if (+r["Called"]) p.called++;
      if (+r["Connected"]) p.connLeads++;
      p.out += +r["Out Calls"] || 0;
      p.talk += +r["Talk Sec Out"] || 0;
      if (inWindow(r)) { p.covered++; if (isReached(r)) p.reached++; }
      if (+r["Flag Slow First Call"]) p.slow++;
      if (isConf(r) && +r["Flag Confirmed No Closing"]) p.confNoClose++;
      if (isDead(r) && !isReached(r) && inWindow(r)) p.deadUnworked++;
      if (r["Bill Vs Quote Pct"] != null) p.gaps.push(+r["Bill Vs Quote Pct"]);
      // dollar-weighted gap: sum(bill - quote) / sum(quote), so job size counts
      if (r["Total Bill"] != null && num(r["Avg Quote"])) {
        p.gapBill += +r["Total Bill"]; p.gapQuote += +r["Avg Quote"]; p.gapN++;
      }
      if (r["Review Score"] != null) p.rev5.push(+r["Review Score"]);
      p.claims += +r["Claims N"] || 0;
      const s = (r["Source"] || "—").trim() || "—";
      (p.bySrc[s] = p.bySrc[s] || { leads: 0, conf: 0, qual: 0 });
      p.bySrc[s].leads++; if (isQual(r)) p.bySrc[s].qual++; if (isConf(r)) p.bySrc[s].conf++;
    });
    // TREND: always the full history (the date filter scopes every other number on the page,
    // but a "trend" cropped to one month is just a single bar and tells you nothing).
    (ctx.trendRows || srcRows).forEach(r => {
      const c = canonOf(r["Assigned"]);
      if (excluded(c)) return;
      const mo = (r["Create Date"] || "").slice(0, 7);
      if (!mo) return;
      const p = get(c);
      (p.byMonth[mo] = p.byMonth[mo] || { leads: 0, conf: 0, qual: 0 }).leads++;
      if (isQual(r)) p.byMonth[mo].qual++;
      if (isConf(r)) p.byMonth[mo].conf++;
    });
    // confirmations on the CONFIRMED-date basis, per rep -> canonical booking rate
    (ctx.repConfRows || []).forEach(r => {
      const c = canonOf(r["Assigned"]);
      if (excluded(c) || !isConf(r)) return;
      get(c).confEv++;
    });
    const stat = {};
    (ctx.repStats || []).forEach(r => { stat[(r["Sales Person"] || "").toLowerCase()] = r; get(r["Sales Person"] || ""); });
    Object.values(by).forEach(p => {
      p.deadPct = p.leads ? 100 * p.dead / p.leads : null;
      // TWO different questions, kept apart on purpose:
      //  bookRate  - of the leads in THIS period, how many have confirmed so far (cohort). The
      //              mix-adjustment panel needs this basis on both sides to be a fair skill read.
      //  bookCanon - the portal's canonical booking rate (confirms in period / qualified), the
      //              number the Team table and the KPI card show.
      p.bookRate = p.qual ? Math.min(100, 100 * p.conf / p.qual) : null;
      p.bookCanon = p.confEv > p.qual ? 100
        : (!p.qual && !p.confEv) ? null
        : !p.confEv ? 0
        : 100 * p.confEv / p.qual;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
      p.upsell = p.closed ? p.mat / p.closed : null;   // no closed jobs -> unknown, not $0
      p.avgGap = p.gaps.length ? p.gaps.reduce((a, b) => a + b, 0) / p.gaps.length : null;
      // $-weighted gap drives the under-quoting flag (a small job can't tip it alone)
      p.gapWtd = p.gapQuote ? 100 * (p.gapBill - p.gapQuote) / p.gapQuote : null;
      p.avgReview = p.rev5.length ? p.rev5.reduce((a, b) => a + b, 0) / p.rev5.length : null;
      p.slowPct = p.called ? 100 * p.slow / p.called : null;
      // margin & comp efficiency (closed jobs)
      p.hasProfit = p.rows.some(r => r["Profit"] != null);
      p.hasComm = p.rows.some(r => r["Sales Commission"] != null);
      p.margin = (p.rev && p.hasProfit) ? 100 * p.profit / p.rev : null;
      // null (not 0) when nothing is measurable — the axis then drops out of the composite
      // instead of scoring the rep as the worst on the team for un-filed paperwork.
      p.profitLead = (p.leads && p.hasProfit) ? p.profit / p.leads : null;
      p.commPerKRev = p.rev ? 1000 * p.commission / p.rev : null;
      p.commPerKProfit = p.profit > 0 ? 1000 * p.commission / p.profit : null;
      p.netRev = p.rev - p.refunds;
      p.avgSat = p.sat5.length ? p.sat5.reduce((a, b) => a + b, 0) / p.sat5.length : null;
      // integrity signals
      p.vanityPct = p.conf ? 100 * p.confNoClose / p.conf : null;
      p.deadUnworkedPct = p.dead ? 100 * p.deadUnworked / p.dead : null;
      p.talkPerOut = p.out ? p.talk / p.out : null;
      const s = stat[p.name.toLowerCase()] || {};
      const c = {
        ext: s["Ext Label"] || null, type: s["Type"] || null, status: s["Status"] || null,
        outDials: +s["Out Dials"] || 0, outConn: +s["Out Connected"] || 0, outTalk: +s["Out Talk Sec"] || 0,
        inTotal: +s["In Total"] || 0, inAcc: +s["In Accepted"] || 0, inMiss: +s["In Missed"] || 0,
        inVm: +s["In Voicemail"] || 0, inTalk: +s["In Talk Sec"] || 0, smsOut: +s["Sms Out"] || 0,
      };
      c.outConnRate = c.outDials ? 100 * c.outConn / c.outDials : null;
      c.inAcceptRate = c.inTotal ? 100 * c.inAcc / c.inTotal : null;
      c.avgOut = c.outConn ? c.outTalk / c.outConn : null;
      c.avgIn = c.inAcc ? c.inTalk / c.inAcc : null;
      p.call = c;
    });
    return by;
  }

  // rank helper: returns {rank, of, better} for a rep on a metric across eligible peers
  // How many observations a metric needs before a rep can be RANKED on it. Without this a
  // rep with a single review or a single closed job could be crowned "#1 of 11" on noise.
  const METRIC_N = {
    avgReview: p => p.rev5.length, margin: p => p.closed, upsell: p => p.closed,
    profitLead: p => p.closed, revLead: p => p.closed, medTto: p => p.tto.length,
  };
  const MIN_N = { avgReview: 5, margin: 5, upsell: 5, profitLead: 5, revLead: 5, medTto: 8 };
  const enoughFor = (p, key) => {
    const f = METRIC_N[key];
    return !f || (f(p) || 0) >= (MIN_N[key] || 0);
  };
  function rankOn(book, name, key, dir, elig) {
    const vals = Object.values(book).filter(q => elig(q) && enoughFor(q, key))
      .map(p => ({ n: p.name, v: keyVal(p, key) }))
      .filter(x => x.v != null);
    vals.sort((a, b) => dir === "hi" ? b.v - a.v : a.v - b.v);
    const me = vals.find(x => x.n === name);
    if (!me) return null;
    // MID-RANK ties. findIndex() gave tied reps different ranks by insertion order, so two reps
    // with the identical value (0 claims, same review score) could read "#2 of 8" and "#3 of 8"
    // -- and only one of them landed in Watch areas. Same rule good() already uses below.
    const better = vals.filter(x => (dir === "hi" ? x.v > me.v : x.v < me.v)).length;
    const tied = vals.filter(x => x.v === me.v).length - 1;
    return { rank: better + 1, of: vals.length,
             pctile: vals.length > 1 ? (better + 0.5 * tied) / (vals.length - 1) : 0 };
  }
  const keyVal = (p, key) => key.indexOf("call.") === 0 ? p.call[key.slice(5)] : p[key];

  const METRICS = [
    { key: "bookRate", dir: "hi", label: "Conversion of own leads", fmt: v => pct1(v) },
    { key: "medTto", dir: "lo", label: "First-call speed", fmt: v => mins(v) },
    { key: "revLead", dir: "hi", label: "Revenue / lead", fmt: v => money0(v) },
    { key: "profitLead", dir: "hi", label: "Profit / lead", fmt: v => money0(v) },
    { key: "margin", dir: "hi", label: "Gross margin", fmt: v => pct1(v) },
    { key: "upsell", dir: "hi", label: "Upsell / job", fmt: v => money0(v) },
    { key: "avgReview", dir: "hi", label: "Review score", fmt: v => v == null ? "—" : v.toFixed(1) + "★" },
    { key: "deadPct", dir: "lo", label: "Dead-lead share", fmt: v => pct1(v) },
    { key: "call.inAcceptRate", dir: "hi", label: "Inbound answer rate", fmt: v => pct1(v) },
    { key: "call.outConnRate", dir: "hi", label: "Outbound connect rate", fmt: v => pct1(v) },
  ];

  /* ---- team baselines for mix-adjustment, distribution & win/leak ---- */
  const DIMS = [
    { key: "Size of Move", label: "Size of move", ordinal: false },
    { key: "CF Range", label: "Volume (CF)", ordinal: true },
    { key: "Bill Range", label: "Revenue range", ordinal: true },
    { key: "State", label: "State", ordinal: false },
    { key: "Service Type", label: "Moving type", ordinal: false },
  ];
  const dv = (r, k) => { const v = (r[k] == null ? "" : String(r[k])).trim(); return v || "—"; };
  // first number in a range label, for natural (label) sorting of CF/Revenue ranges
  const rangeNum = s => { const m = String(s).replace(/,/g, "").match(/-?\d+/); return m ? +m[0] : (s === "—" ? 1e15 : 9e14); };
  // COARSE job-size band — 3 buckets instead of the raw 7 CF ranges, so segments stay big.
  const cfBand = r => {
    const cf = +r["Total CF"];
    if (!isFinite(cf) || cf <= 0) return "size n/a";
    return cf <= 500 ? "small (≤500 CF)" : cf <= 1000 ? "medium (501–1000 CF)" : "large (1000+ CF)";
  };
  // Mix-adjust segment = Source × coarse size band ONLY. Source is by far the biggest driver
  // of booking rate (Angi ~7% vs Returned Customer ~64%); size is the useful second axis.
  // Dropping the old ×LD×Size-of-move collapses ~97 tiny 1-4 lead buckets into ~12-18 real
  // ones — so team baselines are computed on samples big enough to mean something.
  const _segKey = r => `${dv(r, "Source")} · ${cfBand(r)}`;
  function teamIndex(rows) {
    const dim = {}; DIMS.forEach(d => dim[d.key] = {});
    const seg = {};              // mix-adjust segment: Source × size-band
    let leads = 0, qual = 0, dead = 0, conf = 0, conn = 0;
    rows.forEach(r => {
      leads++; const q = isQual(r), dd = isDead(r), cf = isConf(r), cn = !!+r["Connected"];
      if (q) qual++; if (dd) dead++; if (cf) conf++; if (cn) conn++;
      DIMS.forEach(d => {
        const b = (dim[d.key][dv(r, d.key)] = dim[d.key][dv(r, d.key)] || { leads: 0, qual: 0, dead: 0, conf: 0, conn: 0 });
        b.leads++; if (q) b.qual++; if (dd) b.dead++; if (cf) b.conf++; if (cn) b.conn++;
      });
      const b = (seg[_segKey(r)] = seg[_segKey(r)] || { qual: 0, conf: 0 });
      if (q) b.qual++; if (cf) b.conf++;
    });
    return { dim, seg, leads, qual, dead, conf, conn, segKey: _segKey };
  }
  // diverging color for (rep booking% − team booking%): green good, red bad
  function heatColor(delta) {
    if (delta == null) return "transparent";
    const x = Math.max(-1, Math.min(1, delta / 20));   // ±20pts saturates
    return x >= 0
      ? `color-mix(in srgb, var(--brand) ${Math.round(x * 62)}%, transparent)`
      : `color-mix(in srgb, var(--red) ${Math.round(-x * 62)}%, transparent)`;
  }

  function renderRep(host, ctx) {
    const book = repBook(ctx);
    const th = thGet();
    // rep list: those with leads in the current filter OR any phone activity, active-ish first
    const reps = Object.values(book).filter(p =>
      p.name && p.name !== "Unassigned" && !excluded(p.name) && !inactive(p) &&
      p.leads >= ASSESS_MIN);
    reps.sort((a, b) => b.leads - a.leads || (b.call.outDials + b.call.inTotal) - (a.call.outDials + a.call.inTotal));
    if (!reps.length) { host.innerHTML = `<div class="st-card">No sales reps in the current filter.</div>`; return; }
    // WHO we show = the top Sales Person filter (canonicalised). It is enforced single-select
    // on this tab, so the newest pick wins; with nothing picked we open on the biggest book.
    const cmap = ctx.repCanon || {};
    const picked = [...(RS.state.multi.sales || [])]
      .map(n => cmap[String(n).trim().toLowerCase()] || String(n).trim())
      .filter(n => reps.some(p => p.name === n));
    if (picked.length) {
      ctx.repSel = picked[picked.length - 1];
      if ((RS.state.multi.sales || new Set()).size > 1) {   // collapse to a single rep
        const keep = new Set();
        ctx.rows.concat(ctx.repRows || []).forEach(r => {
          const a = (r["Assigned"] || "").trim();
          if (a && (cmap[a.toLowerCase()] || a) === ctx.repSel) keep.add(a);
        });
        if (keep.size) RS.state.multi.sales = keep;
      }
    } else if (!ctx.repSel || !reps.some(p => p.name === ctx.repSel)) ctx.repSel = reps[0].name;

    host.innerHTML = `
      <div class="st-bar">
        <span class="rp-who">Showing <b>${esc(ctx.repSel)}</b></span>
        <span class="st-dim" style="font-size:12.5px">— pick anyone with the <b>Sales Person</b> filter at the top</span>
        <span style="flex:1"></span>
        <button class="st-chip" id="rpJump">Open their leads in Explorer →</button></div>
      <div id="rpBody"></div>`;
    host.querySelector("#rpJump").onclick = () => { ST_LAST_TAB = "explorer"; ctx.go("explorer"); };
    paintRep(host.querySelector("#rpBody"), book, ctx.repSel, th, teamIndex(ctx.repRows || ctx.rows));
  }

  // send the rep's leads to the Lead Explorer via the GLOBAL Sales Person filter (one
  // filter home — no duplicate in-page dropdown). Sets every raw Assigned alias for the
  // canonical rep, remembers the target tab, and re-renders the whole page.
  function jumpToRepLeads(ctx, canon, tab) {
    const cmap = ctx.repCanon || {};
    const aliases = Object.keys(cmap).filter(k => cmap[k].toLowerCase() === canon.toLowerCase());
    const names = new Set();
    ctx.rows.forEach(r => { const a = (r["Assigned"] || "").trim(); if (a && aliases.indexOf(a.toLowerCase()) !== -1) names.add(a); });
    if (!names.size) names.add(canon);
    RS.state.multi.sales = names;
    ST_LAST_TAB = tab || "explorer";
    if (window.renderPage) window.renderPage(); else ctx.go("explorer");
  }

  function paintRep(host, book, name, th, team) {
    const p = book[name], c = p.call;
    const elig = q => q.leads >= ASSESS_MIN && q.name !== "Unassigned" && !excluded(q.name) && !inactive(q);
    const eligCall = q => elig(q) && (q.call.outDials + q.call.inTotal) >= 200;
    const kpi = (l, v, s, cls) => `<div class="st-kpi"><div class="l">${l}</div><div class="v ${cls || ""}">${v}</div><div class="s">${s || ""}</div></div>`;

    // strong sides / watch areas
    const strengths = [], watch = [];
    METRICS.forEach(m => {
      const isCall = m.key.indexOf("call.") === 0;
      const rk = rankOn(book, name, m.key, m.dir, isCall ? eligCall : elig);
      if (!rk || rk.of < 4) return;
      const v = keyVal(p, m.key);
      if (v == null) return;
      const nObs = METRIC_N[m.key] ? (METRIC_N[m.key](p) || 0) : null;
      const alltime = m.key.indexOf("call.") === 0;   // RingCentral stats ignore the date filter
      const chip = `<div class="rp-str"><span class="rp-str-l">${m.label}${nObs != null ? ` <span class="st-dim" style="font-weight:600">· n=${nObs}</span>` : ""}${alltime ? ` <span class="st-dim" style="font-weight:600">· all-time</span>` : ""}</span><span class="rp-str-v">${m.fmt(v)}</span><span class="rp-str-r">#${rk.rank} of ${rk.of}</span></div>`;
      if (rk.pctile <= 0.34 && rk.rank <= 4) strengths.push({ chip, pctile: rk.pctile });
      else if (rk.pctile >= 0.75) watch.push({ chip, pctile: rk.pctile });
    });
    strengths.sort((a, b) => a.pctile - b.pctile);
    watch.sort((a, b) => b.pctile - a.pctile);

    const inBar = c.inTotal ? `<div class="rp-stack">
        <div style="flex:${c.inAcc};background:var(--brand)" title="Answered ${c.inAcc}"></div>
        <div style="flex:${Math.max(0, c.inTotal - c.inAcc)};background:var(--red)" title="Not answered ${c.inMiss}"></div>
      </div>` : "";
    const months = Object.keys(p.byMonth).sort();
    const maxM = Math.max(1, ...months.map(m => p.byMonth[m].leads));
    const TH = 150;   // chart body height in px
    const best = months.reduce((a, m) => {
      const d = p.byMonth[m]; const r = d.qual ? d.conf / d.qual : -1;
      return r > a.r ? { m, r } : a; }, { m: null, r: -1 });
    const trend = !months.length ? `<div class="st-note">No leads on record.</div>`
      : `<div class="rp-trend">${months.map(m => {
          const d = p.byMonth[m];
          const lh = Math.max(3, Math.round(TH * d.leads / maxM));
          // confirmed is a SUBSET of that month's leads, so it goes INSIDE the bar. Split three
          // ways bottom-up (confirmed / still-open qualified / dead) so the printed booking %
          // -- confirmed over QUALIFIED -- is the green share of the non-grey part, not a number
          // that quietly disagrees with the picture beside it.
          const dead = Math.max(0, d.leads - d.qual);
          const hDead = d.leads ? Math.round(lh * dead / d.leads) : 0;
          const hConf = d.leads ? Math.round(lh * d.conf / d.leads) : 0;
          const hOpen = Math.max(0, lh - hDead - hConf);
          const rate = d.qual ? Math.round(100 * d.conf / d.qual) : null;
          return `<div class="rp-mo" title="${m} — ${d.leads} leads created: ${d.conf} confirmed, ${Math.max(0, d.qual - d.conf)} qualified but never confirmed, ${dead} dead${rate != null ? ". Booking " + rate + "% (" + d.conf + " of " + d.qual + " qualified)" : ""}">
            <div class="rp-mo-val">${RS.fmtN(d.leads)}</div>
            <div class="rp-mo-slot" style="height:${TH}px">
              <div class="rp-mo-bar" style="height:${lh}px">
                <div class="rp-mo-dead" style="height:${hDead}px"></div>
                <div class="rp-mo-open" style="height:${hOpen}px"></div>
                <div class="rp-mo-fill" style="height:${hConf}px"></div>
              </div>
            </div>
            <div class="rp-mo-pct">${rate != null ? rate + "%" : "—"}</div>
            <div class="rp-mo-x">${m.slice(2)}</div></div>`;
        }).join("")}</div><div class="rp-trend-base"></div>
        <div class="st-note" style="margin-top:8px">Full history — this chart deliberately ignores the date filter so the trend is always readable.
        Bar height = leads created that month, split bottom-up:
        <b style="color:var(--brand)">confirmed</b> · <b style="color:var(--blue)">qualified but never confirmed</b> · <span style="color:var(--faint)"><b>dead</b></span>.
        The % under each bar is the booking rate — the green share of everything above the grey.${best.m ? ` Best month: <b>${best.m}</b> at ${Math.round(100 * best.r)}%.` : ""}</div>`;
    const srcRows = Object.entries(p.bySrc).sort((a, b) => b[1].leads - a[1].leads).slice(0, 8)
      .map(([s, d]) => `<tr><td>${esc(s)}</td><td style="text-align:right">${RS.fmtN(d.leads)}</td>
        <td style="text-align:right">${d.qual ? pct1(100 * d.conf / d.qual) : "—"}</td></tr>`).join("");

    // ---- mix-adjusted booking (skill vs luck), with empirical-Bayes shrinkage ----
    // Each segment's team rate is blended toward the overall team booking rate, weighted by
    // how many team leads that segment has: a segment needs ~M_PRIOR leads before its own
    // rate outweighs the mean. This stops a 1-3 lead segment from swinging the expected number.
    const M_PRIOR = 25;
    const p0 = team.qual ? team.conf / team.qual : 0;
    const shrunk = k => { const b = team.seg[k]; const tq = b ? b.qual : 0, tc = b ? b.conf : 0; return (tc + M_PRIOR * p0) / (tq + M_PRIOR); };
    const segAgg = {};
    p.rows.forEach(r => {
      if (!isQual(r)) return;
      const k = team.segKey(r);
      const a = (segAgg[k] = segAgg[k] || { qual: 0, conf: 0 });
      a.qual++; if (isConf(r)) a.conf++;
    });
    const segList = Object.entries(segAgg).map(([k, a]) => {
      const tb = team.seg[k];
      return { label: k, qual: a.qual, conf: a.conf, tq: tb ? tb.qual : 0, rate: shrunk(k), exp: a.qual * shrunk(k) };
    }).sort((x, y) => y.qual - x.qual);
    let expConf = 0, mixN = 0;
    segList.forEach(s => { mixN += s.qual; expConf += s.exp; });
    const expRate = mixN ? 100 * expConf / mixN : null;
    const gap = (expRate == null || p.bookRate == null) ? null : p.bookRate - expRate;
    // |gap| under 1pt is statistical noise, not a verdict — neutral, never red/green
    const gapCls = gap == null || Math.abs(gap) < 1 ? "" : gap >= 0 ? "st-good" : "st-bad";
    const gapTxt = gap == null ? "—"
      : Math.abs(gap) < 1 ? "on par (" + (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts)"
      : (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts";
    const mixMax = Math.max(expRate || 0, p.bookRate || 0, 10) * 1.18;
    const calcRow = s => `<tr><td><b>${esc(s.label)}</b></td>
      <td style="text-align:right">${RS.fmtN(s.qual)}</td>
      <td style="text-align:right">${pct1(100 * s.rate)}${s.tq < M_PRIOR ? ` <span class="st-dim" title="Only ${s.tq} team leads here — pulled toward the ${pct1(100 * p0)} team average">~</span>` : ""} <span class="st-dim" style="font-size:10.5px">(${RS.fmtN(s.tq)} team)</span></td>
      <td style="text-align:right;color:var(--muted)">${(Math.round(s.exp * 10) / 10).toFixed(1)}</td>
      <td style="text-align:right;font-weight:700">${RS.fmtN(s.conf)}</td></tr>`;
    const mixCalc = `<details class="rp-calc"><summary>How the expected rate is calculated ▾</summary>
      <div class="st-note" style="margin:8px 0 10px">Each of ${esc(name.split(" ")[0])}'s <b>${RS.fmtN(mixN)} qualified leads</b> is grouped by <b>lead source × job-size band</b> — the two things that actually move booking rate. For each group we take how often the <b>whole team</b> converts it and add those odds up: that sum is the <b>expected confirms</b>, what an average rep would book from this exact pile of leads. Thin groups (few team leads, marked <span class="st-dim">~</span>) are pulled toward the ${pct1(100 * p0)} team average so a 1–2 lead segment can't swing the number.</div>
      <div style="overflow-x:auto"><table class="st-tbl rp-dist"><thead><tr>
        <th>Source × size segment</th><th style="text-align:right">Qualified</th>
        <th style="text-align:right">Team books</th><th style="text-align:right">Expected</th>
        <th style="text-align:right">Actual</th></tr></thead><tbody>
        ${segList.map(calcRow).join("")}
        <tr class="rp-dist-tot"><td>Total · ${segList.length} segments</td>
          <td style="text-align:right">${RS.fmtN(mixN)}</td><td></td>
          <td style="text-align:right;font-weight:800;color:var(--muted)">${expConf.toFixed(1)}</td>
          <td style="text-align:right;font-weight:800">${RS.fmtN(p.conf)}</td></tr>
      </tbody></table></div>
      <div class="st-note" style="margin-top:9px"><b>Expected rate</b> = ${expConf.toFixed(1)} expected confirms ÷ ${RS.fmtN(mixN)} qualified = <b>${pct1(expRate)}</b>. &nbsp;<b>Actual rate</b> = ${RS.fmtN(p.conf)} confirms ÷ ${RS.fmtN(mixN)} qualified = <b>${pct1(p.bookRate)}</b> — both sides count <i>this period's leads</i>, which is what makes the comparison fair (the headline booking rate above uses the canonical confirmed-date basis instead). &nbsp;Difference = <b class="${gapCls}">${gapTxt}</b> — skill above/below the leads they were dealt.</div>
    </details>`;
    const mixCard = mixN ? `<div class="st-card">
      <div class="rp-cardcap">🎯 Skill vs luck — mix-adjusted booking rate</div>
      <div class="rp-mix">
        <div class="rp-mix-cell"><div class="rp-mix-l">Expected for their lead mix</div><div class="rp-mix-v" style="color:var(--muted)">${pct1(expRate)}</div></div>
        <div class="rp-mix-arrow">→</div>
        <div class="rp-mix-cell"><div class="rp-mix-l">Actual, same leads</div><div class="rp-mix-v">${pct1(p.bookRate)}</div></div>
        <div class="rp-mix-gap ${gapCls}">${gapTxt}</div>
      </div>
      <div class="rp-track" title="Actual ${pct1(p.bookRate)} vs expected ${pct1(expRate)}">
        <div class="rp-track-fill" style="width:${Math.min(100, 100 * (p.bookRate || 0) / mixMax)}%"></div>
        <div class="rp-track-mark" style="left:${Math.min(100, 100 * (expRate || 0) / mixMax)}%" title="Expected ${pct1(expRate)}"></div>
      </div>
      <div class="st-note" style="margin-top:9px">The <b>marker</b> is expected, the <b>bar</b> is actual — bar past the marker = real skill beyond the leads they were handed.</div>
      ${mixCalc}
    </div>` : "";

    // ================= HEAD-OF-SALES ASSESSMENT =================
    // per-rep mix gap (skill), computed across the whole team for ranking — uses the SAME
    // shrunk segment rates as the card above, so the rank agrees with the shown number.
    const repMixGap = q => {
      let e = 0, n = 0;
      q.rows.forEach(r => { if (!isQual(r)) return; n++; e += shrunk(team.segKey(r)); });
      return (n && q.bookRate != null) ? q.bookRate - 100 * e / n : null;
    };
    Object.values(book).forEach(q => { if (q.__mg === undefined) q.__mg = repMixGap(q); });
    const eligA = q => q.leads >= ASSESS_MIN && q.name !== "Unassigned" && !excluded(q.name) && !inactive(q);
    const good = (fn, dir) => {                 // this rep's percentile (0..1, higher = better)
      const vals = Object.values(book).filter(eligA).map(fn).filter(v => v != null);
      const v = fn(p);
      if (v == null || vals.length < 4) return null;
      // MID-RANK: ties share the middle of their band. Counting only strictly-worse peers
      // put every tied rep at the bottom — so a rep with ZERO claims (the best value, but
      // tied with many others) was ranked worst and told they had a "high claim rate".
      const worse = vals.filter(x => dir === "hi" ? x < v : x > v).length;
      const ties = vals.filter(x => x === v).length - 1;      // exclude self
      return vals.length > 1 ? (worse + 0.5 * ties) / (vals.length - 1) : 0.5;
    };
    const AX = [
      { k: "Conversion skill", g: good(q => q.__mg, "hi"), w: 0.30, val: gap == null ? "—" : (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts",
        strong: "converts above the leads they're dealt", weak: "converts below what their lead mix should yield",
        absBad: gap != null && gap < -1,
        fix: "Have them shadow a top closer and review their pitch/qualification — the leads are fine, the conversion isn't." },
      { k: "Profit / lead", g: good(q => q.profitLead, "hi"), w: 0.22, val: money0(p.profitLead),
        strong: "builds high-profit jobs", weak: "low profit per lead",
        fix: "Tighten quoting & discount discipline — the revenue may be fine but the margin isn't." },
      { k: "Quality (claims)", g: good(q => (q.closed ? q.claims / q.closed : null), "lo"), w: 0.12,
        val: p.claims + " claim" + (p.claims === 1 ? "" : "s") + (p.closed ? " · " + (Math.round(1000 * p.claims / p.closed) / 10) + " per 100 jobs" : ""),
        strong: "clean jobs — low claim rate", weak: "high claim rate on their jobs",
        absBad: !!(p.closed && p.claims / p.closed > 0.1),
        fix: "Review their claims and over-promising on quotes — durable revenue beats booked revenue." },
      { k: "First-call speed", g: good(q => q.medTto, "lo"), w: 0.14, val: p.medTto != null ? mins(p.medTto) : "—",
        strong: "fast to the phone", weak: "slow to make first contact",
        absBad: p.medTto != null && p.medTto > th.slowMin,
        fix: "Hold them to the speed SLA — target under 30 min; slow first calls quietly lose winnable jobs." },
      // volume floor: a connect rate off a handful of dials is noise, and ranking a rep on it
      // contradicts the >=200-interaction gate the same metric uses elsewhere on this page.
      { k: "Call effort", g: good(q => (q.call.outDials >= 200 ? q.call.outConnRate : null), "hi"), w: 0.14,
        val: p.call.outDials >= 200 ? pct1(p.call.outConnRate) : (p.call.outDials ? pct1(p.call.outConnRate) + " (only " + RS.fmtN(p.call.outDials) + " dials — not ranked)" : "—"),
        strong: "strong phone connect rate", weak: "weak call connect / activity", allTime: true,
        fix: "Put accountability on dials & connect rate — low activity is the easiest gap to close." },
      { k: "Lead qualification", g: good(q => q.deadPct, "lo"), w: 0.08, val: pct1(p.deadPct),
        strong: "qualifies well (low dead share)", weak: "high dead-lead share",
        absBad: p.deadPct != null && p.deadPct > 40,
        fix: "Audit their dead-lead marks — are reachable leads being written off to protect booking rate?" },
    ];
    let ws = 0, sc = 0; AX.forEach(a => { if (a.g != null) { sc += a.w * a.g; ws += a.w; } });
    const score = ws ? Math.round(100 * sc / ws) : null;
    const enough = p.leads >= ASSESS_MIN;
    const strongAx = AX.filter(a => a.g != null && a.g >= 0.68).sort((a, b) => b.g - a.g);
    const weakAx = AX.filter(a => a.g != null && a.g <= 0.32).sort((a, b) => a.g - b.g);
    let verdict, vClass, vIcon;
    if (score == null || !enough) { verdict = "Not enough data"; vClass = "dim"; vIcon = "…"; }
    else if (score >= 75) { verdict = "Top performer"; vClass = "top"; vIcon = "★"; }
    else if (score >= 58) { verdict = "Solid"; vClass = "good"; vIcon = "✓"; }
    else if (score >= 42) { verdict = "Developing"; vClass = "mid"; vIcon = "◐"; }
    else if (score >= 27) { verdict = "Needs attention"; vClass = "warn"; vIcon = "!"; }
    else { verdict = "At risk"; vClass = "bad"; vIcon = "▲"; }
    let summary;
    if (score == null || !enough) summary = `Only ${RS.fmtN(p.leads)} leads in this period — widen the date range for a reliable read.`;
    else if (strongAx[0] && weakAx[0]) summary = `Strong on ${strongAx[0].strong}${strongAx[1] ? " and " + strongAx[1].strong : ""}, but ${weakAx[0].absBad === false ? "trails the team on " + weakAx[0].k.toLowerCase() : weakAx[0].weak}.`;
    else if (strongAx[0]) summary = `Strong on ${strongAx[0].strong}${strongAx[1] ? " and " + strongAx[1].strong : ""} — no major weak spots.`;
    else if (weakAx[0]) summary = weakAx.some(a => a.absBad !== false)
      ? `Underperforming — ${weakAx[0].weak}${weakAx[1] ? ", and " + weakAx[1].weak : ""}.`
      : `No absolute problems — they simply sit at the back of the team on ${weakAx.slice(0, 2).map(a => a.k.toLowerCase()).join(" and ")}.`;
    else summary = `A balanced, middle-of-the-pack profile — no standout strengths or weaknesses.`;
    const actions = [];
    if (AX[0].g != null && gap != null && gap > 1.5 && AX[0].g >= 0.6)
      actions.push("<b>Feed them more volume</b> — they convert above their lead mix. Route more of their green segments (see the distribution below).");
    // only prescribe a fix for a REAL (absolute) problem; a merely bottom-of-a-strong-team
    // metric gets a watch note instead of a corrective action.
    weakAx.slice(0, 3).forEach(a => actions.push(
      a.absBad === false
        ? `<span class="st-dim">${esc(a.k)} is the team's weakest at ${a.val}, but not an absolute problem — watch, don't correct.</span>`
        : a.fix));
    if (!actions.length) actions.push("Hold steady — no red flags. Keep the lead flow and current coaching; revisit next month for trend.");
    const bullets = (arr, fn) => arr.length ? `<ul class="rp-alist">${arr.map(fn).join("")}</ul>` : `<div class="st-dim" style="font-size:12.5px">—</div>`;
    const assessCard = `<div class="rp-assess ${vClass}">
      <div class="rp-verdict">
        <div class="rp-vscore"><div class="rp-vnum">${score == null ? "—" : score}</div><div class="rp-vout">/ 100</div></div>
        <div class="rp-vmeta">
          <div class="rp-vtitle"><span class="rp-vicon">${vIcon}</span>${esc(verdict)}</div>
          <div class="rp-vsum">${summary}</div>
        </div>
      </div>
      <div class="rp-assess-cols">
        <div><div class="rp-cap">Doing well</div>${bullets(strongAx, a => `<li><b>${esc(a.k)}</b> — ${a.strong} <span class="st-dim">(${a.val}${a.allTime ? ", all-time" : ""})</span></li>`)}</div>
        <div><div class="rp-cap">Needs work</div>${bullets(weakAx, a => `<li><b>${esc(a.k)}</b> — ${a.absBad === false ? "trails the team (not an absolute problem)" : a.weak} <span class="st-dim">(${a.val}${a.allTime ? ", all-time" : ""})</span></li>`)}</div>
        <div><div class="rp-cap">What I'd do</div><ul class="rp-alist">${actions.map(x => `<li>${x}</li>`).join("")}</ul></div>
      </div>
      <div class="st-note">Score blends conversion skill (mix-adjusted, 30%), profit/lead (22%), quality (12%), first-call speed (14%), call effort (14%) and qualification (8%), each ranked against the team. It's a starting read, not a verdict on its own — click through the panels below before acting.</div>
    </div>`;

    // ---- margin & commission ----
    const marginCard = `<div class="st-card">
      <div class="rp-cardcap">💰 Margin & commission — the profit behind the revenue</div>
      <div class="st-kpis" style="grid-template-columns:repeat(4,1fr);margin-top:2px">
        ${kpi("Gross profit", p.hasProfit ? money0(p.profit) : "—", p.hasProfit ? (p.margin != null ? pct1(p.margin) + " margin" : "") : "not filed on these jobs")}
        ${kpi("Profit / lead", p.profitLead == null ? "—" : money0(p.profitLead), "revenue/lead " + money0(p.revLead))}
        ${kpi("Commission paid", p.hasComm ? money0(p.commission) : "—", p.hasComm ? (p.commPerKRev != null ? money0(p.commPerKRev) + " / $1k rev" : "") : "not filed on these jobs")}
        ${kpi("Net revenue", money0(p.netRev), p.refunds ? "after " + money0(p.refunds) + " refunds" : "no refunds")}
      </div>
      <div class="st-note">Gross profit &amp; margin from the closing sheet${p.hasProfit ? "" : " — <b>no profit figures are filed</b> on this rep's closed jobs in this range, so these read as — rather than $0"}.${p.commPerKProfit != null ? " Commission costs " + money0(p.commPerKProfit) + " per $1k of gross profit." : ""}${p.avgSat != null ? " Internal satisfaction " + p.avgSat.toFixed(1) + "/10." : ""}</div>
    </div>`;

    // ---- lead distribution & win/leak (full funnel per segment) ----
    const cellNP = (n, pct) => `<td style="text-align:right">${RS.fmtN(n)}${pct != null ? ` <span class="st-dim" style="font-size:11px">${Math.round(pct)}%</span>` : ""}</td>`;
    const distTbl = d => {
      const rd = {};
      p.rows.forEach(r => {
        const v = dv(r, d.key);
        const b = (rd[v] = rd[v] || { leads: 0, qual: 0, dead: 0, conf: 0, conn: 0 });
        b.leads++;
        if (isQual(r)) b.qual++;
        if (isDead(r)) b.dead++;
        if (isConf(r)) b.conf++;
        if (+r["Connected"]) b.conn++;
      });
      let rows = Object.entries(rd);
      if (!rows.length) return `<div class="st-note">No leads in period.</div>`;
      // his ask: CF/Revenue ranges sort by LABEL (natural order); the rest by volume
      rows = d.ordinal ? rows.sort((a, b) => rangeNum(a[0]) - rangeNum(b[0]))
                       : rows.sort((a, b) => b[1].leads - a[1].leads).slice(0, 12);
      const rowHtml = ([v, b]) => {
        const repShare = p.leads ? 100 * b.leads / p.leads : 0;
        const tb = (team.dim[d.key] || {})[v] || { leads: 0, qual: 0, dead: 0, conf: 0, conn: 0 };
        const teamShare = team.leads ? 100 * tb.leads / team.leads : 0;
        const repBook = b.qual ? 100 * b.conf / b.qual : null;
        const teamBook = tb.qual ? 100 * tb.conf / tb.qual : null;
        const delta = (repBook != null && teamBook != null) ? repBook - teamBook : null;
        const over = repShare - teamShare;
        return `<tr><td><b>${esc(v)}</b></td>
          <td style="text-align:right">${RS.fmtN(b.leads)} <span class="st-dim" style="font-size:11px">${pct1(repShare)}${Math.abs(over) >= 5 ? ` <span class="${over > 0 ? "st-good" : "st-bad"}">${over > 0 ? "▲" : "▼"}</span>` : ""} <span style="color:var(--faint)">/ ${Math.round(teamShare)}%</span></span></td>
          ${cellNP(b.qual, b.leads ? 100 * b.qual / b.leads : null)}
          ${cellNP(b.dead, b.leads ? 100 * b.dead / b.leads : null)}
          ${cellNP(b.conf, null)}
          ${cellNP(b.conn, b.leads ? 100 * b.conn / b.leads : null)}
          <td style="text-align:right;background:${heatColor(delta)};font-weight:750">${repBook != null ? pct1(repBook) : "—"}${teamBook != null ? ` <span class="st-dim" style="font-size:11px">/ ${Math.round(teamBook)}%</span>` : ""}</td></tr>`;
      };
      const t = rows.reduce((a, [, b]) => { a.leads += b.leads; a.qual += b.qual; a.dead += b.dead; a.conf += b.conf; a.conn += b.conn; return a; }, { leads: 0, qual: 0, dead: 0, conf: 0, conn: 0 });
      const totBook = t.qual ? 100 * t.conf / t.qual : null;
      const totRow = `<tr class="rp-dist-tot"><td>All shown</td>
        <td style="text-align:right">${RS.fmtN(t.leads)}</td>
        ${cellNP(t.qual, t.leads ? 100 * t.qual / t.leads : null)}
        ${cellNP(t.dead, t.leads ? 100 * t.dead / t.leads : null)}
        ${cellNP(t.conf, null)}
        ${cellNP(t.conn, t.leads ? 100 * t.conn / t.leads : null)}
        <td style="text-align:right;font-weight:800">${totBook != null ? pct1(totBook) : "—"}</td></tr>`;
      return `<div style="overflow-x:auto"><table class="st-tbl rp-dist"><thead><tr>
        <th>${esc(d.label)}</th>
        <th style="text-align:right">Leads · mix rep/team</th>
        <th style="text-align:right">Qualified</th>
        <th style="text-align:right">Dead</th>
        <th style="text-align:right">Confirmed</th>
        <th style="text-align:right">Connected</th>
        <th style="text-align:right">Book % rep/team</th>
      </tr></thead><tbody>${rows.map(rowHtml).join("")}${totRow}</tbody></table></div>`;
    };
    const distBtns = DIMS.map((d, i) => `<button class="rp-dimbtn${i === 0 ? " on" : ""}" data-dim="${i}">${esc(d.label)}</button>`).join("");
    const distPanels = DIMS.map((d, i) => `<div class="rp-dimpanel${i === 0 ? "" : " hidden"}" data-dim="${i}">${distTbl(d)}</div>`).join("");
    const distCard = `<div class="st-card">
      <div class="rp-cardcap">🧭 Lead distribution &amp; win/leak — the full funnel per segment</div>
      <div class="rp-dimbar">${distBtns}</div>${distPanels}
      <div class="st-note">Per segment: total <b>leads</b> (with their mix % ▲/▼ vs the team's mix), how many were <b>qualified</b>, <b>dead</b>, <b>confirmed</b>, and <b>connected</b> on a call — plus <b>booking %</b> shaded <span class="st-good">green where they beat</span> / <span class="st-bad">red where they leak</span> vs the team. Percentages are of that segment's leads; booking % is confirmed ÷ qualified. This is the routing guide — send more of the green, review the red.</div>
    </div>`;

    // ---- integrity / anti-gaming ----
    const eligReps = Object.values(book).filter(eligA);   // same pool as the score/rankings
    const mean = f => { const v = eligReps.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const tVanity = mean(q => q.vanityPct), tDeadU = mean(q => q.deadUnworkedPct),
          tGap = mean(q => q.gapWtd), tTto = mean(q => q.medTto), tTPO = mean(q => q.talkPerOut);
    const chk = (label, val, teamv, bad, fmt, note) =>
      `<div class="rp-int ${bad ? "flag" : "ok"}"><span class="rp-int-i">${bad ? "⚠" : "✓"}</span>
        <div class="rp-int-b"><div class="rp-int-t">${label}</div><div class="rp-int-n">${note}</div></div>
        <div class="rp-int-v">${fmt(val)} <span class="st-dim">vs ${fmt(teamv)} team</span></div></div>`;
    const intChecks = [
      chk("Vanity confirms", p.vanityPct, tVanity,
        p.vanityPct != null && tVanity != null && p.vanityPct > tVanity * 1.4 && p.confNoClose >= 3,
        v => v == null ? "—" : pct1(v), "Confirmed leads that never reached a closing sheet"),
      chk("Disqualified un-worked", p.deadUnworkedPct, tDeadU,
        p.deadUnworkedPct != null && tDeadU != null && p.deadUnworkedPct > tDeadU * 1.4 && p.deadUnworked >= 3,
        v => v == null ? "—" : pct1(v), "Leads marked Bad Lead without a single dial (in coverage)"),
      chk("Chronic under-quoting", p.gapWtd, tGap,
        p.gapWtd != null && tGap != null && p.gapN >= 5 && p.gapWtd > tGap + 6 && p.gapWtd > 8,
        v => v == null ? "—" : (v > 0 ? "+" : "") + pct1(v), "Final bill runs above quote — bill-shock / dispute risk"),
      chk("Speed without substance", p.talkPerOut, tTPO,
        p.medTto != null && tTto != null && p.medTto < tTto && p.talkPerOut != null && tTPO != null && p.talkPerOut < tTPO * 0.6,
        v => v == null ? "—" : secH(v), "Fast to dial, but very short calls — SLA met without a real conversation"),
    ].join("");
    const anyFlag = /rp-int flag/.test(intChecks);
    const integrityCard = `<div class="st-card">
      <div class="rp-cardcap">🛡️ Are these numbers earned? — metric-integrity checks</div>
      <div class="rp-intgrid">${intChecks}</div>
      <div class="st-note">${anyFlag ? "One or more headline metrics may be inflated — review before acting on rank or comp." : "No gaming signals — this rep's headline metrics look earned."}</div>
    </div>`;

    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase();
    const extNum = c.ext && /^\d+/.test(c.ext) ? c.ext.match(/^\d+/)[0] : null;
    host.innerHTML = `
      <div class="rp-head">
        <div class="rp-id">
          <div class="rp-avatar">${esc(initials)}</div>
          <div><div class="rp-name">${esc(name)}</div>
            <div class="rp-sub">
              <span class="rp-pill">${esc(c.type || "Sales Rep")}</span>
              ${c.status ? `<span class="rp-pill ${/not/i.test(c.status) ? "" : "on"}">${/not/i.test(c.status) ? "○" : "●"} ${esc(c.status)}</span>` : ""}
              ${extNum ? `<span class="rp-pill">ext ${esc(extNum)}</span>` : ""}
              <span class="rp-pill">${RS.fmtN(p.leads)} leads</span>
            </div></div>
        </div>
        ${strengths.length ? `<div class="rp-strengths"><div class="rp-cap">Strong sides · ranked vs team</div>${strengths.slice(0, 4).map(x => x.chip).join("")}</div>` : ""}
      </div>

      ${assessCard}

      <div class="st-kpis" style="grid-template-columns:repeat(4,1fr)">
        ${kpi("Leads received", RS.fmtN(p.leads), "in the selected period")}
        ${kpi("Qualified", RS.fmtN(p.qual), pct1(p.leads ? 100 * p.qual / p.leads : null) + " of received")}
        ${kpi("Dead leads", RS.fmtN(p.dead), pct1(p.deadPct) + " of received", p.deadPct > 40 ? "st-bad" : "")}
        ${kpi("Confirmed", RS.fmtN(p.conf), "booking rate " + (p.bookCanon != null ? pct1(p.bookCanon) : "—") + " · " + (p.bookRate != null ? pct1(p.bookRate) : "—") + " of this cohort")}
        ${kpi("Median 1st call", p.medTto != null ? mins(p.medTto) : "—", "business time to first call")}
        ${kpi("Revenue", money0(p.rev), money0(p.revLead) + " / lead")}
        ${kpi("Upsell / job", p.upsell == null ? "—" : money0(p.upsell), p.closed ? "materials on " + RS.fmtN(p.closed) + " closed jobs" : "no closed jobs in range")}
        ${kpi("Review score", p.avgReview != null ? p.avgReview.toFixed(1) + "★" : "—", p.claims ? p.claims + " claim(s)" : "no claims")}
      </div>

      <div class="rp-cols">${mixCard}${marginCard}</div>

      <div class="rp-cols">
        <div class="st-card">
          <div class="rp-cardcap">📞 Inbound from their leads — when a lead of ${esc(name.split(" ")[0])}'s called in <span class="rp-alltime">all-time</span></div>
          <div class="st-kpis" style="grid-template-columns:repeat(3,1fr);margin:2px 0 10px">
            ${kpi("Calls received", RS.fmtN(c.inTotal), "from their own leads")}
            ${kpi("Answered", RS.fmtN(c.inAcc), c.inAcceptRate != null ? pct1(c.inAcceptRate) + " answer rate" : "", "st-good")}
            ${kpi("Not answered", RS.fmtN(c.inMiss), "missed / to voicemail", c.inMiss > c.inAcc ? "st-bad" : "")}
          </div>
          ${inBar}
          <div class="st-note" style="margin-top:8px">Avg answered call ${secH(c.avgIn)} · total talk ${secH(c.inTalk)} · <span class="st-dim">matched to their leads within the call-data window</span></div>
        </div>
        <div class="st-card">
          <div class="rp-cardcap">☎️ Outbound — dials this rep made <span class="rp-alltime">all-time</span></div>
          <div class="st-kpis" style="grid-template-columns:repeat(3,1fr);margin:2px 0 10px">
            ${kpi("Dials", RS.fmtN(c.outDials), "all-time (RingCentral)")}
            ${kpi("Connected", RS.fmtN(c.outConn), c.outConnRate != null ? pct1(c.outConnRate) + " connect rate" : "", "st-good")}
            ${kpi("Texts sent", RS.fmtN(c.smsOut), "outbound SMS")}
          </div>
          <div class="st-note">Avg connected call ${secH(c.avgOut)} · total talk ${secH(c.outTalk)} · <span class="st-dim">RingCentral totals are lifetime — they do <b>not</b> follow the date filter above, unlike every other number on this page.</span></div>
          ${watch.length ? `<div class="rp-watch"><div class="rp-cap">Watch areas</div>${watch.slice(0, 3).map(x => x.chip).join("")}</div>` : ""}
        </div>
      </div>

      ${distCard}

      ${integrityCard}

      <div class="rp-cols">
        <div class="st-card"><div class="rp-cardcap">Monthly — confirmed <span class="rp-lg rp-lg-c"></span> &nbsp; still open <span class="rp-lg rp-lg-l"></span> &nbsp; dead <span class="rp-lg rp-lg-d"></span></div>${trend}</div>
        <div class="st-card"><div class="rp-cardcap">By source</div>
          <table class="st-tbl" style="font-size:13px"><thead><tr><th>Source</th><th style="text-align:right">Leads</th><th style="text-align:right">Book %</th></tr></thead>
          <tbody>${srcRows || `<tr><td colspan="3" class="st-dim">No leads in period</td></tr>`}</tbody></table>
        </div>
      </div>`;

    // distribution dimension toggle
    const dimBar = host.querySelector(".rp-dimbar");
    if (dimBar) dimBar.querySelectorAll(".rp-dimbtn").forEach(b => b.onclick = () => {
      dimBar.querySelectorAll(".rp-dimbtn").forEach(x => x.classList.toggle("on", x === b));
      host.querySelectorAll(".rp-dimpanel").forEach(x => x.classList.toggle("hidden", x.dataset.dim !== b.dataset.dim));
    });
  }

  /* ---------------- page ---------------- */
  registerPage({
    id: "sales-command",     // NOT "sales-team" — that id is a RETIRED legacy page (old Monthly Review)
    group: "sales",
    title: "Sales Person Analysis",
    async render(host) {
      injectStyle();
      host.innerHTML = `<div class="st-page">
        <div class="rs-page-head"><h1>Sales Person Analysis</h1>
          <p>Every lead's full story — calls, texts, routing, and the money it became.
          <span class="freshness">· leads count by created date · confirmations by confirmed date</span></p></div>
        <div class="st-tabbar" id="stTabs"></div><div id="stHost"></div></div>`;
      const TABS = [["team", "Team"], ["rep", "Rep Profile"], ["explorer", "Lead Explorer"]];
      const tabsEl = host.querySelector("#stTabs");
      const hostEl = host.querySelector("#stHost");
      let active = ST_LAST_TAB;   // survive a global re-render (e.g. the rep→Explorer jump)

      const ctx = { rows: [], confRows: [], explorerPreset: null, dense: "detail",
        repStats: null, repCanon: null, repSel: null, go: k => go(k) };

      const paintTabs = () => {
        tabsEl.innerHTML = TABS.map(([k, l]) => `<button class="st-tab ${k === active ? "on" : ""}" data-k="${k}">${l}</button>`).join("");
        tabsEl.querySelectorAll(".st-tab").forEach(b => b.onclick = () => go(b.dataset.k));
      };
      const go = async k => {
        active = k; ST_LAST_TAB = k; paintTabs();
        hostEl.innerHTML = `<div class="rs-loading" style="padding:22px">Loading…</div>`;
        const all = await RS.load("lead_journey");
        ctx.rows = RS.filtered("lead_journey", all);

        // ---- confirmations, on the CONFIRMED-date basis --------------------------------
        // RS.filtered()'s `dateColumn` only redirects the date-RANGE check; the Year/Month
        // slicers always filter on the dataset's derived create-date parts (_y/_m). So with
        // Year+Month picked, "Confirmed (in period)" silently collapsed to the create-date
        // cohort while still captioned "by their confirmed date". Neutralise those two
        // slicers for this pass and apply them against Booked Date ourselves.
        const bookedOnly = all.filter(r => /^\d{4}-\d{2}-\d{2}/.test(String(r["Booked Date"] || "")));
        const yrSet = RS.state.multi.year, moSet = RS.state.multi.month;
        const yrOn = yrSet && yrSet.size, moOn = moSet && moSet.size;
        const spSet0 = RS.state.multi.sales;
        // ONE builder for every confirmed-date row set. It was two near-copies, and the copy
        // dropped the year/month half -- so the Rep Profile's booking rate was filtered on BOTH
        // bases at once (created in the month AND confirmed in the month) and read lower than
        // the Team table's for the same rep. Anything that needs confirmations by confirmed date
        // must come through here.
        const confirmedRows = (salesFree) => {
          let out;
          try {
            if (yrOn) RS.state.multi.year = new Set();
            if (moOn) RS.state.multi.month = new Set();
            if (salesFree && spSet0 && spSet0.size) RS.state.multi.sales = new Set();
            out = RS.filtered("lead_journey", bookedOnly, { dateColumn: "Booked Date" });
          } finally {
            if (yrOn) RS.state.multi.year = yrSet;
            if (moOn) RS.state.multi.month = moSet;
            if (salesFree && spSet0 && spSet0.size) RS.state.multi.sales = spSet0;
          }
          return (yrOn || moOn) ? out.filter(r => {
            const bd = String(r["Booked Date"] || "");
            if (yrOn && !yrSet.has(bd.slice(0, 4))) return false;
            if (moOn && !moSet.has(String(+bd.slice(5, 7)))) return false;
            return true;
          }) : out;
        };
        ctx.confRows = confirmedRows(false);

        // ---- peer baseline for the Rep Profile -----------------------------------------
        // The Rep Profile has its own rep selector, so the GLOBAL Sales-Person slicer must
        // not scope it: with one name selected, teamIndex()/the ranking pool collapsed to
        // that rep alone — every "vs team" comparison became self-vs-self (gap 0.0 pts,
        // neutral heat-map, "not enough data"). Build the rep view from sales-unfiltered rows.
        const spSet = RS.state.multi.sales;
        if (spSet && spSet.size) {
          try { RS.state.multi.sales = new Set(); ctx.repRows = RS.filtered("lead_journey", all); }
          finally { RS.state.multi.sales = spSet; }
        } else ctx.repRows = ctx.rows;
        // ...and the matching sales-slicer-free CONFIRMED set, so the Rep Profile shows the
        // same canonical booking rate as the Team table instead of a second, different number.
        ctx.repConfRows = (spSet && spSet.size) ? confirmedRows(true) : ctx.confRows;

        // trend rows: date- AND sales-unfiltered (company/source/etc still apply) so the
        // monthly chart always shows the full history.
        const dF = RS.state.dateFrom, dT = RS.state.dateTo, yS = RS.state.multi.year, mS = RS.state.multi.month;
        try {
          RS.state.dateFrom = null; RS.state.dateTo = null;
          RS.state.multi.year = new Set(); RS.state.multi.month = new Set();
          if (spSet && spSet.size) RS.state.multi.sales = new Set();
          ctx.trendRows = RS.filtered("lead_journey", all);
        } finally {
          RS.state.dateFrom = dF; RS.state.dateTo = dT;
          RS.state.multi.year = yS; RS.state.multi.month = mS;
          if (spSet && spSet.size) RS.state.multi.sales = spSet;
        }
        // rep-stats power the canonical identity + roster status; load once, used by ALL
        // tabs (the Team tab needs it to drop Not-Active reps too).
        if (!ctx.repStats) {
          try {
            const d = await fetch(ZTZ.API + "/api/fct_rep_stats?limit=200",
              { headers: { Authorization: "Bearer " + ZTZ.getToken() } }).then(r => r.json());
            ctx.repStats = d.rows || [];
          } catch (e) { ctx.repStats = []; }
          ctx.repCanon = repCanonMap(ctx.repStats);
          // every raw name (canon + aliases) that belongs to a Not-Active rep
          ctx.inactiveNames = new Set();
          ctx.repStats.forEach(r => {
            if (!/not/i.test(r["Status"] || "")) return;
            ctx.inactiveNames.add((r["Sales Person"] || "").trim().toLowerCase());
            (r["Aliases"] || "").split(",").forEach(a => { a = a.trim().toLowerCase(); if (a) ctx.inactiveNames.add(a); });
          });
        }
        if (k === "team") return renderTeam(hostEl, ctx);
        if (k === "rep") return renderRep(hostEl, ctx);
        return renderExplorer(hostEl, ctx);
      };
      paintTabs();
      // honour the remembered tab — the rep->Explorer jump and any global-filter
      // re-render both rely on this (hardcoding "team" made ST_LAST_TAB dead).
      await go(TABS.some(t => t[0] === active) ? active : "team");
    },
  });
})();
