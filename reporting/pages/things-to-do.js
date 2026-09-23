/* THINGS TO DO (Tornike, 2026-09-23) — the dispatch flow of the ERP as one checklist, topic by
   topic in the order a job lives it, from the 22 Sep walkthrough with Bacho. It replaced the
   ERP Bug Briefs page ("I hate this page… give me a completely new page"). Reads and answers
   through /api/_todo (bridge handle_todo); the data is the erp_* tables. Visibility is this
   page's own grant, inherited through the departments like every other page. */

registerPage({
  id: "things-to-do",
  group: "tech",
  title: "Things to do",
  async render(host) {
    var esc = RSC.esc;
    injectStyle();

    var S = { data: null, open: {}, filter: "all" };
    try { S.filter = localStorage.getItem("ttd-filter") || "all"; } catch (e) { /* private mode */ }

    host.innerHTML = '<div class="ttd">'
      + '<div class="rs-page-head"><h1>Things to do</h1>'
      + "<p>The dispatch flow of the ERP, topic by topic in the order a job lives it — from the "
      + "22 Sep walkthrough with Bacho. Open an item for the detail; answer its question right "
      + "there.</p></div>"
      + '<div class="ttd-bar"><div class="ttd-sum" id="ttdSum"></div>'
      + '<div class="rs-seg" id="ttdFilter" role="tablist" aria-label="Show">'
      + '<button role="tab" data-f="all">Everything</button>'
      + '<button role="tab" data-f="ask">Needs an answer</button>'
      + '<button role="tab" data-f="p1">P1 only</button></div></div>'
      + '<div id="ttdBody"><div class="ttd-empty">Loading…</div></div></div>';

    host.querySelectorAll("#ttdFilter [data-f]").forEach(function (b) {
      b.onclick = function () {
        S.filter = b.getAttribute("data-f");
        try { localStorage.setItem("ttd-filter", S.filter); } catch (e) { /* ignore */ }
        paint();
      };
    });

    function api(opts) {
      return fetch(ZTZ.API + "/api/_todo", Object.assign({
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
      }, opts || {})).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (r.status === 403) throw new Error("Your account has no access to Things to do.");
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        });
      });
    }
    function load() { return api().then(function (j) { S.data = j; }); }

    /* ---------------------------------------------------------------- helpers */
    function short(title) { return String(title || "").split(" · ").pop(); }
    function area(title) { var t = String(title || ""); return t.indexOf(" · ") > 0 ? t.split(" · ")[0] : ""; }
    function who(email) {
      var n = String(email || "").split("@")[0].split(/[._]/)[0];
      return n ? n.charAt(0).toUpperCase() + n.slice(1) : "";
    }
    function day(iso) {
      var d = iso ? new Date(iso) : null;
      return d && !isNaN(d) ? d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "";
    }
    function inline(s) {
      return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
        .replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:]|$)/g, "$1<i>$2</i>");
    }
    function md(src) {
      var out = [], list = false;
      String(src || "").split("\n").forEach(function (line) {
        var m = /^\s*[-•]\s+(.*)$/.exec(line);
        if (m) {
          if (!list) { out.push("<ul>"); list = true; }
          out.push("<li>" + inline(m[1]) + "</li>");
          return;
        }
        if (list) { out.push("</ul>"); list = false; }
        if (line.trim()) out.push("<p>" + inline(line) + "</p>");
      });
      if (list) out.push("</ul>");
      return out.join("");
    }
    function qsOf(t) {
      return (S.data.questions || []).filter(function (q) {
        return q["Brief Key"] === t["Brief Key"] && q["Task Code"] === t.Code;
      });
    }
    function openQs(t) { return qsOf(t).filter(function (q) { return q.Status === "Open"; }); }
    function shown(t) {
      if (S.filter === "ask") return openQs(t).length > 0;
      if (S.filter === "p1") return t.Priority === "P1";
      return true;
    }
    function mark(t) {
      if (openQs(t).length) return '<span class="ttd-mk ask" title="Needs an answer">?</span>';
      if (t.Status === "Verify" || t.Status === "Done (dev)")
        return '<span class="ttd-mk done" title="Built — to retest">✓</span>';
      if (t.Status === "Ready") return '<span class="ttd-mk ready" title="Ready to build"></span>';
      return '<span class="ttd-mk" title="To do"></span>';
    }

    /* ------------------------------------------------------------------ paint */
    function paint() {
      host.querySelectorAll("#ttdFilter [data-f]").forEach(function (b) {
        b.classList.toggle("on", b.getAttribute("data-f") === S.filter);
        b.setAttribute("aria-selected", b.getAttribute("data-f") === S.filter ? "true" : "false");
      });
      var d = S.data, tasks = d.tasks || [];
      var ask = tasks.filter(function (t) { return openQs(t).length; }).length;
      var built = tasks.filter(function (t) { return t.Status === "Verify" || t.Status === "Done (dev)"; }).length;
      var oq = (d.questions || []).filter(function (q) { return q.Status === "Open"; }).length;
      host.querySelector("#ttdSum").innerHTML = "<b>" + (tasks.length - built) + "</b> to do · <b>"
        + oq + "</b> question" + (oq === 1 ? "" : "s") + " waiting on " + ask + " item" + (ask === 1 ? "" : "s")
        + (built ? " · <b>" + built + "</b> built, to retest" : "");

      var html = "", n = 0;
      (d.topics || []).forEach(function (tp) {
        var all = tasks.filter(function (t) { return t["Brief Key"] === tp.Key; })
          .sort(function (a, b) {
            var da = a.Status === "Verify" ? 1 : 0, db = b.Status === "Verify" ? 1 : 0;
            return (da - db) || String(a.Priority).localeCompare(String(b.Priority)) || (a.Sort - b.Sort);
          });
        var list = all.filter(shown);
        n++;
        if (!list.length) return;
        html += '<section class="ttd-topic">'
          + '<header><span class="ttd-n">' + n + '</span><div class="ttd-tt"><h2>' + esc(short(tp.Title))
          + "</h2><span>" + esc(area(tp.Title)) + "</span></div>"
          + '<span class="ttd-ct">' + list.length + (list.length !== all.length ? " of " + all.length : "")
          + "</span></header>"
          + '<div class="ttd-list">' + list.map(row).join("") + "</div></section>";
      });
      var body = host.querySelector("#ttdBody");
      body.innerHTML = html || '<div class="ttd-empty">Nothing here with this filter.</div>';
      wire(body);
    }

    function row(t) {
      var id = t["Brief Key"] + ":" + t.Code, isOpen = !!S.open[id];
      var oq = openQs(t);
      var asks = oq.map(function (q) { return q.Ask; }).filter(Boolean)
        .filter(function (v, i, a) { return a.indexOf(v) === i; });
      return '<div class="ttd-it' + (isOpen ? " open" : "") + (t.Status === "Verify" ? " built" : "") + '">'
        + '<button class="ttd-row" data-id="' + esc(id) + '" aria-expanded="' + isOpen + '">'
        + mark(t)
        + '<span class="ttd-p ' + esc(String(t.Priority).toLowerCase()) + '">' + esc(t.Priority) + "</span>"
        + '<span class="ttd-ti">' + esc(t.Title) + "</span>"
        + (asks.length ? '<span class="ttd-ask">? ' + esc(asks.join(", ")) + "</span>" : "")
        + '<span class="ttd-cv" aria-hidden="true"></span></button>'
        + (isOpen ? detail(t) : "") + "</div>";
    }

    function detail(t) {
      var qs = qsOf(t);
      return '<div class="ttd-det">'
        + '<div class="ttd-md">' + md(t.Body) + "</div>"
        + (qs.length ? '<div class="ttd-qs">' + qs.map(function (q) { return qBox(q); }).join("") + "</div>" : "")
        + '<div class="ttd-foot"><span>' + esc(t.Code) + (t.Status === "Verify" ? " · built, to retest" : "")
        + (t.Status === "Ready" ? " · ready to build" : "") + "</span>"
        + (t.Transcript ? '<a href="' + esc(t.Transcript) + '" target="_blank" rel="noopener">Where it came up ↗</a>' : "")
        + "</div></div>";
    }

    function qBox(q) {
      var qid = q["Brief Key"] + ":" + q.Code;
      var answered = q.Status === "Answered" && q.Answer;
      return '<div class="ttd-q' + (answered ? " ok" : "") + '" data-q="' + esc(qid) + '">'
        + '<div class="ttd-qh"><span class="ttd-qk">' + (answered ? "Answered" : "Question")
        + "</span>" + (q.Ask ? '<span class="ttd-qa">for ' + esc(q.Ask) + "</span>" : "") + "</div>"
        + '<div class="ttd-qt">' + inline(q.Question) + "</div>"
        + (answered
          ? '<div class="ttd-ans">' + md(q.Answer) + '<div class="ttd-by">' + esc(who(q["Answered By"]))
            + (q["Answered At"] ? " · " + esc(day(q["Answered At"])) : "")
            + ' · <button class="ttd-lk" data-edit>Change</button></div></div>'
          : "")
        + '<div class="ttd-form"' + (answered ? " hidden" : "") + ">"
        + '<textarea class="rs-inp" rows="2" aria-label="Your answer" placeholder="Your answer">'
        + esc(answered ? q.Answer : "") + "</textarea>"
        + '<div class="ttd-fr"><button class="rs-btn pri" data-save>Save answer</button>'
        + '<span class="ttd-msg" data-msg></span></div></div></div>';
    }

    function wire(root) {
      root.querySelectorAll(".ttd-row").forEach(function (b) {
        b.onclick = function () {
          var id = b.getAttribute("data-id");
          S.open[id] = !S.open[id];
          paint();
        };
      });
      root.querySelectorAll(".ttd-q").forEach(function (box) {
        var parts = box.getAttribute("data-q").split(":");
        var form = box.querySelector(".ttd-form"), ta = form.querySelector("textarea");
        var edit = box.querySelector("[data-edit]");
        if (edit) edit.onclick = function () { form.hidden = false; ta.focus(); };
        box.querySelector("[data-save]").onclick = function () {
          var btn = this, msg = box.querySelector("[data-msg]"), a = ta.value.trim();
          if (!a) { msg.textContent = "Write the answer first."; return; }
          btn.disabled = true; msg.textContent = "Saving…";
          api({ method: "POST", body: JSON.stringify({ action: "answer", key: parts[0], code: parts[1], answer: a }) })
            .then(load).then(paint)
            .catch(function (e) { btn.disabled = false; msg.textContent = e.message; });
        };
      });
    }

    try {
      await load();
      paint();
    } catch (e) {
      host.querySelector("#ttdBody").innerHTML = '<div class="ttd-empty">' + esc(e.message) + "</div>";
    }

    /* ------------------------------------------------------------------ style */
    function injectStyle() {
      if (document.getElementById("ttdCss")) return;
      var st = document.createElement("style");
      st.id = "ttdCss";
      st.textContent = `
        .ttd{max-width:980px}
        .ttd-bar{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;
          margin:4px 0 18px}
        .ttd-sum{color:var(--muted);font-size:13.5px}
        .ttd-sum b{color:var(--ink);font-weight:650}
        .ttd-empty{color:var(--muted);padding:28px 0}
        .ttd-topic{margin:0 0 22px}
        .ttd-topic > header{display:flex;align-items:center;gap:12px;padding:0 2px 8px;
          border-bottom:1px solid var(--line)}
        .ttd-n{flex:none;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
          font-size:12.5px;font-weight:650;color:var(--brand-ink);background:var(--brand)}
        .ttd-tt{flex:1;min-width:0;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
        .ttd-tt h2{margin:0;font-size:16px;font-weight:650;color:var(--ink)}
        .ttd-tt span{font-size:12px;color:var(--faint);text-transform:uppercase;letter-spacing:.04em}
        .ttd-ct{font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
        .ttd-list{display:flex;flex-direction:column}
        .ttd-it{border-bottom:1px solid var(--line-2)}
        .ttd-it.open{background:var(--panel-2)}
        .ttd-row{all:unset;box-sizing:border-box;width:100%;display:flex;align-items:center;gap:10px;
          padding:10px 8px;cursor:pointer;border-radius:6px}
        .ttd-row:hover{background:var(--panel-2)}
        .ttd-row:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}
        .ttd-mk{flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--faint);
          display:grid;place-items:center;font-size:11px;font-weight:700;line-height:1}
        .ttd-mk.ask{border-color:var(--amber);color:var(--amber);background:var(--warn-bg)}
        .ttd-mk.ready{border-color:var(--blue);background:var(--blue-bg)}
        .ttd-mk.done{border-color:var(--pos);color:var(--pos);background:var(--pos-bg)}
        .ttd-p{flex:none;font-size:11px;font-weight:650;padding:1px 6px;border-radius:4px;
          color:var(--muted);background:var(--panel-2);border:1px solid var(--line)}
        .ttd-p.p1{color:var(--neg);background:var(--neg-bg);border-color:transparent}
        .ttd-ti{flex:1;min-width:0;color:var(--ink);font-size:14px}
        .ttd-it.built .ttd-ti{color:var(--muted)}
        .ttd-ask{flex:none;font-size:12px;color:var(--amber);white-space:nowrap}
        .ttd-cv{flex:none;width:8px;height:8px;border-right:1.5px solid var(--faint);
          border-bottom:1.5px solid var(--faint);transform:rotate(45deg);margin:0 4px 3px 0;
          transition:transform .15s}
        .ttd-it.open .ttd-cv{transform:rotate(225deg);margin-bottom:-3px}
        .ttd-det{padding:2px 12px 14px 60px}
        .ttd-md{font-size:13.5px;line-height:1.55;color:var(--ink);max-width:var(--rs-prose,72ch)}
        .ttd-md p{margin:0 0 8px}
        .ttd-md ul{margin:0 0 8px;padding-left:18px}
        .ttd-md li{margin:0 0 4px}
        .ttd-md code{font-size:12.5px;background:var(--panel);border:1px solid var(--line);
          border-radius:4px;padding:0 4px}
        .ttd-qs{display:flex;flex-direction:column;gap:10px;margin:12px 0 4px}
        .ttd-q{border:1px solid var(--line);border-left:3px solid var(--amber);border-radius:6px;
          background:var(--panel);padding:10px 12px}
        .ttd-q.ok{border-left-color:var(--pos)}
        .ttd-qh{display:flex;gap:8px;align-items:baseline;margin:0 0 3px}
        .ttd-qk{font-size:11px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;
          color:var(--amber)}
        .ttd-q.ok .ttd-qk{color:var(--pos)}
        .ttd-qa{font-size:12px;color:var(--muted)}
        .ttd-qt{font-size:13.5px;color:var(--ink);line-height:1.5}
        .ttd-ans{margin:8px 0 0;font-size:13.5px}
        .ttd-ans p{margin:0 0 4px}
        .ttd-by{font-size:12px;color:var(--muted)}
        .ttd-lk{all:unset;cursor:pointer;color:var(--brand-d);text-decoration:underline}
        .ttd-form{margin:8px 0 0}
        .ttd-form textarea{width:100%;box-sizing:border-box;min-height:56px;resize:vertical}
        .ttd-fr{display:flex;align-items:center;gap:10px;margin:6px 0 0}
        .ttd-msg{font-size:12.5px;color:var(--muted)}
        .ttd-foot{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:10px 0 0;
          font-size:12px;color:var(--faint)}
        .ttd-foot a{color:var(--brand-d)}
        @media (max-width:640px){
          .ttd-det{padding:2px 8px 14px 8px}
          .ttd-ask{display:none}
        }`;
      document.head.appendChild(st);
    }
  },
});
