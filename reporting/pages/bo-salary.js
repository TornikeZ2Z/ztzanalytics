/* Salary Analysis (id bo-salary) — the branch owner's pay today, beside the share-of-the-bill
   alternative, and both projected into 2027.

   His brief, 2026-09-21: "i need to prepare my logistics department to answer his questions
   regarding where he would make more money." So the page is written to be argued from:
     1. TODAY        the card from the Branch Owner page, line for line (one shared cost model,
                     window.BO_ECON in branch-owner.js, so the two pages can never disagree)
     2. ALTERNATIVE  he takes a share of the bill and the crew comes out of it, beside it
     3. WHERE        by job type and per job: where he comes out ahead, and the break-even share
     4. 2027         both deals carried through a plain seasonal projection

   THE SHARES ARE PAGE-LOCAL AND UNSAVED ON PURPOSE. A number typed here to win an argument must
   not quietly become policy. Defaults are his: Local 35, Straight 35, Regular 20.

   STRAIGHT MOVING IS A LEVER, BECAUSE THE FLAG BEHIND IT HAS GONE QUIET (found 2026-09-22). None
   of his long hauls carry the `Straight` flag on the long-distance sheet, so the warehouse types
   them all Regular -- and it is not just him: company-wide the flag went 101 -> 180 -> 21 jobs
   over 2024/25/26 while Regular went 176 -> 115 -> 240 and total long-distance stayed level
   (277 / 295 / 261). The business did not change; the column stopped being filled in. So the page
   cannot KNOW which of his long hauls are Straight, and asks instead: "of his long hauls, what
   share is really Straight?" That share is priced at the Straight percentage, the rest at the
   Regular one, on the same per-job economics. The year-by-year counts are printed beside the
   input, live, so the reason for the lever is visible and not folklore.

   THE PROJECTION IS DELIBERATELY SIMPLE (his words: "use some easy forecasting model - dont try
   too hard"). His own history is April-September 2026 -- he has never had a winter with us -- so
   the SHAPE of the year is the company's: each calendar month averaged over the complete years we
   hold, by job type, which is the 3-season-average method that backtested best on Seasonal
   Planning (-8.3% against -11.1% flat and -16.9% growth). His LEVEL is the share of the company's
   jobs he ran in his full months. Money per job is his own averages. */
