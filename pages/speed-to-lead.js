/* SALES page: Speed to Lead — how fast the sales team responds to new leads, and what
   speed is worth. Built on fct_lead_call (one row per ZtZ lead since 2025-03, joined to
   RingCentral calls/SMS by normalized phone; NY business-minutes clock 08:00–20:00, 7d).
   Engine adapted from the sales team's CRM↔RingCentral dashboard (analysis f58d23fa) with
   corrections: first call AT/AFTER creation, one call → one lead, ZtZ-only, dialer
   attribution from Extension, connect quality from Action Result. */

(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.fct_lead_call) {
    RS.DATASETS.fct_lead_call = {
      table: "fct_lead_call",
      cols: ["Job No", "Request Joinkey", "Create Datetime", "Create Date", "Month", "Week Ending",
        "Customer", "Phone Norm", "Status", "Status Category", "Source", "Assigned", "Booked Date",
        "Closing Total", "Called", "Connected", "First Out At", "First Connect At", "TTO Biz Min",
        "TTO Wall Min", "Speed Bucket", "Out Calls", "In Calls", "Followups", "In Before Create",
        "Pre Create Out Call", "First Out Extension", "First Out Result", "Created Hour",
        "Created Dow", "Created OOB", "Texted", "First Sms At", "TTS Biz Min"],
    };
  }
})();

var SL_BUCKETS = ["<= 5 min", "5-15 min", "15-30 min", "30-60 min", "> 1 hour"];
var SL_BUCKET_LB = { "<= 5 min": "≤ 5 min", "5-15 min": "5–15 min", "15-30 min": "15–30 min",
  "30-60 min": "30–60 min", "> 1 hour": "> 1 hour", "Not called": "Not called",
  "Called (timing unknown)": "Timing unknown" };
var SL_COLORS = ["#10b981", "#34d399", "#facc15", "#f59e0b", "#ef4444"];
var SL = { months: 3, rep: "", source: "" };

