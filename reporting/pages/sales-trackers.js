/* SALES AI TRACKERS — manager-defined concepts, judged by an LLM on every applicable call.
 *
 * His ask (2026-08-26): the Sales Head writes a tracker — a name, a plain-language
 * instruction, optional keywords, a scope — and the system judges every in-scope RingSense
 * transcript against it: Met / Partial / Not Met, with a confidence, a short explanation and
 * pointers to the utterances behind the verdict. Nothing here is hard-coded; the panel edits
 * the same chain table the engine reads.
 *
 * THE HOUSE RULES OF THE SCORE PAGE CARRY OVER, because the failure modes are identical:
 *   * RATES, NEVER A RANK — and a floor under every rate: below MIN_CALLS a rep gets words.
 *   * NO VERBATIM SPEECH IN THE PAYLOAD. The eval table carries the verdict, a no-quotes
 *     explanation and utterance `Seq` POINTERS; the words come one call at a time through
 *     the gated /api/_salescall, evidence highlighted in place.
 *   * AN AI VERDICT IS AN OPINION WITH EVIDENCE, and the page says so — every verdict shows
 *     its confidence and opens the transcript it came from.
 *
 * WRITES: definitions move through /api/_trackers (admin or the sales-trackers-admin grant).
 * The panel warns that changing an instruction / keywords / scope re-evaluates every matching
 * call — a rename alone does not (the engine keys on a semantic hash, not the row id).
 */
(function () {
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_tracker_eval) {
    RS.DATASETS.sales_tracker_eval = {
      table: "sales_tracker_eval",
      // A PAYLOAD CONTRACT. The engine's bookkeeping (hash, attempts, batch id) stays home.
      cols: ["Record Id", "Tracker Key", "Result", "Confidence", "Explanation",
             "Evidence Seqs", "Model", "Evaluated At"],
    };
  }
  // registered by sales-comms.js too — whichever script runs first wins, same contract
  if (window.RS && RS.DATASETS && !RS.DATASETS.sales_call_score) {
    RS.DATASETS.sales_call_score = {
      table: "mart_sales_call_score",
      cols: ["Record Id", "Rep", "Shared Line", "Transferred", "Started", "Duration Sec",
             "Job No", "Customer", "Source", "Direction", "Linked", "Stage", "Priced",
             "First Contact", "Rep Turns", "Customer Turns", "Rep Words", "Customer Words",
             "Talk Share", "Objection", "Longest Monologue Sec", "Questions",
             "Questions Per Min", "Ended With Next Step", "Customer Ending Share",
             "open_identified", "open_goodtime", "disc_date", "disc_inventory", "disc_access",
             "disc_heavy", "disc_packing", "price_after_discovery", "px_explained",
             "dep_named", "dep_purpose", "close_ask", "obj_response", "gave_direct_line",
             "shape_broadcast", "shape_monologue"],
    };
  }
})();

