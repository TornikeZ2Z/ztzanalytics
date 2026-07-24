/* Sales Team Command — the sales LEAD's lead-360 report (report id: sales-command).
   v3 (Tornike 2026-07-23 feedback round):
     - Speed/Inflow tabs REMOVED (they live as their own pages)
     - CONTACT truth: contacted = outbound call OR answered incoming ("we spoke")
     - canonical funnel reused verbatim: Qualified = Status Category !== 'Bad Lead',
       Dead = 'Bad Lead', Confirmed = 'Confirmed' (by confirmed date), RS.bookingRate
     - Estimate -> Actual with the change % everywhere
     - Detailed / Compact toggle on the people table (Money-Flow style), bigger type
     - Lead File drawer MUCH bigger: full closing-sheet section + refunds/claims/reviews
   Global filter bar fully applies. Giorgi Kolbaia (branch owner) excluded from people. */

(() => {
  const EXCLUDE_SP = new Set(["giorgi kolbaia"]);
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
  const contactCell = r => {
    if (+r["Called"]) return r["TTO Biz Min"] != null ? mins(+r["TTO Biz Min"]) : "yes";
    if (isContacted(r)) return `<span class="st-good">in call</span>`;
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
    .st-kpi{position:relative;background:linear-gradient(180deg,var(--panel),var(--panel-2));border:1px solid var(--line);border-radius:16px;padding:18px 20px 17px;box-shadow:var(--shadow);overflow:hidden;transition:transform .16s,box-shadow .16s,border-color .16s}
    .st-kpi::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:linear-gradient(var(--brand),var(--brand-d));opacity:0;transition:opacity .16s}
    .st-kpi:hover{transform:translateY(-2px);border-color:var(--line-2);box-shadow:0 2px 4px rgba(0,0,0,.04),0 18px 42px rgba(0,0,0,.13)}
    .st-kpi:hover::before{opacity:.95}
    .st-kpi .l{font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
    .st-kpi .v{font-size:34px;font-weight:850;color:var(--ink);margin-top:8px;letter-spacing:-.7px;font-variant-numeric:tabular-nums;line-height:1.04}
    .st-kpi .v.st-bad{color:var(--red)} .st-kpi .v.st-good{color:var(--brand-d)}
    .st-kpi .s{font-size:12.5px;color:var(--faint);margin-top:5px}
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
    .rp-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;background:var(--panel-2);gap:1px}
    .rp-stack>div{min-width:2px}
    .rp-trend{display:flex;gap:5px;align-items:flex-end;height:74px;padding-top:6px;overflow-x:auto}
    .rp-mo{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:22px}
    .rp-mo-bars{display:flex;align-items:flex-end;gap:2px;height:48px}
    .rp-mo-l{width:7px;background:var(--blue);border-radius:2px 2px 0 0;min-height:1px}
    .rp-mo-c{width:7px;background:var(--brand);border-radius:2px 2px 0 0;min-height:1px}
    .rp-mo-x{font-size:9px;color:var(--faint);font-variant-numeric:tabular-nums}
    .rp-lg{display:inline-block;width:9px;height:9px;border-radius:2px;vertical-align:middle}
    .rp-lg-l{background:var(--blue)} .rp-lg-c{background:var(--brand)}
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
      ${finCard("Confirmed on", esc((j["Booked Date"] || "—").slice(0, 10)))}
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
        <span style="color:var(--faint);font-size:12px;margin-left:8px">quote range ${money0(num(j["Min Quote"]))} – ${money0(num(j["Max Quote"]))} · ${j["Total CF"] != null ? RS.fmtN(Math.round(+j["Total CF"])) + " CF" : "no CF"}</span></div>`;

    const fin = `<div class="st-sec">Money summary</div><div class="st-fin">
      ${finCard("Net cash", money0(num(j["Net Cash"])))}
      ${finCard("Materials (upsell)", money0(num(j["Material Total"])))}
      ${finCard("Refunded", j["Refund Total"] != null ? money0(+j["Refund Total"]) : "—")}
      ${finCard("Sales people", esc(j["Sales People"] || j["Sales Person"] || "—"), true)}
      ${finCard("Review", j["Review Score"] != null ? (+j["Review Score"]).toFixed(1) + "★" : "—")}
      ${finCard("Claims", j["Claims N"] || "—")}
    </div>`;

    const resp = `<div class="st-sec">Response</div><div class="st-fin">
      ${finCard("First contact", (+j["Called"] ? (j["TTO Biz Min"] != null ? mins(+j["TTO Biz Min"]) + " (biz)" : "called")
                   : (isContacted(j) ? "answered incoming"
                      : (isConf(j) ? "<span class='st-good'>confirmed ✓</span> <span class='st-dim'>" + (+j["Conf After Horizon"] ? "call after data cutoff" : "call not in RC") + "</span>"
                         : (!inWindow(j) ? "<span class='st-dim'>no call data yet</span>" : "<span class='st-bad'>none</span>")))))}
      ${finCard("Calls out / in", (+j["Out Calls"] || 0) + " / " + (+j["In Calls"] || 0))}
      ${finCard("Answered incoming", (+j["Answered In"] || 0))}
      ${finCard("Texts out / in", (+j["Sms Out"] || 0) + " / " + (+j["Sms In"] || 0))}
      ${finCard("Talk time (out)", secH(j["Talk Sec Out"]))}
      ${finCard("Dialers", esc(stripExt(j["Dialers"]) || "—"), true)}
      ${finCard("Last touch", esc((j["Last Touch At"] || "—").slice(0, 16)), true)}
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
  function personStats(rows, confRows, th) {
    const by = {};
    const add = (name, fn) => {
      const k = (name || "Unassigned").trim() || "Unassigned";
      if (EXCLUDE_SP.has(k.toLowerCase())) return;
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
    confRows.forEach(r => add(r["Assigned"], p => { p.confEv++; }));
    const list = Object.values(by);
    list.forEach(p => {
      p.deadPct = p.leads ? 100 * p.dead / p.leads : null;
      p.convPct = p.qual ? Math.min(100, 100 * p.conf / p.qual) : null;    // canonical: conf/QUALIFIED
      p.noContactPct = p.covered ? 100 * (p.covered - p.contacted) / p.covered : null;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
      p.avgGap = p.gaps.length ? p.gaps.reduce((a, b) => a + b, 0) / p.gaps.length : null;
    });
    const ranked = list.filter(p => p.leads >= th.minLeads && p.name !== "Unassigned");
    const mx = {
      conv: Math.max(1e-9, ...ranked.map(p => p.convPct || 0)),
      rev: Math.max(1e-9, ...ranked.map(p => p.revLead || 0)),
    };
    list.forEach(p => {
      if (p.leads < th.minLeads || p.name === "Unassigned") { p.score = null; return; }
      const sConv = (p.convPct || 0) / mx.conv;
      const sSpeed = p.medTto == null ? 0 : Math.max(0, 1 - Math.min(p.medTto, 120) / 120);
      const sRev = (p.revLead || 0) / mx.rev;
      p.score = Math.round(100 * (0.5 * sConv + 0.3 * sSpeed + 0.2 * sRev));
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
    const teamAvgConv = nQual ? 100 * rows.filter(isConf).length / nQual : 0;
    const kpi = (l, v, s) => `<div class="st-kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s || ""}</div></div>`;
    const medAll = median(rows.map(r => r["TTO Biz Min"]).filter(v => v != null).map(Number));
    const covered = rows.filter(inWindow);
    const noContact = covered.length ? 100 * covered.filter(r => !isReached(r)).length / covered.length : null;
    const rev = rows.reduce((a, r) => a + (+r["Total Bill"] || 0), 0);
    const dense = ctx.dense || "detail";

    const people = personStats(rows, confRows, th);
    const flagCell = p => {
      const f = [];
      if (p.noContactPct != null && p.noContactPct > th.neverPct) f.push(`<span class="st-flag r">${Math.round(p.noContactPct)}% NO CONTACT</span>`);
      if (p.medTto != null && p.medTto > th.slowMin) f.push(`<span class="st-flag a">SLOW ${mins(p.medTto)}</span>`);
      if (p.convPct != null && teamAvgConv && p.convPct < th.convFrac * teamAvgConv) f.push(`<span class="st-flag p">LOW CONV</span>`);
      return f.join("") || `<span class="st-good">✓</span>`;
    };

    const DETAIL_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th><th>Dead %</th>
      <th>Confirmed</th><th>Booking %</th><th>Confirms in period</th><th>Median 1st call</th>
      <th>No contact</th><th>Calls</th><th>Talk</th><th>Revenue</th><th>$ / lead</th><th>Δ est→act</th><th>Flags</th>`;
    const COMPACT_COLS = `<th>Salesperson</th><th>Score</th><th>Leads</th><th>Qualified</th>
      <th>Confirmed</th><th>Booking %</th><th>No contact</th><th>Revenue</th><th>Flags</th>`;
    const drow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td>
      <td>${p.deadPct != null ? pct1(p.deadPct) : "—"}</td>
      <td>${RS.fmtN(p.conf)}</td>
      <td>${p.convPct != null ? pct1(p.convPct) : "—"}</td>
      <td>${RS.fmtN(p.confEv)}</td>
      <td>${p.medTto != null ? mins(p.medTto) : "—"}</td>
      <td class="${p.noContactPct > th.neverPct ? "st-bad" : ""}">${p.noContactPct != null ? pct1(p.noContactPct) : "—"}</td>
      <td>${RS.fmtN(p.out)}</td><td>${secH(p.talk)}</td>
      <td>${money0(p.rev)}</td><td>${money0(p.revLead)}</td>
      <td>${p.avgGap != null ? (p.avgGap > 0 ? "+" : "") + pct1(p.avgGap) : "—"}</td>
      <td>${flagCell(p)}</td></tr>`;
    const crow = p => `<tr class="click" data-sp="${esc(p.name)}">
      <td><b>${esc(p.name)}</b></td>
      <td>${p.score != null ? `<b>${p.score}</b>` : `<span style="color:var(--faint)">—</span>`}</td>
      <td>${RS.fmtN(p.leads)}</td><td>${RS.fmtN(p.qual)}</td><td>${RS.fmtN(p.conf)}</td>
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
        ${kpi("Never worked", pct1(noContact), "no call & not confirmed, within call-data coverage")}
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
        <div class="st-note">Click a person to open their leads in the Explorer. Booking % = confirmed ÷ qualified (the portal's canonical formula); "Confirms in period" counts by confirmed date; other columns follow the lead's created date. Branch owner excluded. Call data currently ends at the newest RingCentral export.</div>
      </div>`;

    host.querySelectorAll(".st-seg button").forEach(b => b.onclick = () => { ctx.dense = b.dataset.d; renderTeam(host, ctx); });
    const pop = host.querySelector("#stThPop");
    host.querySelector("#stTh").onclick = e => { e.stopPropagation(); pop.classList.toggle("hidden"); };
    pop.onclick = e => e.stopPropagation();
    document.addEventListener("click", () => pop.classList.add("hidden"), { once: true });
    ["thSlow", "thNever", "thConv", "thMin"].forEach(id => {
      host.querySelector("#" + id).onchange = () => {
        thSet({ slowMin: +host.querySelector("#thSlow").value || 30,
                neverPct: +host.querySelector("#thNever").value || 10,
                convFrac: +host.querySelector("#thConv").value || 0.5,
                minLeads: +host.querySelector("#thMin").value || 5 });
        renderTeam(host, ctx);
      };
    });
    host.querySelectorAll("tr.click").forEach(tr => tr.onclick = () => {
      ctx.explorerPreset = { sp: tr.dataset.sp };
      ctx.go("explorer");
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
          <option value="new">Newest first</option><option value="slow">Slowest first call</option>
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
      if (state.called === "y") rows = rows.filter(isContacted);
      if (state.called === "n") rows = rows.filter(r => !isContacted(r));
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
      if (state.chip === "nocontact") rows = rows.filter(r => inWindow(r) && !isContacted(r));
      if (state.chip === "slow") rows = rows.filter(r => +r["Flag Slow First Call"]);
      if (state.chip === "gap") rows = rows.filter(r => +r["Flag Big Quote Gap"]);
      if (state.chip === "noclose") rows = rows.filter(r => +r["Flag Confirmed No Closing"]);
      if (state.chip === "dead") rows = rows.filter(isDead);
      if (state.chip === "calbad") rows = rows.filter(calMismatch);
      const key = { new: r => r["Create Date"] || "", slow: r => (r["TTO Biz Min"] != null ? +r["TTO Biz Min"] : -1),
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
        if (!isContacted(r) && inWindow(r)) f.push(`<span class="st-flag r">✕ contact</span>`);
        else if (+r["Flag Slow First Call"]) f.push(`<span class="st-flag a">slow</span>`);
        if (+r["Flag Big Quote Gap"]) f.push(`<span class="st-flag p">gap</span>`);
        if (+r["Flag Confirmed No Closing"]) f.push(`<span class="st-flag r">no closing</span>`);
        if (+r["Is LD"]) f.push(`<span class="st-flag b">LD</span>`);
        if (r["Flag"]) f.push(`<span class="st-flag b">${esc(r["Flag"])}</span>`);
        return f.join("");
      };
      host.querySelector("#stTblWrap").innerHTML = `<table class="st-tbl"><thead><tr>
        <th>Created</th><th>#</th><th>Customer</th><th>Source</th><th>Assigned</th><th>CF</th>
        <th>Status</th><th>Contact</th><th>Calls</th><th>Texts</th>
        <th>Estimate → actual</th><th>Flags</th></tr></thead><tbody>` +
        pg.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"])}">
          <td>${esc((r["Create Date"] || "").slice(0, 10))}</td>
          <td>${esc(r["Job No"] || "—")}</td>
          <td><b>${esc(r["Customer"] || "—")}</b></td>
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
    const canonOf = n => cmap[(n || "").trim().toLowerCase()] || (n || "").trim() || "Unassigned";
    const by = {};
    const get = name => (by[name] = by[name] || { name, rows: [], leads: 0, qual: 0, dead: 0, conf: 0,
      closed: 0, rev: 0, net: 0, mat: 0, tto: [], slow: 0, called: 0, reached: 0, covered: 0,
      gaps: [], rev5: [], claims: 0, bySrc: {}, byMonth: {},
      profit: 0, expense: 0, commission: 0, sat5: [], refunds: 0, connLeads: 0,
      confNoClose: 0, deadUnworked: 0 });
    ctx.rows.forEach(r => {
      const c = canonOf(r["Assigned"]);
      if (EXCLUDE_SP.has(c.toLowerCase())) return;
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
      if (inWindow(r)) { p.covered++; if (isReached(r)) p.reached++; }
      if (+r["Flag Slow First Call"]) p.slow++;
      if (isConf(r) && +r["Flag Confirmed No Closing"]) p.confNoClose++;
      if (isDead(r) && !+r["Called"] && inWindow(r)) p.deadUnworked++;
      if (r["Bill Vs Quote Pct"] != null) p.gaps.push(+r["Bill Vs Quote Pct"]);
      if (r["Review Score"] != null) p.rev5.push(+r["Review Score"]);
      p.claims += +r["Claims N"] || 0;
      const s = (r["Source"] || "—").trim() || "—";
      (p.bySrc[s] = p.bySrc[s] || { leads: 0, conf: 0, qual: 0 });
      p.bySrc[s].leads++; if (isQual(r)) p.bySrc[s].qual++; if (isConf(r)) p.bySrc[s].conf++;
      const mo = (r["Create Date"] || "").slice(0, 7);   // "Month" isn't in the cols contract; derive it
      if (mo) { (p.byMonth[mo] = p.byMonth[mo] || { leads: 0, conf: 0 }).leads++; if (isConf(r)) p.byMonth[mo].conf++; }
    });
    const stat = {};
    (ctx.repStats || []).forEach(r => { stat[(r["Sales Person"] || "").toLowerCase()] = r; get(r["Sales Person"] || ""); });
    Object.values(by).forEach(p => {
      p.deadPct = p.leads ? 100 * p.dead / p.leads : null;
      p.bookRate = p.qual ? Math.min(100, 100 * p.conf / p.qual) : null;
      p.medTto = median(p.tto);
      p.revLead = p.leads ? p.rev / p.leads : 0;
      p.upsell = p.closed ? p.mat / p.closed : 0;
      p.avgGap = p.gaps.length ? p.gaps.reduce((a, b) => a + b, 0) / p.gaps.length : null;
      p.avgReview = p.rev5.length ? p.rev5.reduce((a, b) => a + b, 0) / p.rev5.length : null;
      p.slowPct = p.called ? 100 * p.slow / p.called : null;
      // margin & comp efficiency (closed jobs)
      p.margin = p.rev ? 100 * p.profit / p.rev : null;
      p.profitLead = p.leads ? p.profit / p.leads : 0;
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
  function rankOn(book, name, key, dir, elig) {
    const vals = Object.values(book).filter(elig).map(p => ({ n: p.name, v: keyVal(p, key) }))
      .filter(x => x.v != null);
    vals.sort((a, b) => dir === "hi" ? b.v - a.v : a.v - b.v);
    const idx = vals.findIndex(x => x.n === name);
    if (idx < 0) return null;
    return { rank: idx + 1, of: vals.length, pctile: vals.length > 1 ? idx / (vals.length - 1) : 0 };
  }
  const keyVal = (p, key) => key.indexOf("call.") === 0 ? p.call[key.slice(5)] : p[key];

  const METRICS = [
    { key: "bookRate", dir: "hi", label: "Booking rate", fmt: v => pct1(v) },
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
  const _segKey = r => `${dv(r, "Source")}|${dv(r, "CF Range")}|${+r["Is LD"] ? 1 : 0}|${dv(r, "Size of Move")}`;
  function teamIndex(rows) {
    const dim = {}; DIMS.forEach(d => dim[d.key] = {});
    const seg = {};              // mix-adjust segment: Source|CFRange|IsLD|Size
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
      p.name && p.name !== "Unassigned" && !EXCLUDE_SP.has(p.name.toLowerCase()) &&
      (p.leads > 0 || (p.call && (p.call.outDials + p.call.inTotal) > 0)));
    reps.sort((a, b) => b.leads - a.leads || (b.call.outDials + b.call.inTotal) - (a.call.outDials + a.call.inTotal));
    if (!reps.length) { host.innerHTML = `<div class="st-card">No sales reps in the current filter.</div>`; return; }
    if (!ctx.repSel || !reps.some(p => p.name === ctx.repSel)) ctx.repSel = reps[0].name;

    const opts = reps.map(p => `<option value="${esc(p.name)}"${p.name === ctx.repSel ? " selected" : ""}>${esc(p.name)}${p.leads ? " · " + RS.fmtN(p.leads) + " leads" : " · phone only"}</option>`).join("");
    host.innerHTML = `
      <div class="st-bar"><label style="font-weight:750;color:var(--muted);font-size:12.5px">Sales rep</label>
        <select id="rpSel" style="min-width:260px;font-size:14px;font-weight:700">${opts}</select>
        <span style="flex:1"></span>
        <button class="st-chip" id="rpJump">Open their leads in Explorer →</button></div>
      <div id="rpBody"></div>`;
    host.querySelector("#rpSel").onchange = e => { ctx.repSel = e.target.value; renderRep(host, ctx); };
    host.querySelector("#rpJump").onclick = () => jumpToRepLeads(ctx, ctx.repSel);
    paintRep(host.querySelector("#rpBody"), book, ctx.repSel, th, teamIndex(ctx.rows));
  }

  // send the rep's leads to the Lead Explorer via the GLOBAL Sales Person filter (one
  // filter home — no duplicate in-page dropdown). Sets every raw Assigned alias for the
  // canonical rep, remembers the target tab, and re-renders the whole page.
  function jumpToRepLeads(ctx, canon) {
    const cmap = ctx.repCanon || {};
    const aliases = Object.keys(cmap).filter(k => cmap[k].toLowerCase() === canon.toLowerCase());
    const names = new Set();
    ctx.rows.forEach(r => { const a = (r["Assigned"] || "").trim(); if (a && aliases.indexOf(a.toLowerCase()) !== -1) names.add(a); });
    if (!names.size) names.add(canon);
    RS.state.multi.sales = names;
    ST_LAST_TAB = "explorer";
    if (window.renderPage) window.renderPage(); else ctx.go("explorer");
  }

  function paintRep(host, book, name, th, team) {
    const p = book[name], c = p.call;
    const elig = q => q.leads >= th.minLeads;
    const eligCall = q => (q.call.outDials + q.call.inTotal) >= 200;
    const kpi = (l, v, s, cls) => `<div class="st-kpi"><div class="l">${l}</div><div class="v ${cls || ""}">${v}</div><div class="s">${s || ""}</div></div>`;

    // strong sides / watch areas
    const strengths = [], watch = [];
    METRICS.forEach(m => {
      const isCall = m.key.indexOf("call.") === 0;
      const rk = rankOn(book, name, m.key, m.dir, isCall ? eligCall : elig);
      if (!rk || rk.of < 4) return;
      const v = keyVal(p, m.key);
      if (v == null) return;
      const chip = `<div class="rp-str"><span class="rp-str-l">${m.label}</span><span class="rp-str-v">${m.fmt(v)}</span><span class="rp-str-r">#${rk.rank} of ${rk.of}</span></div>`;
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
    const trend = months.length ? `<div class="rp-trend">${months.map(m => {
      const d = p.byMonth[m];
      return `<div class="rp-mo" title="${m}: ${d.leads} leads, ${d.conf} confirmed">
        <div class="rp-mo-bars"><div class="rp-mo-l" style="height:${Math.round(46 * d.leads / maxM)}px"></div>
        <div class="rp-mo-c" style="height:${Math.round(46 * d.conf / maxM)}px"></div></div>
        <div class="rp-mo-x">${m.slice(2)}</div></div>`;
    }).join("")}</div>` : `<div class="st-note">No leads in the selected period.</div>`;
    const srcRows = Object.entries(p.bySrc).sort((a, b) => b[1].leads - a[1].leads).slice(0, 8)
      .map(([s, d]) => `<tr><td>${esc(s)}</td><td style="text-align:right">${RS.fmtN(d.leads)}</td>
        <td style="text-align:right">${d.qual ? pct1(100 * d.conf / d.qual) : "—"}</td></tr>`).join("");

    // ---- mix-adjusted booking (skill vs luck) ----
    let expConf = 0, mixN = 0;
    p.rows.forEach(r => {
      if (!isQual(r)) return;
      mixN++;
      const b = team.seg[team.segKey(r)];
      if (b && b.qual) expConf += b.conf / b.qual;
    });
    const expRate = mixN ? 100 * expConf / mixN : null;
    const gap = (expRate == null || p.bookRate == null) ? null : p.bookRate - expRate;
    const gapCls = gap == null ? "" : gap >= 0 ? "st-good" : "st-bad";
    const mixMax = Math.max(expRate || 0, p.bookRate || 0, 10) * 1.18;
    // per-segment breakdown so the calculation is fully transparent
    const segAgg = {};
    p.rows.forEach(r => {
      if (!isQual(r)) return;
      const k = team.segKey(r);
      const a = (segAgg[k] = segAgg[k] || { qual: 0, conf: 0, label: null });
      a.qual++; if (isConf(r)) a.conf++;
      if (!a.label) a.label = `${dv(r, "Source")} · ${dv(r, "CF Range")} · ${+r["Is LD"] ? "LD" : "Local"} · ${dv(r, "Size of Move")}`;
    });
    const segList = Object.entries(segAgg).map(([k, a]) => {
      const tb = team.seg[k]; const rate = tb && tb.qual ? tb.conf / tb.qual : 0;
      return { label: a.label, qual: a.qual, conf: a.conf, rate, exp: a.qual * rate };
    }).sort((x, y) => y.qual - x.qual);
    const segTop = segList.slice(0, 8);
    const segRest = segList.slice(8).reduce((a, s) => { a.qual += s.qual; a.conf += s.conf; a.exp += s.exp; return a; }, { qual: 0, conf: 0, exp: 0 });
    const calcRow = s => `<tr><td>${esc(s.label)}</td>
      <td style="text-align:right">${RS.fmtN(s.qual)}</td>
      <td style="text-align:right">${pct1(100 * s.rate)}</td>
      <td style="text-align:right;color:var(--muted)">${(Math.round(s.exp * 10) / 10).toFixed(1)}</td>
      <td style="text-align:right;font-weight:700">${RS.fmtN(s.conf)}</td></tr>`;
    const mixCalc = `<details class="rp-calc"><summary>How the expected rate is calculated ▾</summary>
      <div class="st-note" style="margin:8px 0 10px">For every one of ${esc(name.split(" ")[0])}'s <b>${RS.fmtN(mixN)} qualified leads</b>, we take how often the <b>whole team</b> converts that exact segment (Source × Volume × Distance × Size) and add those odds up. That sum is the <b>expected confirms</b> — what an average rep would book from this exact pile of leads. Compare to what they actually booked.</div>
      <div style="overflow-x:auto"><table class="st-tbl rp-dist"><thead><tr>
        <th>Segment — top 8 by volume</th><th style="text-align:right">Qualified</th>
        <th style="text-align:right">Team books</th><th style="text-align:right">Expected</th>
        <th style="text-align:right">Actual</th></tr></thead><tbody>
        ${segTop.map(calcRow).join("")}
        ${segRest.qual ? `<tr><td class="st-dim">+ ${RS.fmtN(segList.length - 8)} smaller segments</td><td style="text-align:right">${RS.fmtN(segRest.qual)}</td><td style="text-align:right" class="st-dim">—</td><td style="text-align:right;color:var(--muted)">${segRest.exp.toFixed(1)}</td><td style="text-align:right;font-weight:700">${RS.fmtN(segRest.conf)}</td></tr>` : ""}
        <tr class="rp-dist-tot"><td>Total</td>
          <td style="text-align:right">${RS.fmtN(mixN)}</td><td></td>
          <td style="text-align:right;font-weight:800;color:var(--muted)">${expConf.toFixed(1)}</td>
          <td style="text-align:right;font-weight:800">${RS.fmtN(p.conf)}</td></tr>
      </tbody></table></div>
      <div class="st-note" style="margin-top:9px"><b>Expected rate</b> = ${expConf.toFixed(1)} expected confirms ÷ ${RS.fmtN(mixN)} qualified = <b>${pct1(expRate)}</b>. &nbsp;<b>Actual rate</b> = ${RS.fmtN(p.conf)} confirms ÷ ${RS.fmtN(mixN)} qualified = <b>${pct1(p.bookRate)}</b>. &nbsp;Difference = <b class="${gapCls}">${gap == null ? "—" : (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts</b> — this is skill above/below the leads they were dealt."}</div>
    </details>`;
    const mixCard = mixN ? `<div class="st-card">
      <div class="rp-cardcap">🎯 Skill vs luck — mix-adjusted booking rate</div>
      <div class="rp-mix">
        <div class="rp-mix-cell"><div class="rp-mix-l">Expected for their lead mix</div><div class="rp-mix-v" style="color:var(--muted)">${pct1(expRate)}</div></div>
        <div class="rp-mix-arrow">→</div>
        <div class="rp-mix-cell"><div class="rp-mix-l">Actual booking rate</div><div class="rp-mix-v">${pct1(p.bookRate)}</div></div>
        <div class="rp-mix-gap ${gapCls}">${gap == null ? "—" : (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts"}</div>
      </div>
      <div class="rp-track" title="Actual ${pct1(p.bookRate)} vs expected ${pct1(expRate)}">
        <div class="rp-track-fill" style="width:${Math.min(100, 100 * (p.bookRate || 0) / mixMax)}%"></div>
        <div class="rp-track-mark" style="left:${Math.min(100, 100 * (expRate || 0) / mixMax)}%" title="Expected ${pct1(expRate)}"></div>
      </div>
      <div class="st-note" style="margin-top:9px">The <b>marker</b> is expected, the <b>bar</b> is actual — bar past the marker = real skill beyond the leads they were handed.</div>
      ${mixCalc}
    </div>` : "";

    // ================= HEAD-OF-SALES ASSESSMENT =================
    // per-rep mix gap (skill), computed across the whole team for ranking
    const repMixGap = q => {
      let e = 0, n = 0;
      q.rows.forEach(r => { if (!isQual(r)) return; n++; const b = team.seg[team.segKey(r)]; if (b && b.qual) e += b.conf / b.qual; });
      return (n && q.bookRate != null) ? q.bookRate - 100 * e / n : null;
    };
    Object.values(book).forEach(q => { if (q.__mg === undefined) q.__mg = repMixGap(q); });
    const eligA = q => q.leads >= th.minLeads && q.name !== "Unassigned" && !EXCLUDE_SP.has(q.name.toLowerCase());
    const good = (fn, dir) => {                 // this rep's percentile (0..1, higher = better)
      const vals = Object.values(book).filter(eligA).map(fn).filter(v => v != null);
      const v = fn(p);
      if (v == null || vals.length < 4) return null;
      return vals.filter(x => dir === "hi" ? x < v : x > v).length / vals.length;
    };
    const AX = [
      { k: "Conversion skill", g: good(q => q.__mg, "hi"), w: 0.30, val: gap == null ? "—" : (gap >= 0 ? "+" : "−") + Math.abs(Math.round(gap * 10) / 10) + " pts",
        strong: "converts above the leads they're dealt", weak: "converts below what their lead mix should yield",
        fix: "Have them shadow a top closer and review their pitch/qualification — the leads are fine, the conversion isn't." },
      { k: "Profit / lead", g: good(q => q.profitLead, "hi"), w: 0.22, val: money0(p.profitLead),
        strong: "builds high-profit jobs", weak: "low profit per lead",
        fix: "Tighten quoting & discount discipline — the revenue may be fine but the margin isn't." },
      { k: "Quality", g: good(q => q.avgReview, "hi"), w: 0.12, val: p.avgReview != null ? p.avgReview.toFixed(1) + "★" : "—",
        strong: "clean, well-reviewed jobs", weak: "review/claims quality risk",
        fix: "Review their claims and over-promising on quotes — durable revenue beats booked revenue." },
      { k: "First-call speed", g: good(q => q.medTto, "lo"), w: 0.14, val: p.medTto != null ? mins(p.medTto) : "—",
        strong: "fast to the phone", weak: "slow to make first contact",
        fix: "Hold them to the speed SLA — target under 30 min; slow first calls quietly lose winnable jobs." },
      { k: "Call effort", g: good(q => q.call.outConnRate, "hi"), w: 0.14, val: p.call.outConnRate != null ? pct1(p.call.outConnRate) : "—",
        strong: "strong phone connect rate", weak: "weak call connect / activity",
        fix: "Put accountability on dials & connect rate — low activity is the easiest gap to close." },
      { k: "Lead qualification", g: good(q => q.deadPct, "lo"), w: 0.08, val: pct1(p.deadPct),
        strong: "qualifies well (low dead share)", weak: "high dead-lead share",
        fix: "Audit their dead-lead marks — are reachable leads being written off to protect booking rate?" },
    ];
    let ws = 0, sc = 0; AX.forEach(a => { if (a.g != null) { sc += a.w * a.g; ws += a.w; } });
    const score = ws ? Math.round(100 * sc / ws) : null;
    const enough = p.leads >= Math.max(th.minLeads, 20);
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
    else if (strongAx[0] && weakAx[0]) summary = `Strong on ${strongAx[0].strong}${strongAx[1] ? " and " + strongAx[1].strong : ""}, but ${weakAx[0].weak}.`;
    else if (strongAx[0]) summary = `Strong on ${strongAx[0].strong}${strongAx[1] ? " and " + strongAx[1].strong : ""} — no major weak spots.`;
    else if (weakAx[0]) summary = `Underperforming — ${weakAx[0].weak}${weakAx[1] ? ", and " + weakAx[1].weak : ""}.`;
    else summary = `A balanced, middle-of-the-pack profile — no standout strengths or weaknesses.`;
    const actions = [];
    if (AX[0].g != null && gap != null && gap > 1.5 && AX[0].g >= 0.6)
      actions.push("<b>Feed them more volume</b> — they convert above their lead mix. Route more of their green segments (see the distribution below).");
    weakAx.slice(0, 3).forEach(a => actions.push(a.fix));
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
        <div><div class="rp-cap">Doing well</div>${bullets(strongAx, a => `<li><b>${esc(a.k)}</b> — ${a.strong} <span class="st-dim">(${a.val})</span></li>`)}</div>
        <div><div class="rp-cap">Needs work</div>${bullets(weakAx, a => `<li><b>${esc(a.k)}</b> — ${a.weak} <span class="st-dim">(${a.val})</span></li>`)}</div>
        <div><div class="rp-cap">What I'd do</div><ul class="rp-alist">${actions.map(x => `<li>${x}</li>`).join("")}</ul></div>
      </div>
      <div class="st-note">Score blends conversion skill (mix-adjusted, 30%), profit/lead (22%), quality (12%), first-call speed (14%), call effort (14%) and qualification (8%), each ranked against the team. It's a starting read, not a verdict on its own — click through the panels below before acting.</div>
    </div>`;

    // ---- margin & commission ----
    const marginCard = `<div class="st-card">
      <div class="rp-cardcap">💰 Margin & commission — the profit behind the revenue</div>
      <div class="st-kpis" style="grid-template-columns:repeat(4,1fr);margin-top:2px">
        ${kpi("Gross profit", money0(p.profit), p.margin != null ? pct1(p.margin) + " margin" : "")}
        ${kpi("Profit / lead", money0(p.profitLead), "revenue/lead " + money0(p.revLead))}
        ${kpi("Commission paid", money0(p.commission), p.commPerKRev != null ? money0(p.commPerKRev) + " / $1k rev" : "")}
        ${kpi("Net revenue", money0(p.netRev), p.refunds ? "after " + money0(p.refunds) + " refunds" : "no refunds")}
      </div>
      <div class="st-note">Gross profit &amp; margin from the closing sheet.${p.commPerKProfit != null ? " Commission costs " + money0(p.commPerKProfit) + " per $1k of gross profit." : ""}${p.avgSat != null ? " Internal satisfaction " + p.avgSat.toFixed(1) + "/10." : ""}</div>
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
    const eligReps = Object.values(book).filter(q => q.leads >= th.minLeads);
    const mean = f => { const v = eligReps.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    const tVanity = mean(q => q.vanityPct), tDeadU = mean(q => q.deadUnworkedPct),
          tGap = mean(q => q.avgGap), tTto = mean(q => q.medTto), tTPO = mean(q => q.talkPerOut);
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
      chk("Chronic under-quoting", p.avgGap, tGap,
        p.avgGap != null && tGap != null && p.avgGap > tGap + 6 && p.avgGap > 8,
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
        ${kpi("Confirmed", RS.fmtN(p.conf), "booking rate " + (p.bookRate != null ? pct1(p.bookRate) : "—"))}
        ${kpi("Median 1st call", p.medTto != null ? mins(p.medTto) : "—", "business time to first call")}
        ${kpi("Revenue", money0(p.rev), money0(p.revLead) + " / lead")}
        ${kpi("Upsell / job", money0(p.upsell), "materials on closed jobs")}
        ${kpi("Review score", p.avgReview != null ? p.avgReview.toFixed(1) + "★" : "—", p.claims ? p.claims + " claim(s)" : "no claims")}
      </div>

      <div class="rp-cols">${mixCard}${marginCard}</div>

      <div class="rp-cols">
        <div class="st-card">
          <div class="rp-cardcap">📞 Inbound from their leads — when a lead of ${esc(name.split(" ")[0])}'s called in</div>
          <div class="st-kpis" style="grid-template-columns:repeat(3,1fr);margin:2px 0 10px">
            ${kpi("Calls received", RS.fmtN(c.inTotal), "from their own leads")}
            ${kpi("Answered", RS.fmtN(c.inAcc), c.inAcceptRate != null ? pct1(c.inAcceptRate) + " answer rate" : "", "st-good")}
            ${kpi("Not answered", RS.fmtN(c.inMiss), "missed / to voicemail", c.inMiss > c.inAcc ? "st-bad" : "")}
          </div>
          ${inBar}
          <div class="st-note" style="margin-top:8px">Avg answered call ${secH(c.avgIn)} · total talk ${secH(c.inTalk)} · <span class="st-dim">matched to their leads within the call-data window</span></div>
        </div>
        <div class="st-card">
          <div class="rp-cardcap">☎️ Outbound — dials this rep made</div>
          <div class="st-kpis" style="grid-template-columns:repeat(3,1fr);margin:2px 0 10px">
            ${kpi("Dials", RS.fmtN(c.outDials), "all-time (RingCentral)")}
            ${kpi("Connected", RS.fmtN(c.outConn), c.outConnRate != null ? pct1(c.outConnRate) + " connect rate" : "", "st-good")}
            ${kpi("Texts sent", RS.fmtN(c.smsOut), "outbound SMS")}
          </div>
          <div class="st-note">Avg connected call ${secH(c.avgOut)} · total talk ${secH(c.outTalk)}</div>
          ${watch.length ? `<div class="rp-watch"><div class="rp-cap">Watch areas</div>${watch.slice(0, 3).map(x => x.chip).join("")}</div>` : ""}
        </div>
      </div>

      ${distCard}

      ${integrityCard}

      <div class="rp-cols">
        <div class="st-card"><div class="rp-cardcap">Monthly — leads <span class="rp-lg rp-lg-l"></span> &nbsp; confirmed <span class="rp-lg rp-lg-c"></span></div>${trend}</div>
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
    title: "Sales Team Command",
    async render(host) {
      injectStyle();
      host.innerHTML = `<div class="st-page">
        <div class="rs-page-head"><h1>Sales Team Command</h1>
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
        // only REAL confirmed dates count (mart stores Booked Date only for confirmed leads)
        ctx.confRows = RS.filtered("lead_journey",
          all.filter(r => /^\d{4}-\d{2}-\d{2}/.test(String(r["Booked Date"] || ""))),
          { dateColumn: "Booked Date" });
        if (k === "team") return renderTeam(hostEl, ctx);
        if (k === "rep") {
          if (!ctx.repStats) {
            try {
              const d = await fetch(ZTZ.API + "/api/fct_rep_stats?limit=200",
                { headers: { Authorization: "Bearer " + ZTZ.getToken() } }).then(r => r.json());
              ctx.repStats = d.rows || [];
              ctx.repCanon = repCanonMap(ctx.repStats);
            } catch (e) { ctx.repStats = []; ctx.repCanon = {}; }
          }
          return renderRep(hostEl, ctx);
        }
        return renderExplorer(hostEl, ctx);
      };
      paintTabs();
      await go("team");
    },
  });
})();
