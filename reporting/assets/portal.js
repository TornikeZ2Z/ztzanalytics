/* Zip to Zip portal — shared runtime: auth (Google Identity), bridge API, header nav, helpers.
   Used by the landing page, the Reporting System hub, and every dashboard page.
   (data.html keeps its own inline runtime for now — same token, same localStorage key.) */
window.ZTZ = (function () {
  const API = "https://ztz-bridge-32168089642.us-east4.run.app";
  const CLIENT_ID = "32168089642-fkk3rglncf6hl5ikq7pi6jbornug1kbb.apps.googleusercontent.com";
  const TOKEN_KEY = "ztz_tok";
  const VIEW_AS_KEY = "ztz_view_as";
  /* Did THIS tab ever hold a live session? Arms the "sign in again" card (see
     sessionLapsed below). A tab that opened signed out has the gate instead. */
  let hadSession = false;
  let sessionEmail = "";
  let sessionWaiters = [];

  /* ---------- admin "view as user" ----------
     Which user the portal is currently being previewed AS. sessionStorage, not
     localStorage, on purpose: impersonation must not survive into a new tab or outlive
     the session — closing the tab always drops you back to yourself.
     The bridge is the enforcer (it swaps the ACL entry server-side and refuses writes);
     this is only the client half that says who to ask for. */
  function getViewAs() { try { return sessionStorage.getItem(VIEW_AS_KEY) || ""; } catch (e) { return ""; } }
  function setViewAs(em) {
    try { em ? sessionStorage.setItem(VIEW_AS_KEY, String(em).toLowerCase()) : sessionStorage.removeItem(VIEW_AS_KEY); }
    catch (e) {}
  }
  /* Inject X-View-As on EVERY bridge request from ONE place.
     There are ~20 call sites that build their own fetch() instead of going through
     ZTZ.api — money-flow, ld-planning, foreman-closings, the relay proxies, and so on.
     Adding the header at each of them would guarantee a forgotten one, and a preview that
     silently answers as the admin for some requests is worse than no preview at all. That
     "a gate some paths bypass" shape is exactly the 2026-07-26 access bug. So patch once,
     match on the bridge origin, and add nothing but the header. */
  /* The same single patch also holds back a bridge request whose session has RUN OUT
     (2026-11-08). ~75 call sites fetch with ZTZ.getToken() directly; after the 12-hour
     token expires they send "Bearer null" and each fails in its own way. Here the request
     waits behind the "sign in again" card instead, and goes out with the fresh token once
     the person signs in, so whatever they clicked simply finishes. */
  (function patchFetchForViewAs() {
    if (typeof window.fetch !== "function" || window.__ztzViewAsPatched) return;
    window.__ztzViewAsPatched = true;
    const orig = window.fetch;
    const headersOf = (input, init) => new Headers((init && init.headers) ||
      (typeof input !== "string" && input && input.headers) || {});
    window.fetch = function (input, init) {
      const self = this;
      let lapsed = false;
      try {
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (url.indexOf(API) === 0) {
          const as = getViewAs();
          if (as) {
            init = Object.assign({}, init || {});
            const h = headersOf(input, init);
            h.set("X-View-As", as);
            init.headers = h;
          }
          // Only a request that CARRIES a dead token: pre-auth routes send none, and
          // /api/_session carries the fresh Google credential that ends the wait.
          const auth = headersOf(input, init).get("Authorization") || "";
          lapsed = hadSession && /^Bearer\s/i.test(auth) && url.indexOf("/api/_session") < 0
            && !tokenValid(auth.replace(/^Bearer\s+/i, ""));
        }
      } catch (e) { /* never let the preview break a real request */ }
      if (!lapsed) return orig.call(self, input, init);
      return whenSignedIn().then(function () {
        init = Object.assign({}, init || {});
        const h = headersOf(input, init);
        h.set("Authorization", "Bearer " + getToken());
        init.headers = h;
        return orig.call(self, input, init);
      });
    };
  })();

  /* ---------- token ---------- */
  function decodeJwt(t) {
    try { return JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); }
    catch (e) { return {}; }
  }
  function tokenValid(t) { const p = decodeJwt(t); return !!(p.exp && p.exp * 1000 > Date.now() + 30000); }
  function getToken() {
    let t = null; try { t = localStorage.getItem(TOKEN_KEY); } catch (e) {}
    return (t && tokenValid(t)) ? t : null;
  }
  function setToken(t) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {}
    // Keep the FIRST account of this page's life: sessionBack() compares against it to
    // tell "same person signed back in" from "someone else took the seat".
    hadSession = true; sessionEmail = sessionEmail || decodeJwt(t).email || "";
  }
  // A deliberate clear (Sign out, a 401) is followed by a reload to the gate: disarm the
  // card so it cannot flash up in between.
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} hadSession = false; }
  function email() { const t = getToken(); return t ? (decodeJwt(t).email || "") : ""; }

  /* ---------- the session ran out while the page was open ----------
     Bridge sessions last 12 hours, and a tab easily outlives one. Until 2026-11-08 nothing
     said so: ZTZ.api threw "Not signed in" and each page printed that where its results go.
     On Conversations it sat in grey under the Find button and read as "no calls with this
     customer": a call that the warehouse held all along, with its transcript, looked as if
     RingCentral had missed it.

     So one place notices instead of every page: when a session THIS tab held runs out, a
     card covers the page and asks for a sign-in. Signing in there does NOT reload, so filters,
     a typed search and an open drawer survive, and every request that was waiting (ZTZ.api
     and the direct fetches alike, see the fetch patch above) goes out with the new token.
     A different Google account reloads instead, because the menu and grants were the old
     person's. A sign-in in another tab of the portal closes the card here too. */
  function sessionCard() { return document.getElementById("ztzSessionCard"); }
  function releaseWaiters() {
    const w = sessionWaiters; sessionWaiters = [];
    w.forEach(function (f) { try { f(); } catch (e) {} });
  }
  /* The session is live again: close the card and let the queued requests go. */
  function sessionBack() {
    const em = email();
    if (sessionEmail && em && em.toLowerCase() !== sessionEmail.toLowerCase()) {
      location.reload(); return;
    }
    const c = sessionCard(); if (c) c.remove();
    releaseWaiters();
  }
  function showSessionCard() {
    if (sessionCard() || !document.body) return;
    if (!document.getElementById("ztz-session-style")) {
      const st = document.createElement("style"); st.id = "ztz-session-style";
      st.textContent =
        // On <body>, never inside #content: its rsfade transform would capture a fixed child.
        ".ztzsess{position:fixed;inset:0;z-index:10050;display:grid;place-items:center;padding:16px;" +
        "background:rgba(6,10,16,.55);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px)}" +
        ".ztzsess-card{width:100%;max-width:400px;box-sizing:border-box;text-align:center;" +
        "background:var(--panel,#fff);color:var(--ink,#16202c);border:1px solid var(--line,#e3e8f0);" +
        "border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.35);padding:30px 28px 26px}" +
        ".ztzsess-card h2{margin:0 0 8px;font-size:19px;font-weight:800;color:var(--ink,#16202c)}" +
        ".ztzsess-card p{margin:0 0 18px;font-size:13.5px;line-height:1.55;color:var(--muted,#5b6b7c)}" +
        ".ztzsess-card .ztzsess-who{margin:14px 0 0;font-size:12px;color:var(--faint,#8a97a6)}" +
        ".ztzsess-slot{display:flex;justify-content:center;min-height:44px}" +
        ".ztzsess-err{margin-top:10px;font-size:12.5px;color:#d9534f}";
      document.head.appendChild(st);
    }
    const c = document.createElement("div");
    c.id = "ztzSessionCard"; c.className = "ztzsess";
    c.setAttribute("role", "dialog"); c.setAttribute("aria-modal", "true");
    c.setAttribute("aria-labelledby", "ztzSessTitle");
    const who = sessionEmail.replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch];
    });
    c.innerHTML =
      '<div class="ztzsess-card">' +
      '<h2 id="ztzSessTitle">Sign in again to keep going</h2>' +
      "<p>Your portal session ran out (sessions last 12 hours). Sign in and this page carries " +
      "on where you left off.</p>" +
      '<div class="ztzsess-slot" id="ztzSessSlot"></div>' +
      '<div class="ztzsess-err" id="ztzSessErr"></div>' +
      (who ? '<p class="ztzsess-who">Last signed in as <b>' + who + "</b></p>" : "") +
      "</div>";
    document.body.appendChild(c);
    mountSignin(document.getElementById("ztzSessSlot"), { onDone: sessionBack })
      .catch(function () {
        const e = document.getElementById("ztzSessErr");
        if (e) e.textContent = "Google sign-in couldn't load. Check your internet connection " +
          "and refresh this page.";
      });
  }
  /* Resolves once a live session exists, showing the card if it has to ask for one. */
  function whenSignedIn() {
    if (getToken()) return Promise.resolve();
    showSessionCard();
    return new Promise(function (res) { sessionWaiters.push(res); });
  }
  function checkSession() {
    if (!hadSession) return;
    if (getToken()) { if (sessionCard() || sessionWaiters.length) sessionBack(); return; }
    showSessionCard();
  }
  (function watchSession() {
    hadSession = !!getToken();
    sessionEmail = email();
    // 15 s is plenty: getToken() already treats a token as dead 30 s before it expires, and
    // a tab coming back from the background is checked the moment it is shown.
    setInterval(checkSession, 15000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") checkSession();
    });
    window.addEventListener("focus", checkSession);
    window.addEventListener("storage", function (e) {
      if (!e || e.key === TOKEN_KEY || e.key === null) checkSession();
    });
  })();
  /* Exchange a fresh Google ID token for a long-lived bridge session token.
     Returns the session token, or the original credential if the exchange fails
     (e.g. bridge not yet redeployed) so sign-in still works. */
  async function exchangeToken(credential) {
    try {
      const r = await fetch(API + "/api/_session",
        { method: "POST", headers: { Authorization: "Bearer " + credential } });
      if (r.ok) { const j = await r.json(); if (j && j.token) return j.token; }
    } catch (e) {}
    return credential;
  }

  /* ---------- bridge API ---------- */
  async function api(path) {
    // A session that ran out mid-visit waits for the sign-in card rather than failing.
    if (!getToken() && hadSession) await whenSignedIn();
    const t = getToken();
    if (!t) throw new Error("Not signed in");
    const r = await fetch(API + path, { headers: { Authorization: "Bearer " + t } });
    if (!r.ok) {
      if (r.status === 401) { clearToken(); location.reload(); }
      throw new Error("HTTP " + r.status + ": " + (await r.text()));
    }
    return r.json();
  }

  /* ---------- Google sign-in (programmatic GIS) ---------- */
  let gisLoading = null;
  function loadGis() {
    if (gisLoading) return gisLoading;
    gisLoading = new Promise((res, rej) => {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error("Google sign-in failed to load"));
      document.head.appendChild(s);
    });
    return gisLoading;
  }
  /* Render a Sign-in-with-Google button into `el`; onDone(token) after sign-in (default: reload). */
  async function mountSignin(el, opts) {
    opts = opts || {};
    await loadGis();
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      auto_select: true,
      callback: async (resp) => {
        // Trade the ~1h Google ID token for a long-lived (12h) bridge session
        // token so the user isn't forced to re-sign-in every hour. Falls back to
        // the raw credential if the bridge hasn't shipped the endpoint yet.
        const tok = await exchangeToken(resp.credential);
        setToken(tok);
        (opts.onDone || (() => location.reload()))(tok);
      },
    });
    google.accounts.id.renderButton(el, Object.assign(
      { type: "standard", size: "large", theme: "filled_black", shape: "pill" }, opts.button || {}));
  }

  /* ---------- header (standalone Reporting System site) ----------
     No nav links — just the brand, one subtitle, the user, and the theme toggle.
     The signed-in email opens a small account menu with Sign out — shared front-desk
     computers hold 12-hour sessions, so people need a way to hand the seat over. */
  /* ---------- dual clock (Tbilisi + New Jersey) ----------
     The office is in Georgia, the business runs in New Jersey, and the reports do NOT all
     agree on a zone: sales/leads/reviews are converted to America/New_York (curated.py's
     `Create Datetime NY`, lead_call's 08:00 NY working hours, the reminder bot), while Money
     Flow entry times are Asia/Tbilisi on purpose — its legacy streams (the forms sheet and DC
     submission_datetime) are recorded in Tbilisi time. Showing both live is the cheap fix for
     "is it even working hours over there right now?". */
  const CLOCK_ZONES = [
    { label: "Tbilisi", short: "TBI", tz: "Asia/Tbilisi" },
    { label: "New Jersey", short: "NJ", tz: "America/New_York" },
  ];
  const CLOCK_TITLE = "Local time in both offices. Most reports (sales, leads, reviews, the " +
    "reminder bot) are on New Jersey time; Money Flow entry times are Tbilisi time.";
  function clockHtml() {
    const now = new Date();
    const z = CLOCK_ZONES.map(function (c) {
      return { label: c.label, short: c.short,
        t: now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit" }),
        d: now.toLocaleDateString("en-CA", { timeZone: c.tz }) };
    });
    // Only worth the pixels when the two offices are on DIFFERENT calendar days — which for
    // most of the working day they are, and that is exactly when a time alone misleads.
    const diff = z[0].d !== z[1].d;
    // THE CHOSEN ZONE IS MARKED ON THE CLOCK ITSELF rather than in a separate control. The
    // clock already answers "what time is it there"; this makes it also answer "and which one
    // am I reading times in". UTC is not an office, so it only appears once chosen.
    const cur = (window.RS && RS.tzId) ? RS.tzId() : null;
    const CUR_MAP = { "America/New_York": "nj", "Asia/Tbilisi": "tbi" };
    const body = z.map(function (p, i) {
      const mark = (diff && i === 1) ? '<em>' + (p.d < z[0].d ? "prev day" : "next day") + '</em>' : "";
      const on = cur && CUR_MAP[CLOCK_ZONES[i].tz] === cur;
      return '<span class="ztzcz' + (on ? " on" : "") + '"><i><span class="lg">' + p.label + '</span>'
        + '<span class="sm">' + p.short + '</span></i><b>' + p.t + '</b>' + mark + '</span>';
    }).join('<span class="ztzcsep">·</span>');
    const utc = cur === "utc"
      ? '<span class="ztzcsep">·</span><span class="ztzcz on"><i><span class="lg">UTC</span>'
        + '<span class="sm">UTC</span></i><b>'
        + new Date().toLocaleTimeString("en-GB", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" })
        + "</b></span>"
      : "";
    return body + utc + '<span class="ztzcar">\u25be</span>';
  }
  function mountClock() {
    if (!document.getElementById("ztz-clock-style")) {
      const st = document.createElement("style"); st.id = "ztz-clock-style";
      st.textContent =
        ".ztzclock{display:flex;align-items:center;gap:9px;margin-right:14px;white-space:nowrap;" +
        "font-variant-numeric:tabular-nums;line-height:1.15}" +
        ".ztzcz{display:flex;align-items:baseline;gap:5px}" +
        ".ztzcz i{font-style:normal;font-size:10px;font-weight:700;letter-spacing:.04em;" +
        "text-transform:uppercase;color:var(--faint,#8a97a6)}" +
        ".ztzcz b{font-size:13px;font-weight:700;color:var(--ink,#16202c)}" +
        ".ztzcz em{font-style:normal;font-size:9.5px;font-weight:700;color:var(--faint,#8a97a6);" +
        "opacity:.85}" +
        ".ztzcsep{color:var(--faint,#8a97a6);opacity:.5}" +
        ".ztzclock{cursor:pointer;border-radius:9px;padding:3px 7px;margin-right:7px}" +
        ".ztzclock:hover{background:var(--panel-2,#f1f4f8)}" +
        // the zone whose times you are reading is the one in full colour; the other dims
        ".ztzcz{opacity:.5}.ztzcz.on{opacity:1}" +
        ".ztzcz.on b{color:var(--brand,#16202c)}" +
        ".ztzcar{font-size:9px;opacity:.5;margin-left:1px}" +
        ".ztztzm{position:fixed;z-index:230;min-width:216px;padding:7px;background:var(--panel,#fff);" +
        "border:1px solid var(--line,#d7dee8);border-radius:13px;box-shadow:0 14px 40px rgba(0,0,0,.3)}" +
        ".ztztzm h6{margin:2px 8px 7px;font-size:10px;font-weight:800;letter-spacing:.05em;" +
        "text-transform:uppercase;color:var(--faint,#8a97a6)}" +
        ".ztztzb{display:flex;width:100%;align-items:baseline;gap:8px;cursor:pointer;text-align:left;" +
        "border:0;background:transparent;border-radius:9px;padding:7px 9px;font:inherit;font-size:13px;" +
        "font-weight:650;color:var(--ink,#16202c)}" +
        ".ztztzb:hover{background:var(--panel-2,#f1f4f8)}" +
        ".ztztzb.on{background:var(--panel-2,#f1f4f8)}" +
        ".ztztzb u{text-decoration:none;margin-left:auto;font-size:12px;font-weight:700;" +
        "font-variant-numeric:tabular-nums;color:var(--muted,#5b6b7c)}" +
        ".ztztzb i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--brand,#2ea05a)}" +
        ".ztztzn{margin:6px 9px 3px;font-size:10.5px;line-height:1.5;color:var(--faint,#8a97a6)}" +
        ".ztzcz i .sm{display:none}" +
        // Never hidden, only abbreviated. "What time is it over there" is the whole point,
        // and it is MORE useful on a phone, not less.
        "@media(max-width:900px){.ztzcz i .lg{display:none}.ztzcz i .sm{display:inline}" +
        ".ztzclock{gap:7px;margin-right:9px}.ztzcz em{display:none}}" +
        "@media(max-width:420px){.ztzcz b{font-size:12px}.ztzclock{gap:5px;margin-right:6px}}";
      document.head.appendChild(st);
    }
    if (window.__ztzClockTimer) clearInterval(window.__ztzClockTimer);
    window.__ztzClockTimer = setInterval(function () {
      const el = document.getElementById("ztzClock");
      if (!el) { clearInterval(window.__ztzClockTimer); window.__ztzClockTimer = null; return; }
      el.innerHTML = clockHtml();
    }, 15000);
  }

  /* WHICH ZONE THE PAGE'S TIMES ARE IN, and how to change it. Every live time on the portal
     used to render in whatever zone its page happened to hardcode -- the reminder feed was
     pinned to New Jersey, the "Updated 14:32" footers took the browser's -- and NOTHING on
     screen said which. A Tbilisi reader had no way to know the bot's 4 PM was not their 4 PM.

     The menu says what it will and will not change, because the honest limit matters: it moves
     LIVE times, not the historical timestamps in the warehouse, which are stored as naive wall
     time in the zone each source records in (docs/timezones.md). */
  function openTzMenu(anchor) {
    const old = document.getElementById("ztzTzMenu");
    if (old) { old.remove(); return; }
    if (!(window.RS && RS.TZ_CHOICES)) return;
    const m = document.createElement("div");
    m.id = "ztzTzMenu"; m.className = "ztztzm";
    const r = anchor.getBoundingClientRect();
    m.style.top = Math.round(r.bottom + 8) + "px";
    m.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + "px";
    const now = new Date();
    m.innerHTML = "<h6>Show times in</h6>" + RS.TZ_CHOICES.map(function (c) {
      const on = c.id === RS.tzId();
      return '<button class="ztztzb' + (on ? " on" : "") + '" data-tz="' + c.id + '">'
        + c.label + (on ? ' <i>\u2713</i>' : "")
        + "<u>" + now.toLocaleTimeString("en-GB", { timeZone: c.tz, hour: "2-digit", minute: "2-digit" })
        + "</u></button>";
    }).join("")
      + '<div class="ztztzn">Applies to live times \u2014 when a page loaded, and the reminder '
      + "bot's feed. Dates and historical report timestamps keep the basis each report states.</div>";
    document.body.appendChild(m);
    m.addEventListener("click", function (ev) { ev.stopPropagation(); });
    m.querySelectorAll("[data-tz]").forEach(function (b) {
      b.onclick = function () { RS.setTz(b.getAttribute("data-tz")); m.remove(); refreshClock(); };
    });
    const close = function () { m.remove(); document.removeEventListener("click", close); };
    setTimeout(function () { document.addEventListener("click", close); }, 0);
  }
  function refreshClock() {
    const el = document.getElementById("ztzClock");
    if (el) el.innerHTML = clockHtml();
  }

  function header(active, subtitle) {
    const host = document.getElementById("ztzHeader");
    if (!host) return;
    const base = (location.pathname.match(/^.*\//) || ["/"])[0];
    const em = email();
    const who = em ? `<span class="av">${em[0].toUpperCase()}</span>${em}<span class="who-car" style="font-size:9px;opacity:.6;margin-left:5px">▾</span>` : "";
    host.innerHTML =
      `<div class="brand"><a href="${base}index.html" title="Home"><img class="brandlogo" src="${base}logo-wide.png" alt="Zip to Zip Moving"></a>` +
      (subtitle ? `<span class="brandsub">${subtitle}</span>` : "") + `</div>` +
      `<div class="spacer"></div>` +
      `<div class="ztzclock" id="ztzClock" title="${CLOCK_TITLE}">${clockHtml()}</div>` +
      `<div class="who" id="ztzWho">${who}</div>` +
      `<span id="ztzHeadSign"></span>`;
    mountClock();
    const clkEl = document.getElementById("ztzClock");
    if (clkEl && window.RS && RS.TZ_CHOICES) {
      clkEl.onclick = function (e) { e.stopPropagation(); openTzMenu(clkEl); };
      clkEl.title = "Local time in both offices \u2014 click to choose which zone the portal "
        + "shows live times in.";
    }
    if (!em) { mountSignin(document.getElementById("ztzHeadSign"), { button: { size: "medium" } }); return; }
    const whoEl = document.getElementById("ztzWho");
    whoEl.style.cursor = "pointer";
    whoEl.title = "Account";
    whoEl.onclick = (e) => {
      e.stopPropagation();
      const old = document.getElementById("ztzWhoMenu");
      if (old) { old.remove(); return; }
      const m = document.createElement("div");
      m.id = "ztzWhoMenu";
      m.style.cssText = "position:fixed;top:64px;right:14px;z-index:220;min-width:220px;padding:9px;" +
        "background:var(--panel,#fff);border:1px solid var(--line,#d7dee8);border-radius:13px;" +
        "box-shadow:0 14px 40px rgba(0,0,0,.3);font-size:13px";
      m.innerHTML =
        `<div style="padding:4px 8px 9px;color:var(--muted,#5b6b7c);border-bottom:1px solid var(--line,#e3e8f0);` +
        `overflow:hidden;text-overflow:ellipsis;white-space:nowrap">Signed in as <b>${em}</b></div>` +
        `<button id="ztzSignOut" style="display:block;width:100%;margin-top:8px;text-align:left;cursor:pointer;` +
        `border:1px solid var(--line,#e3e8f0);background:transparent;border-radius:9px;padding:8px 10px;` +
        `font-size:13px;font-weight:650;color:var(--ink,#16202c)">Sign out</button>`;
      document.body.appendChild(m);
      m.addEventListener("click", ev => ev.stopPropagation());
      m.querySelector("#ztzSignOut").onclick = () => {
        activity.flush();                     // the visit ends here, not at the reload
        clearToken(); location.reload();
      };
      const close = () => { m.remove(); document.removeEventListener("click", close); };
      setTimeout(() => document.addEventListener("click", close), 0);
    };
  }

  /* ---------- activity odometer (Administration > User Activity) ----------
     Measures how long the signed-in person spends on each report, and reports it to
     /api/_activity. Two numbers, because Tornike asked for two (2026-09-06): "i dont need
     to see just how long it was open".

       total  — wall clock on the page. A hidden tab still counts: it IS open.
       active — the part of that the person was actually engaged for: the tab visible AND
                some interaction (key, click, scroll, touch) inside the last minute.

     WHAT IT DOES NOT SEE, by design: no filters, no search terms, no rows, no keystroke
     content. The interaction listeners look only at the FACT that an event fired; they
     never read it. This is a usage log, not a keylogger.

     Slices are ADDITIVE and append-only — each flush sends the time since the last flush
     and resets to zero — so a browser that is killed loses at most the last unflushed
     slice instead of the whole visit, and the server never has to update a row.

     Three deliberate details:
       · dt is measured from the CLOCK, not counted in ticks, so a background tab that the
         browser throttles to one wake a minute still books its minute;
       · dt is capped at 60s, so a laptop shut for three hours books a minute, not three
         hours — the cap is the reason "total" stays a usable number at all;
       · every send is keepalive, which is what survives the unload that a plain fetch
         does not, and unlike sendBeacon it can still carry the Authorization header. */
  const activity = (function () {
    const TICK_MS = 5000;          // resolution; also the normal dt
    const DT_CAP_MS = 60000;       // a sleeping machine must not bill three hours
    const IDLE_MS = 60000;         // engaged = an interaction inside the last minute
    const FLUSH_MS = 300000;       // insurance flush, so a crash loses five minutes at most
    let cur = null;                // { page, title, total, active }
    let lastTick = 0, lastAct = 0, timer = null, flushAt = 0, on = false;

    const device = () => {
      try {
        if (window.matchMedia("(max-width: 700px)").matches) return "phone";
        if (window.matchMedia("(max-width: 1024px)").matches) return "tablet";
      } catch (e) {}
      return "desktop";
    };

    function post(events) {
      const tok = getToken();
      if (!tok || !events.length) return;
      try {
        fetch(API + "/api/_activity", {
          method: "POST",
          headers: { Authorization: "Bearer " + tok, "Content-Type": "application/json" },
          body: JSON.stringify({ events: events, device: device() }),
          keepalive: true,
        }).catch(function () {});
      } catch (e) { /* the odometer never breaks the car */ }
    }

    function tick() {
      if (!cur) return;
      const now = Date.now();
      const dt = Math.min(now - lastTick, DT_CAP_MS);
      lastTick = now;
      if (dt <= 0) return;
      cur.total += dt;
      let visible = true;
      try { visible = document.visibilityState !== "hidden"; } catch (e) {}
      if (visible && (now - lastAct) < IDLE_MS) cur.active += dt;
      if (now >= flushAt) flush();
    }

    /* Send what has accumulated and reset to zero. Sub-second slices are dropped rather
       than sent as 0 — a page bounced through on the way somewhere else is not a visit. */
    function flush() {
      flushAt = Date.now() + FLUSH_MS;
      if (!cur) return;
      tickless();
      const secs = Math.round(cur.total / 1000);
      if (secs < 1) return;
      post([{ page: cur.page, title: cur.title,
              seconds: secs, active: Math.round(cur.active / 1000) }]);
      cur.total = 0; cur.active = 0;
    }
    /* fold in the time since the last tick without recursing back into flush() */
    function tickless() {
      const now = Date.now();
      const dt = Math.min(now - lastTick, DT_CAP_MS);
      lastTick = now;
      if (dt <= 0) return;
      cur.total += dt;
      let visible = true;
      try { visible = document.visibilityState !== "hidden"; } catch (e) {}
      if (visible && (now - lastAct) < IDLE_MS) cur.active += dt;
    }

    function start() {
      if (on) return;
      on = true;
      lastTick = lastAct = Date.now();
      flushAt = lastTick + FLUSH_MS;
      timer = setInterval(tick, TICK_MS);
      const mark = function () { lastAct = Date.now(); };
      ["mousedown", "keydown", "wheel", "touchstart", "pointerdown", "scroll"]
        .forEach(function (ev) {
          try { window.addEventListener(ev, mark, { passive: true, capture: true }); }
          catch (e) { window.addEventListener(ev, mark, true); }
        });
      // hidden fires where unload does not (phones, tab switches); pagehide covers the rest.
      // Coming BACK deliberately resets nothing: a backgrounded tab is still open, so the
      // gap is credited to `total` like any other -- capped at 60s by dt, which is what
      // stops a laptop shut overnight from booking eight hours against a report.
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") flush();
      });
      window.addEventListener("pagehide", flush);
    }

    return {
      /* Called from navigate() on every page change, including the first render. */
      page(id, title) {
        if (!getToken() || !id) return;
        start();
        if (cur && cur.page === id) return;   // a re-render of the same report is not a visit
        flush();
        cur = { page: String(id), title: String(title || id), total: 0, active: 0 };
        lastTick = Date.now();
      },
      /* Sign-out and anything else that ends the visit deliberately. */
      flush,
    };
  })();

  /* ---------- misc ---------- */
  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t); }
    t.innerHTML = "✓ " + msg; t.classList.add("show");
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
  }
  const num = v => { const n = parseFloat(String(v == null ? "" : v).replace(/[,$\s]/g, "")); return isNaN(n) ? 0 : n; };
  const fmtN = n => Math.round(n).toLocaleString();
  // sign-aware: avoids "$-0" (Math.round(-0.4) === -0) and renders "-$1,234" not "$-1,234"
  const money = n => { const r = Math.round(n) || 0; return (r < 0 ? "-$" : "$") + Math.abs(r).toLocaleString(); };

  return { API, CLIENT_ID, decodeJwt, tokenValid, getToken, setToken, clearToken, email,
           getViewAs, setViewAs,
           api, mountSignin, header, toast, num, fmtN, money, activity };
})();
