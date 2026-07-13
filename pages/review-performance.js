/* REVIEWS page: Foreman Weekly Review Performance — a Foreman × Week-Ending matrix of
   "R reviews / J eligible jobs = %", color-coded. Click a cell → a right-side DRAWER slides in
   with the jobs behind it AND where each review was written (per-platform breakdown).
   Numerator = SUM(reviews) on ELIGIBLE jobs; denominator = eligible jobs (completed minus any
   support intervention). Built on fct_job_overview. Read-only.
   Controls: multi-select filters (source/status/bill/foreman), an adjustable time window
   (weeks + step back/forward), and click-a-week-header to sort foremen by that week. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_job_overview) {
    RS.DATASETS.fct_job_overview = {
      table: "fct_job_overview",
      cols: [
        "Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Company", "Job Source",
        "Job Type", "Delivery State", "Estimate Bill", "Actual Bill", "Final Packing",
        "Bill Increase Amount", "Bill Increase %", "Bill Increase Category", "Review Received",
        "Number of Reviews", "Review Source", "Review Breakdown", "Eligible", "Support Intervention",
        "Support Intervention Date", "Support Intervention Type", "Support Intervention Reason",
        "Support Notes", "Review Expected", "Exclusion Reason", "Foreman Response Received",
        "Foreman Explanation", "Final Status", "Request Joinkey", "Event ID", "Closing Unique Key",
      ],
    };
  }
})();

// review-% color bands (per the spec)
var RP_BANDS = [
  { max: 50,       bg: "#dc2626", fg: "#fff",     label: "Below 50%" },
  { max: 100,      bg: "#fecaca", fg: "#991b1b",  label: "50–99%" },
  { max: 100.0001, bg: "#e5e7eb", fg: "#374151",  label: "100%" },
  { max: 200,      bg: "#bbf7d0", fg: "#166534",  label: "101–199%" },
  { max: Infinity, bg: "#16a34a", fg: "#fff",     label: "≥200%" },
];
var RP_WEEK_OPTS = [8, 12, 26, 52];
// per-platform brand tints for the drawer chips (family = first word of the source name)
var RP_PLAT = { Google: "#4285F4", Yelp: "#d32323", Angi: "#1aa64b", Trustpilot: "#00b67a",
  Facebook: "#1877f2", Consumer: "#6d28d9", Birdeye: "#f59e0b", BBB: "#0a4d8c", Thumbtack: "#009fd9",
  Nextdoor: "#5aa700", Unpakt: "#e11d48", Mymovingreviews: "#0ea5e9" };
// component state persists across re-renders within the session
var RP = { sources: new Set(), statuses: new Set(), billcats: new Set(), foremen: new Set(),
  weeks: 12, offset: 0, sortWk: null, sortDir: "desc", cell: null };

registerPage({
  id: "review-performance",
  group: "reviews",
  title: "Review Performance",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var num = function (v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isFinite(n) ? n : 0; };
    var money = function (v) { var s = String(v == null ? "" : v).trim(); if (s === "") return "—"; return "$" + Math.round(num(v)).toLocaleString(); };
    var yes = function (v) { return String(v).trim().toLowerCase() === "yes"; };
    var band = function (pct) { for (var i = 0; i < RP_BANDS.length; i++) if (pct < RP_BANDS[i].max) return RP_BANDS[i]; return RP_BANDS[RP_BANDS.length - 1]; };
    var MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var shortD = function (iso) { iso = String(iso || ""); if (iso.length < 10) return iso; return MONTHS[+iso.slice(5, 7)] + " " + (+iso.slice(8, 10)); };
    var platColor = function (src) { return RP_PLAT[String(src).split(" ")[0]] || "#6b7280"; };
    var parseBk = function (s) {
      if (!s) return [];
      return String(s).split("¦").map(function (p) {
        var i = p.lastIndexOf("§"); if (i < 0) return null;
        return { src: p.slice(0, i), n: parseInt(p.slice(i + 1), 10) || 0 };
      }).filter(Boolean);
    };

    if (!document.getElementById("rp-style")) {
      var st = document.createElement("style"); st.id = "rp-style";
      st.textContent = `
        .rp-head{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;padding:2px 2px 0}
        .rp-head h1{margin:0;font-size:19px;font-weight:800;letter-spacing:-.01em}
        .rp-head p{margin:0;color:var(--muted);font-size:12.5px}
        .rp-bar{position:sticky;top:0;z-index:6;display:flex;flex-wrap:wrap;gap:8px;align-items:center;
          padding:10px 0;margin-top:6px;background:var(--bg,var(--panel));border-bottom:1px solid var(--line)}
        .rp-kpis{display:flex;gap:8px;overflow-x:auto;padding:2px 0 10px;scrollbar-width:thin}
        .rp-kpi{flex:0 0 auto;min-width:112px;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:8px 12px}
        .rp-kpi b{display:block;font-size:19px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
        .rp-kpi span{display:block;font-size:10px;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;font-weight:700;margin-top:3px}
        .rp-kpi small{display:block;font-size:10.5px;color:var(--muted);margin-top:1px}
        .rp-kpi.accent b{color:var(--brand)}
        /* time stepper */
        .rp-time{display:inline-flex;align-items:center;gap:1px;background:var(--panel-2);border:1px solid var(--line-2);border-radius:10px;padding:2px}
        .rp-time button{border:0;background:transparent;color:var(--ink);cursor:pointer;font-size:14px;line-height:1;padding:5px 9px;border-radius:8px}
        .rp-time button:hover:not(:disabled){background:var(--panel)}
        .rp-time button:disabled{opacity:.3;cursor:default}
        .rp-time select{border:0;background:transparent;color:var(--ink);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer;outline:none;padding:0 2px}
        .rp-range{font-size:11px;color:var(--muted);white-space:nowrap}
        /* multi-select */
        .rp-ms-wrap{position:relative}
        .rp-ms{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:10px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:12.5px;font-family:inherit;cursor:pointer;outline:none}
        .rp-ms:hover,.rp-ms.on{border-color:var(--brand)}
        .rp-ms .lb{font-weight:600}
        .rp-ms .ct{background:var(--brand);color:#fff;font-size:10.5px;font-weight:800;border-radius:999px;padding:1px 7px;min-width:18px;text-align:center}
        .rp-ms .all{color:var(--faint);font-size:11.5px}
        .rp-ms .cv{opacity:.5;font-size:10px;margin-left:-2px}
        .rp-pop{position:absolute;z-index:30;top:calc(100% + 5px);left:0;min-width:210px;max-width:280px;background:var(--panel);
          border:1px solid var(--line-2);border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.18);padding:8px}
        .rp-pop.hidden{display:none}
        .rp-pop-s{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:8px;border:1px solid var(--line-2);
          background:var(--panel-2);color:var(--ink);font-size:12.5px;font-family:inherit;outline:none;margin-bottom:6px}
        .rp-pop-act{display:flex;gap:6px;margin-bottom:6px}
        .rp-pop-act button{flex:1;border:1px solid var(--line-2);background:var(--panel-2);color:var(--muted);font-size:11px;font-weight:700;
          border-radius:7px;padding:5px;cursor:pointer;font-family:inherit}
        .rp-pop-act button:hover{border-color:var(--brand);color:var(--ink)}
        .rp-pop-list{max-height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:1px}
        .rp-pop-i{display:flex;align-items:center;gap:8px;padding:6px 7px;border-radius:7px;cursor:pointer;font-size:12.5px}
        .rp-pop-i:hover{background:var(--panel-2)}
        .rp-pop-i input{accent-color:var(--brand);width:15px;height:15px;flex:0 0 auto}
        .rp-pop-i span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rp-pop-none{color:var(--faint);font-size:12px;padding:8px 7px}
        .rp-spring{flex:1 1 auto}
        .rp-btn{padding:7px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:12.5px;font-family:inherit;cursor:pointer}
        .rp-btn:hover{border-color:var(--brand)}
        /* matrix */
        .rp-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;max-height:calc(100vh - 232px)}
        .rp-mx{border-collapse:separate;border-spacing:0;font-size:12px;min-width:560px}
        .rp-mx th,.rp-mx td{padding:0;text-align:center;white-space:nowrap;box-sizing:border-box}
        .rp-mx thead th{background:var(--panel-2);color:var(--faint);font-size:10.5px;font-weight:800;text-transform:uppercase;
          letter-spacing:.03em;padding:8px 6px;position:sticky;top:0;border-bottom:1px solid var(--line);cursor:pointer;z-index:1}
        .rp-mx thead th:hover{color:var(--ink)}
        .rp-mx thead th.srt{color:var(--brand)}
        .rp-mx th.fm,.rp-mx td.fm{position:sticky;left:0;background:var(--panel);text-align:left;padding:6px 12px;font-weight:600;
          font-size:12.5px;width:172px;min-width:172px;max-width:172px;overflow:hidden;text-overflow:ellipsis;border-right:1px solid var(--line);z-index:1}
        .rp-mx thead th.fm{z-index:3;cursor:pointer}
        .rp-mx th.tot,.rp-mx td.tot{position:sticky;left:172px;background:var(--panel);border-right:2px solid var(--line);z-index:1;width:76px;min-width:76px}
        .rp-mx thead th.tot{z-index:3}
        .rp-mx td.tot .rp-cell{cursor:default}
        .rp-cell{display:block;margin:2px;padding:6px 4px;border-radius:7px;font-weight:700;font-size:11.5px;cursor:pointer;line-height:1.24;min-width:72px}
        .rp-cell small{display:block;font-weight:600;opacity:.82;font-size:10px}
        .rp-cell.na{cursor:default}
        .rp-cell.sel{outline:2px solid var(--ink);outline-offset:-2px}
        .rp-legend{display:flex;flex-wrap:wrap;gap:9px;font-size:11px;color:var(--muted);padding:9px 2px 4px}
        .rp-legend span{display:inline-flex;align-items:center;gap:5px}.rp-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
        /* drawer */
        .rp-scrim{position:fixed;inset:0;background:rgba(15,23,42,.12);z-index:50;opacity:0;transition:opacity .2s;pointer-events:none}
        .rp-scrim.show{opacity:1}
        .rp-drawer{position:fixed;top:0;right:0;height:100vh;width:min(468px,94vw);background:var(--panel);z-index:51;
          box-shadow:-18px 0 48px rgba(0,0,0,.24);transform:translateX(100%);transition:transform .24s cubic-bezier(.4,0,.2,1);
          display:flex;flex-direction:column}
        .rp-drawer.show{transform:none}
        .rp-dhd{padding:16px 18px 12px;border-bottom:1px solid var(--line);position:relative}
        .rp-dhd .x{position:absolute;top:12px;right:12px;border:0;background:var(--panel-2);color:var(--muted);width:30px;height:30px;
          border-radius:9px;cursor:pointer;font-size:16px;line-height:1}
        .rp-dhd .x:hover{color:var(--ink)}
        .rp-dhd .fm{font-size:16px;font-weight:800;letter-spacing:-.01em}
        .rp-dhd .wk{font-size:12px;color:var(--muted);margin-top:1px}
        .rp-dhd .big{display:flex;align-items:baseline;gap:8px;margin-top:9px}
        .rp-dhd .big b{font-size:26px;font-weight:800;letter-spacing:-.02em}
        .rp-dhd .big em{font-style:normal;font-size:12.5px;color:var(--muted)}
        .rp-dbody{overflow-y:auto;padding:12px 16px 40px;flex:1}
        .rp-sec{font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--faint);margin:6px 2px 8px}
        .rp-roll{display:flex;flex-direction:column;gap:5px;margin-bottom:14px}
        .rp-roll .row{display:flex;align-items:center;gap:8px;font-size:12px}
        .rp-roll .nm{flex:0 0 128px;display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .rp-roll .dot{width:8px;height:8px;border-radius:2px;flex:0 0 auto}
        .rp-roll .bar{flex:1;height:8px;border-radius:999px;background:var(--panel-2);overflow:hidden}
        .rp-roll .bar i{display:block;height:100%;border-radius:999px}
        .rp-roll .vn{flex:0 0 auto;font-weight:800;font-size:12px;min-width:18px;text-align:right}
        .rp-jc{border:1px solid var(--line);border-radius:11px;padding:11px 12px;margin-bottom:9px;background:var(--panel)}
        .rp-jc.excl{opacity:.72;background:var(--panel-2)}
        .rp-jc .top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px}
        .rp-jc .jn{font-weight:800;font-size:13px}
        .rp-jc .cust{color:var(--muted);font-size:12.5px;overflow:hidden;text-overflow:ellipsis}
        .rp-jc .meta{font-size:11.5px;color:var(--muted);margin:5px 0 7px;display:flex;gap:10px;flex-wrap:wrap}
        .rp-jc .meta b{color:var(--ink);font-weight:700}
        .rp-plats{display:flex;flex-wrap:wrap;gap:5px}
        .rp-plat{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;
          color:#fff;line-height:1.3}
        .rp-plat b{font-weight:800}
        .rp-none{font-size:11.5px;font-weight:700;color:#b91c1c;background:rgba(220,38,38,.1);padding:3px 9px;border-radius:999px;display:inline-block}
        .rp-expl{font-size:11.5px;color:var(--muted);margin-top:7px;padding-top:7px;border-top:1px dashed var(--line)}
        .rp-expl b{color:var(--ink)}
        .rp-pill{display:inline-block;font-size:10px;font-weight:800;padding:2px 7px;border-radius:999px;white-space:nowrap}
        .p-rev{background:rgba(22,163,74,.16);color:#15803d}.p-miss{background:rgba(220,38,38,.13);color:#b91c1c}
        .p-excl{background:var(--panel-2);color:var(--muted)}.p-pend{background:rgba(217,119,6,.15);color:#b45309}
        .p-high{background:rgba(220,38,38,.13);color:#b91c1c}.p-att{background:rgba(217,119,6,.15);color:#b45309}
        @media (max-width:640px){.rp-wrap{max-height:calc(100vh - 300px)}}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="rp-head">
        <h1>Review Performance</h1>
        <p>Reviews generated per foreman each week · <b>reviews ÷ eligible jobs</b> · target 100% · click a cell for the jobs and where each review came from →</p>
      </div>
      <div class="rp-kpis" id="rpKpis"><div class="rs-loading">Loading jobs…</div></div>
      <div class="rp-bar" id="rpBar"></div>
      <div class="rp-legend" id="rpLegend"></div>
      <div class="rp-wrap"><div id="rpMatrix"></div></div>`;

    var rows;
    try { rows = await RS.load("fct_job_overview"); }
    catch (e) { document.getElementById("rpKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("rpMatrix")) return;

    var allWeeks = [...new Set(rows.map(r => String(r["Week Ending"] || "").slice(0, 10)).filter(Boolean))].sort().reverse();
    var sources = [...new Set(rows.map(r => r["Job Source"]).filter(Boolean))].sort();
    var statuses = [...new Set(rows.map(r => r["Final Status"]).filter(Boolean))].sort();
    var billcats = ["Normal", "Attention", "High Increase", "Estimate Missing"];
    var foremenAll = [...new Set(rows.map(r => r["Foreman"]).filter(Boolean))].sort();

    document.getElementById("rpLegend").innerHTML = RP_BANDS.map(b => `<span><i style="background:${b.bg}"></i>${b.label}</span>`).join("") +
      `<span><i style="background:#f3f4f6;border:1px solid var(--line)"></i>no eligible jobs</span>`;

    // ---- multi-select popover component ----
    var barEl = document.getElementById("rpBar");
    var openPops = [];
    function closePops(except) { openPops.forEach(p => { if (p.el !== except) p.el.classList.add("hidden"); }); }
    document.addEventListener("click", function docClk(e) {
      if (!barEl.isConnected) { document.removeEventListener("click", docClk); return; }  // this render is gone
      if (!e.target.closest(".rp-ms-wrap")) closePops(null);
    });
    function mkMulti(mount, cfg) {
      // cfg: {label, options:[{v,label}], sel:Set, search:bool, onChange}
      var wrap = document.createElement("div"); wrap.className = "rp-ms-wrap";
      var btn = document.createElement("button"); btn.type = "button"; btn.className = "rp-ms";
      var pop = document.createElement("div"); pop.className = "rp-pop hidden";
      wrap.appendChild(btn); wrap.appendChild(pop); mount.appendChild(wrap);
      openPops.push({ el: pop });
      function paintBtn() {
        var n = cfg.sel.size;
        var right = n === 0 ? `<span class="all">All</span>`
          : n === 1 ? `<span class="ct">1</span>` : `<span class="ct">${n}</span>`;
        btn.classList.toggle("on", n > 0);
        btn.innerHTML = `<span class="lb">${esc(cfg.label)}</span>${right}<span class="cv">▾</span>`;
      }
      function renderList(q) {
        q = (q || "").toLowerCase();
        var opts = cfg.options.filter(o => !q || o.label.toLowerCase().indexOf(q) >= 0);
        var list = pop.querySelector(".rp-pop-list");
        list.innerHTML = opts.length
          ? opts.map(o => `<label class="rp-pop-i"><input type="checkbox" value="${esc(o.v)}"${cfg.sel.has(o.v) ? " checked" : ""}><span>${esc(o.label)}</span></label>`).join("")
          : `<div class="rp-pop-none">No matches.</div>`;
        list.querySelectorAll(".rp-pop-i input").forEach(c => c.onchange = () => {
          if (c.checked) cfg.sel.add(c.value); else cfg.sel.delete(c.value);
          paintBtn(); cfg.onChange();
        });
      }
      function buildPop() {
        // shell built once per open; only the list re-renders while typing, so the search
        // <input> keeps its identity + caret position (no jump-to-end on every keystroke)
        pop.innerHTML =
          (cfg.search ? `<input class="rp-pop-s" type="text" placeholder="Search ${esc(cfg.label.toLowerCase())}…" autocomplete="off">` : "") +
          `<div class="rp-pop-act"><button type="button" data-a="all">Select all</button><button type="button" data-a="clear">Clear</button></div>` +
          `<div class="rp-pop-list"></div>`;
        var s = pop.querySelector(".rp-pop-s");
        if (s) s.oninput = () => renderList(s.value);
        pop.querySelectorAll(".rp-pop-act button").forEach(b => b.onclick = () => {
          var q = (s ? s.value : "").toLowerCase();
          if (b.dataset.a === "clear") cfg.sel.clear();
          else cfg.options.filter(o => !q || o.label.toLowerCase().indexOf(q) >= 0).forEach(o => cfg.sel.add(o.v));  // "select all" respects the search
          renderList(s ? s.value : ""); paintBtn(); cfg.onChange();
        });
        renderList("");
      }
      btn.onclick = e => {
        e.stopPropagation();
        var wasOpen = !pop.classList.contains("hidden");
        closePops(pop);
        if (wasOpen) { pop.classList.add("hidden"); return; }
        buildPop(); pop.classList.remove("hidden");
        var s = pop.querySelector(".rp-pop-s"); if (s) setTimeout(() => s.focus(), 0);
      };
      pop.onclick = e => e.stopPropagation();
      paintBtn();
      return { paintBtn };
    }

    // ---- toolbar ----
    var bar = document.getElementById("rpBar");
    var timeWrap = document.createElement("div"); timeWrap.className = "rp-time";
    timeWrap.innerHTML = `<button type="button" id="rpOlder" title="Older weeks">‹</button>
      <select id="rpWeeks">${RP_WEEK_OPTS.map(w => `<option value="${w}"${w === RP.weeks ? " selected" : ""}>${w} weeks</option>`).join("")}</select>
      <button type="button" id="rpNewer" title="Newer weeks">›</button>`;
    bar.appendChild(timeWrap);
    var rangeLbl = document.createElement("span"); rangeLbl.className = "rp-range"; rangeLbl.id = "rpRange";
    bar.appendChild(rangeLbl);
    var msControls = [
      mkMulti(bar, { label: "Source", options: sources.map(s => ({ v: s, label: s })), sel: RP.sources, search: true, onChange: repaint }),
      mkMulti(bar, { label: "Status", options: statuses.map(s => ({ v: s, label: s })), sel: RP.statuses, search: false, onChange: repaint }),
      mkMulti(bar, { label: "Bill", options: billcats.map(s => ({ v: s, label: s })), sel: RP.billcats, search: false, onChange: repaint }),
      mkMulti(bar, { label: "Foreman", options: foremenAll.map(s => ({ v: s, label: s })), sel: RP.foremen, search: true, onChange: repaint }),
    ];
    var spring = document.createElement("span"); spring.className = "rp-spring"; bar.appendChild(spring);
    var resetBtn = document.createElement("button"); resetBtn.type = "button"; resetBtn.className = "rp-btn"; resetBtn.textContent = "Reset";
    var csvBtn = document.createElement("button"); csvBtn.type = "button"; csvBtn.className = "rp-btn"; csvBtn.innerHTML = "⬇ CSV";
    bar.appendChild(resetBtn); bar.appendChild(csvBtn);

    function inSet(set, v) { return set.size === 0 || set.has(v); }
    function filtered() {
      return rows.filter(r =>
        inSet(RP.sources, r["Job Source"]) &&
        inSet(RP.statuses, r["Final Status"]) &&
        inSet(RP.billcats, r["Bill Increase Category"]) &&
        inSet(RP.foremen, r["Foreman"]));
    }
    function windowWeeks() {
      var start = Math.min(RP.offset, Math.max(0, allWeeks.length - RP.weeks));
      return allWeeks.slice(start, start + RP.weeks);   // newest→oldest
    }

    // ---- drawer ----
    var scrim = document.createElement("div"); scrim.className = "rp-scrim";
    var drawer = document.createElement("div"); drawer.className = "rp-drawer";
    host.appendChild(scrim); host.appendChild(drawer);
    function closeDrawer() {
      scrim.classList.remove("show"); drawer.classList.remove("show");
      RP.cell = null;
      var m = document.getElementById("rpMatrix"); if (m) m.querySelectorAll(".rp-cell.sel").forEach(el => el.classList.remove("sel"));
    }
    // non-modal: the scrim is a click-through dim (pointer-events:none) so the matrix stays
    // interactive — the user drills cell→cell with the drawer updating in place. Close via
    // the ✕ button, Escape, or clicking the already-selected cell again.
    document.addEventListener("keydown", function esckey(e) {
      if (!drawer.isConnected) { document.removeEventListener("keydown", esckey); return; }  // this render is gone
      if (e.key === "Escape" && drawer.classList.contains("show")) closeDrawer();
    });

    function drill(fm, wk) {
      var jobs = filtered().filter(r => (r["Foreman"] || "—") === fm && String(r["Week Ending"]).slice(0, 10) === wk)
        .sort((a, b) => num(b["Number of Reviews"]) - num(a["Number of Reviews"]) || num(b["Eligible"]) - num(a["Eligible"]) || String(a["Job Date"]).localeCompare(String(b["Job Date"])));
      var R = jobs.filter(r => num(r["Eligible"]) === 1).reduce((s, r) => s + num(r["Number of Reviews"]), 0);
      var J = jobs.filter(r => num(r["Eligible"]) === 1).length;
      var pct = J ? Math.round(R / J * 100) : 0, b = band(pct);

      // week-level platform rollup (across all this foreman's jobs that week)
      var roll = {};
      jobs.forEach(r => parseBk(r["Review Breakdown"]).forEach(p => { roll[p.src] = (roll[p.src] || 0) + p.n; }));
      var rollArr = Object.keys(roll).map(k => ({ src: k, n: roll[k] })).sort((a, b) => b.n - a.n);
      var rollMax = rollArr.reduce((m, x) => Math.max(m, x.n), 0);
      var rollTot = rollArr.reduce((s, x) => s + x.n, 0);
      var rollHtml = rollArr.length ? `<div class="rp-sec">Where the reviews came from · ${rollTot} total</div><div class="rp-roll">` +
        rollArr.map(x => `<div class="row"><span class="nm"><i class="dot" style="background:${platColor(x.src)}"></i>${esc(x.src)}</span>
          <span class="bar"><i style="width:${rollMax ? Math.round(x.n / rollMax * 100) : 0}%;background:${platColor(x.src)}"></i></span>
          <span class="vn">${x.n}</span></div>`).join("") + `</div>`
        : `<div class="rp-sec">Where the reviews came from</div><div class="rp-none" style="margin:0 2px 14px">No reviews written for these jobs yet</div>`;

      var stPill = s => {
        var m = { "Review Received": "p-rev", "Multiple Reviews Received": "p-rev", "Excluded – Support Intervention": "p-excl",
          "Review Match Pending": "p-pend", "Missing Review – Explanation Received": "p-att",
          "Missing Review – Waiting for Response": "p-miss", "Missing Review – No Explanation": "p-miss", "Data Missing": "p-excl" };
        return `<span class="rp-pill ${m[s] || "p-excl"}">${esc(s)}</span>`;
      };
      var billPill = c => c === "High Increase" ? `<span class="rp-pill p-high">High +bill</span>`
        : c === "Attention" ? `<span class="rp-pill p-att">+bill</span>` : "";

      var cards = jobs.map(r => {
        var elig = num(r["Eligible"]) === 1;
        var bk = parseBk(r["Review Breakdown"]);
        var revHtml = bk.length
          ? `<div class="rp-plats">` + bk.map(p => `<span class="rp-plat" style="background:${platColor(p.src)}">${esc(p.src)}${p.n > 1 ? ` <b>×${p.n}</b>` : ""}</span>`).join("") + `</div>`
          : `<span class="rp-none">No review written</span>`;
        var dpct = r["Bill Increase %"] == null || r["Bill Increase %"] === "" ? null : num(r["Bill Increase %"]);
        var expl = elig ? "" : `<div class="rp-expl"><b>Excluded:</b> ${esc(r["Exclusion Reason"] || "—")}${r["Support Intervention Reason"] ? " · " + esc(r["Support Intervention Reason"]) : ""}</div>`;
        var fexpl = (r["Foreman Explanation"] && String(r["Foreman Explanation"]).trim()) ? `<div class="rp-expl"><b>Foreman:</b> ${esc(r["Foreman Explanation"])}</div>` : "";
        return `<div class="rp-jc${elig ? "" : " excl"}">
          <div class="top"><span class="jn">#${esc(r["Job No"] || "")}</span><span class="cust">${esc(r["Customer"] || "—")}</span>
            <span style="flex:1"></span>${stPill(r["Final Status"])}</div>
          <div class="meta"><span>${esc(shortD(String(r["Job Date"] || "").slice(0, 10)))}</span>
            <span>${esc(r["Job Source"] || "—")}</span>
            <span><b>${money(r["Estimate Bill"])}</b> → <b>${money(r["Actual Bill"])}</b>${dpct != null ? ` <span style="color:${dpct > 0 ? "#b45309" : "var(--muted)"}">(${dpct > 0 ? "+" : ""}${dpct}%)</span>` : ""}</span>
            ${billPill(r["Bill Increase Category"])}</div>
          ${revHtml}${fexpl}${expl}</div>`;
      }).join("");

      drawer.innerHTML = `
        <div class="rp-dhd">
          <button class="x" id="rpDx" title="Close">✕</button>
          <div class="fm">${esc(fm)}</div>
          <div class="wk">Week ending ${esc(wk)}</div>
          <div class="big"><b style="color:${b.bg === "#e5e7eb" || b.bg === "#fecaca" || b.bg === "#bbf7d0" ? "var(--ink)" : b.bg}">${pct}%</b>
            <em>${R} review${R === 1 ? "" : "s"} · ${J} eligible job${J === 1 ? "" : "s"} · ${jobs.length} completed</em></div>
        </div>
        <div class="rp-dbody">${rollHtml}
          <div class="rp-sec">Jobs (${jobs.length})</div>${cards || `<div class="rp-none">No jobs.</div>`}</div>`;
      drawer.querySelector("#rpDx").onclick = closeDrawer;
      scrim.classList.add("show"); drawer.classList.add("show");
    }

    // ---- matrix + KPIs ----
    function repaint() {
      var weeks = windowWeeks();
      var weekSet = new Set(weeks);
      var data = filtered().filter(r => weekSet.has(String(r["Week Ending"] || "").slice(0, 10)));
      var cells = {}, foremen = {};
      var tot = { completed: 0, eligible: 0, reviews: 0, jobsWithReview: 0, support: 0, missing: 0, noResp: 0, highBill: 0 };
      data.forEach(r => {
        var fm = r["Foreman"] || "—", wk = String(r["Week Ending"]).slice(0, 10), elig = num(r["Eligible"]) === 1;
        var nrev = num(r["Number of Reviews"]);
        var c = cells[fm + "||" + wk] || (cells[fm + "||" + wk] = { R: 0, J: 0, completed: 0 });
        c.completed++; if (elig) { c.J++; c.R += nrev; }
        var f = foremen[fm] || (foremen[fm] = { completed: 0, J: 0, R: 0 });
        f.completed++; if (elig) { f.J++; f.R += nrev; }
        tot.completed++; if (elig) { tot.eligible++; tot.reviews += nrev; }
        if (elig && nrev > 0) tot.jobsWithReview++;
        if (yes(r["Support Intervention"])) tot.support++;
        if (elig && nrev === 0) { tot.missing++; if (!yes(r["Foreman Response Received"])) tot.noResp++; }
        if (r["Bill Increase Category"] === "High Increase") tot.highBill++;
      });

      // range label + stepper bounds
      document.getElementById("rpRange").textContent = weeks.length ? shortD(weeks[weeks.length - 1]) + " – " + shortD(weeks[0]) : "no weeks";
      var maxOff = Math.max(0, allWeeks.length - RP.weeks);
      document.getElementById("rpOlder").disabled = RP.offset >= maxOff;
      document.getElementById("rpNewer").disabled = RP.offset <= 0;

      var K = [
        { l: "Completed", v: N(tot.completed), s: "in view" },
        { l: "Eligible", v: N(tot.eligible), s: N(tot.completed - tot.eligible) + " excluded" },
        { l: "Reviews", v: N(tot.reviews), s: N(tot.jobsWithReview) + " jobs ≥1", a: 1 },
        { l: "Review %", v: tot.eligible ? Math.round(tot.reviews / tot.eligible * 100) + "%" : "—", s: "target 100%", a: 1 },
        { l: "Support excl.", v: N(tot.support), s: "interventions" },
        { l: "Missing", v: N(tot.missing), s: "eligible, no review" },
        { l: "No response", v: N(tot.noResp), s: "no explanation" },
        { l: "High +bill", v: N(tot.highBill), s: "> 25% over est." },
      ];
      document.getElementById("rpKpis").innerHTML = K.map(k =>
        `<div class="rp-kpi${k.a ? " accent" : ""}"><b>${k.v}</b><span>${k.l}</span><small>${k.s}</small></div>`).join("");

      // sort foremen
      function sortVal(fm) {
        if (RP.sortWk === "total") { var f = foremen[fm]; return f.J ? f.R / f.J : -1; }
        if (RP.sortWk === "__name") return null;   // handled separately
        if (RP.sortWk) { var c = cells[fm + "||" + RP.sortWk]; return (c && c.J) ? c.R / c.J : -1; }
        return foremen[fm].completed;   // default: busiest first
      }
      var fmList = Object.keys(foremen);
      if (RP.sortWk === "__name") {
        fmList.sort((a, b) => RP.sortDir === "asc" ? a.localeCompare(b) : b.localeCompare(a));
      } else {
        fmList.sort((a, b) => { var d = sortVal(a) - sortVal(b); if (d === 0) d = foremen[b].completed - foremen[a].completed; return RP.sortDir === "asc" ? d : -d; });
      }

      var caret = key => RP.sortWk === key ? (RP.sortDir === "asc" ? " ▲" : " ▼") : "";
      var head = `<tr><th class="fm${RP.sortWk === "__name" ? " srt" : ""}" data-srt="__name">Foreman${caret("__name")}</th>` +
        `<th class="tot${RP.sortWk === "total" ? " srt" : ""}" data-srt="total">Overall${caret("total")}</th>` +
        weeks.map(w => `<th class="${RP.sortWk === w ? "srt" : ""}" data-srt="${esc(w)}">${esc(w.slice(5))}${caret(w)}</th>`).join("") + `</tr>`;

      var body = fmList.map(fm => {
        var f = foremen[fm], tpct = f.J ? Math.round(f.R / f.J * 100) : null, tb = tpct == null ? null : band(tpct);
        var totCell = tpct == null
          ? `<td class="tot"><span class="rp-cell na" style="background:#f3f4f6;color:#9ca3af">${f.R} / ${f.J}<small>N/A</small></span></td>`
          : `<td class="tot"><span class="rp-cell" style="background:${tb.bg};color:${tb.fg};cursor:default">${f.R} / ${f.J}<small>${tpct}%</small></span></td>`;
        var tds = weeks.map(w => {
          var c = cells[fm + "||" + w];
          if (!c || c.J === 0) return `<td><span class="rp-cell na" style="background:#f3f4f6;color:#9ca3af">0 / 0<small>—</small></span></td>`;
          var pct = Math.round(c.R / c.J * 100), b = band(pct);
          var sel = RP.cell === fm + "||" + w ? " sel" : "";
          return `<td><span class="rp-cell${sel}" style="background:${b.bg};color:${b.fg}" data-fm="${esc(fm)}" data-wk="${esc(w)}">${c.R} / ${c.J}<small>${pct}%</small></span></td>`;
        }).join("");
        return `<tr><td class="fm">${esc(fm)}</td>${totCell}${tds}</tr>`;
      }).join("");

      document.getElementById("rpMatrix").innerHTML = fmList.length
        ? `<table class="rp-mx"><thead>${head}</thead><tbody>${body}</tbody></table>`
        : `<div class="rs-loading" style="padding:22px">No jobs match these filters.</div>`;

      document.querySelectorAll("#rpMatrix thead th[data-srt]").forEach(th => th.onclick = () => {
        var key = th.dataset.srt;
        if (RP.sortWk === key) RP.sortDir = RP.sortDir === "asc" ? "desc" : "asc";
        else { RP.sortWk = key; RP.sortDir = "desc"; }
        repaint();
      });
      document.querySelectorAll("#rpMatrix .rp-cell:not(.na)[data-fm]").forEach(el => el.onclick = () => {
        var key = el.dataset.fm + "||" + el.dataset.wk;
        if (RP.cell === key && drawer.classList.contains("show")) { closeDrawer(); return; }  // click the open cell again → close
        RP.cell = key;
        document.querySelectorAll("#rpMatrix .rp-cell.sel").forEach(s => s.classList.remove("sel"));
        el.classList.add("sel");
        drill(el.dataset.fm, el.dataset.wk);
      });

      // keep an open drawer in sync with the current filters/sort: refresh it if its cell
      // is still visible, else close it — otherwise a filter change leaves stale drill-down.
      if (RP.cell) {
        var cp = RP.cell.split("||");
        if (foremen[cp[0]] && weekSet.has(cp[1])) drill(cp[0], cp[1]);
        else closeDrawer();
      }
    }

    // ---- control wiring ----
    document.getElementById("rpWeeks").onchange = e => { RP.weeks = +e.target.value; RP.offset = 0; closeDrawer(); repaint(); };
    document.getElementById("rpOlder").onclick = () => { RP.offset = Math.min(Math.max(0, allWeeks.length - RP.weeks), RP.offset + RP.weeks); closeDrawer(); repaint(); };
    document.getElementById("rpNewer").onclick = () => { RP.offset = Math.max(0, RP.offset - RP.weeks); closeDrawer(); repaint(); };
    resetBtn.onclick = () => {
      RP.sources.clear(); RP.statuses.clear(); RP.billcats.clear(); RP.foremen.clear();
      RP.sortWk = null; RP.sortDir = "desc"; RP.offset = 0;
      closeDrawer();
      msControls.forEach(c => c.paintBtn());   // refresh each filter's label back to "All"
      repaint();
    };
    csvBtn.onclick = () => {
      var cols = ["Week Ending", "Job Date", "Job No", "Customer", "Foreman", "Job Source", "Job Type", "Estimate Bill",
        "Actual Bill", "Bill Increase Amount", "Bill Increase %", "Bill Increase Category", "Review Received", "Number of Reviews",
        "Review Source", "Review Breakdown", "Eligible", "Support Intervention", "Support Intervention Reason", "Review Expected",
        "Exclusion Reason", "Foreman Response Received", "Foreman Explanation", "Final Status"];
      var q = s => `"${String(s == null ? "" : s).replace(/"/g, '""')}"`;
      var lines = [cols.join(",")].concat(filtered().map(r => cols.map(c => q(r[c])).join(",")));
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
      a.download = "review-performance.csv"; a.click(); URL.revokeObjectURL(a.href);
    };

    RP.cell = null;
    repaint();
  },
});
