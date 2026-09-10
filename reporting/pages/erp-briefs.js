/* ERP BUG BRIEFS — the ERP test team's tracker as a live document, one brief per ERP page.
 *
 * His ask (2026-09-10): the Slack bugs tracker (#z2z-soft-test-team) grouped, combined and
 * polished into tasks; every unclear point flagged as a question with a name to ask; split
 * by ERP page so each brief can be handed to its own development chat; live, so the team
 * keeps it current here instead of in Slack threads.
 *
 * V3 (same day, his second pass): "give the link to the original slack message, display who
 * filled it, give more details, with easy to copy paste messages to whoever filled it — maybe
 * later we can automatically send those messages too".
 *   - every task shows the Slack reports behind it (erp_source): who, when, the verbatim text,
 *     the thread's gist, and links to the message and the tracker record;
 *   - a "By person" view: what each tester still has to answer or retest, and what they filed;
 *   - a message composer (EN / ქართული) that writes the Slack message for one person, lets you
 *     tick what goes in, copies it, and records it as sent (erp_message). The automatic sender
 *     will write the same row with Via='slack'.
 *
 * /api/_erpbrief sits ABOVE the ACL gate (the _work precedent): the testers hold no report
 * grants and must still answer here. Times from the database are UTC ("…Z") and are shown in
 * the reader's zone through RS.fmtTz, like the rest of the portal.
 */
