/* ERP BUG BRIEFS — the ERP test team's tracker as a live document, one brief per ERP page.
 *
 * His ask (2026-09-10): the Slack bugs tracker (#z2z-soft-test-team) grouped, combined and
 * polished into tasks; every unclear point flagged as a question with a name to ask; split
 * by ERP page so each brief can be handed to its own development chat; and live, so the
 * team keeps it current here instead of in Slack threads.
 *
 * One brief = one ERP page/module. Inside it: tasks (T1, T2 …) with priority, status, a
 * markdown body and notes; questions (Q1, Q2 …) tied to tasks, answered in place; the
 * "already shipped — verify" rows the deploy bot's release notes identified; and an
 * activity feed of every edit. "Copy as markdown" produces the hand-off a development
 * chat reads (the same text the bridge serves at /api/_erpbrief?key=…&format=md).
 *
 * /api/_erpbrief sits ABOVE the ACL gate (the _work precedent): the testers hold no report
 * grants and must still answer here.
 */
(function () {
  var STATUSES = ["Open", "Needs clarification", "Ready", "In dev", "Done (dev)", "Verify",
                  "Verified", "Dropped"];
  var TONE = { "Open": "info", "Needs clarification": "warn", "Ready": "ok", "In dev": "ok",
               "Done (dev)": "ok", "Verify": "warn", "Verified": "ok", "Dropped": "mute" };
  var PRIO_TONE = { P1: "bad", P2: "warn", P3: "mute" };
  var OPEN_STATUSES = ["Open", "Needs clarification", "Ready", "In dev"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fmtDate(v) {
    v = String(v || "");
    if (!v) return "";
    var d = new Date(v.slice(0, 10) + "T12:00:00");
    return isNaN(d) ? v.slice(0, 10) : d.toLocaleDateString(undefined,
      { month: "short", day: "numeric" });
  }
  function fmtWhen(v) {
    v = String(v || "");
    return v ? fmtDate(v) + (v.length > 10 ? " " + v.slice(11, 16) : "") : "";
  }
  function who(email) {
    var s = String(email || "");
    return s.indexOf("@") > 0 ? s.split("@")[0] : s;
  }

  /* ---------------------------------------------------------------- markdown */
  // The subset the briefs use: headings, paragraphs, bullet/numbered lists, GFM tables,
  // blockquotes, bold / italic / code / links. Escaped first, so nothing in a brief runs.
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<i>$2</i>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }
  function md(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var out = [], i = 0, para = [];
    function flush() {
      if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
    }
    while (i < lines.length) {
      var ln = lines[i];
      var h = /^(#{1,6})\s+(.*)$/.exec(ln);
      if (h) {
        flush();
        var lvl = Math.min(h[1].length + 2, 6);
        out.push("<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">"); i++; continue;
      }
      if (/^\|/.test(ln) && i + 1 < lines.length && /^\|\s*:?-+/.test(lines[i + 1])) {
        flush();
        var cells = function (r) {
          return r.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
        };
        var head = cells(ln); i += 2; var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="rs-tablewrap"><table class="rs-table erb-md-t"><thead><tr>'
          + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("")
          + "</tr></thead><tbody>" + rows.map(function (r) {
              return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; })
                .join("") + "</tr>";
            }).join("") + "</tbody></table></div>");
        continue;
      }
      if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
        flush();
        var ordered = /^\s*\d+\./.test(ln), items = [];
        while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
          items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); i++;
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.map(function (t) {
          return "<li>" + inline(t) + "</li>";
        }).join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }
      if (/^>\s?/.test(ln)) {
        flush(); var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>");
        continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln.trim()); i++;
    }
    flush();
    return out.join("");
  }

  /* --------------------------------------------------------------------- css */
  function injectStyle() {
    var old = document.getElementById("erb-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "erb-style";
    st.textContent = ""
      + ".erb{font-variant-numeric:tabular-nums}"
      + ".erb-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 14px}"
      + ".erb-tab{font-family:inherit;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);border-radius:10px;padding:6px 12px;font-size:12.5px;"
      + "font-weight:700;cursor:pointer;display:inline-flex;gap:7px;align-items:center;"
      + "transition:color .12s,border-color .12s}"
      + ".erb-tab:hover{color:var(--ink);border-color:var(--line-2)}"
      + ".erb-tab.on{border-color:var(--brand);color:var(--brand);background:var(--brand-glow)}"
      + ".erb-tab .n{font-size:10.5px;font-weight:700;padding:1px 6px;border-radius:999px;"
      + "background:var(--panel-2);color:var(--muted)}"
      + ".erb-tab .q{background:var(--warn-bg,var(--panel-2));color:var(--warn)}"
      + ".erb-head{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;margin:0 0 6px}"
      + ".erb-head h2{font-size:18px;margin:0;flex:1 1 320px;line-height:1.3}"
      + ".erb-head .acts{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;color:var(--muted);"
      + "margin:0 0 14px}"
      + ".erb-meta b{color:var(--ink);font-weight:600}"
      + ".erb-sec{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin:22px 0 8px;display:flex;align-items:center;gap:8px}"
      + ".erb-sec::after{content:'';flex:1;height:1px;background:var(--line)}"
      + ".erb-sec .r{font-weight:600;letter-spacing:0;text-transform:none;color:var(--muted)}"
      + ".erb-chips{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 10px}"
      + ".erb-chip{font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:999px;"
      + "border:1px solid var(--line);background:var(--panel);color:var(--muted);"
      + "cursor:pointer;user-select:none;transition:all .12s}"
      + ".erb-chip:hover{border-color:var(--brand);color:var(--brand)}"
      + ".erb-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".erb-chip small{font-weight:600;opacity:.75;margin-left:4px}"
      + ".erb .rs-table td{vertical-align:middle}"
      + ".erb-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11.5px;"
      + "font-weight:700;color:var(--brand);background:var(--brand-glow);padding:2px 6px;"
      + "border-radius:5px;white-space:nowrap}"
      + ".erb-qn{font-size:11px;font-weight:700;color:var(--warn)}"
      // rendered markdown
      + ".erb-md{font-size:13.5px;line-height:1.6;color:var(--ink);max-width:78ch}"
      + ".erb-md p{margin:6px 0}.erb-md ul,.erb-md ol{margin:6px 0 8px;padding-left:20px}"
      + ".erb-md li{margin:2px 0}.erb-md h3,.erb-md h4,.erb-md h5{margin:14px 0 4px;"
      + "font-size:13px;font-weight:800}"
      + ".erb-md code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;"
      + "background:var(--panel-2);padding:1px 5px;border-radius:4px}"
      + ".erb-md blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--warn);"
      + "background:var(--panel-2);border-radius:0 8px 8px 0;color:var(--muted)}"
      + ".erb-md a{color:var(--brand)}"
      + ".erb-md .rs-tablewrap{margin:8px 0}.erb-md-t td,.erb-md-t th{font-size:12.5px}"
      + ".erb-ctx{margin:0 0 6px}.erb-ctx summary{cursor:pointer;font-size:12.5px;"
      + "font-weight:700;color:var(--muted);list-style:none;display:inline-flex;gap:6px}"
      + ".erb-ctx summary::before{content:'▸'}.erb-ctx[open] summary::before{content:'▾'}"
      + ".erb-ctx .erb-md{padding:8px 0 4px}"
      // questions
      + ".erb-q{border:1px solid var(--line);border-radius:12px;padding:12px 14px;"
      + "margin:0 0 8px;background:var(--panel)}"
      + ".erb-q.done{opacity:.72}"
      + ".erb-q .qh{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:12px;"
      + "color:var(--muted);margin-bottom:5px}"
      + ".erb-q .qt{font-size:13.5px;line-height:1.5;color:var(--ink);margin:0 0 8px}"
      + ".erb-q .qa{display:flex;gap:8px;align-items:flex-start}"
      + ".erb-q .qa textarea{flex:1}"
      + ".erb-q .ans{font-size:13px;line-height:1.55;padding:8px 11px;border-radius:9px;"
      + "background:var(--pos-bg,var(--panel-2));border:1px solid var(--line)}"
      + ".erb-q .ans .by{font-size:11px;color:var(--faint);font-weight:700;margin-bottom:2px}"
      // inputs
      + ".erb-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:9px;color:var(--ink);padding:8px 11px;font-size:13px;"
      + "outline:0;transition:border-color .12s}"
      + ".erb-in:focus{border-color:var(--brand)}"
      + "textarea.erb-in{min-height:72px;resize:vertical;line-height:1.5}"
      + "textarea.erb-in.big{min-height:280px;font-family:ui-monospace,Menlo,Consolas,"
      + "monospace;font-size:12.5px}"
      + ".erb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}"
      + ".erb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 4px}"
      // activity
      + ".erb-act{padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px;"
      + "line-height:1.5;color:var(--muted)}"
      + ".erb-act b{color:var(--ink);font-weight:600}"
      + ".erb-act .d{color:var(--faint);font-size:11px;margin-right:6px}"
      + ".erb-act .v{color:var(--ink)}"
      + ".erb-empty{padding:22px;text-align:center;color:var(--faint);font-size:13px}"
      // drawer
      + ".erb-overlay{position:fixed;inset:0;background:rgba(10,16,24,.45);z-index:60;"
      + "display:flex;justify-content:flex-end;animation:erbFade .15s ease}"
      + "@keyframes erbFade{from{opacity:0}to{opacity:1}}"
      + ".erb-drawer{width:min(760px,96vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:22px 26px 44px;box-shadow:-14px 0 44px rgba(0,0,0,.28);"
      + "animation:erbSlide .18s ease}"
      + "@keyframes erbSlide{from{transform:translateX(40px);opacity:.4}"
      + "to{transform:translateX(0);opacity:1}}"
      + ".erb-dhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:6px}"
      + ".erb-dhead h2{font-size:18px;line-height:1.3;margin:0;flex:1}"
      + ".erb-strip{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px}"
      + ".erb-stbtn{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;"
      + "border-radius:999px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;transition:all .12s}"
      + ".erb-stbtn:hover{border-color:var(--brand);color:var(--brand)}"
      + ".erb-stbtn.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".erb-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);"
      + "background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;"
      + "padding:10px 18px;border-radius:10px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.3);"
      + "animation:erbFade .2s ease}"
      + ".erb-toast.err{background:var(--neg);color:#fff}"
      + "@media(max-width:700px){.erb-head h2{flex-basis:100%}}";
    document.head.appendChild(st);
  }

  /* --------------------------------------------------------------------- api */
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
    return api("/api/_erpbrief", { method: "POST", body: JSON.stringify(payload) });
  }
  function fetchMd(key) {
    return fetch(ZTZ.API + "/api/_erpbrief?key=" + encodeURIComponent(key) + "&format=md",
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  }
  function toast(msg, isErr) {
    var t = document.createElement("div");
    t.className = "erb-toast" + (isErr ? " err" : "");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 4200 : 2200);
  }
  function pill(text, tone) {
    return '<span class="rs-pill ' + (tone || "mute") + '">' + esc(text) + "</span>";
  }

  /* ------------------------------------------------------------------- state */
  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Loading briefs…</div>';
    var S = { host: host, key: null, list: null, data: null, status: "Open", q: "" };
    try { S.key = localStorage.getItem("erb-key") || null; } catch (e) { /* private mode */ }
    api("/api/_erpbrief").then(function (j) {
      S.list = j;
      var keys = j.briefs.map(function (b) { return b.Key; });
      if (!S.key || keys.indexOf(S.key) < 0) S.key = keys[0] || null;
      paintShell(S);
      if (S.key) loadBrief(S);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load — ' + esc(e.message) + "</div>";
    });
  }

  function refreshList(S) {
    return api("/api/_erpbrief").then(function (j) { S.list = j; paintTabs(S); });
  }

  function loadBrief(S) {
    var body = S.host.querySelector("#erbBody");
    if (body) body.innerHTML = '<div class="rs-loading" style="padding:18px">Opening…</div>';
    return api("/api/_erpbrief?key=" + encodeURIComponent(S.key)).then(function (j) {
      S.data = j;
      paintBrief(S);
    }).catch(function (e) {
      if (body) body.innerHTML = '<div class="panel">' + esc(e.message) + "</div>";
    });
  }

  /* ------------------------------------------------------------------- shell */
  function paintShell(S) {
    S.host.innerHTML = '<div class="erb">'
      + '<div class="rs-page-head"><h1>ERP Bug Briefs</h1>'
      + "<p>The ERP test team's bug tracker, grouped into tasks per ERP page. Each brief is "
      + "the hand-off for one development chat: tasks in priority order, every unclear point "
      + "flagged as a <b>question</b> with a name to ask, and the changes the deploy bot already "
      + "announced listed for retest. Answer questions and move statuses here — the markdown "
      + "a developer reads is generated from this page.</p></div>"
      + '<div class="erb-tabs" id="erbTabs"></div>'
      + '<div id="erbBody"></div></div>';
    paintTabs(S);
  }

  function paintTabs(S) {
    var el = S.host.querySelector("#erbTabs");
    if (!el) return;
    el.innerHTML = S.list.briefs.map(function (b) {
      var open = OPEN_STATUSES.reduce(function (n, st) { return n + (b.counts[st] || 0); }, 0);
      var short = String(b.Title).split(" · ").pop();
      return '<button class="erb-tab' + (b.Key === S.key ? " on" : "") + '" data-key="'
        + esc(b.Key) + '" title="' + esc(b.Title) + '">' + esc(short)
        + (open ? '<span class="n">' + open + "</span>" : "")
        + (b.open_questions ? '<span class="n q" title="open questions">❓ '
           + b.open_questions + "</span>" : "")
        + "</button>";
    }).join("");
    el.querySelectorAll("[data-key]").forEach(function (t) {
      t.onclick = function () {
        S.key = t.getAttribute("data-key"); S.status = "Open"; S.q = "";
        try { localStorage.setItem("erb-key", S.key); } catch (e) { /* ignore */ }
        paintTabs(S); loadBrief(S);
      };
    });
  }

  /* ------------------------------------------------------------------- brief */
  function openTasks(S) {
    return S.data.tasks.filter(function (t) { return OPEN_STATUSES.indexOf(t.Status) >= 0; });
  }
  function qOf(S, code) {
    return S.data.questions.filter(function (q) { return q["Task Code"] === code; });
  }
  function qOpen(S, code) {
    return qOf(S, code).filter(function (q) { return q.Status === "Open"; }).length;
  }

  function paintBrief(S) {
    var d = S.data, b = d.brief;
    var body = S.host.querySelector("#erbBody");
    var openQ = d.questions.filter(function (q) { return q.Status === "Open"; }).length;
    var todoShip = d.shipped.filter(function (s) { return !+s.Verified; }).length;
    body.innerHTML = ''
      + '<div class="erb-head"><h2>' + esc(b.Title) + "</h2>"
      + '<div class="acts">'
      + '<button class="rs-btn" id="erbCopy" title="the brief as markdown, for a development '
      + 'chat">Copy as markdown</button>'
      + '<button class="rs-btn" id="erbOpenMd" title="open the markdown in a new tab">Open</button>'
      + '<button class="rs-btn pri" id="erbAddTask">Add task</button>'
      + "</div></div>"
      + '<div class="erb-meta">'
      + "<span>Tester: <b>" + esc(b.Owner || "—") + "</b></span>"
      + "<span>ERP page: <b>" + esc(b["ERP Page"] || "—") + "</b></span>"
      + (b.Source ? "<span>Source: " + esc(b.Source) + "</span>" : "")
      + "<span>Updated " + esc(fmtWhen(b["Updated At"])) + "</span>"
      + "</div>"
      + '<details class="erb-ctx" id="erbCtx"><summary>Context</summary>'
      + '<div class="erb-md" id="erbCtxMd">' + md(b.Context) + "</div>"
      + '<div class="erb-row"><span class="rs-btn" id="erbCtxEdit" style="cursor:pointer">'
      + "Edit context</span></div></details>"
      + '<div class="erb-sec">Tasks <span class="r">' + openTasks(S).length + " open of "
      + d.tasks.length + "</span></div>"
      + '<div class="erb-chips" id="erbChips"></div>'
      + '<div id="erbTasks"></div>'
      + '<div class="erb-sec">Questions <span class="r">' + openQ + " open</span></div>"
      + '<div id="erbQs"></div>'
      + '<div class="erb-row"><input class="erb-in" id="erbQNew" placeholder="ask a new '
      + 'question…" style="flex:1 1 280px"><input class="erb-in" id="erbQWho" placeholder="ask: '
      + 'who" style="flex:0 1 140px"><input class="erb-in" id="erbQTask" placeholder="task, e.g. '
      + 'T2" style="flex:0 1 110px"><button class="rs-btn" id="erbQAdd">Add</button></div>'
      + '<div class="erb-sec">Already shipped — verify <span class="r">' + todoShip
      + " to retest</span></div>"
      + '<div id="erbShip"></div>'
      + '<div class="erb-sec">Activity</div><div id="erbAct"></div>'
      + '<div class="erb-row"><input class="erb-in" id="erbNote" placeholder="post a note on '
      + 'this brief…" style="flex:1"><button class="rs-btn" id="erbNoteAdd">Post</button></div>';

    body.querySelector("#erbCopy").onclick = function () {
      fetchMd(S.key).then(function (t) {
        return navigator.clipboard.writeText(t);
      }).then(function () { toast("Markdown copied — paste it to the development chat"); })
        .catch(function (e) { toast(e.message, true); });
    };
    body.querySelector("#erbOpenMd").onclick = function () {
      fetchMd(S.key).then(function (t) {
        var url = URL.createObjectURL(new Blob([t], { type: "text/plain;charset=utf-8" }));
        window.open(url, "_blank");
      }).catch(function (e) { toast(e.message, true); });
    };
    body.querySelector("#erbAddTask").onclick = function () { openTask(S, null); };
    body.querySelector("#erbCtxEdit").onclick = function () { editContext(S); };
    body.querySelector("#erbQAdd").onclick = function () {
      var q = body.querySelector("#erbQNew").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      post({ action: "question_add", key: S.key, question: q,
             ask: body.querySelector("#erbQWho").value.trim(),
             task_code: body.querySelector("#erbQTask").value.trim().toUpperCase() })
        .then(function () { toast("Question added"); return loadBrief(S); })
        .then(function () { return refreshList(S); })
        .catch(function (e) { toast(e.message, true); });
    };
    body.querySelector("#erbNoteAdd").onclick = function () {
      var t = body.querySelector("#erbNote").value.trim();
      if (!t) return;
      post({ action: "note", key: S.key, text: t })
        .then(function () { return loadBrief(S); })
        .catch(function (e) { toast(e.message, true); });
    };
    paintChips(S); paintTasks(S); paintQuestions(S); paintShipped(S); paintActivity(S);
  }

  function editContext(S) {
    var ctx = S.host.querySelector("#erbCtx");
    ctx.open = true;
    var mount = S.host.querySelector("#erbCtxMd");
    mount.innerHTML = '<textarea class="erb-in big" id="erbCtxTa">' + esc(S.data.brief.Context || "")
      + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="erbCtxSave">Save</button>'
      + '<button class="rs-btn" id="erbCtxCancel">Cancel</button></div>';
    mount.querySelector("#erbCtxCancel").onclick = function () { paintBrief(S); };
    mount.querySelector("#erbCtxSave").onclick = function () {
      post({ action: "brief_set", key: S.key, context: mount.querySelector("#erbCtxTa").value })
        .then(function () { toast("Saved"); return loadBrief(S); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  /* ------------------------------------------------------------------- tasks */
  function paintChips(S) {
    var counts = {};
    S.data.tasks.forEach(function (t) { counts[t.Status] = (counts[t.Status] || 0) + 1; });
    var chips = [["Open", openTasks(S).length], ["All", S.data.tasks.length]]
      .concat(STATUSES.filter(function (st) { return counts[st]; })
        .map(function (st) { return [st, counts[st]]; }));
    var el = S.host.querySelector("#erbChips");
    el.innerHTML = chips.map(function (c) {
      return '<span class="erb-chip' + (S.status === c[0] ? " on" : "") + '" data-st="'
        + esc(c[0]) + '">' + esc(c[0] === "Open" ? "Open (any working status)" : c[0])
        + "<small>" + c[1] + "</small></span>";
    }).join("");
    el.querySelectorAll("[data-st]").forEach(function (b) {
      b.onclick = function () { S.status = b.getAttribute("data-st"); paintChips(S); paintTasks(S); };
    });
  }

  function tasksOf(S) {
    return S.data.tasks.filter(function (t) {
      if (S.status === "Open") return OPEN_STATUSES.indexOf(t.Status) >= 0;
      if (S.status === "All") return true;
      return t.Status === S.status;
    });
  }

  function paintTasks(S) {
    var el = S.host.querySelector("#erbTasks");
    var items = tasksOf(S);
    if (!items.length) {
      el.innerHTML = '<div class="panel"><div class="erb-empty">Nothing in this status.</div></div>';
      return;
    }
    el.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>#</th><th>Task</th><th>Priority</th><th>Status</th><th>Questions</th>"
      + "<th>Assignee</th><th>Updated</th></tr></thead><tbody>"
      + items.map(function (t) {
          var nq = qOpen(S, t.Code), tq = qOf(S, t.Code).length;
          return '<tr class="click" data-open="' + esc(t.Code) + '">'
            + '<td><span class="erb-code">' + esc(t.Code) + "</span></td>"
            + '<td class="strong">' + esc(t.Title)
            + (t.Source ? ' <span class="dim" style="font-weight:500">· ' + esc(t.Source)
               + "</span>" : "") + "</td>"
            + "<td>" + pill(t.Priority, PRIO_TONE[t.Priority]) + "</td>"
            + "<td>" + pill(t.Status, TONE[t.Status]) + "</td>"
            + "<td>" + (nq ? '<span class="erb-qn">❓ ' + nq + " open</span>"
                        : (tq ? '<span class="dim">' + tq + " answered</span>" : "")) + "</td>"
            + "<td>" + esc(t.Assignee || "") + "</td>"
            + '<td class="dim nowrap">' + esc(fmtWhen(t["Updated At"])) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    el.querySelectorAll("[data-open]").forEach(function (r) {
      r.onclick = function () { openTask(S, r.getAttribute("data-open")); };
    });
  }

  /* --------------------------------------------------------------- questions */
  function questionCard(S, q, compact) {
    var task = S.data.tasks.filter(function (t) { return t.Code === q["Task Code"]; })[0];
    var open = q.Status === "Open";
    return '<div class="erb-q' + (open ? "" : " done") + '" data-q="' + esc(q.Code) + '">'
      + '<div class="qh"><span class="erb-code">' + esc(q.Code) + "</span>"
      + (task && !compact ? "<span>on <b>" + esc(task.Code) + "</b> " + esc(task.Title) + "</span>" : "")
      + (q.Ask ? "<span>ask: <b>" + esc(q.Ask) + "</b></span>" : "")
      + pill(q.Status, open ? "warn" : (q.Status === "Answered" ? "ok" : "mute"))
      + "</div>"
      + '<div class="qt">' + inline(q.Question) + "</div>"
      + (q.Answer
         ? '<div class="ans"><div class="by">' + esc(who(q["Answered By"])) + " · "
           + esc(fmtWhen(q["Answered At"])) + '</div><div class="erb-md">' + md(q.Answer) + "</div></div>"
           + '<div class="erb-row"><span class="rs-btn" data-qedit style="cursor:pointer">'
           + "Edit answer</span>"
           + (open ? "" : '<span class="rs-btn" data-qreopen style="cursor:pointer">Reopen</span>')
           + "</div>"
         : '<div class="qa"><textarea class="erb-in" placeholder="answer…" data-qta></textarea>'
           + '<button class="rs-btn pri" data-qsave>Save answer</button></div>'
           + '<div class="erb-row"><span class="rs-btn" data-qdrop style="cursor:pointer;'
           + 'font-size:11.5px">Drop the question</span></div>')
      + "</div>";
  }
  function wireQuestions(S, root, after) {
    root.querySelectorAll("[data-q]").forEach(function (card) {
      var code = card.getAttribute("data-q");
      function save(answer) {
        return post({ action: "question_set", key: S.key, code: code,
                      fields: { answer: answer } })
          .then(function () { toast("Answer saved"); return after(); })
          .catch(function (e) { toast(e.message, true); });
      }
      var sv = card.querySelector("[data-qsave]");
      if (sv) sv.onclick = function () {
        var a = card.querySelector("[data-qta]").value.trim();
        if (!a) { toast("Write the answer", true); return; }
        save(a);
      };
      var ed = card.querySelector("[data-qedit]");
      if (ed) ed.onclick = function () {
        var q = S.data.questions.filter(function (x) { return x.Code === code; })[0];
        var ans = card.querySelector(".ans");
        ans.outerHTML = '<div class="qa"><textarea class="erb-in" data-qta>' + esc(q.Answer)
          + '</textarea><button class="rs-btn pri" data-qsave>Save answer</button></div>';
        card.querySelector("[data-qsave]").onclick = function () {
          save(card.querySelector("[data-qta]").value.trim());
        };
      };
      var ro = card.querySelector("[data-qreopen]");
      if (ro) ro.onclick = function () {
        post({ action: "question_set", key: S.key, code: code, fields: { status: "Open" } })
          .then(after).catch(function (e) { toast(e.message, true); });
      };
      var dr = card.querySelector("[data-qdrop]");
      if (dr) dr.onclick = function () {
        post({ action: "question_set", key: S.key, code: code, fields: { status: "Dropped" } })
          .then(after).catch(function (e) { toast(e.message, true); });
      };
    });
  }
  function paintQuestions(S) {
    var el = S.host.querySelector("#erbQs");
    var qs = S.data.questions.slice().sort(function (a, b) {
      var oa = a.Status === "Open" ? 0 : 1, ob = b.Status === "Open" ? 0 : 1;
      return oa - ob || a.Code.localeCompare(b.Code, undefined, { numeric: true });
    });
    el.innerHTML = qs.map(function (q) { return questionCard(S, q, false); }).join("")
      || '<div class="panel"><div class="erb-empty">No questions on this brief.</div></div>';
    wireQuestions(S, el, function () {
      return loadBrief(S).then(function () { return refreshList(S); });
    });
  }

  /* ----------------------------------------------------------------- shipped */
  function paintShipped(S) {
    var el = S.host.querySelector("#erbShip");
    var rows = S.data.shipped;
    if (!rows.length) { el.innerHTML = '<div class="panel"><div class="erb-empty">Nothing announced for this page yet.</div></div>'; return; }
    el.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>Verified</th><th>What</th><th>Deploy</th><th>Retest by</th></tr></thead><tbody>"
      + rows.map(function (s) {
          return "<tr><td><input type=\"checkbox\" data-ship=\"" + s.id + '"'
            + (+s.Verified ? " checked" : "") + ' style="accent-color:var(--brand);width:15px;'
            + 'height:15px"></td><td' + (+s.Verified ? ' class="dim"' : "") + ">"
            + inline(s.What) + "</td><td class=\"dim nowrap\">" + esc(s.Deploy || "")
            + "</td><td>" + esc(s["Retest By"] || "")
            + (+s.Verified ? ' <span class="dim">· ' + esc(who(s["Verified By"])) + " "
               + esc(fmtDate(s["Verified At"])) + "</span>" : "") + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    el.querySelectorAll("[data-ship]").forEach(function (cb) {
      cb.onchange = function () {
        post({ action: "shipped_set", key: S.key, id: +cb.getAttribute("data-ship"),
               verified: cb.checked })
          .then(function () { return loadBrief(S); }).then(function () { return refreshList(S); })
          .catch(function (e) { cb.checked = !cb.checked; toast(e.message, true); });
      };
    });
  }

  /* ---------------------------------------------------------------- activity */
  function changeLine(c) {
    var what;
    if (c.Field === "Note") what = "noted: <span class=\"v\">" + inline(c.New) + "</span>";
    else if (c.Field === "Created") what = "created <b>" + esc(c["Entity Code"]) + "</b> " + esc(c.New);
    else if (c.Field === "Answer") what = "answered <b>" + esc(c["Entity Code"]) + "</b>";
    else if (c.Field === "Body" || c.Field === "Context" || c.Field === "Notes")
      what = "edited the " + esc(c.Field.toLowerCase()) + " of <b>" + esc(c["Entity Code"]) + "</b>";
    else what = "<b>" + esc(c["Entity Code"]) + "</b> " + esc(c.Field.toLowerCase()) + ": "
      + esc(c.Old || "—") + " → <span class=\"v\">" + esc(c.New || "—") + "</span>";
    return '<div class="erb-act"><span class="d">' + esc(fmtWhen(c.At)) + "</span><b>"
      + esc(who(c.By)) + "</b> " + what + "</div>";
  }
  function paintActivity(S) {
    var el = S.host.querySelector("#erbAct");
    var ch = S.data.changes.slice(0, 40);
    el.innerHTML = ch.map(changeLine).join("")
      || '<div class="erb-empty">No changes yet — everything here is as seeded.</div>';
  }

  /* ------------------------------------------------------------------ drawer */
  function drawerShell(S) {
    var ov = document.createElement("div");
    ov.className = "erb-overlay";
    ov.onclick = function (ev) { if (ev.target === ov) close(); };
    ov.innerHTML = '<div class="erb-drawer"><div class="rs-loading">Opening…</div></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); loadBrief(S).then(function () { return refreshList(S); }); }
    return { ov: ov, el: ov.querySelector(".erb-drawer"), close: close };
  }

  function openTask(S, code) {
    var dw = drawerShell(S);
    if (!code) { paintTaskEdit(S, dw, null); return; }
    paintTaskView(S, dw, code);
  }

  function taskChanges(S, code) {
    return S.data.changes.filter(function (c) {
      return c["Entity Code"] === code || (c.Entity === "question" && S.data.questions.some(
        function (q) { return q.Code === c["Entity Code"] && q["Task Code"] === code; }));
    });
  }

  function paintTaskView(S, dw, code) {
    var t = S.data.tasks.filter(function (x) { return x.Code === code; })[0];
    if (!t) { dw.close(); return; }
    var qs = qOf(S, code);
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><span class="erb-code" style="margin-top:4px">' + esc(t.Code)
      + "</span><h2>" + esc(t.Title) + "</h2>"
      + '<button class="rs-btn" id="dwEdit">Edit</button>'
      + '<button class="rs-btn" id="dwClose">✕</button></div>'
      + '<div class="erb-meta">' + pill(t.Priority, PRIO_TONE[t.Priority]) + pill(t.Status, TONE[t.Status])
      + (t.Source ? "<span>Source: " + esc(t.Source) + "</span>" : "")
      + "<span>Updated " + esc(fmtWhen(t["Updated At"])) + " by " + esc(who(t["Updated By"])) + "</span>"
      + "</div>"
      + '<div class="erb-strip" id="dwStrip">' + STATUSES.map(function (st) {
          return '<button class="erb-stbtn' + (t.Status === st ? " on" : "") + '" data-st="'
            + esc(st) + '">' + esc(st) + "</button>";
        }).join("") + "</div>"
      + '<div class="erb-row"><div style="flex:0 0 150px"><span class="erb-lbl">Priority</span>'
      + '<div id="dwPrio"></div></div>'
      + '<div style="flex:1 1 200px"><span class="erb-lbl">Assignee (chat, person…)</span>'
      + '<input class="erb-in" id="dwWho" value="' + esc(t.Assignee || "") + '"></div></div>'
      + '<div class="erb-sec">Spec</div><div class="erb-md">' + (md(t.Body) || '<p class="dim">no body yet</p>') + "</div>"
      + '<div class="erb-sec">Questions <span class="r">' + qOpen(S, code) + " open</span></div>"
      + '<div id="dwQs">' + (qs.map(function (q) { return questionCard(S, q, true); }).join("")
         || '<div class="erb-empty">No questions on this task.</div>') + "</div>"
      + '<div class="erb-row"><input class="erb-in" id="dwQNew" placeholder="ask a question '
      + 'about this task…" style="flex:1 1 220px"><input class="erb-in" id="dwQWho" placeholder='
      + '"ask: who" style="flex:0 1 130px"><button class="rs-btn" id="dwQAdd">Add</button></div>'
      + '<div class="erb-sec">Notes</div>'
      + '<textarea class="erb-in" id="dwNotes" placeholder="dev / tester notes — what was '
      + 'decided, what was done, where it is…">' + esc(t.Notes || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="dwNotesSave">Save notes</button></div>'
      + '<div class="erb-sec">Activity</div><div>' + (taskChanges(S, code).slice(0, 30).map(changeLine).join("")
         || '<div class="erb-empty">No changes yet.</div>') + "</div>";

    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#dwEdit").onclick = function () { paintTaskEdit(S, dw, t); };
    var hPrio = RSC.localSelect(dw.el.querySelector("#dwPrio"), {
      label: "Priority", values: ["P1", "P2", "P3"], value: t.Priority, form: true,
      required: true, onChange: function (v) { setField("priority", v); },
    });
    void hPrio;
    function setField(field, value) {
      var f = {}; f[field] = value;
      return post({ action: "task_set", key: S.key, code: code, fields: f })
        .then(function () { return api("/api/_erpbrief?key=" + encodeURIComponent(S.key)); })
        .then(function (j) { S.data = j; })
        .catch(function (e) { toast(e.message, true); throw e; });
    }
    dw.el.querySelectorAll("#dwStrip [data-st]").forEach(function (b) {
      b.onclick = function () {
        var st = b.getAttribute("data-st");
        if (st === "Ready" && qOpen(S, code)) {
          toast("Answer the open questions first — that is what Ready means", true); return;
        }
        setField("status", st).then(function () {
          dw.el.querySelectorAll("#dwStrip [data-st]").forEach(function (x) {
            x.classList.toggle("on", x.getAttribute("data-st") === st);
          });
          toast("Status: " + st);
        }).catch(function () {});
      };
    });
    var whoIn = dw.el.querySelector("#dwWho");
    whoIn.onchange = function () { setField("assignee", whoIn.value.trim()).then(function () { toast("Assignee saved"); }).catch(function () {}); };
    dw.el.querySelector("#dwNotesSave").onclick = function () {
      setField("notes", dw.el.querySelector("#dwNotes").value.trim())
        .then(function () { toast("Notes saved"); }).catch(function () {});
    };
    wireQuestions(S, dw.el.querySelector("#dwQs"), function () {
      return api("/api/_erpbrief?key=" + encodeURIComponent(S.key)).then(function (j) {
        S.data = j; paintTaskView(S, dw, code);
      });
    });
    dw.el.querySelector("#dwQAdd").onclick = function () {
      var q = dw.el.querySelector("#dwQNew").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      post({ action: "question_add", key: S.key, question: q, task_code: code,
             ask: dw.el.querySelector("#dwQWho").value.trim() })
        .then(function () { return api("/api/_erpbrief?key=" + encodeURIComponent(S.key)); })
        .then(function (j) { S.data = j; paintTaskView(S, dw, code); toast("Question added"); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  function paintTaskEdit(S, dw, t) {
    var v = t || { Title: "", Body: "", Priority: "P2", Source: "" };
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><h2>' + (t ? "Edit " + esc(t.Code) : "New task") + "</h2>"
      + '<button class="rs-btn" id="dwClose">✕</button></div>'
      + '<span class="erb-lbl">Title</span><input class="erb-in" id="eTitle" maxlength="300" '
      + 'value="' + esc(v.Title) + '">'
      + '<div class="erb-row"><div style="flex:0 0 150px"><span class="erb-lbl">Priority</span>'
      + '<div id="ePrio"></div></div>'
      + '<div style="flex:1"><span class="erb-lbl">Source (BT ids, Slack, who asked)</span>'
      + '<input class="erb-in" id="eSrc" value="' + esc(v.Source || "") + '"></div></div>'
      + '<span class="erb-lbl">Body — markdown: <b>Why.</b> / <b>Spec.</b> / <b>Acceptance.</b>'
      + "</span>"
      + '<textarea class="erb-in big" id="eBody">' + esc(v.Body || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="eSave">' + (t ? "Save" : "Create")
      + '</button><button class="rs-btn" id="eCancel">Cancel</button></div>';
    var hPrio = RSC.localSelect(dw.el.querySelector("#ePrio"), {
      label: "Priority", values: ["P1", "P2", "P3"], value: v.Priority || "P2", form: true,
      required: true,
    });
    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#eCancel").onclick = function () {
      if (t) paintTaskView(S, dw, t.Code); else dw.close();
    };
    dw.el.querySelector("#eSave").onclick = function () {
      var title = dw.el.querySelector("#eTitle").value.trim();
      var body = dw.el.querySelector("#eBody").value;
      var pr = hPrio.get() || "P2";
      var go = t
        ? post({ action: "task_set", key: S.key, code: t.Code,
                 fields: { title: title, body: body, priority: pr } })
        : post({ action: "task_add", key: S.key, title: title, body: body, priority: pr,
                 source: dw.el.querySelector("#eSrc").value.trim() });
      go.then(function (r) {
        toast(t ? "Saved" : "Created " + r.code);
        return api("/api/_erpbrief?key=" + encodeURIComponent(S.key));
      }).then(function (j) {
        S.data = j; paintTaskView(S, dw, t ? t.Code : j.tasks[j.tasks.length - 1].Code);
      }).catch(function (e) { toast(e.message, true); });
    };
  }

  if (window.registerPage) {
    registerPage({
      id: "erp-briefs",
      group: "company",
      title: "ERP Bug Briefs",
      render: render,
    });
  }
})();
