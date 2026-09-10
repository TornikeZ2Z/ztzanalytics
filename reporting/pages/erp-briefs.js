/* ERP BUG BRIEFS — the ERP test team's tracker as a live document, one brief per ERP page.
 *
 * His asks, 2026-09-10, in order:
 *   v1  the Slack bug tracker grouped, polished and split by ERP page, questions flagged, live;
 *   v3  every task linked to its Slack reports and reporter, copy-paste messages per person;
 *   v4  (this file) "connect it to GitHub so we know which topic we committed and closed",
 *       "I still don't like the visual — it needs to be more smooth", and "I write the answers
 *       here, you re-run the thing and make a polished document of the changes".
 *
 * v4 in one breath:
 *   - GitHub: each task shows the PRs / commits behind it (linked from "Refs quote/T2" /
 *     "Closes quote/T2" in the message, by hand here, or at the first import) and whether that
 *     code is merged, on staging or live; a merged "Closes" moves the task on by itself.
 *   - Smooth: every brief is fetched once and cached, so switching pages is instant; writes are
 *     optimistic and repaint in place (no "Loading…", no scroll jumps); rows are a calm list
 *     instead of a boxed table; panels, drawer and composer animate in and out.
 *   - Refine loop: an answered question shows "not in the spec yet" until scripts/erp_refine.py
 *     folds it into the task's spec; the Change document view is the polished, consolidated
 *     result (the bridge renders it: /api/_erpbrief?format=doc).
 *
 * /api/_erpbrief sits ABOVE the ACL gate (the _work precedent). Times from the database are UTC
 * ("…Z") and render in the reader's zone through RS.fmtTz, like the rest of the portal.
 */
