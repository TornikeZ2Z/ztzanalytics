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
        // THE COMPONENT KIT (rs.css) now supplies the tile row, the tab bar, the control
        // bar, the fields, the buttons, the tables and the pills. What is left below is
        // what the kit has no word for — the avatar, the department band, the editor pane
        // and the org chart — plus a handful of one-line adjustments TO kit components.
        st.textContent = [
          ".hd{font-variant-numeric:tabular-nums}",   // full width — a bigger screen means more room, not more margin
          // the tile count is DATA-dependent: three fixed tiles plus one per published
          // questionnaire, so no fixed column count can be right. Wrap the way the kit
          // itself does below 1400px — which is exactly what this row has always done.
          ".hd .rs-kpis{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}",
          // the kit paints every tile value in --ink; "without an email yet" is a warning
          ".hd .rs-kpis .kpi.warn .v{color:var(--warn)}",
          // this bar carries no field labels — a button, a find box and a sentence — so it
          // centres instead of sitting on the kit's label-aligned baseline
          ".hd .rs-bar{align-items:center}",
          // a department table is its own little card; there is no .panel around it
          ".hd .rs-tablewrap{background:var(--panel)}",
          ".hd-av{display:inline-flex;align-items:center;justify-content:center;border-radius:50%;color:#fff;font-weight:800;flex:0 0 auto;letter-spacing:.02em}",
          // -------- people view: department cards of two-line rows --------
          ".hd-dept{margin:20px 0 8px;display:flex;align-items:center;gap:8px}",
          ".hd-dept i{font-style:normal;font-size:12px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}",
          ".hd-dept em{font-style:normal;font-size:11px;color:var(--faint);font-weight:700}",
          ".hd-dept .dot{width:9px;height:9px;border-radius:50%}",
          ".hd-p.off{opacity:.55}",
          ".hd-p .pcell{display:flex;align-items:center;gap:10px}",
          ".hd-p .pcell .hd-av{font-size:12px}",
          ".hd-p .pcell b{font-size:14px;white-space:nowrap}",
          // ONE fixed layout for every table on the page, so Title, Reports to and Email
          // sit at identical x positions all the way down (the colgroups do the rest)
          ".hd .rs-table.hd-fixed{table-layout:fixed;min-width:860px}",
          ".hd .rs-table.hd-fixed td{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
          // the edit affordance hugs the right edge — a hint, not a quantity, so not .num
          ".hd .rs-table td.hd-act{text-align:right;white-space:nowrap}",
          // an ABSENT email is drawn as an outline, not a filled pill: the dashed edge is
          // how this page has always said "nothing here yet"
          ".rs-pill.warn.hd-noem{background:transparent;border-style:dashed;border-color:var(--warn)}",
          // -------- editor popup --------
          ".hd-ovl{position:fixed;inset:0;background:rgba(10,14,20,.55);z-index:130;display:flex;align-items:flex-start;justify-content:center;padding:60px 16px;overflow:auto}",
          ".hd-pane{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:560px;width:100%;box-shadow:0 18px 60px rgba(0,0,0,.35);overflow:hidden}",
          ".hd-pane .head{display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid var(--line)}",
          ".hd-pane .head .hd-av{font-size:14px}",
          ".hd-pane .head b{font-size:15px;display:block}",
          ".hd-pane .head span{font-size:12px;color:var(--faint)}",
          ".hd-pane .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 18px}",
          ".hd-pane .grid .wide{grid-column:1 / -1}",
          // a 560px pane two columns deep: its fields fill their cell rather than keeping
          // the kit's standalone min/max width, and the long email label is free to wrap
          ".hd-pane .rs-inp,.hd-pane .rs-sel{width:100%;min-width:0;max-width:none}",
          ".hd-pane .rs-fld>span{line-height:1.35}",
          ".hd-pane .foot{display:flex;gap:8px;align-items:center;padding:14px 18px;border-top:1px solid var(--line);background:var(--panel-2)}",
          // Deactivate is destructive, and the kit's button hover is brand-coloured
          ".hd-pane .rs-btn.hd-danger:hover{border-color:var(--neg);color:var(--neg)}",
          "@media(max-width:560px){.hd-pane .grid{grid-template-columns:1fr}}",
          ".hd-msg{font-size:12px;font-weight:700;min-height:16px}",
          ".hd-msg.ok{color:var(--pos)}.hd-msg.err{color:var(--neg)}",
          // -------- organization: the zipdispatch org.html chart, portal-skinned --------
          ".hd-org{overflow-x:auto;padding:8px 0 46px}",
          ".hd-tree{display:flex;flex-direction:column;align-items:center;min-width:max-content;margin:0 auto}",
          ".hd-leaders{display:flex;justify-content:center;padding-top:30px;position:relative}",
          ".hd-leaders::before{content:'';position:absolute;top:0;left:50%;border-left:2px solid var(--line-2);height:30px}",
          ".hd-col{position:relative;padding:30px 13px 0;display:flex;flex-direction:column;align-items:center}",
          ".hd-col::before,.hd-col::after{content:'';position:absolute;top:0;right:50%;border-top:2px solid var(--line-2);width:50%;height:30px}",
          ".hd-col::after{right:auto;left:50%;border-left:2px solid var(--line-2)}",
          ".hd-col:first-child::before,.hd-col:last-child::after{border:0 none}",
          ".hd-col:last-child::before{border-right:2px solid var(--line-2);border-radius:0 8px 0 0}",
          ".hd-col:first-child::after{border-radius:8px 0 0 0}",
          ".hd-col:only-child::before,.hd-col:only-child::after{border:0 none}",
          ".hd-tc{position:relative;width:204px;background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:10px 13px 9px;margin:6px 0;text-align:left;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.08),0 6px 18px rgba(0,0,0,.05)}",
          ".hd-tc:hover{border-color:var(--brand)}",
          ".hd-tc b{font-size:14px;display:block;line-height:1.3}",
          ".hd-tc b small{font-weight:600;color:var(--faint);font-size:10.5px;margin-left:4px}",
          ".hd-tc span{display:block;font-size:12px;color:var(--faint);margin-top:1px}",
          ".hd-tc span.also{color:var(--muted);font-style:italic}",
          ".hd-tc.lead{border-width:2px;padding-top:13px}",
          ".hd-crown{position:absolute;top:-8px;left:11px;background:var(--c,#4f46e5);color:#fff;font-size:8.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;padding:2px 8px;border-radius:999px;white-space:nowrap}",
          ".hd-tc:not(.lead){border-left:3px solid var(--c,#94a3b8)}",
          ".hd-tc:not(.top)::before{content:'';position:absolute;top:-9px;left:50%;height:8px;border-left:2px solid var(--line-2)}",
          ".hd-sub{margin-left:26px;display:flex;flex-direction:column;align-items:flex-start;position:relative}",
          ".hd-sub .hd-tc{width:186px}",
          ".hd-sub::before{content:'';position:absolute;left:-13px;top:-4px;bottom:24px;border-left:2px dashed var(--line-2)}",
          // an inline aside the kit has no word for: quieter than .rs-hint and it sits
          // NEXT TO a control rather than under the bar
          ".hd-dim{font-size:12.5px;color:var(--faint)}",
        ].join("\n");
        document.head.appendChild(st);
      }

      host.innerHTML = '<div class="hd">'
        + '<div class="rs-page-head"><h1>Team Directory</h1>'
        + "<p>Everyone at Zip to Zip. The office side is edited here and receives the "
        + "questionnaires; crew follows the crew Google Sheet.</p></div>"
        + '<div class="rs-kpis" id="hdKpis"></div>'
        + '<div class="rs-tabs" id="hdTabs"></div>'
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
        S.crewSheet = r[1].sheet_url || "";
        S.home = r[2];
      }

      var officeOnly = function () {
        return S.roster.filter(function (p) { return p.section !== "crew"; });
      };
      function paintKpis() {
        var office = officeOnly().filter(function (p) { return p.status === "active"; });
        var noEmail = office.filter(function (p) { return !p.email; });
        var crewAct = S.crew.filter(function (c) { return String(c.status).toLowerCase() === "active"; });
        var pub = (S.home.questionnaires || []).filter(function (q) { return q.status === "published"; });
        kpis.innerHTML =
          '<div class="kpi"><div class="l">office people</div><div class="v">' + office.length + "</div></div>"
          + '<div class="kpi' + (noEmail.length ? " warn" : "") + '"><div class="l">without an email yet</div>'
          + '<div class="v">' + noEmail.length + "</div></div>"
          + '<div class="kpi"><div class="l">active crew (sheet)</div><div class="v">' + crewAct.length + "</div></div>"
          + pub.map(function (q) {
              var done = (q.responses.submitted || 0) + (q.responses.resubmitted || 0);
              var pct = q.audience_size ? Math.round(done / q.audience_size * 100) : 0;
              return '<div class="kpi"><div class="l">' + esc(q.title.slice(0, 26)) + " filled</div>"
                + '<div class="v">' + done + " / " + q.audience_size + " · " + pct + "%</div></div>";
            }).join("");
      }

      function paintTabs() {
        tabsEl.innerHTML = [["people", "People"], ["org", "Organization"], ["crew", "Crew"]].map(function (t) {
          return '<button data-t="' + t[0] + '" class="rs-tab' + (S.tab === t[0] ? " on" : "") + '">' + t[1] + "</button>";
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
          return '<label class="rs-fld' + (wide ? " wide" : "") + '"><span>' + lab
            + '</span><input class="rs-inp" data-f="' + k + '" value="'
            + esc(v == null ? "" : v) + '"></label>';
        };
        // reports-to picks from the active people — a typed name with a typo silently
        // drops someone off the Organization chart, a dropdown cannot miss
        var bosses = officeOnly()
          .filter(function (x) { return x.status === "active" && x.name && x.id !== p.id; })
          .map(function (x) { return x.name; })
          .sort(function (a, b) { return a.localeCompare(b); });
        var sel = function (k, lab, v) {
          return '<label class="rs-fld"><span>' + lab + '</span><select class="rs-sel" data-f="' + k + '">'
            + '<option value="">— nobody —</option>'
            + bosses.map(function (n) {
                return '<option value="' + esc(n) + '"' + (n === (v || "") ? " selected" : "") + ">"
                  + esc(n) + "</option>";
              }).join("")
            // a stored name that no longer matches anyone stays selectable, visibly broken
            + (v && bosses.indexOf(v) < 0
                ? '<option value="' + esc(v) + '" selected>' + esc(v) + " (not on the list)</option>" : "")
            + "</select></label>";
        };
        var ovl = document.createElement("div");
        ovl.id = "hdOvl"; ovl.className = "hd-ovl";
        ovl.innerHTML = '<div class="hd-pane">'
          + '<div class="head">' + avatar(p.name ? p : { name: "+", department: p.department }, 40)
          + "<span style=\"flex:1\"><b>" + (p.id ? esc(p.name || "—") : "New person") + "</b>"
          + "<span>" + (p.id ? esc(p.title || p.department || "") : "joins the office list and every questionnaire audience") + "</span></span>"
          + '<button class="rs-btn" data-cx>✕</button></div>'
          + '<div class="grid">'
          + f("name", "Name", p.name)
          + f("alias", "Alias (sales name)", p.alias)
          + f("title", "Title", p.title)
          + f("department", "Department", p.department)
          + sel("reports_to", "Reports to", p.reports_to)
          + sel("also_reports_to", "Also reports to (dotted)", p.also_reports_to)
          + f("email", "Sign-in email (Google) — lets them receive and answer questionnaires", p.email, true)
          + "</div>"
          + '<div class="foot">'
          + '<button class="rs-btn pri" data-sv>Save</button>'
          + '<button class="rs-btn" data-cx2>Cancel</button>'
          + '<span style="flex:1"></span>'
          + (p.id ? '<button class="rs-btn hd-danger" data-tg>'
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
        return '<tr class="hd-p click' + (p.status === "active" ? "" : " off") + '" data-id="' + p.id + '">'
          + '<td class="pcell">' + avatar(p, 32)
          + "<span><b>" + esc(p.name || "—")
          + (p.alias ? '<small class="hd-dim"> · ' + esc(p.alias) + "</small>" : "") + "</b></span></td>"
          + "<td>" + esc(p.title || "—") + "</td>"
          + '<td class="muted">' + esc(p.reports_to || "—")
          + (p.also_reports_to ? ' <span title="dotted line">+ ' + esc(p.also_reports_to) + "</span>" : "")
          + "</td>"
          + '<td class="muted">' + (p.email ? esc(p.email)
                              : '<span class="rs-pill warn hd-noem">no email yet</span>') + "</td>"
          + '<td class="hd-act dim">' + (p.status === "active" ? "edit ›" : "inactive · edit ›") + "</td></tr>";
      }

      // ONE colgroup for every department table (fixed layout) — so Title, Reports to and
      // Email sit at identical x positions all the way down the page
      var PEOPLE_COLS = '<colgroup><col style="width:28%"><col style="width:22%">'
        + '<col style="width:20%"><col style="width:24%"><col style="width:6%"></colgroup>';
      function deptTable(rowsHtml) {
        return '<div class="rs-tablewrap"><table class="rs-table hd-fixed">' + PEOPLE_COLS
          + "<thead><tr><th>Person</th><th>Title</th><th>Reports to</th><th>Email</th><th></th>"
          + "</tr></thead><tbody>" + rowsHtml + "</tbody></table></div>";
      }

      function paintPeople() {
        var q2 = S.q.toLowerCase();
        var rows = officeOnly().filter(function (p) {
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
        var html = '<div class="rs-bar" style="margin-bottom:4px">'
          + '<button class="rs-btn pri" id="hdAdd">+ Add a person</button>'
          + '<input class="rs-inp" id="hdQ" placeholder="Find a person…" value="' + esc(S.q) + '" style="min-width:220px">'
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

      /* -------- Organization: the zipdispatch org.html chart, drawn from live data --------
       * CEO on top, one connector down, the classic T-branch row of leader columns, and
       * each column a vertical run of cards; a sub-manager's people hang off a dashed
       * indent under them. Leaders wear their department as a colored crown. */
      function paintOrg() {
        var act = officeOnly().filter(function (p) { return p.status === "active"; });
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
        function card(p, cls) {
          var c = deptColor(p.department);
          return '<div class="hd-tc ' + (cls || "") + '" style="--c:' + c + '" data-id="' + p.id + '">'
            + (cls && cls.indexOf("lead") >= 0
                ? '<span class="hd-crown" style="--c:' + c + '">' + esc(p.department || "") + "</span>" : "")
            + "<b>" + esc(p.name)
            + (p.alias ? "<small>· " + esc(p.alias) + "</small>" : "") + "</b>"
            + "<span>" + esc(p.title || "") + "</span>"
            + (p.also_reports_to ? '<span class="also">also → ' + esc(p.also_reports_to) + "</span>" : "")
            + "</div>";
        }
        // the cards for p's REPORTS (p itself is already drawn); anyone who manages
        // people gets their own dashed sub-indent. Depth cap + seen-set: a typo cycle
        // must never hang the page.
        function run(p, depth) {
          if (depth > 10) return "";
          var ks = kids[p.name.toLowerCase()] || [];
          return ks.map(function (c2) {
            var k2 = c2.name.toLowerCase();
            if (seen[k2]) return "";
            seen[k2] = 1;
            var sub = run(c2, depth + 1);
            return card(c2, "") + (sub ? '<div class="hd-sub">' + sub + "</div>" : "");
          }).join("");
        }
        var ceo = roots[0] || act[0];
        var html = '<div class="hd-org"><div class="hd-tree">';
        if (ceo) {
          seen[ceo.name.toLowerCase()] = 1;
          html += card(ceo, "lead top");
          var leaders = kids[ceo.name.toLowerCase()] || [];
          if (leaders.length) {
            html += '<div class="hd-leaders">' + leaders.map(function (L) {
              seen[L.name.toLowerCase()] = 1;
              var body = run(L, 1);
              return '<div class="hd-col">' + card(L, "lead top") + body + "</div>";
            }).join("") + "</div>";
          }
        }
        html += "</div>";
        var missed = act.filter(function (p) { return !seen[p.name.toLowerCase()]; });
        if (missed.length) {
          html += '<div class="hd-dept" style="margin-top:10px"><span class="dot" style="background:#94a3b8"></span>'
            + "<i>Not placed</i><em>" + missed.length + "</em></div>"
            + '<div class="hd-dim" style="margin:0 0 8px">Their “reports to” does not match anyone active — '
            + "fix the name and they join the chart.</div>"
            + '<div style="display:flex;gap:10px;flex-wrap:wrap">'
            + missed.map(function (p) { return card(p, "top"); }).join("") + "</div>";
        }
        html += "</div>";
        main.innerHTML = html;
        main.querySelectorAll(".hd-tc").forEach(function (c) {
          c.onclick = function () {
            var p = S.roster.filter(function (x) { return x.id === +c.dataset.id; })[0];
            if (p) openEditorModal(p);
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
        main.innerHTML = '<p class="rs-hint"><b>Crew is edited in the crew Google Sheet, not here.</b> '
          + "This list follows the sheet through the nightly pipeline — change someone there and "
          + "this page catches up on the next refresh.</p>"
          + '<div class="rs-bar" style="margin-bottom:12px">'
          + (S.crewSheet ? '<a class="rs-btn pri" href="' + esc(S.crewSheet)
              + '" target="_blank" rel="noopener" style="text-decoration:none">Open the Google Sheet ↗</a>' : "")
          + '<input class="rs-inp" id="hdQ" placeholder="Find a crew member…" value="' + esc(S.q) + '" style="min-width:220px">'
          + '<span class="hd-dim">' + rows.length + " people shown</span></div>"
          + '<div class="rs-tablewrap"><table class="rs-table hd-fixed">'
          + '<colgroup><col style="width:19%"><col style="width:12%"><col style="width:15%">'
          + '<col style="width:10%"><col style="width:8%"><col style="width:22%"><col style="width:14%"></colgroup>'
          + "<thead><tr><th>Name</th><th>Nickname</th><th>Role</th><th>Status</th>"
          + "<th>Base</th><th>Email</th><th>Phone</th></tr></thead><tbody>"
          + (rows.map(function (c) {
              var on = String(c.status).toLowerCase() === "active";
              return "<tr" + (on ? "" : ' style="opacity:.55"') + "><td><b>" + esc(c.name || "—") + "</b></td>"
                + "<td>" + esc(c.nickname || "—") + "</td>"
                + "<td>" + esc(c.role || "—") + "</td>"
                + '<td><span class="rs-pill ' + (on ? "ok" : "mute") + '">' + esc(c.status || "—") + "</span></td>"
                + "<td>" + esc(c.base || "—") + "</td>"
                + '<td class="muted">' + esc(c.email || "—") + "</td>"
                + '<td class="muted">' + esc(c.phone || "—") + "</td></tr>";
            }).join("") || '<tr><td colspan="7" class="dim" style="padding:14px">Nobody matches.</td></tr>')
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
