/* EMAIL AUTOMATIONS -- every customer email in one place (tracker ZTZ-60). Bridge: bridge/email_auto.py
 * (/api/_emailadmin). The email editor itself is assets/email-designer.js (shared with the survey).
 *
 * v2, 11 Nov 2026 -- his picks after the design critique ("make this thing perfect and as easy to use as
 * it can get"):
 *   LIST          each card leads with what needs someone (who is waiting, the next run, the step a draft
 *                 is on) and the button that does it; the numbers show only once something was sent.
 *   ONE PAGE PER AUTOMATION, drafts and live alike: a left rail with Results (Overview, Queue, Sends) and
 *                 the setup steps, each with a one-line summary and Done / Fix / To do; the chosen part
 *                 fills the rest of the screen. Everything saves by itself ("Saved 3:41 PM" in the header).
 *                 Launch is a checklist whose problems each have a Fix button.
 *   SINGLE SENDS  the same page: Overview, Sends; Name, Email, Audience, Test, Send.
 * v3, 12 Nov 2026 (ZTZ-69 step 3): the Email step is the shared editor (assets/email-designer.js) across the
 *                 full width, the steps in a row above it. On a LIVE automation, email edits save as a draft
 *                 (email_automation.template_draft): customers keep getting the live email until someone
 *                 presses Make changes live; Discard changes drops the draft.
 * The Customer Survey is automation #1 and keeps its own page (unchanged for Tako): its card opens it.
 * THE SERVER OWNS EVERY LIMIT (no email, unsubscribed, once per move, the gap, 300 per press).
 */
