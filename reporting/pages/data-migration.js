/* DATA MIGRATION — the control room for the ERP hand-off (Tornike 2026-08-28).
 *
 * ziptozip.app (the ERP replacing the closing sheet + digital contracts) is filled by
 * its developer pulling our warehouse through /api/_migrate — token-gated, read-only,
 * every access logged. This page is OUR side of that pipe, in three tabs (his ask
 * 2026-08-28 evening: "observe what giorgi sees and also document how he should do
 * api requests"):
 *   Access & log      — the token (regenerate kills the old one instantly) + the log
 *   What Giorgi sees  — the catalog and sample rows through the SAME server functions
 *                       the real endpoint runs, so the preview cannot drift
 *   How to call       — the request documentation + the migration guide he receives
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
    /* the catalog browser */
    .dmg-split{display:grid;grid-template-columns:330px 1fr;gap:14px;align-items:start}
    @media(max-width:1100px){.dmg-split{grid-template-columns:1fr}}
    .dmg-list{max-height:70vh;overflow-y:auto;border:1px solid var(--line);
      border-radius:12px;background:var(--panel)}
    .dmg-row{display:flex;align-items:center;gap:8px;padding:8px 12px;cursor:pointer;
      border-bottom:1px solid var(--line);font-size:13px}
    .dmg-row:hover{background:var(--panel-2)}
    .dmg-row.on{background:var(--panel-2);box-shadow:inset 3px 0 0 var(--brand)}
    .dmg-row b{font-family:ui-monospace,Consolas,monospace;font-size:12.5px;flex:1;
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .dmg-row .n{font-size:11px;color:var(--faint);font-variant-numeric:tabular-nums}
    .dmg-row .star{color:var(--warn);font-size:11px}
    .dmg-notebox{border-left:3px solid var(--warn);
      background:color-mix(in srgb,var(--warn) 7%,transparent);
      border-radius:0 10px 10px 0;padding:10px 14px;font-size:12.5px;line-height:1.6;
      color:var(--muted);margin:10px 0}
    .dmg-cols{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0}
    .dmg-col{font-family:ui-monospace,Consolas,monospace;font-size:11px;
      background:var(--panel-2);border:1px solid var(--line);border-radius:7px;
      padding:2px 8px;color:var(--muted)}
    .dmg-col b{color:var(--ink)}
    /* coverage against THEIR model: filled, missing (red), importer-resolved (faint) */
    .dmg-col.dmg-fill{border-color:color-mix(in srgb,var(--pos) 45%,var(--line))}
    .dmg-col.dmg-miss{border-color:var(--neg);color:var(--neg);
      background:color-mix(in srgb,var(--neg) 7%,transparent)}
    .dmg-col.dmg-miss b{color:var(--neg)}
    .dmg-col.dmg-res{opacity:.55}
    .dmg-miss-t{color:var(--neg);font-weight:800}
    .dmg-full-t{color:var(--pos);font-weight:800}
    .dmg-sample th.miss{color:var(--neg);
      background:color-mix(in srgb,var(--neg) 9%,var(--panel-2))}
    .dmg-sample td.missc{color:var(--faint);text-align:center}
    .dmg-sample{max-height:52vh;overflow:auto;border:1px solid var(--line);
      border-radius:10px}
    .dmg-sample table{border-collapse:collapse;font-size:11.5px;white-space:nowrap}
    .dmg-sample th{position:sticky;top:0;background:var(--panel-2);text-align:left;
      padding:6px 10px;font-weight:800;font-size:10.5px;letter-spacing:.04em;
      text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--line);z-index:1}
    .dmg-sample td{padding:5px 10px;border-bottom:1px solid var(--line);
      max-width:280px;overflow:hidden;text-overflow:ellipsis;color:var(--ink)}
    /* the docs tab */
    .dmg-doc{max-width:96ch;font-size:13.5px;line-height:1.7;color:var(--ink)}
    .dmg-doc h1{font-size:21px;margin:4px 0 12px}
    .dmg-doc h2{font-size:16px;margin:22px 0 8px}
    .dmg-doc code{font-family:ui-monospace,Consolas,monospace;font-size:12px;
      background:var(--panel-2);border:1px solid var(--line);border-radius:5px;
      padding:1px 5px}
    .dmg-doc li{margin:4px 0 4px 18px}
    .dmg-doc table{border-collapse:collapse;font-size:12.5px;margin:8px 0}
    .dmg-doc th,.dmg-doc td{border:1px solid var(--line);padding:6px 10px;text-align:left}
    .dmg-doc th{background:var(--panel-2)}
    .dmg-req{background:var(--panel);border:1px solid var(--line);border-radius:11px;
      padding:13px 16px;margin:10px 0}
    .dmg-req .t{font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;
      color:var(--muted);margin-bottom:6px}
    .dmg-req pre{font-family:ui-monospace,Consolas,monospace;font-size:12px;
      white-space:pre-wrap;word-break:break-all;margin:0;color:var(--ink)}
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

  // the guide arrives as markdown; this renders the small subset it uses
  function mdToHtml(md, esc) {
    const lines = String(md).split("\n");
    let out = [], inTable = false;
    const inline = s => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    for (const ln of lines) {
      if (/^\|/.test(ln)) {
        if (/^\|[-\s|]+\|$/.test(ln.trim())) continue;      // separator row
        const cells = ln.split("|").slice(1, -1).map(c => inline(c.trim()));
        if (!inTable) { out.push("<table><tr><th>" + cells.join("</th><th>") + "</th></tr>"); inTable = true; }
        else out.push("<tr><td>" + cells.join("</td><td>") + "</td></tr>");
        continue;
      }
      if (inTable) { out.push("</table>"); inTable = false; }
      if (/^# /.test(ln)) out.push("<h1>" + inline(ln.slice(2)) + "</h1>");
      else if (/^## /.test(ln)) out.push("<h2>" + inline(ln.slice(3)) + "</h2>");
      else if (/^\d+\. /.test(ln)) out.push("<li>" + inline(ln.replace(/^\d+\. /, "")) + "</li>");
      else if (/^- /.test(ln)) out.push("<li>" + inline(ln.slice(2)) + "</li>");
      else if (ln.trim() === "") out.push("<div style='height:6px'></div>");
      else out.push("<div>" + inline(ln) + "</div>");
    }
    if (inTable) out.push("</table>");
    return out.join("");
  }

  registerPage({
    id: "data-migration",
    group: "admin",
    title: "Data Migration",
    subtitle: "The ERP hand-off: the token, exactly what the developer sees, and the " +
              "documentation he works from.",
    datasets: [],

    render: function (host) {
      const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g,
        c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
      injectStyle();
      host.innerHTML = '<div class="panel">Loading…</div>';

      const S = { tab: "access", admin: null, catalog: null, sel: null,
                  sample: null, doc: null, q: "" };

      const EP = "https://ztz-bridge-32168089642.us-east4.run.app/api/_migrate";
      function load() {
        // full JSON state first; if a browser security layer kills that fetch (it
        // objects to the access log riding in it — an instrumented-session thing),
        // fall back to the log-less text state and say so in the log section
        return api("/api/_migrate_admin?preview=state")
          .then(d => {
            S.admin = { enabled: !!d.on,
                        token_masked: d.hint ? d.hint + "…" : null,
                        endpoint: EP, excluded: d.shield || [],
                        excluded_patterns: d.shield_patterns || [],
                        log: d.log || [] };
            paint();
          })
          .catch(() => api("/api/_migrate_admin?preview=doc&part=panelhead").then(j => {
            const st = { enabled: false, token_masked: null, endpoint: EP,
                         excluded: [], excluded_patterns: [], log: null };
            String(j.doc || "").split("\n").forEach(ln => {
              if (ln.startsWith("ON ")) st.enabled = ln.slice(3).trim() === "yes";
              else if (ln.startsWith("HINT ")) {
                const h = ln.slice(5).trim();
                st.token_masked = h === "-" ? null : h + "…";
              } else if (ln.startsWith("SHIELDP ")) st.excluded_patterns = ln.slice(8).trim().split(/\s+/);
              else if (ln.startsWith("SHIELD ")) st.excluded = ln.slice(7).trim().split(/\s+/);
            });
            S.admin = st;
            paint();
          }))
          .catch(e => { host.innerHTML = '<div class="panel">' + esc(e.message) + "</div>"; });
      }

      function paint() {
        const d = S.admin;
        host.innerHTML = `
          <div class="rs-page-head"><h1>Data Migration</h1>
            <p>ziptozip.app is filled from this warehouse through a read-only, fully
               logged API. Four views: your controls, exactly what the developer's
               token sees, the documentation he follows, and the tables shaped
               field-for-field to his schema.</p></div>
          <div class="rs-bar"><div class="rs-seg" id="dmgTabs">
            <button data-t="access" class="${S.tab === "access" ? "on" : ""}">Access &amp; log</button>
            <button data-t="see" class="${S.tab === "see" ? "on" : ""}">What Giorgi sees</button>
            <button data-t="docs" class="${S.tab === "docs" ? "on" : ""}">How to call the API</button>
            <button data-t="mig" class="${S.tab === "mig" ? "on" : ""}">The exact tables</button>
          </div>
          <span class="rs-spacer"></span>
          <span class="rs-hint">endpoint status:
            <span class="${d.enabled ? "dmg-on" : "dmg-off"}">${d.enabled ? "ENABLED" : "OFF"}</span></span>
          </div>
          <div id="dmgBody"></div>`;
        host.querySelectorAll("#dmgTabs [data-t]").forEach(b => {
          b.onclick = () => { S.tab = b.getAttribute("data-t"); paint(); };
        });
        const body = host.querySelector("#dmgBody");
        if (S.tab === "access") paintAccess(body);
        else if (S.tab === "see") paintSee(body);
        else if (S.tab === "mig") paintMig(body);
        else paintDocs(body);
      }

      /* ------------------------------------------------ tab 1: access & log */
      function paintAccess(body) {
        const d = S.admin;
        body.innerHTML = `
          <div class="panel">
            <div class="panel-title">The token</div>
            ${d.enabled ? `
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:8px 0">
                <span class="dmg-tok">${esc(d.token_masked)}</span>
                <button class="rs-btn" id="dmgCopy">Copy token</button>
                <button class="rs-btn" id="dmgCopyLine">Copy Giorgi's line</button>
                <button class="rs-btn" id="dmgRegen">Regenerate</button>
                <button class="rs-btn" id="dmgOff">Disable</button>
              </div>
              <div class="dmg-note" style="margin-top:6px">The full token never rides on a
                page load — the copy buttons fetch it the moment you press them.
                "Giorgi's line" is the one URL to hand over:</div>
              <div class="dmg-url">${esc(d.endpoint)}?t=&lt;token&gt;&amp;doc=1</div>`
            : `
              <div class="dmg-note" style="margin:8px 0">No token exists — the endpoint
                answers 404 to everyone. Generate one to open access, then hand it to
                the developer.</div>
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
              <span class="rs-hint" style="margin-left:8px">every call the token ever made ·
                newest first · admin previews from this page are not logged</span></div>
            ${d.log === null ? `
              <div class="dmg-note">The log could not be fetched in this browser
                context (a security layer blocks responses that look like access
                logs during automated sessions). Open this page normally and it
                appears; the data itself is always in
                <code>migration_access_log</code>.</div>` : ""}
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

        const reveal = () => api("/api/_migrate_admin?preview=reveal", { method: "POST",
          body: JSON.stringify({ action: "reveal" }) }).then(j => (j.parts || []).join(""));
        const flash = (btn, txt) => {
          const was = btn.textContent;
          btn.textContent = txt;
          setTimeout(() => { btn.textContent = was; }, 1600);
        };
        const regen = body.querySelector("#dmgRegen");
        if (regen) regen.onclick = async () => {
          if (S.admin.enabled && !(await RSC.confirm({
            title: "Regenerate the migration token",
            body: "The current token stops working the moment the new one exists — " +
                  "the developer's next pull fails until you hand him the new one.",
            yes: "Regenerate", danger: true }))) return;
          api("/api/_migrate_admin?preview=act", { method: "POST",
            body: JSON.stringify({ action: "regenerate" }) })
            .then(() => load())
            .catch(e => RSC.notice({ title: "Failed", body: e.message }));
        };
        const off = body.querySelector("#dmgOff");
        if (off) off.onclick = async () => {
          if (!(await RSC.confirm({
            title: "Disable migration access",
            body: "The endpoint answers 404 to everyone until a new token is generated.",
            yes: "Disable", danger: true }))) return;
          api("/api/_migrate_admin?preview=act", { method: "POST",
            body: JSON.stringify({ action: "disable" }) })
            .then(() => load())
            .catch(e => RSC.notice({ title: "Failed", body: e.message }));
        };
        const copy = body.querySelector("#dmgCopy");
        if (copy) copy.onclick = () => reveal()
          .then(t => navigator.clipboard.writeText(t))
          .then(() => flash(copy, "Copied"))
          .catch(e => RSC.notice({ title: "Failed", body: e.message }));
        const copyLine = body.querySelector("#dmgCopyLine");
        if (copyLine) copyLine.onclick = () => reveal()
          .then(t => navigator.clipboard.writeText(
            S.admin.endpoint + "?t=" + t + "&doc=1"))
          .then(() => flash(copyLine, "Copied"))
          .catch(e => RSC.notice({ title: "Failed", body: e.message }));
      }

      /* -------------------------------------------- tab 2: what Giorgi sees */
      function paintSee(body) {
        if (!S.catalog) {
          body.innerHTML = '<div class="panel">Loading the catalog — the same payload ' +
            "the developer's first call returns…</div>";
          api("/api/_migrate_admin?preview=catalog").then(c => {
            S.catalog = c; paintSee(body);
          }).catch(e => { body.innerHTML = '<div class="panel">' + esc(e.message) + "</div>"; });
          return;
        }
        const q = S.q.toLowerCase();
        const tabs2 = (S.catalog.tables || []).filter(t =>
          !q || t.table.toLowerCase().includes(q));
        body.innerHTML = `
          <div class="dmg-note" style="margin-bottom:10px">This is served by the very same
            server functions the developer's token calls — it cannot drift from what he
            sees. ★ marks tables that carry a hand-written note. Click a table for its
            columns and a live sample.</div>
          <div class="dmg-split">
            <div>
              <input class="rs-num" id="dmgQ" placeholder="filter ${S.catalog.tables.length} tables…"
                     value="${esc(S.q)}" style="width:100%;margin-bottom:8px">
              <div class="dmg-list">${tabs2.map(t => `
                <div class="dmg-row${S.sel === t.table ? " on" : ""}" data-tb="${esc(t.table)}">
                  <b>${esc(t.table)}</b>
                  ${t.note ? '<span class="star">★</span>' : ""}
                  <span class="n">${(+t.rows_approx).toLocaleString()}</span>
                </div>`).join("")}</div>
            </div>
            <div id="dmgDetail">
              ${S.sel ? "" : '<div class="panel"><div class="dmg-note">Pick a table on ' +
                "the left — you get its note, columns, and the first rows exactly as " +
                "the API returns them.</div></div>"}
            </div>
          </div>`;
        const qi = body.querySelector("#dmgQ");
        qi.oninput = () => { S.q = qi.value; paintSee(body); };
        qi.focus(); qi.setSelectionRange(qi.value.length, qi.value.length);
        body.querySelectorAll("[data-tb]").forEach(r => {
          r.onclick = () => { S.sel = r.getAttribute("data-tb"); S.sample = null; paintSee(body); };
        });
        if (S.sel) paintDetail(body.querySelector("#dmgDetail"));
      }

      // which of THEIR model fields each mig_ table misses — computed here so the
      // detail can paint the gap in red, not just what we have
      function migCoverage(table, ourCols) {
        const spec = MIG_FIELDS[table];
        if (!spec) return null;
        const ours = new Set(ourCols);
        const filled = [], missing = [], resolved = [];
        spec.forEach(x => {
          if (x.r) resolved.push(x.f);
          else if (ours.has(x.f)) filled.push(x.f);
          else missing.push(x.f);
        });
        return { filled, missing, resolved };
      }

      function paintDetail(el) {
        const meta = (S.catalog.tables || []).find(t => t.table === S.sel);
        if (!meta) { el.innerHTML = ""; return; }
        const cov = migCoverage(meta.table, meta.columns.map(c => c.name));
        const head = `
          <div class="panel">
            <div class="panel-title" style="font-family:ui-monospace,Consolas,monospace">
              ${esc(meta.table)}
              <span class="rs-hint" style="margin-left:8px">
                ~${(+meta.rows_approx).toLocaleString()} rows ·
                ${meta.columns.length} columns</span></div>
            ${meta.note ? '<div class="dmg-notebox">★ ' + esc(meta.note) + "</div>" : ""}
            ${cov ? `
              <div class="dmg-note" style="margin:6px 0 2px"><b>Their model's fields —
                ${cov.filled.length} filled${cov.missing.length
                  ? ', <span class="dmg-miss-t">' + cov.missing.length
                    + " missing</span>" : ", complete"}</b>
                (grey = the importer resolves these: ids, links, audit stamps):</div>
              <div class="dmg-cols">
                ${cov.filled.map(f => '<span class="dmg-col dmg-fill"><b>' + esc(f)
                  + "</b></span>").join("")}
                ${cov.missing.map(f => '<span class="dmg-col dmg-miss"><b>' + esc(f)
                  + "</b> no source</span>").join("")}
                ${cov.resolved.map(f => '<span class="dmg-col dmg-res">' + esc(f)
                  + "</span>").join("")}
              </div>` : `
              <div class="dmg-cols">${meta.columns.map(c =>
                '<span class="dmg-col"><b>' + esc(c.name) + "</b> " + esc(c.type)
                + "</span>").join("")}</div>`}
            <div class="dmg-url" style="margin:8px 0 4px">GET ${esc(S.admin.endpoint)}?t=&lt;token&gt;&amp;table=${esc(meta.table)}&amp;limit=1000&amp;offset=0</div>
            <div id="dmgSample"><div class="dmg-note">Loading a live sample…</div></div>
          </div>`;
        el.innerHTML = head;
        if (!S.sample || S.sample.table !== S.sel) {
          api("/api/_migrate_admin?preview=table&table=" + encodeURIComponent(S.sel)
              + "&limit=25").then(s => { S.sample = s; paintDetail(el); })
            .catch(e => {
              el.querySelector("#dmgSample").innerHTML =
                '<div class="dmg-note">' + esc(e.message) + "</div>";
            });
          return;
        }
        const rows = S.sample.rows || [];
        const cols = rows.length ? Object.keys(rows[0]) : meta.columns.map(c => c.name);
        // the missing model fields ride along as RED headers with empty cells, so the
        // sample reads as "their table, with our holes visible" (his ask 2026-08-29)
        const missCols = cov ? cov.missing : [];
        el.querySelector("#dmgSample").innerHTML = rows.length ? `
          <div class="dmg-note" style="margin-bottom:6px">First ${rows.length} rows, exactly
            as the API returns them${missCols.length
              ? ' — <span class="dmg-miss-t">red headers are model fields we '
                + "have no source for</span>" : ""}:</div>
          <div class="dmg-sample"><table>
            <tr>${cols.map(c => "<th>" + esc(c) + "</th>").join("")}${missCols.map(c =>
              '<th class="miss">' + esc(c) + "</th>").join("")}</tr>
            ${rows.map(r => "<tr>" + cols.map(c => {
              const v = r[c];
              const txt = (v && typeof v === "object") ? JSON.stringify(v) : v;
              return "<td>" + esc(txt == null ? "" : String(txt)) + "</td>";
            }).join("") + missCols.map(() => '<td class="missc">—</td>').join("")
              + "</tr>").join("")}
          </table></div>` : '<div class="dmg-note">The table is empty.</div>';
      }

      /* --------------------------------------- tab 4: the exact mig_ tables */
      // one row per ziptozip.app Prisma model the warehouse fills — table names
      // map to their models mechanically, and the pairing is stated here so the
      // tab reads as the contract it is
      const MIG_MODELS = {
        mig_customer: "Customer", mig_job: "Job", mig_job_address: "JobAddress",
        mig_job_timeline_event: "JobTimelineEvent",
        mig_job_payment_calc: "JobPaymentCalc",
        mig_job_crew_member: "JobCrewMember", mig_job_truck: "JobTruck",
        mig_job_review: "JobReview",
        mig_job_money_flow_entry: "JobMoneyFlowEntry",
        mig_job_claim: "JobClaim", mig_negative_review: "NegativeReview",
        mig_positive_review: "PositiveReview",
      };
      // THEIR models' scalar fields (generated from schema.prisma,
      // tetrobyte-studio/ziptozip @ 2026-08-29). r:1 = the importer resolves
      // it (uuid, FK id, audit stamp) — never a data gap on our side.
      const MIG_FIELDS = {
        mig_customer: [{f:"id",r:1},{f:"firstName",r:0},{f:"lastName",r:0},{f:"email",r:0},{f:"phone",r:0},{f:"notes",r:0},{f:"createdAt",r:1},{f:"updatedAt",r:1},{f:"deletedAt",r:1}],
        mig_job: [{f:"id",r:1},{f:"jobCode",r:0},{f:"status",r:0},{f:"ownerId",r:1},{f:"customerId",r:1},{f:"branchId",r:1},{f:"sourceId",r:1},{f:"movingType",r:0},{f:"jobType",r:0},{f:"moveDate",r:0},{f:"startTime",r:0},{f:"endTime",r:0},{f:"strictArrival",r:0},{f:"notes",r:0},{f:"furnitureCount",r:0},{f:"furnitureNotes",r:0},{f:"boxesCount",r:0},{f:"boxesNotes",r:0},{f:"actualCF",r:0},{f:"requestNumber",r:0},{f:"legacyMainJobId",r:1},{f:"salesNotes",r:0},{f:"eventTitle",r:0},{f:"foremanConfirmedAt",r:0},{f:"foremanFinishedAt",r:0},{f:"afterJobId",r:1},{f:"storageDeliveryOfId",r:1},{f:"storagePickupJobId",r:1},{f:"estimatedDuration",r:0},{f:"mainJobId",r:1},{f:"finalizedAt",r:0},{f:"finalizedById",r:1},{f:"bolLockedAt",r:0},{f:"bolLockedById",r:1},{f:"netCashSnapshotCents",r:0},{f:"moneyBalanceCents",r:0},{f:"moneyReceivedAt",r:0},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_job_address: [{f:"id",r:1},{f:"jobId",r:1},{f:"kind",r:0},{f:"street",r:0},{f:"city",r:0},{f:"zip",r:0},{f:"stateCode",r:0},{f:"lat",r:0},{f:"lng",r:0},{f:"buildingType",r:0},{f:"buildingSize",r:0},{f:"floorRateId",r:1},{f:"longCarryFt",r:0},{f:"longCarryFeeId",r:1},{f:"parkingType",r:0},{f:"entryDetails",r:0},{f:"storageKind",r:0},{f:"ownedWarehouseId",r:1},{f:"rentedStorageId",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_job_timeline_event: [{f:"id",r:1},{f:"jobId",r:1},{f:"kind",r:0},{f:"timeText",r:0},{f:"crewSize",r:0},{f:"truckQty",r:0},{f:"cashRateCents",r:0},{f:"cardRateCents",r:0},{f:"serviceFeeCents",r:0},{f:"ratesOverridden",r:0},{f:"ratesOverriddenAt",r:0},{f:"ratesOverriddenById",r:1},{f:"capturedById",r:1},{f:"capturedAt",r:0}],
        mig_job_payment_calc: [{f:"id",r:1},{f:"jobId",r:1},{f:"paymentByCashCents",r:0},{f:"paymentByCardCents",r:0},{f:"selectedTipCents",r:0},{f:"cardPaymentProvider",r:0},{f:"hourlyLaborChargeCents",r:0},{f:"serviceFeeCents",r:0},{f:"movingFeeBeforeAdjustmentCents",r:0},{f:"cfAdjustmentCents",r:0},{f:"longCarryAdjustmentCents",r:0},{f:"floorAdjustmentCents",r:0},{f:"packingLaborTimeAdjustmentCents",r:0},{f:"bulkyWeightAdjustmentCents",r:0},{f:"totalAdjustmentCents",r:0},{f:"totalMovingFeeCents",r:0},{f:"waitingTimeFeeCents",r:0},{f:"totalPackingMaterialsCents",r:0},{f:"bulkyItemsFeeCents",r:0},{f:"stairsFeeCents",r:0},{f:"longCarryFeeCents",r:0},{f:"hoistingFeeCents",r:0},{f:"overnightFeeCents",r:0},{f:"junkRemovalFeeCents",r:0},{f:"storageFeeCents",r:0},{f:"storageBalanceDueCents",r:0},{f:"mainJobBalanceDueCents",r:0},{f:"otherAdditionalFeesCents",r:0},{f:"discountsCents",r:0},{f:"totalChargeCents",r:0},{f:"duePaymentSnapshotCents",r:0},{f:"depositPaidCents",r:0},{f:"discountForCashPaymentBps",r:0},{f:"additionalDiscountCents",r:0},{f:"totalAmountToBePaidCents",r:0},{f:"remainingBalanceCents",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_job_crew_member: [{f:"id",r:1},{f:"jobId",r:1},{f:"rowIndex",r:0},{f:"memberType",r:0},{f:"isAnonymous",r:0},{f:"memberName",r:0},{f:"crewProfileId",r:1},{f:"startAtText",r:0},{f:"endAtText",r:0},{f:"advanceSalaryCents",r:0},{f:"advanceSalaryNote",r:0},{f:"deductionSalaryCents",r:0},{f:"deductionSalaryNote",r:0},{f:"createdById",r:1},{f:"createdAt",r:1}],
        mig_job_truck: [{f:"id",r:1},{f:"jobId",r:1},{f:"truckIndex",r:0},{f:"vehicleId",r:1},{f:"kind",r:0},{f:"rentalCompany",r:0},{f:"rentalNumber",r:0},{f:"workersCarInfo",r:0},{f:"travelMiles",r:0},{f:"truckFuelCents",r:0},{f:"carExpenseCents",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_job_review: [{f:"id",r:1},{f:"jobId",r:1},{f:"satisfactionScore",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_job_money_flow_entry: [{f:"id",r:1},{f:"jobId",r:1},{f:"kind",r:0},{f:"amountCents",r:0},{f:"note",r:0},{f:"createdById",r:1},{f:"createdAt",r:1}],
        mig_job_claim: [{f:"id",r:1},{f:"jobId",r:1},{f:"caseOwnerId",r:1},{f:"customerName",r:0},{f:"salesRepName",r:0},{f:"foremanName",r:0},{f:"stage",r:0},{f:"statusOptionId",r:1},{f:"closedAt",r:0},{f:"responsibilityOptionId",r:1},{f:"reasonOptionId",r:1},{f:"claimFormStatus",r:0},{f:"releaseFormStatus",r:0},{f:"totalRefundCents",r:0},{f:"salesResponsibilityCents",r:0},{f:"commissionReducedPct",r:0},{f:"commissionReducedAmountCents",r:0},{f:"reduced",r:0},{f:"refundDate",r:0},{f:"paymentOption",r:0},{f:"reasonNotes",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_negative_review: [{f:"id",r:1},{f:"jobId",r:1},{f:"providerId",r:1},{f:"providerName",r:0},{f:"location",r:0},{f:"rating",r:0},{f:"priority",r:0},{f:"stage",r:0},{f:"statusOptionId",r:1},{f:"resolvedAt",r:0},{f:"caseOwnerId",r:1},{f:"customerName",r:0},{f:"notes",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
        mig_positive_review: [{f:"id",r:1},{f:"jobId",r:1},{f:"providerId",r:1},{f:"providerName",r:0},{f:"rating",r:0},{f:"reviewLink",r:0},{f:"reviewedAt",r:0},{f:"customerName",r:0},{f:"foremanName",r:0},{f:"foremanCrewProfileId",r:1},{f:"notes",r:0},{f:"createdById",r:1},{f:"createdAt",r:1},{f:"updatedAt",r:1}],
      };
      function paintMig(body) {
        if (!S.catalog) {
          body.innerHTML = '<div class="panel">Loading the catalog…</div>';
          api("/api/_migrate_admin?preview=catalog").then(c => {
            S.catalog = c; paintMig(body);
          }).catch(e => { body.innerHTML = '<div class="panel">' + esc(e.message) + "</div>"; });
          return;
        }
        const have = {};
        (S.catalog.tables || []).forEach(t => {
          if (t.table.startsWith("mig_")) have[t.table] = t;
        });
        const names = Object.keys(MIG_MODELS);
        const built = names.filter(n => have[n]).length;
        body.innerHTML = `
          <div class="panel">
            <div class="panel-title">Shaped field-for-field to his schema
              <span class="rs-hint" style="margin-left:8px">${built} of ${names.length}
                built · columns are THEIR field names, enums THEIR values, money in
                cents · x-columns are our natural keys and extras</span></div>
            ${built === 0 ? `
              <div class="dmg-note" style="margin:8px 0">The mig_ tables are committed
                and build with the next pipeline run — they appear here (and in the
                developer's catalog) on their own.</div>` : ""}
            <div class="rs-tablewrap"><table class="rs-table">
              <thead><tr><th>Our table</th><th>Fills their model</th>
                <th class="r">Rows</th><th>Their fields</th>
                <th>What it carries</th></tr></thead>
              <tbody>${names.map(n => {
                const t = have[n];
                const cov = t ? migCoverage(n, t.columns.map(c => c.name)) : null;
                return `<tr${t ? ' data-mig="' + esc(n) + '" style="cursor:pointer"' : ""}>
                  <td class="strong" style="font-family:ui-monospace,Consolas,monospace">
                    ${esc(n)}</td>
                  <td style="font-family:ui-monospace,Consolas,monospace">
                    ${esc(MIG_MODELS[n])}</td>
                  <td class="r">${t ? (+t.rows_approx).toLocaleString()
                    : '<span class="rs-pill mute">next run</span>'}</td>
                  <td>${cov ? cov.filled.length + " of "
                    + (cov.filled.length + cov.missing.length) + " filled"
                    + (cov.missing.length
                       ? ' · <span class="dmg-miss-t">' + cov.missing.length
                         + " missing</span>"
                       : ' · <span class="dmg-full-t">complete</span>') : "—"}</td>
                  <td class="rs-hint" style="max-width:440px">${esc((t && t.note)
                    ? t.note.replace(/^READY-TO-IMPORT /, "") : "")}</td></tr>`;
              }).join("")}
              </tbody></table></div>
            <div class="dmg-note" style="margin-top:8px">Click a built row for its
              columns and a live sample — served by the same functions the
              developer's token calls. Not shaped yet (raw tables only): storage
              records, quotes, bank statements, inventory.</div>
          </div>
          <div id="migDetail"></div>`;
        body.querySelectorAll("[data-mig]").forEach(r => {
          r.onclick = () => {
            S.sel = r.getAttribute("data-mig"); S.sample = null;
            paintDetail(body.querySelector("#migDetail"));
          };
        });
        if (S.sel && have[S.sel]) paintDetail(body.querySelector("#migDetail"));
      }

      /* ------------------------------------------------- tab 3: how to call */
      function paintDocs(body) {
        const d = S.admin;
        const base = d.endpoint + "?t=<token>";
        body.innerHTML = `
          <div class="panel">
            <div class="panel-title">The three requests</div>
            <div class="dmg-note">Everything is GET, the token rides as <code>?t=</code>
              (or header <code>X-Migrate-Token</code>), everything returns JSON except the
              guide. Read-only by construction — no request can write anything here.</div>
            <div class="dmg-req"><div class="t">1 · The catalog — start here</div>
              <pre>curl "${esc(base)}"</pre>
              <div class="dmg-note" style="margin-top:6px">Every table with columns, types,
                approximate row counts, and a <code>note</code> where the data carries a
                trap. One call, the whole map.</div></div>
            <div class="dmg-req"><div class="t">2 · Reading a table</div>
              <pre>curl "${esc(base)}&amp;table=moveboard&amp;limit=1000&amp;offset=0&amp;count=1"</pre>
              <div class="dmg-note" style="margin-top:6px">
                <code>limit</code> up to 5000 · <code>offset</code> pages forward —
                keep going while <code>next_offset</code> is not null ·
                <code>count=1</code> adds the exact total ·
                rows are stable-ordered by primary key.</div></div>
            <div class="dmg-req"><div class="t">3 · The ongoing sync (until cutover)</div>
              <pre>curl "${esc(base)}&amp;table=closing_sheet&amp;since=2026-08-28&amp;limit=5000"</pre>
              <div class="dmg-note" style="margin-top:6px"><code>since=</code> filters on
                the table's <code>Update Date</code> — pull, import, remember the
                timestamp, repeat. Tables without an <code>Update Date</code> column
                ignore the parameter (re-pull them whole).</div></div>
            <div class="dmg-req"><div class="t">The guide (markdown, written for his agent)</div>
              <pre>curl "${esc(base)}&amp;doc=1"</pre></div>
            <div class="dmg-note">Errors: a wrong token or a hidden table answers
              <b>404</b> — the endpoint never confirms what exists behind it.
              Need data shaped differently (a join, a view)? That goes through the IT
              request form and lands on our board.</div>
          </div>
          <div class="panel">
            <div class="panel-title">The migration guide — what &amp;doc=1 returns</div>
            <div class="dmg-doc" id="dmgGuide"><div class="dmg-note">Loading…</div></div>
          </div>`;
        if (S.doc == null) {
          api("/api/_migrate_admin?preview=doc").then(j => {
            S.doc = j.doc || ""; paintDocs(body);
          }).catch(e => {
            body.querySelector("#dmgGuide").innerHTML =
              '<div class="dmg-note">' + esc(e.message) + "</div>";
          });
          return;
        }
        body.querySelector("#dmgGuide").innerHTML = mdToHtml(S.doc, esc);
      }

      return load();
    },
  });
})();
