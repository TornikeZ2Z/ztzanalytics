/* EMAIL DESIGNER -- the email editor shared by Email Automations (pages/email-automations.js) and the
 * Customer Survey's Email tab (pages/surveys.js). Tracker ZTZ-60 / ZTZ-69.
 *
 * v4, 12 Nov 2026 (ZTZ-69 step 3, his "go with step 3" on the 11 Nov plan and mockups):
 *   HEADER     what it is, whether it's live, "N changes not live yet", and Discard changes / Send a test… /
 *              Make changes live. Edits to a live email wait as a draft: customers keep getting the live one.
 *   THREE ZONES the parts list (top to bottom), the email itself (click a part in it to select it) and the
 *              settings panel (the chosen part · Inbox · Whole email), with a checks bar under the email.
 *              A pasted-HTML email has parts too: the rows of its main table, each one changeable, movable,
 *              removable; a picture part has Choose another / Crop again / what it says / where it opens.
 *   TOOLS      Design / HTML code (pasted emails), Desktop / Phone, Pictures off, Pictures (the library).
 *
 *   EMAILDESIGNER.mount(el, {
 *     template,          the email object (edited in place: subject, preheader, mode, html, blocks, sign_*)
 *     live,              the live email to count changes against (null: nothing live yet, e.g. a draft)
 *     head,              {title, pills: [[text, ok|warn|bad]], meta, save, testTo, testNote,
 *                         onTest(to) -> Promise<message>, onLive() -> Promise, onDiscard() -> Promise,
 *                         tested(nChanges) -> [lvl, text] | null}
 *     ui,                an object the page keeps, so a repaint keeps the chosen part, tab and view
 *     kit,               bridge/email_auto.kit(): colours, fonts, stickers, designs, survey_link
 *     survey,            true on the survey: links may open "the customer's own survey"
 *     senders, sender,   From choices (omit on the survey) and the current one; onSender(v)
 *     category,          for the footer's unsubscribe wording in the preview
 *     preview(tpl)       -> Promise<{subject, html, problems}> (the bridge marks each block's row data-emd)
 *     upload(file)       -> Promise<url>   (PNG / JPG / GIF, up to 2 MB)
 *     pictures           picturesApi(get, post): the Pictures library
 *     onChange()         called after every edit (the page saves the draft by itself)
 *     designs            true: offer "Start from a design"
 *   })  ->  { refresh(), template(), changes(), setSave(text), setHead(cfg) }
 *
 * Every control has a visible label or an aria-label, targets are 34px or more, and status colours have
 * their own dark-theme values (--emd-ok / --emd-warn / --emd-bad).
 */
