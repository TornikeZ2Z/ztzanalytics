/* SUBMIT A BUG (2026-11-13, ZTZ-49) -- the portal's button for bugs and requests, on every page.

   Tornike's picks: everyone signed in files; each person sees only their OWN requests and the replies on
   them (the "My requests" tab here); admins work the whole board on the page Bugs & Requests
   (pages/bugs-requests.js). The button sits in the top bar; pressing it takes a picture of the screen
   FIRST (so the panel is not in it), then opens a side panel that already knows the page. More pictures
   come by Ctrl+V, drag and drop or a file, up to 5. English only. Numbers are ZP-12.

   The bridge side is bridge/zp_board.py (/api/_zp). Pictures come back as signed URLs, so an <img> needs
   no bearer header. A link like .../reporting/#zp=ZP-12 (the emails carry one) opens that request here.

   Also kept: the tab's last 10 script errors, sent with a report so a bug arrives with its own trace. */
(function () {
  "use strict";
  var MAX_PICS = 5, MAX_REPLY_PICS = 3, MAX_W = 1600, POLL_MS = 3 * 60 * 1000;
  var SHOT_LIB = "assets/vendor/modern-screenshot/modern-screenshot.js?v=4.7.0";

  /* ---- the tab's recent errors, from the first moment ------------------------------------------ */
  var ERRS = [];
  function keepErr(msg) {
    msg = String(msg || "").slice(0, 300);
    if (!msg) return;
    ERRS.push(new Date().toISOString().slice(11, 19) + " " + msg);
    if (ERRS.length > 10) ERRS.shift();
  }
  window.addEventListener("error", function (e) {
    keepErr((e.message || "error") + (e.filename ? " @ " + String(e.filename).split("/").pop() + ":" + e.lineno : ""));
  });
  window.addEventListener("unhandledrejection", function (e) {
    var r = e.reason; keepErr("unhandled: " + ((r && (r.message || r)) || "rejection"));
  });

  /* ---- a link straight to a request: read before the shell rewrites the hash. #zp=ZP-12 (the
     sender's email) opens it in this panel; #page=bugs-requests&zp=ZP-12 (his Slack ping) is the
     board's, which takes it with ZPB.takeDeep() -------------------------------------------------------- */
  var DEEP = (location.hash.match(/(?:^#|&)zp=(ZP-\d+)/i) || [])[1] || null;
  var DEEP_BOARD = !!DEEP && /(?:^#|&)page=bugs-requests\b/.test(location.hash);

  var S = { me: null, view: "new", kind: "bug", pics: [], badge: null, mine: null, open: null, sending: false,
            page: null, draft: { title: "", body: "", expected: "" } };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var STATUS = { new: "New", in_progress: "In progress", done: "Done", declined: "Declined" };
  var PILL = { new: "info", in_progress: "warn", done: "ok", declined: "mute" };

  function api(opts, qs) {
    return fetch(ZTZ.API + "/api/_zp" + (qs || ""), Object.assign({
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + ZTZ.getToken() },
    }, opts || {})).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      });
    });
  }
  function toast(m) { try { ZTZ.toast(m); } catch (e) { /* the shell's toast is optional */ } }
  function ago(iso) {
    var d = iso ? new Date(iso) : null;
    if (!d || isNaN(d)) return "";
    var s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return "just now";
    if (s < 3600) return Math.round(s / 60) + " min ago";
    if (s < 86400) return Math.round(s / 3600) + " h ago";
    if (s < 86400 * 7) return Math.round(s / 86400) + " d ago";
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  /* ---- the page the report comes from ----------------------------------------------------------- */
  function currentPage() {
    var id = "", title = "";
    try {
      /* global CURRENT, titleOf */
      if (typeof CURRENT !== "undefined" && CURRENT) {
        id = CURRENT.id || "";
        title = (typeof titleOf === "function" ? titleOf(id) : "") || CURRENT.title || id;
      }
    } catch (e) { /* the shell's names are a convenience */ }
    return { id: id, title: title };
  }

  /* ---- the picture of the screen ------------------------------------------------------------------ */
  var libP = null;
  function shotLib() {
    if (window.modernScreenshot) return Promise.resolve(window.modernScreenshot);
    if (!libP) libP = new Promise(function (ok, no) {
      var s = document.createElement("script");
      s.src = SHOT_LIB; s.async = true;
      s.onload = function () { window.modernScreenshot ? ok(window.modernScreenshot) : no(new Error("no lib")); };
      s.onerror = function () { libP = null; no(new Error("could not load the screenshot tool")); };
      document.head.appendChild(s);
    });
    return libP;
  }
  /* two frames so a menu that was open can close -- or 150 ms, because a background tab gets no frames */
  function nextFrame() {
    return new Promise(function (r) {
      var done = false, go = function () { if (!done) { done = true; r(); } };
      requestAnimationFrame(function () { requestAnimationFrame(go); });
      setTimeout(go, 150);
    });
  }
  /* THE PANEL NEVER WAITS ON THE PICTURE: whatever stalls (the library's download, a page the tool chokes
     on), after 6 s the panel opens without one and the person pastes their own */
  function capture() {
    return Promise.race([captureNow(), new Promise(function (r) { setTimeout(function () { r(null); }, 6000); })]);
  }
  /* WHAT GOES INTO THE CLONE. Never the button, the panel or anything marked data-no-shot. And nothing that
     starts BELOW the screen: the library copies every element's styles, and on the live Monthly Report
     (6,900 elements, most of them further down) that took 3.2 of 4.2 s; leaving them out made it 1.2 s with
     the same picture (13 Nov, measured in his Chrome). Only below: an element ABOVE the screen still holds
     the layout of what follows it, so dropping it would shift the visible part up. */
  function keepForShot(h) {
    return function (n) {
      if (n instanceof HTMLElement && n.dataset && n.dataset.noShot !== undefined) return false;
      if (n instanceof Element && n.getBoundingClientRect) {
        var r = n.getBoundingClientRect();
        if (r.height > 0 && r.top > h + 40) return false;
      }
      return true;
    };
  }
  function captureNow() {
    var w = window.innerWidth, h = window.innerHeight;
    return shotLib().then(function (lib) {
      return nextFrame().then(function () {
        var bg = getComputedStyle(document.body).backgroundColor || "#ffffff";
        return Promise.race([
          lib.domToJpeg(document.body, {
            width: w, height: h, quality: 0.72, scale: Math.min(1, MAX_W / w), backgroundColor: bg,
            // each picture on the page gets 2.5 s to load and decode (a background tab never decodes, so 8 s
            // here was 8 s of nothing before the panel opened)
            timeout: 2500,
            font: false,
            // THE PORTAL SCROLLS INSIDE #content, not the window: without this the picture always showed the
            // top of the page, whatever the person was looking at (caught in the harness, 13 Nov)
            features: { restoreScrollPosition: true },
            style: { margin: "0", transform: "translate(" + (-window.scrollX) + "px," + (-window.scrollY) + "px)" },
            filter: keepForShot(h),
          }),
          new Promise(function (r) { setTimeout(function () { r(null); }, 5500); }),
        ]);
      });
    }).then(function (url) {
      return url && url.length < 3200000 ? url : null;
    }).catch(function () { return null; });
  }
  /* a picture the person adds: shrunk to 1600 px wide, as a JPEG */
  function shrink(file) {
    return new Promise(function (ok) {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type || "")) { ok("type"); return; }
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var k = Math.min(1, MAX_W / img.naturalWidth);
        var c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var d = c.toDataURL("image/jpeg", 0.82);
        ok(d.length < 3200000 ? d : "large");
      };
      img.onerror = function () { URL.revokeObjectURL(url); ok("type"); };
      img.src = url;
    });
  }
  function addFiles(files, into, cap) {
    var list = Array.prototype.slice.call(files || []).filter(function (f) { return /^image\//.test(f.type || ""); });
    if (!list.length) return Promise.resolve(false);
    return list.reduce(function (p, f) {
      return p.then(function () {
        if (into.length >= cap) { toast("Up to " + cap + " pictures."); return; }
        return shrink(f).then(function (d) {
          if (d === "type") toast("That file is not a picture.");
          else if (d === "large") toast("That picture is too large.");
          else into.push({ url: d, auto: false });
        });
      });
    }, Promise.resolve()).then(function () { return true; });
  }

  /* ---- styles ---------------------------------------------------------------------------------------- */
  function css() {
    if (document.getElementById("zp-css")) return;
    var st = document.createElement("style");
    st.id = "zp-css";
    st.textContent = [
      ".zp-btn{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;margin-right:10px;border:1px solid var(--line);",
      "border-radius:8px;background:var(--panel);color:var(--ink);font:600 13px/1 inherit;font-family:inherit;cursor:pointer;white-space:nowrap;position:relative}",
      ".zp-btn:hover{border-color:var(--line-2);background:var(--panel-2)}",
      ".zp-btn svg{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}",
      ".zp-btn.busy{opacity:.6;cursor:progress}",
      ".zp-dot{min-width:17px;height:17px;padding:0 5px;border-radius:9px;background:var(--neg);color:#fff;font-size:10.5px;font-weight:700;",
      "display:inline-flex;align-items:center;justify-content:center}.zp-dot[hidden]{display:none}",
      "@media (max-width:760px){.zp-btn .zp-lbl{display:none}.zp-btn{padding:0 9px;margin-right:6px}}",
      ".zp-mask{position:fixed;inset:0;background:rgba(15,23,42,.18);z-index:400}",
      ".zp-panel{position:fixed;top:0;right:0;bottom:0;width:min(460px,100vw);z-index:401;background:var(--panel);color:var(--ink);",
      "border-left:1px solid var(--line);box-shadow:-18px 0 50px rgba(15,23,42,.16);display:flex;flex-direction:column;",
      "animation:zpin .18s ease-out}",
      "@keyframes zpin{from{transform:translateX(24px)}to{transform:none}}",
      ".zp-head{display:flex;align-items:center;gap:10px;padding:14px 16px 10px;border-bottom:1px solid var(--line)}",
      ".zp-head h2{font-size:16px;margin:0;flex:1;letter-spacing:-.2px}",
      ".zp-x{border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;cursor:pointer;padding:2px 6px}",
      ".zp-tabs{display:flex;gap:4px;padding:10px 16px 0}",
      ".zp-tabs button{border:1px solid var(--line);background:transparent;color:var(--muted);border-radius:8px;padding:6px 11px;",
      "font:600 12.5px inherit;font-family:inherit;cursor:pointer}",
      ".zp-tabs button.on{background:var(--ink);border-color:var(--ink);color:var(--panel)}",
      ".zp-body{flex:1;overflow:auto;padding:14px 16px 18px}",
      ".zp-foot{padding:12px 16px;border-top:1px solid var(--line);display:flex;gap:8px;align-items:center}",
      ".zp-foot .zp-sp{flex:1;color:var(--muted);font-size:12px}",
      ".zp-lab{display:block;font-size:11px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;color:var(--muted);margin:12px 0 5px}",
      ".zp-in,.zp-ta{width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;background:var(--panel);",
      "color:var(--ink);font:14px/1.45 inherit;font-family:inherit;padding:8px 10px}",
      ".zp-ta{min-height:110px;resize:vertical}.zp-ta.sm{min-height:64px}",
      ".zp-in:focus,.zp-ta:focus{outline:none;border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-glow)}",
      ".zp-page{font-size:12.5px;color:var(--muted);margin-top:2px}.zp-page b{color:var(--ink);font-weight:600}",
      ".zp-hint{font-size:12px;color:var(--muted);margin-top:6px;line-height:1.45}",
      ".zp-pics{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}",
      ".zp-pic{position:relative;width:96px;height:64px;border-radius:7px;overflow:hidden;border:1px solid var(--line);background:var(--panel-2)}",
      ".zp-pic img{width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in}",
      ".zp-pic button{position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:10px;border:0;background:rgba(15,23,42,.72);",
      "color:#fff;font-size:13px;line-height:20px;cursor:pointer;padding:0}",
      ".zp-pic i{position:absolute;left:4px;bottom:3px;font-style:normal;font-size:9.5px;color:#fff;background:rgba(15,23,42,.6);border-radius:4px;padding:1px 4px}",
      ".zp-add{width:96px;height:64px;border-radius:7px;border:1px dashed var(--line-2);background:transparent;color:var(--muted);",
      "font:600 12px inherit;font-family:inherit;cursor:pointer}",
      ".zp-add:hover{color:var(--ink);border-color:var(--ink)}",
      ".zp-drop{outline:2px dashed var(--brand);outline-offset:-6px}",
      ".zp-err{color:var(--neg);font-size:12.5px;margin-top:8px}",
      ".zp-done{text-align:center;padding:34px 10px}.zp-done h3{margin:10px 0 6px;font-size:17px}.zp-done p{color:var(--muted);font-size:13.5px;line-height:1.5}",
      ".zp-tick{width:44px;height:44px;border-radius:22px;background:var(--pos-bg);color:var(--pos);display:inline-flex;align-items:center;justify-content:center;font-size:22px}",
      ".zp-list{display:flex;flex-direction:column;gap:6px}",
      ".zp-row{display:flex;gap:10px;align-items:flex-start;text-align:left;width:100%;border:1px solid var(--line);border-radius:9px;background:var(--panel);",
      "padding:9px 10px;cursor:pointer;font-family:inherit;color:var(--ink)}",
      ".zp-row:hover{border-color:var(--line-2);background:var(--panel-2)}",
      ".zp-row .t{font-size:13.5px;font-weight:600;line-height:1.35}.zp-row .m{font-size:11.5px;color:var(--muted);margin-top:3px}",
      ".zp-row .k{font-size:11.5px;font-weight:700;color:var(--muted);min-width:44px;padding-top:2px}",
      ".zp-row .grow{flex:1;min-width:0}",
      ".zp-new{display:inline-block;width:7px;height:7px;border-radius:4px;background:var(--neg);margin-left:6px;vertical-align:middle}",
      ".zp-empty{color:var(--muted);font-size:13.5px;padding:24px 4px;text-align:center;line-height:1.5}",
      ".zp-back{display:block;border:0;background:transparent;color:var(--muted);font:600 12.5px inherit;font-family:inherit;cursor:pointer;padding:0;margin-bottom:10px}",
      ".zp-back:hover{color:var(--ink)}",
      ".zp-q{font-size:15px;font-weight:700;margin:4px 0 6px;line-height:1.35}",
      ".zp-txt{font-size:13.5px;line-height:1.55;white-space:pre-wrap;word-wrap:break-word}",
      ".zp-sub{font-size:12px;color:var(--muted);margin-bottom:10px}",
      ".zp-thread{margin-top:16px;display:flex;flex-direction:column;gap:8px}",
      ".zp-msg{border-radius:10px;padding:8px 11px;background:var(--panel-2);border:1px solid var(--line)}",
      ".zp-msg.staff{background:var(--panel);border-color:var(--line-2)}",
      ".zp-msg .who{font-size:11.5px;font-weight:700;color:var(--muted);margin-bottom:3px}.zp-msg .who span{font-weight:500}",
      ".zp-ev{font-size:12px;color:var(--muted);text-align:center;padding:2px 0}",
    ].join("");
    document.head.appendChild(st);
  }

  /* ---- the button ----------------------------------------------------------------------------------- */
  var ICON = '<svg viewBox="0 0 24 24"><path d="M8 6.5a4 4 0 0 1 8 0"/><rect x="6.5" y="6.5" width="11" height="13" rx="5.5"/>'
    + '<path d="M12 10v9.5M3 13h3.5M17.5 13H21M4 7.5l3 2M20 7.5l-3 2M4 19l3-1.8M20 19l-3-1.8"/></svg>';
  function mountButton() {
    var host = document.getElementById("ztzHeader");
    if (!host || document.getElementById("zpBtn")) return;
    var b = document.createElement("button");
    b.id = "zpBtn"; b.type = "button"; b.className = "zp-btn"; b.setAttribute("data-no-shot", "");
    b.title = "Report a bug or ask for a change. Your own requests and the replies on them are here too.";
    b.innerHTML = ICON + '<span class="zp-lbl">Submit a bug</span><span class="zp-dot" id="zpDot" hidden></span>';
    b.onclick = function () { start(); };
    var clock = document.getElementById("ztzClock");
    host.insertBefore(b, clock || null);
    paintBadge();
  }
  function paintBadge() {
    var d = document.getElementById("zpDot");
    if (!d) return;
    var n = S.badge ? (S.badge.unread || 0) + (S.badge.board || 0) : 0;
    d.hidden = !n; d.textContent = n > 99 ? "99+" : String(n);
    var b = document.getElementById("zpBtn");
    if (b && S.badge) {
      var bits = [];
      if (S.badge.unread) bits.push(S.badge.unread + " of your requests ha" + (S.badge.unread === 1 ? "s" : "ve") + " a new reply");
      if (S.badge.board) bits.push(S.badge.board + " on the board need" + (S.badge.board === 1 ? "s" : "") + " a look");
      b.title = bits.length ? bits.join(" · ") : "Report a bug or ask for a change. Your own requests and the replies on them are here too.";
    }
  }
  function loadBadge() {
    if (!ZTZ.getToken()) return Promise.resolve();
    return api(null, "?badge=1").then(function (j) { S.badge = j; paintBadge(); }).catch(function () { /* quiet */ });
  }

  /* ---- the panel ------------------------------------------------------------------------------------ */
  var panel = null, mask = null;
  function start() {
    var b = document.getElementById("zpBtn");
    if (panel) { closePanel(); return; }
    S.page = currentPage();
    S.view = "new";
    if (b) b.classList.add("busy");
    // the picture first, so the panel itself is never in it
    capture().then(function (url) {
      if (b) b.classList.remove("busy");
      S.pics = S.pics.filter(function (p) { return !p.auto; });
      if (url) S.pics.unshift({ url: url, auto: true });
      openPanel();
    });
  }
  function openPanel(view) {
    css();
    if (view) S.view = view;
    if (!panel) {
      mask = document.createElement("div"); mask.className = "zp-mask"; mask.setAttribute("data-no-shot", "");
      mask.onclick = closePanel;
      panel = document.createElement("aside"); panel.className = "zp-panel"; panel.setAttribute("data-no-shot", "");
      panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Submit a bug");
      document.body.appendChild(mask); document.body.appendChild(panel);
      document.addEventListener("keydown", onKey, true);
    }
    paint();
  }
  function closePanel() {
    if (panel) { panel.remove(); mask.remove(); panel = mask = null; }
    document.removeEventListener("keydown", onKey, true);
    S.open = null;
  }
  function onKey(e) {
    if (e.key === "Escape" && panel && !document.querySelector(".rs-dlg-mask")) { e.stopPropagation(); closePanel(); }
  }

  function paint() {
    if (!panel) return;
    panel.innerHTML = '<div class="zp-head"><h2>' + (S.view === "thread" && S.open ? esc(S.open.key) : "Bugs & requests")
      + '</h2><button class="zp-x" type="button" aria-label="Close" data-a="x">×</button></div>'
      + (S.view === "thread" ? "" : '<div class="zp-tabs"><button type="button" data-v="new" class="' + (S.view === "new" ? "on" : "")
        + '">New</button><button type="button" data-v="mine" class="' + (S.view === "mine" ? "on" : "") + '">My requests'
        + (S.badge && S.badge.unread ? ' <span class="zp-new"></span>' : "") + "</button>"
        + (S.me && S.me.admin ? '<button type="button" data-v="board">The board' + (S.badge && S.badge.board ? " (" + S.badge.board + ")" : "") + "</button>" : "")
        + "</div>")
      + '<div class="zp-body" id="zpBody"></div><div class="zp-foot" id="zpFoot"></div>';
    panel.querySelector('[data-a="x"]').onclick = closePanel;
    panel.querySelectorAll("[data-v]").forEach(function (b) {
      b.onclick = function () {
        var v = b.getAttribute("data-v");
        if (v === "board") { closePanel(); location.hash = "page=bugs-requests"; return; }
        S.view = v; paint();
      };
    });
    if (S.view === "new") paintNew();
    else if (S.view === "mine") paintMine();
    else paintThread();
  }

  /* ---- New ------------------------------------------------------------------------------------------- */
  function picsHtml(list, cap) {
    return '<div class="zp-pics">' + list.map(function (p, i) {
      return '<div class="zp-pic"><img src="' + esc(p.url) + '" alt="" data-zoom="' + i + '">'
        + (p.auto ? "<i>this screen</i>" : "") + '<button type="button" data-rm="' + i + '" title="Remove">×</button></div>';
    }).join("") + (list.length < cap ? '<button type="button" class="zp-add" data-a="add">+ Picture</button>' : "")
      + '<input type="file" accept="image/*" multiple hidden data-a="file"></div>';
  }
  function wirePics(root, list, cap, repaint) {
    root.querySelectorAll("[data-rm]").forEach(function (b) {
      b.onclick = function () { list.splice(+b.getAttribute("data-rm"), 1); repaint(); };
    });
    root.querySelectorAll("[data-zoom]").forEach(function (im) {
      im.onclick = function () { openImage(list[+im.getAttribute("data-zoom")].url); };
    });
    var file = root.querySelector('[data-a="file"]'), add = root.querySelector('[data-a="add"]');
    if (add && file) {
      add.onclick = function () { file.click(); };
      file.onchange = function () { addFiles(file.files, list, cap).then(repaint); };
    }
  }
  function onPasteInto(el, list, cap, repaint) {
    el.addEventListener("paste", function (e) {
      var items = (e.clipboardData && e.clipboardData.items) || [];
      var files = [];
      for (var i = 0; i < items.length; i++) if (items[i].kind === "file") { var f = items[i].getAsFile(); if (f) files.push(f); }
      if (files.length) { e.preventDefault(); addFiles(files, list, cap).then(repaint); }
    });
    el.addEventListener("dragover", function (e) { e.preventDefault(); el.classList.add("zp-drop"); });
    el.addEventListener("dragleave", function () { el.classList.remove("zp-drop"); });
    el.addEventListener("drop", function (e) {
      e.preventDefault(); el.classList.remove("zp-drop");
      addFiles(e.dataTransfer && e.dataTransfer.files, list, cap).then(repaint);
    });
  }
  function openImage(url) {
    if (!/^data:/.test(url)) { window.open(url, "_blank", "noopener"); return; }
    var w = window.open("", "_blank");
    if (w) { w.document.title = "Picture"; w.document.body.style.margin = "0"; var im = w.document.createElement("img"); im.src = url; im.style.maxWidth = "100%"; w.document.body.appendChild(im); }
  }

  function paintNew() {
    var body = panel.querySelector("#zpBody"), foot = panel.querySelector("#zpFoot");
    var d = S.draft, bug = S.kind === "bug";
    body.innerHTML = '<div class="rs-seg" role="tablist" aria-label="Kind">'
      + '<button type="button" data-k="bug" class="' + (bug ? "on" : "") + '">Something is broken</button>'
      + '<button type="button" data-k="request" class="' + (!bug ? "on" : "") + '">I need a change</button></div>'
      + '<div class="zp-page" style="margin-top:10px">From: <b>' + esc((S.page && S.page.title) || "the portal") + "</b></div>"
      + '<label class="zp-lab" for="zpTitle">Short title</label>'
      + '<input class="zp-in" id="zpTitle" maxlength="160" placeholder="' + (bug ? "e.g. August totals do not add up" : "e.g. Add a column for the move date") + '" value="' + esc(d.title) + '">'
      + '<label class="zp-lab" for="zpText">' + (bug ? "What happened?" : "What do you need, and why?") + "</label>"
      + '<textarea class="zp-ta" id="zpText" maxlength="4000" placeholder="' + (bug ? "What you did, what you saw. Paste more pictures here with Ctrl+V." : "What it should do, and what it would help with.") + '">' + esc(d.body) + "</textarea>"
      + (bug ? '<label class="zp-lab" for="zpExp">What did you expect? <span style="text-transform:none;font-weight:500">(optional)</span></label>'
        + '<textarea class="zp-ta sm" id="zpExp" maxlength="2000">' + esc(d.expected) + "</textarea>" : "")
      + '<label class="zp-lab">Pictures</label>' + picsHtml(S.pics, MAX_PICS)
      + '<div class="zp-hint">' + (S.pics.some(function (p) { return p.auto; })
        ? "We took a picture of this screen. Remove it if it shows something that should not be shared."
        : "Paste a screenshot (Ctrl+V), drop one here, or pick a file.") + " Only you and the tech team see them.</div>"
      + '<div class="zp-err" id="zpErr" hidden></div>';
    foot.innerHTML = '<span class="zp-sp">Your sign-in goes with it.</span>'
      + '<button type="button" class="rs-btn" data-a="cancel">Cancel</button>'
      + '<button type="button" class="rs-btn pri" data-a="send"' + (S.sending ? " disabled" : "") + ">" + (S.sending ? "Sending…" : "Send") + "</button>";
    var keep = function () {
      var t = body.querySelector("#zpTitle"), x = body.querySelector("#zpText"), e = body.querySelector("#zpExp");
      if (t) d.title = t.value; if (x) d.body = x.value; if (e) d.expected = e.value;
    };
    body.querySelectorAll("[data-k]").forEach(function (b) {
      b.onclick = function () { keep(); S.kind = b.getAttribute("data-k"); paintNew(); };
    });
    ["#zpTitle", "#zpText", "#zpExp"].forEach(function (sel) {
      var el = body.querySelector(sel);
      if (el) el.oninput = keep;
    });
    var repaint = function () { keep(); paintNew(); };
    wirePics(body, S.pics, MAX_PICS, repaint);
    onPasteInto(body.querySelector("#zpText"), S.pics, MAX_PICS, repaint);
    onPasteInto(body, S.pics, MAX_PICS, repaint);
    foot.querySelector('[data-a="cancel"]').onclick = closePanel;
    foot.querySelector('[data-a="send"]').onclick = function () { keep(); send(); };
    var focus = body.querySelector(d.title ? "#zpText" : "#zpTitle");
    if (focus) setTimeout(function () { try { focus.focus(); } catch (e) { /* ignore */ } }, 30);
  }
  function showErr(m) {
    var e = panel && panel.querySelector("#zpErr");
    if (e) { e.hidden = false; e.textContent = m; } else toast(m);
  }
  function send() {
    var d = S.draft;
    if ((d.body || "").trim().length < 10) { showErr("Say a little more about it: at least 10 characters."); return; }
    S.sending = true; paintNew();
    var payload = {
      action: "file", kind: S.kind, title: d.title, body: d.body, expected: S.kind === "bug" ? d.expected : "",
      page_id: (S.page && S.page.id) || "", page_title: (S.page && S.page.title) || "",
      place: { url: location.href, screen: window.innerWidth + "x" + window.innerHeight, ua: navigator.userAgent, errors: ERRS.slice() },
      images: S.pics.map(function (p) { return { b64: p.url }; }),
    };
    api({ method: "POST", body: JSON.stringify(payload) }).then(function (j) {
      S.sending = false; S.pics = []; S.draft = { title: "", body: "", expected: "" }; S.mine = null;
      loadBadge();
      var body = panel && panel.querySelector("#zpBody"), foot = panel && panel.querySelector("#zpFoot");
      if (!body) return;
      body.innerHTML = '<div class="zp-done"><div class="zp-tick">✓</div><h3>Sent as ' + esc(j.key) + "</h3>"
        + "<p>Thank you. You will get an email when it is picked up, when it is done, or if it will not be done.<br>"
        + "Replies show under <b>My requests</b>.</p></div>";
      foot.innerHTML = '<span class="zp-sp"></span><button type="button" class="rs-btn" data-a="mine">My requests</button>'
        + '<button type="button" class="rs-btn pri" data-a="close">Close</button>';
      foot.querySelector('[data-a="close"]').onclick = closePanel;
      foot.querySelector('[data-a="mine"]').onclick = function () { S.view = "mine"; paint(); };
    }).catch(function (e) {
      S.sending = false; paintNew(); showErr(e.message || "Could not send it.");
    });
  }

  /* ---- My requests ------------------------------------------------------------------------------------ */
  function paintMine() {
    var body = panel.querySelector("#zpBody"), foot = panel.querySelector("#zpFoot");
    foot.innerHTML = '<span class="zp-sp">Everything you have sent, newest first.</span>';
    if (!S.mine) {
      body.innerHTML = '<div class="zp-empty">Loading…</div>';
      api(null, "?mine=1&status=all").then(function (j) { S.mine = j.requests || []; if (panel && S.view === "mine") paintMine(); })
        .catch(function (e) { body.innerHTML = '<div class="zp-empty">' + esc(e.message) + "</div>"; });
      return;
    }
    if (!S.mine.length) {
      body.innerHTML = '<div class="zp-empty">You have not sent anything yet.<br>Use <b>New</b> to report a bug or ask for a change.</div>';
      return;
    }
    body.innerHTML = '<div class="zp-list">' + S.mine.map(function (r) {
      return '<button type="button" class="zp-row" data-id="' + esc(r.key) + '"><span class="k">' + esc(r.key) + '</span><span class="grow">'
        + '<div class="t">' + esc(r.title) + (r.unread ? '<span class="zp-new" title="New reply"></span>' : "") + "</div>"
        + '<div class="m">' + (r.kind === "bug" ? "Bug" : "Request") + " · " + esc(r.page_title || "portal") + " · " + ago(r.created_at)
        + (r.replies ? " · " + r.replies + " repl" + (r.replies === 1 ? "y" : "ies") : "") + "</div></span>"
        + '<span class="rs-pill ' + (PILL[r.status] || "mute") + '">' + esc(STATUS[r.status] || r.status) + "</span></button>";
    }).join("") + "</div>";
    body.querySelectorAll("[data-id]").forEach(function (b) { b.onclick = function () { openThread(b.getAttribute("data-id")); }; });
  }

  /* ---- one request and its thread -------------------------------------------------------------------- */
  var replyPics = [];
  function openThread(key) {
    S.view = "thread"; S.open = { key: key, loading: true }; replyPics = [];
    openPanel();
    api(null, "?id=" + encodeURIComponent(key)).then(function (j) {
      S.open = j.request; if (panel && S.view === "thread") paint();
      loadBadge();
      if (S.mine) S.mine.forEach(function (r) { if (r.key === key) r.unread = false; });
    }).catch(function (e) { S.open = { key: key, error: e.message }; if (panel) paint(); });
  }
  function evText(ev) {
    var m = /^status:(\w+)$/.exec(ev || "");
    if (m) return "Marked " + (STATUS[m[1]] || m[1]).toLowerCase();
    var d = /^duplicate:(\d+)$/.exec(ev || "");
    if (d) return "Marked as a repeat of ZP-" + d[1];
    return ev;
  }
  function paintThread() {
    var body = panel.querySelector("#zpBody"), foot = panel.querySelector("#zpFoot"), r = S.open || {};
    var back = (r.own === false && S.me && S.me.admin)
      ? '<button type="button" class="zp-back" data-a="board">← Open it on the board</button>'
      : '<button type="button" class="zp-back" data-a="back">← My requests</button>';
    if (r.loading) { body.innerHTML = back + '<div class="zp-empty">Loading…</div>'; foot.innerHTML = ""; wireBack(); return; }
    if (r.error) { body.innerHTML = back + '<div class="zp-empty">' + esc(r.error) + "</div>"; foot.innerHTML = ""; wireBack(); return; }
    var imgs = (r.images || []).map(function (i) { return { url: i.url }; });
    body.innerHTML = back
      + '<span class="rs-pill ' + (PILL[r.status] || "mute") + '">' + esc(STATUS[r.status] || r.status) + "</span>"
      + '<div class="zp-q">' + esc(r.title) + "</div>"
      + '<div class="zp-sub">' + (r.kind === "bug" ? "Bug" : "Request") + " · from " + esc(r.page_title || "the portal") + " · " + ago(r.created_at) + "</div>"
      + '<div class="zp-txt">' + esc(r.body) + "</div>"
      + (r.expected ? '<div class="zp-lab">Expected</div><div class="zp-txt">' + esc(r.expected) + "</div>" : "")
      + (imgs.length ? '<div class="zp-pics">' + imgs.map(function (p, i) {
        return '<div class="zp-pic"><img src="' + esc(p.url) + '" alt="" data-big="' + i + '"></div>';
      }).join("") + "</div>" : "")
      + '<div class="zp-thread">' + (r.thread || []).map(function (c) {
        if (c.event) return '<div class="zp-ev">' + esc(evText(c.event)) + " · " + ago(c.at) + "</div>";
        return '<div class="zp-msg' + (c.staff ? " staff" : "") + '"><div class="who">' + esc(c.author) + " <span>· " + ago(c.at) + "</span></div>"
          + (c.body ? '<div class="zp-txt">' + esc(c.body) + "</div>" : "")
          + ((c.images || []).length ? '<div class="zp-pics">' + c.images.map(function (p) {
            return '<div class="zp-pic"><img src="' + esc(p.url) + '" alt="" data-url="' + esc(p.url) + '"></div>';
          }).join("") + "</div>" : "") + "</div>";
      }).join("") + "</div>"
      + '<label class="zp-lab" for="zpReply">Reply</label><textarea class="zp-ta sm" id="zpReply" maxlength="4000" placeholder="Add something, or answer a question. Ctrl+V pastes a picture."></textarea>'
      + '<div id="zpRPics"></div><div class="zp-err" id="zpErr" hidden></div>';
    foot.innerHTML = '<span class="zp-sp"></span><button type="button" class="rs-btn pri" data-a="reply">Send reply</button>';
    wireBack();
    body.querySelectorAll("[data-big]").forEach(function (im) { im.onclick = function () { openImage(imgs[+im.getAttribute("data-big")].url); }; });
    body.querySelectorAll("[data-url]").forEach(function (im) { im.onclick = function () { openImage(im.getAttribute("data-url")); }; });
    var ta = body.querySelector("#zpReply"), holder = body.querySelector("#zpRPics");
    var repaintPics = function () {
      holder.innerHTML = replyPics.length ? picsHtml(replyPics, MAX_REPLY_PICS) : "";
      wirePics(holder, replyPics, MAX_REPLY_PICS, repaintPics);
    };
    repaintPics();
    onPasteInto(ta, replyPics, MAX_REPLY_PICS, repaintPics);
    ta.addEventListener("keydown", function (e) { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendReply(); });
    foot.querySelector('[data-a="reply"]').onclick = sendReply;
    function sendReply() {
      var text = ta.value.trim();
      if (!text && !replyPics.length) { showErr("Write something first."); return; }
      var btn = foot.querySelector('[data-a="reply"]'); btn.disabled = true; btn.textContent = "Sending…";
      api({ method: "POST", body: JSON.stringify({ action: "reply", id: r.key, body: text,
        images: replyPics.map(function (p) { return { b64: p.url }; }) }) })
        .then(function () { replyPics = []; openThread(r.key); })
        .catch(function (e) { btn.disabled = false; btn.textContent = "Send reply"; showErr(e.message); });
    }
  }
  function wireBack() {
    var b = panel.querySelector('[data-a="back"]');
    if (b) b.onclick = function () { S.view = "mine"; S.open = null; S.mine = null; paint(); };
    var bb = panel.querySelector('[data-a="board"]');
    if (bb) bb.onclick = function () {
      var k = S.open && S.open.key; closePanel();
      DEEP = k; DEEP_BOARD = true;                              // the board opens its drawer on it
      if (location.hash.indexOf("page=bugs-requests") >= 0 && window.ZPBoard) window.ZPBoard.open(ZPB.takeDeep());
      else location.hash = "page=bugs-requests";
    };
  }

  /* ---- the shell calls this once it knows who is signed in --------------------------------------- */
  var timer = null;
  function mount(me) {
    if (!me || !me.authorized) return;
    S.me = me;
    css();
    mountButton();
    loadBadge();
    if (!timer) timer = setInterval(function () { if (!document.hidden) loadBadge(); }, POLL_MS);
    document.addEventListener("visibilitychange", function () { if (!document.hidden) loadBadge(); });
    // the header can be rebuilt by the shell; put the button back if it went
    window.addEventListener("hashchange", function () { setTimeout(mountButton, 0); });
    if (DEEP && !DEEP_BOARD) { var k = DEEP; DEEP = null; setTimeout(function () { openThread(k.toUpperCase()); }, 300); }
  }
  function takeDeep() { var k = DEEP_BOARD ? DEEP : null; DEEP = null; DEEP_BOARD = false; return k ? k.toUpperCase() : null; }

  window.ZPB = { mount: mount, refresh: loadBadge, open: openThread, takeDeep: takeDeep, _errors: ERRS };
})();
