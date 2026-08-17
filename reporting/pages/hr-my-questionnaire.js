/* My Questionnaire — the employee's side of the Human Resources module (2026-08-17).
 *
 * This page has TWO lives, one file: inside the normal portal shell for people who hold
 * reporting grants, and as the WHOLE PORTAL for a respondent with no grants at all — the
 * shell boots straight into it (body.hrq-only, no sidebar) when /api/_me says authorized:false
 * but /api/_hrq knows the person. Either way it talks only to /api/_hrq, which is gated on
 * IDENTITY + ROSTER, never on Users & Access — that is the entire point of the feature.
 *
 * The answering UI carries the Foreman Assessment lessons wholesale: answers save the moment
 * they are given (optimistic paint, per-question serialized promise chain + monotonic seq
 * guard, rollback with a visible message on failure), a submitted response is read-only, and
 * the confidentiality note is always on screen because the answers are NOT anonymous.
 */
registerPage({
  id: "hr-my-questionnaire",
  group: "hr",
  title: "My Questionnaire",
  datasets: [],
  async render(host) {
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__HRME || (window.__HRME = {
      data: null, open: null, msg: "", msgErr: false, _seq: {}, _chain: {},
    });
    S.open = null;                      // every visit starts on the list of forms

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

    if (!document.getElementById("hmCss")) {
      var st = document.createElement("style"); st.id = "hmCss";
      st.textContent = [
        ".hm{max-width:860px;margin:0 auto;font-variant-numeric:tabular-nums}",
        ".hm-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin-bottom:14px}",
        ".hm-dim{font-size:12px;color:var(--faint);line-height:1.55}",
        ".hm-conf{border-left:3px solid var(--warn);background:rgba(226,168,43,.07);border-radius:0 10px 10px 0;padding:10px 14px;font-size:12.5px;line-height:1.55;color:var(--muted);margin:12px 0}",
        ".hm-pill{display:inline-block;font-size:10.5px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;padding:3px 10px;border-radius:999px;background:var(--panel-2);color:var(--muted)}",
        ".hm-pill.ok{background:rgba(46,160,90,.16);color:var(--pos)}",
        ".hm-pill.warn{background:rgba(226,168,43,.16);color:var(--warn)}",
        ".hm-q{border:1px solid var(--line);border-radius:12px;padding:14px 16px;margin-bottom:11px;background:var(--panel)}",
        ".hm-q .lab{font-size:14.5px;font-weight:750;line-height:1.35}",
        ".hm-q .lab u{text-decoration:none;color:var(--neg);margin-left:4px}",
        ".hm-q .desc{font-size:12px;color:var(--muted);margin-top:3px;line-height:1.5}",
        ".hm-q .body{margin-top:11px}",
        ".hm-stars{display:flex;gap:2px}",
        ".hm-star{font-size:31px;line-height:1;cursor:pointer;background:none;border:0;padding:0 3px;color:var(--line-2);transition:transform .06s}",
        ".hm-star.on,.hm-star.pv{color:var(--warn)}",
        ".hm-star:disabled{cursor:default;opacity:.75}",
        ".hm-star:hover:not(:disabled){transform:scale(1.15)}",
        ".hm-choice{display:flex;gap:9px;align-items:flex-start;padding:7px 10px;border:1px solid var(--line-2);border-radius:9px;margin-bottom:6px;cursor:pointer;font-size:13.5px;line-height:1.4}",
        ".hm-choice:hover{border-color:var(--brand)}",
        ".hm-choice.on{border-color:var(--brand);background:rgba(183,226,59,.07)}",
        ".hm-choice input{margin-top:2px}",
        ".hm-ta{width:100%;box-sizing:border-box;font:inherit;font-size:13px;line-height:1.5;color:var(--ink);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:9px 11px;resize:vertical}",
        ".hm-ta:focus{outline:none;border-color:var(--brand)}",
        ".hm-ct{font-size:10.5px;color:var(--faint);text-align:right;margin-top:3px}",
        // min-height RESERVES the line: without it the first "saved" label grows the card
        // and every question below jumps mid-click
        ".hm-saved{font-size:11px;color:var(--pos);font-weight:700;min-height:15px}",
        ".hm-err{font-size:12px;color:var(--neg);font-weight:700;margin-top:6px}",
        ".hm-submitbar{position:sticky;bottom:14px;background:var(--panel);border:1px solid var(--line-2);border-radius:13px;box-shadow:0 12px 34px rgba(0,0,0,.28);padding:13px 18px;display:flex;gap:14px;align-items:center;z-index:5}",
        ".hm-go{font:inherit;font-size:14px;font-weight:800;padding:11px 22px;border-radius:11px;border:0;background:var(--brand);color:var(--brand-ink);cursor:pointer}",
        ".hm-go:hover{filter:brightness(1.06)}",
        ".hm-go:disabled{opacity:.55;cursor:default}",
        ".hm-btn{font:inherit;font-size:12.5px;font-weight:700;color:var(--muted);background:var(--panel);border:1px solid var(--line-2);border-radius:9px;padding:7px 13px;cursor:pointer}",
        ".hm-btn:hover{border-color:var(--brand);color:var(--brand)}",
        ".hm-ro{border-left:3px solid var(--line-2);padding:4px 12px;margin-top:10px;font-size:13.5px;line-height:1.5}",
        ".hm-ro .a{color:var(--ink)}",
        ".hm-empty{text-align:center;padding:48px 20px;color:var(--muted);font-size:14px;line-height:1.6}",
        // the list of sent-out forms: one card per questionnaire, click to open
        ".hm-item{display:flex;gap:14px;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px 18px;margin-bottom:10px;cursor:pointer;transition:border-color .12s}",
        ".hm-item:hover{border-color:var(--brand)}",
        ".hm-item b{font-size:15px}",
        ".hm-fill{font-size:13px;font-weight:800;color:var(--brand);white-space:nowrap}",
        ".hm-sec{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 2px 9px}",
        // the confirmation modal (no native confirm here either)
        ".hm-cfm{position:fixed;inset:0;background:rgba(10,14,20,.5);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px}",
        ".hm-cfm .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:440px;width:100%;padding:24px 26px;box-shadow:0 18px 60px rgba(0,0,0,.4)}",
        ".hm-cfm h3{margin:0 0 9px;font-size:16.5px}",
        ".hm-cfm p{margin:0 0 20px;font-size:13.5px;color:var(--muted);line-height:1.65}",
        ".hm-cfm .btns{display:flex;gap:10px;justify-content:flex-end}",
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="hm"><div class="rs-page-head"><h1>My Questionnaire</h1>'
      + "<p>Questionnaires assigned to you. Answers save as you go; Submit makes them final."
      + '</p></div><div id="hmMain"></div></div>';
    var main = host.querySelector("#hmMain");

    async function load() {
      main.innerHTML = '<div class="rs-loading" style="padding:22px">Loading…</div>';
      try { S.data = await api("/api/_hrq"); }
      catch (e) {
        main.innerHTML = '<div class="hm-empty">Could not load — ' + esc(e.message || e) + "</div>";
        return;
      }
      paint();
    }

    function hmConfirm(opts) {
      return new Promise(function (res) {
        var o = document.createElement("div");
        o.className = "hm-cfm";
        o.innerHTML = '<div class="box"><h3>' + opts.t + "</h3><p>" + opts.b + "</p>"
          + '<div class="btns"><button class="hm-btn" data-no>' + (opts.no || "Cancel") + "</button>"
          + '<button class="hm-go" data-yes>' + (opts.yes || "Confirm") + "</button></div></div>";
        document.body.appendChild(o);
        var done = function (v) { o.remove(); document.removeEventListener("keydown", onk); res(v); };
        var onk = function (e) { if (e.key === "Escape") done(false); };
        document.addEventListener("keydown", onk);
        o.querySelector("[data-yes]").onclick = function () { done(true); };
        o.querySelector("[data-no]").onclick = function () { done(false); };
        o.onclick = function (e) { if (e.target === o) done(false); };
        o.querySelector("[data-yes]").focus();
      });
    }

    function statusPill(q) {
      var m = { not_started: ["", "not started"], in_progress: ["warn", "in progress"],
                submitted: ["ok", "submitted"], resubmitted: ["ok", "resubmitted"],
                reopened: ["warn", "reopened for correction"] };
      var x = m[q.my_status] || ["", esc(q.my_status)];
      return '<span class="hm-pill ' + x[0] + '">' + x[1] + "</span>";
    }

    function paint() {
      var qs = (S.data && S.data.questionnaires) || [];
      if (!qs.length) {
        main.innerHTML = '<div class="hm-empty"><b>Nothing is waiting for you right now.</b><br>'
          + (S.data && S.data.rostered
              ? "When HR opens a questionnaire for you, it will appear here."
              : "If you were told to fill in a questionnaire, ask HR to add your email"
                + " to the list — this page unlocks the moment they do.") + "</div>";
        return;
      }
      if (S.open != null && !qs.some(function (q) { return q.id === S.open; })) S.open = null;
      if (S.open == null) { paintList(qs); return; }
      var cur = qs.filter(function (q) { return q.id === S.open; })[0];
      main.innerHTML =
        '<div style="margin-bottom:12px"><button class="hm-btn" id="hmBack">← All questionnaires</button></div>'
        + paintOne(cur);
      main.querySelector("#hmBack").onclick = function () { S.open = null; paint(); };
      wire(cur);
    }

    // HIS CALL (2026-08-17): "we are gonna have a lot of questionnaires" — the page
    // opens on the LIST of everything sent to this person; filling is a click away.
    function paintList(qs) {
      var todo = qs.filter(function (q) { return q.editable; });
      var rest = qs.filter(function (q) { return !q.editable; });
      var item = function (q) {
        var meta = q.questions.length + " question" + (q.questions.length === 1 ? "" : "s")
          + (q.submitted_at ? " · submitted " + esc(fmtWhen(q.submitted_at)) : "");
        return '<div class="hm-item" data-open="' + q.id + '"><div>'
          + "<b>" + esc(q.title) + "</b> " + statusPill(q)
          + (q.description ? '<div class="hm-dim" style="margin-top:4px">' + esc(q.description) + "</div>" : "")
          + '<div class="hm-dim" style="margin-top:4px">' + meta + "</div></div>"
          + (q.editable ? '<span class="hm-fill">Fill it in ›</span>'
                        : '<span class="hm-dim" style="white-space:nowrap">open ›</span>')
          + "</div>";
      };
      main.innerHTML =
        (todo.length ? '<div class="hm-sec">Waiting for you · ' + todo.length + "</div>"
          + todo.map(item).join("") : "")
        + (rest.length ? '<div class="hm-sec">' + (todo.length ? "Earlier" : "Your questionnaires")
          + "</div>" + rest.map(item).join("") : "");
      main.querySelectorAll("[data-open]").forEach(function (el) {
        el.onclick = function () { S.open = +el.dataset.open; paint(); };
      });
    }

    function paintOne(q) {
      var ro = !q.editable;
      var head = '<div class="hm-card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
        + '<b style="font-size:17px">' + esc(q.title) + "</b>" + statusPill(q)
        + "</div>"
        + (q.description ? '<div class="hm-dim" style="margin-top:6px;font-size:13px">' + esc(q.description) + "</div>" : "")
        + (q.instructions ? '<div style="font-size:13px;margin-top:8px;line-height:1.55">' + esc(q.instructions) + "</div>" : "")
        + '<div class="hm-conf">' + esc(q.confidentiality) + "</div>"
        + (q.my_status === "submitted" || q.my_status === "resubmitted"
            ? '<div class="hm-dim">Submitted ' + esc(fmtWhen(q.submitted_at)) + " — this is a read-only copy of "
              + "your answers. If something needs correcting, ask HR to reopen it.</div>"
            : q.my_status === "reopened"
            ? '<div class="hm-dim">HR reopened this response for you — edit what needs fixing and submit again.</div>'
            : !q.editable && q.questionnaire_status !== "published"
            ? '<div class="hm-dim">This questionnaire is closed.</div>'
            : !q.editable
            ? '<div class="hm-dim">This questionnaire is no longer assigned to you.</div>' : "")
        + "</div>";

      var body = q.questions.map(function (qq, i) {
        var v = q.answers[qq.id];
        var inner;
        if (ro) {
          // clamp before repeat(): a malformed stored value must not throw RangeError
          // and blank the whole shell for a respondent-only user
          var starN = Math.min(5, Math.max(0, Math.round(+v) || 0));
          var shown = v == null || v === "" ? '<span class="hm-dim">— not answered</span>'
            : qq.qtype === "multi" ? esc(safeArr(v).join(", "))
            : qq.qtype === "stars5" ? '<span style="color:var(--warn)">' + "★".repeat(starN) + "</span>"
              + '<span class="hm-dim"> ' + esc(v) + "/5</span>"
            : esc(v);
          inner = '<div class="hm-ro"><span class="a">' + shown + "</span></div>";
        } else if (qq.qtype === "stars5") {
          inner = '<div class="hm-stars" data-q="' + qq.id + '">'
            + [1, 2, 3, 4, 5].map(function (n) {
                return '<button class="hm-star' + (v != null && v !== "" && n <= +v ? " on" : "")
                  + '" data-s="' + n + '" title="' + n + " star" + (n === 1 ? "" : "s") + '">★</button>';
              }).join("") + "</div>";
        } else if (qq.qtype === "single") {
          inner = (qq.options || []).map(function (o) {
            var on = v === o;
            return '<label class="hm-choice' + (on ? " on" : "") + '"><input type="radio" name="hmq' + qq.id + '"'
              + (on ? " checked" : "") + ' data-q="' + qq.id + '" data-o="' + esc(o) + '"><span>' + esc(o) + "</span></label>";
          }).join("");
        } else if (qq.qtype === "multi") {
          var picked = new Set(safeArr(v));
          inner = (qq.options || []).map(function (o) {
            var on = picked.has(o);
            return '<label class="hm-choice' + (on ? " on" : "") + '"><input type="checkbox"'
              + (on ? " checked" : "") + ' data-mq="' + qq.id + '" data-o="' + esc(o) + '"><span>' + esc(o) + "</span></label>";
          }).join("");
        } else {
          var max = qq.qtype === "short_text" ? 300 : 5000;
          inner = '<textarea class="hm-ta" data-t="' + qq.id + '" maxlength="' + max + '" rows="'
            + (qq.qtype === "short_text" ? 2 : 5) + '" placeholder="Your answer…">' + esc(v || "") + "</textarea>"
            + '<div class="hm-ct" data-ct="' + qq.id + '">' + String(v || "").length + " / " + max + "</div>";
        }
        return '<div class="hm-q" data-qq="' + qq.id + '"><div class="lab">' + (i + 1) + ". " + esc(qq.label)
          + (qq.required ? "<u title=\"required\">*</u>" : "") + "</div>"
          + (qq.description ? '<div class="desc">' + esc(qq.description) + "</div>" : "")
          + '<div class="body">' + inner + '</div><div class="hm-saved" data-sv="' + qq.id + '"></div></div>';
      }).join("");

      var bar = "";
      if (!ro) {
        var req = q.questions.filter(function (x) { return x.required; }).length;
        bar = '<div class="hm-submitbar"><span class="hm-dim">Answers save the moment you give them'
          + (req ? " · * marks the " + req + " required question" + (req === 1 ? "" : "s") : "") + "</span>"
          + '<span style="flex:1"></span>'
          + '<span class="hm-err" id="hmErr" style="margin:0"></span>'
          + '<button class="hm-go" id="hmSubmit">'
          + (q.my_status === "reopened" ? "Submit the correction" : "Submit") + "</button></div>";
      }
      return head + body + bar;
    }

    function safeArr(v) {
      if (v == null || v === "") return [];
      try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; }
      catch (e) { return []; }
    }

    // Bridge timestamps are naive UTC ("YYYY-MM-DD HH:MM:SS"). The Z is load-bearing:
    // without it the browser reads LOCAL time and the instant shifts by the reader's
    // offset. Rendered in the picker's zone like every live time on the portal.
    function fmtWhen(s) {
      if (!s) return "";
      var d = new Date(String(s).replace(" ", "T") + "Z");
      if (isNaN(d)) return String(s);
      if (window.RS && RS.fmtTz) return RS.fmtTzDay(d) + ", " + RS.fmtTz(d) + " " + RS.tzShort();
      return d.toLocaleString();
    }

    /* Save one answer — the assessment's race rules verbatim: optimistic local update,
     * per-question monotonic seq + serialized chain, rollback with a message on failure. */
    function save(q, questionId, value, el) {
      var key = q.id + "|" + questionId;
      S._ok = S._ok || {};                       // last value the SERVER confirmed, per question
      var my = S._seq[key] = (S._seq[key] || 0) + 1;
      var stored = (value != null && Array.isArray(value)) ? JSON.stringify(value) : value;
      if (!(key in S._ok)) S._ok[key] = q.answers[questionId];
      q.answers[questionId] = stored;
      if (q.my_status === "not_started") q.my_status = "in_progress";
      var sv = main.querySelector('[data-sv="' + questionId + '"]');
      if (sv) { sv.textContent = "saving…"; sv.style.color = "var(--faint)"; }
      S._chain[key] = (S._chain[key] || Promise.resolve()).then(function () {
        return api("/api/_hrq", { method: "POST", body: JSON.stringify({
          questionnaire_id: q.id, question_id: questionId, value: value }) });
      }).then(function () {
        S._ok[key] = stored;
        if (S._seq[key] !== my) return;
        // re-query: a failure repaint elsewhere may have replaced the captured node
        var svNow = main.querySelector('[data-sv="' + questionId + '"]') || sv;
        if (svNow) { svNow.textContent = "saved"; svNow.style.color = "var(--pos)"; }
      }, function (e) {
        if (S._seq[key] !== my) return;
        // Roll back to the last CONFIRMED value — not to "the value when this call
        // started", which after two queued failures would be a phantom never stored.
        q.answers[questionId] = S._ok[key];
        // Keep what is typed in OTHER questions on screen: paint() re-renders every
        // textarea from q.answers, and text inside the debounce window isn't there yet.
        main.querySelectorAll("textarea[data-t]").forEach(function (t2) {
          var k2 = +t2.dataset.t;
          if (k2 !== questionId) q.answers[k2] = t2.value;
        });
        paint();                                  // rebuild FIRST, then write the message
        var sv2 = main.querySelector('[data-sv="' + questionId + '"]');
        if (sv2) { sv2.textContent = "NOT saved — " + (e.message || e); sv2.style.color = "var(--neg)"; }
      });
    }

    function wire(q) {
      if (!q || !q.editable) return;
      main.querySelectorAll(".hm-stars").forEach(function (w) {
        var qid = +w.dataset.q;
        w.querySelectorAll(".hm-star").forEach(function (b) {
          b.onclick = function () {
            save(q, qid, +b.dataset.s);
            w.querySelectorAll(".hm-star").forEach(function (s2) {
              s2.classList.toggle("on", +s2.dataset.s <= +b.dataset.s);
            });
          };
          b.onmouseenter = function () {
            w.querySelectorAll(".hm-star").forEach(function (s2) {
              s2.classList.toggle("pv", +s2.dataset.s <= +b.dataset.s);
            });
          };
        });
        w.onmouseleave = function () {
          w.querySelectorAll(".hm-star.pv").forEach(function (s2) { s2.classList.remove("pv"); });
        };
      });
      main.querySelectorAll('input[type="radio"][data-q]').forEach(function (r) {
        r.onchange = function () {
          save(q, +r.dataset.q, r.dataset.o);
          var card = r.closest(".hm-q");
          card.querySelectorAll(".hm-choice").forEach(function (c) {
            c.classList.toggle("on", c.querySelector("input").checked);
          });
        };
      });
      main.querySelectorAll("input[data-mq]").forEach(function (c) {
        c.onchange = function () {
          var qid = +c.dataset.mq, card = c.closest(".hm-q");
          var vals = [].map.call(card.querySelectorAll("input[data-mq]:checked"),
                                 function (x) { return x.dataset.o; });
          save(q, qid, vals);
          card.querySelectorAll(".hm-choice").forEach(function (ch) {
            ch.classList.toggle("on", ch.querySelector("input").checked);
          });
        };
      });
      main.querySelectorAll("textarea[data-t]").forEach(function (ta) {
        var qid = +ta.dataset.t, timer = null;
        var ct = main.querySelector('[data-ct="' + qid + '"]');
        var max = +ta.maxLength;
        ta.oninput = function () {
          if (ct) ct.textContent = ta.value.length + " / " + max;
          // debounced autosave: a keystroke restarts the clock; blur saves immediately
          clearTimeout(timer);
          timer = setTimeout(function () { save(q, qid, ta.value); }, 900);
        };
        ta.onblur = function () { clearTimeout(timer); save(q, qid, ta.value); };
      });
      var sb = main.querySelector("#hmSubmit");
      if (sb) sb.onclick = async function () {
        // client-side required check for a friendly message; the server re-checks anyway
        var missing = q.questions.filter(function (qq) {
          if (!qq.required) return false;
          var v = q.answers[qq.id];
          return v == null || v === "" || (qq.qtype === "multi" && !safeArr(v).length);
        });
        var errEl = main.querySelector("#hmErr");
        if (missing.length) {
          errEl.textContent = "Still needed: " + missing.map(function (m) { return m.label; }).slice(0, 3).join(" · ")
            + (missing.length > 3 ? " (+" + (missing.length - 3) + ")" : "");
          var first = main.querySelector('[data-qq="' + missing[0].id + '"]');
          if (first) first.scrollIntoView({ block: "center", behavior: "smooth" });
          return;
        }
        if (!(await hmConfirm({ t: "Submit your answers?",
            b: "After this they become read-only — only HR can reopen them for a correction.",
            yes: q.my_status === "reopened" ? "Submit the correction" : "Submit" }))) return;
        sb.disabled = true; sb.textContent = "Submitting…";
        api("/api/_hrq", { method: "POST", body: JSON.stringify({ questionnaire_id: q.id, submit: true }) })
          .then(function () { return load(); },
                function (e) { sb.disabled = false; sb.textContent = "Submit"; errEl.textContent = e.message || e; });
      };
    }

    await load();
  },
});