(() => {
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const NAMES = { logo: "Logo bar", banner: "Banner", strip: "Strip", heading: "Heading", text: "Text", button: "Button",
                  image: "Picture", divider: "Line", bar: "Bottom bar" };
  const HINTS = { logo: "The logo on a light band", banner: "Big headline, stars, sticker", strip: "A band of spaced words",
                  heading: "A bold line", text: "Paragraphs", button: "A link people press", image: "A photo or graphic",
                  divider: "A thin rule", bar: "A colour band at the bottom" };
  const COLOR_NAMES = { green: "Green", black: "Black", white: "White", light: "Light", deep: "Dark green" };

  /* what "Copy instructions for Claude" puts on the clipboard: paste it into Claude, describe the email,
     paste Claude's HTML back here */
  function claudeRules(survey) {
    return [
      "Write an HTML email for Zip To Zip Moving (a moving company in New Jersey).",
      "Rules:",
      "- Email-safe HTML only: tables for layout, inline styles, 600px wide at most, no JavaScript, no forms, no external CSS files.",
      "- Use these placeholders exactly as written: {first} (the customer's first name), {move_date} (their move day), {foreman} (their foreman), {state}.",
      survey ? "- The main button's link must be exactly {survey_link}. It becomes each customer's personal survey link." : "- Buttons and links must use full https:// addresses.",
      "- Don't add a footer, the company address or an unsubscribe link: they are added automatically.",
      "- Pictures must use https:// addresses. Brand colours: green #8db13c, black #141414, white #ffffff, light #f4f4ef.",
      "- Keep the whole email under 90 KB.",
      "Reply with the HTML only.",
      "",
      "The email: ",
    ].join("\n");
  }

  // the preview's sample customer, for the inbox line above the email
  const SAMPLE = { first: "Jordan", name: "Jordan Smith", move_date: "October 24", foreman: "Giorgi", state: "NJ" };
  const fillSample = s => String(s || "").replace(/\{(first|name|move_date|foreman|state)\}/g, (m, k) => SAMPLE[k]);
  const decode = s => { const d = document.createElement("textarea"); d.innerHTML = String(s || ""); return d.value; };
  const escAttr = s => String(s == null ? "" : s).replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escText = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  /* THE PASTED EMAIL'S PARTS (12 Nov, ZTZ-69 step 3): the rows of its main table -- the table with the most
     rows of its own -- read straight from the source, so each part is a piece of the text we can change,
     move or remove without touching the rest. The preview finds the same rows the same way. */
  const _rows = { src: null, out: [] };
  function rowRanges(src) {
    if (_rows.src === src) return _rows.out;
    const re = /<!--[\s\S]*?-->|<(\/?)(table|tr)\b[^>]*>/gi;
    const stack = [], tables = [];
    let m;
    while ((m = re.exec(src))) {
      if (m[0].charCodeAt(1) === 33) continue;                        // a comment
      const close = m[1] === "/", tag = m[2].toLowerCase();
      if (tag === "table") {
        if (!close) { const t = { rows: [], open: -1 }; stack.push(t); tables.push(t); } else stack.pop();
      } else {
        const t = stack[stack.length - 1];
        if (!t) continue;
        if (!close) t.open = m.index;
        else if (t.open >= 0) { t.rows.push([t.open, m.index + m[0].length]); t.open = -1; }
      }
    }
    let best = null;
    tables.forEach(t => { if (!best || t.rows.length > best.rows.length) best = t; });
    _rows.src = src; _rows.out = best && best.rows.length >= 2 ? best.rows : [];
    return _rows.out;
  }
  const tagRe = name => new RegExp("<" + name + "\\b[^>]*>", "i");
  function attrOf(row, tag, name) {
    const m = row.match(tagRe(tag)); if (!m) return "";
    const a = m[0].match(new RegExp("\\s" + name + "\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
    return a ? decode(a[2] != null ? a[2] : a[3] != null ? a[3] : (a[4] || "")) : "";
  }
  function setAttr(row, tag, name, val) {
    const m = row.match(tagRe(tag)); if (!m) return row;
    const t0 = m[0], re = new RegExp("(\\s" + name + "\\s*=\\s*)(\"[^\"]*\"|'[^']*'|[^\\s>]+)", "i"), v = '"' + escAttr(val) + '"';
    const t1 = re.test(t0) ? t0.replace(re, (x, a) => a + v) : t0.replace(/\s*(\/?)>$/, (x, sl) => " " + name + "=" + v + sl + ">");
    return row.slice(0, m.index) + t1 + row.slice(m.index + t0.length);
  }
  // the button's words, when they are plain text (an arrow entity is fine); null when there is markup inside
  function linkWords(row) {
    const m = row.match(/<a\b[^>]*>([\s\S]*?)<\/a>/i);
    return m && !/<[a-z]/i.test(m[1]) ? m[1] : null;
  }
  function setLinkWords(row, words) {
    return row.replace(/(<a\b[^>]*>)([\s\S]*?)(<\/a>)/i, (x, a, w, c) => a + words + c);
  }
  function partInfo(row) {
    // (a space before each line break, so "Thank you,<br>Tako" reads "Thank you, Tako" in the list)
    const doc = new DOMParser().parseFromString("<table><tbody>" + row.replace(/<br\b/gi, " <br") + "</tbody></table>", "text/html");
    const tr = doc.querySelector("tr");
    if (!tr) return { kind: "section", name: "Part", sum: "" };
    const imgs = [...tr.querySelectorAll("img")], links = [...tr.querySelectorAll("a[href]")];
    const text = (tr.textContent || "").replace(/[\s\u00a0\u200c]+/g, " ").trim();
    const bgOf = n => {
      for (let x = n; x && x.getAttribute; x = x.parentElement) {
        const b = x.getAttribute("bgcolor") || ((x.getAttribute("style") || "").match(/background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgb[^;)]*\))/i) || [])[1];
        if (b) return b;
      }
      return "";
    };
    const td = tr.querySelector("td,th"), cellBg = td ? bgOf(td) : "";
    if (imgs.length === 1 && text.length < 3) {
      const im = imgs[0];
      return { kind: "picture", name: "Picture", sum: im.getAttribute("alt") || "no description yet", src: im.getAttribute("src") || "" };
    }
    if (!imgs.length && !text) return cellBg ? { kind: "band", name: "Colour band", sum: cellBg, bg: cellBg } : { kind: "space", name: "Space", sum: "room between parts" };
    if (links.length === 1 && !imgs.length) {
      const a = links[0], st = (a.getAttribute("style") || "") + " " + bgOf(a);
      const at = (a.textContent || "").replace(/[\s\u00a0]+/g, " ").trim();
      if (/background|#[0-9a-f]{3}/i.test(st) && at.length >= text.length * 0.6) return { kind: "button", name: "Button", sum: at, bg: bgOf(a) };
    }
    if (imgs.length) return { kind: "section", name: "Pictures and text", sum: text.slice(0, 60) };
    // a heading: h1-h3, or big letters (font-size or the font shorthand, 19px and up), or short bold text
    const px = +((row.match(/font(?:-size)?\s*:[^;"]*?(\d+(?:\.\d+)?)px/i) || [])[1] || 0);
    const bold = /font-weight\s*:\s*(bold|[6-9]00)|font\s*:\s*(bold|[6-9]00)\b/i.test(row);
    const big = !!tr.querySelector("h1,h2,h3") || (px >= 19 && text.length < 120) || (bold && text.length < 80);
    if (cellBg && text.length < 90) return { kind: "strip", name: "Strip", sum: text, bg: cellBg };
    return { kind: big ? "heading" : "text", name: big ? "Heading" : "Text", sum: text.slice(0, 60) };
  }
  // new parts for a pasted email (typed in our own house style)
  const NEW_ROWS = {
    text: '<tr><td style="padding:16px 40px 0;font-family:Arial,Helvetica,sans-serif;font-size:15.5px;line-height:1.65;color:#2b2b2b;">Write your text here.</td></tr>',
    button: '<tr><td align="center" style="padding:26px 40px 0;"><a href="https://ziptozipmoving.com" style="display:inline-block;background:#141414;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-weight:bold;font-size:13px;letter-spacing:3px;text-decoration:none;padding:18px 34px;">VISIT OUR WEBSITE &#8594;</a></td></tr>',
    space: '<tr><td style="height:24px;line-height:24px;font-size:0;">&nbsp;</td></tr>',
  };

  function css() {
    if (document.getElementById("emd-style")) return;
    const st = document.createElement("style");
    st.id = "emd-style";
    st.textContent = ""
      // status colours, readable in both themes
      + ".emd3w,.emd-pics{--emd-ok:#166534;--emd-ok-bg:rgba(22,163,74,.12);--emd-warn:#92400e;--emd-warn-bg:rgba(217,119,6,.15);"
      + "--emd-bad:#991b1b;--emd-bad-bg:rgba(220,38,38,.12);--emd-sel:#0369a1;--emd-sel-bg:rgba(3,105,161,.10)}"
      + "body.rs-app:not(.light) .emd3w,body.rs-app:not(.light) .emd-pics{--emd-ok:#86efac;--emd-warn:#fcd34d;--emd-bad:#fca5a5;--emd-sel:#7dd3fc;--emd-sel-bg:rgba(125,211,252,.12)}"
      + ".emd3w{container-type:inline-size;color:var(--ink)}"
      + ".emd-help{font-size:12.5px;color:var(--muted);line-height:1.5;margin:4px 0 0}"
      + ".emd-help.ok{color:var(--emd-ok);font-weight:600}.emd-help.bad{color:var(--emd-bad);font-weight:600}"
      + ".emd3w label.l{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:12px 0 5px}"
      + ".emd3w input[type=text],.emd3w input:not([type]),.emd3w textarea,.emd3w select{width:100%;box-sizing:border-box;font:inherit;"
      + "font-size:14px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:38px}"
      + ".emd3w textarea{resize:vertical;line-height:1.5}"
      + ".emd3w button:focus-visible,.emd3w input:focus-visible,.emd3w select:focus-visible,.emd3w textarea:focus-visible,.emd3w summary:focus-visible"
      + "{outline:2px solid var(--brand-d,#5f7c20);outline-offset:2px}"
      // the header: what this is, whether it's live, and the three things you do with your changes
      + ".emd-head{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:12px}"
      + ".emd-head-l{flex:1 1 360px;min-width:0;display:flex;flex-direction:column;gap:4px}"
      + ".emd-head-t{display:flex;align-items:center;gap:8px;flex-wrap:wrap}"
      + ".emd-head-t h2{margin:0;font-size:21px;font-weight:800;color:var(--ink)}"
      + ".emd-head-m{font-size:13px;color:var(--muted);line-height:1.5}"
      + ".emd-head-msg{font-size:13px;font-weight:600}.emd-head-msg.ok{color:var(--emd-ok)}.emd-head-msg.bad{color:var(--emd-bad)}"
      + ".emd-head-a{display:flex;gap:8px;flex-wrap:wrap;align-items:center}"
      + ".emd-head-a .rs-btn{min-height:40px}"
      + ".emd-pill{display:inline-block;font-size:12.5px;font-weight:700;padding:3px 10px;border-radius:99px;background:var(--panel-2);color:var(--muted);white-space:nowrap}"
      + ".emd-pill.ok{background:var(--emd-ok-bg);color:var(--emd-ok)}.emd-pill.warn{background:var(--emd-warn-bg);color:var(--emd-warn)}"
      + ".emd-pill.bad{background:var(--emd-bad-bg);color:var(--emd-bad)}"
      + ".emd-tw{position:relative}"
      + ".emd-pop{position:absolute;right:0;top:calc(100% + 6px);z-index:50;width:340px;max-width:calc(100vw - 40px);background:var(--panel);border:1px solid var(--line);"
      + "border-radius:12px;box-shadow:0 12px 30px rgba(15,23,42,.18);padding:12px 14px}"
      + ".emd-pop label.l{margin-top:0}.emd-pop-r{display:flex;gap:8px}.emd-pop-r input{flex:1;min-width:0}"
      // the tool row
      + ".emd-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:12px}"
      + ".emd-sp{flex:1}"
      + ".emd-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}"
      + ".emd-seg button{border:0;background:transparent;color:var(--ink);font:inherit;font-size:13.5px;padding:7px 14px;cursor:pointer;min-height:38px}"
      + ".emd-seg button+button{border-left:1px solid var(--line)}"
      + ".emd-seg button.on{background:var(--ink);color:var(--panel);font-weight:700}"
      + ".emd-tog{font:inherit;font-size:13.5px;padding:7px 14px;border-radius:10px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;min-height:38px}"
      + ".emd-tog.on{background:var(--ink);color:var(--panel);font-weight:700;border-color:var(--ink)}"
      + ".emd-ico{display:inline-flex;align-items:center;gap:7px}.emd-ico svg{flex:none}"
      // three zones: the parts, the email, the settings
      + ".emd3{display:grid;gap:14px;align-items:start;grid-template-columns:minmax(0,1fr);grid-template-areas:'parts' 'side' 'mid'}"
      + "@container (min-width:820px){.emd3{grid-template-columns:290px minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:'parts mid' 'side mid'}}"
      + "@container (min-width:1180px){.emd3{grid-template-columns:236px minmax(0,1fr) 330px;grid-template-rows:auto;grid-template-areas:'parts mid side'}"
      + ".emd-parts,.emd-side{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto}}"
      + ".emd3.code{grid-template-areas:'code' 'side' 'mid'}"
      + "@container (min-width:820px){.emd3.code{grid-template-columns:minmax(0,1fr) minmax(0,1fr);grid-template-rows:auto 1fr;grid-template-areas:'code mid' 'side mid'}}"
      + "@container (min-width:1180px){.emd3.code{grid-template-columns:minmax(0,1.1fr) minmax(0,1fr) 330px;grid-template-rows:auto;grid-template-areas:'code mid side'}}"
      + ".emd-parts{grid-area:parts}.emd-mid{grid-area:mid;min-width:0}.emd-side{grid-area:side;align-self:start}.emd-codecol{grid-area:code;min-width:0}"
      + ".emd-parts,.emd-side,.emd-codecol{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:12px;box-sizing:border-box}"
      + ".emd-side{padding:14px 16px}"
      + ".emd-cap{margin:4px 6px 8px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}"
      + ".emd-part{display:flex;gap:10px;align-items:center;width:100%;text-align:left;padding:7px 9px;border-radius:10px;border:0;background:transparent;"
      + "font:inherit;color:var(--ink);cursor:pointer;min-height:46px;margin-bottom:2px}"
      + ".emd-part:hover{background:var(--panel-2)}"
      + ".emd-part.on{background:var(--emd-sel-bg);box-shadow:inset 3px 0 0 var(--emd-sel)}"
      + ".emd-part .tx{display:flex;flex-direction:column;min-width:0}.emd-part b{font-size:13.5px}"
      + ".emd-part small{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:170px}"
      + ".emd-th{flex:none;width:42px;height:28px;border-radius:6px;border:1px solid var(--line);background:#fff;display:flex;align-items:center;justify-content:center;"
      + "overflow:hidden;font:700 11px/1 Arial,sans-serif;color:#475569;box-sizing:border-box}"
      + ".emd-th img{width:100%;height:100%;object-fit:cover;display:block}"
      + ".emd-th .bt{width:26px;height:9px;background:#141414;border-radius:1px}.emd-th .bb{align-self:flex-end;width:100%;height:6px}"
      + ".emd-addp{width:100%;font:inherit;font-size:13.5px;font-weight:700;margin-top:8px;padding:10px 12px;border-radius:10px;border:1px dashed var(--muted);"
      + "background:transparent;color:var(--ink);cursor:pointer;min-height:44px}"
      + ".emd-addp:hover{border-color:var(--ink)}"
      + ".emd-add{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;margin-top:8px}"
      + ".emd-add button{text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:8px 10px;cursor:pointer;font:inherit;color:var(--ink);min-height:44px}"
      + ".emd-add button:hover{border-color:var(--brand)}.emd-add b{display:block;font-size:13px}.emd-add span{font-size:12px;color:var(--muted)}"
      // the email
      + ".emd-inbox{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px 14px;font-size:13.5px;display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}"
      + ".emd-inbox .s{color:var(--ink);font-weight:600}.emd-inbox .p{color:var(--muted)}"
      + ".emd-pv{border:1px solid var(--line);border-radius:14px;background:#ebeae4;overflow:hidden}"
      + ".emd-pv iframe{display:block;border:0;width:100%;height:760px;background:#ebeae4;margin:0 auto}"
      + ".emd-pv.mob iframe{width:390px;max-width:100%}"
      + ".emd-checks{display:flex;gap:8px 18px;flex-wrap:wrap;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:11px 14px;margin-top:10px;font-size:13.5px}"
      + ".emd-ck{display:inline-flex;gap:6px;align-items:baseline;font-weight:600}"
      + ".emd-ck.ok{color:var(--emd-ok)}.emd-ck.warn{color:var(--emd-warn)}.emd-ck.bad{color:var(--emd-bad)}.emd-ck.info{color:var(--muted)}"
      + ".emd-sample{font-size:12.5px;color:var(--muted);margin:6px 2px 0}"
      // the settings
      + ".emd-tabs{display:flex;gap:6px;flex-wrap:wrap;border-bottom:1px solid var(--line);padding-bottom:10px;margin-bottom:4px}"
      + ".emd-tabs button{font:inherit;font-size:13.5px;padding:7px 12px;border:0;border-radius:8px;background:var(--panel-2);color:var(--ink);cursor:pointer;min-height:38px}"
      + ".emd-tabs button.on{background:var(--ink);color:var(--panel);font-weight:700}"
      + ".emd-ptools{display:flex;gap:6px;align-items:center;margin:10px 0 2px}"
      + ".emd-ptools .nm{flex:1;font-weight:700;font-size:15px}"
      + ".emd-ib{min-width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;font-size:15px;line-height:1;padding:0 8px}"
      + ".emd-ib:hover{border-color:var(--muted)}.emd-ib:disabled{opacity:.35;cursor:default}"
      + ".emd-big{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#ebeae4;margin-top:10px;max-height:220px;display:flex;justify-content:center}"
      + ".emd-big img{max-width:100%;max-height:220px;display:block;object-fit:contain}"
      + ".emd-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}"
      + ".emd-det{margin-top:14px;border-top:1px solid var(--line);padding-top:10px}"
      + ".emd-det summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--ink);min-height:28px;display:flex;align-items:center}"
      + ".emd3w textarea.emd-code{font:12.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace!important;white-space:pre;tab-size:2}"
      + ".emd-codecol textarea.emd-code{min-height:560px}"
      + ".emd-meter{font-size:12.5px;color:var(--muted);margin-top:6px}.emd-meter.bad{color:var(--emd-bad);font-weight:600}"
      + ".emd-sw{display:inline-flex;gap:6px;flex-wrap:wrap}"
      + ".emd-sw button{width:34px;height:34px;border-radius:8px;border:1px solid var(--line);cursor:pointer;padding:0}"
      + ".emd-sw button.on{outline:2px solid var(--ink);outline-offset:2px}"
      + ".emd-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}"
      + ".emd-ln{display:grid;grid-template-columns:minmax(0,1fr);gap:6px;margin:6px 0}"
      + ".emd-chk{display:inline-flex;gap:8px;align-items:center;font-size:13.5px;cursor:pointer;min-height:34px}"
      + ".emd-chk input{width:18px;height:18px}"
      + ".emd-thumb{display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap}.emd-thumb img{max-width:120px;max-height:60px;border-radius:6px;border:1px solid var(--line);background:#fff}"
      + ".emd-designs{display:grid;grid-template-columns:minmax(0,1fr);gap:6px}"
      + ".emd-designs button{text-align:left;border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:9px 11px;cursor:pointer;font:inherit;color:var(--ink)}"
      + ".emd-designs button:hover{border-color:var(--brand)}.emd-designs b{display:block}.emd-designs span{font-size:12px;color:var(--muted)}"
      + ".emd-h{font-size:13.5px;font-weight:700;color:var(--ink);margin:14px 0 4px}"
      // the Pictures window (11 Nov, ZTZ-69)
      + ".emd-pics{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}"
      + ".emd-pics-dlg{width:100%;max-width:1180px;background:var(--panel,#fff);color:var(--ink,#0f172a);border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.3)}"
      + ".emd-pics .emd-help{font-size:12.5px;color:var(--muted);line-height:1.5;margin:4px 0 0}"
      + ".emd-pics .emd-ib{min-width:36px;height:36px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);cursor:pointer;font-size:15px}"
      + ".emd-pics .emd-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}"
      + ".emd-pics .emd-seg button{border:0;background:var(--panel);color:var(--ink);font:inherit;font-size:13px;padding:7px 12px;cursor:pointer;min-height:36px}"
      + ".emd-pics .emd-seg button+button{border-left:1px solid var(--line)}.emd-pics .emd-seg button.on{background:var(--ink);color:var(--panel);font-weight:700}"
      + ".emd-pics-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--line)}"
      + ".emd-pics-head h2{margin:0;font-size:19px;font-weight:700;flex:1}"
      + ".emd-pics-body{display:flex;flex-wrap:wrap;min-height:420px}"
      + ".emd-pics-lib,.emd-crop{flex:999 1 560px;min-width:0;padding:16px 18px}"
      + ".emd-pics-side{flex:1 1 300px;max-width:400px;border-left:1px solid var(--line);padding:16px 18px;display:flex;flex-direction:column;gap:4px}"
      + "@media (max-width:900px){.emd-pics-side{border-left:0;border-top:1px solid var(--line);max-width:none}}"
      + ".emd-pics-tools{display:flex;gap:8px;margin-bottom:8px}.emd-pics-tools input{flex:1;min-width:0;font:inherit;font-size:14px;padding:8px 11px;"
      + "border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:38px}"
      + ".emd-pics-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}"
      + ".emd-pic{text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:0;overflow:hidden;cursor:pointer;"
      + "font:inherit;color:var(--ink);display:flex;flex-direction:column}"
      + ".emd-pic:hover{border-color:var(--muted)}.emd-pic.on{border-color:var(--emd-sel);box-shadow:0 0 0 2px var(--emd-sel)}"
      + ".emd-pic .th{height:96px;background:#ebeae4;display:flex;align-items:center;justify-content:center;overflow:hidden}"
      + ".emd-pic .th img{max-width:100%;max-height:96px;display:block}"
      + ".emd-pic b{font-size:13px;padding:7px 9px 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".emd-pic small{font-size:12px;color:var(--muted);padding:2px 9px 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}"
      + ".emd-pics-big{background:#ebeae4;border-radius:10px;padding:10px;display:flex;justify-content:center;max-height:300px;overflow:auto}"
      + ".emd-pics-big img{max-width:100%;height:auto;display:block}"
      + ".emd-pics-side label.l{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:10px 0 4px}"
      + ".emd-pics-side input,.emd-pics-side textarea{width:100%;box-sizing:border-box;font:inherit;font-size:14px;padding:8px 11px;border:1px solid var(--line);"
      + "border-radius:10px;background:var(--panel);color:var(--ink)}"
      + ".emd-pics-acts{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}"
      + ".emd-pics-err{color:var(--emd-bad);font-size:13px;font-weight:600}"
      + ".emd-pics-facts{display:flex;flex-direction:column;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;margin-top:10px}"
      + ".emd-pics-facts .warn{color:var(--emd-warn);font-weight:600}"
      + ".emd-crop-stage{position:relative;display:inline-block;max-width:100%;overflow:hidden;border-radius:8px;user-select:none;touch-action:none;background:#ebeae4;cursor:crosshair}"
      + ".emd-crop-stage img{display:block;max-width:100%;max-height:62vh;width:auto;height:auto}"
      + ".emd-crop-box{position:absolute;box-sizing:border-box;border:2px dashed #fff;outline:1px solid #0369a1;box-shadow:0 0 0 9999px rgba(15,23,42,.5);cursor:move}"
      + ".emd-crop-box:focus-visible{outline:3px solid #0369a1}"
      + ".emd-crop-box .h{position:absolute;width:16px;height:16px;background:#fff;border:2px solid #0369a1;box-sizing:border-box}"
      + ".emd-crop-box .nw{left:-9px;top:-9px;cursor:nwse-resize}.emd-crop-box .ne{right:-9px;top:-9px;cursor:nesw-resize}"
      + ".emd-crop-box .sw{left:-9px;bottom:-9px;cursor:nesw-resize}.emd-crop-box .se{right:-9px;bottom:-9px;cursor:nwse-resize}"
      + ".emd-vh{position:absolute;left:-9999px}"
      + ".emd-linkbtn{font:inherit;border:0;background:none;color:var(--brand-d,#3f7d20);text-decoration:underline;cursor:pointer;padding:0;font-weight:600}"
      + ".emd-pics button:focus-visible,.emd-pics input:focus-visible,.emd-pics textarea:focus-visible{outline:2px solid var(--brand-d,#5f7c20);outline-offset:2px}";
    document.head.appendChild(st);
  }

  const PIC_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
    + 'stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="M21 17l-5-5-9 8"></path></svg>';

  function mount(el, o) {
    css();
    const T = o.template;
    if (!Array.isArray(T.blocks)) T.blocks = [];
    const kit = o.kit || {};
    const colors = kit.colors || { green: "#8db13c", black: "#141414", white: "#ffffff", light: "#f4f4ef", deep: "#5f7f1f" };
    const fonts = kit.fonts || { archivo: "Archivo Black", arial: "Arial Black" };
    const stickers = kit.stickers || {};
    const surveyLink = kit.survey_link || "{survey_link}";
    const H = o.head || null;
    // what you were looking at survives a repaint of the page (the page keeps this object)
    const U = o.ui || {};
    ["sel", "tab", "view", "pv", "picsOff", "adding", "pvHtml", "pvSubject", "testTo"].forEach(k => { if (!(k in U)) U[k] = null; });
    if (!U.tab) U.tab = "part";
    if (!U.view || T.mode !== "html") U.view = "design";
    if (!U.pv) U.pv = "desk";
    if (U.testTo == null) U.testTo = (H && H.testTo) || "";
    let problems = [], pvT = null, busyUp = false, picCount = null, missingAlt = null, frameOk = false;
    let testOpen = false, testMsg = "", testBad = false, testBusy = false, actBusy = "", headMsg = (H && H.msg) || "", headBad = !!(H && H.msgBad), saveText = (H && H.save) || "";
    const isHtml = () => T.mode === "html";

    // ---- what changed against the live email --------------------------------------------------
    function rowsText(src) { return rowRanges(src || "").map(r => src.slice(r[0], r[1]).replace(/\s+/g, " ").trim()); }
    // parts changed, added, removed or moved: a new part in the middle counts once, not once per part below it
    function diffCount(a, b) {
      const m = a.length, k = b.length, L = Array.from({ length: m + 1 }, () => new Array(k + 1).fill(0));
      for (let i = m - 1; i >= 0; i--) for (let j = k - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
      return Math.max(m, k) - L[0][0];
    }
    function changes() {
      const L = o.live;
      if (!L) return 0;
      const J = x => JSON.stringify(x == null ? "" : x);
      let n = 0;
      ["subject", "preheader"].forEach(k => { if ((T[k] || "") !== (L[k] || "")) n++; });
      const m1 = isHtml() ? "html" : "blocks", m0 = L.mode === "html" ? "html" : "blocks";
      if (m1 !== m0) n++;
      if (m1 === "html") {
        const a = rowsText(T.html || ""), b = rowsText(L.html || "");
        if (!a.length || !b.length) { if (String(T.html || "").replace(/\s+/g, " ").trim() !== String(L.html || "").replace(/\s+/g, " ").trim()) n++; }
        else n += diffCount(a, b);
      } else {
        n += diffCount((T.blocks || []).map(J), (L.blocks || []).map(J));
        if (["sign_closing", "sign_name", "sign_title", "sign_color"].some(k => (T[k] || "") !== (L[k] || ""))) n++;
      }
      return n;
    }

    // ---- the parts --------------------------------------------------------------------------
    function summary(b) {
      if (b.t === "banner") return b.mode === "image" ? (b.alt || "picture headline") : (b.lines || []).map(x => x.text).filter(Boolean).join(" / ");
      if (b.t === "text" || b.t === "heading" || b.t === "strip") return b.text || "(empty)";
      if (b.t === "button") return (b.label || "") + (b.url === surveyLink ? " · opens the survey" : b.url ? "" : " · no link yet");
      if (b.t === "image") return b.url ? (b.alt || "no description yet") : "no picture yet";
      if (b.t === "logo") return (b.bg === "white" ? "white" : "light") + " band";
      if (b.t === "bar") return COLOR_NAMES[b.color] || "";
      if (b.t === "divider") return "a thin line";
      return "";
    }
    const swatch = (bg, inner) => '<span class="emd-th" aria-hidden="true" style="background:' + esc(bg || "#fff") + '">' + (inner || "") + "</span>";
    function thumbOf(p) {
      const b = p.b;
      if (b) {
        if (b.t === "logo") return swatch(colors[b.bg] || colors.light, '<span style="font-size:9px">LOGO</span>');
        if (b.t === "banner") return b.mode === "image" && b.image ? swatch("#fff", '<img src="' + esc(b.image) + '" alt="">') : swatch(colors[b.bg] || colors.green, "");
        if (b.t === "strip") return swatch(colors[b.bg] || colors.black, '<span style="color:' + esc(colors[b.color] || colors.green) + '">•••</span>');
        if (b.t === "image") return b.url ? swatch("#fff", '<img src="' + esc(b.url) + '" alt="">') : swatch("#fff", "?");
        if (b.t === "button") return swatch("#fff", '<span class="bt" style="background:' + esc(colors[b.color] || colors.black) + '"></span>');
        if (b.t === "bar") return swatch("#fff", '<span class="bb" style="background:' + esc(colors[b.color] || colors.green) + '"></span>');
        if (b.t === "heading") return swatch("#fff", "H");
        if (b.t === "divider") return swatch("#fff", "—");
        return swatch("#fff", "Aa");
      }
      if (p.kind === "sig") return swatch("#fff", "Aa");
      if (p.kind === "picture") return swatch("#fff", '<img src="' + esc(p.src) + '" alt="">');
      if (p.kind === "band" || p.kind === "strip") return swatch(p.bg, p.kind === "strip" ? '<span style="color:#8db13c">•••</span>' : "");
      if (p.kind === "button") return swatch("#fff", '<span class="bt" style="background:' + esc(p.bg || "#141414") + '"></span>');
      if (p.kind === "heading") return swatch("#fff", "H");
      if (p.kind === "space") return swatch("#fff", "");
      if (p.kind === "section") return swatch("#fff", "▦");
      return swatch("#fff", "Aa");
    }
    function parts() {
      if (isHtml()) {
        const src = T.html || "";
        return rowRanges(src).map((r, i) => Object.assign({ key: "h" + i, i, s: r[0], e: r[1] }, partInfo(src.slice(r[0], r[1]))));
      }
      const out = [], n = T.blocks.length;
      let tail = n;
      while (tail > 0 && T.blocks[tail - 1].t === "bar") tail--;
      const sig = { key: "sig", kind: "sig", name: "Signature", sum: [T.sign_closing, T.sign_name, T.sign_title].filter(Boolean).join(" · ") || "none" };
      T.blocks.forEach((b, i) => {
        if (i === tail) out.push(sig);
        out.push({ key: "b" + i, i, b, name: NAMES[b.t] || b.t, sum: summary(b) });
      });
      if (tail === n) out.push(sig);
      return out;
    }

    // ---- painting -----------------------------------------------------------------------------
    const pill = (t, c) => '<span class="emd-pill ' + (c || "") + '">' + esc(t) + "</span>";
    function headHtml() {
      const n = changes(), live = !!o.live;
      const pills = (H.pills || []).map(p => pill(p[0], p[1])).join("")
        + (live && n ? pill(n + (n === 1 ? " change" : " changes") + " not live yet", "warn") : "");
      const acts = (live && n && H.onDiscard ? '<button type="button" class="rs-btn" data-hd="discard"' + (actBusy ? " disabled" : "") + ">Discard changes</button>" : "")
        + (H.onTest ? '<span class="emd-tw"><button type="button" class="rs-btn" data-hd="test" aria-expanded="' + testOpen + '">Send a test…</button>' + (testOpen ? testPop() : "") + "</span>" : "")
        + (live && H.onLive ? '<button type="button" class="rs-btn pri" data-hd="live"' + (n && !actBusy ? "" : " disabled") + ">"
          + (actBusy === "live" ? "Making it live…" : "Make changes live") + "</button>" : "");
      const meta = [H.meta, saveText].filter(Boolean).map(esc).join(" · ");
      return '<div class="emd-head-l"><div class="emd-head-t">' + (H.title ? "<h2>" + esc(H.title) + "</h2>" : "") + pills + "</div>"
        + (meta ? '<div class="emd-head-m" id="emdMeta">' + meta + "</div>" : "")
        + (live && !n ? '<div class="emd-head-m">Everything here is live. Changes you make wait until you press Make changes live.</div>' : "")
        + (headMsg ? '<div class="emd-head-msg ' + (headBad ? "bad" : "ok") + '" role="status">' + esc(headMsg) + "</div>" : "")
        + '</div><div class="emd-head-a">' + acts + "</div>";
    }
    function testPop() {
      return '<div class="emd-pop" role="dialog" aria-label="Send a test"><label class="l" for="emdTo">Send a test of ' + (o.live && changes() ? "these changes" : "this email") + " to</label>"
        + '<div class="emd-pop-r"><input id="emdTo" value="' + esc(U.testTo || "") + '"><button type="button" class="rs-btn pri" data-hd="sendtest"' + (testBusy ? " disabled" : "") + ">"
        + (testBusy ? "Sending…" : "Send") + "</button></div>"
        + '<p class="emd-help">' + esc(H.testNote || "It goes only to you or a company inbox, and never counts in the results.") + "</p>"
        + (testMsg ? '<p class="emd-help ' + (testBad ? "bad" : "ok") + '" role="status">' + esc(testMsg) + "</p>" : "") + "</div>";
    }
    const tseg = (key, cur, opts, label) => '<div class="emd-seg" role="group" aria-label="' + label + '">' + opts.map(([v, l]) =>
      '<button type="button" data-tl="' + key + ":" + v + '" class="' + (cur === v ? "on" : "") + '" aria-pressed="' + (cur === v) + '">' + l + "</button>").join("") + "</div>";
    function toolsHtml() {
      return (isHtml() ? tseg("view", U.view, [["design", "Design"], ["code", "HTML code"]], "View") : "")
        + tseg("pv", U.pv, [["desk", "Desktop"], ["mob", "Phone"]], "Preview size")
        + '<button type="button" class="emd-tog' + (U.picsOff ? " on" : "") + '" data-tl="pics:x" aria-pressed="' + !!U.picsOff + '">Pictures off</button>'
        + '<span class="emd-sp"></span>'
        + (o.pictures ? '<button type="button" class="rs-btn emd-ico" data-pics="1">' + PIC_ICON + "Pictures" + (picCount != null ? " (" + picCount + ")" : "") + "</button>" : "");
    }
    function partsHtml() {
      const P = parts();
      let h = '<h3 class="emd-cap">Parts, top to bottom</h3>';
      if (!P.length) h += '<p class="emd-help">' + (isHtml() ? "We can't tell this email's parts apart. Change it in HTML code." : "No parts yet.") + "</p>";
      h += P.map(p => '<button type="button" class="emd-part' + (U.sel === p.key ? " on" : "") + '" data-sel="' + p.key + '"' + (U.sel === p.key ? ' aria-current="true"' : "") + ">"
        + thumbOf(p) + '<span class="tx"><b>' + esc(p.name) + "</b><small>" + esc(p.sum || "") + "</small></span></button>").join("");
      if (U.adding) {
        const opts = isHtml() ? [["picture", "Picture", "From Pictures, or cut a new one"], ["text", "Text", "A paragraph"], ["button", "Button", "A link people press"], ["space", "Space", "Room between two parts"]]
          : Object.keys(NAMES).map(k => [k, NAMES[k], HINTS[k]]);
        h += '<div class="emd-add">' + opts.map(([k, n, hint]) => '<button type="button" data-add="' + k + '"><b>' + esc(n) + "</b><span>" + esc(hint) + "</span></button>").join("")
          + '<button type="button" data-addcancel="1"><b>Cancel</b></button></div>';
      } else h += '<button type="button" class="emd-addp" data-addopen="1">+ Add a part</button>';
      h += '<p class="emd-help" style="margin:10px 4px 0">Click a part here or in the email to change it. ' + (P.length && U.sel ? "New parts go in under the chosen one." : "") + "</p>";
      return h;
    }
    function inboxLine() {
      return "<b>Inbox:</b><span>Zip To Zip Moving</span><span class=\"s\">" + esc(U.pvSubject || fillSample(T.subject) || "(no subject yet)") + "</span>"
        + (T.preheader ? '<span class="p">' + esc(fillSample(T.preheader)) + "</span>" : "");
    }
    function hasSurveyLink() {
      if (isHtml()) return /\{survey_link\}/.test(T.html || "");
      return T.blocks.some(b => (b.t === "button" && b.url === surveyLink) || (b.t === "image" && b.href === surveyLink));
    }
    function checksHtml() {
      const it = [];
      if (U.pvHtml) {
        const kb = Math.round(new Blob([U.pvHtml]).size / 102.4) / 10;
        it.push(kb > 100 ? ["bad", kb + " KB: over 100 KB, Gmail cuts it off"] : kb > 90 ? ["warn", kb + " KB of 100 KB: close to Gmail's limit"] : ["ok", kb + " KB of 100 KB"]);
      }
      if (missingAlt != null) it.push(missingAlt ? ["warn", missingAlt + (missingAlt === 1 ? " big picture has" : " big pictures have") + " no description"] : ["ok", "Every picture has a description"]);
      if (o.survey) it.push(hasSurveyLink() ? ["ok", "A button opens the customer's own survey"] : ["bad", "No button opens the survey yet"]);
      problems.filter(p => !(o.survey && /opens the survey|survey yet/i.test(p))).forEach(p => it.push(["bad", p]));
      const ts = H && H.tested ? H.tested(changes()) : null;
      if (ts) it.push(ts);
      return it.map(([l, t]) => '<span class="emd-ck ' + l + '"><span aria-hidden="true">' + ({ ok: "✓", bad: "✕", warn: "!", info: "•" }[l] || "•") + "</span>" + esc(t) + "</span>").join("");
    }

    // settings: the chosen part, the inbox, the whole email
    const swatches = (key, cur, allowed) => '<div class="emd-sw" role="radiogroup">' + allowed.map(c =>
      '<button type="button" data-sw="' + key + ":" + c + '" class="' + (cur === c ? "on" : "") + '" style="background:' + colors[c]
      + '" aria-label="' + esc(COLOR_NAMES[c] || c) + '" aria-pressed="' + (cur === c) + '" title="' + esc(COLOR_NAMES[c] || c) + '"></button>').join("") + "</div>";
    const seg = (key, cur, opts) => '<div class="emd-seg" role="group">' + opts.map(([v, l]) =>
      '<button type="button" data-seg="' + key + ":" + v + '" class="' + (cur === v ? "on" : "") + '" aria-pressed="' + (cur === v) + '">' + esc(l) + "</button>").join("") + "</div>";
    let fid = 0;
    const field = (label, key, val, ph, max) => { const id = "emdF" + (++fid); return '<label class="l" for="' + id + '">' + esc(label) + '</label><input id="' + id + '" data-f="' + key + '" maxlength="' + (max || 200)
      + '" value="' + esc(val) + '" placeholder="' + esc(ph || "") + '">'; };
    const check = (label, key, on) => '<label class="emd-chk"><input type="checkbox" data-c="' + key + '"' + (on ? " checked" : "") + ">" + esc(label) + "</label>";
    const uploadBtn = (key, label) => '<button type="button" class="rs-btn" data-up="' + key + '">' + esc(label) + '</button><input type="file" accept="image/png,image/jpeg,image/gif" data-file="' + key + '" hidden>'
      + (o.pictures ? '<button type="button" class="rs-btn" data-pick="' + key + '">Choose from Pictures</button>' : "");

    function blockFields(b, i) {
      const k = "b" + i + ".";
      if (b.t === "logo") return '<label class="l">Background</label>' + swatches(k + "bg", b.bg || "light", ["light", "white"])
        + '<label class="l">Line under it</label>' + seg(k + "rule", b.rule || "black", [["black", "Black"], ["green", "Green"], ["none", "None"]]);
      if (b.t === "banner") {
        const lines = b.lines && b.lines.length ? b.lines : (b.lines = [{ text: "", color: "black" }]);
        let h = '<label class="l">Background</label>' + swatches(k + "bg", b.bg || "green", ["green", "black", "white", "light"])
          + field("Tag above the headline (optional)", k + "tag", b.tag, "Customer survey", 40)
          + '<label class="l">Headline</label>' + seg(k + "mode", b.mode || "text", [["text", "Text"], ["image", "Picture"]]);
        if ((b.mode || "text") === "text") {
          h += lines.map((ln, j) => '<div class="emd-ln"><input data-f="' + k + "lines." + j + '.text" maxlength="40" value="' + esc(ln.text)
            + '" aria-label="Headline line ' + (j + 1) + '" placeholder="Line ' + (j + 1) + '">'
            + swatches(k + "lines." + j + ".color", ln.color || "black", ["black", "white", "green"]) + "</div>").join("")
            + '<div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">'
            + (lines.length < 4 ? '<button type="button" class="rs-btn" data-act="line+:' + i + '">+ Line</button>' : "")
            + (lines.length > 1 ? '<button type="button" class="rs-btn" data-act="line-:' + i + '">Remove last line</button>' : "") + "</div>"
            + '<div class="emd-two"><div><label class="l">Font</label><select data-f="' + k + 'font" aria-label="Font">' + Object.keys(fonts).map(f =>
              '<option value="' + f + '"' + ((b.font || "archivo") === f ? " selected" : "") + ">" + esc(fonts[f]) + "</option>").join("") + "</select></div>"
            + '<div><label class="l">Size</label>' + seg(k + "size", b.size || "l", [["m", "M"], ["l", "L"], ["xl", "XL"]]) + "</div></div>"
            + '<p class="emd-help">iPhone and Apple Mail show this font. Gmail and Outlook show Arial Black instead. For an exact look, use a picture cut from the design.</p>';
        } else {
          h += '<div class="emd-thumb">' + (b.image ? '<img src="' + esc(b.image) + '" alt="">' : "") + uploadBtn(k + "image", b.image ? "Replace picture" : "Upload picture") + "</div>"
            + field("What the picture says (shown when pictures are off)", k + "alt", b.alt, "How did your move go?", 160);
        }
        h += field("Line under the headline (optional)", k + "sub", b.sub, "Tell us what went well…", 300)
          + '<div style="margin-top:8px">' + check("Show five stars (decoration)", k + "stars", !!b.stars) + "</div>"
          + '<label class="l">Sticker</label><select data-f="' + k + 'sticker" aria-label="Sticker"><option value="">None</option>'
          + Object.keys(stickers).map(s => '<option value="' + s + '"' + (b.sticker === s ? " selected" : "") + ">" + esc(stickers[s].label) + "</option>").join("")
          + (b.sticker && !stickers[b.sticker] ? '<option value="' + esc(b.sticker) + '" selected>Your picture</option>' : "") + "</select>"
          + '<div class="emd-thumb">' + uploadBtn(k + "sticker", "Upload your own sticker") + "</div>";
        return h;
      }
      if (b.t === "strip") return field("Words", k + "text", b.text, "First call • Packing • Move day", 120)
        + '<label class="l">Background</label>' + swatches(k + "bg", b.bg || "black", ["black", "green", "deep", "light"])
        + '<label class="l">Words colour</label>' + swatches(k + "color", b.color || "green", ["green", "white", "black"]);
      if (b.t === "heading") return field("Heading", k + "text", b.text, "How did your move go?", 160);
      if (b.t === "text") {
        const tx = String(b.text || "");
        const rows = Math.min(16, Math.max(4, tx.split(/\r?\n/).length + Math.ceil(tx.length / 40)));
        return '<label class="l" for="emdTx' + i + '">Text</label><textarea id="emdTx' + i + '" data-f="' + k + 'text" maxlength="3000" rows="' + rows + '">' + esc(tx) + "</textarea>"
          + '<p class="emd-help">An empty line starts a new paragraph.</p>';
      }
      if (b.t === "button") {
        const toSurvey = b.url === surveyLink;
        return field("Button text", k + "label", b.label, "Take the 2-minute survey", 60)
          + (o.survey ? '<label class="l">Opens</label>' + seg(k + "target", toSurvey ? "survey" : "url", [["survey", "Their own survey"], ["url", "A web address"]]) : "")
          + (toSurvey ? "" : field("Web address", k + "url", b.url, "https://…", 500))
          + '<label class="l">Shape</label>' + seg(k + "style", b.style || "rounded", [["rounded", "Rounded"], ["square", "Square"]])
          + '<label class="l">Position</label>' + seg(k + "align", b.align || "left", [["left", "Left"], ["center", "Centre"]])
          + '<label class="l">Colour</label>' + swatches(k + "color", b.color || "black", ["black", "green"])
          + '<div style="margin-top:8px">' + check("Capital letters", k + "caps", !!b.caps) + "</div>";
      }
      if (b.t === "image") return '<div class="emd-thumb">' + (b.url ? '<img src="' + esc(b.url) + '" alt="">' : "") + uploadBtn(k + "url", b.url ? "Replace picture" : "Upload picture") + "</div>"
        + field("What the picture says", k + "alt", b.alt, "Our crew on moving day", 120)
        + field("Opens when pressed (optional)", k + "href", b.href, "https://…", 500);
      if (b.t === "bar") return '<label class="l">Colour</label>' + swatches(k + "color", b.color || "green", ["green", "black", "deep"]);
      return '<p class="emd-help">A thin grey line between parts of the email.</p>';
    }
    function sigFields() {
      return field("Closing line", "sign_closing", T.sign_closing, "Thank you,", 60)
        + field("Name", "sign_name", T.sign_name, "Tako", 60) + field("Title", "sign_title", T.sign_title, "Customer Care", 120)
        + '<label class="l">Title colour</label>' + seg("sign_color", T.sign_color || "grey", [["grey", "Grey"], ["green", "Green"]])
        + '<p class="emd-help">The company address and the unsubscribe link go under it by themselves.</p>';
    }
    function linkField(p, row) {
      const href = attrOf(row, "a", "href"), has = /<a\b/i.test(row);
      if (o.survey) {
        const v = !has ? "none" : href === surveyLink ? "survey" : "url";
        return '<label class="l" for="emdLnk">Opens when pressed</label><select id="emdLnk" data-hlnk="' + p.i + '">'
          + [["survey", "Their own survey"], ["url", "A web address…"]].concat(p.kind === "picture" ? [["none", "Nothing"]] : [])
            .map(([k, l]) => '<option value="' + k + '"' + (v === k ? " selected" : "") + ">" + l + "</option>").join("") + "</select>"
          + (v === "url" ? '<label class="l" for="emdHref">Web address</label><input id="emdHref" data-hhref="' + p.i + '" value="' + esc(href) + '" placeholder="https://…">' : "");
      }
      if (!has && p.kind !== "picture") return "";
      return '<label class="l" for="emdHref">Opens when pressed' + (p.kind === "picture" ? " (optional)" : "") + '</label><input id="emdHref" data-hhref="' + p.i + '" value="' + esc(href) + '" placeholder="https://…">';
    }
    function htmlPartFields(p) {
      const row = T.html.slice(p.s, p.e);
      let h = "";
      if (p.kind === "picture") {
        const ours = /\/api\/_emlimg\?i=/.test(p.src || "");
        h += '<div class="emd-big"><img src="' + esc(p.src) + '" alt=""></div>'
          + (o.pictures ? '<div class="emd-acts"><button type="button" class="rs-btn" data-hpick="' + p.i + '">Choose another…</button>'
            + (ours ? '<button type="button" class="rs-btn" data-hcut="' + p.i + '">Crop again…</button>' : "") + "</div>" : "")
          + '<label class="l" for="emdAlt">What the picture says (for blocked pictures and screen readers)</label><textarea id="emdAlt" rows="3" data-halt="' + p.i + '">'
          + esc(attrOf(row, "img", "alt")) + "</textarea>" + linkField(p, row);
      } else if (p.kind === "button") {
        const w = linkWords(row);
        h += (w != null ? '<label class="l" for="emdBtx">Button text</label><input id="emdBtx" data-hbtx="' + p.i + '" value="' + esc(decode(w)) + '">' : "") + linkField(p, row);
      }
      const open = p.kind !== "picture" && p.kind !== "button";
      h += '<details class="emd-det"' + (open ? " open" : "") + '><summary>This part\'s HTML</summary><textarea class="emd-code" aria-label="This part\'s HTML" data-hrow="' + p.i
        + '" spellcheck="false" rows="' + (open ? 12 : 7) + '">' + esc(row) + '</textarea><p class="emd-help">The email shows your change as you type.</p></details>';
      return h;
    }
    function sideHtml() {
      const P = parts(), p = P.find(x => x.key === U.sel);
      const code = U.view === "code";
      if (code && U.tab === "part") U.tab = "inbox";
      const tabs = (code ? [] : [["part", p ? p.name : "Part"]]).concat([["inbox", "Inbox"], ["email", "Whole email"]]);
      let h = '<div class="emd-tabs" role="tablist" aria-label="Settings">' + tabs.map(([k, l]) => '<button type="button" role="tab" data-tab2="' + k + '" aria-selected="' + (U.tab === k)
        + '" class="' + (U.tab === k ? "on" : "") + '">' + esc(l) + "</button>").join("") + "</div>";
      if (U.tab === "inbox") return h + inboxHtml();
      if (U.tab === "email") return h + wholeHtml();
      if (!p) return h + '<p class="emd-help" style="margin-top:12px">Click a part in the list or in the email to change it.</p>';
      const idx = P.indexOf(p);
      const movable = p.key !== "sig";
      const prev = P[idx - 1], next = P[idx + 1];
      const canUp = movable && prev && prev.key !== "sig", canDown = movable && next && next.key !== "sig";
      h += '<div class="emd-ptools"><span class="nm">' + esc(p.name) + "</span>"
        + (movable ? '<button type="button" class="emd-ib" data-mv="-1"' + (canUp ? "" : " disabled") + ' aria-label="Move ' + esc(p.name) + ' up">&uarr;</button>'
          + '<button type="button" class="emd-ib" data-mv="1"' + (canDown ? "" : " disabled") + ' aria-label="Move ' + esc(p.name) + ' down">&darr;</button>'
          + '<button type="button" class="emd-ib" data-del="1" aria-label="Remove ' + esc(p.name) + '">&times;</button>' : "") + "</div>";
      return h + (p.key === "sig" ? sigFields() : p.b ? blockFields(p.b, p.i) : htmlPartFields(p));
    }
    function inboxHtml() {
      return (o.senders ? '<label class="l" for="emdFrom">From</label><select id="emdFrom">' + o.senders.map(x => '<option value="' + x + '"' + (o.sender === x ? " selected" : "")
          + ">Zip To Zip Moving &lt;" + x + "@mail.ziptozip.app&gt;</option>").join("") + "</select>" : "")
        + field("Subject", "subject", T.subject, "How did your move go, {first}?", 160)
        + field("Preview line (shown after the subject in the inbox)", "preheader", T.preheader, "It takes about 2 minutes.", 160)
        + '<p class="emd-help">Personal touches: {first} is the customer\'s first name, {move_date} their move day, {foreman} their foreman, {state} the state.</p>';
    }
    function wholeHtml() {
      const html = isHtml();
      let h = '<p class="emd-h">How it\'s built</p>' + seg("mode", html ? "html" : "blocks", [["blocks", "With blocks"], ["html", "Pasted HTML"]])
        + '<p class="emd-help">' + (html ? "A finished email pasted in, for example one Claude wrote. Both versions are kept, so you can switch back."
          : "Built from blocks: banner, text, buttons, pictures.") + "</p>";
      if (html) h += '<p class="emd-h">Set up a design from Claude</p><button type="button" class="rs-btn" data-copyrules="1">Copy instructions for Claude</button>'
        + '<span class="emd-help" id="emdCopied" role="status" style="display:block"></span>'
        + '<p class="emd-help">Paste the instructions into Claude with a description of the email, then paste the HTML Claude writes into HTML code.</p>';
      if (!html && o.designs && kit.designs) h += '<p class="emd-h">Start from a design</p><div class="emd-designs">' + Object.keys(kit.designs).map(k => '<button type="button" data-design="' + k + '"><b>'
        + esc(kit.designs[k].label) + "</b><span>" + esc(kit.designs[k].hint) + "</span></button>").join("") + '</div><p class="emd-help">Replaces the email you have now.</p>';
      return h + '<p class="emd-h">Added for you</p><p class="emd-help">The company address and the unsubscribe link at the bottom, and tracking on every link'
        + (o.survey ? ". {survey_link} becomes each customer's own survey link." : ".") + "</p>";
    }
    function codeHtml() {
      const kb = Math.round(new Blob([T.html || ""]).size / 100) / 10;
      return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
        + (o.pictures ? '<button type="button" class="rs-btn pri" data-insertpic="1">Insert picture at the cursor</button>' : "")
        + '<button type="button" class="rs-btn" data-copyrules="1">Copy instructions for Claude</button>'
        + '<span class="emd-help" style="margin:6px 0 0" id="emdCopied" role="status"></span></div>'
        + '<label class="l" for="emdHtml" style="margin-top:0">The email\'s HTML</label><textarea id="emdHtml" class="emd-code" data-f="html" spellcheck="false" maxlength="150000" placeholder="&lt;table&gt;…&lt;/table&gt;">'
        + esc(T.html || "") + "</textarea>"
        + '<div class="emd-meter' + (kb > 100 ? " bad" : "") + '" id="emdSize">' + kb + " KB of about 100 KB" + (kb > 100 ? ": too big, Gmail would cut it off" : "") + "</div>";
    }

    function draw() {
      const code = U.view === "code";
      el.innerHTML = '<div class="emd3w">' + (H ? '<header class="emd-head" id="emdHead">' + headHtml() + "</header>" : "")
        + '<div class="emd-tools" role="toolbar" aria-label="Editor tools" id="emdTools">' + toolsHtml() + "</div>"
        + '<div class="emd3' + (code ? " code" : "") + '">'
        + (code ? '<section class="emd-codecol" aria-label="The email\'s HTML" id="emdCode">' + codeHtml() + "</section>"
          : '<section class="emd-parts" aria-label="Parts of the email" id="emdParts">' + partsHtml() + "</section>")
        + '<section class="emd-mid" aria-label="The email"><div class="emd-inbox" id="emdInbox">' + inboxLine() + "</div>"
        + '<div class="emd-pv' + (U.pv === "mob" ? " mob" : "") + '"><iframe title="The email, as a customer sees it" sandbox="allow-same-origin"></iframe></div>'
        + '<div class="emd-checks" id="emdChecks" role="status">' + checksHtml() + "</div>"
        + '<p class="emd-sample">The email shows a sample customer, Jordan, who moved on October 24.</p></section>'
        + '<aside class="emd-side" aria-label="Settings" id="emdSide">' + sideHtml() + "</aside></div></div>";
      wire(el);
      const f = frame();
      if (f) { f.onload = () => decorate(f); if (U.pvHtml) f.srcdoc = U.pvHtml; }
    }
    const frame = () => el.querySelector(".emd-pv iframe");
    const paint = (id, fn) => { const n = el.querySelector("#" + id); if (n) { n.innerHTML = fn(); wire(n); } };
    const paintHead = () => { if (H) paint("emdHead", headHtml); };
    const paintParts = () => paint("emdParts", partsHtml);
    const paintSide = () => paint("emdSide", sideHtml);
    const paintChecks = () => { const n = el.querySelector("#emdChecks"); if (n) n.innerHTML = checksHtml(); };
    const paintInbox = () => { const n = el.querySelector("#emdInbox"); if (n) n.innerHTML = inboxLine(); };

    // ---- the preview: click a part in it, pictures off, its own height ----------------------------
    function decorate(f) {
      let doc = null;
      try { doc = f.contentDocument; } catch (e) { doc = null; }
      if (!doc || !doc.body) return;
      const st = doc.createElement("style");
      st.textContent = "[data-emd-k]{cursor:pointer}[data-emd-k]:hover{outline:2px dashed #0369a1;outline-offset:-2px}"
        + "[data-emd-k].emd-on{outline:3px solid #0369a1;outline-offset:-3px}"
        + ".emd-alt{display:flex;align-items:center;justify-content:center;box-sizing:border-box;border:1px dashed #94a3b8;background:#f8fafc;color:#475569;"
        + "font:13px/1.4 Arial,sans-serif;padding:8px;text-align:center;margin:0 auto}html,body{overflow:hidden}";
      (doc.head || doc.body).appendChild(st);
      if (isHtml()) {
        const P = rowRanges(T.html || "");
        let best = null;
        [...doc.querySelectorAll("table")].forEach(t => { if (!best || t.rows.length > best.rows.length) best = t; });
        frameOk = !!best && P.length >= 2 && best.rows.length === P.length;
        if (frameOk) [...best.rows].forEach((tr, i) => tr.setAttribute("data-emd-k", "h" + i));
      } else {
        doc.querySelectorAll("[data-emd]").forEach(n => n.setAttribute("data-emd-k", n.getAttribute("data-emd")));
        frameOk = true;
      }
      doc.addEventListener("click", ev => {
        const t = ev.target;
        if (t && t.closest && t.closest("a")) ev.preventDefault();          // links don't leave the preview
        const n = t && t.closest && t.closest("[data-emd-k]");
        if (n && U.view !== "code") select(n.getAttribute("data-emd-k"), "frame");
      }, true);
      const imgs = [...doc.images];
      missingAlt = imgs.filter(im => (+im.getAttribute("width") || im.naturalWidth || 0) > 200 && !(im.getAttribute("alt") || "").trim()).length;
      if (U.picsOff) imgs.forEach(im => {
        if ((+im.getAttribute("width") || im.width || 0) <= 2) return;
        const w = Math.min(+im.getAttribute("width") || im.width || 200, im.width || 9999);
        const h = im.naturalWidth ? Math.round(w * im.naturalHeight / im.naturalWidth) : 60;
        const box = doc.createElement("div");
        box.className = "emd-alt"; box.textContent = im.getAttribute("alt") || "";
        box.style.width = w + "px"; box.style.minHeight = Math.max(28, Math.min(h, 400)) + "px";
        im.replaceWith(box);
      });
      markSel(doc);
      const fit = () => { try { f.style.height = Math.max(420, doc.documentElement.scrollHeight) + "px"; } catch (e) { /* gone */ } };
      fit(); setTimeout(fit, 250);
      imgs.forEach(im => { if (!im.complete) im.addEventListener("load", fit); });
      paintChecks();
    }
    function markSel(doc) {
      if (!doc) return;
      doc.querySelectorAll(".emd-on").forEach(n => n.classList.remove("emd-on"));
      if (U.sel) { const n = doc.querySelector('[data-emd-k="' + U.sel + '"]'); if (n) n.classList.add("emd-on"); }
    }
    function select(key, from) {
      U.sel = key; U.tab = "part"; U.adding = false;
      paintParts(); paintSide();
      const f = frame();
      let doc = null;
      try { doc = f && f.contentDocument; } catch (e) { doc = null; }
      markSel(doc);
      if (from === "frame") { const b = el.querySelector('[data-sel="' + key + '"]'); if (b && b.scrollIntoView) b.scrollIntoView({ block: "nearest" }); }
      else if (doc) {
        const n = doc.querySelector('[data-emd-k="' + key + '"]');
        if (n) { const r = n.getBoundingClientRect(), fr = f.getBoundingClientRect(), y = fr.top + r.top;
          if (y < 60 || y > window.innerHeight - 80) n.scrollIntoView({ block: "center", behavior: "smooth" }); }
      }
    }

    // ---- changes --------------------------------------------------------------------------------
    // structural: the parts list and the settings repaint (a new part, a colour, a move); typing doesn't
    function changed(structural) {
      if (o.onChange) o.onChange();
      headMsg = "";                     // "Live." / "Discarded." was about the last press, not this edit
      if (structural) { paintParts(); paintSide(); }
      else { paintPartsSoft(); }
      paintHead(); schedulePreview();
    }
    // typing: only the list's one-line summaries change, without moving the focus
    function paintPartsSoft() {
      const P = parts(), list = el.querySelector("#emdParts");
      if (!list) return;
      const btns = list.querySelectorAll("[data-sel]");
      if (btns.length !== P.length) { paintParts(); return; }
      P.forEach((p, i) => { const sm = btns[i].querySelector("small"); if (sm) sm.textContent = p.sum || ""; });
    }
    function schedulePreview() {
      clearTimeout(pvT);
      pvT = setTimeout(() => {
        if (!o.preview) return;
        o.preview(T).then(j => {
          U.pvHtml = j.html || ""; U.pvSubject = j.subject || ""; problems = j.problems || [];
          const f = frame(); if (f) f.srcdoc = U.pvHtml;
          paintInbox(); paintChecks();
        }).catch(() => {});
      }, 350);
    }
    function setHtml(src) {
      const before = rowRanges(T.html || "").length;
      T.html = src;
      const ta = el.querySelector("#emdHtml"); if (ta && ta.value !== src) ta.value = src;
      const after = rowRanges(src).length;
      return before !== after;
    }
    function htmlPart(i) { const r = rowRanges(T.html || "")[i]; return r ? { s: r[0], e: r[1], row: T.html.slice(r[0], r[1]) } : null; }
    function setRow(i, row) { const r = htmlPart(i); if (!r) return false; return setHtml(T.html.slice(0, r.s) + row + T.html.slice(r.e)); }
    function insertRow(after, row) {
      const R = rowRanges(T.html || "");
      const at = after >= 0 && R[after] ? R[after][1] : R.length ? R[R.length - 1][1] : (T.html || "").length;
      setHtml(T.html.slice(0, at) + "\n" + row + T.html.slice(at));
      return after >= 0 && R[after] ? after + 1 : R.length;
    }
    // a path like "b2.lines.0.text" or "subject" -> [object, key]
    function at(path) {
      const ps = path.split(".");
      let obj = T, i = 0;
      if (/^b\d+$/.test(ps[0])) { obj = T.blocks[+ps[0].slice(1)]; i = 1; }
      for (; i < ps.length - 1; i++) obj = obj[/^\d+$/.test(ps[i]) ? +ps[i] : ps[i]];
      return [obj, ps[ps.length - 1]];
    }
    function newBlock(t) {
      return t === "banner" ? { t, bg: "green", tag: "", mode: "text", font: "archivo", size: "l", lines: [{ text: "Your headline", color: "black" }], sub: "", stars: false, sticker: "" }
        : t === "strip" ? { t, text: "", bg: "black", color: "green" } : t === "button" ? { t, label: "Open", url: o.survey ? surveyLink : "", style: "square", align: "center", caps: true, color: "black" }
        : t === "image" ? { t, url: "", alt: "", href: "" } : t === "logo" ? { t, bg: "light", rule: "black" } : t === "bar" ? { t, color: "green" }
        : t === "divider" ? { t } : { t, text: "" };
    }

    // ---- wiring (any painted piece wires its own buttons) ----------------------------------------
    function wire(root) {
      const $ = s => root.querySelector(s), $$ = s => root.querySelectorAll(s);
      // header
      $$("[data-hd]").forEach(b => { b.onclick = () => {
        const k = b.dataset.hd;
        if (k === "test") { testOpen = !testOpen; testMsg = ""; paintHead(); const i = el.querySelector("#emdTo"); if (i) i.focus(); return; }
        if (k === "sendtest") {
          const i = el.querySelector("#emdTo"); U.testTo = i ? i.value.trim() : U.testTo;
          testBusy = true; testMsg = ""; paintHead();
          H.onTest(U.testTo).then(m => { testBusy = false; testBad = false; testMsg = m || "Sent."; paintHead(); paintChecks(); })
            .catch(e => { testBusy = false; testBad = true; testMsg = e.message || String(e); paintHead(); });
          return;
        }
        if (k === "discard") {
          if (!confirm("Discard your changes? The email goes back to the live version.")) return;
          actBusy = "discard"; paintHead();
          Promise.resolve(H.onDiscard()).catch(e => { actBusy = ""; headBad = true; headMsg = e.message || String(e); paintHead(); });
          return;
        }
        if (k === "live") {
          if (!confirm("Make these changes live? From now on every email that goes out uses this version.")) return;
          actBusy = "live"; headMsg = ""; paintHead();
          Promise.resolve(H.onLive()).catch(e => { actBusy = ""; headBad = true; headMsg = (e.blockers || [e.message || String(e)]).join(" "); paintHead(); });
        }
      }; });
      const to = $("#emdTo"); if (to) { to.oninput = () => { U.testTo = to.value; }; to.onkeydown = e => { if (e.key === "Enter") { const s = el.querySelector('[data-hd="sendtest"]'); if (s) s.click(); } }; }
      // tools
      $$("[data-tl]").forEach(b => { b.onclick = () => {
        const [k, v] = b.dataset.tl.split(":");
        if (k === "view") { U.view = v; if (v === "code" && U.tab === "part") U.tab = "inbox"; if (v === "design") U.tab = U.sel ? "part" : U.tab; draw(); return; }
        if (k === "pv") { U.pv = v; const w = el.querySelector(".emd-pv"); if (w) w.className = "emd-pv" + (v === "mob" ? " mob" : ""); paint("emdTools", toolsHtml); const f = frame(); if (f && U.pvHtml) f.srcdoc = U.pvHtml; return; }
        if (k === "pics") { U.picsOff = !U.picsOff; paint("emdTools", toolsHtml); const f = frame(); if (f && U.pvHtml) f.srcdoc = U.pvHtml; }
      }; });
      $$("[data-pics]").forEach(b => { b.onclick = () => openPictures(o.pictures, { mode: "manage" }); });
      // parts
      $$("[data-sel]").forEach(b => { b.onclick = () => select(b.dataset.sel, "list"); });
      $$("[data-addopen]").forEach(b => { b.onclick = () => { U.adding = true; paintParts(); const f = el.querySelector("[data-add]"); if (f) f.focus(); }; });
      $$("[data-addcancel]").forEach(b => { b.onclick = () => { U.adding = false; paintParts(); }; });
      $$("[data-add]").forEach(b => { b.onclick = () => {
        const t = b.dataset.add;
        const P = parts(), cur = P.find(p => p.key === U.sel);
        if (isHtml()) {
          const after = cur ? cur.i : -1;
          if (t === "picture") {
            openPictures(o.pictures, { mode: "insert", onPick: (url, a, html) => {
              const ni = insertRow(after, '<tr><td style="padding:0;">' + html + "</td></tr>");
              U.adding = false; U.sel = "h" + ni; U.tab = "part"; changed(true);
            } });
            return;
          }
          const ni = insertRow(after, NEW_ROWS[t]);
          U.adding = false; U.sel = "h" + ni; U.tab = "part"; changed(true);
          return;
        }
        if (T.blocks.length >= 20) { alert("An email can have up to 20 blocks."); return; }
        let at2;
        if (t === "logo") at2 = 0;
        else if (cur && cur.b && t !== "bar") at2 = cur.i + 1;
        else { at2 = T.blocks.length; if (t !== "bar") while (at2 > 0 && T.blocks[at2 - 1].t === "bar") at2--; }
        T.blocks.splice(at2, 0, newBlock(t));
        U.adding = false; U.sel = "b" + at2; U.tab = "part"; changed(true);
      }; });
      // settings tabs + the part's own tools
      $$("[data-tab2]").forEach(b => { b.onclick = () => { U.tab = b.dataset.tab2; paintSide(); const n = el.querySelector('[data-tab2="' + U.tab + '"]'); if (n) n.focus(); }; });
      $$("[data-mv]").forEach(b => { b.onclick = () => {
        const d = +b.dataset.mv, P = parts(), p = P.find(x => x.key === U.sel);
        if (!p) return;
        if (p.b) {
          const j = p.i + d; if (j < 0 || j >= T.blocks.length) return;
          const x = T.blocks[p.i]; T.blocks[p.i] = T.blocks[j]; T.blocks[j] = x; U.sel = "b" + j;
        } else {
          const R = rowRanges(T.html), j = p.i + d; if (j < 0 || j >= R.length) return;
          const a = R[Math.min(p.i, j)], c = R[Math.max(p.i, j)], s = T.html;
          setHtml(s.slice(0, a[0]) + s.slice(c[0], c[1]) + s.slice(a[1], c[0]) + s.slice(a[0], a[1]) + s.slice(c[1]));
          U.sel = "h" + j;
        }
        changed(true);
        const again = el.querySelector('[data-mv="' + d + '"]'); if (again && !again.disabled) again.focus();
      }; });
      $$("[data-del]").forEach(b => { b.onclick = () => {
        const P = parts(), p = P.find(x => x.key === U.sel);
        if (!p || !confirm("Remove this " + p.name.toLowerCase() + " from the email?")) return;
        if (p.b) T.blocks.splice(p.i, 1);
        else { const r = htmlPart(p.i); setHtml(T.html.slice(0, r.s) + T.html.slice(r.e)); }
        U.sel = null; changed(true);
      }; });
      // block and inbox fields
      $$("[data-f]").forEach(inp => {
        const ev = inp.tagName === "SELECT" ? "onchange" : "oninput";
        inp[ev] = () => {
          const [obj, key] = at(inp.dataset.f);
          if (inp.dataset.f === "html") {
            const moved = setHtml(inp.value);
            const kb = Math.round(new Blob([inp.value]).size / 100) / 10, m = el.querySelector("#emdSize");
            if (m) { m.textContent = kb + " KB of about 100 KB" + (kb > 100 ? ": too big, Gmail would cut it off" : ""); m.className = "emd-meter" + (kb > 100 ? " bad" : ""); }
            if (moved) U.sel = null;
            changed(false); return;
          }
          obj[key] = inp.value; changed(false);
          if (key === "subject" || key === "preheader") paintInbox();
        };
      });
      $$("[data-c]").forEach(inp => { inp.onchange = () => { const [obj, key] = at(inp.dataset.c); obj[key] = inp.checked; changed(false); }; });
      $$("[data-sw]").forEach(b => { b.onclick = () => { const i = b.dataset.sw.lastIndexOf(":"); const [obj, key] = at(b.dataset.sw.slice(0, i)); obj[key] = b.dataset.sw.slice(i + 1); changed(true); }; });
      $$("[data-seg]").forEach(b => { b.onclick = () => {
        const i = b.dataset.seg.lastIndexOf(":"), path = b.dataset.seg.slice(0, i), v = b.dataset.seg.slice(i + 1);
        if (path === "mode") {
          T.mode = v === "html" ? "html" : "blocks"; if (T.html == null) T.html = "";
          U.sel = null; U.view = "design"; if (o.onChange) o.onChange(); draw(); schedulePreview(); return;
        }
        const [obj, key] = at(path);
        if (key === "target") obj.url = v === "survey" ? surveyLink : ""; else obj[key] = v;
        changed(true);
      }; });
      $$("[data-act]").forEach(b => { b.onclick = () => { const [what, i] = b.dataset.act.split(":"); const bl = T.blocks[+i];
        if (what === "line+") bl.lines.push({ text: "", color: "black" }); else bl.lines.pop(); changed(true); }; });
      $$("[data-design]").forEach(b => { b.onclick = () => {
        if (!confirm("Start from \"" + kit.designs[b.dataset.design].label + "\"? This replaces the email you have now.")) return;
        const d = JSON.parse(JSON.stringify(kit.designs[b.dataset.design].template));
        Object.keys(T).forEach(k => delete T[k]); Object.assign(T, d); if (!Array.isArray(T.blocks)) T.blocks = [];
        U.sel = null; if (o.onChange) o.onChange(); draw(); schedulePreview();
      }; });
      const from = $("#emdFrom"); if (from) from.onchange = () => { if (o.onSender) o.onSender(from.value); o.sender = from.value; changed(false); };
      $$("[data-copyrules]").forEach(b => { b.onclick = () => {
        const txt = claudeRules(!!o.survey), note = el.querySelector("#emdCopied");
        const done = ok => { if (note) note.textContent = ok ? "Copied. Paste it into Claude and describe the email." : "Copy didn't work here."; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => done(true), () => done(false)); else done(false);
      }; });
      // the pasted email's parts
      $$("[data-halt]").forEach(t => { t.oninput = () => { const r = htmlPart(+t.dataset.halt); if (!r) return; setRow(+t.dataset.halt, setAttr(r.row, "img", "alt", t.value)); changed(false); }; });
      $$("[data-hhref]").forEach(t => { t.oninput = () => {
        const i = +t.dataset.hhref, r = htmlPart(i); if (!r) return;
        const v = t.value.trim();
        if (/<a\b/i.test(r.row)) setRow(i, setAttr(r.row, "a", "href", v));
        else if (v) setRow(i, r.row.replace(/<img\b[^>]*>/i, m => '<a href="' + escAttr(v) + '" target="_blank" style="text-decoration:none;">' + m + "</a>"));
        changed(false);
      }; });
      $$("[data-hlnk]").forEach(s => { s.onchange = () => {
        const i = +s.dataset.hlnk, r = htmlPart(i); if (!r) return;
        const has = /<a\b/i.test(r.row);
        if (s.value === "none") { if (has) setRow(i, r.row.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/i, "$1")); }
        else {
          const v = s.value === "survey" ? surveyLink : (attrOf(r.row, "a", "href") === surveyLink ? "https://" : attrOf(r.row, "a", "href") || "https://");
          if (has) setRow(i, setAttr(r.row, "a", "href", v));
          else setRow(i, r.row.replace(/<img\b[^>]*>/i, m => '<a href="' + escAttr(v) + '" target="_blank" style="text-decoration:none;">' + m + "</a>"));
        }
        changed(true);
      }; });
      $$("[data-hbtx]").forEach(t => { t.oninput = () => { const i = +t.dataset.hbtx, r = htmlPart(i); if (!r) return;
        setRow(i, setLinkWords(r.row, escText(t.value))); changed(false); }; });
      $$("[data-hrow]").forEach(t => { t.oninput = () => { const moved = setRow(+t.dataset.hrow, t.value); if (moved) { U.sel = null; changed(true); } else changed(false); }; });
      $$("[data-hpick]").forEach(b => { b.onclick = () => openPictures(o.pictures, { mode: "pick", onPick: url => {
        const i = +b.dataset.hpick, r = htmlPart(i); if (!r) return; setRow(i, setAttr(r.row, "img", "src", url)); changed(true); } }); });
      $$("[data-hcut]").forEach(b => { b.onclick = () => {
        const i = +b.dataset.hcut, r = htmlPart(i); if (!r) return;
        openPictures(o.pictures, { mode: "pick", cut: { url: attrOf(r.row, "img", "src"), name: attrOf(r.row, "img", "alt").slice(0, 60) || "picture" },
          onPick: url => { const r2 = htmlPart(i); if (!r2) return; setRow(i, setAttr(r2.row, "img", "src", url)); changed(true); } });
      }; });
      // block pictures
      $$("[data-pick]").forEach(b => { b.onclick = () => openPictures(o.pictures, { mode: "pick", onPick: url => { const [obj, key] = at(b.dataset.pick); obj[key] = url; changed(true); } }); });
      $$("[data-up]").forEach(b => { b.onclick = () => { const f = root.querySelector('[data-file="' + b.dataset.up + '"]'); if (f) f.click(); }; });
      $$("[data-file]").forEach(f => { f.onchange = () => {
        const file = f.files && f.files[0]; if (!file || !o.upload) return;
        if (file.size > 2 * 1024 * 1024) { alert("Pictures can be up to 2 MB. Make it smaller and try again."); return; }
        if (busyUp) return; busyUp = true;
        const b = root.querySelector('[data-up="' + f.dataset.file + '"]'); if (b) { b.disabled = true; b.textContent = "Uploading…"; }
        o.upload(file).then(url => { busyUp = false; const [obj, key] = at(f.dataset.file); obj[key] = url; changed(true); })
          .catch(e => { busyUp = false; alert(e.message || String(e)); paintSide(); });
      }; });
      // HTML code view: a picture at the cursor
      const ta = $("#emdHtml");
      if (ta) { const keep = () => { el._sel = [ta.selectionStart, ta.selectionEnd]; }; ta.addEventListener("blur", keep); ta.addEventListener("keyup", keep); ta.addEventListener("click", keep); }
      $$("[data-insertpic]").forEach(b => { b.onclick = () => {
        const len = (T.html || "").length, sel = el._sel || [len, len];
        openPictures(o.pictures, { mode: "insert", onPick: (url, a, html) => {
          const t = el.querySelector("#emdHtml"); if (!t) return;
          // between two table rows a bare picture is broken HTML: give it a row of its own
          const before = t.value.slice(0, sel[0]).trimEnd(), after = t.value.slice(sel[1]).trimStart();
          if (/<\/tr>$/i.test(before) && /^<(tr|\/table|\/tbody)\b/i.test(after)) html = '<tr><td style="padding:0;">' + html + "</td></tr>";
          t.focus(); t.setRangeText("\n" + html + "\n", sel[0], sel[1], "end");
          el._sel = [t.selectionStart, t.selectionEnd];
          t.dispatchEvent(new Event("input", { bubbles: true }));
        } });
      }; });
    }

    draw();
    schedulePreview();
    if (o.pictures && o.pictures.list) o.pictures.list().then(l => { picCount = l.length; paint("emdTools", toolsHtml); }).catch(() => {});
    return {
      refresh: () => { draw(); schedulePreview(); },
      template: () => T,
      changes,
      setSave: t => { saveText = t || ""; const m = el.querySelector("#emdMeta"); if (m) m.textContent = [H && H.meta, saveText].filter(Boolean).join(" · "); else paintHead(); },
      setHead: cfg => { Object.assign(H, cfg); actBusy = ""; paintHead(); paintChecks(); },
    };
  }


  /* ================================================================ PICTURES (11 Nov, ZTZ-69 step 2) =====
   * His ask: "i dont see from where user can include image here" and "it includes cropping image and using
   * it as part of the text". One library for every email: upload, paste (Ctrl+V), cut a part out of any
   * picture (a design, a screenshot), rename, delete what no email uses, and pick a picture for a block or
   * insert it into pasted HTML at the cursor. A cut is saved at up to 2x its size in the email (sharp on
   * phones), on a solid background (no see-through parts: dark mode can't spoil it).
   *
   *   openPictures(api, {mode, onPick})   mode "manage" | "pick" | "insert"
   *   api = picturesApi(get, post)         list / upload / rename / remove through /api/_emailadmin
   */
  function picturesApi(get, post) {
    return {
      list: () => get("/api/_emailadmin?view=assets").then(j => j.assets || []),
      upload: (name, data) => post({ action: "upload", name, data }),
      rename: (id, name) => post({ action: "asset_rename", id, name }),
      remove: id => post({ action: "asset_delete", id }),
    };
  }
  const EMAIL_W = 600;
  const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");
  const imgHtml = (url, w, alt, align, href) => {
    const img = '<img src="' + esc(url) + '" width="' + w + '" alt="' + esc(alt || "") + '" style="display:block;border:0;width:100%;max-width:'
      + w + "px;height:auto;" + (align === "center" ? "margin:0 auto;" : "") + '">';
    return href ? '<a href="' + esc(href) + '" target="_blank" style="text-decoration:none;">' + img + "</a>" : img;
  };

  function openPictures(api, cfg) {
    cfg = cfg || {};
    const mode = cfg.mode || "manage";
    const old = document.getElementById("emdPics"); if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "emdPics"; wrap.className = "emd-pics";
    document.body.appendChild(wrap);
    const back = document.activeElement;
    let list = null, err = "", sel = null, q = "", view = "grid", busy = false, msg = "";
    let crop = null;      // {img, name, mime, fromFile, file, r: {x,y,w,h} in source px, scale, emailW}
    let ins = null;       // the insert step: {a, w, alt, align, href}
    const dims = {};      // id -> [w, h] once a thumbnail has loaded

    const close = () => { document.removeEventListener("keydown", onKey, true); document.removeEventListener("paste", onPaste); wrap.remove(); if (back && back.focus) back.focus(); };
    const onKey = e => { if (e.key === "Escape") { e.stopPropagation(); if (view !== "grid") { view = "grid"; draw(); } else close(); } };
    const onPaste = e => {
      const it = [...((e.clipboardData && e.clipboardData.items) || [])].find(x => x.type && x.type.indexOf("image/") === 0);
      if (!it) return;
      e.preventDefault();
      const f = it.getAsFile(); if (f) startCropFile(f, "pasted picture");
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("paste", onPaste);

    function load(pickId) {
      api.list().then(l => { list = l; err = ""; if (pickId) sel = l.find(a => a.id === pickId) || sel; draw(); })
        .catch(e => { err = e.message || String(e); list = []; draw(); });
    }
    function startCropFile(file, name) {
      if (!/^image\/(png|jpe?g|gif|webp)$/.test(file.type)) { msg = "Use a PNG, JPG, GIF or WebP picture."; draw(); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => startCrop(img, (name || file.name || "picture").replace(/\.[a-z0-9]+$/i, ""), file.type, file);
      img.onerror = () => { msg = "That picture could not be opened."; draw(); };
      img.src = url;
    }
    function startCropAsset(a) {
      const img = new Image();
      img.crossOrigin = "anonymous";               // the bridge answers with Access-Control-Allow-Origin
      img.onload = () => startCrop(img, (a.name || "picture") + " (cut)", a.mime, null);
      img.onerror = () => { msg = "This picture can't be cut here yet (it needs the bridge from 11 Nov)."; draw(); };
      img.src = a.url + "&cors=1";                 // a fresh request, not a cached one without the header
    }
    function startCrop(img, name, mime, file) {
      const W = img.naturalWidth, H = img.naturalHeight;
      crop = { img, name, mime, file, r: { x: 0, y: 0, w: W, h: H }, emailW: Math.min(EMAIL_W, Math.max(40, Math.round(W / 2))) };
      if (W >= EMAIL_W) crop.emailW = EMAIL_W;
      view = "crop"; msg = ""; draw();
    }

    // ---- drawing ------------------------------------------------------------------------------------
    function gridHtml() {
      const shown = (list || []).filter(a => !q || String(a.name || "").toLowerCase().indexOf(q.toLowerCase()) >= 0);
      const s = sel && (list || []).find(a => a.id === sel.id);
      return '<div class="emd-pics-body"><section class="emd-pics-lib" aria-label="Your pictures">'
        + '<div class="emd-pics-tools"><label class="emd-vh" for="emdPicQ">Find a picture</label><input id="emdPicQ" placeholder="Find a picture…" value="' + esc(q) + '">'
        + '<button type="button" class="rs-btn pri" data-pu="1">Upload…</button><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" data-pf="1" hidden></div>'
        + '<p class="emd-help" style="margin:0 0 10px">Or paste one here with Ctrl+V. Each upload opens in the cutter first, so you can keep only the part you need.</p>'
        + (err ? '<p class="emd-pics-err">Could not load the pictures: ' + esc(err) + "</p>" : "")
        + (list === null ? '<p class="emd-help">Loading the pictures…</p>' : !shown.length ? '<p class="emd-help">' + (q ? "No picture by that name." : "No pictures yet. Upload or paste one.") + "</p>"
          : '<div class="emd-pics-grid">' + shown.map(a => '<button type="button" class="emd-pic' + (s && s.id === a.id ? " on" : "") + '" data-ps="' + a.id + '" aria-pressed="' + !!(s && s.id === a.id) + '">'
            + '<span class="th"><img src="' + esc(a.url) + '" alt="" loading="lazy" data-dim="' + a.id + '"></span><b>' + esc(a.name || "Untitled") + "</b>"
            + "<small>" + (a.used_in && a.used_in.length ? "in " + esc(a.used_in.join(", ")) : "not used yet") + "</small></button>").join("") + "</div>")
        + "</section>" + '<section class="emd-pics-side" aria-label="The chosen picture">' + (s ? sideHtml(s) : '<p class="emd-help">Pick a picture to see it, rename it, cut a part out of it'
          + (mode === "manage" ? "" : " or use it") + ".</p>") + "</section></div>";
    }
    function sideHtml(a) {
      const d = dims[a.id];
      return '<div class="emd-pics-big"><img src="' + esc(a.url) + '" alt=""></div>'
        + '<label class="l" for="emdPicName">Name</label><input id="emdPicName" maxlength="160" value="' + esc(a.name || "") + '">'
        + '<p class="emd-help">' + (d ? d[0] + " × " + d[1] + " px · " : "") + kb(a.size || 0) + " · " + esc((a.mime || "").replace("image/", "").toUpperCase())
        + (a.by_email ? " · added by " + esc(String(a.by_email).split("@")[0]) : "") + "</p>"
        + '<p class="emd-help">' + (a.used_in && a.used_in.length ? "Used in: " + esc(a.used_in.join(", ")) : "Not used in any email yet.") + "</p>"
        + '<div class="emd-pics-acts">'
        + (mode !== "manage" ? '<button type="button" class="rs-btn pri" data-use="1">' + (mode === "insert" ? "Insert this picture" : "Use this picture") + "</button>" : "")
        + '<button type="button" class="rs-btn" data-cut="1">Cut a part out…</button>'
        + '<button type="button" class="rs-btn" data-copy="1">Copy its link</button>'
        + (a.used_in && a.used_in.length ? "" : '<button type="button" class="rs-btn" data-del="1">Delete</button>') + "</div>";
    }
    function cropHtml() {
      const c = crop, W = c.img.naturalWidth, H = c.img.naturalHeight;
      const outW = Math.min(c.r.w, c.emailW * 2), outH = Math.round(outW * c.r.h / c.r.w);
      const showH = Math.round(c.emailW * c.r.h / c.r.w);
      const sharp = c.r.w >= c.emailW * 2;
      const canWhole = c.file && c.file.size <= 2 * 1024 * 1024 && /png|jpe?g|gif/.test(c.mime) && c.r.x === 0 && c.r.y === 0 && c.r.w === W && c.r.h === H;
      return '<div class="emd-pics-body"><section class="emd-crop" aria-label="Cut a part out"><p class="emd-help" style="margin:0 0 8px">Drag the box over the part you want; drag a corner to resize it. '
        + 'Arrow keys move it, Shift + arrow keys resize it.</p><div class="emd-crop-stage" id="emdStage"><img src="' + esc(c.img.src) + '" alt="The picture to cut from" draggable="false">'
        + '<div class="emd-crop-box" id="emdBox" tabindex="0" role="slider" aria-label="The part to keep" aria-valuetext="' + c.r.w + " by " + c.r.h + ' pixels">'
        + ["nw", "ne", "sw", "se"].map(k => '<span class="h ' + k + '" data-h="' + k + '"></span>').join("") + "</div></div>"
        + '<p class="emd-help">' + c.r.w + " × " + c.r.h + " px of the " + W + " × " + H + " picture · "
        + '<button type="button" class="emd-linkbtn" data-all="1">Whole picture</button></p></section>'
        + '<section class="emd-pics-side" aria-label="How to save it"><label class="l" for="emdCutName">Name</label><input id="emdCutName" maxlength="160" value="' + esc(c.name) + '">'
        + '<label class="l">Width in the email</label><div class="emd-seg" role="group">'
        + [[EMAIL_W, "Full width"], [300, "Half"], [0, "Its own size"]].map(([v, l]) => {
          const val = v || Math.min(EMAIL_W, Math.max(40, Math.round(c.r.w / 2)));
          return '<button type="button" data-ew="' + val + '" class="' + (c.emailW === val ? "on" : "") + '" aria-pressed="' + (c.emailW === val) + '">' + l + "</button>";
        }).join("") + "</div>"
        + '<div class="emd-pics-facts"><span>Shown at <b>' + c.emailW + " × " + showH + "</b> in the email</span><span>Saved at <b>" + outW + " × " + outH + "</b>"
        + (sharp ? " (sharp on phones)" : "") + "</span>"
        + (sharp ? "" : '<span class="warn">This part is only ' + (c.r.w / c.emailW).toFixed(1) + "× the size it shows at. For phone-sharp pictures, a bigger original is better.</span>")
        + "<span>Solid background, no see-through parts</span></div>"
        + (msg ? '<p class="emd-pics-err" role="status">' + esc(msg) + "</p>" : "")
        + '<div class="emd-pics-acts"><button type="button" class="rs-btn pri" data-save="1"' + (busy ? " disabled" : "") + ">" + (busy ? "Saving…" : mode === "manage" ? "Save to Pictures" : "Save and use it") + "</button>"
        + (canWhole ? '<button type="button" class="rs-btn" data-whole="1"' + (busy ? " disabled" : "") + ">Save it as it is</button>" : "")
        + '<button type="button" class="rs-btn" data-back="1">Back</button></div></section></div>';
    }
    function insertHtml() {
      const a = ins.a, d = dims[a.id];
      const own = d ? Math.min(EMAIL_W, Math.max(20, Math.round(d[0] / 2))) : EMAIL_W;
      return '<div class="emd-pics-body"><section class="emd-pics-lib"><div class="emd-pics-big"><img src="' + esc(a.url) + '" alt=""></div></section>'
        + '<section class="emd-pics-side" aria-label="Put it in the email"><label class="l">Width in the email</label><div class="emd-seg" role="group">'
        + [[EMAIL_W, "Full width"], [300, "Half"], [own, "Its own size"]].map(([v, l]) => '<button type="button" data-iw="' + v + '" class="' + (ins.w === v ? "on" : "") + '" aria-pressed="' + (ins.w === v) + '">' + l + "</button>").join("") + "</div>"
        + '<label class="l">Position</label><div class="emd-seg" role="group">' + [["left", "Left"], ["center", "Centre"]].map(([v, l]) => '<button type="button" data-ia="' + v + '" class="' + (ins.align === v ? "on" : "") + '" aria-pressed="' + (ins.align === v) + '">' + l + "</button>").join("") + "</div>"
        + '<label class="l" for="emdInsAlt">What the picture says (for blocked pictures and screen readers)</label><textarea id="emdInsAlt" rows="3">' + esc(ins.alt) + "</textarea>"
        + '<label class="l" for="emdInsHref">Opens when pressed (optional)</label><input id="emdInsHref" placeholder="https://… or {survey_link}" value="' + esc(ins.href) + '">'
        + '<div class="emd-pics-acts"><button type="button" class="rs-btn pri" data-doins="1">Insert at the cursor</button><button type="button" class="rs-btn" data-back="1">Back</button></div></section></div>';
    }
    function draw() {
      const title = view === "crop" ? "Cut a part out" : view === "insert" ? "Insert a picture" : mode === "manage" ? "Pictures" : "Choose a picture";
      wrap.innerHTML = '<div class="emd-pics-dlg" role="dialog" aria-modal="true" aria-labelledby="emdPicsT"><div class="emd-pics-head"><h2 id="emdPicsT">' + title + "</h2>"
        + (msg && view === "grid" ? '<span class="emd-pics-err" role="status">' + esc(msg) + "</span>" : "")
        + '<button type="button" class="emd-ib" data-x="1" aria-label="Close">✕</button></div>'
        + (view === "crop" ? cropHtml() : view === "insert" ? insertHtml() : gridHtml()) + "</div>";
      wireUp();
    }

    // ---- the crop box -------------------------------------------------------------------------------
    function placeBox() {
      const st = wrap.querySelector("#emdStage"), box = wrap.querySelector("#emdBox");
      if (!st || !box) return;
      const im = st.querySelector("img"), k = im.clientWidth / crop.img.naturalWidth;
      crop.k = k;
      Object.assign(box.style, { left: crop.r.x * k + "px", top: crop.r.y * k + "px", width: crop.r.w * k + "px", height: crop.r.h * k + "px" });
    }
    function clampR(r) {
      const W = crop.img.naturalWidth, H = crop.img.naturalHeight;
      r.w = Math.max(10, Math.min(Math.round(r.w), W)); r.h = Math.max(10, Math.min(Math.round(r.h), H));
      r.x = Math.max(0, Math.min(Math.round(r.x), W - r.w)); r.y = Math.max(0, Math.min(Math.round(r.y), H - r.h));
      return r;
    }
    function wireCrop() {
      const st = wrap.querySelector("#emdStage"), box = wrap.querySelector("#emdBox");
      if (!st || !box) return;
      const im = st.querySelector("img");
      if (im.complete) placeBox(); else im.onload = placeBox;
      let drag = null;
      const down = (e, how) => { e.preventDefault(); e.stopPropagation(); drag = { how, x: e.clientX, y: e.clientY, r: Object.assign({}, crop.r) }; box.setPointerCapture && box.setPointerCapture(e.pointerId); };
      box.onpointerdown = e => down(e, e.target.dataset.h || "move");
      // a press outside the box starts a new box there
      st.onpointerdown = e => { if (e.target !== im) return; const b = im.getBoundingClientRect();
        crop.r = clampR({ x: (e.clientX - b.left) / crop.k, y: (e.clientY - b.top) / crop.k, w: 10, h: 10 }); placeBox(); down(e, "se"); };
      const move = e => {
        if (!drag) return;
        const dx = (e.clientX - drag.x) / crop.k, dy = (e.clientY - drag.y) / crop.k, r = Object.assign({}, drag.r);
        if (drag.how === "move") { r.x += dx; r.y += dy; }
        else {
          if (drag.how.indexOf("w") >= 0) { r.x += dx; r.w -= dx; } else r.w += dx;
          if (drag.how.indexOf("n") >= 0) { r.y += dy; r.h -= dy; } else r.h += dy;
          if (r.w < 10) { r.w = 10; } if (r.h < 10) { r.h = 10; }
        }
        crop.r = clampR(r); placeBox();
      };
      const up = () => { if (drag) { drag = null; draw(); } };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up, { once: false });
      wrap._unbind = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
      box.onkeydown = e => {
        const step = e.altKey ? 1 : 10, r = Object.assign({}, crop.r), k2 = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
        if (!k2) return;
        e.preventDefault();
        if (e.shiftKey) { r.w += k2[0] * step; r.h += k2[1] * step; } else { r.x += k2[0] * step; r.y += k2[1] * step; }
        crop.r = clampR(r); placeBox(); box.setAttribute("aria-valuetext", crop.r.w + " by " + crop.r.h + " pixels");
      };
    }
    function cutDataUrl() {
      const c = crop, outW = Math.min(c.r.w, c.emailW * 2), outH = Math.round(outW * c.r.h / c.r.w);
      const cv = document.createElement("canvas"); cv.width = outW; cv.height = outH;
      const g = cv.getContext("2d");
      g.fillStyle = "#ffffff"; g.fillRect(0, 0, outW, outH);     // no see-through parts
      g.imageSmoothingQuality = "high";
      g.drawImage(c.img, c.r.x, c.r.y, c.r.w, c.r.h, 0, 0, outW, outH);
      let data = /jpe?g/.test(c.mime) ? cv.toDataURL("image/jpeg", 0.9) : cv.toDataURL("image/png");
      if (data.length * 0.75 > 1.9 * 1024 * 1024) data = cv.toDataURL("image/jpeg", 0.88);
      return data;
    }
    function fileDataUrl(file) {
      return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(file); });
    }
    function saved(j, name) {
      busy = false;
      const a = { id: j.id || String(j.url).split("i=").pop(), url: j.url, name, used_in: [] };
      if (mode === "manage") { view = "grid"; msg = "Saved to Pictures."; sel = a; load(a.id); return; }
      done(a);
    }
    function done(a) {
      if (mode === "insert") { ins = { a, w: EMAIL_W, alt: "", align: "center", href: "" }; view = "insert"; draw(); return; }
      if (cfg.onPick) cfg.onPick(a.url, a);
      close();
    }

    // ---- wiring -------------------------------------------------------------------------------------
    function wireUp() {
      if (wrap._unbind) { wrap._unbind(); wrap._unbind = null; }
      const $ = s => wrap.querySelector(s), $$ = s => wrap.querySelectorAll(s);
      $$("[data-x]").forEach(b => { b.onclick = close; });
      wrap.onclick = e => { if (e.target === wrap) close(); };
      const qi = $("#emdPicQ"); if (qi) qi.oninput = () => { q = qi.value; const at = qi.selectionStart; draw(); const n = $("#emdPicQ"); if (n) { n.focus(); n.setSelectionRange(at, at); } };
      $$("[data-dim]").forEach(im => { const f = () => { dims[im.dataset.dim] = [im.naturalWidth, im.naturalHeight]; }; if (im.complete) f(); else im.onload = f; });
      const pu = $("[data-pu]"), pf = $("[data-pf]");
      if (pu && pf) { pu.onclick = () => pf.click(); pf.onchange = () => { const f = pf.files && pf.files[0]; if (f) startCropFile(f); }; }
      $$("[data-ps]").forEach(b => { b.onclick = () => { sel = (list || []).find(a => a.id === b.dataset.ps) || null; msg = ""; draw(); }; });
      const nm = $("#emdPicName");
      if (nm && sel) nm.onchange = () => { const v = nm.value.trim(); api.rename(sel.id, v).then(() => { sel.name = v; const a = list.find(x => x.id === sel.id); if (a) a.name = v; draw(); })
        .catch(e => { msg = e.message || String(e); draw(); }); };
      const use = $("[data-use]"); if (use && sel) use.onclick = () => done(sel);
      const cut = $("[data-cut]"); if (cut && sel) cut.onclick = () => startCropAsset(sel);
      const cp = $("[data-copy]");
      if (cp && sel) cp.onclick = () => { if (navigator.clipboard) navigator.clipboard.writeText(sel.url).then(() => { msg = "Link copied."; draw(); }, () => {}); };
      const del = $("[data-del]");
      if (del && sel) del.onclick = () => { if (!confirm("Delete \"" + (sel.name || "this picture") + "\"? It isn't in any email.")) return;
        api.remove(sel.id).then(() => { sel = null; msg = "Deleted."; load(); }).catch(e => { msg = e.message || String(e); draw(); }); };
      // crop
      if (view === "crop") wireCrop();
      const cn = $("#emdCutName"); if (cn) cn.oninput = () => { crop.name = cn.value; };
      $$("[data-ew]").forEach(b => { b.onclick = () => { crop.emailW = +b.dataset.ew; draw(); }; });
      const all = $("[data-all]"); if (all) all.onclick = () => { crop.r = { x: 0, y: 0, w: crop.img.naturalWidth, h: crop.img.naturalHeight }; draw(); };
      const sv = $("[data-save]");
      if (sv) sv.onclick = () => {
        let data;
        try { data = cutDataUrl(); } catch (e) { msg = "This picture can't be cut in the browser (its server doesn't allow it)."; draw(); return; }
        busy = true; msg = ""; draw();
        api.upload((crop.name || "picture").trim(), data).then(j => saved(j, crop.name)).catch(e => { busy = false; msg = e.message || String(e); draw(); });
      };
      const wh = $("[data-whole]");
      if (wh) wh.onclick = () => { busy = true; draw(); fileDataUrl(crop.file).then(d => api.upload((crop.name || "picture").trim(), d)).then(j => saved(j, crop.name))
        .catch(e => { busy = false; msg = e.message || String(e); draw(); }); };
      $$("[data-back]").forEach(b => { b.onclick = () => { view = "grid"; msg = ""; draw(); }; });
      // insert
      $$("[data-iw]").forEach(b => { b.onclick = () => { ins.w = +b.dataset.iw; draw(); }; });
      $$("[data-ia]").forEach(b => { b.onclick = () => { ins.align = b.dataset.ia; draw(); }; });
      const ia = $("#emdInsAlt"); if (ia) ia.oninput = () => { ins.alt = ia.value; };
      const ih = $("#emdInsHref"); if (ih) ih.oninput = () => { ins.href = ih.value.trim(); };
      const di = $("[data-doins]");
      if (di) di.onclick = () => { if (cfg.onPick) cfg.onPick(ins.a.url, ins.a, imgHtml(ins.a.url, ins.w, ins.alt, ins.align, ins.href)); close(); };
      const first = wrap.querySelector(view === "crop" ? "#emdBox" : "[data-x]"); if (first && !wrap.contains(document.activeElement)) first.focus();
    }

    draw();
    load();
    // "Crop again" on a picture in the email: straight into the cutter with that picture (12 Nov)
    if (cfg.cut && cfg.cut.url) startCropAsset({ url: cfg.cut.url, name: cfg.cut.name || "picture", mime: "" });
  }

  /* read a picked file as base64 and send it to the bridge (both pages use this) */
  function uploader(api) {
    return file => new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => api({ action: "upload", name: file.name, data: String(r.result || "") }).then(j => res(j.url)).catch(rej);
      r.onerror = () => rej(new Error("That file could not be read."));
      r.readAsDataURL(file);
    });
  }

  window.EMAILDESIGNER = { mount, uploader, css, picturesApi, openPictures, rowRanges, partInfo };
})();
