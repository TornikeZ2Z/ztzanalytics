/* ISSUES IN MONEY FLOW — a Data Quality sub-view (tab), not a page of its own.
 *
 * ONE closing row can cover several calendar events (an LD departure and its arrival; a
 * two-day local job). Its net cash is owed ONCE. Where money was recorded on MORE THAN ONE
 * leg of the same closing, the same cash may have been submitted twice — each leg balances
 * on its own, so nothing looks wrong anywhere else in the system. Found 2026-07-29 while
 * fixing Shubha Baliga; Tornike takes these from here (his ask: list them, he handles them).
 *
 * Read-only by design: this view never edits money.
 */
(window.DQ_SUB = window.DQ_SUB || {}).mfissues = async function (host) {
  var esc = RSC.esc;
  var money = function (v) {
    if (v == null) return "—";
    var n = +v;
    return (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  if (!document.getElementById("mfi-style")) {
    var st = document.createElement("style"); st.id = "mfi-style";
    st.textContent = ""
      + ".mfi-tbl{width:100%;border-collapse:collapse}"
      + ".mfi-tbl th,.mfi-tbl td{padding:8px 12px;font-size:12.5px;text-align:left;border-bottom:1px solid var(--line);vertical-align:top}"
      + ".mfi-tbl th{color:var(--faint);font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em}"
      + ".mfi-tbl td.r,.mfi-tbl th.r{text-align:right;font-variant-numeric:tabular-nums}"
      + ".mfi-tbl tr:hover td{background:var(--panel-2)}"
      + ".mfi-leg{display:block;font-size:12px;color:var(--muted);white-space:nowrap}"
      + ".mfi-pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:750;white-space:nowrap}"
      + ".mfi-dup{background:rgba(176,42,55,.12);color:var(--neg,#b02a37)}"
      + ".mfi-chk{background:rgba(245,165,36,.16);color:#a06a00}"
      + ".mfi-kpi{display:flex;gap:12px;flex-wrap:wrap;margin:0 0 16px}"
      + ".mfi-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 17px;min-width:170px}"
      + ".mfi-card b{display:block;font-size:21px;letter-spacing:-.4px}"
      + ".mfi-card span{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;color:var(--faint)}"
      + ".mfi-none{padding:24px;color:var(--faint)}";
    document.head.appendChild(st);
  }

  host.innerHTML = '<div class="rs-loading" style="padding:22px">Checking money against closings…</div>';

  var rows;
  try {
    var res = await fetch(ZTZ.API + "/api/fct_money_flow?limit=30000",
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    var j = await res.json();
    rows = j.rows || j.data || j;
  } catch (e) {
    host.innerHTML = '<div class="mfi-none">Could not load the money-flow data (' + esc(String(e)) + ").</div>";
    return;
  }

  // group the LIVE legs of each closing row, then keep the ones where money landed twice
  // 2026+ only, the same scope as the rest of Data Quality (Tornike 2026-07-30)
  var since = window.DQ_SINCE || "2026-01-01";
  var live = rows.filter(function (r) {
    if (String(r["Status"]) === "Filter Out") return false;
    var d = String(r["Job Date"] || "").slice(0, 10);
    return !d || d >= since;
  });
  var byKey = {};
  live.forEach(function (r) {
    var k = String(r["Closing Unique Key"] || "");
    if (!k || r["Net Cash (Closing)"] == null) return;
    (byKey[k] = byKey[k] || []).push(r);
  });

  var groups = [];
  Object.keys(byKey).forEach(function (k) {
    var paid = byKey[k].filter(function (r) { return (+r["Cash Flow"] || 0) !== 0; });
    if (paid.length < 2) return;
    var amts = paid.map(function (r) { return +r["Cash Flow"]; });
    var identical = amts.every(function (a) { return Math.abs(a - amts[0]) < 0.01; });
    groups.push({
      key: k, cust: paid[0]["Customer"], forman: paid[0]["Forman"],
      nc: paid[0]["Net Cash (Closing)"], legs: paid, identical: identical,
      extra: identical ? Math.abs(amts[0]) * (paid.length - 1)
                       : Math.max(0, amts.reduce(function (a, b) { return a + Math.abs(b); }, 0)
                                      - Math.abs(+paid[0]["Net Cash (Closing)"] || 0)),
    });
  });
  groups.sort(function (a, b) { return b.extra - a.extra; });

  var dup = groups.filter(function (g) { return g.identical; });
  var total = dup.reduce(function (a, g) { return a + g.extra; }, 0);

  if (!groups.length) {
    host.innerHTML = '<h1>Issues in Money Flow</h1>'
      + '<div class="mfi-none">Nothing to review — no closing row has money recorded on more than one of its events.</div>';
    return;
  }

  host.innerHTML = ""
    + "<h1>Issues in Money Flow</h1>"
    + '<p class="rs-sub" style="max-width:760px">One closing row can cover several calendar events — an '
    + 'long-distance departure and its arrival, or a job that ran over two days. Its net cash is owed '
    + '<b>once</b>. These closings have money recorded on <b>more than one</b> leg, so the same cash may '
    + 'have been submitted twice. Every leg balances on its own, which is why nothing looks wrong '
    + 'anywhere else. Read-only — fix them at the source. <b>2026 onwards.</b></p>'
    + '<div class="mfi-kpi">'
    + '<div class="mfi-card"><b>' + dup.length + "</b><span>same amount twice</span></div>"
    + '<div class="mfi-card"><b>' + money(total) + "</b><span>possibly counted twice</span></div>"
    + '<div class="mfi-card"><b>' + groups.length + "</b><span>closings to review</span></div>"
    + "</div>"
    + '<table class="mfi-tbl"><tr><th>Customer</th><th>Foreman</th><th>Closing</th>'
    + '<th class="r">Closing net cash</th><th>Recorded on each leg</th>'
    + '<th class="r">Extra</th><th>Verdict</th></tr>'
    + groups.map(function (g) {
        return "<tr><td><b>" + esc(g.cust || "—") + "</b></td>"
          + "<td>" + esc(g.forman || "—") + "</td>"
          + "<td>" + esc(g.key) + "</td>"
          + '<td class="r">' + money(g.nc) + "</td>"
          + "<td>" + g.legs.map(function (r) {
              return '<span class="mfi-leg">' + esc(r["Job Date"]) + " · "
                + esc(String(r["Job Type"] || "").slice(0, 16)) + " · <b>" + money(r["Cash Flow"])
                + "</b> · " + esc(r["Status"]) + "</span>";
            }).join("")
          + "</td>"
          + '<td class="r">' + (g.extra ? money(g.extra) : "—") + "</td>"
          + "<td>" + (g.identical
              ? '<span class="mfi-pill mfi-dup">same amount twice</span>'
              : '<span class="mfi-pill mfi-chk">different amounts — check</span>') + "</td></tr>";
      }).join("")
    + "</table>";
};
