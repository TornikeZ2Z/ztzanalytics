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
      // a slicer the shell greyed out (rs-off: pinned by the page, or its field is not in
      // any of the page's datasets) must not open at all — the popover sits INSIDE the
      // wrapper, so it inherits the .38 disabled opacity and renders as a ghost floating
      // over the tiles (caught live on CL Analysis, 2026-08-27). The hover title keeps
      // explaining WHY it is off; the click just stops pretending it works.
      if (wrap.classList.contains("rs-off")) return;
      document.querySelectorAll(".rs-slicer-pop").forEach(p => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
    };
    pop.addEventListener("click", e => e.stopPropagation());
    wrap.appendChild(btn); wrap.appendChild(pop); host.appendChild(wrap);
    paint();
    return { repaint: paint };
  }

  /* ------------- page-local single-select dropdown -------------
     The slicer LOOK (button + popover + searchable options) without the slicer STATE:
     multiSelect/singleSelect write into RS.state.multi, which is the GLOBAL filter bar —
     a page-local filter using them would grow chips in the global bar and be swept by
     "Clear all". Pages kept solving this with a bare <input>/<select> instead, which is
     how a naked browser dropdown ended up beside kit components on CL Analysis (his
     "wtf is this foreman dropdown", 2026-08-27). This is the kit answer: same vocabulary,
     state owned by the caller. `allLabel` is the empty choice; search appears past 8
     options; returns {set(v), get()} so a re-render can restore the selection. */
  function localSelect(host, { label, values, value, allLabel, onChange, form, required }) {
    // {div:"Title"} entries render as section headings (the multiSelect's .opt-div) so a
    // long list — Custom Breakdown offers 20+ measures — reads in groups, not as a wall
    const items = (values || []).map(v => typeof v === "object" ? v : { v: v, l: v });
    let cur = value || "";
    // form:true = an input-shaped field INSIDE a form (its label lives above it, so the
    // button carries only the value); required:true = no "All"/empty row.
    const wrap = el("div", "rs-slicer" + (form ? " rs-form" : ""));
    const btn = el("button", "rs-slicer-btn");
    btn.type = "button";                      // a bare <button> inside a <form> submits it
    const pop = el("div", "rs-slicer-pop hidden");
    const paint = () => {
      const it = items.find(i => i.v === cur);
      btn.innerHTML = (form ? "" : `<span class="lbl">${esc(label)}</span>`)
        + `<span class="val">${esc(it ? it.l : (allLabel || (form ? "—" : "All")))}</span>`
        + `<span class="chev">▾</span>`;
      btn.classList.toggle("on", !form && !!cur);
      pop.querySelectorAll(".opt").forEach(o =>
        o.classList.toggle("sel", o.dataset.v === String(cur)));
    };
    const withSearch = items.filter(i => !i.div).length > 8;
    pop.innerHTML = (withSearch
        ? `<div class="tools"><input class="q" placeholder="Search…"></div>` : "")
      + `<div class="opts">`
      + (required ? "" : `<div class="opt" data-v=""><span class="ol">${esc(allLabel || (form ? "—" : "All"))}</span></div>`)
      + items.map(i => i.div
          ? `<div class="opt-div">${esc(i.div)}</div>`
          : `<div class="opt" data-v="${esc(i.v)}"><span class="ol">${esc(i.l)}</span>`
            + (i.n != null ? `<span class="on">${Number(i.n).toLocaleString()}</span>` : "")
            + `</div>`).join("")
      + `</div>`;
    pop.querySelectorAll(".opt").forEach(o => o.onclick = () => {
      cur = o.dataset.v;
      paint(); pop.classList.add("hidden");
      if (onChange) onChange(cur);
    });
    const q = pop.querySelector(".q");
    if (q) q.oninput = () => {
      const needle = q.value.toLowerCase();
      pop.querySelectorAll(".opt").forEach(o => {
        if (!o.dataset.v) return;      // the All row always stays
        o.classList.toggle("hidden",
          needle && o.textContent.toLowerCase().indexOf(needle) < 0);
      });
      // a heading over a fully-hidden section is noise; while searching, drop them all
      pop.querySelectorAll(".opt-div").forEach(d => d.classList.toggle("hidden", !!needle));
    };
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop").forEach(p => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
      if (!pop.classList.contains("hidden") && q) { q.value = ""; q.oninput(); q.focus(); }
    };
    pop.addEventListener("click", e => e.stopPropagation());
    wrap.appendChild(btn); wrap.appendChild(pop); host.appendChild(wrap);
    paint();
    return { set(v) { cur = v || ""; paint(); }, get() { return cur; } };
  }

  /* ------------- page-local MULTI-select dropdown -------------
     localSelect's sibling: the multiSelect LOOK (checkboxes, counts, search, All/Clear)
     with state owned by the CALLER, never RS.state.multi. Built for Custom Breakdown's
     page filters, which until now were collected through window.prompt — the one control
     in the portal with no design system at all. `values` takes strings or {v,l,n};
     `selected` is an array or Set; onChange receives the current Set. */
  function localMulti(host, { label, values, selected, onChange, emptyLabel, startOpen }) {
    const items = (values || []).map(v => typeof v === "object" ? v : { v: v, l: v });
    const labelOf = {};
    items.forEach(i => { labelOf[i.v] = i.l; });
    const set = new Set(selected instanceof Set ? [...selected] : (selected || []));
    const wrap = el("div", "rs-slicer");
    const btn = el("button", "rs-slicer-btn");
    btn.type = "button";
    const pop = el("div", "rs-slicer-pop hidden");
    const paint = () => {
      const n = set.size;
      const txt = !n ? (emptyLabel || "All")
        : n <= 2 ? [...set].map(v => labelOf[v] || v).join(", ")
        : n + " selected";
      btn.innerHTML = `<span class="lbl">${esc(label)}</span><span class="val">${esc(txt)}</span><span class="chev">▾</span>`;
      btn.classList.toggle("on", n > 0);
    };
    const opt = i => `<label class="opt">`
      + `<input type="checkbox" value="${esc(i.v)}" ${set.has(i.v) ? "checked" : ""}>`
      + ` <span class="ol">${esc(i.l)}</span>`
      + (i.n != null ? `<span class="on">${Number(i.n).toLocaleString()}</span>` : "")
      + `</label>`;
    pop.innerHTML = `
      <div class="tools"><input type="text" class="q" placeholder="Search…">
        <button type="button" class="mini" data-a="all">All</button>
        <button type="button" class="mini" data-a="none">Clear</button></div>
      <div class="opts">` + items.map(opt).join("") + `</div>`;
    const sync = () => {
      set.clear();
      pop.querySelectorAll(".opt input:checked").forEach(cb => set.add(cb.value));
      paint(); if (onChange) onChange(set);
    };
    pop.addEventListener("change", sync);
    pop.querySelector(".q").addEventListener("input", e => {
      const q = e.target.value.toLowerCase();
      pop.querySelectorAll(".opt").forEach(o =>
        o.classList.toggle("hidden", !o.textContent.toLowerCase().includes(q)));
    });
    pop.querySelectorAll(".mini").forEach(b => b.onclick = () => {
      const on = b.dataset.a === "all";
      pop.querySelectorAll(".opt:not(.hidden) input").forEach(cb => cb.checked = on);
      sync();
    });
    btn.onclick = e => {
      e.stopPropagation();
      document.querySelectorAll(".rs-slicer-pop").forEach(p => { if (p !== pop) p.classList.add("hidden"); });
      pop.classList.toggle("hidden");
      const q = pop.querySelector(".q");
      if (!pop.classList.contains("hidden") && q) { q.value = ""; q.dispatchEvent(new Event("input")); q.focus(); }
    };
    pop.addEventListener("click", e => e.stopPropagation());
    wrap.appendChild(btn); wrap.appendChild(pop); host.appendChild(wrap);
    paint();
    // startOpen: a page that fully re-renders on every change (Custom Breakdown) remounts
    // this control mid-edit; opening the fresh popover keeps the reader's checkbox session
    // alive instead of slamming the door after every tick. The kit's document-level click
    // handler still closes it the moment they click anywhere else.
    if (startOpen) pop.classList.remove("hidden");
    return { get() { return new Set([...set]); },
             set(v) { set.clear(); (v instanceof Set ? [...v] : (v || [])).forEach(x => set.add(x));
                      pop.querySelectorAll(".opt input").forEach(cb => cb.checked = set.has(cb.value));
                      paint(); } };
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
      if (wrap.classList.contains("rs-off")) return;   // same ghost-popover guard as above
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

  /* ------------- the kit's dialogs: confirm / ask / notice -------------
     The browser's confirm()/prompt()/alert() cannot be styled, freeze the tab, and read
     as a different application butting in (his standing rule, 2026-08-28: nothing native
     is left on the portal). These are the ONE replacement: a promise-based modal in the
     kit vocabulary. `confirm` resolves true/false; `ask` resolves the string or null;
     `notice` just resolves. Escape and the backdrop both mean "no". */
  function _dlg({ title, body, input, value, placeholder, yes, no, danger, noCancel }) {
    return new Promise(resolve => {
      const mask = el("div", "rs-dlg-mask");
      const box = el("div", "rs-dlg");
      box.innerHTML = (title ? `<div class="rs-dlg-t">${esc(title)}</div>` : "")
        + (body ? `<div class="rs-dlg-b">${esc(body)}</div>` : "")
        + (input ? `<input class="rs-dlg-in" value="${esc(value || "")}" placeholder="${esc(placeholder || "")}">` : "")
        + `<div class="rs-dlg-a">`
        + (noCancel ? "" : `<button type="button" class="rs-btn" data-a="no">${esc(no || "Cancel")}</button>`)
        + `<button type="button" class="rs-btn ${danger ? "danger" : "pri"}" data-a="yes">${esc(yes || "OK")}</button>`
        + `</div>`;
      mask.appendChild(box);
      document.body.appendChild(mask);
      const inp = box.querySelector(".rs-dlg-in");
      const done = ok => {
        document.removeEventListener("keydown", onKey, true);
        mask.remove();
        resolve(input ? (ok ? String(inp.value) : null) : ok);
      };
      const onKey = e => {
        if (e.key === "Escape") { e.stopPropagation(); done(false); }
        if (e.key === "Enter" && (input ? e.target === inp : true)) { e.stopPropagation(); done(true); }
      };
      document.addEventListener("keydown", onKey, true);
      mask.onclick = e => { if (e.target === mask) done(false); };
      box.querySelector('[data-a="yes"]').onclick = () => done(true);
      const nb = box.querySelector('[data-a="no"]');
      if (nb) nb.onclick = () => done(false);
      if (inp) { inp.focus(); inp.select(); }
      else box.querySelector('[data-a="yes"]').focus();
    });
  }
  const confirmDlg = opts => _dlg(typeof opts === "string" ? { body: opts } : opts);
  const askDlg = opts => _dlg(Object.assign({ input: true },
    typeof opts === "string" ? { body: opts } : opts));
  const noticeDlg = opts => _dlg(Object.assign({ noCancel: true },
    typeof opts === "string" ? { body: opts } : opts));
  if (!document.getElementById("rs-dlg-css")) {
    const st = document.createElement("style");
    st.id = "rs-dlg-css";
    st.textContent = [
      ".rs-dlg-mask{position:fixed;inset:0;z-index:400;background:rgba(8,12,20,.55);",
      "display:flex;align-items:center;justify-content:center;padding:20px}",
      ".rs-dlg{background:var(--panel,#fff);border:1px solid var(--line-2,#d8dee8);border-radius:16px;",
      "box-shadow:0 24px 64px rgba(0,0,0,.35);max-width:440px;width:100%;padding:20px 22px;",
      "color:var(--ink,#16202c)}",
      ".rs-dlg-t{font-size:15px;font-weight:800;margin-bottom:8px}",
      ".rs-dlg-b{font-size:13px;line-height:1.6;color:var(--muted,#5b6b7c);white-space:pre-line}",
      ".rs-dlg-in{width:100%;margin-top:12px;border:1px solid var(--line,#d8dee8);border-radius:10px;",
      "padding:9px 12px;font-size:13px;background:var(--panel-2,#f4f6fa);color:var(--ink,#16202c);outline:0}",
      ".rs-dlg-in:focus{border-color:var(--brand,#7fa32b)}",
      ".rs-dlg-a{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}",
      ".rs-dlg .rs-btn.danger{background:var(--neg,#c2413f);border-color:var(--neg,#c2413f);color:#fff}",
    ].join("");
    document.head.appendChild(st);
  }

  document.addEventListener("click", () =>
    document.querySelectorAll(".rs-slicer-pop").forEach(p => p.classList.add("hidden")));


  /* ---------------------------------------------------------------- print view ----
     A paper version of whatever the page is currently showing. See the note in
     scripts/../rs-components: it SNAPSHOTS the live dashboard instead of re-rendering the
     numbers, so the PDF can never disagree with the screen it was taken from.

       RSC.printView({ host, title, subtitle, note, drop })

     host     the element to snapshot (the page's own container)
     title    document heading, also the window title the browser suggests as a filename
     subtitle one line under it — say what is IN the window, e.g. the active filters
     note     optional smaller line under that (a caveat the reader needs on paper)
     drop     extra CSS selectors to remove, on top of the interactive chrome always removed
     pageCss  id of the page's own <style> element, or the CSS text itself. A page built from
              its own classes rather than the kit MUST pass this or it prints unstyled --
              this helper restyles the kit vocabulary only. Omit it and behaviour is exactly
              as before.
     orientation  "landscape" (default) or "portrait".
  */
  function printView(cfg) {
    const host = cfg.host;
    if (!host) return;
    const win = window.open("", "_blank");
    if (!win) {
      alert("Allow pop-ups for this site to save this as a PDF.");
      return;
    }
    const body = host.cloneNode(true);

    // Interactive chrome cannot be used on paper and only costs space. `.rs-bar` is the
    // filter row, `.rs-seg` the view switch; both describe state that the subtitle carries
    // in words instead.
    // `.rs-page-head` goes too: the print header above carries the title and the window,
    // and printing both means the reader sees the page described twice before any number.
    const DROP = [".rs-bar", ".rs-seg", "button", "input", "select", "label.rs-fld",
                  ".rs-spacer", "[data-foot]", ".rs-pager", ".rs-hidden", ".rs-page-head"];
    DROP.concat(cfg.drop || []).forEach(sel => {
      body.querySelectorAll(sel).forEach(el => el.remove());
    });
    // a table that scrolls on screen must print WHOLE — the point of paper is that there is
    // no overflow to hide rows behind
    body.querySelectorAll(".rs-tablewrap").forEach(el => {
      el.style.overflow = "visible";
      el.style.maxHeight = "none";
      el.style.height = "auto";
    });
    body.querySelectorAll("table").forEach(el => { el.style.tableLayout = "auto"; });

    /* THEMED PAGES. Each entry becomes one printed page with its own heading and a forced
       break after it. Elements are claimed in the order the caller lists them, so a panel
       named twice belongs to the first theme that asks for it. Whatever nobody claims still
       prints, on a final page -- quietly dropping a panel out of a document somebody is
       about to send is the worst thing this could do. */
    let pagesHtml = "";
    if (cfg.pages && cfg.pages.length) {
      const claimed = new Set();
      const sections = [];
      cfg.pages.forEach(pg => {
        const picked = [];
        (pg.sel || "").split(",").map(x => x.trim()).filter(Boolean).forEach(sel => {
          body.querySelectorAll(sel).forEach(el => {
            if (claimed.has(el) || [...claimed].some(c => c.contains(el))) return;
            claimed.add(el);
            picked.push(el);
          });
        });
        if (picked.length) {
          sections.push(`<section class="pv-page"><h2>${esc(pg.title || "")}</h2>`
            + picked.map(el => el.outerHTML).join("") + `</section>`);
        }
      });
      const rest = [...body.children].filter(
        el => !claimed.has(el) && ![...claimed].some(c => c.contains(el)));
      if (rest.length) {
        sections.push(`<section class="pv-page"><h2>${esc(cfg.restTitle || "Detail")}</h2>`
          + rest.map(el => el.outerHTML).join("") + `</section>`);
      }
      pagesHtml = sections.join("");
    } else {
      pagesHtml = `<section class="pv-page">${body.innerHTML}</section>`;
    }

    /* THE TOKENS PAGE CSS IS WRITTEN AGAINST. A standalone document defines none of them,
       so var(--ink) and friends would resolve to nothing and a page's own rules would paint
       in no colour at all. These are rs.css's LIGHT values, because this is ink on paper. */
    const PAPER_TOKENS = ":root{--bg:#fff;--panel:#fff;--panel-2:#f8fafc;--line:#e3e8f0;"
      + "--line-2:#cdd6e2;--ink:#16202c;--muted:#5b6b7c;--faint:#8a97a6;--brand:#5f7c20;"
      + "--brand-d:#5f7c20;--brand-ink:#fff;--brand-glow:rgba(127,163,43,.14);--blue:#2f62d8;"
      + "--purple:#7c5cd6;--amber:#b97b0a;--red:#d43d55;--shadow:none;--pos:#5f7c20;"
      + "--pos-bg:rgba(127,163,43,.12);--warn:#b97b0a;--warn-bg:rgba(185,123,10,.12);"
      + "--neg:#d43d55;--neg-bg:rgba(212,61,85,.10);--blue-bg:rgba(47,98,216,.10);"
      + "--job-ink:#fff}";

    // the page's own stylesheet, by element id or as raw text
    let pageCss = "";
    if (cfg.pageCss) {
      const el = document.getElementById(cfg.pageCss);
      pageCss = el ? el.textContent : String(cfg.pageCss);
    }

    const esc2 = v => esc(v == null ? "" : v);
    const when = new Date().toLocaleDateString(undefined,
      { year: "numeric", month: "long", day: "numeric" });

    win.document.write(`<!doctype html><html><head><meta charset="utf-8">
      <title>${esc2(cfg.title || "Report")}</title>
      <style>
        @page{size:A4 ${cfg.orientation === "portrait" ? "portrait" : "landscape"};margin:12mm}
        ${PAPER_TOKENS}
        ${pageCss}
        *{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
        body{margin:0;background:#fff;color:#16181D;
          font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
          font-size:11px;line-height:1.45}
        .pv-head{border-bottom:2px solid #16181D;padding-bottom:10px;margin-bottom:16px}
        .pv-head h1{font-size:20px;margin:0 0 4px;letter-spacing:-.01em}
        .pv-head .sub{font-size:11.5px;color:#5B5F6B}
        .pv-head .note{font-size:10.5px;color:#7A7E88;margin-top:4px}
        .pv-head .when{float:right;font-size:10px;color:#7A7E88;text-transform:uppercase;
          letter-spacing:.08em}
        /* the kit's vocabulary, restyled for paper */
        .rs-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;
          margin:0 0 16px}
        .kpi{border:1px solid #DCDEE3;border-radius:5px;padding:9px 11px;break-inside:avoid}
        .kpi .l{font-size:9px;text-transform:uppercase;letter-spacing:.07em;color:#7A7E88}
        .kpi .v{font-size:19px;font-weight:700;margin-top:3px;font-variant-numeric:tabular-nums}
        .kpi .s{font-size:9.5px;color:#7A7E88;margin-top:3px}
        .panel{border:1px solid #DCDEE3;border-radius:6px;margin:0 0 14px;break-inside:avoid;
          overflow:visible}
        .panel-head{padding:9px 12px;border-bottom:1px solid #E6E8EC;background:#F7F8FA;
          display:flex;align-items:baseline;gap:8px}
        .panel-title{font-size:12px;font-weight:700}
        .rs-hint{font-size:10px;color:#5B5F6B;padding:8px 12px 0;max-width:110ch}
        .rs-tablewrap{overflow:visible!important;max-height:none!important}
        table{width:100%;border-collapse:collapse;font-size:10px}
        th{text-align:left;font-size:8.5px;text-transform:uppercase;letter-spacing:.06em;
          color:#7A7E88;padding:6px 8px;border-bottom:1px solid #DCDEE3;background:#F7F8FA}
        td{padding:5px 8px;border-bottom:1px solid #EEF0F3}
        td.num,th.num,td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}
        tr{break-inside:avoid}
        .rs-pill{display:inline-block;border:1px solid #DCDEE3;border-radius:99px;
          padding:1px 7px;font-size:9px}
        .dim,.muted{color:#9A9EA8}
        svg{max-width:100%;height:auto}
        .pv-foot{margin-top:14px;padding-top:8px;border-top:1px solid #DCDEE3;
          font-size:9px;color:#9A9EA8;text-transform:uppercase;letter-spacing:.08em}
        /* ONE THEME PER SHEET. break-after on every page but the last, and a min-height so a
           short theme still reads as a full page rather than a stripe at the top of one. */
        .pv-page{break-after:page;page-break-after:always;min-height:172mm;
          padding-bottom:8mm}
        .pv-page:last-of-type{break-after:auto;page-break-after:auto;min-height:0}
        .pv-page > h2{font-size:13px;text-transform:uppercase;letter-spacing:.09em;
          color:#16181D;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #DCDEE3}
        .pv-page > h2:empty{display:none}
        /* a panel taller than a sheet must be allowed to split, or it overflows off the page
           and the rows at the bottom are simply gone */
        .pv-page .panel{break-inside:auto}
        .pv-page .rs-kpis{break-inside:avoid}
      </style></head><body>
      <div class="pv-head">
        <span class="when">${esc2(when)}</span>
        <h1>${esc2(cfg.title || "Report")}</h1>
        ${cfg.subtitle ? `<div class="sub">${esc2(cfg.subtitle)}</div>` : ""}
        ${cfg.note ? `<div class="note">${esc2(cfg.note)}</div>` : ""}
      </div>
      ${pagesHtml}
      <div class="pv-foot">Zip to Zip · Reporting System · ${esc2(when)}</div>
      </body></html>`);
    win.document.close();
    // let the clone lay out before the print dialog measures it
    win.setTimeout(() => { win.focus(); win.print(); }, 350);
  }

  return { el, esc, multiSelect, singleSelect, localSelect, localMulti, dateBar, dateRange, datePresets,
           kpis, chartCard, table, matrix,
           confirm: confirmDlg, ask: askDlg, notice: noticeDlg,
           collapsible, fitScroller, fit, reflow, reflowAfter, printView };
})();
