/* Zip to Zip portal — shared runtime: auth (Google Identity), bridge API, header nav, helpers.
   Used by the landing page, the Reporting System hub, and every dashboard page.
   (data.html keeps its own inline runtime for now — same token, same localStorage key.) */
window.ZTZ = (function () {
  const API = "https://ztz-bridge-32168089642.us-east4.run.app";
  const CLIENT_ID = "32168089642-fkk3rglncf6hl5ikq7pi6jbornug1kbb.apps.googleusercontent.com";
  const TOKEN_KEY = "ztz_tok";
  const VIEW_AS_KEY = "ztz_view_as";

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
  (function patchFetchForViewAs() {
    if (typeof window.fetch !== "function" || window.__ztzViewAsPatched) return;
    window.__ztzViewAsPatched = true;
    const orig = window.fetch;
    window.fetch = function (input, init) {
      try {
        const as = getViewAs();
        const url = typeof input === "string" ? input : (input && input.url) || "";
        if (as && url.indexOf(API) === 0) {
          init = Object.assign({}, init || {});
          const h = new Headers((init.headers) ||
            (typeof input !== "string" && input && input.headers) || {});
          h.set("X-View-As", as);
          init.headers = h;
        }
      } catch (e) { /* never let the preview break a real request */ }
      return orig.call(this, input, init);
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
  function setToken(t) { try { localStorage.setItem(TOKEN_KEY, t); } catch (e) {} }
  function clearToken() { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} }
  function email() { const t = getToken(); return t ? (decodeJwt(t).email || "") : ""; }
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
      m.querySelector("#ztzSignOut").onclick = () => { clearToken(); location.reload(); };
      const close = () => { m.remove(); document.removeEventListener("click", close); };
      setTimeout(() => document.addEventListener("click", close), 0);
    };
  }

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
           api, mountSignin, header, toast, num, fmtN, money };
})();
