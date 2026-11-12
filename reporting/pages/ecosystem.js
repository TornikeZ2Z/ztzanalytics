/* PARTNERSHIP & STRATEGY (Marketing) and the Competitor Map's CONTENT GAPS tab -- ZTZ-68, 12 Nov 2026.
 *
 * Sophie (marketing head) asked on 11 Nov: her dashboard's competitor page into the competitors dashboard,
 * and its "Partnership & TA ecosystem strategy" as its own page in Marketing. His picks the same day: the
 * competitor page is a tab of the Competitor Map (which is also listed under Marketing now), the rest a
 * Marketing page of its own.
 *
 *   PARTNERSHIP & STRATEGY  her pages 1-5: University partnerships, Partnership map, Personas and screens,
 *                           Channels to explore, Segment strategies (five layers).
 *   CONTENT GAPS            her page 6 (Competitor analysis): a state filter and ten layers. window.ECO.
 *                           renderGaps(host, rerender) draws it inside the Competitor Map.
 *
 * THE CONTENT IS A SNAPSHOT of her claude.ai page (pages/ecosystem-*.js), not live data: nothing here
 * loads a table. Every text is escaped, then her marks are applied (**bold**, {s:..} place, {z:..} size).
 */
(function () {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
    .replace(/\{s:([^}]+)\}/g, '<span class="eco-st">$1</span>').replace(/\{z:([^}]+)\}/g, '<span class="eco-sz">$1</span>');

  function injectStyle() {
    if (document.getElementById("eco-style")) return;
    const st = document.createElement("style");
    st.id = "eco-style";
    st.textContent = ""
      + ".eco{font-variant-numeric:tabular-nums;max-width:1180px}"
      + ".eco-eyebrow{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--faint);font-weight:700}"
      + ".eco-intro{font-size:14px;line-height:1.55;color:var(--ink);margin:6px 0 14px;max-width:980px}"
      + ".eco-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:0 0 14px}"
      + ".eco-kpi{background:var(--panel);border:1px solid var(--line);border-top:3px solid var(--brand,#8db13c);border-radius:12px;padding:11px 14px}"
      + ".eco-kpi b{display:block;font-size:26px;line-height:1.15;color:var(--ink);font-weight:800}"
      + ".eco-kpi span{display:block;font-size:12px;color:var(--muted);margin-top:3px;line-height:1.35}"
      + ".eco-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 14px}"
      + ".eco-pills{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 12px}"
      + ".eco-pills>span{font-size:12px;color:var(--faint);margin-right:2px}"
      + ".eco-h2{display:flex;align-items:center;gap:10px;font-size:20px;font-weight:700;color:var(--ink);margin:6px 0 6px}"
      + ".eco-h2 i{font-style:normal;display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;"
      + "background:var(--brand,#8db13c);color:#14200a;font-size:13px;font-weight:800}"
      + ".eco-lead{font-size:13.5px;line-height:1.55;color:var(--ink);margin:0 0 12px}"
      + ".eco-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:0 0 14px}"
      + ".eco-card h3{font-size:14.5px;margin:0 0 3px;color:var(--ink)}"
      + ".eco-sub{font-size:12px;color:var(--faint);margin:0 0 12px;line-height:1.45}"
      + ".eco-foot{font-size:11.5px;color:var(--faint);margin:10px 0 0;line-height:1.45}"
      + ".eco-row2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}"
      + ".eco-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}"
      + ".eco-row4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}"
      + "@media (max-width:1100px){.eco-row2,.eco-row3,.eco-row4{grid-template-columns:minmax(0,1fr)}}"
      + ".eco-row2>.eco-card,.eco-row3>.eco-card{margin:0}"
      + ".eco-tw{overflow:auto;border:1px solid var(--line);border-radius:10px}"
      + ".eco-tw table{border:0}"
      + ".eco table.rs-table td{vertical-align:top;font-size:12.5px;line-height:1.45}"
      + ".eco-st{background:rgba(37,99,235,.12);color:#1d4ed8;border-radius:4px;padding:0 4px;font-weight:600}"
      + ".eco-sz{background:rgba(217,119,6,.16);color:#b45309;border-radius:4px;padding:0 4px;font-weight:600}"
      + ".eco-pill{display:inline-block;font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:99px;white-space:nowrap;"
      + "border:1px solid var(--line);color:var(--muted);background:var(--panel)}"
      + ".eco-pill.lime{background:var(--brand,#8db13c);border-color:var(--brand,#8db13c);color:#14200a}"
      + ".eco-pill.soft{border-color:var(--brand,#8db13c);color:#4d6b12}"
      + ".eco-pill.amber{border-color:#d97706;color:#b45309}"
      + ".eco-pill.red{background:rgba(220,38,38,.12);border-color:transparent;color:#b91c1c}"
      + ".eco-pill.dark{background:#14200a;border-color:#14200a;color:#c8ef6b}"
      + ".eco-pill.blue{background:rgba(37,99,235,.12);border-color:transparent;color:#1d4ed8}"
      + "body.rs-app:not(.light) .eco-pill.soft{color:#c8ef6b}body.rs-app:not(.light) .eco-pill.dark{background:#c8ef6b;color:#14200a}"
      + ".eco-bars .grp{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--faint);font-weight:700;margin:12px 0 4px}"
      + ".eco-bar{display:grid;grid-template-columns:200px minmax(0,1fr) 60px;gap:10px;align-items:center;font-size:12.5px;margin:4px 0}"
      + ".eco-bar .t{height:10px;border-radius:99px;background:var(--panel-2)}.eco-bar .t i{display:block;height:100%;border-radius:99px}"
      + ".eco-bar b{text-align:right;font-weight:600;color:var(--muted)}"
      + ".eco-bar.click{cursor:pointer}.eco-bar.click:hover .t,.eco-bar.on .t{outline:2px solid var(--ink);outline-offset:1px}"
      + ".eco-list{list-style:none;margin:0;padding:0}.eco-list li{display:grid;grid-template-columns:22px minmax(0,1fr);gap:8px;margin:8px 0;font-size:13px;line-height:1.45}"
      + ".eco-list li i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;"
      + "background:var(--brand,#8db13c);color:#14200a;font-size:12px;font-weight:800}"
      + ".eco-list.chk li i{background:none;border:2px solid var(--brand,#8db13c);color:#4d6b12}"
      + ".eco-ua{border-left:4px solid;border-radius:8px;padding:9px 12px;font-size:12.5px;line-height:1.45;background:var(--panel-2)}"
      + ".eco-ua b{display:block;margin-bottom:3px}.eco-ua.use{border-color:#16a34a}.eco-ua.avoid{border-color:#dc2626}"
      + ".eco-pillars{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;margin:4px 0 12px}"
      + ".eco-pillars span{display:inline-flex;align-items:center;gap:7px}"
      + ".eco-pillars i{font-style:normal;display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;"
      + "background:var(--brand,#8db13c);color:#14200a;font-size:11px;font-weight:800}"
      + ".eco-stair{display:flex;flex-direction:column;gap:6px}"
      + ".eco-step{border-left:3px solid var(--brand,#8db13c);background:var(--panel-2);border-radius:8px;padding:7px 10px;font-size:12px;line-height:1.4}"
      + ".eco-step b{display:block;font-size:12px}.eco-step small{display:block;color:var(--faint);margin-top:2px}"
      + ".eco-cardh{display:flex;align-items:center;gap:8px;font-size:14px;font-weight:700;margin:0 0 10px}"
      + ".eco-cardh i{font-style:normal;display:inline-grid;place-items:center;width:24px;height:24px;border-radius:50%;"
      + "background:var(--brand,#8db13c);color:#14200a;font-size:12px;font-weight:800}"
      + ".eco-field{background:var(--panel-2);border-left:3px solid var(--brand,#8db13c);border-radius:8px;padding:7px 10px;margin:0 0 7px;font-size:12.5px;line-height:1.45}"
      + ".eco-field b{display:block;font-size:12px}"
      + ".eco-journey{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;align-items:stretch}"
      + ".eco-jstep{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:12.5px;background:var(--panel)}"
      + ".eco-jstep b{display:block;font-size:13.5px}.eco-jstep.hot{background:rgba(37,99,235,.1);border:2px solid #2563eb}"
      + ".eco-jloop{font-size:11.5px;color:var(--faint);text-align:center;align-self:center}"
      + ".eco-text{font-size:13px;line-height:1.55;color:var(--ink)}"
      + ".eco-text p{margin:0 0 10px}"
      + ".eco-ring{background:#141a12;border-radius:14px;padding:6px;margin:0 0 14px}"
      + ".eco-ring svg{display:block;width:100%;height:auto;max-height:520px}"
      + ".eco-tip{font-size:12.5px;color:var(--muted);min-height:20px;margin:-6px 0 12px}"
      + ".eco-mx td.c{text-align:center;font-weight:600;cursor:pointer;white-space:nowrap}"
      + ".eco-mx td.c.Covered{background:#d9f2b0;color:#2d4a09}.eco-mx td.c.Partial{background:#f1f9e2;color:#3c5414}"
      + ".eco-mx td.c.Thin{background:#e9e1d2;color:#5c4a2a}.eco-mx td.c.Missing{background:#f6d7da;color:#8e1d27}"
      + ".eco-mx td.c.on{outline:2px solid var(--ink);outline-offset:-2px}.eco-mx th.sel{color:var(--ink)}"
      + ".eco-mx td.c.dim{opacity:.45}"
      + ".eco-evid{font-size:12.5px;line-height:1.5;margin:10px 0 0}"
      + ".eco-camp h4{margin:2px 0 6px;font-size:14px}.eco-camp .who{font-size:11.5px;color:var(--faint)}"
      + ".eco-camp .for{background:#14200a;color:#e9f5d0;border-radius:8px;padding:9px 11px;font-size:12px;line-height:1.45;margin-top:8px}"
      + ".eco-camp .for b{color:#c8ef6b}"
      + ".eco-cfield{font-size:12.5px;line-height:1.5;margin:5px 0}"
      + ".eco-dumb{width:100%;height:auto;display:block}"
      + ".eco-search{width:240px;max-width:100%}"
      + ".eco-src{font-size:11.5px;color:var(--faint);margin:16px 2px 4px;line-height:1.5}";
    document.head.appendChild(st);
  }

  /* ---- small parts --------------------------------------------------------------------------- */
  const kpis = items => '<div class="eco-kpis">' + items.map(([v, l]) => '<div class="eco-kpi"><b>' + esc(v) + "</b><span>" + esc(l) + "</span></div>").join("") + "</div>";
  const card = (title, sub, body, foot) => '<div class="eco-card">' + (title ? "<h3>" + esc(title) + "</h3>" : "")
    + (sub ? '<p class="eco-sub">' + esc(sub) + "</p>" : "") + body + (foot ? '<p class="eco-foot">' + fmt(foot) + "</p>" : "") + "</div>";
  const pill = (t, cls) => '<span class="eco-pill ' + (cls || "") + '">' + esc(t) + "</span>";
  const PILL = {
    grade: v => pill(v, v === "A+" ? "lime" : "soft"),
    tier: v => pill(v, v === "1" ? "lime" : v === "2" ? "soft" : ""),
    status: v => pill(v, v === "Running" ? "lime" : v === "Gap" ? "amber" : ""),
    prio: v => pill(v, v === "High" ? "lime" : v === "Medium" ? "soft" : ""),
    fit: v => pill(v, /^(High|Very high)/.test(v) ? "lime" : "soft"),
    ours: v => pill(v, v === "Gap" || v === "Missing" ? "amber" : v === "Covered" ? "lime" : ""),
    effect: v => pill(v, v === "High" ? "lime" : v === "Medium" ? "soft" : ""),
    type: v => pill(v, "dark"),
    state: v => pill(v, "dark"),
  };
  // a table: cols, rows (arrays), cell(i, value, row) -> html (default: formatted text)
  function table(cols, rows, cell, opts) {
    const o = opts || {};
    return '<div class="eco-tw"' + (o.maxh ? ' style="max-height:' + o.maxh + 'px"' : "") + '><table class="rs-table rs-even' + (o.cls ? " " + o.cls : "") + '"><thead><tr>'
      + cols.map(c => "<th>" + esc(c) + "</th>").join("") + "</tr></thead><tbody>"
      + (rows.length ? rows.map(r => "<tr" + (o.rowAttr ? o.rowAttr(r) : "") + ">" + r.map((v, i) => "<td" + (o.tdAttr ? o.tdAttr(i, v, r) : "") + ">"
          + (cell ? cell(i, v, r) : fmt(v)) + "</td>").join("") + "</tr>").join("")
        : '<tr><td colspan="' + cols.length + '" class="dim">Nothing for this state.</td></tr>')
      + "</tbody></table></div>";
  }
  const bars = (rows, max, color, attr) => rows.map(r => '<div class="eco-bar' + (attr ? " click" + (attr(r).on ? " on" : "") : "") + '"'
      + (attr ? ' data-eco="' + esc(attr(r).key) + '"' : "") + "><span>" + fmt(r[0]) + '</span><div class="t">'
      + (r[1] !== "" && r[1] != null ? '<i style="width:' + Math.max(1, 100 * (+String(r[1]).replace(/,/g, "") / max)).toFixed(1) + "%;background:" + (r[2] || color) + '"></i>' : "")
      + "</div><b>" + esc(r[3] != null ? r[3] : r[1] === "" ? "n/a" : r[1]) + "</b></div>").join("");
  const list = (items, chk) => '<ul class="eco-list' + (chk ? " chk" : "") + '">' + items.map(t => "<li><i>" + (chk ? "✓" : "+") + "</i><span>" + fmt(t) + "</span></li>").join("") + "</ul>";
  const useAvoid = (use, avoid) => '<div class="eco-row2" style="margin:0 0 12px"><div class="eco-ua use"><b>Use</b>' + fmt(use)
    + '</div><div class="eco-ua avoid"><b>Avoid</b>' + fmt(avoid) + "</div></div>";
  const stairs = steps => '<div class="eco-stair">' + steps.map((s, i) => '<div class="eco-step" style="margin-left:' + (i * 10) + 'px"><b>'
    + (i + 1) + " · " + esc(s[0]) + "</b>" + fmt(s[1]) + "<small>" + esc(s[2]) + "</small></div>").join("") + "</div>";
  const numberedCard = (n, name, body) => '<div class="eco-card"><div class="eco-cardh"><i>' + n + "</i>" + esc(name) + "</div>" + body + "</div>";
  const has = (cell, st) => !cell || cell === "All" || String(cell).split(/[ ,]+/).indexOf(st) >= 0;

  /* ---- the ring diagram (her page 2): Zip to Zip in the middle, Tier 1 close, Tier 2/3 on the ring --- */
  function ring(D) {
    const W = 760, H = 520, cx = W / 2, cy = H / 2 + 10;
    const rows = D.table.rows;
    let svg = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Partnership map">';
    [120, 175, 230].forEach(r => { svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="#3a4a2a" stroke-dasharray="3 5"/>'; });
    const t1 = rows.filter(r => r[2] === "1"), rest = rows.filter(r => r[2] !== "1");
    const at = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    rest.forEach((r, i) => { const a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / rest.length, p = at(a, 230);
      svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="#2c3a20"/>'; });
    t1.forEach((r, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 3, p = at(a, 95);
      svg += '<g class="eco-node" data-eco="' + esc(r[0]) + '"><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="58" fill="#3f5a1c" stroke="#b7e23b" stroke-width="1.5"/>'
        + '<text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle" fill="#fff" font-size="12.5" font-weight="700">' + esc(D.short[+r[0] - 1]) + "</text></g>"; });
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="52" fill="#b7e23b"/><text x="' + cx + '" y="' + (cy - 3) + '" text-anchor="middle" fill="#14200a" font-size="13" font-weight="800">Zip to Zip</text>'
      + '<text x="' + cx + '" y="' + (cy + 13) + '" text-anchor="middle" fill="#14200a" font-size="13" font-weight="800">Moving</text>';
    rest.forEach((r, i) => { const a = -Math.PI / 2 + (i + 0.5) * 2 * Math.PI / rest.length, p = at(a, 230), right = Math.cos(a) >= 0;
      svg += '<g class="eco-node" data-eco="' + esc(r[0]) + '"><circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="19" fill="' + (r[2] === "2" ? "#3f5a1c" : "#141a12")
        + '" stroke="#b7e23b" stroke-width="1.5"/><text x="' + p[0].toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="middle" fill="#fff" font-size="11" font-weight="700">' + esc(r[0]) + "</text>"
        + '<text x="' + (p[0] + (right ? 26 : -26)).toFixed(1) + '" y="' + (p[1] + 4).toFixed(1) + '" text-anchor="' + (right ? "start" : "end") + '" fill="#e9f5d0" font-size="12">' + esc(D.short[+r[0] - 1]) + "</text></g>"; });
    return '<div class="eco-ring">' + svg + "</svg></div>";
  }

  /* ---- PARTNERSHIP & STRATEGY: her pages 1-5 -------------------------------------------------- */
  const PAGES = [["uni", "1 · University partnerships"], ["map", "2 · Partnership map"], ["personas", "3 · Personas and screens"],
                 ["channels", "4 · Channels to explore"], ["segments", "5 · Segment strategies"]];
  function pageUni(E) {
    const U = E.universities, A = U.audience;
    const max = Math.max(...A.groups.flatMap(g => g.rows.map(r => +r[1] || 0)));
    return '<p class="eco-lead">' + fmt(U.lead) + "</p>"
      + card(A.title, A.sub, '<div class="eco-bars">' + A.groups.map(g => '<div class="grp">' + esc(g.label) + "</div>"
          + bars(g.rows.map(r => [r[0], r[1], g.color, r[1] === "" ? "n/a" : r[1] + "k"]), max)).join("") + "</div>", A.foot)
      + card(U.shortlist.title, "", table(U.shortlist.cols, U.shortlist.rows, (i, v) => i === 3 ? PILL.grade(v) : i === 2 ? "<b>" + esc(v) + "</b>" : fmt(v)))
      + '<div class="eco-row2" style="margin:0 0 14px">' + card(U.offers.title, "", list(U.offers.items), U.offers.foot)
      + card(U.expects.title, "", list(U.expects.items, true)) + "</div>"
      + card(U.models.title, U.models.sub, table(U.models.cols, U.models.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v)))
      + card(U.comms.title, U.comms.sub, '<div class="eco-pillars">' + U.comms.pillars.map((p, i) => "<span><i>" + (i + 1) + "</i>" + esc(p) + "</span>").join("") + "</div>"
          + useAvoid(U.comms.use, U.comms.avoid) + table(U.comms.cols, U.comms.rows, (i, v) => i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)))
      + '<div class="eco-row2">' + card(U.tests.title, U.tests.sub, table(U.tests.cols, U.tests.rows))
      + card(U.kpis.title, U.kpis.sub, table(U.kpis.cols, U.kpis.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v))) + "</div>";
  }
  function pageMap(E, S) {
    const P = E.partners;
    const tip = S.node ? P.table.rows.find(r => r[0] === S.node) : null;
    return '<p class="eco-lead">' + fmt(P.lead) + '</p><div class="eco-pills">' + pill("Tier 1 · build now", "lime") + pill("Tier 2 · build next", "soft") + pill("Tier 3 · opportunistic") + "</div>"
      + ring(P) + '<p class="eco-tip">' + (tip ? "<b>" + esc(tip[1]) + "</b> (Tier " + esc(tip[2]) + ") — brings: " + esc(tip[3]) + ". We exchange: " + esc(tip[4]) + "."
        : "Click a circle for what the partner brings and what we exchange.") + "</p>"
      + '<div class="eco-row2">' + card(P.table.title, "", table(P.table.cols, P.table.rows, (i, v) => i === 2 ? PILL.tier(v) : i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)))
      + card(P.signals.title, P.signals.sub, table(P.signals.cols, P.signals.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v))) + "</div>";
  }
  function pagePersonas(E) {
    const P = E.personas;
    return '<p class="eco-lead">' + fmt(P.lead) + '</p><div class="eco-row4" style="margin:0 0 14px">'
      + P.cards.map((c, i) => numberedCard(i + 1, c.name, stairs(c.steps))).join("") + "</div>"
      + card(P.matrix.title, P.matrix.sub, table(P.matrix.cols, P.matrix.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v)));
  }
  function pageChannels(E) {
    const C = E.channels;
    return '<p class="eco-lead">' + fmt(C.lead) + "</p>"
      + card("", "", table(C.cols, C.rows, (i, v) => i === 0 ? PILL.status(v) : i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)));
  }
  function pageSegments(E, S) {
    const G = E.segments, L = S.seg || "three";
    let h = '<div class="eco-pills"><span>Layer</span>' + G.layers.map(([k, l]) => '<button class="rs-btn' + (L === k ? " pri" : "") + '" data-eco-seg="' + k + '">' + esc(l) + "</button>").join("") + "</div>";
    if (L === "three") {
      const X = G.three;
      h += '<p class="eco-lead">' + fmt(X.lead) + '</p><div class="eco-row3" style="margin:0 0 14px">'
        + X.cards.map((c, i) => numberedCard(i + 1, c.name, c.fields.map(f => '<div class="eco-field"><b>' + esc(f[0]) + "</b>" + fmt(f[1]) + "</div>").join(""))).join("") + "</div>"
        + "<h3>" + esc(X.a.title) + '</h3><p class="eco-lead">' + fmt(X.a.text) + '</p><div class="eco-row3" style="margin:0 0 14px">'
        + X.a.stages.map((s, i) => numberedCard(i + 1, s.name, '<div class="eco-stair">' + s.signals.map((g, j) => '<div class="eco-step" style="margin-left:' + (j % 2 ? 10 : 0) + 'px"><b>'
            + esc(g[0]) + "</b>Seen by: " + esc(g[1]) + " · " + esc(g[2]) + "<small>" + esc(g[3]) + "</small></div>").join("") + "</div>")).join("") + "</div>"
        + card(X.a.companies.title, X.a.companies.sub, useAvoid(X.a.companies.use, X.a.companies.avoid)
            + table(X.a.companies.cols, X.a.companies.rows, (i, v) => i === 0 ? PILL.tier(v) : i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)))
        + "<h3>" + esc(X.b.title) + '</h3><p class="eco-lead">' + fmt(X.b.text) + "</p>"
        + card("", "", table(X.b.cols, X.b.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v)), X.b.foot)
        + "<h3>" + esc(X.c.title) + '</h3><p class="eco-lead">' + fmt(X.c.text) + "</p>"
        + card("", "", table(X.c.cols, X.c.rows, (i, v) => i === 0 ? PILL.tier(v) : i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)), X.c.foot)
        + '<div class="eco-row2">' + card(X.win.title, X.win.sub, table(X.win.cols, X.win.rows, (i, v) => i === 2 ? "<b>" + esc(v) + "</b>" : fmt(v)))
        + card(X.kpis.title, X.kpis.sub, table(X.kpis.cols, X.kpis.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v))) + "</div>";
    } else if (L === "audience") {
      const A = G.audience, f = S.aud || "all";
      const sizeOk = r => r[8] === "Yes" || r[8] === "Likely" || r[8] === "Partly", stOk = r => !!r[10];
      const shown = A.rows.filter(r => f === "all" || (f === "size" && sizeOk(r)) || (f === "state" && stOk(r)) || (f === "both" && sizeOk(r) && stOk(r)));
      const ids = new Set(shown.map(r => r[0]));
      h += card(A.title, A.sub, kpis(A.kpis) + '<p class="eco-foot" style="margin:0 0 10px">' + fmt(A.legend) + "</p>"
          + '<div class="eco-pills"><span>Show</span>' + [["all", "All segments"], ["size", "2+ bedroom fit"], ["state", "Our states"], ["both", "Both"]]
            .map(([k, l]) => '<button class="rs-btn' + (f === k ? " pri" : "") + '" data-eco-aud="' + k + '">' + l + "</button>").join("") + "</div>"
          + table(A.cols, shown.map(r => [r[1], r[2], r[3], r[4], r[5], r[6], r[7], [r[8], r[9]], [r[10], r[11]]]), (i, v) =>
              i === 0 ? "<b>" + esc(v) + "</b>" : i === 5 ? PILL.fit(v)
              : i === 7 ? pill(v[0], v[0] === "Yes" ? "lime" : v[0] === "Likely" || v[0] === "Partly" ? "amber" : "") + '<div class="eco-foot" style="margin:3px 0 0">' + esc(v[1]) + "</div>"
              : i === 8 ? (v[0] ? v[0].split(/,\s*/).map(s => pill(s, "blue")).join(" ") : '<span class="dim">None named</span>') + '<div class="eco-foot" style="margin:3px 0 0">' + esc(v[1]) + "</div>"
              : fmt(v), { maxh: 560 }), A.foot)
        + card(A.dives.title, A.dives.sub, '<div class="eco-row3">' + A.dives.cards.filter(c => c[1].split(/,\s*/).some(x => ids.has(x)))
            .map(c => '<div class="eco-card" style="margin:0;background:var(--panel-2)"><h3>' + esc(c[0]) + '</h3><p class="eco-sub">Segments: ' + esc(c[1]) + "</p>"
              + '<p class="eco-cfield"><b>Move:</b> ' + fmt(c[2]) + '</p><p class="eco-cfield"><b>How they decide:</b> ' + fmt(c[3])
              + '</p><p class="eco-cfield"><b>What wins them:</b> ' + fmt(c[4]) + "</p></div>").join("") + "</div>");
    } else if (L === "journey") {
      const J = G.journey, st = J.steps;
      const box = s => '<div class="eco-jstep' + (s[0] === "4" ? " hot" : "") + '"><b>' + esc(s[0]) + " " + esc(s[1]) + "</b>" + esc(s[2]) + "</div>";
      h += card(J.title, J.sub, '<div class="eco-journey">' + st.slice(0, 4).map(box).join("") + "</div>"
          + '<div class="eco-journey" style="margin:8px 0"><div></div><div class="eco-jloop">↺ ' + esc(J.loop[0]) + '</div><div></div><div class="eco-jloop">↓ ' + esc(J.loop[1]) + "</div></div>"
          + '<div class="eco-journey"><div></div>' + [st[6], st[5], st[4]].map(box).join("") + "</div>", J.foot)
        + card(J.plays.title, J.plays.sub, table(J.plays.cols, J.plays.rows, (i, v) => i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)));
    } else if (L === "trust") {
      const X = G.trust;
      h += card(X.insights.title, X.insights.sub, '<div class="eco-row3">' + X.insights.cards.map(c => '<div class="eco-field" style="margin:0"><b>' + esc(c[0]) + "</b>" + fmt(c[1]) + "</div>").join("") + "</div>")
        + card(X.market.title, X.market.sub, table(X.market.cols, X.market.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : i === 2 ? '<span class="dim">' + esc(v) + "</span>" : fmt(v)))
        + card(X.triggers.title, X.triggers.sub, table(X.triggers.cols, X.triggers.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : fmt(v)));
    } else {
      const X = G.cases;
      h += card(X.title, X.sub, '<div class="eco-row2">' + X.cards.map(c => '<div class="eco-card" style="margin:0;background:var(--panel-2)"><h3>' + esc(c[0]) + "</h3>"
          + [["What it is", c[1]], ["Scale and results", c[2]], ["Emotional trigger", c[3]], ["Segment it attracts", c[4]], ["Lesson", c[5]]]
            .map(([k, v]) => '<p class="eco-cfield"><b>' + k + ":</b> " + fmt(v) + "</p>").join("") + "</div>").join("") + "</div>")
        + card(X.ideas.title, X.ideas.sub, table(X.ideas.cols, X.ideas.rows, (i, v) => i === 0 ? "<b>" + fmt(v) + "</b>" : fmt(v)));
    }
    return h;
  }

  /* ---- CONTENT GAPS: her page 6, drawn inside the Competitor Map ---------------------------------- */
  function renderGaps(host, repaint) {
    const E = window.ZTZ_ECO, C = E && E.competitors;
    if (!C) { host.innerHTML = '<div class="panel">The content-gap data did not load.</div>'; return; }
    injectStyle();
    const S = window.__ECO_GAPS || (window.__ECO_GAPS = { st: "", layer: "overview", over: "CT", cell: null, play: "", q: "" });
    const st = S.st;
    const sname = k => (C.states.find(s => s[0] === k) || [k, k])[1];
    let h = '<div class="eco"><p class="eco-lead">' + fmt(C.lead) + "</p>" + kpis(C.kpis)
      + '<div class="eco-pills"><span>State</span>' + [["", "All states"]].concat(C.states.map(s => [s[0], s[0]]))
        .map(([k, l]) => '<button class="rs-btn' + (st === k ? " pri" : "") + '" data-eco-st="' + k + '">' + l + "</button>").join("") + "</div>"
      + '<div class="eco-pills"><span>Layer</span>' + C.layers.map(([k, l]) => '<button class="rs-btn' + (S.layer === k ? " pri" : "") + '" data-eco-layer="' + k + '">' + esc(l) + "</button>").join("") + "</div>";
    const L = S.layer;
    if (st && ["activity", "search", "method"].indexOf(L) >= 0)
      h += '<p class="eco-foot" style="margin:0 0 10px">This layer covers all five states together, so the state filter does not change it.</p>';
    if (L === "overview") {
      const O = C.overview, sel = st || S.over, sc = O.scores.find(r => r[0] === sel) || O.scores[0];
      const gaps = O.gaps.filter(g => g[0] === sc[0]), comps = O.competitors.filter(c => c[0] === sc[0]);
      h += '<div class="eco-row2">' + card(O.title, O.sub, '<div class="eco-bars">' + bars(O.scores.map(r => [sname(r[0]), r[1], "#2563eb", r[1]]), 100,
            "#2563eb", r => ({ key: O.scores.find(s => sname(s[0]) === r[0])[0], on: sname(sc[0]) === r[0] })) + "</div>")
        + card(sname(sc[0]), "Gap score " + sc[1] + " · " + comps.length + " competitors tracked · " + sc[2] + " tactics missing or thin"
            + (!st && sc[0] === "CT" ? " · widest gap shown, pick a state to switch" : ""),
            '<p class="eco-sub" style="margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Biggest gaps here</p>'
            + gaps.map(g => '<div class="eco-cfield"><b>' + esc(g[1]) + "</b> — Zip to Zip Moving: " + esc(g[2]) + "; " + esc(g[3]) + " of 5 competitors use it</div>").join("")
            + '<p class="eco-sub" style="margin:12px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Competitors</p>'
            + comps.map(c => '<div class="eco-cfield"><b>' + esc(c[1]) + '</b> <span class="dim">· ' + esc(c[2]) + "</span></div>").join("")
            + '<p class="eco-sub" style="margin:12px 0 4px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Where Zip to Zip Moving is covered</p>'
            + '<div class="eco-cfield">' + esc(sc[3]) + "</div>") + "</div>";
    } else if (L === "activity") {
      const A = C.activity;
      h += card(A.title, A.sub, kpis(A.kpis) + '<div class="eco-row3" style="margin:0 0 12px">' + A.stages.map(([name, pct], si) => '<div class="eco-card" style="margin:0;background:var(--panel-2)"><div class="eco-cardh" style="justify-content:space-between">'
          + "<span>" + esc(name) + " →</span><span>" + pct + "%</span></div>" + A.rows.filter(r => r[0].charAt(0) === String(si + 1)).map(r =>
            '<div class="eco-bar" style="grid-template-columns:minmax(0,1fr) 40px"><span><b>' + esc(r[1]) + "</b></span><b>" + esc(r[2]) + '%</b></div><div class="eco-bar" style="grid-template-columns:minmax(0,1fr);margin-top:-2px"><div class="t"><i style="width:'
            + (100 * r[2] / 20).toFixed(0) + '%;background:var(--brand,#8db13c)"></i></div></div><div class="eco-foot" style="margin:2px 0 8px">' + esc(r[5]) + "</div>").join("") + "</div>").join("") + "</div>"
          + '<div class="eco-pills"><span><b>When the customer first meets the brand:</b></span>' + A.firstMeet.map(([k, v]) => pill(k + " " + v, "soft")).join("") + "</div>"
          + '<p class="eco-text"><b>Short answer.</b> ' + fmt(A.answer) + '</p><p class="eco-foot">' + fmt(A.note) + "</p>"
          + table(A.cols, A.rows, (i, v) => i === 1 ? "<b>" + esc(v) + "</b>" : i === 3 ? PILL.effect(v) : i === 7 ? PILL.ours(v) : fmt(v)));
    } else if (L === "positioning") {
      const P = C.positioning, lens = P.lens.cards.filter(c => !st || c[0] === st);
      const known = P.known.cards.filter(c => (c[0] === "All" || !st || c[0] === st) && (!S.play || c[3] === S.play));
      h += card(P.lens.title, P.lens.sub, '<div class="eco-row3">' + (lens.length ? lens.map(c => '<div class="eco-field" style="margin:0"><b>' + esc(c[1]) + " " + PILL.state(c[0]) + "</b>" + fmt(c[2]) + "</div>").join("")
            : '<div class="dim">No competitor in ' + esc(sname(st)) + " wins mainly through a partnership.</div>") + "</div>"
          + '<p class="eco-sub" style="margin:14px 0 6px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">What this means for Zip to Zip Moving</p>'
          + P.lens.means.map(m => '<div class="eco-cfield">' + PILL.prio(m[0]) + " <b>" + esc(m[1]) + "</b> — " + fmt(m[2]) + "</div>").join(""))
        + card(P.known.title, P.known.sub, '<div class="eco-pills"><span>Play type</span>' + [["", "All plays"], ["Partnership", "Partnership"], ["Content", "Content"], ["Campaign", "Campaign"], ["Reputation", "Reputation"]]
            .map(([k, l]) => '<button class="rs-btn' + (S.play === k ? " pri" : "") + '" data-eco-play="' + k + '">' + l + "</button>").join("") + "</div>"
          + '<div class="eco-row3">' + known.map(c => '<div class="eco-card" style="margin:0;' + (c[0] === "All" ? "border:2px solid var(--brand,#8db13c)" : "background:var(--panel-2)") + '"><h3>' + esc(c[1]) + " " + PILL.state(c[0]) + "</h3>"
            + '<p class="eco-sub" style="margin:0 0 6px">Known for: ' + esc(c[2]) + '</p><p class="eco-sub" style="margin:0 0 3px;text-transform:uppercase;letter-spacing:.06em;font-weight:700">Most effective ' + esc(c[3].toLowerCase()) + "</p><b>" + fmt(c[4]) + "</b></div>").join("") + "</div>");
    } else if (L === "reputation") {
      const R = C.reputation, rows = R.board.rows.filter(r => r[1] === "All" || !st || r[1] === st);
      // her dumbbell chart: Google (blue) and Yelp (black) per company on a 2.5-5.0 axis
      const W = 760, rowH = 18, top = 22, x = v => 230 + (v - 2.5) / 2.5 * (W - 250);
      const order = ["All", "NJ", "NY", "PA", "CT", "DE"], chart = rows.slice().sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]));
      let svg = '<svg class="eco-dumb" viewBox="0 0 ' + W + " " + (top + chart.length * rowH + 6) + '" role="img" aria-label="Google and Yelp ratings">';
      [2.5, 3, 3.5, 4, 4.5, 5].forEach(v => { svg += '<line x1="' + x(v) + '" y1="' + (top - 6) + '" x2="' + x(v) + '" y2="' + (top + chart.length * rowH) + '" stroke="var(--line)"/><text x="' + x(v) + '" y="' + (top - 10) + '" text-anchor="middle" font-size="10" fill="var(--faint)">' + v.toFixed(1) + "★</text>"; });
      chart.forEach((r, i) => { const y = top + i * rowH + rowH / 2, g = parseFloat(r[2]), yl = parseFloat(r[4]);
        if (r[1] === "All") svg += '<rect x="0" y="' + (y - rowH / 2) + '" width="' + W + '" height="' + rowH + '" fill="rgba(141,177,60,.18)"/>';
        svg += '<text x="222" y="' + (y + 3.5) + '" text-anchor="end" font-size="10.5" fill="var(--ink)"' + (r[1] === "All" ? ' font-weight="700"' : "") + ">" + esc(r[0]) + " (" + esc(r[1]) + ")</text>";
        if (!isNaN(g) && !isNaN(yl)) svg += '<line x1="' + x(Math.min(g, yl)) + '" y1="' + y + '" x2="' + x(Math.max(g, yl)) + '" y2="' + y + '" stroke="var(--faint)"/>';
        if (!isNaN(yl)) svg += '<circle cx="' + x(yl) + '" cy="' + y + '" r="4.5" fill="var(--ink,#111827)"><title>Yelp ' + yl + "</title></circle>";
        if (!isNaN(g)) svg += '<circle cx="' + x(g) + '" cy="' + y + '" r="4.5" fill="#2563eb"><title>Google ' + g + "</title></circle>"; });
      svg += "</svg>";
      h += card(R.ratings.title, R.ratings.sub, '<div class="eco-pills">' + pill("● Google", "blue") + pill("● Yelp") + '<span>Zip to Zip Moving\'s row is highlighted</span></div>' + svg)
        + card(R.board.title, R.board.sub, table(R.board.cols, rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : esc(v), { rowAttr: r => r[1] === "All" ? ' style="background:rgba(141,177,60,.14)"' : "" }))
        + card(R.leads.title, R.leads.sub, table(R.leads.cols, R.leads.rows.filter(r => r[1] === "All" || !st || r[1] === st),
            (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : esc(v), { rowAttr: r => r[1] === "All" ? ' style="background:rgba(141,177,60,.14)"' : "" }));
    } else if (L === "tactics") {
      const X = C.tactics, cols = ["Tactic"].concat(C.states.map(s => s[0]));
      const ev = S.cell && (() => { const [t, s] = S.cell.split("|"), e = X.evidence.find(r => r[0] === t && (r[1] === "*" || r[1].split(" ").indexOf(s) >= 0));
        const row = X.matrix.find(r => r[0] === t), status = row ? row[1 + C.states.findIndex(x => x[0] === s)].split(" ")[0] : "";
        return e ? "<b>" + esc(t) + " · " + esc(s) + " · " + esc(status) + ":</b> " + fmt(e[2]) : ""; })();
      const q = S.q.trim().toLowerCase();
      const content = X.content.rows.filter(r => (!st || r[0] === st) && (!q || r.join(" ").toLowerCase().indexOf(q) >= 0));
      h += card(X.title, X.sub, '<div class="eco-pills">' + pill("Covered", "lime") + pill("Partial", "soft") + pill("Thin") + pill("Missing", "red") + "</div>"
          + '<div class="eco-tw"><table class="rs-table eco-mx"><thead><tr>' + cols.map((c, i) => '<th' + (i && st === c ? ' class="sel"' : "") + (i ? ' style="text-align:center"' : "") + ">" + esc(c) + "</th>").join("") + "</tr></thead><tbody>"
          + X.matrix.map(r => "<tr><td><b>" + esc(r[0]) + "</b></td>" + r.slice(1).map((v, i) => { const [stt, n] = v.split(" "), k = r[0] + "|" + C.states[i][0];
              return '<td class="c ' + stt + (S.cell === k ? " on" : "") + (st && st !== C.states[i][0] ? " dim" : "") + '" data-eco-cell="' + esc(k) + '" title="Click for what was found on ziptozipmoving.com">' + esc(stt) + " · " + esc(n) + "/5</td>"; }).join("") + "</tr>").join("")
          + "</tbody></table></div>" + '<p class="eco-evid">' + (ev || '<span class="dim">Click any cell to see what was found on ziptozipmoving.com.</span>') + "</p>")
        + card(X.content.title, X.content.sub, '<div class="eco-pills"><input class="rs-inp eco-search" id="ecoQ" placeholder="Search competitors or tactics" value="' + esc(S.q) + '"></div>'
          + table(X.content.cols, content, (i, v) => i === 0 ? PILL.state(v) : i === 1 ? "<b>" + esc(v) + "</b>" : i === 5 ? '<span class="dim">' + esc(v) + "</span>" : fmt(v)));
    } else if (L === "community") {
      const X = C.community;
      h += card(X.title, X.sub, table(X.cols, X.rows.filter(r => r[0] === "Route page" || !st || r[2] === st), (i, v) => i === 0 ? PILL.type(v) : i === 1 ? "<b>" + esc(v) + "</b>" : fmt(v)));
    } else if (L === "gaps") {
      const X = C.gaps;
      h += card(X.ranked.title, X.ranked.sub, table(X.ranked.cols, X.ranked.rows.filter(r => !st || has(r[2], st)), (i, v) => i === 0 ? PILL.prio(v) : i === 1 ? "<b>" + esc(v) + "</b>" : i === 5 ? '<span class="dim">' + esc(v) + "</span>" : fmt(v)))
        + card(X.examples.title, X.examples.sub, table(X.examples.cols, X.examples.rows, (i, v) => i === 1 ? PILL.prio(v) : i === 2 || i === 3 ? "<b>" + esc(v) + "</b>" : i === 4 ? '<span class="dim">' + esc(v) + "</span>" : fmt(v)))
        + card(X.next.title, X.next.sub, '<div class="eco-row4">' + X.next.cards.map(c => '<div class="eco-card" style="margin:0;border-left:4px solid var(--brand,#8db13c)"><h3>' + esc(c[0]) + "</h3>"
            + '<p class="eco-cfield">' + fmt(c[1]) + '</p><p class="eco-foot">Owners: ' + esc(c[2]) + '</p><p class="eco-foot" style="margin-top:4px">Track: ' + esc(c[3]) + "</p></div>").join("") + "</div>");
    } else if (L === "campaigns") {
      const X = C.campaigns;
      h += card(X.title, X.sub, '<div class="eco-row3">' + X.cards.filter(c => !st || c[1] === st).map(c => '<div class="eco-card eco-camp" style="margin:0;border-top:3px solid var(--brand,#8db13c)"><div class="who">' + esc(c[0]) + " · " + esc(c[1]) + "</div><h4>" + esc(c[2]) + "</h4>"
          + '<p class="eco-cfield">' + fmt(c[3]) + '</p><p class="eco-cfield"><b>Why it works:</b> ' + fmt(c[4]) + '</p><div class="for"><b>For Zip to Zip Moving:</b> ' + fmt(c[5]) + "</div></div>").join("")
          + (C.campaigns.cards.some(c => !st || c[1] === st) ? "" : '<div class="dim">No featured campaign in ' + esc(sname(st)) + ".</div>") + "</div>");
    } else if (L === "search") {
      const X = C.search, mx = i => Math.max(...X.rows.map(r => +r[i].replace(/,/g, "")));
      const b = i => '<div class="eco-bars">' + bars(X.rows.map((r, j) => [r[0], r[i], j ? "#9ca3af" : "#2563eb", r[i]]), mx(i)) + "</div>";
      h += '<div class="eco-row2" style="margin:0 0 14px">' + card(X.visits.title, X.visits.sub, b(2)) + card(X.ai.title, X.ai.sub, b(4)) + "</div>"
        + card("Search snapshot", "", table(X.cols, X.rows, (i, v) => i === 0 ? "<b>" + esc(v) + "</b>" : esc(v)));
    } else {
      const X = C.method;
      h += card(X.title, "", '<div class="eco-text">' + X.sections.map(([t, p]) => "<h3>" + esc(t) + "</h3><p>" + fmt(p) + "</p>").join("")
          + "<h3>Limits</h3><p>" + X.limits.map(esc).join("<br>") + "</p></div>", X.source);
    }
    h += '<p class="eco-src">From Sophie\'s page "' + esc(E.source.title) + '" (copied ' + esc(E.source.copied) + "). A snapshot: it changes when her page does, not by itself. "
      + "Her 25 competitors are not the 160 on the Map tab.</p></div>";
    host.innerHTML = h;
    // wiring: every control repaints through the Competitor Map's own paint
    const set = (k, v) => { S[k] = v; repaint(); };
    host.querySelectorAll("[data-eco-st]").forEach(b => { b.onclick = () => { S.cell = null; set("st", b.dataset.ecoSt); }; });
    host.querySelectorAll("[data-eco-layer]").forEach(b => { b.onclick = () => set("layer", b.dataset.ecoLayer); });
    host.querySelectorAll(".eco-bar[data-eco]").forEach(b => { b.onclick = () => { S.over = b.dataset.eco; set("st", ""); }; });
    host.querySelectorAll("[data-eco-play]").forEach(b => { b.onclick = () => set("play", b.dataset.ecoPlay); });
    host.querySelectorAll("[data-eco-cell]").forEach(b => { b.onclick = () => set("cell", S.cell === b.dataset.ecoCell ? null : b.dataset.ecoCell); });
    const q = host.querySelector("#ecoQ");
    if (q) { let t = null; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.q = q.value; S.focusQ = 1; repaint(); }, 250); };
      if (S.focusQ) { S.focusQ = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
  }

  window.ECO = { renderGaps };

  /* ---- the Marketing page ------------------------------------------------------------------- */
  if (typeof registerPage !== "function") return;
  registerPage({
    id: "partnership-strategy",
    group: "marketing",
    title: "Partnership & Strategy",
    subtitle: "Sophie's 2027 partnership and audience strategy: universities, partners, personas, channels and segments.",
    datasets: [],
    render(host) {
      const E = window.ZTZ_ECO;
      injectStyle();
      if (!E || !E.universities || !E.segments) { host.innerHTML = '<div class="panel">The strategy content did not load.</div>'; return; }
      const S = window.__ECO_P || (window.__ECO_P = { page: "uni", seg: "three", aud: "all", node: null });
      const paint = () => {
        const body = S.page === "uni" ? pageUni(E) : S.page === "map" ? pageMap(E, S) : S.page === "personas" ? pagePersonas(E)
          : S.page === "channels" ? pageChannels(E) : pageSegments(E, S);
        host.innerHTML = '<div class="eco"><div class="eco-eyebrow">' + esc(E.header.eyebrow) + '</div><p class="eco-intro">' + fmt(E.header.intro) + "</p>"
          + kpis(E.header.kpis) + '<div class="eco-tabs">' + PAGES.map(([k, l]) => '<button class="rs-btn' + (S.page === k ? " pri" : "") + '" data-eco-page="' + k + '">' + esc(l) + "</button>").join("")
          + '<span class="eco-pill" style="align-self:center;margin-left:6px">6 · Competitor analysis is a tab of the Competitor Map</span></div>'
          + '<div class="eco-h2"><i>' + (PAGES.findIndex(p => p[0] === S.page) + 1) + "</i>" + esc(PAGES.find(p => p[0] === S.page)[1].replace(/^\d · /, "")) + "</div>"
          + body + '<p class="eco-src">' + fmt(E.header.footer) + "<br>From Sophie's page \"" + esc(E.source.title) + '" (copied ' + esc(E.source.copied)
          + "). A snapshot: it changes when her page does, not by itself.</p></div>";
        host.querySelectorAll("[data-eco-page]").forEach(b => { b.onclick = () => { S.page = b.dataset.ecoPage; paint(); window.scrollTo(0, 0); }; });
        host.querySelectorAll("[data-eco-seg]").forEach(b => { b.onclick = () => { S.seg = b.dataset.ecoSeg; paint(); }; });
        host.querySelectorAll("[data-eco-aud]").forEach(b => { b.onclick = () => { S.aud = b.dataset.ecoAud; paint(); }; });
        host.querySelectorAll(".eco-node").forEach(n => { n.style.cursor = "pointer"; n.onclick = () => { S.node = S.node === n.dataset.eco ? null : n.dataset.eco; paint(); }; });
      };
      paint();
    },
  });
})();
