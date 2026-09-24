/* SALES TRACKERS — manager-defined keyword lists, matched on every applicable call.
 *
 * KEYWORD-ONLY, BY HIS CALL (2026-09-24). The ai mode below never ran (sales_tracker_batch has
 * 0 rows, no API key) and stays dormant with no switch on this page, so the page stopped
 * talking about AI, models, batches and "within the hour". The same review found:
 *   * the Manage tab's Checked column summed only ai verdicts, so every keyword tracker showed
 *     0 — Inventory Review among them, with 6,893 checked calls. It counts Mentioned + Not
 *     Mentioned now.
 *   * Source Detector's keyword box held one sentence, full stop included, and the engine
 *     matches each comma-separated entry word for word: 0 hits in 356 calls. The editor now
 *     previews the exact phrases and flags an entry over 4 words or ending in punctuation,
 *     and the Description is labelled as the note for people it is (never matched).
 *   * a "first contacts only" scope option (the question asked once per lead), and the shared
 *     support line labelled in the rep table, since it is not a person.
 * Its own review (same day): a first contact must be LINKED to its lead — an unlinked call is
 * a one-call bucket that always reads as a first contact, ~1 in 5 quote calls never link, and
 * the unlinked share of a rep's first contacts ran 7%-37% — so the card counts what that
 * leaves out; the preview collapses pasted double spaces and tabs the way the engine does.
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
  /* TWO VOCABULARIES ON PURPOSE. A keyword tracker can only know the topic CAME UP, so its
     verdicts say Mentioned — printing "Met" for a keyword hit is exactly the false claim
     the spec warned about. Only ai-mode trackers (a model reading the call) say Met. */
  var RESULTS = ["Met", "Partial", "Not Met", "Not Applicable"];
  var KW_RESULTS = ["Mentioned", "Not Mentioned"];
  var TONE = { "Met": "ok", "Partial": "warn", "Not Met": "bad",
               "Not Applicable": "mute", "Pending": "mute", "Error": "bad",
               "Mentioned": "ok", "Not Mentioned": "bad" };

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
      + ".stx-form textarea.stx-kw{min-height:64px}"
      // the keyword preview: exactly the phrases the engine will match, one chip each
      + ".stx-kwprev{margin-top:8px}"
      + ".stx-kwhead{font-size:12px;color:var(--muted);margin:0 0 5px}"
      + ".stx-chip{display:inline-block;padding:2px 9px;margin:0 5px 5px 0;border-radius:999px;"
      + "background:var(--panel-2);border:1px solid var(--line);font-size:12px;color:var(--ink)}"
      + ".stx-chip.warn{border-color:var(--warn);background:var(--warn-bg)}"
      + ".stx-kwwarn{font-size:12px;color:var(--warn);line-height:1.5;margin:2px 0 0}"
      + ".stx-shared{background:var(--panel-2)}"
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
    if (sc.first_contact_only) bits.push("first contacts only");
    if (sc.min_seconds) bits.push("≥ " + sc.min_seconds + "s");
    if (sc.date_from) bits.push("from " + sc.date_from);
    if (sc.include_shared) bits.push("incl. shared line");
    return bits.join(" · ");
  }

  /* WHAT "FIRST CONTACTS ONLY" LEAVES OUT (review, 2026-09-24). The engine counts a first
     contact only once the call is LINKED to its lead (_in_scope, src/sales_trackers.py): an
     unlinked call is a one-call bucket that always reads as a first contact, and about half of
     them are really follow-ups. ~1 in 5 quote calls never link (Jun–Aug 2026), and a new
     customer's call links only when their lead arrives with the weekly Moveboard export (by
     hand, Mondays) — so the card says how many calls that rule is holding out, and how many
     are from the last seven days and may still link. The other scope checks mirror
     _in_scope, so a call out for another reason is not counted here. */
  function unlinkedFirsts(t, S) {
    var sc = t.scope || {};
    if (!sc.first_contact_only) return null;
    var n = 0, recent = 0, cut = Date.now() - 7 * 864e5;
    var dir = String(sc.direction || "any").toLowerCase();
    Object.keys(S.calls).forEach(function (rid) {
      var c = S.calls[rid];
      if (c.Stage !== "quote call" || +c.Linked || !+c["First Contact"]) return;
      if (+c["Shared Line"] && !sc.include_shared) return;
      if ((dir === "inbound" || dir === "outbound")
          && String(c.Direction || "").toLowerCase().indexOf(dir) < 0) return;
      if (sc.min_seconds && (+c["Duration Sec"] || 0) < +sc.min_seconds) return;
      var day = String(c.Started || "").slice(0, 10);
      if (sc.date_from && (!day || day < sc.date_from)) return;
      n++;
      var iso = String(c.Started || "").replace(" ", "T");
      if (iso && !/(Z|[+-]\d\d:?\d\d)$/.test(iso)) iso += "Z";      // the mart stores UTC
      if (Date.parse(iso) >= cut) recent++;
    });
    return { n: n, recent: recent };
  }

  function unlinkedNote(t, S) {
    var u = unlinkedFirsts(t, S);
    if (!u || !u.n) return "";
    return '<div class="stx-scope">' + u.n.toLocaleString() + " first-contact call"
      + (u.n === 1 ? " is" : "s are") + " left out because " + (u.n === 1 ? "it is" : "they are")
      + " not linked to a lead"
      + (!u.recent ? ""
         : u.n === 1 ? " — it is from the last seven days and may link when the weekly lead "
                       + "export arrives"
         : " — " + (u.recent === u.n ? "all" : u.recent.toLocaleString()) + " from the last "
           + "seven days, most of which link when the weekly lead export arrives and are "
           + "then checked")
      + ". About 1 in 5 quote calls never link.</div>";
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
      + '<div class="rs-page-head"><h1>Sales Trackers</h1>'
      + "<p>Tell the system what to listen for, and every applicable call transcript is "
      + "checked against it: <b>Mentioned / Not mentioned</b>, with pointers to the exact "
      + "sentences. A tracker records that a topic <b>came up</b> on the call — said by "
      + "either side — and every verdict opens the transcript it came from.</p></div>"
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
           ? 'Create the first one under <b>Tracker management</b> — a name, the words or '
             + 'short phrases to listen for, and which calls it applies to.'
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
    var isKw = t.mode !== "ai";
    var vocab = isKw ? KW_RESULTS : RESULTS;
    var judged = rows.filter(function (e) {
      return vocab.indexOf(e.Result) >= 0;
    });
    var applicable = isKw ? judged
      : judged.filter(function (e) { return e.Result !== "Not Applicable"; });
    var main = applicable.filter(function (e) {
      return e.Result === (isKw ? "Mentioned" : "Met");
    }).length;
    var partial = applicable.filter(function (e) { return e.Result === "Partial"; }).length;
    var pending = rows.filter(function (e) { return e.Result === "Pending"; }).length;

    var head = '<div class="panel-head"><div><div class="panel-title">' + esc(t.name)
      + "</div>"
      + '<p class="stx-desc">' + esc(t.description) + "</p>"
      + '<div class="stx-scope">' + esc(scopeWords(t.scope)) + "</div>"
      + unlinkedNote(t, S) + "</div></div>";

    if (!judged.length) {
      return '<div class="panel stx-card">' + head
        + '<p class="stx-note">'
        + (pending ? pending.toLocaleString() + " calls are waiting to be checked."
           : "No calls checked yet — results land with the next pipeline pass (hourly), or "
             + "press Run evaluation now under Tracker management.")
        + "</p></div>";
    }

    var kpis;
    if (isKw) {
      kpis = '<div class="rs-kpis" style="--kpi-cols:3">'
        + kpi("Calls checked", judged.length.toLocaleString(),
              "in this tracker's scope", "")
        + kpi("Topic came up", pct(main, applicable.length) + "%",
              "one of the keywords was said", pct(main, applicable.length) >= 60 ? "pos" : "neg")
        + kpi("Never mentioned", (applicable.length - main).toLocaleString(),
              "calls where no keyword appears", "")
        + "</div>";
    } else {
      kpis = '<div class="rs-kpis" style="--kpi-cols:4">'
        + kpi("Calls judged", judged.length.toLocaleString(),
              pending ? pending.toLocaleString() + " still queued" : "backlog clear", "")
        + kpi("Met", pct(main, applicable.length) + "%",
              "of " + applicable.length.toLocaleString() + " applicable calls",
              pct(main, applicable.length) >= 60 ? "pos" : "neg")
        + kpi("Partial", pct(partial, applicable.length) + "%", "attempted but incomplete", "warn")
        + kpi("Not applicable", (judged.length - applicable.length).toLocaleString(),
              "the situation never arose", "")
        + "</div>";
    }

    return '<div class="panel stx-card">' + head + kpis
      + repTable(t, applicable, S, isKw)
      + recentCalls(t, judged, S)
      + "</div>";
  }

  function kpi(label, value, sub, cls) {
    return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(label) + "</div>"
      + '<div class="v">' + esc(value) + '</div><div class="s">' + esc(sub) + "</div></div>";
  }

  function repTable(t, applicable, S, isKw) {
    var cols = isKw ? ["Mentioned", "Not Mentioned"] : ["Met", "Partial", "Not Met"];
    var mainResult = cols[0];
    /* THE SHARED LINE IS NOT A PERSON (2026-09-24). "Support Zip To Zip" is a queue anyone may
       answer; a tracker that ticks "include the shared line" counts its calls, so the row
       stays, but last and labelled — the Sales Communication Analysis rule. */
    var byRep = {}, sharedName = {};
    applicable.forEach(function (e) {
      var c = S.calls[e["Record Id"]];
      var rep = (c && c.Rep) || "—";
      if (c && +c["Shared Line"]) sharedName[rep] = true;
      (byRep[rep] = byRep[rep] || []).push(e);
    });
    var reps = Object.keys(byRep).sort(function (a, b) {
      var sa = sharedName[a] ? 1 : 0, sb = sharedName[b] ? 1 : 0;
      return (sa - sb) || (byRep[b].length - byRep[a].length);
    });
    if (!reps.length) return "";
    var rows = reps.map(function (rep) {
      var list = byRep[rep];
      var isShared = !!sharedName[rep];
      var who = isShared
        ? esc(rep) + '<div class="stx-scope">shared support line — not a person</div>'
        : esc(rep);
      var trOpen = isShared ? '<tr class="stx-shared">' : "<tr>";
      if (list.length < MIN_CALLS) {
        return trOpen + "<td>" + who + '</td><td class="num">' + list.length + "</td>"
          + '<td colspan="' + cols.length + '"><span class="stx-thin">not enough checked '
          + "calls to show a rate — under " + MIN_CALLS + "</span></td></tr>";
      }
      function cell(result) {
        var p = pct(list.filter(function (e) { return e.Result === result; }).length,
                    list.length);
        var tone = result === mainResult ? (p >= 60 ? "" : (p >= 25 ? "mid" : "low")) : "";
        return '<td class="num"><span class="stx-rate">' + p + "%</span>"
          + (result === mainResult
             ? '<span class="stx-bar"><i class="' + tone + '" style="width:' + p + '%"></i></span>'
             : "") + "</td>";
      }
      return trOpen + '<td class="strong">' + who + '</td><td class="num">'
        + list.length + "</td>" + cols.map(cell).join("") + "</tr>";
    }).join("");
    return '<div class="rs-tablewrap"><table class="rs-table">'
      + "<thead><tr><th>Rep</th><th class=\"num\">"
      + (isKw ? "Checked calls" : "Applicable calls") + "</th>"
      + cols.map(function (c) { return '<th class="num">' + esc(c) + "</th>"; }).join("")
      + "</tr></thead><tbody>" + rows + "</tbody></table></div>"
      + '<p class="rs-hint">'
      + (isKw
         ? "The share of each rep's in-scope calls where a keyword came up — said by either "
           + "party. A keyword hit means the topic was RAISED, not that it was handled well."
         : "Rates are over each rep's <b>applicable</b> judged calls — a call where the "
           + "situation never arose counts against nobody.")
      + " Sorted by volume; there is deliberately no rank.</p>";
  }

  function recentCalls(t, judged, S) {
    var list = judged.slice().sort(function (a, b) {
      var ca = S.calls[a["Record Id"]] || {}, cb = S.calls[b["Record Id"]] || {};
      return String(cb.Started || "").localeCompare(String(ca.Started || ""));
    }).slice(0, 25);
    if (!list.length) return "";
    var isKw = t.mode !== "ai";
    var rows = list.map(function (e) {
      var c = S.calls[e["Record Id"]] || {};
      var conf = e.Confidence == null ? "" :
        '<span class="stx-conf">' + e.Confidence + "% conf.</span>";
      return "<tr><td>" + esc(String(c.Started || "").slice(0, 16) || "—") + "</td>"
        + "<td>" + esc(c.Rep || "—")
        + (+c["Shared Line"] ? '<div class="stx-scope">shared line</div>' : "") + "</td>"
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
      + "<th>" + (isKw ? "Keywords heard" : "Explanation") + "</th><th></th></tr></thead><tbody>"
      + rows + "</tbody></table></div>"
      + '<p class="rs-hint">'
      + (isKw
         ? "The 25 most recent checked calls. <b>Keywords heard</b> lists each phrase that "
           + "was said and how many lines it was on — open the transcript to see the lines "
           + "in place."
         : "The 25 most recent checked calls — open the transcript to see the highlighted "
           + "evidence and argue with it.")
      + "</p>";
  }

  /* ---------------------------------------------------- transcript drawer */

  function tkMode(S, key) {
    var t = ((S.meta && S.meta.trackers) || []).filter(function (x) { return x.key === key; })[0];
    return (t && t.mode) || "keyword";
  }

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
        + '<p class="rs-hint">'
        + (tkMode(S, tkey) === "ai"
           ? "Highlighted lines are the evidence cited for the <b>" + esc(tkey) + "</b> verdict."
           : "Highlighted lines are where each keyword of <b>" + esc(tkey) + "</b> was first "
             + "said on this call (up to six lines).")
        + "</p>" + utts;
      ov.querySelector("#stxClose").onclick = function () { ov.remove(); };
    }).catch(function (e) {
      ov.querySelector(".stx-drawer").innerHTML = '<div class="panel">Could not open the '
        + "call — " + esc(e.message) + "</div>";
    });
  }

  /* ----------------------------------------------------------------- manage */

  function paintManage(body, host, S) {
    var trackers = S.meta.trackers || [];
    var cov = S.meta.coverage || {};

    var engine = '<div class="panel stx-card"><div class="panel-head">'
      + '<div class="panel-title">Evaluation engine</div>'
      + '<button class="rs-btn" id="stxRun">Run evaluation now</button></div>'
      + '<p class="stx-note">Calls are checked in the data pipeline every hour, free; '
      + '<b>Run evaluation now</b> checks immediately. '
      + "Changing a tracker's <b>keywords, note or scope</b> re-checks every matching call "
      + "automatically; renaming alone does not. A call that leaves a tracker's scope (for "
      + "example one later read as a service call, not a quote call) drops out of its counts "
      + "on the next pass, disabled trackers included. One pass drops at most 1 in 20 of a "
      + "tracker's checked calls (at least 50), so a bad data rebuild cannot empty it; a "
      + "bigger change clears over the following hours.</p></div>";

    var rows = trackers.map(function (t) {
      var c = cov[t.key] || {};
      // a keyword tracker's verdicts are Mentioned / Not Mentioned — summing only the ai
      // words showed 0 Checked on every tracker until 2026-09-24
      var judged = t.mode !== "ai"
        ? (c.Mentioned || 0) + (c["Not Mentioned"] || 0)
        : (c.Met || 0) + (c.Partial || 0) + (c["Not Met"] || 0) + (c["Not Applicable"] || 0);
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
           + "<th>Tracker</th><th>Note</th><th>Scope</th><th>Status</th>"
           + '<th class="num">Checked</th><th>Last edited</th><th></th></tr></thead><tbody>'
           + rows + "</tbody></table></div>"
         : '<p class="stx-note">Nothing yet — create the first tracker.</p>')
      + "</div>";

    body.innerHTML = engine + list + '<div id="stxEditor"></div>';

    body.querySelector("#stxRun").onclick = function () {
      api("/api/_trackers", { method: "POST", body: JSON.stringify({ action: "run" }) })
        .then(function () {
          RSC.notice("Check started. New verdicts show once it finishes — reopen the page to "
            + "see them. Past 5,000 calls, the rest finish on the next hourly pass.");
        }).catch(function (e) { RSC.notice(e.message); });
    };
    body.querySelector("#stxNew").onclick = function () {
      // keyword mode + quote calls only BY DEFAULT — his cost calls (2026-08-26/27):
      // keyword trackers are free, and a tracker over every two-way call mostly checks
      // service calls a sales tracker was never about.
      S.edit = { key: "", name: "", description: "", keywords: "", mode: "keyword",
                 scope: { quote_only: true }, isNew: true };
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
          .then(function () { render(host); }).catch(function (e) { RSC.notice(e.message); });
      };
    });
    body.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = async function () {
        var k = b.getAttribute("data-del");
        if (!await RSC.confirm({
          title: "Delete tracker '" + k + "'?",
          body: "Its stored verdicts are kept but hidden; the key can be revived later.",
          yes: "Delete", danger: true,
        })) return;
        api("/api/_trackers", { method: "POST",
                                body: JSON.stringify({ action: "delete", key: k }) })
          .then(function () { render(host); }).catch(function (e) { RSC.notice(e.message); });
      };
    });
  }

  function keyFromName(name) {
    return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "").replace(/^[^a-z]+/, "").slice(0, 40);
  }

  /* THE PREVIEW IS THE ENGINE'S OWN SPLIT (src/sales_trackers.py _kw_patterns): commas,
     semicolons and new lines separate phrases, and each phrase must be said word for word
     (any letter case, any spacing). Source Detector's box held one sentence with a full stop
     and matched 0 of 356 calls (measured 2026-09-24) — so a long entry or one ending in
     punctuation is flagged, never refused: a 5-word fixed phrase can be exactly right.
     Any run of whitespace inside a phrase — a pasted double space, a tab — collapses to one
     space here and in the engine alike (review, 2026-09-24): before, the engine needed two
     spaces or a literal tab and matched nothing, while the chip looked like any other. */
  var KW_LONG = 4;
  var KW_END_PUNCT = /[.!?:"'…”’]$/;

  function kwTerms(s) {
    return String(s || "").split(/[,;\n]+/)
      .map(function (x) { return x.trim().replace(/\s+/g, " "); })
      .filter(function (x) { return x; });
  }

  function kwPreview(el, value) {
    var terms = kwTerms(value);
    if (!terms.length) {
      el.innerHTML = '<p class="stx-kwwarn">No phrases yet — a keyword tracker needs at least '
        + "one.</p>";
      return;
    }
    var warns = [];
    var chips = terms.map(function (term) {
      var words = term.split(/\s+/).length;
      var endP = KW_END_PUNCT.test(term);
      if (words > KW_LONG || endP) {
        var why = [];
        if (words > KW_LONG) why.push(words + " words");
        if (endP) why.push('ends in "' + term.slice(-1) + '"');
        warns.push('"' + term + '" — ' + why.join(" and ") + ": it is found only when said "
          + "exactly like this" + (endP ? ", punctuation included" : "") + ". If it is a "
          + "sentence, split it into short phrases with commas.");
      }
      return '<span class="stx-chip' + (words > KW_LONG || endP ? " warn" : "") + '">'
        + esc(term) + "</span>";
    });
    el.innerHTML = '<p class="stx-kwhead">' + terms.length + " phrase"
      + (terms.length === 1 ? "" : "s") + " will be matched, each word for word, in any "
      + "letter case, said by either side:</p>" + chips.join("")
      + warns.map(function (w) { return '<p class="stx-kwwarn">' + esc(w) + "</p>"; }).join("");
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
      + '<div class="full"><label>Description — a note for people. Only the keywords are '
      + "matched; this text never is</label>"
      + '<textarea class="stx-in" id="stxDesc" maxlength="4000">' + esc(t.description)
      + "</textarea></div>"
      + '<div class="full"><label>Keywords — short phrases, separated by commas. This is '
      + "what gets matched</label>"
      + '<textarea class="stx-in stx-kw" id="stxKw" maxlength="1000">'
      + esc(t.keywords || "") + "</textarea>"
      + '<div class="stx-kwprev" id="stxKwPrev"></div></div>'
      + '<div class="full"><label>Scope — which calls this applies to</label>'
      + '<div class="stx-scoperow">'
      + '<div id="stxDir"></div>'
      + '<input class="stx-in" id="stxMin" type="number" min="0" max="7200" '
      + 'placeholder="min seconds" style="width:110px" value="' + (sc.min_seconds || "") + '">'
      + '<input class="stx-in" id="stxFrom" type="date" style="width:150px" value="'
      + esc(sc.date_from || "") + '">'
      + '<span class="stx-check"><input type="checkbox" id="stxQuote"'
      + (sc.quote_only ? " checked" : "") + "> quote calls only</span>"
      + '<span class="stx-check"><input type="checkbox" id="stxFirst"'
      + (sc.first_contact_only ? " checked" : "") + "> first contacts only</span>"
      + '<span class="stx-check"><input type="checkbox" id="stxShared"'
      + (sc.include_shared ? " checked" : "") + "> include the shared line</span>"
      + "</div>"
      + '<p class="rs-hint">Checking is free, so scope only decides which calls count. '
      + "<b>Quote calls only</b> leaves out service calls. <b>First contacts only</b> keeps "
      + "each lead's first quote call — right for a question asked once per lead, such as "
      + "where the customer heard about us. Only calls linked to a lead count: about 1 in 5 "
      + "quote calls never link and are left out, and a new customer's call joins when their "
      + "lead arrives with the weekly lead export, up to about a week later. A <b>from</b> "
      + "date measures from that day on. "
      + "<b>Include the shared line</b> adds the Support Zip To Zip queue, which is not a "
      + "person.</p>"
      + "</div>"
      + '<div class="full" style="display:flex;gap:8px;align-items:center">'
      + '<button class="rs-btn pri" id="stxSave">'
      + (t.isNew ? "Create tracker" : "Save changes") + "</button>"
      + '<button class="rs-btn" id="stxCancel">Cancel</button>'
      + '<span class="stx-thin">changing the keywords, note or scope re-checks every '
      + "matching call on the next pass</span></div>"
      + "</div></div>";

    var kwEl = elt.querySelector("#stxKw");
    var paintKw = function () { kwPreview(elt.querySelector("#stxKwPrev"), kwEl.value); };
    kwEl.oninput = paintKw;
    paintKw();

    // the kit dropdown, not a naked <select> — same values, same default ("any")
    var dirSel = RSC.localSelect(elt.querySelector("#stxDir"), {
      label: "Direction", values: ["any", "inbound", "outbound"],
      value: sc.direction || "any", form: true, required: true,
    });

    var nameEl = elt.querySelector("#stxName");
    if (t.isNew) {
      nameEl.oninput = function () {
        elt.querySelector("#stxKey").value = keyFromName(nameEl.value);
      };
    }
    elt.querySelector("#stxCancel").onclick = function () { S.edit = null; elt.innerHTML = ""; };
    elt.querySelector("#stxSave").onclick = function () {
      var scope = {
        direction: dirSel.get(),
        min_seconds: +elt.querySelector("#stxMin").value || 0,
        date_from: elt.querySelector("#stxFrom").value || "",
        quote_only: elt.querySelector("#stxQuote").checked,
        first_contact_only: elt.querySelector("#stxFirst").checked,
        include_shared: elt.querySelector("#stxShared").checked,
      };
      var payload = {
        action: "save",
        key: t.isNew ? keyFromName(nameEl.value) : t.key,
        name: nameEl.value.trim(),
        mode: "keyword",
        description: elt.querySelector("#stxDesc").value.trim(),
        keywords: elt.querySelector("#stxKw").value.trim(),
        scope: scope,
      };
      api("/api/_trackers", { method: "POST", body: JSON.stringify(payload) })
        .then(function () { S.edit = null; render(host); })
        .catch(async function (e) {
          // the revive rule surfaces here: a deleted key needs an explicit yes
          if (/revive:true/.test(e.message)
              && await RSC.confirm({
                   body: e.message + "\n\nBring the old tracker back with its verdicts?",
                   yes: "Bring it back",
                 })) {
            payload.revive = true;
            api("/api/_trackers", { method: "POST", body: JSON.stringify(payload) })
              .then(function () { S.edit = null; render(host); })
              .catch(function (e2) { RSC.notice(e2.message); });
          } else { RSC.notice(e.message); }
        });
    };
  }

  if (window.registerPage) {
    registerPage({
      id: "sales-trackers",
      group: "sales",
      title: "Sales Trackers",
      render: render,
    });
  }
})();
