/* SALES TEAM — who is on the sales team, kept by the sales manager (2026-10-16).
 *
 * Tornike, for Mary Della Russo ("Ruso", head of sales): she "wants to control which sales are
 * active ... even in reports, to turn off someone is something she needs". One row per rep name
 * as Moveboard and the closing sheet spell it (sales_rep_roster, seeded every hour by
 * src/sales_roster.py, which never overwrites a row). Switching a rep OFF:
 *   - stops their own copy of the daily / monthly lead email -- their leads stay in Ruso's
 *     team email, like any rep without an address (src/weekly_sales_send.py _rep_emails);
 *   - groups them under a collapsed "Former reps" line in the report rep tables (the report
 *     side reads RS.salesTeam() in rs-core.js);
 *   - changes nothing about the past: their leads and jobs still count in every total.
 *
 * WHO EDITS. Admins and the named "sales-team-manager" grant (Ruso is an admin); everyone else
 * with Sales sees the same list read-only. Never while previewing as someone else.
 *
 * LIVE, NEVER RS.load. Rows come from GET /api/_salesteam (no-store) and every save goes back
 * through POST, so a switch is visible on the very next load -- an epoch-cached dataset would
 * hide it until the next pipeline run (tests/test_live_tables_not_epoch_cached.py).
 *
 * Page id "sales-roster", not "sales-team": that id is a RETIRED legacy page (it still
 * redirects to the Monthly Report) and pages/sales-team.js is Sales Person Analysis.
 */