(function () {
  var STATUSES = ["Open", "Needs clarification", "Ready", "In dev", "Done (dev)", "Verify",
                  "Verified", "Dropped"];
  var TONE = { "Open": "info", "Needs clarification": "warn", "Ready": "ok", "In dev": "ok",
               "Done (dev)": "ok", "Verify": "warn", "Verified": "ok", "Dropped": "mute" };
  var PRIO_TONE = { P1: "bad", P2: "warn", P3: "mute" };
  var OPEN_STATUSES = ["Open", "Needs clarification", "Ready", "In dev"];
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
  function permalink(ts) {
    return CHANNEL_URL + "/p" + String(ts || "").replace(".", "");
  }
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
  function pill(text, tone, title) {
    return '<span class="rs-pill ' + (tone || "mute") + '"' + (title ? ' title="' + esc(title) + '"' : "")
      + ">" + esc(text) + "</span>";
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

  /* ---------------------------------------------------------------- markdown */
  // The subset the briefs use: headings, paragraphs, bullet/numbered lists, GFM tables,
  // blockquotes, bold / italic / code / links. Escaped first, so nothing in a brief runs.
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
    s = s.replace(/(^|[^*\w])\*([^*]+)\*(?!\w)/g, "$1<i>$2</i>");
    s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|\s)(https?:\/\/[^\s<]+)/g,
      '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    return s;
  }
  function md(text) {
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
        var lvl = Math.min(h[1].length + 2, 6);
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
  function injectStyle() {
    var old = document.getElementById("erb-style");
    if (old) old.remove();
    var st = document.createElement("style");
    st.id = "erb-style";
    st.textContent = ""
      + ".erb{font-variant-numeric:tabular-nums}"
      + ".erb .rs-page-head p{max-width:92ch}"
      + ".erb .rs-page-head a{color:var(--brand)}"
      + ".erb-bar{display:flex;gap:10px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;margin:14px 0 16px}"
      + "a.erb-a{text-decoration:none;display:inline-flex;align-items:center;gap:5px}"
      + ".rs-btn.erb-sm{height:28px;padding:0 10px;font-size:12px}"
      + ".rs-btn.erb-ghost{background:transparent;border-color:transparent;color:var(--faint)}"
      + ".rs-btn.erb-ghost:hover{color:var(--neg)}"
      + ".erb-link{font-family:inherit;background:none;border:0;padding:0;color:var(--brand);"
      + "font-size:inherit;font-weight:600;cursor:pointer;text-align:left}"
      + ".erb-link:hover{text-decoration:underline}"
      + ".erb-hint{font-size:11.5px;color:var(--faint)}"
      + ".erb-dim{color:var(--faint)}"
      // rail + pane
      + ".erb-split{display:grid;grid-template-columns:250px minmax(0,1fr);gap:22px;"
      + "align-items:start}"
      + ".erb-rail{position:sticky;top:10px;display:flex;flex-direction:column;gap:3px}"
      + ".erb-ri{font-family:inherit;text-align:left;border:1px solid transparent;"
      + "background:transparent;border-radius:11px;padding:9px 12px 10px;cursor:pointer;"
      + "display:grid;gap:3px;color:var(--ink);transition:background .12s,border-color .12s}"
      + ".erb-ri:hover{background:var(--panel)}"
      + ".erb-ri.on{background:var(--panel);border-color:var(--line-2);"
      + "box-shadow:inset 3px 0 0 var(--brand)}"
      + ".erb-ri:focus-visible,.erb-link:focus-visible,.erb-to:focus-visible{outline:2px solid "
      + "var(--brand);outline-offset:2px}"
      + ".erb-ri .nm{font-weight:700;font-size:13px;line-height:1.3}"
      + ".erb-ri .ar{font-size:11px;color:var(--faint)}"
      + ".erb-ri .st{display:flex;gap:4px 9px;flex-wrap:wrap;font-size:11.5px;color:var(--muted)}"
      + ".erb-ri .st .q{color:var(--warn);font-weight:700}"
      + ".erb-ri .st .r{color:var(--blue);font-weight:700}"
      + ".erb-ri .bar{height:3px;background:var(--line);border-radius:3px;overflow:hidden;"
      + "margin-top:4px}"
      + ".erb-ri .bar i{display:block;height:100%;background:var(--pos);border-radius:3px}"
      + ".erb-pane{min-width:0}"
      + "@media(max-width:1000px){.erb-split{grid-template-columns:1fr}.erb-rail{position:"
      + "static;flex-direction:row;overflow-x:auto;padding-bottom:4px}.erb-ri{min-width:200px}}"
      // brief header
      + ".erb-bh{display:flex;gap:16px;align-items:flex-start;justify-content:space-between;"
      + "flex-wrap:wrap;margin:0 0 12px}"
      + ".erb-bt{min-width:0;flex:1 1 360px}"
      + ".erb-eyebrow{font-size:10.5px;font-weight:800;letter-spacing:.08em;"
      + "text-transform:uppercase;color:var(--faint)}"
      + ".erb-bh h2{font-size:20px;margin:2px 0 6px;line-height:1.25}"
      + ".erb-bh .acts{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-meta{display:flex;flex-wrap:wrap;gap:6px 16px;align-items:center;font-size:12.5px;"
      + "color:var(--muted)}"
      + ".erb-meta .pg{color:var(--faint)}"
      + ".erb-meta > span{display:inline-flex;align-items:center;gap:6px}"
      + ".erb-ctx{margin:0 0 4px}"
      + ".erb-ctx summary,.erb-actd summary,.erb-more summary,.erb-pcr summary{cursor:pointer;"
      + "font-size:12.5px;font-weight:700;color:var(--muted);list-style:none;"
      + "display:inline-flex;gap:6px;align-items:center}"
      + ".erb-ctx summary::before,.erb-actd summary::before,.erb-more summary::before,"
      + ".erb-pcr summary::before{content:'▸';font-size:10px}"
      + ".erb-ctx[open] summary::before,.erb-actd[open] summary::before,.erb-more[open] "
      + "summary::before,.erb-pcr[open] summary::before{content:'▾'}"
      + ".erb-ctx .erb-md{padding:8px 0 6px}"
      + ".erb-sec{font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin:24px 0 9px;display:flex;align-items:center;gap:10px}"
      + ".erb-sec::after{content:'';flex:1;height:1px;background:var(--line);order:2}"
      + ".erb-sec .r{font-weight:600;letter-spacing:0;text-transform:none;color:var(--muted)}"
      + ".erb-sec .rs-btn{order:3}"
      + ".erb-chips{display:flex;gap:5px;flex-wrap:wrap;margin:0 0 10px}"
      + ".erb-chip{font-family:inherit;font-size:11.5px;font-weight:700;padding:4px 11px;"
      + "border-radius:999px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;transition:all .12s}"
      + ".erb-chip:hover{border-color:var(--brand);color:var(--brand)}"
      + ".erb-chip.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".erb-chip small{font-weight:600;opacity:.75;margin-left:4px}"
      + ".erb .rs-table td{vertical-align:middle}"
      + ".erb tr.click:focus-visible{outline:2px solid var(--brand);outline-offset:-2px}"
      + ".erb-tt .t{font-weight:700;color:var(--ink);line-height:1.35}"
      + ".erb-tt .s{font-size:11.5px;color:var(--faint);margin-top:2px;max-width:60ch;"
      + "white-space:nowrap;overflow:hidden;text-overflow:ellipsis}"
      + ".erb-code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;"
      + "font-weight:700;color:var(--brand);background:var(--brand-glow);padding:2px 6px;"
      + "border-radius:5px;white-space:nowrap;display:inline-block}"
      + ".erb-code.q{color:var(--warn);background:var(--warn-bg)}"
      + ".erb-qn{font-size:11.5px;font-weight:700;color:var(--warn)}"
      // people chips / avatars
      + ".erb-av{width:22px;height:22px;border-radius:99px;display:inline-flex;align-items:center;"
      + "justify-content:center;font-size:9.5px;font-weight:800;color:#fff;flex:none;"
      + "background:var(--muted);letter-spacing:.02em}"
      + ".erb-av.lg{width:38px;height:38px;font-size:13px}"
      + ".erb-av.erb-h-brand{background:var(--brand);color:var(--brand-ink)}"
      + ".erb-av.erb-h-blue{background:var(--blue)}.erb-av.erb-h-pos{background:var(--pos)}"
      + ".erb-av.erb-h-neg{background:var(--neg)}.erb-av.erb-h-purple{background:var(--purple)}"
      + ".erb-av.erb-h-muted{background:var(--muted)}"
      + ".erb-who{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;"
      + "color:var(--ink);white-space:nowrap}"
      + ".erb-stack{display:inline-flex;align-items:center}"
      + ".erb-stack .erb-av+.erb-av{margin-left:-6px;box-shadow:0 0 0 2px var(--panel)}"
      + ".erb-stack+.erb-sn{font-size:12.5px;margin-left:6px;color:var(--ink);white-space:nowrap}"
      // questions
      + ".erb-qlist{background:var(--panel);border:1px solid var(--line);border-radius:12px;"
      + "overflow:hidden}"
      + ".erb-qr{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 12px;"
      + "padding:12px 14px;border-bottom:1px solid var(--line);align-items:start}"
      + ".erb-qr:last-child{border-bottom:0}"
      + ".erb-qr.done .qt{color:var(--muted)}"
      + ".erb-qr .qt{font-size:13.5px;line-height:1.5;color:var(--ink)}"
      + ".erb-qr .qm{font-size:12px;color:var(--muted);margin-top:5px;display:flex;"
      + "flex-wrap:wrap;gap:4px 12px;align-items:center}"
      + ".erb-qr .qm > span{display:inline-flex;align-items:center;gap:6px}"
      + ".erb-qr .acts{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}"
      + ".erb-asked{font-size:11px;font-weight:700;padding:2px 8px;border-radius:99px;"
      + "background:var(--panel-2);color:var(--muted);white-space:nowrap}"
      + ".erb-asked.no{background:var(--warn-bg);color:var(--warn)}"
      + ".erb-ans{margin-top:8px;padding:8px 11px;border-radius:9px;background:var(--pos-bg);"
      + "font-size:13px;line-height:1.55}"
      + ".erb-ans .by{font-size:11px;color:var(--muted);font-weight:700;margin-bottom:2px}"
      + ".erb-aed{margin-top:8px}"
      + ".erb-more{margin:10px 0 0}"
      + ".erb-more .erb-qlist{margin-top:8px}"
      + ".erb-new{background:var(--panel);border:1px solid var(--line);border-radius:12px;"
      + "padding:12px 14px;margin:0 0 10px;display:grid;gap:8px}"
      + ".erb-new .g{display:grid;grid-template-columns:minmax(0,1fr) 180px 150px;gap:8px}"
      + "@media(max-width:700px){.erb-new .g{grid-template-columns:1fr}}"
      // rendered markdown
      + ".erb-md{font-size:13.5px;line-height:1.6;color:var(--ink);max-width:80ch}"
      + ".erb-md p{margin:6px 0}.erb-md ul,.erb-md ol{margin:6px 0 8px;padding-left:20px}"
      + ".erb-md li{margin:2px 0}.erb-md h3,.erb-md h4,.erb-md h5{margin:14px 0 4px;"
      + "font-size:13px;font-weight:800}"
      + ".erb-md code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;"
      + "background:var(--panel-2);padding:1px 5px;border-radius:4px}"
      + ".erb-md blockquote{margin:8px 0;padding:6px 12px;border-left:3px solid var(--warn);"
      + "background:var(--panel-2);border-radius:0 8px 8px 0;color:var(--muted)}"
      + ".erb-md a{color:var(--brand)}"
      + ".erb-md .rs-tablewrap{margin:8px 0}.erb-md-t td,.erb-md-t th{font-size:12.5px}"
      // inputs
      + ".erb-in{font-family:inherit;width:100%;background:var(--panel-2);border:1px solid "
      + "var(--line);border-radius:9px;color:var(--ink);padding:8px 11px;font-size:13px;"
      + "outline:0;transition:border-color .12s;box-sizing:border-box}"
      + ".erb-in:focus{border-color:var(--brand)}"
      + "textarea.erb-in{min-height:72px;resize:vertical;line-height:1.5}"
      + "textarea.erb-in.big{min-height:280px;font-family:ui-monospace,Menlo,Consolas,"
      + "monospace;font-size:12.5px}"
      + ".erb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0}"
      + ".erb-lbl{display:block;font-size:10.5px;font-weight:700;letter-spacing:.05em;"
      + "text-transform:uppercase;color:var(--faint);margin:0 0 4px}"
      // Slack source cards
      + ".erb-src{border:1px solid var(--line);border-radius:12px;background:var(--panel);"
      + "padding:12px 14px;margin:0 0 10px}"
      + ".erb-src .h{display:flex;gap:6px 10px;align-items:center;flex-wrap:wrap;font-size:12.5px}"
      + ".erb-src .h b{color:var(--ink)}"
      + ".erb-src .k,.erb-src .tm{color:var(--faint);font-size:11.5px}"
      + ".erb-src .h .rs-pill{margin-left:auto}"
      + ".erb-src .ttl{font-weight:700;margin:9px 0 5px;font-size:13px;color:var(--ink)}"
      + ".erb-src .txt{white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.55;"
      + "color:var(--ink);background:var(--panel-2);border-radius:9px;padding:9px 12px;"
      + "margin-top:8px}"
      + ".erb-src .txt.clip{max-height:10.2em;overflow:hidden;-webkit-mask-image:linear-gradient("
      + "#000 70%,transparent);mask-image:linear-gradient(#000 70%,transparent)}"
      + ".erb-src .txt a{color:var(--brand)}"
      + ".erb-src .th{font-size:12.5px;color:var(--muted);margin-top:8px;line-height:1.5}"
      + ".erb-src .th a{color:var(--brand)}"
      + ".erb-src .lk{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}"
      // activity
      + ".erb-act{padding:7px 0;border-bottom:1px solid var(--line);font-size:12.5px;"
      + "line-height:1.5;color:var(--muted)}"
      + ".erb-act b{color:var(--ink);font-weight:600}"
      + ".erb-act .d{color:var(--faint);font-size:11px;margin-right:6px}"
      + ".erb-act .v{color:var(--ink)}"
      + ".erb-actd{margin:24px 0 0}"
      + ".erb-actd > div{margin-top:8px}"
      + ".erb-empty{padding:20px;text-align:center;color:var(--faint);font-size:13px}"
      // people view
      + ".erb-people{display:grid;grid-template-columns:repeat(auto-fill,minmax(400px,1fr));"
      + "gap:14px;align-items:start}"
      + "@media(max-width:560px){.erb-people{grid-template-columns:1fr}}"
      + ".erb-pc{background:var(--panel);border:1px solid var(--line);border-radius:14px;"
      + "padding:14px 16px 12px;display:flex;flex-direction:column;gap:8px}"
      + ".erb-pc header{display:flex;gap:11px;align-items:center}"
      + ".erb-pc header .n{display:grid;gap:1px;min-width:0}"
      + ".erb-pc header .n b{font-size:14.5px;color:var(--ink)}"
      + ".erb-pc header .n span{font-size:12px;color:var(--faint)}"
      + ".erb-pc .stats{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap;justify-content:"
      + "flex-end}"
      + ".erb-stat{font-size:11px;font-weight:700;padding:3px 9px;border-radius:99px;"
      + "background:var(--panel-2);color:var(--muted);white-space:nowrap}"
      + ".erb-stat.q{background:var(--warn-bg);color:var(--warn)}"
      + ".erb-stat.r{background:var(--blue-bg);color:var(--blue)}"
      + ".erb-pcs{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;"
      + "color:var(--faint);margin:6px 0 0}"
      + ".erb-li{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;line-height:1.45;"
      + "padding:7px 0;border-top:1px solid var(--line);color:var(--ink)}"
      + ".erb-li:first-of-type{border-top:0}"
      + ".erb-li .x{color:var(--faint);font-size:11.5px;margin-top:2px}"
      + ".erb-li .d{font-size:11px;color:var(--faint);white-space:nowrap;min-width:48px;"
      + "padding-top:1px}"
      + ".erb-li a{color:var(--brand)}"
      + ".erb-pcr{margin-top:4px}.erb-pcr > div{margin-top:6px}"
      + ".erb-pc footer{display:flex;gap:8px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px;margin-top:4px}"
      + ".erb-pc footer .b{display:flex;gap:6px}"
      // drawer
      + ".erb-overlay{position:fixed;inset:0;background:rgba(10,16,24,.45);z-index:60;"
      + "display:flex;justify-content:flex-end;animation:erbFade .15s ease}"
      + "@keyframes erbFade{from{opacity:0}to{opacity:1}}"
      + ".erb-drawer{width:min(800px,96vw);height:100%;background:var(--bg);overflow:auto;"
      + "padding:22px 26px 44px;box-shadow:-14px 0 44px rgba(0,0,0,.28);"
      + "animation:erbSlide .18s ease;box-sizing:border-box}"
      + "@keyframes erbSlide{from{transform:translateX(40px);opacity:.4}"
      + "to{transform:translateX(0);opacity:1}}"
      + ".erb-dhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:4px}"
      + ".erb-dhead h2{font-size:19px;line-height:1.3;margin:0;flex:1}"
      + ".erb-strip{display:flex;flex-wrap:wrap;gap:6px;margin:14px 0 6px}"
      + ".erb-stbtn{font-family:inherit;font-size:12px;font-weight:700;padding:6px 12px;"
      + "border-radius:999px;border:1px solid var(--line);background:var(--panel);"
      + "color:var(--muted);cursor:pointer;transition:all .12s}"
      + ".erb-stbtn:hover{border-color:var(--brand);color:var(--brand)}"
      + ".erb-stbtn.on{background:var(--brand);border-color:var(--brand);color:var(--brand-ink)}"
      + ".erb-writes{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-writes .rs-btn{display:inline-flex;align-items:center;gap:7px}"
      // composer
      + ".erb-mwrap{position:fixed;inset:0;background:rgba(10,16,24,.5);z-index:80;display:flex;"
      + "align-items:flex-start;justify-content:center;padding:5vh 16px;overflow:auto;"
      + "animation:erbFade .15s ease}"
      + ".erb-modal{width:min(760px,100%);background:var(--bg);border:1px solid var(--line);"
      + "border-radius:16px;box-shadow:0 22px 60px rgba(0,0,0,.35);padding:18px 20px 16px;"
      + "box-sizing:border-box}"
      + ".erb-modal .hd{display:flex;align-items:center;gap:10px;margin-bottom:12px}"
      + ".erb-modal .hd h3{margin:0;font-size:16px;flex:1}"
      + ".erb-tos{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}"
      + ".erb-to{font-family:inherit;display:inline-flex;align-items:center;gap:7px;"
      + "border:1px solid var(--line);background:var(--panel);border-radius:999px;"
      + "padding:4px 12px 4px 4px;font-size:12.5px;font-weight:700;color:var(--muted);"
      + "cursor:pointer}"
      + ".erb-to.on{border-color:var(--brand);color:var(--ink);box-shadow:0 0 0 1px var(--brand)}"
      + ".erb-to small{font-weight:600;color:var(--faint)}"
      + ".erb-ctl{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 0 10px}"
      + ".erb-items{border:1px solid var(--line);border-radius:10px;background:var(--panel);"
      + "padding:4px 12px;margin:0 0 10px;max-height:220px;overflow:auto}"
      + ".erb-items label{display:flex;gap:9px;align-items:flex-start;font-size:12.5px;"
      + "line-height:1.45;padding:7px 0;border-bottom:1px solid var(--line);cursor:pointer;"
      + "color:var(--ink)}"
      + ".erb-items label:last-child{border-bottom:0}"
      + ".erb-items input{accent-color:var(--brand);margin-top:2px;flex:none}"
      + ".erb-items i{color:var(--faint);font-style:normal}"
      + ".erb-items .erb-asked{margin-left:6px}"
      + "textarea.erb-msg{min-height:250px;font-size:13px;line-height:1.55}"
      + ".erb-where{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:10px 0 0;"
      + "font-size:12px;color:var(--muted)}"
      + ".erb-modal .ft{display:flex;gap:8px;align-items:center;justify-content:space-between;"
      + "flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px solid var(--line)}"
      + ".erb-modal .ft .b{display:flex;gap:6px;flex-wrap:wrap}"
      + ".erb-toast{position:fixed;bottom:22px;left:50%;transform:translateX(-50%);"
      + "background:var(--ink);color:var(--bg);font-size:13px;font-weight:600;"
      + "padding:10px 18px;border-radius:10px;z-index:99;box-shadow:0 8px 24px rgba(0,0,0,.3);"
      + "animation:erbFade .2s ease}"
      + ".erb-toast.err{background:var(--neg);color:#fff}"
      + "@media(prefers-reduced-motion:reduce){.erb-overlay,.erb-drawer,.erb-mwrap,.erb-toast"
      + "{animation:none}}";
    document.head.appendChild(st);
  }

  /* --------------------------------------------------------------------- api */
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
  function post(payload) {
    return api("/api/_erpbrief", { method: "POST", body: JSON.stringify(payload) });
  }
  function fetchMd(key) {
    return fetch(ZTZ.API + "/api/_erpbrief?key=" + encodeURIComponent(key) + "&format=md",
      { headers: { Authorization: "Bearer " + ZTZ.getToken() } })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); });
  }
  function toast(msg, isErr) {
    var t = document.createElement("div");
    t.className = "erb-toast" + (isErr ? " err" : "");
    t.setAttribute("role", "status");
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, isErr ? 4200 : 2400);
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
  // who a free-text "ask:" / "retest by:" names, in the order they are named
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
  // everything waiting on one person: questions put to them, things for them to retest,
  // and what they filed. Retests: tasks in Verify they reported, plus shipped changes named
  // for them on pages where no such task already covers it (else the message says it twice).
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
  function findTask(S, bk, code) {
    if (S.data && S.data.brief.Key === bk) {
      var t = S.data.tasks.filter(function (x) { return x.Code === code; })[0];
      if (t) return t;
    }
    return S.TASK[bk + ":" + code];
  }
  function findQ(S, bk, code) {
    var pool = (S.data && S.data.brief.Key === bk) ? S.data.questions : S.ov.questions;
    return pool.filter(function (q) { return q["Brief Key"] === bk && q.Code === code; })[0]
      || S.ov.questions.filter(function (q) { return q["Brief Key"] === bk && q.Code === code; })[0];
  }

  /* ------------------------------------------------------------------ state */
  function render(host) {
    injectStyle();
    host.innerHTML = '<div class="rs-loading" style="padding:22px">Loading briefs…</div>';
    var S = { host: host, ov: null, data: null, key: null, view: "page", filter: "_open",
              dw: null };
    try {
      S.key = localStorage.getItem("erb-key") || null;
      S.view = localStorage.getItem("erb-view") === "person" ? "person" : "page";
    } catch (e) { /* private mode */ }
    // the portal's timezone picker repaints every page off one event
    function onTz() {
      if (!document.body.contains(host)) { window.removeEventListener("ztz:tz", onTz); return; }
      if (S.ov) paintMain(S);
    }
    window.addEventListener("ztz:tz", onTz);
    api("/api/_erpbrief").then(function (j) {
      S.ov = j; index(S);
      paintShell(S); paintMain(S);
    }).catch(function (e) {
      host.innerHTML = '<div class="panel">Could not load the briefs — ' + esc(e.message) + "</div>";
    });
  }

  function loadBrief(S) {
    var pane = S.host.querySelector("#erbPane");
    if (pane) pane.innerHTML = '<div class="rs-loading" style="padding:18px">Opening…</div>';
    var key = S.key;
    return api("/api/_erpbrief?key=" + encodeURIComponent(key)).then(function (j) {
      if (key !== S.key) return;
      S.data = j;
      paintBrief(S);
    }).catch(function (e) {
      if (pane) pane.innerHTML = '<div class="panel">' + esc(e.message) + "</div>";
    });
  }

  // after any write: refresh both payloads, repaint whatever is on screen
  function reload(S) {
    var jobs = [api("/api/_erpbrief").then(function (j) { S.ov = j; index(S); })];
    if (S.key) {
      jobs.push(api("/api/_erpbrief?key=" + encodeURIComponent(S.key)).then(function (j) {
        S.data = j;
      }));
    }
    return Promise.all(jobs).then(function () {
      paintKpis(S); paintMain(S);
      if (S.dw && document.body.contains(S.dw.ov)) {
        if (S.dw.code) paintTaskView(S, S.dw, S.dw.code);
      }
    });
  }

  /* ------------------------------------------------------------------ shell */
  function paintShell(S) {
    S.host.innerHTML = '<div class="erb">'
      + '<div class="rs-page-head"><h1>ERP Bug Briefs</h1>'
      + '<p>What the ERP test team reported in <a href="' + CHANNEL_URL + '" target="_blank" '
      + 'rel="noopener">#z2z-soft-test-team</a>, grouped into tasks per ERP page. Every task links '
      + "back to the Slack report it came from; every open question names who to ask, and each "
      + "person gets a ready-to-paste message.</p></div>"
      + '<div class="rs-kpis" id="erbKpis"></div>'
      + '<div class="erb-bar"><div class="rs-seg" id="erbView" role="tablist">'
      + '<button data-v="page" role="tab">By ERP page</button>'
      + '<button data-v="person" role="tab">By person</button></div>'
      + '<div class="erb-row" style="margin:0">'
      + '<a class="rs-btn erb-a" href="' + TRACKER_URL + '" target="_blank" rel="noopener">'
      + "Bugs tracker in Slack ↗</a></div></div>"
      + '<div id="erbMain"></div></div>';
    S.host.querySelectorAll("#erbView [data-v]").forEach(function (b) {
      b.onclick = function () {
        S.view = b.getAttribute("data-v");
        try { localStorage.setItem("erb-view", S.view); } catch (e) { /* ignore */ }
        paintViewSeg(S); paintMain(S);
      };
    });
    paintViewSeg(S); paintKpis(S);
  }
  function paintViewSeg(S) {
    S.host.querySelectorAll("#erbView [data-v]").forEach(function (b) {
      var on = b.getAttribute("data-v") === S.view;
      b.classList.toggle("on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
  }
  function paintKpis(S) {
    var host = S.host.querySelector("#erbKpis");
    if (!host) return;
    var ov = S.ov, t = ov.tasks;
    var open = t.filter(function (x) { return OPEN_STATUSES.indexOf(x.Status) >= 0; }).length;
    var nc = t.filter(function (x) { return x.Status === "Needs clarification"; }).length;
    var oq = ov.questions.filter(function (q) { return q.Status === "Open"; });
    var ppl = uniq(flat(oq.map(function (q) { return peopleIn(S, q.Ask); })));
    var notAsked = oq.filter(function (q) { return !q["Asked At"]; }).length;
    var ver = t.filter(function (x) { return x.Status === "Verify"; }).length;
    var shipTodo = ov.shipped.filter(function (s) { return !+s.Verified; }).length;
    var done = t.filter(function (x) { return x.Status === "Verified"; }).length;
    RSC.kpis(host, [
      { label: "Open tasks", value: open, sub: nc + " blocked on a question" },
      { label: "Questions waiting", value: oq.length,
        sub: ppl.length + " people · " + notAsked + " not asked yet" },
      { label: "Waiting for retest", value: ver, sub: shipTodo + " shipped changes to confirm" },
      { label: "Verified", value: done, sub: "of " + t.length + " tasks" },
    ]);
  }
  function paintMain(S) {
    var main = S.host.querySelector("#erbMain");
    if (!main) return;
    if (S.view === "person") { paintPeople(S, main); return; }
    main.innerHTML = '<div class="erb-split"><nav class="erb-rail" id="erbRail" '
      + 'aria-label="ERP pages"></nav><section class="erb-pane" id="erbPane"></section></div>';
    paintRail(S);
    if (S.data && S.data.brief && S.data.brief.Key === S.key) paintBrief(S);
    else if (S.key) loadBrief(S);
  }

  /* -------------------------------------------------------------------- rail */
  function paintRail(S) {
    var el = S.host.querySelector("#erbRail");
    if (!el) return;
    el.innerHTML = S.ov.briefs.map(function (b) {
      var c = b.counts || {}, tot = 0, done = 0;
      Object.keys(c).forEach(function (k) {
        if (k !== "Dropped") tot += c[k];
        if (["Verified", "Verify", "Done (dev)"].indexOf(k) >= 0) done += c[k];
      });
      var open = OPEN_STATUSES.reduce(function (n, st) { return n + (c[st] || 0); }, 0);
      return '<button class="erb-ri' + (b.Key === S.key ? " on" : "") + '" data-key="'
        + esc(b.Key) + '"' + (b.Key === S.key ? ' aria-current="page"' : "") + ">"
        + '<span class="nm">' + esc(shortOf(b.Key, b.Title)) + "</span>"
        + '<span class="ar">' + esc(areaOf(b.Key, b.Title)) + "</span>"
        + '<span class="st"><span>' + (open ? open + " open" : "nothing open") + "</span>"
        + (b.open_questions ? '<span class="q">' + b.open_questions + " to answer</span>" : "")
        + ((c.Verify || 0) ? '<span class="r">' + c.Verify + " to retest</span>" : "")
        + "</span>"
        + '<span class="bar" title="' + done + " of " + tot + ' built or verified"><i style="width:'
        + (tot ? Math.round(100 * done / tot) : 0) + '%"></i></span></button>';
    }).join("");
    el.querySelectorAll("[data-key]").forEach(function (b) {
      b.onclick = function () {
        S.key = b.getAttribute("data-key"); S.filter = "_open";
        try { localStorage.setItem("erb-key", S.key); } catch (e) { /* ignore */ }
        paintRail(S); loadBrief(S);
      };
    });
  }

  /* ------------------------------------------------------------------- brief */
  function paintBrief(S) {
    var pane = S.host.querySelector("#erbPane");
    if (!pane || !S.data) return;
    var d = S.data, b = d.brief, key = b.Key;
    var reporters = uniq((d.sources || []).map(function (s) { return s.Reporter; }));
    var openQ = d.questions.filter(function (q) { return q.Status === "Open"; });
    var todoShip = d.shipped.filter(function (s) { return !+s.Verified; });
    var msgPeople = uniq(flat(openQ.map(function (q) { return peopleIn(S, q.Ask); }))
      .concat(flat(todoShip.map(function (s) { return peopleIn(S, s["Retest By"]); })))
      .concat(flat(d.tasks.filter(function (t) { return t.Status === "Verify"; })
        .map(function (t) { return reportersOf(t, d.sources); }))));
    var owner = peopleIn(S, b.Owner);
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
      + '<button class="rs-btn" id="erbCopy" title="The whole page as markdown, to paste into a '
      + 'development chat">Copy for a dev chat</button>'
      + '<button class="rs-btn pri" id="erbAdd">Add task</button></div></header>'
      + '<details class="erb-ctx"><summary>Background</summary><div class="erb-md">'
      + (md(b.Context) || '<p class="erb-dim">No background written yet.</p>') + "</div>"
      + '<button class="rs-btn erb-sm" id="erbCtxEdit">Edit background</button></details>'
      + '<div class="erb-sec"><span>Tasks</span><span class="r" id="erbTaskN"></span></div>'
      + '<div class="erb-chips" id="erbChips" role="toolbar" aria-label="Filter tasks"></div>'
      + '<div id="erbTasks"></div>'
      + '<div class="erb-sec"><span>Questions</span><span class="r">' + openQ.length + " open · "
      + openQ.filter(function (q) { return !q["Asked At"]; }).length + " not asked yet</span>"
      + '<button class="rs-btn erb-sm" id="erbQNewBtn">Ask a new question</button></div>'
      + '<div id="erbQNew"></div><div id="erbQs"></div>'
      + '<div class="erb-sec"><span>Already shipped — to retest</span><span class="r">'
      + todoShip.length + " to confirm</span></div>"
      + '<div id="erbShip"></div>'
      + '<details class="erb-actd"><summary>Activity <span class="erb-dim">(' + d.changes.length
      + ")</span></summary><div id=\"erbAct\"></div>"
      + '<div class="erb-row"><input class="erb-in" id="erbNote" placeholder="Post a note on '
      + 'this page…" style="flex:1"><button class="rs-btn" id="erbNoteAdd">Post</button></div>'
      + "</details>";

    var mAll = pane.querySelector("#erbMsgAll");
    if (mAll) mAll.onclick = function () {
      openComposer(S, { ctx: "brief", briefKey: key, people: msgPeople });
    };
    pane.querySelector("#erbCopy").onclick = function () {
      fetchMd(key).then(copyText).then(function () {
        toast("Copied — paste it into the development chat");
      }).catch(function (e) { toast(e.message, true); });
    };
    pane.querySelector("#erbAdd").onclick = function () { openTask(S, null); };
    pane.querySelector("#erbCtxEdit").onclick = function () { editContext(S); };
    pane.querySelector("#erbQNewBtn").onclick = function () { newQuestionForm(S); };
    pane.querySelector("#erbNoteAdd").onclick = function () {
      var t = pane.querySelector("#erbNote").value.trim();
      if (!t) return;
      post({ action: "note", key: key, text: t }).then(function () {
        toast("Note posted"); return reload(S);
      }).catch(function (e) { toast(e.message, true); });
    };
    paintChips(S); paintTasks(S); paintQuestions(S); paintShipped(S); paintActivity(S);
  }

  function editContext(S) {
    var ctx = S.host.querySelector(".erb-ctx");
    ctx.open = true;
    var mount = ctx.querySelector(".erb-md");
    mount.innerHTML = '<textarea class="erb-in big" id="erbCtxTa">'
      + esc(S.data.brief.Context || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="erbCtxSave">Save</button>'
      + '<button class="rs-btn" id="erbCtxCancel">Cancel</button>'
      + '<span class="erb-hint">Markdown. It is the first section a development chat reads.</span></div>';
    ctx.querySelector("#erbCtxEdit").style.display = "none";   // .rs-btn's display beats [hidden]
    mount.querySelector("#erbCtxCancel").onclick = function () { paintBrief(S); };
    mount.querySelector("#erbCtxSave").onclick = function () {
      post({ action: "brief_set", key: S.key, context: mount.querySelector("#erbCtxTa").value })
        .then(function () { toast("Background saved"); return reload(S); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  function newQuestionForm(S) {
    var host = S.host.querySelector("#erbQNew");
    if (host.innerHTML) { host.innerHTML = ""; return; }
    host.innerHTML = '<div class="erb-new">'
      + '<textarea class="erb-in" id="nqText" placeholder="The question, the way the person '
      + 'you ask will read it…"></textarea>'
      + '<div class="g"><input class="erb-in" id="nqWho" placeholder="Ask whom — e.g. Bacho, '
      + 'Giorgi (schema)"><div id="nqTask"></div>'
      + '<button class="rs-btn pri" id="nqAdd">Add question</button></div>'
      + '<span class="erb-hint">A question on a task moves it to Needs clarification until it '
      + "is answered.</span></div>";
    var hTask = RSC.localSelect(host.querySelector("#nqTask"), {
      label: "Task", values: S.data.tasks.map(function (t) { return t.Code; }), value: "",
      allLabel: "no task", form: true,
    });
    host.querySelector("#nqText").focus();
    host.querySelector("#nqAdd").onclick = function () {
      var q = host.querySelector("#nqText").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      post({ action: "question_add", key: S.key, question: q,
             ask: host.querySelector("#nqWho").value.trim(), task_code: hTask.get() || "" })
        .then(function (r) { toast("Question " + r.code + " added"); return reload(S); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  /* ------------------------------------------------------------------- tasks */
  function tasksOf(S) {
    return S.data.tasks.filter(function (t) {
      if (S.filter === "_open") return OPEN_STATUSES.indexOf(t.Status) >= 0;
      if (S.filter === "_all") return true;
      return t.Status === S.filter;
    });
  }
  function paintChips(S) {
    var counts = {};
    S.data.tasks.forEach(function (t) { counts[t.Status] = (counts[t.Status] || 0) + 1; });
    var open = S.data.tasks.filter(function (t) { return OPEN_STATUSES.indexOf(t.Status) >= 0; });
    var chips = [["_open", "Still to do", open.length]]
      .concat(STATUSES.filter(function (st) { return counts[st]; })
        .map(function (st) { return [st, st, counts[st]]; }))
      .concat([["_all", "All", S.data.tasks.length]]);
    var el = S.host.querySelector("#erbChips");
    el.innerHTML = chips.map(function (c) {
      return '<button class="erb-chip' + (S.filter === c[0] ? " on" : "") + '" data-st="'
        + esc(c[0]) + '" aria-pressed="' + (S.filter === c[0]) + '">' + esc(c[1])
        + "<small>" + c[2] + "</small></button>";
    }).join("");
    el.querySelectorAll("[data-st]").forEach(function (b) {
      b.onclick = function () { S.filter = b.getAttribute("data-st"); paintChips(S); paintTasks(S); };
    });
    S.host.querySelector("#erbTaskN").textContent = open.length + " still to do of "
      + S.data.tasks.length;
  }
  function paintTasks(S) {
    var el = S.host.querySelector("#erbTasks");
    var d = S.data, items = tasksOf(S);
    if (!items.length) {
      el.innerHTML = '<div class="panel"><div class="erb-empty">Nothing in this status.</div></div>';
      return;
    }
    el.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + '<thead><tr><th style="width:44px">#</th><th>Task</th><th>Reported by</th>'
      + "<th>Priority</th><th>Status</th><th>Questions</th><th>Updated</th></tr></thead><tbody>"
      + items.map(function (t) {
          var qs = d.questions.filter(function (q) { return q["Task Code"] === t.Code; });
          var nq = qs.filter(function (q) { return q.Status === "Open"; }).length;
          var sub = t.Assignee ? "with " + t.Assignee : (t.Notes ? String(t.Notes).split("\n")[0] : "");
          return '<tr class="click" tabindex="0" data-open="' + esc(t.Code) + '">'
            + '<td><span class="erb-code">' + esc(t.Code) + "</span></td>"
            + '<td class="erb-tt"><div class="t">' + esc(t.Title) + "</div>"
            + (sub ? '<div class="s">' + esc(sub) + "</div>" : "") + "</td>"
            + "<td>" + (stack(S, reportersOf(t, d.sources)) || '<span class="erb-dim">—</span>') + "</td>"
            + "<td>" + pill(t.Priority, PRIO_TONE[t.Priority]) + "</td>"
            + "<td>" + pill(t.Status, TONE[t.Status]) + "</td>"
            + "<td>" + (nq ? '<span class="erb-qn">' + nq + " open</span>"
                        : (qs.length ? '<span class="erb-dim">answered</span>' : '<span class="erb-dim">—</span>'))
            + "</td>"
            + '<td class="nowrap erb-dim" title="' + esc(when(t["Updated At"])) + '">'
            + esc(ago(t["Updated At"])) + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    el.querySelectorAll("[data-open]").forEach(function (r) {
      r.onclick = function () { openTask(S, r.getAttribute("data-open")); };
      r.onkeydown = function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTask(S, r.getAttribute("data-open")); }
      };
    });
  }

  /* --------------------------------------------------------------- questions */
  function askedChip(q) {
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
    return '<div class="erb-qr' + (open ? "" : " done") + '" data-q="'
      + esc(q["Brief Key"] + ":" + q.Code) + '">'
      + '<span class="erb-code q">' + esc(q.Code) + "</span>"
      + '<div><div class="qt">' + inline(q.Question) + "</div>"
      + '<div class="qm">'
      + (t && !opt.noTask ? '<button class="erb-link" data-task="' + esc(t.Code) + '">'
         + esc(t.Code) + " · " + esc(t.Title) + "</button>" : "")
      + (q.Ask ? "<span>ask " + stack(S, ask, true) + " " + esc(q.Ask) + "</span>" : "")
      + (open ? askedChip(q) : pill(q.Status, q.Status === "Answered" ? "ok" : "mute"))
      + "</div>"
      + (q.Answer ? '<div class="erb-ans"><div class="by">' + esc(who(q["Answered By"])) + " · "
         + esc(when(q["Answered At"])) + '</div><div class="erb-md">' + md(q.Answer) + "</div></div>"
         : "")
      + '<div class="erb-aed" hidden></div></div>'
      + '<div class="acts">'
      + '<button class="rs-btn erb-sm' + (open ? " pri" : "") + '" data-act="answer">'
      + (q.Answer ? "Edit answer" : "Answer") + "</button>"
      + (open && ask.length ? '<button class="rs-btn erb-sm" data-act="msg">Message</button>' : "")
      + '<button class="rs-btn erb-sm erb-ghost" data-act="' + (open ? "drop" : "reopen") + '">'
      + (open ? "Drop" : "Reopen") + "</button></div></div>";
  }
  function wireQRows(S, root, after) {
    root.querySelectorAll(".erb-qr").forEach(function (row) {
      var parts = row.getAttribute("data-q").split(":"), bk = parts[0], code = parts[1];
      var q = findQ(S, bk, code);
      if (!q) return;
      row.querySelectorAll("[data-task]").forEach(function (b) {
        b.onclick = function () { openTaskAnywhere(S, bk, b.getAttribute("data-task")); };
      });
      row.querySelectorAll("[data-act]").forEach(function (b) {
        var act = b.getAttribute("data-act");
        b.onclick = function () {
          if (act === "answer") { editAnswer(row, q, after); return; }
          if (act === "msg") {
            openComposer(S, { ctx: "brief", briefKey: bk, people: peopleIn(S, q.Ask) });
            return;
          }
          post({ action: "question_set", key: bk, code: code,
                 fields: { status: act === "drop" ? "Dropped" : "Open" } })
            .then(function () {
              toast(act === "drop" ? "Question dropped" : "Question reopened");
              return after();
            }).catch(function (e) { toast(e.message, true); });
        };
      });
    });
  }
  function editAnswer(row, q, after) {
    var box = row.querySelector(".erb-aed");
    if (!box.hidden) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = '<textarea class="erb-in" placeholder="The answer, in the words the '
      + 'developer needs…">' + esc(q.Answer || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri erb-sm" data-s>Save answer</button>'
      + '<button class="rs-btn erb-sm" data-c>Cancel</button>'
      + '<span class="erb-hint">Saving marks it answered; a task with no open question left '
      + "becomes Ready.</span></div>";
    var ta = box.querySelector("textarea");
    ta.focus();
    box.querySelector("[data-c]").onclick = function () { box.hidden = true; box.innerHTML = ""; };
    box.querySelector("[data-s]").onclick = function () {
      var a = ta.value.trim();
      if (!a) { toast("Write the answer first", true); return; }
      post({ action: "question_set", key: q["Brief Key"], code: q.Code, fields: { answer: a } })
        .then(function () { toast("Answer saved"); return after(); })
        .catch(function (e) { toast(e.message, true); });
    };
  }
  function paintQuestions(S) {
    var el = S.host.querySelector("#erbQs");
    var qs = S.data.questions.slice().sort(function (a, b) {
      return a.Code.localeCompare(b.Code, undefined, { numeric: true });
    });
    var open = qs.filter(function (q) { return q.Status === "Open"; });
    var rest = qs.filter(function (q) { return q.Status !== "Open"; });
    el.innerHTML = (open.length
        ? '<div class="erb-qlist">' + open.map(function (q) { return qRow(S, q); }).join("") + "</div>"
        : '<div class="panel"><div class="erb-empty">No open questions on this page.</div></div>')
      + (rest.length ? '<details class="erb-more"><summary>Answered or dropped (' + rest.length
         + ')</summary><div class="erb-qlist">' + rest.map(function (q) { return qRow(S, q); }).join("")
         + "</div></details>" : "");
    wireQRows(S, el, function () { return reload(S); });
  }

  /* ----------------------------------------------------------------- shipped */
  function paintShipped(S) {
    var el = S.host.querySelector("#erbShip");
    var rows = S.data.shipped;
    if (!rows.length) {
      el.innerHTML = '<div class="panel"><div class="erb-empty">Nothing announced for this page '
        + "yet.</div></div>";
      return;
    }
    el.innerHTML = '<div class="panel"><div class="rs-tablewrap"><table class="rs-table">'
      + '<thead><tr><th style="width:70px">Verified</th><th>What shipped</th><th>When</th>'
      + "<th>Retest by</th><th></th></tr></thead><tbody>"
      + rows.map(function (s) {
          var ppl = peopleIn(S, s["Retest By"]);
          var askedAt = ppl.map(function (k) { return S.shipAsked[s.id + "|" + k]; }).filter(Boolean)[0];
          return "<tr><td><input type=\"checkbox\" aria-label=\"Verified\" data-ship=\"" + s.id + '"'
            + (+s.Verified ? " checked" : "") + ' style="accent-color:var(--brand);width:15px;'
            + 'height:15px"></td><td' + (+s.Verified ? ' class="erb-dim"' : "") + ">"
            + inline(s.What) + "</td><td class=\"erb-dim\">" + esc(s.Deploy || "") + "</td><td>"
            + (stack(S, ppl) || esc(s["Retest By"] || ""))
            + (+s.Verified ? ' <span class="erb-dim">· confirmed by ' + esc(who(s["Verified By"]))
               + " " + esc(dayOf(s["Verified At"])) + "</span>"
               : (askedAt ? ' <span class="erb-asked">asked ' + esc(ago(askedAt)) + "</span>" : ""))
            + "</td><td>" + (!+s.Verified && ppl.length
              ? '<button class="rs-btn erb-sm" data-shipmsg="' + s.id + '">Ask to retest</button>' : "")
            + "</td></tr>";
        }).join("") + "</tbody></table></div></div>";
    el.querySelectorAll("[data-ship]").forEach(function (cb) {
      cb.onchange = function () {
        post({ action: "shipped_set", key: S.key, id: +cb.getAttribute("data-ship"),
               verified: cb.checked })
          .then(function () { toast(cb.checked ? "Marked verified" : "Unmarked"); return reload(S); })
          .catch(function (e) { cb.checked = !cb.checked; toast(e.message, true); });
      };
    });
    el.querySelectorAll("[data-shipmsg]").forEach(function (b) {
      b.onclick = function () {
        var s = rows.filter(function (x) { return String(x.id) === b.getAttribute("data-shipmsg"); })[0];
        openComposer(S, { ctx: "brief", briefKey: S.key, people: peopleIn(S, s["Retest By"]),
                          onlyShip: s.id });
      };
    });
  }

  /* ---------------------------------------------------------------- activity */
  function changeLine(S, c) {
    var what, code = esc(c["Entity Code"] || "");
    if (c.Field === "Note") what = 'noted: <span class="v">' + inline(c.New) + "</span>";
    else if (c.Field === "Created") what = "created <b>" + code + "</b> " + esc(c.New);
    else if (c.Field === "Answer") what = "answered <b>" + code + "</b>";
    else if (c.Field === "Asked") {
      var p = S.P[c.New];
      what = "put <b>" + code + "</b> to " + esc(p ? p.Short : c.New);
    } else if (c.Field === "Body" || c.Field === "Context" || c.Field === "Notes") {
      what = "edited the " + esc(c.Field === "Context" ? "background" : c.Field.toLowerCase())
        + (c.Entity === "brief" ? "" : " of <b>" + code + "</b>");
    } else if (c.Field === "Verified") {
      what = (String(c.New) === "1" ? "confirmed" : "unconfirmed") + " a shipped change";
    } else {
      what = "<b>" + code + "</b> " + esc(c.Field.toLowerCase()) + ": " + esc(c.Old || "—")
        + ' → <span class="v">' + esc(c.New || "—") + "</span>";
    }
    return '<div class="erb-act"><span class="d" title="' + esc(when(c.At)) + '">'
      + esc(ago(c.At)) + "</span><b>" + esc(who(c.By)) + "</b> " + what + "</div>";
  }
  function paintActivity(S) {
    var el = S.host.querySelector("#erbAct");
    var ch = S.data.changes.slice(0, 60);
    el.innerHTML = ch.map(function (c) { return changeLine(S, c); }).join("")
      || '<div class="erb-empty">No changes yet — everything here is as first written.</div>';
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
    if (!cards.length) {
      main.innerHTML = '<div class="panel"><div class="erb-empty">Nobody is waiting on anything.</div></div>';
      return;
    }
    main.innerHTML = '<div class="erb-people">' + cards.map(function (c) {
      return personCard(S, c);
    }).join("") + "</div>";
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
      + (it.qs.length ? '<span class="erb-stat q">' + it.qs.length + " to answer</span>" : "")
      + (c.rt.length ? '<span class="erb-stat r">' + c.rt.length + " to retest</span>" : "")
      + (it.reports.length ? '<span class="erb-stat">' + it.reports.length + " reported</span>" : "")
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
      html += '<details class="erb-pcr"><summary>What ' + esc(p.Short) + " reported in Slack ("
        + it.reports.length + ")</summary><div>" + it.reports.map(function (s) {
          var tasks = S.srcTasks[s["Slack TS"]] || [];
          return '<div class="erb-li"><span class="d">' + esc(dayOf(tsDate(s["Slack TS"])))
            + "</span><div><a href=\"" + permalink(s["Slack TS"]) + '" target="_blank" rel="noopener">'
            + esc(s.Kind === "chat" ? s.Title : "“" + s.Title + "”") + " ↗</a>"
            + (s["Tracker Status"] ? " " + pill(s["Tracker Status"], TRACKER_TONE[s["Tracker Status"]]) : "")
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
    var hi = (ka ? "გამარჯობა " : "Hi ") + nm + "! 👋";
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
    var nq = o.qs.length, nr = o.verify.length + o.ship.length, L = [hi];
    if (nq) {
      L.push(ka
        ? "ERP-ის ბაგები, რაც #z2z-soft-test-team-ში ჩაიწერა, გიორგიმ სამუშაოდ აიღო. სანამ "
          + "დაიწყებს, შენი პასუხი გვჭირდება " + (nq === 1 ? "ერთ საკითხზე" : nq + " საკითხზე")
          + ", რომ ყველაფერი სწორად გაკეთდეს:"
        : "About the ERP bugs from #z2z-soft-test-team: Giorgi is picking them up, and "
          + (nq === 1 ? "one point needs your answer first so it gets" : nq
             + " points need your answer first so they get") + " built right:");
      var order = uniq(o.qs.map(function (q) { return q["Brief Key"]; }));
      order.forEach(function (bk) {
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
  // retest, thanks). The text is regenerated from what is ticked until someone edits it.
  function openComposer(S, cfg) {
    var people = uniq(cfg.people).filter(function (k) { return S.P[k]; });
    if (!people.length) { toast("Nobody to message — name someone in the question's “ask”", true); return; }
    var srcs = (S.data && S.data.sources) || S.ov.sources;
    var st = { pk: people[0], lang: null, kind: null, off: {}, custom: null };
    var wrap = document.createElement("div");
    wrap.className = "erb-mwrap";
    wrap.innerHTML = '<div class="erb-modal" role="dialog" aria-modal="true" aria-label="Write a '
      + 'message"></div>';
    document.body.appendChild(wrap);
    var m = wrap.firstChild;
    function close() { wrap.remove(); document.removeEventListener("keydown", onKey); }
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
      // shipped rows a Verify task already covers start unticked (they say the same thing)
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
          key: cfg.briefKey || (cfg.task && cfg.task["Brief Key"]) || null,
          task_code: cfg.task ? cfg.task.Code : null,
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
          return reload(S);
        }).catch(function (e) { toast(e.message, true); });
      };
    }
    paint();
    var first = m.querySelector("[data-copy]");
    if (first) first.focus();
  }

  /* ------------------------------------------------------------------ drawer */
  function drawerShell(S) {
    var ov = document.createElement("div");
    ov.className = "erb-overlay";
    ov.onclick = function (ev) { if (ev.target === ov) close(); };
    ov.innerHTML = '<div class="erb-drawer" role="dialog" aria-modal="true"><div class="rs-loading">'
      + "Opening…</div></div>";
    document.body.appendChild(ov);
    function onKey(e) {
      if (e.key === "Escape" && !document.querySelector(".erb-mwrap")) close();
    }
    document.addEventListener("keydown", onKey);
    function close() {
      ov.remove(); document.removeEventListener("keydown", onKey);
      if (S.dw === dw) S.dw = null;
      reload(S);
    }
    var dw = { ov: ov, el: ov.querySelector(".erb-drawer"), close: close, code: null };
    S.dw = dw;
    return dw;
  }
  function openTaskAnywhere(S, bk, code) {
    if (S.view !== "page" || S.key !== bk || !S.data || S.data.brief.Key !== bk) {
      S.view = "page"; S.key = bk; S.filter = "_open";
      try { localStorage.setItem("erb-view", "page"); localStorage.setItem("erb-key", bk); } catch (e) { /* ignore */ }
      paintViewSeg(S);
      var main = S.host.querySelector("#erbMain");
      main.innerHTML = '<div class="erb-split"><nav class="erb-rail" id="erbRail" aria-label="ERP '
        + 'pages"></nav><section class="erb-pane" id="erbPane"></section></div>';
      paintRail(S);
      loadBrief(S).then(function () { openTask(S, code); });
      return;
    }
    openTask(S, code);
  }
  function openTask(S, code) {
    var dw = drawerShell(S);
    if (!code) { paintTaskEdit(S, dw, null); return; }
    paintTaskView(S, dw, code);
  }
  function taskChanges(S, code) {
    return S.data.changes.filter(function (c) {
      return c["Entity Code"] === code || (c.Entity === "question" && S.data.questions.some(
        function (q) { return q.Code === c["Entity Code"] && q["Task Code"] === code; }));
    });
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
      + (fb ? " · filed by " + esc(fb.Short) : "") + "</span>"
      + '<span class="tm">' + esc(when(at)) + (tzLabel() ? " " + esc(tzLabel()) : "") + "</span>"
      + (s["Tracker Status"] ? pill("tracker: " + s["Tracker Status"], TRACKER_TONE[s["Tracker Status"]],
          "Status in the Slack Bugs tracker when this page was written (10 Sept)") : "")
      + "</div>"
      + (s.Kind !== "chat" ? '<div class="ttl">“' + esc(s.Title) + "”</div>" : "")
      + '<div class="txt' + (long ? " clip" : "") + '">' + linkify(esc(txt)) + "</div>"
      + (long ? '<button class="erb-link" data-more style="margin-top:6px">Show the whole report</button>' : "")
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

  function paintTaskView(S, dw, code) {
    var d = S.data;
    var t = d.tasks.filter(function (x) { return x.Code === code; })[0];
    if (!t) { dw.close(); return; }
    dw.code = code;
    var srcs = srcsForTask(t, d.sources);
    var reps = uniq(srcs.map(function (s) { return s.Reporter; }));
    var qs = d.questions.filter(function (q) { return q["Task Code"] === code; });
    var openQs = qs.filter(function (q) { return q.Status === "Open"; });
    var askP = uniq(flat(openQs.map(function (q) { return peopleIn(S, q.Ask); })));
    var writeTo = uniq(reps.concat(askP)).filter(function (k) { return S.P[k]; });
    dw.el.setAttribute("aria-label", t.Code + " " + t.Title);
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><span class="erb-code" style="margin-top:4px">' + esc(t.Code)
      + "</span><h2>" + esc(t.Title) + "</h2>"
      + '<button class="rs-btn erb-sm" id="dwEdit">Edit</button>'
      + '<button class="rs-btn erb-sm" id="dwClose" aria-label="Close">✕</button></div>'
      + '<div class="erb-meta"><span class="erb-eyebrow">' + esc(shortOf(d.brief.Key, d.brief.Title))
      + "</span>" + pill(t.Priority, PRIO_TONE[t.Priority]) + pill(t.Status, TONE[t.Status])
      + '<span class="erb-dim" title="' + esc(when(t["Updated At"])) + '">updated '
      + esc(ago(t["Updated At"])) + " by " + esc(who(t["Updated By"])) + "</span>"
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
      + '<div class="erb-sec"><span>What to build</span></div><div class="erb-md">'
      + (md(t.Body) || '<p class="erb-dim">No spec yet — use Edit.</p>') + "</div>"
      + '<div class="erb-sec"><span>Questions</span><span class="r">' + openQs.length + " open</span></div>"
      + '<div id="dwQs">' + (qs.length ? '<div class="erb-qlist">' + qs.map(function (q) {
          return qRow(S, q, { noTask: true });
        }).join("") + "</div>" : '<div class="erb-hint">No questions on this task.</div>') + "</div>"
      + '<div class="erb-row"><input class="erb-in" id="dwQNew" placeholder="Ask a question about '
      + 'this task…" style="flex:1 1 240px"><input class="erb-in" id="dwQWho" placeholder="Ask whom" '
      + 'style="flex:0 1 150px"><button class="rs-btn" id="dwQAdd">Add</button></div>'
      // the evidence sits below the spec: with six reports behind one task the spec was two
      // screens down; the header's "N Slack reports ↓" jumps here
      + '<div class="erb-sec" id="dwSrc"><span>Reported in Slack</span><span class="r">'
      + srcs.length + (srcs.length === 1 ? " report" : " reports") + "</span></div>"
      + (srcs.length ? srcs.map(function (s) { return srcCard(S, s); }).join("")
         : '<div class="panel"><div class="erb-empty">No Slack report is linked — this task was '
           + "written from the discussion.</div></div>")
      + '<div class="erb-sec"><span>Notes</span></div>'
      + '<textarea class="erb-in" id="dwNotes" placeholder="Decisions, what the dev chat did, '
      + 'where it stands…">' + esc(t.Notes || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="dwNotesSave">Save notes</button></div>'
      + '<div class="erb-sec"><span>Activity</span></div><div>'
      + (taskChanges(S, code).slice(0, 30).map(function (c) { return changeLine(S, c); }).join("")
         || '<div class="erb-empty">No changes yet.</div>') + "</div>";

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
      required: true, onChange: function (v) { setField("priority", v).then(function () { toast("Priority " + v); }); },
    });
    function setField(field, value) {
      var f = {}; f[field] = value;
      return post({ action: "task_set", key: S.key, code: code, fields: f })
        .then(function () { return reload(S); })
        .catch(function (e) { toast(e.message, true); throw e; });
    }
    dw.el.querySelectorAll("#dwStrip [data-st]").forEach(function (b) {
      b.onclick = function () {
        var st = b.getAttribute("data-st");
        if (st === "Ready" && openQs.length) {
          toast("Answer the open questions first — that is what Ready means", true); return;
        }
        setField("status", st).then(function () { toast("Status: " + st); }).catch(function () {});
      };
    });
    var whoIn = dw.el.querySelector("#dwWho");
    whoIn.onchange = function () {
      setField("assignee", whoIn.value.trim()).then(function () { toast("Saved"); }).catch(function () {});
    };
    dw.el.querySelector("#dwNotesSave").onclick = function () {
      setField("notes", dw.el.querySelector("#dwNotes").value.trim())
        .then(function () { toast("Notes saved"); }).catch(function () {});
    };
    wireQRows(S, dw.el.querySelector("#dwQs"), function () { return reload(S); });
    dw.el.querySelector("#dwQAdd").onclick = function () {
      var q = dw.el.querySelector("#dwQNew").value.trim();
      if (q.length < 5) { toast("Write the question", true); return; }
      post({ action: "question_add", key: S.key, question: q, task_code: code,
             ask: dw.el.querySelector("#dwQWho").value.trim() })
        .then(function (r) { toast("Question " + r.code + " added"); return reload(S); })
        .catch(function (e) { toast(e.message, true); });
    };
  }

  function paintTaskEdit(S, dw, t) {
    dw.code = t ? t.Code : null;
    var v = t || { Title: "", Body: "", Priority: "P2", Source: "" };
    dw.el.innerHTML = ''
      + '<div class="erb-dhead"><h2>' + (t ? "Edit " + esc(t.Code) : "New task on "
        + esc(shortOf(S.key))) + "</h2>"
      + '<button class="rs-btn erb-sm" id="dwClose" aria-label="Close">✕</button></div>'
      + '<span class="erb-lbl">Title</span><input class="erb-in" id="eTitle" maxlength="300" '
      + 'value="' + esc(v.Title) + '">'
      + '<div class="erb-row"><div style="flex:0 0 150px"><span class="erb-lbl">Priority</span>'
      + '<div id="ePrio"></div></div>'
      + '<div style="flex:1"><span class="erb-lbl">Source — BT ids link it to the Slack reports</span>'
      + '<input class="erb-in" id="eSrc" value="' + esc(v.Source || "") + '"' + (t ? " disabled" : "")
      + ' placeholder="e.g. BT-07, or who asked and when"></div></div>'
      + '<span class="erb-lbl">What to build — markdown: <b>Why.</b> / <b>Spec.</b> / '
      + "<b>Acceptance.</b></span>"
      + '<textarea class="erb-in big" id="eBody">' + esc(v.Body || "") + "</textarea>"
      + '<div class="erb-row"><button class="rs-btn pri" id="eSave">' + (t ? "Save" : "Create")
      + '</button><button class="rs-btn" id="eCancel">Cancel</button></div>';
    var hPrio = RSC.localSelect(dw.el.querySelector("#ePrio"), {
      label: "Priority", values: ["P1", "P2", "P3"], value: v.Priority || "P2", form: true,
      required: true,
    });
    dw.el.querySelector("#dwClose").onclick = dw.close;
    dw.el.querySelector("#eCancel").onclick = function () {
      if (t) paintTaskView(S, dw, t.Code); else dw.close();
    };
    dw.el.querySelector("#eSave").onclick = function () {
      var title = dw.el.querySelector("#eTitle").value.trim();
      var body = dw.el.querySelector("#eBody").value;
      var pr = hPrio.get() || "P2";
      var go = t
        ? post({ action: "task_set", key: S.key, code: t.Code,
                 fields: { title: title, body: body, priority: pr } })
        : post({ action: "task_add", key: S.key, title: title, body: body, priority: pr,
                 source: dw.el.querySelector("#eSrc").value.trim() });
      go.then(function (r) {
        toast(t ? "Saved" : "Created " + r.code);
        dw.code = t ? t.Code : r.code;
        return reload(S);
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
