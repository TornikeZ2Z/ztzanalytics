/* MARKETING AUTOMATIONS page: Quick Responses (report id quick-responses; tracker ZTZ-72, 19 Nov 2026).
   The Reddit finder (src/reddit_watch.py, the loader) reads Elene's daily-watch subreddits and Reddit-wide mentions of
   us every hour and keeps the move requests her five rules catch, one per thread. Each one also goes to Slack
   #quick-responses. A real, happy customer -- the recommender -- writes the reply in their own words; Elene presses
   Posted. The finder also spots the recommender's own reply in the thread and logs it.
   This page: the requests with their facts, talking points and tracked link (ziptozip.systems/go/?c=..., which counts
   the clicks), Posted / Skip / Reopen, and the numbers. DATA PATH: /api/_quickresp only (bridge/quick_responses.py).
   It never posts to Reddit and never writes a reply in anyone's name (his pick, 19 Nov: "Finder; they post"). */
(() => {
  const esc = s => RSC.esc(s == null ? "" : String(s));
  const S = { data: null, err: "", tab: "new", msg: "" };
  const RULES = { brand: ["Names us", "qr-brand"], recommendation: ["Asks for a mover", "qr-rec"], urgent: ["Urgent", "qr-urg"],
                  "service question": ["Service question", "qr-svc"], "follow-on": ["Follow-on comment", "qr-fol"] };
  const TABS = [["new", "To answer"], ["posted", "Posted"], ["skipped", "Skipped"], ["all", "All"]];
  const dt = v => {
    if (!v) return "";
    const d = new Date(String(v).replace(" ", "T") + (/[zZ]$/.test(String(v)) ? "" : "Z"));
    return isNaN(d) ? String(v) : d.toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " NJ";
  };
  const short = e => String(e || "").replace(/^slack:/, "").split("@")[0];
  // ZTZ.api is GET-only: the three buttons POST with the same sign-in
  const post = body => fetch(ZTZ.API + "/api/_quickresp", { method: "POST", body: JSON.stringify(body),
    headers: { Authorization: "Bearer " + ZTZ.getToken(), "Content-Type": "application/json" } })
    .then(r => r.json().then(j => { if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status)); return j; }));

  function injectStyle() {
    if (document.getElementById("qr-style")) return;
    const st = document.createElement("style");
    st.id = "qr-style";
    st.textContent = ""
      + ".qr-note{font-size:13px;color:var(--muted);margin:6px 2px 12px;line-height:1.5}"
      + ".qr-banner{border:1px solid var(--line);border-left:4px solid #d97706;border-radius:12px;padding:12px 16px;margin:0 0 14px;background:var(--panel);font-size:13.5px;line-height:1.5}"
      + ".qr-banner b{color:var(--ink)}"
      + ".qr-card{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 12px}"
      + ".qr-card.qr-open{border-left:4px solid #2563eb}"
      + ".qr-h{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:baseline;margin:0 0 6px;font-size:12.5px;color:var(--muted)}"
      + ".qr-chip{display:inline-block;font-size:12px;font-weight:600;padding:2px 9px;border-radius:99px;background:var(--panel-2);color:var(--ink)}"
      + ".qr-brand{background:rgba(141,177,60,.2);color:#4d6b12}.qr-rec{background:rgba(37,99,235,.11);color:#1d4ed8}"
      + ".qr-urg{background:rgba(220,38,38,.12);color:#b91c1c}.qr-svc{background:rgba(217,119,6,.13);color:#b45309}"
      + ".qr-fol{background:var(--panel-2);color:var(--muted)}"
      + ".qr-t{font-size:15px;font-weight:700;color:var(--ink);text-decoration:none}"
      + ".qr-t:hover{text-decoration:underline}"
      + ".qr-x{margin:6px 0 8px;padding:8px 12px;border-radius:10px;background:var(--panel-2);font-size:13.5px;line-height:1.5;color:var(--ink);white-space:pre-wrap;max-height:9em;overflow:hidden}"
      + ".qr-f{font-size:13px;color:var(--ink);margin:4px 0}"
      + ".qr-f span{color:var(--muted)}"
      + ".qr-pts{margin:6px 0 4px 18px;padding:0;font-size:13px;line-height:1.55}"
      + ".qr-link{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0 0;font-size:13px}"
      + ".qr-link code{font-size:12.5px;padding:3px 8px;border-radius:8px;background:var(--panel-2);word-break:break-all}"
      + ".qr-foot{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--line);font-size:13px}"
      + ".qr-foot .who{color:var(--muted)}";
    document.head.appendChild(st);
  }

  function banner(d) {
    const bits = [];
    if (d.mode === "off") bits.push("<b>The finder is off.</b> It starts once Reddit is connected (a one-time read-only sign-in) and its mode is set to test or live.");
    else if (d.mode === "test") bits.push("<b>Test mode:</b> requests are found and stored here; nothing goes to Slack yet.");
    if (d.mode === "live" && !d.slack) bits.push("<b>No Slack channel yet:</b> requests show here only until #quick-responses is connected.");
    if (!d.recommender) bits.push("The recommender's Reddit username isn't set, so their replies aren't spotted automatically yet: press <b>Posted</b> by hand.");
    return bits.length ? '<div class="qr-banner">' + bits.join("<br>") + "</div>" : "";
  }

  function card(r) {
    const [lab, cls] = RULES[r.rule] || [r.rule, "qr-fol"];
    const f = r.facts || {}, pts = r.points || [];
    const need = [f.route && "route " + f.route, f.size, f.when, (f.needs || []).join(", "), (f.states || []).join("/")].filter(Boolean);
    const link = S.data.link_base + r.code;
    let foot;
    if (r.status === "posted") foot = '<span class="qr-chip qr-brand">Posted</span><span class="who">' + esc(short(r.by_email)) + (r.status_at ? ", " + esc(dt(r.status_at)) : "") + "</span>"
      + (r.reply_link ? '<a href="' + esc(r.reply_link) + '" target="_blank" rel="noopener">Their reply</a>' : "")
      + '<button type="button" class="rs-btn" data-qr="reopen" data-id="' + esc(r.fullname) + '">Reopen</button>';
    else if (r.status === "skipped") foot = '<span class="qr-chip">Skipped</span><span class="who">' + esc(short(r.by_email)) + (r.status_at ? ", " + esc(dt(r.status_at)) : "") + "</span>"
      + '<button type="button" class="rs-btn" data-qr="reopen" data-id="' + esc(r.fullname) + '">Reopen</button>';
    else foot = '<button type="button" class="rs-btn pri" data-qr="posted" data-id="' + esc(r.fullname) + '">Posted</button>'
      + '<button type="button" class="rs-btn" data-qr="skip" data-id="' + esc(r.fullname) + '">Skip</button>';
    return '<div class="qr-card' + (r.status === "new" ? " qr-open" : "") + '"><div class="qr-h"><span class="qr-chip ' + cls + '">' + esc(lab) + "</span>"
      + "<span>r/" + esc(r.subreddit) + " · " + (r.kind === "comment" ? "a comment" : "a post") + (r.author ? " by u/" + esc(r.author) : "") + "</span>"
      + "<span>found " + esc(dt(r.found_at)) + "</span></div>"
      + '<a class="qr-t" href="' + esc(r.link) + '" target="_blank" rel="noopener">' + esc(r.title || "Open on Reddit") + "</a>"
      + '<div class="qr-x">' + esc(r.body || "") + "</div>"
      + '<div class="qr-f"><span>What they need:</span> ' + esc(need.join(" · ") || "see the post") + '  <span>· Why it matched:</span> ' + esc(r.why || "") + "</div>"
      + (pts.length ? '<div class="qr-f"><span>Talking points (the recommender writes the reply in their own words):</span></div><ul class="qr-pts">' + pts.map(p => "<li>" + esc(p) + "</li>").join("") + "</ul>" : "")
      + '<div class="qr-link"><span>Tracked link:</span><code>' + esc(link) + '</code><button type="button" class="rs-btn" data-copy="' + esc(link) + '">Copy</button>'
      + "<span>" + (+r.clicks || 0) + " click" + (+r.clicks === 1 ? "" : "s") + "</span></div>"
      + '<div class="qr-foot">' + foot + "</div></div>";
  }

  const how = () => "<h3>What it finds</h3><p>Every hour the finder reads the new posts and comments in Elene's daily-watch subreddits "
    + "(r/moving, r/relocating and the main NJ, NY, PA, CT and DE ones) and posts that name Zip To Zip anywhere on Reddit. It keeps one request "
    + "per thread when one of her five rules fits: it names us; a mover + asking for one + one of our places; a mover + urgency + a place; a "
    + "specific service question + a place; or a follow-on comment under an older mover thread. A broad word like \"moving\" or \"storage\" "
    + "needs a second moving signal.</p><h3>What happens next</h3><p>Each request also goes to Slack #quick-responses. The recommender "
    + "writes the reply in their own words, using the facts and talking points; Elene presses Posted (or Skip). When the recommender's "
    + "Reddit username is set, the finder also spots their reply in the thread and logs it.</p><h3>The tracked link</h3><p>Each request "
    + "has its own link (ziptozip.systems/go/…). It counts the clicks and opens our site with utm tags (utm_source=reddit, the thread in "
    + "utm_content), so the leads it brings can be traced.</p><h3>What it never does</h3><p>It never posts to Reddit and never writes a "
    + "reply in anyone's name.</p>";

  function render(host) {
    const d = S.data, rows = d.rows || [];
    const n = k => rows.filter(r => k === "all" || r.status === k).length;
    const clicks = rows.reduce((a, r) => a + (+r.clicks || 0), 0);
    const shown = rows.filter(r => S.tab === "all" || r.status === S.tab);
    host.innerHTML = RSC.pageHeadHtml({ title: "Quick Responses", key: "quick-responses",
        sub: "Move requests on Reddit, found within the hour, for our recommender to answer in their own words.", how })
      + banner(d)
      + RSC.kpisHtml([
          { label: "Found", value: RS.fmtN(rows.length), sub: "last " + d.days + " days" },
          { label: "To answer", value: RS.fmtN(n("new")), sub: "waiting for a reply" },
          { label: "Posted", value: RS.fmtN(n("posted")), sub: rows.length ? Math.round(100 * n("posted") / rows.length) + "% of found" : "" },
          { label: "Skipped", value: RS.fmtN(n("skipped")), sub: "not worth a reply" },
          { label: "Clicks", value: RS.fmtN(clicks), sub: "on the tracked links" }])
      + (S.msg ? '<p class="qr-note">' + esc(S.msg) + "</p>" : "")
      + RSC.tabsHtml(TABS.map(([k, l]) => ({ id: k, label: l, count: n(k) })), S.tab, "qrtab")
      + (shown.length ? shown.map(card).join("")
         : RSC.emptyHtml({ title: S.tab === "new" ? "Nothing to answer" : "Nothing here", body: rows.length ? "Every request in this tab is handled."
             : d.mode === "off" ? "The finder hasn't run yet." : "No move requests found in the last " + d.days + " days." }));
    host.querySelectorAll("[data-qrtab]").forEach(b => { b.onclick = () => { S.tab = b.dataset.qrtab; S.msg = ""; render(host); }; });
    host.querySelectorAll("[data-copy]").forEach(b => { b.onclick = () => {
      try { navigator.clipboard.writeText(b.dataset.copy); b.textContent = "Copied"; } catch (e) { /* the link is on screen */ }
    }; });
    host.querySelectorAll("[data-qr]").forEach(b => { b.onclick = () => {
      b.disabled = true;
      post({ action: b.dataset.qr, id: b.dataset.id }).then(j => {
        const r = rows.find(x => x.fullname === b.dataset.id);
        if (r && j.row) Object.assign(r, j.row);
        S.msg = b.dataset.qr === "posted" ? "Marked posted." : b.dataset.qr === "skip" ? "Skipped." : "Back in To answer.";
        render(host);
      }).catch(e => { S.msg = String(e && e.message || e); render(host); });
    }; });
  }

  registerPage({
    id: "quick-responses",
    group: "marketing-automations",
    title: "Quick Responses",
    async render(host) {
      injectStyle();
      host.innerHTML = RSC.loadingHtml("Quick Responses", "Reading the requests…");
      try {
        S.data = await ZTZ.api("/api/_quickresp?days=30");
        S.err = "";
      } catch (e) {
        S.err = String(e && e.message || e);
      }
      if (!S.data) {
        host.innerHTML = RSC.pageHeadHtml({ title: "Quick Responses", key: "quick-responses" })
          + RSC.emptyHtml({ title: "Quick Responses could not load", body: S.err.slice(0, 200) });
        return;
      }
      render(host);
    },
  });
})();
