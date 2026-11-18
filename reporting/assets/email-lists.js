/* CONTACTS AND LISTS -- the third tab of Email Automations (tracker ZTZ-69, step 5 of the email platform, 16 Nov 2026).
 * Server: bridge/email_lists.py through /api/_emailadmin (views lists | contactlist | dne; actions list_save, list_archive,
 * list_remove, import, dne_add). Mounted by pages/email-automations.js: EMAILLISTS.mount(el, {api, post, esc, onSend}).
 *   HOME          your lists (they start empty: his pick, 15 Nov), the two lists kept up to date from our own data,
 *                 and Do not email.
 *   A LIST        its name, how we got the people, the line printed at the bottom of every email to it, who is on
 *                 it, and every import.
 *   DO NOT EMAIL  one list for every email we send (unsubscribed, bounced, marked as spam, imported, added by hand),
 *                 with why each address is there. Nobody comes off it here.
 *   IMPORT        a CSV read in the browser: where it goes, match its columns, check it (nothing is written yet),
 *                 import. People the file marks unsubscribed go on Do not email; anyone already there is skipped.
 */
(() => {
  const FIELDS = [
    ["email", "Email", "required"],
    ["first", "First name", "{first} in the email"],
    ["last", "Last name", ""],
    ["phone", "Phone", ""],
    ["consent", "May we email them", "Unsubscribed, No, Opted out… go on Do not email instead"],
    ["source", "Where we got them", "e.g. Realtor event"],
    ["acquired", "When we got them", "a date"],
  ];
  const GUESS = {
    email: ["email", "emailaddress", "mail", "primaryemail", "workemail", "emails"],
    first: ["firstname", "first", "givenname", "fname", "name", "fullname", "contactname"],
    last: ["lastname", "last", "surname", "familyname", "lname"],
    phone: ["phone", "phonenumber", "mobile", "mobilephone", "cell", "cellphone", "tel", "telephone"],
    consent: ["emailmarketingconsent", "consent", "emailconsent", "marketingconsent", "subscribed", "subscriptionstatus", "status", "optin"],
    source: ["source", "leadsource", "origin", "signupsource", "channel", "howwegotthem"],
    acquired: ["created", "createdat", "datecreated", "createddate", "profilecreatedon", "dateadded", "signupdate", "subscribedat", "joined", "date", "acquired"],
  };
  const MAX_BYTES = 10 * 1024 * 1024;

  function injectStyle() {
    if (document.getElementById("eml-style")) return;
    const st = document.createElement("style");
    st.id = "eml-style";
    st.textContent = ""
      + ".eml-grid{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px;align-items:start}"
      + "@media (max-width:1050px){.eml-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".eml-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);font-size:13.5px}"
      + ".eml-row:last-child{border-bottom:0}.eml-row .tx{min-width:0;flex:1}.eml-row .n{font-weight:800;font-size:15px;white-space:nowrap}"
      + ".eml-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px}"
      + ".eml-steps{font-size:13px;color:var(--muted);font-weight:600}"
      + ".eml-map{width:100%;border-collapse:collapse;font-size:13.5px}"
      + ".eml-map th{text-align:left;font-size:12px;color:var(--muted);font-weight:700;padding:6px 8px;border-bottom:1px solid var(--line)}"
      + ".eml-map td{padding:8px;border-bottom:1px solid var(--line);vertical-align:middle}"
      + ".eml-map select{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:38px}"
      + ".eml-note{background:rgba(217,119,6,.10);border:1px solid rgba(217,119,6,.35);border-radius:10px;padding:10px 12px;font-size:13px;line-height:1.5;margin:12px 0}"
      + ".eml-tick{display:flex;gap:10px;align-items:flex-start;font-size:13.5px;line-height:1.45;margin:12px 0;cursor:pointer}"
      + ".eml-tick input{width:18px;height:18px;margin-top:1px;flex:0 0 18px}"
      + ".eml-why{background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:9px 12px;font-size:13px;margin-top:8px}"
      + ".eml-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:10px 0}"
      + ".eml-k div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}"
      + ".eml-k b{display:block;font-size:20px;font-weight:800}.eml-k span{font-size:12.5px;color:var(--muted)}"
      + ".eml details{margin-top:8px}.eml summary{cursor:pointer;font-size:13.5px;font-weight:600;padding:4px 0}"
      + ".eml textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:60px}"
      + ".eml input[type=file]{font:inherit;font-size:13.5px}";
    document.head.appendChild(st);
  }

  // ---- the file -------------------------------------------------------------------------------------
  function parseCsv(text) {
    text = String(text || "").replace(/^﻿/, "");
    const first = text.split(/\r?\n/, 1)[0] || "";
    const delim = [",", ";", "\t"].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = [];
    let row = [], cell = "", q = false;
    const end = () => { row.push(cell); cell = ""; if (row.some(x => String(x).trim() !== "")) rows.push(row); row = []; };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
      } else if (c === '"' && cell === "") q = true;
      else if (c === delim) { row.push(cell); cell = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; end(); }
      else cell += c;
    }
    end();
    return { delim, head: (rows[0] || []).map(h => String(h).trim()), rows: rows.slice(1) };
  }
  const normHead = h => String(h || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  function guessMap(head) {
    const map = {}, used = new Set(), hn = head.map(normHead);
    FIELDS.forEach(([f]) => {
      for (const w of GUESS[f]) { const i = hn.indexOf(w); if (i >= 0 && !used.has(i)) { map[f] = i; used.add(i); return; } }
      map[f] = -1;
    });
    return map;
  }

  // ---- the tab ----------------------------------------------------------------------------------------
  function mount(el, o) {
    injectStyle();
    const esc = o.esc;
    const S = window.__EML || (window.__EML = { view: "home", idx: null, idxErr: "", lid: null, list: null, listErr: "", q: "",
                                               dne: null, dneErr: "", dq: "", imp: null, msg: "", msgErr: false, busy: false, form: null });
    const root = () => document.getElementById("eamLists");
    const say = (m, bad) => { S.msg = m || ""; S.msgErr = !!bad; };
    const num = v => Number(v || 0).toLocaleString();
    const d10 = v => (v ? String(v).slice(0, 10) : "—");
    const who = v => String(v || "").split("@")[0];
    const pill = (t, c) => '<span class="eam-pill ' + (c || "") + '">' + esc(t) + "</span>";
    const msgLine = () => (S.msg ? '<p class="eam-msg ' + (S.msgErr ? "err" : "ok") + '" role="status">' + esc(S.msg) + "</p>" : "");
    const back = '<button type="button" class="eam-link" data-eml-home="1" style="margin-bottom:10px">&larr; Contacts and lists</button>';

    function loadIdx() {
      return o.api("/api/_emailadmin?view=lists").then(j => { S.idx = j; S.idxErr = ""; paint(); })
        .catch(e => { S.idxErr = e.message || String(e); paint(); });
    }
    function loadList() {
      S.list = null; S.listErr = ""; paint();
      return o.api("/api/_emailadmin?view=contactlist&id=" + S.lid + (S.q ? "&q=" + encodeURIComponent(S.q) : "")).then(j => {
        S.list = j.list; S.form = { name: j.list.name, about: j.list.about || "", why: j.list.why || "" }; paint();
      }).catch(e => { S.listErr = e.message || String(e); paint(); });
    }
    function loadDne() {
      S.dne = null; S.dneErr = ""; paint();
      return o.api("/api/_emailadmin?view=dne" + (S.dq ? "&q=" + encodeURIComponent(S.dq) : "")).then(j => { S.dne = j; paint(); })
        .catch(e => { S.dneErr = e.message || String(e); paint(); });
    }
    function go(view, extra) {
      Object.assign(S, extra || {}); S.view = view; say("");
      if (view === "home") { S.imp = null; loadIdx(); }
      if (view === "list") loadList();
      if (view === "dne") loadDne();
      if (view === "new") { S.form = { name: "", about: "", why: "" }; paint(); }
      if (view === "import") { if (!S.idx) loadIdx(); paint(); }
    }

    // ---- home
    function homeHtml() {
      if (S.idxErr) return '<div class="panel">Could not load: ' + esc(S.idxErr) + "</div>";
      if (!S.idx) return '<div class="panel">Loading…</div>';
      const L = S.idx, lists = L.lists || [];
      let h = msgLine() + '<div class="eml-bar"><button type="button" class="rs-btn pri" data-eml-import="">Import a file…</button>'
        + '<button type="button" class="rs-btn" data-eml-new="1">New list</button></div><div class="eml-grid"><div>';
      h += '<div class="eam-card"><p class="eam-h">Your lists</p>'
        + (lists.length ? lists.map(l => '<div class="eml-row"><div class="tx"><b>' + esc(l.name) + '</b><span class="eam-sub">' + esc(l.about || "How we got them: not written yet")
          + "</span>" + (+l.blocked ? '<span class="eam-sub">' + num(l.blocked) + " on Do not email: they won't get anything</span>" : "") + '</div><span class="n">' + num(l.members) + " "
          + (+l.members === 1 ? "person" : "people") + '</span><button type="button" class="rs-btn" data-eml-list="' + l.id + '">Open</button></div>').join("")
          : '<p class="eam-help">No lists yet. Lists start empty: make one with <b>New list</b>, then import a file into it. '
            + "Each list has its own line at the bottom of its emails saying why people get them.</p>")
        + "</div>";
      h += '</div><div><div class="eam-card"><p class="eam-h">Kept up to date from our own data</p>'
        + (L.built || []).map(b => '<div class="eml-row"><div class="tx"><b>' + esc(b.name) + '</b><span class="eam-sub">' + esc(b.about) + '</span><span class="eam-sub">Used by: '
          + esc(b.used) + '</span></div><span class="n">' + num(b.n) + " " + esc(b.unit) + "</span></div>").join("")
        + '<p class="eam-help">Open leads join once sales agrees to email them.</p></div>'
        + '<div class="eam-card"><p class="eam-h">Do not email</p><p class="eam-help" style="margin-top:0">One list for every email we send: unsubscribed, bounced, '
        + "marked as spam, imported or added by hand. Every email checks it right before it goes, and nobody on it can be imported into a list.</p>"
        + '<div class="eml-row"><div class="tx"><b>' + num(L.dne) + " " + (+L.dne === 1 ? "address" : "addresses") + '</b></div><button type="button" class="rs-btn" data-eml-dne="1">Open</button></div></div>'
        + "</div></div>";
      return h;
    }

    // ---- one list (and a new one)
    function formHtml(isNew) {
      const f = S.form || {};
      return '<div class="eam-card eam-ed">' + (isNew ? '<p class="eam-h">New list</p>' : "")
        + '<label class="l" for="emlName"' + (isNew ? "" : ' style="margin-top:0"') + ">Name</label><input id=\"emlName\" maxlength=\"80\" value=\"" + esc(f.name) + '" placeholder="Realtors">'
        + '<label class="l" for="emlAbout">How we got these people</label><input id="emlAbout" maxlength="200" value="' + esc(f.about) + '" placeholder="Real estate partners we work with">'
        + '<label class="l" for="emlWhy">Printed at the bottom of every email to this list</label><textarea id="emlWhy" maxlength="300" placeholder="You’re getting this because you work with Zip To Zip Moving as a real estate partner.">'
        + esc(f.why) + '</textarea><p class="eam-help">Say plainly why they get our emails. Today’s emails say “because you moved with Zip To Zip Moving”, which isn’t true for a list.</p>'
        + '<div class="rs-bar" style="margin-top:12px"><span class="rs-spacer" style="flex:1"></span>' + (isNew ? '<button type="button" class="rs-btn" data-eml-home="1">Cancel</button>' : "")
        + '<button type="button" class="rs-btn pri" id="emlSave"' + (S.busy ? " disabled" : "") + ">" + (isNew ? "Create the list" : "Save changes") + "</button></div></div>";
    }
    function listHtml() {
      if (S.listErr) return back + '<div class="panel">Could not load: ' + esc(S.listErr) + "</div>";
      if (!S.list) return back + '<div class="panel">Loading…</div>';
      const L = S.list, ms = L.members || [], blocked = ms.filter(m => m.blocked).length;
      let h = back + msgLine() + '<div class="eam-head"><span class="t">' + esc(L.name) + "</span>" + pill(num(L.total) + (L.total === 1 ? " person" : " people"))
        + '<span class="sp"></span><button type="button" class="rs-btn pri" data-eml-import="' + L.id + '">Import a file into it…</button>'
        + '<button type="button" class="rs-btn" id="emlSend"' + (L.total ? "" : " disabled") + ">Send an email to this list</button>"
        + '<button type="button" class="rs-btn" id="emlArchive">Archive</button></div>';
      h += '<div class="eml-grid"><div><div class="panel" style="padding:12px 14px"><div class="eml-bar" style="margin:0 0 8px"><input id="emlQ" type="search" placeholder="Find a name or address" value="'
        + esc(S.q) + '" style="flex:1;min-width:200px;font:inherit;font-size:14px;padding:7px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)">'
        + (blocked ? '<span class="eam-help" style="margin:0">' + blocked + " of these on Do not email: they won't get anything</span>" : "") + "</div>"
        + '<div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Person</th><th>Where we got them</th><th>Added</th><th></th></tr></thead><tbody>'
        + (ms.length ? ms.map(m => '<tr class="' + (m.blocked ? "eam-dim" : "") + '"><td><b>' + esc([m.first_name, m.last_name].filter(Boolean).join(" ") || "—") + '</b><span class="eam-sub">'
            + esc(m.email) + (m.phone ? " · " + esc(m.phone) : "") + "</span>" + (m.blocked ? pill("Do not email", "eam-bad") : "") + "</td><td>" + esc(m.source || "—")
            + '<span class="eam-sub">' + esc(d10(m.acquired_at)) + (m.consent ? " · " + esc(m.consent) : "") + "</span></td><td>" + esc(d10(m.added_at)) + '<span class="eam-sub">'
            + esc(who(m.added_by)) + '</span></td><td style="width:1%;white-space:nowrap"><button type="button" class="rs-btn" data-eml-rm="' + m.id + '" aria-label="Take '
            + esc(m.email) + ' off this list">Remove</button></td></tr>').join("")
          : '<tr><td colspan="4" class="dim">' + (S.q ? "Nobody matches." : "Nobody yet. Import a file into this list.") + "</td></tr>")
        + "</tbody></table></div>" + (L.total > ms.length ? '<p class="eam-help">Showing ' + num(ms.length) + " of " + num(L.total) + ". Search to find someone.</p>" : "") + "</div></div><div>";
      h += formHtml(false);
      const im = L.imports || [];
      h += '<div class="eam-card"><p class="eam-h">Imports</p>' + (im.length ? im.map(i => '<div class="eml-row"><div class="tx"><b>' + esc(i.file_name || "a file") + '</b><span class="eam-sub">'
          + esc(d10(i.at)) + " · " + esc(who(i.by_email)) + '</span><span class="eam-sub">' + [[i.skipped_unsub, "marked unsubscribed"], [i.skipped_blocked, "on Do not email"],
            [i.skipped_bad, "no valid address"], [i.skipped_dupe, "repeated"]].filter(x => +x[0]).map(x => num(x[0]) + " " + x[1]).join(" · ") + '</span></div><span class="n">+'
          + num(i.added) + "</span></div>").join("") : '<p class="eam-help">None yet.</p>') + "</div></div></div>";
      return h;
    }

    // ---- do not email
    function dneHtml() {
      if (S.dneErr) return back + '<div class="panel">Could not load: ' + esc(S.dneErr) + "</div>";
      if (!S.dne) return back + '<div class="panel">Loading…</div>';
      const D = S.dne, rows = D.rows || [];
      let h = back + msgLine() + '<div class="eam-head"><span class="t">Do not email</span>' + pill(num(D.people) + " addresses")
        + '<span class="sp"></span><button type="button" class="rs-btn" data-eml-import="dne">Import a file onto it…</button></div>'
        + '<p class="eam-help" style="margin:-4px 0 10px">Every email we send checks this list right before it goes: the survey, the automations and single sends. '
        + "It matches the mailbox, not just the spelling (Gmail ignores dots and anything after a +). Nobody comes off it here: an unsubscribe is for good.</p>"
        + '<div class="eml-k">' + Object.keys(D.by_via || {}).map(k => "<div><b>" + num(D.by_via[k]) + "</b><span>" + esc(k) + "</span></div>").join("") + "</div>";
      h += '<div class="eml-grid"><div class="panel" style="padding:12px 14px"><div class="eml-bar" style="margin:0 0 8px"><input id="emlDq" type="search" placeholder="Find an address" value="' + esc(S.dq)
        + '" style="flex:1;min-width:200px;font:inherit;font-size:14px;padding:7px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)"></div>'
        + '<div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Address</th><th>Stops</th><th>Why</th><th>When</th></tr></thead><tbody>'
        + (rows.length ? rows.map(r => "<tr><td><b>" + esc(r.email) + "</b></td><td>" + esc(r.stops) + "</td><td>" + esc(r.why) + (r.note ? '<span class="eam-sub">' + esc(r.note) + "</span>" : "")
            + "</td><td>" + esc(d10(r.at)) + (r.by_email ? '<span class="eam-sub">' + esc(who(r.by_email)) + "</span>" : "") + "</td></tr>").join("")
          : '<tr><td colspan="4" class="dim">' + (S.dq ? "Nobody matches." : "Nobody yet.") + "</td></tr>") + "</tbody></table></div>"
        + (D.total > rows.length ? '<p class="eam-help">Showing the newest ' + num(rows.length) + ". Search to find someone.</p>" : "") + "</div>"
        + '<div class="eam-card eam-ed"><p class="eam-h">Add an address by hand</p><p class="eam-help" style="margin-top:0">For someone who asked us to stop by phone, text or reply. '
        + 'It stops every email we send them.</p><label class="l" for="emlDneEmail">Address</label><input id="emlDneEmail" type="email" placeholder="name@example.com">'
        + '<label class="l" for="emlDneNote">Why</label><input id="emlDneNote" maxlength="200" placeholder="Asked on the phone to stop emailing">'
        + '<div class="rs-bar" style="margin-top:12px"><span class="rs-spacer" style="flex:1"></span><button type="button" class="rs-btn pri" id="emlDneAdd"' + (S.busy ? " disabled" : "") + ">Add to Do not email</button></div></div></div>";
      return h;
    }

    // ---- import
    const targetName = t => (t === "dne" ? "Do not email" : ((S.idx && (S.idx.lists || []).find(l => String(l.id) === String(t))) || {}).name || "a list");
    const targetList = t => (t === "dne" ? null : (S.idx && (S.idx.lists || []).find(l => String(l.id) === String(t))) || null);
    function importHtml() {
      const I = S.imp || (S.imp = { step: 1, target: "", own: false });
      const lists = (S.idx && S.idx.lists) || [];
      const title = '<div class="eml-bar" style="justify-content:space-between"><p class="eam-h" style="margin:0;font-size:17px">Import a file</p><span class="eml-steps">Step '
        + I.step + " of 3 · " + ["where it goes and the file", "match the columns", "check, then import"][I.step - 1] + "</span></div>";
      let h = back + msgLine() + '<div class="eam-card eam-ed" style="max-width:900px">' + title;
      if (I.done) {
        const R = I.done;
        return back + '<div class="eam-card" style="max-width:900px"><p class="eam-h">Done</p><p style="font-size:15px;margin:6px 0">'
          + (R.target === "dne" ? num(R.add) + " put on Do not email." : num(R.add) + " added to " + esc(R.list) + ".")
          + (R.counts && R.counts.unsub ? " " + num(R.counts.unsub) + " marked unsubscribed went on Do not email." : "") + "</p>"
          + '<div class="rs-bar" style="margin-top:12px">' + (R.target === "dne" ? '<button type="button" class="rs-btn pri" data-eml-dne="1">Open Do not email</button>'
            : '<button type="button" class="rs-btn pri" data-eml-list="' + I.target + '">Open the list</button>') + '<button type="button" class="rs-btn" data-eml-import="' + I.target + '">Import another file</button></div></div>';
      }
      if (I.step === 1) {
        h += '<label class="l" style="margin-top:0">Where it goes</label><div id="emlTarget"></div>'
          + (lists.length ? "" : '<p class="eam-help">No lists yet. <button type="button" class="eam-link" data-eml-new="1">Make one first</button>, or import onto Do not email.</p>')
          + '<label class="l" for="emlFile">The file</label><input id="emlFile" type="file" accept=".csv,text/csv">'
          + '<p class="eam-help">A CSV with the column names in its first row. From Excel or Google Sheets: save or download it as CSV.</p>';
        return h + "</div>";
      }
      const list = targetList(I.target), dne = I.target === "dne";
      if (I.step === 2) {
        const shown = dne ? FIELDS.filter(f => f[0] === "email") : FIELDS;
        const ex = i => { if (i < 0) return ""; const r = I.rows.find(x => String(x[i] || "").trim()); return r ? String(r[i]).trim() : ""; };
        h += '<div class="eml-why">' + esc(I.file) + " · " + num(I.rows.length) + " " + (I.rows.length === 1 ? "person" : "people") + " · into " + esc(targetName(I.target)) + "</div>"
          + '<div class="rs-tablewrap" style="border:0;margin-top:10px"><table class="eml-map"><thead><tr><th>Our field</th><th>Column in the file</th><th>Example</th></tr></thead><tbody>'
          + shown.map(([f, label, hint]) => "<tr><td><b>" + esc(label) + "</b>" + (hint ? '<span class="eam-sub">' + esc(hint) + "</span>" : "") + '</td><td><div data-eml-map="' + f
            + '"></div></td><td class="eam-sub" style="margin:0">' + esc(ex(I.map[f])) + "</td></tr>").join("") + "</tbody></table></div>";
        if (!dne) {
          h += (list ? '<div class="eml-why"><b>Printed at the bottom of every email to this list:</b> ' + esc(list.why) + "</div>" : "")
            + '<div class="eml-note">Anyone the file marks as unsubscribed goes on Do not email instead. Anyone already on Do not email is skipped and listed. '
            + "Bought, rented or scraped lists can’t be imported: our email provider forbids them, and they hurt delivery for every email we send.</div>"
            + '<label class="eml-tick"><input type="checkbox" id="emlOwn"' + (I.own ? " checked" : "") + '><span>These people gave us their address themselves: customers, partners, '
            + "people who signed up or asked for a quote. Nobody was bought, rented or scraped.</span></label>";
        } else {
          h += '<div class="eml-note">Everyone in the file goes on Do not email: they won’t get any email from us again, the survey included.</div>';
        }
        return h + '<div class="rs-bar" style="margin-top:12px"><button type="button" class="rs-btn" data-eml-step="1">Back</button><span class="rs-spacer" style="flex:1"></span>'
          + '<button type="button" class="rs-btn pri" id="emlCheck"' + (I.map.email >= 0 && !S.busy ? "" : " disabled") + ">Check the file</button></div></div>";
      }
      const R = I.check || {}, c = R.counts || {};
      const why = { bad: "No valid address", dupe: "Repeated in the file", unsub: "Marked unsubscribed (they go on Do not email)", blocked: "Already on Do not email" };
      h += '<div class="eml-k"><div><b>' + num(R.add) + "</b><span>" + (dne ? "go on Do not email" : "will be added to " + esc(R.list)) + "</span></div>"
        + "<div><b>" + num(R.already) + "</b><span>" + (dne ? "are on it already" : "are on the list already") + "</span></div>"
        + (dne ? "" : "<div><b>" + num(R.new_contacts) + "</b><span>new contacts</span></div>")
        + Object.keys(why).filter(k => c[k]).map(k => "<div><b>" + num(c[k]) + "</b><span>" + esc(why[k]) + "</span></div>").join("") + "</div>"
        + Object.keys(why).filter(k => (R.skipped || {})[k] && R.skipped[k].length).map(k => "<details><summary>" + esc(why[k]) + " (" + num(c[k]) + ")</summary>"
          + '<table class="rs-table rs-even" style="margin-top:6px"><thead><tr><th>Row</th><th>Address</th><th>Note</th></tr></thead><tbody>'
          + R.skipped[k].map(s => "<tr><td>" + esc(s.line) + "</td><td>" + esc(s.email) + "</td><td>" + esc(s.note || "") + "</td></tr>").join("")
          + "</tbody></table>" + (c[k] > R.skipped[k].length ? '<p class="eam-help">First ' + R.skipped[k].length + " shown.</p>" : "") + "</details>").join("");
      const can = R.add > 0 || (!dne && c.unsub > 0);
      return h + '<div class="rs-bar" style="margin-top:14px"><button type="button" class="rs-btn" data-eml-step="2">Back</button><span class="rs-spacer" style="flex:1"></span>'
        + '<button type="button" class="rs-btn pri" id="emlGo"' + (can && !S.busy ? "" : " disabled") + ">" + (dne ? "Put " + num(R.add) + " on Do not email" : "Import " + num(R.add) + (R.add === 1 ? " person" : " people"))
        + "</button></div>" + (can ? "" : '<p class="eam-help">Nothing to import from this file.</p>') + "</div>";
    }
    function importRows() {
      const I = S.imp;
      return I.rows.map(r => { const o2 = {}; FIELDS.forEach(([f]) => { const i = I.map[f]; if (i >= 0) o2[f] = r[i] == null ? "" : String(r[i]); }); return o2; });
    }

    // ---- paint and wire
    function paint() {
      const r = root();
      if (!r) return;
      r.className = "eml";
      r.innerHTML = S.view === "list" ? listHtml() : S.view === "dne" ? dneHtml() : S.view === "new" ? back + msgLine() + '<div style="max-width:720px">' + formHtml(true) + "</div>"
        : S.view === "import" ? importHtml() : homeHtml();
      wire(r);
    }
    function wire(r) {
      const $ = s => r.querySelector(s), $$ = s => r.querySelectorAll(s);
      $$("[data-eml-home]").forEach(b => { b.onclick = () => go("home"); });
      $$("[data-eml-new]").forEach(b => { b.onclick = () => go("new"); });
      $$("[data-eml-dne]").forEach(b => { b.onclick = () => go("dne", { dq: "" }); });
      $$("[data-eml-list]").forEach(b => { b.onclick = () => go("list", { lid: +b.dataset.emlList, q: "" }); });
      $$("[data-eml-import]").forEach(b => { b.onclick = () => go("import", { imp: { step: 1, target: b.dataset.emlImport || "", own: false } }); });
      const bind = (sel, k) => { const x = $(sel); if (x) x.oninput = () => { S.form[k] = x.value; }; };
      bind("#emlName", "name"); bind("#emlAbout", "about"); bind("#emlWhy", "why");
      const sv = $("#emlSave");
      if (sv) sv.onclick = () => {
        const isNew = S.view === "new";
        S.busy = true; paint();
        o.post({ action: "list_save", id: isNew ? null : S.lid, data: S.form }).then(j => {
          S.busy = false; say(isNew ? "List created. Now import a file into it." : "Saved.");
          if (isNew) { S.lid = j.id; S.view = "list"; S.q = ""; loadIdx(); }
          loadList();
        }).catch(e => { S.busy = false; say(e.message, true); paint(); });
      };
      const q = $("#emlQ");
      if (q) { q.onkeydown = e => { if (e.key === "Enter") { S.q = q.value.trim(); loadList(); } }; q.onsearch = () => { S.q = q.value.trim(); loadList(); }; }
      const dq = $("#emlDq");
      if (dq) { dq.onkeydown = e => { if (e.key === "Enter") { S.dq = dq.value.trim(); loadDne(); } }; dq.onsearch = () => { S.dq = dq.value.trim(); loadDne(); }; }
      $$("[data-eml-rm]").forEach(b => { b.onclick = () => {
        if (!confirm("Take this person off “" + S.list.name + "”? They stay a contact and can be imported again.")) return;
        b.disabled = true;
        o.post({ action: "list_remove", id: S.lid, contact: +b.dataset.emlRm }).then(() => { say("Taken off the list."); loadList(); })
          .catch(e => { say(e.message, true); paint(); });
      }; });
      const ar = $("#emlArchive");
      if (ar) ar.onclick = () => {
        if (!confirm("Archive “" + S.list.name + "”? It leaves the lists and can’t be picked for a send. Its people stay contacts.")) return;
        o.post({ action: "list_archive", id: S.lid }).then(() => { go("home"); say("List archived."); }).catch(e => { say(e.message, true); paint(); });
      };
      const sd = $("#emlSend"); if (sd) sd.onclick = () => o.onSend && o.onSend(S.list.id);
      const da = $("#emlDneAdd");
      if (da) da.onclick = () => {
        const email = ($("#emlDneEmail").value || "").trim(), note = ($("#emlDneNote").value || "").trim();
        if (!confirm("Put " + email + " on Do not email? Nobody can take them off it here.")) return;
        S.busy = true; paint();
        o.post({ action: "dne_add", email, note }).then(() => { S.busy = false; say(email + " is on Do not email."); loadDne(); })
          .catch(e => { S.busy = false; say(e.message, true); paint(); const x = root() && root().querySelector("#emlDneEmail"); if (x) x.value = email; });
      };
      // import
      // the kit's own dropdowns (the page standard, ZTZ-80: no native selects)
      const tg = $("#emlTarget");
      if (tg) RSC.localSelect(tg, { label: "Where it goes", form: true, required: true, allLabel: "Choose…", value: String(S.imp.target || ""),
        values: ((S.idx && S.idx.lists) || []).map(l => ({ v: String(l.id), l: "The list “" + l.name + "”" }))
          .concat([{ v: "dne", l: "Do not email (nobody on it gets any email)" }]),
        onChange: v => { S.imp.target = v; } });
      const fl = $("#emlFile");
      if (fl) fl.onchange = () => {
        const f = fl.files && fl.files[0];
        if (!f) return;
        if (!S.imp.target) { say("Choose where it goes first.", true); fl.value = ""; paint(); return; }
        if (/\.(xlsx?|numbers)$/i.test(f.name)) { say("That is a spreadsheet file. Save it as CSV first (Excel: File › Save As › CSV).", true); fl.value = ""; paint(); return; }
        if (f.size > MAX_BYTES) { say("The file is over 10 MB. Split it and import each part.", true); fl.value = ""; paint(); return; }
        const rd = new FileReader();
        rd.onload = () => {
          const p = parseCsv(rd.result);
          if (!p.head.length || !p.rows.length) { say("The file has no rows under its column names.", true); paint(); return; }
          if (p.rows.length > ((S.idx && S.idx.max_import) || 20000)) { say("The file has " + num(p.rows.length) + " rows. Up to " + num((S.idx && S.idx.max_import) || 20000) + " per file: split it.", true); paint(); return; }
          Object.assign(S.imp, { step: 2, file: f.name, head: p.head, rows: p.rows, map: guessMap(p.head), check: null });
          say(""); paint();
        };
        rd.onerror = () => { say("The file could not be read.", true); paint(); };
        rd.readAsText(f);
      };
      $$("[data-eml-map]").forEach(s => {
        const f = s.dataset.emlMap;
        RSC.localSelect(s, { label: f, form: true, required: true, value: String(S.imp.map[f]),
          values: [{ v: "-1", l: f === "email" ? "Choose…" : "Not in the file" }].concat(S.imp.head.map((c, i) => ({ v: String(i), l: c || "Column " + (i + 1) }))),
          onChange: v => { S.imp.map[f] = +v; paint(); } });
      });
      const own = $("#emlOwn"); if (own) own.onchange = () => { S.imp.own = own.checked; };
      $$("[data-eml-step]").forEach(b => { b.onclick = () => { S.imp.step = +b.dataset.emlStep; say(""); paint(); }; });
      const ck = $("#emlCheck");
      if (ck) ck.onclick = () => {
        S.busy = true; say("Checking…"); paint();
        o.post({ action: "import", target: S.imp.target, rows: importRows(), file: S.imp.file, dry: true, own: S.imp.own }).then(j => {
          S.busy = false; S.imp.check = j; S.imp.step = 3; say(""); paint();
        }).catch(e => { S.busy = false; say(e.message, true); paint(); });
      };
      const gb = $("#emlGo");
      if (gb) gb.onclick = () => {
        const I = S.imp, dne = I.target === "dne";
        if (!dne && !I.own) { S.imp.step = 2; say("Tick that these people gave us their address themselves.", true); paint(); return; }
        if (!confirm(dne ? "Put " + num(I.check.add) + " addresses on Do not email? Nobody can take them off it here." : "Import " + num(I.check.add) + " people into “" + I.check.list + "”?")) return;
        S.busy = true; say("Importing…"); paint();
        o.post({ action: "import", target: I.target, rows: importRows(), file: I.file, dry: false, own: I.own }).then(j => {
          S.busy = false; S.imp.done = j; say(""); S.imp.rows = []; loadIdx();
        }).catch(e => { S.busy = false; say(e.message, true); paint(); });
      };
    }

    if (S.view === "list" && S.lid) { paint(); loadList(); }
    else if (S.view === "dne") { paint(); loadDne(); }
    else if (S.view === "import" || S.view === "new") { paint(); loadIdx(); }
    else { S.view = "home"; paint(); loadIdx(); }
  }

  window.EMAILLISTS = { mount, parseCsv, guessMap, reset: () => { window.__EML = null; } };
})();
