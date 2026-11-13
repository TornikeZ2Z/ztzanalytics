/* SHIFT SUPERVISORS page: Customer Lookup (report id customer-lookup; tracker ZTZ-92, 13 Nov 2026).

   His ask: "i need to give shift supervisors a new page ... copy conversations page that we have, and then i need to
   have only LEADS EXPLORER part there ... those 2 pages can be kinda combined in a single page with 2 tabs ... at the
   end its same search they should do. also - i would love you to think about its redisining."
   His picks on the mockup (13 Nov): one search box over both tabs (Leads from Moveboard, Calls and texts from
   RingCentral), a lead file that opens on the side with the lead's facts and its whole conversation; money = the
   quote and the final bill only; the Calls tab also finds callers who never became a lead.

   DATA PATH: everything through /api/_lookup (bridge/customer_lookup.py) -- no RS.load, no dataset. The page's
   report id maps to no tables, so the shift supervisors' login can read nothing else. The conversation is drawn by
   the Conversations renderer (window.CONV, pages/conversations.js), so a call reads the same everywhere.

   NOT data-lead ROWS: sales-team.js opens ITS lead file on any click on [data-lead], through an endpoint this login
   is not granted. Rows here carry data-jk / data-ph and open this page's own file. */

(() => {
  const esc = s => RSC.esc(s == null ? "" : String(s));
  // module-level, so a re-render of the page keeps what was typed and the tab
  const S = { q: "", tab: "leads", data: null, busy: false, err: "", seq: 0, kw: "" };

  /* ---------- formatting ---------- */
  const fmtPh = p => { const d = String(p || "").replace(/\D/g, "").slice(-10);
    return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(p || ""); };
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const ymd = v => String(v || "").slice(0, 10);
  const day = v => { const d = ymd(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—";
    return `${MON[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}${d.slice(0, 4) !== String(new Date().getFullYear()) ? ", " + d.slice(0, 4) : ""}`; };
  const dayW = v => { const d = ymd(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return "—";
    return DOW[new Date(d + "T12:00:00").getDay()] + ", " + day(d); };
  const clock = v => { const t = String(v || "").slice(11, 16); if (!t) return "";
    const h = +t.slice(0, 2); return `${(h % 12) || 12}:${t.slice(3)} ${h < 12 ? "AM" : "PM"}`; };
  const when = v => v ? `${day(v)}${clock(v) ? ", " + clock(v) : ""}` : "—";
  // event and lead times are New York wall times, printed as written (never re-zoned)
  // today's date in New York, whatever the viewer's clock says ("en-CA" formats as YYYY-MM-DD)
  const todayNY = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
  const daysFrom = v => { const d = ymd(v); if (!d) return null;
    return Math.round((Date.parse(d + "T12:00:00Z") - Date.parse(todayNY() + "T12:00:00Z")) / 864e5); };
  const inDays = v => { const n = daysFrom(v); if (n == null) return "";
    return n === 0 ? "today" : n === 1 ? "tomorrow" : n === -1 ? "yesterday" : n > 0 ? `in ${n} days` : `${-n} days ago`; };
  const money = v => (v == null || v === "" || isNaN(+v)) ? null : "$" + Math.round(+v).toLocaleString("en-US");
  const n0 = v => +v || 0;
  const plural = (n, w) => `${RS.fmtN(n)} ${w}${n === 1 ? "" : "s"}`;
  // a conversation row carries the Moveboard status only, so the status text decides when there is no category
  const stTone = r => {
    const c = String(r["Status Category"] || ""), s = String(r["Status"] || "");
    if (c === "Confirmed" || /^confirmed$/i.test(s)) return "ok";
    if (c === "Bad Lead" || /bad lead/i.test(s)) return "bad";
    return /not confirmed/i.test(s) ? "warn" : "mute";
  };
  const name = v => { const s = String(v || "").trim();
    return !s || s === "Draft User" ? '<span class="clk-dim">(name not filled)</span>' : esc(s); };

  /* ---------- style: the kit does the page; this is only the file panel's layout ---------- */
  function injectStyle() {
    const old = document.getElementById("clk-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "clk-style";
    st.textContent = `
      .clk-search{display:flex;gap:10px;align-items:center;margin:4px 0 14px}
      .clk-search .rs-inp{flex:1;min-width:0;height:44px;font-size:16px;padding:0 14px}
      .clk-search .rs-btn{height:44px;padding:0 22px;font-size:14px}
      .clk-hint{font-size:13px;color:var(--muted);margin:-6px 0 12px}
      .clk-dim{color:var(--faint)}
      .clk-sub{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;font-weight:400}
      .rs-table td .clk-nm{font-weight:600;color:var(--ink)}
      .clk-sec{font-size:14px;font-weight:600;color:var(--ink);margin:18px 0 8px}
      .clk-note{font-size:13px;color:var(--muted);margin:8px 0 0}
      /* the lead file: the kit's side panel, wider, because a conversation is the point of it */
      .rs-fpanel.clk-file{width:min(760px,100%)}
      .clk-file .rs-fp-head h2{font-size:20px}
      .clk-fhead{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;font-size:13.5px;color:var(--muted);margin:0 0 14px}
      .clk-fhead a{color:var(--ink);font-weight:600;text-decoration:none}
      .clk-fhead a:hover{text-decoration:underline}
      .clk-facts{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
      .clk-fact{border:1px solid var(--line);border-radius:10px;padding:9px 12px;min-width:0}
      .clk-fact .l{font-size:12px;color:var(--muted)}
      .clk-fact .v{font-size:14px;font-weight:600;color:var(--ink);margin-top:2px;overflow-wrap:anywhere}
      .clk-fact .s{font-size:12px;color:var(--muted);margin-top:1px}
      .clk-fact.wide{grid-column:span 2}
      @media(max-width:560px){.clk-fact.wide{grid-column:auto}}
      .clk-find{display:flex;gap:10px;align-items:center;margin:0 0 12px}
      .clk-find .rs-inp{flex:1;min-width:0}
      .clk-find span{font-size:12.5px;color:var(--muted);white-space:nowrap}
    `;
    document.head.appendChild(st);
  }

  /* ---------- the search ---------- */
  async function runSearch(host) {
    const my = ++S.seq;
    S.busy = true; S.err = ""; paint(host);
    try {
      const d = await ZTZ.api("/api/_lookup?q=" + encodeURIComponent(S.q));
      if (my !== S.seq) return;            // a newer search is already on its way
      S.data = d;
      // a search that finds nothing on this tab but something on the other one shows the other one
      const nL = (d.leads || []).length, nC = (d.convos || []).length + (d.callers || []).length;
      if ((d.q || "").length >= 2 && S.tab === "leads" && !nL && nC) S.tab = "calls";
      else if ((d.q || "").length >= 2 && S.tab === "calls" && !nC && nL) S.tab = "leads";
    } catch (e) {
      if (my !== S.seq) return;
      S.err = String(e && e.message || e);
    }
    S.busy = false; paint(host);
  }

  function tabItems() {
    const d = S.data;
    return [{ id: "leads", label: "Leads", count: d ? RS.fmtN(d.leads.length) : null },
            { id: "calls", label: "Calls and texts", count: d ? RS.fmtN(d.convos.length + d.callers.length) : null }];
  }

  function paint(host) {
    const tabs = host.querySelector("#clkTabs"), body = host.querySelector("#clkBody");
    if (!tabs || !body) return;
    tabs.innerHTML = RSC.tabsHtml(tabItems(), S.tab, "t");
    tabs.querySelectorAll("[data-t]").forEach(b => b.onclick = () => { S.tab = b.dataset.t; paint(host); });
    if (S.err) { RSC.failed(body, { title: "The search couldn't run", error: S.err, onRetry: () => runSearch(host) }); return; }
    if (!S.data) { body.innerHTML = RSC.loadingHtml("Customer Lookup"); return; }
    const d = S.data, typed = (d.q || "").length >= 2;
    const busy = S.busy ? ' style="opacity:.55"' : "";
    if (S.tab === "leads") body.innerHTML = `<div${busy}>${leadsHtml(d, typed)}</div>`;
    else body.innerHTML = `<div${busy}>${callsHtml(d, typed)}</div>`;
    body.querySelectorAll("tr[data-jk]").forEach(tr => tr.onclick = () => openLead(tr.dataset.jk));
    body.querySelectorAll("tr[data-ph]").forEach(tr => tr.onclick = () => openCaller(tr.dataset.ph));
    RSC.fit && requestAnimationFrame(() => RSC.fit());
  }

  const capped = (n, d) => n >= d.limit ? ` Showing the newest ${RS.fmtN(d.limit)}: type more to narrow it down.` : "";

  function leadsHtml(d, typed) {
    const L = d.leads || [];
    const head = typed
      ? (L.length ? `<b>${plural(L.length, "lead")}</b> match “${esc(d.q)}”, newest first.${capped(L.length, d)}`
                  : `No lead matches “${esc(d.q)}”. A lead created today may not be here yet: try <b>Calls and texts</b>.`)
      : `The <b>${RS.fmtN(L.length)}</b> newest leads. Search by name, phone, job number or email.`;
    if (!L.length) return RSC.headlineHtml(head);
    return RSC.headlineHtml(head) + `<div class="rs-tablewrap" data-rsfit><table class="rs-table"><thead><tr>
        <th>Customer</th><th>Phone</th><th>Created</th><th>Move</th><th>Status</th><th>Rep</th><th>Source</th><th class="num">Calls</th>
      </tr></thead><tbody>${L.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"])}">
        <td><span class="clk-nm">${name(r["Customer"])}</span><span class="clk-sub">#${esc(r["Job No"])} · ${esc(r["Company"] || "")}</span></td>
        <td class="nowrap">${esc(fmtPh(r["Phone Norm"]) || "—")}</td>
        <td class="nowrap">${esc(when(r["Create Datetime"]))}</td>
        <td class="nowrap">${r["Move Date"] ? esc(day(r["Move Date"])) + `<span class="clk-sub">${esc(inDays(r["Move Date"]))}</span>` : '<span class="clk-dim">—</span>'}</td>
        <td><span class="rs-pill ${stTone(r)}">${esc(r["Status"] || r["Status Category"] || "—")}</span></td>
        <td>${esc(r["Assigned"] || "—")}</td>
        <td>${esc(r["Source"] || "—")}</td>
        <td class="num nowrap">${RS.fmtN(n0(r["Out Calls"]) + n0(r["In Calls"]))}<span class="clk-sub">${RS.fmtN(n0(r["Sms Out"]) + n0(r["Sms In"]))} texts</span></td>
      </tr>`).join("")}</tbody></table></div>`;
  }

  function callsHtml(d, typed) {
    const C = d.convos || [], X = d.callers || [];
    const head = typed
      ? (C.length || X.length
        ? (C.length ? `<b>${plural(C.length, "lead")}</b> with calls or texts match “${esc(d.q)}”`
                      + (X.length ? `, and <b>${plural(X.length, "caller")}</b> with no lead in Moveboard` : "")
                    : `<b>${plural(X.length, "caller")}</b> with no lead in Moveboard ${X.length === 1 ? "matches" : "match"} “${esc(d.q)}”`)
          + `.${capped(C.length, d)}`
        : `No calls or texts match “${esc(d.q)}”.${/\d{4}/.test(d.q) ? "" : " Callers with no lead are found by phone number."}`)
      : `Leads with a call or text in the <b>last 7 days</b>, latest first. Search to find anyone.`;
    let h = RSC.headlineHtml(head);
    if (C.length) h += `<div class="rs-tablewrap" data-rsfit><table class="rs-table"><thead><tr>
        <th>Customer</th><th>Phone</th><th>Last call or text</th><th class="num">Calls</th><th class="num">Texts</th><th>Transcripts</th><th>Status</th><th>Rep</th>
      </tr></thead><tbody>${C.map(r => `<tr class="click" data-jk="${esc(r["Request Joinkey"] || "")}">
        <td><span class="clk-nm">${name(r["Customer"])}</span><span class="clk-sub">#${esc(r["Job No"])}</span></td>
        <td class="nowrap">${esc(fmtPh(r["Phone"]) || "—")}</td>
        <td class="nowrap">${esc(when(r["Last Activity"]))}</td>
        <td class="num">${RS.fmtN(n0(r["Calls"]))}</td>
        <td class="num">${RS.fmtN(n0(r["Texts"]))}</td>
        <td>${n0(r["Transcripts"]) ? `<span class="rs-pill info">${RS.fmtN(n0(r["Transcripts"]))} transcribed</span>` : '<span class="clk-dim">—</span>'}</td>
        <td>${r["Status"] ? `<span class="rs-pill ${stTone(r)}">${esc(r["Status"])}</span>` : '<span class="clk-dim">—</span>'}</td>
        <td>${esc(r["Assigned"] || "—")}</td>
      </tr>`).join("")}</tbody></table></div>`;
    if (X.length) h += `<div class="clk-sec">Callers with no lead in Moveboard</div>
      <div class="rs-tablewrap"><table class="rs-table"><thead><tr>
        <th>Caller</th><th>Last call</th><th class="num">Calls</th><th>Line</th><th>Transcripts</th><th>Earlier lead</th>
      </tr></thead><tbody>${X.map(r => `<tr class="click" data-ph="${esc(r["Phone"])}">
        <td><span class="clk-nm">${esc(fmtPh(r["Phone"]))}</span><span class="clk-sub">first call ${esc(day(r["First Call"]))}</span></td>
        <td class="nowrap">${esc(when(r["Last Call"]))}</td>
        <td class="num">${RS.fmtN(n0(r["Calls"]))}<span class="clk-sub">${RS.fmtN(n0(r["Answered"]))} answered</span></td>
        <td>${esc(r["Lines"] || "—")}</td>
        <td>${n0(r["Transcripts"]) ? `<span class="rs-pill info">${RS.fmtN(n0(r["Transcripts"]))} transcribed</span>` : '<span class="clk-dim">—</span>'}</td>
        <td>${r["Earlier Job No"] ? "#" + esc(r["Earlier Job No"]) : '<span class="clk-dim">—</span>'}</td>
      </tr>`).join("")}</tbody></table></div>
      <p class="clk-note">People who called a sales line with no lead within 30 days of the call. A brand-new lead shows here until it reaches Moveboard's morning export.</p>`;
    return h;
  }

  /* ---------- the file: the kit's side panel ---------- */
  function closeFile() { ["clkFile", "clkScrim"].forEach(id => { const x = document.getElementById(id); if (x) x.remove(); }); }
  function openPanel(title) {
    closeFile();
    const scrim = document.createElement("div"); scrim.className = "rs-fscrim"; scrim.id = "clkScrim";
    const p = document.createElement("aside"); p.className = "rs-fpanel clk-file"; p.id = "clkFile";
    p.setAttribute("role", "dialog"); p.setAttribute("aria-modal", "true"); p.setAttribute("aria-label", title);
    p.innerHTML = `<div class="rs-fp-head"><h2 id="clkFT">${esc(title)}</h2><button type="button" class="rs-fp-x" aria-label="Close">&times;</button></div>
      <div class="rs-fp-body" id="clkFB">${RSC.loadingHtml("the lead file")}</div>`;
    document.body.appendChild(scrim); document.body.appendChild(p);
    scrim.onclick = closeFile;
    p.querySelector(".rs-fp-x").onclick = closeFile;
    p.addEventListener("keydown", e => { if (e.key === "Escape") closeFile(); });
    p.querySelector(".rs-fp-x").focus();
    return p;
  }

  const fact = (l, v, s, wide) => `<div class="clk-fact${wide ? " wide" : ""}"><div class="l">${l}</div><div class="v">${v}</div>${s ? `<div class="s">${s}</div>` : ""}</div>`;

  async function openLead(jk) {
    if (!jk) return;
    const p = openPanel("Lead");
    let d;
    try { d = await ZTZ.api("/api/_lookup?jk=" + encodeURIComponent(jk)); }
    catch (e) {
      const nf = /404/.test(String(e && e.message));
      p.querySelector("#clkFB").innerHTML = RSC.emptyHtml({ title: nf ? "This lead isn't in the lead list yet" : "The lead file couldn't load",
        body: nf ? "Leads arrive with Moveboard's morning export. Its calls are on the Calls and texts tab." : String(e && e.message || e) });
      return;
    }
    if (!document.getElementById("clkFile")) return;     // closed while it loaded
    const L = d.lead || {}, M = d.move || {}, cv = d.conversation || { events: [], transcripts: {} };
    p.querySelector("#clkFT").innerHTML = name(L["Customer"]);
    const ph = String(L["Phone Norm"] || "").replace(/\D/g, "");
    const q = money(L["Avg Quote"]), lo = money(L["Min Quote"]), hi = money(L["Max Quote"]), bill = money(L["Total Bill"]);
    const crew = [n0(M["Trucks count"]) ? plural(n0(M["Trucks count"]), "truck") : "", n0(M["Crew"]) ? plural(n0(M["Crew"]), "mover") : ""].filter(Boolean).join(" · ");
    const closing = L["Closing Job Status"] || (+L["Closed"] ? "Closed" : "");
    const nTr = Object.keys(cv.transcripts || {}).length;
    p.querySelector("#clkFB").innerHTML = `
      <div class="clk-fhead">
        <span>#${esc(L["Job No"])} · ${esc(L["Company"] || "")}</span>
        ${ph ? `<a href="tel:${esc(ph)}">${esc(fmtPh(ph))}</a>` : ""}
        ${M["Email"] ? `<a href="mailto:${esc(M["Email"])}">${esc(M["Email"])}</a>` : ""}
        <span class="rs-pill ${stTone(L)}">${esc(L["Status"] || L["Status Category"] || "—")}</span>
      </div>
      <div class="clk-facts">
        ${fact("Move date", L["Move Date"] ? esc(dayW(L["Move Date"])) : "—", esc(inDays(L["Move Date"])))}
        ${fact("Size", esc(M["Move Size"] || L["Size of Move"] || "—"), [M["Home Type"], L["Total CF"] ? RS.fmtN(Math.round(+L["Total CF"])) + " CF" : ""].filter(Boolean).map(esc).join(" · "))}
        ${fact("Type", +L["Is LD"] ? "Long distance" : "Local", esc(M["Service Type"] || ""))}
        ${fact("Trucks and crew", crew ? esc(crew) : "—")}
        ${fact("Moving from", esc(M["Moving From"] || "—"), "", true)}
        ${fact("Moving to", esc(M["Moving To"] || "—"), "", true)}
        ${fact("Rep", esc(L["Assigned"] || "—"))}
        ${fact("Source", esc(L["Source"] || "—"))}
        ${fact("Created", esc(when(L["Create Datetime"])))}
        ${fact("Booked", L["Booked Date"] ? esc(day(L["Booked Date"])) : "—")}
        ${fact("Quote", q ? esc(q) : "—", lo && hi && lo !== hi ? esc(lo + " to " + hi) : "")}
        ${fact("Final bill", bill && +L["Total Bill"] > 0 ? esc(bill) : "Not billed yet", closing ? esc(closing + (L["Closing Date"] ? " · " + day(L["Closing Date"]) : "")) : "")}
      </div>
      <div class="clk-sec">Calls and texts · ${RS.fmtN(cv.events.length)}${nTr ? " · " + RS.fmtN(nTr) + " transcribed" : ""}</div>
      <div id="clkThreadBox"></div>`;
    mountThread(p.querySelector("#clkThreadBox"), cv, L["Customer"]);
  }

  async function openCaller(ph) {
    const p = openPanel(fmtPh(ph));
    let d;
    try { d = await ZTZ.api("/api/_lookup?phone=" + encodeURIComponent(ph)); }
    catch (e) { p.querySelector("#clkFB").innerHTML = RSC.emptyHtml({ title: "The calls couldn't load", body: String(e && e.message || e) }); return; }
    if (!document.getElementById("clkFile")) return;
    const cv = d.conversation || { events: [], transcripts: {} };
    const prev = cv.events.find(e => e["Previous Job No"]);
    const lines = [...new Set(cv.events.map(e => e["Line"]).filter(Boolean))];
    p.querySelector("#clkFB").innerHTML = `
      <div class="clk-fhead">
        <a href="tel:${esc(ph)}">Call ${esc(fmtPh(ph))}</a>
        <span class="rs-pill mute">No lead in Moveboard</span>
        ${lines.length ? `<span>Called ${esc(lines.join(", "))}</span>` : ""}
        ${prev ? `<span>Earlier lead #${esc(prev["Previous Job No"])}${prev["Previous Customer"] ? " · " + esc(prev["Previous Customer"]) : ""}</span>` : ""}
      </div>
      <div class="clk-sec">Calls · ${RS.fmtN(cv.events.length)}</div>
      <div id="clkThreadBox"></div>`;
    mountThread(p.querySelector("#clkThreadBox"), cv, "Caller");
  }

  // the Conversations renderer, with its find-a-word, inside the file
  function mountThread(box, cv, who) {
    const ev = cv.events || [];
    if (!ev.length) { box.innerHTML = RSC.emptyHtml({ title: "No calls or texts recorded", body: "Nothing with this customer has reached RingCentral's records yet." }); return; }
    if (!window.CONV) { box.innerHTML = RSC.emptyHtml({ title: "The conversation viewer didn't load", body: "Reload the portal." }); return; }
    CONV.injectStyle();
    box.innerHTML = `<div class="clk-find"><input id="clkKw" class="rs-inp" type="search" autocomplete="off" placeholder="Find a word in this conversation" value="${esc(S.kw)}"><span id="clkKwN"></span></div><div id="clkThread"></div>`;
    const ctl = CONV.mountThread(box.querySelector("#clkThread"), ev, cv.transcripts || {}, who);
    const kw = box.querySelector("#clkKw"), out = box.querySelector("#clkKwN");
    const apply = () => {
      S.kw = kw.value;
      ctl.setKeyword(S.kw);
      // every event that mentions the word is opened by setKeyword, so the marks on screen are all of them
      const n = S.kw.trim().length >= 2 ? box.querySelectorAll(".cnv-mark").length : null;
      out.textContent = n == null ? "" : n ? plural(n, "mention") : "not mentioned";
    };
    let t = null;
    kw.oninput = () => { clearTimeout(t); t = setTimeout(apply, 180); };
    if (S.kw) apply();
  }

  // the panel lives on document.body: leaving the page must not leave it (or its scrim) behind
  window.addEventListener("hashchange", () => { if (!/page=customer-lookup\b/.test(location.hash)) closeFile(); });

  registerPage({
    id: "customer-lookup",
    group: "shift-supervisors",
    title: "Customer Lookup",
    async render(host) {
      injectStyle();
      closeFile();
      host.innerHTML = `
        ${RSC.pageHeadHtml({ title: "Customer Lookup", key: "customer-lookup",
          sub: "Find any customer by name, phone, job number or email: their lead and every call and text.",
          chip: "Transcripts from Jun 19, 2026",
          how: "<p>One search over two lists. Type a name, a phone number (any part of it), a job number or an email, then pick a row "
            + "to open the customer's file: the move, the rep, the quote and the final bill, and every call and text with the "
            + "transcript of each recorded call.</p>"
            + "<h3>Leads</h3><p>Every lead registered in Moveboard. Leads arrive with Moveboard's export each morning (about 6:20 AM "
            + "New York), so a lead created today may not be here until tomorrow. Its calls show on the other tab already.</p>"
            + "<h3>Calls and texts</h3><p>Every call and text with a customer from RingCentral, attached to the customer's lead. "
            + "A phone number also finds <b>callers with no lead</b>: people who rang a sales line and have no lead within 30 days "
            + "of the call. Calls arrive within about an hour or two.</p>"
            + "<h3>Transcripts</h3><p>RingSense transcribes recorded calls from <b>19 Jun 2026</b> onward; older calls show without one.</p>"
            + "<h3>Money</h3><p>Only the quote the customer was given and the final bill. Payments, profit and pay are not shown here.</p>" })}
        <div class="clk-search" role="search">
          <input id="clkQ" class="rs-inp" type="search" autocomplete="off" placeholder="Name, phone, job # or email" value="${esc(S.q)}" aria-label="Search customers">
          <button id="clkGo" class="rs-btn pri" type="button">Find</button>
        </div>
        <div id="clkTabs"></div>
        <div id="clkBody"></div>`;
      const q = host.querySelector("#clkQ");
      const go = () => { S.q = q.value.trim(); runSearch(host); };
      host.querySelector("#clkGo").onclick = go;
      let t = null;
      q.onkeydown = e => { if (e.key === "Enter") { clearTimeout(t); go(); } };
      // as you type, on a pause: two characters or more, or cleared back to the newest
      q.oninput = () => { clearTimeout(t); const v = q.value.trim();
        if (v.length >= 2 || !v) t = setTimeout(go, 450); };
      if (S.data) paint(host); else runSearch(host);
      q.focus({ preventScroll: true });      // ready to type, without scrolling the page head away
    },
  });
})();
