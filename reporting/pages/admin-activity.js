/* ADMIN page: User Activity — who signs in, what they open, and for how long.
   Reads /api/_activity (admin-only). Recorded by ZTZ.activity in portal.js: the portal
   files a slice of wall-clock + engaged seconds each time it leaves a report, and the
   bridge files one row at each sign-in.

   THE ONE IDEA THIS PAGE IS BUILT AROUND. Tornike asked for the log and then ruled out the
   easy number in the same breath: "i dont need to see just how long it was open." So every
   place a duration appears, it appears TWICE — the clock, and the part of the clock the
   person was actually working. The bar on each row is that comparison drawn: the filled
   part is engaged, the ghost behind it is open. A tab left running over lunch shows as a
   long ghost with almost nothing in it, and that reads correctly at a glance.

   WHAT IT DELIBERATELY CANNOT SHOW: filters, date ranges, search terms, or any row anyone
   looked at. His call, and the right one — reports and time, nothing about the substance
   of somebody's work.

   Styles are namespaced .ua-* (see the page-CSS collision rule) and use portal tokens only,
   so dark and light both follow. */

const UA = (() => {
  let data = null;         // the everyone view
  let drill = null;        // { email, ...sessions payload } while drilled in
  let days = "30";
  let busy = false;

  /* ---------- formatting ---------- */
  const fmtDur = s => {
    s = Math.round(s || 0);
    if (s <= 0) return "0m";
    if (s < 60) return s + "s";
    const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
    if (h) return m ? h + "h " + m + "m" : h + "h";
    return m + "m";
  };
  /* A naive UTC datetime out of MySQL reaches us as an RFC-1123 string ending "GMT", and an
     epoch second is a number — both are true INSTANTS, so both may be re-zoned into the
     reader's chosen zone. (Day BUCKETS elsewhere in the portal may not; these are not
     buckets.) Falls back to Tbilisi if rs-core isn't loaded. */
  /* null must NOT fall through to new Date(null) -- that is the 1970 epoch, not a missing
     value, and it renders as "never signed in" being 20,000 days ago. */
  const asDate = v => (v == null) ? null
    : (typeof v === "number") ? new Date(v * 1000) : new Date(v);
  const TZ = () => (window.RS && RS.tzChoice) ? RS.tzChoice().tz : "Asia/Tbilisi";
  const fmtWhen = v => {
    const d = asDate(v);
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-GB", { timeZone: TZ(), weekday: "short", day: "numeric",
      month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
  };
  const fmtClock = v => {
    const d = asDate(v);
    if (!d || isNaN(d.getTime())) return "—";
    return d.toLocaleTimeString("en-GB", { timeZone: TZ(), hour: "2-digit",
      minute: "2-digit", hour12: false });
  };
  const ago = v => {
    const d = asDate(v);
    if (!d || isNaN(d.getTime())) return "never";
    const mn = (Date.now() - d.getTime()) / 6e4;
    if (mn < 2) return "just now";
    if (mn < 60) return Math.round(mn) + "m ago";
    if (mn < 1440) return Math.round(mn / 60) + "h ago";
    const dd = Math.round(mn / 1440);
    return dd === 1 ? "yesterday" : dd + "d ago";
  };
  const who = u => u.name || (u.email || "").split("@")[0];

  /* A colour per report — hashed, so a report tends to keep the same colour from one card
     to the next, but DECONFLICTED inside each strip, because a hash alone will happily
     hand two reports sitting next to each other the same swatch. (It did: the first build
     drew Angi Lead Funnel and Crew Salaries in two reds side by side, and the legend was
     the only way to tell the segments apart — which defeats the strip.)

     Ordered by hue so that "the next free slot" is also a visibly different colour. The
     five tokens follow the theme; the three literals are mid-tone enough to read on both
     the light and the dark ground. */
  const PALETTE = ["var(--blue)", "var(--amber)", "var(--purple)", "#3fb6a8",
                   "var(--red)", "var(--brand)", "#d267a8", "#8a6a4f"];
  const hashIx = id => {
    let h = 0;
    for (let i = 0; i < (id || "").length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h % PALETTE.length;
  };
  /* pages -> { pageId: colour }, distinct within this one group wherever the palette allows */
  const tones = pages => {
    const used = new Set(), out = {};
    (pages || []).forEach(p => {
      const start = hashIx(p.page);
      let ix = start;
      for (let n = 0; n < PALETTE.length && used.has(ix); n++) ix = (ix + 1) % PALETTE.length;
      used.add(ix);
      out[p.page] = PALETTE[ix];
    });
    return out;
  };

  /* ---------- the engaged-inside-open bar ----------
     ONE graphic carrying two numbers. Width is engaged as a share of the widest OPEN time
     on the board, so rows are comparable to each other; the ghost is that row's own open
     time on the same scale. Reading two rows side by side therefore answers both "who was
     here longest" and "who was actually working" without a second chart. */
  const bar = (active, total, scale) => {
    const w = t => scale > 0 ? Math.max(t > 0 ? 1.5 : 0, Math.min(100, t / scale * 100)) : 0;
    return `<div class="ua-bar" title="${fmtDur(active)} engaged inside ${fmtDur(total)} open">
        <i class="gh" style="width:${w(total).toFixed(1)}%"></i>
        <i class="ac" style="width:${w(active).toFixed(1)}%"></i>
      </div>`;
  };
  const pctEngaged = (a, t) => t > 0 ? Math.round(a / t * 100) : 0;

  /* ---------- styles ---------- */
  function style() {
    if (document.getElementById("ua-style")) return;
    const st = document.createElement("style");
    st.id = "ua-style";
    st.textContent = [
      ".ua-wrap{max-width:var(--rs-row-max,1400px)}",
      ".ua-note{margin:0 0 16px;padding:11px 14px;border:1px solid var(--line);border-left:3px solid var(--blue);",
      "background:var(--panel-2);border-radius:10px;font-size:12.5px;line-height:1.6;color:var(--muted)}",
      ".ua-note b{color:var(--ink)}",
      // ---- the people list ----
      ".ua-list{display:flex;flex-direction:column;gap:10px;margin-top:14px}",
      ".ua-card{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(190px,1fr) auto;gap:18px;align-items:center;",
      "padding:14px 16px;background:var(--panel);border:1px solid var(--line);border-radius:13px;",
      "box-shadow:var(--shadow);cursor:pointer;transition:border-color .12s,transform .12s}",
      ".ua-card:hover{border-color:var(--line-2);transform:translateY(-1px)}",
      ".ua-card.idle{opacity:.62;cursor:default}",
      ".ua-card.idle:hover{transform:none;border-color:var(--line)}",
      ".ua-who{display:flex;flex-direction:column;gap:3px;min-width:0}",
      ".ua-who b{font-size:14.5px;font-weight:700;color:var(--ink);display:flex;align-items:center;gap:7px}",
      ".ua-who span{font-size:11.5px;color:var(--faint);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".ua-tag{font-size:9.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;",
      "padding:2px 6px;border-radius:5px;background:var(--blue-bg);color:var(--blue)}",
      ".ua-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}",
      ".ua-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:600;",
      "color:var(--muted);background:var(--panel-2);border:1px solid var(--line);",
      "border-radius:20px;padding:2px 9px 2px 6px;white-space:nowrap}",
      ".ua-chip i{width:7px;height:7px;border-radius:50%;flex:0 0 auto}",
      ".ua-chip u{text-decoration:none;color:var(--faint);font-variant-numeric:tabular-nums}",
      // ---- the bar ----
      ".ua-metric{min-width:0}",
      ".ua-bar{position:relative;height:11px;background:var(--panel-2);border-radius:6px;overflow:hidden}",
      ".ua-bar i{position:absolute;left:0;top:0;height:100%;border-radius:6px;display:block}",
      ".ua-bar i.gh{background:var(--line-2);opacity:.75}",
      ".ua-bar i.ac{background:var(--brand)}",
      ".ua-mline{display:flex;align-items:baseline;gap:7px;margin-top:6px;font-size:11.5px;color:var(--faint);flex-wrap:wrap}",
      ".ua-mline b{font-size:14px;font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".ua-mline em{font-style:normal;color:var(--muted);font-variant-numeric:tabular-nums}",
      ".ua-right{text-align:right;display:flex;flex-direction:column;gap:3px;white-space:nowrap}",
      ".ua-right b{font-size:13px;font-weight:700;color:var(--ink);font-variant-numeric:tabular-nums}",
      ".ua-right span{font-size:11px;color:var(--faint)}",
      ".ua-go{font-size:16px;color:var(--faint);margin-left:6px}",
      // ---- the drill-down ----
      ".ua-back{display:inline-flex;align-items:center;gap:7px;background:none;border:0;cursor:pointer;",
      "font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);padding:5px 0;margin-bottom:4px}",
      ".ua-back:hover{color:var(--ink)}",
      ".ua-sess{background:var(--panel);border:1px solid var(--line);border-radius:13px;",
      "box-shadow:var(--shadow);padding:15px 17px;margin-bottom:11px}",
      ".ua-shead{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:12px}",
      ".ua-shead b{font-size:14px;font-weight:700;color:var(--ink)}",
      ".ua-shead span{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}",
      ".ua-shead .sp{margin-left:auto}",
      // the day-strip: every report in the session, proportional to time open
      ".ua-strip{display:flex;height:15px;border-radius:5px;overflow:hidden;gap:1.5px;margin-bottom:12px}",
      ".ua-strip i{display:block;height:100%;min-width:2px}",
      ".ua-ptab{width:100%;border-collapse:collapse;font-size:12.5px}",
      ".ua-ptab th{text-align:left;font-size:10px;font-weight:800;letter-spacing:.05em;",
      "text-transform:uppercase;color:var(--faint);padding:0 10px 6px 0;border-bottom:1px solid var(--line)}",
      ".ua-ptab th.r,.ua-ptab td.r{text-align:right}",
      ".ua-ptab td{padding:7px 10px 7px 0;border-bottom:1px solid var(--line);color:var(--ink);",
      "font-variant-numeric:tabular-nums}",
      ".ua-ptab tr:last-child td{border-bottom:0}",
      ".ua-ptab td.nm{font-weight:650;display:flex;align-items:center;gap:8px}",
      ".ua-ptab td.nm i{width:8px;height:8px;border-radius:2px;flex:0 0 auto}",
      ".ua-ptab td.dim{color:var(--muted)}",
      ".ua-pager{display:flex;align-items:center;gap:12px;justify-content:center;margin:16px 0 4px;",
      "font-size:12.5px;color:var(--muted)}",
      ".ua-empty{padding:34px 20px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7}",
      "@media(max-width:860px){.ua-card{grid-template-columns:1fr;gap:11px}.ua-right{text-align:left;flex-direction:row;gap:12px}}",
    ].join("");
    document.head.appendChild(st);
  }

  /* ---------- fetch ---------- */
  async function load(qs) {
    const r = await fetch(ZTZ.API + "/api/_activity?" + qs,
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  }

  /* ---------- render: everyone ---------- */
  function renderUsers(host) {
    const users = (data && data.users) || [];
    const live = users.filter(u => u.sessions > 0);
    const scale = Math.max(1, ...live.map(u => u.seconds));
    const kpis = host.querySelector("#uaKpis");
    RSC.kpis(kpis, [
      { label: "People who signed in", value: RS.fmtN(live.length),
        sub: users.length + " hold an account" },
      { label: "Sessions", value: RS.fmtN(live.reduce((a, u) => a + u.sessions, 0)),
        sub: "a 30-minute gap starts a new one" },
      { label: "Time open", value: fmtDur(live.reduce((a, u) => a + u.seconds, 0)),
        sub: "wall clock, tab open" },
      { label: "Time engaged", value: fmtDur(live.reduce((a, u) => a + u.active, 0)),
        sub: "visible and being used", tone: "pos" },
      { label: "Reports opened", value: RS.fmtN(
          new Set(live.flatMap(u => u.top.map(p => p.page))).size) + "+",
        sub: "distinct, across everyone" },
    ]);

    const body = host.querySelector("#uaBody");
    if (data && data.ready === false) {
      body.innerHTML = `<div class="panel ua-empty">
        <b style="color:var(--ink)">Recording hasn't started yet.</b><br>
        The activity table is created by the data pipeline, which runs every hour — it will
        exist after the next refresh, and this page fills in from that point.</div>`;
      return;
    }
    if (!users.length) {
      body.innerHTML = `<div class="panel ua-empty">Nothing recorded yet.<br>
        Activity is written as people use the portal — nothing before today could be
        reconstructed, so this fills forward from now.</div>`;
      return;
    }
    body.innerHTML = `<div class="ua-list">` + users.map(u => {
      const idle = u.sessions === 0;
      const top = u.top || [];
      const col = tones(top);
      const chips = top.map(p =>
        `<span class="ua-chip"><i style="background:${col[p.page]}"></i>${RSC.esc(p.title)}
           <u>${fmtDur(p.seconds)}</u></span>`).join("");
      const more = u.pages > top.length
        ? `<span class="ua-chip"><u>+${u.pages - top.length} more</u></span>` : "";
      return `<div class="ua-card${idle ? " idle" : ""}" data-em="${RSC.esc(u.email)}">
        <div class="ua-who">
          <b>${RSC.esc(who(u))}${u.admin ? `<span class="ua-tag">admin</span>` : ""}</b>
          <span>${RSC.esc(u.email)}</span>
          ${idle ? "" : `<div class="ua-chips">${chips}${more}</div>`}
        </div>
        <div class="ua-metric">
          ${idle ? `<div style="font-size:12.5px;color:var(--faint)">
                      Has access, opened nothing in this window.</div>`
                 : bar(u.active, u.seconds, scale) + `<div class="ua-mline">
              <b>${fmtDur(u.active)}</b> engaged of <em>${fmtDur(u.seconds)}</em> open
              · ${pctEngaged(u.active, u.seconds)}%</div>`}
        </div>
        <div class="ua-right">
          ${idle ? `<span>last seen ${ago(u.last_at)}</span>`
                 : `<b>${u.sessions} session${u.sessions === 1 ? "" : "s"}</b>
                    <span>last seen ${ago(u.last_at)}</span>`}
        </div>
      </div>`;
    }).join("") + `</div>`;

    body.querySelectorAll(".ua-card").forEach(c => {
      if (c.classList.contains("idle")) return;
      c.onclick = () => open(host, c.dataset.em, 0);
    });
  }

  /* ---------- render: one person's sessions ---------- */
  function renderDrill(host) {
    const d = drill;
    const kpis = host.querySelector("#uaKpis");
    RSC.kpis(kpis, [
      { label: "Sessions", value: RS.fmtN(d.total_sessions), sub: "in this window" },
      { label: "Sign-ins", value: RS.fmtN(d.totals.signins), sub: "fresh logins" },
      { label: "Time open", value: fmtDur(d.totals.seconds), sub: "wall clock" },
      { label: "Time engaged", value: fmtDur(d.totals.active),
        sub: pctEngaged(d.totals.active, d.totals.seconds) + "% of it", tone: "pos" },
    ]);

    const body = host.querySelector("#uaBody");
    const name = d.name || (d.email || "").split("@")[0];
    const sessions = d.sessions || [];
    const from = d.page * d.per_page;
    body.innerHTML =
      `<button class="ua-back" id="uaBack">← Everyone</button>
       <div class="rs-page-head" style="margin:2px 0 14px">
         <h1 style="font-size:20px">${RSC.esc(name)}</h1>
         <p>${RSC.esc(d.email)}</p>
       </div>` +
      (sessions.length ? sessions.map(s => {
        const pages = s.pages || [];
        const col = tones(pages);
        const tot = Math.max(1, pages.reduce((a, p) => a + p.seconds, 0));
        const strip = pages.map(p =>
          `<i style="flex:${(p.seconds / tot * 100).toFixed(2)};background:${col[p.page]}"
              title="${RSC.esc(p.title)} · ${fmtDur(p.seconds)}"></i>`).join("");
        const rows = pages.map(p => `<tr>
            <td class="nm"><i style="background:${col[p.page]}"></i>${RSC.esc(p.title)}</td>
            <td class="r dim">${p.visits}</td>
            <td class="r dim">${fmtDur(p.seconds)}</td>
            <td class="r"><b>${fmtDur(p.active)}</b></td>
          </tr>`).join("");
        return `<div class="ua-sess">
          <div class="ua-shead">
            <b>${fmtWhen(s.start)} → ${fmtClock(s.end)}</b>
            <span>${fmtDur(s.seconds)} open · <b style="color:var(--brand)">${fmtDur(s.active)}</b> engaged
              · ${pages.length} report${pages.length === 1 ? "" : "s"}</span>
            <span class="sp">${s.signins ? "signed in · " : ""}${RSC.esc(s.device || "")}</span>
          </div>
          <div class="ua-strip">${strip}</div>
          <table class="ua-ptab">
            <thead><tr><th>Report</th><th class="r">Visits</th>
              <th class="r">Open</th><th class="r">Engaged</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
      }).join("") : `<div class="panel ua-empty">No sessions in this window.</div>`) +
      (d.total_sessions > d.per_page ? `<div class="ua-pager">
          <button class="rs-btn" id="uaPrev"${d.page === 0 ? " disabled" : ""}>← Newer</button>
          <span>Sessions ${from + 1}–${Math.min(from + sessions.length, d.total_sessions)}
            of ${d.total_sessions}</span>
          <button class="rs-btn" id="uaNext"${from + d.per_page >= d.total_sessions ? " disabled" : ""}>Older →</button>
        </div>` : "");

    body.querySelector("#uaBack").onclick = () => { drill = null; paint(host); };
    const prev = body.querySelector("#uaPrev"), next = body.querySelector("#uaNext");
    if (prev) prev.onclick = () => open(host, d.email, d.page - 1);
    if (next) next.onclick = () => open(host, d.email, d.page + 1);
  }

  function paint(host) {
    if (drill) renderDrill(host); else renderUsers(host);
  }

  async function open(host, email, page) {
    if (busy) return;
    busy = true;
    const body = host.querySelector("#uaBody");
    body.innerHTML = `<div class="rs-loading" style="padding:26px">Loading sessions…</div>`;
    try {
      drill = await load("days=" + encodeURIComponent(days) +
        "&email=" + encodeURIComponent(email) + "&page=" + page);
      paint(host);
    } catch (e) {
      body.innerHTML = `<div class="panel ua-empty">Couldn't load those sessions: ${RSC.esc(String(e.message || e))}</div>`;
    } finally { busy = false; }
  }

  async function reload(host) {
    if (busy) return;
    busy = true;
    const body = host.querySelector("#uaBody");
    body.innerHTML = `<div class="rs-loading" style="padding:26px">Loading activity…</div>`;
    try {
      data = await load("days=" + encodeURIComponent(days));
      drill = null;
      paint(host);
    } catch (e) {
      body.innerHTML = `<div class="panel ua-empty">Couldn't load the activity log: ${RSC.esc(String(e.message || e))}</div>`;
    } finally { busy = false; }
  }

  return { style, reload, paint, open,
           setDays(v) { days = v; }, days: () => days,
           get drilled() { return drill; } };
})();

registerPage({
  id: "admin-activity",
  group: "settings",
  title: "User Activity",
  async render(host) {
    if (!ME || !ME.admin) { host.innerHTML = `<div class="rs-loading">Admins only.</div>`; return; }
    UA.style();
    const WINDOWS = [["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["all", "All"]];
    host.innerHTML = `<div class="ua-wrap">
      <div class="rs-page-head">
        <h1>User Activity</h1>
        <p>Who signed in, which reports they opened, and how much of that time they were
          actually working.</p>
      </div>
      <div class="ua-note">
        <b>Two numbers, never one.</b> <b>Open</b> is wall clock with the report on screen —
        a tab left running counts. <b>Engaged</b> is the part of it the tab was visible
        <i>and</i> being used. Judge by engaged; open is only there for the comparison.
        Reports and time only: no filters, searches or records anyone looked at are stored.
        History is kept for 12 months, then deleted.
      </div>
      <div class="rs-bar">
        <div class="rs-seg" id="uaWin">${WINDOWS.map(([v, l]) =>
          `<button data-v="${v}"${v === UA.days() ? ' class="on"' : ""}>${l}</button>`).join("")}</div>
        <span class="rs-spacer"></span>
        <button class="rs-btn" id="uaReload">↻ Reload</button>
      </div>
      <div class="rs-kpis" id="uaKpis"></div>
      <div id="uaBody"><div class="rs-loading" style="padding:26px">Loading activity…</div></div>
    </div>`;
    host.querySelector("#uaWin").onclick = ev => {
      const b = ev.target.closest("button[data-v]");
      if (!b) return;
      host.querySelectorAll("#uaWin button").forEach(x => x.classList.toggle("on", x === b));
      UA.setDays(b.dataset.v);
      UA.reload(host);
    };
    host.querySelector("#uaReload").onclick = () => UA.reload(host);
    await UA.reload(host);
  },
});
