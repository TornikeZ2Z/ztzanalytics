/* Meta Referrals — upload the Meta referral lead exports, no SharePoint involved.
 *
 * His call (2026-08-17): "we can get rid of exports on sharepoint at all and we can have
 * just upload functionalities, which will result in table." Whoever holds the
 * `meta-referrals` grant (or Marketing / admin) drops the raw Meta "Leads" CSV exports
 * here. Those files are UTF-16 + tab-separated straight out of Meta — the page decodes
 * them CLIENT-SIDE (BOM sniff) and sends clean text; the bridge parses, DEDUPES BY LEAD
 * id, and fills `meta_referral_leads`. Overlapping export windows are expected: the same
 * lead in two files counts once, so people can re-export generously.
 *
 * The payoff happens in the warehouse: fct_moveboard matches these fills by phone/email
 * (on/after the fill date, 90-day window) and re-sources matched leads as 'Meta Referral'.
 */
registerPage({
  id: "meta-referrals",
  group: "marketing",
  title: "Meta Referrals",
  datasets: [],
  async render(host) {
    var RSC = window.RSC || {};
    var esc = RSC.esc || function (v) {
      return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
      });
    };
    if (!document.getElementById("mrfCss")) {
      var st = document.createElement("style"); st.id = "mrfCss";
      st.textContent = [
        ".mrf{font-variant-numeric:tabular-nums;max-width:1100px}",
        ".mrf-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-bottom:16px}",
        ".mrf-kpi{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:12px 16px}",
        ".mrf-kpi b{display:block;font-size:24px;letter-spacing:-.5px}",
        ".mrf-kpi span{display:block;font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint);margin-top:4px}",
        ".mrf-drop{border:2px dashed var(--line-2);border-radius:16px;background:var(--panel);padding:36px 24px;text-align:center;cursor:pointer;transition:border-color .15s,background .15s;margin-bottom:14px}",
        ".mrf-drop:hover,.mrf-drop.over{border-color:var(--brand);background:var(--brand-glow)}",
        ".mrf-drop b{font-size:15px}",
        ".mrf-drop .hint{font-size:12.5px;color:var(--faint);margin-top:6px;line-height:1.6}",
        ".mrf-file{display:flex;align-items:center;gap:12px;background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:10px 14px;margin-bottom:8px;font-size:13px}",
        ".mrf-file b{flex:1;font-weight:700;word-break:break-all}",
        ".mrf-file .n{color:var(--muted);white-space:nowrap}",
        ".mrf-file .x{border:0;background:transparent;color:var(--faint);cursor:pointer;font-size:13px;padding:4px 8px;border-radius:7px}",
        ".mrf-file .x:hover{background:rgba(226,73,73,.12);color:var(--neg)}",
        ".mrf-btn{font:inherit;font-size:14px;font-weight:800;padding:10px 24px;border-radius:11px;border:0;background:var(--brand);color:var(--brand-ink);cursor:pointer}",
        ".mrf-btn:disabled{opacity:.5;cursor:default}",
        ".mrf-msg{font-size:13px;font-weight:700;margin-left:12px}",
        ".mrf-card{background:var(--panel);border:1px solid var(--line);border-radius:13px;padding:16px 18px;margin-top:16px}",
        ".mrf-card h4{margin:0 0 10px;font-size:11.5px;font-weight:800;letter-spacing:.07em;text-transform:uppercase;color:var(--muted)}",
        ".mrf-tbl{width:100%;border-collapse:collapse;font-size:13px}",
        ".mrf-tbl th{text-align:left;font-size:10.5px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--faint);padding:0 10px 7px;border-bottom:1px solid var(--line)}",
        ".mrf-tbl td{padding:8px 10px;border-bottom:1px solid var(--line)}",
        ".mrf-tbl tr:last-child td{border-bottom:0}",
        ".mrf-new{color:var(--pos);font-weight:800}",
      ].join("\n");
      document.head.appendChild(st);
    }

    host.innerHTML = '<div class="mrf"><div class="rs-page-head"><h1>Meta Referrals</h1>'
      + "<p>Upload the Meta referral lead exports — leads are deduplicated automatically and "
      + "matched Moveboard leads become the <b>Meta Referral</b> source."
      + '<span class="freshness"> · re-uploading the same leads is always safe</span></p></div>'
      + '<div id="mrfMain"></div></div>';
    var main = host.querySelector("#mrfMain");
    var picked = [];        // {name, text, rows}

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

    async function paint() {
      var s;
      try { s = await api(); }
      catch (e) {
        main.innerHTML = '<div class="mrf-card"><b>Could not load</b> — ' + esc(e.message) + "</div>";
        return;
      }
      main.innerHTML =
        '<div class="mrf-kpis">'
        + '<div class="mrf-kpi"><b>' + s.leads + "</b><span>form fills stored</span></div>"
        + '<div class="mrf-kpi"><b>' + (s.matched == null ? "—" : s.matched) + "</b><span>moveboard leads matched</span></div>"
        + '<div class="mrf-kpi"><b>' + (s.window ? esc(s.window[0]) + " → " + esc(s.window[1]) : "—")
        + "</b><span>fill dates covered</span></div></div>"
        + '<div class="mrf-drop" id="mrfDrop"><b>Drop the Meta export files here — or click to choose</b>'
        + '<div class="hint">The raw ZIP contents work as-is: the CSV files Meta exports '
        + "(tab-separated, UTF-16) or any plain CSV with the same columns. Several files at once "
        + "is fine; the same lead appearing twice is counted once.</div>"
        + '<input type="file" id="mrfIn" accept=".csv" multiple style="display:none"></div>'
        + '<div id="mrfList"></div>'
        + '<div style="display:flex;align-items:center;margin-top:4px">'
        + '<button class="mrf-btn" id="mrfGo" disabled>Upload</button><span class="mrf-msg" id="mrfMsg"></span></div>'
        + '<div class="mrf-card"><h4>Recent uploads</h4>'
        + (s.uploads.length
            ? '<table class="mrf-tbl"><thead><tr><th>File</th><th>By</th><th>When</th>'
              + '<th style="text-align:right">Rows</th><th style="text-align:right">New</th></tr></thead><tbody>'
              + s.uploads.map(function (u) {
                  return "<tr><td>" + esc(u.file) + "</td><td>" + esc(String(u.by).split("@")[0])
                    + "</td><td>" + esc(u.at) + " UTC</td>"
                    + '<td style="text-align:right">' + u.rows + "</td>"
                    + '<td style="text-align:right" class="mrf-new">+' + u.new + "</td></tr>";
                }).join("") + "</tbody></table>"
            : '<div style="font-size:12.5px;color:var(--faint)">Nothing uploaded yet.</div>')
        + "</div>";
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
        btn.disabled = true; msg.style.color = "var(--muted)"; msg.textContent = "Uploading…";
        try {
          var r = await api({ method: "POST", body: JSON.stringify({
            files: picked.map(function (f) { return { name: f.name, text: f.text }; }) }) });
          picked = [];
          msg.style.color = "var(--pos)";
          msg.textContent = r.new_leads + " new lead" + (r.new_leads === 1 ? "" : "s") + " added · "
            + r.results.reduce(function (a, x) { return a + x.known; }, 0) + " already known"
            + (r.rebuild_started ? " · matching recalculates in the background (a few minutes)"
                                 : (r.new_leads ? " · matching lands with the next hourly refresh" : ""));
          await paint();
          main.querySelector("#mrfMsg").textContent = msg.textContent;
          main.querySelector("#mrfMsg").style.color = "var(--pos)";
        } catch (e) {
          msg.style.color = "var(--neg)"; msg.textContent = e.message; btn.disabled = false;
        }
      };
    }

    await paint();
  },
});
