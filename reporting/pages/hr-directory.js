/* Team Directory — the people of Zip to Zip, in three views with two different truths.
 *
 * PEOPLE (office, editable HERE): lives in hrq_roster — names, aliases, titles,
 * departments, reporting lines, and the sign-in EMAIL that lets a person receive
 * questionnaires. Someone without an email is flagged, counts in every completion
 * denominator, and cannot sign in yet.
 *
 * ORGANIZATION: the same data drawn as the reporting tree (reports_to by name, dotted
 * lines shown inline) — the org chart the zipdispatch org.html used to be.
 *
 * CREW (read-only): the crew Google Sheet -> dim_crew stays crew's single source of
 * truth (his call) — this page only shows it.
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
      var S = window.__HD = window.__HD || { tab: "people", q: "" };
      S.q = ""; S.editing = null; S.adding = false;

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

      // the org chart's palette — accents only, readable on both themes
      var DEPT_COLOR = { Executive: "#4f46e5", Sales: "#2563eb", Marketing: "#9333ea",
                         "Customer Service": "#0d9488", "Data & Control": "#16a34a",
                         Finance: "#d97706", Systems: "#0891b2", HR: "#e11d48",
                         Operations: "#059669" };
      var FALLBACK = ["#7c3aed", "#0ea5e9", "#db2777", "#65a30d", "#0f766e", "#b45309"];
      var _extra = {};
      function deptColor(d) {
        if (!d) return "#94a3b8";
        if (DEPT_COLOR[d]) return DEPT_COLOR[d];
        if (!_extra[d]) _extra[d] = FALLBACK[Object.keys(_extra).length % FALLBACK.length];
        return _extra[d];
      }
      var DEPT_ORDER = ["Executive", "Operations", "Sales", "Customer Service", "Marketing",
                        "Finance", "Systems", "Data & Control", "HR"];
      var deptRank = function (d) {
        var i = DEPT_ORDER.indexOf(d || "");
        return i < 0 ? DEPT_ORDER.length : i;
      };
      function initials(name) {
        var p = String(name || "?").trim().split(/\s+/);
        return ((p[0] || "")[0] || "?").toUpperCase() + (p.length > 1 ? (p[p.length - 1][0] || "").toUpperCase() : "");
      }
      function avatar(p, size) {
        return '<span class="hd-av" style="width:' + size + "px;height:" + size + "px;background:"
          + deptColor(p.department) + '">' + esc(initials(p.name)) + "</span>";
      }

      if (!document.getElementById("hdCss")) {
        var st = document.createElement("style"); st.id = "hdCss";
        st.textContent = [
          ".hd{max-width:1180px;font-variant-numeric:tabular-nums}",
          ".hd-kpis{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}",
          ".hd-kpi{flex:1 1 150px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:12px 16px}",
          ".hd-kpi b{display:block;font-size:20px;font-weight:800}",
          ".hd-kpi span{font-size:11px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em;font-weight:700}",
          ".hd-kpi.warn b{color:var(--warn)}",
          ".hd-tabs{display:flex;gap:4px;margin:2px 0 16px}",
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
          ".hd-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex:0 0 auto;letter-spacing:.02em}",
          // -------- people view: department cards of two-line rows --------
          ".hd-dept{margin:20px 0 8px;display:flex;align-items:center;gap:8px}",
          ".hd-dept i{font-style:normal;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}",
          ".hd-dept em{font-style:normal;font-size:11px;color:var(--faint);font-weight:700}",
          ".hd-dept .dot{width:9px;height:9px;border-radius:50%}",
          ".hd-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;overflow:hidden}",
          ".hd-p{display:flex;align-items:center;gap:12px;padding:10px 14px;border-bottom:1px solid var(--line);cursor:pointer}",
          ".hd-p:last-child{border-bottom:0}",
          ".hd-p:hover{background:var(--panel-2)}",
          ".hd-p .hd-av{font-size:12px}",
          ".hd-p .who{flex:1;min-width:0}",
          ".hd-p .who b{display:block;font-size:13.5px}",
          ".hd-p .who b small{font-weight:600;color:var(--faint);font-size:11.5px;margin-left:6px}",
          ".hd-p .who span{display:block;font-size:11.5px;color:var(--faint);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
          ".hd-p .mail{font-size:12px;color:var(--muted);white-space:nowrap}",
          ".hd-p.off{opacity:.55}",
          ".hd-noem{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:1px dashed var(--warn);color:var(--warn);border-radius:999px;padding:2px 9px}",
          // -------- editor --------
          ".hd-edit{background:var(--panel-2);border-bottom:1px solid var(--line);cursor:default}",
          ".hd-edit .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;padding:14px}",
          ".hd-edit label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:4px}",
          ".hd-edit .hd-in{width:100%;box-sizing:border-box}",
          ".hd-edit .foot{display:flex;gap:8px;align-items:center;padding:0 14px 14px}",
          ".hd-msg{font-size:12px;font-weight:700;min-height:16px}",
          ".hd-msg.ok{color:var(--pos)}.hd-msg.err{color:var(--neg)}",
          // -------- organization view: the reporting tree --------
          ".hd-org{padding:6px 2px}",
          ".hd-node{position:relative}",
          ".hd-ocard{display:inline-flex;align-items:center;gap:10px;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--c,#94a3b8);border-radius:11px;padding:8px 14px 8px 10px;margin:4px 0;max-width:100%}",
          ".hd-ocard .hd-av{font-size:11px}",
          ".hd-ocard b{font-size:13px;display:block}",
          ".hd-ocard b small{font-weight:600;color:var(--faint);font-size:11px;margin-left:5px}",
          ".hd-ocard span{display:block;font-size:11px;color:var(--faint)}",
          ".hd-ocard span.also{color:var(--muted);font-style:italic}",
          ".hd-kids{margin-left:17px;border-left:2px solid var(--line-2);padding-left:20px}",
          ".hd-kids>.hd-node::before{content:'';position:absolute;left:-20px;top:26px;width:16px;height:2px;background:var(--line-2)}",
          // -------- crew --------
          ".hd-note{background:var(--panel-2);border:1px solid var(--line);border-left:3px solid var(--brand);border-radius:10px;padding:10px 14px;font-size:12.5px;color:var(--muted);margin-bottom:12px;line-height:1.5}",
          ".hd-wrap{overflow-x:auto}",
          ".hd-tbl{width:100%;border-collapse:collapse;font-size:12.5px}",
          ".hd-tbl th{text-align:left;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);font-weight:800;padding:9px 12px;border-bottom:1px solid var(--line)}",
          ".hd-tbl td{padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:middle}",
          ".hd-tbl tr:last-child td{border-bottom:0}",
          ".hd-pill{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border-radius:999px;padding:2px 9px;background:var(--panel-2);color:var(--muted)}",
          ".hd-pill.on{background:var(--brand);color:var(--brand-ink)}",
          ".hd-dim{font-size:11.5px;color:var(--faint)}",
        ].join("\n");
        document.head.appendChild(st);
      }

      host.innerHTML = '<div class="hd">'
        + '<div class="rs-page-head"><h1>Team Directory</h1>'
        + "<p>Everyone at Zip to Zip. The office side is edited here and receives the "
        + "questionnaires; crew follows the crew Google Sheet.</p></div>"
        + '<div class="hd-kpis" id="hdKpis"></div>'
        + '<div class="hd-tabs" id="hdTabs"></div>'
        + '<div id="hdMain"></div><div class="hd-msg" id="hdMsg" style="margin-top:8px"></div></div>';
      var main = host.querySelector("#hdMain");
      var kpis = host.querySelector("#hdKpis");
      var tabsEl = host.querySelector("#hdTabs");

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

      function paintKpis() {
        var office = S.roster.filter(function (p) { return p.status === "active"; });
        var noEmail = office.filter(function (p) { return !p.email; });
        var crewAct = S.crew.filter(function (c) { return String(c.status).toLowerCase() === "active"; });
        var pub = (S.home.questionnaires || []).filter(function (q) { return q.status === "published"; });
        kpis.innerHTML =
          '<div class="hd-kpi"><b>' + office.length + "</b><span>office people</span></div>"
          + '<div class="hd-kpi' + (noEmail.length ? " warn" : "") + '"><b>' + noEmail.length
          + "</b><span>without an email yet</span></div>"
          + '<div class="hd-kpi"><b>' + crewAct.length + "</b><span>active crew (sheet)</span></div>"
          + pub.map(function (q) {
              var done = (q.responses.submitted || 0) + (q.responses.resubmitted || 0);
              var pct = q.audience_size ? Math.round(done / q.audience_size * 100) : 0;
              return '<div class="hd-kpi"><b>' + done + " / " + q.audience_size + " · " + pct + "%</b>"
                + "<span>" + esc(q.title.slice(0, 26)) + " filled</span></div>";
            }).join("");
      }

      function paintTabs() {
        tabsEl.innerHTML = [["people", "People"], ["org", "Organization"], ["crew", "Crew"]].map(function (t) {
          return '<button data-t="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">' + t[1] + "</button>";
        }).join("");
        tabsEl.querySelectorAll("button").forEach(function (b) {
          b.onclick = function () { S.tab = b.dataset.t; S.editing = null; S.adding = false; S.q = ""; paint(); };
        });
      }

      /* ---------------- editor (shared by People rows and + Add) ---------------- */
      function editorHtml(p) {
        var f = function (k, lab, v) {
          return "<div><label>" + lab + '</label><input class="hd-in" data-f="' + k + '" value="'
            + esc(v == null ? "" : v) + '"></div>';
        };
        return '<div class="hd-edit"><div class="grid">'
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
          + "</div></div>";
      }

      function wireEditor(box, p) {
        box.onclick = function (e) { e.stopPropagation(); };
        var read = function () {
          var out = { action: "roster_upsert", status: p.status || "active" };
          if (p.id) out.id = p.id;
          box.querySelectorAll("[data-f]").forEach(function (inp) { out[inp.dataset.f] = inp.value; });
          return out;
        };
        box.querySelector("[data-sv]").onclick = async function () {
          try {
            await post(read());
            toast("Saved — " + (box.querySelector('[data-f="name"]').value || "person"));
            S.editing = null; S.adding = false; await refresh();
          } catch (e) { toast(e.message, true); }
        };
        box.querySelector("[data-cx]").onclick = function () { S.editing = null; S.adding = false; paint(); };
        var tg = box.querySelector("[data-tg]");
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

      /* ---------------- People ---------------- */
      function personRow(p) {
        return '<div class="hd-p' + (p.status === "active" ? "" : " off") + '" data-id="' + p.id + '">'
          + avatar(p, 34)
          + '<span class="who"><b>' + esc(p.name || "—")
          + (p.alias ? "<small>· " + esc(p.alias) + "</small>" : "") + "</b>"
          + "<span>" + esc(p.title || "—") + "</span></span>"
          + (p.email ? '<span class="mail">' + esc(p.email) + "</span>"
                     : '<span class="hd-noem">no email yet</span>')
          + "</div>";
      }

      function paintPeople() {
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
        var html = '<div class="hd-row" style="margin-bottom:4px">'
          + '<button class="hd-btn go" id="hdAdd">+ Add a person</button>'
          + '<input class="hd-in" id="hdQ" placeholder="Find a person…" value="' + esc(S.q) + '" style="min-width:220px">'
          + '<span class="hd-dim">The email is what lets someone sign in and answer questionnaires.</span></div>';
        if (S.adding) html += '<div class="hd-card" style="margin:12px 0">' + editorHtml({ status: "active" }) + "</div>";
        var dept = null, open = false;
        act.forEach(function (p) {
          if ((p.department || "—") !== dept) {
            if (open) html += "</div>";
            dept = p.department || "—";
            var n = act.filter(function (x) { return (x.department || "—") === dept; }).length;
            html += '<div class="hd-dept"><span class="dot" style="background:' + deptColor(dept) + '"></span>'
              + "<i>" + esc(dept) + "</i><em>" + n + "</em></div>"
              + '<div class="hd-card">';
            open = true;
          }
          html += personRow(p);
          if (S.editing === p.id) html += editorHtml(p);
        });
        if (open) html += "</div>";
        if (inact.length) {
          html += '<div class="hd-dept"><span class="dot" style="background:#94a3b8"></span><i>Inactive</i><em>'
            + inact.length + "</em></div>" + '<div class="hd-card">';
          inact.forEach(function (p) {
            html += personRow(p);
            if (S.editing === p.id) html += editorHtml(p);
          });
          html += "</div>";
        }
        if (!act.length && !inact.length) html += '<div class="hd-dim" style="padding:14px">Nobody matches.</div>';
        main.innerHTML = html;

        main.querySelector("#hdAdd").onclick = function () { S.adding = true; S.editing = null; paint(); };
        var qi = main.querySelector("#hdQ");
        qi.oninput = function () {
          S.q = this.value; var at = this.selectionStart;
          paintPeople();
          var n = main.querySelector("#hdQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        };
        main.querySelectorAll(".hd-p").forEach(function (row) {
          row.onclick = function () {
            var id = +row.dataset.id;
            S.editing = S.editing === id ? null : id; S.adding = false; paint();
          };
        });
        main.querySelectorAll(".hd-edit").forEach(function (box) {
          var p = S.adding ? { status: "active" }
            : S.roster.filter(function (x) { return x.id === S.editing; })[0];
          if (p) wireEditor(box, p);
        });
      }

      /* ---------------- Organization: the reporting tree ---------------- */
      function paintOrg() {
        var act = S.roster.filter(function (p) { return p.status === "active"; });
        var byName = {};
        act.forEach(function (p) { if (p.name) byName[p.name.toLowerCase()] = p; });
        var kids = {};
        var roots = [], orphans = [];
        act.forEach(function (p) {
          var boss = String(p.reports_to || "").trim().toLowerCase();
          if (!boss) { roots.push(p); return; }
          if (byName[boss] && byName[boss] !== p) (kids[boss] = kids[boss] || []).push(p);
          else orphans.push(p);
        });
        Object.keys(kids).forEach(function (k) {
          kids[k].sort(function (a, b) {
            return deptRank(a.department) - deptRank(b.department)
              || String(a.name).localeCompare(String(b.name));
          });
        });
        var seen = {};
        function card(p) {
          return '<div class="hd-ocard" style="--c:' + deptColor(p.department) + '" data-id="' + p.id + '">'
            + avatar(p, 30)
            + "<span><b>" + esc(p.name)
            + (p.alias ? "<small>· " + esc(p.alias) + "</small>" : "") + "</b>"
            + "<span>" + esc(p.title || p.department || "") + "</span>"
            + (p.also_reports_to ? '<span class="also">also → ' + esc(p.also_reports_to) + "</span>" : "")
            + "</span></div>";
        }
        function node(p, depth) {
          var key = p.name.toLowerCase();
          if (seen[key] || depth > 10) return "";   // typo cycles must not hang the page
          seen[key] = 1;
          var ks = kids[key] || [];
          return '<div class="hd-node">' + card(p)
            + (ks.length ? '<div class="hd-kids">' + ks.map(function (c) { return node(c, depth + 1); }).join("") + "</div>" : "")
            + "</div>";
        }
        var html = '<div class="hd-org">';
        if (!roots.length && act.length) roots = act.slice(0, 1);   // data has no CEO row: still draw
        html += roots.map(function (r) { return node(r, 0); }).join("");
        var missed = orphans.filter(function (p) { return !seen[p.name.toLowerCase()]; });
        if (missed.length) {
          html += '<div class="hd-dept" style="margin-top:22px"><span class="dot" style="background:#94a3b8"></span>'
            + "<i>Not placed</i><em>" + missed.length + "</em></div>"
            + '<div class="hd-dim" style="margin:0 0 8px">Their “reports to” does not match anyone active — '
            + "fix the name on the People view and they join the tree.</div>"
            + missed.map(function (p) { return '<div class="hd-node">' + card(p) + "</div>"; }).join("");
        }
        html += "</div>";
        main.innerHTML = html;
        main.querySelectorAll(".hd-ocard").forEach(function (c) {
          c.style.cursor = "pointer";
          c.onclick = function () { S.tab = "people"; S.editing = +c.dataset.id; paint(); };
        });
      }

      /* ---------------- Crew ---------------- */
      function paintCrew() {
        var q2 = S.q.toLowerCase();
        var rows = S.crew.filter(function (c) {
          if (!q2) return true;
          return [c.name, c.nickname, c.role, c.base, c.email].some(function (v) {
            return String(v || "").toLowerCase().indexOf(q2) >= 0;
          });
        });
        main.innerHTML = '<div class="hd-note"><b>Crew is edited in the crew Google Sheet, not here.</b> '
          + "This list follows the sheet through the nightly pipeline — change someone there and "
          + "this page catches up on the next refresh.</div>"
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
                + '<td class="hd-dim">' + esc(c.email || "—") + "</td>"
                + '<td class="hd-dim">' + esc(c.phone || "—") + "</td></tr>";
            }).join("") || '<tr><td colspan="7" class="hd-dim" style="padding:14px">Nobody matches.</td></tr>')
          + "</tbody></table></div>";
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
        if (S.tab === "crew") paintCrew();
        else if (S.tab === "org") paintOrg();
        else paintPeople();
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
