/* WORK — projects and requests, in the portal. Monday's replacement (plan:
 * docs/plans/2026-08-27-work-system-plan.md; his brief: "dont overcomplicate it").
 *
 * ONE ENGINE: every row is a work item. A REQUEST is just an item born in `Requested` —
 * filed from the portal or from the all-access link (request.html?t=…) — and triage
 * (Accept → Planned / Decline with a reason) is the head's call, admin-only for now.
 * TIME IS A FILTER, NOT A BOARD: Done/Declined/Dropped live in the archive tab forever;
 * there is no yearly clone and never will be.
 *
 * Open to EVERY signed-in employee (the /api/_work endpoint sits above the ACL gate, like
 * the HR questionnaire): using the company's own work tool must not depend on a grant.
 */
(function () {
  var STATUSES = ["Planned", "In Progress", "Stuck"];          // project board columns
  var T_STATUSES = ["New", "In Progress", "Waiting"];          // ticket board columns
  var ARCHIVE = ["Done", "Declined", "Dropped", "Resolved", "Rejected"];
  var TONE = { "Requested": "info", "Planned": "mute", "In Progress": "ok", "Stuck": "warn",
               "Done": "ok", "Declined": "bad", "Dropped": "mute",
               "New": "info", "Waiting": "warn", "Resolved": "ok", "Rejected": "mute" };
  var SEV_TONE = { "Critical": "bad", "Needs meeting": "warn", "Operational": "mute" };
  /* the labels Monday\u2019s ticket board actually uses \u2014 a datalist, not a closed
     list, so new ones can be typed */
  var LABELS = ["Damaged Items/Furniture", "Incorrect Estimate of the job", "TIP Request",
    "FLAT PRICE - issue", "Increased Price", "Stair Fee Not charged", "Late Arrival",
    "Violation of regulations", "Was Not Fully Paid", "Unloading before payment",
    "Investigation Required", "Crazy Customer", "Payment details were not explained",
    "charge was not reviewed with customer", "For informational purposes only"];
  var PRIO_TONE = { Critical: "bad", High: "bad", Medium: "warn", Low: "mute" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function injectStyle() {
    var old = document.getElementById("wtx-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "wtx-style";
    st.textContent = ""
      + ".wtx-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 16px}"
      + ".wtx-cols{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}"
      + "@media(max-width:1000px){.wtx-cols{grid-template-columns:1fr}}"
      + ".wtx-col{background:var(--panel-2);border:1px solid var(--line);border-radius:12px;"
      + "padding:10px}"
      + ".wtx-colh{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);padding:2px 4px 8px;display:flex;justify-content:space-between}"
      + ".wtx-card{background:var(--panel);border:1px solid var(--line);border-radius:10px;"
      + "padding:10px 12px;margin-bottom:8px;cursor:pointer;transition:border-color .12s}"
      + ".wtx-card:hover{border-color:var(--brand)}"
      + ".wtx-card b{display:block;font-size:13.5px;line-height:1.35;margin-bottom:5px}"
      + ".wtx-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:11px;"
      + "color:var(--faint)}"
      + ".wtx-late{color:var(--neg);font-weight:700}"
      + ".wtx-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:9px;color:var(--ink);padding:8px 11px;font-size:13px;"
      + "outline:0}"
      + ".wtx-in:focus{border-color:var(--brand)}"
      + ".wtx-form{display:grid;grid-template-columns:1fr 1fr;gap:11px 14px}"
      + ".wtx-form .full{grid-column:1/-1}"
      + ".wtx-form label{display:block;font-size:10.5px;font-weight:700;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 4px}"
      + ".wtx-form textarea{min-height:90px;resize:vertical}"
      + "@media(max-width:760px){.wtx-form{grid-template-columns:1fr}}"
      + ".wtx-overlay{position:fixed;inset:0;background:rgba(10,16,24,.45);z-index:60;"
      + "display:flex;justify-content:flex-end}"
      + ".wtx-drawer{width:min(640px,94vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:20px 22px;box-shadow:-12px 0 40px rgba(0,0,0,.25)}"
      + ".wtx-sub{display:flex;gap:8px;align-items:center;padding:5px 0;font-size:13.5px;"
      + "border-bottom:1px solid var(--line)}"
      + ".wtx-sub.done span{text-decoration:line-through;color:var(--faint)}"
      + ".wtx-sub .x{margin-left:auto;color:var(--faint);cursor:pointer}"
      + ".wtx-cmt{padding:7px 0;border-bottom:1px solid var(--line);font-size:13px;"
      + "line-height:1.5}"
      + ".wtx-cmt .who{font-size:11px;color:var(--faint);margin-bottom:2px}"
      + ".wtx-desc{font-size:13px;color:var(--muted);line-height:1.55;white-space:pre-wrap;"
      + "margin:8px 0 4px}"
      + ".wtx-reqrow{display:flex;gap:8px;margin-top:8px}"
      + ".wtx-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:80ch}"
      + ".wtx-link{font-size:12px;color:var(--brand);cursor:pointer;font-weight:700}";
    document.head.appendChild(st);
  }

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
  function post(payload) {
    return api("/api/_work", { method: "POST", body: JSON.stringify(payload) });
  }

  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Loading the board…</div>';
    var S = { tab: "board", dept: "All", data: null, edit: null };
    load(host, S);
  }
  function load(host, S) {
    api("/api/_work").then(function (j) { S.data = j; paint(host, S); })
      .catch(function (e) {
        host.innerHTML = '<div class="panel">Could not load — ' + esc(e.message) + "</div>";
      });
  }

  /* ------------------------------------------------------------------ shell */

  function paint(host, S) {
    var d = S.data;
    var inbox = d.items.filter(function (i) { return i.Status === "Requested"; });
    var nTix = d.items.filter(function (i) {
      return i.Kind === "ticket" && ARCHIVE.indexOf(i.Status) < 0;
    }).length;
    var tabs = [["board", "Board"],
                ["tickets", "Tickets" + (nTix ? " · " + nTix : "")],
                ["mine", "My work"]];
    if (d.can_triage) tabs.push(["inbox", "Inbox" + (inbox.length ? " · " + inbox.length : "")]);
    tabs.push(["archive", "Archive"]);

    var html = '<div class="rs-page-head"><h1>Work</h1>'
      + "<p>Projects and requests for every team — one board, one history. A request lands "
      + "in the Inbox, the head accepts it onto the board or declines it with a reason, and "
      + "the requester can always see where it stands.</p></div>"
      + '<div class="wtx-top"><div class="rs-seg">'
      + tabs.map(function (t) {
          return '<button class="' + (S.tab === t[0] ? "on" : "") + '" data-tab="' + t[0]
            + '">' + esc(t[1]) + "</button>";
        }).join("") + "</div>"
      + '<select class="wtx-in" id="wtxDept" style="width:auto">'
      + ["All"].concat(d.departments).map(function (x) {
          return '<option' + (S.dept === x ? " selected" : "") + ">" + esc(x) + "</option>";
        }).join("") + "</select>"
      + '<button class="rs-btn pri" id="wtxNew">'
      + (S.tab === "tickets" ? "New ticket" : "New item") + "</button>"
      + (d.can_triage && d.request_token
         ? '<span class="wtx-link" id="wtxShare">copy the request link</span>' : "")
      + "</div>"
      + '<div id="wtxBody"></div><div id="wtxEditor"></div>';
    host.innerHTML = '<div class="wtx">' + html + "</div>";

    host.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { S.tab = b.getAttribute("data-tab"); paint(host, S); };
    });
    host.querySelector("#wtxDept").onchange = function (e) {
      S.dept = e.target.value; paint(host, S);
    };
    host.querySelector("#wtxNew").onclick = function () {
      openEditor(host, S, null, S.tab === "tickets" ? "ticket" : "project");
    };
    var share = host.querySelector("#wtxShare");
    if (share) share.onclick = function () {
      var url = location.origin + location.pathname.replace(/index\.html$/, "")
        + "request.html?t=" + d.request_token;
      navigator.clipboard.writeText(url).then(function () {
        share.textContent = "copied ✔ — anyone with this link can file a request";
      });
    };

    var body = host.querySelector("#wtxBody");
    var items = d.items.filter(function (i) {
      return S.dept === "All" || i.Department === S.dept;
    });
    if (S.tab === "board") paintBoard(body, host, S, items.filter(function (i) {
      return i.Kind !== "ticket" && STATUSES.indexOf(i.Status) >= 0;
    }), STATUSES);
    else if (S.tab === "tickets") paintBoard(body, host, S, items.filter(function (i) {
      return i.Kind === "ticket" && T_STATUSES.indexOf(i.Status) >= 0;
    }), T_STATUSES);
    else if (S.tab === "mine") paintList(body, host, S, d.items.filter(function (i) {
      return (i.Assignees || "").indexOf(d.me) >= 0 && ARCHIVE.indexOf(i.Status) < 0;
    }), "Nothing assigned to you right now.");
    else if (S.tab === "inbox") paintInbox(body, host, S, inbox);
    else paintList(body, host, S, items.filter(function (i) {
      return ARCHIVE.indexOf(i.Status) >= 0;
    }), "Nothing archived yet.");
  }

  /* ------------------------------------------------------------------ views */

  function card(i, S) {
    var d = S.data;
    var sub = d.subs[i["Work Id"]];
    var late = i["Due Date"] && ARCHIVE.indexOf(i.Status) < 0
      && i["Due Date"] < new Date().toISOString().slice(0, 10);
    return '<div class="wtx-card" data-open="' + i["Work Id"] + '"><b>' + esc(i.Title) + "</b>"
      + '<div class="wtx-meta">'
      + (i.Kind === "ticket" && i.Label
         ? '<span class="rs-pill info">' + esc(i.Label) + "</span>" : "")
      + (i.Kind === "ticket" && i.Severity
         ? '<span class="rs-pill ' + (SEV_TONE[i.Severity] || "mute") + '">'
           + esc(i.Severity) + "</span>"
         : '<span class="rs-pill ' + (PRIO_TONE[i.Priority] || "mute") + '">'
           + esc(i.Priority) + "</span>")
      + (i["Job No"] ? "<span># " + esc(i["Job No"]) + "</span>" : "")
      + "<span>" + esc(i.Department) + "</span>"
      + (i.Assignees ? "<span>· " + esc(i.Assignees) + "</span>" : "")
      + (i["Due Date"] ? '<span class="' + (late ? "wtx-late" : "") + '">· due '
         + esc(String(i["Due Date"]).slice(0, 10)) + "</span>" : "")
      + (sub ? "<span>· ☑ " + sub.done + "/" + sub.n + "</span>" : "")
      + ((S.data.comments[i["Work Id"]] || 0) ? "<span>· 💬 "
         + S.data.comments[i["Work Id"]] + "</span>" : "")
      + "</div></div>";
  }

  function paintBoard(body, host, S, items, cols) {
    body.innerHTML = '<div class="wtx-cols">' + cols.map(function (st) {
      var list = items.filter(function (i) { return i.Status === st; });
      return '<div class="wtx-col"><div class="wtx-colh"><span>' + esc(st)
        + "</span><span>" + list.length + "</span></div>"
        + list.map(function (i) { return card(i, S); }).join("")
        + (list.length ? "" : '<div class="wtx-note" style="padding:4px">—</div>')
        + "</div>";
    }).join("") + "</div>";
    wireCards(body, host, S);
  }

  function paintList(body, host, S, items, emptyText) {
    if (!items.length) {
      body.innerHTML = '<div class="panel"><p class="wtx-note">' + esc(emptyText) + "</p></div>";
      return;
    }
    var rows = items.sort(function (a, b) {
      return String(a["Due Date"] || "9999").localeCompare(String(b["Due Date"] || "9999"));
    }).map(function (i) {
      return '<tr data-open="' + i["Work Id"] + '" style="cursor:pointer"><td class="strong">'
        + esc(i.Title) + "</td><td>" + esc(i.Department) + "</td>"
        + '<td><span class="rs-pill ' + (TONE[i.Status] || "mute") + '">' + esc(i.Status)
        + "</span></td>"
        + "<td>" + esc(i.Assignees || "—") + "</td>"
        + "<td>" + esc(String(i["Due Date"] || "—").slice(0, 10)) + "</td>"
        + "<td>" + esc(i.Requester || "") + "</td></tr>";
    }).join("");
    body.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>Item</th><th>Team</th><th>Status</th><th>Assigned</th>"
      + "<th>Due</th><th>Requested by</th></tr></thead><tbody>" + rows
      + "</tbody></table></div></div>";
    wireCards(body, host, S);
  }

  function paintInbox(body, host, S, inbox) {
    if (!inbox.length) {
      body.innerHTML = '<div class="panel"><p class="wtx-note">The inbox is clear — new '
        + "requests from the team land here.</p></div>";
      return;
    }
    body.innerHTML = inbox.map(function (i) {
      return '<div class="panel" style="margin-bottom:12px"><div class="panel-head"><div>'
        + '<div class="panel-title">' + esc(i.Title) + "</div>"
        + '<div class="wtx-meta" style="margin-top:4px"><span>' + esc(i.Requester || "?")
        + "</span><span>→ " + esc(i.Department) + "</span>"
        + '<span class="rs-pill ' + (PRIO_TONE[i.Priority] || "mute") + '">'
        + esc(i.Priority) + "</span><span>" + esc(String(i["Entered At"]).slice(0, 16))
        + "</span></div>"
        + (i.Description ? '<div class="wtx-desc">' + esc(i.Description) + "</div>" : "")
        + "</div></div>"
        + '<div class="wtx-reqrow">'
        + '<button class="rs-btn pri" data-accept="' + i["Work Id"] + '">Accept → board</button>'
        + '<button class="rs-btn" data-decline="' + i["Work Id"] + '">Decline…</button>'
        + '<button class="rs-btn" data-open="' + i["Work Id"] + '">Open</button>'
        + "</div></div>";
    }).join("");
    body.querySelectorAll("[data-accept]").forEach(function (b) {
      b.onclick = function () {
        // accepting also OPENS the item so the head assigns someone right away — an
        // accepted request with nobody on it is how boards rot
        post({ action: "status", work_id: +b.getAttribute("data-accept"),
               status: "Planned" })
          .then(function () { S.openAfter = +b.getAttribute("data-accept"); load(host, S); })
          .catch(function (e) { alert(e.message); });
      };
    });
    body.querySelectorAll("[data-decline]").forEach(function (b) {
      b.onclick = function () {
        var why = prompt("Why is it declined? The requester sees this.");
        if (!why) return;
        post({ action: "status", work_id: +b.getAttribute("data-decline"),
               status: "Declined", reason: why })
          .then(function () { load(host, S); })
          .catch(function (e) { alert(e.message); });
      };
    });
    wireCards(body, host, S);
  }

  function wireCards(body, host, S) {
    body.querySelectorAll("[data-open]").forEach(function (c) {
      c.onclick = function () { openDrawer(host, S, +c.getAttribute("data-open")); };
    });
  }

  /* ---------------------------------------------------------------- drawer */

  function openDrawer(host, S, wid) {
    var d = S.data;
    var i = d.items.filter(function (x) { return x["Work Id"] === wid; })[0];
    if (!i) return;
    var ov = document.createElement("div");
    ov.className = "wtx-overlay";
    ov.onclick = function (ev) { if (ev.target === ov) { ov.remove(); load(host, S); } };
    ov.innerHTML = '<div class="wtx-drawer"><div class="rs-loading">Opening…</div></div>';
    document.body.appendChild(ov);

    api("/api/_work?item=" + wid).then(function (j) {
      var det = j.detail || { subtasks: [], comments: [] };
      var dr = ov.querySelector(".wtx-drawer");
      var statusBtns = (i.Kind === "ticket"
          ? T_STATUSES.concat(["Resolved", "Rejected"])
          : STATUSES.concat(["Done", "Dropped"])).map(function (st) {
        return '<button class="rs-btn' + (i.Status === st ? " pri" : "") + '" data-st="'
          + st + '">' + esc(st) + "</button>";
      }).join(" ");
      dr.innerHTML = ''
        + '<div class="panel-head"><div><div class="panel-title">' + esc(i.Title) + "</div>"
        + '<div class="wtx-meta" style="margin-top:4px">'
        + '<span class="rs-pill ' + (TONE[i.Status] || "mute") + '">' + esc(i.Status)
        + "</span><span>" + esc(i.Department) + "</span>"
        + (i.Category ? "<span>· " + esc(i.Category) + "</span>" : "")
        + "<span>· by " + esc(i.Requester || "?") + "</span></div></div>"
        + '<div><button class="rs-btn" id="wtxEdit">Edit</button> '
        + '<button class="rs-btn" id="wtxClose">Close</button></div></div>'
        + (i["Declined Reason"] ? '<p class="wtx-note"><b>Declined:</b> '
           + esc(i["Declined Reason"]) + "</p>" : "")
        + (i.Description ? '<div class="wtx-desc">' + esc(i.Description) + "</div>" : "")
        + '<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0">' + statusBtns
        + "</div>"
        + '<div class="panel-title" style="margin-top:14px">Subtasks</div>'
        + '<div id="wtxSubs"></div>'
        + '<div class="wtx-reqrow"><input class="wtx-in" id="wtxSubNew" '
        + 'placeholder="add a subtask…"><button class="rs-btn" id="wtxSubAdd">Add</button></div>'
        + '<div class="panel-title" style="margin-top:18px">Updates</div>'
        + '<div id="wtxCmts"></div>'
        + '<div class="wtx-reqrow"><input class="wtx-in" id="wtxCmtNew" '
        + 'placeholder="write an update…"><button class="rs-btn" id="wtxCmtAdd">Post</button>'
        + "</div>";

      function paintSubs(subs) {
        ov.querySelector("#wtxSubs").innerHTML = subs.map(function (s) {
          return '<div class="wtx-sub' + (s.done ? " done" : "") + '">'
            + '<input type="checkbox" data-sid="' + s.id + '"' + (s.done ? " checked" : "")
            + "><span>" + esc(s.title)
            + (s.assignee ? ' <i style="color:var(--faint)">· ' + esc(s.assignee) + "</i>" : "")
            + '</span><span class="x" data-srm="' + s.id + '">✕</span></div>';
        }).join("") || '<p class="wtx-note">none</p>';
        ov.querySelectorAll("[data-sid]").forEach(function (cb) {
          cb.onchange = function () {
            post({ action: "subtask_set", work_id: wid, id: +cb.getAttribute("data-sid"),
                   done: cb.checked }).catch(function (e) { alert(e.message); });
          };
        });
        ov.querySelectorAll("[data-srm]").forEach(function (x) {
          x.onclick = function () {
            post({ action: "subtask_set", work_id: wid, id: +x.getAttribute("data-srm"),
                   removed: true }).then(function () { x.parentElement.remove(); })
              .catch(function (e) { alert(e.message); });
          };
        });
      }
      function paintCmts(cmts) {
        ov.querySelector("#wtxCmts").innerHTML = cmts.map(function (c) {
          return '<div class="wtx-cmt"><div class="who">' + esc(c.by) + " · " + esc(c.at)
            + "</div>" + esc(c.text) + "</div>";
        }).join("") || '<p class="wtx-note">no updates yet</p>';
      }
      paintSubs(det.subtasks); paintCmts(det.comments);

      ov.querySelector("#wtxClose").onclick = function () { ov.remove(); load(host, S); };
      ov.querySelector("#wtxEdit").onclick = function () {
        ov.remove(); openEditor(host, S, i);
      };
      ov.querySelectorAll("[data-st]").forEach(function (b) {
        b.onclick = function () {
          post({ action: "status", work_id: wid, status: b.getAttribute("data-st") })
            .then(function () { ov.remove(); load(host, S); })
            .catch(function (e) { alert(e.message); });
        };
      });
      ov.querySelector("#wtxSubAdd").onclick = function () {
        var t = ov.querySelector("#wtxSubNew").value.trim();
        if (!t) return;
        post({ action: "subtask_add", work_id: wid, title: t }).then(function () {
          api("/api/_work?item=" + wid).then(function (j2) {
            ov.querySelector("#wtxSubNew").value = "";
            paintSubs((j2.detail || {}).subtasks || []);
          });
        }).catch(function (e) { alert(e.message); });
      };
      ov.querySelector("#wtxCmtAdd").onclick = function () {
        var t = ov.querySelector("#wtxCmtNew").value.trim();
        if (!t) return;
        post({ action: "comment", work_id: wid, text: t }).then(function () {
          api("/api/_work?item=" + wid).then(function (j2) {
            ov.querySelector("#wtxCmtNew").value = "";
            paintCmts((j2.detail || {}).comments || []);
          });
        }).catch(function (e) { alert(e.message); });
      };
    }).catch(function (e) {
      ov.querySelector(".wtx-drawer").innerHTML = '<div class="panel">' + esc(e.message)
        + "</div>";
    });
  }

  /* ---------------------------------------------------------------- editor */

  function openEditor(host, S, item, kind) {
    var d = S.data;
    var isTicket = item ? item.Kind === "ticket" : kind === "ticket";
    var elt = host.querySelector("#wtxEditor");
    var v = item || { Title: "", Department: S.dept !== "All" ? S.dept : d.departments[0],
                      Category: "", Priority: "Medium", Assignees: "", "Job No": "",
                      Label: "", Severity: "", "Start Date": "", "Due Date": "",
                      Description: "" };
    function opts(list, cur, blank) {
      return (blank ? '<option value=""></option>' : "") + list.map(function (x) {
        return '<option' + (cur === x ? " selected" : "") + ">" + esc(x) + "</option>";
      }).join("");
    }
    var picked = String(v.Assignees || "").split(",").map(function (s) {
      return s.trim();
    }).filter(Boolean);
    elt.innerHTML = '<div class="panel" style="margin-top:16px"><div class="panel-head">'
      + '<div class="panel-title">'
      + (item ? "Edit — " + esc(item.Title) : (isTicket ? "New ticket" : "New item"))
      + "</div></div>"
      + '<div class="wtx-form">'
      + '<div class="full"><label>' + (isTicket ? "Customer / issue" : "Title")
      + '</label><input class="wtx-in" id="wTitle" '
      + 'maxlength="200" value="' + esc(v.Title) + '"></div>'
      + "<div><label>Team</label><select class=\"wtx-in\" id=\"wDept\">"
      + opts(d.departments, v.Department) + "</select></div>"
      + (isTicket
         ? '<div><label>Issue label</label><input class="wtx-in" id="wLabel" '
           + 'maxlength="60" list="wtxLabels" value="' + esc(v.Label || "") + '">'
           + '<datalist id="wtxLabels">' + LABELS.map(function (l) {
               return '<option value="' + esc(l) + '">';
             }).join("") + "</datalist></div>"
           + "<div><label>Severity</label><select class=\"wtx-in\" id=\"wSev\">"
           + opts(d.severities || [], v.Severity || "Operational") + "</select></div>"
         : "<div><label>Category</label><select class=\"wtx-in\" id=\"wCat\">"
           + opts(d.categories, v.Category, true) + "</select></div>"
           + "<div><label>Priority</label><select class=\"wtx-in\" id=\"wPrio\">"
           + opts(["Low", "Medium", "High", "Critical"], v.Priority) + "</select></div>")
      + '<div><label>Job #' + (isTicket ? "" : " (optional)")
      + '</label><div style="display:flex;gap:6px">'
      + '<input class="wtx-in" id="wJob" value="' + esc(v["Job No"] || "") + '">'
      + (isTicket ? '<button class="rs-btn" id="wLookup" title="fill from the warehouse">'
                    + "Look up</button>" : "")
      + '</div><div class="wtx-note" id="wJobInfo" style="margin-top:3px"></div></div>'
      + '<div><label>Start</label><input class="wtx-in" id="wStart" type="date" value="'
      + esc(String(v["Start Date"] || "").slice(0, 10)) + '"></div>'
      + '<div><label>Due</label><input class="wtx-in" id="wDue" type="date" value="'
      + esc(String(v["Due Date"] || "").slice(0, 10)) + '"></div>'
      + '<div class="full"><label>Assigned to (comma-separated, from the directory)</label>'
      + '<input class="wtx-in" id="wWho" list="wtxNames" value="' + esc(picked.join(", "))
      + '"><datalist id="wtxNames">' + d.roster.map(function (n) {
          return '<option value="' + esc(n) + '">';
        }).join("") + "</datalist></div>"
      + '<div class="full"><label>Description</label><textarea class="wtx-in" id="wDesc" '
      + 'maxlength="8000">' + esc(v.Description || "") + "</textarea></div>"
      + '<div class="full" style="display:flex;gap:8px">'
      + '<button class="rs-btn pri" id="wSave">' + (item ? "Save" : "Create") + "</button>"
      + '<button class="rs-btn" id="wCancel">Cancel</button>'
      + (item ? '<button class="rs-btn" id="wDelete" style="margin-left:auto">Delete</button>'
              : "")
      + "</div></div></div>";
    elt.scrollIntoView({ behavior: "smooth", block: "nearest" });

    elt.querySelector("#wCancel").onclick = function () { elt.innerHTML = ""; };
    var lk = elt.querySelector("#wLookup");
    if (lk) lk.onclick = function () {
      var j = elt.querySelector("#wJob").value.trim();
      if (!j) return;
      var info = elt.querySelector("#wJobInfo");
      info.textContent = "looking up…";
      api("/api/_work?job=" + encodeURIComponent(j)).then(function (r) {
        if (!r.job_info) { info.textContent = "job not found in the warehouse"; return; }
        var ji = r.job_info;
        info.textContent = [ji.customer, ji.job_date && ("moved " + ji.job_date),
                            ji.rep && ("rep " + ji.rep),
                            ji.foreman && ("foreman " + ji.foreman)]
          .filter(Boolean).join(" · ");
        var t = elt.querySelector("#wTitle");
        if (!t.value.trim() && ji.customer) t.value = ji.customer;
      }).catch(function (e) { info.textContent = e.message; });
    };
    var del = elt.querySelector("#wDelete");
    if (del) del.onclick = function () {
      if (!confirm("Delete this item? It disappears from every view (history is kept).")) return;
      post({ action: "delete", work_id: item["Work Id"] })
        .then(function () { elt.innerHTML = ""; load(host, S); })
        .catch(function (e) { alert(e.message); });
    };
    elt.querySelector("#wSave").onclick = function () {
      var payload = {
        action: item ? "update" : "create",
        kind: isTicket ? "ticket" : "project",
        work_id: item ? item["Work Id"] : undefined,
        title: elt.querySelector("#wTitle").value.trim(),
        department: elt.querySelector("#wDept").value,
        category: isTicket ? "" : elt.querySelector("#wCat").value,
        priority: isTicket ? "Medium" : elt.querySelector("#wPrio").value,
        label: isTicket ? elt.querySelector("#wLabel").value.trim() : "",
        severity: isTicket ? elt.querySelector("#wSev").value : "",
        job_no: elt.querySelector("#wJob").value.trim(),
        start: elt.querySelector("#wStart").value,
        due: elt.querySelector("#wDue").value,
        assignees: elt.querySelector("#wWho").value.split(",").map(function (s) {
          return s.trim();
        }).filter(Boolean),
        description: elt.querySelector("#wDesc").value.trim(),
      };
      post(payload).then(function () { elt.innerHTML = ""; load(host, S); })
        .catch(function (e) { alert(e.message); });
    };
  }

  if (window.registerPage) {
    registerPage({
      id: "work",
      group: "company",
      title: "Work",
      render: render,
    });
  }
})();