(function () {
  var STATUSES = ["Open", "Needs clarification", "Ready", "In dev", "Done (dev)", "Verify",
                  "Verified", "Dropped"];
  var TONE = { "Open": "info", "Needs clarification": "warn", "Ready": "ok", "In dev": "ok",
               "Done (dev)": "ok", "Verify": "warn", "Verified": "ok", "Dropped": "mute" };
  var TODO = ["Open", "Needs clarification", "Ready", "In dev"];
  var BUILT = ["Done (dev)", "Verify"];
  var CLOSED = ["Verified", "Dropped"];
  var PRIO_RANK = { P1: 0, P2: 1, P3: 2 };
  var TRACKER_TONE = { "New": "info", "In progress": "warn", "Done / User is Testing": "warn",
                       "Done": "ok" };
  var SLACK = { domain: "https://ziptozipmoving.slack.com", team: "T044NN6UFGC",
                channel: "C0C0X8D2XPA", list: "F0C0Y351JBS" };
  var CHANNEL_URL = SLACK.domain + "/archives/" + SLACK.channel;
  var TRACKER_URL = SLACK.domain + "/lists/" + SLACK.team + "/" + SLACK.list;
  var APP_HOST = "staging.ziptozip.app";
  var SHORT = { foreman: "Closing sheet", assignment: "Truck & foreman assignment",
                "dispatch-pages": "Storage & long-distance pages", "time-off": "Crew time-off",
                quote: "Quote calculator", claims: "Claims", reviews: "Reviews",
                cash: "Cash accounting", fleet: "Fleet Ops" };
  var AREA = { foreman: "Foreman portal", assignment: "Dispatch", "dispatch-pages": "Dispatch",
               "time-off": "Dispatch · HR", quote: "Sales", claims: "Support",
               reviews: "Support", cash: "Finance", fleet: "Dispatch · new module" };
  var HUES = ["brand", "blue", "pos", "neg", "purple", "muted"];

  /* ----------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function uniq(a) {
    var o = [];
    (a || []).forEach(function (x) { if (x && o.indexOf(x) < 0) o.push(x); });
    return o;
  }
  function flat(a) { return [].concat.apply([], a || []); }
  function toDate(v) {
    if (!v) return null;
    var d = v instanceof Date ? v : new Date(v);
    return isNaN(d) ? null : d;
  }
  function hasRS() { return window.RS && RS.fmtTz && RS.fmtTzDay; }
  function when(v) {
    var d = toDate(v);
    if (!d) return "";
    if (hasRS()) return RS.fmtTzDay(d, { weekday: "short" }) + ", " + RS.fmtTz(d);
    return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric",
                                         hour: "numeric", minute: "2-digit" });
  }
  function dayOf(v) {
    var d = toDate(v);
    if (!d) return "";
    return hasRS() ? RS.fmtTzDay(d) : d.toLocaleDateString(undefined,
      { month: "short", day: "numeric" });
  }
  function tzLabel() { return (window.RS && RS.tzShort) ? RS.tzShort() : ""; }
  function ago(v) {
    var d = toDate(v);
    if (!d) return "";
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 7 * 86400) return Math.round(s / 86400) + " d ago";
    return dayOf(d);
  }
  function tsDate(ts) { return new Date(parseFloat(ts) * 1000); }
  function permalink(ts) { return CHANNEL_URL + "/p" + String(ts || "").replace(".", ""); }
  function recordUrl(rec) { return TRACKER_URL + "?record_id=" + encodeURIComponent(rec); }
  function dmUrl(uid) { return "slack://user?team=" + SLACK.team + "&id=" + encodeURIComponent(uid); }
  function who(email) {
    var s = String(email || "");
    return s.indexOf("@") > 0 ? s.split("@")[0] : s;
  }
  function btIds(s) { return String(s || "").match(/BT-\d+[ab]?/g) || []; }
  function shortOf(key, title) { return SHORT[key] || String(title || key).split(" · ").pop(); }
  function areaOf(key, title) {
    if (AREA[key]) return AREA[key];
    var t = String(title || "");
    return t.indexOf(" · ") > 0 ? t.split(" · ")[0] : "";
  }
  function liveOf(deploy) {
    var m = /live ([^,|·]+)/i.exec(String(deploy || ""));
    return m ? m[1].trim() : String(deploy || "").trim();
  }
  function slackMd(s) { return String(s || "").replace(/\*\*([^*]+)\*\*/g, "*$1*"); }
  function linkify(escaped) {
    return escaped.replace(/(https?:\/\/[^\s<]+|\bstaging\.ziptozip\.app\/[^\s<]*)/g, function (u) {
      var href = /^https?:/.test(u) ? u : "https://" + u;
      return '<a href="' + href + '" target="_blank" rel="noopener">' + u + "</a>";
    });
  }
  function stChip(status) {
    return '<span class="erb-st erb-t-' + (TONE[status] || "mute") + '">' + esc(status) + "</span>";
  }
  function prChip(p) {
    return '<span class="erb-pri erb-' + esc(String(p || "P2").toLowerCase()) + '" title="Priority '
      + esc(p) + '">' + esc(p) + "</span>";
  }
  function chip(text, tone, title) {
    return '<span class="erb-chip-s erb-t-' + (tone || "mute") + '"'
      + (title ? ' title="' + esc(title) + '"' : "") + ">" + esc(text) + "</span>";
  }

  /* ---------------------------------------------------------------- markdown */
  // The subset the briefs use: headings, paragraphs, lists, GFM tables, blockquotes, bold /
  // italic / code / links. Escaped first, so nothing in a brief runs. `off` shifts headings.
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<i>$2</i>");
    s = s.replace(/(^|[^\w])_([^_]+)_(?!\w)/g, "$1<i>$2</i>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }
  function md(text, off) {
    off = off == null ? 2 : off;
    var lines = String(text || "").replace(/\r/g, "").split("\n");
    var out = [], i = 0, para = [];
    function flush() {
      if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; }
    }
    function cells(r) {
      return r.replace(/^\||\|$/g, "").split("|").map(function (c) { return c.trim(); });
    }
    while (i < lines.length) {
      var ln = lines[i];
      var h = /^(#{1,6})\s+(.*)$/.exec(ln);
      if (h) {
        flush();
        var lvl = Math.min(h[1].length + off, 6);
        out.push("<h" + lvl + ">" + inline(h[2]) + "</h" + lvl + ">"); i++; continue;
      }
      if (/^\|/.test(ln) && i + 1 < lines.length && /^\|\s*:?-+/.test(lines[i + 1])) {
        flush();
        var head = cells(ln); i += 2; var rows = [];
        while (i < lines.length && /^\|/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="rs-tablewrap"><table class="rs-table erb-md-t"><thead><tr>'
          + head.map(function (c) { return "<th>" + inline(c) + "</th>"; }).join("")
          + "</tr></thead><tbody>" + rows.map(function (r) {
              return "<tr>" + r.map(function (c) { return "<td>" + inline(c) + "</td>"; })
                .join("") + "</tr>";
            }).join("") + "</tbody></table></div>");
        continue;
      }
      if (/^\s*[-*]\s+/.test(ln) || /^\s*\d+\.\s+/.test(ln)) {
        flush();
        var ordered = /^\s*\d+\./.test(ln), items = [];
        while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^\s*\d+\.\s+/.test(lines[i]))) {
          items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, "")); i++;
        }
        out.push((ordered ? "<ol>" : "<ul>") + items.map(function (t) {
          return "<li>" + inline(t) + "</li>";
        }).join("") + (ordered ? "</ol>" : "</ul>"));
        continue;
      }
      if (/^>\s?/.test(ln)) {
        flush(); var q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, "")); i++; }
        out.push("<blockquote>" + inline(q.join(" ")) + "</blockquote>");
        continue;
      }
      if (!ln.trim()) { flush(); i++; continue; }
      para.push(ln.trim()); i++;
    }
    flush();
    return out.join("");
  }

  /* --------------------------------------------------------------------- css */
  // Calm by construction: one surface per group (never a box per row), hairlines between rows,
  // colour only where it means something (status, priority, "needs you"), and motion that
  // eases in over ~200 ms. Every colour is a portal token, so the light theme follows.
  function injectStyle() {
    var old = document.getElementById("erb-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "erb-style";
    var E = "cubic-bezier(.2,.7,.2,1)";
    st.textContent = ""
      + ".erb{font-variant-numeric:tabular-nums;--erb-r:14px}"
      + ".erb .rs-page-head p{max-width:92ch}"
      + ".erb .rs-page-head a{color:var(--brand)}"
      + "@keyframes erbIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}"
      + "@keyframes erbFade{from{opacity:0}to{opacity:1}}"
      + "@keyframes erbFadeOut{from{opacity:1}to{opacity:0}}"
      + "@keyframes erbSlideIn{from{transform:translateX(48px);opacity:.3}to{transform:none;opacity:1}}"
      + "@keyframes erbSlideOut{from{transform:none;opacity:1}to{transform:translateX(48px);opacity:0}}"
      + "@keyframes erbPop{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:none}}"
      + "@keyframes erbShim{from{background-position:200% 0}to{background-position:-200% 0}}"
      + ".erb-in{animation:erbIn .24s " + E + "}"
      + ".erb-skel{height:13px;border-radius:7px;margin:10px 0;background:linear-gradient(90deg,"
      + "var(--panel) 0%,var(--panel-2) 50%,var(--panel) 100%);background-size:200% 100%;"
      + "animation:erbShim 1.4s linear infinite}"
      // top bar
      + ".erb-bar{display:flex;gap:12px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;margin:6px 0 18px}"
      + ".erb-bar .r{display:flex;gap:8px;align-items:center;flex-wrap:wrap}"
      + ".erb-ghs{display:inline-flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);"
      + "white-space:nowrap}"
      + ".erb-ghs::before{content:'';width:7px;height:7px;border-radius:99px;background:var(--pos);"
      + "box-shadow:0 0 0 3px var(--pos-bg)}"
      + ".erb-ghs.off::before{background:var(--faint);box-shadow:0 0 0 3px var(--panel-2)}"
      + ".erb-ghs.busy::before{background:var(--warn);box-shadow:0 0 0 3px var(--warn-bg)}"
      + "a.erb-a{text-decoration:none;display:inline-flex;align-items:center;gap:5px}"
      + ".rs-btn.erb-sm{height:28px;padding:0 10px;font-size:12px}"
      + ".erb-link{font-family:inherit;background:none;border:0;padding:0;color:var(--brand);"
      + "font-size:inherit;font-weight:600;cursor:pointer;text-align:left}"
      + ".erb-link:hover{text-decoration:underline}"
      + ".erb-tbtn{font-family:inherit;font-size:12px;font-weight:700;background:none;border:0;"
      + "padding:5px 9px;border-radius:8px;color:var(--muted);cursor:pointer;"
      + "transition:background .15s,color .15s}"
      + ".erb-tbtn:hover{background:var(--panel-2);color:var(--ink)}"
      + ".erb-tbtn.pri{color:var(--brand)}"
      + ".erb-tbtn.danger:hover{color:var(--neg)}"
      + ".erb-hint{font-size:11.5px;color:var(--faint);line-height:1.5}"
      + ".erb-hint code{font-size:11px;background:var(--panel-2);padding:1px 5px;border-radius:4px;"
      + "color:var(--muted)}"
      + ".erb-dim{color:var(--faint)}"
      + ".erb-link:focus-visible,.erb-tbtn:focus-visible,.erb-ri:focus-visible,.erb-trow:focus-visible,"
      + ".erb-to:focus-visible{outline:2px solid var(--brand);outline-offset:2px}"
      // rail + pane
      + ".erb-split{display:grid;grid-template-columns:240px minmax(0,1fr);gap:28px;"
      + "align-items:start}"
      + ".erb-rail{position:sticky;top:12px;display:flex;flex-direction:column;gap:2px}"
      + ".erb-ri{font-family:inherit;text-align:left;border:0;background:transparent;"
      + "border-radius:12px;padding:10px 12px 11px;cursor:pointer;display:grid;gap:4px;"
      + "color:var(--ink);position:relative;transition:background .18s " + E + "}"
      + ".erb-ri::before{content:'';position:absolute;left:0;top:12px;bottom:12px;width:3px;"
      + "border-radius:3px;background:var(--brand);transform:scaleY(0);transition:transform .2s " + E + "}"
      + ".erb-ri:hover{background:var(--panel)}"
      + ".erb-ri.on{background:var(--panel)}.erb-ri.on::before{transform:scaleY(1)}"
      + ".erb-ri .nm{font-weight:700;font-size:13px;line-height:1.3}"
      + ".erb-ri .ar{font-size:11px;color:var(--faint)}"
      + ".erb-ri .st{display:flex;gap:3px 10px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}"
      + ".erb-ri .st .q{color:var(--warn);font-weight:700}"
      + ".erb-ri .st .r{color:var(--blue);font-weight:700}"
      + ".erb-ri .st .g{color:var(--pos);font-weight:700}"
      + ".erb-ri .bar{height:2px;background:var(--line);border-radius:2px;overflow:hidden;margin-top:3px}"
      + ".erb-ri .bar i{display:block;height:100%;background:var(--pos);border-radius:2px;"
      + "transition:width .4s " + E + "}"
      + ".erb-pane{min-width:0}"
      + "@media(max-width:1000px){.erb-split{grid-template-columns:1fr}.erb-rail{position:"
      + "static;flex-direction:row;overflow-x:auto;padding-bottom:6px}.erb-ri{min-width:200px}}"
      // brief header
      + ".erb-bh{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;"
      + "flex-wrap:wrap;margin:0 0 6px}"
      + ".erb-bt{min-width:0;flex:1 1 360px}"
      + ".erb-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.08em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".erb-bh h2{font-size:22px;margin:3px 0 8px;line-height:1.2;letter-spacing:-.3px}"
      + ".erb-bh .acts{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-meta{display:flex;flex-wrap:wrap;gap:6px 18px;align-items:center;font-size:12.5px;"
      + "color:var(--muted)}"
      + ".erb-meta > span{display:inline-flex;align-items:center;gap:6px}"
      + ".erb-meta .pg{color:var(--faint)}"
      + ".erb-meta code{font-size:11.5px}"
      + ".erb-sec{display:flex;align-items:baseline;gap:10px;margin:30px 0 10px;font-size:14px;"
      + "font-weight:700;color:var(--ink)}"
      + ".erb-sec .n{font-size:12px;font-weight:600;color:var(--faint)}"
      + ".erb-sec .sp{flex:1}"
      + ".erb-fold{margin:12px 0 0}"
      + ".erb-fold > summary{cursor:pointer;list-style:none;display:inline-flex;gap:7px;"
      + "align-items:center;font-size:12.5px;font-weight:700;color:var(--muted);padding:4px 0}"
      + ".erb-fold > summary::-webkit-details-marker{display:none}"
      + ".erb-fold > summary::before{content:'';width:6px;height:6px;border-right:1.6px solid "
      + "currentColor;border-bottom:1.6px solid currentColor;transform:rotate(-45deg);"
      + "transition:transform .2s " + E + "}"
      + ".erb-fold[open] > summary::before{transform:rotate(45deg)}"
      + ".erb-fold > summary:hover{color:var(--ink)}"
      + ".erb-fold[open] > :not(summary){animation:erbIn .22s " + E + "}"
      // one surface per group, hairlines between rows
      + ".erb-list{background:var(--panel);border:1px solid var(--line);border-radius:var(--erb-r);"
      + "overflow:hidden}"
      + ".erb-list > * + *{border-top:1px solid var(--line)}"
      + ".erb-trow{font-family:inherit;color:inherit;background:none;border:0;width:100%;"
      + "text-align:left;display:grid;grid-template-columns:40px minmax(0,1fr) auto 150px;"
      + "gap:14px;align-items:center;padding:13px 16px;cursor:pointer;"
      + "transition:background .16s " + E + "}"
      + ".erb-trow:hover{background:var(--panel-2)}"
      + ".erb-trow .t{display:block;font-weight:650;font-size:13.5px;line-height:1.35;color:var(--ink)}"
      + ".erb-trow .sub{display:flex;gap:4px 14px;flex-wrap:wrap;align-items:center;font-size:12px;"
      + "color:var(--muted);margin-top:5px}"
      + ".erb-trow .sub > span{display:inline-flex;align-items:center;gap:6px}"
      + ".erb-trow .q{color:var(--warn);font-weight:700}"
      + ".erb-trow .f{color:var(--blue);font-weight:700}"
      + "@media(max-width:760px){.erb-trow{grid-template-columns:36px minmax(0,1fr)}"
      + ".erb-trow > .erb-pri,.erb-trow > .erb-st{display:none}}"
      + ".erb-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;"
      + "font-weight:700;color:var(--brand);background:var(--brand-glow);padding:2px 6px;"
      + "border-radius:6px;white-space:nowrap;display:inline-block;text-align:center}"
      + ".erb-code.q{color:var(--warn);background:var(--warn-bg)}"
      + ".erb-st{display:inline-flex;align-items:center;gap:7px;font-size:12px;font-weight:700;"
      + "white-space:nowrap}"
      + ".erb-st::before{content:'';width:7px;height:7px;border-radius:99px;background:currentColor;"
      + "flex:none}"
      + ".erb-t-info{color:var(--blue)}.erb-t-warn{color:var(--warn)}.erb-t-ok{color:var(--pos)}"
      + ".erb-t-bad{color:var(--neg)}.erb-t-mute{color:var(--faint)}"
      + ".erb-pri{font-size:10.5px;font-weight:800;padding:2px 7px;border-radius:6px;"
      + "background:var(--panel-2);color:var(--muted);letter-spacing:.02em}"
      + ".erb-pri.erb-p1{color:var(--neg);background:var(--neg-bg)}"
      + ".erb-pri.erb-p2{color:var(--warn);background:var(--warn-bg)}"
      + ".erb-chip-s{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;"
      + "padding:2px 8px;border-radius:99px;background:var(--panel-2);white-space:nowrap}"
      + ".erb-chip-s.erb-t-ok{background:var(--pos-bg)}.erb-chip-s.erb-t-warn{background:var(--warn-bg)}"
      + ".erb-chip-s.erb-t-info{background:var(--blue-bg)}.erb-chip-s.erb-t-bad{background:var(--neg-bg)}"
      + ".erb-gh-i{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;font-weight:700}"
      // avatars
      + ".erb-av{width:22px;height:22px;border-radius:99px;display:inline-flex;align-items:center;"
      + "justify-content:center;font-size:9.5px;font-weight:800;color:#fff;flex:none;"
      + "background:var(--muted);letter-spacing:.02em}"
      + ".erb-av.lg{width:40px;height:40px;font-size:13.5px}"
      + ".erb-av.erb-h-brand{background:var(--brand);color:var(--brand-ink)}"
      + ".erb-av.erb-h-blue{background:var(--blue)}.erb-av.erb-h-pos{background:var(--pos);"
      + "color:var(--brand-ink)}.erb-av.erb-h-neg{background:var(--neg)}"
      + ".erb-av.erb-h-purple{background:var(--purple)}.erb-av.erb-h-muted{background:var(--muted)}"
      + ".erb-who{display:inline-flex;align-items:center;gap:6px;color:var(--ink);white-space:nowrap}"
      + ".erb-stack{display:inline-flex;align-items:center}"
      + ".erb-stack .erb-av+.erb-av{margin-left:-6px;box-shadow:0 0 0 2px var(--panel)}"
      + ".erb-sn{margin-left:6px;color:var(--ink);white-space:nowrap}"
      // questions
      + ".erb-q{padding:14px 16px;transition:background .16s " + E + "}"
      + ".erb-q:hover{background:var(--panel-2)}"
      + ".erb-q .hd{display:grid;grid-template-columns:40px minmax(0,1fr);gap:14px;align-items:start}"
      + ".erb-q .qt{font-size:13.5px;line-height:1.55;color:var(--ink)}"
      + ".erb-q.done .qt{color:var(--muted)}"
      + ".erb-q .qm{display:flex;flex-wrap:wrap;gap:5px 14px;align-items:center;font-size:12px;"
      + "color:var(--muted);margin:6px 0 0 54px}"
      + ".erb-q .qm > span{display:inline-flex;align-items:center;gap:6px}"
      + ".erb-q .acts{display:flex;gap:2px;margin:6px 0 0 45px;opacity:.6;transition:opacity .16s}"
      + ".erb-q:hover .acts,.erb-q:focus-within .acts{opacity:1}"
      + ".erb-ans{margin:10px 0 0 54px;padding:9px 12px;border-radius:10px;background:var(--pos-bg);"
      + "font-size:13px;line-height:1.55}"
      + ".erb-ans .by{font-size:11px;color:var(--muted);font-weight:700;margin-bottom:2px}"
      + ".erb-exp{display:grid;grid-template-rows:0fr;transition:grid-template-rows .24s " + E + "}"
      + ".erb-exp.open{grid-template-rows:1fr}"
      + ".erb-exp > div{overflow:hidden}"
      + ".erb-exp .in{margin:10px 0 2px 54px}"
      + ".erb-asked{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;"
      + "background:var(--panel-2);color:var(--muted);white-space:nowrap}"
      + ".erb-asked.no{background:var(--warn-bg);color:var(--warn)}"
      + ".erb-asked.fold{background:var(--blue-bg);color:var(--blue)}"
      + ".erb-new{background:var(--panel);border:1px solid var(--line);border-radius:var(--erb-r);"
      + "padding:14px 16px;margin:0 0 12px;display:grid;gap:10px}"
      + ".erb-new .g{display:grid;grid-template-columns:minmax(0,1fr) 190px 150px auto;gap:8px;"
      + "align-items:start}"
      + "@media(max-width:760px){.erb-new .g{grid-template-columns:1fr}}"
      // retest rows
      + ".erb-rt{display:grid;grid-template-columns:24px minmax(0,1fr) auto;gap:12px;"
      + "align-items:center;padding:12px 16px;font-size:13px;transition:background .16s}"
      + ".erb-rt:hover{background:var(--panel-2)}"
      + ".erb-rt input{accent-color:var(--brand);width:16px;height:16px;cursor:pointer}"
      + ".erb-rt.ok .w{color:var(--faint);text-decoration:line-through;"
      + "text-decoration-color:var(--line-2)}"
      + ".erb-rt .m{font-size:11.5px;color:var(--faint);margin-top:3px;display:flex;gap:6px 12px;"
      + "flex-wrap:wrap;align-items:center}"
      // markdown
      + ".erb-md{font-size:13.5px;line-height:1.65;color:var(--ink);max-width:82ch}"
      + ".erb-md p{margin:7px 0}.erb-md ul,.erb-md ol{margin:6px 0 10px;padding-left:20px}"
      + ".erb-md li{margin:3px 0}.erb-md h3,.erb-md h4,.erb-md h5{margin:16px 0 5px;"
      + "font-size:13.5px;font-weight:800}"
      + ".erb-md code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;"
      + "background:var(--panel-2);padding:1px 5px;border-radius:4px}"
      + ".erb-md blockquote{margin:10px 0;padding:8px 13px;border-left:3px solid var(--warn);"
      + "background:var(--panel-2);border-radius:0 10px 10px 0;color:var(--muted)}"
      + ".erb-md a{color:var(--brand)}"
      + ".erb-md .rs-tablewrap{margin:10px 0}.erb-md-t td,.erb-md-t th{font-size:12.5px}"
      // inputs
      + ".erb-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:10px;color:var(--ink);padding:9px 12px;font-size:13px;"
      + "outline:0;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}"
      + ".erb-in:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}"
      + "textarea.erb-in{min-height:76px;resize:vertical;line-height:1.55}"
      + "textarea.erb-in.big{min-height:300px;font-family:ui-monospace,Menlo,Consolas,"
      + "monospace;font-size:12.5px}"
      + ".erb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}"
      + ".erb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 5px}"
      // Slack reports
      + ".erb-src{padding:14px 16px}"
      + ".erb-src .h{display:flex;gap:6px 10px;align-items:center;flex-wrap:wrap;font-size:12.5px}"
      + ".erb-src .h b{color:var(--ink)}"
      + ".erb-src .k{color:var(--faint);font-size:11.5px}"
      + ".erb-src .h .erb-chip-s{margin-left:auto}"
      + ".erb-src .ttl{font-weight:700;margin:9px 0 0;font-size:13px;color:var(--ink)}"
      + ".erb-src .txt{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.6;"
      + "color:var(--ink);background:var(--panel-2);border-radius:10px;padding:10px 13px;"
      + "margin-top:8px;max-height:none;transition:max-height .3s " + E + "}"
      + ".erb-src .txt.clip{max-height:10.4em;overflow:hidden;-webkit-mask-image:linear-gradient("
      + "#000 68%,transparent);mask-image:linear-gradient(#000 68%,transparent)}"
      + ".erb-src .txt a,.erb-src .th a{color:var(--brand)}"
      + ".erb-src .th{font-size:12.5px;color:var(--muted);margin-top:9px;line-height:1.55}"
      + ".erb-src .lk{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}"
      // GitHub rows
      + ".erb-lr{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;"
      + "align-items:center;padding:11px 14px;font-size:13px}"
      + ".erb-lr .t{color:var(--ink);font-weight:600;line-height:1.4}"
      + ".erb-lr .t a{color:var(--brand);text-decoration:none;margin-right:6px}"
      + ".erb-lr .m{display:flex;gap:5px 10px;flex-wrap:wrap;align-items:center;margin-top:4px;"
      + "font-size:11.5px;color:var(--faint)}"
      + ".erb-ico{width:28px;height:28px;border-radius:8px;display:inline-flex;align-items:center;"
      + "justify-content:center;background:var(--panel-2);color:var(--muted);font-size:10px;"
      + "font-weight:800;font-family:ui-monospace,Menlo,Consolas,monospace}"
      + ".erb-linkin{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;"
      + "align-items:center;margin:10px 0 6px}"
      + "@media(max-width:560px){.erb-linkin{grid-template-columns:1fr}}"
      + ".erb-sug{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 0}"
      + ".erb-sug button{font-family:inherit;font-size:11.5px;border:1px solid var(--line);"
      + "background:var(--panel);color:var(--muted);border-radius:99px;padding:3px 10px;"
      + "cursor:pointer;max-width:320px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
      + "transition:border-color .15s,color .15s}"
      + ".erb-sug button:hover{border-color:var(--brand);color:var(--ink)}"
      // activity
      + ".erb-act{padding:8px 0;border-bottom:1px solid var(--line);font-size:12.5px;"
      + "line-height:1.55;color:var(--muted)}"
      + ".erb-act:last-child{border-bottom:0}"
      + ".erb-act b{color:var(--ink);font-weight:600}"
      + ".erb-act .d{color:var(--faint);font-size:11px;margin-right:7px}"
      + ".erb-act .v{color:var(--ink)}"
      + ".erb-empty{padding:22px;text-align:center;color:var(--faint);font-size:13px}"
      // people
      + ".erb-people{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));"
      + "gap:16px;align-items:start}"
      + "@media(max-width:560px){.erb-people{grid-template-columns:1fr}}"
      + ".erb-pc{background:var(--panel);border:1px solid var(--line);border-radius:16px;"
      + "padding:16px 18px 12px;display:flex;flex-direction:column;gap:8px;"
      + "transition:border-color .2s}"
      + ".erb-pc:hover{border-color:var(--line-2)}"
      + ".erb-pc header{display:flex;gap:12px;align-items:center}"
      + ".erb-pc header .n{display:grid;gap:2px;min-width:0}"
      + ".erb-pc header .n b{font-size:15px;color:var(--ink)}"
      + ".erb-pc header .n span{font-size:12px;color:var(--faint)}"
      + ".erb-pc .stats{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}"
      + ".erb-pcs{font-size:11.5px;font-weight:700;color:var(--muted);margin:8px 0 0}"
      + ".erb-li{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;line-height:1.5;"
      + "padding:8px 0;border-top:1px solid var(--line);color:var(--ink)}"
      + ".erb-li:first-of-type{border-top:0}"
      + ".erb-li .x{color:var(--faint);font-size:11.5px;margin-top:3px}"
      + ".erb-li .d{font-size:11px;color:var(--faint);white-space:nowrap;min-width:50px;padding-top:1px}"
      + ".erb-li a{color:var(--brand)}"
      + ".erb-pc footer{display:flex;gap:8px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;border-top:1px solid var(--line);padding-top:11px;margin-top:6px}"
      + ".erb-pc footer .b{display:flex;gap:6px}"
      // document
      + ".erb-docbar{display:flex;gap:10px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;margin:0 0 14px}"
      + ".erb-note{display:flex;gap:10px;align-items:flex-start;background:var(--blue-bg);"
      + "color:var(--ink);border-radius:12px;padding:11px 14px;font-size:13px;line-height:1.55;"
      + "margin:0 0 16px}"
      + ".erb-docwrap{display:grid;grid-template-columns:220px minmax(0,1fr);gap:28px;"
      + "align-items:start}"
      + "@media(max-width:1000px){.erb-docwrap{grid-template-columns:1fr}.erb-toc{display:none}}"
      + ".erb-toc{position:sticky;top:12px;display:flex;flex-direction:column;gap:1px;font-size:12.5px}"
      + ".erb-toc a{color:var(--muted);text-decoration:none;padding:6px 10px;border-radius:8px;"
      + "transition:background .15s,color .15s}"
      + ".erb-toc a:hover{background:var(--panel);color:var(--ink)}"
      + ".erb-doc{background:var(--panel);border:1px solid var(--line);border-radius:18px;"
      + "padding:30px 40px 40px;max-width:900px}"
      + "@media(max-width:700px){.erb-doc{padding:20px}}"
      + ".erb-doc h1{font-size:26px;letter-spacing:-.4px;margin:0 0 8px}"
      + ".erb-doc h2{font-size:19px;margin:38px 0 6px;padding-top:22px;border-top:1px solid "
      + "var(--line);scroll-margin-top:16px}"
      + ".erb-doc h3{font-size:15px;margin:24px 0 4px}"
      + ".erb-doc h4{font-size:12.5px;margin:20px 0 4px;color:var(--muted);text-transform:uppercase;"
      + "letter-spacing:.05em}"
      + ".erb-doc .erb-md{max-width:none}"
      // drawer
      + ".erb-overlay{position:fixed;inset:0;background:var(--scrim,rgba(10,16,24,.45));z-index:60;"
      + "display:flex;justify-content:flex-end;animation:erbFade .2s " + E + "}"
      + ".erb-overlay.out{animation:erbFadeOut .2s " + E + " forwards}"
      + ".erb-drawer{width:min(820px,96vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:24px 28px 48px;box-shadow:-18px 0 48px rgba(0,0,0,.28);box-sizing:border-box;"
      + "animation:erbSlideIn .26s " + E + "}"
      + ".erb-overlay.out .erb-drawer{animation:erbSlideOut .2s " + E + " forwards}"
      + ".erb-dhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:6px}"
      + ".erb-dhead h2{font-size:20px;line-height:1.3;margin:0;flex:1;letter-spacing:-.2px}"
      + ".erb-strip{display:flex;flex-wrap:wrap;gap:6px;margin:16px 0 8px}"
      + ".erb-stbtn{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;"
      + "border-radius:999px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;transition:background .18s,border-color .18s,color .18s}"
      + ".erb-stbtn:hover{border-color:var(--brand);color:var(--brand)}"
      + ".erb-stbtn.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".erb-writes{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-writes .rs-btn{display:inline-flex;align-items:center;gap:7px}"
      // composer
      + ".erb-mwrap{position:fixed;inset:0;background:var(--scrim,rgba(10,16,24,.5));z-index:80;"
      + "display:flex;align-items:flex-start;justify-content:center;padding:5vh 16px;overflow:auto;"
      + "animation:erbFade .18s " + E + "}"
      + ".erb-mwrap.out{animation:erbFadeOut .16s " + E + " forwards}"
      + ".erb-modal{width:min(760px,100%);background:var(--bg);border:1px solid var(--line);"
      + "border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,.35);padding:20px 22px 16px;"
      + "box-sizing:border-box;animation:erbPop .22s " + E + "}"
      + ".erb-modal .hd{display:flex;align-items:center;gap:10px;margin-bottom:14px}"
      + ".erb-modal .hd h3{margin:0;font-size:16px;flex:1}"
      + ".erb-tos{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;align-items:center}"
      + ".erb-to{font-family:inherit;display:inline-flex;align-items:center;gap:7px;"
      + "border:1px solid var(--line);background:var(--panel);border-radius:999px;"
      + "padding:4px 12px 4px 4px;font-size:12.5px;font-weight:700;color:var(--muted);"
      + "cursor:pointer;transition:border-color .15s,box-shadow .15s,color .15s}"
      + ".erb-to.on{border-color:var(--brand);color:var(--ink);box-shadow:0 0 0 3px var(--brand-glow)}"
      + ".erb-to small{font-weight:600;color:var(--faint)}"
      + ".erb-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 12px}"
      + ".erb-items{border:1px solid var(--line);border-radius:12px;background:var(--panel);"
      + "padding:2px 14px;margin:0 0 12px;max-height:220px;overflow:auto}"
      + ".erb-items label{display:flex;gap:10px;align-items:flex-start;font-size:12.5px;"
      + "line-height:1.5;padding:8px 0;border-bottom:1px solid var(--line);cursor:pointer;"
      + "color:var(--ink)}"
      + ".erb-items label:last-child{border-bottom:0}"
      + ".erb-items input{accent-color:var(--brand);margin-top:3px;flex:none}"
      + ".erb-items i{color:var(--faint);font-style:normal}"
      + ".erb-items .erb-asked{margin-left:6px}"
      + "textarea.erb-msg{min-height:250px;font-size:13px;line-height:1.6}"
      + ".erb-where{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:12px 0 0;"
      + "font-size:12px;color:var(--muted)}"
      + ".erb-modal .ft{display:flex;gap:8px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}"
      + ".erb-modal .ft .b{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);"
      + "background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;"
      + "padding:10px 18px;border-radius:12px;z-index:99;box-shadow:0 10px 28px rgba(0,0,0,.3);"
      + "animation:erbPop .22s " + E + ";transition:opacity .25s,transform .25s}"
      + ".erb-toast.bye{opacity:0;transform:translate(-50%,8px)}"
      + ".erb-toast.err{background:var(--neg);color:#fff}"
      + "@media(prefers-reduced-motion:reduce){.erb *,.erb-overlay,.erb-drawer,.erb-mwrap,"
      + ".erb-modal,.erb-toast{animation:none!important;transition:none!important}}";
    document.head.appendChild(st);
  }

  /* --------------------------------------------------------------------- api */
  function api(path, opts) {
    return fetch(ZTZ.API + path, Object.assign({
      headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                             (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
    }, opts || {})).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || j.error) {
          var e = new Error(j.error || ("HTTP " + r.status));
          e.code = j.code;
          throw e;
        }
        return j;
      });
    });
  }
  function post(payload) {
    return api("/api/_erpbrief", { method: "POST", body: JSON.stringify(payload) });
  }
  function fetchText(qs) {
    return fetch(ZTZ.API + "/api/_erpbrief?" + qs,
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  }
  function toast(msg, isErr) {
    var t = document.createElement("div");
    t.className = "erb-toast" + (isErr ? " err" : "");
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.classList.add("bye"); }, isErr ? 4000 : 2200);
    setTimeout(function () { t.remove(); }, isErr ? 4400 : 2600);
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, bad) {
      var ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy") ? ok() : bad(new Error("copy refused")); }
      catch (e) { bad(e); } finally { ta.remove(); }
    });
  }
  // somebody is mid-sentence in this element: a background refresh must not wipe it
  function typing(el) {
    var a = document.activeElement;
    return !!(el && a && el.contains(a) && /^(TEXTAREA|INPUT)$/.test(a.tagName) && a.value);
  }

  /* ----------------------------------------------------------------- people */
  function hueOf(k) {
    var h = 0; k = String(k || "");
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return HUES[h % HUES.length];
  }
  function initials(p) {
    var n = String((p && p.Name) || "?").trim().split(/\s+/);
    return ((n[0] || "?")[0] + (n[1] ? n[1][0] : "")).toUpperCase();
  }
  function av(S, k, cls) {
    var p = S.P[k];
    if (!p) return "";
    return '<span class="erb-av erb-h-' + hueOf(k) + (cls ? " " + cls : "") + '" title="'
      + esc(p.Name + (p.Role ? " · " + p.Role : "")) + '">' + esc(initials(p)) + "</span>";
  }
  function whoChip(S, k) {
    var p = S.P[k];
    return p ? '<span class="erb-who">' + av(S, k) + esc(p.Short) + "</span>" : "";
  }
  function stack(S, keys, noName) {
    keys = uniq(keys).filter(function (k) { return S.P[k]; });
    if (!keys.length) return "";
    if (keys.length === 1 && !noName) return whoChip(S, keys[0]);
    return '<span class="erb-stack" title="' + esc(keys.map(function (k) {
      return S.P[k].Name;
    }).join(", ")) + '">' + keys.map(function (k) { return av(S, k); }).join("") + "</span>"
      + (noName ? "" : '<span class="erb-sn">' + esc(keys.map(function (k) {
          return S.P[k].Short;
        }).join(", ")) + "</span>");
  }
  function peopleIn(S, text) {
    var t = String(text || ""), hits = [];
    (S.ov.people || []).forEach(function (p) {
      var re = new RegExp("(^|[^A-Za-z])" + p.Short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
                          + "(?![A-Za-z])", "i");
      var m = re.exec(t);
      if (m) hits.push({ k: p.Key, i: m.index });
    });
    return hits.sort(function (a, b) { return a.i - b.i; }).map(function (h) { return h.k; });
  }

  /* ------------------------------------------------------------ data model */
  function srcsForTask(t, list) {
    var want = btIds(t && t.Source);
    if (!want.length) return [];
    return (list || []).filter(function (s) {
      return btIds(s.BT).some(function (b) { return want.indexOf(b) >= 0; });
    });
  }
  function reportersOf(t, list) {
    return uniq(srcsForTask(t, list).map(function (s) { return s.Reporter; }));
  }
  function index(S) {
    var ov = S.ov;
    ov.gh = ov.gh || { configured: false, links: [], recent: [] };
    S.P = {};
    (ov.people || []).forEach(function (p) { S.P[p.Key] = p; });
    S.TASK = {};
    (ov.tasks || []).forEach(function (t) { S.TASK[t["Brief Key"] + ":" + t.Code] = t; });
    S.srcTasks = {};
    (ov.sources || []).forEach(function (s) {
      S.srcTasks[s["Slack TS"]] = (ov.tasks || []).filter(function (t) {
        return srcsForTask(t, [s]).length;
      });
    });
    S.LINKS = {};
    (ov.gh.links || []).forEach(function (l) {
      var k = l["Brief Key"] + ":" + l["Task Code"];
      (S.LINKS[k] = S.LINKS[k] || []).push(l);
    });
    S.shipAsked = {}; S.taskAsked = {}; S.lastMsg = {};
    (ov.messages || []).forEach(function (m) {                   // newest first
      if (!S.lastMsg[m.Person]) S.lastMsg[m.Person] = m;
      var it = {};
      try { it = JSON.parse(m.Items || "{}") || {}; } catch (e) { it = {}; }
      (it.shipped || []).forEach(function (id) {
        if (!S.shipAsked[id + "|" + m.Person]) S.shipAsked[id + "|" + m.Person] = m.At;
      });
      (it.tasks || []).forEach(function (k) {
        if (!S.taskAsked[k + "|" + m.Person]) S.taskAsked[k + "|" + m.Person] = m.At;
      });
    });
    if (!S.key || !ov.briefs.some(function (b) { return b.Key === S.key; })) {
      S.key = ov.briefs.length ? ov.briefs[0].Key : null;
    }
  }
  function linksOf(S, bk, code) { return S.LINKS[bk + ":" + code] || []; }
  // how far the code behind a task has travelled: live > staging > merged > PR open
  function codeState(links) {
    var best = null, rank = -1;
    links.forEach(function (l) {
      var r = -1, c = null;
      if (l["Prod At"]) { r = 4; c = { label: "live " + dayOf(l["Prod At"]), tone: "ok" }; }
      else if (l["Staging At"]) { r = 3; c = { label: "on staging", tone: "warn" }; }
      else if (l.State === "merged") { r = 2; c = { label: "merged", tone: "info" }; }
      else if (l.State === "open") { r = 1; c = { label: "PR open", tone: "info" }; }
      else { r = 0; c = { label: "linked", tone: "mute" }; }
      if (r > rank) { rank = r; best = c; }
    });
    return best;
  }
  function unfolded(q) { return q.Status === "Answered" && q.Answer && !q["Folded At"]; }
  function personItems(S, pk) {
    var ov = S.ov;
    var qs = ov.questions.filter(function (q) {
      return q.Status === "Open" && peopleIn(S, q.Ask).indexOf(pk) >= 0;
    });
    var verify = ov.tasks.filter(function (t) {
      return t.Status === "Verify" && reportersOf(t, ov.sources).indexOf(pk) >= 0;
    });
    var covered = uniq(verify.map(function (t) { return t["Brief Key"]; }));
    var ship = ov.shipped.filter(function (s) {
      return !+s.Verified && peopleIn(S, s["Retest By"]).indexOf(pk) >= 0;
    });
    return {
      qs: qs, verify: verify,
      ship: ship.filter(function (s) { return covered.indexOf(s["Brief Key"]) < 0; }),
      shipExtra: ship.filter(function (s) { return covered.indexOf(s["Brief Key"]) >= 0; }),
      reports: ov.sources.filter(function (s) { return s.Reporter === pk; }),
    };
  }
  function cur(S) { return S.det[S.key]; }
  function findTask(S, bk, code) {
    var d = S.det[bk];
    var t = d && d.tasks.filter(function (x) { return x.Code === code; })[0];
    return t || S.TASK[bk + ":" + code];
  }
  function findQ(S, bk, code) {
    var d = S.det[bk];
    var pool = d ? d.questions : S.ov.questions;
    return pool.filter(function (q) { return q["Brief Key"] === bk && q.Code === code; })[0]
      || S.ov.questions.filter(function (q) { return q["Brief Key"] === bk && q.Code === code; })[0];
  }

  /* ------------------------------------------------------------------ state */
  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="erb"><div class="rs-page-head"><h1>ERP Bug Briefs</h1></div>'
      + '<div class="erb-skel" style="width:60%"></div><div class="erb-skel" style="width:90%">'
      + '</div><div class="erb-skel" style="width:75%"></div></div>';
    var S = { host: host, ov: null, det: {}, key: null, view: "page", dw: null, doc: null,
              syncing: false };
    try {
      S.key = localStorage.getItem("erb-key") || null;
      var v = localStorage.getItem("erb-view");
      S.view = v === "person" || v === "doc" ? v : "page";
    } catch (e) { /* private mode */ }
    function onTz() {
      if (!document.body.contains(host)) { window.removeEventListener("ztz:tz", onTz); return; }
      if (S.ov) softPaint(S);
    }
    window.addEventListener("ztz:tz", onTz);
    api("/api/_erpbrief").then(function (j) {
      S.ov = j; index(S);
      paintShell(S); paintMain(S, true);
      prefetch(S);
      autoSync(S);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the briefs — ' + esc(e.message) + "</div>";
    });
  }
  function getBrief(S, key) {
    return api("/api/_erpbrief?key=" + encodeURIComponent(key)).then(function (j) {
      S.det[key] = j;
      return j;
    });
  }
  // every brief is small; fetch them all once so moving between ERP pages never waits
  function prefetch(S) {
    var keys = S.ov.briefs.map(function (b) { return b.Key; })
      .filter(function (k) { return !S.det[k]; });
    var i = 0;
    function next() {
      if (i >= keys.length) return;
      var k = keys[i++];
      getBrief(S, k).catch(function () {}).then(next);
    }
    next(); next();
  }
  // after a write: fetch the overview and the brief on screen, repaint in place
  function refresh(S, extraKey) {
    var jobs = [api("/api/_erpbrief").then(function (j) { S.ov = j; index(S); })];
    uniq([S.key, extraKey, S.dw && S.dw.key]).forEach(function (k) { jobs.push(getBrief(S, k)); });
    return Promise.all(jobs).then(function () { softPaint(S); })
      .catch(function (e) { toast(e.message, true); });
  }
  function softPaint(S) {
    paintKpis(S); paintGh(S);
    var main = S.host.querySelector("#erbMain");
    if (!main) return;
    if (S.view === "page") {
      paintRail(S);
      var pane = S.host.querySelector("#erbPane");
      if (pane && !typing(pane) && cur(S)) paintBrief(S, false);
    } else if (S.view === "person") {
      if (!typing(main)) paintPeople(S, main);
    } else {
      paintDocNote(S);
    }
    if (S.dw && document.body.contains(S.dw.ov) && S.dw.code && !typing(S.dw.el)) {
      var top = S.dw.el.scrollTop;
      paintTaskView(S, S.dw, S.dw.code);
      S.dw.el.scrollTop = top;
    }
  }
  function autoSync(S) {
    var gh = S.ov.gh;
    if (!gh.configured) return;
    var last = toDate(gh.last_sync);
    if (last && Date.now() - last.getTime() < 10 * 60 * 1000) return;
    runSync(S, true);
  }
  function runSync(S, quiet) {
    if (S.syncing) return;
    S.syncing = true; paintGh(S);
    post({ action: "gh_sync", force: !quiet }).then(function (r) {
      S.syncing = false;
      var res = r.result || {};
      if (!quiet) {
        toast(r.skipped ? "GitHub was synced moments ago"
          : "GitHub synced — " + (res.links || 0) + " new link" + (res.links === 1 ? "" : "s")
            + (res.moved ? ", " + res.moved + " task" + (res.moved === 1 ? "" : "s") + " moved" : ""));
      }
      return refresh(S);
    }).catch(function (e) {
      S.syncing = false; paintGh(S);
      if (!quiet) toast(e.message, true);
    });
  }

  /* ------------------------------------------------------------------ shell */
  function paintShell(S) {
    S.host.innerHTML = '<div class="erb">'
      + '<div class="rs-page-head"><h1>ERP Bug Briefs</h1>'
      + '<p>What the ERP test team reported in <a href="' + CHANNEL_URL + '" target="_blank" '
      + 'rel="noopener">#z2z-soft-test-team</a>, grouped into tasks per ERP page — each linked to '
      + "the Slack reports it came from and the GitHub work that answers it. It fills itself: "
      + "<b>/erp-refresh</b> in Claude Code reads the new reports, groups and refines them, and "
      + "folds in answers given here or in Slack.</p></div>"
      + '<div class="rs-kpis" id="erbKpis"></div>'
      + '<div class="erb-bar"><div class="rs-seg" id="erbView" role="tablist">'
      + '<button data-v="page" role="tab">By ERP page</button>'
      + '<button data-v="person" role="tab">By person</button>'
      + '<button data-v="doc" role="tab">Change document</button></div>'
      + '<div class="r" id="erbGh"></div></div>'
      + '<div id="erbMain"></div></div>';
    S.host.querySelectorAll("#erbView [data-v]").forEach(function (b) {
      b.onclick = function () {
        if (S.view === b.getAttribute("data-v")) return;
        S.view = b.getAttribute("data-v");
        try { localStorage.setItem("erb-view", S.view); } catch (e) { /* ignore */ }
        paintViewSeg(S); paintMain(S, true);
      };
    });
    paintViewSeg(S); paintKpis(S); paintGh(S);
  }
  function paintViewSeg(S) {
    S.host.querySelectorAll("#erbView [data-v]").forEach(function (b) {
      var on = b.getAttribute("data-v") === S.view;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function paintGh(S) {
    var el = S.host.querySelector("#erbGh");
    if (!el || !S.ov) return;
    var gh = S.ov.gh, rf = S.ov.refresh, info = {};
    try { info = rf && rf.info ? JSON.parse(rf.info) : {}; } catch (e) { info = {}; }
    el.innerHTML = (rf
        ? '<span class="erb-ghs" title="' + esc(info.summary || "") + '">Refreshed from Slack '
          + esc(ago(rf.at)) + "</span>"
        : '<span class="erb-ghs off" title="Run /erp-refresh in Claude Code">Not refreshed from '
          + "Slack yet</span>")
      + (gh.configured
        ? '<span class="erb-ghs' + (S.syncing ? " busy" : "") + '" title="' + esc(gh.repo) + '">'
          + (S.syncing ? "Syncing with GitHub…" : "GitHub · synced "
             + (gh.last_sync ? esc(ago(gh.last_sync)) : "never")) + "</span>"
          + '<button class="rs-btn erb-sm" id="erbSync"' + (S.syncing ? " disabled" : "")
          + ">Sync now</button>"
        : '<span class="erb-ghs off" title="The bridge has no GitHub token yet; links made here '
          + 'are kept and fill in once it has one">GitHub read-only until the token is added'
          + (gh.last_sync ? " · imported " + esc(ago(gh.last_sync)) : "") + "</span>")
      + '<a class="rs-btn erb-sm erb-a" href="' + TRACKER_URL + '" target="_blank" rel="noopener">'
      + "Bugs tracker ↗</a>";
    var b = el.querySelector("#erbSync");
    if (b) b.onclick = function () { runSync(S, false); };
  }
  function paintKpis(S) {
    var host = S.host.querySelector("#erbKpis");
    if (!host) return;
    var ov = S.ov, t = ov.tasks;
    var open = t.filter(function (x) { return TODO.indexOf(x.Status) >= 0; }).length;
    var nc = t.filter(function (x) { return x.Status === "Needs clarification"; }).length;
    var oq = ov.questions.filter(function (q) { return q.Status === "Open"; });
    var ppl = uniq(flat(oq.map(function (q) { return peopleIn(S, q.Ask); })));
    var notAsked = oq.filter(function (q) { return !q["Asked At"]; }).length;
    var fold = ov.questions.filter(unfolded).length;
    var inCode = uniq((ov.gh.links || []).map(function (l) { return l["Brief Key"] + ":" + l["Task Code"]; }));
    var live = uniq((ov.gh.links || []).filter(function (l) { return l["Prod At"]; })
      .map(function (l) { return l["Brief Key"] + ":" + l["Task Code"]; })).length;
    var ver = t.filter(function (x) { return x.Status === "Verify"; }).length;
    RSC.kpis(host, [
      { label: "Open tasks", value: open, sub: nc + " blocked on a question" },
      { label: "Questions waiting", value: oq.length,
        sub: ppl.length + " people · " + notAsked + " not asked yet" },
      { label: "Answers to fold in", value: fold,
        sub: fold ? "the next /erp-refresh builds them in" : "every answer is in its spec" },
      { label: "Tasks in GitHub", value: inCode.length, sub: live + " live in production" },
      { label: "Waiting for retest", value: ver, sub: "the reporter confirms, then Verified" },
    ]);
  }
  function paintMain(S, animate) {
    var main = S.host.querySelector("#erbMain");
    if (!main) return;
    if (S.view === "person") { paintPeople(S, main); if (animate) fadeIn(main); return; }
    if (S.view === "doc") { paintDoc(S, main); return; }
    main.innerHTML = '<div class="erb-split"><nav class="erb-rail" id="erbRail" '
      + 'aria-label="ERP pages"></nav><section class="erb-pane" id="erbPane"></section></div>';
    paintRail(S);
    showBrief(S);
  }
  function fadeIn(el) {
    el.classList.remove("erb-in");
    void el.offsetWidth;                                      // restart the animation
    el.classList.add("erb-in");
  }
  function showBrief(S) {
    var pane = S.host.querySelector("#erbPane");
    if (!pane || !S.key) return;
    if (cur(S)) {
      paintBrief(S, true);
      getBrief(S, S.key).then(function () { if (!typing(pane)) paintBrief(S, false); }).catch(function () {});
      return;
    }
    pane.innerHTML = '<div class="erb-skel" style="width:40%;height:20px"></div>'
      + '<div class="erb-skel" style="width:70%"></div><div class="erb-skel" style="width:100%;'
      + 'height:120px;border-radius:14px"></div>';
    var key = S.key;
    getBrief(S, key).then(function () { if (key === S.key) paintBrief(S, true); })
      .catch(function (e) { pane.innerHTML = '<div class="panel">' + esc(e.message) + "</div>"; });
  }

  /* -------------------------------------------------------------------- rail */
  function paintRail(S) {
    var el = S.host.querySelector("#erbRail");
    if (!el) return;
    el.innerHTML = S.ov.briefs.map(function (b) {
      var c = b.counts || {}, tot = 0, done = 0;
      Object.keys(c).forEach(function (k) {
        if (k !== "Dropped") tot += c[k];
        if (BUILT.concat(["Verified"]).indexOf(k) >= 0) done += c[k];
      });
      var open = TODO.reduce(function (n, st) { return n + (c[st] || 0); }, 0);
      var inCode = uniq((S.ov.gh.links || []).filter(function (l) { return l["Brief Key"] === b.Key; })
        .map(function (l) { return l["Task Code"]; })).length;
      return '<button class="erb-ri' + (b.Key === S.key ? " on" : "") + '" data-key="'
        + esc(b.Key) + '"' + (b.Key === S.key ? ' aria-current="page"' : "") + ">"
        + '<span class="nm">' + esc(shortOf(b.Key, b.Title)) + "</span>"
        + '<span class="ar">' + esc(areaOf(b.Key, b.Title)) + "</span>"
        + '<span class="st"><span>' + (open ? open + " to do" : "nothing to do") + "</span>"
        + (b.open_questions ? '<span class="q">' + b.open_questions + " to answer</span>" : "")
        + ((c.Verify || 0) ? '<span class="r">' + c.Verify + " to retest</span>" : "")
        + (inCode ? '<span class="g">' + inCode + " in GitHub</span>" : "") + "</span>"
        + '<span class="bar" title="' + done + " of " + tot + ' built or verified"><i style="width:'
        + (tot ? Math.round(100 * done / tot) : 0) + '%"></i></span></button>';
    }).join("");
    el.querySelectorAll("[data-key]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-key");
        if (k === S.key) return;
        S.key = k;
        try { localStorage.setItem("erb-key", S.key); } catch (e) { /* ignore */ }
        el.querySelectorAll(".erb-ri").forEach(function (x) {
          var on = x.getAttribute("data-key") === k;
          x.classList.toggle("on", on);
          if (on) x.setAttribute("aria-current", "page"); else x.removeAttribute("aria-current");
        });
        showBrief(S);
      };
    });
  }

  /* ------------------------------------------------------------------- brief */
  function paintBrief(S, animate) {
    var pane = S.host.querySelector("#erbPane");
    var d = cur(S);
    if (!pane || !d) return;
    var b = d.brief, key = b.Key;
    var open = S.ui && S.ui[key] || {};
    var reporters = uniq((d.sources || []).map(function (s) { return s.Reporter; }));
    var openQ = d.questions.filter(function (q) { return q.Status === "Open"; });
    var todoShip = d.shipped.filter(function (s) { return !+s.Verified; });
    var msgPeople = uniq(flat(openQ.map(function (q) { return peopleIn(S, q.Ask); }))
      .concat(flat(todoShip.map(function (s) { return peopleIn(S, s["Retest By"]); })))
      .concat(flat(d.tasks.filter(function (t) { return t.Status === "Verify"; })
        .map(function (t) { return reportersOf(t, d.sources); }))));
    var owner = peopleIn(S, b.Owner);
    var groups = [
      ["To do", d.tasks.filter(function (t) { return TODO.indexOf(t.Status) >= 0; })],
      ["Built — waiting for the reporter", d.tasks.filter(function (t) { return BUILT.indexOf(t.Status) >= 0; })],
    ];
    var closed = d.tasks.filter(function (t) { return CLOSED.indexOf(t.Status) >= 0; });
    var rest = d.questions.filter(function (q) { return q.Status !== "Open"; });
    pane.innerHTML = ''
      + '<header class="erb-bh"><div class="erb-bt">'
      + '<div class="erb-eyebrow">' + esc(areaOf(key, b.Title)) + "</div>"
      + "<h2>" + esc(shortOf(key, b.Title)) + "</h2>"
      + '<div class="erb-meta">'
      + (reporters.length ? "<span>Reported by " + stack(S, reporters) + "</span>" : "")
      + (owner.length ? "<span>Retests " + stack(S, owner) + "</span>" : "")
      + (b["ERP Page"] ? '<span class="pg">' + inline(b["ERP Page"]) + "</span>" : "")
      + "</div></div>"
      + '<div class="acts">'
      + (msgPeople.length ? '<button class="rs-btn" id="erbMsgAll">Message '
         + (msgPeople.length === 1 ? esc(S.P[msgPeople[0]].Short) : msgPeople.length + " people")
         + "</button>" : "")
      + '<button class="rs-btn" id="erbCopy" title="This page as markdown, for a development '
      + 'chat — it includes how to reference the tasks in commits">Copy for a dev chat</button>'
      + '<button class="rs-btn pri" id="erbAdd">Add task</button></div></header>'
      + '<details class="erb-fold" id="erbCtxD"' + (open.ctx ? " open" : "") + '><summary>'
      + "Background</summary><div class=\"erb-md\" id=\"erbCtxMd\" style=\"margin-top:8px\">"
      + (md(b.Context) || '<p class="erb-dim">No background written yet.</p>') + "</div>"
      + '<button class="erb-tbtn" id="erbCtxEdit">Edit background</button></details>'
      + groups.map(function (g) {
          if (!g[1].length && g[0] !== "To do") return "";
          return '<div class="erb-sec"><span>' + g[0] + '</span><span class="n">' + g[1].length
            + "</span></div>" + (g[1].length ? '<div class="erb-list">' + sortTasks(g[1]).map(function (t) {
              return taskRow(S, d, t);
            }).join("") + "</div>" : '<div class="erb-list"><div class="erb-empty">Nothing to do '
              + "on this page.</div></div>");
        }).join("")
      + (closed.length ? '<details class="erb-fold" id="erbClosedD"' + (open.closed ? " open" : "")
         + "><summary>Closed (" + closed.length + ')</summary><div class="erb-list" '
         + 'style="margin-top:8px">' + closed.map(function (t) { return taskRow(S, d, t); }).join("")
         + "</div></details>" : "")
      + '<div class="erb-sec"><span>Questions</span><span class="n">' + openQ.length + " open · "
      + openQ.filter(function (q) { return !q["Asked At"]; }).length + " not asked yet</span>"
      + '<span class="sp"></span><button class="erb-tbtn pri" id="erbQNewBtn">Ask a new question'
      + "</button></div>"
      + '<div id="erbQNew"></div>'
      + (openQ.length ? '<div class="erb-list" id="erbQs">' + sortQ(openQ).map(function (q) {
          return qRow(S, q);
        }).join("") + "</div>" : '<div class="erb-list"><div class="erb-empty">No open questions '
          + "on this page.</div></div>")
      + (rest.length ? '<details class="erb-fold" id="erbQDoneD"' + (open.qdone ? " open" : "")
         + "><summary>Answered or dropped (" + rest.length + ')</summary><div class="erb-list" '
         + 'id="erbQs2" style="margin-top:8px">' + sortQ(rest).map(function (q) { return qRow(S, q); })
         .join("") + "</div></details>" : "")
      + (d.shipped.length ? '<div class="erb-sec"><span>Already shipped — to confirm</span>'
         + '<span class="n">' + todoShip.length + " left</span></div>"
         + '<div class="erb-list" id="erbShip">' + d.shipped.map(function (s) {
             return shipRow(S, s);
           }).join("") + "</div>" : "")
      + '<details class="erb-fold" id="erbActD"' + (open.act ? " open" : "") + ' style="margin-top:28px">'
      + "<summary>Activity (" + d.changes.length + ")</summary><div id=\"erbAct\" style=\"margin-top:6px\">"
      + (d.changes.slice(0, 80).map(function (c) { return changeLine(S, c); }).join("")
         || '<div class="erb-empty">No changes yet.</div>')
      + '</div><div class="erb-row"><input class="erb-in" id="erbNote" placeholder="Post a note on '
      + 'this page…" style="flex:1"><button class="rs-btn" id="erbNoteAdd">Post</button></div>'
      + "</details>";
    if (animate) fadeIn(pane);

    // remember which folds are open, so a refresh does not snap them shut
    S.ui = S.ui || {};
    S.ui[key] = S.ui[key] || {};
    [["erbCtxD", "ctx"], ["erbClosedD", "closed"], ["erbQDoneD", "qdone"], ["erbActD", "act"]]
      .forEach(function (p) {
        var dEl = pane.querySelector("#" + p[0]);
        if (dEl) dEl.addEventListener("toggle", function () { S.ui[key][p[1]] = dEl.open; });
      });
    var mAll = pane.querySelector("#erbMsgAll");
    if (mAll) mAll.onclick = function () {
      openComposer(S, { ctx: "brief", briefKey: key, people: msgPeople });
    };
    pane.querySelector("#erbCopy").onclick = function () {
      fetchText("key=" + encodeURIComponent(key) + "&format=md").then(copyText).then(function () {
        toast("Copied — paste it into the development chat");
      }).catch(function (e) { toast(e.message, true); });
    };
    pane.querySelector("#erbAdd").onclick = function () { openTask(S, key, null); };
    pane.querySelector("#erbCtxEdit").onclick = function () { editContext(S); };
    pane.querySelector("#erbQNewBtn").onclick = function () { newQuestionForm(S); };
    pane.querySelectorAll("[data-open]").forEach(function (r) {
      r.onclick = function () { openTask(S, key, r.getAttribute("data-open")); };
    });
    wireQRows(S, pane);
    wireShip(S, pane);
    pane.querySelector("#erbNoteAdd").onclick = function () {
      var inp = pane.querySelector("#erbNote"), t = inp.value.trim();
      if (!t) return;
      inp.value = "";
      post({ action: "note", key: key, text: t }).then(function () {
        toast("Note posted"); return refresh(S);
      }).catch(function (e) { toast(e.message, true); });
    };
  }
  function sortTasks(list) {
    return list.slice().sort(function (a, b) {
      return (PRIO_RANK[a.Priority] - PRIO_RANK[b.Priority]) || (a.Sort - b.Sort);
    });
  }
  function sortQ(list) {
    return list.slice().sort(function (a, b) {
      return a.Code.localeCompare(b.Code, undefined, { numeric: true });
    });
  }
  function taskRow(S, d, t) {
    var qs = d.questions.filter(function (q) { return q["Task Code"] === t.Code; });
    var nq = qs.filter(function (q) { return q.Status === "Open"; }).length;
    var nf = qs.filter(unfolded).length;
    var cs = codeState(linksOf(S, d.brief.Key, t.Code));
    var reps = reportersOf(t, d.sources);
    var bits = [];
    if (reps.length) bits.push("<span>" + stack(S, reps) + "</span>");
    if (nq) bits.push('<span class="q">' + nq + (nq === 1 ? " question open" : " questions open") + "</span>");
    if (nf) bits.push('<span class="f">' + nf + (nf === 1 ? " answer" : " answers") + " to fold in</span>");
    if (cs) bits.push("<span>" + chip(cs.label, cs.tone) + "</span>");
    if (t.Assignee) bits.push("<span>with " + esc(t.Assignee) + "</span>");
    return '<button class="erb-trow" data-open="' + esc(t.Code) + '">'
      + '<span class="erb-code">' + esc(t.Code) + "</span>"
      + '<span><span class="t">' + esc(t.Title) + "</span>"
      + (bits.length ? '<span class="sub">' + bits.join("") + "</span>" : "") + "</span>"
      + prChip(t.Priority) + stChip(t.Status) + "</button>";
  }

  function editContext(S) {
    var d = cur(S);
    var det = S.host.querySelector("#erbCtxD");
    det.open = true;
    var mount = det.querySelector("#erbCtxMd");
    det.querySelector("#erbCtxEdit").style.display = "none";
    mount.innerHTML = '<textarea class="erb-in big" id="erbCtxTa">' + esc(d.brief.Context || "")
      + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="erbCtxSave">Save</button>'
      + '<button class="rs-btn" id="erbCtxCancel">Cancel</button>'
      + '<span class="erb-hint">Markdown. It is the first thing a development chat reads.</span></div>';
    mount.querySelector("#erbCtxTa").focus();
    mount.querySelector("#erbCtxCancel").onclick = function () { paintBrief(S, false); };
    mount.querySelector("#erbCtxSave").onclick = function () {
      var v = mount.querySelector("#erbCtxTa").value;
      d.brief.Context = v;
      paintBrief(S, false);
      post({ action: "brief_set", key: S.key, context: v })
        .then(function () { toast("Background saved"); return refresh(S); })
        .catch(function (e) { toast(e.message, true); refresh(S); });
    };
  }

  function newQuestionForm(S) {
    var host = S.host.querySelector("#erbQNew");
    if (host.innerHTML) { host.innerHTML = ""; return; }
    var d = cur(S);
    host.innerHTML = '<div class="erb-new erb-in">'
      + '<div class="g"><textarea class="erb-in" id="nqText" style="min-height:44px" '
      + 'placeholder="The question, the way the person you ask will read it…"></textarea>'
      + '<input class="erb-in" id="nqWho" placeholder="Ask whom — e.g. Bacho">'
      + '<div id="nqTask"></div><button class="rs-btn pri" id="nqAdd">Add</button></div>'
      + '<span class="erb-hint">A question on a task moves it to Needs clarification until '
      + "somebody answers it.</span></div>";
    var hTask = RSC.localSelect(host.querySelector("#nqTask"), {
      label: "Task", values: d.tasks.map(function (t) { return t.Code; }), value: "",
      allLabel: "no task", form: true,
    });
    host.querySelector("#nqText").focus();
    host.querySelector("#nqAdd").onclick = function () {
      var q = host.querySelector("#nqText").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      post({ action: "question_add", key: S.key, question: q,
             ask: host.querySelector("#nqWho").value.trim(), task_code: hTask.get() || "" })
        .then(function (r) { host.innerHTML = ""; toast("Question " + r.code + " added"); return refresh(S); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  /* --------------------------------------------------------------- questions */
  function askedChip(q) {
    if (unfolded(q)) {
      return '<span class="erb-asked fold" title="Answered; the spec does not say it yet — '
        + 'the next refine folds it in">not in the spec yet</span>';
    }
    if (q.Status !== "Open") return "";
    return q["Asked At"]
      ? '<span class="erb-asked" title="' + esc(when(q["Asked At"]) + " · by " + who(q["Asked By"]))
        + '">asked ' + esc(ago(q["Asked At"])) + "</span>"
      : '<span class="erb-asked no">not asked yet</span>';
  }
  function qRow(S, q, opt) {
    opt = opt || {};
    var open = q.Status === "Open";
    var ask = peopleIn(S, q.Ask);
    var t = findTask(S, q["Brief Key"], q["Task Code"]);
    return '<div class="erb-q' + (open ? "" : " done") + '" data-q="'
      + esc(q["Brief Key"] + ":" + q.Code) + '">'
      + '<div class="hd"><span class="erb-code q">' + esc(q.Code) + "</span>"
      + '<div class="qt">' + inline(q.Question) + "</div></div>"
      + '<div class="qm">'
      + (t && !opt.noTask ? '<button class="erb-link" data-task="' + esc(t.Code) + '">'
         + esc(t.Code) + " · " + esc(t.Title) + "</button>" : "")
      + (q.Ask ? "<span>ask " + stack(S, ask, true) + " " + esc(q.Ask) + "</span>" : "")
      + (open ? askedChip(q) : (q.Status === "Answered" ? askedChip(q) || chip("answered", "ok")
          : chip(q.Status.toLowerCase(), "mute")))
      + "</div>"
      + (q.Answer ? '<div class="erb-ans"><div class="by">' + esc(who(q["Answered By"])) + " · "
         + esc(when(q["Answered At"])) + '</div><div class="erb-md">' + md(q.Answer) + "</div></div>"
         : "")
      + '<div class="erb-exp"><div><div class="in"></div></div></div>'
      + '<div class="acts">'
      + '<button class="erb-tbtn pri" data-act="answer">' + (q.Answer ? "Edit answer" : "Answer")
      + "</button>"
      + (open && ask.length ? '<button class="erb-tbtn" data-act="msg">Message '
         + esc(ask.length === 1 ? S.P[ask[0]].Short : ask.length + " people") + "</button>" : "")
      + '<button class="erb-tbtn danger" data-act="' + (open ? "drop" : "reopen") + '">'
      + (open ? "Drop" : "Reopen") + "</button></div></div>";
  }
  function wireQRows(S, root) {
    root.querySelectorAll(".erb-q").forEach(function (row) {
      var parts = row.getAttribute("data-q").split(":"), bk = parts[0], code = parts[1];
      var q = findQ(S, bk, code);
      if (!q) return;
      row.querySelectorAll("[data-task]").forEach(function (b) {
        b.onclick = function () { openTaskAnywhere(S, bk, b.getAttribute("data-task")); };
      });
      row.querySelectorAll("[data-act]").forEach(function (b) {
        var act = b.getAttribute("data-act");
        b.onclick = function () {
          if (act === "answer") { editAnswer(S, row, q); return; }
          if (act === "msg") {
            openComposer(S, { ctx: "brief", briefKey: bk, people: peopleIn(S, q.Ask) });
            return;
          }
          var prev = q.Status;
          q.Status = act === "drop" ? "Dropped" : "Open";
          softPaint(S);
          post({ action: "question_set", key: bk, code: code, fields: { status: q.Status } })
            .then(function () {
              toast(act === "drop" ? "Question dropped" : "Question reopened");
              return refresh(S, bk);
            }).catch(function (e) { q.Status = prev; softPaint(S); toast(e.message, true); });
        };
      });
    });
  }
  function editAnswer(S, row, q) {
    var exp = row.querySelector(".erb-exp"), box = exp.querySelector(".in");
    if (exp.classList.contains("open")) { exp.classList.remove("open"); return; }
    box.innerHTML = '<textarea class="erb-in" placeholder="The answer, in the words the '
      + 'developer needs — a decision, a number, a list…">' + esc(q.Answer || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri erb-sm" data-s>Save answer</button>'
      + '<button class="rs-btn erb-sm" data-c>Cancel</button>'
      + '<span class="erb-hint">The next refine folds it into the task’s spec; a task with no '
      + "open question left becomes Ready.</span></div>";
    exp.classList.add("open");
    var ta = box.querySelector("textarea");
    setTimeout(function () { ta.focus(); }, 60);
    box.querySelector("[data-c]").onclick = function () { exp.classList.remove("open"); };
    box.querySelector("[data-s]").onclick = function () {
      var a = ta.value.trim();
      if (!a) { toast("Write the answer first", true); return; }
      var snap = { Answer: q.Answer, Status: q.Status, by: q["Answered By"], at: q["Answered At"],
                   f: q["Folded At"] };
      q.Answer = a; q.Status = "Answered"; q["Answered By"] = S.ov.me;
      q["Answered At"] = new Date().toISOString(); q["Folded At"] = null;
      ta.blur();
      softPaint(S);
      post({ action: "question_set", key: q["Brief Key"], code: q.Code, fields: { answer: a } })
        .then(function () { toast("Answer saved"); return refresh(S, q["Brief Key"]); })
        .catch(function (e) {
          q.Answer = snap.Answer; q.Status = snap.Status; q["Answered By"] = snap.by;
          q["Answered At"] = snap.at; q["Folded At"] = snap.f;
          softPaint(S); toast(e.message, true);
        });
    };
  }

  /* ----------------------------------------------------------------- shipped */
  function shipRow(S, s) {
    var ppl = peopleIn(S, s["Retest By"]);
    var askedAt = ppl.map(function (k) { return S.shipAsked[s.id + "|" + k]; }).filter(Boolean)[0];
    var ok = !!+s.Verified;
    return '<div class="erb-rt' + (ok ? " ok" : "") + '"><input type="checkbox" aria-label="Confirmed" '
      + 'data-ship="' + s.id + '"' + (ok ? " checked" : "") + ">"
      + '<div><div class="w">' + inline(s.What) + '</div><div class="m"><span>' + esc(s.Deploy || "")
      + "</span><span>" + (stack(S, ppl) || esc(s["Retest By"] || "")) + "</span>"
      + (ok ? "<span>confirmed by " + esc(who(s["Verified By"])) + " " + esc(dayOf(s["Verified At"]))
         + "</span>" : (askedAt ? '<span class="erb-asked">asked ' + esc(ago(askedAt)) + "</span>" : ""))
      + "</div></div>"
      + (!ok && ppl.length ? '<button class="erb-tbtn" data-shipmsg="' + s.id + '">Ask to retest</button>'
         : "<span></span>") + "</div>";
  }
  function wireShip(S, root) {
    var d = cur(S);
    root.querySelectorAll("[data-ship]").forEach(function (cb) {
      cb.onchange = function () {
        var s = d.shipped.filter(function (x) { return String(x.id) === cb.getAttribute("data-ship"); })[0];
        if (!s) return;
        var prev = s.Verified;
        s.Verified = cb.checked ? 1 : 0;
        s["Verified By"] = S.ov.me; s["Verified At"] = new Date().toISOString();
        cb.closest(".erb-rt").classList.toggle("ok", cb.checked);
        post({ action: "shipped_set", key: S.key, id: s.id, verified: cb.checked })
          .then(function () { toast(cb.checked ? "Confirmed" : "Unconfirmed"); return refresh(S); })
          .catch(function (e) { s.Verified = prev; softPaint(S); toast(e.message, true); });
      };
    });
    root.querySelectorAll("[data-shipmsg]").forEach(function (b) {
      b.onclick = function () {
        var s = d.shipped.filter(function (x) { return String(x.id) === b.getAttribute("data-shipmsg"); })[0];
        openComposer(S, { ctx: "brief", briefKey: S.key, people: peopleIn(S, s["Retest By"]),
                          onlyShip: s.id });
      };
    });
  }

  /* ---------------------------------------------------------------- activity */
  function changeLine(S, c) {
    var what, code = esc(c["Entity Code"] || "");
    var by = c.By === "github" ? "GitHub" : who(c.By);
    if (c.Field === "Note") what = 'noted: <span class="v">' + inline(c.New) + "</span>";
    else if (c.Field === "Created") what = "created <b>" + code + "</b> " + esc(c.New);
    else if (c.Field === "Answer") what = "answered <b>" + code + "</b>";
    else if (c.Field === "Folded") what = "folded the answer to <b>" + code + "</b> " + esc(c.New || "") + " into the spec";
    else if (c.Field === "Asked") {
      var p = S.P[c.New];
      what = "put <b>" + code + "</b> to " + esc(p ? p.Short : c.New);
    } else if (c.Field === "Code") {
      what = c.New ? "linked <b>" + code + "</b> to " + esc(String(c.New).replace("pr#", "PR #").replace("c:", "commit "))
        : "unlinked " + esc(String(c.Old).replace("pr#", "PR #").replace("c:", "commit ")) + " from <b>" + code + "</b>";
    } else if (c.Field === "Body" || c.Field === "Context" || c.Field === "Notes") {
      what = (c.By === "claude (refine)" ? "rewrote " : "edited ") + "the "
        + esc(c.Field === "Context" ? "background" : c.Field === "Body" ? "spec" : "notes")
        + (c.Entity === "brief" ? "" : " of <b>" + code + "</b>");
    } else if (c.Field === "Verified") {
      what = (String(c.New) === "1" ? "confirmed" : "unconfirmed") + " a shipped change";
    } else {
      what = "<b>" + code + "</b> " + esc(c.Field.toLowerCase()) + ": " + esc(c.Old || "—")
        + ' → <span class="v">' + esc(c.New || "—") + "</span>";
    }
    return '<div class="erb-act"><span class="d" title="' + esc(when(c.At)) + '">'
      + esc(ago(c.At)) + "</span><b>" + esc(by) + "</b> " + what + "</div>";
  }

  /* ----------------------------------------------------------------- people */
  function retestItems(it) {
    return it.verify.map(function (t) { return { kind: "task", t: t }; })
      .concat(it.ship.map(function (s) { return { kind: "ship", s: s }; }));
  }
  function paintPeople(S, main) {
    var cards = (S.ov.people || []).map(function (p) {
      var it = personItems(S, p.Key);
      return { p: p, it: it, rt: retestItems(it) };
    }).filter(function (c) { return c.it.qs.length || c.rt.length || c.it.reports.length; })
      .sort(function (a, b) {
        return (b.it.qs.length - a.it.qs.length) || (b.rt.length - a.rt.length)
          || (b.it.reports.length - a.it.reports.length);
      });
    main.innerHTML = cards.length ? '<div class="erb-people">' + cards.map(function (c) {
      return personCard(S, c);
    }).join("") + "</div>" : '<div class="erb-list"><div class="erb-empty">Nobody is waiting on '
      + "anything.</div></div>";
    main.querySelectorAll("[data-write]").forEach(function (b) {
      b.onclick = function () {
        openComposer(S, { ctx: "person", people: [b.getAttribute("data-write")] });
      };
    });
    main.querySelectorAll("[data-goto]").forEach(function (b) {
      b.onclick = function () {
        var p = b.getAttribute("data-goto").split(":");
        openTaskAnywhere(S, p[0], p[1]);
      };
    });
  }
  function personCard(S, c) {
    var p = c.p, it = c.it, k = p.Key, last = S.lastMsg[k];
    function taskChip(bk, code) {
      var t = S.TASK[bk + ":" + code];
      return '<button class="erb-link" data-goto="' + esc(bk + ":" + code) + '">'
        + esc(shortOf(bk) + " · " + code) + "</button>" + (t ? " " + esc(t.Title) : "");
    }
    var html = '<article class="erb-pc">'
      + "<header>" + av(S, k, "lg") + '<div class="n"><b>' + esc(p.Name) + "</b><span>"
      + esc(p.Role || "") + "</span></div>"
      + '<div class="stats">'
      + (it.qs.length ? chip(it.qs.length + " to answer", "warn") : "")
      + (c.rt.length ? chip(c.rt.length + " to retest", "info") : "")
      + (it.reports.length ? chip(it.reports.length + " reported", "mute") : "")
      + "</div></header>";
    if (it.qs.length) {
      html += '<div class="erb-pcs">Needs an answer</div><div>' + it.qs.map(function (q) {
        return '<div class="erb-li"><span class="erb-code q">' + esc(q.Code) + "</span><div>"
          + "<div>" + inline(q.Question) + '</div><div class="x">' + taskChip(q["Brief Key"], q["Task Code"])
          + " " + askedChip(q) + "</div></div></div>";
      }).join("") + "</div>";
    }
    if (c.rt.length) {
      html += '<div class="erb-pcs">To retest</div><div>' + c.rt.map(function (r) {
        if (r.kind === "task") {
          return '<div class="erb-li"><span class="erb-code">' + esc(r.t.Code) + "</span><div>"
            + taskChip(r.t["Brief Key"], r.t.Code) + "</div></div>";
        }
        return '<div class="erb-li"><span class="erb-code">live</span><div>' + inline(r.s.What)
          + '<div class="x">' + esc(shortOf(r.s["Brief Key"])) + " · " + esc(liveOf(r.s.Deploy))
          + "</div></div></div>";
      }).join("") + "</div>";
    }
    if (it.reports.length) {
      html += '<details class="erb-fold"><summary>What ' + esc(p.Short) + " reported in Slack ("
        + it.reports.length + ")</summary><div>" + it.reports.map(function (s) {
          var tasks = S.srcTasks[s["Slack TS"]] || [];
          return '<div class="erb-li"><span class="d">' + esc(dayOf(tsDate(s["Slack TS"])))
            + "</span><div><a href=\"" + permalink(s["Slack TS"]) + '" target="_blank" rel="noopener">'
            + esc(s.Kind === "chat" ? s.Title : "“" + s.Title + "”") + " ↗</a>"
            + (s["Tracker Status"] ? " " + chip(s["Tracker Status"], TRACKER_TONE[s["Tracker Status"]]) : "")
            + (tasks.length ? '<div class="x">→ ' + tasks.map(function (t) {
                return '<button class="erb-link" data-goto="' + esc(t["Brief Key"] + ":" + t.Code) + '">'
                  + esc(shortOf(t["Brief Key"]) + " · " + t.Code) + "</button>";
              }).join(", ") + "</div>" : "")
            + "</div></div>";
        }).join("") + "</div></details>";
    }
    html += "<footer><span class=\"erb-hint\">" + (last ? "Last messaged " + esc(ago(last.At))
        + " by " + esc(who(last.By)) : "Not messaged from this page yet") + "</span>"
      + '<div class="b">' + (p["Slack Id"] ? '<a class="rs-btn erb-sm erb-a" href="'
        + dmUrl(p["Slack Id"]) + '">Open DM ↗</a>' : "")
      + ((it.qs.length || c.rt.length) ? '<button class="rs-btn pri erb-sm" data-write="' + esc(k)
        + '">Write message</button>' : "")
      + "</div></footer></article>";
    return html;
  }

  /* --------------------------------------------------------------- document */
  function unfoldedCount(S) { return S.ov.questions.filter(unfolded).length; }
  function paintDocNote(S) {
    var el = S.host.querySelector("#erbDocNote");
    if (!el) return;
    var n = unfoldedCount(S);
    el.innerHTML = n
      ? '<div class="erb-note"><div><b>' + n + (n === 1 ? " answer is" : " answers are")
        + " not in the specs yet.</b> The document lists " + (n === 1 ? "it" : "them")
        + " as decisions under each task. The next /erp-refresh rewrites those specs with the "
        + "answers built in, and this document updates by itself.</div></div>"
      : "";
  }
  function paintDoc(S, main) {
    main.innerHTML = '<div class="erb-docbar"><span class="erb-hint">Everything still to build, '
      + "per ERP page and in priority order — the document to hand over.</span>"
      + '<div class="erb-row" style="margin:0"><button class="rs-btn" id="erbDocCopy">Copy markdown'
      + '</button><button class="rs-btn" id="erbDocOpen">Open printable page ↗</button>'
      + '<button class="rs-btn" id="erbDocReload">Refresh</button></div></div>'
      + '<div id="erbDocNote"></div>'
      + '<div class="erb-docwrap"><nav class="erb-toc" id="erbToc" aria-label="Sections"></nav>'
      + '<article class="erb-doc" id="erbDoc"><div class="erb-skel" style="width:50%;height:22px">'
      + '</div><div class="erb-skel" style="width:80%"></div><div class="erb-skel" style="width:95%">'
      + "</div></article></div>";
    paintDocNote(S);
    function load() {
      return fetchText("format=doc").then(function (t) {
        S.doc = t;
        var art = main.querySelector("#erbDoc");
        if (!art) return;
        art.innerHTML = '<div class="erb-md">' + md(t, 0) + "</div>";
        var toc = main.querySelector("#erbToc");
        toc.innerHTML = Array.prototype.map.call(art.querySelectorAll("h2"), function (h, i) {
          h.id = "erb-doc-" + i;
          return '<a href="#' + h.id + '" data-to="' + h.id + '">' + esc(h.textContent.split(" · ").pop()) + "</a>";
        }).join("");
        toc.querySelectorAll("[data-to]").forEach(function (a) {
          a.onclick = function (e) {
            e.preventDefault();
            var target = art.querySelector("#" + a.getAttribute("data-to"));
            if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
          };
        });
        fadeIn(art);
      }).catch(function (e) {
        var art = main.querySelector("#erbDoc");
        if (art) art.innerHTML = '<div class="erb-empty">' + esc(e.message) + "</div>";
      });
    }
    load();
    main.querySelector("#erbDocReload").onclick = load;
    main.querySelector("#erbDocCopy").onclick = function () {
      (S.doc ? Promise.resolve(S.doc) : fetchText("format=doc")).then(copyText)
        .then(function () { toast("Copied the change document"); })
        .catch(function (e) { toast(e.message, true); });
    };
    main.querySelector("#erbDocOpen").onclick = function () {
      var body = (S.doc ? md(S.doc, 0) : "");
      var html = '<!doctype html><html><head><meta charset="utf-8"><title>ERP — changes to make'
        + "</title><style>body{font:14px/1.65 Inter,-apple-system,'Segoe UI',Roboto,sans-serif;"
        + "max-width:840px;margin:40px auto;padding:0 24px;color:#15191f}h1{font-size:28px;"
        + "letter-spacing:-.4px}h2{font-size:20px;margin-top:40px;padding-top:20px;border-top:1px "
        + "solid #e3e6ea}h3{font-size:15.5px;margin-top:26px}h4{font-size:12.5px;text-transform:"
        + "uppercase;letter-spacing:.05em;color:#5b6573}table{border-collapse:collapse;width:100%;"
        + "margin:10px 0}td,th{border-bottom:1px solid #e8eaee;padding:6px 8px;text-align:left;"
        + "font-size:13px;vertical-align:top}code{background:#f2f4f7;padding:1px 5px;border-radius:"
        + "4px;font-size:.9em}blockquote{margin:10px 0;padding:8px 13px;border-left:3px solid "
        + "#d49b00;background:#fbf7ea}a{color:#2458c6}@media print{a{color:inherit}h2{break-before:"
        + "page}}</style></head><body>" + body + "</body></html>";
      window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
    };
    fadeIn(main);
  }

  /* --------------------------------------------------------------- messages */
  function filedTitle(S, task, pk, srcs) {
    var mine = srcsForTask(task, srcs).filter(function (s) { return s.Reporter === pk; });
    var s = mine.filter(function (x) { return x.Kind !== "chat"; })[0] || mine[0];
    var p = S.P[pk];
    if (!s || s.Kind === "chat" || (p && String(s.Title).trim().toLowerCase() === p.Short.toLowerCase())) {
      return task ? task.Title : "";
    }
    return s.Title;
  }
  function threadFor(task, pk, srcs) {
    var mine = srcsForTask(task, srcs).filter(function (s) { return s.Reporter === pk; });
    var s = mine.filter(function (x) { return x.Kind !== "chat"; }).pop() || mine.pop();
    return s ? s["Slack TS"] : null;
  }
  function buildMessage(S, o) {
    var p = o.person, ka = o.lang === "ka";
    var nm = ka ? (p.KA || p.Short) : p.Short;
    var task = o.task ? o.task.Title : "";
    if (o.kind === "picked") {
      return ka
        ? "გამარჯობა " + nm + "! შენი ჩანაწერი „" + o.filed + "“ სამუშაოდ აიღეს — ახლა არის *"
          + o.task.Status + "* („" + task + "“). როცა გასატესტად მზად იქნება, აქვე მოგწერ."
        : "Hi " + nm + "! Your report “" + o.filed + "” is picked up: it is now *" + o.task.Status
          + "* as part of “" + task + "”. I'll ping you here when it's ready to test.";
    }
    if (o.kind === "retest") {
      return ka
        ? "გამარჯობა " + nm + "! „" + task + "“ მზადაა. გთხოვ, გატესტე " + APP_HOST
          + "-ზე და თუ მუშაობს, Bugs tracker-ში „" + o.filed + "“ მონიშნე *Done*. თუ არა, აქ "
          + "მომწერე რა ნახე (სქრინი ძალიან დაგვეხმარება)."
        : "Hi " + nm + "! “" + task + "” is ready. Please test it on " + APP_HOST
          + " and, if it works, mark “" + o.filed + "” as *Done* in the Bugs tracker. If not, "
          + "reply here with what you saw (a screenshot helps).";
    }
    if (o.kind === "thanks") {
      return ka ? "მადლობა " + nm + "! „" + task + "“ დადასტურდა და დაიხურა. 🙌"
                : "Thanks " + nm + "! “" + task + "” is verified and closed. 🙌";
    }
    var nq = o.qs.length, nr = o.verify.length + o.ship.length;
    var L = [(ka ? "გამარჯობა " : "Hi ") + nm + "! 👋"];
    if (nq) {
      L.push(ka
        ? "ERP-ის ბაგები, რაც #z2z-soft-test-team-ში ჩაიწერა, გიორგიმ სამუშაოდ აიღო. სანამ "
          + "დაიწყებს, შენი პასუხი გვჭირდება " + (nq === 1 ? "ერთ საკითხზე" : nq + " საკითხზე")
          + ", რომ ყველაფერი სწორად გაკეთდეს:"
        : "About the ERP bugs from #z2z-soft-test-team: Giorgi is picking them up, and "
          + (nq === 1 ? "one point needs your answer first so it gets" : nq
             + " points need your answer first so they get") + " built right:");
      uniq(o.qs.map(function (q) { return q["Brief Key"]; })).forEach(function (bk) {
        L.push("", "*" + shortOf(bk) + "*");
        o.qs.filter(function (q) { return q["Brief Key"] === bk; }).forEach(function (q) {
          var t = S.TASK[bk + ":" + q["Task Code"]];
          L.push("• " + slackMd(q.Question));
          if (t) L.push("   _" + (ka ? "ამოცანა: " : "task: ") + t.Title + "_");
        });
      });
    }
    if (nr) {
      L.push("");
      L.push(nq
        ? (ka ? "ზოგი რამ უკვე გაშვებულია. გთხოვ, გადაამოწმე " + APP_HOST + "-ზე და თუ მუშაობს, "
                + "Bugs tracker-ში მონიშნე *Done*:"
              : "A few things are already live. Please retest them on " + APP_HOST
                + " and mark them *Done* in the Bugs tracker if they work:")
        : (ka ? "ERP-ში რამდენიმე რამ, რაც ითხოვე, უკვე გაშვებულია. გთხოვ, გადაამოწმე " + APP_HOST
                + "-ზე და თუ მუშაობს, Bugs tracker-ში მონიშნე *Done*:"
              : "Some of the ERP changes you asked for are already live. Please retest them on "
                + APP_HOST + " and mark them *Done* in the Bugs tracker if they work:"));
      o.verify.forEach(function (t) {
        L.push("• " + t.Title + " _(" + shortOf(t["Brief Key"]) + ")_");
      });
      o.ship.forEach(function (s) {
        var lv = liveOf(s.Deploy);
        L.push("• " + slackMd(s.What) + (lv ? " _(" + (ka ? "გაშვებულია " : "live since ") + lv + ")_" : ""));
      });
    }
    L.push("");
    L.push(nq ? (ka ? "უბრალოდ აქ მიპასუხე. მადლობა!" : "Just reply here. Thanks!")
              : (ka ? "თუ რამე ისევ არასწორადაა, აქ მომწერე სქრინით. მადლობა!"
                    : "If something still looks wrong, reply here with a screenshot. Thanks!"));
    return L.join("\n");
  }

  // one composer for every entry point. cfg.ctx: "person" (everything waiting on them),
  // "brief" (their share of one ERP page), "task" (one task: questions, picked up, ready to
  // retest, thanks). The text regenerates from what is ticked until somebody edits it.
  function openComposer(S, cfg) {
    var people = uniq(cfg.people).filter(function (k) { return S.P[k]; });
    if (!people.length) { toast("Nobody to message — name someone in the question's “ask”", true); return; }
    var bkey = cfg.briefKey || (cfg.task && cfg.task["Brief Key"]);
    var srcs = (bkey && S.det[bkey] && S.det[bkey].sources) || S.ov.sources;
    var st = { pk: people[0], lang: null, kind: null, off: {}, custom: null };
    var wrap = document.createElement("div");
    wrap.className = "erb-mwrap";
    wrap.innerHTML = '<div class="erb-modal" role="dialog" aria-modal="true" aria-label="Write a '
      + 'message"></div>';
    document.body.appendChild(wrap);
    var m = wrap.firstChild;
    function close() {
      document.removeEventListener("keydown", onKey);
      wrap.classList.add("out");
      setTimeout(function () { wrap.remove(); }, 170);
    }
    function onKey(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", onKey);
    wrap.onclick = function (e) { if (e.target === wrap) close(); };

    function itemsFor(pk) {
      var it = personItems(S, pk);
      if (cfg.ctx === "brief") {
        var inB = function (x) { return x["Brief Key"] === cfg.briefKey; };
        it = { qs: it.qs.filter(inB), verify: it.verify.filter(inB),
               ship: it.ship.concat(it.shipExtra).filter(inB),
               extra: it.shipExtra.filter(inB) };
        if (cfg.onlyShip) {
          it.qs = []; it.verify = []; it.extra = [];
          it.ship = it.ship.filter(function (s) { return s.id === cfg.onlyShip; });
        }
      } else if (cfg.ctx === "task") {
        it = { qs: it.qs.filter(function (q) {
                 return q["Brief Key"] === cfg.task["Brief Key"] && q["Task Code"] === cfg.task.Code;
               }), verify: [], ship: [] };
      } else {
        it = { qs: it.qs, verify: it.verify, ship: it.ship.concat(it.shipExtra),
               extra: it.shipExtra };
      }
      return it;
    }
    function resetFor(pk) {
      st.pk = pk; st.lang = (S.P[pk] && S.P[pk].Lang) || "en"; st.custom = null; st.off = {};
      var it = itemsFor(pk);
      (it.extra || []).forEach(function (s) { st.off["s:" + s.id] = true; });
      if (cfg.ctx === "task") {
        var t = cfg.task;
        st.kind = it.qs.length ? "questions" : t.Status === "Verify" ? "retest"
          : t.Status === "Verified" ? "thanks" : "picked";
      } else st.kind = "questions";
    }
    resetFor(people[0]);

    function paint() {
      var p = S.P[st.pk], it = itemsFor(st.pk);
      var sel = {
        qs: it.qs.filter(function (q) { return !st.off["q:" + q["Brief Key"] + ":" + q.Code]; }),
        verify: it.verify.filter(function (t) { return !st.off["t:" + t["Brief Key"] + ":" + t.Code]; }),
        ship: it.ship.filter(function (s) { return !st.off["s:" + s.id]; }),
      };
      var gen = buildMessage(S, { person: p, lang: st.lang, kind: st.kind, qs: sel.qs,
        verify: sel.verify, ship: sel.ship, task: cfg.task,
        filed: cfg.task ? filedTitle(S, cfg.task, st.pk, srcs) : "" });
      var text = st.custom != null ? st.custom : gen;
      var thread = cfg.ctx === "task" ? threadFor(cfg.task, st.pk, srcs) : null;
      var last = S.lastMsg[st.pk];
      var kinds = cfg.ctx === "task" ? [["questions", "Questions"], ["picked", "Picked up"],
                                        ["retest", "Ready to retest"], ["thanks", "Thanks"]] : null;
      var listed = st.kind === "questions" && (it.qs.length + it.verify.length + it.ship.length);
      var title = cfg.ctx === "task" ? "Message about " + cfg.task.Code + " · " + cfg.task.Title
        : cfg.ctx === "brief" ? "Message about " + shortOf(cfg.briefKey) : "Message " + p.Short;
      m.innerHTML = '<div class="hd"><h3>' + esc(title) + '</h3><button class="rs-btn erb-sm" '
        + 'data-x aria-label="Close">✕</button></div>'
        + (people.length > 1 ? '<div class="erb-tos" role="tablist">' + people.map(function (k) {
            var n = itemsFor(k);
            var cnt = n.qs.length + n.verify.length + n.ship.length;
            return '<button class="erb-to' + (k === st.pk ? " on" : "") + '" data-to="' + esc(k)
              + '" role="tab" aria-selected="' + (k === st.pk) + '">' + av(S, k) + esc(S.P[k].Short)
              + (cnt ? "<small>" + cnt + "</small>" : "") + "</button>";
          }).join("") + "</div>"
          : '<div class="erb-tos">' + whoChip(S, st.pk) + '<span class="erb-hint">'
            + esc(p.Role || "") + "</span></div>")
        + '<div class="erb-ctl">'
        + (kinds ? '<div class="rs-seg" data-kinds>' + kinds.map(function (k) {
            var dis = k[0] === "questions" && !it.qs.length;
            return '<button data-kind="' + k[0] + '" class="' + (st.kind === k[0] ? "on" : "") + '"'
              + (dis ? " disabled title=\"No open question for " + esc(p.Short) + ' on this task"' : "")
              + ">" + k[1] + "</button>";
          }).join("") + "</div>" : "")
        + '<div class="rs-seg" data-langs><button data-lang="en" class="' + (st.lang === "en" ? "on" : "")
        + '">English</button><button data-lang="ka" class="' + (st.lang === "ka" ? "on" : "")
        + '">ქართული</button></div></div>'
        + (listed ? '<div class="erb-items">'
          + it.qs.map(function (q) {
              var id = "q:" + q["Brief Key"] + ":" + q.Code;
              var t = S.TASK[q["Brief Key"] + ":" + q["Task Code"]];
              return '<label><input type="checkbox" data-i="' + esc(id) + '"' + (st.off[id] ? "" : " checked")
                + "><span><b>" + esc(q.Code) + "</b> " + inline(q.Question) + " <i>· "
                + esc(shortOf(q["Brief Key"])) + (t ? " · " + esc(t.Code) : "") + "</i>" + askedChip(q)
                + "</span></label>";
            }).join("")
          + it.verify.map(function (t) {
              var id = "t:" + t["Brief Key"] + ":" + t.Code;
              var at = S.taskAsked[t["Brief Key"] + ":" + t.Code + "|" + st.pk];
              return '<label><input type="checkbox" data-i="' + esc(id) + '"' + (st.off[id] ? "" : " checked")
                + "><span>Retest: " + esc(t.Title) + " <i>· " + esc(shortOf(t["Brief Key"])) + "</i>"
                + (at ? '<span class="erb-asked">asked ' + esc(ago(at)) + "</span>" : "") + "</span></label>";
            }).join("")
          + it.ship.map(function (s) {
              var id = "s:" + s.id;
              var at = S.shipAsked[s.id + "|" + st.pk];
              return '<label><input type="checkbox" data-i="' + esc(id) + '"' + (st.off[id] ? "" : " checked")
                + "><span>Retest: " + inline(s.What) + " <i>· " + esc(shortOf(s["Brief Key"])) + "</i>"
                + (at ? '<span class="erb-asked">asked ' + esc(ago(at)) + "</span>" : "") + "</span></label>";
            }).join("") + "</div>" : "")
        + '<textarea class="erb-in erb-msg" aria-label="Message text">' + esc(text) + "</textarea>"
        + '<div class="erb-where"><span>Paste it into</span>'
        + (thread ? '<a class="rs-btn erb-sm erb-a" href="' + permalink(thread) + '" target="_blank" '
          + 'rel="noopener">their Slack thread ↗</a>' : "")
        + (p["Slack Id"] ? '<a class="rs-btn erb-sm erb-a" href="' + dmUrl(p["Slack Id"])
          + '">a DM with ' + esc(p.Short) + " ↗</a>" : "")
        + '<a class="rs-btn erb-sm erb-a" href="' + CHANNEL_URL + '" target="_blank" rel="noopener">'
        + "#z2z-soft-test-team ↗</a></div>"
        + '<div class="ft"><span class="erb-hint">' + (last ? "Last messaged " + esc(ago(last.At))
          + " by " + esc(who(last.By)) : "Not messaged from this page yet")
        + (st.custom != null ? ' · <button class="erb-link" data-regen>undo my edits</button>' : "")
        + '</span><div class="b"><button class="rs-btn" data-copy>Copy</button>'
        + '<button class="rs-btn pri" data-sent>Copy and mark as sent</button></div></div>';

      m.querySelector("[data-x]").onclick = close;
      m.querySelectorAll("[data-to]").forEach(function (b) {
        b.onclick = function () { resetFor(b.getAttribute("data-to")); paint(); };
      });
      m.querySelectorAll("[data-kind]").forEach(function (b) {
        b.onclick = function () {
          if (b.disabled) return;
          st.kind = b.getAttribute("data-kind"); st.custom = null; paint();
        };
      });
      m.querySelectorAll("[data-lang]").forEach(function (b) {
        b.onclick = function () { st.lang = b.getAttribute("data-lang"); st.custom = null; paint(); };
      });
      m.querySelectorAll("[data-i]").forEach(function (cb) {
        cb.onchange = function () {
          st.off[cb.getAttribute("data-i")] = !cb.checked; st.custom = null; paint();
        };
      });
      var ta = m.querySelector("textarea");
      ta.oninput = function () { st.custom = ta.value; };
      var rg = m.querySelector("[data-regen]");
      if (rg) rg.onclick = function () { st.custom = null; paint(); };
      m.querySelector("[data-copy]").onclick = function () {
        copyText(ta.value).then(function () { toast("Copied — paste it into Slack"); })
          .catch(function (e) { toast(e.message, true); });
      };
      m.querySelector("[data-sent]").onclick = function () {
        var txt = ta.value.trim();
        if (txt.length < 5) { toast("The message is empty", true); return; }
        var payload = {
          action: "mark_sent", person: st.pk, kind: st.kind, lang: st.lang, text: txt,
          key: bkey || null, task_code: cfg.task ? cfg.task.Code : null,
          questions: st.kind === "questions" ? sel.qs.map(function (q) {
            return { key: q["Brief Key"], code: q.Code };
          }) : [],
          shipped: st.kind === "questions" ? sel.ship.map(function (s) { return s.id; }) : [],
          tasks: st.kind === "questions" ? sel.verify.map(function (t) {
            return t["Brief Key"] + ":" + t.Code;
          }) : (cfg.task ? [cfg.task["Brief Key"] + ":" + cfg.task.Code] : []),
        };
        copyText(txt).then(function () { return post(payload); }).then(function () {
          toast("Copied and marked as sent to " + p.Short);
          close();
          return refresh(S, bkey);
        }).catch(function (e) { toast(e.message, true); });
      };
    }
    paint();
    var first = m.querySelector("[data-copy]");
    if (first) first.focus();
  }

  /* ------------------------------------------------------------------ drawer */
  function drawerShell(S, key) {
    var ov = document.createElement("div");
    ov.className = "erb-overlay";
    ov.onclick = function (ev) { if (ev.target === ov) close(); };
    ov.innerHTML = '<div class="erb-drawer" role="dialog" aria-modal="true"></div>';
    document.body.appendChild(ov);
    function onKey(e) {
      if (e.key === "Escape" && !document.querySelector(".erb-mwrap")) close();
    }
    document.addEventListener("keydown", onKey);
    function close() {
      document.removeEventListener("keydown", onKey);
      if (S.dw === dw) S.dw = null;
      ov.classList.add("out");
      setTimeout(function () { ov.remove(); }, 200);
      softPaint(S);
    }
    var dw = { ov: ov, el: ov.querySelector(".erb-drawer"), close: close, code: null, key: key };
    S.dw = dw;
    return dw;
  }
  function openTaskAnywhere(S, bk, code) {
    if (S.view !== "page" || S.key !== bk) {
      S.view = "page"; S.key = bk;
      try { localStorage.setItem("erb-view", "page"); localStorage.setItem("erb-key", bk); } catch (e) { /* ignore */ }
      paintViewSeg(S);
      paintMain(S, true);
    }
    var go = function () { openTask(S, bk, code); };
    if (S.det[bk]) go(); else getBrief(S, bk).then(go).catch(function (e) { toast(e.message, true); });
  }
  function openTask(S, key, code) {
    if (S.dw && document.body.contains(S.dw.ov)) { S.dw.ov.remove(); S.dw = null; }
    var dw = drawerShell(S, key);
    if (!code) { paintTaskEdit(S, dw, null); return; }
    paintTaskView(S, dw, code);
  }
  function srcCard(S, s) {
    var p = S.P[s.Reporter];
    var fb = s["Filed By"] && s["Filed By"] !== s.Reporter ? S.P[s["Filed By"]] : null;
    var txt = String(s.Text || "");
    var long = txt.length > 420 || txt.split("\n").length > 7;
    var at = tsDate(s["Slack TS"]);
    return '<div class="erb-src">'
      + '<div class="h">' + av(S, s.Reporter) + "<b>" + esc(p ? p.Name : s.Reporter) + "</b>"
      + '<span class="k">' + (s.Kind === "chat" ? "channel message" : "bug form")
      + (fb ? " · filed by " + esc(fb.Short) : "") + " · " + esc(when(at))
      + (tzLabel() ? " " + esc(tzLabel()) : "") + "</span>"
      + (s["Tracker Status"] ? chip("tracker: " + s["Tracker Status"], TRACKER_TONE[s["Tracker Status"]],
          "Status in the Slack Bugs tracker when this page was written (10 Sept)") : "")
      + "</div>"
      + (s.Kind !== "chat" ? '<div class="ttl">“' + esc(s.Title) + "”</div>" : "")
      + '<div class="txt' + (long ? " clip" : "") + '">' + linkify(esc(txt)) + "</div>"
      + (long ? '<button class="erb-tbtn" data-more style="margin:4px 0 0 -9px">Show the whole report</button>' : "")
      + (s.Thread ? '<div class="th"><b>' + (s.Kind === "chat" ? "In short" : "In the thread")
         + ":</b> " + linkify(esc(s.Thread)) + "</div>" : "")
      + (s.Files ? '<div class="th"><b>Attached:</b> ' + esc(s.Files)
         + " — open the message to see them.</div>" : "")
      + '<div class="lk"><a class="rs-btn erb-sm erb-a" href="' + permalink(s["Slack TS"])
      + '" target="_blank" rel="noopener">Open in Slack ↗</a>'
      + (s["Record Id"] ? '<a class="rs-btn erb-sm erb-a" href="' + recordUrl(s["Record Id"])
         + '" target="_blank" rel="noopener">Tracker record ↗</a>' : "")
      + "</div></div>";
  }
  function linkRow(l) {
    var pr = l.Kind === "pr";
    var ref = pr ? "#" + l.Number : String(l.Sha || l.Ref || "").replace("c:", "").slice(0, 7);
    var chips = [];
    if (l.State === "merged") chips.push(chip("merged " + dayOf(l["Merged At"]), "info"));
    else if (l.State === "open") chips.push(chip("open", "info"));
    else if (l.State === "closed") chips.push(chip("closed, not merged", "mute"));
    else chips.push(chip("details after the next sync", "mute"));
    if (l["Staging At"]) chips.push(chip("staging " + dayOf(l["Staging At"]), "warn"));
    if (l["Prod At"]) chips.push(chip("live " + dayOf(l["Prod At"]), "ok"));
    var src = l.Source === "message" ? "named in the " + (pr ? "PR" : "commit")
      : l.Source === "backfill" ? "linked at the first import" : "linked by " + who(l.By);
    return '<div class="erb-lr"><span class="erb-ico">' + (pr ? "PR" : "c") + "</span>"
      + '<div><div class="t"><a href="' + esc(l.Url || "#") + '" target="_blank" rel="noopener">'
      + esc(ref) + "</a>" + esc(l.Title || (pr ? "Pull request" : "Commit")) + "</div>"
      + '<div class="m">' + chips.join("") + "<span>" + (l.Rel === "closes" ? "closes this task"
        : "works on it") + " · " + esc(src) + (l.Author ? " · " + esc(l.Author) : "") + "</span></div></div>"
      + '<button class="erb-tbtn danger" data-unlink="' + esc(l.Ref) + '" title="Unlink">Unlink</button></div>';
  }
  function codeSection(S, t) {
    var key = t["Brief Key"], links = linksOf(S, key, t.Code), tag = key + "/" + t.Code;
    var gh = S.ov.gh;
    var sugg = (gh.recent || []).slice(0, 6);
    return '<div class="erb-sec"><span>Code in GitHub</span><span class="n">'
      + (links.length ? links.length + " linked" : "nothing linked yet") + "</span></div>"
      + (links.length ? '<div class="erb-list">' + links.map(linkRow).join("") + "</div>" : "")
      + '<div class="erb-linkin"><input class="erb-in" id="dwGhRef" placeholder="Link a PR or '
      + 'commit — #105, a commit sha, or a GitHub link">'
      + '<div class="rs-seg" id="dwGhRel"><button data-rel="refs" class="on">Works on it</button>'
      + '<button data-rel="closes">Closes it</button></div>'
      + '<button class="rs-btn" id="dwGhAdd">Link</button></div>'
      + (sugg.length ? '<div class="erb-sug"><span class="erb-hint">Recent, not linked to anything:'
         + "</span>" + sugg.map(function (r) {
           return '<button data-sug="#' + r.Number + '" title="' + esc(r.Title || "") + '">#'
             + r.Number + " " + esc(r.Title || "") + "</button>";
         }).join("") + "</div>" : "")
      + '<div class="erb-hint" style="margin-top:8px">From a dev chat it links itself: '
      + "<code>Refs " + esc(tag) + "</code> in a commit while working, <code>Closes " + esc(tag)
      + "</code> in the PR that finishes it — merged moves this task to Done (dev), live to Verify. "
      + '<button class="erb-link" data-copytag="Closes ' + esc(tag) + '">Copy the tag</button></div>';
  }
  function wireCode(S, dw, t) {
    var rel = "refs";
    dw.el.querySelectorAll("#dwGhRel [data-rel]").forEach(function (b) {
      b.onclick = function () {
        rel = b.getAttribute("data-rel");
        dw.el.querySelectorAll("#dwGhRel [data-rel]").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
      };
    });
    var inp = dw.el.querySelector("#dwGhRef");
    dw.el.querySelectorAll("[data-sug]").forEach(function (b) {
      b.onclick = function () { inp.value = b.getAttribute("data-sug"); inp.focus(); };
    });
    function link() {
      var ref = inp.value.trim();
      if (!ref) { inp.focus(); return; }
      var btn = dw.el.querySelector("#dwGhAdd");
      btn.disabled = true; btn.textContent = "Linking…";
      post({ action: "gh_link", key: t["Brief Key"], code: t.Code, ref: ref, rel: rel })
        .then(function (r) {
          inp.value = "";
          toast("Linked " + String(r.ref).replace("pr#", "PR #").replace("c:", "commit ")
            + (r.moved ? " — the task moved on" : ""));
          return refresh(S, t["Brief Key"]);
        }).catch(function (e) {
          btn.disabled = false; btn.textContent = "Link"; toast(e.message, true);
        });
    }
    dw.el.querySelector("#dwGhAdd").onclick = link;
    inp.onkeydown = function (e) { if (e.key === "Enter") link(); };
    dw.el.querySelectorAll("[data-unlink]").forEach(function (b) {
      b.onclick = function () {
        var ref = b.getAttribute("data-unlink");
        b.closest(".erb-lr").style.opacity = ".4";
        post({ action: "gh_unlink", key: t["Brief Key"], code: t.Code, ref: ref })
          .then(function () { toast("Unlinked"); return refresh(S, t["Brief Key"]); })
          .catch(function (e) { b.closest(".erb-lr").style.opacity = ""; toast(e.message, true); });
      };
    });
    var ct = dw.el.querySelector("[data-copytag]");
    if (ct) ct.onclick = function () {
      copyText(ct.getAttribute("data-copytag")).then(function () { toast("Copied — put it in the PR description"); });
    };
  }
  function taskChanges(d, code) {
    return d.changes.filter(function (c) {
      return c["Entity Code"] === code || (c.Entity === "question" && d.questions.some(
        function (q) { return q.Code === c["Entity Code"] && q["Task Code"] === code; }));
    });
  }

  function paintTaskView(S, dw, code) {
    var d = S.det[dw.key];
    var t = d && d.tasks.filter(function (x) { return x.Code === code; })[0];
    if (!t) { dw.close(); return; }
    dw.code = code;
    var srcs = srcsForTask(t, d.sources);
    var reps = uniq(srcs.map(function (s) { return s.Reporter; }));
    var qs = d.questions.filter(function (q) { return q["Task Code"] === code; });
    var openQs = qs.filter(function (q) { return q.Status === "Open"; });
    var askP = uniq(flat(openQs.map(function (q) { return peopleIn(S, q.Ask); })));
    var writeTo = uniq(reps.concat(askP)).filter(function (k) { return S.P[k]; });
    var cs = codeState(linksOf(S, dw.key, code));
    dw.el.setAttribute("aria-label", t.Code + " " + t.Title);
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><span class="erb-code" style="margin-top:5px">' + esc(t.Code)
      + "</span><h2>" + esc(t.Title) + "</h2>"
      + '<button class="rs-btn erb-sm" id="dwEdit">Edit</button>'
      + '<button class="rs-btn erb-sm" id="dwClose" aria-label="Close">✕</button></div>'
      + '<div class="erb-meta"><span class="erb-eyebrow">' + esc(shortOf(d.brief.Key, d.brief.Title))
      + "</span>" + prChip(t.Priority) + stChip(t.Status)
      + (cs ? chip(cs.label, cs.tone) : "")
      + '<span class="erb-dim" title="' + esc(when(t["Updated At"])) + '">updated '
      + esc(ago(t["Updated At"])) + " by " + esc(t["Updated By"] === "github" ? "GitHub" : who(t["Updated By"])) + "</span>"
      + (srcs.length ? "<span>reported by " + stack(S, reps) + ' · <button class="erb-link" '
         + "data-jump>" + srcs.length + (srcs.length === 1 ? " Slack report" : " Slack reports")
         + " ↓</button></span>" : "")
      + "</div>"
      + '<div class="erb-strip" id="dwStrip" role="group" aria-label="Status">' + STATUSES.map(function (st) {
          return '<button class="erb-stbtn' + (t.Status === st ? " on" : "") + '" data-st="'
            + esc(st) + '" aria-pressed="' + (t.Status === st) + '">' + esc(st) + "</button>";
        }).join("") + "</div>"
      + '<div class="erb-row"><div style="flex:0 0 150px"><span class="erb-lbl">Priority</span>'
      + '<div id="dwPrio"></div></div>'
      + '<div style="flex:1 1 220px"><span class="erb-lbl">Who is on it (a dev chat, a person…)</span>'
      + '<input class="erb-in" id="dwWho" value="' + esc(t.Assignee || "") + '"></div></div>'
      + (writeTo.length ? '<div class="erb-sec"><span>Message</span></div><div class="erb-writes">'
         + writeTo.map(function (k) {
             return '<button class="rs-btn" data-write="' + esc(k) + '">' + av(S, k) + "Write to "
               + esc(S.P[k].Short) + "</button>";
           }).join("") + '</div><div class="erb-hint" style="margin-top:6px">Questions, “picked up”, '
         + "“ready to retest” or “thanks” — in English or Georgian, ready to paste.</div>" : "")
      + '<div class="erb-sec"><span>What to build</span>'
      + (t["Refined At"] ? '<span class="n">refined ' + esc(ago(t["Refined At"])) + "</span>" : "")
      + "</div><div class=\"erb-md\">"
      + (md(t.Body) || '<p class="erb-dim">No spec yet — use Edit.</p>') + "</div>"
      + '<div class="erb-sec"><span>Questions</span><span class="n">' + openQs.length + " open</span></div>"
      + (qs.length ? '<div class="erb-list" id="dwQs">' + sortQ(qs).map(function (q) {
          return qRow(S, q, { noTask: true });
        }).join("") + "</div>" : '<div class="erb-hint">No questions on this task.</div>')
      + '<div class="erb-row"><input class="erb-in" id="dwQNew" placeholder="Ask a question about '
      + 'this task…" style="flex:1 1 240px"><input class="erb-in" id="dwQWho" placeholder="Ask whom" '
      + 'style="flex:0 1 150px"><button class="rs-btn" id="dwQAdd">Add</button></div>'
      + codeSection(S, t)
      + '<div class="erb-sec" id="dwSrc"><span>Reported in Slack</span><span class="n">'
      + srcs.length + (srcs.length === 1 ? " report" : " reports") + "</span></div>"
      + (srcs.length ? '<div class="erb-list">' + srcs.map(function (s) { return srcCard(S, s); }).join("")
         + "</div>" : '<div class="erb-list"><div class="erb-empty">No Slack report is linked — this '
           + "task was written from the discussion.</div></div>")
      + '<div class="erb-sec"><span>Notes</span></div>'
      + '<textarea class="erb-in" id="dwNotes" placeholder="Decisions, what the dev chat did, '
      + 'where it stands…">' + esc(t.Notes || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="dwNotesSave">Save notes</button></div>'
      + '<details class="erb-fold" style="margin-top:22px"><summary>Activity</summary><div>'
      + (taskChanges(d, code).slice(0, 40).map(function (c) { return changeLine(S, c); }).join("")
         || '<div class="erb-empty">No changes yet.</div>') + "</div></details>";

    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#dwEdit").onclick = function () { paintTaskEdit(S, dw, t); };
    var jump = dw.el.querySelector("[data-jump]");
    if (jump) jump.onclick = function () {
      dw.el.querySelector("#dwSrc").scrollIntoView({ behavior: "smooth", block: "start" });
    };
    dw.el.querySelectorAll("[data-more]").forEach(function (b) {
      b.onclick = function () {
        var txt = b.previousElementSibling;
        txt.classList.toggle("clip");
        b.textContent = txt.classList.contains("clip") ? "Show the whole report" : "Show less";
      };
    });
    dw.el.querySelectorAll("[data-write]").forEach(function (b) {
      b.onclick = function () {
        var k = b.getAttribute("data-write");
        openComposer(S, { ctx: "task", task: t, people: [k].concat(writeTo.filter(function (x) {
          return x !== k;
        })) });
      };
    });
    RSC.localSelect(dw.el.querySelector("#dwPrio"), {
      label: "Priority", values: ["P1", "P2", "P3"], value: t.Priority, form: true,
      required: true, onChange: function (v) { setField("priority", v, "Priority " + v); },
    });
    // optimistic: the screen changes now, the server catches up, a refusal puts it back
    function setField(field, value, msg) {
      var col = { priority: "Priority", status: "Status", assignee: "Assignee", notes: "Notes" }[field];
      var prev = t[col];
      t[col] = value;
      softPaint(S);
      var f = {}; f[field] = value;
      return post({ action: "task_set", key: dw.key, code: code, fields: f })
        .then(function () { if (msg) toast(msg); return refresh(S, dw.key); })
        .catch(function (e) { t[col] = prev; softPaint(S); toast(e.message, true); });
    }
    dw.el.querySelectorAll("#dwStrip [data-st]").forEach(function (b) {
      b.onclick = function () {
        var st = b.getAttribute("data-st");
        if (st === t.Status) return;
        if (st === "Ready" && openQs.length) {
          toast("Answer the open questions first — that is what Ready means", true); return;
        }
        setField("status", st, "Status: " + st);
      };
    });
    var whoIn = dw.el.querySelector("#dwWho");
    whoIn.onchange = function () { setField("assignee", whoIn.value.trim(), "Saved"); };
    dw.el.querySelector("#dwNotesSave").onclick = function () {
      var v = dw.el.querySelector("#dwNotes").value.trim();
      dw.el.querySelector("#dwNotes").blur();
      setField("notes", v, "Notes saved");
    };
    var qList = dw.el.querySelector("#dwQs");
    if (qList) wireQRows(S, qList);
    dw.el.querySelector("#dwQAdd").onclick = function () {
      var q = dw.el.querySelector("#dwQNew").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      dw.el.querySelector("#dwQNew").value = "";
      post({ action: "question_add", key: dw.key, question: q, task_code: code,
             ask: dw.el.querySelector("#dwQWho").value.trim() })
        .then(function (r) { toast("Question " + r.code + " added"); return refresh(S, dw.key); })
        .catch(function (e) { toast(e.message, true); });
    };
    wireCode(S, dw, t);
  }

  function paintTaskEdit(S, dw, t) {
    dw.code = t ? t.Code : null;
    var v = t || { Title: "", Body: "", Priority: "P2", Source: "" };
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><h2>' + (t ? "Edit " + esc(t.Code) : "New task on "
        + esc(shortOf(dw.key))) + "</h2>"
      + '<button class="rs-btn erb-sm" id="dwClose" aria-label="Close">✕</button></div>'
      + '<span class="erb-lbl" style="margin-top:14px">Title</span><input class="erb-in" id="eTitle" '
      + 'maxlength="300" value="' + esc(v.Title) + '">'
      + '<div class="erb-row" style="margin-top:12px"><div style="flex:0 0 150px"><span class="erb-lbl">'
      + 'Priority</span><div id="ePrio"></div></div>'
      + '<div style="flex:1"><span class="erb-lbl">Source — BT ids link it to the Slack reports</span>'
      + '<input class="erb-in" id="eSrc" value="' + esc(v.Source || "") + '"' + (t ? " disabled" : "")
      + ' placeholder="e.g. BT-07, or who asked and when"></div></div>'
      + '<span class="erb-lbl" style="margin-top:12px">What to build — markdown: Why / Spec / '
      + "Acceptance</span>"
      + '<textarea class="erb-in big" id="eBody">' + esc(v.Body || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="eSave">' + (t ? "Save" : "Create")
      + '</button><button class="rs-btn" id="eCancel">Cancel</button></div>';
    var hPrio = RSC.localSelect(dw.el.querySelector("#ePrio"), {
      label: "Priority", values: ["P1", "P2", "P3"], value: v.Priority || "P2", form: true,
      required: true,
    });
    dw.el.querySelector("#eTitle").focus();
    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#eCancel").onclick = function () {
      if (t) paintTaskView(S, dw, t.Code); else dw.close();
    };
    dw.el.querySelector("#eSave").onclick = function () {
      var title = dw.el.querySelector("#eTitle").value.trim();
      var body = dw.el.querySelector("#eBody").value;
      var pr = hPrio.get() || "P2";
      var go = t
        ? post({ action: "task_set", key: dw.key, code: t.Code,
                 fields: { title: title, body: body, priority: pr } })
        : post({ action: "task_add", key: dw.key, title: title, body: body, priority: pr,
                 source: dw.el.querySelector("#eSrc").value.trim() });
      go.then(function (r) {
        toast(t ? "Saved" : "Created " + r.code);
        dw.code = t ? t.Code : r.code;
        document.activeElement && document.activeElement.blur();
        return refresh(S, dw.key);
      }).catch(function (e) { toast(e.message, true); });
    };
  }

  if (window.registerPage) {
    registerPage({
      id: "erp-briefs",
      group: "company",
      title: "ERP Bug Briefs",
      render: render,
    });
  }
})();
