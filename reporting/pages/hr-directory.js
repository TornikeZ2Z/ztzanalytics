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
          ".hd-p{cursor:pointer}",
          ".hd-p:hover td{background:var(--panel-2)}",
          ".hd-p.off{opacity:.55}",
          ".hd-p .pcell{display:flex;align-items:center;gap:10px}",
          ".hd-p .pcell .hd-av{font-size:12px}",
          ".hd-p .pcell b{font-size:13px;white-space:nowrap}",
          ".hd-tbl td.r{text-align:right;white-space:nowrap}",
          ".hd-noem{display:inline-block;font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;border:1px dashed var(--warn);color:var(--warn);border-radius:999px;padding:2px 9px}",
          // -------- editor popup --------
          ".hd-ovl{position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow:auto}",
          ".hd-pane{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:560px;width:100%;box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}",
          ".hd-pane .head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}",
          ".hd-pane .head .hd-av{font-size:14px}",
          ".hd-pane .head b{font-size:15px;display:block}",
          ".hd-pane .head span{font-size:12px;color:var(--faint)}",
          ".hd-pane .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 18px}",
          ".hd-pane .grid .wide{grid-column:1 / -1}",
          ".hd-pane label{display:block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:var(--faint);margin-bottom:5px}",
          ".hd-pane .hd-in{width:100%;box-sizing:border-box}",
          ".hd-pane .foot{display:flex;gap:8px;align-items:center;padding:14px 18px;border-top:1px solid var(--line);background:var(--panel-2)}",
          "@media(max-width:560px){.hd-pane .grid{grid-template-columns:1fr}}",
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

      /* ------------- editor POPUP (person click and + Add alike) ------------- */
      function closeModal() {
        var m = document.getElementById("hdOvl");
        if (m) m.remove();
        S.editing = null; S.adding = false;
      }

      function openEditorModal(p) {
        closeModal();
        S.editing = p.id || null; S.adding = !p.id;
        var f = function (k, lab, v, wide) {
          return '<div class="' + (wide ? "wide" : "") + '"><label>' + lab
            + '</label><input class="hd-in" data-f="' + k + '" value="'
            + esc(v == null ? "" : v) + '"></div>';
        };
        var ovl = document.createElement("div");
        ovl.id = "hdOvl"; ovl.className = "hd-ovl";
        ovl.innerHTML = '<div class="hd-pane">'
          + '<div class="head">' + avatar(p.name ? p : { name: "+", department: p.department }, 40)
          + "<span style=\"flex:1\"><b>" + (p.id ? esc(p.name || "—") : "New person") + "</b>"
          + "<span>" + (p.id ? esc(p.title || p.department || "") : "joins the office list and every questionnaire audience") + "</span></span>"
          + '<button class="hd-btn" data-cx>✕</button></div>'
          + '<div class="grid">'
          + f("name", "Name", p.name)
          + f("alias", "Alias (sales name)", p.alias)
          + f("title", "Title", p.title)
          + f("department", "Department", p.department)
          + f("reports_to", "Reports to", p.reports_to)
          + f("also_reports_to", "Also reports to (dotted)", p.also_reports_to)
          + f("email", "Sign-in email (Google) — lets them receive and answer questionnaires", p.email, true)
          + "</div>"
          + '<div class="foot">'
          + '<button class="hd-btn go" data-sv>Save</button>'
          + '<button class="hd-btn" data-cx2>Cancel</button>'
          + '<span style="flex:1"></span>'
          + (p.id ? '<button class="hd-btn warn" data-tg>'
              + (p.status === "active" ? "Deactivate" : "Reactivate") + "</button>" : "")
          + "</div></div>";
        document.body.appendChild(ovl);
        ovl.onclick = function (e) { if (e.target === ovl) closeModal(); };
        var read = function () {
          var out = { action: "roster_upsert", status: p.status || "active" };
          if (p.id) out.id = p.id;
          ovl.querySelectorAll("[data-f]").forEach(function (inp) { out[inp.dataset.f] = inp.value; });
          return out;
        };
        ovl.querySelector("[data-sv]").onclick = async function () {
          try {
            var nm = read();
            await post(nm);
            toast("Saved — " + (nm.name || "person"));
            closeModal(); await refresh();
          } catch (e) { toast(e.message, true); }
        };
        ovl.querySelector("[data-cx]").onclick = closeModal;
        ovl.querySelector("[data-cx2]").onclick = closeModal;
        var tg = ovl.querySelector("[data-tg]");
        if (tg) tg.onclick = async function () {
          var to = p.status === "active" ? "inactive" : "active";
          if (to === "inactive" && !confirm("Deactivate " + (p.name || "this person")
              + "? They leave every questionnaire denominator; past answers stay. "
              + "You can bring them back by searching their name.")) return;
          try {
            var payload = read(); payload.status = to;
            await post(payload);
            toast((to === "inactive" ? "Deactivated " : "Reactivated ") + (p.name || ""));
            closeModal(); await refresh();
          } catch (e) { toast(e.message, true); }
        };
        var first = ovl.querySelector(p.id ? '[data-f="email"]' : '[data-f="name"]');
        if (first) first.focus();
      }

      /* ---------------- People ---------------- */
      function personRow(p) {
        return '<tr class="hd-p' + (p.status === "active" ? "" : " off") + '" data-id="' + p.id + '">'
          + '<td class="pcell">' + avatar(p, 32)
          + "<span><b>" + esc(p.name || "—")
          + (p.alias ? '<small class="hd-dim"> · ' + esc(p.alias) + "</small>" : "") + "</b></span></td>"
          + "<td>" + esc(p.title || "—") + "</td>"
          + '<td class="hd-dim">' + esc(p.reports_to || "—")
          + (p.also_reports_to ? ' <span title="dotted line">+ ' + esc(p.also_reports_to) + "</span>" : "")
          + "</td>"
          + "<td>" + (p.email ? '<span class="hd-dim">' + esc(p.email) + "</span>"
                              : '<span class="hd-noem">no email yet</span>') + "</td>"
          + '<td class="r hd-dim">' + (p.status === "active" ? "edit ›" : "inactive · edit ›") + "</td></tr>";
      }

      function deptTable(rowsHtml) {
        return '<div class="hd-card hd-wrap"><table class="hd-tbl"><thead><tr>'
          + "<th>Person</th><th>Title</th><th>Reports to</th><th>Email</th><th></th>"
          + "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>";
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
          + '<span class="hd-dim">Click a person to edit — the email is what lets them sign in and answer questionnaires.</span></div>';
        var dept = null, buf = "";
        act.forEach(function (p) {
          if ((p.department || "—") !== dept) {
            if (buf) { html += deptTable(buf); buf = ""; }
            dept = p.department || "—";
            var n = act.filter(function (x) { return (x.department || "—") === dept; }).length;
            html += '<div class="hd-dept"><span class="dot" style="background:' + deptColor(dept) + '"></span>'
              + "<i>" + esc(dept) + "</i><em>" + n + "</em></div>";
          }
          buf += personRow(p);
        });
        if (buf) html += deptTable(buf);
        // NO standing Inactive section (his call) — deactivated people surface only when a
        // search matches them, so reactivation stays one search away
        if (q2 && inact.length) {
          html += '<div class="hd-dept"><span class="dot" style="background:#94a3b8"></span><i>Inactive — match your search</i><em>'
            + inact.length + "</em></div>" + deptTable(inact.map(personRow).join(""));
        }
        if (!act.length && !(q2 && inact.length)) html += '<div class="hd-dim" style="padding:14px">Nobody matches.</div>';
        main.innerHTML = html;

        main.querySelector("#hdAdd").onclick = function () { openEditorModal({ status: "active" }); };
        var qi = main.querySelector("#hdQ");
        qi.oninput = function () {
          S.q = this.value; var at = this.selectionStart;
          paintPeople();
          var n = main.querySelector("#hdQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        };
        main.querySelectorAll(".hd-p").forEach(function (row) {
          row.onclick = function () {
            var p = S.roster.filter(function (x) { return x.id === +row.dataset.id; })[0];
            if (p) openEditorModal(p);
          };
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
          c.onclick = function () {
            var p = S.roster.filter(function (x) { return x.id === +c.dataset.id; })[0];
            if (p) openEditorModal(p);      // edit right here — no view switch
          };
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