(() => {
  function injectStyle() {
    if (document.getElementById("eam-style")) return;
    const st = document.createElement("style");
    st.id = "eam-style";
    st.textContent = ""
      + ".eam{font-variant-numeric:tabular-nums;color:var(--ink)}"
      + ".eam-help{font-size:12.5px;color:var(--muted);line-height:1.5;margin:6px 0 0}"
      + ".eam-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}"
      + ".eam-seg button{border:0;background:transparent;color:var(--ink);font:inherit;font-size:13px;padding:8px 14px;cursor:pointer;min-height:36px}"
      + ".eam-seg button+button{border-left:1px solid var(--line)}"
      + ".eam-seg button.on{background:var(--ink);color:var(--panel);font-weight:700}"
      + ".eam-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:2px 0 16px}"
      + ".eam-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px}"
      + ".eam-lc{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:18px;align-items:center}"
      + "@media (max-width:900px){.eam-lc{grid-template-columns:minmax(0,1fr)}}"
      + ".eam-name{font-size:16px;font-weight:700;color:var(--ink)}"
      + ".eam-meta{font-size:12.5px;color:var(--muted);margin-top:3px}"
      + ".eam-pill{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;white-space:nowrap;"
      + "background:var(--panel-2);color:var(--muted);vertical-align:2px;margin-left:6px}"
      + ".eam-ok{background:rgba(22,163,74,.12);color:#166534}.eam-warn{background:rgba(217,119,6,.14);color:#92400e}"
      + ".eam-bad{background:rgba(220,38,38,.12);color:#991b1b}.eam-info{background:rgba(37,99,235,.11);color:#1e40af}"
      + ".eam-act{text-align:right}.eam-act .big{font-size:28px;font-weight:800;line-height:1.05;color:var(--ink)}"
      + ".eam-act .lab{font-size:12.5px;color:var(--muted);margin:2px 0 8px}"
      + "@media (max-width:900px){.eam-act{text-align:left}}"
      + ".eam-stats{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;font-size:13px;color:var(--muted)}"
      + ".eam-stats b{color:var(--ink);font-size:15px;margin-right:4px}"
      + ".eam-checks{margin-top:8px;display:flex;flex-direction:column;gap:3px}"
      + ".eam-ck{font-size:12.5px;display:flex;gap:6px;align-items:baseline}"
      + ".eam-ck.bad{color:#991b1b}.eam-ck.warn{color:#92400e}.eam-ck.ok{color:#166534}.eam-ck.info{color:#1e40af}"
      + ".eam-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 16px;background:var(--panel);border:1px solid var(--line);"
      + "border-radius:14px;margin-bottom:12px}"
      + ".eam-head .t{font-size:19px;font-weight:800;color:var(--ink)}"
      + ".eam-head .sp{flex:1}.eam-save{font-size:12.5px;color:var(--muted);white-space:nowrap}"
      + ".eam-save.err{color:var(--neg);font-weight:600}"
      + ".eam-wrap{display:grid;grid-template-columns:250px minmax(0,1fr);gap:14px;align-items:start}"
      + "@media (max-width:1000px){.eam-wrap{grid-template-columns:minmax(0,1fr)}}"
      + ".eam-rail{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:8px;position:sticky;top:12px}"
      + ".eam-rh{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin:10px 8px 4px}"
      + ".eam-ri{display:block;width:100%;text-align:left;border:0;background:transparent;border-radius:10px;padding:8px 10px;cursor:pointer;"
      + "font:inherit;color:var(--ink);margin-bottom:2px;min-height:44px}"
      + ".eam-ri:hover{background:var(--panel-2)}.eam-ri.on{background:rgba(127,163,43,.16);box-shadow:inset 3px 0 0 var(--brand)}"
      + ".eam-ri .r1{display:flex;justify-content:space-between;align-items:center;gap:6px;font-size:13.5px;font-weight:700}"
      + ".eam-ri .r2{display:block;font-size:12px;color:var(--muted);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".eam-ri.dim .r1{color:var(--muted);font-weight:600}"
      + ".eam-mk{font-size:11.5px;font-weight:700;padding:1px 7px;border-radius:99px;white-space:nowrap}"
      + ".eam-mk.done{background:rgba(22,163,74,.12);color:#166534}.eam-mk.fix{background:rgba(220,38,38,.12);color:#991b1b}"
      + ".eam-mk.todo{background:var(--panel-2);color:var(--muted)}"
      + ".eam-main{min-width:0}"
      // the Email step (12 Nov): the editor takes the full width, the steps sit in a row above it
      + ".eam-wrap.wide{grid-template-columns:minmax(0,1fr)}"
      + ".eam-wrap.wide .eam-rail{position:static;display:flex;flex-wrap:wrap;gap:4px;align-items:center;padding:6px}"
      + ".eam-wrap.wide .eam-ri{width:auto;min-height:40px;margin:0;padding:6px 12px}.eam-wrap.wide .eam-ri .r2{display:none}"
      + ".eam-wrap.wide .eam-ri .r1{gap:8px}.eam-wrap.wide .eam-rh{margin:0 2px 0 10px}"
      + ".eam-2{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px;align-items:start}"
      + "@media (max-width:1100px){.eam-2{grid-template-columns:minmax(0,1fr)}}"
      + ".eam-h{font-size:14px;font-weight:700;color:var(--ink);margin:0 0 4px}"
      + ".eam-ed label.l{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:14px 0 6px}"
      + ".eam-ed input:not([type=checkbox]):not([type=radio]),.eam-ed select{width:100%;box-sizing:border-box;font:inherit;font-size:14px;"
      + "padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:38px}"
      + ".eam-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}"
      + ".eam-opt{text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:11px 12px;cursor:pointer;"
      + "font:inherit;color:var(--ink);min-height:60px}"
      + ".eam-opt:hover{border-color:var(--muted)}.eam-opt.on{border-color:var(--brand);box-shadow:inset 0 0 0 1px var(--brand)}"
      + ".eam-opt b{display:block;font-size:13.5px}.eam-opt span{display:block;font-size:12.5px;color:var(--muted);margin-top:2px;line-height:1.4}"
      + ".eam-chips{display:flex;gap:6px;flex-wrap:wrap;align-items:center}"
      + ".eam-chip{border:1px solid var(--line);border-radius:99px;background:var(--panel);padding:6px 13px;font:inherit;font-size:13px;"
      + "cursor:pointer;color:var(--ink);min-height:34px}"
      + ".eam-chip.on{background:var(--ink);color:var(--panel);border-color:var(--ink);font-weight:700}"
      + ".eam-chips input{width:80px!important;min-height:34px!important}"
      + ".eam-sum{background:var(--panel-2);border:1px solid var(--line);border-radius:14px;padding:14px 16px}"
      + ".eam-sum dl{display:grid;grid-template-columns:96px minmax(0,1fr);gap:8px 10px;margin:8px 0 0;font-size:13px}"
      + ".eam-sum dt{color:var(--muted);font-weight:700}.eam-sum dd{margin:0;color:var(--ink)}"
      + ".eam-big{font-size:34px;font-weight:800;color:var(--ink);line-height:1.05}"
      + ".eam-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:8px;margin-bottom:12px}"
      + ".eam-k div{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px}"
      + ".eam-k b{display:block;font-size:20px;font-weight:800}.eam-k span{font-size:12.5px;color:var(--muted)}"
      + ".eam-fn{display:grid;grid-template-columns:110px minmax(0,1fr) 110px;gap:10px;align-items:center;margin:9px 0;font-size:13px}"
      + ".eam-fn b{text-align:right}.eam-fn small{font-weight:500;color:var(--muted);margin-left:4px}"
      + ".eam-bar{display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--panel-2)}.eam-bar i{display:block;height:100%;background:var(--brand)}"
      + ".eam-cl{display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--line);font-size:13.5px}"
      + ".eam-cl:last-of-type{border-bottom:0}.eam-cl .tx{flex:1;min-width:0}"
      + ".eam-sub{display:block;font-size:12.5px;color:var(--muted);margin-top:2px}"
      + ".eam tr.eam-dim td{opacity:.6}"
      + ".eam-sw{appearance:none;width:36px;height:22px;border-radius:99px;background:var(--line);position:relative;cursor:pointer;vertical-align:middle}"
      + ".eam-sw:checked{background:var(--brand)}"
      + ".eam-sw::after{content:'';position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .15s}"
      + ".eam-sw:checked::after{left:17px}.eam-sw:disabled{opacity:.35;cursor:not-allowed}"
      + ".eam-link{color:var(--brand-d,var(--brand));cursor:pointer;font-weight:600;text-decoration:underline;background:none;border:0;font:inherit;padding:0}"
      + ".eam-empty{text-align:center;padding:42px 20px}.eam-empty b{display:block;font-size:16px;margin-bottom:6px}"
      + ".eam-msg{font-size:13px;margin:0 0 10px}.eam-msg.err{color:var(--neg)}.eam-msg.ok{color:var(--pos)}"
      // the queue's tabs and the Undo note (11 Nov, ZTZ-69)
      + ".eam-qtabs{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 10px}"
      + ".eam-qtab{font:inherit;font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:10px;border:1px solid var(--line);"
      + "background:var(--panel);color:var(--ink);cursor:pointer;min-height:40px}"
      + ".eam-qtab .n{display:inline-block;min-width:20px;font-size:12px;font-weight:700;padding:1px 7px;border-radius:99px;"
      + "background:var(--panel-2);color:var(--muted);margin-left:4px;text-align:center}"
      + ".eam-qtab.on{background:var(--ink);color:var(--panel);border-color:var(--ink)}.eam-qtab.on .n{background:rgba(255,255,255,.18);color:inherit}"
      + ".eam-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;"
      + "background:#0f172a;color:#fff;border-radius:12px;padding:9px 10px 9px 16px;box-shadow:0 10px 30px rgba(15,23,42,.35);font-size:14px;max-width:calc(100vw - 32px)}"
      + ".eam-toast .u{font:inherit;font-size:13.5px;font-weight:700;border:0;border-radius:8px;background:#b7e23b;color:#14200a;padding:7px 14px;cursor:pointer}"
      + ".eam-toast .x{font:inherit;font-size:15px;border:0;background:none;color:#fff;padding:6px 8px;cursor:pointer}"
      // keyboard focus is always visible (the portal resets outlines)
      + ".eam button:focus-visible,.eam input:focus-visible,.eam select:focus-visible{outline:2px solid var(--brand-d,#5f7c20);outline-offset:2px}"
      // the dark theme (body.rs-app without .light): the status colours above are too dark there (2.2:1)
      + "body.rs-app:not(.light) .eam-ok,body.rs-app:not(.light) .eam-mk.done,body.rs-app:not(.light) .eam-ck.ok{color:#86efac}"
      + "body.rs-app:not(.light) .eam-warn,body.rs-app:not(.light) .eam-ck.warn{color:#fcd34d}"
      + "body.rs-app:not(.light) .eam-bad,body.rs-app:not(.light) .eam-mk.fix,body.rs-app:not(.light) .eam-ck.bad{color:#fca5a5}"
      + "body.rs-app:not(.light) .eam-info,body.rs-app:not(.light) .eam-ck.info{color:#93c5fd}";
    document.head.appendChild(st);
  }

  const MAX_PER_SEND = 300;
  const CAT = { survey: ["Survey", "Feedback questions after a move. Unsubscribing stops survey emails only."],
                reviews: ["Review request", "Asks for a review. Unsubscribing stops review requests only."],
                news: ["News and offers", "Updates and offers. Unsubscribing stops news and offers only."] };
  const STATE = { clicked: ["Clicked", "eam-ok"], opened: ["Opened", "eam-info"], delivered: ["Delivered", ""],
                  sent: ["Sent", ""], sending: ["Sending…", ""], failed: ["Failed", "eam-bad"],
                  bounced: ["Bounced", "eam-bad"], complained: ["Marked as spam", "eam-bad"], unsubscribed: ["Unsubscribed", "eam-warn"] };
  const STEPS = { auto: [["s1", "Name"], ["s2", "Email"], ["s3", "Audience"], ["s4", "When"], ["s5", "Test"], ["s6", "Launch"]],
                  single: [["s1", "Name"], ["s2", "Email"], ["s3", "Audience"], ["s4", "Test"], ["s5", "Send"]] };
  const AFTER = [[0, "Same day"], [1, "1 day"], [3, "3 days"], [7, "1 week"], [14, "2 weeks"]];
  const KEEP = [[7, "1 week"], [14, "2 weeks"], [30, "1 month"], [60, "2 months"]];
  const GAP = [[0, "No gap"], [3, "3 days"], [7, "1 week"], [14, "2 weeks"]];

  registerPage({
    id: "email-automations",
    group: "marketing-automations",
    title: "Email Automations",
    subtitle: "Every customer email in one place: automations with their results, and one-off single sends.",
    datasets: [],

    render(host) {
      const esc = (window.RSC && RSC.esc) || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
      const mine = host;
      // `host` is the portal's SHARED content box: a late answer must not paint this page over the next
      const myRender = (window.__EAM_RENDER = (window.__EAM_RENDER || 0) + 1);
      const alive = () => document.body.contains(mine) && window.__EAM_RENDER === myRender
        && /(^|[#&])page=email-automations(&|$)/.test(location.hash);
      const S = window.__EAM3 || (window.__EAM3 = {
        view: "list", tab: "autos", days: 90, list: null, listErr: "", waiting: {},
        what: "auto", id: null, part: "s1", item: null, itemErr: "", draft: null,
        save: "saved", savedAt: null, saveErr: "", count: null, countErr: "", queue: null, qErr: "", sends: null, sErr: "",
        tests: null, msg: "", msgErr: false, busy: false, testTo: "", schedAt: "",
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
      const clock = d => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      const clone = o => JSON.parse(JSON.stringify(o || {}));
      const pill = (t, c) => '<span class="eam-pill ' + (c || "") + '">' + esc(t) + "</span>";
      const hourLab = h => { h = +h; if (isNaN(h)) return "—"; return ((h % 12) || 12) + (h < 12 ? " AM" : " PM") + " NJ"; };
      const kit = () => (S.list && S.list.kit) || {};
      const statusPill = (st, mode) => st === "live" ? pill(mode === "auto" ? "Live · sends by itself" : "Live · asks first", "eam-ok")
        : st === "paused" ? pill("Paused", "eam-warn") : st === "archived" ? pill("Archived") : st === "scheduled" ? pill("Scheduled", "eam-info")
        : st === "sending" ? pill("Sending…", "eam-info") : st === "sent" ? pill("Sent", "eam-ok") : pill("Draft");
      const msgLine = () => (S.msg ? '<p class="eam-msg ' + (S.msgErr ? "err" : "ok") + '" role="status">' + esc(S.msg) + "</p>" : "");
      const ckLine = c => '<div class="eam-ck ' + c.lvl + '"><span aria-hidden="true">' + ({ ok: "✓", bad: "!", warn: "!", info: "•" }[c.lvl] || "•") + "</span>" + esc(c.text) + "</div>";
      const sender = s => (s || "hello") + "@mail.ziptozip.app";

      // ---- loading -------------------------------------------------------------------------------
      function loadList() {
        S.list = null; S.listErr = ""; paint();
        api("/api/_emailadmin?view=list&days=" + S.days).then(j => {
          S.list = j; paint();
          (j.automations || []).filter(a => a.status === "live" || a.status === "paused").forEach(a => {
            api("/api/_emailadmin?view=waiting&id=" + a.id).then(w => { S.waiting[a.id] = w; if (S.view === "list") paint(); })
              .catch(() => { S.waiting[a.id] = { err: 1 }; if (S.view === "list") paint(); });
          });
        }).catch(e => { S.listErr = e.message || String(e); paint(); });
      }
      function ensureKit() { return S.list ? Promise.resolve() : api("/api/_emailadmin?view=list&days=" + S.days).then(j => { S.list = j; }); }
      function loadItem(quiet) {
        if (!S.id) return Promise.resolve();
        if (!quiet) { S.item = null; S.itemErr = ""; paint(); }
        return api("/api/_emailadmin?view=" + (S.what === "auto" ? "auto" : "single") + "&id=" + S.id + "&days=" + S.days).then(j => {
          S.item = j.item;
          if (!quiet || !S.draft) { S.draft = draftOf(j.item); S.loadedJson = JSON.stringify(S.draft.template); }
          // a live (or paused) automation: its live email, which the editor counts changes against
          S.liveTpl = S.what === "auto" && (j.item.status === "live" || j.item.status === "paused") && j.item.template ? clone(j.item.template) : null;
          if (quiet) { paintRail(); paintHead(); } else paint();
        }).catch(e => { if (e.page) { location.hash = "#page=" + e.page; return; } S.itemErr = e.message || String(e); paint(); });
      }
      function draftOf(it) {
        it = it || {};
        const designs = kit().designs || {};
        const saved = it.template_draft && it.template_draft.blocks ? it.template_draft : it.template;
        const tpl = saved && saved.blocks ? saved : clone((designs.banner || designs.letter || {}).template || { subject: "", blocks: [] });
        const aud = it.audience && it.audience.source ? it.audience : { source: "moves", scores: [9, 10], states: [], distance: "local", claims: "none", review: "any", support: "any", date_from: "", date_to: "" };
        const sch = it.schedule && "days_after" in it.schedule ? it.schedule : { days_after: 14, look_back: 46, run_hour: 10, daily_cap: 200, gap_days: 7 };
        return { name: it.name || "", purpose: it.purpose || "", owner: it.owner || "", category: it.category || (S.what === "single" ? "news" : "reviews"),
                 sender: it.sender || (S.what === "single" ? "hello" : "reviews"), mode: it.mode || "ask", template: clone(tpl), audience: clone(aud), schedule: clone(sch) };
      }

      // ---- saving: by itself, with the state in the header --------------------------------------
      let saveT = null, saving = null;
      function dirty() {
        S.save = "dirty"; paintSave();
        clearTimeout(saveT);
        saveT = setTimeout(() => { save().catch(() => {}); }, 1200);
      }
      function save() {
        clearTimeout(saveT);
        if (!S.draft) return Promise.resolve();
        if (!S.id && !S.draft.name.trim()) { S.save = "noname"; paintSave(); return Promise.resolve(); }
        if (!S.id && S.save !== "create") return Promise.resolve();      // a new one is created by its Create button
        if (saving) return saving.then(() => (S.save === "dirty" ? save() : null));
        S.save = "saving"; paintSave();
        const step = Math.max(+String(S.part).replace(/\D/g, "") || 1, (S.item && S.item.step) || 1);
        saving = post({ action: "save", what: S.what, id: S.id, data: Object.assign({}, S.draft, { step }) }).then(j => {
          S.id = j.id; S.save = "saved"; S.savedAt = new Date(); S.saveErr = ""; saving = null;
          return loadItem(true).then(() => paintSave());
        }).catch(e => { saving = null; S.save = "error"; S.saveErr = e.message || String(e); paintSave(); throw e; });
        return saving;
      }

      // ---- navigation ----------------------------------------------------------------------------
      function toList(tab) { save().catch(() => {}); S.view = "list"; if (tab) S.tab = tab; S.item = null; S.draft = null; S.id = null; say(""); loadList(); }
      function openItem(what, it, part) {
        if (what === "auto" && it && it.kind === "survey") { location.hash = "#page=surveys"; return; }
        S.view = "item"; S.what = what; S.id = it ? it.id : null; S.item = it || null; S.draft = null;
        S.queue = null; S.sends = null; S.tests = null; S.count = null; S.save = "saved"; S.savedAt = null; say("");
        S.liveTpl = null; S.emdUi = { testTo: S.testTo || ZTZ.email() || "" }; S.testedJson = null;
        if (!it) { S.part = "s1"; ensureKit().then(() => { S.draft = draftOf(null); paint(); }); return; }
        const live = it.status && it.status !== "draft";
        S.part = part || (live ? "over" : ("s" + Math.min(it.step || 1, STEPS[what].length)));
        ensureKit().then(() => loadItem()).then(() => onPart());
      }
      function go(part) {
        if (part === S.part) return;
        const leave = S.save === "dirty" || S.save === "saving" ? save() : Promise.resolve();
        leave.catch(() => {}).then(() => { S.part = part; say(""); paint(); onPart(); });
      }
      function onPart() {
        if (S.part === "queue" && S.id) loadQueue();
        if (S.part === "sends" && S.id) loadSends();
        if (S.part === "s3" || S.part === "s6" || (S.what === "single" && S.part === "s5")) count();
        if (isTestPart() && S.id) loadTests();
      }
      const isTestPart = () => (S.what === "auto" && S.part === "s5") || (S.what === "single" && S.part === "s4");
      function loadQueue() { S.queue = null; S.qErr = ""; paintMain();
        api("/api/_emailadmin?view=queue&id=" + S.id).then(j => { S.queue = j; paintMain(); paintRail(); }).catch(e => { S.qErr = e.message; paintMain(); }); }
      function loadSends() { S.sends = null; S.sErr = ""; paintMain();
        api("/api/_emailadmin?view=sends&" + (S.what === "single" ? "single=" : "id=") + S.id + "&days=3650").then(j => { S.sends = j.sends; paintMain(); }).catch(e => { S.sErr = e.message; paintMain(); }); }
      function loadTests() {
        api("/api/_emailadmin?view=sends&" + (S.what === "single" ? "single=" : "id=") + S.id + "&days=3650&tests=1").then(j => {
          S.tests = (j.sends || []).filter(s => +s.is_test === 1).slice(0, 6); if (isTestPart()) paintMain(); }).catch(() => {});
      }
      let cnT = null;
      function count() {
        clearTimeout(cnT);
        cnT = setTimeout(() => {
          if (!S.draft) return;
          S.countErr = "";
          post({ action: "count", what: S.what, id: S.id, audience: S.draft.audience, schedule: S.draft.schedule, category: S.draft.category })
            .then(j => { S.count = j; const c = host.querySelector("#eamCount"); if (c) c.innerHTML = countHtml(); paintRail(); })
            .catch(e => { S.countErr = e.message; const c = host.querySelector("#eamCount"); if (c) c.innerHTML = countHtml(); });
        }, 450);
      }

      // ---- summaries (rail + the "how it works" card) --------------------------------------------
      function emailProblems() {
        const t = (S.draft && S.draft.template) || {};
        const p = [];
        if (!t.subject) p.push("The email has no subject yet");
        if (t.mode === "html") {
          if (!String(t.html || "").trim()) p.push("Paste the email's HTML");
          if (new Blob([t.html || ""]).size > 100000) p.push("The pasted email is too big for Gmail (over 100 KB)");
          if (/href\s*=\s*["']\{survey_link\}["']/i.test(t.html || "")) p.push("A link opens the survey (only the Customer Survey can send that)");
          return p;
        }
        (t.blocks || []).forEach(b => {
          if (b.t === "button" && !b.url) p.push('The button "' + (b.label || "") + '" has no link');
          if (b.t === "button" && b.url && b.url === kit().survey_link) p.push("A button opens the survey (only the Customer Survey can send that)");
          if (b.t === "banner" && b.mode === "image" && !b.image) p.push("The banner picture is missing");
          if (b.t === "image" && !b.url) p.push("A picture block is empty");
        });
        return p;
      }
      function whenText(s, src) {
        s = s || {}; src = src === "promised" ? "the promise" : "the move";
        const a = +s.days_after || 0, end = a + (+s.look_back || 0);
        return (a ? a + (a === 1 ? " day" : " days") + " after " + src : "The day of " + src) + ", until day " + end;
      }
      function whoText(a) {
        a = a || {};
        if (S.what === "single") return "Customers who moved " + (a.date_from || "in the last 90 days") + (a.date_from ? " to " + (a.date_to || "today") : "");
        if (a.source === "promised") return "Customers who promised their foreman a review" + (a.review === "no" ? ", no review yet" : "");
        const sc = a.scores || [];
        return "Customers after their move" + (sc.length ? ", foreman score " + (sc.length > 1 ? Math.min(...sc) + "–" + Math.max(...sc) : sc[0]) : "")
          + (a.distance === "local" ? ", local" : a.distance === "ld" ? ", long distance" : "") + (a.claims === "none" ? ", no claim" : "");
      }
      function railItems() {
        const d = S.draft || {}, it = S.item || {}, steps = STEPS[S.what];
        const probs = emailProblems();
        const blockers = it.blockers || [];
        const ready = S.count ? S.count.ready : (S.queue ? S.queue.waiting : null);
        const out = { results: [], setup: [] };
        if (S.what === "auto") {
          const live = it.status && it.status !== "draft";
          out.results.push(["over", "Overview", live ? (it.stats && it.stats.sent ? num(it.stats.sent) + " sent" : "nothing sent yet") : "after launch", live ? "" : "dim"]);
          out.results.push(["queue", live ? (d.mode === "auto" ? "Next run" : "Queue") : "Who would get it", ready != null ? ready + " can get it now" : "who gets it next", ""]);
          out.results.push(["sends", "Sends", "every email and its status", live ? "" : "dim"]);
        } else {
          const sent = it.status === "sent" || it.status === "sending";
          out.results.push(["over", "Overview", sent ? num((it.stats || {}).sent) + " sent" : "after it goes out", sent ? "" : "dim"]);
          out.results.push(["sends", "Sends", "every email and its status", sent ? "" : "dim"]);
        }
        steps.forEach(([k, nm], i) => {
          let sum = "", mk = "todo";
          if (nm === "Name") { sum = d.name ? d.name + " · " + (CAT[d.category] || [""])[0] : "Not named yet"; mk = d.name ? "done" : "todo"; }
          if (nm === "Email") { sum = probs.length ? probs[0] : (d.template && d.template.subject) || ""; mk = probs.length ? "fix" : "done"; }
          if (nm === "Audience") { sum = ready != null ? ready + " can get it now" : whoText(d.audience); mk = "done"; }
          if (nm === "When") { sum = whenText(d.schedule, (d.audience || {}).source) + " · " + (d.mode === "auto" ? "by itself" : "asks first"); mk = "done"; }
          if (nm === "Test") { sum = it.tested ? "Sent " + dt(it.tested_at) : "Not sent yet"; mk = it.tested ? "done" : "todo"; }
          if (nm === "Launch") { sum = it.status === "live" ? "Live since " + d10(it.launched_at) : blockers.length ? blockers.length + " thing" + (blockers.length === 1 ? "" : "s") + " to do" : "Ready to launch";
                                 mk = it.status === "live" ? "done" : blockers.length ? "fix" : "todo"; }
          if (nm === "Send") { sum = it.status === "sent" ? "Sent " + dt(it.sent_at) : it.status === "scheduled" ? "Goes " + dt(it.send_at) : "Now or at a set time"; mk = it.status === "sent" ? "done" : "todo"; }
          out.setup.push([k, (i + 1) + " " + nm, sum, !S.id && i ? "dim" : "", mk]);
        });
        return out;
      }
      const MK = { done: ["Done", "done"], fix: ["Fix", "fix"], todo: ["To do", "todo"] };
      function railHtml() {
        const r = railItems();
        const btn = ([k, t, sub, cls, mk]) => '<button type="button" class="eam-ri ' + (S.part === k ? "on " : "") + (cls || "") + '" data-part="' + k + '"'
          + (S.part === k ? ' aria-current="step"' : "") + '><span class="r1"><span>' + esc(t) + "</span>"
          + (mk ? '<span class="eam-mk ' + MK[mk][1] + '">' + MK[mk][0] + "</span>" : "") + '</span><span class="r2">' + esc(sub) + "</span></button>";
        return '<div class="eam-rh">Results</div>' + r.results.map(btn).join("") + '<div class="eam-rh">Setup</div>' + r.setup.map(btn).join("");
      }
      function summaryCard() {
        const d = S.draft || {}, it = S.item || {};
        const cats = (S.list && S.list.categories) || {};
        const rows = [["Who", whoText(d.audience) + (S.count ? " (" + S.count.ready + " can get it now)" : "")]];
        if (S.what === "auto") {
          rows.push(["When", whenText(d.schedule, (d.audience || {}).source)]);
          rows.push(["How", d.mode === "auto" ? "Sends by itself every day at " + hourLab(d.schedule.run_hour) + ", at most " + d.schedule.daily_cap + " a day"
            : "Asks first: the queue fills by itself and someone presses Send"]);
        }
        rows.push(["From", sender(d.sender)]);
        rows.push(["Unsubscribe", "Stops " + (cats[d.category] || "these emails") + " only"]);
        if (it.status) rows.push(["Status", it.status[0].toUpperCase() + it.status.slice(1)]);
        return '<div class="eam-sum"><p class="eam-h">How it works</p><dl>' + rows.map(r => "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>").join("") + "</dl></div>";
      }

      // ---- the LIST ------------------------------------------------------------------------------
      function goalOf(a) { return a.kind === "survey" ? "answered" : a.category === "reviews" ? "reviewed" : ""; }
      function statsRow(st, goal, opensOn) {
        st = st || {};
        if (!st.sent) return '<div class="eam-stats"><span>Nothing sent yet</span></div>';
        const del = st.delivered || 0;
        return '<div class="eam-stats">'
          + "<span><b>" + num(st.sent) + "</b>sent</span><span><b>" + pct(del, st.sent) + "</b>delivered</span>"
          + (opensOn ? "<span><b>" + pct(st.opened || 0, del || st.sent) + "</b>opened</span>" : "")
          + "<span><b>" + pct(st.clicked || 0, del || st.sent) + "</b>clicked</span>"
          + (goal ? "<span><b>" + pct(st.goal || 0, st.sent) + "</b>" + goal + "</span>" : "")
          + "<span><b>" + pct(st.bounced || 0, st.sent) + "</b>bounced</span>"
          + "<span><b>" + num(st.unsub || 0) + "</b>unsubscribed</span></div>";
      }
      function actionArea(a) {
        const w = S.waiting[a.id];
        if (a.status === "draft") return '<div class="big">' + (a.step || 1) + ' <span style="font-size:16px;color:var(--muted)">of 6</span></div><div class="lab">steps set up</div>'
          + '<button class="rs-btn pri" data-open="' + a.id + '">Continue setup</button>';
        if (a.status === "paused") return '<div class="lab">Paused: nothing goes out</div><button class="rs-btn" data-open="' + a.id + '">Open</button>';
        const n = !w ? "…" : w.err ? "—" : num(w.waiting);
        if (a.mode === "auto" && a.kind !== "survey") return '<div class="big">' + n + '</div><div class="lab">go out at ' + esc(hourLab((a.schedule || {}).run_hour)) + "</div>"
          + '<button class="rs-btn" data-open="' + a.id + '">Open</button>';
        return '<div class="big">' + n + '</div><div class="lab">waiting for your OK</div>'
          + '<button class="rs-btn pri" data-review="' + a.id + '">Review and send</button>'
          + (a.kind !== "survey" ? '<div style="margin-top:6px"><button class="eam-link" data-open="' + a.id + '">Open</button></div>' : "");
      }
      function listView() {
        let h = '<div class="eam-top"><div class="eam-seg" role="tablist">'
          + '<button type="button" role="tab" aria-selected="' + (S.tab === "autos") + '" class="' + (S.tab === "autos" ? "on" : "") + '" data-tab="autos">Automations</button>'
          + '<button type="button" role="tab" aria-selected="' + (S.tab === "single") + '" class="' + (S.tab === "single" ? "on" : "") + '" data-tab="single">Single sends</button></div>'
          + '<span style="flex:1"></span><label class="eam-help" for="eamDays" style="margin:0">Numbers for</label>'
          + '<select class="rs-inp" id="eamDays" style="width:auto">' + [[30, "the last 30 days"], [90, "the last 90 days"], [365, "the last 12 months"], [3650, "all time"]]
            .map(o => '<option value="' + o[0] + '"' + (S.days === o[0] ? " selected" : "") + ">" + o[1] + "</option>").join("") + "</select>"
          + '<button class="rs-btn pri" id="eamNew">' + (S.tab === "autos" ? "New automation" : "New single send") + "</button></div>";
        if (S.listErr) return h + '<div class="panel">Could not load: ' + esc(S.listErr) + ' <button class="rs-btn" data-retry="1" style="margin-left:10px">Try again</button></div>';
        if (!S.list) return h + '<div class="panel">Loading…</div>';
        const L = S.list, opensOn = L.tracking === "on";
        h += msgLine();
        if (L.tracking === "off") h += '<p class="eam-help" style="margin:-6px 0 12px">Opens show once open tracking is switched on in Resend (tracker ZTZ-52); delivered and clicked are tracked now.</p>';
        if (S.tab === "autos") {
          const as = L.automations || [];
          if (!as.length) return h + '<div class="eam-card eam-empty"><b>Build your first automation</b><span class="eam-help">An automation emails customers at the right moment after their move.</span></div>';
          return h + as.map(a => {
            const issues = (a.checks || []).filter(c => c.lvl === "bad" || c.lvl === "warn");
            return '<div class="eam-card"><div class="eam-lc"><div><span class="eam-name">' + esc(a.name) + "</span>" + statusPill(a.status, a.mode)
              + (a.has_draft ? pill("Email changes not live yet", "eam-warn") : "")
              + '<div class="eam-meta">' + esc((CAT[a.category] || [""])[0]) + " · " + esc(sender(a.sender)) + (a.owner ? " · " + esc(a.owner) : "") + "</div>"
              + '<div class="eam-meta">' + esc(a.summary || "") + "</div>"
              + (a.status !== "draft" ? statsRow(a.stats, goalOf(a), opensOn) : "")
              + (issues.length ? '<div class="eam-checks">' + issues.slice(0, 3).map(ckLine).join("") + (issues.length > 3 ? '<div class="eam-ck info">+' + (issues.length - 3) + " more on its page</div>" : "") + "</div>" : "")
              + '</div><div class="eam-act">' + actionArea(a) + (a.kind === "survey" ? '<div style="margin-top:6px"><button class="eam-link" data-svyemail="1">Edit the email</button></div>' : "")
              + "</div></div></div>";
          }).join("");
        }
        const ss = L.singles || [];
        if (!ss.length) return h + '<div class="eam-card eam-empty"><b>Send your first one-off email</b><span class="eam-help">A single send goes once to customers who moved with us: news, offers, a schedule change.</span></div>';
        return h + ss.map(s1 => '<div class="eam-card"><div class="eam-lc"><div><span class="eam-name">' + esc(s1.name) + "</span>" + statusPill(s1.status)
          + '<div class="eam-meta">' + esc(sender(s1.sender)) + " · " + esc(s1.summary || "") + "</div>"
          + (s1.status === "sent" || s1.status === "sending" ? statsRow(s1.stats, "", opensOn) : "") + '</div><div class="eam-act">'
          + (s1.status === "draft" ? '<div class="lab">Draft</div><button class="rs-btn pri" data-sopen="' + s1.id + '">Continue</button>'
            : s1.status === "scheduled" ? '<div class="lab">Goes out ' + esc(dt(s1.send_at)) + '</div><button class="rs-btn" data-sopen="' + s1.id + '">Open</button>'
            : '<div class="lab">Sent ' + esc(dt(s1.sent_at)) + '</div><button class="rs-btn" data-sopen="' + s1.id + '">Results</button>') + "</div></div></div>").join("");
      }

      // ---- the ITEM page: header, rail, main -----------------------------------------------------
      function saveHtml() {
        if (S.save === "saving") return "Saving…";
        if (S.save === "dirty") return S.id ? "Unsaved changes" : "";
        if (S.save === "noname") return "Give it a name to save";
        if (S.save === "error") return "Not saved: " + S.saveErr;
        if (emailWaiting()) return "Email changes saved, not live yet";
        return S.savedAt ? "Saved " + clock(S.savedAt) : (S.id ? "All changes saved" : "");
      }
      const emailWaiting = () => !!(S.liveTpl && S.draft && JSON.stringify(S.draft.template) !== JSON.stringify(S.liveTpl));
      function headHtml() {
        const it = S.item || {}, d = S.draft || {};
        const live = it.status === "live", draft = !it.status || it.status === "draft";
        let acts = "";
        if (S.what === "auto") {
          if (S.id && draft) acts += '<button class="rs-btn" data-part2="s5">Send a test</button><button class="rs-btn pri" data-part2="s6">Launch…</button>';
          if (live) acts += (d.mode === "auto" ? '<button class="rs-btn" id="eamRun"' + (S.busy ? " disabled" : "") + ">Run now</button>" : "") + '<button class="rs-btn" data-status="paused">Pause</button>';
          if (it.status === "paused") acts += '<button class="rs-btn pri" data-status="live">Resume</button>';
          if (S.id && it.status && it.status !== "archived") acts += '<button class="rs-btn" data-status="archived">Archive</button>';
        } else if (S.id && (draft || it.status === "scheduled")) {
          acts += '<button class="rs-btn" data-part2="s4">Send a test</button><button class="rs-btn pri" data-part2="s5">Send…</button>';
        }
        return '<span class="t">' + esc(d.name || (S.what === "auto" ? "New automation" : "New single send")) + "</span>" + (S.id ? statusPill(it.status, d.mode) : pill("New"))
          + '<span class="eam-meta" style="margin:0">' + esc((CAT[d.category] || [""])[0]) + " · " + esc(sender(d.sender)) + "</span>"
          + '<span class="sp"></span><span class="eam-save' + (S.save === "error" ? " err" : "") + '" id="eamSave" role="status">' + esc(saveHtml()) + "</span>" + acts;
      }
      function itemView() {
        const back = '<button class="eam-link" data-back="1" style="margin-bottom:8px">&larr; ' + (S.what === "auto" ? "All automations" : "All single sends") + "</button>";
        if (S.itemErr) return back + '<div class="panel">Could not load: ' + esc(S.itemErr) + "</div>";
        if (!S.draft) return back + '<div class="panel">Loading…</div>';
        const wide = (STEPS[S.what].find(x => x[0] === S.part) || [])[1] === "Email";
        return back + '<div class="eam-head" id="eamHead">' + headHtml() + '</div><div class="eam-wrap' + (wide ? " wide" : "") + '"><nav class="eam-rail" id="eamRail" aria-label="Parts of this '
          + (S.what === "auto" ? "automation" : "email") + '">' + railHtml() + '</nav><div class="eam-main" id="eamMain">' + mainHtml() + "</div></div>";
      }
      function mainHtml() {
        const p = S.part, name = (STEPS[S.what].find(x => x[0] === p) || [])[1];
        if (p === "over") return overHtml();
        if (p === "queue") return queueHtml();
        if (p === "sends") return sendsHtml();
        if (name === "Name") return nameHtml();
        if (name === "Email") return msgLine() + '<div id="eamDesigner"></div>' + navHtml();
        if (name === "Audience") return audienceHtml();
        if (name === "When") return whenHtml();
        if (name === "Test") return testHtml();
        if (name === "Launch") return launchHtml();
        if (name === "Send") return sendHtml();
        return "";
      }
      function navHtml() {
        const steps = STEPS[S.what], i = steps.findIndex(x => x[0] === S.part);
        if (i < 0) return "";
        return '<div class="rs-bar" style="margin-top:14px">' + (i > 0 ? '<button class="rs-btn" data-part2="' + steps[i - 1][0] + '">Back</button>' : "")
          + '<span class="rs-spacer" style="flex:1"></span>'
          + (i < steps.length - 1 ? '<button class="rs-btn pri" data-part2="' + steps[i + 1][0] + '">Next: ' + esc(steps[i + 1][1]) + "</button>" : "") + "</div>";
      }

      // overview / queue / sends
      function overHtml() {
        const it = S.item || {}, st = it.stats || {}, opensOn = S.list && S.list.tracking === "on";
        const live = S.what === "auto" ? it.status && it.status !== "draft" : it.status === "sent" || it.status === "sending";
        if (!live) return '<div class="eam-card eam-empty"><b>Nothing sent yet</b><span class="eam-help">Results show here once emails go out.</span>'
          + '<div style="margin-top:12px"><button class="rs-btn pri" data-part2="' + (S.what === "auto" ? "s6" : "s5") + '">Finish setup</button></div></div>';
        const goal = S.what === "auto" ? goalOf(it) : "";
        const sent = st.sent || 0;
        const rows = [["Sent", sent], ["Delivered", st.delivered || 0]].concat(opensOn ? [["Opened", st.opened || 0]] : []).concat([["Clicked", st.clicked || 0]])
          .concat(goal ? [[goal[0].toUpperCase() + goal.slice(1), st.goal || 0]] : []);
        let h = msgLine() + '<div class="eam-k">' + rows.map(r => "<div><b>" + (r[0] === "Sent" ? num(r[1]) : pct(r[1], sent)) + "</b><span>" + esc(r[0]) + "</span></div>").join("")
          + "<div><b>" + pct(st.bounced || 0, sent) + "</b><span>Bounced</span></div><div><b>" + num(st.unsub || 0) + "</b><span>Unsubscribed</span></div></div>";
        h += '<div class="eam-2"><div class="eam-card"><p class="eam-h">From sent to ' + esc(goal || "clicked") + "</p>"
          + rows.map(r => '<div class="eam-fn"><span>' + esc(r[0]) + '</span><div class="eam-bar"><i style="width:' + (sent ? (100 * r[1] / sent).toFixed(1) : 0) + '%"></i></div><b>'
            + num(r[1]) + "<small>" + (r[0] === "Sent" ? "" : pct(r[1], sent)) + "</small></b></div>").join("")
          + (opensOn ? "" : '<p class="eam-help">Opens show once open tracking is on in Resend (ZTZ-52).</p>') + "</div>"
          + '<div class="eam-card"><p class="eam-h">Checks</p>' + ((it.checks || []).length ? '<div class="eam-checks">' + it.checks.map(ckLine).join("") + "</div>" : '<p class="eam-help">Nothing to flag.</p>')
          + ((it.runs || []).length ? '<p class="eam-h" style="margin-top:14px">Recent runs</p><table class="rs-table"><thead><tr><th>When</th><th>By</th><th>Ready</th><th>Sent</th></tr></thead><tbody>'
            + it.runs.slice(0, 8).map(r => "<tr><td>" + esc(dt(r.at)) + "</td><td>" + esc(r.how === "auto" ? "by itself" : String(r.by_email || "").split("@")[0]) + "</td><td>"
              + num(r.eligible) + "</td><td>" + num(r.sent) + (r.failed ? " · " + r.failed + " failed" : "") + "</td></tr>").join("") + "</tbody></table>" : "")
          + "</div></div>";
        return h;
      }
      // THE QUEUE IN THREE TABS (11 Nov, ZTZ-69): nobody switched off disappears -- they sit under Switched off
      // with who did it and when, and Put back returns them; Undo follows every switch.
      const QTABS = [["will", "Will get it"], ["off", "Switched off"], ["cant", "Can't get it"]];
      const qtabOf = r => ((r.hard || []).length ? "cant" : r.off ? "off" : "will");
      const whoWhen = (by, at) => [by ? "by " + String(by).split("@")[0] : "", at ? dt(at) : ""].filter(Boolean).join(", ");
      function queueHtml() {
        if (!S.id) return '<div class="eam-card">Name it first (step 1).</div>';
        if (S.qErr) return '<div class="eam-card">Could not load: ' + esc(S.qErr) + "</div>";
        if (!S.queue) return '<div class="eam-card">Reading who gets it…</div>';
        const it = S.item || {}, d = S.draft || {}, rows = S.queue.rows || [];
        if (!S.qtab) S.qtab = "will";
        const n = { will: 0, off: 0, cant: 0 };
        rows.forEach(r => { n[qtabOf(r)] += 1; });
        const ready = rows.filter(r => qtabOf(r) === "will");
        const shown = rows.filter(r => qtabOf(r) === S.qtab);
        let h = msgLine() + '<div class="eam-card"><div class="eam-lc"><div><span class="eam-big">' + num(ready.length) + '</span><span class="eam-sub">can get it now, of '
          + num(rows.length) + " who match (" + esc(S.queue.lo) + " to " + esc(S.queue.hi) + "). Switch someone off to keep them out; they wait under Switched off.</span></div><div class=\"eam-act\">";
        if (it.status === "live" && d.mode !== "auto") h += '<button class="rs-btn pri" id="eamSend"' + (ready.length && !S.busy ? "" : " disabled") + ">Send to " + Math.min(ready.length, MAX_PER_SEND) + " now</button>"
          + (ready.length > MAX_PER_SEND ? '<div class="eam-help">One press sends up to ' + MAX_PER_SEND + "; the rest stay for the next press.</div>" : "");
        else if (it.status === "live") h += '<div class="eam-help">Goes out by itself at ' + esc(hourLab(d.schedule.run_hour)) + ".</div>";
        else h += '<div class="eam-help">After launch, these people get it.</div>';
        h += "</div></div></div>";
        h += '<div class="eam-qtabs" role="tablist" aria-label="Who gets it">' + QTABS.map(([k, l]) => '<button type="button" role="tab" class="eam-qtab'
          + (S.qtab === k ? " on" : "") + '" aria-selected="' + (S.qtab === k) + '" data-qtab="' + k + '">' + esc(l) + ' <span class="n">' + n[k] + "</span></button>").join("") + "</div>";
        const who = (d.audience || {}).source === "promised" ? "Promised" : "Moved";
        return h + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th></th><th>Customer</th><th>" + who + "</th><th>Foreman</th><th>"
          + ({ will: "Notes", off: "Switched off", cant: "Why they can't get it" }[S.qtab]) + "</th></tr></thead><tbody>"
          + (shown.length ? shown.slice(0, 500).map(r => {
            const hard = r.hard || [];
            const act = S.qtab === "will" ? '<input type="checkbox" class="eam-sw" data-off="' + esc(r.key) + '" checked aria-label="Switch off ' + esc(r.customer || "this customer") + '">'
              : S.qtab === "off" ? '<button type="button" class="rs-btn" data-back="' + esc(r.key) + '">Put back</button>' : "";
            const note = S.qtab === "off" ? "<b>Switched off</b>" + '<span class="eam-sub">' + esc(whoWhen(r.off_by, r.off_at)) + "</span>"
              : hard.map(x => pill(x, "eam-bad")).join(" ") + (r.flags || []).map(x => pill(x, "eam-warn")).join(" ");
            return '<tr class="' + (S.qtab === "cant" ? "eam-dim" : "") + '"><td style="white-space:nowrap;width:1%">' + act + "</td><td><b>" + esc(r.customer || "—") + '</b><span class="eam-sub">' + esc(r.email || "no email") + "</span></td>"
              + "<td>" + esc(d10(r.when)) + '<span class="eam-sub">' + esc(r.state || "") + "</span></td><td>" + esc(r.foreman || "—")
              + (r.score != null ? '<span class="eam-sub">score ' + esc(r.score) + "/10</span>" : "") + "</td><td>" + note + "</td></tr>";
          }).join("") : '<tr><td colspan="5" class="dim">' + ({ will: "Nobody can get it right now.", off: "Nobody is switched off.", cant: "Nobody is held back." }[S.qtab]) + "</td></tr>")
          + "</tbody></table></div></div>";
      }
      // a small "done, Undo" note at the bottom of the screen (outside the page's box, so a repaint keeps it)
      function toast(text, undo) {
        const old = document.getElementById("eamToast"); if (old) old.remove();
        const t = document.createElement("div");
        t.id = "eamToast"; t.className = "eam-toast"; t.setAttribute("role", "status");
        t.innerHTML = "<span>" + esc(text) + "</span>" + (undo ? '<button type="button" class="u">Undo</button>' : "")
          + '<button type="button" class="x" aria-label="Close">✕</button>';
        document.body.appendChild(t);
        const close = () => { clearTimeout(t._t); t.remove(); };
        t.querySelector(".x").onclick = close;
        if (undo) t.querySelector(".u").onclick = () => { close(); undo(); };
        t._t = setTimeout(close, 10000);
      }
      function setOff(k, off, quiet) {
        const r = ((S.queue || {}).rows || []).find(x => x.key === k); if (!r) return;
        post({ action: "off", what: "auto", id: S.id, key: k, off }).then(() => {
          r.off = off; r.off_by = off ? (ZTZ.email() || "") : null; r.off_at = off ? new Date().toISOString() : null;
          S.queue.waiting = (S.queue.rows || []).filter(x => qtabOf(x) === "will").length;      // the rail's count follows
          paintMain(); paintRail();
          if (!quiet) toast(off ? (r.customer || "They") + " is switched off: find them under Switched off." : (r.customer || "They") + " can get it again.",
                            () => setOff(k, !off, true));
        }).catch(e => { say(e.message, true); paintMain(); });
      }
      function sendsHtml() {
        if (!S.id) return "";
        if (S.sErr) return '<div class="eam-card">Could not load: ' + esc(S.sErr) + "</div>";
        if (!S.sends) return '<div class="eam-card">Loading…</div>';
        const tl = s => [["Delivered", s.delivered_at], ["Opened", s.opened_at], ["Clicked", s.clicked_at], ["Bounced", s.bounced_at], ["Unsubscribed", s.unsub_at]]
          .filter(x => x[1]).map(x => x[0] + " " + dt(x[1]).replace(" NJ", "")).join(" · ");
        return '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Customer</th><th>Moved</th><th>Sent</th><th>Status</th></tr></thead><tbody>"
          + (S.sends.length ? S.sends.slice(0, 1000).map(s => {
            const st = STATE[s.state_now] || [s.state_now, ""];
            return "<tr><td><b>" + esc(s.customer || "—") + '</b><span class="eam-sub">' + esc(s.email || "") + "</span></td><td>" + esc(d10(s.move_date))
              + '<span class="eam-sub">' + esc(s.state || "") + "</span></td><td>" + esc(dt(s.sent_at || s.created_at)) + '<span class="eam-sub">'
              + esc(String(s.sent_by || "").split("@")[0]) + "</span></td><td>" + pill(st[0], st[1]) + '<span class="eam-sub">' + esc(tl(s)) + (s.error ? " · " + esc(s.error) : "") + "</span></td></tr>";
          }).join("") : '<tr><td colspan="4" class="dim">Nothing sent yet.</td></tr>') + "</tbody></table></div></div>";
      }

      // setup steps
      function nameHtml() {
        const d = S.draft;
        const cats = Object.keys(CAT).filter(k => S.what === "auto" || k !== "survey");
        return '<div class="eam-2"><div class="eam-card eam-ed">' + msgLine()
          + '<label class="l" for="eamName" style="margin-top:0">Name</label><input id="eamName" maxlength="120" value="' + esc(d.name) + '" placeholder="' + (S.what === "auto" ? "Review request" : "Winter storage offer") + '">'
          + (S.what === "auto" ? '<label class="l" for="eamPurpose">What it\'s for (optional)</label><input id="eamPurpose" maxlength="300" value="' + esc(d.purpose) + '" placeholder="Ask happy customers for a Google review">' : "")
          + '<label class="l">Type of email</label><div class="eam-opts">' + cats.map(k => '<button type="button" class="eam-opt' + (d.category === k ? " on" : "") + '" data-cat="' + k + '" aria-pressed="' + (d.category === k) + '"><b>'
            + esc(CAT[k][0]) + "</b><span>" + esc(CAT[k][1]) + "</span></button>").join("") + "</div>"
          + (S.what === "auto" ? '<label class="l" for="eamOwner">Owner (optional)</label><input id="eamOwner" maxlength="60" value="' + esc(d.owner) + '" placeholder="Tako">' : "")
          + (S.id ? navHtml() : '<div class="rs-bar" style="margin-top:14px"><span class="rs-spacer" style="flex:1"></span><button class="rs-btn pri" id="eamCreate">Create and continue</button></div>')
          + "</div>" + summaryCard() + "</div>";
      }
      function seg(key, cur, opts) {
        return '<div class="eam-seg" role="group">' + opts.map(([v, l]) => '<button type="button" data-aud="' + key + ":" + v + '" class="' + (cur === v ? "on" : "") + '" aria-pressed="' + (cur === v) + '">' + esc(l) + "</button>").join("") + "</div>";
      }
      function audienceHtml() {
        const a = S.draft.audience, promised = a.source === "promised";
        let h = '<div class="eam-2"><div class="eam-card eam-ed">';
        if (S.what === "auto") {
          h += '<label class="l" style="margin-top:0">Who it\'s for</label><div class="eam-opts">'
            + '<button type="button" class="eam-opt' + (!promised ? " on" : "") + '" data-src="moves" aria-pressed="' + !promised + '"><b>Customers after their move</b><span>Completed Zip to Zip moves on the closing sheet.</span></button>'
            + '<button type="button" class="eam-opt' + (promised ? " on" : "") + '" data-src="promised" aria-pressed="' + promised + '"><b>Customers who promised a review</b><span>Their foreman heard them say they would write one.</span></button></div>';
        } else {
          h += '<p class="eam-help" style="margin-top:0">A single send goes to customers who moved with us, one email per address.</p>'
            + '<div class="eam-chips" style="gap:10px"><label class="l" for="eamFrom" style="margin:0">Moved from</label><input type="date" id="eamFrom" value="' + esc(a.date_from || "") + '" style="width:auto">'
            + '<label class="l" for="eamTo" style="margin:0">to</label><input type="date" id="eamTo" value="' + esc(a.date_to || "") + '" style="width:auto"></div>';
        }
        if (!promised) {
          const sc = (a.scores || []).slice().sort((x, y) => x - y);
          h += '<label class="l">Foreman\'s satisfaction score</label><div class="eam-chips">'
            + [[[9, 10], "9–10"], [[8, 9, 10], "8–10"], [[], "Any"]].map(([v, l]) => '<button type="button" class="eam-chip' + (JSON.stringify(sc) === JSON.stringify(v) ? " on" : "")
              + '" data-scores="' + v.join(",") + '">' + l + "</button>").join("") + '</div><p class="eam-help">From the closing sheet, 1–10. "Any" includes moves with no score.</p>'
            + '<label class="l">Move type</label>' + seg("distance", a.distance, [["local", "Local"], ["ld", "Long distance"], ["any", "Both"]])
            + '<label class="l">Claims</label>' + seg("claims", a.claims, [["none", "Leave out anyone with a claim"], ["any", "Include them"]])
            + '<label class="l">Called or texted support after the move</label>' + seg("support", a.support, [["any", "Include (shown as a note)"], ["exclude", "Leave them out"]])
            + '<label class="l" for="eamStates">States</label><input id="eamStates" placeholder="All states, or e.g. NJ, NY, CT" value="' + esc((a.states || []).join(", ")) + '">';
        }
        h += '<label class="l">Review written</label>' + seg("review", a.review, [["no", "Not yet"], ["yes", "Already reviewed"], ["any", "Either"]])
          + '<p class="eam-help">Always left out: no email address, unsubscribed, bounced, and ' + (S.what === "auto" ? "anyone this automation already emailed for the move." : "repeat addresses.") + "</p>"
          + navHtml() + '</div><div id="eamCount">' + countHtml() + "</div></div>";
        return h;
      }
      function countHtml() {
        if (S.countErr) return '<div class="eam-card">Could not count: ' + esc(S.countErr) + "</div>";
        const c = S.count;
        if (!c) return '<div class="eam-card">Counting…</div>';
        const why = {};
        (c.sample || []).forEach(r => (r.hard || []).forEach(x => { why[x] = (why[x] || 0) + 1; }));
        return '<div class="eam-card"><span class="eam-big">' + num(c.ready) + '</span><span class="eam-sub">can get it now, of ' + num(c.matched) + " who match"
          + (S.what === "auto" ? " (" + esc(c.lo) + " to " + esc(c.hi) + ")" : "") + "</span>"
          + (Object.keys(why).length ? '<div class="eam-checks">' + Object.keys(why).map(k => '<div class="eam-ck warn"><span aria-hidden="true">•</span>' + why[k] + " held back: " + esc(k) + "</div>").join("") + "</div>" : "") + "</div>"
          + '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Customer</th><th>Date</th><th>Score</th></tr></thead><tbody>'
          + ((c.sample || []).length ? c.sample.slice(0, 30).map(r => '<tr class="' + ((r.hard || []).length ? "eam-dim" : "") + '"><td><b>' + esc(r.customer || "—") + '</b><span class="eam-sub">'
            + esc((r.hard || []).length ? r.hard.join(", ") : (r.email || "")) + "</span></td><td>" + esc(d10(r.when)) + '<span class="eam-sub">' + esc(r.state || "") + "</span></td><td>"
            + esc(r.score != null ? r.score : "—") + "</td></tr>").join("") : '<tr><td colspan="3" class="dim">Nobody matches. Try wider filters.</td></tr>') + "</tbody></table></div></div>";
      }
      function chips(key, cur, opts, otherMax) {
        const known = opts.some(o => o[0] === +cur);
        return '<div class="eam-chips">' + opts.map(([v, l]) => '<button type="button" class="eam-chip' + (+cur === v ? " on" : "") + '" data-sch="' + key + ":" + v + '">' + l + "</button>").join("")
          + '<label class="eam-help" style="margin:0 0 0 6px" for="eamO_' + key + '">or</label><input type="number" min="0" max="' + otherMax + '" id="eamO_' + key + '" data-schn="' + key + '" value="' + (known ? "" : esc(cur))
          + '" placeholder="days" aria-label="Other number of days"></div>';
      }
      function whenHtml() {
        const s = S.draft.schedule, src = S.draft.audience.source === "promised" ? "the promise" : "the move";
        const auto = S.draft.mode === "auto";
        return '<div class="eam-2"><div class="eam-card eam-ed">'
          + '<label class="l" style="margin-top:0">Send it after ' + src + "</label>" + chips("days_after", s.days_after, AFTER, 365)
          + '<label class="l">Keep someone in the queue for</label>' + chips("look_back", s.look_back, KEEP, 365)
          + '<p class="eam-help">If nobody sends it in that time, the person drops off the queue.</p>'
          + '<label class="l">Sending</label><div class="eam-opts">'
          + '<button type="button" class="eam-opt' + (!auto ? " on" : "") + '" data-mode="ask" aria-pressed="' + !auto + '"><b>Ask first</b><span>The queue fills by itself; someone looks at it and presses Send.</span></button>'
          + '<button type="button" class="eam-opt' + (auto ? " on" : "") + '" data-mode="auto" aria-pressed="' + auto + '"><b>Send by itself</b><span>Goes out every day at a set hour to everyone due.</span></button></div>'
          + (auto ? '<div class="eam-chips" style="margin-top:10px;gap:10px"><label class="l" for="eamHour" style="margin:0">Every day at</label><select id="eamHour" style="width:auto">'
            + Array.from({ length: 24 }, (_, i) => '<option value="' + i + '"' + (+s.run_hour === i ? " selected" : "") + ">" + hourLab(i) + "</option>").join("") + "</select>"
            + '<label class="l" for="eamCap" style="margin:0">at most</label><input type="number" min="1" max="300" id="eamCap" value="' + esc(s.daily_cap) + '" style="width:90px"><span class="eam-help" style="margin:0">a day</span></div>' : "")
          + '<label class="l">Don\'t email people we emailed in the last</label>' + chips("gap_days", s.gap_days, GAP, 60)
          + '<p class="eam-help">Counts every automation and the survey, so nobody gets two of our emails too close together.</p>'
          + navHtml() + "</div>" + summaryCard() + "</div>";
      }
      function testHtml() {
        const it = S.item || {};
        const tests = S.tests || [];
        return '<div class="eam-2"><div class="eam-card eam-ed">' + msgLine()
          + '<p class="eam-help" style="margin-top:0">A test is the real email with working links, sent only to you or a company inbox. It never counts in the results.</p>'
          + '<label class="l" for="eamTestTo">Send a test to</label><div class="rs-bar" style="margin:0"><input id="eamTestTo" value="' + esc(S.testTo || ZTZ.email() || "") + '" style="flex:1;min-width:200px">'
          + '<button class="rs-btn pri" id="eamTest"' + (S.busy || !(S.list && S.list.resend) ? " disabled" : "") + ">Send a test</button></div>"
          + '<div style="margin-top:12px">' + (emailWaiting()
            ? (it.draft_tested && S.loadedJson === JSON.stringify(S.draft.template) ? ckLine({ lvl: "ok", text: "A test of your waiting email changes went out " + dt(it.tested_at) })
              : ckLine({ lvl: "warn", text: "No test of your waiting email changes yet" }))
            : it.tested ? ckLine({ lvl: "ok", text: "A test of the current email went out " + dt(it.tested_at) }) : ckLine({ lvl: "warn", text: "No test of the current email yet" })) + "</div>"
          + navHtml() + '</div><div class="eam-card"><p class="eam-h">Recent tests</p>'
          + (tests.length ? tests.map(t => '<div class="eam-cl"><span class="tx"><b>' + esc(t.email) + '</b><span class="eam-sub">' + esc(dt(t.sent_at || t.created_at)) + "</span></span>"
            + pill((STATE[t.state_now] || [t.state_now])[0], (STATE[t.state_now] || [])[1]) + "</div>").join("") : '<p class="eam-help">None yet. After you send one, it shows here with Delivered and Clicked.</p>')
          + "</div></div>";
      }
      function fixFor(text) {
        if (/subject|no text|no link|picture|banner|opens the survey|Describe|headline/i.test(text)) return ["s2", "Fix in Email"];
        if (/test/i.test(text)) return [S.what === "auto" ? "s5" : "s4", "Send a test"];
        if (/name/i.test(text)) return ["s1", "Fix in Name"];
        return null;
      }
      function launchHtml() {
        const it = S.item || {}, d = S.draft || {};
        const blockers = it.blockers || [];
        const good = [];
        if (d.name) good.push("Named: " + d.name);
        if (!emailProblems().length) good.push("Email ready: " + ((d.template || {}).subject || ""));
        if (it.tested) good.push("Test sent " + dt(it.tested_at));
        if (S.count) good.push(S.count.ready + " can get it now");
        const birdeye = blockers.some(b => /Birdeye/.test(b));
        return '<div class="eam-2"><div class="eam-card">' + msgLine() + '<p class="eam-h">' + (it.status === "live" ? "It's live" : blockers.length ? "Before it can launch" : "Ready to launch") + "</p>"
          + blockers.map(b => { const f = /Birdeye/.test(b) ? null : fixFor(b);
            return '<div class="eam-cl"><span class="eam-mk fix">To do</span><span class="tx">' + esc(b) + "</span>" + (f ? '<button class="rs-btn" data-part2="' + f[0] + '">' + esc(f[1]) + "</button>" : "") + "</div>"; }).join("")
          + good.map(g => '<div class="eam-cl"><span class="eam-mk done">Done</span><span class="tx">' + esc(g) + "</span></div>").join("")
          + (birdeye ? '<p class="eam-help">Birdeye\'s review push is switched off outside this page. Until then this stays a draft, so nobody is asked twice.</p>' : "")
          + '<div class="rs-bar" style="margin-top:14px"><button class="rs-btn" data-part2="' + (S.what === "auto" ? "s5" : "s4") + '">Back</button><span class="rs-spacer" style="flex:1"></span>'
          + (it.status === "live" ? '<button class="rs-btn" data-part2="over">See results</button>' : '<button class="rs-btn pri" id="eamLaunch"' + (blockers.length || S.busy ? " disabled" : "") + ">Launch</button>")
          + '</div><p class="eam-help">' + (d.mode === "auto" ? "After launch it sends by itself every day at " + esc(hourLab(d.schedule.run_hour)) + "."
            : "After launch its queue fills by itself; nothing goes out until someone presses Send.") + "</p></div>" + summaryCard() + "</div>";
      }
      function sendHtml() {
        const it = S.item || {};
        const probs = emailProblems().concat(it.tested ? [] : ["Send a test of the current email first"]);
        return '<div class="eam-2"><div class="eam-card eam-ed">' + msgLine()
          + '<p class="eam-h">' + (it.status === "scheduled" ? "Scheduled for " + esc(dt(it.send_at)) : probs.length ? "Before it can go out" : "Ready to send") + "</p>"
          + probs.map(b => { const f = fixFor(b); return '<div class="eam-cl"><span class="eam-mk fix">To do</span><span class="tx">' + esc(b) + "</span>" + (f ? '<button class="rs-btn" data-part2="' + f[0] + '">' + esc(f[1]) + "</button>" : "") + "</div>"; }).join("")
          + '<p class="eam-help">It goes once to everyone the audience shows as ready' + (S.count ? " (" + S.count.ready + " now)" : "") + ". Unsubscribed and bounced addresses are always left out.</p>"
          + '<div class="rs-bar" style="margin-top:12px"><button class="rs-btn pri" id="eamSendNow"' + (probs.length || S.busy ? " disabled" : "") + ">Send now</button></div>"
          + '<label class="l" for="eamAt">Or send it later (New Jersey time)</label><div class="rs-bar" style="margin:0"><input type="datetime-local" id="eamAt" value="' + esc(S.schedAt || "") + '" style="width:240px;flex:0 0 240px">'
          + '<button class="rs-btn" id="eamSchedule"' + (probs.length || S.busy ? " disabled" : "") + ">Schedule</button>"
          + (it.status === "scheduled" ? '<button class="rs-btn" id="eamUnschedule">Cancel the schedule</button>' : "") + "</div></div>" + summaryCard() + "</div>";
      }

      // ---- paint ---------------------------------------------------------------------------------
      function paint() {
        if (!alive()) return;
        host.innerHTML = '<div class="eam">' + (S.view === "item" ? itemView() : listView()) + "</div>";
        wireIn(host); mountDesigner();
      }
      function paintSave() { const e = host.querySelector("#eamSave"); if (e) { e.textContent = saveHtml(); e.className = "eam-save" + (S.save === "error" ? " err" : ""); } }
      function paintHead() { const e = host.querySelector("#eamHead"); if (e) { e.innerHTML = headHtml(); wireIn(e); } }
      function paintRail() { const e = host.querySelector("#eamRail"); if (e) { e.innerHTML = railHtml(); wireIn(e); } }
      function paintMain() { const e = host.querySelector("#eamMain"); if (e) { e.innerHTML = mainHtml(); wireIn(e); mountDesigner(); } }
      function mountDesigner() {
        const el = host.querySelector("#eamDesigner");
        if (!el || !window.EMAILDESIGNER || !S.draft) return;
        const it = S.item || {}, live = !!S.liveTpl;
        const cur = () => JSON.stringify(S.draft.template);
        if (!S.emdUi) S.emdUi = { testTo: S.testTo || ZTZ.email() || "" };
        const fresh = () => { S.draft.template = clone(S.item.template); S.liveTpl = clone(S.item.template); S.loadedJson = cur(); S.emdUi.sel = null; };
        S.ed = EMAILDESIGNER.mount(el, {
          template: S.draft.template, live: S.liveTpl, kit: kit(), survey: false, senders: (S.list && S.list.sender_ids) || ["survey", "reviews", "hello"],
          sender: S.draft.sender, onSender: v => { S.draft.sender = v; paintHead(); }, category: S.draft.category, designs: true,
          ui: S.emdUi,
          head: {
            title: "", pills: [], testTo: S.emdUi.testTo,
            meta: live ? (it.updated_by ? "Last change by " + String(it.updated_by).split("@")[0].replace(/^./, c => c.toUpperCase()) + ", " + dt(it.updated_at) : "")
              : S.what === "auto" ? "Draft: nothing goes out until it's launched (step 6)" : "Nothing goes out until you press Send (step 5)",
            onTest: to => {
              if (!(S.list && S.list.resend)) return Promise.reject(new Error("Sending isn't set up on the server yet (no Resend key)."));
              S.testTo = to;
              return save().then(() => post({ action: "test", what: S.what, id: S.id, to })).then(j => loadItem(true).then(() => {
                S.testedJson = cur(); paintRail(); return "Test sent to " + j.to + ". Open it and press its button."; }));
            },
            tested: n => {
              if (S.testedJson === cur()) return ["ok", "Test of this version sent"];
              const same = S.loadedJson === cur();
              if (live && n) return same && it.draft_tested ? ["ok", "Test of these changes sent " + dt(it.tested_at)] : ["warn", "No test of these changes yet"];
              return same && it.tested ? ["ok", "Test sent " + dt(it.tested_at)] : ["warn", "No test of this email yet"];
            },
            onLive: live ? () => save().then(() => post({ action: "make_live", what: "auto", id: S.id })).then(() => loadItem(true)).then(() => {
              fresh(); say("Live: every email from now on uses this version."); paint(); }) : null,
            onDiscard: live ? () => save().then(() => post({ action: "discard", what: "auto", id: S.id })).then(() => loadItem(true)).then(() => {
              fresh(); say("Changes discarded: the email is the live version again."); paint(); }) : null,
          },
          preview: t => post({ action: "preview", template: t, category: S.draft.category, sender: S.draft.sender }),
          upload: EMAILDESIGNER.uploader(post), onChange: () => { dirty(); paintRail(); },
          pictures: EMAILDESIGNER.picturesApi(path => api(path), post),
        });
      }
      function wireIn(root) {
        const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
        // list
        $$("[data-tab]").forEach(b => { b.onclick = () => { S.tab = b.dataset.tab; say(""); paint(); }; });
        $$("[data-retry]").forEach(b => { b.onclick = () => loadList(); });
        const days = $("#eamDays"); if (days) days.onchange = () => { S.days = +days.value; S.waiting = {}; loadList(); };
        const nw = $("#eamNew"); if (nw) nw.onclick = () => openItem(S.tab === "autos" ? "auto" : "single", null);
        $$("[data-open]").forEach(b => { b.onclick = () => { const a = (S.list.automations || []).find(x => x.id === +b.dataset.open); if (a) openItem("auto", a); }; });
        $$("[data-review]").forEach(b => { b.onclick = () => {
          const a = (S.list.automations || []).find(x => x.id === +b.dataset.review); if (!a) return;
          if (a.kind === "survey") { window.__SVY_OPEN_TAB = "list"; location.hash = "#page=surveys"; return; }
          openItem("auto", a, "queue"); };
        });
        $$("[data-svyemail]").forEach(b => { b.onclick = () => { window.__SVY_OPEN_TAB = "email"; location.hash = "#page=surveys"; }; });
        $$("[data-sopen]").forEach(b => { b.onclick = () => { const s1 = (S.list.singles || []).find(x => x.id === +b.dataset.sopen); if (s1) openItem("single", s1); }; });
        // item
        $$("[data-back]").forEach(b => { b.onclick = () => toList(S.what === "auto" ? "autos" : "single"); });
        $$("[data-part]").forEach(b => { b.onclick = () => {
          if (!S.id && b.dataset.part !== "s1") { say("Name it first, then press Create and continue.", true); S.part = "s1"; paintMain(); return; }
          go(b.dataset.part); }; });
        $$("[data-part2]").forEach(b => { b.onclick = () => go(b.dataset.part2); });
        $$("[data-status]").forEach(b => { b.onclick = () => {
          const want = b.dataset.status;
          if (want === "archived" && !confirm("Archive \"" + S.draft.name + "\"? It stops and leaves the list; its sends and results are kept.")) return;
          if (want === "paused" && !confirm("Pause \"" + S.draft.name + "\"? Nothing goes out until you resume it.")) return;
          post({ action: "status", what: S.what, id: S.id, status: want }).then(() => {
            if (want === "archived") { toList(S.what === "auto" ? "autos" : "single"); return; }
            say(want === "paused" ? "Paused." : "Live again."); loadItem(true).then(() => paintMain()); })
            .catch(e => { say((e.blockers || [e.message]).join(" "), true); paintMain(); });
        }; });
        const bind = (sel, fn) => { const el = $(sel); if (el) el.oninput = function () { fn(this.value); dirty(); }; };
        bind("#eamName", v => { S.draft.name = v; const t = host.querySelector("#eamHead .t"); if (t) t.textContent = v || "New automation"; });
        bind("#eamPurpose", v => { S.draft.purpose = v; });
        bind("#eamOwner", v => { S.draft.owner = v; });
        $$("[data-cat]").forEach(b => { b.onclick = () => { S.draft.category = b.dataset.cat; dirty(); paintMain(); paintHead(); }; });
        const cr = $("#eamCreate");
        if (cr) cr.onclick = () => {
          if (!S.draft.name.trim()) { say("Give it a name first.", true); paintMain(); return; }
          S.save = "create";
          save().then(() => { S.part = "s2"; say(""); paint(); onPart(); }).catch(e => { say(e.message, true); paintMain(); });
        };
        // audience
        $$("[data-src]").forEach(b => { b.onclick = () => { const a = S.draft.audience; a.source = b.dataset.src; if (a.source === "promised") a.review = "no"; dirty(); paintMain(); count(); }; });
        $$("[data-scores]").forEach(b => { b.onclick = () => { S.draft.audience.scores = b.dataset.scores ? b.dataset.scores.split(",").map(Number) : []; dirty(); paintMain(); count(); }; });
        $$("[data-aud]").forEach(b => { b.onclick = () => { const [k, v] = b.dataset.aud.split(":"); S.draft.audience[k] = v; dirty(); paintMain(); count(); }; });
        bind("#eamStates", v => { S.draft.audience.states = v.split(/[\s,;]+/).map(x => x.trim().toUpperCase()).filter(x => /^[A-Z]{2}$/.test(x)); count(); });
        const fr = $("#eamFrom"); if (fr) fr.onchange = () => { S.draft.audience.date_from = fr.value; dirty(); count(); };
        const to = $("#eamTo"); if (to) to.onchange = () => { S.draft.audience.date_to = to.value; dirty(); count(); };
        // when
        $$("[data-sch]").forEach(b => { b.onclick = () => { const [k, v] = b.dataset.sch.split(":"); S.draft.schedule[k] = +v; dirty(); paintMain(); paintRail(); }; });
        $$("[data-schn]").forEach(i => { i.oninput = () => { if (i.value === "") return; S.draft.schedule[i.dataset.schn] = Math.max(0, +i.value || 0); dirty(); paintRail();
          root.querySelectorAll('[data-sch^="' + i.dataset.schn + ':"]').forEach(c => c.classList.remove("on")); }; });
        $$("[data-mode]").forEach(b => { b.onclick = () => { S.draft.mode = b.dataset.mode; dirty(); paintMain(); paintRail(); paintHead(); }; });
        const hr = $("#eamHour"); if (hr) hr.onchange = () => { S.draft.schedule.run_hour = +hr.value; dirty(); };
        const cap = $("#eamCap"); if (cap) cap.oninput = () => { S.draft.schedule.daily_cap = Math.max(1, Math.min(300, +cap.value || 1)); dirty(); };
        // queue
        $$("[data-qtab]").forEach(b => { b.onclick = () => { S.qtab = b.dataset.qtab; say(""); paintMain(); }; });
        $$("[data-off]").forEach(cb => { cb.onchange = () => { cb.disabled = true; setOff(cb.dataset.off, !cb.checked); }; });
        $$("[data-back]").forEach(b => { b.onclick = () => { b.disabled = true; setOff(b.dataset.back, false); }; });
        const sendB = $("#eamSend");
        if (sendB) sendB.onclick = () => {
          const ready = (S.queue.rows || []).filter(r => !(r.hard || []).length && !r.off).slice(0, MAX_PER_SEND);
          if (!ready.length || !confirm("Send \"" + S.draft.name + "\" to " + ready.length + " customer" + (ready.length === 1 ? "" : "s") + " now? Each move gets it only once.")) return;
          S.busy = true; say("Sending…"); paintMain();
          post({ action: "send", what: "auto", id: S.id, keys: ready.map(r => r.key) }).then(j => {
            S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.skipped && j.skipped.length ? ", " + j.skipped.length + " skipped" : "") + ".", !!j.failed);
            loadQueue(); loadItem(true);
          }).catch(e => { S.busy = false; say(e.message, true); loadQueue(); });
        };
        const runB = $("#eamRun");
        if (runB) runB.onclick = () => {
          if (!confirm("Run \"" + S.draft.name + "\" now? It sends to everyone due, up to its daily limit, like the daily run.")) return;
          S.busy = true; paintHead();
          post({ action: "run", what: "auto", id: S.id }).then(j => { S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.left ? ", " + j.left + " left for the next run" : "") + "."); loadItem(true).then(() => paintMain()); })
            .catch(e => { S.busy = false; say(e.message, true); paintHead(); paintMain(); });
        };
        // test
        const tto = $("#eamTestTo"); if (tto) tto.oninput = function () { S.testTo = this.value; };
        const tb = $("#eamTest");
        if (tb) tb.onclick = () => {
          S.busy = true; say("Sending the test…"); paintMain();
          save().then(() => post({ action: "test", what: S.what, id: S.id, to: S.testTo || ZTZ.email() }))
            .then(j => loadItem(true).then(() => j))
            .then(j => { S.busy = false; say("Test sent to " + j.to + ". Open it and press its button; it shows below within a minute."); paintMain(); loadTests(); setTimeout(loadTests, 5000); })
            .catch(e => { S.busy = false; say(e.message || String(e), true); paintMain(); });
        };
        // launch
        const lb = $("#eamLaunch");
        if (lb) lb.onclick = () => {
          if (!confirm("Launch \"" + S.draft.name + "\"? " + (S.draft.mode === "auto" ? "It sends by itself every day at " + hourLab(S.draft.schedule.run_hour) + "." : "Its queue fills by itself; nothing goes out until someone presses Send."))) return;
          S.busy = true; paintMain();
          save().then(() => post({ action: "status", what: "auto", id: S.id, status: "live" }))
            .then(() => loadItem(true)).then(() => { S.busy = false; say("Live."); S.part = "over"; paint(); })
            .catch(e => { S.busy = false; say((e.blockers || [e.message]).join(" "), true); paintMain(); });
        };
        // single: send now / schedule
        const at = $("#eamAt"); if (at) at.onchange = () => { S.schedAt = at.value; };
        const sn = $("#eamSendNow");
        if (sn) sn.onclick = () => {
          save().then(() => post({ action: "count", what: "single", id: S.id, audience: S.draft.audience, category: S.draft.category })).then(c => {
            if (!confirm("Send \"" + S.draft.name + "\" now to " + c.ready + " customer" + (c.ready === 1 ? "" : "s") + "? This can't be undone.")) return null;
            S.busy = true; say("Sending…"); paintMain();
            return post({ action: "single_send", what: "single", id: S.id });
          }).then(j => { if (!j) return; S.busy = false; say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + "."); loadItem(true).then(() => { S.part = "over"; paint(); }); })
            .catch(e => { S.busy = false; say((e.blockers || [e.message]).join(" "), true); paintMain(); });
        };
        const sch = $("#eamSchedule");
        if (sch) sch.onclick = () => {
          if (!S.schedAt) { say("Pick a date and time first.", true); paintMain(); return; }
          save().then(() => post({ action: "single_send", what: "single", id: S.id, at: S.schedAt }))
            .then(() => { say("Scheduled for " + S.schedAt.replace("T", " ") + " NJ."); return loadItem(true); }).then(() => paintMain())
            .catch(e => { say((e.blockers || [e.message]).join(" "), true); paintMain(); });
        };
        const un = $("#eamUnschedule");
        if (un) un.onclick = () => { post({ action: "status", what: "single", id: S.id, status: "draft" }).then(() => loadItem(true)).then(() => { say("Schedule cancelled."); paintMain(); }).catch(e => { say(e.message, true); paintMain(); }); };
      }

      // ---- start ---------------------------------------------------------------------------------
      if (S.view === "item" && S.draft) paint();
      else { S.view = "list"; loadList(); }
    },
  });
})();
