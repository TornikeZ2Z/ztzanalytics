/* CUSTOMER SURVEY -- Tako's feedback form by email (tracker ZTZ-46; v2 on his picks of 10 Nov 2026).
 *
 *   OVERVIEW   the numbers: sent > delivered > opened > clicked > answered, scores by question,
 *              worth the price, what they enjoyed, where answers came from, results per send and
 *              per foreman, the latest flagged answers.
 *   AUDIENCE   every completed Zip to Zip move 14+ days old in five tabs (11 Nov, ZTZ-69): Will get
 *              it, Switched off (who and when; Put back), Left out by the rule (Add anyway), Can't be
 *              sent, Already sent. Tako's rule (foreman's score 9-10, nothing on the Claims /
 *              Complaints board) sorts moves into the tabs; a switch moves one person to Switched off
 *              with an Undo, and ONE button sends to everyone in Will get it. Nothing sends by itself.
 *   SENDS      every email, one row each, with how far it got (Resend's webhook) and its answer.
 *   RESPONSES  every filled survey; bad answers flagged here only (an issue, or a low mark).
 *   EMAIL      the shared email editor (assets/email-designer.js, 12 Nov, ZTZ-69 step 3): a header with
 *              "N changes not live yet", Discard changes / Send a test… / Make changes live; the parts,
 *              the email (click a part) and the settings. Edits save by themselves as a DRAFT on the
 *              server (survey_template.draft): every send uses the live email until Make changes live.
 *              A test carries a real personal link (kept out of every count).
 *
 * EVERY EMAILED LINK IS PERSONAL (one token per move), so each answer is tied to the exact customer,
 * move and send. THE SERVER OWNS EVERY LIMIT (bridge/survey.py): long-distance moves, no email,
 * unsubscribed, already surveyed and moves under 14 days are refused on send whatever the page sent.
 */
