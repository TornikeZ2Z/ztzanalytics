/* BUGS & REQUESTS (2026-11-13, ZTZ-49) — the board behind the "Submit a bug" button in the top bar
   (assets/bug-report.js). Every portal user files there and sees only their own; this page is the whole
   board, for admins: the status tabs, every request with its picture, the drawer with the thread, and the
   Claude Code tokens a chat reads the board with (scripts/zp_requests.py, .claude/commands/requests.md).

   Tornike's picks (13 Nov): statuses New / In progress / Done / Declined (a decline needs a reason the
   sender reads; Done takes an optional note for them); numbers ZP-12; the sender is emailed when a request
   is started, done or declined, once per status; a reply is never emailed (the button's badge shows it).
   ADMIN-ONLY: the shell's ADMIN_ONLY set hides it and the bridge (bridge/zp_board.py) refuses the whole
   board to anyone else. Tech Team group. Data: /api/_zp. */

registerPage({
  id: "bugs-requests",
  group: "tech",
  title: "Bugs & Requests",
  async render(host) {
    var esc = RSC.esc;
    injectStyle();
    var STATUS = { new: "New", in_progress: "In progress", done: "Done", declined: "Declined" };
    var PILL = { new: "info", in_progress: "warn", done: "ok", declined: "mute" };
    var PRIO = ["urgent", "high", "medium", "low"];
    var PRIO_PILL = { urgent: "bad", high: "warn", medium: "mute", low: "mute" };
    var S = { rows: null, tab: "open", kind: "all", q: "", open: null, tokens: null, err: null, replyPics: [] };
    try { S.tab = localStorage.getItem("zpb-tab") || "open"; } catch (e) { /* private mode */ }

    host.innerHTML = '<div class="zpb">'
      + '<div class="rs-page-head"><h1>Bugs &amp; Requests</h1>'
      + "<p>What people sent with the <b>Submit a bug</b> button in the top bar. Each sender sees only their own and "
      + "gets an email when you start one, finish it or decline it. Open a row for the picture, the thread and the "
      + "controls.</p></div>"
      + '<div class="rs-bar zpb-bar"><div class="rs-seg" id="zpbTabs" role="tablist" aria-label="Status"></div>'
      + '<div class="rs-seg" id="zpbKind" role="tablist" aria-label="Kind">'
      + '<button type="button" data-k="all">All</button><button type="button" data-k="bug">Bugs</button>'
      + '<button type="button" data-k="request">Requests</button></div>'
      + '<input class="rs-inp zpb-q" id="zpbQ" type="search" placeholder="Search title, text, sender, ZP-12"></div>'
      + '<div id="zpbList"><div class="zpb-empty">Loading…</div></div>'
      + '<div class="panel zpb-tokens"><div class="panel-head"><div class="panel-title">Claude Code tokens</div>'
      + '<button type="button" class="rs-btn" id="zpbMint">New token</button></div>'
      + '<p class="rs-hint">A token lets a Claude Code chat read this board (<code>python scripts/zp_requests.py</code>, or '
      + "<code>/requests</code>) and, when you name an item, start, reply to, finish or decline it. It is shown once: keep it "
      + "in Secret Manager as <code>zp-requests-token</code> (project contracts-management-3). "
      + "<b>Fixes ZP-12</b> in a deployed commit closes ZP-12 with it.</p>"
      + '<div id="zpbTokens"></div></div></div>'
      + '<div class="zpb-mask" id="zpbMask" hidden></div><aside class="zpb-drawer" id="zpbDrawer" hidden></aside>';

    function api(opts, qs) {
      return fetch(ZTZ.API + "/api/_zp" + (qs || ""), Object.assign({
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
      }, opts || {})).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 403) throw new Error(j.error || "Your account has no access to the board.");
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        });
      });
    }
    function post(body) { return api({ method: "POST", body: JSON.stringify(body) }); }
    function toast(m) { try { ZTZ.toast(m); } catch (e) { /* optional */ } }
    function ago(iso) {
      var d = iso ? new Date(iso) : null;
      if (!d || isNaN(d)) return "";
      var s = (Date.now() - d.getTime()) / 1000;
      if (s < 3600) return Math.max(1, Math.round(s / 60)) + " min ago";
      if (s < 86400) return Math.round(s / 3600) + " h ago";
      if (s < 86400 * 7) return Math.round(s / 86400) + " d ago";
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    }
    function when(iso) {
      var d = iso ? new Date(iso) : null;
      if (!d || isNaN(d)) return "";
      return (window.RS && RS.fmtTz) ? RS.fmtTzDay(d) + ", " + RS.fmtTz(d) : d.toLocaleString();
    }

    /* ---------------------------------------------------------------- the list */
    function load() {
      return api(null, "?status=all").then(function (j) { S.rows = j.requests || []; S.err = null; })
        .catch(function (e) { S.err = e.message; S.rows = S.rows || []; });
    }
    function inTab(r) {
      if (S.tab === "open") return r.status === "new" || r.status === "in_progress";
      if (S.tab === "all") return true;
      return r.status === S.tab;
    }
    function matches(r) {
      if (S.kind !== "all" && r.kind !== S.kind) return false;
      var q = S.q.trim().toLowerCase();
      if (!q) return true;
      return [r.key, r.title, r.reporter, r.reporter_email, r.page_title].join(" ").toLowerCase().indexOf(q) >= 0;
    }
    function paintTabs() {
      var rows = S.rows || [], n = function (f) { return rows.filter(f).length; };
      var tabs = [["open", "Open", n(function (r) { return r.status === "new" || r.status === "in_progress"; })],
        ["new", "New", n(function (r) { return r.status === "new"; })],
        ["in_progress", "In progress", n(function (r) { return r.status === "in_progress"; })],
        ["done", "Done", n(function (r) { return r.status === "done"; })],
        ["declined", "Declined", n(function (r) { return r.status === "declined"; })],
        ["all", "All", rows.length]];
      var el = host.querySelector("#zpbTabs");
      el.innerHTML = tabs.map(function (t) {
        return '<button type="button" role="tab" data-t="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '">'
          + esc(t[1]) + ' <span class="zpb-n">' + t[2] + "</span></button>";
      }).join("");
      el.querySelectorAll("[data-t]").forEach(function (b) {
        b.onclick = function () {
          S.tab = b.getAttribute("data-t");
          try { localStorage.setItem("zpb-tab", S.tab); } catch (e) { /* ignore */ }
          paintTabs(); paintList();
        };
      });
      host.querySelectorAll("#zpbKind [data-k]").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-k") === S.kind);
      });
    }
    function paintList() {
      var box = host.querySelector("#zpbList");
      if (S.err && !(S.rows || []).length) { box.innerHTML = '<div class="zpb-empty">' + esc(S.err) + "</div>"; return; }
      var rows = (S.rows || []).filter(inTab).filter(matches);
      if (!rows.length) {
        box.innerHTML = '<div class="zpb-empty">' + ((S.rows || []).length
          ? "Nothing here." : "Nothing has been sent yet. The <b>Submit a bug</b> button sits in the top bar of every page.") + "</div>";
        return;
      }
      box.innerHTML = '<div class="rs-tablewrap"><table class="rs-table zpb-table"><thead><tr>'
        + '<th></th><th>#</th><th>Title</th><th>Kind</th><th>Page</th><th>From</th><th>Sent</th><th>Priority</th><th>Status</th>'
        + "</tr></thead><tbody>" + rows.map(function (r) {
          return '<tr class="click' + (S.open && S.open.key === r.key ? " zpb-on" : "") + '" data-key="' + esc(r.key) + '">'
            + '<td class="zpb-th">' + (r.thumb ? '<img src="' + esc(r.thumb) + '" alt="" loading="lazy">' : "") + "</td>"
            + '<td class="nowrap strong">' + esc(r.key) + "</td>"
            + '<td class="zpb-title">' + esc(r.title) + (r.unread ? '<span class="zpb-dot" title="The sender wrote since you last opened it"></span>' : "")
            + (r.replies ? '<span class="zpb-rc">' + r.replies + " repl" + (r.replies === 1 ? "y" : "ies") + "</span>" : "") + "</td>"
            + '<td class="nowrap dim">' + (r.kind === "bug" ? "Bug" : "Request") + "</td>"
            + '<td class="dim">' + esc(r.page_title || "") + "</td>"
            + '<td class="nowrap">' + esc(r.reporter || r.reporter_email || "") + "</td>"
            + '<td class="nowrap dim">' + ago(r.created_at) + "</td>"
            + '<td><span class="rs-pill ' + (PRIO_PILL[r.priority] || "mute") + '">' + esc(r.priority || "") + "</span></td>"
            + '<td><span class="rs-pill ' + (PILL[r.status] || "mute") + '">' + esc(STATUS[r.status] || r.status) + "</span></td></tr>";
        }).join("") + "</tbody></table></div>";
      box.querySelectorAll("tr[data-key]").forEach(function (tr) {
        tr.onclick = function () { openDrawer(tr.getAttribute("data-key")); };
      });
    }

    /* ---------------------------------------------------------------- the drawer */
    var drawer = host.querySelector("#zpbDrawer"), mask = host.querySelector("#zpbMask");
    mask.onclick = closeDrawer;
    function onKey(e) {
      if (e.key === "Escape" && !drawer.hidden && !document.querySelector(".rs-dlg-mask")) { e.stopPropagation(); closeDrawer(); }
    }
    function closeDrawer() {
      drawer.hidden = true; mask.hidden = true; S.open = null; S.replyPics = [];
      document.removeEventListener("keydown", onKey, true);
      paintList();
    }
    function openDrawer(key) {
      S.open = { key: key, loading: true }; S.replyPics = [];
      drawer.hidden = false; mask.hidden = false;
      document.addEventListener("keydown", onKey, true);
      paintDrawer(); paintList();
      return api(null, "?id=" + encodeURIComponent(key)).then(function (j) {
        if (!S.open || S.open.key !== key) return;
        S.open = j.request;
        (S.rows || []).forEach(function (r) { if (r.key === key) r.unread = false; });
        paintDrawer(); paintList();
        if (window.ZPB) ZPB.refresh();
      }).catch(function (e) { S.open = { key: key, error: e.message }; paintDrawer(); });
    }
    function evText(ev) {
      var m = /^(status|priority|kind):(\w+)$/.exec(ev || "");
      if (m && m[1] === "status") return "moved to " + (STATUS[m[2]] || m[2]);
      if (m) return m[1] + " set to " + m[2];
      var d = /^duplicate:(\d+)$/.exec(ev || "");
      if (d) return "marked as a repeat of ZP-" + d[1];
      return ev;
    }
    function picHtml(url) {
      return '<a class="zpb-pic" href="' + esc(url) + '" target="_blank" rel="noopener"><img src="' + esc(url) + '" alt=""></a>';
    }
    function paintDrawer() {
      var r = S.open;
      if (!r) return;
      var head = '<div class="zpb-dh"><b>' + esc(r.key) + '</b><span class="zpb-sp"></span>'
        + '<button type="button" class="zpb-x" data-a="x" aria-label="Close">×</button></div>';
      if (r.loading || r.error) {
        drawer.innerHTML = head + '<div class="zpb-db"><div class="zpb-empty">' + esc(r.error || "Loading…") + "</div></div>";
        drawer.querySelector('[data-a="x"]').onclick = closeDrawer;
        return;
      }
      var place = r.place || {};
      var pageLink = r.page_id ? '<a href="#page=' + esc(r.page_id) + '" data-a="page">' + esc(r.page_title || r.page_id) + "</a>" : esc(r.page_title || "—");
      drawer.innerHTML = head + '<div class="zpb-db">'
        + '<div class="zpb-t">' + esc(r.title) + "</div>"
        + '<div class="zpb-meta">' + (r.kind === "bug" ? "Bug" : "Request") + " from <b>" + esc(r.reporter || r.reporter_email) + "</b> · "
        + esc(when(r.created_at)) + " · " + pageLink + "</div>"
        + '<div class="zpb-ctl"><div class="rs-seg" id="zpbSt">' + ["new", "in_progress", "done", "declined"].map(function (s) {
          return '<button type="button" data-s="' + s + '" class="' + (r.status === s ? "on" : "") + '">' + STATUS[s] + "</button>";
        }).join("") + "</div>"
        + '<select class="rs-sel zpb-sel" id="zpbPrio" title="Priority">' + PRIO.map(function (p) {
          return '<option value="' + p + '"' + (r.priority === p ? " selected" : "") + ">" + p[0].toUpperCase() + p.slice(1) + "</option>";
        }).join("") + "</select>"
        + '<select class="rs-sel zpb-sel" id="zpbKindSel" title="Kind"><option value="bug"' + (r.kind === "bug" ? " selected" : "")
        + '>Bug</option><option value="request"' + (r.kind === "request" ? " selected" : "") + ">Request</option></select>"
        + '<button type="button" class="rs-btn" data-a="dup">Repeat of…</button></div>'
        + (r.status_at ? '<div class="zpb-small">' + esc(STATUS[r.status]) + " since " + esc(when(r.status_at)) + (r.status_by ? " · by " + esc(r.status_by) : "") + "</div>" : "")
        + (r.duplicate_of ? '<div class="zpb-small">Repeats <a href="#" data-open="' + esc(r.duplicate_of) + '">' + esc(r.duplicate_of) + "</a></div>" : "")
        + ((r.duplicates || []).length ? '<div class="zpb-small">Repeated by ' + r.duplicates.map(function (k) {
          return '<a href="#" data-open="' + esc(k) + '">' + esc(k) + "</a>";
        }).join(", ") + "</div>" : "")
        + '<div class="zpb-txt">' + esc(r.body) + "</div>"
        + (r.expected ? '<div class="zpb-lab">Expected</div><div class="zpb-txt">' + esc(r.expected) + "</div>" : "")
        + ((r.images || []).length ? '<div class="zpb-pics">' + r.images.map(function (i) { return picHtml(i.url); }).join("") + "</div>" : "")
        + '<details class="zpb-place"><summary>Sent from</summary><div>'
        + (place.url ? '<div class="zpb-small zpb-wrap">' + esc(place.url) + "</div>" : "")
        + '<div class="zpb-small">Screen ' + esc(place.screen || "?") + " · " + esc(place.ua || "") + "</div>"
        + ((place.errors || []).length ? '<div class="zpb-lab">The tab\'s last errors</div><pre class="zpb-pre">' + esc(place.errors.join("\n")) + "</pre>"
          : '<div class="zpb-small">No script errors in the tab.</div>')
        + "</div></details>"
        + ((r.links || []).length ? '<div class="zpb-lab">Commits</div>' + r.links.map(function (l) {
          return '<div class="zpb-small"><a href="https://github.com/TornikeZ2Z/ztz-data-control/commit/' + esc(l.sha) + '" target="_blank" rel="noopener">'
            + esc(l.sha.slice(0, 9)) + "</a> " + esc(l.title || "") + (l.closes ? " · closed it" : "") + "</div>";
        }).join("") : "")
        + '<div class="zpb-lab">Thread</div><div class="zpb-thread">' + ((r.thread || []).length ? r.thread.map(function (c) {
          if (c.event) return '<div class="zpb-ev">' + esc(c.author) + " " + esc(evText(c.event)) + " · " + ago(c.at) + "</div>";
          return '<div class="zpb-msg' + (c.staff ? " staff" : "") + '"><div class="zpb-who">' + esc(c.author) + " <span>· " + esc(when(c.at)) + "</span></div>"
            + (c.body ? '<div class="zpb-txt">' + esc(c.body) + "</div>" : "")
            + ((c.images || []).length ? '<div class="zpb-pics">' + c.images.map(function (i) { return picHtml(i.url); }).join("") + "</div>" : "")
            + "</div>";
        }).join("") : '<div class="zpb-small">No replies yet.</div>') + "</div>"
        + '<textarea class="rs-inp zpb-reply" id="zpbReply" placeholder="Reply to ' + esc(r.reporter || "the sender") + '. They see it next time they open the button (no email). Ctrl+V pastes a picture; Ctrl+Enter sends."></textarea>'
        + '<div class="zpb-pics" id="zpbRPics"></div>'
        + '<div class="zpb-foot"><span class="zpb-sp"></span><button type="button" class="rs-btn pri" data-a="reply">Send reply</button></div>'
        + "</div>";
      drawer.querySelector('[data-a="x"]').onclick = closeDrawer;
      var pg = drawer.querySelector('[data-a="page"]');
      if (pg) pg.onclick = function () { closeDrawer(); };
      drawer.querySelectorAll("[data-open]").forEach(function (a) {
        a.onclick = function (e) { e.preventDefault(); openDrawer(a.getAttribute("data-open")); };
      });
      drawer.querySelectorAll("#zpbSt [data-s]").forEach(function (b) {
        b.onclick = function () { move(r, b.getAttribute("data-s")); };
      });
      drawer.querySelector("#zpbPrio").onchange = function (e) { field(r, "priority", e.target.value); };
      drawer.querySelector("#zpbKindSel").onchange = function (e) { field(r, "kind", e.target.value); };
      drawer.querySelector('[data-a="dup"]').onclick = function () { dup(r); };
      var ta = drawer.querySelector("#zpbReply"), pics = drawer.querySelector("#zpbRPics");
      var repaintPics = function () {
        pics.innerHTML = S.replyPics.map(function (p, i) {
          return '<span class="zpb-pic"><img src="' + esc(p) + '" alt=""><button type="button" data-rm="' + i + '">×</button></span>';
        }).join("");
        pics.querySelectorAll("[data-rm]").forEach(function (b) {
          b.onclick = function () { S.replyPics.splice(+b.getAttribute("data-rm"), 1); repaintPics(); };
        });
      };
      repaintPics();
      ta.addEventListener("paste", function (e) {
        var items = (e.clipboardData && e.clipboardData.items) || [];
        for (var i = 0; i < items.length; i++) {
          if (items[i].kind !== "file") continue;
          var f = items[i].getAsFile();
          if (!f || !/^image\//.test(f.type)) continue;
          e.preventDefault();
          if (S.replyPics.length >= 3) { toast("Up to 3 pictures in a reply."); break; }
          shrink(f).then(function (d) { if (d) { S.replyPics.push(d); repaintPics(); } });
        }
      });
      ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); });
      drawer.querySelector('[data-a="reply"]').onclick = sendReply;
      function sendReply() {
        var text = ta.value.trim();
        if (!text && !S.replyPics.length) { toast("Write something first."); return; }
        post({ action: "reply", id: r.key, body: text, images: S.replyPics.map(function (p) { return { b64: p }; }) })
          .then(function () { S.replyPics = []; return refresh(r.key); })
          .catch(function (e) { toast(e.message); });
      }
    }
    function shrink(file) {
      return new Promise(function (ok) {
        var img = new Image(), url = URL.createObjectURL(file);
        img.onload = function () {
          var k = Math.min(1, 1600 / img.naturalWidth), c = document.createElement("canvas");
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
          URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = function () { URL.revokeObjectURL(url); ok(null); };
        img.src = url;
      });
    }
    function refresh(key) {
      return load().then(function () { paintTabs(); paintList(); if (key) return openDrawer(key); });
    }
    function emailed(j) {
      var e = j.emails || {}, k = Object.keys(e)[0];
      if (!k) return "";
      return { sent: " The sender was emailed.", already: " (They were emailed about this before.)",
        skipped: "", failed: " The email did not go out." }[e[k]] || "";
    }
    function move(r, s) {
      if (s === r.status) return;
      var go;
      if (s === "declined") {
        go = RSC.ask({ title: "Decline " + r.key, body: "Why will it not be done? The sender reads this in their email.",
          placeholder: "e.g. The page already does this under Filters", yes: "Decline" }).then(function (why) {
          if (why == null) return null;
          if (why.trim().length < 5) { toast("Say why, in a few words: the sender reads it."); return null; }
          return post({ action: "status", id: r.key, status: s, reason: why });
        });
      } else if (s === "done") {
        go = RSC.ask({ title: "Mark " + r.key + " done", body: "What changed? This goes to the sender in their email. Leave it empty to just say it is done.",
          placeholder: "e.g. The August totals now match the Monthly Report", yes: "Mark done" }).then(function (note) {
          if (note == null) return null;
          return post({ action: "status", id: r.key, status: s, note: note });
        });
      } else {
        go = post({ action: "status", id: r.key, status: s });
      }
      Promise.resolve(go).then(function (j) {
        if (!j) return;
        toast(r.key + " is " + STATUS[s].toLowerCase() + "." + emailed(j));
        return refresh(r.key);
      }).catch(function (e) { toast(e.message); });
    }
    function field(r, f, v) {
      var b = { action: f, id: r.key }; b[f] = v;
      post(b).then(function () { return refresh(r.key); }).catch(function (e) { toast(e.message); });
    }
    function dup(r) {
      RSC.ask({ title: r.key + " repeats…", body: "Which request does it repeat? It is declined, and the sender is pointed at that one.",
        placeholder: "ZP-9", yes: "Mark as a repeat" }).then(function (of) {
        if (of == null || !of.trim()) return;
        return post({ action: "duplicate", id: r.key, of: of.trim() }).then(function (j) {
          toast(r.key + " is marked as a repeat of " + j.duplicate_of + "." + emailed(j));
          return refresh(r.key);
        });
      }).catch(function (e) { toast(e.message); });
    }

    /* ---------------------------------------------------------------- tokens */
    function loadTokens() {
      return api(null, "?tokens=1").then(function (j) { S.tokens = j.tokens || []; })
        .catch(function (e) { S.tokens = { error: e.message }; });
    }
    function paintTokens() {
      var box = host.querySelector("#zpbTokens"), t = S.tokens;
      if (!t) { box.innerHTML = '<div class="zpb-small">Loading…</div>'; return; }
      if (t.error) { box.innerHTML = '<div class="zpb-small">' + esc(t.error) + "</div>"; return; }
      if (!t.length) { box.innerHTML = '<div class="zpb-small">No tokens yet.</div>'; return; }
      box.innerHTML = '<div class="rs-tablewrap"><table class="rs-table"><thead><tr><th>Name</th><th>Starts with</th><th>Made</th>'
        + "<th>Expires</th><th>Last used</th><th>State</th><th></th></tr></thead><tbody>" + t.map(function (k) {
          return "<tr><td class=\"strong\">" + esc(k.name) + '</td><td class="nowrap dim"><code>' + esc(k.prefix) + "…</code></td>"
            + '<td class="nowrap dim">' + esc(when(k.created_at)) + '</td><td class="nowrap dim">' + esc(when(k.expires_at)) + "</td>"
            + '<td class="nowrap dim">' + (k.last_used_at ? esc(ago(k.last_used_at)) : "never") + "</td>"
            + '<td><span class="rs-pill ' + ({ active: "ok", expired: "mute", revoked: "mute" }[k.state] || "mute") + '">' + esc(k.state) + "</span></td>"
            + "<td>" + (k.state === "active" ? '<button type="button" class="rs-btn" data-rv="' + k.id + '">Revoke</button>' : "") + "</td></tr>";
        }).join("") + "</tbody></table></div>";
      box.querySelectorAll("[data-rv]").forEach(function (b) {
        b.onclick = function () {
          RSC.confirm({ title: "Revoke this token?", body: "Any chat using it stops reading the board at once.", yes: "Revoke", danger: true })
            .then(function (ok) {
              if (!ok) return;
              return post({ action: "token_revoke", token_id: +b.getAttribute("data-rv") }).then(function () {
                toast("Revoked."); return loadTokens().then(paintTokens);
              });
            }).catch(function (e) { toast(e.message); });
        };
      });
    }
    host.querySelector("#zpbMint").onclick = function () {
      RSC.ask({ title: "New Claude Code token", body: "Name it after the chat or the machine it is for. It works for 90 days.",
        placeholder: "e.g. ZtZ portal chats", yes: "Make the token" }).then(function (name) {
        if (name == null || !name.trim()) return;
        return post({ action: "token_mint", name: name.trim(), days: 90 }).then(function (j) {
          var tok = (j.parts || []).join("");
          showToken(tok);
          return loadTokens().then(paintTokens);
        });
      }).catch(function (e) { toast(e.message); });
    };
    /* the kit's own dialog, with the token in its (selected) field: Copy puts it on the clipboard */
    function showToken(tok) {
      RSC.ask({ title: "Your new token", value: tok, yes: "Copy", no: "Close",
        body: "Copy it now: it is not shown again. Store it as the secret zp-requests-token in project "
          + "contracts-management-3, or give it to the chat as ZP_REQUESTS_TOKEN." }).then(function (v) {
        if (v == null) return;
        (navigator.clipboard ? navigator.clipboard.writeText(tok) : Promise.reject())
          .then(function () { toast("Copied. It is not shown again."); })
          .catch(function () { toast("Could not copy: make a new token and copy it by hand."); });
      });
    }

    /* ---------------------------------------------------------------- wiring */
    host.querySelectorAll("#zpbKind [data-k]").forEach(function (b) {
      b.onclick = function () { S.kind = b.getAttribute("data-k"); paintTabs(); paintList(); };
    });
    var qEl = host.querySelector("#zpbQ");
    qEl.oninput = function () { S.q = qEl.value; paintList(); };

    window.ZPBoard = { open: function (k) { if (k) openDrawer(k); } };
    await Promise.all([load(), loadTokens()]);
    paintTabs(); paintList(); paintTokens();
    var deep = window.ZPB && ZPB.takeDeep && ZPB.takeDeep();
    if (deep) openDrawer(deep);
  },
});

