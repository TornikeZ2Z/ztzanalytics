/* EMAIL DESIGNER -- the block editor with a live preview, shared by Email Automations (pages/
 * email-automations.js) and the Customer Survey's Email tab (pages/surveys.js). Tracker ZTZ-60, his picks
 * of 11 Nov 2026: emails like the green survey design Tako's team sent -- logo bar, banner (headline as
 * text in a chosen font OR an uploaded picture, decorative stars, a sticker), strip, text, square button,
 * signature, bottom bar -- built from brand colours only.
 *
 *   EMAILDESIGNER.mount(el, {
 *     template,          the email object (edited in place: subject, preheader, blocks, sign_*)
 *     kit,               bridge/email_auto.kit(): colours, fonts, stickers, designs, survey_link
 *     survey,            true on the survey: buttons may open "the customer's own survey"
 *     senders, sender,   From choices (omit on the survey) and the current one; onSender(v)
 *     category,          for the footer's unsubscribe wording in the preview
 *     preview(tpl)       -> Promise<{subject, html, problems}>
 *     upload(file)       -> Promise<url>   (PNG / JPG / GIF, up to 2 MB)
 *     pictures           picturesApi(get, post): the Pictures library (11 Nov) -- a Pictures button, "Choose from
 *                        Pictures" on every picture field, and "Insert picture" in the HTML code view
 *     onChange()         called after every edit (the page autosaves)
 *     designs            true: offer "Start from a design"
 *   })  ->  { refresh(), template() }
 *
 * One block is open at a time; the preview stays in view while the list scrolls. Every control has a
 * visible label or an aria-label, targets are at least 32px, and helper text uses --muted (AA contrast).
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

  function css() {
    if (document.getElementById("emd-style")) return;
    const st = document.createElement("style");
    st.id = "emd-style";
    st.textContent = ""
      + ".emd{display:grid;grid-template-columns:minmax(340px,1fr) minmax(0,1.05fr);gap:18px;align-items:start}"
      + "@media (max-width:1100px){.emd{grid-template-columns:minmax(0,1fr)}}"
      + ".emd-col{min-width:0}"
      + ".emd-sec{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px 16px;margin-bottom:12px}"
      + ".emd-h{font-size:13px;font-weight:700;color:var(--ink);margin:0 0 8px}"
      + ".emd-help{font-size:12.5px;color:var(--muted);line-height:1.5;margin:4px 0 0}"
      + ".emd label.l{display:block;font-size:12.5px;font-weight:700;color:var(--muted);margin:10px 0 5px}"
      + ".emd input[type=text],.emd input:not([type]),.emd textarea,.emd select{width:100%;box-sizing:border-box;font:inherit;"
      + "font-size:14px;padding:8px 11px;border:1px solid var(--line);border-radius:10px;background:var(--panel);color:var(--ink);min-height:36px}"
      + ".emd textarea{resize:vertical;line-height:1.5}"
      + ".emd-row{display:flex;align-items:center;gap:8px;padding:9px 10px;border:1px solid var(--line);border-radius:12px;"
      + "margin:8px 0;background:var(--panel);cursor:pointer;min-height:44px}"
      + ".emd-row:hover{border-color:var(--muted)}.emd-row.open{border-color:var(--brand);cursor:default;display:block}"
      + ".emd-row .nm{font-weight:700;font-size:13px;color:var(--ink);white-space:nowrap}"
      + ".emd-row .sm{font-size:12.5px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}"
      + ".emd-top{display:flex;align-items:center;gap:8px;flex:1;min-width:0;width:100%}"
      + ".emd-ob{display:flex;align-items:center;gap:8px;flex:1;min-width:0;border:0;background:none;padding:4px 2px;font:inherit;color:inherit;"
      + "text-align:left;cursor:pointer;min-height:32px;border-radius:6px}"
      + ".emd button:focus-visible,.emd input:focus-visible,.emd select:focus-visible,.emd textarea:focus-visible{outline:2px solid var(--brand-d,#5f7c20);outline-offset:2px}"
      + ".emd-ib{min-width:32px;height:32px;border-radius:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);"
      + "cursor:pointer;font-size:14px;line-height:1;padding:0 8px}"
      + ".emd-ib:hover{border-color:var(--muted)}.emd-ib:disabled{opacity:.35;cursor:default}"
      + ".emd-body{margin-top:8px;border-top:1px solid var(--line);padding-top:4px}"
      + ".emd-sw{display:inline-flex;gap:6px;flex-wrap:wrap}"
      + ".emd-sw button{width:32px;height:32px;border-radius:8px;border:1px solid var(--line);cursor:pointer;padding:0;position:relative}"
      + ".emd-sw button.on{outline:2px solid var(--ink);outline-offset:2px}"
      + ".emd-seg{display:inline-flex;border:1px solid var(--line);border-radius:10px;overflow:hidden}"
      + ".emd-seg button{border:0;background:var(--panel);color:var(--ink);font:inherit;font-size:13px;padding:7px 12px;cursor:pointer;min-height:34px}"
      + ".emd-seg button+button{border-left:1px solid var(--line)}"
      + ".emd-seg button.on{background:var(--ink);color:var(--panel);font-weight:700}"
      + ".emd-two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}"
      + ".emd-ln{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center;margin:6px 0}"
      + ".emd-chk{display:inline-flex;gap:8px;align-items:center;font-size:13px;cursor:pointer;min-height:32px}"
      + ".emd-chk input{width:18px;height:18px}"
      + ".emd-add{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:8px}"
      + ".emd-add button{text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:9px 10px;"
      + "cursor:pointer;font:inherit;color:var(--ink);min-height:52px}"
      + ".emd-add button:hover{border-color:var(--brand)}.emd-add b{display:block;font-size:13px}.emd-add span{font-size:12px;color:var(--muted)}"
      + ".emd-designs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}"
      + ".emd-designs button{text-align:left;border:1px solid var(--line);border-radius:12px;background:var(--panel);padding:10px 12px;"
      + "cursor:pointer;font:inherit;color:var(--ink)}"
      + ".emd-designs button:hover{border-color:var(--brand)}.emd-designs b{display:block}.emd-designs span{font-size:12px;color:var(--muted)}"
      + ".emd-pvw{position:sticky;top:12px}"
      + ".emd-pvbar{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:13px}"
      + ".emd-pvbar .subj{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink)}"
      + ".emd-pv{border:1px solid var(--line);border-radius:14px;background:#f2f1ec;overflow:hidden}"
      + ".emd-pv iframe{display:block;border:0;width:100%;height:calc(100vh - 210px);min-height:560px;background:#f2f1ec;margin:0 auto}"
      + ".emd-pv.mob iframe{width:390px;max-width:100%}"
      + ".emd-prob{margin-top:8px}.emd-prob div{font-size:12.5px;color:var(--neg);margin:3px 0}"
      + ".emd textarea.emd-code{font:12.5px/1.5 ui-monospace,SFMono-Regular,Consolas,monospace!important;min-height:420px;white-space:pre;tab-size:2}"
      + ".emd-meter{font-size:12.5px;color:var(--muted);margin-top:6px}.emd-meter.bad{color:var(--neg);font-weight:600}"
      + ".emd-thumb{display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap}.emd-thumb img{max-width:120px;max-height:60px;border-radius:6px;border:1px solid var(--line);background:#fff}"
      // the Pictures window (11 Nov, ZTZ-69)
      + ".emd-picsrow{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px}"
      + ".emd-pics{position:fixed;inset:0;z-index:10000;background:rgba(15,23,42,.55);display:flex;align-items:flex-start;justify-content:center;padding:28px 16px;overflow:auto}"
      + ".emd-pics-dlg{width:100%;max-width:1180px;background:var(--panel,#fff);color:var(--ink,#0f172a);border-radius:16px;box-shadow:0 20px 50px rgba(15,23,42,.3)}"
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
      + ".emd-pic:hover{border-color:var(--muted)}.emd-pic.on{border-color:#0369a1;box-shadow:0 0 0 2px #0369a1}"
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
      + ".emd-pics-err{color:var(--neg,#b91c1c);font-size:13px;font-weight:600}"
      + ".emd-pics-facts{display:flex;flex-direction:column;gap:4px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font-size:13px;margin-top:10px}"
      + ".emd-pics-facts .warn{color:#b45309;font-weight:600}"
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

  function mount(el, o) {
    css();
    const T = o.template;
    if (!Array.isArray(T.blocks)) T.blocks = [];
    const kit = o.kit || {};
    const colors = kit.colors || { green: "#8db13c", black: "#141414", white: "#ffffff", light: "#f4f4ef", deep: "#5f7f1f" };
    const fonts = kit.fonts || { archivo: "Archivo Black", arial: "Arial Black" };
    const stickers = kit.stickers || {};
    let open = -1, sigOpen = false, adding = false, pv = "desk", pvHtml = "", pvSubject = "", problems = [], pvT = null, busyUp = false;

    const changed = (structural) => { if (o.onChange) o.onChange(); if (structural) draw(); schedulePreview(); };
    function schedulePreview() {
      clearTimeout(pvT);
      pvT = setTimeout(() => {
        if (!o.preview) return;
        o.preview(T).then(j => {
          pvHtml = j.html || ""; pvSubject = j.subject || ""; problems = j.problems || [];
          const f = el.querySelector(".emd-pv iframe"); if (f) f.srcdoc = pvHtml;
          const s = el.querySelector(".emd-pvbar .subj"); if (s) s.textContent = pvSubject;
          const p = el.querySelector(".emd-prob"); if (p) p.innerHTML = problemsHtml();
        }).catch(() => {});
      }, 350);
    }
    const problemsHtml = () => problems.map(p => "<div>&#9888; " + esc(p) + "</div>").join("");

    // ---- small controls ------------------------------------------------------------------------
    const swatches = (key, cur, allowed) => '<div class="emd-sw" role="radiogroup">' + allowed.map(c =>
      '<button type="button" data-sw="' + key + ":" + c + '" class="' + (cur === c ? "on" : "") + '" style="background:' + colors[c]
      + '" aria-label="' + esc(COLOR_NAMES[c] || c) + '" aria-pressed="' + (cur === c) + '" title="' + esc(COLOR_NAMES[c] || c) + '"></button>').join("") + "</div>";
    const seg = (key, cur, opts) => '<div class="emd-seg" role="group">' + opts.map(([v, l]) =>
      '<button type="button" data-seg="' + key + ":" + v + '" class="' + (cur === v ? "on" : "") + '" aria-pressed="' + (cur === v) + '">' + esc(l) + "</button>").join("") + "</div>";
    const field = (label, key, val, ph, max) => '<label class="l">' + esc(label) + '</label><input data-f="' + key + '" maxlength="' + (max || 200)
      + '" value="' + esc(val) + '" placeholder="' + esc(ph || "") + '">';
    const check = (label, key, on) => '<label class="emd-chk"><input type="checkbox" data-c="' + key + '"' + (on ? " checked" : "") + ">" + esc(label) + "</label>";
    const uploadBtn = (key, label) => '<button type="button" class="rs-btn" data-up="' + key + '">' + esc(label) + '</button><input type="file" accept="image/png,image/jpeg,image/gif" data-file="' + key + '" hidden>'
      + (o.pictures ? '<button type="button" class="rs-btn" data-pick="' + key + '">Choose from Pictures</button>' : "");

    function summary(b) {
      if (b.t === "banner") return b.mode === "image" ? "Picture headline" : (b.lines || []).map(x => x.text).filter(Boolean).join(" / ");
      if (b.t === "text" || b.t === "heading" || b.t === "strip") return b.text || "(empty)";
      if (b.t === "button") return (b.label || "") + (b.url === kit.survey_link ? " · opens the survey" : b.url ? " · " + b.url : " · no link yet");
      if (b.t === "image") return b.url ? (b.alt || "picture") : "no picture yet";
      if (b.t === "logo") return (b.bg === "white" ? "white" : "light") + " band";
      if (b.t === "bar") return COLOR_NAMES[b.color] || "";
      return "";
    }

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
            + '<div style="display:flex;gap:6px;margin-top:4px">'
            + (lines.length < 4 ? '<button type="button" class="rs-btn" data-act="line+:' + i + '">+ Line</button>' : "")
            + (lines.length > 1 ? '<button type="button" class="rs-btn" data-act="line-:' + i + '">Remove last line</button>' : "") + "</div>"
            + '<div class="emd-two"><div><label class="l">Font</label><select data-f="' + k + 'font">' + Object.keys(fonts).map(f =>
              '<option value="' + f + '"' + ((b.font || "archivo") === f ? " selected" : "") + ">" + esc(fonts[f]) + "</option>").join("") + "</select></div>"
            + '<div><label class="l">Size</label>' + seg(k + "size", b.size || "l", [["m", "M"], ["l", "L"], ["xl", "XL"]]) + "</div></div>"
            + '<p class="emd-help">iPhone and Apple Mail show this font. Gmail and Outlook show Arial Black instead, which keeps the same weight.</p>';
        } else {
          h += '<div class="emd-thumb">' + (b.image ? '<img src="' + esc(b.image) + '" alt="">' : "") + uploadBtn(k + "image", b.image ? "Replace picture" : "Upload picture") + "</div>"
            + field("Describe the picture (shown when pictures are off)", k + "alt", b.alt, "How did your move go?", 160)
            + '<p class="emd-help">PNG, JPG or GIF, up to 2 MB, about 950 px wide for sharp phones.</p>';
        }
        h += field("Line under the headline (optional)", k + "sub", b.sub, "Tell us what went well…", 300)
          + '<div style="margin-top:8px">' + check("Show five stars (decoration)", k + "stars", !!b.stars) + "</div>"
          + '<label class="l">Sticker</label><select data-f="' + k + 'sticker"><option value="">None</option>'
          + Object.keys(stickers).map(s => '<option value="' + s + '"' + (b.sticker === s ? " selected" : "") + ">" + esc(stickers[s].label) + "</option>").join("")
          + (b.sticker && !stickers[b.sticker] ? '<option value="' + esc(b.sticker) + '" selected>Your picture</option>' : "") + "</select>"
          + '<div class="emd-thumb">' + uploadBtn(k + "sticker", "Upload your own sticker") + "</div>";
        return h;
      }
      if (b.t === "strip") return field("Words", k + "text", b.text, "First call • Packing • Move day", 120)
        + '<div class="emd-two"><div><label class="l">Background</label>' + swatches(k + "bg", b.bg || "black", ["black", "green", "deep", "light"]) + "</div>"
        + '<div><label class="l">Words colour</label>' + swatches(k + "color", b.color || "green", ["green", "white", "black"]) + "</div></div>";
      if (b.t === "heading") return field("Heading", k + "text", b.text, "How did your move go?", 160);
      if (b.t === "text") {
        const tx = String(b.text || "");
        const rows = Math.min(14, Math.max(3, tx.split(/\r?\n/).length + Math.ceil(tx.length / 60)));
        return '<label class="l">Text</label><textarea data-f="' + k + 'text" maxlength="3000" rows="' + rows + '">' + esc(tx) + "</textarea>";
      }
      if (b.t === "button") {
        const toSurvey = b.url === kit.survey_link;
        return field("Button text", k + "label", b.label, "Take the 2-minute survey", 60)
          + (o.survey ? '<label class="l">Opens</label>' + seg(k + "target", toSurvey ? "survey" : "url", [["survey", "The customer's own survey"], ["url", "A web address"]]) : "")
          + (toSurvey ? "" : field("Web address", k + "url", b.url, "https://…", 500))
          + '<div class="emd-two"><div><label class="l">Shape</label>' + seg(k + "style", b.style || "rounded", [["rounded", "Rounded"], ["square", "Square"]]) + "</div>"
          + '<div><label class="l">Position</label>' + seg(k + "align", b.align || "left", [["left", "Left"], ["center", "Centre"]]) + "</div></div>"
          + '<div class="emd-two"><div><label class="l">Colour</label>' + swatches(k + "color", b.color || "black", ["black", "green"]) + "</div>"
          + '<div style="padding-top:28px">' + check("Capital letters", k + "caps", !!b.caps) + "</div></div>";
      }
      if (b.t === "image") return '<div class="emd-thumb">' + (b.url ? '<img src="' + esc(b.url) + '" alt="">' : "") + uploadBtn(k + "url", b.url ? "Replace picture" : "Upload picture") + "</div>"
        + field("Describe the picture", k + "alt", b.alt, "Our crew on moving day", 120)
        + field("Link when pressed (optional)", k + "href", b.href, "https://…", 500);
      if (b.t === "bar") return '<label class="l">Colour</label>' + swatches(k + "color", b.color || "green", ["green", "black", "deep"]);
      return '<p class="emd-help">A thin grey line between parts of the email.</p>';
    }

    function draw() {
      const n = T.blocks.length;
      const html = T.mode === "html";
      let left = '<div class="emd-sec"><p class="emd-h">How do you want to build it?</p>'
        + seg("mode", html ? "html" : "blocks", [["blocks", "With blocks"], ["html", "Paste HTML"]])
        + '<p class="emd-help">' + (html ? "Paste a finished email, for example one Claude wrote for you. Both versions are kept, so you can switch back."
          : "Build it from blocks: banner, text, buttons, pictures.") + "</p>"
        + (o.pictures ? '<div class="emd-picsrow"><button type="button" class="rs-btn" data-pics="1">Pictures…</button><span class="emd-help" style="margin:0">'
          + "Upload, paste or cut a part out of a design, then use it in any email.</span></div>" : "") + "</div>";
      if (html) {
        const kb = Math.round(new Blob([T.html || ""]).size / 100) / 10;
        left += '<div class="emd-sec"><p class="emd-h">Inbox</p>'
          + (o.senders ? '<label class="l" for="emdFrom">From</label><select id="emdFrom">' + o.senders.map(x => '<option value="' + x + '"' + (o.sender === x ? " selected" : "")
            + ">Zip To Zip Moving &lt;" + x + "@mail.ziptozip.app&gt;</option>").join("") + "</select>" : "")
          + field("Subject", "subject", T.subject, "How did your move go, {first}?", 160)
          + field("Preview line (shown after the subject in the inbox)", "preheader", T.preheader, "It takes about 2 minutes.", 160) + "</div>"
          + '<div class="emd-sec"><p class="emd-h">The email\'s HTML</p>'
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'
          + (o.pictures ? '<button type="button" class="rs-btn pri" data-insertpic="1">Insert picture</button>' : "")
          + '<button type="button" class="rs-btn" data-copyrules="1">Copy instructions for Claude</button>'
          + '<span class="emd-help" style="margin:6px 0 0" id="emdCopied" role="status"></span></div>'
          + '<p class="emd-help" style="margin-top:0">1. Copy the instructions and paste them into Claude with a description of the email. 2. Paste the HTML Claude writes into the box below.'
          + (o.pictures ? " Put the cursor where a picture should go and press Insert picture." : "") + "</p>"
          + '<label class="l" for="emdHtml">HTML</label><textarea id="emdHtml" class="emd-code" data-f="html" spellcheck="false" maxlength="150000" placeholder="&lt;table&gt;…&lt;/table&gt;">' + esc(T.html || "") + "</textarea>"
          + '<div class="emd-meter' + (kb > 100 ? " bad" : "") + '" id="emdSize">' + kb + " KB of about 100 KB" + (kb > 100 ? ": too big, Gmail would cut it off" : "") + "</div>"
          + '<p class="emd-help">Added for you: the company address and the unsubscribe link at the bottom, and tracking on every link. '
          + "{first} and the other fields fill in for each customer" + (o.survey ? ", and {survey_link} becomes the customer's own survey link." : ".") + "</p></div>";
      }
      if (!html && o.designs && kit.designs) {
        left += '<div class="emd-sec"><p class="emd-h">Start from a design</p><div class="emd-designs">'
          + Object.keys(kit.designs).map(k => '<button type="button" data-design="' + k + '"><b>' + esc(kit.designs[k].label) + "</b><span>"
            + esc(kit.designs[k].hint) + "</span></button>").join("") + '</div><p class="emd-help">Replaces the email below. You can change every part after.</p></div>';
      }
      if (!html) left += '<div class="emd-sec"><p class="emd-h">Inbox</p>'
        + (o.senders ? '<label class="l" for="emdFrom">From</label><select id="emdFrom">' + o.senders.map(x => '<option value="' + x + '"' + (o.sender === x ? " selected" : "")
          + ">Zip To Zip Moving &lt;" + x + "@mail.ziptozip.app&gt;</option>").join("") + "</select>" : "")
        + field("Subject", "subject", T.subject, "How did your move go, {first}?", 160)
        + field("Preview line (shown after the subject in the inbox)", "preheader", T.preheader, "It takes about 2 minutes.", 160)
        + '<p class="emd-help">Personal touches: {first} is the customer\'s first name, {move_date} their move day, {foreman} their foreman, {state} the state.</p></div>';
      if (!html) left += '<div class="emd-sec"><p class="emd-h">The email, top to bottom</p>'
        + T.blocks.map((b, i) => {
          const isOpen = i === open;
          const tools = '<button type="button" class="emd-ib" data-mv="' + i + ':-1"' + (i ? "" : " disabled") + ' aria-label="Move ' + esc(NAMES[b.t]) + ' up">&uarr;</button>'
            + '<button type="button" class="emd-ib" data-mv="' + i + ':1"' + (i < n - 1 ? "" : " disabled") + ' aria-label="Move ' + esc(NAMES[b.t]) + ' down">&darr;</button>'
            + '<button type="button" class="emd-ib" data-del="' + i + '" aria-label="Remove ' + esc(NAMES[b.t]) + '">&times;</button>';
          return '<div class="emd-row' + (isOpen ? " open" : "") + '" data-open="' + i + '"><div class="emd-top"><button type="button" class="emd-ob" data-ob="' + i
            + '" aria-expanded="' + isOpen + '"><span class="nm">' + esc(NAMES[b.t] || b.t)
            + '</span><span class="sm">' + esc(summary(b)) + "</span></button>" + tools + "</div>"
            + (isOpen ? '<div class="emd-body">' + blockFields(b, i) + '<div style="margin-top:10px"><button type="button" class="rs-btn" data-close="1">Done</button></div></div>' : "") + "</div>";
        }).join("")
        + (adding ? '<div class="emd-add">' + Object.keys(NAMES).map(k => '<button type="button" data-add="' + k + '"><b>' + esc(NAMES[k]) + "</b><span>" + esc(HINTS[k]) + "</span></button>").join("")
          + '</div><div style="margin-top:8px"><button type="button" class="rs-btn" data-addcancel="1">Cancel</button></div>'
          : '<button type="button" class="rs-btn" data-addopen="1" style="margin-top:4px">+ Add a block</button>')
        + "</div>";
      if (!html) left += '<div class="emd-sec"><div class="emd-row' + (sigOpen ? " open" : "") + '" data-sig="1" style="margin:0"><div class="emd-top"><button type="button" class="emd-ob" data-ob="sig" aria-expanded="' + sigOpen + '"><span class="nm">Signature</span><span class="sm">'
        + esc([T.sign_closing, T.sign_name, T.sign_title].filter(Boolean).join(" · ") || "none") + "</span></button></div>"
        + (sigOpen ? '<div class="emd-body">' + field("Closing line", "sign_closing", T.sign_closing, "Thank you,", 60)
          + '<div class="emd-two"><div>' + field("Name", "sign_name", T.sign_name, "Tako", 60) + "</div><div>" + field("Title", "sign_title", T.sign_title, "Customer Care", 120) + "</div></div>"
          + '<label class="l">Title colour</label>' + seg("sign_color", T.sign_color || "grey", [["grey", "Grey"], ["green", "Green"]])
          + '<div style="margin-top:10px"><button type="button" class="rs-btn" data-close="1">Done</button></div></div>' : "") + "</div>"
        + '<p class="emd-help">Every email ends with the company address and an unsubscribe link; they are added for you.</p></div>';
      const right = '<div class="emd-pvw"><div class="emd-pvbar"><b>Subject:</b><span class="subj">' + esc(pvSubject) + "</span>"
        + seg("pv", pv, [["desk", "Desktop"], ["mob", "Phone"]]) + "</div>"
        + '<div class="emd-pv ' + (pv === "mob" ? "mob" : "") + '"><iframe title="Email preview" sandbox=""></iframe></div>'
        + '<div class="emd-prob" role="status">' + problemsHtml() + '</div><p class="emd-help">The preview uses a sample customer, Jordan, who moved on October 24.</p></div>';
      el.innerHTML = '<div class="emd"><div class="emd-col">' + left + '</div><div class="emd-col">' + right + "</div></div>";
      wire();
      const f = el.querySelector(".emd-pv iframe"); if (f && pvHtml) f.srcdoc = pvHtml;
    }

    // a path like "b2.lines.0.text" or "subject" -> [object, key]
    function at(path) {
      const parts = path.split(".");
      let obj = T, i = 0;
      if (parts[0][0] === "b" && /^b\d+$/.test(parts[0])) { obj = T.blocks[+parts[0].slice(1)]; i = 1; }
      for (; i < parts.length - 1; i++) obj = obj[/^\d+$/.test(parts[i]) ? +parts[i] : parts[i]];
      return [obj, parts[parts.length - 1]];
    }
    function wire() {
      const $$ = s => el.querySelectorAll(s);
      $$("[data-open]").forEach(r => { r.onclick = ev => {
        if (ev.target.closest("button,input,select,textarea,label")) return;
        const i = +r.dataset.open; if (open !== i) { open = i; sigOpen = false; adding = false; draw(); }
      }; });
      // the row's name is a real button: Tab reaches it, Enter or Space opens it (the row itself is only a mouse target)
      $$("[data-ob]").forEach(b => { b.onclick = () => {
        const k = b.dataset.ob;
        if (k === "sig") { sigOpen = !sigOpen; open = -1; } else { const i = +k; open = open === i ? -1 : i; sigOpen = false; }
        adding = false; draw();
        const again = el.querySelector('[data-ob="' + k + '"]'); if (again) again.focus();
      }; });
      $$("[data-sig]").forEach(r => { r.onclick = ev => { if (ev.target.closest("button,input,select,textarea,label")) return; if (!sigOpen) { sigOpen = true; open = -1; draw(); } }; });
      $$("[data-close]").forEach(b => { b.onclick = () => { open = -1; sigOpen = false; draw(); }; });
      $$("[data-f]").forEach(inp => {
        const ev = inp.tagName === "SELECT" ? "onchange" : "oninput";
        inp[ev] = () => { const [obj, key] = at(inp.dataset.f); obj[key] = inp.value; changed(false);
          const row = inp.closest(".emd-row"); if (row) { const sm = row.querySelector(".sm"); const i = +row.dataset.open; if (sm && T.blocks[i]) sm.textContent = summary(T.blocks[i]); } };
      });
      const ta = el.querySelector("#emdHtml");
      if (ta) ta.addEventListener("input", () => {
        const kb = Math.round(new Blob([ta.value]).size / 100) / 10, m = el.querySelector("#emdSize");
        if (m) { m.textContent = kb + " KB of about 100 KB" + (kb > 100 ? ": too big, Gmail would cut it off" : ""); m.className = "emd-meter" + (kb > 100 ? " bad" : ""); }
      });
      $$("[data-copyrules]").forEach(b => { b.onclick = () => {
        const txt = claudeRules(!!o.survey), note = el.querySelector("#emdCopied");
        const done = ok => { if (note) note.textContent = ok ? "Copied. Paste it into Claude and describe the email." : "Copy didn't work; select the box's text instead."; };
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => done(true), () => done(false));
        else done(false);
      }; });
      $$("[data-c]").forEach(inp => { inp.onchange = () => { const [obj, key] = at(inp.dataset.c); obj[key] = inp.checked; changed(false); }; });
      $$("[data-sw]").forEach(b => { b.onclick = () => { const i = b.dataset.sw.lastIndexOf(":"); const [obj, key] = at(b.dataset.sw.slice(0, i)); obj[key] = b.dataset.sw.slice(i + 1); changed(true); }; });
      $$("[data-seg]").forEach(b => { b.onclick = () => {
        const i = b.dataset.seg.lastIndexOf(":"), path = b.dataset.seg.slice(0, i), v = b.dataset.seg.slice(i + 1);
        if (path === "pv") { pv = v; draw(); return; }
        if (path === "mode") { T.mode = v === "html" ? "html" : "blocks"; if (T.html == null) T.html = ""; changed(true); return; }
        const [obj, key] = at(path);
        if (key === "target") { obj.url = v === "survey" ? kit.survey_link : ""; } else obj[key] = v;
        changed(true);
      }; });
      $$("[data-mv]").forEach(b => { b.onclick = ev => { ev.stopPropagation(); const [i, d] = b.dataset.mv.split(":").map(Number), j = i + d;
        if (j < 0 || j >= T.blocks.length) return; const x = T.blocks[i]; T.blocks[i] = T.blocks[j]; T.blocks[j] = x; if (open === i) open = j; else if (open === j) open = i; changed(true); }; });
      $$("[data-del]").forEach(b => { b.onclick = ev => { ev.stopPropagation(); const i = +b.dataset.del;
        if (!confirm("Remove this " + (NAMES[T.blocks[i].t] || "block").toLowerCase() + "?")) return;
        T.blocks.splice(i, 1); open = -1; changed(true); }; });
      $$("[data-act]").forEach(b => { b.onclick = () => { const [what, i] = b.dataset.act.split(":"); const bl = T.blocks[+i];
        if (what === "line+") bl.lines.push({ text: "", color: "black" }); else bl.lines.pop(); changed(true); }; });
      $$("[data-addopen]").forEach(b => { b.onclick = () => { adding = true; open = -1; draw(); }; });
      $$("[data-addcancel]").forEach(b => { b.onclick = () => { adding = false; draw(); }; });
      $$("[data-add]").forEach(b => { b.onclick = () => {
        if (T.blocks.length >= 20) { alert("An email can have up to 20 blocks."); return; }
        const t = b.dataset.add;
        const nb = t === "banner" ? { t, bg: "green", tag: "", mode: "text", font: "archivo", size: "l", lines: [{ text: "Your headline", color: "black" }], sub: "", stars: false, sticker: "" }
          : t === "strip" ? { t, text: "", bg: "black", color: "green" } : t === "button" ? { t, label: "Open", url: o.survey ? kit.survey_link : "", style: "square", align: "center", caps: true, color: "black" }
          : t === "image" ? { t, url: "", alt: "", href: "" } : t === "logo" ? { t, bg: "light", rule: "black" } : t === "bar" ? { t, color: "green" }
          : t === "divider" ? { t } : { t, text: "" };
        // logo bars go first, bottom bars last; everything else goes in above a bottom bar
        let at2 = T.blocks.length;
        if (t === "logo") at2 = 0;
        else if (t !== "bar") while (at2 > 0 && T.blocks[at2 - 1].t === "bar") at2--;
        T.blocks.splice(at2, 0, nb); adding = false; open = at2; changed(true);
      }; });
      $$("[data-design]").forEach(b => { b.onclick = () => {
        if (!confirm("Start from \"" + kit.designs[b.dataset.design].label + "\"? This replaces the email you have now.")) return;
        const d = JSON.parse(JSON.stringify(kit.designs[b.dataset.design].template));
        Object.keys(T).forEach(k => delete T[k]); Object.assign(T, d); if (!Array.isArray(T.blocks)) T.blocks = [];
        open = -1; changed(true);
      }; });
      const from = el.querySelector("#emdFrom"); if (from) from.onchange = () => { if (o.onSender) o.onSender(from.value); changed(false); };
      // PICTURES (11 Nov): the library, a picture for a field, and a picture into the pasted HTML at the cursor
      $$("[data-pics]").forEach(b => { b.onclick = () => openPictures(o.pictures, { mode: "manage" }); });
      $$("[data-pick]").forEach(b => { b.onclick = () => openPictures(o.pictures, { mode: "pick", onPick: url => {
        const [obj, key] = at(b.dataset.pick); obj[key] = url; changed(true); } }); });
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
        } }); }; });
      $$("[data-up]").forEach(b => { b.onclick = () => { const f = el.querySelector('[data-file="' + b.dataset.up + '"]'); if (f) f.click(); }; });
      $$("[data-file]").forEach(f => { f.onchange = () => {
        const file = f.files && f.files[0]; if (!file || !o.upload) return;
        if (file.size > 2 * 1024 * 1024) { alert("Pictures can be up to 2 MB. Make it smaller and try again."); return; }
        if (busyUp) return; busyUp = true;
        const b = el.querySelector('[data-up="' + f.dataset.file + '"]'); if (b) { b.disabled = true; b.textContent = "Uploading…"; }
        o.upload(file).then(url => { busyUp = false; const [obj, key] = at(f.dataset.file); obj[key] = url; changed(true); })
          .catch(e => { busyUp = false; alert(e.message || String(e)); draw(); });
      }; });
    }

    draw();
    schedulePreview();
    return { refresh: () => { draw(); schedulePreview(); }, template: () => T };
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

  window.EMAILDESIGNER = { mount, uploader, css, picturesApi, openPictures };
})();