(() => {
  function injectStyle() {
    if (document.getElementById("svy-style")) return;
    const st = document.createElement("style");
    st.id = "svy-style";
    st.textContent = ""
      + ".svy{font-variant-numeric:tabular-nums}"
      + ".svy-back{display:inline-block;font-size:12.5px;margin:0 0 8px;text-decoration:none}"
      + ".svy-note{font-size:12.5px;color:var(--muted);margin:6px 2px 10px;line-height:1.5}"
      + ".svy-sub{display:block;font-size:12px;color:var(--faint);margin-top:2px}"
      + ".svy-flag{display:inline-block;font-size:12px;font-weight:600;padding:2px 8px;border-radius:99px;"
      + "background:rgba(217,119,6,.13);color:#b45309;margin:2px 4px 0 0;white-space:nowrap}"
      + ".svy-bad{background:rgba(220,38,38,.12);color:#b91c1c}"
      + ".svy-ok{background:rgba(22,163,74,.12);color:#15803d}"
      + ".svy-mute{background:var(--panel-2);color:var(--muted)}"
      + ".svy-blue{background:rgba(37,99,235,.11);color:#1d4ed8}"
      + ".svy-lime{background:rgba(141,177,60,.2);color:#4d6b12}"
      + ".svy-sw{appearance:none;width:34px;height:20px;border-radius:99px;background:var(--line);position:relative;"
      + "cursor:pointer;vertical-align:middle;transition:background .15s}"
      + ".svy-sw:checked{background:var(--brand)}"
      + ".svy-sw::after{content:'';position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;"
      + "background:#fff;transition:left .15s}"
      + ".svy-sw:checked::after{left:17px}.svy-sw:disabled{opacity:.35;cursor:not-allowed}"
      + ".svy tr.svy-dim td{opacity:.55}"
      + ".svy-row2{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;margin-top:14px}"
      + ".svy-row3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:14px}"
      + "@media (max-width:1100px){.svy-row2,.svy-row3{grid-template-columns:minmax(0,1fr)}}"
      + ".svy-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:16px 18px}"
      + ".svy-h{font-size:14px;font-weight:700;color:var(--ink);margin:0 0 3px}"
      + ".svy-hs{font-size:12px;color:var(--faint);margin:0 0 14px}"
      + ".svy-br{display:grid;grid-template-columns:150px minmax(0,1fr) 92px;gap:10px;align-items:center;margin:9px 0;font-size:13px}"
      + ".svy-br>span:first-child{color:var(--muted)}"
      + ".svy-br>b{text-align:right;font-weight:700;color:var(--ink)}"
      + ".svy-br>b small{font-weight:500;color:var(--faint);margin-left:4px}"
      + ".svy-bar{display:flex;height:14px;border-radius:4px;overflow:hidden;background:var(--panel-2)}"
      + ".svy-bar i{display:block;height:100%}"
      + ".svy-leg{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--faint);margin-top:10px}"
      + ".svy-leg span::before{content:'';display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;"
      + "vertical-align:-1px;background:var(--c)}"
      + ".svy-big{font-size:30px;font-weight:800;color:var(--ink);line-height:1.1}"
      + ".svy-empty{text-align:center;padding:42px 20px}"
      + ".svy-empty b{display:block;font-size:16px;color:var(--ink);margin-bottom:6px}"
      + ".svy-tl{font-size:12px;color:var(--faint);margin-top:3px;line-height:1.5}"
      + ".svy-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:16px;align-items:start}"
      + "@media (max-width:1000px){.svy-grid{grid-template-columns:minmax(0,1fr)}}"
      + ".svy-ed label{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:12px 0 5px}"
      + ".svy-ed input,.svy-ed textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:9px 11px;"
      + "border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink)}"
      + ".svy-ed textarea{min-height:170px;resize:vertical;line-height:1.5}"
      + ".svy-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:10px}"
      + ".svy-pv{border:1px solid var(--line);border-radius:14px;background:#f2f1ec;overflow:hidden}"
      + ".svy-pv iframe{display:block;border:0;width:100%;height:720px;background:#f2f1ec;margin:0 auto}"
      + ".svy-pv.mob iframe{width:390px;max-width:100%}"
      + ".svy-ans{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:6px 18px;padding:12px 16px;"
      + "background:var(--panel-2);font-size:13px}"
      + ".svy-ans b{display:block;font-size:12px;color:var(--faint);font-weight:600}"
      + ".svy-link{color:var(--brand);cursor:pointer;font-weight:600;text-decoration:underline}"
      // the Audience's five tabs and its Undo note (11 Nov, ZTZ-69)
      + ".svy-atabs{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:12px 0 4px}"
      + ".svy-atab{font:inherit;font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:10px;border:1px solid var(--line);"
      + "background:var(--panel);color:var(--ink);cursor:pointer;min-height:40px}"
      + ".svy-atab .n{display:inline-block;min-width:20px;font-size:12px;font-weight:700;padding:1px 7px;border-radius:99px;"
      + "background:var(--panel-2);color:var(--muted);margin-left:4px;text-align:center}"
      + ".svy-atab.on{background:var(--ink);color:var(--panel);border-color:var(--ink)}.svy-atab.on .n{background:rgba(255,255,255,.18);color:inherit}"
      + ".svy-atab:focus-visible,.svy-mini:focus-visible{outline:2px solid var(--brand-d,#5f7c20);outline-offset:2px}"
      + ".svy-act{white-space:nowrap;width:1%}"
      + ".svy-mini{font:inherit;font-size:12px;font-weight:600;color:var(--muted);background:none;border:0;padding:4px 6px;"
      + "margin-left:6px;cursor:pointer;text-decoration:underline;min-height:28px}"
      + ".svy-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;"
      + "background:#0f172a;color:#fff;border-radius:12px;padding:9px 10px 9px 16px;box-shadow:0 10px 30px rgba(15,23,42,.35);font-size:14px;max-width:calc(100vw - 32px)}"
      + ".svy-toast .u{font:inherit;font-size:13.5px;font-weight:700;border:0;border-radius:8px;background:#b7e23b;color:#14200a;padding:7px 14px;cursor:pointer}"
      + ".svy-toast .x{font:inherit;font-size:15px;border:0;background:none;color:#fff;padding:6px 8px;cursor:pointer}";
    document.head.appendChild(st);
  }

  const PAGE = 50;
  const MAX_PER_SEND = 300;                   // bridge/survey.py MAX_SEND: one press mails at most this many
  const SCALE5 = { booking: ["Very challenging", "Challenging", "Neutral", "Smooth", "Very smooth"],
                   crew: ["Very poor", "Poor", "Neutral", "Good", "Very good"],
                   transit: ["Very poor", "Poor", "Neutral", "Good", "Very good"] };
  const QUESTIONS = [["booking", "Booking was smooth"], ["crew", "Crew on moving day"], ["transit", "Kept informed in transit"],
                     ["overall", "Overall satisfaction"], ["recommend", "Would recommend us"]];
  const ENJOYED = ["Crew Professionalism", "Service Quality", "Time Management", "Communication", "Affordability", "Something else"];
  // solid fills only: low marks red, 3 amber, 4 the brand lime, 5 a deep green
  const C = { s12: "#d1495b", s3: "#e0a93b", s4: "#a9c95a", s5: "#3f7d20", ink: "#2b2b28", ink2: "#5d5d56",
              lime: "#8db13c", blue: "#3b82f6", no: "#d1495b", some: "#e0a93b", yes: "#3f7d20" };
  const STATE = { answered: ["Answered", "svy-ok"], clicked: ["Clicked", "svy-lime"], opened: ["Opened", "svy-blue"],
                  delivered: ["Delivered", "svy-mute"], sent: ["Sent", "svy-mute"], sending: ["Sending…", ""],
                  failed: ["Failed", "svy-bad"], bounced: ["Bounced", "svy-bad"], complained: ["Marked as spam", "svy-bad"] };

  registerPage({
    id: "surveys",
    group: "reviews",
    title: "Customer Survey",
    subtitle: "Tako's feedback survey by email: the results, who gets it, every send and answer, and the email itself.",
    datasets: [],

    render(host) {
      const RSC = window.RSC || {};
      const esc = RSC.esc || (s => String(s == null ? "" : s).replace(/[&<>"']/g, c =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
      const mine = host;
      // `host` is the portal's shared content box, so "still in the page" is not enough: a late answer
      // after the reader moved on would paint the survey over the other page. A render token plus the
      // hash decide (10 Nov review).
      const myRender = (window.__SVY_RENDER = (window.__SVY_RENDER || 0) + 1);
      const alive = () => document.body.contains(mine) && window.__SVY_RENDER === myRender
        && /(^|[#&])page=surveys(&|$)/.test(location.hash);
      const iso = d => d.toISOString().slice(0, 10);
      const S = window.__SVY2 || (window.__SVY2 = {
        tab: "over", plo: iso(new Date(Date.now() - 90 * 864e5)), phi: iso(new Date()), phiAuto: true, tests: false,
        sends: null, sErr: "", tracking: false, sQ: "", sPage: 0, pf: null,
        ans: null, aErr: "", aOpen: null, aQ: "",
        lo: "", hi: "", rows: null, resend: false, err: "", msg: "", msgErr: false, page: 0,
        af: null, q: "",
        tpl: null, draft: null, from: "", address: "", testTo: "", pv: "desk", pvHtml: "", pvSubject: "", busy: false,
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
      // the bridge stores UTC; the business runs on New Jersey time
      const dt = v => {
        if (!v) return "";
        const d = new Date(String(v).replace(" ", "T") + (/[zZ]|[+-]\d\d:?\d\d$/.test(String(v)) ? "" : "Z"));
        if (isNaN(d)) return String(v).replace("T", " ").slice(0, 16);
        return d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " NJ";
      };
      const say = (m, bad) => { S.msg = m; S.msgErr = !!bad; };
      const num = v => (typeof v === "number" ? v.toLocaleString() : v);
      const pct = (a, b) => (b ? Math.round(100 * a / b) + "%" : "—");
      const avgOf = (rs, k) => { const v = rs.map(r => +r[k]).filter(x => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      const f1 = v => (v == null ? "—" : v.toFixed(1));

      injectStyle();

      // ---- loading ---------------------------------------------------------------------------
      const pq = () => "&lo=" + S.plo + "&hi=" + S.phi + (S.tests ? "&tests=1" : "");
      function loadSends() {
        S.sends = null;
        return api("/api/_surveyadmin?view=sends" + pq()).then(j => {
          S.sends = j.sends || []; S.tracking = !!j.tracking; S.sErr = ""; if (alive()) paint();
        }).catch(e => { S.sends = []; S.sErr = e.message || String(e); if (alive()) paint(); });
      }
      function loadAnswers() {
        S.ans = null;
        return api("/api/_surveyadmin?view=responses" + pq()).then(j => {
          S.ans = j.responses || []; S.aHidden = +j.tests_hidden || 0; S.aErr = ""; if (alive()) paint();
        }).catch(e => { S.ans = []; S.aErr = e.message || String(e); if (alive()) paint(); });
      }
      function loadPeriod() {
        if (S.phiAuto) S.phi = iso(new Date());           // sends made after the page opened stay in the period
        paint(); return Promise.all([loadSends(), loadAnswers()]);
      }
      function loadList() {
        S.rows = null; paint();
        const q = (S.lo ? "&lo=" + S.lo : "") + (S.hi ? "&hi=" + S.hi : "");
        return api("/api/_surveyadmin?view=list" + q).then(j => {
          S.rows = j.rows || []; S.lo = j.lo; S.hi = j.hi; S.resend = !!j.resend; S.err = "";
          S.age = { at: j.data_at, live: !!j.data_live, next: j.next_at, due: !!j.next_due };
          if (alive()) paint();
        }).catch(e => { S.err = e.message || String(e); S.rows = []; if (alive()) paint(); });
      }
      function loadTemplate() {
        return api("/api/_surveyadmin?view=template").then(j => {
          S.tpl = j.template; S.draft = Object.assign({}, j.template); S.from = j.from; S.address = j.address;
          S.kit = j.kit || {};
          // the live email, and the edits waiting on top of it (12 Nov): the editor opens on the waiting ones
          S.liveDesign = JSON.parse(JSON.stringify(j.template.design || j.template.design_default || { subject: "", blocks: [] }));
          S.design = JSON.parse(JSON.stringify(j.template.draft || S.liveDesign));
          S.draftBy = j.template.draft_by || ""; S.draftAt = j.template.draft_at || ""; S.draftSave = "";
          ["design", "design_default", "draft", "draft_by", "draft_at"].forEach(k => { delete S.draft[k]; });
          S.resend = !!j.resend; S.tracking = !!j.tracking; S.tplErr = "";
          if (!S.testTo) S.testTo = (window.ME && ME.email) || "";
          if (alive()) paint();
        }).catch(e => { S.tplErr = e.message || String(e); if (alive()) paint(); });
      }
      function preview() {
        return post({ action: "preview", template: S.draft }).then(j => {
          S.pvHtml = j.html || ""; S.pvSubject = j.subject || "";
          const f = host.querySelector("#svyPv"); if (f) f.srcdoc = S.pvHtml;
          const s = host.querySelector("#svyPvSubj"); if (s) s.textContent = S.pvSubject;
        }).catch(() => {});
      }

      // ---- small drawing helpers -------------------------------------------------------------
      function kpi(val, lab, sub, cls) {
        return '<div class="kpi ' + (cls || "") + '"><div class="l">' + esc(lab) + '</div><div class="v">'
          + esc(num(val)) + '</div><div class="s">' + esc(sub) + "</div></div>";
      }
      function bar(parts) {   // [[value, colour, title]]
        const tot = parts.reduce((a, p) => a + p[0], 0);
        return '<div class="svy-bar">' + (tot ? parts.filter(p => p[0] > 0).map(p =>
          '<i style="width:' + (100 * p[0] / tot).toFixed(2) + "%;background:" + p[1] + '" title="' + esc(p[2] + ": " + p[0]) + '"></i>').join("") : "") + "</div>";
      }
      function meter(v, max, colour) {
        return '<div class="svy-bar"><i style="width:' + (max ? (100 * v / max).toFixed(2) : 0) + "%;background:" + colour + '"></i></div>';
      }
      const legend = items => '<div class="svy-leg">' + items.map(i => '<span style="--c:' + i[1] + '">' + esc(i[0]) + "</span>").join("") + "</div>";
      const card = (title, sub, body) => '<div class="svy-card"><p class="svy-h">' + esc(title) + "</p>"
        + (sub ? '<p class="svy-hs">' + esc(sub) + "</p>" : '<div style="height:10px"></div>') + body + "</div>";
      // THE PORTAL'S FILTER LOOK on Overview / Sends / Responses too (his rule, 10 Nov): one bar --
      // the dates (RSC.dateRange), Find, the Filters button opening the side panel -- and the
      // "Filtered by" chips under it. The panel: State, Foreman, Send, Test sends on every tab; Status
      // on Sends; Flag, Answer came from and Overall rating on Responses.
      function periodBar(kind) { return '<div class="rs-bar" id="svyPBar" data-kind="' + kind + '"></div><div id="svyPChips"></div>'; }
      if (!S.pf) S.pf = {};
      const srcOf = r => (r.source === "email" ? "Emailed link" : /qr/i.test(r.source || "") ? "QR code"
        : /site|web/i.test(r.source || "") ? "Website" : "Public link");
      const sendLabel = c => String(c || "—").replace(/^survey-/, "").replace(/-(\d\d)(\d\d)$/, " $1:$2 UTC");
      const PF = {
        state: { label: "State", of: x => x.state || "Unknown", kinds: ["over", "sends", "ans"] },
        foreman: { label: "Foreman", of: x => x.foreman || "—", kinds: ["over", "sends", "ans"] },
        campaign: { label: "Send", of: x => x.campaign || "—", lab: sendLabel, kinds: ["over", "sends", "ans"] },
        status: { label: "Status", of: x => (STATE[x.state_now] || [x.state_now])[0], kinds: ["sends"] },
        flag: { label: "Flag", of: x => (+x.flagged === 1 ? "Flagged" : "Not flagged"), kinds: ["ans"] },
        source: { label: "Answer came from", of: srcOf, kinds: ["ans"] },
        overall: { label: "Overall rating", of: x => (x.overall ? String(x.overall) + " / 5" : "—"), kinds: ["ans"] },
      };
      const pfKeys = kind => Object.keys(PF).filter(k => PF[k].kinds.indexOf(kind) >= 0);
      const pfOk = (x, kind) => pfKeys(kind).every(k => { const set = S.pf[k]; return !set || !set.size || set.has(PF[k].of(x)); });
      function mountPeriodBar() {
        const bar = host.querySelector("#svyPBar");
        if (!bar || !window.RSC) return;
        const kind = bar.dataset.kind;
        const fld = label => { const w = document.createElement("div"); w.className = "rs-fld"; w.innerHTML = "<span>" + label + "</span>"; bar.appendChild(w); return w; };
        if (RSC.dateRange) RSC.dateRange(fld(kind === "ans" ? "Answered" : "Sent"), {
          get: () => ({ from: S.plo, to: S.phi }),
          set: (f, t) => { S.plo = f || ""; S.phi = t || ""; S.phiAuto = !t || t === iso(new Date()); },
          onChange: () => { S.sPage = 0; loadPeriod(); } });
        if (kind !== "over") {
          const key = kind === "sends" ? "sQ" : "aQ";
          const q = document.createElement("input");
          q.className = "rs-inp"; q.placeholder = kind === "sends" ? "Find a customer, email, foreman…" : "Find a name, foreman, words…";
          q.value = S[key]; q.style.flex = "0 1 260px";
          let qt = null;
          q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { S[key] = q.value; S.sPage = 0; S._focusP = 1; paint(); }, 300); };
          bar.appendChild(q);
          if (S._focusP) { S._focusP = 0; setTimeout(() => { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }, 0); }
        }
        const sp = document.createElement("span"); sp.className = "rs-spacer"; bar.appendChild(sp);
        if (kind !== "over") {
          const b = document.createElement("button"); b.className = "rs-btn"; b.type = "button"; b.textContent = "Download CSV";
          b.onclick = () => csv(kind); bar.appendChild(b);
        }
        if (!RSC.filterPanel) return;
        const data = kind === "ans" ? (S.ans || []) : (S.sends || []);
        const fields = pfKeys(kind).map(k => {
          const n = {}; data.forEach(x => { const v = PF[k].of(x); n[v] = (n[v] || 0) + 1; });
          (S.pf[k] || new Set()).forEach(v => { if (!(v in n)) n[v] = 0; });
          return { key: k, label: PF[k].label, values: Object.keys(n).sort((a, b) => (n[b] - n[a]) || a.localeCompare(b))
            .map(v => ({ v, l: PF[k].lab ? PF[k].lab(v) : v, n: n[v] })) };
        });
        fields.push({ key: "tests", label: "Test sends", values: [{ v: "Include test sends", l: "Include test sends" }] });
        const selected = Object.assign({}, S.pf, { tests: new Set(S.tests ? ["Include test sends"] : []) });
        const apply = next => {
          const tests = !!(next.tests && next.tests.size);
          pfKeys(kind).forEach(k => { S.pf[k] = new Set(next[k] || []); });
          S.sPage = 0;
          if (tests !== !!S.tests) { S.tests = tests; loadPeriod(); } else paint();
        };
        RSC.filterPanel(bar, { fields, selected, onApply: apply,
          note: "Test sends (to you or a company inbox) stay out of every count unless switched on here." });
        const chips = host.querySelector("#svyPChips");
        if (chips && RSC.filterChips) RSC.filterChips(chips, { fields, selected, onChange: apply });
      }

      // ---- OVERVIEW ----------------------------------------------------------------------------
      function overView() {
        if (S.sends === null || S.ans === null) return periodBar("over") + '<div class="panel">Loading the results…</div>';
        if (S.sErr || S.aErr) return periodBar("over") + '<div class="panel">Could not load the results: ' + esc(S.sErr || S.aErr) + "</div>";
        const sends = S.sends.filter(s => s.status === "sent" && pfOk(s, "over"));
        const rs = S.ans.filter(r => pfOk(r, "over"));
        let h = periodBar("over");
        if (!sends.length && !rs.length) {
          return h + '<div class="panel svy-empty"><b>No surveys in this period yet</b>'
            + '<span class="svy-note">Build the audience on the <span class="svy-link" data-go="list">Audience</span> tab and press Send. '
            + "Every send and every answer then shows here.</span></div>";
        }
        const n = sends.length;
        const delivered = sends.filter(s => s.delivered_at || s.opened_at || s.clicked_at || s.answered_at).length;
        const opened = sends.filter(s => s.opened_at || s.clicked_at || s.answered_at).length;
        // "opened" needs Resend's open tracking ON, which is separate from the webhook: until an opened
        // event has actually arrived, the opens column would only be clicks + answers in disguise
        const opensOn = S.opensOn = (S.sends || []).some(s => s.opened_at);
        const clicked = sends.filter(s => s.clicked_at || s.answered_at).length;
        const answered = sends.filter(s => s.answered_at).length;
        const bounced = sends.filter(s => s.bounced_at || s.complained_at).length;
        const flagged = rs.filter(r => +r.flagged === 1);
        const rec = rs.filter(r => +r.recommend >= 4).length;
        const fromEmail = rs.filter(r => r.source === "email").length;
        h += '<div class="rs-kpis" style="--kpi-cols:6">'
          + kpi(n, "Surveys sent", bounced ? bounced + " bounced or marked spam" : "in this period")
          + (opensOn ? kpi(pct(opened, delivered || n), "Opened", opened + " of " + (delivered || n) + (delivered ? " delivered" : " sent"))
            : kpi(pct(clicked, n), "Opened their link", clicked + " of " + n + " · email opens not tracked yet"))
          + kpi(pct(answered, n), "Answered", answered + " of " + n + " emailed")
          + kpi(f1(avgOf(rs, "overall")), "Overall satisfaction", "out of 5 · " + rs.length + " answer" + (rs.length === 1 ? "" : "s"))
          + kpi(pct(rec, rs.length), "Would recommend", "answered 4 or 5 of 5")
          + kpi(flagged.length, "Flagged", "an issue or a low mark", flagged.length ? "warn" : "") + "</div>";
        // funnel + scores
        // without Resend's webhook, delivered/opened would only be inferred from clicks (10 clicks of 100
        // sends would read "10% delivered"), so they show as not tracked instead of a wrong number
        const steps = [["Sent", n, C.ink], ["Delivered", S.tracking ? delivered : null, C.ink2], ["Opened", opensOn ? opened : null, C.blue],
                       ["Clicked", clicked, C.lime], ["Answered", answered, C.s5]];
        const funnel = steps.map(s => '<div class="svy-br"><span>' + s[0] + "</span>" + meter(s[1] || 0, n, s[2])
          + "<b>" + (s[1] == null ? '<small style="margin:0">not tracked yet</small>' : num(s[1]) + "<small>" + pct(s[1], n) + "</small>") + "</b></div>").join("")
          + (!S.tracking ? '<p class="svy-note" style="margin:10px 0 0">Delivered and opened fill in once Resend\'s webhook is connected. Clicked (they opened their link) and answered are always exact: every emailed link is personal.</p>'
            : !opensOn ? '<p class="svy-note" style="margin:10px 0 0">Email opens show once open tracking is switched on in Resend (mail.ziptozip.app). Delivered, clicked and answered are tracked now.</p>' : "");
        const scores = QUESTIONS.map(([k, label]) => {
          const v = rs.map(r => +r[k]).filter(x => x > 0);
          const c = [v.filter(x => x <= 2).length, v.filter(x => x === 3).length, v.filter(x => x === 4).length, v.filter(x => x === 5).length];
          return '<div class="svy-br"><span>' + esc(label) + "</span>" + bar([[c[0], C.s12, "1–2"], [c[1], C.s3, "3"], [c[2], C.s4, "4"], [c[3], C.s5, "5"]])
            + "<b>" + f1(avgOf(rs, k)) + "<small>/5</small></b></div>";
        }).join("") + legend([["1–2", C.s12], ["3", C.s3], ["4", C.s4], ["5", C.s5]]);
        h += '<div class="svy-row2">' + card("From send to answer", "Each step counts the emails that got at least that far.", funnel)
          + card("Scores by question", "Every answer in the period, emailed links and the public link.", rs.length ? scores : '<p class="svy-note">No answers yet.</p>') + "</div>";
        // worth / enjoyed / sources
        const w = { Yes: 0, Somewhat: 0, No: 0 }; rs.forEach(r => { if (w[r.worth] != null) w[r.worth]++; });
        const worth = '<div class="svy-big">' + pct(w.Yes, rs.length) + '</div><p class="svy-hs" style="margin:2px 0 12px">said yes, it was worth the price</p>'
          + bar([[w.Yes, C.yes, "Yes"], [w.Somewhat, C.some, "Somewhat"], [w.No, C.no, "No"]])
          + legend([["Yes " + w.Yes, C.yes], ["Somewhat " + w.Somewhat, C.some], ["No " + w.No, C.no]]);
        const en = {}; rs.forEach(r => String(r.enjoyed || "").split(",").map(x => x.trim()).filter(Boolean).forEach(x => { en[x] = (en[x] || 0) + 1; }));
        const enMax = Math.max(1, ...Object.values(en));
        const enjoyed = ENJOYED.filter(x => en[x]).sort((a, b) => en[b] - en[a]).map(x =>
          '<div class="svy-br" style="grid-template-columns:130px minmax(0,1fr) 40px"><span>' + esc(x) + "</span>" + meter(en[x], enMax, C.lime) + "<b>" + en[x] + "</b></div>").join("")
          || '<p class="svy-note">No answers yet.</p>';
        const src = {}; rs.forEach(r => { const k = r.source === "email" ? "Emailed link" : (/qr/i.test(r.source) ? "QR code" : (/site|web/i.test(r.source) ? "Website" : "Public link")); src[k] = (src[k] || 0) + 1; });
        const issues = rs.filter(r => r.issue === "Yes").length;
        const sources = Object.keys(src).sort((a, b) => src[b] - src[a]).map(k =>
          '<div class="svy-br" style="grid-template-columns:110px minmax(0,1fr) 40px"><span>' + esc(k) + "</span>" + meter(src[k], rs.length, C.ink2) + "<b>" + src[k] + "</b></div>").join("")
          + '<p class="svy-hs" style="margin:14px 0 0"><b style="color:var(--ink)">' + issues + "</b> reported an issue with the move · <b style=\"color:var(--ink)\">"
          + fromEmail + "</b> came from a personal link</p>";
        h += '<div class="svy-row3">' + card("Worth the price", "", rs.length ? worth : '<p class="svy-note">No answers yet.</p>')
          + card("What they enjoyed most", "They can pick more than one.", enjoyed)
          + card("Where answers came from", "", rs.length ? sources : '<p class="svy-note">No answers yet.</p>') + "</div>";
        // per send
        const by = {};
        S.sends.filter(s => pfOk(s, "over")).forEach(s => {
          const k = s.campaign || "—"; const b = by[k] || (by[k] = { k, at: s.sent_at || s.created_at, who: s.sent_by, n: 0, del: 0, op: 0, cl: 0, an: 0, ov: [], fl: 0, test: s.test });
          if (s.status !== "sent") return;
          b.n++; if (s.delivered_at || s.opened_at || s.clicked_at || s.answered_at) b.del++; if (s.opened_at || s.clicked_at || s.answered_at) b.op++;
          if (s.clicked_at || s.answered_at) b.cl++; if (s.answered_at) { b.an++; if (s.overall) b.ov.push(+s.overall); if (+s.flagged === 1) b.fl++; }
        });
        const sendsRows = Object.values(by).filter(b => b.n).sort((a, b) => String(b.at).localeCompare(String(a.at)));
        h += '<div class="panel" style="padding:0;margin-top:14px"><div style="padding:14px 18px 6px"><p class="svy-h">Results by send</p>'
          + '<p class="svy-hs">One row per press of Send. Answers keep coming in for days, so the latest send fills in last.</p></div>'
          + '<div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Send</th><th>By</th><th>Emails</th>'
          + "<th>Delivered</th><th>Opened</th><th>Clicked</th><th>Answered</th><th>Overall</th><th>Flagged</th></tr></thead><tbody>"
          + (sendsRows.length ? sendsRows.map(b => "<tr><td><b>" + esc(dt(b.at)) + '</b><span class="svy-sub">' + esc(b.k) + (b.test ? " · test" : "") + "</span></td>"
            + "<td>" + esc(String(b.who || "—").split("@")[0]) + "</td><td>" + b.n + "</td>"
            + "<td>" + (S.tracking ? b.del + ' <span class="svy-sub">' + pct(b.del, b.n) + "</span>" : "—") + "</td>"
            + "<td>" + (opensOn ? b.op + ' <span class="svy-sub">' + pct(b.op, b.n) + "</span>" : "—") + "</td>"
            + "<td>" + b.cl + ' <span class="svy-sub">' + pct(b.cl, b.n) + "</span></td>"
            + "<td><b>" + b.an + '</b> <span class="svy-sub">' + pct(b.an, b.n) + "</span></td>"
            + "<td>" + (b.ov.length ? (b.ov.reduce((a, c) => a + c, 0) / b.ov.length).toFixed(1) + "/5" : "—") + "</td>"
            + "<td>" + (b.fl ? '<span class="svy-flag svy-bad">' + b.fl + "</span>" : "0") + "</td></tr>").join("")
            : '<tr><td colspan="9" class="dim">Nothing sent in this period.</td></tr>') + "</tbody></table></div></div>";
        // per foreman (personal links only carry the foreman)
        const fm = {};
        rs.filter(r => r.foreman).forEach(r => { const f = fm[r.foreman] || (fm[r.foreman] = []); f.push(r); });
        const fRows = Object.keys(fm).map(k => ({ k, rs: fm[k], ov: avgOf(fm[k], "overall") })).sort((a, b) => (b.ov || 0) - (a.ov || 0) || b.rs.length - a.rs.length);
        h += '<div class="svy-row2">'
          + '<div class="panel" style="padding:0;margin:0"><div style="padding:14px 18px 6px"><p class="svy-h">By foreman</p>'
          + '<p class="svy-hs">Answers from personal links carry the move\'s foreman. Few answers swing an average, so read the count too.</p></div>'
          + '<div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr><th>Foreman</th><th>Answers</th><th>Overall</th><th>Crew</th><th>Recommend</th><th>Flagged</th></tr></thead><tbody>'
          + (fRows.length ? fRows.map(f => "<tr><td><b>" + esc(f.k) + "</b></td><td>" + f.rs.length + "</td><td>" + f1(f.ov) + "</td><td>" + f1(avgOf(f.rs, "crew"))
            + "</td><td>" + f1(avgOf(f.rs, "recommend")) + "</td><td>" + (f.rs.filter(r => +r.flagged === 1).length || "0") + "</td></tr>").join("")
            : '<tr><td colspan="6" class="dim">No answers from personal links yet.</td></tr>') + "</tbody></table></div></div>"
          + card("Latest flagged answers", "An issue, or a low mark. Open one to read everything they wrote.",
            flagged.length ? flagged.slice(0, 6).map(r => '<div style="padding:9px 0;border-top:1px solid var(--line)"><b>' + esc(r.name || "—") + "</b> "
              + '<span class="svy-sub" style="display:inline">' + esc(dt(r.submitted_at)) + "</span><div>" + '<span class="svy-flag svy-bad">' + esc(r.flag_reason || "flagged") + "</span></div>"
              + (r.issue_text ? '<div class="svy-tl">“' + esc(String(r.issue_text).slice(0, 160)) + "”</div>" : "")
              + '<span class="svy-link" data-openans="' + r.id + '" style="font-size:12px">Open the answer</span></div>').join("")
              : '<p class="svy-note">Nothing flagged in this period.</p>') + "</div>";
        return h;
      }

      // ---- SENDS -------------------------------------------------------------------------------
      function sendsVisible() {
        const q = S.sQ.trim().toLowerCase();
        return (S.sends || []).filter(s => {
          if (!pfOk(s, "sends")) return false;
          if (q && ![s.customer, s.email, s.foreman, s.state, s.campaign].some(v => String(v || "").toLowerCase().indexOf(q) >= 0)) return false;
          return true;
        });
      }
      function sendsView() {
        let h = periodBar("sends");
        if (S.sends === null) return h + '<div class="panel">Loading the sends…</div>';
        if (S.sErr) return h + '<div class="panel">Could not load the sends: ' + esc(S.sErr) + "</div>";
        const list = sendsVisible();
        const pages = Math.max(1, Math.ceil(list.length / PAGE));
        if (S.sPage >= pages) S.sPage = pages - 1;
        const slice = list.slice(S.sPage * PAGE, S.sPage * PAGE + PAGE);
        h += '<p class="svy-note">' + list.length + " of " + (S.sends || []).length + " send" + ((S.sends || []).length === 1 ? "" : "s") + " shown.</p>";
        if (!S.tracking) h += '<p class="svy-note">Delivered and opened fill in once Resend\'s webhook is connected. Clicked (they opened their link) and answered are always tracked.</p>';
        else if (!(S.sends || []).some(s => s.opened_at)) h += '<p class="svy-note">Email opens show once open tracking is switched on in Resend. Delivered, clicked (they opened their link) and answered are tracked now.</p>';
        const tl = s => [["Delivered", s.delivered_at], ["Opened", s.opened_at], ["Clicked", s.clicked_at], ["Answered", s.answered_at], ["Bounced", s.bounced_at]]
          .filter(x => x[1]).map(x => x[0] + " " + dt(x[1]).replace(" NJ", "")).join(" · ");
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Customer</th><th>Move</th><th>Foreman · score</th><th>Sent</th><th>Status</th><th>Answer</th></tr></thead><tbody>"
          + (slice.length ? slice.map(s => {
            const st = STATE[s.state_now] || [s.state_now, ""];
            return "<tr><td><b>" + esc(s.customer || "—") + '</b><span class="svy-sub">' + esc(s.email || "") + (s.test ? " · test" : "") + "</span></td>"
              + "<td>" + esc(d10(s.move_date)) + '<span class="svy-sub">' + esc(s.state || "") + "</span></td>"
              + "<td>" + esc(s.foreman || "—") + '<span class="svy-sub">' + (s.score != null ? "score " + esc(s.score) + "/10" : "") + "</span></td>"
              + "<td>" + esc(dt(s.sent_at || s.created_at)) + '<span class="svy-sub">' + esc(String(s.sent_by || "").split("@")[0]) + " · " + esc(s.campaign || "") + "</span></td>"
              + '<td><span class="svy-flag ' + st[1] + '">' + esc(st[0]) + "</span>"
              + (s.opens > 1 ? '<span class="svy-sub">opened ' + s.opens + " times</span>" : "")
              + '<div class="svy-tl">' + esc(tl(s)) + (s.error ? " · " + esc(s.error) : "") + (s.bounce_note ? " · " + esc(s.bounce_note) : "") + "</div></td>"
              + "<td>" + (s.response_id ? "<b>" + esc(s.overall) + "/5</b> overall" + (+s.flagged === 1 ? '<div><span class="svy-flag svy-bad">' + esc(s.flag_reason || "flagged") + "</span></div>" : "")
                + '<div><span class="svy-link" data-openans="' + s.response_id + '" style="font-size:12px">Open the answer</span></div>' : '<span class="svy-sub">—</span>') + "</td></tr>";
          }).join("") : '<tr><td colspan="6" class="dim">No sends match.</td></tr>')
          + "</tbody></table></div>"
          + (pages > 1 ? '<div class="rs-bar" style="padding:10px 14px"><span class="svy-sub">' + list.length + " sends</span><span class=\"rs-spacer\"></span>"
            + '<button class="rs-btn" data-spg="-1"' + (S.sPage ? "" : " disabled") + ">Previous</button><span class=\"svy-sub\">Page " + (S.sPage + 1) + " of " + pages + "</span>"
            + '<button class="rs-btn" data-spg="1"' + (S.sPage >= pages - 1 ? " disabled" : "") + ">Next</button></div>" : "")
          + "</div>";
        return h;
      }

      // ---- RESPONSES ---------------------------------------------------------------------------
      function ansVisible() {
        const q = S.aQ.trim().toLowerCase();
        return (S.ans || []).filter(r => {
          if (!pfOk(r, "ans")) return false;
          if (q && ![r.name, r.email, r.foreman, r.state, r.change_text, r.issue_text].some(v => String(v || "").toLowerCase().indexOf(q) >= 0)) return false;
          return true;
        });
      }
      function answersView() {
        let h = periodBar("ans");
        if (S.ans === null) return h + '<div class="panel">Loading the answers…</div>';
        if (S.aErr) return h + '<div class="panel">Could not load the answers: ' + esc(S.aErr) + "</div>";
        const list = ansVisible();
        const all = S.ans;
        h += '<p class="svy-note">' + list.length + " of " + all.length + " answer" + (all.length === 1 ? "" : "s") + " shown."
          // answers to test sends stay out unless switched on: say so, so a test answer never looks lost (11 Nov)
          + (!S.tests && S.aHidden ? " " + S.aHidden + " answer" + (S.aHidden === 1 ? "" : "s") + " to test sends "
            + (S.aHidden === 1 ? "is" : "are") + ' hidden. <span class="svy-link" id="svyShowTests">Show test sends</span>' : "")
          + "</p>";
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th>Answered</th><th>Customer</th><th>Move</th><th>Overall</th><th>Recommend</th><th>Booking · crew · transit</th><th>Worth it</th><th>Flag</th></tr></thead><tbody>"
          + (list.length ? list.map(r => {
            const open = S.aOpen === r.id;
            return '<tr data-open="' + r.id + '" style="cursor:pointer"><td>' + esc(dt(r.submitted_at)) + '<span class="svy-sub">'
              + esc(r.source === "email" ? "emailed link" + (r.campaign ? " · " + r.campaign : "") : (r.utm_source || "public link")) + (r.test ? " · test" : "") + "</span></td>"
              + "<td><b>" + esc(r.name || "—") + '</b><span class="svy-sub">' + esc(r.email || "") + "</span></td>"
              + "<td>" + esc(d10(r.move_date)) + '<span class="svy-sub">' + esc([r.move_type, r.state].filter(Boolean).join(" · ")) + "</span></td>"
              + "<td><b>" + esc(r.overall) + "</b>/5</td><td>" + esc(r.recommend) + "/5</td>"
              + "<td>" + [r.booking, r.crew, r.transit].map(v => esc(v)).join(" · ") + "</td><td>" + esc(r.worth || "") + "</td>"
              + "<td>" + (+r.flagged === 1 ? '<span class="svy-flag svy-bad">' + esc(r.flag_reason || "flagged") + "</span>" : "") + "</td></tr>"
              + (open ? '<tr><td colspan="8" style="padding:0"><div class="svy-ans">'
                + ans("Phone", r.phone) + ans("Enjoyed most", [r.enjoyed, r.enjoyed_other].filter(Boolean).join(" — "))
                + ans("Booking", SCALE5.booking[r.booking - 1]) + ans("Crew on moving day", SCALE5.crew[r.crew - 1])
                + ans("Kept informed in transit", SCALE5.transit[r.transit - 1]) + ans("Any issues", r.issue || "—")
                + ans("What happened", r.issue_text) + ans("What they'd change", r.change_text)
                + ans("Foreman", r.foreman) + ans("Send", r.campaign || r.utm_campaign) + "</div></td></tr>" : "");
          }).join("") : '<tr><td colspan="8" class="dim">No answers match.</td></tr>')
          + "</tbody></table></div></div>";
        return h;
      }
      const ans = (k, v) => "<div><b>" + esc(k) + "</b>" + esc(v == null || v === "" ? "—" : v) + "</div>";

      // ---- AUDIENCE (the send list) ----------------------------------------------------------
      // THE PORTAL'S FILTER LOOK (his rule, 10 Nov): one bar -- Move dates (RSC.dateRange), Find, and the
      // Filters button at its right end opening the side panel (RSC.filterPanel) -- with the "Filtered by"
      // chips under it (RSC.filterChips).
      // FIVE TABS (11 Nov, ZTZ-69, his "once someone is filtered out we need a separate list to see who is
      // filtered out, so maybe they accidentally clicked it and want to return it"): every move sits in
      // exactly one tab --
      //   Will get it           passes Tako's rule (or was added by hand), switched on
      //   Switched off          someone switched it off: who and when, and Put back
      //   Left out by the rule  rating or claim outside Tako's rule: Add anyway
      //   Can't be sent         a hard limit the server enforces whatever the page sends
      //   Already sent          one survey per move
      // TAKO'S RULE = the rating and claim choices in the panel (default 9-10, no claim): a move outside them
      // moves to "Left out by the rule" instead of vanishing. The other filters narrow every tab.
      // 13 Nov (ZTZ-83): also a final bill RISE_MIN or more over MoveBoard's quote (his "if the bill is increased
      // by 30% with estimate and final bill - then it should be excluded"; bridge/survey.py RISE_MIN) and any
      // move into storage, ours or someone else's (Tako's ask).
      const RISE_MIN = 0.30;
      const RISE_P = Math.round(100 * RISE_MIN);
      const RISE_OVER = RISE_P + "%+ over the estimate", RISE_UNDER = "Under " + RISE_P + "% over";
      const RULE = () => ({ rating: new Set(["10", "9"]), claim: new Set(["None"]),
                            rise: new Set([RISE_UNDER, "No estimate"]), storage: new Set(["No storage"]) });
      const RULE_KEYS = ["rating", "claim", "rise", "storage"];
      const AF = ["rating", "claim", "rise", "storage", "state", "mtype", "review", "surveyed"];
      if (!S.af || S.af.status) S.af = RULE();          // a tab opened before 11 Nov kept the old status filter
      else RULE_KEYS.forEach(k => { if (!S.af[k]) S.af[k] = RULE()[k]; });   // a tab opened before 13 Nov
      if (!S.atab) S.atab = "will";
      const mtypeOf = r => (String(r.move_type_code || "").toUpperCase() === "LD" ? "Long-Distance Moving" : (r.form_move_type || "Local Moving"));
      const KEYS = {
        rating: r => (r.score == null || r.score === "" ? "No score" : String(+r.score)),
        claim: r => (r.complaints || r.other_claims ? "Has a complaint" : "None"),
        rise: r => (r.bill_rise == null ? "No estimate" : r.bill_rise >= RISE_MIN - 1e-9 ? RISE_OVER : RISE_UNDER),
        storage: r => (r.storage ? "Went into storage" : "No storage"),
        state: r => r.state || "Unknown",
        mtype: mtypeOf,
        review: r => (r.review ? "Review written" : "No review"),
        surveyed: r => (r.surveyed_before ? "Surveyed before" : "Not surveyed before"),
      };
      const LABELS = { rating: "Tako's rule: foreman's rating (1–10)", claim: "Tako's rule: complaint",
                       rise: "Tako's rule: final bill vs estimate", storage: "Tako's rule: storage", state: "State",
                       mtype: "Move type", review: "Review", surveyed: "Surveyed before" };
      const ORDER = { rating: ["10", "9", "8", "7", "6", "5", "4", "3", "2", "1", "0", "No score"] };
      const rank = (ord, v) => { const i = ord.indexOf(v); return i < 0 ? 999 : i; };
      const ATABS = [["will", "Will get it"], ["off", "Switched off"], ["rule", "Left out by the rule"],
                     ["cant", "Can't be sent"], ["sent", "Already sent"]];
      const ATAB_NOTE = {
        will: "These get the survey when you press Send. Switch someone off and they move to Switched off, where you can put them back.",
        off: "Switched off by hand, with who did it and when. Put them back any time before the send.",
        rule: "Tako's rule leaves these out (the rating, a complaint, a final bill " + RISE_P + "% or more over the estimate, or a move into storage). Add one by hand to ask them anyway.",
        cant: "These can never get it, whatever anyone picks: long distance, no email, unsubscribed, or under 14 days since the move.",
        sent: "One survey per move: these already got theirs. Each send's results are on the Sends tab.",
      };
      function afFields(rows) {
        return AF.map(k => {
          const n = {};
          rows.forEach(r => { const v = KEYS[k](r); n[v] = (n[v] || 0) + 1; });
          (S.af[k] || new Set()).forEach(v => { if (!(v in n)) n[v] = 0; });     // a picked value never vanishes
          const ord = ORDER[k];
          const vals = Object.keys(n).sort((a, b) => (ord ? rank(ord, a) - rank(ord, b) : 0) || (n[b] - n[a]) || a.localeCompare(b));
          return { key: k, label: LABELS[k], values: vals.map(v => ({ v, l: v, n: n[v] })) };
        });
      }
      const setKey = st => [...(st || [])].sort().join("|");
      const isRule = () => RULE_KEYS.every(k => setKey(S.af[k]) === setKey(RULE()[k]));
      const passRule = r => RULE_KEYS.every(k => { const set = S.af[k]; return !set || !set.size || set.has(KEYS[k](r)); });
      const isSent = r => r.invite_status === "sent" || r.invite_status === "sending";
      const tabOf = r => (isSent(r) ? "sent" : r.hard.length ? "cant" : r.off ? "off" : (r.added || passRule(r)) ? "will" : "rule");
      function visible(rows) {
        const q = S.q.trim().toLowerCase();
        return rows.filter(r => {
          for (const k of AF) {
            if (RULE_KEYS.indexOf(k) >= 0) continue;          // the rule sorts into tabs, it hides nobody
            const set = S.af[k]; if (set && set.size && !set.has(KEYS[k](r))) return false;
          }
          if (q && ![r.customer, r.email, r.foreman, r.job_no, r.state].some(v => String(v || "").toLowerCase().indexOf(q) >= 0)) return false;
          return true;
        });
      }
      const sendable = r => tabOf(r) === "will";
      const me = () => (window.ME && ME.email) || "";
      const whoWhen = (by, at) => [by ? "by " + String(by).split("@")[0] : "", at ? dt(at) : ""].filter(Boolean).join(", ");
      function ruleWhy(r) {
        const out = [];
        if (S.af.rating && S.af.rating.size && !S.af.rating.has(KEYS.rating(r))) out.push(r.score == null ? "no rating" : "rating " + r.score);
        if (S.af.claim && S.af.claim.size && !S.af.claim.has(KEYS.claim(r))) out.push(r.complaints ? claimText(r) : otherClaimText(r));
        if (S.af.rise && S.af.rise.size && !S.af.rise.has(KEYS.rise(r))) out.push(riseText(r));
        if (S.af.storage && S.af.storage.size && !S.af.storage.has(KEYS.storage(r))) out.push(r.storage ? "storage: " + r.storage : "no storage");
        return out.join(" · ");
      }
      // "bill 192% over the estimate ($5,783 vs $1,978)": the final bill against MoveBoard's quote (ZTZ-83)
      const usd = v => "$" + Math.round(+v || 0).toLocaleString("en-US");
      const riseText = r => (r.bill_rise == null ? "no estimate to compare"
        : "bill " + (r.bill_rise >= 0 ? Math.round(100 * r.bill_rise) + "% over" : Math.round(-100 * r.bill_rise) + "% under")
          + " the estimate (" + usd(r.bill) + " vs " + usd(r.quote) + ")");
      // ("complaint", not "claim": his word, 12 Nov)
      // a claim on the customer's OTHER move, found by their email or phone (12 Nov, ZTZ-78: a refunded claim on
      // the first move did not keep the clean second move out, and Tako took him out by hand)
      const claimText = r => "complaint" + (r.complaint_status ? ": " + r.complaint_status : "");
      const monthYear = v => { const d = v ? new Date(String(v).slice(0, 10) + "T12:00:00Z") : null;
        return d && !isNaN(d) ? d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }) : ""; };
      const otherClaimText = r => "complaint on another move" + (monthYear(r.other_claim_date) ? " (" + monthYear(r.other_claim_date) + ")" : "")
        + (r.other_claim_status ? ": " + r.other_claim_status : "");
      const flagsHtml = (r, noClaim) => (r.complaints && !noClaim ? '<span class="svy-flag svy-bad">' + esc(claimText(r)) + "</span>" : "")
        + (r.other_claims && !noClaim ? '<span class="svy-flag svy-bad">' + esc(otherClaimText(r)) + "</span>" : "")
        + (r.flags || []).map(f => '<span class="svy-flag">' + esc(f) + "</span>").join("")
        + (r.surveyed_before ? '<span class="svy-flag">surveyed before</span>' : "");
      function noteCell(r, tab) {
        if (tab === "sent") return r.invite_status === "sent" ? '<span class="svy-flag svy-ok">Sent ' + esc(d10(r.sent_at)) + "</span>" : '<span class="svy-flag">Sending…</span>';
        if (tab === "cant") return '<span class="svy-flag svy-bad">' + esc(r.hard.join(", ")) + "</span>" + flagsHtml(r);
        if (tab === "off") return "<b>Switched off</b>" + '<span class="svy-sub">' + esc(whoWhen(r.off_by, r.off_at)) + "</span>";
        if (tab === "rule") return '<span class="svy-flag svy-mute">' + esc(ruleWhy(r)) + "</span>" + flagsHtml(r, true);   // the claim is already the reason
        return (r.added ? '<span class="svy-flag svy-blue">added by hand' + (r.added_by ? " " + esc(whoWhen(r.added_by, r.added_at)) : "") + "</span>" : "")
          + flagsHtml(r) + (r.invite_status === "failed" ? '<span class="svy-sub">last send failed, will retry</span>' : "");
      }
      function actCell(r, tab) {
        const nm = esc(r.customer || "this customer");
        if (tab === "will") return '<input type="checkbox" class="svy-sw" data-off="' + esc(r.job_key) + '" checked aria-label="Switch off ' + nm + '">'
          + (r.added && !passRule(r) ? '<button type="button" class="svy-mini" data-add="0" data-key="' + esc(r.job_key) + '">Take out</button>' : "");
        if (tab === "off") return '<button type="button" class="rs-btn" data-back="' + esc(r.job_key) + '">Put back</button>';
        if (tab === "rule") return '<button type="button" class="rs-btn" data-add="1" data-key="' + esc(r.job_key) + '">Add anyway</button>';
        return "";
      }
      // "List updated Nov 12, 11:33 AM NJ · next update about 12:35 PM NJ": the moves, scores, claims and emails
      // come from the loader's hourly run; sends, switches and answers below are live.
      const hmNJ = v => { const d = v ? new Date(v) : null;
        return d && !isNaN(d) ? d.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }) + " NJ" : ""; };
      function ageHtml() {
        const a = S.age; if (!a || !a.at) return "";
        const when = a.live ? "List read live just now (the hourly update is late)"
          : "List updated " + dt(a.at) + " · " + (a.due ? "next update any minute" : "next update about " + hmNJ(a.next));
        return '<p class="svy-note svy-age" title="Moves, ratings, complaints and emails update every hour. Sends, switch-offs and answers show at once.">'
          + esc(when) + ". It updates every hour; switch-offs and sends show at once.</p>";
      }
      function listView() {
        if (S.rows === null) return '<div class="rs-bar" id="svyABar"></div><div class="panel">Loading the moves…</div>';
        if (S.err) return '<div class="rs-bar" id="svyABar"></div><div class="panel">Could not load the list: ' + esc(S.err)
          + ' <button class="rs-btn" data-retry="list" style="margin-left:10px">Try again</button></div>';
        const shown = visible(S.rows);
        const count = {}; ATABS.forEach(([k]) => { count[k] = 0; });
        shown.forEach(r => { count[tabOf(r)] += 1; });
        const willSend = shown.filter(sendable);
        const inTab = shown.filter(r => tabOf(r) === S.atab);
        const pages = Math.max(1, Math.ceil(inTab.length / PAGE));
        if (S.page >= pages) S.page = pages - 1;
        const slice = inTab.slice(S.page * PAGE, S.page * PAGE + PAGE);
        let h = '<div class="rs-bar" id="svyABar"></div><div id="svyAChips"></div>';
        h += '<div class="svy-atabs" role="tablist" aria-label="Who gets the survey">' + ATABS.map(([k, l]) =>
          '<button type="button" role="tab" class="svy-atab' + (S.atab === k ? " on" : "") + '" aria-selected="' + (S.atab === k) + '" data-atab="' + k + '">'
          + esc(l) + ' <span class="n">' + count[k] + "</span></button>").join("")
          + '<span class="rs-spacer"></span>'
          + (S.resend ? "" : '<span class="svy-sub" style="margin-right:10px">Sending opens once the bridge has the Resend key.</span>')
          + '<button class="rs-btn pri" id="svySend"' + (willSend.length && S.resend && !S.busy ? "" : " disabled") + ">Send to "
          + Math.min(willSend.length, MAX_PER_SEND) + " customer" + (willSend.length === 1 ? "" : "s")
          + (willSend.length > MAX_PER_SEND ? " (of " + willSend.length + ")" : "") + "</button></div>";
        h += '<p class="svy-note">' + esc(ATAB_NOTE[S.atab]) + " "
          + (isRule() ? "Tako's rule: rating 9–10, nothing on the Claims / Complaints board for any of the customer's moves."
            : "The rule is changed from Tako's. <span class=\"svy-link\" id=\"svyRule\">Back to Tako's rule</span>")
          + "</p>";
        h += ageHtml();
        if (S.msg) h += '<p class="svy-note" role="status" style="color:' + (S.msgErr ? "var(--neg)" : "var(--pos)") + '">' + esc(S.msg) + "</p>";
        const sentTab = S.atab === "sent";
        h += '<div class="panel" style="padding:0"><div class="rs-tablewrap" style="border:0"><table class="rs-table rs-even"><thead><tr>'
          + "<th></th><th>Customer</th><th>Move</th><th>Foreman · rating</th><th>Review</th><th>"
          + ({ will: "Notes", off: "Switched off", rule: "Why it's left out", cant: "Why it can't go", sent: "Status" }[S.atab]) + "</th></tr></thead><tbody>"
          + (slice.length ? slice.map(r => '<tr class="' + (S.atab === "cant" || sentTab ? "svy-dim" : "") + '">'
              + '<td class="svy-act">' + actCell(r, S.atab) + "</td>"
              + "<td><b>" + esc(r.customer || "—") + '</b><span class="svy-sub">' + esc(r.email || "no email") + "</span></td>"
              + "<td>" + esc(d10(r.move_date)) + '<span class="svy-sub">' + esc([r.state, mtypeOf(r)].filter(Boolean).join(" · ")) + "</span></td>"
              + "<td>" + esc(r.foreman || "—") + '<span class="svy-sub">rating ' + esc(r.score == null ? "—" : r.score) + "/10</span></td>"
              + "<td>" + (r.review ? "Yes" : "No") + "</td>"
              + "<td>" + noteCell(r, S.atab) + "</td></tr>").join("")
            : '<tr><td colspan="6" class="dim">' + ({ off: "Nobody is switched off.", rule: "Nobody is left out by the rule.", sent: "Nothing sent in these dates yet." }[S.atab] || "Nobody here.") + "</td></tr>")
          + "</tbody></table></div>"
          + (pages > 1 ? '<div class="rs-bar" style="padding:10px 14px"><span class="svy-sub">' + inTab.length + " moves</span><span class=\"rs-spacer\"></span>"
            + '<button class="rs-btn" data-pg="-1"' + (S.page ? "" : " disabled") + ">Previous</button><span class=\"svy-sub\">Page " + (S.page + 1) + " of " + pages + "</span>"
            + '<button class="rs-btn" data-pg="1"' + (S.page >= pages - 1 ? " disabled" : "") + ">Next</button></div>" : "")
          + "</div>";
        return h;
      }
      // a small "done, Undo" note at the bottom of the screen (outside the page's box, so a repaint keeps it)
      function toast(text, undo) {
        const old = document.getElementById("svyToast"); if (old) old.remove();
        const t = document.createElement("div");
        t.id = "svyToast"; t.className = "svy-toast"; t.setAttribute("role", "status");
        t.innerHTML = "<span>" + esc(text) + "</span>" + (undo ? '<button type="button" class="u">Undo</button>' : "")
          + '<button type="button" class="x" aria-label="Close">✕</button>';
        document.body.appendChild(t);
        const close = () => { clearTimeout(t._t); t.remove(); };
        t.querySelector(".x").onclick = close;
        if (undo) t.querySelector(".u").onclick = () => { close(); undo(); };
        t._t = setTimeout(close, 10000);
      }
      function setOff(k, off, quiet) {
        const r = S.rows.find(x => x.job_key === k); if (!r) return Promise.resolve();
        return post({ action: "off", job_key: k, off }).then(() => {
          r.off = off; r.off_by = off ? me() : null; r.off_at = off ? new Date().toISOString() : null; paint();
          if (!quiet) toast(off ? (r.customer || "They") + " is switched off: find them under Switched off." : (r.customer || "They") + " will get it again.",
                            () => setOff(k, !off, true));
        }).catch(e => { say("Could not switch it " + (off ? "off" : "on") + ": " + (e.message || String(e)), true); paint(); });
      }
      function setAdd(k, add, quiet) {
        const r = S.rows.find(x => x.job_key === k); if (!r) return Promise.resolve();
        return post({ action: "add", job_key: k, add }).then(() => {
          r.added = add; r.added_by = add ? me() : null; r.added_at = add ? new Date().toISOString() : null; paint();
          if (!quiet) toast(add ? (r.customer || "They") + " is added: they're under Will get it." : (r.customer || "They") + " is back under Left out by the rule.",
                            () => setAdd(k, !add, true));
        }).catch(e => { say("Could not " + (add ? "add" : "take out") + " the move: " + (e.message || String(e)), true); paint(); });
      }
      // the bar is built from the kit's own components once the HTML is in place
      function mountAudienceBar() {
        const bar = host.querySelector("#svyABar");
        if (!bar || !window.RSC) return;
        const fld = label => { const w = document.createElement("div"); w.className = "rs-fld"; w.innerHTML = "<span>" + label + "</span>"; bar.appendChild(w); return w; };
        if (RSC.dateRange) RSC.dateRange(fld("Move dates"), {
          get: () => ({ from: S.lo, to: S.hi }), set: (f, t) => { S.lo = f || ""; S.hi = t || ""; },
          onChange: () => { S.page = 0; loadList(); } });
        const q = document.createElement("input");
        q.className = "rs-inp"; q.id = "svyQ"; q.placeholder = "Find a customer, email, foreman…"; q.value = S.q; q.style.flex = "0 1 260px";
        q.setAttribute("aria-label", "Find a customer, email or foreman");
        let qt = null;
        q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { S.q = q.value; S.page = 0; S._focusQ = 1; paint(); }, 300); };
        bar.appendChild(q);
        const sp = document.createElement("span"); sp.className = "rs-spacer"; bar.appendChild(sp);
        if (S.rows && RSC.filterPanel) {
          const fields = afFields(S.rows);
          const apply = next => { AF.forEach(k => { S.af[k] = new Set(next[k] || []); }); S.page = 0; paint(); };
          RSC.filterPanel(bar, { fields, selected: S.af, onApply: apply,
            note: "<b>Tako's rule</b> is the rating, the complaint, the bill and the storage choice (9–10, no complaint, a final bill under "
              + RISE_P + "% over the estimate, no storage). A move outside it moves to "
              + "<b>Left out by the rule</b>, where you can add it by hand. The other filters narrow every tab. "
              + "Long-distance moves, no email, unsubscribed and already surveyed can never be sent, whatever you pick." });
          const chips = host.querySelector("#svyAChips");
          if (chips && RSC.filterChips) RSC.filterChips(chips, { fields, selected: S.af, onChange: apply });
        }
        if (S._focusQ) { S._focusQ = 0; q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
      }

      // ---- EMAIL -------------------------------------------------------------------------------
      function emailView() {
        if (!S.design) return S.tplErr ? '<div class="panel">Could not load the email: ' + esc(S.tplErr)
          + ' <button class="rs-btn" data-retry="email" style="margin-left:10px">Try again</button></div>'
          : '<div class="panel">Loading the email…</div>';
        // THE EDITOR (12 Nov, ZTZ-69 step 3): one editor for the survey and every automation. Sending, personal
        // links and tracking are unchanged: a link set to "their own survey" carries the personal link.
        return '<div id="svyDesigner"></div>';
      }
      const designChanged = () => !!S.design && !!S.liveDesign && JSON.stringify(S.design) !== JSON.stringify(S.liveDesign);
      const hasDraft = () => designChanged() || !!S.draftAt;
      const who = e => String(e || "").split("@")[0].replace(/^./, c => c.toUpperCase());
      function liveMeta() {
        const t = S.tpl || {};
        return "From survey@mail.ziptozip.app" + (t.updated_by ? " · Live version saved by " + who(t.updated_by) + ", " + dt(t.updated_at) : "");
      }
      function saveNote() {
        if (S.draftSave === "saving") return "Saving your changes…";
        if (S.draftSave === "error") return "Your changes are NOT saved: " + (S.draftErr || "try again");
        return S.draftAt ? "Changes saved " + dt(S.draftAt) + (S.draftBy ? " by " + who(S.draftBy) : "") : "";
      }
      // the editor's edits save by themselves as the waiting draft (nothing sends from it)
      let draftT = null, draftBusy = null;
      function saveDraft() {
        clearTimeout(draftT);
        draftT = setTimeout(() => {
          if (draftBusy) { saveDraft(); return; }
          S.draftSave = "saving"; if (S.ed) S.ed.setSave(saveNote());
          draftBusy = post({ action: "draft", design: S.design }).then(j => {
            draftBusy = null; S.draftSave = ""; S.draftAt = j.draft_at || ""; S.draftBy = j.draft_by || "";
            if (S.ed) S.ed.setSave(saveNote());
          }).catch(e => { draftBusy = null; S.draftSave = "error"; S.draftErr = e.message || String(e); if (S.ed) S.ed.setSave(saveNote()); });
        }, 1200);
      }
      function flushDraft() { clearTimeout(draftT); return draftBusy || Promise.resolve(); }
      function mountDesigner() {
        const el = host.querySelector("#svyDesigner");
        if (!el || !window.EMAILDESIGNER || !S.design) return;
        const adminPost = body => api("/api/_emailadmin", { method: "POST", body: JSON.stringify(body) });
        const full = () => Object.assign({}, S.draft, { design: S.design });
        if (!S.emdUi) S.emdUi = { testTo: S.testTo };
        S.ed = EMAILDESIGNER.mount(el, {
          template: S.design, live: S.tpl && S.tpl.design ? S.liveDesign : {}, kit: S.kit || {}, survey: true, category: "survey", designs: false,
          ui: S.emdUi,
          head: {
            title: "Customer survey email", pills: [["Live · asks first", "ok"]], meta: liveMeta(), save: saveNote(), testTo: S.testTo,
            msg: S.msg, msgBad: S.msgErr,
            testNote: "A test carries a real personal link: open the survey and answer it like a customer. It goes to you or a company inbox only, and stays out of every count.",
            onTest: to => {
              if (!S.resend) return Promise.reject(new Error("Sending isn't set up on the server yet."));
              S.testTo = to;
              return post({ action: "test", template: full(), to }).then(j => { S.sends = null; S.ans = null; S.testedAt = new Date(); S.testedJson = JSON.stringify(S.design);
                return "Test sent to " + j.to + ". Open it and press its button."; });
            },
            tested: () => (S.testedJson && S.testedJson === JSON.stringify(S.design) ? ["ok", "Test of this version sent " + dt(S.testedAt.toISOString())]
              : designChanged() ? ["warn", "No test of these changes yet"] : null),
            onDiscard: () => flushDraft().then(() => post({ action: "discard" })).then(() => {
              S.design = JSON.parse(JSON.stringify(S.liveDesign)); S.draftAt = ""; S.draftBy = ""; S.emdUi.sel = null;
              say("Changes discarded: the email is the live version again."); paint(); }),
            onLive: () => flushDraft().then(() => post({ action: "template", template: full() })).then(j => {
              S.tpl = j.template; S.draftAt = ""; S.draftBy = "";
              if (j.template.design) { S.liveDesign = JSON.parse(JSON.stringify(j.template.design)); S.design = JSON.parse(JSON.stringify(j.template.design)); }
              say("Live. The next survey send uses this email."); paint(); }),
          },
          preview: t => post({ action: "preview", template: Object.assign({}, S.draft, { design: t }) }),
          upload: EMAILDESIGNER.uploader(adminPost),
          pictures: EMAILDESIGNER.picturesApi(path => api(path), adminPost),
          onChange: () => { if (S.msg) say(""); saveDraft(); },
        });
      }

      // ---- paint + wire ------------------------------------------------------------------------
      const TABS = [["over", "Overview"], ["list", "Audience"], ["sends", "Sends"], ["ans", "Responses"], ["email", "Email"]];
      // THE PAGE STANDARD (ZTZ-80): the kit head (the page had no title of its own), the explanations in
      // "How it's counted", and the five views as the kit's underline tabs (same data-tab, same go()).
      // "Who gets it" reads the Audience's own tab notes, so the left-out wording stays in one place.
      const howHtml = () => "<h3>From send to answer</h3><p>Each step counts the emails that got at least that far. "
        + "Delivered and opened fill in once Resend's webhook is connected; email opens show once open tracking is switched on "
        + "in Resend (mail.ziptozip.app). Clicked (they opened their link) and answered are always exact: every emailed link is personal.</p>"
        + "<h3>Who gets it</h3><ul>" + ATABS.map(([k, l]) => "<li><b>" + esc(l) + "</b>: " + esc(ATAB_NOTE[k]) + "</li>").join("") + "</ul>"
        + "<p>Nothing sends by itself: one press of Send mails at most " + MAX_PER_SEND + " customers, and each move can get it only once.</p>"
        + "<h3>When the list updates</h3><p>Moves, ratings, complaints and emails update every hour. Sends, switch-offs and answers show at once.</p>"
        + "<h3>Test sends</h3><p>Test sends (to you or a company inbox) stay out of every count unless switched on in Filters. "
        + "A test carries a real personal link: open the survey and answer it like a customer.</p>"
        + "<h3>By foreman</h3><p>Answers from personal links carry the move's foreman. Few answers swing an average, so read the count too.</p>";
      function paint() {
        if (!alive()) return;
        const v = S.tab === "over" ? overView() : S.tab === "list" ? listView() : S.tab === "sends" ? sendsView()
          : S.tab === "ans" ? answersView() : emailView();
        // the survey is automation #1 on Email Automations (10 Nov, ZTZ-60) and opens from its card there
        host.innerHTML = '<div class="svy"><a class="svy-link svy-back" href="#page=email-automations">&larr; Email Automations</a>'
          + RSC.pageHeadHtml({ title: "Customer Survey", key: "surveys",
              sub: "Tako's feedback survey by email: the results, who gets it, every send and answer, and the email itself.", how: howHtml })
          + RSC.tabsHtml(TABS.map(t => ({ id: t[0], label: t[1] })), S.tab, "tab") + v + "</div>";
        wire();
      }
      function go(tab) {
        S.tab = tab; say("");
        if ((tab === "over" || tab === "sends" || tab === "ans") && (S.sends === null || S.ans === null)) loadPeriod();
        else if (tab === "list" && (S.rows === null || S.err)) loadList();
        else if (tab === "email" && !S.design) loadTemplate();
        else paint();
      }

      function wire() {
        host.querySelectorAll("[data-tab]").forEach(b => { b.onclick = () => go(b.dataset.tab); });
        host.querySelectorAll("[data-go]").forEach(b => { b.onclick = () => go(b.dataset.go); });
        host.querySelectorAll("[data-retry]").forEach(b => { b.onclick = () => {
          if (b.dataset.retry === "list") loadList(); else { S.tplErr = ""; paint(); loadTemplate(); } }; });
        // the shared period (overview, sends, responses)
        if (S.tab === "over" || S.tab === "sends" || S.tab === "ans") mountPeriodBar();
        host.querySelectorAll("[data-openans]").forEach(b => { b.onclick = () => { S.aOpen = +b.dataset.openans; ["flag", "source", "overall"].forEach(k => { S.pf[k] = new Set(); }); S.aQ = ""; go("ans"); }; });
        // sends
        host.querySelectorAll("[data-spg]").forEach(b => { b.onclick = () => { S.sPage += +b.dataset.spg; paint(); }; });
        // responses
        host.querySelectorAll("[data-open]").forEach(tr => { tr.onclick = () => { const id = +tr.dataset.open; S.aOpen = S.aOpen === id ? null : id; paint(); }; });
        const st = host.querySelector("#svyShowTests"); if (st) st.onclick = () => { S.tests = true; loadPeriod(); };
        // audience
        if (S.tab === "list") mountAudienceBar();
        const rb = host.querySelector("#svyRule"); if (rb) rb.onclick = () => { S.af = RULE(); S.page = 0; paint(); };
        host.querySelectorAll("[data-pg]").forEach(b => { b.onclick = () => { S.page += +b.dataset.pg; paint(); }; });
        host.querySelectorAll("[data-atab]").forEach(b => { b.onclick = () => { S.atab = b.dataset.atab; S.page = 0; say(""); paint(); }; });
        host.querySelectorAll("[data-off]").forEach(cb => { cb.onchange = () => { cb.disabled = true; setOff(cb.dataset.off, !cb.checked); }; });
        host.querySelectorAll("[data-back]").forEach(b => { b.onclick = () => { b.disabled = true; setOff(b.dataset.back, false); }; });
        host.querySelectorAll("[data-add]").forEach(b => { b.onclick = () => { b.disabled = true; setAdd(b.dataset.key, b.dataset.add === "1"); }; });
        const sb = host.querySelector("#svySend");
        if (sb) sb.onclick = () => {
          const all = visible(S.rows).filter(sendable);
          if (!all.length) return;
          const list = all.slice(0, MAX_PER_SEND);
          const unsaved = hasDraft();
          if (!confirm("Send the survey to " + list.length + " customer" + (list.length === 1 ? "" : "s") + " now? Each move can get it only once."
            + (all.length > list.length ? "\n\nOne press sends at most " + MAX_PER_SEND + "; the other " + (all.length - list.length) + " stay on the list for the next press." : "")
            + (unsaved ? "\n\nYour email changes are not live yet: this send uses the live email." : ""))) return;
          S.busy = true; say("Sending…"); paint();
          post({ action: "send", job_keys: list.map(r => r.job_key) }).then(j => {
            S.busy = false; S.sends = null; S.ans = null;
            say("Sent " + j.sent + (j.failed ? ", " + j.failed + " failed" : "") + (j.skipped && j.skipped.length ? ", " + j.skipped.length + " skipped" : "")
              + (all.length > list.length ? " · " + (all.length - list.length) + " still to send: press Send again" : "") + " · send " + j.campaign, !!j.failed);
            loadList();
          }).catch(e => { S.busy = false; say(e.message || String(e), true); loadList(); });   // the list shows what really went
        };
        // email (the editor mounts after the paint)
        if (S.tab === "email") mountDesigner();
      }

      function csv(which) {
        const rs = which === "sends" ? sendsVisible() : ansVisible();
        const cols = which === "sends"
          ? ["customer", "email", "move_date", "state", "foreman", "score", "campaign", "sent_at", "sent_by", "state_now", "delivered_at",
             "opened_at", "opens", "clicked_at", "clicks", "bounced_at", "bounce_note", "answered_at", "overall", "recommend", "flag_reason", "error"]
          : ["submitted_at", "source", "campaign", "name", "email", "phone", "move_date", "move_type", "state", "foreman", "enjoyed", "enjoyed_other",
             "booking", "crew", "transit", "worth", "issue", "issue_text", "overall", "recommend", "change_text", "flag_reason", "utm_source",
             "utm_medium", "utm_campaign"];
        const cell = x => { let s = String(x == null ? "" : x); if (/^[=+\-@]/.test(s)) s = " " + s; return '"' + s.replace(/"/g, '""') + '"'; };
        const lines = [cols.join(",")].concat(rs.map(r => cols.map(c => cell(r[c])).join(",")));
        const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
        const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
        a.download = "customer-survey-" + (which === "sends" ? "sends" : "answers") + "-" + iso(new Date()) + ".csv";
        document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      }

      // Email Automations' survey card opens a tab directly ("Review and send" = Audience, "Edit the email")
      if (window.__SVY_OPEN_TAB) { S.tab = window.__SVY_OPEN_TAB; window.__SVY_OPEN_TAB = null; }
      go(S.tab);
      if (S.tab !== "email") api("/api/_surveyadmin?view=template").then(j => { S.resend = !!j.resend; S.tracking = !!j.tracking || S.tracking; }).catch(() => {});
    },
  });
})();