(function () {
  var MIN_CALLS = 25;          // below this a rep's rate is words, not a number
  var RESULTS = ["Met", "Partial", "Not Met", "Not Applicable"];
  var TONE = { "Met": "ok", "Partial": "warn", "Not Met": "bad",
               "Not Applicable": "mute", "Pending": "mute", "Error": "bad" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) : null; }

  function injectStyle() {
    var old = document.getElementById("stx-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "stx-style";
    st.textContent = ""
      + ".stx{font-variant-numeric:tabular-nums}"
      + ".stx-tabs{margin:0 0 16px}"
      // the kit styles sidebar/control inputs only, so the editor's fields live here
      + ".stx-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:9px;color:var(--ink);padding:8px 11px;font-size:13px;"
      + "outline:0;transition:border-color .15s}"
      + ".stx-in:focus{border-color:var(--brand)}"
      + ".stx .rs-kpis .kpi.neg .v{color:var(--neg)}"
      + ".stx .rs-kpis .kpi.warn .v{color:var(--warn)}"
      + ".stx .rs-kpis .kpi.pos .v{color:var(--pos)}"
      + ".stx-card{margin-bottom:18px}"
      + ".stx-rate{display:block;font-size:12.5px;font-weight:700;line-height:1.2}"
      + ".stx-bar{display:block;height:4px;border-radius:3px;background:var(--panel-2);"
      + "margin-top:3px;overflow:hidden;min-width:38px}"
      + ".stx-bar i{display:block;height:100%;background:var(--pos)}"
      + ".stx-bar i.low{background:var(--neg)}"
      + ".stx-bar i.mid{background:var(--warn)}"
      + ".stx-thin{color:var(--faint);font-size:11.5px;font-style:italic}"
      + ".stx-desc{font-size:12.5px;color:var(--muted);line-height:1.55;max-width:88ch}"
      + ".stx-expl{font-size:12.5px;color:var(--muted);line-height:1.5;max-width:52ch}"
      + ".stx-conf{font-size:10.5px;color:var(--faint);white-space:nowrap}"
      + ".stx-scope{font-size:11px;color:var(--faint)}"
      + ".stx-link{cursor:pointer;color:var(--brand);font-weight:600;white-space:nowrap}"
      + ".stx-note{font-size:12.5px;color:var(--muted);line-height:1.6;max-width:80ch}"
      // the editor
      + ".stx-form{display:grid;grid-template-columns:1fr 1fr;gap:12px 16px}"
      + ".stx-form .full{grid-column:1/-1}"
      + ".stx-form label{display:block;font-size:11px;font-weight:700;letter-spacing:.04em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 4px}"
      + ".stx-form textarea{min-height:120px;resize:vertical}"
      + ".stx-scoperow{display:flex;flex-wrap:wrap;gap:12px 18px;align-items:center}"
      + ".stx-scoperow .rs-field{margin:0}"
      + ".stx-check{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--muted)}"
      + "@media(max-width:820px){.stx-form{grid-template-columns:1fr}}"
      // the transcript drawer
      + ".stx-overlay{position:fixed;inset:0;background:rgba(10,16,24,.45);z-index:60;"
      + "display:flex;justify-content:flex-end}"
      + ".stx-drawer{width:min(680px,94vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:20px 22px;box-shadow:-12px 0 40px rgba(0,0,0,.25)}"
      + ".stx-utt{padding:6px 0;border-bottom:1px solid var(--line);font-size:13.5px;"
      + "line-height:1.55}"
      + ".stx-utt:last-child{border-bottom:0}"
      + ".stx-utt.cust{padding-left:26px;color:var(--muted)}"
      + ".stx-who{font-size:10.5px;font-weight:800;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin-right:8px}"
      + ".stx-utt.hit{background:var(--warn-bg);border-radius:6px;padding-left:8px;"
      + "padding-right:8px}";
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

  function scopeWords(sc) {
    sc = sc || {};
    var bits = [];
    bits.push(sc.direction ? sc.direction + " calls" : "all directions");
    if (sc.quote_only) bits.push("quote calls only");
    if (sc.min_seconds) bits.push("≥ " + sc.min_seconds + "s");
    if (sc.date_from) bits.push("from " + sc.date_from);
    if (sc.include_shared) bits.push("incl. shared line");
    return bits.join(" · ");
  }

  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Reading the trackers…</div>';
    var S = { tab: "results", meta: null, evals: [], calls: {}, edit: null, filter: {} };

    Promise.all([
      api("/api/_trackers"),
      RS.load("sales_tracker_eval").catch(function () { return { rows: [] }; }),
      RS.load("sales_call_score").catch(function () { return { rows: [] }; }),
    ]).then(function (r) {
      S.meta = r[0];
      S.evals = (r[1] && (r[1].rows || r[1])) || [];
      var calls = (r[2] && (r[2].rows || r[2])) || [];
      calls.forEach(function (c) { S.calls[c["Record Id"]] = c; });
      paint(host, S);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the trackers — '
        + esc(e.message) + "</div>";
    });
  }

  /* ------------------------------------------------------------------ shell */

  function paint(host, S) {
    var canEdit = !!(S.meta && S.meta.can_edit);
    var html = ''
      + '<div class="rs-page-head"><h1>Sales AI Trackers</h1>'
      + "<p>Tell the system what to listen for — an instruction in plain language — and every "
      + "applicable call transcript is judged against it: <b>Met / Partial / Not Met</b>, with "
      + "a confidence and the sentences behind the verdict. An AI verdict is an opinion with "
      + "evidence, not a fact: every one opens the transcript it came from.</p></div>"
      + '<div class="stx-tabs rs-seg">'
      + seg("results", "Results", S)
      + (canEdit ? seg("manage", "Tracker management", S) : "")
      + "</div>"
      + '<div id="stxBody"></div>';
    host.innerHTML = '<div class="stx">' + html + "</div>";

    host.querySelectorAll("[data-tab]").forEach(function (b) {
      b.onclick = function () { S.tab = b.getAttribute("data-tab"); paint(host, S); };
    });
    var body = host.querySelector("#stxBody");
    if (S.tab === "manage" && canEdit) paintManage(body, host, S);
    else paintResults(body, host, S);
  }

  function seg(id, label, S) {
    return '<button class="' + (S.tab === id ? "on" : "") + '" data-tab="' + id
      + '">' + esc(label) + "</button>";
  }

  /* ---------------------------------------------------------------- results */

  function paintResults(body, host, S) {
    var trackers = (S.meta.trackers || []).filter(function (t) { return t.active; });
    if (!trackers.length) {
      body.innerHTML = '<div class="panel"><p class="stx-note">No active trackers yet. '
        + (S.meta.can_edit
           ? 'Create the first one under <b>Tracker management</b> — a name, a plain-language '
             + 'instruction for what should count, and where it applies.'
           : 'The Sales Head has not created any trackers yet.')
        + "</p></div>";
      return;
    }
    var byTracker = {};
    S.evals.forEach(function (e) {
      (byTracker[e["Tracker Key"]] = byTracker[e["Tracker Key"]] || []).push(e);
    });
    body.innerHTML = trackers.map(function (t) {
      return trackerCard(t, byTracker[t.key] || [], S);
    }).join("");

    body.querySelectorAll("[data-rec]").forEach(function (a) {
      a.onclick = function () {
        openCall(a.getAttribute("data-rec"), a.getAttribute("data-seqs") || "",
                 a.getAttribute("data-tkey") || "", S);
      };
    });
  }

  function trackerCard(t, rows, S) {
    var judged = rows.filter(function (e) {
      return RESULTS.indexOf(e.Result) >= 0;
    });
    var applicable = judged.filter(function (e) { return e.Result !== "Not Applicable"; });
    var met = applicable.filter(function (e) { return e.Result === "Met"; }).length;
    var partial = applicable.filter(function (e) { return e.Result === "Partial"; }).length;
    var pending = rows.filter(function (e) { return e.Result === "Pending"; }).length;

    var head = '<div class="panel-head"><div><div class="panel-title">' + esc(t.name)
      + "</div>" + '<p class="stx-desc">' + esc(t.description) + "</p>"
      + '<div class="stx-scope">' + esc(scopeWords(t.scope)) + "</div></div></div>";

    if (!judged.length) {
      return '<div class="panel stx-card">' + head
        + '<p class="stx-note">'
        + (pending ? pending.toLocaleString() + " calls are queued for evaluation — verdicts "
                     + "land as each batch finishes (usually within the hour)."
           : "No calls evaluated yet. Verdicts appear once the evaluation engine has run "
             + "over this tracker's calls.")
        + "</p></div>";
    }

    var kpis = '<div class="rs-kpis" style="--kpi-cols:4">'
      + kpi("Calls judged", judged.length.toLocaleString(),
            pending ? pending.toLocaleString() + " still queued" : "backlog clear", "")
      + kpi("Met", pct(met, applicable.length) + "%",
            "of " + applicable.length.toLocaleString() + " applicable calls",
            pct(met, applicable.length) >= 60 ? "pos" : "neg")
      + kpi("Partial", pct(partial, applicable.length) + "%", "attempted but incomplete", "warn")
      + kpi("Not applicable", (judged.length - applicable.length).toLocaleString(),
            "the situation never arose", "")
      + "</div>";

    return '<div class="panel stx-card">' + head + kpis
      + repTable(t, applicable, S)
      + recentCalls(t, judged, S)
      + "</div>";
  }

  function kpi(label, value, sub, cls) {
    return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(label) + "</div>"
      + '<div class="v">' + esc(value) + '</div><div class="s">' + esc(sub) + "</div></div>";
  }

  function repTable(t, applicable, S) {
    var byRep = {};
    applicable.forEach(function (e) {
      var c = S.calls[e["Record Id"]];
      var rep = (c && c.Rep) || "—";
      (byRep[rep] = byRep[rep] || []).push(e);
    });
    var reps = Object.keys(byRep).sort(function (a, b) {
      return byRep[b].length - byRep[a].length;
    });
    if (!reps.length) return "";
    var rows = reps.map(function (rep) {
      var list = byRep[rep];
      if (list.length < MIN_CALLS) {
        return "<tr><td>" + esc(rep) + '</td><td class="num">' + list.length + "</td>"
          + '<td colspan="3"><span class="stx-thin">not enough judged calls to show a rate '
          + "— under " + MIN_CALLS + "</span></td></tr>";
      }
      function cell(result) {
        var p = pct(list.filter(function (e) { return e.Result === result; }).length,
                    list.length);
        var tone = result === "Met" ? (p >= 60 ? "" : (p >= 25 ? "mid" : "low")) : "";
        return '<td class="num"><span class="stx-rate">' + p + "%</span>"
          + (result === "Met"
             ? '<span class="stx-bar"><i class="' + tone + '" style="width:' + p + '%"></i></span>'
             : "") + "</td>";
      }
      return '<tr><td class="strong">' + esc(rep) + '</td><td class="num">'
        + list.length + "</td>" + cell("Met") + cell("Partial") + cell("Not Met") + "</tr>";
    }).join("");
    return '<div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>Rep</th><th class=\"num\">Applicable calls</th>"
      + '<th class="num">Met</th><th class="num">Partial</th><th class="num">Not met</th>'
      + "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      + '<p class="rs-hint">Rates are over each rep\'s <b>applicable</b> judged calls — a '
      + "call where the situation never arose counts against nobody. Sorted by volume; "
      + "there is deliberately no rank.</p>";
  }

  function recentCalls(t, judged, S) {
    var list = judged.slice().sort(function (a, b) {
      var ca = S.calls[a["Record Id"]] || {}, cb = S.calls[b["Record Id"]] || {};
      return String(cb.Started || "").localeCompare(String(ca.Started || ""));
    }).slice(0, 25);
    if (!list.length) return "";
    var rows = list.map(function (e) {
      var c = S.calls[e["Record Id"]] || {};
      var conf = e.Confidence == null ? "" :
        '<span class="stx-conf">' + e.Confidence + "% conf.</span>";
      return "<tr><td>" + esc(String(c.Started || "").slice(0, 16) || "—") + "</td>"
        + "<td>" + esc(c.Rep || "—") + "</td>"
        + "<td>" + esc(c.Customer || "—") + "</td>"
        + '<td><span class="rs-pill ' + (TONE[e.Result] || "") + '">' + esc(e.Result)
        + "</span> " + conf + "</td>"
        + '<td><div class="stx-expl">' + esc(e.Explanation || "") + "</div></td>"
        + '<td><span class="stx-link" data-rec="' + esc(e["Record Id"]) + '" data-seqs="'
        + esc(e["Evidence Seqs"] || "") + '" data-tkey="' + esc(t.key)
        + '">transcript</span></td></tr>';
    }).join("");
    return '<div class="rs-tablewrap" style="margin-top:14px"><table class="rs-table">'
      + "<thead><tr><th>When</th><th>Rep</th><th>Customer</th><th>Verdict</th>"
      + "<th>Why the AI says so</th><th></th></tr></thead><tbody>" + rows
      + "</tbody></table></div>"
      + '<p class="rs-hint">The 25 most recent judged calls. "Why" is the model\'s own '
      + "explanation — open the transcript to see the highlighted evidence and argue "
      + "with it.</p>";
  }

  /* ---------------------------------------------------- transcript drawer */

  function openCall(rec, seqs, tkey, S) {
    var hits = {};
    String(seqs || "").split(",").forEach(function (s) {
      if (s.trim()) hits[s.trim()] = true;
    });
    var ov = document.createElement("div");
    ov.className = "stx-overlay";
    ov.innerHTML = '<div class="stx-drawer"><div class="rs-loading">Opening the call…</div></div>';
    ov.onclick = function (ev) { if (ev.target === ov) ov.remove(); };
    document.body.appendChild(ov);
    api("/api/_salescall?rec=" + encodeURIComponent(rec)).then(function (j) {
      var c = S.calls[rec] || {};
      var rep = c.Rep || "";
      var verdicts = S.evals.filter(function (e) { return e["Record Id"] === rec; });
      var vbits = verdicts.map(function (e) {
        return '<span class="rs-pill ' + (TONE[e.Result] || "") + '" title="'
          + esc(e.Explanation || "") + '">' + esc(e["Tracker Key"]) + ": "
          + esc(e.Result) + "</span>";
      }).join(" ");
      var utts = (j.utterances || []).map(function (u) {
        var isRep = String(u.speaker || "").trim() === rep;
        return '<div class="stx-utt ' + (isRep ? "rep" : "cust")
          + (hits[String(u.seq)] ? " hit" : "") + '">'
          + '<span class="stx-who">' + (isRep ? esc(rep || "rep") : "customer") + "</span>"
          + esc(u.text || "") + "</div>";
      }).join("");
      ov.querySelector(".stx-drawer").innerHTML = ''
        + '<div class="panel-head"><div><div class="panel-title">'
        + esc(c.Customer || "Call") + "</div>"
        + '<div class="stx-scope">' + esc(String(c.Started || "").slice(0, 16)) + " · "
        + esc(c.Direction || "") + " · " + esc(rep) + "</div></div>"
        + '<button class="rs-btn" id="stxClose">Close</button></div>'
        + '<div style="margin:8px 0 14px;display:flex;flex-wrap:wrap;gap:5px">' + vbits
        + "</div>"
        + '<p class="rs-hint">Highlighted lines are the utterances the model cited as '
        + "evidence for the <b>" + esc(tkey) + "</b> verdict.</p>" + utts;
      ov.querySelector("#stxClose").onclick = function () { ov.remove(); };
    }).catch(function (e) {
      ov.querySelector(".stx-drawer").innerHTML = '<div class="panel">Could not open the '
        + "call — " + esc(e.message) + "</div>";
    });
  }

  /* ----------------------------------------------------------------- manage */

  function paintManage(body, host, S) {
    var eng = (S.meta.engine || {});
    var open = (eng.batches || {}).submitted || 0;
    var trackers = S.meta.trackers || [];
    var cov = S.meta.coverage || {};

    var engine = '<div class="panel stx-card"><div class="panel-head">'
      + '<div class="panel-title">Evaluation engine</div>'
      + '<button class="rs-btn" id="stxRun">Run evaluation now</button></div>'
      + '<p class="stx-note">Evaluation runs in hourly batches: each pass collects finished '
      + "verdicts and submits the next batch of calls. "
      + (open ? ("<b>" + open + " batch" + (open > 1 ? "es" : "") + " in flight.</b> ") : "")
      + (eng.last_collected ? "Last verdicts landed " + esc(eng.last_collected) + " UTC. "
                            : "No verdicts collected yet. ")
      + "Changing a tracker's <b>instruction, keywords or scope</b> re-evaluates every "
      + "matching call (that costs real API usage); renaming alone does not.</p></div>";

    var rows = trackers.map(function (t) {
      var c = cov[t.key] || {};
      var judged = (c.Met || 0) + (c.Partial || 0) + (c["Not Met"] || 0)
                 + (c["Not Applicable"] || 0);
      return "<tr><td class=\"strong\">" + esc(t.name)
        + '<div class="stx-scope">' + esc(t.key) + "</div></td>"
        + '<td><div class="stx-expl">' + esc(t.description) + "</div></td>"
        + "<td>" + esc(scopeWords(t.scope)) + "</td>"
        + '<td><span class="rs-pill ' + (t.active ? "pos" : "") + '">'
        + (t.active ? "Active" : "Disabled") + "</span></td>"
        + '<td class="num">' + judged.toLocaleString()
        + (c.Pending ? '<div class="stx-scope">' + c.Pending.toLocaleString()
                       + " queued</div>" : "") + "</td>"
        + "<td>" + esc(t.by || "") + '<div class="stx-scope">' + esc(t.at || "")
        + "</div></td>"
        + '<td style="white-space:nowrap">'
        + '<button class="rs-btn" data-edit="' + esc(t.key) + '">Edit</button> '
        + '<button class="rs-btn" data-toggle="' + esc(t.key) + '" data-on="'
        + (t.active ? 0 : 1) + '">' + (t.active ? "Disable" : "Enable") + "</button> "
        + '<button class="rs-btn" data-del="' + esc(t.key) + '">Delete</button>'
        + "</td></tr>";
    }).join("");

    var list = '<div class="panel stx-card"><div class="panel-head">'
      + '<div class="panel-title">Trackers</div>'
      + '<button class="rs-btn pri" id="stxNew">New tracker</button></div>'
      + (trackers.length
         ? '<div class="rs-tablewrap"><table class="rs-table"><thead><tr>'
           + "<th>Tracker</th><th>Instruction</th><th>Scope</th><th>Status</th>"
           + '<th class="num">Judged</th><th>Last edited</th><th></th></tr></thead><tbody>'
           + rows + "</tbody></table></div>"
         : '<p class="stx-note">Nothing yet — create the first tracker.</p>')
      + "</div>";

    body.innerHTML = engine + list + '<div id="stxEditor"></div>';

    body.querySelector("#stxRun").onclick = function () {
      api("/api/_trackers", { method: "POST", body: JSON.stringify({ action: "run" }) })
        .then(function () {
          alert("Evaluation fired — verdicts land as batches finish (usually within the hour).");
        }).catch(function (e) { alert(e.message); });
    };
    body.querySelector("#stxNew").onclick = function () {
      S.edit = { key: "", name: "", description: "", keywords: "", scope: {}, isNew: true };
      paintEditor(body.querySelector("#stxEditor"), host, S);
    };
    body.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () {
        var t = trackers.filter(function (x) { return x.key === b.getAttribute("data-edit"); })[0];
        S.edit = JSON.parse(JSON.stringify(t));
        paintEditor(body.querySelector("#stxEditor"), host, S);
      };
    });
    body.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.onclick = function () {
        api("/api/_trackers", { method: "POST", body: JSON.stringify({
          action: "toggle", key: b.getAttribute("data-toggle"),
          active: +b.getAttribute("data-on") }) })
          .then(function () { render(host); }).catch(function (e) { alert(e.message); });
      };
    });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-del");
        if (!confirm("Delete tracker '" + k + "'? Its stored verdicts are kept but hidden; "
                     + "the key can be revived later.")) return;
        api("/api/_trackers", { method: "POST",
                                body: JSON.stringify({ action: "delete", key: k }) })
          .then(function () { render(host); }).catch(function (e) { alert(e.message); });
      };
    });
  }

  function keyFromName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40);
  }

  function paintEditor(elt, host, S) {
    var t = S.edit;
    if (!t) { elt.innerHTML = ""; return; }
    var sc = t.scope || {};
    elt.innerHTML = '<div class="panel stx-card"><div class="panel-head">'
      + '<div class="panel-title">' + (t.isNew ? "New tracker" : "Edit — " + esc(t.name))
      + "</div></div>"
      + '<div class="stx-form">'
      + '<div><label>Name</label><input class="stx-in" id="stxName" maxlength="120" value="'
      + esc(t.name) + '"></div>'
      + '<div><label>Key ' + (t.isNew ? "(from the name)" : "(fixed)") + "</label>"
      + '<input class="stx-in" id="stxKey" value="' + esc(t.key) + '" '
      + (t.isNew ? "" : "disabled") + "></div>"
      + '<div class="full"><label>Instruction — what the AI judges by</label>'
      + '<textarea class="stx-in" id="stxDesc" maxlength="4000">' + esc(t.description)
      + "</textarea>"
      + '<p class="rs-hint">Describe the behaviour that should count as <b>met</b> — e.g. '
      + "“the rep walks the customer room by room through everything being moved: "
      + "furniture, boxes, garage, attic, storage…”. Mentioning a keyword alone "
      + "never counts; the model is instructed to judge whether the behaviour actually "
      + "happened.</p></div>"
      + '<div class="full"><label>Keyword hints (optional, comma-separated)</label>'
      + '<input class="stx-in" id="stxKw" maxlength="1000" value="' + esc(t.keywords || "")
      + '"></div>'
      + '<div class="full"><label>Scope — which calls this applies to</label>'
      + '<div class="stx-scoperow">'
      + '<select class="stx-in" id="stxDir" style="width:auto">'
      + ["any", "inbound", "outbound"].map(function (d) {
          return '<option value="' + d + '"' + ((sc.direction || "any") === d ? " selected" : "")
            + ">" + d + "</option>";
        }).join("") + "</select>"
      + '<input class="stx-in" id="stxMin" type="number" min="0" max="7200" '
      + 'placeholder="min seconds" style="width:110px" value="' + (sc.min_seconds || "") + '">'
      + '<input class="stx-in" id="stxFrom" type="date" style="width:150px" value="'
      + esc(sc.date_from || "") + '">'
      + '<span class="stx-check"><input type="checkbox" id="stxQuote"'
      + (sc.quote_only ? " checked" : "") + "> quote calls only</span>"
      + '<span class="stx-check"><input type="checkbox" id="stxShared"'
      + (sc.include_shared ? " checked" : "") + "> include the shared line</span>"
      + "</div></div>"
      + '<div class="full" style="display:flex;gap:8px;align-items:center">'
      + '<button class="rs-btn pri" id="stxSave">'
      + (t.isNew ? "Create tracker" : "Save changes") + "</button>"
      + '<button class="rs-btn" id="stxCancel">Cancel</button>'
      + '<span class="stx-thin">saving a changed instruction, keywords or scope re-evaluates '
      + "every matching call</span></div>"
      + "</div></div>";

    var nameEl = elt.querySelector("#stxName");
    if (t.isNew) {
      nameEl.oninput = function () {
        elt.querySelector("#stxKey").value = keyFromName(nameEl.value);
      };
    }
    elt.querySelector("#stxCancel").onclick = function () { S.edit = null; elt.innerHTML = ""; };
    elt.querySelector("#stxSave").onclick = function () {
      var scope = {
        direction: elt.querySelector("#stxDir").value,
        min_seconds: +elt.querySelector("#stxMin").value || 0,
        date_from: elt.querySelector("#stxFrom").value || "",
        quote_only: elt.querySelector("#stxQuote").checked,
        include_shared: elt.querySelector("#stxShared").checked,
      };
      var payload = {
        action: "save",
        key: t.isNew ? keyFromName(nameEl.value) : t.key,
        name: nameEl.value.trim(),
        description: elt.querySelector("#stxDesc").value.trim(),
        keywords: elt.querySelector("#stxKw").value.trim(),
        scope: scope,
      };
      api("/api/_trackers", { method: "POST", body: JSON.stringify(payload) })
        .then(function () { S.edit = null; render(host); })
        .catch(function (e) {
          // the revive rule surfaces here: a deleted key needs an explicit yes
          if (/revive:true/.test(e.message)
              && confirm(e.message + "\n\nBring the old tracker back with its verdicts?")) {
            payload.revive = true;
            api("/api/_trackers", { method: "POST", body: JSON.stringify(payload) })
              .then(function () { S.edit = null; render(host); })
              .catch(function (e2) { alert(e2.message); });
          } else { alert(e.message); }
        });
    };
  }

  if (window.registerPage) {
    registerPage({
      id: "sales-trackers",
      group: "sales",
      title: "Sales AI Trackers",
      render: render,
    });
  }
})();
