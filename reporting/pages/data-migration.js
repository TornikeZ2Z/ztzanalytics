/* DATA MIGRATION — the control room for the ERP hand-off (Tornike 2026-08-28).
 *
 * ziptozip.app (the ERP replacing the closing sheet + digital contracts) is filled by
 * its developer pulling our warehouse through /api/_migrate — token-gated, read-only,
 * every access logged. This page is OUR side of that pipe: the token (regenerate kills
 * the old one instantly), what is excluded and why, and the live access log.
 * Plan: docs/plans/2026-08-28-erp-migration-tool.md.
 */
(() => {
  function injectStyle() {
    const old = document.getElementById("dmg-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "dmg-style";
    st.textContent = `
    .dmg-tok{font-family:ui-monospace,Consolas,monospace;font-size:14px;font-weight:700;
      letter-spacing:.4px;background:var(--panel-2);border:1px solid var(--line);
      border-radius:9px;padding:9px 13px;user-select:all}
    .dmg-url{font-family:ui-monospace,Consolas,monospace;font-size:12px;color:var(--muted);
      word-break:break-all}
    .dmg-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:92ch}
    .dmg-off{color:var(--neg);font-weight:800}
    .dmg-on{color:var(--pos);font-weight:800}
    .dmg-x{display:inline-block;background:var(--panel-2);border:1px solid var(--line);
      border-radius:999px;font-size:11.5px;font-weight:700;color:var(--muted);
      padding:3px 10px;margin:2px 3px 2px 0}
    `;
    document.head.appendChild(st);
  }

  function api(path, opts) {
    return fetch(ZTZ.API + path, Object.assign({
      headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                             (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
    }, opts || {})).then(r => r.json().then(j => {
      if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
      return j;
    }));
  }

  registerPage({
    id: "data-migration",
    group: "admin",
    title: "Data Migration",
    subtitle: "The ERP hand-off: the token the developer pulls our data with, what is " +
              "excluded, and every access that ever happened.",
    datasets: [],

    render: function (host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      injectStyle();
      host.innerHTML = '<div class="panel">Loading…</div>';

      function load() {
        return api("/api/_migrate_admin").then(paint).catch(e => {
          host.innerHTML = '<div class="panel">' + esc(e.message) + "</div>";
        });
      }

      function paint(d) {
        const curl = d.enabled
          ? d.endpoint + "?t=" + d.token
          : d.endpoint + "?t=<token>";
        host.innerHTML = `
          <div class="rs-page-head"><h1>Data Migration</h1>
            <p>ziptozip.app is filled from this warehouse through a read-only, fully
               logged API. The token below is the whole gate — regenerating it cuts the
               old one off instantly.</p></div>

          <div class="panel">
            <div class="panel-title">Access
              <span class="${d.enabled ? "dmg-on" : "dmg-off"}" style="margin-left:8px">
                ${d.enabled ? "ENABLED" : "OFF"}</span></div>
            ${d.enabled ? `
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0">
                <span class="dmg-tok" id="dmgTok">${esc(d.token)}</span>
                <button class="rs-btn" id="dmgCopy">Copy</button>
                <button class="rs-btn" id="dmgRegen">Regenerate</button>
                <button class="rs-btn" id="dmgOff">Disable</button>
              </div>
              <div class="dmg-note" style="margin-top:6px">What the developer runs:</div>
              <div class="dmg-url">catalog: ${esc(curl)}</div>
              <div class="dmg-url">table: &nbsp;&nbsp;${esc(curl)}&amp;table=moveboard&amp;limit=1000&amp;offset=0</div>
              <div class="dmg-url">guide: &nbsp;&nbsp;${esc(curl)}&amp;doc=1</div>`
            : `
              <div class="dmg-note" style="margin:8px 0">No token exists — the endpoint
                answers 404 to everyone. Generate one to open access.</div>
              <button class="rs-btn pri" id="dmgRegen">Generate token</button>`}
          </div>

          <div class="panel">
            <div class="panel-title">Never exposed, whatever the token says</div>
            <div class="dmg-note" style="margin-bottom:8px">Secrets, the anonymous-survey
              promise, image blobs and pipeline internals are excluded server-side:</div>
            ${(d.excluded || []).map(x => '<span class="dmg-x">' + esc(x) + "</span>").join("")}
            ${(d.excluded_patterns || []).map(x => '<span class="dmg-x">' + esc(x) + "*</span>").join("")}
          </div>

          <div class="panel">
            <div class="panel-title">Access log
              <span class="rs-hint" style="margin-left:8px">last ${(d.log || []).length}
                calls · newest first</span></div>
            ${(d.log || []).length ? `
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>When (UTC)</th><th>What</th><th>Table</th>
                <th>Params</th><th class="r">Rows</th><th>From</th></tr></thead>
              <tbody>${d.log.map(l => `
                <tr><td>${esc(l.at)}</td>
                  <td><span class="rs-pill ${l.endpoint === "read" ? "info" : "mute"}">
                    ${esc(l.endpoint)}</span></td>
                  <td class="strong">${esc(l.table || "—")}</td>
                  <td class="rs-hint">${esc(l.params || "")}</td>
                  <td class="r">${l.rows}</td>
                  <td class="rs-hint">${esc(l.ip || "")}</td></tr>`).join("")}
              </tbody></table></div>`
            : '<div class="dmg-note">No access yet.</div>'}
          </div>`;

        const regen = host.querySelector("#dmgRegen");
        if (regen) regen.onclick = async () => {
          const first = !d.enabled;
          if (!first && !(await RSC.confirm({
            title: "Regenerate the migration token",
            body: "The current token stops working the moment the new one exists — " +
                  "the developer's next pull fails until you hand him the new one.",
            yes: "Regenerate", danger: true }))) return;
          api("/api/_migrate_admin", { method: "POST",
            body: JSON.stringify({ action: "regenerate" }) }).then(paint)
            .catch(e => RSC.notice({ title: "Failed", body: e.message }));
        };
        const off = host.querySelector("#dmgOff");
        if (off) off.onclick = async () => {
          if (!(await RSC.confirm({
            title: "Disable migration access",
            body: "The endpoint answers 404 to everyone until a new token is generated.",
            yes: "Disable", danger: true }))) return;
          api("/api/_migrate_admin", { method: "POST",
            body: JSON.stringify({ action: "disable" }) }).then(paint)
            .catch(e => RSC.notice({ title: "Failed", body: e.message }));
        };
        const copy = host.querySelector("#dmgCopy");
        if (copy) copy.onclick = () => {
          navigator.clipboard.writeText(d.token).then(() => {
            copy.textContent = "Copied";
            setTimeout(() => { copy.textContent = "Copy"; }, 1500);
          });
        };
      }

      return load();
    },
  });
})();
