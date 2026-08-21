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
  title: "My Survey",
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
    S.step = null;                      // and outside any part of the stepper

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
        ".hm-dim{font-size:12px;color:var(--faint);line-height:1.55}",
        // the confidentiality note: a warn-toned side rule, which the kit has no word for
        ".hm-conf{border-left:3px solid var(--warn);background:color-mix(in srgb,var(--warn) 7%,transparent);border-radius:0 10px 10px 0;padding:10px 14px;font-size:12.5px;line-height:1.55;color:var(--muted);margin:12px 0}",
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
        ".hm-choice.on{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 7%,transparent)}",
        ".hm-choice input{margin-top:2px}",
        // the answer box IS the kit field (.rs-inp); a textarea only adds "fill the card,
        // grow downwards" -- which is the one thing a single-line input never needs
        ".hm-ta{width:100%;box-sizing:border-box;min-width:0;line-height:1.5;resize:vertical}",
        ".hm-ct{font-size:10.5px;color:var(--faint);text-align:right;margin-top:3px}",
        // min-height RESERVES the line: without it the first "saved" label grows the card
        // and every question below jumps mid-click
        ".hm-saved{font-size:11px;color:var(--pos);font-weight:700;min-height:15px}",
        ".hm-err{font-size:12px;color:var(--neg);font-weight:700;margin-top:6px}",
        ".hm-ro{border-left:3px solid var(--line-2);padding:4px 12px;margin-top:10px;font-size:13.5px;line-height:1.5}",
        ".hm-ro .a{color:var(--ink)}",
        ".hm-empty{text-align:center;padding:48px 20px;color:var(--muted);font-size:14px;line-height:1.6}",
        // the list of sent-out forms: one card per questionnaire, click to open
        ".hm-item{display:flex;gap:14px;align-items:center;justify-content:space-between;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:15px 18px;margin-bottom:10px;cursor:pointer;transition:border-color .12s}",
        ".hm-item:hover{border-color:var(--brand)}",
        ".hm-item b{font-size:15px}",
        ".hm-fill{font-size:13px;font-weight:800;color:var(--brand);white-space:nowrap}",
        ".hm-sec{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:16px 2px 9px}",
        // Forms-parity controls: section headers, linear scale, dropdown, Other…
        ".hm-sect{margin:30px 0 12px;padding:16px 20px;background:var(--panel);border-left:4px solid var(--brand);border-radius:0 12px 12px 0}",
        ".hm-sect b{font-size:17px;letter-spacing:-.2px}",
        ".hm-sect .d{font-size:12.5px;color:var(--muted);margin-top:4px;line-height:1.55}",
        ".hm-scale{display:flex;gap:6px;flex-wrap:wrap;align-items:center}",
        ".hm-num{min-width:38px;height:38px;border-radius:10px;border:1px solid var(--line-2);background:var(--panel);font:inherit;font-size:14px;font-weight:700;color:var(--muted);cursor:pointer}",
        ".hm-num:hover:not(:disabled){border-color:var(--brand);color:var(--brand)}",
        ".hm-num.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}",
        ".hm-scalelab{display:flex;justify-content:space-between;font-size:11.5px;color:var(--faint);margin-top:5px;max-width:460px}",
        // a wider .rs-sel: these options are sentences, not one-word filter values
        ".hm-sel{min-width:260px;max-width:100%}",
        ".hm-oth{font:inherit;font-size:13px;border:0;border-bottom:1px solid var(--line-2);background:transparent;color:var(--ink);padding:2px 4px;flex:1;min-width:140px}",
        ".hm-oth:focus{outline:none;border-bottom-color:var(--brand)}",
        // the guided flow: progress, part headers, nav, review
        ".hm-pb{height:6px;border-radius:4px;background:var(--panel-2);overflow:hidden;margin:2px 0 6px}",
        ".hm-pb i{display:block;height:100%;background:var(--brand);border-radius:4px;transition:width .3s}",
        ".hm-part{margin:20px 0 16px}",
        ".hm-part .pn{display:block;font-size:10.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--brand);margin-bottom:5px}",
        ".hm-part b{font-size:21px;letter-spacing:-.3px}",
        ".hm-part .pd{font-size:13px;color:var(--muted);margin-top:7px;line-height:1.6;max-width:680px}",
        ".hm-navbar{position:sticky;bottom:14px;background:var(--panel);border:1px solid var(--line-2);border-radius:13px;box-shadow:var(--shadow);padding:12px 16px;display:flex;gap:12px;align-items:center;z-index:5;margin-top:16px}",
        // the kit hint line, tucked under the title it explains
        ".hm-meta{margin:10px 0 0}",
        ".hm-rrow{display:flex;gap:11px;align-items:center;padding:11px 12px;border-radius:10px;cursor:pointer;font-size:13.5px}",
        ".hm-rrow:hover{background:var(--panel-2)}",
        ".hm-rrow .tick{width:22px;height:22px;border-radius:50%;background:var(--pos-bg);color:var(--pos);display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:0 0 auto}",
        ".hm-rrow.miss .tick{background:var(--neg-bg);color:var(--neg)}",
        ".hm-missb{border-color:var(--neg) !important}",
        // the confirmation modal (no native confirm here either)
        ".hm-cfm{position:fixed;inset:0;background:var(--scrim);z-index:150;display:flex;align-items:center;justify-content:center;padding:20px}",
        ".hm-cfm .box{background:var(--panel);border:1px solid var(--line);border-radius:16px;max-width:440px;width:100%;padding:24px 26px;box-shadow:var(--shadow)}",
        ".hm-cfm h3{margin:0 0 9px;font-size:16.5px}",
        ".hm-cfm p{margin:0 0 20px;font-size:13.5px;color:var(--muted);line-height:1.65}",
        ".hm-cfm .btns{display:flex;gap:10px;justify-content:flex-end}",
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="hm"><div class="rs-page-head"><h1>My Survey</h1>'
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
          + '<div class="btns"><button class="rs-btn" data-no>' + (opts.no || "Cancel") + "</button>"
          + '<button class="rs-btn pri" data-yes>' + (opts.yes || "Confirm") + "</button></div></div>";
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
      var m = { not_started: ["mute", "not started"], in_progress: ["warn", "in progress"],
                submitted: ["ok", "submitted"], resubmitted: ["ok", "resubmitted"],
                reopened: ["warn", "reopened for correction"] };
      var x = m[q.my_status] || ["mute", esc(q.my_status)];
      return '<span class="rs-pill ' + x[0] + '">' + x[1] + "</span>";
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
      if (!cur.editable) {
        // a submitted/closed copy reads best as one quiet page
        main.innerHTML =
          '<div class="rs-bar"><button class="rs-btn" id="hmBack">← All questionnaires</button></div>'
          + paintOne(cur);
        main.querySelector("#hmBack").onclick = function () { S.open = null; S.step = null; paint(); };
        return;
      }
      var steps = buildSteps(cur);
      if (S.step == null || S.step < -1 || S.step > steps.length) S.step = -1;
      if (S.step === -1) paintIntro(cur, steps);
      else if (S.step === steps.length) paintReview(cur, steps);
      else paintStep(cur, steps, S.step);
    }

    // HIS CALL (2026-08-17): the page opens on the LIST of everything sent to this person.
    function paintList(qs) {
      var todo = qs.filter(function (q) { return q.editable; });
      var rest = qs.filter(function (q) { return !q.editable; });
      var item = function (q) {
        var nq = q.questions.filter(function (x) { return x.qtype !== "section"; }).length;
        var meta = nq + " question" + (nq === 1 ? "" : "s")
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
        el.onclick = function () { S.open = +el.dataset.open; S.step = -1; paint(); window.scrollTo(0, 0); };
      });
    }

    /* ---- the guided flow: sections become PARTS, one per screen ---- */
    function buildSteps(q) {
      var steps = [], cur = null, num = 0;
      q.questions.forEach(function (qq) {
        if (qq.qtype === "section") {
          cur = { title: qq.label, desc: qq.description || "", items: [] };
          steps.push(cur);
        } else {
          num += 1;
          if (!cur) { cur = { title: "", desc: "", items: [] }; steps.push(cur); }
          cur.items.push(Object.assign({ _num: num }, qq));
        }
      });
      return steps.filter(function (s) { return s.items.length; });
    }
    function answered(q, qq) {
      var v = q.answers[qq.id];
      return v != null && v !== "";
    }
    function progCounts(q, steps) {
      var t = 0, a = 0;
      steps.forEach(function (s) { s.items.forEach(function (it) { t++; if (answered(q, it)) a++; }); });
      return { t: t, a: a };
    }
    function progBar(a, t) {
      return '<div class="hm-pb"><i id="hmPbi" style="width:' + (t ? Math.round(a / t * 100) : 0)
        + '%"></i></div>';
    }

    function paintIntro(cur, steps) {
      var p = progCounts(cur, steps);
      main.innerHTML =
        '<div class="rs-bar"><button class="rs-btn" id="hmBack">← All questionnaires</button></div>'
        + '<div class="panel" style="padding:26px 28px">'
        + '<b style="font-size:21px;letter-spacing:-.3px">' + esc(cur.title) + "</b> " + statusPill(cur)
        + (cur.description ? '<div style="font-size:13.5px;color:var(--muted);margin-top:9px;line-height:1.6">' + esc(cur.description) + "</div>" : "")
        + '<div class="rs-hint hm-meta"><span class="em">' + steps.length + " part" + (steps.length === 1 ? "" : "s") + " · "
        + p.t + " questions · your answers save as you go — leave and come back any time</span></div>"
        + (cur.instructions ? '<div style="font-size:13px;margin-top:13px;line-height:1.65">' + esc(cur.instructions) + "</div>" : "")
        + '<div class="hm-conf">' + esc(cur.confidentiality) + "</div>"
        + (cur.my_status === "reopened"
            ? '<div class="hm-dim" style="margin-top:8px">HR reopened this response for you — fix what needs fixing and submit again.</div>' : "")
        + (p.a ? '<div style="margin-top:16px">' + progBar(p.a, p.t)
            + '<span class="hm-dim" id="hmCnt">' + p.a + " of " + p.t + " answered</span></div>" : "")
        + '<div style="margin-top:20px"><button class="rs-btn pri" id="hmStart">'
        + (p.a >= p.t ? "Review & submit" : p.a ? "Continue where you left off" : "Start") + "</button></div>"
        + "</div>";
      main.querySelector("#hmBack").onclick = function () { S.open = null; S.step = null; paint(); };
      main.querySelector("#hmStart").onclick = function () {
        var at = steps.length;                          // everything answered → review
        for (var i = 0; i < steps.length; i++)
          if (steps[i].items.some(function (it) { return !answered(cur, it); })) { at = i; break; }
        S.step = at; paint(); window.scrollTo(0, 0);
      };
    }

    function paintStep(cur, steps, si) {
      var s = steps[si], p = progCounts(cur, steps);
      main.innerHTML =
        '<div class="rs-bar"><button class="rs-btn" id="hmBack">← All questionnaires</button>'
        + '<span class="rs-spacer"></span><span class="hm-dim" id="hmCnt">' + p.a + " of " + p.t + " answered</span></div>"
        + progBar(p.a, p.t)
        + '<div class="hm-part"><span class="pn">Part ' + (si + 1) + " of " + steps.length + "</span>"
        + "<b>" + esc(s.title || cur.title) + "</b>"
        + (s.desc ? '<div class="pd">' + esc(s.desc) + "</div>" : "")
        + "</div>"
        + s.items.map(function (qq) { return qCard(cur, qq, qq._num, false); }).join("")
        + '<div class="hm-navbar">'
        + '<button class="rs-btn" id="hmPrev">' + (si === 0 ? "← Intro" : "← Back") + "</button>"
        + '<span class="rs-spacer"></span>'
        + '<button class="rs-btn pri" id="hmNext">'
        + (si === steps.length - 1 ? "Review & submit →" : "Next →") + "</button></div>";
      main.querySelector("#hmBack").onclick = function () { S.open = null; S.step = null; paint(); };
      main.querySelector("#hmPrev").onclick = function () { S.step = si - 1; paint(); window.scrollTo(0, 0); };
      main.querySelector("#hmNext").onclick = function () { S.step = si + 1; paint(); window.scrollTo(0, 0); };
      wire(cur);
    }

    function paintReview(cur, steps) {
      var p = progCounts(cur, steps);
      var rows = steps.map(function (s, i) {
        var t = s.items.length, a = 0, reqMiss = 0;
        s.items.forEach(function (it) {
          if (answered(cur, it)) a++; else if (it.required) reqMiss++;
        });
        return '<div class="hm-rrow' + (reqMiss ? " miss" : "") + '" data-go="' + i + '">'
          + '<span class="tick">' + (reqMiss ? "!" : (a === t ? "✓" : "…")) + "</span>"
          + "<b>" + esc(s.title || cur.title) + "</b>"
          + '<span class="hm-dim">' + a + " of " + t + " answered"
          + (reqMiss ? " · " + reqMiss + " required still missing" : "") + "</span>"
          + '<span class="rs-spacer"></span><span class="hm-dim">open ›</span></div>';
      });
      main.innerHTML =
        '<div class="rs-bar"><button class="rs-btn" id="hmBack">← All questionnaires</button>'
        + '<span class="rs-spacer"></span><span class="hm-dim" id="hmCnt">' + p.a + " of " + p.t + " answered</span></div>"
        + progBar(p.a, p.t)
        + '<div class="hm-part"><span class="pn">Review</span><b>Ready to submit?</b>'
        + '<div class="pd">Open any part below to change an answer. Submitting makes your answers '
        + "final — only HR can reopen them afterwards.</div></div>"
        + '<div class="panel" style="padding:8px 10px">' + rows.join("") + "</div>"
        + '<div class="hm-conf">' + esc(cur.confidentiality) + "</div>"
        + '<div class="hm-navbar"><button class="rs-btn" id="hmPrev">← Back</button>'
        + '<span class="hm-err" id="hmErr" style="margin:0"></span><span class="rs-spacer"></span>'
        + '<button class="rs-btn pri" id="hmSubmit">'
        + (cur.my_status === "reopened" ? "Submit the correction" : "Submit") + "</button></div>";
      main.querySelector("#hmBack").onclick = function () { S.open = null; S.step = null; paint(); };
      main.querySelector("#hmPrev").onclick = function () { S.step = steps.length - 1; paint(); window.scrollTo(0, 0); };
      main.querySelectorAll("[data-go]").forEach(function (r) {
        r.onclick = function () { S.step = +r.dataset.go; paint(); window.scrollTo(0, 0); };
      });
      wire(cur);
    }

    /* ---- one question card, every type, editable or read-only ---- */
    function qCard(q, qq, num, ro) {
      var OTH = "Other\u2026";
      var v = q.answers[qq.id];
      var inner;
      if (ro) {
        // clamp before repeat(): a malformed stored value must not throw RangeError
        var starN = Math.min(5, Math.max(0, Math.round(+v) || 0));
        var shown = v == null || v === "" ? '<span class="hm-dim">— not answered</span>'
          : qq.qtype === "multi" ? esc(safeArr(v).join(", "))
          : qq.qtype === "stars5" ? '<span style="color:var(--warn)">' + "★".repeat(starN) + "</span>"
            + '<span class="hm-dim"> ' + esc(v) + "/5</span>"
          : qq.qtype === "scale" ? esc(v) + '<span class="hm-dim"> of ' + esc((qq.options || [])[1] || "") + "</span>"
          : esc(v);
        inner = '<div class="hm-ro"><span class="a">' + shown + "</span></div>";
      } else if (qq.qtype === "stars5") {
        inner = '<div class="hm-stars" data-q="' + qq.id + '">'
          + [1, 2, 3, 4, 5].map(function (n) {
              return '<button class="hm-star' + (v != null && v !== "" && n <= +v ? " on" : "")
                + '" data-s="' + n + '" title="' + n + " star" + (n === 1 ? "" : "s") + '">★</button>';
            }).join("") + "</div>";
      } else if (qq.qtype === "single") {
        var isOthS = v != null && String(v).indexOf("Other: ") === 0;
        inner = (qq.options || []).map(function (o) {
          var isO = o === OTH;
          var on = isO ? isOthS : v === o;
          return '<label class="hm-choice' + (on ? " on" : "") + '"><input type="radio" name="hmq' + qq.id + '"'
            + (on ? " checked" : "") + ' data-q="' + qq.id + '" data-o="' + esc(o) + '"'
            + (isO ? ' data-oth="1"' : "") + ">"
            + (isO ? '<span style="display:flex;gap:8px;flex:1;align-items:center">Other:'
                     + '<input class="hm-oth" data-so="' + qq.id + '" value="'
                     + (isOthS ? esc(String(v).slice(7)) : "") + '"></span>'
                   : "<span>" + esc(o) + "</span>")
            + "</label>";
        }).join("");
      } else if (qq.qtype === "multi") {
        var picked = new Set(safeArr(v));
        var othVal = "";
        picked.forEach(function (x) { if (String(x).indexOf("Other: ") === 0) othVal = String(x).slice(7); });
        inner = (qq.options || []).map(function (o) {
          var isO = o === OTH;
          var on = isO ? !!othVal : picked.has(o);
          return '<label class="hm-choice' + (on ? " on" : "") + '"><input type="checkbox"'
            + (on ? " checked" : "") + ' data-mq="' + qq.id + '" data-o="' + esc(o) + '"'
            + (isO ? ' data-oth="1"' : "") + ">"
            + (isO ? '<span style="display:flex;gap:8px;flex:1;align-items:center">Other:'
                     + '<input class="hm-oth" data-mo="' + qq.id + '" value="' + esc(othVal) + '"></span>'
                   : "<span>" + esc(o) + "</span>")
            + "</label>";
        }).join("");
      } else if (qq.qtype === "dropdown") {
        var isOthD = v != null && String(v).indexOf("Other: ") === 0;
        inner = '<select class="rs-sel hm-sel" data-dd="' + qq.id + '">'
          + '<option value=""' + (v == null || v === "" ? " selected" : "") + ">Choose\u2026</option>"
          + (qq.options || []).map(function (o) {
              var on = o === OTH ? isOthD : v === o;
              return '<option value="' + esc(o) + '"' + (on ? " selected" : "") + ">" + esc(o) + "</option>";
            }).join("") + "</select>"
          + '<div style="margin-top:8px;display:' + (isOthD ? "flex" : "none") + ';gap:8px;align-items:center" data-ddrow="' + qq.id + '">'
          + '<span style="font-size:13px">Other:</span>'
          + '<input class="hm-oth" style="max-width:340px" data-ddo="' + qq.id + '" value="'
          + (isOthD ? esc(String(v).slice(7)) : "") + '"></div>';
      } else if (qq.qtype === "scale") {
        var lo = parseInt((qq.options || [])[0], 10); if (isNaN(lo)) lo = 1;
        var hi = parseInt((qq.options || [])[1], 10); if (isNaN(hi)) hi = 5;
        var labLo = (qq.options || [])[2], labHi = (qq.options || [])[3];
        var btns = [];
        for (var sc = lo; sc <= hi; sc++)
          btns.push('<button class="hm-num' + (v != null && v !== "" && +v === sc ? " on" : "")
            + '" data-sc="' + qq.id + '" data-v="' + sc + '">' + sc + "</button>");
        inner = '<div class="hm-scale">' + btns.join("") + "</div>"
          + (labLo || labHi ? '<div class="hm-scalelab"><span>' + esc(labLo || "")
            + "</span><span>" + esc(labHi || "") + "</span></div>" : "");
      } else {
        var max = qq.qtype === "short_text" ? 300 : 5000;
        inner = '<textarea class="rs-inp hm-ta" data-t="' + qq.id + '" maxlength="' + max + '" rows="'
          + (qq.qtype === "short_text" ? 2 : 5) + '" placeholder="Your answer\u2026">' + esc(v || "") + "</textarea>"
          + '<div class="hm-ct" data-ct="' + qq.id + '">' + String(v || "").length + " / " + max + "</div>"
          + (ro || qq.qtype === "short_text" ? "" : "");
      }
      return '<div class="hm-q" data-qq="' + qq.id + '"><div class="lab">' + num + ". " + esc(qq.label)
        + (qq.required ? "<u title=\"required\">*</u>"
                       : (ro ? "" : ' <span class="hm-dim" style="font-weight:600;font-size:11.5px">optional</span>')) + "</div>"
        + (qq.description ? '<div class="desc">' + esc(qq.description) + "</div>" : "")
        + (!ro && (qq.qtype === "long_text") ? '<div class="desc" style="color:var(--faint)">A few sentences is plenty.</div>' : "")
        + '<div class="body">' + inner + '</div><div class="hm-saved" data-sv="' + qq.id + '"></div></div>';
    }

    /* ---- the single-page READ-ONLY copy (submitted / closed) ---- */
    function paintOne(q) {
      var head = '<div class="panel"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">'
        + '<b style="font-size:17px">' + esc(q.title) + "</b>" + statusPill(q)
        + "</div>"
        + (q.description ? '<div class="hm-dim" style="margin-top:6px;font-size:13px">' + esc(q.description) + "</div>" : "")
        + '<div class="hm-conf">' + esc(q.confidentiality) + "</div>"
        + (q.my_status === "submitted" || q.my_status === "resubmitted"
            ? '<div class="hm-dim">Submitted ' + esc(fmtWhen(q.submitted_at)) + " — this is a read-only copy of "
              + "your answers. If something needs correcting, ask HR to reopen it.</div>"
            : q.questionnaire_status !== "published"
            ? '<div class="hm-dim">This questionnaire is closed.</div>'
            : '<div class="hm-dim">This questionnaire is no longer assigned to you.</div>')
        + "</div>";
      var n = 0;
      var body = q.questions.map(function (qq) {
        if (qq.qtype === "section") {
          return '<div class="hm-sect"><b>' + esc(qq.label) + "</b>"
            + (qq.description ? '<div class="d">' + esc(qq.description) + "</div>" : "") + "</div>";
        }
        n += 1;
        return qCard(q, qq, n, true);
      }).join("");
      return head + body;
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
        // the header progress ticks live as answers land
        var pb = main.querySelector("#hmPbi"), ct3 = main.querySelector("#hmCnt");
        if (pb || ct3) {
          var st3 = buildSteps(q), pc = progCounts(q, st3);
          if (pb) pb.style.width = (pc.t ? Math.round(pc.a / pc.t * 100) : 0) + "%";
          if (ct3) ct3.textContent = pc.a + " of " + pc.t + " answered";
        }
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
          var card = r.closest(".hm-q");
          if (r.dataset.oth) {
            var oi = card.querySelector('input[data-so]');
            if (oi && oi.value.trim()) save(q, +r.dataset.q, "Other: " + oi.value.trim());
            else if (oi) oi.focus();               // saves once they type
          } else {
            save(q, +r.dataset.q, r.dataset.o);
          }
          card.querySelectorAll(".hm-choice").forEach(function (c) {
            c.classList.toggle("on", c.querySelector("input").checked);
          });
        };
      });
      main.querySelectorAll("input[data-so]").forEach(function (oi) {
        var qid = +oi.dataset.so, t = null;
        oi.oninput = function () {
          var radio = oi.closest(".hm-choice").querySelector("input[data-oth]");
          if (radio && !radio.checked) { radio.checked = true; radio.dispatchEvent(new Event("change")); }
          clearTimeout(t);
          t = setTimeout(function () {
            if (oi.value.trim()) save(q, qid, "Other: " + oi.value.trim());
          }, 900);
        };
        oi.onblur = function () {
          clearTimeout(t);
          if (oi.value.trim()) save(q, qid, "Other: " + oi.value.trim());
        };
      });
      function multiVals(card) {
        var vals = [];
        card.querySelectorAll("input[data-mq]:checked").forEach(function (x) {
          if (x.dataset.oth) {
            var oi = card.querySelector("input[data-mo]");
            if (oi && oi.value.trim()) vals.push("Other: " + oi.value.trim());
          } else vals.push(x.dataset.o);
        });
        return vals;
      }
      main.querySelectorAll("input[data-mq]").forEach(function (c) {
        c.onchange = function () {
          var qid = +c.dataset.mq, card = c.closest(".hm-q");
          if (c.dataset.oth && c.checked) {
            var oi = card.querySelector("input[data-mo]");
            if (oi && !oi.value.trim()) { oi.focus(); return; }   // saves once they type
          }
          save(q, qid, multiVals(card));
          card.querySelectorAll(".hm-choice").forEach(function (ch) {
            ch.classList.toggle("on", ch.querySelector("input").checked);
          });
        };
      });
      main.querySelectorAll("input[data-mo]").forEach(function (oi) {
        var qid = +oi.dataset.mo, t = null;
        var card = oi.closest(".hm-q");
        var push = function () {
          var cb = oi.closest(".hm-choice").querySelector("input[data-oth]");
          if (cb && !cb.checked && oi.value.trim()) { cb.checked = true; cb.closest(".hm-choice").classList.add("on"); }
          if (oi.value.trim()) save(q, qid, multiVals(card));
        };
        oi.oninput = function () { clearTimeout(t); t = setTimeout(push, 900); };
        oi.onblur = function () { clearTimeout(t); push(); };
      });
      main.querySelectorAll("select[data-dd]").forEach(function (dd) {
        var qid = +dd.dataset.dd;
        var row = main.querySelector('[data-ddrow="' + qid + '"]');
        dd.onchange = function () {
          var v = dd.value;
          if (v === "Other\u2026") {
            if (row) { row.style.display = "flex"; row.querySelector("input").focus(); }
            var oi = row && row.querySelector("input");
            if (oi && oi.value.trim()) save(q, qid, "Other: " + oi.value.trim());
          } else {
            if (row) row.style.display = "none";
            save(q, qid, v);                       // "" = an explicit clear
          }
        };
      });
      main.querySelectorAll("input[data-ddo]").forEach(function (oi) {
        var qid = +oi.dataset.ddo, t = null;
        var push = function () { if (oi.value.trim()) save(q, qid, "Other: " + oi.value.trim()); };
        oi.oninput = function () { clearTimeout(t); t = setTimeout(push, 900); };
        oi.onblur = function () { clearTimeout(t); push(); };
      });
      main.querySelectorAll("button[data-sc]").forEach(function (b) {
        b.onclick = function () {
          var qid = +b.dataset.sc;
          save(q, qid, +b.dataset.v);
          var wrap = b.closest(".hm-scale");
          wrap.querySelectorAll(".hm-num").forEach(function (x) {
            x.classList.toggle("on", x === b);
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
          var steps2 = buildSteps(q);
          for (var si2 = 0; si2 < steps2.length; si2++)
            if (steps2[si2].items.some(function (x) { return x.id === missing[0].id; })) {
              S.step = si2; break;
            }
          paint();
          var first = main.querySelector('[data-qq="' + missing[0].id + '"]');
          if (first) {
            first.classList.add("hm-missb");
            first.scrollIntoView({ block: "center" });
          }
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