(() => {
  const DOMAIN = "@ziptozipmoving.com";
  // the bridge's rule (_SALESTEAM_EMAIL_RE): blank, or a company mailbox
  const EMAIL_RE = /^[a-z0-9][a-z0-9._%+-]{0,63}@ziptozipmoving\.com$/;
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  // which collapsed groups are open, and a typed-but-refused email -- kept across re-renders
  const S = { open: { former: false, test: false }, draft: {}, tok: 0 };

  function injectStyle() {
    const old = document.getElementById("srt-style");
    if (old) old.remove();
    const st = document.createElement("style");
    st.id = "srt-style";
    // Panels, the table, its collapsible group rows, pills, inputs and buttons are THE
    // COMPONENT KIT (rs.css); the on/off switch is the kit's .acl-switch (Users & Access).
    // Only what the kit has no name for lives here.
    st.textContent = ""
      + ".srt{font-variant-numeric:tabular-nums}"
      + ".srt .srt-rep{font-weight:700;color:var(--ink)}"
      + ".srt .srt-sw{display:inline-flex;align-items:center;gap:9px}"
      + ".srt .srt-sw .acl-switch:focus-visible{outline:2px solid var(--brand);outline-offset:2px}"
      + ".srt .srt-onoff{font-size:12.5px;font-weight:650;color:var(--muted)}"
      + ".srt .srt-msg.ok{color:var(--pos)}"
      + ".srt .srt-msg.err{color:var(--neg)}"
      + ".srt .srt-email{min-width:0;width:100%;max-width:290px}"
      + ".srt .srt-email.bad{border-color:var(--neg)}"
      + ".srt .srt-dim{color:var(--faint)}"
      + ".srt .srt-busy{opacity:.45;pointer-events:none}"
      + ".srt .srt-kind{margin-top:7px;padding:4px 10px;font-size:12px}"
      + ".srt .srt-grp-note{font-weight:500;color:var(--muted);margin-left:8px}"
      + ".srt tbody tr.srt-row>td{vertical-align:top}";
    document.head.appendChild(st);
  }

  async function api(method, body) {
    const r = await fetch(ZTZ.API + "/api/_salesteam", {
      method,
      headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(j.error || ("HTTP " + r.status));
      e.code = j.code;
      e.status = r.status;
      throw e;
    }
    return j;
  }

  const groupOf = r => String(r.kind || "rep") !== "rep" ? "test" : (+r.active === 1 ? "active" : "former");

  registerPage({
    id: "sales-roster",
    group: "sales",
    title: "Sales team",
    datasets: [],

    async render(host) {
      const esc = RSC.esc;
      const tok = ++S.tok;
      S.draft = {};              // a refused email does not follow you to the next visit
      // this render still owns the content area: not superseded by a newer render of this page,
      // and not replaced by another page while a request was out
      const alive = () => tok === S.tok && !!host.querySelector('.srt[data-tok="' + tok + '"]');
      const HEAD = '<div class="rs-page-head"><h1>Sales team</h1>'
        + "<p>Who is on the sales team, and who gets the daily lead email. Ruso keeps this list.</p></div>";
      injectStyle();
      host.innerHTML = '<div class="srt" data-tok="' + tok + '">' + HEAD
        + '<div class="rs-loading" style="padding:22px">Reading the sales team…</div></div>';

      let data;
      try {
        data = await api("GET");
      } catch (e) {
        if (!alive()) return;
        host.querySelector(".srt").innerHTML = HEAD + '<div class="panel"><p class="rs-hint">'
          + (e.code === "table_missing"
            ? "The sales team list is not created yet — it arrives with the next data refresh."
            : "Could not read the sales team — " + esc(e.message)) + "</p></div>";
        return;
      }
      if (!alive()) return;

      const preview = !!(ZTZ.getViewAs && ZTZ.getViewAs());
      const editable = !!data.can_edit && !preview;
      const rows = (data.rows || []).filter(r => r && r.rep);
      const busy = new Set();
      let flash = null;          // { rep, where: "active" | "email" | "kind", text, cls }

      // ---- formatting ----
      const day = v => {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
        return m ? +m[3] + " " + MON[+m[2] - 1] + " " + m[1] : "—";
      };
      const n0 = v => (+v || 0).toLocaleString("en-US");
      const when = iso => {
        if (!iso) return "";
        try {
          if (RS.fmtTzDay && RS.fmtTz) {
            return RS.fmtTzDay(iso, { year: "numeric" }) + ", " + RS.fmtTz(iso) + " " + RS.tzShort();
          }
        } catch (e) { /* fall through to the plain date */ }
        return day(iso);
      };
      const who = em => String(em || "").split("@")[0];
      const msg = (rep, where) => flash && flash.rep === rep && flash.where === where
        ? '<span class="rs-why srt-msg ' + flash.cls + '">' + esc(flash.text) + "</span>" : "";

      function cells(r) {
        const g = groupOf(r), on = +r.active === 1, rep = esc(r.rep);
        const isBusy = busy.has(r.rep);
        let h = '<tr class="srt-row' + (isBusy ? " srt-busy" : "") + '" data-rep="' + rep + '"><td><div class="srt-rep">'
          + rep + "</div>";
        if (editable && g !== "active") {
          // the seed guesses test accounts from their name; either guess can be put right here
          h += '<button class="rs-btn srt-kind" data-rep="' + rep + '" data-kind="' + (g === "test" ? "rep" : "test") + '">'
            + (g === "test" ? "Not a test account" : "Test account") + "</button>" + msg(r.rep, "kind");
        }
        h += "</td><td>";
        if (editable) {
          const v = Object.prototype.hasOwnProperty.call(S.draft, r.rep) ? S.draft[r.rep] : (r.email || "");
          const bad = flash && flash.rep === r.rep && flash.where === "email" && flash.cls === "err";
          h += '<input class="rs-inp srt-email' + (bad ? " bad" : "") + '" type="text" inputmode="email" spellcheck="false" '
            + 'autocomplete="off" placeholder="name' + DOMAIN + '" value="' + esc(v) + '" data-rep="' + rep
            + '" aria-label="Email for ' + rep + '">' + msg(r.rep, "email");
        } else {
          h += r.email ? esc(r.email) : '<span class="srt-dim">no email</span>';
        }
        h += "</td><td>";
        if (editable) {
          h += '<span class="srt-sw"><span class="acl-switch' + (on ? " on" : "") + '" role="switch" tabindex="0" '
            + 'aria-checked="' + on + '" aria-label="' + rep + ' active" data-rep="' + rep + '" title="'
            + (on ? "Switch off" : "Switch on") + '"></span><span class="srt-onoff">' + (on ? "On" : "Off")
            + "</span></span>" + msg(r.rep, "active");
        } else {
          h += '<span class="rs-pill ' + (on ? "ok" : "mute") + '">' + (on ? "On" : "Off") + "</span>";
        }
        h += '</td><td class="num">' + n0(r.leads_90d) + '</td><td class="nowrap">' + day(r.last_lead)
          + '</td><td class="num">' + n0(r.jobs_365d) + '</td><td class="nowrap">' + day(r.last_job) + "</td><td>";
        h += r.updated_by
          ? '<div title="' + esc(r.updated_by) + '">' + esc(who(r.updated_by)) + '</div><span class="rs-why">'
            + esc(when(r.updated_at)) + "</span>"
          : '<span class="srt-dim">—</span>';
        return h + "</td></tr>";
      }

      function groupRow(key, label, note, n) {
        const open = !!S.open[key];
        return '<tr class="rs-group' + (open ? " on" : "") + '" data-grp="' + key + '" tabindex="0" aria-expanded="'
          + open + '"><td colspan="8"><span class="rs-caret">›</span>' + esc(label) + " (" + n + ")"
          + '<span class="srt-grp-note">' + esc(note) + "</span></td></tr>";
      }

      // A REPAINT MUST NOT SAVE A HALF-TYPED EMAIL. Replacing the table removes a focused input,
      // and Chrome fires blur on removal -- which is the save path. So the field being typed in
      // is carried across the repaint (value, caret) and its blur is ignored while it happens.
      let repainting = false;
      let refocus = null;        // { rep, where } to put the keyboard back after a save

      function paint() {
        if (!alive()) return;
        const act = document.activeElement;
        const typing = act && host.contains(act) && act.matches && act.matches("input.srt-email[data-rep]")
          ? { rep: act.dataset.rep, v: act.value, s: act.selectionStart, e: act.selectionEnd } : null;
        if (typing) S.draft[typing.rep] = typing.v;
        repainting = true;
        try { draw(); } finally { repainting = false; }
        const root = host.querySelector(".srt");
        const find = (sel, rep) => [...root.querySelectorAll(sel)].find(x => x.dataset.rep === rep);
        if (typing) {
          const el = find("input.srt-email[data-rep]", typing.rep);
          if (el) { el.focus(); try { el.setSelectionRange(typing.s, typing.e); } catch (e) { /* caret is a nicety */ } }
        } else if (refocus) {
          // a keyboard switch keeps the keyboard on the switch, wherever the row moved to
          const el = refocus.where === "active" && find(".acl-switch[data-rep]", refocus.rep);
          if (el) el.focus();
          refocus = null;
        }
      }

      function draw() {
        const by = { active: [], former: [], test: [] };
        rows.forEach(r => by[groupOf(r)].push(r));
        const byLeads = (a, b) => (+b.leads_90d || 0) - (+a.leads_90d || 0)
          || (+b.jobs_365d || 0) - (+a.jobs_365d || 0) || String(a.rep).localeCompare(String(b.rep));
        by.active.sort(byLeads);
        by.former.sort(byLeads);
        by.test.sort((a, b) => String(a.rep).localeCompare(String(b.rep)));
        const mailed = by.active.filter(r => r.email).length;
        const formerLeads = by.former.reduce((a, r) => a + (+r.leads_90d || 0), 0);

        let body = by.active.map(cells).join("");
        if (by.former.length) {
          body += groupRow("former", "Former reps", "switched off — no lead email, grouped under Former reps in reports",
            by.former.length);
          if (S.open.former) body += by.former.map(cells).join("");
        }
        if (by.test.length) {
          body += groupRow("test", "Test / system", "test, training and routing accounts — never counted as a person",
            by.test.length);
          if (S.open.test) body += by.test.map(cells).join("");
        }
        if (!rows.length) {
          body = '<tr><td colspan="8" class="dim">Nobody is on the list yet — names are added by the hourly data '
            + "refresh from the leads and closings of the last 12 months.</td></tr>";
        }

        const who_note = preview
          ? "Preview — read-only while you are viewing the portal as someone else."
          : editable
            ? "Switch a rep on or off, or type their company email and press Enter. Changes save straight away "
              + "and are logged with your name."
            : "You can view this list. Only Ruso (the sales manager) and admins can switch reps on or off "
              + "or change an email.";

        host.querySelector(".srt").innerHTML = HEAD
          + '<div class="rs-kpis" id="srtKpis"></div>'
          + '<div class="panel"><div class="panel-head"><span class="panel-title">Reps</span></div>'
          + '<p class="rs-hint"><b>Switching a rep off</b> means: they stop getting their own copy of the daily '
          + "and monthly lead email, and their leads go to Ruso’s team email instead; reports group them under "
          + "<b>Former reps</b> at the bottom of each rep table; their past leads and jobs still count in every "
          + "total. Nothing is deleted — switch them back on at any time. A rep with no email gets no copy; "
          + "only " + esc(DOMAIN) + " addresses are accepted.</p>"
          + '<p class="rs-hint">' + esc(who_note) + "</p>"
          + (data.stats_error ? '<p class="rs-hint">The lead and job numbers could not be read just now ('
            + esc(data.stats_error) + ") — the names and switches are current.</p>" : "")
          + '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
          + "<th>Rep</th><th>Email</th><th>Active</th>"
          + '<th class="num">Leads last 90 days</th><th>Last lead</th>'
          + '<th class="num">Jobs last 12 months</th><th>Last job</th><th>Changed</th>'
          + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";

        RSC.kpis(host.querySelector("#srtKpis"), [
          { label: "Active reps", value: String(by.active.length),
            sub: mailed + " get the daily lead email" },
          { label: "Former reps", value: String(by.former.length), sub: "switched off" },
          { label: "Leads to former reps", value: n0(formerLeads),
            sub: "last 90 days, still assigned to someone switched off" },
          { label: "Test / system", value: String(by.test.length), sub: "never counted as a person" },
        ]);
        wire();
      }

      async function save(rep, payload, where) {
        const r = rows.find(x => x.rep === rep);
        if (!r || busy.has(rep)) return;
        busy.add(rep);
        flash = null;
        // dim just this row: a whole repaint here would swap out the control the user is
        // clicking next (the blur that started this save fires on mousedown elsewhere)
        const tr = [...host.querySelectorAll("tr.srt-row")].find(x => x.dataset.rep === rep);
        if (tr) tr.classList.add("srt-busy");
        try {
          const j = await api("POST", Object.assign({ rep }, payload));
          Object.assign(r, j.row || {});
          delete S.draft[rep];
          // other pages in this tab re-read the roster on their next render
          if (RS.salesTeam && RS.salesTeam.invalidate) RS.salesTeam.invalidate();
          flash = { rep, where, cls: "ok", text: (j.changed || []).length ? "Saved" : "No change" };
          // keep the row (and its "Saved") in view when the switch moved it into a closed group
          const g = groupOf(r);
          if (g !== "active") S.open[g] = true;
          refocus = { rep, where };
        } catch (e) {
          flash = { rep, where, cls: "err",
            text: e.code === "view_as_readonly"
              ? "Preview mode — nothing is saved while viewing as someone else"
              : e.message };
        } finally {
          busy.delete(rep);
        }
        paint();
      }

      function wire() {
        const root = host.querySelector(".srt");
        root.querySelectorAll("tr.rs-group[data-grp]").forEach(tr => {
          const flip = () => { S.open[tr.dataset.grp] = !S.open[tr.dataset.grp]; paint(); };
          tr.onclick = flip;
          tr.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); flip(); } };
        });
        if (!editable) return;
        root.querySelectorAll(".acl-switch[data-rep]").forEach(sw => {
          const flip = () => {
            const r = rows.find(x => x.rep === sw.dataset.rep);
            if (r) save(r.rep, { active: +r.active === 1 ? 0 : 1 }, "active");
          };
          sw.onclick = flip;
          sw.onkeydown = ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); flip(); } };
        });
        root.querySelectorAll("input.srt-email[data-rep]").forEach(inp => {
          // Enter = leave the field; the blur is the one place that saves, so it never saves twice
          inp.onkeydown = ev => {
            if (ev.key === "Enter") { ev.preventDefault(); inp.blur(); }
            if (ev.key === "Escape") {
              const r = rows.find(x => x.rep === inp.dataset.rep);
              inp.value = r ? String(r.email || "") : "";
              delete S.draft[inp.dataset.rep];
              if (flash && flash.rep === inp.dataset.rep) flash = null;
              inp.blur();
              paint();
            }
          };
          inp.onblur = () => {
            if (repainting) return;
            const r = rows.find(x => x.rep === inp.dataset.rep);
            if (!r) return;
            const v = inp.value.trim().toLowerCase();
            if (v === String(r.email || "").toLowerCase()) {
              if (Object.prototype.hasOwnProperty.call(S.draft, r.rep)) {
                delete S.draft[r.rep];
                if (flash && flash.rep === r.rep && flash.cls === "err") { flash = null; paint(); }
              }
              return;
            }
            if (v && !EMAIL_RE.test(v)) {
              S.draft[r.rep] = inp.value;
              flash = { rep: r.rep, where: "email", cls: "err",
                text: "Use a company address ending in " + DOMAIN + ", or leave it blank" };
              paint();
              return;
            }
            S.draft[r.rep] = inp.value;
            save(r.rep, { email: v }, "email");
          };
        });
        root.querySelectorAll("button.srt-kind[data-rep]").forEach(b => {
          b.onclick = () => save(b.dataset.rep, { kind: b.dataset.kind }, "kind");
        });
      }

      paint();
    },
  });
})();
