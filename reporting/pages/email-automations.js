/* EMAIL AUTOMATIONS -- the survey sender grown into a builder for any customer email (tracker ZTZ-60,
 * his picks of 10 Nov 2026). Bridge: bridge/email_auto.py (/api/_emailadmin).
 *
 *   AUTOMATIONS   the list, each card with its numbers (sent, delivered, opened, clicked, its goal,
 *                 bounced, unsubscribed) and its checks. The Customer Survey is automation #1 and opens
 *                 its own page (unchanged for Tako). A card opens the automation: Overview, Queue (who
 *                 gets it next; ask-first automations are sent from here), Sends, Settings.
 *   BUILDER       his order: 1 name, 2 the email, 3 the audience, then 4 timing (ask first or
 *                 automatic), 5 a test send, 6 checks and launch. Every step saves the draft.
 *   SINGLE SENDS  one-off emails to customers (people who moved with us): name, email, audience, test,
 *                 then send now or at a set time.
 *
 * THE SERVER OWNS EVERY LIMIT: no email, unsubscribed, once per move, the days after, the gap between
 * emails, at most 300 per press -- whatever the page sends.
 */
(() => {
  function injectStyle() {
    if (document.getElementById("eam-style")) return;
    const st = document.createElement("style");
    st.id = "eam-style";
    st.textContent = ""
      + ".eam{font-variant-numeric:tabular-nums}"
      + ".eam-tabs{display:flex;gap:6px;margin:4px 0 14px;flex-wrap:wrap;align-items:center}"
      + ".eam-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".eam-sub{display:block;font-size:12px;color:var(--faint);margin-top:2px}"
      + ".eam-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px}"
      + ".eam-card.click{cursor:pointer}.eam-card.click:hover{border-color:var(--muted)}"
      + ".eam-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}"
      + ".eam-name{font-size:15.5px;font-weight:700;color:var(--ink)}"
      + ".eam-right{margin-left:auto;font-size:12px;color:var(--faint)}"
      + ".eam-pill{display:inline-block;font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:99px;margin:4px 6px 0 0;"
      + "white-space:nowrap;background:var(--panel-2);color:var(--muted)}"
      + ".eam-ok{background:rgba(22,163,74,.12);color:#15803d}.eam-warn{background:rgba(217,119,6,.13);color:#b45309}"
      + ".eam-bad{background:rgba(220,38,38,.12);color:#b91c1c}.eam-info{background:rgba(37,99,235,.11);color:#1d4ed8}"
      + ".eam-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin:12px 0 4px}"
      + ".eam-k div{background:var(--panel-2);border-radius:10px;padding:8px 10px}"
      + ".eam-k b{display:block;font-size:17px;font-weight:800;color:var(--ink)}.eam-k span{font-size:11.5px;color:var(--faint)}"
      + ".eam-steps{display:flex;gap:6px;margin:4px 0 14px;flex-wrap:wrap}"
      + ".eam-step{flex:1;min-width:110px;padding:9px 11px;border-radius:10px;background:var(--panel-2);font-size:12px;"
      + "color:var(--faint);cursor:pointer;border:1px solid transparent}"
      + ".eam-step b{display:block;font-size:13px;color:var(--muted)}"
      + ".eam-step.on{border-color:var(--brand);background:var(--panel)}.eam-step.on b{color:var(--ink)}"
      + ".eam-step.done b::after{content:' \\2713';color:#15803d}"
      + ".eam-step.lock{cursor:not-allowed;opacity:.55}"
      + ".eam-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:16px;align-items:start}"
      + "@media (max-width:1000px){.eam-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".eam-ed label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:12px 0 5px}"
      + ".eam-ed input:not([type=checkbox]):not([type=radio]),.eam-ed textarea,.eam-ed select{width:100%;box-sizing:border-box;"
      + "font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}"
      + ".eam-ed textarea{min-height:110px;resize:vertical;line-height:1.5}"
      + ".eam-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}"
      + ".eam-blk{border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:10px 0;background:var(--panel)}"
      + ".eam-blk-h{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:var(--muted)}"
      + ".eam-blk-h .rs-btn{padding:2px 8px;font-size:12px}"
      + ".eam-blk input,.eam-blk textarea{margin-top:6px}"
      + ".eam-pv{border:1px solid var(--line);border-radius:14px;background:#f2f1ec;overflow:hidden}"
      + ".eam-pv iframe{display:block;border:0;width:100%;height:760px;background:#f2f1ec;margin:0 auto}"
      + ".eam-pv.mob iframe{width:390px;max-width:100%}"
      + ".eam-opt{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--line);border-radius:12px;"
      + "margin:8px 0;cursor:pointer;font-size:13px}"
      + ".eam-opt.on{border-color:var(--brand)}.eam-opt b{display:block;font-size:13.5px;color:var(--ink)}"
      + ".eam-chk{display:inline-flex;gap:6px;align-items:center;margin:4px 12px 4px 0;font-size:13px;cursor:pointer}"
      + ".eam-big{font-size:28px;font-weight:800;color:var(--ink);line-height:1.1}"
      + ".eam-bar{display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--panel-2)}"
      + ".eam-bar i{display:block;height:100%;background:var(--brand)}"
      + ".eam-fn{display:grid;grid-template-columns:120px minmax(0,1fr) 90px;gap:10px;align-items:center;margin:8px 0;font-size:13px}"
      + ".eam-fn b{text-align:right}"
      + ".eam tr.eam-dim td{opacity:.55}"
      + ".eam-sw{appearance:none;width:34px;height:20px;border-radius:99px;background:var(--line);position:relative;cursor:pointer;vertical-align:middle}"
      + ".eam-sw:checked{background:var(--brand)}"
      + ".eam-sw::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .15s}"
      + ".eam-sw:checked::after{left:17px}.eam-sw:disabled{opacity:.35;cursor:not-allowed}"
      + ".eam-link{color:var(--brand);cursor:pointer;font-weight:600;text-decoration:underline}"
      + ".eam-empty{text-align:center;padding:42px 20px}.eam-empty b{display:block;font-size:16px;color:var(--ink);margin-bottom:6px}";
    document.head.appendChild(st);
  }

  const MAX_PER_SEND = 300;                    // bridge/email_auto.py MAX_SEND
  const CAT = { survey: ["Survey", "Its unsubscribe link stops survey emails"],
                reviews: ["Review request", "Its unsubscribe link stops review requests"],
                news: ["News and offers", "Its unsubscribe link stops news and offers"] };
  const SENDER_HELP = { survey: "survey@", reviews: "reviews@", hello: "hello@" };
  const STATE = { clicked: ["Clicked", "eam-ok"], opened: ["Opened", "eam-info"], delivered: ["Delivered", ""],
                  sent: ["Sent", ""], sending: ["Sending…", ""], failed: ["Failed", "eam-bad"],
                  bounced: ["Bounced", "eam-bad"], complained: ["Marked as spam", "eam-bad"],
                  unsubscribed: ["Unsubscribed", "eam-warn"] };
  const STEPS_AUTO = [["Name", "what it is for"], ["Email", "the template"], ["Audience", "who gets it"],
                      ["When", "timing and mode"], ["Test", "send it to yourself"], ["Launch", "checks and go"]];
  const STEPS_SINGLE = [["Name", "what it is for"], ["Email", "the template"], ["Audience", "who gets it"],
                        ["Test", "send it to yourself"], ["Send", "now or later"]];
  const BLOCK_NAMES = { heading: "Heading", text: "Text", button: "Button", image: "Picture", divider: "Line" };

  registerPage({
    id: "email-automations",
    group: "marketing-automations",
    title: "Email Automations",
    subtitle: "Every customer email in one place: the automations with their results, a step-by-step builder, and one-off single sends.",
    datasets: [],

    render(host) {
      const RSC = window.RSC || {};
      const esc = RSC.esc || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
      const mine = host;
      // `host` is the portal's SHARED content box: a late answer after the reader moved on must not paint
      // this page over the next one (the survey's 10 Nov lesson), so a render token plus the hash decide
      const myRender = (window.__EAM_RENDER = (window.__EAM_RENDER || 0) + 1);
      const alive = () => document.body.contains(mine) && window.__EAM_RENDER === myRender
        && /(^|[#&])page=email-automations(&|$)/.test(location.hash);
      const S = window.__EAM || (window.__EAM = {
        tab: "autos", view: "list", days: 90, list: null, listErr: "", waiting: {},
        item: null, itemErr: "", dtab: "over", queue: null, qErr: "", sends: null, sErr: "",
        what: "auto", id: null, step: 1, draft: null, count: null, countErr: "", pv: "desk", pvHtml: "", pvSubject: "",
        testTo: "", msg: "", msgErr: false, busy: false, schedAt: "",
      });
      injectStyle();

      function api(path, opts) {
        return fetch(ZTZ.API + path, Object.assign({
          headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                                 (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
        }, opts || {})).then(r => r.json().then(j => {
          if (!r.ok || j.error) { const e = new Error(j.error || ("HTTP " + r.status)); e.blockers = j.blockers; e.page = j.page; throw e; }
          return j;
        }));
      }
      const post = body => api("/api/_emailadmin", { method: "POST", body: JSON.stringify(body) });
      const say = (m, bad) => { S.msg = m || ""; S.msgErr = !!bad; };
      const num = v => (typeof v === "number" ? v.toLocaleString() : (v == null ? "0" : v));
      const pct = (a, b) => (b ? Math.round(100 * a / b) + "%" : "—");
      const d10 = v => (v ? String(v).slice(0, 10) : "—");
      const dt = v => {
        if (!v) return "";
        const d = new Date(String(v).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? "" : "Z"));
        if (isNaN(d)) return String(v).replace("T", " ").slice(0, 16);
        return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " NJ";
      };
      const clone = o => JSON.parse(JSON.stringify(o || {}));
      const pill = (txt, cls) => '<span class="eam-pill ' + (cls || "") + '">' + esc(txt) + "</span>";
      const lvlCls = { ok: "eam-ok", info: "eam-info", warn: "eam-warn", bad: "eam-bad" };
      const statusPill = (st, mode) => {
        if (st === "live") return pill(mode === "auto" ? "Live · automatic" : "Live · asks first", "eam-ok");
        if (st === "paused") return pill("Paused", "eam-warn");
        if (st === "archived") return pill("Archived", "");
        if (st === "scheduled") return pill("Scheduled", "eam-info");
        if (st === "sending") return pill("Sending…", "eam-info");
        if (st === "sent") return pill("Sent", "eam-ok");
        return pill("Draft", "");
      };
      const msgLine = () => (S.msg ? '<p class="eam-note" style="color:' + (S.msgErr ? "var(--neg)" : "var(--pos)") + '">' + esc(S.msg) + "</p>" : "");

      // ---- loading -------------------------------------------------------------------------------
      function loadList() {
        S.list = null; S.listErr = ""; paint();
        api("/api/_emailadmin?view=list&days=" + S.days).then(j => {
          S.list = j; paint();
          // the "waiting" counts read the whole audience: one call per automation, after the list paints
          (j.automations || []).filter(a => a.status === "live" || a.status === "paused" || a.kind === "survey").forEach(a => {
            api("/api/_emailadmin?view=waiting&id=" + a.id).then(w => { S.waiting[a.id] = w; paint(); })
              .catch(() => { S.waiting[a.id] = { err: 1 }; paint(); });
          });
        }).catch(e => { S.listErr = e.message || String(e); paint(); });
      }
      function loadItem() {
        S.item = null; S.itemErr = ""; paint();
        api("/api/_emailadmin?view=auto&id=" + S.id + "&days=" + S.days).then(j => { S.item = j.item; paint(); })
          .catch(e => { if (e.page) { location.hash = "#page=" + e.page; return; } S.itemErr = e.message || String(e); paint(); });
      }
      function loadQueue() {
        S.queue = null; S.qErr = ""; paint();
        api("/api/_emailadmin?view=queue&id=" + S.id).then(j => { S.queue = j; paint(); })
          .catch(e => { S.qErr = e.message || String(e); paint(); });
      }
      function loadSends(single) {
        S.sends = null; S.sErr = ""; paint();
        api("/api/_emailadmin?view=sends&" + (single ? "single=" : "id=") + S.id + "&days=3650").then(j => { S.sends = j.sends; paint(); })
          .catch(e => { S.sErr = e.message || String(e); paint(); });
      }
      function loadSingle() {
        S.item = null; S.itemErr = ""; paint();
        api("/api/_emailadmin?view=single&id=" + S.id).then(j => { S.item = j.item; paint(); loadSends(true); })
          .catch(e => { S.itemErr = e.message || String(e); paint(); });
      }
      let pvT = null, cnT = null;
      function preview() {
        clearTimeout(pvT);
        pvT = setTimeout(() => {
          if (!S.draft) return;
          post({ action: "preview", template: S.draft.template, category: S.draft.category, sender: S.draft.sender }).then(j => {
            S.pvHtml = j.html || ""; S.pvSubject = j.subject || "";
            const f = host.querySelector("#eamPv"); if (f) f.srcdoc = S.pvHtml;
            const s = host.querySelector("#eamPvSubj"); if (s) s.textContent = S.pvSubject;
          }).catch(() => {});
        }, 400);
      }
      function count() {
        clearTimeout(cnT);
        cnT = setTimeout(() => {
          if (!S.draft) return;
          S.countErr = "";
          post({ action: "count", what: S.what, id: S.id, audience: S.draft.audience, schedule: S.draft.schedule,
                 category: S.draft.category }).then(j => { S.count = j; paint(); })
            .catch(e => { S.countErr = e.message || String(e); paint(); });
        }, 500);
      }

      // ---- navigation ----------------------------------------------------------------------------
      function toList(tab) {
        S.view = "list"; if (tab) S.tab = tab; S.item = null; S.draft = null; say(""); loadList();
      }
      function openAuto(a) {
        if (a.kind === "survey") { location.hash = "#page=surveys"; return; }
        if (a.status === "draft") { openBuilder("auto", a, a.step || 1); return; }
        S.view = "auto"; S.id = a.id; S.dtab = "over"; S.queue = null; S.sends = null; say(""); loadItem();
      }
      function openSingle(s1) {
        if (s1.status === "draft") { openBuilder("single", s1, s1.step || 1); return; }
        S.view = "single"; S.id = s1.id; S.sends = null; say(""); loadSingle();
      }
      function draftOf(it) {
        it = it || {};
        return { name: it.name || "", purpose: it.purpose || "", owner: it.owner || "", category: it.category || (S.what === "single" ? "news" : "reviews"),
                 sender: it.sender || "hello", mode: it.mode || "ask", template: clone(it.template && it.template.blocks ? it.template : DEFAULT_TPL()),
                 audience: clone(it.audience || {}), schedule: clone(it.schedule || {}) };
      }
      function DEFAULT_TPL() {
        return { subject: "A note from Zip To Zip Moving", preheader: "", sign_name: "Tako", sign_title: "Customer Care · Zip To Zip Moving",
                 blocks: [{ t: "text", text: "Hi {first}," }, { t: "text", text: "Write your message here." },
                          { t: "button", label: "Visit our website", url: "https://ziptozipmoving.com" }] };
      }
      function openBuilder(what, it, step) {
        S.view = "build"; S.what = what; S.id = it ? it.id : null; S.step = step || 1; S.count = null; S.pvHtml = "";
        S.itemFull = it || null;
        S.draft = draftOf(it);
        if (!S.draft.audience.source) S.draft.audience = { source: "moves", scores: [9, 10], states: [], distance: "local", claims: "none", review: "any", support: "any" };
        if (what === "single") S.draft.audience.source = "moves";
        if (!("days_after" in S.draft.schedule)) S.draft.schedule = { days_after: 14, look_back: 46, run_hour: 10, daily_cap: 200, gap_days: 7 };
        say("");
        if (it && it.id && what === "auto") {
          // a list row carries no template for drafts made elsewhere: read the full item
          api("/api/_emailadmin?view=auto&id=" + it.id).then(j => { S.itemFull = j.item; S.draft = draftOf(j.item); afterStep(); paint(); }).catch(() => {});
        } else if (it && it.id && what === "single") {
          api("/api/_emailadmin?view=single&id=" + it.id).then(j => { S.itemFull = j.item; S.draft = draftOf(j.item); S.draft.audience.source = "moves"; afterStep(); paint(); }).catch(() => {});
        }
        afterStep(); paint();
      }
      function afterStep() {
        if (S.step === 2) preview();
        if (S.step === 3) count();
      }
      function save(nextStep) {
        if (!S.draft) return Promise.resolve();
        S.busy = true; paint();
        const data = Object.assign({}, S.draft, { step: Math.max(nextStep || S.step, S.step) });
        return post({ action: "save", what: S.what, id: S.id, data }).then(j => {
          S.id = j.id; S.busy = false;
          return api("/api/_emailadmin?view=" + (S.what === "auto" ? "auto" : "single") + "&id=" + j.id).then(x => { S.itemFull = x.item; });
        }).then(() => { say(""); paint(); }).catch(e => { S.busy = false; say(e.message || String(e), true); paint(); throw e; });
      }
      function goStep(n) {
        const steps = S.what === "auto" ? STEPS_AUTO : STEPS_SINGLE;
        if (n < 1 || n > steps.length) return;
        if (!S.id && n > 1) {          // the first save makes the draft
          if (!S.draft.name.trim()) { say("Give it a name first.", true); paint(); return; }
        }
        save(n).then(() => { S.step = n; afterStep(); paint(); }).catch(() => {});
      }

      // ---- the LIST ------------------------------------------------------------------------------
      function kpis(st, goalLabel, opensOn, unsub) {
        st = st || {};
        const sent = st.sent || 0, del = st.delivered || 0;
        return '<div class="eam-k">'
          + "<div><b>" + num(sent) + "</b><span>Sent</span></div>"
          + "<div><b>" + pct(del, sent) + "</b><span>Delivered</span></div>"
          + "<div><b>" + (opensOn ? pct(st.opened || 0, del || sent) : "—") + "</b><span>Opened" + (opensOn ? "" : " (not tracked yet)") + "</span></div>"
          + "<div><b>" + pct(st.clicked || 0, del || sent) + "</b><span>Clicked</span></div>"
          + (goalLabel ? "<div><b>" + pct(st.goal || 0, sent) + "</b><span>" + esc(goalLabel) + "</span></div>" : "")
          + "<div><b>" + pct(st.bounced || 0, sent) + "</b><span>Bounced</span></div>"
          + "<div><b>" + num(unsub != null ? unsub : (st.unsub || 0)) + "</b><span>Unsubscribed</span></div></div>";
      }
      function goalOf(a) { return a.kind === "survey" ? "Answered" : a.category === "reviews" ? "Reviewed" : ""; }
      function listView() {
        let h = '<div class="eam-tabs">'
          + '<button class="rs-btn' + (S.tab === "autos" ? " pri" : "") + '" data-tab="autos">Automations</button>'
          + '<button class="rs-btn' + (S.tab === "single" ? " pri" : "") + '" data-tab="single">Single sends</button>'
          + '<span class="rs-spacer" style="flex:1"></span>'
          + '<select class="rs-inp" id="eamDays" style="width:auto">' + [[30, "Last 30 days"], [90, "Last 90 days"], [365, "Last 12 months"], [3650, "All time"]]
            .map(o => '<option value="' + o[0] + '"' + (S.days === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>"
          + '<button class="rs-btn pri" id="eamNew">' + (S.tab === "autos" ? "New automation" : "New single send") + "</button></div>";
        if (S.listErr) return h + '<div class="panel">Could not load: ' + esc(S.listErr) + ' <button class="rs-btn" data-retry="list" style="margin-left:10px">Try again</button></div>';
        if (!S.list) return h + '<div class="panel">Loading…</div>';
        const L = S.list, opensOn = L.tracking === "on";
        h += msgLine();
        if (L.tracking === "off") h += '<p class="eam-note">Opened shows "—" until open tracking is switched on in Resend (Domains → mail.ziptozip.app → Open tracking, tracker ZTZ-52).</p>';
        if (!L.resend) h += '<p class="eam-note">The bridge has no Resend key yet: tests and sends are off.</p>';
        if (S.tab === "autos") {
          const as = L.automations || [];
          if (!as.length) return h + '<div class="panel eam-empty"><b>No automations yet</b><span class="eam-note">Press New automation to build the first one.</span></div>';
          h += as.map(a => {
            const w = S.waiting[a.id];
            const waitPill = !w ? (a.status === "live" || a.kind === "survey" ? pill("Counting who is waiting…", "") : "")
              : w.err ? pill("Waiting count unavailable", "eam-warn")
              : a.mode === "auto" && a.kind !== "survey" ? pill(w.waiting + " go out at the next run (" + hourLab(a.schedule && a.schedule.run_hour) + ")", "eam-info")
              : pill(w.waiting + " waiting for your OK", w.waiting ? "eam-info" : "");
            return '<div class="eam-card click" data-auto="' + a.id + '"><div class="eam-head"><span class="eam-name">' + esc(a.name) + "</span>"
              + statusPill(a.status, a.mode) + (a.status === "draft" ? pill("Step " + (a.step || 1) + " of 6", "") : "")
              + '<span class="eam-right">' + esc(a.owner ? a.owner + " · " : "") + esc((SENDER_HELP[a.sender] || "hello@") + "mail.ziptozip.app") + "</span></div>"
              + '<div class="eam-sub">' + esc(a.summary || "") + (a.purpose ? " — " + esc(a.purpose) : "") + "</div>"
              + (a.status !== "draft" || (a.stats && a.stats.sent) ? kpis(a.stats, goalOf(a), opensOn) : "")
              + "<div>" + waitPill + (a.checks || []).map(c => pill(c.text, lvlCls[c.lvl])).join("") + "</div></div>";
          }).join("");
          return h + '<p class="eam-note">Numbers cover emails sent in the period. Opened, clicked and the goal are out of the delivered ones; '
            + "the goal is an answered survey, or a review written after the request.</p>";
        }
        const ss = L.singles || [];
        if (!ss.length) return h + '<div class="panel eam-empty"><b>No single sends yet</b><span class="eam-note">A single send is a one-off email to customers who moved with us. Press New single send.</span></div>';
        return h + ss.map(s1 => '<div class="eam-card click" data-single="' + s1.id + '"><div class="eam-head"><span class="eam-name">' + esc(s1.name) + "</span>"
          + statusPill(s1.status) + '<span class="eam-right">' + esc(s1.sent_at ? "sent " + dt(s1.sent_at) : s1.send_at ? "goes " + dt(s1.send_at) : "") + "</span></div>"
          + '<div class="eam-sub">' + esc(s1.summary || "") + "</div>"
          + (s1.status === "sent" || s1.status === "sending" ? kpis(s1.stats, "", opensOn) : "")
          + "<div>" + (s1.checks || []).map(c => pill(c.text, lvlCls[c.lvl])).join("") + (s1.note ? pill(s1.note, "") : "") + "</div></div>").join("");
      }
      const hourLab = h => { h = +h; if (isNaN(h)) return "—"; const ap = h < 12 ? "AM" : "PM"; return ((h % 12) || 12) + " " + ap + " NJ"; };

      // ---- one AUTOMATION -----------------------------------------------------------------------
      function funnel(st, opensOn, goalLabel) {
        st = st || {};
        const sent = st.sent || 0;
        const rows = [["Sent", sent], ["Delivered", st.delivered || 0]].concat(opensOn ? [["Opened", st.opened || 0]] : [])
          .concat([["Clicked", st.clicked || 0]]).concat(goalLabel ? [[goalLabel, st.goal || 0]] : []);
        return rows.map(r => '<div class="eam-fn"><span>' + esc(r[0]) + '</span><div class="eam-bar"><i style="width:' + (sent ? (100 * r[1] / sent).toFixed(1) : 0)
          + '%"></i></div><b>' + num(r[1]) + " <small style=\"font-weight:500;color:var(--faint)\">" + (r[0] === "Sent" ? "" : pct(r[1], sent)) + "</small></b></div>").join("");
      }
      function autoView() {
        let h = '<a class="eam-link" data-back="autos" style="font-size:12.5px">&larr; All automations</a>';
        if (S.itemErr) return h + '<div class="panel">Could not load: ' + esc(S.itemErr) + "</div>";
        const a = S.item;
        if (!a) return h + '<div class="panel">Loading…</div>';
        const opensOn = S.list ? S.list.tracking === "on" : false;
        h += '<div class="eam-head" style="margin:8px 0 4px"><span class="eam-name" style="font-size:20px">' + esc(a.name) + "</span>" + statusPill(a.status, a.mode) + "</div>"
          + '<div class="eam-sub">' + esc(a.summary || "") + " · from " + esc((SENDER_HELP[a.sender] || "hello@") + "mail.ziptozip.app")
          + " · " + esc((CAT[a.category] || ["Email"])[0]) + "</div>"
          + '<div class="rs-bar" style="margin:12px 0">'
          + '<button class="rs-btn" data-edit="1">Edit the steps</button>'
          + (a.status === "live" ? '<button class="rs-btn" data-status="paused">Pause</button>' : "")
          + (a.status === "paused" ? '<button class="rs-btn pri" data-status="live">Resume</button>' : "")
          + (a.status === "live" && a.mode === "auto" ? '<button class="rs-btn" id="eamRun"' + (S.busy ? " disabled" : "") + ">Run now</button>" : "")
          + (a.status !== "archived" ? '<button class="rs-btn" data-status="archived">Archive</button>' : '<button class="rs-btn" data-status="paused">Restore</button>')
          + "</div>" + msgLine()
          + '<div class="eam-tabs">' + [["over", "Overview"], ["queue", a.mode === "auto" ? "Next run" : "Queue"], ["sends", "Sends"]]
            .map(t => '<button class="rs-btn' + (S.dtab === t[0] ? " pri" : "") + '" data-dtab="' + t[0] + '">' + t[1] + "</button>").join("") + "</div>";
        if (S.dtab === "over") {
          h += '<div class="eam-grid"><div class="eam-card"><p style="font-weight:700;margin:0 0 6px">Last ' + (S.days >= 3650 ? "years" : S.days + " days") + "</p>"
            + funnel(a.stats, opensOn, goalOf(a))
            + '<p class="eam-note">' + num((a.stats || {}).bounced || 0) + " bounced · " + num((a.stats || {}).complained || 0) + " marked as spam · "
            + num((a.stats || {}).unsub || 0) + " unsubscribed · " + num((a.stats || {}).failed || 0) + " failed</p></div>"
            + '<div class="eam-card"><p style="font-weight:700;margin:0 0 6px">Checks</p>'
            + ((a.checks || []).length ? a.checks.map(c => "<div>" + pill(c.text, lvlCls[c.lvl]) + "</div>").join("") : '<p class="eam-note">Nothing to flag.</p>')
            + '<p style="font-weight:700;margin:14px 0 6px">Runs</p>'
            + ((a.runs || []).length ? '<table class="rs-table"><thead><tr><th>When</th><th>How</th><th>Ready</th><th>Sent</th><th>Note</th></tr></thead><tbody>'
              + a.runs.map(r => "<tr><td>" + esc(dt(r.at)) + "</td><td>" + esc(r.how === "auto" ? "runner" : String(r.by_email || "").split("@")[0]) + "</td><td>"
                + num(r.eligible) + "</td><td>" + num(r.sent) + (r.failed ? " · " + r.failed + " failed" : "") + "</td><td>" + esc(r.note || "") + "</td></tr>").join("")
              + "</tbody></table>" : '<p class="eam-note">No runs yet.</p>') + "</div></div>";
        } else if (S.dtab === "queue") {
          h += queueView(a);
        } else {
          h += sendsView();
        }
        return h;
      }
      function queueView(a) {
        if (S.qErr) return '<div class="panel">Could not load: ' + esc(S.qErr) + "</div>";
        if (!S.queue) return '<div class="panel">Reading the audience…</div>';
        const rows = S.queue.rows || [];
        const ready = rows.filter(r => !(r.hard || []).length && !r.off);
        let h = '<p class="eam-note">' + esc(a.summary) + ". Window: " + esc(S.queue.lo) + " to " + esc(S.queue.hi) + ". "
          + rows.length + " match, <b>" + ready.length + "</b> can get it now. Switch a person off to keep them out.</p>";
        if (a.mode !== "auto" && a.status === "live") {
          h += '<div class="rs-bar" style="margin:0 0 10px"><button class="rs-btn pri" id="eamSend"' + (ready.length && !S.busy ? "" : " disabled") + ">Send to "
            + Math.min(ready.length, MAX_PER_SEND) + " now</button>"
            + (ready.length > MAX_PER_SEND ? '<span class="eam-sub">One press sends at most ' + MAX_PER_SEND + "; the rest stay for the next press.</span>" : "") + "</div>";
        } else if (a.mode === "auto") {
          h += '<p class="eam-note">Automatic: the runner sends these at ' + esc(hourLab(a.schedule.run_hour)) + ", at most " + a.schedule.daily_cap + " a day.</p>";
        } else {
          h += '<p class="eam-note">Launch it (Edit the steps → Launch) to send.</p>';
        }
        return h + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>On</th><th>Customer</th><th>" + (a.audience.source === "promised" ? "Promised" : "Move") + "</th><th>Foreman · score</th><th>Why not / flags</th></tr></thead><tbody>"
          + (rows.length ? rows.slice(0, 500).map(r => {
            const hard = (r.hard || []);
            return '<tr class="' + (hard.length || r.off ? "eam-dim" : "") + '"><td><input type="checkbox" class="eam-sw" data-off="' + esc(r.key) + '"'
              + (r.off ? "" : " checked") + (hard.length ? " disabled" : "") + "></td>"
              + "<td><b>" + esc(r.customer || "—") + '</b><span class="eam-sub">' + esc(r.email || "no email") + "</span></td>"
              + "<td>" + esc(d10(r.when)) + '<span class="eam-sub">' + esc(r.state || "") + "</span></td>"
              + "<td>" + esc(r.foreman || "—") + '<span class="eam-sub">' + (r.score != null ? "score " + esc(r.score) + "/10" : "") + "</span></td>"
              + "<td>" + hard.map(x => pill(x, "eam-bad")).join("") + (r.flags || []).map(x => pill(x, "eam-warn")).join("") + "</td></tr>";
          }).join("") : '<tr><td colspan="5" class="dim">Nobody matches right now.</td></tr>')
          + "</tbody></table></div></div>";
      }
      function sendsView() {
        if (S.sErr) return '<div class="panel">Could not load the sends: ' + esc(S.sErr) + "</div>";
        if (!S.sends) return '<div class="panel">Loading the sends…</div>';
        const tl = s => [["Delivered", s.delivered_at], ["Opened", s.opened_at], ["Clicked", s.clicked_at], ["Bounced", s.bounced_at], ["Unsubscribed", s.unsub_at]]
          .filter(x => x[1]).map(x => x[0] + " " + dt(x[1]).replace(" NJ", "")).join(" · ");
        return '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Customer</th><th>Move</th><th>Sent</th><th>Status</th></tr></thead><tbody>"
          + (S.sends.length ? S.sends.slice(0, 1000).map(s => {
            const st = STATE[s.state_now] || [s.state_now, ""];
            return "<tr><td><b>" + esc(s.customer || "—") + '</b><span class="eam-sub">' + esc(s.email || "") + "</span></td>"
              + "<td>" + esc(d10(s.move_date)) + '<span class="eam-sub">' + esc(s.state || "") + "</span></td>"
              + "<td>" + esc(dt(s.sent_at || s.created_at)) + '<span class="eam-sub">' + esc(String(s.sent_by || "").split("@")[0]) + " · " + esc(s.campaign || "") + "</span></td>"
              + "<td>" + pill(st[0], st[1]) + '<span class="eam-sub">' + esc(tl(s)) + (s.error ? " · " + esc(s.error) : "") + (s.bounce_note ? " · " + esc(s.bounce_note) : "") + "</span></td></tr>";
          }).join("") : '<tr><td colspan="4" class="dim">Nothing sent yet.</td></tr>') + "</tbody></table></div></div>";
      }

      // ---- one SINGLE SEND ----------------------------------------------------------------------
      function singleView() {
        let h = '<a class="eam-link" data-back="single" style="font-size:12.5px">&larr; All single sends</a>';
        if (S.itemErr) return h + '<div class="panel">Could not load: ' + esc(S.itemErr) + "</div>";
        const s1 = S.item;
        if (!s1) return h + '<div class="panel">Loading…</div>';
        const opensOn = S.list ? S.list.tracking === "on" : false;
        h += '<div class="eam-head" style="margin:8px 0 4px"><span class="eam-name" style="font-size:20px">' + esc(s1.name) + "</span>" + statusPill(s1.status) + "</div>"
          + '<div class="eam-sub">' + (s1.sent_at ? "Sent " + esc(dt(s1.sent_at)) + " by " + esc(String(s1.sent_by || "").split("@")[0]) : s1.send_at ? "Goes out " + esc(dt(s1.send_at)) : "") + "</div>"
          + '<div class="rs-bar" style="margin:12px 0">'
          + (s1.status === "scheduled" ? '<button class="rs-btn" data-sstatus="draft">Cancel the schedule</button><button class="rs-btn" data-edit="1">Edit</button>' : "")
          + (s1.status === "sent" ? '<button class="rs-btn" data-sstatus="archived">Archive</button>' : "") + "</div>" + msgLine();
        if (s1.status === "sent" || s1.status === "sending") {
          h += '<div class="eam-card">' + funnel(s1.stats, opensOn, "") + '<p class="eam-note">' + num((s1.stats || {}).bounced || 0) + " bounced · "
            + num((s1.stats || {}).unsub || 0) + " unsubscribed · " + num((s1.stats || {}).failed || 0) + " failed" + (s1.note ? " · " + esc(s1.note) : "") + "</p></div>";
        }
        return h + sendsView();
      }

      // ---- the BUILDER --------------------------------------------------------------------------
      function stepper() {
        const steps = S.what === "auto" ? STEPS_AUTO : STEPS_SINGLE;
        const furthest = Math.max(S.step, (S.itemFull && S.itemFull.step) || 1);
        return '<div class="eam-steps">' + steps.map((s, i) => {
          const n = i + 1, lock = !S.id && n > 1;
          return '<div class="eam-step' + (n === S.step ? " on" : "") + (n < furthest && n !== S.step ? " done" : "") + (lock ? " lock" : "")
            + '" data-step="' + n + '"><b>' + n + " " + s[0] + "</b>" + s[1] + "</div>";
        }).join("") + "</div>";
      }
      function navButtons(last) {
        const steps = S.what === "auto" ? STEPS_AUTO : STEPS_SINGLE;
        return '<div class="rs-bar" style="margin-top:16px">'
          + (S.step > 1 ? '<button class="rs-btn" data-go="' + (S.step - 1) + '">Back</button>' : "")
          + '<button class="rs-btn" id="eamSaveDraft"' + (S.busy ? " disabled" : "") + ">Save draft</button>"
          + '<span class="rs-spacer" style="flex:1"></span>'
          + (S.step < steps.length && !last ? '<button class="rs-btn pri" data-go="' + (S.step + 1) + '"' + (S.busy ? " disabled" : "") + ">Save and continue</button>" : "")
          + "</div>";
      }
      function stepName() {
        const d = S.draft;
        return '<div class="panel eam-ed" style="max-width:760px">'
          + '<label for="eamName">Name</label><input id="eamName" maxlength="120" value="' + esc(d.name) + '" placeholder="' + (S.what === "auto" ? "Review request" : "Winter storage offer") + '">'
          + (S.what === "auto" ? '<label for="eamPurpose">What it is for</label><input id="eamPurpose" maxlength="300" value="' + esc(d.purpose) + '" placeholder="Ask happy customers for a Google review">' : "")
          + "<label>Type of email</label>"
          + Object.keys(CAT).filter(k => S.what === "auto" || k !== "survey").map(k => '<div class="eam-opt' + (d.category === k ? " on" : "") + '" data-cat="' + k + '"><input type="radio"'
            + (d.category === k ? " checked" : "") + "><div><b>" + esc(CAT[k][0]) + "</b>" + esc(CAT[k][1]) + ".</div></div>").join("")
          + (S.what === "auto" ? '<label for="eamOwner">Owner</label><input id="eamOwner" maxlength="60" value="' + esc(d.owner) + '" placeholder="Tako">' : "")
          + navButtons() + "</div>";
      }
      function blockEditor(b, i, n) {
        const head = '<div class="eam-blk-h">' + esc(BLOCK_NAMES[b.t] || b.t) + '<span class="rs-spacer" style="flex:1"></span>'
          + '<button class="rs-btn" data-bmv="' + i + ':-1"' + (i ? "" : " disabled") + ' title="Move up">&uarr;</button>'
          + '<button class="rs-btn" data-bmv="' + i + ':1"' + (i < n - 1 ? "" : " disabled") + ' title="Move down">&darr;</button>'
          + '<button class="rs-btn" data-bdel="' + i + '" title="Remove">&times;</button></div>';
        let body = "";
        if (b.t === "heading") body = '<input data-bf="' + i + ':text" maxlength="160" value="' + esc(b.text || "") + '">';
        else if (b.t === "text") {
          const tx = String(b.text || "");
          const rows = Math.min(12, Math.max(2, tx.split(/\r?\n/).length + Math.ceil(tx.length / 70)));
          body = '<textarea data-bf="' + i + ':text" maxlength="3000" rows="' + rows + '" style="min-height:0">' + esc(tx) + "</textarea>";
        }
        else if (b.t === "button") body = '<div class="eam-two"><input data-bf="' + i + ':label" maxlength="60" placeholder="Button text" value="' + esc(b.label || "") + '">'
          + '<input data-bf="' + i + ':url" maxlength="500" placeholder="https://… where it goes" value="' + esc(b.url || "") + '"></div>';
        else if (b.t === "image") body = '<input data-bf="' + i + ':url" maxlength="500" placeholder="https://… the picture" value="' + esc(b.url || "") + '">'
          + '<div class="eam-two"><input data-bf="' + i + ':alt" maxlength="120" placeholder="What it shows" value="' + esc(b.alt || "") + '">'
          + '<input data-bf="' + i + ':href" maxlength="500" placeholder="https://… link (optional)" value="' + esc(b.href || "") + '"></div>';
        return '<div class="eam-blk">' + head + body + "</div>";
      }
      function stepEmail() {
        const d = S.draft, t = d.template;
        const senders = (S.list && S.list.sender_ids) || ["survey", "reviews", "hello"];
        return '<div class="eam-grid"><div class="panel eam-ed">'
          + '<p class="eam-note" style="margin-top:0">In any text, <b>{first}</b> is the customer\'s first name, <b>{move_date}</b> their move day, '
          + "<b>{foreman}</b> their foreman and <b>{state}</b> the state. A blank line starts a new paragraph. The footer (address and unsubscribe) is added to every email.</p>"
          + '<label for="eamSender">From</label><select id="eamSender">' + senders.map(x => '<option value="' + x + '"' + (d.sender === x ? " selected" : "") + ">Zip To Zip Moving &lt;"
            + x + "@mail.ziptozip.app&gt;</option>").join("") + "</select>"
          + '<label for="eamSubj">Subject</label><input id="eamSubj" maxlength="160" value="' + esc(t.subject || "") + '">'
          + '<label for="eamPre">Preview line (shown in the inbox after the subject)</label><input id="eamPre" maxlength="160" value="' + esc(t.preheader || "") + '">'
          + "<label>The email</label>" + (t.blocks || []).map((b, i) => blockEditor(b, i, t.blocks.length)).join("")
          + '<div class="rs-bar" style="margin:6px 0">' + Object.keys(BLOCK_NAMES).map(k => '<button class="rs-btn" data-badd="' + k + '">+ ' + BLOCK_NAMES[k] + "</button>").join("") + "</div>"
          + '<div class="eam-two"><div><label for="eamSignN">Signed by</label><input id="eamSignN" maxlength="60" value="' + esc(t.sign_name || "") + '"></div>'
          + '<div><label for="eamSignT">Their title</label><input id="eamSignT" maxlength="120" value="' + esc(t.sign_title || "") + '"></div></div>'
          + msgLine() + navButtons() + "</div><div>"
          + '<div class="rs-bar"><b style="font-size:13px">Subject:</b><span id="eamPvSubj" style="font-size:13px">' + esc(S.pvSubject || "") + '</span><span class="rs-spacer" style="flex:1"></span>'
          + '<div class="rs-tog' + (S.pv === "desk" ? " on" : "") + '" data-pv="desk"><i></i>Desktop</div>'
          + '<div class="rs-tog' + (S.pv === "mob" ? " on" : "") + '" data-pv="mob"><i></i>Phone</div></div>'
          + '<div class="eam-pv ' + (S.pv === "mob" ? "mob" : "") + '"><iframe id="eamPv" title="Email preview" sandbox=""></iframe></div>'
          + '<p class="eam-note">The preview uses a sample customer, Jordan, who moved on October 24 with Giorgi.</p></div></div>';
      }
      function chk(group, val, on, label) {
        return '<label class="eam-chk"><input type="checkbox" data-' + group + '="' + esc(val) + '"' + (on ? " checked" : "") + ">" + esc(label) + "</label>";
      }
      function radio(key, val, cur, label) {
        return '<label class="eam-chk"><input type="radio" name="eam_' + key + '" data-aud="' + key + '" value="' + esc(val) + '"' + (cur === val ? " checked" : "") + ">" + esc(label) + "</label>";
      }
      function stepAudience() {
        const a = S.draft.audience;
        const promised = a.source === "promised";
        let h = '<div class="eam-grid"><div class="panel eam-ed">';
        if (S.what === "auto") {
          h += "<label>Who it is for</label>"
            + '<div class="eam-opt' + (!promised ? " on" : "") + '" data-src="moves"><input type="radio"' + (!promised ? " checked" : "") + "><div><b>Customers after their move</b>Completed Zip to Zip moves on the closing sheet.</div></div>"
            + '<div class="eam-opt' + (promised ? " on" : "") + '" data-src="promised"><input type="radio"' + (promised ? " checked" : "") + "><div><b>Customers who promised a review</b>Their foreman heard them say they would write one (the review bot's list).</div></div>";
        } else {
          h += '<p class="eam-note" style="margin-top:0">A single send goes to customers who moved with us, one email per address (their newest move).</p>'
            + '<div class="eam-two"><div><label for="eamFrom">Moves from</label><input type="date" id="eamFrom" value="' + esc(a.date_from || "") + '"></div>'
            + '<div><label for="eamTo">to</label><input type="date" id="eamTo" value="' + esc(a.date_to || "") + '"></div></div>';
        }
        if (!promised) {
          const sc = a.scores || [];
          h += "<label>Foreman's satisfaction score (closing sheet)</label><div>"
            + [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => chk("score", n, sc.indexOf(n) >= 0, String(n))).join("")
            + '</div><span class="eam-sub">None ticked = any score, missing scores included.</span>'
            + "<label>Move type</label><div>" + radio("distance", "local", a.distance, "Local only") + radio("distance", "ld", a.distance, "Long distance only")
            + radio("distance", "any", a.distance, "Both") + "</div>"
            + "<label>Claims</label><div>" + radio("claims", "none", a.claims, "Nothing on the Claims / Complaints board") + radio("claims", "any", a.claims, "Any") + "</div>"
            + "<label>Support contact after the move</label><div>" + radio("support", "exclude", a.support, "Leave them out") + radio("support", "any", a.support, "Any (shown as a flag)") + "</div>"
            + '<label for="eamStates">States (empty = all)</label><input id="eamStates" placeholder="NJ, NY, CT" value="' + esc((a.states || []).join(", ")) + '">';
        }
        h += "<label>Review written</label><div>" + radio("review", "no", a.review, "Not yet") + radio("review", "yes", a.review, "Already reviewed") + radio("review", "any", a.review, "Any") + "</div>"
          + '<p class="eam-note">Always left out, whatever the filters: no email, unsubscribed from this type of email, hard bounces, '
          + (S.what === "auto" ? "anyone this automation already emailed for the move, and anyone emailed by another automation in the last few days (step 4)." : "and repeat addresses.") + "</p>"
          + msgLine() + navButtons() + "</div><div>";
        const c = S.count;
        if (S.countErr) h += '<div class="panel">Could not count: ' + esc(S.countErr) + "</div>";
        else if (!c) h += '<div class="panel">Counting…</div>';
        else {
          const why = {};
          (c.sample || []).forEach(r => (r.hard || []).forEach(x => { why[x] = (why[x] || 0) + 1; }));
          h += '<div class="eam-card"><div class="eam-big">' + num(c.ready) + '</div><span class="eam-sub">can get it now, of ' + num(c.matched) + " who match"
            + (S.what === "auto" ? " (" + esc(c.lo) + " to " + esc(c.hi) + ")" : "") + "</span>"
            + '<p class="eam-note">' + esc(c.summary || "") + "</p>"
            + (Object.keys(why).length ? "<div>" + Object.keys(why).map(k => pill(why[k] + " " + k, "eam-warn")).join("") + '</div><span class="eam-sub">(held back, in the first 60 shown)</span>' : "") + "</div>"
            + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Customer</th><th>Date</th><th>Score</th><th></th></tr></thead><tbody>'
            + ((c.sample || []).length ? c.sample.map(r => '<tr class="' + ((r.hard || []).length ? "eam-dim" : "") + '"><td><b>' + esc(r.customer || "—") + '</b><span class="eam-sub">' + esc(r.email || "no email") + "</span></td><td>"
              + esc(d10(r.when)) + '<span class="eam-sub">' + esc(r.state || "") + "</span></td><td>" + esc(r.score != null ? r.score : "—") + "</td><td>"
              + (r.hard || []).map(x => pill(x, "eam-bad")).join("") + "</td></tr>").join("") : '<tr><td colspan="4" class="dim">Nobody matches.</td></tr>')
            + "</tbody></table></div></div>";
        }
        return h + "</div></div>";
      }
      function stepWhen() {
        const s = S.draft.schedule, src = S.draft.audience.source === "promised" ? "the promise" : "the move";
        const hours = Array.from({ length: 24 }, (_, i) => i);
        return '<div class="panel eam-ed" style="max-width:760px">'
          + '<div class="eam-two"><div><label for="eamAfter">Starts how many days after ' + src + '</label><input type="number" min="0" max="365" id="eamAfter" value="' + esc(s.days_after) + '"></div>'
          + '<div><label for="eamLook">Keeps trying for (days)</label><input type="number" min="1" max="365" id="eamLook" value="' + esc(s.look_back) + '"></div></div>'
          + '<span class="eam-sub">Someone is due ' + esc(s.days_after) + (+s.days_after === 1 ? " day" : " days") + " after " + src + ", and stays due for "
          + esc(s.look_back) + (+s.look_back === 1 ? " more day" : " more days") + " if nobody sends it.</span>"
          + "<label>Sending</label>"
          + '<div class="eam-opt' + (S.draft.mode === "ask" ? " on" : "") + '" data-mode="ask"><input type="radio"' + (S.draft.mode === "ask" ? " checked" : "") + "><div><b>Ask first</b>The queue fills by itself; a person looks at it and presses Send (as the survey does today).</div></div>"
          + '<div class="eam-opt' + (S.draft.mode === "auto" ? " on" : "") + '" data-mode="auto"><input type="radio"' + (S.draft.mode === "auto" ? " checked" : "") + "><div><b>Automatic</b>Sends by itself once a day at the hour below, to everyone due.</div></div>"
          + '<div class="eam-two"><div><label for="eamHour">Hour (New Jersey time)</label><select id="eamHour"' + (S.draft.mode === "auto" ? "" : " disabled") + ">"
          + hours.map(hh => '<option value="' + hh + '"' + (+s.run_hour === hh ? " selected" : "") + ">" + hourLab(hh) + "</option>").join("") + "</select></div>"
          + '<div><label for="eamCap">At most per day</label><input type="number" min="1" max="300" id="eamCap" value="' + esc(s.daily_cap) + '"></div></div>'
          + '<label for="eamGap">Skip people who got any of our emails in the last (days)</label><input type="number" min="0" max="60" id="eamGap" value="' + esc(s.gap_days) + '">'
          + '<span class="eam-sub">0 = no gap. Counts every automation and the survey.</span>'
          + msgLine() + navButtons() + "</div>";
      }
      function stepTest() {
        const it = S.itemFull || {};
        return '<div class="panel eam-ed" style="max-width:760px">'
          + '<p class="eam-note" style="margin-top:0">The test is the real email with real tracked links, sent to you or a company inbox. It stays out of every count. '
          + "Open it, press its button, and check it in Sends with Include tests.</p>"
          + '<label for="eamTestTo">Send a test to</label><div class="rs-bar" style="margin:0"><input id="eamTestTo" class="rs-inp" style="flex:1;min-width:200px" value="'
          + esc(S.testTo || ZTZ.email() || "") + '"><button class="rs-btn pri" id="eamTest"' + (S.busy || !(S.list && S.list.resend) ? " disabled" : "") + ">Send test</button></div>"
          + "<div style=\"margin-top:10px\">" + (it.tested ? pill("A test of the current email was sent " + dt(it.tested_at), "eam-ok") : pill("No test of the current email yet", "eam-warn")) + "</div>"
          + ((it.problems || []).length ? "<div>" + it.problems.map(p => pill(p, "eam-bad")).join("") + "</div>" : "")
          + msgLine() + navButtons() + "</div>";
      }
      const launchChecks = it => (it.checks || []).filter(c => c.lvl !== "bad" && !/^No test sent|^Draft:/.test(c.text));
      function stepLaunch() {
        const it = S.itemFull || {};
        const blockers = it.blockers || [];
        return '<div class="panel eam-ed" style="max-width:760px">'
          + '<p style="font-weight:700;margin:0 0 6px">' + esc(it.name || S.draft.name) + "</p>"
          + '<p class="eam-note" style="margin-top:0">' + esc(it.summary || "") + " · " + (S.draft.mode === "auto" ? "automatic at " + esc(hourLab(S.draft.schedule.run_hour)) : "asks first") + "</p>"
          + (blockers.length ? "<p style=\"font-weight:700;margin:12px 0 4px\">Before it can launch</p>" + blockers.map(b => "<div>" + pill(b, "eam-bad") + "</div>").join("")
            : "<div>" + pill("Ready to launch", "eam-ok") + "</div>")
          + (launchChecks(it).length ? '<p style="font-weight:700;margin:12px 0 4px">Checks</p>'
            + launchChecks(it).map(c => "<div>" + pill(c.text, lvlCls[c.lvl]) + "</div>").join("") : "")
          + msgLine()
          + '<div class="rs-bar" style="margin-top:16px"><button class="rs-btn" data-go="' + (S.step - 1) + '">Back</button>'
          + '<button class="rs-btn" id="eamSaveDraft">Save draft</button><span class="rs-spacer" style="flex:1"></span>'
          + (it.status === "live" ? pill("Live", "eam-ok") + '<button class="rs-btn" id="eamOpenLive">Open it</button>'
            : '<button class="rs-btn pri" id="eamLaunch"' + (blockers.length || S.busy ? " disabled" : "") + ">Launch</button>") + "</div></div>";
      }
      function stepSend() {
        const it = S.itemFull || {};
        const probs = (it.problems || []).concat(it.tested ? [] : ["Send a test of the current email first (step 4)."]);
        return '<div class="panel eam-ed" style="max-width:760px">'
          + '<p style="font-weight:700;margin:0 0 6px">' + esc(it.name || S.draft.name) + "</p>"
          + (probs.length ? probs.map(b => "<div>" + pill(b, "eam-bad") + "</div>").join("") : "<div>" + pill("Ready to send", "eam-ok") + "</div>")
          + '<p class="eam-note">It goes to everyone the audience shows as ready (step 3), once per address. Unsubscribed and bounced addresses are always left out.</p>'
          + '<div class="rs-bar" style="margin-top:10px"><button class="rs-btn pri" id="eamSendNow"' + (probs.length || S.busy ? " disabled" : "") + ">Send now</button></div>"
          + '<label for="eamAt">Or send it later (New Jersey time)</label>'
          + '<div class="rs-bar" style="margin:0"><input type="datetime-local" id="eamAt" value="' + esc(S.schedAt || "") + '" style="width:240px;flex:0 0 240px">'
          + '<button class="rs-btn" id="eamSchedule"' + (probs.length || S.busy ? " disabled" : "") + ">Schedule</button></div>"
          + msgLine()
          + '<div class="rs-bar" style="margin-top:16px"><button class="rs-btn" data-go="' + (S.step - 1) + '">Back</button><button class="rs-btn" id="eamSaveDraft">Save draft</button></div></div>';
      }
      function builderView() {
        const steps = S.what === "auto" ? STEPS_AUTO : STEPS_SINGLE;
        const name = S.what === "auto" ? (S.id ? "Edit automation" : "New automation") : (S.id ? "Edit single send" : "New single send");
        let h = '<a class="eam-link" data-back="' + (S.what === "auto" ? "autos" : "single") + '" style="font-size:12.5px">&larr; ' + (S.what === "auto" ? "All automations" : "All single sends") + "</a>"
          + '<div class="eam-head" style="margin:8px 0"><span class="eam-name" style="font-size:20px">' + esc(S.draft.name || name) + "</span>"
          + (S.itemFull ? statusPill(S.itemFull.status, S.itemFull.mode) : pill("New", "")) + "</div>" + stepper();
        const key = steps[S.step - 1][0];
        if (key === "Name") h += stepName();
        else if (key === "Email") h += stepEmail();
        else if (key === "Audience") h += stepAudience();
        else if (key === "When") h += stepWhen();
        else if (key === "Test") h += stepTest();
        else if (key === "Launch") h += stepLaunch();
        else h += stepSend();
        return h;
      }

      // ---- paint + wire -------------------------------------------------------------------------
      function paint() {
        if (!alive()) return;
        const v = S.view === "auto" ? autoView() : S.view === "single" ? singleView() : S.view === "build" ? builderView() : listView();
        host.innerHTML = '<div class="eam">' + v + "</div>";
        wire();
      }
      function wire() {
        const $ = sel => host.querySelector(sel), $$ = sel => host.querySelectorAll(sel);
        $$("[data-tab]").forEach(b => { b.onclick = () => { S.tab = b.dataset.tab; say(""); paint(); }; });
        $$("[data-retry]").forEach(b => { b.onclick = () => loadList(); });
        $$("[data-back]").forEach(b => { b.onclick = () => toList(b.dataset.back); });
        const days = $("#eamDays"); if (days) days.onchange = () => { S.days = +days.value; S.waiting = {}; loadList(); };
        const nw = $("#eamNew"); if (nw) nw.onclick = () => openBuilder(S.tab === "autos" ? "auto" : "single", null, 1);
        $$("[data-auto]").forEach(c => { c.onclick = () => { const a = (S.list.automations || []).find(x => x.id === +c.dataset.auto); if (a) openAuto(a); }; });
        $$("[data-single]").forEach(c => { c.onclick = () => { const s1 = (S.list.singles || []).find(x => x.id === +c.dataset.single); if (s1) openSingle(s1); }; });
        // one automation
        $$("[data-dtab]").forEach(b => { b.onclick = () => { S.dtab = b.dataset.dtab; paint(); if (S.dtab === "queue" && !S.queue) loadQueue(); if (S.dtab === "sends" && !S.sends) loadSends(false); }; });
        $$("[data-edit]").forEach(b => { b.onclick = () => openBuilder(S.view === "single" ? "single" : "auto", S.item, 1); });
        $$("[data-status]").forEach(b => { b.onclick = () => {
          const want = b.dataset.status;
          if (want === "archived" && !confirm("Archive this automation? It stops and leaves the list (its sends stay).")) return;
          post({ action: "status", what: "auto", id: S.id, status: want }).then(() => { say(want === "paused" ? "Paused." : want === "live" ? "Live again." : "Done."); loadItem(); })
            .catch(e => { say((e.blockers || [e.message]).join(" "), true); paint(); });
        }; });
        $$("[data-sstatus]").forEach(b => { b.onclick = () => {
          post({ action: "status", what: "single", id: S.id, status: b.dataset.sstatus }).then(() => { say("Done."); loadSingle(); })
            .catch(e => { say(e.message, true); paint(); });
        }; });
        $$("[data-off]").forEach(cb => { cb.onclick = ev => ev.stopPropagation(); cb.onchange = () => {
          const k = cb.dataset.off, off = !cb.checked;
          post({ action: "off", what: "auto", id: S.id, key: k, off }).then(() => {
            const r = (S.queue.rows || []).find(x => x.key === k); if (r) r.off = off; paint();
          }).catch(e => { say(e.message, true); cb.checked = !cb.checked; paint(); });
        }; });
        const sendB = $("#eamSend");
        if (sendB) sendB.onclick = () => {
          const ready = (S.queue.rows || []).filter(r => !(r.hard || []).length && !r.off).slice(0, MAX_PER_SEND);
          if (!ready.length || !confirm("Send \"" + S.item.name + "\" to " + ready.length + " customer" + (ready.length === 1 ? "" : "s") + " now? Each move gets it only once.")) return;
          S.busy = true; say("Sending…"); paint();
          post({ action: "send", what: "auto", id: S.id, keys: ready.map(r => r.key) }).then(j => {
            S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.skipped && j.skipped.length ? ", " + j.skipped.length + " skipped" : "") + ".", !!j.failed);
            S.sends = null; loadQueue(); loadItem();
          }).catch(e => { S.busy = false; say(e.message, true); loadQueue(); });
        };
        const runB = $("#eamRun");
        if (runB) runB.onclick = () => {
          if (!confirm("Run \"" + S.item.name + "\" now? It sends to everyone due, up to its daily limit, like the daily run.")) return;
          S.busy = true; say("Running…"); paint();
          post({ action: "run", what: "auto", id: S.id }).then(j => { S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.left ? ", " + j.left + " left for the next run" : "") + "."); loadItem(); })
            .catch(e => { S.busy = false; say(e.message, true); paint(); });
        };
        // the builder
        $$("[data-step]").forEach(b => { b.onclick = () => { const n = +b.dataset.step; if (n !== S.step) goStep(n); }; });
        $$("[data-go]").forEach(b => { b.onclick = () => goStep(+b.dataset.go); });
        const sd = $("#eamSaveDraft");
        if (sd) sd.onclick = () => { if (!S.draft.name.trim()) { say("Give it a name first.", true); paint(); return; } save().then(() => say("Saved.")).then(paint).catch(() => {}); };
        const bindText = (sel, fn) => { const el = $(sel); if (el) el.oninput = function () { fn(this.value); }; };
        bindText("#eamName", v => { S.draft.name = v; });
        bindText("#eamPurpose", v => { S.draft.purpose = v; });
        bindText("#eamOwner", v => { S.draft.owner = v; });
        $$("[data-cat]").forEach(o => { o.onclick = () => { S.draft.category = o.dataset.cat; paint(); }; });
        // email
        const snd = $("#eamSender"); if (snd) snd.onchange = () => { S.draft.sender = snd.value; preview(); };
        bindText("#eamSubj", v => { S.draft.template.subject = v; preview(); });
        bindText("#eamPre", v => { S.draft.template.preheader = v; preview(); });
        bindText("#eamSignN", v => { S.draft.template.sign_name = v; preview(); });
        bindText("#eamSignT", v => { S.draft.template.sign_title = v; preview(); });
        $$("[data-bf]").forEach(el => { el.oninput = function () { const [i, f] = el.dataset.bf.split(":"); S.draft.template.blocks[+i][f] = this.value; preview(); }; });
        $$("[data-badd]").forEach(b => { b.onclick = () => {
          const t = b.dataset.badd, bl = S.draft.template.blocks;
          if (bl.length >= 20) { say("At most 20 blocks.", true); paint(); return; }
          bl.push(t === "button" ? { t, label: "Open", url: "" } : t === "image" ? { t, url: "", alt: "", href: "" } : t === "divider" ? { t } : { t, text: "" });
          paint(); preview();
        }; });
        $$("[data-bdel]").forEach(b => { b.onclick = () => { S.draft.template.blocks.splice(+b.dataset.bdel, 1); paint(); preview(); }; });
        $$("[data-bmv]").forEach(b => { b.onclick = () => {
          const [i, d] = b.dataset.bmv.split(":").map(Number), bl = S.draft.template.blocks, j = i + d;
          if (j < 0 || j >= bl.length) return;
          const x = bl[i]; bl[i] = bl[j]; bl[j] = x; paint(); preview();
        }; });
        $$("[data-pv]").forEach(b => { b.onclick = () => { S.pv = b.dataset.pv; paint(); }; });
        const f = $("#eamPv"); if (f && S.pvHtml) f.srcdoc = S.pvHtml;
        // audience
        $$("[data-src]").forEach(o => { o.onclick = () => {
          const src = o.dataset.src, a = S.draft.audience;
          a.source = src;
          if (src === "promised") { a.review = "no"; }
          paint(); count();
        }; });
        $$("[data-score]").forEach(cb => { cb.onchange = () => {
          const n = +cb.dataset.score, sc = S.draft.audience.scores || (S.draft.audience.scores = []);
          const at = sc.indexOf(n); if (cb.checked && at < 0) sc.push(n); if (!cb.checked && at >= 0) sc.splice(at, 1);
          count();
        }; });
        $$("[data-aud]").forEach(r => { r.onchange = () => { S.draft.audience[r.dataset.aud] = r.value; count(); }; });
        bindText("#eamStates", v => { S.draft.audience.states = v.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)); count(); });
        const fr = $("#eamFrom"); if (fr) fr.onchange = () => { S.draft.audience.date_from = fr.value; count(); };
        const to = $("#eamTo"); if (to) to.onchange = () => { S.draft.audience.date_to = to.value; count(); };
        // when
        const numIn = (sel, k) => { const el = $(sel); if (el) el.oninput = function () { S.draft.schedule[k] = +this.value; }; };
        numIn("#eamAfter", "days_after"); numIn("#eamLook", "look_back"); numIn("#eamCap", "daily_cap"); numIn("#eamGap", "gap_days");
        const hr = $("#eamHour"); if (hr) hr.onchange = () => { S.draft.schedule.run_hour = +hr.value; };
        $$("[data-mode]").forEach(o => { o.onclick = () => { S.draft.mode = o.dataset.mode; paint(); }; });
        // test
        const tto = $("#eamTestTo"); if (tto) tto.oninput = function () { S.testTo = this.value; };
        const tb = $("#eamTest");
        if (tb) tb.onclick = () => {
          save().then(() => { S.busy = true; say("Sending the test…"); paint();
            return post({ action: "test", what: S.what, id: S.id, to: S.testTo || ZTZ.email() }); })
            .then(j => api("/api/_emailadmin?view=" + (S.what === "auto" ? "auto" : "single") + "&id=" + S.id).then(x => { S.itemFull = x.item; return j; }))
            .then(j => { S.busy = false; say("Test sent to " + j.to + ". Open it and press its button: the click shows in Sends."); paint(); })
            .catch(e => { S.busy = false; say(e.message || String(e), true); paint(); });
        };
        // launch
        const lb = $("#eamLaunch");
        if (lb) lb.onclick = () => {
          if (!confirm("Launch \"" + S.draft.name + "\"? " + (S.draft.mode === "auto" ? "It will send by itself every day at " + hourLab(S.draft.schedule.run_hour) + "." : "Its queue fills by itself; nothing sends until someone presses Send."))) return;
          S.busy = true; paint();
          save(6).then(() => post({ action: "status", what: "auto", id: S.id, status: "live" }))
            .then(() => { S.busy = false; S.view = "auto"; S.dtab = "over"; say("Live."); loadItem(); })
            .catch(e => { S.busy = false; say((e.blockers || [e.message]).join(" "), true); paint(); });
        };
        const ol = $("#eamOpenLive"); if (ol) ol.onclick = () => { S.view = "auto"; S.dtab = "over"; loadItem(); };
        // single: send now / schedule
        const at = $("#eamAt"); if (at) at.onchange = () => { S.schedAt = at.value; };
        const sn = $("#eamSendNow");
        if (sn) sn.onclick = () => {
          save().then(() => post({ action: "count", what: "single", id: S.id, audience: S.draft.audience, category: S.draft.category })).then(c => {
            if (!confirm("Send \"" + S.draft.name + "\" now to " + c.ready + " customer" + (c.ready === 1 ? "" : "s") + "? This cannot be undone.")) return null;
            S.busy = true; say("Sending…"); paint();
            return post({ action: "single_send", what: "single", id: S.id });
          }).then(j => { if (!j) return; S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + "."); S.view = "single"; loadSingle(); })
            .catch(e => { S.busy = false; say((e.blockers || [e.message]).join(" "), true); paint(); });
        };
        const sch = $("#eamSchedule");
        if (sch) sch.onclick = () => {
          if (!S.schedAt) { say("Pick a date and time first.", true); paint(); return; }
          save().then(() => post({ action: "single_send", what: "single", id: S.id, at: S.schedAt }))
            .then(() => { say("Scheduled for " + S.schedAt.replace("T", " ") + " NJ."); S.view = "single"; loadSingle(); })
            .catch(e => { say((e.blockers || [e.message]).join(" "), true); paint(); });
        };
      }

      // ---- start ---------------------------------------------------------------------------------
      if (S.view === "list" || !S.list) { S.view = "list"; loadList(); }
      else paint();
    },
  });
})();