(function () {
  const STATE = { share: { "Local Moving": 35, "Straight Moving": 35, "Regular Moving": 20 },
                  growth: 0, straightPct: 0 };
  const TYPES = ["Local Moving", "Straight Moving", "Regular Moving"];

  registerPage({
    id: "bo-salary",
    group: "financial",
    title: "Salary Analysis",
    async render(host) {
      const num = RS.num, money = RS.money, moneyC = RS.moneyC || RS.money, fmtN = RS.fmtN;
      const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
      const pct1 = v => (v == null || isNaN(v) || !isFinite(v)) ? "—" : (v * 100).toFixed(1) + "%";
      const signed = v => (v >= 0 ? '<span class="bos-up">+' : '<span class="bos-dn">−') + money(Math.abs(v)) + "</span>";
      const E = window.BO_ECON;

      if (!document.getElementById("bos-css")) {
        const st = document.createElement("style"); st.id = "bos-css";
        st.textContent = [
          ".bos-ctl{display:flex;flex-wrap:wrap;gap:14px 22px;align-items:flex-end}",
          ".bos-fld{display:flex;flex-direction:column;gap:4px;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}",
          ".bos-fld small{font-weight:400;text-transform:none;letter-spacing:0;color:var(--faint);font-size:11.5px}",
          ".bos-in{width:84px;text-align:right;font:inherit;font-size:15px;font-weight:700;font-variant-numeric:tabular-nums;padding:5px 8px;border:1px solid var(--line-2);border-radius:7px;background:var(--surface);color:var(--ink)}",
          ".bos-in:focus{outline:2px solid var(--brand-d);outline-offset:1px;border-color:var(--brand-d)}",
          ".bos-say{font-size:13px;color:var(--muted);margin:4px 0 12px;max-width:110ch;line-height:1.5}",
          ".bos-wrap{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px}",
          "@media (max-width:1100px){.bos-wrap{grid-template-columns:1fr}}",
          ".bos-head{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end;margin:4px 0 12px}",
          ".bos-big{display:flex;flex-direction:column}.bos-big b{font-size:24px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}.bos-big span{font-size:12px;color:var(--muted)}",
          ".bos-big.his b{color:var(--brand-d)}",
          ".bos-stack{display:flex;height:14px;border-radius:7px;overflow:hidden;margin:4px 0 6px;background:var(--line)}.bos-stack i{display:block;height:100%}",
          ".bos-key{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}.bos-key i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}",
          ".bos-rows{display:grid;grid-template-columns:minmax(140px,1.2fr) minmax(60px,1fr) 92px 58px;gap:6px 12px;align-items:center;font-size:13px;margin-top:16px}",
          ".bos-rows .l{color:var(--ink)}.bos-rows .l small{display:block;color:var(--faint);font-size:11px;line-height:1.3}",
          ".bos-rows .bar{height:10px;border-radius:5px;background:var(--line);position:relative;overflow:hidden}.bos-rows .bar i{position:absolute;top:0;bottom:0;left:0;border-radius:5px}",
          ".bos-rows .m{text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}.bos-rows .p{text-align:right;font-variant-numeric:tabular-nums;color:var(--muted);font-size:12px}",
          ".bos-rows .tot{font-weight:800;padding-top:6px;border-top:1px solid var(--line)}",
          /* the crew is the only row whose MEANING changes between the cards, so it is the only one marked */
          ".bos-rows .bos-crew{font-weight:700}",
          ".bos-who{display:block;font-style:normal;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:700}",
          ".bos-rows .bos-crew.alt .bos-who{color:var(--warn)}",
          /* the mix: Local / Straight / Regular side by side, the same three on both cards */
          ".bos-mix{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0 2px}",
          ".bos-m{border:1px solid var(--line);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}",
          ".bos-m b{font-size:12px;color:var(--ink)}.bos-m span{font-size:12.5px;color:var(--ink);font-variant-numeric:tabular-nums}",
          ".bos-m small{display:block;font-size:10.5px;color:var(--faint);font-weight:600}",
          ".bos-m .his{color:var(--brand-d);font-weight:700}.bos-m.off{opacity:.55}.bos-m.off span{color:var(--faint)}",
          ".bos-up{color:var(--pos);font-weight:700}.bos-dn{color:var(--neg);font-weight:700}",
          ".bos-tbl td small{display:block;color:var(--faint);font-size:11px;line-height:1.3}",
          ".bos-tbl tfoot td{font-weight:800;border-top:2px solid var(--line-2)}",
          ".bos-verdict{font-size:14px;line-height:1.55;margin:0 0 4px;max-width:110ch}",
        ].join("");
        document.head.appendChild(st);
      }

      host.innerHTML =
        '<div class="rs-page-head"><h1>Salary Analysis</h1>' +
        '<p>What the branch owner earns today, beside the alternative where he takes <b>a share of the bill and pays the crew himself</b> — ' +
        'by job type, per job, and projected into 2027. Built to answer one question: <b>where would he make more money?</b> ' +
        '<span class="freshness">· read-only · the comparison respects the date/company filter, the projection uses all history</span></p></div>' +
        '<div class="panel"><div class="panel-head"><span class="panel-title">The deal being tested</span></div>' +
        '<div class="bos-say">He takes this share of the total bill and <b>the crew comes out of it</b>. We stop paying the crew and his cut, and still carry everything else — ' +
        'truck, fuel, tolls, materials, card fees, claims, the salespeople’s commission and marketing at 10% of the bill. ' +
        '<b>Nothing typed here is saved.</b></div>' +
        '<div class="bos-ctl" id="bosCtl"></div></div>' +
        '<div id="bosCards"><div class="panel" style="margin-top:14px"><div class="rs-loading">Loading…</div></div></div>' +
        '<div id="bosWhere"></div><div id="bosProj"></div>';

      if (!E) { document.getElementById("bosCards").innerHTML =
        '<div class="panel"><div class="rs-loading">The branch-owner cost model did not load — reload the page.</div></div>'; return; }

      const [martAll, closingAll] = await Promise.all([RS.load("mart_branch_owner_jobs"), RS.load("closing")]);
      const J = RS.filtered("mart_branch_owner_jobs", martAll);
      const typeOf = r => TYPES.includes(r["Moving Type"]) ? r["Moving Type"] : "Local Moving";

      /* ---- the controls: drawn once, never repainted, so typing keeps its focus ---- */
      const ctl = document.getElementById("bosCtl");
      ctl.innerHTML = TYPES.map(t =>
        '<label class="bos-fld">' + esc(t) + ' — his share, %<input class="bos-in" data-share="' + esc(t) +
        '" type="number" min="0" max="100" step="0.5" value="' + STATE.share[t] + '"><small id="bosEven-' +
        t.replace(/\W/g, "") + '"></small></label>').join("") +
        '<label class="bos-fld">Of his long hauls, really Straight, %<input class="bos-in" id="bosStrPct" type="number" min="0" max="100" step="5" value="' + STATE.straightPct +
        '"><small id="bosStrNote"></small></label>' +
        '<label class="bos-fld">Marketing, % of bill<input class="bos-in" value="' + (E.MKT_PCT * 100) + '" disabled><small>fixed — ours, never his</small></label>';
      ctl.querySelectorAll("input[data-share]").forEach(i => { i.oninput = () => {
        STATE.share[i.dataset.share] = i.value === "" ? 0 : Math.max(0, Math.min(100, +i.value)); paint(); }; });
      const spi = document.getElementById("bosStrPct");
      spi.oninput = () => { STATE.straightPct = spi.value === "" ? 0 : Math.max(0, Math.min(100, +spi.value)); paint(); };
      /* why the lever exists, from the data: the flag's own history, company-wide */
      (() => { const by = {}; (closingAll || []).forEach(r => { if (r["Record Source"] !== "closing" || !r.Date) return;
          const y = String(r.Date).slice(0, 4), t = r["Moving Type"]; if (y < "2024" || (t !== "Regular Moving" && t !== "Straight Moving")) return;
          (by[y] = by[y] || { r: 0, s: 0 })[t === "Straight Moving" ? "s" : "r"]++; });
        const ys = Object.keys(by).sort(); const el = document.getElementById("bosStrNote");
        if (el && ys.length) el.innerHTML = "the sheet flags none of his. Company-wide the Straight flag went " +
          ys.map(y => by[y].s).join(" \u2192 ") + " (" + ys.join("/") + ") while Regular went " + ys.map(y => by[y].r).join(" \u2192 ") +
          " \u2014 the column has gone quiet, not the business"; })();

      const shareOf = t => (+STATE.share[t] || 0) / 100;
      const addW = (a, b) => { const c = {}; Object.keys(a.c).forEach(k => { c[k] = a.c[k] + b.c[k]; });
        return { n: a.n + b.n, bill: a.bill + b.bill, his: a.his + b.his, c, cost: a.cost + b.cost, ours: a.ours + b.ours }; };
      /* THE THREE JOB TYPES, with the Straight lever applied: `p` of the long hauls the sheet calls
         Regular are priced as Straight. Jobs the sheet really does flag Straight count as such. */
      function groupsOf(rs) {
        const p = (+STATE.straightPct || 0) / 100;
        const loc = rs.filter(r => typeOf(r) === "Local Moving"), reg = rs.filter(r => typeOf(r) === "Regular Moving"),
              str = rs.filter(r => typeOf(r) === "Straight Moving");
        const aheadAt = (rows, sh) => rows.filter(r => sh * num(r["Total Bill"]) - (num(r["Crew $"]) + num(r["Material $"])) > num(r["His Cut"])).length;
        const Wr = E.walk(reg);
        const mk = (t, W, ahead, assumed) => ({ t, W, a: E.altW(W, shareOf(t)), ahead, assumed });
        return [
          mk("Local Moving", E.walk(loc), aheadAt(loc, shareOf("Local Moving")), 0),
          mk("Straight Moving", addW(E.walk(str), E.scaleW(Wr, p)),
             aheadAt(str, shareOf("Straight Moving")) + p * aheadAt(reg, shareOf("Straight Moving")), p * Wr.n),
          mk("Regular Moving", E.scaleW(Wr, 1 - p), (1 - p) * aheadAt(reg, shareOf("Regular Moving")), 0),
        ];
      }
      /* the alternative on a mixed set of jobs is the sum of each type at its own share */
      function altOf(rs) {
        const parts = groupsOf(rs).map(g => g.a);
        const W = E.walk(rs);
        const hisShare = parts.reduce((a, p) => a + p.hisShare, 0), hisNet = parts.reduce((a, p) => a + p.hisNet, 0);
        const oursCost = W.cost - W.c.crew, ours = W.bill - hisShare - oursCost;
        return { W, hisShare, hisNet, oursCost, ours, hisDelta: hisNet - W.his, oursDelta: ours - W.ours };
      }

      const INK = "#334155", LIME = "rgba(132,204,22,.85)", HIS = "#0f766e", GREY = "#94a3b8", AMB = "#d97706";

      function paint() {
        if (!J.length) { document.getElementById("bosCards").innerHTML =
          '<div class="panel" style="margin-top:14px"><div class="rs-loading">No branch-owner jobs in the current filter range.</div></div>';
          document.getElementById("bosWhere").innerHTML = ""; }
        else { paintCards(); paintWhere(); }
        paintProjection();
      }

      /* ================= 1 + 2: today, and the alternative, side by side ================= */
      /* THE TWO DEALS, ROW FOR ROW (his ask 2026-09-22: "same expenses appear twice - i need it to
         be pure comparison"). The first build listed the crew as a cost on the left and as a
         deduction from his share on the right, then repeated the other nine costs underneath, so the
         columns never lined up and the eye could not read across. Now ONE row list is rendered twice.
         Every line exists on both sides; only two things differ, which is the whole argument: WHO
         PAYS THE CREW, and what he is paid. Every percentage is of the same bill.

         AND THE MIX IS ON THE CARD (his ask, same day): jobs and revenue for Local, Straight and
         Regular separately, because the answer is different for each -- a share of the bill beats a
         cut only where the crew is light against the ticket. The chips carry his pay under each
         deal per type, so the card he is looking at already says where the money moves. */
      function paintCards() {
        const A = altOf(J), W = A.W, maxV = W.bill || 1;
        const pc = v => W.bill ? pct1(v / W.bill) : "\u2014";
        const byOwner = [...new Set(J.map(r => r["Branch Owner"]).filter(Boolean))];
        const stack = (a2, b2, c2) => '<div class="bos-stack"><i style="width:' + (a2 / maxV * 100).toFixed(2) + "%;background:" + GREY +
          '"></i><i style="width:' + (Math.max(0, b2) / maxV * 100).toFixed(2) + "%;background:" + HIS +
          '"></i><i style="width:' + (Math.max(0, c2) / maxV * 100).toFixed(2) + "%;background:" + LIME + '"></i></div>';
        const cell = (v, col, cls, tag) =>
          '<div class="bar' + (cls ? " " + cls : "") + '"><i style="width:' + Math.max(0, Math.min(100, Math.abs(v) / maxV * 100)).toFixed(2) + "%;background:" + col + '"></i></div>' +
          '<div class="m' + (cls ? " " + cls : "") + '">' + money(v) + (tag ? '<em class="bos-who">' + tag + "</em>" : "") +
          '</div><div class="p' + (cls ? " " + cls : "") + '">' + pc(v) + "</div>";

        /* ---- the mix, per job type: the same three chips on both cards, his pay under each deal ---- */
        const G = groupsOf(J);
        const mixFor = today => '<div class="bos-mix">' + G.map(g => {
          const n = g.W.n, has = n > 0;
          const his = today ? g.W.his : g.a.hisNet;
          return '<div class="bos-m' + (has ? "" : " off") + '"><b>' + esc(g.t.replace(" Moving", "")) + "</b>" +
            "<span>" + (has ? fmtN(n) + (n === 1 ? " job" : " jobs") : "no jobs flagged") + "</span>" +
            "<span>" + (has ? money(g.W.bill) : "\u2014") + (has ? "<small>" + money(g.W.bill / n) + " a job</small>" : "") + "</span>" +
            '<span class="his">' + (has ? money(his) + "<small>" + (today ? "his cut" : "his net") + " \u00b7 " + pct1(his / g.W.bill) + " of bill</small>" : "") + "</span></div>";
        }).join("") + "</div>";

        /* ---- one spec, two sides: v(side) is the number, tag(side) the who-pays badge ---- */
        const shareLbl = G.filter(g => g.W.n > 0).map(g => g.t.replace(" Moving", "") + " " + STATE.share[g.t] + "%").join(" \u00b7 ");
        const ROWS = [
          { l: "Revenue", sub: "the same jobs, the same bills \u2014 his " + fmtN(W.n) + " jobs", v: () => W.bill, col: () => INK, cls: "tot" },
          /* THE ONE LINE THAT MOVES. Same money, same crew, different payer. */
          { l: "Crew", sub: "foreman, driver and helpers, with the foreman's packing commission",
            v: () => W.c.crew, col: t => (t ? GREY : AMB), tag: t => (t ? "we pay" : "HE pays"), cls: "bos-crew" },
        ].concat(E.LINES.filter(x => x[0] !== "crew").map(x => ({ l: x[1], sub: x[2], v: () => W.c[x[0]], col: () => GREY })))
         .concat([
          { l: "Cost we carry", sub2: t => (t ? "everything above, crew included" : "everything above except the crew"),
            v: t => (t ? W.cost : A.oursCost), col: () => GREY, cls: "tot" },
          { l: "What he is paid", sub2: t => (t ? "his branch-owner salary on these jobs" : "his share of the bill \u2014 " + shareLbl),
            v: t => (t ? W.his : A.hisShare), col: () => HIS, cls: "tot" },
          { l: "His net", sub2: t => (t ? "nothing comes out of it \u2014 the crew is ours" : "his share minus the crew he now pays"),
            v: t => (t ? W.his : A.hisNet), col: () => HIS, cls: "tot" },
          { l: "Our profit", sub2: t => (t ? "the bill minus every cost minus his cut" : "the bill minus his share minus what we still carry"),
            v: t => (t ? W.ours : A.ours), col: () => LIME, cls: "tot" },
        ]);
        const rowsFor = today => ROWS.map(r => {
          const cls = [r.cls, today ? "" : "alt"].filter(Boolean).join(" ");
          const sub = r.sub2 ? r.sub2(today) : r.sub;
          return '<div class="l' + (cls ? " " + cls : "") + '">' + r.l + (sub ? "<small>" + sub + "</small>" : "") + "</div>" +
                 cell(r.v(today), r.col(today), cls, r.tag ? r.tag(today) : null);
        }).join("");

        const card = (today, title, hisV, hisLbl, oursV, cost) =>
          '<div class="panel"><div class="panel-head"><span class="panel-title">' + title + "</span></div>" +
          '<div class="bos-head">' +
            '<div class="bos-big"><b>' + money(W.bill) + "</b><span>revenue \u00b7 " + fmtN(W.n) + " jobs" + (byOwner.length ? " \u00b7 " + esc(byOwner.join(", ")) : "") + "</span></div>" +
            '<div class="bos-big his"><b>' + money(hisV) + "</b><span>" + hisLbl + "</span></div>" +
            '<div class="bos-big"><b>' + money(oursV) + "</b><span>our profit \u00b7 " + pc(oursV) + (today ? "" : " \u00b7 " + signed(A.oursDelta) + " vs today") + "</span></div></div>" +
          stack(cost, hisV, oursV) +
          '<div class="bos-key"><span><i style="background:' + GREY + '"></i>cost we carry ' + pc(cost) + '</span><span><i style="background:' + HIS +
            '"></i>his net ' + pc(hisV) + '</span><span><i style="background:' + LIME + '"></i>our profit ' + pc(oursV) + "</span></div>" +
          mixFor(today) +
          '<div class="bos-rows">' + rowsFor(today) + "</div></div>";

        document.getElementById("bosCards").innerHTML = '<div class="bos-wrap">' +
          card(1, "Today \u2014 he is paid a cut, we pay the crew", W.his,
               "his cut \u00b7 " + pc(W.his) + " \u00b7 " + money(W.n ? W.his / W.n : 0) + " a job", W.ours, W.cost) +
          card(0, "The alternative \u2014 he takes a share of the bill and pays the crew", A.hisNet,
               "his net after the crew \u00b7 " + money(W.n ? A.hisNet / W.n : 0) + " a job \u00b7 " + signed(A.hisDelta) + " vs today", A.ours, A.oursCost) +
          "</div>" +
          '<p class="rs-hint" style="margin:10px 2px 0">Read the two cards <b>across</b>: every line appears on both sides and only two of them move \u2014 <b>who pays the crew</b> (' +
          money(W.c.crew) + ", " + pc(W.c.crew) + ' of the bill) and <b>what he is paid</b>. Both run on one cost model, shared with the Branch Owner page, and the deals are ' +
          '<b>exactly zero-sum</b>: today ' + money(W.his + W.ours) + " is split between us, under the alternative the same " + money(A.hisNet + A.ours) + ". " +
          "Crew pay, tips and discounts come from the closing; truck, fuel and tolls are estimated from our own books.</p>";
      }

      /* ================= 3: where he makes more money ================= */
      function paintWhere() {
        const groups = groupsOf(J);
        groups.forEach(g => { const el = document.getElementById("bosEven-" + g.t.replace(/\W/g, ""));
          if (el) el.textContent = g.W.n > 0 ? "he breaks even at " + pct1(g.a.even) : "none flagged \u2014 use the Straight lever"; });
        const A = altOf(J);
        const th = (t, r) => "<th" + (r ? ' class="num"' : "") + ">" + t + "</th>", td = (v, r) => "<td" + (r ? ' class="num"' : "") + ">" + v + "</td>";
        const rowOf = g => { const W = g.W, n = W.n;
          if (!(n > 0)) return "<tr>" + td("<b>" + esc(g.t) + "</b><small>none of his jobs carry the Straight flag on the long-distance sheet \u2014 set \u201creally Straight\u201d above to price part of his long hauls here</small>") +
            td("0", 1) + td("—", 1) + td("—", 1) + td("—", 1) + td("—", 1) + td(STATE.share[g.t] + "%", 1) + td("—", 1) + td("—", 1) + td("—", 1) + td("—", 1) + "</tr>";
          return "<tr>" + td("<b>" + esc(g.t) + "</b>" + (g.assumed > 0 ? "<small>" + fmtN(g.assumed) + " of these are his Regular-typed long hauls, priced as Straight by assumption</small>" : "")) +
            td(fmtN(n), 1) + td(money(W.bill) + "<small>" + money(W.bill / n) + " a job</small>", 1) +
            td(money(W.his) + "<small>" + pct1(W.his / W.bill) + " · " + money(W.his / n) + " a job</small>", 1) +
            td(pct1(W.c.crew / W.bill) + "<small>" + money(W.c.crew / n) + " a job</small>", 1) +
            td("<b>" + pct1(g.a.even) + "</b>", 1) + td(STATE.share[g.t] + "%", 1) +
            td("<b>" + money(g.a.hisNet) + "</b><small>" + money(g.a.hisNet / n) + " a job</small>", 1) + td(signed(g.a.hisDelta), 1) +
            td(fmtN(g.ahead) + " of " + fmtN(n) + "<small>" + pct1(g.ahead / n) + " of jobs</small>", 1) + td(signed(g.a.oursDelta), 1) + "</tr>"; };
        const live = groups.filter(g => g.W.n > 0);
        const best = live.slice().sort((x, y) => y.a.hisDelta / y.W.n - x.a.hisDelta / x.W.n)[0];
        const worst = live.slice().sort((x, y) => x.a.hisDelta / x.W.n - y.a.hisDelta / y.W.n)[0];
        const verdict = !live.length ? "" :
          '<p class="bos-verdict">At these shares he ends <b>' + (A.hisDelta >= 0 ? "ahead" : "behind") + " by " + money(Math.abs(A.hisDelta)) + "</b> over these " + fmtN(A.W.n) + " jobs. " +
          (best && worst && best !== worst
            ? "He gains most on <b>" + esc(best.t) + "</b> (" + signed(best.a.hisDelta / best.W.n) + " a job) and " + (worst.a.hisDelta < 0 ? "loses" : "gains least") + " on <b>" + esc(worst.t) +
              "</b> (" + signed(worst.a.hisDelta / worst.W.n) + " a job). " : "") +
          "The deciding number is the <b>crew’s share of the bill</b>: a share of the bill only beats a cut where the crew is light against the ticket — long hauls and big local jobs — and loses on labour-heavy small ones.</p>";
        document.getElementById("bosWhere").innerHTML =
          '<div class="panel" style="margin-top:14px"><div class="panel-head"><span class="panel-title">Where he would make more money — by job type, and per job</span></div>' + verdict +
          '<div class="bos-say">The <b>break-even share</b> is where he earns exactly what he does today: it has to cover his current cut <i>plus the crew we stop paying</i>. ' +
          'Above it he gains and we lose the same amount. <b>Jobs where he is ahead</b> counts single jobs, because an average hides that a share of the bill pays well on some jobs and badly on others.</div>' +
          '<div class="rs-tablewrap"><table class="rs-table bos-tbl" data-name="Where he would make more money"><thead><tr>' +
          th("Job type") + th("Jobs", 1) + th("Total bill", 1) + th("His cut today", 1) + th("Crew, % of bill", 1) + th("Break-even share", 1) +
          th("Share tested", 1) + th("His net, alternative", 1) + th("vs today", 1) + th("Jobs where he is ahead", 1) + th("Our profit vs today", 1) +
          "</tr></thead><tbody>" + groups.map(rowOf).join("") + "</tbody><tfoot><tr>" + td("<b>All</b>") + td(fmtN(A.W.n), 1) + td(money(A.W.bill), 1) +
          td(money(A.W.his) + "<small>" + pct1(A.W.his / A.W.bill) + "</small>", 1) + td(pct1(A.W.c.crew / A.W.bill), 1) +
          td(pct1((A.W.his + A.W.c.crew) / A.W.bill), 1) + td("", 1) + td("<b>" + money(A.hisNet) + "</b>", 1) + td(signed(A.hisDelta), 1) +
          td(fmtN(groups.reduce((a, g) => a + g.ahead, 0)) + " of " + fmtN(A.W.n), 1) + td(signed(A.oursDelta), 1) + "</tr></tfoot></table></div></div>";
      }

      /* ================= 4: 2027, both deals ================= */
      function paintProjection() {
        const mount = document.getElementById("bosProj");
        const nowYm = new Date().toISOString().slice(0, 7), nextY = new Date().getFullYear() + 1;
        const closings = (closingAll || []).filter(r => r["Record Source"] === "closing" && r.Date);
        /* THE SHAPE IS TAKEN BY FAMILY, NOT BY TYPE. Regular and Straight cannot be told apart in
           the history -- the flag that separates them swung 101 / 180 / 21 across three years while
           their SUM held at 277 / 295 / 261 -- so averaging "Regular" alone would average a
           classification habit, not a business. It understated his long hauls by a third when tried.
           Long-distance is one family for the shape and the level; the split inside it is the lever's. */
        const famOf = t => (t === "Local Moving" ? "L" : "LD");
        const cnt = {};
        closings.forEach(r => { const ym = String(r.Date).slice(0, 7); if (ym >= nowYm || ym < "2024-01") return;
          const k = famOf(typeOf(r)) + "|" + ym; cnt[k] = (cnt[k] || 0) + 1; });
        const years = [...new Set(Object.keys(cnt).map(k => k.split("|")[1].slice(0, 4)))].sort();
        const coAvg = (fam, m) => { const mm = String(m).padStart(2, "0"); const v = years.map(y => cnt[fam + "|" + y + "-" + mm]).filter(x => x != null);
          return v.length ? v.reduce((acc, x) => acc + x, 0) / v.length : 0; };
        /* his level: the share of the company's jobs he ran in his FULL months (the first is a ramp, the current one is partial) */
        const hisYm = [...new Set(martAll.map(r => String(r.Date || "").slice(0, 7)).filter(Boolean))].sort();
        const full = hisYm.filter((ym, i) => i > 0 && ym < nowYm);
        const hisCnt = fam => martAll.filter(r => famOf(typeOf(r)) === fam && full.includes(String(r.Date).slice(0, 7))).length;
        const coCnt = fam => full.reduce((acc, ym) => acc + (cnt[fam + "|" + ym] || 0), 0);
        const lvl = { L: coCnt("L") ? hisCnt("L") / coCnt("L") : 0, LD: coCnt("LD") ? hisCnt("LD") / coCnt("LD") : 0 };
        /* money per job, from his own jobs, by family */
        const ratioOf = fam => { const W = E.walk(martAll.filter(r => famOf(typeOf(r)) === fam));
          return W.n ? { bill: W.bill / W.n, his: W.his / W.bill, crew: W.c.crew / W.bill, other: (W.cost - W.c.crew) / W.bill } : null; };
        const ratio = { L: ratioOf("L"), LD: ratioOf("LD") };
        const g = 1 + (+STATE.growth || 0) / 100, pS = (+STATE.straightPct || 0) / 100;
        const months = []; const tot = { jobs: 0, bill: 0, his0: 0, his1: 0, our0: 0, our1: 0 }; const byType = {};
        for (let m = 1; m <= 12; m++) { const r = { m, jobs: 0, bill: 0, his0: 0, his1: 0, our0: 0, our1: 0 };
          TYPES.forEach(t => { const fam = famOf(t), q = ratio[fam]; if (!q) return;
            const famJobs = lvl[fam] * coAvg(fam, m) * g;
            const jobs = t === "Local Moving" ? famJobs : t === "Straight Moving" ? famJobs * pS : famJobs * (1 - pS);
            if (!(jobs > 0)) return;
            const bill = jobs * q.bill, sh = shareOf(t);
            const his0 = bill * q.his, his1 = bill * (sh - q.crew), our0 = bill * (1 - q.other - q.crew - q.his), our1 = bill * (1 - sh - q.other);
            r.jobs += jobs; r.bill += bill; r.his0 += his0; r.his1 += his1; r.our0 += our0; r.our1 += our1;
            const bt = byType[t] = byType[t] || { t, jobs: 0, bill: 0, his0: 0, his1: 0, our0: 0, our1: 0 };
            bt.jobs += jobs; bt.bill += bill; bt.his0 += his0; bt.his1 += his1; bt.our0 += our0; bt.our1 += our1; });
          Object.keys(tot).forEach(k => { tot[k] += r[k]; }); months.push(r); }
        const MN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        mount.innerHTML =
          '<div class="panel" style="margin-top:14px"><div class="panel-head"><span class="panel-title">' + nextY + ' — both deals, projected</span></div>' +
          '<div class="bos-say"><b>A plain seasonal projection, on purpose.</b> He has only been with us since ' + esc(hisYm[0] || "—") + ', so he has never had a winter here: ' +
          'the <b>shape</b> of the year is the company’s — each calendar month averaged over ' + esc(years.join(", ")) + ', by job type (the method that tested best on Seasonal Planning). ' +
          'His <b>level</b> is the share of the company’s jobs he ran in his full months (' + esc(full[0] || "—") + " to " + esc(full[full.length - 1] || "—") + "): <b>" +
          pct1(lvl.L) + "</b> of local jobs and <b>" + pct1(lvl.LD) + "</b> of long-distance. Long-distance is projected as one family and split Regular / Straight by the lever at the top, " +
          'because the sheet’s own split is not reliable year to year. Money per job is his own average. ' +
          'It assumes he keeps running the same slice of our work — a baseline to argue from, not a promise.</div>' +
          '<div class="bos-ctl" style="margin-bottom:12px">' +
            '<label class="bos-fld">Growth on the baseline, %<input class="bos-in" id="bosGrowth" type="number" step="5" value="' + STATE.growth + '"><small>0 = the same slice of our work</small></label></div>' +
          '<div class="rs-kpis" id="bosProjKpis"></div><div id="bosProjChart"></div>' +
          '<div class="rs-tablewrap" style="margin-top:12px"><table class="rs-table bos-tbl" data-name="' + nextY + ' by job type"><thead><tr><th>Job type</th><th class="num">Jobs</th><th class="num">Revenue</th>' +
          '<th class="num">His pay — today’s deal</th><th class="num">His pay — alternative</th><th class="num">Difference</th><th class="num">Our profit — today’s deal</th><th class="num">Our profit — alternative</th></tr></thead><tbody>' +
          TYPES.filter(t => byType[t] && byType[t].jobs > 0).map(t => { const b = byType[t];
            return "<tr><td><b>" + esc(t) + "</b>" + (t === "Straight Moving" ? "<small>his long hauls priced as Straight, by the lever above</small>" : "") + '</td><td class="num">' + fmtN(b.jobs) +
              '</td><td class="num">' + money(b.bill) + '</td><td class="num">' + money(b.his0) + '</td><td class="num"><b>' + money(b.his1) + '</b></td><td class="num">' + signed(b.his1 - b.his0) +
              '</td><td class="num">' + money(b.our0) + '</td><td class="num">' + money(b.our1) + "</td></tr>"; }).join("") +
          '</tbody><tfoot><tr><td><b>' + nextY + '</b></td><td class="num">' + fmtN(tot.jobs) + '</td><td class="num">' + money(tot.bill) + '</td><td class="num">' + money(tot.his0) +
          '</td><td class="num"><b>' + money(tot.his1) + '</b></td><td class="num">' + signed(tot.his1 - tot.his0) + '</td><td class="num">' + money(tot.our0) + '</td><td class="num">' + money(tot.our1) + "</td></tr></tfoot></table></div></div>";

        RSC.kpis(document.getElementById("bosProjKpis"), [
          { label: nextY + " jobs", value: fmtN(tot.jobs), sub: money(tot.bill) + " revenue" },
          { label: "His pay — today’s deal", value: moneyC(tot.his0), sub: money(tot.his0) + " · " + pct1(tot.bill ? tot.his0 / tot.bill : null) + " of the bill" },
          { label: "His pay — alternative", value: moneyC(tot.his1), sub: (tot.his1 - tot.his0 >= 0 ? "+" : "−") + money(Math.abs(tot.his1 - tot.his0)) + " vs today’s deal" },
          { label: "Our profit — alternative", value: moneyC(tot.our1), sub: (tot.our1 - tot.our0 >= 0 ? "+" : "−") + money(Math.abs(tot.our1 - tot.our0)) + " vs " + money(tot.our0) },
        ]);
        RSC.chartCard(document.getElementById("bosProjChart"), {
          title: "His pay by month, " + nextY + " — today’s deal against the alternative",
          key: "bo-salary-proj",
          buildChart(canvas) {
            return new Chart(canvas, { type: "bar",
              data: { labels: MN, datasets: [
                { label: "Today’s deal", data: months.map(r => Math.round(r.his0)), backgroundColor: GREY },
                { label: "Alternative", data: months.map(r => Math.round(r.his1)), backgroundColor: HIS } ] },
              options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" },
                tooltip: { callbacks: { label: x => x.dataset.label + ": " + money(x.raw) } } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => moneyC(v) } } } } });
          },
          buildTable() {
            return RSC.table(
              [{ key: "k", label: "Month" }, { key: "jobs", label: "Jobs", align: "r", fmt: fmtN }, { key: "bill", label: "Revenue", align: "r", fmt: money },
               { key: "his0", label: "His pay — today’s deal", align: "r", fmt: money }, { key: "his1", label: "His pay — alternative", align: "r", fmt: money },
               { key: "d", label: "Difference", align: "r", fmt: money }, { key: "our0", label: "Our profit — today’s deal", align: "r", fmt: money },
               { key: "our1", label: "Our profit — alternative", align: "r", fmt: money }],
              months.map(r => Object.assign({ k: MN[r.m - 1] + " " + nextY, d: r.his1 - r.his0 }, r)),
              { k: "Total", jobs: tot.jobs, bill: tot.bill, his0: tot.his0, his1: tot.his1, d: tot.his1 - tot.his0, our0: tot.our0, our1: tot.our1 });
          },
        });
        const gi = document.getElementById("bosGrowth");
        if (gi) gi.onchange = () => { STATE.growth = gi.value === "" ? 0 : +gi.value; paintProjection();
          const n = document.getElementById("bosGrowth"); if (n) { n.focus(); try { n.select(); } catch (e) {} } };
      }

      paint();
    },
  });
})();
