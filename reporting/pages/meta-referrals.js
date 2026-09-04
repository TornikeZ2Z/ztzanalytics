/* Meta Referrals — the referral form fills, each one checked against Moveboard.
 *
 * His call (2026-08-17): "we can get rid of exports on sharepoint at all and we can have
 * just upload functionalities, which will result in table." Whoever holds the
 * `meta-referrals` grant (or Marketing / admin) drops the raw Meta "Leads" CSV exports
 * here. Those files are UTF-16 + tab-separated straight out of Meta — the page decodes
 * them CLIENT-SIDE (BOM sniff) and sends clean text; the bridge parses, DEDUPES BY LEAD
 * id, and fills `meta_referral_leads`.
 *
 * Second pass (2026-08-19): the page is about the FILLS now, not the files. Every stored
 * fill is listed with its Moveboard verdict — matched (the lead the warehouse re-sourced
 * as 'Meta Referral', earliest within the 90-day window), window still open, or window
 * closed with no lead. The match comes from the bridge and reads only leads the source
 * ladder ALREADY flagged, so this list can never claim a match the warehouse did not
 * make. The upload-files history is gone at his ask; uploading lives in the side rail.
 */
registerPage({
  id: "meta-referrals",
  group: "marketing",
  title: "Meta Referrals",
  datasets: [],
  async render(host) {
    var esc = function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    var S = window.__MRF || (window.__MRF = { q: "", unmatched: false });
    var TODAY = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

    var old = document.getElementById("mrfCss");
    if (old) old.remove();
    var st = document.createElement("style"); st.id = "mrfCss";
    st.textContent = [
      ".mrf{font-variant-numeric:tabular-nums}",
      ".mrf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}",
      ".mrf-kpi{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:13px 16px}",
      ".mrf-kpi b{display:block;font-size:25px;font-weight:850;letter-spacing:-.5px;line-height:1.1}",
      ".mrf-kpi span{display:block;font-size:10.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:4px}",
      ".mrf-kpi small{display:block;font-size:12px;color:var(--muted);margin-top:3px}",
      ".mrf-kpi.pos b{color:var(--pos)} .mrf-kpi.warn b{color:var(--warn)}",
      ".mrf-grid{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:16px;align-items:start}",
      "@media(max-width:1100px){.mrf-grid{grid-template-columns:minmax(0,1fr)}}",
      ".mrf-card{background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:var(--shadow);padding:18px 20px}",
      ".mrf-h{font-size:15px;font-weight:800;margin-bottom:4px}",
      ".mrf-h .n{font-weight:600;color:var(--faint);font-size:13px;margin-left:6px}",
      ".mrf-sub{font-size:12.5px;color:var(--muted);line-height:1.55;margin-bottom:12px}",
      ".mrf-bar{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin:0 0 12px}",
      ".mrf-fld{display:flex;flex-direction:column;gap:4px}",
      ".mrf-fld>span{font-size:10.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--faint)}",
      ".mrf-bar input{background:var(--panel);color:var(--ink);border:1px solid var(--line-2);border-radius:10px;padding:8px 12px;font-size:13px;font-family:inherit;min-width:230px}",
      ".mrf-tog{display:inline-flex;align-items:center;gap:8px;background:var(--panel);border:1px solid var(--line-2);border-radius:10px;padding:9px 13px;font-size:13px;font-weight:700;color:var(--muted);cursor:pointer;user-select:none}",
      ".mrf-tog.on{border-color:var(--brand);color:var(--ink)}",
      ".mrf-tog i{width:10px;height:10px;border-radius:3px;background:var(--line-2);display:block}",
      ".mrf-tog.on i{background:var(--brand)}",
      ".mrf-wrap{overflow:auto;max-height:66vh;border:1px solid var(--line);border-radius:12px}",
      ".mrf-tbl{width:100%;border-collapse:collapse;font-size:13.5px}",
      ".mrf-tbl th{text-align:left;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:9px 11px;border-bottom:2px solid var(--line);white-space:nowrap;position:sticky;top:0;background:var(--panel);z-index:1}",
      ".mrf-tbl td{padding:9px 11px;border-top:1px solid var(--line);vertical-align:middle}",
      ".mrf-tbl tbody tr:nth-child(even){background:color-mix(in srgb,var(--line) 14%,transparent)}",
      ".mrf-name{font-weight:750}",
      ".mrf-ref{display:block;font-size:11.5px;color:var(--faint);margin-top:2px}",
      ".mrf-dim{color:var(--faint)}",
      ".mrf-pill{display:inline-block;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}",
      ".mrf-pill.ok{background:color-mix(in srgb,var(--pos) 13%,transparent);color:var(--pos)}",
      ".mrf-pill.open{background:color-mix(in srgb,var(--warn) 13%,transparent);color:var(--warn)}",
      ".mrf-pill.no{background:var(--panel-2);color:var(--faint);border:1px solid var(--line-2)}",
      ".mrf-mt{display:block;font-size:12px;color:var(--muted);margin-top:3px;line-height:1.4}",
      ".mrf-drop{border:2px dashed var(--line-2);border-radius:14px;background:var(--panel-2);padding:22px 16px;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:12px}",
      ".mrf-drop:hover,.mrf-drop.over{border-color:var(--brand)}",
      ".mrf-drop b{font-size:13.5px}",
      ".mrf-drop .hint{font-size:12px;color:var(--faint);margin-top:6px;line-height:1.55}",
      ".mrf-file{display:flex;align-items:center;gap:10px;background:var(--panel-2);border:1px solid var(--line);border-radius:10px;padding:8px 12px;margin-bottom:7px;font-size:12.5px}",
      ".mrf-file b{flex:1;font-weight:700;word-break:break-all}",
      ".mrf-file .n{color:var(--muted);white-space:nowrap}",
      ".mrf-file .x{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:13px;padding:4px 8px;border-radius:7px}",
      ".mrf-file .x:hover{background:rgba(226,73,73,.12);color:var(--neg)}",
      ".mrf-btn{font:inherit;font-size:14px;font-weight:800;padding:10px 22px;border-radius:11px;border:0;background:var(--brand);color:var(--brand-ink);cursor:pointer}",
      ".mrf-btn:disabled{opacity:.5;cursor:default}",
      ".mrf-msg{font-size:12.5px;font-weight:700;margin-top:9px;line-height:1.5}",
    ].join("\n");
    document.head.appendChild(st);

    host.innerHTML = '<div class="mrf"><div class="rs-page-head"><h1>Meta Referrals</h1>'
      + "<p>Every referral-form fill, checked against Moveboard: a matched fill became a "
      + "<b>Meta Referral</b>-sourced lead; an unmatched one is either still inside its "
      + "90-day window or never turned into a lead."
      + '<span class="freshness"> · re-uploading the same leads is always safe</span></p></div>'
      + '<div id="mrfMain"></div></div>';
    var main = host.querySelector("#mrfMain");
    var picked = [];        // {name, text, rows}
    var DATA = null;        // last GET payload

    function api(opts) {
      return fetch(ZTZ.API + "/api/_mrupload", Object.assign({
        headers: Object.assign({ Authorization: "Bearer " + ZTZ.getToken() },
                               (opts && opts.body) ? { "Content-Type": "application/json" } : {}),
      }, opts || {})).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
          return j;
        });
      });
    }

    // Meta exports are UTF-16 with a BOM; a plain readAsText would produce garbage.
    function decodeFile(buf) {
      var b = new Uint8Array(buf);
      var enc = (b[0] === 0xFF && b[1] === 0xFE) ? "utf-16le"
              : (b[0] === 0xFE && b[1] === 0xFF) ? "utf-16be" : "utf-8";
      return new TextDecoder(enc).decode(buf);
    }
    function rowCount(text) {
      var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
      return Math.max(0, lines.length - 1);
    }
    function addDays(iso, n) {
      var d = new Date(iso + "T00:00:00Z");
      if (isNaN(d)) return null;
      d.setUTCDate(d.getUTCDate() + n);
      return d.toISOString().slice(0, 10);
    }
    var MONTHS = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    function dayLab(d) {
      if (!d || d.length < 10) return "—";
      return d.slice(8, 10) + " " + MONTHS[+d.slice(5, 7)] + " " + d.slice(0, 4);
    }

    function matchCell(f) {
      if (!f.date && !f.match) {
        return '<span class="mrf-pill no">no date</span><span class="mrf-mt">'
          + "the export carried no fill date — the window cannot be computed</span>";
      }
      if (f.match) {
        return '<span class="mrf-pill ok">matched</span><span class="mrf-mt">'
          + esc((f.match.company || "") + " #" + (f.match.job_no || "")) + " · lead "
          + esc(dayLab(f.match.created))
          + (f.match.status ? " · " + esc(f.match.status) : "")
          + (f.match.customer && f.match.customer !== f.name
              ? ' · as “' + esc(f.match.customer) + "”" : "") + "</span>";
      }
      var end = f.date ? addDays(f.date, 90) : null;
      if (end && end >= TODAY) {
        return '<span class="mrf-pill open">window open</span><span class="mrf-mt">'
          + "a matching lead still counts — until " + esc(dayLab(end)) + "</span>";
      }
      return '<span class="mrf-pill no">no lead</span><span class="mrf-mt">'
        + "the 90-day window closed without a Moveboard lead</span>";
    }

    function paintFills() {
      var box = main.querySelector("#mrfFills");
      if (!box || !DATA) return;
      var fills = DATA.fills || [];
      var v = fills;
      if (S.unmatched) v = v.filter(function (f) { return !f.match; });
      if (S.q) {
        var q = S.q.toLowerCase();
        v = v.filter(function (f) {
          return String(f.name || "").toLowerCase().indexOf(q) >= 0
            || String(f.email || "").toLowerCase().indexOf(q) >= 0
            || String(f.phone || "").toLowerCase().indexOf(q) >= 0
            || String(f.referring || "").toLowerCase().indexOf(q) >= 0;
        });
      }
      var open = fills.filter(function (f) {
        var e = f.date ? addDays(f.date, 90) : null;
        return !f.match && e && e >= TODAY;
      }).length;

      box.innerHTML = '<div class="mrf-h">Every form fill<span class="n">' + v.length + "</span></div>"
        + '<div class="mrf-sub">Newest first. <b>Matched</b> means the warehouse re-sourced a '
        + "Moveboard lead as Meta Referral for this fill (same phone or email, lead created "
        + "within 90 days of the fill — the earliest such lead is shown). "
        + open + " unmatched fill" + (open === 1 ? " is" : "s are") + " still inside the window."
        + (DATA.leads > fills.length
            ? " <b>Showing the newest " + fills.length + " of " + DATA.leads + " stored.</b>" : "")
        + "</div>"
        + '<div class="mrf-bar">'
        + '<div class="mrf-tog' + (S.unmatched ? " on" : "") + '" id="mrfUn"><i></i>Only unmatched</div>'
        + '<label class="mrf-fld"><span>Find</span><input id="mrfQ" '
        + 'placeholder="Name, email, phone…" value="' + esc(S.q) + '"></label>'
        + "</div>"
        + (v.length
          ? '<div class="mrf-wrap"><table class="mrf-tbl"><thead><tr>'
            + "<th>Filled</th><th>Who filled it</th><th>Email</th><th>Phone</th>"
            + "<th>Platform</th><th>Moveboard</th></tr></thead><tbody>"
            + v.map(function (f) {
                return "<tr><td>" + esc(dayLab(f.date)) + "</td>"
                  + '<td class="mrf-name">' + esc(f.name || "—")
                  + (f.referring ? '<span class="mrf-ref">referring: ' + esc(f.referring) + "</span>" : "")
                  + "</td>"
                  + "<td>" + (f.email ? esc(f.email) : '<span class="mrf-dim">—</span>') + "</td>"
                  + "<td>" + (f.phone ? esc(f.phone) : '<span class="mrf-dim">—</span>') + "</td>"
                  + "<td>" + esc(f.platform || "—") + "</td>"
                  + "<td>" + matchCell(f) + "</td></tr>";
              }).join("")
            + "</tbody></table></div>"
          : '<div class="mrf-sub">Nothing matches these filters.</div>');

      var un = box.querySelector("#mrfUn");
      if (un) un.onclick = function () { S.unmatched = !S.unmatched; paintFills(); };
      var q = box.querySelector("#mrfQ");
      if (q) q.oninput = function () {
        S.q = this.value;
        var at = this.selectionStart;
        paintFills();
        var n2 = box.querySelector("#mrfQ");
        if (n2) { n2.focus(); n2.setSelectionRange(at, at); }
      };
    }

    async function paint() {
      var s;
      try { s = await api(); }
      catch (e) {
        main.innerHTML = '<div class="mrf-card"><b>Could not load</b> — ' + esc(e.message)
          + ' <button class="mrf-btn" id="mrfRetry" style="margin-left:12px;padding:7px 16px;'
          + 'font-size:13px">Try again</button></div>';
        var rb = main.querySelector("#mrfRetry");
        if (rb) rb.onclick = function () { paint(); };
        return;
      }
      DATA = s;
      var fills = s.fills || [];
      var matched = fills.filter(function (f) { return f.match; }).length;
      var pct = fills.length ? Math.round(matched / fills.length * 100) + "%" : "—";

      main.innerHTML =
        '<div class="mrf-kpis">'
        + '<div class="mrf-kpi"><b>' + s.leads + "</b><span>form fills stored</span>"
        + "<small>" + (s.window ? esc(dayLab(s.window[0])) + " → " + esc(dayLab(s.window[1])) : "—") + "</small></div>"
        + '<div class="mrf-kpi pos"><b>' + matched + "</b><span>fills matched on Moveboard</span>"
        + "<small>" + pct + " of the fills turned into a lead</small></div>"
        + '<div class="mrf-kpi"><b>' + (s.matched == null ? "—" : s.matched)
        + "</b><span>leads sourced Meta Referral</span>"
        + "<small>what the source ladder shows across reports</small></div>"
        + "</div>"
        + '<div class="mrf-grid">'
        + '<div class="mrf-card" id="mrfFills"></div>'
        + '<div class="mrf-card"><div class="mrf-h">Upload new exports</div>'
        + '<div class="mrf-sub">The raw ZIP contents work as-is: the CSV files Meta exports '
        + "(tab-separated, UTF-16) or any plain CSV with the same columns. The same lead "
        + "appearing twice counts once, so re-export generously.</div>"
        + '<div class="mrf-drop" id="mrfDrop"><b>Drop the export files here — or click to choose</b>'
        + '<input type="file" id="mrfIn" accept=".csv" multiple style="display:none"></div>'
        + '<div id="mrfList"></div>'
        + '<button class="mrf-btn" id="mrfGo" disabled>Upload</button>'
        + '<div class="mrf-msg" id="mrfMsg"></div></div>'
        + "</div>";
      paintFills();
      wire();
    }

    function paintList() {
      var el = main.querySelector("#mrfList");
      el.innerHTML = picked.map(function (f, i) {
        return '<div class="mrf-file"><b>' + esc(f.name) + '</b><span class="n">'
          + f.rows + " row" + (f.rows === 1 ? "" : "s") + "</span>"
          + '<button class="x" data-i="' + i + '" title="Remove">✕</button></div>';
      }).join("");
      el.querySelectorAll("[data-i]").forEach(function (b) {
        b.onclick = function () { picked.splice(+b.dataset.i, 1); paintList(); sync(); };
      });
      sync();
    }
    function sync() {
      var go = main.querySelector("#mrfGo");
      if (go) go.disabled = !picked.length;
    }

    async function addFiles(files) {
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (!/\.csv$/i.test(f.name)) {
          main.querySelector("#mrfMsg").textContent = f.name + " is not a .csv — unzip the export first";
          main.querySelector("#mrfMsg").style.color = "var(--neg)";
          continue;
        }
        var text = decodeFile(await f.arrayBuffer());
        picked.push({ name: f.name, text: text, rows: rowCount(text) });
      }
      paintList();
    }

    function wire() {
      var drop = main.querySelector("#mrfDrop"), inp = main.querySelector("#mrfIn");
      drop.onclick = function () { inp.click(); };
      inp.onchange = function () { addFiles(inp.files); inp.value = ""; };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add("over"); };
      drop.ondragleave = function () { drop.classList.remove("over"); };
      drop.ondrop = function (e) {
        e.preventDefault(); drop.classList.remove("over");
        addFiles(e.dataTransfer.files);
      };
      main.querySelector("#mrfGo").onclick = async function () {
        var btn = this, msg = main.querySelector("#mrfMsg");
        // snapshot what is being sent: files dropped WHILE the upload runs must survive it
        var sending = picked.slice();
        btn.disabled = true; msg.style.color = "var(--muted)"; msg.textContent = "Uploading…";
        try {
          var r = await api({ method: "POST", body: JSON.stringify({
            files: sending.map(function (f) { return { name: f.name, text: f.text }; }) }) });
          picked = picked.slice(sending.length);
          var doneMsg = r.new_leads + " new lead" + (r.new_leads === 1 ? "" : "s") + " added · "
            + r.results.reduce(function (a, x) { return a + x.known; }, 0) + " already known"
            + (r.rebuild_started ? " · matching recalculates in the background (a few minutes)"
                                 : (r.new_leads ? " · matching lands with the next hourly refresh" : ""));
          await paint();
          // paint() may have failed and swapped in the error card -- the upload still
          // SUCCEEDED, so say so wherever a message element survives
          var m2 = main.querySelector("#mrfMsg");
          if (m2) { m2.textContent = doneMsg; m2.style.color = "var(--pos)"; }
        } catch (e) {
          msg.style.color = "var(--neg)"; msg.textContent = e.message; btn.disabled = false;
        }
      };
    }

    await paint();
  },
});