registerPage({
  id: "sales-speed",
  group: "sales",
  title: "Speed to Lead",
  async render(host) {
    var esc = RSC.esc, N = RS.fmtN;
    var num = function (v) { var n = parseFloat(String(v == null ? "" : v)); return isFinite(n) ? n : null; };
    var MON = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var fmtMin = function (m) {
      if (m == null) return "—";
      m = Math.round(m);
      return m < 60 ? m + "m" : Math.floor(m / 60) + "h " + (m % 60) + "m";
    };
    var median = function (a) { if (!a.length) return null; var s = a.slice().sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
    var pctl = function (a, p) { if (!a.length) return null; var s = a.slice().sort((x, y) => x - y), k = (s.length - 1) * p / 100, f = Math.floor(k), c = Math.min(f + 1, s.length - 1); return s[f] + (s[c] - s[f]) * (k - f); };

    if (!document.getElementById("sl-style")) {
      var st = document.createElement("style"); st.id = "sl-style";
      st.textContent = `
        .sl-head{padding:2px 2px 0}
        .sl-head h1{margin:0;font-size:22px;font-weight:800;letter-spacing:-.01em}
        .sl-head p{margin:2px 0 0;color:var(--muted);font-size:13.5px;max-width:110ch}
        .sl-bar{display:flex;flex-wrap:wrap;gap:9px;align-items:center;padding:12px 0;margin-top:6px;border-bottom:1px solid var(--line)}
        .sl-sel{padding:9px 13px;border-radius:11px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--ink);
          font-size:13.5px;font-family:inherit;outline:none}
        .sl-sel:focus{border-color:var(--brand)}
        .sl-kpis{display:flex;gap:10px;overflow-x:auto;padding:12px 0;scrollbar-width:thin}
        .sl-kpi{flex:0 0 auto;min-width:132px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:11px 15px}
        .sl-kpi b{display:block;font-size:25px;font-weight:800;letter-spacing:-.02em;line-height:1.1}
        .sl-kpi span{display:block;font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.03em;font-weight:700;margin-top:4px}
        .sl-kpi small{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
        .sl-kpi.accent b{color:var(--brand)}
        .sl-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
        @media (max-width:900px){.sl-grid{grid-template-columns:1fr}}
        .sl-panel{border:1px solid var(--line);border-radius:13px;background:var(--panel);padding:15px 18px}
        .sl-panel h3{margin:0 0 3px;font-size:15.5px;font-weight:800}
        .sl-panel .sub{font-size:12px;color:var(--faint);margin-bottom:12px}
        .sl-rows{display:flex;flex-direction:column;gap:8px}
        .sl-row{display:flex;align-items:center;gap:10px;font-size:13.5px}
        .sl-row .nm{flex:0 0 128px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .sl-row .bar{flex:1;height:11px;border-radius:999px;background:var(--panel-2);overflow:hidden}
        .sl-row .bar i{display:block;height:100%;border-radius:999px}
        .sl-row .vn{flex:0 0 auto;font-weight:800;font-size:13.5px;min-width:64px;text-align:right;font-variant-numeric:tabular-nums}
        .sl-tbl{width:100%;border-collapse:collapse;font-size:13.5px}
        .sl-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;text-align:left;padding:6px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
        .sl-tbl th.r,.sl-tbl td.r{text-align:right;font-variant-numeric:tabular-nums}
        .sl-tbl td{padding:8px 10px;border-bottom:1px solid var(--line);white-space:nowrap}
        .sl-tbl tr:last-child td{border-bottom:none}
        .sl-note{background:var(--panel-2);border-radius:11px;padding:12px 15px;font-size:13px;color:var(--muted);margin-top:12px;line-height:1.55}
        .sl-note b{color:var(--ink)}
        .sl-heat{display:grid;grid-template-columns:50px repeat(7,1fr);gap:3px;font-size:11.5px}
        .sl-heat .hh{color:var(--faint);font-weight:700;text-align:center;padding:2px 0}
        .sl-heat .hl{color:var(--faint);font-weight:700;text-align:right;padding-right:6px;line-height:23px}
        .sl-heat .hc{height:23px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--ink)}
        .sl-pill{display:inline-block;font-size:11px;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
        .sl-good{background:rgba(22,163,74,.16);color:#15803d}.sl-bad{background:rgba(220,38,38,.13);color:#b91c1c}
        .sl-warn{background:rgba(217,119,6,.15);color:#b45309}`;
      document.head.appendChild(st);
    }

    host.innerHTML = `
      <div class="sl-head">
        <h1>Speed to Lead</h1>
        <p>How fast we call new leads — and what speed is worth. Clock = business minutes (8:00–20:00 NY, 7 days) from lead creation to the <b>first outbound call at/after creation</b>. Calls matched per lead by phone; every call belongs to exactly one lead.</p>
      </div>
      <div class="sl-bar" id="slBar"></div>
      <div class="sl-kpis" id="slKpis"><div class="rs-loading">Loading leads…</div></div>
      <div id="slBody"></div>`;

    var rows;
    try { rows = await RS.load("fct_lead_call"); }
    catch (e) { document.getElementById("slKpis").innerHTML = `<div class="rs-loading">Couldn't load — ${esc(e.message)}</div>`; return; }
    if (!document.getElementById("slBody")) return;

    var months = [...new Set(rows.map(r => r["Month"]).filter(Boolean))].sort().reverse();
    var reps = [...new Set(rows.map(r => r["Assigned"]).filter(Boolean))].sort();
    var srcs = [...new Set(rows.map(r => r["Source"]).filter(Boolean))].sort();

    var bar = document.getElementById("slBar");
    bar.innerHTML = `
      <select class="sl-sel" id="slWin">${[[1, "This month"], [3, "Last 3 months"], [6, "Last 6 months"], [12, "Last 12 months"], [0, "All (since Mar 2025)"]]
        .map(o => `<option value="${o[0]}"${o[0] === SL.months ? " selected" : ""}>${o[1]}</option>`).join("")}</select>
      <select class="sl-sel" id="slRep"><option value="">All reps</option>${reps.map(r => `<option${SL.rep === r ? " selected" : ""}>${esc(r)}</option>`).join("")}</select>
      <select class="sl-sel" id="slSrc"><option value="">All sources</option>${srcs.map(s => `<option${SL.source === s ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>`;

    function filtered() {
      var mset = SL.months ? new Set(months.slice(0, SL.months)) : null;
      return rows.filter(r =>
        (!mset || mset.has(r["Month"])) &&
        (!SL.rep || r["Assigned"] === SL.rep) &&
        (!SL.source || r["Source"] === SL.source));
    }
    var booked = r => String(r["Status Category"]) === "Confirmed";

    function paint() {
      var d = filtered();
      var called = d.filter(r => num(r["Called"]) === 1);
      var timed = called.filter(r => num(r["TTO Biz Min"]) != null);
      var speeds = timed.map(r => num(r["TTO Biz Min"]));
      var within1h = timed.filter(r => num(r["TTO Biz Min"]) <= 60).length;
      var connected = d.filter(r => num(r["Connected"]) === 1).length;
      var notCalled = d.length - called.length;
      var entryLag = d.filter(r => num(r["In Before Create"]) > 0).length;
      var texted = d.filter(r => num(r["Texted"]) === 1).length;

      var K = [
        { l: "Leads", v: N(d.length), s: "in window" },
        { l: "Called", v: d.length ? Math.round(called.length / d.length * 100) + "%" : "—", s: N(called.length) + " leads", a: 1 },
        { l: "Connected", v: d.length ? Math.round(connected / d.length * 100) + "%" : "—", s: "actually spoke" },
        { l: "≤ 1 hr", v: d.length ? Math.round(within1h / d.length * 100) + "%" : "—", s: "of ALL leads", a: 1 },
        { l: "Median speed", v: fmtMin(median(speeds)), s: "p90 " + fmtMin(pctl(speeds, 90)) },
        { l: "Not called", v: N(notCalled), s: d.length ? Math.round(notCalled / d.length * 100) + "% of leads" : "—" },
        { l: "Entry lag", v: N(entryLag), s: "customer called first" },
        { l: "Texted", v: d.length ? Math.round(texted / d.length * 100) + "%" : "—", s: "got an SMS" },
      ];
      document.getElementById("slKpis").innerHTML = K.map(k =>
        `<div class="sl-kpi${k.a ? " accent" : ""}"><b>${k.v}</b><span>${k.l}</span><small>${k.s}</small></div>`).join("");

      // speed distribution
      var bCount = {};
      timed.forEach(r => { var b = r["Speed Bucket"]; bCount[b] = (bCount[b] || 0) + 1; });
      var bMax = Math.max(1, ...SL_BUCKETS.map(b => bCount[b] || 0));
      var distHtml = SL_BUCKETS.map((b, i) => {
        var n = bCount[b] || 0, p = timed.length ? Math.round(n / timed.length * 1000) / 10 : 0;
        return `<div class="sl-row"><span class="nm">${SL_BUCKET_LB[b]}</span>
          <span class="bar"><i style="width:${Math.round(n / bMax * 100)}%;background:${SL_COLORS[i]}"></i></span>
          <span class="vn">${p}% <span style="color:var(--faint);font-weight:600">(${N(n)})</span></span></div>`;
      }).join("");

      // THE MONEY CHART: booking rate by response speed (incl. not-called)
      var groups = SL_BUCKETS.map((b, i) => ({ k: SL_BUCKET_LB[b], rs: timed.filter(r => r["Speed Bucket"] === b), c: SL_COLORS[i] }))
        .concat([{ k: "Not called", rs: d.filter(r => num(r["Called"]) !== 1), c: "#9ca3af" }]);
      var bkMax = 1;
      groups.forEach(g => { g.n = g.rs.length; g.bk = g.n ? g.rs.filter(booked).length / g.n : null; if (g.bk != null) bkMax = Math.max(bkMax, g.bk); });
      var bookHtml = groups.map(g =>
        `<div class="sl-row"><span class="nm">${esc(g.k)}</span>
          <span class="bar"><i style="width:${g.bk == null ? 0 : Math.round(g.bk / bkMax * 100)}%;background:${g.c}"></i></span>
          <span class="vn">${g.bk == null ? "—" : Math.round(g.bk * 1000) / 10 + "%"} <span style="color:var(--faint);font-weight:600">(${N(g.n)})</span></span></div>`).join("");
      var fast = groups[0], slow = groups[4];
      var ratio = (fast.bk && slow.bk) ? (fast.bk / slow.bk) : null;
      var bookNote = "";
      if (ratio && fast.n >= 30 && slow.n >= 30) {
        bookNote = ratio >= 1.2
          ? `<div class="sl-note"><b>Speed pays:</b> leads called ≤ 5 min book at <b>${Math.round(fast.bk * 1000) / 10}%</b> vs <b>${Math.round(slow.bk * 1000) / 10}%</b> when called after an hour — <b>${ratio.toFixed(1)}× better</b>. Correlation isn't pure causation (hot leads also get grabbed faster), but the gap is the size of the prize.</div>`
          : `<div class="sl-note"><b>Read with care:</b> the "&gt; 1 hour" bucket books at ${Math.round(slow.bk * 1000) / 10}% — inflated by leads that already booked via an <b>incoming</b> call, where the later outbound is just a confirmation. For a clean speed-vs-conversion read, filter one outbound-driven source (e.g. Angi or Post Card) above.</div>`;
      }

      // monthly trend
      var mKeys = SL.months ? months.slice(0, Math.max(SL.months, 3)).slice().reverse() : months.slice().reverse();
      var trendRows = mKeys.map(mk => {
        var rs = rows.filter(r => r["Month"] === mk && (!SL.rep || r["Assigned"] === SL.rep) && (!SL.source || r["Source"] === SL.source));
        var cl = rs.filter(r => num(r["Called"]) === 1);
        var tm = cl.filter(r => num(r["TTO Biz Min"]) != null).map(r => num(r["TTO Biz Min"]));
        var w1 = cl.filter(r => num(r["TTO Biz Min"]) != null && num(r["TTO Biz Min"]) <= 60).length;
        var bk = rs.length ? Math.round(rs.filter(booked).length / rs.length * 1000) / 10 : null;
        return `<tr><td>${MON[+mk.slice(5, 7)]} '${mk.slice(2, 4)}</td><td class="r">${N(rs.length)}</td>
          <td class="r">${rs.length ? Math.round(cl.length / rs.length * 100) + "%" : "—"}</td>
          <td class="r"><b>${fmtMin(median(tm))}</b></td>
          <td class="r">${rs.length ? Math.round(w1 / rs.length * 100) + "%" : "—"}</td>
          <td class="r">${bk == null ? "—" : bk + "%"}</td></tr>`;
      }).join("");

      // rep dual lens
      var byAsg = {};
      d.forEach(r => { var k = r["Assigned"] || "(unassigned)"; (byAsg[k] = byAsg[k] || []).push(r); });
      var asgRows = Object.entries(byAsg).map(([k, rs]) => {
        var cl = rs.filter(r => num(r["Called"]) === 1);
        var tm = cl.filter(r => num(r["TTO Biz Min"]) != null).map(r => num(r["TTO Biz Min"]));
        var w1 = cl.filter(r => num(r["TTO Biz Min"]) != null && num(r["TTO Biz Min"]) <= 60).length;
        // Tornike 2026-07-15: "if the qualified lead count is below 10 - lets hide it." The old guard was
        // `x.n >= 10` where n = rs.length = ALL leads INCLUDING bad ones — it LOOKED like this rule but a
        // rep with 12 leads of which 9 are bad passed on 3 qualified. Threshold on QUALIFIED (leads minus
        // bad leads), the same population every other booking rate in the portal divides by.
        var qual = rs.filter(r => String(r["Status Category"]) !== "Bad Lead").length;
        return { k, n: rs.length, qual: qual, cp: rs.length ? cl.length / rs.length : 0, med: median(tm),
          w1: rs.length ? w1 / rs.length : 0, bk: rs.length ? rs.filter(booked).length / rs.length : 0 };
      }).filter(x => x.qual >= 10).sort((a, b) => b.qual - a.qual).slice(0, 14);
      var asgHtml = asgRows.map(x => `<tr><td>${esc(x.k)}</td><td class="r">${N(x.n)}</td>
        <td class="r">${Math.round(x.cp * 100)}%</td><td class="r"><b>${fmtMin(x.med)}</b></td>
        <td class="r">${Math.round(x.w1 * 100)}%</td><td class="r">${Math.round(x.bk * 1000) / 10}%</td></tr>`).join("");

      var byExt = {};
      d.forEach(r => {
        if (num(r["Called"]) !== 1 || !r["First Out Extension"]) return;
        var k = String(r["First Out Extension"]).replace(/^\d+\s*-\s*/, "");
        (byExt[k] = byExt[k] || []).push(r);
      });
      var extRows = Object.entries(byExt).map(([k, rs]) => {
        var tm = rs.filter(r => num(r["TTO Biz Min"]) != null).map(r => num(r["TTO Biz Min"]));
        return { k, n: rs.length, med: median(tm), f5: tm.filter(m => m <= 5).length };
      }).filter(x => x.n >= 10).sort((a, b) => b.n - a.n).slice(0, 14);
      var extHtml = extRows.map(x => `<tr><td>${esc(x.k)}</td><td class="r">${N(x.n)}</td>
        <td class="r"><b>${fmtMin(x.med)}</b></td><td class="r">${x.n ? Math.round(x.f5 / x.n * 100) + "%" : "—"}</td></tr>`).join("");

      // source × speed
      var bySrc = {};
      d.forEach(r => { var k = r["Source"] || "(none)"; (bySrc[k] = bySrc[k] || []).push(r); });
      var srcRows = Object.entries(bySrc).map(([k, rs]) => {
        var cl = rs.filter(r => num(r["Called"]) === 1);
        var tm = cl.filter(r => num(r["TTO Biz Min"]) != null).map(r => num(r["TTO Biz Min"]));
        return { k, n: rs.length, cp: rs.length ? cl.length / rs.length : 0, med: median(tm),
          bk: rs.length ? rs.filter(booked).length / rs.length : 0 };
      }).sort((a, b) => b.n - a.n).slice(0, 12);
      var srcHtml = srcRows.map(x => `<tr><td>${esc(x.k)}</td><td class="r">${N(x.n)}</td>
        <td class="r">${Math.round(x.cp * 100)}%</td><td class="r"><b>${fmtMin(x.med)}</b></td>
        <td class="r">${Math.round(x.bk * 1000) / 10}%</td></tr>`).join("");

      // not-called worklist (recent first)
      var nc = d.filter(r => num(r["Called"]) !== 1)
        .sort((a, b) => String(b["Create Datetime"]).localeCompare(String(a["Create Datetime"])));
      var ncRows = nc.slice(0, 100).map(r => {
        var sc = String(r["Status Category"] || "");
        var pill = sc === "Confirmed" ? "sl-good" : sc === "Bad Lead" ? "sl-bad" : "sl-warn";
        return `<tr><td><b>#${esc(r["Job No"] || "")}</b><br><span style="color:var(--muted)">${esc(r["Customer"] || "—")}</span></td>
          <td>${esc(String(r["Create Datetime"] || "").slice(0, 16).replace("T", " "))}</td>
          <td><span class="sl-pill ${pill}">${esc(r["Status"] || "—")}</span></td>
          <td>${esc(r["Source"] || "—")}</td><td>${esc(r["Assigned"] || "—")}</td>
          <td class="r">${N(num(r["In Calls"]) || 0)}</td></tr>`;
      }).join("");

      // heatmap: creation hour (7..21) × dow
      var DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      var heat = {}, hMax = 1;
      d.forEach(r => {
        var h = num(r["Created Hour"]); if (h == null) return;
        var k = r["Created Dow"] + "_" + h;
        heat[k] = (heat[k] || 0) + 1; hMax = Math.max(hMax, heat[k]);
      });
      var heatHtml = `<div class="sl-heat"><span></span>` + DOWS.map(x => `<span class="hh">${x}</span>`).join("") +
        Array.from({ length: 15 }, (_, i) => i + 7).map(h =>
          `<span class="hl">${h}:00</span>` + DOWS.map(dw => {
            var v = heat[dw + "_" + h] || 0;
            var a = v ? (0.12 + 0.88 * v / hMax) : 0;
            return `<span class="hc" style="background:rgba(79,70,229,${a.toFixed(2)})" title="${dw} ${h}:00 — ${v} leads">${v || ""}</span>`;
          }).join("")).join("") + `</div>`;

      document.getElementById("slBody").innerHTML = `
        <div class="sl-grid">
          <div class="sl-panel"><h3>Speed-to-lead distribution</h3><div class="sub">% of called leads with timing · business minutes</div>
            <div class="sl-rows">${distHtml}</div></div>
          <div class="sl-panel"><h3>Booking rate by response speed</h3><div class="sub">% of leads that became Confirmed — the value of speed</div>
            <div class="sl-rows">${bookHtml}</div>${bookNote}</div>
        </div>
        <div class="sl-grid">
          <div class="sl-panel"><h3>Trend by month</h3><div class="sub">volume · coverage · speed · conversion</div>
            <div style="overflow-x:auto"><table class="sl-tbl"><thead><tr><th>Month</th><th class="r">Leads</th><th class="r">Called</th><th class="r">Median</th><th class="r">≤1 hr (all)</th><th class="r">Booked</th></tr></thead><tbody>${trendRows}</tbody></table></div></div>
          <div class="sl-panel"><h3>When do leads come in?</h3><div class="sub">lead creation by hour × day (NY time) — staff where it's dark</div>${heatHtml}</div>
        </div>
        <div class="sl-grid">
          <div class="sl-panel"><h3>By assigned rep</h3><div class="sub">the rep who OWNS the lead (min 10 qualified leads)</div>
            <div style="overflow-x:auto"><table class="sl-tbl"><thead><tr><th>Rep</th><th class="r">Leads</th><th class="r">Called</th><th class="r">Median</th><th class="r">≤1 hr</th><th class="r">Booked</th></tr></thead><tbody>${asgHtml}</tbody></table></div></div>
          <div class="sl-panel"><h3>Who actually dials first</h3><div class="sub">the extension that made the FIRST call (min 10 first-calls) — ours only, her file couldn't see this</div>
            <div style="overflow-x:auto"><table class="sl-tbl"><thead><tr><th>Dialer</th><th class="r">First calls</th><th class="r">Median</th><th class="r">≤5 min</th></tr></thead><tbody>${extHtml}</tbody></table></div></div>
        </div>
        <div class="sl-grid">
          <div class="sl-panel"><h3>Source × speed</h3><div class="sub">which channels wait longest</div>
            <div style="overflow-x:auto"><table class="sl-tbl"><thead><tr><th>Source</th><th class="r">Leads</th><th class="r">Called</th><th class="r">Median</th><th class="r">Booked</th></tr></thead><tbody>${srcHtml}</tbody></table></div></div>
          <div class="sl-panel"><h3>Never called (${N(nc.length)}${nc.length > 100 ? " · showing 100 newest" : ""})</h3><div class="sub">no outbound call matched — the follow-up worklist</div>
            <div style="overflow-x:auto;max-height:420px;overflow-y:auto"><table class="sl-tbl"><thead><tr><th>Lead</th><th>Created</th><th>Status</th><th>Source</th><th>Assigned</th><th class="r">In-calls</th></tr></thead><tbody>${ncRows}</tbody></table></div></div>
        </div>
        <div class="sl-note" style="margin-top:12px"><b>Method:</b> response time = business minutes (8:00–20:00 New York, 7 days) from lead creation to the first outbound RingCentral call at/after creation, matched by normalized phone; a lead created after 20:00 starts its clock at 8:00 next morning; same-evening calls count as ~0 business minutes. On shared phones every call belongs to exactly one lead. "Connected" = the call was actually answered. Zip to Zip lines only. Data since Mar 2025 (RingCentral history start).</div>`;
    }

    document.getElementById("slWin").onchange = e => { SL.months = +e.target.value; paint(); };
    document.getElementById("slRep").onchange = e => { SL.rep = e.target.value; paint(); };
    document.getElementById("slSrc").onchange = e => { SL.source = e.target.value; paint(); };

    paint();
  },
});