function injectStyle() {
  if (document.getElementById("zpb-style")) return;
  var st = document.createElement("style");
  st.id = "zpb-style";
  st.textContent = [
    ".zpb{position:relative}",
    ".zpb-bar{gap:10px;margin-bottom:12px}",
    ".zpb-q{min-width:240px;flex:1;max-width:360px}",
    ".zpb-n{font-weight:500;opacity:.65;margin-left:2px}",
    ".zpb-empty{color:var(--muted);padding:34px 12px;text-align:center;font-size:14px;line-height:1.5}",
    ".zpb-table td{vertical-align:middle}",
    ".zpb-th{width:62px;padding-top:4px;padding-bottom:4px}",
    ".zpb-th img{width:56px;height:36px;object-fit:cover;border-radius:5px;border:1px solid var(--line);display:block}",
    ".zpb-title{font-weight:600;min-width:220px}",
    ".zpb-dot{display:inline-block;width:7px;height:7px;border-radius:4px;background:var(--neg);margin-left:7px;vertical-align:middle}",
    ".zpb-rc{font-weight:500;font-size:11.5px;color:var(--muted);margin-left:8px}",
    "tr.zpb-on td{background:var(--panel-2)}",
    ".zpb-tokens{margin-top:22px}",
    ".zpb-tokens .panel-head{display:flex;align-items:center;justify-content:space-between}",
    ".zpb-tokens code,.zpb-db code{font-size:12px}",
    ".zpb-mask{position:fixed;inset:0;background:rgba(15,23,42,.16);z-index:300}",
    ".zpb-drawer{position:fixed;top:0;right:0;bottom:0;width:min(620px,100vw);z-index:301;background:var(--panel);",
    "border-left:1px solid var(--line);box-shadow:-18px 0 50px rgba(15,23,42,.16);display:flex;flex-direction:column}",
    ".zpb-drawer[hidden],.zpb-mask[hidden]{display:none}",
    ".zpb-dh{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:1px solid var(--line);font-size:15px}",
    ".zpb-sp{flex:1}",
    ".zpb-x{border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;cursor:pointer}",
    ".zpb-db{flex:1;overflow:auto;padding:16px 18px 22px}",
    ".zpb-t{font-size:17px;font-weight:700;line-height:1.35;letter-spacing:-.2px}",
    ".zpb-meta{font-size:12.5px;color:var(--muted);margin:5px 0 12px}",
    ".zpb-meta a,.zpb-small a{color:var(--brand)}",
    ".zpb-ctl{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px}",
    ".zpb-sel{min-width:0;width:auto}",
    ".zpb-small{font-size:12px;color:var(--muted);margin:3px 0;line-height:1.45}",
    ".zpb-wrap{word-break:break-all}",
    ".zpb-txt{font-size:14px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word;margin-top:10px}",
    ".zpb-lab{font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--muted);margin:16px 0 6px}",
    ".zpb-pics{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}",
    ".zpb-pic{display:block;position:relative;max-width:100%;border:1px solid var(--line);border-radius:8px;overflow:hidden;background:var(--panel-2)}",
    ".zpb-pic img{display:block;max-width:100%;max-height:340px}",
    ".zpb-pics .zpb-pic button{position:absolute;top:4px;right:4px;width:20px;height:20px;border-radius:10px;border:0;",
    "background:rgba(15,23,42,.72);color:#fff;cursor:pointer;padding:0;line-height:20px}",
    "#zpbRPics .zpb-pic img{max-height:80px}",
    ".zpb-place{margin-top:14px;border:1px solid var(--line);border-radius:8px;padding:8px 11px}",
    ".zpb-place summary{cursor:pointer;font-size:12.5px;font-weight:600;color:var(--muted)}",
    ".zpb-pre{font-size:11.5px;white-space:pre-wrap;background:var(--panel-2);border-radius:6px;padding:8px;margin:0}",
    ".zpb-thread{display:flex;flex-direction:column;gap:8px}",
    ".zpb-msg{border:1px solid var(--line);border-radius:10px;padding:8px 11px;background:var(--panel-2)}",
    ".zpb-msg.staff{background:var(--panel);border-color:var(--line-2)}",
    ".zpb-who{font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:2px}.zpb-who span{font-weight:500}",
    ".zpb-msg .zpb-txt{margin-top:2px}",
    ".zpb-ev{font-size:12px;color:var(--muted);text-align:center}",
    ".zpb-reply{width:100%;box-sizing:border-box;min-height:84px;margin-top:14px;resize:vertical;font-family:inherit}",
    ".zpb-foot{display:flex;align-items:center;margin-top:8px}",
  ].join("");
  document.head.appendChild(st);
}
