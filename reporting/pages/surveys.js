/* CUSTOMER SURVEY -- Tako's feedback form by email (tracker ZTZ-46, 2026-11-09).
 *
 *   SEND LIST  every completed Zip to Zip move 14+ days old, with Tako's rule as the default filter
 *              (foreman's score 9-10, local, nothing on the Claims / Complaints board). Her filters
 *              widen or narrow it, a switch takes one person off, and ONE button sends to everyone
 *              shown. Nothing sends by itself.
 *   ANSWERS    what came back, bad answers flagged here only (an issue, or a low mark).
 *   EMAIL      subject, header (Sophie's A/B/C), text and button; desktop/phone preview; a test to me.
 *
 * THE SERVER OWNS EVERY LIMIT (bridge/survey.py): long-distance moves, no email, unsubscribed,
 * already surveyed (one survey per move) and moves under 14 days are refused on send whatever the
 * page sent. This page only shows and filters.
 */
(() => {
  function injectStyle() {
    if (document.getElementById("svy-style")) return;
    const st = document.createElement("style");
    st.id = "svy-style";
    st.textContent = ""
      + ".svy{font-variant-numeric:tabular-nums}"
      + ".svy-tabs{display:flex;gap:6px;margin:4px 0 14px;flex-wrap:wrap}"
      + ".svy-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".svy-sub{display:block;font-size:12px;color:var(--faint);margin-top:2px}"
      + ".svy-flag{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 8px;border-radius:99px;"
      + "background:rgba(217,119,6,.13);color:#b45309;margin:2px 4px 0 0}"
      + ".svy-bad{background:rgba(220,38,38,.12);color:#b91c1c}"
      + ".svy-ok{background:rgba(22,163,74,.12);color:#15803d}"
      + ".svy-sw{appearance:none;width:34px;height:20px;border-radius:99px;background:var(--line);position:relative;"
      + "cursor:pointer;vertical-align:middle;transition:background .15s}"
      + ".svy-sw:checked{background:var(--brand)}"
      + ".svy-sw::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;"
      + "background:#fff;transition:left .15s}"
      + ".svy-sw:checked::after{left:17px}.svy-sw:disabled{opacity:.35;cursor:not-allowed}"
      + ".svy tr.svy-dim td{opacity:.55}"
      + ".svy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start}"
      + "@media (max-width:1000px){.svy-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".svy-ed label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:12px 0 5px}"
      + ".svy-ed input,.svy-ed textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:9px 11px;"
      + "border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}"
      + ".svy-ed textarea{min-height:130px;resize:vertical;line-height:1.5}"
      + ".svy-hd{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}"
      + ".svy-hd button{font:inherit;text-align:left;border:2px solid var(--line);border-radius:12px;padding:10px;"
      + "background:var(--panel);cursor:pointer;color:var(--ink)}"
      + ".svy-hd button.on{border-color:var(--brand)}"
      + ".svy-hd b{display:block;font-size:13px}.svy-hd span{font-size:11.5px;color:var(--faint)}"
      + ".svy-sw-hd i{display:block;height:34px;border-radius:7px;margin-bottom:7px}"
      + ".svy-pv{border:1px solid var(--line);border-radius:14px;background:#ecebe5;overflow:hidden}"
      + ".svy-pv iframe{display:block;border:0;width:100%;height:760px;background:#ecebe5;margin:0 auto}"
      + ".svy-pv.mob iframe{width:390px;max-width:100%}"
      + ".svy-ans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px 18px;padding:12px 16px;"
      + "background:var(--panel-2);font-size:13px}"
      + ".svy-ans b{display:block;font-size:11.5px;color:var(--faint);font-weight:600}";
    document.head.appendChild(st);
  }

  const PAGE = 50;
  const SCALE5 = { booking: ["Very challenging", "Challenging", "Neutral", "Smooth", "Very smooth"],
                   crew: ["Very poor", "Poor", "Neutral", "Good", "Very good"],
                   transit: ["Very poor", "Poor", "Neutral", "Good", "Very good"] };
  const HEADS = { A: { n: "Help us do better", bg: "#8db13c" }, B: { n: "Tell us everything", bg: "#141414" },
                  C: { n: "How can we improve?", bg: "#8db13c" } };

  registerPage({
    id: "surveys",
    group: "reviews",
    title: "Customer Survey",
    subtitle: "Tako's feedback survey by email: who gets it, what came back, and the email itself.",
    datasets: [],

    render(host) {
      const RSC = window.RSC || {};
      const esc = RSC.esc || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
      const mine = host;
      const alive = () => document.body.contains(mine);
      const S = window.__SVY || (window.__SVY = {
        tab: "list", lo: "", hi: "", rows: null, resend: false, err: "", msg: "", msgErr: false, page: 0,
        score: "rule", states: null, review: "all", claim: "none", newOnly: false, q: "", show: "will",
        ans: null, alo: "", ahi: "", aOpen: null, aFlag: "all",
        tpl: null, draft: null, from: "", address: "", pv: "desk", pvHtml: "", busy: false,
      });

      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(r => r.json().then(j => {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        }));
      }
      const post = body => api("/api/_surveyadmin", { method: "POST", body: JSON.stringify(body) });
      const d10 = v => (v ? String(v).slice(0, 10) : "—");
      const say = (m, bad) => { S.msg = m; S.msgErr = !!bad; };

      injectStyle();

      function loadList() {
        S.rows = null; paint();
        const q = (S.lo ? "&lo=" + S.lo : "") + (S.hi ? "&hi=" + S.hi : "");
        return api("/api/_surveyadmin?view=list" + q).then(j => {
          S.rows = j.rows || []; S.lo = j.lo; S.hi = j.hi; S.resend = !!j.resend; S.err = "";
          if (!S.states) S.states = [];
          if (alive()) paint();
        }).catch(e => { S.err = e.message || String(e); S.rows = []; if (alive()) paint(); });
      }
      function loadAnswers() {
        S.ans = null; paint();
        const q = (S.alo ? "&lo=" + S.alo : "") + (S.ahi ? "&hi=" + S.ahi : "");
        const today = new Date().toISOString().slice(0, 10);
        const from = S.alo || new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
        return api("/api/_surveyadmin?view=responses&lo=" + from + "&hi=" + (S.ahi || today) + (q ? "" : ""))
          .then(j => { S.ans = j; S.alo = j.lo; S.ahi = j.hi; if (alive()) paint(); })
          .catch(e => { S.ans = { responses: [], err: e.message || String(e) }; if (alive()) paint(); });
      }
      function loadTemplate() {
        return api("/api/_surveyadmin?view=template").then(j => {
          S.tpl = j.template; S.draft = Object.assign({}, j.template); S.from = j.from; S.address = j.address;
          S.resend = !!j.resend;
          if (alive()) paint();
          return preview();
        }).catch(e => { say(e.message || String(e), true); if (alive()) paint(); });
      }
      function preview() {
        return post({ action: "preview", template: S.draft }).then(j => {
          S.pvHtml = j.html || ""; S.pvSubject = j.subject || "";
          const f = host.querySelector("#svyPv"); if (f) f.srcdoc = S.pvHtml;
          const s = host.querySelector("#svyPvSubj"); if (s) s.textContent = S.pvSubject;
        }).catch(() => {});
      }

      // ---- the list's filters: Tako's rule is the default ----------------------------------
      function visible(rows) {
        const q = S.q.trim().toLowerCase();
        return rows.filter(r => {
          const sc = +r.score || 0;
          if (S.score === "rule" && !(sc >= 9)) return false;
          if (S.score === "8" && !(sc >= 8)) return false;
          if (S.states && S.states.length && S.states.indexOf(r.state) < 0) return false;
          if (S.review === "yes" && !r.review) return false;
          if (S.review === "no" && r.review) return false;
          if (S.claim === "none" && r.complaints) return false;
          if (S.claim === "has" && !r.complaints) return false;
          if (S.newOnly && r.surveyed_before) return false;
          if (q && ![r.customer, r.email, r.foreman, r.job_no, r.state].some(v => String(v || "").toLowerCase().indexOf(q) >= 0)) return false;
          if (S.show === "will" && !(sendable(r))) return false;
          if (S.show === "sent" && r.invite_status !== "sent") return false;
          return true;
        });
      }
      const sendable = r => !r.hard.length && !r.off;
      function statusCell(r) {
        if (r.invite_status === "sent") return '<span class="svy-flag svy-ok">Sent ' + esc(d10(r.sent_at)) + "</span>";
        if (r.invite_status === "sending") return '<span class="svy-flag">Sending…</span>';
        if (r.hard.length) return '<span class="svy-flag svy-bad">' + esc(r.hard.join(", ")) + "</span>";
        if (r.off) return '<span class="svy-flag">Switched off</span>';
        return '<span class="svy-flag svy-ok">Will get it</span>'
          + (r.invite_status === "failed" ? '<span class="svy-sub">last send failed, will retry</span>' : "");
      }

      function listView() {
        if (S.rows === null) return '<div class="panel">Loading the moves…</div>';
        if (S.err) return '<div class="panel">Could not load the list: ' + esc(S.err) + "</div>";
        const rows = S.rows;
        const shown = visible(rows);
        const willSend = shown.filter(sendable);
        const states = Array.from(new Set(rows.map(r => r.state).filter(Boolean))).sort();
        const pages = Math.max(1, Math.ceil(shown.length / PAGE));
        if (S.page >= pages) S.page = pages - 1;
        const slice = shown.slice(S.page * PAGE, S.page * PAGE + PAGE);
        const tog = (key, val, label) => '<div class="rs-tog' + (S[key] === val ? " on" : "") + '" data-f="' + key + '" data-v="'
          + esc(val) + '"><i></i>' + esc(label) + "</div>";
        let h = '<p class="svy-note">Completed Zip to Zip moves between <b>' + esc(S.lo) + "</b> and <b>" + esc(S.hi)
          + "</b> (14 days after the move at the latest). <b>Tako's rule</b> is the default: foreman's score 9–10, local "
          + "move, nothing on the Claims / Complaints board. Calls or texts with the support line only show a flag. "
          + "Long-distance moves, no email, unsubscribed and already surveyed can never be sent.</p>";
        h += '<div class="rs-bar">'
          + '<label class="rs-fld"><span>Moves from</span><input type="date" class="rs-inp" id="svyLo" value="' + esc(S.lo) + '"></label>'
          + '<label class="rs-fld"><span>to</span><input type="date" class="rs-inp" id="svyHi" value="' + esc(S.hi) + '"></label>'
          + '<button class="rs-btn" id="svyReload">Show</button>'
          + '<label class="rs-fld"><span>Find</span><input class="rs-inp" id="svyQ" placeholder="Customer, email, foreman…" value="' + esc(S.q) + '"></label>'
          + "</div>";
        h += '<div class="rs-bar">'
          + "<b class=\"svy-sub\" style=\"margin:0 4px 0 0\">Foreman's score</b>" + tog("score", "rule", "9–10 (rule)") + tog("score", "8", "8+") + tog("score", "any", "Any")
          + "<b class=\"svy-sub\" style=\"margin:0 4px 0 12px\">Claim / complaint</b>" + tog("claim", "none", "None (rule)") + tog("claim", "has", "Has one") + tog("claim", "any", "Any")
          + "<b class=\"svy-sub\" style=\"margin:0 4px 0 12px\">Review written</b>" + tog("review", "all", "Any") + tog("review", "yes", "Yes") + tog("review", "no", "No")
          + "</div>";
        h += '<div class="rs-bar">'
          + "<b class=\"svy-sub\" style=\"margin:0 4px 0 0\">State</b>"
          + states.map(s => '<div class="rs-tog' + (S.states.indexOf(s) >= 0 ? " on" : "") + '" data-state="' + esc(s) + '"><i></i>' + esc(s) + "</div>").join("")
          + '<div class="rs-tog' + (S.newOnly ? " on" : "") + '" id="svyNew" style="margin-left:12px"><i></i>Not surveyed before</div>'
          + "<b class=\"svy-sub\" style=\"margin:0 4px 0 12px\">Show</b>" + tog("show", "will", "Will get it") + tog("show", "sent", "Sent") + tog("show", "all", "Everyone")
          + "</div>";
        const off = rows.filter(r => r.off && !r.hard.length).length;
        h += '<div class="rs-kpis" style="--kpi-cols:4">'
          + kpi(willSend.length, "Will get the survey", "with these filters, switched on")
          + kpi(rows.filter(r => r.rule).length, "Pass Tako's rule", "in this window")
          + kpi(off, "Switched off", "by hand")
          + kpi(rows.filter(r => r.invite_status === "sent").length, "Already sent", "in this window") + "</div>";
        h += '<div class="rs-bar" style="margin-top:12px"><span class="rs-spacer"></span>'
          + (S.resend ? "" : '<span class="svy-sub" style="margin-right:10px">Sending opens once the bridge has the Resend key.</span>')
          + '<button class="rs-btn pri" id="svySend"' + (willSend.length && S.resend && !S.busy ? "" : " disabled") + ">Send to "
          + willSend.length + " customer" + (willSend.length === 1 ? "" : "s") + "</button></div>";
        if (S.msg) h += '<p class="svy-note" style="color:' + (S.msgErr ? "var(--neg)" : "var(--pos)") + '">' + esc(S.msg) + "</p>";
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>On</th><th>Customer</th><th>Move</th><th>Foreman · score</th><th>Review</th><th>Flags</th><th>Status</th></tr></thead><tbody>"
          + (slice.length ? slice.map(r => {
            const can = !r.hard.length && r.invite_status !== "sent";
            return '<tr class="' + (sendable(r) ? "" : "svy-dim") + '"><td><input type="checkbox" class="svy-sw" data-off="' + esc(r.job_key) + '"'
              + (r.off ? "" : " checked") + (can ? "" : " disabled") + ' aria-label="Include ' + esc(r.customer) + '"></td>'
              + "<td><b>" + esc(r.customer || "—") + '</b><span class="svy-sub">' + esc(r.email || "no email") + "</span></td>"
              + "<td>" + esc(d10(r.move_date)) + '<span class="svy-sub">' + esc([r.state, r.moving_type].filter(Boolean).join(" · ")) + "</span></td>"
              + "<td>" + esc(r.foreman || "—") + '<span class="svy-sub">score ' + esc(r.score == null ? "—" : r.score) + "/10</span></td>"
              + "<td>" + (r.review ? "Yes" : "No") + "</td>"
              + "<td>" + (r.complaints ? '<span class="svy-flag svy-bad">claim / complaint' + (r.complaint_status ? ": " + esc(r.complaint_status) : "") + "</span>" : "")
              + (r.flags || []).map(f => '<span class="svy-flag">' + esc(f) + "</span>").join("")
              + (r.surveyed_before ? '<span class="svy-flag">surveyed before</span>' : "") + "</td>"
              + "<td>" + statusCell(r) + "</td></tr>";
          }).join("") : '<tr><td colspan="7" class="dim">No moves match these filters.</td></tr>')
          + "</tbody></table></div>"
          + (pages > 1 ? '<div class="rs-bar" style="padding:10px 14px"><span class="svy-sub">' + shown.length + " moves</span><span class=\"rs-spacer\"></span>"
            + '<button class="rs-btn" data-pg="-1"' + (S.page ? "" : " disabled") + ">Previous</button><span class=\"svy-sub\">Page " + (S.page + 1) + " of " + pages + "</span>"
            + '<button class="rs-btn" data-pg="1"' + (S.page >= pages - 1 ? " disabled" : "") + ">Next</button></div>" : "")
          + "</div>";
        return h;
      }

      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab) + '</div><div class="v">'
          + esc(typeof val === "number" ? val.toLocaleString() : val) + '</div><div class="s">' + esc(sub) + "</div></div>";
      }

      function answersView() {
        const A = S.ans;
        if (A === null) return '<div class="panel">Loading the answers…</div>';
        if (A.err) return '<div class="panel">Could not load the answers: ' + esc(A.err) + "</div>";
        const rs = A.responses || [];
        const avg = k => { const v = rs.map(r => +r[k]).filter(x => x > 0); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : "—"; };
        const flagged = rs.filter(r => +r.flagged === 1);
        const fromLinks = rs.filter(r => r.token).length;
        const list = S.aFlag === "flagged" ? flagged : rs;
        let h = '<div class="rs-bar"><label class="rs-fld"><span>Answered from</span><input type="date" class="rs-inp" id="svyALo" value="' + esc(A.lo || "") + '"></label>'
          + '<label class="rs-fld"><span>to</span><input type="date" class="rs-inp" id="svyAHi" value="' + esc(A.hi || "") + '"></label>'
          + '<button class="rs-btn" id="svyAReload">Show</button>'
          + '<div class="rs-tog' + (S.aFlag === "all" ? " on" : "") + '" data-af="all"><i></i>All</div>'
          + '<div class="rs-tog' + (S.aFlag === "flagged" ? " on" : "") + '" data-af="flagged"><i></i>Flagged only</div>'
          + '<span class="rs-spacer"></span><button class="rs-btn" id="svyACsv">Download CSV · ' + list.length + "</button></div>";
        h += '<div class="rs-kpis" style="--kpi-cols:5">'
          + kpi(rs.length, "Answers", fromLinks + " from emailed links · " + (rs.length - fromLinks) + " from the public link")
          + kpi(A.sent ? Math.round(100 * fromLinks / A.sent) + "%" : "—", "Response rate", (A.sent || 0) + " surveys sent in the period")
          + kpi(avg("overall"), "Overall satisfaction", "average of 1–5")
          + kpi(avg("recommend"), "Would recommend", "average of 1–5")
          + kpi(flagged.length, "Flagged", "an issue or a low mark", flagged.length ? "warn" : "") + "</div>";
        h += '<div class="panel" style="padding:0;margin-top:12px"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Answered</th><th>Customer</th><th>Move</th><th>Overall</th><th>Recommend</th><th>Booking · crew · transit</th><th>Worth it</th><th>Flag</th></tr></thead><tbody>"
          + (list.length ? list.map(r => {
            const open = S.aOpen === r.id;
            return '<tr data-open="' + r.id + '" style="cursor:pointer"><td>' + esc(String(r.submitted_at || "").replace("T", " ").slice(0, 16)) + '<span class="svy-sub">' + esc(r.utm_source || "") + "</span></td>"
              + "<td><b>" + esc(r.name || "—") + '</b><span class="svy-sub">' + esc(r.email || "") + "</span></td>"
              + "<td>" + esc(d10(r.move_date)) + '<span class="svy-sub">' + esc(r.move_type || "") + "</span></td>"
              + "<td>" + esc(r.overall) + "/5</td><td>" + esc(r.recommend) + "/5</td>"
              + "<td>" + [r.booking, r.crew, r.transit].map(v => esc(v)).join(" · ") + "</td><td>" + esc(r.worth || "") + "</td>"
              + "<td>" + (+r.flagged === 1 ? '<span class="svy-flag svy-bad">' + esc(r.flag_reason || "flagged") + "</span>" : "") + "</td></tr>"
              + (open ? '<tr><td colspan="8" style="padding:0"><div class="svy-ans">'
                + ans("Phone", r.phone) + ans("Enjoyed most", [r.enjoyed, r.enjoyed_other].filter(Boolean).join(" — "))
                + ans("Booking", SCALE5.booking[r.booking - 1]) + ans("Crew on moving day", SCALE5.crew[r.crew - 1])
                + ans("Kept informed in transit", SCALE5.transit[r.transit - 1]) + ans("Any issues", r.issue || "—")
                + ans("What happened", r.issue_text) + ans("What they'd change", r.change_text)
                + ans("Foreman", r.foreman) + ans("Campaign", r.utm_campaign || r.campaign) + "</div></td></tr>" : "");
          }).join("") : '<tr><td colspan="8" class="dim">No answers in this period yet.</td></tr>')
          + "</tbody></table></div></div>";
        return h;
      }
      const ans = (k, v) => "<div><b>" + esc(k) + "</b>" + esc(v == null || v === "" ? "—" : v) + "</div>";

      function emailView() {
        if (!S.draft) return '<div class="panel">Loading the email…</div>';
        const d = S.draft;
        let h = '<div class="svy-grid"><div class="panel svy-ed">'
          + '<p class="svy-note" style="margin-top:0">From <b>' + esc(S.from) + "</b>, a no-reply address. The footer carries "
          + esc(S.address) + " and an unsubscribe link. In the text, <b>{first}</b> is the customer's first name and "
          + "<b>{move_date}</b> their move day.</p>"
          + "<label>Header</label><div class=\"svy-hd\">" + Object.keys(HEADS).map(k =>
            '<button data-hd="' + k + '" class="svy-sw-hd' + (d.header === k ? " on" : "") + '"><i style="background:' + HEADS[k].bg + '"></i><b>' + k + " · " + esc(HEADS[k].n) + "</b><span>"
            + (k === "A" ? "the default" : "") + "</span></button>").join("") + "</div>"
          + '<label for="svySubj">Subject</label><input id="svySubj" maxlength="160" value="' + esc(d.subject) + '">'
          + '<label for="svyIntro">Text</label><textarea id="svyIntro" maxlength="2000">' + esc(d.intro) + "</textarea>"
          + '<label for="svyBtn">Button</label><input id="svyBtn" maxlength="60" value="' + esc(d.button) + '">'
          + '<div class="rs-bar" style="margin-top:14px"><button class="rs-btn pri" id="svySave"' + (S.busy ? " disabled" : "") + ">Save the email</button>"
          + '<button class="rs-btn" id="svyTest"' + (S.resend && !S.busy ? "" : " disabled") + ">Send a test to me</button></div>"
          + (S.resend ? "" : '<p class="svy-note">The test and the send open once Resend is set up.</p>')
          + (S.tpl && S.tpl.updated_by ? '<p class="svy-note">Last saved by ' + esc(S.tpl.updated_by) + " · " + esc(String(S.tpl.updated_at || "").replace("T", " ").slice(0, 16)) + " UTC</p>" : "")
          + (S.msg ? '<p class="svy-note" style="color:' + (S.msgErr ? "var(--neg)" : "var(--pos)") + '">' + esc(S.msg) + "</p>" : "")
          + "</div><div>"
          + '<div class="rs-bar"><b style="font-size:13px">Subject:</b><span id="svyPvSubj" style="font-size:13px">' + esc(S.pvSubject || "") + '</span><span class="rs-spacer"></span>'
          + '<div class="rs-tog' + (S.pv === "desk" ? " on" : "") + '" data-pv="desk"><i></i>Desktop</div>'
          + '<div class="rs-tog' + (S.pv === "mob" ? " on" : "") + '" data-pv="mob"><i></i>Phone</div></div>'
          + '<div class="svy-pv ' + (S.pv === "mob" ? "mob" : "") + '"><iframe id="svyPv" title="Email preview" sandbox=""></iframe></div>'
          + '<p class="svy-note">The preview uses a sample customer, Jordan, who moved on October 24.</p></div></div>';
        return h;
      }

      function paint() {
        if (!alive()) return;
        const tab = (id, label) => '<button class="rs-btn' + (S.tab === id ? " pri" : "") + '" data-tab="' + id + '">' + label + "</button>";
        host.innerHTML = '<div class="svy"><div class="svy-tabs">' + tab("list", "Send list") + tab("ans", "Answers") + tab("email", "Email") + "</div>"
          + (S.tab === "list" ? listView() : S.tab === "ans" ? answersView() : emailView()) + "</div>";
        wire();
      }

      function wire() {
        host.querySelectorAll("[data-tab]").forEach(b => { b.onclick = () => {
          S.tab = b.dataset.tab; say("");
          if (S.tab === "ans" && S.ans === null) loadAnswers();
          else if (S.tab === "email" && !S.draft) loadTemplate();
          else paint();
          if (S.tab === "email" && S.draft) preview();
        }; });
        host.querySelectorAll("[data-f]").forEach(b => { b.onclick = () => { S[b.dataset.f] = b.dataset.v; S.page = 0; paint(); }; });
        host.querySelectorAll("[data-state]").forEach(b => { b.onclick = () => {
          const s = b.dataset.state, i = S.states.indexOf(s); if (i >= 0) S.states.splice(i, 1); else S.states.push(s); S.page = 0; paint(); }; });
        const nw = host.querySelector("#svyNew"); if (nw) nw.onclick = () => { S.newOnly = !S.newOnly; S.page = 0; paint(); };
        host.querySelectorAll("[data-pg]").forEach(b => { b.onclick = () => { S.page += +b.dataset.pg; paint(); }; });
        const q = host.querySelector("#svyQ");
        if (q) { q.oninput = function () { S.q = this.value; S.page = 0; }; q.onchange = paint; q.onkeyup = e => { if (e.key === "Enter") paint(); }; }
        const rl = host.querySelector("#svyReload");
        if (rl) rl.onclick = () => { S.lo = host.querySelector("#svyLo").value; S.hi = host.querySelector("#svyHi").value; loadList(); };
        host.querySelectorAll("[data-off]").forEach(cb => { cb.onchange = () => {
          const k = cb.dataset.off, off = !cb.checked;
          post({ action: "off", job_key: k, off }).then(() => {
            const r = S.rows.find(x => x.job_key === k); if (r) r.off = off; paint();
          }).catch(e => { say(e.message || String(e), true); cb.checked = !cb.checked; paint(); });
        }; });
        const sb = host.querySelector("#svySend");
        if (sb) sb.onclick = () => {
          const list = visible(S.rows).filter(sendable);
          if (!list.length) return;
          if (!confirm("Send the survey to " + list.length + " customer" + (list.length === 1 ? "" : "s") + " now? Each move can get it only once.")) return;
          S.busy = true; say("Sending…"); paint();
          post({ action: "send", job_keys: list.map(r => r.job_key) }).then(j => {
            S.busy = false;
            say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.skipped && j.skipped.length ? ", " + j.skipped.length + " skipped" : "") + " · campaign " + j.campaign, !!j.failed);
            loadList();
          }).catch(e => { S.busy = false; say(e.message || String(e), true); paint(); });
        };
        // answers
        const ar = host.querySelector("#svyAReload");
        if (ar) ar.onclick = () => { S.alo = host.querySelector("#svyALo").value; S.ahi = host.querySelector("#svyAHi").value; loadAnswers(); };
        host.querySelectorAll("[data-af]").forEach(b => { b.onclick = () => { S.aFlag = b.dataset.af; paint(); }; });
        host.querySelectorAll("[data-open]").forEach(tr => { tr.onclick = () => { const id = +tr.dataset.open; S.aOpen = S.aOpen === id ? null : id; paint(); }; });
        const ac = host.querySelector("#svyACsv");
        if (ac) ac.onclick = () => csv();
        // email
        host.querySelectorAll("[data-hd]").forEach(b => { b.onclick = () => { S.draft.header = b.dataset.hd; paint(); preview(); }; });
        host.querySelectorAll("[data-pv]").forEach(b => { b.onclick = () => { S.pv = b.dataset.pv; paint(); preview(); }; });
        let t = null;
        [["#svySubj", "subject"], ["#svyIntro", "intro"], ["#svyBtn", "button"]].forEach(([sel, k]) => {
          const el = host.querySelector(sel);
          if (el) el.oninput = function () { S.draft[k] = this.value; clearTimeout(t); t = setTimeout(preview, 500); };
        });
        const sv = host.querySelector("#svySave");
        if (sv) sv.onclick = () => { S.busy = true; paint();
          post({ action: "template", template: S.draft }).then(j => { S.busy = false; S.tpl = j.template; say("Saved. The next send uses this email."); paint(); preview(); })
            .catch(e => { S.busy = false; say(e.message || String(e), true); paint(); }); };
        const ts = host.querySelector("#svyTest");
        if (ts) ts.onclick = () => { S.busy = true; paint();
          post({ action: "test", template: S.draft }).then(j => { S.busy = false; say("Test sent to " + j.to + "."); paint(); preview(); })
            .catch(e => { S.busy = false; say(e.message || String(e), true); paint(); preview(); }); };
        const f = host.querySelector("#svyPv"); if (f && S.pvHtml) f.srcdoc = S.pvHtml;
      }

      function csv() {
        const rs = (S.aFlag === "flagged" ? (S.ans.responses || []).filter(r => +r.flagged === 1) : (S.ans.responses || []));
        const cols = ["submitted_at", "name", "email", "phone", "move_date", "move_type", "enjoyed", "enjoyed_other", "booking", "crew",
                      "transit", "worth", "issue", "issue_text", "overall", "recommend", "change_text", "flag_reason", "utm_source",
                      "utm_medium", "utm_campaign", "foreman", "state"];
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [cols.join(",")].concat(rs.map(r => cols.map(c => cell(r[c])).join(",")));
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "customer-survey-answers-" + new Date().toISOString().slice(0, 10) + ".csv";
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }

      if (S.tab === "list") loadList();
      else if (S.tab === "ans") loadAnswers();
      else loadTemplate();
      if (S.tab === "list") api("/api/_surveyadmin?view=template").then(j => { S.resend = !!j.resend; }).catch(() => {});
    },
  });
})();
