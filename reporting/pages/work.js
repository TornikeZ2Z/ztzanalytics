/* WORK — projects, requests and tickets in one board. Monday's replacement.
 * (plan: docs/plans/2026-08-27-work-system-plan.md · engine unchanged since P1/P3;
 * this file is the V2 FRONT-END after his verdict on V1: "it is awful - can you do it
 * better?" — so: real drag-and-drop kanban, a drawer for everything, optimistic updates
 * instead of full-page repaints, and no browser prompt()/alert() anywhere.)
 *
 * ONE ENGINE: every row is a work item; a REQUEST is an item born `Requested`, a TICKET
 * is the same item wearing Kind='ticket'. Triage stays the head's (admin) call. TIME IS A
 * FILTER, NOT A BOARD — the archive is a WHERE clause, never a yearly clone.
 *
 * /api/_work sits ABOVE the ACL gate (the _hrq precedent): every signed-in employee uses
 * this page, grants or not.
 */
(function () {
  var P_COLS = ["Planned", "In Progress", "Stuck", "Done"];
  var T_COLS = ["New", "In Progress", "Waiting", "Resolved"];
  var ARCHIVE = ["Done", "Declined", "Dropped", "Resolved", "Rejected"];
  var DONE_WINDOW_D = 21;              // "recently done" column horizon
  var TONE = { "Requested": "info", "Planned": "mute", "In Progress": "ok", "Stuck": "warn",
               "Done": "ok", "Declined": "bad", "Dropped": "mute",
               "New": "info", "Waiting": "warn", "Resolved": "ok", "Rejected": "mute" };
  var PRIO_TONE = { Critical: "bad", High: "bad", Medium: "warn", Low: "mute" };
  var SEV_TONE = { "Critical": "bad", "Needs meeting": "warn", "Operational": "mute" };
  var LABELS = ["Damaged Items/Furniture", "Incorrect Estimate of the job", "TIP Request",
    "FLAT PRICE - issue", "Increased Price", "Stair Fee Not charged", "Late Arrival",
    "Violation of regulations", "Was Not Fully Paid", "Unloading before payment",
    "Investigation Required", "Crazy Customer", "Payment details were not explained",
    "charge was not reviewed with customer", "For informational purposes only"];
  // the portal colour system's own accents, nothing new — cycled per department/avatar
  var HUES = ["brand", "blue", "pos", "warn", "neg", "muted"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function hueOf(s) {
    var h = 0; s = String(s || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }
  function initials(name) {
    var p = String(name || "").trim().split(/\s+/);
    return ((p[0] || "")[0] || "?").toUpperCase() + (((p[1] || "")[0]) || "").toUpperCase();
  }
  function today() { return new Date().toISOString().slice(0, 10); }
  function daysAgo(n) {
    var d = new Date(); d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }
  function fmtDate(v) {
    v = String(v || "").slice(0, 10);
    if (!v) return "";
    var d = new Date(v + "T12:00:00");
    return isNaN(d) ? v : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ------------------------------------------------------------------- css */

  function injectStyle() {
    var old = document.getElementById("wtx-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "wtx-style";
    st.textContent = ""
      + ".wtx{--wtx-brand:var(--brand);font-variant-numeric:tabular-nums}"
      + ".wtx-top{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin:0 0 12px}"
      + ".wtx-search{flex:0 1 240px;min-width:160px}"
      + ".wtx-chips{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 14px}"
      + ".wtx-chip{font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:999px;"
      + "border:1px solid var(--line);background:var(--panel);color:var(--muted);"
      + "cursor:pointer;transition:all .12s;user-select:none}"
      + ".wtx-chip:hover{border-color:var(--brand);color:var(--brand)}"
      + ".wtx-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".wtx-chip small{font-weight:600;opacity:.75;margin-left:4px}"
      // board
      + ".wtx-cols{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start}"
      + "@media(max-width:1200px){.wtx-cols{grid-template-columns:repeat(2,1fr)}}"
      + "@media(max-width:720px){.wtx-cols{grid-template-columns:1fr}}"
      + ".wtx-col{background:var(--panel-2);border:1px solid var(--line);border-radius:13px;"
      + "padding:9px;min-height:120px;transition:border-color .12s,background .12s}"
      + ".wtx-col.drop{border-color:var(--brand);background:var(--panel)}"
      + ".wtx-colh{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:800;"
      + "letter-spacing:.07em;text-transform:uppercase;color:var(--faint);padding:3px 5px 9px}"
      + ".wtx-colh i{width:8px;height:8px;border-radius:99px;background:var(--faint)}"
      + ".wtx-colh i.ok{background:var(--pos)}.wtx-colh i.warn{background:var(--warn)}"
      + ".wtx-colh i.bad{background:var(--neg)}.wtx-colh i.info{background:var(--blue)}"
      + ".wtx-colh i.mute{background:var(--faint)}"
      + ".wtx-colh b{margin-left:auto;font-size:11px;color:var(--muted)}"
      // cards
      + ".wtx-card{position:relative;background:var(--panel);border:1px solid var(--line);"
      + "border-radius:11px;padding:10px 12px 9px;margin-bottom:8px;cursor:pointer;"
      + "transition:border-color .12s,transform .12s,box-shadow .12s}"
      + ".wtx-card:hover{border-color:var(--brand);transform:translateY(-1px);"
      + "box-shadow:0 4px 14px rgba(0,0,0,.10)}"
      + ".wtx-card.drag{opacity:.45}"
      + ".wtx-card::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;"
      + "border-radius:0 3px 3px 0;background:var(--line-2)}"
      + ".wtx-card.hue-brand::before{background:var(--brand)}"
      + ".wtx-card.hue-blue::before{background:var(--blue)}"
      + ".wtx-card.hue-pos::before{background:var(--pos)}"
      + ".wtx-card.hue-warn::before{background:var(--warn)}"
      + ".wtx-card.hue-neg::before{background:var(--neg)}"
      + ".wtx-card.hue-muted::before{background:var(--muted)}"
      + ".wtx-card b{display:block;font-size:13.5px;line-height:1.35;margin-bottom:6px;"
      + "color:var(--ink)}"
      + ".wtx-tags{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:7px}"
      + ".wtx-tags .rs-pill{font-size:10px;padding:2px 8px}"
      + ".wtx-foot{display:flex;align-items:center;gap:7px;font-size:11px;color:var(--faint)}"
      + ".wtx-due{font-weight:700}"
      + ".wtx-due.late{color:var(--neg)}"
      + ".wtx-avs{display:flex;margin-left:auto}"
      + ".wtx-av{width:22px;height:22px;border-radius:99px;display:flex;align-items:center;"
      + "justify-content:center;font-size:9px;font-weight:800;color:#fff;margin-left:-6px;"
      + "border:2px solid var(--panel);background:var(--muted)}"
      + ".wtx-av.hue-brand{background:var(--brand)}.wtx-av.hue-blue{background:var(--blue)}"
      + ".wtx-av.hue-pos{background:var(--pos)}.wtx-av.hue-warn{background:var(--warn)}"
      + ".wtx-av.hue-neg{background:var(--neg)}.wtx-av.hue-muted{background:var(--muted)}"
      + ".wtx-prog{height:3px;border-radius:2px;background:var(--panel-2);overflow:hidden;"
      + "margin:7px 0 0}"
      + ".wtx-prog i{display:block;height:100%;background:var(--pos)}"
      // inputs
      + ".wtx-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:9px;color:var(--ink);padding:8px 11px;font-size:13px;"
      + "outline:0;transition:border-color .12s}"
      + ".wtx-in:focus{border-color:var(--brand)}"
      + "textarea.wtx-in{min-height:88px;resize:vertical}"
      // drawer
      + ".wtx-overlay{position:fixed;inset:0;background:rgba(10,16,24,.45);z-index:60;"
      + "display:flex;justify-content:flex-end;animation:wtxFade .15s ease}"
      + "@keyframes wtxFade{from{opacity:0}to{opacity:1}}"
      + ".wtx-drawer{width:min(660px,96vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:22px 24px 40px;box-shadow:-14px 0 44px rgba(0,0,0,.28);"
      + "animation:wtxSlide .18s ease}"
      + "@keyframes wtxSlide{from{transform:translateX(40px);opacity:.4}"
      + "to{transform:translateX(0);opacity:1}}"
      + ".wtx-dhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:4px}"
      + ".wtx-dhead h2{font-size:19px;line-height:1.3;margin:0;flex:1}"
      + ".wtx-meta{display:flex;flex-wrap:wrap;gap:5px;align-items:center;font-size:11.5px;"
      + "color:var(--faint);margin:7px 0 0}"
      + ".wtx-strip{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 4px}"
      + ".wtx-stbtn{font-family:inherit;font-size:12px;font-weight:700;padding:6px 13px;"
      + "border-radius:999px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;transition:all .12s}"
      + ".wtx-stbtn:hover{border-color:var(--brand);color:var(--brand)}"
      + ".wtx-stbtn.on{background:var(--brand);border-color:var(--brand);"
      + "color:var(--brand-ink)}"
      + ".wtx-desc{font-size:13.5px;color:var(--muted);line-height:1.6;white-space:pre-wrap;"
      + "margin:12px 0 0;max-width:70ch}"
      + ".wtx-sec{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin:22px 0 8px;display:flex;align-items:center;gap:8px}"
      + ".wtx-sec::after{content:'';flex:1;height:1px;background:var(--line)}"
      + ".wtx-sub{display:flex;gap:9px;align-items:center;padding:7px 2px;font-size:13.5px;"
      + "border-bottom:1px solid var(--line)}"
      + ".wtx-sub input[type=checkbox]{accent-color:var(--brand);width:15px;height:15px}"
      + ".wtx-sub.done span{text-decoration:line-through;color:var(--faint)}"
      + ".wtx-sub .x{margin-left:auto;color:var(--faint);cursor:pointer;font-size:12px;"
      + "padding:2px 6px;border-radius:6px}"
      + ".wtx-sub .x:hover{background:var(--neg-bg);color:var(--neg)}"
      + ".wtx-cmt{padding:9px 0;border-bottom:1px solid var(--line);font-size:13.5px;"
      + "line-height:1.55}"
      + ".wtx-cmt .who{font-size:11px;color:var(--faint);margin-bottom:3px;font-weight:700}"
      + ".wtx-addrow{display:flex;gap:8px;margin-top:10px}"
      + ".wtx-shots{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0}"
      + ".wtx-shot{width:96px;height:96px;border-radius:10px;border:1px solid var(--line);"
      + "overflow:hidden;background:var(--panel-2);cursor:pointer;text-align:center}"
      + ".wtx-shot img{width:100%;height:100%;object-fit:cover;display:block}"
      + ".wtx-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:80ch}"
      + ".wtx-link{font-size:12px;color:var(--brand);cursor:pointer;font-weight:700}"
      + ".wtx-jobline{font-size:12px;color:var(--muted);margin-top:4px;font-weight:600}"
      // edit form inside the drawer
      + ".wtx-form{display:grid;grid-template-columns:1fr 1fr;gap:12px 14px;margin-top:14px}"
      + ".wtx-form .full{grid-column:1/-1}"
      + ".wtx-form label{display:block;font-size:10.5px;font-weight:700;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 4px}"
      + "@media(max-width:600px){.wtx-form{grid-template-columns:1fr}}"
      // decline inline
      + ".wtx-decl{display:none;gap:8px;margin-top:10px}"
      + ".wtx-decl.open{display:flex}"
      // toast
      + ".wtx-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);"
      + "background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;"
      + "padding:10px 18px;border-radius:10px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.3);"
      + "animation:wtxFade .2s ease}"
      + ".wtx-toast.err{background:var(--neg);color:#fff}"
      // lists
      + ".wtx .rs-table td{vertical-align:middle}"
      + ".wtx-empty{padding:26px;text-align:center;color:var(--faint);font-size:13px}";
    document.head.appendChild(st);
  }

  /* ------------------------------------------------------------------- api */

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
  function toast(msg, isErr) {
    var t = document.createElement("div");
    t.className = "wtx-toast" + (isErr ? " err" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 4200 : 2200);
  }

  /* ------------------------------------------------------------------ state */

  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Loading the board…</div>';
    var S = { tab: "board", dept: "All", q: "", person: "", data: null, host: host };
    refresh(S, true);
  }

  function refresh(S, full) {
    return api("/api/_work").then(function (j) {
      S.data = j;
      if (full) paintShell(S); else paintBody(S);
    }).catch(function (e) {
      S.host.innerHTML = '<div class="panel">Could not load — ' + esc(e.message) + "</div>";
    });
  }

  function itemsOf(S) {
    var q = S.q.toLowerCase();
    return S.data.items.filter(function (i) {
      if (S.dept !== "All" && i.Department !== S.dept) return false;
      if (S.person && (i.Assignees || "").indexOf(S.person) < 0) return false;
      if (q && (i.Title + " " + (i.Assignees || "") + " " + (i.Label || "") + " "
                + (i["Job No"] || "") + " " + (i.Requester || ""))
            .toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
  }

  /* ------------------------------------------------------------------ shell */

  function paintShell(S) {
    var d = S.data;
    var html = '<div class="rs-page-head"><h1>IT Requests</h1>'
      + "<p>Everything IT is asked to build, fix or look at — one board, one history. A "
      + "request lands in the Inbox, it is accepted onto the board or declined with a "
      + "reason, and the requester can always see where it stands.</p></div>"
      + '<div class="wtx-top">'
      + '<div class="rs-seg" id="wtxTabs"></div>'
      + '<input class="wtx-in wtx-search" id="wtxQ" placeholder="search title, person, '
      + 'job #…" value="' + esc(S.q) + '">'
      + '<span id="wtxPersonMount"></span>'
      + '<button class="rs-btn pri" id="wtxNew">New</button>'
      + (d.can_triage && d.request_token
         ? '<span class="wtx-link" id="wtxShare">copy the request link</span>' : "")
      + "</div>"
      + '<div class="wtx-chips" id="wtxDepts"></div>'
      + '<div id="wtxBody"></div>';
    S.host.innerHTML = '<div class="wtx">' + html + "</div>";

    S.host.querySelector("#wtxQ").oninput = function (e) {
      S.q = e.target.value; paintBody(S);
    };
    // the kit dropdown (local state), not a naked <select> — his call 2026-08-27
    var pnames = {};
    d.items.forEach(function (i) {
      String(i.Assignees || "").split(",").forEach(function (n) {
        n = n.trim(); if (n) pnames[n] = 1;
      });
    });
    RSC.localSelect(S.host.querySelector("#wtxPersonMount"), {
      label: "Person", values: Object.keys(pnames).sort(), value: S.person,
      allLabel: "Everyone",
      onChange: function (v) { S.person = v; paintBody(S); },
    });
    S.host.querySelector("#wtxNew").onclick = function () {
      openDrawer(S, null, S.tab === "tickets" ? "ticket" : "project");
    };
    var share = S.host.querySelector("#wtxShare");
    if (share) share.onclick = function () {
      var url = location.origin + location.pathname.replace(/index\.html$/, "")
        + "request.html?t=" + d.request_token;
      navigator.clipboard.writeText(url).then(function () {
        toast("Request link copied — anyone with it can file a request");
      });
    };
    paintBody(S);
  }

  function paintTabs(S) {
    var d = S.data;
    var inbox = d.items.filter(function (i) { return i.Status === "Requested"; }).length;
    var tix = d.items.filter(function (i) {
      return i.Kind === "ticket" && ARCHIVE.indexOf(i.Status) < 0;
    }).length;
    var tabs = [["board", "Board"], ["tickets", "Tickets" + (tix ? " · " + tix : "")],
                ["mine", "My work"]];
    if (d.can_triage) tabs.push(["inbox", "Inbox" + (inbox ? " · " + inbox : "")]);
    tabs.push(["archive", "Archive"]);
    var el = S.host.querySelector("#wtxTabs");
    el.innerHTML = tabs.map(function (t) {
      return '<button class="' + (S.tab === t[0] ? "on" : "") + '" data-tab="' + t[0]
        + '">' + esc(t[1]) + "</button>";
    }).join("");
    el.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { S.tab = b.getAttribute("data-tab"); paintBody(S); };
    });
  }

  function paintDeptChips(S) {
    // THE BOARD IS IT-ONLY NOW (his call, 2026-08-28: "get rid of WORK thing at all -
    // clear the history and leave only IT related topics"). The every-department Monday
    // import was soft-deleted the same day (395 projects, recoverable via `Deleted`=0),
    // so a department chip bar would be a row of zeros with one working chip. Gone.
    var el = S.host.querySelector("#wtxDepts");
    if (el) { el.innerHTML = ""; el.style.display = "none"; }
    S.dept = "All";
  }

  /* ------------------------------------------------------------------ views */

  function paintBody(S) {
    paintTabs(S); paintDeptChips(S);
    var body = S.host.querySelector("#wtxBody");
    var items = itemsOf(S);
    if (S.tab === "board") {
      paintKanban(S, body, items.filter(function (i) { return i.Kind !== "ticket"; }),
                  P_COLS, "Done");
    } else if (S.tab === "tickets") {
      paintKanban(S, body, items.filter(function (i) { return i.Kind === "ticket"; }),
                  T_COLS, "Resolved");
    } else if (S.tab === "mine") {
      paintList(S, body, S.data.items.filter(function (i) {
        return (i.Assignees || "").indexOf(S.data.me) >= 0
          && ARCHIVE.indexOf(i.Status) < 0;
      }), "Nothing assigned to you right now — enjoy it while it lasts.");
    } else if (S.tab === "inbox") {
      paintInbox(S, body, S.data.items.filter(function (i) {
        return i.Status === "Requested";
      }));
    } else {
      paintList(S, body, items.filter(function (i) {
        return ARCHIVE.indexOf(i.Status) >= 0;
      }), "Nothing archived yet.");
    }
  }

  function cardHtml(S, i) {
    var d = S.data;
    var sub = d.subs[i["Work Id"]];
    var live = ARCHIVE.indexOf(i.Status) < 0;
    var late = i["Due Date"] && live && String(i["Due Date"]).slice(0, 10) < today();
    var who = String(i.Assignees || "").split(",").map(function (s) {
      return s.trim();
    }).filter(Boolean);
    var tags = "";
    if (i.Kind === "ticket") {
      if (i.Label) tags += '<span class="rs-pill info">' + esc(i.Label) + "</span>";
      if (i.Severity && i.Severity !== "Operational")
        tags += '<span class="rs-pill ' + (SEV_TONE[i.Severity] || "mute") + '">'
          + esc(i.Severity) + "</span>";
    } else if (i.Priority && i.Priority !== "Medium") {
      tags += '<span class="rs-pill ' + (PRIO_TONE[i.Priority] || "mute") + '">'
        + esc(i.Priority) + "</span>";
    }
    if (i.Department && i.Department !== "Informational Technology")
      tags += '<span class="rs-pill mute">' + esc(i.Department) + "</span>";
    var foot = "";
    if (i["Job No"]) foot += "<span># " + esc(i["Job No"]) + "</span>";
    if (i["Due Date"]) foot += '<span class="wtx-due' + (late ? " late" : "") + '">'
      + (late ? "⚠ " : "") + esc(fmtDate(i["Due Date"])) + "</span>";
    if (d.comments[i["Work Id"]]) foot += "<span>💬 " + d.comments[i["Work Id"]] + "</span>";
    foot += '<span class="wtx-avs">' + who.slice(0, 4).map(function (n) {
      return '<span class="wtx-av hue-' + hueOf(n) + '" title="' + esc(n) + '">'
        + esc(initials(n)) + "</span>";
    }).join("") + (who.length > 4 ? '<span class="wtx-av hue-muted">+' + (who.length - 4)
      + "</span>" : "") + "</span>";
    var prog = "";
    if (sub && sub.n) prog = '<div class="wtx-prog" title="' + sub.done + " of " + sub.n
      + ' subtasks done"><i style="width:' + Math.round(100 * sub.done / sub.n)
      + '%"></i></div>';
    return '<div class="wtx-card hue-' + hueOf(i.Department) + '" draggable="true" '
      + 'data-open="' + i["Work Id"] + '"><b>' + esc(i.Title) + "</b>"
      + (tags ? '<div class="wtx-tags">' + tags + "</div>" : "")
      + '<div class="wtx-foot">' + foot + "</div>" + prog + "</div>";
  }

  function paintKanban(S, body, items, cols, doneCol) {
    var cutoff = daysAgo(DONE_WINDOW_D);
    body.innerHTML = '<div class="wtx-cols">' + cols.map(function (st) {
      var list = items.filter(function (i) {
        if (i.Status !== st) return false;
        if (st === doneCol) return String(i["Entered At"] || "") >= cutoff;
        return true;
      }).sort(function (a, b) {
        return String(a["Due Date"] || "9999").localeCompare(String(b["Due Date"] || "9999"));
      });
      return '<div class="wtx-col" data-col="' + esc(st) + '">'
        + '<div class="wtx-colh"><i class="' + (TONE[st] || "mute") + '"></i>'
        + esc(st === doneCol ? st + " · last " + DONE_WINDOW_D + "d" : st)
        + "<b>" + list.length + "</b></div>"
        + list.map(function (i) { return cardHtml(S, i); }).join("")
        + "</div>";
    }).join("") + "</div>";
    wireCards(S, body);
    wireDnD(S, body);
  }

  function paintList(S, body, items, emptyText) {
    if (!items.length) {
      body.innerHTML = '<div class="panel"><div class="wtx-empty">' + esc(emptyText)
        + "</div></div>";
      return;
    }
    var rows = items.sort(function (a, b) {
      return String(b["Entered At"] || "").localeCompare(String(a["Entered At"] || ""));
    }).map(function (i) {
      return '<tr data-open="' + i["Work Id"] + '" style="cursor:pointer">'
        + '<td class="strong">' + esc(i.Title)
        + (i.Kind === "ticket" && i.Label ? ' <span class="rs-pill info" '
           + 'style="font-size:10px">' + esc(i.Label) + "</span>" : "") + "</td>"
        + "<td>" + esc(i.Department) + "</td>"
        + '<td><span class="rs-pill ' + (TONE[i.Status] || "mute") + '">' + esc(i.Status)
        + "</span></td>"
        + "<td>" + esc(i.Assignees || "—") + "</td>"
        + "<td>" + esc(fmtDate(i["Due Date"]) || "—") + "</td>"
        + "<td>" + esc(i.Requester || "") + "</td></tr>";
    }).join("");
    body.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>Item</th><th>Team</th><th>Status</th><th>Assigned</th>"
      + "<th>Due</th><th>By</th></tr></thead><tbody>" + rows
      + "</tbody></table></div></div>";
    wireCards(S, body);
  }

  function paintInbox(S, body, inbox) {
    if (!inbox.length) {
      body.innerHTML = '<div class="panel"><div class="wtx-empty">The inbox is clear — '
        + "new requests from the team land here.</div></div>";
      return;
    }
    body.innerHTML = inbox.map(function (i) {
      return '<div class="panel" style="margin-bottom:12px"><div class="panel-head"><div>'
        + '<div class="panel-title">' + esc(i.Title) + "</div>"
        + '<div class="wtx-meta"><span class="wtx-av hue-' + hueOf(i.Requester) + '" '
        + 'style="margin:0">' + esc(initials(i.Requester)) + "</span><span><b>"
        + esc(i.Requester || "?") + "</b> → " + esc(i.Department) + "</span>"
        + '<span class="rs-pill ' + (PRIO_TONE[i.Priority] || "mute") + '">'
        + esc(i.Priority) + "</span><span>" + esc(String(i["Entered At"]).slice(0, 16))
        + "</span></div>"
        + (i.Description ? '<div class="wtx-desc">' + esc(i.Description) + "</div>" : "")
        + "</div></div>"
        + '<div style="display:flex;gap:8px;margin-top:10px">'
        + '<button class="rs-btn pri" data-accept="' + i["Work Id"] + '">Accept → board'
        + "</button>"
        + '<button class="rs-btn" data-declbtn="' + i["Work Id"] + '">Decline…</button>'
        + '<button class="rs-btn" data-open="' + i["Work Id"] + '">Open</button></div>'
        + '<div class="wtx-decl" data-declrow="' + i["Work Id"] + '">'
        + '<input class="wtx-in" placeholder="why? — the requester sees this" '
        + 'data-declwhy="' + i["Work Id"] + '">'
        + '<button class="rs-btn" data-declgo="' + i["Work Id"] + '">Decline</button></div>'
        + "</div>";
    }).join("");
    body.querySelectorAll("[data-accept]").forEach(function (b) {
      b.onclick = function () {
        var wid = +b.getAttribute("data-accept");
        setStatus(S, wid, "Planned").then(function () {
          toast("Accepted — assign someone in the drawer");
          openDrawer(S, wid);
        });
      };
    });
    body.querySelectorAll("[data-declbtn]").forEach(function (b) {
      b.onclick = function () {
        body.querySelector('[data-declrow="' + b.getAttribute("data-declbtn") + '"]')
          .classList.toggle("open");
      };
    });
    body.querySelectorAll("[data-declgo]").forEach(function (b) {
      b.onclick = function () {
        var wid = +b.getAttribute("data-declgo");
        var why = body.querySelector('[data-declwhy="' + wid + '"]').value.trim();
        if (why.length < 3) { toast("Say why — the requester sees it", true); return; }
        post({ action: "status", work_id: wid, status: "Declined", reason: why })
          .then(function () { toast("Declined"); refresh(S); })
          .catch(function (e) { toast(e.message, true); });
      };
    });
    wireCards(S, body);
  }

  function wireCards(S, body) {
    body.querySelectorAll("[data-open]").forEach(function (c) {
      c.onclick = function () { openDrawer(S, +c.getAttribute("data-open")); };
    });
  }

  /* ------------------------------------------------------------ drag & drop */

  function wireDnD(S, body) {
    body.querySelectorAll(".wtx-card").forEach(function (c) {
      c.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.setData("text/plain", c.getAttribute("data-open"));
        c.classList.add("drag");
      });
      c.addEventListener("dragend", function () { c.classList.remove("drag"); });
    });
    body.querySelectorAll(".wtx-col").forEach(function (col) {
      col.addEventListener("dragover", function (ev) {
        ev.preventDefault(); col.classList.add("drop");
      });
      col.addEventListener("dragleave", function () { col.classList.remove("drop"); });
      col.addEventListener("drop", function (ev) {
        ev.preventDefault(); col.classList.remove("drop");
        var wid = +ev.dataTransfer.getData("text/plain");
        var st = col.getAttribute("data-col");
        setStatus(S, wid, st);
      });
    });
  }

  // OPTIMISTIC: move the card in local state and repaint instantly; the server write runs
  // behind it and any refusal rolls the board back with the reason on a toast.
  function setStatus(S, wid, st) {
    var i = S.data.items.filter(function (x) { return x["Work Id"] === wid; })[0];
    if (!i || i.Status === st) return Promise.resolve();
    var prev = i.Status;
    i.Status = st;
    if (ARCHIVE.indexOf(st) >= 0) i["Entered At"] = new Date().toISOString();
    paintBody(S);
    return post({ action: "status", work_id: wid, status: st })
      .catch(function (e) {
        i.Status = prev; paintBody(S); toast(e.message, true);
        throw e;
      });
  }

  /* ----------------------------------------------------------------- drawer */

  function drawerShell(S) {
    var ov = document.createElement("div");
    ov.className = "wtx-overlay";
    ov.onclick = function (ev) { if (ev.target === ov) close(); };
    ov.innerHTML = '<div class="wtx-drawer"><div class="rs-loading">Opening…</div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); refresh(S); }
    return { ov: ov, el: ov.querySelector(".wtx-drawer"), close: close };
  }

  function openDrawer(S, wid, newKind) {
    var dw = drawerShell(S);
    if (wid == null) { paintEdit(S, dw, null, newKind); return; }
    api("/api/_work?item=" + wid).then(function (j) {
      S.data = Object.assign(S.data, { items: j.items, subs: j.subs, comments: j.comments });
      paintView(S, dw, wid, j.detail || { subtasks: [], comments: [] });
    }).catch(function (e) {
      dw.el.innerHTML = '<div class="panel">' + esc(e.message) + "</div>";
    });
  }

  function paintView(S, dw, wid, det) {
    var i = S.data.items.filter(function (x) { return x["Work Id"] === wid; })[0];
    if (!i) { dw.close(); return; }
    var isT = i.Kind === "ticket";
    var strip = (isT ? T_COLS.concat(["Rejected"]) : P_COLS.concat(["Dropped"]))
      .map(function (st) {
        return '<button class="wtx-stbtn' + (i.Status === st ? " on" : "") + '" data-st="'
          + esc(st) + '">' + esc(st) + "</button>";
      }).join("");
    var who = String(i.Assignees || "").split(",").map(function (s) {
      return s.trim();
    }).filter(Boolean);
    dw.el.innerHTML = ''
      + '<div class="wtx-dhead"><h2>' + esc(i.Title) + "</h2>"
      + '<button class="rs-btn" id="dwEdit">Edit</button>'
      + '<button class="rs-btn" id="dwClose">✕</button></div>'
      + '<div class="wtx-meta">'
      + '<span class="rs-pill ' + (TONE[i.Status] || "mute") + '">' + esc(i.Status) + "</span>"
      + '<span class="rs-pill mute">' + esc(i.Department) + "</span>"
      + (isT && i.Label ? '<span class="rs-pill info">' + esc(i.Label) + "</span>" : "")
      + (isT && i.Severity ? '<span class="rs-pill ' + (SEV_TONE[i.Severity] || "mute")
         + '">' + esc(i.Severity) + "</span>" : "")
      + (!isT && i.Category ? "<span>" + esc(i.Category) + "</span>" : "")
      + (!isT ? '<span class="rs-pill ' + (PRIO_TONE[i.Priority] || "mute") + '">'
         + esc(i.Priority) + "</span>" : "")
      + (i["Job No"] ? "<span># " + esc(i["Job No"]) + "</span>" : "")
      + (i["Due Date"] ? "<span>due " + esc(fmtDate(i["Due Date"])) + "</span>" : "")
      + "<span>by " + esc(i.Requester || "?") + "</span>"
      + "</div>"
      + (who.length ? '<div class="wtx-meta">' + who.map(function (n) {
          return '<span class="wtx-av hue-' + hueOf(n) + '" style="margin:0">'
            + esc(initials(n)) + "</span><span>" + esc(n) + "</span>";
        }).join("") + "</div>" : "")
      + '<div class="wtx-jobline" id="dwJob"></div>'
      + (i["Declined Reason"] ? '<p class="wtx-note" style="margin-top:10px"><b>Declined:'
         + "</b> " + esc(i["Declined Reason"]) + "</p>" : "")
      + '<div class="wtx-strip">' + strip + "</div>"
      + (i.Description ? '<div class="wtx-desc">' + esc(i.Description) + "</div>" : "")
      + ((det.attachments || []).length
         ? '<div class="wtx-sec">Images</div><div class="wtx-shots" id="dwShots">'
           + det.attachments.map(function (a) {
               return '<div class="wtx-shot" data-att="' + a.id + '" title="click to open">'
                 + '<div class="rs-loading" style="font-size:10px;padding:30px 4px">…</div>'
                 + "</div>";
             }).join("") + "</div>"
         : "")
      + '<div class="wtx-sec">Subtasks</div><div id="dwSubs"></div>'
      + '<div class="wtx-addrow"><input class="wtx-in" id="dwSubNew" '
      + 'placeholder="add a subtask…"><button class="rs-btn" id="dwSubAdd">Add</button></div>'
      + '<div class="wtx-sec">Updates</div><div id="dwCmts"></div>'
      + '<div class="wtx-addrow"><input class="wtx-in" id="dwCmtNew" '
      + 'placeholder="write an update…"><button class="rs-btn" id="dwCmtAdd">Post</button>'
      + "</div>";

    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#dwEdit").onclick = function () { paintEdit(S, dw, i); };
    dw.el.querySelectorAll("[data-st]").forEach(function (b) {
      b.onclick = function () {
        setStatus(S, wid, b.getAttribute("data-st")).then(function () {
          dw.el.querySelectorAll("[data-st]").forEach(function (x) {
            x.classList.toggle("on", x.getAttribute("data-st") ===
              b.getAttribute("data-st"));
          });
        });
      };
    });

    // attached screenshots: fetched WITH the bearer token (an <img src> cannot carry
    // Authorization), shown as thumbnails, click opens the full image in a new tab
    dw.el.querySelectorAll("[data-att]").forEach(function (mount) {
      fetch(ZTZ.API + "/api/_workimg?id=" + mount.getAttribute("data-att"), {
        headers: { Authorization: "Bearer " + ZTZ.getToken() },
      }).then(function (r) {
        if (!r.ok) throw new Error("image " + r.status);
        return r.blob();
      }).then(function (blob) {
        var url = URL.createObjectURL(blob);
        mount.innerHTML = '<img src="' + url + '" alt="">';
        mount.onclick = function () { window.open(url, "_blank"); };
      }).catch(function () {
        mount.innerHTML = '<div class="wtx-note" style="padding:26px 4px">✕</div>';
      });
    });

    // the warehouse line: a ticket with a job number explains itself
    if (i["Job No"]) {
      api("/api/_work?job=" + encodeURIComponent(i["Job No"])).then(function (r) {
        if (!r.job_info) return;
        var ji = r.job_info;
        dw.el.querySelector("#dwJob").textContent = "⌂ " + [ji.customer,
          ji.job_date && ("moved " + fmtDate(ji.job_date)),
          ji.rep && ("rep " + ji.rep), ji.foreman && ("foreman " + ji.foreman)]
          .filter(Boolean).join(" · ");
      }).catch(function () {});
    }

    function paintSubs(subs) {
      dw.el.querySelector("#dwSubs").innerHTML = subs.map(function (s) {
        return '<div class="wtx-sub' + (s.done ? " done" : "") + '">'
          + '<input type="checkbox" data-sid="' + s.id + '"' + (s.done ? " checked" : "")
          + "><span>" + esc(s.title)
          + (s.assignee ? ' <i style="color:var(--faint)">· ' + esc(s.assignee) + "</i>" : "")
          + '</span><span class="x" data-srm="' + s.id + '">remove</span></div>';
      }).join("") || '<div class="wtx-note">none yet</div>';
      dw.el.querySelectorAll("[data-sid]").forEach(function (cb) {
        cb.onchange = function () {
          cb.closest(".wtx-sub").classList.toggle("done", cb.checked);
          post({ action: "subtask_set", work_id: wid, id: +cb.getAttribute("data-sid"),
                 done: cb.checked }).catch(function (e) { toast(e.message, true); });
        };
      });
      dw.el.querySelectorAll("[data-srm]").forEach(function (x) {
        x.onclick = function () {
          post({ action: "subtask_set", work_id: wid, id: +x.getAttribute("data-srm"),
                 removed: true })
            .then(function () { x.closest(".wtx-sub").remove(); })
            .catch(function (e) { toast(e.message, true); });
        };
      });
    }
    function paintCmts(cmts) {
      dw.el.querySelector("#dwCmts").innerHTML = cmts.map(function (c) {
        return '<div class="wtx-cmt"><div class="who">' + esc(c.by) + " · " + esc(c.at)
          + "</div>" + esc(c.text) + "</div>";
      }).join("") || '<div class="wtx-note">no updates yet</div>';
    }
    paintSubs(det.subtasks); paintCmts(det.comments);

    dw.el.querySelector("#dwSubAdd").onclick = addSub;
    dw.el.querySelector("#dwSubNew").onkeydown = function (e) {
      if (e.key === "Enter") addSub();
    };
    function addSub() {
      var t = dw.el.querySelector("#dwSubNew").value.trim();
      if (!t) return;
      post({ action: "subtask_add", work_id: wid, title: t }).then(function () {
        return api("/api/_work?item=" + wid);
      }).then(function (j) {
        dw.el.querySelector("#dwSubNew").value = "";
        paintSubs((j.detail || {}).subtasks || []);
      }).catch(function (e) { toast(e.message, true); });
    }
    dw.el.querySelector("#dwCmtAdd").onclick = addCmt;
    dw.el.querySelector("#dwCmtNew").onkeydown = function (e) {
      if (e.key === "Enter") addCmt();
    };
    function addCmt() {
      var t = dw.el.querySelector("#dwCmtNew").value.trim();
      if (!t) return;
      post({ action: "comment", work_id: wid, text: t }).then(function () {
        return api("/api/_work?item=" + wid);
      }).then(function (j) {
        dw.el.querySelector("#dwCmtNew").value = "";
        paintCmts((j.detail || {}).comments || []);
      }).catch(function (e) { toast(e.message, true); });
    }
  }

  /* ------------------------------------------------------------ edit / new */

  function paintEdit(S, dw, item, newKind) {
    var d = S.data;
    var isT = item ? item.Kind === "ticket" : newKind === "ticket";
    var v = item || { Title: "", Department: "Informational Technology",
                      Category: "", Priority: "Medium", Assignees: "", "Job No": "",
                      Label: "", Severity: "Operational", "Start Date": "", "Due Date": "",
                      Description: "" };
    var picked = String(v.Assignees || "").split(",").map(function (s) {
      return s.trim();
    }).filter(Boolean);
    dw.el.innerHTML = ''
      + '<div class="wtx-dhead"><h2>'
      + (item ? "Edit" : (isT ? "New ticket" : "New item")) + "</h2>"
      + '<button class="rs-btn" id="dwClose">✕</button></div>'
      + '<div class="wtx-form">'
      + '<div class="full"><label>' + (isT ? "Customer / issue" : "Title")
      + '</label><input class="wtx-in" id="eTitle" maxlength="200" value="'
      + esc(v.Title) + '"></div>'
      + (isT
         ? '<div><label>Issue label</label><input class="wtx-in" id="eLabel" '
           + 'maxlength="60" list="wtxLabels" value="' + esc(v.Label || "") + '">'
           + '<datalist id="wtxLabels">' + LABELS.map(function (l) {
               return '<option value="' + esc(l) + '">';
             }).join("") + "</datalist></div>"
           + '<div><label>Severity</label><div id="eSevM"></div></div>'
         : '<div><label>Category</label><div id="eCatM"></div></div>'
           + '<div><label>Priority</label><div id="ePrioM"></div></div>')
      + '<div><label>Job #' + (isT ? "" : " (optional)")
      + '</label><div style="display:flex;gap:6px">'
      + '<input class="wtx-in" id="eJob" value="' + esc(v["Job No"] || "") + '">'
      + '<button class="rs-btn" id="eLookup" title="fill from the warehouse">Look up'
      + "</button></div>"
      + '<div class="wtx-jobline" id="eJobInfo"></div></div>'
      + '<div><label>Start</label><input class="wtx-in" id="eStart" type="date" value="'
      + esc(String(v["Start Date"] || "").slice(0, 10)) + '"></div>'
      + '<div><label>Due</label><input class="wtx-in" id="eDue" type="date" value="'
      + esc(String(v["Due Date"] || "").slice(0, 10)) + '"></div>'
      + '<div class="full"><label>Assigned to (comma-separated, from the directory)</label>'
      + '<input class="wtx-in" id="eWho" list="wtxNames" value="' + esc(picked.join(", "))
      + '"><datalist id="wtxNames">' + d.roster.map(function (n) {
          return '<option value="' + esc(n) + '">';
        }).join("") + "</datalist></div>"
      + '<div class="full"><label>Description</label><textarea class="wtx-in" id="eDesc" '
      + 'maxlength="8000">' + esc(v.Description || "") + "</textarea></div>"
      + '<div class="full" style="display:flex;gap:8px;align-items:center">'
      + '<button class="rs-btn pri" id="eSave">' + (item ? "Save" : "Create") + "</button>"
      + '<button class="rs-btn" id="eCancel">Cancel</button>'
      + (item ? '<button class="rs-btn" id="eDelete" style="margin-left:auto">Delete'
                + "</button>" : "")
      + "</div></div>";

    // kit-styled form selects (his call 2026-08-27): the same localSelect as the filter
    // bars, in its input-shaped `form` variant — handles are read at save time.
    // IT-only board: the team is not a choice any more. Existing items keep whatever
    // department they carry (old tickets name the team that RAISED them); anything
    // edited or created here belongs to Informational Technology.
    var hDept = { get: function () { return v.Department || "Informational Technology"; } };
    var hSev = null, hCat = null, hPrio = null;
    if (isT) {
      hSev = RSC.localSelect(dw.el.querySelector("#eSevM"), {
        label: "Severity", values: d.severities || [],
        value: v.Severity || "Operational", form: true, required: true,
      });
    } else {
      hCat = RSC.localSelect(dw.el.querySelector("#eCatM"), {
        label: "Category", values: d.categories, value: v.Category || "", form: true,
        allLabel: "—",
      });
      hPrio = RSC.localSelect(dw.el.querySelector("#ePrioM"), {
        label: "Priority", values: ["Low", "Medium", "High", "Critical"],
        value: v.Priority || "Medium", form: true, required: true,
      });
    }

    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#eCancel").onclick = function () {
      if (item) openDrawerAgain(); else dw.close();
    };
    function openDrawerAgain() {
      api("/api/_work?item=" + item["Work Id"]).then(function (j) {
        S.data = Object.assign(S.data, { items: j.items, subs: j.subs,
                                         comments: j.comments });
        paintView(S, dw, item["Work Id"], j.detail || { subtasks: [], comments: [] });
      });
    }
    var del = dw.el.querySelector("#eDelete");
    if (del) del.onclick = function () {
      if (del.dataset.armed) {
        post({ action: "delete", work_id: item["Work Id"] })
          .then(function () { toast("Deleted"); dw.close(); })
          .catch(function (e) { toast(e.message, true); });
      } else {
        del.dataset.armed = "1"; del.textContent = "Sure? Click again";
        setTimeout(function () {
          delete del.dataset.armed; del.textContent = "Delete";
        }, 3000);
      }
    };
    var lk = dw.el.querySelector("#eLookup");
    if (lk) lk.onclick = function () {
      var j = dw.el.querySelector("#eJob").value.trim();
      if (!j) return;
      var info = dw.el.querySelector("#eJobInfo");
      info.textContent = "looking up…";
      api("/api/_work?job=" + encodeURIComponent(j)).then(function (r) {
        if (!r.job_info) { info.textContent = "job not found in the warehouse"; return; }
        var ji = r.job_info;
        info.textContent = [ji.customer, ji.job_date && ("moved " + fmtDate(ji.job_date)),
                            ji.rep && ("rep " + ji.rep),
                            ji.foreman && ("foreman " + ji.foreman)]
          .filter(Boolean).join(" · ");
        var t = dw.el.querySelector("#eTitle");
        if (!t.value.trim() && ji.customer) t.value = ji.customer;
      }).catch(function (e) { info.textContent = e.message; });
    };
    dw.el.querySelector("#eSave").onclick = function () {
      var payload = {
        action: item ? "update" : "create",
        kind: isT ? "ticket" : "project",
        work_id: item ? item["Work Id"] : undefined,
        title: dw.el.querySelector("#eTitle").value.trim(),
        department: hDept.get(),
        category: isT ? "" : (hCat ? hCat.get() : ""),
        priority: isT ? "Medium" : (hPrio ? hPrio.get() : "Medium"),
        label: isT ? dw.el.querySelector("#eLabel").value.trim() : "",
        severity: isT ? (hSev ? hSev.get() : "") : "",
        job_no: dw.el.querySelector("#eJob").value.trim(),
        start: dw.el.querySelector("#eStart").value,
        due: dw.el.querySelector("#eDue").value,
        assignees: dw.el.querySelector("#eWho").value.split(",").map(function (s) {
          return s.trim();
        }).filter(Boolean),
        description: dw.el.querySelector("#eDesc").value.trim(),
      };
      post(payload).then(function () {
        toast(item ? "Saved" : "Created");
        dw.close();
      }).catch(function (e) { toast(e.message, true); });
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
