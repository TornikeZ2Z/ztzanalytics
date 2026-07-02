/* Zip to Zip portal — shared runtime: auth (Google Identity), bridge API, header nav, helpers.
   Used by the landing page, the Reporting System hub, and every dashboard page.
   (data.html keeps its own inline runtime for now — same token, same localStorage key.) */
window.ZTZ = (function () {
  const API = "https://ztz-bridge-32168089642.us-east4.run.app";
  const CLIENT_ID = "32168089642-fkk3rglncf6hl5ikq7pi6jbornug1kbb.apps.googleusercontent.com";
  const TOKEN_KEY = "ztz_tok";

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
     No nav links — just the brand, one subtitle, the user, and the theme toggle. */
  function header(active, subtitle) {
    const host = document.getElementById("ztzHeader");
    if (!host) return;
    const base = (location.pathname.match(/^.*\//) || ["/"])[0];
    const em = email();
    const who = em ? `<span class="av">${em[0].toUpperCase()}</span>${em}` : "";
    host.innerHTML =
      `<div class="brand"><a href="${base}index.html" title="Home"><img class="brandlogo" src="${base}logo-wide.png" alt="Zip to Zip Moving"></a>` +
      (subtitle ? `<span class="brandsub">${subtitle}</span>` : "") + `</div>` +
      `<div class="spacer"></div><div class="who">${who}</div>` +
      `<span id="ztzHeadSign"></span>`;
    if (!em) mountSignin(document.getElementById("ztzHeadSign"), { button: { size: "medium" } });
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
  const money = n => "$" + Math.round(n).toLocaleString();

  return { API, CLIENT_ID, decodeJwt, tokenValid, getToken, setToken, clearToken, email,
           api, mountSignin, header, toast, num, fmtN, money };
})();
