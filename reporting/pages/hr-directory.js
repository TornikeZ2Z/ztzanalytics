/* Team Directory — the people of Zip to Zip, in two halves with two different truths.
 *
 * OFFICE (the org chart's PEOPLE list, seeded 2026-08-18 from zipdispatch org.html):
 * lives in hrq_roster and is edited HERE — name, alias, title, department, reporting
 * lines, and most importantly the sign-in EMAIL, because these are the people who
 * receive company questionnaires. A person without an email is visibly flagged: they
 * exist, they count in every completion denominator, and they cannot sign in yet.
 *
 * CREW (the field workforce): READ-ONLY. The crew Google Sheet -> dim_crew pipeline
 * stays crew's single source of truth (his call) — this page only shows it.
 *
 * The reporting lines (reports_to / also_reports_to) are kept as data so the org
 * CHART can be drawn in a later phase; today this is deliberately a directory.
 */
(function () {
  "use strict";
  var RSC = window.RSC || {};
  var esc = RSC.esc || function (s) { return String(s == null ? "" : s); };

  registerPage({
    id: "hr-directory",
    group: "hr",
    title: "Team Directory",
    datasets: [],
    render: async function (host) {
      var S = window.__HD = window.__HD || { tab: "office", q: "" };
      S.q = "";

      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(function (r) {
          return r.json().then(function (j) {
            if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
            return j;
          });
        });
      }
      var post = function (body) { return api("/api/_hrqadmin", { method: "POST", body: JSON.stringify(body) }); };

      if (!document.getElementById("hdCss")) {
        var st = document.createElement("style"); st.id = "hdCss";
        st.textContent = [
          ".hd{max-width:1180px;font-variant-numeric:tabular-nums}",
          ".hd-kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}",
          ".hd-kpi{flex:1 1 150px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:12px 16px}",
          ".hd-kpi b{display:block;font-size:20px;font-weight:800}",
          ".hd-kpi span{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:700}",
          ".hd-kpi.warn b{color:var(--warn)}",
          ".hd-tabs{display:flex;gap:4px;margin:2px 0 14px}",
          ".hd-tabs button{font:inherit;font-size:13.5px;font-weight:750;color:var(--muted);background:transparent;border:0;border-radius:10px;padding:9px 16px;cursor:pointer}",
          ".hd-tabs button:hover{background:var(--panel-2);color:var(--ink)}",
          ".hd-tabs button.on{background:var(--brand);color:var(--brand-ink)}",
          ".hd-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}",
          ".hd-in{font:inherit;font-size:12.5px;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px}",
          ".hd-in:focus{outline:none;border-color:var(--brand)}",
          ".hd-btn{font:inherit;font-size:12.5px;font-weight:700;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 13px;cursor:pointer}",
          ".hd-btn:hover{border-color:var(--brand);color:var(--brand)}",
          ".hd-btn.go{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}",
          ".hd-btn.warn:hover{border-color:var(--neg);color:var(--neg)}",
          ".hd-dept{margin:18px 0 8px;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}",
          ".hd-dept i{font-style:normal;color:var(--faint);font-weight:700;margin-left:6px}",
          ".hd-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}",
          ".hd-tbl{width:100%;border-collapse:collapse;font-size:12.5px}",
          ".hd-tbl th{text-align:left;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);font-weight:800;padding:9px 12px;border-bottom:1px solid var(--line)}",
          ".hd-tbl td{padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:middle}",
          ".hd-tbl tr:last-child td{border-bottom:0}",
          ".hd-tbl td.r{text-align:right;white-space:nowrap}",
          ".hd-dim{font-size:11.5px;color:var(--faint)}",
          ".hd-pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:2px 9px;background:var(--panel-2);color:var(--muted)}",
          ".hd-pill.on{background:var(--brand);color:var(--brand-ink)}",
          ".hd-pill.noem{background:transparent;border:1px dashed var(--warn);color:var(--warn)}",
          ".hd-edit{background:var(--panel-2);border-top:1px solid var(--line)}",
          ".hd-edit .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:12px}",
          ".hd-edit label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}",
          ".hd-edit .hd-in{width:100%;box-sizing:border-box}",
          ".hd-edit .foot{display:flex;gap:8px;align-items:center;padding:0 12px 12px}",
          ".hd-msg{font-size:12px;font-weight:700;min-height:16px}",
          ".hd-msg.ok{color:var(--pos)}.hd-msg.err{color:var(--neg)}",
          ".hd-note{background:var(--panel-2);border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;padding:10px 14px;font-size:12.5px;color:var(--muted);margin-bottom:12px;line-height:1.5}",
          ".hd-wrap{overflow-x:auto}",
        ].join("\n");
        document.head.appendChild(st);
      }

      host.innerHTML = '<div class="hd">'
        + '<div class="rs-page-head"><h1>Team Directory</h1>'
        + "<p>Everyone at Zip to Zip — the office side is edited here and receives the questionnaires; "
        + 'the crew side follows the crew Google Sheet.</p></div>'
        + '<div class="hd-kpis" id="hdKpis"></div>'
        + '<div class="hd-tabs" id="hdTabs"></div>'
        + '<div id="hdMain"></div><div class="hd-msg" id="hdMsg" style="margin-top:8px"></div></div>';
      var main = host.querySelector("#hdMain");
      var kpis = host.querySelector("#hdKpis");
      var tabsEl = host.querySelector("#hdTabs");
      S.editing = null; S.adding = false;

      function toast(t, err) {
        var el = host.querySelector("#hdMsg");
        if (el) { el.textContent = t; el.className = "hd-msg " + (err ? "err" : "ok"); }
      }

      async function loadAll() {
        var r = await Promise.all([
          api("/api/_hrqadmin?view=roster"),
          api("/api/_hrqadmin?view=crew"),
          api("/api/_hrqadmin?view=home"),
        ]);
        S.roster = r[0].roster || [];
        S.crew = r[1].crew || [];
        S.home = r[2];
      }

      // the org chart's column order, so the page reads like the company, not the alphabet
      var DEPT_ORDER = ["Executive", "Operations", "Sales", "Customer Service", "Marketing",
                        "Finance", "Systems", "Data & Control", "HR"];
      var deptRank = function (d) {
        var i = DEPT_ORDER.indexOf(d || "");
        return i < 0 ? DEPT_ORDER.length : i;
      };

      function paintKpis() {
        var office = S.roster.filter(function (p) { return p.status === "active"; });
        var noEmail = office.filter(function (p) { return !p.email; });
        var crewAct = S.crew.filter(function (c) { return String(c.status).toLowerCase() === "active"; });
        var pub = (S.home.questionnaires || []).filter(function (q) { return q.status === "published"; });
        var qhtml = pub.map(function (q) {
          var done = (q.responses.submitted || 0) + (q.responses.resubmitted || 0);
          var pct = q.audience_size ? Math.round(done / q.audience_size * 100) : 0;
          return '<div class="hd-kpi"><b>' + done + " / " + q.audience_size + " · " + pct + "%</b>"
            + "<span>" + esc(q.title.slice(0, 26)) + " filled</span></div>";
        }).join("");
        kpis.innerHTML =
          '<div class="hd-kpi"><b>' + office.length + "</b><span>office people</span></div>"
          + '<div class="hd-kpi' + (noEmail.length ? " warn" : "") + '"><b>' + noEmail.length
          + "</b><span>without an email yet</span></div>"
          + '<div class="hd-kpi"><b>' + crewAct.length + "</b><span>active crew (sheet)</span></div>"
          + qhtml;
      }

      function paintTabs() {
        tabsEl.innerHTML = [["office", "Back Office"], ["crew", "Crew (read-only)"]].map(function (t) {
          return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>";
        }).join("");
        tabsEl.querySelectorAll("button").forEach(function (b) {
          b.onclick = function () { S.tab = b.dataset.t; S.editing = null; S.adding = false; S.q = ""; paint(); };
        });
      }

      function editorRow(p) {
        var f = function (k, ph, v) {
          return "<div><label>" + ph + '</label><input class="hd-in" data-f="' + k + '" value="'
            + esc(v == null ? "" : v) + '"></div>';
        };
        return '<tr class="hd-edit"><td colspan="6"><div class="grid">'
          + f("name", "Name", p.name)
          + f("alias", "Alias (sales name)", p.alias)
          + f("title", "Title", p.title)
          + f("department", "Department", p.department)
          + f("reports_to", "Reports to", p.reports_to)
          + f("also_reports_to", "Also reports to (dotted)", p.also_reports_to)
          + f("email", "Sign-in email (Google)", p.email)
          + "</div>"
          + '<div class="foot">'
          + '<button class="hd-btn go" data-sv>Save</button>'
          + '<button class="hd-btn" data-cx>Cancel</button>'
          + '<span style="flex:1"></span>'
          + (p.id ? '<button class="hd-btn warn" data-tg>'
              + (p.status === "active" ? "Deactivate" : "Reactivate") + "</button>" : "")
          + "</div></td></tr>";
      }

      function wireEditor(tr, p) {
        var read = function () {
          var out = { action: "roster_upsert", id: p.id || null, status: p.status || "active" };
          tr.querySelectorAll("[data-f]").forEach(function (inp) { out[inp.dataset.f] = inp.value; });
          if (!out.id) delete out.id;
          return out;
        };
        tr.querySelector("[data-sv]").onclick = async function () {
          try {
            await post(read());
            toast("Saved — " + (tr.querySelector('[data-f="name"]').value || "person"));
            S.editing = null; S.adding = false; await refresh();
          } catch (e) { toast(e.message, true); }
        };
        tr.querySelector("[data-cx]").onclick = function () { S.editing = null; S.adding = false; paint(); };
        var tg = tr.querySelector("[data-tg]");
        if (tg) tg.onclick = async function () {
          var to = p.status === "active" ? "inactive" : "active";
          if (to === "inactive" && !confirm("Deactivate " + (p.name || "this person")
              + "? They leave every questionnaire denominator; past answers stay.")) return;
          try {
            var payload = read(); payload.status = to;
            await post(payload);
            toast((to === "inactive" ? "Deactivated " : "Reactivated ") + (p.name || ""));
            S.editing = null; await refresh();
          } catch (e) { toast(e.message, true); }
        };
      }

      function paintOffice() {
        var q2 = S.q.toLowerCase();
        var rows = S.roster.filter(function (p) {
          if (!q2) return true;
          return [p.name, p.alias, p.title, p.department, p.email].some(function (v) {
            return String(v || "").toLowerCase().indexOf(q2) >= 0;
          });
        });
        var act = rows.filter(function (p) { return p.status === "active"; });
        var inact = rows.filter(function (p) { return p.status !== "active"; });
        act.sort(function (a, b) {
          return deptRank(a.department) - deptRank(b.department)
            || String(a.name || "").localeCompare(String(b.name || ""));
        });
        var html = '<div class="hd-row" style="margin-bottom:12px">'
          + '<button class="hd-btn go" id="hdAdd">+ Add a person</button>'
          + '<input class="hd-in" id="hdQ" placeholder="Find a person…" value="' + esc(S.q) + '" style="min-width:220px">'
          + '<span class="hd-dim">Click a row to edit — the email is what lets them sign in and answer questionnaires.</span></div>';
        if (S.adding) {
          html += '<div class="hd-card" style="margin-bottom:12px"><table class="hd-tbl"><tbody>'
            + editorRow({ status: "active" }) + "</tbody></table></div>";
        }
        var dept = null, open = false;
        var openTbl = '<div class="hd-card hd-wrap"><table class="hd-tbl">'
          + "<thead><tr><th>Person</th><th>Title</th><th>Reports to</th><th>Email</th>"
          + "<th></th><th class=\"r\"></th></tr></thead><tbody>";
        act.forEach(function (p) {
          if ((p.department || "—") !== dept) {
            if (open) html += "</tbody></table></div>";
            dept = p.department || "—";
            var n = act.filter(function (x) { return (x.department || "—") === dept; }).length;
            html += '<div class="hd-dept">' + esc(dept) + "<i>· " + n + "</i></div>" + openTbl;
            open = true;
          }
          html += '<tr data-id="' + p.id + '" style="cursor:pointer"><td><b>' + esc(p.name || "—") + "</b>"
            + (p.alias ? ' <span class="hd-dim">· ' + esc(p.alias) + "</span>" : "") + "</td>"
            + "<td>" + esc(p.title || "—") + "</td>"
            + '<td class="hd-dim">' + esc(p.reports_to || "—")
            + (p.also_reports_to ? " <span title=\"dotted line\">+ " + esc(p.also_reports_to) + "</span>" : "") + "</td>"
            + "<td>" + (p.email ? esc(p.email) : '<span class="hd-pill noem">no email yet</span>') + "</td>"
            + '<td><span class="hd-pill on">active</span></td>'
            + '<td class="r hd-dim">edit ›</td></tr>';
          if (S.editing === p.id) html += editorRow(p);
        });
        if (open) html += "</tbody></table></div>";
        if (inact.length) {
          html += '<div class="hd-dept">Inactive<i>· ' + inact.length + "</i></div>"
            + openTbl;
          inact.forEach(function (p) {
            html += '<tr data-id="' + p.id + '" style="cursor:pointer;opacity:.6"><td><b>' + esc(p.name || p.email || "—") + "</b></td>"
              + "<td>" + esc(p.title || "—") + "</td>"
              + '<td class="hd-dim">' + esc(p.department || "—") + "</td>"
              + "<td>" + esc(p.email || "—") + "</td>"
              + '<td><span class="hd-pill">inactive</span></td>'
              + '<td class="r hd-dim">edit ›</td></tr>';
            if (S.editing === p.id) html += editorRow(p);
          });
          html += "</tbody></table></div>";
        }
        if (!act.length && !inact.length) html += '<div class="hd-dim" style="padding:14px">Nobody matches.</div>';
        main.innerHTML = html;

        main.querySelector("#hdAdd").onclick = function () { S.adding = true; S.editing = null; paint(); };
        var qi = main.querySelector("#hdQ");
        qi.oninput = function () {
          S.q = this.value; var at = this.selectionStart;
          paintOffice();
          var n = main.querySelector("#hdQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        };
        main.querySelectorAll("tr[data-id]").forEach(function (tr) {
          tr.onclick = function () {
            var id = +tr.dataset.id;
            S.editing = S.editing === id ? null : id; S.adding = false; paint();
          };
        });
        main.querySelectorAll(".hd-edit").forEach(function (tr) {
          tr.onclick = function (e) { e.stopPropagation(); };
          var id = S.adding ? null : S.editing;
          var p = S.adding ? { status: "active" }
            : S.roster.filter(function (x) { return x.id === id; })[0];
          if (p) wireEditor(tr, p);
        });
      }

      function paintCrew() {
        var q2 = S.q.toLowerCase();
        var rows = S.crew.filter(function (c) {
          if (!q2) return true;
          return [c.name, c.nickname, c.role, c.base, c.email].some(function (v) {
            return String(v || "").toLowerCase().indexOf(q2) >= 0;
          });
        });
        var html = '<div class="hd-note"><b>Crew is edited in the crew Google Sheet, not here.</b> '
          + "This list follows the sheet through the nightly pipeline (dim_crew) — change someone "
          + "there and this page catches up on the next refresh.</div>"
          + '<div class="hd-row" style="margin-bottom:12px">'
          + '<input class="hd-in" id="hdQ" placeholder="Find a crew member…" value="' + esc(S.q) + '" style="min-width:220px">'
          + '<span class="hd-dim">' + rows.length + " people shown</span></div>"
          + '<div class="hd-card hd-wrap"><table class="hd-tbl">'
          + "<thead><tr><th>Name</th><th>Nickname</th><th>Role</th><th>Status</th>"
          + "<th>Base</th><th>Email</th><th>Phone</th></tr></thead><tbody>"
          + (rows.map(function (c) {
              var on = String(c.status).toLowerCase() === "active";
              return "<tr" + (on ? "" : ' style="opacity:.55"') + "><td><b>" + esc(c.name || "—") + "</b></td>"
                + "<td>" + esc(c.nickname || "—") + "</td>"
                + "<td>" + esc(c.role || "—") + "</td>"
                + '<td><span class="hd-pill' + (on ? " on" : "") + '">' + esc(c.status || "—") + "</span></td>"
                + "<td>" + esc(c.base || "—") + "</td>"
                + "<td>" + (c.email ? esc(c.email) : '<span class="hd-dim">—</span>') + "</td>"
                + "<td>" + esc(c.phone || "—") + "</td></tr>";
            }).join("") || '<tr><td colspan="7" class="hd-dim" style="padding:14px">Nobody matches.</td></tr>')
          + "</tbody></table></div>";
        main.innerHTML = html;
        var qi = main.querySelector("#hdQ");
        qi.oninput = function () {
          S.q = this.value; var at = this.selectionStart;
          paintCrew();
          var n = main.querySelector("#hdQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        };
      }

      function paint() {
        paintTabs();
        paintKpis();
        if (S.tab === "crew") paintCrew(); else paintOffice();
      }

      async function refresh() { await loadAll(); paint(); }

      try {
        await loadAll();
      } catch (e) {
        main.innerHTML = '<div class="hd-dim" style="padding:14px">Could not load — ' + esc(e.message || e)
          + "<br>The Team Directory needs the HR manage grant.</div>";
        return;
      }
      paint();
    },
  });
})();
