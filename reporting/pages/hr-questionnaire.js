/* Company-Wide Questionnaire — HR's side of the Human Resources module (2026-08-17).
 *
 * Everything here talks to two dedicated endpoints (/api/_hrqadmin for HR, /api/_hrq only for
 * the preview) — no datasets, no global filters. The page is CAPABILITY-shaped: the server
 * says can_manage / can_results on the home payload and every button honours it, but the
 * buttons are cosmetics — the bridge re-checks per action.
 *
 * The question editor follows the Foreman Assessment questionnaire editor (the proven
 * DB-stored-questions UI): whole-form save, draft state, reorder, save-disabled-until-valid.
 * The one big lifecycle difference is deliberate: questions LOCK at publish, and changing a
 * published questionnaire means a NEW VERSION — the editor says so instead of allowing it.
 */
registerPage({
  id: "hr-questionnaire",
  group: "hr",
  title: "Company-Wide Questionnaire",
  datasets: [],
  async render(host) {
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__HQ || (window.__HQ = {
      view: "home", qid: null, qtab: "questions",
      home: null, q: null, roster: null, sub: null, res: null,
      draft: null, dirty: false, msg: "", msgErr: false,
      subFilter: "", subQ: "", resDept: "", resPerson: "", rosterQ: "",
    });

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
    function post(body) { return api("/api/_hrqadmin", { method: "POST", body: JSON.stringify(body) }); }

    /* ================================================================ style */
    if (!document.getElementById("hqCss")) {
      var st = document.createElement("style"); st.id = "hqCss";
      st.textContent = [
        ".hq{max-width:1180px;font-variant-numeric:tabular-nums}",
        ".hq-tabs{display:flex;gap:4px;margin:2px 0 16px}",
        ".hq-tabs button{font:inherit;font-size:13.5px;font-weight:750;color:var(--muted);background:transparent;border:0;border-radius:10px;padding:9px 16px;cursor:pointer}",
        ".hq-tabs button:hover{background:var(--panel-2);color:var(--ink)}",
        ".hq-tabs button.on{background:var(--brand);color:var(--brand-ink)}",
        ".hq-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:14px}",
        ".hq-card h4{margin:0 0 10px;font-size:15px;font-weight:800}",
        ".hq-dim{font-size:11.5px;color:var(--faint);line-height:1.55}",
        ".hq-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center}",
        ".hq-btn{font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 13px;cursor:pointer;white-space:nowrap}",
        ".hq-btn:hover{border-color:var(--brand);color:var(--brand)}",
        ".hq-btn.go{background:var(--brand);color:var(--brand-ink);border-color:var(--brand)}",
        ".hq-btn.go:hover{color:var(--brand-ink);filter:brightness(1.06)}",
        ".hq-btn.warn:hover{border-color:var(--red);color:var(--red)}",
        ".hq-btn:disabled{opacity:.5;cursor:default}",
        ".hq-pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;background:var(--panel-2);color:var(--muted)}",
        ".hq-pill.draft{background:rgba(122,138,153,.16)}",
        ".hq-pill.published{background:rgba(46,160,90,.16);color:var(--pos)}",
        ".hq-pill.closed{background:rgba(226,168,43,.16);color:var(--warn)}",
        ".hq-pill.archived{opacity:.6}",
        ".hq-qitem{display:flex;gap:14px;align-items:flex-start;justify-content:space-between;padding:13px 16px;border:1px solid var(--line);border-radius:12px;margin-bottom:9px;background:var(--panel);cursor:pointer}",
        ".hq-qitem:hover{border-color:var(--brand)}",
        ".hq-qitem b{font-size:14.5px}",
        ".hq-qitem .meta{font-size:11.5px;color:var(--faint);margin-top:3px}",
        ".hq-qitem .nums{text-align:right;font-size:12px;color:var(--muted);white-space:nowrap}",
        ".hq-tbl{width:100%;border-collapse:collapse;font-size:12.5px}",
        ".hq-tbl th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:0 10px 7px;border-bottom:1px solid var(--line);white-space:nowrap}",
        ".hq-tbl td{padding:8px 10px;border-bottom:1px solid var(--line);vertical-align:middle}",
        ".hq-tbl tr:last-child td{border-bottom:0}",
        ".hq-tbl td.r,.hq-tbl th.r{text-align:right}",
        ".hq-in,.hq-sel,.hq-ta{font:inherit;font-size:12.5px;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:8px;padding:7px 10px}",
        ".hq-in:focus,.hq-ta:focus{outline:none;border-color:var(--brand)}",
        ".hq-ta{width:100%;box-sizing:border-box;resize:vertical;min-height:56px}",
        ".hq-lab{display:block;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);margin:0 0 4px}",
        ".hq-field{margin-bottom:12px}",
        // question editor rows
        ".hq-ed{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:9px;background:var(--panel)}",
        ".hq-ed .top{display:flex;gap:8px;align-items:center;margin-bottom:8px}",
        ".hq-ed input.lbl{flex:1;font-weight:700}",
        ".hq-ed .mv{display:flex;flex-direction:column;gap:1px}",
        ".hq-ed .mv button{font-size:9px;line-height:1;padding:3px 6px;border:1px solid var(--line-2);background:var(--panel-2);color:var(--muted);border-radius:5px;cursor:pointer}",
        ".hq-ed .mv button:hover{color:var(--ink)}",
        ".hq-ed .sub{display:flex;flex-wrap:wrap;gap:8px;align-items:center}",
        ".hq-req{display:inline-flex;gap:6px;align-items:center;font-size:12px;color:var(--muted);cursor:pointer;white-space:nowrap}",
        ".hq-opts{width:100%;box-sizing:border-box;margin-top:8px}",
        ".hq-stickybar{position:sticky;bottom:14px;background:var(--panel);border:1px solid var(--line-2);border-radius:13px;box-shadow:0 12px 34px rgba(0,0,0,.25);padding:12px 18px;display:flex;gap:14px;align-items:center;z-index:5}",
        ".hq-msg{font-size:12.5px;font-weight:700}",
        ".hq-msg.err{color:var(--neg)}",
        ".hq-msg.ok{color:var(--pos)}",
        // results
        ".hq-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:14px}",
        ".hq-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:11px 15px}",
        ".hq-kpi b{display:block;font-size:24px;letter-spacing:-.5px}",
        ".hq-kpi span{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:4px}",
        ".hq-bar{display:grid;grid-template-columns:minmax(90px,220px) 1fr 64px;gap:10px;align-items:center;padding:4px 0;font-size:12.5px}",
        ".hq-bar .tr{height:10px;border-radius:6px;background:var(--panel-2);overflow:hidden}",
        ".hq-bar .tr i{display:block;height:100%;background:var(--brand);border-radius:6px}",
        ".hq-bar .n{text-align:right;color:var(--muted)}",
        ".hq-txt{border-left:3px solid var(--line-2);padding:6px 12px;margin:7px 0;font-size:12.5px;line-height:1.5}",
        ".hq-txt .who{font-size:11px;color:var(--faint);margin-top:3px}",
        ".hq-guide{max-width:760px;line-height:1.65;font-size:13.5px}",
        ".hq-guide h3{margin:22px 0 6px;font-size:15px}",
        ".hq-guide li{margin:5px 0}",
        ".hq-guide code{background:var(--panel-2);border-radius:5px;padding:1px 6px;font-size:12px}",
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="hq">'
      + '<div class="rs-page-head"><h1>Company-Wide Questionnaire</h1>'
      + "<p>HR builds the questions here, publishes, shares one link, and reads the results."
      + '<span class="freshness"> · questions live in the database — never in code</span></p></div>'
      + '<div class="hq-tabs" id="hqTabs"></div><div id="hqMain"></div></div>';
    var main = host.querySelector("#hqMain");
    var tabsEl = host.querySelector("#hqTabs");
    // Fresh mount = fresh state. The portal sidebar navigates by hashchange with no
    // page-leave hook, so the in-page confirm+discard guards can be bypassed entirely;
    // without this reset an abandoned edit came BACK on the next visit labeled "saved" —
    // on a published questionnaire it rendered questions that are not the real ones.
    S.dirty = false; S.draft = null; S.draftFor = null; S.msg = "";

    var DIRECT_LINK = location.origin + location.pathname + "#page=hr-my-questionnaire";
    var fmtPct = function (n, d) { return d ? Math.round(n / d * 100) + "%" : "—"; };
    // one corrupt stored value must not blank the whole Results tab
    var safeArr = function (v) { try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; } };
    var clampStar = function (v) { var n = Math.round(+v); return n >= 1 && n <= 5 ? n : 0; };
    // naive-UTC bridge stamp -> the picker's zone (the Z is load-bearing; see rs-core)
    var fmtWhen = function (s, dayOnly) {
      if (!s) return "";
      var d = new Date(String(s).replace(" ", "T") + "Z");
      if (isNaN(d)) return String(s);
      if (!(window.RS && RS.fmtTz)) return dayOnly ? d.toLocaleDateString() : d.toLocaleString();
      return dayOnly ? RS.fmtTzDay(d) : RS.fmtTzDay(d) + ", " + RS.fmtTz(d) + " " + RS.tzShort();
    };

    /* ================================================================ data loads */
    async function loadHome() { S.home = await api("/api/_hrqadmin?view=home"); }
    async function loadQ() { S.q = await api("/api/_hrqadmin?view=questionnaire&id=" + S.qid); }
    async function loadRoster() { S.roster = (await api("/api/_hrqadmin?view=roster")).roster; }
    async function loadSub() { S.sub = await api("/api/_hrqadmin?view=submissions&id=" + S.qid); }
    async function loadRes() { S.res = await api("/api/_hrqadmin?view=results&id=" + S.qid); }

    function toast(t, err) {
      S.msg = t; S.msgErr = !!err;
      var el = main.querySelector("#hqMsg");
      if (el) { el.textContent = t; el.className = "hq-msg " + (err ? "err" : "ok"); }
    }
    // Abandoning edits must clear the draft TOO, not just the flag — a kept draft
    // resurrects the "lost" edits on the next visit, labeled "saved".
    function discardDraft() { S.dirty = false; S.draft = null; S.draftFor = null; }

    /* ================================================================ tab bar */
    function paintTabs() {
      var T = [["home", "Questionnaires"], ["people", "People"], ["guide", "Guide"]];
      tabsEl.innerHTML = T.map(function (t) {
        return '<button data-t="' + t[0] + '" class="' + ((S.view === t[0] || (S.view === "q" && t[0] === "home")) ? "on" : "") + '">' + t[1] + "</button>";
      }).join("");
      tabsEl.querySelectorAll("button").forEach(function (b) {
        b.onclick = function () {
          if (S.dirty && !confirm("Unsaved question changes will be lost. Leave anyway?")) return;
          S.view = b.dataset.t; S.qid = null; discardDraft(); go();
        };
      });
    }

    /* ================================================================ home */
    async function paintHome() {
      await loadHome();
      var h = S.home, canM = h.can_manage;
      var html = '<div class="hq-row" style="margin-bottom:14px">'
        + (canM ? '<button class="hq-btn go" id="hqNew">+ New questionnaire</button>' : "")
        + '<button class="hq-btn" id="hqCopy">Copy the employee link</button>'
        + '<span class="hq-dim">' + h.roster_active + " people on the list · the link is the "
        + "same for everyone — each person sees what is assigned to them</span></div>"
        + (canM ? '<div class="hq-row hq-newrow" id="hqNewRow" style="display:none;margin-bottom:14px">'
          + '<input id="hqNewTitle" class="hq-in" style="min-width:320px" maxlength="200" '
          + 'placeholder="Title of the new questionnaire…">'
          + '<button class="hq-btn go" id="hqNewGo">Create draft</button>'
          + '<button class="hq-btn" id="hqNewNo">Cancel</button></div>' : "");
      if (!h.questionnaires.length) {
        html += '<div class="hq-card"><h4>Nothing here yet</h4><div class="hq-dim">'
          + (canM ? "Create the first questionnaire, add questions, add people under the "
                    + "People tab, then publish and share the link."
                  : "No questionnaires have been created yet.") + "</div></div>";
      }
      html += h.questionnaires.map(function (q) {
        var done = (q.responses.submitted || 0) + (q.responses.resubmitted || 0);
        return '<div class="hq-qitem" data-q="' + q.id + '"><div>'
          + "<b>" + esc(q.title) + "</b> "
          + '<span class="hq-pill ' + esc(q.status) + '">' + esc(q.status) + "</span>"
          + (q.version > 1 ? ' <span class="hq-dim">v' + q.version + "</span>" : "")
          + '<div class="meta">' + q.question_count + " questions · audience "
          + q.audience_size
          + (q.deadline ? " · deadline " + esc(q.deadline) : "")
          + (q.published_at ? " · published " + esc(fmtWhen(q.published_at, true)) : "")
          + "</div></div>"
          + '<div class="nums"><b style="font-size:17px">' + done + " / " + q.audience_size + "</b>"
          + "<br>submitted · " + fmtPct(done, q.audience_size) + "</div></div>";
      }).join("");
      html += '<div class="hq-msg" id="hqMsg" style="margin-top:8px"></div>';
      main.innerHTML = html;
      var nb = main.querySelector("#hqNew");
      if (nb) {
        var row = main.querySelector("#hqNewRow"), tIn = main.querySelector("#hqNewTitle");
        var creating = false;
        var create = async function () {
          var t = tIn.value.trim();
          if (!t) { tIn.focus(); return; }
          if (creating) return;                  // a double-click must not mint two drafts
          creating = true;
          try { var r = await post({ action: "create", title: t }); S.view = "q"; S.qid = r.id; S.qtab = "questions"; go(); }
          catch (e) { creating = false; toast(e.message, true); }
        };
        nb.onclick = function () { row.style.display = ""; tIn.focus(); };
        main.querySelector("#hqNewGo").onclick = create;
        tIn.onkeydown = function (ev) { if (ev.key === "Enter") create(); };
        main.querySelector("#hqNewNo").onclick = function () { row.style.display = "none"; tIn.value = ""; };
      }
      main.querySelector("#hqCopy").onclick = function () {
        navigator.clipboard.writeText(DIRECT_LINK).then(
          function () { toast("Link copied — share it anywhere"); },
          function () { toast("Could not copy — the link is " + DIRECT_LINK, true); });
      };
      main.querySelectorAll(".hq-qitem").forEach(function (el) {
        el.onclick = function () { S.view = "q"; S.qid = +el.dataset.q; S.qtab = "questions"; S.dirty = false; go(); };
      });
    }

    /* ================================================================ one questionnaire */
    async function paintQ() {
      await loadQ();
      var q = S.q, canM = S.home && S.home.can_manage, canR = S.home && S.home.can_results;
      var lifecycle = "";
      if (canM) {
        if (q.status === "draft") lifecycle = '<button class="hq-btn go" data-lc="publish">Publish</button>'
          + '<button class="hq-btn warn" data-lc="archive">Archive draft</button>';
        else if (q.status === "published") lifecycle = '<button class="hq-btn warn" data-lc="close">Close</button>'
          + '<button class="hq-btn" data-lc="new_version">New version</button>';
        else if (q.status === "closed") lifecycle = '<button class="hq-btn" data-lc="new_version">New version</button>'
          + '<button class="hq-btn warn" data-lc="archive">Archive</button>';
      }
      var subtabs = [["questions", "Questions"], ["settings", "Settings"], ["submissions", "Submissions"]]
        .concat(canR ? [["results", "Results"]] : []);
      main.innerHTML =
        '<div class="hq-row" style="margin-bottom:12px">'
        + '<button class="hq-btn" id="hqBack">← All questionnaires</button>'
        + "<b style=\"font-size:17px\">" + esc(q.title) + "</b>"
        + '<span class="hq-pill ' + esc(q.status) + '">' + esc(q.status) + "</span>"
        + (q.version > 1 ? '<span class="hq-dim">version ' + q.version + "</span>" : "")
        + '<span style="flex:1"></span>' + lifecycle
        + '<button class="hq-btn" id="hqCopy2">Copy the employee link</button></div>'
        + '<div class="hq-tabs" style="margin-bottom:12px">' + subtabs.map(function (t) {
            return '<button data-st="' + t[0] + '" class="' + (S.qtab === t[0] ? "on" : "") + '">' + t[1] + "</button>";
          }).join("") + "</div>"
        + '<div id="hqQBody"></div>'
        + '<div class="hq-msg" id="hqMsg" style="margin-top:8px"></div>';
      main.querySelector("#hqBack").onclick = function () {
        if (S.dirty && !confirm("Unsaved question changes will be lost. Leave anyway?")) return;
        S.view = "home"; S.qid = null; discardDraft(); go();
      };
      main.querySelector("#hqCopy2").onclick = function () {
        navigator.clipboard.writeText(DIRECT_LINK).then(
          function () { toast("Link copied"); },
          function () { toast("Could not copy — the link is " + DIRECT_LINK, true); });
      };
      main.querySelectorAll("[data-lc]").forEach(function (b) {
        b.onclick = async function () {
          var a = b.dataset.lc;
          if (S.dirty) {           // publishing over unsaved edits would lock the OLD questions
            toast("You have unsaved question edits — save them (or leave and come back) first", true);
            return;
          }
          var warn = { publish: "Publish? Questions lock and the questionnaire goes live to its audience.",
                       close: "Close? Nobody will be able to submit any more.",
                       archive: q.status === "draft"
                         ? "Archive this draft? It leaves the list and can never be published."
                         : "Archive? It disappears from the employee page entirely.",
                       new_version: "Create a new draft version with the same questions?" }[a];
          if (!confirm(warn)) return;
          try {
            var r = await post({ action: a, id: q.id });
            discardDraft();
            if (a === "new_version") { S.qid = r.id; S.qtab = "questions"; }
            if (a === "archive" && q.status === "draft") { S.view = "home"; S.qid = null; }
            go();
          } catch (e) { toast(e.message, true); }
        };
      });
      main.querySelectorAll("[data-st]").forEach(function (b) {
        b.onclick = function () {
          if (S.dirty && !confirm("Unsaved question changes will be lost. Leave anyway?")) return;
          S.qtab = b.dataset.st; discardDraft(); go();
        };
      });
      var body = main.querySelector("#hqQBody");
      if (S.qtab === "questions") paintQuestions(body, q, canM);
      else if (S.qtab === "settings") paintSettings(body, q, canM);
      else if (S.qtab === "submissions") await paintSubmissions(body, canR);
      else if (S.qtab === "results") await paintResults(body);
    }

    /* ================================================================ questions editor */
    var TYPE_LABEL = { stars5: "★ Rating 1–5", single: "Single choice",
                       multi: "Multiple choice", short_text: "Short text", long_text: "Long text" };
    function slugify(label, taken) {
      var base = String(label).toLowerCase().replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "").slice(0, 32) || "q";
      if (!/^[a-z]/.test(base)) base = "q_" + base;
      while (base.length < 3) base += "_q";      // the server requires 3-40 chars
      var k = base, i = 2;
      while (taken.has(k)) k = (base.slice(0, 29) + "_" + i++);
      return k;
    }
    function paintQuestions(body, q, canM) {
      var locked = q.status !== "draft" || !canM;
      if (!S.draft || S.draftFor !== q.id) {
        S.draft = q.questions.filter(function (x) { return x.active; }).map(function (x) {
          return { qkey: x.qkey, label: x.label, description: x.description || "",
                   qtype: x.qtype, options: (x.options || []).slice(), required: x.required };
        });
        S.draftFor = q.id; S.dirty = false;
      }
      var d = S.draft;
      var html = locked
        ? '<div class="hq-dim" style="margin-bottom:12px">Questions are locked on a '
          + esc(q.status) + " questionnaire — answers already point at these exact words. "
          + (canM ? "Use <b>New version</b> to change them going forward." : "") + "</div>"
        : '<div class="hq-dim" style="margin-bottom:12px">Everything saves as ONE form — '
          + "edit freely, then press Save. A question removed here is retired, never deleted.</div>";
      html += d.map(function (item, i) {
        var dis = locked ? " disabled" : "";
        return '<div class="hq-ed" data-i="' + i + '"><div class="top">'
          + '<div class="mv"><button data-mv="up" title="Move up"' + (i === 0 ? " disabled" : "") + '>▲</button>'
          + '<button data-mv="dn" title="Move down"' + (i === d.length - 1 ? " disabled" : "") + '>▼</button></div>'
          + '<input class="hq-in lbl" data-f="label" value="' + esc(item.label) + '" placeholder="The question, as the employee reads it"' + dis + ">"
          + '<select class="hq-sel" data-f="qtype"' + (locked ? " disabled" : "") + ">"
          + Object.keys(TYPE_LABEL).map(function (t) {
              return '<option value="' + t + '"' + (item.qtype === t ? " selected" : "") + ">" + TYPE_LABEL[t] + "</option>";
            }).join("") + "</select>"
          + '<label class="hq-req"><input type="checkbox" data-f="required"' + (item.required ? " checked" : "") + dis + ">required</label>"
          + (locked ? "" : '<button class="hq-btn warn" data-rm title="Remove">✕</button>')
          + "</div>"
          + '<input class="hq-in" style="width:100%;box-sizing:border-box" data-f="description" value="' + esc(item.description) + '" placeholder="Optional help text under the question"' + dis + ">"
          + (item.qtype === "single" || item.qtype === "multi"
              ? '<textarea class="hq-ta hq-opts" data-f="options" placeholder="One choice per line (at least 2)"' + dis + ">"
                + esc((item.options || []).join("\n")) + "</textarea>"
              : "")
          + "</div>";
      }).join("");
      if (!locked) {
        html += '<div class="hq-row"><button class="hq-btn" id="hqAdd">+ Add a question</button></div>'
          + '<div class="hq-stickybar"><span class="hq-dim">' + d.length + " question" + (d.length === 1 ? "" : "s")
          + ' · <span id="hqDirty">' + (S.dirty ? "unsaved changes" : "saved") + "</span></span>"
          + '<span style="flex:1"></span>'
          + '<button class="hq-btn go" id="hqSaveQ"' + (d.length ? "" : " disabled") + ">Save questions</button></div>";
      }
      body.innerHTML = html;
      if (locked) return;
      var mark = function () { S.dirty = true; var el = body.querySelector("#hqDirty"); if (el) el.textContent = "unsaved changes"; };
      body.querySelectorAll(".hq-ed").forEach(function (row) {
        var i = +row.dataset.i;
        row.querySelectorAll("[data-f]").forEach(function (inp) {
          var f = inp.dataset.f;
          inp.oninput = function () {
            if (f === "options") d[i].options = inp.value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
            else if (f === "required") d[i].required = inp.checked;
            else d[i][f] = inp.value;
            mark();
          };
          if (f === "qtype") inp.onchange = function () { d[i].qtype = inp.value; mark(); paintQuestions(body, q, canM); };
        });
        row.querySelectorAll("[data-mv]").forEach(function (b) {
          b.onclick = function () {
            var j = b.dataset.mv === "up" ? i - 1 : i + 1;
            var t = d[i]; d[i] = d[j]; d[j] = t; mark(); paintQuestions(body, q, canM);
          };
        });
        var rm = row.querySelector("[data-rm]");
        if (rm) rm.onclick = function () { d.splice(i, 1); mark(); paintQuestions(body, q, canM); };
      });
      body.querySelector("#hqAdd").onclick = function () {
        d.push({ qkey: null, label: "", description: "", qtype: "stars5", options: [], required: false });
        mark(); paintQuestions(body, q, canM);
        var rows = body.querySelectorAll(".hq-ed .lbl"); rows[rows.length - 1].focus();
      };
      body.querySelector("#hqSaveQ").onclick = async function () {
        // `taken` must include RETIRED server-side keys too (q.questions has them all):
        // reusing a retired key would resurrect that question's history under a new label
        var taken = new Set(d.filter(function (x) { return x.qkey; }).map(function (x) { return x.qkey; }));
        (q.questions || []).forEach(function (x) { taken.add(x.qkey); });
        var payload = d.map(function (x) {
          if (!x.qkey) { x.qkey = slugify(x.label, taken); taken.add(x.qkey); }
          return { qkey: x.qkey, label: x.label, description: x.description,
                   qtype: x.qtype, options: x.options, required: x.required };
        });
        for (var pi = 0; pi < payload.length; pi++) {
          if (!payload[pi].label.trim()) { toast("Question " + (pi + 1) + " needs a label", true); return; }
          if ((payload[pi].qtype === "single" || payload[pi].qtype === "multi")
              && (payload[pi].options || []).filter(Boolean).length < 2) {
            toast("'" + (payload[pi].label.slice(0, 40)) + "' needs at least 2 choices", true); return;
          }
        }
        try {
          await post({ action: "save_questions", id: q.id, questions: payload });
          S.dirty = false; toast("Saved — " + payload.length + " questions");
          var el = body.querySelector("#hqDirty"); if (el) el.textContent = "saved";
        } catch (e) { toast(e.message, true); }
      };
    }

    /* ================================================================ settings */
    function paintSettings(body, q, canM) {
      var draft = q.status === "draft";
      var lockNote = !canM ? "You can look, but changing settings needs manage access."
        : draft ? ""
        : q.status === "published" ? "Published: only the deadline and the audience can change — the words people answer under are locked."
        : "A " + q.status + " questionnaire is read-only.";
      // draft: everything editable; published: only the `also` fields (deadline, audience);
      // closed/archived: NOTHING — the old test left those controls live and the server
      // 409'd only after the user had already edited (post-merge audit, 2026-08-17)
      var dis = function (also) { return (!canM || !(draft || (q.status === "published" && also))) ? " disabled" : ""; };
      var depts = {};
      (S.roster || []).forEach(function (p) { if (p.department && p.status === "active") depts[p.department] = 1; });
      var audSig = function (k, arr) { return k + "|" + arr.slice().sort().join(","); };
      var aud0 = audSig(q.audience_kind, (q.audience_values || []).map(function (v) { return String(v).toLowerCase(); }));
      body.innerHTML =
        (lockNote ? '<div class="hq-dim" style="margin-bottom:12px">' + esc(lockNote) + "</div>" : "")
        + '<div class="hq-card"><h4>Wording</h4>'
        + '<div class="hq-field"><label class="hq-lab">Title</label><input class="hq-in" style="width:100%;box-sizing:border-box" id="hsTitle" value="' + esc(q.title) + '"' + dis() + "></div>"
        + '<div class="hq-field"><label class="hq-lab">Description (shown on the card)</label><textarea class="hq-ta" id="hsDesc"' + dis() + ">" + esc(q.description || "") + "</textarea></div>"
        + '<div class="hq-field"><label class="hq-lab">Instructions (shown above the questions)</label><textarea class="hq-ta" id="hsInstr"' + dis() + ">" + esc(q.instructions || "") + "</textarea></div>"
        + '<div class="hq-field"><label class="hq-lab">Confidentiality note (always visible to the employee)</label><textarea class="hq-ta" id="hsConf"' + dis() + ">" + esc(q.confidentiality || "") + "</textarea></div>"
        + "</div>"
        + '<div class="hq-card"><h4>Window</h4><div class="hq-row">'
        + '<span><label class="hq-lab">Opens</label><input type="date" class="hq-in" id="hsOpen" value="' + esc(q.opens_at || "") + '"' + dis() + "></span>"
        + '<span><label class="hq-lab">Deadline (inclusive)</label><input type="date" class="hq-in" id="hsDead" value="' + esc(q.deadline || "") + '"' + dis(true) + "></span>"
        + '<span class="hq-dim">Empty opens = live the moment it is published. Empty deadline = open until closed by hand.</span>'
        + "</div></div>"
        + '<div class="hq-card"><h4>Who receives it</h4>'
        + '<div class="hq-row" style="margin-bottom:10px">'
        + ["all", "departments", "emails"].map(function (k) {
            return '<label class="hq-req"><input type="radio" name="hsAud" value="' + k + '"'
              + (q.audience_kind === k ? " checked" : "") + dis(true) + ">"
              + { all: "Everyone on the People list", departments: "Chosen departments", emails: "Chosen people" }[k] + "</label>";
          }).join("")
        + "</div>"
        + '<div id="hsAudVals"></div></div>'
        + (canM ? '<div class="hq-row"><button class="hq-btn go" id="hsSave">Save settings</button></div>' : "");
      function paintAudVals() {
        var kind = (body.querySelector('input[name="hsAud"]:checked') || {}).value || q.audience_kind;
        var el = body.querySelector("#hsAudVals");
        if (kind === "all") { el.innerHTML = ""; return; }
        var picked = new Set((q.audience_values || []).map(function (v) { return v.toLowerCase(); }));
        var items = kind === "departments"
          ? Object.keys(depts).sort().map(function (dpt) { return { v: dpt.toLowerCase(), lab: dpt }; })
          : (S.roster || []).filter(function (p) { return p.status === "active"; })
              .map(function (p) { return { v: p.email, lab: (p.name ? p.name + " — " : "") + p.email }; });
        // stored audience members who are no longer active must stay VISIBLE and KEPT —
        // rendering only active rows made any settings save silently shrink the audience
        var known = new Set(items.map(function (it) { return it.v; }));
        picked.forEach(function (v) {
          if (!known.has(v)) items.push({ v: v, lab: v + " · no longer active on the People list" });
        });
        el.innerHTML = items.length
          ? items.map(function (it) {
              return '<label class="hq-req" style="display:block;padding:2px 0"><input type="checkbox" data-aud="'
                + esc(it.v) + '"' + (picked.has(it.v) ? " checked" : "") + dis(true) + "> " + esc(it.lab) + "</label>";
            }).join("")
          : '<div class="hq-dim">' + (kind === "departments"
              ? "No departments yet — set them on the People tab first."
              : "The People list is empty.") + "</div>";
      }
      paintAudVals();
      body.querySelectorAll('input[name="hsAud"]').forEach(function (r) { r.onchange = paintAudVals; });
      var sv = body.querySelector("#hsSave");
      if (sv) sv.onclick = async function () {
        var kind = (body.querySelector('input[name="hsAud"]:checked') || {}).value || q.audience_kind;
        var vals = [].map.call(body.querySelectorAll("[data-aud]:checked"), function (c) { return c.dataset.aud; });
        var payload = { action: "update_meta", id: q.id,
                        deadline: body.querySelector("#hsDead").value };
        // audience travels ONLY when it actually changed — a deadline-only save must
        // never re-state (and thereby reshape) the audience as a side effect
        if (audSig(kind, vals.map(function (v) { return String(v).toLowerCase(); })) !== aud0) {
          payload.audience_kind = kind; payload.audience_values = vals;
        }
        if (q.status === "draft") Object.assign(payload, {
          title: body.querySelector("#hsTitle").value,
          description: body.querySelector("#hsDesc").value,
          instructions: body.querySelector("#hsInstr").value,
          confidentiality: body.querySelector("#hsConf").value,
          opens_at: body.querySelector("#hsOpen").value,
        });
        try { await post(payload); toast("Settings saved"); go(); }
        catch (e) { toast(e.message, true); }
      };
    }

    /* ================================================================ submissions */
    async function paintSubmissions(body, canR) {
      await loadSub();
      var board = S.sub.board, counts = {};
      board.forEach(function (r) { counts[r.status] = (counts[r.status] || 0) + 1; });
      var done = (counts.submitted || 0) + (counts.resubmitted || 0);
      var order = { reopened: 0, in_progress: 1, not_started: 2, submitted: 3, resubmitted: 3 };
      var rows = board.slice().sort(function (a, b) {
        return (order[a.status] || 0) - (order[b.status] || 0)
          || String(a.department || "").localeCompare(String(b.department || ""))
          || String(a.name || a.email).localeCompare(String(b.name || b.email));
      }).filter(function (r) {
        if (S.subFilter && r.status !== S.subFilter) return false;
        if (S.subQ) {
          var q2 = S.subQ.toLowerCase();
          if ((r.name || "").toLowerCase().indexOf(q2) < 0 && r.email.indexOf(q2) < 0) return false;
        }
        return true;
      });
      var pill = function (s) {
        var map = { not_started: ["hq-pill", "not started"], in_progress: ["hq-pill closed", "in progress"],
                    submitted: ["hq-pill published", "submitted"], resubmitted: ["hq-pill published", "resubmitted"],
                    reopened: ["hq-pill draft", "reopened"] };
        var m = map[s] || ["hq-pill", esc(s)];
        return '<span class="' + m[0] + '">' + m[1] + "</span>";
      };
      body.innerHTML =
        '<div class="hq-kpis">'
        + '<div class="hq-kpi"><b>' + board.length + "</b><span>in the audience</span></div>"
        + '<div class="hq-kpi"><b>' + done + "</b><span>submitted</span></div>"
        + '<div class="hq-kpi"><b>' + (counts.in_progress || 0) + "</b><span>in progress</span></div>"
        + '<div class="hq-kpi"><b>' + (counts.not_started || 0) + "</b><span>not started</span></div>"
        + '<div class="hq-kpi"><b>' + fmtPct(done, board.length) + "</b><span>completion</span></div></div>"
        + '<div class="hq-row" style="margin-bottom:10px">'
        + '<select class="hq-sel" id="hbF"><option value="">Every status</option>'
        + ["not_started", "in_progress", "submitted", "resubmitted", "reopened"].map(function (s) {
            return '<option value="' + s + '"' + (S.subFilter === s ? " selected" : "") + ">" + s.replace("_", " ") + "</option>";
          }).join("") + "</select>"
        + '<input class="hq-in" id="hbQ" placeholder="Find a person…" value="' + esc(S.subQ) + '"></div>'
        + '<div class="hq-card" style="padding:0"><table class="hq-tbl"><thead><tr>'
        + "<th>Person</th><th>Department</th><th>Status</th><th>Submitted</th><th></th></tr></thead><tbody>"
        + (rows.map(function (r) {
            return "<tr><td><b>" + esc(r.name || r.email) + "</b>"
              + (r.name ? '<div class="hq-dim">' + esc(r.email) + "</div>" : "") + "</td>"
              + "<td>" + esc(r.department || "—") + "</td>"
              + "<td>" + pill(r.status)
              + (r.reopened_by ? ' <span class="hq-dim">by ' + esc(String(r.reopened_by).split("@")[0]) + "</span>" : "") + "</td>"
              + "<td>" + (r.submitted_at ? esc(fmtWhen(r.submitted_at)) : "—") + "</td>"
              + "<td class=\"r\">" + ((canR && (r.status === "submitted" || r.status === "resubmitted"))
                  ? '<button class="hq-btn" data-ro="' + esc(r.email) + '">Reopen</button>' : "") + "</td></tr>";
          }).join("") || '<tr><td colspan="5" class="hq-dim" style="padding:14px">Nobody matches.</td></tr>')
        + "</tbody></table></div>";
      body.querySelector("#hbF").onchange = function () { S.subFilter = this.value; paintSubmissions(body, canR); };
      var qi = body.querySelector("#hbQ");
      qi.oninput = function () {
        S.subQ = this.value; var at = this.selectionStart;
        paintSubmissions(body, canR).then(function () {
          var n = body.querySelector("#hbQ"); if (n) { n.focus(); n.setSelectionRange(at, at); }
        });
      };
      body.querySelectorAll("[data-ro]").forEach(function (b) {
        b.onclick = async function () {
          if (!confirm("Reopen for " + b.dataset.ro + "? They will be able to change and resubmit their answers. This is recorded.")) return;
          try { await post({ action: "reopen", id: S.qid, email: b.dataset.ro }); paintSubmissions(body, canR); }
          catch (e) { toast(e.message, true); }
        };
      });
    }

    /* ================================================================ results */
    async function paintResults(body) {
      await loadRes();
      var R = S.res, questions = R.questions.filter(function (x) { return x.active; });
      var subs = R.individuals.filter(function (r) { return r.status === "submitted" || r.status === "resubmitted"; });
      var depts = [...new Set(subs.map(function (r) { return r.department || "—"; }))].sort();
      var view = S.resDept ? subs.filter(function (r) { return (r.department || "—") === S.resDept; }) : subs;
      var qById = {}; R.questions.forEach(function (x) { qById[x.id] = x; });
      var html = '<div class="hq-kpis">'
        + '<div class="hq-kpi"><b>' + R.audience_size + "</b><span>audience</span></div>"
        + '<div class="hq-kpi"><b>' + subs.length + "</b><span>submitted</span></div>"
        + '<div class="hq-kpi"><b>' + fmtPct(subs.length, R.audience_size) + "</b><span>completion</span></div>"
        + '<div class="hq-kpi"><b>' + (R.individuals.length - subs.length) + "</b><span>reopened / pending</span></div></div>"
        + '<div class="hq-row" style="margin-bottom:12px">'
        + '<select class="hq-sel" id="hrDept"><option value="">All departments</option>'
        + depts.map(function (dpt) { return '<option' + (S.resDept === dpt ? " selected" : "") + ">" + esc(dpt) + "</option>"; }).join("")
        + "</select>"
        + '<select class="hq-sel" id="hrWho"><option value="">Aggregate — everyone</option>'
        + view.map(function (r) { return '<option value="' + esc(r.email) + '"' + (S.resPerson === r.email ? " selected" : "") + ">" + esc(r.name || r.email) + "</option>"; }).join("")
        + "</select>"
        + '<span style="flex:1"></span><button class="hq-btn" id="hrCsv">Download CSV</button></div>';

      if (S.resPerson) {
        var person = view.filter(function (r) { return r.email === S.resPerson; })[0];
        if (!person) { S.resPerson = ""; return paintResults(body); }
        html += '<div class="hq-card"><h4>' + esc(person.name || person.email)
          + ' <span class="hq-dim">' + esc(person.department || "") + " · submitted "
          + esc(fmtWhen(person.submitted_at)) + "</span></h4>"
          + questions.map(function (qq) {
              var v = person.answers[qq.id];
              var shown = v == null || v === "" ? '<span class="hq-dim">— not answered</span>'
                : qq.qtype === "multi" ? esc(safeArr(v).join(", "))
                : qq.qtype === "stars5" ? "★".repeat(clampStar(v)) + '<span class="hq-dim"> (' + esc(v) + "/5)</span>"
                : esc(v);
              return '<div class="hq-txt"><b>' + esc(qq.label) + "</b><br>" + shown + "</div>";
            }).join("") + "</div>";
      } else {
        html += questions.map(function (qq) {
          var vals = view.map(function (r) { return r.answers[qq.id]; })
            .filter(function (v) { return v != null && v !== ""; });
          var inner;
          if (qq.qtype === "stars5") {
            var nums = vals.map(Number).filter(function (n) { return n >= 1 && n <= 5; });
            var avg = nums.length ? (nums.reduce(function (a, b) { return a + b; }, 0) / nums.length) : null;
            var dist = [1, 2, 3, 4, 5].map(function (s) { return nums.filter(function (n) { return n === s; }).length; });
            var mx = Math.max.apply(null, dist.concat([1]));
            inner = '<div class="hq-dim" style="margin-bottom:6px">average <b style="color:var(--ink)">'
              + (avg == null ? "—" : avg.toFixed(2)) + "</b> of 5 · " + nums.length + " answers</div>"
              + [5, 4, 3, 2, 1].map(function (s2) {
                  var n = dist[s2 - 1];
                  return '<div class="hq-bar"><span>' + "★".repeat(s2) + '</span><span class="tr"><i style="width:'
                    + Math.round(n / mx * 100) + '%"></i></span><span class="n">' + n + "</span></div>";
                }).join("");
          } else if (qq.qtype === "single" || qq.qtype === "multi") {
            var counts2 = {};
            (qq.options || []).forEach(function (o) { counts2[o] = 0; });
            vals.forEach(function (v) {
              (qq.qtype === "multi" ? safeArr(v) : [v]).forEach(function (o) {
                if (o in counts2) counts2[o]++;
              });
            });
            var mx2 = Math.max.apply(null, Object.keys(counts2).map(function (k) { return counts2[k]; }).concat([1]));
            inner = '<div class="hq-dim" style="margin-bottom:6px">' + vals.length + " answers"
              + (qq.qtype === "multi" ? " · several choices allowed" : "") + "</div>"
              + (qq.options || []).map(function (o) {
                  return '<div class="hq-bar"><span>' + esc(o) + '</span><span class="tr"><i style="width:'
                    + Math.round(counts2[o] / mx2 * 100) + '%"></i></span><span class="n">' + counts2[o]
                    + (vals.length ? " · " + Math.round(counts2[o] / vals.length * 100) + "%" : "") + "</span></div>";
                }).join("");
          } else {
            inner = vals.length
              ? view.filter(function (r) { return r.answers[qq.id]; }).map(function (r) {
                  return '<div class="hq-txt">' + esc(r.answers[qq.id])
                    + '<div class="who">' + esc(r.name || r.email) + (r.department ? " · " + esc(r.department) : "") + "</div></div>";
                }).join("")
              : '<div class="hq-dim">No written answers yet.</div>';
          }
          return '<div class="hq-card"><h4>' + esc(qq.label)
            + ' <span class="hq-dim" style="font-weight:600">' + TYPE_LABEL[qq.qtype] + "</span></h4>" + inner + "</div>";
        }).join("");
      }
      body.innerHTML = html;
      body.querySelector("#hrDept").onchange = function () { S.resDept = this.value; S.resPerson = ""; paintResults(body); };
      body.querySelector("#hrWho").onchange = function () { S.resPerson = this.value; paintResults(body); };
      body.querySelector("#hrCsv").onclick = function () {
        // the ld-planning CSV pattern — plus a formula guard: a leading = + - @ or tab
        // would execute in Excel on HR's machine, and answer text is employee-controlled
        var escC = function (v) {
          v = v == null ? "" : String(v);
          if (/^[=+\-@\t\r]/.test(v)) v = "'" + v;
          return /[",\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
        };
        var head = ["Email", "Name", "Department", "Status", "Submitted"].concat(questions.map(function (qq) { return qq.label; }));
        var lines = [head.map(escC).join(",")];
        view.forEach(function (r) {
          lines.push([r.email, r.name || "", r.department || "", r.status, r.submitted_at || ""]
            .concat(questions.map(function (qq) {
              var v = r.answers[qq.id];
              return v == null ? "" : qq.qtype === "multi" ? safeArr(v).join("; ") : v;
            })).map(escC).join(","));
        });
        var blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (S.q ? S.q.title.replace(/[^\w \-]+/g, "") : "questionnaire") + " results.csv";
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      };
    }

    /* ================================================================ people */
    async function paintPeople() {
      if (!(S.home && S.home.can_manage)) { main.innerHTML = '<div class="hq-dim">People management needs HR manage access.</div>'; return; }
      await loadRoster();
      var rows = S.roster.filter(function (p) {
        if (!S.rosterQ) return true;
        var q2 = S.rosterQ.toLowerCase();
        return p.email.indexOf(q2) >= 0 || (p.name || "").toLowerCase().indexOf(q2) >= 0
          || (p.department || "").toLowerCase().indexOf(q2) >= 0;
      });
      main.innerHTML =
        '<div class="hq-card"><h4>Add a person</h4>'
        + '<div class="hq-dim" style="margin-bottom:10px">Anyone here can open the questionnaire link and answer — '
        + "including people OUTSIDE the company domain (a personal gmail works). Being on this "
        + "list gives access to the questionnaire ONLY, never to any report.</div>"
        + '<div class="hq-row">'
        + '<input class="hq-in" id="hpEmail" placeholder="email@anywhere.com" style="min-width:230px">'
        + '<input class="hq-in" id="hpName" placeholder="Full name">'
        + '<input class="hq-in" id="hpDept" placeholder="Department" list="hpDeptList">'
        + '<datalist id="hpDeptList">' + [...new Set(S.roster.map(function (p) { return p.department; }).filter(Boolean))].sort()
            .map(function (dpt) { return "<option>" + esc(dpt) + "</option>"; }).join("") + "</datalist>"
        + '<button class="hq-btn go" id="hpAdd">Add</button></div>'
        + '<div class="hq-msg" id="hqMsg" style="margin-top:8px"></div></div>'
        + '<div class="hq-row" style="margin-bottom:10px"><input class="hq-in" id="hpQ" placeholder="Find…" value="' + esc(S.rosterQ) + '">'
        + '<span class="hq-dim">' + S.roster.filter(function (p) { return p.status === "active"; }).length
        + " active · " + S.roster.length + " total — people are deactivated, never deleted</span></div>"
        + '<div class="hq-card" style="padding:0"><table class="hq-tbl"><thead><tr>'
        + "<th>Email</th><th>Name</th><th>Department</th><th>Status</th><th></th></tr></thead><tbody>"
        + (rows.map(function (p) {
            return '<tr data-em="' + esc(p.email) + '"><td>' + esc(p.email) + "</td>"
              + '<td><input class="hq-in" data-pf="name" value="' + esc(p.name || "") + '" style="width:150px"></td>'
              + '<td><input class="hq-in" data-pf="department" value="' + esc(p.department || "") + '" list="hpDeptList" style="width:130px"></td>'
              + "<td>" + (p.status === "active" ? '<span class="hq-pill published">active</span>' : '<span class="hq-pill archived">inactive</span>') + "</td>"
              + '<td class="r"><button class="hq-btn" data-psave>Save</button> '
              + '<button class="hq-btn' + (p.status === "active" ? " warn" : "") + '" data-ptoggle>'
              + (p.status === "active" ? "Deactivate" : "Reactivate") + "</button></td></tr>";
          }).join("") || '<tr><td colspan="5" class="hq-dim" style="padding:14px">Nobody yet.</td></tr>')
        + "</tbody></table></div>";
      var qi = main.querySelector("#hpQ");
      qi.oninput = function () {
        S.rosterQ = this.value; var at = this.selectionStart;
        paintPeople().then(function () { var n = main.querySelector("#hpQ"); if (n) { n.focus(); n.setSelectionRange(at, at); } });
      };
      main.querySelector("#hpAdd").onclick = async function () {
        var em2 = main.querySelector("#hpEmail").value.trim().toLowerCase();
        if (!em2 || em2.indexOf("@") < 0) { toast("A real email is required", true); return; }
        try {
          await post({ action: "roster_upsert", email: em2, name: main.querySelector("#hpName").value.trim(),
                       department: main.querySelector("#hpDept").value.trim(), status: "active" });
          toast(em2 + " added"); paintPeople();
        } catch (e) { toast(e.message, true); }
      };
      main.querySelectorAll("tr[data-em]").forEach(function (tr) {
        var em2 = tr.dataset.em;
        var read = function () {
          var p = S.roster.filter(function (x) { return x.email === em2; })[0] || {};
          return { name: tr.querySelector('[data-pf="name"]').value.trim(),
                   department: tr.querySelector('[data-pf="department"]').value.trim(),
                   status: p.status };
        };
        tr.querySelector("[data-psave]").onclick = async function () {
          var v = read();
          try { await post({ action: "roster_upsert", email: em2, name: v.name, department: v.department, status: v.status }); toast(em2 + " saved"); paintPeople(); }
          catch (e) { toast(e.message, true); }
        };
        tr.querySelector("[data-ptoggle]").onclick = async function () {
          var v = read();
          var next = v.status === "active" ? "inactive" : "active";
          if (next === "inactive" && !confirm("Deactivate " + em2 + "? They lose questionnaire access; their past answers stay.")) return;
          try { await post({ action: "roster_upsert", email: em2, name: v.name, department: v.department, status: next }); paintPeople(); }
          catch (e) { toast(e.message, true); }
        };
      });
    }

    /* ================================================================ guide */
    function paintGuide() {
      main.innerHTML = '<div class="hq-card hq-guide">'
        + "<h3>1 · Put people on the list</h3>"
        + "<p>Open <b>People</b> and add everyone who should answer — email, name, department. "
        + "The email is how they sign in with Google, so it must be exactly theirs. People outside "
        + "the company (a personal gmail) work too: the list itself is their permission. "
        + "Being here opens the questionnaire only — never any report.</p>"
        + "<h3>2 · Build the questionnaire</h3>"
        + "<p>Create it under <b>Questionnaires</b>, add questions (ratings, choices, or text), "
        + "mark the must-answer ones <i>required</i>, and set the wording, window and audience under "
        + "<b>Settings</b>. Everything stays an editable draft until you publish.</p>"
        + "<h3>3 · Publish and share ONE link</h3>"
        + "<p>Publishing locks the questions and opens the questionnaire to its audience. Press "
        + "<b>Copy the employee link</b> and share it in Slack, email, anywhere — it is the same "
        + "link for everyone. Each person signs in with their own Google account and sees exactly "
        + "what is assigned to them. Answers save as they type; <b>Submit</b> makes the response "
        + "final and read-only for them.</p>"
        + "<h3>4 · Track and read</h3>"
        + "<p><b>Submissions</b> shows who has answered and who has not. <b>Results</b> shows "
        + "averages, distributions and every written answer, filterable by department, with a CSV "
        + "download. Responses are <b>not anonymous</b> and the employee page says so — the "
        + "wording is yours to edit in Settings.</p>"
        + "<h3>5 · Corrections</h3>"
        + "<p>If someone needs to fix a submitted answer, find them under Submissions and press "
        + "<b>Reopen</b> — they can then edit and resubmit, and the reopen is recorded with "
        + "your name. To change the questions after publishing, use <b>New version</b>: the old "
        + "version keeps its answers exactly as given, the new draft starts fresh.</p>"
        + "<h3>Who can do what</h3>"
        + "<ul><li><b>People on the list</b> — answer and see their own submissions. Nothing else.</li>"
        + "<li><b>HR (manage)</b> — this page: the list, the questions, publish/close, who has submitted.</li>"
        + "<li><b>HR (results)</b> — individual answers, statistics, reopen.</li>"
        + "<li><b>Admin</b> — everything, granted in Users &amp; Access as the “Human Resources” tile.</li></ul>"
        + "</div>";
    }

    /* ================================================================ router */
    async function go() {
      paintTabs();
      main.innerHTML = '<div class="rs-loading" style="padding:22px">Loading…</div>';
      try {
        if (!S.home) await loadHome();
        if (S.view === "people") { await loadRoster(); await paintPeople(); }
        else if (S.view === "guide") paintGuide();
        else if (S.view === "q" && S.qid) { if (!S.roster) try { await loadRoster(); } catch (e) {} await paintQ(); }
        else { S.view = "home"; await paintHome(); }
      } catch (e) {
        main.innerHTML = '<div class="hq-card"><b>Could not load</b><div class="hq-dim">' + esc(e.message || e) + "</div></div>";
      }
    }
    await go();
  },
});
