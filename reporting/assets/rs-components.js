/* Reporting System — shared UI components: multi-select slicers, date range,
   KPI strip, chart cards with Graph⇄Tabular toggle, matrix/pivot renderer. */
window.RSC = (function () {
  const el = (tag, cls, html) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  };
  /* THE APOSTROPHE MATTERS. This escaped `"` but not `'`, and Calendar Cleanup builds its
     buttons with SINGLE-quoted attributes — so "Mike O'Brien" closed data-cust early, shifted
     every attribute after it, and the permanent "decline" the button files could be written
     against a different job than the one on screen. Escaping both quote characters is the fix
     for the whole kit rather than for one page, and it is safe everywhere: `&#39;` renders as
     an apostrophe in HTML, and the DOM decodes it back before any dataset read (full scan,
     2026-08-12). Nothing assigns esc() output to textContent, where the entity would show. */
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

  /* Graph⇄Tabular choice persists across re-renders (a filter change re-renders the whole
     page). Keyed by a stable card key (cfg.key or, by default, the card title) so a card
     that was flipped to Tabular comes back as Tabular, not reset to Graph. */
  const CARD_VIEW = new Map();

  /* ---------------- multi-select dropdown slicer ----------------
     values: array of strings OR {v, l, n} objects (value, display label, count). */
  function multiSelect(host, { key, label, values, onChange }) {
    const items = values.map(v => typeof v === "object" ? v : { v: v, l: v });
    const labelOf = {};
    items.forEach(i => { labelOf[i.v] = i.l; });
    const set = RS.state.multi[key] = RS.state.multi[key] || new Set();
    const wrap = el("div", "rs-slicer");
    wrap.dataset.key = key;   // lets the shell grey out slicers not used by the current page
    const btn = el("button", "rs-slicer-btn");
    const pop = el("div", "rs-slicer-pop hidden");
    const paint = () => {
      const n = set.size;
      const txt = !n ? "All"
        : n <= 2 ? [...set].map(v => labelOf[v] || v).join(", ")
        : n + " selected";
      btn.innerHTML = `<span class="lbl">${esc(label)}</span><span class="val">${esc(txt)}</span><span class="chev">▾</span>`;
      btn.classList.toggle("on", n > 0);
    };
    // RETIRED VALUES. This list is built from every loaded row, never from the date window,
    // so one lead from 2023 keeps its source in the dropdown for good — which is exactly what
    // Tornike hit: "this is no longer relevant, why does it still show?" (2026-08-07). The
    // audit found 20 such labels, not one, and the same is true of foremen who left and reps
    // who moved on. Deleting them would be worse: history has to stay selectable. So say it
    // instead — live values first, then a divider, then the retired ones with the year they
    // were last seen. The dropdown answers the question rather than posing it.
    const opt = i => `<label class="opt${i.retired ? " retired" : ""}">`
      + `<input type="checkbox" value="${esc(i.v)}" ${set.has(i.v) ? "checked" : ""}>`
      + ` <span class="ol">${esc(i.l)}</span>`
      + (i.retired && i.last ? `<span class="last">last ${esc(String(i.last))}</span>` : "")
      + (i.n != null ? `<span class="on">${Number(i.n).toLocaleString()}</span>` : "")
      + `</label>`;
    const live = items.filter(i => !i.retired), gone = items.filter(i => i.retired);
    const rowsHtml = () => `
      <div class="tools"><input type="text" class="q" placeholder="Search…">
        <button class="mini" data-a="all">All</button><button class="mini" data-a="none">Clear</button></div>
      <div class="opts">` +
      live.map(opt).join("") +
      (gone.length
        ? `<div class="opt-div">No longer in use — kept so history stays selectable</div>`
          + gone.map(opt).join("")
        : "") +
      `</div>` +
      // the numbers are raw data records (closing + moveboard rows) — say so, or people
      // will quote them as jobs or leads
      (items.some(i => i.n != null) ? `<div class="cnt-note">Numbers = records in the data (not jobs or leads)</div>` : "");
    pop.innerHTML = rowsHtml();
    const sync = () => {
      set.clear();
      pop.querySelectorAll(".opt input:checked").forEach(cb => set.add(cb.value));
      paint(); onChange();
    };
    pop.addEventListener("change", sync);
    pop.querySelector(".q").addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      pop.querySelectorAll(".opt").forEach(o => o.classList.toggle("hidden", !o.textContent.toLowerCase().includes(q)));
      // a divider with nothing under it is a heading for an empty section
      const div = pop.querySelector(".opt-div");
      if (div) {
        const anyLeft = [...pop.querySelectorAll(".opt.retired")].some(o => !o.classList.contains("hidden"));
        div.classList.toggle("hidden", !anyLeft);
      }
    });
    pop.querySelectorAll(".mini").forEach(b => b.onclick = () => {
      const on = b.dataset.a === "all";
      pop.querySelectorAll(".opt:not(.hidden) input").forEach(cb => cb.checked = on);
      sync();
    });
    btn.onclick = (e) => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop").forEach(p => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
    };
    pop.addEventListener("click", e => e.stopPropagation());
    wrap.appendChild(btn); wrap.appendChild(pop); host.appendChild(wrap);
    paint();
    return { repaint: paint };
  }

  /* ------------- single-select slicer (always exactly one value chosen) ------------- */
  function singleSelect(host, { key, label, values, defaultValue, onChange }) {
    const items = values.map(v => typeof v === "object" ? v : { v: v, l: v });
    const labelOf = {};
    items.forEach(i => { labelOf[i.v] = i.l; });
    let set = RS.state.multi[key];
    if (!set || !set.size) {
      const dv = (defaultValue != null && items.some(i => i.v === defaultValue))
        ? defaultValue : (items[0] && items[0].v);
      set = RS.state.multi[key] = new Set(dv != null ? [dv] : []);
    }
    const wrap = el("div", "rs-slicer");
    wrap.dataset.key = key;   // lets the shell grey out slicers not used by the current page
    const btn = el("button", "rs-slicer-btn on");
    const pop = el("div", "rs-slicer-pop hidden");
    const current = () => [...set][0];
    const paint = () => {
      btn.innerHTML = `<span class="lbl">${esc(label)}</span><span class="val">${esc(labelOf[current()] || current() || "—")}</span><span class="chev">▾</span>`;
      pop.querySelectorAll(".opt").forEach(o =>
        o.classList.toggle("sel", o.dataset.v === String(current())));
    };
    pop.innerHTML = `<div class="opts">` + items.map(i =>
      `<div class="opt" data-v="${esc(i.v)}"><span class="ol">${esc(i.l)}</span>${i.n != null ? `<span class="on">${Number(i.n).toLocaleString()}</span>` : ""}</div>`).join("") + `</div>` +
      (items.some(i => i.n != null) ? `<div class="cnt-note">Numbers = records in the data (not jobs or leads)</div>` : "");
    pop.querySelectorAll(".opt").forEach(o => o.onclick = () => {
      set.clear(); set.add(o.dataset.v);
      paint(); pop.classList.add("hidden"); onChange();
    });
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop").forEach(p => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
    };
    pop.addEventListener("click", e => e.stopPropagation());
    wrap.appendChild(btn); wrap.appendChild(pop); host.appendChild(wrap);
    paint();
    return { repaint: paint };
  }

  /* ---------------- date filter: Money-Flow-style 📅 button + preset popover ----------------
     Tornike 2026-07-23: "make sure period selector is easy, as we did for Money Flow" —
     one compact button showing the active period; the popover holds one-click presets,
     a custom from→to with Apply, and the day-of-month pacing inputs. Same visual pattern
     as money-flow.js's mfDtBtn/mf-dtpop (rs-datebtn/rs-datepop in rs.css). */
  /* THE PRESET LADDER, in one place. Both date controls read it: the global slicer bar and
     the page-owned range picker below. Money Flow hand-rolls the same six ranges with the
     same wording, and that is the drift this exists to stop -- one page saying "Last 3
     months" while another says "Past 90 days" is the kind of difference nobody decides on
     purpose. Dates are computed at CALL time, never cached: a tab left open past midnight
     would otherwise offer "This month" ending yesterday. */
  function datePresets() {
    const iso = d => d.toLocaleDateString("en-CA");
    const now = new Date();
    const today = iso(now);
    const b3 = new Date(now); b3.setMonth(b3.getMonth() - 3);
    return [
      ["All time", "", ""],
      ["This month", iso(new Date(now.getFullYear(), now.getMonth(), 1)), today],
      ["Past month", iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
       iso(new Date(now.getFullYear(), now.getMonth(), 0))],
      ["Last 3 months", iso(b3), today],
      ["This year", now.getFullYear() + "-01-01", today],
      ["Last year", (now.getFullYear() - 1) + "-01-01", (now.getFullYear() - 1) + "-12-31"],
    ];
  }

  /* ---------------- page-owned date range ----------------
     The same button-and-popover the global slicer bar uses, but the range belongs to the
     CALLER, not to RS.state. That distinction is the whole reason this exists: a page with
     its own filters (Referrals, and Money Flow when it joins the kit) must be able to offer
     a date range without writing into the global filter -- otherwise picking "This month"
     on one page silently narrows the Monthly Report the next time it is opened.

     opts: { get() -> {from, to}, set(from, to), onChange(), presets?, icon? }
     Returns { repaint }. Safe to mount again after a full innerHTML repaint -- pages that
     rebuild their bar every paint simply call it again on the fresh host. */
  function dateRange(host, opts) {
    const PRESETS = opts.presets || datePresets();
    const wrap = el("div", "rs-dtwrap");
    const cur = () => opts.get() || {};
    const label = () => {
      const f = cur().from || "", t = cur().to || "";
      if (!f && !t) return "All time";
      const hit = PRESETS.find(p => p[1] === f && p[2] === t);
      return hit ? hit[0] : (f || "…") + " → " + (t || "…");
    };
    wrap.innerHTML = `
      <button class="rs-datebtn" type="button"></button>
      <div class="rs-datepop hidden">
        <div class="pre">${PRESETS.map((p, i) =>
          `<button type="button" data-p="${i}">${esc(p[0])}</button>`).join("")}</div>
        <div class="rng"><input type="date" class="from"><span>→</span><input type="date" class="to"></div>
        <button class="apply" type="button">Apply this range</button>
      </div>`;
    const btn = wrap.querySelector(".rs-datebtn"), pop = wrap.querySelector(".rs-datepop");
    const from = wrap.querySelector(".from"), to = wrap.querySelector(".to");
    const paint = () => {
      const c = cur();
      from.value = c.from || ""; to.value = c.to || "";
      btn.innerHTML = (opts.icon === false ? "" : "📅 ") + esc(label()) + " ▾";
      btn.classList.toggle("on", !!(c.from || c.to));
      pop.querySelectorAll(".pre button").forEach(b => {
        const p = PRESETS[+b.dataset.p];
        b.classList.toggle("on", p[1] === (c.from || "") && p[2] === (c.to || ""));
      });
    };
    const commit = (f, t) => {
      pop.classList.add("hidden");
      opts.set(f || null, t || null);
      paint();
      opts.onChange();
    };
    pop.querySelectorAll(".pre button").forEach(b => b.onclick = () => {
      const p = PRESETS[+b.dataset.p];
      commit(p[1], p[2]);
    });
    wrap.querySelector(".apply").onclick = () => commit(from.value, to.value);
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop, .rs-datepop").forEach(x => {
        if (x !== pop) x.classList.add("hidden");
      });
      pop.classList.toggle("hidden");
    };
    pop.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => pop.classList.add("hidden"));
    host.appendChild(wrap);
    paint();
    return { repaint: paint };
  }

  function dateBar(host, onChange) {
    // rs-dtwrap ONLY. This wrapper used to carry both classes: .rs-daterange styles the old
    // inline from/to field (border, background, 34px height, display:inline-flex) and
    // .rs-dtwrap, declared later in rs.css, overrode that display with inline-block -- so the
    // flex centering never applied and the legacy field chrome drew a second box around the
    // one compact date button that replaced it. The wrapper needs position:relative for the
    // popover and nothing else.
    const wrap = el("div", "rs-dtwrap");
    const PRESETS = datePresets();      // the one ladder, shared with dateRange
    const label = () => {
      const f = RS.state.dateFrom || "", t = RS.state.dateTo || "";
      if (!f && !t) return "All time";
      const hit = PRESETS.find(p => p[1] === f && p[2] === t);
      return hit ? hit[0] : (f || "…") + " → " + (t || "…");
    };
    wrap.innerHTML = `
      <button class="rs-datebtn" type="button"></button>
      <div class="rs-datepop hidden">
        <div class="pre">${PRESETS.map((p, i) =>
          `<button type="button" data-p="${i}">${esc(p[0])}</button>`).join("")}</div>
        <div class="rng"><input type="date" class="from"><span>→</span><input type="date" class="to"></div>
        <div class="dayrow" title="Day of month — e.g. 1–15 compares the first half of every month (pacing)">
          <span>Day of month</span>
          <input type="number" class="dayf" min="1" max="31" placeholder="1"><span>–</span>
          <input type="number" class="dayt" min="1" max="31" placeholder="31"></div>
        <button class="apply" type="button">Apply this range</button>
      </div>`;
    const btn = wrap.querySelector(".rs-datebtn"), pop = wrap.querySelector(".rs-datepop");
    const from = wrap.querySelector(".from"), to = wrap.querySelector(".to");
    const dayf = wrap.querySelector(".dayf"), dayt = wrap.querySelector(".dayt");
    const paintBtn = () => {
      const dayOn = RS.state.dayFrom != null || RS.state.dayTo != null;
      btn.innerHTML = "📅 " + esc(label()) + (dayOn ? " · day " + (RS.state.dayFrom || 1) + "–" + (RS.state.dayTo || 31) : "") + " ▾";
      btn.classList.toggle("on", !!(RS.state.dateFrom || RS.state.dateTo || dayOn));
      pop.querySelectorAll(".pre button").forEach(b => {
        const p = PRESETS[+b.dataset.p];
        b.classList.toggle("on", p[1] === (RS.state.dateFrom || "") && p[2] === (RS.state.dateTo || ""));
      });
    };
    const sync = () => {
      RS.state.dateFrom = from.value || null;
      RS.state.dateTo = to.value || null;
      RS.state.dayFrom = dayf.value ? +dayf.value : null;
      RS.state.dayTo = dayt.value ? +dayt.value : null;
      paintBtn(); onChange();
    };
    pop.querySelectorAll(".pre button").forEach(b => b.onclick = () => {
      const p = PRESETS[+b.dataset.p];
      from.value = p[1]; to.value = p[2];
      pop.classList.add("hidden"); sync();
    });
    wrap.querySelector(".apply").onclick = () => { pop.classList.add("hidden"); sync(); };
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop").forEach(p => p.classList.add("hidden"));
      pop.classList.toggle("hidden");
    };
    pop.addEventListener("click", e => e.stopPropagation());
    document.addEventListener("click", () => pop.classList.add("hidden"));
    host.appendChild(wrap);
    paintBtn();
    return {
      clear() { from.value = to.value = dayf.value = dayt.value = ""; sync(); },
      /* Set the range from OUTSIDE the bar and keep the button honest. The shell uses this to
         open a page on a sensible default; without a repaint the button would still read
         "All time" over data that had already been filtered, which is the worst of both. */
      set(f, t, opts) {
        from.value = f || ""; to.value = t || "";
        RS.state.dateFrom = f || null;
        RS.state.dateTo = t || null;
        paintBtn();
        if (!opts || opts.silent !== true) onChange();
      },
      /* the preset list, so a caller can name a range instead of recomputing its dates and
         drifting out of step with the button's own labels */
      preset(name) { return PRESETS.find(p => p[0] === name) || null; },
    };
  }

  /* ---------------- KPI strip ---------------- */
  /* KPI strip. items: [{label, value, sub?, tone?}] — `value` may carry markup, the rest is escaped.
     BALANCED ROWS, not auto-fit. `repeat(auto-fit,minmax(150px,1fr))` looks fine at 1400px and
     falls apart on a 2560px screen: five cards land 4 + 1, and the orphan stretches the full
     width on its own row. So the column count is computed to divide evenly — five cards are
     5 across, seven become 4 + 3, never 6 + 1. Below 1400px a media query hands it back to
     auto-fit, where wrapping is the right answer. */
  function kpis(host, items) {
    const n = items.length;
    const MAX = 6;                                  // beyond six the label stops being readable
    const rows = Math.ceil(n / MAX) || 1;
    host.style.setProperty("--kpi-cols", Math.ceil(n / rows));
    host.innerHTML = items.map(x =>
      `<div class="kpi${x.tone ? " " + x.tone : ""}"><div class="l">${esc(x.label)}</div>`
      + `<div class="v">${x.value}</div>`
      + `<div class="s">${esc(x.sub || "")}</div></div>`
    ).join("");
  }

  /* ---------------- chart card with Graph ⇄ Tabular toggle ---------------- */
  /* cfg: { title, controlsHtml?, buildChart(canvas) -> Chart, buildTable() -> html } */
  function chartCard(host, cfg) {
    const card = el("div", "panel");
    card.innerHTML = `
      <div class="panel-head">
        <span class="panel-title">${esc(cfg.title)}</span>
        <span class="rs-ctl"></span>
        <span class="spacer"></span>
        <button class="btn on tg-g">▮ Graph</button><button class="btn tg-t">▤ Tabular</button>
      </div>
      <div class="gview"><div class="chartbox"><canvas></canvas></div></div>
      <div class="tview hidden"><div class="tabwrap"></div></div>`;
    host.appendChild(card);
    if (cfg.controlsHtml) card.querySelector(".rs-ctl").innerHTML = cfg.controlsHtml;
    let chart = null;
    const viewKey = cfg.key || cfg.title || "";
    const g = card.querySelector(".gview"), t = card.querySelector(".tview");
    const bg = card.querySelector(".tg-g"), bt = card.querySelector(".tg-t");
    // restore the remembered view (defaults to Graph) BEFORE the first render below
    if (CARD_VIEW.get(viewKey) === "table") {
      t.classList.remove("hidden"); g.classList.add("hidden");
      bt.classList.add("on"); bg.classList.remove("on");
    }
    const render = () => {
      const tabular = !t.classList.contains("hidden");
      // Hide graph-only controls (e.g. a "Calculate by" that only drives the chart)
      // when the tabular view is showing — they do nothing there.
      const ctl = card.querySelector(".rs-ctl");
      if (ctl && cfg.controlsGraphOnly) ctl.style.display = tabular ? "none" : "";
      if (!tabular) {
        if (chart) chart.destroy();
        chart = cfg.buildChart(card.querySelector("canvas"));
      } else {
        card.querySelector(".tabwrap").innerHTML = cfg.buildTable();
      }
    };
    bg.onclick = () => { g.classList.remove("hidden"); t.classList.add("hidden"); bg.classList.add("on"); bt.classList.remove("on"); CARD_VIEW.set(viewKey, "graph"); render(); };
    bt.onclick = () => { t.classList.remove("hidden"); g.classList.add("hidden"); bt.classList.add("on"); bg.classList.remove("on"); CARD_VIEW.set(viewKey, "table"); render(); };
    render();
    return { rerender: render, card };
  }

  /* ---------------- simple measure table ---------------- */
  /* rows: [{k, ...cols}], columns: [{key, label, fmt?, align?}] with a totals row. */
  function table(columns, rows, totals) {
    const th = "<tr>" + columns.map(c => `<th class="${c.align || ''}">${esc(c.label)}</th>`).join("") + "</tr>";
    const body = rows.map(r => "<tr>" + columns.map(c => {
      const v = r[c.key];
      return `<td class="${c.align || ''}">${c.fmt ? c.fmt(v) : (v == null ? "—" : esc(v))}</td>`;
    }).join("") + "</tr>").join("");
    const foot = totals ? "<tfoot><tr>" + columns.map(c => {
      const v = totals[c.key];
      return `<td class="${c.align || ''}">${v == null ? "" : (c.fmt ? c.fmt(v) : esc(v))}</td>`;
    }).join("") + "</tr></tfoot>" : "";
    return `<table class="tab"><thead>${th}</thead><tbody>${body}</tbody>${foot}</table>`;
  }

  /* ---------------- page scroller sizing: --pg-chrome ----------------
     Seven scrollers across five pages baked their height as calc(100vh - NNNpx). Those
     constants are hand-measured offsetTops — right for one arrangement of the chrome above
     them, wrong the moment a bar or the sidebar collapses. Measure the same quantity instead:
     the distance from the top of the viewport to the scroller, unscrolled. Deliberately NOT
     including what sits BELOW (pagers, footnotes): that would shrink every table on load,
     which is a different change from the one asked for — expanded must look like today.
     The CSS keeps its old number as the var fallback, so the first paint is unchanged. */
  function fitScroller(el) {
    if (!el || !el.offsetParent) return;   // display:none measures as 0 and would collapse it
    if (!window.innerHeight) return;       // no laid-out viewport = no measurement, not a zero one
    el.setAttribute("data-rsfit", "1");
    const sc = el.closest(".rs-content");
    // + scrollTop so a page the user has already scrolled measures the same as one at rest
    const top = el.getBoundingClientRect().top + (sc ? sc.scrollTop : (window.scrollY || 0));
    // never measure a scroller out of existence — on a short window the chrome above can
    // exceed the viewport, and a negative height would show nothing at all
    el.style.setProperty("--pg-chrome",
      Math.round(Math.min(Math.max(top, 0), Math.max(0, window.innerHeight - 200))) + "px");
  }
  /* Re-measure every scroller currently on screen. The registry IS the DOM (the attribute
     above) — pages rebuild their tables wholesale, so a JS list of elements would leak. */
  function fit() { document.querySelectorAll("[data-rsfit]").forEach(fitScroller); }

  /* Charts and maps size themselves once and never look again. Chart.js has a
     ResizeObserver, Leaflet does not, and neither is told anything by display:none. */
  function reflow() {
    fit();
    try { Object.values(Chart.instances || {}).forEach(c => { try { c.resize(); } catch (e) {} }); } catch (e) {}
    // Leaflet keeps no registry and each page parks its map on its own container property
    // (_ldmap on LD Planning, _m on Cleanup) — so find it by shape, not by name.
    document.querySelectorAll(".leaflet-container").forEach(n => {
      Object.keys(n).forEach(k => {
        const v = n[k];
        if (v && typeof v.invalidateSize === "function") { try { v.invalidateSize(); } catch (e) {} }
      });
    });
  }
  /* Same, for a change that ANIMATES. CSS transitions do not run in a backgrounded tab, so
     transitionend may never arrive — the timeout is the real path there, not a fallback
     (the visibilityState guard in monthly-report.js is the same trap). */
  function reflowAfter(el) {
    reflow();
    let done = false;
    const fire = () => { if (done) return; done = true; reflow(); };
    if (el) el.addEventListener("transitionend", fire, { once: true });
    setTimeout(fire, 250);
  }
  let fitQueued = false;
  window.addEventListener("resize", () => {
    if (fitQueued) return;
    fitQueued = true;
    requestAnimationFrame(() => { fitQueued = false; fit(); });
  });

  /* ---------------- collapsible filter bar ----------------
     A hidden bar that is still filtering is a lie about the numbers underneath it, so the
     collapsed state always says what is on. cfg.count() returns {n, labels, scope} — or
     null when the page cannot count its own filters, and then the pill says exactly that
     rather than showing a reassuring zero.
     The toggle mounts INSIDE the bar as its first child: a separate row above it would
     cost as much height as collapsing the bar saves. Controls the page must not swallow
     (a Run button, a live status) stay visible by carrying .rs-ckeep in the page's markup.
     cfg.host parks the toggle in a DIFFERENT row that stays — the two-row bars (Money Flow,
     LD Planning) put it beside the view switcher, so collapsing buys a whole row back
     instead of trading one row for another. */
  function collapsible(bar, storeKey, cfg) {
    cfg = cfg || {};
    if (!bar) return null;
    // Idempotent so pages can repaint freely -- but the flag alone is not proof. It says
    // "collapsible ran here once", not "its toggle is still in the document", and those came
    // apart the moment a host row was rebuilt underneath us: the flag said mounted, the button
    // was gone, and Hide filters silently did not exist. Trust the DOM, not the memory of it.
    if (bar.dataset.rscBar) {
      const prev = bar.__rscBar || null;
      if (prev && prev.row && prev.row.isConnected) return prev;
      delete bar.dataset.rscBar;                            // toggle was destroyed -> remount
    }
    bar.dataset.rscBar = "1";
    let key = storeKey;
    const host = cfg.host || bar;
    const row = el("div", "rs-cbar");
    const btn = el("button", "rs-ctog");
    btn.type = "button";
    const pill = el("span", "rs-cpill");
    row.appendChild(btn); row.appendChild(pill);
    host.insertBefore(row, host.firstChild);

    const read = () => { try { return localStorage.getItem(key) === "1"; } catch (e) { return false; } };
    const summary = () => {
      let c = null;
      try { c = cfg.count ? cfg.count() : null; } catch (e) { c = null; }
      if (typeof c === "number") c = { n: c };
      if (!c || c.n == null) return { cls: " unknown", text: "Filters hidden — open to check" };
      const scope = c.scope ? " · " + c.scope : "";
      if (!c.n) return { cls: " none", text: "No filters" + scope };
      const labels = (c.labels && c.labels.length) ? " · " + c.labels.join(", ") : "";
      return { cls: "", text: c.n + (c.n === 1 ? " filter active" : " filters active") + labels + scope };
    };
    const paint = () => {
      const off = host.classList.contains("rs-bar-off");
      // SAY WHAT IT DOES, not what it sits next to. The first version was labelled "Filters",
      // which reads as a heading for the row rather than a control -- Tornike looked straight
      // at it and reported the button missing. A verb and a state fix that on their own.
      const lbl = cfg.label || "filters";
      btn.innerHTML = `<span class="rs-ccar">▾</span>${esc(off ? "Show " + lbl : "Hide " + lbl)}`;
      btn.setAttribute("aria-expanded", off ? "false" : "true");
      btn.title = off ? "Show the filters" : "Hide the filters";
      const s = summary();
      pill.className = "rs-cpill" + s.cls;
      pill.textContent = s.text;
      pill.style.display = off ? "" : "none";
    };
    const set = (off, persist) => {
      host.classList.toggle("rs-bar-off", off);
      // hosted elsewhere = the whole bar goes; hosting the toggle itself = everything in it
      // goes except the toggle and the page's keepers
      if (bar === host) bar.classList.toggle("rs-bar-min", off);
      else bar.classList.toggle("rs-cx-hide", off);
      (cfg.also || []).forEach(n => { if (n) n.classList.toggle("rs-cx-hide", off); });
      if (persist) { try { localStorage.setItem(key, off ? "1" : "0"); } catch (e) {} }
      paint();
    };
    btn.onclick = () => { set(!host.classList.contains("rs-bar-off"), true); reflow(); };
    set(read(), false);
    const api = {
      refresh: paint,
      /* the toggle row itself, so a caller -- and the remount guard above -- can ask the
         DOM whether this bar is still really mounted instead of trusting a flag */
      row,
      /* the global bar is one element shared by every page, so its remembered state has to
         follow the page you are on.
         It re-reads on EVERY call, not only when the key string changes. It used to bail
         early on an unchanged key, so when two bars shared a storage cell, un-hiding one left
         the other showing collapsed until something else happened to move the key. */
      rekey(k) { if (k) key = k; set(read(), false); },
      /* Offer the control, or don't. A page whose content is SELECTED by one of these filters
         must not be able to hide them — see NO_BAR_COLLAPSE in index.html. Turning it off does
         two things, and the second is the one that matters: it hides the toggle, AND it forces
         the bar OPEN without persisting. This is ONE bar shared by every page, so a state
         collapsed on Custom Breakdown would otherwise follow you to a page that has no button
         left to undo it — filters gone, no way back. `persist:false` also means the other
         page's preference survives being visited here. */
      setEnabled(on, k) {
        if (k) key = k;
        row.style.display = on ? "" : "none";
        set(on ? read() : false, false);
      },
      /* re-read the stored state without changing key -- for a caller that knows something
         else may have written the same cell */
      sync() { set(read(), false); },
    };
    bar.__rscBar = api;
    return api;
  }

  /* ---------------- matrix: rowDim × month columns for one measure ---------------- */
  function matrix(rows, rowCol, measureName, opts) {
    opts = opts || {};
    const m = RS.M[measureName];
    const months = [...new Set(rows.map(r => r._y + "-" + String(r._m).padStart(2, "0")))].sort();
    const shown = months.slice(-(opts.lastN || 13));
    const byRow = {};
    rows.forEach(r => {
      const k = r[rowCol] == null || r[rowCol] === "" ? "—" : String(r[rowCol]);
      const mm = r._y + "-" + String(r._m).padStart(2, "0");
      ((byRow[k] = byRow[k] || {})[mm] = byRow[k][mm] || []).push(r);
    });
    const entries = Object.entries(byRow)
      .map(([k, mm]) => ({ k, total: m.fn(Object.values(mm).flat()), mm }))
      .sort((a, b) => (b.total || 0) - (a.total || 0));
    let html = `<table class="tab"><thead><tr><th>${esc(opts.rowLabel || rowCol)}</th>` +
      shown.map(s => `<th>${RS.monthName(+s.slice(5))} ${s.slice(2, 4)}</th>`).join("") +
      `<th>Total</th></tr></thead><tbody>`;
    entries.forEach(e => {
      html += `<tr><td>${esc(e.k)}</td>` + shown.map(s =>
        `<td>${e.mm[s] ? m.fmt(m.fn(e.mm[s])) : "—"}</td>`).join("") +
        `<td><b>${m.fmt(e.total)}</b></td></tr>`;
    });
    const all = Object.values(byRow).flatMap(mm => Object.values(mm)).flat();
    html += `</tbody><tfoot><tr><td>Total</td>` + shown.map(s => {
      const rs = rows.filter(r => (r._y + "-" + String(r._m).padStart(2, "0")) === s);
      return `<td>${m.fmt(m.fn(rs))}</td>`;
    }).join("") + `<td>${m.fmt(m.fn(all))}</td></tr></tfoot></table>`;
    return html;
  }

  document.addEventListener("click", () =>
    document.querySelectorAll(".rs-slicer-pop").forEach(p => p.classList.add("hidden")));

  return { el, esc, multiSelect, singleSelect, dateBar, dateRange, datePresets,
           kpis, chartCard, table, matrix,
           collapsible, fitScroller, fit, reflow, reflowAfter };
})();
