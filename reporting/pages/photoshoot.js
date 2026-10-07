/* MARKETING AUTOMATIONS ▸ Photoshoot Confirmation (his ask 2026-10-07: "add the photoshoot page to
   the sidebar").

   The page itself is analytics/photoshoot.html -- PUBLIC on purpose (his call 2026-10-06, "Portal,
   no login"): photographers confirm from a bookmark without a portal account, and the bridge's
   /api/_photo owns the jobs list and the one-shoot-per-day rule (bridge/photoshoot.py). This entry
   puts the same page in front of the office inside the portal -- embedded, same origin, nothing
   copied -- with the link to hand a photographer. */
registerPage({
  id: "photoshoot",
  group: "marketing-automations",
  title: "Photoshoot Confirmation",
  render(host) {
    const url = new URL("photoshoot.html", location.href.split("#")[0].split("?")[0]).href;
    if (!document.getElementById("psc-style")) {
      const st = document.createElement("style");
      st.id = "psc-style";
      st.textContent = [
        ".psc-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0 0 12px;font-size:13px;color:var(--muted)}",
        ".psc-bar code{background:var(--panel-2);border:1px solid var(--line-2);border-radius:7px;padding:4px 9px;color:var(--ink);font-size:12.5px}",
        ".psc-frame{width:100%;border:0;background:transparent;display:block;}",
      ].join("");
      document.head.appendChild(st);
    }
    host.innerHTML = `<div class="rs-page-head"><h1>Photoshoot Confirmation</h1></div>
      <div class="psc-bar">Photographers use this page without signing in — send them this link:
        <code>${RSC.esc(url)}</code>
        <button class="rs-btn" id="pscCopy" type="button">Copy link</button>
        <a class="rs-btn" href="${RSC.esc(url)}" target="_blank" rel="noopener">Open in a new tab</a></div>
      <iframe class="psc-frame" id="pscFrame" title="Photoshoot Confirmation" src="${RSC.esc(url)}?embed=1"></iframe>`;
    const fr = host.querySelector("#pscFrame");
    // ?embed=1 drops the page's own header. The frame fills the window below the link bar and the
    // page scrolls inside it -- a frame grown to full height would put the confirm dialog (fixed
    // to the frame's viewport) in the middle of a very tall frame, off screen.
    const fit = () => { const top = fr.getBoundingClientRect().top; fr.style.height = Math.max(520, innerHeight - top - 12) + "px"; };
    fit();
    // one listener, replaced on every visit -- not one more per render
    if (window.__pscFit) removeEventListener("resize", window.__pscFit);
    window.__pscFit = fit;
    addEventListener("resize", fit);
    host.querySelector("#pscCopy").onclick = async e => {
      try { await navigator.clipboard.writeText(url); e.target.textContent = "Copied"; }
      catch (err) { e.target.textContent = "Copy failed"; }
      setTimeout(() => { e.target.textContent = "Copy link"; }, 1600);
    };
  },
});
